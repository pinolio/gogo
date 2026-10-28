/*
 * 일단 덤벼 — 게임 설정 (원작: 대난투 격투 게임 파이썬 게임)
 * ※ 밸런스 조정 예정: 포인트와 점수는 이 파일의 숫자만 고치면 됩니다.
 */
GoSettings.register({
  id: 'fight',
  name: '일단 덤벼',
  category: 'sports',
  folder: 'games/sports/fight',
  order: 21,
  tag: 'NEW',
  board: true,                        // 대결 화면 사용 (컴퓨터 / 둘이서 한 기기)
  w: 960, ar: 960 / 540,
  sides: '1P · 2P',
  vsText: '스킬을 하나 골라 시작해요',
  timeLimit: 99,                      // 한 판 시간(초). 끝나면 체력이 많은 쪽 승리
  blurb: '내 아바타로 하는 1:1 격투. 팔·다리 공격과 스킬로 상대 체력을 먼저 0으로!',
  keys: [['A · D', '좌우 이동 (뒤로 누르면 막기)'], ['W / S', '점프 / 아래'], ['G / H', '팔 공격 / 다리 공격'], ['아래+팔 · 아래 두 번 · 공중 위 두 번', '스킬 (고른 것만)'], ['2P', '방향키 + K · L (숫자패드 1 · 2)'], ['휴대폰', '화면 버튼 (가로로 돌리면 크게)']],

  hero: { eyebrow: 'NEW · 스포츠', title: '내 아바타가', em: '일단 덤벼!', desc: '학교 옥상에서 펼치는 1:1 격투. 막기와 스킬을 잘 써야 이겨요.', cta: '싸우러 가기' },

  points: { win: 2, lose: -1 },     // 컴퓨터에게 승리 +2P, 패배 -1P, 무승부 0P
  levelScore: { easy: 100, normal: 200, hard: 300 },
  goalText() { return '상대 체력을 0으로 (시간 끝나면 체력 많은 쪽)'; },
  bgm: { file: 'bgm/bgm.mp3', volume: 0.4 }
});
