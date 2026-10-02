import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const origin = "http://127.0.0.1:8080";
const chrome = "/tmp/chrome-extract/opt/google/chrome/chrome";
const shots = "/workspace/screenshots";
mkdirSync(shots, { recursive: true });
const stamp = Date.now().toString(36);
const email = `edit-${stamp}@example.com`;
const password = "edit-check-pass-2026";
const title = `연습곡 ${stamp}`;

const signup = await fetch(`${origin}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email, password, name: "편집 확인" }),
});
const signupBody = await signup.text();
const token = signup.headers.get("set-auth-token") || "";
if (!token || signup.status >= 400) throw new Error(`signup ${signup.status} ${signupBody.slice(0, 500)}`);
console.log("SIGNUP", signup.status);

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.on("pageerror", (error) => console.error("PAGE", error.message));
await page.addInitScript((value) => {
  sessionStorage.setItem("grok-auth.bearer-token", value);
}, token);
await page.goto(`${origin}/video`, { waitUntil: "networkidle", timeout: 60000 });
await page.getByText("사진 · 영상 추가", { exact: true }).waitFor({ timeout: 20000 });
await page.getByText("영상 올리기", { exact: true }).waitFor();
await page.getByText("+ 음악 업로드", { exact: true }).waitFor();
await page.getByText("내 음악", { exact: true }).waitFor();
await page.getByText(/사용중 0B \/ 1GB/).waitFor();
await page.screenshot({ path: `${shots}/editor-buttons.png` });
console.log("BUTTONS visible");

const aac = await page.evaluate(async () => {
  if (!("AudioEncoder" in window)) return "no-encoder";
  const supported = await AudioEncoder.isConfigSupported({
    codec: "mp4a.40.2",
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128000,
  });
  return supported.supported ? "aac-yes" : "aac-no";
});
console.log("AAC", aac);

const musicInput = page.locator('input[type="file"][accept*="audio/mpeg"]');
await musicInput.setInputFiles("/workspace/public/music/calm-a.mp3");
await page.getByRole("button", { name: "calm-a" }).waitFor({ timeout: 20000 });
const storageBefore = await page.getByText(/사용중 /).first().innerText();
console.log("AFTER UPLOAD", storageBefore);
await page.screenshot({ path: `${shots}/editor-music-uploaded.png` });

await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "calm-a" }).waitFor({ timeout: 20000 });
const storageAfter = await page.getByText(/사용중 /).first().innerText();
console.log("AFTER REFRESH", storageAfter);
if (!/0B/.test(storageAfter) === false && /0B \/ 1GB/.test(storageAfter)) {
  throw new Error(`storage still empty after refresh: ${storageAfter}`);
}
if (/사용중 0B/.test(storageAfter)) throw new Error(`storage did not move: ${storageAfter}`);
const libraryRes = await fetch(`${origin}/api/music/library`, { headers: { authorization: `Bearer ${token}` } });
const library = await libraryRes.json();
console.log("SERVER", libraryRes.status, library.storage, (library.tracks ?? []).map((track) => track.displayName));
if (!library.tracks?.some((track) => track.displayName === "calm-a")) throw new Error("server library did not keep the upload");

const files = [
  "/tmp/editor-media/clip-18s.mp4",
  ...Array.from({ length: 10 }, (_, i) => `/tmp/editor-media/photo-${i + 1}.jpg`),
];
await page.locator('input[type="file"][accept*="image/jpeg"]').setInputFiles(files);
await page.getByText("영상 · clip-18s.mp4").waitFor({ timeout: 20000 });
await page.getByPlaceholder("10번 자막").waitFor({ timeout: 20000 });
console.log("MEDIA on strip");

await page.getByRole("button", { name: "타임라인에 추가" }).click();
await page.getByText("calm-a").first().waitFor();
await page.screenshot({ path: `${shots}/editor-timeline.png` });

await page.getByRole("button", { name: "감독에게 맡기기" }).click();
await page.getByText("직접 고른 음악은 바꾸지 않았습니다.").waitFor({ timeout: 20000 });
const body = await page.locator("body").innerText();
console.log("HAS 18", body.includes("18.0초"), "HAS CLIP", body.includes("clip-18s.mp4"));
if (!body.includes("18.0초") || !body.includes("clip-18s.mp4")) throw new Error("video length missing after director");
if (!body.includes("calm-a")) throw new Error("pinned music was replaced");
await page.screenshot({ path: `${shots}/editor-director.png` });

await page.getByRole("button", { name: "영상 받기" }).click();
await page.getByRole("button", { name: "1080p", exact: true }).click();
await page.getByRole("button", { name: "30fps", exact: true }).click();
await page.getByRole("button", { name: "H.264 MP4 받기" }).click();
const exportToast = page.locator("[data-sonner-toast]").filter({ hasText: /만들지 못했습니다|받았습니다|만드는 중/ });
await exportToast.first().waitFor({ timeout: 30000 });
const exportText = await exportToast.first().innerText();
console.log("EXPORT TOAST", exportText.replace(/\s+/g, " "));
await page.screenshot({ path: `${shots}/editor-export.png` });
await browser.close();
console.log("DONE");
