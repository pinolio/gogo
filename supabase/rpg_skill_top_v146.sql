-- v146 조사용 (읽기만 · 아무것도 바꾸지 않음): skillcom RPG 플레이어들이 마법 칸(1~4 · QWER)에 넣어 둔 마법 순위 상위 15
-- 마법 쓴 횟수는 서버에 기록되지 않아서, '칸에 넣어 둔 사람 수'로 많이 쓰는 마법을 알아봄
with sk(id, name, el) as (values
  ('magicarrow','마법 화살','light'),
  ('fireball','파이어볼','fire'),
  ('watershot','물방울 탄','water'),
  ('heal1','회복의 물','water'),
  ('stonewall','돌 방패','earth'),
  ('windblade','바람 칼날','wind'),
  ('firering','불꽃 고리','fire'),
  ('thunderarrow','번개 화살','thunder'),
  ('earthsplit','대지 가르기','earth'),
  ('tornado','회오리','wind'),
  ('lightspear','빛의 창','light'),
  ('firerain','화염 비','fire'),
  ('tidal','해일','water'),
  ('chainbolt','연쇄 번개','thunder'),
  ('gale','질풍 돌진','wind'),
  ('holylight','성스러운 빛','light'),
  ('thunderfall','낙뢰','thunder'),
  ('quake','지진','earth'),
  ('stormblade','폭풍 칼날','wind'),
  ('barrier','빛의 결계','light'),
  ('waterfall','대폭포','water'),
  ('sunburst','태양 폭발','fire'),
  ('thorspear','천둥의 창','thunder'),
  ('earthrage','대지의 분노','earth'),
  ('judgement','심판의 빛','light'),
  ('elemental','원소 해방','light'),
  ('darkorb','어둠 구슬','dark'),
  ('cursefog','저주의 안개','dark'),
  ('shadowspear','그림자 창','dark'),
  ('abyss','심연의 비','dark')
), fu(e1, e2, name) as (values
  ('fire','water','증기 폭발'),
  ('fire','wind','화염 폭풍'),
  ('fire','earth','용암 늪'),
  ('fire','thunder','플라즈마 탄'),
  ('fire','light','태양 광선'),
  ('water','wind','눈보라'),
  ('water','earth','진흙 늪'),
  ('water','thunder','감전 파도'),
  ('water','light','치유의 비'),
  ('wind','earth','모래 폭풍'),
  ('wind','thunder','뇌우'),
  ('wind','light','빛의 깃털'),
  ('earth','thunder','자력 폭발'),
  ('earth','light','수호의 바위'),
  ('thunder','light','섬광 돌진'),
  ('fire','dark','지옥불'),
  ('water','dark','검은 소용돌이'),
  ('wind','dark','그림자 칼바람'),
  ('earth','dark','무덤 가시'),
  ('thunder','dark','검은 번개'),
  ('light','dark','혼돈의 일격')
), used as (
  select g.user_id, x.id, x.kind
  from public.game_saves g
  cross join lateral (
    select v as id, '기본' as kind from jsonb_array_elements_text(coalesce(g.data->'slots', '[]'::jsonb)) v
    union all
    select v, '융합' from jsonb_array_elements_text(coalesce(g.data->'fslots', '[]'::jsonb)) v
  ) x
  where g.game_id = 'rpg' and x.id is not null and x.id <> 'null'
), named as (
  select u.user_id, u.kind,
    case when u.id like 'fu:%' then coalesce(
      (select f.name from fu f join sk a on a.id = split_part(substr(u.id, 4), '+', 1) join sk b on b.id = split_part(substr(u.id, 4), '+', 2)
        where (f.e1 = a.el and f.e2 = b.el) or (f.e1 = b.el and f.e2 = a.el) limit 1), u.id)
    else coalesce((select s.name from sk s where s.id = u.id), u.id) end as name
  from used u
)
select row_number() over (order by count(distinct user_id) desc, name) as "순위",
       name as "마법", kind as "종류", count(distinct user_id) as "넣어 둔 사람 수"
from named
group by name, kind
order by "넣어 둔 사람 수" desc, name
limit 15;
