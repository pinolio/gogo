-- gogo?gogo! v211 — 시즌 1위 보상 50P → 200P · 11월 신호등 구구단 이벤트 2·3등 상 · 메인 배너용 구구단 1~3등 공개 함수 (선생님 결정 2026-11-25)
--  · 11월 시즌(2026-11)부터 게임마다 1위에게 +200P. 정산은 12월 1일 0시(한국 시간) 뒤 누군가 처음 로그인할 때 자동(두 번 주지 않음)
--  · 11월 신호등 구구단 이벤트: 1등 200P(= 시즌 1위 상) · 2등 150P · 3등 100P  (season_awards 에 'gugu' · 'gugu#2' · 'gugu#3')
--  · gugu_event_top() = 11월 구구단 1~3등 닉네임·점수 (누구나 읽기 · 메인 화면 12월 배너가 씀)
--  · ⚠ 12월 1일 0시 전에 Supabase SQL Editor 에서 이 파일을 한 번 Run 해 주세요. 여러 번 실행해도 안전합니다.
-- 지난 시즌 정산 (끝난 달만). 돌려주는 값 = 이번에 새로 준 상 개수
create or replace function public.season_settle() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_first date := date '2026-11-01';
  v_now   date := date_trunc('month', now() at time zone 'Asia/Seoul')::date;   -- 지금 시즌 첫날
  v_m     date;
  v_season text;
  v_start timestamptz; v_end timestamptz;
  v_skip  text[] := array['rpg', 'p512', 'battle', 'blocks', '2048', 'p1024'];   -- v79: 퍼즐512 = 랭킹 대전 기록('ultimate')으로, 옛 대결 기록('p512')은 뺌 · 신호등 구구단('gugu')은 자동 포함
  v_total integer := 0; v_n integer;
begin
  if auth.uid() is null then return 0; end if;
  v_m := v_first;
  while v_m < v_now loop
    v_season := to_char(v_m, 'YYYY-MM');
    if not exists (select 1 from public.season_settled where season = v_season) then
      -- 같은 시즌을 두 사람이 동시에 정산하지 않도록
      perform pg_advisory_xact_lock(hashtext('season_settle:' || v_season));
      if not exists (select 1 from public.season_settled where season = v_season) then
        v_start := (v_m::timestamp) at time zone 'Asia/Seoul';
        v_end   := ((v_m + interval '1 month')::timestamp) at time zone 'Asia/Seoul';
        with best as (
          select distinct on (r.game_id) r.game_id, r.user_id, r.score
            from public.play_records r
            join public.profiles p on p.id = r.user_id and not p.banned and coalesce(p.role, 'user') <> 'admin'
           where r.played_at >= v_start and r.played_at < v_end
             and r.score > 0 and r.game_id <> all (v_skip) and r.game_id <> 'scfight'
           order by r.game_id, r.score desc, r.played_at asc
        ), fight as (
          select 'scfight'::text as game_id, r.user_id, count(*)::int as score
            from public.play_records r
            join public.profiles p on p.id = r.user_id and not p.banned and coalesce(p.role, 'user') <> 'admin'
           where r.played_at >= v_start and r.played_at < v_end
             and r.game_id = 'scfight' and r.result = 'win'
           group by r.user_id
           order by count(*) desc, max(r.played_at) asc
           limit 1
        ), ins as (
          insert into public.season_awards (season, game_id, user_id, score, points)
          select v_season, game_id, user_id, score, 200 from (select * from best union all select * from fight) w
          on conflict (season, game_id) do nothing
          returning user_id, points
        ), gg as (   -- v211: 2026-11 신호등 구구단 이벤트 2등 150P · 3등 100P (1등은 위 시즌 1위 200P)
          select user_id, score, rn from (
            select user_id, score, row_number() over (order by score desc, pat asc) as rn from (
              select distinct on (r.user_id) r.user_id, r.score, r.played_at as pat
                from public.play_records r
                join public.profiles p on p.id = r.user_id and not p.banned and coalesce(p.role, 'user') <> 'admin'
               where v_season = '2026-11' and r.game_id = 'gugu' and r.score > 0
                 and r.played_at >= v_start and r.played_at < v_end
               order by r.user_id, r.score desc, r.played_at asc) u) k
           where rn in (2, 3)
        ), ins2 as (
          insert into public.season_awards (season, game_id, user_id, score, points)
          select v_season, 'gugu#' || rn, user_id, score, case rn when 2 then 150 else 100 end from gg
          on conflict (season, game_id) do nothing
          returning user_id, points
        ), pay as (
          update public.profiles p
             set points = p.points + x.pts, earned = p.earned + x.pts
            from (select user_id, sum(points)::int as pts from (select * from ins union all select * from ins2) z group by user_id) x
           where p.id = x.user_id
          returning 1
        )
        select (select count(*) from ins) + (select count(*) from ins2) into v_n;
        insert into public.season_settled (season) values (v_season) on conflict do nothing;
        v_total := v_total + v_n;
      end if;
    end if;
    v_m := (v_m + interval '1 month')::date;
  end loop;
  return v_total;
end; $$;

grant execute on function public.season_settle() to authenticated;

-- v211: 11월 신호등 구구단 이벤트 1~3등 (메인 화면 12월 배너). 닉네임·점수만 돌려줌. 로그인 안 해도 읽기 가능
create or replace function public.gugu_event_top() returns table (rank int, nickname text, score int)
language sql security definer set search_path = public stable as $$
  select k.rn::int, coalesce(p.nickname, '?'), k.score::int from (
    select user_id, score, row_number() over (order by score desc, pat asc) as rn from (
      select distinct on (r.user_id) r.user_id, r.score, r.played_at as pat
        from public.play_records r
        join public.profiles p on p.id = r.user_id and not p.banned and coalesce(p.role, 'user') <> 'admin'
       where r.game_id = 'gugu' and r.score > 0
         and r.played_at >= timestamptz '2026-11-01 00:00:00+09' and r.played_at < timestamptz '2026-12-01 00:00:00+09'
       order by r.user_id, r.score desc, r.played_at asc) u) k
  join public.profiles p on p.id = k.user_id
  where k.rn <= 3 order by k.rn;
$$;
grant execute on function public.gugu_event_top() to anon, authenticated;

select 'season_points_v211' as check_name, 200 as points, 'gugu 2등 150 · 3등 100 (2026-11)' as gugu_event, 'rpg,p512,battle,blocks,2048,p1024' as skip;
