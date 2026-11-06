/*
 * skillcom RPG (RPG) — 게임 데이터 (지도 · 몬스터 · 장비 · 포션 · 마법)
 *  ※ 숫자를 고치면 바로 게임에 반영됩니다. 밸런스 조정은 이 파일에서 합니다.
 *
 *  세계 구조 (총 99칸: 마을 9 + 사냥터 90)
 *    마을1 → 사냥터 1~10 → 마을2 → 사냥터 11~20 → … → 마을9(도원수 진영) → 사냥터 81~90
 *    · 마을 1~8 은 10레벨씩: 사냥터 권장 레벨 1씩 (마을1 = Lv.1~10, 마을2 = Lv.11~20 … 마을8 = Lv.71~80)
 *    · 마을 9 는 80 → 100: 사냥터 권장 레벨 2씩 (Lv.82 … Lv.100)
 *    · 만렙 100
 *    · 마을마다: 약방(포션) · 도술 서원(마법 사기·융합) · 이장 댁(귀환 장소 · 마을/사냥터 이동)
 *    · v47 임진왜란 분위기: 마을·사냥터 이름을 조선풍으로, 몬스터에 왜군·조선 요괴(도트)를 섞음, 건물은 Skillcom 원본 Meshy 3D(관아·문루·정자)를 찍은 그림
 *    · 마지막 마을(9)에는 성 (나중에 퀘스트를 나눠 주는 곳 · 지금은 '준비 중')
 *
 *  ※ 마법(SKILLS · FUSION)은 skillcom(마법 융합 RPG)의 마법을 받기 전 '임시' 목록입니다.
 *     skillcom 폴더를 연결하면 이 표만 바꿔 끼우면 됩니다. (game.js 는 kind 종류만 알면 됨)
 */
