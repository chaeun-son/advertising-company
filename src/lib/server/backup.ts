import { seoulMonth, shiftMonth } from "@/lib/format";
import { isProgramBrandAsset } from "@/lib/brand";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

const BACKUP_VERSION = 1;
const MAX_JSON = 12_000_000;

const rowsSchema = z.array(z.record(z.string(), z.unknown()));

const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  app: z.literal("adsmile").optional(),
  exportedAt: z.string().optional(),
  tables: z.object({
    company_profile: rowsSchema,
    staff: rowsSchema,
    products: rowsSchema,
    clients: rowsSchema,
    orders: rowsSchema,
    order_items: rowsSchema,
    drafts: rowsSchema,
    messages: rowsSchema,
    documents: rowsSchema,
  }),
});

export type ShopBackup = z.infer<typeof backupSchema>;

function pick(row: Record<string, unknown>, snake: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, snake)) return row[snake];
  const camel = snake.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
  if (Object.prototype.hasOwnProperty.call(row, camel)) return row[camel];
  return undefined;
}

function intVal(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function numVal(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function boolVal(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "t" || v === 1 || v === "1") return true;
  if (v === "false" || v === "f" || v === 0 || v === "0") return false;
  return fallback;
}

function strVal(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function companyLogoVal(v: unknown) {
  const url = strVal(v).trim();
  if (!url || isProgramBrandAsset(url) || url.length > 160_000) return "";
  if (!url.startsWith("data:image/") && !/^https?:\/\//i.test(url)) return "";
  return url;
}

function tsVal(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function idSet(rows: Record<string, unknown>[], key: string): Set<number> {
  return new Set(rows.map((row) => intVal(pick(row, key))).filter((n) => n > 0));
}

const SERIAL_TABLES = [
  "staff",
  "products",
  "clients",
  "orders",
  "order_items",
  "drafts",
  "messages",
  "documents",
] as const;

async function resetSerial(sql: Sql, table: (typeof SERIAL_TABLES)[number]) {
  await sql.query(
    `select setval(
       '${table}_id_seq',
       coalesce((select max(id) from ${table}), 1),
       (select max(id) from ${table}) is not null
     )`,
  );
}

export async function collectShopBackup(sql: Sql) {
  const [
    company,
    staff,
    products,
    clients,
    orders,
    orderItems,
    drafts,
    messages,
    documents,
  ] = await Promise.all([
    sql.query(`select * from company_profile order by id`),
    sql.query(`select * from staff order by id`),
    sql.query(`select * from products order by id`),
    sql.query(`select * from clients order by id`),
    sql.query(`select * from orders order by id`),
    sql.query(`select * from order_items order by id`),
    sql.query(`select * from drafts order by id`),
    sql.query(`select * from messages order by id`),
    sql.query(`select * from documents order by id`),
  ]);
  const backup = {
    version: BACKUP_VERSION,
    app: "adsmile" as const,
    exportedAt: new Date().toISOString(),
    tables: {
      company_profile: company,
      staff,
      products,
      clients,
      orders,
      order_items: orderItems,
      drafts,
      messages,
      documents,
    },
  };
  return {
    json: JSON.stringify(backup, null, 2),
    orderCount: orders.length,
    month: seoulMonth(),
  };
}

export const exportShopBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.userId) throw new Error("Unauthorized");
    const sql = await getSql();
    const collected = await collectShopBackup(sql);
    return { json: collected.json };
  });

export async function ensurePreviousMonthArchive() {
  const sql = await getSql();
  const current = seoulMonth();
  const prev = shiftMonth(current, -1);
  const collected = await collectShopBackup(sql);
  if (collected.orderCount === 0) return;
  const existing = await sql.query<{ month: string }>(
    `select month from monthly_archives where month in ($1, $2)`,
    [current, prev],
  );
  const have = new Set(existing.map((r) => r.month));
  if (!have.has(prev)) {
    await sql.query(
      `insert into monthly_archives (month, json, order_count) values ($1,$2,$3)
       on conflict (month) do nothing`,
      [prev, collected.json, collected.orderCount],
    );
  }
  if (!have.has(current)) {
    await sql.query(
      `insert into monthly_archives (month, json, order_count) values ($1,$2,$3)
       on conflict (month) do nothing`,
      [current, collected.json, collected.orderCount],
    );
  }
}

export const saveMonthlyArchive = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!context.userId) throw new Error("Unauthorized");
    const sql = await getSql();
    const collected = await collectShopBackup(sql);
    await sql.query(
      `insert into monthly_archives (month, json, order_count) values ($1,$2,$3)
       on conflict (month) do update set json = excluded.json, order_count = excluded.order_count, created_at = now()`,
      [collected.month, collected.json, collected.orderCount],
    );
    return { month: collected.month, orderCount: collected.orderCount };
  });

