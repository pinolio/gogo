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
    ["top", "t_basic", "기본 티셔츠", 0],
    ["top", "t_stripe", "줄무늬 티", 4],
    ["top", "t_hoodie", "후드티", 8],
    ["bottom", "b_jeans", "청바지", 0],
    ["bottom", "b_cargo", "카고 바지", 6],
    ["shoes", "sh_basic", "기본 운동화", 0],
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
    t_stripe: { c: [235, 240, 250], p: 'stripe', c2: [40, 90, 200] }, t_hoodie: { c: [150, 95, 220] }, t_padding: { c: [30, 40, 80] }, t_bear: { c: [140, 90, 50] }, t_ninja: { c: [30, 30, 40] },
    b_cargo: { c: [150, 135, 80] }, b_slacks: { c: [62, 66, 86] }, b_ninja: { c: [34, 34, 42] }, b_chima: { c: [214, 64, 60] }, b_uniskirt: { c: [42, 52, 98], p: 'check', c2: [70, 140, 100] }
  };
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
  const clothOf = n => ({ t: n.top !== 't_basic' && CLOTH[n.top] ? n.top : null, b: n.bottom !== 'b_jeans' && CLOTH[n.bottom] ? n.bottom : null });
  const recCv = {};
  // 몸 그림(base)에 옷 색을 칠한 캔버스 · 칠할 게 없으면 base 그대로 · 아직 준비 안 됐으면 null
  function recolorBody(base, n, view, cb) {
    const co = clothOf(n); if (!co.t && !co.b) return base;
    const at = clothAtlas(cb); if (!at) return null; if (at.bad) return base;
    const g = n.g === 'f' ? 'f' : 'm', v = vOf(view), si = BODY_SKINS.indexOf(n.skin), ri = CLOTH_GV.indexOf(g + '_' + v);
    const ck = n.skin + g + v + '|' + co.t + '|' + co.b; if (recCv[ck]) return recCv[ck];
    const W = base.naturalWidth || base.width, H = base.naturalHeight || base.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(base, 0, 0);
    if (si >= 0 && ri >= 0) {
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
    n.shoes = 'sh_basic'; n.hat = null; n.face = null; n.back = null;
    if (!free(n.hair)) n.hair = 'h_short';
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
    const co = clothOf(n), key = bodySrc(n.g, view, n.skin) + '|' + co.t + '|' + co.b; if (bodyCv[key]) return bodyCv[key];
    const c = document.createElement('canvas'); c.width = GW * 4; c.height = GH * 4;
    fitBody(c.getContext('2d'), im, 9 * 4, 4);
    return (bodyCv[key] = c);
  }
  let emptyCv = null;
  // ctx 에 (x, y) 위치부터 scale 배로 그림. crop: 'full' | 'bust'
  const CROP = { full: [0, 0, GW, GH], bust: [1, 0, 16, 16] };
  // opt.scene = true 이면 배경까지 그림 (옷장·상점·홈·내 전적의 내 아바타)
  /* v105 부드러운 걷기 (RPG 순찰병과 같은 방식): 서 있는 그림 한 장을 다리·팔·몸 조각으로 나눠
   *  p(위상, 라디안)에 따라 다리는 엉덩이 기준으로 기울이며 번갈아 들고, 팔은 다리와 반대로 오르내리고, 몸은 살짝 들썩임.
   *  img = 서 있는 그림(frame 0). 세로는 GH 칸, 가로는 GW 칸 + 양옆 여백(무기 그림 등)이 있어도 됨. (dx,dy,dw,dh) = 그릴 자리
   *  opt.arms: true(기본) 두 팔 · 'left' 왼팔만(오른손에 무기) · false 팔 안 흔듦 · opt.amp 크기(기본 1) */
  function rig(ctx, img, dx, dy, dw, dh, p, mv, opt) {
    opt = opt || {};
    if (!mv) { ctx.drawImage(img, dx, dy, dw, dh); return; }
    const cs = img.height / GH, gx = opt.padL != null ? opt.padL : (img.width / cs - GW) / 2, gxR = img.width / cs - GW - gx, kx = dw / img.width, ky = dh / img.height, A = opt.amp == null ? 1 : opt.amp;
    const s = Math.sin(p), c2 = Math.cos(p), arms = opt.arms == null ? true : opt.arms;
    const bob = -Math.abs(s) * 0.5 * A, HIP = 20;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    // 칸 좌표(몸 기준, 가로 0~GW) 사각형을 (ox, oy 칸) 옮기고, ay 칸 줄을 축으로 sh 만큼 기울여 그림
    const pc = (x0, y0, x1, y1, ox, oy, sh, ay) => {
      const sx = (x0 + gx) * cs, sy = y0 * cs, sw = (x1 - x0) * cs, shh = (y1 - y0) * cs;
      if (sw <= 0 || shh <= 0) return;
      ctx.save(); ctx.translate(dx, dy);
      if (sh) { const ty = ay * cs * ky; ctx.translate(0, ty); ctx.transform(1, 0, sh, 1, 0, 0); ctx.translate(0, -ty); }
      ctx.drawImage(img, sx, sy, sw, shh, sx * kx + ox * cs * kx, sy * ky + oy * cs * ky, sw * kx, shh * ky); ctx.restore();
    };
    const lL = Math.max(0, s) * 1.5 * A, lR = Math.max(0, -s) * 1.5 * A, sh = -s * 0.11 * A, sw = c2 * 0.18 * A;
    // 다리 (몸통보다 먼저 → 든 다리 위쪽은 몸통에 가려짐)
    pc(6, HIP, 9, HIP + 1, 0, bob - lL, sh, HIP); pc(0, HIP + 1, 9, GH, 0, bob - lL, sh, HIP);   // 몸 전체가 들썩(bob) + 든 다리
    pc(9, HIP, 12, HIP + 1, 0, bob - lR, sh, HIP); pc(9, HIP + 1, GW, GH, 0, bob - lR, sh, HIP);
    // 머리 · 몸통 · 양옆 여백(무기)
    pc(-gx, 0, GW + gxR, 13, sw, bob); pc(6, 13, 12, HIP, sw * 0.6, bob);
    if (gx > 0) pc(-gx, 13, 0, GH, sw, bob);
    if (gxR > 0) pc(GW, 13, GW + gxR, GH, sw, bob);
    // 팔: 왼다리가 나가면 오른팔이 올라감
    const aL = arms ? s * 1.1 * A : 0, aR = arms === true ? -s * 1.1 * A : 0;
    // 팔이 내려가면 어깨 줄(13번째 줄)을 늘려 빈틈을 메움
    const arm = (x0, x1, a) => {
      if (a > 0) { const sx = (x0 + gx) * cs; ctx.drawImage(img, sx, 13 * cs, (x1 - x0) * cs, cs, dx + sx * kx + sw * 0.6 * cs * kx, dy + (13 + bob) * cs * ky, (x1 - x0) * cs * kx, (a + 1) * cs * ky); }
      pc(x0, 13, x1, HIP + 1, sw * 0.6, bob + a);
    };
    arm(0, 6, aL); arm(12, GW, aR);
    ctx.imageSmoothingEnabled = sm;
  }
  // v106 옆모습 걷기: 다리 하나 그림을 두 번(뒷다리·앞다리) 엉덩이 기준으로 반대로 흔들고, 가까운 팔은 따로 그려 어깨 기준으로 흔듦
  function rigSide(ctx, body, arm, dx, dy, dw, dh, p, mv, opt) {
    opt = opt || {};
    const cs = body.height / GH, kx = dw / body.width, ky = dh / body.height, A = opt.amp == null ? 1 : opt.amp;
    const s = mv ? Math.sin(p) : 0, bob = mv ? -Math.abs(s) * 0.5 * A : 0, HIP = 20, SHO = 13;
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    const pc = (im, y0, y1, oy, sh, ay) => {
      const sy = y0 * cs, shh = (y1 - y0) * cs;
      ctx.save(); ctx.translate(dx, dy);
      if (sh) { const ty = ay * cs * ky; ctx.translate(0, ty); ctx.transform(1, 0, sh, 1, 0, 0); ctx.translate(0, -ty); }
      ctx.drawImage(im, 0, sy, im.width, shh, 0, sy * ky + oy * cs * ky, im.width * kx, shh * ky); ctx.restore();
    };
    const lg = s * 0.32 * A;
    ctx.save(); try { ctx.filter = 'brightness(0.78)'; } catch (e) { /* noop */ }
    pc(body, HIP, GH, bob, lg, HIP); ctx.restore();                 // 뒷다리 (조금 어둡게)
    pc(body, 0, HIP, bob, 0, 0);                                     // 머리·몸통
    pc(body, HIP, GH, bob, -lg, HIP);                                // 앞다리
    pc(arm, SHO - 1, GH, bob, mv ? s * 0.3 * A : 0, SHO);            // 가까운 팔
    ctx.imageSmoothingEnabled = sm;
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
    const crop = opt.crop || 'full', bc = bodyCanvas(av, view, opt.onBody);
    if (!bc) { ctx.imageSmoothingEnabled = sm; return; }
    if (crop !== 'full') {   // 얼굴·상반신 칸: 몸 그림에서 그 부분만 (1칸 = 4점)
      ctx.imageSmoothingEnabled = true; ctx.drawImage(bc, cx * 4, cy * 4, cw * 4, ch * 4, x, y, cw * scale, ch * scale);
      ctx.imageSmoothingEnabled = sm; return;
    }
    // v136 등 장식: 몸 뒤(아래 칸) → 몸 → 몸 앞(위 칸) · 그림은 양옆으로 7칸씩 넓음
    const bkIt = byId[normalize(av).back], bkIm = bkIt && bkIt.img ? loadImg(bkIt.img, opt.onBody) : null, bkV = view === 'b' ? 1 : view === 's' ? 2 : 0;
    const bk = layer => { if (!bkIm) return; const sm1 = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = scale < 4; ctx.drawImage(bkIm, (bkV * 2 + layer) * 128, 0, 128, 116, x - BK_PAD * scale, y, (GW + BK_PAD * 2) * scale, GH * scale); ctx.imageSmoothingEnabled = sm1; };
    bk(0);
    if (opt.walk != null) { if (view === 's') { if (!emptyCv) { emptyCv = document.createElement('canvas'); emptyCv.width = bc.width; emptyCv.height = bc.height; } rigSide(ctx, bc, emptyCv, x, y, GW * scale, GH * scale, opt.walk, true, opt); } else rig(ctx, bc, x, y, GW * scale, GH * scale, opt.walk, true, opt); }
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
  window.GoAvatar = {
    SLOTS, DEFAULT, OPTIONAL, ITEMS: SHOP_I, ALL_ITEMS: I, byId, bodyImg, useBody, bodyNorm, bodySrc, bodyCanvas, bodyComp, fitBody, BODY_SKINS, CLOTH,
    THEMES: [['all', '전체'], ['basic', '기본'], ['school', '학교·일상'], ['job', '직업'], ['fantasy', '판타지'], ['season', '동물·계절']], size: { w: GW, h: GH },
    normalize, draw, paint, paintAll, random, legs, OUT, rig, rigSide,
    walkP: t => t * Math.PI * 2,   // 걸음 수(바퀴) → 위상
    freeIds: () => I.filter(it => it.price === 0).map(it => it.id),
    bgImg: av => { const it = byId[normalize(av).bg]; return it && it.img ? (window.GOGO_BASE || '') + it.img : null; },   // v121 배경 그림 주소 (미리보기 칸 전체 배경용)
    attr: av => JSON.stringify(normalize(av)).replace(/"/g, '&quot;')   // HTML 속성용
  };
})();
