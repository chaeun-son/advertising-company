import assert from "node:assert/strict";
import test from "node:test";
import { rewriteClipUrl } from "./project-db.ts";

test("local photo urls are stored as project keys", () => {
  const photos = new Map([["blob:photo", "photo:a"]]);
  const files = new Map([["blob:music", "file:b"]]);
  assert.equal(rewriteClipUrl("blob:photo", photos, files), "photo:a");
  assert.equal(rewriteClipUrl("/music/calm-a.mp3", photos, files), "/music/calm-a.mp3");
});
