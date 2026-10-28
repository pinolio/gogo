/*
 * 퍼즐1024 — 게임 설정
 * ※ 밸런스 조정: 목표 숫자·컴퓨터 속도·포인트는 이 파일의 숫자만 고치면 됩니다.
 */
GoSettings.register({
  id: 'p1024',
  name: '퍼즐1024',
  category: 'puzzle',
  folder: 'games/puzzle/p1024',
  order: 2,
  tag: 'VS',
  battle: true,                       // 게임 화면 대신 대결 화면(GoP1024)을 사용
  page: 'GoP1024',
  blurb: '같은 숫자를 합쳐 1024를 먼저 만들면 승리! AI 대전 · 오프라인 대결 · 온라인 대결.',

  hero: { eyebrow: 'NEW · 퍼즐1024', title: '1024를 먼저 만들면', em: '승리!', desc: '같은 숫자를 밀어서 합치세요. 컴퓨터·옆 친구·온라인 친구와 누가 먼저 1024를 만드는지 겨뤄요.', cta: '퍼즐1024 하러 가기' },

  goal: 1024,                         // 이 숫자를 먼저 만든 사람이 승리
  maxPlayers: 6,                      // 한 판 최대 인원 (컴퓨터 포함)

  /* ---- 포인트 ---- */
  points: {
    win: 2, lose: -1,                 // 온라인에서 사람과 겨룬 판
    botsOnly: { win: 1, lose: -1 }    // AI 대전·오프라인 대결, 또는 상대가 모두 컴퓨터일 때
  },

  /* ---- 컴퓨터 상대: delay = 한 수 두는 간격(ms), err = 엉뚱한 수를 둘 확률 ---- */
  bots: {
    easy: { name: '쉬움', delay: 650, err: 0.25 },     // 보통 10~30분 걸림
    normal: { name: '보통', delay: 480, err: 0.1 },    // 보통 4~12분
    hard: { name: '어려움', delay: 330, err: 0.02 }    // 보통 3~8분
  },

  bgm: { file: '../2048/bgm/bgm.mp3', volume: 0.5 }
});
