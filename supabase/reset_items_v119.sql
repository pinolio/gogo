-- gogo?gogo! v119 헤어·모자·얼굴·신발·등 장식 처음부터 다시 (선생님 11/11)
-- ① 산 사람에게 산 값만큼 포인트 환불 ② 가진 목록에서 빼기 ③ 입고 있던 것·옷장 코디 정리(기본 머리·기본 운동화로)
-- ④ 쪽지(user_notes) 보내기 ⑤ 상점 목록(shop_items)에서 유료 상품 삭제. 무료 기본(짧은 머리 2·기본 운동화)은 남김
-- Supabase 대시보드 → SQL Editor → Run. 두 번 실행해도 환불이 두 번 되지 않음(두 번째에는 지울 상품이 없음)

-- 쪽지 표 (관리자가 보내는 안내 · 학생은 자기 것만 읽기)
create table if not exists public.user_notes (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  points integer not null default 0,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists user_notes_user on public.user_notes (user_id, notified);
alter table public.user_notes enable row level security;
drop policy if exists "user_notes_select" on public.user_notes;
create policy "user_notes_select" on public.user_notes for select using (user_id = auth.uid() or public.is_admin());
grant select on public.user_notes to authenticated;
create or replace function public.note_ack(p_ids bigint[]) returns void
language sql security definer set search_path = public as $$
  update public.user_notes set notified = true where user_id = auth.uid() and id = any(p_ids);
$$;
revoke execute on function public.note_ack(bigint[]) from public, anon;
grant execute on function public.note_ack(bigint[]) to authenticated;

do $$
declare
  v_ids text[]; r record; v_names text; v_sum int; v_n int;
  v_av jsonb; v_out jsonb; v_o jsonb; v_new jsonb;
begin
  select coalesce(array_agg(id), '{}') into v_ids from public.shop_items
   where slot in ('hair','hat','face','shoes','back') and price > 0;
  if array_length(v_ids, 1) is null then raise notice '지울 상품이 없음 (이미 실행됨)'; return; end if;

  -- ①②④ 환불 + 쪽지
  for r in select p.id, p.owned from public.profiles p where p.owned && v_ids loop
    select string_agg(s.name, ', ' order by s.slot, s.price), coalesce(sum(s.price),0), count(*)
      into v_names, v_sum, v_n
      from public.shop_items s where s.id = any(r.owned) and s.id = any(v_ids);
    update public.profiles
       set points = points + v_sum,
           owned = array(select x from unnest(owned) x where not (x = any(v_ids)))
     where id = r.id;
    insert into public.user_notes (user_id, title, body, points)
    values (r.id, '상점 정리 안내',
            '헤어·모자·얼굴·신발·등 장식을 새로 예쁘게 만들기 위해 지금 상품을 모두 내렸어요. 가지고 있던 ' || v_n || '개(' || v_names || ')를 산 값 그대로 포인트로 돌려드렸어요. 새 상품이 나오면 다시 사 주세요!',
            v_sum);
  end loop;

  -- ③ 입고 있던 것 · 옷장 코디 정리 (모든 회원)
  for r in select id, avatar, outfits from public.profiles loop
    v_av := r.avatar;
    if v_av->>'hair' = any(v_ids) then v_av := jsonb_set(v_av, '{hair}', '"h_short"'); end if;
    if v_av->>'shoes' = any(v_ids) then v_av := jsonb_set(v_av, '{shoes}', '"sh_basic"'); end if;
    if v_av->>'hat' = any(v_ids) then v_av := v_av - 'hat'; end if;
    if v_av->>'face' = any(v_ids) then v_av := v_av - 'face'; end if;
    if v_av->>'back' = any(v_ids) then v_av := v_av - 'back'; end if;
    v_new := '[]'::jsonb;
    if jsonb_typeof(r.outfits) = 'array' then
      for v_o in select value from jsonb_array_elements(r.outfits) loop
        v_out := v_o;
        if jsonb_typeof(v_out) = 'object' then
          if v_out->>'hair' = any(v_ids) then v_out := jsonb_set(v_out, '{hair}', '"h_short"'); end if;
          if v_out->>'shoes' = any(v_ids) then v_out := jsonb_set(v_out, '{shoes}', '"sh_basic"'); end if;
          if v_out->>'hat' = any(v_ids) then v_out := v_out - 'hat'; end if;
          if v_out->>'face' = any(v_ids) then v_out := v_out - 'face'; end if;
          if v_out->>'back' = any(v_ids) then v_out := v_out - 'back'; end if;
          -- 코디가 {avatar:{…}} 모양이면 그 안도 정리
          if jsonb_typeof(v_out->'avatar') = 'object' then
            v_o := v_out->'avatar';
            if v_o->>'hair' = any(v_ids) then v_o := jsonb_set(v_o, '{hair}', '"h_short"'); end if;
            if v_o->>'shoes' = any(v_ids) then v_o := jsonb_set(v_o, '{shoes}', '"sh_basic"'); end if;
            v_o := v_o - (case when v_o->>'hat' = any(v_ids) then 'hat' else '' end)
                       - (case when v_o->>'face' = any(v_ids) then 'face' else '' end)
                       - (case when v_o->>'back' = any(v_ids) then 'back' else '' end);
            v_out := jsonb_set(v_out, '{avatar}', v_o);
          end if;
        end if;
        v_new := v_new || jsonb_build_array(v_out);
      end loop;
    else v_new := coalesce(r.outfits, '[]'::jsonb);
    end if;
    if v_av is distinct from r.avatar or v_new is distinct from r.outfits then
      update public.profiles set avatar = v_av, outfits = v_new where id = r.id;
    end if;
  end loop;

  -- ⑤ 상점 목록에서 삭제
  delete from public.shop_items where id = any(v_ids);
end $$;

-- 확인: 남은 상품(무료 기본 3개) · 쪽지 수 · 환불 합계
select (select count(*) from public.shop_items where slot in ('hair','hat','face','shoes','back')) as left_items,
       (select count(*) from public.user_notes where title = '상점 정리 안내') as notes,
       (select coalesce(sum(points),0) from public.user_notes where title = '상점 정리 안내') as refunded;
