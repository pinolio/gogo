-- gogo?gogo! v137 신발 8종 상점에 올리기 (선생님 11/13 "상점에 신발 장식에 상품 만들자")
-- Supabase 대시보드 → SQL Editor → Run. 두 번 실행해도 괜찮음 (이미 있으면 이름·가격만 맞춤)
insert into public.shop_items (id, slot, name, price) values
  ('sh_red',     'shoes', '빨간 운동화',   3),
  ('sh_slipper', 'shoes', '슬리퍼',        3),
  ('sh_rain_y',  'shoes', '노란 장화',     5),
  ('sh_rain_r',  'shoes', '빨간 장화',     5),
  ('sh_hightop', 'shoes', '하이탑 운동화', 6),
  ('sh_boots',   'shoes', '검정 부츠',     6),
  ('sh_space',   'shoes', '우주 부츠',     8),
  ('sh_gold',    'shoes', '황금 신발',     20)
on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price;

select count(*) as shoe_items from public.shop_items where slot = 'shoes';
