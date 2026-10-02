import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { isProgramBrandAsset } from "@/lib/brand";
import { authMiddleware } from "@/lib/auth/middleware";
import { chargedUnitPrice, isFlatPiece, lineAmount, specLabel, vatBreakdown } from "@/lib/pricing";
import { seoulMonth, mergeOrderMonths } from "@/lib/format";
import { ensurePreviousMonthArchive } from "./backup";
import type {
  CompanyProfile,
  DashboardData,
  DocPayload,
  DocumentRecord,
  OrderDetail,
  OrderStatus,
} from "@/lib/types";
import { ORDER_STATUSES, STATUS_META } from "@/lib/types";
import {
  ORDER_SELECT,
  mapClient,
  mapCompany,
  mapDoc,
  mapDraft,
  mapItem,
  mapMessage,
  mapOrder,
  mapProduct,
  mapStaff,
  type OrderRow,
} from "./mappers";

const staffName = z.string().trim().min(1, "작업자를 선택하세요");

const itemInput = z.object({
  productId: z.number().int().positive(),
  widthCm: z.number().int().nonnegative(),
  heightCm: z.number().int().nonnegative(),
  qty: z.number().int().positive(),
  memo: z.string().optional().default(""),
  copy: z.string().optional().default(""),
  unitPrice: z.number().int().nonnegative().nullable().optional(),
});

const orderWrite = z.object({
  clientId: z.number().int().positive(),
  title: z.string().trim().min(1),
  dueDate: z.string().nullable(),
  rush: z.boolean(),
  assignee: z.string().optional().default(""),
  manuscript: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  bgColor: z.string().optional().default("#1c150e"),
  textColor: z.string().optional().default("#fff6e8"),
  items: z.array(itemInput).min(1),
});

async function nextSerial(prefix: string, column: string, table: string) {
  const sql = await getSql();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const stamp = today.slice(2).replaceAll("-", "");
  const like = `${prefix}-${stamp}-%`;
  const rows = await sql.query<{ n: number }>(
    `select coalesce(max(substring(${column} from '[0-9]+$')::int), 0)::int as n
       from ${table} where ${column} like $1`,
    [like],
  );
  const n = (rows[0]?.n ?? 0) + 1;
  return `${prefix}-${stamp}-${String(n).padStart(3, "0")}`;
}

async function postMessage(
  orderId: number,
  staffNameValue: string,
  body: string,
  kind: "chat" | "system" = "system",
) {
  const sql = await getSql();
  await sql.query(
    `insert into messages (order_id, staff_name, kind, body) values ($1, $2, $3, $4)`,
    [orderId, staffNameValue, kind, body],
  );
}

