/*
 * gogo?gogo! — 아바타 (v120 정리: 새 몸 그림만)
 *  - 몸 = 선생님 그림 avatar/body/<피부>_<m|f>_<f 앞|s 옆|b 뒤>.png (피부 18 × 남녀 × 3방향)
 *  - 상의·하의 = 몸 그림의 흰 티·청바지 자리에 색 입히기 (avatar/body/cloth.png + CLOTH 표)
 *  - 배경 = avatar/bg/<id>.png (가로 그림을 아바타 칸에 가운데 맞춰 꽉 채움)
 *  - 아바타 칸 크기는 예전 도트와 같은 18 × 29 칸(GW × GH) — 게임들이 위치 계산에 씀
 *  - 아이템 가격은 ITEMS 의 price (체험 모드용). 온라인 모드에서는 Supabase 'shop_items' 표의 가격이 우선
 *  ※ v120(11/12) 정리 때 뺀 것: 예전 도트 그리기(칸 그림·아이템 도트 그림 160여 종·자세·방향 그림),
 *     v114~v118 머리·모자·얼굴·신발·등 장식 얹기 표와 그림, 내린 상품 정의 (지난 코드는 삭제 가능 폴더 115차에 보관)
 */
(function () {
  'use strict';
  const W = 16, H = 27, PAD = 1, GW = W + PAD * 2, GH = H + PAD * 2;
  const OUT = '#1D2340';
  const SLOTS = [
    ['skin', '피부'], ['hair', '헤어'], ['hat', '모자'], ['face', '얼굴'],
    ['top', '상의'], ['bottom', '하의'], ['shoes', '신발'], ['back', '등'], ['bg', '배경']
  ];
  const OPTIONAL = { hat: 1, face: 1, back: 1, bg: 1 };          // 비워 둘 수 있는 부위
  const DEFAULT = { skin: 's1', hair: 'h_short', hat: null, face: null, top: 't_basic', bottom: 'b_jeans', shoes: 'sh_basic', back: null, bg: null };

  // 다리·발 위치 (frame 에 따라 한쪽 다리를 들어 올림)
  function legs(frame) {
    const l = frame === 1 ? 1 : 0, r = frame === 3 ? 1 : 0;
    return {
      L: { x: 5, y: 19, w: 3, h: 6 - l }, R: { x: 8, y: 19, w: 3, h: 6 - r },
      LF: { x: 4, y: 25 - l }, RF: { x: 8, y: 25 - r }
    };
  }
  /* ---------------- 아이템 (상점에 있는 것) ----------------
   *  [부위, id, 이름, 가격, {theme 테마 · color 피부색(게임 팔다리 색) · img 배경 그림}]
   *  새 상품은 여기에 한 줄 + Supabase shop_items 표에 한 줄 (가격은 표가 우선) */
  const I = [
    ["skin", "s1", "밝은 피부", 0, {"color": "#F7D7B5"}],
    ["skin", "s2", "살구 피부", 0, {"color": "#EBB58C"}],
    ["skin", "s3", "구릿빛 피부", 0, {"color": "#C98A55"}],
    ["skin", "s4", "갈색 피부", 0, {"color": "#8D5A34"}],
    ["skin", "s_alien", "외계인", 20, {"color": "#8EE08A"}],
    ["skin", "s_robot", "로봇", 24, {"color": "#BFC7E0"}],
    ["skin", "s_dark", "진한 갈색 피부", 0, {"color": "#724635"}],
    ["skin", "s_blush", "발그레 피부", 0, {"color": "#EE8A7D"}],
    ["skin", "s_copper", "붉은 구릿빛 피부", 0, {"color": "#D86F5C"}],
    ["skin", "s_ochre", "황토빛 피부", 0, {"color": "#E4A357"}],
    ["skin", "s_tan", "햇볕 그을린 피부", 0, {"color": "#D16E34"}],
    ["skin", "s_purple", "보랏빛 피부", 22, {"color": "#BA8FD0"}],
    ["skin", "s_ghost", "잿빛 유령 피부", 35, {"color": "#A7ACA5"}],
    ["skin", "s_elf", "엘프 피부", 40, {"color": "#EDCAA6"}],
    ["skin", "s_night", "밤하늘 피부", 45, {"color": "#435262"}],
    ["skin", "s_angel", "천사 피부", 100, {"color": "#EEEEF4"}],
    ["hair", "h_short", "짧은 머리 (검정)", 0],
    ["hair", "h_short_brown", "짧은 머리 (갈색)", 0],
    // v140 헤어 10종은 보류 (선생님 11/13) — 그림 avatar/hair/ 와 그리기 코드(hairParts)는 남겨 둠. 다시 열 때: 작업일지 0000000-73 의 아이템 10줄을 여기 넣고 shop.js HIDE_SLOTS 에서 hair 빼기
    ["top", "t_basic", "기본 티셔츠", 0],
    ["top", "t_stripe", "줄무늬 티", 4],
    ["top", "t_hoodie", "후드티", 8],
    // v142 화려한 상의 10종 (선생님 11/13 "skillcom RPG 아이템 비슷하게 화려하게") — 그림 파일 없이 paintFancy 가 몸 모양에 맞춰 그림
    ["top", "t_hanbok", "색동 저고리", 30, {"theme": "season"}],
    ["top", "t_forest", "숲의 정령 튜닉", 35, {"theme": "fantasy"}],
    ["top", "t_princess", "공주님 리본 블라우스", 35, {"theme": "fantasy"}],
    ["top", "t_royal", "왕자님 황금 예복", 40, {"theme": "fantasy"}],
    ["top", "t_wizard", "대마법사 별빛 로브", 45, {"theme": "fantasy"}],
    ["top", "t_pirate", "해적 선장 코트", 50, {"theme": "fantasy"}],
    ["top", "t_space", "은하 우주 기사 슈트", 60, {"theme": "fantasy"}],
    ["top", "t_ice", "얼음 크리스탈 아머", 60, {"theme": "fantasy"}],
    ["top", "t_angel", "천사 날개 튜닉", 70, {"theme": "fantasy"}],
    ["top", "t_dragon", "화염 드래곤 아머", 80, {"theme": "fantasy"}],
    ["bottom", "b_jeans", "청바지", 0],
    ["bottom", "b_cargo", "카고 바지", 6],
    // v142 화려한 하의 10종 (상의 10종과 짝 · 남 = 바지, 여 = 치마) — paintFancy(part 'b') 가 몸 모양에 맞춰 그림
    ["bottom", "b_hanbok", "색동 한복 바지·치마", 25, {"theme": "season"}],
    ["bottom", "b_forest", "숲의 정령 하의", 30, {"theme": "fantasy"}],
    ["bottom", "b_princess", "공주님 프릴 하의", 30, {"theme": "fantasy"}],
    ["bottom", "b_royal", "왕자님 예복 하의", 35, {"theme": "fantasy"}],
    ["bottom", "b_wizard", "대마법사 별빛 하의", 40, {"theme": "fantasy"}],
    ["bottom", "b_pirate", "해적 선장 하의", 40, {"theme": "fantasy"}],
    ["bottom", "b_space", "은하 우주 기사 하의", 50, {"theme": "fantasy"}],
    ["bottom", "b_ice", "얼음 크리스탈 다리 갑옷", 50, {"theme": "fantasy"}],
    ["bottom", "b_angel", "천사 깃털 하의", 60, {"theme": "fantasy"}],
    ["bottom", "b_dragon", "화염 드래곤 다리 갑옷", 70, {"theme": "fantasy"}],
    ["shoes", "sh_basic", "기본 운동화", 0],
    // v139 모자 14종 (그림 avatar/hat/<id>.png = 72×88 칸 6개: 남 앞·옆·뒤, 여 앞·옆·뒤 · 몸 캔버스 y -24 ~ 63 · up = 머리 위로 솟는 점 수 → 그만큼 몸을 조금 작게)
    ["hat", "ht_cap", "야구 모자", 4, {"theme": "school", "img": "avatar/hat/ht_cap.png?v=139"}],
    ["hat", "ht_band", "스포츠 머리띠", 4, {"theme": "school", "img": "avatar/hat/ht_band.png?v=139"}],
    ["hat", "ht_beanie", "비니", 5, {"img": "avatar/hat/ht_beanie.png?v=139"}],
    ["hat", "ht_snap", "거꾸로 스냅백", 6, {"img": "avatar/hat/ht_snap.png?v=139"}],
    ["hat", "ht_pom", "방울 비니", 6, {"theme": "season", "img": "avatar/hat/ht_pom.png?v=139", "up": 6}],
    ["hat", "ht_hard", "안전모", 6, {"theme": "job", "img": "avatar/hat/ht_hard.png?v=139"}],
    ["hat", "ht_straw", "밀짚모자", 6, {"theme": "season", "img": "avatar/hat/ht_straw.png?v=139"}],
    ["hat", "ht_rain", "우비 모자", 6, {"theme": "season", "img": "avatar/hat/ht_rain.png?v=139"}],
    ["hat", "ht_chef", "요리사 모자", 8, {"theme": "job", "img": "avatar/hat/ht_chef.png?v=139", "up": 18}],
    ["hat", "ht_cat", "고양이 후드", 8, {"theme": "season", "img": "avatar/hat/ht_cat.png?v=139", "up": 5}],
    ["hat", "ht_santa", "산타 모자", 8, {"theme": "season", "img": "avatar/hat/ht_santa.png?v=139", "up": 3}],
    ["hat", "ht_bunny", "토끼 후드", 8, {"theme": "season", "img": "avatar/hat/ht_bunny.png?v=139", "up": 21}],
    ["hat", "ht_bear", "곰 후드", 8, {"theme": "season", "img": "avatar/hat/ht_bear.png?v=139", "up": 2}],
    ["hat", "ht_peng", "펭귄 후드", 8, {"theme": "season", "img": "avatar/hat/ht_peng.png?v=139"}],
    // v138 얼굴 장식 11종 (그림 avatar/face/<id>.png = 72×64 칸 6개: 남 앞·옆·뒤, 여 앞·옆·뒤 · 몸 그림 캔버스 위쪽에 얹음 → 게임 속 몸에도 보임)
    ["face", "fc_mustache", "콧수염", 3, {"img": "avatar/face/fc_mustache.png?v=138"}],
    ["face", "fc_glasses", "동그란 안경", 4, {"theme": "school", "img": "avatar/face/fc_glasses.png?v=138"}],
    ["face", "fc_mask", "마스크", 5, {"theme": "school", "img": "avatar/face/fc_mask.png?v=138"}],
    ["face", "fc_goggles", "실험 보안경", 5, {"theme": "job", "img": "avatar/face/fc_goggles.png?v=138"}],
    ["face", "fc_patch", "안대", 6, {"theme": "fantasy", "img": "avatar/face/fc_patch.png?v=138"}],
    ["face", "fc_beard", "산타 수염", 6, {"theme": "season", "img": "avatar/face/fc_beard.png?v=138"}],
    ["face", "fc_sun", "선글라스", 8, {"img": "avatar/face/fc_sun.png?v=138"}],
    ["face", "fc_headset", "헤드셋 마이크", 8, {"theme": "job", "img": "avatar/face/fc_headset.png?v=138"}],
    ["face", "fc_phones", "헤드폰", 9, {"img": "avatar/face/fc_phones.png?v=138"}],
    ["face", "fc_ninja", "닌자 복면", 10, {"theme": "fantasy", "img": "avatar/face/fc_ninja.png?v=138"}],
    ["face", "fc_elf", "엘프 귀", 10, {"theme": "fantasy", "img": "avatar/face/fc_elf.png?v=138", "skinKey": 1}],
    // v137 신발 8종 (몸 그림의 운동화 자리에 색 입히기 + 장화·부츠는 다리 위로 목 · avatar/body/shoes.png + SHOES 표)
    ["shoes", "sh_red", "빨간 운동화", 3],
    ["shoes", "sh_slipper", "슬리퍼", 3, {"theme": "season"}],
    ["shoes", "sh_rain_y", "노란 장화", 5, {"theme": "season"}],
    ["shoes", "sh_rain_r", "빨간 장화", 5, {"theme": "season"}],
    ["shoes", "sh_hightop", "하이탑 운동화", 6, {"theme": "school"}],
    ["shoes", "sh_boots", "검정 부츠", 6],
    ["shoes", "sh_space", "우주 부츠", 8, {"theme": "job"}],
    ["shoes", "sh_gold", "황금 신발", 20, {"theme": "fantasy"}],
    ["bottom", "b_uniskirt", "교복 치마", 5, {"theme": "school"}],
    ["bottom", "b_slacks", "교복 바지", 4, {"theme": "school"}],
    ["top", "t_padding", "롱패딩", 12, {"theme": "school"}],
    ["top", "t_ninja", "닌자 옷", 14, {"theme": "fantasy"}],
    ["bottom", "b_ninja", "닌자 바지", 8, {"theme": "fantasy"}],
    ["skin", "s_pale", "창백한 피부 (뱀파이어)", 12, {"theme": "fantasy", "color": "#E8E6F2"}],
    ["skin", "s_gold", "황금 피부", 50, {"theme": "fantasy", "color": "#F2C641"}],
    ["bottom", "b_chima", "다홍 치마", 10, {"theme": "season"}],
    ["top", "t_bear", "곰 잠옷", 10, {"theme": "season"}],
    ["bg", "bg_sky", "맑은 하늘", 0, {"img": "avatar/bg/bg_sky.png?v=120"}],
    ["bg", "bg_class", "우리 교실", 0, {"theme": "school", "img": "avatar/bg/bg_class.png?v=120"}],
    ["bg", "bg_gym", "학교 체육관", 10, {"theme": "school", "img": "avatar/bg/bg_gym.png?v=120"}],
    ["bg", "bg_sunset", "노을 지는 도시", 15, {"theme": "school", "img": "avatar/bg/bg_sunset.png?v=120"}],
    ["bg", "bg_night", "별 헤는 밤", 8, {"theme": "fantasy", "img": "avatar/bg/bg_night.png?v=120"}],
    ["bg", "bg_sea", "여름 바다", 10, {"theme": "season", "img": "avatar/bg/bg_sea.png?v=120"}],
    ["bg", "bg_forest", "초록 숲", 8, {"theme": "season", "img": "avatar/bg/bg_forest.png?v=120"}],
    ["bg", "bg_cherry", "벚꽃길", 12, {"theme": "season", "img": "avatar/bg/bg_cherry.png?v=120"}],
    ["bg", "bg_snow", "눈 오는 마을", 12, {"theme": "season", "img": "avatar/bg/bg_snow.png?v=120"}],
    // v136 등 장식 10종 (그림 avatar/back/<id>.png = 128×116 칸 6개: 앞 아래·앞 위·뒤 아래·뒤 위·옆 아래·옆 위 · 아바타 18×29칸 + 양옆 7칸)
    ["back", "bd_bag", "책가방", 6, {"theme": "school", "img": "avatar/back/bd_bag.png?v=136"}],
    ["back", "bd_bag_sky", "하늘색 책가방", 6, {"theme": "school", "img": "avatar/back/bd_bag_sky.png?v=136"}],
    ["back", "bd_cape", "영웅 망토", 15, {"theme": "fantasy", "img": "avatar/back/bd_cape.png?v=136"}],
    ["back", "bd_angel", "천사 날개", 30, {"theme": "fantasy", "img": "avatar/back/bd_angel.png?v=136", "wide": 1}],
    ["back", "bd_cape_dark", "어둠의 망토", 30, {"theme": "fantasy", "img": "avatar/back/bd_cape_dark.png?v=136"}],
    ["back", "bd_bat", "박쥐 날개", 35, {"theme": "fantasy", "img": "avatar/back/bd_bat.png?v=136", "wide": 1}],
    ["back", "bd_fairy", "요정 날개", 45, {"theme": "fantasy", "img": "avatar/back/bd_fairy.png?v=136", "wide": 1}],
    ["back", "bd_jet", "제트팩", 50, {"theme": "job", "img": "avatar/back/bd_jet.png?v=136"}],
    ["back", "bd_dragon", "용 날개", 60, {"theme": "fantasy", "img": "avatar/back/bd_dragon.png?v=136", "wide": 1}],
    ["back", "bd_phoenix", "불사조 날개", 60, {"theme": "fantasy", "img": "avatar/back/bd_phoenix.png?v=136", "wide": 1}]
  ].map(([slot, id, name, price, o]) => Object.assign({ slot, id, name, price }, o || {}));
  const byId = {}; I.forEach(it => { byId[it.id] = it; });
  const SHOP_I = I;

  /* ---------------- 그리기 ---------------- */
  function normalize(av) {
    const out = {};
    SLOTS.forEach(([slot]) => {
      const v = av && av[slot];
      if (v && byId[v] && byId[v].slot === slot) out[slot] = v;
      else if (av && slot in av && av[slot] === null && OPTIONAL[slot]) out[slot] = null;
      else out[slot] = DEFAULT[slot];
    });
    if (av && (av.g === 'm' || av.g === 'f')) out.g = av.g;   // v112 기본 몸 성별 (남 m · 여 f, 처음 한 번 고르고 그 뒤엔 상점 변환권)
    return out;
  }
  /* v112 새 기본 몸 그림 (선생님 그림 · avatar/body/{m|f}_{f 앞|s 옆(오른쪽)|b 뒤}.png)
   *  기본 옷(무료 머리·기본 티·청바지·기본 운동화, 모자·얼굴 장식·등 없음, 밝은 피부 s1·s2)만 입은 사람에게 씀.
   *  상점 옷을 입은 사람은 옷 그림이 들어올 때까지 예전 도트 그대로 */
  const BODY_V = 114, bodyImgs = {};
  // v114 피부 18가지 × 남/여 × 앞·옆·뒤 그림 (avatar/body/<피부>_<m|f>_<f|s|b>.png)
  const BODY_SKINS = ['s1', 's2', 's3', 's4', 's_pale', 's_alien', 's_robot', 's_gold', 's_dark', 's_blush', 's_copper', 's_elf', 's_purple', 's_ghost', 's_ochre', 's_tan', 's_night', 's_angel'];
  const bodySrc = (g, view, skin) => 'avatar/body/' + (BODY_SKINS.includes(skin) ? skin : 's1') + '_' + (g === 'f' ? 'f' : 'm') + '_' + (view === 'b' || view === 's' ? view : 'f') + '.png?v=' + BODY_V;
  function bodyImg(g, view, cb, skin) {
    if (typeof cb === 'string') { skin = cb; cb = null; }
    const k = bodySrc(g, view, skin);
    let e = bodyImgs[k];
    if (!e) {
      const im = new Image(); e = bodyImgs[k] = { im, ok: false, cbs: [] };
      im.onload = () => { e.ok = true; e.cbs.splice(0).forEach(f => { try { f(); } catch (er) { /* noop */ } }); };
      im.src = (window.GOGO_BASE || '') + k;
    }
    if (e.ok) return e.im;
    if (cb) e.cbs.push(cb);
    return null;
  }
  /* v120 상의·하의 색 입히기: 몸 그림의 흰 티·청바지(치마) 자리에 색을 칠함 (선생님이 고른 상의 시안 5개 + 하의 5개)
   *  avatar/body/cloth.png = 피부 18(가로) × [남 앞·옆·뒤, 여 앞·옆·뒤](세로) 칸(72×136). 빨강 = 티 자리 밝기(1~255), 초록 = 바지·치마 자리 밝기
   *  만드는 법: 작업도구\skillcom_그림·효과·채널_v104\1_그림자르기\옷색입히기_v120\ (mask.py · atlas.py) */
  const CLOTH = {
    t_stripe: { c: [235, 240, 250], p: 'stripe', c2: [40, 90, 200] },
    t_hanbok: { c: [250, 204, 50], f: 'hanbok' }, t_forest: { c: [46, 146, 52], f: 'forest' }, t_princess: { c: [248, 136, 190], f: 'princess' }, t_royal: { c: [34, 56, 140], f: 'royal' }, t_wizard: { c: [108, 36, 170], f: 'wizard' },
    t_pirate: { c: [184, 26, 40], f: 'pirate' }, t_space: { c: [232, 238, 250], f: 'space' }, t_ice: { c: [104, 190, 250], f: 'ice' }, t_angel: { c: [246, 248, 255], f: 'angel' }, t_dragon: { c: [54, 42, 48], f: 'dragon' },
    t_hoodie: { c: [150, 95, 220] }, t_padding: { c: [30, 40, 80] }, t_bear: { c: [140, 90, 50] }, t_ninja: { c: [30, 30, 40] },
    b_hanbok: { c: [34, 56, 140], f: 'hanbok' }, b_forest: { c: [22, 92, 34], f: 'forest' }, b_princess: { c: [248, 136, 190], f: 'princess' }, b_royal: { c: [34, 56, 140], f: 'royal' }, b_wizard: { c: [108, 36, 170], f: 'wizard' },
    b_pirate: { c: [34, 34, 46], f: 'pirate' }, b_space: { c: [232, 238, 250], f: 'space' }, b_ice: { c: [104, 190, 250], f: 'ice' }, b_angel: { c: [246, 248, 255], f: 'angel' }, b_dragon: { c: [54, 42, 48], f: 'dragon' },
    b_cargo: { c: [150, 135, 80] }, b_slacks: { c: [62, 66, 86] }, b_ninja: { c: [34, 34, 42] }, b_chima: { c: [214, 64, 60] }, b_uniskirt: { c: [42, 52, 98], p: 'check', c2: [70, 140, 100] }
  };
  for (let t = 0; t < 10; t++) ['', 'r'].forEach(r => { CLOTH['t_rpg' + t + r] = { c: [150, 150, 160], f: 'rpg' + t + r }; CLOTH['b_rpg' + t + r] = { c: [150, 150, 160], f: 'rpg' + t + r }; });   // v153 skillcom RPG 갑옷 (상점에는 없음 · bodyComp 의 av.rpgAr)
  const CLOTH_GV = ['m_f', 'm_s', 'm_b', 'f_f', 'f_s', 'f_b'];
  let clothAt = null, clothLoading = false; const clothCbs = [];
  function clothAtlas(cb) {
    if (clothAt) return clothAt;
    if (cb && !clothCbs.includes(cb)) clothCbs.push(cb);
    if (!clothLoading) {
      clothLoading = true;
      const im = new Image();
      im.onload = () => { try { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); clothAt = x.getImageData(0, 0, c.width, c.height); } catch (e) { clothAt = { bad: true }; } clothCbs.splice(0).forEach(f => { try { f(); } catch (er) { /* noop */ } }); };
      im.onerror = () => { clothAt = { bad: true }; clothCbs.splice(0).forEach(f => { try { f(); } catch (er) { /* noop */ } }); };
      im.src = (window.GOGO_BASE || '') + 'avatar/body/cloth.png?v=120';
    }
    return null;
  }
  const clothOf = n => ({ t: n.top !== 't_basic' && CLOTH[n.top] ? n.top : null, b: n.bottom !== 'b_jeans' && CLOTH[n.bottom] ? n.bottom : null, s: n.shoes !== 'sh_basic' && SHOES[n.shoes] ? n.shoes : null });
  /* v137 신발: avatar/body/shoes.png (cloth.png 와 같은 칸) R = 운동화 칸 밝기 · G = 운동화 바로 위 다리 칸(1~12, 장화·부츠 목) · B = 운동화 안 세로 자리(1 위 ~ 255 바닥)
   *  k: sneaker 운동화(흰 부분은 c2) · boot 장화·부츠(목 shaft 칸) · slipper 슬리퍼(발은 피부색 · 끈 c) · gold 황금(반짝)
   *  만드는 법: 클라우드 작업 공간 shoe/detect.py·atlas.py (몸 그림 아래쪽 무채색 덩어리 = 운동화) — 작업일지 0000000-70 */
  const SHOES = {
    sh_red: { k: 'sneaker', c: [205, 38, 44], c2: [246, 246, 246] },
    sh_hightop: { k: 'sneaker', c: [36, 84, 206], c2: [246, 246, 246], shaft: 3 },
    sh_slipper: { k: 'slipper', c: [36, 58, 112], sole: [230, 232, 240] },
    sh_rain_y: { k: 'boot', c: [248, 204, 40], shaft: 8, sole: [150, 110, 20] },
    sh_rain_r: { k: 'boot', c: [204, 38, 40], shaft: 8, sole: [110, 20, 20] },
    sh_boots: { k: 'boot', c: [44, 44, 52], shaft: 5, sole: [18, 18, 22] },
    sh_space: { k: 'boot', c: [236, 240, 248], shaft: 6, sole: [150, 160, 180], band: [46, 96, 222], dot: [244, 120, 40] },
    sh_gold: { k: 'gold', c: [246, 192, 40], shaft: 3, sole: [170, 110, 20] }
  };
  let shoeAt = null, shoeLoading = false; const shoeCbs = [];
  function shoeAtlas(cb) {
    if (shoeAt) return shoeAt;
    if (cb && !shoeCbs.includes(cb)) shoeCbs.push(cb);
    if (!shoeLoading) {
      shoeLoading = true;
      const im = new Image(), done = () => shoeCbs.splice(0).forEach(f => { try { f(); } catch (er) { /* noop */ } });
      im.onload = () => { try { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); shoeAt = x.getImageData(0, 0, c.width, c.height); } catch (e) { shoeAt = { bad: true }; } done(); };
      im.onerror = () => { shoeAt = { bad: true }; done(); };
      im.src = (window.GOGO_BASE || '') + 'avatar/body/shoes.png?v=137';
    }
    return null;
  }
  const skinCol = id => { const h = (byId[id] && byId[id].color) || '#F7D7B5'; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  // 신발 칠하기 (p = 몸 그림 픽셀, A = shoes.png 픽셀, 칸 왼쪽 위 ox·oy)
  function paintShoes(p, W, H, A, AW, ox, oy, S, skin) {
    const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= W || yy >= H || xx >= 72 || yy >= 136 ? -1 : ((oy + yy) * AW + ox + xx) * 4);
    const sh = S.shaft || 0, isShaft = (xx, yy) => { const ai = at(xx, yy); return ai >= 0 && A[ai + 1] > 0 && A[ai + 1] <= sh; };
    const put = (i, c, m) => { p[i] = Math.min(255, c[0] * m); p[i + 1] = Math.min(255, c[1] * m); p[i + 2] = Math.min(255, c[2] * m); };
    const dark = S.c.map(v => v * 0.28), SK = skinCol(skin);
    for (let yy = 0; yy < H && yy < 136; yy++) for (let xx = 0; xx < W && xx < 72; xx++) {
      const ai = at(xx, yy), i = (yy * W + xx) * 4; if (ai < 0 || !p[i + 3]) continue;
      const R = A[ai], G = A[ai + 1], Bv = A[ai + 2];
      if (R) {   // 운동화 자리
        const b = (R - 1) / 254, v = (Bv - 1) / 254;
        if (b < 0.2) { put(i, S.k === 'slipper' ? SK.map(c => c * 0.35) : dark, 1); continue; }   // 테두리
        if (S.k === 'sneaker') { if (b > 0.62) put(i, S.c2, 0.82 + 0.2 * b); else put(i, S.c, 0.62 + 0.75 * b); }
        else if (S.k === 'slipper') { if (v > 0.78) put(i, S.sole, 0.8 + 0.2 * b); else if (v > 0.28 && v < 0.58) put(i, S.c, 0.7 + 0.5 * b); else put(i, SK, 0.78 + 0.25 * b); }
        else if (S.k === 'gold') { if (v > 0.84) put(i, S.sole, 1); else put(i, b > 0.7 ? [255, 236, 150] : S.c, 0.62 + 0.55 * b); }
        else { const lo = S.c[0] + S.c[1] + S.c[2] > 600 ? 0.84 : 0.66; if (v > 0.82) put(i, S.sole, 1); else put(i, S.c, lo + (1.16 - lo) * b); if (S.dot && v > 0.35 && v < 0.6 && b > 0.5 && (xx % 5 === 2)) put(i, S.dot, 1); }
        continue;
      }
      if (G && G <= sh) {   // 장화·부츠 목 (다리 위로)
        const edge = !isShaft(xx - 1, yy) || !isShaft(xx + 1, yy);
        const lum = (p[i] + p[i + 1] + p[i + 2]) / 765;
        if (edge) put(i, dark, 1);
        else if (G === sh) put(i, S.band || S.c, S.band ? 1 : 1.12);   // 목 끝 테두리(접힌 단)
        else if (S.band && G === 2) put(i, S.band, 1);
        else put(i, S.k === 'gold' && lum > 0.5 ? [255, 236, 150] : S.c, (S.c[0] + S.c[1] + S.c[2] > 600 ? 0.9 : 0.78) + 0.45 * lum);
      } else if (G === sh + 1 && sh) {   // 목 바로 위 한 줄 = 테두리
        const below = isShaft(xx, yy + 1); if (below) put(i, dark, 1);
      }
    }
  }
  /* ===== v142 화려한 상의 10종 (선생님 11/13 "skillcom RPG 아이템 비슷하게 화려하게") =====
   *  몸 그림의 티 자리(cloth.png 빨강 = 칸마다 밝기)에 맞춰 그 자리에서 직접 그림 → 피부·성별·방향마다 몸 모양이 달라도 딱 맞음 (그림 파일 없음)
   *  순서: 등 뒤(날개·불꽃) → 바탕(재질 + 주름 밝기) → 무늬 → 금테(목·밑단·소매) → 가운데 장식 → 어깨 장식 → 보석 → 반짝이 → 조각마다 진한 테두리
   *  어깨 장식·날개가 몸 그림 밖으로 나가므로 캔버스 양옆·위에 FPAD 점 여백(pad)을 둠 (fitBody 가 pad 를 알아서 맞춤) */
  const FPAD = 9;
  const mixc = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  const hsh = (a, c) => { let q = Math.imul(a * 374761393 + c * 668265263, 1274126177); q ^= q >>> 13; return ((q >>> 0) % 1000) / 1000; };
  const RMP = {
    gold: [[80, 42, 6], [156, 96, 12], [220, 156, 28], [255, 208, 64], [255, 246, 196]],
    silver: [[40, 46, 64], [96, 106, 130], [158, 168, 190], [212, 220, 236], [255, 255, 255]],
    navy: [[8, 12, 38], [20, 32, 84], [34, 56, 140], [62, 96, 200], [130, 170, 250]],
    red: [[56, 4, 12], [116, 12, 24], [184, 26, 40], [232, 62, 62], [255, 150, 130]],
    rose: [[90, 0, 40], [170, 10, 70], [230, 40, 110], [255, 100, 160], [255, 200, 225]],
    pink: [[150, 50, 110], [214, 90, 156], [248, 136, 190], [255, 186, 220], [255, 236, 246]],
    white: [[130, 136, 168], [188, 194, 220], [228, 232, 246], [246, 248, 255], [255, 255, 255]],
    purple: [[26, 6, 48], [62, 18, 104], [108, 36, 170], [158, 80, 224], [214, 164, 255]],
    ice: [[18, 56, 120], [46, 124, 206], [104, 190, 250], [176, 234, 255], [244, 254, 255]],
    char: [[10, 8, 12], [30, 24, 30], [54, 42, 48], [86, 68, 70], [128, 102, 98]],
    lava: [[130, 20, 0], [222, 70, 0], [255, 138, 8], [255, 210, 60], [255, 250, 210]],
    leaf: [[8, 46, 20], [22, 92, 34], [46, 146, 52], [104, 198, 74], [190, 244, 140]],
    bark: [[46, 26, 10], [86, 52, 22], [126, 84, 38], [168, 118, 62], [212, 166, 102]],
    cyan: [[0, 56, 90], [0, 124, 170], [16, 196, 240], [120, 240, 255], [232, 255, 255]],
    tech: [[62, 72, 98], [128, 140, 168], [192, 202, 224], [232, 238, 250], [255, 255, 255]],
    bone: [[90, 74, 54], [150, 132, 104], [206, 190, 160], [240, 230, 206], [255, 252, 240]],
    yellow: [[150, 96, 10], [216, 156, 20], [250, 204, 50], [255, 232, 120], [255, 250, 210]],
    black: [[4, 4, 8], [16, 16, 24], [34, 34, 46], [60, 60, 78], [100, 100, 124]],
    magenta: [[80, 0, 70], [150, 10, 140], [220, 50, 210], [255, 120, 240], [255, 220, 255]],
    emerald: [[0, 50, 30], [0, 110, 64], [20, 180, 110], [100, 240, 170], [220, 255, 236]]
  };
  RMP.leather = [[40, 22, 10], [86, 50, 22], [138, 88, 44], [186, 132, 76], [230, 190, 136]];
  RMP.bronze = [[60, 28, 8], [128, 66, 22], [194, 116, 52], [234, 168, 96], [255, 226, 180]];
  RMP.iron = [[30, 36, 54], [74, 84, 110], [124, 134, 160], [172, 182, 204], [222, 228, 242]];
  RMP.steel = [[14, 16, 24], [42, 48, 62], [82, 90, 108], [132, 142, 162], [198, 206, 222]];
  /* v153 skillcom RPG 갑옷 단계 (data.js TIER 순서): R = 바탕 재질 · rim = 테두리·띠 · dk = 판 사이 · gem = 정예 보석 */
  const RPG_AR = [
    { R: RMP.leather, rim: RMP.bark, dk: RMP.leather, gem: RMP.yellow, stud: true },
    { R: RMP.bronze, rim: RMP.gold, dk: RMP.bronze, gem: RMP.emerald },
    { R: RMP.leaf, rim: RMP.bark, dk: RMP.leaf, gem: RMP.rose, grain: true, spark: [190, 255, 150] },
    { R: RMP.iron, rim: RMP.silver, dk: RMP.steel, gem: RMP.cyan },
    { R: RMP.steel, rim: RMP.silver, dk: RMP.black, gem: RMP.lava, spike: RMP.silver },
    { R: RMP.ice, rim: RMP.silver, dk: RMP.ice, gem: RMP.ice, grain: true, spike: RMP.ice, glow: [200, 250, 255], spark: [190, 240, 255] },
    { R: RMP.purple, rim: RMP.gold, dk: RMP.purple, gem: RMP.cyan, spike: RMP.magenta, glow: [220, 160, 255], spark: [230, 180, 255] },
    { R: RMP.white, rim: RMP.gold, dk: RMP.white, gem: RMP.yellow, glow: [255, 250, 210], spark: [255, 240, 170] },
    { R: RMP.char, rim: RMP.lava, dk: RMP.black, gem: RMP.lava, spike: RMP.bone, glow: [255, 150, 40], spark: [255, 170, 60] },
    { R: RMP.gold, rim: RMP.white, dk: RMP.yellow, gem: RMP.red, spike: RMP.gold, glow: [255, 240, 160], spark: [255, 240, 150] }
  ];
  const rmp = (r, t) => { t = Math.max(0, Math.min(0.999, Math.round(t * 8) / 8)) * (r.length - 1); const i = Math.floor(t); return mixc(r[i], r[i + 1], t - i); };
  const SAEK = [[230, 40, 50], [250, 200, 40], [60, 170, 80], [50, 110, 220], [240, 120, 180], [250, 250, 250]];
  // p = 여백까지 포함한 캔버스 픽셀, M = 옷 자리(1), S = 옷 자리 밝기(0~1), kind = 디자인, v = 'f'|'s'|'b', g = 'm'|'f', part = 't' 상의 | 'b' 하의
  function paintFancy(p, W, H, M, S, kind, v, g, part) {
    const N = W * H, Z = new Uint8Array(N), OL = new Uint8Array(N), A0 = new Uint8Array(N);
    for (let k = 0; k < N; k++) A0[k] = p[k * 4 + 3];
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (M[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return;
    let a = W, b = -1; const ry = Math.max(y0, y1 - 2);
    for (let x = 0; x < W; x++) if (M[ry * W + x]) { if (x < a) a = x; if (x > b) b = x; }
    if (b < 0) { a = x0; b = x1; }
    const front = v === 'f', back = v === 'b', side = v === 's';
    const cx = side ? (a + b) / 2 + 1 : (a + b) / 2, tw = (b - a) / 2 + 0.5, h = y1 - y0 + 1, U = tw / 11;
    const inM = (x, y) => x >= 0 && y >= 0 && x < W && y < H && M[y * W + x] === 1;
    const up = new Uint8Array(N), dn = new Uint8Array(N);
    for (let x = 0; x < W; x++) {
      let r = 0; for (let y = 0; y < H; y++) { r = M[y * W + x] ? r + 1 : 0; up[y * W + x] = r; }
      r = 0; for (let y = H - 1; y >= 0; y--) { r = M[y * W + x] ? r + 1 : 0; dn[y * W + x] = r; }
    }
    const sleeve = (x, y) => (x < a - 0.5 || (!side && x > b + 0.5));
    const hem = (x, y, n) => !sleeve(x, y) && dn[y * W + x] <= n && y > y0 + h * 0.5;
    const cuff = (x, y, n) => sleeve(x, y) && dn[y * W + x] <= n;
    const collar = (x, y, n) => up[y * W + x] <= n && Math.abs(x - cx) < tw * 0.8 && y < y0 + h * 0.4;
    const put = (x, y, c, z, o) => {
      x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
      const k = y * W + x, i = k * 4; p[i] = Math.min(255, c[0]); p[i + 1] = Math.min(255, c[1]); p[i + 2] = Math.min(255, c[2]); p[i + 3] = 255; Z[k] = z; OL[k] = o === false ? 0 : 1;
    };
    const glow = (x, y, c, t) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; if (!p[i + 3]) return; p[i] += (c[0] - p[i]) * t; p[i + 1] += (c[1] - p[i + 1]) * t; p[i + 2] += (c[2] - p[i + 2]) * t; };
    const lt = (x, y) => { const s = S[y * W + x]; return 0.16 + 0.9 * Math.max(0, s - 0.25) / 0.75 - 0.28 * (x - cx) / (tw * 1.4) - 0.26 * (y - y0) / h; };
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !A0[y * W + x] && !Z[y * W + x];
    // 모양: 타원(기울기 ang) · 다각형 · 보석 · 반짝이
    const ell = (ex, ey, rx, ry, ang, fn, z, behind) => {
      const R = Math.max(rx, ry) + 1, co = Math.cos(ang || 0), si = Math.sin(ang || 0);
      for (let y = Math.floor(ey - R); y <= Math.ceil(ey + R); y++) for (let x = Math.floor(ex - R); x <= Math.ceil(ex + R); x++) {
        const dx = x - ex, dy = y - ey, u = (dx * co + dy * si) / rx, w = (-dx * si + dy * co) / ry, d = u * u + w * w;
        if (d > 1) continue; if (behind && !free(x, y)) continue;
        const c = fn(u, w, d, x, y); if (c) put(x, y, c, z);
      }
    };
    const poly = (pts, fn, z, behind) => {
      let mx = W, Mx = -1, my = H, My = -1; pts.forEach(([px, py]) => { mx = Math.min(mx, px); Mx = Math.max(Mx, px); my = Math.min(my, py); My = Math.max(My, py); });
      for (let y = Math.floor(my); y <= Math.ceil(My); y++) for (let x = Math.floor(mx); x <= Math.ceil(Mx); x++) {
        let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; }
        if (!ins) continue; if (behind && !free(x, y)) continue;
        const c = fn(x, y, (x - mx) / Math.max(1, Mx - mx), (y - my) / Math.max(1, My - my)); if (c) put(x, y, c, z);
      }
    };
    const sph = (R, ex, ey, rx, ry, z, rim) => ell(ex, ey, rx, ry, 0, (u, w, d) => (rim && d > 0.62 ? rmp(rim, 0.75 - u * 0.25 - w * 0.3) : rmp(R, 0.6 - u * 0.3 - w * 0.4 - d * 0.15)), z);
    const gem = (gx, gy, r, R, z, frame) => {
      gx = Math.round(gx); gy = Math.round(gy);
      if (frame) for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) { const m = Math.abs(dx) + Math.abs(dy); if (m === r + 1 || (m === r + 2 && (dx === 0 || dy === 0))) put(gx + dx, gy + dy, rmp(frame, 0.7 - dx * 0.12 - dy * 0.15), z); }
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r) put(gx + dx, gy + dy, rmp(R, (dx < 0 ? 0.62 : 0.38) + (dy < 0 ? 0.2 : -0.12) - (Math.abs(dx) + Math.abs(dy)) / r * 0.15), z + 1);
      put(gx - Math.ceil(r / 2), gy - Math.ceil(r / 2) + (r > 1 ? 1 : 0), [255, 255, 255], z + 2, false);
    };
    const spark = (sx, sy, c, big) => {
      put(sx, sy, [255, 255, 255], 12, false);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { put(sx + dx, sy + dy, c, 12, false); if (big) put(sx + dx * 2, sy + dy * 2, mixc(c, [255, 255, 255], 0.3), 12, false); });
    };
    const sparks = (n, c, seed, big) => { let k = 0; for (let tries = 0; tries < 400 && k < n; tries++) { const x = Math.round(x0 + hsh(tries, seed) * (x1 - x0)), y = Math.round(y0 + hsh(seed, tries) * h); if (inM(x, y) && inM(x - 2, y) && inM(x + 2, y) && inM(x, y - 2) && inM(x, y + 2) && Z[y * W + x] < 4) { spark(x, y, c, big && k % 2 === 0); k++; } } };
    const base = fn => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (M[y * W + x]) { const c = fn(x, y, lt(x, y)); if (c) put(x, y, c, 1); } };
    const over = (fn, z) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (M[y * W + x]) { const c = fn(x, y, lt(x, y)); if (c) put(x, y, c, z || 2, false); } };   // 무늬·금테 = 테두리 없음
    // 어깨 자리 (앞·뒤 = 양쪽, 옆 = 보이는 쪽 하나)
    const PR = Math.max(3.6, tw * 0.5);
    const shoulder = s => {   // 소매 바깥 끝(xe)과 그 안쪽 칸의 맨 위(yt) → 어깨 장식 가운데
      let xe = s < 0 ? W : -1; for (let y = y0; y < y0 + h * 0.45; y++) for (let x = x0; x <= x1; x++) if (M[y * W + x]) { if (s < 0 ? x < xe : x > xe) xe = x; }
      const xc = xe - s * 2; let yt = y0; for (let y = y0; y < y1; y++) if (inM(xc, y)) { yt = y; break; }
      return [xe - s * PR * 0.5, yt + PR * 0.4, s];
    };
    const SH = side ? [shoulder(-1)] : [shoulder(-1), shoulder(1)];
    const fringe = (sx, sy, rx, R) => { for (let dx = -Math.floor(rx) + 1; dx < rx; dx++) { const L = 2 + (Math.abs(dx) % 2); for (let k = 1; k <= L; k++) put(sx + dx, sy + k, rmp(R, 0.7 - k * 0.15 - (dx % 2 ? 0.25 : 0)), 5, k === L); } };
    // 갑옷 가슴판 + 배 갑판 (R = 재질, rim = 테두리 재질)
    const plate = (R, rim, dk) => over((x, y, t) => {
      if (sleeve(x, y) || up[y * W + x] < 2 || dn[y * W + x] < 2) return null;
      const by = y0 + h * 0.56 - ((x - cx) / tw) ** 2 * h * 0.18, ax = Math.abs(x - cx);
      if (Math.abs(y - by) < 0.7) return rmp(rim, 0.8);
      if (y < by) { if (ax > tw * 0.82) return null; return Math.abs(ax - tw * 0.82) < 0.7 ? rmp(rim, 0.6) : rmp(R, t + 0.12 + (y - y0 < 3 ? 0.1 : 0)); }
      const r = Math.round(y - by) % 3; return r === 1 ? rmp(R, t + 0.28) : r === 0 ? rmp(dk || R, t - 0.15) : null;
    }, 2);
    const D = kind;
    if (/^rpg\d/.test(D)) {   // ===== v153 skillcom RPG 갑옷 (단계마다 재질) — 상의 = 가슴판·어깨 보호대·소매, 하의 = 다리 갑옷·무릎 보호대 (몸 모양에 딱 맞음)
      const tier = +D[3], rare = D.endsWith('r'), A = RPG_AR[tier] || RPG_AR[3], R = A.R, RIM = A.rim, DK = A.dk || R, GEM = A.gem;
      if (part === 'b') {
        const skirt = g === 'f';
        const botY = x => { for (let y = y1; y >= y0; y--) if (inM(x, y)) return y; return -1; };
        base((x, y, t) => { t = Math.max(side ? 0.4 : 0.2, t); const r = (y - y0) % 4; return r === 0 ? rmp(DK, t - 0.05) : rmp(R, t * 0.85 + 0.08 + (r === 1 ? 0.12 : 0)); });   // v153 옆모습 먼 다리가 너무 까맣지 않게
        over((x, y, t) => {
          if (up[y * W + x] <= 2 && y < y0 + h * 0.3) return rmp(RIM, t + 0.2 + (up[y * W + x] === 1 ? 0.12 : 0));   // 허리띠
          if (dn[y * W + x] <= 2 && y > y0 + h * 0.5) return rmp(RIM, t + 0.12);   // 발목 테
          if (skirt && (x - x0) % 4 === 0 && up[y * W + x] > 2) return rmp(DK, 0.35);
          return null;
        });
        if (!skirt && !side) {   // 무릎 보호대
          const ky = Math.round(y0 + h * 0.58); let x = x0;
          while (x <= x1) { if (!M[ky * W + x]) { x++; continue; } let e = x; while (e + 1 <= x1 && M[ky * W + e + 1]) e++; if (e - x >= 3) { const kx = (x + e) / 2, r = (e - x + 1) / 2; sph(RIM, kx, ky, r * 0.9, Math.max(2.2, r * 0.65), 4, DK); if (rare) put(kx, ky, rmp(GEM, 0.8), 5, false); } x = e + 1; }
        }
        if (skirt) for (let x = x0 + 1; x <= x1; x += 3) { const yb = botY(x); if (yb < 0) continue; for (let k = 1; k <= 2; k++) put(x, yb + k, rmp(RIM, 0.7 - k * 0.15), 3, k === 2); }
        if (!back) { const bx = side ? x1 - 2 : cx; gem(bx, y0 + 1.5, 1, rare ? GEM : RIM, 6, rare ? RMP.gold : null); }
        if (A.spark && rare) sparks(2, A.spark, 61 + tier, true);
      } else {
        base((x, y, t) => { const f = A.grain && ((x + y) % 6 === 0 || (x - y + 60) % 7 === 0) ? 0.18 : 0; return rmp(R, t * 0.8 + 0.1 + f); });
        plate(R, RIM, DK);
        over((x, y, t) => {
          if (collar(x, y, 2)) return rmp(RIM, t + 0.2);
          if (cuff(x, y, 2)) return rmp(RIM, t + 0.12);
          if (hem(x, y, 1)) return rmp(RIM, t + 0.1);
          if (sleeve(x, y) && (y - y0) % 3 === 2) return rmp(DK, t - 0.1);   // 소매 = 겹친 판
          if (A.stud && !sleeve(x, y) && up[y * W + x] === 3 && x % 3 === 0) return rmp(RMP.yellow, 0.75);
          return null;
        });
        SH.forEach(([sx, sy, s]) => {   // 어깨 보호대 (둥근 판 두 겹)
          sph(R, sx, sy + 0.5, PR * 1.2, PR * 0.75, 4, RIM);
          ell(sx, sy + PR * 0.55, PR * 1.15, 0.8, 0, () => rmp(RIM, 0.75), 5);
          if (A.spike) poly([[sx - 1.6, sy - 0.5], [sx + s * 1.2, sy - PR * 1.4 - 1], [sx + 1.6, sy - 0.5]], (x, y, u, w) => rmp(A.spike, 0.95 - u * 0.5 - w * 0.15), 6);
        });
        const gy = y0 + h * (side ? 0.42 : 0.4), gx = side ? cx + tw * 0.35 : cx;
        if (!back && (rare || tier >= 5)) { if (A.glow) for (let r = 5; r >= 4; r--) for (let k = 0; k < 24; k++) glow(gx + Math.cos(k / 24 * 6.283) * r, gy + Math.sin(k / 24 * 6.283) * r, A.glow, 0.3); gem(gx, gy, rare ? 3 : 2, GEM, 6, RIM); }
        else if (!back) gem(gx, gy, 1, RIM, 6, null);
        if (A.spark) sparks(rare ? 5 : 3, A.spark, 41 + tier, true);
      }
    } else if (part === 'b') {   // ===== v142 하의 10종 (상의와 짝) — 남 = 바지(두 다리), 여 = 치마 =====
      const skirt = g === 'f';
      // 줄마다 덩어리(다리) 나누기 → 칸마다 그 덩어리의 왼·오른 끝 (바깥 줄무늬·무릎 자리)
      const RS = new Int16Array(N).fill(-1), RE = new Int16Array(N).fill(-1);
      for (let y = y0; y <= y1; y++) { let x = x0; while (x <= x1) { if (!M[y * W + x]) { x++; continue; } let e = x; while (e + 1 <= x1 && M[y * W + e + 1]) e++; for (let k = x; k <= e; k++) { RS[y * W + k] = x; RE[y * W + k] = e; } x = e + 1; } }
      const outer = (x, y) => { const k = y * W + x, s0 = RS[k], e0 = RE[k]; if (s0 < 0) return 99; const mid = (s0 + e0) / 2; return mid < cx ? x - s0 : e0 - x; };   // 바깥쪽 끝에서 떨어진 칸 수
      const waist = (x, y, n) => up[y * W + x] <= n && y < y0 + h * 0.3;
      const ankle = (x, y, n) => dn[y * W + x] <= n && y > y0 + h * 0.5;
      const knees = () => { if (skirt || side) return []; const ky = Math.round(y0 + h * 0.58), out = []; let x = x0; while (x <= x1) { if (!M[ky * W + x]) { x++; continue; } let e = x; while (e + 1 <= x1 && M[ky * W + e + 1]) e++; if (e - x >= 3) out.push([(x + e) / 2, ky, (e - x + 1) / 2]); x = e + 1; } return side ? out.slice(-1) : out; };
      const botY = x => { for (let y = y1; y >= y0; y--) if (inM(x, y)) return y; return -1; };
      const extend = (ext, fn, z) => { for (let x = x0; x <= x1; x++) { const yb = botY(x); if (yb < 0) continue; const L = typeof ext === 'function' ? ext(x) : ext; for (let k = 1; k <= L; k++) { const c = fn(x, yb + k, k, L); if (c) put(x, yb + k, c, z || 2, k === L); } } };
      const buckle = (R, F) => { if (back) return; const bx = side ? x1 - 2 : cx, by = y0 + 1.5; gem(bx, by, 1, R, 6, F); };
      const kneeGuard = (R, rim, extra) => knees().forEach(([kx, ky, r], j) => { sph(R, kx, ky, r * 0.95, Math.max(2.2, r * 0.7), 4, rim); if (extra) extra(kx, ky, r, j); });
      const D2 = D;
      if (D2 === 'royal') {   // 왕자님 예복 바지·치마: 남색 · 금·빨강 옆줄 · 금 허리띠 · 금 밑단
        base((x, y, t) => rmp(RMP.navy, t + (skirt && (x % 3) === 0 ? -0.15 : 0)));
        over((x, y, t) => {
          if (waist(x, y, 2)) return rmp(RMP.gold, t + 0.25 + (up[y * W + x] === 1 ? 0.15 : 0));
          if (ankle(x, y, skirt ? 2 : 1)) return rmp(RMP.gold, t + 0.25);
          if (!skirt) { const o = outer(x, y); if (o <= 0.6) return rmp(RMP.gold, t + 0.3); if (o <= 1.6) return rmp(RMP.red, 0.6); }
          return null;
        });
        if (skirt) for (let x = x0 + 2; x < x1 - 1; x += 4) { const yb = botY(x); if (yb > 0) gem(x, yb - 3, 1, RMP.red, 4, null); }
        buckle(RMP.red, RMP.gold); sparks(2, [255, 220, 120], 51);
      } else if (D2 === 'princess') {   // 공주님 바지·치마: 분홍 물방울 · 흰 레이스 · 진주 허리 · 치마는 겹 프릴
        base((x, y, t) => ((x * 3 + y * 5) % 11 === 0 ? rmp(RMP.white, 0.9) : rmp(RMP.pink, t + 0.15)));
        over((x, y, t) => { if (waist(x, y, 2)) return up[y * W + x] === 2 && x % 2 ? [255, 255, 255] : rmp(RMP.white, 0.8); if (ankle(x, y, 2)) return rmp(RMP.white, t + 0.4 - (x % 3 === 0 ? 0.25 : 0)); return null; });
        if (skirt) { extend(x => 3 + (x % 3 === 1 ? 1 : 0), (x, y, k, L) => (k === L ? rmp(RMP.pink, 0.55) : k % 2 ? rmp(RMP.white, 0.92) : rmp(RMP.pink, 0.8)), 3); for (let x = x0 + 2; x < x1 - 1; x += 3) { const yb = botY(x); if (yb > 0) put(x, yb - 4, [255, 255, 255], 4, false); } }
        else extend(x => (x % 3 === 1 ? 2 : 1), (x, y, k) => rmp(RMP.white, 0.9 - k * 0.15), 3);
        if (!back) { const bx = side ? x1 - 3 : cx + tw * 0.45, by = y0 + 2; poly([[bx, by], [bx - 3, by - 2], [bx - 3, by + 2]], () => rmp(RMP.rose, 0.55), 6); poly([[bx, by], [bx + 3, by - 2], [bx + 3, by + 2]], () => rmp(RMP.rose, 0.45), 6); put(bx, by, rmp(RMP.rose, 0.85), 7); }
        sparks(4, [255, 140, 200], 53, true);
      } else if (D2 === 'wizard') {   // 마법사 바지·치마: 보라 · 금별 · 금 허리 끈 · 하늘빛 룬 밑단 · 치마는 뾰족 밑단
        base((x, y, t) => rmp(RMP.purple, t));
        over((x, y, t) => {
          if (waist(x, y, 2)) return rmp(RMP.gold, t + 0.2);
          if (ankle(x, y, 1)) return rmp(RMP.gold, t + 0.2); if (ankle(x, y, 2)) return rmp(RMP.cyan, 0.8); if (ankle(x, y, 3) && x % 3 === 1) return rmp(RMP.cyan, 0.95);
          if (!skirt && outer(x, y) <= 0.6) return rmp(RMP.gold, 0.7);
          const sx = (x * 7 + Math.floor(y / 5) * 3) % 9, sy = y % 5; if ((sx === 4 && sy === 2) || ((sx === 3 || sx === 5) && sy === 2) || (sx === 4 && (sy === 1 || sy === 3))) return sx === 4 && sy === 2 ? [255, 250, 210] : rmp(RMP.gold, 0.75);
          return null;
        });
        if (skirt) extend(x => [1, 3, 5, 3][(x - x0) % 4], (x, y, k, L) => (k === L ? rmp(RMP.gold, 0.8) : rmp(RMP.purple, 0.55 - k * 0.05)), 3);
        buckle(RMP.cyan, RMP.gold); sparks(3, [140, 240, 255], 57, true);
      } else if (D2 === 'ice') {   // 얼음 다리 갑옷: 얼음 판 · 은 테 · 무릎 보호대 + 수정 · 치마는 판 갑옷 + 고드름
        base((x, y, t) => { const r = (y - y0) % 4; return r === 0 ? rmp(RMP.silver, t + 0.25) : rmp(RMP.ice, t * 0.8 + 0.12 + (r === 1 ? 0.2 : 0) + ((x + y) % 6 === 0 ? 0.2 : 0)); });
        over((x, y, t) => { if (waist(x, y, 2)) return rmp(RMP.silver, t + 0.25); if (ankle(x, y, 2)) return rmp(RMP.silver, t + 0.2); if (skirt && (x - x0) % 4 === 0 && up[y * W + x] > 2) return rmp(RMP.silver, 0.45); return null; });
        kneeGuard(RMP.silver, RMP.ice, (kx, ky, r) => poly([[kx - 1.5, ky - 1], [kx, ky - r * 1.4 - 1], [kx + 1.5, ky - 1]], (x, y, u) => rmp(RMP.ice, 0.95 - u * 0.5), 6));
        for (let x = x0 + 1; x <= x1; x += 3) { const yb = botY(x); if (yb < 0 || (!skirt)) continue; const L = 2 + Math.round(hsh(x, 19) * 3); for (let k = 1; k <= L; k++) put(x, yb + k, rmp(RMP.ice, 0.9 - k * 0.12), 3, k === L); }
        buckle(RMP.ice, RMP.silver); sparks(4, [190, 240, 255], 59, true);
      } else if (D2 === 'dragon') {   // 드래곤 다리 갑옷: 검은 비늘 · 용암 금 · 용암 허리 · 뿔 무릎 · 치마는 판 + 용암 끝
        base((x, y, t) => { const r = y % 3, o = Math.floor(y / 3) % 2 * 2, c = (x + o) % 4; return rmp(RMP.char, t * 0.7 + 0.15 + (r === 0 && c !== 0 ? 0.3 : 0) - (c === 0 ? 0.12 : 0)); });
        over((x, y, t) => {
          if (waist(x, y, 2)) return rmp(RMP.lava, 0.5 + (up[y * W + x] === 1 ? 0.25 : 0));
          if (ankle(x, y, 2)) return rmp(RMP.lava, 0.45 + (dn[y * W + x] === 2 ? 0.3 : 0));
          if (!skirt && outer(x, y) <= 0.6) return rmp(RMP.lava, 0.55);
          if (Math.abs(Math.sin(x * 0.9 + y * 0.35) * 2.2 + Math.sin(y * 0.7) * 1.5 - (x - cx) * 0.25) < 0.45 && up[y * W + x] > 3 && hsh(x, y) < 0.8) return rmp(RMP.lava, 0.6 + hsh(y, x) * 0.3);
          return null;
        });
        kneeGuard(RMP.char, RMP.lava, (kx, ky, r, j) => { const s = kx < cx ? -1 : 1; poly([[kx - 1.2, ky - 1], [kx + s * r * 0.9, ky - r * 1.5], [kx + 1.2, ky]], (x, y, u, w) => rmp(RMP.bone, 0.9 - w * 0.5), 6); });
        if (skirt) extend(x => [2, 4, 2, 3][(x - x0) % 4], (x, y, k, L) => (k === L ? rmp(RMP.lava, 0.85) : rmp(RMP.char, 0.4)), 3);
        buckle(RMP.lava, RMP.gold); sparks(2, [255, 170, 40], 61);
      } else if (D2 === 'angel') {   // 천사 바지·치마: 흰 비단 · 금테 · 허리에 깃털 자락
        base((x, y, t) => rmp(RMP.white, t * 0.7 + 0.25));
        over((x, y, t) => { if (waist(x, y, 2)) return rmp(RMP.gold, t + 0.25); if (ankle(x, y, 2)) return dn[y * W + x] === 2 ? rmp(RMP.ice, 0.8) : rmp(RMP.gold, t + 0.3); if (!skirt && outer(x, y) <= 0.6) return rmp(RMP.gold, 0.7); return null; });
        for (let x = x0 + 1, j = 0; x <= x1 - 1; x += 3, j++) { if (back && skirt) break; const L = skirt ? h * 0.75 + (j % 2) * 2 : h * 0.24 + (j % 2) * 2; ell(x, y0 + 2 + L / 2, 1.9, L / 2, 0, (u, w) => rmp(j % 2 ? RMP.white : RMP.ice, 0.95 - w * 0.25 - Math.abs(u) * 0.2), 3 + (j % 2)); }
        if (skirt) extend(2, (x, y, k) => rmp(RMP.gold, 0.85 - k * 0.15), 5);
        buckle(RMP.ice, RMP.gold); sparks(3, [255, 230, 140], 63, true);
      } else if (D2 === 'forest') {   // 숲 바지·치마: 진한 잎 · 나무 띠 · 잎 밑단(치마는 꽃잎 치마)
        base((x, y, t) => { const o = Math.floor(y / 3) % 2 * 2, c = (x + o) % 4, r = y % 3; return rmp(RMP.leaf, t * 0.65 + 0.05 + (r === 0 && c !== 0 ? 0.2 : 0) - (c === 0 ? 0.1 : 0)); });
        over((x, y, t) => { if (waist(x, y, 2)) return rmp(RMP.bark, t + 0.3 - (x % 3 === 0 ? 0.15 : 0)); if (!skirt && outer(x, y) <= 0.6) return rmp(RMP.bark, 0.55); return null; });
        for (let x = x0 - 1; x <= x1 + 1; x += skirt ? 3 : 2) { const yb = botY(x) >= 0 ? botY(x) : botY(x + 1); if (yb < 0) continue; poly([[x - 1.8, yb - 2], [x + 0.3, yb + (skirt ? 5 : 3)], [x + 1.8, yb - 2]], (xx, yy, u, w) => rmp(RMP.leaf, 0.85 - w * 0.45 - u * 0.15), 3); }
        if (!back) { const fx = Math.round(side ? x1 - 3 : cx - tw * 0.4), fy = Math.round(y0 + 2); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => put(fx + dx, fy + dy, [255, 120, 180], 6)); put(fx, fy, [255, 214, 40], 7, false); }
        sparks(3, [210, 255, 150], 67, true);
      } else if (D2 === 'pirate') {   // 해적 바지·치마: 검정 · 금 옆줄 · 빨간 허리 띠(늘어진 자락) · 금 단추
        base((x, y, t) => rmp(RMP.black, t * 0.8 + 0.2));
        over((x, y, t) => { if (waist(x, y, 3)) return rmp(RMP.red, t + 0.25 - (up[y * W + x] === 3 ? 0.2 : 0)); if (ankle(x, y, 2)) return rmp(RMP.gold, t + 0.3); if (!skirt && outer(x, y) <= 0.6) return rmp(RMP.gold, 0.75); return null; });
        if (!back || true) { const sx = side ? x1 - 3 : x0 + 3, L = Math.round(h * 0.45); poly([[sx - 1.5, y0 + 2], [sx + 1.5, y0 + 2], [sx + 1, y0 + 3 + L], [sx - 2, y0 + 2 + L]], (x, y, u, w) => (y > y0 + L ? rmp(RMP.gold, 0.8) : rmp(RMP.red, 0.65 - u * 0.25)), 5); }
        if (skirt) for (let x = x0 + 2; x < x1 - 1; x += 4) { const yb = botY(x); if (yb > 0) put(x, yb - 3, rmp(RMP.gold, 0.95), 4); }
        buckle(RMP.gold, null); sparks(2, [255, 220, 120], 71);
      } else if (D2 === 'space') {   // 우주 바지·치마: 흰 장갑 · 하늘빛 빛 줄 · 빛 무릎 보호대
        base((x, y, t) => rmp(RMP.tech, t * 0.8 + 0.15 - ((y - y0) % 6 === 5 ? 0.3 : 0)));
        over((x, y, t) => { if (waist(x, y, 2)) return rmp(RMP.navy, 0.35 + (up[y * W + x] === 2 ? 0.2 : 0)); if (ankle(x, y, 2)) return dn[y * W + x] === 2 ? rmp(RMP.cyan, 0.85) : rmp(RMP.navy, 0.3); if ((!skirt && outer(x, y) >= 0.6 && outer(x, y) <= 1.6) || (skirt && (x - x0) % 5 === 2 && up[y * W + x] > 2 && dn[y * W + x] > 2)) return rmp(RMP.cyan, 0.75 + (y % 4 === 0 ? 0.2 : 0)); return null; });
        kneeGuard(RMP.tech, null, (kx, ky) => { put(kx, ky, rmp(RMP.cyan, 1), 6, false); put(kx - 1, ky, rmp(RMP.cyan, 0.8), 6, false); put(kx + 1, ky, rmp(RMP.cyan, 0.8), 6, false); });
        if (!back) { const bx = side ? x1 - 2 : cx; ell(bx, y0 + 1.5, 2, 1.6, 0, () => rmp(RMP.cyan, 0.9), 6); }
        sparks(3, [120, 240, 255], 73, true);
      } else if (D2 === 'hanbok') {   // 한복: 남 = 쪽빛 바지 + 흰 대님 · 여 = 다홍 치마 + 금박 띠 (조금 길게)
        if (skirt) {
          base((x, y, t) => rmp(RMP.red, t + 0.2));
          extend(4, (x, y, k, L) => (k >= L - 2 ? rmp(RMP.gold, k === L ? 0.6 : 0.9 - ((x % 4) === 0 ? 0.25 : 0)) : rmp(RMP.red, 0.55)), 2);
          over((x, y, t) => { if (waist(x, y, 2)) return rmp(RMP.white, 0.9); const d = dn[y * W + x]; if (d <= 3 && (x + y) % 4 === 0) return rmp(RMP.gold, 0.85); if ((x - x0) % 4 === 0 && up[y * W + x] > 2) return rmp(RMP.red, t - 0.05); return null; });
        } else {
          base((x, y, t) => rmp(RMP.navy, t + 0.18));
          over((x, y, t) => { if (waist(x, y, 2)) return rmp(RMP.white, 0.85); if (ankle(x, y, 2)) return rmp(RMP.white, 0.9 - (dn[y * W + x] === 1 ? 0.2 : 0)); if (ankle(x, y, 3)) return rmp(RMP.red, 0.6); const gx = (x + Math.floor(y / 4) * 2) % 5, gy = y % 4; if (up[y * W + x] > 3 && gx === 2 && gy === 2) return rmp(RMP.gold, 0.9); return null; });
        }
        sparks(2, [255, 220, 120], 79);
      }
    } else if (D === 'royal') {   // 왕자님 황금 예복: 남색 · 금테 · 빨간 띠 · 훈장 · 금 견장(술)
      base((x, y, t) => rmp(RMP.navy, t));
      over((x, y, t) => {
        if (hem(x, y, 2)) return rmp(RMP.gold, t + (dn[y * W + x] === 2 ? 0.25 : 0));
        if (hem(x, y, 3)) return (x + y) % 3 ? null : rmp(RMP.gold, 0.9);
        if (cuff(x, y, 2)) return rmp(RMP.gold, t + 0.1);
        if (collar(x, y, 2)) return rmp(RMP.gold, t + 0.15);
        if (front && Math.abs(Math.abs(x - cx) - tw * 0.38) < 0.6 && (y - y0) % 3 === 1 && y < y1 - 3 && up[y * W + x] > 3) return rmp(RMP.gold, 0.9);
        if (back && Math.abs(x - cx) < 0.6 && y < y1 - 2 && up[y * W + x] > 2) return rmp(RMP.gold, 0.6);
        return null;
      });
      if (front) {   // 어깨에서 허리로 빨간 띠
        const sx = cx - tw * 0.55, sy = y0 + 2, ex = cx + tw * 0.8, ey = y1 - 3;
        over((x, y) => { const d = ((x - sx) * (ey - sy) - (y - sy) * (ex - sx)) / Math.hypot(ex - sx, ey - sy); if (Math.abs(d) > 2.2 || hem(x, y, 2) || sleeve(x, y)) return null; return Math.abs(d) > 1.5 ? rmp(RMP.gold, 0.75) : rmp(RMP.red, 0.6 - d * 0.12); }, 3);
        gem(cx - tw * 0.45, y0 + h * 0.5, 2, RMP.emerald, 6, RMP.gold);   // 훈장
        put(cx - tw * 0.42, y0 + h * 0.48 + 4, rmp(RMP.gold, 0.8), 6); put(cx - tw * 0.42 - 1, y0 + h * 0.48 + 4, rmp(RMP.gold, 0.5), 6);
      }
      if (back) gem(cx, y0 + h * 0.42, 3, RMP.red, 6, RMP.gold);
      SH.forEach(([sx, sy]) => { sph(RMP.gold, sx, sy, PR * 1.2, PR * 0.62, 4, RMP.gold); fringe(sx, sy + PR * 0.5, PR * 1.1, RMP.gold); gem(sx, sy, 1, RMP.red, 5, null); });
      for (let x = Math.ceil(a) + 2; x < b - 1; x += 5) { let yb = -1; for (let y = y1; y >= y0; y--) if (inM(x, y)) { yb = y; break; } if (yb > 0) gem(x, yb - 1, 1, RMP.ice, 4, null); }
      sparks(3, [255, 220, 120], 7);
    } else if (D === 'princess') {   // 공주님 리본 블라우스: 분홍 · 흰 레이스 · 퍼프 소매 · 큰 리본 · 진주
      base((x, y, t) => ((x * 3 + y * 5) % 11 === 0 ? rmp(RMP.white, 0.9) : rmp(RMP.pink, t + 0.1)));
      over((x, y, t) => {
        const d = dn[y * W + x];
        if (hem(x, y, 3)) return d === 3 ? ((x % 3) === 1 ? rmp(RMP.white, 0.8) : null) : rmp(RMP.white, t + 0.3 - ((x % 3) === 0 && d === 1 ? 0.4 : 0));
        if (collar(x, y, 3)) return up[y * W + x] === 3 ? ((x % 3) !== 0 ? rmp(RMP.white, 0.7) : null) : rmp(RMP.white, t + 0.35);
        return null;
      });
      if (!side) for (let i = -3; i <= 3; i++) { const px = cx + i * tw * 0.17, py = y0 + 4 * U + 3 + Math.abs(i) * -0.4 + (i * i) * 0.25; if (inM(Math.round(px), Math.round(py)) && front) { put(px, py, [255, 255, 255], 5, false); put(px + 1, py, rmp(RMP.white, 0.5), 5, false); } }
      SH.forEach(([sx, sy]) => sph(RMP.pink, sx, sy + 0.5, PR * 1.1, PR * 0.85, 4, null));
      SH.forEach(([sx, sy]) => { for (let k = -1; k <= 1; k++) for (let j = -2; j <= 1; j++) put(sx + k * PR * 0.5, sy + j, rmp(RMP.white, 0.75 - j * 0.08), 5, false); });
      const bx = cx, by = front ? y0 + h * 0.42 : y1 - h * 0.3, BR = Math.max(3.5, tw * 0.6);
      for (let x = Math.floor(a) - 2; x <= b + 2; x++) { let yb = -1; for (let y = y1; y >= y0; y--) if (inM(x, y)) { yb = y; break; } if (yb < 0 || sleeve(x, yb)) continue; const L = 2 + ((x % 3) === 1 ? 1 : 0); for (let k = 0; k <= L; k++) put(x, yb + k, k === L ? rmp(RMP.pink, 0.5) : rmp(k % 2 ? RMP.white : RMP.pink, 0.85), 3, k === L); }
      if (!side) {
        poly([[bx, by], [bx - BR, by - BR * 0.7], [bx - BR, by + BR * 0.7]], (x, y, u, w) => rmp(RMP.rose, 0.35 + u * 0.4 - Math.abs(w - 0.5) * 0.3), 6);
        poly([[bx, by], [bx + BR, by - BR * 0.7], [bx + BR, by + BR * 0.7]], (x, y, u, w) => rmp(RMP.rose, 0.6 - u * 0.25 - Math.abs(w - 0.5) * 0.3), 6);
        poly([[bx - 1, by], [bx - BR * 0.6, by + BR * 1.4], [bx - BR * 0.25, by + BR * 1.2]], () => rmp(RMP.rose, 0.4), 5);
        poly([[bx + 1, by], [bx + BR * 0.6, by + BR * 1.4], [bx + BR * 0.25, by + BR * 1.2]], () => rmp(RMP.rose, 0.3), 5);
        gem(bx, by, 1, RMP.rose, 7, null);
      } else gem(cx + tw * 0.5, y0 + h * 0.45, 2, RMP.rose, 6, null);
      sparks(6, [255, 140, 200], 3, true);
    } else if (D === 'wizard') {   // 대마법사 별빛 로브: 보라 · 금별 수 · 높은 금 깃 · 가운데 금 띠 · 큰 하늘빛 보석 · 수정 어깨
      base((x, y, t) => rmp(RMP.purple, t));
      over((x, y, t) => {
        if (hem(x, y, 2)) return dn[y * W + x] === 1 ? rmp(RMP.cyan, 0.75) : rmp(RMP.gold, t + 0.15);
        if (hem(x, y, 3) && x % 4 === 1) return rmp(RMP.cyan, 0.9);
        if (cuff(x, y, 2)) return rmp(RMP.gold, t + 0.1);
        if (!side && Math.abs(x - cx) <= 1.2 && up[y * W + x] > 2) return rmp(RMP.gold, 0.55 + (Math.abs(x - cx) < 0.6 ? 0.3 : 0) + ((y % 3) === 0 ? 0.15 : 0));
        if (!side && Math.abs(x - cx) <= 2.2 && Math.abs(x - cx) > 1.2 && (y % 3) === 0 && up[y * W + x] > 2) return rmp(RMP.cyan, 0.8);
        const sx = (x * 7 + Math.floor(y / 5) * 3) % 9, sy = y % 5; if (up[y * W + x] > 2 && Math.abs(x - cx) > 2.5 && ((sx === 4 && sy === 2) || ((sx === 3 || sx === 5) && sy === 2) || (sx === 4 && (sy === 1 || sy === 3)))) return sx === 4 && sy === 2 ? [255, 250, 210] : rmp(RMP.gold, 0.75);
        return null;
      });
      if (!side) for (let s = -1; s <= 1; s += 2) poly([[cx + s * 1, y0 + 1], [cx + s * tw * 0.7, y0 - 4], [cx + s * tw * 0.78, y0 + 3], [cx + s * tw * 0.3, y0 + 5]], (x, y, u, w) => rmp(RMP.gold, 0.85 - w * 0.4), 3);
      if (front) { for (let r = 6; r >= 4; r--) for (let k = 0; k < 28; k++) glow(cx + Math.cos(k / 28 * 6.283) * r, y0 + h * 0.4 + Math.sin(k / 28 * 6.283) * r, [120, 230, 255], 0.3); gem(cx, y0 + h * 0.4, 3, RMP.cyan, 6, RMP.gold); } else if (back) gem(cx, y0 + h * 0.38, 2, RMP.magenta, 6, RMP.gold); else gem(cx + tw * 0.4, y0 + h * 0.4, 2, RMP.cyan, 6, RMP.gold);
      SH.forEach(([sx, sy, s]) => {
        sph(RMP.purple, sx, sy, PR * 1.15, PR * 0.72, 4, RMP.gold);
        poly([[sx - 2, sy - 1], [sx + s * 1.2, sy - PR * 1.9 - 2], [sx + 2, sy - 1]], (x, y, u) => rmp(RMP.magenta, 0.9 - u * 0.6), 6);
        put(sx + s * 0.2, sy - PR * 0.6 - 1, [255, 230, 255], 7, false);
      });
      sparks(4, [140, 240, 255], 11, true);
    } else if (D === 'ice') {   // 얼음 크리스탈 아머: 얼음 결 · 어깨 수정 가시 · 가운데 빛나는 큰 보석 · 고드름 밑단
      base((x, y, t) => { const f = ((x + y) % 6 === 0 || (x - y + 60) % 7 === 0) ? 0.25 : 0; return rmp(RMP.ice, t * 0.8 + 0.1 + f); });
      plate(RMP.ice, RMP.silver, RMP.ice);
      over((x, y, t) => { if (collar(x, y, 2)) return rmp(RMP.silver, t + 0.2); if (cuff(x, y, 2)) return rmp(RMP.silver, t + 0.1); if (hem(x, y, 1)) return rmp(RMP.silver, t + 0.1); return null; });
      for (let x = Math.ceil(a); x <= b; x += 3) { const len = 2 + Math.round(hsh(x, 9) * 3); let yb = -1; for (let y = y1; y >= y0; y--) if (inM(x, y)) { yb = y; break; } if (yb < 0) continue; for (let k = 1; k <= len; k++) { put(x, yb + k, rmp(RMP.ice, 0.85 - k * 0.12), 3); if (k < len - 1) put(x + 1, yb + k, rmp(RMP.ice, 0.5 - k * 0.08), 3); } }
      SH.forEach(([sx, sy, s]) => {
        sph(RMP.silver, sx, sy + 0.5, PR * 1.15, PR * 0.7, 4, RMP.ice);
        [[-0.6, 1.7, -0.6], [0, 2.7, 0.1], [0.6, 1.6, 0.6]].forEach(([o, L, lean]) => { const bx = sx + s * o * PR, top = sy - PR * L - 1; poly([[bx - 2, sy], [bx + s * lean * 3, top], [bx + 2, sy]], (x, y, u, w) => rmp(RMP.ice, 0.95 - u * 0.55 - w * 0.1), 6); });
      });
      const gy = y0 + h * (side ? 0.42 : 0.4);
      if (!back) { for (let r = 5; r >= 4; r--) for (let k = 0; k < 24; k++) glow(cx + Math.cos(k / 24 * 6.283) * r, gy + Math.sin(k / 24 * 6.283) * r, [200, 250, 255], 0.35); gem(cx, gy, 3, RMP.ice, 6, RMP.silver); }
      else poly([[cx, gy - 5], [cx + 3, gy], [cx, gy + 5], [cx - 3, gy]], (x, y, u, w) => rmp(RMP.ice, 0.9 - u * 0.5), 5);
      sparks(6, [190, 240, 255], 5, true);
    } else if (D === 'dragon') {   // 화염 드래곤 아머: 검은 비늘 · 용암 금 · 용암 핵 · 뿔 어깨 · 어깨 위 불꽃
      SH.forEach(([sx, sy, s]) => { for (let f = 0; f < 3; f++) { const fx = sx + s * (f - 1) * PR * 0.55, L = PR * (2.2 + hsh(f, 3) * 1.1) + 2; poly([[fx - 3, sy], [fx - 1.4, sy - L * 0.6], [fx + s * 1.2, sy - L], [fx + 1.8, sy - L * 0.55], [fx + 3, sy]], (x, y, u, w) => rmp(RMP.lava, 0.25 + w * 0.7), 1, true); } });
      base((x, y, t) => { const r = y % 3, o = Math.floor(y / 3) % 2 * 2, c = (x + o) % 4; return rmp(RMP.char, t * 0.7 + 0.15 + (r === 0 && c !== 0 ? 0.3 : 0) - (c === 0 ? 0.12 : 0)); });
      over((x, y, t) => {
        const crack = Math.abs(Math.sin(x * 0.9 + y * 0.35) * 2.2 + Math.sin(y * 0.7) * 1.5 - (x - cx) * 0.25) < 0.45 && up[y * W + x] > 3 && hsh(x, y) < 0.8;
        if (hem(x, y, 2)) return rmp(RMP.lava, 0.45 + (dn[y * W + x] === 2 ? 0.3 : 0));
        if (cuff(x, y, 2)) return rmp(RMP.lava, 0.5);
        if (collar(x, y, 1)) return rmp(RMP.bone, t + 0.2);
        if (crack) return rmp(RMP.lava, 0.6 + hsh(y, x) * 0.3);
        return null;
      });
      plate(RMP.char, RMP.lava, RMP.char);
      const gy = y0 + h * 0.42;
      if (!side) { for (let r = 5; r >= 3; r--) for (let k = 0; k < 24; k++) glow(cx + Math.cos(k / 24 * 6.283) * r, gy + Math.sin(k / 24 * 6.283) * r * 0.9, [255, 120, 10], 0.3); gem(cx, gy, 3, RMP.lava, 6, RMP.gold); }
      else gem(cx + tw * 0.35, gy, 2, RMP.lava, 6, RMP.gold);
      SH.forEach(([sx, sy, s]) => {
        sph(RMP.char, sx, sy, PR * 1.2, PR * 0.78, 4, RMP.lava);
        poly([[sx - s * 1.2, sy - 1], [sx + s * PR * 1.7, sy - PR * 2.1 - 1], [sx + s * PR * 0.9, sy]], (x, y, u, w) => rmp(RMP.bone, 0.9 - w * 0.5), 6);
        put(sx - s * 0.2, sy, rmp(RMP.lava, 0.9), 7, false);
      });
      sparks(3, [255, 170, 40], 13);
    } else if (D === 'angel') {   // 천사 날개 튜닉: 흰 비단 · 금테 · 날개(앞 = 어깨 뒤로 솟음, 뒤 = 등에 크게) · 해 문장
      const wing = (s, z, behind, big) => {   // 깃털 5장: 어깨뼈에서 바깥 위로 부채꼴
        const K = big ? 1.15 : 1, rx0 = side ? cx - tw * 0.2 : cx + s * tw * (big ? 0.2 : 0.45), ry0 = y0 + (big ? 4 : 3);
        for (let f = 0; f < 6; f++) {
          const th = -0.05 + f * 0.27, dx = s * Math.cos(th), dy = -Math.sin(th), L = h * (0.95 - f * 0.07) * K;
          ell(rx0 + dx * L * 0.52, ry0 + dy * L * 0.52, L * 0.52, 2.8 - f * 0.15, Math.atan2(dy, dx), (u, w, d) => rmp(f % 2 ? RMP.white : RMP.ice, (f % 2 ? 0.95 : 0.85) - w * 0.25 - d * 0.2), z, behind);
        }
        for (let f = 0; f < 5; f++) { const th = 0.1 + f * 0.3, dx = s * Math.cos(th), dy = -Math.sin(th), L = h * (0.45 - f * 0.04) * K; ell(rx0 + dx * L * 0.5, ry0 + dy * L * 0.5, L * 0.5, 2, Math.atan2(dy, dx), (u, w) => rmp(RMP.white, 0.95 - w * 0.2), z + 1, behind); }
        ell(rx0, ry0, 2.4, 2, 0, () => rmp(RMP.gold, 0.8), z + 2, behind);
      };
      if (!back) { if (!side) wing(-1, 1, true); wing(side ? -1 : 1, 1, true); }
      base((x, y, t) => rmp(RMP.white, t * 0.7 + 0.25));
      over((x, y, t) => {
        if (hem(x, y, 3)) return dn[y * W + x] === 3 ? rmp(RMP.ice, 0.8) : rmp(RMP.gold, t + 0.2 + (dn[y * W + x] === 2 ? 0.2 : 0));
        if (cuff(x, y, 2)) return rmp(RMP.gold, t + 0.15);
        if (collar(x, y, 2)) return rmp(RMP.gold, t + 0.25);
        if (!side && Math.abs(x - cx) < 0.6 && y > y0 + h * 0.55) return rmp(RMP.gold, 0.6);
        return null;
      });
      if (back) { wing(-1, 5, false, true); wing(1, 5, false, true); }
      else { const gy = y0 + h * 0.42, gx = side ? cx + tw * 0.35 : cx; for (let r = 6; r >= 4; r--) for (let k = 0; k < 28; k++) glow(gx + Math.cos(k / 28 * 6.283) * r, gy + Math.sin(k / 28 * 6.283) * r, [255, 240, 170], 0.35); for (let k = 0; k < 8; k++) { const an = k / 8 * 6.283; put(gx + Math.cos(an) * 4.5, gy + Math.sin(an) * 4.5, rmp(RMP.gold, 0.85), 5); put(gx + Math.cos(an) * 3.5, gy + Math.sin(an) * 3.5, rmp(RMP.gold, 0.6), 5); } gem(gx, gy, 2, RMP.ice, 6, RMP.gold); }
      SH.forEach(([sx, sy]) => { sph(RMP.gold, sx, sy, PR * 1.05, PR * 0.55, 4, null); gem(sx, sy, 1, RMP.ice, 5, null); });
      sparks(5, [255, 230, 140], 17, true);
    } else if (D === 'forest') {   // 숲의 정령 튜닉: 잎 비늘 · 나무 띠 · 꽃 · 잎 어깨 · 초록 보석 · 잎 밑단
      base((x, y, t) => { const o = Math.floor(y / 3) % 2 * 2, c = (x + o) % 4, r = y % 3; return rmp(RMP.leaf, t * 0.8 + 0.1 + (r === 0 && c !== 0 ? 0.22 : 0) - (c === 0 ? 0.12 : 0)); });
      over((x, y, t) => {
        if (collar(x, y, 2)) return rmp(RMP.bark, t + 0.3 - (up[y * W + x] === 2 ? 0.2 : 0));
        if (cuff(x, y, 2)) return rmp(RMP.bark, t + 0.2);
        const by = y1 - Math.round(h * 0.3);
        if (!sleeve(x, y) && Math.abs(y - by) <= 1) return rmp(RMP.bark, 0.55 + (y === by - 1 ? 0.25 : 0) - ((x % 3) === 0 ? 0.15 : 0));
        return null;
      });
      for (let x = Math.ceil(a) - 1; x <= b + 1; x += 3) { let yb = -1; for (let y = y1; y >= y0; y--) if (inM(x, y)) { yb = y; break; } if (yb < 0) continue; poly([[x - 2, yb - 2], [x + 0.3, yb + 4], [x + 2, yb - 2]], (xx, yy, u, w) => rmp(RMP.leaf, 0.8 - w * 0.45 - u * 0.15), 3); }
      const fl = (fx, fy, c) => { fx = Math.round(fx); fy = Math.round(fy); [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(([dx, dy], j) => put(fx + dx, fy + dy, j < 4 ? c : mixc(c, [255, 255, 255], 0.45), 6)); put(fx, fy, [255, 214, 40], 7, false); };
      const by = y1 - Math.round(h * 0.3);
      if (!side) { fl(cx - tw * 0.5, by, [255, 110, 170]); fl(cx + tw * 0.5, by, [255, 110, 170]); gem(cx, by, 2, RMP.emerald, 6, RMP.gold); }
      if (front) { fl(cx + tw * 0.45, y0 + h * 0.3, [255, 255, 255]); fl(cx - tw * 0.3, y0 + h * 0.22, [255, 160, 210]); }
      if (back) fl(cx, y0 + h * 0.35, [255, 255, 255]);
      if (side) gem(cx + tw * 0.35, by, 2, RMP.emerald, 6, RMP.gold);
      SH.forEach(([sx, sy, s]) => { [[-0.7, 0.35, -0.9], [0.55, 0.15, 0.7], [0, -0.45, 0.1]].forEach(([o, oy, ang], j) => ell(sx + s * o * PR, sy + oy * PR, PR * 0.95, PR * 0.45, ang * s, (u, w, d) => (Math.abs(w) < 0.2 ? rmp(RMP.leaf, 0.25) : rmp(RMP.leaf, 0.9 - w * 0.35 - d * 0.25 - j * 0.06)), 4 + j)); fl(sx, sy - PR * 0.1, [255, 140, 190]); });
      sparks(4, [210, 255, 150], 23, true);
    } else if (D === 'pirate') {   // 해적 선장 코트: 빨간 코트 · 흰 주름 장식 · 금 단추 두 줄 · 검은 벨트 금 버클 · 금 견장 · 코트 자락
      const tl = Math.round(h * 0.28);
      for (let s = -1; s <= 1; s += 2) { if (side && s < 0) continue; const xa = side ? a : (s < 0 ? a : cx + 1.5), xb = side ? b : (s < 0 ? cx - 1.5 : b); poly([[xa, y1 - 2], [xb, y1 - 2], [xb + (s > 0 || side ? 1.5 : 0), y1 + tl], [xa - (s < 0 ? 1.5 : 0), y1 + tl - (side ? 0 : 1)]], (x, y, u, w) => rmp(RMP.red, 0.72 - w * 0.22 + (x === Math.round(xa) || x === Math.round(xb) ? -0.2 : 0)), 1); }
      if (back) poly([[a, y1 - 2], [b, y1 - 2], [b + 1.5, y1 + tl], [a - 1.5, y1 + tl]], (x, y, u, w) => (Math.abs(x - cx) < 0.6 && y > y1 ? [40, 6, 10] : rmp(RMP.red, 0.72 - w * 0.22)), 1);
      base((x, y, t) => rmp(RMP.red, t));
      for (let y = y1 - 1; y <= y1 + tl; y++) for (let x = Math.floor(a) - 2; x <= b + 2; x++) if (Z[y * W + x] === 1 && y >= y1 + tl - 1) put(x, y, rmp(RMP.gold, 0.7), 2);
      over((x, y, t) => {
        if (cuff(x, y, 3)) return rmp(RMP.gold, t + 0.1 + (dn[y * W + x] === 3 ? 0.2 : 0));
        if (collar(x, y, 1)) return rmp(RMP.gold, t + 0.2);
        const by = y1 - Math.round(h * 0.3);
        if (Math.abs(y - by) <= 1 && !sleeve(x, y)) return Math.abs(x - cx) <= 2.2 && !back ? (Math.abs(x - cx) > 1.2 || y !== by ? rmp(RMP.gold, 0.85) : rmp(RMP.black, 0.2)) : rmp(RMP.black, 0.3 + (y === by - 1 ? 0.25 : 0));
        if (front && Math.abs(x - cx) < tw * 0.22 && y < y0 + h * 0.5 && up[y * W + x] > 1) { const z = (y + Math.floor(Math.abs(x - cx))) % 2; return rmp(RMP.white, 0.75 + z * 0.25 - Math.abs(x - cx) * 0.06); }
        if (front && Math.abs(Math.abs(x - cx) - tw * 0.45) < 0.6 && (y - y0) % 3 === 2 && y < by - 1 && up[y * W + x] > 3) return rmp(RMP.gold, 0.95);
        if (front && Math.abs(Math.abs(x - cx) - tw * 0.24) < 0.6 && y >= y0 + h * 0.5 && y < by - 1) return rmp(RMP.gold, 0.6);
        return null;
      });
      if (back) gem(cx, y0 + h * 0.4, 2, RMP.gold, 5, null);
      SH.forEach(([sx, sy]) => { sph(RMP.gold, sx, sy, PR * 1.05, PR * 0.6, 4, RMP.gold); fringe(sx, sy + PR * 0.5, PR, RMP.gold); });
      sparks(2, [255, 220, 120], 29);
    } else if (D === 'space') {   // 은하 우주 기사 슈트: 흰 장갑판 · 하늘빛 빛 줄 · 가슴 빛 코어 · 둥근 어깨 장갑
      base((x, y, t) => rmp(RMP.tech, t * 0.8 + 0.15 - (((y - y0) % 7 === 6 || Math.abs(x - cx) < 0.6) && up[y * W + x] > 2 ? 0.35 : 0)));
      over((x, y, t) => {
        if (collar(x, y, 2)) return rmp(RMP.navy, t * 0.5 + 0.2);
        if (hem(x, y, 2)) return dn[y * W + x] === 2 ? rmp(RMP.cyan, 0.75) : rmp(RMP.navy, 0.3);
        if (cuff(x, y, 2)) return dn[y * W + x] === 2 ? rmp(RMP.cyan, 0.8) : rmp(RMP.navy, 0.3);
        if (!sleeve(x, y) && Math.abs(Math.abs(x - cx) - tw * 0.62) < 0.6 && up[y * W + x] > 3 && dn[y * W + x] > 3) return rmp(RMP.cyan, 0.7 + ((y % 4) === 0 ? 0.25 : 0));
        if (sleeve(x, y) && up[y * W + x] === 3) return rmp(RMP.cyan, 0.8);
        return null;
      });
      if (!back) plate(RMP.tech, RMP.cyan, RMP.tech);
      const gy = y0 + h * 0.4, gx = side ? cx + tw * 0.35 : cx;
      if (!back) { for (let r = 6; r >= 4; r--) for (let k = 0; k < 28; k++) glow(gx + Math.cos(k / 28 * 6.283) * r, gy + Math.sin(k / 28 * 6.283) * r, [120, 240, 255], 0.28); ell(gx, gy, 3.6, 3.6, 0, (u, w, d) => (d > 0.55 ? rmp(RMP.tech, 0.5 - u * 0.2 - w * 0.3) : rmp(RMP.cyan, 1 - d * 1.2)), 5); put(gx - 1, gy - 1, [255, 255, 255], 7, false); }
      else { poly([[cx - tw * 0.4, y0 + 3], [cx + tw * 0.4, y0 + 3], [cx + tw * 0.32, y0 + h * 0.62], [cx - tw * 0.32, y0 + h * 0.62]], (x, y, u, w) => (Math.abs(u - 0.5) < 0.08 ? rmp(RMP.cyan, 0.85) : rmp(RMP.tech, 0.7 - u * 0.3 - w * 0.2)), 4); [0.25, 0.5].forEach(f => put(cx, y0 + 3 + h * f, rmp(RMP.cyan, 1), 6, false)); }
      SH.forEach(([sx, sy]) => { sph(RMP.tech, sx, sy, PR * 1.2, PR * 0.78, 4, null); ell(sx, sy + PR * 0.15, PR * 1.1, 0.9, 0, () => rmp(RMP.cyan, 0.85), 5); });
      sparks(4, [120, 240, 255], 31, true);
    } else if (D === 'hanbok') {   // 색동 저고리: 노랑 비단 · 색동 소매 · 흰 동정 · 남색 깃 · 빨간 고름 · 금박 꽃
      base((x, y, t) => (sleeve(x, y) ? mixc(SAEK[Math.floor((x < cx ? a - x : x - b) / 2) % 6], [0, 0, 0], Math.max(0, 0.4 - t * 0.45)) : rmp(RMP.yellow, t + 0.05)));
      over((x, y, t) => {
        if (cuff(x, y, 2)) return rmp(RMP.navy, t * 0.6 + 0.25);
        if (sleeve(x, y)) return null;
        const u = up[y * W + x];
        if (front) { const d = (x - cx) + (y - y0) * 0.9 - tw * 0.35; if (Math.abs(d) < 1.5 && y < y0 + h * 0.62) return rmp(RMP.navy, 0.45 + (d < 0 ? 0.2 : 0)); if (d < -1.5 && d > -3.5 && y < y0 + h * 0.62) return rmp(RMP.white, 0.9); }
        if (u <= 3 && Math.abs(x - cx) < tw * 0.8) return u === 1 ? rmp(RMP.white, 0.95) : rmp(RMP.navy, 0.5 + (u === 2 ? 0.15 : 0));
        if (hem(x, y, 3)) { const d = dn[y * W + x]; return d === 1 ? rmp(RMP.gold, 0.55) : d === 2 ? rmp(RMP.gold, 0.85 + ((x % 4) === 0 ? 0.15 : 0)) : ((x % 4) === 2 ? rmp(RMP.gold, 0.7) : null); }
        return null;
      });
      if (!side) { const fl = (fx, fy) => { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => put(fx + dx, fy + dy, rmp(RMP.gold, 0.85), 4)); put(fx, fy, [255, 120, 120], 5, false); }; fl(Math.round(cx - tw * 0.55), Math.round(y0 + h * 0.6)); fl(Math.round(cx + (front ? tw * 0.6 : tw * 0.55)), Math.round(y0 + h * 0.6)); if (back) fl(Math.round(cx), Math.round(y0 + h * 0.4)); }
      if (!back) { const kx = side ? cx + tw * 0.4 : cx + tw * 0.15, ky = y0 + h * 0.55; ell(kx, ky, 2.4, 1.8, 0, (u, w) => rmp(RMP.red, 0.85 - w * 0.2), 6); poly([[kx - 1.6, ky], [kx - 5, y1 + 6], [kx - 1.8, y1 + 7]], (x, y, u, w) => rmp(RMP.red, 0.9 - w * 0.25 - u * 0.15), 5); poly([[kx + 0.4, ky], [kx + 0.2, y1 + 8], [kx + 3.6, y1 + 8.6]], (x, y, u, w) => rmp(RMP.red, 0.75 - w * 0.2 - u * 0.1), 5); }
      sparks(3, [255, 220, 120], 37);
    }
    // 조각마다 진한 테두리 (아래 조각과 닿는 가장자리)
    const ol = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, z = Z[k]; if (!z || !OL[k]) continue;
      const lo = j => Z[j] < z && (z >= 2 || Z[j] > 0 || !A0[j]);
      if ((x + 1 >= W || lo(k + 1)) || (x < 1 || lo(k - 1)) || (y + 1 >= H || lo(k + W)) || (y < 1 || lo(k - W))) ol.push(k);
    }
    ol.forEach(k => { const i = k * 4; p[i] *= 0.3; p[i + 1] *= 0.26; p[i + 2] *= 0.34; });
  }
  const recCv = {};
  // 몸 그림(base)에 옷 색을 칠한 캔버스 · 칠할 게 없으면 base 그대로 · 아직 준비 안 됐으면 null
  function recolorBody(base, n, view, cb) {
    const co = clothOf(n); if (!co.t && !co.b && !co.s) return base;
    const at = co.t || co.b ? clothAtlas(cb) : { bad: true }; if (!at) return null;
    const sat = co.s ? shoeAtlas(cb) : null; if (co.s && !sat) return null;
    const g = n.g === 'f' ? 'f' : 'm', v = vOf(view), si = BODY_SKINS.indexOf(n.skin), ri = CLOTH_GV.indexOf(g + '_' + v);
    const ck = n.skin + g + v + '|' + co.t + '|' + co.b + '|' + co.s; if (recCv[ck]) return recCv[ck];
    const W = base.naturalWidth || base.width, H = base.naturalHeight || base.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(base, 0, 0);
    if (si >= 0 && ri >= 0 && !at.bad) {
      const d = x.getImageData(0, 0, W, H), p = d.data, AW = at.width, A = at.data, ox = si * 72, oy = ri * 136;
      const T = co.t && CLOTH[co.t], Bt = co.b && CLOTH[co.b];
      for (let yy = 0; yy < H && yy < 136; yy++) for (let xx = 0; xx < W && xx < 72; xx++) {
        const ai = ((oy + yy) * AW + ox + xx) * 4, i = (yy * W + xx) * 4; if (!p[i + 3]) continue;
        let it = null, sh = 0, k0 = 0.6, k1 = 0.45;
        if (T && A[ai]) { it = T; sh = (A[ai] - 1) / 254; } else if (Bt && A[ai + 1]) { it = Bt; sh = (A[ai + 1] - 1) / 254; k0 = 0.55; k1 = 0.6; }
        if (!it) continue;
        let col = it.c;
        if (it.p === 'stripe' && Math.floor(yy / 3) % 2) col = it.c2;
        if (it.p === 'check' && (xx % 6 === 0 || yy % 6 === 0)) col = it.c2;
        const m = k0 + k1 * sh;
        p[i] = Math.min(255, col[0] * m); p[i + 1] = Math.min(255, col[1] * m); p[i + 2] = Math.min(255, col[2] * m);
      }
      x.putImageData(d, 0, 0);
    }
    if (co.s && si >= 0 && ri >= 0 && !sat.bad) {   // v137 신발
      const d = x.getImageData(0, 0, W, H);
      paintShoes(d.data, W, H, sat.data, sat.width, si * 72, ri * 136, SHOES[co.s], n.skin);
      x.putImageData(d, 0, 0);
    }
    const TF = co.t && CLOTH[co.t] && CLOTH[co.t].f, BF = co.b && CLOTH[co.b] && CLOTH[co.b].f;
    if ((TF || BF) && si >= 0 && ri >= 0 && !at.bad) {   // v142 화려한 상의·하의: 양옆·위아래 여백(FPAD)을 둔 캔버스에 옷 자리 모양대로 그림 (하의 먼저, 상의가 그 위)
      const P = FPAD, c2 = document.createElement('canvas'); c2.width = W + P * 2; c2.height = H + P * 2;
      const x2 = c2.getContext('2d'); x2.drawImage(c, P, P);
      const W2 = c2.width, H2 = c2.height, d = x2.getImageData(0, 0, W2, H2), A = at.data, AW = at.width, ox = si * 72, oy = ri * 136;
      const part = (ch, kind, pt) => {   // ch = cloth.png 채널(0 빨강 = 티, 1 초록 = 바지·치마) · 밝기는 그 옷 자리에서 가장 밝은 칸 = 1
        const M = new Uint8Array(W2 * H2), S = new Float32Array(W2 * H2); let mx = 1;
        for (let yy = 0; yy < H && yy < 136; yy++) for (let xx = 0; xx < W && xx < 72; xx++) {
          const r = A[((oy + yy) * AW + ox + xx) * 4 + ch], k = (yy + P) * W2 + xx + P;
          if (r && d.data[k * 4 + 3]) { M[k] = 1; S[k] = r; if (r > mx) mx = r; }
        }
        for (let k = 0; k < S.length; k++) if (M[k]) { if (S[k] < mx * 0.22) { M[k] = 0; S[k] = 0; } else S[k] = S[k] / mx; }   // 아주 흐린 가장자리 칸은 빼기
        if (ch === 1 && v === 's') for (let k = 0; k < S.length; k++) if (M[k] && S[k] < 0.5) S[k] = 0.5 + (S[k] - 0.22) * 0.4;   // v153 옆모습 먼 다리가 갑옷에서 너무 까맣게 보이던 것 (조금 밝게)
        if (ch === 1) {   // v153 옆모습의 먼 다리(청바지)가 cloth.png 바지 자리에 빠져 있음 → 바지 자리 줄 안의 청바지 색 칸도 바지로
          let ya = H2, yb = -1; for (let k = 0; k < M.length; k++) if (M[k]) { const yy = (k / W2) | 0; if (yy < ya) ya = yy; if (yy > yb) yb = yy; }
          for (let yy = ya; yy <= yb; yy++) for (let xx = 0; xx < W2; xx++) { const k = yy * W2 + xx, i = k * 4, r = d.data[i], g2 = d.data[i + 1], b2 = d.data[i + 2]; if (!M[k] && d.data[i + 3] > 200 && ((b2 > r + 12 && b2 > g2 + 2) || (yy < yb - 3 && r + g2 + b2 < 200 && b2 >= r))) { M[k] = 1; S[k] = Math.min(1, 0.5 + (r + g2 + b2) / 700); } }
        }
        paintFancy(d.data, W2, H2, M, S, kind, v, g, pt);
      };
      if (BF) part(1, BF, 'b');
      if (TF) part(0, TF, 't');
      x2.putImageData(d, 0, 0); c2.pad = P; c2.top = P; c2.bw = W; c2.bh = H;
      return (recCv[ck] = c2);
    }
    c.bw = W; c.bh = H;
    return (recCv[ck] = c);
  }
  /* v120 선생님 11/12 "예전 도트 아바타는 다 지우기": 새 몸 그림으로 못 그리는 옷·장식(내린 상품, 게임 NPC 옷 등)은
   *  몸 그림에서는 기본(기본 티·청바지·기본 운동화·짧은 머리, 모자·얼굴·등 없음, 피부 s1)으로 바꿔 그림 → 어디서나 새 몸 그림
   *  (v114~v118 의 머리·모자·얼굴·신발·등 장식 얹기(HAIR_OV·HAT_POS·BALD …)와 그 그림은 v120 정리 때 뺐음 → 작업일지 0000000-44) */
  function bodyNorm(av) {
    const n = Object.assign({}, normalize(av)), free = id => !id || (byId[id] && byId[id].price === 0 && byId[id].slot === 'hair');
    if (!(n.top === 't_basic' || CLOTH[n.top])) n.top = 't_basic';
    if (!(n.bottom === 'b_jeans' || CLOTH[n.bottom])) n.bottom = 'b_jeans';
    if (!(n.shoes === 'sh_basic' || SHOES[n.shoes])) n.shoes = 'sh_basic';   // v137 신발 8종은 몸 그림에 칠함
    if (!(n.face && byId[n.face] && byId[n.face].img)) n.face = null;   // v138 얼굴 장식은 몸 그림 캔버스에 얹음
    if (!(n.hat && byId[n.hat] && byId[n.hat].img)) n.hat = null;   // v139 모자도 몸 그림 캔버스에 얹음
    n.back = null;
    if (!free(n.hair) && !(byId[n.hair] && byId[n.hair].slot === 'hair' && byId[n.hair].img)) n.hair = 'h_short';   // v140 헤어 상품은 그대로
    if (!BODY_SKINS.includes(n.skin)) n.skin = 's1';
    return n;
  }
  function useBody(av) {
    return !!av;   // v120 성별을 아직 안 골랐어도(남 몸) · 못 그리는 옷이 있어도(기본 옷으로) 늘 새 몸 그림
  }
  const imgs = {};
  function loadImg(src, cb) {
    let e = imgs[src];
    if (!e) {
      const im = new Image(); e = imgs[src] = { im, ok: false, bad: false, cbs: [] };
      im.onload = () => { e.ok = true; e.cbs.splice(0).forEach(f => { try { f(); } catch (er) { /* noop */ } }); };
      im.onerror = () => { e.bad = true; e.cbs.length = 0; };
      im.src = (window.GOGO_BASE || '') + src;
    }
    if (e.ok) return e.im;
    if (cb && !e.bad && !e.cbs.includes(cb)) e.cbs.push(cb);
    return null;
  }
  const vOf = view => (view === 'b' || view === 's' ? view : 'f');
  // 몸 그림 (피부·성별·방향 + 옷 색) — 아직 못 받았으면 null
  function bodyComp(av, view, cb) {
    const n = bodyNorm(av), bi = bodyImg(n.g, view, cb, n.skin);
    if (av && av.rpgAr && CLOTH['t_' + av.rpgAr]) { n.top = 't_' + av.rpgAr; n.bottom = 'b_' + av.rpgAr; }   // v153 skillcom RPG 갑옷을 입으면 상의·하의 자리에 갑옷을 그림
    return bi && recolorBody(bi, n, view, cb);
  }
  /* 몸 그림을 칸 크기 k 로 그림: 발끝 = 28.4칸, 원래 몸 그림 키 = 27.4칸, 가운데 x = cx.
   *  얹은 머리가 위로 높으면(닭벼슬 등) 칸 밖으로 안 나가게 조금 작게 */
  function fitBody(x, im, cx, k) {
    const P = im.pad || 0, nw = im.bw || im.naturalWidth, nh = im.bh || im.naturalHeight, foot = 28.4 * k;
    let s = 27.4 * k / nh;
    const tall = nh + P - (im.top != null ? im.top : P);
    if (tall * s > foot - 0.15 * k) s = Math.max(s * 0.85, (foot - 0.15 * k) / tall);   // 토끼 귀처럼 아주 높으면 조금만 줄이고 위는 살짝 잘림
    const sm = x.imageSmoothingEnabled; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(im, Math.round(cx - (P + nw / 2) * s), Math.round(foot - (P + nh) * s), Math.round((nw + P * 2) * s), Math.round((nh + P * 2) * s));
    x.imageSmoothingEnabled = sm;
  }
  // v114 몸 그림을 사이트 아바타 칸 크기(GW×GH, 1칸 = 4점)에 맞춰 둔 캔버스 (걷기 rig 에 그대로 씀) · 아직 못 받았으면 null
  const bodyCv = {};
  function bodyCanvas(av, view, cb) {
    const n = bodyNorm(av), im = bodyComp(n, view, cb); if (!im) return null;
    const co = clothOf(n), key = bodySrc(n.g, view, n.skin) + '|' + co.t + '|' + co.b + '|' + co.s + '|' + n.face + '|' + n.hat + '|' + n.hair; if (bodyCv[key]) return bodyCv[key];
    const fIt = n.face && byId[n.face], fIm = fIt ? loadImg(fIt.img, cb) : null;
    const hIt = n.hat && byId[n.hat], hIm = hIt ? loadImg(hIt.img, cb) : null;
    const rIt = n.hair && byId[n.hair] && byId[n.hair].img ? byId[n.hair] : null, rIm = rIt ? loadImg(rIt.img, cb) : null;
    if ((fIt && !fIm) || (hIt && !hIm) || (rIt && !rIm)) return null;   // v138~v140 얼굴 장식·모자·헤어 그림을 받으면 onBody 로 다시
    const c = document.createElement('canvas'); c.width = GW * 4; c.height = GH * 4;
    const cx2 = c.getContext('2d');
    // v140 머리 위로 솟는 헤어·모자(up)가 있으면 위로 여유를 두고 그린 뒤, 그만큼 몸 전체를 조금 작게 줄여 발끝은 그대로
    const U = Math.min(21, Math.max(rIt ? rIt.up || 0 : 0, hIt ? hIt.up || 0 : 0));
    const t = U ? document.createElement('canvas') : c; if (U) { t.width = c.width; t.height = c.height + U; }
    const tx = U ? t.getContext('2d') : cx2;
    if (U) { const b0 = document.createElement('canvas'); b0.width = c.width; b0.height = c.height; fitBody(b0.getContext('2d'), im, 9 * 4, 4); tx.drawImage(b0, 0, U); }
    else fitBody(tx, im, 9 * 4, 4);
    const ci = (n.g === 'f' ? 3 : 0) + (view === 's' ? 1 : view === 'b' ? 2 : 0);
    tx.imageSmoothingEnabled = false;
    if (rIm) {   // v140 헤어: 칸 72×120 (몸 캔버스 y -24 ~ 95) · 초록(0,255,0) 칸 = 원래 머리카락 지우기 · (255,0,밝기) 칸 = 피부색(두피·귀·목)
      const hp = hairParts(rIm, n.skin, rIt.img);
      tx.globalCompositeOperation = 'destination-out'; tx.drawImage(hp.er, ci * 72, 0, 72, 120, 0, U - 24, 72, 120);
      tx.globalCompositeOperation = 'source-over'; tx.drawImage(hp.pt, ci * 72, 0, 72, 120, 0, U - 24, 72, 120);
    }
    if (fIm) {   // v138 얼굴 장식: 칸 = 남 앞·옆·뒤, 여 앞·옆·뒤 (72×64, 몸 캔버스 왼쪽 위에 그대로)
      const src = fIt.skinKey ? skinKeyed(fIm, n.skin, fIt.img) : fIm;
      tx.drawImage(src, ci * 72, 0, 72, 64, 0, U, 72, 64);
    }
    if (hIm) tx.drawImage(hIm, ci * 72, 0, 72, 88, 0, U - 24, 72, 88);   // v139 모자: 칸 72×88 (몸 캔버스 y -24 부터)
    if (U) { const k = c.height / t.height, dw = c.width * k; cx2.imageSmoothingEnabled = true; cx2.imageSmoothingQuality = 'high'; cx2.drawImage(t, (c.width - dw) / 2, 0, dw, c.height); }
    return (bodyCv[key] = c);
  }
  // v140 헤어 그림을 '지울 칸'(er)과 '그릴 칸'(pt, 피부색 칸은 그 사람 피부색)으로 나눔 · 피부마다 한 번
  const hairCv = {};
  function hairParts(im, skin, k) {
    const ck = k + '|' + skin; if (hairCv[ck]) return hairCv[ck];
    const w = im.naturalWidth, h = im.naturalHeight, mk2 = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const er = mk2(), pt = mk2(), px = pt.getContext('2d'); px.drawImage(im, 0, 0);
    try {
      const d = px.getImageData(0, 0, w, h), p = d.data, ex = er.getContext('2d'), e = ex.createImageData(w, h), q = e.data, S = skinCol(skin);
      for (let i = 0; i < p.length; i += 4) {
        if (!p[i + 3]) continue;
        if (p[i] === 0 && p[i + 1] === 255 && p[i + 2] === 0) { q[i + 3] = 255; p[i + 3] = 0; continue; }
        if (p[i] === 255 && p[i + 1] === 0) { q[i + 3] = 255; const b = p[i + 2] / 255; p[i] = Math.min(255, S[0] * b); p[i + 1] = Math.min(255, S[1] * b); p[i + 2] = Math.min(255, S[2] * b); }
      }
      px.putImageData(d, 0, 0); ex.putImageData(e, 0, 0);
    } catch (er2) { /* noop */ }
    return (hairCv[ck] = { er, pt });
  }
  // v138 엘프 귀처럼 피부색으로 칠할 칸 (색 255,0,밝기) → 그 사람 피부색
  const keyCv = {};
  function skinKeyed(im, skin, k) {
    const ck = k + '|' + skin; if (keyCv[ck]) return keyCv[ck];
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    try { const d = x.getImageData(0, 0, c.width, c.height), p = d.data, S = skinCol(skin);
      for (let i = 0; i < p.length; i += 4) if (p[i + 3] && p[i] === 255 && p[i + 1] === 0) { const b = p[i + 2] / 255; p[i] = Math.min(255, S[0] * b); p[i + 1] = Math.min(255, S[1] * b); p[i + 2] = Math.min(255, S[2] * b); }
      x.putImageData(d, 0, 0); } catch (e) { /* noop */ }
    return (keyCv[ck] = c);
  }
  let emptyCv = null;
  // ctx 에 (x, y) 위치부터 scale 배로 그림. crop: 'full' | 'bust'
  const CROP = { full: [0, 0, GW, GH], bust: [1, 0, 16, 16], feet: [3.5, 23.9, 11, 5.3] };   // v137 feet = 상점 신발 카드 (발만 크게)
  // opt.scene = true 이면 배경까지 그림 (옷장·상점·홈·내 전적의 내 아바타)
  /* v105 부드러운 걷기 (RPG 순찰병과 같은 방식): 서 있는 그림 한 장을 다리·팔·몸 조각으로 나눠
   *  p(위상, 라디안)에 따라 다리는 엉덩이 기준으로 기울이며 번갈아 들고, 팔은 다리와 반대로 오르내리고, 몸은 살짝 들썩임.
   *  img = 서 있는 그림(frame 0). 세로는 GH 칸, 가로는 GW 칸 + 양옆 여백(무기 그림 등)이 있어도 됨. (dx,dy,dw,dh) = 그릴 자리
   *  opt.arms: true(기본) 두 팔 · 'left' 왼팔만(오른손에 무기) · false 팔 안 흔듦 · opt.amp 크기(기본 1) */
  /* v153 걷기 움직임 새로 (선생님 11/16 "아바타 움직임이 자연스럽게")
   *  예전: 조각을 위아래로 옮기고 비스듬히 밀기만 함 → 새로: 관절(엉덩이·무릎·어깨·목)을 축으로 '돌려서' 그림
   *  앞·뒤 모습(rig): 든 다리는 짧아지며(앞으로 내딛는 느낌) 바깥으로 살짝 · 팔은 어깨를 축으로 앞뒤로 흔듦 · 몸은 좌우로 살짝 실리고 · 머리는 반 박자 늦게 끄덕
   *  옆모습(rigSide): 허벅지·종아리를 따로 돌려 무릎이 굽음 · 팔은 다리와 반대로 크게 흔듦 · 몸은 앞으로 조금 기울고 두 번 들썩
   *  서 있을 때: 숨쉬기 (윗몸이 아주 조금 오르내림 · 팔이 살짝 흔들림) — opt.idle === false 면 끔
   *  그림 하나(아바타+옷+장비가 다 그려진 것)를 조각내어 쓰므로 옷·피부·장비가 무엇이든 그대로 맞음 */
  const legBox = new WeakMap();
  function legCenter(im, cs, y0, y1) {   // 옆모습 다리 가운데 x (그림 점) — 그림마다 한 번만 셈
    let v = legBox.get(im); if (v != null) return v;
    try {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const ya = Math.round(y0 * cs), yb = Math.max(ya + 1, Math.round(y1 * cs)), d = x.getImageData(0, ya, im.width, yb - ya).data; let a = im.width, b = -1;
      for (let y = 0; y < yb - ya; y++) for (let i = 0; i < im.width; i++) if (d[(y * im.width + i) * 4 + 3] > 40) { if (i < a) a = i; if (i > b) b = i; }
      v = b < 0 ? im.width / 2 : (a + b + 1) / 2;
    } catch (e) { v = im.width / 2; }
    legBox.set(im, v); return v;
  }
  function rig(ctx, img, dx, dy, dw, dh, p, mv, opt) {
    opt = opt || {};
    const cs = img.height / GH, gx = opt.padL != null ? opt.padL : (img.width / cs - GW) / 2, gxR = img.width / cs - GW - gx, kx = dw / img.width, ky = dh / img.height, A = opt.amp == null ? 1 : opt.amp;
    const idle = !mv && opt.idle !== false, t = performance.now() / 1000;
    if (!mv && !idle) { ctx.drawImage(img, dx, dy, dw, dh); return; }
    const s = mv ? Math.sin(p) : 0, c2 = mv ? Math.cos(p) : 0, arms = opt.arms == null ? true : opt.arms, HIP = 20, SHO = 13.3, NECK = 12.6;
    const br = idle ? Math.sin(t * 2.4) : 0;   // 숨쉬기
    const bob = mv ? -(0.25 + 0.45 * Math.abs(s)) * A + 0.25 * A : -0.22 * (br * 0.5 + 0.5);   // 칸
    const sway = mv ? 0.35 * s * A : 0;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = img.width > dw + 1;   // v154 큰 그림을 줄여 그릴 때는 부드럽게
    // 조각 (칸 좌표 x0~x1, y0~y1 · 가로는 몸 기준 0~GW) 을 축(px, py 칸)을 기준으로 ang 만큼 돌리고 sx·sy 배로 늘이고 (ox, oy 칸) 옮겨 그림
    const P = (x0, y0, x1, y1, o) => {
      o = o || {}; const sx0 = (x0 + gx) * cs, sy0 = y0 * cs, sw = (x1 - x0) * cs, shh = (y1 - y0) * cs; if (sw <= 0 || shh <= 0) return;
      const pX = ((o.px != null ? o.px : (x0 + x1) / 2) + gx) * cs * kx, pY = (o.py != null ? o.py : y0) * cs * ky;
      ctx.save(); ctx.translate(dx + pX + (o.ox || 0) * cs * kx, dy + pY + (o.oy || 0) * cs * ky); if (o.ang) ctx.rotate(o.ang); if (o.sx || o.sy) ctx.scale(o.sx || 1, o.sy || 1);
      ctx.drawImage(img, sx0, sy0, sw, shh, sx0 * kx - pX, sy0 * ky - pY, sw * kx, shh * ky); ctx.restore();
    };
    // 다리: 든 다리는 엉덩이를 축으로 짧아지고(앞으로 내딛음) 발이 들림 · 디딘 다리는 그대로 · 엉덩이 줄은 먼저 깔아 빈틈 막기
    const lL = mv ? Math.max(0, s) * A : 0, lR = mv ? Math.max(0, -s) * A : 0;
    P(5.3, HIP - 1, 12.7, HIP + 1, { ox: sway * 0.6, oy: bob });
    P(5.1, HIP, 9, GH, { px: 7.5, py: HIP, ox: sway * 0.6 - lL * 0.2, oy: bob, sy: 1 - 0.14 * lL, ang: -0.05 * lL });
    P(9, HIP, 12.9, GH, { px: 10.5, py: HIP, ox: sway * 0.6 + lR * 0.2, oy: bob, sy: 1 - 0.14 * lR, ang: 0.05 * lR });
    // 양옆 여백(무기 그림 등) — 몸통과 같이
    if (gx > 0) P(-gx, 0, 0, GH, { ox: sway, oy: bob });
    if (gxR > 0) P(GW, 0, GW + gxR, GH, { ox: sway, oy: bob });
    // 몸통 (살짝 비틀기) → 머리 (반 박자 늦게 끄덕 · 숨쉴 때 조금 더 오르내림)
    P(5, NECK, 13, HIP, { px: 9, py: HIP, ox: sway, oy: bob, ang: mv ? 0.025 * c2 * A : 0, sy: idle ? 1 + 0.012 * br : 1 });
    P(-gx * 0 + 0, 0, GW, NECK + 0.6, { px: 9, py: NECK, ox: sway * 1.1, oy: bob + (idle ? -0.18 * (br * 0.5 + 0.5) : 0.15 * Math.abs(Math.sin(p - 0.6)) * A), ang: mv ? 0.03 * Math.sin(p - 0.5) * A : 0.012 * Math.sin(t * 1.3) });
    // 팔: 어깨를 축으로 다리와 반대로 흔듦 (앞으로 나오는 팔은 조금 짧아 보이게)
    // 앞에서 보면 팔을 앞뒤로 흔드는 것은 '팔이 짧아졌다 길어졌다' + 살짝 안팎으로 기울기
    const swing = mv ? s * A : 0.3 * br, aL = arms ? swing : 0, aR = arms === true ? -swing : 0;
    P(0, NECK + 0.4, 5.4, HIP + 2.2, { px: 4.6, py: SHO, ox: sway, oy: bob, ang: 0.07 * aL, sy: 1 - 0.13 * Math.max(0, aL) + 0.04 * Math.max(0, -aL) });
    P(12.6, NECK + 0.4, GW, HIP + 2.2, { px: 13.4, py: SHO, ox: sway, oy: bob, ang: -0.07 * aR, sy: 1 - 0.13 * Math.max(0, aR) + 0.04 * Math.max(0, -aR) });
    ctx.imageSmoothingEnabled = sm;
  }
  function rigSide(ctx, body, arm, dx, dy, dw, dh, p, mv, opt) {
    opt = opt || {};
    const cs = body.height / GH, kx = dw / body.width, ky = dh / body.height, A = opt.amp == null ? 1 : opt.amp, t = performance.now() / 1000;
    const s = mv ? Math.sin(p) : 0, HIP = 20, KNEE = 24.2, SHO = 13.2;
    const idle = !mv && opt.idle !== false, br = idle ? Math.sin(t * 2.4) : 0;
    const bob = mv ? (0.45 * Math.abs(s) - 0.3) * A : -0.2 * (br * 0.5 + 0.5);   // 다리가 벌어질 때 낮아짐
    /* v153 '오른쪽으로 갈 때 다리가 4개' 고침: 옆모습 그림에는 다리가 이미 둘 → 다리 줄을 통째로 두 번 그리면 넷이 됨.
     *  종아리·신발 줄에서 두 다리 사이 틈을 찾아 [앞쪽 다리 | 뒤쪽 다리] 로 나눠 하나씩 움직임. 치마(허벅지 줄이 넓음)는 허벅지는 그대로 두고 종아리만 */
    const LB = legSplit(body, cs, HIP, KNEE, GH), lean = mv ? 0.05 * A : 0;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = body.width > dw + 1;   // v154 큰 그림을 줄여 그릴 때는 부드럽게
    const P = (im, y0, y1, o) => {   // im 의 y0~y1 줄(가로 sx0~sx1 점)을 (축 px 점, py 칸) 기준으로 ang 돌려 (ox 점, oy 칸) 옮겨 그림
      o = o || {}; const sy0 = y0 * cs, shh = (y1 - y0) * cs; if (shh <= 0) return;
      const sx0 = Math.max(0, o.sx0 != null ? o.sx0 : 0), sw = Math.min(im.width, o.sx1 != null ? o.sx1 : im.width) - sx0; if (sw <= 0) return;
      const pX = (o.px != null ? o.px : LB.mid) * kx, pY = (o.py != null ? o.py : y0) * cs * ky;
      ctx.save(); ctx.translate(dx + pX + (o.ox || 0) * kx, dy + pY + (o.oy || 0) * cs * ky); if (o.ang) ctx.rotate(o.ang);
      ctx.drawImage(im, sx0, sy0, sw, shh, sx0 * kx - pX, sy0 * ky - pY, sw * kx, shh * ky); ctx.restore();
    };
    const top = LB.skirt ? KNEE : HIP;   // 몸통에 붙여 그대로 그리는 아래 끝
    const leg = (ph, x0, x1) => {   // 다리 하나 = 허벅지(엉덩이 축) + 종아리(무릎 축) · th < 0 = 앞으로 · kn = 무릎 굽힘
      const cx = (x0 + x1) / 2, th = mv ? (LB.skirt ? -0.3 : -0.34) * Math.sin(ph) * A : 0, kn = mv ? 0.5 * Math.max(0, Math.cos(ph)) * A : 0;
      if (LB.skirt) { P(body, KNEE - 0.2, GH, { sx0: x0, sx1: x1, px: cx, py: KNEE, oy: bob - (mv ? 0.35 * Math.max(0, Math.cos(ph)) * A : 0), ang: th + kn * 0.5 }); return; }
      const L = (KNEE - HIP) * cs * ky, kxp = -Math.sin(th) * L, kyp = Math.cos(th) * L - L;
      P(body, KNEE - 0.3, GH, { sx0: x0, sx1: x1, px: cx, py: KNEE, ox: kxp / kx, oy: bob + kyp / (cs * ky) - (mv ? 0.3 * Math.max(0, Math.cos(ph)) * A : 0), ang: th + kn * 0.85 });
      P(body, HIP, KNEE + 0.4, { sx0: x0, sx1: x1, px: cx, py: HIP, oy: bob, ang: th });
    };
    // 다리 자리 바깥(칼끝·손 등)은 몸통과 함께 그대로
    if (LB.ok) { P(body, top, GH, { sx0: 0, sx1: LB.a, py: HIP, oy: bob }); P(body, top, GH, { sx0: LB.b, sx1: body.width, py: HIP, oy: bob }); }
    if (LB.ok) leg(p + Math.PI, LB.mid, LB.b);                       // 뒤쪽 다리 (그림 오른쪽)
    P(body, 0, top + 0.6, { py: HIP, oy: bob, ang: lean });          // 머리·몸통 (앞으로 살짝 기울임)
    if (LB.ok) leg(p, LB.a, LB.mid);                                 // 앞쪽 다리
    else P(body, top, GH, { py: HIP, oy: bob });                      // 다리를 못 나누면 그대로 (넷으로 보이지 않게)
    const aa = mv ? 0.5 * Math.sin(p) * A : 0.04 * br;               // 가까운 팔: 앞쪽 다리와 반대로
    P(arm, SHO - 1, GH, { py: SHO, oy: bob, ang: aa + lean, px: LB.mid + (opt.armDx || 0) });
    ctx.imageSmoothingEnabled = sm;
  }
  // 옆모습 다리 나누기: 종아리·신발 줄(KNEE~발)에서 다리 자리 [a, b] 와 두 다리 사이 가장 얇은 곳(mid) · 허벅지 줄이 훨씬 넓으면 치마 · 그림마다 한 번
  const legSp = new WeakMap();
  function legSplit(im, cs, hip, knee, gh) {
    let v = legSp.get(im); if (v) return v;
    v = { mid: im.width / 2, a: 0, b: im.width, ok: false, skirt: false };
    try {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const W2 = im.width, cnt = (y0, y1) => { const ya = Math.round(y0 * cs), yb = Math.max(ya + 1, Math.round(y1 * cs)), d = x.getImageData(0, ya, W2, yb - ya).data, col = new Array(W2).fill(0);
        for (let y = 0; y < yb - ya; y++) for (let i = 0; i < W2; i++) if (d[(y * W2 + i) * 4 + 3] > 60) col[i]++; return { col, h: yb - ya }; };
      const span = (r, f) => { let a = W2, b = -1; r.col.forEach((n, i) => { if (n > r.h * f) { if (i < a) a = i; if (i > b) b = i; } }); return [a, b]; };
      const lo = cnt(knee + 0.3, gh - 1.2), [a, b] = span(lo, 0.2);
      if (b - a >= 3 * cs) {
        let best = -1, bv = 1e9; for (let i = Math.round(a + (b - a) * 0.35); i <= Math.round(a + (b - a) * 0.65); i++) if (lo.col[i] < bv) { bv = lo.col[i]; best = i; }
        const th = cnt(hip + 0.5, knee - 0.5), [ta, tb] = span(th, 0.3);
        v = { mid: best + 0.5, a: Math.max(0, Math.min(a, ta) - 1), b: Math.min(W2, Math.max(b, tb) + 2), ok: true, skirt: tb - ta > (b - a) * 1.35 };
      }
    } catch (e) { /* noop */ }
    legSp.set(im, v); return v;
  }
  function draw(ctx, av, x, y, scale, opt) {
    opt = opt || {};
    const [cx, cy, cw, ch] = CROP[opt.crop || 'full'];
    const bgIt = opt.scene && byId[normalize(av).bg], bgIm = bgIt && bgIt.img ? loadImg(bgIt.img, opt.onBody) : null;
    if (bgIm) {   // v120 선생님 그림 배경: 18×29칸에 가운데 맞춰 꽉 채운 뒤 crop 부분만
      const fw = GW * scale, fh = GH * scale, r = Math.max(fw / bgIm.naturalWidth, fh / bgIm.naturalHeight), sw = fw / r, sh = fh / r, sx0 = (bgIm.naturalWidth - sw) / 2, sy0 = (bgIm.naturalHeight - sh) / 2;
      const k1 = sw / fw;
      const sm0 = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bgIm, sx0 + cx * scale * k1, sy0 + cy * scale * k1, cw * scale * k1, ch * scale * k1, x, y, cw * scale, ch * scale);
      ctx.imageSmoothingEnabled = sm0;
    }
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    const view = opt.view === 'b' || opt.view === 's' ? opt.view : 'f';   // v106 방향: 'f' 앞 · 'b' 뒤 · 's' 옆(오른쪽)
    // v120 늘 새 몸 그림 (예전 도트 그리기는 뺐음) · 몸 그림을 받는 중이면 아무것도 안 그림 → 받으면 onBody 로 다시
    const crop = opt.crop || 'full', H0 = opt.hold;
    let bc = bodyCanvas(av, view, opt.onBody);
    // v172 옷·모자·장비가 바뀌어 새 그림을 받는 동안 캐릭터가 잠깐 투명해지던 것: 같은 사람(hold)의 바로 전 그림을 대신 그림
    if (bc && H0) H0['_avbc' + view] = bc; else if (!bc && H0) bc = H0['_avbc' + view] || H0._avbcf || null;
    if (!bc) { ctx.imageSmoothingEnabled = sm; return; }
    if (crop !== 'full') {   // 얼굴·상반신 칸: 몸 그림에서 그 부분만 (1칸 = 4점)
      ctx.imageSmoothingEnabled = crop !== 'feet'; ctx.drawImage(bc, cx * 4, cy * 4, cw * 4, ch * 4, x, y, cw * scale, ch * scale);   // v137 신발 카드는 또렷한 도트로
      ctx.imageSmoothingEnabled = sm; return;
    }
    // v136 등 장식: 몸 뒤(아래 칸) → 몸 → 몸 앞(위 칸) · 그림은 양옆으로 7칸씩 넓음
    const bkIt = byId[normalize(av).back], bkIm = bkIt && bkIt.img ? loadImg(bkIt.img, opt.onBody) : null, bkV = view === 'b' ? 1 : view === 's' ? 2 : 0;
    const bk = layer => { if (!bkIm) return; const sm1 = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = scale < 4; ctx.drawImage(bkIm, (bkV * 2 + layer) * 128, 0, 128, 116, x - BK_PAD * scale, y, (GW + BK_PAD * 2) * scale, GH * scale); ctx.imageSmoothingEnabled = sm1; };
    bk(0);
    if (opt.walk != null) { if (view === 's') { if (!emptyCv) { emptyCv = document.createElement('canvas'); emptyCv.width = bc.width; emptyCv.height = bc.height; } rigSide(ctx, bc, emptyCv, x, y, GW * scale, GH * scale, opt.walk, true, opt); } else rig(ctx, bc, x, y, GW * scale, GH * scale, opt.walk, true, opt); }
    else if (opt.breathe) { if (view === 's') rigSide(ctx, bc, emptyCv || (emptyCv = Object.assign(document.createElement('canvas'), { width: bc.width, height: bc.height })), x, y, GW * scale, GH * scale, 0, false, opt); else rig(ctx, bc, x, y, GW * scale, GH * scale, 0, false, opt); }   // v154 서 있을 때 숨쉬기
    else { ctx.imageSmoothingEnabled = true; ctx.drawImage(bc, x, y, GW * scale, GH * scale); }
    bk(1);
    ctx.imageSmoothingEnabled = sm;
  }
  const BK_PAD = 7;   // v136 등 장식 그림의 양옆 여백 (칸)
  // v136 날개처럼 넓은 등 장식을 입었으면 캔버스를 양옆으로 넓힘 (자리는 그대로 · 바깥으로 삐져나오게)
  const wideOf = (av, opt) => { if ((opt.crop || 'full') !== 'full' || opt.keepCss || opt.narrow) return 0; const it = byId[normalize(av).back]; return it && it.img ? BK_PAD : 0; };
  // 캔버스 크기를 맞춰서 그림
  function paint(canvas, av, opt) {
    opt = opt || {};
    const [, , cw0, ch] = CROP[opt.crop || 'full'], s = opt.scale || 4;
    const M = wideOf(av, opt), cw = cw0 + M * 2;
    const dpr = 2;   // v39: 2배 그림이 고르게 보이게 항상 2배 해상도
    canvas.width = cw * s * dpr; canvas.height = ch * s * dpr;
    if (!opt.keepCss) { canvas.style.width = cw * s + 'px'; canvas.style.height = ch * s + 'px'; canvas.style.marginLeft = canvas.style.marginRight = M ? -M * s + 'px' : ''; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cw * s, ch * s);
    if (opt.bg) { ctx.fillStyle = opt.bg; ctx.fillRect(0, 0, cw * s, ch * s); }
    if (!opt.onBody && opt.body !== false) opt = Object.assign({}, opt, { onBody: () => { if (canvas.isConnected !== false) paint(canvas, av, Object.assign({}, opt, { onBody: () => {} })); } });   // v114 몸 그림을 받으면 다시
    draw(ctx, av, M * s, 0, s, opt);
  }
  // data-avatar='{"skin":...}' 속성이 있는 캔버스를 한 번에 그림
  function paintAll(root) {
    (root || document).querySelectorAll('canvas[data-avatar]').forEach(c => {
      let av = {}; try { av = JSON.parse(c.dataset.avatar || '{}'); } catch (e) { /* noop */ }
      const o = { scale: +c.dataset.scale || 3, crop: c.dataset.crop || 'full', bg: c.dataset.bg || null, keepCss: c.hasAttribute('data-keepcss'), scene: c.hasAttribute('data-scene'), body: !c.hasAttribute('data-nobody') };
      if (o.body) o.onBody = () => paint(c, av, o);   // v114 몸 그림을 받으면 다시 그림
      paint(c, av, o);
    });
  }
  // 이름 등으로 항상 같은 모습이 나오는 무작위 아바타 (컴퓨터 상대·예시 플레이어)
  function random(seed) {
    let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
    const av = {};
    SLOTS.forEach(([slot]) => {
      const opts = SHOP_I.filter(it => it.slot === slot && (slot !== 'skin' || it.price === 0 || rnd() < 0.3));
      av[slot] = slot === 'bg' || !opts.length || (OPTIONAL[slot] && rnd() < 0.5) ? null : opts[Math.floor(rnd() * opts.length)].id;   // v119 상품이 빈 칸은 없음
    });
    av.g = rnd() < 0.5 ? 'm' : 'f';   // v120 컴퓨터 상대도 새 몸 그림
    return av;
  }

  try { if (typeof document !== 'undefined') setTimeout(() => clothAtlas(null), 300); } catch (e) { /* noop */ }   // v120 옷 색 그림 미리 받기 (게임 속 몸 그림용)
  /* v172 로그인한 내 아바타 그림(앞·옆·뒤 몸 · 옷 색 · 신발 · 머리·모자·얼굴 장식 · 등 장식)을 사이트를 열자마자 미리 받아 둠
   *  → 내 방·skillcom RPG 에 처음 들어갈 때 캐릭터가 늦게 나타나거나 잠깐 사라지는 것 줄이기 */
  function preload(av) {
    if (!av) return; const noop = () => {};
    try { ['f', 's', 'b'].forEach(v => bodyCanvas(av, v, noop)); const bk = byId[normalize(av).back]; if (bk && bk.img) loadImg(bk.img, noop); } catch (e) { /* noop */ }
  }
  setTimeout(() => { clothAtlas(); shoeAtlas(); }, 0);   // v172 옷 색·신발 그림을 미리 받아 둠
  { let tries = 0, lastK = ''; const iv = setInterval(() => { const u = window.GameHub && window.GameHub.user; if (u && u.avatar) { const k = JSON.stringify(u.avatar); if (k !== lastK) { lastK = k; preload(u.avatar); } } if (++tries > 60) clearInterval(iv); }, 500); }
  window.GoAvatar = {
    preload,
    SLOTS, DEFAULT, OPTIONAL, ITEMS: SHOP_I, ALL_ITEMS: I, byId, bodyImg, useBody, bodyNorm, bodySrc, bodyCanvas, bodyComp, fitBody, BODY_SKINS, CLOTH, SHOES,
    THEMES: [['all', '전체'], ['basic', '기본'], ['school', '학교·일상'], ['job', '직업'], ['fantasy', '판타지'], ['season', '동물·계절']], size: { w: GW, h: GH },
    normalize, draw, paint, paintAll, random, legs, OUT, rig, rigSide,
    walkP: t => t * Math.PI * 2,   // 걸음 수(바퀴) → 위상
    freeIds: () => I.filter(it => it.price === 0).map(it => it.id),
    bgImg: av => { const it = byId[normalize(av).bg]; return it && it.img ? (window.GOGO_BASE || '') + it.img : null; },   // v121 배경 그림 주소 (미리보기 칸 전체 배경용)
    attr: av => JSON.stringify(normalize(av)).replace(/"/g, '&quot;')   // HTML 속성용
  };
})();
