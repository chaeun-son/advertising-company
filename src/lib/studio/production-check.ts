import { uid } from "./geom";
import { focusIsCropped, imageDimensions } from "./image-fit";
import type { Brief, Draft, ImageLayer, Layer, TextLayer } from "./types";

export type FixId =
  | "add-name"
  | "add-headline"
  | "add-subhead"
  | "add-phone"
  | "add-date"
  | "add-price"
  | "fix-phone"
  | "grow-small"
  | "safe-text"
  | "separate-text"
  | "separate-photo"
  | "inset-photo"
  | "boost-contrast"
  | "contain-photo"
  | "fix-logo"
  | "limit-scale";

export type ReviewRow = {
  id: string;
  ok: boolean;
  text: string;
  fix?: FixId;
};

const SAFE = 0.045;

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function norm(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function joined(draft: Draft) {
  return draft.layers.filter((layer): layer is TextLayer => layer.type === "text").map((layer) => layer.text).join("\n");
}

function hasText(draft: Draft, value: string) {
  const needle = norm(value);
  if (!needle) return true;
  return norm(joined(draft)).includes(needle);
}

function texts(draft: Draft) {
  return draft.layers.filter((layer): layer is TextLayer => layer.type === "text" && !layer.hidden);
}

function photos(draft: Draft) {
  return draft.layers.filter((layer): layer is ImageLayer => layer.type === "image" && layer.role === "photo" && !layer.hidden);
}

function luma(hex: string) {
  const match = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: number, b: number) {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

function outsideSafe(layer: { x: number; y: number; w: number; h: number }, draft: Draft) {
  const m = Math.min(draft.width, draft.height) * SAFE;
  return layer.x < m || layer.y < m || layer.x + layer.w > draft.width - m || layer.y + layer.h > draft.height - m;
}

export function reviewDraft(draft: Draft, brief: Brief): ReviewRow[] {
  const rows: ReviewRow[] = [];
  const body = joined(draft);
  const fields: { id: FixId; label: string; value: string }[] = [
    { id: "add-name", label: "상호명", value: brief.name },
    { id: "add-headline", label: "메인문구", value: brief.headline },
    { id: "add-subhead", label: "보조문구", value: brief.subhead },
    { id: "add-phone", label: "전화번호", value: brief.phone },
    { id: "add-date", label: "날짜", value: brief.date },
    { id: "add-price", label: "가격·행사정보", value: brief.price },
  ];
  const missing = fields.filter((field) => field.value.trim() && !hasText(draft, field.value));
  const noteDate = brief.notes.match(/\d{1,2}\s*월\s*\d{1,2}\s*일(?:까지)?/);
  if (noteDate && !norm(body).includes(norm(noteDate[0]))) {
    missing.push({ id: "add-date", label: "주문 문구", value: noteDate[0] });
  }
  if (!missing.length) rows.push({ id: "order", ok: true, text: "주문내용 일치" });
  for (const field of missing) {
    rows.push({ id: field.id + field.value, ok: false, text: `주문내용의 “${field.value}” 문구가 시안에 없습니다.`, fix: field.id });
  }

  const phoneLayer = texts(draft).find((layer) => layer.role === "phone");
  const briefDigits = digits(brief.phone);
  const draftDigits = digits(body);
  if (briefDigits && draftDigits && !draftDigits.includes(briefDigits)) {
    rows.push({ id: "phone-typo", ok: false, text: "전화번호 숫자가 주문내용과 다릅니다.", fix: "fix-phone" });
  } else if (brief.phone.trim()) {
    rows.push({ id: "phone-ok", ok: true, text: "전화번호 숫자 일치" });
  }

  const minSide = Math.min(draft.width, draft.height);
  const small = texts(draft).filter((layer) => layer.fontSize < minSide * (layer.role === "headline" ? 0.07 : 0.028));
  if (phoneLayer && phoneLayer.fontSize < minSide * 0.03) {
    rows.push({ id: "phone-small", ok: false, text: "전화번호가 너무 작습니다.", fix: "grow-small" });
  } else if (small.length) {
    rows.push({ id: "small", ok: false, text: "너무 작은 글자가 있습니다.", fix: "grow-small" });
  } else if (texts(draft).length) {
    rows.push({ id: "size-ok", ok: true, text: "글자 크기 적합" });
  }

  const unsafe = [...texts(draft), ...photos(draft)].filter((layer) => outsideSafe(layer, draft));
  if (unsafe.length) rows.push({ id: "safe", ok: false, text: "글자나 사진이 안전영역 밖으로 나갔습니다.", fix: "safe-text" });
  else rows.push({ id: "safe", ok: true, text: "안전영역 정상" });

  let overlap = false;
  const list = texts(draft);
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const area = intersects(list[i], list[j]);
      const minArea = Math.min(list[i].w * list[i].h, list[j].w * list[j].h);
      if (minArea > 0 && area / minArea > 0.22) overlap = true;
    }
  }
  if (overlap) rows.push({ id: "text-overlap", ok: false, text: "글자끼리 겹칩니다.", fix: "separate-text" });

  const photoHit = photos(draft).some((photo) => list.some((text) => {
    const area = intersects(photo, text);
    return text.w * text.h > 0 && area / (text.w * text.h) > 0.35;
  }));
  if (photoHit) rows.push({ id: "photo-text", ok: false, text: "이미지와 글자가 부자연스럽게 겹칩니다.", fix: "separate-photo" });

  const nearEdge = photos(draft).some((photo) => photo.x < draft.width * 0.02 || photo.y < draft.height * 0.02 || photo.x + photo.w > draft.width * 0.98 || photo.y + photo.h > draft.height * 0.98);
  if (nearEdge) rows.push({ id: "edge", ok: false, text: "사진이 재단영역과 너무 가깝습니다.", fix: "inset-photo" });

  const bg = luma(draft.palette.bg) ?? luma(brief.baseColor) ?? 1;
  const weak = texts(draft).filter((layer) => {
    const ink = luma(layer.fill);
    return ink !== null && contrast(ink, bg) < 2.4;
  });
  if (weak.length) rows.push({ id: "contrast", ok: false, text: "배경과 글자의 명도 대비가 낮습니다.", fix: "boost-contrast" });
  else if (texts(draft).length) rows.push({ id: "contrast", ok: true, text: "글자 대비 적합" });

  let lowRes = false;
  let overscaled = false;
  for (const image of draft.layers.filter((layer): layer is ImageLayer => layer.type === "image" && layer.role !== "background")) {
    const size = imageDimensions(image);
    if (!size) continue;
    const need = image.w / 25.4 * 80;
    if (size.width < need * 0.85) lowRes = true;
    const cover = image.fit !== "contain" && image.fit !== "responsive";
    if (cover && Math.max(image.w / size.width, image.h / size.height) > 2.4) overscaled = true;
    if (image.role === "logo" && size.width && size.height) {
      const target = size.width / size.height;
      const current = image.w / Math.max(1, image.h);
      if (Math.abs(current - target) / target > 0.12) {
        rows.push({ id: `logo-${image.id}`, ok: false, text: "로고 비율이 변형되었습니다.", fix: "fix-logo" });
      }
    }
    if (image.role === "photo" && image.focus && focusIsCropped(image, size.width, size.height)) {
      rows.push({ id: `crop-${image.id}`, ok: false, text: "중요 피사체가 잘릴 수 있습니다.", fix: "contain-photo" });
    }
  }
  if (lowRes) rows.push({ id: "resolution", ok: false, text: "이미지 해상도가 출력 크기에 부족합니다.", fix: "limit-scale" });
  else rows.push({ id: "resolution", ok: true, text: "이미지 해상도 적합" });
  if (overscaled) rows.push({ id: "scale", ok: false, text: "이미지가 너무 확대되어 화질이 떨어질 수 있습니다.", fix: "limit-scale" });

  if (list.length) {
    const left = Math.min(...list.map((layer) => layer.x));
    const right = Math.max(...list.map((layer) => layer.x + layer.w));
    const boxCenter = (left + right) / 2;
    if (Math.abs(boxCenter - draft.width / 2) > draft.width * 0.22 && draft.width > draft.height) {
      rows.push({ id: "balance", ok: false, text: "문구 묶음이 한쪽으로 치우쳐 있습니다." });
    } else rows.push({ id: "balance", ok: true, text: "여백과 정렬이 크게 치우치지 않았습니다." });
  }
  return rows;
}

