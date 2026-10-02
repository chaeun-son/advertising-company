import assert from "node:assert/strict";
import test from "node:test";
import { applyMediaOrder, applyTitlePreset, assignStory, bodyPhotoId, captionKind, directClips, directFilm, filmItemsFromTimeline, filmSummary, fitDurations, holdTargetLength, keepUserOrder, layoutVisualOrder, lengthGapLabel, musicFadeFor, parseFilmLength, pickMotion, pickTransition, splitSeconds, videoDuckSpans, videoPlacementFor, wrapCaption } from "./director.ts";
import { heardLevel } from "./export-presets.ts";
import { customerLogo } from "./slideshow.ts";
import { titleMotionAt } from "./title-paint.ts";

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
  assert.equal(Math.round(total * 1000) / 1000, 180);
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
  assert.deepEqual(images, ["행사1.jpg", "old.jpg", "end.jpg"]);
  const intro = film.find((clip) => clip.title?.role === "intro");
  const ending = film.find((clip) => clip.title?.role === "ending");
  assert.equal(intro?.duration, 7);
  assert.equal(ending?.duration, 6);
  assert.equal(intro?.title?.logo, undefined);
  assert.equal(ending?.title?.logo, undefined);
  assert.equal(ending?.title?.org, "");
  assert.equal(customerLogo("/adsmile-mark.png"), undefined);
  assert.equal(customerLogo("/brand/cresora_header_logo.png"), undefined);
  assert.equal(customerLogo("data:image/png;base64,abc"), "data:image/png;base64,abc");
  assert.ok(intro && ending && intro.start === 0 && ending.start >= intro.duration);
  const firstPhoto = film.find((clip) => clip.name === "행사1.jpg");
  const secondPhoto = film.find((clip) => clip.name === "old.jpg");
  assert.ok(firstPhoto && secondPhoto);
  assert.equal(Math.round((secondPhoto.start - (firstPhoto.start + firstPhoto.duration)) * 1000) / 1000, 0);
  assert.equal(Math.round(Math.max(...film.map((clip) => clip.start + clip.duration)) * 1000) / 1000, 30);
  const loose = directClips(photos, null, "warm", { reorder: false, intro: false, ending: false });
  const looseFirst = loose.find((clip) => clip.name === "행사1.jpg");
  const looseSecond = loose.find((clip) => clip.name === "old.jpg");
  assert.ok(looseFirst && looseSecond && looseSecond.start < looseFirst.start + looseFirst.duration);
});

test("a timed film keeps intro, photos, video, and ending inside the target", () => {
  const photos = Array.from({ length: 10 }, (_, index) => ({
    kind: "image" as const,
    id: `p${index}`,
    name: `사진${index + 1}.jpg`,
    caption: `${index + 1}번`,
  }));
  const film = directFilm(
    [...photos, { kind: "video", id: "v", name: "현장.mp4", duration: 18 }],
    300,
    "warm",
    { intro: { seconds: 7 }, ending: { seconds: 7 } },
  );
  const intro = film.find((clip) => clip.title?.role === "intro");
  const ending = film.find((clip) => clip.title?.role === "ending");
  const video = film.find((clip) => clip.kind === "video");
  const names = film.filter((clip) => clip.kind === "image").map((clip) => clip.name);
  assert.deepEqual(names, photos.map((photo) => photo.name));
  assert.equal(intro?.duration, 7);
  assert.equal(ending?.duration, 7);
  assert.equal(video?.duration, 18);
  assert.ok(video && intro && video.start >= intro.duration - 0.05);
  assert.ok(ending && video && ending.start >= video.start + video.duration - 1);
  const total = Math.max(...film.map((clip) => clip.start + clip.duration));
  assert.equal(Math.round(total * 1000) / 1000, 300);
  const summary = filmSummary(film);
  assert.equal(summary.intro, 7);
  assert.equal(summary.ending, 7);
  assert.equal(Math.round(summary.body * 1000) / 1000, 286);
  assert.equal(Math.round(summary.total * 1000) / 1000, 300);
  const fade = musicFadeFor(film);
  assert.equal(fade?.fadeOut, 7);
  assert.ok(fade && ending && Math.abs(fade.fadeStart - ending.start) < 0.05);
});

