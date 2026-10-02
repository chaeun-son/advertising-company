import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, appendFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const root = "/tmp/delivery-export";
const shots = "/workspace/screenshots";
mkdirSync(root, { recursive: true });
mkdirSync(shots, { recursive: true });

const colors = ["#e23b2f", "#f08c00", "#e6c84a", "#7dbe4a", "#2aa9a1", "#3b6fd8", "#7a4cc2", "#d45d8c", "#c46b3a", "#8d948c"];
for (let index = 0; index < colors.length; index += 1) {
  execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=${colors[index]}:s=1280x720`, "-frames:v", "1", `${root}/p${index}.jpg`], { stdio: "ignore" });
}
execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=#ff2bd6:s=1280x720", "-frames:v", "1", `${root}/end.jpg`], { stdio: "ignore" });
execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=#ff2a2a:s=240x240", "-frames:v", "1", `${root}/customer-logo.png`], { stdio: "ignore" });
execFileSync("ffmpeg", [
  "-y",
  "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=18",
  "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=18",
  "-filter:a", "volume=0.22",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
  `${root}/clip.mp4`,
], { stdio: "ignore" });

const photoB64 = colors.map((_, index) => readFileSync(`${root}/p${index}.jpg`).toString("base64"));
const endB64 = readFileSync(`${root}/end.jpg`).toString("base64");
const logoB64 = readFileSync(`${root}/customer-logo.png`).toString("base64");
const videoB64 = readFileSync(`${root}/clip.mp4`).toString("base64");

const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (error) => console.error("PAGE", error.message));
page.on("console", (msg) => console.log("BROWSER", msg.text()));
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.addScriptTag({
  type: "module",
  content: `
    import { directFilm, filmSummary, musicFadeFor, videoDuckSpans } from "/src/lib/video/director.ts";
    import { encodeMp4 } from "/src/lib/video/mp4-export.ts";
    import { paintTitleCard } from "/src/lib/video/title-paint.ts";
    import { gainStops, heardLevel } from "/src/lib/video/export-presets.ts";
    import { customerLogo } from "/src/lib/video/slideshow.ts";
    window.__vf = { directFilm, filmSummary, musicFadeFor, videoDuckSpans, encodeMp4, paintTitleCard, gainStops, heardLevel, customerLogo };
  `,
});
await page.waitForFunction(() => window.__vf, null, { timeout: 20000 });

const preview = await page.evaluate(async ({ photoB64, endB64, logoB64, videoB64 }) => {
  const { directFilm, filmSummary, paintTitleCard, customerLogo } = window.__vf;
  const blobUrl = (b64, type) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type }));
  };
  const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
  const images = new Map();
  const brand = await loadImage("/adsmile-mark.png");
  images.set("/adsmile-mark.png", brand);
  images.set("/adsmile-logo.png", brand);
  const customerUrl = blobUrl(logoB64, "image/png");
  const customer = await loadImage(customerUrl);
  images.set(customerUrl, customer);
  const photos = [];
  for (let index = 0; index < photoB64.length; index += 1) {
    const url = blobUrl(photoB64[index], "image/jpeg");
    images.set(url, await loadImage(url));
    photos.push({ kind: "image", id: `p${index}`, name: `사진${index + 1}.jpg`, url, caption: `${index + 1}번 장면` });
  }
  const endUrl = blobUrl(endB64, "image/jpeg");
  images.set(endUrl, await loadImage(endUrl));
  const videoUrl = blobUrl(videoB64, "video/mp4");
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  await new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("video"));
  });
  const intro = { seconds: 7, main: "창립 50주년", sub: "함께 걸어온 시간", date: "1977 – 2026", style: "luxury", motion: "fade", logo: "/adsmile-mark.png", bg: "#1a140f" };
  const ending = { seconds: 6, main: "감사합니다", sub: "함께해 주셔서 고맙습니다", org: "", date: "2026. 10. 1", style: "simple", motion: "fade", logo: "/adsmile-logo.png", bg: "#000000" };
  const film = directFilm(
    [
      ...photos,
      { kind: "video", id: "v", name: "현장.mp4", url: videoUrl, duration: 18, offset: 0, volume: 1, audioOn: true, caption: "현장 영상" },
      { kind: "image", id: "end", name: "단체.jpg", url: endUrl, caption: "마지막 단체" },
    ],
    null,
    "warm",
    { reorder: false, intro, ending, endingCut: { sourceId: "end", seconds: 7, caption: "함께한 50년" } },
  );
  const summary = filmSummary(film);
  const introCard = film.find((clip) => clip.title?.role === "intro");
  const endingCard = film.find((clip) => clip.title?.role === "ending");
  const cut = film.find((clip) => clip.endingCut);
  const videoClip = film.find((clip) => clip.kind === "video");
  const paint = (card, name) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    paintTitleCard(canvas.getContext("2d"), card, 1280, 720, 0.6, images);
    return { name, png: canvas.toDataURL("image/png") };
  };
  const clean = paint(introCard.title, "delivery-intro-card.png");
  const forbidden = paint({ ...introCard.title, logo: "/adsmile-mark.png" }, "delivery-intro-forbidden.png");
  const customerCard = paint({ ...introCard.title, logo: customerUrl }, "delivery-customer-logo.png");
  const endingStill = paint(endingCard.title, "delivery-ending-card.png");
  const diff = (() => {
    const a = document.createElement("canvas");
    const b = document.createElement("canvas");
    a.width = b.width = 320;
    a.height = b.height = 180;
    const left = a.getContext("2d");
    const right = b.getContext("2d");
    const sourceA = new Image();
    const sourceB = new Image();
    return new Promise((resolve) => {
      let pending = 2;
      const done = () => {
        pending -= 1;
        if (pending) return;
        left.drawImage(sourceA, 0, 0, 320, 180);
        right.drawImage(sourceB, 0, 0, 320, 180);
        const pa = left.getImageData(0, 0, 320, 180).data;
        const pb = right.getImageData(0, 0, 320, 180).data;
        let sum = 0;
        for (let i = 0; i < pa.length; i += 4) sum += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
        resolve(sum / (pa.length / 4) / 3);
      };
      sourceA.onload = done;
      sourceB.onload = done;
      sourceA.src = clean.png;
      sourceB.src = forbidden.png;
    });
  })();
  window.__exportJob = { film, images, video, videoUrl, summary };
  return {
    summary,
    names: film.filter((clip) => clip.kind === "image" || clip.kind === "video").map((clip) => clip.name),
    introLogo: introCard?.title?.logo ?? null,
    endingLogo: endingCard?.title?.logo ?? null,
    endingOrg: endingCard?.title?.org ?? null,
    endingBg: endingCard?.title?.bg ?? null,
    customerLogoStripped: customerLogo("/adsmile-mark.png") ?? null,
    intro: introCard?.duration,
    ending: endingCard?.duration,
    video: videoClip?.duration,
    videoStart: videoClip?.start,
    cut: cut?.duration,
    cutStart: cut?.start,
    cutName: cut?.name,
    endingStart: endingCard?.start,
    caption: film.find((clip) => clip.id === "end-ending-caption")?.text ?? "",
    total: summary.total,
    logoDiff: await diff,
    cards: [clean, forbidden, customerCard, endingStill],
  };
}, { photoB64, endB64, logoB64, videoB64 });

for (const card of preview.cards) {
  writeFileSync(`${shots}/${card.name}`, Buffer.from(card.png.replace(/^data:image\/png;base64,/, ""), "base64"));
}
console.log(JSON.stringify({ ...preview, cards: preview.cards.map((card) => card.name) }));

const outPath = `${root}/video.mp4`;
rmSync(outPath, { force: true });
await page.exposeFunction("__writeMp4", (chunk) => {
  appendFileSync(outPath, Buffer.from(chunk, "base64"));
});
const wavPath = `${root}/mix.wav`;
rmSync(wavPath, { force: true });
await page.exposeFunction("__writeWav", (chunk) => {
  appendFileSync(wavPath, Buffer.from(chunk, "base64"));
});

const encoded = await page.evaluate(async () => {
  const { encodeMp4, musicFadeFor, videoDuckSpans, gainStops } = window.__vf;
  const { film, images, video, videoUrl } = window.__exportJob;
  const end = Math.max(...film.map((clip) => clip.start + clip.duration));
  const seek = (el, time) => new Promise((resolve) => {
    const done = () => {
      el.removeEventListener("seeked", done);
      resolve();
    };
    el.addEventListener("seeked", done);
    try { el.currentTime = Math.min(Math.max(0, time), Math.max(0, (el.duration || 18) - 0.04)); } catch { resolve(); }
    setTimeout(resolve, 700);
  });
  const render = async (canvas, time) => {
    const ctx = canvas.getContext("2d");
    const designW = 1280;
    const designH = 720;
    ctx.setTransform(canvas.width / designW, 0, 0, canvas.height / designH, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, designW, designH);
    const list = [...film].sort((a, b) => a.track - b.track);
    for (const clip of list) {
      if (time < clip.start || time >= clip.start + clip.duration) continue;
      const local = clip.duration > 0 ? (time - clip.start) / clip.duration : 0;
      if (clip.title) {
        window.__vf.paintTitleCard(ctx, clip.title, designW, designH, local, images);
        continue;
      }
      if (clip.kind === "image" && clip.url) {
        const img = images.get(clip.url);
        if (img) ctx.drawImage(img, 0, 0, designW, designH);
      }
      if (clip.kind === "video") {
        const at = (clip.offset || 0) + Math.max(0, time - clip.start);
        if (Math.abs(video.currentTime - at) > 0.05) await seek(video, at);
        if (video.readyState >= 2) ctx.drawImage(video, 0, 0, designW, designH);
      }
      if (clip.kind === "text" && clip.text) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(designW * 0.2, designH * 0.78, designW * 0.6, 64);
        ctx.fillStyle = "#fffdf8";
        ctx.font = "700 36px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(clip.text, designW / 2, designH * 0.78 + 32);
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
  const fade = musicFadeFor(film);
  const ducks = videoDuckSpans(film);
  const videoClip = film.find((clip) => clip.kind === "video" && clip.audioOn !== false);
  const audio = [
    {
      url: "/music/emotion-a.mp3",
      start: 0,
      duration: end,
      offset: 0,
      volume: 0.7,
      loop: true,
      fadeStart: fade?.fadeStart,
      fadeOut: fade?.fadeOut,
      ducks,
    },
    videoClip?.url ? { url: videoClip.url, start: videoClip.start, duration: videoClip.duration, offset: videoClip.offset || 0, volume: 1 } : null,
  ].filter(Boolean);
  let aacInside = false;
  let audioError = "";
  try {
    const result = await encodeMp4({
      width: 1920,
      height: 1080,
      fps: 30,
      duration: end,
      audio,
      onProgress: (ratio) => {
        const mark = Math.round(ratio * 10);
        if (mark !== window.__mark) {
          window.__mark = mark;
          console.log(`encode ${mark * 10}%`);
        }
      },
      render,
    });
    aacInside = Boolean(result.audio);
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const size = 256 * 1024;
    for (let offset = 0; offset < bytes.length; offset += size) {
      let binary = "";
      const slice = bytes.subarray(offset, Math.min(bytes.length, offset + size));
      for (let i = 0; i < slice.length; i += 1) binary += String.fromCharCode(slice[i]);
      await window.__writeMp4(btoa(binary));
    }
  } catch (error) {
    audioError = error instanceof Error ? error.message : String(error);
    if (!audioError.includes("AAC")) throw error;
    console.log(`aac-fallback ${audioError}`);
    const result = await encodeMp4({
      width: 1920,
      height: 1080,
      fps: 30,
      duration: end,
      onProgress: (ratio) => {
        const mark = Math.round(ratio * 10);
        if (mark !== window.__mark) {
          window.__mark = mark;
          console.log(`video ${mark * 10}%`);
        }
      },
      render,
    });
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const size = 256 * 1024;
    for (let offset = 0; offset < bytes.length; offset += size) {
      let binary = "";
      const slice = bytes.subarray(offset, Math.min(bytes.length, offset + size));
      for (let i = 0; i < slice.length; i += 1) binary += String.fromCharCode(slice[i]);
      await window.__writeMp4(btoa(binary));
    }
  }
  const sampleRate = 48000;
  const stops = gainStops(0.7, end, fade?.fadeStart, fade?.fadeOut, ducks);
  const renderBus = async (withTone) => {
    const ctx = new OfflineAudioContext(2, Math.ceil(end * sampleRate), sampleRate);
    const decoded = await ctx.decodeAudioData(await (await fetch("/music/emotion-a.mp3")).arrayBuffer());
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.loop = true;
    const gain = ctx.createGain();
    const first = stops[0] || { t: 0, v: 0.7 };
    gain.gain.setValueAtTime(Math.max(0, first.v), Math.max(0, first.t));
    let lastT = Math.max(0, first.t);
    for (const stop of stops.slice(1)) {
      const t = Math.max(lastT + 0.001, stop.t);
      gain.gain.linearRampToValueAtTime(Math.max(0, stop.v), t);
      lastT = t;
    }
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0, 0, end);
    if (withTone && videoClip) {
      const tone = await ctx.decodeAudioData(await (await fetch(videoUrl)).arrayBuffer());
      const toneSource = ctx.createBufferSource();
      toneSource.buffer = tone;
      toneSource.connect(ctx.destination);
      toneSource.start(videoClip.start, videoClip.offset || 0, videoClip.duration);
    }
    return ctx.startRendering();
  };
  const bed = await renderBus(false);
  const mix = await renderBus(true);
  const rms = (buffer, from, to) => {
    const a = Math.floor(from * sampleRate);
    const b = Math.floor(to * sampleRate);
    const left = buffer.getChannelData(0);
    let sum = 0;
    let count = 0;
    for (let i = a; i < b && i < left.length; i += 8) {
      sum += left[i] * left[i];
      count += 1;
    }
    return Math.sqrt(sum / Math.max(1, count));
  };
  const videoStart = videoClip?.start ?? 0;
  const videoEnd = videoStart + (videoClip?.duration ?? 0);
  const cut = film.find((clip) => clip.endingCut);
  const wav = (buffer) => {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const data = new DataView(new ArrayBuffer(44 + length * channels * 2));
    const write = (offset, text) => { for (let i = 0; i < text.length; i += 1) data.setUint8(offset + i, text.charCodeAt(i)); };
    write(0, "RIFF");
    data.setUint32(4, 36 + length * channels * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    data.setUint32(16, 16, true);
    data.setUint16(20, 1, true);
    data.setUint16(22, channels, true);
    data.setUint32(24, buffer.sampleRate, true);
    data.setUint32(28, buffer.sampleRate * channels * 2, true);
    data.setUint16(32, channels * 2, true);
    data.setUint16(34, 16, true);
    write(36, "data");
    data.setUint32(40, length * channels * 2, true);
    const channel = [buffer.getChannelData(0), buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)];
    let offset = 44;
    for (let i = 0; i < length; i += 1) {
      for (let c = 0; c < channels; c += 1) {
        const sample = Math.max(-1, Math.min(1, channel[c][i] || 0));
        data.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    const bytes = new Uint8Array(data.buffer);
    let binary = "";
    const size = 200000;
    const chunks = [];
    for (let i = 0; i < bytes.length; i += size) {
      binary = "";
      const slice = bytes.subarray(i, Math.min(bytes.length, i + size));
      for (let j = 0; j < slice.length; j += 1) binary += String.fromCharCode(slice[j]);
      chunks.push(btoa(binary));
    }
    return chunks;
  };
  for (const chunk of wav(mix)) await window.__writeWav(chunk);
  return {
    aacInside,
    audioError,
    duration: end,
    fadeAt: fade?.fadeStart ?? null,
    fadeOut: fade?.fadeOut ?? null,
    bedOpen: rms(bed, 1, 3),
    bedDuck: rms(bed, videoStart + 2, videoStart + 8),
    bedCut: rms(bed, (cut?.start ?? end) + 2, (cut?.start ?? end) + 5),
    bedEnd: rms(bed, end - 0.45, end - 0.05),
    mixDuck: rms(mix, videoStart + 2, videoStart + 8),
    mixEnd: rms(mix, end - 0.45, end - 0.05),
    heardMid: window.__vf.heardLevel(0.7, (videoStart + videoEnd) / 2, fade?.fadeStart, fade?.fadeOut, ducks),
    heardEnd: window.__vf.heardLevel(0.7, end, fade?.fadeStart, fade?.fadeOut, ducks),
  };
});

console.log(JSON.stringify(encoded));
await browser.close();

const withAudio = `${root}/delivery-1080p30.mp4`;
if (encoded.aacInside) {
  execFileSync("ffmpeg", ["-y", "-i", outPath, "-c", "copy", withAudio], { stdio: "inherit" });
} else {
  execFileSync("ffmpeg", [
    "-y", "-i", outPath, "-i", wavPath,
    "-map", "0:v", "-map", "1:a",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
    "-shortest", withAudio,
  ], { stdio: "inherit" });
}
const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height,avg_frame_rate,channels:format=duration", "-of", "json", withAudio], { encoding: "utf8" });
console.log(probe.stdout);
const times = [
  ["intro", "3"],
  ["photo", String(Math.max(0, (preview.videoStart ?? 20) - 4))],
  ["video", String((preview.videoStart ?? 20) + 1)],
  ["video-late", String((preview.videoStart ?? 20) + 16)],
  ["cut", String((preview.cutStart ?? 40) + 3)],
  ["ending", String((preview.endingStart ?? 50) + 2)],
];
for (const [name, at] of times) {
  execFileSync("ffmpeg", ["-y", "-ss", at, "-i", withAudio, "-frames:v", "1", `${shots}/delivery-${name}.png`], { stdio: "ignore" });
}
for (const [name, start] of [["bed-open", "1"], ["during-video", String((preview.videoStart ?? 20) + 2)], ["during-cut", String((preview.cutStart ?? 40) + 2)], ["ending-tail", String(Math.max(0, encoded.duration - 1.2))]]) {
  const loud = spawnSync("ffmpeg", ["-ss", start, "-t", "1.2", "-i", withAudio, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const mean = loud.stderr.match(/mean_volume:\s*([-\d.]+) dB/);
  console.log(name, mean?.[1] ?? "n/a");
}
mkdirSync("/workspace/artifacts", { recursive: true });
execFileSync("cp", [withAudio, "/workspace/artifacts/delivery-1080p30.mp4"]);
