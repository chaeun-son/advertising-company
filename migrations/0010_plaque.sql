alter table order_items add column if not exists copy text not null default '';

insert into products (name, unit, unit_price, description, sort_order, active, category, min_qty)
select v.name, v.unit, v.unit_price, v.description, v.sort_order, true, v.category, v.min_qty
from (values
  ('감사패', '개', 130000, '원형 크리스탈 17×18×5. 문구는 장마다', 50, '감사패', 1),
  ('기념패', '개', 130000, '원형 크리스탈 17×18×5. 문구는 장마다', 51, '감사패', 1)
) as v(name, unit, unit_price, description, sort_order, category, min_qty)
where not exists (select 1 from products p where p.name = v.name);
