import type {
  Emphasize,
  Industry,
  Mood,
  Palette,
  ProductKind,
  SizePreset,
} from "./types";

export const KIND_LABEL: Record<ProductKind, string> = {
  banner: "현수막",
  zoom: "줌배경",
  web: "배너",
  card: "명함",
  flyer: "전단",
  sticker: "스티커",
  custom: "직접지정",
};

export const SIZES: SizePreset[] = [
  { id: "banner-200x60", kind: "banner", label: "200×60", note: "가장 많이 쓰는 가로 현수막 (2m×0.6m)", wMm: 2000, hMm: 600 },
  { id: "banner-150x50", kind: "banner", label: "150×50", note: "짧은 점두 현수막", wMm: 1500, hMm: 500 },
  { id: "banner-250x80", kind: "banner", label: "250×80", wMm: 2500, hMm: 800 },
  { id: "banner-300x60", kind: "banner", label: "300×60", wMm: 3000, hMm: 600 },
  { id: "banner-400x40", kind: "banner", label: "400×40", note: "가늘고 긴 가로 현수막", wMm: 4000, hMm: 400 },
  { id: "banner-400x70", kind: "banner", label: "400×70", wMm: 4000, hMm: 700 },
  { id: "banner-500x90", kind: "banner", label: "500×90", wMm: 5000, hMm: 900 },
  { id: "banner-100x200", kind: "banner", label: "100×200 세로", note: "세로형 현수막", wMm: 1000, hMm: 2000 },
  { id: "zoom-1920", kind: "zoom", label: "1920×1080", note: "화상회의 배경", wMm: 1920, hMm: 1080 },
  { id: "web-1200", kind: "web", label: "1200×628", note: "SNS · 웹 썸네일", wMm: 1200, hMm: 628 },
  { id: "web-728", kind: "web", label: "728×90", note: "웹 가로 배너", wMm: 728, hMm: 90 },
  { id: "card-90x50", kind: "card", label: "90×50", note: "표준 명함 (mm)", wMm: 90, hMm: 50 },
  { id: "card-50x90", kind: "card", label: "50×90 세로", note: "세로 명함", wMm: 50, hMm: 90 },
  { id: "flyer-a4", kind: "flyer", label: "A4", note: "210×297mm", wMm: 210, hMm: 297 },
  { id: "flyer-a5", kind: "flyer", label: "A5", note: "148×210mm", wMm: 148, hMm: 210 },
  { id: "sticker-80", kind: "sticker", label: "80×80", note: "정사각 스티커", wMm: 80, hMm: 80 },
  { id: "custom", kind: "custom", label: "직접지정", wMm: 2000, hMm: 600 },
];

export const INDUSTRIES: { id: Industry; label: string }[] = [
  { id: "food", label: "음식 · 카페" },
  { id: "shop", label: "매장 · 세일" },
  { id: "realty", label: "부동산 · 분양" },
  { id: "academy", label: "학원 · 교육" },
  { id: "church", label: "교회 · 종교" },
  { id: "hospital", label: "병원 · 약국" },
  { id: "construction", label: "공사 · 안전" },
  { id: "beauty", label: "미용 · 웨딩" },
  { id: "auto", label: "자동차 · 정비" },
  { id: "event", label: "행사 · 축제" },
  { id: "recruit", label: "구인 · 모집" },
  { id: "general", label: "일반 · 기타" },
];

export const PURPOSES = [
  { id: "open", label: "개업 · 오픈" },
  { id: "sale", label: "세일 · 특가" },
  { id: "celebrate", label: "축 · 경조사" },
  { id: "notice", label: "안내 · 공고" },
  { id: "hire", label: "구인" },
  { id: "motto", label: "교회 표어" },
  { id: "menu", label: "전단 · 메뉴" },
  { id: "custom", label: "직접 문구" },
];

export const MOODS: { id: Mood; label: string }[] = [
  { id: "bold", label: "강렬" },
  { id: "urgent", label: "급함" },
  { id: "luxury", label: "고급" },
  { id: "solemn", label: "경건" },
  { id: "warm", label: "따뜻" },
  { id: "friendly", label: "친근" },
  { id: "restrained", label: "절제" },
];

export const EMPHASIS: { id: Emphasize; label: string }[] = [
  { id: "copy", label: "메인 카피" },
  { id: "name", label: "상호" },
  { id: "phone", label: "전화번호" },
  { id: "price", label: "가격 · 혜택" },
  { id: "date", label: "날짜 · 기간" },
];

