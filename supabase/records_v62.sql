-- =====================================================================
-- v62 기보 저장 (머신러닝 1단계) — 바둑·오목·장기·체스·알까기 '컴퓨터와 둔 판'
--   Supabase → SQL Editor 에 붙여 넣고 Run (선생님). 여러 번 Run 해도 괜찮음
--   - 로그인한 학생이 컴퓨터와 한 판을 끝내면 한 줄 저장 (손님·둘이서·온라인은 저장 안 함)
--   - 학생 이름은 없음 (user_id 만). 학생은 자기 기보만, 관리자는 모두 볼 수 있음
--   - 한 판 = 약 1~6KB. 1만 판 ≈ 30MB (무료 한도 500MB)
--   - 나중에 PC 에서 내려받아 학습: 관리자 로그인 → 표 game_records → Export CSV,
--     또는 SQL: select * from public.game_records where game_id = 'omok' order by id;
-- =====================================================================
create table if not exists public.game_records (
  id            bigint generated always as identity primary key,
  game_id       text not null check (game_id in ('baduk', 'omok', 'janggi', 'chess', 'alkkagi')),
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  level         smallint not null check (level between 1 and 11),     -- 컴퓨터 단계 (11 = AI 대전)
  human_side    smallint not null check (human_side in (0, 1)),       -- 사람: 0 = 먼저 두는 쪽(흑·초·백) / 1 = 나중
  result        text not null check (result in ('win', 'lose', 'draw')),   -- 사람 기준
  n_moves       smallint not null check (n_moves between 0 and 1000),
  moves         jsonb not null check (jsonb_typeof(moves) = 'array' and jsonb_array_length(moves) <= 1000),
  extra         jsonb,                                                 -- 바둑 계가 등
  duration_sec  integer not null default 0 check (duration_sec between 0 and 86400),
  ver           text,                                                  -- 사이트 버전 (예: v62)
  created_at    timestamptz not null default now(),
  check (pg_column_size(moves) < 60000)
);
create index if not exists game_records_game_time on public.game_records (game_id, created_at desc);
create index if not exists game_records_user on public.game_records (user_id, created_at desc);
alter table public.game_records enable row level security;

drop policy if exists "records_insert_own" on public.game_records;
create policy "records_insert_own" on public.game_records for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned());
drop policy if exists "records_select" on public.game_records;
create policy "records_select" on public.game_records for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "records_delete_admin" on public.game_records;
create policy "records_delete_admin" on public.game_records for delete to authenticated
  using (public.is_admin());
revoke update on public.game_records from anon, authenticated;
grant select, insert, delete on public.game_records to authenticated;

-- 확인용: 아래 줄이 'game_records_rows 0' 처럼 나오면 성공
select 'game_records_rows ' || count(*) from public.game_records;
