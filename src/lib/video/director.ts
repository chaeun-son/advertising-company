import { customerLogo, planSlideshow, TITLE_STYLE_BG, type Motion, type PlannedClip, type TextStyle, type TitleCard, type TitleMotion, type TitleStyle, type Transition } from "./slideshow";

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

/** 중요 사진(창립, 감사, 단체)은 더 길게, 나머지는 균등. */
export function photoWeights(photos: StoryPhoto[]): number[] {
  return photos.map((photo) => {
    const beat = photo.beat ?? "event";
    const text = `${photo.name} ${photo.caption}`;
    let weight = beat === "founding" ? 1.6 : beat === "thanks" || beat === "ending" ? 1.45 : beat === "memory" ? 1.25 : beat === "intro" ? 1.2 : 1;
    if (/단체|임직원|가족|집합/.test(text)) weight = Math.max(weight, 1.35);
    return weight;
  });
}

/** `budget`초를 가중치로 나누고, 마지막 칸이 반올림 오차를 흡수해 합이 정확히 맞는다. */
export function splitSeconds(budget: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const safe = weights.map((weight) => (weight > 0 ? weight : 1));
  const total = safe.reduce((sum, weight) => sum + weight, 0);
  const millis = Math.max(0, Math.round(budget * 1000));
  const raw = safe.map((weight) => Math.floor((millis * weight) / total));
  let used = raw.reduce((sum, value) => sum + value, 0);
  let index = raw.length - 1;
  while (used < millis && raw.length) {
    raw[index] += 1;
    used += 1;
    index = index === 0 ? raw.length - 1 : index - 1;
  }
  return raw.map((value) => value / 1000);
}

/** 4:30, 4분 30초, 7분, 90초, 270. */
export function parseFilmLength(input: string): number | null {
  const text = input.trim();
  if (!text) return null;
  const clock = text.match(/^(\d+):(\d{1,2})(?:\.(\d+))?$/);
  if (clock) {
    const seconds = Number(clock[1]) * 60 + Number(clock[2]) + (clock[3] ? Number(`0.${clock[3]}`) : 0);
    return seconds > 0 ? seconds : null;
  }
  const spoken = text.match(/^(?:(\d+)\s*분)?\s*(?:(\d+(?:\.\d+)?)\s*초)?$/);
  if (spoken && (spoken[1] || spoken[2])) {
    const seconds = Number(spoken[1] || 0) * 60 + Number(spoken[2] || 0);
    return seconds > 0 ? seconds : null;
  }
  const minutes = text.match(/^(\d+(?:\.\d+)?)\s*분$/);
  if (minutes) return Number(minutes[1]) * 60;
  const asNumber = Number(text);
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null;
}

