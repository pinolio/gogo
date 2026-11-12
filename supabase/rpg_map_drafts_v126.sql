-- gogo?gogo! v126 메이커 — 제출한 지도를 플레이어가 회수(다시 작성 중으로)하거나 지울 수 있게
-- (rpg_map_drafts_v125.sql 다음에 실행) · 반영된(accepted) 지도는 그대로 잠김
drop policy if exists "rmd_update_own" on public.rpg_map_drafts;
create policy "rmd_update_own" on public.rpg_map_drafts for update
  using (owner = auth.uid() and status in ('draft', 'returned', 'submitted'))
  with check (owner = auth.uid() and status in ('draft', 'returned', 'submitted'));
drop policy if exists "rmd_delete" on public.rpg_map_drafts;
create policy "rmd_delete" on public.rpg_map_drafts for delete using ((owner = auth.uid() and status in ('draft', 'returned', 'submitted')) or public.is_admin());

create or replace function public.rmd_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.rpg_map_drafts where owner = new.owner) >= 20 then
      raise exception '지도는 한 사람에 20개까지 저장할 수 있어요. 안 쓰는 지도를 지워 주세요.';
    end if;
    new.admin_note := ''; new.official_id := null; new.status := 'draft'; new.submitted_at := null;
  else
    if not public.is_admin() then
      new.owner := old.owner; new.admin_note := old.admin_note; new.official_id := old.official_id; new.created_at := old.created_at;
      if old.status = 'submitted' then
        -- 제출한 지도는 '회수'(작성 중으로)만 가능 · 그림·이름은 회수한 뒤에 고침
        new.title := old.title; new.data := old.data;
        if new.status = 'draft' then new.submitted_at := null; else new.status := 'submitted'; new.submitted_at := old.submitted_at; end if;
      else
        if new.status = 'submitted' then new.submitted_at := now(); else new.submitted_at := old.submitted_at; end if;
        if new.status not in ('draft', 'submitted') then new.status := 'draft'; end if;   -- 돌려받은 지도를 고치면 다시 '작성 중'
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

select status, count(*) from public.rpg_map_drafts group by status;
