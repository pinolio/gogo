-- gogo?gogo! v136 등 장식 10종 상점에 올리기 (선생님 11/13 "상점에 등 장식 상품 만들자")
-- Supabase 대시보드 → SQL Editor → Run. 두 번 실행해도 괜찮음 (이미 있으면 이름·가격만 맞춤)
insert into public.shop_items (id, slot, name, price) values
  ('bd_bag',       'back', '책가방',        6),
  ('bd_bag_sky',   'back', '하늘색 책가방', 6),
  ('bd_cape',      'back', '영웅 망토',     15),
  ('bd_angel',     'back', '천사 날개',     30),
  ('bd_cape_dark', 'back', '어둠의 망토',   30),
  ('bd_bat',       'back', '박쥐 날개',     35),
  ('bd_fairy',     'back', '요정 날개',     45),
  ('bd_jet',       'back', '제트팩',        50),
  ('bd_dragon',    'back', '용 날개',       60),
  ('bd_phoenix',   'back', '불사조 날개',   60)
on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price;

select count(*) as back_items from public.shop_items where slot = 'back';
