import { useMemo, useState } from "react";
import { CATALOG, CATEGORIES, type CatalogRow } from "@/lib/catalog";
import { areaM2, isLotPrice, quoteRow, vatBreakdown, won } from "@/lib/pricing";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StandId = "none" | "xb-in" | "xb-out";

type QuoteLine = { label: string; supply: number };

export function QuoteCalculator() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("현수막");
  const rows = CATALOG.filter((r) => r.category === category);
  const [sku, setSku] = useState(rows[0]?.id ?? "ban-min");
  const row = CATALOG.find((r) => r.id === sku) ?? rows[0];
  const [qty, setQty] = useState(1);
  const [width, setWidth] = useState(500);
  const [height, setHeight] = useState(90);
  const [round, setRound] = useState(false);
  const [cube, setCube] = useState(0);
  const [standId, setStandId] = useState<StandId>("none");

  function pickCategory(next: (typeof CATEGORIES)[number]) {
    setCategory(next);
    const first = CATALOG.find((r) => r.category === next);
    if (first) setSku(first.id);
    setQty(1);
    setRound(false);
    setCube(0);
    setStandId("none");
    if (next === "현수막") {
      setWidth(500);
      setHeight(90);
    }
    if (next === "X배너") {
      setWidth(60);
      setHeight(180);
    }
  }

  const sized =
    row?.unit === "㎡" ||
    sku === "ban-min" ||
    sku === "ban-guerrilla" ||
    sku === "ban-m2" ||
    category === "X배너" ||
    category === "현수막";
  const lot = row ? isLotPrice(row.minQty, row.unit) : false;
  const bannerPrint = category === "X배너" && (sku === "xb-pet" || sku === "xb-ban");
  const stand = standId === "none" ? undefined : CATALOG.find((r) => r.id === standId);

  const { lines, result } = useMemo(() => {
    const jobs = Math.max(1, qty);
    const next: QuoteLine[] = [];
    if (sku === "ban-m2") {
      const supply = Math.round(areaM2(width, height) * 10_000) * jobs;
      next.push({ label: `현수막 ${width}×${height}cm`, supply });
    } else if (row) {
      const q = quoteRow(row, jobs, width, height);
      next.push({ label: `${row.name} × ${jobs}${lot ? "건" : row.unit}`, supply: q.supply });
    }
    if (category === "명함" && round) {
      next.push({ label: `귀도리 × ${jobs}건`, supply: 5_000 * jobs });
    }
    if (category === "현수막" && cube > 0) {
      next.push({ label: `압축큐방 × ${cube}개`, supply: 3_000 * cube });
    }
    if (bannerPrint && stand) {
      next.push({
        label: `${stand.name} × ${jobs}개`,
        supply: stand.supply * jobs,
      });
    }
    const supply = next.reduce((sum, line) => sum + line.supply, 0);
    return { lines: next, result: vatBreakdown(supply, false) };
  }, [category, sku, qty, width, height, round, cube, row, lot, bannerPrint, stand]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickCategory(c)}
              className={`h-10 rounded-full px-3.5 text-sm transition-colors duration-150 ${
                category === c
                  ? "bg-primary text-primary-fg"
                  : "bg-elevated text-muted shadow-[var(--shadow-border)] hover:text-fg"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="sku">품목</Label>
            <NativeSelect id="sku" value={sku} onChange={(e) => setSku(e.target.value)}>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.spec} · {won(r.supply)}
                  {isLotPrice(r.minQty, r.unit) ? `/${r.minQtyLabel}` : `/${r.unit}`}
                </option>
              ))}
            </NativeSelect>
          </div>
          {sized ? (
            <>
              <div>
                <Label htmlFor="w">가로 cm</Label>
                <Input
                  id="w"
                  type="number"
                  min={1}
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="h">세로 cm</Label>
                <Input
                  id="h"
                  type="number"
                  min={1}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </div>
            </>
          ) : null}
          <div>
            <Label htmlFor="qty">{lot ? "건수" : "수량"}</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
            />
            {lot && row ? (
              <p className="mt-1 text-[12px] text-muted">
                1건 = 시안 1종 (최소 {row.minQtyLabel}). 400매여도 1건입니다.
              </p>
            ) : null}
          </div>
          {category === "명함" ? (
            <label className="flex h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={round}
                onChange={(e) => setRound(e.target.checked)}
              />
              귀도리 +5,000원
            </label>
          ) : null}
          {bannerPrint ? (
            <div>
              <Label htmlFor="stand">거치대</Label>
              <NativeSelect
                id="stand"
                value={standId}
                onChange={(e) => setStandId(e.target.value as StandId)}
              >
                <option value="none">없음</option>
                <option value="xb-in">실내 · {won(20_000)}</option>
                <option value="xb-out">실외(물통) · {won(35_000)}</option>
              </NativeSelect>
              <p className="mt-1 text-[12px] text-muted">넣으면 오른쪽 계산 목록에 줄이 생깁니다.</p>
            </div>
          ) : null}
          {category === "현수막" ? (
            <div>
              <Label htmlFor="cube">압축큐방 개수</Label>
              <Input
                id="cube"
                type="number"
                min={0}
                value={cube}
                onChange={(e) => setCube(Math.max(0, Number(e.target.value) || 0))}
              />
              <p className="mt-1 text-[12px] text-muted">작은 큐방은 무료. 압축 3,300원(VAT포함)/개</p>
            </div>
          ) : null}
        </div>
        {row?.note ? <p className="text-[13px] text-muted">{row.note}</p> : null}
        {sku === "ban-m2" ? (
          <p className="text-[13px] text-muted">
            {width}×{height}cm = {areaM2(width, height).toFixed(2)}㎡ × 10,000원
          </p>
        ) : null}
      </div>

      <aside className="rounded-[var(--radius-lg)] bg-primary p-4 text-primary-fg">
        <p className="text-[12px] tracking-wide text-primary-fg/75">계산 목록</p>
        <ul className="mt-2 space-y-1.5 text-sm text-primary-fg/90">
          {lines.map((line) => (
            <li key={line.label} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{line.label}</span>
              <span className="shrink-0 tabular-nums">{won(line.supply)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] tracking-wide text-primary-fg/75">공급가액</p>
        <p className="font-display text-2xl font-bold tabular-nums">{won(result.supply)}</p>
        <div className="mt-3 space-y-1 text-sm text-primary-fg/85">
          <div className="flex justify-between">
            <span>부가세</span>
            <span className="tabular-nums">{won(result.vat)}</span>
          </div>
          <div className="flex justify-between font-semibold text-primary-fg">
            <span>합계</span>
            <span className="tabular-nums">{won(result.total)}</span>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-primary-fg/70">
          표에 없으면 바로 답하지 말고 매입단가 확인 후 다시 연락합니다. 입금 확인 후 제작에 들어갑니다.
        </p>
      </aside>
    </div>
  );
}

export function PriceTable({ rows }: { rows: CatalogRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="bg-primary text-primary-fg">
            <th className="px-3 py-2 text-left font-medium">종류</th>
            <th className="px-3 py-2 text-left font-medium">규격</th>
            <th className="px-3 py-2 text-right font-medium">최소</th>
            <th className="px-3 py-2 text-right font-medium">공급가</th>
            <th className="px-3 py-2 text-right font-medium">VAT포함</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const tax = vatBreakdown(r.supply, Boolean(r.vatIncluded));
            return (
              <tr key={r.id} className="border-b border-border">
                <td className="px-3 py-2.5 font-medium">{r.name}</td>
                <td className="px-3 py-2.5 text-muted">{r.spec}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{r.minQtyLabel}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{won(r.supply)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{won(tax.total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
