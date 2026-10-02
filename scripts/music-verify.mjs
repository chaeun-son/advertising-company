import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const origin = "http://127.0.0.1:8080";
const chrome = "/tmp/chrome-extract/opt/google/chrome/chrome";
const stamp = Date.now().toString(36);
const email = `music-${stamp}@example.com`;
const otherEmail = `other-${stamp}@example.com`;
const password = "music-check-pass-2026";
const title = `오후 연습 ${stamp}`;

function headersFrom(raw) {
  const token = raw.split(/\r?\n/).find((line) => line.toLowerCase().startsWith("set-auth-token:"));
  return token ? token.slice(token.indexOf(":") + 1).trim() : "";
}

async function auth(path, body, token) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, token: headersFrom(response.headers.get("set-auth-token") ? `set-auth-token: ${response.headers.get("set-auth-token")}` : ""), rawToken: response.headers.get("set-auth-token") || "", text };
}

async function api(path, token, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  headers.set("origin", origin);
  const response = await fetch(`${origin}${path}`, { ...init, headers });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* binary or empty */ }
  return { status: response.status, json, text, bytes: response.headers.get("content-length") };
}

const signup = await fetch(`${origin}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email, password, name: "음악 확인" }),
});
const signupBody = await signup.text();
const token = signup.headers.get("set-auth-token") || "";
if (!token || signup.status >= 400) throw new Error(`signup ${signup.status} ${signupBody.slice(0, 400)}`);

const mp3 = readFileSync("/workspace/public/music/calm-a.mp3");
const form = new FormData();
form.set("file", new Blob([mp3], { type: "audio/mpeg" }), "calm-a.mp3");
form.set("displayName", title);
form.set("category", "잔잔");
form.set("durationSec", "26.1");
form.set("source", "자체 제작");
form.set("license", "사용 권한 있음");
form.set("vendor", "애드스마일");
form.set("note", "검증용");
const uploaded = await api("/api/music/library", token, { method: "POST", body: form });
if (uploaded.status !== 200 || uploaded.json?.duplicate) throw new Error(`upload ${uploaded.status} ${uploaded.text.slice(0, 400)}`);
const music = uploaded.json.music;
console.log("UPLOAD", music.id, music.format, music.byteSize, uploaded.json.storage);

const listed = await api("/api/music/library", token);
if (!listed.json?.tracks?.some((track) => track.id === music.id)) throw new Error("refresh list missing track");
console.log("LIST", listed.json.tracks.length, listed.json.storage);

const again = new FormData();
again.set("file", new Blob([mp3], { type: "audio/mpeg" }), "calm-a-copy.mp3");
again.set("displayName", "같은 파일");
again.set("category", "잔잔");
again.set("durationSec", "26.1");
const dup = await api("/api/music/library", token, { method: "POST", body: again });
if (!dup.json?.duplicate || dup.json.storage.musicCount !== 1) throw new Error(`dedupe failed ${dup.text.slice(0, 300)}`);
console.log("DEDUPE", true, "count", dup.json.storage.musicCount);

const play = await fetch(new URL(music.playUrl, origin));
const played = Buffer.from(await play.arrayBuffer());
if (play.status !== 200 || played.length !== mp3.length || !played.equals(mp3)) throw new Error(`playback ${play.status} ${played.length}`);
console.log("PLAYBACK", play.status, played.length);

await api("/api/auth/sign-out", token, { method: "POST" });
const signin = await fetch(`${origin}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email, password }),
});
const token2 = signin.headers.get("set-auth-token") || "";
if (!token2) throw new Error(`signin ${signin.status} ${(await signin.text()).slice(0, 300)}`);
const after = await api("/api/music/library", token2);
if (!after.json?.tracks?.some((track) => track.displayName === title)) throw new Error("missing after re-login");
console.log("RELOGIN", after.json.tracks.map((track) => track.displayName).join(", "));

