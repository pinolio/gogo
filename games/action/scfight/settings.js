/*
 * Skillcom Fight — 게임 설정 (v45 첫 버전)
 *  - skillcom RPG 에서 키운 캐릭터의 아바타 + 레벨만 가져옴 (장비는 안 가져옴)
 *  - 3D 대결 (three.js, vendor/three.min.js). 1인칭 ↔ 3인칭 (V 키 / 화면 버튼)
 *  - 마법: 숫자 1~4 = 차지(발사 대기). 차지 중 숫자 하나 더 = 융합 차지(같은 숫자 = 강화 1+1, 다른 숫자 = 1+2)
 *          마우스 왼쪽 = 발사, 오른쪽 = 차지 취소 (휴대폰: 화면의 발사·취소 버튼)
 *  - 대기방(컴퓨터와 대결 · 온라인 방) — 1:1 또는 2:2 (2:2 는 같은 편끼리 안 맞음, 온라인은 빈자리를 컴퓨터로 채워 시작 가능) + 스킬 고르기 + 스탯 (레벨당 2포인트, 스탯마다 최대 50)
 *  - ※ 배경(경기장)·컴퓨터 상대 그림은 임시. PC 의 Skillcom 원본을 받으면 game.js 의 buildArena()·makeEnemy() 를 바꿈
 */
GoSettings.register({
  seasonWins: true,   // v75: 카드의 이번 시즌 신기록 = 이번 달 승리 수 (점수가 누적 승리 수라서)
  id: 'scfight',
  name: 'Skillcom Fight',
  category: 'action',
  folder: 'games/action/scfight',
  order: 2,
  top: 2,                              // v130 메인 화면 맨 앞 (블록 대전보다 앞)
  // v199 선생님 11/24: RPG 전투 업그레이드 7단계 끝 → '베타테스트' 표시와 카드 기록 '추후 예정' 뗌 (기록 = 이긴 수)
  page: 'GoSCFight',
  w: 960, ar: 960 / 540,
  blurb: 'RPG 에서 키운 능력치·마법 그대로 겨루는 3D 마법 대결! 1~4 · QWER 로 바로 쏘고, RPG 에서 이긴 보스와 다시 싸워요!',
  keys: [['S Z X C', '앞 · 왼쪽 · 뒤 · 오른쪽 (방향키도 돼요)'], ['마우스 · 화면 끌기', '둘러보기 (화면을 누르면 마우스 고정, Esc 로 풀기)'], ['1 2 3 4', '기본 마법'], ['Q W E R', '융합 마법'], ['마우스 왼쪽', '기본 공격 (누르고 있으면 계속)'], ['F · G', '체력 물약 · 마나 물약'], ['Space', '대시'], ['B', '1인칭 ↔ 3인칭']],
  hero: { eyebrow: '3D 대결', title: 'RPG 에서 키운 캐릭터로', em: 'Skillcom Fight!', desc: 'RPG 능력치와 마법 8칸 그대로! 1~4 · QWER 로 마법을 쏘고, 컴퓨터나 친구와 1:1 · 2:2, RPG 에서 이긴 보스와도 겨뤄요.', cta: '대결하러 가기' },

  levelFrom: 'rpg',                   // 레벨을 가져올 게임 (skillcom RPG)
  statPerLevel: 2,                    // 레벨당 스탯 포인트
  statMax: 50,                        // 스탯마다 최대
  points: { win: 1, lose: 0 },        // 이기면 +1P (로그인한 사람)
  roundHp: 100,                       // 기본 체력 (레벨·체력 스탯으로 늘어남)
  scoreText(score) { return score ? score + '승' : '-'; },
  bgm: { file: 'bgm/bgm.mp3', volume: 0.35 }
});
