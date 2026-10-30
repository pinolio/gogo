/*
 * 한국사 퀴즈 — 게임 설정 (공부? 분류) · v36
 *  - 60초 동안 4지선다, 세 가지 문제가 섞여 나옴
 *    ① 설명 보고 인물·사건·문화유산·제도 고르기  ② 어느 시대인지 고르기  ③ 가장 먼저(나중에) 일어난 사건 고르기
 *  - 문제 자료는 같은 폴더 data.js (114개)
 */
GoSettings.register({
  id: 'history',
  name: '한국사 퀴즈',
  category: 'study',
  folder: 'games/study/history',
  order: 44,
  tag: 'NEW',
  page: 'GoHistoryQuiz',
  w: 720, ar: 720 / 540,
  blurb: '60초 동안 설명 보고 인물·사건 고르기, 시대 고르기, 먼저 일어난 일 고르기! 연속으로 맞히면 보너스.',
  hero: { eyebrow: 'NEW · 공부?', title: '60초 동안', em: '한국사 퀴즈!', desc: '훈민정음을 만든 왕은? 고인돌은 어느 시대? 임진왜란과 병자호란 중 먼저 일어난 일은? 연속으로 맞히면 점수가 쑥쑥!', cta: '한국사 퀴즈 하러 가기' },
  timeLimit: 60,                       // 한 판 시간(초)
  scoreRight: 100,                     // 맞히면
  streakBonus: 20,                     // 연속으로 맞힐 때마다 더 주는 점수 (최대 10번까지)
  mix: { desc: 0.5, era: 0.25, order: 0.25 },   // 문제 종류 비율: 설명 보고 고르기 · 시대 고르기 · 순서 고르기
  points: { win: 0, lose: 0 },         // 포인트 없이 랭킹만
  bgm: { file: 'bgm/bgm.mp3', volume: 0.3 }
});
