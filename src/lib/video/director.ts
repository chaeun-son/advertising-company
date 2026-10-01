import { planSlideshow, type Motion, type PlannedClip, type TextStyle, type Transition } from "./slideshow";

export type BeatId = "intro" | "founding" | "early" | "growth" | "event" | "memory" | "now" | "thanks" | "ending";

export const BEATS: { id: BeatId; title: string }[] = [
  { id: "intro", title: "인트로" },
  { id: "founding", title: "창립 당시" },
  { id: "early", title: "초창기 활동" },
  { id: "growth", title: "성장 과정" },
  { id: "event", title: "주요 행사" },
  { id: "memory", title: "임직원 추억" },
  { id: "now", title: "현재 모습" },
  { id: "thanks", title: "감사 메시지" },
  { id: "ending", title: "엔딩" },
];

const RULES: { id: BeatId; test: RegExp }[] = [
  { id: "thanks", test: /감사|고맙|축하|메시지/ },
  { id: "ending", test: /엔딩|마지막|마무리|앞으로/ },
  { id: "founding", test: /창립|창단|설립|197\d|198\d|199\d|창단식/ },
  { id: "early", test: /초창|초기|예전|옛날/ },
  { id: "growth", test: /성장|확장|발전|도약|준공/ },
  { id: "event", test: /행사|대회|축제|경기|시합|기념식/ },
  { id: "memory", test: /추억|임직원|직원|단체|가족|동료/ },
  { id: "now", test: /현재|오늘|지금|202[3-9]/ },
  { id: "intro", test: /인트로|오프닝|시작/ },
];

export type StoryPhoto = { id: string; name: string; caption: string; url?: string; beat?: BeatId };

export function classifyBeat(photo: StoryPhoto): BeatId | null {
  const text = `${photo.name} ${photo.caption}`;
  return RULES.find((rule) => rule.test.test(text))?.id ?? null;
}

export function naturalSeconds(photo: StoryPhoto, beat: BeatId) {
  const text = `${photo.name} ${photo.caption}`;
  if (beat === "ending" || beat === "thanks" || beat === "founding") return 6;
  if (/단체|임직원|가족|집합/.test(text)) return 4.6;
  if (beat === "event") return 2.6;
  if (beat === "early" || beat === "growth") return 5;
  return 3.6;
}

export function assignStory(photos: StoryPhoto[]): StoryPhoto[] {
  const next = photos.map((photo) => ({ ...photo, beat: photo.beat && BEATS.some((beat) => beat.id === photo.beat) ? photo.beat : classifyBeat(photo) ?? undefined }));
  const open = next.filter((photo) => !photo.beat);
  const fillers: BeatId[] = ["growth", "event", "memory", "now", "early"];
  open.forEach((photo, index) => { photo.beat = fillers[index % fillers.length]; });
  if (next.length && !next.some((photo) => photo.beat === "intro") && !classifyBeat(next[0])) {
    next[0] = { ...next[0], beat: "intro" };
  }
  if (next.length > 1 && !next.some((photo) => photo.beat === "ending") && !classifyBeat(next[next.length - 1])) {
    next[next.length - 1] = { ...next[next.length - 1], beat: "ending" };
  }
  return next;
}

export function orderStory(photos: StoryPhoto[]) {
  const rank = new Map(BEATS.map((beat, index) => [beat.id, index]));
  return [...photos].sort((a, b) => (rank.get(a.beat ?? "event") ?? 0) - (rank.get(b.beat ?? "event") ?? 0));
}

/** 타임라인에 올려 둔 순서를 우선하고, 없는 사진은 현재 배열 순서로 뒤에 붙인다. 파일명으로 다시 정렬하지 않는다. */
export function keepUserOrder<T extends { id: string }>(photos: T[], timelineIds: readonly string[]): T[] {
  if (!timelineIds.length) return photos.slice();
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const ordered: T[] = [];
  const seen = new Set<string>();
  for (const id of timelineIds) {
    const photo = byId.get(id);
    if (!photo || seen.has(id)) continue;
    seen.add(id);
    ordered.push(photo);
  }
  for (const photo of photos) {
    if (!seen.has(photo.id)) ordered.push(photo);
  }
  return ordered;
}

export function fitDurations(photos: StoryPhoto[], targetSeconds: number | null, reorder = false) {
  if (!photos.length) return [];
  const assigned = assignStory(photos);
  const ordered = reorder ? orderStory(assigned) : assigned;
  const natural = ordered.map((photo) => naturalSeconds(photo, photo.beat ?? "event"));
  if (!targetSeconds) return ordered.map((photo, index) => ({ ...photo, seconds: natural[index] }));
  const sum = natural.reduce((total, value) => total + value, 0) || 1;
  const scaled = natural.map((value) => Math.max(1.4, value * (targetSeconds / sum)));
  const drift = targetSeconds - scaled.reduce((total, value) => total + value, 0);
  scaled[scaled.length - 1] += drift;
  return ordered.map((photo, index) => ({ ...photo, seconds: Math.max(1.2, scaled[index]) }));
}

export function pickMotion(name: string, caption: string): Motion {
  const text = `${name} ${caption}`;
  if (/인물|초상|얼굴|증명/.test(text)) return "face-focus";
  if (/세로/.test(text)) return "slow-zoom";
  if (/단체|임직원|가족|집합|단체사진|우리끼리/.test(text)) return "slow-zoom";
  if (/풍경|운동장|전경|건물|하늘|광장|경기장|구장/.test(text)) return "zoom-out";
  return "slow-zoom";
}

