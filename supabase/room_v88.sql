-- gogo?gogo! v88 '내 방' (싸이월드 미니룸) · 친구 방 구경 · 방명록 · 오늘 방문 수
-- Supabase 대시보드 → SQL Editor → 이 파일 내용을 붙여 넣고 Run (여러 번 실행해도 괜찮음)

-- 1) 상점: 가구 · 벽 장식 · 러그 · 벽지 · 바닥 · 옷장도 팔 수 있게 (slot 늘림) + 가구 목록 (이미 있는 가격은 덮어쓰지 않음)
alter table public.shop_items drop constraint if exists shop_items_slot_check;
alter table public.shop_items add constraint shop_items_slot_check
  check (slot in ('skin', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'bg', 'furn', 'rug', 'wall', 'wallpaper', 'floor', 'wardrobe'));
insert into public.shop_items (id, slot, name, price) values
  ('f_bed1', 'furn', '나무 침대', 0),
  ('f_bed2', 'furn', '포근한 2인 침대', 45),
  ('f_bunk', 'furn', '이층 침대', 55),
  ('f_desk', 'furn', '공부 책상', 0),
  ('f_pcdesk', 'furn', '컴퓨터 책상', 40),
  ('f_lowtable', 'furn', '좌식 탁자', 10),
  ('f_round', 'furn', '동그란 테이블', 15),
  ('f_chair', 'furn', '나무 의자', 0),
  ('f_sofa', 'furn', '폭신 소파', 30),
  ('f_beanbag', 'furn', '빈백', 20),
  ('f_rocking', 'furn', '흔들의자', 25),
  ('f_shelf', 'furn', '책장', 20),
  ('f_drawer', 'furn', '서랍장', 15),
  ('f_rack', 'furn', '수납 선반', 12),
  ('f_chest', 'furn', '보물 상자', 35),
  ('f_lamp', 'furn', '책상 스탠드', 12),
  ('f_floorlamp', 'furn', '플로어 램프', 18),
  ('f_starlamp', 'furn', '별빛 무드등', 30),
  ('f_pot', 'furn', '작은 화분', 0),
  ('f_tree', 'furn', '큰 나무 화분', 15),
  ('f_cactus', 'furn', '선인장', 8),
  ('f_vase', 'furn', '꽃병', 10),
  ('f_tv', 'furn', '텔레비전', 40),
  ('f_console', 'furn', '게임기', 50),
  ('f_speaker', 'furn', '스피커', 25),
  ('f_fridge', 'furn', '작은 냉장고', 35),
  ('f_piano', 'furn', '업라이트 피아노', 60),
  ('f_fishtank', 'furn', '어항', 45),
  ('r_round', 'rug', '동그란 러그', 10),
  ('r_stripe', 'rug', '줄무늬 러그', 12),
  ('r_heart', 'rug', '하트 러그', 20),
  ('f_bear', 'furn', '곰 인형', 15),
  ('f_trophy', 'furn', '트로피 장식장', 30),
  ('f_doghouse', 'furn', '강아지 집', 40),
  ('f_basket', 'furn', '농구 골대', 35),
  ('w_window', 'wall', '창문', 0),
  ('w_bigwin', 'wall', '큰 창문', 30),
  ('w_frame', 'wall', '그림 액자', 10),
  ('w_clock', 'wall', '벽시계', 12),
  ('w_poster', 'wall', '게임 포스터', 8),
  ('w_shelf', 'wall', '벽 선반', 12),
  ('w_mirror', 'wall', '거울', 18),
  ('w_board', 'wall', '화이트보드', 15),
  ('wp_basic', 'wallpaper', '하얀 벽', 0),
  ('wp_sky', 'wallpaper', '하늘색 벽', 10),
  ('wp_pink', 'wallpaper', '분홍 벽', 10),
  ('wp_mint', 'wallpaper', '민트 벽', 10),
  ('wp_stripe', 'wallpaper', '줄무늬 벽지', 15),
  ('wp_check', 'wallpaper', '체크 벽지', 15),
  ('wp_star', 'wallpaper', '별 벽지', 20),
  ('wp_wood', 'wallpaper', '나무 판자 벽', 20),
  ('wp_hanok', 'wallpaper', '한옥 창호 벽', 30),
  ('wp_space', 'wallpaper', '우주 벽지', 40),
  ('fl_wood', 'floor', '나무 바닥', 0),
  ('fl_light', 'floor', '밝은 나무', 10),
  ('fl_carpet', 'floor', '파란 카펫', 10),
  ('fl_check', 'floor', '체크 타일', 15),
  ('fl_marble', 'floor', '대리석', 25),
  ('fl_grass', 'floor', '잔디', 20),
  ('fl_tatami', 'floor', '다다미', 20),
  ('fl_cloud', 'floor', '구름 바닥', 30),
  ('fl_star', 'floor', '별빛 바닥', 40),
  ('fl_maru', 'floor', '한옥 마루', 30),
  ('wd_basic', 'wardrobe', '나무 옷장', 0),
  ('wd_white', 'wardrobe', '하얀 옷장', 30),
  ('wd_pink', 'wardrobe', '공주 옷장', 50),
  ('wd_space', 'wardrobe', '우주 옷장', 80)
