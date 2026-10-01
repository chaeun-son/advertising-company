import type { Brief, ProductKind } from "./types";

export type OrderItem = {
  kind: ProductKind;
  label: string;
  widthMm: number | null;
  heightMm: number | null;
  quantity: number;
  sizeText: string;
};

export type OrderAnalysis = {
  name: string;
  headline: string;
  subhead: string;
  date: string;
  place: string;
  phone: string;
  items: OrderItem[];
  missing: string[];
  source: string;
};

const PRODUCT_WORDS: Array<{ pattern: RegExp; kind: ProductKind; label: string }> = [
  { pattern: /현수막/, kind: "banner", label: "현수막" },
  { pattern: /(?:줌\s*배경|줌배경|포토월|포토존|백월|배경막|backdrop)/i, kind: "zoom", label: "줌배경" },
  { pattern: /(?:x|엑스)\s*배너/i, kind: "zoom", label: "X배너" },
  { pattern: /(?:리플렛|리플릿|팸플릿|전단)/, kind: "flyer", label: "리플렛·전단" },
  { pattern: /명함/, kind: "card", label: "명함" },
  { pattern: /스티커/, kind: "sticker", label: "스티커" },
  { pattern: /(?:웹|SNS|인스타)\s*(?:배너|이미지)?/i, kind: "web", label: "웹 이미지" },
];

function toMm(value: number, unit: string) {
  const normalized = unit.toLowerCase();
  if (normalized === "cm") return value * 10;
  if (normalized === "m") return value * 1000;
  return value;
}

function inferImplicitUnit(kind: ProductKind, left: number, right: number) {
  if (kind === "banner" || kind === "zoom") {
    const max = Math.max(left, right);
    if (max <= 600) return "cm";
    return "mm";
  }
  if (kind === "web") return "mm";
  return "mm";
}

function findSize(text: string, kind: ProductKind) {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m)?\s*[x×＊*]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)?/i);
  if (!match) return null;
  const left = Number(match[1]);
  const right = Number(match[3]);
  const inferred = inferImplicitUnit(kind, left, right);
  const leftUnit = match[2] || match[4] || inferred;
  const rightUnit = match[4] || match[2] || inferred;
  return {
    widthMm: Math.round(toMm(left, leftUnit)),
    heightMm: Math.round(toMm(right, rightUnit)),
    text: `${Math.round(toMm(left, leftUnit))}×${Math.round(toMm(right, rightUnit))}mm`,
  };
}

function findQuantity(text: string) {
  const match = text.match(/(\d+)\s*(?:장|개|부|매)/);
  return match ? Math.max(1, Number(match[1])) : 1;
}

function isProductLine(line: string) {
  return PRODUCT_WORDS.some((product) => product.pattern.test(line));
}

function isMetaLabelLine(line: string) {
  return /^(?:장소|위치|연락처|전화|주소|납기|사이즈|규격)\s*[:：]/.test(line);
}

