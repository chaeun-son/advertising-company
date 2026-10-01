export type ImageEditKind =
  | "remove-bg"
  | "sharpen"
  | "upscale"
  | "erase"
  | "extend"
  | "face"
  | "product"
  | "color"
  | "brighten"
  | "blur-bg"
  | "shadow";

type Frame = { data: Uint8ClampedArray; w: number; h: number };

function copyFrame(src: Uint8ClampedArray, w: number, h: number): Frame {
  return { data: new Uint8ClampedArray(src), w, h };
}

function idx(w: number, x: number, y: number) {
  return (y * w + x) * 4;
}

function blur(frame: Frame, radius: number): Frame {
  const { data, w, h } = frame;
  const out = new Uint8ClampedArray(data.length);
  const r = Math.max(1, radius);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let rs = 0, gs = 0, bs = 0, n = 0;
      for (let dy = -r; dy <= r; dy += 1) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -r; dx <= r; dx += 1) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const i = idx(w, xx, yy);
          rs += data[i]; gs += data[i + 1]; bs += data[i + 2]; n += 1;
        }
      }
      const o = idx(w, x, y);
      out[o] = rs / n; out[o + 1] = gs / n; out[o + 2] = bs / n; out[o + 3] = data[o + 3];
    }
  }
  return { data: out, w, h };
}

function sharpenRegion(frame: Frame, x0 = 0, y0 = 0, x1 = frame.w, y1 = frame.h, amount = 0.7) {
  const soft = blur(frame, 1);
  const { data } = frame;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = idx(frame.w, x, y);
      for (let c = 0; c < 3; c += 1) data[i + c] = Math.max(0, Math.min(255, data[i + c] + (data[i + c] - soft.data[i + c]) * amount));
    }
  }
}

function cornerColor(frame: Frame) {
  const { data, w, h } = frame;
  const spots = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of spots) {
    const i = idx(w, Math.max(0, x), Math.max(0, y));
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  return [r / 4, g / 4, b / 4];
}

