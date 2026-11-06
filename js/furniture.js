/*
 * gogo?gogo! — 내 방 가구 (GoFurn, v88)
 *  - 가구 · 벽 장식 · 벽지 · 바닥 · 옷장 목록과 가격(체험 모드용. 온라인은 Supabase shop_items 표 = supabase/room_v88.sql)
 *  - 그림은 모두 코드로 그림 (아이소메트릭: 바닥 1칸 = 가로 48 · 세로 24, 높이는 px). Meshy 그림이 생기면 img 로 바꿀 수 있음
 *  - 가격: 가구 5~60P · 옷장 30~80P · 기본(0P)은 모두가 가짐
 *  - slot: furn(바닥 가구) · rug(바닥에 까는 것, 위로 걸어 다님) · wall(벽 장식) · wallpaper · floor · wardrobe
 */
(function () {
  'use strict';
  const TW = 24, TH = 12;            // 칸 반쪽 크기 (가로 48 · 세로 24)
  const O = '#1D2340';               // 테두리 (남색)
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  }

  /* ---------- 그리기 도구 ----------
   *  pen(ctx, ox, oy): 바닥 (0,0) 칸 위 꼭짓점이 화면 (ox, oy)
   *  P(i, j, z): 바닥 좌표 → 화면 / box: 상자(위 · 왼쪽 앞(+j) · 오른쪽 앞(+i) 면) / face: 상자 면에 사각형 */
  function pen(c, ox, oy) {
    const P = (i, j, z) => [ox + (i - j) * TW, oy + (i + j) * TH - (z || 0)];
    const poly = (pts, fill, line) => { c.beginPath(); pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (line !== false) { c.strokeStyle = line || O; c.lineWidth = 1; c.stroke(); } };
    const box = (i, j, w, d, h, z, col, o) => {
      o = o || {}; z = z || 0;
      const top = o.top || col, L = o.left || shade(col, -0.14), R = o.right || shade(col, -0.3);
      poly([P(i, j + d, z), P(i + w, j + d, z), P(i + w, j + d, z + h), P(i, j + d, z + h)], L, o.line);     // 왼쪽 앞 (+j)
      poly([P(i + w, j, z), P(i + w, j + d, z), P(i + w, j + d, z + h), P(i + w, j, z + h)], R, o.line);     // 오른쪽 앞 (+i)
      poly([P(i, j, z + h), P(i + w, j, z + h), P(i + w, j + d, z + h), P(i, j + d, z + h)], top, o.line);  // 위
    };
    // face: 'j' = +j 면(j=J, i a0~a1) · 'i' = +i 면(i=I, j a0~a1) · 'top' = 높이 z 의 바닥 모양 (a0~a1 × b0~b1)
    const face = (kind, at, a0, a1, z0, z1, col, line) => {
      if (kind === 'j') poly([P(a0, at, z0), P(a1, at, z0), P(a1, at, z1), P(a0, at, z1)], col, line);
      else poly([P(at, a0, z0), P(at, a1, z0), P(at, a1, z1), P(at, a0, z1)], col, line);
    };
    const flat = (i0, j0, i1, j1, z, col, line) => poly([P(i0, j0, z), P(i1, j0, z), P(i1, j1, z), P(i0, j1, z)], col, line);
    const dot = (i, j, z, r, col) => { const p = P(i, j, z); c.fillStyle = col; c.fillRect(Math.round(p[0] - r), Math.round(p[1] - r), r * 2, r * 2); };
    const ellipse = (i, j, z, rx, ry, col, line) => { const p = P(i, j, z); c.beginPath(); c.ellipse(p[0], p[1], rx, ry, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); if (line !== false) { c.strokeStyle = line || O; c.lineWidth = 1; c.stroke(); } };
    return { c, P, poly, box, face, flat, dot, ellipse };
  }
  /* 가구 하나를 놓인 자리 (i, j) · 돌림 r(0/1) 에 맞게 그리는 도구
   *  가구 그림 함수는 '가구 좌표'(u = 가로, v = 깊이, 앞면 = +v) 로 그림 → r=1 이면 u↔v 를 바꿔 앞면이 오른쪽(+i)을 봄 */
  function local(g, i0, j0, r) {
    const ij = (u, v) => (r ? [i0 + v, j0 + u] : [i0 + u, j0 + v]);
    const sz = (w, d) => (r ? [d, w] : [w, d]);
    return {
      g, r,
      box(u, v, w, d, h, z, col, o) { const [i, j] = ij(u, v), [wi, dj] = sz(w, d); g.box(i, j, wi, dj, h, z, col, o); },
      // 앞면(+v) 위의 사각형: v=V 면, u 가 a0~a1, 높이 z0~z1
      front(V, a0, a1, z0, z1, col, line) { if (r) g.face('i', i0 + V, j0 + a0, j0 + a1, z0, z1, col, line); else g.face('j', j0 + V, i0 + a0, i0 + a1, z0, z1, col, line); },
      // 옆면(+u) 위의 사각형
      side(U, b0, b1, z0, z1, col, line) { if (r) g.face('j', j0 + U, i0 + b0, i0 + b1, z0, z1, col, line); else g.face('i', i0 + U, j0 + b0, j0 + b1, z0, z1, col, line); },
      flat(u0, v0, u1, v1, z, col, line) { const [a, b] = ij(u0, v0), [c2, d2] = ij(u1, v1); g.flat(Math.min(a, c2), Math.min(b, d2), Math.max(a, c2), Math.max(b, d2), z, col, line); },
      dot(u, v, z, rr, col) { const [i, j] = ij(u, v); g.dot(i, j, z, rr, col); },
      ell(u, v, z, rx, ry, col, line) { const [i, j] = ij(u, v); g.ellipse(i, j, z, rx, ry, col, line); },
      P(u, v, z) { const [i, j] = ij(u, v); return g.P(i, j, z); },
      poly: g.poly, c: g.c
    };
  }

  /* ---------- 목록 ----------
   *  [id, 이름, 가격, 분류, 가로, 깊이, 높이(클릭 범위), 그림 함수(L, k), 동작]
   *  동작: sleep(눕기) · sit(앉기) · light(켜고 끄기) · screen(화면 켜기) · music(음악) · play(놀기) · wardrobe(옷장) · window(낮/밤) */
  const W = '#C8925A', W2 = '#8A5A34', WHITE = '#F4F0E8', RED = '#E8505A', BLUE = '#4A8AE8', PINK = '#FF9AC0', MINT = '#7FE0C4', YEL = '#FFD23F', GRN = '#3EA85A', NAVY = '#2A3266', GRAY = '#9AA8C8';
  const legs = (L, w, d, h, col) => { [[0.06, 0.06], [w - 0.18, 0.06], [0.06, d - 0.18], [w - 0.18, d - 0.18]].forEach(([u, v]) => L.box(u, v, 0.12, 0.12, h, 0, col)); };
  const FURN = [
    // 침대
    ['f_bed1', '나무 침대', 0, 'bed', 1, 2, 30, (L, k) => { L.box(0, 0, 1, 0.12, 28, 0, k || W); L.box(0, 0.12, 1, 1.88, 10, 0, k || W); L.box(0.05, 0.12, 0.9, 1.83, 6, 10, WHITE); L.box(0.12, 0.16, 0.76, 0.42, 5, 16, '#FFFFFF'); L.box(0.05, 0.66, 0.9, 1.29, 3, 16, BLUE); }, 'sleep'],
    ['f_bed2', '포근한 2인 침대', 45, 'bed', 2, 2, 32, (L, k) => { L.box(0, 0, 2, 0.14, 34, 0, W2); L.box(0, 0.14, 2, 1.86, 10, 0, W2); L.box(0.06, 0.14, 1.88, 1.8, 7, 10, WHITE); L.box(0.15, 0.18, 0.75, 0.42, 6, 17, '#FFFFFF'); L.box(1.1, 0.18, 0.75, 0.42, 6, 17, '#FFFFFF'); L.box(0.06, 0.7, 1.88, 1.24, 3, 17, k || PINK); }, 'sleep'],
    ['f_bunk', '이층 침대', 55, 'bed', 1, 2, 70, (L, k) => { L.box(0, 0, 1, 2, 8, 0, W); L.box(0.05, 0.05, 0.9, 1.9, 5, 8, k || MINT); L.box(0, 0, 0.12, 0.12, 66, 0, W2); L.box(0.88, 0, 0.12, 0.12, 66, 0, W2); L.box(0, 1.88, 0.12, 0.12, 66, 0, W2); L.box(0.88, 1.88, 0.12, 0.12, 66, 0, W2); L.box(0, 0, 1, 2, 6, 40, W); L.box(0.05, 0.05, 0.9, 1.9, 5, 46, k || MINT); L.front(2, 0.3, 0.7, 50, 54, W2); }, 'sleep'],
    // 책상 · 탁자
    ['f_desk', '공부 책상', 0, 'desk', 2, 1, 34, (L, k) => { legs(L, 2, 1, 26, W2); L.box(0, 0, 2, 1, 4, 26, k || W); L.box(1.2, 0.08, 0.7, 0.84, 18, 8, k || W); L.front(0.92, 1.3, 1.8, 12, 22, shade(k || W, 0.15)); L.box(0.2, 0.2, 0.35, 0.25, 6, 30, RED); L.box(0.6, 0.2, 0.3, 0.2, 4, 30, BLUE); }, null],
    ['f_pcdesk', '컴퓨터 책상', 40, 'desk', 2, 1, 56, (L, k) => { legs(L, 2, 1, 26, NAVY); L.box(0, 0, 2, 1, 4, 26, k || '#E8ECF8'); L.box(0.55, 0.15, 0.9, 0.1, 22, 30, '#2A2E40'); L.front(0.25, 0.6, 1.4, 33, 50, '#5AD0FF'); L.box(0.6, 0.45, 0.8, 0.3, 2, 30, '#3A3E50'); L.box(1.6, 0.4, 0.2, 0.3, 3, 30, '#3A3E50'); }, 'screen'],
    ['f_lowtable', '좌식 탁자', 10, 'desk', 2, 1, 16, (L, k) => { legs(L, 2, 1, 10, W2); L.box(0, 0, 2, 1, 5, 10, k || W); L.box(0.7, 0.3, 0.3, 0.3, 6, 15, WHITE); L.box(1.2, 0.35, 0.25, 0.25, 5, 15, YEL); }, null],
    ['f_round', '동그란 테이블', 15, 'desk', 1, 1, 30, (L, k) => { L.box(0.42, 0.42, 0.16, 0.16, 26, 0, W2); L.box(0.3, 0.3, 0.4, 0.4, 3, 0, W2); L.ell(0.5, 0.5, 28, 22, 11, k || WHITE); L.ell(0.45, 0.45, 32, 5, 4, RED); }, null],
    // 의자 · 소파
    ['f_chair', '나무 의자', 0, 'chair', 1, 1, 36, (L, k) => { L.box(0, 0, 0.7, 0.12, 38, 0, k || W); legs(L, 0.7, 0.7, 14, W2); L.box(0, 0.12, 0.7, 0.58, 4, 14, k || W); }, 'sit'],
    ['f_sofa', '폭신 소파', 30, 'chair', 2, 1, 32, (L, k) => { k = k || '#E86A5A'; L.box(0, 0, 2, 0.28, 26, 0, k); L.box(0, 0.28, 2, 0.72, 10, 0, shade(k, -0.25)); L.box(0.22, 0.28, 1.56, 0.67, 6, 10, k); L.box(0, 0.28, 0.22, 0.72, 18, 0, k); L.box(1.78, 0.28, 0.22, 0.72, 18, 0, k); }, 'sit'],
    ['f_beanbag', '빈백', 20, 'chair', 1, 1, 22, (L, k) => { L.ell(0.5, 0.5, 6, 20, 12, shade(k || YEL, -0.2)); L.ell(0.5, 0.45, 14, 17, 10, k || YEL); L.ell(0.38, 0.35, 18, 6, 3, shade(k || YEL, 0.4), false); }, 'sit'],
    ['f_rocking', '흔들의자', 25, 'chair', 1, 1, 40, (L, k) => { L.box(0, 0.05, 0.08, 0.9, 4, 0, W2); L.box(0.62, 0.05, 0.08, 0.9, 4, 0, W2); L.box(0, 0, 0.7, 0.12, 42, 0, k || W); legs(L, 0.7, 0.8, 14, W2); L.box(0, 0.12, 0.7, 0.68, 4, 14, k || W); L.box(0.05, 0.18, 0.6, 0.52, 3, 18, RED); }, 'sit'],
    // 수납
    ['f_shelf', '책장', 20, 'storage', 1, 1, 82, (L, k) => { k = k || W; L.box(0, 0.1, 1, 0.9, 80, 0, k); const BK = [RED, BLUE, GRN, YEL, PINK, NAVY, MINT]; [8, 30, 52].forEach((z, n) => { L.front(1, 0.08, 0.92, z, z + 18, shade(k, -0.45)); for (let b = 0; b < 6; b++) L.front(1, 0.12 + b * 0.13, 0.22 + b * 0.13, z, z + 12 + ((b + n) % 3) * 2, BK[(b + n * 2) % BK.length], false); }); }, null],
    ['f_drawer', '서랍장', 15, 'storage', 1, 1, 40, (L, k) => { k = k || WHITE; L.box(0, 0.15, 1, 0.85, 38, 0, k); [4, 16, 28].forEach(z => { L.front(1, 0.08, 0.92, z, z + 9, shade(k, -0.08)); L.front(1, 0.45, 0.55, z + 4, z + 6, W2, false); }); L.box(0.6, 0.35, 0.18, 0.18, 10, 38, GRN); }, null],
    ['f_rack', '수납 선반', 12, 'storage', 2, 1, 48, (L, k) => { k = k || '#B8C4E8'; legs(L, 2, 0.6, 46, NAVY); [4, 22, 40].forEach(z => L.box(0, 0, 2, 0.6, 3, z, k)); L.box(0.2, 0.1, 0.4, 0.4, 12, 7, RED); L.box(1.2, 0.1, 0.5, 0.4, 10, 25, YEL); L.box(0.6, 0.1, 0.3, 0.4, 8, 43, GRN); }, null],
    ['f_chest', '보물 상자', 35, 'storage', 1, 1, 26, (L, k) => { k = k || '#9A5A2A'; L.box(0.1, 0.2, 0.8, 0.6, 16, 0, k); L.box(0.1, 0.2, 0.8, 0.6, 8, 16, shade(k, 0.15)); L.front(0.8, 0.1, 0.9, 12, 16, YEL); L.front(0.8, 0.42, 0.58, 8, 18, YEL); }, 'play'],
    // 조명
    ['f_lamp', '책상 스탠드', 12, 'light', 1, 1, 34, (L, k) => { L.box(0.3, 0.3, 0.4, 0.4, 3, 0, NAVY); L.box(0.45, 0.45, 0.1, 0.1, 22, 3, NAVY); L.box(0.25, 0.25, 0.5, 0.5, 9, 24, k || YEL); }, 'light'],
    ['f_floorlamp', '플로어 램프', 18, 'light', 1, 1, 70, (L, k) => { L.box(0.3, 0.3, 0.4, 0.4, 3, 0, W2); L.box(0.45, 0.45, 0.1, 0.1, 50, 3, W2); L.box(0.2, 0.2, 0.6, 0.6, 16, 52, k || '#FFF0C8'); }, 'light'],
    ['f_starlamp', '별빛 무드등', 30, 'light', 1, 1, 30, (L, k) => { L.box(0.3, 0.3, 0.4, 0.4, 4, 0, NAVY); L.ell(0.5, 0.5, 16, 12, 12, k || '#B8A8FF'); L.dot(0.45, 0.45, 18, 1.5, '#FFFFFF'); L.dot(0.6, 0.4, 13, 1, '#FFFFFF'); L.dot(0.4, 0.62, 12, 1, '#FFFFFF'); }, 'light'],
    // 식물
    ['f_pot', '작은 화분', 0, 'plant', 1, 1, 26, (L, k) => { L.box(0.32, 0.32, 0.36, 0.36, 10, 0, k || '#C8603A'); L.ell(0.5, 0.5, 16, 10, 8, GRN); L.ell(0.42, 0.45, 20, 6, 5, shade(GRN, 0.25), false); }, null],
    ['f_tree', '큰 나무 화분', 15, 'plant', 1, 1, 72, (L, k) => { L.box(0.28, 0.28, 0.44, 0.44, 14, 0, k || WHITE); L.box(0.46, 0.46, 0.08, 0.08, 26, 14, W2); L.ell(0.5, 0.5, 48, 18, 16, GRN); L.ell(0.5, 0.5, 62, 13, 11, shade(GRN, 0.15)); L.ell(0.42, 0.42, 66, 6, 5, shade(GRN, 0.35), false); }, null],
    ['f_cactus', '선인장', 8, 'plant', 1, 1, 34, (L, k) => { L.box(0.34, 0.34, 0.32, 0.32, 8, 0, k || '#E8B060'); L.box(0.44, 0.44, 0.12, 0.12, 24, 8, GRN); L.box(0.56, 0.46, 0.08, 0.08, 10, 18, GRN); L.box(0.36, 0.46, 0.08, 0.08, 8, 14, GRN); L.dot(0.5, 0.5, 33, 2, PINK); }, null],
    ['f_vase', '꽃병', 10, 'plant', 1, 1, 30, (L, k) => { L.box(0.4, 0.4, 0.2, 0.2, 14, 0, k || BLUE); [[0.4, 0.45, RED], [0.55, 0.42, YEL], [0.48, 0.58, PINK]].forEach(([u, v, cc]) => { L.box(u + 0.02, v + 0.02, 0.03, 0.03, 10, 14, GRN, { line: false }); L.dot(u, v, 26, 2.5, cc); }); }, null],
    // 가전 · 놀이
    ['f_tv', '텔레비전', 40, 'elec', 2, 1, 44, (L, k) => { L.box(0, 0.3, 2, 0.7, 14, 0, k || W2); L.box(0.2, 0.45, 1.6, 0.12, 30, 14, '#2A2E40'); L.front(0.57, 0.3, 1.7, 17, 41, '#3A6AA8'); }, 'screen'],
    ['f_console', '게임기', 50, 'elec', 1, 1, 18, (L, k) => { L.box(0.15, 0.25, 0.7, 0.5, 6, 0, k || '#E8ECF8'); L.box(0.2, 0.3, 0.25, 0.4, 2, 6, RED); L.box(0.55, 0.3, 0.25, 0.4, 2, 6, BLUE); L.dot(0.5, 0.5, 9, 1.5, '#5AFF8A'); }, 'play'],
    ['f_speaker', '스피커', 25, 'elec', 1, 1, 46, (L, k) => { k = k || '#3A3E50'; L.box(0.25, 0.3, 0.5, 0.45, 44, 0, k); L.front(0.75, 0.3, 0.7, 26, 40, shade(k, -0.4)); L.front(0.75, 0.35, 0.65, 8, 20, shade(k, -0.4)); }, 'music'],
    ['f_fridge', '작은 냉장고', 35, 'elec', 1, 1, 56, (L, k) => { k = k || '#B8E8FF'; L.box(0.1, 0.15, 0.8, 0.85, 54, 0, k); L.front(1, 0.15, 0.85, 34, 35, shade(k, -0.35)); L.front(1, 0.72, 0.78, 38, 50, NAVY, false); L.front(1, 0.72, 0.78, 12, 28, NAVY, false); }, 'play'],
    ['f_piano', '업라이트 피아노', 60, 'elec', 2, 1, 58, (L, k) => { k = k || '#2A2238'; L.box(0, 0, 2, 0.55, 56, 0, k); L.box(0.05, 0.55, 1.9, 0.3, 4, 26, k); L.flat(0.1, 0.6, 1.9, 0.8, 30, '#FFFFFF'); for (let x = 0.2; x < 1.85; x += 0.15) L.flat(x, 0.6, x + 0.06, 0.7, 30.5, '#1D2340', false); L.box(0.2, 0.62, 0.12, 0.2, 24, 0, k); L.box(1.68, 0.62, 0.12, 0.2, 24, 0, k); }, 'music'],
    ['f_fishtank', '어항', 45, 'elec', 2, 1, 50, (L, k) => { L.box(0, 0.2, 2, 0.8, 22, 0, k || W2); L.box(0.05, 0.25, 1.9, 0.7, 26, 22, '#8AD8FF', { top: '#C8F0FF' }); L.dot(0.6, 0.8, 38, 2.5, '#FF8A3D'); L.dot(1.3, 0.7, 32, 2.5, YEL); L.box(1.6, 0.4, 0.06, 0.06, 14, 22, GRN, { line: false }); }, 'play'],
    // 바닥에 까는 것 (그 위로 걸어 다님)
    ['r_round', '동그란 러그', 10, 'rug', 2, 2, 2, (L, k) => { L.ell(1, 1, 0, 40, 20, k || '#B8A8FF'); L.ell(1, 1, 0.5, 28, 14, shade(k || '#B8A8FF', 0.3), false); }, null],
    ['r_stripe', '줄무늬 러그', 12, 'rug', 2, 3, 2, (L, k) => { k = k || '#7FE0C4'; L.flat(0, 0, 2, 3, 0, k); for (let v = 0.3; v < 3; v += 0.6) L.flat(0, v, 2, v + 0.25, 0.3, shade(k, 0.35), false); }, null],
    ['r_heart', '하트 러그', 20, 'rug', 2, 2, 2, (L, k) => { const c = L.c, p = L.P(1, 1.05, 0); c.save(); c.translate(p[0], p[1]); c.scale(1, 0.55); c.beginPath(); c.moveTo(0, 28); c.bezierCurveTo(-46, -4, -26, -38, 0, -14); c.bezierCurveTo(26, -38, 46, -4, 0, 28); c.closePath(); c.fillStyle = k || PINK; c.fill(); c.strokeStyle = O; c.lineWidth = 1.6; c.stroke(); c.restore(); }, null],
    // 장식
    ['f_bear', '곰 인형', 15, 'deco', 1, 1, 30, (L, k) => { k = k || '#C8925A'; L.ell(0.5, 0.55, 8, 9, 8, k); L.ell(0.5, 0.5, 20, 8, 7, k); L.ell(0.38, 0.45, 26, 3, 3, k); L.ell(0.62, 0.45, 26, 3, 3, k); L.dot(0.47, 0.55, 20, 1, O); L.dot(0.56, 0.5, 20, 1, O); L.dot(0.55, 0.6, 7, 2, RED); }, 'play'],
    ['f_trophy', '트로피 장식장', 30, 'deco', 1, 1, 60, (L, k) => { k = k || W2; L.box(0.1, 0.3, 0.8, 0.7, 58, 0, k); L.front(1, 0.15, 0.85, 4, 54, '#C8F0FF'); L.dot(0.4, 0.75, 44, 3, YEL); L.dot(0.65, 0.75, 26, 3, '#E8E8F0'); L.dot(0.45, 0.75, 10, 3, '#E8A050'); }, null],
    ['f_doghouse', '강아지 집', 40, 'deco', 1, 1, 46, (L, k) => { k = k || RED; L.box(0.05, 0.05, 0.9, 0.9, 26, 0, '#F4E8C8'); L.box(0, 0, 1, 1, 6, 26, k); L.box(0.15, 0.15, 0.7, 0.7, 8, 32, k); L.front(0.95, 0.3, 0.7, 0, 18, '#3A2A20'); }, 'play'],
    ['f_basket', '농구 골대', 35, 'deco', 1, 1, 80, (L, k) => { L.box(0.35, 0.35, 0.3, 0.3, 6, 0, NAVY); L.box(0.46, 0.46, 0.08, 0.08, 62, 6, '#9AA8C8'); L.box(0.2, 0.42, 0.6, 0.08, 26, 52, '#FFFFFF'); L.ell(0.5, 0.75, 58, 8, 4, 'rgba(0,0,0,0)', k || '#FF6A3D'); }, 'play'],
    // 벽 장식 (벽에 붙음: 가로 길이 w 칸 · 높이 z0~z1)
    ['w_window', '창문', 0, 'wall', 1, 0, 0, null, 'window', { z0: 50, z1: 100, kind: 'window' }],
    ['w_bigwin', '큰 창문', 30, 'wall', 2, 0, 0, null, 'window', { z0: 40, z1: 110, kind: 'window', arch: true }],
    ['w_frame', '그림 액자', 10, 'wall', 1, 0, 0, null, null, { z0: 70, z1: 100, kind: 'frame' }],
    ['w_clock', '벽시계', 12, 'wall', 1, 0, 0, null, null, { z0: 90, z1: 118, kind: 'clock' }],
    ['w_poster', '게임 포스터', 8, 'wall', 1, 0, 0, null, null, { z0: 60, z1: 104, kind: 'poster' }],
    ['w_shelf', '벽 선반', 12, 'wall', 2, 0, 0, null, null, { z0: 72, z1: 80, kind: 'shelf' }],
    ['w_mirror', '거울', 18, 'wall', 1, 0, 0, null, null, { z0: 30, z1: 104, kind: 'mirror' }],
    ['w_board', '화이트보드', 15, 'wall', 2, 0, 0, null, null, { z0: 60, z1: 100, kind: 'board' }],
    // v92 벽 장식 30종 (그림은 SPR)
    ['w_rmirror', '원형 거울', 10, 'wall', 1, 0, 0, null, null, { z0: 74, z1: 112, kind: 'spr' }],
    ['w_heartgar', '하트 가랜드', 12, 'wall', 2, 0, 0, null, null, { z0: 98, z1: 126, kind: 'spr' }],
    ['w_hangplant', '행잉 플랜트', 15, 'wall', 1, 0, 0, null, null, { z0: 62, z1: 128, kind: 'spr' }],
    ['w_neon', '네온 사인', 25, 'wall', 2, 0, 0, null, null, { z0: 72, z1: 108, kind: 'spr' }],
    ['w_map', '세계 지도', 20, 'wall', 2, 0, 0, null, null, { z0: 70, z1: 108, kind: 'spr' }],
    ['w_calendar', '미니 달력', 8, 'wall', 1, 0, 0, null, null, { z0: 74, z1: 104, kind: 'spr' }],
    ['w_memo', '메모판', 12, 'wall', 2, 0, 0, null, null, { z0: 66, z1: 104, kind: 'spr' }],
    ['w_rclock', '둥근 벽시계', 10, 'wall', 1, 0, 0, null, null, { z0: 86, z1: 120, kind: 'spr' }],
    ['w_dart', '다트판', 15, 'wall', 1, 0, 0, null, null, { z0: 76, z1: 112, kind: 'spr' }],
    ['w_rose', '넝쿨 장미', 18, 'wall', 1, 0, 0, null, null, { z0: 52, z1: 128, kind: 'spr' }],
    ['w_scissor', '가위와 빗 장식', 12, 'wall', 1, 0, 0, null, null, { z0: 70, z1: 110, kind: 'spr' }],
    ['w_retro', '레트로 포스터', 10, 'wall', 1, 0, 0, null, null, { z0: 62, z1: 108, kind: 'spr' }],
    ['w_sea', '바다 그림 액자', 15, 'wall', 1, 0, 0, null, null, { z0: 72, z1: 106, kind: 'spr' }],
    ['w_starlight', '별자리 조명', 22, 'wall', 2, 0, 0, null, null, { z0: 96, z1: 126, kind: 'spr' }],
    ['w_dream', '드림캐처', 18, 'wall', 1, 0, 0, null, null, { z0: 58, z1: 118, kind: 'spr' }],
    ['w_dollshelf', '선반 위 인형', 15, 'wall', 2, 0, 0, null, null, { z0: 70, z1: 104, kind: 'spr' }],
    ['w_album', '음악 앨범', 12, 'wall', 2, 0, 0, null, null, { z0: 70, z1: 110, kind: 'spr' }],
    ['w_wreath', '크리스마스 리스', 20, 'wall', 1, 0, 0, null, null, { z0: 76, z1: 116, kind: 'spr' }],
    ['w_doodle', '낙서 화이트보드', 15, 'wall', 2, 0, 0, null, null, { z0: 62, z1: 102, kind: 'spr' }],
    ['w_rainbow', '무지개 스티커', 10, 'wall', 2, 0, 0, null, null, { z0: 82, z1: 114, kind: 'spr' }],
    ['w_tv', '벽걸이 TV', 30, 'wall', 2, 0, 0, null, null, { z0: 62, z1: 104, kind: 'spr' }],
    ['w_fan', '소형 선풍기', 15, 'wall', 1, 0, 0, null, null, { z0: 62, z1: 112, kind: 'spr' }],
    ['w_vinelight', '넝쿨 조명', 18, 'wall', 2, 0, 0, null, null, { z0: 92, z1: 126, kind: 'spr' }],
    ['w_scroll', '동양화 족자', 20, 'wall', 1, 0, 0, null, null, { z0: 40, z1: 122, kind: 'spr' }],
    ['w_bookshelf', '도서 선반', 15, 'wall', 2, 0, 0, null, null, { z0: 70, z1: 102, kind: 'spr' }],
    ['w_plane', '종이비행기', 8, 'wall', 2, 0, 0, null, null, { z0: 80, z1: 116, kind: 'spr' }],
    ['w_cutlery', '수저 세트 장식', 12, 'wall', 1, 0, 0, null, null, { z0: 64, z1: 112, kind: 'spr' }],
    ['w_bag', '아기자기한 가방', 15, 'wall', 1, 0, 0, null, null, { z0: 52, z1: 110, kind: 'spr' }],
    ['w_catclock', '고양이 벽시계', 20, 'wall', 1, 0, 0, null, null, { z0: 44, z1: 122, kind: 'spr' }],
    ['w_flags', '화려한 깃발', 15, 'wall', 2, 0, 0, null, null, { z0: 96, z1: 126, kind: 'spr' }]
  ];
  // 벽지 · 바닥 (기본 0P)
  const WALLS = [['wp_basic', '하얀 벽', 0, '#F4F0E8', null], ['wp_sky', '하늘색 벽', 10, '#BDE6FF', null], ['wp_pink', '분홍 벽', 10, '#FFD6E6', null], ['wp_mint', '민트 벽', 10, '#C8F5E4', null],
    ['wp_stripe', '줄무늬 벽지', 15, '#FFF0C8', 'stripe'], ['wp_check', '체크 벽지', 15, '#E8E0FF', 'check'], ['wp_star', '별 벽지', 20, '#3A3E7A', 'star'], ['wp_wood', '나무 판자 벽', 20, '#D8A870', 'plank'],
    ['wp_hanok', '한옥 창호 벽', 30, '#F4E8C8', 'hanok'], ['wp_space', '우주 벽지', 40, '#1E1A40', 'space']];
  const FLOORS = [['fl_wood', '나무 바닥', 0, '#D8A870', 'plank'], ['fl_light', '밝은 나무', 10, '#EED2A0', 'plank'], ['fl_carpet', '파란 카펫', 10, '#8AAAE8', null], ['fl_check', '체크 타일', 15, '#F4F0E8', 'check'],
    ['fl_marble', '대리석', 25, '#E8E8F0', 'marble'], ['fl_grass', '잔디', 20, '#7FC86A', 'grass'], ['fl_tatami', '다다미', 20, '#C8D88A', 'tatami'], ['fl_cloud', '구름 바닥', 30, '#C8E8FF', 'cloud'],
    ['fl_star', '별빛 바닥', 40, '#2A2E5A', 'star'], ['fl_maru', '한옥 마루', 30, '#C88A50', 'maru']];
  // 옷장 (방에 꼭 하나 · 누르면 옷 갈아입기). img = Meshy 그림(있으면): img/room/<id>_closed.png · _open.png
  const WARDROBES = [['wd_basic', '나무 옷장', 0, '#C8925A'], ['wd_white', '하얀 옷장', 30, '#F4F0E8'], ['wd_pink', '공주 옷장', 50, '#FFB0CC'], ['wd_space', '우주 옷장', 80, '#3A3E7A']];

  // v91 방 음악 (각 게임 BGM · 50P 통일). [id, 이름, 파일]
  const MUSIC = [['m_battle', '블록 대전 · 신호등 구구단', 'games/puzzle/battle/bgm/bgm.mp3'], ['m_p512', '퍼즐512', 'games/puzzle/p512/bgm/bgm.mp3'], ['m_ultimate', '퍼즐512 랭킹 대전', 'games/puzzle/ultimate/bgm/bgm.mp3'],
    ['m_mines', '지뢰찾기', 'games/puzzle/mines/bgm/bgm.mp3'], ['m_snake', '스네이크', 'games/arcade/snake/bgm/bgm.mp3'], ['m_baduk', '바둑', 'games/board/baduk/bgm/bgm.mp3'], ['m_omok', '오목', 'games/board/omok/bgm/bgm.mp3'],
    ['m_janggi', '장기', 'games/board/janggi/bgm/bgm.mp3'], ['m_chess', '체스', 'games/board/chess/bgm/bgm.mp3'], ['m_alkkagi', '장기 알까기', 'games/board/alkkagi/bgm/bgm.mp3'], ['m_code', '숫자 코드', 'games/board/code/bgm/bgm.mp3'],
    ['m_volley', '아바타 배구', 'games/sports/volley/bgm/bgm.mp3'], ['m_tennis', '아바타 테니스', 'games/sports/tennis/bgm/bgm.mp3'], ['m_fight', '일단 덤벼', 'games/sports/fight/bgm/bgm.mp3'],
    ['m_rpg', 'skillcom RPG', 'games/action/rpg/bgm/bgm.mp3'], ['m_scfight', 'Skillcom Fight', 'games/action/scfight/bgm/bgm.mp3'], ['m_mecha', '메카 대전', 'games/action/mecha/bgm/bgm.mp3'], ['m_sky', '6.25. 하늘', 'games/shooting/sky/bgm/bgm.mp3']];
  const ITEMS = [], byId = {};
  FURN.forEach(([id, name, price, cat, w, d, h, draw, act, wall]) => { const it = { id, name, price, slot: cat === 'wall' ? 'wall' : cat === 'rug' ? 'rug' : 'furn', cat, w, d, h, draw, act, wall }; ITEMS.push(it); byId[id] = it; });
  WALLS.forEach(([id, name, price, color, pat]) => { const it = { id, name, price, slot: 'wallpaper', cat: 'wallpaper', color, pat }; ITEMS.push(it); byId[id] = it; });
  FLOORS.forEach(([id, name, price, color, pat]) => { const it = { id, name, price, slot: 'floor', cat: 'floor', color, pat }; ITEMS.push(it); byId[id] = it; });
  WARDROBES.forEach(([id, name, price, color]) => { const it = { id, name, price, slot: 'wardrobe', cat: 'wardrobe', color, w: 1, d: 1, h: 96, act: 'wardrobe' }; ITEMS.push(it); byId[id] = it; });
  const CATS = [['furn', '가구'], ['wall', '벽 장식'], ['rug', '러그'], ['wardrobe', '옷장'], ['wallpaper', '벽지'], ['floor', '바닥']];
  MUSIC.forEach(([id, name, file]) => { const it = { id, name: name + ' 음악', game: name, price: 50, slot: 'music', cat: 'music', file }; ITEMS.push(it); byId[id] = it; });
  const SHOP_CATS = CATS.concat([['music', '음악']]);

  /* ---------- 옷장 그림 (코드) ---------- open: 0(닫힘) ~ 1(활짝) */
  const wdImgs = {};
  function wdImg(id, open) {
    const key = id + (open ? '_open' : '_closed');
    if (!(key in wdImgs)) { wdImgs[key] = null; const im = new Image(); im.onload = () => { wdImgs[key] = im; window.dispatchEvent(new Event('gogo:img')); }; im.onerror = () => { wdImgs[key] = false; }; im.src = 'img/room/' + key + '.png?v=88'; }
    return wdImgs[key] || null;
  }
  function drawWardrobe(g, it, i, j, r, open) {
    const im = wdImg(it.id, open > 0.5);
    if (im) {   // Meshy 그림 (img/room/<id>_closed|open.png, 200px 폭): 그림 왼쪽 = 칸의 왼쪽 끝 · 그림 아래 = 칸의 맨 아래 꼭짓점
      const left = g.P(i, j + 1, 0)[0], right = g.P(i + 1, j, 0)[0], bottom = g.P(i + 1, j + 1, 0)[1] + 6;
      const bodyW = (right - left) * 1.06, w = bodyW * 200 / 168, hh = im.naturalHeight * w / im.naturalWidth;
      g.c.save();
      if (r) { const cx = (left + right) / 2; g.c.translate(cx * 2, 0); g.c.scale(-1, 1); }
      g.c.drawImage(im, left - bodyW * 0.03, bottom - hh, w, hh); g.c.restore(); return;
    }
    const L = local(g, i, j, r), k = it.color, h = 92;   // 그림을 받기 전: 간단한 상자
    L.box(0, 0.15, 1, 0.85, h, 0, k);
    if (open > 0.5) { L.front(1, 0.06, 0.94, 6, h - 6, '#3A2A3A'); [RED, BLUE, YEL, PINK, GRN].forEach((cc, n) => L.front(1, 0.12 + n * 0.16, 0.24 + n * 0.16, h - 50, h - 14, cc)); }
    else { L.front(1, 0.05, 0.5, 6, h - 4, shade(k, 0.05)); L.front(1, 0.5, 0.95, 6, h - 4, shade(k, 0.05)); }
  }

  /* ---------- 벽 장식 그림 ---------- side 'R' = 뒤 오른쪽 벽(j=0 면) · 'L' = 뒤 왼쪽 벽(i=0 면) · t = 벽을 따라 칸 위치 */
  /* v92 벽 장식 30종 — 벽 면에 붙인 평면 그림 (가로 = 칸 수 × 32, 세로 = z1 - z0, 왼쪽 위가 0,0) */
  function sprPen(c) {
    const st = (line, lw) => { if (line !== false) { c.strokeStyle = line || O; c.lineWidth = lw || 1.4; c.stroke(); } };
    const fl = col => { if (col) { c.fillStyle = col; c.fill(); } };
    return {
      c,
      R: (x, y, w, h, col, line, rr) => { c.beginPath(); if (rr && c.roundRect) c.roundRect(x, y, w, h, rr); else c.rect(x, y, w, h); fl(col); st(line); },
      C: (x, y, r, col, line) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); fl(col); st(line); },
      E: (x, y, rx, ry, col, line, rot) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); fl(col); st(line); },
      P: (pts, col, line) => { c.beginPath(); pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); fl(col); st(line); },
      L: (pts, col, lw) => { c.beginPath(); pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.strokeStyle = col || O; c.lineWidth = lw || 1.2; c.stroke(); },
      Q: (x0, y0, cx, cy, x1, y1, col, lw) => { c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.strokeStyle = col || O; c.lineWidth = lw || 1.2; c.stroke(); },
      heart: (x, y, s, col) => { c.beginPath(); c.moveTo(x, y + s); c.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.8, y - s * 1.4, x, y - s * 0.4); c.bezierCurveTo(x + s * 0.8, y - s * 1.4, x + s * 1.6, y - s * 0.1, x, y + s); c.closePath(); fl(col); st(O, 1); },
      star: (x, y, r, col) => { c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); fl(col); st(O, 1); },
      glow: (x, y, r, col) => { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); },
      T: (s, x, y, size, col, bold) => { c.font = `${bold ? 900 : 700} ${size}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(s, x, y); }
    };
  }
  const SILVER = '#C8D4EC', WOOD = '#B8783E', PAPER = '#F4E8C8';
  // 줄에 매달린 것 (가랜드 · 조명 · 깃발): 처진 줄 위의 점들
  const sag = (W, n, dip) => Array.from({ length: n }, (_, k) => { const x = W * (k + 0.5) / n, t = x / W; return [x, 4 + dip * 4 * t * (1 - t)]; });
  const clockHands = (d, x, y, r) => { const now = new Date(), hA = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2, mA = now.getMinutes() / 60 * Math.PI * 2; d.L([[x, y], [x + Math.sin(hA) * r * 0.5, y - Math.cos(hA) * r * 0.5]], O, 1.8); d.L([[x, y], [x + Math.sin(mA) * r * 0.78, y - Math.cos(mA) * r * 0.78]], O, 1.2); d.C(x, y, 1.4, O, false); };
  const SPR = {
    w_rmirror(d, W, H) { d.C(W / 2, H / 2, 15, WOOD); d.C(W / 2, H / 2, 11.5, '#D8F0FF'); d.L([[W / 2 - 6, H / 2 - 2], [W / 2 - 1, H / 2 - 7]], '#FFFFFF', 2); d.L([[W / 2 - 4, H / 2 + 2], [W / 2 + 3, H / 2 - 5]], '#FFFFFF', 1.2); },
    w_heartgar(d, W, H) { d.Q(0, 3, W / 2, 16, W, 3, '#8A5A34', 1); const C = ['#B07CFF', '#FF8A3D', '#FFD23F', '#7FE0C4', '#FF6AA8', '#7FB8FF']; sag(W, 6, 9).forEach(([x, y], k) => { d.L([[x, y], [x, y + 5]], '#8A5A34', 0.8); d.heart(x, y + 10, 4.2, C[k]); }); },
    w_hangplant(d, W, H) { const x = W / 2; d.L([[x, 0], [x - 9, 34]], '#8A5A34', 0.8); d.L([[x, 0], [x + 9, 34]], '#8A5A34', 0.8); d.C(x, 2, 2, '#E8A050'); [[-9, 26], [-4, 22], [3, 21], [9, 25], [0, 28]].forEach(([u, v]) => d.E(x + u, v, 5.5, 3.5, '#3EA85A', O, u / 20)); d.P([[x - 11, 32], [x + 11, 32], [x + 8, 46], [x - 8, 46]], '#D87A4A'); d.R(x - 12, 30, 24, 4, '#E89A6A'); [[-9, 50], [-6, 58], [6, 54], [9, 62], [0, 60]].forEach(([u, v]) => { d.L([[x + u * 0.6, 44], [x + u, v]], '#2A8A4A', 1); d.E(x + u, v, 3, 2, '#5AC86A', O, 1); }); },
    w_neon(d, W, H, s) { d.R(4, 6, W - 8, H - 12, '#1D2340', '#4AD8FF', 4); d.c.save(); d.c.shadowColor = '#FF4AA8'; d.c.shadowBlur = s && s.night ? 12 : 6; d.T('L', 14, H / 2, 17, '#FF6AC0', true); d.heart(26, H / 2 - 1, 5, '#FF4A8A'); d.T('VE', 46, H / 2, 17, '#FF6AC0', true); d.c.restore(); d.L([[8, 10], [W - 8, 10]], 'rgba(74,216,255,.5)', 1); },
    w_map(d, W, H) { d.P([[2, 4], [W - 2, 2], [W - 3, H - 3], [3, H - 2]], PAPER, '#8A5A34'); d.R(6, 7, W - 12, H - 14, '#EAD8A8', false); [[14, 13, 7, 5], [16, 25, 4, 7], [31, 12, 6, 4], [33, 24, 5, 7], [47, 14, 9, 5], [52, 28, 4, 3]].forEach(([x, y, rx, ry]) => d.E(x, y, rx, ry, '#B8925A', false)); d.L([[6, H / 2], [W - 6, H / 2]], 'rgba(138,90,52,.4)', 0.6); d.L([[W / 2, 7], [W / 2, H - 7]], 'rgba(138,90,52,.4)', 0.6); d.star(W - 10, H - 10, 3, '#E8505A'); },
    w_calendar(d, W, H) { d.R(5, 6, W - 10, H - 8, '#FFFFFF', O, 2); d.R(5, 6, W - 10, 8, '#E8505A', O, 2); d.C(11, 6, 1.6, '#FFFFFF'); d.C(W - 11, 6, 1.6, '#FFFFFF'); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) d.R(8 + k * 4.4, 17 + r * 4.4, 3, 3, (r * 4 + k) === 6 ? '#E8505A' : '#C8D4EC', false); },
    w_memo(d, W, H) { d.R(2, 2, W - 4, H - 4, '#8A5A34', O, 2); d.R(6, 6, W - 12, H - 12, '#D8A464', false); [[12, 10, '#FFF3B0'], [28, 13, '#BDE6FF'], [44, 9, '#FFD6E6'], [16, 24, '#C8F5E4'], [38, 24, '#FFFFFF']].forEach(([x, y, col], k) => { d.R(x, y, 11, 10, col, O); d.L([[x + 2, y + 5], [x + 9, y + 5]], 'rgba(29,35,64,.5)', 0.7); d.C(x + 5.5, y + 1.5, 1.6, ['#E8505A', '#4A8AE8', '#3EA85A', '#FFD23F', '#B07CFF'][k], false); }); },
    w_rclock(d, W, H) { d.C(W / 2, H / 2, 15, '#E8505A'); d.C(W / 2, H / 2, 11.5, '#FFFFFF'); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; d.C(W / 2 + Math.sin(a) * 9.5, H / 2 - Math.cos(a) * 9.5, k % 3 ? 0.6 : 1.1, O, false); } clockHands(d, W / 2, H / 2, 10); },
    w_dart(d, W, H) { const x = W / 2, y = H / 2; [[15, '#1D2340'], [12.5, '#F4E8C8'], [10, '#E8505A'], [7.5, '#F4E8C8'], [5, '#3EA85A'], [2.2, '#E8505A']].forEach(([r, col]) => d.C(x, y, r, col, r === 15 ? O : false)); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; d.L([[x, y], [x + Math.cos(a) * 12.5, y + Math.sin(a) * 12.5]], 'rgba(29,35,64,.35)', 0.6); } [[x + 3, y - 2, '#FF8A3D'], [x - 4, y + 4, '#4A8AE8']].forEach(([px, py, col]) => { d.L([[px, py], [px + 9, py - 6]], O, 1.2); d.P([[px + 8, py - 6], [px + 12, py - 9], [px + 11, py - 4]], col, false); }); },
    w_rose(d, W, H) { d.c.beginPath(); d.c.moveTo(4, 4); d.c.bezierCurveTo(30, 20, 2, 40, 26, 58); d.c.bezierCurveTo(34, 64, 18, 70, 14, H - 2); d.c.strokeStyle = '#2A8A4A'; d.c.lineWidth = 1.8; d.c.stroke(); [[8, 9], [20, 18], [12, 30], [20, 44], [26, 56], [20, 66]].forEach(([x, y], k) => { d.E(x + (k % 2 ? -5 : 5), y + 2, 3.5, 2, '#3EA85A', O, k % 2 ? -0.6 : 0.6); }); [[14, 12], [10, 26], [23, 40], [17, 54], [24, 66]].forEach(([x, y]) => { d.C(x, y, 4, '#E84A5A'); d.C(x, y, 2, '#B82A3A', false); d.C(x - 1, y - 1, 0.8, '#FF9AA8', false); }); },
    w_scissor(d, W, H) { d.C(8, 30, 3.5, null, '#E86AA8'); d.c.lineWidth = 2; d.C(14, 31, 3.5, null, '#E86AA8'); d.P([[9, 26], [12, 26], [7, 4], [6, 5]], SILVER); d.P([[12, 26], [14, 27], [13, 5], [11, 4]], SILVER); d.R(19, 4, 5, 34, '#C8925A', O, 2); for (let y = 7; y < 36; y += 3) d.L([[24, y], [27, y]], '#8A5A34', 1.2); },
    w_retro(d, W, H) { d.R(4, 2, W - 8, H - 4, '#2A3266', O); d.R(6, 4, W - 12, H - 8, '#3A4A9A', false); d.R(6, H - 14, W - 12, 10, '#3EA85A', false); d.P([[W / 2, 9], [W / 2 + 4, 17], [W / 2 + 4, 28], [W / 2 - 4, 28], [W / 2 - 4, 17]], '#FFFFFF'); d.C(W / 2, 19, 1.8, '#4AD8FF', false); d.P([[W / 2 - 4, 24], [W / 2 - 8, 30], [W / 2 - 4, 28]], '#E8505A', false); d.P([[W / 2 + 4, 24], [W / 2 + 8, 30], [W / 2 + 4, 28]], '#E8505A', false); d.P([[W / 2 - 3, 28], [W / 2, 35], [W / 2 + 3, 28]], '#FF8A3D', false); [[9, 9], [22, 12], [10, 22]].forEach(([x, y]) => d.C(x, y, 0.9, '#FFF3B0', false)); d.R(10, H - 11, 12, 3, '#FFD23F', false); },
    w_sea(d, W, H) { d.R(3, 3, W - 6, H - 6, '#6A4026', O); d.R(6, 6, W - 12, H - 12, '#BDE6FF', false); d.c.beginPath(); d.c.moveTo(6, H - 6); d.c.lineTo(6, 22); d.c.quadraticCurveTo(14, 8, 22, 16); d.c.quadraticCurveTo(17, 14, 18, 20); d.c.quadraticCurveTo(22, 24, W - 6, 20); d.c.lineTo(W - 6, H - 6); d.c.closePath(); d.c.fillStyle = '#2A6AC8'; d.c.fill(); d.Q(8, 20, 14, 10, 21, 15, '#FFFFFF', 1.4); d.L([[8, H - 11], [W - 8, H - 12]], '#8AC8FF', 1); d.C(W - 11, 11, 2.5, '#FFF3B0', false); },
    w_starlight(d, W, H, s) { d.Q(0, 3, W / 2, 14, W, 3, '#8A5A34', 0.8); sag(W, 5, 7).forEach(([x, y], k) => { const yy = y + 6 + (k % 2) * 5; d.L([[x, y], [x, yy - 4]], '#8A5A34', 0.6); if (s && s.night) d.glow(x, yy, 9, 'rgba(255,240,150,.8)'); d.star(x, yy, 4.2, '#FFD23F'); }); },
    w_dream(d, W, H) { const x = W / 2; d.L([[x, 0], [x, 4]], '#8A5A34', 0.8); d.C(x, 14, 10, null, '#C8925A'); d.c.lineWidth = 2; d.C(x, 14, 10, null, '#C8925A'); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; d.L([[x + Math.cos(a) * 10, 14 + Math.sin(a) * 10], [x + Math.cos(a + 2.1) * 4, 14 + Math.sin(a + 2.1) * 4]], '#E8D4A8', 0.6); } d.C(x, 14, 1.4, '#7FE0C4', false); [[-7, '#7FE0C4'], [0, '#FF9AC0'], [7, '#4A8AE8']].forEach(([u, col], k) => { const top = k === 1 ? 24 : 21; d.L([[x + u * 0.8, top], [x + u, top + 10]], '#8A5A34', 0.6); d.E(x + u, top + 18, 2.6, 7, col, O); d.L([[x + u, top + 12], [x + u, top + 25]], 'rgba(29,35,64,.4)', 0.5); }); },
    w_dollshelf(d, W, H) { const y = H - 7; d.R(2, y, W - 4, 4, '#B8783E', O); d.P([[8, y + 4], [12, y + 4], [8, y + 9]], '#8A5A34'); d.P([[W - 12, y + 4], [W - 8, y + 4], [W - 8, y + 9]], '#8A5A34'); d.C(15, y - 7, 7, '#C8925A'); d.C(15, y - 17, 5.5, '#C8925A'); d.C(11, y - 21, 2, '#C8925A'); d.C(19, y - 21, 2, '#C8925A'); d.C(13, y - 18, 0.8, O, false); d.C(17, y - 18, 0.8, O, false); d.E(15, y - 15, 2, 1.4, '#E8C8A0', false); d.E(30, y - 6, 6, 6, '#FFD6E6'); d.C(30, y - 15, 5, '#FFD6E6'); d.E(27.5, y - 24, 1.6, 5, '#FFD6E6', O); d.E(32.5, y - 24, 1.6, 5, '#FFD6E6', O); d.C(28.5, y - 15.5, 0.7, O, false); d.C(31.5, y - 15.5, 0.7, O, false); d.C(46, y - 5, 5, '#E8A050'); d.C(46, y - 12, 4, '#E8A050'); d.C(43, y - 15, 1.5, '#E8A050'); d.C(49, y - 15, 1.5, '#E8A050'); d.R(52, y - 8, 7, 8, '#FFD23F', O); },
    w_album(d, W, H) { d.R(4, 4, 26, 26, '#E8505A', O); d.C(17, 17, 9, '#1D2340'); d.C(17, 17, 3, '#FFD23F', false); d.C(36, 18, 12, '#1D2340'); d.C(36, 18, 8, null, '#3A4270'); d.C(36, 18, 3.5, '#FF8A3D', false); d.R(34, 12, 26, 26, '#F4E8C8', O); d.C(47, 25, 7, '#4A8AE8', false); d.T('♪', 47, 25, 9, '#FFFFFF', true); },
    w_wreath(d, W, H) { const x = W / 2, y = H / 2 + 2; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; d.E(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 5, 3.5, k % 2 ? '#2A8A4A' : '#3EA85A', O, a + 1.2); } [[0.3], [1.6], [2.9], [4.4], [5.4]].forEach(([a]) => d.C(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 1.6, '#E8303A', false)); d.P([[x, y - 12], [x - 8, y - 17], [x - 8, y - 8]], '#E8505A'); d.P([[x, y - 12], [x + 8, y - 17], [x + 8, y - 8]], '#E8505A'); d.C(x, y - 12, 2.4, '#C8303A'); d.C(x - 3, y - 6, 2.4, '#FFD23F'); d.C(x + 3, y - 6, 2.4, '#FFD23F'); },
    w_doodle(d, W, H) { d.R(2, 2, W - 4, H - 6, '#FFFFFF', '#5A6A9A', 2); d.R(10, H - 5, W - 20, 2, '#8AA0D0', false); d.C(16, 14, 6, null, '#E8505A'); d.Q(13, 15, 16, 19, 19, 15, '#E8505A', 1); d.C(14, 12, 0.7, '#E8505A', false); d.C(18, 12, 0.7, '#E8505A', false); d.L([[28, 22], [32, 12], [36, 22], [40, 12], [44, 22]], '#4A8AE8', 1.2); d.L([[52, 30], [52, 18]], '#8A5A34', 1.4); d.C(52, 15, 5, null, '#3EA85A'); d.L([[10, 30], [22, 30], [18, 26]], '#B07CFF', 1.2); d.R(W - 14, H - 9, 8, 2.5, '#E8505A', false); },
    w_rainbow(d, W, H) { const x = W / 2, y = H - 6; ['#E8505A', '#FF8A3D', '#FFD23F', '#3EA85A', '#4A8AE8', '#B07CFF'].forEach((col, k) => { d.c.beginPath(); d.c.arc(x, y, 24 - k * 3, Math.PI, 0); d.c.strokeStyle = col; d.c.lineWidth = 3.2; d.c.stroke(); }); [[x - 22, y], [x + 22, y]].forEach(([cx, cy]) => { d.C(cx - 4, cy, 4, '#FFFFFF', '#BDE6FF'); d.C(cx + 4, cy, 4, '#FFFFFF', '#BDE6FF'); d.C(cx, cy - 3, 5, '#FFFFFF', '#BDE6FF'); }); },
    w_tv(d, W, H, s) { d.R(2, 3, W - 4, H - 8, '#1D2340', O, 2); const g2 = d.c.createLinearGradient(0, 6, 0, H - 8); g2.addColorStop(0, '#3A5AC8'); g2.addColorStop(1, '#7FE0C4'); d.R(5, 6, W - 10, H - 14, g2, false); d.C(16, 22, 4, '#FFF3B0', false); d.P([[5, H - 8], [22, 24], [36, H - 8]], '#3EA85A', false); d.P([[28, H - 8], [44, 20], [W - 5, H - 8]], '#2A8A4A', false); d.R(W / 2 - 3, H - 5, 6, 3, '#1D2340', false); },
    w_fan(d, W, H) { const x = W / 2, y = 16; d.R(x - 5, H - 8, 10, 6, '#2A9A9A', O, 2); d.R(x - 1.5, y + 10, 3, H - 34, '#2A9A9A', O); d.C(x, y, 13, '#BDF0EC', '#2A9A9A'); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + (Date.now() / 150 % 6.3); d.E(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 6, 3, '#7FE0C4', O, a); } d.C(x, y, 2.5, '#2A9A9A'); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; d.L([[x + Math.cos(a) * 4, y + Math.sin(a) * 4], [x + Math.cos(a) * 13, y + Math.sin(a) * 13]], 'rgba(42,154,154,.5)', 0.6); } },
    w_vinelight(d, W, H, s) { d.Q(0, 3, W / 2, 16, W, 3, '#2A8A4A', 1); d.Q(0, 8, W / 2, 26, W, 8, '#2A8A4A', 1); [...sag(W, 6, 9), ...sag(W, 5, 13).map(([x, y]) => [x, y + 5])].forEach(([x, y], k) => { if (k % 2) d.E(x + 2, y, 2.4, 1.3, '#3EA85A', false, 0.6); if (s && s.night) d.glow(x, y + 4, 7, 'rgba(255,236,150,.85)'); d.E(x, y + 4, 2, 2.8, '#FFE68A', O); }); },
    w_scroll(d, W, H) { const x0 = 5, x1 = W - 5; d.L([[W / 2, 0], [x0 + 2, 6], [W / 2, 0], [x1 - 2, 6]], '#8A5A34', 0.7); d.R(x0 - 2, 5, x1 - x0 + 4, 3, '#6A4026', O, 1); d.R(x0, 8, x1 - x0, H - 15, '#F4EBD4', O); d.R(x0 + 3, 12, x1 - x0 - 6, H - 23, '#FAF4E4', false); d.P([[x0 + 3, H - 20], [x0 + 9, H - 40], [x0 + 13, H - 30], [x0 + 18, H - 50], [x1 - 3, H - 22]], '#3A4270', false); d.P([[x0 + 6, H - 20], [x0 + 12, H - 32], [x0 + 16, H - 24], [x1 - 6, H - 20]], '#7A86B0', false); d.C(x1 - 8, 22, 3, '#E8505A', false); d.L([[x0 + 5, 18], [x0 + 5, 34]], '#3A4270', 1); d.L([[x0 + 8, 20], [x0 + 8, 30]], '#3A4270', 1); d.R(x0 - 2, H - 7, x1 - x0 + 4, 3.5, '#6A4026', O, 1); },
    w_bookshelf(d, W, H) { const y = H - 7; d.R(2, y, W - 4, 4, '#8A5A34', O); d.P([[10, y + 4], [14, y + 4], [10, y + 9]], '#6A4026'); d.P([[W - 14, y + 4], [W - 10, y + 4], [W - 10, y + 9]], '#6A4026'); const BK = ['#E8505A', '#4A8AE8', '#3EA85A', '#FFD23F', '#B07CFF', '#FF8A3D', '#2A3266', '#7FE0C4']; let x = 6; BK.forEach((col, k) => { const w = 4 + (k % 3), h = 16 + ((k * 5) % 7); d.R(x, y - h, w, h, col, O); d.L([[x + 1, y - h + 3], [x + w - 1, y - h + 3]], 'rgba(255,255,255,.6)', 0.6); x += w + 0.4; }); d.P([[x + 1, y], [x + 4, y], [x + 14, y - 16], [x + 11, y - 18]], '#E86AA8'); d.R(W - 12, y - 7, 6, 7, '#FFD23F', O); },
    w_plane(d, W, H) { d.c.setLineDash([2, 2]); d.Q(8, H - 6, 26, H - 2, 40, 18, '#4A8AE8', 1); d.c.setLineDash([]); d.R(3, H - 18, 13, 9, '#FFF3B0', O); d.L([[3, H - 18], [9.5, H - 13], [16, H - 18]], '#E8505A', 0.8); d.P([[38, 18], [W - 4, 6], [48, 26]], '#FFFFFF'); d.P([[38, 18], [W - 4, 6], [46, 20]], '#BDE6FF'); d.P([[46, 20], [W - 4, 6], [48, 26]], '#8AC8FF'); },
    w_cutlery(d, W, H) { d.E(8, 9, 3.5, 6, SILVER); d.R(7, 14, 2, 30, SILVER, O, 1); d.R(13, 3, 1.2, 9, SILVER, false); d.R(15.5, 3, 1.2, 9, SILVER, false); d.R(18, 3, 1.2, 9, SILVER, false); d.R(13, 10, 6.2, 4, SILVER, O, 1); d.R(15, 14, 2.2, 30, SILVER, O, 1); d.P([[23, 3], [27, 3], [27, 22], [23, 24]], SILVER); d.R(23, 23, 3, 21, '#8A5A34', O, 1); },
    w_bag(d, W, H) { const x = W / 2; d.C(x, 3, 2, '#C8925A'); d.L([[x, 3], [x - 9, 34], [x, 3], [x + 9, 34]], '#E86AA8', 1.6); d.R(x - 12, 32, 24, 22, '#FFB0CC', O, 4); d.P([[x - 12, 34], [x + 12, 34], [x + 12, 42], [x, 46], [x - 12, 42]], '#FF8AB8'); d.C(x, 45, 2, '#FFD23F'); d.heart(x + 6, 50, 2.2, '#FFFFFF'); },
    w_catclock(d, W, H) { const x = W / 2, sw = Math.sin(Date.now() / 300) * 4; d.c.beginPath(); d.c.moveTo(x, 50); d.c.quadraticCurveTo(x + sw, 62, x + sw * 1.5 + 4, H - 4); d.c.strokeStyle = '#1D2340'; d.c.lineWidth = 3; d.c.stroke(); d.E(x, 40, 8, 13, '#1D2340'); d.C(x, 14, 10, '#1D2340'); d.P([[x - 9, 10], [x - 8, 1], [x - 3, 6]], '#1D2340'); d.P([[x + 9, 10], [x + 8, 1], [x + 3, 6]], '#1D2340'); const ey = Math.sin(Date.now() / 300) * 1.2; d.E(x - 4, 12, 2.6, 2.2, '#FFD23F', false); d.E(x + 4, 12, 2.6, 2.2, '#FFD23F', false); d.C(x - 4 + ey, 12, 1, '#1D2340', false); d.C(x + 4 + ey, 12, 1, '#1D2340', false); d.C(x, 40, 5.5, '#FFFFFF', '#FFD23F'); clockHands(d, x, 40, 5); },
    w_flags(d, W, H) { d.Q(0, 3, W / 2, 14, W, 3, '#8A5A34', 0.8); const C = ['#E8505A', '#FFD23F', '#3EA85A', '#4A8AE8', '#B07CFF', '#FF8A3D', '#7FE0C4']; sag(W, 7, 9).forEach(([x, y], k) => { d.P([[x - 4.2, y - 1], [x + 4.2, y - 1], [x, y + 11]], C[k]); d.C(x, y + 3, 0.9, '#FFFFFF', false); }); }
  };
  function drawWallItem(g, it, side, t, state) {
    const S = it.wall, w = it.w, e = 0.04;
    const Q = (a0, a1, z0, z1, col, line) => { if (side === 'R') g.face('j', e, t + a0, t + a1, z0, z1, col, line); else g.face('i', e, t + a0, t + a1, z0, z1, col, line); };
    const z0 = S.z0, z1 = S.z1;
    if (S.kind === 'window') {
      Q(0.05, w - 0.05, z0 - 3, z1 + 3, '#FFFFFF');
      Q(0.12, w - 0.12, z0, z1, state && state.night ? '#2A2E6A' : '#9ADCFF');
      if (state && state.night) { Q(0.3, 0.36, z1 - 16, z1 - 12, '#FFF3B0', false); Q(w - 0.4, w - 0.34, z1 - 30, z1 - 26, '#FFFFFF', false); }
      else Q(0.2, 0.5, z1 - 20, z1 - 12, '#FFFFFF', false);
      Q(w / 2 - 0.03, w / 2 + 0.03, z0, z1, '#FFFFFF', false); Q(0.12, w - 0.12, (z0 + z1) / 2 - 1.5, (z0 + z1) / 2 + 1.5, '#FFFFFF', false);
      Q(0, w, z0 - 6, z0 - 3, '#E8E0D0');
    } else if (S.kind === 'frame') { Q(0.12, 0.88, z0, z1, W2); Q(0.2, 0.8, z0 + 4, z1 - 4, '#BDE6FF'); Q(0.2, 0.8, z0 + 4, z0 + 12, GRN, false); Q(0.55, 0.65, z1 - 14, z1 - 8, YEL, false); }
    else if (S.kind === 'clock') { const p = side === 'R' ? g.P(t + 0.5, e, (z0 + z1) / 2) : g.P(e, t + 0.5, (z0 + z1) / 2); g.c.beginPath(); g.c.ellipse(p[0], p[1], 11, 13, 0, 0, Math.PI * 2); g.c.fillStyle = '#FFFFFF'; g.c.fill(); g.c.strokeStyle = O; g.c.lineWidth = 2; g.c.stroke(); const now = new Date(), hA = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2, mA = now.getMinutes() / 60 * Math.PI * 2; g.c.lineWidth = 1.5; g.c.beginPath(); g.c.moveTo(p[0], p[1]); g.c.lineTo(p[0] + Math.sin(hA) * 6, p[1] - Math.cos(hA) * 6); g.c.moveTo(p[0], p[1]); g.c.lineTo(p[0] + Math.sin(mA) * 9, p[1] - Math.cos(mA) * 9); g.c.stroke(); }
    else if (S.kind === 'poster') { Q(0.15, 0.85, z0, z1, '#2A3266'); Q(0.25, 0.75, z1 - 20, z1 - 6, '#FF6A3D', false); Q(0.3, 0.7, z0 + 6, z0 + 12, YEL, false); }
    else if (S.kind === 'shelf') { Q(0, w, z0, z1, W); const P2 = side === 'R' ? (a, z) => g.P(t + a, 0.3, z) : (a, z) => g.P(0.3, t + a, z); g.poly([side === 'R' ? g.P(t, e, z1) : g.P(e, t, z1), side === 'R' ? g.P(t + w, e, z1) : g.P(e, t + w, z1), P2(w, z1), P2(0, z1)], shade(W, 0.15)); [[0.3, RED, 14], [0.6, BLUE, 10], [1.2, GRN, 12], [1.5, YEL, 9]].forEach(([a, col, hh]) => Q(a, a + 0.12, z1, z1 + hh, col)); }
    else if (S.kind === 'mirror') { Q(0.2, 0.8, z0, z1, '#E8C870'); Q(0.27, 0.73, z0 + 4, z1 - 4, '#D8F0FF'); Q(0.35, 0.42, z1 - 30, z1 - 10, '#FFFFFF', false); }
    else if (S.kind === 'spr' && SPR[it.id]) {
      // 벽 면 좌표로 바꿔 평면 그림을 붙임 (오른쪽 벽: +i 방향 · 왼쪽 벽: 보는 사람 기준 왼→오 = -j 방향)
      const o = side === 'R' ? g.P(t, e, z1) : g.P(e, t + w, z1), o2 = side === 'R' ? g.P(t + 1, e, z1) : g.P(e, t + w - 1, z1);
      const c = g.c; c.save(); c.transform((o2[0] - o[0]) / 32, (o2[1] - o[1]) / 32, 0, 1, o[0], o[1]); c.lineJoin = 'round'; c.lineCap = 'round';
      try { SPR[it.id](sprPen(c), w * 32, z1 - z0, state || {}); } catch (err) { /* noop */ }
      c.restore();
    }
    else if (S.kind === 'board') { Q(0.05, w - 0.05, z0, z1, '#9AA8C8'); Q(0.1, w - 0.1, z0 + 3, z1 - 3, '#FFFFFF'); Q(0.3, 0.9, z1 - 12, z1 - 10, BLUE, false); Q(0.3, 1.3, z1 - 20, z1 - 18, RED, false); Q(1.2, 1.7, z0 + 8, z0 + 10, GRN, false); }
  }

  /* ---------- 벽 · 바닥 ---------- N = 방 칸 수 · WH = 벽 높이 */
  function drawRoomShell(g, N, WH, wp, fl, night) {
    const c = g.c, wpI = byId[wp] || byId.wp_basic, flI = byId[fl] || byId.fl_wood;
    const walls = [['R', [g.P(0, 0, 0), g.P(N, 0, 0), g.P(N, 0, WH), g.P(0, 0, WH)], 0], ['L', [g.P(0, 0, 0), g.P(0, N, 0), g.P(0, N, WH), g.P(0, 0, WH)], -0.08]];
    walls.forEach(([side, pts, f]) => {
      g.poly(pts, shade(wpI.color, f), false);
      c.save(); c.beginPath(); pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.clip();
      const Q = (a0, a1, z0, z1, col) => { if (side === 'R') g.face('j', 0, a0, a1, z0, z1, col, false); else g.face('i', 0, a0, a1, z0, z1, col, false); };
      const pat = wpI.pat, base = shade(wpI.color, f);
      if (pat === 'stripe') for (let a = 0; a < N; a += 0.5) Q(a, a + 0.22, 0, WH, shade(base, -0.08));
      else if (pat === 'check') { for (let a = 0; a < N; a += 0.5) for (let z = 0; z < WH; z += 20) { if (((a * 2) + z / 20) % 2 < 1) Q(a, a + 0.5, z, z + 20, shade(base, -0.06)); } }
      else if (pat === 'plank') for (let a = 0; a < N; a += 0.4) Q(a, a + 0.02, 0, WH, shade(base, -0.25));
      else if (pat === 'hanok') { for (let a = 0; a < N; a += 1) { Q(a, a + 0.05, 0, WH, W2); } for (let z = 20; z < WH; z += 24) Q(0, N, z, z + 2, shade(W2, 0.3)); Q(0, N, 0, 16, '#B8805A'); }
      else if (pat === 'star' || pat === 'space') { let s = side === 'R' ? 7 : 13; for (let n = 0; n < 40; n++) { s = (s * 9301 + 49297) % 233280; const a = (s / 233280) * N; s = (s * 9301 + 49297) % 233280; const z = (s / 233280) * WH; const sp = side === 'R' ? g.P(a, 0, z) : g.P(0, a, z), sz = n % 7 ? 2 : 3; c.fillStyle = n % 5 ? '#FFF3B0' : '#FFFFFF'; c.fillRect(Math.round(sp[0]), Math.round(sp[1]), sz, sz); if (n % 9 === 0) { c.fillRect(Math.round(sp[0]) - 2, Math.round(sp[1]) + 1, 7, 1); c.fillRect(Math.round(sp[0]) + 1, Math.round(sp[1]) - 2, 1, 7); } } if (pat === 'space') { const p = side === 'R' ? g.P(N * 0.7, 0, WH * 0.7) : g.P(0, N * 0.3, WH * 0.5); c.fillStyle = '#FF9A6A'; c.beginPath(); c.arc(p[0], p[1], 12, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(p[0] - 16, p[1] - 1, 32, 2); } }
      Q(0, N, 0, 6, shade(base, -0.22));   // 걸레받이
      c.restore();
      g.poly(pts, null, O);
    });
    // 바닥
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      let col = flI.color; const pat = flI.pat, odd = (i + j) % 2;
      if (pat === 'check') col = odd ? '#3A3E5A' : '#F4F0E8';
      else if (pat === 'plank' || pat === 'maru') col = shade(flI.color, (i % 2 ? -0.05 : 0.03) + (pat === 'maru' && j % 2 ? -0.06 : 0));
      else if (pat === 'tatami') col = shade(flI.color, odd ? -0.06 : 0.02);
      else if (pat === 'marble') col = shade(flI.color, ((i * 7 + j * 3) % 5) * 0.012);
      else if (pat === 'grass') col = shade(flI.color, ((i * 5 + j * 11) % 4) * -0.03);
      else if (pat === 'cloud') col = shade(flI.color, odd ? 0.08 : 0);
      g.flat(i, j, i + 1, j + 1, 0, col, pat === 'plank' || pat === 'maru' || pat === 'tatami' ? shade(flI.color, -0.25) : pat === 'check' ? false : shade(col, -0.06));
      if (pat === 'star' && (i * 3 + j * 7) % 5 === 0) g.dot(i + 0.5, j + 0.5, 0, 1, '#FFF3B0');
      if (pat === 'grass' && (i * 3 + j) % 3 === 0) g.dot(i + 0.3, j + 0.6, 0, 1, shade(flI.color, 0.35));
    }
    { const a = g.P(0, N, 0), b = g.P(N, N, 0), d = g.P(N, 0, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.strokeStyle = O; c.lineWidth = 1; c.stroke(); }   // 바닥 앞쪽 테두리 (닫지 않음 → 가운데 가로선 없음)
    if (night) { c.fillStyle = 'rgba(20,16,60,.35)'; c.fillRect(-2000, -2000, 4000, 4000); }
  }

  /* 가구 하나 그리기 (방 안) — state: { open(옷장 0~1), on(조명·화면) } */
  function drawItem(g, it, i, j, r, state) {
    state = state || {};
    if (it.slot === 'wardrobe') return drawWardrobe(g, it, i, j, r, state.open || 0);
    const L = local(g, i, j, r);
    it.draw(L, null);
    if (state.on && it.act === 'light') { const p = L.P(0.5, 0.5, it.h - 6); const grd = g.c.createRadialGradient(p[0], p[1], 2, p[0], p[1], 70); grd.addColorStop(0, 'rgba(255,240,180,.75)'); grd.addColorStop(1, 'rgba(255,240,180,0)'); g.c.fillStyle = grd; g.c.fillRect(p[0] - 70, p[1] - 70, 140, 140); }
    if (state.on && it.act === 'screen') { const p = L.P(it.w / 2, it.d / 2, it.h - 14); g.c.fillStyle = 'rgba(120,220,255,.35)'; g.c.fillRect(p[0] - 20, p[1] - 10, 40, 20); }
  }
  // 크기에 맞춘 미리보기 그림 (상점 · 꾸미기 칸)
  const thumbC = {};
  function thumb(id, size) {
    size = size || 64; const key = id + '|' + size; if (thumbC[key]) return thumbC[key];
    const it = byId[id], cv = document.createElement('canvas'); cv.width = size * 2; cv.height = size * 2;
    const c = cv.getContext('2d'); c.scale(2, 2); c.lineJoin = 'round';
    if (!it) return cv;
    if (it.slot === 'music') {   // 음반 그림
      const r = size * 0.4, cx = size / 2, cy = size / 2; let h2 = 0; for (const ch of id) h2 = (h2 * 31 + ch.charCodeAt(0)) % 360;
      c.fillStyle = O; c.beginPath(); c.arc(cx, cy, r + 2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2A2E40'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; [0.8, 0.62].forEach(k => { c.beginPath(); c.arc(cx, cy, r * k, 0, Math.PI * 2); c.stroke(); });
      c.fillStyle = `hsl(${h2},75%,62%)`; c.beginPath(); c.arc(cx, cy, r * 0.38, 0, Math.PI * 2); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(cx, cy, r * 0.08, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#FFE45C'; c.font = `${Math.round(size * 0.28)}px sans-serif`; c.fillText('♪', cx + r * 0.45, cy - r * 0.45);
      thumbC[key] = cv; return cv;
    }
    // v92: 큰 캔버스에 그린 뒤 칠해진 부분만 잘라 칸 가운데에 맞춤 (바닥 = 바닥만 · 벽 장식 = 작은 벽 조각 위에)
    const BIG = 520, tmp = document.createElement('canvas'); tmp.width = BIG; tmp.height = BIG;
    const t = tmp.getContext('2d'); t.lineJoin = 'round'; t.scale(2, 2);
    const g = pen(t, BIG / 4, BIG / 4 + 20);
    let ready = true;
    if (it.slot === 'floor') {
      drawFloorOnly(g, 3, id);
    } else if (it.slot === 'wallpaper') drawRoomShell(pen(t, BIG / 4, BIG / 4 + 10), 2, 70, id, 'fl_wood');
    else if (it.slot === 'wall') {
      const S2 = it.wall;
      g.face('j', 0, -0.3, it.w + 0.3, S2.z0 - 14, S2.z1 + 14, '#EDE6D8', '#C8BFAE');
      drawWallItem(g, it, 'R', 0, {});
    } else {
      if (it.slot === 'wardrobe' && !wdImg(id, false)) ready = false;
      drawItem(g, it, 0, 0, 0, {});
    }
    // 칠해진 영역 찾기
    const data = t.getImageData(0, 0, BIG, BIG).data; let x0 = BIG, y0 = BIG, x1 = -1, y1 = -1;
    for (let y = 0; y < BIG; y++) for (let x = 0; x < BIG; x++) if (data[(y * BIG + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 >= 0) {
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, room = size * 2 * 0.86, k = Math.min(room / bw, room / bh, 1.6);
      const dw = bw * k, dh = bh * k;
      c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true;
      c.drawImage(tmp, x0, y0, bw, bh, (size * 2 - dw) / 2, (size * 2 - dh) / 2 + (it.slot === 'wall' ? 0 : size * 0.04), dw, dh);
    }
    if (ready) thumbC[key] = cv;
    return cv;
  }
  // 바닥 미리보기용: 벽 없이 바닥 타일만 (N×N)
  function drawFloorOnly(g, n, fl) {
    const flI = byId[fl] || byId.fl_wood;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      let col = flI.color; const pat = flI.pat, odd = (i + j) % 2;
      if (pat === 'check') col = odd ? '#3A3E5A' : '#F4F0E8';
      else if (pat === 'plank' || pat === 'maru') col = shade(flI.color, (i % 2 ? -0.05 : 0.03) + (pat === 'maru' && j % 2 ? -0.06 : 0));
      else if (pat === 'tatami') col = shade(flI.color, odd ? -0.06 : 0.02);
      else if (pat === 'marble') col = shade(flI.color, ((i * 7 + j * 3) % 5) * 0.012);
      else if (pat === 'grass') col = shade(flI.color, ((i * 5 + j * 11) % 4) * -0.03);
      else if (pat === 'cloud') col = shade(flI.color, odd ? 0.08 : 0);
      g.flat(i, j, i + 1, j + 1, 0, col, pat === 'plank' || pat === 'maru' || pat === 'tatami' ? shade(flI.color, -0.25) : pat === 'check' ? false : shade(col, -0.06));
      if (pat === 'star' && (i + j) % 2 === 0) g.dot(i + 0.5, j + 0.5, 0, 1.5, '#FFF3B0');
      if (pat === 'grass' && (i * 3 + j) % 3 === 0) g.dot(i + 0.3, j + 0.6, 0, 1, shade(flI.color, 0.35));
    }
    g.poly([g.P(0, 0, 0), g.P(n, 0, 0), g.P(n, n, 0), g.P(0, n, 0)], null, O);
    // 두께 (바닥판 옆면)
    g.poly([g.P(0, n, 0), g.P(n, n, 0), g.P(n, n, -6), g.P(0, n, -6)], shade(flI.color, -0.3), O);
    g.poly([g.P(n, 0, 0), g.P(n, n, 0), g.P(n, n, -6), g.P(n, 0, -6)], shade(flI.color, -0.42), O);
  }

  window.GoFurn = { ITEMS, byId, CATS, SHOP_CATS, MUSIC, TW, TH, pen, local, drawItem, drawWallItem, drawRoomShell, thumb, shade,
    free: () => ITEMS.filter(it => it.price === 0).map(it => it.id),
    // 처음 방 (기본 가구만)
    DEFAULT_ROOM: { wp: 'wp_basic', fl: 'fl_wood', wd: 'wd_basic', wdAt: [0, 2, 1], items: [['f_bed1', 6, 0, 0], ['f_desk', 0, 5, 1], ['f_chair', 1, 5, 1], ['f_pot', 7, 7, 0]], walls: [['w_window', 'R', 3]] } };
})();