function buildCopyCandidates(lines: string[]) {
  return lines
    .map((line) => line.replace(/[-•·]/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !isProductLine(line))
    .filter((line) => !isMetaLabelLine(line))
    .filter((line) => !/(?:\d+\s*(?:장|개|부|매))/.test(line) || /(?:오픈|행사|축제|체육대회|봉사활동|기념|감사|초대|환영|모집|안내)/.test(line));
}

function findHeadline(lines: string[]) {
  const candidates = buildCopyCandidates(lines)
    .filter((line) => !/^\d{1,2}월\s*\d{1,2}일/.test(line))
    .filter((line) => !/(?:^|\s)(?:010|02|0\d{2})[-\s]?\d{3,4}[-\s]?\d{4}/.test(line))
    .filter((line) => !/(?:교회|성당|사찰|학교|유치원|어린이집|병원|의원|센터|협회|재단|위원회|주식회사|회사)$/.test(line.replace(/\s/g, "")));
  return candidates[0]?.replace(/\s*에\s*대한\s*$/g, "").slice(0, 72) ?? "";
}

function findOrganization(lines: string[]) {
  const suffix = /(?:교회|성당|사찰|학교|유치원|어린이집|병원|의원|센터|협회|재단|위원회|주식회사|회사)$/;
  const explicit = lines.find((line) => /^(?:상호|기관명|교회명|학교명|업체명)\s*[:：]/.test(line));
  if (explicit) return explicit.replace(/^[^:：]+[:：]\s*/, "").trim().slice(0, 48);
  return lines
    .map((line) => line.replace(/[-•·]/g, " ").trim())
    .find((line) => suffix.test(line.replace(/\s/g, "")))
    ?.slice(0, 48) ?? "";
}

function findSubhead(lines: string[], headline: string) {
  const candidates = buildCopyCandidates(lines)
    .filter((line) => line !== headline)
    .filter((line) => !isProductLine(line))
    .filter((line) => !/(?:교회|성당|사찰|학교|유치원|어린이집|병원|의원|센터|협회|재단|위원회|주식회사|회사)$/.test(line.replace(/\s/g, "")));
  const dated = candidates.find((line) => /\d{1,2}[.\-/월]\s*\d{1,2}(?:일)?/.test(line));
  const descriptive = candidates.find((line) => line.length >= 6 && line.length <= 64);
  return (dated || descriptive || candidates[0] || "").slice(0, 72);
}

export function analyzeOrder(source: string): OrderAnalysis {
  const clean = source.replace(/\r/g, "").trim();
  const lines = clean.split(/\n|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  const items: OrderItem[] = [];

  for (const line of lines) {
    for (const product of PRODUCT_WORDS) {
      if (!product.pattern.test(line)) continue;
      const size = findSize(line, product.kind);
      items.push({
        kind: product.kind,
        label: product.label,
        widthMm: size?.widthMm ?? null,
        heightMm: size?.heightMm ?? null,
        quantity: findQuantity(line),
        sizeText: size?.text ?? "규격 확인 필요",
      });
    }
  }

  const date = clean.match(/(?:20\d{2}[.\-/년]\s*)?\d{1,2}[.\-/월]\s*\d{1,2}(?:일)?(?:\s*\([월화수목금토일]\))?/)?.[0]?.trim() ?? "";
  const phone = clean.match(/(?:0\d{1,2}[-\s]?)?\d{3,4}[-\s]\d{4}/)?.[0]?.replace(/\s/g, "-") ?? "";
  const explicitPlace = clean.match(/(?:장소|위치)\s*[:：]\s*([^\n,]+)/)?.[1]?.trim();
  const naturalPlace = clean.match(/(?:에서|장소는)\s*([^\n,.]+?)(?:에서|입니다|이고|이며|\s)/)?.[1]?.trim();
  const venue = clean.match(/([가-힣A-Za-z0-9]+(?:체육관|강당|공원|호텔|학교|센터|회관|광장|매장|본점|지점))/)?.[1];
  const place = explicitPlace || naturalPlace || venue || "";
  const name = findOrganization(lines);
  const headline = findHeadline(lines) || clean.match(/([가-힣A-Za-z0-9\s]+(?:체육대회|개업|오픈|행사|축제|봉사활동|기념식))/)?.[1]?.trim() || items[0]?.label || "주문 시안";
  const subhead = findSubhead(lines, headline);

  const missing: string[] = [];
  if (!items.length) missing.push("품목");
  if (items.some((item) => !item.widthMm || !item.heightMm)) missing.push("일부 품목 규격");
  if (!headline) missing.push("대표 문구");

  return { name, headline, subhead, date, place, phone, items, missing, source: clean };
}

export function analysisToBrief(analysis: OrderAnalysis, current: Brief): Partial<Brief> {
  const primary = analysis.items[0];
  return {
    name: analysis.name || "",
    headline: analysis.headline || "",
    subhead: analysis.subhead || "",
    price: "",
    date: "",
    place: "",
    phone: "",
    address: "",
    notes: analysis.source,
    industry: "general",
    purpose: "custom",
    mood: "warm",
    emphasize: "copy",
    sizeId: primary?.widthMm && primary?.heightMm ? "custom" : current.sizeId,
    customW: primary?.widthMm ?? current.customW,
    customH: primary?.heightMm ?? current.customH,
  };
}
