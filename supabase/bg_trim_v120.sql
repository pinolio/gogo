-- gogo?gogo! v120 그림 없는 예전 배경 5개 내림 (선생님 11/11 "기존에 있던 배경은 다 지워줘")
-- 무지개 언덕·우주 정거장·마법의 성·용암 동굴·오로라 설원
-- ① 산 사람에게 산 값만큼 포인트 환불 ② 가진 목록에서 빼기 ③ 쓰고 있던 배경·옷장 코디의 배경은 '없음'으로
-- ④ 쪽지(user_notes · v119 에서 만든 표) ⑤ 상점 목록에서 삭제. 두 번 실행해도 환불은 한 번
do $$
declare
  v_ids text[]; r record; v_names text; v_sum int; v_n int; v_o jsonb; v_out jsonb; v_new jsonb; v_av jsonb;
begin
  select coalesce(array_agg(id), '{}') into v_ids from public.shop_items
   where id in ('bg_rainbow','bg_space','bg_castle','bg_volcano','bg_aurora');
  if array_length(v_ids, 1) is null then raise notice '지울 배경이 없음 (이미 실행됨)'; return; end if;

  for r in select p.id, p.owned from public.profiles p where p.owned && v_ids loop
    select string_agg(s.name, ', ' order by s.price), coalesce(sum(s.price),0), count(*)
      into v_names, v_sum, v_n
      from public.shop_items s where s.id = any(r.owned) and s.id = any(v_ids);
    update public.profiles
       set points = points + v_sum,
           owned = array(select x from unnest(owned) x where not (x = any(v_ids)))
     where id = r.id;
    insert into public.user_notes (user_id, title, body, points)
    values (r.id, '배경 정리 안내',
            '배경을 새 그림으로 바꾸면서 예전 배경을 내렸어요. 가지고 있던 ' || v_n || '개(' || v_names || ')를 산 값 그대로 포인트로 돌려드렸어요. 새 배경도 구경해 보세요!',
            v_sum);
  end loop;

  for r in select id, avatar, outfits from public.profiles loop
    v_av := r.avatar;
    if v_av->>'bg' = any(v_ids) then v_av := v_av - 'bg'; end if;
    v_new := '[]'::jsonb;
    if jsonb_typeof(r.outfits) = 'array' then
      for v_o in select value from jsonb_array_elements(r.outfits) loop
        v_out := v_o;
        if jsonb_typeof(v_out) = 'object' then
          if v_out->>'bg' = any(v_ids) then v_out := v_out - 'bg'; end if;
          if jsonb_typeof(v_out->'avatar') = 'object' and v_out->'avatar'->>'bg' = any(v_ids) then
            v_out := jsonb_set(v_out, '{avatar}', (v_out->'avatar') - 'bg');
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

-- 확인: 남은 배경 수(9개) · 쪽지 수 · 환불 합계
select (select count(*) from public.shop_items where slot = 'bg') as bg_left,
       (select count(*) from public.user_notes where title = '배경 정리 안내') as notes,
       (select coalesce(sum(points),0) from public.user_notes where title = '배경 정리 안내') as refunded;