export function captionKind(text: string, beat?: string): "body" | "year" | "ending" {
  if (/감사|고맙|축하|영원히|사랑해|엔딩|기억해/.test(text) || beat === "ending" || beat === "thanks") return "ending";
  if (/\d{4}|since|창립|주년|연도/i.test(text) || beat === "founding") return "year";
  return "body";
}

export function pickTransition(caption: string, previous = ""): Transition {
  const year = caption.match(/\d{4}/);
  const prev = previous.match(/\d{4}/);
  if (year && prev && year[0] !== prev[0]) return "black";
  if (year && /창립|설립|주년/.test(caption)) return "black";
  return "fade";
}

/** 화면 폭에 맞춰 최대 두 줄. 한 줄을 넘기면 공백이나 글자 수에서 끊고, 더 길면 말줄임. */
export function wrapCaption(text: string, maxChars = 16): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chars = [...clean];
  if (chars.length <= maxChars) return [clean];
  const space = clean.lastIndexOf(" ", maxChars);
  const cut = space >= 6 ? space : maxChars;
  const line = chars.slice(0, cut).join("").trim();
  let rest = chars.slice(cut).join("").trim();
  if ([...rest].length > maxChars) rest = `${[...rest].slice(0, maxChars - 1).join("")}…`;
  return [line, rest];
}

const INTRO_SECONDS = 7.4;

function baseClip(partial: Partial<PlannedClip> & Pick<PlannedClip, "id" | "kind" | "name" | "start" | "duration">): PlannedClip {
  return {
    url: undefined,
    track: partial.kind === "text" ? 2 : 0,
    offset: 0,
    text: "",
    color: "#fffdf8",
    fontSize: 54,
    x: 0.5,
    y: 0.5,
    volume: 0,
    look: "none",
    motion: "none",
    transition: "fade",
    textMotion: "fade",
    textStyle: "plain",
    frame: "contain",
    ...partial,
  };
}

export function introClips(logoUrl = "/adsmile-mark.png"): PlannedClip[] {
  return [
    baseClip({
      id: "intro-logo",
      kind: "image",
      name: "로고",
      url: logoUrl,
      start: 0,
      duration: 2.4,
      motion: "slow-zoom",
      frame: "contain",
    }),
    baseClip({
      id: "intro-since",
      kind: "text",
      name: "인트로",
      start: 2.4,
      duration: 2.4,
      text: "SINCE 1977",
      textStyle: "year",
      fontSize: 84,
    }),
    baseClip({
      id: "intro-title",
      kind: "text",
      name: "인트로",
      start: 4.8,
      duration: 2.6,
      text: "50년의 기록",
      textStyle: "year",
      fontSize: 78,
    }),
  ];
}

export function endingCard(start: number): PlannedClip {
  return baseClip({
    id: "ending-card",
    kind: "text",
    name: "엔딩",
    start,
    duration: 5,
    text: "함께한 시간에 감사합니다",
    textStyle: "ending",
    fontSize: 64,
    transition: "fade",
  });
}

function crossfade(clips: PlannedClip[], fade = 0.7): PlannedClip[] {
  const images = clips.filter((clip) => clip.kind === "image");
  const pullAt = new Map<number, number>();
  let pull = 0;
  for (let index = 0; index < images.length; index += 1) {
    const clip = images[index]!;
    if (index > 0 && clip.transition !== "black") pull += fade;
    pullAt.set(clip.start, pull);
  }
  return clips.map((clip) => ({ ...clip, start: Math.max(0, clip.start - (pullAt.get(clip.start) ?? 0)) }));
}

export function directClips(
  photos: StoryPhoto[],
  targetSeconds: number | null,
  mood: "warm" | "bold" | "calm",
  options: { reorder?: boolean; intro?: boolean; ending?: boolean } = {},
): PlannedClip[] {
  const timed = fitDurations(photos, targetSeconds, options.reorder === true);
  const slides = timed.map((photo) => ({
    id: photo.id,
    name: photo.name,
    url: photo.url ?? "",
    caption: photo.caption || BEATS.find((beat) => beat.id === photo.beat)?.title || "",
    seconds: photo.seconds,
  }));
  let previous = "";
  const transitionOf = new Map<string, Transition>();
  const motionOf = new Map<string, Motion>();
  const styleOf = new Map<string, TextStyle>();
  for (const photo of timed) {
    const caption = photo.caption || "";
    transitionOf.set(photo.id, pickTransition(caption, previous));
    motionOf.set(photo.id, pickMotion(photo.name, caption));
    styleOf.set(photo.id, captionKind(caption, photo.beat));
    previous = caption;
  }
  const made = planSlideshow(slides).map((clip) => {
    const photoId = clip.id.replace(/-(photo|caption)$/, "");
    const style = styleOf.get(photoId) ?? "body";
    if (clip.kind === "text") {
      return {
        ...clip,
        textStyle: style,
        fontSize: style === "year" ? 72 : style === "ending" ? 60 : 40,
        y: style === "body" ? 0.8 : 0.62,
        transition: transitionOf.get(photoId) ?? "fade",
      };
    }
    return {
      ...clip,
      look: mood === "bold" ? "vivid" as const : mood === "calm" ? "warm" as const : "vintage" as const,
      motion: motionOf.get(photoId) ?? "slow-zoom",
      transition: transitionOf.get(photoId) ?? "fade",
      frame: "blur" as const,
    };
  });
  const faded = crossfade(made);
  const intro = options.intro === false ? [] : introClips();
  const shift = intro.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0) || (options.intro === false ? 0 : INTRO_SECONDS);
  const body = faded.map((clip) => ({ ...clip, start: clip.start + (intro.length ? shift : 0) }));
  const film = [...intro, ...body];
  if (options.ending) {
    const end = film.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
    film.push(endingCard(end));
  }
  return film;
}
