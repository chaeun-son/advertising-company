import { uid } from "./geom";
import type { Brief, Draft, Layer, Palette, TextLayer } from "./types";

type Assets = { photo?: string | null; logo?: string | null };

function text(role: TextLayer["role"], value: string, box: { x: number; y: number; w: number; h: number }, style: { fill: string; fontSize: number; fontFamily: string; weight?: number; align?: TextLayer["align"] }): Layer | null {
  if (!value.trim()) return null;
  return {
    id: uid(role),
    type: "text",
    role,
    ...box,
    text: value.trim(),
    fontFamily: style.fontFamily,
    fontWeight: style.weight ?? 700,
    fontSize: style.fontSize,
    fill: style.fill,
    align: style.align ?? "start",
  };
}

function photo(href: string | null | undefined, box: { x: number; y: number; w: number; h: number }, fit: "cover" | "contain"): Layer[] {
  if (!href) return [];
  return [{ id: uid("photo"), type: "image", role: "photo", href, fit, focus: { x: 0.2, y: 0.12, w: 0.6, h: 0.7 }, protectMode: "auto", ...box }];
}

function logo(href: string | null | undefined, x: number, y: number, size: number): Layer[] {
  if (!href) return [];
  return [{ id: uid("logo"), type: "image", role: "logo", href, fit: "contain", x, y, w: size, h: size }];
}

function push(layers: Layer[], layer: Layer | null) {
  if (layer) layers.push(layer);
}

