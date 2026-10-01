import assert from "node:assert/strict";
import test from "node:test";
import { fileKind, planSlideshow, slideshowDuration } from "./slideshow.ts";

test("photo files are images even without a mime type", () => {
  assert.equal(fileKind({ type: "", name: "IMG_7141.JPG" }), "image");
  assert.equal(fileKind({ type: "application/octet-stream", name: "shot.heic" }), "image");
  assert.equal(fileKind({ type: "video/mp4", name: "clip.mp4" }), "video");
});

test("photos and captions become a timed slideshow", () => {
  const clips = planSlideshow([
    { id: "a", name: "a.jpg", url: "blob:a", caption: "첫 장면" },
    { id: "b", name: "b.jpg", url: "blob:b", caption: "" },
  ]);
  assert.equal(clips.length, 3);
  assert.equal(clips[0]?.kind, "image");
  assert.equal(clips[0]?.start, 0);
  assert.equal(clips[1]?.kind, "text");
  assert.equal(clips[1]?.text, "첫 장면");
  assert.equal(clips[2]?.start, 4);
  assert.equal(slideshowDuration(clips), 8);
});
