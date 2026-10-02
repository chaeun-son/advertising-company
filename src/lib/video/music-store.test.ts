import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deleteMusic, listMusic, readMusicBytes, storageSummary, touchMusicUses, uploadMusic } from "./music-store.server.ts";

const userA = "music-test-a";
const userB = "music-test-b";

test("upload, reload, other account, duplicate hash, delete guard, and bytes", async () => {
  const bytes = new Uint8Array(await readFile(new URL("../../../public/music/calm-a.mp3", import.meta.url)));
  const first = await uploadMusic({
    userId: userA,
    fileName: "afternoon.mp3",
    mime: "audio/mpeg",
    bytes,
    displayName: "오후 연습",
    category: "잔잔",
    durationSec: 26,
    tags: "연습",
    source: "직접 제작",
    license: "자체",
    vendor: "",
    note: "",
  });
  assert.equal(first.duplicate, false);
  assert.equal(first.music.format, "mp3");
  assert.equal(first.music.displayName, "오후 연습");
  const again = await listMusic(userA);
  assert.ok(again.some((row) => row.id === first.music.id));
  const other = await listMusic(userB);
  assert.equal(other.some((row) => row.id === first.music.id), false);
  const duplicate = await uploadMusic({
    userId: userA,
    fileName: "copy.mp3",
    mime: "audio/mpeg",
    bytes,
    displayName: "같은 파일",
    category: "잔잔",
    durationSec: 26,
    tags: "",
    source: "",
    license: "",
    vendor: "",
    note: "",
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.music.id, first.music.id);
  await touchMusicUses(userA, "project-1", "가족 영상", [first.music.id]);
  await touchMusicUses(userA, "project-2", "행사 영상", [first.music.id]);
  await touchMusicUses(userA, "project-1", "가족 영상", [first.music.id]);
  const blocked = await deleteMusic(userA, first.music.id, false);
  assert.equal(blocked.deleted, false);
  assert.equal(blocked.projectCount, 2);
  const summary = await storageSummary(userA);
  assert.ok(summary.musicCount >= 1);
  assert.ok(summary.musicBytes >= bytes.byteLength);
  assert.equal(summary.quotaBytes, 1024 * 1024 * 1024);
  const stored = await readMusicBytes({ storage_key: `music/${userA}/${first.music.id}`, blob_url: null } as never);
  assert.equal(stored.byteLength, bytes.byteLength);
  assert.equal(stored[0], bytes[0]);
  const removed = await deleteMusic(userA, first.music.id, true);
  assert.equal(removed.deleted, true);
  assert.equal((await listMusic(userA)).some((row) => row.id === first.music.id), false);
});