async function writeItems(
  orderId: number,
  items: z.infer<typeof itemInput>[],
  rush: boolean,
  rushRate: number,
) {
  const sql = await getSql();
  const products = await sql.query<{
    id: number;
    name: string;
    unit: string;
    unit_price: number;
  }>(`select id, name, unit, unit_price from products`);
  const byId = new Map(products.map((p) => [Number(p.id), p]));
  await sql.query(`delete from order_items where order_id = $1`, [orderId]);
  let sort = 0;
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) throw new Error("없는 품목입니다.");
    const catalog = Number(product.unit_price);
    const unitPrice = chargedUnitPrice(catalog, item.unitPrice, rush, rushRate);
    const unit = isFlatPiece(product.name) ? "개" : product.unit;
    const amount = lineAmount({
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      qty: item.qty,
      unitPrice,
      unit,
      name: product.name,
    });
    await sql.query(
      `insert into order_items
        (order_id, product_id, product_name, unit, width_cm, height_cm, qty, unit_price, amount, memo, sort_order, copy)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        orderId,
        item.productId,
        product.name,
        unit,
        item.widthCm,
        item.heightCm,
        item.qty,
        unitPrice,
        amount,
        item.memo ?? "",
        sort,
        item.copy ?? "",
      ],
    );
    sort += 1;
  }
}

async function loadCompany(): Promise<CompanyProfile> {
  const sql = await getSql();
  const rows = await sql.query<Parameters<typeof mapCompany>[0]>(
    `select * from company_profile where id = 1`,
  );
  if (!rows[0]) throw new Error("회사 정보가 없습니다.");
  return mapCompany(rows[0]);
}

export const getBootstrap = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
  const sql = await getSql();
  const [companyRows, staffRows, productRows, clientRows] = await Promise.all([
    sql.query<Parameters<typeof mapCompany>[0]>(`select * from company_profile where id = 1`),
    sql.query<{ id: number; name: string; role: string }>(
      `select id, name, role from staff order by id`,
    ),
    sql.query<Parameters<typeof mapProduct>[0]>(
      `select * from products where active = true order by sort_order, id`,
    ),
    sql.query<Parameters<typeof mapClient>[0]>(
      `select * from clients order by name`,
    ),
  ]);
  if (!companyRows[0]) throw new Error("회사 정보가 없습니다.");
  return {
    company: mapCompany(companyRows[0]),
    staff: staffRows.map(mapStaff),
    products: productRows.map(mapProduct),
    clients: clientRows.map(mapClient),
  };
});

export const getStorageStats = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
  const sql = await getSql();
  const rows = await sql.query<{
    orders: number;
    drafts: number;
    images: number;
    image_bytes: string | number;
    clients: number;
  }>(
    `select
       (select count(*)::int from orders) as orders,
       (select count(*)::int from drafts) as drafts,
       (select count(*)::int from drafts where coalesce(image_data, '') <> '') as images,
       (select coalesce(sum(octet_length(image_data)), 0) from drafts) as image_bytes,
       (select count(*)::int from clients) as clients`,
  );
  let archiveBytes = 0;
  try {
    const archives = await sql.query<{ n: string | number }>(
      `select coalesce(sum(octet_length(json)), 0) as n from monthly_archives`,
    );
    archiveBytes = Number(archives[0]?.n) || 0;
  } catch {
    archiveBytes = 0;
  }
  const row = rows[0];
  return {
    orders: Number(row?.orders) || 0,
    drafts: Number(row?.drafts) || 0,
    images: Number(row?.images) || 0,
    clients: Number(row?.clients) || 0,
    imageBytes: Number(row?.image_bytes) || 0,
    archiveBytes,
  };
});

export const getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
  await ensurePreviousMonthArchive().catch(() => undefined);
  const sql = await getSql();
  const orders = (
    await sql.query<OrderRow>(
      `select ${ORDER_SELECT} from orders o join clients c on c.id = o.client_id
       order by case o.status
         when 'received' then 0 when 'drafting' then 1 when 'review' then 2
         when 'pay_wait' then 3 when 'pay_ok' then 4
         when 'production' then 5 when 'hold' then 6 else 7 end,
         o.due_date nulls last, o.created_at desc`,
    )
  ).map(mapOrder);

  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
    OrderStatus,
    number
  >;
  let todayDue = 0;
  let monthSupply = 0;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const monthPrefix = today.slice(0, 7);
  for (const order of orders) {
    counts[order.status] += 1;
    if (order.dueDate === today && order.status !== "done") todayDue += 1;
    if (order.createdAt.slice(0, 7) === monthPrefix) monthSupply += order.supplyAmount;
  }

  const recentMessages = (
    await sql.query<Parameters<typeof mapMessage>[0]>(
      `select m.id, m.order_id, o.order_no, o.title as order_title,
              m.staff_name, m.kind, m.body, m.created_at
         from messages m
         join orders o on o.id = m.order_id
        order by m.created_at desc
        limit 12`,
    )
  ).map(mapMessage);

  const data: DashboardData = {
    counts,
    todayDue,
    monthSupply,
    recentMessages,
    orders,
    months: mergeOrderMonths([orders.map((order) => seoulMonth(order.createdAt))]),
  };
  return data;
});

export const listOrders = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .validator(
    z.object({
      q: z.string().optional().default(""),
      status: z.string().optional().default("all"),
      month: z.string().optional().default(""),
    }),
  )
  .handler(async ({ data }) => {
    await ensurePreviousMonthArchive().catch(() => undefined);
    const sql = await getSql();
    const params: unknown[] = [];
    const where: string[] = [];
    if (data.status && data.status !== "all") {
      params.push(data.status);
      where.push(`o.status = $${params.length}`);
    }
    if (data.q.trim()) {
      params.push(`%${data.q.trim()}%`);
      const i = params.length;
      where.push(
        `(o.title ilike $${i} or o.order_no ilike $${i} or c.name ilike $${i} or o.manuscript ilike $${i})`,
      );
    }
    const clause = where.length ? `where ${where.join(" and ")}` : "";
    const rows = await sql.query<OrderRow>(
      `select ${ORDER_SELECT} from orders o join clients c on c.id = o.client_id
       ${clause}
       order by o.created_at desc`,
      params,
    );
    const mapped = rows.map(mapOrder);
    if (!data.month || data.month === "all") return mapped;
    return mapped.filter((o) => seoulMonth(o.createdAt) === data.month);
  });

export const listOrderMonths = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
  const sql = await getSql();
  const rows = await sql.query<{ month: string }>(
    `select to_char(created_at at time zone 'Asia/Seoul', 'YYYY-MM') as month
       from orders
      where created_at is not null
      group by 1
      order by 1 desc`,
  );
  const months = mergeOrderMonths([rows.map((row) => String(row.month ?? ""))]);
  return { months };
});

export const getOrder = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const orders = await sql.query<OrderRow>(
      `select ${ORDER_SELECT} from orders o join clients c on c.id = o.client_id where o.id = $1`,
      [data.id],
    );
    if (!orders[0]) throw new Error("주문을 찾을 수 없습니다.");
    const [items, drafts, messages, documents] = await Promise.all([
      sql.query<Parameters<typeof mapItem>[0]>(
        `select * from order_items where order_id = $1 order by sort_order, id`,
        [data.id],
      ),
      sql.query<Parameters<typeof mapDraft>[0]>(
        `select * from drafts where order_id = $1 order by version desc, id desc`,
        [data.id],
      ),
      sql.query<Parameters<typeof mapMessage>[0]>(
        `select * from messages where order_id = $1 order by created_at asc`,
        [data.id],
      ),
      sql.query<Parameters<typeof mapDoc>[0]>(
        `select id, order_id, doc_type, doc_no, issued_at, issued_by from documents
          where order_id = $1 order by issued_at desc`,
        [data.id],
      ),
    ]);
    for (const row of items) {
      const next = lineAmount({
        widthCm: Number(row.width_cm) || 0,
        heightCm: Number(row.height_cm) || 0,
        qty: Number(row.qty) || 0,
        unitPrice: Number(row.unit_price) || 0,
        unit: String(row.unit ?? ""),
        name: String(row.product_name ?? ""),
      });
      if (next !== Number(row.amount)) {
        await sql.query(`update order_items set amount = $1 where id = $2`, [next, row.id]);
        row.amount = next;
      }
    }
    const detail: OrderDetail = {
      ...mapOrder(orders[0]),
      items: items.map(mapItem),
      drafts: drafts.map(mapDraft),
      messages: messages.map(mapMessage),
      documents: documents.map((row) => {
        const d = mapDoc(row);
        return {
          id: d.id,
          orderId: d.orderId,
          docType: d.docType,
          docNo: d.docNo,
          issuedAt: d.issuedAt,
          issuedBy: d.issuedBy,
        };
      }),
    };
    return detail;
  });

export const createOrder = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(orderWrite.extend({ staffName }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const company = await loadCompany();
    const orderNo = await nextSerial("O", "order_no", "orders");
    const rows = await sql.query<{ id: number }>(
      `insert into orders (
         order_no, client_id, title, status, due_date, rush, assignee,
         manuscript, notes, bg_color, text_color, created_by
       ) values ($1,$2,$3,'received',$4,$5,$6,$7,$8,$9,$10,$11)
       returning id`,
      [
        orderNo,
        data.clientId,
        data.title,
        data.dueDate,
        data.rush,
        data.assignee ?? "",
        data.manuscript ?? "",
        data.notes ?? "",
        data.bgColor,
        data.textColor,
        data.staffName,
      ],
    );
    const id = Number(rows[0]!.id);
    await writeItems(id, data.items, data.rush, company.rushRate);
    await postMessage(
      id,
      data.staffName,
      `${data.staffName}님이 주문을 접수했습니다. ${orderNo}${data.rush ? " · 급행" : ""}`,
    );
    return { id, orderNo };
  });

export const updateOrder = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(orderWrite.extend({ id: z.number().int().positive(), staffName }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const company = await loadCompany();
    const updated = await sql.query<{ id: number }>(
      `update orders set
         client_id = $2, title = $3, due_date = $4, rush = $5, assignee = $6,
         manuscript = $7, notes = $8, bg_color = $9, text_color = $10, updated_at = now()
       where id = $1
       returning id`,
      [
        data.id,
        data.clientId,
        data.title,
        data.dueDate,
        data.rush,
        data.assignee ?? "",
        data.manuscript ?? "",
        data.notes ?? "",
        data.bgColor,
        data.textColor,
      ],
    );
    if (!updated[0]) throw new Error("주문을 찾을 수 없습니다.");
    await writeItems(data.id, data.items, data.rush, company.rushRate);
    await postMessage(data.id, data.staffName, `${data.staffName}님이 주문 내용을 수정했습니다.`);
    return { id: data.id };
  });

export const updateOrderStatus = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().positive(),
      status: z.enum(ORDER_STATUSES),
      staffName,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const updated = await sql.query<{ id: number }>(
      `update orders set status = $2, updated_at = now() where id = $1 returning id`,
      [data.id, data.status],
    );
    if (!updated[0]) throw new Error("주문을 찾을 수 없습니다.");
    await postMessage(
      data.id,
      data.staffName,
      `${data.staffName}님이 상태를 「${STATUS_META[data.status].label}」로 바꿨습니다.`,
    );
    return { ok: true };
  });

export const addMessage = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      orderId: z.number().int().positive(),
      staffName,
      body: z.string().trim().min(1).max(2000),
    }),
  )
  .handler(async ({ data }) => {
    await postMessage(data.orderId, data.staffName, data.body, "chat");
    const sql = await getSql();
    await sql.query(`update orders set updated_at = now() where id = $1`, [data.orderId]);
    return { ok: true };
  });

export const addDraft = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      orderId: z.number().int().positive(),
      staffName,
      title: z.string().trim().min(1),
      notes: z.string().optional().default(""),
      manuscript: z.string().optional().default(""),
      bgColor: z.string(),
      textColor: z.string(),
      imageData: z.string().nullable().optional(),
      status: z.enum(["working", "review", "approved", "rejected"]).default("review"),
      widthCm: z.number().int().nonnegative().optional().default(0),
      heightCm: z.number().int().nonnegative().optional().default(0),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const image = data.imageData && data.imageData.length > 900_000 ? null : (data.imageData ?? null);
    const ver = await sql.query<{ v: number }>(
      `select coalesce(max(version), 0)::int + 1 as v from drafts where order_id = $1`,
      [data.orderId],
    );
    const version = ver[0]?.v ?? 1;
    await sql.query(
      `insert into drafts (order_id, version, status, title, bg_color, text_color, image_data, notes, created_by, manuscript, width_cm, height_cm)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        data.orderId,
        version,
        data.status,
        data.title,
        data.bgColor,
        data.textColor,
        image,
        data.notes ?? "",
        data.staffName,
        data.manuscript ?? "",
        data.widthCm ?? 0,
        data.heightCm ?? 0,
      ],
    );
    await sql.query(
      `update orders set status = case when status = 'received' then 'drafting' else status end,
              bg_color = $2, text_color = $3, updated_at = now()
        where id = $1`,
      [data.orderId, data.bgColor, data.textColor],
    );
    await postMessage(
      data.orderId,
      data.staffName,
      `${data.staffName}님이 시안 ${version}안「${data.title}」을 올렸습니다.`,
    );
    return { ok: true };
  });

