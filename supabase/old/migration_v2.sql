-- 이미 예전 schema.sql 을 실행한 경우에만 한 번 실행하세요. (처음 설치라면 schema.sql 만 실행하면 됩니다)

-- 1) 블록 대전(battle) 기록 허용
alter table public.play_records drop constraint if exists play_records_game_id_check;
alter table public.play_records add constraint play_records_game_id_check
  check (game_id in ('blocks', 'snake', '2048', 'battle'));

-- 2) 게임별 전적 초기화: 본인 기록만 삭제 허용
drop policy if exists "records_delete_own" on public.play_records;
create policy "records_delete_own" on public.play_records for delete to authenticated
  using (auth.uid() = user_id);
