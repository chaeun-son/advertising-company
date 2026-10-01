import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, deleteClient, listClients, updateClient } from "@/lib/server/api";
import { formatDate } from "@/lib/format";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
});

type Draft = {
  id?: number;
  name: string;
  contact: string;
  phone: string;
  memo: string;
  bizNo: string;
  address: string;
  email: string;
  bizType: string;
  bizItem: string;
};

const empty: Draft = {
  name: "",
  contact: "",
  phone: "",
  memo: "",
  bizNo: "",
  address: "",
  email: "",
  bizType: "",
  bizItem: "",
};

function ClientsPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["clients"], queryFn: () => listClients() });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);

  const save = useMutation({
    mutationFn: async () => {
      if (draft.id) {
        await updateClient({
          data: {
            id: draft.id,
            name: draft.name,
            contact: draft.contact,
            phone: draft.phone,
            memo: draft.memo,
            bizNo: draft.bizNo,
            address: draft.address,
            email: draft.email,
            bizType: draft.bizType,
            bizItem: draft.bizItem,
          },
        });
      } else {
        await createClient({
          data: {
            name: draft.name,
            contact: draft.contact,
            phone: draft.phone,
            memo: draft.memo,
            bizNo: draft.bizNo,
            address: draft.address,
            email: draft.email,
            bizType: draft.bizType,
            bizItem: draft.bizItem,
          },
        });
      }
    },
    onSuccess: async () => {
      setOpen(false);
      setDraft(empty);
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      toast.success("거래처를 저장했습니다.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "저장 실패"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteClient({ data: { id } }),
    onSuccess: async (res) => {
      setOpen(false);
      setDraft(empty);
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(
        res.orderCount > 0
          ? `${res.name}과 주문 ${res.orderCount}건을 삭제했습니다.`
          : `${res.name}을 삭제했습니다.`,
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "삭제 실패"),
  });

  function confirmRemove(id: number, name: string, orderCount: number) {
    const extra = orderCount > 0 ? ` 주문 ${orderCount}건도 함께 지워집니다.` : "";
    if (!window.confirm(`${name} 거래처를 삭제할까요?${extra}`)) return;
    remove.mutate(id);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">상호만 적어도 됩니다</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">거래처</h1>
        </div>
        <Button
          onClick={() => {
            setDraft(empty);
            setOpen(true);
          }}
        >
          추가
        </Button>
      </header>

      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        {isPending ? (
          <p className="p-6 text-sm text-muted">불러오는 중…</p>
        ) : !data?.length ? (
          <p className="p-8 text-center text-sm text-muted">거래처가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((c) => (
              <li key={c.id} className="flex items-stretch">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3 text-left hover:bg-elevated/80 sm:flex-row sm:items-center sm:justify-between"
                  onClick={() => {
                    setDraft({
                      id: c.id,
                      name: c.name,
                      contact: c.contact,
                      phone: c.phone,
                      memo: c.memo,
                      bizNo: c.bizNo,
                      address: c.address,
                      email: c.email,
                      bizType: c.bizType,
                      bizItem: c.bizItem,
                    });
                    setOpen(true);
                  }}
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-[13px] text-muted">
                      {c.contact || "담당 미기재"}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </p>
                  </div>
                  <p className="text-[12px] text-subtle">
                    주문 {c.orderCount}건
                    {c.lastOrder ? ` · 최근 ${formatDate(c.lastOrder)}` : ""}
                  </p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="m-1.5 size-10 shrink-0 text-stamp"
                  aria-label={`${c.name} 삭제`}
                  disabled={remove.isPending}
                  onClick={() => confirmRemove(c.id, c.name, c.orderCount)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={draft.id ? "거래처 수정" : "거래처 추가"}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div>
              <Label htmlFor="c-name">상호</Label>
              <Input
                id="c-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="c-contact">담당</Label>
              <Input
                id="c-contact"
                value={draft.contact}
                onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="c-phone">전화</Label>
              <Input
                id="c-phone"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="c-biz">사업자번호</Label>
              <Input
                id="c-biz"
                value={draft.bizNo}
                onChange={(e) => setDraft((d) => ({ ...d, bizNo: e.target.value }))}
                placeholder="000-00-00000"
              />
            </div>
            <div>
              <Label htmlFor="c-addr">주소</Label>
              <Input
                id="c-addr"
                value={draft.address}
                onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="c-email">이메일</Label>
              <Input
                id="c-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="c-type">업태</Label>
                <Input
                  id="c-type"
                  value={draft.bizType}
                  onChange={(e) => setDraft((d) => ({ ...d, bizType: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="c-item">종목</Label>
                <Input
                  id="c-item"
                  value={draft.bizItem}
                  onChange={(e) => setDraft((d) => ({ ...d, bizItem: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="c-memo">메모</Label>
              <Textarea
                id="c-memo"
                className="min-h-20"
                value={draft.memo}
                onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              {draft.id ? (
                <Button
                  type="button"
                  variant="danger"
                  className="flex-1"
                  disabled={remove.isPending || save.isPending}
                  onClick={() => {
                    const row = data?.find((c) => c.id === draft.id);
                    confirmRemove(draft.id!, draft.name, row?.orderCount ?? 0);
                  }}
                >
                  삭제
                </Button>
              ) : null}
              <Button type="submit" className="flex-1" disabled={save.isPending}>
                저장
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
