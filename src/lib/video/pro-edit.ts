/** 영상편집실 프로 편집. 미리보기와 MP4는 같은 계산을 쓴다. */

export type TextAlign = "left" | "center" | "right";
export type TextEnter = "none" | "fade-in" | "slide-up" | "slide-left" | "scale-in" | "typewriter" | "blur-in";
export type TextExit = "none" | "fade-out" | "slide-down" | "scale-out" | "blur-out";
export type TextPresetId = "body" | "title" | "year" | "name" | "date" | "quote" | "emotion" | "ending";
export type GradePresetId = "basic" | "warm" | "emotion" | "bright" | "cinema" | "vintage" | "mono" | "retro";

export type Grade = {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  highlight: number;
  shadow: number;
  sharpness: number;
  mono: boolean;
};

export type Keyframe = {
  id: string;
  t: number;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
  volume?: number;
};

export type SpeedRamp = { t: number; speed: number }[];

export type FontChoice = { id: string; label: string; family: string; kind: "builtin" | "file" };

export const TEXT_FONTS: FontChoice[] = [
  { id: "pretendard", label: "프리텐다드", family: '"Pretendard Variable", Pretendard, "Noto Sans KR", sans-serif', kind: "builtin" },
  { id: "noto", label: "본고딕", family: '"Noto Sans KR", sans-serif', kind: "builtin" },
  { id: "serif", label: "명조", family: '"Noto Serif KR", "Noto Sans KR", serif', kind: "builtin" },
];

export const TEXT_PRESETS: { id: TextPresetId; label: string }[] = [
  { id: "body", label: "일반 설명" },
  { id: "title", label: "메인 제목" },
  { id: "year", label: "연도 제목" },
  { id: "name", label: "이름표" },
  { id: "date", label: "날짜" },
  { id: "quote", label: "인용문" },
  { id: "emotion", label: "감동 메시지" },
  { id: "ending", label: "엔딩" },
];

export const ENTERS: { id: TextEnter; label: string }[] = [
  { id: "none", label: "없음" },
  { id: "fade-in", label: "Fade In" },
  { id: "slide-up", label: "Slide Up" },
  { id: "slide-left", label: "Slide Left" },
  { id: "scale-in", label: "Scale In" },
  { id: "typewriter", label: "Typewriter" },
  { id: "blur-in", label: "Blur In" },
];

export const EXITS: { id: TextExit; label: string }[] = [
  { id: "none", label: "없음" },
  { id: "fade-out", label: "Fade Out" },
  { id: "slide-down", label: "Slide Down" },
  { id: "scale-out", label: "Scale Out" },
  { id: "blur-out", label: "Blur Out" },
];

export const SCENE_TRANSITIONS: { id: string; label: string }[] = [
  { id: "fade", label: "Cross Fade" },
  { id: "black", label: "Dip to Black" },
  { id: "white", label: "Dip to White" },
  { id: "push", label: "Push" },
  { id: "zoom", label: "Zoom" },
  { id: "blur", label: "Blur" },
  { id: "wipe", label: "Wipe" },
  { id: "none", label: "없음" },
];

export const GRADE_PRESETS: { id: GradePresetId; label: string }[] = [
  { id: "basic", label: "기본" },
  { id: "warm", label: "따뜻함" },
  { id: "emotion", label: "감성" },
  { id: "bright", label: "밝음" },
  { id: "cinema", label: "시네마" },
  { id: "vintage", label: "빈티지" },
  { id: "mono", label: "흑백" },
  { id: "retro", label: "레트로" },
];

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const NEUTRAL_GRADE: Grade = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  highlight: 0,
  shadow: 0,
  sharpness: 0,
  mono: false,
};

const PRESET_KEY = "cresora.video.userPresets.v1";

export type UserPreset = {
  id: string;
  label: string;
  kind: "text" | "grade" | "anim" | "intro" | "ending";
  payload: unknown;
};

export function fontFamily(id?: string, extra: FontChoice[] = []) {
  return [...TEXT_FONTS, ...extra].find((font) => font.id === id)?.family ?? TEXT_FONTS[0]!.family;
}

