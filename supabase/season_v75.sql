-- gogo?gogo! v75 — 시즌 1위 보상 (선생님 요청 2026-11-05)
--  · 시즌 = 매월 1일 0시(한국 시간)에 새로 시작. 첫 시즌 = 2026년 11월
--  · 지난 시즌이 끝나면 게임마다 1위 한 명에게 +50P (보유 포인트·누적 포인트 모두)
--  · 1위 = 그 달 최고 점수 (같으면 먼저 낸 사람). Skillcom Fight 는 그 달 승리 수 (같으면 먼저 그 수에 닿은 사람)
--  · 빼는 게임: RPG(rpg) · Ultimate(ultimate) — 선생님이 따로 정함. 블록 대전은 랭킹 대전 기록(battle-rank)으로 봄
--    (battle · blocks · 2048 · p1024 는 랭킹에 안 쓰는 옛 기록이라 뺌)
--  · 정지된 계정·관리자 계정은 1위에서 뺌
--  · 정산은 누구든 로그인하면 season_settle() 이 자동으로 함 (이미 한 시즌은 건너뜀, 두 번 주지 않음)
--  · 쪽지: 1위가 들어오면 '어느 게임에서 시즌 1등 → +50P' 창이 뜨고, [확인]을 누르면 읽음(notified)
-- 여러 번 실행해도 안전합니다.

create table if not exists public.season_awards (
  id          bigserial primary key,
  season      text not null check (season ~ '^[0-9]{4}-[0-9]{2}$'),
  game_id     text not null,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  score       integer not null,
  points      integer not null default 50,
  notified    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (season, game_id)
);
create index if not exists season_awards_user on public.season_awards (user_id, notified);

create table if not exists public.season_settled (
  season      text primary key,
  settled_at  timestamptz not null default now()
);

alter table public.season_awards  enable row level security;
alter table public.season_settled enable row level security;

drop policy if exists "season_awards_select" on public.season_awards;
create policy "season_awards_select" on public.season_awards for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "season_settled_select" on public.season_settled;
create policy "season_settled_select" on public.season_settled for select using (true);
-- 쓰기·고치기는 아래 함수로만 (학생이 직접 넣거나 바꿀 수 없음)

-- 지난 시즌 정산 (끝난 달만). 돌려주는 값 = 이번에 새로 준 상 개수
create or replace function public.season_settle() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_first date := date '2026-11-01';
  v_now   date := date_trunc('month', now() at time zone 'Asia/Seoul')::date;   -- 지금 시즌 첫날
  v_m     date;
  v_season text;
  v_start timestamptz; v_end timestamptz;
  v_skip  text[] := array['rpg', 'ultimate', 'battle', 'blocks', '2048', 'p1024'];
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

-- 쪽지 읽음 표시 (자기 것만)
create or replace function public.season_ack(p_ids bigint[]) returns void
language sql security definer set search_path = public as $$
  update public.season_awards set notified = true where user_id = auth.uid() and id = any(p_ids);
$$;

grant select on public.season_awards, public.season_settled to authenticated;
grant execute on function public.season_settle() to authenticated;
grant execute on function public.season_ack(bigint[]) to authenticated;

select 'season_awards_rows' as check_name, count(*) from public.season_awards;
