-- 입금 단계 추가에 맞춰 현수막 최소·일반코팅 명함 단가 갱신
update products
set unit_price = 25000, description = '500×90 이하'
where name = '현수막 최소사이즈';

update products
set unit_price = 20000
where name in ('일반코팅 명함 단면', '일반코팅 명함 양면');
