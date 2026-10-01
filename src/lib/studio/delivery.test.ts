import assert from "node:assert/strict";
import test from "node:test";
import { composeDesignerDrafts } from "./designer.ts";
import { processPixels } from "./image-edit.ts";
import type { Brief } from "./types.ts";

const brief = {
  name: "무형회",
  headline: "창단 50주년",
  subhead: "함께한 시간",
  phone: "010-1234-5678",
  date: "10월 15일까지",
  price: "",
  titleFont: "Pretendard",
  bodyFont: "Pretendard",
} as Brief;

test("designer builds three different drafts and keeps the headline", () => {
  const drafts = composeDesignerDrafts(brief, 2500, 700, { photo: "/photo.jpg", logo: "/logo.png" });
  assert.equal(drafts.length, 3);
  assert.equal(new Set(drafts.map((draft) => draft.title)).size, 3);
  assert.equal(new Set(drafts.map((draft) => draft.palette.bg)).size, 3);
  for (const draft of drafts) {
    assert.equal(draft.layers.some((layer) => layer.type === "text" && layer.text.includes("창단 50주년")), true);
    assert.equal(draft.layers.some((layer) => layer.type === "image" && layer.role === "photo"), true);
  }
});

test("background removal keeps the dark subject and clears a flat corner", () => {
  const w = 8;
  const h = 8;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 250; data[i + 1] = 250; data[i + 2] = 250; data[i + 3] = 255;
  }
  const center = (3 * w + 3) * 4;
  data[center] = 10; data[center + 1] = 10; data[center + 2] = 10; data[center + 3] = 255;
  const next = processPixels(data, w, h, "remove-bg");
  assert.equal(next.data[3], 0);
  assert.equal(next.data[center + 3], 255);
});
