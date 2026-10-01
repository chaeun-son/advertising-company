import assert from "node:assert/strict";
import test from "node:test";
import { assignStory, fitDurations, keepUserOrder } from "./director.ts";

const photos = [
  { id: "a", name: "행사1.jpg", caption: "운동회" },
  { id: "b", name: "old.jpg", caption: "1977 창단식" },
  { id: "c", name: "end.jpg", caption: "감사합니다" },
];

test("director keeps upload order unless a story reorder is requested", () => {
  const story = assignStory(photos);
  assert.deepEqual(story.map((photo) => photo.id), ["a", "b", "c"]);
  assert.equal(story.find((photo) => photo.id === "b")?.beat, "founding");
  assert.equal(story.find((photo) => photo.id === "c")?.beat, "thanks");
  const kept = fitDurations(photos, 180);
  assert.deepEqual(kept.map((photo) => photo.id), ["a", "b", "c"]);
  const total = kept.reduce((sum, photo) => sum + photo.seconds, 0);
  assert.ok(Math.abs(total - 180) < 0.2);
  assert.ok((kept.find((photo) => photo.id === "b")?.seconds ?? 0) > (kept.find((photo) => photo.id === "a")?.seconds ?? 99));
  const rearranged = fitDurations(photos, 180, true);
  assert.deepEqual(rearranged.map((photo) => photo.id), ["b", "a", "c"]);
});

test("timeline order wins over filenames and untouched photos stay behind it", () => {
  const ordered = keepUserOrder(
    [
      { id: "z", name: "a-first.jpg" },
      { id: "m", name: "m.jpg" },
      { id: "a", name: "z-last.jpg" },
    ],
    ["a", "z"],
  );
  assert.deepEqual(ordered.map((photo) => photo.id), ["a", "z", "m"]);
});
