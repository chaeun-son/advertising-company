import { formatDate } from "@/lib/format";
import { inferColorMode, specLabel, unpackOrderNotes, vatBreakdown, won } from "@/lib/pricing";
import { suggestRequestName } from "@/lib/catalog";
import type { CompanyProfile, OrderDetail } from "@/lib/types";

export function PrintRequest({
  order,
  company,
  staffName,
}: {
  order: OrderDetail;
  company: CompanyProfile;
  staffName: string;
}) {
  const tax = vatBreakdown(order.supplyAmount, company.vatIncluded);
  const received = order.createdAt.slice(0, 10);
  const extra = order.items.length > 1;
  const meta = unpackOrderNotes(order.notes);
  const project = extra ? `${order.title} 외` : order.title;
  const fileHint = suggestRequestName(order.title.replace(/\s+/g, " "), extra, new Date(order.createdAt));

  return (
    <article className="mx-auto max-w-[210mm] bg-elevated px-5 py-7 text-fg shadow-[var(--shadow-border)] md:px-8 print:max-w-none print:shadow-none">
      <header className="bg-primary px-4 py-3 text-center text-primary-fg">
        <p className="font-display text-lg font-bold tracking-wide">애드스마일 주문 의뢰서</p>
        <p className="mt-0.5 text-[11px] text-primary-fg/80">{company.name}</p>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden border border-border text-sm sm:grid-cols-4">
        <div className="bg-elevated p-3">
          <p className="text-[11px] text-muted">대금결제 (VAT 포함)</p>
          <p className="mt-1 font-display text-lg font-semibold tabular-nums">{won(tax.total)}</p>
        </div>
        <div className="bg-elevated p-3">
          <p className="text-[11px] text-muted">결제</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {(["현금", "세금계산서", "카드결제", "계좌이체"] as const).map((p) => (
              <span key={p} className={meta.payment === p ? "font-semibold" : "text-muted"}>
                {meta.payment === p ? "☑" : "☐"} {p}
              </span>
            ))}
          </p>
        </div>
        <div className="bg-elevated p-3">
          <p className="text-[11px] text-muted">담당자</p>
          <p className="mt-1">{staffName || order.createdBy || "—"}</p>
        </div>
        <div className="bg-elevated p-3">
          <p className="text-[11px] text-muted">주문번호</p>
          <p className="mt-1 tabular-nums">{order.orderNo}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">프로젝트</dt>
          <dd className="font-medium">{project}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">품명</dt>
          <dd>{order.items[0]?.productName ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">업체</dt>
          <dd>
            {order.clientName}
            {order.clientContact ? ` (${order.clientContact})` : ""}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">연락처</dt>
          <dd className="tabular-nums">{order.clientPhone || "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">접수</dt>
          <dd>{formatDate(received)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-muted">납품</dt>
          <dd>
            {order.dueDate ? formatDate(order.dueDate) : "미정"}
            {meta.delivery ? ` · ${meta.delivery}` : ""}
            {order.rush ? " · 급행" : ""}
          </dd>
        </div>
      </dl>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="bg-primary text-primary-fg">
              <th className="px-2 py-2 text-left font-medium">내용</th>
              <th className="px-2 py-2 text-left font-medium">종류</th>
              <th className="px-2 py-2 text-left font-medium">사이즈</th>
              <th className="px-2 py-2 text-left font-medium">색도</th>
              <th className="px-2 py-2 text-left font-medium">후가공</th>
              <th className="px-2 py-2 text-right font-medium">수량</th>
              <th className="px-2 py-2 text-left font-medium">기타</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-border">
                <td className="px-2 py-2">{order.title}</td>
                <td className="px-2 py-2">{item.productName}</td>
                <td className="px-2 py-2 tabular-nums">
                  {specLabel(item.widthCm, item.heightCm, item.unit)}
                </td>
                <td className="px-2 py-2">{inferColorMode(item.productName)}</td>
                <td className="px-2 py-2 text-muted">{item.memo || "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{item.qty}</td>
                <td className="px-2 py-2 text-right tabular-nums">{won(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-4 border border-border p-4 text-sm">
        <h2 className="text-[12px] font-medium text-muted">메모</h2>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">
          {meta.notes || "—"}
          {order.rush ? "\n급행" : ""}
          {`\n*${order.items[0]?.productName ?? "품목"} ${won(tax.supply)} (VAT별도)`}
          {order.dueDate ? `\n*납품 ${formatDate(order.dueDate)}` : ""}
          {order.manuscript ? `\n\n원고\n${order.manuscript}` : ""}
        </p>
        <ul className="mt-3 list-inside list-decimal space-y-1 text-[12px] text-muted">
          <li>납품, 방문수령, 시공 하는 것인지 표기</li>
          <li>특이사항 (퀵·택배 발송 건은 택배 받는 주소, 받는 사람 등 기재)</li>
          <li>매입단가, 매출단가 확실히 알고 있는 경우 기재. 모르면 매입단가 확인요망</li>
        </ul>
      </section>

      <p className="mt-4 text-[12px] text-subtle">파일명 예: {fileHint}</p>
      <p className="mt-1 text-right text-[12px] text-subtle">
        {company.name}
        {company.ownerName ? ` · 대표 ${company.ownerName}` : ""}
        {company.phone ? ` · ${company.phone}` : ""}
      </p>
    </article>
  );
}
