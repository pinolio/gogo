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
alter table public.profiles add column if not exists role   text    not null default 'user';      -- 'user' | 'admin'
alter table public.profiles add column if not exists banned boolean not null default false;       -- 이용 정지 (전적·댓글·채팅 막힘)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

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
  slot   text not null check (slot in ('skin', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'bg')),
  name   text not null,
  price  integer not null default 0 check (price >= 0)
);
-- 배경(bg) 부위 허용 + 옷장 코디 저장 (v22)
alter table public.shop_items drop constraint if exists shop_items_slot_check;
alter table public.shop_items add constraint shop_items_slot_check
  check (slot in ('skin', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'bg'));
alter table public.profiles add column if not exists outfits jsonb not null default '[]'::jsonb;   -- 옷장 코디 3칸

-- 옷장: 코디 3칸 저장 (착용은 set_avatar 가 따로 검사하므로 여기서는 모양·크기만 확인)
create or replace function public.save_outfits(p_outfits jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if jsonb_typeof(p_outfits) <> 'array' or jsonb_array_length(p_outfits) > 3 then raise exception '코디는 3개까지 저장할 수 있어요'; end if;
  if pg_column_size(p_outfits) > 4000 then raise exception '코디 정보가 너무 커요'; end if;
  update public.profiles set outfits = p_outfits where id = auth.uid();
end; $$;
revoke execute on function public.save_outfits(jsonb) from public, anon;
grant  execute on function public.save_outfits(jsonb) to authenticated;

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
  ('bk_wings', 'back', '천사 날개', 30),
  -- v22 새 패션 105종 + 배경 14종
  ('t_pe', 'top', '체육복 상의', 5),
  ('b_pe', 'bottom', '체육복 바지', 4),
  ('t_blouse', 'top', '교복 블라우스·조끼', 6),
  ('b_uniskirt', 'bottom', '교복 치마', 5),
  ('b_slacks', 'bottom', '교복 바지', 4),
  ('t_cardigan', 'top', '베이지 카디건', 7),
  ('t_mint', 'top', '민트 후드티', 8),
  ('t_padding', 'top', '롱패딩', 12),
  ('t_denim', 'top', '청재킷', 9),
  ('t_basket', 'top', '농구 유니폼', 9),
  ('b_basket', 'bottom', '농구 반바지', 4),
  ('h_ponytail', 'hair', '포니테일', 7),
  ('h_curly', 'hair', '뽀글 머리', 8),
  ('h_twotone', 'hair', '투톤 머리', 10),
  ('h_bun', 'hair', '똥머리', 8),
  ('hat_snapback', 'hat', '거꾸로 스냅백', 6),
  ('hat_pompom', 'hat', '방울 비니', 6),
  ('f_headphone', 'face', '헤드폰', 9),
  ('sh_hightop', 'shoes', '하이탑 운동화', 6),
  ('sh_rain', 'shoes', '빨간 장화', 5),
  ('t_doctor', 'top', '의사 가운', 12),
  ('t_chef', 'top', '요리사 옷', 10),
  ('b_chef', 'bottom', '체크 바지', 6),
  ('hat_chef', 'hat', '요리사 모자', 8),
  ('t_fire', 'top', '소방복', 14),
  ('hat_fire', 'hat', '소방 헬멧', 10),
  ('t_police', 'top', '경찰복', 12),
  ('hat_police', 'hat', '경찰 모자', 10),
  ('t_astro', 'top', '우주복', 20),
  ('b_astro', 'bottom', '우주복 바지', 8),
  ('hat_astro', 'hat', '우주 헬멧', 25),
  ('hat_hardhat', 'hat', '안전모', 6),
  ('t_vest', 'top', '안전 조끼', 6),
  ('t_idol', 'top', '아이돌 무대의상', 18),
  ('f_mic', 'face', '헤드셋 마이크', 8),
  ('t_overall', 'top', '농부 멜빵', 9),
  ('hat_straw', 'hat', '밀짚모자', 6),
  ('sh_black', 'shoes', '검정 부츠', 6),
  ('sh_space', 'shoes', '우주 부츠', 8),
  ('t_ninja', 'top', '닌자 옷', 14),
  ('b_ninja', 'bottom', '닌자 바지', 8),
  ('f_ninja', 'face', '닌자 복면', 10),
  ('hat_pirate', 'hat', '해적 선장 모자', 20),
  ('f_eyepatch', 'face', '안대', 6),
  ('t_pirate', 'top', '해적 코트', 22),
  ('t_robe', 'top', '대마법사 로브', 28),
  ('hat_darkhelm', 'hat', '흑기사 뿔 투구', 40),
  ('t_darkarmor', 'top', '흑기사 갑옷', 45),
  ('bk_darkcape', 'back', '어둠의 망토', 30),
  ('f_elf', 'face', '엘프 귀', 10),
  ('hat_halo', 'hat', '천사 고리', 25),
  ('hat_devil', 'hat', '악마 뿔', 12),
  ('bk_bat', 'back', '박쥐 날개', 35),
  ('bk_dragon', 'back', '용 날개', 60),
  ('bk_fairy', 'back', '요정 날개', 45),
  ('bk_jetpack', 'back', '제트팩', 50),
  ('hat_emperor', 'hat', '황제의 왕관', 55),
  ('t_vampire', 'top', '뱀파이어 정장', 22),
  ('s_pale', 'skin', '창백한 피부 (뱀파이어)', 12),
  ('s_gold', 'skin', '황금 피부', 50),
  ('hat_dino', 'hat', '공룡 후드', 10),
  ('t_dino', 'top', '공룡 잠옷 상의', 10),
  ('b_dino', 'bottom', '공룡 잠옷 바지', 6),
  ('hat_panda', 'hat', '판다 후드', 10),
  ('t_panda', 'top', '판다 잠옷', 10),
  ('b_panda', 'bottom', '판다 잠옷 바지', 6),
  ('hat_cat', 'hat', '고양이 후드', 8),
  ('hat_santa', 'hat', '산타 모자', 8),
  ('t_santa', 'top', '산타 옷', 12),
  ('b_santa', 'bottom', '산타 바지', 5),
  ('f_beard', 'face', '산타 수염', 6),
  ('hat_pumpkin', 'hat', '호박 머리', 15),
  ('t_hanbok_m', 'top', '한복 저고리 (파랑)', 14),
  ('b_hanbok_m', 'bottom', '한복 바지', 8),
  ('t_hanbok_f', 'top', '한복 저고리 (노랑)', 14),
  ('b_chima', 'bottom', '다홍 치마', 10),
  ('t_hawaii', 'top', '하와이안 셔츠', 8),
  ('b_swim', 'bottom', '수영 반바지', 3),
  ('sh_flip', 'shoes', '슬리퍼', 3),
  ('hat_raincoat', 'hat', '우비 모자', 6),
  ('t_raincoat', 'top', '노란 우비', 9),
  ('bk_bag2', 'back', '하늘색 책가방', 6),
  ('hat_sweatband', 'hat', '스포츠 머리띠', 4),
  ('hat_pilot', 'hat', '조종사 모자', 10),
  ('t_pilot', 'top', '조종사 제복', 14),
  ('f_goggles', 'face', '실험 보안경', 5),
  ('hat_racing', 'hat', '레이싱 헬멧', 15),
  ('t_racing', 'top', '레이싱 슈트', 16),
  ('t_teacher', 'top', '선생님 재킷', 9),
  ('h_topknot', 'hair', '상투 머리', 8),
  ('t_samurai', 'top', '사무라이 갑옷', 30),
  ('t_angel', 'top', '천사 로브', 20),
  ('t_devil', 'top', '꼬마 악마 옷', 18),
  ('hat_flower', 'hat', '꽃 화관', 12),
  ('bk_phoenix', 'back', '불사조 날개', 60),
  ('t_elf', 'top', '엘프 잎사귀 옷', 16),
  ('hat_elfhood', 'hat', '엘프 후드', 12),
  ('hat_bunnyhood', 'hat', '토끼 후드', 8),
  ('hat_bear', 'hat', '곰 후드', 8),
  ('t_bear', 'top', '곰 잠옷', 10),
  ('hat_penguin', 'hat', '펭귄 후드', 8),
  ('t_penguin', 'top', '펭귄 잠옷', 10),
  ('hat_tophat', 'hat', '눈사람 중절모', 10),
  ('t_snowman', 'top', '눈사람 옷', 12),
  ('hat_gat', 'hat', '갓', 15),
  ('bg_sky', 'bg', '맑은 하늘', 0),
  ('bg_class', 'bg', '우리 교실', 0),
  ('bg_gym', 'bg', '학교 체육관', 10),
  ('bg_sunset', 'bg', '노을 지는 도시', 15),
  ('bg_night', 'bg', '별 헤는 밤', 8),
  ('bg_space', 'bg', '우주 정거장', 25),
  ('bg_castle', 'bg', '마법의 성', 30),
  ('bg_volcano', 'bg', '용암 동굴', 40),
  ('bg_aurora', 'bg', '오로라 설원', 45),
  ('bg_sea', 'bg', '여름 바다', 10),
  ('bg_forest', 'bg', '초록 숲', 8),
  ('bg_cherry', 'bg', '벚꽃길', 12),
  ('bg_snow', 'bg', '눈 오는 마을', 12),
  ('bg_rainbow', 'bg', '무지개 언덕', 20)
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
  if exists (select 1 from public.profiles where id = new.user_id and banned) then
    raise exception '이용이 정지된 계정입니다';
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
    if k not in ('skin', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'bg') then
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


-- =====================================================================
-- 10) 관리자 확인 함수
--     관리자 지정: 아래 'admin_setup.sql' 안내대로 role 을 'admin' 으로 바꿉니다.
--     (role·banned 는 회원이 직접 고칠 수 없음: 위 4)에서 닉네임만 수정 허용)
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;
create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select banned from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_admin()  to anon, authenticated;
grant execute on function public.is_banned() to anon, authenticated;

