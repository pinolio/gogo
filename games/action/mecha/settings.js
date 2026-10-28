/*
 * 메카 대전 — 게임 설정 (선생님이 예전에 하던 온라인 로봇 대전 게임 방식을 참고해 새로 만든 게임)
 * ※ 밸런스 조정: 로봇 능력치·무기 숫자는 game.js 맨 위 ROBOTS 표, 시간·포인트는 이 파일에서 고칩니다.
 */
GoSettings.register({
  id: 'mecha',
  name: '메카 대전',
  category: 'action',
  folder: 'games/action/mecha',
  order: 22,
  tag: 'NEW',
  board: true,                        // 대결 화면 사용
  noLocal: true,                      // 오프라인(한 기기) 없음: AI 대전 · 온라인만
  players: [2, 4], teamLabels: { 2: '1:1', 4: '2:2' },
  online: true, netRoom: true,        // 온라인: 최대 4명, 빈자리는 방장 기기의 컴퓨터
  w: 960, ar: 960 / 540,
  sides: '우리 팀 · 상대 팀',
  vsText: '로봇을 하나 골라 시작해요',
  timeLimit: 120,                     // 한 판 시간(초). 끝나면 남은 체력(%) 합이 많은 팀 승리
  blurb: '로봇 12종 중 하나를 골라 우주 경기장에서 싸워요. 무기 3개를 모아 쏘고, 부스터로 피하세요! (1:1 · 2:2)',
  keys: [['W A S D 또는 방향키', '이동 (미끄러지듯 움직여요)'], ['Shift 또는 Space', '부스터 (에너지 사용)'], ['J · K · L 또는 1 · 2 · 3', '무기 1 근접 · 2 원거리 · 3 특수'], ['무기 키 꾹 누르기', '힘 모으기 (3단계)'], ['카드 클릭 · 방향키+Enter · 1~9·0·-·= (시작 전)', '로봇 고르기'], ['휴대폰', '화면 버튼 (가로로 돌리면 크게)']],

  hero: { eyebrow: 'NEW · 액션', title: '로봇을 골라', em: '메카 대전!', desc: '빠른 볼트부터 불꽃 블레이즈, 숨는 팬텀, 포탑 스파이더까지 로봇 12종! 무기 3개를 모아 쏘며 1:1·2:2로 싸워요.', cta: '출격하기' },

  points: { win: 2, lose: -1 },       // 컴퓨터·온라인 승리 +2P, 패배 -1P, 무승부 0P
  levelScore: { easy: 100, normal: 200, hard: 300 },
  goalText() { return '상대 로봇을 모두 쓰러뜨리기 (시간 끝나면 남은 체력 많은 팀)'; },
  bgm: { file: 'bgm/bgm.mp3', volume: 0.4 }
});
