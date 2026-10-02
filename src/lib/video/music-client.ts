import { getBearerToken } from "@/lib/auth/client";

export type UserMusic = {
  id: string;
  fileName: string;
  displayName: string;
  fileUrl: string;
  playUrl: string;
  byteSize: number;
  durationSec: number;
  format: string;
  createdAt: string;
  category: string;
  tags: string;
  favorite: boolean;
  source: string;
  license: string;
  vendor: string;
  note: string;
  projectCount: number;
};

export type MusicStorage = {
  musicCount: number;
  musicBytes: number;
  totalBytes: number;
  quotaBytes: number;
  fileLimit: number;
};

export type MusicLibrary = {
  tracks: UserMusic[];
  categories: string[];
  storage: MusicStorage;
};

async function musicFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getBearerToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "음악 보관함을 열지 못했습니다.");
  return data;
}

export function listUserMusic() {
  return musicFetch("/api/music/library") as Promise<MusicLibrary>;
}

export function uploadUserMusic(form: FormData) {
  return musicFetch("/api/music/library", { method: "POST", body: form }) as Promise<MusicLibrary & { duplicate: boolean; music: UserMusic }>;
}

export function patchUserMusic(id: string, patch: Record<string, unknown>) {
  return musicFetch(`/api/music/library/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  }) as Promise<MusicLibrary & { music: UserMusic }>;
}

export function deleteUserMusic(id: string, confirm: boolean) {
  return musicFetch(`/api/music/library/${id}${confirm ? "?confirm=1" : ""}`, { method: "DELETE" }) as Promise<
    Partial<MusicLibrary> & { deleted: boolean; projectCount: number; names: string }
  >;
}

export function addMusicCategory(name: string) {
  return musicFetch("/api/music/categories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  }) as Promise<MusicLibrary & { name: string }>;
}

export function rememberMusicUses(projectKey: string, projectName: string, musicIds: string[]) {
  const ids = [...new Set(musicIds.filter((id) => /^[0-9a-f-]{16,}$/i.test(id)))];
  if (!ids.length) return Promise.resolve();
  return musicFetch("/api/music/uses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectKey, projectName, musicIds: ids }),
  });
}

export function readAudioDuration(file: File) {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    const done = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) ? value : 0);
    };
    audio.onloadedmetadata = () => done(audio.duration);
    audio.onerror = () => done(0);
  });
}
