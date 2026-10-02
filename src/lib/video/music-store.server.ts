import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { putObject, readObject, removeObject } from "@/lib/storage/object-store.server";
import { BUILTIN_MUSIC_CATEGORIES, MUSIC_FILE_LIMIT, MUSIC_QUOTA } from "@/lib/video/music-plan";

export type MusicRow = {
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

type DbMusic = {
  id: string;
  user_id: string;
  file_name: string;
  display_name: string;
  file_url: string;
  storage_key: string;
  byte_size: number;
  duration_sec: number;
  format: string;
  created_at: string | Date;
  category: string;
  tags: string;
  favorite: boolean;
  content_hash: string;
  source: string;
  license: string;
  vendor: string;
  note: string;
  blob_url?: string | null;
};

const AUDIO_EXT = new Set(["mp3", "wav", "m4a", "aac", "ogg"]);

function secret() {
  return process.env.BETTER_AUTH_SECRET || process.env.OBJECT_URL_SECRET || "adsmile-preview-music-url";
}

function sign(id: string, userId: string, exp: number) {
  return createHmac("sha256", secret()).update(`${id}.${userId}.${exp}`).digest("base64url");
}

export function playUrlFor(id: string, userId: string, ttlSec = 60 * 60 * 12) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = sign(id, userId, exp);
  return `/api/music/file/${id}?exp=${exp}&sig=${sig}`;
}

export function verifyPlayUrl(id: string, userId: string, exp: string, sig: string) {
  const when = Number(exp);
  if (!Number.isFinite(when) || when < Math.floor(Date.now() / 1000)) return false;
  const expected = sign(id, userId, when);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

function asText(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapRow(row: DbMusic, userId: string, projectCount = 0): MusicRow {
  return {
    id: row.id,
    fileName: row.file_name,
    displayName: row.display_name,
    fileUrl: row.file_url,
    playUrl: playUrlFor(row.id, userId),
    byteSize: Number(row.byte_size) || 0,
    durationSec: Number(row.duration_sec) || 0,
    format: row.format,
    createdAt: asText(row.created_at),
    category: row.category,
    tags: row.tags ?? "",
    favorite: Boolean(row.favorite),
    source: row.source ?? "",
    license: row.license ?? "",
    vendor: row.vendor ?? "",
    note: row.note ?? "",
    projectCount,
  };
}

export function audioFormat(fileName: string, mime: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (AUDIO_EXT.has(ext)) return ext;
  const type = mime.toLowerCase();
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("aac") && !type.includes("mp4")) return "aac";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  return "";
}

export function contentTypeFor(format: string) {
  if (format === "mp3") return "audio/mpeg";
  if (format === "wav") return "audio/wav";
  if (format === "ogg") return "audio/ogg";
  if (format === "aac") return "audio/aac";
  if (format === "m4a") return "audio/mp4";
  return "application/octet-stream";
}

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export async function storageSummary(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ kind: string; n: number; bytes: number }>(
    `select kind, count(*)::int as n, coalesce(sum(byte_size), 0)::int as bytes
       from user_storage_objects where user_id = $1 group by kind`,
    [userId],
  );
  const music = rows.find((row) => row.kind === "music");
  const bytes = rows.reduce((sum, row) => sum + Number(row.bytes || 0), 0);
  return {
    musicCount: Number(music?.n ?? 0),
    musicBytes: Number(music?.bytes ?? 0),
    totalBytes: bytes,
    quotaBytes: MUSIC_QUOTA,
    fileLimit: MUSIC_FILE_LIMIT,
  };
}

export async function listMusic(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<DbMusic>(
    `select * from user_music where user_id = $1 order by favorite desc, created_at desc`,
    [userId],
  );
  const uses = await sql.query<{ music_id: string; n: number }>(
    `select music_id, count(distinct project_key)::int as n
       from user_music_uses where user_id = $1 group by music_id`,
    [userId],
  );
  const counts = new Map(uses.map((row) => [row.music_id, Number(row.n) || 0]));
  return rows.map((row) => mapRow(row, userId, counts.get(row.id) ?? 0));
}

