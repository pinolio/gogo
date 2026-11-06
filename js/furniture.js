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
    ['w_board', '화이트보드', 15, 'wall', 2, 0, 0, null, null, { z0: 60, z1: 100, kind: 'board' }]
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

  const ITEMS = [], byId = {};
  FURN.forEach(([id, name, price, cat, w, d, h, draw, act, wall]) => { const it = { id, name, price, slot: cat === 'wall' ? 'wall' : cat === 'rug' ? 'rug' : 'furn', cat, w, d, h, draw, act, wall }; ITEMS.push(it); byId[id] = it; });
  WALLS.forEach(([id, name, price, color, pat]) => { const it = { id, name, price, slot: 'wallpaper', cat: 'wallpaper', color, pat }; ITEMS.push(it); byId[id] = it; });
  FLOORS.forEach(([id, name, price, color, pat]) => { const it = { id, name, price, slot: 'floor', cat: 'floor', color, pat }; ITEMS.push(it); byId[id] = it; });
  WARDROBES.forEach(([id, name, price, color]) => { const it = { id, name, price, slot: 'wardrobe', cat: 'wardrobe', color, w: 1, d: 1, h: 96, act: 'wardrobe' }; ITEMS.push(it); byId[id] = it; });
  const CATS = [['furn', '가구'], ['wall', '벽 장식'], ['rug', '러그'], ['wardrobe', '옷장'], ['wallpaper', '벽지'], ['floor', '바닥']];

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
    if (it.slot === 'wallpaper' || it.slot === 'floor') {
      const g = pen(c, size / 2, size * 0.18); c.save(); c.translate(0, 0); c.scale(size / 120, size / 120); const g2 = pen(c, 60, 14);
      if (it.slot === 'wallpaper') drawRoomShell(g2, 2, 56, id, 'fl_wood'); else drawRoomShell(g2, 2, 20, 'wp_basic', id);
      c.restore(); void g; thumbC[key] = cv; return cv;
    }
    const w = it.w || 1, d = it.d || 1, hgt = it.slot === 'wall' ? it.wall.z1 - it.wall.z0 + 20 : (it.h || 40);
    const spanX = (w + d) * TW, spanY = (w + d) * TH + hgt, k = Math.min(1.6, (size - 6) / Math.max(spanX, spanY));
    c.translate(size / 2, size - 4 - (w + d) * TH * k); c.scale(k, k);
    const g = pen(c, (d - w) * TW / 2 * 0, 0);
    const ox = (d - w) * TW / 2;
    const g3 = pen(c, ox, 0); void g;
    if (it.slot === 'wall') { c.translate(0, hgt - 10); drawWallItem(pen(c, ox + w * TW / 2 * 0, -it.wall.z0 + 4), it, 'R', 0, {}); }
    else drawItem(g3, it, 0, 0, 0, {});
    thumbC[key] = cv; return cv;
  }

  window.GoFurn = { ITEMS, byId, CATS, TW, TH, pen, drawItem, drawWallItem, drawRoomShell, thumb, shade,
    free: () => ITEMS.filter(it => it.price === 0).map(it => it.id),
    // 처음 방 (기본 가구만)
    DEFAULT_ROOM: { wp: 'wp_basic', fl: 'fl_wood', wd: 'wd_basic', wdAt: [0, 2, 1], items: [['f_bed1', 6, 0, 0], ['f_desk', 0, 5, 1], ['f_chair', 1, 5, 1], ['f_pot', 7, 7, 0]], walls: [['w_window', 'R', 3]] } };
})();
