import assert from "node:assert/strict";
import test from "node:test";
import { assignStory, fitDurations } from "./director.ts";

test("founding and ending photos are not left in upload order", () => {
  const story = assignStory([
    { id: "a", name: "행사1.jpg", caption: "운동회" },
    { id: "b", name: "old.jpg", caption: "1977 창단식" },
    { id: "c", name: "end.jpg", caption: "감사합니다" },
  ]);
  assert.equal(story.find((photo) => photo.id === "b")?.beat, "founding");
  assert.equal(story.find((photo) => photo.id === "c")?.beat, "thanks");
  const timed = fitDurations(story, 180);
  const total = timed.reduce((sum, photo) => sum + photo.seconds, 0);
  assert.ok(Math.abs(total - 180) < 0.2);
  assert.ok((timed.find((photo) => photo.id === "b")?.seconds ?? 0) > (timed.find((photo) => photo.caption === "운동회")?.seconds ?? 99));
});