export async function listCustomCategories(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ name: string }>(
    `select name from user_music_categories where user_id = $1 order by name`,
    [userId],
  );
  return rows.map((row) => row.name);
}

export async function addCustomCategory(userId: string, name: string) {
  const label = clean(name, 20);
  if (!label) throw new Error("분류 이름을 적어 주세요.");
  if ((BUILTIN_MUSIC_CATEGORIES as readonly string[]).includes(label)) return label;
  const sql = await getSql();
  await sql.query(
    `insert into user_music_categories (id, user_id, name) values ($1, $2, $3)
     on conflict (user_id, name) do nothing`,
    [crypto.randomUUID(), userId, label],
  );
  return label;
}

export async function uploadMusic(input: {
  userId: string;
  fileName: string;
  mime: string;
  bytes: Uint8Array;
  displayName: string;
  category: string;
  durationSec: number;
  tags: string;
  source: string;
  license: string;
  vendor: string;
  note: string;
}) {
  const format = audioFormat(input.fileName, input.mime);
  if (!format) throw new Error("MP3, WAV, M4A, AAC, OGG만 올릴 수 있습니다.");
  if (input.bytes.byteLength <= 0) throw new Error("빈 파일입니다.");
  if (input.bytes.byteLength > MUSIC_FILE_LIMIT) throw new Error("한 곡은 40MB까지 올릴 수 있습니다.");
  const sql = await getSql();
  const used = await sql.query<{ bytes: number }>(
    `select coalesce(sum(byte_size), 0)::int as bytes from user_storage_objects where user_id = $1`,
    [input.userId],
  );
  if (Number(used[0]?.bytes ?? 0) + input.bytes.byteLength > MUSIC_QUOTA) {
    throw new Error("저장 공간이 가득 찼습니다. 1GB까지 보관할 수 있습니다.");
  }
  const hash = createHash("sha256").update(input.bytes).digest("hex");
  const existing = await sql.query<DbMusic>(
    `select * from user_music where user_id = $1 and content_hash = $2 limit 1`,
    [input.userId, hash],
  );
  if (existing[0]) return { duplicate: true as const, music: mapRow(existing[0], input.userId) };
  const id = crypto.randomUUID();
  const storageKey = `music/${input.userId.replace(/[^a-zA-Z0-9_-]/g, "_")}/${id}`;
  const stored = await putObject(storageKey, input.bytes, contentTypeFor(format));
  const fileUrl = `/api/music/file/${id}`;
  const display = clean(input.displayName, 80) || clean(input.fileName.replace(/\.[^.]+$/, ""), 80) || "배경음악";
  const category = clean(input.category, 20) || "기타";
  try {
    await sql.query(
      `insert into user_music (
         id, user_id, file_name, display_name, file_url, storage_key, byte_size, duration_sec, format,
         category, tags, favorite, content_hash, blob_url, source, license, vendor, note
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12,$13,$14,$15,$16,$17)`,
      [
        id,
        input.userId,
        clean(input.fileName, 180) || `music.${format}`,
        display,
        fileUrl,
        stored.key,
        stored.bytes,
        Number.isFinite(input.durationSec) ? Math.max(0, input.durationSec) : 0,
        format,
        category,
        clean(input.tags, 120),
        hash,
        stored.blobUrl ?? null,
        clean(input.source, 200),
        clean(input.license, 200),
        clean(input.vendor, 200),
        clean(input.note, 400),
      ],
    );
    await sql.query(
      `insert into user_storage_objects (id, user_id, kind, storage_key, byte_size) values ($1,$2,'music',$3,$4)`,
      [id, input.userId, stored.key, stored.bytes],
    );
  } catch (error) {
    await removeObject(stored.key, stored.blobUrl);
    throw error;
  }
  const row = await sql.query<DbMusic>(`select * from user_music where id = $1 and user_id = $2`, [id, input.userId]);
  return { duplicate: false as const, music: mapRow(row[0]!, input.userId, 0) };
}

