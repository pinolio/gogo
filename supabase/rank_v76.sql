-- gogo?gogo! v76 — 신기록 같은 점수면 먼저 세운 사람이 1등 (선생님 요청 2026-11-05)
--  · leaderboard 보기에 best_at(그 최고 점수를 처음 낸 시각) 줄을 더함 → 사이트가 '점수 높은 순 → best_at 빠른 순' 으로 정렬
--  · skillcom RPG 도 같음: 가장 높은 단계(점수)를 먼저 깬 사람이 1등
--  · 기록은 지우거나 바꾸지 않음. 여러 번 실행해도 안전합니다.
create index if not exists play_records_game_user_score on public.play_records (game_id, user_id, score desc, played_at);

create or replace view public.leaderboard with (security_invoker = on) as
select r.game_id,
       r.user_id,
       p.nickname,
       max(r.score)     as best_score,
       count(*)         as plays,
       max(r.played_at) as last_played,
       p.avatar,
       (select min(r2.played_at) from public.play_records r2
         where r2.game_id = r.game_id and r2.user_id = r.user_id and r2.score = max(r.score)) as best_at
  from public.play_records r
  join public.profiles p on p.id = r.user_id
 group by r.game_id, r.user_id, p.nickname, p.avatar;

grant select on public.leaderboard to anon, authenticated;

select game_id, nickname, best_score, best_at from public.leaderboard order by game_id, best_score desc, best_at asc limit 5;
