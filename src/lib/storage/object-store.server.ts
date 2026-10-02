import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isProductionRuntime } from "@/lib/db-backend";

/**
 * 음악 원본은 Postgres에 넣지 않는다.
 * - BLOB_READ_WRITE_TOKEN 이 있으면 Vercel Blob (오브젝트 스토리지).
 * - 로컬 미리보기는 디스크 오브젝트 저장소(.data/objects). 키만 DB에 남긴다.
 * - 배포 환경에서 토큰이 없으면 업로드를 거절한다. 임시 디스크는 다른 PC에서 안 보인다.
 */
const LOCAL_ROOT = process.env.OBJECT_STORE_DIR || path.join(process.cwd(), ".data", "objects");

export type StoredObject = {
  key: string;
  bytes: number;
  contentType: string;
  driver: "vercel-blob" | "local";
  blobUrl?: string;
};

function safeKey(key: string) {
  const clean = key.replace(/\\/g, "/").replace(/\.\./g, "").replace(/^\/+/, "");
  if (!clean || clean.includes("\0")) throw new Error("저장 경로가 올바르지 않습니다.");
  return clean;
}

export function objectDriver(): "vercel-blob" | "local" {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "vercel-blob";
  if (isProductionRuntime()) {
    throw new Error("음악 파일을 둘 Object Storage 토큰(BLOB_READ_WRITE_TOKEN)이 없습니다.");
  }
  return "local";
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<StoredObject> {
  const safe = safeKey(key);
  const driver = objectDriver();
  if (driver === "vercel-blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(safe, Buffer.from(body), {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType,
      addRandomSuffix: false,
    });
    return { key: safe, bytes: body.byteLength, contentType, driver, blobUrl: blob.url };
  }
  const full = path.join(LOCAL_ROOT, safe);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  return { key: safe, bytes: body.byteLength, contentType, driver };
}

export async function readObject(key: string, blobUrl?: string | null): Promise<Uint8Array> {
  if (blobUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    const response = await fetch(blobUrl);
    if (!response.ok) throw new Error("저장된 음악을 읽지 못했습니다.");
    return new Uint8Array(await response.arrayBuffer());
  }
  const full = path.join(LOCAL_ROOT, safeKey(key));
  const relative = path.relative(LOCAL_ROOT, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("저장 경로가 올바르지 않습니다.");
  return new Uint8Array(await readFile(full));
}

export async function removeObject(key: string, blobUrl?: string | null) {
  if (blobUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import("@vercel/blob");
      await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch {
      /* 이미 없는 파일은 메타데이터만 지운다 */
    }
    return;
  }
  if (objectDriver() === "vercel-blob") return;
  const full = path.join(LOCAL_ROOT, safeKey(key));
  await rm(full, { force: true });
}