export async function patchMusic(userId: string, id: string, patch: Partial<{
  displayName: string;
  category: string;
  tags: string;
  favorite: boolean;
  source: string;
  license: string;
  vendor: string;
  note: string;
}>) {
  const sql = await getSql();
  const current = await sql.query<DbMusic>(`select * from user_music where id = $1 and user_id = $2`, [id, userId]);
  if (!current[0]) throw new Error("음악을 찾지 못했습니다.");
  const next = {
    display_name: patch.displayName !== undefined ? clean(patch.displayName, 80) : current[0].display_name,
    category: patch.category !== undefined ? clean(patch.category, 20) || "기타" : current[0].category,
    tags: patch.tags !== undefined ? clean(patch.tags, 120) : current[0].tags,
    favorite: patch.favorite !== undefined ? patch.favorite : current[0].favorite,
    source: patch.source !== undefined ? clean(patch.source, 200) : current[0].source,
    license: patch.license !== undefined ? clean(patch.license, 200) : current[0].license,
    vendor: patch.vendor !== undefined ? clean(patch.vendor, 200) : current[0].vendor,
    note: patch.note !== undefined ? clean(patch.note, 400) : current[0].note,
  };
  if (!next.display_name) throw new Error("음악 이름을 적어 주세요.");
  await sql.query(
    `update user_music set display_name=$1, category=$2, tags=$3, favorite=$4, source=$5, license=$6, vendor=$7, note=$8
      where id=$9 and user_id=$10`,
    [next.display_name, next.category, next.tags, next.favorite, next.source, next.license, next.vendor, next.note, id, userId],
  );
  const row = await sql.query<DbMusic>(`select * from user_music where id = $1 and user_id = $2`, [id, userId]);
  return mapRow(row[0]!, userId);
}

export async function musicUseCount(userId: string, id: string) {
  const sql = await getSql();
  const rows = await sql.query<{ n: number; name: string }>(
    `select count(distinct project_key)::int as n, coalesce(string_agg(distinct project_name, ', '), '') as name
       from user_music_uses where user_id = $1 and music_id = $2`,
    [userId, id],
  );
  return { count: Number(rows[0]?.n ?? 0), names: rows[0]?.name ?? "" };
}

export async function deleteMusic(userId: string, id: string, confirm: boolean) {
  const sql = await getSql();
  const rows = await sql.query<DbMusic>(
    `select * from user_music where id = $1 and user_id = $2`,
    [id, userId],
  );
  const row = rows[0];
  if (!row) throw new Error("음악을 찾지 못했습니다.");
  const usage = await musicUseCount(userId, id);
  if (usage.count > 0 && !confirm) {
    return { deleted: false as const, projectCount: usage.count, names: usage.names };
  }
  await removeObject(row.storage_key, row.blob_url);
  await sql.query(`delete from user_music_uses where user_id = $1 and music_id = $2`, [userId, id]);
  await sql.query(`delete from user_storage_objects where user_id = $1 and id = $2`, [userId, id]);
  await sql.query(`delete from user_music where user_id = $1 and id = $2`, [userId, id]);
  return { deleted: true as const, projectCount: usage.count, names: usage.names };
}

export async function touchMusicUses(userId: string, projectKey: string, projectName: string, musicIds: string[]) {
  const sql = await getSql();
  const ids = [...new Set(musicIds.filter(Boolean))];
  for (const musicId of ids) {
    const owned = await sql.query<{ id: string }>(`select id from user_music where id = $1 and user_id = $2`, [musicId, userId]);
    if (!owned[0]) continue;
    await sql.query(
      `insert into user_music_uses (id, user_id, music_id, project_key, project_name)
       values ($1,$2,$3,$4,$5)
       on conflict (user_id, music_id, project_key)
       do update set project_name = excluded.project_name, updated_at = now()`,
      [crypto.randomUUID(), userId, musicId, projectKey.slice(0, 80), clean(projectName, 80) || "영상"],
    );
  }
  return { ok: true };
}

export async function readOwnedMusic(id: string, userId?: string) {
  const sql = await getSql();
  const rows = userId
    ? await sql.query<DbMusic>(`select * from user_music where id = $1 and user_id = $2`, [id, userId])
    : await sql.query<DbMusic>(`select * from user_music where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function readMusicBytes(row: DbMusic) {
  return readObject(row.storage_key, row.blob_url);
}
