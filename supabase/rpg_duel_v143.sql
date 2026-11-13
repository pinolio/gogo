-- gogo?gogo! v143 Skillcom RPG 결투 기록 표 (선생님 11/13 "승패 기록해줘. 승패는 아직 표시하지말고 기록만")
-- 결투가 끝나면 '이긴 사람'의 게임이 한 줄을 남김 (진 사람이 도중에 나가도 이긴 사람이 기록)
-- reason: ko = 체력 0으로 쓰러뜨림 · left = 상대가 결투 중에 나감
-- Supabase 대시보드 → SQL Editor → Run. 두 번 실행해도 괜찮음
create table if not exists public.rpg_duels (
  id bigint generated always as identity primary key,
  duel_id text not null unique check (char_length(duel_id) between 4 and 40),
  created_at timestamptz not null default now(),
  winner uuid not null references public.profiles(id) on delete cascade,
  loser uuid references public.profiles(id) on delete set null,
  winner_nick text not null default '',
  loser_nick text not null default '',
  winner_lv int not null default 1,
  loser_lv int not null default 1,
  bet int not null default 0 check (bet >= 0),
  reason text not null default 'ko' check (reason in ('ko', 'left'))
);
create index if not exists rpg_duels_winner on public.rpg_duels (winner);
create index if not exists rpg_duels_loser on public.rpg_duels (loser);
alter table public.rpg_duels enable row level security;
drop policy if exists "rpg_duels_read" on public.rpg_duels;
create policy "rpg_duels_read" on public.rpg_duels for select using (true);
drop policy if exists "rpg_duels_ins_winner" on public.rpg_duels;
create policy "rpg_duels_ins_winner" on public.rpg_duels for insert with check (winner = auth.uid() and loser is distinct from auth.uid());
drop policy if exists "rpg_duels_admin_del" on public.rpg_duels;
create policy "rpg_duels_admin_del" on public.rpg_duels for delete using (public.is_admin());
grant select on public.rpg_duels to anon, authenticated;
grant insert, delete on public.rpg_duels to authenticated;

select count(*) as rpg_duels from public.rpg_duels;
