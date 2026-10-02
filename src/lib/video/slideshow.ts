import { customerBrandLogo } from "../brand.ts";

export type Look = "none" | "warm" | "cool" | "mono" | "vintage" | "vivid";
export type Motion = "none" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "slow-zoom" | "face-focus";
export type Transition = "none" | "fade" | "slide" | "black" | "white" | "push" | "zoom" | "blur" | "wipe";
export type TextMotion = "none" | "fade" | "pop" | "rise" | "type";
export type TextStyle = "bar" | "outline" | "shadow" | "plain" | "body" | "year" | "ending";
export type FrameMode = "blur" | "cover" | "contain";
export type TitleStyle = "luxury" | "emotion" | "simple" | "grand";
export type TitleMotion = "fade" | "slow-zoom" | "slide-up";

export const TITLE_STYLE_BG: Record<TitleStyle, string> = {
  luxury: "#1a140f",
  emotion: "#241418",
  simple: "#101114",
  grand: "#0b1020",
};

export type TitleCard = {
  role: "intro" | "ending";
  style: TitleStyle;
  motion: TitleMotion;
  main: string;
  sub: string;
  date: string;
  thanks: string;
  org: string;
  bg: string;
  seconds: number;
  logo?: string;
  bgImage?: string;
};

/** 편집 프로그램 로고는 고객 영상에 넣지 않는다. 고객이 올린 로고만 통과시킨다. */
export function customerLogo(url?: string) {
  return customerBrandLogo(url);
}

export const FX = {
  look: "none" as Look,
  motion: "none" as Motion,
  transition: "fade" as Transition,
  textMotion: "rise" as TextMotion,
  textStyle: "bar" as TextStyle,
};

export type MediaKind = "video" | "image" | "audio" | "text";

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|heic|heif|avif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv)$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg)$/i;

export function fileKind(file: { type?: string; name?: string }): MediaKind {
  const type = (file.type ?? "").toLowerCase();
  const name = file.name ?? "";
  if (type.startsWith("audio") || AUDIO_EXT.test(name)) return "audio";
  if (type.startsWith("video") || VIDEO_EXT.test(name)) return "video";
  if (type.startsWith("image") || IMAGE_EXT.test(name)) return "image";
  return "image";
}

export type SlideInput = {
  id: string;
  name: string;
  url: string;
  caption: string;
  seconds?: number;
};

export type PlannedClip = {
  id: string;
  kind: MediaKind;
  name: string;
  url?: string;
  track: number;
  start: number;
  duration: number;
  offset: number;
  text: string;
  color: string;
  fontSize: number;
  x: number;
  y: number;
  volume: number;
  look: Look;
  motion: Motion;
  transition: Transition;
  textMotion: TextMotion;
  textStyle: TextStyle;
  frame?: FrameMode;
  title?: TitleCard;
  audioOn?: boolean;
  sourceDuration?: number;
  endingCut?: boolean;
};

/** 사진마다 화면을 채우고, 자막이 있으면 같은 시간에 아래에 올린다. */
export function planSlideshow(slides: SlideInput[], seconds = 4): PlannedClip[] {
  const clips: PlannedClip[] = [];
  let cursor = 0;
  slides.forEach((slide, index) => {
    const span = Math.max(0.4, slide.seconds ?? seconds);
    clips.push({
      id: `${slide.id}-photo`,
      kind: "image",
      name: slide.name,
      url: slide.url,
      track: 0,
      start: cursor,
      duration: span,
      offset: 0,
      text: "",
      color: "#fffdf8",
      fontSize: 54,
      x: 0.5,
      y: 0.86,
      volume: 0,
      look: "none",
      motion: "slow-zoom",
      transition: index === 0 ? "fade" : "fade",
      textMotion: "none",
      textStyle: "plain",
      frame: "blur",
    });
    const caption = slide.caption.trim();
    if (caption) {
      clips.push({
        id: `${slide.id}-caption`,
        kind: "text",
        name: "자막",
        track: 2,
        start: cursor,
        duration: span,
        offset: 0,
        text: caption,
        color: "#fffdf8",
        fontSize: 54,
        x: 0.5,
        y: 0.86,
        volume: 1,
        look: "none",
        motion: "none",
        transition: "none",
        textMotion: "rise",
        textStyle: "bar",
      });
    }
    cursor += span;
  });
  return clips;
}

export function slideshowDuration(clips: { start: number; duration: number }[]) {
  if (!clips.length) return 8;
  return Math.max(...clips.map((clip) => clip.start + clip.duration));
}
