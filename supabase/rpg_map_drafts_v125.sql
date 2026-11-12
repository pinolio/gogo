-- gogo?gogo! v125 '메이커' — 플레이어가 그린 Skillcom RPG 지도 (저장·수정·제출 → 관리자 검토·반영)
-- status: draft 작성 중 · submitted 제출함 · returned 돌려받음(관리자 메모) · accepted 반영됨(공식 맵 rpg_maps.id = official_id)
-- 플레이어: 자기 지도만 보고, 작성 중/돌려받은 지도만 고치고 지움 · 한 사람 20개까지
-- 관리자(public.is_admin()): 모두 보고 상태·메모를 바꿈
create table if not exists public.rpg_map_drafts (
  id bigserial primary key,
  owner uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 30),
  data jsonb not null check (pg_column_size(data) < 80000),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'returned', 'accepted')),
  admin_note text not null default '' check (char_length(admin_note) <= 200),
  official_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index if not exists rpg_map_drafts_owner on public.rpg_map_drafts (owner);
create index if not exists rpg_map_drafts_status on public.rpg_map_drafts (status, submitted_at desc);
alter table public.rpg_map_drafts enable row level security;

drop policy if exists "rmd_select" on public.rpg_map_drafts;
create policy "rmd_select" on public.rpg_map_drafts for select using (owner = auth.uid() or public.is_admin());
drop policy if exists "rmd_insert" on public.rpg_map_drafts;
create policy "rmd_insert" on public.rpg_map_drafts for insert with check (owner = auth.uid() and status = 'draft');
drop policy if exists "rmd_update_own" on public.rpg_map_drafts;
create policy "rmd_update_own" on public.rpg_map_drafts for update
  using (owner = auth.uid() and status in ('draft', 'returned'))
  with check (owner = auth.uid() and status in ('draft', 'returned', 'submitted'));
drop policy if exists "rmd_update_admin" on public.rpg_map_drafts;
create policy "rmd_update_admin" on public.rpg_map_drafts for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "rmd_delete" on public.rpg_map_drafts;
create policy "rmd_delete" on public.rpg_map_drafts for delete using ((owner = auth.uid() and status in ('draft', 'returned')) or public.is_admin());
grant select, insert, update, delete on public.rpg_map_drafts to authenticated;
grant usage, select on sequence public.rpg_map_drafts_id_seq to authenticated;

-- 플레이어가 바꿀 수 없는 칸 지키기 + 고친 시각 · 제출 시각 · 20개 제한
create or replace function public.rmd_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.rpg_map_drafts where owner = new.owner) >= 20 then
      raise exception '지도는 한 사람에 20개까지 저장할 수 있어요. 안 쓰는 지도를 지워 주세요.';
    end if;
    new.admin_note := ''; new.official_id := null; new.status := 'draft'; new.submitted_at := null;
  else
    if not public.is_admin() then
      new.owner := old.owner; new.admin_note := old.admin_note; new.official_id := old.official_id; new.created_at := old.created_at;
      if new.status = 'submitted' and old.status <> 'submitted' then new.submitted_at := now(); else new.submitted_at := old.submitted_at; end if;
      if new.status not in ('draft', 'submitted') then new.status := 'draft'; end if;   -- 돌려받은 지도를 고치면 다시 '작성 중'
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists rmd_guard on public.rpg_map_drafts;
create trigger rmd_guard before insert or update on public.rpg_map_drafts for each row execute function public.rmd_guard();

select count(*) as rpg_map_drafts from public.rpg_map_drafts;
