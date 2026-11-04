-- =====================================================================
-- v68 무단 이탈 기록 (관리자만 봄)
--   Supabase → SQL Editor 에 붙여 넣고 Run (선생님). 여러 번 Run 해도 괜찮음
--   - 온라인 대결에서 시작 5초 안에 상대가 나가거나 기권하면 그 판은 '무효'(승패·무승부·포인트 없음)
--   - 남은 사람의 화면이 '누가 · 어느 게임에서 · 몇 초 만에 · 나감/기권' 한 줄을 여기에 남김
--     (남은 사람이 손님이면, 나간 사람이 기권한 경우에만 본인 화면이 남김)
--   - 학생(플레이어)은 읽을 수 없음. 관리자만 보기·지우기 (관리자 설정 → '무단 이탈' 탭)
--   - 나중에 플레이어에게 보여 주고 싶으면 select 정책을 바꾸면 됨 (지금은 관리자만)
-- =====================================================================
create table if not exists public.quit_logs (
  id            bigint generated always as identity primary key,
  game_id       text not null check (game_id ~ '^[a-z0-9_-]{2,30}$'),
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,   -- 기록을 남긴 사람 (보통 남은 쪽)
  quitter       uuid references public.profiles(id) on delete set null,                              -- 나간 사람 (손님이면 비어 있음)
  quitter_nick  text check (char_length(quitter_nick) <= 30),
  kind          text not null check (kind in ('left', 'resign')),                                    -- left = 창을 닫거나 방에서 나감 · resign = 기권
  sec           numeric(5, 1) not null default 0 check (sec between 0 and 60),                       -- 시작하고 몇 초 만에
  extra         jsonb check (extra is null or pg_column_size(extra) < 2000),                          -- 방 코드·인원 등
  created_at    timestamptz not null default now()
);
create index if not exists quit_logs_time on public.quit_logs (created_at desc);
create index if not exists quit_logs_quitter on public.quit_logs (quitter, created_at desc);
alter table public.quit_logs enable row level security;

drop policy if exists "quit_insert" on public.quit_logs;
create policy "quit_insert" on public.quit_logs for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned());
drop policy if exists "quit_select_admin" on public.quit_logs;
create policy "quit_select_admin" on public.quit_logs for select to authenticated
  using (public.is_admin());
drop policy if exists "quit_delete_admin" on public.quit_logs;
create policy "quit_delete_admin" on public.quit_logs for delete to authenticated
  using (public.is_admin());
revoke all on public.quit_logs from anon;
revoke update on public.quit_logs from authenticated;
grant select, insert, delete on public.quit_logs to authenticated;

-- 확인용: 아래 줄이 'quit_logs_rows 0' 처럼 나오면 성공
select 'quit_logs_rows ' || count(*) from public.quit_logs;
