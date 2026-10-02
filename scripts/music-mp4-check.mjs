import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const browser = await chromium.launch({
  headless: true,
  executablePath: "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--disable-dev-shm-usage"],
});
const page = await browser.newPage();
page.on("pageerror", (error) => console.error("PAGE", error.message));
page.on("console", (msg) => console.log("BROWSER", msg.type(), msg.text()));
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.addScriptTag({
  type: "module",
  content: `
    import { encodeMp4 } from "/src/lib/video/mp4-export.ts";
    window.__enc = encodeMp4;
  `,
});
await page.waitForFunction(() => window.__enc, null, { timeout: 20000 });
const b64 = await page.evaluate(async () => {
  const encodeMp4 = window.__enc;
  const result = await encodeMp4({
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 2,
    render: (canvas) => {
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#1c150e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    audio: [{
      url: "/music/calm-a.mp3",
      start: 0,
      duration: 2,
      offset: 0,
      volume: 0.8,
      fadeIn: 0.4,
      clipFadeOut: 0.5,
      ducks: [{ start: 0.8, end: 1.2, level: 0.3 }],
    }],
  });
  if (!result.audio) throw new Error("MP4에 소리 트랙이 없습니다.");
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
});
const file = "/tmp/aether-bgm-1080p30.mp4";
writeFileSync(file, Buffer.from(b64, "base64"));
const info = execFileSync("ffmpeg", ["-i", file, "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] }).toString();
console.log(info.split("\n").filter((line) => /Stream|Duration|Audio|Video/.test(line)).join("\n"));
await browser.close();
console.log("WROTE", file);
