-- gogo?gogo! v142 화려한 상의 10종 · 하의 10종 상점에 올리기 (선생님 11/13 "상의, 하의 다 반영해줘")
-- Supabase 대시보드 → SQL Editor → Run. 두 번 실행해도 괜찮음 (이미 있으면 이름·가격만 맞춤)
insert into public.shop_items (id, slot, name, price) values
  ('t_hanbok',   'top',    '색동 저고리',             30),
  ('t_forest',   'top',    '숲의 정령 튜닉',          35),
  ('t_princess', 'top',    '공주님 리본 블라우스',    35),
  ('t_royal',    'top',    '왕자님 황금 예복',        40),
  ('t_wizard',   'top',    '대마법사 별빛 로브',      45),
  ('t_pirate',   'top',    '해적 선장 코트',          50),
  ('t_space',    'top',    '은하 우주 기사 슈트',     60),
  ('t_ice',      'top',    '얼음 크리스탈 아머',      60),
  ('t_angel',    'top',    '천사 날개 튜닉',          70),
  ('t_dragon',   'top',    '화염 드래곤 아머',        80),
  ('b_hanbok',   'bottom', '색동 한복 바지·치마',     25),
  ('b_forest',   'bottom', '숲의 정령 하의',          30),
  ('b_princess', 'bottom', '공주님 프릴 하의',        30),
  ('b_royal',    'bottom', '왕자님 예복 하의',        35),
  ('b_wizard',   'bottom', '대마법사 별빛 하의',      40),
  ('b_pirate',   'bottom', '해적 선장 하의',          40),
  ('b_space',    'bottom', '은하 우주 기사 하의',     50),
  ('b_ice',      'bottom', '얼음 크리스탈 다리 갑옷', 50),
  ('b_angel',    'bottom', '천사 깃털 하의',          60),
  ('b_dragon',   'bottom', '화염 드래곤 다리 갑옷',   70)
on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price;

select slot, count(*) from public.shop_items where slot in ('top','bottom') group by slot;
