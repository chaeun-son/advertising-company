import { customerLogo, TITLE_STYLE_BG, type TitleCard, type TitleMotion, type TitleStyle } from "./slideshow";

type Bitmap = CanvasImageSource & { complete?: boolean; naturalWidth?: number; naturalHeight?: number };

const INK: Record<TitleStyle, { ink: string; muted: string; accent: string; main: number; weight: number; rule: boolean; frame: boolean }> = {
  luxury: { ink: "#f6efe4", muted: "#d9c4a4", accent: "#e0b56a", main: 76, weight: 500, rule: true, frame: false },
  emotion: { ink: "#fff6f1", muted: "#f0d0c2", accent: "#e7a898", main: 68, weight: 500, rule: true, frame: false },
  simple: { ink: "#f5f5f2", muted: "#bdbdb8", accent: "#f5f5f2", main: 64, weight: 600, rule: false, frame: false },
  grand: { ink: "#f8f1de", muted: "#ddc98a", accent: "#e6c36a", main: 84, weight: 700, rule: true, frame: true },
};

export function titleMotionAt(motion: TitleMotion, local: number, seconds: number) {
  const span = Math.max(0.1, seconds);
  const t = Math.max(0, Math.min(1, local)) * span;
  const fadeIn = Math.min(1, t / 1.05);
  const fadeOut = Math.min(1, Math.max(0, span - t) / 0.7);
  const alpha = Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
  if (motion === "slow-zoom") return { alpha, scale: 1 + 0.045 * Math.min(1, t / span), y: 0 };
  if (motion === "slide-up") return { alpha, scale: 1, y: (1 - fadeIn) * 36 };
  return { alpha, scale: 1, y: 0 };
}

function ready(image: Bitmap | undefined): image is Bitmap {
  if (!image) return false;
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) return image.complete && image.naturalWidth > 0;
  const width = image.naturalWidth ?? 0;
  return width > 0 || image.complete === undefined;
}

function cover(ctx: CanvasRenderingContext2D, source: Bitmap, w: number, h: number) {
  const sw = source.naturalWidth || w;
  const sh = source.naturalHeight || h;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function setFont(ctx: CanvasRenderingContext2D, weight: number, size: number, tracking = 0) {
  ctx.font = `${weight} ${size}px "IBM Plex Sans KR", "Noto Sans KR", sans-serif`;
  const styled = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in styled) styled.letterSpacing = `${tracking}px`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (ctx.measureText(clean).width <= maxWidth) return [clean];
  const chars = [...clean];
  let line = "";
  const lines: string[] = [];
  for (const ch of chars) {
    const next = line + ch;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = ch;
      if (lines.length === 2) break;
    } else line = next;
  }
  if (lines.length < 2 && line) lines.push(line);
  if (lines.length > 2) lines.length = 2;
  const last = lines[lines.length - 1] ?? "";
  if (lines.length === 2 && ctx.measureText(last).width > maxWidth) {
    let fitted = last;
    while ([...fitted].length > 1 && ctx.measureText(`${fitted}…`).width > maxWidth) fitted = [...fitted].slice(0, -1).join("");
    lines[lines.length - 1] = `${fitted}…`;
  }
  return lines;
}

type Row =
  | { kind: "logo"; gap: number }
  | { kind: "rule"; gap: number; width: number }
  | { kind: "text"; text: string; size: number; weight: number; color: string; gap: number; tracking: number };

function rowsFor(card: TitleCard, look: (typeof INK)[TitleStyle]): Row[] {
  const rows: Row[] = [];
  const date = card.date.trim();
  const logo = Boolean(customerLogo(card.logo));
  if (card.role === "ending" && date) rows.push({ kind: "text", text: date, size: 20, weight: 500, color: look.muted, gap: 18, tracking: 3 });
  if (logo) rows.push({ kind: "logo", gap: card.role === "intro" ? 26 : 20 });
  if (card.role === "intro" && date) rows.push({ kind: "text", text: date, size: 20, weight: 500, color: look.muted, gap: 16, tracking: 3.5 });
  if (look.rule) rows.push({ kind: "rule", gap: 18, width: card.style === "grand" ? 148 : card.style === "luxury" ? 92 : 56 });
  rows.push({ kind: "text", text: card.main.trim() || (card.role === "intro" ? "제목" : "감사합니다"), size: look.main, weight: look.weight, color: look.ink, gap: 14, tracking: card.style === "simple" ? 0 : 1 });
  if (card.role === "intro" && card.sub.trim()) {
    rows.push({ kind: "text", text: card.sub.trim(), size: 30, weight: 500, color: look.muted, gap: 8, tracking: 0.5 });
  }
  if (card.role === "ending" && card.sub.trim()) {
    rows.push({ kind: "text", text: card.sub.trim(), size: 28, weight: 500, color: look.muted, gap: 16, tracking: 0.4 });
  } else if (card.role === "ending" && card.thanks.trim()) {
    rows.push({ kind: "text", text: card.thanks.trim(), size: 28, weight: 500, color: look.muted, gap: 16, tracking: 0.4 });
  }
  if (card.role === "ending" && card.org.trim()) {
    rows.push({ kind: "text", text: card.org.trim(), size: 22, weight: 600, color: look.accent, gap: 0, tracking: 1.5 });
  }
  return rows;
}

