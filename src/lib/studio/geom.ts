import type { Layer, ShapeLayer, TextLayer } from "./types";

export const GRID = 20;

export function uid(prefix = "obj") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function snapNum(n: number, on: boolean, grid = GRID) {
  if (!on) return n;
  return Math.round(n / grid) * grid;
}

/** Wrap to (-180, 180]. Tiny leftovers become 0. */
export function normalizeAngle(deg: number) {
  let a = ((((deg + 180) % 360) + 360) % 360) - 180;
  if (a <= -180) a = 180;
  if (Math.abs(a) < 0.5) return 0;
  return a;
}

/** Default: stick to 0° (and 90° steps). Shift: 15° ticks. */
export function snapRotation(deg: number, shift = false) {
  const a = normalizeAngle(deg);
  if (shift) return normalizeAngle(Math.round(a / 15) * 15);
  const magnets = [0, 90, -90, 180, -180, 45, -45, 135, -135];
  for (const m of magnets) {
    const thresh = m === 0 ? 12 : 7;
    if (Math.abs(a - m) <= thresh) return m === -180 ? 180 : m;
    if (m === 180 && Math.abs(Math.abs(a) - 180) <= 7) return 180;
  }
  return Math.round(a);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function layerName(layer: Layer): string {
  if (layer.name) return layer.name;
  if (layer.type === "text") {
    const map: Record<TextLayer["role"], string> = {
      name: "상호",
      headline: "메인 문구",
      subhead: "보조 문구",
      price: "가격",
      date: "날짜",
      place: "장소",
      phone: "전화",
      address: "주소",
      notes: "글자",
    };
    return map[layer.role] ?? "글자";
  }
  if (layer.type === "image") {
    if (layer.role === "background") return "배경";
    if (layer.role === "logo") return "로고";
    return "이미지";
  }
  if (layer.type === "shape") {
    const map: Record<ShapeLayer["kind"], string> = {
      rect: "사각형",
      ellipse: "원",
      line: "선",
      polygon: "다각형",
    };
    return map[layer.kind];
  }
  return "면";
}

export function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number) {
  if (!deg) return { x, y };
  const r = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * Math.cos(r) - dy * Math.sin(r),
    y: cy + dx * Math.sin(r) + dy * Math.cos(r),
  };
}

export function layerCenter(layer: Layer) {
  return { x: layer.x + layer.w / 2, y: layer.y + layer.h / 2 };
}

function unrotate(layer: Layer, x: number, y: number) {
  const c = layerCenter(layer);
  return rotatePoint(x, y, c.x, c.y, -(layer.rotation ?? 0));
}

export function containsPoint(layer: Layer, x: number, y: number): boolean {
  if (layer.hidden) return false;
  const p = unrotate(layer, x, y);
  if (layer.type === "shape" && layer.kind === "ellipse") {
    const cx = layer.x + layer.w / 2;
    const cy = layer.y + layer.h / 2;
    const rx = Math.max(1, Math.abs(layer.w) / 2);
    const ry = Math.max(1, Math.abs(layer.h) / 2);
    const nx = (p.x - cx) / rx;
    const ny = (p.y - cy) / ry;
    return nx * nx + ny * ny <= 1.08;
  }
  if (layer.type === "shape" && layer.kind === "line") {
    const x1 = layer.w < 0 ? layer.x + layer.w : layer.x;
    const y1 = layer.h < 0 ? layer.y + layer.h : layer.y;
    const x2 = layer.w < 0 ? layer.x : layer.x + layer.w;
    const y2 = layer.h < 0 ? layer.y : layer.y + layer.h;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const t = clamp(((p.x - x1) * dx + (p.y - y1) * dy) / (len * len), 0, 1);
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    return Math.hypot(p.x - px, p.y - py) <= Math.max(8, layer.strokeWidth + 6);
  }
  const pad = 2;
  return p.x >= layer.x - pad && p.x <= layer.x + layer.w + pad && p.y >= layer.y - pad && p.y <= layer.y + layer.h + pad;
}

export function hitTest(layers: Layer[], x: number, y: number, opts?: { includeLocked?: boolean }): Layer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.hidden) continue;
    if (!opts?.includeLocked && layer.locked) continue;
    if (!opts?.includeLocked && layer.type === "image" && layer.role === "background") continue;
    if (containsPoint(layer, x, y)) return layer;
  }
  return null;
}

export function polygonPoints(layer: ShapeLayer): string {
  const sides = Math.max(3, layer.sides ?? 6);
  const cx = layer.x + layer.w / 2;
  const cy = layer.y + layer.h / 2;
  const rx = layer.w / 2;
  const ry = layer.h / 2;
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push(`${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`);
  }
  return pts.join(" ");
}

export function normalizeRect(x: number, y: number, w: number, h: number) {
  return {
    x: w < 0 ? x + w : x,
    y: h < 0 ? y + h : y,
    w: Math.abs(w),
    h: Math.abs(h),
  };
}

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rot";

export function handlePositions(layer: Layer, size: number): { id: HandleId; x: number; y: number }[] {
  const { x, y, w, h } = layer;
  const cx = x + w / 2;
  return [
    { id: "nw", x, y },
    { id: "n", x: cx, y },
    { id: "ne", x: x + w, y },
    { id: "e", x: x + w, y: y + h / 2 },
    { id: "se", x: x + w, y: y + h },
    { id: "s", x: cx, y: y + h },
    { id: "sw", x, y: y + h },
    { id: "w", x, y: y + h / 2 },
    { id: "rot", x: cx, y: y - size * 4 },
  ];
}

export function resizeByHandle(
  layer: Layer,
  handle: HandleId,
  nx: number,
  ny: number,
  keepRatio: boolean,
): Partial<Layer> {
  if (handle === "rot") {
    const c = layerCenter(layer);
    const deg = (Math.atan2(ny - c.y, nx - c.x) * 180) / Math.PI + 90;
    return { rotation: snapRotation(deg, keepRatio) };
  }
  let { x, y, w, h } = layer;
  const right = x + w;
  const bottom = y + h;
  if (handle.includes("w")) {
    w = right - nx;
    x = nx;
  }
  if (handle.includes("e")) w = nx - x;
  if (handle.includes("n")) {
    h = bottom - ny;
    y = ny;
  }
  if (handle.includes("s")) h = ny - y;
  if (keepRatio && layer.w && layer.h) {
    const ratio = Math.abs(layer.w / layer.h) || 1;
    if (handle === "n" || handle === "s") w = h * ratio;
    else h = w / ratio;
  }
  const n = normalizeRect(x, y, w, h);
  return { x: n.x, y: n.y, w: Math.max(4, n.w), h: Math.max(4, n.h) };
}

export function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}
