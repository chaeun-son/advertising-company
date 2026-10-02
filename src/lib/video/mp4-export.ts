import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { avcCodec, bedStops, exportBitrate, frameCount, type ExportFps, type GainDuck } from "./export-presets";

export function gainAt(volume: number, at: number, start: number, duration: number, fadeOut = 0) {
  const level = Math.min(1, Math.max(0, volume));
  if (fadeOut <= 0) return level;
  const fadeStart = start + Math.max(0, duration - fadeOut);
  if (at <= fadeStart) return level;
  if (at >= start + duration) return 0;
  return level * (1 - (at - fadeStart) / fadeOut);
}

export type ExportAudio = {
  url: string;
  start: number;
  duration: number;
  offset: number;
  volume: number;
  loop?: boolean;
  fadeIn?: number;
  clipFadeOut?: number;
  fadeStart?: number;
  fadeOut?: number;
  ducks?: GainDuck[];
  playbackRate?: number;
  rateFrom?: number;
  rateTo?: number;
  volumeKeys?: { t: number; v: number }[];
};

export async function mp4EncoderAvailable(width: number, height: number, fps: ExportFps) {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec: avcCodec(height),
      width,
      height,
      bitrate: exportBitrate(height, fps),
      framerate: fps,
      avc: { format: "avc" },
    });
    return Boolean(support.supported);
  } catch {
    return false;
  }
}

export async function encodeMp4(options: {
  width: number;
  height: number;
  fps: ExportFps;
  duration: number;
  render: (canvas: HTMLCanvasElement, time: number) => Promise<void> | void;
  audio?: ExportAudio[];
  onProgress?: (ratio: number) => void;
}) {
  const { width, height, fps, duration } = options;
  if (!(await mp4EncoderAvailable(width, height, fps))) {
    throw new Error("이 브라우저에서는 선택한 MP4 화질을 만들 수 없습니다. 1080p 30fps로 낮추거나 WEBM으로 받으세요.");
  }
  const frames = frameCount(duration, fps);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const requested = (options.audio ?? []).filter((clip) => clip.url && clip.volume > 0 && clip.duration > 0);
  const mixed = await mixAudio(requested, duration);
  if (requested.length && !mixed) {
    throw new Error("타임라인의 소리를 읽지 못했습니다. 음악 파일이나 영상 원음을 확인한 뒤 다시 받아 주세요.");
  }
  const audio = mixed && (await aacAvailable(mixed.sampleRate)) ? mixed : null;
  if (mixed && !audio) {
    throw new Error("이 브라우저는 MP4 소리(AAC)를 만들지 못합니다. Chrome에서 다시 받거나 WEBM을 사용해 주세요.");
  }
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height, frameRate: fps },
    audio: audio ? { codec: "aac", numberOfChannels: 2, sampleRate: audio.sampleRate } : undefined,
    fastStart: false,
    firstTimestampBehavior: "offset",
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      throw error;
    },
  });
  encoder.configure({
    codec: avcCodec(height),
    width,
    height,
    bitrate: exportBitrate(height, fps),
    framerate: fps,
    latencyMode: "quality",
    avc: { format: "avc" },
  });
  for (let index = 0; index < frames; index += 1) {
    const time = index / fps;
    await options.render(canvas, Math.min(time, Math.max(0, duration - 0.001)));
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(time * 1_000_000),
      duration: Math.round(1_000_000 / fps),
    });
    encoder.encode(frame, { keyFrame: index % (fps * 2) === 0 });
    frame.close();
    if (encoder.encodeQueueSize > 6) {
      await new Promise<void>((resolve) => {
        encoder.addEventListener("dequeue", () => resolve(), { once: true });
      });
    }
    options.onProgress?.(index / frames);
  }
  await encoder.flush();
  encoder.close();
  if (audio) await encodeAac(muxer, audio);
  muxer.finalize();
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), audio: Boolean(audio) };
}

async function aacAvailable(sampleRate: number) {
  if (typeof AudioEncoder === "undefined") return false;
  try {
    const support = await AudioEncoder.isConfigSupported({
      codec: "mp4a.40.2",
      sampleRate,
      numberOfChannels: 2,
      bitrate: 128000,
    });
    return Boolean(support.supported);
  } catch {
    return false;
  }
}