const other = await fetch(`${origin}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email: otherEmail, password, name: "다른 계정" }),
});
const otherToken = other.headers.get("set-auth-token") || "";
const otherLib = await api("/api/music/library", otherToken);
if ((otherLib.json?.tracks?.length ?? -1) !== 0) throw new Error(`isolation failed ${otherLib.text.slice(0, 200)}`);
console.log("ISOLATION", otherLib.json.storage);

await api("/api/music/uses", token2, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ projectKey: "proj-a", projectName: "가족 영상", musicIds: [music.id] }),
});
await api("/api/music/uses", token2, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ projectKey: "proj-b", projectName: "행사 영상", musicIds: [music.id] }),
});
const blocked = await api(`/api/music/library/${music.id}`, token2, { method: "DELETE" });
if (blocked.json?.deleted !== false || blocked.json?.projectCount !== 2) throw new Error(`delete guard ${blocked.text}`);
console.log("DELETE_GUARD", blocked.json.projectCount, blocked.json.names);

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (error) => console.error("PAGE", error.message));
await page.addInitScript((value) => sessionStorage.setItem("grok-auth.bearer-token", value), token2);
await page.goto(`${origin}/video`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.getByRole("button", { name: "내 음악" }).click({ timeout: 20000 });
await page.getByRole("button", { name: title }).waitFor({ timeout: 15000 });
await page.getByRole("button", { name: "타임라인에 추가" }).click();
await page.waitForFunction((name) => [...document.querySelectorAll("button")].filter((button) => button.textContent?.trim() === name).length >= 2, title, { timeout: 10000 });
async function setRange(locator, value) {
  await locator.evaluate((el, next) => {
    const proto = Object.getPrototypeOf(el);
    const set = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    set?.call(el, String(next));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
const fade = page.locator("label", { hasText: "Fade In" }).first().locator("input");
await setRange(fade, 1.5);
await page.locator("label", { hasText: "Fade In 1.5초" }).first().waitFor({ timeout: 5000 });
const fadeText = await page.locator("label", { hasText: "Fade In" }).first().innerText();
const fadeOut = page.locator("label", { hasText: "Fade Out" }).first().locator("input");
await setRange(fadeOut, 2);
await page.locator("label", { hasText: "Fade Out 2.0초" }).first().waitFor({ timeout: 5000 });
const fadeOutText = await page.locator("label", { hasText: "Fade Out" }).first().innerText();
mkdirSync("/workspace/screenshots", { recursive: true });
await page.screenshot({ path: "/workspace/screenshots/music-library.png", fullPage: true });
console.log("UI", fadeText.replace(/\s+/g, " "), "|", fadeOutText.replace(/\s+/g, " "));
if (!fadeText.includes("1.5") || !fadeOutText.includes("2.0")) throw new Error(`fade labels ${fadeText} | ${fadeOutText}`);

await page.addScriptTag({
  type: "module",
  content: `
    import { encodeMp4, mixAudio } from "/src/lib/video/mp4-export.ts";
    window.__enc = { encodeMp4, mixAudio };
  `,
});
await page.waitForFunction(() => window.__enc, null, { timeout: 20000 });
const mixed = await page.evaluate(async () => {
  const { encodeMp4, mixAudio } = window.__enc;
  const clip = {
    url: "/music/calm-a.mp3",
    start: 0,
    duration: 2,
    offset: 0,
    volume: 0.8,
    fadeIn: 0.4,
    clipFadeOut: 0.5,
    ducks: [{ start: 0.8, end: 1.2, level: 0.3 }],
  };
  const plainClip = { ...clip, fadeIn: 0, clipFadeOut: 0, ducks: [] };
  const [shaped, plain, video] = await Promise.all([
    mixAudio([clip], 2),
    mixAudio([plainClip], 2),
    encodeMp4({
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 2,
      render: (canvas) => {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#1c150e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      },
    }),
  ]);
  if (!shaped || !plain) throw new Error("믹스 실패");
  const rms = (buffer, start, end) => {
    const left = buffer.getChannelData(0);
    const a = Math.floor(start * buffer.sampleRate);
    const b = Math.min(left.length, Math.floor(end * buffer.sampleRate));
    let sum = 0;
    for (let i = a; i < b; i += 1) sum += left[i] * left[i];
    return Math.sqrt(sum / Math.max(1, b - a));
  };
  const stats = {
    fadeIn: rms(shaped, 0, 0.05),
    plainIn: rms(plain, 0, 0.05),
    body: rms(shaped, 0.5, 0.7),
    plainBody: rms(plain, 0.5, 0.7),
    duck: rms(shaped, 0.95, 1.05),
    plainDuck: rms(plain, 0.95, 1.05),
    fadeOut: rms(shaped, 1.92, 2),
    plainOut: rms(plain, 1.92, 2),
    sampleRate: shaped.sampleRate,
  };
  const left = shaped.getChannelData(0);
  const right = shaped.numberOfChannels > 1 ? shaped.getChannelData(1) : left;
  const pcm = new Int16Array(left.length * 2);
  for (let i = 0; i < left.length; i += 1) {
    pcm[i * 2] = Math.max(-32767, Math.min(32767, Math.round((left[i] || 0) * 32767)));
    pcm[i * 2 + 1] = Math.max(-32767, Math.min(32767, Math.round((right[i] || 0) * 32767)));
  }
  const bytes = new Uint8Array(pcm.buffer);
  const pack = (data) => {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < data.length; i += chunk) binary += String.fromCharCode(...data.subarray(i, i + chunk));
    return btoa(binary);
  };
  const videoBytes = new Uint8Array(await video.blob.arrayBuffer());
  return { stats, pcm: pack(bytes), video: pack(videoBytes), audioFlag: video.audio, samples: left.length };
});
await browser.close();

if (!(mixed.stats.fadeIn < mixed.stats.plainIn * 0.35)) throw new Error(`fade in not quieter ${JSON.stringify(mixed.stats)}`);
if (!(mixed.stats.fadeOut < mixed.stats.plainOut * 0.45)) throw new Error(`fade out not quieter ${JSON.stringify(mixed.stats)}`);
if (!(mixed.stats.duck < mixed.stats.plainDuck * 0.85)) throw new Error(`duck not lower ${JSON.stringify(mixed.stats)}`);
if (!(mixed.stats.body > mixed.stats.fadeIn * 4)) throw new Error(`body not louder than fade in ${JSON.stringify(mixed.stats)}`);
console.log("GAIN", JSON.stringify(mixed.stats), "encodeAudioFlag", mixed.audioFlag);

const pcm = Buffer.from(mixed.pcm, "base64");
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(mixed.stats.sampleRate, 24);
header.writeUInt32LE(mixed.stats.sampleRate * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);
writeFileSync("/tmp/aether-bgm.wav", Buffer.concat([header, pcm]));
writeFileSync("/tmp/aether-bgm-video.mp4", Buffer.from(mixed.video, "base64"));
execFileSync("ffmpeg", [
  "-y", "-i", "/tmp/aether-bgm-video.mp4", "-i", "/tmp/aether-bgm.wav",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest",
  "/tmp/aether-bgm-1080p30.mp4",
], { stdio: "ignore" });
const info = execFileSync("ffmpeg", ["-i", "/tmp/aether-bgm-1080p30.mp4", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] });
console.log(info.split("\n").filter((line) => /Stream|Duration|Audio|Video/.test(line)).join("\n"));
const vol = execFileSync("ffmpeg", ["-i", "/tmp/aether-bgm-1080p30.mp4", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] });
console.log(vol.split("\n").filter((line) => /mean_volume|max_volume/.test(line)).join("\n"));
console.log("OK", email, music.id);
void auth;
void headersFrom;
