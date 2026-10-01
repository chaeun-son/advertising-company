create table if not exists monthly_archives (
  id          serial primary key,
  month       text not null unique,
  json        text not null,
  order_count integer not null default 0,
  created_at  timestamptz not null default now()
);
