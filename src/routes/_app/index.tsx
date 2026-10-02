import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BannerPreview } from "@/components/banner-preview";
import { StatusBadge } from "@/components/status-badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { getDashboard, listOrderMonths, updateOrderStatus } from "@/lib/server/api";
import { dueLabel, formatClock, formatYearMonth, mergeOrderMonths, monthFromOrderNo, orderInMonth, seoulMonth } from "@/lib/format";
import { won } from "@/lib/pricing";
import { useStaffSession } from "@/lib/staff-session";
import { PIPELINE, STATUS_META, type Order, type OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const [month, setMonth] = useState(seoulMonth());
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("전체 담당자");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);
  const queryClient = useQueryClient();
  const staffName = useStaffSession((s) => s.name);
  const { data, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
  });
  const monthsQ = useQuery({ queryKey: ["order-months"], queryFn: () => listOrderMonths() });
  const current = seoulMonth();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  const move = useMutation({
    mutationFn: (input: { id: number; status: OrderStatus }) =>
      updateOrderStatus({ data: { id: input.id, status: input.status, staffName: staffName || "직원" } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("작업 단계를 옮겼습니다.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "상태를 바꾸지 못했습니다."),
  });

  const visible = useMemo(() => {
    if (!data) return [];
    const inMonth = data.orders.filter((order) => {
      if (month === "all") return true;
      const hit = orderInMonth(order, month);
      if (month === current) return hit || order.status !== "done";
      return hit;
    });
    return inMonth.filter((order) => {
      const text = `${order.orderNo} ${order.clientName} ${order.title} ${order.manuscript}`.toLowerCase();
      if (query && !text.includes(query.toLowerCase())) return false;
      if (owner !== "전체 담당자" && order.assignee !== owner && order.createdBy !== owner) return false;
      if (urgentOnly && !order.rush && order.dueDate !== today) return false;
      return true;
    });
  }, [current, data, month, owner, query, today, urgentOnly]);

  const monthSupply = useMemo(() => {
    const list = data?.orders ?? [];
    const target = month === "all" ? null : month;
    return list.filter((order) => !target || orderInMonth(order, target)).reduce((sum, order) => sum + order.supplyAmount, 0);
  }, [data, month]);

  const months = useMemo(
    () =>
      mergeOrderMonths([
        data?.months ?? [],
        (data?.orders ?? []).flatMap((order) => [seoulMonth(order.createdAt), monthFromOrderNo(order.orderNo) ?? ""]),
        monthsQ.data?.months ?? [],
      ]),
    [data, monthsQ.data],
  );

  const owners = useMemo(() => {
    const names = new Set<string>();
    for (const order of data?.orders ?? []) {
      if (order.assignee) names.add(order.assignee);
      if (order.createdBy) names.add(order.createdBy);
    }
    return [...names];
  }, [data]);

  if (isPending || !data) {
    return <p className="text-sm text-[#756a62]">작업 현황을 불러오는 중…</p>;
  }

  const byStatus = (status: OrderStatus) => visible.filter((order) => order.status === status);
  const delayed = visible.filter((order) => order.dueDate && order.dueDate < today && order.status !== "done" && order.status !== "hold").length;

  function dropOn(status: OrderStatus) {
    const id = draggingId;
    setDraggingId(null);
    setDragOver(null);
    if (!id) return;
    const order = data?.orders.find((item) => item.id === id);
    if (!order || order.status === status) return;
    if ((status === "production" || status === "done") && !window.confirm(`이 주문을 「${STATUS_META[status].label}」로 바꿀까요?`)) return;
    move.mutate({ id, status });
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold tracking-[0.16em] text-[#aa7b41]">CREATE · MANAGE · DELIVER</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">작업현황</h1>
          <p className="mt-1 text-[13px] text-[#756a62]">주문 접수부터 제작과 출고까지, 실제 주문 상태로 움직입니다.</p>
        </div>
        <NativeSelect aria-label="월" className="h-10 w-[9.5rem] border-[#ddd7cf] bg-white" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">모든 달</option>
          {months.map((item) => (
            <option key={item} value={item}>{formatYearMonth(item)}</option>
          ))}
        </NativeSelect>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="오늘 납기" value={String(visible.filter((order) => order.dueDate === today && order.status !== "done").length)} hint="아직 안 나간 건" />
        <Kpi label="시안 대기" value={String(byStatus("drafting").length + byStatus("review").length)} hint="작업·확인" />
        <Kpi label="제작 중" value={String(byStatus("production").length)} hint="출력·설치" />
        <Kpi label="지연 주문" value={String(delayed)} hint="납기가 지난 건" alert={delayed > 0} />
        <Kpi label="회신 대기" value={String(byStatus("review").length)} hint="시안 확인" />
        <Kpi label={month === "all" ? "전체 공급가" : `${formatYearMonth(month)} 공급가`} value={won(monthSupply)} hint="선택한 달" />
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-[#fffdf9] p-3 shadow-[0_0_0_1px_rgba(48,38,33,0.06)] lg:flex-row lg:items-center">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="주문번호, 고객명, 상품명 검색" className="border-[#ddd7cf] bg-white lg:max-w-sm" />
        <NativeSelect aria-label="담당자" value={owner} onChange={(e) => setOwner(e.target.value)} className="border-[#ddd7cf] bg-white lg:w-40">
          <option>전체 담당자</option>
          {owners.map((name) => <option key={name}>{name}</option>)}
        </NativeSelect>
        <button type="button" onClick={() => setUrgentOnly((on) => !on)} className={cn("h-10 rounded-lg px-3 text-sm font-semibold", urgentOnly ? "bg-[#362319] text-[#fffaf2]" : "bg-white text-[#756a62] ring-1 ring-[#ddd7cf]")}>긴급 주문</button>
        <div className="ml-auto flex rounded-lg bg-[#eee9e2] p-1">
          <button type="button" onClick={() => setView("kanban")} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold", view === "kanban" ? "bg-white" : "text-[#756a62]")}>보드</button>
          <button type="button" onClick={() => setView("list")} className={cn("rounded-md px-3 py-1.5 text-sm font-semibold", view === "list" ? "bg-white" : "text-[#756a62]")}>목록</button>
        </div>
      </section>

      {view === "kanban" ? (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-7">
          {PIPELINE.map((status) => (
            <section
              key={status}
              className={cn("min-w-0 rounded-2xl bg-[#fffdf9]/80 p-2", dragOver === status && "ring-2 ring-[#c08a4d]")}
              onDragOver={(event) => { event.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver((current) => (current === status ? null : current))}
              onDrop={(event) => { event.preventDefault(); dropOn(status); }}
            >
              <header className="flex items-center justify-between px-1 py-1.5">
                <span className="truncate text-sm font-semibold">{STATUS_META[status].label}</span>
                <span className="text-[11px] text-[#9a9088]">{byStatus(status).length}</span>
              </header>
              <div className="space-y-1.5">
                {byStatus(status).length === 0 ? <p className="px-1 py-6 text-center text-[11px] text-[#9a9088]">현재 주문 없음</p> : byStatus(status).slice(0, status === "done" ? 5 : 12).map((order) => (
                  <KanbanCard key={order.id} order={order} today={today} dragging={draggingId === order.id} onDragStart={() => setDraggingId(order.id)} onDragEnd={() => { setDraggingId(null); setDragOver(null); }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-[#fffdf9] shadow-[0_0_0_1px_rgba(48,38,33,0.06)]">
          <table className="w-full text-left text-sm">
            <thead className="text-[12px] text-[#756a62]"><tr><th className="px-4 py-3">주문번호</th><th>고객명</th><th>작업</th><th>납기</th><th>담당</th><th>상태</th></tr></thead>
            <tbody>
              {visible.map((order) => (
                <tr key={order.id} className="border-t border-[#eee6de]">
                  <td className="px-4 py-3"><Link to="/orders/$id" params={{ id: String(order.id) }} className="font-medium">{order.orderNo}</Link></td>
                  <td>{order.clientName}</td>
                  <td>{order.title}</td>
                  <td>{dueLabel(order.dueDate)}</td>
                  <td>{order.assignee || order.createdBy}</td>
                  <td><StatusBadge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {byStatus("hold").length > 0 && view === "kanban" ? (
        <section>
          <h2 className="font-serif text-lg">보류</h2>
          <div className="mt-2 grid gap-2">
            {byStatus("hold").map((order) => (
              <Link key={order.id} to="/orders/$id" params={{ id: String(order.id) }} className="flex items-center justify-between rounded-xl bg-[#fffdf9] px-4 py-3">
                <span><strong>{order.title}</strong><span className="ml-2 text-[12px] text-[#756a62]">{order.clientName} · {order.orderNo}</span></span>
                <StatusBadge status={order.status} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-[#fffdf9] p-4 shadow-[0_0_0_1px_rgba(48,38,33,0.06)] md:p-5">
        <h2 className="font-serif text-lg">최근 대화</h2>
        {data.recentMessages.length === 0 ? <p className="mt-3 text-sm text-[#756a62]">아직 대화가 없습니다.</p> : (
          <ul className="mt-3 divide-y divide-[#eee6de]">
            {data.recentMessages.map((message) => (
              <li key={message.id} className="py-3">
                <Link to="/orders/$id" params={{ id: String(message.orderId) }} className="block">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium">{message.staffName}<span className="ml-2 font-normal text-[#756a62]">{message.orderNo} · {message.orderTitle}</span></span>
                    <span className="text-[12px] text-[#9a9088]">{formatClock(message.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[#756a62]">{message.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, value, hint, alert = false }: { label: string; value: string; hint: string; alert?: boolean }) {
  return (
    <div className={cn("rounded-2xl bg-[#fffdf9] p-4 shadow-[0_0_0_1px_rgba(48,38,33,0.06)]", alert && "ring-1 ring-[#c4452d]")}>
      <p className="text-[12px] text-[#756a62]">{label}</p>
      <p className="mt-1 truncate font-serif text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[12px] text-[#9a9088]">{hint}</p>
    </div>
  );
}

function KanbanCard({ order, today, dragging, onDragStart, onDragEnd }: { order: Order; today: string; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const late = Boolean(order.dueDate && order.dueDate < today && order.status !== "done");
  return (
    <Link
      to="/orders/$id"
      params={{ id: String(order.id) }}
      draggable
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(order.id)); onDragStart(); }}
      onDragEnd={onDragEnd}
      className={cn("block rounded-xl bg-white p-2.5 shadow-[0_0_0_1px_rgba(48,38,33,0.06)]", dragging && "opacity-50", order.rush && "ring-1 ring-[#c4452d]")}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[11px] text-[#9a9088]">{order.orderNo}</p>
        {order.rush ? <span className="text-[10px] font-bold text-[#c4452d]">긴급</span> : late ? <span className="text-[10px] font-bold text-[#a05a18]">지연</span> : null}
      </div>
      <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-snug">{order.clientName}</p>
      <p className="line-clamp-2 text-[12px] text-[#756a62]">{order.title}</p>
      {order.manuscript ? <p className="mt-1 line-clamp-2 rounded bg-[#f4efe8] px-1.5 py-1 text-[11px]">{order.manuscript}</p> : (
        <div className="mt-1 overflow-hidden rounded"><BannerPreview manuscript={order.manuscript} widthCm={600} heightCm={90} bgColor={order.bgColor} textColor={order.textColor} compact /></div>
      )}
      <div className="mt-1.5 flex justify-between text-[11px] text-[#9a9088]">
        <span>{dueLabel(order.dueDate)}</span>
        <span>{order.assignee || order.createdBy || `${order.itemCount}품목`}</span>
      </div>
    </Link>
  );
}
