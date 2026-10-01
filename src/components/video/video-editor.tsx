import { Link } from "@tanstack/react-router";
import { Clapperboard, Pause, Play, Scissors, Trash2, Type, Upload, Download, ImagePlus, Undo2, Redo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { fileKind, FX, planSlideshow, slideshowDuration, type Look, type MediaKind, type Motion, type TextMotion, type TextStyle, type Transition } from "@/lib/video/slideshow";
import { BEATS, directClips, fitDurations, keepUserOrder, type BeatId } from "@/lib/video/director";
import { MUSIC, MUSIC_CATEGORIES, type MusicTrack } from "@/lib/video/music";
import { EXPORT_SIZES, type ExportFps, type ExportSize } from "@/lib/video/export-presets";
import { encodeMp4 } from "@/lib/video/mp4-export";
import { listVideoProjects, loadVideoProject, rewriteClipUrl, saveVideoProject, type VideoProjectRecord } from "@/lib/video/project-db";

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
  loop?: boolean;
  library?: boolean;
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

type PhotoCard = { id: string; name: string; url: string; caption: string; beat?: BeatId };
type EditSnapshot = { clips: Clip[]; photos: PhotoCard[] };

export function VideoEditor() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [photos, setPhotos] = useState<PhotoCard[]>([]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(72);
  const [exporting, setExporting] = useState(false);
  const [musicCategory, setMusicCategory] = useState(MUSIC_CATEGORIES[0] ?? "잔잔");
  const [directorOpen, setDirectorOpen] = useState(false);
  const [filmSeconds, setFilmSeconds] = useState<number | null>(180);
  const [filmMood, setFilmMood] = useState<"warm" | "bold" | "calm">("warm");
  const [photoOrder, setPhotoOrder] = useState<"keep" | "story">("keep");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"mp4" | "webm">("mp4");
  const [exportSize, setExportSize] = useState<ExportSize>("1080p");
  const [exportFps, setExportFps] = useState<ExportFps>(30);
  const [projects, setProjects] = useState<Pick<VideoProjectRecord, "id" | "name" | "savedAt">[]>([]);
  const [past, setPast] = useState<EditSnapshot[]>([]);
  const [future, setFuture] = useState<EditSnapshot[]>([]);
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
  clipsRef.current = clips;
  photosRef.current = photos;
  timeRef.current = time;
  playingRef.current = playing;

  const duration = slideshowDuration(clips);
  const selectedClip = clips.find((c) => c.id === selected) ?? null;

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
        el.src = clip.url;
        el.preload = "auto";
        audios.current.set(clip.id, el);
      }
      return el;
    }
    return null;
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
    for (const clip of list) {
      if (clip.kind === "audio") continue;
      if (at < clip.start || at >= clip.start + clip.duration) continue;
      const local = clip.duration > 0 ? (at - clip.start) / clip.duration : 0;
      const fade = clip.transition === "fade" && local > 0 && local < 1 ? Math.min(1, local / 0.12, (1 - local) / 0.12) : 1;
      const slide = clip.transition === "slide" && local > 0 && local < 0.22 ? (1 - local / 0.22) * designW * 0.18 : 0;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(slide, 0);
      if (clip.kind === "image" && clip.url) {
        let img = images.current.get(clip.id);
        if (!img) {
          img = new Image();
          img.onload = () => draw(timeRef.current);
          img.src = clip.url;
          images.current.set(clip.id, img);
        }
        if (img.complete && img.naturalWidth) paintPicture(ctx, img, designW, designH, clip, local);
        if (clip.text) paintText(ctx, clip, designW, designH, local);
      }
      if (clip.kind === "video") {
        const video = mediaFor(clip) as HTMLVideoElement | null;
        if (video && video.readyState >= 2) paintPicture(ctx, video, designW, designH, clip, local, true);
      }
      if (clip.kind === "text" && clip.text) paintText(ctx, clip, designW, designH, local);
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function sync(at: number, shouldPlay: boolean) {
    for (const clip of clipsRef.current) {
      if (clip.kind !== "video" && clip.kind !== "audio") continue;
      const el = mediaFor(clip);
      if (!el) continue;
      const active = at >= clip.start && at < clip.start + clip.duration;
      const mediaDur = el.duration;
      let local = clip.offset + Math.max(0, at - clip.start);
      if (clip.loop && Number.isFinite(mediaDur) && mediaDur > 0) local %= mediaDur;
      el.loop = Boolean(clip.loop);
      el.volume = Math.min(1, Math.max(0, clip.volume));
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
      if (tag === "INPUT" || tag === "TEXTAREA") return;
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
      if (clip.kind !== "image" || !clip.url || images.current.has(clip.id)) continue;
      const img = new Image();
      img.onload = () => draw(timeRef.current);
      img.src = clip.url;
      images.current.set(clip.id, img);
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

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    remember();
    const incoming = Array.from(files);
    const photosNext: PhotoCard[] = [];
    const clipsNext: Clip[] = [];
    let imageCursor = clipsRef.current.filter((c) => c.track === 0).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    let audioCursor = clipsRef.current.filter((c) => c.track === 3).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    for (const file of incoming) {
      const kind = fileKind(file);
      if (kind === "image") {
        const url = await readableImageUrl(file);
        if (!url) {
          toast.error(`${file.name}은 열 수 없습니다. jpg 또는 png로 올려 주세요.`);
          continue;
        }
        const id = uid();
        photosNext.push({ id, name: file.name, url, caption: "" });
        clipsNext.push(imageClip(id, file.name, url, imageCursor, ""));
        imageCursor += 4;
        continue;
      }
      const url = URL.createObjectURL(file);
      const length = await probe(url, kind);
      const start = kind === "audio" ? audioCursor : imageCursor;
      if (kind === "audio") audioCursor += length;
      else imageCursor += length;
      clipsNext.push({
        id: uid(),
        kind,
        name: file.name,
        url,
        track: kind === "audio" ? 3 : 0,
        start,
        duration: length,
        offset: 0,
        text: "",
        color: "#fffdf8",
        fontSize: 54,
        x: 0.5,
        y: 0.86,
        volume: kind === "audio" ? 1 : 0,
        ...FX,
      });
    }
    if (photosNext.length) setPhotos((cur) => [...cur, ...photosNext]);
    if (clipsNext.length) {
      setClips((cur) => [...cur, ...clipsNext]);
      setSelected(clipsNext[0]?.id ?? null);
      toast.success(`${clipsNext.length}개를 올렸습니다.`);
    }
  }

  function setCaption(id: string, caption: string) {
    remember();
    setPhotos((cur) => cur.map((photo) => (photo.id === id ? { ...photo, caption } : photo)));
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
    setClips(planned);
    setSelected(planned[0]?.id ?? null);
    setTime(0);
    timeRef.current = 0;
    toast.success("사진과 자막으로 영상을 만들었습니다. 재생하거나 영상 받기를 누르세요.");
  }

  function addMusic(track: MusicTrack) {
    remember();
    const clip: Clip = {
      id: uid(),
      kind: "audio",
      name: `${track.category} · ${track.title}`,
      url: track.src,
      track: 3,
      start: 0,
      duration: Math.max(slideshowDuration(clipsRef.current.filter((item) => !item.library)), 12),
      offset: 0,
      text: "",
      color: "#fffdf8",
      fontSize: 54,
      x: 0.5,
      y: 0.86,
      volume: 0.75,
      ...FX,
      loop: true,
      library: true,
    };
    setClips((cur) => [...cur.filter((item) => !item.library), clip]);
    setSelected(clip.id);
    toast.success(`${track.title}을 배경음악으로 넣었습니다.`);
  }

  function runDirector() {
    if (!photos.length && !clipsRef.current.some((clip) => clip.kind === "image")) {
      toast.error("사진을 먼저 올려 주세요.");
      return;
    }
    const reorder = photoOrder === "story";
    const timelineIds = clipsRef.current
      .filter((clip) => clip.kind === "image")
      .sort((a, b) => a.start - b.start || a.track - b.track)
      .map((clip) => (clip.id.endsWith("-photo") ? clip.id.slice(0, -"-photo".length) : clip.id));
    const base = reorder ? photos : keepUserOrder(photos, timelineIds);
    remember();
    const timed = fitDurations(base, filmSeconds, reorder);
    setPhotos(timed.map((photo) => ({ id: photo.id, name: photo.name, url: photo.url || "", caption: photo.caption, beat: photo.beat })));
    const clips = directClips(timed, filmSeconds, filmMood, reorder);
    const musicId = filmMood === "bold" ? "sport-a" : filmMood === "calm" ? "calm-a" : "emotion-a";
    const track = MUSIC.find((item) => item.id === musicId);
    const end = clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 12);
    const music = track ? {
      id: uid(),
      kind: "audio" as const,
      name: `${track.title}`,
      url: track.src,
      track: 3,
      start: 0,
      duration: end,
      offset: 0,
      text: "",
      color: "#fffdf8",
      fontSize: 54,
      x: 0.5,
      y: 0.86,
      volume: 0.7,
      ...FX,
      loop: true,
      library: true,
    } : null;
    setClips(music ? [...clips, music] : clips);
    setSelected(clips[0]?.id ?? null);
    setTime(0);
    timeRef.current = 0;
    setDirectorOpen(true);
    toast.success(reorder
      ? "스토리 순서로 다시 배치했습니다. 실행 취소를 한 번 누르면 원래 순서로 돌아갑니다."
      : "사진 순서는 그대로 두고 길이, 효과, 음악을 맞췄습니다.");
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

  function patch(id: string, partial: Partial<Clip>, keepHistory = true) {
    if (keepHistory) remember();
    setClips((cur) => cur.map((c) => (c.id === id ? { ...c, ...partial } : c)));
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
    setClips((cur) => cur.filter((c) => c.id !== id));
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
        photosStored.push({ id: photo.id, name: photo.name, caption: photo.caption, beat: photo.beat, type: "image/jpeg", buffer });
        photoIds.set(photo.url, `photo:${photo.id}`);
      }
      const fileIds = new Map<string, string>();
      const files: VideoProjectRecord["files"] = [];
      for (const clip of clipsRef.current) {
        if (!clip.url?.startsWith("blob:") || photoIds.has(clip.url) || fileIds.has(clip.url)) continue;
        const buffer = await (await fetch(clip.url)).arrayBuffer();
        files.push({ key: clip.id, type: clip.kind === "audio" ? "audio/mpeg" : "video/mp4", buffer });
        fileIds.set(clip.url, `file:${clip.id}`);
      }
      const record: VideoProjectRecord = {
        id: uid(),
        name: `영상 ${new Date().toLocaleString("ko-KR")}`,
        savedAt: Date.now(),
        photos: photosStored,
        files,
        clips: clipsRef.current.map((clip) => ({ ...clip, url: rewriteClipUrl(clip.url, photoIds, fileIds) })),
      };
      await saveVideoProject(record);
      setProjects(await listVideoProjects());
      toast.success("이 브라우저에 영상 버전을 저장했습니다. 새로고침 후에도 불러올 수 있습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "영상 저장에 실패했습니다.");
    }
  }

  async function openCut(id: string) {
    const row = await loadVideoProject(id);
    if (!row) return;
    remember();
    const urls = new Map<string, string>();
    const nextPhotos = row.photos.map((photo) => {
      const url = URL.createObjectURL(new Blob([photo.buffer], { type: photo.type || "image/jpeg" }));
      urls.set(`photo:${photo.id}`, url);
      return { id: photo.id, name: photo.name, url, caption: photo.caption, beat: photo.beat as BeatId | undefined };
    });
    for (const file of row.files) {
      urls.set(`file:${file.key}`, URL.createObjectURL(new Blob([file.buffer], { type: file.type })));
    }
    const nextClips = (row.clips as Clip[]).map((clip) => ({
      ...clip,
      url: clip.url && urls.has(clip.url) ? urls.get(clip.url) : clip.url,
    }));
    setPhotos(nextPhotos);
    setClips(nextClips);
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
      let local = clip.offset + Math.max(0, at - clip.start);
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
      const result = await encodeMp4({
        width: size.width,
        height: size.height,
        fps: exportFps,
        duration: end,
        render: renderStill,
        audio: clipsRef.current
          .filter((clip) => (clip.kind === "audio" || clip.kind === "video") && clip.url && clip.volume > 0)
          .map((clip) => ({
            url: clip.url!,
            start: clip.start,
            duration: clip.duration,
            offset: clip.offset,
            volume: clip.volume,
            loop: clip.loop,
          })),
        onProgress: (ratio) => {
          if (Math.round(ratio * 10) !== Math.round((ratio - 0.02) * 10)) {
            toast.message(`MP4 만드는 중 ${Math.round(ratio * 100)}%`, { id: "mp4" });
          }
        },
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(result.blob);
      a.download = `adsmile-${exportSize}-${exportFps}fps.mp4`;
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
    await new Promise((r) => setTimeout(r, 80));
    const stream = canvas.captureStream(30);
    const ctx = audioCtxRef.current ?? new AudioContext();
    audioCtxRef.current = ctx;
    await ctx.resume();
    const dest = ctx.createMediaStreamDestination();
    for (const clip of clipsRef.current) {
      if ((clip.kind !== "audio" && clip.kind !== "video") || !clip.url || clip.volume <= 0) continue;
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
    a.download = "adsmile-edit.webm";
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
          <Clapperboard className="size-4 text-[#f08c00]" />
          <div>
            <p className="text-sm font-bold leading-none">영상편집실</p>
            <p className="mt-1 text-[10px] text-white/50">사진과 자막을 넣으면 영상이 만들어집니다</p>
          </div>
          <Link to="/studio" className="text-[11px] font-bold text-white/70">편집실</Link>
        </div>
        <label className="relative inline-flex h-8 cursor-pointer items-center gap-1 overflow-hidden rounded-md bg-[#f08c00] px-3 text-[12px] font-bold text-[#1c150e]">
          <Upload className="size-3.5" /> 사진 올리기
          <input
            type="file"
            accept="image/*,video/*,audio/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.bmp"
            multiple
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }}
          />
        </label>
        <button type="button" onClick={makeFromPhotos} className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-3 text-[12px] font-bold text-[#1c150e]">
          <ImagePlus className="size-3.5" /> 영상 만들기
        </button>
        <button type="button" onClick={() => { setDirectorOpen(true); if (photos.length) runDirector(); }} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#fffaf3] px-3 text-[12px] font-bold text-[#1c150e]">
          감독에게 맡기기
        </button>
        <Tool onClick={undoEdit}><Undo2 className="size-3.5" /> 취소</Tool>
        <Tool onClick={redoEdit}><Redo2 className="size-3.5" /> 다시</Tool>
        <Tool onClick={addText}><Type className="size-3.5" /> 글자</Tool>
        <Tool onClick={split}><Scissors className="size-3.5" /> 분할</Tool>
        <Tool onClick={() => selected && remove(selected)}><Trash2 className="size-3.5" /> 삭제</Tool>
        <button type="button" onClick={() => (playing ? pause() : play())} className="inline-flex h-8 items-center gap-1 rounded-md bg-white px-3 text-[12px] font-bold text-[#1c150e]">
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? "일시정지" : "재생"}
        </button>
        <span className="ml-1 font-mono text-[12px] text-white/70">{fmt(time)} / {fmt(duration)}</span>
        <button type="button" onClick={deliveryCheck} className="inline-flex h-8 items-center rounded-md border border-white/15 px-2.5 text-[12px] font-bold">납품 점검</button>
        <button type="button" onClick={() => void saveCut()} className="inline-flex h-8 items-center rounded-md border border-white/15 px-2.5 text-[12px] font-bold">버전 저장</button>
        <button type="button" onClick={() => void listVideoProjects().then(setProjects)} className="inline-flex h-8 items-center rounded-md border border-white/15 px-2.5 text-[12px] font-bold">불러오기</button>
        <button type="button" disabled={exporting || clips.length === 0} onClick={() => setExportOpen((open) => !open)} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-white/15 px-3 text-[12px] font-bold disabled:opacity-40">
          <Download className="size-3.5" /> {exporting ? "내보내는 중…" : "영상 받기"}
        </button>
      </header>
      {exportOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#2a2118] px-3 py-2 text-[12px]">
          <span className="font-bold text-white/60">형식</span>
          {(["mp4", "webm"] as const).map((format) => (
            <button key={format} type="button" onClick={() => setExportFormat(format)} className={`rounded-full px-2 py-1 font-bold ${exportFormat === format ? "bg-[#f08c00] text-[#1c150e]" : "bg-white/10"}`}>{format.toUpperCase()}</button>
          ))}
          {exportFormat === "mp4" ? (
            <>
              <span className="ml-2 font-bold text-white/60">화질</span>
              {(Object.keys(EXPORT_SIZES) as ExportSize[]).map((size) => (
                <button key={size} type="button" onClick={() => setExportSize(size)} className={`rounded-full px-2 py-1 font-bold ${exportSize === size ? "bg-[#f08c00] text-[#1c150e]" : "bg-white/10"}`}>{size}</button>
              ))}
              <span className="ml-2 font-bold text-white/60">프레임</span>
              {([30, 60] as const).map((fps) => (
                <button key={fps} type="button" onClick={() => setExportFps(fps)} className={`rounded-full px-2 py-1 font-bold ${exportFps === fps ? "bg-[#f08c00] text-[#1c150e]" : "bg-white/10"}`}>{fps}fps</button>
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

      <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-2">
        {photos.length === 0 ? (
          <p className="py-2 text-[12px] text-white/45">jpg, png 사진을 올리면 여기에 보이고, 자막을 적은 뒤 영상 만들기를 누르면 됩니다.</p>
        ) : photos.map((photo, index) => (
          <label key={photo.id} className="w-40 shrink-0">
            <img src={photo.url} alt="" className="h-14 w-full rounded bg-black object-contain" />
            <input
              value={photo.caption}
              placeholder={`${index + 1}번 자막`}
              onChange={(e) => setCaption(photo.id, e.target.value)}
              className="mt-1 h-8 w-full rounded bg-white/10 px-2 text-[12px]"
            />
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 px-3 py-2">
        <span className="shrink-0 text-[11px] font-bold text-white/50">배경음악</span>
        {MUSIC_CATEGORIES.map((category) => (
          <button key={category} type="button" onClick={() => setMusicCategory(category)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${musicCategory === category ? "bg-[#f08c00] text-[#1c150e]" : "bg-white/10"}`}>
            {category}
          </button>
        ))}
        {MUSIC.filter((track) => track.category === musicCategory).map((track) => (
          <button key={track.id} type="button" onClick={() => addMusic(track)} className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-[11px] font-bold">
            {track.title}
          </button>
        ))}
      </div>

      {directorOpen ? (
        <div className="max-h-52 overflow-y-auto border-b border-white/10 px-3 py-2 text-[12px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-white/60">길이</span>
            {[[null, "자동"], [180, "3분"], [300, "5분"], [600, "10분"]].map(([value, label]) => (
              <button key={label} type="button" onClick={() => setFilmSeconds(value as number | null)} className={`rounded-full px-2 py-1 font-bold ${filmSeconds === value ? "bg-[#f08c00] text-[#1c150e]" : "bg-white/10"}`}>{label}</button>
            ))}
            <span className="ml-2 font-bold text-white/60">분위기</span>
            {([["warm", "감동"], ["bold", "강렬"], ["calm", "잔잔"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFilmMood(value)} className={`rounded-full px-2 py-1 font-bold ${filmMood === value ? "bg-[#f08c00] text-[#1c150e]" : "bg-white/10"}`}>{label}</button>
            ))}
            <span className="ml-2 font-bold text-white/60">사진 순서</span>
            {([["keep", "원본 순서 유지"], ["story", "AI가 스토리에 맞게 재배치"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPhotoOrder(value)} className={`rounded-full px-2 py-1 font-bold ${photoOrder === value ? "bg-[#f08c00] text-[#1c150e]" : "bg-white/10"}`}>{label}</button>
            ))}
            <button type="button" onClick={runDirector} className="rounded-md bg-white px-2 py-1 font-bold text-[#1c150e]">이 구성으로 만들기</button>
          </div>
          <div className="mt-2 space-y-1">
            {fitDurations(
              photoOrder === "story" ? photos : keepUserOrder(photos, clips.filter((clip) => clip.kind === "image").sort((a, b) => a.start - b.start).map((clip) => clip.id.endsWith("-photo") ? clip.id.slice(0, -"-photo".length) : clip.id)),
              filmSeconds,
              photoOrder === "story",
            ).map((photo) => (
              <div key={photo.id} className="flex items-center gap-2">
                <select value={photo.beat} onChange={(e) => setPhotos((cur) => cur.map((item) => item.id === photo.id ? { ...item, beat: e.target.value as BeatId } : item))} className="h-7 rounded bg-white/10 px-1">
                  {BEATS.map((beat) => <option key={beat.id} value={beat.id}>{beat.title}</option>)}
                </select>
                <span className="truncate">{photo.caption || photo.name}</span>
                <span className="ml-auto text-white/50">{photo.seconds.toFixed(1)}초</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 items-center justify-center bg-[#100e0c] p-4">
          <canvas ref={canvasRef} width={1280} height={720} className="max-h-full max-w-full rounded-md bg-black shadow-lg" />
        </div>
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-white/10 p-3 md:block">
          <p className="text-[11px] font-bold text-white/50">선택한 클립</p>
          {selectedClip ? (
            <div className="mt-3 space-y-3 text-[12px]">
              <p className="truncate font-bold">{selectedClip.name}</p>
              <label className="block">시작
                <input type="number" step="0.1" min={0} value={round1(selectedClip.start)} onChange={(e) => patch(selectedClip.id, { start: Number(e.target.value) || 0 })} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
              </label>
              <label className="block">길이
                <input type="number" step="0.1" min={0.2} value={round1(selectedClip.duration)} onChange={(e) => patch(selectedClip.id, { duration: Math.max(0.2, Number(e.target.value) || 0.2) })} className="mt-1 h-8 w-full rounded bg-white/10 px-2" />
              </label>
              {selectedClip.kind === "image" || selectedClip.kind === "video" ? (
                <>
                  <p className="font-bold text-white/70">영상 효과</p>
                  <Chips label="색" value={selectedClip.look ?? "none"} options={LOOKS} onChange={(look) => patch(selectedClip.id, { look })} />
                  <Chips label="움직임" value={selectedClip.motion ?? "none"} options={MOTIONS} onChange={(motion) => patch(selectedClip.id, { motion })} />
                  <Chips label="전환" value={selectedClip.transition ?? "fade"} options={TRANSITIONS} onChange={(transition) => patch(selectedClip.id, { transition })} />
                </>
              ) : null}
              {selectedClip.kind === "text" ? (
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
                  <Chips label="스타일" value={selectedClip.textStyle ?? "bar"} options={TEXT_STYLES} onChange={(textStyle) => patch(selectedClip.id, { textStyle })} />
                  <Chips
                    label="위치"
                    value={selectedClip.y < 0.35 ? "top" : selectedClip.y > 0.7 ? "bottom" : "middle"}
                    options={[{ id: "top", label: "위" }, { id: "middle", label: "가운데" }, { id: "bottom", label: "아래" }]}
                    onChange={(place) => patch(selectedClip.id, { y: place === "top" ? 0.18 : place === "middle" ? 0.5 : 0.86 })}
                  />
                </>
              ) : null}
              {selectedClip.kind === "video" || selectedClip.kind === "audio" ? (
                <label className="block">소리 {Math.round(selectedClip.volume * 100)}%
                  <input type="range" min={0} max={1} step={0.05} value={selectedClip.volume} onChange={(e) => patch(selectedClip.id, { volume: Number(e.target.value) })} className="mt-1 w-full" />
                </label>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[12px] leading-relaxed text-white/45">영상, 사진, 소리를 가져오거나 글자를 추가하세요. 스페이스로 재생합니다.</p>
          )}
        </aside>
      </div>

      <div className="h-52 shrink-0 border-t border-white/10 bg-[#241c15]">
        <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] text-white/50">
          <span>타임라인</span>
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
              {ruler.map((t) => (
                <span key={t} className="absolute top-0 text-[10px] text-white/35" style={{ left: t * zoom }}>{t}s</span>
              ))}
            </div>
            {TRACKS.map((track) => (
              <div key={track.id} className="relative mb-1 h-8 rounded bg-black/30">
                <span className="pointer-events-none absolute left-1 top-1 text-[9px] text-white/30">{track.label}</span>
                {clips.filter((c) => c.track === track.id).map((clip) => (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelected(clip.id); }}
                    onPointerDown={(e) => dragClip(e, clip, zoom, patch, remember)}
                    className={`absolute top-1 h-6 truncate rounded px-2 text-left text-[10px] font-bold ${selected === clip.id ? "bg-[#f08c00] text-[#1c150e]" : "bg-[#6b4a28] text-[#fffaf3]"}`}
                    style={{ left: clip.start * zoom, width: Math.max(18, clip.duration * zoom) }}
                  >
                    {clip.kind === "text" ? clip.text : clip.name}
                  </button>
                ))}
              </div>
            ))}
            <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-[#f08c00]" style={{ left: time * zoom }} />
          </div>
        </div>
      </div>
    </div>
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
    motion: "zoom-in",
    transition: "fade",
  };
}

async function readableImageUrl(file: File): Promise<string | null> {
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

function paintPicture(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { videoWidth?: number; videoHeight?: number; naturalWidth?: number; naturalHeight?: number },
  w: number,
  h: number,
  clip: Clip,
  local: number,
  fill = false,
) {
  const motion = clip.motion ?? "none";
  const scale = motion === "zoom-in" ? 1 + local * 0.12 : motion === "zoom-out" ? 1.12 - local * 0.12 : motion === "none" ? 1 : 1.08;
  const dx = motion === "pan-left" ? (0.5 - local) * w * 0.08 : motion === "pan-right" ? (local - 0.5) * w * 0.08 : 0;
  ctx.save();
  ctx.filter = lookFilter(clip.look ?? "none");
  ctx.translate(w / 2 + dx, h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  if (fill) cover(ctx, source, w, h);
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
  const motion = clip.textMotion ?? "none";
  const shown = motion === "type" ? clip.text.slice(0, Math.max(1, Math.ceil(clip.text.length * Math.min(1, local <= 0 ? 1 : local / 0.65)))) : clip.text;
  let alpha = 1;
  let dy = 0;
  let scale = 1;
  if (local > 0) {
    if (motion === "fade") alpha = Math.min(1, local / 0.28);
    if (motion === "rise") {
      alpha = Math.min(1, local / 0.22);
      dy = (1 - Math.min(1, local / 0.35)) * 46;
    }
    if (motion === "pop") {
      alpha = Math.min(1, local / 0.14);
      scale = 0.7 + 0.3 * Math.min(1, local / 0.28);
    }
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(w * clip.x, h * clip.y + dy);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${clip.fontSize}px "IBM Plex Sans KR", "Noto Sans KR", sans-serif`;
  const style = clip.textStyle ?? "bar";
  if (style === "bar") {
    const width = Math.min(w * 0.86, ctx.measureText(shown).width + 56);
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(-width / 2, -clip.fontSize * 0.72, width, clip.fontSize * 1.45);
  }
  if (style === "shadow") {
    ctx.shadowColor = "rgba(0,0,0,.75)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = clip.color;
  if (style === "outline") {
    ctx.lineWidth = Math.max(6, clip.fontSize / 10);
    ctx.strokeStyle = "#1c150e";
    ctx.strokeText(shown, 0, 0);
  }
  ctx.fillText(shown, 0, 0);
  ctx.restore();
}

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (id: T) => void }) {
  return (
    <div>
      <p className="text-[11px] text-white/50">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {options.map((option) => (
          <button key={option.id} type="button" onClick={() => onChange(option.id)} className={`rounded px-2 py-1 text-[11px] font-bold ${value === option.id ? "bg-[#f08c00] text-[#1c150e]" : "bg-white/10"}`}>
            {option.label}
          </button>
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
  { id: "zoom-out", label: "축소" },
  { id: "pan-left", label: "왼쪽" },
  { id: "pan-right", label: "오른쪽" },
];
const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: "none", label: "없음" },
  { id: "fade", label: "페이드" },
  { id: "slide", label: "밀기" },
];
const TEXT_MOTIONS: { id: TextMotion; label: string }[] = [
  { id: "none", label: "없음" },
  { id: "fade", label: "페이드" },
  { id: "pop", label: "팝" },
  { id: "rise", label: "올라오기" },
  { id: "type", label: "타자" },
];
const TEXT_STYLES: { id: TextStyle; label: string }[] = [
  { id: "bar", label: "자막바" },
  { id: "outline", label: "외곽선" },
  { id: "shadow", label: "그림자" },
  { id: "plain", label: "기본" },
];

function Tool({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1 rounded-md border border-white/15 px-2.5 text-[12px] font-bold">
      {children}
    </button>
  );
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

function probe(url: string, kind: Kind) {
  return new Promise<number>((resolve) => {
    const el = document.createElement(kind === "audio" ? "audio" : "video");
    el.preload = "metadata";
    el.src = url;
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 5);
    el.onerror = () => resolve(5);
  });
}

function dragClip(
  e: ReactPointerEvent,
  clip: Clip,
  zoom: number,
  patch: (id: string, partial: Partial<Clip>, keepHistory?: boolean) => void,
  onStart: () => void,
) {
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
