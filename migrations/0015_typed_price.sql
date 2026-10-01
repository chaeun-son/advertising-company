-- 금액은 입력한 단가 × 수량. 사이즈로 다시 곱하지 않는다.
update order_items
set amount = unit_price * greatest(qty, 1);
