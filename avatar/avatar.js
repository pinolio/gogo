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
    ['top', '상의'], ['bottom', '하의'], ['shoes', '신발'], ['back', '등'], ['bg', '배경']
  ];
  const OPTIONAL = { hat: 1, face: 1, back: 1, bg: 1 };          // 비워 둘 수 있는 부위
  const DEFAULT = { skin: 's1', hair: 'h_short', hat: null, face: null, top: 't_basic', bottom: 'b_jeans', shoes: 'sh_basic', back: null, bg: null };

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

  /* ================= v22 새 패션 105종 =================
   * theme: school 학교·일상 / job 직업 / fantasy 판타지·게임 / season 동물·계절 (상점 '테마' 버튼으로 골라 보기)
   * 가격: 승리 1판 = 1~2P 기준. 일상 3~12P, 직업 6~25P, 판타지 6~30P · 고급 40~60P, 동물·계절 3~15P
   * 모양: Meshy AI 패션 시안(C:\webgamesite\meshy\img\avatar)을 16×27칸 도트로 옮김 */
  const T = theme => (slot, id, name, price, o) => add(slot, id, name, price, Object.assign({ theme }, o));
  const at = (g, x, y) => (g.cells[y + PAD] && g.cells[y + PAD][x + PAD]) || null;            // 이미 그려진 칸 색
  const fillEmpty = (g, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!at(g, x + i, y + j)) g.dot(x + i, y + j, c); };
  const skinOf = g => at(g, 7, 8) || '#F7D7B5';
  const coatTail = (g, c) => { g.px(5, 19, 2, 2, c); g.px(9, 19, 2, 2, c); };               // 긴 코트 자락
  const legCells = (g, f, fn) => { const L = legs(f); [L.L, L.R].forEach(l => { for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + 3; x++) fn(x, y); }); };
  const boots = (g, f, c, sole, h) => { const L = legs(f); g.px(L.L.x, L.LF.y - h, 3, h, c); g.px(L.R.x, L.RF.y - h, 3, h, c); feet(g, f, c, sole); };
  const hood = (g, c) => { g.px(4, 1, 8, 2, c); g.px(3, 2, 10, 2, c); g.px(3, 4, 1, 7, c); g.px(12, 4, 1, 7, c); g.dot(4, 10, c); g.dot(11, 10, c); };
  const mirror = (g, rows, c) => rows.forEach(([x, y, w]) => { g.px(x, y, w, 1, c); g.px(15 - x - w + 1, y, w, 1, c); });

  /* ---- 학교·일상 ---- */
  const S = T('school');
  S('top', 't_pe', '체육복 상의', 5, { draw: g => { const c = '#25306B'; torso(g, c); sleeves(g, c, 7); g.px(3, 12, 1, 7, '#FFFFFF'); g.px(12, 12, 1, 7, '#FFFFFF'); g.px(6, 12, 4, 1, shade(c, -0.35)); g.px(8, 13, 1, 6, '#C9D1F5'); } });
  S('bottom', 'b_pe', '체육복 바지', 4, { draw: (g, f) => { const L = legs(f); pants(g, f, '#25306B', '#1B2350'); g.px(L.L.x, L.L.y + 1, 1, L.L.h - 1, '#FFFFFF'); g.px(L.R.x + 2, L.R.y + 1, 1, L.R.h - 1, '#FFFFFF'); } });
  S('top', 't_blouse', '교복 블라우스·조끼', 6, { draw: g => { torso(g, '#F3F6FF'); sleeves(g, '#F3F6FF', 3); g.px(5, 14, 6, 5, '#2A3366'); g.px(7, 14, 2, 1, '#F3F6FF'); g.px(6, 12, 4, 1, '#D2343A'); g.px(7, 13, 2, 1, '#D2343A'); g.dot(6, 16, '#FFD23F'); } });
  S('bottom', 'b_uniskirt', '교복 치마', 5, { draw: g => { const c = '#7A819E', d = '#565C78'; g.px(5, 19, 6, 1, c); g.px(4, 20, 8, 2, c); [5, 8, 10].forEach(x => g.px(x, 20, 1, 2, d)); g.px(4, 21, 8, 1, d); } });
  S('bottom', 'b_slacks', '교복 바지', 4, { draw: (g, f) => pants(g, f, '#3A3F55', '#2C3044') });
  S('top', 't_cardigan', '베이지 카디건', 7, { draw: g => { const c = '#D9C3A0'; torso(g, c); sleeves(g, c, 7); g.px(7, 12, 2, 7, '#F3F6FF'); [14, 16].forEach(y => g.dot(6, y, '#8A6A45')); g.px(3, 18, 2, 1, shade(c, -0.2)); g.px(11, 18, 2, 1, shade(c, -0.2)); } });
  S('top', 't_mint', '민트 후드티', 8, { draw: g => { const c = '#7FE0C4'; torso(g, c); sleeves(g, c, 7); g.px(5, 11, 6, 1, shade(c, -0.25)); g.px(6, 16, 4, 2, shade(c, -0.15)); g.px(7, 12, 1, 3, '#FFFFFF'); g.px(8, 12, 1, 3, '#FFFFFF'); } });
  S('top', 't_padding', '롱패딩', 12, { draw: g => { const c = '#2B3A6B', l = shade(c, -0.3); torso(g, c); sleeves(g, c, 7); g.px(4, 19, 8, 3, c); [14, 17, 20].forEach(y => g.px(3, y, 10, 1, l)); g.px(8, 12, 1, 10, '#C9D1F5'); g.px(5, 11, 6, 1, '#9AA3C7'); } });
  S('top', 't_denim', '청재킷', 9, { draw: g => { const c = '#5A86C9'; torso(g, c); sleeves(g, c, 7); for (let y = 12; y <= 18; y++) g.px(7, y, 2, 1, y % 2 ? '#F3F6FF' : '#FF5A5F'); g.dot(6, 12, shade(c, -0.3)); g.dot(9, 12, shade(c, -0.3)); g.dot(6, 14, shade(c, 0.3)); g.dot(9, 14, shade(c, 0.3)); } });
  S('top', 't_basket', '농구 유니폼', 9, { draw: g => { const c = '#E0343C'; torso(g, c); g.px(6, 12, 4, 1, '#FFFFFF'); g.px(6, 14, 4, 3, '#FFFFFF'); g.dot(7, 15, c); g.dot(8, 14, c); g.px(5, 18, 6, 1, shade(c, -0.25)); } });
  S('bottom', 'b_basket', '농구 반바지', 4, { draw: g => { const c = '#E0343C'; g.px(5, 19, 6, 3, c); g.px(5, 19, 1, 3, '#FFFFFF'); g.px(10, 19, 1, 3, '#FFFFFF'); g.dot(7, 21, shade(c, -0.3)); g.dot(8, 21, shade(c, -0.3)); } });
  S('hair', 'h_ponytail', '포니테일', 7, { draw: g => { const c = '#3A2A20'; shortHair(g, c); g.px(12, 4, 2, 2, c); g.px(13, 6, 1, 4, c); g.dot(12, 4, '#FF5A5F'); g.dot(12, 5, '#FF5A5F'); } });
  S('hair', 'h_curly', '뽀글 머리', 8, { draw: g => { const c = '#7A4A2A', l = shade(c, 0.25); g.px(4, 0, 8, 1, c); g.px(3, 1, 10, 4, c); g.px(2, 2, 12, 2, c); g.px(3, 5, 1, 3, c); g.px(12, 5, 1, 3, c); g.dot(5, 5, c); g.dot(10, 5, c); [[4, 1], [7, 1], [10, 2], [5, 3], [9, 3], [3, 3], [12, 3]].forEach(([x, y]) => g.dot(x, y, l)); } });
  S('hair', 'h_twotone', '투톤 머리', 10, { draw: g => { const c = '#2B2B3A', b = '#3BC8F5'; shortHair(g, c); g.px(8, 2, 3, 1, b); g.px(8, 3, 4, 2, b); g.px(11, 5, 1, 2, b); g.px(5, 5, 2, 1, c); } });
  S('hair', 'h_bun', '똥머리', 8, { draw: g => { const c = '#6B4226'; shortHair(g, c); g.px(6, 0, 4, 2, c); g.px(7, -1, 2, 1, c); g.dot(10, 1, '#FFD23F'); g.dot(6, 0, shade(c, 0.25)); } });
  S('hat', 'hat_snapback', '거꾸로 스냅백', 6, { draw: g => { const c = '#2B2F55'; g.px(5, 0, 6, 1, c); g.px(4, 1, 8, 3, c); g.px(4, 4, 8, 1, shade(c, -0.35)); g.px(6, 3, 4, 1, '#F3F6FF'); g.dot(7, 1, '#FFD23F'); g.dot(8, 1, '#FFD23F'); } });
  S('hat', 'hat_pompom', '방울 비니', 6, { draw: g => { const c = '#FF7EB6'; g.px(4, 1, 8, 3, c); g.px(4, 4, 8, 1, shade(c, 0.4)); [5, 7, 9].forEach(x => g.px(x, 1, 1, 3, shade(c, -0.15))); g.px(7, -1, 2, 2, '#FFFFFF'); } });
  S('face', 'f_headphone', '헤드폰', 9, { draw: g => { const k = '#3A3F66', c = '#FF5A5F'; g.px(5, 1, 6, 1, k); g.dot(4, 2, k); g.dot(11, 2, k); g.px(3, 3, 1, 2, k); g.px(12, 3, 1, 2, k); g.px(2, 5, 2, 3, c); g.px(12, 5, 2, 3, c); g.dot(2, 6, shade(c, -0.3)); g.dot(13, 6, shade(c, -0.3)); } });
  S('shoes', 'sh_hightop', '하이탑 운동화', 6, { draw: (g, f) => { const L = legs(f); boots(g, f, '#2B2F55', '#F3F6FF', 1); g.dot(L.LF.x, L.LF.y, '#F3F6FF'); g.dot(L.RF.x + 3, L.RF.y, '#F3F6FF'); } });
  S('shoes', 'sh_rain', '빨간 장화', 5, { draw: (g, f) => boots(g, f, '#E0343C', '#A3202A', 2) });

  /* ---- 직업 ---- */
  const J = T('job');
  J('top', 't_doctor', '의사 가운', 12, { draw: g => { const c = '#F7F9FF'; torso(g, c); sleeves(g, c, 7); coatTail(g, c); g.px(7, 12, 2, 7, '#7FB8E8'); [[6, 12], [6, 13], [6, 14], [9, 12], [9, 13], [9, 14], [7, 15], [8, 15]].forEach(([x, y]) => g.dot(x, y, '#3A3F66')); g.dot(8, 16, '#9AA3C7'); g.dot(10, 15, '#7FB8E8'); } });
  J('top', 't_chef', '요리사 옷', 10, { draw: g => { const c = '#F7F9FF'; torso(g, c); sleeves(g, c, 7); g.px(6, 12, 4, 1, '#D2343A'); [[6, 14], [6, 16], [9, 14], [9, 16]].forEach(([x, y]) => g.dot(x, y, '#3A3F66')); g.px(3, 18, 2, 1, '#D9DEF2'); g.px(11, 18, 2, 1, '#D9DEF2'); } });
  J('bottom', 'b_chef', '체크 바지', 6, { draw: (g, f) => { legCells(g, f, (x, y) => g.dot(x, y, (x + y) % 2 ? '#2B2F45' : '#E6E9F5')); g.px(5, 19, 6, 1, '#2B2F45'); } });
  J('hat', 'hat_chef', '요리사 모자', 8, { draw: g => { const c = '#F7F9FF'; g.px(4, -1, 8, 4, c); g.px(3, 0, 10, 2, c); g.px(4, 3, 8, 1, '#D9DEF2'); g.dot(6, 0, '#D9DEF2'); g.dot(9, 1, '#D9DEF2'); } });
  J('top', 't_fire', '소방복', 14, { draw: g => { const c = '#C9A15A'; torso(g, c); sleeves(g, c, 7); coatTail(g, c); g.px(3, 16, 10, 1, '#FFE45C'); g.px(3, 17, 10, 1, '#D9DEF2'); g.px(5, 13, 6, 1, '#FFE45C'); g.px(7, 12, 2, 4, shade(c, -0.3)); } });
  J('hat', 'hat_fire', '소방 헬멧', 10, { draw: g => { const c = '#D2343A'; g.px(5, 0, 6, 1, c); g.px(4, 1, 8, 3, c); g.px(2, 4, 12, 1, shade(c, -0.3)); g.px(7, 1, 2, 2, '#FFD23F'); g.dot(5, 1, shade(c, 0.3)); } });
  J('top', 't_police', '경찰복', 12, { draw: g => { const c = '#22306B'; torso(g, c); sleeves(g, c, 7); g.px(6, 12, 4, 1, '#7FB8E8'); g.px(7, 12, 2, 6, '#7FB8E8'); g.px(7, 13, 2, 3, '#14182E'); g.dot(9, 14, '#FFD23F'); g.px(5, 18, 6, 1, '#14182E'); g.px(7, 18, 2, 1, '#FFD23F'); g.px(3, 12, 2, 1, '#FFD23F'); g.px(11, 12, 2, 1, '#FFD23F'); } });
  J('hat', 'hat_police', '경찰 모자', 10, { draw: g => { const c = '#22306B'; g.px(4, 0, 8, 1, c); g.px(3, 1, 10, 2, c); g.px(4, 3, 8, 2, '#14182E'); g.px(7, 1, 2, 2, '#FFD23F'); } });
  J('top', 't_astro', '우주복', 20, { draw: g => { const c = '#EEF1FF'; torso(g, c); sleeves(g, c, 7); g.px(6, 14, 4, 2, '#3A3F66'); g.dot(6, 14, '#FF5A5F'); g.dot(7, 14, '#3DDC84'); g.dot(8, 14, '#FFD23F'); g.px(3, 15, 2, 1, '#FF9A3D'); g.px(11, 15, 2, 1, '#FF9A3D'); g.dot(10, 12, '#3BC8F5'); g.px(5, 18, 6, 1, '#C9CFE6'); } });
  J('bottom', 'b_astro', '우주복 바지', 8, { draw: (g, f) => { const L = legs(f); pants(g, f, '#EEF1FF', '#C9CFE6'); g.px(L.L.x, L.L.y + 3, 3, 1, '#FF9A3D'); g.px(L.R.x, L.R.y + 3, 3, 1, '#FF9A3D'); } });
  J('hat', 'hat_astro', '우주 헬멧', 25, { draw: g => { const r = '#D9DEF2'; fillEmpty(g, 3, 1, 10, 10, '#CFEAFF'); g.px(4, 0, 8, 1, r); g.dot(3, 1, r); g.dot(12, 1, r); g.px(2, 2, 1, 9, r); g.px(13, 2, 1, 9, r); g.px(3, 11, 3, 1, r); g.px(10, 11, 3, 1, r); g.dot(4, 2, '#FFFFFF'); g.dot(3, 3, '#FFFFFF'); g.dot(3, 4, '#FFFFFF'); } });
  J('hat', 'hat_hardhat', '안전모', 6, { draw: g => { const c = '#FFD23F'; g.px(5, 0, 6, 1, c); g.px(4, 1, 8, 3, c); g.px(3, 4, 10, 1, shade(c, -0.25)); g.px(7, 0, 2, 4, shade(c, 0.35)); } });
  J('top', 't_vest', '안전 조끼', 6, { draw: g => { const s = '#8A93C0', o = '#FF7A1A'; torso(g, s); sleeves(g, s, 2); g.px(5, 12, 2, 7, o); g.px(9, 12, 2, 7, o); g.px(5, 15, 2, 1, '#E6F5FF'); g.px(9, 15, 2, 1, '#E6F5FF'); g.px(5, 17, 6, 1, '#E6F5FF'); } });
  J('top', 't_idol', '아이돌 무대의상', 18, { draw: g => { const c = '#7E4DE0'; torso(g, c); sleeves(g, c, 7); g.px(7, 12, 2, 7, '#14182E'); g.px(3, 12, 2, 1, '#FFD23F'); g.px(11, 12, 2, 1, '#FFD23F'); [[5, 13, '#FFFFFF'], [10, 15, '#FFD23F'], [6, 17, '#FFD23F'], [4, 15, '#FFFFFF'], [12, 16, '#FFFFFF'], [9, 12, '#FFFFFF']].forEach(([x, y, k]) => g.dot(x, y, k)); } });
  J('face', 'f_mic', '헤드셋 마이크', 8, { draw: g => { const k = '#2B2F55'; g.px(3, 5, 1, 3, k); g.dot(4, 8, k); g.dot(5, 9, k); g.dot(6, 9, '#FF5A5F'); } });
  J('top', 't_overall', '농부 멜빵', 9, { draw: g => { const c = '#D2343A'; torso(g, c); sleeves(g, c, 3); [13, 15, 17].forEach(y => g.px(5, y, 6, 1, shade(c, -0.25))); g.dot(4, 13, shade(c, -0.25)); g.dot(11, 13, shade(c, -0.25)); g.px(6, 15, 4, 4, '#3E6BFF'); g.px(6, 12, 1, 3, '#3E6BFF'); g.px(9, 12, 1, 3, '#3E6BFF'); g.dot(6, 15, '#FFD23F'); g.dot(9, 15, '#FFD23F'); } });
  J('hat', 'hat_straw', '밀짚모자', 6, { draw: g => { const c = '#E8C46A'; g.px(5, 0, 6, 1, c); g.px(4, 1, 8, 2, c); g.px(1, 3, 14, 1, shade(c, -0.15)); g.px(4, 2, 8, 1, '#D2343A'); g.dot(6, 1, shade(c, 0.3)); } });
  J('shoes', 'sh_black', '검정 부츠', 6, { draw: (g, f) => boots(g, f, '#1E2236', '#3A3F66', 2) });
  J('shoes', 'sh_space', '우주 부츠', 8, { draw: (g, f) => { const L = legs(f); boots(g, f, '#EEF1FF', '#9AA3C7', 2); g.dot(L.L.x + 1, L.LF.y - 1, '#FF9A3D'); g.dot(L.R.x + 1, L.RF.y - 1, '#FF9A3D'); } });

  /* ---- 판타지·게임 ---- */
  const F = T('fantasy');
  F('top', 't_ninja', '닌자 옷', 14, { draw: g => { const c = '#1E2236'; torso(g, c); sleeves(g, c, 7); g.px(5, 12, 6, 1, '#D2343A'); g.px(11, 13, 2, 2, '#D2343A'); g.px(5, 17, 6, 1, '#D2343A'); g.px(6, 13, 1, 4, shade(c, 0.2)); } });
  F('bottom', 'b_ninja', '닌자 바지', 8, { draw: (g, f) => { const L = legs(f); pants(g, f, '#1E2236', '#14182E'); g.px(L.L.x, L.L.y + L.L.h - 2, 3, 1, '#5B6390'); g.px(L.R.x, L.R.y + L.R.h - 2, 3, 1, '#5B6390'); } });
  F('face', 'f_ninja', '닌자 복면', 10, { draw: g => { const k = '#1E2236', r = '#D2343A'; g.px(4, 8, 8, 2, k); g.px(5, 10, 6, 1, k); g.px(4, 5, 8, 1, r); g.px(7, 5, 2, 1, '#BFC7E0'); g.px(12, 5, 2, 1, r); g.dot(13, 6, r); } });
  F('hat', 'hat_pirate', '해적 선장 모자', 20, { draw: g => { const c = '#5A3418'; g.px(4, 0, 8, 2, c); g.px(2, 2, 12, 2, c); g.dot(1, 2, c); g.dot(14, 2, c); g.px(2, 3, 12, 1, '#FFD23F'); g.px(7, 0, 2, 1, '#FFFFFF'); g.dot(7, 1, '#FFFFFF'); g.dot(8, 1, '#FFFFFF'); } });
  F('face', 'f_eyepatch', '안대', 6, { draw: g => { const k = '#14182E'; g.px(4, 5, 5, 1, k); g.px(8, 6, 3, 2, k); g.dot(11, 5, k); } });
  F('top', 't_pirate', '해적 코트', 22, { draw: g => { const c = '#B2232B'; torso(g, c); sleeves(g, c, 7); g.px(4, 19, 2, 3, c); g.px(10, 19, 2, 3, c); g.px(7, 12, 2, 3, '#F3F6FF'); [[6, 14], [6, 16], [9, 14], [9, 16]].forEach(([x, y]) => g.dot(x, y, '#FFD23F')); g.px(5, 17, 6, 1, '#14182E'); g.px(7, 17, 2, 1, '#FFD23F'); g.px(3, 18, 2, 1, '#FFD23F'); g.px(11, 18, 2, 1, '#FFD23F'); } });
  F('top', 't_robe', '대마법사 로브', 28, { draw: g => { const c = '#2C3A8F'; torso(g, c); sleeves(g, c, 5); g.px(2, 17, 3, 2, c); g.px(11, 17, 3, 2, c); g.px(4, 19, 8, 5, c); g.px(5, 18, 6, 1, '#FFD23F'); g.px(7, 19, 2, 5, shade(c, -0.25)); [[6, 14], [9, 16], [5, 20], [10, 21], [6, 22], [9, 13]].forEach(([x, y]) => g.dot(x, y, '#FFD23F')); } });
  F('hat', 'hat_darkhelm', '흑기사 뿔 투구', 40, { draw: g => { const c = '#2B2340', h = '#E6E1D0'; g.px(4, 1, 8, 5, c); g.px(3, 3, 1, 7, c); g.px(12, 3, 1, 7, c); g.px(4, 6, 8, 1, c); g.px(4, 7, 8, 1, '#C792FF'); g.px(4, 8, 8, 2, c); g.px(5, 10, 6, 1, c); g.px(7, 2, 2, 4, shade(c, 0.25)); g.px(2, 0, 2, 2, h); g.dot(1, -1, h); g.px(12, 0, 2, 2, h); g.dot(14, -1, h); } });
  F('top', 't_darkarmor', '흑기사 갑옷', 45, { draw: g => { const c = '#2B2340', p = '#433A5E'; torso(g, c); sleeves(g, c, 7); g.px(2, 12, 3, 2, p); g.px(11, 12, 3, 2, p); g.dot(2, 11, '#E6E1D0'); g.dot(13, 11, '#E6E1D0'); g.px(7, 13, 2, 4, '#A66BFF'); g.dot(6, 14, '#C792FF'); g.dot(9, 14, '#C792FF'); g.px(5, 18, 6, 1, p); g.px(4, 19, 2, 2, c); g.px(10, 19, 2, 2, c); } });
  F('back', 'bk_darkcape', '어둠의 망토', 30, { drawBack: g => { const c = '#3A2457'; g.px(4, 12, 8, 4, c); g.px(2, 16, 12, 6, c); for (let x = 2; x < 14; x += 2) g.dot(x, 22, c); g.px(2, 16, 12, 1, shade(c, 0.2)); } });
  F('face', 'f_elf', '엘프 귀', 10, { draw: g => { const s = skinOf(g); [[1, 4], [2, 5], [2, 6], [3, 6], [3, 7]].forEach(([x, y]) => { g.dot(x, y, s); g.dot(15 - x, y, s); }); g.dot(3, 6, shade(s, -0.15)); g.dot(12, 6, shade(s, -0.15)); } });
  F('hat', 'hat_halo', '천사 고리', 25, { draw: g => { const c = '#FFE45C'; g.px(5, -1, 6, 1, c); g.dot(4, 0, c); g.dot(11, 0, c); g.px(5, 1, 6, 1, '#FFC53D'); } });
  F('hat', 'hat_devil', '악마 뿔', 12, { draw: g => { const c = '#D2343A'; g.px(4, 1, 2, 2, c); g.dot(3, 0, c); g.px(10, 1, 2, 2, c); g.dot(12, 0, c); g.dot(4, 1, shade(c, 0.3)); g.dot(11, 1, shade(c, 0.3)); } });
  F('back', 'bk_bat', '박쥐 날개', 35, { drawBack: g => { const c = '#5A1E3A', m = '#8A2B52'; mirror(g, [[0, 10, 3], [-1, 11, 5], [-1, 12, 5], [-1, 13, 5], [0, 14, 4], [1, 15, 3]], c); mirror(g, [[0, 12, 3], [0, 13, 3]], m); g.dot(-1, 14, c); g.dot(16, 14, c); g.dot(0, 16, c); g.dot(15, 16, c); } });
  F('back', 'bk_dragon', '용 날개', 60, { drawBack: g => { const c = '#2FA866', m = '#7BE0A0', b = '#1C6E42'; mirror(g, [[1, 8, 2], [0, 9, 4], [-1, 10, 5], [-1, 11, 5], [-1, 12, 5], [-1, 13, 5], [-1, 14, 5], [0, 15, 4], [-1, 16, 2], [1, 16, 2], [-1, 17, 1], [2, 17, 1]], c); mirror(g, [[0, 11, 3], [0, 12, 3], [1, 13, 2], [1, 14, 2]], m); mirror(g, [[2, 9, 1], [1, 10, 1], [0, 11, 1]], b); g.dot(1, 7, b); g.dot(14, 7, b); } });
  F('back', 'bk_fairy', '요정 날개', 45, { drawBack: g => { const a = '#FFB3E6', b = '#A8F0E0', e = '#FFFFFF'; mirror(g, [[0, 10, 3], [-1, 11, 5], [-1, 12, 5], [0, 13, 4]], a); mirror(g, [[0, 15, 4], [0, 16, 4], [1, 17, 3]], b); mirror(g, [[0, 11, 1], [1, 16, 1]], e); g.dot(1, 12, '#FFE45C'); g.dot(14, 12, '#FFE45C'); } });
  F('back', 'bk_jetpack', '제트팩', 50, { drawBack: g => { const c = '#9AA3C7', d = '#5B6390'; g.px(1, 12, 3, 6, c); g.px(12, 12, 3, 6, c); g.px(1, 12, 3, 1, '#D9DEF2'); g.px(12, 12, 3, 1, '#D9DEF2'); g.px(2, 14, 1, 2, '#FF5A5F'); g.px(13, 14, 1, 2, '#FF5A5F'); g.px(1, 18, 3, 1, d); g.px(12, 18, 3, 1, d); g.px(1, 19, 3, 2, '#FF9A3D'); g.px(12, 19, 3, 2, '#FF9A3D'); g.dot(2, 21, '#FFD23F'); g.dot(13, 21, '#FFD23F'); } });
  F('hat', 'hat_emperor', '황제의 왕관', 55, { draw: g => { const c = '#FFD23F', d = '#D9A800'; g.px(3, 1, 10, 3, c); g.px(3, -1, 1, 2, c); g.dot(5, 0, c); g.px(7, -1, 2, 2, c); g.dot(10, 0, c); g.px(12, -1, 1, 2, c); g.px(3, 3, 10, 1, d); g.px(3, 4, 10, 1, '#FFFFFF'); [5, 8, 11].forEach(x => g.dot(x, 4, '#1E2236')); g.dot(5, 2, '#FF5A5F'); g.px(7, 1, 2, 2, '#3BC8F5'); g.dot(10, 2, '#3DDC84'); } });
  F('top', 't_vampire', '뱀파이어 정장', 22, { draw: g => { const c = '#1E1A2E', r = '#B2232B'; torso(g, c); sleeves(g, c, 7); g.px(3, 9, 2, 3, r); g.px(11, 9, 2, 3, r); g.px(2, 8, 1, 2, r); g.px(13, 8, 1, 2, r); g.px(7, 12, 2, 1, '#F3F6FF'); g.px(7, 13, 2, 4, r); g.dot(7, 14, '#FFD23F'); } });
  F('skin', 's_pale', '창백한 피부 (뱀파이어)', 12, { color: '#E8E6F2' });
  F('skin', 's_gold', '황금 피부', 50, { color: '#F2C641' });

  /* ---- 동물·계절 ---- */
  const A = T('season');
  A('hat', 'hat_dino', '공룡 후드', 10, { draw: g => { const c = '#4FBF6A'; hood(g, c); [[5, 0], [7, -1], [7, 0], [9, 0]].forEach(([x, y]) => g.dot(x, y, '#F5D547')); g.dot(5, 2, '#FFFFFF'); g.dot(10, 2, '#FFFFFF'); g.dot(5, 1, '#1E2236'); g.dot(10, 1, '#1E2236'); } });
  A('top', 't_dino', '공룡 잠옷 상의', 10, { draw: g => { const c = '#4FBF6A'; torso(g, c); sleeves(g, c, 7); g.px(6, 13, 4, 5, '#E9F5B0'); [14, 16].forEach(y => g.px(6, y, 4, 1, '#D2E68F')); } });
  A('bottom', 'b_dino', '공룡 잠옷 바지', 6, { draw: (g, f) => { const c = '#4FBF6A'; pants(g, f, c, shade(c, -0.2)); g.px(11, 20, 2, 2, c); g.dot(13, 21, c); g.dot(12, 19, '#F5D547'); } });
  A('hat', 'hat_panda', '판다 후드', 10, { draw: g => { hood(g, '#F3F6FF'); g.px(3, 0, 2, 2, '#1E2236'); g.px(11, 0, 2, 2, '#1E2236'); } });
  A('top', 't_panda', '판다 잠옷', 10, { draw: g => { torso(g, '#F3F6FF'); sleeves(g, '#1E2236', 7); g.px(5, 12, 6, 1, '#1E2236'); g.dot(7, 15, '#1E2236'); g.dot(8, 15, '#1E2236'); } });
  A('bottom', 'b_panda', '판다 잠옷 바지', 6, { draw: (g, f) => pants(g, f, '#1E2236', '#14182E') });
  A('hat', 'hat_cat', '고양이 후드', 8, { draw: g => { const c = '#9AA0B5'; hood(g, c); g.px(3, 0, 2, 1, c); g.dot(3, -1, c); g.px(11, 0, 2, 1, c); g.dot(12, -1, c); g.dot(4, 0, '#FFB3C7'); g.dot(11, 0, '#FFB3C7'); } });
  A('hat', 'hat_santa', '산타 모자', 8, { draw: g => { const c = '#D2343A'; g.px(4, 1, 8, 2, c); g.px(6, 0, 5, 1, c); g.px(10, -1, 3, 1, c); g.px(13, -1, 2, 2, '#FFFFFF'); g.px(3, 3, 10, 2, '#FFFFFF'); } });
  A('top', 't_santa', '산타 옷', 12, { draw: g => { const c = '#D2343A'; torso(g, c); sleeves(g, c, 7); g.px(7, 12, 2, 7, '#FFFFFF'); g.px(3, 18, 2, 1, '#FFFFFF'); g.px(11, 18, 2, 1, '#FFFFFF'); g.px(5, 17, 6, 1, '#14182E'); g.px(7, 17, 2, 1, '#FFD23F'); } });
  A('bottom', 'b_santa', '산타 바지', 5, { draw: (g, f) => pants(g, f, '#D2343A', '#A3202A') });
  A('face', 'f_beard', '산타 수염', 6, { draw: g => { const w = '#FFFFFF'; g.px(5, 8, 6, 1, '#E3E7F5'); g.px(4, 9, 8, 2, w); g.px(5, 11, 6, 1, w); g.px(6, 12, 4, 1, w); g.px(7, 9, 2, 1, '#F3A0A8'); } });
  A('hat', 'hat_pumpkin', '호박 머리', 15, { draw: g => { const c = '#FF8A1F', d = shade(c, -0.25), k = '#3A1E0A'; g.px(3, 2, 10, 9, c); g.px(4, 1, 8, 1, c); g.px(4, 11, 8, 1, c); [5, 8, 11].forEach(x => g.px(x, 2, 1, 9, d)); g.px(7, -1, 2, 2, '#3D8A3A'); g.dot(9, 0, '#3D8A3A'); g.px(5, 5, 2, 2, k); g.px(9, 5, 2, 2, k); g.px(5, 8, 6, 1, k); g.dot(6, 9, k); g.dot(9, 9, k); g.dot(5, 5, '#FFD23F'); g.dot(9, 5, '#FFD23F'); } });
  A('top', 't_hanbok_m', '한복 저고리 (파랑)', 14, { draw: g => { const c = '#3E6FD8'; torso(g, c); sleeves(g, c, 7); [[5, 12], [6, 13], [7, 14], [8, 15]].forEach(([x, y]) => g.dot(x, y, '#FFFFFF')); g.px(9, 15, 1, 3, '#2A3366'); g.dot(10, 16, '#2A3366'); g.px(3, 18, 2, 1, '#FFFFFF'); g.px(11, 18, 2, 1, '#FFFFFF'); } });
  A('bottom', 'b_hanbok_m', '한복 바지', 8, { draw: (g, f) => { const L = legs(f); pants(g, f, '#B9BFD3', '#9AA0B5'); g.px(L.L.x, L.L.y + L.L.h - 1, 3, 1, '#5B6390'); g.px(L.R.x, L.R.y + L.R.h - 1, 3, 1, '#5B6390'); } });
  A('top', 't_hanbok_f', '한복 저고리 (노랑)', 14, { draw: g => { const c = '#FFD84D'; g.px(5, 12, 6, 4, c); g.px(3, 12, 2, 3, c); g.px(11, 12, 2, 3, c); ['#FF5A5F', '#3BC8F5', '#3DDC84', '#A66BFF'].forEach((k, i) => { g.px(3, 15 + i, 2, 1, k); g.px(11, 15 + i, 2, 1, k); }); [[5, 12], [6, 13], [7, 14]].forEach(([x, y]) => g.dot(x, y, '#FFFFFF')); g.px(8, 14, 1, 3, '#D2343A'); g.dot(9, 15, '#D2343A'); } });
  A('bottom', 'b_chima', '다홍 치마', 10, { draw: g => { const c = '#E0344A', d = shade(c, -0.2); g.px(5, 16, 6, 3, c); g.px(4, 19, 8, 3, c); g.px(3, 22, 10, 2, c); [6, 9].forEach(x => g.px(x, 19, 1, 5, d)); g.px(5, 16, 6, 1, '#FFFFFF'); } });
  A('top', 't_hawaii', '하와이안 셔츠', 8, { draw: g => { const c = '#3BC8F5'; torso(g, c); sleeves(g, c, 2); g.dot(7, 12, shade(c, -0.3)); g.dot(8, 12, shade(c, -0.3)); [[6, 13, '#FFD23F'], [9, 14, '#FF7EB6'], [5, 16, '#FF7EB6'], [8, 17, '#FFFFFF'], [10, 17, '#FFD23F'], [4, 12, '#FFFFFF']].forEach(([x, y, k]) => g.dot(x, y, k)); } });
  A('bottom', 'b_swim', '수영 반바지', 3, { draw: g => { const c = '#FF7EB6'; g.px(5, 19, 6, 3, c); g.dot(6, 20, '#FFFFFF'); g.dot(9, 19, '#FFFFFF'); g.dot(8, 21, '#FFFFFF'); } });
  A('shoes', 'sh_flip', '슬리퍼', 3, { draw: (g, f) => { const L = legs(f), c = '#3BC8F5'; g.px(L.LF.x, L.LF.y + 1, 4, 1, c); g.px(L.RF.x, L.RF.y + 1, 4, 1, c); g.dot(L.LF.x + 2, L.LF.y, c); g.dot(L.RF.x + 1, L.RF.y, c); } });

  /* ---- Meshy 시안을 보고 더한 아이템 (v22, 26종) ---- */
  S('hat', 'hat_raincoat', '우비 모자', 6, { draw: g => { const c = '#FFD23F'; hood(g, c); g.px(3, 1, 10, 1, c); g.px(4, 0, 8, 1, c); g.dot(4, 4, shade(c, -0.2)); g.dot(11, 4, shade(c, -0.2)); } });
  S('top', 't_raincoat', '노란 우비', 9, { draw: g => { const c = '#FFD23F', d = shade(c, -0.22); torso(g, c); sleeves(g, c, 7); g.px(4, 19, 8, 2, c); g.px(8, 12, 1, 9, d); g.px(5, 16, 2, 1, d); g.px(9, 16, 2, 1, d); [13, 15, 17].forEach(y => g.dot(7, y, '#FFFFFF')); } });
  S('back', 'bk_bag2', '하늘색 책가방', 6, {
    drawBack: g => { g.px(1, 13, 2, 5, '#7FC8F0'); g.px(13, 13, 2, 5, '#7FC8F0'); g.dot(1, 15, '#FFD23F'); },
    drawFront: g => { g.px(5, 12, 1, 5, '#3C7FB5'); g.px(10, 12, 1, 5, '#3C7FB5'); }
  });
  S('hat', 'hat_sweatband', '스포츠 머리띠', 4, { draw: g => { g.px(4, 4, 8, 1, '#F3F6FF'); g.px(4, 5, 8, 1, '#FF5A5F'); g.dot(3, 5, '#F3F6FF'); g.dot(12, 5, '#F3F6FF'); } });

  J('hat', 'hat_pilot', '조종사 모자', 10, { draw: g => { const c = '#1F2A55'; g.px(4, 0, 8, 1, c); g.px(3, 1, 10, 2, c); g.px(4, 3, 8, 1, '#FFD23F'); g.px(4, 4, 8, 1, '#14182E'); g.px(6, 1, 4, 1, '#FFD23F'); g.dot(7, 2, '#FFD23F'); g.dot(8, 2, '#FFD23F'); } });
  J('top', 't_pilot', '조종사 제복', 14, { draw: g => { const c = '#1F2A55'; torso(g, c); sleeves(g, c, 7); g.px(7, 12, 2, 4, '#F3F6FF'); g.px(7, 13, 2, 3, '#14182E'); g.px(3, 17, 2, 1, '#FFD23F'); g.px(11, 17, 2, 1, '#FFD23F'); g.px(3, 12, 2, 1, '#FFD23F'); g.px(11, 12, 2, 1, '#FFD23F'); g.dot(9, 14, '#FFD23F'); g.dot(6, 15, '#FFD23F'); } });
  J('face', 'f_goggles', '실험 보안경', 5, { draw: g => { const k = '#4C7DFF', l = '#CFEAFF'; g.px(4, 6, 8, 1, k); g.px(4, 7, 8, 1, k); g.px(5, 7, 2, 1, l); g.px(9, 7, 2, 1, l); g.dot(6, 7, '#1D2340'); g.dot(9, 7, '#1D2340'); g.dot(3, 6, k); g.dot(12, 6, k); } });
  J('hat', 'hat_racing', '레이싱 헬멧', 15, { draw: g => { const c = '#E0343C'; g.px(4, 1, 8, 5, c); g.px(3, 2, 1, 8, c); g.px(12, 2, 1, 8, c); g.px(4, 6, 8, 1, '#14182E'); g.px(4, 7, 8, 1, '#3A3F66'); g.px(4, 8, 8, 2, c); g.px(5, 10, 6, 1, c); g.px(5, 0, 6, 1, c); g.dot(5, 7, '#9AA3C7'); g.px(6, 2, 4, 1, '#FFFFFF'); } });
  J('top', 't_racing', '레이싱 슈트', 16, { draw: g => { const c = '#E0343C'; torso(g, c); sleeves(g, c, 7); g.px(5, 14, 6, 1, '#FFD23F'); g.px(3, 14, 2, 1, '#FFD23F'); g.px(11, 14, 2, 1, '#FFD23F'); g.px(7, 15, 2, 2, '#F3F6FF'); g.dot(9, 12, '#F3F6FF'); g.px(3, 18, 2, 1, '#14182E'); g.px(11, 18, 2, 1, '#14182E'); } });
  J('top', 't_teacher', '선생님 재킷', 9, { draw: g => { const c = '#3E5FA8'; torso(g, c); sleeves(g, c, 7); g.px(7, 12, 2, 7, '#F3F6FF'); g.dot(7, 13, '#3DDC84'); g.dot(8, 14, '#3DDC84'); g.px(7, 15, 2, 2, '#3DDC84'); g.dot(8, 16, '#F3F6FF'); } });

  F('hair', 'h_topknot', '상투 머리', 8, { draw: g => { const c = '#1E2236'; shortHair(g, c); g.px(7, 0, 2, 2, c); g.px(6, 1, 4, 1, c); g.dot(7, 0, shade(c, 0.35)); } });
  F('top', 't_samurai', '사무라이 갑옷', 30, { draw: g => { const c = '#3A5BA8', d = shade(c, -0.3); torso(g, c); sleeves(g, c, 7); g.px(2, 12, 3, 3, d); g.px(11, 12, 3, 3, d); [13, 15, 17].forEach(y => g.px(5, y, 6, 1, d)); g.px(7, 12, 2, 1, '#F3F6FF'); g.dot(2, 13, '#FFD23F'); g.dot(13, 13, '#FFD23F'); g.px(5, 18, 6, 1, '#D2343A'); } });
  F('top', 't_angel', '천사 로브', 20, { draw: g => { const c = '#F7F9FF', d = '#D9DEF2'; torso(g, c); sleeves(g, c, 7); g.px(2, 17, 3, 2, c); g.px(11, 17, 3, 2, c); g.px(4, 19, 8, 5, c); g.px(5, 18, 6, 1, '#FFD23F'); g.px(7, 19, 1, 5, d); g.dot(5, 23, d); g.dot(10, 23, d); } });
  F('top', 't_devil', '꼬마 악마 옷', 18, { draw: g => { const c = '#D2343A'; torso(g, c); sleeves(g, c, 7); g.px(6, 13, 4, 4, shade(c, 0.15)); g.px(11, 19, 2, 1, c); g.dot(13, 20, c); g.px(13, 21, 2, 1, '#14182E'); g.dot(14, 20, '#14182E'); } });
  F('hat', 'hat_flower', '꽃 화관', 12, { draw: g => { [[4, '#FF7EB6'], [6, '#FFD23F'], [8, '#A66BFF'], [10, '#FF7EB6']].forEach(([x, k]) => { g.px(x, 1, 2, 2, k); g.dot(x, 1, shade(k, 0.4)); }); g.px(4, 3, 8, 1, '#3DDC84'); g.dot(3, 3, '#3DDC84'); g.dot(12, 3, '#3DDC84'); } });
  F('back', 'bk_phoenix', '불사조 날개', 60, { drawBack: g => { const r = '#FF5A3D', o = '#FF9A3D', y = '#FFD23F'; mirror(g, [[1, 9, 2], [0, 10, 4], [-1, 11, 5], [-1, 12, 5], [-1, 13, 5], [0, 14, 4], [-1, 15, 3], [0, 16, 2], [-1, 17, 1]], r); mirror(g, [[1, 11, 3], [0, 12, 4], [1, 13, 3], [1, 14, 2]], o); mirror(g, [[2, 12, 2], [2, 13, 1]], y); g.dot(2, 8, y); g.dot(13, 8, y); } });
  F('top', 't_elf', '엘프 잎사귀 옷', 16, { draw: g => { const c = '#3D8A3A', l = '#6BC25A'; torso(g, c); sleeves(g, c, 7); [[5, 13], [7, 14], [9, 13], [6, 16], [8, 17], [10, 16], [3, 15], [12, 15]].forEach(([x, y]) => g.dot(x, y, l)); g.px(5, 18, 6, 1, '#8A5A2B'); g.px(5, 19, 2, 1, c); g.px(9, 19, 2, 1, c); } });
  F('hat', 'hat_elfhood', '엘프 후드', 12, { draw: g => { const c = '#3D8A3A'; hood(g, c); g.px(6, 0, 4, 1, c); g.dot(7, -1, c); g.dot(4, 2, shade(c, 0.3)); g.dot(3, 4, shade(c, 0.3)); } });

  A('hat', 'hat_bunnyhood', '토끼 후드', 8, { draw: g => { const c = '#FFA8CF'; hood(g, c); g.px(4, -1, 2, 3, c); g.px(10, -1, 2, 3, c); g.dot(4, 0, '#FFFFFF'); g.dot(11, 0, '#FFFFFF'); } });
  A('hat', 'hat_bear', '곰 후드', 8, { draw: g => { const c = '#9A5B2E'; hood(g, c); g.px(3, 0, 2, 2, c); g.px(11, 0, 2, 2, c); g.dot(4, 1, '#E8B98A'); g.dot(11, 1, '#E8B98A'); } });
  A('top', 't_bear', '곰 잠옷', 10, { draw: g => { const c = '#9A5B2E'; torso(g, c); sleeves(g, c, 7); g.px(6, 13, 4, 5, '#E8B98A'); } });
  A('hat', 'hat_penguin', '펭귄 후드', 8, { draw: g => { const c = '#1E2236'; hood(g, c); g.px(7, 1, 2, 1, '#FFD23F'); g.dot(5, 2, '#FFFFFF'); g.dot(10, 2, '#FFFFFF'); } });
  A('top', 't_penguin', '펭귄 잠옷', 10, { draw: g => { const c = '#1E2236'; torso(g, c); sleeves(g, c, 7); g.px(6, 12, 4, 7, '#F7F9FF'); g.dot(5, 18, '#F7F9FF'); g.dot(10, 18, '#F7F9FF'); } });
  A('hat', 'hat_tophat', '눈사람 중절모', 10, { draw: g => { const c = '#1E2236'; g.px(5, -1, 6, 4, c); g.px(3, 3, 10, 1, c); g.px(5, 2, 6, 1, '#D2343A'); } });
  A('top', 't_snowman', '눈사람 옷', 12, { draw: g => { const w = '#F7F9FF'; torso(g, w); sleeves(g, '#8A5A2B', 2); g.px(3, 14, 1, 1, '#8A5A2B'); g.px(12, 14, 1, 1, '#8A5A2B'); g.px(5, 12, 6, 1, '#D2343A'); g.px(5, 13, 6, 1, '#3D8A3A'); g.px(9, 14, 2, 2, '#D2343A'); [15, 17].forEach(y => g.dot(7, y, '#1E2236')); } });
  A('hat', 'hat_gat', '갓', 15, { draw: g => { const c = '#1A1A22'; g.px(5, -1, 6, 4, c); g.px(1, 3, 14, 1, c); g.px(5, 2, 6, 1, '#3A3F55'); g.dot(5, 4, '#3A3F55'); g.dot(10, 4, '#3A3F55'); } });

  /* ================= 배경 (부위 'bg') =================
   * 아바타 뒤에 깔리는 18 × 29칸 도트 그림. 옷장·상점 미리보기·홈·내 전적의 '내 아바타'에만 보이고,
   * 랭킹·게임(배구·격투) 화면에는 그리지 않습니다. scene(p) 의 p(x, y, w, h, 색) 으로 칸을 칠함 (0,0 = 왼쪽 위) */
  const BG = (id, name, price, theme, scene) => add('bg', id, name, price, { theme, scene });
  const rows = (p, list) => { let y = 0; list.forEach(([h, c]) => { p(0, y, GW, h, c); y += h; }); };   // 위에서부터 띠 칠하기
  const dots = (p, pts, c) => pts.forEach(([x, y]) => p(x, y, 1, 1, c));
  BG('bg_sky', '맑은 하늘', 0, null, p => { rows(p, [[6, '#7FC8F5'], [8, '#9ED6F8'], [9, '#BFE6FB'], [6, '#7CCB6A']]); p(1, 4, 5, 2, '#FFFFFF'); p(2, 3, 3, 1, '#FFFFFF'); p(12, 8, 5, 2, '#FFFFFF'); p(13, 7, 2, 1, '#FFFFFF'); p(0, 23, GW, 1, '#5BAE4E'); });
  BG('bg_class', '우리 교실', 0, 'school', p => { rows(p, [[21, '#F2E6C9'], [1, '#B98A55'], [7, '#D9A86A']]); p(1, 3, 16, 8, '#2F6B4F'); p(1, 3, 16, 1, '#8A5A2B'); p(1, 11, 16, 1, '#8A5A2B'); dots(p, [[3, 5], [4, 5], [5, 6], [9, 5], [11, 7], [12, 7], [13, 7]], '#E8F5EC'); p(14, 12, 2, 1, '#FFFFFF'); for (let x = 0; x < GW; x += 3) p(x, 23, 1, 6, '#C99558'); });
  BG('bg_gym', '학교 체육관', 10, 'school', p => { rows(p, [[3, '#6B4A8A'], [16, '#E9D3A8'], [10, '#D99A55']]); for (let x = 1; x < GW; x += 4) p(x, 3, 2, 3, '#FFF6D0'); p(13, 8, 4, 3, '#FFFFFF'); p(14, 11, 2, 1, '#FF7A1A'); p(0, 19, GW, 1, '#B5753A'); p(0, 24, GW, 1, '#FFFFFF'); dots(p, [[2, 26], [9, 22], [15, 27]], '#C2803F'); });
  BG('bg_sunset', '노을 지는 도시', 15, 'school', p => { rows(p, [[5, '#5B3C88'], [5, '#B4529A'], [5, '#F07A6A'], [4, '#FFB46A'], [10, '#2A2442']]); p(11, 12, 4, 3, '#FFE08A'); [[0, 13, 3, 6], [3, 10, 3, 9], [7, 14, 2, 5], [9, 11, 3, 8], [13, 15, 2, 4], [15, 9, 3, 10]].forEach(([x, y, w, h]) => p(x, y, w, h, '#2A2442')); dots(p, [[1, 15], [4, 12], [4, 15], [10, 13], [16, 11], [16, 14]], '#FFD23F'); });
  BG('bg_night', '별 헤는 밤', 8, 'fantasy', p => { rows(p, [[10, '#141A3C'], [10, '#1E2A5A'], [9, '#2B3B6E']]); p(12, 2, 3, 3, '#FFF3B0'); p(13, 2, 2, 2, '#141A3C'); dots(p, [[2, 2], [6, 4], [9, 1], [3, 8], [16, 7], [7, 11], [1, 14], [15, 13], [10, 16]], '#FFFFFF'); p(0, 24, GW, 5, '#18213F'); p(2, 22, 4, 2, '#18213F'); p(11, 21, 5, 3, '#18213F'); });
  BG('bg_space', '우주 정거장', 25, 'fantasy', p => { rows(p, [[29, '#0B0E24']]); p(10, 3, 6, 6, '#A66BFF'); p(11, 2, 4, 1, '#A66BFF'); p(11, 9, 4, 1, '#A66BFF'); p(8, 6, 10, 1, '#FFD23F'); p(11, 4, 2, 2, '#C9A0FF'); dots(p, [[1, 1], [4, 5], [2, 11], [7, 13], [15, 15], [3, 18], [12, 19], [17, 22], [5, 24]], '#FFFFFF'); dots(p, [[6, 2], [14, 12], [1, 21]], '#7FC8F5'); p(1, 25, 3, 1, '#9AA3C7'); p(0, 26, 5, 1, '#9AA3C7'); });
  BG('bg_castle', '마법의 성', 30, 'fantasy', p => { rows(p, [[12, '#3B2E6E'], [8, '#5B4A9A'], [9, '#2E4A3A']]); p(5, 9, 8, 12, '#8A93C0'); p(3, 7, 3, 14, '#9AA3C7'); p(12, 7, 3, 14, '#9AA3C7'); p(3, 5, 3, 2, '#D2343A'); p(12, 5, 3, 2, '#D2343A'); p(4, 4, 1, 1, '#D2343A'); p(13, 4, 1, 1, '#D2343A'); p(8, 16, 2, 4, '#3A2457'); dots(p, [[4, 10], [13, 10], [7, 12], [10, 12]], '#FFE45C'); dots(p, [[1, 2], [16, 3], [9, 1]], '#FFFFFF'); });
  BG('bg_volcano', '용암 동굴', 40, 'fantasy', p => { rows(p, [[29, '#2A1414']]); for (let x = 0; x < GW; x += 3) p(x, 0, 2, 2 + (x % 4), '#3E1E1E'); p(0, 21, GW, 8, '#FF5A1F'); p(0, 21, GW, 1, '#FFD23F'); dots(p, [[3, 23], [9, 25], [14, 22], [6, 27], [16, 26]], '#FFD23F'); p(1, 18, 3, 3, '#3E1E1E'); p(14, 17, 4, 4, '#3E1E1E'); dots(p, [[5, 12], [12, 9], [8, 15]], '#FF9A3D'); });
  BG('bg_aurora', '오로라 설원', 45, 'fantasy', p => { rows(p, [[20, '#0E1A3A'], [9, '#E8F1FF']]); for (let x = 0; x < GW; x++) { const y = 4 + Math.round(Math.sin(x / 2.5) * 2); p(x, y, 1, 2, '#3DDC84'); p(x, y + 2, 1, 2, '#3BC8F5'); p(x, y - 1, 1, 1, '#A66BFF'); } dots(p, [[2, 1], [10, 2], [15, 12], [4, 14], [12, 16]], '#FFFFFF'); p(2, 18, 4, 2, '#C9D7FF'); p(12, 17, 5, 3, '#C9D7FF'); });
  BG('bg_sea', '여름 바다', 10, 'season', p => { rows(p, [[9, '#7FD4F5'], [3, '#BFEAFB'], [8, '#2F8FD8'], [9, '#F5DFA0']]); p(13, 2, 3, 3, '#FFE45C'); p(0, 12, GW, 1, '#FFFFFF'); dots(p, [[3, 15], [4, 15], [11, 17], [12, 17], [7, 14]], '#9ED8FF'); dots(p, [[2, 24], [10, 26], [15, 23]], '#E8C46A'); p(15, 22, 2, 1, '#FF5A5F'); });
  BG('bg_forest', '초록 숲', 8, 'season', p => { rows(p, [[12, '#BFE8C8'], [10, '#3D8A3A'], [7, '#6BC25A']]); [[0, 6], [5, 4], [11, 5], [15, 7]].forEach(([x, y]) => { p(x, y, 4, 5, '#2E6E30'); p(x + 1, y - 1, 2, 1, '#2E6E30'); p(x + 1, y + 5, 2, 3, '#7A4A2A'); }); dots(p, [[3, 25], [12, 24], [7, 27]], '#FFD23F'); dots(p, [[9, 26], [15, 27]], '#FF7EB6'); });
  BG('bg_cherry', '벚꽃길', 12, 'season', p => { rows(p, [[14, '#DDEBFF'], [7, '#F7C9DE'], [8, '#C9E6A8']]); p(0, 2, 6, 6, '#FFB3D1'); p(12, 1, 6, 7, '#FFB3D1'); p(2, 8, 2, 10, '#7A4A2A'); p(14, 8, 2, 10, '#7A4A2A'); dots(p, [[7, 4], [9, 9], [6, 13], [11, 16], [8, 20], [3, 22], [15, 24]], '#FF8FB8'); p(0, 22, GW, 1, '#E3B07A'); });
  BG('bg_snow', '눈 오는 마을', 12, 'season', p => { rows(p, [[20, '#AFC4E8'], [9, '#F3F6FF']]); p(1, 14, 6, 6, '#C98A55'); p(0, 12, 8, 2, '#D2343A'); p(3, 16, 2, 4, '#5A3418'); p(11, 13, 6, 7, '#E8C46A'); p(10, 11, 8, 2, '#3E6BFF'); p(13, 15, 2, 2, '#FFE45C'); dots(p, [[2, 2], [7, 5], [12, 3], [16, 8], [5, 9], [9, 1], [14, 6], [1, 7]], '#FFFFFF'); });
  BG('bg_rainbow', '무지개 언덕', 20, 'season', p => { rows(p, [[20, '#BFE6FB'], [9, '#7CCB6A']]); ['#FF5A5F', '#FF9A3D', '#FFD23F', '#3DDC84', '#3BC8F5', '#A66BFF'].forEach((c, i) => { for (let x = -2; x < GW + 2; x++) { const y = 3 + i + Math.round(((x - 8.5) / 6) ** 2 * 3); if (y < 20) p(x, y, 1, 1, c); } }); p(1, 15, 4, 2, '#FFFFFF'); p(13, 16, 4, 2, '#FFFFFF'); });

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
  /* ---------------- v39: 2배 정교한 그림 ----------------
   * 칸 그림(18×29)을 2배(36×58)로 다시 그림:
   *  ① Scale2x(EPX) — 계단 모양 대각선을 부드럽게 (머리·옷 둥근 곳이 매끈해짐)
   *  ② 명암 — 위쪽 테두리에 닿은 칸은 밝게, 아래·오른쪽에 닿은 칸은 어둡게 (입체감)
   *  ③ 눈 — 세로로 길게 + 반짝이는 흰 점
   *  옷·아이템 160종은 그대로 두고 그리는 방식만 바꿈 → 상점 아이템 모두 함께 정교해짐 */
  const shadeCache = {};
  const tone = (c, f) => { const k = c + f; return shadeCache[k] || (shadeCache[k] = shade(c, f)); };
  function epx(c) {
    const h = c.length, w = c[0].length, o = Array.from({ length: h * 2 }, () => Array(w * 2).fill(null));
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? c[y][x] : null);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = c[y][x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      let e0 = P, e1 = P, e2 = P, e3 = P;
      if (C === A && C !== D && A !== B) e0 = A;
      if (A === B && A !== C && B !== D) e1 = B;
      if (D === C && D !== B && C !== A) e2 = C;
      if (B === D && B !== A && D !== C) e3 = D;
      o[y * 2][x * 2] = e0; o[y * 2][x * 2 + 1] = e1; o[y * 2 + 1][x * 2] = e2; o[y * 2 + 1][x * 2 + 1] = e3;
    }
    return o;
  }
  function refine(c, face) {
    const o = epx(c), h = o.length, w = o[0].length, src = o.map(r => r.slice());
    const edge = v => v === null || v === OUT;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = src[y][x]; if (!v || v === OUT) continue;
      if (y > 0 && edge(src[y - 1][x])) o[y][x] = tone(v, 0.22);
      else if ((y < h - 1 && edge(src[y + 1][x])) || (x < w - 1 && edge(src[y][x + 1]))) o[y][x] = tone(v, -0.16);
    }
    // 테두리 얇게: 바깥쪽 테두리 줄(색칠된 칸과 닿지 않고 빈칸과 닿은 테두리)을 지움 → 2배 그림에서 1칸 두께
    const t2 = o.map(r => r.slice()), colored = v => v && v !== OUT;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (t2[y][x] !== OUT) continue;
      const n = [y > 0 ? t2[y - 1][x] : null, y < h - 1 ? t2[y + 1][x] : null, x > 0 ? t2[y][x - 1] : null, x < w - 1 ? t2[y][x + 1] : null];
      if (!n.some(colored) && n.some(v => v === null)) o[y][x] = null;
    }
    if (face) {   // 눈: 원래 (6,7)·(9,7) 칸이 눈동자 그대로일 때만 (선글라스 등으로 가려지지 않았을 때)
      [7, 10].forEach(ex => {
        if (c[8][ex] !== OUT || !c[8][ex - 1] || c[8][ex - 1] === OUT) return;
        const X = ex * 2, Y = 16;
        if (o[Y - 1][X] && o[Y - 1][X] !== OUT) { o[Y - 1][X] = OUT; o[Y - 1][X + 1] = OUT; }
        o[Y][X + 1] = '#FFFFFF';
      });
      // 입: 2배 그림에서 작은 웃는 입 (가운데 2칸 + 양끝 한 칸 위)
      const sk = c[11][8], m = c[10][8];
      if (sk && m && m !== sk && m !== OUT && c[10][9] === m && o[21] && o[21][17] === tone(m, -0.16) || (o[21] && o[21][17] === m)) {
        for (let x = 16; x <= 19; x++) { o[20][x] = sk; o[21][x] = sk; }
        o[21][17] = m; o[21][18] = m; o[20][16] = m; o[20][19] = m;
      }
    }
    return o;
  }
  const hiCache = new Map();
  function hires(av, frame) {
    const key = JSON.stringify(normalize(av)) + '|' + (frame || 0);
    if (hiCache.has(key)) return hiCache.get(key);
    const cells = refine(grid(av, frame), true), cv = document.createElement('canvas');
    cv.width = GW * 2; cv.height = GH * 2;
    const g = cv.getContext('2d');
    for (let y = 0; y < GH * 2; y++) for (let x = 0; x < GW * 2; x++) { const col = cells[y][x]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }
    hiCache.set(key, cv); if (hiCache.size > 300) hiCache.delete(hiCache.keys().next().value);
    return cv;
  }
  // ctx 에 (x, y) 위치부터 scale 배로 그림. crop: 'full' | 'bust'
  const CROP = { full: [0, 0, GW, GH], bust: [1, 0, 16, 16] };
  // 배경 그림 (18 × 29칸). 배경이 없으면 null
  function scene(av) {
    const it = av && av.bg && byId[av.bg];
    if (!it || !it.scene) return null;
    const cells = Array.from({ length: GH }, () => Array(GW).fill(null));
    it.scene((x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const gx = x + i, gy = y + j; if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) cells[gy][gx] = c; } });
    return epx(cells);
  }
  // opt.scene = true 이면 배경까지 그림 (옷장·상점·홈·내 전적의 내 아바타)
  function draw(ctx, av, x, y, scale, opt) {
    opt = opt || {};
    const [cx, cy, cw, ch] = CROP[opt.crop || 'full'], half = scale / 2;
    const sc = opt.scene ? scene(normalize(av)) : null;
    if (sc) for (let j = 0; j < ch * 2; j++) for (let i = 0; i < cw * 2; i++) {
      const col = sc[cy * 2 + j] && sc[cy * 2 + j][cx * 2 + i];
      if (col) { ctx.fillStyle = col; ctx.fillRect(x + i * half, y + j * half, Math.ceil(half), Math.ceil(half)); }
    }
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(hires(av, opt.frame), cx * 2, cy * 2, cw * 2, ch * 2, x, y, cw * scale, ch * scale);
    ctx.imageSmoothingEnabled = sm;
  }
  // 캔버스 크기를 맞춰서 그림
  function paint(canvas, av, opt) {
    opt = opt || {};
    const [, , cw, ch] = CROP[opt.crop || 'full'], s = opt.scale || 4;
    const dpr = 2;   // v39: 2배 그림이 고르게 보이게 항상 2배 해상도
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
      paint(c, av, { scale: +c.dataset.scale || 3, crop: c.dataset.crop || 'full', bg: c.dataset.bg || null, keepCss: c.hasAttribute('data-keepcss'), scene: c.hasAttribute('data-scene') });
    });
  }
  // 이름 등으로 항상 같은 모습이 나오는 무작위 아바타 (컴퓨터 상대·예시 플레이어)
  function random(seed) {
    let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
    const av = {};
    SLOTS.forEach(([slot]) => {
      const opts = I.filter(it => it.slot === slot && (slot !== 'skin' || it.price === 0 || rnd() < 0.3));
      av[slot] = slot === 'bg' || (OPTIONAL[slot] && rnd() < 0.5) ? null : opts[Math.floor(rnd() * opts.length)].id;
    });
    return av;
  }

  window.GoAvatar = {
    SLOTS, DEFAULT, OPTIONAL, ITEMS: I, byId,
    THEMES: [['all', '전체'], ['basic', '기본'], ['school', '학교·일상'], ['job', '직업'], ['fantasy', '판타지'], ['season', '동물·계절']], size: { w: GW, h: GH },
    normalize, grid, scene, draw, paint, paintAll, random, legs, refine, hires, OUT,
    freeIds: () => I.filter(it => it.price === 0).map(it => it.id),
    attr: av => JSON.stringify(normalize(av)).replace(/"/g, '&quot;')   // HTML 속성용
  };
})();