export function lengthGapLabel(current: number, target: number) {
  const gap = Math.round((current - target) * 10) / 10;
  if (Math.abs(gap) < 0.05) return "맞음";
  if (gap > 0) return `+${gap.toFixed(1)}초 초과`;
  return `${gap.toFixed(1)}초 부족`;
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
  if (targetSeconds == null) return ordered.map((photo) => ({ ...photo, seconds: naturalSeconds(photo, photo.beat ?? "event") }));
  const seconds = splitSeconds(Math.max(0, targetSeconds), photoWeights(ordered));
  return ordered.map((photo, index) => ({ ...photo, seconds: seconds[index] ?? 0 }));
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

const INTRO_SECONDS = 7;
const ENDING_SECONDS = 6;

export const DEFAULT_INTRO: TitleCard = {
  role: "intro",
  style: "luxury",
  motion: "fade",
  main: "50년의 기록",
  sub: "함께한 시간",
  date: "",
  thanks: "",
  org: "",
  bg: TITLE_STYLE_BG.luxury,
  seconds: INTRO_SECONDS,
};

export const DEFAULT_ENDING: TitleCard = {
  role: "ending",
  style: "simple",
  motion: "fade",
  main: "감사합니다",
  sub: "함께해 주셔서 고맙습니다",
  date: "",
  thanks: "",
  org: "",
  bg: "#000000",
  seconds: ENDING_SECONDS,
};

export const TITLE_TEMPLATES: { id: string; label: string; intro: Partial<TitleCard>; ending: Partial<TitleCard> }[] = [
  {
    id: "anniversary",
    label: "회사 50주년",
    intro: { style: "grand", motion: "slow-zoom", main: "창립 50주년", sub: "함께 걸어온 시간", date: "1977 – 2026", bg: TITLE_STYLE_BG.grand },
    ending: { style: "grand", motion: "fade", main: "감사합니다", sub: "50년의 동행에 감사드립니다", thanks: "50년의 동행에 감사드립니다", org: "", date: "1977 – 2026" },
  },
  {
    id: "founding",
    label: "창립기념",
    intro: { style: "luxury", motion: "fade", main: "창립기념", sub: "새로운 시작", date: "" },
    ending: { style: "luxury", motion: "fade", main: "축복합니다", sub: "창립을 함께해 주셔서 고맙습니다", thanks: "창립을 함께해 주셔서 고맙습니다", org: "" },
  },
  {
    id: "retire",
    label: "퇴임기념",
    intro: { style: "emotion", motion: "fade", main: "퇴임기념", sub: "고마웠던 시간", date: "" },
    ending: { style: "emotion", motion: "slide-up", main: "고맙습니다", sub: "걸어온 길에 존경과 감사를 전합니다", thanks: "걸어온 길에 존경과 감사를 전합니다", org: "" },
  },
  {
    id: "family",
    label: "가족여행",
    intro: { style: "simple", motion: "slide-up", main: "우리 가족", sub: "여행의 기록", date: "" },
    ending: { style: "emotion", motion: "fade", main: "또 만나요", sub: "함께여서 좋았습니다", thanks: "함께여서 좋았습니다", org: "" },
  },
  {
    id: "event",
    label: "행사스케치",
    intro: { style: "simple", motion: "fade", main: "행사 스케치", sub: "그날의 현장", date: "" },
    ending: { style: "simple", motion: "fade", main: "감사합니다", sub: "자리를 빛내 주셔서 고맙습니다", thanks: "자리를 빛내 주셔서 고맙습니다", org: "" },
  },
];

export const TITLE_STYLE_OPTIONS: { id: TitleStyle; label: string }[] = [
  { id: "luxury", label: "고급" },
  { id: "emotion", label: "감동" },
  { id: "simple", label: "심플" },
  { id: "grand", label: "웅장" },
];

export const TITLE_MOTION_OPTIONS: { id: TitleMotion; label: string }[] = [
  { id: "fade", label: "Fade In" },
  { id: "slow-zoom", label: "Slow Zoom" },
  { id: "slide-up", label: "Slide Up" },
];

export type FilmItem =
  | { kind: "image"; id: string; name: string; url?: string; caption: string; beat?: BeatId }
  | { kind: "video"; id: string; name: string; url?: string; duration: number; offset?: number; volume?: number; audioOn?: boolean; caption?: string; sourceDuration?: number };

export type EndingCutSpec = { sourceId?: string; seconds?: number; caption?: string };

export type TimelineVisual = {
  id: string;
  kind: string;
  name: string;
  url?: string;
  start: number;
  duration: number;
  text?: string;
  track?: number;
  title?: TitleCard;
  offset?: number;
  volume?: number;
  audioOn?: boolean;
  sourceDuration?: number;
  endingCut?: boolean;
};

/** 타임라인에 놓인 사진·영상 순서를 유지하고, 타임라인에 없는 사진만 뒤에 붙인다. */
export function filmItemsFromTimeline(photos: StoryPhoto[], clips: readonly TimelineVisual[]): FilmItem[] {
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));
  const visuals = clips
    .filter((clip) => (clip.kind === "image" || clip.kind === "video") && !clip.title)
    .slice()
    .sort((a, b) => a.start - b.start || (a.track ?? 0) - (b.track ?? 0));
  const used = new Set<string>();
  const items: FilmItem[] = [];
  for (const clip of visuals) {
    if (clip.kind === "video") {
      const fromTrack = clips.find((item) => item.kind === "text" && !item.title && item.id === `${clip.id}-caption`)?.text;
      items.push({
        kind: "video",
        id: clip.id,
        name: clip.name,
        url: clip.url,
        duration: Math.max(0.4, clip.duration),
        offset: clip.offset ?? 0,
        volume: clip.volume,
        audioOn: clip.audioOn,
        caption: (fromTrack || clip.text || "").trim() || undefined,
        sourceDuration: clip.sourceDuration,
      });
      continue;
    }
    const photoId = clip.id.endsWith("-photo") ? clip.id.slice(0, -"-photo".length) : clip.id;
    const photo = photoById.get(photoId) ?? photoById.get(clip.id);
    if (photo) {
      if (used.has(photo.id)) continue;
      used.add(photo.id);
      items.push({ kind: "image", id: photo.id, name: photo.name, url: photo.url ?? clip.url, caption: photo.caption, beat: photo.beat });
      continue;
    }
    if (used.has(photoId)) continue;
    used.add(photoId);
    items.push({ kind: "image", id: photoId, name: clip.name, url: clip.url, caption: clip.text ?? "" });
  }
  for (const photo of photos) {
    if (used.has(photo.id)) continue;
    items.push({ kind: "image", id: photo.id, name: photo.name, url: photo.url, caption: photo.caption, beat: photo.beat });
  }
  return items;
}