export const FONTS: { id: string; label: string }[] = [
  { id: "'Noto Sans KR', sans-serif", label: "Noto Sans KR" },
  { id: "'Noto Serif KR', serif", label: "Noto Serif KR" },
  { id: "'Nanum Gothic', sans-serif", label: "나눔고딕" },
  { id: "'Nanum Myeongjo', serif", label: "나눔명조" },
  { id: "'Black Han Sans', sans-serif", label: "검은고딕" },
  { id: "'Do Hyeon', sans-serif", label: "도현" },
  { id: "'Jua', sans-serif", label: "주아" },
  { id: "'Gowun Batang', serif", label: "고운바탕" },
  { id: "'Song Myung', serif", label: "송명" },
  { id: "'Hahmlet', serif", label: "함렛" },
];

export const INDUSTRY_PALETTES: Record<Industry, [Palette, Palette, Palette]> = {
  food: [
    { bg: "#1c1917", panel: "#7c2d12", text: "#fff7ed", muted: "#fdba74", accent: "#ea580c", onAccent: "#fff7ed" },
    { bg: "#fff7ed", panel: "#9a3412", text: "#1c1917", muted: "#7c2d12", accent: "#c2410c", onAccent: "#fff7ed" },
    { bg: "#111827", panel: "#1f2937", text: "#fef3c7", muted: "#fcd34d", accent: "#f59e0b", onAccent: "#111827" },
  ],
  shop: [
    { bg: "#0f172a", panel: "#1e3a5f", text: "#f8fafc", muted: "#cbd5e1", accent: "#38bdf8", onAccent: "#0f172a" },
    { bg: "#f8fafc", panel: "#0f172a", text: "#0f172a", muted: "#334155", accent: "#0369a1", onAccent: "#f8fafc" },
    { bg: "#18181b", panel: "#27272a", text: "#fafafa", muted: "#a1a1aa", accent: "#e4e4e7", onAccent: "#18181b" },
  ],
  realty: [
    { bg: "#0b1f33", panel: "#12324c", text: "#f1f5f9", muted: "#94a3b8", accent: "#38bdf8", onAccent: "#0b1f33" },
    { bg: "#f4f1ea", panel: "#1e3a5f", text: "#1e293b", muted: "#475569", accent: "#0f766e", onAccent: "#f4f1ea" },
    { bg: "#ffffff", panel: "#0f172a", text: "#0f172a", muted: "#334155", accent: "#1d4ed8", onAccent: "#ffffff" },
  ],
  academy: [
    { bg: "#1e3a8a", panel: "#1e40af", text: "#eff6ff", muted: "#bfdbfe", accent: "#fbbf24", onAccent: "#1e3a8a" },
    { bg: "#eff6ff", panel: "#1e3a8a", text: "#1e3a8a", muted: "#1e40af", accent: "#1d4ed8", onAccent: "#eff6ff" },
    { bg: "#0f172a", panel: "#1e293b", text: "#f8fafc", muted: "#93c5fd", accent: "#60a5fa", onAccent: "#0f172a" },
  ],
  church: [
    { bg: "#1c1917", panel: "#44403c", text: "#faf6ef", muted: "#d6d3d1", accent: "#a8a29e", onAccent: "#1c1917" },
    { bg: "#faf6ef", panel: "#44403c", text: "#1c1917", muted: "#57534e", accent: "#7f1d1d", onAccent: "#faf6ef" },
    { bg: "#0c0a09", panel: "#1c1917", text: "#faf6ef", muted: "#a8a29e", accent: "#e7e5e4", onAccent: "#0c0a09" },
  ],
  hospital: [
    { bg: "#0f766e", panel: "#115e59", text: "#f0fdfa", muted: "#99f6e4", accent: "#5eead4", onAccent: "#0f766e" },
    { bg: "#f0fdfa", panel: "#0f766e", text: "#134e4a", muted: "#0f766e", accent: "#0d9488", onAccent: "#f0fdfa" },
    { bg: "#ffffff", panel: "#134e4a", text: "#134e4a", muted: "#3f3f46", accent: "#0f766e", onAccent: "#ffffff" },
  ],
  construction: [
    { bg: "#1c1917", panel: "#292524", text: "#fafaf9", muted: "#e7e5e4", accent: "#facc15", onAccent: "#1c1917" },
    { bg: "#facc15", panel: "#1c1917", text: "#1c1917", muted: "#44403c", accent: "#1c1917", onAccent: "#facc15" },
    { bg: "#292524", panel: "#44403c", text: "#fafaf9", muted: "#d6d3d1", accent: "#f59e0b", onAccent: "#1c1917" },
  ],
  beauty: [
    { bg: "#1c1917", panel: "#44403c", text: "#fdf2f8", muted: "#f9a8d4", accent: "#f472b6", onAccent: "#1c1917" },
    { bg: "#fdf8f6", panel: "#9f1239", text: "#4c0519", muted: "#9f1239", accent: "#be123c", onAccent: "#fdf8f6" },
    { bg: "#fff1f2", panel: "#881337", text: "#881337", muted: "#9f1239", accent: "#e11d48", onAccent: "#fff1f2" },
  ],
  auto: [
    { bg: "#18181b", panel: "#27272a", text: "#fafafa", muted: "#a1a1aa", accent: "#d4d4d8", onAccent: "#18181b" },
    { bg: "#f4f4f5", panel: "#18181b", text: "#18181b", muted: "#3f3f46", accent: "#3b82f6", onAccent: "#f4f4f5" },
    { bg: "#0b1220", panel: "#1e3a5f", text: "#e2e8f0", muted: "#93c5fd", accent: "#60a5fa", onAccent: "#0b1220" },
  ],
  event: [
    { bg: "#14532d", panel: "#166534", text: "#f0fdf4", muted: "#bbf7d0", accent: "#86efac", onAccent: "#14532d" },
    { bg: "#fffbeb", panel: "#166534", text: "#14532d", muted: "#166534", accent: "#15803d", onAccent: "#fffbeb" },
    { bg: "#111827", panel: "#1f2937", text: "#ffffff", muted: "#86efac", accent: "#4ade80", onAccent: "#111827" },
  ],
  recruit: [
    { bg: "#7c2d12", panel: "#9a3412", text: "#fff7ed", muted: "#fed7aa", accent: "#fb923c", onAccent: "#7c2d12" },
    { bg: "#fff7ed", panel: "#9a3412", text: "#7c2d12", muted: "#9a3412", accent: "#c2410c", onAccent: "#fff7ed" },
    { bg: "#1c1917", panel: "#292524", text: "#fff7ed", muted: "#fdba74", accent: "#f97316", onAccent: "#1c1917" },
  ],
  general: [
    { bg: "#18181b", panel: "#27272a", text: "#fafafa", muted: "#a1a1aa", accent: "#e4e4e7", onAccent: "#18181b" },
    { bg: "#f8fafc", panel: "#0f172a", text: "#0f172a", muted: "#334155", accent: "#334155", onAccent: "#f8fafc" },
    { bg: "#0f172a", panel: "#1e293b", text: "#f8fafc", muted: "#cbd5e1", accent: "#38bdf8", onAccent: "#0f172a" },
  ],
};

