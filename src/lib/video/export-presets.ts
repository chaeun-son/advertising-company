export const EXPORT_SIZES = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "4k": { width: 3840, height: 2160 },
} as const;

export type ExportSize = keyof typeof EXPORT_SIZES;
export type ExportFps = 30 | 60;

export function exportBitrate(height: number, fps: ExportFps) {
  const base = height >= 2160 ? 20_000_000 : height >= 1080 ? 8_000_000 : 4_000_000;
  return fps > 30 ? Math.round(base * 1.4) : base;
}

export function avcCodec(height: number) {
  return height >= 1080 ? "avc1.640028" : "avc1.42001f";
}

export function frameCount(duration: number, fps: ExportFps) {
  return Math.max(1, Math.round(Math.max(0.2, duration) * fps));
}

/** 절대 시각 기준 페이드. 엔딩 타이틀에서 BGM을 0까지 내린다. */
export function levelAt(volume: number, at: number, fadeStart?: number, fadeOut?: number) {
  const level = Math.min(1, Math.max(0, volume));
  if (fadeStart == null || !fadeOut || fadeOut <= 0) return level;
  if (at <= fadeStart) return level;
  if (at >= fadeStart + fadeOut) return 0;
  return level * (1 - (at - fadeStart) / fadeOut);
}

export type GainDuck = { start: number; end: number; level: number };

/** 영상 원음 구간에서는 BGM을 낮추고, 그 다음 엔딩 페이드를 곱한다. */
export function heardLevel(volume: number, at: number, fadeStart?: number, fadeOut?: number, ducks: GainDuck[] = []) {
  const full = Math.min(1, Math.max(0, volume));
  const ramp = 0.45;
  let ducked = full;
  for (const duck of ducks) {
    if (at < duck.start || at >= duck.end) continue;
    const into = Math.min(1, Math.max(0, (at - duck.start) / ramp));
    const outOf = Math.min(1, Math.max(0, (duck.end - at) / ramp));
    const amount = Math.min(into, outOf);
    ducked = Math.min(ducked, full * (1 - amount * (1 - duck.level)));
  }
  if (fadeStart == null || !fadeOut || fadeOut <= 0 || at <= fadeStart) return ducked;
  if (at >= fadeStart + fadeOut) return 0;
  return ducked * (1 - (at - fadeStart) / fadeOut);
}

/** 클립 페이드 인과 페이드 아웃, 그 위의 더킹과 엔딩 페이드를 곱한다. */
export function bedLevel(
  volume: number,
  at: number,
  clipStart: number,
  clipDuration: number,
  fadeIn = 0,
  fadeOut = 0,
  endingStart?: number,
  endingFade?: number,
  ducks: GainDuck[] = [],
) {
  const end = clipStart + clipDuration;
  if (at < clipStart - 0.0001 || at > end + 0.0001) return 0;
  let level = heardLevel(volume, at, endingStart, endingFade, ducks);
  const local = at - clipStart;
  if (fadeIn > 0.001) level *= Math.max(0, Math.min(1, local / fadeIn));
  if (fadeOut > 0.001) level *= Math.max(0, Math.min(1, (clipDuration - local) / fadeOut));
  return level;
}

export function bedStops(
  volume: number,
  clipStart: number,
  clipDuration: number,
  fadeIn = 0,
  fadeOut = 0,
  endingStart?: number,
  endingFade?: number,
  ducks: GainDuck[] = [],
) {
  const end = clipStart + Math.max(0, clipDuration);
  const marks = new Set<number>([clipStart, end]);
  const add = (t: number) => {
    if (t >= clipStart - 0.001 && t <= end + 0.001) marks.add(Math.round(Math.min(end, Math.max(clipStart, t)) * 1000) / 1000);
  };
  if (fadeIn > 0) {
    const step = Math.max(0.05, fadeIn / 6);
    for (let t = clipStart; t <= Math.min(end, clipStart + fadeIn) + 0.001; t += step) add(t);
    add(clipStart + fadeIn);
  }
  if (fadeOut > 0) {
    const start = Math.max(clipStart, end - fadeOut);
    const step = Math.max(0.05, fadeOut / 6);
    for (let t = start; t <= end + 0.001; t += step) add(t);
  }
  for (const duck of ducks) {
    const span = Math.max(0, duck.end - duck.start);
    const step = Math.min(0.1, Math.max(0.05, span / 8));
    for (let t = duck.start; t < duck.end; t += step) add(t);
    add((duck.start + duck.end) / 2);
    add(duck.end);
  }
  if (endingFade && endingFade > 0 && endingStart != null) {
    const step = Math.max(0.2, endingFade / 8);
    for (let t = endingStart; t <= endingStart + endingFade + 0.001; t += step) add(t);
    add(endingStart + endingFade);
  }
  return [...marks].sort((a, b) => a - b).map((t) => ({
    t,
    v: bedLevel(volume, t, clipStart, clipDuration, fadeIn, fadeOut, endingStart, endingFade, ducks),
  }));
}

export function gainStops(volume: number, duration: number, fadeStart?: number, fadeOut?: number, ducks: GainDuck[] = []) {
  const marks = new Set<number>([0, Math.max(0, duration)]);
  const ramp = 0.45;
  for (const duck of ducks) {
    for (const t of [duck.start, duck.start + ramp, Math.max(duck.start, duck.end - ramp), duck.end]) {
      if (t >= -0.001 && t <= duration + 0.001) marks.add(Math.round(Math.min(duration, Math.max(0, t)) * 1000) / 1000);
    }
  }
  if (fadeOut && fadeOut > 0 && fadeStart != null) {
    const end = Math.min(duration, fadeStart + fadeOut);
    const start = Math.max(0, Math.min(duration, fadeStart));
    const step = Math.max(0.25, fadeOut / 6);
    for (let t = start; t <= end + 0.001; t += step) marks.add(Math.round(Math.min(duration, t) * 1000) / 1000);
    marks.add(Math.round(end * 1000) / 1000);
  }
  return [...marks].sort((a, b) => a - b).map((t) => ({ t, v: heardLevel(volume, t, fadeStart, fadeOut, ducks) }));
}
