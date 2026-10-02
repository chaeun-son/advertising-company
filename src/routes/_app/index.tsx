import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getDashboard, listOrderMonths, updateOrderStatus } from "@/lib/server/api";
import { dueLabel, formatYearMonth, mergeOrderMonths, monthFromOrderNo, orderInMonth, seoulMonth } from "@/lib/format";
import { won } from "@/lib/pricing";
import { useStaffSession } from "@/lib/staff-session";
import { PIPELINE, STATUS_META, type Order, type OrderStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

const NAV = [
  { to: "/", label: "작업현황", exact: true },
  { to: "/orders", label: "주문관리", exact: false },
  { to: "/studio", label: "편집실", exact: false },
  { to: "/video", label: "영상 편집", exact: false },
  { to: "/clients", label: "거래처", exact: false },
] as const;

function DashboardPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(seoulMonth());
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("전체 담당자");
  const [due, setDue] = useState("전체 납기");
  const [statusFilter, setStatusFilter] = useState("전체 상태");
  const [paymentFilter, setPaymentFilter] = useState("전체 결제");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<OrderStatus | null>(null);
  const queryClient = useQueryClient();
  const staffName = useStaffSession((s) => s.name);
  const { data, isPending } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
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

  const months = useMemo(
    () => mergeOrderMonths([
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

  const visible = useMemo(() => {
    if (!data) return [];
    return data.orders.filter((order) => {
      if (month !== "all") {
        const hit = orderInMonth(order, month);
        if (!(month === current ? hit || order.status !== "done" : hit)) return false;
      }
      const text = `${order.orderNo} ${order.clientName} ${order.title} ${order.manuscript}`.toLowerCase();
      if (query && !text.includes(query.toLowerCase())) return false;
      const person = order.assignee || order.createdBy;
      if (owner !== "전체 담당자" && person !== owner) return false;
      if (due === "오늘" && order.dueDate !== today) return false;
      if (due === "지난 납기" && !(order.dueDate && order.dueDate < today && order.status !== "done")) return false;
      if (statusFilter !== "전체 상태" && STATUS_META[order.status].label !== statusFilter) return false;
      if (paymentFilter === "결제 대기" && order.status !== "pay_wait") return false;
      if (paymentFilter === "결제 완료" && order.status !== "pay_ok" && order.status !== "production" && order.status !== "done") return false;
      if (urgentOnly && !order.rush && order.dueDate !== today) return false;
      return true;
    });
  }, [current, data, due, month, owner, paymentFilter, query, statusFilter, today, urgentOnly]);

  if (isPending || !data) {
    return <p className="p-8 text-sm text-[#756a62]">작업 현황을 불러오는 중…</p>;
  }

  const monthSupply = data.orders.filter((order) => month === "all" || orderInMonth(order, month)).reduce((sum, order) => sum + order.supplyAmount, 0);
  const delayed = visible.filter((order) => order.dueDate && order.dueDate < today && order.status !== "done" && order.status !== "hold").length;
  const todayDue = visible.filter((order) => order.dueDate === today && order.status !== "done").length;
  const drafting = visible.filter((order) => order.status === "drafting" || order.status === "review").length;

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
    <main className="make-ui dashboard-shell">
      <header className="dashboard-header">
        <Link to="/" className="dashboard-brand">
          <span className="dashboard-mark"><i /><i /><i /></span>
          <div><strong>CRESORA</strong><small>STUDIO</small></div>
        </Link>
        <nav className="product-nav">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} className={item.exact ? "active" : ""}>{item.label}</Link>
          ))}
        </nav>
        <div className="dashboard-head-actions">
          <span className="ds-badge success">자동 동기화</span>
          <NativeMonth value={month} months={months} onChange={setMonth} />
          <Link to="/orders/new" className="ds-button primary">새 주문</Link>
          <button className="profile" type="button">{(staffName || "직").slice(0, 1)}</button>
        </div>
      </header>
      <section className="dashboard-main">
        <div className="dashboard-title">
          <div>
            <span className="eyebrow">CREATE · MANAGE · DELIVER</span>
            <h1>작업현황</h1>
            <p>주문 접수부터 제작과 출고까지 진행 상황을 한눈에 관리합니다.</p>
          </div>
          <div className="summary-cards">
            <section className="ds-card"><span>오늘 납기</span><strong>{todayDue}</strong><small>아직 안 나간 건</small></section>
            <section className="ds-card"><span>시안 대기</span><strong>{drafting}</strong><small>작업·확인</small></section>
            <section className="ds-card"><span>제작 중</span><strong>{visible.filter((order) => order.status === "production").length}</strong><small>출력·설치</small></section>
            <section className="ds-card kpi-alert"><span>지연 주문</span><strong>{delayed}</strong><small>납기가 지난 건</small></section>
            <section className="ds-card"><span>회신 대기</span><strong>{visible.filter((order) => order.status === "review").length}</strong><small>시안 확인</small></section>
            <section className="ds-card"><span>{month === "all" ? "전체 공급가" : "이번 달 공급가"}</span><strong>{won(monthSupply)}</strong><small>{month === "all" ? "모든 달" : formatYearMonth(month)}</small></section>
          </div>
        </div>
        <section className="ds-card dashboard-filter">
          <label className="ds-input"><input aria-label="주문 검색" placeholder="주문번호, 고객명, 상품명 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="ds-select"><select aria-label="담당자" value={owner} onChange={(event) => setOwner(event.target.value)}><option>전체 담당자</option>{owners.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="ds-select"><select aria-label="납기" value={due} onChange={(event) => setDue(event.target.value)}><option>전체 납기</option><option>오늘</option><option>지난 납기</option></select></label>
          <label className="ds-select"><select aria-label="상태" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>전체 상태</option>{PIPELINE.map((status) => <option key={status}>{STATUS_META[status].label}</option>)}</select></label>
          <label className="ds-select"><select aria-label="결제" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option>전체 결제</option><option>결제 완료</option><option>결제 대기</option></select></label>
          <button type="button" className={`ds-button ${urgentOnly ? "primary" : "secondary"}`} onClick={() => setUrgentOnly((on) => !on)}>긴급 주문</button>
          <div className="ds-tabs">
            <button type="button" className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}>보드</button>
            <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>목록</button>
          </div>
          <div className="saved-filter-row">
            <span>{visible.length}개 주문</span>
            <button type="button" onClick={() => { setUrgentOnly(true); setOwner(staffName || "전체 담당자"); }}>내 긴급 주문</button>
          </div>
        </section>
        {view === "kanban" ? (
          <div className="kanban-board">
            {PIPELINE.map((status, index) => {
              const cards = visible.filter((order) => order.status === status);
              return (
                <section key={status} className={`kanban-column ${dragOver === status ? "drag-over" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragOver(status); }} onDrop={(event) => { event.preventDefault(); dropOn(status); }}>
                  <header><div><i className={`stage-dot stage-${index}`} /><strong>{STATUS_META[status].label}</strong><span>{cards.length}</span></div></header>
                  <div className="kanban-list">
                    {cards.length === 0 ? <div className="column-empty">현재 주문 없음</div> : cards.slice(0, status === "done" ? 8 : 20).map((order) => (
                      <OrderCard key={order.id} order={order} today={today} dragging={draggingId === order.id} onOpen={() => void navigate({ to: "/orders/$id", params: { id: String(order.id) } })} onDragStart={() => setDraggingId(order.id)} onDragEnd={() => { setDraggingId(null); setDragOver(null); }} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <section className="ds-card order-table">
            <table>
              <thead><tr><th>주문번호</th><th>고객명</th><th>작업</th><th>수량</th><th>납기</th><th>담당자</th><th>상태</th></tr></thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id} onClick={() => void navigate({ to: "/orders/$id", params: { id: String(order.id) } })}>
                    <td>{order.orderNo}</td><td>{order.clientName}</td><td>{order.title}</td><td>{order.itemCount}품목</td><td>{dueLabel(order.dueDate)}</td><td>{order.assignee || order.createdBy}</td><td><span className="ds-badge bronze">{STATUS_META[order.status].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </section>
    </main>
  );
}

function NativeMonth({ value, months, onChange }: { value: string; months: string[]; onChange: (value: string) => void }) {
  return (
    <label className="ds-select">
      <select aria-label="월" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">모든 달</option>
        {months.map((item) => <option key={item} value={item}>{formatYearMonth(item)}</option>)}
      </select>
    </label>
  );
}

function OrderCard({ order, today, dragging, onOpen, onDragStart, onDragEnd }: { order: Order; today: string; dragging: boolean; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void }) {
  const late = Boolean(order.dueDate && order.dueDate < today && order.status !== "done");
  const owner = order.assignee || order.createdBy || "미정";
  return (
    <button type="button" className={`order-card ${order.rush ? "urgent" : ""} ${dragging ? "dragging" : ""}`} draggable onClick={onOpen} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(order.id)); onDragStart(); }} onDragEnd={onDragEnd}>
      <div className="order-top">
        <span>{order.orderNo}</span>
        <span className="order-badges">
          {order.dueDate === today && order.status !== "done" ? <span className="ds-badge warning">오늘 마감</span> : null}
          {late ? <span className="ds-badge danger">납기 지연</span> : null}
          {order.status === "review" ? <span className="ds-badge info">고객 회신 대기</span> : null}
          {order.status === "pay_wait" ? <span className="ds-badge warning">결제 대기</span> : null}
          {order.rush ? <span className="ds-badge danger">긴급</span> : null}
        </span>
      </div>
      <strong className="order-customer">{order.clientName}</strong>
      <span className="order-product">{order.title}</span>
      {order.manuscript ? <p className="order-note">{order.manuscript}</p> : null}
      <dl className="order-meta">
        <div><dt>납기</dt><dd className={order.dueDate === today ? "due-today" : ""}>{dueLabel(order.dueDate)}</dd></div>
        <div><dt>수량</dt><dd>{order.itemCount}품목</dd></div>
        <div><dt>담당</dt><dd><span className="owner-avatar">{owner.slice(0, 1)}</span>{owner}</dd></div>
      </dl>
    </button>
  );
}