export function composeDesignerDrafts(brief: Brief, width: number, height: number, assets: Assets): Draft[] {
  const short = Math.min(width, height);
  const wide = width / height > 1.6;
  const margin = short * 0.07;
  const title = brief.titleFont || "Pretendard";
  const body = brief.bodyFont || "Pretendard";
  const headline = Math.max(short * (wide ? 0.16 : 0.11), 18);
  const sub = Math.max(short * 0.045, 12);
  const info = Math.max(short * 0.038, 11);

  const luxury: Palette = { bg: "#f7f1e6", panel: "#efe4d2", text: "#2c2418", muted: "#6d6256", accent: "#8d6a2f", onAccent: "#fffaf3" };
  const bold: Palette = { bg: "#16191f", panel: "#ff5a1f", text: "#fffdf8", muted: "#f2d2c4", accent: "#ff5a1f", onAccent: "#1c150e" };
  const warm: Palette = { bg: "#f6d7c4", panel: "#1c150ee6", text: "#fffdf8", muted: "#ffe8d8", accent: "#ffd7a8", onAccent: "#1c150e" };

  const a: Layer[] = [
    { id: uid("bg"), type: "rect", x: 0, y: 0, w: width, h: height, fill: luxury.bg },
    { id: uid("bar"), type: "rect", x: 0, y: 0, w: Math.max(8, width * 0.012), h: height, fill: luxury.accent },
  ];
  a.push(...photo(assets.photo, wide ? { x: width * 0.58, y: margin, w: width * 0.36, h: height - margin * 2 } : { x: margin, y: height * 0.52, w: width - margin * 2, h: height * 0.28 }, "cover"));
  push(a, text("name", brief.name, { x: margin, y: margin, w: width * 0.5, h: info * 1.4 }, { fill: luxury.accent, fontSize: info, fontFamily: body, weight: 700 }));
  push(a, text("headline", brief.headline, { x: margin, y: margin * 2.2, w: wide ? width * 0.5 : width - margin * 2, h: headline * 2.2 }, { fill: luxury.text, fontSize: headline, fontFamily: title, weight: 800 }));
  push(a, text("subhead", brief.subhead, { x: margin, y: margin * 2.2 + headline * 2.3, w: wide ? width * 0.48 : width - margin * 2, h: sub * 2 }, { fill: luxury.muted, fontSize: sub, fontFamily: body, weight: 600 }));
  push(a, text("date", brief.date, { x: margin, y: height - margin * 2.4, w: width * 0.4, h: info * 1.5 }, { fill: luxury.text, fontSize: info, fontFamily: body }));
  push(a, text("phone", brief.phone, { x: margin, y: height - margin * 1.3, w: width * 0.4, h: info * 1.6 }, { fill: luxury.text, fontSize: info * 1.05, fontFamily: body }));
  push(a, text("price", brief.price, { x: margin + width * 0.32, y: height - margin * 1.3, w: width * 0.25, h: info * 1.6 }, { fill: luxury.accent, fontSize: info, fontFamily: body }));
  a.push(...logo(assets.logo, width - margin - short * 0.14, height - margin - short * 0.14, short * 0.12));

  const b: Layer[] = [
    { id: uid("bg"), type: "rect", x: 0, y: 0, w: width, h: height, fill: bold.bg },
    { id: uid("band"), type: "rect", x: 0, y: height * 0.78, w: width, h: height * 0.22, fill: bold.accent },
  ];
  push(b, text("headline", brief.headline, { x: margin, y: wide ? height * 0.22 : margin, w: width - margin * 2, h: headline * 2.4 }, { fill: bold.text, fontSize: headline * 1.15, fontFamily: title, weight: 900, align: "middle" }));
  push(b, text("subhead", brief.subhead, { x: margin, y: height * 0.5, w: width - margin * 2, h: sub * 2 }, { fill: bold.muted, fontSize: sub * 1.1, fontFamily: body, align: "middle" }));
  b.push(...photo(assets.photo, { x: width * 0.68, y: margin, w: width * 0.26, h: height * 0.42 }, "cover"));
  push(b, text("name", brief.name, { x: margin, y: height * 0.8, w: width * 0.4, h: info * 1.8 }, { fill: bold.onAccent, fontSize: info, fontFamily: body, weight: 800 }));
  push(b, text("phone", brief.phone, { x: width * 0.42, y: height * 0.8, w: width * 0.28, h: info * 1.8 }, { fill: bold.onAccent, fontSize: info * 1.15, fontFamily: body, weight: 800 }));
  push(b, text("date", brief.date, { x: width * 0.7, y: height * 0.8, w: width * 0.24, h: info * 1.8 }, { fill: bold.onAccent, fontSize: info, fontFamily: body }));
  b.push(...logo(assets.logo, width - margin - short * 0.12, margin, short * 0.1));

  const c: Layer[] = [];
  if (assets.photo) c.push(...photo(assets.photo, { x: 0, y: 0, w: width, h: height }, "cover"));
  else c.push({ id: uid("bg"), type: "rect", x: 0, y: 0, w: width, h: height, fill: warm.bg });
  c.push({ id: uid("scrim"), type: "rect", x: 0, y: height * 0.58, w: width, h: height * 0.42, fill: "#1c150e", opacity: 0.55 });
  push(c, text("name", brief.name, { x: margin, y: height * 0.62, w: width * 0.7, h: info * 1.4 }, { fill: warm.accent, fontSize: info, fontFamily: body }));
  push(c, text("headline", brief.headline, { x: margin, y: height * 0.68, w: width - margin * 2, h: headline * 1.8 }, { fill: warm.text, fontSize: headline * 0.92, fontFamily: title, weight: 800 }));
  push(c, text("subhead", brief.subhead, { x: margin, y: height * 0.84, w: width * 0.7, h: sub * 1.6 }, { fill: warm.muted, fontSize: sub, fontFamily: body, weight: 500 }));
  push(c, text("phone", brief.phone, { x: margin, y: height - margin * 0.9, w: width * 0.4, h: info * 1.4 }, { fill: "#ffffff", fontSize: info, fontFamily: body }));
  push(c, text("date", brief.date, { x: width * 0.48, y: height - margin * 0.9, w: width * 0.3, h: info * 1.4 }, { fill: "#ffffff", fontSize: info, fontFamily: body }));
  c.push(...logo(assets.logo, width - margin - short * 0.12, height - margin - short * 0.12, short * 0.1));

  const specs = [
    { letter: "A" as const, title: "깔끔하고 고급스러운 디자인", palette: luxury, layers: a },
    { letter: "B" as const, title: "강렬하고 시인성이 높은 디자인", palette: bold, layers: b },
    { letter: "C" as const, title: "사진과 감성을 강조한 디자인", palette: warm, layers: c },
  ];
  return specs.map((spec) => ({
    id: uid("design"),
    letter: spec.letter,
    title: spec.title,
    source: "type",
    width,
    height,
    layers: spec.layers,
    palette: spec.palette,
  }));
}
