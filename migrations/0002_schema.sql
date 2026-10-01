-- 시안실 — shared shop ledger (unowned rows; all staff see the same board)

create table if not exists company_profile (
  id            integer primary key check (id = 1),
  name          text not null default '해돋이광고',
  owner_name    text not null default '정우성',
  biz_no        text not null default '123-45-67890',
  phone         text not null default '02-555-0199',
  fax           text not null default '',
  address       text not null default '서울특별시 중구 충무로 12, 3층',
  email         text not null default 'hello@haedoji.co',
  bank_name     text not null default '국민은행',
  bank_account  text not null default '123456-01-789012',
  bank_holder   text not null default '해돋이광고',
  seal_label    text not null default '해돋이광고',
  vat_included  boolean not null default false,
  rush_rate     numeric(4, 2) not null default 1.30,
  quote_valid_days integer not null default 14
);

create table if not exists staff (
  id         serial primary key,
  name       text not null,
  role       text not null default '직원',
  created_at timestamptz not null default now()
);

create table if not exists products (
  id          serial primary key,
  name        text not null,
  unit        text not null default '㎡',
  unit_price  integer not null default 0,
  description text not null default '',
  sort_order  integer not null default 0,
  active      boolean not null default true
);

create table if not exists clients (
  id         serial primary key,
  name       text not null,
  contact    text not null default '',
  phone      text not null default '',
  memo       text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id           serial primary key,
  order_no     text not null unique,
  client_id    integer not null references clients(id),
  title        text not null,
  status       text not null default 'received',
  due_date     date,
  rush         boolean not null default false,
  assignee     text not null default '',
  manuscript   text not null default '',
  notes        text not null default '',
  bg_color     text not null default '#1b1814',
  text_color   text not null default '#f7f1e6',
  created_by   text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists orders_status_idx on orders (status);
create index if not exists orders_due_date_idx on orders (due_date);
create index if not exists orders_client_id_idx on orders (client_id);

create table if not exists order_items (
  id          serial primary key,
  order_id    integer not null references orders(id) on delete cascade,
  product_id  integer not null references products(id),
  product_name text not null,
  unit        text not null,
  width_cm    integer not null default 0,
  height_cm   integer not null default 0,
  qty         integer not null default 1,
  unit_price  integer not null,
  amount      integer not null,
  memo        text not null default '',
  sort_order  integer not null default 0
);

create index if not exists order_items_order_id_idx on order_items (order_id);

create table if not exists drafts (
  id          serial primary key,
  order_id    integer not null references orders(id) on delete cascade,
  version     integer not null default 1,
  status      text not null default 'working',
  title       text not null default '시안',
  bg_color    text not null default '#1b1814',
  text_color  text not null default '#f7f1e6',
  image_data  text,
  notes       text not null default '',
  created_by  text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists drafts_order_id_idx on drafts (order_id);

create table if not exists messages (
  id          serial primary key,
  order_id    integer not null references orders(id) on delete cascade,
  staff_name  text not null,
  kind        text not null default 'chat',
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists messages_order_id_idx on messages (order_id, created_at);

create table if not exists documents (
  id          serial primary key,
  order_id    integer not null references orders(id) on delete cascade,
  doc_type    text not null,
  doc_no      text not null unique,
  issued_at   timestamptz not null default now(),
  issued_by   text not null default '',
  payload     jsonb not null
);

create index if not exists documents_order_id_idx on documents (order_id);

-- Seed: one shop, so the preview is a living ledger rather than an empty shell.

insert into company_profile (id) values (1)
on conflict (id) do nothing;

insert into staff (name, role) values
  ('김민재', '실장'),
  ('이서연', '디자이너'),
  ('박준호', '출력'),
  ('최은지', '영업');

insert into products (name, unit, unit_price, description, sort_order) values
  ('일반현수막', '㎡', 8000, '옥외 현수막, 고리·끈 포함', 1),
  ('메쉬현수막', '㎡', 12000, '바람구멍 메쉬, 공사·외벽용', 2),
  ('고품질실사', '㎡', 15000, '실내 실사출력, 발색 강조', 3),
  ('X배너 세트', '개', 35000, '출력물 + 거치대', 4),
  ('배너거치대', '개', 18000, '거치대만', 5),
  ('현수막 게시대 설치', '개', 25000, '게시대 걸이 설치 대행', 6),
  ('시트지 컷팅', '㎡', 20000, '컷팅시트, 부착 별도', 7);
