import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { getDashboard, listOrderMonths, listOrders } from "@/lib/server/api";
import { dueLabel, formatYearMonth, mergeOrderMonths, monthFromOrderNo, seoulMonth } from "@/lib/format";
import { won } from "@/lib/pricing";
import { ORDER_STATUSES, STATUS_META } from "@/lib/types";

export const Route = createFileRoute("/_app/orders/")({
  component: OrdersPage,
});

function OrdersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState(seoulMonth());
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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">달은 바꿔 봐도 자료는 지워지지 않습니다</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">주문</h1>
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

      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-surface shadow-[var(--shadow-border)]">
        {isPending ? (
          <p className="p-6 text-sm text-muted">불러오는 중…</p>
        ) : !data?.length ? (
          <p className="p-8 text-center text-sm text-muted">주문이 없습니다. 새 주문으로 접수하세요.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((order) => (
              <li key={order.id}>
                <Link
                  to="/orders/$id"
                  params={{ id: String(order.id) }}
                  className="flex flex-col gap-2 px-4 py-3 hover:bg-elevated/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] tabular-nums text-subtle">{order.orderNo}</span>
                      {order.rush ? <span className="text-[11px] font-medium text-stamp">급행</span> : null}
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 truncate font-medium">{order.title}</p>
                    <p className="text-[13px] text-muted">{order.clientName}</p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-6 text-sm sm:flex-col sm:items-end sm:text-right">
                    <span className="tabular-nums">{won(order.supplyAmount)}</span>
                    <span className="text-[12px] text-subtle">{dueLabel(order.dueDate)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