test("titles can be turned off without reordering photos and video", () => {
  const film = directFilm(
    [
      { kind: "image", id: "p", name: "앞.jpg", caption: "앞" },
      { kind: "video", id: "v", name: "현장.mp4", duration: 18, offset: 1.5 },
      { kind: "image", id: "q", name: "뒤.jpg", caption: "뒤" },
    ],
    null,
    "calm",
    { intro: false, ending: false },
  );
  assert.equal(film.some((clip) => clip.title), false);
  assert.deepEqual(
    film.filter((clip) => clip.kind !== "text").map((clip) => clip.name),
    ["앞.jpg", "뒤.jpg", "현장.mp4"],
  );
  assert.equal(film.find((clip) => clip.kind === "video")?.offset, 1.5);
  assert.equal(musicFadeFor(film), null);
});

test("custom title copy, style, and saved presets stay on the cards", () => {
  const film = directFilm(
    [{ kind: "image", id: "p", name: "한장.jpg", caption: "기록" }],
    null,
    "warm",
    {
      intro: { main: "창립 50주년", sub: "함께 걸어온 시간", date: "1977 – 2026", seconds: 7, style: "grand", motion: "slow-zoom" },
      ending: { main: "감사합니다", thanks: "50년의 동행에 감사드립니다", org: "애드스마일", date: "2026", seconds: 8, style: "emotion", motion: "slide-up" },
    },
  );
  const intro = film.find((clip) => clip.title?.role === "intro")?.title;
  const ending = film.find((clip) => clip.title?.role === "ending")?.title;
  assert.equal(intro?.main, "창립 50주년");
  assert.equal(intro?.style, "grand");
  assert.equal(intro?.motion, "slow-zoom");
  assert.equal(intro?.seconds, 7);
  assert.equal(ending?.thanks, "50년의 동행에 감사드립니다");
  assert.equal(ending?.org, "애드스마일");
  assert.equal(ending?.motion, "slide-up");
  assert.equal(ending?.seconds, 8);
  const preset = applyTitlePreset(
    { role: "intro", style: "luxury", motion: "fade", main: "이전", sub: "", date: "", thanks: "", org: "", bg: "#111", seconds: 6 },
    { style: "simple", main: "가족여행", sub: "여행의 기록" },
  );
  assert.equal(preset.main, "가족여행");
  assert.equal(preset.style, "simple");
  assert.equal(preset.seconds, 6);
  assert.equal(titleMotionAt("fade", 0, 7).alpha, 0);
  assert.equal(titleMotionAt("fade", 0.5, 7).alpha, 1);
  assert.equal(titleMotionAt("slide-up", 0, 7).y, 36);
  assert.ok(titleMotionAt("slow-zoom", 1, 7).scale > 1.04);
});

test("timeline media keeps photo and video order", () => {
  const items = filmItemsFromTimeline(
    [
      { id: "p1", name: "1.jpg", caption: "하나" },
      { id: "p2", name: "2.jpg", caption: "둘" },
      { id: "p3", name: "3.jpg", caption: "셋" },
    ],
    [
      { id: "p2-photo", kind: "image", name: "2.jpg", start: 4, duration: 4 },
      { id: "clip", kind: "video", name: "영상.mp4", start: 8, duration: 18, offset: 0 },
      { id: "p1-photo", kind: "image", name: "1.jpg", start: 0, duration: 4 },
    ],
  );
  assert.deepEqual(items.map((item) => item.name), ["1.jpg", "2.jpg", "영상.mp4", "3.jpg"]);
});

