import { INDUSTRY_PALETTES } from "./catalog";
import { aiTextLayout } from "./ai-layout";
import type {
  Align,
  Brief,
  Draft,
  Layer,
  Palette,
  TextLayer,
  TextZone,
} from "./types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function chars(text: string) {
  return [...text].length || 1;
}

function fitSize(text: string, boxW: number, boxH: number, max: number, min: number) {
  const c = chars(text);
  const byW = (boxW / c) * 0.92;
  const byH = boxH * 0.72;
  return Math.max(min, Math.min(max, byW, byH));
}

function wrap(text: string, maxChars: number): string[] {
  const t = text.trim();
  if (!t) return [];
  if (chars(t) <= maxChars) return [t];
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (chars(next) > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length === 1 && chars(lines[0]) > maxChars) {
    const s = lines[0];
    const mid = Math.ceil(chars(s) / 2);
    const arr = [...s];
    return [arr.slice(0, mid).join(""), arr.slice(mid).join("")];
  }
  return lines.slice(0, 3);
}

function textLayer(
  role: TextLayer["role"],
  text: string,
  box: { x: number; y: number; w: number; h: number },
  opts: {
    fill: string;
    fontFamily: string;
    fontWeight?: number;
    align?: Align;
    max?: number;
    min?: number;
    letterSpacing?: number;
  },
): TextLayer | null {
  const value = text.trim();
  if (!value) return null;
  const fontSize = fitSize(value, box.w, box.h, opts.max ?? box.h * 0.8, opts.min ?? 10);
  return {
    id: uid(role),
    type: "text",
    role,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    text: value,
    fontFamily: opts.fontFamily,
    fontWeight: opts.fontWeight ?? 700,
    fontSize,
    fill: opts.fill,
    align: opts.align ?? "start",
    letterSpacing: opts.letterSpacing,
  };
}

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  extra?: { radius?: number; opacity?: number },
): Layer {
  return { id: uid("rect"), type: "rect", x, y, w, h, fill, ...extra };
}

function safeMargin(w: number, h: number) {
  return Math.max(12, Math.min(w, h) * 0.06);
}

type Ctx = {
  w: number;
  h: number;
  m: number;
  brief: Brief;
  pal: Palette;
  title: string;
  body: string;
};

function stackInfo(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, muted: string): Layer[] {
  const copy = ctx.brief.subhead.trim();
  if (!copy) return [];
  const boxH = Math.min(h, ctx.h * 0.18);
  const layer = textLayer("subhead", copy, { x, y, w, h: boxH }, {
    fill: muted,
    fontFamily: ctx.body,
    fontWeight: 600,
    max: Math.min(boxH * 0.72, w * 0.12, ctx.h * 0.08),
    min: 10,
  });
  return layer ? [layer] : [];
}

function logoIfAny(ctx: Ctx, x: number, y: number, size: number): Layer[] {
  if (!ctx.brief.logoDataUrl) return [];
  return [
    {
      id: uid("logo"),
      type: "image",
      x,
      y,
      w: size,
      h: size,
      href: ctx.brief.logoDataUrl,
      fit: "contain",
    },
  ];
}

function photoIfAny(ctx: Ctx, x: number, y: number, w: number, h: number): Layer[] {
  if (!ctx.brief.photoDataUrl) return [];
  return [
    {
      id: uid("photo"),
      type: "image",
      x,
      y,
      w,
      h,
      href: ctx.brief.photoDataUrl,
      fit: "contain",
      backgroundFill: ctx.pal ? ctx.pal.bg : "#ffffff",
    },
  ];
}

