import { useMemo, useState } from "react";
import { BannerPreview } from "@/components/banner-preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/server/api";
import { BANNER_FINISHING, DELIVERIES, PAYMENTS, type Payment } from "@/lib/catalog";
import { chargedUnitPrice, isLotPrice, lineAmount, packOrderNotes, unpackOrderNotes, vatBreakdown, won } from "@/lib/pricing";
import type { Client, CompanyProfile, Product, Staff } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

export type FormItem = {
  key: string;
  productId: number;
  widthCm: number;
  heightCm: number;
  qty: number;
  memo: string;
  copy: string;
  unitPrice: number | null;
};

export type OrderFormValue = {
  clientId: number;
  title: string;
  dueDate: string | null;
  rush: boolean;
  assignee: string;
  manuscript: string;
  notes: string;
  bgColor: string;
  textColor: string;
  payment: Payment;
  delivery: string;
  items: FormItem[];
};

const PRESETS = [
  { label: "500×90", w: 500, h: 90 },
  { label: "600×90", w: 600, h: 90 },
  { label: "900×90", w: 900, h: 90 },
  { label: "1000×90", w: 1000, h: 90 },
  { label: "X배너 60×180", w: 60, h: 180 },
];

function newItem(products: Product[], hint?: Partial<FormItem>): FormItem {
  const p =
    (hint?.productId ? products.find((x) => x.id === hint.productId) : undefined) ?? products[0];
  const bannerish = Boolean(p?.category === "현수막" || p?.name.includes("현수막"));
  const plaque = Boolean(p?.category === "감사패" || p?.name.includes("감사패") || p?.name.includes("기념패"));
  return {
    key: crypto.randomUUID(),
    productId: p?.id ?? 1,
    widthCm: hint?.widthCm ?? (bannerish ? 500 : plaque ? 17 : p?.name.includes("X배너") ? 60 : 0),
    heightCm: hint?.heightCm ?? (bannerish ? 90 : plaque ? 18 : p?.name.includes("X배너") ? 180 : 0),
    qty: hint?.qty ?? 1,
    memo: hint?.memo ?? "",
    copy: hint?.copy ?? "",
    unitPrice: hint?.unitPrice ?? null,
  };
}

function productKind(p?: Product): "banner" | "plaque" | "other" {
  if (!p) return "other";
  if (p.category === "감사패" || p.name.includes("감사패") || p.name.includes("기념패")) return "plaque";
  if (p.category === "현수막" || (p.name.includes("현수막") && !p.name.includes("X배너"))) return "banner";
  return "other";
}

function autoTitle(items: FormItem[], products: Product[]): string {
  const map = new Map<string, number>();
  for (const item of items) {
    const p = products.find((x) => x.id === item.productId);
    const label =
      p?.category === "현수막" || (p?.name.includes("현수막") && !p.name.includes("X배너"))
        ? "현수막"
        : (p?.name ?? "품목");
    map.set(label, (map.get(label) ?? 0) + item.qty);
  }
  return [...map.entries()]
    .filter(([, n]) => n > 0)
    .map(([name, n]) => `${name} ${n}`)
    .join(" · ");
}

function groupProducts(products: Product[]) {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const cat = p.category || "기타";
    const list = map.get(cat) ?? [];
    list.push(p);
    map.set(cat, list);
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }));
}

