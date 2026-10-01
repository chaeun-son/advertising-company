import assert from "node:assert/strict";
import test from "node:test";
import { avcCodec, exportBitrate, frameCount } from "./export-presets.ts";

test("1080p 30fps is the default quality step", () => {
  assert.equal(exportBitrate(1080, 30), 8_000_000);
  assert.equal(avcCodec(1080), "avc1.640028");
  assert.equal(frameCount(2, 30), 60);
});

test("4k and 60fps raise the bitrate", () => {
  assert.ok(exportBitrate(2160, 60) > exportBitrate(720, 30));
});
