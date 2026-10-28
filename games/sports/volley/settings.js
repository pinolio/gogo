/*
 * 아바타 배구 — 게임 설정 (원작: 피카츄 배구 파이썬 게임)
 * ※ 밸런스 조정 예정: 포인트와 점수는 이 파일의 숫자만 고치면 됩니다.
 */
GoSettings.register({
  id: 'volley',
  name: '아바타 배구',
  category: 'sports',
  folder: 'games/sports/volley',
  order: 20,
  tag: 'NEW',
  board: true,                        // 대결 화면 사용 (컴퓨터 / 둘이서 한 기기)
  w: 960, ar: 960 / 540,              // 화면 크기와 가로세로 비율
  sides: '내 코트 · 상대 코트',
  vsText: '스킬을 하나 골라 시작해요',
  winScore: 15,                       // 먼저 이 점수를 내면 승리 (원작 15점)
  blurb: '내 아바타로 하는 배구. 학교 강당에서 스킬 4가지를 써서 15점을 먼저 내면 승리.',
  keys: [['A · D (←→)', '좌우 이동'], ['W (↑)', '점프'], ['G (엔터 · /)', '스킬 쓰기'], ['1~4', '경기 전 스킬 고르기'], ['휴대폰', '화면 버튼 (가로로 돌리면 크게)']],

  hero: { eyebrow: 'NEW · 스포츠', title: '내 아바타로', em: '스파이크!', desc: '학교 강당 배구 코트에서 순간이동·거대화·속박·혼란 스킬로 승부해요.', cta: '배구하러 가기' },

  points: { win: 2, lose: -1 },     // 컴퓨터에게 승리 +2P, 패배 -1P (둘이서 한 판은 기록만)
  levelScore: { easy: 100, normal: 200, hard: 300 },
  goalText() { return this.winScore + '점 먼저 내면 승리'; },
  bgm: { file: 'bgm/bgm.mp3', volume: 0.4 }
});
