export type VideoPhotoRecord = {
  id: string;
  name: string;
  caption: string;
  beat?: string;
  type: string;
  buffer: ArrayBuffer;
};

export type VideoProjectRecord = {
  id: string;
  name: string;
  savedAt: number;
  photos: VideoPhotoRecord[];
  files: { key: string; type: string; buffer: ArrayBuffer }[];
  clips: Record<string, unknown>[];
};

const DB_NAME = "adsmile-video";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVideoProject(record: VideoProjectRecord) {
  const db = await openDb();
  const tx = db.transaction("projects", "readwrite");
  tx.objectStore("projects").put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listVideoProjects() {
  const db = await openDb();
  const tx = db.transaction("projects", "readonly");
  const rows = await requestToPromise(tx.objectStore("projects").getAll() as IDBRequest<VideoProjectRecord[]>);
  db.close();
  return rows.sort((a, b) => b.savedAt - a.savedAt).slice(0, 12);
}

export async function loadVideoProject(id: string) {
  const db = await openDb();
  const tx = db.transaction("projects", "readonly");
  const row = await requestToPromise(tx.objectStore("projects").get(id) as IDBRequest<VideoProjectRecord | undefined>);
  db.close();
  return row ?? null;
}

export function rewriteClipUrl(url: string | undefined, photoIds: Map<string, string>, fileIds: Map<string, string>) {
  if (!url) return url;
  return photoIds.get(url) ?? fileIds.get(url) ?? url;
}
