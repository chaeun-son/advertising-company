import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClipboardPen, FileText, ImagePlus, PenTool, Plus, Printer, ScrollText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BannerPreview } from "@/components/banner-preview";
import { OrderForm, type OrderFormValue } from "@/components/order-form";
import { StaffThread } from "@/components/staff-thread";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { fileToDataUrl } from "@/lib/image";
import { inferColorMode, lineAmount, specLabel, unpackOrderNotes, vatBreakdown, won } from "@/lib/pricing";
import {
  addDraft,
  addDraftsFromItems,
  addMessage,
  deleteDraft,
  getBootstrap,
  getOrder,
  issueDocument,
  patchOrderItem,
  removeOrderItem,
  updateDraft,
  updateDraftStatus,
  updateOrder,
  updateOrderStatus,
} from "@/lib/server/api";
import { useStaffSession } from "@/lib/staff-session";
import {
  DRAFT_STATUS_META,
  DRAFT_STATUSES,
  ORDER_STATUSES,
  STATUS_META,
  type DraftStatus,
  type OrderStatus,
  type Draft,
  type OrderItem,
} from "@/lib/types";

export const Route = createFileRoute("/_app/orders/$id")({
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { id } = Route.useParams();
  const orderId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const staffName = useStaffSession((s) => s.name) || "직원";
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftCopy, setDraftCopy] = useState("");
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [draftW, setDraftW] = useState("700");
  const [draftH, setDraftH] = useState("50");

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder({ data: { id: orderId } }),
    enabled: Number.isFinite(orderId),
  });
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const statusMut = useMutation({
    mutationFn: (status: OrderStatus) =>
      updateOrderStatus({ data: { id: orderId, status, staffName } }),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : "변경 실패"),
  });

  const msgMut = useMutation({
    mutationFn: (body: string) => addMessage({ data: { orderId, staffName, body } }),
    onSuccess: invalidate,
  });

  const draftMut = useMutation({
    mutationFn: () =>
      addDraft({
        data: {
          orderId,
          staffName,
          title: draftTitle.trim() || `${(orderQuery.data?.drafts.length ?? 0) + 1}번`,
          notes: draftNotes,
          manuscript: draftCopy,
          bgColor: orderQuery.data?.bgColor ?? "#1b1814",
          textColor: orderQuery.data?.textColor ?? "#f7f1e6",
          imageData: draftImage,
          status: "working",
          widthCm: Number(draftW) || 0,
          heightCm: Number(draftH) || 0,
        },
      }),
    onSuccess: async () => {
      setDraftTitle("");
      setDraftNotes("");
      setDraftCopy("");
      setDraftImage(null);
      toast.success("시안을 추가했습니다.");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "시안 저장 실패"),
  });

  const bulkDraftMut = useMutation({
    mutationFn: () => addDraftsFromItems({ data: { orderId, staffName } }),
    onSuccess: async (res) => {
      toast.success(res.added ? `시안 ${res.added}칸을 만들었습니다.` : "이미 품목만큼 시안이 있습니다.");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "시안 추가 실패"),
  });

  const saveDraftMut = useMutation({
    mutationFn: (input: {
      id: number;
      title: string;
      manuscript: string;
      notes: string;
      imageData?: string | null;
      widthCm?: number;
      heightCm?: number;
    }) => updateDraft({ data: { ...input, orderId, staffName } }),
    onSuccess: async () => {
      toast.success("시안을 저장했습니다.");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "시안 저장 실패"),
  });

  const draftStatusMut = useMutation({
    mutationFn: (input: { id: number; status: DraftStatus }) =>
      updateDraftStatus({ data: { ...input, orderId, staffName } }),
    onSuccess: invalidate,
  });

  const deleteDraftMut = useMutation({
    mutationFn: (id: number) => deleteDraft({ data: { id, orderId, staffName } }),
    onSuccess: async () => {
      toast.success("시안을 삭제했습니다.");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "삭제 실패"),
  });

  const patchItemMut = useMutation({
    mutationFn: (input: { id: number; widthCm: number; heightCm: number; qty: number; unitPrice: number }) =>
      patchOrderItem({ data: { ...input, orderId, staffName } }),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : "품목 수정 실패"),
  });

  const removeItemMut = useMutation({
    mutationFn: (id: number) => removeOrderItem({ data: { id, orderId, staffName } }),
    onSuccess: async () => {
      toast.success("품목을 삭제했습니다.");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "삭제 실패"),
  });

  const saveMut = useMutation({
    mutationFn: (value: OrderFormValue) =>
      updateOrder({
        data: {
          id: orderId,
          staffName,
          ...value,
          items: value.items.map(({ productId, widthCm, heightCm, qty, memo, copy, unitPrice }) => ({
            productId,
            widthCm,
            heightCm,
            qty,
            memo,
            copy,
            unitPrice,
          })),
        },
      }),
    onSuccess: async () => {
      setEditing(false);
      toast.success("주문을 수정했습니다.");
      await invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "저장 실패"),
  });

  const docMut = useMutation({
    mutationFn: (docType: "quote" | "statement") =>
      issueDocument({ data: { orderId, docType, staffName } }),
    onSuccess: async (res, docType) => {
      toast.success(`${res.docNo} 발행`);
      await invalidate();
      await navigate({
        to: docType === "quote" ? "/print/quote/$id" : "/print/statement/$id",
        params: { id: String(res.id) },
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "발행 실패"),
  });

  const order = orderQuery.data;
  const company = boot.data?.company;

  if (orderQuery.isPending || !order) {
    return <p className="text-muted">주문을 여는 중…</p>;
  }

  const supply = order.items.reduce(
    (sum, item) =>
      sum +
      lineAmount({
        widthCm: item.widthCm,
        heightCm: item.heightCm,
        qty: item.qty,
        unitPrice: item.unitPrice,
        unit: item.unit,
        name: item.productName,
      }),
    0,
  );
  const tax = company
    ? vatBreakdown(supply, company.vatIncluded)
    : { supply, vat: 0, total: supply };
  const sized = order.items.find((i) => i.widthCm > 0) ?? order.items[0];
  const meta = unpackOrderNotes(order.notes);

  if (editing && boot.data) {
    return (
      <div className="space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">주문 수정</h1>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            취소
          </Button>
        </header>
        <OrderForm
          products={boot.data.products}
          clients={boot.data.clients}
          staff={boot.data.staff}
          company={boot.data.company}
          initial={{
            clientId: order.clientId,
            title: order.title,
            dueDate: order.dueDate,
            rush: order.rush,
            assignee: order.assignee,
            manuscript: order.manuscript,
            notes: order.notes,
            bgColor: order.bgColor,
            textColor: order.textColor,
            items: order.items.map((it) => ({
              key: String(it.id),
              productId: it.productId,
              widthCm: it.widthCm,
              heightCm: it.heightCm,
              qty: it.qty,
              memo: it.memo,
              copy: it.copy,
              unitPrice: it.unitPrice,
            })),
          }}
          submitLabel="수정 저장"
          pending={saveMut.isPending}
          onSubmit={(value) => saveMut.mutate(value)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[13px] tabular-nums text-muted">{order.orderNo}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{order.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {order.clientName}
            {order.clientContact ? ` · ${order.clientContact}` : ""}
            {order.clientPhone ? ` · ${order.clientPhone}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <NativeSelect
            className="h-11 w-[9.5rem]"
            value={order.status}
            onChange={(e) => statusMut.mutate(e.target.value as OrderStatus)}
            aria-label="상태 변경"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </NativeSelect>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            수정
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const text = [
                order.title,
                order.clientName,
                order.clientPhone,
                ...order.items.flatMap((it) => [
                  `${it.productName} ${it.widthCm}×${it.heightCm}cm ${it.qty}개`,
                  it.copy,
                  it.memo,
                ]),
                order.manuscript,
              ]
                .map((line) => line.trim())
                .filter(Boolean)
                .join("\n");
              sessionStorage.setItem("adsmile-studio-order", text);
              void navigate({ to: "/studio" });
            }}
          >
            <PenTool />
            편집실
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20.5rem]">
        <div className="space-y-5">
          <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold">시안</h2>
                <p className="mt-1 text-[13px] text-muted">
                  문구를 넣으면 크기에 맞는 예시가 나옵니다. 작업한 시안 그림을 올리면 예시 대신 그 시안만 보입니다.{" "}
                  {order.rush ? "급행 · " : ""}
                  {order.assignee || "담당 미정"}
                </p>
              </div>
              {order.items.length > order.drafts.length ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => bulkDraftMut.mutate()}
                  disabled={bulkDraftMut.isPending}
                >
                  <Plus />
                  품목마다 시안 추가
                </Button>
              ) : null}
            </div>
            {order.drafts.length === 0 ? (
              <div className="mt-4">
                <BannerPreview
                  manuscript={order.manuscript}
                  widthCm={sized?.widthCm || 600}
                  heightCm={sized?.heightCm || 90}
                  bgColor={order.bgColor}
                  textColor={order.textColor}
                />
                {order.manuscript ? (
                  <pre className="mt-4 whitespace-pre-wrap font-display text-sm leading-relaxed text-fg">
                    {order.manuscript}
                  </pre>
                ) : (
                  <p className="mt-4 text-sm text-muted">아직 시안이 없습니다. 아래에서 시안을 추가하세요.</p>
                )}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {order.drafts
                  .slice()
                  .sort((a, b) => a.version - b.version)
                  .map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      items={order.items}
                      fallbackCopy={order.manuscript}
                      saving={saveDraftMut.isPending}
                      onSave={(next) => saveDraftMut.mutate({ id: draft.id, ...next })}
                      onStatus={(status) => draftStatusMut.mutate({ id: draft.id, status })}
                      onDelete={() => {
                        if (window.confirm(`${draft.version}번 시안을 삭제할까요?`)) {
                          deleteDraftMut.mutate(draft.id);
                        }
                      }}
                    />
                  ))}
              </div>
            )}
            {meta.notes ? <p className="mt-3 text-sm text-muted">메모: {meta.notes}</p> : null}
            <p className="mt-2 text-[13px] text-muted">
              결제 {meta.payment}
              {meta.delivery ? ` · ${meta.delivery}` : ""}
            </p>
          </section>

          <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
            <h2 className="font-display text-base font-semibold">품목</h2>
            <ul className="mt-3 divide-y divide-border">
              {order.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  amount={lineAmount({
                    widthCm: item.widthCm,
                    heightCm: item.heightCm,
                    qty: item.qty,
                    unitPrice: item.unitPrice,
                    unit: item.unit,
                    name: item.productName,
                  })}
                  busy={patchItemMut.isPending || removeItemMut.isPending}
                  canDelete={order.items.length > 1}
                  onSave={(next) => patchItemMut.mutate({ id: item.id, ...next })}
                  onDelete={() => {
                    if (window.confirm(`${item.productName} ${item.widthCm}×${item.heightCm}를 삭제할까요?`)) {
                      removeItemMut.mutate(item.id);
                    }
                  }}
                />
              ))}
            </ul>
            <div className="mt-3 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted">
                <span>공급가액</span>
                <span className="tabular-nums">{won(tax.supply)}</span>
              </div>
              <div className="mt-1 flex justify-between text-muted">
                <span>부가세</span>
                <span className="tabular-nums">{won(tax.vat)}</span>
              </div>
              <div className="mt-2 flex justify-between font-display text-lg font-semibold">
                <span>합계</span>
                <span className="tabular-nums">{won(tax.total)}</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" asChild>
                <Link to="/print/request/$id" params={{ id: String(order.id) }} target="_blank">
                  <ClipboardPen />
                  의뢰서
                </Link>
              </Button>
              <Button variant="secondary" onClick={() => docMut.mutate("quote")} disabled={docMut.isPending}>
                <ScrollText />
                견적서 발행
              </Button>
              <Button onClick={() => docMut.mutate("statement")} disabled={docMut.isPending}>
                <FileText />
                거래명세서 발행
              </Button>
            </div>
            {order.documents.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {order.documents.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={d.docType === "quote" ? "/print/quote/$id" : "/print/statement/$id"}
                      params={{ id: String(d.id) }}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 text-accent hover:underline"
                    >
                      <Printer className="size-3.5" />
                      {d.docType === "quote" ? "견적서" : "거래명세서"} {d.docNo}
                      <span className="text-subtle"> · {formatDateTime(d.issuedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
            <h2 className="font-display text-base font-semibold">시안 추가</h2>
            <p className="mt-1 text-[13px] text-muted">
              문구가 다른 현수막은 장마다 시안을 따로 만듭니다. 예: 4장이면 시안 4칸.
            </p>
            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                draftMut.mutate();
              }}
            >
              <Label htmlFor="draft-title">시안 이름</Label>
              <Input
                id="draft-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder={`${order.drafts.length + 1}번 현수막`}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="draft-w">가로 cm</Label>
                  <Input
                    id="draft-w"
                    type="number"
                    min={0}
                    value={draftW}
                    onChange={(e) => setDraftW(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="draft-h">세로 cm</Label>
                  <Input
                    id="draft-h"
                    type="number"
                    min={0}
                    value={draftH}
                    onChange={(e) => setDraftH(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="h-9 rounded-full bg-elevated px-3 text-[12px] shadow-[var(--shadow-border)]"
                    onClick={() => {
                      setDraftW(String(p.w));
                      setDraftH(String(p.h));
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <Label htmlFor="draft-copy">이 장 문구</Label>
              <Textarea
                id="draft-copy"
                className="min-h-24"
                value={draftCopy}
                onChange={(e) => setDraftCopy(e.target.value)}
                placeholder="이 장에 들어갈 문구"
              />
              <Label htmlFor="draft-notes">메모</Label>
              <Textarea
                id="draft-notes"
                className="min-h-16"
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                placeholder="사이즈·재질, 고객 요청"
              />
              <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-elevated text-sm shadow-[var(--shadow-border)]">
                <ImagePlus className="size-4" />
                {draftImage ? "이미지 선택됨" : "시안 이미지 첨부"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setDraftImage(await fileToDataUrl(file));
                    } catch {
                      toast.error("이미지를 읽지 못했습니다.");
                    }
                  }}
                />
              </label>
              <Button type="submit" className="w-full" disabled={draftMut.isPending}>
                <Plus />
                시안 추가
              </Button>
            </form>
          </section>
        </div>

        <StaffThread
          messages={order.messages}
          staffName={staffName}
          pending={msgMut.isPending}
          onSend={(body) => msgMut.mutate(body)}
        />
      </div>
    </div>
  );
}

const SIZE_PRESETS = [
  { label: "700×50", w: 700, h: 50 },
  { label: "500×70", w: 500, h: 70 },
  { label: "500×90", w: 500, h: 90 },
  { label: "200×60", w: 200, h: 60 },
];

function sizeForDraft(draft: Draft, items: OrderItem[]): { widthCm: number; heightCm: number } {
  if (draft.widthCm > 0 && draft.heightCm > 0) {
    return { widthCm: draft.widthCm, heightCm: draft.heightCm };
  }
  const printable = items.filter((it) => {
    if (/감사패|기념패/.test(it.productName)) return false;
    return it.unit === "㎡" || it.widthCm >= 100;
  });
  const hit = printable[draft.version - 1] ?? printable[0] ?? items.find((i) => i.widthCm >= 100);
  return { widthCm: hit?.widthCm || 700, heightCm: hit?.heightCm || 50 };
}

function ItemRow({
  item,
  amount,
  busy,
  canDelete,
  onSave,
  onDelete,
}: {
  item: OrderItem;
  amount: number;
  busy: boolean;
  canDelete: boolean;
  onSave: (next: { widthCm: number; heightCm: number; qty: number; unitPrice: number }) => void;
  onDelete: () => void;
}) {
  const [w, setW] = useState(String(item.widthCm || ""));
  const [h, setH] = useState(String(item.heightCm || ""));
  const [qty, setQty] = useState(String(item.qty));
  const [price, setPrice] = useState(String(item.unitPrice));

  const qtyN = Math.max(1, Number(qty) || 1);
  const priceN = Math.max(0, Number(price) || 0);
  const shown = Math.round(priceN * qtyN);

  function commit() {
    onSave({
      widthCm: Number(w) || 0,
      heightCm: Number(h) || 0,
      qty: qtyN,
      unitPrice: priceN,
    });
  }

  return (
    <li className="py-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{item.productName}</p>
          <p className="text-[12px] text-muted">
            {inferColorMode(item.productName)}
            {item.memo ? ` · ${item.memo}` : ""}
            {" · 단가 × 수량"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className="tabular-nums">{won(shown)}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 text-stamp"
            disabled={!canDelete || busy}
            onClick={onDelete}
            aria-label={`${item.productName} 삭제`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <Label className="text-[11px]">가로</Label>
          <Input
            className="h-10 w-[4.5rem]"
            type="number"
            min={0}
            value={w}
            onChange={(e) => setW(e.target.value)}
            onBlur={commit}
          />
        </div>
        <span className="mb-2 text-muted">×</span>
        <div>
          <Label className="text-[11px]">세로</Label>
          <Input
            className="h-10 w-[4.5rem]"
            type="number"
            min={0}
            value={h}
            onChange={(e) => setH(e.target.value)}
            onBlur={commit}
          />
        </div>
        <div>
          <Label className="text-[11px]">수량</Label>
          <Input
            className="h-10 w-[4.2rem]"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={commit}
          />
        </div>
        <div>
          <Label className="text-[11px]">단가</Label>
          <Input
            className="h-10 w-[6.5rem]"
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commit}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {SIZE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="h-9 rounded-full bg-elevated px-2.5 text-[11px] shadow-[var(--shadow-border)]"
              onClick={() => {
                setW(String(p.w));
                setH(String(p.h));
                onSave({ widthCm: p.w, heightCm: p.h, qty: qtyN, unitPrice: priceN });
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {item.copy ? (
        <pre className="mt-2 whitespace-pre-wrap font-display text-[13px] leading-relaxed">{item.copy}</pre>
      ) : null}
    </li>
  );
}

function DraftCard({
  draft,
  items,
  fallbackCopy,
  saving,
  onSave,
  onStatus,
  onDelete,
}: {
  draft: Draft;
  items: OrderItem[];
  fallbackCopy: string;
  saving: boolean;
  onSave: (next: {
    title: string;
    manuscript: string;
    notes: string;
    imageData?: string | null;
    widthCm?: number;
    heightCm?: number;
  }) => void;
  onStatus: (status: DraftStatus) => void;
  onDelete: () => void;
}) {
  const guessed = sizeForDraft(draft, items);
  const [title, setTitle] = useState(draft.title);
  const [copy, setCopy] = useState(draft.manuscript);
  const [notes, setNotes] = useState(draft.notes);
  const [image, setImage] = useState<string | null>(draft.imageData);
  const [w, setW] = useState(String(guessed.widthCm));
  const [h, setH] = useState(String(guessed.heightCm));
  const widthCm = Number(w) || guessed.widthCm;
  const heightCm = Number(h) || guessed.heightCm;
  const previewCopy = copy.trim() || fallbackCopy;
  const copyRows = Math.max(4, (copy || previewCopy).split("\n").length + 1);

  function payload(extra?: { imageData?: string | null }) {
    return {
      title: title.trim() || draft.title,
      manuscript: copy,
      notes,
      widthCm,
      heightCm,
      ...extra,
    };
  }

  async function attachFile(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      setImage(dataUrl);
      onSave(payload({ imageData: dataUrl }));
    } catch {
      toast.error("이미지를 읽지 못했습니다.");
    }
  }

  return (
    <div className="rounded-[var(--radius-md)] bg-elevated p-3 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-subtle">{draft.version}번</p>
        <div className="flex items-center gap-1">
          <NativeSelect
            className="h-10 w-32 text-[13px]"
            value={draft.status}
            onChange={(e) => onStatus(e.target.value as DraftStatus)}
          >
            {DRAFT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DRAFT_STATUS_META[s]}
              </option>
            ))}
          </NativeSelect>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 text-stamp"
            onClick={onDelete}
            aria-label={`${draft.version}번 삭제`}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <Input
        className="mt-2"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="시안 이름"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px]">가로 cm</Label>
          <Input
            className="h-10"
            type="number"
            min={0}
            value={w}
            onChange={(e) => setW(e.target.value)}
            onBlur={() => onSave(payload())}
          />
        </div>
        <div>
          <Label className="text-[11px]">세로 cm</Label>
          <Input
            className="h-10"
            type="number"
            min={0}
            value={h}
            onChange={(e) => setH(e.target.value)}
            onBlur={() => onSave(payload())}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SIZE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="h-9 rounded-full bg-surface px-2.5 text-[11px] shadow-[var(--shadow-border)]"
            onClick={() => {
              setW(String(p.w));
              setH(String(p.h));
              onSave({ ...payload(), widthCm: p.w, heightCm: p.h });
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {image ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] text-muted">
            제작 시안 · {widthCm}×{heightCm}cm
          </p>
          <img
            src={image}
            alt={title || draft.title}
            className="max-h-64 w-full rounded-[var(--radius-sm)] bg-bg object-contain outline outline-1 -outline-offset-1 outline-fg/10"
          />
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] text-muted">
            예시 시안 · {widthCm}×{heightCm}cm
          </p>
          <BannerPreview
            manuscript={previewCopy}
            widthCm={widthCm}
            heightCm={heightCm}
            bgColor={draft.bgColor}
            textColor={draft.textColor}
            compact
          />
        </div>
      )}
      <label className="mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-surface text-sm shadow-[var(--shadow-border)]">
        <ImagePlus className="size-4" />
        {image ? "제작 시안 바꾸기" : "제작 시안 올리기"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void attachFile(file);
          }}
        />
      </label>
      <Label htmlFor={`copy-${draft.id}`} className="mt-3 block">
        문구
      </Label>
      <Textarea
        id={`copy-${draft.id}`}
        className="mt-1 resize-y overflow-auto"
        rows={copyRows}
        value={copy}
        onChange={(e) => setCopy(e.target.value)}
        placeholder="이 장에 들어갈 문구"
      />
      <Textarea
        className="mt-2 min-h-14 resize-y"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="수량 · 메모"
      />
      <Button
        type="button"
        variant="secondary"
        className="mt-2 w-full"
        disabled={saving}
        onClick={() => onSave(payload())}
      >
        이 시안 저장
      </Button>
      <p className="mt-2 text-[12px] text-subtle">
        {draft.createdBy} · {formatDateTime(draft.createdAt)}
      </p>
    </div>
  );
}
