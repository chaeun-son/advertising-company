import { Link } from "@tanstack/react-router";
import { Clapperboard, Download, GripVertical, ImagePlus, Pause, Play, Redo2, Scissors, Trash2, Type, Undo2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { MusicShelf, type MusicPick } from "@/components/video/music-shelf";
import { ProPanel, ProTools, type ProClip } from "@/components/video/pro-panel";
import { TitleFields } from "@/components/video/title-fields";
import { BEATS, DEFAULT_ENDING, DEFAULT_INTRO, TITLE_TEMPLATES, applyMediaOrder, applyTitlePreset, bodyPhotoId, directFilm, filmItemsFromTimeline, filmSummary, fitDurations, holdTargetLength, layoutVisualOrder, lengthGapLabel, musicFadeFor, parseFilmLength, readSavedTemplates, videoDuckSpans, videoPlacementFor, writeSavedTemplates, type BeatId, type SavedTitleTemplate } from "@/lib/video/director";
import { bedLevel, EXPORT_SIZES, type ExportFps, type ExportSize } from "@/lib/video/export-presets";
import { encodeMp4 } from "@/lib/video/mp4-export";
import { listUserMusic, rememberMusicUses } from "@/lib/video/music-client";
import { MUSIC } from "@/lib/video/music";
import { layMusicBeds, musicSections, restoreUserMusicUrls, sectionsFreeOf, type BedTrack } from "@/lib/video/music-plan";
import {
  fontFamily,
  gradeToFilter,
  incomingTransition,
  legacyEnter,
  mediaOffset,
  motionKeys,
  outgoingTransition,
  readUserPresets,
  sampleNumber,
  speedAt,
  textAnimState,
  transitionSeconds,
  writeUserPresets,
  type FontChoice,
  type Grade,
  type Keyframe,
  type SpeedRamp,
  type TextAlign,
  type TextEnter,
  type TextExit,
  type UserPreset,
} from "@/lib/video/pro-edit";
import { listVideoProjects, loadVideoProject, rewriteClipUrl, saveVideoProject, type VideoProjectRecord } from "@/lib/video/project-db";
import { customerLogo, fileKind, FX, planSlideshow, slideshowDuration, type FrameMode, type Look, type MediaKind, type Motion, type TextMotion, type TextStyle, type TitleCard, type Transition } from "@/lib/video/slideshow";
import { paintTitleCard } from "@/lib/video/title-paint";

type Kind = MediaKind;

type Clip = {
  id: string;
  kind: Kind;
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
  loop?: boolean;
  library?: boolean;
  libraryId?: string;
  musicSource?: "builtin" | "user";
  pinned?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  audioOn?: boolean;
  sourceDuration?: number;
  endingCut?: boolean;
  font?: string;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  align?: TextAlign;
  strokeWidth?: number;
  strokeColor?: string;
  textShadow?: number;
  box?: boolean;
  boxColor?: string;
  boxAlpha?: number;
  opacity?: number;
  rotate?: number;
  placed?: boolean;
  enter?: TextEnter;
  exit?: TextExit;
  enterSec?: number;
  exitSec?: number;
  animSpeed?: number;
  transitionSec?: number;
  grade?: Grade;
  keyframes?: Keyframe[];
  speed?: number;
  speedRamp?: SpeedRamp;
  pip?: boolean;
  scale?: number;
  radius?: number;
  pipShadow?: number;
  videoPlace?: "auto" | "manual";
  videoAfter?: string | null;
};

const TRACKS = [
  { id: 0, label: "영상 1" },
  { id: 1, label: "영상 2" },
  { id: 2, label: "글자" },
  { id: 3, label: "소리" },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function fmt(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  const f = Math.floor((s % 1) * 10);
  return `${m}:${String(r).padStart(2, "0")}.${f}`;
}

function fmtClock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

type PhotoCard = { id: string; name: string; url: string; caption: string; beat?: BeatId; uploadIndex: number };
type PhotoOrderMode = "keep" | "manual" | "ai";
type EditSnapshot = { clips: Clip[]; photos: PhotoCard[] };

async function refreshSavedMusic(clips: Clip[]) {
  if (!clips.some((clip) => clip.musicSource === "user" && clip.libraryId)) return clips;
  try {
    const library = await listUserMusic();
    const urls = new Map(library.tracks.map((track) => [track.id, track.playUrl]));
    const next = restoreUserMusicUrls(clips, urls);
    const missing = next.filter((clip) => clip.musicSource === "user" && clip.libraryId && !urls.has(clip.libraryId));
    if (missing.length) toast.message("보관함에서 빠진 음악이 있습니다. 그 구간은 이전 주소로만 재생됩니다.");
    return next;
  } catch {
    return clips;
  }
}

export function VideoEditor() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [photos, setPhotos] = useState<PhotoCard[]>([]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(72);
  const [exporting, setExporting] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);
  const [filmSeconds, setFilmSeconds] = useState<number | null>(180);
  const [lengthLock, setLengthLock] = useState(true);
  const [customLength, setCustomLength] = useState("");
  const [filmMood, setFilmMood] = useState<"warm" | "bold" | "calm">("warm");
  const [photoOrder, setPhotoOrder] = useState<PhotoOrderMode>("manual");
  const [orderDrag, setOrderDrag] = useState<{ id: string; insertAt: number } | null>(null);
  const [musicPick, setMusicPick] = useState<"builtin" | "library">("builtin");
  const [userBeds, setUserBeds] = useState<BedTrack[]>([]);
  const [introOn, setIntroOn] = useState(true);
  const [endingOn, setEndingOn] = useState(true);
  const [endingCutOn, setEndingCutOn] = useState(true);
  const [endingCutId, setEndingCutId] = useState("");
  const [endingCutSeconds, setEndingCutSeconds] = useState(7);
  const [endingCutCaption, setEndingCutCaption] = useState("함께한 50년");
  const [introCard, setIntroCard] = useState<TitleCard>(DEFAULT_INTRO);
  const [endingCard, setEndingCard] = useState<TitleCard>(DEFAULT_ENDING);
  const [templateName, setTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTitleTemplate[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"mp4" | "webm">("mp4");
  const [exportSize, setExportSize] = useState<ExportSize>("1080p");
  const [exportFps, setExportFps] = useState<ExportFps>(30);
  const [projects, setProjects] = useState<Pick<VideoProjectRecord, "id" | "name" | "savedAt">[]>([]);
  const [past, setPast] = useState<EditSnapshot[]>([]);
  const [future, setFuture] = useState<EditSnapshot[]>([]);
  const [safeOn, setSafeOn] = useState(false);
  const [userPresets, setUserPresets] = useState<UserPreset[]>([]);
  const [extraFonts, setExtraFonts] = useState<FontChoice[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioNodes = useRef(new Map<string, { source: MediaElementAudioSourceNode; gain: GainNode }>());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clipsRef = useRef(clips);
  const photosRef = useRef(photos);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const audios = useRef(new Map<string, HTMLAudioElement>());
  const images = useRef(new Map<string, HTMLImageElement>());
  const raf = useRef(0);
  const clock = useRef({ origin: 0, at: 0 });
  const projectKeyRef = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : uid());
  const safeRef = useRef(false);
  const filmSecondsRef = useRef(filmSeconds);
  const lengthLockRef = useRef(lengthLock);
  const photoOrderRef = useRef(photoOrder);
  const zoomRef = useRef(72);
  clipsRef.current = clips;
  photosRef.current = photos;
  timeRef.current = time;
  playingRef.current = playing;
  safeRef.current = safeOn;
  filmSecondsRef.current = filmSeconds;
  lengthLockRef.current = lengthLock;
  photoOrderRef.current = photoOrder;
  zoomRef.current = zoom;

  useEffect(() => {
    setSavedTemplates(readSavedTemplates());
    setUserPresets(readUserPresets());
  }, []);

  const duration = slideshowDuration(clips);
  const shownLength = clips.length ? duration : 0;
  const lengthGap = filmSeconds != null && clips.length ? lengthGapLabel(duration, filmSeconds) : "";
  const selectedClip = clips.find((c) => c.id === selected) ?? null;
  const shelfItems = bodyClips(clips, true);
  const shelfNumbers = new Map<string, number>();
  shelfItems.forEach((clip) => {
    if (clip.kind !== "image" || clip.endingCut) return;
    shelfNumbers.set(clip.id, shelfNumbers.size + 1);
  });
  const planPreview = useMemo(() => {
    if (!directorOpen) return [];
    const items = filmItemsFromTimeline(photos, clips);
    if (!items.length) return [];
    return directFilm(items, filmSeconds, filmMood, {
      reorder: photoOrder === "ai",
      intro: introOn ? introCard : false,
      ending: endingOn ? endingCard : false,
      endingCut: endingCutOn ? { sourceId: endingCutId || undefined, seconds: endingCutSeconds, caption: endingCutCaption } : false,
    });
  }, [directorOpen, photos, clips, filmSeconds, filmMood, photoOrder, introOn, endingOn, introCard, endingCard, endingCutOn, endingCutId, endingCutSeconds, endingCutCaption]);
  const planNumbers = filmSummary(planPreview);
  const cutChoices = useMemo(
    () => filmItemsFromTimeline(photos, clips).map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.kind === "video" ? `영상 · ${item.name}` : `사진 · ${item.name}`,
    })),
    [photos, clips],
  );
  const selectedCut = cutChoices.find((item) => item.id === endingCutId) ?? [...cutChoices].reverse().find((item) => item.kind === "image");
  const cutIsVideo = selectedCut?.kind === "video";

  function mediaFor(clip: Clip) {
    if (clip.kind === "video" && clip.url) {
      let el = videos.current.get(clip.id);
      if (!el) {
        el = document.createElement("video");
        el.src = clip.url;
        el.playsInline = true;
        el.preload = "auto";
        videos.current.set(clip.id, el);
      }
      return el;
    }
    if (clip.kind === "audio" && clip.url) {
      let el = audios.current.get(clip.id);
      if (!el) {
        el = document.createElement("audio");
        el.preload = "auto";
        audios.current.set(clip.id, el);
      }
      if (el.dataset.src !== clip.url) {
        el.dataset.src = clip.url;
        el.src = clip.url;
      }
      return el;
    }
    return null;
  }

  function audibleVolume(clip: Clip, at: number) {
    const elapsed = Math.max(0, at - clip.start);
    const keyed = (clip.keyframes ?? []).some((key) => typeof key.volume === "number");
    const volume = keyed ? sampleNumber(clip.keyframes, elapsed, "volume", clip.volume) : clip.volume;
    if (clip.kind === "video") return clip.audioOn === false ? 0 : Math.min(1, Math.max(0, volume));
    if (clip.kind !== "audio") return Math.min(1, Math.max(0, volume));
    const fade = musicFadeFor(clipsRef.current);
    return bedLevel(volume, at, clip.start, clip.duration, clip.fadeIn ?? 0, clip.fadeOut ?? 0, fade?.fadeStart, fade?.fadeOut, videoDuckSpans(clipsRef.current));
  }

  function preloadClipImages(list: Clip[]) {
    const jobs: Promise<void>[] = [];
    const queue = (key: string, url: string) => {
      const existing = images.current.get(key);
      if (existing?.complete && existing.naturalWidth) return;
      jobs.push(new Promise((resolve) => {
        const img = existing ?? new Image();
        const done = () => resolve();
        img.onload = done;
        img.onerror = done;
        if (!existing) {
          img.src = url;
          images.current.set(key, img);
        }
        if (img.complete) done();
      }));
    };
    for (const clip of list) {
      if (clip.kind === "image" && clip.url) queue(clip.id, clip.url);
      if (clip.title?.logo) queue(clip.title.logo, clip.title.logo);
      if (clip.title?.bgImage) queue(clip.title.bgImage, clip.title.bgImage);
    }
    return Promise.all(jobs);
  }

  function draw(at: number, target?: HTMLCanvasElement) {
    const canvas = target ?? canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const designW = 1280;
    const designH = 720;
    ctx.setTransform(canvas.width / designW, 0, 0, canvas.height / designH, 0, 0);
    ctx.fillStyle = "#14120f";
    ctx.fillRect(0, 0, designW, designH);
    const list = [...clipsRef.current].sort((a, b) => a.track - b.track);
    const visuals = list.filter((clip) => (clip.kind === "image" || clip.kind === "video") && !clip.pip && !clip.title);
    for (const clip of list) {
      if (clip.kind === "audio") continue;
      const visualClip = (clip.kind === "image" || clip.kind === "video") && !clip.pip && !clip.title;
      const elapsed = at - clip.start;
      const alive = at >= clip.start && at < clip.start + clip.duration;
      const next = visualClip ? visuals.find((other) => other.id !== clip.id && other.track === clip.track && other.start > clip.start + 0.05 && other.start <= clip.start + clip.duration + 0.08) : undefined;
      const nextSec = next ? transitionSeconds(next.transition, next.transitionSec) : 0;
      const nextLegacy = Boolean(next && next.transitionSec == null);
      const outgoingP = next && nextSec > 0 && at >= next.start && at < next.start + nextSec ? (at - next.start) / nextSec : null;
      const outgoing = outgoingTransition(next?.transition, outgoingP, designW, nextLegacy);
      const holding = visualClip && !alive && outgoingP != null && (outgoing.alpha > 0.02 || Math.abs(outgoing.tx) > 1);
      if (!alive && !holding) continue;
      const local = clip.duration > 0 ? Math.min(1, Math.max(0, elapsed) / clip.duration) : 0;
      const sec = visualClip ? transitionSeconds(clip.transition, clip.transitionSec) : 0;
      const legacy = clip.transitionSec == null;
      const incomingP = visualClip && alive && sec > 0 && at < clip.start + sec ? Math.min(1, Math.max(0, elapsed) / sec) : null;
      const incoming = visualClip ? incomingTransition(clip.transition, incomingP, designW, legacy) : { alpha: 1, tx: 0, scale: 1, blur: 0, wipe: null, underlay: null };
      let alpha = incoming.alpha * (holding || alive ? outgoing.alpha : 1);
      if (legacy && clip.transition === "black" && alive) {
        const endFade = Math.min(1, Math.max(0, clip.start + clip.duration - at) / Math.max(0.2, sec || 0.55));
        alpha = Math.min(alpha, endFade);
      }
      alpha *= sampleNumber(clip.keyframes, Math.max(0, elapsed), "opacity", clip.opacity ?? 1);
      const slide = !clip.pip && clip.transition === "slide" && local > 0 && local < 0.22 ? (1 - local / 0.22) * designW * 0.18 : 0;
      ctx.save();
      if (incoming.underlay && incomingP != null) {
        const cover = incomingP < 0.5 ? incomingP * 2 : (1 - incomingP) * 2;
        ctx.save();
        ctx.globalAlpha = cover;
        ctx.fillStyle = incoming.underlay;
        ctx.fillRect(0, 0, designW, designH);
        ctx.restore();
      }
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(incoming.tx + outgoing.tx + slide, 0);
      if (incoming.wipe != null) {
        ctx.beginPath();
        ctx.rect(0, 0, Math.max(0, designW * incoming.wipe), designH);
        ctx.clip();
      }
      const zoom = incoming.scale * outgoing.scale;
      if (Math.abs(zoom - 1) > 0.001) {
        ctx.translate(designW / 2, designH / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-designW / 2, -designH / 2);
      }
      const blur = Math.max(incoming.blur, outgoing.blur);
      if (clip.title) {
        paintTitleCard(ctx, clip.title, designW, designH, local, images.current);
        ctx.restore();
        continue;
      }
      if (clip.kind === "image" && clip.url) {
        let img = images.current.get(clip.id);
        if (!img) {
          img = new Image();
          img.onload = () => draw(timeRef.current);
          img.src = clip.url;
          images.current.set(clip.id, img);
        }
        if (img.complete && img.naturalWidth) paintPicture(ctx, img, designW, designH, clip, local, blur);
        if (clip.text && !clip.pip) paintText(ctx, clip, designW, designH, local);
      }
      if (clip.kind === "video") {
        const video = mediaFor(clip) as HTMLVideoElement | null;
        if (video && video.readyState >= 2) paintPicture(ctx, video, designW, designH, clip, local, blur);
        const covered = list.some((other) => other.kind === "text" && other.id === `${clip.id}-caption` && at >= other.start && at < other.start + other.duration && other.text.trim());
        if (clip.text.trim() && !covered) paintText(ctx, clip, designW, designH, local);
      }
      if (clip.kind === "text" && clip.text) paintText(ctx, clip, designW, designH, local);
      ctx.restore();
    }
    if (!target && safeRef.current) paintSafe(ctx, designW, designH);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function sync(at: number, shouldPlay: boolean) {
    for (const clip of clipsRef.current) {
      if (clip.kind !== "video" && clip.kind !== "audio") continue;
      const el = mediaFor(clip);
      if (!el) continue;
      const active = at >= clip.start && at < clip.start + clip.duration;
      const mediaDur = el.duration;
      const elapsed = Math.max(0, at - clip.start);
      let local = mediaOffset(clip.offset, elapsed, clip.duration, clip.speed ?? 1, clip.speedRamp);
      if (clip.loop && Number.isFinite(mediaDur) && mediaDur > 0) local %= mediaDur;
      el.loop = Boolean(clip.loop);
      try { el.playbackRate = speedAt(clip.duration > 0 ? elapsed / clip.duration : 0, clip.speed ?? 1, clip.speedRamp); } catch { /* not ready */ }
      el.volume = Math.min(1, Math.max(0, audibleVolume(clip, at)));
      const node = audioNodes.current.get(clip.id);
      if (node) node.gain.gain.value = el.volume;
      if (!active) {
        if (!el.paused) el.pause();
        continue;
      }
      if (Math.abs(el.currentTime - local) > 0.35) {
        try { el.currentTime = local; } catch { /* not ready */ }
      }
      if (shouldPlay && el.paused) void el.play().catch(() => {});
      if (!shouldPlay && !el.paused) el.pause();
    }
  }

  function pause() {
    setPlaying(false);
    playingRef.current = false;
    cancelAnimationFrame(raf.current);
    sync(timeRef.current, false);
  }

  function play() {
    if (timeRef.current >= duration - 0.05) {
      timeRef.current = 0;
      setTime(0);
    }
    clock.current = { origin: performance.now(), at: timeRef.current };
    setPlaying(true);
    playingRef.current = true;
    const loop = () => {
      const at = clock.current.at + (performance.now() - clock.current.origin) / 1000;
      const end = Math.max(12, ...clipsRef.current.map((c) => c.start + c.duration), 0);
      if (at >= end) {
        timeRef.current = end;
        setTime(end);
        pause();
        draw(end);
        return;
      }
      timeRef.current = at;
      setTime(at);
      sync(at, true);
      draw(at);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }

  useEffect(() => {
    draw(timeRef.current);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " ") {
        e.preventDefault();
        if (playingRef.current) pause();
        else play();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoEdit();
        else undoEdit();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected) remove(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  function seek(next: number) {
    const at = Math.max(0, Math.min(duration, next));
    pause();
    timeRef.current = at;
    setTime(at);
    sync(at, false);
    draw(at);
  }

  useEffect(() => {
    for (const clip of clips) {
      const urls = [clip.title?.logo, clip.title?.bgImage].filter((url): url is string => Boolean(url));
      if (clip.kind === "image" && clip.url && !images.current.has(clip.id)) {
        const img = new Image();
        img.onload = () => draw(timeRef.current);
        img.src = clip.url;
        images.current.set(clip.id, img);
      }
      for (const url of urls) {
        if (images.current.has(url)) continue;
        const img = new Image();
        img.onload = () => draw(timeRef.current);
        img.src = url;
        images.current.set(url, img);
      }
    }
    draw(timeRef.current);
  }, [clips]);

  function remember() {
    setPast((cur) => [...cur.slice(-29), { clips: clipsRef.current, photos: photosRef.current }]);
    setFuture([]);
  }

  function undoEdit() {
    setPast((cur) => {
      const prev = cur[cur.length - 1];
      if (!prev) return cur;
      setFuture((next) => [{ clips: clipsRef.current, photos: photosRef.current }, ...next]);
      setClips(prev.clips);
      setPhotos(prev.photos);
      return cur.slice(0, -1);
    });
  }

  function redoEdit() {
    setFuture((cur) => {
      const next = cur[0];
      if (!next) return cur;
      setPast((prev) => [...prev.slice(-29), { clips: clipsRef.current, photos: photosRef.current }]);
      setClips(next.clips);
      setPhotos(next.photos);
      return cur.slice(1);
    });
  }

  function trimAudioToTarget(list: Clip[], target: number) {
    return list.map((clip) => {
      if (clip.kind !== "audio" || clip.start >= target || clip.start + clip.duration <= target + 0.001) return clip;
      return { ...clip, duration: Math.max(0.2, target - clip.start) };
    });
  }

  function chooseLength(value: number | null) {
    setFilmSeconds(value);
    setLengthLock(value != null);
    filmSecondsRef.current = value;
    lengthLockRef.current = value != null;
    if (value == null) return;
    remember();
    setClips((cur) => holdTargetLength(cur, value));
  }

  function applyCustomLength() {
    const seconds = parseFilmLength(customLength);
    if (seconds == null || seconds > 60 * 60) {
      toast.error("길이는 4:30, 4분 30초, 7분 20초처럼 60분 이하로 입력해 주세요.");
      return;
    }
    chooseLength(Math.round(seconds * 1000) / 1000);
  }

  function orderPhotoCards(list: PhotoCard[], photoIds: readonly string[]) {
    const byId = new Map(list.map((photo) => [photo.id, photo]));
    const next: PhotoCard[] = [];
    const seen = new Set<string>();
    for (const id of photoIds) {
      const photo = byId.get(id);
      if (!photo || seen.has(id)) continue;
      seen.add(id);
      next.push(photo);
    }
    for (const photo of list) {
      if (!seen.has(photo.id)) next.push(photo);
    }
    return next;
  }

  function locked(list: Clip[]) {
    if (!lengthLockRef.current || filmSecondsRef.current == null) return list;
    return holdTargetLength(list, filmSecondsRef.current);
  }

  function commitBodyOrder(nextIds: string[]) {
    const current = clipsRef.current;
    const body = bodyClips(current);
    if (nextIds.join("|") === body.map((clip) => clip.id).join("|")) return;
    const byId = new Map(current.map((clip) => [clip.id, clip]));
    const ordered = nextIds.map((id) => byId.get(id)).filter((clip): clip is Clip => Boolean(clip));
    const flags = videoPlacementFor(ordered);
    const photoIds = ordered.filter((clip) => clip.kind === "image").map((clip) => bodyPhotoId(clip));
    remember();
    setPhotos((cur) => orderPhotoCards(cur, photoIds));
    setClips((cur) => {
      const patched = cur.map((clip) => {
        const flag = flags.get(clip.id);
        return flag ? { ...clip, videoPlace: flag.videoPlace, videoAfter: flag.videoAfter } : clip;
      });
      return locked(layoutVisualOrder(patched, nextIds));
    });
  }

  function choosePhotoOrder(mode: PhotoOrderMode) {
    setPhotoOrder(mode);
    photoOrderRef.current = mode;
    if (mode !== "keep") return;
    const ids = [...photosRef.current].sort((a, b) => a.uploadIndex - b.uploadIndex || a.id.localeCompare(b.id)).map((photo) => photo.id);
    remember();
    setPhotos((cur) => [...cur].sort((a, b) => a.uploadIndex - b.uploadIndex || a.id.localeCompare(b.id)));
    setClips((cur) => {
      const cleared = cur.map((clip) => (clip.kind === "video" && !clip.endingCut && !clip.pip ? { ...clip, videoPlace: "auto" as const, videoAfter: null } : clip));
      return locked(applyMediaOrder(cleared, ids));
    });
  }

  function startReorder(event: ReactPointerEvent, clipId: string, source: "shelf" | "timeline") {
    if (event.button !== 0) return;
    if (photoOrderRef.current === "keep") {
      toast.message("원본 유지 중에는 순서를 바꾸지 않습니다. 직접 정렬을 누르세요.");
      return;
    }
    event.stopPropagation();
    if (source === "shelf") event.preventDefault();
    const originX = event.clientX;
    const originY = event.clientY;
    const touch = event.pointerType === "touch";
    let armed = !touch;
    let moved = false;
    const timer = touch ? window.setTimeout(() => { armed = true; }, 280) : 0;
    const insertAt = (clientX: number) => {
      const body = bodyClips(clipsRef.current);
      return source === "shelf" ? shelfInsert(clientX, clipId) : timelineInsert(clientX, zoomRef.current, body, clipId);
    };
    const move = (ev: PointerEvent) => {
      if (!armed) {
        if (Math.hypot(ev.clientX - originX, ev.clientY - originY) > 12) {
          window.clearTimeout(timer);
          cleanup();
        }
        return;
      }
      if (Math.hypot(ev.clientX - originX, ev.clientY - originY) > 4) moved = true;
      setOrderDrag({ id: clipId, insertAt: insertAt(ev.clientX) });
    };
    const up = (ev: PointerEvent) => {
      window.clearTimeout(timer);
      cleanup();
      setOrderDrag(null);
      if (!armed || !moved) return;
      const body = bodyClips(clipsRef.current);
      const from = body.findIndex((clip) => clip.id === clipId);
      if (from < 0) return;
      const index = insertAt(ev.clientX);
      const ids = body.map((clip) => clip.id);
      const [item] = ids.splice(from, 1);
      if (!item) return;
      ids.splice(index, 0, item);
      commitBodyOrder(ids);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    if (!touch) setOrderDrag({ id: clipId, insertAt: insertAt(event.clientX) });
  }

  function toggleLengthLock() {
    const next = !lengthLockRef.current;
    setLengthLock(next);
    lengthLockRef.current = next;
    if (!next || filmSecondsRef.current == null) return;
    remember();
    setClips((cur) => holdTargetLength(cur, filmSecondsRef.current as number));
  }

  function applyEndingCutLength(seconds: number) {
    setEndingCutSeconds(seconds);
    if (!lengthLockRef.current || filmSecondsRef.current == null) return;
    setClips((cur) => {
      const cut = cur.find((clip) => clip.endingCut && clip.kind === "image" && !clip.pip);
      if (!cut) return cur;
      const updated = cur.map((clip) => {
        if (clip.id === cut.id) return { ...clip, duration: seconds };
        if (clip.kind === "text" && !clip.title && Math.abs(clip.start - cut.start) < 0.05) return { ...clip, duration: seconds };
        return clip;
      });
      return holdTargetLength(updated, filmSecondsRef.current as number);
    });
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const allowed = incoming.filter(isEditorMedia);
    const rejected = incoming.filter((file) => !isEditorMedia(file));
    if (rejected.length) toast.error(`${rejected.map((file) => file.name).join(", ")}은 JPG, PNG, MP4, MOV, WEBM만 올릴 수 있습니다.`);
    if (!allowed.length) return;
    remember();
    const photosNext: PhotoCard[] = [];
    const clipsNext: Clip[] = [];
    let uploadIndex = photosRef.current.reduce((max, photo) => Math.max(max, photo.uploadIndex), -1);
    let imageCursor = clipsRef.current.filter((c) => c.track === 0).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    for (const file of allowed) {
      const kind = fileKind(file);
      if (kind === "image") {
        const url = await readableImageUrl(file);
        if (!url) {
          toast.error(`${file.name}은 열 수 없습니다. jpg 또는 png로 올려 주세요.`);
          continue;
        }
        const id = uid();
        uploadIndex += 1;
        photosNext.push({ id, name: file.name, url, caption: "", uploadIndex });
        clipsNext.push(imageClip(id, file.name, url, imageCursor, ""));
        imageCursor += 4;
        continue;
      }
      const url = URL.createObjectURL(file);
      const length = await probe(url, "video");
      clipsNext.push({
        id: uid(),
        kind: "video",
        name: file.name,
        url,
        track: 0,
        start: imageCursor,
        duration: length,
        offset: 0,
        text: "",
        color: "#fffdf8",
        fontSize: 54,
        x: 0.5,
        y: 0.86,
        volume: 1,
        audioOn: true,
        sourceDuration: length,
        videoPlace: "auto",
        videoAfter: null,
        ...FX,
        frame: "blur",
      });
      imageCursor += length;
    }
    const photoIds = [...photosRef.current.map((photo) => photo.id), ...photosNext.map((photo) => photo.id)];
    if (photosNext.length) setPhotos((cur) => orderPhotoCards([...cur, ...photosNext], photoIds));
    if (clipsNext.length) {
      setClips((cur) => locked(applyMediaOrder([...cur, ...clipsNext], photoIds)));
      setSelected(clipsNext[clipsNext.length - 1]?.id ?? null);
      const videos = clipsNext.filter((clip) => clip.kind === "video").length;
      const photos = clipsNext.length - videos;
      toast.success([photos ? `사진 ${photos}장` : "", videos ? `영상 ${videos}개` : ""].filter(Boolean).join(", ") + "을 타임라인에 넣었습니다.");
    }
  }

  function setCaption(id: string, caption: string) {
    remember();
    setPhotos((cur) => cur.map((photo) => photo.id === id ? { ...photo, caption } : photo));
    setClips((cur) => cur.map((clip) => {
      if (clip.id === `${id}-caption`) return { ...clip, text: caption };
      if (clip.id === `${id}-photo` && !cur.some((item) => item.id === `${id}-caption`)) return { ...clip, text: caption };
      return clip;
    }));
  }

  function makeFromPhotos() {
    if (!photos.length) {
      toast.error("사진을 먼저 올려 주세요.");
      return;
    }
    remember();
    const planned = planSlideshow(photos.map((photo) => ({ ...photo, seconds: 4 })));
    const fitted = lengthLock && filmSeconds != null ? holdTargetLength(planned, filmSeconds) : planned;
    const next = keepPhotoPlacement(fitted, clipsRef.current);
    setClips(next);
    setSelected(next[0]?.id ?? null);
    setTime(0);
    timeRef.current = 0;
    toast.success("사진과 자막으로 영상을 만들었습니다. 재생하거나 영상 받기를 누르세요.");
  }

  function audioClip(track: MusicPick, slot: { start: number; duration: number; fadeIn: number; fadeOut: number }, pinned: boolean, volume = 0.75): Clip {
    return {
      id: uid(),
      kind: "audio",
      name: track.name,
      url: track.url,
      track: 3,
      start: slot.start,
      duration: slot.duration,
      offset: 0,
      text: "",
      color: "#fffdf8",
      fontSize: 54,
      x: 0.5,
      y: 0.86,
      volume,
      ...FX,
      loop: !track.duration || track.duration + 0.25 < slot.duration,
      library: true,
      libraryId: track.id,
      musicSource: track.source,
      pinned,
      fadeIn: slot.fadeIn,
      fadeOut: slot.fadeOut,
    };
  }

  function placeBed(track: MusicPick, mode: "add" | "replace") {
    const selectedAudio = clipsRef.current.find((clip) => clip.id === selected && clip.kind === "audio");
    if (mode === "replace" && selectedAudio) {
      patch(selectedAudio.id, {
        name: track.name,
        url: track.url,
        library: true,
        libraryId: track.id,
        musicSource: track.source,
        pinned: true,
        loop: !track.duration || track.duration + 0.25 < selectedAudio.duration,
      });
      void rememberMusicUses(projectKeyRef.current, "영상", [track.id]);
      toast.success(`${track.name}으로 바꿨습니다. 위치와 길이는 그대로입니다.`);
      return;
    }
    remember();
    const beds = clipsRef.current.filter((clip) => clip.kind === "audio");
    const end = Math.max(slideshowDuration(clipsRef.current.filter((item) => item.kind !== "audio")), 0);
    const last = [...beds].sort((a, b) => a.start + a.duration - (b.start + b.duration)).at(-1);
    const slot = last
      ? { start: Math.max(0, last.start + last.duration - 1.2), duration: Math.max(8, (end || last.start + last.duration) - Math.max(0, last.start + last.duration - 1.2)), fadeIn: 1.2, fadeOut: 0 }
      : { start: 0, duration: Math.max(end, 12), fadeIn: 0.6, fadeOut: 0 };
    const clip = audioClip(track, slot, true);
    setClips((cur) => {
      const merged = [...cur.map((item) => {
        if (item.kind !== "audio") return item;
        const overlap = Math.min(item.start + item.duration, clip.start + clip.duration) - Math.max(item.start, clip.start);
        if (overlap > 0.3 && (item.fadeOut ?? 0) < 1.2) return { ...item, fadeOut: 1.2 };
        return item;
      }), clip];
      if (!lengthLockRef.current || filmSecondsRef.current == null) return merged;
      return trimAudioToTarget(merged, filmSecondsRef.current);
    });
    setSelected(clip.id);
    void rememberMusicUses(projectKeyRef.current, "영상", [track.id]);
    toast.success(beds.length ? `${track.name}을 이어서 넣었습니다. 겹치는 구간은 크로스페이드됩니다.` : `${track.name}을 배경음악으로 넣었습니다.`);
  }

  async function runDirector() {
    let items = filmItemsFromTimeline(photosRef.current, clipsRef.current);
    if (!items.length) {
      toast.error("사진이나 영상을 먼저 올려 주세요.");
      setDirectorOpen(true);
      return;
    }
    const reorder = photoOrder === "ai";
    if (photoOrder === "keep") {
      const rank = new Map(photosRef.current.map((photo) => [photo.id, photo.uploadIndex]));
      const images = items.filter((item) => item.kind === "image").sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) || a.id.localeCompare(b.id));
      const videos = items.filter((item) => item.kind === "video");
      items = [...images, ...videos];
    }
    remember();
    const planned = directFilm(items, filmSeconds, filmMood, {
      reorder,
      intro: introOn ? introCard : false,
      ending: endingOn ? endingCard : false,
      endingCut: endingCutOn ? { sourceId: endingCutId || undefined, seconds: endingCutSeconds, caption: endingCutCaption } : false,
    });
    const beats = new Map(fitDurations(items.filter((item) => item.kind === "image"), null, reorder).map((photo) => [photo.id, photo.beat]));
    const imageOrder = planned.filter((clip) => clip.kind === "image").map((clip) => clip.id.replace(/-photo$/, ""));
    setPhotos((cur) => {
      const byId = new Map(cur.map((photo) => [photo.id, photo]));
      const next = imageOrder.map((id) => byId.get(id)).filter((photo): photo is PhotoCard => Boolean(photo));
      const rows = next.length ? next : cur;
      return rows.map((photo) => ({ ...photo, beat: beats.get(photo.id) ?? photo.beat }));
    });
    const pinned = clipsRef.current.filter((clip) => clip.kind === "audio" && clip.pinned);
    const kept = clipsRef.current.filter((clip) => clip.kind === "audio" && (clip.pinned || !clip.library));
    const prefer = filmMood === "bold" ? ["스포츠", "웅장", "경쾌"] : filmMood === "calm" ? ["잔잔", "추억"] : ["감동", "잔잔"];
    let generated: Clip[] = [];
    if (pinned.length) {
      generated = [];
    } else if (musicPick === "library" && !userBeds.length) {
      toast.error("내 음악이 없습니다. + 음악 업로드로 올리거나 기본 음악을 고르세요.");
      generated = [];
    } else {
      const tracks = musicPick === "library"
        ? userBeds
        : MUSIC.map((track) => ({ id: track.id, name: `${track.category} · ${track.title}`, url: track.src, category: track.category, duration: 26 }));
      const beds = layMusicBeds(sectionsFreeOf(musicSections(planned), pinned), tracks, 1.2, prefer);
      generated = beds.map((bed) => audioClip({
        id: bed.libraryId,
        name: bed.name,
        url: bed.url,
        category: bed.category,
        duration: tracks.find((track) => track.id === bed.libraryId)?.duration,
        source: musicPick === "library" ? "user" : "builtin",
      }, bed, false, bed.volume));
    }
    const manualIntros = introOn ? clipsRef.current.filter((clip) => clip.title?.role === "intro" && clip.id !== "intro-title") : [];
    let visual = keepPhotoPlacement(planned, clipsRef.current);
    if (manualIntros.length && filmSeconds != null) visual = holdTargetLength([...visual, ...manualIntros], filmSeconds);
    const audio = [...kept, ...generated];
    setClips(filmSeconds != null ? trimAudioToTarget([...visual, ...audio], filmSeconds) : [...visual, ...audio]);
    const introClip = planned.find((clip) => clip.title?.role === "intro");
    const endingClip = planned.find((clip) => clip.title?.role === "ending");
    const cutClip = planned.find((clip) => clip.endingCut);
    if (introClip?.title) setIntroCard(introClip.title);
    if (endingClip?.title) setEndingCard(endingClip.title);
    if (cutClip) setEndingCutId(cutClip.kind === "video" ? cutClip.id : cutClip.id.replace(/-photo$/, ""));
    setSelected(introClip?.id ?? planned[0]?.id ?? null);
    setTime(0);
    timeRef.current = 0;
    setDirectorOpen(true);
    void rememberMusicUses(projectKeyRef.current, "영상", audio.map((clip) => clip.libraryId ?? ""));
    const summary = filmSummary(planned);
    const orderLabel = reorder ? "AI가 사진 순서를 다시 배치하고 영상은 사진 뒤에 두었습니다." : photoOrder === "keep" ? "업로드한 원본 순서를 유지하고 영상은 사진 뒤에 두었습니다." : "직접 정렬한 순서를 유지하고 영상은 사진 뒤에 두었습니다.";
    const musicLabel = pinned.length ? "직접 고른 음악은 바꾸지 않았습니다." : musicPick === "library" ? "내 음악에서 구간에 맞춰 골랐습니다." : "기본 음악을 구간에 맞춰 깔았습니다.";
    toast.success(`전체 ${fmt(summary.total)} · 인트로 ${summary.intro ? fmt(summary.intro) : "없음"} · 본편 ${fmt(summary.body)} · 엔딩컷 ${summary.endingCut ? fmt(summary.endingCut) : "없음"} · 엔딩 타이틀 ${summary.ending ? fmt(summary.ending) : "없음"}. ${orderLabel} ${musicLabel}`);
  }

  function commitTitle(next: TitleCard, clipId?: string) {
    const safe = { ...next, logo: customerLogo(next.logo) };
    const current = clipsRef.current;
    const picked = clipId ? current.find((clip) => clip.id === clipId && clip.title?.role === safe.role) : undefined;
    const existing = picked ?? current.find((clip) => clip.title?.role === safe.role);
    const first = current.find((clip) => clip.title?.role === safe.role);
    if (!picked || existing?.id === first?.id) {
      if (safe.role === "intro") setIntroCard(safe);
      else setEndingCard(safe);
    }
    setClips((cur) => {
      const target = cur.find((clip) => clip.id === existing?.id);
      if (!target) return cur;
      const delta = safe.seconds - target.duration;
      const updated = cur.map((clip) => (clip.id === target.id ? { ...clip, title: safe, text: safe.main, duration: safe.seconds } : clip));
      if (!delta) return updated;
      if (lengthLockRef.current && filmSecondsRef.current != null) return holdTargetLength(updated, filmSecondsRef.current);
      return updated.map((clip) => {
        if (clip.id === target.id) return clip;
        if (safe.role === "intro") {
          if (clip.kind === "audio" && clip.start < 0.05) return { ...clip, duration: Math.max(0.4, clip.duration + delta) };
          if (clip.start > target.start + 0.02) return { ...clip, start: Math.max(0, clip.start + delta) };
        }
        if (safe.role === "ending" && clip.kind === "audio" && clip.start + clip.duration >= target.start - 0.2) {
          return { ...clip, duration: Math.max(0.4, clip.duration + delta) };
        }
        return clip;
      });
    });
    requestAnimationFrame(() => draw(timeRef.current));
  }

  async function pickTitleImage(role: "intro" | "ending", slot: "logo" | "bg", file: File, clipId?: string) {
    const url = await readableImageUrl(file);
    if (!url) {
      toast.error("이미지를 열 수 없습니다. jpg 또는 png로 올려 주세요.");
      return;
    }
    const current = clipId
      ? clipsRef.current.find((clip) => clip.id === clipId)?.title ?? (role === "intro" ? introCard : endingCard)
      : role === "intro" ? introCard : endingCard;
    commitTitle({ ...current, [slot === "logo" ? "logo" : "bgImage"]: url }, clipId);
  }

  function applyPreset(preset: { intro: Partial<TitleCard>; ending: Partial<TitleCard> }) {
    setIntroOn(true);
    setEndingOn(true);
    commitTitle(applyTitlePreset(introCard, { ...preset.intro, role: "intro" }));
    commitTitle(applyTitlePreset(endingCard, { ...preset.ending, role: "ending" }));
  }

  function saveTemplate() {
    const label = templateName.trim();
    if (!label) {
      toast.error("템플릿 이름을 적어 주세요.");
      return;
    }
    const next = [{ id: uid(), label, intro: introCard, ending: endingCard }, ...savedTemplates.filter((item) => item.label !== label)].slice(0, 24);
    setSavedTemplates(next);
    writeSavedTemplates(next);
    setTemplateName("");
    toast.success(`"${label}" 타이틀을 저장했습니다. 새로고침 후에도 문구와 스타일은 남고, 방금 올린 로고 파일은 빠질 수 있습니다.`);
  }

  function removeTemplate(id: string) {
    const next = savedTemplates.filter((item) => item.id !== id);
    setSavedTemplates(next);
    writeSavedTemplates(next);
  }

  function addText() {
    remember();
    const clip: Clip = {
      id: uid(),
      kind: "text",
      name: "글자",
      track: 2,
      start: timeRef.current,
      duration: 4,
      offset: 0,
      text: "문구를 입력하세요",
      color: "#fffdf8",
      fontSize: 72,
      x: 0.5,
      y: 0.78,
      volume: 1,
      ...FX,
      textMotion: "pop",
      textStyle: "outline",
    };
    setClips((cur) => [...cur, clip]);
    setSelected(clip.id);
    requestAnimationFrame(() => draw(timeRef.current));
  }

  function addIntro() {
    remember();
    setIntroOn(true);
    const seconds = Math.max(2, introCard.seconds || 7);
    const id = uid();
    const count = clipsRef.current.filter((clip) => clip.title?.role === "intro").length;
    const card: TitleCard = { ...introCard, role: "intro", seconds };
    const clip: Clip = {
      id,
      kind: "text",
      name: count ? `인트로 ${count + 1}` : "인트로 타이틀",
      track: 0,
      start: 0,
      duration: seconds,
      offset: 0,
      text: card.main,
      color: "#fffdf8",
      fontSize: 64,
      x: 0.5,
      y: 0.5,
      volume: 0,
      ...FX,
      motion: "none",
      transition: "none",
      textMotion: "none",
      textStyle: "year",
      title: card,
    };
    setClips((cur) => {
      const intros = cur.filter((item) => item.title?.role === "intro");
      const insertAt = intros.reduce((max, item) => Math.max(max, item.start + item.duration), 0);
      const placed = { ...clip, start: insertAt };
      const shifted = cur.map((item) => {
        const visual = (item.kind === "image" || item.kind === "video" || item.title) && !item.pip && (item.track ?? 0) === 0;
        const caption = item.kind === "text" && !item.title;
        if ((visual || caption) && item.start >= insertAt - 0.001) return { ...item, start: item.start + seconds };
        return item;
      });
      const next = [...shifted, placed];
      if (!lengthLockRef.current || filmSecondsRef.current == null) return next;
      return holdTargetLength(next, filmSecondsRef.current);
    });
    setSelected(id);
    toast.success(count ? "인트로 부분을 하나 더 넣었습니다." : "인트로를 넣었습니다. 문구는 오른쪽에서 고칩니다.");
    requestAnimationFrame(() => draw(timeRef.current));
  }

  function removeIntro(id?: string) {
    const intros = clipsRef.current.filter((clip) => clip.title?.role === "intro").sort((a, b) => a.start - b.start);
    const target = intros.find((clip) => clip.id === id) ?? intros.find((clip) => clip.id === selected) ?? intros.at(-1);
    if (!target) {
      toast.message("지울 인트로가 없습니다.");
      return;
    }
    remember();
    const span = target.duration;
    const cut = target.start;
    setIntroOn(intros.some((clip) => clip.id !== target.id));
    setClips((cur) => {
      const next = cur.filter((clip) => clip.id !== target.id).map((clip) => {
        const visual = (clip.kind === "image" || clip.kind === "video" || clip.title) && !clip.pip && (clip.track ?? 0) === 0;
        const caption = clip.kind === "text" && !clip.title;
        if ((visual || caption) && clip.start >= cut + span - 0.05) return { ...clip, start: Math.max(0, clip.start - span) };
        return clip;
      });
      if (!lengthLockRef.current || filmSecondsRef.current == null) return next;
      return holdTargetLength(next, filmSecondsRef.current);
    });
    setSelected((cur) => (cur === target.id ? null : cur));
    toast.success("인트로를 뺐습니다.");
    requestAnimationFrame(() => draw(timeRef.current));
  }

  function beginPhotoPlace(event: ReactPointerEvent<HTMLCanvasElement>) {
    const clip = clipsRef.current.find((item) => item.id === selected);
    if (!clip || clip.pip || clip.title || (clip.kind !== "image" && clip.kind !== "video")) return;
    const now = timeRef.current;
    if (now < clip.start - 0.02 || now > clip.start + clip.duration + 0.02) {
      toast.message("그 사진이 보이는 순간에 화면을 끌어 주세요.");
      return;
    }
    event.preventDefault();
    pause();
    remember();
    const originX = clip.placed ? clip.x : 0.5;
    const originY = clip.placed ? clip.y : 0.5;
    const rect = event.currentTarget.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / Math.max(1, rect.width);
      const dy = (ev.clientY - startY) / Math.max(1, rect.height);
      patch(clip.id, {
        placed: true,
        x: Math.min(1, Math.max(0, originX + dx)),
        y: Math.min(1, Math.max(0, originY + dy)),
        scale: clip.scale ?? 1,
      }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function addOverlay(file: File | undefined) {
    if (!file) return;
    if (!/image\/(png|jpeg)/.test(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) {
      toast.error("오버레이는 PNG 또는 JPG만 올릴 수 있습니다.");
      return;
    }
    remember();
    const url = URL.createObjectURL(file);
    const clip: Clip = {
      id: uid(),
      kind: "image",
      name: file.name,
      url,
      track: 1,
      start: timeRef.current,
      duration: 4,
      offset: 0,
      text: "",
      color: "#fffdf8",
      fontSize: 40,
      x: 0.78,
      y: 0.22,
      volume: 0,
      ...FX,
      motion: "none",
      transition: "none",
      pip: true,
      scale: 0.28,
      opacity: 1,
      radius: 16,
      pipShadow: 18,
    };
    setClips((cur) => [...cur, clip]);
    setSelected(clip.id);
    requestAnimationFrame(() => draw(timeRef.current));
  }

  function saveUserPreset(kind: UserPreset["kind"], label: string) {
    const clip = clipsRef.current.find((item) => item.id === selected);
    let payload: unknown = null;
    if (kind === "text" && clip) {
      payload = {
        font: clip.font, fontWeight: clip.fontWeight, fontSize: clip.fontSize, letterSpacing: clip.letterSpacing,
        lineHeight: clip.lineHeight, align: clip.align, color: clip.color, strokeWidth: clip.strokeWidth,
        strokeColor: clip.strokeColor, textShadow: clip.textShadow, box: clip.box, boxColor: clip.boxColor,
        boxAlpha: clip.boxAlpha, opacity: clip.opacity, rotate: clip.rotate, x: clip.x, y: clip.y, placed: true, textStyle: clip.textStyle,
      };
    } else if (kind === "anim" && clip) {
      payload = { enter: clip.enter, exit: clip.exit, enterSec: clip.enterSec, exitSec: clip.exitSec, animSpeed: clip.animSpeed };
    } else if (kind === "grade" && clip) {
      payload = clip.grade ?? null;
    } else if (kind === "intro") payload = introCard;
    else if (kind === "ending") payload = endingCard;
    if (payload == null) {
      toast.error("저장할 내용이 없습니다.");
      return;
    }
    const next = [{ id: uid(), label, kind, payload }, ...userPresets.filter((item) => item.label !== label || item.kind !== kind)].slice(0, 40);
    setUserPresets(next);
    writeUserPresets(next);
    toast.success(`"${label}" 프리셋을 저장했습니다.`);
  }

  function applyUserPreset(preset: UserPreset) {
    if (!selected) {
      toast.error("클립을 먼저 고르세요.");
      return;
    }
    if (!preset.payload || typeof preset.payload !== "object") return;
    patch(selected, preset.payload as Partial<Clip>);
  }

  function deleteUserPreset(id: string) {
    const next = userPresets.filter((item) => item.id !== id);
    setUserPresets(next);
    writeUserPresets(next);
  }

  function patch(id: string, partial: Partial<Clip>, keepHistory = true) {
    if (keepHistory) remember();
    setClips((cur) => {
      const prev = cur.find((clip) => clip.id === id);
      const linked = new Set(captionIdsFor(id));
      const next = cur.map((clip) => {
        if (clip.id === id) return { ...clip, ...partial };
        if (!prev || !linked.has(clip.id)) return clip;
        const updated = { ...clip };
        if (partial.start != null) updated.start = Math.max(0, clip.start + (partial.start - prev.start));
        if (partial.duration != null && Math.abs(clip.duration - prev.duration) < 0.25) updated.duration = partial.duration;
        return updated;
      });
      if (!prev || !lengthLockRef.current || filmSecondsRef.current == null) return next;
      const durationChanged = partial.duration != null && Math.abs(partial.duration - prev.duration) > 0.001;
      if (!durationChanged) return next;
      const target = filmSecondsRef.current;
      if (prev.kind === "audio") return trimAudioToTarget(next, target);
      const structural = (prev.kind === "image" || prev.kind === "video") && !prev.pip && (prev.track ?? 0) === 0;
      if (!structural && !prev.title) return next;
      if (structural && prev.kind === "image" && !prev.endingCut) return holdTargetLength(next, target, prev.id);
      return holdTargetLength(next, target);
    });
    requestAnimationFrame(() => draw(timeRef.current));
  }

  function setVideoCaption(id: string, text: string) {
    remember();
    setClips((cur) => {
      const video = cur.find((clip) => clip.id === id);
      if (!video) return cur;
      const capId = `${id}-caption`;
      let found = false;
      const next = cur.map((clip) => {
        if (clip.id === id) return { ...clip, text };
        if (clip.id !== capId) return clip;
        found = true;
        return { ...clip, text, start: video.start, duration: video.duration };
      });
      if (!found && text.trim()) {
        next.push({
          id: capId,
          kind: "text",
          name: "자막",
          track: 2,
          start: video.start,
          duration: video.duration,
          offset: 0,
          text,
          color: "#fffdf8",
          fontSize: 40,
          x: 0.5,
          y: 0.82,
          volume: 0,
          ...FX,
          textMotion: "rise",
          textStyle: "bar",
        });
      }
      return next;
    });
    requestAnimationFrame(() => draw(timeRef.current));
  }

  function remove(id: string) {
    remember();
    const clip = clipsRef.current.find((c) => c.id === id);
    if (clip?.url?.startsWith("blob:")) URL.revokeObjectURL(clip.url);
    videos.current.get(id)?.pause();
    audios.current.get(id)?.pause();
    videos.current.delete(id);
    audios.current.delete(id);
    images.current.delete(id);
    setClips((cur) => {
      const next = cur.filter((c) => c.id !== id);
      if (!clip || !lengthLockRef.current || filmSecondsRef.current == null) return next;
      const structural = (clip.kind === "image" || clip.kind === "video") && !clip.pip && (clip.track ?? 0) === 0;
      if (!structural && !clip.title) return next;
      return holdTargetLength(next, filmSecondsRef.current);
    });
    setSelected((cur) => (cur === id ? null : cur));
    requestAnimationFrame(() => draw(timeRef.current));
  }

  function split() {
    const clip = clipsRef.current.find((c) => c.id === selected);
    const at = timeRef.current;
    if (!clip || at <= clip.start + 0.1 || at >= clip.start + clip.duration - 0.1) return;
    remember();
    const left = at - clip.start;
    const right: Clip = { ...clip, id: uid(), name: `${clip.name} 2`, start: at, duration: clip.duration - left, offset: clip.offset + left };
    setClips((cur) => cur.flatMap((c) => (c.id === clip.id ? [{ ...c, duration: left }, right] : [c])));
    setSelected(right.id);
  }

  function deliveryCheck() {
    const visuals = clips.filter((clip) => clip.kind === "image" || clip.kind === "video");
    const notes: string[] = [];
    if (!visuals.length) notes.push("사진이나 영상이 없습니다.");
    const missing = photos.filter((photo) => !photo.caption.trim()).length;
    if (photos.length && missing) notes.push(`자막이 없는 사진이 ${missing}장입니다.`);
    if (!clips.some((clip) => clip.kind === "audio")) notes.push("배경음악이 없습니다.");
    if (slideshowDuration(clips) < 4) notes.push("영상이 너무 짧습니다.");
    if (!notes.length) toast.success("납품 전 확인을 통과했습니다.");
    else toast.message(notes.join(" "));
  }

  async function saveCut() {
    try {
      const photoIds = new Map<string, string>();
      const photosStored = [];
      for (const photo of photos) {
        const buffer = await (await fetch(photo.url)).arrayBuffer();
        photosStored.push({ id: photo.id, name: photo.name, caption: photo.caption, beat: photo.beat, uploadIndex: photo.uploadIndex, type: "image/jpeg", buffer });
        photoIds.set(photo.url, `photo:${photo.id}`);
      }
      const fileIds = new Map<string, string>();
      const files: VideoProjectRecord["files"] = [];
      for (const clip of clipsRef.current) {
        const extras = [clip.title?.logo, clip.title?.bgImage];
        if (clip.url?.startsWith("blob:") && !photoIds.has(clip.url) && !fileIds.has(clip.url)) {
          const buffer = await (await fetch(clip.url)).arrayBuffer();
          files.push({ key: clip.id, type: clip.kind === "audio" ? "audio/mpeg" : clip.kind === "image" ? "image/jpeg" : "video/mp4", buffer });
          fileIds.set(clip.url, `file:${clip.id}`);
        }
        for (const [index, extra] of extras.entries()) {
          if (!extra?.startsWith("blob:") || photoIds.has(extra) || fileIds.has(extra)) continue;
          const buffer = await (await fetch(extra)).arrayBuffer();
          const key = `${clip.id}-${index === 0 ? "logo" : "bg"}`;
          files.push({ key, type: "image/jpeg", buffer });
          fileIds.set(extra, `file:${key}`);
        }
      }
      const record: VideoProjectRecord = {
        id: uid(),
        projectKey: projectKeyRef.current,
        name: `영상 ${new Date().toLocaleString("ko-KR")}`,
        savedAt: Date.now(),
        photos: photosStored,
        files,
        clips: clipsRef.current.map((clip) => ({
          ...clip,
          url: rewriteClipUrl(clip.url, photoIds, fileIds),
          title: clip.title
            ? { ...clip.title, logo: rewriteClipUrl(clip.title.logo, photoIds, fileIds), bgImage: rewriteClipUrl(clip.title.bgImage, photoIds, fileIds) }
            : undefined,
        })),
      };
      await saveVideoProject(record);
      void rememberMusicUses(projectKeyRef.current, record.name, clipsRef.current.map((clip) => clip.libraryId ?? ""));
      setProjects(await listVideoProjects());
      toast.success("이 브라우저에 영상 버전을 저장했습니다. 음악 위치와 볼륨, 페이드도 같이 남습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "영상 저장에 실패했습니다.");
    }
  }

  async function openCut(id: string) {
    const row = await loadVideoProject(id);
    if (!row) return;
    remember();
    const urls = new Map<string, string>();
    const nextPhotos = row.photos.map((photo, index) => {
      const url = URL.createObjectURL(new Blob([photo.buffer], { type: photo.type || "image/jpeg" }));
      urls.set(`photo:${photo.id}`, url);
      return { id: photo.id, name: photo.name, url, caption: photo.caption, beat: photo.beat as BeatId | undefined, uploadIndex: photo.uploadIndex ?? index };
    });
    for (const file of row.files) {
      urls.set(`file:${file.key}`, URL.createObjectURL(new Blob([file.buffer], { type: file.type })));
    }
    const nextClips = (row.clips as Clip[]).map((clip) => ({
      ...clip,
      url: clip.url && urls.has(clip.url) ? urls.get(clip.url) : clip.url,
      title: clip.title
        ? {
            ...clip.title,
            logo: customerLogo(clip.title.logo && urls.has(clip.title.logo) ? urls.get(clip.title.logo) : clip.title.logo),
            bgImage: clip.title.bgImage && urls.has(clip.title.bgImage) ? urls.get(clip.title.bgImage) : clip.title.bgImage,
          }
        : undefined,
    }));
    const flags = videoPlacementFor(bodyClips(nextClips));
    const placedClips = nextClips.map((clip) => {
      if (clip.videoPlace || clip.kind !== "video") return clip;
      const flag = flags.get(clip.id);
      return flag ? { ...clip, videoPlace: flag.videoPlace, videoAfter: flag.videoAfter } : clip;
    });
    if (row.projectKey) projectKeyRef.current = row.projectKey;
    const refreshed = await refreshSavedMusic(placedClips);
    setPhotos(nextPhotos);
    setClips(refreshed);
    setTime(0);
    timeRef.current = 0;
    toast.success("저장한 영상을 불러왔습니다.");
  }

  async function renderStill(canvas: HTMLCanvasElement, at: number) {
    for (const clip of clipsRef.current) {
      if (clip.kind !== "video" || !clip.url) continue;
      if (at < clip.start || at >= clip.start + clip.duration) continue;
      const el = mediaFor(clip) as HTMLVideoElement | null;
      if (!el) continue;
      const mediaDur = el.duration;
      const elapsed = Math.max(0, at - clip.start);
      let local = mediaOffset(clip.offset, elapsed, clip.duration, clip.speed ?? 1, clip.speedRamp);
      if (clip.loop && Number.isFinite(mediaDur) && mediaDur > 0) local %= mediaDur;
      if (Math.abs(el.currentTime - local) > 0.05) {
        await new Promise<void>((resolve) => {
          const done = () => {
            el.removeEventListener("seeked", done);
            resolve();
          };
          el.addEventListener("seeked", done);
          try { el.currentTime = local; } catch { resolve(); }
          window.setTimeout(resolve, 500);
        });
      }
    }
    draw(at, canvas);
  }

  async function exportMp4() {
    if (exporting || clips.length === 0) return;
    pause();
    setExporting(true);
    const size = EXPORT_SIZES[exportSize];
    const end = Math.max(0.4, slideshowDuration(clipsRef.current));
    try {
      await preloadClipImages(clipsRef.current);
      const fade = musicFadeFor(clipsRef.current);
      const ducks = videoDuckSpans(clipsRef.current);
      const result = await encodeMp4({
        width: size.width,
        height: size.height,
        fps: exportFps,
        duration: end,
        render: renderStill,
        audio: clipsRef.current
          .filter((clip) => {
            if (!clip.url) return false;
            const keyed = (clip.keyframes ?? []).some((key) => (key.volume ?? 0) > 0.001);
            if (clip.kind === "audio") return clip.volume > 0 || keyed;
            if (clip.kind === "video") return clip.audioOn !== false && (clip.volume > 0 || keyed);
            return false;
          })
          .map((clip) => ({
            url: clip.url!,
            start: clip.start,
            duration: clip.duration,
            offset: clip.offset,
            volume: clip.volume,
            loop: clip.loop,
            fadeIn: clip.kind === "audio" ? clip.fadeIn ?? 0 : 0,
            clipFadeOut: clip.kind === "audio" ? clip.fadeOut ?? 0 : 0,
            fadeStart: clip.kind === "audio" ? fade?.fadeStart : undefined,
            fadeOut: clip.kind === "audio" ? fade?.fadeOut : undefined,
            ducks: clip.kind === "audio" ? ducks : undefined,
            playbackRate: clip.speed && clip.speed > 0 ? clip.speed : 1,
            rateFrom: clip.speedRamp && clip.speedRamp.length >= 2 ? clip.speedRamp[0]?.speed : undefined,
            rateTo: clip.speedRamp && clip.speedRamp.length >= 2 ? clip.speedRamp[clip.speedRamp.length - 1]?.speed : undefined,
            volumeKeys: (clip.keyframes ?? []).filter((key) => typeof key.volume === "number").map((key) => ({ t: key.t, v: key.volume ?? 0 })),
          })),
        onProgress: (ratio) => {
          if (Math.round(ratio * 10) !== Math.round((ratio - 0.02) * 10)) {
            toast.message(`MP4 만드는 중 ${Math.round(ratio * 100)}%`, { id: "mp4" });
          }
        },
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(result.blob);
      a.download = `video-${exportSize}-${exportFps}fps.mp4`;
      a.click();
      toast.success(result.audio ? `H.264 MP4 ${exportSize} ${exportFps}fps 파일을 받았습니다.` : `H.264 MP4 ${exportSize}를 받았습니다. 넣을 소리가 없어 영상만 담았습니다.`);
      setExportOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "MP4를 만들지 못했습니다.");
    } finally {
      setExporting(false);
    }
  }

  async function exportVideo() {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;
    pause();
    setExporting(true);
    seek(0);
    await preloadClipImages(clipsRef.current);
    await new Promise((r) => setTimeout(r, 80));
    const stream = canvas.captureStream(30);
    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;
    await ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    for (const clip of clipsRef.current) {
      if ((clip.kind !== "audio" && clip.kind !== "video") || !clip.url || clip.volume <= 0) continue;
      if (clip.kind === "video" && clip.audioOn === false) continue;
      const el = mediaFor(clip);
      if (!el) continue;
      let node = audioNodes.current.get(clip.id);
      if (!node) {
        const source = ctx.createMediaElementSource(el);
        const gain = ctx.createGain();
        source.connect(gain);
        gain.connect(ctx.destination);
        node = { source, gain };
        audioNodes.current.set(clip.id, node);
      }
      node.gain.gain.value = clip.volume;
      node.gain.connect(dest);
    }
    for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
    rec.start(200);
    play();
    const end = Math.max(0.4, slideshowDuration(clipsRef.current));
    await new Promise((r) => setTimeout(r, end * 1000 + 200));
    pause();
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "edit.webm";
    a.click();
    setExporting(false);
  }

  const ruler = useMemo(() => {
    const marks: number[] = [];
    for (let t = 0; t <= duration; t += 1) marks.push(t);
    return marks;
  }, [duration]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#1c150e] text-[#fffaf3]">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <div className="mr-2 flex items-center gap-2">
          <Clapperboard className="size-4 text-[#D4A04E]" />
          <div>
            <p className="text-sm font-bold leading-none">영상편집실</p>
            <p className="mt-1 text-[10px] text-white/50">사진, 영상, 자막, 엔딩컷과 타이틀</p>
          </div>
          <Link to="/studio" className="text-[11px] font-bold text-white/70">편집실</Link>
        </div>
        <label className="relative inline-flex h-8 cursor-pointer items-center gap-1 overflow-hidden rounded-md bg-[#D4A04E] px-3 text-[12px] font-bold text-[#1c150e]">
          <Upload className="size-3.5" /> 사진 · 영상 추가
          <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" multiple className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <button type="button" onClick={makeFromPhotos} className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-3 text-[12px] font-bold text-[#1c150e]">
          <ImagePlus className="size-3.5" /> 영상 만들기
        </button>
        <button type="button" onClick={() => { setDirectorOpen(true); void runDirector(); }} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#fffaf3] px-3 text-[12px] font-bold text-[#1c150e]">감독에게 맡기기</button>
        <Tool onClick={undoEdit}><Undo2 className="size-3.5" /> 취소</Tool>
        <Tool onClick={redoEdit}><Redo2 className="size-3.5" /> 다시</Tool>
        <Tool onClick={addText}><Type className="size-3.5" /> 글자</Tool>
        <Tool onClick={addIntro}>인트로 추가</Tool>
        <Tool onClick={() => removeIntro()}>인트로 삭제</Tool>
        <Tool onClick={split}><Scissors className="size-3.5" /> 분할</Tool>
        <Tool onClick={() => selected && remove(selected)}><Trash2 className="size-3.5" /> 삭제</Tool>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-3 text-[12px] font-bold text-[#1c150e]">
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? "일시정지" : "재생"}
        </button>
        <span className="ml-1 font-mono text-[12px] text-white/70">{fmt(time)} / {fmt(duration)}</span>
        <span className={`font-mono text-[12px] ${lengthGap && lengthGap !== "맞음" ? "text-[#E7B15A]" : "text-white/80"}`}>
          목표 {filmSeconds == null ? "자동" : fmtClock(filmSeconds)} / 현재 {fmtClock(shownLength)}{lengthGap ? ` ${lengthGap}` : ""}
        </span>
        <button type="button" onClick={deliveryCheck} className="inline-flex h-8 items-center rounded-md border border-white/15 px-2.5 text-[12px] font-bold">납품 점검</button>
        <button type="button" onClick={() => void saveCut()} className="inline-flex h-8 items-center rounded-md border border-white/15 px-2.5 text-[12px] font-bold">버전 저장</button>
        <button type="button" onClick={() => void listVideoProjects().then(setProjects)} className="inline-flex h-8 items-center rounded-md border border-white/15 px-2.5 text-[12px] font-bold">불러오기</button>
        <button type="button" disabled={exporting || clips.length === 0} onClick={() => setExportOpen((open) => !open)} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-white/15 px-3 text-[12px] font-bold disabled:opacity-40">
          <Download className="size-3.5" /> {exporting ? "내보내는 중…" : "영상 받기"}
        </button>
      </header>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/10 px-3 py-1.5 text-[12px]">
        <span className="font-bold text-white/50">길이</span>
        {([[null, "자동"], [180, "3분"], [300, "5분"], [600, "10분"]] as const).map(([value, label]) => (
          <button key={label} type="button" onClick={() => chooseLength(value)} className={`rounded-full px-2 py-1 font-bold ${filmSeconds === value ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{label}</button>
        ))}
        <input value={customLength} onChange={(e) => setCustomLength(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyCustomLength(); }} placeholder="4분 30초" aria-label="직접 길이" className="h-7 w-24 rounded bg-white/10 px-2" />
        <button type="button" onClick={applyCustomLength} className={`rounded-full px-2 py-1 font-bold ${filmSeconds != null && filmSeconds !== 180 && filmSeconds !== 300 && filmSeconds !== 600 ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>직접 적용</button>
        <button type="button" onClick={toggleLengthLock} className={`rounded-full px-2 py-1 font-bold ${lengthLock ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{lengthLock ? "길이 고정 해제" : "길이 고정"}</button>
        <span className="text-[11px] text-white/45">{lengthLock ? "인트로·엔딩·영상을 바꿔도 사진 길이만 다시 나눠 목표를 유지합니다." : "길이 고정이 해제되어 전체 길이가 내용에 따라 변합니다."}</span>
      </div>
      {exportOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#2a2118] px-3 py-2 text-[12px]">
          <span className="font-bold text-white/60">형식</span>
          {(["mp4", "webm"] as const).map((format) => (
            <button key={format} type="button" onClick={() => setExportFormat(format)} className={`rounded-full px-2 py-1 font-bold ${exportFormat === format ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{format.toUpperCase()}</button>
          ))}
          {exportFormat === "mp4" ? (
            <>
              <span className="ml-2 font-bold text-white/60">화질</span>
              {(Object.keys(EXPORT_SIZES) as ExportSize[]).map((size) => (
                <button key={size} type="button" onClick={() => setExportSize(size)} className={`rounded-full px-2 py-1 font-bold ${exportSize === size ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{size}</button>
              ))}
              <span className="ml-2 font-bold text-white/60">프레임</span>
              {([30, 60] as const).map((fps) => (
                <button key={fps} type="button" onClick={() => setExportFps(fps)} className={`rounded-full px-2 py-1 font-bold ${exportFps === fps ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{fps}fps</button>
              ))}
            </>
          ) : <span className="text-white/50">기존 WEBM은 미리보기 크기 그대로 받습니다.</span>}
          <button type="button" disabled={exporting} onClick={() => void (exportFormat === "mp4" ? exportMp4() : exportVideo())} className="rounded-md bg-white px-3 py-1 font-bold text-[#1c150e] disabled:opacity-40">
            {exportFormat === "mp4" ? "H.264 MP4 받기" : "WEBM 받기"}
          </button>
        </div>
      ) : null}
      {projects.length ? (
        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2 text-[12px]">
          {projects.map((project) => (
            <button key={project.id} type="button" onClick={() => void openCut(project.id)} className="shrink-0 rounded-md bg-white/10 px-2 py-1 font-bold">{project.name}</button>
          ))}
        </div>
      ) : null}
      <div className="border-b border-white/10 px-3 py-2">
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="font-bold text-white/50">순서</span>
          {([["keep", "원본 유지"], ["manual", "직접 정렬"], ["ai", "AI 재배치"]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => choosePhotoOrder(value)} className={`rounded-full px-2 py-1 font-bold ${photoOrder === value ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{label}</button>
          ))}
          <span className="text-[11px] text-white/45">
            {photoOrder === "ai"
              ? "AI 재배치는 감독에게 맡길 때만 사진 순서를 바꿉니다. 영상은 그 뒤에 붙습니다."
              : photoOrder === "keep"
                ? "업로드한 순서를 유지합니다. 순서를 옮기려면 직접 정렬을 누르세요."
                : "핸들을 끌어 사진 순서를 바꿉니다. 사진을 고른 뒤 미리보기를 끌면 화면 위치도 바뀝니다."}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {photos.length === 0 && !clips.some((clip) => clip.kind === "video") ? (
            <p className="py-2 text-[12px] text-white/45">JPG, PNG 사진과 MP4, MOV, WEBM 영상을 올리면 여기에 보이고, 타임라인에도 바로 들어갑니다.</p>
          ) : null}
          {shelfItems.map((clip) => {
            const photoId = clip.kind === "image" ? bodyPhotoId(clip) : "";
            const photo = photos.find((item) => item.id === photoId);
            const number = clip.kind === "image" && !clip.endingCut ? shelfNumbers.get(clip.id) ?? 0 : 0;
            const others = shelfItems.filter((item) => !item.endingCut && item.id !== orderDrag?.id);
            const marker = orderDrag != null && !clip.endingCut && (others[orderDrag.insertAt]?.id === clip.id || (orderDrag.insertAt >= others.length && others.at(-1)?.id === clip.id && clip.id !== orderDrag.id));
            return (
              <div key={clip.id} data-shelf-card data-shelf-id={clip.id} data-shelf-kind={clip.kind} data-order={number || undefined} data-ending-cut={clip.endingCut ? "1" : undefined} className={`relative w-40 shrink-0 rounded p-1 ${selected === clip.id ? "bg-[#D4A04E]/20 ring-1 ring-[#D4A04E]" : ""} ${orderDrag?.id === clip.id ? "opacity-60" : ""}`}>
                {marker ? <i className={`pointer-events-none absolute top-1 h-14 w-1 rounded bg-[#D4A04E] ${orderDrag && orderDrag.insertAt >= others.length ? "-right-1" : "-left-1"}`} /> : null}
                <div className="relative">
                  {clip.endingCut ? null : (
                    <button type="button" aria-label="순서 이동" className="absolute left-1 top-1 z-10 grid size-6 cursor-grab place-items-center rounded bg-black/65 text-white active:cursor-grabbing" style={{ touchAction: "none" }} onPointerDown={(e) => startReorder(e, clip.id, "shelf")}>
                      <GripVertical className="size-3.5" />
                    </button>
                  )}
                  {number > 0 ? <span className="absolute right-1 top-1 z-10 grid min-w-5 place-items-center rounded bg-[#D4A04E] px-1 text-[10px] font-bold text-[#1c150e]">{number}</span> : null}
                  {clip.kind === "video" ? (
                    <video src={clip.url} muted className="h-14 w-full rounded bg-black object-contain" onClick={() => setSelected(clip.id)} />
                  ) : (
                    <img src={clip.url || photo?.url} alt="" className="h-14 w-full rounded bg-black object-contain" onClick={() => setSelected(clip.id)} />
                  )}
                </div>
                {clip.endingCut ? <span className="mt-1 block text-[11px] font-bold">엔딩컷</span> : clip.kind === "video" ? (
                  <>
                    <span className="mt-1 block truncate text-[11px] font-bold">영상 · {clip.name}</span>
                    <span className="text-[10px] text-white/45">{clip.duration.toFixed(1)}초 · {clip.videoPlace === "manual" ? "직접 배치" : "사진 뒤"}</span>
                  </>
                ) : (
                  <input value={photo?.caption ?? ""} placeholder={`${number}번 자막`} onChange={(e) => setCaption(photoId, e.target.value)} className="mt-1 h-8 w-full rounded bg-white/10 px-2 text-[12px]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <MusicShelf
        canReplace={selectedClip?.kind === "audio"}
        selectedAudio={selectedClip?.kind === "audio" ? {
          name: selectedClip.name,
          volume: selectedClip.volume,
          fadeIn: selectedClip.fadeIn ?? 0,
          fadeOut: selectedClip.fadeOut ?? 0,
          duration: selectedClip.duration,
          start: selectedClip.start,
          pinned: selectedClip.pinned,
        } : null}
        onAdd={(track) => placeBed(track, "add")}
        onReplace={(track) => placeBed(track, "replace")}
        onTracks={setUserBeds}
        onPatch={(partial) => { if (selectedClip?.kind === "audio") patch(selectedClip.id, partial); }}
      />
      {directorOpen ? (
        <div className="max-h-[46vh] overflow-y-auto border-b border-white/10 px-3 py-2 text-[12px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-white/60">길이</span>
            {([[null, "자동"], [180, "3분"], [300, "5분"], [600, "10분"]] as const).map(([value, label]) => (
              <button key={label} type="button" onClick={() => chooseLength(value)} className={`rounded-full px-2 py-1 font-bold ${filmSeconds === value ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{label}</button>
            ))}
            <span className="ml-2 font-bold text-white/60">분위기</span>
            {([["warm", "감동"], ["bold", "강렬"], ["calm", "잔잔"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFilmMood(value)} className={`rounded-full px-2 py-1 font-bold ${filmMood === value ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{label}</button>
            ))}
            <span className="ml-2 font-bold text-white/60">배경음악</span>
            {([["builtin", "기본 음악 사용"], ["library", "내 음악에서 자동 선택"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setMusicPick(value)} className={`rounded-full px-2 py-1 font-bold ${musicPick === value ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{label}</button>
            ))}
            <span className="ml-2 font-bold text-white/60">순서</span>
            {([["keep", "원본 유지"], ["manual", "직접 정렬"], ["ai", "AI 재배치"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => choosePhotoOrder(value)} className={`rounded-full px-2 py-1 font-bold ${photoOrder === value ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{label}</button>
            ))}
            <button type="button" onClick={() => setIntroOn((on) => !on)} className={`rounded-full px-2 py-1 font-bold ${introOn ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>인트로 {introOn ? "켜짐" : "꺼짐"}</button>
            <button type="button" onClick={() => setEndingCutOn((on) => !on)} className={`rounded-full px-2 py-1 font-bold ${endingCutOn ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>엔딩컷 {endingCutOn ? "켜짐" : "꺼짐"}</button>
            <button type="button" onClick={() => setEndingOn((on) => !on)} className={`rounded-full px-2 py-1 font-bold ${endingOn ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>엔딩 타이틀 {endingOn ? "켜짐" : "꺼짐"}</button>
            <button type="button" onClick={() => void runDirector()} className="rounded-md bg-white px-2 py-1 font-bold text-[#1c150e]">이 구성으로 만들기</button>
            <button type="button" onClick={() => setDirectorOpen(false)} className="rounded-md px-2 py-1 text-white/50">접기</button>
          </div>
          <p className="mt-2 text-[11px] text-white/55">
            {planPreview.length
              ? `목표 ${filmSeconds == null ? "자동" : fmtClock(filmSeconds)} / 전체 ${fmt(planNumbers.total)} · 인트로 ${introOn ? fmt(planNumbers.intro) : "없음"} · 본편 ${fmt(planNumbers.body)} · 엔딩컷 ${endingCutOn ? fmt(planNumbers.endingCut) : "없음"} · 엔딩 타이틀 ${endingOn ? fmt(planNumbers.ending) : "없음"}${filmSeconds != null ? ` · ${lengthGapLabel(planNumbers.total, filmSeconds)}` : ""}${endingOn ? " · 엔딩 타이틀에서 배경음악이 0까지 사라집니다" : ""} · 고정한 곡은 감독이 바꾸지 않습니다.`
              : "사진이나 영상을 올리면 인트로, 본편, 엔딩컷, 엔딩 타이틀 순서로 맞춥니다. 전체 길이를 정하면 영상 원본 길이는 유지하고 사진 길이만 나눕니다."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-white/60">템플릿</span>
            {TITLE_TEMPLATES.map((preset) => (
              <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className="rounded-full bg-white/10 px-2 py-1 font-bold">{preset.label}</button>
            ))}
            {savedTemplates.map((preset) => (
              <span key={preset.id} className="inline-flex items-center rounded-full bg-white/10">
                <button type="button" onClick={() => applyPreset(preset)} className="px-2 py-1 font-bold">{preset.label}</button>
                <button type="button" onClick={() => removeTemplate(preset.id)} className="pr-2 text-white/40" aria-label={`${preset.label} 삭제`}>×</button>
              </span>
            ))}
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="내 템플릿 이름" className="h-7 w-32 rounded bg-white/10 px-2" />
            <button type="button" onClick={saveTemplate} className="rounded-md border border-white/15 px-2 py-1 font-bold">이 타이틀 저장</button>
          </div>
          <section className={`mt-3 rounded-md border border-white/10 p-2 ${endingCutOn ? "" : "opacity-50"}`}>
            <p className="mb-2 font-bold">엔딩컷</p>
            {endingCutOn ? (
              <div className="grid gap-2 md:grid-cols-3">
                <label className="block">마지막 장면
                  <select value={endingCutId} onChange={(e) => setEndingCutId(e.target.value)} className="mt-1 h-8 w-full rounded bg-white/10 px-2">
                    <option value="">마지막 사진</option>
                    {cutChoices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <span className="mt-1 block text-[10px] text-white/40">단체사진, 행사장, 짧은 마지막 영상을 고릅니다. 비워 두면 마지막 사진이 엔딩컷이 되어 본편에서는 빠집니다.</span>
                </label>
                <label className="block">표시 시간
                  <input type="number" min={5} max={12} step={0.5} disabled={cutIsVideo} value={endingCutSeconds} onChange={(e) => applyEndingCutLength(Math.min(12, Math.max(5, Number(e.target.value) || 7)))} className="mt-1 h-8 w-full rounded bg-white/10 px-2 disabled:opacity-40" />
                  <span className="mt-1 block text-[10px] text-white/40">{cutIsVideo ? "영상 엔딩컷은 줄이지 않고, 트림한 길이 그대로 재생합니다." : "사진은 5초에서 8초가 무난합니다. 기본 7초."}</span>
                </label>
                <label className="block">엔딩컷 문구
                  <input value={endingCutCaption} onChange={(e) => setEndingCutCaption(e.target.value)} placeholder="함께한 50년" className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
                  <span className="mt-1 block text-[10px] text-white/40">예: 함께한 50년, 우리의 이야기는 계속됩니다</span>
                </label>
              </div>
            ) : <p className="text-white/45">엔딩컷 없이 본편 다음에 엔딩 타이틀로 이어집니다.</p>}
          </section>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <section className={`rounded-md border border-white/10 p-2 ${introOn ? "" : "opacity-50"}`}>
              <p className="mb-2 font-bold">인트로 타이틀</p>
              {introOn ? <TitleFields card={introCard} allowBackgroundImage onChange={commitTitle} onImage={(slot, file) => void pickTitleImage("intro", slot, file)} /> : <p className="text-white/45">인트로 없이 본편부터 시작합니다.</p>}
            </section>
            <section className={`rounded-md border border-white/10 p-2 ${endingOn ? "" : "opacity-50"}`}>
              <p className="mb-2 font-bold">엔딩 타이틀</p>
              {endingOn ? <TitleFields card={endingCard} onChange={commitTitle} onImage={(slot, file) => void pickTitleImage("ending", slot, file)} /> : <p className="text-white/45">엔딩 타이틀 없이 끝납니다. 배경음악도 줄어들지 않습니다.</p>}
            </section>
          </div>
          {planPreview.length ? (
            <div className="mt-3 space-y-1">
              <p className="font-bold text-white/50">이 구성으로 만들면</p>
              {planPreview.filter((clip) => clip.title || clip.kind === "image" || clip.kind === "video").map((clip) => {
                const photoId = clip.id.endsWith("-photo") ? clip.id.slice(0, -"-photo".length) : "";
                const photo = photos.find((item) => item.id === photoId);
                return (
                  <div key={`${clip.id}-${clip.start}`} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] text-white/40">{clip.endingCut ? "엔딩컷" : clip.title ? (clip.title.role === "intro" ? "인트로" : "엔딩") : clip.kind === "video" ? "영상" : "사진"}</span>
                    {photo ? (
                      <select value={photo.beat ?? "event"} onChange={(e) => setPhotos((cur) => cur.map((item) => item.id === photo.id ? { ...item, beat: e.target.value as BeatId } : item))} className="h-7 rounded bg-white/10 px-1">
                        {BEATS.map((beat) => <option key={beat.id} value={beat.id}>{beat.title}</option>)}
                      </select>
                    ) : null}
                    <span className="truncate">{clip.title?.main || photo?.caption || clip.name}</span>
                    <span className="ml-auto text-white/50">{clip.duration.toFixed(1)}초</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-w-0 flex-1 items-center justify-center bg-[#100e0c] p-4">
          <canvas ref={canvasRef} width={1280} height={720} onPointerDown={beginPhotoPlace} className={`max-h-full max-w-full rounded-md bg-black shadow-lg ${selectedClip && !selectedClip.title && !selectedClip.pip && (selectedClip.kind === "image" || selectedClip.kind === "video") ? "cursor-grab" : ""}`} />
        </div>
        <aside className="max-h-72 shrink-0 overflow-y-auto border-t border-white/10 p-3 md:max-h-none md:w-80 md:border-l md:border-t-0">
          <p className="text-[11px] font-bold text-white/50">선택한 클립</p>
          <ProTools safeOn={safeOn} onSafe={setSafeOn} onOverlay={(file) => addOverlay(file)} />
          {selectedClip ? (
            <div className="mt-3 space-y-3 text-[12px]">
              <p className="truncate font-bold">{selectedClip.name}</p>
              <label className="block">시작
                <input type="number" step="0.1" min={0} value={round1(selectedClip.start)} onChange={(e) => patch(selectedClip.id, { start: Number(e.target.value) || 0 })} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
              </label>
              {selectedClip.title ? (
                <>
                  <TitleFields card={selectedClip.title} allowBackgroundImage={selectedClip.title.role === "intro"} onChange={(card) => commitTitle(card, selectedClip.id)} onImage={(slot, file) => void pickTitleImage(selectedClip.title!.role, slot, file, selectedClip.id)} />
                  {selectedClip.title.role === "intro" ? (
                    <div className="flex gap-1">
                      <button type="button" onClick={addIntro} className="rounded bg-white/10 px-2 py-1 text-[11px] font-bold">인트로 추가</button>
                      <button type="button" onClick={() => removeIntro(selectedClip.id)} className="rounded bg-white/10 px-2 py-1 text-[11px] font-bold">이 인트로 삭제</button>
                    </div>
                  ) : null}
                </>
              ) : selectedClip.kind === "video" ? (
                <VideoTrim clip={selectedClip} onChange={(partial) => patch(selectedClip.id, partial)} />
              ) : (
                <label className="block">길이
                  <input type="number" step="0.1" min={0.2} value={round1(selectedClip.duration)} onChange={(e) => patch(selectedClip.id, { duration: Math.max(0.2, Number(e.target.value) || 0.2) })} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
                </label>
              )}
              {(selectedClip.kind === "image" || selectedClip.kind === "video") && !selectedClip.title ? (
                <>
                  {!selectedClip.pip ? (
                    <>
                      <p className="font-bold text-white/70">화면 배치</p>
                      <p className="text-[10px] leading-relaxed text-white/45">이 장면이 보일 때 미리보기를 끌어 옮깁니다. 감독에게 맡겨도 끌어 둔 위치는 남고, 순서는 자동으로 다시 맞춥니다.</p>
                      <label className="block">크기 {((selectedClip.scale ?? 1) * 100).toFixed(0)}%
                        <input type="range" min={0.6} max={2.2} step={0.02} value={selectedClip.placed ? (selectedClip.scale ?? 1) : 1} onChange={(e) => patch(selectedClip.id, { placed: true, scale: Number(e.target.value), x: selectedClip.placed ? selectedClip.x : 0.5, y: selectedClip.placed ? selectedClip.y : 0.5 })} className="mt-1 w-full" />
                      </label>
                      <button type="button" onClick={() => patch(selectedClip.id, { placed: false, scale: 1, x: 0.5, y: 0.5 })} className="rounded bg-white/10 px-2 py-1 text-[11px] font-bold">자동 위치</button>
                    </>
                  ) : null}
                  <p className="font-bold text-white/70">영상 효과</p>
                  <EffectLine label="색" active={(selectedClip.look ?? "none") !== "none"} name={LOOKS.find((item) => item.id === (selectedClip.look ?? "none"))?.label ?? "원본"} onAdd={() => patch(selectedClip.id, { look: "warm", grade: undefined })} onRemove={() => patch(selectedClip.id, { look: "none", grade: undefined })} />
                  {(selectedClip.look ?? "none") !== "none" ? <Chips label="색 고르기" value={selectedClip.look ?? "none"} options={LOOKS.filter((item) => item.id !== "none")} onChange={(look) => patch(selectedClip.id, { look, grade: undefined })} /> : null}
                  <EffectLine label="움직임" active={(selectedClip.motion ?? "none") !== "none"} name={MOTIONS.find((item) => item.id === (selectedClip.motion ?? "none"))?.label ?? "고정"} onAdd={() => patch(selectedClip.id, { motion: "slow-zoom" })} onRemove={() => patch(selectedClip.id, { motion: "none" })} />
                  {(selectedClip.motion ?? "none") !== "none" ? <Chips label="움직임 고르기" value={selectedClip.motion ?? "none"} options={MOTIONS.filter((item) => item.id !== "none")} onChange={(motion) => patch(selectedClip.id, { motion })} /> : null}
                  <EffectLine label="전환" active={(selectedClip.transition ?? "none") !== "none"} name={TRANSITIONS.find((item) => item.id === (selectedClip.transition ?? "fade"))?.label ?? "없음"} onAdd={() => patch(selectedClip.id, { transition: "fade", transitionSec: selectedClip.transitionSec ?? 0.6 })} onRemove={() => patch(selectedClip.id, { transition: "none" })} />
                  {(selectedClip.transition ?? "none") !== "none" ? <Chips label="전환 고르기" value={selectedClip.transition ?? "fade"} options={TRANSITIONS.filter((item) => item.id !== "none")} onChange={(transition) => patch(selectedClip.id, { transition, transitionSec: selectedClip.transitionSec ?? 0.6 })} /> : null}
                </>
              ) : null}
              {selectedClip.kind === "text" && !selectedClip.title ? (
                <>
                  <label className="block">문구
                    <textarea value={selectedClip.text} onChange={(e) => patch(selectedClip.id, { text: e.target.value })} className="mt-1 h-20 w-full rounded bg-white/10 p-2" />
                  </label>
                  <label className="block">크기 {selectedClip.fontSize}
                    <input type="range" min={24} max={160} value={selectedClip.fontSize} onChange={(e) => patch(selectedClip.id, { fontSize: Number(e.target.value) })} className="mt-1 w-full" />
                  </label>
                  <label className="flex items-center justify-between">색
                    <input type="color" value={selectedClip.color} onChange={(e) => patch(selectedClip.id, { color: e.target.value })} />
                  </label>
                  <Chips label="등장" value={selectedClip.textMotion ?? "rise"} options={TEXT_MOTIONS} onChange={(textMotion) => patch(selectedClip.id, { textMotion })} />
                  <Chips label="스타일" value={selectedClip.textStyle ?? "body"} options={TEXT_STYLES} onChange={(textStyle) => patch(selectedClip.id, { textStyle })} />
                  <Chips label="위치" value={selectedClip.y < 0.35 ? "top" : selectedClip.y > 0.7 ? "bottom" : "middle"} options={[{ id: "top", label: "위" }, { id: "middle", label: "가운데" }, { id: "bottom", label: "아래" }]} onChange={(place) => patch(selectedClip.id, { y: place === "top" ? 0.18 : place === "middle" ? 0.5 : 0.86 })} />
                </>
              ) : null}
              {selectedClip.kind === "video" ? (
                <>
                  <button type="button" onClick={() => patch(selectedClip.id, { audioOn: selectedClip.audioOn === false })} className={`rounded px-2 py-1 text-[11px] font-bold ${selectedClip.audioOn === false ? "bg-white/10" : "bg-[#D4A04E] text-[#1c150e]"}`}>원음 {selectedClip.audioOn === false ? "꺼짐" : "켜짐"}</button>
                  <label className="block">볼륨 {Math.round(selectedClip.volume * 100)}%
                    <input type="range" min={0} max={1} step={0.05} value={selectedClip.volume} onChange={(e) => patch(selectedClip.id, { volume: Number(e.target.value) })} className="mt-1 w-full" />
                  </label>
                  <label className="block">자막
                    <textarea value={clips.find((clip) => clip.id === `${selectedClip.id}-caption`)?.text || selectedClip.text} onChange={(e) => setVideoCaption(selectedClip.id, e.target.value)} className="mt-1 h-16 w-full rounded bg-white/10 p-2" />
                  </label>
                  <p className="text-[10px] leading-relaxed text-white/45">원음을 켜면 그 구간만 배경음악이 낮아졌다가 영상이 끝나면 돌아옵니다. 앞뒤 장면과는 크로스페이드로 이어지고, 타임라인에서 자리를 옮길 수 있습니다. 감독에게 맡기면 영상 길이는 줄이지 않습니다.</p>
                </>
              ) : null}
              {selectedClip.kind === "audio" ? (
                <>
                  <label className="block">소리 {Math.round(selectedClip.volume * 100)}%
                    <input type="range" min={0} max={1} step={0.05} value={selectedClip.volume} onChange={(e) => patch(selectedClip.id, { volume: Number(e.target.value) })} className="mt-1 w-full" />
                  </label>
                  <label className="block">Fade In {(selectedClip.fadeIn ?? 0).toFixed(1)}초
                    <input type="range" min={0} max={4} step={0.1} value={selectedClip.fadeIn ?? 0} onChange={(e) => patch(selectedClip.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full" />
                  </label>
                  <label className="block">Fade Out {(selectedClip.fadeOut ?? 0).toFixed(1)}초
                    <input type="range" min={0} max={6} step={0.1} value={selectedClip.fadeOut ?? 0} onChange={(e) => patch(selectedClip.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full" />
                  </label>
                  <button type="button" onClick={() => patch(selectedClip.id, { pinned: !selectedClip.pinned })} className={`rounded px-2 py-1 text-[11px] font-bold ${selectedClip.pinned ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{selectedClip.pinned ? "이 음악 고정됨" : "이 음악 고정"}</button>
                  <p className="text-[10px] leading-relaxed text-white/45">영상 원음이 켜진 구간에서는 배경음악이 낮아집니다. 곡이 겹치면 크로스페이드로 이어집니다. 고정한 곡은 감독에게 맡길 때 바뀌지 않습니다.</p>
                </>
              ) : null}
              <ProPanel
                clip={selectedClip}
                time={time}
                fonts={extraFonts}
                presets={userPresets}
                onPatch={(partial) => patch(selectedClip.id, partial as Partial<Clip>)}
                onSavePreset={saveUserPreset}
                onApplyPreset={applyUserPreset}
                onDeletePreset={deleteUserPreset}
                onApplyTitle={(role, payload) => {
                  if (!payload || typeof payload !== "object") return;
                  remember();
                  const card = payload as TitleCard;
                  if (role === "intro") setIntroCard(card);
                  else setEndingCard(card);
                  const existing = clipsRef.current.find((item) => item.title?.role === role);
                  if (existing) patch(existing.id, { title: card, text: card.main, duration: card.seconds }, false);
                  toast.success(role === "intro" ? "인트로 프리셋을 적용했습니다." : "엔딩 프리셋을 적용했습니다.");
                }}
              />
            </div>
          ) : <p className="mt-3 text-[12px] leading-relaxed text-white/45">영상, 사진, 소리를 가져오거나 글자를 추가하세요. 스페이스로 재생합니다.</p>}
        </aside>
      </div>
      <div className="h-52 shrink-0 border-t border-white/10 bg-[#241c15]">
        <div className="flex flex-wrap items-center gap-3 px-3 py-1.5 text-[11px] text-white/50">
          <span>타임라인</span>
          <span className={`font-mono ${lengthGap && lengthGap !== "맞음" ? "text-[#E7B15A]" : "text-white/75"}`}>
            목표 {filmSeconds == null ? "자동" : fmtClock(filmSeconds)} / 현재 {fmtClock(shownLength)}{lengthGap ? ` ${lengthGap}` : ""}
          </span>
          <input type="range" min={36} max={140} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="타임라인 확대" />
        </div>
        <div className="h-[168px] overflow-auto px-3 pb-3" onClick={(e) => {
          const row = (e.target as HTMLElement).closest("[data-ruler]") as HTMLElement | null;
          if (!row) return;
          const rect = row.getBoundingClientRect();
          seek((e.clientX - rect.left + row.scrollLeft) / zoom);
        }}>
          <div className="relative" style={{ width: duration * zoom + 40 }} data-ruler>
            <div className="relative h-5">
              {ruler.map((t) => <span key={t} className="absolute top-0 text-[10px] text-white/35" style={{ left: t * zoom }}>{t}s</span>)}
            </div>
            {TRACKS.map((track) => (
              <div key={track.id} className="relative mb-1 h-8 rounded bg-black/30">
                <span className="pointer-events-none absolute left-1 top-1 text-[9px] text-white/30">{track.label}</span>
                {track.id === 0 && orderDrag ? <i className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-[#D4A04E]" style={{ left: timelineMarkerLeft(bodyClips(clips), orderDrag, zoom) }} /> : null}
                {clips.filter((c) => c.track === track.id).map((clip) => (
                  <button key={clip.id} type="button" data-timeline-id={clip.id} data-kind={clip.kind} data-track={clip.track} data-start={clip.start} data-duration={clip.duration} data-ending-cut={clip.endingCut ? "1" : undefined} data-title={clip.title?.role} onClick={(e) => { e.stopPropagation(); setSelected(clip.id); }} onPointerDown={(e) => { e.stopPropagation(); if (canReorder(clip)) startReorder(e, clip.id, "timeline"); else dragClip(e, clip, zoom, patch, remember); }} className={`absolute top-1 h-6 truncate rounded px-2 text-left text-[10px] font-bold ${selected === clip.id ? "bg-[#D4A04E] text-[#1c150e]" : clip.endingCut ? "bg-[#d7a15a] text-[#1c150e]" : clip.title ? "bg-[#e6c98a] text-[#1c150e]" : "bg-[#6b4a28] text-[#fffaf3]"}`} style={{ left: clip.start * zoom, width: Math.max(18, clip.duration * zoom) }}>
                    {clip.endingCut ? "엔딩컷" : clip.title ? `${clip.title.role === "intro" ? "인트로" : "엔딩"} ${clip.title.main}` : clip.kind === "text" ? clip.text : clip.name}
                  </button>
                ))}
              </div>
            ))}
            <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-[#D4A04E]" style={{ left: time * zoom }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function captionIdsFor(id: string) {
  const ids = [`${id}-caption`];
  if (id.endsWith("-photo")) {
    const base = id.slice(0, "-photo".length * -1);
    ids.push(`${base}-caption`, `${base}-ending-caption`);
  }
  return ids;
}

function VideoTrim({ clip, onChange }: { clip: Clip; onChange: (partial: Partial<Clip>) => void }) {
  const mediaLength = clip.sourceDuration && clip.sourceDuration > 0 ? clip.sourceDuration : clip.offset + clip.duration;
  const setOffset = (value: number) => {
    const offset = Math.min(Math.max(0, value), Math.max(0, mediaLength - 0.4));
    onChange({ offset, duration: Math.min(clip.duration, Math.max(0.4, mediaLength - offset)), sourceDuration: clip.sourceDuration ?? mediaLength });
  };
  const setDuration = (value: number) => {
    onChange({ duration: Math.min(Math.max(0.4, value), Math.max(0.4, mediaLength - clip.offset)), sourceDuration: clip.sourceDuration ?? mediaLength });
  };
  return (
    <>
      <p className="text-[11px] text-white/50">원본 {fmt(mediaLength)}</p>
      <label className="block">트림 시작
        <input type="number" step="0.1" min={0} max={round1(Math.max(0, mediaLength - 0.4))} value={round1(clip.offset)} onChange={(e) => setOffset(Number(e.target.value) || 0)} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
      </label>
      <label className="block">재생 길이
        <input type="number" step="0.1" min={0.4} value={round1(clip.duration)} onChange={(e) => setDuration(Number(e.target.value) || 0.4)} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
      </label>
    </>
  );
}

function imageClip(id: string, name: string, url: string, start: number, caption: string): Clip {
  return {
    id: `${id}-photo`,
    kind: "image",
    name,
    url,
    track: 0,
    start,
    duration: 4,
    offset: 0,
    text: caption,
    color: "#fffdf8",
    fontSize: 54,
    x: 0.5,
    y: 0.86,
    volume: 0,
    ...FX,
    motion: "slow-zoom",
    frame: "blur",
  };
}

async function readableImageUrl(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

function keepPhotoPlacement<T extends { id: string; kind: string }>(planned: T[], previous: Clip[]) {
  const placed = new Map<string, Clip>();
  for (const clip of previous) {
    if (clip.kind !== "image" || !clip.placed || clip.pip || clip.endingCut) continue;
    placed.set(bodyPhotoId(clip), clip);
  }
  return planned.map((clip) => {
    if (clip.kind !== "image") return clip;
    const prev = placed.get(bodyPhotoId(clip));
    if (!prev) return clip;
    return { ...clip, placed: true as const, x: prev.x, y: prev.y, scale: prev.scale ?? 1 };
  });
}

function paintPicture(ctx: CanvasRenderingContext2D, source: CanvasImageSource & { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number }, w: number, h: number, clip: Clip, local: number, blur = 0) {
  const sw = source.videoWidth || source.naturalWidth || w;
  const sh = source.videoHeight || source.naturalHeight || h;
  const vertical = sh > sw * 1.05;
  let motionName = clip.motion;
  if (!clip.pip && vertical && motionName !== "face-focus" && motionName !== "none") motionName = "slow-zoom";
  const elapsed = local * Math.max(0.001, clip.duration);
  const keys = motionKeys(motionName, clip.duration);
  const motion = sampleNumber(keys, elapsed, "scale", 1);
  const panX = sampleNumber(keys, elapsed, "x", 0) * w;
  const panY = sampleNumber(keys, elapsed, "y", 0) * h;
  const manual = Boolean(clip.placed) && !clip.pip;
  const baseScale = manual ? (clip.scale ?? 1) : 1;
  const userScale = sampleNumber(clip.keyframes, elapsed, "scale", clip.pip ? (clip.scale ?? 0.28) : baseScale);
  const rot = sampleNumber(clip.keyframes, elapsed, "rotate", clip.rotate ?? 0) * Math.PI / 180;
  const grade = clip.grade ? gradeToFilter(clip.grade) : lookFilter(clip.look ?? "none");
  const filter = [grade === "none" ? "" : grade, blur > 0.2 ? `blur(${blur}px)` : ""].filter(Boolean).join(" ") || "none";
  if (clip.pip) {
    const dw = w * userScale;
    const dh = sh > 0 ? dw * (sh / sw) : dw;
    const cx = sampleNumber(clip.keyframes, elapsed, "x", clip.x) * w;
    const cy = sampleNumber(clip.keyframes, elapsed, "y", clip.y) * h;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.filter = filter;
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = clip.pipShadow ?? 18;
    ctx.beginPath();
    roundRect(ctx, -dw / 2, -dh / 2, dw, dh, clip.radius ?? 16);
    ctx.fillStyle = "rgba(0,0,0,.2)";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.clip();
    ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return;
  }
  const frame = clip.frame ?? "blur";
  const hasPos = !manual && (clip.keyframes ?? []).some((key) => key.x != null || key.y != null);
  const ux = manual ? ((clip.x ?? 0.5) - 0.5) * w : hasPos ? (sampleNumber(clip.keyframes, elapsed, "x", clip.x) - 0.5) * w : 0;
  const uy = manual ? ((clip.y ?? 0.5) - 0.5) * h : hasPos ? (sampleNumber(clip.keyframes, elapsed, "y", clip.y) - 0.5) * h : 0;
  if (frame === "blur") {
    ctx.save();
    ctx.filter = "blur(26px) saturate(1.12) brightness(0.7)";
    cover(ctx, source, w, h);
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.save();
  ctx.filter = filter;
  ctx.translate(w / 2 + panX + ux, h / 2 + panY + uy);
  ctx.rotate(rot);
  ctx.scale(motion * userScale, motion * userScale);
  ctx.translate(-w / 2, -h / 2);
  if (frame === "cover") cover(ctx, source, w, h);
  else contain(ctx, source, w, h);
  ctx.restore();
}

function lookFilter(look: Look) {
  if (look === "warm") return "sepia(0.4) saturate(1.25)";
  if (look === "cool") return "hue-rotate(18deg) saturate(0.85) brightness(1.05)";
  if (look === "mono") return "grayscale(1) contrast(1.05)";
  if (look === "vintage") return "sepia(0.55) contrast(0.95) brightness(1.05)";
  if (look === "vivid") return "saturate(1.5) contrast(1.08)";
  return "none";
}

function paintText(ctx: CanvasRenderingContext2D, clip: Clip, w: number, h: number, local: number) {
  const full = clip.text.trim();
  if (!full) return;
  const style = clip.textStyle ?? "body";
  const elapsed = Math.max(0, local * clip.duration);
  const enter = clip.enter ?? legacyEnter(clip.textMotion);
  const exit = clip.exit ?? "none";
  const explicit = clip.enter != null;
  const anim = textAnimState({
    enter,
    exit,
    elapsed,
    duration: clip.duration,
    enterSec: clip.enterSec ?? (clip.textMotion === "type" ? 0.7 : 0.45),
    exitSec: clip.exitSec ?? 0.35,
    speed: clip.animSpeed ?? 1,
  });
  if (!explicit && elapsed < 0.02) {
    anim.alpha = 1;
    anim.dx = 0;
    anim.dy = 0;
    anim.scale = 1;
    anim.blur = 0;
    anim.reveal = 1;
  }
  const shown = anim.reveal < 0.999 ? full.slice(0, Math.max(enter === "typewriter" ? 0 : 1, Math.ceil(full.length * anim.reveal))) : full;
  if (!shown) return;
  const legacy = !clip.placed && !clip.font && clip.strokeWidth == null && clip.box == null && clip.textShadow == null;
  const fontSize = legacy
    ? (style === "year" ? Math.max(clip.fontSize, 64) : style === "ending" ? Math.max(52, Math.min(clip.fontSize, 68)) : Math.min(clip.fontSize, 46))
    : clip.fontSize;
  const weight = clip.fontWeight ?? (style === "year" || style === "ending" ? 800 : 700);
  const family = fontFamily(clip.font);
  const lineHeight = clip.lineHeight ?? 1.2;
  const align = clip.align ?? "center";
  const box = clip.box ?? (style === "body" || style === "bar");
  const stroke = clip.strokeWidth ?? (style === "outline" || style === "year" ? Math.max(4, fontSize / 14) : 0);
  const shadow = clip.textShadow ?? (style === "shadow" || style === "ending" ? 16 : 0);
  const opacity = (clip.opacity ?? 1) * anim.alpha;
  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, opacity));
  if (anim.blur > 0.2) ctx.filter = `blur(${anim.blur}px)`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${fontSize}px ${family}`;
  const spacing = clip.letterSpacing ?? 0;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${spacing}px`;
  const maxWidth = w * 0.78;
  const lines = wrapMeasured(ctx, shown, maxWidth);
  const lineH = fontSize * lineHeight;
  const block = lines.length * lineH;
  let anchorX = w * clip.x + anim.dx;
  let anchorY = h * clip.y + anim.dy;
  if (!clip.placed) {
    anchorX = w * 0.5 + anim.dx;
    anchorY = h * 0.8 + anim.dy;
    if (clip.name === "인트로" || clip.name === "인트로 타이틀") anchorY = h * 0.5 + anim.dy;
    else if (clip.name === "엔딩" || clip.name === "엔딩 타이틀") anchorY = h * 0.52 + anim.dy;
    else if (style === "year") anchorY = h * 0.62 + anim.dy;
    if (anchorY + block / 2 > h * 0.9) anchorY = h * 0.9 - block / 2;
  }
  ctx.translate(anchorX, anchorY);
  ctx.rotate(((clip.rotate ?? 0) * Math.PI) / 180);
  ctx.scale(anim.scale, anim.scale);
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);
  const boxW = Math.min(maxWidth, widest + 48);
  const left = align === "left" ? 0 : align === "right" ? -boxW : -boxW / 2;
  if (box) {
    const alpha = clip.boxAlpha ?? 0.55;
    ctx.fillStyle = hexAlpha(clip.boxColor ?? "#000000", alpha);
    ctx.fillRect(left, -block / 2 - 8, boxW, block + 16);
  }
  if (shadow > 0) {
    ctx.shadowColor = "rgba(0,0,0,.7)";
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = Math.min(6, shadow / 5);
  }
  lines.forEach((line, index) => {
    const y = -block / 2 + lineH * index + lineH / 2;
    const x = align === "left" ? 24 : align === "right" ? -24 : 0;
    ctx.fillStyle = style === "year" && clip.color === "#fffdf8" ? "#fff6df" : clip.color;
    if (stroke > 0) {
      ctx.lineWidth = stroke;
      ctx.strokeStyle = clip.strokeColor ?? "#1c150e";
      ctx.strokeText(line, x, y);
    }
    ctx.fillText(line, x, y);
  });
  ctx.restore();
}

function hexAlpha(hex: string, alpha: number) {
  const raw = hex.replace("#", "");
  const value = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  if (![r, g, b].every((part) => Number.isFinite(part))) return `rgba(0,0,0,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function paintSafe(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
  ctx.strokeStyle = "rgba(212,160,78,.9)";
  ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
  ctx.font = "600 18px \"Pretendard Variable\", \"Noto Sans KR\", sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText("Action Safe", w * 0.05 + 10, h * 0.05 + 22);
  ctx.fillStyle = "#D4A04E";
  ctx.fillText("Title Safe", w * 0.1 + 10, h * 0.1 + 22);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapMeasured(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (ctx.measureText(clean).width <= maxWidth) return [clean];
  const units = clean.includes(" ") ? clean.split(" ") : [...clean];
  const joiner = clean.includes(" ") ? " " : "";
  let line = "";
  const lines: string[] = [];
  for (const unit of units) {
    const next = line ? line + joiner + unit : unit;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = unit;
      if (lines.length === 2) break;
    } else line = next;
  }
  if (lines.length < 2 && line) lines.push(line);
  if (lines.length === 2 && ctx.measureText(lines[1] ?? "").width > maxWidth) {
    let fitted = lines[1] ?? "";
    while (fitted.length > 1 && ctx.measureText(`${fitted}…`).width > maxWidth) fitted = fitted.slice(0, -1);
    lines[1] = `${fitted}…`;
  }
  return lines.slice(0, 2);
}

function EffectLine({ label, active, name, onAdd, onRemove }: { label: string; active: boolean; name: string; onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/70">{label}</span>
      {active ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A04E] px-2 py-1 text-[11px] font-bold text-[#1c150e]">
          {name}
          <button type="button" onClick={onRemove} aria-label={`${label} 삭제`}>삭제</button>
        </span>
      ) : (
        <button type="button" onClick={onAdd} className="rounded bg-white/10 px-2 py-1 text-[11px] font-bold">{label} 추가</button>
      )}
    </div>
  );
}

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (id: T) => void }) {
  return (
    <div>
      <p className="text-[11px] text-white/50">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((option) => (
          <button key={option.id} type="button" onClick={() => onChange(option.id)} className={`rounded px-2 py-1 text-[11px] font-bold ${value === option.id ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{option.label}</button>
        ))}
      </div>
    </div>
  );
}

const LOOKS: { id: Look; label: string }[] = [
  { id: "none", label: "원본" },
  { id: "warm", label: "따뜻" },
  { id: "cool", label: "차갑" },
  { id: "mono", label: "흑백" },
  { id: "vintage", label: "빈티지" },
  { id: "vivid", label: "선명" },
];
const MOTIONS: { id: Motion; label: string }[] = [
  { id: "none", label: "고정" },
  { id: "zoom-in", label: "확대" },
  { id: "slow-zoom", label: "천천히 확대" },
  { id: "face-focus", label: "얼굴 확대" },
  { id: "zoom-out", label: "축소" },
  { id: "pan-left", label: "왼쪽" },
  { id: "pan-right", label: "오른쪽" },
];
const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: "fade", label: "Cross Fade" },
  { id: "black", label: "Dip to Black" },
  { id: "white", label: "Dip to White" },
  { id: "push", label: "Push" },
  { id: "zoom", label: "Zoom" },
  { id: "blur", label: "Blur" },
  { id: "wipe", label: "Wipe" },
  { id: "none", label: "없음" },
];
const TEXT_MOTIONS: { id: TextMotion; label: string }[] = [
  { id: "none", label: "없음" },
  { id: "fade", label: "페이드" },
  { id: "pop", label: "팝" },
  { id: "rise", label: "올라오기" },
  { id: "type", label: "타자" },
];
const TEXT_STYLES: { id: TextStyle; label: string }[] = [
  { id: "body", label: "설명" },
  { id: "year", label: "연도 제목" },
  { id: "ending", label: "엔딩" },
  { id: "bar", label: "자막바" },
  { id: "outline", label: "외곽선" },
  { id: "shadow", label: "그림자" },
  { id: "plain", label: "기본" },
];

function Tool({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded-md border border-white/15 px-2.5 text-[12px] font-bold">{children}</button>;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function contain(ctx: CanvasRenderingContext2D, source: CanvasImageSource & { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number }, w: number, h: number) {
  const sw = source.videoWidth || source.naturalWidth || w;
  const sh = source.videoHeight || source.naturalHeight || h;
  const scale = Math.min(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function cover(ctx: CanvasRenderingContext2D, source: CanvasImageSource & { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number }, w: number, h: number) {
  const sw = source.videoWidth || source.naturalWidth || w;
  const sh = source.videoHeight || source.naturalHeight || h;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function isEditorMedia(file: File) {
  const type = (file.type || "").toLowerCase();
  if (type === "image/jpeg" || type === "image/png" || type === "video/mp4" || type === "video/quicktime" || type === "video/webm") return true;
  return /\.(jpe?g|png|mp4|mov|webm)$/i.test(file.name);
}

function probe(url: string, kind: Kind) {
  return new Promise<number>((resolve) => {
    const el = document.createElement(kind === "audio" ? "audio" : "video");
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 5);
    el.onerror = () => resolve(5);
  });
}

function canReorder(clip: Clip) {
  return (clip.kind === "image" || clip.kind === "video") && !clip.pip && !clip.title && !clip.endingCut && (clip.track ?? 0) === 0;
}

function bodyClips(list: Clip[], withEnding = false) {
  return list
    .filter((clip) => (clip.kind === "image" || clip.kind === "video") && !clip.pip && !clip.title && (clip.track ?? 0) === 0 && (withEnding || !clip.endingCut))
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

function shelfInsert(clientX: number, excludeId: string) {
  const cards = [...document.querySelectorAll<HTMLElement>("[data-shelf-card]")].filter((card) => card.dataset.endingCut !== "1" && card.dataset.shelfId !== excludeId);
  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index]!.getBoundingClientRect();
    if (clientX < rect.left + rect.width / 2) return index;
  }
  return cards.length;
}

function timelineInsert(clientX: number, zoom: number, body: Clip[], excludeId: string) {
  const row = document.querySelector("[data-ruler]");
  if (!row) return 0;
  const x = clientX - row.getBoundingClientRect().left;
  const others = body.filter((clip) => clip.id !== excludeId && !clip.endingCut);
  for (let index = 0; index < others.length; index += 1) {
    const clip = others[index]!;
    if (x < (clip.start + clip.duration / 2) * zoom) return index;
  }
  return others.length;
}

function timelineMarkerLeft(body: Clip[], drag: { id: string; insertAt: number }, zoom: number) {
  const others = body.filter((clip) => clip.id !== drag.id && !clip.endingCut);
  const clip = others[drag.insertAt];
  if (clip) return clip.start * zoom;
  const last = others.at(-1);
  return last ? (last.start + last.duration) * zoom : 0;
}

function dragClip(e: ReactPointerEvent, clip: Clip, zoom: number, patch: (id: string, partial: Partial<Clip>, keepHistory?: boolean) => void, onStart: () => void) {
  if (e.button !== 0) return;
  const startX = e.clientX;
  const origin = clip.start;
  let started = false;
  const move = (ev: PointerEvent) => {
    if (!started) {
      started = true;
      onStart();
    }
    patch(clip.id, { start: Math.max(0, origin + (ev.clientX - startX) / zoom) }, false);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