export const listMonthlyArchives = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    await ensurePreviousMonthArchive().catch(() => undefined);
    const sql = await getSql();
    const current = seoulMonth();
    const live = await sql.query<{ n: number }>(`select count(*)::int as n from orders`);
    const liveCount = Number(live[0]?.n) || 0;
    const rows = await sql.query<{ month: string; order_count: number; created_at: unknown }>(
      `select month, order_count, created_at from monthly_archives order by month desc`,
    );
    const mapped = rows.map((r) => ({
      month: r.month,
      orderCount: r.month === current ? liveCount : Number(r.order_count) || 0,
      savedAt: String(r.created_at ?? ""),
      current: r.month === current,
    }));
    if (!mapped.some((r) => r.month === current)) {
      mapped.unshift({
        month: current,
        orderCount: liveCount,
        savedAt: "",
        current: true,
      });
    }
    return mapped;
  });

export const getMonthlyArchive = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ json: string; order_count: number }>(
      `select json, order_count from monthly_archives where month = $1`,
      [data.month],
    );
    if (!rows[0]) {
      if (data.month !== seoulMonth()) throw new Error("그달 보관본이 없습니다.");
      const collected = await collectShopBackup(sql);
      return { json: collected.json, orderCount: collected.orderCount, month: data.month };
    }
    return { json: rows[0].json, orderCount: Number(rows[0].order_count) || 0, month: data.month };
  });

