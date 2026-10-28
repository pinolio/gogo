-- =====================================================================
-- v22 아바타 업데이트: 새 옷 105종 + 배경 14종 + 옷장(코디 3칸)
-- 사용법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여 넣고 Run
--  · 여러 번 실행해도 안전합니다. (이미 있는 아이템은 건너뜀 → 대시보드에서 고친 가격이 지켜짐)
--  · ★ 사이트 파일(v22)을 올리기 전에 먼저 실행하세요. 실행하지 않으면 새 옷·배경을 사거나 입을 수 없고,
--    옷장의 코디 저장도 되지 않습니다. (구입·착용은 서버의 shop_items 표에 있는 아이템만 허용)
--  · schema.sql 에도 같은 내용이 들어 있으므로, schema.sql 전체를 다시 실행해도 됩니다.
-- =====================================================================
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

-- 착용 함수: 배경(bg) 부위 허용
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

insert into public.shop_items (id, slot, name, price) values
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

-- 확인: items 가 160 (기존 41 + 새 옷 105 + 배경 14), outfits_col 이 1 이면 성공
select (select count(*) from public.shop_items) as items,
       (select count(*) from information_schema.columns where table_name = 'profiles' and column_name = 'outfits') as outfits_col;
