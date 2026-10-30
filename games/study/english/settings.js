/*
 * 영어 단어 퀴즈 — 게임 설정 (공부? 분류) · v36
 *  - 60초 동안 4지선다: ① 영어 단어를 보고 뜻 고르기 ② 뜻을 보고 영어 단어 고르기 (섞여 나옴)
 *  - 시작할 때 단계 고르기: 중학 · 고등 · 섞어서 (고등 단어는 점수가 더 큼)
 *  - 단어 자료는 같은 폴더 data.js (중학 312개 · 고등 407개)
 */
GoSettings.register({
  id: 'english',
  name: '영어 단어 퀴즈',
  category: 'study',
  folder: 'games/study/english',
  order: 43,
  tag: 'NEW',
  page: 'GoEnglish',
  w: 720, ar: 720 / 540,
  blurb: '60초 동안 영어 단어 ↔ 뜻 맞히기! 중학·고등·섞어서 단계를 골라요. 연속으로 맞히면 보너스. 719단어.',
  hero: { eyebrow: 'NEW · 공부?', title: '60초 동안', em: '영어 단어 퀴즈!', desc: 'apple은 사과, 그럼 opportunity는? 중학·고등 단어를 골라 뜻과 단어를 맞혀요. 연속으로 맞히면 점수가 쑥쑥!', cta: '영어 단어 하러 가기' },
  timeLimit: 60,                       // 한 판 시간(초)
  scoreMid: 100,                       // 중학 단어를 맞히면
  scoreHigh: 150,                      // 고등 단어를 맞히면
  streakBonus: 20,                     // 연속으로 맞힐 때마다 더 주는 점수 (최대 10번까지)
  points: { win: 0, lose: 0 },         // 포인트 없이 랭킹만
  bgm: { file: 'bgm/bgm.mp3', volume: 0.3 }
});