(function () {
  'use strict';
  const MAX_LV = 100;

  /* ---------------- 지역 (마을 9개) ----------------
   *  lv: [이 지역 사냥터 권장 레벨 시작, 끝] — 마을 1~8 은 10레벨씩(사냥터마다 +1), 마을 9 는 80→100(사냥터마다 +2)
   *  ground: 땅 색 2가지, block·block2: 장애물 종류, deco: 꽃·풀 색 */
  const REGIONS = [
    { name: '솔뫼 마을', short: '솔뫼', ground: ['#7CC66A', '#6DB85C'], path: '#D8C08A', block: 'tree', block2: 'rock', deco: ['#FFE45C', '#FF8AB0', '#FFFFFF'], water: '#4FA8E8', sky: '#BFE6FB',
      fields: ['보리밭 들판', '토끼 언덕', '민들레 둑길', '개울 빨래터', '버섯 솔숲', '숯막 터', '이끼 굴 어귀', '장승 고개', '돌다리 밑', '큰 슬라임 둥지'] },
    { name: '대숲 마을', short: '대숲', ground: ['#4E9E58', '#438F4D'], path: '#B99A66', block: 'pine', block2: 'rock', deco: ['#B8F28A', '#FFD23F', '#9AE6FF'], water: '#3A8FD0', sky: '#A9DCC0',
      fields: ['대숲 입구', '덩굴 오솔길', '반딧불 연못', '부엉이 고목', '여우 골짜기', '사냥꾼 움막', '쓰러진 고목', '왜군 척후 진지', '서낭당 터', '숲의 수호자'] },
    { name: '갈대늪 나루', short: '나루', ground: ['#5E7A4A', '#55703F'], path: '#8A7A55', block: 'deadtree', block2: 'mossrock', deco: ['#C8E08A', '#9AD8C0', '#E8D8FF'], water: '#4A7A6A', sky: '#B8C8B0',
      fields: ['젖은 갈대밭', '개구리 연못', '썩은 나무다리', '도깨비불 늪', '안개 낀 수렁', '무당집 터', '거머리 웅덩이', '뿌리 동굴', '버려진 나루터', '늪의 여왕 둥지'] },
    { name: '모래톱 포구', short: '포구', ground: ['#E8C878', '#DDB866'], path: '#C9A05A', block: 'cactus', block2: 'sandrock', deco: ['#B5842F', '#F5E2A8', '#7FB24A'], water: '#3BB0C9', sky: '#FBE6B8',
      fields: ['뜨거운 모래톱', '갯바위 길', '소금밭', '해골 협곡', '왜선 상륙지', '무너진 봉수대', '전갈 굴', '바람 깎인 바위', '왜군 해안 진지', '모래 왕의 무덤'] },
    { name: '돌산성 마을', short: '산성', ground: ['#A8957A', '#9C8A70'], path: '#C8B48E', block: 'pine', block2: 'rock', deco: ['#E8E0C8', '#8AB86A', '#FFD23F'], water: '#5A9AD0', sky: '#D8D0C0',
      fields: ['자갈 고갯길', '광부의 길', '낙석 지대', '독수리 절벽', '버려진 광산', '산성 남문', '동굴 거미 굴', '바위 정령 터', '용암 틈새', '바위산의 왕'] },
    { name: '눈고개 진영', short: '눈고개', ground: ['#E8F2FB', '#D6E6F5'], path: '#B9CCE0', block: 'snowpine', block2: 'ice', deco: ['#FFFFFF', '#9FD8F5', '#C8B8FF'], water: '#6FC3F0', sky: '#D8ECFF',
      fields: ['눈 덮인 길', '얼어붙은 강', '고드름 동굴', '설인 발자국', '눈보라 고개', '얼음 성벽 터', '왜군 겨울 진지', '빙하 틈', '오로라 언덕', '얼음 여왕의 홀'] },
    { name: '용굴 마을', short: '용굴', ground: ['#4A3E6A', '#423760'], path: '#6E6090', block: 'crystal', block2: 'rock', deco: ['#C8A8FF', '#7FE0F0', '#FF9AE0'], water: '#5A4AB0', sky: '#2A2440',
      fields: ['반짝이는 굴 입구', '보라 수정길', '메아리 동굴', '지하 호수', '여우 굴', '수정 광맥', '왜군 첩자 은신처', '그림자 통로', '수정 심장부', '수정 골렘의 방'] },
    { name: '구름절 마을', short: '구름절', ground: ['#9EE0A8', '#90D49A'], path: '#F0E6D0', block: 'blossom', block2: 'cloudrock', deco: ['#FFFFFF', '#FFB3D1', '#FFE45C'], water: '#8AD0FF', sky: '#CFEFFF',
      fields: ['구름 계단', '벚꽃 절터', '무지개 다리', '바람의 법당', '떠다니는 정원', '천둥 구름길', '깃털 둥지', '별빛 전망대', '왜장 본진', '폭풍 거인'] },
    { name: '도원수 진영', short: '진영', ground: ['#5A4A4A', '#4E3F3F'], path: '#8A6A5A', block: 'lavarock', block2: 'deadtree', deco: ['#FF6A3D', '#FFB13D', '#8A2B2B'], water: '#FF5A2A', sky: '#3A2430', castle: true,
      fields: ['재 날리는 길', '불타는 강가', '화산 어귀', '검은 바위 숲', '마그마 동굴', '불타는 왜성 외벽', '용의 둥지', '어둠의 제단', '왜성 정문', '흑룡의 왕좌'] }
  ];
  // 사냥터 권장 레벨: 지역 ri 의 k번째(0~9) 사냥터
  const recOf = (ri, k) => (ri < 8 ? ri * 10 + k + 1 : 80 + (k + 1) * 2);
  const LV_RANGE = REGIONS.map((R, ri) => [recOf(ri, 0), recOf(ri, 9)]);   // [[1,10], [11,20] … [71,80], [82,100]]

  /* ---------------- 몬스터 모양 (12 × 12 도트) ----------------
   *  a = 몸 색, b = 진한 색, c = 밝은 색, d = 무늬 색, e = 흰자, k = 검정 */
  const SHAPES = {
    slime: [
      '............',
      '............',
      '....kkkk....',
      '..kkccaakk..',
      '.kcaaaaaaak.',
      '.kaaaaaaaak.',
      'kaaekaaekaak',
      'kaakkaakkaak',
      'kaaaaaaaaaak',
      'kbaaaaaaaabk',
      '.kbbbbbbbbk.',
      '..kkkkkkkk..'],
    mushroom: [
      '...kkkkkk...',
      '..kaaddaak..',
      '.kaddaaadak.',
      'kaaaaadaaaak',
      'kdaaaaaaaddk',
      'kkkkkkkkkkkk',
      '...kcccck...',
      '...kekekk...',
      '...kcccck...',
      '...kcccck...',
      '..kbccccbk..',
      '..kkkkkkkk..'],
    bat: [
      '............',
      'k..........k',
      'kk...kk...kk',
      'kak.kaak.kak',
      'kaakaaaakaak',
      'kaaaekekaaak',
      'kbaaakkaaabk',
      '.kbaaddaabk.',
      '..kbaaaabk..',
      '...kk..kk...',
      '............',
      '............'],
    beast: [
      '............',
      '.kk.....kk..',
      '.kak...kak..',
      '.kaakkkaak..',
      'kaaaaaaaaak.',
      'kaekaaaekak.',
      'kaakaaakkakk',
      '.kaaddaaaaak',
      '.kaaaaaaaaak',
      '.kbkbkkbkbk.',
      '.kbk....kbk.',
      '.kk......kk.'],
    golem: [
      '...kkkkkk...',
      '..kccaaaak..',
      '..kaekaeka..',
      '..kaaaaaak..',
      'kkkkaaaakkkk',
      'kaabaaaabaak',
      'kaakaddakaak',
      'kbbkaaaakbbk',
      'kkkkaaaakkkk',
      '...kakkak...',
      '..kbak.kbak.',
      '..kkkk.kkkk.'],
    skeleton: [
      '...kkkkkk...',
      '..kcccccck..',
      '..kckkckkck.',
      '..kcccccck..',
      '...kckckk...',
      '..kkccccckk.',
      '.kckcdcckck.',
      '.kk.kcccc.kk',
      '....kccck...',
      '...kck.kck..',
      '...kck.kck..',
      '..kkk..kkk..'],
    ghost: [
      '...kkkkkk...',
      '..kccaaaak..',
      '.kcaaaaaaak.',
      '.kaekaaekak.',
      '.kakkaakkak.',
      '.kaaaddaaak.',
      'kaaaaaaaaaak',
      'kaaaaaaaaaak',
      'kbaaaaaaaabk',
      'kbabaabaabak',
      'kk.kk.kk.kk.',
      '............'],
    scorpion: [
      '........kkk.',
      '.......kaak.',
      '..........ak',
      'kk.......kak',
      'kak.kkkkkak.',
      '.kkkaaaaak..',
      '..kaekaekak.',
      '.kaaaddaaaak',
      'kbaaaaaaaabk',
      'k.kbkbkbkb.k',
      '..k.k.k.k...',
      '............'],
    plant: [
      '.....kk.....',
      '....kcck....',
      '..kkkaakkk..',
      '.kaaaaaaaak.',
      'kaekaddaekak',
      'kakkaaaakkak',
      '.kaaaaaaaak.',
      '..kkbbbbkk..',
      'kk..kbbk..kk',
      'kak.kbbk.kak',
      '.kakkbbkkak.',
      '..kkkkkkkk..'],
    imp: [
      'k..........k',
      'kk..kkkk..kk',
      '.kkkaaaakkk.',
      '..kaaaaaak..',
      '..kekaaekk..',
      '..kakaakak..',
      '.kkaaddaakk.',
      'kaakaaaakaak',
      'k.kaaaaaak.k',
      '...kbaabk...',
      '..kbk..kbk..',
      '..kk....kk..'],
    // ── v47 임진왜란: 왜군 (삿갓 · 갑옷) · 조선 요괴 (구미호 · 장승) — Meshy 그림 없이 도트로 그림 ──
    //    d = 삿갓·투구색, c = 얼굴, a = 갑옷, b = 바지, e = 창끝·눈
    ashigaru: [
      '....kkkk...e',
      '..kkddddkk.e',
      'kkddddddddkb',
      '..kccccck..b',
      '..kckcckk..b',
      '...kcccck..b',
      '..kaaaaaakkb',
      '.kaadaadaacb',
      '.kaaaaaaak.b',
      '..kbbbbbk..b',
      '..kbk.kbk..b',
      '..kk...kk...'],
    gunner: [
      '....kkkk....',
      '..kkddddkk..',
      'kkddddddddkk',
      '..kccccck...',
      '..kckcckk...',
      '...kcccck...',
      '..kaaaaaak..',
      '.kaaaaacbbbb',
      '.kaadaadak..',
      '..kbbbbbk...',
      '..kbk.kbk...',
      '..kk...kk...'],
    samurai: [
      'e..kkkkkk..e',
      'ek.kddddk.ke',
      '.kkddddddkk.',
      'kddkcccckddk',
      '.k.kckkck.k.',
      '...kcccck...',
      '.kkaaaaaakk.',
      'kdaaadaaaadk',
      'kaaaaaaaaaak',
      '.kdbbbbbbdk.',
      '..kbbk.kbbk.',
      '..kkk..kkk..'],
    gumiho: [
      '.kk....kk.kk',
      'kaak..kaakdk',
      'kaakkkkaakdk',
      '.kaaaaaaakdk',
      '.kaeaaaeakdk',
      '.kaaacaaakdk',
      '..kaccccakk.',
      '..kaaaaaak..',
      '.kaacaacaak.',
      '.kaacaacaak.',
      '.kbbk..kbbk.',
      '.kkk....kkk.'],
    jangseung: [
      '...kkkkkk...',
      '..kddddddk..',
      '..kddddddk..',
      '.kkaaaaaakk.',
      '.kaekaaekak.',
      '.kaaaccaaak.',
      '.kaaccccaak.',
      '.kakkkkkkak.',
      '.kaekeekeak.',
      '..kaaaaaak..',
      '..kbbbbbbk..',
      '..kkkkkkkk..'],
    dragon: [
      '.k........k.',
      'kak..kk..kak',
      'kaak.kaak.ak',
      '.kaakkaakaak',
      '..kaaaaaaak.',
      '.kaekaaaaak.',
      'kaakkaaddaak',
      'kccaaaadddak',
      '.kkaaaaaaabk',
      '..kbaakbaak.',
      '..kbk..kbk..',
      '..kk....kk..']
  };

  // 지역별 몬스터 10종: [이름, 모양, 몸색, 진한색, 밝은색, 무늬색, 성질]
  //  성질: 'calm' = 먼저 공격하지 않음, 'aggro' = 가까이 가면 달려옴, 'shoot' = 멀리서 쏨
  const MON = [
    [['초록 슬라임', 'slime', '#6BD86B', '#3E9E45', '#C8F7B8', '#FFFFFF', 'calm'], ['아기 토끼버섯', 'mushroom', '#FF8A8A', '#C94F4F', '#FFF1E0', '#FFFFFF', 'calm'], ['노랑 꽃잎몬', 'plant', '#FFD23F', '#C99A1A', '#FFF3A8', '#FF7EB6', 'calm'], ['왜군 척후병', 'ashigaru', '#8A3A2A', '#4A2A20', '#F0C8A0', '#5A5A62', 'aggro'], ['보라 독버섯', 'mushroom', '#A66BFF', '#6F3FC0', '#F0E6FF', '#FFE45C', 'aggro'], ['들쥐 무리', 'beast', '#B08A6A', '#7A5A42', '#E8D2BC', '#FFB3C7', 'aggro'], ['동굴 박쥐', 'bat', '#6A6A8A', '#44445E', '#B8B8D8', '#FF5A5F', 'aggro'], ['장승 요괴', 'jangseung', '#B08A5A', '#6A4A2A', '#D8B080', '#2A2A2A', 'calm'], ['다리 밑 도깨비', 'imp', '#6BA86B', '#3E6B3E', '#B8E0B8', '#FFD23F', 'aggro'], ['거대 슬라임 왕', 'slime', '#3ED87A', '#1E8A48', '#B8F7D0', '#FFD23F', 'boss']],
    [['숲 늑대', 'beast', '#8A8A9A', '#5A5A6A', '#D0D0DC', '#FFFFFF', 'aggro'], ['덩굴 식물', 'plant', '#5AC85A', '#2E8A3A', '#B8F0A8', '#FF5A5F', 'shoot'], ['반딧불 정령', 'ghost', '#E8FF8A', '#A8C040', '#FFFFE0', '#5AE88A', 'shoot'], ['부엉이 박쥐', 'bat', '#8A6A4A', '#5A4230', '#D8C0A0', '#FFD23F', 'aggro'], ['구미호', 'gumiho', '#F0E8E0', '#B8A8A0', '#FFFFFF', '#FF8A3D', 'aggro'], ['왜군 조총병', 'gunner', '#8A3A2A', '#4A2A20', '#F0C8A0', '#5A5A62', 'shoot'], ['고목 골렘', 'golem', '#8A6A42', '#5A4228', '#C8A878', '#5AC85A', 'aggro'], ['왜군 창병', 'ashigaru', '#8A3A2A', '#4A2A20', '#F0C8A0', '#5A5A62', 'aggro'], ['바람 정령', 'imp', '#9AE6FF', '#5AA8D0', '#E0F8FF', '#FFFFFF', 'shoot'], ['숲의 수호 골렘', 'golem', '#4E9E58', '#2E6A36', '#9AD8A0', '#FFD23F', 'boss']],
    [['늪 슬라임', 'slime', '#7A9A5A', '#4E6A36', '#C8E0A8', '#FFFFFF', 'aggro'], ['왜군 척후대', 'ashigaru', '#3A4260', '#22283E', '#F0C8A0', '#4A4A52', 'aggro'], ['늪 덩굴', 'plant', '#6A8A3A', '#3E5A1E', '#B8D08A', '#FF7EB6', 'shoot'], ['도깨비불', 'ghost', '#9AFFD8', '#4AC8A0', '#E8FFF8', '#3E6BFF', 'shoot'], ['진흙 들개', 'beast', '#7A6A4A', '#4E4230', '#C8B898', '#9AD8C0', 'aggro'], ['잿빛 여우 요괴', 'gumiho', '#9A9AA8', '#5E5E6E', '#E0E0E8', '#9AFFD8', 'aggro'], ['거머리 벌레', 'scorpion', '#4A5A3A', '#2A361E', '#8AA070', '#FF5A5F', 'aggro'], ['뿌리 골렘', 'golem', '#6A5A3A', '#423820', '#A89870', '#5AC85A', 'aggro'], ['왜군 조총병', 'gunner', '#3A4260', '#22283E', '#F0C8A0', '#4A4A52', 'shoot'], ['늪의 여왕 슬라임', 'slime', '#4ED8A0', '#1E8A60', '#C8FFE8', '#C8A8FF', 'boss']],
    [['모래 슬라임', 'slime', '#E8B860', '#B08030', '#FFF0C8', '#FFFFFF', 'aggro'], ['왜군 상륙병', 'ashigaru', '#8A3A2A', '#4A2A20', '#F0C8A0', '#5A5A62', 'aggro'], ['바닷가 장승', 'jangseung', '#A07850', '#5A3E22', '#D0A878', '#2A2A2A', 'shoot'], ['협곡 해골', 'skeleton', '#F0E8D0', '#B0A080', '#FFFFFF', '#D2343A', 'aggro'], ['모래 늑대', 'beast', '#D8A860', '#A07838', '#F5DCA8', '#5A3A20', 'aggro'], ['왜군 조총수', 'gunner', '#8A3A2A', '#4A2A20', '#F0C8A0', '#5A5A62', 'shoot'], ['사막 전갈', 'scorpion', '#C86A3A', '#8A4220', '#F0A878', '#FFD23F', 'aggro'], ['모래 도깨비', 'imp', '#D89A5A', '#A06A32', '#F5D0A0', '#3BC8F5', 'shoot'], ['미라 해골', 'skeleton', '#E0D8B8', '#A89870', '#FFFFF0', '#7E4DE0', 'aggro'], ['모래 왕 전갈', 'scorpion', '#FFD23F', '#B08A1A', '#FFF3A8', '#D2343A', 'boss']],
    [['자갈 슬라임', 'slime', '#A8A098', '#706860', '#E0D8D0', '#FFFFFF', 'aggro'], ['광부 도깨비', 'imp', '#C89A6A', '#8A6A42', '#F0D0A8', '#FFD23F', 'shoot'], ['산성 장승', 'jangseung', '#8A7A6A', '#5A4E42', '#C8B8A8', '#2A2A2A', 'calm'], ['절벽 독수리', 'bat', '#8A6A4A', '#5A4230', '#E8D8C0', '#FFD23F', 'aggro'], ['산양', 'beast', '#E8E0D0', '#A8A090', '#FFFFFF', '#8A6A4A', 'aggro'], ['왜군 조총대', 'gunner', '#3A4260', '#22283E', '#F0C8A0', '#4A4A52', 'shoot'], ['동굴 거미', 'scorpion', '#5A4A3A', '#36281E', '#9A8A78', '#FF5A5F', 'aggro'], ['왜군 돌격대', 'ashigaru', '#3A4260', '#22283E', '#F0C8A0', '#4A4A52', 'aggro'], ['용암 도마뱀', 'dragon', '#C8602A', '#8A3A18', '#F0A070', '#FFD23F', 'aggro'], ['바위산 거인', 'golem', '#7A7068', '#4A4440', '#B8B0A8', '#FF6A3D', 'boss']],
    [['눈 슬라임', 'slime', '#E8F4FF', '#A8C8E8', '#FFFFFF', '#5AB8F5', 'aggro'], ['얼음 박쥐', 'bat', '#8AC8F0', '#4A88C0', '#D8F0FF', '#FFFFFF', 'aggro'], ['고드름 정령', 'ghost', '#B8E8FF', '#6AA8D8', '#FFFFFF', '#3E6BFF', 'shoot'], ['설산 구미호', 'gumiho', '#F4F8FF', '#A8C0E0', '#FFFFFF', '#5AB8F5', 'aggro'], ['눈보라 도깨비', 'imp', '#C8D8F0', '#8898C0', '#F0F4FF', '#3BC8F5', 'shoot'], ['얼음 골렘', 'golem', '#8AD0F0', '#4A90C0', '#D8F4FF', '#FFFFFF', 'aggro'], ['왜군 조총병', 'gunner', '#5A6A8A', '#344058', '#F0C8A0', '#4A4A52', 'shoot'], ['빙하 전갈', 'scorpion', '#6AB0E0', '#3A70A8', '#C8E8FF', '#FFFFFF', 'aggro'], ['왜장 무사', 'samurai', '#6A6A80', '#3A3A4E', '#F0C8A0', '#D2343A', 'aggro'], ['얼음 여왕 골렘', 'golem', '#C8F0FF', '#6AA8D8', '#FFFFFF', '#7E4DE0', 'boss']],
    [['수정 슬라임', 'slime', '#C8A8FF', '#8A6AD0', '#F0E8FF', '#FFFFFF', 'aggro'], ['빛 버섯', 'mushroom', '#7FE0F0', '#3EA0B8', '#E0FAFF', '#FF9AE0', 'calm'], ['메아리 박쥐', 'bat', '#6A5AA0', '#40367A', '#B0A8E0', '#7FE0F0', 'aggro'], ['보라 구미호', 'gumiho', '#C8A8FF', '#7A5AC0', '#F0E8FF', '#FF9AE0', 'aggro'], ['수정 늑대', 'beast', '#A8B8F0', '#6878C0', '#E8F0FF', '#C8A8FF', 'aggro'], ['왜군 첩자', 'ashigaru', '#2A2A36', '#16161E', '#F0C8A0', '#5A5A62', 'aggro'], ['그림자 도깨비', 'imp', '#3A3060', '#201A3E', '#7A70A8', '#FF9AE0', 'shoot'], ['왜장 무사', 'samurai', '#4A3A6A', '#2A2040', '#F0C8A0', '#FFD23F', 'aggro'], ['자수정 용', 'dragon', '#9A6AE0', '#5E3AA0', '#D8C0FF', '#7FE0F0', 'aggro'], ['수정 골렘 왕', 'golem', '#B8A0FF', '#7058C8', '#F0E8FF', '#7FE0F0', 'boss']],
    [['구름 슬라임', 'slime', '#F3F6FF', '#B8C4E0', '#FFFFFF', '#8AD0FF', 'calm'], ['벚꽃 정령', 'plant', '#FFB3D1', '#D07098', '#FFE8F2', '#FFFFFF', 'shoot'], ['무지개 박쥐', 'bat', '#8AD0FF', '#4A90C8', '#E0F4FF', '#FFE45C', 'aggro'], ['왜군 조총대장', 'gunner', '#7A2A2A', '#4A1A1A', '#F0C8A0', '#FFD23F', 'shoot'], ['하늘 구미호', 'gumiho', '#FFD8A8', '#D0A070', '#FFF4E0', '#FF7EB6', 'aggro'], ['천둥 도깨비', 'imp', '#FFE45C', '#C8A82A', '#FFF8C0', '#4C7DFF', 'shoot'], ['깃털 그리핀', 'dragon', '#E8D0A0', '#A8905A', '#FFF4D8', '#FFFFFF', 'aggro'], ['별빛 유령', 'ghost', '#D8E0FF', '#9098D0', '#FFFFFF', '#FFE45C', 'shoot'], ['왜장 대장', 'samurai', '#8A2B2B', '#4A1414', '#F0C8A0', '#FFD23F', 'aggro'], ['폭풍 거인', 'golem', '#7A8AB0', '#465478', '#C0CCE8', '#FFE45C', 'boss']],
    [['왜군 정예병', 'ashigaru', '#2A2A36', '#16161E', '#F0C8A0', '#D2343A', 'aggro'], ['용암 박쥐', 'bat', '#8A2B2B', '#5A1A1A', '#E06A5A', '#FFB13D', 'aggro'], ['불꽃 정령', 'ghost', '#FFB13D', '#E0661E', '#FFF0C0', '#FF3D2A', 'shoot'], ['왜군 조총 정예', 'gunner', '#2A2A36', '#16161E', '#F0C8A0', '#D2343A', 'shoot'], ['마그마 골렘', 'golem', '#6A3A2A', '#3A1E14', '#E0661E', '#FFD23F', 'aggro'], ['불타는 해골', 'skeleton', '#E8D8C8', '#A08878', '#FFFFFF', '#FF5A2A', 'shoot'], ['새끼 용', 'dragon', '#D2343A', '#8A1E22', '#FF8A80', '#FFD23F', 'aggro'], ['어둠 도깨비', 'imp', '#5A3A7A', '#36204E', '#A880D0', '#FF3D2A', 'shoot'], ['왜성 수문장', 'samurai', '#1E1E26', '#0E0E14', '#F0C8A0', '#D2343A', 'aggro'], ['흑룡 이무기', 'dragon', '#3A1E4A', '#1E0E28', '#8A5AB0', '#FF3D2A', 'boss']]
  ];

  /* ---------------- 지도 목록 ---------------- */
  // id: 'v1'~'v9' (마을), 'f1'~'f90' (사냥터)
  const DOT_ONLY = ['ashigaru', 'gunner', 'samurai', 'gumiho', 'jangseung'];   // v47 새 몬스터: Meshy 그림 없이 도트로
  const MAPS = [];
  REGIONS.forEach((R, ri) => {
    MAPS.push({ id: 'v' + (ri + 1), kind: 'village', region: ri, name: R.name, rec: 0 });
    for (let k = 0; k < 10; k++) {
      const n = ri * 10 + k + 1, m = MON[ri][k];
      MAPS.push({ id: 'f' + n, kind: 'field', region: ri, no: n, name: R.fields[k], rec: recOf(ri, k), boss: m[6] === 'boss',
        mon: { name: m[0], shape: m[1], colors: { a: m[2], b: m[3], c: m[4], d: m[5] }, kind: m[6], ri, k, dot: DOT_ONLY.includes(m[1]) } });   // ri·k = Meshy 그림 칸 (img/mon_r{ri}.png 의 k번째, 보스는 img/boss_r{ri}.png)
    }
  });
  MAPS.forEach((m, i) => { m.prev = i > 0 ? MAPS[i - 1].id : null; m.next = i < MAPS.length - 1 ? MAPS[i + 1].id : null; });
  /* v80 임진왜란: 왜군 몬스터 = Meshy 그림 (img/v79/wae_*.png). 이름 → 그림 · 성질(shoot = 활·조총은 멀리서)
   *  '왜' 가 들어간 사냥터(왜군 진지·왜선 상륙지·왜성…)에는 다른 왜군이 섞여 나옴 (mon2, 12마리 중 4마리) */
  const WAE_IMG = { '왜군 척후병': 'wae_bow', '왜군 조총병': 'wae_gun', '왜군 창병': 'wae_spear', '왜군 척후대': 'wae_ronin', '왜군 상륙병': 'wae_flag', '왜군 조총수': 'wae_gun',
    '왜군 조총대': 'wae_drum', '왜군 돌격대': 'wae_monk', '왜장 무사': 'wae_samurai', '왜군 첩자': 'wae_ninja', '왜군 조총대장': 'wae_captain', '왜장 대장': 'wae_cavalry',
    '왜군 정예병': 'wae_samurai', '왜군 조총 정예': 'wae_gun', '왜성 수문장': 'wae_general' };
  const WAE_MIX = [['왜군 궁수', 'wae_bow', 'shoot'], ['왜군 창병', 'wae_spear', 'aggro'], ['왜군 조총병', 'wae_gun', 'shoot'], ['낭인 무사', 'wae_ronin', 'aggro'], ['왜군 첩자', 'wae_ninja', 'aggro'],
    ['왜군 깃발병', 'wae_flag', 'aggro'], ['왜군 북잡이', 'wae_drum', 'aggro'], ['왜군 승병', 'wae_monk', 'aggro'], ['왜장 무사', 'wae_samurai', 'aggro'], ['왜군 조총대장', 'wae_captain', 'shoot'], ['왜군 기마무사', 'wae_cavalry', 'aggro']];
  MAPS.forEach(m => {
    if (m.kind !== 'field' || m.hell || !m.mon) return;
    if (WAE_IMG[m.mon.name]) { m.mon.img79 = WAE_IMG[m.mon.name]; if (m.mon.img79 === 'wae_cavalry') m.mon.h = 72; }
    // v83 선생님: 왜군이 잘 안 보임 → 보스 사냥터 말고는 모든 사냥터에 왜군이 섞여 나옴 (지역마다 그 지역다운 왜군 · '왜' 사냥터는 더 많이)
    if (!m.boss) {
      const RP = [['wae_bow', 'wae_spear', 'wae_ronin'], ['wae_spear', 'wae_gun', 'wae_bow'], ['wae_ronin', 'wae_gun', 'wae_flag'], ['wae_flag', 'wae_gun', 'wae_ninja'], ['wae_drum', 'wae_monk', 'wae_gun'],
        ['wae_samurai', 'wae_gun', 'wae_monk'], ['wae_ninja', 'wae_samurai', 'wae_captain'], ['wae_captain', 'wae_cavalry', 'wae_samurai'], ['wae_samurai', 'wae_cavalry', 'wae_gun']][m.region];
      const pick = RP.filter(n => n !== m.mon.img79), im = pick[m.no % pick.length], w = WAE_MIX.find(x => x[1] === im);
      m.mix = /왜/.test(m.name) ? 3 : 4;   // 12마리 중 3마리마다 1 (= 4마리) · 4마리마다 1 (= 3마리)
      m.mon2 = { name: w[0], img79: w[1], h: w[1] === 'wae_cavalry' ? 72 : 64, shape: w[2] === 'shoot' ? 'gunner' : 'ashigaru', colors: { a: '#3A4260', b: '#22283E', c: '#F0C8A0', d: '#D2343A' }, kind: w[2], ri: m.region, k: 0, dot: true };
    }
  });

  /* ---------------- v69 저승 던전 (임진왜란 뒤 저승 이야기) ----------------
   *  Lv.100 이 되면 마지막 마을(도원수 진영) 큰길에 '저승차사 강림' 이 나타나 저승문을 열어 줌
   *  관문 10개 × 단계 5개 (g-1 ~ g-5). 지금은 1관문(도산지옥 · 진광대왕)만 — 2관문부터는 gates 에 더하면 됨
   *  단계 s 의 몬스터 레벨 = 100 + (관문-1)×5 + s (플레이어 만렙은 100 그대로 → 레벨 차이만큼 주는 피해가 줄어 어려워짐)
   *   s=1·2 : 몬스터 kills 마리 잡으면 통과
   *   s=3   : kills 마리 → 옥졸(같은 레벨 보스) 등장 → 잡으면 통과
   *   s=4   : kills 마리 → 판관(같은 레벨 보스) 등장 → 잡으면 통과
   *   s=5   : 작은 몬스터 없이 관문 대왕만 (단계 레벨 + 5 = 1관문 110)
   *  랭킹 점수: 지옥을 하나라도 깨면 1000 + 깬 단계 번호(1-1 = 1 … 1-5 = 5, 2-1 = 6 …) → 랭킹에 '지옥 1-3' 처럼 보임 (settings.js scoreText) */
  const HELL = {
    kills: 50, bossPlus: 5, midPlus: 3, maxMonLv: 160,
    /* 속성: 관문마다 지옥 컨셉에 맞는 원소. 같은 원소 마법은 피해 ×0.7, 약점 원소 마법은 ×1.3. 몬스터의 탄·보스 기술도 이 원소
     *  계획: 1 도산(칼산)=땅 · 2 화탕(끓는 물)=불 · 3 한빙(얼음)=물 · 4 검수(칼나무)=바람 · 5 발설(혀)=번개 · 6 독사=땅 · 7 거해(톱)=번개 · 8 철상(쇠 침상)=불 · 9 풍도(바람)=바람 · 10 흑암(어둠)=빛의 반대(약점 빛) */
    weak: { fire: 'water', water: 'thunder', thunder: 'earth', earth: 'wind', wind: 'fire', light: 'thunder', dark: 'light' },   // v79 10관문 흑암 = 어둠(약점 빛)
    resist: 0.7, weakMul: 1.3,
    /* 보스 기술 (game.js bossSkill): slam 내려찍기 · charge 돌진 · blades 칼비(땅에서 칼날이 솟음) · ring 사방 탄 · fan 부채꼴 탄 · summon 망령 부르기
     *  체력이 절반 아래면 '분노': 기술을 더 자주, 더 많이 씀 */   // midPlus = 옥졸·판관 레벨 = 단계 레벨 + 3 (1-3 옥졸 106 · 1-4 판관 107)
    npc: { name: '저승차사 강림', color: '#B8A8FF', av: { skin: 's3', hair: 'h_spiky', top: 't_suit', bottom: 'b_armor', shoes: 'sh_black', back: 'bk_cape' },
      hello: ['전쟁이 끝났어도 저승은 아직 전쟁 중일세.', '산 몸으로 저승에 들어갈 수 있는 이는 자네뿐이야.', '열 관문의 대왕들이 자네를 시험할 걸세. 각오는 됐는가?'],
      lines: ['…저승문이 흔들리고 있어.', '명부를 되찾아야 하네.', '레벨 100이 되면 다시 오게.'] },
    story: [
      '임진년부터 칠 년 동안 이어진 전쟁이 끝났습니다. 그런데 이 땅에서 죽은 수많은 혼이 한꺼번에 저승으로 몰려가는 바람에, 저승 열 관문이 모두 어지러워졌습니다.',
      '그 틈에 바다를 건너왔다 죽은 왜장들의 원혼이 저승 관청에 숨어들어 죽은 이의 선악을 적은 <b>명부</b>를 훔쳐 갔습니다. 명부가 없으니 판결은 뒤죽박죽이고, 억울한 백성의 혼은 저승길을 떠돌고 있습니다.',
      '흑룡 이무기를 물리친 당신에게 저승차사 강림이 찾아와 부탁합니다. "산 몸으로 열 관문을 지나 대왕들의 시험을 이기고, 명부를 되찾아 저승의 질서를 바로잡아 주게."',
      '관문마다 다섯 단계가 있습니다. 앞의 단계에서는 떠도는 망령을, 셋째 단계에서는 관문의 옥졸을, 넷째 단계에서는 판관을, 마지막 다섯째 단계에서는 관문의 대왕을 만나게 됩니다.'
    ],
    gates: [
      { no: 1, king: '진광대왕', hell: '도산지옥', short: '칼산', day: '첫 7일', el: 'earth',
        about: '죽은 지 첫 7일에 지나는 관문. 생명을 함부로 한 죄를 묻고, 죄 지은 혼은 칼날이 박힌 산을 맨발로 오릅니다. 지금은 전쟁에서 칼에 쓰러진 혼들이 칼산을 메우고 있습니다.',
        stageName: ['칼산 기슭', '칼날 비탈', '옥졸의 길목', '판관의 심문대', '진광대왕 전'],
        mob: { name: '칼산 망령', img: 'hell1_mob', art: 'h_wraith', shape: 'ghost', colors: { a: '#B8C8E8', b: '#5A6A90', c: '#F0F4FF', d: '#FF5A5F' }, kind: 'aggro' },
        mob2: { name: '칼 든 원혼', img: 'hell1_mob2', art: 'h_soldier', shape: 'skeleton', colors: { a: '#D8D0C0', b: '#7A6A5A', c: '#FFF4E0', d: '#FF3A3A' }, kind: 'shoot' },
        guard: { name: '우두 옥졸', img: 'hell1_guard', art: 'h_ox', shape: 'beast', colors: { a: '#7A3A2A', b: '#4A2018', c: '#E8C8A0', d: '#FFD23F' }, kind: 'boss', say: '소머리 옥졸이 쇠몽둥이를 들고 길을 막습니다!', skills: ['charge', 'slam'] },
        judge: { name: '도산 판관', img: 'hell1_judge', art: 'h_judge', shape: 'imp', colors: { a: '#3A3A7A', b: '#20204A', c: '#F0D8B0', d: '#FFD23F' }, kind: 'boss', say: '명부를 잃은 판관이 당신의 죄를 묻습니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '진광대왕', img: 'hell1_king', art: 'h_king1', shape: 'golem', colors: { a: '#C83A3A', b: '#7A1A1A', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '첫째 관문의 대왕이 시험을 시작합니다!', skills: ['blades', 'ring', 'charge', 'summon', 'slam'] } },
      { no: 2, king: '초강대왕', hell: '화탕지옥', short: '화탕', day: '둘째 7일', el: 'fire',
        about: '둘째 7일에 지나는 관문. 남의 것을 빼앗은 죄를 묻고, 펄펄 끓는 가마솥이 줄지어 있습니다. 전쟁 중 마을을 불태운 혼들이 여기서 떠돌고 있습니다.',
        stageName: ['가마솥 거리', '끓는 물 다리', '마두 옥졸의 문', '화탕 판관의 뜰', '초강대왕 전'],
        mob: { name: '가마솥 불망령', img: 'hell2_mob', shape: 'ghost', colors: { a: '#FF8A3D', b: '#C83A1A', c: '#FFE0A0', d: '#FFD23F' }, kind: 'aggro' },
        mob2: { name: '불타는 원혼', img: 'hell2_mob2', shape: 'skeleton', colors: { a: '#FF6A3D', b: '#8A2B1A', c: '#FFD8A0', d: '#FFD23F' }, kind: 'shoot' },
        guard: { name: '마두 옥졸', img: 'hell2_guard', shape: 'beast', colors: { a: '#3A2A2A', b: '#1A1010', c: '#E8C8A0', d: '#FF6A3D' }, kind: 'boss', say: '말머리 옥졸이 삼지창을 겨눕니다!', skills: ['charge', 'fan', 'slam'] },
        judge: { name: '화탕 판관', img: 'hell2_judge', shape: 'imp', colors: { a: '#A82A2A', b: '#5A1414', c: '#F0D8B0', d: '#FFD23F' }, kind: 'boss', say: '화탕 판관이 부채로 불길을 일으킵니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '초강대왕', img: 'hell2_king', shape: 'golem', colors: { a: '#FF8A3D', b: '#A83A1A', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '둘째 관문의 대왕이 불길 속에서 일어납니다!', skills: ['ring', 'fan', 'charge', 'summon', 'slam'] } },
      { no: 3, king: '송제대왕', hell: '한빙지옥', short: '한빙', day: '셋째 7일', el: 'water',
        about: '셋째 7일에 지나는 관문. 은혜를 저버린 죄를 묻고, 모든 것이 얼어붙은 얼음 벌판이 펼쳐집니다. 겨울 전투에서 얼어 죽은 혼들이 이곳을 헤맵니다.',
        stageName: ['얼음 벌판', '서리 골짜기', '얼음 옥졸의 굴', '한빙 판관의 얼음 대청', '송제대왕 전'],
        mob: { name: '서리 망령', img: 'hell3_mob', shape: 'ghost', colors: { a: '#BDE8FF', b: '#5AA8E0', c: '#FFFFFF', d: '#3BA8F5' }, kind: 'aggro' },
        mob2: { name: '얼어붙은 원혼', img: 'hell3_mob2', shape: 'skeleton', colors: { a: '#D8F0FF', b: '#5A8AB0', c: '#FFFFFF', d: '#3BA8F5' }, kind: 'shoot' },
        guard: { name: '얼음 옥졸', img: 'hell3_guard', shape: 'golem', colors: { a: '#7FC8F0', b: '#3A6A9A', c: '#E8F8FF', d: '#FFFFFF' }, kind: 'boss', say: '얼음 도깨비 옥졸이 고드름 몽둥이를 듭니다!', skills: ['slam', 'blades', 'charge'] },
        judge: { name: '한빙 판관', img: 'hell3_judge', shape: 'imp', colors: { a: '#5A9AD0', b: '#2A4A7A', c: '#F0E8D8', d: '#BDE8FF' }, kind: 'boss', say: '얼어붙은 명부를 든 판관이 노려봅니다!', skills: ['ring', 'fan', 'summon'] },
        boss: { name: '송제대왕', img: 'hell3_king', shape: 'golem', colors: { a: '#BDE8FF', b: '#5A8AC0', c: '#FFFFFF', d: '#3BA8F5' }, kind: 'boss', say: '셋째 관문의 대왕이 얼음 홀을 듭니다!', skills: ['blades', 'ring', 'fan', 'summon', 'slam'] } },
      { no: 4, king: '오관대왕', hell: '검수지옥', short: '검수', day: '넷째 7일', el: 'wind',
        about: '넷째 7일에 지나는 관문. 거짓 맹세를 한 죄를 묻고, 잎이 칼날인 나무 숲에 바람이 불 때마다 칼잎이 쏟아집니다.',
        stageName: ['칼잎 숲 어귀', '바람 부는 칼나무 길', '까마귀 옥졸의 둥지', '검수 판관의 정자', '오관대왕 전'],
        mob: { name: '칼나무 정령', img: 'hell4_mob', shape: 'plant', colors: { a: '#5AC88A', b: '#2E7A4A', c: '#E0F0E8', d: '#C8D0E0' }, kind: 'shoot' },
        mob2: { name: '회오리 망령', img: 'hell4_mob2', shape: 'ghost', colors: { a: '#B8F0D8', b: '#5AA88A', c: '#FFFFFF', d: '#7FE0C4' }, kind: 'aggro' },
        guard: { name: '까마귀 옥졸', img: 'hell4_guard', shape: 'bat', colors: { a: '#2A2A3A', b: '#14141E', c: '#E8E0D0', d: '#FFD23F' }, kind: 'boss', say: '까마귀머리 옥졸이 낫을 휘두릅니다!', skills: ['charge', 'blades', 'fan'] },
        judge: { name: '검수 판관', img: 'hell4_judge', shape: 'imp', colors: { a: '#3A9A6A', b: '#1A5A3A', c: '#F0D8B0', d: '#FFD23F' }, kind: 'boss', say: '깃털 붓을 든 판관이 바람을 일으킵니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '오관대왕', img: 'hell4_king', shape: 'golem', colors: { a: '#5AC88A', b: '#2A7A4A', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '넷째 관문의 대왕이 칼잎 폭풍을 부릅니다!', skills: ['blades', 'fan', 'charge', 'summon', 'ring'] } },
      { no: 5, king: '염라대왕', hell: '발설지옥', short: '발설', day: '다섯째 7일', el: 'thunder',
        about: '다섯째 7일에 지나는 관문. 거짓말과 헐뜯은 죄를 묻습니다. 염라대왕의 업경대(거울)에는 살아서 한 일이 모두 비칩니다.',
        stageName: ['번개 구름길', '사슬 다리', '천둥 옥졸의 북', '발설 판관의 대청', '염라대왕 전'],
        mob: { name: '번개 망령', img: 'hell5_mob', shape: 'ghost', colors: { a: '#C8A8FF', b: '#6A4AC0', c: '#FFFFFF', d: '#FFE45C' }, kind: 'shoot' },
        mob2: { name: '거짓말쟁이 원혼', img: 'hell5_mob2', shape: 'imp', colors: { a: '#A86AE0', b: '#5A2A8A', c: '#FFE0F0', d: '#FFD23F' }, kind: 'aggro' },
        guard: { name: '천둥 옥졸', img: 'hell5_guard', shape: 'golem', colors: { a: '#6A5AD0', b: '#2A2A7A', c: '#E8E0FF', d: '#FFE45C' }, kind: 'boss', say: '북을 둘러멘 천둥 옥졸이 번개 망치를 듭니다!', skills: ['slam', 'ring', 'charge'] },
        judge: { name: '발설 판관', img: 'hell5_judge', shape: 'imp', colors: { a: '#7A3AB0', b: '#3A1A5A', c: '#F0D8B0', d: '#FFE45C' }, kind: 'boss', say: '번개 붓을 든 판관이 거짓을 밝힙니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '염라대왕', img: 'hell5_king', shape: 'golem', colors: { a: '#2A2A3A', b: '#14141E', c: '#FFD23F', d: '#C8A8FF' }, kind: 'boss', say: '업경대 앞의 염라대왕이 당신을 내려다봅니다!', skills: ['ring', 'blades', 'fan', 'charge', 'summon', 'slam'] } },
      { no: 6, king: '변성대왕', hell: '독사지옥', short: '독사', day: '여섯째 7일', el: 'earth',
        about: '여섯째 7일에 지나는 관문. 남을 해친 죄를 묻고, 독사가 우글거리는 늪 바위 길이 이어집니다.',
        stageName: ['독 이끼 길', '뱀 굴 입구', '뱀팔 옥졸의 굴', '독사 판관의 바위', '변성대왕 전'],
        mob: { name: '독사 망령', img: 'hell6_mob', shape: 'ghost', colors: { a: '#8AE08A', b: '#3A8A3A', c: '#E8FFE8', d: '#C8FF5A' }, kind: 'aggro' },
        mob2: { name: '뱀꼬리 원혼', img: 'hell6_mob2', shape: 'scorpion', colors: { a: '#6AB86A', b: '#2A5A2A', c: '#F0D8B0', d: '#C8FF5A' }, kind: 'shoot' },
        guard: { name: '뱀팔 옥졸', img: 'hell6_guard', shape: 'beast', colors: { a: '#4A8A4A', b: '#1A4A1A', c: '#E8E0C0', d: '#FFD23F' }, kind: 'boss', say: '팔에 뱀을 감은 옥졸이 갈고리를 휘두릅니다!', skills: ['charge', 'blades', 'slam'] },
        judge: { name: '독사 판관', img: 'hell6_judge', shape: 'imp', colors: { a: '#6A7A2A', b: '#3A4A14', c: '#F0D8B0', d: '#C8FF5A' }, kind: 'boss', say: '어깨에 뱀을 올린 판관이 명부를 펼칩니다!', skills: ['fan', 'summon', 'ring'] },
        boss: { name: '변성대왕', img: 'hell6_king', shape: 'golem', colors: { a: '#3A7A3A', b: '#1A3A1A', c: '#FFD23F', d: '#C8FF5A' }, kind: 'boss', say: '여섯째 관문의 대왕 뒤로 거대한 뱀이 똬리를 틉니다!', skills: ['summon', 'blades', 'charge', 'fan', 'slam'] } },
      { no: 7, king: '태산대왕', hell: '거해지옥', short: '거해', day: '일곱째 7일', el: 'thunder',
        about: '일곱째 7일에 지나는 관문. 나라와 백성을 배신한 죄를 묻습니다. 거대한 톱니바퀴가 번개를 튀기며 돌아갑니다.',
        stageName: ['톱니 회랑', '불꽃 튀는 공방', '톱 옥졸의 작업장', '거해 판관의 도장실', '태산대왕 전'],
        mob: { name: '톱날 망령', img: 'hell7_mob', shape: 'ghost', colors: { a: '#D8D8E8', b: '#7A7A9A', c: '#FFFFFF', d: '#FFE45C' }, kind: 'shoot' },
        mob2: { name: '태엽 원혼', img: 'hell7_mob2', shape: 'golem', colors: { a: '#B08A5A', b: '#6A4A2A', c: '#F0D8B0', d: '#FFE45C' }, kind: 'aggro' },
        guard: { name: '톱 옥졸', img: 'hell7_guard', shape: 'beast', colors: { a: '#8A6A4A', b: '#4A3A2A', c: '#E8C8A0', d: '#FFE45C' }, kind: 'boss', say: '큰 톱을 멘 옥졸이 불꽃을 튀깁니다!', skills: ['charge', 'slam', 'ring'] },
        judge: { name: '거해 판관', img: 'hell7_judge', shape: 'imp', colors: { a: '#C8A030', b: '#7A5A14', c: '#F0D8B0', d: '#FFE45C' }, kind: 'boss', say: '톱니 도장을 든 판관이 판결을 내립니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '태산대왕', img: 'hell7_king', shape: 'golem', colors: { a: '#C8A030', b: '#7A5A14', c: '#FFE45C', d: '#FFF4C0' }, kind: 'boss', say: '일곱째 관문의 대왕 뒤에서 번개 톱니바퀴가 돕니다!', skills: ['ring', 'charge', 'blades', 'summon', 'slam', 'fan'] } },
      { no: 8, king: '평등대왕', hell: '철상지옥', short: '철상', day: '여덟째 100일', el: 'fire',
        about: '죽은 지 100일에 지나는 관문. 생명을 업신여긴 죄를 묻고, 벌겋게 달군 쇠 침상과 쇠사슬이 가득합니다.',
        stageName: ['쇠사슬 복도', '달군 쇠 바닥', '쇠갑옷 옥졸의 대장간', '철상 판관의 저울', '평등대왕 전'],
        mob: { name: '쇠사슬 망령', img: 'hell8_mob', shape: 'ghost', colors: { a: '#FF8A5A', b: '#8A2A1A', c: '#FFD8C0', d: '#FFD23F' }, kind: 'aggro' },
        mob2: { name: '달군 쇠 원혼', img: 'hell8_mob2', shape: 'golem', colors: { a: '#C83A2A', b: '#5A1A14', c: '#FFB08A', d: '#FFD23F' }, kind: 'shoot' },
        guard: { name: '쇠갑옷 옥졸', img: 'hell8_guard', shape: 'golem', colors: { a: '#5A5A6A', b: '#2A2A3A', c: '#FF8A3D', d: '#FFD23F' }, kind: 'boss', say: '달군 쇠갑옷 옥졸이 철퇴를 돌립니다!', skills: ['slam', 'charge', 'ring'] },
        judge: { name: '철상 판관', img: 'hell8_judge', shape: 'imp', colors: { a: '#8A1A1A', b: '#4A0A0A', c: '#F0D8B0', d: '#FF8A3D' }, kind: 'boss', say: '쇠 명부를 든 판관이 쇠 도장을 찍습니다!', skills: ['fan', 'summon', 'ring'] },
        boss: { name: '평등대왕', img: 'hell8_king', shape: 'golem', colors: { a: '#7A7A8A', b: '#C83A2A', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '여덟째 관문의 대왕이 정의의 저울을 기울입니다!', skills: ['blades', 'ring', 'slam', 'charge', 'summon', 'fan'] } },
      { no: 9, king: '도시대왕', hell: '풍도지옥', short: '풍도', day: '아홉째 1년', el: 'wind',
        about: '죽은 지 1년에 지나는 관문. 남을 속인 죄를 묻고, 끝없는 회오리바람이 혼을 이리저리 날려 보냅니다.',
        stageName: ['모래바람 들판', '회오리 언덕', '바람주머니 옥졸', '풍도 판관의 누각', '도시대왕 전'],
        mob: { name: '회오리 망령', img: 'hell9_mob', shape: 'ghost', colors: { a: '#C8E0D8', b: '#6A9A8A', c: '#FFFFFF', d: '#7FE0C4' }, kind: 'shoot' },
        mob2: { name: '날리는 원혼', img: 'hell9_mob2', shape: 'skeleton', colors: { a: '#B8C8D8', b: '#5A6A7A', c: '#FFFFFF', d: '#7FE0C4' }, kind: 'aggro' },
        guard: { name: '바람주머니 옥졸', img: 'hell9_guard', shape: 'golem', colors: { a: '#8AB8B0', b: '#3A6A64', c: '#E8F0E8', d: '#FFD23F' }, kind: 'boss', say: '바람주머니를 멘 거인 옥졸이 볼을 부풀립니다!', skills: ['fan', 'charge', 'ring'] },
        judge: { name: '풍도 판관', img: 'hell9_judge', shape: 'imp', colors: { a: '#5AB0E0', b: '#2A5A7A', c: '#F0D8B0', d: '#7FE0C4' }, kind: 'boss', say: '소매가 펄럭이는 판관이 명부를 날립니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '도시대왕', img: 'hell9_king', shape: 'golem', colors: { a: '#3AA8A0', b: '#1A5A54', c: '#E8F0F0', d: '#FFD23F' }, kind: 'boss', say: '아홉째 관문의 대왕이 큰 부채로 회오리를 부릅니다!', skills: ['fan', 'ring', 'charge', 'blades', 'summon', 'slam'] } },
      { no: 10, king: '오도전륜대왕', hell: '흑암지옥', short: '흑암', day: '마지막 3년', el: 'dark',
        about: '죽은 지 3년에 지나는 마지막 관문. 다음 생이 정해지는 곳입니다. 명부를 훔친 왜장의 원혼이 어둠 속에 숨어 있습니다. 대왕을 이기면 명부를 되찾습니다!',
        stageName: ['어둠의 문', '그림자 미로', '그림자 옥졸의 등불', '흑암 판관의 마지막 심판', '오도전륜대왕 전'],
        mob: { name: '그림자 망령', img: 'hell10_mob', shape: 'ghost', colors: { a: '#5A4A7A', b: '#1A1430', c: '#C8A8FF', d: '#B08AFF' }, kind: 'aggro' },
        mob2: { name: '명부 도둑 왜장 원혼', img: 'hell10_mob2', shape: 'samurai', colors: { a: '#2A2A36', b: '#16161E', c: '#C8A8FF', d: '#B08AFF' }, kind: 'shoot' },
        guard: { name: '그림자 옥졸', img: 'hell10_guard', shape: 'golem', colors: { a: '#3A2A5A', b: '#14102A', c: '#C8A8FF', d: '#FFD23F' }, kind: 'boss', say: '등불을 든 그림자 옥졸이 낫을 듭니다!', skills: ['summon', 'charge', 'blades'] },
        judge: { name: '흑암 판관', img: 'hell10_judge', shape: 'imp', colors: { a: '#1A1430', b: '#0A0818', c: '#F0D8B0', d: '#B08AFF' }, kind: 'boss', say: '빛나는 명부를 든 판관이 마지막 심판을 시작합니다!', skills: ['ring', 'fan', 'summon'] },
        boss: { name: '오도전륜대왕', img: 'hell10_king', shape: 'golem', colors: { a: '#3A2A5A', b: '#B08AFF', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '마지막 대왕 뒤에서 윤회의 바퀴가 돌기 시작합니다!', skills: ['ring', 'blades', 'fan', 'charge', 'summon', 'slam'] } }
    ]
  };
  HELL.gates.forEach(g => { ['mob', 'mob2', 'guard', 'judge', 'boss'].forEach(k => { if (g[k]) g[k].el = g.el; }); });
  HELL.gates.forEach(g => ['guard', 'judge', 'boss'].forEach(k => { if (g[k]) g[k].rig = 'biped'; }));   // v83 옥졸·판관·대왕 Meshy 그림은 사람 모양 → 두 발로 걷기   // 관문 몬스터 = 관문 속성
  HELL.gates.forEach(g => { for (let s = 1; s <= 5; s++) MAPS.push({ id: `h${g.no}-${s}`, kind: 'field', hell: true, gate: g.no, stage: s, region: 8, no: 0, prev: null, next: null,
    name: `${g.hell} ${g.no}-${s} · ${g.stageName[s - 1]}`, rec: 100 + (g.no - 1) * 5 + s + (s === 5 ? HELL.bossPlus : 0), boss: false, mon: g.mob }); });

  /* ---------------- 성장 공식 ---------------- */
  const F = {
    need: lv => Math.round(30 * Math.pow(lv, 1.8)),                    // 다음 레벨까지 필요한 경험치
    hp: lv => 80 + lv * 22, mp: lv => 40 + lv * 9,
    atk: lv => Math.round(6 + lv * 2.6), mag: lv => Math.round(6 + lv * 2.6), def: lv => Math.round(lv * 1.2),
    // 몬스터 (레벨 m)
    // v72 몬스터 더 세게 (학생 의견 '너무 쉬움' · 선생님 결정): 체력 ×1.7 · 공격 ×1.5
    monHp: m => Math.round((30 + m * 12 + m * m * 0.12) * 1.7), monAtk: m => Math.round((4 + m * 2.6) * 1.5), monDef: m => Math.round(m * 1.0),
    monExp: m => Math.max(3, Math.round(F.need(m) / (22 + m * 0.4))), monGold: m => Math.round(3 + m * 1.4),
    boss: { hp: 30, atk: 2.2, exp: 15, gold: 10 }   // v72 보스 아주 많이 세게: 체력 12 → 30배 · 공격 1.6 → 2.2배 (일반 몬스터 기준, 일반도 위에서 1.7·1.5배 올라 실제로는 체력 약 4배 · 공격 약 2배)
  };
  /* v44 스탯 4가지 → v60 5가지 (레벨 업마다 포인트 2개 → 원하는 곳에 · 스탯마다 최대 50)
   *  힘 = 피해(기본 공격·마법 모두) · 민첩 = 이동 속도 · 지혜 = 마나 회복 · 체력 = 최대 체력
   *  v60 저항 = 1포인트마다 물리 방어 +0.5% · 속성 방어(불·물·바람·땅·번개·빛 모두) +0.5% */
  const STAT = {
    keys: ['str', 'dex', 'int', 'vit', 'res'],
    str: { name: '힘', color: '#FF8A8E', desc: '주는 피해 +2% (기본 공격·마법 모두)', dmg: 2 },
    dex: { name: '민첩', color: '#9AF0B0', desc: '이동 속도 +1%', spd: 1 },
    int: { name: '지혜', color: '#C8A8FF', desc: '마나 회복 +4%', mpRegen: 4 },
    vit: { name: '체력', color: '#FFB86B', desc: '최대 체력 +2% (기본 체력 기준)', hpPct: 2 },
    res: { name: '저항', color: '#7FE0F0', desc: '물리 방어 +0.5% · 속성 방어 +0.5% (불·물·바람·땅·번개·빛)', pdef: 0.5, edef: 0.5 },
    max: 50, baseCrit: 8, critDmg: 1.6, atkCd: 0.42,
    defCap: 75   // 물리·속성 방어 % 최대 (저항 + 장비 옵션 합)
  };

  /* ---------------- 장비 ----------------
   *  부위: weapon(무기) · helmet(투구) · armor(갑옷) · boots(신발) · ring(장신구)
   *  단계 9개 (마을 지역마다 하나) × 보통/정예 → 그 지역 사냥터에서 떨어짐
   *  착용 레벨: 보통 = 지역 첫 레벨, 정예 = 지역 중간 (마을1 1·6 … 마을8 71·76, 마을9 81·91)
   *  모양: 아바타 위에 겹쳐 그림 (game.js 의 drawGear). color = 단계 색 */
  const TIER = [   // 마을(지역) 하나에 단계 하나
    { name: '가죽', color: '#B07A45', dark: '#7A5230', gem: '#FFE45C' },
    { name: '청동', color: '#C8874A', dark: '#8A5528', gem: '#3DDC84' },
    { name: '이끼 나무', color: '#7FA05A', dark: '#4E6A36', gem: '#FF7EB6' },
    { name: '철', color: '#9AA3C7', dark: '#626B94', gem: '#3BC8F5' },
    { name: '강철', color: '#7A8296', dark: '#4A5064', gem: '#FF9A3D' },
    { name: '얼음 수정', color: '#8ADCF5', dark: '#3E8EC0', gem: '#FFFFFF' },
    { name: '자수정', color: '#A880F0', dark: '#6440B0', gem: '#7FE0F0' },
    { name: '하늘 깃털', color: '#F3F6FF', dark: '#9AA8D0', gem: '#FFE45C' },
    { name: '불꽃 용', color: '#E2483C', dark: '#8A1E22', gem: '#FFD23F' },
    { name: '전설의', color: '#FFC83D', dark: '#B07A10', gem: '#FFFFFF', legend: true }   // v60 Lv.100 · 마지막 보스(사냥터 90)와 마지막 사냥터에서만
  ];
  const SLOT_NAME = { weapon: '무기', helmet: '투구', armor: '갑옷', boots: '신발', ring: '장신구' };
  const ITEMS = {};
  /* v60 착용 레벨을 부위마다 다르게 (같은 단계라도 무기가 가장 먼저, 갑옷이 가장 늦게)
   *  부위 순서(+레벨): 검 0 · 신발 +1 · 투구 +2 · 지팡이 +2 · 반지 +3 · 갑옷 +4
   *  마을 1~8 단계: 보통 = 지역 첫 레벨 + 순서 (1~5 … 71~75), 정예 = 지역 중간 + 순서 (6~10 … 76~80)
   *  마을 9 단계(불꽃 용): 보통 81~89, 정예 90~98 (2씩) · 전설 단계: 모두 Lv.100 */
  const REQ_OFF = { sw: 0, bt: 1, hm: 2, st: 2, rg: 3, ar: 4 };
  const reqOf = (t, rare, sid) => { const o = REQ_OFF[sid]; return t >= 9 ? 100 : t < 8 ? t * 10 + (rare ? 6 : 1) + o : (rare ? 90 : 81) + o * 2; };
  const GEAR_BASE = [];   // 떨어뜨릴 수 있는 기본 장비 id (단계 t, 정예 여부로 고름)
  TIER.forEach((T, t) => {
    (T.legend ? [0] : [0, 1]).forEach(rare => {
      const q = rare ? '정예 ' : '', id = (s) => `${s}${t + 1}${rare ? 'r' : ''}`, boost = T.legend ? 1.18 : 1;
      const add = (slot, sid, name, stf, extra) => { const req = reqOf(t, rare, sid), st = stf(req); Object.keys(st).forEach(k => { if (k !== 'spd') st[k] = Math.round(st[k] * boost); });
        ITEMS[id(sid)] = Object.assign({ id: id(sid), slot, name: q + T.name + ' ' + name, tier: t, rare: !!rare || !!T.legend, legend: !!T.legend, req, st, price: Math.round((20 + req * req * 0.9) * (T.legend ? 3 : 1)) }, extra || {}); GEAR_BASE.push(id(sid)); };
      add('weapon', 'sw', '검', r => ({ atk: Math.round(4 + r * 1.6) }), { look: 'sword' });
      add('weapon', 'st', '지팡이', r => ({ atk: Math.round(2 + r * 0.7), mag: Math.round(4 + r * 1.5) }), { look: 'staff' });
      add('helmet', 'hm', '투구', r => ({ def: Math.round(1 + r * 0.5), hp: Math.round(r * 3) }));
      add('armor', 'ar', '갑옷', r => ({ def: Math.round(2 + r * 0.9), hp: Math.round(r * 5) }));
      add('boots', 'bt', '신발', r => ({ def: Math.round(1 + r * 0.4), spd: 3 + Math.round(t * 0.75) }));
      add('ring', 'rg', '반지', r => ({ mp: Math.round(10 + r * 2), mag: Math.round(r * 0.5) }));
    });
  });

  /* ---------------- v60 장비 옵션 (떨어질 때 무작위로 붙음) ----------------
   *  max = 가장 높은 단계(전설)에서 나올 수 있는 최댓값(%). 낮은 단계일수록 작게: max × (0.25 + 0.75 × 단계/9) × (0.2~1)
   *  v84 옵션 폭 약 3배 · 두 번째 옵션부터 35% 확률로 마이너스 옵션(값 0.5~1배) — 예) 공격력 +12% · 물리 방어 −6%
   *  옵션 개수 → 등급: 1 일반 · 2 고급 · 3 희귀 · 4 영웅 · 전설 단계 = 전설 (4개) */
  const OPTS = {
    pdef: { name: '물리 방어', max: 12 },
    e_fire: { name: '불 속성 방어', max: 20, el: 'fire' },
    e_water: { name: '물 속성 방어', max: 20, el: 'water' },
    e_wind: { name: '바람 속성 방어', max: 20, el: 'wind' },
    e_earth: { name: '땅 속성 방어', max: 20, el: 'earth' },
    e_thunder: { name: '전기(번개) 속성 방어', max: 20, el: 'thunder' },
    e_light: { name: '빛 속성 방어', max: 20, el: 'light' },
    e_all: { name: '모든 속성 방어', max: 8 },
    atkP: { name: '공격력', max: 18 },
    magP: { name: '마력', max: 18 },
    dmg: { name: '주는 피해', max: 15 },
    hpP: { name: '최대 체력', max: 24 },
    mpP: { name: '최대 마나', max: 24 },
    spdP: { name: '이동 속도', max: 8 },
    crit: { name: '치명타 확률', max: 8 },
    critD: { name: '치명타 피해', max: 30 },
    mpReg: { name: '마나 회복', max: 30 },
    goldP: { name: '골드 획득', max: 30 },
    expP: { name: '경험치 획득', max: 18 }
  };
  const GRADE = [
    { name: '일반', color: '#FFFFFF' }, { name: '고급', color: '#9AF0B0' }, { name: '희귀', color: '#7FC8FF' },
    { name: '영웅', color: '#D8A8FF' }, { name: '전설', color: '#FFD23F' }
  ];
  /* v60 강화 (마을 대장장이): +0 → +10. 실패하면 장비가 부서짐(사라짐)
   *  rate[n] = +n → +n+1 성공 확률(%) · cost(n) = 100 × 2^n 골드 (1강 100 … 10강 51,200 · 모두 102,300)
   *  per = 1강마다 기본 능력치(공격·마력·방어·체력·마나) +10% (+10 = 2배). 옵션은 그대로 */
  const ENH = { max: 10, rate: [95, 90, 85, 80, 70, 60, 50, 40, 35, 30], cost: n => 100 * Math.pow(2, n), per: 0.1, safeTo: 7 };
  // v72 (선생님 결정): +7 까지(+1 ~ +7 시도)는 실패하면 한 단계 내려감(+0 은 그대로) · +8 부터(+7 → +8 시도)는 실패하면 부서짐 — safeTo 로 바꿈
  /* v72 가방 늘리기 (약방에서 팖): 기본 40칸 → 8칸씩 최대 5번(80칸). 값 = 5,000 × 2^(산 횟수) → 5천 · 1만 · 2만 · 4만 · 8만 G */
  const BAG = { base: 40, step: 8, max: 5, cost: n => 5000 * Math.pow(2, n) };
  /* v68 상점에 파는 값 (약방 '팔기')
   *  장비 = (base + 착용 레벨 × perLv) × 등급 배수 + 강화에 쓴 골드 × enh
   *    예) Lv.50 일반 160 G · 희귀 352 G · Lv.100 전설 1,550 G · +5 강화는 강화비 3,100 G 중 930 G 만 돌려받음
   *    → 몬스터 한 마리 골드(Lv.50 약 73 G)의 2~5배 정도. 강화해서 팔면 늘 손해라 '강화로 돈 벌기'가 안 됨
   *  장비가 아닌 물건(포션·주문서) = 산 값 × other */
  const SELL = { base: 10, perLv: 3, grade: [1, 1.5, 2.2, 3.2, 5], enh: 0.3, other: 0.4 };
  // v60 지역마다 몬스터 속성 (원거리 탄 · 보스 내려찍기가 이 속성 → 속성 방어로 줄어듦. 몸통 박치기는 물리)
  const RG_EL = ['wind', 'earth', 'water', 'fire', 'earth', 'water', 'light', 'thunder', 'fire'];

  /* ---------------- 소모품 (포션 가게) ---------------- */
  // 마을 n 의 포션 가게는 1 ~ n 단계 포션을 팜
  const POTIONS = [];
  // 단계 t: 그 지역 중간 레벨 최대 체력의 약 35% · 최대 마나의 약 40% 회복
  const HPN = ['빨간', '주황', '진홍', '장미', '루비', '핏빛', '보랏빛', '천사의', '불사조'], MPN = ['파란', '하늘', '청록', '남색', '사파이어', '별빛', '은하', '구름의', '마나의'];
  for (let t = 0; t < 9; t++) {
    const mid = t < 8 ? t * 10 + 5 : 90, hp = Math.round((80 + mid * 22) * 0.35 / 10) * 10, mp = Math.round((40 + mid * 9) * 0.4 / 10) * 10, price = Math.round(hp / 6);
    POTIONS.push({ id: 'hp' + (t + 1), name: HPN[t] + ' 포션', kind: 'hp', amount: hp, price, tier: t, desc: `체력 ${hp} 회복` });
    POTIONS.push({ id: 'mp' + (t + 1), name: MPN[t] + ' 포션', kind: 'mp', amount: mp, price: Math.round(price * 1.2), tier: t, desc: `마나 ${mp} 회복` });
  }
  POTIONS.push({ id: 'scroll', name: '귀환 주문서', kind: 'scroll', price: 15, tier: 0, desc: '마지막으로 들른 마을의 이장 댁 앞으로 돌아가요' });
  POTIONS.forEach(p => { ITEMS[p.id] = Object.assign({ slot: null, stack: true }, p); });

  /* ---------------- 마법 (임시 · skillcom 연결 후 교체) ----------------
   *  kind (game.js 가 아는 종류)
   *    bolt   : 앞으로 날아가는 탄 (가장 가까운 몬스터를 자동 조준) — count 발, pierce = 관통
   *    nova   : 내 주변 원 (radius)
   *    beam   : 앞쪽 일직선 (len · w)
   *    rain   : 몬스터 근처 여러 곳에 떨어짐 (count · radius)
   *    pool   : 바닥에 남아 계속 피해 (radius · dur)
   *    dash   : 앞으로 돌진하며 부딪힌 몬스터 피해 · 잠깐 무적
   *    heal   : 체력 회복 (pow = 최대 체력 비율)
   *    shield : 받는 피해 감소 (pow = 감소 비율 · dur 초)
   *  효과 (fx): burn(불: 계속 피해) · slow(물: 느려짐) · stun(번개: 잠깐 멈춤) · push(바람: 밀어냄) · heavy(땅: 큰 피해) · holy(빛: 회복 조금) */
  const ELEM = {
    fire: { name: '불', color: '#FF6A3D', light: '#FFD23F', fx: 'burn' },
    water: { name: '물', color: '#3BA8F5', light: '#BDE8FF', fx: 'slow' },
    wind: { name: '바람', color: '#7FE0C4', light: '#E0FFF4', fx: 'push' },
    earth: { name: '땅', color: '#B0804A', light: '#E8C88A', fx: 'heavy' },
    thunder: { name: '번개', color: '#FFE45C', light: '#FFFFFF', fx: 'stun' },
    light: { name: '빛', color: '#FFF3B0', light: '#FFFFFF', fx: 'holy' },
    dark: { name: '어둠', color: '#B08AFF', light: '#E8DCFF', fx: 'none', monOnly: true }   // v79 저승 10관문 몬스터 전용 (마법에는 없음)
  };
  // [id, 이름, 원소, 배우는 레벨, kind, 위력, 마나, 재사용(초), 추가 값]
  const SK = [
    // (배우는 레벨에 따라 마을이 정해짐: Lv1~10 마을1 … Lv71~80 마을8, Lv81~100 마을9)
    ['magicarrow', '마법 화살', 'light', 1, 'bolt', 1.25, 3, 0.8, {}],   // v41 처음부터 가진 기본 마법
    ['fireball', '파이어볼', 'fire', 3, 'bolt', 1.6, 6, 1.2, {}],
    ['watershot', '물방울 탄', 'water', 6, 'bolt', 1.3, 6, 1.0, { count: 2 }],
    ['heal1', '회복의 물', 'water', 10, 'heal', 0.25, 14, 8, {}],
    ['stonewall', '돌 방패', 'earth', 14, 'shield', 0.35, 12, 14, { dur: 6 }],
    ['windblade', '바람 칼날', 'wind', 18, 'bolt', 1.8, 9, 1.5, { pierce: true }],
    ['firering', '불꽃 고리', 'fire', 22, 'nova', 2.2, 14, 4, { radius: 110 }],
    ['thunderarrow', '번개 화살', 'thunder', 26, 'bolt', 2.4, 12, 1.4, { speed: 1.6 }],
    ['earthsplit', '대지 가르기', 'earth', 30, 'beam', 2.8, 16, 4, { len: 260, w: 40 }],
    ['tornado', '회오리', 'wind', 34, 'nova', 2.4, 16, 5, { radius: 130 }],
    ['lightspear', '빛의 창', 'light', 38, 'beam', 3.0, 18, 3.5, { len: 320, w: 26 }],
    ['firerain', '화염 비', 'fire', 44, 'rain', 2.6, 24, 6, { count: 6, radius: 60 }],
    ['tidal', '해일', 'water', 48, 'beam', 3.2, 22, 5, { len: 300, w: 70 }],
    ['chainbolt', '연쇄 번개', 'thunder', 52, 'bolt', 2.6, 20, 2.5, { count: 3, pierce: true }],
    ['gale', '질풍 돌진', 'wind', 56, 'dash', 3.0, 18, 5, { len: 220 }],
    ['holylight', '성스러운 빛', 'light', 60, 'heal', 0.5, 30, 14, {}],
    ['thunderfall', '낙뢰', 'thunder', 64, 'rain', 3.2, 30, 6, { count: 5, radius: 70 }],
    ['quake', '지진', 'earth', 68, 'nova', 3.6, 30, 7, { radius: 170 }],
    ['stormblade', '폭풍 칼날', 'wind', 72, 'bolt', 2.4, 26, 2.5, { count: 5, pierce: true }],
    ['barrier', '빛의 결계', 'light', 76, 'shield', 0.55, 30, 20, { dur: 8 }],
    ['waterfall', '대폭포', 'water', 80, 'rain', 3.4, 34, 7, { count: 7, radius: 70 }],
    ['sunburst', '태양 폭발', 'fire', 84, 'nova', 4.4, 40, 8, { radius: 200 }],
    ['thorspear', '천둥의 창', 'thunder', 88, 'beam', 4.8, 40, 6, { len: 400, w: 50 }],
    ['earthrage', '대지의 분노', 'earth', 92, 'rain', 4.2, 44, 8, { count: 9, radius: 80 }],
    ['judgement', '심판의 빛', 'light', 96, 'rain', 4.8, 50, 9, { count: 8, radius: 90 }],
    ['elemental', '원소 해방', 'light', 100, 'nova', 6.0, 70, 15, { radius: 260 }]
  ];
  const SKILLS = {};
  SK.forEach(([id, name, el, lv, kind, pow, mp, cd, ex]) => {
    SKILLS[id] = Object.assign({ id, name, el, lv, kind, pow, mp, cd, village: Math.min(8, Math.floor((lv - 1) / 10)), price: Math.round(30 + lv * lv * 1.5) }, ex);
  });

  /* 융합: 서로 다른 원소 마법 2개 → 새 마법 (마법 학교에서)
   *  원소 짝마다 결과 모양(kind)과 이름이 정해져 있고, 위력은 재료 두 마법으로 계산 (game.js fuse())
   *  [원소1, 원소2, 이름, kind, 추가 값] */
  const FUSION = [
    ['fire', 'water', '증기 폭발', 'nova', { radius: 140 }],
    ['fire', 'wind', '화염 폭풍', 'rain', { count: 7, radius: 70 }],
    ['fire', 'earth', '용암 늪', 'pool', { radius: 90, dur: 4 }],
    ['fire', 'thunder', '플라즈마 탄', 'bolt', { count: 3, pierce: true, speed: 1.4 }],
    ['fire', 'light', '태양 광선', 'beam', { len: 380, w: 44 }],
    ['water', 'wind', '눈보라', 'nova', { radius: 170 }],
    ['water', 'earth', '진흙 늪', 'pool', { radius: 110, dur: 5 }],
    ['water', 'thunder', '감전 파도', 'beam', { len: 320, w: 80 }],
    ['water', 'light', '치유의 비', 'heal', {}],
    ['wind', 'earth', '모래 폭풍', 'rain', { count: 8, radius: 65 }],
    ['wind', 'thunder', '뇌우', 'rain', { count: 9, radius: 60 }],
    ['wind', 'light', '빛의 깃털', 'bolt', { count: 5, pierce: true }],
    ['earth', 'thunder', '자력 폭발', 'nova', { radius: 150 }],
    ['earth', 'light', '수호의 바위', 'shield', { dur: 10 }],
    ['thunder', 'light', '섬광 돌진', 'dash', { len: 280 }]
  ];
  const fusionOf = (e1, e2) => FUSION.find(f => (f[0] === e1 && f[1] === e2) || (f[0] === e2 && f[1] === e1)) || null;

  /* ---------------- 마을 건물 ----------------
   *  type: potion(포션 가게) · school(마법 학교) · chief(이장 집) · castle(성, 마지막 마을)
   *  x, y, w, h = 칸 (마을 지도 36 × 22) · door = 문 칸 (건물 아래 가운데) */
  const BUILDINGS = [
    { type: 'potion', name: '약방', x: 5, y: 4, w: 6, h: 4, roof: '#D2343A' },
    { type: 'school', name: '도술 서원', x: 25, y: 4, w: 7, h: 4, roof: '#7E4DE0' },
    { type: 'chief', name: '이장 댁', x: 6, y: 13, w: 6, h: 4, roof: '#3E9E58' }
  ];
  const CASTLE = { type: 'castle', name: '도원수 진영', x: 23, y: 12, w: 10, h: 6, roof: '#5A5A70' };

  /* ---------------- 사람(NPC) · v41 ----------------
   *  av = 사이트 아바타 옷 그대로 (avatar/avatar.js 의 아이템 id) → 플레이어와 같은 그림체
   *  hello = 창을 열 때 하는 말 (아무거나 하나) · lines = 근처에 가면 머리 위 말풍선 */
  const NPCS = {
    potion: { name: '약방 아씨 미나', color: '#FF9AA0', av: { skin: 's2', hair: 'h_bun', face: 'f_glasses', top: 't_doctor', bottom: 'b_skirt', shoes: 'sh_red' },
      hello: ['어서 와요! 오늘 끓인 물약이 아주 잘 됐어요.', '사냥 가기 전에 물약은 넉넉히! 쓰러지면 손해예요.', '안 쓰는 물건은 여기서 팔아도 돼요. 값은 좀 깎이지만요.'] },
    school: { name: '서원 도사 루멘', color: '#D8B8FF', av: { skin: 's1', hair: 'h_long', hat: 'hat_wizard', face: 'f_beard', top: 't_robe', bottom: 'b_ninja', shoes: 'sh_black' },
      hello: ['마법은 원소의 대화란다. 두 원소를 섞으면 새 마법이 태어나지.', '레벨이 오르면 다시 오너라. 더 강한 마법을 가르쳐 주마.', '같은 원소끼리는 섞이지 않는단다. 서로 다른 것이 만나야 새것이 되지.'] },
    chief: { name: '이장님', color: '#9AF0B0', av: { skin: 's3', hair: 'h_topknot', hat: 'hat_gat', face: 'f_mustache', top: 't_hanbok_m', bottom: 'b_hanbok_m', shoes: 'sh_black' },
      hello: ['어서 오게! 여기가 자네의 귀환 장소일세.', '가 본 곳이면 어디든 보내 주지. 이동은 무료라네.', '무리하지 말게. 쓰러지면 이 집 앞에서 다시 깨어날 걸세.'] },
    castle: { name: '도원수', color: '#FFE45C', av: { skin: 's1', hair: 'h_curly', hat: 'hat_emperor', face: 'f_beard', top: 't_suit', bottom: 'b_armor', shoes: 'sh_gold', back: 'bk_cape' },
      hello: ['잘 왔소. 왜성 깊은 곳에서 흑룡 이무기가 깨어나고 있소…', '왜군과 요괴가 한데 엉켜 몰려오고 있소. 힘을 길러 두시오.'] },
    guard: { name: '진영 파수꾼', color: '#C9D0F0', av: { skin: 's4', hair: 'h_short', hat: 'hat_darkhelm', top: 't_armor', bottom: 'b_armor', shoes: 'sh_black' },
      lines: ['도원수께 예를 갖추시오.', '진영은 안전하오.', '왜성 쪽 용암 지대는 조심하시오!'] }
  };
  // 마을을 돌아다니는 사람 (마을마다 2명씩 번갈아)
  const VILLAGERS = [
    { name: '꼬마 콩이', av: { skin: 's2', hair: 'h_twin', top: 't_pe', bottom: 'b_shorts', shoes: 'sh_red' }, lines: ['분수 물 진짜 시원해!', '오른쪽 끝으로 가면 사냥터래!', '나도 커서 마법사 될 거야!'] },
    { name: '나무꾼 아저씨', av: { skin: 's3', hair: 'h_short_brown', hat: 'hat_straw', face: 'f_mustache', top: 't_overall', bottom: 'b_jeans', shoes: 'sh_boots' }, lines: ['숲에 슬라임이 많아졌어.', '약방 물약은 정말 잘 들어.', '이장님 댁에 들르면 멀리 갈 수 있다네.'] },
    { name: '여행자 하늘', av: { skin: 's1', hair: 'h_ponytail', hat: 'hat_elfhood', top: 't_elf', bottom: 'b_cargo', shoes: 'sh_hightop', back: 'bk_bag2' }, lines: ['왜군이 사냥터마다 숨어 있대!', '보스는 꼭 장비를 떨어뜨린대!', '도술 서원에서 융합을 배워 봐.'] },
    { name: '떠돌이 장인 철수', av: { skin: 's4', hair: 'h_spiky', face: 'f_goggles', top: 't_vest', bottom: 'b_cargo', shoes: 'sh_black' }, lines: ['정예 장비는 반짝반짝 빛나지.', '레벨이 모자라면 장비를 못 입어.', '마을 대장간에서 장비를 강화해 봐!'] }
  ];
  /* v80 조선군 진영 사람들 (마을마다 · Meshy 그림 img/v79/jo_*.png · 말 걸면 lines 중 하나) */
  const ARMY = {
    spear: { name: '조선 창병', img: 'jo_spear', color: '#9AE6FF', lines: ['왜군이 또 몰려온다는 소식이오!', '창끝을 잘 갈아 두었소.', '이 마을은 우리가 지키겠소!'] },
    bow: { name: '조선 궁수', img: 'jo_bow', color: '#9AE6FF', lines: ['편전 한 발이면 백 보 밖도 맞히지!', '조총보다 활이 빠르다오.', '사냥터 왜군을 조심하시오.'] },
    militia: { name: '의병', img: 'jo_militia', color: '#9AF0B0', lines: ['나라가 어려우니 농사짓던 손으로 칼을 들었소.', '우리 고을은 우리가 지킨다!', '의병장께서 곧 오신다오.'] },
    porter: { name: '군량 짐꾼', img: 'jo_porter', color: '#FFD27A', lines: ['군량미 나르는 중이오, 비켜 주시오!', '수레가 무거워 허리가 휘겠소.', '쌀 한 톨도 귀한 때라오.'] },
    monk: { name: '승병', img: 'jo_monk', color: '#FFD27A', lines: ['산사의 스님들도 나라를 위해 일어섰소.', '나무아미타불… 그래도 싸움은 싸움이오.', '몸과 마음을 함께 단련하시오.'] },
    horse: { name: '기마 순찰병', img: 'jo_horse', color: '#9AE6FF', h: 76, lines: ['순찰 중이오! 이상 없소!', '말이 지쳤으니 잠깐 쉬어 가겠소.', '왜군 척후가 보이면 알려 주시오.'] },
    general: { name: '조선 장수', img: 'jo_general', color: '#FFE45C', h: 70, lines: ['마지막 왜성만 무너뜨리면 된다!', '그대의 활약은 진영에도 소문이 났소.', '모두 자리를 지켜라!'] },
    doctor: { name: '군의관', img: 'jo_doctor', color: '#FF9AA0', lines: ['다친 병사가 너무 많소… 약초가 모자라오.', '물약은 약방 아씨에게서 사 가시오.', '조금만 참게, 곧 나을 걸세.'] },
    hurt1: { name: '다친 병사', img: 'jo_hurt1', color: '#FF8A8E', h: 46, lines: ['으윽… 왜군 조총에 맞았소…', '물… 물 한 모금만…', '조금만 쉬면 다시 싸울 수 있소…'] },
    hurt2: { name: '다친 병사', img: 'jo_hurt2', color: '#FF8A8E', h: 52, lines: ['다리를 다쳐 걸을 수가 없소…', '동료들은 아직 사냥터에…', '꼭 왜군을 몰아내 주시오!'] }
  };
  // v60 마을 대장간 (마을마다 한 명 · 서 있음 · 가까이 가면 강화 창)
  const SMITH = { name: '대장장이 무쇠', color: '#FFB86B', av: { skin: 's4', hair: 'h_spiky', face: 'f_goggles', top: 't_vest', bottom: 'b_cargo', shoes: 'sh_black' },
    hello: ['불이 잘 달궈졌네! 뭘 두드려 볼까?', '강화는 운이야. 실패하면 장비가 산산조각 나니 각오하게!', '+10 까지 가면 전설이 되는 거지. 허허!', '높이 올라갈수록 망치가 무거워진다네. 골드도 두 배씩!'],
    lines: ['땅! 땅! 땅!', '강화하러 왔나?', '불꽃이 좋구먼!'] };

  window.GoRPGData = { MAX_LV, REGIONS, recOf, LV_RANGE, SHAPES, MAPS, F, STAT, TIER, SLOT_NAME, ITEMS, POTIONS, ELEM, SKILLS, FUSION, fusionOf, BUILDINGS, CASTLE, NPCS, VILLAGERS, ARMY, GEAR_BASE, OPTS, GRADE, ENH, BAG, SELL, RG_EL, SMITH, reqOf, HELL };
})();