test("customer films keep an 18s clip and a separate ending cut, without the tool logo", () => {
  const photos = Array.from({ length: 10 }, (_, index) => ({
    kind: "image" as const,
    id: `p${index}`,
    name: `사진${index + 1}.jpg`,
    caption: `${index + 1}번`,
  }));
  const film = directFilm(
    [
      ...photos,
      { kind: "video", id: "v", name: "현장.mp4", duration: 18, offset: 0, volume: 1, audioOn: true },
      { kind: "image", id: "end", name: "단체.jpg", caption: "마지막 단체" },
    ],
    null,
    "warm",
    {
      intro: { seconds: 7, logo: "/adsmile-mark.png", main: "창립 50주년" },
      ending: { seconds: 6, logo: "/adsmile-logo.png", org: "", sub: "우리의 이야기는 계속됩니다" },
      endingCut: { sourceId: "end", seconds: 7, caption: "함께한 50년" },
    },
  );
  const intro = film.find((clip) => clip.title?.role === "intro");
  const ending = film.find((clip) => clip.title?.role === "ending");
  const cut = film.find((clip) => clip.endingCut);
  const video = film.find((clip) => clip.kind === "video");
  const visuals = film.filter((clip) => clip.kind === "image" || clip.kind === "video").map((clip) => clip.name);
  assert.deepEqual(visuals, [...photos.map((photo) => photo.name), "현장.mp4", "엔딩컷"]);
  assert.equal(intro?.title?.logo, undefined);
  assert.equal(ending?.title?.logo, undefined);
  assert.equal(ending?.title?.org, "");
  assert.equal(intro?.duration, 7);
  assert.equal(video?.duration, 18);
  assert.equal(video?.volume, 1);
  assert.equal(cut?.duration, 7);
  assert.equal(ending?.duration, 6);
  assert.ok(cut && video && cut.start >= video.start + video.duration - 1);
  assert.ok(ending && cut && ending.start >= cut.start + cut.duration - 0.8);
  assert.equal(film.find((clip) => clip.id === "end-ending-caption")?.text, "함께한 50년");
  const summary = filmSummary(film);
  assert.equal(summary.intro, 7);
  assert.equal(summary.endingCut, 7);
  assert.equal(summary.ending, 6);
  const ducks = videoDuckSpans(film);
  assert.equal(ducks.length, 1);
  assert.equal(ducks[0]?.end - ducks[0]!.start, 18);
  const fade = musicFadeFor(film);
  assert.ok(fade && heardLevel(0.7, (ducks[0]!.start + ducks[0]!.end) / 2, fade.fadeStart, fade.fadeOut, ducks) < 0.3);
  assert.equal(heardLevel(0.7, fade!.fadeStart + fade!.fadeOut, fade!.fadeStart, fade!.fadeOut, ducks), 0);
});

test("an ending-cut video keeps its trimmed length instead of becoming a still", () => {
  const film = directFilm(
    [
      { kind: "image", id: "p", name: "앞.jpg", caption: "앞" },
      { kind: "video", id: "v", name: "마무리.mp4", duration: 18, offset: 2, volume: 0, audioOn: false },
    ],
    60,
    "calm",
    { intro: { seconds: 7 }, ending: { seconds: 6 }, endingCut: { sourceId: "v", seconds: 7, caption: "마지막 영상" } },
  );
  const video = film.find((clip) => clip.kind === "video");
  assert.equal(video?.endingCut, true);
  assert.equal(video?.duration, 18);
  assert.equal(video?.offset, 2);
  assert.equal(video?.volume, 0);
  assert.equal(videoDuckSpans(film).length, 0);
});

function filmEnd(film: { start: number; duration: number }[]) {
  return Math.round(Math.max(...film.map((clip) => clip.start + clip.duration)) * 1000) / 1000;
}

function mainVisuals<T extends { id: string; kind: string; start: number; duration: number; endingCut?: boolean; title?: unknown }>(clips: T[]) {
  return clips.filter((clip) => (clip.kind === "image" || clip.kind === "video") && !clip.endingCut && !clip.title).sort((a, b) => a.start - b.start);
}

