-- gogo?gogo! v91 내 방: 방 음악(게임 BGM 18곡 · 50P) · 자기소개 저장 · 방명록 새 글 막기
-- Supabase 대시보드 → SQL Editor → 붙여 넣고 Run (여러 번 실행해도 괜찮음)

-- 1) 상점에 '음악' 종류 추가 + 18곡 (가격 50P, 이미 있으면 그대로)
alter table public.shop_items drop constraint if exists shop_items_slot_check;
alter table public.shop_items add constraint shop_items_slot_check
  check (slot in ('skin', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'bg', 'furn', 'rug', 'wall', 'wallpaper', 'floor', 'wardrobe', 'music'));
insert into public.shop_items (id, slot, name, price) values
  ('m_battle', 'music', '블록 대전 · 신호등 구구단 음악', 50),
  ('m_p512', 'music', '퍼즐512 음악', 50),
  ('m_ultimate', 'music', '퍼즐512 랭킹 대전 음악', 50),
  ('m_mines', 'music', '지뢰찾기 음악', 50),
  ('m_snake', 'music', '스네이크 음악', 50),
  ('m_baduk', 'music', '바둑 음악', 50),
  ('m_omok', 'music', '오목 음악', 50),
  ('m_janggi', 'music', '장기 음악', 50),
  ('m_chess', 'music', '체스 음악', 50),
  ('m_alkkagi', 'music', '장기 알까기 음악', 50),
  ('m_code', 'music', '숫자 코드 음악', 50),
  ('m_volley', 'music', '아바타 배구 음악', 50),
  ('m_tennis', 'music', '아바타 테니스 음악', 50),
  ('m_fight', 'music', '일단 덤벼 음악', 50),
  ('m_rpg', 'music', 'skillcom RPG 음악', 50),
  ('m_scfight', 'music', 'Skillcom Fight 음악', 50),
  ('m_mecha', 'music', '메카 대전 음악', 50),
  ('m_sky', 'music', '6.25. 하늘 음악', 50)
on conflict (id) do nothing;

-- 2) 방 저장: 방 음악(bgm)도 가진 것만 · 자기소개(bio) 100자까지
create or replace function public.save_room(p_room jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_owned text[]; v_id text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if public.is_banned() then raise exception '이용이 정지된 계정이에요'; end if;
  if pg_column_size(p_room) > 8000 then raise exception '방 정보가 너무 커요'; end if;
  if jsonb_array_length(coalesce(p_room->'items', '[]'::jsonb)) > 40 or jsonb_array_length(coalesce(p_room->'walls', '[]'::jsonb)) > 12 then
    raise exception '가구가 너무 많아요';
  end if;
  if char_length(coalesce(p_room->>'bio', '')) > 100 then raise exception '자기소개는 100자까지 쓸 수 있어요'; end if;
  select owned into v_owned from public.profiles where id = auth.uid();
  for v_id in
    select p_room->>'wp' union all select p_room->>'fl' union all select p_room->>'wd' union all select p_room->>'bgm'
    union all select e->>0 from jsonb_array_elements(coalesce(p_room->'items', '[]'::jsonb)) e
    union all select e->>0 from jsonb_array_elements(coalesce(p_room->'walls', '[]'::jsonb)) e
  loop
    continue when v_id is null;
    if not exists (select 1 from public.shop_items s where s.id = v_id and s.slot in ('furn', 'rug', 'wall', 'wallpaper', 'floor', 'wardrobe', 'music')
                   and (s.price = 0 or v_id = any(v_owned))) then
      raise exception '아직 사지 않은 것이 있어요: %', v_id;
    end if;
  end loop;
  update public.profiles set room = p_room where id = auth.uid();
end; $$;
revoke execute on function public.save_room(jsonb) from public, anon;
grant  execute on function public.save_room(jsonb) to authenticated;

-- 3) 방명록 없앰 (선생님 결정): 새 글을 못 쓰게 함. 이미 있는 글·표는 그대로 (지우지 않음)
drop policy if exists "guest_insert" on public.guestbook;

-- 확인: 아래 두 줄이 나오면 성공 (음악 18 · 방명록 쓰기 규칙 0)
select 'music items' as what, count(*) from public.shop_items where slot = 'music'
union all select 'guestbook insert policy', count(*) from pg_policies where tablename = 'guestbook' and policyname = 'guest_insert';
