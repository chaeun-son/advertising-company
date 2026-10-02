import assert from "node:assert/strict";
import test from "node:test";
import { layMusicBeds, musicSections, restoreUserMusicUrls, sectionsFreeOf, type BedTrack } from "./music-plan.ts";

const tracks: BedTrack[] = [
  { id: "calm", name: "잔잔", url: "/a", category: "잔잔", duration: 30 },
  { id: "memory", name: "추억", url: "/b", category: "추억", duration: 40 },
  { id: "bright", name: "밝은", url: "/c", category: "밝은", duration: 20 },
  { id: "emotion", name: "감동", url: "/d", category: "감동", duration: 50 },
  { id: "ending", name: "엔딩", url: "/e", category: "엔딩", duration: 15 },
];

test("director lays a different bed on each section and crossfades the joins", () => {
  const sections = musicSections([
    { title: { role: "intro" }, start: 0, duration: 6 },
    { kind: "image", start: 6, duration: 30 },
    { title: { role: "ending" }, start: 36, duration: 6 },
  ]);
  const beds = layMusicBeds(sections, tracks, 1.2);
  assert.ok(beds.length >= 4);
  const names = beds.map((bed) => bed.category);
  assert.ok(names.includes("잔잔") || names.includes("감동"));
  assert.ok(names.includes("밝은") || names.includes("경쾌") || names.includes("행사"));
  const joined = beds.filter((bed, index) => index > 0 && bed.start < (beds[index - 1]!.start + beds[index - 1]!.duration) - 0.2);
  assert.ok(joined.length >= 1);
  assert.ok(joined.every((bed) => bed.fadeIn >= 1));
});

test("a pinned section is left alone", () => {
  const sections = musicSections([{ kind: "image", start: 0, duration: 30 }]);
  const free = sectionsFreeOf(sections, [{ start: 0, duration: 30 }]);
  assert.equal(layMusicBeds(free, tracks).length, 0);
});

test("saved user music urls are restored from the library id", () => {
  const clips = restoreUserMusicUrls(
    [{ musicSource: "user" as const, libraryId: "abc", url: "/old", fadeIn: 1.2, fadeOut: 0.8, volume: 0.4 }],
    new Map([["abc", "/api/music/file/abc?exp=1&sig=x"]]),
  );
  assert.equal(clips[0]?.url, "/api/music/file/abc?exp=1&sig=x");
  assert.equal(clips[0]?.fadeIn, 1.2);
  assert.equal(clips[0]?.volume, 0.4);
});
