-- gogo?gogo! v79 — 시즌 1위 보상 대상 바꾸기 (선생님 결정 2026-11-06)
--  · 퍼즐512: AI·오프라인 대결을 빼고 '랭킹 대전'(예전 Ultimate mode, 기록 이름 'ultimate')이 랭킹이 됨
--    → 시즌 1위도 랭킹 대전 기록('ultimate')으로. 예전 퍼즐512 대결 기록('p512')은 시즌에서 뺌
--  · 신호등 구구단('gugu')은 새 게임이라 자동으로 시즌 대상
--  · 바뀌는 것은 season_settle() 함수의 '빼는 게임' 목록 한 줄뿐. 표·기록은 그대로. 여러 번 실행해도 안전합니다.
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
          select v_season, game_id, user_id, score, 50 from (select * from best union all select * from fight) w
          on conflict (season, game_id) do nothing
          returning user_id, points
        ), pay as (
          update public.profiles p
             set points = p.points + x.pts, earned = p.earned + x.pts
            from (select user_id, sum(points)::int as pts from ins group by user_id) x
           where p.id = x.user_id
          returning 1
        )
        select count(*) into v_n from ins;
        insert into public.season_settled (season) values (v_season) on conflict do nothing;
        v_total := v_total + v_n;
      end if;
    end if;
    v_m := (v_m + interval '1 month')::date;
  end loop;
  return v_total;
end; $$;

grant execute on function public.season_settle() to authenticated;

select 'season_skip_v79' as check_name, 'rpg,p512,battle,blocks,2048,p1024' as skip;
