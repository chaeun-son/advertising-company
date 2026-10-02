-- 사용자 배경음악. 파일 바이너리는 넣지 않고 오브젝트 저장소 키만 둔다.
-- 사진·영상도 같은 user_storage_objects 에 kind 만 바꿔 용량을 합산할 수 있다.

create table if not exists user_music (
  id            text primary key,
  user_id       text not null,
  file_name     text not null,
  display_name  text not null,
  file_url      text not null,
  storage_key   text not null,
  byte_size     integer not null,
  duration_sec  double precision not null default 0,
  format        text not null,
  created_at    timestamptz not null default now(),
  category      text not null default '기타',
  tags          text not null default '',
  favorite      boolean not null default false,
  content_hash  text not null,
  blob_url      text,
  source        text not null default '',
  license       text not null default '',
  vendor        text not null default '',
  note          text not null default ''
);

create index if not exists user_music_user_idx on user_music (user_id, created_at desc);
create index if not exists user_music_hash_idx on user_music (user_id, content_hash);

create table if not exists user_music_categories (
  id          text primary key,
  user_id     text not null,
  name        text not null,
  created_at  timestamptz not null default now(),
  constraint user_music_categories_once unique (user_id, name)
);

create table if not exists user_music_uses (
  id            text primary key,
  user_id       text not null,
  music_id      text not null,
  project_key   text not null,
  project_name  text not null default '',
  updated_at    timestamptz not null default now(),
  constraint user_music_uses_once unique (user_id, music_id, project_key)
);

create index if not exists user_music_uses_music_idx on user_music_uses (user_id, music_id);

create table if not exists user_storage_objects (
  id           text primary key,
  user_id      text not null,
  kind         text not null,
  storage_key  text not null,
  byte_size    integer not null,
  created_at   timestamptz not null default now()
);

create index if not exists user_storage_objects_user_idx on user_storage_objects (user_id, kind);
