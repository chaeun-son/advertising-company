import assert from "node:assert/strict";
import test from "node:test";
import { avcCodec, bedLevel, bedStops, exportBitrate, frameCount, gainStops, heardLevel, levelAt } from "./export-presets.ts";

test("1080p 30fps is the default quality step", () => {
  assert.equal(exportBitrate(1080, 30), 8_000_000);
  assert.equal(avcCodec(1080), "avc1.640028");
  assert.equal(frameCount(2, 30), 60);
});

test("4k and 60fps raise the bitrate", () => {
  assert.ok(exportBitrate(2160, 60) > exportBitrate(720, 30));
});

test("ending fade lowers the level only inside the ending window", () => {
  assert.equal(levelAt(0.7, 10, 50, 7), 0.7);
  assert.ok(Math.abs(levelAt(0.7, 53.5, 50, 7) - 0.35) < 0.001);
  assert.equal(levelAt(0.7, 57, 50, 7), 0);
  assert.equal(levelAt(0.7, 57), 0.7);
});

test("video audio ducks the bed, then the ending title fades it to silence", () => {
  const ducks = [{ start: 20, end: 38, level: 0.32 }];
  assert.ok(Math.abs(heardLevel(0.7, 10, 50, 6, ducks) - 0.7) < 0.001);
  const mid = heardLevel(0.7, 29, 50, 6, ducks);
  assert.ok(mid < 0.7 * 0.4 && mid > 0.7 * 0.25);
  assert.ok(heardLevel(0.7, 45, 50, 6, ducks) > 0.6);
  assert.ok(heardLevel(0.7, 53, 50, 6, ducks) < 0.4);
  assert.equal(heardLevel(0.7, 56, 50, 6, ducks), 0);
  const stops = gainStops(0.7, 56, 50, 6, ducks);
  assert.equal(stops.at(-1)?.v, 0);
  assert.ok((stops[0]?.v ?? 0) > 0.6);
});

test("clip fade in, fade out, and ducking stack", () => {
  assert.equal(bedLevel(0.8, 0, 0, 10, 1, 1), 0);
  assert.ok(Math.abs(bedLevel(0.8, 0.5, 0, 10, 1, 1) - 0.4) < 0.001);
  assert.ok(Math.abs(bedLevel(0.8, 5, 0, 10, 1, 1) - 0.8) < 0.001);
  assert.ok(bedLevel(0.8, 9.5, 0, 10, 1, 1) < 0.45);
  const ducked = bedLevel(0.8, 5, 0, 10, 0, 0, undefined, undefined, [{ start: 4, end: 6, level: 0.32 }]);
  assert.ok(ducked < 0.8 * 0.4);
  const stops = bedStops(0.8, 0, 10, 1, 1);
  assert.equal(stops[0]?.v, 0);
  assert.equal(stops.at(-1)?.v, 0);
  const short = bedStops(0.8, 0, 2, 0.4, 0.5, undefined, undefined, [{ start: 0.8, end: 1.2, level: 0.3 }]);
  const dip = Math.min(...short.filter((stop) => stop.t >= 0.9 && stop.t <= 1.1).map((stop) => stop.v));
  assert.ok(dip < 0.6);
});