function cardFrom(role: "intro" | "ending", value: false | Partial<TitleCard> | undefined, defaultOn: boolean): TitleCard | null {
  if (value === false) return null;
  if (value == null && !defaultOn) return null;
  const extra = value && typeof value === "object" ? value : {};
  const base = role === "intro" ? DEFAULT_INTRO : DEFAULT_ENDING;
  const seconds = Math.max(1, Math.min(60, extra.seconds ?? base.seconds));
  const sub = extra.sub !== undefined ? extra.sub : extra.thanks !== undefined ? extra.thanks : base.sub;
  return { ...base, ...extra, role, seconds, sub, logo: customerLogo(extra.logo ?? base.logo) };
}

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

function crossfade(clips: PlannedClip[], fade = 0.7): PlannedClip[] {
  const visuals = clips.filter((clip) => (clip.kind === "image" || clip.kind === "video") && !clip.title);
  const pullAt = new Map<number, number>();
  let pull = 0;
  for (let index = 0; index < visuals.length; index += 1) {
    const clip = visuals[index]!;
    if (index > 0 && clip.transition !== "black") pull += fade;
    pullAt.set(clip.start, pull);
  }
  return clips.map((clip) => ({ ...clip, start: Math.max(0, clip.start - (pullAt.get(clip.start) ?? 0)) }));
}

function titleClip(card: TitleCard, start: number): PlannedClip {
  const safe = { ...card, logo: customerLogo(card.logo) };
  return baseClip({
    id: card.role === "intro" ? "intro-title" : "ending-title",
    kind: "text",
    name: card.role === "intro" ? "인트로 타이틀" : "엔딩 타이틀",
    start,
    duration: card.seconds,
    text: card.main,
    textStyle: card.role === "intro" ? "year" : "ending",
    textMotion: "none",
    transition: "none",
    track: 0,
    title: safe,
  });
}

function parkVideosLast(items: FilmItem[]): FilmItem[] {
  const images: FilmItem[] = [];
  const videos: FilmItem[] = [];
  for (const item of items) {
    if (item.kind === "video") videos.push(item);
    else images.push(item);
  }
  return [...images, ...videos];
}

function applyOrder(items: FilmItem[], reorder: boolean): FilmItem[] {
  if (!reorder) return items.slice();
  const photos = orderStory(assignStory(items.filter((item): item is Extract<FilmItem, { kind: "image" }> => item.kind === "image")));
  let index = 0;
  return items.map((item) => (item.kind === "image" ? { ...item, ...photos[index++] } : item));
}

function splitEndingCut(items: FilmItem[], spec: false | EndingCutSpec | undefined) {
  if (!spec) return { body: items.slice(), cut: null as FilmItem | null };
  let index = spec.sourceId ? items.findIndex((item) => item.id === spec.sourceId) : -1;
  if (index < 0) {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i]?.kind === "image") {
        index = i;
        break;
      }
    }
  }
  if (index < 0) return { body: items.slice(), cut: null };
  return { body: items.filter((_, i) => i !== index), cut: items[index]! };
}

function endingCutSpan(cut: FilmItem | null, spec?: EndingCutSpec) {
  if (!cut) return 0;
  if (cut.kind === "video") return Math.max(0.4, cut.duration);
  return Math.min(12, Math.max(5, spec?.seconds ?? 7));
}

