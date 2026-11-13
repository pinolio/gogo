-- gogo?gogo! v138 얼굴 장식 11종 상점에 올리기 (선생님 11/13 "상점에 얼굴 장식에 상품 만들자")
-- Supabase 대시보드 → SQL Editor → Run. 두 번 실행해도 괜찮음 (이미 있으면 이름·가격만 맞춤)
insert into public.shop_items (id, slot, name, price) values
  ('fc_mustache', 'face', '콧수염',        3),
  ('fc_glasses',  'face', '동그란 안경',   4),
  ('fc_mask',     'face', '마스크',        5),
  ('fc_goggles',  'face', '실험 보안경',   5),
  ('fc_patch',    'face', '안대',          6),
  ('fc_beard',    'face', '산타 수염',     6),
  ('fc_sun',      'face', '선글라스',      8),
  ('fc_headset',  'face', '헤드셋 마이크', 8),
  ('fc_phones',   'face', '헤드폰',        9),
  ('fc_ninja',    'face', '닌자 복면',     10),
  ('fc_elf',      'face', '엘프 귀',       10)
on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price;

select count(*) as face_items from public.shop_items where slot = 'face';