on conflict (id) do nothing;

-- 2) 내 방 배치 (profiles.room) — 저장은 save_room 함수로만 (가진 가구인지 확인)
alter table public.profiles add column if not exists room jsonb not null default '{}'::jsonb;

create or replace function public.save_room(p_room jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_owned text[]; v_id text; x jsonb;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if public.is_banned() then raise exception '이용이 정지된 계정이에요'; end if;
  if pg_column_size(p_room) > 8000 then raise exception '방 정보가 너무 커요'; end if;
  if jsonb_array_length(coalesce(p_room->'items', '[]'::jsonb)) > 40 or jsonb_array_length(coalesce(p_room->'walls', '[]'::jsonb)) > 12 then
    raise exception '가구가 너무 많아요';
  end if;
  select owned into v_owned from public.profiles where id = auth.uid();
  for v_id in
    select p_room->>'wp' union all select p_room->>'fl' union all select p_room->>'wd'
    union all select e->>0 from jsonb_array_elements(coalesce(p_room->'items', '[]'::jsonb)) e
    union all select e->>0 from jsonb_array_elements(coalesce(p_room->'walls', '[]'::jsonb)) e
  loop
    continue when v_id is null;
    if not exists (select 1 from public.shop_items s where s.id = v_id and s.slot in ('furn', 'rug', 'wall', 'wallpaper', 'floor', 'wardrobe')
                   and (s.price = 0 or v_id = any(v_owned))) then
      raise exception '아직 사지 않은 가구가 있어요: %', v_id;
    end if;
  end loop;
  update public.profiles set room = p_room where id = auth.uid();
end; $$;
revoke execute on function public.save_room(jsonb) from public, anon;
grant  execute on function public.save_room(jsonb) to authenticated;

-- 3) 방문 수 (오늘 · 전체). 로그인한 다른 사람이 하루 한 번 들어오면 1. 누가 왔는지는 아무도 못 봄 (숫자만)
create table if not exists public.room_visits (
  owner    uuid not null references public.profiles(id) on delete cascade,
  visitor  uuid not null references public.profiles(id) on delete cascade,
  day      date not null,
  primary key (owner, visitor, day)
);
alter table public.room_visits enable row level security;   -- 정책 없음 = 표를 직접 읽거나 쓸 수 없음 (아래 함수로만)

create or replace function public.room_visit(p_owner uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.uid() is not null and auth.uid() <> p_owner and not public.is_banned() then
    insert into public.room_visits (owner, visitor, day) values (p_owner, auth.uid(), v_day) on conflict do nothing;
  end if;
  return json_build_object('today', (select count(*) from public.room_visits where owner = p_owner and day = v_day),
                           'total', (select count(*) from public.room_visits where owner = p_owner));
end; $$;
revoke execute on function public.room_visit(uuid) from public;
grant  execute on function public.room_visit(uuid) to anon, authenticated;

-- 4) 방명록 (방 주인 · 글쓴이 · 관리자가 지움, 관리자가 숨김). 120자 · 10초에 한 번
create table if not exists public.guestbook (
  id          bigint generated always as identity primary key,
  owner       uuid not null constraint guestbook_owner_fkey references public.profiles(id) on delete cascade,
  user_id     uuid not null default auth.uid() constraint guestbook_user_id_fkey references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 120),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists guestbook_owner_time on public.guestbook (owner, created_at desc);
alter table public.guestbook enable row level security;

drop policy if exists "guest_select" on public.guestbook;
create policy "guest_select" on public.guestbook for select
  using (not hidden or user_id = auth.uid() or owner = auth.uid() or public.is_admin());
drop policy if exists "guest_insert" on public.guestbook;
create policy "guest_insert" on public.guestbook for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned());
drop policy if exists "guest_delete" on public.guestbook;
create policy "guest_delete" on public.guestbook for delete to authenticated
  using (user_id = auth.uid() or owner = auth.uid() or public.is_admin());
drop policy if exists "guest_admin_update" on public.guestbook;
create policy "guest_admin_update" on public.guestbook for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke update on public.guestbook from anon, authenticated;
grant  update (hidden) on public.guestbook to authenticated;

create or replace function public.guestbook_gap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.guestbook where user_id = new.user_id and created_at > now() - interval '10 seconds') then
    raise exception '방명록은 10초에 한 번 쓸 수 있어요';
  end if;
  return new;
end; $$;
drop trigger if exists before_guestbook on public.guestbook;
create trigger before_guestbook before insert on public.guestbook for each row execute function public.guestbook_gap();

-- 확인: 아래 세 줄이 나오면 성공
select 'furniture items' as what, count(*) from public.shop_items where slot in ('furn', 'rug', 'wall', 'wallpaper', 'floor', 'wardrobe')
union all select 'room column', count(*) from information_schema.columns where table_name = 'profiles' and column_name = 'room'
union all select 'guestbook table', count(*) from information_schema.tables where table_name = 'guestbook';
