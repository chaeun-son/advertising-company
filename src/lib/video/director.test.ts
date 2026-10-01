import assert from "node:assert/strict";
import test from "node:test";
import { assignStory, captionKind, directClips, fitDurations, keepUserOrder, pickMotion, pickTransition, wrapCaption } from "./director.ts";

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

test("director keeps photo order, picks motion and caption style, and can add intro", () => {
  assert.equal(pickMotion("단체사진.jpg", ""), "slow-zoom");
  assert.equal(pickMotion("운동장.jpg", "풍경"), "zoom-out");
  assert.equal(pickMotion("대표.jpg", "인물"), "face-focus");
  assert.equal(pickMotion("phone.jpg", "세로"), "slow-zoom");
  assert.equal(captionKind("현장 스케치"), "body");
  assert.equal(captionKind("1977 창단식"), "year");
  assert.equal(captionKind("진심으로 감사합니다"), "ending");
  assert.equal(pickTransition("1998 준공", "1977 창단"), "black");
  assert.equal(pickTransition("운동회", "1977 창단"), "fade");
  assert.deepEqual(wrapCaption("창립 이후 이어 온 사람들의 이야기와 기록", 12).length, 2);
  const film = directClips(photos, 30, "warm", { reorder: false, intro: true, ending: true });
  const images = film.filter((clip) => clip.kind === "image").map((clip) => clip.name);
  assert.deepEqual(images, ["로고", "행사1.jpg", "old.jpg", "end.jpg"]);
  const ending = film.find((clip) => clip.name === "엔딩");
  assert.equal(ending?.duration, 5);
  assert.ok(film.some((clip) => clip.text === "SINCE 1977"));
  const firstPhoto = film.find((clip) => clip.name === "행사1.jpg");
  const secondPhoto = film.find((clip) => clip.name === "old.jpg");
  assert.ok(firstPhoto && secondPhoto && secondPhoto.start < firstPhoto.start + firstPhoto.duration);
});
