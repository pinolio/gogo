/*
 * 2048 — 게임 설정
 * ※ 밸런스 조정 예정: 포인트와 승리 조건은 이 파일의 숫자만 고치면 됩니다.
 */
GoSettings.register({
  id: '2048',
  name: '2048',
  category: 'puzzle',
  folder: 'games/puzzle/2048',
  order: 3,
  w: 400,
  blurb: '같은 숫자를 합쳐서 2048 타일을 만들어 보세요.',
  keys: [['방향키 · WASD', '타일 밀기'], ['화면 밀기', '모바일 타일 밀기'], ['P', '일시정지']],

  /* ---- 홈 화면 맨 위 소개 (10초마다 돌아가며 보여 줌) ---- */
  hero: { eyebrow: '퍼즐 · 2048', title: '같은 숫자를 합쳐', em: '512를 만들어요', desc: '방향키 한 번에 모든 타일이 움직여요. 512 타일을 만들면 승리!', cta: '2048 시작' },

  /* ---- 포인트 (밸런스 조정 예정) ---- */
  points: { win: 2, lose: -1 },       // 승리 +2P, 패배 -1P (최하 0P)

  /* ---- 승리 조건 ---- */
  goal: { tile: 512 },                // 512 타일을 만들면 승리
  goalText() { return this.goal.tile + ' 타일 만들기'; },
  judge(r) { return (r.extra && r.extra.maxTile || 0) >= this.goal.tile; },

  /* ---- 배경음악 ---- */
  bgm: { file: 'bgm/bgm.mp3', volume: 0.5 }
});
