import { formatDate, formatDateTime } from "@/lib/format";
import { won, wonNum } from "@/lib/pricing";
import type { DocumentRecord } from "@/lib/types";

export function PrintDocument({ doc }: { doc: DocumentRecord }) {
  const { payload } = doc;
  const isQuote = doc.docType === "quote";
  const title = isQuote ? "견 적 서" : "거 래 명 세 서";
  const company = payload.company;

  return (
    <article className="mx-auto max-w-[210mm] bg-elevated px-6 py-8 text-fg shadow-[var(--shadow-border)] md:px-10 print:max-w-none print:shadow-none">
      <header className="relative border-b-2 border-primary pb-4">
        <p className="text-[12px] tracking-[0.2em] text-muted">{company.name}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-[0.35em] md:text-4xl">
          {title}
        </h1>
        <div className="absolute right-0 top-0">
          <img src="/adsmile-mark.png" alt="애드스마일" className="size-24 object-contain" />
        </div>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-[var(--radius-md)] bg-surface p-4">
          <h2 className="text-[12px] font-medium tracking-wide text-muted">공급자</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2"><dt className="w-20 text-subtle">상호</dt><dd>{company.name}</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-subtle">대표</dt><dd>{company.ownerName}</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-subtle">사업자</dt><dd className="tabular-nums">{company.bizNo}</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-subtle">전화</dt><dd className="tabular-nums">{company.phone}</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-subtle">주소</dt><dd>{company.address}</dd></div>
          </dl>
        </section>
        <section className="rounded-[var(--radius-md)] bg-surface p-4">
          <h2 className="text-[12px] font-medium tracking-wide text-muted">공급받는 자</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex gap-2"><dt className="w-20 text-subtle">상호</dt><dd>{payload.clientName} 귀하</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-subtle">담당</dt><dd>{payload.clientContact || "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-subtle">전화</dt><dd className="tabular-nums">{payload.clientPhone || "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-subtle">문서번호</dt><dd className="tabular-nums">{doc.docNo}</dd></div>
            <div className="flex gap-2"><dt className="w-20 text-subtle">발행</dt><dd>{formatDateTime(doc.issuedAt)}</dd></div>
          </dl>
        </section>
      </div>

      <p className="mt-6 text-sm text-muted">
        아래와 같이 {isQuote ? "견적" : "거래"}합니다. 관련 주문 {payload.orderNo}
        {payload.dueDate ? ` · 납기 ${formatDate(payload.dueDate)}` : ""}
        {payload.rush ? " · 급행" : ""}
      </p>
      <p className="mt-1 font-medium">{payload.title}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="bg-primary text-primary-fg">
              <th className="px-3 py-2 text-left font-medium">품목</th>
              <th className="px-3 py-2 text-left font-medium">규격</th>
              <th className="px-3 py-2 text-right font-medium">수량</th>
              <th className="px-3 py-2 text-right font-medium">단가</th>
              <th className="px-3 py-2 text-right font-medium">금액</th>
            </tr>
          </thead>
          <tbody>
            {payload.items.map((item, i) => (
              <tr key={i} className="border-b border-border">
                <td className="px-3 py-2">
                  {item.productName}
                  {item.memo ? <span className="block text-[12px] text-subtle">{item.memo}</span> : null}
                </td>
                <td className="px-3 py-2 tabular-nums">{item.spec}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {item.qty} {item.unit}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{wonNum(item.unitPrice)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{wonNum(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 ml-auto w-full max-w-xs text-sm">
        <div className="flex justify-between py-1">
          <span className="text-muted">공급가액</span>
          <span className="tabular-nums">{won(payload.supplyAmount)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-muted">부가세{payload.vatIncluded ? " (포함분)" : ""}</span>
          <span className="tabular-nums">{won(payload.vatAmount)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-primary pt-2 font-display text-lg font-semibold">
          <span>합계</span>
          <span className="tabular-nums">{won(payload.totalAmount)}</span>
        </div>
      </div>

      {payload.manuscript ? (
        <section className="mt-6 rounded-[var(--radius-md)] bg-surface p-4">
          <h2 className="text-[12px] font-medium text-muted">원고</h2>
          <p className="mt-2 whitespace-pre-wrap font-display text-sm leading-relaxed">
            {payload.manuscript}
          </p>
        </section>
      ) : null}

      {payload.notes ? (
        <p className="mt-4 text-sm text-muted">비고: {payload.notes}</p>
      ) : null}

      <footer className="mt-8 grid gap-4 border-t border-border pt-4 text-[12px] text-muted md:grid-cols-2">
        {isQuote ? (
          <p>유효기간: 발행일로부터 {company.quoteValidDays}일</p>
        ) : (
          <p>위 금액을 정히 청구합니다.</p>
        )}
        <p className="md:text-right">
          입금 {company.bankName} {company.bankAccount} {company.bankHolder}
        </p>
        <p>발행 {doc.issuedBy}</p>
        <p className="md:text-right">{company.phone} · {company.email}</p>
      </footer>
    </article>
  );
}