-- =====================================================================
-- 11) 게임 댓글 · 피드백
--     kind = 'comment'(모두에게 보임) | 'feedback'(쓴 사람과 관리자만 보임)
-- =====================================================================
create table if not exists public.comments (
  id          bigint generated always as identity primary key,
  game_id     text not null check (game_id ~ '^[a-z0-9_-]{2,30}$'),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null default 'comment' check (kind in ('comment', 'feedback')),
  body        text not null check (char_length(body) between 1 and 300),
  rating      smallint check (rating between 1 and 5),
  hidden      boolean not null default false,          -- 관리자가 숨긴 댓글
  created_at  timestamptz not null default now()
);
create index if not exists comments_game_time on public.comments (game_id, created_at desc);
create index if not exists comments_time      on public.comments (created_at desc);
alter table public.comments enable row level security;

drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments for select
  using ((kind = 'comment' and not hidden) or user_id = auth.uid() or public.is_admin());
drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned());
drop policy if exists "comments_delete" on public.comments;
create policy "comments_delete" on public.comments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "comments_admin_update" on public.comments;
create policy "comments_admin_update" on public.comments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke update on public.comments from anon, authenticated;
grant  update (hidden) on public.comments to authenticated;

-- 도배 방지: 같은 사람은 10초에 1개
create or replace function public.check_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now(); new.hidden := false;
  if exists (select 1 from public.comments where user_id = new.user_id and created_at > now() - interval '10 seconds') then
    raise exception '댓글은 10초에 한 번만 쓸 수 있어요';
  end if;
  if new.kind = 'comment' then new.rating := null; end if;
  return new;
