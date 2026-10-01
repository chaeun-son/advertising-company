import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SAMPLE_BRIEF, sizeOf } from "./catalog";
import { loadAutosave } from "./project-storage";
import { composeAiDraft, composeTypeDrafts, inspectDraft } from "./compose";
import { composeDesignerDrafts } from "./designer";
import { applyProductionFix, type FixId } from "./production-check";
import { reflowToSize } from "./reflow";
import { referenceBrief, referenceDraft } from "./reference-template";
import { uid } from "./geom";
import { fileToDataUrl, loadUploads, saveUploads, type UserAsset } from "./library";
import { type LibraryFolder, type LibraryItem } from "./library-catalog";
import {
  DEFAULT_BRIEF,
  type Brief,
  type Draft,
  type EditorTool,
  type Layer,
  type ShapeKind,
  type StudioMode,
  type TextLayer,
} from "./types";

type AiItem = {
  letter: "A" | "B" | "C";
  title: string;
  textZone: "left" | "right" | "top" | "bottom" | "center";
  palette: Draft["palette"];
  prompt: string;
  image: string;
};

type HistorySnap = { drafts: Draft[]; activeId: string | null };

type StudioState = {
  brief: Brief;
  drafts: Draft[];
  activeId: string | null;
  mode: StudioMode;
  theme: "light" | "dark";
  selectedLayerId: string | null;
  busy: string | null;
  aiAvailable: boolean | null;
  aiQuality: "fast" | "print";
  tool: EditorTool;
  zoom: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  uploads: UserAsset[];
  history: HistorySnap[];
  future: HistorySnap[];
  snap: boolean;
  showGrid: boolean;
  showSafeArea: boolean;
  libraryFolder: LibraryFolder;
  libraryQuery: string;
  editingTextId: string | null;
  clipboard: Layer | null;
  pickingFocus: boolean;
  setBrief: (patch: Partial<Brief>) => void;
  setMode: (mode: StudioMode) => void;
  setTheme: (theme: "light" | "dark") => void;
  setActive: (id: string) => void;
  setSelectedLayer: (id: string | null) => void;
  setBusy: (msg: string | null) => void;
  setAiAvailable: (v: boolean) => void;
  setAiQuality: (v: "fast" | "print") => void;
  setTool: (tool: EditorTool) => void;
  setZoom: (zoom: number) => void;
  setDrawStyle: (patch: { fill?: string; stroke?: string; strokeWidth?: number }) => void;
  resizeDrafts: (width: number, height: number) => void;
  makeTypeDrafts: () => { errors: string[]; warnings: string[] };
  applyReferenceTemplate: () => void;
  resetDrafts: () => void;
  addAiDraft: (item: AiItem) => void;
  replaceDraft: (draft: Draft) => void;
  updateLayer: (layerId: string, patch: Partial<TextLayer>) => void;
  patchLayer: (layerId: string, patch: Partial<Layer>) => void;
  fillSample: () => void;
  ensureDraft: () => Draft;
  createBlank: () => void;
  applyBackground: (item: LibraryItem) => void;
  placeAsset: (item: LibraryItem) => void;
  addShape: (kind: ShapeKind, box: { x: number; y: number; w: number; h: number }) => string;
  addTextAt: (x: number, y: number) => string;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  flipSelected: (axis: "h" | "v") => void;
  nudgeSelected: (dx: number, dy: number) => void;
  reorderSelected: (dir: "front" | "back" | "up" | "down") => void;
  alignSelected: (edge: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  addUpload: (file: File) => Promise<UserAsset>;
  removeUpload: (id: string) => void;
  undo: () => void;
  redo: () => void;
  checkpoint: () => void;
  setSnap: (snap: boolean) => void;
  setShowGrid: (show: boolean) => void;
  setShowSafeArea: (show: boolean) => void;
  setLibraryFolder: (folder: LibraryFolder) => void;
  setLibraryQuery: (q: string) => void;
  setEditingText: (id: string | null) => void;
  setPickingFocus: (value: boolean) => void;
  addReflowDraft: (width: number, height: number, label: string) => void;
  applyReviewFix: (fix: FixId) => void;
  handToDesigner: () => void;
};

const BRIEF_KEY = "ad-studio-brief-v4";

function persistBrief(brief: Brief) {
  try {
    const { logoDataUrl: _l, photoDataUrl: _p, ...rest } = brief;
    localStorage.setItem(BRIEF_KEY, JSON.stringify(rest));
  } catch {
    /* quota */
  }
}

function loadBrief(): Brief {
  try {
    const raw = localStorage.getItem(BRIEF_KEY);
    if (!raw) return DEFAULT_BRIEF;
    return { ...DEFAULT_BRIEF, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BRIEF;
  }
}

function cloneDrafts(drafts: Draft[]): Draft[] {
  return JSON.parse(JSON.stringify(drafts)) as Draft[];
}

function resizeLayer(layer: Layer, scaleX: number, scaleY: number): Layer {
  const scale = Math.sqrt(scaleX * scaleY);
  const resized = {
    ...layer,
    x: layer.x * scaleX,
    y: layer.y * scaleY,
    w: layer.w * scaleX,
    h: layer.h * scaleY,
  };

  if (layer.type === "text") {
    return {
      ...resized,
      fontSize: Math.max(1, layer.fontSize * scale),
      letterSpacing: layer.letterSpacing === undefined ? undefined : layer.letterSpacing * scale,
    } as Layer;
  }
  if (layer.type === "shape" || layer.type === "rect") {
    return {
      ...resized,
      strokeWidth: layer.strokeWidth === undefined ? undefined : layer.strokeWidth * scale,
      radius: layer.radius === undefined ? undefined : layer.radius * scale,
    } as Layer;
  }
  return resized as Layer;
}

function normalizeBackgrounds(draft: Draft): Draft {
  const backgrounds = draft.layers.filter((layer): layer is Extract<Layer, { type: "image" }> => layer.type === "image" && layer.role === "background");
  if (!backgrounds.length) return draft;
  const chosen = backgrounds.filter((layer) => layer.id !== "reference-bg").at(-1) ?? backgrounds.at(-1)!;
  const fit = chosen.fit === "responsive" || chosen.href.startsWith("/library/backgrounds/") || chosen.href.startsWith("/reference-")
    ? "responsive"
    : "cover";
  return {
    ...draft,
    layers: [
      { ...chosen, x: 0, y: 0, w: draft.width, h: draft.height, fit },
      ...draft.layers.filter((layer) => !(layer.type === "image" && layer.role === "background")),
    ],
  };
}

function resizeReferenceDraft(draft: Draft, brief: Brief, nextWidth: number, nextHeight: number): Draft {
  const fresh = referenceDraft(brief, nextWidth, nextHeight);
  const previous = new Map(draft.layers.map((layer) => [layer.id, layer]));
  const templateIds = new Set(fresh.layers.map((layer) => layer.id));
  const existingBackground = normalizeBackgrounds(draft).layers[0];
  const background = existingBackground?.type === "image" && existingBackground.role === "background" && existingBackground.id !== "reference-bg"
    ? {
        ...existingBackground,
        x: 0,
        y: 0,
        w: nextWidth,
        h: nextHeight,
        fit: existingBackground.fit === "responsive" || existingBackground.href.startsWith("/library/") || existingBackground.href.startsWith("/reference-") ? "responsive" as const : "cover" as const,
      }
    : fresh.layers[0];
  return {
    ...fresh, id: draft.id, letter: draft.letter, palette: draft.palette,
    layers: [
      background,
      ...fresh.layers.slice(1).map((layer) => {
        const old = previous.get(layer.id);
        return layer.type === "text" && old?.type === "text"
          ? { ...layer, text: old.text, fill: old.fill, fontFamily: old.fontFamily, fontWeight: old.fontWeight }
          : layer;
      }),
      ...draft.layers.filter((layer) => !templateIds.has(layer.id) && !(layer.type === "image" && layer.role === "background")).map((layer) => resizeLayer(layer, nextWidth / draft.width, nextHeight / draft.height)),
    ],
  };
}

function blankPalette(brief: Brief): Draft["palette"] {
  return {
    bg: "#ffffff",
    panel: brief.baseColor || "#1c2333",
    text: "#16181d",
    muted: "#5c6573",
    accent: brief.accentColor || "#1c2333",
    onAccent: "#ffffff",
  };
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => {
      const snapshot = () => {
        const { drafts, activeId, history } = get();
        set({
          history: [...history.slice(-39), { drafts: cloneDrafts(drafts), activeId }],
          future: [],
        });
      };

      const mapActive = (fn: (draft: Draft) => Draft) => {
        const { drafts, activeId } = get();
        set({
          drafts: drafts.map((d) => (d.id === activeId ? fn(d) : d)),
        });
      };

      return {
        brief: DEFAULT_BRIEF,
        drafts: [],
        activeId: null,
        mode: "edit",
        theme: "light",
        selectedLayerId: null,
        busy: null,
        aiAvailable: null,
        aiQuality: "fast",
        tool: "select",
        zoom: 1,
        fill: "#1c2333",
        stroke: "#1c2333",
        strokeWidth: 4,
        uploads: [],
        history: [],
        future: [],
        snap: true,
        showGrid: false,
        showSafeArea: true,
        libraryFolder: "all",
        libraryQuery: "",
        editingTextId: null,
        pickingFocus: false,
        clipboard: null,
        setBrief: (patch) => {
          const brief = { ...get().brief, ...patch };
          set({ brief });
          persistBrief(brief);
        },
        setMode: (mode) => set({ mode }),
        setTheme: (theme) => {
          set({ theme });
          document.documentElement.classList.toggle("dark", theme === "dark");
          localStorage.setItem("ad-studio-ui-theme", theme);
        },
        setActive: (id) => set({ activeId: id, selectedLayerId: null }),
        setSelectedLayer: (id) => set({ selectedLayerId: id, mode: id ? "edit" : get().mode }),
        setBusy: (busy) => set({ busy }),
        setAiAvailable: (aiAvailable) => set({ aiAvailable }),
        setAiQuality: (aiQuality) => set({ aiQuality }),
        setTool: (tool) => set({ tool, mode: "edit" }),
        setZoom: (zoom) => set({ zoom: Math.max(0.15, Math.min(4, zoom)) }),
        setDrawStyle: (patch) => set(patch),
        resizeDrafts: (width, height) => {
          const nextWidth = Math.max(40, width);
          const nextHeight = Math.max(40, height);
          const { drafts, brief } = get();
          if (!drafts.length) return;
          snapshot();
          const recomposedTypeDrafts = composeTypeDrafts(brief, nextWidth, nextHeight);
          set({
            drafts: drafts.map((draft) => {
              const hasCustomBackground = draft.layers.some((layer) => layer.type === "image" && layer.role === "background" && layer.id !== "reference-bg" && !layer.id.startsWith("ai-bg"));
              if (draft.source === "type" && !hasCustomBackground) {
                const fresh = recomposedTypeDrafts.find((item) => item.letter === draft.letter);
                return fresh ? { ...fresh, id: draft.id } : draft;
              }
              if (draft.source === "ai" && !hasCustomBackground && draft.aiImage && draft.aiPrompt && draft.textZone) {
                const fresh = composeAiDraft(
                  brief,
                  nextWidth,
                  nextHeight,
                  draft.letter,
                  draft.title,
                  draft.palette,
                  draft.aiImage,
                  draft.aiPrompt,
                  draft.textZone,
                );
                return { ...fresh, id: draft.id };
              }
              if (draft.source === "reference") {
                return resizeReferenceDraft(draft, brief, nextWidth, nextHeight);
              }
              const scaleX = nextWidth / draft.width;
              const scaleY = nextHeight / draft.height;
              return {
                ...draft,
                width: nextWidth,
                height: nextHeight,
                layers: normalizeBackgrounds({ ...draft, width: nextWidth, height: nextHeight, layers: draft.layers.map((layer) => resizeLayer(layer, scaleX, scaleY)) }).layers,
              };
            }),
            selectedLayerId: null,
          });
        },
        makeTypeDrafts: () => {
          snapshot();
          const { brief } = get();
          const { w, h } = sizeOf(brief);
          const drafts = composeTypeDrafts(brief, w, h);
          const check = inspectDraft(drafts[0], brief);
          set({ drafts, activeId: drafts[0]?.id ?? null, selectedLayerId: null, mode: "edit" });
          return check;
        },
        applyReferenceTemplate: () => {
          snapshot();
          const brief = referenceBrief(get().brief);
          const first = referenceDraft(brief);
          const others = composeTypeDrafts(brief, first.width, first.height).slice(1);
          set({ brief, drafts: [first, ...others], activeId: first.id, selectedLayerId: null, mode: "edit", tool: "select" });
          persistBrief(brief);
        },
        resetDrafts: () => set({ drafts: [], activeId: null, selectedLayerId: null }),
        addAiDraft: (item) => {
          snapshot();
          const { brief } = get();
          const { w, h } = sizeOf(brief);
          const draft = composeAiDraft(
            brief,
            w,
            h,
            item.letter,
            item.title,
            item.palette,
            item.image,
            item.prompt,
            item.textZone,
          );
          const drafts = [...get().drafts.filter((d) => d.letter !== item.letter), draft].sort((a, b) =>
            a.letter.localeCompare(b.letter),
          );
          set({ drafts, activeId: draft.id, selectedLayerId: null, mode: "edit" });
        },
        replaceDraft: (draft) => {
          set({
            drafts: get().drafts.map((d) => (d.id === draft.id ? draft : d)),
            activeId: draft.id,
          });
        },
        updateLayer: (layerId, patch) => {
          get().patchLayer(layerId, patch as Partial<Layer>);
        },
        patchLayer: (layerId, patch) => {
          mapActive((d) => ({
            ...d,
            layers: d.layers.map((l) => (l.id === layerId ? ({ ...l, ...patch } as Layer) : l)),
          }));
        },
        fillSample: () => {
          const brief = { ...get().brief, ...SAMPLE_BRIEF };
          set({ brief });
          persistBrief(brief);
        },
        ensureDraft: () => {
          const existing = get().drafts.find((d) => d.id === get().activeId) ?? get().drafts[0];
          if (existing) return existing;
          const { brief } = get();
          const { w, h } = sizeOf(brief);
          const draft: Draft = {
            id: uid("blank"),
            letter: "A",
            title: "빈 도화지",
            source: "blank",
            width: w,
            height: h,
            palette: blankPalette(brief),
            layers: [
              {
                id: uid("paper"),
                type: "rect",
                x: 0,
                y: 0,
                w,
                h,
                fill: "#ffffff",
                name: "대지",
                locked: true,
              },
            ],
          };
          set({ drafts: [draft], activeId: draft.id, selectedLayerId: null });
          return draft;
        },
        createBlank: () => {
          snapshot();
          get().resetDrafts();
          get().ensureDraft();
          set({ mode: "edit", tool: "select" });
        },
        applyBackground: (item) => {
          snapshot();
          const draft = get().ensureDraft();
          const bg: Layer = {
            id: uid("lib-bg"),
            type: "image",
            role: "background",
            x: 0,
            y: 0,
            w: draft.width,
            h: draft.height,
            href: item.src,
            fit: item.src.startsWith("/library/backgrounds/") || item.src.startsWith("/reference-") ? "responsive" : "cover",
            name: item.title,
            locked: true,
          };
          mapActive((d) => {
            const rest = d.layers.filter((l) => !(l.type === "image" && l.role === "background"));
            const paper = rest.find((l) => l.type === "rect" && l.x === 0 && l.y === 0 && Math.abs(l.w - d.width) < 1);
            const withoutPaper = paper ? rest.filter((l) => l.id !== paper.id) : rest;
            return { ...d, layers: [bg, ...withoutPaper], title: d.source === "blank" ? item.title : d.title };
          });
          set({ mode: "edit", selectedLayerId: bg.id });
        },
        placeAsset: (item) => {
          snapshot();
          const draft = get().ensureDraft();
          const w = Math.max(80, draft.width * 0.28);
          const h = Math.max(40, draft.height * 0.28);
          const id = uid("asset");
          const layer: Layer = {
            id,
            type: "image",
            role: "photo",
            x: (draft.width - w) / 2,
            y: (draft.height - h) / 2,
            w,
            h,
            href: item.src,
            fit: "contain",
            name: item.title,
          };
          mapActive((d) => ({ ...d, layers: [...d.layers, layer] }));
          set({ mode: "edit", selectedLayerId: id, tool: "select" });
        },
        addShape: (kind, box) => {
          snapshot();
          get().ensureDraft();
          const { fill, stroke, strokeWidth } = get();
          const id = uid(kind);
          const layer: Layer = {
            id,
            type: "shape",
            kind,
            x: box.x,
            y: box.y,
            w: Math.max(4, box.w),
            h: Math.max(4, box.h),
            fill: kind === "line" ? "none" : fill,
            stroke,
            strokeWidth,
            sides: kind === "polygon" ? 6 : undefined,
            radius: kind === "rect" ? 0 : undefined,
          };
          mapActive((d) => ({ ...d, layers: [...d.layers, layer] }));
          set({ selectedLayerId: id, tool: "select" });
          return id;
        },
        addTextAt: (x, y) => {
          snapshot();
          const draft = get().ensureDraft();
          const id = uid("text");
          const w = Math.max(120, draft.width * 0.28);
          const h = Math.max(48, draft.height * 0.14);
          const layer: TextLayer = {
            id,
            type: "text",
            role: "notes",
            x,
            y,
            w,
            h,
            text: "글자를 입력하세요",
            fontFamily: get().brief.titleFont,
            fontWeight: 700,
            fontSize: Math.round(h * 0.45),
            fill: get().fill,
            align: "start",
            name: "글자",
          };
          mapActive((d) => ({ ...d, layers: [...d.layers, layer] }));
          set({ selectedLayerId: id, tool: "select", mode: "edit" });
          return id;
        },
        deleteSelected: () => {
          const { selectedLayerId } = get();
          if (!selectedLayerId) return;
          snapshot();
          mapActive((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== selectedLayerId) }));
          set({ selectedLayerId: null });
        },
        duplicateSelected: () => {
          const { selectedLayerId, drafts, activeId } = get();
          const draft = drafts.find((d) => d.id === activeId);
          const layer = draft?.layers.find((l) => l.id === selectedLayerId);
          if (!layer) return;
          snapshot();
          const copy = { ...layer, id: uid("copy"), x: layer.x + 16, y: layer.y + 16 } as Layer;
          mapActive((d) => ({ ...d, layers: [...d.layers, copy] }));
          set({ selectedLayerId: copy.id });
        },
        copySelected: () => {
          const { selectedLayerId, drafts, activeId } = get();
          const draft = drafts.find((d) => d.id === activeId);
          const layer = draft?.layers.find((l) => l.id === selectedLayerId);
          if (!layer) return;
          set({ clipboard: JSON.parse(JSON.stringify(layer)) as Layer });
        },
        pasteClipboard: () => {
          const { clipboard } = get();
          if (!clipboard) return;
          snapshot();
          get().ensureDraft();
          const copy = {
            ...clipboard,
            id: uid("paste"),
            x: clipboard.x + 24,
            y: clipboard.y + 24,
            locked: false,
          } as Layer;
          mapActive((d) => ({ ...d, layers: [...d.layers, copy] }));
          set({ selectedLayerId: copy.id, mode: "edit", tool: "select" });
        },
        flipSelected: (axis) => {
          const { selectedLayerId, drafts, activeId } = get();
          const draft = drafts.find((d) => d.id === activeId);
          const layer = draft?.layers.find((l) => l.id === selectedLayerId);
          if (!layer || layer.locked) return;
          snapshot();
          if (axis === "h") get().patchLayer(layer.id, { scaleX: -(layer.scaleX ?? 1) });
          else get().patchLayer(layer.id, { scaleY: -(layer.scaleY ?? 1) });
        },
        nudgeSelected: (dx, dy) => {
          const { selectedLayerId } = get();
          if (!selectedLayerId) return;
          mapActive((d) => ({
            ...d,
            layers: d.layers.map((l) =>
              l.id === selectedLayerId && !l.locked ? { ...l, x: l.x + dx, y: l.y + dy } : l,
            ),
          }));
        },
        reorderSelected: (dir) => {
          const { selectedLayerId } = get();
          if (!selectedLayerId) return;
          snapshot();
          mapActive((d) => {
            const i = d.layers.findIndex((l) => l.id === selectedLayerId);
            if (i < 0) return d;
            const next = [...d.layers];
            const [item] = next.splice(i, 1);
            if (dir === "front") next.push(item);
            else if (dir === "back") next.unshift(item);
            else if (dir === "up") next.splice(Math.min(next.length, i + 1), 0, item);
            else next.splice(Math.max(0, i - 1), 0, item);
            return { ...d, layers: next };
          });
        },
        alignSelected: (edge) => {
          const { selectedLayerId, drafts, activeId } = get();
          const draft = drafts.find((d) => d.id === activeId);
          const layer = draft?.layers.find((l) => l.id === selectedLayerId);
          if (!draft || !layer) return;
          snapshot();
          const patch: Partial<Layer> = {};
          if (edge === "left") patch.x = 0;
          if (edge === "center") patch.x = (draft.width - layer.w) / 2;
          if (edge === "right") patch.x = draft.width - layer.w;
          if (edge === "top") patch.y = 0;
          if (edge === "middle") patch.y = (draft.height - layer.h) / 2;
          if (edge === "bottom") patch.y = draft.height - layer.h;
          get().patchLayer(layer.id, patch);
        },
        addUpload: async (file) => {
          const src = await fileToDataUrl(file);
          const item: UserAsset = {
            id: uid("up"),
            title: file.name.replace(/\.[^.]+$/, "") || "내 파일",
            category: "modern",
            tags: ["업로드"],
            src,
            original: false,
            uploaded: true,
          };
          const uploads = [...get().uploads, item];
          set({ uploads });
          saveUploads(uploads);
          return item;
        },
        removeUpload: (id) => {
          const uploads = get().uploads.filter((u) => u.id !== id);
          set({ uploads });
          saveUploads(uploads);
        },
        undo: () => {
          const { history, drafts, activeId, future } = get();
          const prev = history[history.length - 1];
          if (!prev) return;
          set({
            history: history.slice(0, -1),
            future: [{ drafts: cloneDrafts(drafts), activeId }, ...future].slice(0, 40),
            drafts: cloneDrafts(prev.drafts),
            activeId: prev.activeId,
            selectedLayerId: null,
          });
        },
        redo: () => {
          const { future, drafts, activeId, history } = get();
          const next = future[0];
          if (!next) return;
          set({
            future: future.slice(1),
            history: [...history, { drafts: cloneDrafts(drafts), activeId }],
            drafts: cloneDrafts(next.drafts),
            activeId: next.activeId,
            selectedLayerId: null,
          });
        },
        checkpoint: () => snapshot(),
        setSnap: (snap) => set({ snap }),
        setShowGrid: (showGrid) => set({ showGrid }),
        setShowSafeArea: (showSafeArea) => set({ showSafeArea }),
        setLibraryFolder: (libraryFolder) => set({ libraryFolder, mode: "library" }),
        setLibraryQuery: (libraryQuery) => set({ libraryQuery }),
        setEditingText: (editingTextId) => set({ editingTextId }),
        setPickingFocus: (pickingFocus) => set({ pickingFocus }),
        addReflowDraft: (width, height, label) => {
          const current = get().drafts.find((draft) => draft.id === get().activeId) ?? get().drafts[0];
          if (!current || width < 10 || height < 10) return;
          snapshot();
          const next = reflowToSize(current, width, height, label);
          set({ drafts: [...get().drafts, next], activeId: next.id, selectedLayerId: null, mode: "edit" });
        },
        applyReviewFix: (fix) => {
          const current = get().drafts.find((draft) => draft.id === get().activeId);
          if (!current) return;
          snapshot();
          const next = applyProductionFix(current, get().brief, fix);
          set({
            drafts: get().drafts.map((draft) => (draft.id === current.id ? next : draft)),
            activeId: current.id,
          });
        },
        handToDesigner: () => {
          const { brief, drafts, activeId } = get();
          const current = drafts.find((draft) => draft.id === activeId);
          const photoLayer = current?.layers.find((layer) => layer.type === "image" && layer.role === "photo");
          const logoLayer = current?.layers.find((layer) => layer.type === "image" && layer.role === "logo");
          const photo = brief.photoDataUrl || (photoLayer?.type === "image" ? photoLayer.href : null);
          const logo = brief.logoDataUrl || (logoLayer?.type === "image" ? logoLayer.href : null);
          const size = current ? { w: current.width, h: current.height } : sizeOf(brief);
          snapshot();
          const made = composeDesignerDrafts(brief, size.w, size.h, { photo, logo });
          set({ drafts: made, activeId: made[0]?.id ?? null, selectedLayerId: null, mode: "edit" });
        },
      };
    },
    {
      name: "ad-studio-ui-v5",
      partialize: (s) => ({ theme: s.theme, aiQuality: s.aiQuality, snap: s.snap, showGrid: s.showGrid, showSafeArea: s.showSafeArea }),
    },
  ),
);

