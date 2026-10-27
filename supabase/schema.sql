-- =====================================================================
-- gogo?gogo! DB 스키마  (여러 번 실행해도 안전합니다)
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 전체를 붙여 넣고 Run
--  · 처음 설치할 때도, 업데이트할 때도 이 파일 하나만 다시 실행하면 됩니다.
--  · 기존 회원·전적·포인트는 지워지지 않습니다.
-- =====================================================================

-- 1) 회원 프로필 (로그인 계정 1개당 1행)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9_]{4,16}$'),
  nickname    text not null check (char_length(nickname) between 2 and 10),
  points      integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.profiles add column if not exists earned integer not null default 0;          -- 지금까지 얻은 포인트 (레벨·랭킹용, 써도 줄지 않음)
alter table public.profiles add column if not exists avatar jsonb   not null default '{}'::jsonb; -- 착용 중인 아바타
alter table public.profiles add column if not exists owned  text[]  not null default '{}';        -- 구입한 아이템 목록

-- 2) 모든 판의 전적 (게임이 끝날 때마다 1행)
create table if not exists public.play_records (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  game_id       text not null,
  score         integer not null check (score between 0 and 10000000),
  duration_sec  integer not null check (duration_sec between 0 and 86400),
  extra         jsonb not null default '{}'::jsonb,   -- 지운 줄 수, 최대 타일 등 게임별 추가 정보
  played_at     timestamptz not null default now()
);
alter table public.play_records add column if not exists result text;                       -- 'win' | 'lose'
alter table public.play_records add column if not exists points_delta integer not null default 0; -- 이번 판 포인트 변화
-- 게임 id 규칙: 영문 소문자·숫자·-·_ (새 게임을 추가해도 이 파일을 고칠 필요 없음)
alter table public.play_records drop constraint if exists play_records_game_id_check;
alter table public.play_records add constraint play_records_game_id_check check (game_id ~ '^[a-z0-9_-]{2,30}$');
alter table public.play_records drop constraint if exists play_records_result_check;
alter table public.play_records add constraint play_records_result_check check (result is null or result in ('win', 'lose'));
create index if not exists play_records_game_score on public.play_records (game_id, score desc);
create index if not exists play_records_user_time  on public.play_records (user_id, played_at desc);

-- 3) 상점 아이템 (가격은 대시보드 Table Editor > shop_items 에서 바로 고칠 수 있습니다)
--    ※ 밸런스 조정 예정. 아래 값은 처음 한 번만 들어가고, 이미 있는 가격은 덮어쓰지 않습니다.
create table if not exists public.shop_items (
  id     text primary key,
  slot   text not null check (slot in ('skin', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'back')),
  name   text not null,
  price  integer not null default 0 check (price >= 0)
);
insert into public.shop_items (id, slot, name, price) values
  ('s1', 'skin', '밝은 피부', 0),
  ('s2', 'skin', '살구 피부', 0),
  ('s3', 'skin', '구릿빛 피부', 0),
  ('s4', 'skin', '갈색 피부', 0),
  ('s_alien', 'skin', '외계인', 20),
  ('s_robot', 'skin', '로봇', 24),
  ('h_short', 'hair', '짧은 머리 (검정)', 0),
  ('h_short_brown', 'hair', '짧은 머리 (갈색)', 0),
  ('h_long', 'hair', '긴 생머리', 6),
  ('h_bob', 'hair', '단발머리', 6),
  ('h_spiky', 'hair', '뾰족 머리', 8),
  ('h_twin', 'hair', '양갈래 머리', 10),
  ('h_mohawk', 'hair', '닭벼슬 머리', 12),
  ('hat_cap', 'hat', '야구 모자', 4),
  ('hat_beanie', 'hat', '비니', 5),
  ('hat_bunny', 'hat', '토끼 귀', 12),
  ('hat_wizard', 'hat', '마법사 모자', 18),
  ('hat_crown', 'hat', '왕관', 30),
  ('f_glasses', 'face', '동그란 안경', 4),
  ('f_sunglass', 'face', '선글라스', 8),
  ('f_mask', 'face', '마스크', 5),
  ('f_mustache', 'face', '콧수염', 3),
  ('t_basic', 'top', '기본 티셔츠', 0),
  ('t_stripe', 'top', '줄무늬 티', 4),
  ('t_school', 'top', '교복 재킷', 6),
  ('t_hoodie', 'top', '후드티', 8),
  ('t_jersey', 'top', '축구 유니폼', 10),
  ('t_suit', 'top', '정장', 15),
  ('t_armor', 'top', '기사 갑옷', 25),
  ('b_jeans', 'bottom', '청바지', 0),
  ('b_shorts', 'bottom', '반바지', 3),
  ('b_skirt', 'bottom', '주름 치마', 5),
  ('b_cargo', 'bottom', '카고 바지', 6),
  ('b_armor', 'bottom', '갑옷 하의', 15),
  ('sh_basic', 'shoes', '기본 운동화', 0),
  ('sh_red', 'shoes', '빨간 운동화', 3),
  ('sh_boots', 'shoes', '노란 장화', 5),
  ('sh_gold', 'shoes', '황금 신발', 20),
  ('bk_bag', 'back', '책가방', 6),
  ('bk_cape', 'back', '영웅 망토', 15),
  ('bk_wings', 'back', '천사 날개', 30)
