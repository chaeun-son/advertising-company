import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { avcCodec, exportBitrate, frameCount, type ExportFps } from "./export-presets";

export type ExportAudio = {
  url: string;
  start: number;
  duration: number;
  offset: number;
  volume: number;
  loop?: boolean;
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
  const mixed = await mixAudio(options.audio ?? [], duration);
  const audio = mixed && (await aacAvailable(mixed.sampleRate)) ? mixed : null;
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

async function mixAudio(clips: ExportAudio[], duration: number) {
  const audible = clips.filter((clip) => clip.url && clip.volume > 0 && clip.duration > 0);
  if (!audible.length || typeof OfflineAudioContext === "undefined") return null;
  const sampleRate = 48000;
  const context = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * sampleRate)), sampleRate);
  let mixed = 0;
  for (const clip of audible) {
    try {
      const response = await fetch(new URL(clip.url, location.origin));
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      const source = context.createBufferSource();
      source.buffer = decoded;
      source.loop = Boolean(clip.loop);
      const gain = context.createGain();
      gain.gain.value = Math.min(1, Math.max(0, clip.volume));
      source.connect(gain);
      gain.connect(context.destination);
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
  if (typeof AudioEncoder === "undefined") return;
  const support = await AudioEncoder.isConfigSupported({
    codec: "mp4a.40.2",
    sampleRate: audio.sampleRate,
    numberOfChannels: 2,
    bitrate: 128000,
  });
  if (!support.supported) return;
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
  for (let offset = 0; offset < left.length; offset += packet) {
    const frames = Math.min(packet, left.length - offset);
    const data = new Float32Array(packet * 2);
    data.set(left.subarray(offset, offset + frames), 0);
    data.set(right.subarray(offset, offset + frames), packet);
    const sample = new AudioData({
      format: "f32-planar",
      sampleRate: audio.sampleRate,
      numberOfFrames: packet,
      numberOfChannels: 2,
      timestamp: Math.round((offset / audio.sampleRate) * 1_000_000),
      data,
    });
    encoder.encode(sample);
    sample.close();
  }
  await encoder.flush();
  encoder.close();
}
