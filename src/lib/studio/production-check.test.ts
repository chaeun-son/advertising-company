import assert from "node:assert/strict";
import test from "node:test";
import { applyProductionFix, reviewDraft } from "./production-check.ts";
import { reflowToSize } from "./reflow.ts";
import { focusIsCropped } from "./image-fit.ts";
import type { Brief, Draft } from "./types.ts";

const brief = {
  name: "무형회",
  headline: "창단 50주년",
  subhead: "함께하는 하루",
  phone: "010-1234-5678",
  date: "10월 15일까지",
  price: "",
  notes: "",
  baseColor: "#ffffff",
} as Brief;

function draft(partial: Partial<Draft> = {}): Draft {
  return {
    id: "d1",
    letter: "A",
    title: "시안",
    source: "type",
    width: 2500,
    height: 700,
    palette: { bg: "#ffffff", panel: "#fff", text: "#111111", muted: "#666", accent: "#f08c00", onAccent: "#fff" },
    layers: [
      { id: "h", type: "text", role: "headline", x: 80, y: 180, w: 1200, h: 160, text: "창단 50주년", fontFamily: "Pretendard", fontWeight: 800, fontSize: 120, fill: "#111111", align: "start" },
      { id: "p", type: "text", role: "phone", x: 80, y: 520, w: 600, h: 28, text: "010-0000-0000", fontFamily: "Pretendard", fontWeight: 600, fontSize: 18, fill: "#111111", align: "start" },
    ],
    ...partial,
  };
}

test("review finds missing copy and a small phone, and the fix only grows small type", () => {
  const rows = reviewDraft(draft(), brief);
  assert.equal(rows.some((row) => row.text.includes("무형회")), true);
  assert.equal(rows.some((row) => row.text.includes("전화번호가 너무 작습니다")), true);
  const fixed = applyProductionFix(draft(), brief, "grow-small");
  const phone = fixed.layers.find((layer) => layer.type === "text" && layer.role === "phone");
  const headline = fixed.layers.find((layer) => layer.type === "text" && layer.role === "headline");
  assert.ok(phone && phone.type === "text" && phone.fontSize > 18);
  assert.ok(headline && headline.type === "text" && headline.fontSize === 120);
});

test("reflow keeps the original and places the photo differently for wide and tall sizes", () => {
  const source = draft({
    layers: [
      ...draft().layers,
      { id: "photo", type: "image", role: "photo", x: 1400, y: 40, w: 900, h: 620, href: "/photo.jpg", fit: "cover", intrinsicWidth: 2000, intrinsicHeight: 1400, focus: { x: 0.3, y: 0.1, w: 0.4, h: 0.5 } },
    ],
  });
  const wide = reflowToSize(source, 5000, 900, "500×90cm");
  const tall = reflowToSize(source, 600, 1800, "60×180cm");
  assert.notEqual(wide.id, source.id);
  assert.equal(source.width, 2500);
  const widePhoto = wide.layers.find((layer) => layer.type === "image" && layer.role === "photo");
  const tallPhoto = tall.layers.find((layer) => layer.type === "image" && layer.role === "photo");
  assert.ok(widePhoto && widePhoto.x > wide.width * 0.5);
  assert.ok(tallPhoto && tallPhoto.y > tall.height * 0.2);
  assert.ok(wide.layers.some((layer) => layer.type === "text" && layer.role === "headline"));
});

test("a face marked at the top stays detected as cropped when cover is centered on a wide frame", () => {
  const cropped = focusIsCropped({
    x: 0, y: 0, w: 1000, h: 200, fit: "cover",
    focus: { x: 0.05, y: 0.02, w: 0.15, h: 0.2 },
  }, 800, 1200);
  assert.equal(cropped, true);
});
