import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, appendFileSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const root = "/tmp/title-export";
const shots = "/workspace/screenshots";
mkdirSync(root, { recursive: true });
mkdirSync(shots, { recursive: true });

const colors = ["#e23b2f", "#f08c00", "#e6c84a", "#7dbe4a", "#2aa9a1", "#3b6fd8", "#7a4cc2", "#d45d8c", "#c46b3a", "#8d948c"];
for (let index = 0; index < colors.length; index += 1) {
  execFileSync("ffmpeg", [
    "-y", "-f", "lavfi", "-i", `color=c=${colors[index]}:s=1280x720`,
    "-frames:v", "1", `${root}/p${index}.jpg`,
  ], { stdio: "ignore" });
}
execFileSync("ffmpeg", [
  "-y", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30:duration=18",
  "-pix_fmt", "yuv420p", "-an", `${root}/clip.mp4`,
], { stdio: "ignore" });

const photoB64 = colors.map((_, index) => readFileSync(`${root}/p${index}.jpg`).toString("base64"));
const videoB64 = readFileSync(`${root}/clip.mp4`).toString("base64");

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (error) => console.error("PAGE", error.message));
page.on("console", (msg) => console.log("BROWSER", msg.text()));
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.addScriptTag({
  type: "module",
  content: `
    import { directFilm, filmSummary } from "/src/lib/video/director.ts";
    import { encodeMp4 } from "/src/lib/video/mp4-export.ts";
    import { paintTitleCard } from "/src/lib/video/title-paint.ts";
    window.__vf = { directFilm, filmSummary, encodeMp4, paintTitleCard };
  `,
});
await page.waitForFunction(() => window.__vf, null, { timeout: 20000 });

