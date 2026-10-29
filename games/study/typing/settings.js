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
  blurb: '하늘에서 떨어지는 낱말을 바닥에 닿기 전에 입력! 단계가 오를수록 빨라지고 속담도 나와요. 타수·정확도 측정.',
  hero: { eyebrow: 'NEW · 공부?', title: '떨어지는 낱말을', em: '타자로 막아라!', desc: '낱말이 바닥에 닿기 전에 입력하고 Enter! 단계가 오를수록 빨라져요. 내 분당 타수도 알려 줘요.', cta: '타자연습 하러 가기' },
  lives: 5,                            // 바닥에 닿아도 되는 횟수
  levelEvery: 12,                      // 이 개수만큼 없애면 다음 단계
  points: { win: 0, lose: 0 },         // 포인트 없이 랭킹만
  bgm: { file: 'bgm/bgm.mp3', volume: 0.3 }
});
