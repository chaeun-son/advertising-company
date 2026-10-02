/** 프로그램 브랜드. 화면 문구와 로고 경로는 여기만 고친다. */
export const brand = {
  name: "CRESORA Studio",
  tagline: "Create · Manage · Deliver",
  logo: {
    header: "/brand/cresora_header_logo.png",
    lockup: "/brand/cresora_logo_horizontal_transparent.png",
    symbol: "/brand/cresora_symbol_transparent.png",
    app: "/brand/cresora_app_icon.png",
    favicon: "/favicon.ico",
    apple: "/__grok/icon-180.png",
    pwa192: "/brand/icon-192.png",
    pwa512: "/brand/icon-512.png",
  },
} as const;

export const PRODUCT_NAME = brand.name;
export const PRODUCT_TAGLINE = brand.tagline;

export const BRAND = {
  header: brand.logo.header,
  lockup: brand.logo.lockup,
  symbol: brand.logo.symbol,
  icon: brand.logo.app,
  app: brand.logo.app,
  favicon: brand.logo.favicon,
  apple: brand.logo.apple,
  pwa192: brand.logo.pwa192,
  pwa512: brand.logo.pwa512,
} as const;

/** 고객 PDF·PNG·SVG·MP4·WEBM에 프로그램 로고를 넣지 않기 위한 걸러내기. */
export function isProgramBrandAsset(url?: string) {
  if (!url) return false;
  return /adsmile-(?:mark|logo)|\/brand\/cresora|cresora[-_](?:mark|app|header|logo|symbol)|favicon\.ico|icon-180|icon-192|icon-512/i.test(url);
}

/** 사용자가 고른 로고만 통과. 프로그램 자산 경로는 납품물에 넣지 않는다. */
export function customerBrandLogo(url?: string) {
  if (!url) return undefined;
  const clean = url.trim();
  if (!clean || isProgramBrandAsset(clean)) return undefined;
  return clean;
}

/** 운영 백업 파일명용. 고객 납품 파일명에는 쓰지 않는다. */
export function brandFileSlug(name: string = brand.name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "backup";
}
