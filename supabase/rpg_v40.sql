-- =====================================================================
-- v40 (2026-10-30): 게임 진행 저장 표 (마법 융합 모험 RPG 처음 사용)
--   RPG처럼 '이어서 하는' 게임의 진행(레벨·가방·장비·마법·위치)을 계정마다 저장.
--   한 사람 × 한 게임 = 한 줄 (user_id + game_id). 본인 것만 읽고 쓸 수 있음.
--   표가 없을 때도 게임은 돌아가고, 이 기기(localStorage)에만 저장됨.
--   여러 번 실행해도 괜찮음. 지우는 내용 없음.
-- =====================================================================
create table if not exists public.game_saves (
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  game_id     text not null check (game_id ~ '^[a-z0-9_-]{2,30}$'),
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 60000),   -- 한 줄 60KB 까지
  updated_at  timestamptz not null default now(),
  primary key (user_id, game_id)
);
alter table public.game_saves enable row level security;

drop policy if exists "saves_select_own" on public.game_saves;
create policy "saves_select_own" on public.game_saves for select to authenticated using (user_id = auth.uid());
drop policy if exists "saves_insert_own" on public.game_saves;
create policy "saves_insert_own" on public.game_saves for insert to authenticated
  with check (user_id = auth.uid() and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.banned));
drop policy if exists "saves_update_own" on public.game_saves;
create policy "saves_update_own" on public.game_saves for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 관리자는 모두 볼 수 있음 (나중에 관리자 화면에서 확인용)
drop policy if exists "saves_admin_select" on public.game_saves;
create policy "saves_admin_select" on public.game_saves for select to authenticated using (public.is_admin());

grant select, insert, update on public.game_saves to authenticated;

-- 확인
select count(*) as game_saves_rows from public.game_saves;
