import type { Align, TextZone } from "./types";

export type AiTextLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  align: Align;
  zone: TextZone;
  compact: boolean;
};

/**
 * Stable typography regions for AI drafts.
 * On extreme-wide banners, keep all copy in the side bands so the sharp source
 * image remains unobstructed in the center. A/B/C deliberately use different
 * placements while staying inside print-safe margins.
 */
export function aiTextLayout(
  width: number,
  height: number,
  zone: TextZone,
  letter: "A" | "B" | "C",
): AiTextLayout {
  const ratio = width / height;
  if (ratio >= 3) {
    if (letter === "A") {
      return { x: width * 0.04, y: height * 0.14, w: width * 0.27, h: height * 0.68, align: "start", zone: "left", compact: false };
    }
    if (letter === "B") {
      return { x: width * 0.69, y: height * 0.14, w: width * 0.27, h: height * 0.68, align: "end", zone: "right", compact: false };
    }
    return { x: width * 0.04, y: height * 0.50, w: width * 0.29, h: height * 0.36, align: "start", zone: "left", compact: true };
  }

  const box =
    zone === "left" ? { x: 0, y: 0, w: width * 0.5, h: height }
    : zone === "right" ? { x: width * 0.5, y: 0, w: width * 0.5, h: height }
    : zone === "top" ? { x: 0, y: 0, w: width, h: height * 0.46 }
    : zone === "bottom" ? { x: 0, y: height * 0.54, w: width, h: height * 0.46 }
    : { x: width * 0.08, y: height * 0.12, w: width * 0.84, h: height * 0.76 };
  return {
    ...box,
    align: zone === "right" ? "end" : zone === "center" ? "middle" : "start",
    zone,
    compact: false,
  };
}
