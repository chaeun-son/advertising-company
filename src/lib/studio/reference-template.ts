import type { Brief, Draft, Layer, TextLayer } from "./types";

const W = 2500;
const H = 700;
const base = "/reference-banner.svg";

function text(id: string, role: TextLayer["role"], value: string, x: number, y: number, w: number, h: number, size: number, fill: string, weight = 700): TextLayer {
  return { id, type: "text", role, x, y, w, h, text: value, fontFamily: "'Noto Sans KR', sans-serif", fontWeight: weight, fontSize: size, fill, align: "middle" };
}

export function referenceBrief(brief: Brief): Brief {
  return {
    ...brief, sizeId: "custom", customW: W, customH: H, industry: "event", purpose: "custom",
    mood: "warm", name: "보훈가족 봉사활동", headline: "2026 보훈가족 온 하우스 프로젝트",
    subhead: "사랑과 나눔으로 더 따뜻한 세상을 만들어갑니다.",
    notes: "보훈가족과 함께하는 따뜻한 나눔. 꽃과 자연, 봉사 장면을 밝고 화사하게 표현",
    baseColor: "#123579", accentColor: "#e52d86",
  };
}

export function referenceDraft(brief: Brief, width = W, height = H): Draft {
  if (width / height < 2) {
    const sx = width / 1000;
    const sy = height / 1000;
    const t = (id: string, role: TextLayer["role"], value: string, x: number, y: number, w: number, h: number, size: number, fill: string, weight = 700) =>
      text(id, role, value, x * sx, y * sy, w * sx, h * sy, size * sx, fill, weight);
    const layers: Layer[] = [
      { id: "reference-bg", type: "image", role: "background", name: "꽃과 자연 배경", x: 0, y: 0, w: width, h: height, href: "/reference-poster.svg", fit: "responsive", locked: true },
      t("reference-kicker", "notes", "보훈가족과 함께하는 따뜻한 나눔", 155, 190, 690, 66, 34, "#133675", 600),
      t("reference-title-prefix", "headline", "2026 보훈가족", 90, 315, 820, 100, 79, "#133675", 900),
      t("reference-title-accent", "headline", "온 하우스", 115, 410, 770, 110, 95, "#e52d86", 900),
      t("reference-title-suffix", "headline", "프로젝트", 115, 510, 770, 110, 95, "#1756b6", 900),
      { id: "reference-pill", type: "rect", name: "봉사활동 라벨 배경", x: 350 * sx, y: 655 * sy, w: 300 * sx, h: 74 * sy, fill: "#1671c7", radius: 37 * Math.min(sx, sy) },
      t("reference-label", "name", "봉사활동", 350, 658, 300, 68, 48, "#ffffff", 800),
      t("reference-sub", "subhead", brief.subhead || "사랑과 나눔으로 더 따뜻한 세상을 만들어갑니다.", 130, 748, 740, 84, 30, "#182542", 600),
      t("reference-logo1", "notes", "◉  국가보훈처", 85, 877, 270, 56, 26, "#143577", 800),
      t("reference-logo2", "notes", "✿  한국보훈복지의료공단", 345, 877, 350, 56, 23, "#24314e", 800),
      t("reference-logo3", "notes", "✦  우리사회공헌재단", 690, 877, 275, 56, 23, "#1764aa", 800),
    ];
    return {
      id: `reference-${Date.now()}`, letter: "A", title: "따뜻한 보훈가족 포스터", source: "reference", layoutVersion: 2, width, height, layers,
      palette: { bg: "#f4fbff", panel: "#ffffff", text: "#133675", muted: "#607899", accent: "#e52d86", onAccent: "#ffffff" },
    };
  }
  const layers: Layer[] = [
    { id: "reference-bg", type: "image", role: "background", name: "꽃과 자연 배경", x: 0, y: 0, w: W, h: H, href: base, fit: "responsive", locked: true },
    text("reference-kicker", "notes", "보훈가족과 함께하는 따뜻한 나눔", 430, 70, 1640, 70, 36, "#133675", 700),
    text("reference-title-prefix", "headline", "2026 보훈가족", 280, 175, 860, 130, 78, "#133675", 900),
    text("reference-title-accent", "headline", "온 하우스", 1120, 175, 480, 130, 78, "#e52d86", 900),
    text("reference-title-suffix", "headline", "프로젝트", 1600, 175, 520, 130, 78, "#1756b6", 900),
    { id: "reference-pill", type: "rect", name: "봉사활동 라벨 배경", x: 620, y: 360, w: 340, h: 78, fill: "#1671c7", radius: 39 },
    text("reference-label", "name", "봉사활동", 620, 362, 340, 74, 36, "#ffffff", 800),
    text("reference-sub", "subhead", brief.subhead || "사랑과 나눔으로 더 따뜻한 세상을 만들어갑니다.", 980, 360, 1100, 78, 32, "#182542", 600),
    text("reference-logo1", "notes", "●  국가보훈처", 560, 540, 420, 56, 28, "#143577", 800),
    text("reference-logo2", "notes", "✿  한국보훈복지의료공단", 980, 540, 620, 56, 26, "#24314e", 800),
    text("reference-logo3", "notes", "✦  우리사회공헌재단", 1600, 540, 480, 56, 26, "#1764aa", 800),
  ];
  const scaleX = width / W;
  const scaleY = height / H;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (width - W * scale) / 2;
  const offsetY = (height - H * scale) / 2;
  return {
    id: `reference-${Date.now()}`, letter: "A", title: "따뜻한 보훈가족 현수막", source: "reference", layoutVersion: 2, width, height,
    layers: layers.map((layer) => layer.type === "image" && layer.role === "background"
      ? { ...layer, x: 0, y: 0, w: width, h: height }
      : ({
        ...layer, x: offsetX + layer.x * scale, y: offsetY + layer.y * scale, w: layer.w * scale, h: layer.h * scale,
        ...(layer.type === "text" ? { fontSize: layer.fontSize * scale } : {}),
        ...(layer.type === "rect" && layer.radius ? { radius: layer.radius * scale } : {}),
      } as Layer)),
    palette: { bg: "#f4fbff", panel: "#ffffff", text: "#133675", muted: "#607899", accent: "#e52d86", onAccent: "#ffffff" },
  };
}