/** 나중에 폰트 파일 버튼을 붙일 때 그대로 호출한다. 브라우저에서만 동작한다. */
export async function loadFontFile(file: File): Promise<FontChoice> {
  const id = `file-${Math.random().toString(36).slice(2, 8)}`;
  const family = `CresoraUser${id}`;
  const face = new FontFace(family, await file.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  const label = file.name.replace(/\.[^.]+$/, "") || "내 폰트";
  return { id, label, family, kind: "file" };
}

export function textPresetPatch(id: TextPresetId): Record<string, unknown> {
  const common = { placed: true, opacity: 1, rotate: 0, letterSpacing: 0, lineHeight: 1.25, align: "center" as TextAlign, x: 0.5 };
  if (id === "title") return { ...common, textStyle: "plain", font: "pretendard", fontWeight: 800, fontSize: 84, y: 0.4, strokeWidth: 0, textShadow: 10, box: false };
  if (id === "year") return { ...common, textStyle: "year", font: "pretendard", fontWeight: 800, fontSize: 92, y: 0.48, color: "#fff6df", strokeWidth: 6, strokeColor: "#1c150e", box: false };
  if (id === "name") return { ...common, textStyle: "bar", font: "noto", fontWeight: 700, fontSize: 36, x: 0.18, y: 0.72, align: "left", box: true, boxAlpha: 0.62, strokeWidth: 0 };
  if (id === "date") return { ...common, textStyle: "plain", font: "noto", fontWeight: 500, fontSize: 30, y: 0.18, letterSpacing: 6, box: false, strokeWidth: 0 };
  if (id === "quote") return { ...common, textStyle: "plain", font: "serif", fontWeight: 600, fontSize: 48, y: 0.46, box: false, textShadow: 8 };
  if (id === "emotion") return { ...common, textStyle: "shadow", font: "serif", fontWeight: 700, fontSize: 56, y: 0.56, color: "#fff4e5", textShadow: 18, box: false };
  if (id === "ending") return { ...common, textStyle: "ending", font: "pretendard", fontWeight: 800, fontSize: 68, y: 0.48, textShadow: 16, strokeWidth: 0, box: false };
  return { ...common, textStyle: "body", font: "noto", fontWeight: 600, fontSize: 40, y: 0.82, box: true, boxAlpha: 0.55, strokeWidth: 0, textShadow: 0 };
}

export function gradePreset(id: GradePresetId): Grade {
  if (id === "warm") return { ...NEUTRAL_GRADE, temperature: 0.48, saturation: 0.12, contrast: 0.06 };
  if (id === "emotion") return { ...NEUTRAL_GRADE, temperature: 0.22, saturation: -0.12, brightness: 0.06, contrast: -0.04 };
  if (id === "bright") return { ...NEUTRAL_GRADE, brightness: 0.2, highlight: 0.28, saturation: 0.1 };
  if (id === "cinema") return { ...NEUTRAL_GRADE, contrast: 0.28, saturation: -0.18, shadow: 0.22, temperature: -0.06 };
  if (id === "vintage") return { ...NEUTRAL_GRADE, temperature: 0.58, saturation: -0.28, contrast: 0.1 };
  if (id === "mono") return { ...NEUTRAL_GRADE, mono: true, contrast: 0.16 };
  if (id === "retro") return { ...NEUTRAL_GRADE, temperature: 0.34, saturation: 0.42, contrast: 0.2, brightness: -0.04 };
  return { ...NEUTRAL_GRADE };
}

export function gradeToFilter(grade: Grade) {
  const brightness = clamp(1 + grade.brightness * 0.5 + grade.highlight * 0.28, 0.25, 2.3);
  const contrast = clamp(1 + grade.contrast * 0.6 + grade.shadow * 0.38 + grade.sharpness * 0.3, 0.35, 2.5);
  const saturation = grade.mono ? 0 : clamp(1 + grade.saturation, 0, 3);
  const sepia = grade.temperature > 0 ? grade.temperature * 0.5 : 0;
  const hue = grade.temperature < 0 ? grade.temperature * 32 : 0;
  return `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturation.toFixed(3)}) sepia(${sepia.toFixed(3)}) hue-rotate(${hue.toFixed(2)}deg)`;
}

export function legacyEnter(motion?: string): TextEnter {
  if (motion === "fade") return "fade-in";
  if (motion === "rise") return "slide-up";
  if (motion === "pop") return "scale-in";
  if (motion === "type") return "typewriter";
  return "none";
}

export function textAnimState(input: {
  enter: TextEnter;
  exit: TextExit;
  elapsed: number;
  duration: number;
  enterSec: number;
  exitSec: number;
  speed: number;
}) {
  const speed = Math.max(0.25, input.speed || 1);
  const enterSec = Math.max(0.05, input.enterSec / speed);
  const exitSec = Math.max(0.05, input.exitSec / speed);
  const enterP = Math.min(1, Math.max(0, input.elapsed / enterSec));
  const exitStart = Math.max(0, input.duration - exitSec);
  const exitP = input.elapsed <= exitStart ? 0 : Math.min(1, (input.elapsed - exitStart) / Math.max(0.05, input.duration - exitStart));
  let alpha = 1;
  let dx = 0;
  let dy = 0;
  let scale = 1;
  let blur = 0;
  let reveal = 1;
  if (input.enter === "fade-in") alpha *= enterP;
  if (input.enter === "slide-up") {
    alpha *= enterP;
    dy += (1 - enterP) * 48;
  }
  if (input.enter === "slide-left") {
    alpha *= enterP;
    dx += (1 - enterP) * -72;
  }
  if (input.enter === "scale-in") {
    alpha *= enterP;
    scale *= 0.8 + 0.2 * enterP;
  }
  if (input.enter === "typewriter") reveal = enterP;
  if (input.enter === "blur-in") {
    alpha *= enterP;
    blur = (1 - enterP) * 14;
  }
  if (input.exit === "fade-out") alpha *= 1 - exitP;
  if (input.exit === "slide-down") {
    alpha *= 1 - exitP;
    dy += exitP * 48;
  }
  if (input.exit === "scale-out") {
    alpha *= 1 - exitP;
    scale *= 1 - 0.22 * exitP;
  }
  if (input.exit === "blur-out") {
    alpha *= 1 - exitP;
    blur = Math.max(blur, exitP * 14);
  }
  return { alpha, dx, dy, scale, blur, reveal };
}

export function transitionSeconds(transition: string | undefined, transitionSec?: number) {
  if (!transition || transition === "none") return 0;
  if (transitionSec != null && Number.isFinite(transitionSec)) return clamp(transitionSec, 0.2, 2);
  if (transition === "black") return 0.55;
  if (transition === "fade" || transition === "slide") return 0.7;
  return 0.6;
}

export type TransitionFx = {
  alpha: number;
  tx: number;
  scale: number;
  blur: number;
  wipe: number | null;
  underlay: string | null;
};

export function incomingTransition(kind: string | undefined, p: number | null, width: number, legacy = false): TransitionFx {
  const base: TransitionFx = { alpha: 1, tx: 0, scale: 1, blur: 0, wipe: null, underlay: null };
  if (p == null || !kind || kind === "none" || kind === "slide") return base;
  if (kind === "fade") return { ...base, alpha: p };
  if (kind === "black") {
    if (legacy) return { ...base, alpha: p };
    return { ...base, alpha: p < 0.5 ? 0 : (p - 0.5) * 2, underlay: "#000" };
  }
  if (kind === "white") return { ...base, alpha: p < 0.5 ? 0 : (p - 0.5) * 2, underlay: "#fff" };
  if (kind === "push") return { ...base, tx: (1 - p) * width };
  if (kind === "zoom") return { ...base, alpha: p, scale: 1.16 - 0.16 * p };
  if (kind === "blur") return { ...base, alpha: p, blur: (1 - p) * 16 };
  if (kind === "wipe") return { ...base, wipe: p };
  return base;
}

export function outgoingTransition(kind: string | undefined, p: number | null, width: number, legacy = false): TransitionFx {
  const base: TransitionFx = { alpha: 1, tx: 0, scale: 1, blur: 0, wipe: null, underlay: null };
  if (p == null || !kind || kind === "none" || kind === "fade" || kind === "wipe" || kind === "slide") return base;
  if ((kind === "black" || kind === "white") && !legacy) return { ...base, alpha: p < 0.5 ? 1 - p * 2 : 0 };
  if (kind === "black" || kind === "white") return base;
  if (kind === "push") return { ...base, tx: -p * width };
  if (kind === "zoom") return { ...base, alpha: 1 - p, scale: 1 - 0.05 * p };
  if (kind === "blur") return { ...base, alpha: 1 - p, blur: p * 16 };
  return base;
}

export function sampleNumber(keys: Keyframe[] | undefined, t: number, prop: keyof Keyframe, fallback: number) {
  const points = (keys ?? []).filter((key) => typeof key[prop] === "number").sort((a, b) => a.t - b.t);
  if (!points.length) return fallback;
  const first = points[0]!;
  if (t <= first.t) return first[prop] as number;
  const last = points[points.length - 1]!;
  if (t >= last.t) return last[prop] as number;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const u = (t - a.t) / span;
      return (a[prop] as number) + ((b[prop] as number) - (a[prop] as number)) * u;
    }
  }
  return fallback;
}

