-- gogo?gogo! v112 기본 아바타 성별 (남 m · 여 f) — 처음 한 번 무료로 고르기 + 상점 '성별 변환권' (100P)
-- Supabase 대시보드 → SQL Editor → 붙여 넣고 Run (여러 번 실행해도 괜찮음)
-- 성별은 아바타 jsonb 안의 'g' 칸에 저장 (avatar->>'g' = 'm' | 'f' · 없으면 아직 안 고름)

-- 1) 옷 입기(set_avatar): 'g' 칸은 받아도 무시하고 서버에 있던 값을 그대로 지킴 (옷 입기로 성별을 바꿀 수 없게)
create or replace function public.set_avatar(p_avatar jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare k text; v text; v_owned text[]; v_g text; v_new jsonb := coalesce(p_avatar, '{}'::jsonb) - 'g';
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  select owned, avatar->>'g' into v_owned, v_g from public.profiles where id = auth.uid();
  for k, v in select key, value #>> '{}' from jsonb_each(v_new) loop
    if k not in ('skin', 'hair', 'hat', 'face', 'top', 'bottom', 'shoes', 'back', 'bg') then
      raise exception '알 수 없는 부위입니다: %', k;
    end if;
    continue when v is null;
    if not exists (select 1 from public.shop_items s
                   where s.id = v and s.slot = k and (s.price = 0 or v = any(v_owned))) then
      raise exception '착용할 수 없는 아이템입니다: %', v;
    end if;
  end loop;
  if v_g in ('m', 'f') then v_new := v_new || jsonb_build_object('g', v_g); end if;
  update public.profiles set avatar = v_new where id = auth.uid();
end; $$;
revoke execute on function public.set_avatar(jsonb) from public, anon;
grant  execute on function public.set_avatar(jsonb) to authenticated;

-- 2) 처음 한 번 무료로 고르기 (아직 'g' 가 없을 때만)
create or replace function public.choose_gender(p_g text) returns json
language plpgsql security definer set search_path = public as $$
declare v_g text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if p_g not in ('m', 'f') then raise exception '남자 또는 여자를 골라 주세요'; end if;
  select avatar->>'g' into v_g from public.profiles where id = auth.uid() for update;
  if v_g in ('m', 'f') then raise exception '이미 골랐어요. 바꾸려면 상점의 성별 변환권을 써 주세요'; end if;
  update public.profiles set avatar = coalesce(avatar, '{}'::jsonb) || jsonb_build_object('g', p_g) where id = auth.uid();
  return json_build_object('g', p_g);
end; $$;
revoke execute on function public.choose_gender(text) from public, anon;
grant  execute on function public.choose_gender(text) to authenticated;

-- 3) 성별 변환권: 100P 내고 남 ↔ 여 (사이트 js/gamehub.js 의 Hub.GENDER_PRICE 와 같게)
create or replace function public.change_gender() returns json
language plpgsql security definer set search_path = public as $$
declare v_g text; v_to text; v_points int; v_price constant int := 100;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if public.is_banned() then raise exception '이용이 정지된 계정이에요'; end if;
  select avatar->>'g', points into v_g, v_points from public.profiles where id = auth.uid() for update;
  if v_g is null or v_g not in ('m', 'f') then raise exception '먼저 기본 아바타(남자·여자)를 골라 주세요'; end if;
  if v_points < v_price then raise exception '포인트가 부족합니다'; end if;
  v_to := case when v_g = 'm' then 'f' else 'm' end;
  update public.profiles set points = points - v_price, avatar = avatar || jsonb_build_object('g', v_to) where id = auth.uid();
  return json_build_object('points', v_points - v_price, 'g', v_to);
end; $$;
revoke execute on function public.change_gender() from public, anon;
grant  execute on function public.change_gender() to authenticated;

-- 확인: 아래 세 줄이 모두 1 이면 성공
select 'set_avatar' as what, count(*)::text as v from pg_proc where proname = 'set_avatar'
union all select 'choose_gender', count(*)::text from pg_proc where proname = 'choose_gender'
union all select 'change_gender', count(*)::text from pg_proc where proname = 'change_gender';
