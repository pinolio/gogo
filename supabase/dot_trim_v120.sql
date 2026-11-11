-- gogo?gogo! v120 예전 도트로만 그려지는 상의·하의 내림 (선생님 11/12 "기존 도트 형식의 아바타랑 그 아바타가 입고 있는 상품들은 다 삭제")
-- 상의: 교복 재킷·체육복 상의·의사 가운·대마법사 로브·흑기사 갑옷 / 하의: 반바지·체육복 바지·주름 치마·한복 바지·갑옷 하의
-- ① 산 사람에게 산 값만큼 포인트 환불 ② 가진 목록에서 빼기 ③ 입고 있던 것·옷장 코디는 기본 티셔츠·청바지로
-- ④ 쪽지(user_notes) ⑤ 상점 목록에서 삭제. 두 번 실행해도 환불은 한 번
do $$
declare
  v_ids text[]; r record; v_names text; v_sum int; v_n int; v_o jsonb; v_out jsonb; v_new jsonb; v_av jsonb;
begin
  select coalesce(array_agg(id), '{}') into v_ids from public.shop_items
   where id in ('t_school','t_pe','t_doctor','t_robe','t_darkarmor','b_shorts','b_pe','b_skirt','b_hanbok_m','b_armor');
  if array_length(v_ids, 1) is null then raise notice '지울 상품이 없음 (이미 실행됨)'; return; end if;

  for r in select p.id, p.owned from public.profiles p where p.owned && v_ids loop
    select string_agg(s.name, ', ' order by s.slot desc, s.price), coalesce(sum(s.price),0), count(*)
      into v_names, v_sum, v_n
      from public.shop_items s where s.id = any(r.owned) and s.id = any(v_ids);
    update public.profiles
       set points = points + v_sum,
           owned = array(select x from unnest(owned) x where not (x = any(v_ids)))
     where id = r.id;
    insert into public.user_notes (user_id, title, body, points)
    values (r.id, '옷 정리 안내',
            '아바타를 새 그림으로 바꾸면서 예전 옷을 내렸어요. 가지고 있던 ' || v_n || '개(' || v_names || ')를 산 값 그대로 포인트로 돌려드렸어요. 새 옷도 구경해 보세요!',
            v_sum);
  end loop;

  for r in select id, avatar, outfits from public.profiles loop
    v_av := r.avatar;
    if v_av->>'top' = any(v_ids) then v_av := jsonb_set(v_av, '{top}', '"t_basic"'); end if;
    if v_av->>'bottom' = any(v_ids) then v_av := jsonb_set(v_av, '{bottom}', '"b_jeans"'); end if;
    v_new := '[]'::jsonb;
    if jsonb_typeof(r.outfits) = 'array' then
      for v_o in select value from jsonb_array_elements(r.outfits) loop
        v_out := v_o;
        if jsonb_typeof(v_out) = 'object' then
          if v_out->>'top' = any(v_ids) then v_out := jsonb_set(v_out, '{top}', '"t_basic"'); end if;
          if v_out->>'bottom' = any(v_ids) then v_out := jsonb_set(v_out, '{bottom}', '"b_jeans"'); end if;
          if jsonb_typeof(v_out->'avatar') = 'object' then
            v_o := v_out->'avatar';
            if v_o->>'top' = any(v_ids) then v_o := jsonb_set(v_o, '{top}', '"t_basic"'); end if;
            if v_o->>'bottom' = any(v_ids) then v_o := jsonb_set(v_o, '{bottom}', '"b_jeans"'); end if;
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

  delete from public.shop_items where id = any(v_ids);
end $$;

-- 확인: 남은 상의·하의 수(각 6개) · 쪽지 수 · 환불 합계
select (select count(*) from public.shop_items where slot = 'top') as top_left,
       (select count(*) from public.shop_items where slot = 'bottom') as bottom_left,
       (select count(*) from public.user_notes where title = '옷 정리 안내') as notes,
       (select coalesce(sum(points),0) from public.user_notes where title = '옷 정리 안내') as refunded;
