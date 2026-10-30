/*
 * 사자성어 맞추기 — 게임 설정 (공부? 분류)
 *  - 60초 동안 4지선다: ① 뜻을 보고 사자성어 고르기 ② 사자성어를 보고 뜻 고르기 (번갈아 섞여 나옴)
 *  - 문제 자료는 같은 폴더 data.js (사자성어 · 한자 · 뜻)
 */
GoSettings.register({
  id: 'idiom',
  name: '사자성어 맞추기',
  category: 'study',
  folder: 'games/study/idiom',
  order: 42,
  tag: 'NEW',
  page: 'GoIdiom',
  w: 720, ar: 720 / 540,
  blurb: '60초 동안 뜻 보고 사자성어 고르기 · 사자성어 보고 뜻 고르기! 연속으로 맞히면 보너스. 295개 문제.',
  hero: { eyebrow: 'NEW · 공부?', title: '60초 동안', em: '사자성어 퀴즈!', desc: '고진감래, 일석이조, 청출어람… 뜻을 보고 고르거나 사자성어를 보고 뜻을 골라요. 연속으로 맞히면 점수가 쑥쑥!', cta: '사자성어 하러 가기' },
  timeLimit: 60,                       // 한 판 시간(초)
  scoreRight: 100,                     // 맞히면
  streakBonus: 20,                     // 연속으로 맞힐 때마다 더 주는 점수 (최대 10번까지)
  points: { win: 0, lose: 0 },         // 포인트 없이 랭킹만
  bgm: { file: 'bgm/bgm.mp3', volume: 0.3 }
});
