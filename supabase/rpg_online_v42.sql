-- =====================================================================
-- v42 (2026-10-30): 마법 융합 모험 RPG — 온라인 서버 10개 (서버마다 최대 30명)
--   · 로그인한 사람만 서버에 들어갈 수 있음 (손님은 혼자 하기)
--   · 들어간 사람은 15초마다 rpg_join() 을 다시 불러 "아직 여기 있어요"를 기록 → 45초 넘게 소식이 없으면 인원에서 빠짐
--   · 서버 인원은 rpg_servers() 로 셈 (실시간 연결을 쓰지 않아서 무료 요금제 제한과 상관없음)
--   · 서버가 30명이면 rpg_join() 이 'full' 을 돌려줌 (동시에 들어와도 넘치지 않게 서버마다 잠금)
--   · 아이템·마법·레벨은 서버와 상관없이 계정(game_saves 표, rpg_v40.sql)에 저장 → 어느 서버에서나 이어서
--   · 표는 직접 읽거나 쓸 수 없고(RLS, 정책 없음) 아래 함수로만 다룸. 10분 넘게 소식이 없는 줄은 자동으로 지움
--   · 여러 번 실행해도 괜찮음. 기존 자료를 지우지 않음
-- =====================================================================
create table if not exists public.rpg_online (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  server     smallint not null check (server between 1 and 10),
  map        text not null default '' check (map ~ '^[a-z0-9_-]{0,40}$'),
  lv         smallint not null default 1,
  last_seen  timestamptz not null default now()
);
create index if not exists rpg_online_srv on public.rpg_online (server, last_seen desc);
alter table public.rpg_online enable row level security;   -- 정책 없음 = 직접 읽기·쓰기 불가 (아래 함수로만)
revoke all on public.rpg_online from anon, authenticated;

-- 서버 10개의 지금 인원 (최근 45초 안에 소식이 있는 사람)
create or replace function public.rpg_servers()
returns table (server int, players int)
language sql stable security definer set search_path = public as $$
  select s, (select count(*)::int from public.rpg_online o where o.server = s and o.last_seen > now() - interval '45 seconds')
    from generate_series(1, 10) s order by s;
$$;

-- 서버에 들어가기 / 15초마다 다시 불러 자리 유지 (지금 있는 지도·레벨도 기록)
create or replace function public.rpg_join(p_server int, p_map text, p_lv int)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int; cap constant int := 30; m text := coalesce(p_map, '');
begin
  if me is null then return json_build_object('ok', false, 'reason', 'login'); end if;
  if p_server is null or p_server < 1 or p_server > 10 then return json_build_object('ok', false, 'reason', 'bad'); end if;
  if exists (select 1 from public.profiles p where p.id = me and p.banned) then return json_build_object('ok', false, 'reason', 'banned'); end if;
  if m !~ '^[a-z0-9_-]{0,40}$' then m := ''; end if;
  perform pg_advisory_xact_lock(7340000 + p_server);       -- 같은 서버에 동시에 들어와도 30명을 넘지 않게
  select count(*) into n from public.rpg_online
   where server = p_server and last_seen > now() - interval '45 seconds' and user_id <> me;
  if n >= cap then return json_build_object('ok', false, 'reason', 'full', 'players', n); end if;
  insert into public.rpg_online as o (user_id, server, map, lv, last_seen)
  values (me, p_server, m, greatest(1, least(100, coalesce(p_lv, 1))), now())
  on conflict (user_id) do update set server = excluded.server, map = excluded.map, lv = excluded.lv, last_seen = now();
  if random() < 0.05 then delete from public.rpg_online where last_seen < now() - interval '10 minutes'; end if;
  return json_build_object('ok', true, 'players', n + 1);
end; $$;

-- 나가기 (창을 닫을 때 · 다른 서버로 옮길 때. 실패해도 45초 뒤에는 인원에서 빠짐)
create or replace function public.rpg_leave()
returns void language sql security definer set search_path = public as $$
  delete from public.rpg_online where user_id = auth.uid();
$$;

revoke all on function public.rpg_servers() from public;
revoke all on function public.rpg_join(int, text, int) from public;
revoke all on function public.rpg_leave() from public;
grant execute on function public.rpg_servers() to anon, authenticated;
grant execute on function public.rpg_join(int, text, int) to authenticated;
grant execute on function public.rpg_leave() to authenticated;

-- 확인 (서버 10줄, 처음엔 모두 0명)
select * from public.rpg_servers();
