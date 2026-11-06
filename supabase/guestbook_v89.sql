-- gogo?gogo! v89 방명록: 각 글은 방 주인 · 글쓴이(· 관리자)만 볼 수 있음 (다른 방문자는 못 봄)
-- Supabase 대시보드 → SQL Editor → 붙여 넣고 Run (여러 번 실행해도 괜찮음)
drop policy if exists "guest_select" on public.guestbook;
create policy "guest_select" on public.guestbook for select
  using (user_id = auth.uid() or owner = auth.uid() or public.is_admin());

-- 확인: 아래 한 줄의 qual 에 'user_id = auth.uid()' 와 'owner = auth.uid()' 가 보이면 성공
select policyname, qual from pg_policies where tablename = 'guestbook' and policyname = 'guest_select';