export const addDraftsFromItems = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      orderId: z.number().int().positive(),
      staffName,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const items = await sql.query<{
      id: number;
      product_name: string;
      memo: string;
      copy: string;
      width_cm: number;
      height_cm: number;
    }>(
      `select id, product_name, memo, copy, width_cm, height_cm from order_items where order_id = $1 order by sort_order, id`,
      [data.orderId],
    );
    const existing = await sql.query<{ n: number }>(
      `select count(*)::int as n from drafts where order_id = $1`,
      [data.orderId],
    );
    const have = existing[0]?.n ?? 0;
    const remaining = items.slice(have);
    if (remaining.length === 0) return { ok: true, added: 0 };
    const verRow = await sql.query<{ v: number }>(
      `select coalesce(max(version), 0)::int as v from drafts where order_id = $1`,
      [data.orderId],
    );
    let version = verRow[0]?.v ?? 0;
    const order = await sql.query<{ bg_color: string; text_color: string; manuscript: string }>(
      `select bg_color, text_color, manuscript from orders where id = $1`,
      [data.orderId],
    );
    const bg = order[0]?.bg_color ?? "#1c150e";
    const fg = order[0]?.text_color ?? "#fff6e8";
    const fallbackCopy = order[0]?.manuscript ?? "";
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i]!;
      version += 1;
      const title = `${have + i + 1}번 ${item.product_name}`.trim();
      await sql.query(
        `insert into drafts (order_id, version, status, title, bg_color, text_color, image_data, notes, created_by, manuscript, width_cm, height_cm)
         values ($1,$2,'working',$3,$4,$5,null,'',$6,$7,$8,$9)`,
        [
          data.orderId,
          version,
          title,
          bg,
          fg,
          data.staffName,
          item.copy || item.memo || fallbackCopy,
          Number(item.width_cm) || 0,
          Number(item.height_cm) || 0,
        ],
      );
    }
    await sql.query(
      `update orders set status = case when status = 'received' then 'drafting' else status end, updated_at = now() where id = $1`,
      [data.orderId],
    );
    await postMessage(
      data.orderId,
      data.staffName,
      `${data.staffName}님이 품목 ${remaining.length}장 시안 칸을 만들었습니다.`,
    );
    return { ok: true, added: remaining.length };
  });

