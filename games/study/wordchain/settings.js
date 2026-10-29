/*
 * 끝말잇기 — 게임 설정 (공부? 분류)
 * ※ 시간·포인트는 이 파일의 숫자만 고치면 됩니다. 사전은 같은 폴더 words.txt(전체) · common.txt(컴퓨터가 쓰는 낱말)
 */
GoSettings.register({
  id: 'wordchain',
  name: '끝말잇기',
  category: 'study',
  folder: 'games/study/wordchain',
  order: 40,
  tag: 'NEW',
  board: true,                        // 대결 화면 사용 (AI 대전 · 한 기기 · 온라인)
  players: [2, 3, 4],                 // 2~4명
  online: true, netRoom: true,        // 온라인: 최대 4명, 빈자리는 방장 기기의 컴퓨터
  w: 960, ar: 960 / 540,
  sides: '2~4명',
  vsText: '시작 단어가 나오면 차례대로 이어요',
  blurb: '앞 낱말의 끝 글자로 시작하는 낱말을 시간 안에 입력! 사전에 있는 명사만, 두음법칙(력→역) 인정. 2~4명.',
  keys: [['키보드로 낱말 입력 → Enter', '내 차례에 입력'], ['두음법칙', '끝 글자가 력 → 력·역 둘 다 가능'], ['기권', '바로 탈락']],

  hero: { eyebrow: 'NEW · 공부?', title: '말 잇고', em: '끝말잇기!', desc: '사과 → 과자 → 자동차… 시간 안에 이어 가세요. 컴퓨터·한 기기·온라인 친구와 최대 4명!', cta: '끝말잇기 하러 가기' },

  /* ---- 시간 (초) ---- */
  turnTime: 15,                       // 처음 한 사람에게 주는 시간
  minTime: 7,                         // 가장 짧은 시간
  timeStep: 0.4,                      // 낱말이 하나 이어질 때마다 줄어드는 시간

  /* ---- 포인트 ---- */
  points: { win: 2, lose: -1 },
  pointsByRank: { 2: [2, -1], 3: [3, 1, -1], 4: [4, 2, 0, -1] },
  playersBonus: 50,
  levelScore: { easy: 100, normal: 200, hard: 300 },
  goalText() { return '시간 안에 낱말을 잇지 못하면 탈락, 마지막까지 남으면 1등'; },

  /* ---- 컴퓨터: 생각하는 시간(초), 못 찾을 확률 ---- */
  bots: {
    easy: { think: [3, 7], miss: 0.18 },
    normal: { think: [2, 5], miss: 0.07 },
    hard: { think: [1.2, 3.2], miss: 0.02 }
  },
  bgm: { file: 'bgm/bgm.mp3', volume: 0.35 }
});