on conflict (id) do nothing;

-- 4) 보안 규칙 (RLS)
alter table public.profiles     enable row level security;
alter table public.play_records enable row level security;
alter table public.shop_items   enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
-- 포인트·아바타·아이템은 직접 고칠 수 없고(아래 함수로만 변경), 닉네임만 수정 가능
revoke update on public.profiles from anon, authenticated;
grant  update (nickname) on public.profiles to authenticated;

drop policy if exists "records_select_all" on public.play_records;
create policy "records_select_all" on public.play_records for select using (true);

drop policy if exists "records_insert_own" on public.play_records;
create policy "records_insert_own" on public.play_records for insert to authenticated
  with check (auth.uid() = user_id);

-- 전적 초기화: 본인 기록만 지울 수 있음 (수정 정책은 없으므로 점수를 고칠 수는 없음)
drop policy if exists "records_delete_own" on public.play_records;
create policy "records_delete_own" on public.play_records for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "shop_select_all" on public.shop_items;
create policy "shop_select_all" on public.shop_items for select using (true);

-- 5) 가입하면 프로필 자동 생성 (기본 아바타는 빈 값 → 화면에서 기본 모습으로 표시)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, nickname)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'nickname', new.raw_user_meta_data->>'username')
  );
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6) 기록 검증(기본 부정행위 차단) + 포인트 반영
--    포인트 = 각 게임 폴더 settings.js 의 값 (승리 +2, 패배 -1 등)
--    · 한 판에 ±10P 까지만 인정 (값을 바꾸려면 아래 숫자 10 두 곳을 수정)
--    · 보유 포인트는 0P 아래로 내려가지 않음
create or replace function public.check_and_reward() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.played_at := now();  -- 시간은 서버 기준으로 기록
  if new.score > 0 and new.duration_sec < 3 then
    raise exception '플레이 시간이 너무 짧습니다';
  end if;
  if new.score > greatest(new.duration_sec, 1) * 3000 then
    raise exception '비정상적인 점수입니다';
  end if;
  if exists (select 1 from public.play_records
             where user_id = new.user_id and played_at > now() - interval '3 seconds') then
    raise exception '기록 저장 간격이 너무 짧습니다';
  end if;
  new.points_delta := greatest(-10, least(10, coalesce(new.points_delta, 0)));
  update public.profiles
     set points = greatest(0, points + new.points_delta),
         earned = earned + greatest(new.points_delta, 0)
   where id = new.user_id;
  return new;
end; $$;

drop trigger if exists before_play_record on public.play_records;
create trigger before_play_record
  before insert on public.play_records
  for each row execute function public.check_and_reward();

-- 7) 상점: 아이템 구입 (가격은 shop_items 표 기준)
create or replace function public.buy_item(p_item text) returns json
language plpgsql security definer set search_path = public as $$
declare v_price int; v_points int; v_owned text[];
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  select price into v_price from public.shop_items where id = p_item;
  if v_price is null then raise exception '없는 아이템입니다'; end if;
  select points, owned into v_points, v_owned from public.profiles where id = auth.uid() for update;
  if p_item = any(v_owned) or v_price = 0 then raise exception '이미 가지고 있는 아이템입니다'; end if;
  if v_points < v_price then raise exception '포인트가 부족합니다'; end if;
  update public.profiles set points = points - v_price, owned = array_append(owned, p_item) where id = auth.uid();
  return json_build_object('points', v_points - v_price);
end; $$;

-- 8) 상점: 아바타 착용 (무료 아이템 또는 구입한 아이템만)
create or replace function public.set_avatar(p_avatar jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare k text; v text; v_owned text[];
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  select owned into v_owned from public.profiles where id = auth.uid();
  for k, v in select key, value #>> '{}' from jsonb_each(p_avatar) loop
    if k not in ('skin', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'back') then
      raise exception '알 수 없는 부위입니다: %', k;
    end if;
    continue when v is null;
    if not exists (select 1 from public.shop_items s
                   where s.id = v and s.slot = k and (s.price = 0 or v = any(v_owned))) then
      raise exception '착용할 수 없는 아이템입니다: %', v;
    end if;
  end loop;
  update public.profiles set avatar = p_avatar where id = auth.uid();
end; $$;

revoke execute on function public.buy_item(text)   from public, anon;
revoke execute on function public.set_avatar(jsonb) from public, anon;
grant  execute on function public.buy_item(text)   to authenticated;
grant  execute on function public.set_avatar(jsonb) to authenticated;

-- 9) 랭킹용 뷰: 게임별·회원별 최고 점수 (+ 아바타)
create or replace view public.leaderboard with (security_invoker = on) as
select r.game_id,
       r.user_id,
       p.nickname,
       max(r.score)     as best_score,
       count(*)         as plays,
       max(r.played_at) as last_played,
       p.avatar
  from public.play_records r
  join public.profiles p on p.id = r.user_id
 group by r.game_id, r.user_id, p.nickname, p.avatar;

grant select on public.leaderboard to anon, authenticated;
