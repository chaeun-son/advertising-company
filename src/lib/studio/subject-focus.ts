import type { ImageLayer } from "./types";

/** 얼굴 인식 모델 없이, 대비·채도가 몰린 영역을 피사체로 잡는다. */
export async function detectSubject(href: string): Promise<ImageLayer["focus"]> {
  const image = await load(href);
  const cols = 12;
  const rows = 8;
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { x: 0.3, y: 0.12, w: 0.4, h: 0.46 };
  ctx.drawImage(image, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const score = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i += 1) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const y = i >= cols ? Math.abs(data[i * 4] - data[(i - cols) * 4]) : 0;
    score[i] = sat * 1.4 + y / 255;
  }
  const values = [...score].sort((a, b) => a - b);
  const cut = values[Math.floor(values.length * 0.62)] ?? 0;
  let minX = cols;
  let minY = rows;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (score[y * cols + x] < cut) continue;
      hits += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (hits < 3) return { x: 0.28, y: 0.1, w: 0.44, h: 0.5 };
  const pad = 0.04;
  const x = Math.max(0, minX / cols - pad);
  const y = Math.max(0, minY / rows - pad);
  const w = Math.min(1 - x, (maxX + 1) / cols - x + pad);
  const h = Math.min(1 - y, (maxY + 1) / rows - y + pad);
  return { x, y, w, h };
}

function load(href: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 열 수 없습니다."));
    image.src = href;
  });
}