export function sizeOf(brief: { sizeId: string; customW: number; customH: number }): { w: number; h: number; preset: SizePreset } {
  const preset = SIZES.find((s) => s.id === brief.sizeId) ?? SIZES[0];
  if (preset.id === "custom") {
    return { w: Math.max(40, brief.customW), h: Math.max(40, brief.customH), preset };
  }
  return { w: preset.wMm, h: preset.hMm, preset };
}

export function closestAspectRatio(w: number, h: number): string {
  const ratio = w / h;
  const options: [string, number][] = [
    ["1:1", 1],
    ["16:9", 16 / 9],
    ["9:16", 9 / 16],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
    ["3:2", 3 / 2],
    ["2:3", 2 / 3],
    ["2:1", 2],
    ["1:2", 0.5],
    ["21:9", 21 / 9],
    ["5:2", 2.5],
    ["20:9", 20 / 9],
  ];
  let best = options[0];
  let bestDiff = Infinity;
  for (const opt of options) {
    const diff = Math.abs(Math.log(ratio / opt[1]));
    if (diff < bestDiff) {
      best = opt;
      bestDiff = diff;
    }
  }
  return best[0];
}

export const SAMPLE_BRIEF = {
  industry: "food" as Industry,
  purpose: "open",
  mood: "warm" as Mood,
  emphasize: "copy" as Emphasize,
  name: "성수면옥",
  headline: "성수 본점 오픈",
  subhead: "평양냉면 · 수육 · 만두",
  price: "냉면 12,000원",
  date: "매일 11:00–21:00",
  place: "서울 성동구 연무장길 12",
  phone: "02-499-1200",
  address: "",
  notes: "",
  baseColor: "#1c1917",
  accentColor: "#c2410c",
};
