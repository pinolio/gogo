/*
 * 스네이크 — 게임 설정
 * ※ 밸런스 조정 예정: 포인트와 승리 조건은 이 파일의 숫자만 고치면 됩니다.
 */
GoSettings.register({
  id: 'snake',
  name: '스네이크',
  category: 'arcade',
  folder: 'games/arcade/snake',
  order: 4,
  tag: 'NEW',
  w: 400,
  blurb: '사과를 먹을수록 길어지고 빨라져요. 벽과 꼬리를 조심하세요.',
  keys: [['방향키 · WASD', '방향 바꾸기'], ['화면 밀기', '모바일 방향 바꾸기'], ['P', '일시정지']],

  /* ---- 홈 화면 맨 위 소개 (10초마다 돌아가며 보여 줌) ---- */
  hero: { eyebrow: '아케이드 · 스네이크', title: '사과 10개를 먹으면', em: '승리 +2P', desc: '먹을수록 길어지고 빨라져요. 벽과 내 꼬리에 부딪히지 않게 조심!', cta: '스네이크 시작' },

  /* ---- 포인트 (밸런스 조정 예정) ---- */
  points: { win: 2, lose: -1 },       // 승리 +2P, 패배 -1P (최하 0P)

  /* ---- 승리 조건 ---- */
  goal: { apples: 10 },               // 사과 10개 이상 먹으면 승리
  goalText() { return '사과 ' + this.goal.apples + '개 이상 먹기'; },
  judge(r) { return (r.extra && r.extra.apples || 0) >= this.goal.apples; },

  /* ---- 배경음악 ---- */
  bgm: { file: 'bgm/bgm.mp3', volume: 0.5 }
});