/** A — full-bleed color, headline hero */
function layoutHero(ctx: Ctx): Layer[] {
  const { w, h, m, brief, pal } = ctx;
  const layers: Layer[] = [rect(0, 0, w, h, pal.bg)];
  const wide = w / h > 2.1;
  // 브랜드 리본과 얇은 포인트 바를 넣어 빈 와이어프레임처럼 보이지 않게 한다.
  layers.push(rect(0, 0, Math.max(w * 0.012, 8), h, pal.accent));
  layers.push(rect(w * 0.78, h * 0.82, w * 0.22, h * 0.18, pal.accent, { opacity: 0.16 }));
  const bandH = h * (wide ? 0.2 : 0.22);
  layers.push(rect(0, 0, w, bandH, pal.panel));
  layers.push(...logoIfAny(ctx, w - m - h * 0.16, m * 0.4, h * 0.14));

  if (wide) {
    const headBox = { x: m, y: bandH + m * 0.35, w: w * 0.62 - m, h: h - bandH - m * 1.2 };
    const lines = wrap(brief.headline, Math.max(6, Math.floor(headBox.w / (headBox.h * 0.28))));
    const lineH = headBox.h / Math.max(1, lines.length);
    lines.forEach((line, i) => {
      const t = textLayer("headline", line, { x: headBox.x, y: headBox.y + i * lineH, w: headBox.w, h: lineH }, {
        fill: pal.text,
        fontFamily: ctx.title,
        fontWeight: 400,
        max: lineH * 0.92,
        min: 16,
      });
      if (t) layers.push(t);
    });
    const ix = w * 0.64;
    const iw = w - ix - m;
    layers.push(rect(ix - m * 0.3, bandH, w - ix + m * 0.3, h - bandH, pal.panel, { opacity: 0.35 }));
    layers.push(...stackInfo(ctx, ix, bandH + m * 0.5, iw, h - bandH - m, pal.accent, pal.muted));
    return layers;
  }

  const headBox = { x: m, y: bandH + m * 0.4, w: w - m * 2, h: h * 0.42 };
  const lines = wrap(brief.headline, Math.max(8, Math.floor((w - m * 2) / (h * 0.18))));
  const lineH = headBox.h / Math.max(1, lines.length);
  lines.forEach((line, i) => {
    const t = textLayer("headline", line, { x: headBox.x, y: headBox.y + i * lineH, w: headBox.w, h: lineH }, {
      fill: pal.text,
      fontFamily: ctx.title,
      fontWeight: 400,
      max: lineH * 0.9,
      min: 16,
    });
    if (t) layers.push(t);
  });
  const infoY = bandH + h * 0.46;
  layers.push(...stackInfo(ctx, m, infoY, w - m * 2, h - infoY - m, pal.accent, pal.muted));
  return layers;
}

/** B — split panel */
function layoutSplit(ctx: Ctx): Layer[] {
  const { w, h, m, brief, pal } = ctx;
  const layers: Layer[] = [rect(0, 0, w, h, pal.bg)];
  // B안은 명확한 2단 분할과 포인트 라인으로 A안과 시각적으로 구분한다.
  layers.push(rect(0, h * 0.92, w, h * 0.08, pal.accent));
  const portrait = h > w * 1.05;
  if (portrait) {
    const top = h * 0.42;
    layers.push(rect(0, 0, w, top, pal.panel));
    const photos = photoIfAny(ctx, 0, 0, w, top);
    if (photos.length) layers.push(...photos);
    else {
      const head = textLayer("headline", brief.headline, { x: m, y: m, w: w - m * 2, h: top - m * 2 }, {
        fill: pal.onAccent,
        fontFamily: ctx.title,
        max: top * 0.28,
      });
      if (head) {
        head.fill = pal.text;
        layers.push(head);
      }
    }
    layers.push(...stackInfo(ctx, m, top + h * 0.16, w - m * 2, h - top - h * 0.16 - m, pal.accent, pal.muted));
    return layers;
  }

  const left = w * 0.42;
  layers.push(rect(0, 0, left, h, pal.panel));
  const photos = photoIfAny(ctx, 0, 0, left, h);
  if (photos.length) {
    layers.push(...photos);
  } else {
    const head = textLayer("headline", brief.headline, { x: m, y: m, w: left - m * 2, h: h - m * 2 }, {
      fill: pal.onAccent,
      fontFamily: ctx.title,
      max: Math.min(h * 0.22, (left - m * 2) * 0.28),
    });
    if (head) layers.push(head);
  }
  if (photos.length) {
    const lines = wrap(brief.headline, Math.max(6, Math.floor((w - left - m * 2) / (h * 0.16))));
    const headH = h * 0.4;
    const lineH = headH / Math.max(1, lines.length);
    lines.forEach((line, i) => {
      const t = textLayer("headline", line, { x: left + m, y: h * 0.12 + i * lineH, w: w - left - m * 2, h: lineH }, {
        fill: pal.text,
        fontFamily: ctx.title,
        max: lineH * 0.9,
      });
      if (t) layers.push(t);
    });
    layers.push(...stackInfo(ctx, left + m, h * 0.56, w - left - m * 2, h * 0.28, pal.accent, pal.muted));
  } else {
    layers.push(...stackInfo(ctx, left + m, h * 0.22, w - left - m * 2, h * 0.22, pal.accent, pal.muted));
  }
  layers.push(...logoIfAny(ctx, m, m, Math.min(left * 0.3, h * 0.2)));
  return layers;
}

