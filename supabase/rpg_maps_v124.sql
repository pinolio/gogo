-- gogo?gogo! v124 Skillcom RPG '맵 만들기' (관리자 전용) 저장 표
-- data = { w, h, region, t:[칸 번호…], ponds:[{k,x,y}], exits:{u,d,l,r} , note }
-- 누구나 읽기(게임이 불러옴) · 쓰기·지우기는 관리자만 (public.is_admin())
create table if not exists public.rpg_maps (
  id text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  name text not null default '',
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.rpg_maps enable row level security;
drop policy if exists "rpg_maps_read" on public.rpg_maps;
create policy "rpg_maps_read" on public.rpg_maps for select using (true);
drop policy if exists "rpg_maps_admin_ins" on public.rpg_maps;
create policy "rpg_maps_admin_ins" on public.rpg_maps for insert with check (public.is_admin());
drop policy if exists "rpg_maps_admin_upd" on public.rpg_maps;
create policy "rpg_maps_admin_upd" on public.rpg_maps for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "rpg_maps_admin_del" on public.rpg_maps;
create policy "rpg_maps_admin_del" on public.rpg_maps for delete using (public.is_admin());
grant select on public.rpg_maps to anon, authenticated;
grant insert, update, delete on public.rpg_maps to authenticated;

select count(*) as rpg_maps from public.rpg_maps;
