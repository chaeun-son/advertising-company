export const PROD_DB_ERROR =
  "DATABASE_URL이 없습니다. Vercel에서는 PostgreSQL만 사용할 수 있습니다. pglite.data 같은 로컬 파일 DB는 만들지 않습니다. Vercel 환경변수에 DATABASE_URL을 넣고 다시 배포하세요.";

export function readDatabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  const value = env["DATABASE_URL"];
  return value && value.trim() ? value.trim() : undefined;
}

/** Vercel 함수와 production 런타임. 로컬 `vite dev`는 여기 해당하지 않는다. */
export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env["VERCEL"] === "1") return true;
  const vercelEnv = env["VERCEL_ENV"];
  if (vercelEnv === "production" || vercelEnv === "preview") return true;
  return env["NODE_ENV"] === "production";
}

/** postgres: 외부 DB. pglite: 로컬 개발 전용. missing: 프로덕션인데 URL 없음. */
export function resolveDbPlan(env: NodeJS.ProcessEnv): "postgres" | "pglite" | "missing" {
  if (readDatabaseUrl(env)) return "postgres";
  if (isProductionRuntime(env)) return "missing";
  return "pglite";
}
