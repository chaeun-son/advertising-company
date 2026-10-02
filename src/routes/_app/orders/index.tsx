import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input, NativeSelect } from "@/components/ui/input";
import { getDashboard, listOrderMonths, listOrders, updateOrderStatus } from "@/lib/server/api";
import { dueLabel, formatYearMonth, mergeOrderMonths, monthFromOrderNo, seoulMonth } from "@/lib/format";
import { won } from "@/lib/pricing";
import { useStaffSession } from "@/lib/staff-session";
import { ORDER_STATUSES, STATUS_META, type OrderStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/orders/")({
  component: OrdersPage,
});

function OrdersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState(seoulMonth());
  const queryClient = useQueryClient();
  const staffName = useStaffSession((s) => s.name);
  const { data, isPending } = useQuery({
    queryKey: ["orders", q, status, month],
    queryFn: () => listOrders({ data: { q, status, month } }),
  });
  const monthsQ = useQuery({ queryKey: ["order-months"], queryFn: () => listOrderMonths() });
  const boardQ = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const months = useMemo(
    () =>
      mergeOrderMonths([
        monthsQ.data?.months ?? [],
        boardQ.data?.months ?? [],
        (boardQ.data?.orders ?? []).flatMap((order) => [
          seoulMonth(order.createdAt),
          monthFromOrderNo(order.orderNo) ?? "",
        ]),
      ]),
    [monthsQ.data, boardQ.data],
  );

  const move = useMutation({
    mutationFn: (input: { id: number; status: OrderStatus }) =>
      updateOrderStatus({ data: { id: input.id, status: input.status, staffName: staffName || "직원" } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("주문 상태를 바꿨습니다.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "상태를 바꾸지 못했습니다."),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-[#aa7b41]">ORDER OPERATIONS</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">주문관리</h1>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="상호, 작업명, 원고, 주문번호"
          className="sm:max-w-sm"
        />
        <NativeSelect
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="sm:w-44"
          aria-label="월"
        >
          <option value="all">모든 달</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {formatYearMonth(m)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="sm:w-40"
          aria-label="상태"
        >
          <option value="all">전체 상태</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-[#fffdf9] shadow-[0_0_0_1px_rgba(48,38,33,0.06)]">
        {isPending ? (
          <p className="p-6 text-sm text-[#756a62]">불러오는 중…</p>
        ) : !data?.length ? (
          <p className="p-8 text-center text-sm text-[#756a62]">주문이 없습니다. 새 주문으로 접수하세요.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[12px] text-[#756a62]">
              <tr>
                <th className="px-4 py-3 font-medium">주문번호</th>
                <th className="py-3 font-medium">고객명</th>
                <th className="py-3 font-medium">작업</th>
                <th className="py-3 font-medium">금액</th>
                <th className="py-3 font-medium">납기</th>
                <th className="py-3 pr-4 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {data.map((order) => (
                <tr key={order.id} className="border-t border-[#eee6de]">
                  <td className="px-4 py-3"><Link to="/orders/$id" params={{ id: String(order.id) }} className="font-semibold">{order.orderNo}</Link>{order.rush ? <span className="ml-2 text-[11px] font-bold text-[#c4452d]">급행</span> : null}</td>
                  <td className="py-3"><span className="font-medium">{order.clientName}</span></td>
                  <td className="max-w-[16rem] truncate py-3">{order.title}</td>
                  <td className="py-3 tabular-nums">{won(order.supplyAmount)}</td>
                  <td className="py-3 text-[#756a62]">{dueLabel(order.dueDate)}</td>
                  <td className="py-3 pr-4">
                    <NativeSelect aria-label={`${order.orderNo} 상태`} value={order.status} className="h-9 border-[#ddd7cf] bg-white" onChange={(event) => move.mutate({ id: order.id, status: event.target.value as OrderStatus })}>
                      {ORDER_STATUSES.map((item) => <option key={item} value={item}>{STATUS_META[item].label}</option>)}
                    </NativeSelect>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
