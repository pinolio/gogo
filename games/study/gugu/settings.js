/*
 * 신호등 구구단 — 게임 설정 (공부? 분류 · 홈 이벤트 칸)  v79 (2026-11-06 관리자 '테스트 게임'에서 정식으로 내보냄)
 *  - 녹색불이면 바른 답, 빨간불이면 십의 자리·일의 자리를 바꾼 답. 맞으면 +1점, 틀리면 −1점, 45초
 *  - 화면·규칙 코드는 js/testgames.js 의 gugu() 를 그대로 씀 (숫자 GUGU = { sec, redRatio } 도 거기)
 *  - 기록 game_id 'gugu' → 랭킹·카드 3줄·시즌 1위 +50P 대상
 *  - 이벤트를 끝내려면 event: false (홈 이벤트 칸만 사라지고 공부? 목록에는 그대로)
 */
GoSettings.register({
  id: 'gugu',
  name: '신호등 구구단',
  category: 'study',
  folder: 'games/study/gugu',
  order: 45,
  tag: 'NEW',
  page: 'GoGugu',
  event: true,                         // 홈 화면 이벤트 칸 (예전 Ultimate mode 자리)
  eventTitle: '신호등 구구단',
  eventDesc: '<b>녹색불</b>이면 구구단 바른 답, <b>빨간불</b>이면 답의 <b>십의 자리와 일의 자리를 바꿔서!</b> (4×6 → 42) 45초 동안 맞으면 +1점, 틀리면 −1점. <b>10점마다 +1P</b> (한 판 최대 3P)',
  blurb: '녹색불이면 바른 답, 빨간불이면 자리를 바꾼 답! 45초 동안 구구단 타임어택. 10점마다 +1P.',
  pointsPer: 10, maxPoints: 3,         // 점수 pointsPer 점마다 +1P, 한 판 최대 maxPoints
  bgm: { file: '../../puzzle/battle/bgm/bgm.mp3', volume: 0.45 }   // 블록 대전과 같은 곡 「Block Rush」 (선생님 11/05)
});
