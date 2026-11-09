-- v103 (2026-11-09): 마법 융합 모험 RPG — 한 지도를 '채널'로 나누기 (채널마다 최대 5명)
--   · 같은 지도에 사람이 많으면 메시지(무료 요금제 초당 100개·한 달 200만 개)가 사람 수의 제곱으로 늘어나서,
--     5명씩 채널을 나눠 서로 보이는 사람을 묶음. 빈자리가 있는 가장 앞 채널(1, 2, 3 …)로 들어감
--   · rpg_room(지도) : 내 채널 번호를 골라 기록하고 돌려줌 (같은 지도에 동시에 들어와도 5명을 넘지 않게 잠금)
--   · settings.js online.chCap 과 아래 cap 을 같게

alter table public.rpg_online add column if not exists ch smallint not null default 1;

create or replace function public.rpg_room(p_map text)
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m text := coalesce(p_map, ''); srv int; c int; cap constant int := 5;
begin
  if me is null then return 1; end if;
  if m !~ '^[a-z0-9_-]{0,40}$' then m := ''; end if;
  select server into srv from public.rpg_online where user_id = me;
  if srv is null then return 1; end if;
  perform pg_advisory_xact_lock(hashtext('rpg-room:' || srv || ':' || m));
  select g into c from generate_series(1, 200) g
   where (select count(*) from public.rpg_online o
           where o.server = srv and o.map = m and o.ch = g and o.user_id <> me and o.last_seen > now() - interval '45 seconds') < cap
   order by g limit 1;
  c := coalesce(c, 1);
  update public.rpg_online set map = m, ch = c, last_seen = now() where user_id = me;
  return c;
end; $$;

revoke all on function public.rpg_room(text) from public;
grant execute on function public.rpg_room(text) to authenticated;

select count(*) as online_now from public.rpg_online where last_seen > now() - interval '45 seconds';