export function hydrateStudio() {
  try {
    const theme = localStorage.getItem("ad-studio-ui-theme");
    if (theme === "dark" || theme === "light") {
      useStudio.getState().setTheme(theme);
    } else if (useStudio.getState().theme === "dark") {
      document.documentElement.classList.add("dark");
    }
    const saved = loadAutosave();
    if (saved?.drafts?.length) {
      useStudio.setState({
        brief: { ...DEFAULT_BRIEF, ...saved.brief },
        drafts: saved.drafts.map((draft) => {
          const normalized = normalizeBackgrounds(draft);
          return draft.source === "reference" && draft.layoutVersion !== 2
            ? resizeReferenceDraft(normalized, { ...DEFAULT_BRIEF, ...saved.brief }, draft.width, draft.height)
            : normalized;
        }),
        activeId: saved.drafts.some((d) => d.id === saved.activeId) ? saved.activeId : saved.drafts[0].id,
        uploads: loadUploads(), mode: "edit",
      });

    } else {
      const brief: Brief = {
        ...loadBrief(), sizeId: "custom", customW: 2500, customH: 700,
        industry: "event", purpose: "custom", mood: "warm",
        name: "보훈가족 봉사활동 현수막",
        headline: "2026 보훈가족 온 하우스 프로젝트",
        subhead: "사랑과 나눔으로 더 따뜻한 세상을 만들어갑니다.",
        notes: "따뜻하고 밝은 봉사활동 현수막. 꽃과 자연을 활용하고 제목을 크게 표현해 주세요.",
        baseColor: "#102f70", accentColor: "#e83586",
      };
      const drafts = [referenceDraft(brief), ...composeTypeDrafts(brief, 2500, 700).slice(1)];
      useStudio.setState({ brief, drafts, activeId: drafts[0].id, uploads: loadUploads(), mode: "edit" });
    }
  } catch {
    /* ignore */
  }
}
