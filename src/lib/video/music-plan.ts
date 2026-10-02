export const MUSIC_FILE_LIMIT = 40 * 1024 * 1024;
export const MUSIC_QUOTA = 1024 * 1024 * 1024;

export const BUILTIN_MUSIC_CATEGORIES = ["잔잔", "감동", "밝은", "경쾌", "웅장", "추억", "행사", "엔딩", "기타"] as const;

export type BedTrack = {
  id: string;
  name: string;
  url: string;
  category: string;
  favorite?: boolean;
  duration?: number;
};

export type MusicSection = { key: string; start: number; end: number; categories: string[] };

type Timed = { title?: { role?: string }; kind?: string; start: number; duration: number };

export function musicSections(clips: Timed[]): MusicSection[] {
  const intro = clips.find((clip) => clip.title?.role === "intro");
  const ending = clips.find((clip) => clip.title?.role === "ending");
  const total = clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
  const bodyStart = intro ? intro.start + intro.duration : 0;
  const bodyEnd = ending ? ending.start : total;
  const sections: MusicSection[] = [];
  if (intro && intro.duration > 0.4) {
    sections.push({ key: "intro", start: intro.start, end: intro.start + intro.duration, categories: ["잔잔", "감동"] });
  }
  const span = Math.max(0, bodyEnd - bodyStart);
  if (span > 0.4) {
    const third = span / 3;
    sections.push({ key: "early", start: bodyStart, end: bodyStart + third, categories: ["추억", "잔잔"] });
    sections.push({ key: "mid", start: bodyStart + third, end: bodyStart + third * 2, categories: ["밝은", "경쾌", "행사"] });
    sections.push({ key: "late", start: bodyStart + third * 2, end: bodyEnd, categories: ["감동", "웅장"] });
  }
  if (ending && ending.duration > 0.2) {
    sections.push({
      key: "ending",
      start: ending.start,
      end: Math.max(ending.start + ending.duration, total),
      categories: ["엔딩", "감동"],
    });
  }
  if (!sections.length && total > 0.4) sections.push({ key: "all", start: 0, end: total, categories: ["잔잔", "기타"] });
  return sections.filter((section) => section.end - section.start > 0.25);
}

export function sectionsFreeOf(sections: MusicSection[], pinned: { start: number; duration: number }[]) {
  return sections.filter((section) => {
    const mid = (section.start + section.end) / 2;
    return !pinned.some((bed) => mid >= bed.start - 0.05 && mid < bed.start + bed.duration - 0.05);
  });
}

function contiguous(sections: MusicSection[]) {
  const sorted = [...sections].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.start - sorted[i - 1]!.end > 0.45) return false;
  }
  return true;
}

function pickTrack(tracks: BedTrack[], categories: string[], used: Set<string>, prefer: string[]): BedTrack | null {
  if (!tracks.length) return null;
  const fresh = tracks.filter((track) => !used.has(track.id));
  const base = fresh.length ? fresh : tracks;
  const pool = base.filter((track) => categories.includes(track.category));
  const list = pool.length ? pool : base;
  const favorites = list.filter((track) => track.favorite);
  const ranked = favorites.length ? favorites : list;
  const preferred = ranked.filter((track) => prefer.includes(track.category));
  return preferred[0] ?? ranked[0] ?? null;
}

export type LaidBed = {
  libraryId: string;
  name: string;
  url: string;
  category: string;
  start: number;
  duration: number;
  fadeIn: number;
  fadeOut: number;
  volume: number;
  loop: boolean;
};

function mergeTouching(beds: LaidBed[]) {
  const out: LaidBed[] = [];
  for (const bed of beds) {
    const prev = out.at(-1);
    if (prev && prev.libraryId === bed.libraryId && bed.start <= prev.start + prev.duration + 0.08) {
      const end = Math.max(prev.start + prev.duration, bed.start + bed.duration);
      prev.duration = end - prev.start;
      prev.fadeOut = bed.fadeOut;
      prev.loop = prev.loop || bed.loop;
      continue;
    }
    out.push({ ...bed });
  }
  return out;
}

/** 구간 분위기와 맞는 음악을 겹쳐 놓고, 곡 사이는 크로스페이드한다. 한 곡뿐이면 빈틈이 없을 때 전체를 한 번만 깐다. */
export function layMusicBeds(sections: MusicSection[], tracks: BedTrack[], cross = 1.2, prefer: string[] = []): LaidBed[] {
  if (!sections.length || !tracks.length) return [];
  const ordered = [...sections].sort((a, b) => a.start - b.start);
  const totalStart = ordered[0]!.start;
  const totalEnd = Math.max(...ordered.map((section) => section.end));
  if (tracks.length === 1 && contiguous(ordered)) {
    const track = tracks[0]!;
    const duration = Math.max(0.8, totalEnd - totalStart);
    return [{
      libraryId: track.id,
      name: track.name,
      url: track.url,
      category: track.category,
      start: totalStart,
      duration,
      fadeIn: 0.6,
      fadeOut: 0,
      volume: 0.7,
      loop: !track.duration || track.duration + 0.25 < duration,
    }];
  }
  const used = new Set<string>();
  const laid = ordered.flatMap((section, index) => {
    const track = pickTrack(tracks, section.categories, used, prefer);
    if (!track) return [];
    used.add(track.id);
    const prev = index > 0 && section.start - ordered[index - 1]!.end < 0.45;
    const next = index < ordered.length - 1 && ordered[index + 1]!.start - section.end < 0.45;
    const start = Math.max(0, section.start - (prev ? cross / 2 : 0));
    const end = section.end + (next ? cross / 2 : 0);
    const duration = Math.max(0.8, end - start);
    return [{
      libraryId: track.id,
      name: track.name,
      url: track.url,
      category: track.category,
      start,
      duration,
      fadeIn: prev ? cross : 0.6,
      fadeOut: next ? cross : 0,
      volume: 0.7,
      loop: !track.duration || track.duration + 0.25 < duration,
    }];
  });
  return mergeTouching(laid);
}

export function appendMusicSlot(
  existing: { start: number; duration: number }[],
  filmEnd: number,
  cross = 1.2,
) {
  const last = [...existing].sort((a, b) => a.start + a.duration - (b.start + b.duration)).at(-1);
  if (!last) {
    return { start: 0, duration: Math.max(8, filmEnd || 12), fadeIn: 0.6, fadeOut: 0, trimPreviousTo: null as number | null };
  }
  const start = Math.max(0, last.start + last.duration - cross);
  return {
    start,
    duration: Math.max(8, (filmEnd || start + 12) - start),
    fadeIn: cross,
    fadeOut: 0,
    trimPreviousTo: Math.max(0.4, start + cross - last.start),
  };
}

export function formatBytes(bytes: number) {
  const n = Math.max(0, bytes);
  if (n < 1024) return `${Math.round(n)}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  if (n < 1024 * 1024 * 1024) {
    const mb = n / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10}MB`;
  }
  return `${Math.round((n / (1024 * 1024 * 1024)) * 100) / 100}GB`;
}

export function restoreUserMusicUrls<T extends { musicSource?: string; libraryId?: string; url?: string }>(
  clips: T[],
  playUrls: ReadonlyMap<string, string>,
) {
  return clips.map((clip) => {
    if (clip.musicSource !== "user" || !clip.libraryId) return clip;
    const url = playUrls.get(clip.libraryId);
    return url ? { ...clip, url } : clip;
  });
}
