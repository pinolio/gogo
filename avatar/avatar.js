/*
 * gogo?gogo! — 전신 도트 아바타
 *  - 16 × 27 칸 도트 그림 (테두리 포함 18 × 29)
 *  - 부위(slot): 피부·헤어·모자·얼굴·상의·하의·신발·등
 *  - frame: 0 = 서 있기, 1·3 = 걷기 (다리 교대) → 나중에 '아바타로 돌아다니는 게임'에서 사용
 *  - 아이템 가격은 ITEMS 의 price (체험 모드용).
 *    온라인 모드에서는 Supabase 'shop_items' 표의 가격이 우선합니다. (대시보드에서 바로 수정 가능)
 *
 *  ※ 밸런스 조정 예정: 가격은 승리 1판 = 2P 기준으로 정했습니다.
 */
(function () {
  'use strict';
  const W = 16, H = 27, PAD = 1, GW = W + PAD * 2, GH = H + PAD * 2;
  const OUT = '#1D2340';
  const SLOTS = [
    ['skin', '피부'], ['hair', '헤어'], ['hat', '모자'], ['face', '얼굴'],
    ['top', '상의'], ['bottom', '하의'], ['shoes', '신발'], ['back', '등']
  ];
  const OPTIONAL = { hat: 1, face: 1, back: 1 };          // 비워 둘 수 있는 부위
  const DEFAULT = { skin: 's1', hair: 'h_short', hat: null, face: null, top: 't_basic', bottom: 'b_jeans', shoes: 'sh_basic', back: null };

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  // 다리·발 위치 (frame 에 따라 한쪽 다리를 들어 올림)
  function legs(frame) {
    const l = frame === 1 ? 1 : 0, r = frame === 3 ? 1 : 0;
    return {
      L: { x: 5, y: 19, w: 3, h: 6 - l }, R: { x: 8, y: 19, w: 3, h: 6 - r },
      LF: { x: 4, y: 25 - l }, RF: { x: 8, y: 25 - r }
    };
  }
  function Grid() {
    const cells = Array.from({ length: GH }, () => Array(GW).fill(null));
    const px = (x, y, w, h, c) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const gx = x + i + PAD, gy = y + j + PAD;
        if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) cells[gy][gx] = c;
      }
    };
    return { cells, px, dot: (x, y, c) => px(x, y, 1, 1, c) };
  }

  /* ---------------- 기본 몸 ---------------- */
  function drawBody(g, skin, frame) {
    const s = skin, L = legs(frame);
    g.px(4, 3, 8, 8, s);                                        // 머리
    [[4, 3], [11, 3], [4, 10], [11, 10]].forEach(([x, y]) => g.dot(x, y, null));
    g.px(7, 11, 2, 1, shade(s, -0.12));                         // 목
    g.px(5, 12, 6, 7, s);                                       // 몸통
    g.px(3, 12, 2, 7, s); g.px(11, 12, 2, 7, s);                // 팔
    g.px(L.L.x, L.L.y, 3, L.L.h, s); g.px(L.R.x, L.R.y, 3, L.R.h, s); // 다리
    g.px(L.LF.x + 1, L.LF.y, 3, 1, s); g.px(L.RF.x, L.RF.y, 3, 1, s); // 맨발
    g.dot(6, 7, OUT); g.dot(9, 7, OUT);                         // 눈
    g.dot(5, 8, '#FF9AA2'); g.dot(10, 8, '#FF9AA2');            // 볼
    g.px(7, 9, 2, 1, shade(s, -0.35));                          // 입
  }

  /* ---------------- 아이템 ----------------
   * draw(g, frame)      : 몸 위에 그림
   * drawBack(g, frame)  : 몸 뒤에 그림 (망토·날개)
   * drawFront(g, frame) : 상의 위에 그림 (가방끈)
   */
  const I = [];
  const add = (slot, id, name, price, o) => I.push(Object.assign({ slot, id, name, price }, o));

  // 피부 (색만 바뀜)
  [['s1', '밝은 피부', 0, '#F7D7B5'], ['s2', '살구 피부', 0, '#EBB58C'], ['s3', '구릿빛 피부', 0, '#C98A55'], ['s4', '갈색 피부', 0, '#8D5A34'],
   ['s_alien', '외계인', 20, '#8EE08A'], ['s_robot', '로봇', 24, '#BFC7E0']]
    .forEach(([id, name, price, color]) => add('skin', id, name, price, { color }));

  // 헤어
  const shortHair = (g, c) => { g.px(5, 2, 6, 1, c); g.px(4, 3, 8, 2, c); g.px(4, 5, 1, 2, c); g.px(11, 5, 1, 2, c); g.dot(5, 5, c); };
  add('hair', 'h_short', '짧은 머리 (검정)', 0, { draw: g => shortHair(g, '#2B2B3A') });
  add('hair', 'h_short_brown', '짧은 머리 (갈색)', 0, { draw: g => shortHair(g, '#6B4226') });
  add('hair', 'h_long', '긴 생머리', 6, { draw: g => { const c = '#5A3A22'; g.px(5, 2, 6, 1, c); g.px(4, 3, 8, 2, c); g.px(3, 4, 2, 9, c); g.px(11, 4, 2, 9, c); g.px(5, 5, 2, 1, c); } });
  add('hair', 'h_bob', '단발머리', 6, { draw: g => { const c = '#2B2B3A'; g.px(5, 2, 6, 1, c); g.px(4, 3, 8, 2, c); g.px(3, 4, 2, 6, c); g.px(11, 4, 2, 6, c); g.px(5, 5, 6, 1, c); } });
  add('hair', 'h_spiky', '뾰족 머리', 8, { draw: g => { const c = '#FFC53D'; g.px(4, 3, 8, 2, c); g.px(5, 2, 6, 1, c); g.dot(4, 5, c); g.dot(11, 5, c); [4, 6, 9, 11].forEach((x, i) => g.px(x, i % 2 ? 0 : 1, 1, 2, c)); g.px(7, 1, 2, 1, c); } });
  add('hair', 'h_twin', '양갈래 머리', 10, { draw: g => { const c = '#FF7EB6'; shortHair(g, c); g.px(1, 5, 2, 4, c); g.px(13, 5, 2, 4, c); g.dot(3, 5, '#FFD23F'); g.dot(12, 5, '#FFD23F'); } });
  add('hair', 'h_mohawk', '닭벼슬 머리', 12, { draw: g => { const c = '#3DDC84'; g.px(7, 0, 2, 5, c); g.px(6, 1, 4, 2, c); } });

  // 모자
  add('hat', 'hat_cap', '야구 모자', 4, { draw: g => { const c = '#FF5A5F'; g.px(5, 0, 6, 1, c); g.px(4, 1, 8, 3, c); g.px(3, 4, 10, 1, shade(c, -0.3)); g.px(7, 2, 2, 1, '#FFFFFF'); } });
  add('hat', 'hat_beanie', '비니', 5, { draw: g => { const c = '#4C7DFF'; g.px(4, 1, 8, 3, c); g.px(4, 4, 8, 1, shade(c, 0.35)); g.px(7, 0, 2, 1, '#FFFFFF'); } });
  add('hat', 'hat_bunny', '토끼 귀', 12, { draw: g => { g.px(5, 0, 2, 4, '#FFFFFF'); g.px(9, 0, 2, 4, '#FFFFFF'); g.px(6, 1, 1, 2, '#FFB3C7'); g.px(9, 1, 1, 2, '#FFB3C7'); g.px(4, 3, 8, 1, '#FF7EB6'); } });
  add('hat', 'hat_wizard', '마법사 모자', 18, { draw: g => { const c = '#7E4DE0'; g.px(7, 0, 2, 1, c); g.px(6, 1, 4, 1, c); g.px(5, 2, 6, 1, c); g.px(4, 3, 8, 1, c); g.px(2, 4, 12, 1, shade(c, -0.25)); g.dot(7, 2, '#FFD23F'); } });
  add('hat', 'hat_crown', '왕관', 30, { draw: g => { const c = '#FFD23F'; g.px(4, 2, 8, 2, c); g.px(4, 0, 1, 2, c); g.px(7, 0, 2, 2, c); g.px(11, 0, 1, 2, c); g.dot(5, 3, '#FF5A5F'); g.dot(10, 3, '#3BC8F5'); g.dot(7, 2, '#3DDC84'); g.dot(8, 2, '#3DDC84'); } });

  // 얼굴
  add('face', 'f_glasses', '동그란 안경', 4, { draw: g => { const k = '#3A3F66'; g.px(5, 6, 3, 1, k); g.px(8, 6, 3, 1, k); g.px(5, 8, 3, 1, k); g.px(8, 8, 3, 1, k); [5, 7, 8, 10].forEach(x => g.dot(x, 7, k)); } });
  add('face', 'f_sunglass', '선글라스', 8, { draw: g => { g.px(5, 6, 6, 2, '#14182E'); g.dot(6, 6, '#5B6390'); g.dot(9, 6, '#5B6390'); } });
  add('face', 'f_mask', '마스크', 5, { draw: g => { g.px(5, 8, 6, 2, '#F3F6FF'); g.dot(4, 8, '#C8CFEA'); g.dot(11, 8, '#C8CFEA'); } });
  add('face', 'f_mustache', '콧수염', 3, { draw: g => { g.px(6, 8, 4, 1, '#3A2A1A'); g.dot(5, 9, '#3A2A1A'); g.dot(10, 9, '#3A2A1A'); } });

  // 상의 (몸통 5~10 / 12~18행, 팔 3~4·11~12열)
  const torso = (g, c) => g.px(5, 12, 6, 7, c);
  const sleeves = (g, c, n) => { g.px(3, 12, 2, n, c); g.px(11, 12, 2, n, c); };
  add('top', 't_basic', '기본 티셔츠', 0, { draw: g => { torso(g, '#F3F6FF'); sleeves(g, '#F3F6FF', 2); } });
  add('top', 't_stripe', '줄무늬 티', 4, { draw: g => { for (let y = 12; y <= 18; y++) g.px(5, y, 6, 1, y % 2 ? '#2F55D9' : '#F3F6FF'); g.px(3, 12, 2, 1, '#F3F6FF'); g.px(11, 12, 2, 1, '#F3F6FF'); g.px(3, 13, 2, 1, '#2F55D9'); g.px(11, 13, 2, 1, '#2F55D9'); } });
  add('top', 't_school', '교복 재킷', 6, { draw: g => { const c = '#2A3366'; torso(g, c); sleeves(g, c, 6); g.px(7, 12, 2, 2, '#FFFFFF'); g.px(7, 13, 2, 3, '#FF5A5F'); g.dot(6, 16, '#FFD23F'); } });
  add('top', 't_hoodie', '후드티', 8, { draw: g => { const c = '#A66BFF'; torso(g, c); sleeves(g, c, 6); g.px(5, 11, 6, 1, shade(c, -0.25)); g.px(6, 16, 4, 2, shade(c, -0.2)); g.dot(7, 13, '#FFFFFF'); g.dot(8, 13, '#FFFFFF'); g.dot(7, 14, '#FFFFFF'); g.dot(8, 14, '#FFFFFF'); } });
  add('top', 't_jersey', '축구 유니폼', 10, { draw: g => { const c = '#3E6BFF'; torso(g, c); sleeves(g, c, 2); g.px(5, 12, 1, 7, '#FFFFFF'); g.px(10, 12, 1, 7, '#FFFFFF'); g.px(7, 14, 2, 1, '#FFFFFF'); g.px(8, 15, 1, 2, '#FFFFFF'); } });
  add('top', 't_suit', '정장', 15, { draw: g => { const c = '#1F2233'; torso(g, c); sleeves(g, c, 6); g.px(7, 12, 2, 1, '#FFFFFF'); g.px(7, 13, 2, 4, '#D2343A'); g.dot(6, 12, '#FFFFFF'); g.dot(9, 12, '#FFFFFF'); } });
  add('top', 't_armor', '기사 갑옷', 25, { draw: g => { const c = '#9AA3C7'; torso(g, c); sleeves(g, c, 6); g.px(6, 13, 1, 4, '#D9DEF2'); g.px(2, 12, 3, 2, '#B9C0DE'); g.px(11, 12, 3, 2, '#B9C0DE'); g.px(5, 18, 6, 1, '#6B4226'); g.px(7, 18, 2, 1, '#FFD23F'); } });

  // 하의 (다리 L 5~7, R 8~10 / 19~24행)
  const pants = (g, f, c, inner) => {
    const L = legs(f);
    g.px(L.L.x, L.L.y, 3, L.L.h, c); g.px(L.R.x, L.R.y, 3, L.R.h, c);
    g.px(L.L.x + 2, L.L.y + 1, 1, L.L.h - 1, inner); g.px(L.R.x, L.R.y + 1, 1, L.R.h - 1, inner);
    g.px(5, 19, 6, 1, c);
  };
  add('bottom', 'b_jeans', '청바지', 0, { draw: (g, f) => pants(g, f, '#3E6BFF', '#2F55D9') });
  add('bottom', 'b_shorts', '반바지', 3, { draw: g => { g.px(5, 19, 6, 3, '#FF9A3D'); g.dot(7, 21, '#E07F25'); g.dot(8, 21, '#E07F25'); } });
  add('bottom', 'b_skirt', '주름 치마', 5, { draw: g => { const c = '#FF7EB6'; g.px(5, 19, 6, 1, c); g.px(4, 20, 8, 2, c); [5, 7, 9].forEach(x => g.dot(x, 21, shade(c, -0.2))); } });
  add('bottom', 'b_cargo', '카고 바지', 6, { draw: (g, f) => { pants(g, f, '#8C8A4B', '#6F6D3A'); g.px(5, 21, 1, 2, '#6F6D3A'); g.px(10, 21, 1, 2, '#6F6D3A'); } });
  add('bottom', 'b_armor', '갑옷 하의', 15, { draw: (g, f) => { pants(g, f, '#9AA3C7', '#7C85AB'); const L = legs(f); g.dot(L.L.x + 1, L.L.y + 3, '#D9DEF2'); g.dot(L.R.x + 1, L.R.y + 3, '#D9DEF2'); } });

  // 신발 (발 LF 4~7, RF 8~11 / 2행)
  const feet = (g, f, c, sole) => { const L = legs(f); g.px(L.LF.x, L.LF.y, 4, 2, c); g.px(L.RF.x, L.RF.y, 4, 2, c); if (sole) { g.px(L.LF.x, L.LF.y + 1, 4, 1, sole); g.px(L.RF.x, L.RF.y + 1, 4, 1, sole); } };
  add('shoes', 'sh_basic', '기본 운동화', 0, { draw: (g, f) => feet(g, f, '#2B2F55', '#EEF1FF') });
  add('shoes', 'sh_red', '빨간 운동화', 3, { draw: (g, f) => feet(g, f, '#FF5A5F', '#FFFFFF') });
  add('shoes', 'sh_boots', '노란 장화', 5, { draw: (g, f) => { const L = legs(f), c = '#FFD23F'; g.px(L.L.x, L.LF.y - 2, 3, 2, c); g.px(L.R.x, L.RF.y - 2, 3, 2, c); feet(g, f, c, '#D9A800'); } });
  add('shoes', 'sh_gold', '황금 신발', 20, { draw: (g, f) => { const L = legs(f); feet(g, f, '#FFD23F', '#D9A800'); g.dot(L.LF.x + 1, L.LF.y, '#FFF6C2'); g.dot(L.RF.x + 1, L.RF.y, '#FFF6C2'); } });

  // 등
  add('back', 'bk_bag', '책가방', 6, {
    drawBack: g => { g.px(1, 13, 2, 5, '#FF9A3D'); g.px(13, 13, 2, 5, '#FF9A3D'); },
    drawFront: g => { g.px(5, 12, 1, 5, '#8A4B1F'); g.px(10, 12, 1, 5, '#8A4B1F'); }
  });
  add('back', 'bk_cape', '영웅 망토', 15, { drawBack: g => { const c = '#D2343A'; g.px(4, 12, 8, 4, c); g.px(2, 16, 12, 7, c); g.px(2, 22, 12, 1, shade(c, -0.25)); } });
  add('back', 'bk_wings', '천사 날개', 30, {
    drawBack: g => {
      const c = '#F3F6FF', t = '#C9D7FF';
      [[1, 11, 3], [0, 12, 4], [0, 13, 4], [1, 14, 3], [2, 15, 2], [2, 16, 2]].forEach(([x, y, w]) => { g.px(x, y, w, 1, c); g.px(15 - x - w + 1, y, w, 1, c); });
      g.dot(1, 13, t); g.dot(14, 13, t); g.dot(2, 15, t); g.dot(13, 15, t);
    }
  });

  const byId = {}; I.forEach(it => { byId[it.id] = it; });

  /* ---------------- 그리기 ---------------- */
  function normalize(av) {
    const out = {};
    SLOTS.forEach(([slot]) => {
      const v = av && av[slot];
      if (v && byId[v] && byId[v].slot === slot) out[slot] = v;
      else if (av && slot in av && av[slot] === null && OPTIONAL[slot]) out[slot] = null;
      else out[slot] = DEFAULT[slot];
    });
    return out;
  }
  function grid(av, frame) {
    av = normalize(av); frame = frame || 0;
    const g = Grid(), it = slot => (av[slot] ? byId[av[slot]] : null);
    const back = it('back');
    if (back && back.drawBack) back.drawBack(g, frame);
    drawBody(g, (it('skin') || byId.s1).color, frame);
    ['bottom', 'shoes', 'top'].forEach(s => { const x = it(s); if (x && x.draw) x.draw(g, frame); });
    if (back && back.drawFront) back.drawFront(g, frame);
    ['hair', 'face', 'hat'].forEach(s => { const x = it(s); if (x && x.draw) x.draw(g, frame); });
    // 테두리 (빈칸 중 그림과 맞닿은 칸)
    const c = g.cells, outline = c.map(r => r.slice());
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (c[y][x]) continue;
      if ((y > 0 && c[y - 1][x]) || (y < GH - 1 && c[y + 1][x]) || (x > 0 && c[y][x - 1]) || (x < GW - 1 && c[y][x + 1])) outline[y][x] = OUT;
    }
    return outline;
  }
  // ctx 에 (x, y) 위치부터 scale 배로 그림. crop: 'full' | 'bust'
  const CROP = { full: [0, 0, GW, GH], bust: [1, 0, 16, 16] };
  function draw(ctx, av, x, y, scale, opt) {
    opt = opt || {};
    const g = grid(av, opt.frame), [cx, cy, cw, ch] = CROP[opt.crop || 'full'];
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const col = g[cy + j] && g[cy + j][cx + i];
      if (col) { ctx.fillStyle = col; ctx.fillRect(x + i * scale, y + j * scale, scale, scale); }
    }
  }
  // 캔버스 크기를 맞춰서 그림
  function paint(canvas, av, opt) {
    opt = opt || {};
    const [, , cw, ch] = CROP[opt.crop || 'full'], s = opt.scale || 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = cw * s * dpr; canvas.height = ch * s * dpr;
    if (!opt.keepCss) { canvas.style.width = cw * s + 'px'; canvas.style.height = ch * s + 'px'; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cw * s, ch * s);
    if (opt.bg) { ctx.fillStyle = opt.bg; ctx.fillRect(0, 0, cw * s, ch * s); }
    draw(ctx, av, 0, 0, s, opt);
  }
  // data-avatar='{"skin":...}' 속성이 있는 캔버스를 한 번에 그림
  function paintAll(root) {
    (root || document).querySelectorAll('canvas[data-avatar]').forEach(c => {
      let av = {}; try { av = JSON.parse(c.dataset.avatar || '{}'); } catch (e) { /* noop */ }
      paint(c, av, { scale: +c.dataset.scale || 3, crop: c.dataset.crop || 'full', bg: c.dataset.bg || null, keepCss: c.hasAttribute('data-keepcss') });
    });
  }
  // 이름 등으로 항상 같은 모습이 나오는 무작위 아바타 (컴퓨터 상대·예시 플레이어)
  function random(seed) {
    let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
    const av = {};
    SLOTS.forEach(([slot]) => {
      const opts = I.filter(it => it.slot === slot && (slot !== 'skin' || it.price === 0 || rnd() < 0.3));
      av[slot] = OPTIONAL[slot] && rnd() < 0.5 ? null : opts[Math.floor(rnd() * opts.length)].id;
    });
    return av;
  }

  window.GoAvatar = {
    SLOTS, DEFAULT, OPTIONAL, ITEMS: I, byId, size: { w: GW, h: GH },
    normalize, grid, draw, paint, paintAll, random, legs,
    freeIds: () => I.filter(it => it.price === 0).map(it => it.id),
    attr: av => JSON.stringify(normalize(av)).replace(/"/g, '&quot;')   // HTML 속성용
  };
})();
