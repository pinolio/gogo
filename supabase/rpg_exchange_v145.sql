-- =====================================================================
-- v145 (2026-11-14): skillcom RPG 골드 ↔ 사이트 포인트 교환 (약방 상점 '포인트 교환' 탭)
--   비율: 골드 100 = 포인트 1 (양쪽 모두)
--   하루 한도: 방향마다 100 포인트 (한국 시간 기준 하루) — 골드→포인트 100P · 포인트→골드 100P
--   골드는 서버에 저장된 캐릭터(game_saves, game_id 'rpg')의 data.gold 를 서버가 직접 확인하고 빼거나 더함.
--   교환 기록은 rpg_exchanges 표에 남음 (본인 것만 읽기 · 쓰기는 이 함수만).
--   포인트는 profiles.points 만 바뀜 (earned = '게임으로 번 포인트'는 그대로).
--   여러 번 실행해도 괜찮음. 지우는 내용 없음.
-- =====================================================================
create table if not exists public.rpg_exchanges (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  dir        text not null check (dir in ('g2p', 'p2g')),
  points     integer not null check (points between 1 and 100),
  gold       bigint not null,
  at         timestamptz not null default now()
);
create index if not exists rpg_exchanges_user_at on public.rpg_exchanges (user_id, at desc);
alter table public.rpg_exchanges enable row level security;
drop policy if exists "rpgx_select_own" on public.rpg_exchanges;
create policy "rpgx_select_own" on public.rpg_exchanges for select to authenticated using (user_id = auth.uid() or public.is_admin());
grant select on public.rpg_exchanges to authenticated;

create or replace function public.rpg_exchange(p_dir text, p_points integer) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid      uuid := auth.uid();
  rate     constant integer := 100;    -- 골드 100 = 1 포인트
  daymax   constant integer := 100;    -- 방향마다 하루 100 포인트
  dstart   timestamptz := ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
  used     integer;
  sv       jsonb;
  g        bigint;
  pts      integer;
begin
  if uid is null then raise exception '로그인이 필요해요'; end if;
  if p_dir not in ('g2p', 'p2g') then raise exception '잘못된 교환이에요'; end if;
  if p_points is null or p_points < 1 or p_points > daymax then raise exception '한 번에 1~% 포인트까지 바꿀 수 있어요', daymax; end if;
  if exists (select 1 from public.profiles where id = uid and banned) then raise exception '이용이 정지된 계정이에요'; end if;

  -- 오늘 이 방향으로 바꾼 양
  select coalesce(sum(points), 0) into used from public.rpg_exchanges where user_id = uid and dir = p_dir and at >= dstart;
  if used + p_points > daymax then raise exception '오늘은 % 포인트만 더 바꿀 수 있어요 (하루 %P)', greatest(0, daymax - used), daymax; end if;

  -- 서버에 저장된 캐릭터 (동시에 두 번 눌러도 한 번씩 차례로)
  select data into sv from public.game_saves where user_id = uid and game_id = 'rpg' for update;
  if sv is null then raise exception '서버에 저장된 캐릭터가 없어요. 게임에서 [지금 저장]을 먼저 눌러 주세요'; end if;
  g := greatest(0, coalesce((sv->>'gold')::bigint, 0));
  select points into pts from public.profiles where id = uid for update;

  if p_dir = 'g2p' then
    if g < p_points::bigint * rate then raise exception '골드가 모자라요 (필요 %G · 가진 %G)', p_points::bigint * rate, g; end if;
    g := g - p_points::bigint * rate;
    update public.profiles set points = points + p_points where id = uid;
    pts := pts + p_points;
  else
    if pts < p_points then raise exception '포인트가 모자라요 (필요 %P · 가진 %P)', p_points, pts; end if;
    g := g + p_points::bigint * rate;
    update public.profiles set points = points - p_points where id = uid;
    pts := pts - p_points;
  end if;

  update public.game_saves set data = jsonb_set(sv, '{gold}', to_jsonb(g)), updated_at = now() where user_id = uid and game_id = 'rpg';
  insert into public.rpg_exchanges (user_id, dir, points, gold) values (uid, p_dir, p_points, p_points::bigint * rate);

  return json_build_object('gold', g, 'points', pts,
    'g2p_today', (select coalesce(sum(points), 0) from public.rpg_exchanges where user_id = uid and dir = 'g2p' and at >= dstart),
    'p2g_today', (select coalesce(sum(points), 0) from public.rpg_exchanges where user_id = uid and dir = 'p2g' and at >= dstart));
end; $$;

revoke execute on function public.rpg_exchange(text, integer) from public, anon;
grant  execute on function public.rpg_exchange(text, integer) to authenticated;

-- 오늘 바꾼 양 (교환 창을 열 때 보여 줌)
create or replace function public.rpg_exchange_today() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'g2p_today', coalesce(sum(points) filter (where dir = 'g2p'), 0),
    'p2g_today', coalesce(sum(points) filter (where dir = 'p2g'), 0))
  from public.rpg_exchanges
  where user_id = auth.uid() and at >= ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul';
$$;
revoke execute on function public.rpg_exchange_today() from public, anon;
grant  execute on function public.rpg_exchange_today() to authenticated;

-- 확인
select 'rpg_exchanges 표' as what, count(*) from public.rpg_exchanges;
