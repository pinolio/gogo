-- gogo?gogo! v114 새 피부 10가지 (선생님 그림) — 상점 '피부' 메뉴
-- Supabase 대시보드 → SQL Editor → 붙여 넣고 Run (여러 번 실행해도 괜찮음)
-- 사람 피부색은 무료(0P), 판타지 피부는 포인트 (사이트 avatar/avatar.js 의 가격과 같게)
insert into public.shop_items (id, slot, name, price) values
  ('s_dark',   'skin', '진한 갈색 피부',   0),
  ('s_blush',  'skin', '발그레 피부',      0),
  ('s_copper', 'skin', '붉은 구릿빛 피부', 0),
  ('s_ochre',  'skin', '황토빛 피부',      0),
  ('s_tan',    'skin', '햇볕 그을린 피부', 0),
  ('s_purple', 'skin', '보랏빛 피부',     22),
  ('s_ghost',  'skin', '잿빛 유령 피부',  35),
  ('s_elf',    'skin', '엘프 피부',       40),
  ('s_night',  'skin', '밤하늘 피부',     45),
  ('s_angel',  'skin', '천사 피부',      100)
on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price;

-- 확인: 아래 숫자가 18 이면 성공 (피부 전체 수)
select count(*) as skins from public.shop_items where slot = 'skin';

-- v114 새 머리 '올림 머리' (선생님 그림, 8P) — 위와 같이 여러 번 실행해도 괜찮음
insert into public.shop_items (id, slot, name, price) values
  ('h_updo', 'hair', '올림 머리', 8)
on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price;

-- 확인: 아래가 h_updo · 올림 머리 · 8 한 줄이면 성공
select id, name, price from public.shop_items where id = 'h_updo';
