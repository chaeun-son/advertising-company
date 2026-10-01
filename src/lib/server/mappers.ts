import { asBool, asNumber, toDateOnly, toIso } from "@/lib/format";
import type {
  Client,
  CompanyProfile,
  DocPayload,
  DocSummary,
  DocType,
  Draft,
  DraftStatus,
  Message,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductUnit,
  Staff,
} from "@/lib/types";
import { isDraftStatus, isOrderStatus } from "@/lib/types";

export type OrderRow = {
  id: number;
  order_no: string;
  client_id: number;
  client_name: string;
  client_phone: string;
  client_contact: string;
  title: string;
  status: string;
  due_date: unknown;
  rush: unknown;
  assignee: string;
  manuscript: string;
  notes: string;
  bg_color: string;
  text_color: string;
  created_by: string;
  created_at: unknown;
  updated_at: unknown;
  supply_amount: unknown;
  item_count: unknown;
};

export function mapOrder(row: OrderRow): Order {
  const status = isOrderStatus(row.status) ? row.status : "received";
  return {
    id: asNumber(row.id),
    orderNo: row.order_no,
    clientId: asNumber(row.client_id),
    clientName: row.client_name,
    clientPhone: row.client_phone ?? "",
    clientContact: row.client_contact ?? "",
    title: row.title,
    status: status as OrderStatus,
    dueDate: toDateOnly(row.due_date),
    rush: asBool(row.rush),
    assignee: row.assignee ?? "",
    manuscript: row.manuscript ?? "",
    notes: row.notes ?? "",
    bgColor: row.bg_color,
    textColor: row.text_color,
    createdBy: row.created_by ?? "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    supplyAmount: asNumber(row.supply_amount),
    itemCount: asNumber(row.item_count),
  };
}

export function mapItem(row: {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  unit: string;
  width_cm: unknown;
  height_cm: unknown;
  qty: unknown;
  unit_price: unknown;
  amount: unknown;
  memo: string;
  copy?: string | null;
  sort_order: unknown;
}): OrderItem {
  return {
    id: asNumber(row.id),
    orderId: asNumber(row.order_id),
    productId: asNumber(row.product_id),
    productName: row.product_name,
    unit: (row.unit as ProductUnit) || "㎡",
    widthCm: asNumber(row.width_cm),
    heightCm: asNumber(row.height_cm),
    qty: asNumber(row.qty),
    unitPrice: asNumber(row.unit_price),
    amount: asNumber(row.amount),
    memo: row.memo ?? "",
    copy: row.copy ?? "",
    sortOrder: asNumber(row.sort_order),
  };
}

export function mapDraft(row: {
  id: number;
  order_id: number;
  version: unknown;
  status: string;
  title: string;
  manuscript?: string | null;
  bg_color: string;
  text_color: string;
  image_data: string | null;
  notes: string;
  created_by: string;
  created_at: unknown;
  width_cm?: unknown;
  height_cm?: unknown;
}): Draft {
  const status: DraftStatus = isDraftStatus(row.status) ? row.status : "working";
  return {
    id: asNumber(row.id),
    orderId: asNumber(row.order_id),
    version: asNumber(row.version),
    status,
    title: row.title,
    manuscript: row.manuscript ?? "",
    bgColor: row.bg_color,
    textColor: row.text_color,
    imageData: row.image_data,
    notes: row.notes ?? "",
    createdBy: row.created_by ?? "",
    createdAt: toIso(row.created_at),
    widthCm: asNumber(row.width_cm),
    heightCm: asNumber(row.height_cm),
  };
}

export function mapMessage(row: {
  id: number;
  order_id: number;
  order_no?: string;
  order_title?: string;
  staff_name: string;
  kind: string;
  body: string;
  created_at: unknown;
}): Message {
  return {
    id: asNumber(row.id),
    orderId: asNumber(row.order_id),
    orderNo: row.order_no,
    orderTitle: row.order_title,
    staffName: row.staff_name,
    kind: row.kind === "system" ? "system" : "chat",
    body: row.body,
    createdAt: toIso(row.created_at),
  };
}

