-- gogo?gogo! v139 모자 14종 상점에 올리기 (선생님 11/13 "상점에 모자 장식에 상품 만들자")
-- Supabase 대시보드 → SQL Editor → Run. 두 번 실행해도 괜찮음 (이미 있으면 이름·가격만 맞춤)
insert into public.shop_items (id, slot, name, price) values
  ('ht_cap',    'hat', '야구 모자',     4),
  ('ht_band',   'hat', '스포츠 머리띠', 4),
  ('ht_beanie', 'hat', '비니',          5),
  ('ht_snap',   'hat', '거꾸로 스냅백', 6),
  ('ht_pom',    'hat', '방울 비니',     6),
  ('ht_hard',   'hat', '안전모',        6),
  ('ht_straw',  'hat', '밀짚모자',      6),
  ('ht_rain',   'hat', '우비 모자',     6),
  ('ht_chef',   'hat', '요리사 모자',   8),
  ('ht_cat',    'hat', '고양이 후드',   8),
  ('ht_santa',  'hat', '산타 모자',     8),
  ('ht_bunny',  'hat', '토끼 후드',     8),
  ('ht_bear',   'hat', '곰 후드',       8),
  ('ht_peng',   'hat', '펭귄 후드',     8)
on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price;

select count(*) as hat_items from public.shop_items where slot = 'hat';