export const updateDraft = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().positive(),
      orderId: z.number().int().positive(),
      staffName,
      title: z.string().trim().min(1),
      manuscript: z.string().optional().default(""),
      notes: z.string().optional().default(""),
      imageData: z.string().nullable().optional(),
      widthCm: z.number().int().nonnegative().optional(),
      heightCm: z.number().int().nonnegative().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const image =
      data.imageData == null
        ? data.imageData
        : data.imageData.length > 900_000
          ? null
          : data.imageData;
    const width = data.widthCm;
    const height = data.heightCm;
    if (image !== undefined && width != null && height != null) {
      await sql.query(
        `update drafts set title = $2, manuscript = $3, notes = $4, image_data = $5, width_cm = $6, height_cm = $7
          where id = $1 and order_id = $8`,
        [data.id, data.title, data.manuscript ?? "", data.notes ?? "", image, width, height, data.orderId],
      );
    } else if (image !== undefined) {
      await sql.query(
        `update drafts set title = $2, manuscript = $3, notes = $4, image_data = $5 where id = $1 and order_id = $6`,
        [data.id, data.title, data.manuscript ?? "", data.notes ?? "", image, data.orderId],
      );
    } else if (width != null && height != null) {
      await sql.query(
        `update drafts set title = $2, manuscript = $3, notes = $4, width_cm = $5, height_cm = $6
          where id = $1 and order_id = $7`,
        [data.id, data.title, data.manuscript ?? "", data.notes ?? "", width, height, data.orderId],
      );
    } else {
      await sql.query(
        `update drafts set title = $2, manuscript = $3, notes = $4 where id = $1 and order_id = $5`,
        [data.id, data.title, data.manuscript ?? "", data.notes ?? "", data.orderId],
      );
    }
    await sql.query(`update orders set updated_at = now() where id = $1`, [data.orderId]);
    return { ok: true };
  });

