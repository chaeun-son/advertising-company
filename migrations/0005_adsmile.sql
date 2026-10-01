-- (주)애드스마일 실데이터: 직원 3명, 매뉴얼 단가

alter table products add column if not exists category text not null default '기타';
alter table products add column if not exists min_qty integer not null default 1;

update company_profile set
  name = '(주)애드스마일',
  owner_name = '최연수',
  biz_no = '',
  phone = '',
  fax = '',
  address = '',
  email = '',
  bank_name = '',
  bank_account = '',
  bank_holder = '(주)애드스마일',
  seal_label = '애드스마일',
  vat_included = false,
  rush_rate = 1.30,
  quote_valid_days = 14
where id = 1;

delete from staff;

insert into staff (name, role) values
  ('최연수', '대표'),
  ('손채은', '과장'),
  ('지재회', '대리');

update products set
  name = '현수막 (㎡)',
  unit = '㎡',
  unit_price = 10000,
  description = '그 외 사이즈 헤베당. 9,000원인 경우도 있음',
  sort_order = 3,
  active = true,
  category = '현수막',
  min_qty = 1
where id = 1;

update products set
  name = '현수막 최소사이즈',
  unit = '개',
  unit_price = 25000,
  description = '500×90 이하',
  sort_order = 1,
  active = true,
  category = '현수막',
  min_qty = 1
where id = 2;

update products set
  name = '게릴라 현수막',
  unit = '개',
  unit_price = 25000,
  description = '500×90 / 600×90',
  sort_order = 2,
  active = true,
  category = '현수막',
  min_qty = 1
where id = 3;

update products set
  name = 'X배너 PET 60×180',
  unit = '개',
  unit_price = 35000,
  description = '거치대 별도',
  sort_order = 10,
  active = true,
  category = 'X배너',
  min_qty = 1
where id = 4;

update products set
  name = '거치대 실내',
  unit = '개',
  unit_price = 20000,
  description = 'X배너 실내 거치대',
  sort_order = 12,
  active = true,
  category = 'X배너',
  min_qty = 1
where id = 5;

update products set
  name = '거치대 실외(물통)',
  unit = '개',
  unit_price = 35000,
  description = 'X배너 실외 물통 거치대',
  sort_order = 13,
  active = true,
  category = 'X배너',
  min_qty = 1
where id = 6;

update products set
  name = 'X배너 현수막 60×180',
  unit = '개',
  unit_price = 15000,
  description = '거치대 별도',
  sort_order = 11,
  active = true,
  category = 'X배너',
  min_qty = 1
where id = 7;

insert into products (name, unit, unit_price, description, sort_order, active, category, min_qty)
select v.name, v.unit, v.unit_price, v.description, v.sort_order, true, v.category, v.min_qty
from (values
  ('압축큐방', '개', 3000, '개당 3,300원 VAT포함 → 공급 3,000', 4, '현수막', 1),
  ('일반코팅 명함 단면', '개', 20000, '최소 500매 · 4도', 20, '명함', 500),
  ('일반코팅 명함 양면', '개', 20000, '최소 500매 · 8도', 21, '명함', 500),
  ('특수지 명함 단면', '개', 20000, '최소 200매 · 4도', 22, '명함', 200),
  ('특수지 명함 양면', '개', 25000, '최소 200매 · 8도', 23, '명함', 200),
  ('긴급명함(반누보) 단면', '개', 30000, '최소 200매 · 4도', 24, '명함', 200),
  ('긴급명함(반누보) 양면', '개', 35000, '최소 200매 · 8도', 25, '명함', 200),
  ('카드 명함 단면', '개', 55000, '최소 200매 · 4도', 26, '명함', 200),
  ('카드 명함 양면', '개', 60000, '최소 200매 · 8도', 27, '명함', 200),
  ('귀도리(라운딩)', '개', 5000, '명함 모서리 라운딩', 28, '명함', 1),
  ('소봉투 컬러 1,000매', '개', 80000, 'A4 22×10.5 모조 120g', 30, '봉투', 1000),
  ('대봉투 컬러 1,000매', '개', 170000, '5절 32.9×24.5 모조 120g', 31, '봉투', 1000),
  ('스티커 사각 유광 1,000매', '개', 20000, '9×5.5 이하', 40, '스티커', 1000),
  ('스티커 사각 무광 1,000매', '개', 25000, '9×5.5 이하', 41, '스티커', 1000),
  ('스티커 도무송 유광 1,000매', '개', 20000, '5.5×2.5 이하', 42, '스티커', 1000),
  ('스티커 원형 도무송 1,000매', '개', 25000, '6.5×6.5 이하', 43, '스티커', 1000)
) as v(name, unit, unit_price, description, sort_order, category, min_qty)
where not exists (select 1 from products p where p.name = v.name);

update orders set assignee = '손채은' where assignee in ('이서연', '김민재');
update orders set assignee = '지재회' where assignee in ('박준호', '최은지');
update orders set created_by = '손채은' where created_by in ('이서연');
update orders set created_by = '지재회' where created_by in ('최은지', '박준호');
update orders set created_by = '최연수' where created_by in ('김민재');

update drafts set created_by = '손채은' where created_by in ('이서연', '김민재', '박준호', '최은지');

update messages set staff_name = '손채은' where staff_name in ('이서연');
update messages set staff_name = '지재회' where staff_name in ('최은지', '박준호');
update messages set staff_name = '최연수' where staff_name in ('김민재');

-- 데모 품목 금액을 매뉴얼 단가로
update order_items
   set product_id = 3, product_name = '게릴라 현수막', unit = '개',
       width_cm = 600, height_cm = 90, qty = 1, unit_price = 25000, amount = 32500, memo = '급행 · 사방타공'
 where order_id = 1 and sort_order = 0;

update order_items
   set product_id = 1, product_name = '현수막 (㎡)', unit = '㎡',
       width_cm = 900, height_cm = 90, qty = 1, unit_price = 10000, amount = 81000, memo = '메쉬 · 게시대 시공 별도 확인'
 where order_id = 2 and sort_order = 0;

delete from order_items where order_id = 2 and sort_order = 1;

update order_items
   set product_id = 2, product_name = '현수막 최소사이즈', unit = '개',
       width_cm = 300, height_cm = 90, qty = 1, unit_price = 20000, amount = 20000, memo = ''
 where order_id = 3 and sort_order = 0;

update order_items
   set product_id = 2, product_name = '현수막 최소사이즈', unit = '개',
       width_cm = 500, height_cm = 90, qty = 3, unit_price = 20000, amount = 60000, memo = '동일 원고 3장'
 where order_id = 4 and sort_order = 0;

update order_items
   set product_id = 2, product_name = '현수막 최소사이즈', unit = '개',
       width_cm = 500, height_cm = 90, qty = 1, unit_price = 20000, amount = 20000, memo = ''
 where order_id = 5 and sort_order = 0;

update order_items
   set product_id = 1, product_name = '현수막 (㎡)', unit = '㎡',
       width_cm = 1000, height_cm = 90, qty = 1, unit_price = 10000, amount = 90000, memo = ''
 where order_id = 6 and sort_order = 0;