export function directFilm(
  items: FilmItem[],
  targetSeconds: number | null,
  mood: "warm" | "bold" | "calm",
  options: { reorder?: boolean; intro?: false | Partial<TitleCard>; ending?: false | Partial<TitleCard>; endingCut?: false | EndingCutSpec } = {},
): PlannedClip[] {
  const intro = cardFrom("intro", options.intro, true);
  const ending = cardFrom("ending", options.ending, true);
  const ordered = parkVideosLast(applyOrder(items, options.reorder === true));
  const cutSpec = options.endingCut === false ? undefined : options.endingCut;
  const { body: mainItems, cut } = splitEndingCut(ordered, cutSpec);
  const photos = mainItems.filter((item): item is Extract<FilmItem, { kind: "image" }> => item.kind === "image");
  const videoSum = mainItems.reduce((sum, item) => sum + (item.kind === "video" ? item.duration : 0), 0);
  const cutSpan = endingCutSpan(cut, cutSpec);
  const reserved = (intro?.seconds ?? 0) + (ending?.seconds ?? 0) + cutSpan;
  // 본편 = 목표 - 인트로 - 엔딩컷 - 엔딩 타이틀. 그 안에서 영상 원본을 빼고 나머지를 사진이 정확히 나눈다.
  const photoBudget = targetSeconds == null ? null : targetSeconds - reserved - videoSum;
  const timed = fitDurations(photos, photoBudget == null ? null : Math.max(0, photoBudget), false);
  const secondsOf = new Map(timed.map((photo) => [photo.id, photo.seconds]));
  const beatOf = new Map(timed.map((photo) => [photo.id, photo.beat]));
  let previous = "";
  const slides = timed.map((photo) => ({
    id: photo.id,
    name: photo.name,
    url: photo.url ?? "",
    caption: photo.caption || BEATS.find((beat) => beat.id === photo.beat)?.title || "",
    seconds: photo.seconds,
  }));
  const styled = new Map(planSlideshow(slides).map((clip) => [clip.id, clip]));
  let cursor = intro?.seconds ?? 0;
  const body: PlannedClip[] = [];
  const pushCaption = (id: string, text: string, start: number, duration: number, transition: Transition) => {
    const caption = text.trim();
    if (!caption) return;
    body.push(baseClip({
      id: `${id}-caption`,
      kind: "text",
      name: "자막",
      track: 2,
      start,
      duration,
      text: caption,
      textStyle: "bar",
      textMotion: "rise",
      fontSize: 40,
      y: 0.82,
      transition,
    }));
  };
  const pushVideo = (item: Extract<FilmItem, { kind: "video" }>, start: number, endingCut = false, caption = item.caption ?? "") => {
    const audioOn = item.audioOn !== false;
    body.push(baseClip({
      id: item.id,
      kind: "video",
      name: endingCut ? "엔딩컷" : item.name,
      url: item.url,
      start,
      duration: item.duration,
      offset: item.offset ?? 0,
      volume: audioOn ? (item.volume ?? 1) : 0,
      audioOn,
      sourceDuration: item.sourceDuration,
      motion: "slow-zoom",
      transition: "fade",
      frame: "blur",
      endingCut,
    }));
    pushCaption(item.id, caption, start, item.duration, "fade");
    return item.duration;
  };
  for (const item of mainItems) {
    if (item.kind === "video") {
      cursor += pushVideo(item, cursor);
      continue;
    }
    const caption = item.caption || BEATS.find((beat) => beat.id === beatOf.get(item.id))?.title || "";
    const transition = pickTransition(caption, previous);
    const motion = pickMotion(item.name, caption);
    const style = captionKind(caption, beatOf.get(item.id));
    previous = caption;
    const photo = styled.get(`${item.id}-photo`);
    const text = styled.get(`${item.id}-caption`);
    const span = secondsOf.get(item.id) ?? 3.6;
    if (photo) {
      body.push({
        ...photo,
        start: cursor,
        duration: span,
        look: mood === "bold" ? "vivid" : mood === "calm" ? "warm" : "vintage",
        motion,
        transition,
        frame: "blur",
      });
    }
    if (text) {
      body.push({
        ...text,
        start: cursor,
        duration: span,
        textStyle: style,
        fontSize: style === "year" ? 72 : style === "ending" ? 60 : 40,
        y: style === "body" ? 0.8 : 0.62,
        transition,
      });
    }
    cursor += span;
  }
  if (cut?.kind === "video") {
    cursor += pushVideo(cut, cursor, true, cutSpec?.caption || cut.caption || "");
  } else if (cut?.kind === "image") {
    const span = cutSpan;
    const caption = (cutSpec?.caption || cut.caption || "").trim();
    body.push(baseClip({
      id: `${cut.id}-photo`,
      kind: "image",
      name: "엔딩컷",
      url: cut.url,
      start: cursor,
      duration: span,
      motion: "slow-zoom",
      transition: "fade",
      frame: "blur",
      look: mood === "bold" ? "vivid" : mood === "calm" ? "warm" : "vintage",
      endingCut: true,
    }));
    pushCaption(`${cut.id}-ending`, caption, cursor, span, "fade");
    cursor += span;
  }
  const faded = targetSeconds == null ? crossfade(body) : body;
  const endingStart = faded.reduce((max, clip) => Math.max(max, clip.start + clip.duration), intro?.seconds ?? 0);
  const film = [
    ...(intro ? [titleClip(intro, 0)] : []),
    ...faded,
    ...(ending ? [titleClip(ending, endingStart)] : []),
  ];
  return stretchToTarget(film, targetSeconds);
}

