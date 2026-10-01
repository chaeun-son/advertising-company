import assert from "node:assert/strict";
import test from "node:test";
import { resolveDbPlan } from "./db-backend.ts";

test("local dev without DATABASE_URL uses pglite", () => {
  assert.equal(resolveDbPlan({ NODE_ENV: "development" }), "pglite");
});

test("DATABASE_URL always uses postgres", () => {
  assert.equal(
    resolveDbPlan({ NODE_ENV: "development", DATABASE_URL: " postgres://db " }),
    "postgres",
  );
});

test("vercel without DATABASE_URL does not fall back to pglite", () => {
  assert.equal(resolveDbPlan({ VERCEL: "1", NODE_ENV: "production" }), "missing");
  assert.equal(resolveDbPlan({ VERCEL_ENV: "preview" }), "missing");
});