end; $$;
drop trigger if exists before_comment on public.comments;
create trigger before_comment before insert on public.comments
  for each row execute function public.check_comment();

-- =====================================================================
-- 12) 게임 채팅 (게임마다 대화방 1개, 실시간 전달은 Realtime broadcast)
--     최근 대화와 관리자 확인용으로 저장. 30일 지난 대화는 자동 삭제.
-- =====================================================================
create table if not exists public.chat_messages (
  id          bigint generated always as identity primary key,
  game_id     text not null check (game_id ~ '^[a-z0-9_-]{2,30}$'),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 120),
  created_at  timestamptz not null default now()
);
create index if not exists chat_game_time on public.chat_messages (game_id, created_at desc);
create index if not exists chat_time      on public.chat_messages (created_at desc);
alter table public.chat_messages enable row level security;

drop policy if exists "chat_select_all" on public.chat_messages;
create policy "chat_select_all" on public.chat_messages for select using (true);
drop policy if exists "chat_insert_own" on public.chat_messages;
create policy "chat_insert_own" on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned());
drop policy if exists "chat_admin_delete" on public.chat_messages;
create policy "chat_admin_delete" on public.chat_messages for delete to authenticated
  using (public.is_admin());

-- 도배 방지: 10초에 5개까지
create or replace function public.check_chat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  if (select count(*) from public.chat_messages where user_id = new.user_id and created_at > now() - interval '10 seconds') >= 5 then
    raise exception '채팅을 너무 빨리 보내고 있어요. 잠시 뒤에 보내 주세요';
  end if;
  delete from public.chat_messages where created_at < now() - interval '30 days';
  return new;
end; $$;
drop trigger if exists before_chat on public.chat_messages;
create trigger before_chat before insert on public.chat_messages
  for each row execute function public.check_chat();