test("3, 5 and 10 minute targets land on 180, 300 and 600 exactly", () => {
  const photos = Array.from({ length: 5 }, (_, index) => ({
    kind: "image" as const,
    id: `p${index}`,
    name: `사진${index + 1}.jpg`,
    caption: index === 0 ? "1977 창단식" : `${index + 1}번`,
  }));
  const items = [
    ...photos,
    { kind: "video" as const, id: "v", name: "현장.mp4", duration: 18 },
    { kind: "image" as const, id: "end", name: "단체.jpg", caption: "마지막" },
  ];
  for (const target of [180, 300, 600]) {
    const film = directFilm(items, target, "warm", {
      intro: { seconds: 7 },
      ending: { seconds: 6 },
      endingCut: { sourceId: "end", seconds: 7, caption: "함께한 50년" },
    });
    const summary = filmSummary(film);
    assert.equal(filmEnd(film), target);
    assert.equal(summary.intro, 7);
    assert.equal(summary.endingCut, 7);
    assert.equal(summary.ending, 6);
    assert.equal(Math.round(summary.body * 1000) / 1000, target - 20);
    const photoSum = film.filter((clip) => clip.kind === "image" && !clip.endingCut).reduce((sum, clip) => sum + clip.duration, 0);
    assert.equal(Math.round(photoSum * 1000) / 1000, target - 7 - 7 - 6 - 18);
    assert.equal(film.find((clip) => clip.kind === "video")?.duration, 18);
  }
});

test("custom lengths parse and a locked timeline keeps the target when the intro grows", () => {
  assert.equal(parseFilmLength("4:30"), 270);
  assert.equal(parseFilmLength("7분 20초"), 440);
  assert.equal(parseFilmLength("4분"), 240);
  assert.equal(parseFilmLength("90초"), 90);
  assert.equal(lengthGapLabel(303.2, 300), "+3.2초 초과");
  assert.equal(lengthGapLabel(298.2, 300), "-1.8초 부족");
  assert.equal(lengthGapLabel(300, 300), "맞음");
  assert.equal(splitSeconds(262, [1, 1, 1, 1, 1]).reduce((sum, value) => sum + value, 0), 262);
  const film = directFilm(
    [
      { kind: "image", id: "a", name: "1.jpg", caption: "하나" },
      { kind: "image", id: "b", name: "2.jpg", caption: "둘" },
      { kind: "video", id: "v", name: "현장.mp4", duration: 18 },
    ],
    300,
    "calm",
    { intro: { seconds: 7 }, ending: { seconds: 6 }, endingCut: false },
  );
  const longer = holdTargetLength(
    film.map((clip) => (clip.title?.role === "intro" ? { ...clip, duration: 10 } : clip)),
    300,
  );
  assert.equal(filmEnd(longer), 300);
  assert.equal(longer.find((clip) => clip.title?.role === "intro")?.duration, 10);
  assert.equal(longer.find((clip) => clip.kind === "video")?.duration, 18);
  const photoSum = longer.filter((clip) => clip.kind === "image").reduce((sum, clip) => sum + clip.duration, 0);
  assert.equal(Math.round(photoSum * 1000) / 1000, 300 - 10 - 6 - 18);
});

test("director parks an interleaved 18s video after the photos and before the ending cut", () => {
  const photos = Array.from({ length: 15 }, (_, index) => ({
    kind: "image" as const,
    id: `p${index}`,
    name: `사진${index + 1}.jpg`,
    caption: `${index + 1}번`,
  }));
  const film = directFilm(
    [photos[0]!, { kind: "video" as const, id: "v", name: "현장.mp4", duration: 18 }, ...photos.slice(1), { kind: "image" as const, id: "end", name: "단체.jpg", caption: "마지막" }],
    300,
    "warm",
    { reorder: false, intro: { seconds: 7 }, ending: { seconds: 6 }, endingCut: { sourceId: "end", seconds: 7, caption: "함께한 50년" } },
  );
  const visuals = film.filter((clip) => (clip.kind === "image" || clip.kind === "video") && !clip.title);
  assert.deepEqual(visuals.map((clip) => clip.name), [...photos.map((photo) => photo.name), "현장.mp4", "엔딩컷"]);
  assert.equal(film.find((clip) => clip.kind === "video" && !clip.endingCut)?.duration, 18);
  assert.equal(filmEnd(film), 300);
  const photoSum = visuals.filter((clip) => clip.kind === "image" && !clip.endingCut).reduce((sum, clip) => sum + clip.duration, 0);
  assert.equal(Math.round(photoSum * 1000) / 1000, 300 - 7 - 7 - 6 - 18);
});