export function processPixels(src: Uint8ClampedArray, w: number, h: number, kind: ImageEditKind, focus?: { x: number; y: number; w: number; h: number }): Frame {
  const frame = copyFrame(src, w, h);
  if (kind === "remove-bg") {
    const [cr, cg, cb] = cornerColor(frame);
    for (let i = 0; i < frame.data.length; i += 4) {
      const dist = Math.hypot(frame.data[i] - cr, frame.data[i + 1] - cg, frame.data[i + 2] - cb);
      frame.data[i + 3] = dist < 42 ? 0 : dist < 78 ? Math.round(((dist - 42) / 36) * 255) : frame.data[i + 3];
    }
    return frame;
  }
  if (kind === "sharpen" || kind === "face" || kind === "product") {
    if (kind === "face") sharpenRegion(frame, Math.round(w * 0.2), Math.round(h * 0.08), Math.round(w * 0.8), Math.round(h * 0.62), 1);
    else if (kind === "product") sharpenRegion(frame, Math.round(w * 0.15), Math.round(h * 0.15), Math.round(w * 0.85), Math.round(h * 0.85), 0.95);
    else sharpenRegion(frame, 0, 0, w, h, 0.85);
    return frame;
  }
  if (kind === "upscale") {
    const nw = w * 2;
    const nh = h * 2;
    const out = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y += 1) {
      for (let x = 0; x < nw; x += 1) {
        const sx = Math.min(w - 1, Math.floor(x / 2));
        const sy = Math.min(h - 1, Math.floor(y / 2));
        const from = idx(w, sx, sy);
        const to = idx(nw, x, y);
        out[to] = src[from]; out[to + 1] = src[from + 1]; out[to + 2] = src[from + 2]; out[to + 3] = src[from + 3];
      }
    }
    const scaled = { data: out, w: nw, h: nh };
    sharpenRegion(scaled, 0, 0, nw, nh, 0.45);
    return scaled;
  }
  if (kind === "color" || kind === "brighten") {
    const { data } = frame;
    for (let c = 0; c < 3; c += 1) {
      let min = 255, max = 0, sum = 0, n = 0;
      for (let i = c; i < data.length; i += 4) { min = Math.min(min, data[i]); max = Math.max(max, data[i]); sum += data[i]; n += 1; }
      const mean = sum / Math.max(1, n);
      const lift = kind === "brighten" ? (mean < 140 ? 1.22 : 1.08) : 1;
      for (let i = c; i < data.length; i += 4) {
        const stretched = max === min ? data[i] : ((data[i] - min) / (max - min)) * 255;
        data[i] = Math.max(0, Math.min(255, stretched * lift));
      }
    }
    return frame;
  }
  if (kind === "blur-bg") {
    const soft = blur(frame, 4);
    const box = focus ?? { x: 0.28, y: 0.16, w: 0.44, h: 0.62 };
    const x0 = Math.round(box.x * w);
    const y0 = Math.round(box.y * h);
    const x1 = Math.round((box.x + box.w) * w);
    const y1 = Math.round((box.y + box.h) * h);
    const out = soft.data.slice();
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = idx(w, x, y);
        out[i] = frame.data[i]; out[i + 1] = frame.data[i + 1]; out[i + 2] = frame.data[i + 2]; out[i + 3] = frame.data[i + 3];
      }
    }
    return { data: out, w, h };
  }
  if (kind === "erase") {
    const box = focus
      ? (focus.x + focus.w / 2 > 0.5 ? { x: 0.02, y: 0.05, w: 0.2, h: 0.24 } : { x: 0.74, y: 0.06, w: 0.2, h: 0.24 })
      : { x: 0.74, y: 0.06, w: 0.2, h: 0.24 };
    const x0 = Math.max(1, Math.round(box.x * w));
    const y0 = Math.max(1, Math.round(box.y * h));
    const x1 = Math.min(w - 2, Math.round((box.x + box.w) * w));
    const y1 = Math.min(h - 2, Math.round((box.y + box.h) * h));
    const sample = idx(w, Math.max(0, x0 - 1), y0);
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const i = idx(w, x, y);
        frame.data[i] = frame.data[sample];
        frame.data[i + 1] = frame.data[sample + 1];
        frame.data[i + 2] = frame.data[sample + 2];
        frame.data[i + 3] = frame.data[sample + 3];
      }
    }
    return blur(frame, 1);
  }
  if (kind === "extend") {
    const nw = Math.round(w * 1.28);
    const nh = Math.round(h * 1.28);
    const out = new Uint8ClampedArray(nw * nh * 4);
    const ox = Math.round((nw - w) / 2);
    const oy = Math.round((nh - h) / 2);
    for (let y = 0; y < nh; y += 1) {
      for (let x = 0; x < nw; x += 1) {
        const sx = Math.min(w - 1, Math.max(0, x - ox));
        const sy = Math.min(h - 1, Math.max(0, y - oy));
        const from = idx(w, sx, sy);
        const to = idx(nw, x, y);
        out[to] = src[from]; out[to + 1] = src[from + 1]; out[to + 2] = src[from + 2]; out[to + 3] = src[from + 3];
      }
    }
    return blur({ data: out, w: nw, h: nh }, 1);
  }
  if (kind === "shadow") {
    const pad = Math.round(Math.max(w, h) * 0.08);
    const nw = w + pad * 2;
    const nh = h + pad * 2;
    const out = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const from = idx(w, x, y);
        if (src[from + 3] < 8) continue;
        const to = idx(nw, x + pad, y + pad + Math.round(pad * 0.35));
        out[to] = 20; out[to + 1] = 16; out[to + 2] = 12; out[to + 3] = 90;
      }
    }
    const shaded = blur({ data: out, w: nw, h: nh }, 2);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const from = idx(w, x, y);
        const to = idx(nw, x + pad, y + pad);
        if (src[from + 3] < 8) continue;
        shaded.data[to] = src[from]; shaded.data[to + 1] = src[from + 1]; shaded.data[to + 2] = src[from + 2]; shaded.data[to + 3] = src[from + 3];
      }
    }
    return shaded;
  }
  return frame;
}

export async function editImage(href: string, kind: ImageEditKind, focus?: { x: number; y: number; w: number; h: number }) {
  const image = await loadImage(href);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !canvas.width) throw new Error("이미지를 열 수 없습니다.");
  ctx.drawImage(image, 0, 0);
  const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const next = processPixels(source.data, canvas.width, canvas.height, kind, focus);
  const out = document.createElement("canvas");
  out.width = next.w;
  out.height = next.h;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("이미지를 저장하지 못했습니다.");
  const pixels = new Uint8ClampedArray(next.data);
  octx.putImageData(new ImageData(pixels, next.w, next.h), 0, 0);
  return { href: out.toDataURL("image/png"), width: next.w, height: next.h };
}

function loadImage(href: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 열 수 없습니다."));
    image.src = href;
  });
}