export const restoreShopBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ json: z.string().min(2).max(MAX_JSON) }))
  .handler(async ({ context, data }) => {
    if (!context.userId) throw new Error("Unauthorized");
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.json);
    } catch {
      throw new Error("백업 파일이 올바른 JSON이 아닙니다.");
    }
    const backup = backupSchema.parse(parsed);
    const { tables } = backup;
    if (tables.company_profile.length === 0) {
      throw new Error("회사 정보가 없는 백업입니다.");
    }
    if (tables.staff.length === 0) {
      throw new Error("직원 목록이 비어 있는 백업입니다.");
    }

    const clientIds = idSet(tables.clients, "id");
    const productIds = idSet(tables.products, "id");
    const orderIds = idSet(tables.orders, "id");
    for (const row of tables.orders) {
      const clientId = intVal(pick(row, "client_id"));
      if (!clientIds.has(clientId)) throw new Error("주문에 없는 거래처가 들어 있습니다.");
    }
    for (const row of tables.order_items) {
      if (!orderIds.has(intVal(pick(row, "order_id")))) {
        throw new Error("품목에 없는 주문이 들어 있습니다.");
      }
      const productId = intVal(pick(row, "product_id"));
      if (productId && !productIds.has(productId)) {
        throw new Error("품목에 없는 상품이 들어 있습니다.");
      }
    }
    for (const row of [...tables.drafts, ...tables.messages, ...tables.documents]) {
      if (!orderIds.has(intVal(pick(row, "order_id")))) {
        throw new Error("시안·대화·문서에 없는 주문이 들어 있습니다.");
      }
    }

    const sql = await getSql();
    await sql.query(`delete from documents`);
    await sql.query(`delete from messages`);
    await sql.query(`delete from drafts`);
    await sql.query(`delete from order_items`);
    await sql.query(`delete from orders`);
    await sql.query(`delete from clients`);
    await sql.query(`delete from products`);
    await sql.query(`delete from staff`);
    await sql.query(`delete from company_profile`);

    for (const row of tables.company_profile) {
      await sql.query(
        `insert into company_profile (
           id, name, owner_name, biz_no, phone, fax, address, email,
           bank_name, bank_account, bank_holder, seal_label, vat_included,
           rush_rate, quote_valid_days, biz_type, biz_item, invite_code,
           website, brand_color, logo_url
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [
          intVal(pick(row, "id"), 1),
          strVal(pick(row, "name"), ""),
          strVal(pick(row, "owner_name")),
          strVal(pick(row, "biz_no")),
          strVal(pick(row, "phone")),
          strVal(pick(row, "fax")),
          strVal(pick(row, "address")),
          strVal(pick(row, "email")),
          strVal(pick(row, "bank_name")),
          strVal(pick(row, "bank_account")),
          strVal(pick(row, "bank_holder")),
          strVal(pick(row, "seal_label")),
          boolVal(pick(row, "vat_included"), false),
          numVal(pick(row, "rush_rate"), 1.3),
          intVal(pick(row, "quote_valid_days"), 14),
          strVal(pick(row, "biz_type")),
          strVal(pick(row, "biz_item")),
          strVal(pick(row, "invite_code"), "adsmile"),
          strVal(pick(row, "website")),
          strVal(pick(row, "brand_color")),
          companyLogoVal(pick(row, "logo_url")),
        ],
      );
    }

    for (const row of tables.staff) {
      await sql.query(`insert into staff (id, name, role, created_at) values ($1,$2,$3,coalesce($4::timestamptz, now()))`, [
        intVal(pick(row, "id")),
        strVal(pick(row, "name")),
        strVal(pick(row, "role"), "직원"),
        tsVal(pick(row, "created_at")),
      ]);
    }

    for (const row of tables.products) {
      await sql.query(
        `insert into products (id, name, unit, unit_price, description, sort_order, active, category, min_qty)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          intVal(pick(row, "id")),
          strVal(pick(row, "name")),
          strVal(pick(row, "unit"), "㎡"),
          intVal(pick(row, "unit_price")),
          strVal(pick(row, "description")),
          intVal(pick(row, "sort_order")),
          boolVal(pick(row, "active"), true),
          strVal(pick(row, "category"), "기타"),
          intVal(pick(row, "min_qty"), 1),
        ],
      );
    }

    for (const row of tables.clients) {
      await sql.query(
        `insert into clients (id, name, contact, phone, memo, created_at, biz_no, address, email, biz_type, biz_item)
         values ($1,$2,$3,$4,$5,coalesce($6::timestamptz, now()),$7,$8,$9,$10,$11)`,
        [
          intVal(pick(row, "id")),
          strVal(pick(row, "name")),
          strVal(pick(row, "contact")),
          strVal(pick(row, "phone")),
          strVal(pick(row, "memo")),
          tsVal(pick(row, "created_at")),
          strVal(pick(row, "biz_no")),
          strVal(pick(row, "address")),
          strVal(pick(row, "email")),
          strVal(pick(row, "biz_type")),
          strVal(pick(row, "biz_item")),
        ],
      );
    }

    for (const row of tables.orders) {
      await sql.query(
        `insert into orders (
           id, order_no, client_id, title, status, due_date, rush, assignee,
           manuscript, notes, bg_color, text_color, created_by, created_at, updated_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,coalesce($14::timestamptz, now()), coalesce($15::timestamptz, now()))`,
        [
          intVal(pick(row, "id")),
          strVal(pick(row, "order_no")),
          intVal(pick(row, "client_id")),
          strVal(pick(row, "title")),
          strVal(pick(row, "status"), "received"),
          tsVal(pick(row, "due_date")),
          boolVal(pick(row, "rush")),
          strVal(pick(row, "assignee")),
          strVal(pick(row, "manuscript")),
          strVal(pick(row, "notes")),
          strVal(pick(row, "bg_color"), "#1c150e"),
          strVal(pick(row, "text_color"), "#fff6e8"),
          strVal(pick(row, "created_by")),
          tsVal(pick(row, "created_at")),
          tsVal(pick(row, "updated_at")),
        ],
      );
    }

    for (const row of tables.order_items) {
      await sql.query(
        `insert into order_items (
           id, order_id, product_id, product_name, unit, width_cm, height_cm, qty, unit_price, amount, memo, sort_order, copy
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          intVal(pick(row, "id")),
          intVal(pick(row, "order_id")),
          intVal(pick(row, "product_id")),
          strVal(pick(row, "product_name")),
          strVal(pick(row, "unit")),
          intVal(pick(row, "width_cm")),
          intVal(pick(row, "height_cm")),
          intVal(pick(row, "qty"), 1),
          intVal(pick(row, "unit_price")),
          intVal(pick(row, "amount")),
          strVal(pick(row, "memo")),
          intVal(pick(row, "sort_order")),
          strVal(pick(row, "copy")),
        ],
      );
    }

    for (const row of tables.drafts) {
      await sql.query(
        `insert into drafts (
           id, order_id, version, status, title, bg_color, text_color, image_data, notes, created_by, created_at, manuscript, width_cm, height_cm
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,coalesce($11::timestamptz, now()),$12,$13,$14)`,
        [
          intVal(pick(row, "id")),
          intVal(pick(row, "order_id")),
          intVal(pick(row, "version"), 1),
          strVal(pick(row, "status"), "working"),
          strVal(pick(row, "title"), "시안"),
          strVal(pick(row, "bg_color"), "#1c150e"),
          strVal(pick(row, "text_color"), "#fff6e8"),
          pick(row, "image_data") == null ? null : strVal(pick(row, "image_data")),
          strVal(pick(row, "notes")),
          strVal(pick(row, "created_by")),
          tsVal(pick(row, "created_at")),
          strVal(pick(row, "manuscript")),
          intVal(pick(row, "width_cm")),
          intVal(pick(row, "height_cm")),
        ],
      );
    }

    for (const row of tables.messages) {
      await sql.query(
        `insert into messages (id, order_id, staff_name, kind, body, created_at)
         values ($1,$2,$3,$4,$5,coalesce($6::timestamptz, now()))`,
        [
          intVal(pick(row, "id")),
          intVal(pick(row, "order_id")),
          strVal(pick(row, "staff_name")),
          strVal(pick(row, "kind"), "chat"),
          strVal(pick(row, "body")),
          tsVal(pick(row, "created_at")),
        ],
      );
    }

    for (const row of tables.documents) {
      const payload = pick(row, "payload");
      const payloadJson = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
      await sql.query(
        `insert into documents (id, order_id, doc_type, doc_no, issued_at, issued_by, payload)
         values ($1,$2,$3,$4,coalesce($5::timestamptz, now()),$6,$7::jsonb)`,
        [
          intVal(pick(row, "id")),
          intVal(pick(row, "order_id")),
          strVal(pick(row, "doc_type")),
          strVal(pick(row, "doc_no")),
          tsVal(pick(row, "issued_at")),
          strVal(pick(row, "issued_by")),
          payloadJson,
        ],
      );
    }

    await resetSerial(sql, "staff");
    await resetSerial(sql, "products");
    await resetSerial(sql, "clients");
    await resetSerial(sql, "orders");
    await resetSerial(sql, "order_items");
    await resetSerial(sql, "drafts");
    await resetSerial(sql, "messages");
    await resetSerial(sql, "documents");

    return {
      ok: true as const,
      restoredBy: context.userId,
      counts: {
        staff: tables.staff.length,
        products: tables.products.length,
        clients: tables.clients.length,
        orders: tables.orders.length,
        documents: tables.documents.length,
      },
    };
  });