test("reordering 15 photos keeps the 18s video behind them and the 5 minute target", () => {
  const photos = Array.from({ length: 15 }, (_, index) => ({
    id: `p${index}-photo`,
    kind: "image",
    name: `${index + 1}.jpg`,
    start: index * 4,
    duration: 4,
    track: 0,
  }));
  const video = { id: "v", kind: "video", name: "현장.mp4", start: 2, duration: 18, track: 0, videoPlace: "auto" as const };
  const intro = { id: "intro-title", kind: "text", name: "인트로", start: 0, duration: 7, track: 0, title: { role: "intro" as const } };
  const cut = { id: "end-photo", kind: "image", name: "엔딩컷", start: 80, duration: 7, track: 0, endingCut: true };
  const ending = { id: "ending-title", kind: "text", name: "엔딩", start: 90, duration: 6, track: 0, title: { role: "ending" as const } };
  const caption = { id: "p0-caption", kind: "text", name: "자막", start: 0, duration: 4, track: 2, text: "하나" };
  const packed = holdTargetLength(applyMediaOrder([intro, caption, video, cut, ending, ...photos], photos.map((photo) => bodyPhotoId(photo))), 300);
  const body = mainVisuals(packed);
  assert.deepEqual(body.map((clip) => clip.kind), [...photos.map(() => "image"), "video"]);
  assert.equal(body.at(-1)?.id, "v");
  assert.equal(body.at(-1)?.duration, 18);
  assert.equal(filmEnd(packed), 300);
  assert.equal(packed.find((clip) => clip.id === "p0-caption")?.start, packed.find((clip) => clip.id === "p0-photo")?.start);
  const movedIds = [photos[4]!, photos[0]!, photos[1]!, photos[2]!, photos[3]!, ...photos.slice(5)].map((photo) => bodyPhotoId(photo));
  const again = holdTargetLength(applyMediaOrder(packed, movedIds), 300);
  const bodyAgain = mainVisuals(again);
  assert.deepEqual(bodyAgain.filter((clip) => clip.kind === "image").map((clip) => bodyPhotoId(clip)), movedIds);
  assert.equal(bodyAgain.at(-1)?.id, "v");
  assert.equal(bodyAgain.at(-1)?.duration, 18);
  assert.equal(filmEnd(again), 300);
  const undone = packed;
  assert.equal(undone.find((clip) => clip.kind === "video")?.id, "v");
  assert.notEqual(bodyAgain[0]?.id, body[0]?.id);
});

test("a video the user moved stays beside that photo when other photos are reordered", () => {
  const photos = ["a", "b", "c"].map((id, index) => ({ id: `${id}-photo`, kind: "image", name: id, start: index, duration: 4, track: 0 }));
  const video = { id: "v", kind: "video", name: "현장.mp4", start: 5, duration: 18, track: 0, videoPlace: "manual" as const, videoAfter: "b" };
  const ordered = applyMediaOrder([...photos, video], ["c", "b", "a"]);
  const body = ordered.filter((clip) => clip.kind === "image" || clip.kind === "video").sort((a, b) => a.start - b.start);
  assert.deepEqual(body.map((clip) => clip.id), ["c-photo", "b-photo", "v", "a-photo"]);
  assert.equal(body.find((clip) => clip.id === "v")?.duration, 18);
  const flags = videoPlacementFor(body);
  assert.equal(flags.get("v")?.videoPlace, "manual");
  assert.equal(flags.get("v")?.videoAfter, "b");
  const parked = layoutVisualOrder(ordered, ["a-photo", "b-photo", "c-photo", "v"]);
  const parkedBody = parked.filter((clip) => clip.kind === "image" || clip.kind === "video").sort((a, b) => a.start - b.start);
  assert.deepEqual(parkedBody.map((clip) => clip.id), ["a-photo", "b-photo", "c-photo", "v"]);
  assert.equal(videoPlacementFor(parkedBody).get("v")?.videoPlace, "auto");
});
