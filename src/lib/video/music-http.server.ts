import { UnauthorizedError, requireUserId } from "@/lib/auth/verify.server";
import {
  addCustomCategory,
  contentTypeFor,
  deleteMusic,
  listCustomCategories,
  listMusic,
  patchMusic,
  readMusicBytes,
  readOwnedMusic,
  storageSummary,
  touchMusicUses,
  uploadMusic,
  verifyPlayUrl,
} from "@/lib/video/music-store.server";
import { BUILTIN_MUSIC_CATEGORIES } from "@/lib/video/music-plan";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function text(error: unknown) {
  return error instanceof Error ? error.message : "음악 보관함을 처리하지 못했습니다.";
}

async function libraryPayload(userId: string) {
  const [tracks, custom, storage] = await Promise.all([
    listMusic(userId),
    listCustomCategories(userId),
    storageSummary(userId),
  ]);
  const categories: string[] = [...BUILTIN_MUSIC_CATEGORIES];
  for (const name of custom) {
    if (!categories.includes(name)) categories.push(name);
  }
  return { tracks, categories, storage };
}

async function serveFile(id: string, request: Request) {
  const row = await readOwnedMusic(id);
  if (!row) return json({ error: "음악을 찾지 못했습니다." }, 404);
  const url = new URL(request.url);
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  const signed = Boolean(exp && sig && verifyPlayUrl(id, row.user_id, exp, sig));
  if (!signed) {
    const userId = await requireUserId();
    if (userId !== row.user_id) return json({ error: "이 음악을 재생할 수 없습니다." }, 403);
  }
  const bytes = await readMusicBytes(row);
  const type = contentTypeFor(row.format);
  const range = request.headers.get("range");
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = Math.min(bytes.length, Number(match[1]) || 0);
      const end = match[2] ? Math.min(bytes.length - 1, Number(match[2])) : bytes.length - 1;
      if (start <= end) {
        const slice = bytes.subarray(start, end + 1);
        return new Response(Buffer.from(slice), {
          status: 206,
          headers: {
            "content-type": type,
            "content-length": String(slice.byteLength),
            "content-range": `bytes ${start}-${end}/${bytes.byteLength}`,
            "accept-ranges": "bytes",
            "cache-control": "private, max-age=3600",
          },
        });
      }
    }
  }
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": type,
      "content-length": String(bytes.byteLength),
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
    },
  });
}

export async function handleMusicRequest(request: Request) {
  const url = new URL(request.url);
  const rest = url.pathname.replace(/\/+$/, "").split("/").slice(3);
  try {
    if (rest[0] === "file" && rest[1] && request.method === "GET") return await serveFile(decodeURIComponent(rest[1]), request);
    const userId = await requireUserId();
    if (rest[0] === "library" && rest.length === 1 && request.method === "GET") return json(await libraryPayload(userId));
    if (rest[0] === "library" && rest.length === 1 && request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("음악 파일을 선택해 주세요.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const category = String(form.get("category") ?? "기타");
      const result = await uploadMusic({
        userId,
        fileName: file.name || "music",
        mime: file.type || "",
        bytes,
        displayName: String(form.get("displayName") ?? ""),
        category,
        durationSec: Number(form.get("durationSec") ?? 0),
        tags: String(form.get("tags") ?? ""),
        source: String(form.get("source") ?? ""),
        license: String(form.get("license") ?? ""),
        vendor: String(form.get("vendor") ?? ""),
        note: String(form.get("note") ?? ""),
      });
      if (!(BUILTIN_MUSIC_CATEGORIES as readonly string[]).includes(category.trim())) {
        await addCustomCategory(userId, category).catch(() => undefined);
      }
      return json({ ...result, ...(await libraryPayload(userId)) });
    }
    if (rest[0] === "library" && rest[1] && request.method === "PATCH") {
      const body = (await request.json()) as Record<string, unknown>;
      const music = await patchMusic(userId, decodeURIComponent(rest[1]), {
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        category: typeof body.category === "string" ? body.category : undefined,
        tags: typeof body.tags === "string" ? body.tags : undefined,
        favorite: typeof body.favorite === "boolean" ? body.favorite : undefined,
        source: typeof body.source === "string" ? body.source : undefined,
        license: typeof body.license === "string" ? body.license : undefined,
        vendor: typeof body.vendor === "string" ? body.vendor : undefined,
        note: typeof body.note === "string" ? body.note : undefined,
      });
      if (typeof body.category === "string" && !(BUILTIN_MUSIC_CATEGORIES as readonly string[]).includes(body.category.trim())) {
        await addCustomCategory(userId, body.category).catch(() => undefined);
      }
      return json({ music, ...(await libraryPayload(userId)) });
    }
    if (rest[0] === "library" && rest[1] && request.method === "DELETE") {
      const confirm = url.searchParams.get("confirm") === "1";
      const result = await deleteMusic(userId, decodeURIComponent(rest[1]), confirm);
      return json({ ...result, ...(result.deleted ? await libraryPayload(userId) : {}) });
    }
    if (rest[0] === "categories" && request.method === "POST") {
      const body = (await request.json()) as { name?: string };
      const name = await addCustomCategory(userId, body.name ?? "");
      return json({ name, ...(await libraryPayload(userId)) });
    }
    if (rest[0] === "uses" && request.method === "POST") {
      const body = (await request.json()) as { projectKey?: string; projectName?: string; musicIds?: string[] };
      if (!body.projectKey) throw new Error("프로젝트를 알 수 없습니다.");
      await touchMusicUses(userId, body.projectKey, body.projectName ?? "", body.musicIds ?? []);
      return json({ ok: true });
    }
    return json({ error: "요청을 처리하지 못했습니다." }, 404);
  } catch (error) {
    if (error instanceof UnauthorizedError) return json({ error: "로그인이 필요합니다." }, 401);
    const missing = text(error).includes("Object Storage");
    return json({ error: text(error) }, missing ? 503 : 400);
  }
}
