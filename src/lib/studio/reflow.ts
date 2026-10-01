import { uid } from "./geom";
import type { Draft, ImageLayer, Layer, TextLayer } from "./types";

export const CONVERT_PRESETS = [
  { group: "현수막", label: "500×90cm", w: 5000, h: 900 },
  { group: "현수막", label: "400×90cm", w: 4000, h: 900 },
  { group: "현수막", label: "300×70cm", w: 3000, h: 700 },
  { group: "현수막", label: "250×70cm", w: 2500, h: 700 },
  { group: "배너", label: "60×180cm", w: 600, h: 1800 },
  { group: "배너", label: "80×180cm", w: 800, h: 1800 },
  { group: "명함", label: "90×50mm", w: 90, h: 50 },
  { group: "인쇄물", label: "A4", w: 210, h: 297 },
  { group: "인쇄물", label: "A3", w: 297, h: 420 },
] as const;

function textsOf(layers: Layer[]) {
  return layers.filter((layer): layer is TextLayer => layer.type === "text");
}

/** 단순 확대가 아니라 역할별로 다시 배치한 새 시안. 원본 draft는 바꾸지 않는다. */
export function reflowToSize(draft: Draft, width: number, height: number, label: string): Draft {
  const wide = width / height >= 1.7;
  const tall = height / width >= 1.25;
  const margin = Math.min(width, height) * (Math.min(width, height) < 120 ? 0.06 : 0.07);
  const textWidth = wide ? width * 0.56 : width - margin * 2;
  const shortSide = Math.min(width, height);
  const roles: TextLayer["role"][] = ["name", "headline", "subhead", "price", "date", "place", "phone", "address", "notes"];
  const sourceTexts = textsOf(draft.layers);
  let y = tall ? margin : height * 0.18;
  const placed: Layer[] = [];

  for (const role of roles) {
    const layer = sourceTexts.find((item) => item.role === role);
    if (!layer) continue;
    const fontSize = shortSide * (role === "headline" ? (wide ? 0.22 : 0.11) : role === "name" ? 0.055 : role === "phone" ? 0.045 : 0.04);
    const h = fontSize * (role === "headline" ? 1.35 : 1.45);
    placed.push({
      ...layer,
      x: margin,
      y,
      w: textWidth,
      h,
      fontSize: Math.max(role === "phone" ? 8 : 7, fontSize),
    });
    y += h + shortSide * 0.02;
  }

  const backgrounds = draft.layers.filter((layer): layer is ImageLayer => layer.type === "image" && layer.role === "background");
  const background = backgrounds.at(-1);
  if (background) {
    placed.unshift({ ...background, x: 0, y: 0, w: width, h: height });
  }

  const photos = draft.layers.filter((layer): layer is ImageLayer => layer.type === "image" && layer.role === "photo");
  photos.forEach((photo, index) => {
    if (wide) {
      const w = width * 0.3;
      const h = height - margin * 2;
      placed.push({ ...photo, x: width - margin - w, y: margin + index * 8, w, h, fit: photo.fit === "responsive" ? "cover" : photo.fit });
    } else if (tall) {
      const w = width - margin * 2;
      const h = height * 0.36;
      placed.push({ ...photo, x: margin, y: height * 0.36 + index * 8, w, h, fit: photo.fit === "responsive" ? "cover" : photo.fit });
    } else {
      const w = width * 0.42;
      const h = height * 0.42;
      placed.push({ ...photo, x: width - margin - w, y: margin, w, h });
    }
  });

  const logos = draft.layers.filter((layer): layer is ImageLayer => layer.type === "image" && layer.role === "logo");
  logos.forEach((logo, index) => {
    const size = shortSide * (Math.min(width, height) < 120 ? 0.16 : 0.12);
    placed.push({
      ...logo,
      x: width - margin - size,
      y: height - margin - size - index * (size + 4),
      w: size,
      h: size,
      scaleX: 1,
      scaleY: 1,
      fit: "contain",
    });
  });

  for (const layer of draft.layers) {
    if (layer.type === "image") continue;
    if (layer.type === "text") continue;
    const area = layer.w * layer.h;
    if (area > draft.width * draft.height * 0.45) {
      placed.push({ ...layer, x: 0, y: 0, w: width, h: height * 0.22 });
      continue;
    }
    placed.push({
      ...layer,
      x: (layer.x / draft.width) * width,
      y: (layer.y / draft.height) * height,
      w: (layer.w / draft.width) * width,
      h: (layer.h / draft.height) * height,
    });
  }

  return {
    ...draft,
    id: uid("adapt"),
    title: `${label} 변환`,
    width,
    height,
    layers: placed,
  };
}
