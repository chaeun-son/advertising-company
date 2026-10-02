import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
function probe(file) {
  let text = "";
  try {
    execFileSync("ffmpeg", ["-i", file, "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    text = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
  }
  return text.split("\n").filter((line) => /Duration|Video:|Audio:/.test(line)).join("\n");
}

const origin = "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const signup = await fetch(`${origin}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin },
  body: JSON.stringify({ email: `mp4-${stamp}@example.com`, password: "edit-check-pass-2026", name: "영상 확인" }),
});
const token = signup.headers.get("set-auth-token") || "";
if (!token || signup.status >= 400) throw new Error(`signup ${signup.status}`);

const browser = await chromium.launch({
  headless: true,
  executablePath: "/tmp/chrome-extract/opt/google/chrome/chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.on("pageerror", (error) => console.error("PAGE", error.message));
await page.addInitScript((value) => sessionStorage.setItem("grok-auth.bearer-token", value), token);
await page.goto(`${origin}/video`, { waitUntil: "networkidle", timeout: 60000 });
await page.locator('input[type="file"][accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"]').setInputFiles("/tmp/editor-media/clip-18s.mp4");
await page.getByText("영상 · clip-18s.mp4").click();
await page.getByText("트림 시작").waitFor({ timeout: 10000 });
await page.getByRole("button", { name: "원음 켜짐", exact: true }).waitFor();
const length = await page.getByText(/^원본 /).innerText();
console.log("TRIM", length);
if (!length.includes("0:18")) throw new Error(`expected 18s source, got ${length}`);
await page.screenshot({ path: "/workspace/screenshots/editor-video-trim.png" });

await page.getByLabel("재생 길이").fill("2");
await page.getByRole("button", { name: "원음 켜짐", exact: true }).click();
await page.getByRole("button", { name: "원음 꺼짐", exact: true }).waitFor();
await page.getByRole("button", { name: "영상 받기" }).click();
await page.getByRole("button", { name: "1080p", exact: true }).click();
await page.getByRole("button", { name: "30fps", exact: true }).click();
const downloadPromise = page.waitForEvent("download", { timeout: 180000 });
await page.getByRole("button", { name: "H.264 MP4 받기" }).click();
const download = await downloadPromise;
await download.saveAs("/tmp/editor-media/ui-export-1080p30.mp4");
console.log("UI EXPORT", download.suggestedFilename());
console.log(probe("/tmp/editor-media/ui-export-1080p30.mp4"));

await page.addScriptTag({
  type: "module",
  content: `import { encodeMp4 } from "/src/lib/video/mp4-export.ts"; window.__enc = encodeMp4;`,
});
await page.waitForFunction(() => window.__enc, null, { timeout: 20000 });
const outcome = await page.evaluate(async () => {
  const encodeMp4 = window.__enc;
  let audioError = "";
  try {
    await encodeMp4({
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 1,
      render: (canvas) => {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#1c150e";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      },
      audio: [{ url: "/music/calm-a.mp3", start: 0, duration: 1, offset: 0, volume: 0.8 }],
    });
  } catch (error) {
    audioError = error instanceof Error ? error.message : String(error);
  }
  const silent = await encodeMp4({
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 1,
    render: (canvas, time) => {
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#3B2F23";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#D4A04E";
      ctx.fillRect(80, 80, 200 + time * 400, 80);
    },
  });
  const bytes = new Uint8Array(await silent.blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { audioError, audio: silent.audio, b64: btoa(binary) };
});
console.log("AUDIO ERROR", outcome.audioError);
writeFileSync("/tmp/editor-media/silent-1080p30.mp4", Buffer.from(outcome.b64, "base64"));
execFileSync("ffmpeg", ["-y", "-i", "/tmp/editor-media/silent-1080p30.mp4", "-i", "/workspace/public/music/calm-a.mp3", "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-shortest", "/tmp/editor-media/with-bgm-1080p30.mp4"], { stdio: "inherit" });
console.log("MUXED", probe("/tmp/editor-media/with-bgm-1080p30.mp4"));
await browser.close();