/** C — accent frame, centered */
function layoutCenter(ctx: Ctx): Layer[] {
  const { w, h, m, brief, pal } = ctx;
  const layers: Layer[] = [rect(0, 0, w, h, pal.bg)];
  const inset = m * 0.7;
  layers.push(rect(inset, inset, w - inset * 2, h - inset * 2, pal.panel, { radius: Math.min(w, h) * 0.02 }));
  const inner = inset + m * 0.5;
  const iw = w - inner * 2;
  const lines = wrap(brief.headline, Math.max(8, Math.floor(iw / (h * 0.14))));
  const headH = h * 0.36;
  const lineH = headH / Math.max(1, lines.length);
  lines.forEach((line, i) => {
    const t = textLayer("headline", line, { x: inner, y: h * 0.16 + i * lineH, w: iw, h: lineH }, {
      fill: pal.text,
      fontFamily: ctx.title,
      align: "middle",
      max: lineH * 0.88,
    });
    if (t) layers.push(t);
  });
  layers.push(...stackInfo(ctx, inner, h * 0.58, iw, h * 0.18, pal.accent, pal.muted).map((l) => {
    if (l.type === "text") l.align = "middle";
    return l;
  }));
  return layers;
}

/** Price / phone / date hero depending on emphasize */
function layoutEmphasize(ctx: Ctx): Layer[] {
  const { w, h, m, brief, pal } = ctx;
  const layers: Layer[] = [rect(0, 0, w, h, pal.bg)];
  // C안은 강조 정보가 한눈에 들어오는 포스터형 구성을 사용한다.
  layers.push(rect(0, 0, w, h * 0.055, pal.accent));
  layers.push(rect(w * 0.04, h * 0.12, w * 0.012, h * 0.72, pal.accent));
  const focus = brief.headline;
  const role: TextLayer["role"] = "headline";
  const wide = w / h > 2.1;

  if (wide) {
    layers.push(rect(w * 0.62, 0, w * 0.38, h, pal.panel));
    const hero = textLayer(role, focus, { x: m, y: m, w: w * 0.58 - m, h: h * 0.62 }, {
      fill: pal.text,
      fontFamily: ctx.title,
      max: h * 0.42,
      min: 18,
    });
    if (hero) layers.push(hero);
    const secondary = brief.subhead || brief.headline;
    const secRole: TextLayer["role"] = brief.subhead ? "subhead" : "headline";
    const sec = textLayer(secRole, secondary, { x: m, y: h * 0.7, w: w * 0.58 - m, h: h * 0.22 }, {
      fill: pal.muted,
      fontFamily: ctx.body,
      fontWeight: 800,
      max: h * 0.12,
    });
    if (sec) layers.push(sec);
    layers.push(...stackInfo(ctx, w * 0.64, m, w * 0.36 - m, h - m * 2, pal.accent, pal.text));
    return layers;
  }

  layers.push(rect(0, h * 0.62, w, h * 0.38, pal.panel));
  const hero = textLayer(role, focus, { x: m, y: m, w: w - m * 2, h: h * 0.48 }, {
    fill: pal.text,
    fontFamily: ctx.title,
    max: h * 0.36,
    min: 18,
  });
  if (hero) layers.push(hero);

  const secondary = brief.subhead || brief.headline;
  const secRole: TextLayer["role"] = brief.subhead ? "subhead" : "headline";
  const sec = textLayer(secRole, secondary, { x: m, y: h * 0.64, w: w - m * 2, h: h * 0.14 }, {
    fill: pal.text,
    fontFamily: ctx.body,
    fontWeight: 800,
    max: h * 0.1,
  });
  if (sec) layers.push(sec);
  layers.push(...stackInfo(ctx, m, h * 0.78, w - m * 2, h * 0.22 - m, pal.accent, pal.muted));
  return layers;
}

function applyCustomerColors(pal: Palette, brief: Brief, index: number): Palette {
  if (index !== 0) return pal;
  return {
    ...pal,
    bg: brief.baseColor || pal.bg,
    accent: brief.accentColor || pal.accent,
    panel: brief.accentColor || pal.panel,
  };
}

export function composeTypeDrafts(brief: Brief, width: number, height: number): Draft[] {
  const palettes = INDUSTRY_PALETTES[brief.industry];
  const builders = [layoutHero, layoutSplit, layoutEmphasize];
  const titles = ["브랜드 리본 · 대형 카피", "투톤 분할 · 정보 패널", "포스터형 · 핵심 정보 강조"];
  const letters: Array<"A" | "B" | "C"> = ["A", "B", "C"];

  return builders.map((build, i) => {
    const pal = applyCustomerColors(palettes[i], brief, i);
    const ctx: Ctx = {
      w: width,
      h: height,
      m: safeMargin(width, height),
      brief,
      pal,
      title: brief.titleFont,
      body: brief.bodyFont,
    };
    let layers = build(ctx);
    if (i === 1 && height > width * 1.05) {
      layers = layoutCenter(ctx);
      titles[1] = "중앙 표어";
    }
    return {
      id: `type-${letters[i]}-${Date.now()}`,
      letter: letters[i],
      title: titles[i],
      source: "type" as const,
      width,
      height,
      layers,
      palette: pal,
    };
  });
}

