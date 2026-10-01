import type { Brief, Draft } from "./types";

const AUTOSAVE_KEY = "makearoad-v7-project-autosave";
const VERSIONS_KEY = "makearoad-v7-project-versions";
export type ProjectSnapshot = { id: string; name: string; savedAt: number; brief: Brief; drafts: Draft[]; activeId: string | null };

export function saveAutosave(data: Omit<ProjectSnapshot, "id" | "name" | "savedAt">) {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ...data, savedAt: Date.now() })); return true; } catch { return false; }
}
export function loadAutosave(): (Omit<ProjectSnapshot, "id" | "name"> & { savedAt: number }) | null {
  try { const raw = localStorage.getItem(AUTOSAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function listVersions(): ProjectSnapshot[] {
  try { const raw = localStorage.getItem(VERSIONS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export function saveVersion(data: Omit<ProjectSnapshot, "id" | "savedAt">): ProjectSnapshot {
  const item = { ...data, id: `v-${Date.now()}`, savedAt: Date.now() };
  const next = [item, ...listVersions()].slice(0, 12);
  localStorage.setItem(VERSIONS_KEY, JSON.stringify(next));
  return item;
}
export function deleteVersion(id: string) { localStorage.setItem(VERSIONS_KEY, JSON.stringify(listVersions().filter(v => v.id !== id))); }
