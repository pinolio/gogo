-- =====================================================================
-- v32 (2026-10-29): 관리자 '반영여부' 체크
--   댓글·피드백(comments) 과 채팅(chat_messages) 에 resolved(반영됨) 칸 추가.
--   관리자 설정 → 댓글·피드백 / 채팅 기록 에서 체크하면 저장됨.
--   여러 번 실행해도 괜찮음. 지우는 내용 없음.
-- =====================================================================
alter table public.comments      add column if not exists resolved boolean not null default false;
alter table public.chat_messages add column if not exists resolved boolean not null default false;

-- 관리자만 resolved 를 바꿀 수 있게 (댓글은 원래 관리자 수정 정책이 있음)
grant update (resolved) on public.comments      to authenticated;
grant update (resolved) on public.chat_messages to authenticated;

drop policy if exists "chat_admin_update" on public.chat_messages;
create policy "chat_admin_update" on public.chat_messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 확인: 두 표에 resolved 칸이 생겼는지
select table_name, column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and column_name = 'resolved' and table_name in ('comments', 'chat_messages');