export const deleteDraft = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().positive(),
      orderId: z.number().int().positive(),
      staffName,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const row = await sql.query<{ title: string; version: number }>(
      `select title, version from drafts where id = $1 and order_id = $2`,
      [data.id, data.orderId],
    );
    if (!row[0]) throw new Error("시안이 없습니다.");
    await sql.query(`delete from drafts where id = $1 and order_id = $2`, [data.id, data.orderId]);
    const left = await sql.query<{ id: number }>(
      `select id from drafts where order_id = $1 order by version, id`,
      [data.orderId],
    );
    for (let i = 0; i < left.length; i++) {
      await sql.query(`update drafts set version = $2 where id = $1`, [left[i]!.id, i + 1]);
    }
    await sql.query(`update orders set updated_at = now() where id = $1`, [data.orderId]);
    await postMessage(
      data.orderId,
      data.staffName,
      `${data.staffName}님이 시안 ${row[0].version}번「${row[0].title}」을 삭제했습니다.`,
    );
    return { ok: true };
  });

export const patchOrderItem = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().positive(),
      orderId: z.number().int().positive(),
      staffName,
      widthCm: z.number().int().nonnegative(),
      heightCm: z.number().int().nonnegative(),
      qty: z.number().int().positive(),
      unitPrice: z.number().int().nonnegative().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const item = await sql.query<{ unit_price: number }>(
      `select unit_price from order_items where id = $1 and order_id = $2`,
      [data.id, data.orderId],
    );
    if (!item[0]) throw new Error("품목이 없습니다.");
    const unitPrice = data.unitPrice ?? (Number(item[0].unit_price) || 0);
    const amount = Math.round(unitPrice * data.qty);
    await sql.query(
      `update order_items set width_cm = $2, height_cm = $3, qty = $4, unit_price = $5, amount = $6 where id = $1 and order_id = $7`,
      [data.id, data.widthCm, data.heightCm, data.qty, unitPrice, amount, data.orderId],
    );
    await sql.query(`update orders set updated_at = now() where id = $1`, [data.orderId]);
    return { ok: true };
  });

export const removeOrderItem = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().positive(),
      orderId: z.number().int().positive(),
      staffName,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const count = await sql.query<{ n: number }>(
      `select count(*)::int as n from order_items where order_id = $1`,
      [data.orderId],
    );
    if ((count[0]?.n ?? 0) <= 1) throw new Error("품목은 한 줄 이상 남겨 두세요.");
    const item = await sql.query<{ product_name: string }>(
      `select product_name from order_items where id = $1 and order_id = $2`,
      [data.id, data.orderId],
    );
    await sql.query(`delete from order_items where id = $1 and order_id = $2`, [data.id, data.orderId]);
    await sql.query(`update orders set updated_at = now() where id = $1`, [data.orderId]);
    await postMessage(
      data.orderId,
      data.staffName,
      `${data.staffName}님이 품목「${item[0]?.product_name ?? ""}」을 삭제했습니다.`,
    );
    return { ok: true };
  });

export const updateDraftStatus = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().positive(),
      orderId: z.number().int().positive(),
      status: z.enum(["working", "review", "approved", "rejected"]),
      staffName,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(`update drafts set status = $2 where id = $1`, [data.id, data.status]);
    const labels = { working: "작업중", review: "검토요청", approved: "승인", rejected: "수정요청" };
    if (data.status === "approved") {
      const open = await sql.query<{ n: number }>(
        `select count(*)::int as n from drafts where order_id = $1 and status <> 'approved'`,
        [data.orderId],
      );
      if ((open[0]?.n ?? 1) === 0) {
        await sql.query(
          `update orders set status = case when status in ('received','drafting') then 'review' else status end,
                  updated_at = now() where id = $1`,
          [data.orderId],
        );
      }
    } else if (data.status === "rejected") {
      await sql.query(
        `update orders set status = 'drafting', updated_at = now() where id = $1`,
        [data.orderId],
      );
    } else if (data.status === "review") {
      await sql.query(
        `update orders set status = case when status in ('received','drafting') then 'review' else status end,
                updated_at = now() where id = $1`,
        [data.orderId],
      );
    }
    await postMessage(
      data.orderId,
      data.staffName,
      `${data.staffName}님이 시안을 「${labels[data.status]}」으로 표시했습니다.`,
    );
    return { ok: true };
  });

