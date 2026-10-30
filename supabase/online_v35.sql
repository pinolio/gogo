-- =====================================================================
-- v35 (2026-10-30): 관리자 '실시간 접속자' — 1분마다 기록하는 방식
--   · 사이트를 연 창(손님 포함)이 1분마다 online_ping() 을 불러 "아직 여기 있어요(지금 보는 게임)"를 한 줄 고쳐 씀
--   · 관리자 화면은 admin_online() 으로 최근 2분 안에 기록한 창만 셈
--   · 실시간 연결(Realtime)을 쓰지 않으므로 무료 요금제의 동시 연결 200개·초당 메시지 제한과 상관없음
--   · 표는 직접 읽거나 쓸 수 없고(RLS, 정책 없음) 아래 함수로만 다룸. 10분 넘게 소식이 없는 줄은 자동으로 지움
--   · 여러 번 실행해도 괜찮음. 기존 자료를 지우지 않음
-- =====================================================================
create table if not exists public.site_online (
  client_id   text primary key check (client_id ~ '^[a-z0-9]{6,24}$'),   -- 창 번호 (브라우저 탭마다, 새로고침해도 유지)
  user_id     uuid references public.profiles(id) on delete cascade,   -- 회원이면 회원 id, 손님이면 null (서버가 auth.uid() 로 넣음)
  game        text not null default '' check (game = '' or game ~ '^[a-z0-9_-]{2,30}$'),
  mobile      boolean not null default false,
  started_at  timestamptz not null default now(),                       -- 사이트에 들어온 시각 (서버 시계)
  game_at     timestamptz not null default now(),                       -- 지금 게임 화면에 들어온 시각 (서버 시계)
  last_seen   timestamptz not null default now()
);
create index if not exists site_online_seen on public.site_online (last_seen desc);
alter table public.site_online enable row level security;   -- 정책 없음 = 직접 읽기·쓰기 불가 (아래 함수로만)
revoke all on public.site_online from anon, authenticated;

-- 창이 1분마다 부름 (게임을 바꿨을 때는 바로)
create or replace function public.online_ping(p_client text, p_game text, p_mobile boolean)
returns void language plpgsql security definer set search_path = public as $$
declare g text := coalesce(p_game, '');
begin
  if p_client is null or p_client !~ '^[a-z0-9]{6,24}$' then return; end if;
  if g <> '' and g !~ '^[a-z0-9_-]{2,30}$' then g := ''; end if;
  insert into public.site_online as o (client_id, user_id, game, mobile, started_at, game_at, last_seen)
  values (p_client, auth.uid(), g, coalesce(p_mobile, false), now(), now(), now())
  on conflict (client_id) do update
     set user_id   = auth.uid(),
         mobile    = coalesce(p_mobile, false),
         game_at   = case when o.game is distinct from excluded.game then now() else o.game_at end,
         game      = excluded.game,
         -- 10분 넘게 소식이 없다가 다시 오면 새로 들어온 것으로 셈
         started_at = case when o.last_seen < now() - interval '10 minutes' then now() else o.started_at end,
         last_seen = now()
   where o.last_seen < now() - interval '5 seconds' or o.game is distinct from excluded.game;   -- 너무 잦은 호출은 무시
  -- 오래된 줄 정리 (가끔만)
  if random() < 0.05 then delete from public.site_online where last_seen < now() - interval '10 minutes'; end if;
end; $$;

-- 창을 닫을 때 (실패해도 2분 뒤에는 목록에서 빠짐)
create or replace function public.online_leave(p_client text)
returns void language sql security definer set search_path = public as $$
  delete from public.site_online where client_id = p_client;
$$;

-- 관리자: 최근 2분 안에 소식이 있는 창 목록 + 서버 지금 시각
create or replace function public.admin_online()
returns table (client_id text, user_id uuid, nickname text, game text, mobile boolean, started_at timestamptz, game_at timestamptz, last_seen timestamptz, server_now timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요'; end if;
  return query
    select o.client_id, o.user_id, coalesce(p.nickname, '손님'), o.game, o.mobile, o.started_at, o.game_at, o.last_seen, now()
      from public.site_online o left join public.profiles p on p.id = o.user_id
     where o.last_seen > now() - interval '2 minutes'
     order by o.started_at;
end; $$;

revoke all on function public.online_ping(text, text, boolean) from public;
revoke all on function public.online_leave(text) from public;
revoke all on function public.admin_online() from public;
grant execute on function public.online_ping(text, text, boolean) to anon, authenticated;
grant execute on function public.online_leave(text) to anon, authenticated;
grant execute on function public.admin_online() to authenticated;

-- 확인
select count(*) as online_rows from public.site_online;