export function composeAiDraft(
  brief: Brief,
  width: number,
  height: number,
  letter: "A" | "B" | "C",
  title: string,
  pal: Palette,
  image: string,
  prompt: string,
  zone: TextZone,
): Draft {
  const m = safeMargin(width, height);
  const layers: Layer[] = [
    {
      id: uid("ai-bg"),
      type: "image",
      role: "background",
      x: 0,
      y: 0,
      w: width,
      h: height,
      href: image,
      fit: "cover",
      backgroundFill: pal.bg,
    },
  ];

  const textArea = aiTextLayout(width, height, zone, letter);
  const scrim = { x: textArea.x, y: textArea.y, w: textArea.w, h: textArea.h };

  // 긴 현수막은 중앙의 선명한 이미지를 가리지 않고 좌우 확장 영역을 문구 공간으로 쓴다.
  // 일반 비율에서도 불투명 패널 대신 아주 약한 대비 보조만 사용한다.
  layers.push(rect(scrim.x, scrim.y, scrim.w, scrim.h, pal.bg, { opacity: width / height >= 3 ? 0.04 : 0.08 }));

  const pad = width / height >= 3 ? Math.max(m * 0.45, height * 0.025) : m * 0.8;
  const tx = scrim.x + pad;
  const ty = scrim.y + pad;
  const tw = Math.max(20, scrim.w - pad * 2);
  const th = Math.max(20, scrim.h - pad * 2);
  const ctx: Ctx = { w: width, h: height, m, brief, pal, title: brief.titleFont, body: brief.bodyFont };

  // AI 시안은 주문내용에서 뽑은 핵심 문구만 사용한다.
  // 상호/가격/날짜/연락처 같은 개별 입력항목은 따로 깔지 않는다.
  const headlineTop = ty + th * (textArea.compact ? 0.02 : 0.1);
  const headlineH = th * (textArea.compact ? 0.48 : 0.38);
  const headlineLines = wrap(brief.headline, Math.max(8, Math.floor(tw / (th * 0.13)))).slice(0, 2);
  const lineH = headlineH / Math.max(1, headlineLines.length);
  headlineLines.forEach((line, i) => {
    const t = textLayer("headline", line, { x: tx, y: headlineTop + i * lineH, w: tw, h: lineH * 0.95 }, {
      fill: pal.text,
      fontFamily: ctx.title,
      fontWeight: 800,
      align: textArea.align,
      max: lineH * (textArea.compact ? 0.66 : 0.78),
      min: 16,
    });
    if (t) layers.push(t);
  });

  const subhead = textLayer("subhead", brief.subhead, { x: tx, y: ty + th * (textArea.compact ? 0.56 : 0.58), w: tw, h: th * (textArea.compact ? 0.24 : 0.16) }, {
    fill: pal.muted,
    fontFamily: ctx.body,
    fontWeight: 600,
    align: textArea.align,
    max: th * (textArea.compact ? 0.06 : 0.075),
  });
  if (subhead) layers.push(subhead);

  layers.push(...logoIfAny(ctx, scrim.x + scrim.w - pad - th * 0.13, ty, th * 0.11));

  return {
    id: `ai-${letter}-${Date.now()}`,
    letter,
    title,
    source: "ai",
    width,
    height,
    layers,
    palette: pal,
    aiImage: image,
    aiPrompt: prompt,
    textZone: zone,
  };
}

export function inspectDraft(draft: Draft, brief: Brief): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!brief.headline.trim() && !brief.notes.trim()) errors.push("주문내용에서 사용할 대표 문구를 찾지 못했습니다");
  const texts = draft.layers.filter((l): l is TextLayer => l.type === "text");
  const min = Math.max(8, brief.readDistanceM * 2.2);
  for (const t of texts) {
    if (t.fontSize < min) warnings.push(`${roleLabel(t.role)} 글자가 읽는 거리 기준보다 작습니다`);
  }
  return { errors, warnings };
}

function roleLabel(role: TextLayer["role"]) {
  switch (role) {
    case "name": return "상호";
    case "headline": return "메인 문구";
    case "subhead": return "보조 문구";
    case "price": return "가격";
    case "date": return "날짜";
    case "place": return "장소";
    case "phone": return "전화";
    case "address": return "주소";
    default: return "문구";
  }
}

export { roleLabel };
