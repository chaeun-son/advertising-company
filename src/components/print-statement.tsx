import { AdsmileWordmark, DocQr } from "@/components/adsmile-logo";
import { unpackOrderNotes, vatBreakdown, wonNum } from "@/lib/pricing";
import type { DocumentRecord } from "@/lib/types";

function cell(value: string | number, className = "") {
  return (
    <td className={`border border-fg/80 px-1.5 py-1 align-middle ${className}`}>{value || ""}</td>
  );
}

function lineUnitPrice(item: { unit: string; unitPrice: number; qty: number; amount: number }) {
  if (item.unit === "㎡" || item.unit === "자") return item.unitPrice;
  if (item.qty > 0) return Math.round(item.amount / item.qty);
  return item.unitPrice;
}

export function PrintStatement({ doc }: { doc: DocumentRecord }) {
  const { payload } = doc;
  const company = payload.company;
  const issued = doc.issuedAt.slice(0, 10);
  const mmdd = issued.slice(5).replace("-", "");
  const notes = unpackOrderNotes(payload.notes);
  const qtySum = payload.items.reduce((s, i) => s + i.qty, 0);
  const rows = 14;
  const lineTaxes = payload.items.map((item) => vatBreakdown(item.amount, payload.vatIncluded));
  const empty = Math.max(0, rows - payload.items.length);
  const serial = String(doc.id).padStart(4, "0");

  function itemName(item: (typeof payload.items)[0]) {
    const spec = item.spec && item.spec !== "—" ? item.spec.replace("×", "*").replace("cm", "") : "";
    const extra = item.memo ? `(${item.memo})` : "";
    const body = `${item.productName}${payload.title ? `-${payload.title}` : ""}${extra}`;
    return spec ? `${body}/${spec}` : body;
  }

  return (
    <article className="hantex mx-auto w-full max-w-[210mm] bg-elevated px-5 py-4 text-[12px] text-fg shadow-[var(--shadow-border)] print:max-w-none print:px-0 print:py-0 print:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] text-subtle">(한텍스 B형 서식)</p>
        <AdsmileWordmark />
      </div>

      <div className="mt-1 grid grid-cols-[auto_minmax(0,1fr)_11rem] items-stretch border-2 border-fg">
        <div className="flex items-center border-r-2 border-fg p-1.5">
          <DocQr seed={doc.docNo} />
        </div>
        <div className="flex flex-col items-center justify-center border-r-2 border-fg py-2">
          <h1 className="font-display text-[28px] font-bold tracking-[0.35em]">거래명세표</h1>
          <p className="mt-0.5 text-[11px] text-muted">(공급받는자 보관용)</p>
        </div>
        <div className="grid grid-cols-[3.2rem_1fr] text-[11px]">
          <div className="border-b border-r border-fg px-1 py-1 text-center">일자</div>
          <div className="border-b border-fg px-1.5 py-1 tabular-nums">{issued}</div>
          <div className="border-b border-r border-fg px-1 py-1 text-center">No</div>
          <div className="border-b border-fg px-1.5 py-1 tabular-nums">{serial}</div>
          <div className="col-span-2 px-1.5 py-1 text-right tabular-nums">1/1</div>
        </div>
      </div>

      <div className="grid grid-cols-2 border-x-2 border-b-2 border-fg">
        <section className="border-r-2 border-fg">
          <div className="grid grid-cols-[4.2rem_1fr_3.2rem_4.5rem] text-[11px]">
            <div className="border-b border-r border-fg px-1 py-1 text-center">공 급 자</div>
            <div className="border-b border-r border-fg px-1.5 py-1 tabular-nums">{company.bizNo || " "}</div>
            <div className="border-b border-r border-fg px-1 py-1 text-center">종사업장</div>
            <div className="border-b border-fg px-1.5 py-1"> </div>
            <div className="border-b border-r border-fg px-1 py-1 text-center">상 호</div>
            <div className="border-b border-r border-fg px-1.5 py-1 font-medium">{company.name}</div>
            <div className="border-b border-r border-fg px-1 py-1 text-center">성 명</div>
            <div className="relative border-b border-fg px-1.5 py-1">
              {company.ownerName}
              <img
                src="/adsmile-mark.png"
                alt=""
                className="absolute -right-1 -top-1 size-10 object-contain opacity-90 print:opacity-100"
              />
              <span className="sr-only">(인)</span>
            </div>
            <div className="border-b border-r border-fg px-1 py-1 text-center">주 소</div>
            <div className="col-span-3 border-b border-fg px-1.5 py-1 leading-snug">{company.address || " "}</div>
            <div className="border-r border-fg px-1 py-1 text-center">업 태</div>
            <div className="border-r border-fg px-1.5 py-1">{company.bizType || " "}</div>
            <div className="border-r border-fg px-1 py-1 text-center">종 목</div>
            <div className="px-1.5 py-1">{company.bizItem || " "}</div>
          </div>
        </section>
        <section>
          <div className="flex h-full flex-col text-[11px]">
            <div className="grid grid-cols-[4.6rem_1fr] border-b border-fg">
              <div className="border-r border-fg px-1 py-1 text-center leading-tight">
                공<br />급<br />받<br />는<br />자
              </div>
              <div className="px-3 py-2">
                <p className="font-display text-[16px] font-semibold tracking-wide">
                  {payload.clientName} <span className="ml-1 font-bold">貴下</span>
                </p>
                <p className="mt-2 text-[12px]">거래해 주셔서 감사합니다.</p>
                <p className="mt-3 text-[11px] text-muted">
                  To. TEL {company.phone || " "}
                  {company.fax ? ` Fax.${company.fax}` : ""}
                </p>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2">
              <div className="border-r border-fg px-1.5 py-1">
                <span className="text-muted">비고</span>
                <p className="mt-1">{notes.delivery || notes.payment || " "}</p>
              </div>
              <div className="px-1.5 py-1">
                <span className="text-muted">인수자</span>
                <p className="mt-1">{payload.clientContact || " "}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <table className="w-full border-collapse border-x-2 border-fg text-[11px]">
        <thead>
          <tr className="bg-fg/[0.04]">
            <th className="w-12 border border-fg/80 py-1 font-medium">월일</th>
            <th className="border border-fg/80 py-1 font-medium">품 명 / 규 격</th>
            <th className="w-10 border border-fg/80 py-1 font-medium">단위</th>
            <th className="w-12 border border-fg/80 py-1 font-medium">수량</th>
            <th className="w-[4.5rem] border border-fg/80 py-1 font-medium">단 가</th>
            <th className="w-[5rem] border border-fg/80 py-1 font-medium">공급가액</th>
            <th className="w-[4.2rem] border border-fg/80 py-1 font-medium">세 액</th>
            <th className="w-12 border border-fg/80 py-1 font-medium">비고</th>
          </tr>
        </thead>
        <tbody>
          {payload.items.map((item, i) => {
            const tax = lineTaxes[i]!;
            return (
              <tr key={i} className={i % 2 ? "bg-fg/[0.035]" : ""}>
                {cell(i === 0 ? mmdd : "", "text-center tabular-nums")}
                {cell(itemName(item), "text-left")}
                {cell(item.unit === "㎡" ? "㎡" : "", "text-center")}
                {cell(item.qty, "text-right tabular-nums")}
                {cell(wonNum(lineUnitPrice(item)), "text-right tabular-nums")}
                {cell(wonNum(tax.supply), "text-right tabular-nums")}
                {cell(wonNum(tax.vat), "text-right tabular-nums")}
                {cell("", "")}
              </tr>
            );
          })}
          {Array.from({ length: empty }, (_, i) => (
            <tr key={`e-${i}`} className={(payload.items.length + i) % 2 ? "bg-fg/[0.035]" : ""}>
              {cell(" ", "h-7")}
              {cell(" ", "")}
              {cell(" ", "")}
              {cell(" ", "")}
              {cell(" ", "")}
              {cell(" ", "")}
              {cell(" ", "")}
              {cell(" ", "")}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-[1fr_7rem_7rem] border-x-2 border-b-2 border-fg text-[11px]">
        <div className="border-r border-fg px-2 py-1.5">
          <span className="font-display text-[13px] font-semibold">
            합계 ₩{wonNum(payload.totalAmount)}원정
          </span>
          <span className="ml-3 text-muted">
            (수량 : {qtySum}, 공급가 : {wonNum(payload.supplyAmount)}, 세액 : {wonNum(payload.vatAmount)})
          </span>
        </div>
        <div className="border-r border-fg px-1.5 py-1.5">
          <span className="text-muted">전잔금</span>
        </div>
        <div className="px-1.5 py-1.5"> </div>
        <div className="border-t border-r border-fg px-2 py-1.5">
          <span className="text-muted">메모 </span>
          <span>{notes.notes || " "}</span>
        </div>
        <div className="border-t border-r border-fg px-1.5 py-1.5">
          <span className="text-muted">현잔금</span>
        </div>
        <div className="border-t border-fg px-1.5 py-1.5">
          <span className="text-muted">총잔금</span>
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between text-[11px] text-muted">
        <p>오늘 하루도 행복하십시오.</p>
        <p>
          From. {payload.clientPhone ? `TEL ${payload.clientPhone}` : ""}
          {payload.clientEmail ? ` ${payload.clientEmail}` : ""}
        </p>
      </div>
    </article>
  );
}