export function OrderForm({
  products,
  clients: initialClients,
  staff,
  company,
  initial,
  submitLabel,
  pending,
  onSubmit,
}: {
  products: Product[];
  clients: Client[];
  staff: Staff[];
  company: CompanyProfile;
  initial?: Partial<OrderFormValue>;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (value: OrderFormValue) => void;
}) {
  const [clients, setClients] = useState(initialClients);
  const [clientOpen, setClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", contact: "", phone: "" });
  const unpacked = unpackOrderNotes(initial?.notes ?? "");
  const [value, setValue] = useState<OrderFormValue>({
    clientId: initial?.clientId ?? initialClients[0]?.id ?? 0,
    title: initial?.title ?? "",
    dueDate: initial?.dueDate ?? "",
    rush: initial?.rush ?? false,
    assignee:
      initial?.assignee && staff.some((s) => s.name === initial.assignee)
        ? initial.assignee
        : (staff[0]?.name ?? ""),
    manuscript: initial?.manuscript ?? "",
    notes: unpacked.notes,
    bgColor: initial?.bgColor ?? "#1c150e",
    textColor: initial?.textColor ?? "#fff6e8",
    payment: initial?.payment ?? unpacked.payment,
    delivery: initial?.delivery ?? unpacked.delivery,
    items: initial?.items?.length
      ? initial.items.map((it) => ({ ...it, copy: it.copy ?? "", unitPrice: it.unitPrice ?? null }))
      : [newItem(products)],
  });

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const supply = value.items.reduce((sum, item) => {
    const p = productById.get(item.productId);
    if (!p) return sum;
    const unitPrice = chargedUnitPrice(p.unitPrice, item.unitPrice, value.rush, company.rushRate);
    return (
      sum +
      lineAmount({
        widthCm: item.widthCm,
        heightCm: item.heightCm,
        qty: item.qty,
        unitPrice,
        unit: p.unit,
        name: p.name,
      })
    );
  }, 0);
  const tax = vatBreakdown(supply, company.vatIncluded);
  const primary = value.items.find((i) => i.widthCm > 0 && i.heightCm > 0) ?? value.items[0];

  function patch(partial: Partial<OrderFormValue>) {
    setValue((v) => ({ ...v, ...partial }));
  }

  function patchItem(key: string, partial: Partial<FormItem>) {
    setValue((v) => ({
      ...v,
      items: v.items.map((it) => (it.key === key ? { ...it, ...partial } : it)),
    }));
  }

  function fillKind(kind: "banner" | "plaque", count: number) {
    const target =
      kind === "plaque"
        ? products.find((p) => p.name === "기념패") ?? products.find((p) => p.category === "감사패")
        : products.find((p) => p.name.includes("최소")) ?? products.find((p) => p.category === "현수막");
    if (!target) return;
    setValue((v) => {
      const kept = v.items.filter((it) => productKind(productById.get(it.productId)) !== kind);
      const added = Array.from({ length: count }, () =>
        newItem(products, {
          productId: target.id,
          widthCm: kind === "plaque" ? 17 : 500,
          heightCm: kind === "plaque" ? 18 : 90,
          qty: 1,
          copy: "",
          memo: "",
        }),
      );
      const items = [...kept, ...added];
      const nextTitle =
        !v.title.trim() || v.title === autoTitle(v.items, products) ? autoTitle(items, products) : v.title;
      return { ...v, items, title: nextTitle };
    });
  }

  async function handleAddClient() {
    if (!newClient.name.trim()) return;
    const created = await createClient({ data: newClient });
    const next: Client = {
      id: created.id,
      name: newClient.name,
      contact: newClient.contact,
      phone: newClient.phone,
      memo: "",
      createdAt: new Date().toISOString(),
      bizNo: "",
      address: "",
      email: "",
      bizType: "",
      bizItem: "",
    };
    setClients((list) => [...list, next].sort((a, b) => a.name.localeCompare(b.name, "ko")));
    patch({ clientId: created.id });
    setNewClient({ name: "", contact: "", phone: "" });
    setClientOpen(false);
  }

  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      onSubmit={(e) => {
        e.preventDefault();
        const copies = value.items.map((it) => it.copy.trim()).filter(Boolean);
        onSubmit({
          ...value,
          title: value.title.trim() || autoTitle(value.items, products),
          dueDate: value.dueDate ? value.dueDate : null,
          notes: packOrderNotes(value.payment, value.delivery, value.notes),
          manuscript: value.manuscript.trim() || copies.join("\n\n"),
        });
      }}
    >
      <div className="space-y-5">
        <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="font-display text-base font-semibold">주문</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="client">거래처</Label>
              <div className="flex gap-2">
                <NativeSelect
                  id="client"
                  value={value.clientId}
                  onChange={(e) => patch({ clientId: Number(e.target.value) })}
                  required
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
                <Dialog open={clientOpen} onOpenChange={setClientOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="secondary" className="shrink-0">
                      추가
                    </Button>
                  </DialogTrigger>
                  <DialogContent title="거래처 추가">
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="nc-name">상호</Label>
                        <Input
                          id="nc-name"
                          value={newClient.name}
                          onChange={(e) => setNewClient((s) => ({ ...s, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="nc-contact">담당</Label>
                        <Input
                          id="nc-contact"
                          value={newClient.contact}
                          onChange={(e) => setNewClient((s) => ({ ...s, contact: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="nc-phone">전화</Label>
                        <Input
                          id="nc-phone"
                          value={newClient.phone}
                          onChange={(e) => setNewClient((s) => ({ ...s, phone: e.target.value }))}
                        />
                      </div>
                      <Button type="button" className="w-full" onClick={() => void handleAddClient()}>
                        저장
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="title">작업명</Label>
              <Input
                id="title"
                value={value.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="예: 개업 축하 현수막"
                required
              />
            </div>
            <div>
              <Label htmlFor="due">납기</Label>
              <Input
                id="due"
                type="date"
                value={value.dueDate ?? ""}
                onChange={(e) => patch({ dueDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="assignee">담당</Label>
              <NativeSelect
                id="assignee"
                value={value.assignee}
                onChange={(e) => patch({ assignee: e.target.value })}
              >
                <option value="">미지정</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} · {s.role}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <label className="flex h-11 items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={value.rush}
                onChange={(e) => patch({ rush: e.target.checked })}
                className="size-4 accent-primary"
              />
              급행 (단가 × {company.rushRate})
            </label>
            <div>
              <Label htmlFor="pay">결제</Label>
              <NativeSelect
                id="pay"
                value={value.payment}
                onChange={(e) => patch({ payment: e.target.value as Payment })}
              >
                {PAYMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="del">납품방식</Label>
              <NativeSelect
                id="del"
                value={value.delivery}
                onChange={(e) => patch({ delivery: e.target.value })}
              >
                <option value="">미정</option>
                {DELIVERIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <h2 className="font-display text-base font-semibold">원고</h2>
          <p className="mt-1 text-[13px] text-muted">
            현수막·패 문구가 장마다 다르면 아래 품목 칸에 적습니다. 공통 메모만 여기 적어도 됩니다.
          </p>
          <Textarea
            className="mt-3 min-h-36 font-display"
            value={value.manuscript}
            onChange={(e) => patch({ manuscript: e.target.value })}
            placeholder={"덕진지점 이벤트 현수막\n보일 할 10만원 이상"}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bg">바탕색</Label>
              <Input
                id="bg"
                type="color"
                value={value.bgColor}
                onChange={(e) => patch({ bgColor: e.target.value })}
                className="h-11 p-1"
              />
            </div>
            <div>
              <Label htmlFor="fg">글자색</Label>
              <Input
                id="fg"
                type="color"
                value={value.textColor}
                onChange={(e) => patch({ textColor: e.target.value })}
                className="h-11 p-1"
              />
            </div>
          </div>
          <div className="mt-3">
            <Label htmlFor="notes">내부 메모</Label>
            <Textarea
              id="notes"
              className="min-h-20"
              value={value.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="고객 요청, 설치 위치, 로고 파일 등"
            />
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold">품목 · 규격</h2>
              <p className="mt-1 text-[13px] text-muted">
                한곳에서 기념패 4개·현수막 4장이 오면 아래 버튼으로 칸을 만듭니다. 장마다 문구를 적습니다.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => patch({ items: [...value.items, newItem(products)] })}
            >
              <Plus />
              줄 추가
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="h-9 rounded-full bg-primary px-3 text-[12px] font-medium text-primary-fg"
              onClick={() => fillKind("plaque", 4)}
            >
              기념패 4개
            </button>
            <button
              type="button"
              className="h-9 rounded-full bg-primary px-3 text-[12px] font-medium text-primary-fg"
              onClick={() => fillKind("banner", 4)}
            >
              현수막 4장
            </button>
            {[2, 3, 5, 6].map((n) => (
              <button
                key={`p${n}`}
                type="button"
                className="h-9 rounded-full bg-elevated px-3 text-[12px] text-muted shadow-[var(--shadow-border)] hover:text-fg"
                onClick={() => fillKind("plaque", n)}
              >
                패 {n}개
              </button>
            ))}
            {[2, 3, 5, 6].map((n) => (
              <button
                key={`b${n}`}
                type="button"
                className="h-9 rounded-full bg-elevated px-3 text-[12px] text-muted shadow-[var(--shadow-border)] hover:text-fg"
                onClick={() => fillKind("banner", n)}
              >
                현수막 {n}장
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="h-9 rounded-full bg-elevated px-3 text-[12px] text-muted shadow-[var(--shadow-border)] hover:text-fg"
                onClick={() => {
                  const first = value.items.find((it) => productKind(productById.get(it.productId)) === "banner");
                  if (first) patchItem(first.key, { widthCm: p.w, heightCm: p.h });
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted">가로·세로는 규격만 적습니다. 금액은 단가 × 수량입니다. 단가를 직접 고치면 그 금액만 씁니다.</p>
          <div className="mt-2 space-y-3">
            {value.items.map((item, index) => {
              const p = productById.get(item.productId);
              const kind = productKind(p);
              const sized =
                p?.unit === "㎡" ||
                p?.unit === "자" ||
                kind === "banner" ||
                kind === "plaque" ||
                Boolean(p?.name.includes("X배너"));
              const lot = p ? isLotPrice(p.minQty, p.unit) : false;
              const banner = kind === "banner";
              const same = value.items.filter((it) => productKind(productById.get(it.productId)) === kind);
              const nth = same.findIndex((it) => it.key === item.key) + 1;
              const slot =
                kind === "plaque" ? `패 ${nth}/${same.length}` : kind === "banner" ? `현수막 ${nth}/${same.length}` : `${index + 1}번째`;
              return (
                <div
                  key={item.key}
                  className="rounded-[var(--radius-md)] bg-elevated p-3 shadow-[var(--shadow-border)]"
                >
                  <p className="mb-2 text-[12px] font-medium text-accent">{slot}</p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_repeat(3,4.6rem)_6.5rem_auto]">
                    <NativeSelect
                      value={item.productId}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        const next = productById.get(id);
                        const nextKind = productKind(next);
                        const nextLot = next ? isLotPrice(next.minQty, next.unit) : false;
                        patchItem(item.key, {
                          productId: id,
                          widthCm:
                            nextKind === "banner"
                              ? item.widthCm || 500
                              : nextKind === "plaque"
                                ? 17
                                : next?.name.includes("X배너")
                                  ? 60
                                  : 0,
                          heightCm:
                            nextKind === "banner"
                              ? item.heightCm || 90
                              : nextKind === "plaque"
                                ? 18
                                : next?.name.includes("X배너")
                                  ? 180
                                  : 0,
                          qty: nextLot ? 1 : item.qty,
                          unitPrice: null,
                        });
                      }}
                    >
                      {groupProducts(products).map((group) => (
                        <optgroup key={group.category} label={group.category}>
                          {group.items.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name} ({prod.unitPrice.toLocaleString("ko-KR")}원
                              {isLotPrice(prod.minQty, prod.unit)
                                ? `/건 · ${prod.minQty}매`
                                : `/${prod.unit}`}
                              )
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </NativeSelect>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={item.widthCm}
                      disabled={!sized}
                      onChange={(e) => patchItem(item.key, { widthCm: Number(e.target.value) })}
                      aria-label="가로 cm"
                      placeholder="가로"
                    />
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={item.heightCm}
                      disabled={!sized}
                      onChange={(e) => patchItem(item.key, { heightCm: Number(e.target.value) })}
                      aria-label="세로 cm"
                      placeholder="세로"
                    />
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={item.qty}
                      onChange={(e) => patchItem(item.key, { qty: Number(e.target.value) })}
                      aria-label={lot ? "건수" : "수량"}
                      title={lot ? "건수" : "수량"}
                    />
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={
                        p
                          ? chargedUnitPrice(p.unitPrice, item.unitPrice, value.rush, company.rushRate)
                          : 0
                      }
                      onChange={(e) =>
                        patchItem(item.key, {
                          unitPrice: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      aria-label="단가"
                      title="단가 — 필요할 때만 고치면 됩니다"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      disabled={value.items.length === 1}
                      onClick={() =>
                        patch({ items: value.items.filter((it) => it.key !== item.key) })
                      }
                      aria-label="줄 삭제"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {lot && p ? (
                    <p className="mt-2 text-[12px] text-muted">
                      건수입니다. 최소 {p.minQty.toLocaleString("ko-KR")}매가 1건 · 1명 400매도 1건.
                    </p>
                  ) : null}
                  {banner ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {BANNER_FINISHING.map((f) => {
                        const on = item.memo.includes(f);
                        return (
                          <button
                            key={f}
                            type="button"
                            className={`h-8 rounded-full px-2.5 text-[12px] ${
                              on
                                ? "bg-primary text-primary-fg"
                                : "bg-surface text-muted shadow-[var(--shadow-border)]"
                            }`}
                            onClick={() => {
                              const parts = item.memo
                                .split(" · ")
                                .map((s) => s.trim())
                                .filter(Boolean);
                              const next = on
                              ? parts.filter((part) => part !== f)
                              : [
                                  ...parts.filter(
                                    (part) =>
                                      !(BANNER_FINISHING as readonly string[]).includes(part),
                                  ),
                                  f,
                                ];
                              patchItem(item.key, { memo: next.join(" · ") });
                            }}
                          >
                            {f}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <Textarea
                    className="mt-2 min-h-20"
                    value={item.copy}
                    onChange={(e) => patchItem(item.key, { copy: e.target.value })}
                    placeholder={
                      kind === "plaque"
                        ? "이 패 각인 문구 (성함·감사문·날짜)"
                        : "이 장 문구 (현수막 글)"
                    }
                  />
                  <Input
                    className="mt-2 h-10"
                    value={item.memo}
                    onChange={(e) => patchItem(item.key, { memo: e.target.value })}
                    placeholder="후가공 · 기타 (게시대 위치, 고리 위치 등)"
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-base font-semibold">접수 미리보기</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {value.items.map((item) => {
              const p = productById.get(item.productId);
              return (
                <li key={item.key} className="rounded-[var(--radius-sm)] bg-elevated px-2.5 py-2 shadow-[var(--shadow-border)]">
                  <p className="font-medium">{p?.name ?? "품목"}</p>
                  {item.copy ? (
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{item.copy}</p>
                  ) : (
                    <p className="mt-0.5 text-[12px] text-subtle">문구 없음</p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <BannerPreview
              manuscript={value.items.find((i) => i.copy.trim())?.copy || value.manuscript}
              widthCm={primary?.widthCm || 600}
              heightCm={primary?.heightCm || 90}
              bgColor={value.bgColor}
              textColor={value.textColor}
              compact
            />
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] bg-primary p-4 text-primary-fg shadow-[var(--shadow-border)]">
          <p className="text-[12px] tracking-wide text-primary-fg/70">공급가액</p>
          <p className="font-display text-2xl tabular-nums">{won(tax.supply)}</p>
          <div className="mt-3 space-y-1 text-sm text-primary-fg/80">
            <div className="flex justify-between">
              <span>부가세</span>
              <span className="tabular-nums">{won(tax.vat)}</span>
            </div>
            <div className="flex justify-between font-medium text-primary-fg">
              <span>합계</span>
              <span className="tabular-nums">{won(tax.total)}</span>
            </div>
          </div>
          <Button type="submit" variant="secondary" className="mt-4 w-full" disabled={pending}>
            {pending ? "저장 중…" : submitLabel}
          </Button>
        </div>
      </aside>
    </form>
  );
}
