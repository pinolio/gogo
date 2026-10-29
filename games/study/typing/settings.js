/*
 * 한글 타자연습 — 게임 설정 (공부? 분류)
 *  - 위에서 떨어지는 낱말을 바닥에 닿기 전에 입력해서 없애는 게임 (예전 '산성비' 방식)
 *  - 혼자 도전 · 랭킹. 포인트 없음. 낱말은 같은 폴더 words.txt, 높은 단계에서는 속담도 나옴(game.js)
 */
GoSettings.register({
  id: 'typing',
  name: '한글 타자연습',
  category: 'study',
  folder: 'games/study/typing',
  order: 41,
  tag: 'NEW',
  page: 'GoTyping',
  w: 720, ar: 720 / 540,
  blurb: '하늘에서 떨어지는 낱말을 바닥에 닿기 전에 입력! 단계가 오를수록 빨라지고, 빨간 낱말은 더 빨리 떨어져요. 속담도 나와요. 타수·정확도 측정.',
  hero: { eyebrow: 'NEW · 공부?', title: '떨어지는 낱말을', em: '타자로 막아라!', desc: '낱말이 바닥에 닿기 전에 입력하고 Enter! 단계가 오를수록 빨라져요. 내 분당 타수도 알려 줘요.', cta: '타자연습 하러 가기' },
  lives: 5,                            // 바닥에 닿아도 되는 횟수
  /* ---- 난이도 (v34: 선생님 의견 "너무 쉬워" → 시작부터 빠르고 긴 낱말, 4단계부터 빨리 떨어지는 빨간 낱말) ----
   * 시뮬레이터(분당 타수별 평균): 예전 350타 130초·5.9단계 → 지금 83초·4.4단계 / 500타 147초·6.9단계 → 105초·6.1단계
   * 더 어렵게: speed 를 키우거나 gap 을 줄임. 더 쉽게: 반대로. (예전 값: levelEvery 12, speed 22·8·8, gap 2.4·0.17·0.75, fastWord 없음, 속담 6단계) */
  levelEvery: 10,                      // 이 개수만큼 없애면 다음 단계 (예전 12)
  speed: { base: 28, perLevel: 8, random: 10 },     // 떨어지는 빠르기(화면 점/초) = base + 단계 × perLevel + 0~random
  gap: { start: 2.1, perLevel: 0.14, min: 0.7 },    // 새 낱말이 나오는 간격(초) = start − 단계 × perLevel (최소 min)
  fastWord: { from: 4, chance: 0.15, mul: 1.5 },    // from 단계부터 chance 확률로 mul 배 빨리 떨어지는 빨간 낱말
  proverbFrom: 5,                      // 이 단계부터 속담이 섞여 나옴 (예전 6)
  points: { win: 0, lose: 0 },         // 포인트 없이 랭킹만
  bgm: { file: 'bgm/bgm.mp3', volume: 0.3 }
});
