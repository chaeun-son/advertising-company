import assert from "node:assert/strict";
import test from "node:test";
import {
  averageSpeed,
  gradePreset,
  gradeToFilter,
  incomingTransition,
  mediaOffset,
  motionKeys,
  motionScale,
  outgoingTransition,
  retimed,
  sampleNumber,
  speedAt,
  textAnimState,
  textPresetPatch,
  transitionSeconds,
} from "./pro-edit.ts";

test("text presets keep a korean-capable font and distinct roles", () => {
  const title = textPresetPatch("title");
  const quote = textPresetPatch("quote");
  const body = textPresetPatch("body");
  assert.equal(title.font, "pretendard");
  assert.equal(quote.font, "serif");
  assert.ok((title.fontSize as number) > (body.fontSize as number));
  assert.equal(body.box, true);
  assert.equal(title.placed, true);
});

test("enter and exit animations move over the requested duration", () => {
  const hidden = textAnimState({ enter: "fade-in", exit: "fade-out", elapsed: 0, duration: 4, enterSec: 0.4, exitSec: 0.4, speed: 1 });
  const shown = textAnimState({ enter: "fade-in", exit: "fade-out", elapsed: 2, duration: 4, enterSec: 0.4, exitSec: 0.4, speed: 1 });
  const gone = textAnimState({ enter: "fade-in", exit: "fade-out", elapsed: 4, duration: 4, enterSec: 0.4, exitSec: 0.4, speed: 1 });
  assert.equal(hidden.alpha, 0);
  assert.equal(shown.alpha, 1);
  assert.equal(gone.alpha, 0);
  const fast = textAnimState({ enter: "slide-up", exit: "none", elapsed: 0.2, duration: 4, enterSec: 0.8, exitSec: 0.4, speed: 2 });
  const slow = textAnimState({ enter: "slide-up", exit: "none", elapsed: 0.2, duration: 4, enterSec: 0.8, exitSec: 0.4, speed: 1 });
  assert.ok(fast.dy < slow.dy);
  const typed = textAnimState({ enter: "typewriter", exit: "none", elapsed: 0.25, duration: 4, enterSec: 1, exitSec: 0.2, speed: 1 });
  assert.ok(typed.reveal > 0.2 && typed.reveal < 0.3);
});

test("scene transitions stay inside 0.2 to 2 seconds and default to cross fade", () => {
  assert.equal(transitionSeconds("fade"), 0.7);
  assert.equal(transitionSeconds("push", 0.05), 0.2);
  assert.equal(transitionSeconds("wipe", 9), 2);
  assert.equal(transitionSeconds("none", 1), 0);
  const mid = incomingTransition("fade", 0.5, 1280);
  assert.equal(mid.alpha, 0.5);
  const push = incomingTransition("push", 0, 1000);
  assert.equal(push.tx, 1000);
  const out = outgoingTransition("push", 0.25, 1000);
  assert.equal(out.tx, -250);
  assert.equal(outgoingTransition("fade", 0.25, 1000).alpha, 1);
  assert.equal(incomingTransition("white", 0.25, 100).underlay, "#fff");
  assert.equal(incomingTransition("wipe", 0.4, 100).wipe, 0.4);
});

test("grade presets change the filter and mono removes color", () => {
  const basic = gradeToFilter(gradePreset("basic"));
  const warm = gradeToFilter(gradePreset("warm"));
  const mono = gradeToFilter(gradePreset("mono"));
  assert.notEqual(basic, warm);
  assert.match(mono, /saturate\(0/);
  assert.match(warm, /sepia\(/);
});

test("keyframes interpolate and motion zoom is the same path", () => {
  const keys = [
    { id: "a", t: 0, x: 0, opacity: 0 },
    { id: "b", t: 2, x: 1, opacity: 1 },
  ];
  assert.equal(sampleNumber(keys, 1, "x", 0), 0.5);
  assert.equal(sampleNumber(keys, 1, "opacity", 1), 0.5);
  assert.equal(sampleNumber(keys, 1, "scale", 3), 3);
  const duration = 4;
  for (const u of [0, 0.5, 1]) {
    const sampled = sampleNumber(motionKeys("zoom-in", duration), u * duration, "scale", 1);
    assert.ok(Math.abs(sampled - motionScale("zoom-in", u)) < 0.0001);
  }
  const pan = sampleNumber(motionKeys("pan-left", 2), 1, "x", 0);
  assert.ok(Math.abs(pan) < 0.001);
});

test("speed and speed ramp consume the source clock", () => {
  assert.equal(mediaOffset(1, 2, 4, 2), 5);
  assert.equal(averageSpeed(1, [{ t: 0, speed: 0.5 }, { t: 1, speed: 1.5 }]), 1);
  const ramped = mediaOffset(0, 2, 4, 1, [{ t: 0, speed: 0.5 }, { t: 1, speed: 1.5 }]);
  assert.ok(Math.abs(ramped - 1.5) < 0.001);
  assert.equal(speedAt(0, 1, [{ t: 0, speed: 0.5 }, { t: 1, speed: 1.5 }]), 0.5);
  assert.equal(speedAt(1, 1, [{ t: 0, speed: 0.5 }, { t: 1, speed: 1.5 }]), 1.5);
  assert.ok(Math.abs(retimed(4, 1, undefined, 2) - 2) < 0.001);
});
