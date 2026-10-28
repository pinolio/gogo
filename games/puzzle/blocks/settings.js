/*
 * 블록 쌓기 — 게임 설정
 * ※ 밸런스 조정 예정: 포인트와 승리 조건은 이 파일의 숫자만 고치면 됩니다.
 */
GoSettings.register({
  id: 'blocks',
  name: '블록 쌓기',
  category: 'puzzle',
  folder: 'games/puzzle/blocks',      // 이 폴더의 위치 (배경음악 경로에 사용)
  order: 2,                           // 게임 목록에서의 순서
  hidden: true,                       // 블록 대전(AI 대전)으로 합쳐서 목록에서 숨김 (예전 기록은 그대로)
  tag: '인기',
  w: 360,                             // 게임 화면 최대 너비(px)
  blurb: '떨어지는 블록을 돌리고 맞춰서 줄을 지워요. 10줄마다 빨라집니다.',
  keys: [['← →', '좌우 이동'], ['↑ 또는 X', '회전'], ['Z', '반대 회전'], ['↓', '천천히 내리기 (+1점)'], ['Space', '한 번에 내리기 (+2점/칸)'], ['P', '일시정지']],

  /* ---- 홈 화면 맨 위 소개 (10초마다 돌아가며 보여 줌) ---- */
  hero: { eyebrow: '인기 · 블록 쌓기', title: '20줄을 지우면', em: '승리 +2P', desc: '떨어지는 블록을 돌리고 맞춰서 줄을 지워요. 10줄마다 빨라지니 침착하게!', cta: '블록 쌓기 시작' },

  /* ---- 포인트 (밸런스 조정 예정) ---- */
  points: { win: 2, lose: -1 },       // 승리 +2P, 패배 -1P (보유 포인트는 0P 아래로 내려가지 않음)

  /* ---- 승리 조건 ---- */
  goal: { lines: 20 },                // 한 판에 20줄 이상 지우면 승리
  goalText() { return this.goal.lines + '줄 이상 지우기'; },
  judge(r) { return (r.extra && r.extra.lines || 0) >= this.goal.lines; },

  /* ---- 배경음악 ---- */
  bgm: { file: 'bgm/bgm.mp3', volume: 0.5 }   // 이 폴더의 bgm/ 안에 bgm.mp3 를 넣으면 자동 재생
});
