import { planSlideshow, type PlannedClip } from "./slideshow";

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

export function directClips(
  photos: StoryPhoto[],
  targetSeconds: number | null,
  mood: "warm" | "bold" | "calm",
  reorder = false,
): PlannedClip[] {
  const timed = fitDurations(photos, targetSeconds, reorder);
  const slides = timed.map((photo) => ({
    id: photo.id,
    name: photo.name,
    url: photo.url ?? "",
    caption: photo.caption || BEATS.find((beat) => beat.id === photo.beat)?.title || "",
    seconds: photo.seconds,
  }));
  const clips = planSlideshow(slides);
  return clips.map((clip) => {
    if (clip.kind !== "image") return clip;
    return {
      ...clip,
      look: mood === "bold" ? "vivid" as const : mood === "calm" ? "warm" as const : "vintage" as const,
      motion: clip.name ? (mood === "bold" ? "zoom-in" as const : "pan-left" as const) : clip.motion,
    };
  });
}