export function filmSummary(clips: { title?: { role?: string }; endingCut?: boolean; start: number; duration: number }[]) {
  const intro = clips.find((clip) => clip.title?.role === "intro");
  const ending = clips.find((clip) => clip.title?.role === "ending");
  const cut = clips.find((clip) => clip.endingCut && clip.duration > 0 && !clip.title);
  const total = clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
  const bodyStart = intro ? intro.start + intro.duration : 0;
  const mainEnd = cut ? cut.start : ending ? ending.start : total;
  return {
    intro: intro?.duration ?? 0,
    ending: ending?.duration ?? 0,
    endingCut: cut?.duration ?? 0,
    body: Math.max(0, mainEnd - bodyStart),
    total,
  };
}

export function musicFadeFor(clips: { kind?: string; title?: { role?: string }; start: number; duration: number }[]) {
  const ending = clips.find((clip) => clip.title?.role === "ending");
  if (!ending) return null;
  return { fadeStart: ending.start, fadeOut: Math.max(0.4, ending.duration) };
}

export function videoDuckSpans(clips: { kind?: string; volume?: number; audioOn?: boolean; start: number; duration: number }[]) {
  return clips
    .filter((clip) => clip.kind === "video" && clip.audioOn !== false && (clip.volume ?? 0) > 0.02)
    .map((clip) => ({ start: clip.start, end: clip.start + clip.duration, level: 0.32 }));
}

const TEMPLATE_KEY = "adsmile.video.titleTemplates.v1";

export type SavedTitleTemplate = { id: string; label: string; intro: TitleCard; ending: TitleCard };

function persistUrl(url?: string) {
  if (!url || url.startsWith("blob:")) return undefined;
  return url;
}

export function readSavedTemplates(): SavedTitleTemplate[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Partial<SavedTitleTemplate>;
      if (!row.label || !row.intro || !row.ending) return [];
      return [{
        id: String(row.id || row.label),
        label: String(row.label).slice(0, 40),
        intro: { ...DEFAULT_INTRO, ...row.intro, role: "intro" as const, logo: customerLogo(row.intro.logo) },
        ending: { ...DEFAULT_ENDING, ...row.ending, role: "ending" as const, logo: customerLogo(row.ending.logo) },
      }];
    });
  } catch {
    return [];
  }
}

export function writeSavedTemplates(items: SavedTitleTemplate[]) {
  if (typeof localStorage === "undefined") return;
  const safe = items.slice(0, 24).map((item) => ({
    ...item,
    intro: { ...item.intro, logo: persistUrl(item.intro.logo), bgImage: persistUrl(item.intro.bgImage) },
    ending: { ...item.ending, logo: persistUrl(item.ending.logo), bgImage: persistUrl(item.ending.bgImage) },
  }));
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(safe));
}