export function mapClient(row: {
  id: number;
  name: string;
  contact: string;
  phone: string;
  memo: string;
  created_at: unknown;
  biz_no?: string;
  address?: string;
  email?: string;
  biz_type?: string;
  biz_item?: string;
}): Client {
  return {
    id: asNumber(row.id),
    name: row.name,
    contact: row.contact ?? "",
    phone: row.phone ?? "",
    memo: row.memo ?? "",
    createdAt: toIso(row.created_at),
    bizNo: row.biz_no ?? "",
    address: row.address ?? "",
    email: row.email ?? "",
    bizType: row.biz_type ?? "",
    bizItem: row.biz_item ?? "",
  };
}

export function mapProduct(row: {
  id: number;
  name: string;
  unit: string;
  unit_price: unknown;
  description: string;
  sort_order: unknown;
  active: unknown;
  category?: string;
  min_qty?: unknown;
}): Product {
  return {
    id: asNumber(row.id),
    name: row.name,
    unit: (row.unit as ProductUnit) || "㎡",
    unitPrice: asNumber(row.unit_price),
    description: row.description ?? "",
    sortOrder: asNumber(row.sort_order),
    active: asBool(row.active),
    category: row.category ?? "기타",
    minQty: asNumber(row.min_qty) || 1,
  };
}

export function mapStaff(row: { id: number; name: string; role: string }): Staff {
  return { id: asNumber(row.id), name: row.name, role: row.role };
}

export function mapCompany(row: {
  id: number;
  name: string;
  owner_name: string;
  biz_no: string;
  phone: string;
  fax: string;
  address: string;
  email: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  seal_label: string;
  vat_included: unknown;
  rush_rate: unknown;
  quote_valid_days: unknown;
  biz_type?: string;
  biz_item?: string;
  invite_code?: string;
}): CompanyProfile {
  return {
    id: 1,
    name: row.name,
    ownerName: row.owner_name,
    bizNo: row.biz_no,
    phone: row.phone,
    fax: row.fax ?? "",
    address: row.address,
    email: row.email,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    bankHolder: row.bank_holder,
    sealLabel: row.seal_label,
    vatIncluded: asBool(row.vat_included),
    rushRate: asNumber(row.rush_rate) || 1.3,
    quoteValidDays: asNumber(row.quote_valid_days) || 14,
    bizType: row.biz_type ?? "",
    bizItem: row.biz_item ?? "",
    inviteCode: row.invite_code ?? "adsmile",
  };
}

export function mapDoc(row: {
  id: number;
  order_id: number;
  doc_type: string;
  doc_no: string;
  issued_at: unknown;
  issued_by: string;
  payload?: unknown;
}): DocSummary & { payload?: DocPayload } {
  const payload =
    row.payload && typeof row.payload === "object"
      ? (row.payload as DocPayload)
      : typeof row.payload === "string"
        ? (JSON.parse(row.payload) as DocPayload)
        : undefined;
  return {
    id: asNumber(row.id),
    orderId: asNumber(row.order_id),
    docType: row.doc_type === "statement" ? "statement" : ("quote" as DocType),
    docNo: row.doc_no,
    issuedAt: toIso(row.issued_at),
    issuedBy: row.issued_by ?? "",
    payload,
  };
}

export const ORDER_SELECT = `
  o.id, o.order_no, o.client_id, c.name as client_name, c.phone as client_phone,
  c.contact as client_contact, o.title, o.status, o.due_date, o.rush, o.assignee,
  o.manuscript, o.notes, o.bg_color, o.text_color, o.created_by, o.created_at,
  o.updated_at,
  coalesce((select sum(amount) from order_items where order_id = o.id), 0) as supply_amount,
  coalesce((select count(*) from order_items where order_id = o.id), 0) as item_count
`;
