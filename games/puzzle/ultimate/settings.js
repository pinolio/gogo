/*
 * Ultimate mode (이벤트) — 퍼즐512 규칙으로 2분 동안 혼자 도전, 판 위 숫자의 합이 점수
 *  - 홈 화면 맨 위 소개와 게임 목록 사이에 이벤트 칸으로 나옴 (게임 목록에는 따로 안 나옴: hidden)
 *  - 기록은 game_id 'ultimate' 로 저장 → 랭킹은 게임 화면 오른쪽과 홈 이벤트 칸에 바로 보임
 *  - 이벤트를 끝내려면 이 파일의 event: false 로 바꾸면 홈 이벤트 칸이 사라짐 (게임 화면 #ultimate 는 그대로)
 */
GoSettings.register({
  id: 'ultimate',
  name: 'Ultimate mode',
  category: 'puzzle',
  folder: 'games/puzzle/ultimate',
  order: 90,
  hidden: true,                        // 게임 목록·맨 위 소개에는 넣지 않음 (이벤트 칸으로만)
  event: true,                         // 홈 화면 이벤트 칸 보이기
  page: 'GoUltimate',
  blurb: '퍼즐512 판으로 2분 동안! 판 위 숫자를 모두 더한 값이 점수예요.',
  timeLimit: 120,                      // 한 판 시간(초)
  points: { win: 0, lose: 0 },         // 이벤트는 포인트 없이 랭킹만
  eventTitle: 'ULTIMATE MODE',
  eventDesc: '퍼즐512 판에서 2분 동안 혼자 도전! 끝났을 때 <b>판 위 숫자를 모두 더한 값</b>이 점수예요. 더 움직일 수 없으면 그 자리에서 끝나니 판이 꽉 차지 않게 조심하세요.',
  bgm: { file: '../2048/bgm/bgm.mp3', volume: 0.5 }
});