const preview = await page.evaluate(async ({ photoB64, videoB64 }) => {
  const { directFilm, filmSummary, paintTitleCard } = window.__vf;
  const blobUrl = (b64, type) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type }));
  };
  const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${url.slice(0, 32)}`));
    img.src = url;
  });
  const images = new Map();
  const logo = await loadImage("/adsmile-mark.png");
  images.set("/adsmile-mark.png", logo);
  const photos = [];
  for (let index = 0; index < photoB64.length; index += 1) {
    const url = blobUrl(photoB64[index], "image/jpeg");
    const img = await loadImage(url);
    images.set(url, img);
    photos.push({ id: `p${index}`, name: `사진${index + 1}.jpg`, url, caption: `${index + 1}번 장면` });
  }
  const videoUrl = blobUrl(videoB64, "video/mp4");
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  await new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("video"));
  });
  const items = [
    ...photos.map((photo) => ({ kind: "image", ...photo })),
    { kind: "video", id: "v", name: "현장.mp4", url: videoUrl, duration: 18 },
  ];
  const intro = { seconds: 7, main: "창립 50주년", sub: "함께 걸어온 시간", date: "1977 – 2026", style: "grand", motion: "slow-zoom", logo: "/adsmile-mark.png" };
  const ending = { seconds: 7, main: "감사합니다", thanks: "함께해 주셔서 고맙습니다", org: "애드스마일", date: "2026", style: "emotion", motion: "fade", logo: "/adsmile-mark.png" };
  const film = directFilm(items, null, "warm", { reorder: false, intro, ending });
  const summary = filmSummary(film);
  const names = film.filter((clip) => clip.kind === "image" || clip.kind === "video").map((clip) => clip.name);
  const styles = ["luxury", "emotion", "simple", "grand"];
  const cards = [];
  for (const style of styles) {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    paintTitleCard(ctx, {
      role: "intro",
      style,
      motion: style === "grand" ? "slow-zoom" : style === "simple" ? "slide-up" : "fade",
      main: style === "simple" ? "행사 스케치" : "창립 50주년",
      sub: "함께 걸어온 시간",
      date: "1977 – 2026",
      thanks: "",
      org: "",
      bg: style === "luxury" ? "#1a140f" : style === "emotion" ? "#241418" : style === "simple" ? "#101114" : "#0b1020",
      logo: "/adsmile-mark.png",
      seconds: 7,
    }, 1280, 720, 0.45, images);
    cards.push({ name: `title-${style}.png`, png: canvas.toDataURL("image/png") });
  }
  const endCanvas = document.createElement("canvas");
  endCanvas.width = 1280;
  endCanvas.height = 720;
  paintTitleCard(endCanvas.getContext("2d"), {
    role: "ending",
    style: "emotion",
    motion: "fade",
    main: "감사합니다",
    sub: "",
    date: "2026",
    thanks: "함께해 주셔서 고맙습니다",
    org: "애드스마일",
    bg: "#241418",
    logo: "/adsmile-mark.png",
    seconds: 7,
  }, 1280, 720, 0.5, images);
  cards.push({ name: "title-ending.png", png: endCanvas.toDataURL("image/png") });
  window.__exportJob = { film, images, video, videoUrl, summary };
  return {
    summary,
    names,
    intro: film.find((clip) => clip.title?.role === "intro")?.duration,
    ending: film.find((clip) => clip.title?.role === "ending")?.duration,
    video: film.find((clip) => clip.kind === "video")?.duration,
    cards,
  };
}, { photoB64, videoB64 });

for (const card of preview.cards) {
  const body = card.png.replace(/^data:image\/png;base64,/, "");
  writeFileSync(`${shots}/${card.name}`, Buffer.from(body, "base64"));
}
console.log(JSON.stringify({ summary: preview.summary, names: preview.names, intro: preview.intro, ending: preview.ending, video: preview.video }));

if (process.argv.includes("--preview")) {
  await browser.close();
  process.exit(0);
}

const outPath = `${root}/out.mp4`;
rmSync(outPath, { force: true });
await page.exposeFunction("__writeMp4", (chunk) => {
  appendFileSync(outPath, Buffer.from(chunk, "base64"));
});

const encoded = await page.evaluate(async () => {
  const { encodeMp4 } = window.__vf;
  const { film, images, video } = window.__exportJob;
  const end = Math.max(...film.map((clip) => clip.start + clip.duration));
  const ending = film.find((clip) => clip.title?.role === "ending");
  const seek = (el, time) => new Promise((resolve) => {
    const done = () => {
      el.removeEventListener("seeked", done);
      resolve();
    };
    el.addEventListener("seeked", done);
    try { el.currentTime = time; } catch { resolve(); }
    setTimeout(resolve, 700);
  });
  const result = await encodeMp4({
    width: 1920,
    height: 1080,
    fps: 30,
    duration: end,
    onProgress: (ratio) => {
      const mark = Math.round(ratio * 10);
      if (mark !== window.__mark) {
        window.__mark = mark;
        console.log(`encode ${mark * 10}%`);
      }
    },
    render: async (canvas, time) => {
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
          const at = Math.min(Math.max(0, time - clip.start), Math.max(0, (video.duration || 18) - 0.05));
          if (Math.abs(video.currentTime - at) > 0.08) await seek(video, at);
          if (video.readyState >= 2) ctx.drawImage(video, 0, 0, designW, designH);
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    },
  });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  const size = 256 * 1024;
  for (let offset = 0; offset < bytes.length; offset += size) {
    let binary = "";
    const slice = bytes.subarray(offset, Math.min(bytes.length, offset + size));
    for (let i = 0; i < slice.length; i += 1) binary += String.fromCharCode(slice[i]);
    await window.__writeMp4(btoa(binary));
  }
  const sampleRate = 48000;
  const audioCtx = new OfflineAudioContext(2, Math.ceil(end * sampleRate), sampleRate);
  const decoded = await audioCtx.decodeAudioData(await (await fetch("/music/emotion-a.mp3")).arrayBuffer());
  const source = audioCtx.createBufferSource();
  source.buffer = decoded;
  source.loop = true;
  const gain = audioCtx.createGain();
  const level = 0.7;
  gain.gain.setValueAtTime(level, 0);
  const fadeAt = ending?.start ?? end;
  const fadeOut = ending?.duration ?? 0;
  if (fadeAt > 0.02) gain.gain.setValueAtTime(level, fadeAt);
  gain.gain.linearRampToValueAtTime(0.0001, fadeAt + fadeOut);
  source.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(0, 0, end);
  const mixed = await audioCtx.startRendering();
  const rms = (from, to) => {
    const a = Math.floor(from * sampleRate);
    const b = Math.floor(to * sampleRate);
    const left = mixed.getChannelData(0);
    let sum = 0;
    let count = 0;
    for (let i = a; i < b && i < left.length; i += 8) {
      sum += left[i] * left[i];
      count += 1;
    }
    return Math.sqrt(sum / Math.max(1, count));
  };
  return {
    audio: result.audio,
    bytes: bytes.length,
    duration: end,
    fadeAt,
    fadeOut,
    rmsOpen: rms(1, 3),
    rmsEnd: rms(end - 2, end - 0.2),
  };
});
console.log(JSON.stringify(encoded));
await browser.close();

const withAudio = `${root}/with-audio.mp4`;
execFileSync("ffmpeg", [
  "-y", "-i", outPath,
  "-stream_loop", "-1", "-i", "/workspace/public/music/emotion-a.mp3",
  "-filter_complex", `[1:a]atrim=0:${encoded.duration.toFixed(3)},afade=t=out:st=${encoded.fadeAt.toFixed(3)}:d=${encoded.fadeOut.toFixed(3)},volume=0.7[a]`,
  "-map", "0:v", "-map", "[a]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
  withAudio,
], { stdio: "inherit" });

const probe = spawnSync("ffmpeg", ["-i", withAudio, "-hide_banner"], { encoding: "utf8" });
console.log(probe.stderr);
for (const [name, start, len] of [["open", "1", "2"], ["end", String(Math.max(0, encoded.duration - 3)), "2.5"]]) {
  const loud = spawnSync("ffmpeg", ["-ss", start, "-t", len, "-i", withAudio, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const mean = loud.stderr.match(/mean_volume:\s*([-\d.]+) dB/);
  console.log(name, mean?.[1] ?? loud.stderr.slice(-200));
}
for (const [name, at] of [["intro", "3"], ["photo", "10"], ["video", "48"], ["ending", String(Math.max(0, encoded.fadeAt + 2))]]) {
  execFileSync("ffmpeg", ["-y", "-ss", at, "-i", withAudio, "-frames:v", "1", `${shots}/frame-${name}.png`], { stdio: "ignore" });
}