export function applyTitlePreset(current: TitleCard, partial: Partial<TitleCard>): TitleCard {
  const role = partial.role ?? current.role;
  const base = role === "intro" ? DEFAULT_INTRO : DEFAULT_ENDING;
  const seconds = Math.min(30, Math.max(3, partial.seconds ?? current.seconds ?? base.seconds));
  const sub = partial.sub !== undefined ? partial.sub : partial.thanks !== undefined ? partial.thanks : (current.sub || base.sub);
  return {
    ...base,
    ...current,
    ...partial,
    role,
    seconds,
    sub,
    logo: customerLogo(partial.logo ?? current.logo ?? base.logo),
    bg: partial.bg ?? current.bg ?? base.bg,
    bgImage: partial.bgImage === undefined ? current.bgImage : partial.bgImage,
  };
}

function stretchToTarget(clips: PlannedClip[], target: number | null) {
  if (target == null) return clips;
  const endOf = (list: PlannedClip[]) => list.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
  let next = clips;
  const extra = target - endOf(next);
  if (Math.abs(extra) >= 0.0005) {
    const last = [...next].reverse().find((clip) => clip.kind === "image" && !clip.endingCut);
    if (last && last.duration + extra > 0.02) {
      const lastEnd = last.start + last.duration;
      next = next.map((clip) => {
        if (clip.title?.role === "ending") return { ...clip, start: clip.start + extra };
        if (clip.id === last.id || (clip.kind === "text" && !clip.title && Math.abs(clip.start - last.start) < 0.02)) {
          return { ...clip, duration: clip.duration + extra };
        }
        if (!clip.title && clip.start >= lastEnd - 0.02) return { ...clip, start: clip.start + extra };
        return clip;
      });
    }
  }
  const ending = next.find((clip) => clip.title?.role === "ending");
  const withoutEnding = next.reduce((max, clip) => (ending && clip.id === ending.id ? max : Math.max(max, clip.start + clip.duration)), 0);
  if (ending && withoutEnding <= target + 0.001) {
    return next.map((clip) => (clip.id === ending.id ? { ...clip, start: Math.max(0, target - clip.duration) } : clip));
  }
  return next;
}

type OrderedClip = {
  id: string;
  kind: string;
  start: number;
  duration: number;
  track?: number;
  endingCut?: boolean;
  title?: { role?: string };
  pip?: boolean;
  videoPlace?: "auto" | "manual";
  videoAfter?: string | null;
};

export function bodyPhotoId(clip: { id: string; kind: string }) {
  if (clip.kind === "image" && clip.id.endsWith("-photo")) return clip.id.slice(0, -"-photo".length);
  return clip.id;
}

function isMainVisual(clip: { kind: string; pip?: boolean; title?: unknown; track?: number }) {
  return (clip.kind === "image" || clip.kind === "video") && !clip.pip && !clip.title && (clip.track ?? 0) === 0;
}

/** 본편 나열에서 영상이 사진들보다 뒤면 자동, 사진 사이면 사용자가 고정한 위치다. */
export function videoPlacementFor<T extends { id: string; kind: string; endingCut?: boolean }>(order: readonly T[]) {
  const body = order.filter((item) => !item.endingCut);
  let lastPhoto = -1;
  body.forEach((item, index) => {
    if (item.kind === "image") lastPhoto = index;
  });
  const flags = new Map<string, { videoPlace: "auto" | "manual"; videoAfter: string | null }>();
  body.forEach((item, index) => {
    if (item.kind !== "video") return;
    if (lastPhoto < 0 || index > lastPhoto) {
      flags.set(item.id, { videoPlace: "auto", videoAfter: null });
      return;
    }
    const prev = index > 0 ? body[index - 1] : undefined;
    flags.set(item.id, {
      videoPlace: "manual",
      videoAfter: prev ? (prev.kind === "image" ? bodyPhotoId(prev) : prev.id) : null,
    });
  });
  return flags;
}

