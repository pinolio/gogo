/*
 * 퍼즐512 — 게임 설정
 * ※ 밸런스 조정: 목표 숫자·컴퓨터 속도·포인트는 이 파일의 숫자만 고치면 됩니다.
 */
GoSettings.register({
  id: 'p512',
  name: '퍼즐512',
  category: 'puzzle',
  folder: 'games/puzzle/p512',
  order: 2,
  tag: 'VS',
  battle: true,                       // 게임 화면 대신 대결 화면(GoP512)을 사용
  page: 'GoP512',
  blurb: '2분 안에 512를 먼저 만들거나 가장 큰 숫자를 만들면 승리! AI 대전 · 오프라인 대결 · 온라인 대결.',

  hero: { eyebrow: 'NEW · 퍼즐512', title: '2분 안에 512!', em: '퍼즐512', desc: '같은 숫자를 밀어서 합치세요. 512를 먼저 만들거나, 2분이 끝났을 때 가장 큰 숫자를 만든 사람이 승리!', cta: '퍼즐512 하러 가기' },

  goal: 512,                          // 이 숫자를 먼저 만든 사람이 승리
  timeLimit: 120,                     // AI 대전·온라인 대결 제한 시간(초). 끝나면 가장 큰 숫자(같으면 점수) 순. 0 = 시간 제한 없음
  maxPlayers: 6,                      // 한 판 최대 인원 (컴퓨터 포함)

  /* ---- 포인트 ---- */
  points: {
    win: 2, lose: -1,                 // 온라인에서 사람과 겨룬 판
    botsOnly: { win: 1, lose: -1 }    // AI 대전·오프라인 대결, 또는 상대가 모두 컴퓨터일 때
  },

  /* ---- 컴퓨터 상대: delay = 한 수 두는 간격(ms), err = 엉뚱한 수를 둘 확률 ---- */
  bots: {
    easy: { name: '쉬움', delay: 750, err: 0.25 },
    normal: { name: '보통', delay: 520, err: 0.1 },
    hard: { name: '어려움', delay: 420, err: 0.02 }
  },

  bgm: { file: '../2048/bgm/bgm.mp3', volume: 0.5 }
});