export async function mixAudio(clips: ExportAudio[], duration: number) {
  const audible = clips.filter((clip) => clip.url && clip.volume > 0 && clip.duration > 0);
  if (!audible.length || typeof OfflineAudioContext === "undefined") return null;
  const sampleRate = 48000;
  const context = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * sampleRate)), sampleRate);
  let mixed = 0;
  for (const clip of audible) {
    try {
      const response = await fetch(clip.url);
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      const source = context.createBufferSource();
      source.buffer = decoded;
      source.loop = Boolean(clip.loop);
      const gain = context.createGain();
      const level = Math.min(1, Math.max(0, clip.volume));
      const keys = (clip.volumeKeys ?? []).filter((key) => Number.isFinite(key.t) && Number.isFinite(key.v)).sort((a, b) => a.t - b.t);
      if (keys.length) {
        const first = keys[0]!;
        gain.gain.setValueAtTime(Math.max(0, Math.min(1, first.v)), Math.max(0, clip.start + first.t));
        let lastT = Math.max(0, clip.start + first.t);
        for (const key of keys.slice(1)) {
          const t = Math.max(lastT + 0.001, clip.start + key.t);
          gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, key.v)), t);
          lastT = t;
        }
      } else {
        const stops = bedStops(
          level,
          clip.start,
          clip.duration,
          clip.fadeIn ?? 0,
          clip.clipFadeOut ?? 0,
          clip.fadeStart,
          clip.fadeOut,
          clip.ducks ?? [],
        );
        const first = stops[0] ?? { t: Math.max(0, clip.start), v: level };
        gain.gain.setValueAtTime(Math.max(0, first.v), Math.max(0, first.t));
        let lastT = Math.max(0, first.t);
        for (const stop of stops.slice(1)) {
          const t = Math.max(lastT + 0.001, stop.t);
          gain.gain.linearRampToValueAtTime(Math.max(0, stop.v), t);
          lastT = t;
        }
      }
      source.connect(gain);
      gain.connect(context.destination);
      const from = clip.rateFrom;
      const to = clip.rateTo;
      const rate = clip.playbackRate && clip.playbackRate > 0 ? clip.playbackRate : 1;
      if (from != null && to != null && from !== to) {
        const t0 = Math.max(0, clip.start);
        source.playbackRate.setValueAtTime(Math.max(0.05, from), t0);
        source.playbackRate.linearRampToValueAtTime(Math.max(0.05, to), t0 + Math.max(0.05, clip.duration));
      } else if (rate !== 1) {
        source.playbackRate.value = rate;
      }
      source.start(Math.max(0, clip.start), Math.max(0, clip.offset), clip.duration);
      mixed += 1;
    } catch {
      // 한 트랙이 깨져도 나머지 소리와 영상은 만든다.
    }
  }
  if (!mixed) return null;
  return context.startRendering();
}

async function encodeAac(muxer: Muxer<ArrayBufferTarget>, audio: AudioBuffer) {
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (error) => {
      throw error;
    },
  });
  encoder.configure({
    codec: "mp4a.40.2",
    sampleRate: audio.sampleRate,
    numberOfChannels: 2,
    bitrate: 128000,
  });
  const left = audio.getChannelData(0);
  const right = audio.numberOfChannels > 1 ? audio.getChannelData(1) : left;
  const packet = 1024;
  const frameDuration = Math.round((packet / audio.sampleRate) * 1_000_000);
  let chunks = 0;
  for (let offset = 0, index = 0; offset < left.length; offset += packet, index += 1) {
    const frames = Math.min(packet, left.length - offset);
    const data = new Float32Array(packet * 2);
    for (let i = 0; i < frames; i += 1) {
      data[i * 2] = left[offset + i] ?? 0;
      data[i * 2 + 1] = right[offset + i] ?? 0;
    }
    const sample = new AudioData({
      format: "f32",
      sampleRate: audio.sampleRate,
      numberOfFrames: packet,
      numberOfChannels: 2,
      timestamp: index * frameDuration,
      data,
    });
    encoder.encode(sample);
    sample.close();
    chunks += 1;
  }
  await encoder.flush();
  encoder.close();
  if (!chunks) throw new Error("AAC 소리 트랙이 비어 있습니다.");
}
