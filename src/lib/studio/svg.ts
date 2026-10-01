import { backgroundBaseFill, edgeExtensionLayout, fittedImageBox, imageDimensions, loadImageDimensions, responsiveCenterLines, responsiveImageLayout } from "./image-fit";
import { polygonPoints } from "./geom";
import type { Draft, Layer, ShapeLayer, TextLayer } from "./types";


function rgba(color: string, alpha: number) {
  const hex = color.trim();
  const short = hex.match(/^#([0-9a-f]{3})$/i);
  const full = hex.match(/^#([0-9a-f]{6})$/i);
  if (short) {
    const [r, g, b] = short[1].split("").map((c) => parseInt(c + c, 16));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (full) {
    const n = parseInt(full[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  return `rgba(255,255,255,${alpha})`;
}

function esc(s: string) {
  return s
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function wrapLines(layer: TextLayer): string[] {
  const maxChars = Math.max(4, Math.floor(layer.w / Math.max(8, layer.fontSize * 0.92)));
  const raw = layer.text.replace(/\n/g, " ").trim();
  if ([...raw].length <= maxChars) return [raw];
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if ([...next].length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function anchor(align: TextLayer["align"]) {
  return align === "middle" ? "middle" : align === "end" ? "end" : "start";
}

function textX(layer: TextLayer) {
  if (layer.align === "middle") return layer.x + layer.w / 2;
  if (layer.align === "end") return layer.x + layer.w;
  return layer.x;
}

function rotWrap(layer: Layer, inner: string) {
  if (layer.hidden) return "";
  const rot = layer.rotation ?? 0;
  const sx = layer.scaleX ?? 1;
  const sy = layer.scaleY ?? 1;
  if (!rot && sx === 1 && sy === 1) return inner;
  const cx = layer.x + layer.w / 2;
  const cy = layer.y + layer.h / 2;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${sx} ${sy}) translate(${-cx} ${-cy})">${inner}</g>`;
}

function op(layer: Layer) {
  return layer.opacity == null ? "" : ` opacity="${layer.opacity}"`;
}

function renderShape(layer: ShapeLayer): string {
  const sw = layer.strokeWidth || 0;
  const stroke = sw ? ` stroke="${esc(layer.stroke)}" stroke-width="${sw}"` : ` stroke="none"`;
  const fill = ` fill="${esc(layer.fill)}"`;
  if (layer.kind === "ellipse") {
    return `<ellipse cx="${layer.x + layer.w / 2}" cy="${layer.y + layer.h / 2}" rx="${Math.abs(layer.w) / 2}" ry="${Math.abs(layer.h) / 2}"${fill}${stroke}${op(layer)}/>`;
  }
  if (layer.kind === "line") {
    return `<line x1="${layer.x}" y1="${layer.y}" x2="${layer.x + layer.w}" y2="${layer.y + layer.h}" stroke="${esc(layer.stroke)}" stroke-width="${Math.max(1, sw)}" stroke-linecap="round"${op(layer)}/>`;
  }
  if (layer.kind === "polygon") {
    return `<polygon points="${polygonPoints(layer)}"${fill}${stroke}${op(layer)}/>`;
  }
  const r = layer.radius ?? 0;
  return `<rect x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${layer.h}" rx="${r}"${fill}${stroke}${op(layer)}/>`;
}

function renderLayer(layer: Layer): string {
  if (layer.hidden) return "";
  if (layer.type === "shape") return rotWrap(layer, renderShape(layer));
  if (layer.type === "rect") {
    const r = layer.radius ?? 0;
    const sw = layer.strokeWidth ?? 0;
    const stroke = sw ? ` stroke="${esc(layer.stroke ?? "#000")}" stroke-width="${sw}"` : "";
    return rotWrap(
      layer,
      `<rect x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${layer.h}" rx="${r}" fill="${esc(layer.fill)}"${stroke}${op(layer)}/>`,
    );
  }
  if (layer.type === "image") {
    const clip = `clip-${layer.id}`;
    const size = imageDimensions(layer) ?? { width: layer.w, height: layer.h };
    if (layer.fit === "responsive") {
      const layout = responsiveImageLayout(layer, size.width, size.height);
      const commonImage = `href="${esc(layer.href)}" width="${layout.imageWidth}" height="${layout.imageHeight}" preserveAspectRatio="none"`;
      const middle = `<rect x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${layer.h}" fill="${esc(layer.backgroundFill ?? backgroundBaseFill(layer.href))}"/>` + responsiveCenterLines(layer.backgroundSource ?? layer.href, layer, layout, size.width).map((line) => `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${esc(line.stroke)}" stroke-width="${line.width}" opacity="${line.opacity}"/>`).join("");
      const left = `<image ${commonImage} x="${layout.leftX}" y="${layout.imageY}" clip-path="url(#${clip}-left)"/>`;
      const right = `<image ${commonImage} x="${layout.rightX}" y="${layout.imageY}" clip-path="url(#${clip}-right)"/>`;
      return rotWrap(layer, `<clipPath id="${clip}-left"><rect x="${layer.x}" y="${layer.y}" width="${layout.cap}" height="${layer.h}"/></clipPath><clipPath id="${clip}-right"><rect x="${layout.rightClipX}" y="${layer.y}" width="${layout.cap}" height="${layer.h}"/></clipPath><g${op(layer)}>${middle}${left}${right}</g>`);
    }
    const box = fittedImageBox(layer, size.width, size.height);
    const edge = layer.fit === "contain" && layer.role === "background" ? edgeExtensionLayout(layer, size.width, size.height) : null;
    const blur = Math.max(8, Math.min(layer.w, layer.h) * 0.032);
    const tint = esc(layer.backgroundFill ?? "#ffffff");
    const fill = layer.fit === "contain" ? `<rect x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${layer.h}" fill="${tint}"/>` : "";
    let expanded = "";
    if (edge && edge.axis !== "none") {
      const defs = `<filter id="${clip}-edgeblur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${blur}"/><feColorMatrix type="saturate" values="0.78"/></filter>`
        + `<linearGradient id="${clip}-leftfade" x1="0%" x2="100%"><stop offset="0%" stop-color="${tint}" stop-opacity="0.24"/><stop offset="100%" stop-color="${tint}" stop-opacity="0.03"/></linearGradient>`
        + `<linearGradient id="${clip}-rightfade" x1="0%" x2="100%"><stop offset="0%" stop-color="${tint}" stop-opacity="0.03"/><stop offset="100%" stop-color="${tint}" stop-opacity="0.24"/></linearGradient>`
        + `<linearGradient id="${clip}-topfade" y1="0%" y2="100%"><stop offset="0%" stop-color="${tint}" stop-opacity="0.24"/><stop offset="100%" stop-color="${tint}" stop-opacity="0.03"/></linearGradient>`
        + `<linearGradient id="${clip}-bottomfade" y1="0%" y2="100%"><stop offset="0%" stop-color="${tint}" stop-opacity="0.03"/><stop offset="100%" stop-color="${tint}" stop-opacity="0.24"/></linearGradient>`;
      if (edge.axis === "x") {
        const left = edge.leftGap > 0 ? `<svg x="${layer.x}" y="${layer.y}" width="${edge.leftGap + 1}" height="${layer.h}" viewBox="${size.width - edge.slice} 0 ${edge.slice} ${size.height}" preserveAspectRatio="none" overflow="hidden"><image href="${esc(layer.href)}" x="0" y="0" width="${size.width}" height="${size.height}" preserveAspectRatio="none" transform="translate(${size.width} 0) scale(-1 1)" filter="url(#${clip}-edgeblur)" opacity="0.82"/></svg><rect x="${layer.x}" y="${layer.y}" width="${edge.leftGap + 1}" height="${layer.h}" fill="url(#${clip}-leftfade)"/>` : "";
        const right = edge.rightGap > 0 ? `<svg x="${box.x + box.w - 1}" y="${layer.y}" width="${edge.rightGap + 1}" height="${layer.h}" viewBox="0 0 ${edge.slice} ${size.height}" preserveAspectRatio="none" overflow="hidden"><image href="${esc(layer.href)}" x="0" y="0" width="${size.width}" height="${size.height}" preserveAspectRatio="none" transform="translate(${size.width} 0) scale(-1 1)" filter="url(#${clip}-edgeblur)" opacity="0.82"/></svg><rect x="${box.x + box.w - 1}" y="${layer.y}" width="${edge.rightGap + 1}" height="${layer.h}" fill="url(#${clip}-rightfade)"/>` : "";
        expanded = defs + left + right;
      } else {
        const top = edge.topGap > 0 ? `<svg x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${edge.topGap + 1}" viewBox="0 ${size.height - edge.slice} ${size.width} ${edge.slice}" preserveAspectRatio="none" overflow="hidden"><image href="${esc(layer.href)}" x="0" y="0" width="${size.width}" height="${size.height}" preserveAspectRatio="none" transform="translate(0 ${size.height}) scale(1 -1)" filter="url(#${clip}-edgeblur)" opacity="0.82"/></svg><rect x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${edge.topGap + 1}" fill="url(#${clip}-topfade)"/>` : "";
        const bottom = edge.bottomGap > 0 ? `<svg x="${layer.x}" y="${box.y + box.h - 1}" width="${layer.w}" height="${edge.bottomGap + 1}" viewBox="0 0 ${size.width} ${edge.slice}" preserveAspectRatio="none" overflow="hidden"><image href="${esc(layer.href)}" x="0" y="0" width="${size.width}" height="${size.height}" preserveAspectRatio="none" transform="translate(0 ${size.height}) scale(1 -1)" filter="url(#${clip}-edgeblur)" opacity="0.82"/></svg><rect x="${layer.x}" y="${box.y + box.h - 1}" width="${layer.w}" height="${edge.bottomGap + 1}" fill="url(#${clip}-bottomfade)"/>` : "";
        expanded = defs + top + bottom;
      }
    }
    const base = `<image href="${esc(layer.href)}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" preserveAspectRatio="xMidYMid meet"/>`;
    return rotWrap(
      layer,
      `<clipPath id="${clip}"><rect x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${layer.h}"/></clipPath><g clip-path="url(#${clip})"${op(layer)}>${fill}${expanded}${base}</g>`,
    );
  }
  const lines = wrapLines(layer);
  const lh = layer.fontSize * (layer.lineHeight ?? 1.15);
  const startY = layer.y + (layer.h - lh * lines.length) / 2 + layer.fontSize * 0.82;
  const clip = `tc-${layer.id}`;
  const tspans = lines
    .map((line, i) => `<tspan x="${textX(layer)}" dy="${i === 0 ? 0 : lh}">${esc(line)}</tspan>`)
    .join("");
  return rotWrap(
    layer,
    `<clipPath id="${clip}"><rect x="${layer.x}" y="${layer.y}" width="${layer.w}" height="${layer.h}"/></clipPath><text x="${textX(layer)}" y="${startY}" clip-path="url(#${clip})" fill="${esc(layer.fill)}" font-family="${esc(layer.fontFamily)}" font-weight="${layer.fontWeight}" font-size="${layer.fontSize}" text-anchor="${anchor(layer.align)}" letter-spacing="${layer.letterSpacing ?? 0}">${tspans}</text>`,
  );
}

export function draftToSvg(draft: Draft, opts?: { includeXml?: boolean }): string {
  const body = draft.layers.map(renderLayer).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${draft.width}mm" height="${draft.height}mm" viewBox="0 0 ${draft.width} ${draft.height}">${body}</svg>`;
  if (opts?.includeXml) return `<?xml version="1.0" encoding="UTF-8"?>${svg}`;
  return svg;
}

export function downloadText(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function hrefToDataUrl(href: string): Promise<string> {
  if (href.startsWith("data:")) return href;
  const res = await fetch(href);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다"));
    reader.readAsDataURL(blob);
  });
}

export async function draftToSvgStandalone(draft: Draft): Promise<string> {
  const layers = await Promise.all(
    draft.layers.map(async (layer) => {
      if (layer.type !== "image") return layer;
      try {
        const href = await hrefToDataUrl(layer.href);
        const size = imageDimensions(layer) ?? await loadImageDimensions(href);
        return { ...layer, href, intrinsicWidth: size.width, intrinsicHeight: size.height, backgroundFill: layer.backgroundFill ?? backgroundBaseFill(layer.href), backgroundSource: layer.backgroundSource ?? layer.href };
      } catch {
        return layer;
      }
    }),
  );
  return draftToSvg({ ...draft, layers }, { includeXml: true });
}

export async function draftToPngBlob(draft: Draft, scale = 1): Promise<Blob> {
  const width = Math.round(draft.width * scale);
  const height = Math.round(draft.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스를 만들 수 없습니다");
  ctx.scale(scale, scale);

  const loadImage = (href: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 읽지 못했습니다"));
      img.src = href;
    });

  const paint = (layer: Layer, draw: () => void) => {
    if (layer.hidden) return;
    ctx.save();
    ctx.globalAlpha = layer.opacity ?? 1;
    if (layer.rotation) {
      ctx.translate(layer.x + layer.w / 2, layer.y + layer.h / 2);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-(layer.x + layer.w / 2), -(layer.y + layer.h / 2));
    }
    draw();
    ctx.restore();
  };

  for (const layer of draft.layers) {
    if (layer.type === "rect") {
      paint(layer, () => {
        ctx.fillStyle = layer.fill;
        if (layer.radius) {
          ctx.beginPath();
          ctx.roundRect(layer.x, layer.y, layer.w, layer.h, layer.radius);
          ctx.fill();
        } else {
          ctx.fillRect(layer.x, layer.y, layer.w, layer.h);
        }
        if (layer.strokeWidth) {
          ctx.strokeStyle = layer.stroke ?? "#000";
          ctx.lineWidth = layer.strokeWidth;
          ctx.strokeRect(layer.x, layer.y, layer.w, layer.h);
        }
      });
    } else if (layer.type === "shape") {
      paint(layer, () => {
        ctx.fillStyle = layer.fill === "none" ? "rgba(0,0,0,0)" : layer.fill;
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.strokeWidth || 0;
        if (layer.kind === "ellipse") {
          ctx.beginPath();
          ctx.ellipse(layer.x + layer.w / 2, layer.y + layer.h / 2, Math.abs(layer.w) / 2, Math.abs(layer.h) / 2, 0, 0, Math.PI * 2);
          if (layer.fill !== "none") ctx.fill();
          if (layer.strokeWidth) ctx.stroke();
        } else if (layer.kind === "line") {
          ctx.beginPath();
          ctx.moveTo(layer.x, layer.y);
          ctx.lineTo(layer.x + layer.w, layer.y + layer.h);
          ctx.lineCap = "round";
          ctx.stroke();
        } else if (layer.kind === "polygon") {
          const sides = Math.max(3, layer.sides ?? 6);
          ctx.beginPath();
          for (let i = 0; i < sides; i++) {
            const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
            const px = layer.x + layer.w / 2 + (layer.w / 2) * Math.cos(a);
            const py = layer.y + layer.h / 2 + (layer.h / 2) * Math.sin(a);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          if (layer.fill !== "none") ctx.fill();
          if (layer.strokeWidth) ctx.stroke();
        } else if (layer.radius) {
          ctx.beginPath();
          ctx.roundRect(layer.x, layer.y, layer.w, layer.h, layer.radius);
          if (layer.fill !== "none") ctx.fill();
          if (layer.strokeWidth) ctx.stroke();
        } else {
          if (layer.fill !== "none") ctx.fillRect(layer.x, layer.y, layer.w, layer.h);
          if (layer.strokeWidth) ctx.strokeRect(layer.x, layer.y, layer.w, layer.h);
        }
      });
    } else if (layer.type === "image") {
      try {
        const img = await loadImage(layer.href);
        paint(layer, () => {
          if (layer.fit === "responsive") {
            const layout = responsiveImageLayout(layer, img.naturalWidth, img.naturalHeight);
            ctx.fillStyle = layer.backgroundFill ?? backgroundBaseFill(layer.href);
            ctx.fillRect(layer.x, layer.y, layer.w, layer.h);
            for (const line of responsiveCenterLines(layer.backgroundSource ?? layer.href, layer, layout, img.naturalWidth)) {
              ctx.beginPath();
              ctx.strokeStyle = line.stroke;
              ctx.globalAlpha = (layer.opacity ?? 1) * line.opacity;
              ctx.lineWidth = line.width;
              ctx.moveTo(line.x1, line.y1);
              ctx.lineTo(line.x2, line.y2);
              ctx.stroke();
            }
            ctx.globalAlpha = layer.opacity ?? 1;
            ctx.save();
            ctx.beginPath();
            ctx.rect(layer.x, layer.y, layout.cap, layer.h);
            ctx.clip();
            ctx.drawImage(img, layout.leftX, layout.imageY, layout.imageWidth, layout.imageHeight);
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.rect(layout.rightClipX, layer.y, layout.cap, layer.h);
            ctx.clip();
            ctx.drawImage(img, layout.rightX, layout.imageY, layout.imageWidth, layout.imageHeight);
            ctx.restore();
            return;
          }
          ctx.beginPath();
          ctx.rect(layer.x, layer.y, layer.w, layer.h);
          ctx.clip();
          if (layer.fit === "contain") {
            ctx.fillStyle = layer.backgroundFill ?? "#ffffff";
            ctx.fillRect(layer.x, layer.y, layer.w, layer.h);
          }
          if (layer.fit === "contain" && layer.role === "background") {
            const edge = edgeExtensionLayout(layer, img.naturalWidth, img.naturalHeight);
            const box = edge.box;
            ctx.save();
            ctx.globalAlpha = 0.82;
            ctx.filter = `blur(${Math.max(8, Math.min(layer.w, layer.h) * 0.032)}px) saturate(78%)`;
            if (edge.axis === "x") {
              if (edge.leftGap > 0) {
                const dx = layer.x, dw = edge.leftGap + 1;
                ctx.save(); ctx.translate(2 * dx + dw, 0); ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, edge.slice, img.naturalHeight, dx, layer.y, dw, layer.h);
                ctx.restore();
              }
              if (edge.rightGap > 0) {
                const dx = box.x + box.w - 1, dw = edge.rightGap + 1;
                ctx.save(); ctx.translate(2 * dx + dw, 0); ctx.scale(-1, 1);
                ctx.drawImage(img, img.naturalWidth - edge.slice, 0, edge.slice, img.naturalHeight, dx, layer.y, dw, layer.h);
                ctx.restore();
              }
            } else if (edge.axis === "y") {
              if (edge.topGap > 0) {
                const dy = layer.y, dh = edge.topGap + 1;
                ctx.save(); ctx.translate(0, 2 * dy + dh); ctx.scale(1, -1);
                ctx.drawImage(img, 0, 0, img.naturalWidth, edge.slice, layer.x, dy, layer.w, dh);
                ctx.restore();
              }
              if (edge.bottomGap > 0) {
                const dy = box.y + box.h - 1, dh = edge.bottomGap + 1;
                ctx.save(); ctx.translate(0, 2 * dy + dh); ctx.scale(1, -1);
                ctx.drawImage(img, 0, img.naturalHeight - edge.slice, img.naturalWidth, edge.slice, layer.x, dy, layer.w, dh);
                ctx.restore();
              }
            }
            ctx.restore();
            const tint = layer.backgroundFill ?? "#ffffff";
            if (edge.axis === "x") {
              if (edge.leftGap > 0) {
                const g = ctx.createLinearGradient(layer.x, 0, box.x, 0);
                g.addColorStop(0, rgba(tint, 0.24)); g.addColorStop(1, rgba(tint, 0.03));
                ctx.fillStyle = g; ctx.fillRect(layer.x, layer.y, edge.leftGap + 1, layer.h);
              }
              if (edge.rightGap > 0) {
                const g = ctx.createLinearGradient(box.x + box.w, 0, layer.x + layer.w, 0);
                g.addColorStop(0, rgba(tint, 0.03)); g.addColorStop(1, rgba(tint, 0.24));
                ctx.fillStyle = g; ctx.fillRect(box.x + box.w - 1, layer.y, edge.rightGap + 1, layer.h);
              }
            } else if (edge.axis === "y") {
              if (edge.topGap > 0) {
                const g = ctx.createLinearGradient(0, layer.y, 0, box.y);
                g.addColorStop(0, rgba(tint, 0.24)); g.addColorStop(1, rgba(tint, 0.03));
                ctx.fillStyle = g; ctx.fillRect(layer.x, layer.y, layer.w, edge.topGap + 1);
              }
              if (edge.bottomGap > 0) {
                const g = ctx.createLinearGradient(0, box.y + box.h, 0, layer.y + layer.h);
                g.addColorStop(0, rgba(tint, 0.03)); g.addColorStop(1, rgba(tint, 0.24));
                ctx.fillStyle = g; ctx.fillRect(layer.x, box.y + box.h - 1, layer.w, edge.bottomGap + 1);
              }
            }
          }
          const box = fittedImageBox(layer, img.naturalWidth, img.naturalHeight);
          ctx.drawImage(img, box.x, box.y, box.w, box.h);
        });
      } catch {
        ctx.fillStyle = "#222";
        ctx.fillRect(layer.x, layer.y, layer.w, layer.h);
      }
    } else {
      const lines = wrapLines(layer);
      const lh = layer.fontSize * (layer.lineHeight ?? 1.15);
      paint(layer, () => {
        ctx.beginPath();
        ctx.rect(layer.x, layer.y, layer.w, layer.h);
        ctx.clip();
        ctx.fillStyle = layer.fill;
        ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
        ctx.textAlign = layer.align === "middle" ? "center" : layer.align === "end" ? "right" : "left";
        ctx.textBaseline = "alphabetic";
        const startY = layer.y + (layer.h - lh * lines.length) / 2 + layer.fontSize * 0.82;
        const x = layer.align === "middle" ? layer.x + layer.w / 2 : layer.align === "end" ? layer.x + layer.w : layer.x;
        lines.forEach((line, i) => {
          ctx.fillText(line, x, startY + i * lh, layer.w);
        });
      });
    }
  }

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG 생성 실패"));
    }, "image/png");
  });
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function fileStem(briefName: string, letter: string) {
  const base = (briefName || "시안").replace(/[\\/:*?"<>|]/g, "").slice(0, 24);
  return `${base}_시안${letter}`;
}
