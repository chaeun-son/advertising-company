export const ORDER_STATUSES = [
  "received",
  "drafting",
  "review",
  "pay_wait",
  "pay_ok",
  "production",
  "done",
  "hold",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_META: Record<
  OrderStatus,
  { label: string; tone: "ink" | "draft" | "review" | "make" | "done" | "hold" | "stamp" }
> = {
  received: { label: "접수", tone: "ink" },
  drafting: { label: "시안작업", tone: "draft" },
  review: { label: "시안확인", tone: "review" },
  pay_wait: { label: "입금확인중", tone: "stamp" },
  pay_ok: { label: "입금완료", tone: "done" },
  production: { label: "제작중", tone: "make" },
  done: { label: "출고완료", tone: "done" },
  hold: { label: "보류", tone: "hold" },
};

export const PIPELINE: OrderStatus[] = [
  "received",
  "drafting",
  "review",
  "pay_wait",
  "pay_ok",
  "production",
  "done",
];

export const DRAFT_STATUSES = ["working", "review", "approved", "rejected"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_STATUS_META: Record<DraftStatus, string> = {
  working: "작업중",
  review: "검토요청",
  approved: "승인",
  rejected: "수정요청",
};

export type ProductUnit = "㎡" | "개" | "자" | "건";

export type CompanyProfile = {
  id: number;
  name: string;
  ownerName: string;
  bizNo: string;
  phone: string;
  fax: string;
  address: string;
  email: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  sealLabel: string;
  vatIncluded: boolean;
  rushRate: number;
  quoteValidDays: number;
  bizType: string;
  bizItem: string;
  inviteCode: string;
  website: string;
  brandColor: string;
  logoUrl: string;
};

export type Staff = { id: number; name: string; role: string };

export type Product = {
  id: number;
  name: string;
  unit: ProductUnit;
  unitPrice: number;
  description: string;
  sortOrder: number;
  active: boolean;
  category: string;
  minQty: number;
};

export type Client = {
  id: number;
  name: string;
  contact: string;
  phone: string;
  memo: string;
  createdAt: string;
  bizNo: string;
  address: string;
  email: string;
  bizType: string;
  bizItem: string;
};

export type OrderItem = {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  unit: ProductUnit;
  widthCm: number;
  heightCm: number;
  qty: number;
  unitPrice: number;
  amount: number;
  memo: string;
  copy: string;
  sortOrder: number;
};

export type Order = {
  id: number;
  orderNo: string;
  clientId: number;
  clientName: string;
  clientPhone: string;
  clientContact: string;
  title: string;
  status: OrderStatus;
  dueDate: string | null;
  rush: boolean;
  assignee: string;
  manuscript: string;
  notes: string;
  bgColor: string;
  textColor: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supplyAmount: number;
  itemCount: number;
};

export type OrderDetail = Order & {
  items: OrderItem[];
  drafts: Draft[];
  messages: Message[];
  documents: DocSummary[];
};

export type Draft = {
  id: number;
  orderId: number;
  version: number;
  status: DraftStatus;
  title: string;
  manuscript: string;
  bgColor: string;
  textColor: string;
  imageData: string | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  widthCm: number;
  heightCm: number;
};

export type Message = {
  id: number;
  orderId: number;
  orderNo?: string;
  orderTitle?: string;
  staffName: string;
  kind: "chat" | "system";
  body: string;
  createdAt: string;
};

export type DocType = "quote" | "statement";

export type DocSummary = {
  id: number;
  orderId: number;
  docType: DocType;
  docNo: string;
  issuedAt: string;
  issuedBy: string;
};

export type DocPayloadItem = {
  productName: string;
  spec: string;
  qty: number;
  unit: string;
  unitPrice: number;
  amount: number;
  memo: string;
};

export type DocPayload = {
  company: CompanyProfile;
  clientName: string;
  clientContact: string;
  clientPhone: string;
  clientAddress?: string;
  clientBizNo?: string;
  clientEmail?: string;
  clientBizType?: string;
  clientBizItem?: string;
  orderNo: string;
  title: string;
  dueDate: string | null;
  rush: boolean;
  manuscript: string;
  notes: string;
  items: DocPayloadItem[];
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatIncluded: boolean;
};

export type DocumentRecord = DocSummary & { payload: DocPayload };

export type DashboardData = {
  counts: Record<OrderStatus, number>;
  todayDue: number;
  monthSupply: number;
  recentMessages: Message[];
  orders: Order[];
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isDraftStatus(value: string): value is DraftStatus {
  return (DRAFT_STATUSES as readonly string[]).includes(value);
}
