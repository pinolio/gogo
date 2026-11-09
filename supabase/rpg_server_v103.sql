-- v103 (2026-11-09): 마법 융합 모험 RPG — 온라인 서버를 1개로 통합 ('조선-한양')
--   · rpg_servers() 는 1번 서버 하나만 돌려줌
--   · rpg_join() 은 1번 서버만 받고, 최대 60명 (settings.js online.cap 과 같게)
--   · 2~10번 서버에 남아 있던 접속 기록은 1번으로 옮김 (45초 안 지나면 저절로 사라지는 기록)
--   표·저장 데이터(game_saves)는 그대로. 다시 여러 개로 늘리려면 아래 1 과 60 만 바꾸면 됨

update public.rpg_online set server = 1 where server <> 1;

create or replace function public.rpg_servers()
returns table (server int, players int)
language sql stable security definer set search_path = public as $$
  select s, (select count(*)::int from public.rpg_online o where o.server = s and o.last_seen > now() - interval '45 seconds')
    from generate_series(1, 1) s order by s;
$$;

create or replace function public.rpg_join(p_server int, p_map text, p_lv int)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int; cap constant int := 60; m text := coalesce(p_map, '');
begin
  if me is null then return json_build_object('ok', false, 'reason', 'login'); end if;
  if p_server is null or p_server <> 1 then return json_build_object('ok', false, 'reason', 'bad'); end if;
  if exists (select 1 from public.profiles p where p.id = me and p.banned) then return json_build_object('ok', false, 'reason', 'banned'); end if;
  if m !~ '^[a-z0-9_-]{0,40}$' then m := ''; end if;
  perform pg_advisory_xact_lock(7340000 + p_server);       -- 동시에 들어와도 60명을 넘지 않게
  select count(*) into n from public.rpg_online
   where server = p_server and last_seen > now() - interval '45 seconds' and user_id <> me;
  if n >= cap then return json_build_object('ok', false, 'reason', 'full', 'players', n); end if;
  insert into public.rpg_online as o (user_id, server, map, lv, last_seen)
  values (me, p_server, m, greatest(1, least(100, coalesce(p_lv, 1))), now())
  on conflict (user_id) do update set server = excluded.server, map = excluded.map, lv = excluded.lv, last_seen = now();
  if random() < 0.05 then delete from public.rpg_online where last_seen < now() - interval '10 minutes'; end if;
  return json_build_object('ok', true, 'players', n + 1);
end; $$;

revoke all on function public.rpg_servers() from public;
revoke all on function public.rpg_join(int, text, int) from public;
grant execute on function public.rpg_servers() to anon, authenticated;
grant execute on function public.rpg_join(int, text, int) to authenticated;

select * from public.rpg_servers();
