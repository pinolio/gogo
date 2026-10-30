-- =====================================================================
-- v33 (2026-10-29): 로그인 팝업 배너 (한 개)
--   관리자 설정 → '배너' 탭에서 켜기/끄기 · 제목 · 내용 · 링크 · 그림을 저장하는 표.
--   누구나 읽을 수 있고(로그인하면 팝업으로 보임), 관리자만 저장할 수 있음.
--   여러 번 실행해도 괜찮음. 지우는 내용 없음.
-- =====================================================================
create table if not exists public.site_banner (
  id          int primary key default 1 check (id = 1),                   -- 배너는 한 개 (id = 1 한 줄)
  enabled     boolean not null default false,
  title       text not null default '' check (char_length(title) <= 40),
  body        text not null default '' check (char_length(body) <= 200),
  image       text check (image is null or (image ~ '^data:image/(png|jpeg|webp|gif);base64,' and char_length(image) <= 400000)),
  link        text check (link is null or link = '' or (link ~* '^https?://' and char_length(link) <= 500)),
  updated_at  timestamptz not null default now()
);
alter table public.site_banner enable row level security;

drop policy if exists "banner_select_all" on public.site_banner;
create policy "banner_select_all" on public.site_banner for select using (true);
drop policy if exists "banner_admin_insert" on public.site_banner;
create policy "banner_admin_insert" on public.site_banner for insert to authenticated with check (public.is_admin());
drop policy if exists "banner_admin_update" on public.site_banner;
create policy "banner_admin_update" on public.site_banner for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.site_banner to anon, authenticated;
grant insert, update on public.site_banner to authenticated;

-- 확인
select count(*) as banner_rows from public.site_banner;
