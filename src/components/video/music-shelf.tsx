import { Heart, Pause, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MUSIC, MUSIC_CATEGORIES } from "@/lib/video/music";
import { BUILTIN_MUSIC_CATEGORIES, formatBytes, MUSIC_QUOTA, type BedTrack } from "@/lib/video/music-plan";
import {
  addMusicCategory,
  deleteUserMusic,
  listUserMusic,
  patchUserMusic,
  readAudioDuration,
  uploadUserMusic,
  type MusicLibrary,
  type UserMusic,
} from "@/lib/video/music-client";

export type MusicPick = BedTrack & { source: "builtin" | "user" };

type SelectedAudio = {
  name: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  duration: number;
  start: number;
  pinned?: boolean;
};

const BUILTIN_SECONDS = 26;

export function MusicShelf({
  canReplace,
  selectedAudio,
  onAdd,
  onReplace,
  onTracks,
  onPatch,
}: {
  canReplace: boolean;
  selectedAudio: SelectedAudio | null;
  onAdd: (track: MusicPick) => void;
  onReplace: (track: MusicPick) => void;
  onTracks: (tracks: BedTrack[]) => void;
  onPatch: (partial: Partial<SelectedAudio>) => void;
}) {
  const [tab, setTab] = useState<"builtin" | "mine">("mine");
  const [builtinCategory, setBuiltinCategory] = useState(MUSIC_CATEGORIES[0] ?? "잔잔");
  const [library, setLibrary] = useState<MusicLibrary | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("잔잔");
  const [customName, setCustomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openMeta, setOpenMeta] = useState<string | null>(null);
  const preview = useRef<HTMLAudioElement | null>(null);
  const [rights, setRights] = useState({ source: "", license: "", vendor: "", note: "", tags: "" });

  async function reload() {
    const next = await listUserMusic();
    setLibrary(next);
    onTracks(next.tracks.map(toBed));
    return next;
  }

  useEffect(() => {
    void reload().catch(() => undefined);
    return () => preview.current?.pause();
  }, []);

  const categories = library?.categories?.length ? library.categories : [...BUILTIN_MUSIC_CATEGORIES];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library?.tracks ?? []).filter((track) => {
      if (favoritesOnly && !track.favorite) return false;
      if (category !== "전체" && track.category !== category) return false;
      if (!q) return true;
      return `${track.displayName} ${track.fileName} ${track.tags} ${track.category}`.toLowerCase().includes(q);
    });
  }, [library, query, category, favoritesOnly]);

  function play(track: UserMusic) {
    const el = preview.current ?? new Audio();
    preview.current = el;
    if (playingId === track.id && !el.paused) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = track.playUrl;
    void el.play().then(() => setPlayingId(track.id)).catch(() => toast.error("이 음악을 미리 듣지 못했습니다."));
    el.onended = () => setPlayingId((cur) => (cur === track.id ? null : cur));
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    const format = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["mp3", "wav", "m4a", "aac", "ogg"].includes(format) && !file.type.startsWith("audio/")) {
      toast.error("MP3, WAV, M4A, AAC, OGG만 올릴 수 있습니다.");
      return;
    }
    setBusy(true);
    try {
      const durationSec = await readAudioDuration(file);
      const form = new FormData();
      form.set("file", file);
      form.set("displayName", file.name.replace(/\.[^.]+$/, ""));
      form.set("category", uploadCategory);
      form.set("durationSec", String(durationSec));
      form.set("source", rights.source);
      form.set("license", rights.license);
      form.set("vendor", rights.vendor);
      form.set("note", rights.note);
      form.set("tags", rights.tags);
      const result = await uploadUserMusic(form);
      setLibrary(result);
      onTracks(result.tracks.map(toBed));
      setTab("mine");
      toast.success(result.duplicate ? "이미 같은 음악이 보관함에 있습니다. 새로 올리지 않고 그 곡을 보여 줍니다." : `${result.music.displayName}을 보관함에 넣었습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "음악을 올리지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function rename(track: UserMusic) {
    const name = window.prompt("음악 이름", track.displayName)?.trim();
    if (!name || name === track.displayName) return;
    try {
      const next = await patchUserMusic(track.id, { displayName: name });
      setLibrary(next);
      onTracks(next.tracks.map(toBed));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "이름을 바꾸지 못했습니다.");
    }
  }

  async function toggleFavorite(track: UserMusic) {
    try {
      const next = await patchUserMusic(track.id, { favorite: !track.favorite });
      setLibrary(next);
      onTracks(next.tracks.map(toBed));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "즐겨찾기를 바꾸지 못했습니다.");
    }
  }

  async function changeCategory(track: UserMusic, nextCategory: string) {
    try {
      const next = await patchUserMusic(track.id, { category: nextCategory });
      setLibrary(next);
      onTracks(next.tracks.map(toBed));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "분류를 바꾸지 못했습니다.");
    }
  }

  async function saveMeta(track: UserMusic, patch: Record<string, string>) {
    try {
      const next = await patchUserMusic(track.id, patch);
      setLibrary(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저작권 정보를 저장하지 못했습니다.");
    }
  }

  async function remove(track: UserMusic) {
    try {
      const first = await deleteUserMusic(track.id, false);
      if (!first.deleted) {
        const ok = window.confirm(`이 음악은 ${first.projectCount}개의 영상 프로젝트에서 사용 중입니다. 삭제하면 해당 프로젝트에서 음악을 찾을 수 없습니다.`);
        if (!ok) return;
        const next = await deleteUserMusic(track.id, true);
        if (next.tracks) {
          setLibrary(next as MusicLibrary);
          onTracks(next.tracks.map(toBed));
        } else await reload();
      } else if (first.tracks) {
        setLibrary(first as MusicLibrary);
        onTracks(first.tracks.map(toBed));
      } else await reload();
      if (playingId === track.id) preview.current?.pause();
      toast.success("보관함에서 뺐습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    }
  }

  async function addCategory() {
    const name = customName.trim();
    if (!name) return;
    try {
      const next = await addMusicCategory(name);
      setLibrary(next);
      setCustomName("");
      setUploadCategory(name);
      toast.success(`"${name}" 분류를 추가했습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "분류를 추가하지 못했습니다.");
    }
  }

  const storage = library?.storage;
  const usedBytes = storage?.musicBytes ?? 0;
  const quotaBytes = storage?.quotaBytes || MUSIC_QUOTA;

  return (
    <div className="border-b border-white/10 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTab("builtin")} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tab === "builtin" ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>기본 음악</button>
        <button type="button" onClick={() => setTab("mine")} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tab === "mine" ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>내 음악</button>
        <label className="relative inline-flex h-8 cursor-pointer items-center gap-1 overflow-hidden rounded-md bg-[#D4A04E] px-3 text-[12px] font-bold text-[#1c150e]">
          + 음악 업로드
          <input
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={busy}
            onChange={(e) => { setTab("mine"); void onUpload(e.target.files?.[0]); e.target.value = ""; }}
          />
        </label>
        <p className="text-[12px] font-bold text-white/80">사용중 {formatBytes(usedBytes)} / {formatBytes(quotaBytes)}{storage ? ` · 음악 ${storage.musicCount}개` : ""}</p>
        {storage && storage.totalBytes > storage.musicBytes ? <p className="text-[11px] text-white/45">전체 {formatBytes(storage.totalBytes)}</p> : null}
      </div>
      <p className="mt-1 text-[11px] text-white/45">사용 권한이 있는 음악만 업로드하세요. MP3, WAV, M4A, AAC, OGG · 한 곡 40MB · 계정에 저장되어 다른 컴퓨터에서도 보입니다.</p>

      {tab === "builtin" ? (
        <div className="mt-2 flex items-center gap-2 overflow-x-auto">
          {MUSIC_CATEGORIES.map((item) => (
            <button key={item} type="button" onClick={() => setBuiltinCategory(item)} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${builtinCategory === item ? "bg-white text-[#1c150e]" : "bg-white/10"}`}>{item}</button>
          ))}
          {MUSIC.filter((track) => track.category === builtinCategory).map((track) => {
            const pick: MusicPick = { id: track.id, name: `${track.category} · ${track.title}`, url: track.src, category: track.category, duration: BUILTIN_SECONDS, source: "builtin" };
            return (
              <span key={track.id} className="inline-flex shrink-0 overflow-hidden rounded-md border border-white/15">
                <button type="button" onClick={() => onAdd(pick)} className="px-2 py-1 text-[11px] font-bold">{track.title}</button>
                {canReplace ? <button type="button" onClick={() => onReplace(pick)} className="border-l border-white/15 px-2 py-1 text-[10px] text-white/70">교체</button> : null}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] text-white/55">올린 음악은 서버 보관함에 남습니다. 미리듣기, 이름 변경, 분류, 즐겨찾기, 타임라인 추가, 삭제가 됩니다.</p>
            <details className="text-[11px] text-white/55">
              <summary className="cursor-pointer">출처, 라이선스, 구입처, 비고</summary>
              <div className="mt-1 flex flex-wrap gap-1">
                <input value={rights.source} onChange={(e) => setRights({ ...rights, source: e.target.value })} placeholder="출처" className="h-7 w-28 rounded bg-white/10 px-2" />
                <input value={rights.license} onChange={(e) => setRights({ ...rights, license: e.target.value })} placeholder="라이선스" className="h-7 w-28 rounded bg-white/10 px-2" />
                <input value={rights.vendor} onChange={(e) => setRights({ ...rights, vendor: e.target.value })} placeholder="구입처" className="h-7 w-28 rounded bg-white/10 px-2" />
                <input value={rights.tags} onChange={(e) => setRights({ ...rights, tags: e.target.value })} placeholder="태그" className="h-7 w-28 rounded bg-white/10 px-2" />
                <input value={rights.note} onChange={(e) => setRights({ ...rights, note: e.target.value })} placeholder="비고" className="h-7 w-40 rounded bg-white/10 px-2" />
              </div>
            </details>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="음악 이름 검색" className="h-8 w-40 rounded bg-white/10 px-2 text-[12px]" />
            <button type="button" onClick={() => setFavoritesOnly((on) => !on)} className={`rounded-full px-2 py-1 text-[11px] font-bold ${favoritesOnly ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>즐겨찾기</button>
            <button type="button" onClick={() => setCategory("전체")} className={`rounded-full px-2 py-1 text-[11px] font-bold ${category === "전체" ? "bg-white text-[#1c150e]" : "bg-white/10"}`}>전체</button>
            {categories.map((item) => (
              <button key={item} type="button" onClick={() => { setCategory(item); setUploadCategory(item); }} className={`rounded-full px-2 py-1 text-[11px] font-bold ${category === item ? "bg-white text-[#1c150e]" : "bg-white/10"}`}>{item}</button>
            ))}
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="새 분류" className="h-8 w-24 rounded bg-white/10 px-2 text-[12px]" />
            <button type="button" onClick={() => void addCategory()} className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-bold">분류 추가</button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {shown.length === 0 ? <p className="py-2 text-[12px] text-white/45">{library ? "이 조건의 내 음악이 없습니다." : "보관함을 불러오는 중이거나 로그인이 필요합니다."}</p> : null}
            {shown.map((track) => {
              const pick: MusicPick = { id: track.id, name: track.displayName, url: track.playUrl, category: track.category, duration: track.durationSec, favorite: track.favorite, source: "user" };
              return (
                <div key={track.id} className="rounded-md border border-white/10 bg-black/25 px-2.5 py-2 text-[12px]">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="max-w-[18rem] truncate font-bold">{track.displayName}</p>
                    <span className="text-[11px] text-white/45">{clock(track.durationSec)} · {track.format.toUpperCase()} · {formatBytes(track.byteSize)} · {when(track.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button type="button" onClick={() => play(track)} className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 px-2 text-[11px] font-bold">
                      {playingId === track.id ? <Pause className="size-3" /> : <Play className="size-3" />}
                      {playingId === track.id ? "미리듣기 중지" : "미리듣기"}
                    </button>
                    <button type="button" onClick={() => onAdd(pick)} className="inline-flex h-7 items-center rounded-md bg-white px-2 text-[11px] font-bold text-[#1c150e]">타임라인에 추가</button>
                    <button type="button" onClick={() => void rename(track)} className="inline-flex h-7 items-center rounded-md border border-white/15 px-2 text-[11px] font-bold">이름 변경</button>
                    <button type="button" onClick={() => void toggleFavorite(track)} className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold ${track.favorite ? "bg-[#D4A04E] text-[#1c150e]" : "border border-white/15"}`}>
                      <Heart className="size-3" /> 즐겨찾기
                    </button>
                    <button type="button" onClick={() => void remove(track)} className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 px-2 text-[11px] font-bold text-white/80">
                      <Trash2 className="size-3" /> 삭제
                    </button>
                    {canReplace ? <button type="button" onClick={() => onReplace(pick)} className="inline-flex h-7 items-center rounded-md border border-white/15 px-2 text-[11px] font-bold">교체</button> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <select value={categories.includes(track.category) ? track.category : "기타"} onChange={(e) => void changeCategory(track, e.target.value)} className="h-7 rounded bg-white/10 px-1 text-[11px]">
                      {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <button type="button" onClick={() => setOpenMeta((cur) => (cur === track.id ? null : track.id))} className="text-[11px] text-white/45">출처·라이선스</button>
                    {track.projectCount > 0 ? <span className="text-[10px] text-white/40">{track.projectCount}개 영상에서 사용</span> : null}
                  </div>
                  {openMeta === track.id ? (
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      <Meta label="출처" value={track.source} onSave={(source) => void saveMeta(track, { source })} />
                      <Meta label="라이선스" value={track.license} onSave={(license) => void saveMeta(track, { license })} />
                      <Meta label="구입처" value={track.vendor} onSave={(vendor) => void saveMeta(track, { vendor })} />
                      <Meta label="비고" value={track.note} onSave={(note) => void saveMeta(track, { note })} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedAudio ? (
        <div className="mt-2 grid gap-2 rounded-md bg-black/20 p-2 text-[11px] sm:grid-cols-4">
          <p className="truncate font-bold sm:col-span-4">{selectedAudio.name}{selectedAudio.pinned ? " · 고정" : ""}</p>
          <label>볼륨 {Math.round(selectedAudio.volume * 100)}%
            <input type="range" min={0} max={1} step={0.05} value={selectedAudio.volume} onChange={(e) => onPatch({ volume: Number(e.target.value) })} className="mt-1 w-full" />
          </label>
          <label>Fade In {selectedAudio.fadeIn.toFixed(1)}초
            <input type="range" min={0} max={4} step={0.1} value={selectedAudio.fadeIn} onChange={(e) => onPatch({ fadeIn: Number(e.target.value) })} className="mt-1 w-full" />
          </label>
          <label>Fade Out {selectedAudio.fadeOut.toFixed(1)}초
            <input type="range" min={0} max={6} step={0.1} value={selectedAudio.fadeOut} onChange={(e) => onPatch({ fadeOut: Number(e.target.value) })} className="mt-1 w-full" />
          </label>
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => onPatch({ pinned: !selectedAudio.pinned })} className={`rounded px-2 py-1 font-bold ${selectedAudio.pinned ? "bg-[#D4A04E] text-[#1c150e]" : "bg-white/10"}`}>{selectedAudio.pinned ? "고정됨" : "고정"}</button>
            <span className="text-white/40">시작 {selectedAudio.start.toFixed(1)}초 · 길이 {selectedAudio.duration.toFixed(1)}초</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Meta({ label, value, onSave }: { label: string; value: string; onSave: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="block text-[10px] text-white/45">{label}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== value) onSave(text); }}
        className="mt-0.5 h-7 w-full rounded bg-white/10 px-2 text-[12px] text-[#fffaf3]"
      />
    </label>
  );
}

function toBed(track: UserMusic): BedTrack {
  return {
    id: track.id,
    name: track.displayName,
    url: track.playUrl,
    category: track.category,
    favorite: track.favorite,
    duration: track.durationSec,
  };
}

function clock(sec: number) {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR");
}