export function motionScale(motion: string | undefined, u: number) {
  if (motion === "zoom-in") return 1 + u * 0.06;
  if (motion === "zoom-out") return 1.05 - u * 0.04;
  if (motion === "slow-zoom" || motion === "face-focus") return 1 + u * 0.04;
  if (motion === "none" || !motion) return 1;
  return 1.03;
}

export function motionPan(motion: string | undefined, u: number) {
  return {
    x: motion === "pan-left" ? (0.5 - u) * 0.035 : motion === "pan-right" ? (u - 0.5) * 0.035 : 0,
    y: motion === "face-focus" ? -0.02 * u : 0,
  };
}

/** 기존 줌·팬을 키프레임 두 점으로 표현한다. 재생은 이 점을 보간한다. */
export function motionKeys(motion: string | undefined, duration: number): Keyframe[] {
  const end = Math.max(0.001, duration);
  return [
    { id: "motion-0", t: 0, scale: motionScale(motion, 0), x: motionPan(motion, 0).x, y: motionPan(motion, 0).y },
    { id: "motion-1", t: end, scale: motionScale(motion, 1), x: motionPan(motion, 1).x, y: motionPan(motion, 1).y },
  ];
}

export function averageSpeed(speed = 1, ramp?: SpeedRamp) {
  if (!ramp || ramp.length < 2) return speed > 0 ? speed : 1;
  const a = ramp[0]?.speed ?? speed;
  const b = ramp[ramp.length - 1]?.speed ?? speed;
  return Math.max(0.05, (a + b) / 2);
}

