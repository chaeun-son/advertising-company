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
  const [query, setQuery] = useState("");
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
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-[#aa7b41]">CLIENT RELATIONSHIP</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">거래처 관리</h1>
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

      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="거래처명, 담당자, 연락처, 이메일 검색" className="max-w-md border-[#ddd7cf] bg-white" />

      <div className="overflow-x-auto rounded-2xl bg-[#fffdf9] shadow-[0_0_0_1px_rgba(48,38,33,0.06)]">
        {isPending ? (
          <p className="p-6 text-sm text-[#756a62]">불러오는 중…</p>
        ) : !data?.length ? (
          <p className="p-8 text-center text-sm text-[#756a62]">거래처가 없습니다.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[12px] text-[#756a62]">
              <tr>
                <th className="px-4 py-3 font-medium">거래처명</th>
                <th className="py-3 font-medium">담당자</th>
                <th className="py-3 font-medium">연락처</th>
                <th className="py-3 font-medium">이메일</th>
                <th className="py-3 font-medium">주문</th>
                <th className="py-3 pr-4 font-medium">최근</th>
              </tr>
            </thead>
            <tbody>
              {data.filter((client) => `${client.name} ${client.contact} ${client.phone} ${client.email} ${client.bizNo}`.toLowerCase().includes(query.toLowerCase())).map((client) => (
                <tr key={client.id} className="border-t border-[#eee6de]">
                  <td className="px-4 py-3">
                    <button type="button" className="text-left font-semibold" onClick={() => {
                      setDraft({ id: client.id, name: client.name, contact: client.contact, phone: client.phone, memo: client.memo, bizNo: client.bizNo, address: client.address, email: client.email, bizType: client.bizType, bizItem: client.bizItem });
                      setOpen(true);
                    }}>{client.name}</button>
                    <p className="text-[12px] text-[#9a9088]">{client.bizNo || "사업자번호 없음"}</p>
                  </td>
                  <td>{client.contact || "—"}</td>
                  <td>{client.phone || "—"}</td>
                  <td className="text-[#756a62]">{client.email || "—"}</td>
                  <td>{client.orderCount}건</td>
                  <td className="pr-4 text-[#756a62]">{client.lastOrder ? formatDate(client.lastOrder) : "없음"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
