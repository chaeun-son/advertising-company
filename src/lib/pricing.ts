import { CATALOG, PAYMENTS, type CatalogRow, type Payment } from "./catalog";
import type { ProductUnit } from "./types";

export function areaM2(widthCm: number, heightCm: number): number {
  if (widthCm <= 0 || heightCm <= 0) return 0;
  return (widthCm * heightCm) / 10000;
}

export function jaCount(widthCm: number, heightCm: number): number {
  const longer = Math.max(widthCm, heightCm);
  return longer > 0 ? longer / 30 : 0;
}

export function specLabel(widthCm: number, heightCm: number, unit: string): string {
  if (unit === "건" || ((unit === "개" || unit === "건") && widthCm <= 0 && heightCm <= 0)) {
    return widthCm > 0 && heightCm > 0 ? `${widthCm}×${heightCm}cm` : "—";
  }
  if (widthCm <= 0 && heightCm <= 0) return "—";
  return `${widthCm}×${heightCm}cm`;
}

/** 최소수량이 있는 명함·스티커·봉투는 표 금액 = 1건(시안 1종) 단가 */
export function isLotPrice(minQty: number, unit: string): boolean {
  return minQty > 1 && (unit === "개" || unit === "건");
}

export function qtyLabel(minQty: number, unit: string): string {
  if (isLotPrice(minQty, unit)) return "건수";
  return "수량";
}

/** 포맥스는 장당 단가. 가로·세로는 규격일 뿐 면적으로 곱하지 않는다. */
export function isFlatPiece(name: string): boolean {
  return /포맥스|포멕스|폼보드|폼렉스/.test(name);
}

export function lineAmount(input: {
  widthCm: number;
  heightCm: number;
  qty: number;
  unitPrice: number;
  unit: ProductUnit | string;
  rush?: boolean;
  rushRate?: number;
  minQty?: number;
  name?: string;
}): number {
  const qty = Math.max(0, input.qty);
  const price = Math.max(0, input.unitPrice);
  // 가로·세로·㎡·자는 규격만. 금액은 입력한 단가 × 수량.
  return Math.round(price * qty);
}

export function vatBreakdown(
  supplyAmount: number,
  vatIncluded: boolean,
): { supply: number; vat: number; total: number } {
  if (vatIncluded) {
    const supply = Math.round(supplyAmount / 1.1);
    const vat = supplyAmount - supply;
    return { supply, vat, total: supplyAmount };
  }
  const vat = Math.round(supplyAmount * 0.1);
  return { supply: supplyAmount, vat, total: supplyAmount + vat };
}

export function won(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export function wonNum(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

export function inferColorMode(name: string): string {
  if (name.includes("양면") || name.includes("8도")) return "8도";
  if (name.includes("단면") || name.includes("4도")) return "4도";
  if (name.includes("흑백")) return "1도";
  if (name.includes("컬러")) return "4도";
  return "4도";
}

/** 줄 단가: 직접 넣은 값이 있으면 그대로, 없으면 카탈로그(급행이면 배수) */
export function chargedUnitPrice(
  catalog: number,
  override: number | null | undefined,
  rush: boolean,
  rushRate: number,
): number {
  if (override != null && Number.isFinite(override)) return Math.max(0, Math.round(override));
  const base = Math.max(0, catalog);
  return rush ? Math.round(base * rushRate) : base;
}

/** 현수막: 최소 500×90 이하 25,000 / 게릴라 500·600×90 25,000 / 그 외 ㎡당 10,000 */
export function quoteBanner(widthCm: number, heightCm: number, guerrilla: boolean) {
  const w = Math.max(widthCm, heightCm);
  const h = Math.min(widthCm, heightCm);
  if (guerrilla && h <= 90 && w <= 600) return vatBreakdown(25_000, false);
  if (w <= 500 && h <= 90) return vatBreakdown(25_000, false);
  const m2 = areaM2(widthCm, heightCm);
  return vatBreakdown(Math.round(m2 * 10_000), false);
}

export function quoteRow(row: CatalogRow, qty = 1, widthCm = 0, heightCm = 0) {
  const count = Math.max(0, qty);
  let amount = row.supply * count;
  if (row.unit === "㎡") amount = areaM2(widthCm, heightCm) * row.supply * count;
  const tax = vatBreakdown(Math.round(amount), Boolean(row.vatIncluded));
  const belowMin = qty < row.minQty;
  return { ...tax, belowMin, minQty: row.minQty };
}

export function findCatalog(id: string): CatalogRow | undefined {
  return CATALOG.find((r) => r.id === id);
}

export function packOrderNotes(payment: string, delivery: string, notes: string) {
  const head = [`결제 ${payment || "현금"}`, delivery ? `납품 ${delivery}` : ""]
    .filter(Boolean)
    .join(" · ");
  const body = notes.trim();
  return body ? `${head}\n${body}` : head;
}

export function unpackOrderNotes(raw: string): {
  payment: Payment;
  delivery: string;
  notes: string;
} {
  const text = raw ?? "";
  const lines = text.split("\n");
  const first = lines[0] ?? "";
  const payMatch = first.match(/결제\s+(현금|세금계산서|카드결제|계좌이체)/);
  const delMatch = first.match(/납품\s+([^·\n]+)/);
  const found = payMatch?.[1];
  const payment: Payment = PAYMENTS.includes(found as Payment) ? (found as Payment) : "현금";
  const delivery = delMatch?.[1]?.trim() ?? "";
  const notes = first.startsWith("결제") ? lines.slice(1).join("\n").trim() : text;
  return { payment, delivery, notes };
}
