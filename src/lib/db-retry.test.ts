import assert from "node:assert/strict";
import test from "node:test";
import { acquireReadyClient, isTransientConnectError, type RetryClient } from "./db-retry.ts";

const noSleep = async () => {};

function client(query: RetryClient["query"]): RetryClient & { destroyed: boolean; queries: string[] } {
  const row = {
    destroyed: false,
    queries: [] as string[],
    query: async (text: string, params?: unknown[]) => {
      row.queries.push(text);
      return query(text, params);
    },
    release(err?: boolean | Error) {
      row.destroyed = err === true || err instanceof Error;
    },
  };
  return row;
}

test("retries ECONNRESET, ETIMEDOUT, and connection terminated only", () => {
  assert.equal(isTransientConnectError(Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" })), true);
  assert.equal(isTransientConnectError(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" })), true);
  assert.equal(isTransientConnectError(new Error("Connection terminated unexpectedly")), true);
  assert.equal(isTransientConnectError(Object.assign(new Error("duplicate key"), { code: "23505" })), false);
  assert.equal(isTransientConnectError(Object.assign(new Error("password authentication failed"), { code: "28P01" })), false);
  assert.equal(isTransientConnectError(Object.assign(new Error("syntax error"), { code: "42601" })), false);
});

test("a sleeping database is probed before an insert is sent", async () => {
  let connects = 0;
  const inserts: string[] = [];
  const ready = await acquireReadyClient(
    async () => {
      connects += 1;
      const current = connects;
      return client(async (text) => {
        if (text === "select 1" && current < 3) {
          throw Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
        }
        if (text.startsWith("insert")) inserts.push(text);
        return { rows: [] };
      });
    },
    { sleep: noSleep, onRetry() {} },
  );
  await ready.query("insert into orders (title) values ($1)", ["현수막"]);
  assert.equal(connects, 3);
  assert.deepEqual(inserts, ["insert into orders (title) values ($1)"]);
});

test("sql errors do not open another connection", async () => {
  let connects = 0;
  await assert.rejects(
    () =>
      acquireReadyClient(
        async () => {
          connects += 1;
          return client(async () => {
            throw Object.assign(new Error("duplicate key value"), { code: "23505" });
          });
        },
        { sleep: noSleep },
      ),
    /duplicate key/,
  );
  assert.equal(connects, 1);
});

test("a connection probed moments ago is not probed again", async () => {
  let pings = 0;
  const shared = client(async () => {
    pings += 1;
    return { rows: [] };
  });
  const freshUntil = new WeakMap<RetryClient, number>();
  let now = 1_000_000;
  const options = { sleep: noSleep, now: () => now, freshUntil, freshMs: 15_000 };
  await acquireReadyClient(async () => shared, options);
  now += 1_000;
  await acquireReadyClient(async () => shared, options);
  assert.equal(pings, 1);
  now += 20_000;
  await acquireReadyClient(async () => shared, options);
  assert.equal(pings, 2);
  assert.equal(shared.destroyed, false);
});
