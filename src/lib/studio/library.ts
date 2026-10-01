import { LIBRARY_BACKGROUNDS, type LibraryItem } from "./library-catalog";

const UPLOAD_KEY = "ad-studio-library-uploads-v1";

export type UserAsset = LibraryItem & { uploaded: true };

export function loadUploads(): UserAsset[] {
  try {
    const raw = localStorage.getItem(UPLOAD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserAsset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUploads(items: UserAsset[]) {
  try {
    localStorage.setItem(UPLOAD_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다"));
    reader.readAsDataURL(file);
  });
}

export function allLibraryItems(uploads: UserAsset[]): LibraryItem[] {
  return [...LIBRARY_BACKGROUNDS, ...uploads];
}
