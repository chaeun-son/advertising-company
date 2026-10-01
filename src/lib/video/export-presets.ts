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
