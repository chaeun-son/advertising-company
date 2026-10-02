-- 사용 회사 브랜드. 기존 행은 그대로 두고 칸만 추가한다.
alter table company_profile add column if not exists website text not null default '';
alter table company_profile add column if not exists brand_color text not null default '';
alter table company_profile add column if not exists logo_url text not null default '';
