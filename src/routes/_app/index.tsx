import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BannerPreview } from "@/components/banner-preview";
import { StatusBadge } from "@/components/status-badge";
import { NativeSelect } from "@/components/ui/input";
import { getDashboard, listOrderMonths } from "@/lib/server/api";
import { dueLabel, formatClock, formatYearMonth, mergeOrderMonths, seoulMonth } from "@/lib/format";
import { won } from "@/lib/pricing";
import { PIPELINE, STATUS_META, type Order, type OrderStatus } from "@/lib/types";
import { PRODUCT_TAGLINE } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const [month, setMonth] = useState(seoulMonth());
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
  });
  const monthsQ = useQuery({ queryKey: ["order-months"], queryFn: () => listOrderMonths() });
  const current = seoulMonth();

  const visible = useMemo(() => {
    if (!data) return [];
    if (month === "all") return data.orders;
    return data.orders.filter((o) => {
      const inMonth = seoulMonth(o.createdAt) === month;
      if (month === current) return inMonth || o.status !== "done";
      return inMonth;
    });
  }, [data, month, current]);

  const monthSupply = useMemo(() => {
    const list = data?.orders ?? [];
    const target = month === "all" ? null : month;
    return list
      .filter((o) => !target || seoulMonth(o.createdAt) === target)
      .reduce((sum, o) => sum + o.supplyAmount, 0);
  }, [data, month]);

  const months = useMemo(
    () =>
      mergeOrderMonths([
        data?.months ?? [],
        (data?.orders ?? []).map((order) => seoulMonth(order.createdAt)),
        monthsQ.data?.months ?? [],
      ]),
    [data, monthsQ.data],
  );

  if (isPending || !data) {
    return <p className="text-sm text-muted">작업 현황을 불러오는 중…</p>;
  }

  const byStatus = (status: OrderStatus) => visible.filter((o) => o.status === status);
  const hold = byStatus("hold");

  return (
    <div className="stagger-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] tracking-wide text-muted">{PRODUCT_TAGLINE}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">작업 현황</h1>
          <p className="mt-1 text-[13px] text-muted">
            달은 바꿔 봐도 지난 주문은 그대로 있습니다. 출고 안 된 건은 이번 달 판에도 남깁니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NativeSelect
            aria-label="월"
            className="h-10 w-[9.5rem]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="all">모든 달</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {formatYearMonth(m)}
              </option>
            ))}
          </NativeSelect>
          <Link
            to="/orders/new"
            className="hidden h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg sm:inline-flex"
          >
            새 주문
          </Link>
        </div>
      </header>

      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="font-display text-lg font-semibold">접수 → 출고</h2>
          <Link to="/orders" className="text-sm text-muted hover:text-fg">
            전체 목록
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {PIPELINE.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              orders={byStatus(status)}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="오늘 납기" value={String(data.todayDue)} hint="아직 안 나간 건" />
        <Stat
          label="시안 확인"
          value={String(data.counts.review)}
          hint="고객·내부 컨펌 대기"
        />
        <Stat
          label="입금확인중"
          value={String(data.counts.pay_wait)}
          hint="입금돼야 제작"
        />
        <Stat label="제작중" value={String(data.counts.production)} hint="출력·설치" />
        <Stat
          label={month === "all" ? "전체 공급가" : `${formatYearMonth(month)} 공급가`}
          value={won(monthSupply)}
          hint="출고 전 포함"
        />
      </section>

      {hold.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold">보류</h2>
          <div className="mt-3 grid gap-2">
            {hold.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
        <h2 className="font-display text-lg font-semibold">최근 대화</h2>
        <p className="mt-1 text-[13px] text-muted">직원들이 남긴 알림이 여기에 모입니다.</p>
        {data.recentMessages.length === 0 && (
          <p className="mt-4 text-sm text-muted">아직 대화가 없습니다. 주문을 접수하면 여기에 모입니다.</p>
        )}
        {data.recentMessages.length > 0 && (
          <ul className="mt-4 divide-y divide-border">
            {data.recentMessages.map((m) => (
              <li key={m.id} className="py-3 first:pt-0">
                <Link
                  to="/orders/$id"
                  params={{ id: String(m.orderId) }}
                  className="block hover:opacity-80"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">
                      {m.staffName}
                      <span className="ml-2 font-normal text-muted">
                        {m.orderNo} · {m.orderTitle}
                      </span>
                    </p>
                    <span className="shrink-0 text-[12px] text-subtle">{formatClock(m.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{m.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-[12px] text-subtle">{hint}</p>
    </div>
  );
}

function KanbanColumn({ status, orders }: { status: OrderStatus; orders: Order[] }) {
  const visible = status === "done" ? orders.slice(0, 5) : orders;
  return (
    <div className="min-w-0 rounded-[var(--radius-lg)] bg-surface/70 p-1.5 sm:p-2">
      <div className="flex items-center justify-between gap-1 px-1.5 py-1.5">
        <span className="truncate text-[13px] font-medium sm:text-sm">{STATUS_META[status].label}</span>
        <span className="tabular-nums text-[11px] text-subtle">{orders.length}</span>
      </div>
      <div className="space-y-1.5">
        {visible.length === 0 ? (
          <p className="px-1 py-5 text-center text-[11px] text-subtle">없음</p>
        ) : (
          visible.map((order) => <KanbanCard key={order.id} order={order} />)
        )}
        {status === "done" && orders.length > visible.length ? (
          <p className="px-1 pb-1 text-center text-[11px] text-subtle">외 {orders.length - visible.length}건</p>
        ) : null}
      </div>
    </div>
  );
}

function KanbanCard({ order }: { order: Order }) {
  return (
    <Link
      to="/orders/$id"
      params={{ id: String(order.id) }}
      className="block rounded-[var(--radius-md)] bg-elevated p-2 shadow-[var(--shadow-border)] transition-[transform] duration-150 hover:-translate-y-px sm:p-2.5"
    >
      <div className="flex items-start justify-between gap-1">
        <p className="truncate text-[11px] tabular-nums text-subtle">{order.orderNo}</p>
        {order.rush ? <span className="text-[10px] font-medium text-stamp">급행</span> : null}
      </div>
      <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">{order.title}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted">{order.clientName}</p>
      {order.manuscript ? (
        <p className="mt-1 line-clamp-2 rounded-[var(--radius-xs)] bg-fg/5 px-1.5 py-1 text-[11px] leading-snug text-fg">
          {order.manuscript}
        </p>
      ) : (
        <div className="mt-1 overflow-hidden rounded-[var(--radius-xs)]">
          <BannerPreview
            manuscript={order.manuscript}
            widthCm={600}
            heightCm={90}
            bgColor={order.bgColor}
            textColor={order.textColor}
            compact
          />
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-subtle">
        <span className="truncate">{dueLabel(order.dueDate)}</span>
        <span className="shrink-0">{order.itemCount}품목</span>
      </div>
    </Link>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <Link
      to="/orders/$id"
      params={{ id: String(order.id) }}
      className={cn(
        "flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-surface px-4 py-3 shadow-[var(--shadow-border)]",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{order.title}</p>
        <p className="text-[12px] text-muted">
          {order.clientName} · {order.orderNo}
        </p>
      </div>
      <StatusBadge status={order.status} />
    </Link>
  );
}