export const createClient = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1),
      contact: z.string().optional().default(""),
      phone: z.string().optional().default(""),
      memo: z.string().optional().default(""),
      bizNo: z.string().optional().default(""),
      address: z.string().optional().default(""),
      email: z.string().optional().default(""),
      bizType: z.string().optional().default(""),
      bizItem: z.string().optional().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      `insert into clients (name, contact, phone, memo, biz_no, address, email, biz_type, biz_item)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        data.name,
        data.contact ?? "",
        data.phone ?? "",
        data.memo ?? "",
        data.bizNo ?? "",
        data.address ?? "",
        data.email ?? "",
        data.bizType ?? "",
        data.bizItem ?? "",
      ],
    );
    return { id: Number(rows[0]!.id) };
  });

export const updateClient = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1),
      contact: z.string().optional().default(""),
      phone: z.string().optional().default(""),
      memo: z.string().optional().default(""),
      bizNo: z.string().optional().default(""),
      address: z.string().optional().default(""),
      email: z.string().optional().default(""),
      bizType: z.string().optional().default(""),
      bizItem: z.string().optional().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(
      `update clients set name=$2, contact=$3, phone=$4, memo=$5,
         biz_no=$6, address=$7, email=$8, biz_type=$9, biz_item=$10
       where id = $1`,
      [
        data.id,
        data.name,
        data.contact ?? "",
        data.phone ?? "",
        data.memo ?? "",
        data.bizNo ?? "",
        data.address ?? "",
        data.email ?? "",
        data.bizType ?? "",
        data.bizItem ?? "",
      ],
    );
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const found = await sql.query<{ name: string }>(`select name from clients where id = $1`, [data.id]);
    if (!found[0]) throw new Error("없는 거래처입니다.");
    const orders = await sql.query<{ n: number }>(
      `select count(*)::int as n from orders where client_id = $1`,
      [data.id],
    );
    const orderCount = Number(orders[0]?.n) || 0;
    await sql.query(`delete from orders where client_id = $1`, [data.id]);
    await sql.query(`delete from clients where id = $1`, [data.id]);
    return { ok: true as const, name: found[0].name, orderCount };
  });

export const listClients = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(async () => {
  const sql = await getSql();
  const rows = await sql.query<
    Parameters<typeof mapClient>[0] & { order_count: number; last_order: unknown }
  >(
    `select cl.*, 
            (select count(*)::int from orders where client_id = cl.id) as order_count,
            (select max(created_at) from orders where client_id = cl.id) as last_order
       from clients cl
      order by cl.name`,
  );
  return rows.map((row) => ({
    ...mapClient(row),
    orderCount: Number(row.order_count ?? 0),
    lastOrder: row.last_order ? String(row.last_order) : null,
  }));
});

function storedCompanyLogo(url: string) {
  const clean = url.trim();
  if (!clean || isProgramBrandAsset(clean)) return "";
  if (clean.length > 160_000) throw new Error("로고는 150KB 이하로 올려 주세요.");
  if (!clean.startsWith("data:image/") && !/^https?:\/\//i.test(clean)) return "";
  return clean;
}

export const updateCompany = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().trim().min(1),
      ownerName: z.string().optional().default(""),
      bizNo: z.string().optional().default(""),
      phone: z.string().optional().default(""),
      fax: z.string().optional().default(""),
      address: z.string().optional().default(""),
      email: z.string().optional().default(""),
      bankName: z.string().optional().default(""),
      bankAccount: z.string().optional().default(""),
      bankHolder: z.string().optional().default(""),
      sealLabel: z.string().optional().default(""),
      vatIncluded: z.boolean(),
      rushRate: z.number().positive(),
      quoteValidDays: z.number().int().positive(),
      bizType: z.string().optional().default(""),
      bizItem: z.string().optional().default(""),
      inviteCode: z.string().trim().min(4, "초대코드는 4자 이상"),
      website: z.string().trim().max(200).optional().default(""),
      brandColor: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine((value) => value === "" || /^#[0-9a-fA-F]{6}$/.test(value), "대표 색은 #RRGGBB"),
      logoUrl: z.string().max(160_000).optional().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const logoUrl = storedCompanyLogo(data.logoUrl);
    await sql.query(
      `update company_profile set
         name=$1, owner_name=$2, biz_no=$3, phone=$4, fax=$5, address=$6, email=$7,
         bank_name=$8, bank_account=$9, bank_holder=$10, seal_label=$11,
         vat_included=$12, rush_rate=$13, quote_valid_days=$14, biz_type=$15, biz_item=$16,
         invite_code=$17, website=$18, brand_color=$19, logo_url=$20
       where id = 1`,
      [
        data.name,
        data.ownerName,
        data.bizNo,
        data.phone,
        data.fax,
        data.address,
        data.email,
        data.bankName,
        data.bankAccount,
        data.bankHolder,
        data.sealLabel || data.name,
        data.vatIncluded,
        data.rushRate,
        data.quoteValidDays,
        data.bizType ?? "",
        data.bizItem ?? "",
        data.inviteCode,
        data.website ?? "",
        data.brandColor ?? "",
        logoUrl,
      ],
    );
    return { ok: true };
  });

export const upsertProduct = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int().positive().optional(),
      name: z.string().trim().min(1),
      unit: z.enum(["㎡", "개", "자", "건"]),
      unitPrice: z.number().int().nonnegative(),
      description: z.string().optional().default(""),
      active: z.boolean().optional().default(true),
      category: z.string().optional().default("기타"),
      minQty: z.number().int().positive().optional().default(1),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const unit = isFlatPiece(data.name) ? "개" : data.unit;
    if (data.id) {
      await sql.query(
        `update products set name=$2, unit=$3, unit_price=$4, description=$5, active=$6, category=$7, min_qty=$8 where id=$1`,
        [
          data.id,
          data.name,
          unit,
          data.unitPrice,
          data.description ?? "",
          data.active ?? true,
          data.category ?? "기타",
          data.minQty ?? 1,
        ],
      );
      return { id: data.id };
    }
    const rows = await sql.query<{ id: number }>(
      `insert into products (name, unit, unit_price, description, sort_order, active, category, min_qty)
       values ($1,$2,$3,$4,(select coalesce(max(sort_order),0)+1 from products),$5,$6,$7)
       returning id`,
      [
        data.name,
        unit,
        data.unitPrice,
        data.description ?? "",
        data.active ?? true,
        data.category ?? "기타",
        data.minQty ?? 1,
      ],
    );
    return { id: Number(rows[0]!.id) };
  });

export const deleteProduct = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const found = await sql.query<{ name: string }>(`select name from products where id = $1`, [data.id]);
    if (!found[0]) throw new Error("없는 품목입니다.");
    const used = await sql.query<{ n: number }>(
      `select count(*)::int as n from order_items where product_id = $1`,
      [data.id],
    );
    if ((used[0]?.n ?? 0) > 0) {
      await sql.query(`update products set active = false where id = $1`, [data.id]);
      return { name: found[0].name, hidden: true as const };
    }
    await sql.query(`delete from products where id = $1`, [data.id]);
    return { name: found[0].name, hidden: false as const };
  });

export const addStaff = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(z.object({ name: z.string().trim().min(1), role: z.string().optional().default("직원") }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      `insert into staff (name, role) values ($1,$2) returning id`,
      [data.name, data.role ?? "직원"],
    );
    return { id: Number(rows[0]!.id) };
  });

export const removeStaff = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const count = await sql.query<{ n: number }>(`select count(*)::int as n from staff`);
    if ((count[0]?.n ?? 0) <= 1) throw new Error("직원은 한 명 이상 남겨 두세요.");
    await sql.query(`delete from staff where id = $1`, [data.id]);
    return { ok: true };
  });

export const registerStaff = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(1, "이름을 적어 주세요"),
      email: z.string().trim().email("이메일 형식을 확인해 주세요"),
      password: z.string().min(8, "비밀번호는 8자 이상"),
      inviteCode: z.string().trim().min(1, "초대코드를 적어 주세요"),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await requireInviteCode(data.inviteCode);
    await assertStaffName(sql, data.name);
    return upsertStaffPassword({
      email: data.email,
      password: data.password,
      name: data.name,
      allowCreate: true,
    });
  });

async function requireInviteCode(code: string) {
  const sql = await getSql();
  const company = await sql.query<{ invite_code: string }>(
    `select invite_code from company_profile where id = 1`,
  );
  const expected = (company[0]?.invite_code ?? "").trim();
  if (!expected || code.trim() !== expected) {
    throw new Error("초대코드가 맞지 않습니다. 아직 안 바꿨으면 adsmile 입니다.");
  }
  return sql;
}

async function assertStaffName(sql: Awaited<ReturnType<typeof getSql>>, name: string) {
  const staff = await sql.query<{ name: string }>(`select name from staff order by id`);
  const hit = staff.find((s) => s.name.replace(/\s+/g, "") === name.replace(/\s+/g, ""));
  if (!hit) {
    const names = staff.map((s) => s.name).join(", ") || "(없음)";
    throw new Error(`설정에 없는 이름입니다. 직원 이름과 같게 적어 주세요: ${names}`);
  }
}

async function upsertStaffPassword(input: {
  email: string;
  password: string;
  name?: string;
  allowCreate: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  const { auth } = await import("@/lib/auth/server");
  const ctx = await auth.$context;
  const hashed = await ctx.password.hash(input.password);
  const found = await ctx.internalAdapter.findUserByEmail(email);
  if (!found) {
    if (!input.allowCreate) {
      throw new Error("그 이메일로 만든 계정이 없습니다. 비번 새로 만들기에서 이름을 넣고 계정을 만드세요.");
    }
    try {
      await auth.api.signUpEmail({
        body: {
          email,
          password: input.password,
          name: input.name?.trim() || email.split("@")[0] || "직원",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/already|exist|이미/i.test(message)) {
        throw new Error(message || "계정을 만들지 못했습니다.");
      }
    }
    const again = await ctx.internalAdapter.findUserByEmail(email);
    if (!again) throw new Error("계정은 만들었는데 바로 찾지 못했습니다. 들어가기에서 같은 이메일로 다시 시도하세요.");
    const accounts = await ctx.internalAdapter.findAccounts(again.user.id);
    if (!accounts.some((a) => a.providerId === "credential")) {
      await ctx.internalAdapter.linkAccount({
        userId: again.user.id,
        providerId: "credential",
        accountId: again.user.id,
        password: hashed,
      });
    }
    return { ok: true as const, created: true };
  }
  const accounts = await ctx.internalAdapter.findAccounts(found.user.id);
  if (accounts.some((a) => a.providerId === "credential")) {
    await ctx.internalAdapter.updatePassword(found.user.id, hashed);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId: found.user.id,
      providerId: "credential",
      accountId: found.user.id,
      password: hashed,
    });
  }
  return { ok: true as const, created: false };
}

export const listStaffLogins = createServerFn({ method: "POST" })
  .validator(z.object({ inviteCode: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const sql = await requireInviteCode(data.inviteCode);
    const rows = await sql.query<{ name: string; email: string }>(
      `select name, email from "user" order by "createdAt"`,
    );
    return rows.map((r) => ({ name: r.name, email: r.email }));
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().optional().default(""),
      email: z.string().trim().email("이메일 형식을 확인해 주세요"),
      password: z.string().min(8, "비밀번호는 8자 이상"),
      inviteCode: z.string().trim().min(1, "초대코드를 적어 주세요"),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await requireInviteCode(data.inviteCode);
    if (data.name.trim()) await assertStaffName(sql, data.name);
    return upsertStaffPassword({
      email: data.email,
      password: data.password,
      name: data.name.trim() || undefined,
      allowCreate: Boolean(data.name.trim()),
    });
  });

export const issueDocument = createServerFn({ method: "POST" }).middleware([authMiddleware])
  .validator(
    z.object({
      orderId: z.number().int().positive(),
      docType: z.enum(["quote", "statement"]),
      staffName,
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const company = await loadCompany();
    const orders = await sql.query<OrderRow>(
      `select ${ORDER_SELECT} from orders o join clients c on c.id = o.client_id where o.id = $1`,
      [data.orderId],
    );
    if (!orders[0]) throw new Error("주문을 찾을 수 없습니다.");
    const order = mapOrder(orders[0]);
    const clientRows = await sql.query<Parameters<typeof mapClient>[0]>(
      `select * from clients where id = $1`,
      [order.clientId],
    );
    const client = clientRows[0] ? mapClient(clientRows[0]) : null;
    const items = (
      await sql.query<Parameters<typeof mapItem>[0]>(
        `select * from order_items where order_id = $1 order by sort_order, id`,
        [data.orderId],
      )
    ).map(mapItem);
    const tax = vatBreakdown(order.supplyAmount, company.vatIncluded);
    const prefix = data.docType === "quote" ? "Q" : "T";
    const tableCol = "doc_no";
    const docNo = await nextSerial(prefix, tableCol, "documents");
    const payload: DocPayload = {
      company,
      clientName: order.clientName,
      clientContact: order.clientContact,
      clientPhone: order.clientPhone,
      clientAddress: client?.address ?? "",
      clientBizNo: client?.bizNo ?? "",
      clientEmail: client?.email ?? "",
      clientBizType: client?.bizType ?? "",
      clientBizItem: client?.bizItem ?? "",
      orderNo: order.orderNo,
      title: order.title,
      dueDate: order.dueDate,
      rush: order.rush,
      manuscript: order.manuscript,
      notes: order.notes,
      items: items.map((item) => ({
        productName: item.productName,
        spec: specLabel(item.widthCm, item.heightCm, item.unit),
        qty: item.qty,
        unit: item.unit,
        unitPrice: item.unitPrice,
        amount: item.amount,
        memo: item.memo,
      })),
      supplyAmount: tax.supply,
      vatAmount: tax.vat,
      totalAmount: tax.total,
      vatIncluded: company.vatIncluded,
    };
    const inserted = await sql.query<{ id: number }>(
      `insert into documents (order_id, doc_type, doc_no, issued_by, payload)
       values ($1,$2,$3,$4,$5::jsonb) returning id`,
      [data.orderId, data.docType, docNo, data.staffName, JSON.stringify(payload)],
    );
    const label = data.docType === "quote" ? "견적서" : "거래명세서";
    await postMessage(
      data.orderId,
      data.staffName,
      `${data.staffName}님이 ${label} ${docNo}를 발행했습니다.`,
    );
    return { id: Number(inserted[0]!.id), docNo };
  });

export const getDocument = createServerFn({ method: "GET" }).middleware([authMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Parameters<typeof mapDoc>[0]>(
      `select * from documents where id = $1`,
      [data.id],
    );
    if (!rows[0]) throw new Error("문서를 찾을 수 없습니다.");
    const mapped = mapDoc(rows[0]);
    if (!mapped.payload) throw new Error("문서 내용이 비어 있습니다.");
    const record: DocumentRecord = {
      id: mapped.id,
      orderId: mapped.orderId,
      docType: mapped.docType,
      docNo: mapped.docNo,
      issuedAt: mapped.issuedAt,
      issuedBy: mapped.issuedBy,
      payload: mapped.payload,
    };
    return record;
  });

export {
  exportShopBackup,
  getMonthlyArchive,
  listMonthlyArchives,
  restoreShopBackup,
  saveMonthlyArchive,
} from "./backup";
