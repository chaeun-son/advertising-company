-- 거래명세표(한텍스 B형)용 거래처·자사 항목, 애드스마일 연락처

alter table clients add column if not exists biz_no text not null default '';
alter table clients add column if not exists address text not null default '';
alter table clients add column if not exists email text not null default '';
alter table clients add column if not exists biz_type text not null default '';
alter table clients add column if not exists biz_item text not null default '';

alter table company_profile add column if not exists biz_type text not null default '';
alter table company_profile add column if not exists biz_item text not null default '';

update company_profile set
  name = '주식회사 애드스마일',
  owner_name = '최연수',
  phone = '063-714-3800',
  fax = '070-4009-3106',
  bank_holder = case when bank_holder in ('', '(주)애드스마일') then '주식회사 애드스마일' else bank_holder end,
  seal_label = case when seal_label in ('', '애드스마일') then '애드스마일' else seal_label end
where id = 1;