export function speedAt(u: number, speed = 1, ramp?: SpeedRamp) {
  if (!ramp || ramp.length < 2) return speed > 0 ? speed : 1;
  const a = ramp[0]?.speed ?? speed;
  const b = ramp[ramp.length - 1]?.speed ?? speed;
  return a + (b - a) * clamp(u, 0, 1);
}

/** 타임라인 초를 원본 미디어 초로 바꾼다. 배속 램프는 선형 적분. */
export function mediaOffset(offset: number, elapsed: number, duration: number, speed = 1, ramp?: SpeedRamp) {
  const span = Math.max(0, duration);
  const used = Math.max(0, Math.min(elapsed, span));
  if (!ramp || ramp.length < 2) return offset + used * (speed > 0 ? speed : 1);
  const a = ramp[0]?.speed ?? speed;
  const b = ramp[ramp.length - 1]?.speed ?? speed;
  const u = span > 0 ? used / span : 0;
  return offset + span * (a * u + (b - a) * u * u / 2);
}

export function retimed(duration: number, prevSpeed: number, prevRamp: SpeedRamp | undefined, nextSpeed: number, nextRamp?: SpeedRamp) {
  const consumed = Math.max(0.2, duration) * averageSpeed(prevSpeed, prevRamp);
  return Math.max(0.2, consumed / averageSpeed(nextSpeed, nextRamp));
}

export function readUserPresets(): UserPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PRESET_KEY) || "[]") as UserPreset[];
    return Array.isArray(parsed) ? parsed.slice(0, 40) : [];
  } catch {
    return [];
  }
}

export function writeUserPresets(presets: UserPreset[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets.slice(0, 40)));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
