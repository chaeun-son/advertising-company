-- 포맥스는 장당 단가. 가로·세로는 규격이라 면적으로 곱하지 않는다.
update products
set unit = '개'
where name like '%포맥스%'
   or name like '%포멕스%'
   or name like '%폼보드%'
   or name like '%폼렉스%';

update order_items
set unit = '개',
    amount = unit_price * greatest(qty, 1)
where product_name like '%포맥스%'
   or product_name like '%포멕스%'
   or product_name like '%폼보드%'
   or product_name like '%폼렉스%';
