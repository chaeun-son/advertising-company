update order_items
   set memo = '급행'
 where order_id = 1
   and memo like '%스냅샷%';
