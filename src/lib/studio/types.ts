export type ProductKind =
  | "banner"
  | "zoom"
  | "web"
  | "card"
  | "flyer"
  | "sticker"
  | "custom";

export type Industry =
  | "food"
  | "shop"
  | "realty"
  | "academy"
  | "church"
  | "hospital"
  | "construction"
  | "beauty"
  | "auto"
  | "event"
  | "recruit"
  | "general";

export type Mood =
  | "bold"
  | "urgent"
  | "luxury"
  | "solemn"
  | "warm"
  | "friendly"
  | "restrained";

export type Emphasize = "copy" | "name" | "phone" | "price" | "date";

export type TextZone = "left" | "right" | "top" | "bottom" | "center";

export type DraftSource = "type" | "ai" | "blank" | "reference";

export type Align = "start" | "middle" | "end";

export type EditorTool =
  | "select"
  | "text"
  | "rect"
  | "ellipse"
  | "line"
  | "polygon"
  | "eyedropper"
  | "pan";

export type SizePreset = {
  id: string;
  kind: ProductKind;
  label: string;
  note?: string;
  wMm: number;
  hMm: number;
};

export type Palette = {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
};

export type Brief = {
  sizeId: string;
  customW: number;
  customH: number;
  industry: Industry;
  purpose: string;
  readDistanceM: number;
  mood: Mood;
  emphasize: Emphasize;
  name: string;
  headline: string;
  subhead: string;
  price: string;
  date: string;
  place: string;
  phone: string;
  address: string;
  notes: string;
  baseColor: string;
  accentColor: string;
  titleFont: string;
  bodyFont: string;
  applyFontsToNewOnly: boolean;
  logoDataUrl: string | null;
  photoDataUrl: string | null;
};

export type LayerMeta = {
  opacity?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  locked?: boolean;
  hidden?: boolean;
  name?: string;
};

export type RectLayer = LayerMeta & {
  id: string;
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
};

export type TextLayer = LayerMeta & {
  id: string;
  type: "text";
  role: "name" | "headline" | "subhead" | "price" | "date" | "place" | "phone" | "address" | "notes";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  fill: string;
  align: Align;
  letterSpacing?: number;
  lineHeight?: number;
};

export type ImageLayer = LayerMeta & {
  id: string;
  type: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  href: string;
  fit: "adaptive" | "responsive" | "cover" | "contain";
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  backgroundFill?: string;
  backgroundSource?: string;
  role?: "background" | "photo" | "logo";
  /** 원본 이미지 기준 0–1. 잘라 채울 때 이 영역이 프레임 안에 남는다. */
  focus?: { x: number; y: number; w: number; h: number };
  protectMode?: "off" | "auto" | "manual";
  originalHref?: string;
};

export type ShapeKind = "rect" | "ellipse" | "line" | "polygon";

export type ShapeLayer = LayerMeta & {
  id: string;
  type: "shape";
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius?: number;
  sides?: number;
};

export type Layer = RectLayer | TextLayer | ImageLayer | ShapeLayer;

export type Draft = {
  layoutVersion?: number;
  id: string;
  letter: "A" | "B" | "C";
  title: string;
  source: DraftSource;
  width: number;
  height: number;
  layers: Layer[];
  palette: Palette;
  aiImage?: string;
  aiPrompt?: string;
  textZone?: TextZone;
};

export type AiDirection = {
  letter: "A" | "B" | "C";
  title: string;
  textZone: TextZone;
  palette: Palette;
  prompt: string;
};

export type StudioMode = "order" | "brief" | "ai" | "edit" | "library";

export const DEFAULT_BRIEF: Brief = {
  sizeId: "banner-200x60",
  customW: 2000,
  customH: 600,
  industry: "food",
  purpose: "open",
  readDistanceM: 8,
  mood: "warm",
  emphasize: "copy",
  name: "",
  headline: "",
  subhead: "",
  price: "",
  date: "",
  place: "",
  phone: "",
  address: "",
  notes: "",
  baseColor: "#1c1917",
  accentColor: "#c2410c",
  titleFont: "'Black Han Sans', sans-serif",
  bodyFont: "'Noto Sans KR', sans-serif",
  applyFontsToNewOnly: true,
  logoDataUrl: null,
  photoDataUrl: null,
};
