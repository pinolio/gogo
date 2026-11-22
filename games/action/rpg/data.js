/*
 * skillcom RPG (RPG) — 게임 데이터 (지도 · 몬스터 · 장비 · 포션 · 마법)
 *  ※ 숫자를 고치면 바로 게임에 반영됩니다. 밸런스 조정은 이 파일에서 합니다.
 *
 *  세계 구조 (총 99칸: 마을 9 + 사냥터 90)
 *    마을1 → 사냥터 1~10 → 마을2 → 사냥터 11~20 → … → 마을9(부산 · 부산진성 도원수) → 사냥터 81~90
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
    { name: '의주', short: '의주', ground: ['#7CC66A', '#6DB85C'], path: '#D8C08A', block: 'tree', block2: 'rock', deco: ['#FFE45C', '#FF8AB0', '#FFFFFF'], water: '#4FA8E8', sky: '#BFE6FB',
      fields: ['보리밭 들판', '토끼 언덕', '민들레 둑길', '개울 빨래터', '버섯 솔숲', '숯막 터', '이끼 굴 어귀', '장승 고개', '돌다리 밑', '큰 슬라임 둥지'] },
    { name: '평양', short: '평양', castle: { img: 'bld_pyongyang', name: '평양성', A: [335, 534], B: [482, 597], u: [-126, 67], iw: 940, ih: 700, lord: '평양성 수문장', hello: ['대동문을 지키는 수문장이오. 평양은 옛 고구려의 도읍이었소.', '왜군에게 빼앗겼던 평양성을 1593년 정월에 되찾았소!'], info: '고구려의 옛 도읍이에요. 임진왜란 때 왜군에게 빼앗겼다가 1593년 1월 조선과 명나라 연합군이 되찾았어요. 대동문은 평양성 동쪽의 큰 문이에요.' }, ground: ['#4E9E58', '#438F4D'], path: '#B99A66', block: 'pine', block2: 'rock', deco: ['#B8F28A', '#FFD23F', '#9AE6FF'], water: '#3A8FD0', sky: '#A9DCC0',
      fields: ['대숲 입구', '덩굴 오솔길', '반딧불 연못', '부엉이 고목', '여우 골짜기', '사냥꾼 움막', '쓰러진 고목', '왜군 척후 진지', '서낭당 터', '숲의 수호자'] },
    { name: '한양', short: '한양', castle: { img: 'bld_hanyang', name: '한양 도성', A: [330, 542], B: [487, 588], u: [-126, 67], iw: 940, ih: 695, lord: '도성 수문장', hello: ['여기는 조선의 도읍 한양이오. 숭례문을 지나면 도성 안이오.', '왜군이 쳐들어온 지 스무 날 만에 도성을 빼앗겼었소… 다시는 그런 일이 없게 하리다.'], info: '조선의 수도예요. 숭례문(남대문)은 도성의 남쪽 큰 문이에요. 임진왜란 때 왜군이 부산에 올라온 지 약 20일 만에 한양을 빼앗겼어요.' }, ground: ['#5E7A4A', '#55703F'], path: '#8A7A55', block: 'deadtree', block2: 'mossrock', deco: ['#C8E08A', '#9AD8C0', '#E8D8FF'], water: '#4A7A6A', sky: '#B8C8B0',
      fields: ['젖은 갈대밭', '개구리 연못', '썩은 나무다리', '도깨비불 늪', '안개 낀 수렁', '무당집 터', '거머리 웅덩이', '뿌리 동굴', '버려진 나루터', '늪의 여왕 둥지'] },
    { name: '충주', short: '충주', ground: ['#E8C878', '#DDB866'], path: '#C9A05A', block: 'cactus', block2: 'sandrock', deco: ['#B5842F', '#F5E2A8', '#7FB24A'], water: '#3BB0C9', sky: '#FBE6B8',
      fields: ['뜨거운 모래톱', '갯바위 길', '소금밭', '해골 협곡', '왜선 상륙지', '무너진 봉수대', '전갈 굴', '바람 깎인 바위', '왜군 해안 진지', '모래 왕의 무덤'] },
    { name: '남원', short: '남원', castle: { img: 'bld_namwon', name: '남원성', D: [248, 633], iw: 940, ih: 698, lord: '남원성 부사', hello: ['남원성에 온 것을 환영하오. 광한루에는 들러 보았소?', '정유년에 이 성에서 군사와 백성이 끝까지 싸웠소.'], info: '정유재란(1597) 때 조선·명나라 군사와 백성들이 끝까지 싸운 성이에요. 그 넋이 만인의총에 잠들어 있어요. 마을의 광한루와 오작교는 춘향전의 무대예요.' }, ground: ['#A8957A', '#9C8A70'], path: '#C8B48E', block: 'pine', block2: 'rock', deco: ['#E8E0C8', '#8AB86A', '#FFD23F'], water: '#5A9AD0', sky: '#D8D0C0',
      fields: ['자갈 고갯길', '광부의 길', '낙석 지대', '독수리 절벽', '버려진 광산', '산성 남문', '동굴 거미 굴', '바위 정령 터', '용암 틈새', '바위산의 왕'] },
    { name: '진주', short: '진주', castle: { img: 'bld_jinju', name: '진주성', D: [248, 633], iw: 940, ih: 700, lord: '진주성 장수', hello: ['진주성은 결코 무너지지 않소!', '남강 절벽 위 누각이 촉석루요. 경치가 참 좋지요.'], info: '1592년 김시민 장군이 약 3,800명의 군사로 2만이 넘는 왜군을 막아 낸 진주대첩의 성이에요(임진왜란 3대첩). 남강 절벽 위의 큰 누각이 촉석루예요.' }, ground: ['#E8F2FB', '#D6E6F5'], path: '#B9CCE0', block: 'snowpine', block2: 'ice', deco: ['#FFFFFF', '#9FD8F5', '#C8B8FF'], water: '#6FC3F0', sky: '#D8ECFF',
      fields: ['눈 덮인 길', '얼어붙은 강', '고드름 동굴', '설인 발자국', '눈보라 고개', '얼음 성벽 터', '왜군 겨울 진지', '빙하 틈', '오로라 언덕', '얼음 여왕의 홀'] },
    { name: '통영', short: '통영', castle: { img: 'bld_tongyeong', name: '통제영', D: [349, 610], iw: 940, ih: 702, lord: '통제영 군관', hello: ['삼도수군통제영에 온 것을 환영하오. 거북선은 보았소?', '바다는 우리 수군이 지키겠소!'], info: '전쟁이 끝난 뒤 1604년 이곳에 삼도수군통제영이 세워졌어요. 가운데 큰 건물이 세병관이에요. 가까운 한산도 앞바다에서 이순신 장군이 한산도대첩(1592)을 거뒀어요.' }, ground: ['#4A3E6A', '#423760'], path: '#6E6090', block: 'crystal', block2: 'rock', deco: ['#C8A8FF', '#7FE0F0', '#FF9AE0'], water: '#5A4AB0', sky: '#2A2440',
      fields: ['반짝이는 굴 입구', '보라 수정길', '메아리 동굴', '지하 호수', '여우 굴', '수정 광맥', '왜군 첩자 은신처', '그림자 통로', '수정 심장부', '수정 골렘의 방'] },
    { name: '동래', short: '동래', ground: ['#9EE0A8', '#90D49A'], path: '#F0E6D0', block: 'blossom', block2: 'cloudrock', deco: ['#FFFFFF', '#FFB3D1', '#FFE45C'], water: '#8AD0FF', sky: '#CFEFFF',
      fields: ['구름 계단', '벚꽃 절터', '무지개 다리', '바람의 법당', '떠다니는 정원', '천둥 구름길', '깃털 둥지', '별빛 전망대', '왜장 본진', '폭풍 거인'] },
    { name: '부산', short: '부산', castle: { img: 'bld_busan', name: '부산진성', quest: true, D: [367, 620], iw: 940, ih: 700, info: '1592년 4월 왜군이 처음 쳐들어와 임진왜란이 시작된 곳이에요. 첨사 정발 장군이 끝까지 싸웠어요.' }, ground: ['#5A4A4A', '#4E3F3F'], path: '#8A6A5A', block: 'lavarock', block2: 'deadtree', deco: ['#FF6A3D', '#FFB13D', '#8A2B2B'], water: '#FF5A2A', sky: '#3A2430',
      fields: ['재 날리는 길', '불타는 강가', '화산 어귀', '검은 바위 숲', '마그마 동굴', '불타는 왜성 외벽', '용의 둥지', '어둠의 제단', '왜성 정문', '흑룡의 왕좌'] }
  ];
  // 사냥터 권장 레벨: 지역 ri 의 k번째(0~9) 사냥터
  const recOf = (ri, k) => (ri < 8 ? ri * 10 + k + 1 : 80 + (k + 1) * 2);
  const LV_RANGE = REGIONS.map((R, ri) => [recOf(ri, 0), recOf(ri, 9)]);   // [[1,10], [11,20] … [71,80], [82,100]]

  /* v149 옛 도트 몬스터 모양(SHAPES 12×12)은 지움 — 몬스터 정의의 shape 이름은 움직임(RIG)·크기 구분에만 씀 */

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
  /* v146 선생님 그림: 도트로만 그리던 장승 3종 · 구미호 5종 → 그림 (img/v79/dot_*.png, 선생님 그림에서 잘라 배경 지움 · 모두 오른쪽을 봄) */
  const DOT_IMG = { '장승 요괴': ['dot_jang8', 60], '바닷가 장승': ['dot_jang33', 60], '산성 장승': ['dot_jang43', 60],
    '구미호': ['dot_fox15', 58], '잿빛 여우 요괴': ['dot_fox26', 58], '설산 구미호': ['dot_fox54', 58], '보라 구미호': ['dot_fox64', 58], '하늘 구미호': ['dot_fox75', 58] };
  MAPS.forEach(m => { const d = m.kind === 'field' && !m.hell && m.mon && DOT_IMG[m.mon.name]; if (d) { m.mon.img79 = d[0]; m.mon.h = d[1]; } });
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
   *  Lv.100 이 되면 마지막 마을(부산) 큰길에 '저승차사 강림' 이 나타나 저승문을 열어 줌
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
    npc: { name: '저승차사 강림', img: 'npc_hell', h: 70, color: '#B8A8FF', av: { skin: 's3', hair: 'h_spiky', top: 't_suit', bottom: 'b_armor', shoes: 'sh_black', back: 'bk_cape' },
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
        guard: { name: '우두 옥졸', img: 'npc_guard', h: 68, img: 'hell1_guard', art: 'h_ox', shape: 'beast', colors: { a: '#7A3A2A', b: '#4A2018', c: '#E8C8A0', d: '#FFD23F' }, kind: 'boss', say: '소머리 옥졸이 쇠몽둥이를 들고 길을 막습니다!', skills: ['charge', 'slam'] },
        judge: { name: '도산 판관', img: 'hell1_judge', art: 'h_judge', shape: 'imp', colors: { a: '#3A3A7A', b: '#20204A', c: '#F0D8B0', d: '#FFD23F' }, kind: 'boss', say: '명부를 잃은 판관이 당신의 죄를 묻습니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '진광대왕', img: 'hell1_king', art: 'h_king1', shape: 'golem', colors: { a: '#C83A3A', b: '#7A1A1A', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '첫째 관문의 대왕이 시험을 시작합니다!', skills: ['blades', 'ring', 'charge', 'summon', 'slam', 'bomb'] } },
      { no: 2, king: '초강대왕', hell: '화탕지옥', short: '화탕', day: '둘째 7일', el: 'fire',
        about: '둘째 7일에 지나는 관문. 남의 것을 빼앗은 죄를 묻고, 펄펄 끓는 가마솥이 줄지어 있습니다. 전쟁 중 마을을 불태운 혼들이 여기서 떠돌고 있습니다.',
        stageName: ['가마솥 거리', '끓는 물 다리', '마두 옥졸의 문', '화탕 판관의 뜰', '초강대왕 전'],
        mob: { name: '가마솥 불망령', img: 'hell2_mob', shape: 'ghost', colors: { a: '#FF8A3D', b: '#C83A1A', c: '#FFE0A0', d: '#FFD23F' }, kind: 'aggro' },
        mob2: { name: '불타는 원혼', img: 'hell2_mob2', shape: 'skeleton', colors: { a: '#FF6A3D', b: '#8A2B1A', c: '#FFD8A0', d: '#FFD23F' }, kind: 'shoot' },
        guard: { name: '마두 옥졸', img: 'hell2_guard', shape: 'beast', colors: { a: '#3A2A2A', b: '#1A1010', c: '#E8C8A0', d: '#FF6A3D' }, kind: 'boss', say: '말머리 옥졸이 삼지창을 겨눕니다!', skills: ['charge', 'fan', 'slam'] },
        judge: { name: '화탕 판관', img: 'hell2_judge', shape: 'imp', colors: { a: '#A82A2A', b: '#5A1414', c: '#F0D8B0', d: '#FFD23F' }, kind: 'boss', say: '화탕 판관이 부채로 불길을 일으킵니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '초강대왕', img: 'hell2_king', shape: 'golem', colors: { a: '#FF8A3D', b: '#A83A1A', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '둘째 관문의 대왕이 불길 속에서 일어납니다!', skills: ['ring', 'fan', 'charge', 'summon', 'slam', 'laser'] } },
      { no: 3, king: '송제대왕', hell: '한빙지옥', short: '한빙', day: '셋째 7일', el: 'water',
        about: '셋째 7일에 지나는 관문. 은혜를 저버린 죄를 묻고, 모든 것이 얼어붙은 얼음 벌판이 펼쳐집니다. 겨울 전투에서 얼어 죽은 혼들이 이곳을 헤맵니다.',
        stageName: ['얼음 벌판', '서리 골짜기', '얼음 옥졸의 굴', '한빙 판관의 얼음 대청', '송제대왕 전'],
        mob: { name: '서리 망령', img: 'hell3_mob', shape: 'ghost', colors: { a: '#BDE8FF', b: '#5AA8E0', c: '#FFFFFF', d: '#3BA8F5' }, kind: 'aggro' },
        mob2: { name: '얼어붙은 원혼', img: 'hell3_mob2', shape: 'skeleton', colors: { a: '#D8F0FF', b: '#5A8AB0', c: '#FFFFFF', d: '#3BA8F5' }, kind: 'shoot' },
        guard: { name: '얼음 옥졸', img: 'hell3_guard', shape: 'golem', colors: { a: '#7FC8F0', b: '#3A6A9A', c: '#E8F8FF', d: '#FFFFFF' }, kind: 'boss', say: '얼음 도깨비 옥졸이 고드름 몽둥이를 듭니다!', skills: ['slam', 'blades', 'charge'] },
        judge: { name: '한빙 판관', img: 'hell3_judge', shape: 'imp', colors: { a: '#5A9AD0', b: '#2A4A7A', c: '#F0E8D8', d: '#BDE8FF' }, kind: 'boss', say: '얼어붙은 명부를 든 판관이 노려봅니다!', skills: ['ring', 'fan', 'summon'] },
        boss: { name: '송제대왕', img: 'hell3_king', shape: 'golem', colors: { a: '#BDE8FF', b: '#5A8AC0', c: '#FFFFFF', d: '#3BA8F5' }, kind: 'boss', say: '셋째 관문의 대왕이 얼음 홀을 듭니다!', skills: ['blades', 'ring', 'fan', 'summon', 'slam', 'gaze'] } },
      { no: 4, king: '오관대왕', hell: '검수지옥', short: '검수', day: '넷째 7일', el: 'wind',
        about: '넷째 7일에 지나는 관문. 거짓 맹세를 한 죄를 묻고, 잎이 칼날인 나무 숲에 바람이 불 때마다 칼잎이 쏟아집니다.',
        stageName: ['칼잎 숲 어귀', '바람 부는 칼나무 길', '까마귀 옥졸의 둥지', '검수 판관의 정자', '오관대왕 전'],
        mob: { name: '칼나무 정령', img: 'hell4_mob', shape: 'plant', colors: { a: '#5AC88A', b: '#2E7A4A', c: '#E0F0E8', d: '#C8D0E0' }, kind: 'shoot' },
        mob2: { name: '회오리 망령', img: 'hell4_mob2', shape: 'ghost', colors: { a: '#B8F0D8', b: '#5AA88A', c: '#FFFFFF', d: '#7FE0C4' }, kind: 'aggro' },
        guard: { name: '까마귀 옥졸', img: 'hell4_guard', shape: 'bat', colors: { a: '#2A2A3A', b: '#14141E', c: '#E8E0D0', d: '#FFD23F' }, kind: 'boss', say: '까마귀머리 옥졸이 낫을 휘두릅니다!', skills: ['charge', 'blades', 'fan'] },
        judge: { name: '검수 판관', img: 'hell4_judge', shape: 'imp', colors: { a: '#3A9A6A', b: '#1A5A3A', c: '#F0D8B0', d: '#FFD23F' }, kind: 'boss', say: '깃털 붓을 든 판관이 바람을 일으킵니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '오관대왕', img: 'hell4_king', shape: 'golem', colors: { a: '#5AC88A', b: '#2A7A4A', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '넷째 관문의 대왕이 칼잎 폭풍을 부릅니다!', skills: ['blades', 'fan', 'charge', 'summon', 'ring', 'windwall'] } },
      { no: 5, king: '염라대왕', hell: '발설지옥', short: '발설', day: '다섯째 7일', el: 'thunder',
        about: '다섯째 7일에 지나는 관문. 거짓말과 헐뜯은 죄를 묻습니다. 염라대왕의 업경대(거울)에는 살아서 한 일이 모두 비칩니다.',
        stageName: ['번개 구름길', '사슬 다리', '천둥 옥졸의 북', '발설 판관의 대청', '염라대왕 전'],
        mob: { name: '번개 망령', img: 'hell5_mob', shape: 'ghost', colors: { a: '#C8A8FF', b: '#6A4AC0', c: '#FFFFFF', d: '#FFE45C' }, kind: 'shoot' },
        mob2: { name: '거짓말쟁이 원혼', img: 'hell5_mob2', shape: 'imp', colors: { a: '#A86AE0', b: '#5A2A8A', c: '#FFE0F0', d: '#FFD23F' }, kind: 'aggro' },
        guard: { name: '천둥 옥졸', img: 'hell5_guard', shape: 'golem', colors: { a: '#6A5AD0', b: '#2A2A7A', c: '#E8E0FF', d: '#FFE45C' }, kind: 'boss', say: '북을 둘러멘 천둥 옥졸이 번개 망치를 듭니다!', skills: ['slam', 'ring', 'charge'] },
        judge: { name: '발설 판관', img: 'hell5_judge', shape: 'imp', colors: { a: '#7A3AB0', b: '#3A1A5A', c: '#F0D8B0', d: '#FFE45C' }, kind: 'boss', say: '번개 붓을 든 판관이 거짓을 밝힙니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '염라대왕', img: 'hell5_king', shape: 'golem', colors: { a: '#2A2A3A', b: '#14141E', c: '#FFD23F', d: '#C8A8FF' }, kind: 'boss', say: '업경대 앞의 염라대왕이 당신을 내려다봅니다!', skills: ['ring', 'blades', 'fan', 'charge', 'summon', 'slam', 'gaze', 'barrage'] } },
      { no: 6, king: '변성대왕', hell: '독사지옥', short: '독사', day: '여섯째 7일', el: 'earth',
        about: '여섯째 7일에 지나는 관문. 남을 해친 죄를 묻고, 독사가 우글거리는 늪 바위 길이 이어집니다.',
        stageName: ['독 이끼 길', '뱀 굴 입구', '뱀팔 옥졸의 굴', '독사 판관의 바위', '변성대왕 전'],
        mob: { name: '독사 망령', img: 'hell6_mob', shape: 'ghost', colors: { a: '#8AE08A', b: '#3A8A3A', c: '#E8FFE8', d: '#C8FF5A' }, kind: 'aggro' },
        mob2: { name: '뱀꼬리 원혼', img: 'hell6_mob2', shape: 'scorpion', colors: { a: '#6AB86A', b: '#2A5A2A', c: '#F0D8B0', d: '#C8FF5A' }, kind: 'shoot' },
        guard: { name: '뱀팔 옥졸', img: 'hell6_guard', shape: 'beast', colors: { a: '#4A8A4A', b: '#1A4A1A', c: '#E8E0C0', d: '#FFD23F' }, kind: 'boss', say: '팔에 뱀을 감은 옥졸이 갈고리를 휘두릅니다!', skills: ['charge', 'blades', 'slam'] },
        judge: { name: '독사 판관', img: 'hell6_judge', shape: 'imp', colors: { a: '#6A7A2A', b: '#3A4A14', c: '#F0D8B0', d: '#C8FF5A' }, kind: 'boss', say: '어깨에 뱀을 올린 판관이 명부를 펼칩니다!', skills: ['fan', 'summon', 'ring'] },
        boss: { name: '변성대왕', img: 'hell6_king', shape: 'golem', colors: { a: '#3A7A3A', b: '#1A3A1A', c: '#FFD23F', d: '#C8FF5A' }, kind: 'boss', say: '여섯째 관문의 대왕 뒤로 거대한 뱀이 똬리를 틉니다!', skills: ['summon', 'blades', 'charge', 'fan', 'slam', 'mines'] } },
      { no: 7, king: '태산대왕', hell: '거해지옥', short: '거해', day: '일곱째 7일', el: 'thunder',
        about: '일곱째 7일에 지나는 관문. 나라와 백성을 배신한 죄를 묻습니다. 거대한 톱니바퀴가 번개를 튀기며 돌아갑니다.',
        stageName: ['톱니 회랑', '불꽃 튀는 공방', '톱 옥졸의 작업장', '거해 판관의 도장실', '태산대왕 전'],
        mob: { name: '톱날 망령', img: 'hell7_mob', shape: 'ghost', colors: { a: '#D8D8E8', b: '#7A7A9A', c: '#FFFFFF', d: '#FFE45C' }, kind: 'shoot' },
        mob2: { name: '태엽 원혼', img: 'hell7_mob2', shape: 'golem', colors: { a: '#B08A5A', b: '#6A4A2A', c: '#F0D8B0', d: '#FFE45C' }, kind: 'aggro' },
        guard: { name: '톱 옥졸', img: 'hell7_guard', shape: 'beast', colors: { a: '#8A6A4A', b: '#4A3A2A', c: '#E8C8A0', d: '#FFE45C' }, kind: 'boss', say: '큰 톱을 멘 옥졸이 불꽃을 튀깁니다!', skills: ['charge', 'slam', 'ring'] },
        judge: { name: '거해 판관', img: 'hell7_judge', shape: 'imp', colors: { a: '#C8A030', b: '#7A5A14', c: '#F0D8B0', d: '#FFE45C' }, kind: 'boss', say: '톱니 도장을 든 판관이 판결을 내립니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '태산대왕', img: 'hell7_king', shape: 'golem', colors: { a: '#C8A030', b: '#7A5A14', c: '#FFE45C', d: '#FFF4C0' }, kind: 'boss', say: '일곱째 관문의 대왕 뒤에서 번개 톱니바퀴가 돕니다!', skills: ['ring', 'charge', 'blades', 'summon', 'slam', 'fan', 'laser', 'bomb'] } },
      { no: 8, king: '평등대왕', hell: '철상지옥', short: '철상', day: '여덟째 100일', el: 'fire',
        about: '죽은 지 100일에 지나는 관문. 생명을 업신여긴 죄를 묻고, 벌겋게 달군 쇠 침상과 쇠사슬이 가득합니다.',
        stageName: ['쇠사슬 복도', '달군 쇠 바닥', '쇠갑옷 옥졸의 대장간', '철상 판관의 저울', '평등대왕 전'],
        mob: { name: '쇠사슬 망령', img: 'hell8_mob', shape: 'ghost', colors: { a: '#FF8A5A', b: '#8A2A1A', c: '#FFD8C0', d: '#FFD23F' }, kind: 'aggro' },
        mob2: { name: '달군 쇠 원혼', img: 'hell8_mob2', shape: 'golem', colors: { a: '#C83A2A', b: '#5A1A14', c: '#FFB08A', d: '#FFD23F' }, kind: 'shoot' },
        guard: { name: '쇠갑옷 옥졸', img: 'hell8_guard', shape: 'golem', colors: { a: '#5A5A6A', b: '#2A2A3A', c: '#FF8A3D', d: '#FFD23F' }, kind: 'boss', say: '달군 쇠갑옷 옥졸이 철퇴를 돌립니다!', skills: ['slam', 'charge', 'ring'] },
        judge: { name: '철상 판관', img: 'hell8_judge', shape: 'imp', colors: { a: '#8A1A1A', b: '#4A0A0A', c: '#F0D8B0', d: '#FF8A3D' }, kind: 'boss', say: '쇠 명부를 든 판관이 쇠 도장을 찍습니다!', skills: ['fan', 'summon', 'ring'] },
        boss: { name: '평등대왕', img: 'hell8_king', shape: 'golem', colors: { a: '#7A7A8A', b: '#C83A2A', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '여덟째 관문의 대왕이 정의의 저울을 기울입니다!', skills: ['blades', 'ring', 'slam', 'charge', 'summon', 'fan', 'hook'] } },
      { no: 9, king: '도시대왕', hell: '풍도지옥', short: '풍도', day: '아홉째 1년', el: 'wind',
        about: '죽은 지 1년에 지나는 관문. 남을 속인 죄를 묻고, 끝없는 회오리바람이 혼을 이리저리 날려 보냅니다.',
        stageName: ['모래바람 들판', '회오리 언덕', '바람주머니 옥졸', '풍도 판관의 누각', '도시대왕 전'],
        mob: { name: '회오리 망령', img: 'hell9_mob', shape: 'ghost', colors: { a: '#C8E0D8', b: '#6A9A8A', c: '#FFFFFF', d: '#7FE0C4' }, kind: 'shoot' },
        mob2: { name: '날리는 원혼', img: 'hell9_mob2', shape: 'skeleton', colors: { a: '#B8C8D8', b: '#5A6A7A', c: '#FFFFFF', d: '#7FE0C4' }, kind: 'aggro' },
        guard: { name: '바람주머니 옥졸', img: 'hell9_guard', shape: 'golem', colors: { a: '#8AB8B0', b: '#3A6A64', c: '#E8F0E8', d: '#FFD23F' }, kind: 'boss', say: '바람주머니를 멘 거인 옥졸이 볼을 부풀립니다!', skills: ['fan', 'charge', 'ring'] },
        judge: { name: '풍도 판관', img: 'hell9_judge', shape: 'imp', colors: { a: '#5AB0E0', b: '#2A5A7A', c: '#F0D8B0', d: '#7FE0C4' }, kind: 'boss', say: '소매가 펄럭이는 판관이 명부를 날립니다!', skills: ['fan', 'ring', 'summon'] },
        boss: { name: '도시대왕', img: 'hell9_king', shape: 'golem', colors: { a: '#3AA8A0', b: '#1A5A54', c: '#E8F0F0', d: '#FFD23F' }, kind: 'boss', say: '아홉째 관문의 대왕이 큰 부채로 회오리를 부릅니다!', skills: ['fan', 'ring', 'charge', 'blades', 'summon', 'slam', 'whirl'] } },
      { no: 10, king: '오도전륜대왕', hell: '흑암지옥', short: '흑암', day: '마지막 3년', el: 'dark',
        about: '죽은 지 3년에 지나는 마지막 관문. 다음 생이 정해지는 곳입니다. 명부를 훔친 왜장의 원혼이 어둠 속에 숨어 있습니다. 대왕을 이기면 명부를 되찾습니다!',
        stageName: ['어둠의 문', '그림자 미로', '그림자 옥졸의 등불', '흑암 판관의 마지막 심판', '오도전륜대왕 전'],
        mob: { name: '그림자 망령', img: 'hell10_mob', shape: 'ghost', colors: { a: '#5A4A7A', b: '#1A1430', c: '#C8A8FF', d: '#B08AFF' }, kind: 'aggro' },
        mob2: { name: '명부 도둑 왜장 원혼', img: 'hell10_mob2', shape: 'samurai', colors: { a: '#2A2A36', b: '#16161E', c: '#C8A8FF', d: '#B08AFF' }, kind: 'shoot' },
        guard: { name: '그림자 옥졸', img: 'hell10_guard', shape: 'golem', colors: { a: '#3A2A5A', b: '#14102A', c: '#C8A8FF', d: '#FFD23F' }, kind: 'boss', say: '등불을 든 그림자 옥졸이 낫을 듭니다!', skills: ['summon', 'charge', 'blades'] },
        judge: { name: '흑암 판관', img: 'hell10_judge', shape: 'imp', colors: { a: '#1A1430', b: '#0A0818', c: '#F0D8B0', d: '#B08AFF' }, kind: 'boss', say: '빛나는 명부를 든 판관이 마지막 심판을 시작합니다!', skills: ['ring', 'fan', 'summon'] },
        boss: { name: '오도전륜대왕', img: 'hell10_king', shape: 'golem', colors: { a: '#3A2A5A', b: '#B08AFF', c: '#FFD23F', d: '#FFF4C0' }, kind: 'boss', say: '마지막 대왕 뒤에서 윤회의 바퀴가 돌기 시작합니다!', skills: ['ring', 'blades', 'fan', 'charge', 'summon', 'slam', 'realm', 'barrage'] } }
    ]
  };
  HELL.gates.forEach(g => { ['mob', 'mob2', 'guard', 'judge', 'boss'].forEach(k => { if (g[k]) g[k].el = g.el; }); });
  HELL.gates.forEach(g => ['guard', 'judge', 'boss'].forEach(k => { if (g[k]) g[k].rig = 'biped'; }));   // v83 옥졸·판관·대왕 Meshy 그림은 사람 모양 → 두 발로 걷기   // 관문 몬스터 = 관문 속성
  /* v130 저승 웹툰: 관문마다 옥졸 · 판관 · 대왕이 차례로 나와 '여기는 어디, 나는 누구'를 소개 (game.js showToon)
   *  [옥졸, 판관, 대왕] — 관문에 처음 들어갈 때 4컷 웹툰 · 3단계 옥졸 · 4단계 판관 · 5단계 대왕이 나올 때 그 한 컷 */
  const HELL_INTRO = [
    ['여기는 칼날이 빼곡히 박힌 산, 도산지옥이다! 나는 이 칼산 길목을 지키는 우두 옥졸. 맨발로 오를 각오는 됐느냐?',
     '나는 도산 판관. 생명을 함부로 한 죄를 명부에 적는 자다. 그런데 왜장이 명부를 훔쳐 가 텅 비었구나… 네 죄부터 다시 적어 주마!',
     '나는 첫 7일의 문을 다스리는 진광대왕이다. 전쟁에서 칼에 쓰러진 혼들이 이 산을 메웠다. 살아 있는 자여, 네 칼이 얼마나 곧은지 보자!'],
    ['히히힝! 펄펄 끓는 가마솥이 줄지어 선 화탕지옥이다. 나는 삼지창으로 솥을 젓는 마두 옥졸! 너도 솥에 한번 들어가 보겠느냐?',
     '나는 화탕 판관. 남의 것을 빼앗은 죄를 이 부채 불길로 묻는다. 마을을 불태운 자들의 이름이 아직 다 지워지지 않았다.',
     '둘째 7일의 문, 화탕지옥의 주인 초강대왕이다. 불길보다 뜨거운 마음이 있느냐? 없다면 이 솥에서 녹아 버리리라!'],
    ['으드득… 여기는 모든 것이 얼어붙은 한빙지옥이다. 나는 고드름 몽둥이를 든 얼음 옥졸! 발이 얼기 전에 돌아가라!',
     '나는 한빙 판관. 은혜를 저버린 죄를 묻는다. 겨울 싸움에서 얼어 죽은 혼들이 아직 여기서 떨고 있지… 너는 누구의 은혜를 입고 왔느냐?',
     '셋째 7일의 문을 지키는 송제대왕이다. 이 얼음 홀로 차갑게 묻겠다. 너의 마음은 얼음보다 단단하냐?'],
    ['까악! 잎사귀가 모두 칼날인 숲, 검수지옥에 들어왔구나. 나는 낫을 든 까마귀 옥졸이다. 바람이 불면 칼잎이 쏟아지니 조심해라!',
     '나는 검수 판관. 거짓 맹세를 한 죄를 깃털 붓으로 적는다. 한 번 한 약속은 칼보다 무겁다는 걸 알고 있느냐?',
     '넷째 7일의 문, 오관대왕이다. 맹세를 어긴 혼은 칼잎 폭풍을 피할 수 없다. 너의 약속이 진짜인지 바람이 알려 주리라!'],
    ['둥! 둥! 여기는 거짓말한 혀를 벌하는 발설지옥이다. 나는 천둥북을 멘 천둥 옥졸! 거짓말쟁이는 번개 망치를 맞을 테다!',
     '나는 발설 판관. 번개 붓으로 거짓과 참을 가른다. 남을 헐뜯은 말 한마디도 이 붓을 피해 가지 못한다.',
     '나는 다섯째 7일의 문을 다스리는 염라대왕이다. 이 업경대에는 네가 살아서 한 일이 모두 비친다. 자, 거울 앞에 서 보거라!'],
    ['쉬이익… 독사가 우글거리는 늪, 독사지옥이다. 나는 팔에 뱀을 감은 뱀팔 옥졸. 내 갈고리와 뱀, 둘 다 피할 수 있겠느냐?',
     '나는 독사 판관. 남을 해친 죄를 묻는다. 내 어깨의 뱀은 거짓말을 하면 바로 알아채고 문다네.',
     '여섯째 7일의 문, 변성대왕이다. 내 뒤의 큰 뱀이 똬리를 풀기 전에 네 힘을 보여라!'],
    ['끼기긱! 거대한 톱니가 번개를 튀기며 도는 거해지옥이다. 나는 큰 톱을 멘 톱 옥졸! 톱니 사이에 끼지 않게 조심해라!',
     '나는 거해 판관. 나라와 백성을 배신한 죄를 이 톱니 도장으로 찍는다. 왜군 편에 선 자들의 이름이 여기 가득하지.',
     '일곱째 7일의 문을 다스리는 태산대왕이다. 번개 톱니바퀴가 멈추지 않는 한 배신자는 쉬지 못한다. 너는 끝까지 백성 편에 섰느냐?'],
    ['철컹! 벌겋게 달군 쇠 침상이 가득한 철상지옥이다. 나는 달군 쇠갑옷 옥졸! 내 철퇴는 식는 법이 없지!',
     '나는 철상 판관. 생명을 업신여긴 죄를 쇠 명부에 새기고 쇠 도장을 찍는다. 한 번 찍힌 도장은 절대 지워지지 않는다.',
     '죽은 지 100일, 여덟째 문의 평등대왕이다. 이 저울은 왕도 백성도 똑같이 단다. 네 마음의 무게를 달아 보자!'],
    ['후우우웅! 끝없는 회오리가 부는 풍도지옥이다. 나는 바람주머니를 멘 거인 옥졸. 볼 한 번 부풀리면 넌 저 멀리 날아간다!',
     '나는 풍도 판관. 남을 속인 죄를 묻는다. 속인 말은 바람처럼 흩어져도 이 명부는 하나도 놓치지 않지.',
     '죽은 지 1년, 아홉째 문의 도시대왕이다. 내 큰 부채가 회오리를 부르면 거짓은 모두 날아가 버린다. 버틸 수 있겠느냐?'],
    ['…쉿. 빛 한 점 없는 흑암지옥이다. 나는 등불을 든 그림자 옥졸. 이 등불이 꺼지면 너도 어둠이 된다.',
     '나는 흑암 판관, 마지막 심판을 맡은 자다. 명부를 훔친 왜장의 원혼이 이 어둠 어딘가에 숨어 있다. 그 원혼을 쫓는 너는 누구냐?',
     '나는 마지막 3년의 문, 다음 생을 정하는 오도전륜대왕이다. 윤회의 바퀴가 돈다. 나를 이기면 명부를 돌려주마. 마지막 시험이다!']
  ];
  HELL.gates.forEach((g, i) => { const t = HELL_INTRO[i] || []; g.guard.intro = t[0]; g.judge.intro = t[1]; g.boss.intro = t[2]; });
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
   *  v60 저항 = 1포인트마다 물리 방어 +0.5% · 속성 방어(불·물·바람·땅·번개·빛·어둠 모두) +0.5% */
  const STAT = {
    keys: ['str', 'dex', 'int', 'vit', 'res'],
    str: { name: '힘', color: '#FF8A8E', desc: '주는 피해 +2% (기본 공격·마법 모두)', dmg: 2 },
    dex: { name: '민첩', color: '#9AF0B0', desc: '이동 속도 +0.7%', spd: 0.7 },   // v131 1% → 0.7% (환생으로 최대치가 늘어 너무 빨라지지 않게)
    int: { name: '지혜', color: '#C8A8FF', desc: '마나 회복 +4%', mpRegen: 4 },
    vit: { name: '체력', color: '#FFB86B', desc: '최대 체력 +2% (기본 체력 기준)', hpPct: 2 },
    res: { name: '저항', color: '#7FE0F0', desc: '물리 방어 +0.5% · 속성 방어 +0.5% (불·물·바람·땅·번개·빛·어둠)', pdef: 0.5, edef: 0.5 },
    max: Infinity, spdMax: 100, baseCrit: 8,   // v149 스탯 최대치 없앰 (선생님) · 이동 속도 효과만 최대 +100%
    critDmg: 1.6, atkCd: 0.42,
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
  // v150 숨은 던전 '사신의 땅' 특별 장비 (설계서 6·7장) — 일반 장비처럼 하나하나 옵션이 붙음 (드랍 목록 GEAR_BASE 에는 안 넣음)
  //  왕을 죽인 검: Lv.80 · 공격 120 (선생님 11/15) · 환생한 사람만 39번 사냥터에서 (일반 3% · 보스 30%) · 광개토대왕에게 평타·마법 ×2 (끼지 않으면 0)
  //  광개토대왕의 반지: Lv.100 · 전설 반지(rg10)의 1.2배 · 옵션 4개 = ① 모든 속성 방어 15% 고정 ② 좋은 옵션 1개 최대치 ③④ 무작위(마이너스 가능) · 거래 안 됨(팔기만)
  ITEMS.swKing = { id: 'swKing', slot: 'weapon', name: '왕을 죽인 검', tier: 8, rare: false, legend: false, req: 80, st: { atk: 120 }, price: Math.round(20 + 80 * 80 * 0.9), look: 'sword', kingSword: true,
    desc: '어디선가 굴러들어온 검.', descKing: '어느 날 광개토대왕을 죽인 검.' };
  ITEMS.rgKing = { id: 'rgKing', slot: 'ring', name: '광개토대왕의 반지', tier: 9, rare: true, legend: true, req: 100, st: { mp: Math.round(ITEMS.rg10.st.mp * 1.2), mag: Math.round(ITEMS.rg10.st.mag * 1.2) }, price: ITEMS.rg10.price * 2,
    noTrade: true, icon79: 'ic_rg_king', desc: '사방신을 거느린 대왕의 반지. 잡을 때마다 하나씩.', goodOpts: ['dmg', 'atkP', 'magP', 'critD', 'crit'] };
  /* v173 이순신 장군의 신발 (선생님 11/20): 와키자카 야스하루를 이기면 · 전설 신발(bt10)의 1.2배 · 옵션 4개 = ① 이동 속도 고정(spd, 선생님이 정함) ② 좋은 옵션 1개 최대치 ③④ 무작위 · 거래 안 됨 */
  ITEMS.btYi = { id: 'btYi', slot: 'boots', name: '이순신 장군의 신발', tier: 9, rare: true, legend: true, req: 100, st: { def: Math.round(ITEMS.bt10.st.def * 1.2), spd: Math.round(ITEMS.bt10.st.spd * 1.2) }, price: ITEMS.bt10.price * 2,
    noTrade: true, icon79: 'ic_bt_yi', desc: '바다를 지킨 장군의 신발. 와키자카를 이길 때마다 하나씩.', spdOpt: 15, goodOpts: ['dmg', 'atkP', 'magP', 'critD', 'crit'] };

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
    e_dark: { name: '어둠 속성 방어', max: 20, el: 'dark' },   // v87
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
  /* v87 일반 사냥터 몬스터에도 속성 (상성: 약점 ×1.3 · 같은 속성 ×0.7 — 저승과 같은 표 HELL.weak)
   *  그 지역 몬스터·보스 = 지역 속성(RG_EL) · 왜군 = 종류마다 속성 (아래 WAE_EL) */
  const WAE_EL = { wae_bow: 'wind', wae_spear: 'earth', wae_gun: 'fire', wae_ronin: 'water', wae_ninja: 'dark', wae_flag: 'wind', wae_drum: 'thunder', wae_monk: 'light',
    wae_samurai: 'thunder', wae_captain: 'earth', wae_cavalry: 'wind', wae_general: 'dark' };
  MAPS.forEach(m => {
    if (m.kind !== 'field' || m.hell) return;
    [m.mon, m.mon2].forEach(d => { if (d && !d.el) d.el = (d.img79 && WAE_EL[d.img79]) || RG_EL[m.region]; });
  });

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
    dark: { name: '어둠', color: '#B08AFF', light: '#E8DCFF', fx: 'curse' }   // v87 어둠 마법 추가 · 저주 = 받는 피해 +20% (4초)
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
    ['elemental', '원소 해방', 'light', 100, 'nova', 6.0, 70, 15, { radius: 260 }],
    // v87 어둠 마법 4개 (저주: 맞은 적이 4초 동안 받는 피해 +20%)
    ['darkorb', '어둠 구슬', 'dark', 12, 'bolt', 1.6, 8, 1.2, {}],
    ['cursefog', '저주의 안개', 'dark', 42, 'nova', 2.3, 18, 5, { radius: 120 }],
    ['shadowspear', '그림자 창', 'dark', 70, 'beam', 3.4, 28, 4.5, { len: 330, w: 34 }],
    ['abyss', '심연의 비', 'dark', 90, 'rain', 4.4, 46, 8, { count: 8, radius: 80 }]
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
    ['thunder', 'light', '섬광 돌진', 'dash', { len: 280 }],
    // v87 어둠 융합 6개
    ['fire', 'dark', '지옥불', 'pool', { radius: 100, dur: 4 }],
    ['water', 'dark', '검은 소용돌이', 'nova', { radius: 150 }],
    ['wind', 'dark', '그림자 칼바람', 'bolt', { count: 4, pierce: true }],
    ['earth', 'dark', '무덤 가시', 'rain', { count: 8, radius: 65 }],
    ['thunder', 'dark', '검은 번개', 'beam', { len: 340, w: 46 }],
    ['light', 'dark', '혼돈의 일격', 'nova', { radius: 180 }]
  ];
  const fusionOf = (e1, e2) => FUSION.find(f => (f[0] === e1 && f[1] === e2) || (f[0] === e2 && f[1] === e1)) || null;

  /* ---------------- 마을 건물 ----------------
   *  type: potion(포션 가게) · school(마법 학교) · chief(이장 집) · castle(성, 마지막 마을)
   *  x, y, w, h = 칸 (마을 지도 36 × 22) · door = 문 칸 (건물 아래 가운데) */
  const BUILDINGS = [
    { type: 'potion', name: '약방', x: 4, y: 5, w: 7, h: 4, roof: '#D2343A' },   // v144 선생님 그림으로 바꾸며 크게 (예전 x5 y4 6×4)
    { type: 'school', name: '도술 서원', x: 22, y: 5, w: 11, h: 4, roof: '#7E4DE0' },   // v144 (예전 x25 y4 7×4)
    { type: 'chief', name: '이장 댁', x: 4, y: 15, w: 9, h: 4, roof: '#3E9E58' },   // v144 (예전 x6 y13 6×4)
    { type: 'train', name: '훈련장', x: 13, y: 6, w: 5, h: 3, roof: '#C8402A' }   // v144 훈련장 (허수아비 10초 딜량) · v150 그림 bld_train.png = Gemini (한옥 훈련장)
  ];
  const CASTLE = { type: 'castle', name: '부산진성', quest: true, x: 23, y: 14, w: 10, h: 6, roof: '#5A5A70' };   // v144 새 성 그림 · 커진 서원과 안 겹치게 2칸 아래로 (예전 y12)

  /* ---------------- 사람(NPC) · v41 ----------------
   *  av = 사이트 아바타 옷 그대로 (avatar/avatar.js 의 아이템 id) → 플레이어와 같은 그림체
   *  hello = 창을 열 때 하는 말 (아무거나 하나) · lines = 근처에 가면 머리 위 말풍선 */
  const NPCS = {
    potion: { name: '약방 아씨 미나', img: 'npc_potion', h: 62, names: ['약방 아씨 미나', '약방 아씨 소연', '약방 아씨 연화', '약방 아씨 해랑', '약방 아씨 단비', '약방 아씨 설아', '약방 아씨 보라', '약방 아씨 은비', '약방 아씨 초롱'], color: '#FF9AA0', av: { skin: 's2', hair: 'h_bun', face: 'f_glasses', top: 't_doctor', bottom: 'b_skirt', shoes: 'sh_red' },
      hello: ['어서 와요! 오늘 끓인 물약이 아주 잘 됐어요.', '사냥 가기 전에 물약은 넉넉히! 쓰러지면 손해예요.', '안 쓰는 물건은 여기서 팔아도 돼요. 값은 좀 깎이지만요.'] },
    school: { name: '서원 도사 루멘', img: 'npc_school', h: 66, names: ['서원 도사 루멘', '서원 도사 청암', '서원 도사 운곡', '서원 도사 해암', '서원 도사 석봉', '서원 도사 설봉', '서원 도사 현무', '서원 도사 운학', '서원 도사 백운'], color: '#D8B8FF', av: { skin: 's1', hair: 'h_long', hat: 'hat_wizard', face: 'f_beard', top: 't_robe', bottom: 'b_ninja', shoes: 'sh_black' },
      hello: ['마법은 원소의 대화란다. 두 원소를 섞으면 새 마법이 태어나지.', '레벨이 오르면 다시 오너라. 더 강한 마법을 가르쳐 주마.', '같은 원소끼리는 섞이지 않는단다. 서로 다른 것이 만나야 새것이 되지.'] },
    chief: { name: '이장님', img: 'npc_chief', h: 66, names: ['의주 이장님', '평양 이장님', '한양 이장님', '충주 이장님', '남원 이장님', '진주 이장님', '통영 이장님', '동래 이장님', '부산 이장님'], color: '#9AF0B0', av: { skin: 's3', hair: 'h_topknot', hat: 'hat_gat', face: 'f_mustache', top: 't_hanbok_m', bottom: 'b_hanbok_m', shoes: 'sh_black' },
      hello: ['어서 오게! 여기가 자네의 귀환 장소일세.', '가 본 곳이면 어디든 보내 주지. 이동은 무료라네.', '무리하지 말게. 쓰러지면 이 집 앞에서 다시 깨어날 걸세.'] },
    castle: { name: '도원수', img: 'npc_castle', h: 70, color: '#FFE45C', av: { skin: 's1', hair: 'h_curly', hat: 'hat_emperor', face: 'f_beard', top: 't_suit', bottom: 'b_armor', shoes: 'sh_gold', back: 'bk_cape' },
      hello: ['잘 왔소. 왜성 깊은 곳에서 흑룡 이무기가 깨어나고 있소…', '왜군과 요괴가 한데 엉켜 몰려오고 있소. 힘을 길러 두시오.'] },
    guard: { name: '성 파수꾼', color: '#C9D0F0', img: 'npc_guard', h: 66,   // v130 그림 파수꾼 (투구·창·방패) · 그림을 못 받으면 아래 아바타
      av: { skin: 's4', hair: 'h_short', hat: 'hat_darkhelm', top: 't_armor', bottom: 'b_armor', shoes: 'sh_black' },
      lines: ['예를 갖추시오.', '성은 안전하오.', '왜성 쪽 용암 지대는 조심하시오!'] }
  };
  // 마을을 돌아다니는 사람 (마을마다 2명씩 번갈아)
  const VILLAGERS = [
    { name: '꼬마 콩이', img: 'npc_vil1', h: 54, names: ['꼬마 콩이', '꼬마 팥이', '꼬마 보리', '꼬마 조약돌', '꼬마 별이', '꼬마 눈송이', '꼬마 다람', '꼬마 꽃님', '꼬마 봄이'], av: { skin: 's2', hair: 'h_twin', top: 't_pe', bottom: 'b_shorts', shoes: 'sh_red' }, lines: ['분수 물 진짜 시원해!', '오른쪽 끝으로 가면 사냥터래!', '나도 커서 마법사 될 거야!'] },
    { name: '나무꾼 아저씨', img: 'npc_vil2', h: 66, names: ['나무꾼 아저씨', '나무꾼 덕배', '나무꾼 칠복', '나무꾼 만석', '나무꾼 억쇠', '나무꾼 두쇠', '나무꾼 삼돌', '나무꾼 봉구', '나무꾼 갑돌'], av: { skin: 's3', hair: 'h_short_brown', hat: 'hat_straw', face: 'f_mustache', top: 't_overall', bottom: 'b_jeans', shoes: 'sh_boots' }, lines: ['숲에 슬라임이 많아졌어.', '약방 물약은 정말 잘 들어.', '이장님 댁에 들르면 멀리 갈 수 있다네.'] },
    { name: '여행자 하늘', img: 'npc_vil3', h: 64, names: ['여행자 하늘', '여행자 바다', '여행자 노을', '여행자 새벽', '여행자 들꽃', '여행자 솔바람', '여행자 이슬', '여행자 달님', '여행자 해님'], av: { skin: 's1', hair: 'h_ponytail', hat: 'hat_elfhood', top: 't_elf', bottom: 'b_cargo', shoes: 'sh_hightop', back: 'bk_bag2' }, lines: ['왜군이 사냥터마다 숨어 있대!', '보스는 꼭 장비를 떨어뜨린대!', '도술 서원에서 융합을 배워 봐.'] },
    { name: '떠돌이 장인 철수', img: 'npc_vil4', h: 64, names: ['떠돌이 장인 철수', '떠돌이 장인 만복', '떠돌이 장인 석구', '떠돌이 장인 태복', '떠돌이 장인 용팔', '떠돌이 장인 순돌', '떠돌이 장인 판돌', '떠돌이 장인 춘삼', '떠돌이 장인 덕구'], av: { skin: 's4', hair: 'h_spiky', face: 'f_goggles', top: 't_vest', bottom: 'b_cargo', shoes: 'sh_black' }, lines: ['정예 장비는 반짝반짝 빛나지.', '레벨이 모자라면 장비를 못 입어.', '마을 대장간에서 장비를 강화해 봐!'] }
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
  // v85 역참 (마을마다 하나) — 다른 마을로 한 번에 이동
  //  레벨 제한 = 가는 마을의 시작 레벨(LV_RANGE[도착][0]) 이상 · 이용료 = 거리(마을 칸 수) × 도착 마을 번호(1~9) × feeUnit G
  //  예) 의주(1) → 평양(2) = 1 × 2 × 20 = 40G · 의주 → 부산(9) = 8 × 9 × 20 = 1,440G · 부산 → 의주 = 8 × 1 × 20 = 160G   (v169 마을 이름: 의주·평양·한양·충주·남원·진주·통영·동래·부산)
  const STATION = { name: '역참지기 바람이', img: 'npc_station', h: 64, names: ['역참지기 바람이', '역참지기 구름이', '역참지기 번개', '역참지기 질풍이', '역참지기 산들이', '역참지기 눈보라', '역참지기 돌개', '역참지기 하늬', '역참지기 회오리'], color: '#9AE6FF', feeUnit: 20, sxFee: 3000, av: { skin: 's2', hair: 'h_short', top: 't_vest', bottom: 'b_cargo', shoes: 'sh_black' },
    hello: ['어디로 모실까요? 말이 바람처럼 달립니다!', '먼 마을일수록 말을 여러 번 갈아타야 해서 값이 올라요.', '그 마을 시작 레벨이 안 되면 위험해서 못 모셔요.', '한 번에 휙! 걸어가는 것보다 훨씬 빠르지요.'],
    lines: ['히히힝~', '말 먹이를 줘야겠군.', '역참 이용하세요!'] };
  const stationFee = (from, to) => Math.abs(to - from) * (to + 1) * STATION.feeUnit;   // from·to = 마을 번호 0~8
  // v60 마을 대장간 (마을마다 한 명 · 서 있음 · 가까이 가면 강화 창)
  const SMITH = { name: '대장장이 무쇠', img: 'npc_smith', h: 64, names: ['대장장이 무쇠', '대장장이 쇠돌', '대장장이 돌쇠', '대장장이 강쇠', '대장장이 단철', '대장장이 쇠북', '대장장이 불꽃', '대장장이 망치', '대장장이 화덕'], color: '#FFB86B', av: { skin: 's4', hair: 'h_spiky', face: 'f_goggles', top: 't_vest', bottom: 'b_cargo', shoes: 'sh_black' },
    hello: ['불이 잘 달궈졌네! 뭘 두드려 볼까?', '강화는 운이야. 실패하면 장비가 산산조각 나니 각오하게!', '+10 까지 가면 전설이 되는 거지. 허허!', '높이 올라갈수록 망치가 무거워진다네. 골드도 두 배씩!'],
    lines: ['땅! 땅! 땅!', '강화하러 왔나?', '불꽃이 좋구먼!'] };

  // v110 NPC 그림(img/v79/npc_*.png) · 같은 그림을 쓰는 마을마다 이름만 다르게 (names[마을 번호 0~8])
  const npcDef = (def, r) => {
    if (def === NPCS.castle && REGIONS[r] && REGIONS[r].castle && REGIONS[r].castle.lord) { const C = REGIONS[r].castle; return Object.assign({}, def, { name: C.lord, hello: C.hello || def.hello }); }   // v169 성마다 다른 성지기 (부산진성은 도원수)
    return def && def.names && def.names[r] && def.names[r] !== def.name ? Object.assign({}, def, { name: def.names[r] }) : def;
  };

  /* ---------------- v149 펫 (선생님 11/15 결정 · 설계서 claude/v149-설계서_숨은던전·사방신·펫.md 8장) ----------------
   *  이장 댁 이장이 판매 · 한 번 뽑기 PET.price G · 확률 = 등급 rate(%) · 잠긴 등급(영웅 = 사방신 넷 · 전설 = 광개토대왕)의 확률은 열린 등급에 비율대로 나눔
   *  스탯 = 가진 펫 모두의 (등급 stat × (1 + 강화 × 0.1)) 를 힘·민첩·지혜·체력·저항 다섯 가지에 모두 더함 · 데리고 다니는 펫(보이기만)은 1마리
   *  강화: 같은 펫 1마리를 재료로 +1 (골드 안 씀) · 최대 +10 · 성공 확률 = 장비 강화와 같음 · 실패하면 keep 확률로 그대로, 나머지는 한 단계 내려감 (부서지지 않음)
   *  mon = 몬스터 이름 (그 몬스터 그림을 작게) · img = 따로 그림(img/v79/<img>.png, 선생님 그림이 오면 넣음) */
  const PET_GRADE = [
    { k: 'n', name: '일반', color: '#FFFFFF', stat: 1, rate: 40 },
    { k: 'a', name: '고급', color: '#9AF0B0', stat: 5, rate: 30 },
    { k: 'r', name: '희귀', color: '#7FC8FF', stat: 10, rate: 20 },
    { k: 'h', name: '영웅', color: '#D8A8FF', stat: 20, rate: 8, lock: 'hero', lockTxt: '사방신 넷을 모두 이기면 열려요' },
    { k: 'l', name: '전설', color: '#FFD23F', stat: 40, rate: 2, lock: 'legend', lockTxt: '광개토대왕을 이기면 열려요' }
  ];
  const PETS = [];
  [['초록 슬라임', '아기 토끼버섯', '노랑 꽃잎몬', '보라 독버섯', '동굴 박쥐', '반딧불 정령', '도깨비불', '모래 슬라임', '눈 슬라임', '빛 버섯'],
   ['숲 늑대', '구미호', '고목 골렘', '모래 늑대', '사막 전갈', '산양', '용암 도마뱀', '얼음 박쥐', '얼음 골렘', '수정 늑대'],
   ['설산 구미호', '빙하 전갈', '보라 구미호', '자수정 용', '하늘 구미호', '깃털 그리핀', '불꽃 정령', '새끼 용', '가마솥 불망령', '번개 망령']]
    .forEach((list, g) => list.forEach((mon, i) => PETS.push({ id: PET_GRADE[g].k + (i + 1), g, name: mon, mon })));
  // 영웅·전설: 선생님 그림이 오기 전까지 비슷한 몬스터 그림을 임시로 (img 가 생기면 그 그림)
  [['h1', 3, '청룡', '자수정 용', 'pet_blue', 'sx_cr'], ['h2', 3, '주작', '불꽃 정령', 'pet_red', 'sx_jj'], ['h3', 3, '백호', '수정 늑대', 'pet_white', 'sx_bh'], ['h4', 3, '현무', '빙하 전갈', 'pet_black', 'sx_hm'],
   ['l1', 4, '광개토대왕', '왜성 수문장', 'pet_king', 'sx_king_idle']].forEach(([id, g, name, mon, img, art]) => PETS.push({ id, g, name, mon, img, art }));   // art = 선생님 그림(있으면 몬스터 그림 대신)
  const PET = { price: 10000, max: 10, per: 0.1, keep: i => (i < 4 ? 1 : i < 7 ? 0.7 : 0.5), maxOwn: 300, scale: 0.46 };

  /* ---------------- v150 숨은 던전 '사신의 땅' (설계서 claude/v149-설계서_숨은던전·사방신·펫.md 1~5장) ----------------
   *  18번 사냥터(왜군 척후 진지) 위쪽 숨은 입구 → 환생 1번 이상만 · 혼자 하는 지도(다른 사람 안 보임) · 25칸 중 새 지도 20장
   *  지도는 world.js 특별 지역(custom)으로 등록 (exits 로 위·아래·왼쪽·오른쪽 연결) · 바닥 = img/v79/sx*_ground·path·water.jpg
   *  보스: 사방신 Lv.250 (자기 속성 피해 0) · 사방신 모두(넷이 한꺼번에) · 광개토대왕 Lv.400 (모든 피해 0, 왕을 죽인 검 → ×2)
   *  img = 보스 그림 (선생님 그림이 오면 img/v79/sx_*.png 로 바꿈 · 지금은 저승 대왕 그림을 임시로) */
  const SASIN = (() => {
    const W2 = 40, H2 = 28, OPP2 = { u: 'd', d: 'u', l: 'r', r: 'l' };
    // 엑셀 배치 (행 0 = 맨 위) · id · 이름 · 종류
    const cells = [
      ['sx_king', 3, 0, '광개토대왕의 전당', 'king'], ['sx_all', 3, 1, '사신의 회합', 'all'], ['sx_npc', 3, 2, '광개토대왕 던전 어귀', 'npc'],
      ['sx_cr', 0, 3, '청룡의 숲', 'cr'], ['sx_p1', 1, 3, '동쪽 신목길', 'path'], ['sx_p2', 2, 3, '푸른 비늘 고개', 'path'], ['sx_x1', 3, 3, '사신의 갈림길', 'path'], ['sx_p3', 4, 3, '붉은 깃 언덕', 'path'], ['sx_p4', 5, 3, '불새의 재 들판', 'path'], ['sx_jj', 6, 3, '주작의 화원', 'jj'],
      ['sx_v1', 3, 4, '네 바람의 길', 'path'],
      ['sx_bh', 0, 5, '백호의 바위산', 'bh'], ['sx_p5', 1, 5, '흰 발톱 골짜기', 'path'], ['sx_p6', 2, 5, '서쪽 쇠바위길', 'path'], ['sx_x2', 3, 5, '아래 갈림길', 'path'], ['sx_p7', 4, 5, '검은 물가', 'path'], ['sx_p8', 5, 5, '거북 등 늪', 'path'], ['sx_hm', 6, 5, '현무의 깊은 못', 'hm'],
      ['sx_v2', 3, 6, '잊힌 비석 길', 'path'], ['sx_v3', 3, 7, '숨은 동굴 안', 'path']
    ];
    const at = {}; cells.forEach(c => { at[c[1] + ',' + c[2]] = c[0]; });
    // 바닥 재질 · 지역(나무·바위 모양) — 길은 자수정 동굴(용굴), 사방신 방은 신의 색
    const LOOK = { path: ['sx', 6], npc: ['sx', 6], all: ['sxa', 6], king: ['sxk', 8], cr: ['sxb', 1], jj: ['sxr', 8], bh: ['sxw', 5], hm: ['sxd', 2] };
    /* v151 선생님 11/15: 길 13칸 = 칸마다 다른 바닥·숲·바위·연못 + 몬스터 3종(19마리) · 난이도 Lv.150(입구) → 190(사방신 방 바로 앞)
     *  사방신 방 바로 앞 칸은 그 신의 땅: 청룡 앞 = 푸른 숲(천둥) · 주작 앞 = 불 맵(용암) · 백호 앞 = 흙빛 바위산 · 현무 앞 = 물 많은 늪
     *  tex = 바닥 그림(없으면 지역 region 의 바닥) · region = 나무·바위 모양 · tree/rock = 무더기 수 · pond = 연못 수 */
    const GOD_ART = ['cr', 'jj', 'bh', 'hm'];   // v151 사방신 방 그림 지도(img/v79/arena_sx_cr·jj·bh·hm.png, Gemini)가 들어온 방 — 그림을 넣으면 'cr' 등을 적음
    const PATH = {
      sx_v3: { tex: 'sx', region: 6, lv: 150, mob: ['f61', 'f62', 'f63'], tree: 3, rock: 12, pond: 1 },   // 숨은 동굴 안 — 자수정 동굴
      sx_v2: { region: 4, lv: 155, mob: ['f41', 'f44', 'f47'], tree: 5, rock: 12, pond: 1 },               // 잊힌 비석 길 — 바위 고개
      sx_x2: { region: 1, lv: 160, mob: ['f11', 'f17', 'f19'], tree: 16, rock: 4, pond: 2 },               // 아래 갈림길 — 깊은 숲
      sx_v1: { region: 7, lv: 165, mob: ['f71', 'f72', 'f77'], tree: 9, rock: 3, pond: 4 },                // 네 바람의 길 — 구름 들판 · 연못
      sx_x1: { region: 0, lv: 170, mob: ['f65', 'f67', 'f78'], tree: 10, rock: 5, pond: 3 },               // 사신의 갈림길 — 들판
      sx_p2: { region: 1, lv: 178, mob: ['f12', 'f13', 'f14'], tree: 16, rock: 3, pond: 2 },               // 푸른 비늘 고개 — 숲
      sx_p1: { tex: 'sxb', region: 1, lv: 190, mob: ['f76', 'f87', 'f19'], tree: 14, rock: 4, pond: 3 },   // 동쪽 신목길 — 청룡 앞 (푸른 숲 · 천둥 도깨비 · 새끼 용)
      sx_p3: { region: 3, lv: 178, mob: ['f34', 'f35', 'f37'], tree: 6, rock: 8, pond: 1 },                // 붉은 깃 언덕 — 메마른 협곡
      sx_p4: { region: 8, lv: 190, mob: ['f82', 'f83', 'f85'], tree: 6, rock: 8, pond: 7 },                // 불새의 재 들판 — 주작 앞 (불 맵 · 용암 웅덩이)
      sx_p6: { region: 4, lv: 178, mob: ['f42', 'f45', 'f49'], tree: 5, rock: 13, pond: 1 },               // 서쪽 쇠바위길 — 바위산
      sx_p5: { tex: 'sxw', region: 4, lv: 190, mob: ['f65', 'f11', 'f28'], tree: 4, rock: 16, pond: 1 },   // 흰 발톱 골짜기 — 백호 앞 (흙빛 바위 · 늑대)
      sx_p7: { region: 2, lv: 178, mob: ['f21', 'f23', 'f27'], tree: 9, rock: 4, pond: 4 },                // 검은 물가 — 갈대늪
      sx_p8: { tex: 'sxd', region: 2, lv: 190, mob: ['f24', 'f52', 'f58'], tree: 6, rock: 3, pond: 9 }     // 거북 등 늪 — 현무 앞 (물 많은 늪 · 빙하 전갈)
    };
    /* v157 선생님 11/17: 그림 지도(사방신·회합·전당)의 그림 속 장애물(기둥·의자·석상·등롱·화로·나무·물·용암·바위)은 못 지나가게
     *  [왼쪽 칸, 위 칸, 오른쪽 칸, 아래 칸] (칸 = 32px · 그림 1280×896 = 40×28칸) · 막는 칸 = 2(그림 지도에선 그리지 않음) · 출구 길은 나중에 다시 뚫음 */
    const ART_BLOCK = {
      king: [[0, 0, 39, 7], [0, 8, 4, 14], [35, 8, 39, 14], [11, 10, 12, 12], [13, 8, 16, 12], [23, 8, 27, 12], [0, 16, 2, 21], [37, 16, 39, 21], [5, 20, 6, 25], [33, 20, 34, 25], [11, 22, 14, 27], [25, 22, 28, 27], [0, 25, 39, 27]],
      cr: [[0, 0, 39, 5], [16, 6, 23, 9], [0, 0, 4, 27], [4, 7, 5, 10], [4, 15, 5, 19], [34, 7, 35, 10], [36, 0, 39, 10], [36, 18, 39, 27], [4, 21, 8, 25], [13, 22, 14, 25], [25, 22, 26, 25], [34, 21, 35, 25], [0, 25, 39, 27]],
      jj: [[0, 0, 39, 5], [15, 6, 24, 9], [4, 6, 6, 9], [34, 7, 35, 10], [33, 10, 36, 18], [37, 0, 39, 27], [34, 16, 39, 27], [0, 0, 2, 9], [0, 19, 3, 27], [5, 21, 9, 25], [30, 23, 39, 27], [0, 25, 39, 27]],
      bh: [[0, 0, 39, 5], [17, 6, 22, 8], [4, 7, 5, 9], [34, 7, 35, 10], [4, 15, 5, 18], [0, 0, 3, 27], [5, 11, 7, 15], [4, 19, 9, 27], [36, 0, 39, 10], [36, 18, 39, 27], [29, 22, 39, 27], [8, 24, 10, 27], [0, 25, 39, 27]],
      hm: [[0, 0, 39, 5], [17, 6, 23, 9], [4, 7, 5, 9], [5, 6, 9, 8], [34, 7, 35, 10], [4, 15, 5, 18], [0, 0, 3, 9], [0, 19, 3, 27], [34, 10, 39, 27], [36, 0, 39, 9], [4, 20, 9, 25], [29, 21, 35, 25], [0, 25, 39, 27]],
      all: [[0, 0, 39, 4], [10, 0, 11, 6], [28, 0, 29, 6], [13, 4, 14, 6], [11, 6, 12, 8], [14, 6, 15, 7], [26, 4, 27, 6], [24, 5, 25, 7], [27, 6, 28, 7], [0, 2, 9, 9], [30, 2, 39, 10], [0, 15, 9, 24], [32, 15, 39, 24], [13, 22, 17, 27], [22, 22, 27, 27], [28, 23, 29, 25], [0, 25, 39, 27]]
    };
    function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function grid(id, ex, kind) {
      const r = seeded('sx-' + id), t = new Array(W2 * H2).fill(0), set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W2 && y < H2) t[y * W2 + x] = v; }, get = (x, y) => t[y * W2 + x];
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (x < 2 || y < 2 || x >= W2 - 2 || y >= H2 - 2) set(x, y, r() < 0.5 ? 2 : 3);   // 테두리 두 칸
      (ART_BLOCK[kind] || []).forEach(([x0, y0, x1, y1]) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, 2); });   // v157 그림 속 장애물
      const cx = W2 >> 1, cy = H2 >> 1, boss = kind !== 'path';
      // 출구 자리 비우기 + 가운데까지 길 (world.js gateSpan 과 같은 자리: 위·아래 = 가운데 열 c-3~c+2 · 왼쪽·오른쪽 = 가운데 행)
      Object.keys(ex).forEach(sd => {
        if (sd === 'u' || sd === 'd') { for (let x = cx - 3; x <= cx + 2; x++) for (let k = 0; k < 3; k++) set(x, sd === 'u' ? k : H2 - 1 - k, 0); for (let y = Math.min(sd === 'u' ? 0 : cy, cy); y <= (sd === 'u' ? cy : H2 - 1); y++) for (let x = cx - 1; x <= cx; x++) set(x, y, 1); }
        else { for (let y = cy - 3; y <= cy + 2; y++) for (let k = 0; k < 3; k++) set(sd === 'l' ? k : W2 - 1 - k, y, 0); for (let x = (sd === 'l' ? 0 : cx); x <= (sd === 'l' ? cx : W2 - 1); x++) for (let y = cy - 1; y <= cy; y++) set(x, y, 1); }
      });
      if (kind === 'all' || kind === 'king' || GOD_ART.includes(kind)) return t;   // v151 사방신 방도 그림 지도가 들어오면 (GOD_ART) 테두리·출구만   // v150 선생님 Gemini 지도 그림을 쓰는 방 — 테두리·출구만 (기둥·바위는 그림에 있음)
      if (boss) {   // 보스 방: 가운데 넓은 마당 (돌기둥 네 개)
        for (let y = cy - 7; y <= cy + 6; y++) for (let x = cx - 11; x <= cx + 10; x++) if (get(x, y) !== 1) set(x, y, 0);
        [[-9, -5], [8, -5], [-9, 4], [8, 4]].forEach(([dx, dy]) => set(cx + dx, cy + dy, 3));
      }
      // 바위·나무 무더기 · 물웅덩이 (길과 출구 앞은 비움)
      const near = (x, y, d) => { for (let b = -d; b <= d; b++) for (let a = -d; a <= d; a++) if (get(clampI(x + a), clampJ(y + b)) === 1) return true; return false; };
      const clampI = v => Math.max(0, Math.min(W2 - 1, v)), clampJ = v => Math.max(0, Math.min(H2 - 1, v));
      const P = PATH[id], nClu = boss ? 6 : P.tree + P.rock;
      for (let k = 0; k < nClu; k++) {
        const x0 = 4 + Math.floor(r() * (W2 - 8)), y0 = 4 + Math.floor(r() * (H2 - 8)), n = 2 + Math.floor(r() * 5), v = boss ? (r() < 0.5 ? 2 : 3) : (k < P.tree ? 2 : 3);
        if (boss && Math.abs(x0 - cx) < 13 && Math.abs(y0 - cy) < 9) continue;
        for (let i = 0; i < n; i++) { const x = x0 + Math.floor(r() * 3) - 1, y = y0 + Math.floor(r() * 3) - 1; if (get(x, y) === 0 && !near(x, y, 2)) set(x, y, v); }
      }
      if (!boss) for (let k = 0; k < P.pond; k++) { const x0 = 7 + r() * (W2 - 14), y0 = 6 + r() * (H2 - 12), big = k % 2 === 0, rx = (big ? 3.2 : 2.2) + r() * 1.2, ry = (big ? 2.2 : 1.5) + r() * 0.8; for (let y = Math.floor(y0 - ry); y <= y0 + ry; y++) for (let x = Math.floor(x0 - rx); x <= x0 + rx; x++) if (get(x, y) === 0 && !near(x, y, 2) && ((x + 0.5 - x0) / rx) ** 2 + ((y + 0.5 - y0) / ry) ** 2 <= 1) set(x, y, 4); }   // v152 연못 = 둥근 타원 (world.js softPool 이 부드럽게 그림)
      for (let y = 2; y < H2 - 2; y++) for (let x = 2; x < W2 - 2; x++) if (get(x, y) === 0 && r() < 0.05) set(x, y, 5);   // 꽃(작은 빛 풀)
      return t;
    }
    const rows = cells.map(([id, cx, cy, name, kind]) => {
      const ex = {}; [['u', 0, -1], ['d', 0, 1], ['l', -1, 0], ['r', 1, 0]].forEach(([sd, dx, dy]) => { const to = at[(cx + dx) + ',' + (cy + dy)]; if (to) ex[sd] = to; });
      if (id === 'sx_v3') ex.d = 'f18';   // 맨 아래 → 18번 사냥터 (돌아가는 길만, 18번 쪽에는 길을 안 뚫음 · noBack)
      const P = PATH[id], mons = P ? { list: P.mob.map((f, i) => ({ f, lv: P.lv, n: [8, 6, 5][i] })) } : {};
      const [tex, region] = P ? [P.tex || null, P.region] : LOOK[kind];
      return { id, name, pos: [cx, cy], kind, data: { w: W2, h: H2, region, t: grid(id, ex, kind), exits: ex, mons, pub: true, noBack: id === 'sx_v3', sx: kind, tex, art: kind === 'all' ? 'arena_sx_all' : kind === 'king' ? 'arena_sx_king' : GOD_ART.includes(kind) ? 'arena_sx_' + kind : null, rec: P ? P.lv : kind === 'king' ? 400 : kind === 'npc' ? 150 : 250, solo: true } };
    });
    const B = (name, img, el, imm, light, colors, say, skills) => ({ name, img, h: 150, el, immune: imm, light, shape: 'golem', colors, kind: 'boss', say, skills });
    const SXF = k => ({ idle: 'sx_' + k, atk1: 'sx_' + k + '_atk', atk2: 'sx_' + k + '_atk', cast: 'sx_' + k + '_cast', hit: 'sx_' + k + '_hit' });   // v150 사방신 자세 그림 (Gemini · 공격·마법·맞음)
    const boss = {
      cr: Object.assign(B('청룡', 'sx_cr', 'thunder', 'thunder', '#FFE45C', { a: '#2FBF8F', b: '#1A6A5A', c: '#9AE6FF', d: '#5AD8FF' }, '동쪽을 지키는 푸른 용이 눈을 떴다! (번개 힘은 통하지 않는다)', ['charge', 'ring', 'fan', 'slam', 'laser']),
        { bh: 380, float: true, base: 'sx_cr_pool', baseCol: '#5AD8FF', frames: SXF('cr') }),   // v150 선생님 그림 (11/15) · 2배 크기 · 둥실둥실 떠다님 + 발밑 소용돌이 물
      jj: Object.assign(B('주작', 'sx_jj', 'fire', 'fire', '#FF4A3A', { a: '#FF4A3A', b: '#8A1E22', c: '#FFD23F', d: '#FFFFFF' }, '남쪽을 지키는 붉은 새가 날개를 폈다! (불의 힘은 통하지 않는다)', ['fan', 'ring', 'charge', 'blades', 'mines']),
        { bh: 380, float: true, baseCol: '#FF9A3D', frames: SXF('jj') }),   // v150 선생님 그림 · 날갯짓하며 떠 있음 + 발밑 불꽃 물결
      bh: Object.assign(B('백호', 'sx_bh', 'earth', 'earth', '#B07A45', { a: '#F0E8D8', b: '#7A6A5A', c: '#B07A45', d: '#FFFFFF' }, '서쪽을 지키는 흰 범이 으르렁거린다! (땅의 힘은 통하지 않는다)', ['charge', 'slam', 'blades', 'ring', 'blink']),
        { bh: 380, aura: true, baseCol: '#BDE8FF', frames: SXF('bh') }),   // v150 선생님 그림 · 땅을 딛고 섬 + 발밑 바람·번개 기운
      hm: Object.assign(B('현무', 'sx_hm', 'water', 'water', '#3C78F0', { a: '#3A4A7A', b: '#1D2340', c: '#3C78F0', d: '#9AE6FF' }, '북쪽을 지키는 검은 거북이 깨어났다! (물의 힘은 통하지 않는다)', ['slam', 'ring', 'fan', 'blades', 'windwall']),
        { bh: 380, aura: true, baseCol: '#3C78F0', frames: SXF('hm') }),   // v150 선생님 그림 · 땅을 딛고 섬 + 발밑 물결
      king: Object.assign(B('광개토대왕', 'sx_king_idle', 'light', 'all', '#FFD23F', { a: '#FFD23F', b: '#8A5A10', c: '#FFFFFF', d: '#FF4A3A' }, '광개토대왕께서 일어나셨다! 어떤 공격도 통하지 않는다…', ['blades', 'ring', 'charge', 'slam', 'fan']), { noFx: true,
        // v150 선생님 Gemini 그림 7장 (11/15) · 사방신과 같은 380px · 땅을 딛고 섬 · 칼(blades·charge·slam)=들기→내려치기 · 마법(ring·fan)=손 뻗기 · 걸을 때 두 장 번갈아 · 맞으면 잠깐 움찔
        bh: 380, aura: true, baseCol: '#FF4A3A', ax: 234 / 417, skCd: [0.9, 1.3], slamR: 195, slamCd: 0.7, bladeR: 70, bladeSpread: 1.4,   // v171 선생님 11/20: 범위 기술 쿨타임 더 짧게(1.5~2.2 → 0.9~1.3초 · 내려찍기 뒤 1.2 → 0.7초) · 범위 1.5배(내려찍기 130 → 195 · 칼비 46 → 70, 퍼지는 폭 1.4배)
        castAt: [0.39, 0.66], castCol: '#FF4A8A',
        frames: { idle: 'sx_king_idle', walk: ['sx_king_walk1', 'sx_king_walk2'], atk1: 'sx_king_atk1', atk2: 'sx_king_atk2', cast: 'sx_king_cast', hit: 'sx_king_hit' } })   // v149 선생님 11/15: 넉백(움찔·밀어내기)은 안 걸림 · 상태 이상(불·느려짐·기절·저주)은 왕을 죽인 검을 끼면 걸림
    };
    ['cr', 'jj', 'bh', 'hm'].forEach(k => { boss[k].fxQ = 0.25; });
    ['cr', 'jj', 'bh', 'hm', 'king'].forEach(k => { boss[k].noKnock = true; boss[k].hard = true; });   // v157 선생님 11/17: 사방신·광개토대왕 넉백(움찔·밀려남) 없음 · 더 어렵게(hard = 공격 빨리 · 마법 자주·많이 · 쿨타임 짧게, game.js bossSkill)   // v152 선생님 11/16: 사방신은 넉백·상태 이상이 1/4 만 걸림 (광개토대왕 noFx = 안 걸림 · 왕을 죽인 검을 끼면 1/4)
    const lv = { path: 150, god: 250, king: 400 };
    const rock = '돌에 새겨진 글씨: 이 너머는 한 번 생을 다시 산 자만 지날 수 있다.';
    const npc = { name: '광개토대왕 던전 지킴이', img: 'sx_npc', h: 70, color: '#9AE6FF', nearSay: '왕을 죽일 준비된 자만 들어와라',   // v162 선생님 11/17: 가까이 오면 머리 위 말풍선 av: { skin: 's2', hair: 'h_long', top: 't_hanbok', bottom: 'b_hanbok', shoes: 'sh_black', back: 'bk_cape' },
      lines: ['여기는 광개토대왕 던전, 네 신이 지키는 땅이다. 동쪽 청룡, 남쪽 주작, 서쪽 백호, 북쪽 현무가 저마다 자기 땅을 지키고 있지.',
        '청룡에게는 번개가, 주작에게는 불이, 현무에게는 물이, 백호에게는 땅의 힘이 통하지 않는다. 다른 힘으로 맞서라.',
        '네 신을 모두 이기면 위쪽 문에 네 개의 불이 켜지고, 네 신이 한꺼번에 기다리는 방이 열린다.',
        '그 너머에는 광개토대왕께서 계신다. 그분께는 어떤 공격도 통하지 않는다고 하지… 준비가 다 된 자만 들어가라.'] };
    // on: false = 아직 숨김 (선생님 그림이 오면 true 로 · v150). 꺼져 있으면 지도 20장·18번 입구·39번 검 떨어짐이 모두 없음
    return { on: true, rows, boss, lv, rock, npc, gateMap: 'f18', entry: 'sx_v3', rockImg: 'sx_rock' /* v151 입구 바위 그림(img/v79/sx_rock.png)이 들어오면 'sx_rock' */, home: 'f18', swordMap: 'f39', swordRate: { mob: 0.03, boss: 0.3 },
      gods: ['cr', 'jj', 'bh', 'hm'], godName: { cr: '청룡', jj: '주작', bh: '백호', hm: '현무' }, fire: { cr: '#FFE45C', jj: '#FF4A3A', bh: '#B07A45', hm: '#3C78F0' } };
  })();
  /* v172 이순신 장군님 던전 (선생님 11/20 엑셀 지도) — 통영(마을 7) 남쪽 출구 → 아래로 내려가는 던전
   *  왜장 9명을 하나씩 이기면 벽화 조각 9개(S.ysp · 계속 남음) → 어귀 지킴이에게서 3×3 밀기 퍼즐(열 때마다 섞임)로 이순신·거북선 벽화 완성(S.ysMural)
   *  → 왜장들의 회합(9명 한꺼번에) 열림 → 이기면(S.ysAll) 와키자카 야스하루의 본진 열림 → 이기면 벽화·회합만 처음으로 (조각은 그대로)
   *  on 이어도 pub:false = 관리자만 보임 (선생님이 해 보고 균형이 맞으면 pub:true 로 열기) */
  const YS = (() => {
    const W2 = 40, H2 = 28;
    // 왜장 9명: [열쇠, 이름, 열, 행, 속성, 색, 한마디]
    const GEN = [
      ['g1', '도도 다카토라', 1, 4, 'water', '#3C78F0', '수군 대장 도도 다카토라가 길을 막는다!'],
      ['g2', '구루시마 미치유키', 0, 3, 'wind', '#9AF0B0', '바다의 사나이 구루시마 미치유키가 나타났다!'],
      ['g3', '구키 요시타카', 7, 2, 'fire', '#FF4A3A', '철갑선의 구키 요시타카가 대포를 겨눈다!'],
      ['g4', '가토 요시아키', 8, 3, 'earth', '#B07A45', '가토 요시아키가 창을 고쳐 잡았다!'],
      ['g5', '구루시마 미치후사', 2, 5, 'wind', '#9AE6FF', '형의 원수를 갚겠다! 구루시마 미치후사가 달려든다!'],
      ['g6', '구로다 나가마사', 6, 7, 'dark', '#8A5AD8', '구로다 나가마사가 검은 투구를 썼다!'],
      ['g7', '가토 기요마사', 7, 5, 'thunder', '#FFE45C', '가토 기요마사가 긴 창을 휘두른다!'],
      ['g8', '고니시 유키나가', 1, 7, 'light', '#FFD23F', '선봉장 고니시 유키나가가 앞을 가로막는다!'],
      ['g9', '시마즈 요시히로', 5, 9, 'fire', '#FF9A3D', '귀신 같은 시마즈 요시히로가 칼을 뽑았다!']
    ];
    // 엑셀 배치 (열, 행) · 0행 = 통영(지도에만 표시)
    const cells = [
      ['ys_in', 4, 1, '통영 남쪽 바닷길', 'path'], ['ys_npc', 4, 2, '이순신 장군님 던전 어귀', 'npc'],
      ['ys_a1', 1, 3, '서쪽 갯바위길', 'path'], ['ys_a2', 2, 3, '왜선 잔해 모래톱', 'path'], ['ys_a3', 3, 3, '봉수대 언덕', 'path'], ['ys_x1', 4, 3, '한산 갈림길', 'path'], ['ys_a4', 5, 3, '견내량 물목', 'path'], ['ys_a5', 6, 3, '판옥선 나루', 'path'], ['ys_a6', 7, 3, '동쪽 해안 초소', 'path'],
      ['ys_v1', 4, 4, '학익진 길', 'path'], ['ys_v2', 4, 5, '거북 등 바위길', 'path'],
      ['ys_b1', 1, 6, '조총 소리 고개', 'path'], ['ys_b2', 2, 6, '불탄 왜성 터', 'path'], ['ys_b3', 3, 6, '모래 언덕', 'path'], ['ys_x2', 4, 6, '명량 갈림길', 'path'], ['ys_b4', 5, 6, '울돌목 소용돌이', 'path'], ['ys_b5', 6, 6, '노량 물가', 'path'], ['ys_b6', 7, 6, '동쪽 갈대밭', 'path'],
      ['ys_v3', 4, 7, '수군 진영 길', 'path'], ['ys_v4', 4, 8, '안개 낀 바닷길', 'path'], ['ys_v5', 4, 9, '왜장의 길목', 'path'],
      ['ys_all', 4, 10, '왜장들의 회합', 'all'], ['ys_boss', 4, 11, '와키자카 야스하루의 본진', 'boss']
    ].concat(GEN.map((g, i) => ['ys_' + g[0], g[2], g[3], g[1] + '의 진', 'gen', i]));
    const at = {}; cells.forEach(c => { at[c[1] + ',' + c[2]] = c[0]; });
    // 길 칸: 레벨 (입구 230 → 회합 앞 290) · 왜군 몬스터 3종 · 지역(나무·바위 모양) · 무더기 · 연못(바다 웅덩이)
    const PATH = {
      ys_in: { region: 6, lv: 230, mob: ['f66', 'f68', 'f74'], tree: 4, rock: 8, pond: 3 },
      ys_x1: { region: 6, lv: 240, mob: ['f74', 'f79', 'f68'], tree: 6, rock: 6, pond: 3 },
      ys_a3: { region: 6, lv: 245, mob: ['f79', 'f74', 'f66'], tree: 8, rock: 6, pond: 1 }, ys_a2: { region: 7, lv: 250, mob: ['f81', 'f79', 'f74'], tree: 3, rock: 10, pond: 4 }, ys_a1: { region: 7, lv: 258, mob: ['f81', 'f84', 'f79'], tree: 4, rock: 14, pond: 4 },
      ys_a4: { region: 6, lv: 245, mob: ['f79', 'f74', 'f68'], tree: 4, rock: 5, pond: 6 }, ys_a5: { region: 7, lv: 250, mob: ['f81', 'f84', 'f74'], tree: 3, rock: 6, pond: 6 }, ys_a6: { region: 7, lv: 258, mob: ['f84', 'f81', 'f79'], tree: 8, rock: 8, pond: 2 },
      ys_v1: { region: 7, lv: 255, mob: ['f81', 'f84', 'f79'], tree: 5, rock: 8, pond: 4 }, ys_v2: { region: 8, lv: 262, mob: ['f84', 'f81', 'f89'], tree: 3, rock: 14, pond: 3 },
      ys_x2: { region: 8, lv: 268, mob: ['f89', 'f84', 'f81'], tree: 6, rock: 8, pond: 3 },
      ys_b3: { region: 8, lv: 272, mob: ['f84', 'f89', 'f81'], tree: 2, rock: 6, pond: 2 }, ys_b2: { region: 8, lv: 276, mob: ['f89', 'f84', 'f81'], tree: 3, rock: 12, pond: 1 }, ys_b1: { region: 8, lv: 280, mob: ['f89', 'f81', 'f84'], tree: 6, rock: 12, pond: 1 },
      ys_b4: { region: 8, lv: 272, mob: ['f84', 'f89', 'f81'], tree: 2, rock: 4, pond: 9 }, ys_b5: { region: 7, lv: 276, mob: ['f89', 'f81', 'f84'], tree: 4, rock: 5, pond: 7 }, ys_b6: { region: 7, lv: 280, mob: ['f81', 'f89', 'f84'], tree: 14, rock: 3, pond: 3 },
      ys_v3: { region: 8, lv: 280, mob: ['f89', 'f84', 'f81'], tree: 5, rock: 10, pond: 2 }, ys_v4: { region: 8, lv: 285, mob: ['f89', 'f84', 'f81'], tree: 3, rock: 6, pond: 6 }, ys_v5: { region: 8, lv: 290, mob: ['f89', 'f84', 'f81'], tree: 4, rock: 12, pond: 2 }
    };
    function seeded(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function grid(id, ex, kind) {
      const r = seeded('ys-' + id), t = new Array(W2 * H2).fill(0), set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W2 && y < H2) t[y * W2 + x] = v; }, get = (x, y) => (x < 0 || y < 0 || x >= W2 || y >= H2 ? 2 : t[y * W2 + x]);
      for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (x < 2 || y < 2 || x >= W2 - 2 || y >= H2 - 2) set(x, y, r() < 0.5 ? 2 : 3);
      const cx = W2 >> 1, cy = H2 >> 1, room = kind !== 'path';
      Object.keys(ex).forEach(sd => {
        if (sd === 'u' || sd === 'd') { for (let x = cx - 3; x <= cx + 2; x++) for (let k = 0; k < 3; k++) set(x, sd === 'u' ? k : H2 - 1 - k, 0); for (let y = (sd === 'u' ? 0 : cy); y <= (sd === 'u' ? cy : H2 - 1); y++) for (let x = cx - 1; x <= cx; x++) set(x, y, 1); }
        else { for (let y = cy - 3; y <= cy + 2; y++) for (let k = 0; k < 3; k++) set(sd === 'l' ? k : W2 - 1 - k, y, 0); for (let x = (sd === 'l' ? 0 : cx); x <= (sd === 'l' ? cx : W2 - 1); x++) for (let y = cy - 1; y <= cy; y++) set(x, y, 1); }
      });
      if (room) {   // 장수·회합·본진·어귀: 가운데 넓은 마당 + 돌기둥(본진은 여섯)
        const rx = kind === 'all' || kind === 'boss' ? 15 : 11, ry = kind === 'all' || kind === 'boss' ? 10 : 7;
        for (let y = cy - ry; y <= cy + ry - 1; y++) for (let x = cx - rx; x <= cx + rx - 1; x++) if (get(x, y) !== 1) set(x, y, 0);
        (kind === 'boss' ? [[-13, -8], [12, -8], [-13, 0], [12, 0], [-13, 8], [12, 8]] : kind === 'all' ? [[-13, -8], [12, -8], [-13, 8], [12, 8]] : [[-9, -5], [8, -5], [-9, 4], [8, 4]]).forEach(([dx, dy]) => set(cx + dx, cy + dy, 3));
      }
      const near = (x, y, d) => { for (let b = -d; b <= d; b++) for (let a = -d; a <= d; a++) if (get(x + a, y + b) === 1) return true; return false; };
      const P = PATH[id], nClu = room ? 5 : P.tree + P.rock;
      for (let k = 0; k < nClu; k++) {
        const x0 = 4 + Math.floor(r() * (W2 - 8)), y0 = 4 + Math.floor(r() * (H2 - 8)), n = 2 + Math.floor(r() * 5), v = room ? (r() < 0.5 ? 2 : 3) : (k < P.tree ? 2 : 3);
        if (room && Math.abs(x0 - cx) < 17 && Math.abs(y0 - cy) < 11) continue;
        for (let i = 0; i < n; i++) { const x = x0 + Math.floor(r() * 3) - 1, y = y0 + Math.floor(r() * 3) - 1; if (get(x, y) === 0 && !near(x, y, 2)) set(x, y, v); }
      }
      if (!room) for (let k = 0; k < P.pond; k++) { const x0 = 7 + r() * (W2 - 14), y0 = 6 + r() * (H2 - 12), big = k % 2 === 0, rx = (big ? 3.2 : 2.2) + r() * 1.2, ry = (big ? 2.2 : 1.5) + r() * 0.8; for (let y = Math.floor(y0 - ry); y <= y0 + ry; y++) for (let x = Math.floor(x0 - rx); x <= x0 + rx; x++) if (get(x, y) === 0 && !near(x, y, 2) && ((x + 0.5 - x0) / rx) ** 2 + ((y + 0.5 - y0) / ry) ** 2 <= 1) set(x, y, 4); }
      for (let y = 2; y < H2 - 2; y++) for (let x = 2; x < W2 - 2; x++) if (get(x, y) === 0 && r() < 0.04) set(x, y, 5);
      return t;
    }
    const LOOK = { npc: 6, gen: 7, all: 8, boss: 8 };
    const rows = cells.map(([id, cx, cy, name, kind, gi]) => {
      const ex = {}; [['u', 0, -1], ['d', 0, 1], ['l', -1, 0], ['r', 1, 0]].forEach(([sd, dx, dy]) => { const to = at[(cx + dx) + ',' + (cy + dy)]; if (to) ex[sd] = to; });
      if (id === 'ys_in') ex.u = 'v7';   // 맨 위 → 통영 (통영 쪽 길은 world.js 가 따로 뚫음)
      const P = PATH[id], mons = P ? { list: P.mob.map((f, i) => ({ f, lv: P.lv, n: [8, 6, 5][i] })) } : {};
      return { id, name, pos: [cx, cy], kind, data: { w: W2, h: H2, region: P ? P.region : LOOK[kind], t: grid(id, ex, kind), exits: ex, mons, pub: false, noBack: id === 'ys_in', ys: kind, yi: gi == null ? -1 : gi, rec: P ? P.lv : kind === 'boss' ? 500 : kind === 'all' ? 400 : kind === 'gen' ? 300 + gi * 12 : 230 } };
    });
    const B = (name, img, el, light, colors, say, skills, more) => Object.assign({ name, img, h: 150, el, immune: el, light, shape: 'golem', colors, kind: 'boss', say, skills, noKnock: true, hard: true, bh: 300, aura: true, baseCol: light,
      frames: { idle: img, atk1: img + '_atk', atk2: img + '_atk', cast: img + '_cast', hit: img + '_hit', walk: [img + '_walk1', img + '_walk2'] } }, more || {});   // v173 걷기 두 장 (선생님 11/20)
    // v173 대표 기술 (선생님 11/21 · 롤 아이디어): 앞 2개 = 기본(체력 70%까지) · 뒤 = 대표 기술(70% 아래부터)
    const SK = [['fan', 'slam', 'mines', 'whirl'], ['ring', 'fan', 'windwall', 'laser'], ['fan', 'ring', 'laser', 'barrage', 'bomb'], ['slam', 'charge', 'hook', 'mines'], ['fan', 'charge', 'clones', 'blink'], ['blades', 'ring', 'realm', 'gaze'], ['charge', 'slam', 'hook', 'laser'], ['ring', 'fan', 'blink', 'bomb'], ['charge', 'slam', 'charge3', 'barrage']];
    const gens = GEN.map((g, i) => B(g[1], 'ys_' + g[0], g[4], g[5], { a: g[5], b: '#1D2340', c: '#FFFFFF', d: '#FF4A3A' }, g[6], SK[i], { gi: i, undying: i === 8 }));   // v173 시마즈 = 죽지 않는 분노
    const boss = B('와키자카 야스하루', 'ys_boss', 'dark', '#FF4A8A', { a: '#2A1F48', b: '#8A1E22', c: '#FFD23F', d: '#FF4A3A' }, '왜군 수군 대장 와키자카 야스하루가 칼을 뽑았다! 한산도의 원한을 갚겠다고 한다…',
      ['blades', 'fan', 'ring', 'slam', 'hook', 'laser', 'whirl', 'bomb', 'clones'], { immune: null, frames: { idle: 'ys_boss', atk1: 'ys_boss_atk1', atk2: 'ys_boss_atk2', cast: 'ys_boss_cast', hit: 'ys_boss_hit', walk: ['ys_boss_walk1', 'ys_boss_walk2'] }, bh: 380, skCd: [0.8, 1.1], slamR: 210, slamCd: 0.6, bladeR: 76, bladeSpread: 1.5, ysBoss: true });   // 광개토대왕(0.9~1.3초 · 195 · 70)보다 조금 더 어렵게
    const npc = { name: '이순신 장군님 던전 지킴이', img: 'ys_npc', h: 70, color: '#9AE6FF', nearSay: '왜장 아홉을 이기고 벽화를 되찾아 다오',
      av: { skin: 's2', hair: 'h_topknot', hat: 'hat_gat', top: 't_hanbok_m', bottom: 'b_hanbok_m', shoes: 'sh_black', back: 'bk_cape' },
      lines: ['여기는 이순신 장군님 던전이다. 왜장 아홉 명이 장군님과 거북선을 그린 벽화를 아홉 조각으로 나누어 빼앗아 갔지.',
        '왜장을 하나 이길 때마다 벽화 조각을 하나씩 되찾을 수 있다. 되찾은 조각은 계속 네가 지니고 있게 된다.',
        '조각 아홉 개를 모두 모아 오면 나에게서 벽화를 맞춰라. 조각을 밀어서 제자리에 놓으면 된다.',
        '벽화가 완성되면 아래쪽 왜장들의 회합이 열린다. 그 너머 본진에는 와키자카 야스하루가 기다리고 있다.'] };
    return { on: true, rows, gens, boss, npc, home: 'v7', entry: 'ys_in', top: [4, 0], mural: 'ys_mural', n: GEN.length, genName: GEN.map(g => g[1]), lv: { all: 400, boss: 500 } };
  })();
  // v131 환생: 저승 10-5(오도전륜대왕)를 깨면 할 수 있음 · Lv.1 로 돌아가고 환생마다 스탯 포인트 +20 · 장비·가방·골드는 그대로 · 마법은 기본 마법만 · 스탯마다 최대치 +10 · 최대 10번 · 10-5를 깰 때마다 한 번
  const REBIRTH = { max: 10, bonus: 20, statUp: 10 };   // v131 환생마다 스탯 최대치 +10 (50 → 60 → … → 150)

  /* v149 구리마을(마을 2, 옛 대숲 마을) — 광개토대왕 이야기를 하는 마을 사람 6명 + 광개토대왕비
   *  그림: 선생님이 주시면 img/v79/gw_kid1·gw_kid2·gw_kid3·gw_grandpa·gw_aunt·gw_scholar·gw_stele.png 로 넣으면 저절로 바뀜
   *  (그림이 없으면 사람 = av 아바타, 비석 = 코드로 그린 돌비석) · at = [칸 x, 칸 y] · range = 좌우로 걷는 폭(px, 0 = 가만히)
   *  할아버지 말(18살·39살) = 숨은 던전 단서 (18번 사냥터 입구 · 39번 사냥터 왕을 죽인 검) */
  const GURI = {   // v169 평양(마을 2)이 성 마을이 되어 비석·사람 자리를 왼쪽으로 옮김 (성은 오른쪽 아래)
    region: 1,
    stele: { tx: 11, ty: 12, img: 'gw_stele', name: '광개토대왕비', text: '국강상광개토경평안호태왕… 18세에 왕위에 올라 영락이라 부르니, 그 은혜가 하늘에 닿고 위엄이 사해에 떨쳤다.' },
    folk: [
      { name: '꼬마 돌쇠', img: 'gw_kid1', h: 50, at: [3.5, 12.6], range: 40, color: '#9AE6FF', av: { skin: 's2', hair: 'h_short', top: 't_pe', bottom: 'b_shorts', shoes: 'sh_red' },
        lines: ['할아버지가 그러는데, 옛날옛날에 땅을 엄청 넓힌 임금님이 있었대!'] },
      { name: '꼬마 연이', img: 'gw_kid2', h: 50, at: [6.5, 12.8], range: 40, color: '#FFB0C8', av: { skin: 's2', hair: 'h_twin', top: 't_hanbok', bottom: 'b_hanbok', shoes: 'sh_red' },
        lines: ['광개토대왕은 말 타고 활도 엄청 잘 쐈대. 나도 크면 그렇게 될 거야!'] },
      { name: '꼬마 범이', img: 'gw_kid3', h: 50, at: [9.6, 13.4], range: 0, color: '#9AF0B0', av: { skin: 's3', hair: 'h_spiky', top: 't_vest', bottom: 'b_shorts', shoes: 'sh_black' },
        lines: ['저 큰 비석 봤어? 글씨가 빼곡해서 하나도 못 읽겠어…'] },
      { name: '이야기꾼 할아버지', img: 'gw_grandpa', h: 62, at: [13.6, 12.7], range: 0, color: '#FFE45C', av: { skin: 's3', hair: 'h_topknot', hat: 'hat_gat', face: 'f_mustache', top: 't_hanbok_m', bottom: 'b_hanbok_m', shoes: 'sh_black' },
        lines: ['광개토대왕께서는 18살에 임금이 되셨고, 39살에 세상을 떠나셨지.'] },
      { name: '빨래터 아주머니', img: 'gw_aunt', h: 62, at: [15.6, 12.9], range: 30, color: '#FF9AA0', av: { skin: 's2', hair: 'h_bun', top: 't_hanbok', bottom: 'b_hanbok', shoes: 'sh_black' },
        lines: ['강 건너에서 이끼 낀 큰 돌비석이 나왔다는 소문이 있더라고요.'] },
      { name: '글 읽는 선비', img: 'gw_scholar', h: 64, at: [20.2, 12.6], range: 30, color: '#D8B8FF', av: { skin: 's1', hair: 'h_topknot', hat: 'hat_gat', top: 't_hanbok_m', bottom: 'b_hanbok_m', shoes: 'sh_black' },
        lines: ['대왕께서 돌아가신 뒤 아드님 장수왕께서 그 업적을 비석에 새기셨다네.'] }
    ]
  };
  window.GoRPGData = { GURI, SASIN, YS, PET_GRADE, PETS, PET, npcDef, REBIRTH, WAE_EL, STATION, stationFee, MAX_LV, REGIONS, recOf, LV_RANGE, MAPS, F, STAT, TIER, SLOT_NAME, ITEMS, POTIONS, ELEM, SKILLS, FUSION, fusionOf, BUILDINGS, CASTLE, NPCS, VILLAGERS, ARMY, GEAR_BASE, OPTS, GRADE, ENH, BAG, SELL, RG_EL, SMITH, reqOf, HELL };
})();
