-- 시안마다 다른 현수막 문구를 저장
alter table drafts add column if not exists manuscript text not null default '';