function slot(draft: Draft, role: TextLayer["role"]): TextLayer {
  const sample = texts(draft)[0];
  const margin = Math.min(draft.width, draft.height) * 0.08;
  const wide = draft.width > draft.height * 1.4;
  const y = role === "headline" ? draft.height * 0.28 : role === "subhead" ? draft.height * 0.48 : draft.height * 0.78;
  return {
    id: uid(role),
    type: "text",
    role,
    x: margin,
    y,
    w: draft.width * (wide ? 0.56 : 0.84),
    h: Math.min(draft.height, draft.width) * 0.1,
    text: "",
    fontFamily: sample?.fontFamily ?? "Pretendard",
    fontWeight: role === "headline" ? 800 : 600,
    fontSize: Math.min(draft.height, draft.width) * (role === "headline" ? 0.12 : 0.045),
    fill: sample?.fill ?? draft.palette.text,
    align: "start",
  };
}

function clampInto(layer: Layer, draft: Draft): Layer {
  const m = Math.min(draft.width, draft.height) * SAFE;
  const w = Math.min(layer.w, draft.width - m * 2);
  const h = Math.min(layer.h, draft.height - m * 2);
  return {
    ...layer,
    w,
    h,
    x: Math.min(Math.max(layer.x, m), draft.width - m - w),
    y: Math.min(Math.max(layer.y, m), draft.height - m - h),
  };
}

