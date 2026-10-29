/*
 * 지뢰찾기 — 게임 설정 (퍼즐 · 혼자 도전 + 걸린 시간 랭킹)
 *  - 가로 10 × 세로 10 = 100칸, 지뢰 20개. 지뢰가 아닌 80칸을 모두 열면 성공
 *  - 성공한 시간이 기록으로 남고, 가장 빠른 시간이 랭킹에 올라감
 *  - ※ 칸 수·지뢰 수는 이 파일의 숫자만 고치면 됩니다. (바꾸면 예전 기록과 난이도가 달라지니 기록 초기화를 생각해 주세요)
 */
GoSettings.register({
  id: 'mines',
  name: '지뢰찾기',
  category: 'puzzle',
  folder: 'games/puzzle/mines',
  order: 4,
  tag: 'NEW',
  page: 'GoMines',                    // 혼자 도전 화면 (게임판 + 바로 옆 랭킹)
  w: 600, ar: 600 / 680,
  blurb: '가로 10 × 세로 10, 지뢰 20개! 숫자를 보고 지뢰를 피해 모든 칸을 열어요. 성공한 시간이 랭킹에 올라가요.',
  keys: [['클릭 · 터치', '칸 열기 (숫자 칸을 누르면 주변 한꺼번에 열기)'], ['오른쪽 클릭 · 길게 누르기', '깃발 꽂기 / 빼기'], ['방향키 + 스페이스 · F', '키보드로 열기 · 깃발'], ['R', '새 판']],

  hero: { eyebrow: 'NEW · 퍼즐', title: '100칸 속 지뢰 20개', em: '지뢰찾기!', desc: '숫자는 주변 8칸의 지뢰 수예요. 깃발로 표시하며 모든 칸을 열면 성공! 가장 빠른 기록에 도전해요.', cta: '지뢰찾기 하러 가기' },

  cols: 10,                            // 가로 칸 수
  rows: 10,                            // 세로 칸 수
  mines: 20,                           // 지뢰 수
  points: { win: 0 },                  // 성공했을 때 포인트 (0 = 기록만). 예: 1 로 바꾸면 성공할 때마다 +1P

  /* ---- 기록: 걸린 시간이 짧을수록 좋음 ----
   * 서버 랭킹은 '큰 점수가 1위'라서, 시간을 점수로 바꿔 저장함: 점수 = 9000 - (걸린 시간 × 10)
   * 예) 45.3초 → 8547점 / 2분 → 7800점 (15분이 넘으면 1점)
   * 화면에는 scoreText 로 다시 시간으로 바꿔 보여 줌 (랭킹·내 전적·게임 목록 모두) */
  timeBase: 9000,
  toScore(sec) { return Math.max(1, this.timeBase - Math.round(sec * 10)); },
  toSec(score) { return Math.max(0, (this.timeBase - score) / 10); },
  scoreText(score) {
    if (!score) return '-';
    if (score <= 1) return '15분 넘음';
    const t = this.toSec(score), m = Math.floor(t / 60), s = (t - m * 60).toFixed(1);
    return m ? `${m}분 ${s.padStart(4, '0')}초` : `${s}초`;
  },
  bgm: { file: 'bgm/bgm.mp3', volume: 0.3 }
});
