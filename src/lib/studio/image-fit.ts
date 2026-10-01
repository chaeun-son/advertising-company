import type { ImageLayer } from './types';
import { BACKGROUND_COLORS } from './background-colors';
import { BACKGROUND_LINES } from './background-lines';

export function backgroundBaseFill(href: string): string {
  if (href.startsWith('/library/backgrounds/')) return BACKGROUND_COLORS[href.split('/').at(-1) ?? ''] ?? '#ffffff';
  if (href === '/reference-banner.svg' || href === '/reference-poster.svg') return '#f4fbff';
  return '#ffffff';
}

export function imageDimensions(layer: ImageLayer): { width: number; height: number } | null {
  if (layer.intrinsicWidth && layer.intrinsicHeight) return { width: layer.intrinsicWidth, height: layer.intrinsicHeight };
  if (layer.href === '/reference-banner.svg') return { width: 2500, height: 700 };
  if (layer.href === '/reference-poster.svg') return { width: 1000, height: 1000 };
  if (layer.href.startsWith('/library/backgrounds/')) return { width: 1800, height: 450 };
  return null;
}

/** Both axes use the same factor; clipping happens at the layer boundary. */
export function fittedImageBox(layer: Pick<ImageLayer, 'x' | 'y' | 'w' | 'h' | 'fit'>, width: number, height: number) {
  const factor = layer.fit === 'contain' ? Math.min(layer.w / width, layer.h / height) : Math.max(layer.w / width, layer.h / height);
  const w = width * factor;
  const h = height * factor;
  return { x: layer.x + (layer.w - w) / 2, y: layer.y + (layer.h - h) / 2, w, h };
}

/** Cover crop shifted so the protected subject stays inside the frame. */
export function focalCoverBox(layer: Pick<ImageLayer, 'x' | 'y' | 'w' | 'h' | 'focus'>, width: number, height: number) {
  const focus = layer.focus ?? { x: 0.5, y: 0.5, w: 0, h: 0 };
  const factor = Math.max(layer.w / width, layer.h / height);
  const w = width * factor;
  const h = height * factor;
  const fx = Math.min(1, Math.max(0, focus.x + focus.w / 2));
  const fy = Math.min(1, Math.max(0, focus.y + focus.h / 2));
  let x = layer.x + layer.w / 2 - fx * w;
  let y = layer.y + layer.h / 2 - fy * h;
  x = Math.min(layer.x, Math.max(layer.x + layer.w - w, x));
  y = Math.min(layer.y, Math.max(layer.y + layer.h - h, y));
  return { x, y, w, h };
}

export function visibleSourceWindow(layer: Pick<ImageLayer, 'x' | 'y' | 'w' | 'h' | 'fit' | 'focus'>, width: number, height: number) {
  const box = layer.fit === "contain" ? fittedImageBox({ ...layer, fit: "contain" }, width, height) : focalCoverBox(layer, width, height);
  return {
    x: (layer.x - box.x) / box.w,
    y: (layer.y - box.y) / box.h,
    w: layer.w / box.w,
    h: layer.h / box.h,
  };
}

export function focusIsCropped(layer: Pick<ImageLayer, 'x' | 'y' | 'w' | 'h' | 'fit' | 'focus'>, width: number, height: number) {
  if (!layer.focus || layer.fit === "contain" || layer.fit === "responsive") return false;
  const view = visibleSourceWindow(layer, width, height);
  const f = layer.focus;
  const pad = 0.02;
  return f.x < view.x - pad || f.y < view.y - pad || f.x + f.w > view.x + view.w + pad || f.y + f.h > view.y + view.h + pad;
}

export type EdgeExtensionLayout =
  | { axis: "x"; box: ReturnType<typeof fittedImageBox>; leftGap: number; rightGap: number; slice: number }
  | { axis: "y"; box: ReturnType<typeof fittedImageBox>; topGap: number; bottomGap: number; slice: number }
  | { axis: "none"; box: ReturnType<typeof fittedImageBox> };

/**
 * For contain-fitted backgrounds, fill only the empty bands by stretching a thin
 * slice from the corresponding source edge. This keeps the original image intact
 * while avoiding duplicated central subjects in the extension area.
 */
export function edgeExtensionLayout(
  layer: Pick<ImageLayer, 'x' | 'y' | 'w' | 'h' | 'fit'>,
  sourceWidth: number,
  sourceHeight: number,
): EdgeExtensionLayout {
  const box = fittedImageBox({ ...layer, fit: 'contain' }, sourceWidth, sourceHeight);
  const leftGap = Math.max(0, box.x - layer.x);
  const rightGap = Math.max(0, layer.x + layer.w - (box.x + box.w));
  const topGap = Math.max(0, box.y - layer.y);
  const bottomGap = Math.max(0, layer.y + layer.h - (box.y + box.h));
  if (leftGap + rightGap > 1) {
    return { axis: 'x', box, leftGap, rightGap, slice: Math.max(1, sourceWidth * 0.28) };
  }
  if (topGap + bottomGap > 1) {
    return { axis: 'y', box, topGap, bottomGap, slice: Math.max(1, sourceHeight * 0.28) };
  }
  return { axis: 'none', box };
}

/** Side ornaments stay on the ends and stretch to the new height. The center fills the rest. */
export function responsiveImageLayout(layer: Pick<ImageLayer, 'x' | 'y' | 'w' | 'h'>, sourceWidth: number, sourceHeight: number) {
  const sourceCap = sourceWidth * 0.25;
  const heightScale = sourceHeight > 0 ? layer.h / sourceHeight : 1;
  let cap = sourceCap * heightScale;
  const maxCap = Math.max(8, layer.w * 0.46);
  if (cap > maxCap) cap = maxCap;
  const scale = sourceCap > 0 ? cap / sourceCap : heightScale;
  const imageWidth = sourceWidth * scale;
  const imageHeight = layer.h;
  return {
    sourceCap,
    scale,
    cap,
    imageWidth,
    imageHeight,
    imageY: layer.y,
    leftX: layer.x,
    rightX: layer.x + layer.w - imageWidth,
    rightClipX: layer.x + layer.w - cap,
  };
}

export function responsiveCenterLines(href: string, layer: Pick<ImageLayer, 'x' | 'y' | 'w' | 'h'>, layout: ReturnType<typeof responsiveImageLayout>, sourceWidth: number) {
  const lines = BACKGROUND_LINES[href.split('/').at(-1) ?? ''] ?? [];
  const sourceMiddle = sourceWidth - layout.sourceCap * 2;
  const targetMiddle = layer.w - layout.cap * 2;
  return lines.map((line) => ({
    x1: layer.x + layout.cap + Math.max(0, line.x1 - layout.sourceCap) / sourceMiddle * targetMiddle,
    x2: layer.x + layout.cap + Math.min(sourceMiddle, line.x2 - layout.sourceCap) / sourceMiddle * targetMiddle,
    y1: layout.imageY + line.y1 * layout.scale,
    y2: layout.imageY + line.y2 * layout.scale,
    stroke: line.stroke,
    width: line.width * layout.scale,
    opacity: line.opacity,
  }));
}

const cache = new Map<string, Promise<{ width: number; height: number }>>();
export function loadImageDimensions(href: string) {
  let result = cache.get(href);
  if (!result) {
    result = new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => img.naturalWidth && img.naturalHeight ? resolve({ width: img.naturalWidth, height: img.naturalHeight }) : reject(new Error('이미지 크기를 읽지 못했습니다.'));
      img.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
      img.src = href;
    });
    cache.set(href, result);
    result.catch(() => cache.delete(href));
  }
  return result;
}