function packChain<T extends OrderedClip>(clips: T[], seq: T[]): T[] {
  const intro = clips.find((clip) => clip.title?.role === "intro");
  const ending = clips.find((clip) => clip.title?.role === "ending");
  const cut = clips.find((clip) => clip.endingCut && isMainVisual(clip));
  const chain = [...(intro ? [intro] : []), ...seq, ...(cut ? [cut] : []), ...(ending ? [ending] : [])];
  let cursor = 0;
  const placed = new Map<string, { start: number; duration: number }>();
  const seen = new Set<string>();
  for (const clip of chain) {
    if (seen.has(clip.id)) continue;
    seen.add(clip.id);
    placed.set(clip.id, { start: cursor, duration: clip.duration });
    cursor += Math.max(0, clip.duration);
  }
  const captionParent = new Map<string, string>();
  for (const clip of clips) {
    if (!placed.has(clip.id)) continue;
    if (clip.kind === "video") captionParent.set(`${clip.id}-caption`, clip.id);
    if (clip.kind === "image") captionParent.set(`${bodyPhotoId(clip)}-caption`, clip.id);
  }
  return clips.map((clip) => {
    const spot = placed.get(clip.id);
    if (spot) return { ...clip, start: spot.start, duration: spot.duration };
    const parent = captionParent.get(clip.id);
    const parentSpot = parent ? placed.get(parent) : undefined;
    if (clip.kind === "text" && !clip.title && parentSpot) return { ...clip, start: parentSpot.start, duration: parentSpot.duration };
    return clip;
  });
}

/** 타임라인에 보일 본편 순서를 그대로 붙인다. 엔딩컷과 타이틀은 그 앞뒤에 둔다. */
export function layoutVisualOrder<T extends OrderedClip>(clips: T[], visualIds: readonly string[]): T[] {
  const body = clips.filter((clip) => isMainVisual(clip) && !clip.endingCut);
  const byId = new Map(body.map((clip) => [clip.id, clip]));
  const seq: T[] = [];
  const seen = new Set<string>();
  for (const id of visualIds) {
    const clip = byId.get(id);
    if (!clip || seen.has(clip.id)) continue;
    seen.add(clip.id);
    seq.push(clip);
  }
  for (const clip of [...body].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
    if (seen.has(clip.id)) continue;
    seq.push(clip);
  }
  return packChain(clips, seq);
}

/**
 * 사진 순서만 바꾼다.
 * 자동 영상은 사진 맨 뒤(엔딩컷 직전), 사용자가 옮긴 영상은 videoAfter 옆에 둔다.
 */
export function applyMediaOrder<T extends OrderedClip>(clips: T[], photoIds: readonly string[]): T[] {
  const photos = clips.filter((clip) => isMainVisual(clip) && clip.kind === "image" && !clip.endingCut);
  const videos = clips.filter((clip) => isMainVisual(clip) && clip.kind === "video" && !clip.endingCut);
  const byPhoto = new Map(photos.map((clip) => [bodyPhotoId(clip), clip]));
  const orderedPhotos: T[] = [];
  const seen = new Set<string>();
  for (const id of photoIds) {
    const clip = byPhoto.get(id);
    if (!clip || seen.has(clip.id)) continue;
    seen.add(clip.id);
    orderedPhotos.push(clip);
  }
  for (const clip of [...photos].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
    if (seen.has(clip.id)) continue;
    seen.add(clip.id);
    orderedPhotos.push(clip);
  }
  const manual = videos.filter((clip) => clip.videoPlace === "manual").sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const auto = videos.filter((clip) => clip.videoPlace !== "manual").sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const seq: T[] = [];
  for (const video of manual) {
    if (!video.videoAfter) seq.push(video);
  }
  for (const photo of orderedPhotos) {
    seq.push(photo);
    const key = bodyPhotoId(photo);
    for (const video of manual) {
      if (video.videoAfter === key || video.videoAfter === photo.id) seq.push(video);
    }
  }
  const placedManual = new Set(seq.filter((clip) => clip.kind === "video").map((clip) => clip.id));
  for (const video of manual) {
    if (!placedManual.has(video.id)) seq.push(video);
  }
  seq.push(...auto);
  return packChain(clips, seq);
}

type HoldClip = {
  id: string;
  kind: string;
  start: number;
  duration: number;
  track?: number;
  endingCut?: boolean;
  title?: { role?: string };
  pip?: boolean;
};

