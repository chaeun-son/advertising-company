import type { Pool, PoolClient } from "pg";

/** First try plus two retries. */
const ATTEMPTS = 3;
const RETRY_DELAYS_MS = [300, 900];
const WAKE_SQL = "select 1";
/** Skip the wake probe when this connection succeeded moments ago. */
const FRESH_MS = 15_000;

const TRANSIENT_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "EPIPE", "ECONNREFUSED"]);

export type RetryClient = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
  release: (err?: boolean | Error) => void;
};

/**
 * Connection-setup failures only. Wrong passwords, constraint failures, and
 * ordinary SQL errors are not transient and must surface immediately.
 */
export function isTransientConnectError(err: unknown): boolean {
  const seen = new Set<unknown>();
  const visit = (current: unknown): boolean => {
    if (!current || typeof current !== "object" || seen.has(current)) return false;
    seen.add(current);
    const record = current as {
      code?: unknown;
      errno?: unknown;
      message?: unknown;
      cause?: unknown;
      errors?: unknown;
    };
    const code = String(record.code ?? record.errno ?? "");
    if (/^08[0-9A-Z]{3}$/.test(code) || TRANSIENT_CODES.has(code)) return true;
    if (/^[0-9A-Z]{5}$/.test(code)) return false;
    const message = String(record.message ?? "").toLowerCase();
    if (
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("connection terminated")
    ) {
      return true;
    }
    if (visit(record.cause)) return true;
    return Array.isArray(record.errors) && record.errors.some(visit);
  };
  return visit(err);
}

/**
 * Check out a connection and run `select 1` before the caller sends SQL.
 * Neon can reset the first socket while a sleeping compute wakes. That probe
 * is safe to repeat. The caller's INSERT/UPDATE is intentionally outside this
 * loop so a statement that already reached the server is never sent twice.
 */
export async function acquireReadyClient<T extends RetryClient>(
  connect: () => Promise<T>,
  options: {
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
    freshUntil?: WeakMap<RetryClient, number>;
    freshMs?: number;
    onRetry?: (err: unknown, attempt: number) => void;
  } = {},
): Promise<T> {
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const freshUntil = options.freshUntil ?? new WeakMap<RetryClient, number>();
  const freshMs = options.freshMs ?? FRESH_MS;
  let last: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    let client: T | undefined;
    try {
      client = await connect();
      if (now() >= (freshUntil.get(client) ?? 0)) {
        await client.query(WAKE_SQL);
        freshUntil.set(client, now() + freshMs);
      }
      return client;
    } catch (err) {
      if (client) {
        freshUntil.delete(client);
        try {
          client.release(true);
        } catch {
          // The socket is already gone.
        }
      }
      last = err;
      if (!isTransientConnectError(err) || attempt === ATTEMPTS - 1) throw err;
      options.onRetry?.(err, attempt + 1);
      await sleep(RETRY_DELAYS_MS[attempt] ?? 900);
    }
  }
  throw last;
}

/** Wake Neon before Better Auth or app SQL sees the connection. */
export function attachConnectionRetry(pool: Pool, gate?: () => Promise<unknown>): void {
  const original = pool.connect.bind(pool) as () => Promise<PoolClient>;
  const freshUntil = new WeakMap<PoolClient, number>();
  pool.connect = ((cb?: (err: Error | undefined, client?: PoolClient, done?: (err?: Error) => void) => void) => {
    const ready = (async () => {
      if (gate) await gate();
      return acquireReadyClient(() => original(), {
        freshUntil: freshUntil as WeakMap<RetryClient, number>,
        onRetry: (err, attempt) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[db] transient connection error, retry ${attempt}: ${message}`);
        },
      });
    })();
    if (typeof cb === "function") {
      ready.then(
        (client) => cb(undefined, client, (err?: Error) => client.release(err)),
        (err: unknown) => cb(err as Error),
      );
      return undefined as unknown as PoolClient;
    }
    return ready;
  }) as Pool["connect"];
}