function rowHeight(ctx: CanvasRenderingContext2D, row: Row, maxWidth: number) {
  if (row.kind === "logo") return 72;
  if (row.kind === "rule") return 2;
  setFont(ctx, row.weight, row.size, row.tracking);
  return wrapLines(ctx, row.text, maxWidth).length * row.size * 1.22;
}

export function paintTitleCard(
  ctx: CanvasRenderingContext2D,
  card: TitleCard,
  w: number,
  h: number,
  local: number,
  images?: { get(key: string): Bitmap | undefined },
) {
  const look = INK[card.style] ?? INK.luxury;
  const motion = titleMotionAt(card.motion, local, card.seconds);
  ctx.save();
  ctx.globalAlpha *= motion.alpha;
  ctx.fillStyle = card.bg || TITLE_STYLE_BG[card.style] || "#14110e";
  ctx.fillRect(0, 0, w, h);
  const bg = card.bgImage ? images?.get(card.bgImage) : undefined;
  if (ready(bg)) {
    ctx.save();
    if (card.motion === "slow-zoom") {
      const zoom = 1 + 0.04 * Math.min(1, Math.max(0, local));
      ctx.translate(w / 2, h / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-w / 2, -h / 2);
    }
    cover(ctx, bg, w, h);
    ctx.restore();
    ctx.fillStyle = "rgba(8,6,4,0.5)";
    ctx.fillRect(0, 0, w, h);
  }
  if (card.style === "emotion") {
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, h * 0.04, w * 0.5, h * 0.55, w * 0.62);
    glow.addColorStop(0, "rgba(255, 214, 196, 0.2)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
  if (card.style === "luxury" || card.style === "grand") {
    const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.16, w / 2, h / 2, w * 0.7);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.48)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }
  if (look.frame) {
    ctx.save();
    ctx.strokeStyle = look.accent;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha *= 0.9;
    ctx.strokeRect(46, 40, w - 92, h - 80);
    ctx.globalAlpha *= 0.55;
    ctx.strokeRect(58, 52, w - 116, h - 104);
    ctx.restore();
  }

  const rows = rowsFor(card, look);
  const maxWidth = w * (card.style === "grand" ? 0.72 : 0.78);
  const gapBefore = rows.map((row) => row.gap);
  const heights = rows.map((row) => rowHeight(ctx, row, maxWidth));
  const block = heights.reduce((sum, height, index) => sum + height + (index === 0 ? 0 : gapBefore[index - 1] ?? 0), 0);
  let y = (h - block) / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const logoUrl = customerLogo(card.logo);
  const logo = logoUrl ? images?.get(logoUrl) : undefined;
  rows.forEach((row, index) => {
    if (index > 0) y += gapBefore[index - 1] ?? 0;
    const height = heights[index] ?? 0;
    ctx.save();
    ctx.translate(w / 2, y + height / 2 + motion.y);
    ctx.scale(motion.scale, motion.scale);
    if (row.kind === "logo" && ready(logo)) {
      const sw = logo.naturalWidth || 1;
      const sh = logo.naturalHeight || 1;
      const scale = Math.min(72 / sh, 280 / sw);
      ctx.drawImage(logo, (-sw * scale) / 2, (-sh * scale) / 2, sw * scale, sh * scale);
    } else if (row.kind === "rule") {
      ctx.fillStyle = look.accent;
      ctx.globalAlpha *= card.style === "emotion" ? 0.75 : 0.95;
      ctx.fillRect(-row.width / 2, -1, row.width, 2);
    } else if (row.kind === "text") {
      setFont(ctx, row.weight, row.size, row.tracking);
      const lines = wrapLines(ctx, row.text, maxWidth);
      const lineH = row.size * 1.22;
      ctx.fillStyle = row.color;
      if (card.style !== "simple") {
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 2;
      }
      lines.forEach((line, lineIndex) => {
        const ly = -((lines.length - 1) * lineH) / 2 + lineIndex * lineH;
        ctx.fillText(line, 0, ly);
      });
    }
    ctx.restore();
    y += height;
  });
  const styled = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in styled) styled.letterSpacing = "0px";
  ctx.restore();
}