/** 길이 고정. 영상·인트로·엔딩 길이는 두고 본편 사진만 다시 나눠 전체 끝이 목표와 같게 한다. */
export function holdTargetLength<T extends HoldClip>(clips: T[], target: number, respectPhotoId?: string): T[] {
  if (!Number.isFinite(target) || target <= 0) return clips;
  const visuals = clips.filter((clip) => (clip.kind === "image" || clip.kind === "video") && !clip.pip && (clip.track ?? 0) === 0);
  const intro = clips.find((clip) => clip.title?.role === "intro");
  const ending = clips.find((clip) => clip.title?.role === "ending");
  const cut = visuals.find((clip) => clip.endingCut);
  const body = visuals
    .filter((clip) => clip !== cut && clip.id !== intro?.id && clip.id !== ending?.id)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const videos = body.filter((clip) => clip.kind === "video");
  const photos = body.filter((clip) => clip.kind === "image");
  const reserved = (intro?.duration ?? 0) + (ending?.duration ?? 0) + (cut?.duration ?? 0) + videos.reduce((sum, clip) => sum + clip.duration, 0);
  let photoBudget = target - reserved;
  const shares = new Map<string, number>();
  const pinned = respectPhotoId ? photos.find((clip) => clip.id === respectPhotoId) : undefined;
  if (pinned) {
    const kept = Math.max(0, Math.min(pinned.duration, Math.max(0, photoBudget)));
    shares.set(pinned.id, kept);
    photoBudget -= kept;
    const rest = photos.filter((clip) => clip.id !== pinned.id);
    splitSeconds(Math.max(0, photoBudget), rest.map(() => 1)).forEach((seconds, index) => shares.set(rest[index]!.id, seconds));
  } else {
    splitSeconds(Math.max(0, photoBudget), photos.map(() => 1)).forEach((seconds, index) => shares.set(photos[index]!.id, seconds));
  }
  const sequence = [...(intro ? [intro] : []), ...body, ...(cut ? [cut] : []), ...(ending ? [ending] : [])];
  let cursor = 0;
  const placed = new Map<string, { start: number; duration: number }>();
  for (const clip of sequence) {
    const duration = shares.get(clip.id) ?? clip.duration;
    placed.set(clip.id, { start: cursor, duration });
    cursor += duration;
  }
  const visualEnd = placedEnd(placed);
  const nudged = snapTail(placed, photos, target, visualEnd);
  return clips.map((clip) => {
    const spot = placed.get(clip.id);
    if (spot) return { ...clip, start: spot.start, duration: spot.duration };
    if (clip.kind === "text" && !clip.title) {
      const parent = visuals.find((item) => Math.abs(item.start - clip.start) < 0.05);
      const parentSpot = parent ? placed.get(parent.id) : undefined;
      if (parentSpot) return { ...clip, start: parentSpot.start, duration: parentSpot.duration };
    }
    if (clip.kind === "audio" && nudged <= target + 0.001 && clip.start < target && clip.start + clip.duration > target + 0.001) {
      return { ...clip, duration: Math.max(0.2, target - clip.start) };
    }
    return clip;
  });
}

function placedEnd(placed: Map<string, { start: number; duration: number }>) {
  return Math.max(0, ...[...placed.values()].map((spot) => spot.start + spot.duration));
}

/** 밀리초 반올림으로 끝이 목표에서 한 프레임 안쪽으로 어긋나면 마지막 사진이 흡수한다. */
function snapTail(placed: Map<string, { start: number; duration: number }>, photos: { id: string }[], target: number, visualEnd: number) {
  const drift = target - visualEnd;
  if (Math.abs(drift) < 0.0005 || Math.abs(drift) >= 0.05) return visualEnd;
  const absorber = [...photos].reverse().find((clip) => (placed.get(clip.id)?.duration ?? 0) + drift > 0.02);
  const spot = absorber ? placed.get(absorber.id) : undefined;
  if (!spot) return visualEnd;
  const oldEnd = spot.start + spot.duration;
  spot.duration += drift;
  for (const item of placed.values()) {
    if (item !== spot && item.start >= oldEnd - 0.0001) item.start += drift;
  }
  return target;
}

export function directClips(
  photos: StoryPhoto[],
  targetSeconds: number | null,
  mood: "warm" | "bold" | "calm",
  options: { reorder?: boolean; intro?: false | true | Partial<TitleCard>; ending?: false | true | Partial<TitleCard> } = {},
): PlannedClip[] {
  const intro = options.intro === true ? {} : options.intro;
  const ending = options.ending === true ? {} : options.ending;
  return directFilm(
    photos.map((photo) => ({ kind: "image" as const, ...photo })),
    targetSeconds,
    mood,
    { reorder: options.reorder, intro, ending },
  );
}