export function applyProductionFix(draft: Draft, brief: Brief, fix: FixId): Draft {
  let layers = draft.layers.map((layer) => ({ ...layer }));
  const add = (role: TextLayer["role"], text: string) => {
    if (texts({ ...draft, layers }).some((layer) => norm(layer.text).includes(norm(text)))) return;
    layers = [...layers, { ...slot(draft, role), text }];
  };
  if (fix === "add-name") add("name", brief.name);
  if (fix === "add-headline") add("headline", brief.headline);
  if (fix === "add-subhead") add("subhead", brief.subhead);
  if (fix === "add-phone") add("phone", brief.phone);
  if (fix === "add-date") add("date", brief.date || brief.notes.match(/\d{1,2}\s*월\s*\d{1,2}\s*일(?:까지)?/)?.[0] || "");
  if (fix === "add-price") add("price", brief.price);
  if (fix === "fix-phone") {
    layers = layers.map((layer) => layer.type === "text" && layer.role === "phone" ? { ...layer, text: brief.phone } : layer);
    if (!layers.some((layer) => layer.type === "text" && layer.role === "phone")) add("phone", brief.phone);
  }
  if (fix === "grow-small") {
    const minSide = Math.min(draft.width, draft.height);
    layers = layers.map((layer) => {
      if (layer.type !== "text") return layer;
      const floor = minSide * (layer.role === "headline" ? 0.08 : layer.role === "phone" ? 0.04 : 0.032);
      if (layer.fontSize >= floor) return layer;
      const next = floor;
      return { ...layer, fontSize: next, h: Math.max(layer.h, next * 1.25) };
    });
  }
  if (fix === "safe-text" || fix === "inset-photo") {
    layers = layers.map((layer) => {
      if (fix === "inset-photo" && !(layer.type === "image" && layer.role === "photo")) return layer;
      if (fix === "safe-text" && layer.type !== "text" && !(layer.type === "image" && layer.role === "photo")) return layer;
      if (layer.type === "image" && layer.role === "photo" && fix === "inset-photo") {
        const shrink = 0.9;
        const w = layer.w * shrink;
        const h = layer.h * shrink;
        return { ...layer, w, h, x: layer.x + (layer.w - w) / 2, y: layer.y + (layer.h - h) / 2 };
      }
      return clampInto(layer, draft);
    });
  }
  if (fix === "separate-text") {
    const list = layers.filter((layer): layer is TextLayer => layer.type === "text");
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      if (intersects(prev, list[i]) > 0) list[i] = { ...list[i], y: prev.y + prev.h + Math.min(draft.height, draft.width) * 0.02 };
    }
    layers = layers.map((layer) => list.find((item) => item.id === layer.id) ?? layer);
  }
  if (fix === "separate-photo") {
    layers = layers.map((layer) => {
      if (layer.type !== "text") return layer;
      const hit = photos(draft).find((photo) => intersects(photo, layer) / Math.max(1, layer.w * layer.h) > 0.35);
      if (!hit) return layer;
      const below = hit.y + hit.h + 8;
      if (below + layer.h < draft.height * 0.96) return { ...layer, y: below };
      return { ...layer, x: Math.min(draft.width * 0.08, hit.x) };
    });
  }
  if (fix === "boost-contrast") {
    const bg = luma(draft.palette.bg) ?? 1;
    const ink = bg > 0.6 ? "#1c150e" : "#fffdf8";
    layers = layers.map((layer) => {
      if (layer.type !== "text") return layer;
      const inkLuma = luma(layer.fill);
      if (inkLuma !== null && contrast(inkLuma, bg) >= 2.4) return layer;
      return { ...layer, fill: ink };
    });
  }
  if (fix === "contain-photo") {
    layers = layers.map((layer) => layer.type === "image" && layer.role === "photo" ? { ...layer, fit: "contain" } : layer);
  }
  if (fix === "fix-logo") {
    layers = layers.map((layer) => {
      if (layer.type !== "image" || layer.role !== "logo") return layer;
      const size = imageDimensions(layer);
      if (!size) return { ...layer, scaleX: 1, scaleY: 1 };
      return { ...layer, scaleX: 1, scaleY: 1, h: layer.w * (size.height / size.width) };
    });
  }
  if (fix === "limit-scale") {
    layers = layers.map((layer) => {
      if (layer.type !== "image" || layer.role === "background") return layer;
      const size = imageDimensions(layer);
      if (!size) return layer;
      const maxW = size.width / 80 * 25.4;
      if (layer.w <= maxW) return layer;
      const scale = maxW / layer.w;
      return { ...layer, w: layer.w * scale, h: layer.h * scale, fit: "contain" };
    });
  }
  return { ...draft, layers };
}
