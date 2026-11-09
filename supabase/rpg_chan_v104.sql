-- v104 (2026-11-09): 마법 융합 모험 RPG — 채널 이동 창
--   · rpg_channels(지도) : 내가 있는 서버·지도의 채널마다 지금 인원 (최근 45초)
--   · rpg_room_to(지도, 채널) : 고른 채널로 옮기기 (가득(5명)이면 'full'). rpg_room 과 같은 잠금을 써서 동시에 옮겨도 5명을 넘지 않음
--   · 먼저 rpg_server_v103.sql · rpg_channel_v103.sql 이 실행돼 있어야 함 (rpg_online.ch 칸)
--   · cap 5 = settings.js online.chCap · rpg_channel_v103.sql 과 같게

create or replace function public.rpg_channels(p_map text)
returns table (ch int, players int)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); m text := coalesce(p_map, ''); srv int;
begin
  if me is null then return; end if;
  if m !~ '^[a-z0-9_-]{0,40}$' then m := ''; end if;
  select o.server into srv from public.rpg_online o where o.user_id = me;
  if srv is null then return; end if;
  return query
    select o.ch::int, count(*)::int from public.rpg_online o
     where o.server = srv and o.map = m and o.last_seen > now() - interval '45 seconds'
     group by o.ch order by o.ch;
end; $$;

create or replace function public.rpg_room_to(p_map text, p_ch int)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m text := coalesce(p_map, ''); srv int; n int; cap constant int := 5;
begin
  if me is null then return json_build_object('ok', false, 'reason', 'login'); end if;
  if p_ch is null or p_ch < 1 or p_ch > 200 then return json_build_object('ok', false, 'reason', 'bad'); end if;
  if m !~ '^[a-z0-9_-]{0,40}$' then m := ''; end if;
  select server into srv from public.rpg_online where user_id = me;
  if srv is null then return json_build_object('ok', false, 'reason', 'join'); end if;
  perform pg_advisory_xact_lock(hashtext('rpg-room:' || srv || ':' || m));
  select count(*) into n from public.rpg_online o
   where o.server = srv and o.map = m and o.ch = p_ch and o.user_id <> me and o.last_seen > now() - interval '45 seconds';
  if n >= cap then return json_build_object('ok', false, 'reason', 'full', 'players', n); end if;
  update public.rpg_online set map = m, ch = p_ch, last_seen = now() where user_id = me;
  return json_build_object('ok', true, 'ch', p_ch, 'players', n + 1);
end; $$;

revoke all on function public.rpg_channels(text) from public;
revoke all on function public.rpg_room_to(text, int) from public;
grant execute on function public.rpg_channels(text) to authenticated;
grant execute on function public.rpg_room_to(text, int) to authenticated;

select 'ok' as result;