-- =====================================================================
-- 13) 관리자 전용 함수 (관리자가 아니면 오류)
-- =====================================================================
-- 회원 목록 + 판수·최근 플레이
create or replace function public.admin_members()
returns table (id uuid, username text, nickname text, role text, banned boolean, points int, earned int,
               created_at timestamptz, plays bigint, last_played timestamptz, comments bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요'; end if;
  return query
    select p.id, p.username, p.nickname, p.role, p.banned, p.points, p.earned, p.created_at,
           (select count(*) from public.play_records r where r.user_id = p.id),
           (select max(r.played_at) from public.play_records r where r.user_id = p.id),
           (select count(*) from public.comments c where c.user_id = p.id)
      from public.profiles p
     order by p.created_at desc;
end; $$;

-- 회원 관리: ban / unban / points(±) / nickname / reset_records / make_admin / remove_admin
create or replace function public.admin_update_member(p_uid uuid, p_action text, p_value text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  if p_action = 'ban' then
    if p_uid = auth.uid() then raise exception '자기 자신은 정지할 수 없어요'; end if;
    update public.profiles set banned = true where id = p_uid;
  elsif p_action = 'unban' then
    update public.profiles set banned = false where id = p_uid;
  elsif p_action = 'points' then
    update public.profiles set points = greatest(0, points + p_value::int),
                               earned = earned + greatest(p_value::int, 0) where id = p_uid;
  elsif p_action = 'nickname' then
    if char_length(coalesce(p_value, '')) not between 2 and 10 then raise exception '닉네임은 2~10자'; end if;
    update public.profiles set nickname = p_value where id = p_uid;
  elsif p_action = 'reset_records' then
    delete from public.play_records where user_id = p_uid;
  elsif p_action = 'make_admin' then
    update public.profiles set role = 'admin' where id = p_uid;
  elsif p_action = 'remove_admin' then
    if p_uid = auth.uid() then raise exception '자기 자신의 관리자 권한은 뺄 수 없어요'; end if;
    update public.profiles set role = 'user' where id = p_uid;
  else
    raise exception '알 수 없는 작업: %', p_action;
  end if;
end; $$;

-- 전적 종합 집계 (한국 시간 기준 날짜)
create or replace function public.admin_overview() returns json
language plpgsql stable security definer set search_path = public as $$
declare v json;
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요'; end if;
  select json_build_object(
    'members',      (select count(*) from public.profiles),
    'members_7d',   (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'banned',       (select count(*) from public.profiles where banned),
    'plays',        (select count(*) from public.play_records),
    'plays_today',  (select count(*) from public.play_records where (played_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date),
    'players_7d',   (select count(distinct user_id) from public.play_records where played_at > now() - interval '7 days'),
    'total_sec',    (select coalesce(sum(duration_sec), 0) from public.play_records),
    'comments',     (select count(*) from public.comments where kind = 'comment'),
    'feedback',     (select count(*) from public.comments where kind = 'feedback'),
    'chats_7d',     (select count(*) from public.chat_messages where created_at > now() - interval '7 days'),
    'per_game', (select coalesce(json_agg(g order by g.plays desc), '[]'::json) from (
        select r.game_id, count(*) as plays, count(distinct r.user_id) as players,
               count(*) filter (where r.result = 'win') as wins, count(*) filter (where r.result = 'lose') as losses,
               round(avg(r.duration_sec)) as avg_sec, max(r.score) as best,
               count(*) filter (where r.played_at > now() - interval '7 days') as plays_7d,
               (select round(avg(c.rating)::numeric, 1) from public.comments c where c.game_id = r.game_id and c.rating is not null) as rating,
               (select count(*) from public.comments c where c.game_id = r.game_id) as comments
          from public.play_records r group by r.game_id) g),
    'daily', (select coalesce(json_agg(d order by d.day), '[]'::json) from (
        select (played_at at time zone 'Asia/Seoul')::date as day, count(*) as plays, count(distinct user_id) as players
          from public.play_records where played_at > now() - interval '14 days' group by 1) d)
  ) into v;
  return v;
end; $$;

revoke execute on function public.admin_members()                    from public, anon;
revoke execute on function public.admin_update_member(uuid, text, text) from public, anon;
revoke execute on function public.admin_overview()                   from public, anon;
grant  execute on function public.admin_members()                    to authenticated;
grant  execute on function public.admin_update_member(uuid, text, text) to authenticated;
grant  execute on function public.admin_overview()                   to authenticated;
