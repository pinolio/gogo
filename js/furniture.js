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
  /* ================= v93 러그 30종 · 옷장 26종 · 벽지 24종 (선생님 그림 참고, 모두 코드 그림) ================= */
  // 작은 무작위 (같은 씨앗 → 같은 무늬)
  const seeded = s => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  /* ---- 러그: 바닥 위 평면 그림 (가로 W = 칸 × 32 · 세로 D = 칸 × 32, 왼쪽 위가 0,0) ---- */
  const RUGS = {
    r_oval(d, W, D) { const x = W / 2, y = D / 2; for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; d.L([[x + Math.cos(a) * 28, y + Math.sin(a) * 28], [x + Math.cos(a) * 31.5, y + Math.sin(a) * 31.5]], '#C8A060', 1); } d.C(x, y, 28, '#D8B078'); [22, 16, 10].forEach((r, k) => d.C(x, y, r, null, k % 2 ? '#B8905A' : '#E8C890')); d.C(x, y, 4, '#B8905A', false); },
    r_cat(d, W, D) { const x = W / 2; d.P([[10, 26], [12, 4], [26, 16]], '#F4E2C8'); d.P([[W - 10, 26], [W - 12, 4], [W - 26, 16]], '#E8A050'); d.P([[13, 22], [14, 9], [22, 16]], '#FFB0C0', false); d.E(x, 38, 28, 22, '#F4E2C8'); d.c.save(); d.c.beginPath(); d.c.ellipse(x, 38, 28, 22, 0, 0, 7); d.c.clip(); d.E(W - 14, 24, 16, 12, '#E8A050', false); d.c.restore(); d.E(x, 38, 28, 22, null); d.E(22, 36, 3, 4, O, false); d.E(42, 36, 3, 4, O, false); d.P([[x - 3, 43], [x + 3, 43], [x, 46]], '#FF8AA0'); d.Q(x - 6, 49, x - 3, 52, x, 48, O, 1); d.Q(x, 48, x + 3, 52, x + 6, 49, O, 1); [[-1, 0], [1, 0], [-1, 4], [1, 4]].forEach(([s, o]) => d.L([[x + s * 10, 45 + o * 0.5], [x + s * 24, 42 + o]], O, 0.8)); },
    r_gingham(d, W, D) { d.R(2, 2, W - 4, D - 4, '#FFFFFF'); for (let k = 0; k < 6; k++) { d.R(2 + k * 10, 2, 5, D - 4, 'rgba(46,140,70,.55)', false); d.R(2, 2 + k * 10, W - 4, 5, 'rgba(46,140,70,.55)', false); } d.R(2, 2, W - 4, D - 4, null); },
    r_star(d, W, D) { d.star(W / 2, D / 2 + 2, 31, '#FFD23F'); d.star(W / 2, D / 2 + 2, 22, null); d.c.strokeStyle = '#E8B020'; },
    r_persian(d, W, D) { for (let x = 6; x < W - 4; x += 3) { d.L([[x, 0], [x, 4]], '#F4E8C8', 1); d.L([[x, D - 4], [x, D]], '#F4E8C8', 1); } d.R(2, 4, W - 4, D - 8, '#A8302A'); d.R(6, 8, W - 12, D - 16, '#2A3266', false); d.R(9, 11, W - 18, D - 22, '#B8402E', false); d.P([[W / 2, 20], [W - 14, D / 2], [W / 2, D - 20], [14, D / 2]], '#E8B050', O); d.P([[W / 2, 28], [W - 22, D / 2], [W / 2, D - 28], [22, D / 2]], '#2A3266', false); d.C(W / 2, D / 2, 5, '#E8505A', false); [[14, 16], [W - 14, 16], [14, D - 16], [W - 14, D - 16]].forEach(([x, y]) => d.C(x, y, 3, '#E8B050', false)); for (let y = 14; y < D - 12; y += 6) { d.C(7.5, y, 1, '#E8B050', false); d.C(W - 7.5, y, 1, '#E8B050', false); } },
    r_daisy(d, W, D) { const x = W / 2, y = D / 2; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; d.E(x + Math.cos(a) * 18, y + Math.sin(a) * 18, 12, 6.5, '#FFF8E0', O, a); } d.C(x, y, 11, '#FFD23F'); d.C(x - 3, y - 3, 3, '#FFE88A', false); },
    r_paw(d, W, D) { d.E(32, 42, 18, 15, '#F0D0B8'); d.E(32, 44, 10, 8, '#FF9AA8', false); [[14, 22], [25, 13], [39, 13], [50, 22]].forEach(([x, y]) => { d.E(x, y, 7, 8, '#F0D0B8'); d.E(x, y + 1, 4, 4.5, '#FF9AA8', false); }); },
    r_clover(d, W, D) { const x = W / 2, y = D / 2 - 2; d.L([[x, y], [x + 6, D - 4]], '#2A8A4A', 3); [0, 1, 2, 3].forEach(k => { d.c.save(); d.c.translate(x, y); d.c.rotate(k * Math.PI / 2 + Math.PI / 4); d.heart(0, -12, 12, k % 2 ? '#3EA85A' : '#4AB868'); d.c.restore(); }); d.C(x, y, 3, '#2A8A4A', false); },
    r_donut(d, W, D) { const x = W / 2, y = D / 2, c = d.c; c.beginPath(); c.arc(x, y, 30, 0, 7); c.arc(x, y, 9, 0, 7, true); c.fillStyle = '#C8925A'; c.fill(); c.strokeStyle = O; c.lineWidth = 1.4; c.stroke(); c.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, r = 25 + (k % 2 ? 2 : -1); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.arc(x, y, 12, 0, 7, true); c.fillStyle = '#FF9AC0'; c.fill(); const rn = seeded(5); ['#FFFFFF', '#FFD23F', '#4A8AE8', '#3EA85A', '#B07CFF'].forEach(col => { for (let k = 0; k < 5; k++) { const a = rn() * 6.3, r = 15 + rn() * 9, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; d.L([[px, py], [px + 2.5, py + 1.5]], col, 1.6); } }); },
    r_stripe8(d, W, D) { const C = ['#FF9AA8', '#FFC08A', '#FFE88A', '#A8E8A0', '#9AD8FF', '#C8B0FF']; for (let k = 0; k < 12; k++) d.R(2, 2 + k * (D - 4) / 12, W - 4, (D - 4) / 12 + 0.4, C[k % 6], false); d.R(2, 2, W - 4, D - 4, null); },
    r_wave(d, W, D) { d.E(W / 2, D / 2, W / 2 - 2, D / 2 - 2, '#2A6AC8'); d.c.save(); d.c.beginPath(); d.c.ellipse(W / 2, D / 2, W / 2 - 2, D / 2 - 2, 0, 0, 7); d.c.clip(); for (let r = 0; r < 4; r++) for (let k = -1; k < 6; k++) { const x = k * 22 + (r % 2) * 11, y = 10 + r * 14; d.c.beginPath(); d.c.arc(x, y + 6, 10, Math.PI, 0); d.c.fillStyle = r % 2 ? '#4A8AE8' : '#8AC8FF'; d.c.fill(); d.Q(x - 8, y + 4, x - 2, y - 6, x + 4, y + 1, '#FFFFFF', 1.6); } d.c.restore(); d.E(W / 2, D / 2, W / 2 - 2, D / 2 - 2, null); },
    r_bear(d, W, D) { const x = W / 2; d.C(14, 16, 9, '#9A6238'); d.C(W - 14, 16, 9, '#9A6238'); d.C(14, 16, 5, '#C8925A', false); d.C(W - 14, 16, 5, '#C8925A', false); d.E(x, 38, 26, 22, '#9A6238'); d.E(x, 46, 11, 8, '#E8C8A0'); d.E(x, 42, 4, 3, O, false); d.C(x - 10, 34, 2.5, O, false); d.C(x + 10, 34, 2.5, O, false); d.E(x - 16, 44, 3, 2, 'rgba(255,140,160,.6)', false); d.E(x + 16, 44, 3, 2, 'rgba(255,140,160,.6)', false); },
    r_pad(d, W, D) { const c = d.c; c.beginPath(); c.moveTo(20, 14); c.lineTo(W - 20, 14); c.quadraticCurveTo(W - 2, 14, W - 4, 38); c.quadraticCurveTo(W - 6, D - 4, W - 22, 48); c.lineTo(22, 48); c.quadraticCurveTo(6, D - 4, 4, 38); c.quadraticCurveTo(2, 14, 20, 14); c.fillStyle = '#C8D4EC'; c.fill(); c.strokeStyle = O; c.lineWidth = 1.4; c.stroke(); d.R(16, 22, 6, 18, '#3A4270', false); d.R(10, 28, 18, 6, '#3A4270', false); [[W - 22, 25, '#4A8AE8'], [W - 14, 31, '#E8505A'], [W - 30, 31, '#FFD23F'], [W - 22, 37, '#3EA85A']].forEach(([px, py, col]) => d.C(px, py, 3.2, col)); d.R(W / 2 - 9, 28, 6, 3, '#3A4270', false, 1); d.R(W / 2 + 3, 28, 6, 3, '#3A4270', false, 1); },
    r_leaf(d, W, D) { const x = W / 2, y = D / 2; d.E(x, y, 29, 24, '#2E8A4A', O, -0.3); d.E(x - 4, y - 4, 18, 13, '#3EA85A', false, -0.3); const c = d.c; c.save(); c.translate(x, y); c.rotate(-0.3); for (let k = -3; k <= 3; k++) { if (!k) continue; d.L([[0, k * 2], [26 * Math.sign(k) * 0 + 24, k * 6.5]], '#7FCF6A', 1); d.L([[0, k * 2], [-24, k * 6.5]], '#7FCF6A', 1); } d.L([[-28, 0], [28, 0]], '#B8E8A0', 1.6); c.restore(); },
    r_cloud(d, W, D) { [[22, 38, 15], [40, 26, 18], [60, 30, 16], [76, 40, 13], [48, 42, 15]].forEach(([x, y, r]) => d.C(x, y, r, '#FFFFFF', '#8AC8FF')); [[22, 38, 13.6], [40, 26, 16.6], [60, 30, 14.6], [76, 40, 11.6], [48, 42, 13.6]].forEach(([x, y, r]) => d.C(x, y, r, '#FFFFFF', false)); d.C(34, 36, 3, '#E8F4FF', false); },
    r_melon(d, W, D) { const c = d.c, x = W / 2, y = 8; [[44, '#2E8A4A'], [40, '#B8E8A0'], [37, '#FFFFFF'], [34, '#E8505A']].forEach(([r, col], k) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI); c.closePath(); c.fillStyle = col; c.fill(); if (!k) { c.strokeStyle = O; c.lineWidth = 1.4; c.stroke(); } }); const rn = seeded(9); for (let k = 0; k < 10; k++) { const a = 0.3 + rn() * 2.5, r = 10 + rn() * 20; d.E(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.4, 2.4, O, false, a); } },
    r_record(d, W, D) { const x = W / 2, y = D / 2; d.C(x, y, 30, '#1D2340'); for (let r = 14; r < 29; r += 3) d.C(x, y, r, null, '#3A4270'); d.C(x, y, 10, '#E8505A', false); d.C(x, y, 2, '#F4E8C8', false); d.Q(x - 20, y - 14, x - 14, y - 22, x - 4, y - 25, 'rgba(255,255,255,.35)', 2); },
    r_xmas(d, W, D) { d.R(2, 2, W - 4, D - 4, '#C8303A'); d.R(5, 5, W - 10, D - 10, null, '#FFFFFF'); d.P([[W / 2, 12], [W / 2 + 12, 42], [W / 2 - 12, 42]], '#2E8A4A'); d.R(W / 2 - 2, 42, 4, 6, '#8A5A34', false); d.star(W / 2, 12, 3.5, '#FFD23F'); [[W / 2 - 4, 26, '#FFD23F'], [W / 2 + 5, 33, '#4A8AE8'], [W / 2 - 6, 37, '#FFFFFF']].forEach(([x, y, col]) => d.C(x, y, 1.6, col, false)); d.C(20, 38, 7, '#FFFFFF'); d.C(20, 27, 5, '#FFFFFF'); d.C(18.5, 26, 0.7, O, false); d.C(21.5, 26, 0.7, O, false); d.P([[20, 28], [24, 29], [20, 29.5]], '#FF8A3D', false); const rn = seeded(3); for (let k = 0; k < 20; k++) d.C(8 + rn() * (W - 16), 8 + rn() * (D - 16), 0.9, '#FFFFFF', false); d.R(W - 30, 34, 10, 8, '#4A8AE8'); d.R(W - 26, 34, 2, 8, '#FFD23F', false); },
    r_rainbow(d, W, D) { const c = d.c, x = W / 2, y = D - 4; ['#E8505A', '#FF8A3D', '#FFD23F', '#3EA85A', '#4A8AE8', '#B07CFF'].forEach((col, k) => { c.beginPath(); c.arc(x, y, 44 - k * 5, Math.PI, 0); c.arc(x, y, 39 - k * 5, 0, Math.PI, true); c.closePath(); c.fillStyle = col; c.fill(); }); c.beginPath(); c.arc(x, y, 44, Math.PI, 0); c.arc(x, y, 14, 0, Math.PI, true); c.closePath(); c.strokeStyle = O; c.lineWidth = 1.4; c.stroke(); },
    r_heartdot(d, W, D) { d.R(2, 2, W - 4, D - 4, '#FFC8DC', O, 3); for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) { const x = 9 + k * 11.5 + (r % 2) * 5, y = 9 + r * 11.5; if (x < W - 6) { d.c.save(); d.heart(x, y, 2.6, '#FF6A9A'); d.c.restore(); } } },
    r_tatami(d, W, D) { d.R(2, 2, W - 4, D - 4, '#D8B870'); for (let y = 4; y < D - 3; y += 2) d.L([[3, y], [W - 3, y]], 'rgba(150,110,50,.35)', 0.6); [[2, 2, W / 2 - 2, D / 2 - 2], [W / 2, 2, W / 2 - 2, D / 2 - 2], [2, D / 2, W / 2 - 2, D / 2 - 2], [W / 2, D / 2, W / 2 - 2, D / 2 - 2]].forEach(([x, y, w, h]) => d.R(x, y, w, h, null, '#6A4026')); d.R(2, 2, W - 4, D - 4, null, '#4A2A16'); },
    r_grass(d, W, D) { d.R(2, 2, W - 4, D - 4, '#4AA848', '#2A7A3A'); const rn = seeded(11); for (let k = 0; k < 120; k++) { const x = 4 + rn() * (W - 8), y = 4 + rn() * (D - 8); d.L([[x, y], [x + 1, y - 3]], k % 3 ? '#6AC860' : '#2E8A3A', 1); } },
    r_space(d, W, D) { d.R(2, 2, W - 4, D - 4, '#1E2458', O, 3); const rn = seeded(7); for (let k = 0; k < 30; k++) d.C(5 + rn() * (W - 10), 5 + rn() * (D - 10), rn() * 0.9 + 0.4, '#FFFFFF', false); const S = [[16, 14], [26, 22], [38, 18], [46, 30], [36, 40]]; d.L(S, 'rgba(255,240,180,.8)', 0.8); S.forEach(([x, y]) => d.star(x, y, 2.4, '#FFE88A')); const S2 = [[60, 40], [70, 46], [80, 38]]; d.L(S2, 'rgba(255,240,180,.8)', 0.8); S2.forEach(([x, y]) => d.star(x, y, 2.2, '#FFE88A')); d.C(W - 16, 14, 7, '#FFE88A', false); d.C(W - 13, 12, 6, '#1E2458', false); },
    r_tiger(d, W, D) { const c = d.c; c.beginPath(); const pts = [[16, 10], [30, 6], [52, 8], [70, 4], [86, 12], [92, 32], [86, 52], [70, 58], [50, 54], [30, 58], [14, 52], [6, 32]]; pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fillStyle = '#E8902A'; c.fill(); c.save(); c.clip(); for (let x = 12; x < W; x += 9) { c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 6, 16, x - 2, 30); c.lineTo(x + 2, 30); c.quadraticCurveTo(x + 9, 16, x + 3, 0); c.fillStyle = '#1D2340'; c.fill(); c.beginPath(); c.moveTo(x + 3, D); c.quadraticCurveTo(x - 4, 46, x + 4, 36); c.lineTo(x + 7, 36); c.quadraticCurveTo(x, 46, x + 7, D); c.fill(); } c.restore(); c.beginPath(); pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.strokeStyle = O; c.lineWidth = 1.4; c.stroke(); },
    r_keyboard(d, W, D) { d.R(2, 3, W - 4, D - 6, '#2A3050', O, 3); const C = ['#C8D4EC', '#C8D4EC', '#C8D4EC', '#FF8AB8', '#9AD8FF', '#C8D4EC']; for (let r = 0; r < 4; r++) for (let k = 0; k < 13; k++) { const w = r === 3 && k > 3 && k < 9 ? 0 : 5.6; if (!w) continue; d.R(6 + k * 6.6, 6 + r * 5.4, w, 4.4, C[(k + r) % 6], false, 1); } d.R(6 + 4 * 6.6, 6 + 3 * 5.4, 32, 4.4, '#C8D4EC', false, 1); },
    r_welcome(d, W, D) { d.R(2, 2, W - 4, D - 4, '#8A5A34', O, 2); d.R(5, 5, W - 10, D - 10, null, '#B8783E'); d.T('WELCOME', W / 2, D / 2, 9, '#F4E2C8', true); },
    r_chess(d, W, D) { d.R(2, 2, W - 4, D - 4, '#FFFFFF'); const s = (W - 4) / 8; for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) if ((r + k) % 2) d.R(2 + k * s, 2 + r * s, s, s, '#1D2340', false); d.R(2, 2, W - 4, D - 4, null); },
    r_halloween(d, W, D) { d.R(2, 2, W - 4, D - 4, '#FF8A2A', O, 3); const x = W / 2, y = D / 2; d.E(x, y + 2, 20, 16, '#1D2340', false); d.P([[x - 12, y - 4], [x - 4, y - 4], [x - 8, y - 10]], '#FF8A2A', false); d.P([[x + 12, y - 4], [x + 4, y - 4], [x + 8, y - 10]], '#FF8A2A', false); d.P([[x - 3, y + 2], [x + 3, y + 2], [x, y - 2]], '#FF8A2A', false); d.P([[x - 14, y + 6], [x - 9, y + 12], [x - 5, y + 8], [x, y + 13], [x + 5, y + 8], [x + 9, y + 12], [x + 14, y + 6], [x, y + 9]], '#FF8A2A', false); },
    r_peach(d, W, D) { const c = d.c, x = W / 2, y = D / 2 + 3; c.beginPath(); c.moveTo(x, y - 20); c.bezierCurveTo(x - 34, y - 34, x - 34, y + 26, x, y + 26); c.bezierCurveTo(x + 34, y + 26, x + 34, y - 34, x, y - 20); c.closePath(); const gr = c.createRadialGradient(x - 8, y - 4, 4, x, y, 32); gr.addColorStop(0, '#FFE0D0'); gr.addColorStop(1, '#FF9AA0'); c.fillStyle = gr; c.fill(); c.strokeStyle = O; c.lineWidth = 1.4; c.stroke(); d.Q(x, y - 18, x - 4, y, x, y + 22, 'rgba(232,90,110,.6)', 1.2); d.E(x + 8, y - 24, 9, 4, '#3EA85A', O, -0.4); },
    r_tile(d, W, D) { d.R(2, 2, W - 4, D - 4, '#E88A3A'); const s = (W - 10) / 4; for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { const x = 5 + k * s, y = 5 + r * s; d.R(x, y, s, s, '#F4F0E8', '#2A5AA8'); d.P([[x + s / 2, y + 2], [x + s - 2, y + s / 2], [x + s / 2, y + s - 2], [x + 2, y + s / 2]], '#2A6AC8', false); d.C(x + s / 2, y + s / 2, 2.4, (r + k) % 2 ? '#FFD23F' : '#E8505A', false); } d.R(2, 2, W - 4, D - 4, null); }
  };
  [['r_oval', '원형 매트', 10, 2, 2], ['r_cat', '고양이 러그', 15, 2, 2], ['r_gingham', '체크 패턴 러그', 12, 2, 2], ['r_star', '별 모양 매트', 15, 2, 2], ['r_persian', '페르시안 매트', 25, 2, 3],
    ['r_daisy', '꽃무늬 매트', 12, 2, 2], ['r_paw', '발바닥 러그', 12, 2, 2], ['r_clover', '클로버 매트', 10, 2, 2], ['r_donut', '달콤 도넛 매트', 15, 2, 2], ['r_stripe8', '스트라이프 매트', 8, 2, 3],
    ['r_wave', '바다 파도 러그', 18, 3, 2], ['r_bear', '포근한 곰 러그', 20, 2, 2], ['r_pad', '게임패드 매트', 20, 3, 2], ['r_leaf', '나뭇잎 매트', 12, 2, 2], ['r_cloud', '구름 러그', 15, 3, 2],
    ['r_melon', '수박 매트', 12, 3, 2], ['r_record', '음악 레코드 매트', 15, 2, 2], ['r_xmas', '크리스마스 매트', 22, 3, 2], ['r_rainbow', '레인보우 러그', 18, 3, 2], ['r_heartdot', '하트 도트 매트', 10, 2, 2],
    ['r_tatami', '한옥 돗자리', 12, 2, 2], ['r_grass', '잔디 매트', 15, 2, 2], ['r_space', '우주 별자리 러그', 30, 3, 2], ['r_tiger', '동물 가죽 러그', 35, 3, 2], ['r_keyboard', '키보드 장패드', 15, 3, 1],
    ['r_welcome', '웰컴 발판', 8, 2, 1], ['r_chess', '체스판 러그', 15, 2, 2], ['r_halloween', '할로윈 매트', 20, 2, 2], ['r_peach', '피치 복숭아 매트', 15, 2, 2], ['r_tile', '화려한 타일 매트', 25, 2, 2]
  ].forEach(([id, name, price, w, dd]) => FURN.push([id, name, price, 'rug', w, dd, 2, L => {
    const c = L.c, o = L.P(0, 0, 0.6), a = L.P(1, 0, 0.6), b = L.P(0, 1, 0.6);
    c.save(); c.transform((a[0] - o[0]) / 32, (a[1] - o[1]) / 32, (b[0] - o[0]) / 32, (b[1] - o[1]) / 32, o[0], o[1]); c.lineJoin = 'round'; c.lineCap = 'round';
    try { RUGS[id](sprPen(c), w * 32, dd * 32); } catch (err) { /* noop */ }
    c.restore();
  }, null]));

  /* ---- 벽지: 벽 한 면 전체에 그리는 무늬 (가로 W = 칸 수 × 32 · 세로 H = 벽 높이, 왼쪽 위가 0,0) ---- */
  const WPS = {
    wp_brick(d, W, H) { for (let y = 0, r = 0; y < H; y += 10, r++) for (let x = (r % 2) * -10; x < W; x += 20) d.R(x + 0.8, y + 0.8, 18.4, 8.4, r % 3 ? '#C8603A' : '#B8502E', false); for (let y = 0; y < H; y += 10) d.L([[0, y], [W, y]], '#E8C8B0', 1.4); },
    wp_rose(d, W, H) { const rn = seeded(21); for (let x = -10; x < W + 10; x += 34) { d.c.beginPath(); for (let y = 0; y <= H; y += 4) d.c.lineTo(x + Math.sin(y / 14) * 6, y); d.c.strokeStyle = '#5AA860'; d.c.lineWidth = 1.2; d.c.stroke(); for (let y = 8; y < H; y += 22) { const px = x + Math.sin(y / 14) * 6; d.E(px - 5, y + 4, 3.5, 1.8, '#5AA860', false, 0.5); d.C(px + 2, y, 4, rn() < 0.5 ? '#E86A7A' : '#FF9AB0', '#C8405A'); d.C(px + 2, y, 1.6, '#C8405A', false); } } },
    wp_cloud(d, W, H) { const rn = seeded(31); for (let k = 0; k < W * H / 1400; k++) { const x = rn() * W, y = rn() * H * 0.9; [[0, 0, 7], [8, -3, 8], [16, 0, 6]].forEach(([u, v, r]) => d.C(x + u, y + v, r, '#FFFFFF', false)); } },
    wp_mintdot(d, W, H) { for (let y = 6, r = 0; y < H; y += 12, r++) for (let x = (r % 2) * 6 + 3; x < W; x += 12) d.C(x, y, 1.8, '#FFFFFF', false); },
    wp_concrete(d, W, H) { const rn = seeded(41); for (let k = 0; k < W * H / 60; k++) d.C(rn() * W, rn() * H, 0.6, rn() < 0.5 ? 'rgba(80,90,120,.18)' : 'rgba(255,255,255,.25)', false); for (let x = 0; x < W; x += 64) d.L([[x, 0], [x, H]], '#9AA4BA', 1); for (let y = 0; y < H; y += 50) d.L([[0, y], [W, y]], '#9AA4BA', 1); for (let x = 12; x < W; x += 32) for (let y = 12; y < H; y += 25) d.C(x, y, 1.2, '#8A94AA', false); },
    wp_neon(d, W, H) { const c = d.c; c.save(); c.shadowBlur = 6; [[H * 0.3, '#FF4AC8'], [H * 0.62, '#4AE8FF']].forEach(([y, col], k) => { c.shadowColor = col; c.beginPath(); for (let x = 0; x <= W; x += 3) { const m = (x % 90); const pulse = m > 40 && m < 60 ? (m < 45 ? -14 : m < 50 ? 18 : m < 55 ? -8 : 0) : 0; c.lineTo(x, y + (k ? Math.sin(x / 10) * 3 : pulse)); } c.strokeStyle = col; c.lineWidth = 1.6; c.stroke(); }); c.restore(); for (let y = 10; y < H; y += 20) d.L([[0, y], [W, y]], 'rgba(176,124,255,.18)', 0.6); },
    wp_wave(d, W, H) { for (let r = 0, y = 4; y < H + 10; y += 12, r++) for (let x = (r % 2) * 10 - 10; x < W + 10; x += 20) { d.c.beginPath(); d.c.arc(x, y + 8, 10, Math.PI, 0); d.c.fillStyle = r % 2 ? '#4A9AE8' : '#7FC4FF'; d.c.fill(); d.Q(x - 8, y + 6, x - 2, y - 2, x + 4, y + 3, '#FFFFFF', 1.2); } },
    wp_heart(d, W, H) { for (let y = 10, r = 0; y < H; y += 18, r++) for (let x = (r % 2) * 11 + 6; x < W; x += 22) d.heart(x, y, 3.4, '#FF5A7A'); },
    wp_pixel(d, W, H) { const B = 8, gy = H - 30; for (let x = 0; x < W; x += B) { d.R(x, gy, B, B, '#5AC85A', false); d.R(x, gy + B, B, H - gy - B, '#B8783E', false); d.L([[x, gy + B], [x + B, gy + B]], '#3E9A3A', 1); if ((x / B) % 3 === 0) d.R(x + 2, gy + 14, 2, 2, '#8A5A2A', false); } const rn = seeded(51); for (let k = 0; k < W / 70; k++) { const x = rn() * (W - 40), y = 10 + rn() * 30; [[0, 4, 24, 8], [6, 0, 12, 4]].forEach(([u, v, w, h]) => d.R(x + u, y + v, w, h, '#FFFFFF', false)); } for (let x = 30; x < W - 20; x += 90) { d.R(x, gy - 34, 9, 9, '#E8A030', O); d.T('?', x + 4.5, gy - 29.5, 7, '#FFFFFF', true); d.R(x + 9, gy - 34, 9, 9, '#C8603A', O); } for (let x = 60; x < W; x += 120) { d.R(x, gy - 14, 10, 14, '#3EA85A', O); d.R(x - 2, gy - 18, 14, 5, '#5AC85A', O); } },
    wp_forest(d, W, H) { const rn = seeded(61); d.R(0, H * 0.7, W, H * 0.3, '#7FC060', false); for (let k = 0; k < W / 18; k++) { const x = rn() * W, s = 0.7 + rn() * 0.6, by = H * 0.75 + rn() * 10; d.R(x - 2 * s, by - 26 * s, 4 * s, 26 * s, '#8A5A34', false); [[0, -34, 12], [-8, -26, 9], [8, -26, 9]].forEach(([u, v, r]) => d.C(x + u * s, by + v * s, r * s, k % 2 ? '#2E8A4A' : '#3EA85A', false)); } for (let k = 0; k < W / 14; k++) d.C(rn() * W, H * 0.8 + rn() * H * 0.18, 1.6, rn() < 0.5 ? '#FFD23F' : '#FF8AB8', false); },
    wp_marble(d, W, H) { const rn = seeded(71); for (let k = 0; k < W / 22; k++) { let x = rn() * W, y = 0; d.c.beginPath(); d.c.moveTo(x, y); while (y < H) { x += (rn() - 0.5) * 14; y += 6 + rn() * 8; d.c.lineTo(x, y); } d.c.strokeStyle = k % 2 ? 'rgba(200,240,230,.45)' : 'rgba(20,50,50,.4)'; d.c.lineWidth = 0.8 + rn(); d.c.stroke(); } },
    wp_halloween(d, W, H) { const rn = seeded(81); for (let k = 0; k < W * H / 900; k++) { const x = rn() * W, y = rn() * H, t = k % 3; if (t === 0) { d.E(x, y, 6, 5, '#E86A10'); d.R(x - 1, y - 7, 2, 3, '#3E8A3A', false); d.P([[x - 3, y - 1], [x - 1, y - 1], [x - 2, y - 3]], O, false); d.P([[x + 3, y - 1], [x + 1, y - 1], [x + 2, y - 3]], O, false); } else if (t === 1) { d.P([[x, y], [x - 7, y - 3], [x - 4, y + 1], [x - 9, y + 2], [x - 2, y + 3], [x, y + 5], [x + 2, y + 3], [x + 9, y + 2], [x + 4, y + 1], [x + 7, y - 3]], '#1D2340', false); } else { d.c.beginPath(); d.c.arc(x, y, 5, Math.PI, 0); d.c.lineTo(x + 5, y + 7); d.c.lineTo(x + 2, y + 5); d.c.lineTo(x, y + 7); d.c.lineTo(x - 2, y + 5); d.c.lineTo(x - 5, y + 7); d.c.closePath(); d.c.fillStyle = '#FFFFFF'; d.c.fill(); d.C(x - 2, y, 0.8, O, false); d.C(x + 2, y, 0.8, O, false); } } },
    wp_rainbow(d, W, H) { const C = ['#E8505A', '#FF8A3D', '#FFD23F', '#3EA85A', '#4A8AE8', '#B07CFF']; for (let k = -Math.ceil(H / 12); k < W / 12 + 2; k++) d.P([[k * 12, 0], [k * 12 + 12, 0], [k * 12 + 12 + H * 0.6, H], [k * 12 + H * 0.6, H]], C[((k % 6) + 6) % 6], false); },
    wp_ship(d, W, H) { for (let x = 0; x < W; x += 40) { d.R(x + 1, 2, 38, H - 4, null, '#6A7896'); for (let y = 8; y < H; y += 30) { d.C(x + 5, y, 1.2, '#6A7896', false); d.C(x + 35, y, 1.2, '#6A7896', false); } } for (let x = 50; x < W - 40; x += 120) { d.R(x, 22, 34, 22, '#1D2340', '#4A5A80'); for (let k = 0; k < 4; k++) d.R(x + 4, 26 + k * 4.5, 10 + (k * 7) % 18, 2, k % 2 ? '#5AFF8A' : '#4AD8FF', false); } for (let x = 10; x < W; x += 80) for (let k = 0; k < 4; k++) d.R(x, H - 40 + k * 4, 20, 2, '#5A6886', false); d.R(0, H * 0.45, W, 3, '#4AD8FF', false); },
    wp_clay(d, W, H) { const rn = seeded(91); for (let k = 0; k < W * H / 40; k++) d.C(rn() * W, rn() * H, 0.5 + rn() * 0.8, rn() < 0.5 ? 'rgba(120,70,30,.18)' : 'rgba(255,230,190,.2)', false); for (let k = 0; k < W / 60; k++) d.Q(rn() * W, rn() * H, rn() * W, rn() * H, rn() * W, rn() * H, 'rgba(120,70,30,.12)', 2); },
    wp_dino(d, W, H) { d.R(0, H * 0.72, W, H * 0.28, '#F4D898', false); const rn = seeded(101); for (let x = 20; x < W; x += 70 + rn() * 30) { const by = H * 0.78; d.Q(x, by, x - 4, by - 30, x + 2, by - 44, '#8A5A34', 3); [-1.2, -0.4, 0.4, 1.2].forEach(a => d.E(x + 2 + Math.sin(a) * 9, by - 46 + Math.abs(a) * 3, 10, 3, '#3EA85A', false, a)); } for (let x = 50; x < W; x += 110) { const by = H * 0.8, col = x % 220 < 110 ? '#7FCF6A' : '#FF9AB0'; d.E(x, by - 10, 14, 9, col, O); d.Q(x + 10, by - 14, x + 16, by - 30, x + 20, by - 32, col, 6); d.C(x + 20, by - 32, 5, col); d.Q(x - 12, by - 8, x - 24, by - 6, x - 26, by - 12, col, 4); d.R(x - 8, by - 3, 4, 7, col, O); d.R(x + 4, by - 3, 4, 7, col, O); d.C(x + 21, by - 33, 0.9, O, false); } },
    wp_memo(d, W, H) { const rn = seeded(111), C = ['#FFF3B0', '#BDE6FF', '#FFD6E6', '#C8F5E4', '#FFFFFF']; for (let k = 0; k < W * H / 500; k++) { const x = rn() * (W - 14), y = rn() * (H - 14), col = C[k % 5]; d.c.save(); d.c.translate(x + 7, y + 7); d.c.rotate((rn() - 0.5) * 0.4); if (k % 4 === 0) { d.R(-7, -8, 14, 16, '#FFFFFF', O); d.R(-5.5, -6.5, 11, 10, ['#8AC8FF', '#7FCF6A', '#FFC08A'][k % 3], false); } else { d.R(-7, -7, 14, 14, col, O); d.L([[-4, -1], [4, -1]], 'rgba(29,35,64,.4)', 0.6); d.L([[-4, 2], [3, 2]], 'rgba(29,35,64,.4)', 0.6); } d.C(0, -6, 1.3, ['#E8505A', '#4A8AE8', '#3EA85A'][k % 3], false); d.c.restore(); } },
    wp_doodle(d, W, H) { const rn = seeded(121); for (let k = 0; k < W * H / 450; k++) { const x = rn() * W, y = rn() * H, t = k % 5; if (t === 0) { d.C(x, y, 5, null, O); d.C(x - 2, y - 1, 0.6, O, false); d.C(x + 2, y - 1, 0.6, O, false); d.Q(x - 2.5, y + 1.5, x, y + 4, x + 2.5, y + 1.5, O, 0.8); } else if (t === 1) { d.c.save(); d.star(x, y, 4.5, null); d.c.restore(); } else if (t === 2) d.L([[x - 6, y], [x - 3, y - 4], [x, y], [x + 3, y - 4], [x + 6, y]], '#4A5AA8', 1); else if (t === 3) d.heart(x, y, 3, null); else d.T(['WOW', '굿!', 'HI', '♪', 'LOL'][k % 5], x, y, 6, O, true); } },
    wp_jungle(d, W, H) { const rn = seeded(131), C = ['#3EA85A', '#5AC86A', '#2A7A3A', '#7FCF6A', '#4A9A4A']; for (let k = 0; k < W * H / 260; k++) { const x = rn() * W, y = rn() * H, a = rn() * 6.3, s = 0.7 + rn() * 0.7; d.E(x, y, 11 * s, 4.5 * s, C[k % 5], 'rgba(20,60,30,.5)', a); d.L([[x - Math.cos(a) * 10 * s, y - Math.sin(a) * 10 * s], [x + Math.cos(a) * 10 * s, y + Math.sin(a) * 10 * s]], 'rgba(20,60,30,.45)', 0.6); } },
    wp_xmas(d, W, H) { const rn = seeded(141); for (let k = 0; k < W * H / 80; k++) d.C(rn() * W, rn() * H, rn() < 0.2 ? 1.4 : 0.8, '#FFFFFF', false); d.R(0, H - 22, W, 22, '#FFFFFF', false); for (let x = 30; x < W; x += 80) { d.P([[x, H - 62], [x + 14, H - 22], [x - 14, H - 22]], '#2E8A4A'); d.star(x, H - 62, 3, '#FFD23F'); [[x - 4, H - 40, '#E8505A'], [x + 5, H - 32, '#FFD23F'], [x - 7, H - 28, '#4A8AE8']].forEach(([px, py, col]) => d.C(px, py, 1.6, col, false)); } for (let x = 70; x < W; x += 160) { d.C(x, H - 26, 8, '#FFFFFF'); d.C(x, H - 39, 6, '#FFFFFF'); d.C(x - 2, H - 40, 0.8, O, false); d.C(x + 2, H - 40, 0.8, O, false); d.P([[x, H - 38], [x + 4, H - 37], [x, H - 36.5]], '#FF8A3D', false); } },
    wp_chess(d, W, H) { const s = 16; for (let y = 0, r = 0; y < H; y += s, r++) for (let x = 0, k = 0; x < W; x += s, k++) if ((r + k) % 2) d.R(x, y, s, s, '#1D2340', false); },
    wp_fruit(d, W, H) { for (let y = 10, r = 0; y < H; y += 20, r++) for (let x = (r % 2) * 12 + 8; x < W; x += 24) { const lemon = (r + Math.floor(x / 24)) % 2; d.E(x, y, lemon ? 5.5 : 5, lemon ? 4.2 : 5, lemon ? '#FFE04A' : '#FF9A2A', 'rgba(140,80,20,.6)'); d.E(x + 2, y - 5, 2.4, 1.2, '#3EA85A', false, -0.5); } },
    wp_cyber(d, W, H) { for (let x = 0; x < W; x += 12) d.L([[x, 0], [x, H]], 'rgba(60,255,120,.12)', 0.6); for (let y = 0; y < H; y += 12) d.L([[0, y], [W, y]], 'rgba(60,255,120,.12)', 0.6); const rn = seeded(151); for (let x = 3; x < W; x += 7) { let y = rn() * H; const n = 4 + rn() * 10; for (let k = 0; k < n; k++, y += 5) d.R(x, y % H, 2, 3, k === n - 1 ? '#C8FFD8' : 'rgba(60,255,120,' + (0.25 + k / n * 0.6).toFixed(2) + ')', false); } },
    wp_kitsch(d, W, H) { const rn = seeded(161); for (let k = 0; k < W * H / 420; k++) { const x = rn() * W, y = rn() * H, t = k % 4; if (t === 0) { d.C(x, y, 5, '#FFD23F'); d.C(x - 1.8, y - 1, 0.7, O, false); d.C(x + 1.8, y - 1, 0.7, O, false); d.Q(x - 2.5, y + 1.5, x, y + 4, x + 2.5, y + 1.5, O, 0.8); } else if (t === 1) { d.Q(x, y - 7, x + 2, y - 2, x - 2, y, '#3EA85A', 1); d.Q(x, y - 7, x + 3, y - 3, x + 4, y + 1, '#3EA85A', 1); d.C(x - 2, y + 1, 2.6, '#E8303A'); d.C(x + 4, y + 2, 2.6, '#E8303A'); } else if (t === 2) d.P([[x + 1, y - 7], [x - 4, y + 1], [x, y + 1], [x - 2, y + 7], [x + 4, y - 1], [x, y - 1]], '#FFD23F'); else d.star(x, y, 3.6, '#FF8AC8'); } }
  };
  [['wp_brick', '붉은 벽돌 벽', 15, '#E8C8B0'], ['wp_rose', '장미 덩굴 벽', 15, '#F4ECD8'], ['wp_cloud', '구름 하늘', 12, '#9ADCFF'], ['wp_mintdot', '민트색 도트', 10, '#9AE6D0'], ['wp_concrete', '콘크리트 벽', 12, '#C4CAD6'],
    ['wp_neon', '네온 웨이브', 20, '#24124A'], ['wp_wave', '바다 물결', 18, '#BDE6FF'], ['wp_heart', '러블리 하트', 15, '#FFD0DC'], ['wp_pixel', '게임 도트 벽', 22, '#8AD0FF'], ['wp_forest', '숲속 나무', 18, '#BFE8A0'],
    ['wp_marble', '대리석 벽', 25, '#3E6A68'], ['wp_halloween', '할로윈 패턴', 20, '#FF9A3A'], ['wp_rainbow', '무지개 스트라이프', 15, '#FFFFFF'], ['wp_ship', '우주선 내부', 35, '#9AA6BE'], ['wp_clay', '자연 황토 벽', 12, '#C88A4A'],
    ['wp_dino', '공룡 세계', 15, '#BDE6FF'], ['wp_memo', '메모지 가득', 12, '#F4E8D0'], ['wp_doodle', '낙서 가득 벽', 10, '#FFFFFF'], ['wp_jungle', '정글 리프', 18, '#2A6A3A'], ['wp_xmas', '크리스마스 벽', 20, '#C8303A'],
    ['wp_chess', '체스보드 벽', 15, '#FFFFFF'], ['wp_fruit', '과일 패턴', 12, '#FFF6D8'], ['wp_cyber', '사이버 네트', 25, '#06140C'], ['wp_kitsch', '키치 레트로', 18, '#B8A8F0']
  ].forEach(([id, name, price, color]) => WALLS.push([id, name, price, color, 'spr']));

  /* ---- 옷장: 앞면 그림 (가로 W = 32 · 세로 H = 높이, 왼쪽 위가 0,0) · o = 열린 정도 0~1 ---- */
  // 옷장 안 (어두운 안쪽 + 옷걸이 봉 + 옷)
  function wdInside(d, x, y, w, h) { d.R(x, y, w, h, '#2A2238', false); d.L([[x + 1, y + 5], [x + w - 1, y + 5]], '#C8D4EC', 1); const C = ['#E8505A', '#4A8AE8', '#FFD23F', '#FF9AC0', '#3EA85A', '#B07CFF']; for (let k = 0; k * 4.5 + 3 < w - 2; k++) { const cx = x + 3 + k * 4.5; d.L([[cx, y + 5], [cx, y + 7]], '#C8D4EC', 0.6); d.P([[cx - 2, y + 7], [cx + 2, y + 7], [cx + 2, y + 7 + Math.min(h - 10, 16 + (k % 3) * 4)], [cx - 2, y + 7 + Math.min(h - 10, 16 + (k % 3) * 4)]], C[k % 6], false); } }
  // 여닫이 문 두 짝: 문 그림 deco(x, y, w, h, 왼쪽?) 은 닫혀 있을 때만
  function wdDoors(d, x, y, w, h, o, col, deco, n) {
    n = n || 2; wdInside(d, x, y, w, h); const dw = w / n, k = 1 - o * 0.82;
    for (let i = 0; i < n; i++) { const left = i < n / 2, ww = dw * k, xx = left ? x + i * dw * k : x + w - (n - i) * dw * k; d.R(xx, y, ww, h, col); if (o < 0.3 && deco) deco(xx, y, ww, h, left, i); else if (o >= 0.3) d.R(xx + 1, y + 1, ww - 2, h - 2, null, 'rgba(0,0,0,.25)'); }
    if (o < 0.3) { d.C(x + w / 2 - 2, y + h * 0.5, 0.9, '#FFD23F'); d.C(x + w / 2 + 2, y + h * 0.5, 0.9, '#FFD23F'); }
  }
  const WDS = {
    wd_sliding: { c: '#4A3428', h: 74, f(d, W, H, o, k) { d.R(1, 3, W - 2, H - 4, k); wdInside(d, 16, 5, 13, H - 8); d.R(3, 5, 14, H - 8, shade(k, 0.12)); const rx = 16 - 13 * o; d.R(rx, 5, 13, H - 8, shade(k, 0.05)); d.L([[3, 4], [W - 3, 4]], '#C8D4EC', 1); d.R(rx + 1.5, H / 2 - 4, 1.5, 8, '#C8D4EC', false); d.R(13, H / 2 - 4, 1.5, 8, '#C8D4EC', false); } },
    wd_vintage: { c: '#8A5A34', h: 94, f(d, W, H, o, k) { d.R(0, 2, W, 5, shade(k, 0.1)); wdDoors(d, 2, 8, W - 4, 44, o, k, (x, y, w, h) => { d.R(x + 2, y + 2, w - 4, h - 4, '#CDEBFF'); d.L([[x + w / 2, y + 2], [x + w / 2, y + h - 2]], k, 1); d.L([[x + 2, y + h / 2], [x + w - 2, y + h / 2]], k, 1); }); d.R(1, 53, W - 2, 3, shade(k, 0.15)); d.R(2, 57, W / 2 - 2, H - 61, shade(k, 0.05)); d.R(W / 2, 57, W / 2 - 2, H - 61, shade(k, 0.05)); d.R(5, 61, W / 2 - 8, H - 69, null, shade(k, -0.2)); d.R(W / 2 + 3, 61, W / 2 - 8, H - 69, null, shade(k, -0.2)); } },
    wd_mirror: { c: '#9A6A40', h: 96, f(d, W, H, o, k) { wdDoors(d, 2, 4, W - 4, H - 22, o, k, (x, y, w, h, left) => { if (left) { d.R(x + 2, y + 3, w - 4, h - 6, '#D8F0FF'); d.L([[x + 4, y + 10], [x + 8, y + 5]], '#FFFFFF', 1.4); } else d.R(x + 2, y + 3, w - 4, h - 6, null, shade(k, -0.2)); }); d.R(2, H - 16, W - 4, 12, shade(k, 0.05)); d.R(W / 2 - 3, H - 11, 6, 1.6, '#FFD23F', false); } },
    wd_bear: { c: '#8A5A3A', h: 90, f(d, W, H, o, k) { d.C(6, 4, 5, k); d.C(W - 6, 4, 5, k); d.C(6, 4, 2.5, '#C8925A', false); d.C(W - 6, 4, 2.5, '#C8925A', false); d.R(1, 3, W - 2, H - 3, k, O, 6); wdDoors(d, 4, 30, W - 8, H - 34, o, shade(k, 0.08)); d.C(10, 14, 1.6, O, false); d.C(W - 10, 14, 1.6, O, false); d.E(W / 2, 20, 6, 4.5, '#E8C8A0'); d.E(W / 2, 18.5, 2, 1.4, O, false); } },
    wd_boxes: { c: '#C8E8F0', h: 72, f(d, W, H, o, k) { const C = [['#C8B0FF', '#B098F0'], ['#FFC0D0', '#FFA8C0'], ['#A8E8D8', '#88D8C8'], ['#9AD8FF', '#7CC4F0'], ['#FFE8A0', '#F0D080']]; [[4, H - 22, 24, 20], [6, H - 42, 20, 18], [8, H - 60, 16, 16]].forEach(([x, y, w, h], i) => { d.R(x, y - o * 2 * i, w, h, C[i][0]); d.R(x - 1, y - o * 2 * i, w + 2, 4, C[i][1]); d.R(x + w / 2 - 3, y + 7 - o * 2 * i, 6, 2, 'rgba(29,35,64,.4)', false); }); } },
    wd_locker: { c: '#7A90B8', h: 96, f(d, W, H, o, k) { wdDoors(d, 2, 3, W - 4, H - 6, o, k, (x, y, w, h) => { for (let i = 0; i < 4; i++) d.L([[x + 3, y + 6 + i * 3], [x + w - 3, y + 6 + i * 3]], shade(k, -0.35), 1); d.R(x + w / 2 - 1.5, y + h / 2 - 2, 3, 6, '#C8D4EC', O); d.R(x + 3, y + h - 12, w - 6, 3, null, shade(k, -0.3)); }); } },
    wd_glass: { c: '#5A3A2A', h: 96, f(d, W, H, o, k) { d.R(0, 1, W, 5, shade(k, 0.1)); wdDoors(d, 2, 7, W - 4, H - 10, o, k, (x, y, w, h) => { d.R(x + 1.5, y + 2, w - 3, h - 4, 'rgba(205,235,255,.75)'); [0.3, 0.6].forEach(f => d.L([[x + 1.5, y + h * f], [x + w - 1.5, y + h * f]], k, 1)); d.C(x + w / 2, y + h * 0.22, 2, '#E8A0C0', false); d.R(x + w / 2 - 2, y + h * 0.48, 4, 4, '#FFD23F', false); d.C(x + w / 2, y + h * 0.78, 2.2, '#8AC8FF', false); d.L([[x + 3, y + 6], [x + 6, y + 3]], '#FFFFFF', 1); }); } },
    wd_bandaji: { c: '#5A3020', h: 64, f(d, W, H, o, k) { d.R(1, 4, W - 2, H - 8, k); d.R(3, 6, W - 6, 26, '#2A2238'); wdInside(d, 3, 6, W - 6, 26); d.R(3, 6 + o * 22, W - 6, 26 - o * 22, shade(k, 0.08)); if (o < 0.3) { d.C(W / 2, 20, 4, '#E8B040'); d.R(W / 2 - 1, 22, 2, 5, '#E8B040', false); [[5, 8], [W - 5, 8], [5, 30], [W - 5, 30]].forEach(([x, y]) => d.P([[x - 2, y - 2], [x + 2, y - 2], [x, y + 2]], '#E8B040', false)); } d.R(3, 36, W - 6, H - 44, shade(k, -0.05)); [[5, 40], [W - 5, 40]].forEach(([x, y]) => d.C(x, y, 1.8, '#E8B040', false)); d.R(2, H - 4, 3, 4, shade(k, -0.3)); d.R(W - 5, H - 4, 3, 4, shade(k, -0.3)); } },
    wd_hanger: { c: '#C8D4EC', h: 84, box: false, f(d, W, H, o, k) { d.R(1, 6, 2, H - 6, k); d.R(W - 3, 6, 2, H - 6, k); d.R(1, 6, W - 2, 2, k); const C = ['#E8505A', '#4A8AE8', '#3EA85A', '#FFD23F', '#B07CFF']; C.forEach((col, i) => { const x = 6 + i * 5; d.L([[x, 8], [x, 11]], '#C8D4EC', 0.6); d.P([[x - 2.2, 11], [x + 2.2, 11], [x + 2.6, 34 + (i % 2) * 6], [x - 2.6, 34 + (i % 2) * 6]], col); }); d.R(2, H - 18, W - 4, 2, k); [[6, '#1D2340'], [14, '#E8505A'], [22, '#FFFFFF']].forEach(([x, col]) => d.R(x, H - 22, 6, 4, col, O, 1)); d.R(2, H - 6, W - 4, 2, k); } },
    wd_drawer: { c: '#D8B890', h: 92, f(d, W, H, o, k) { wdDoors(d, 2, 3, W - 4, H - 32, o, k, (x, y, w, h) => d.R(x + 2, y + 3, w - 4, h - 6, null, shade(k, -0.18))); [H - 27, H - 14].forEach((y, i) => { d.R(2, y - o * 0, W - 4, 11, shade(k, 0.06)); d.R(W / 2 - 4, y + 4.5, 8, 2, '#8A5A34', false); }); } },
    wd_cyber: { c: '#2A3050', h: 96, f(d, W, H, o, k) { const c = d.c; wdDoors(d, 2, 3, W - 4, H - 6, o, k, (x, y, w, h, left) => { d.R(x + 2, y + 4, w - 4, h - 8, null, '#4A5A90'); d.L([[x + 3, y + h * 0.35], [x + w - 3, y + h * 0.35]], '#4A5A90', 1); }); c.save(); c.shadowColor = '#4AE8FF'; c.shadowBlur = 6; d.L([[2, 3], [2, H - 3], [W - 2, H - 3], [W - 2, 3], [2, 3]], '#4AE8FF', 1.4); c.shadowColor = '#FF4AC8'; d.L([[W / 2 - 6, H * 0.6], [W / 2 + 6, H * 0.6]], '#FF4AC8', 1.6); d.C(6, 8, 1.2, '#5AFF8A', false); c.restore(); } },
    wd_bunny: { c: '#FFC0D8', h: 88, f(d, W, H, o, k) { d.E(9, -4, 3.5, 11, k); d.E(W - 9, -4, 3.5, 11, k); d.E(9, -4, 1.6, 7, '#FF8AB0', false); d.E(W - 9, -4, 1.6, 7, '#FF8AB0', false); d.R(1, 4, W - 2, H - 4, k, O, 8); wdDoors(d, 4, 10, W - 8, H - 14, o, shade(k, 0.12), (x, y, w, h) => d.R(x + 1.5, y + 2, w - 3, h - 4, null, '#FF9AC0')); } },
    wd_bamboo: { c: '#C8A050', h: 96, f(d, W, H, o, k) { wdDoors(d, 2, 3, W - 4, H - 6, o, k, (x, y, w, h) => { for (let xx = x + 2; xx < x + w - 1; xx += 3) { d.L([[xx, y + 1], [xx, y + h - 1]], shade(k, -0.25), 0.8); for (let yy = y + 10; yy < y + h; yy += 18) d.L([[xx - 1, yy], [xx + 1, yy]], shade(k, -0.35), 1); } }); } },
    wd_corner: { c: '#C8924E', h: 92, f(d, W, H, o, k) { wdDoors(d, 2, 3, W - 4, H - 6, o, k, (x, y, w, h, left) => { d.R(x + 2, y + 3, w - 4, h - 6, left ? shade(k, 0.08) : shade(k, -0.08)); d.R(x + 2, y + 3, w - 4, h - 6, null, shade(k, -0.25)); }); } },
    wd_showroom: { c: '#5A3A28', h: 96, f(d, W, H, o, k) { d.R(1, 2, W - 2, H - 2, '#3A2A28'); d.L([[3, 9], [W - 3, 9]], '#C8D4EC', 1); const C = ['#E8505A', '#4A8AE8', '#FFF3B0', '#FF9AC0', '#3EA85A', '#1D2340']; C.forEach((col, i) => { const x = 5 + i * 4.3; d.P([[x - 2, 10], [x + 2, 10], [x + 2, 34 + (i % 2) * 5], [x - 2, 34 + (i % 2) * 5]], col, false); }); [48, 64, 80].forEach((y, r) => { d.R(2, y, W - 4, 2, k); for (let i = 0; i < 4; i++) d.R(4 + i * 7, y - 6, 6, 6, ['#FFD23F', '#E8505A', '#B07CFF', '#FFFFFF'][(i + r) % 4], O, 1); }); d.R(1, 2, W - 2, H - 2, null); } },
    wd_retro: { c: '#B8743A', h: 58, f(d, W, H, o, k) { d.R(1, 2, W - 2, H - 8, k); [0, 1, 2].forEach(r => [0, 1].forEach(c2 => { const x = 3 + c2 * 13.5, y = 4 + r * 15; d.R(x + (o * 0), y, 12.5, 13, ['#E8B040', '#C8503A'][(r + c2) % 2]); for (let i = 0; i < 3; i++) d.C(x + 3 + i * 3.4, y + 6.5, 1.2, '#FFF3B0', false); d.R(x + 4, y + 10, 4.5, 1.4, '#3A2A20', false); })); d.R(3, H - 6, 2.5, 6, shade(k, -0.3)); d.R(W - 5.5, H - 6, 2.5, 6, shade(k, -0.3)); } },
    wd_antique: { c: '#4A2A1E', h: 98, f(d, W, H, o, k) { d.c.beginPath(); d.c.moveTo(0, 10); d.c.quadraticCurveTo(W / 2, -4, W, 10); d.c.lineTo(W, 12); d.c.lineTo(0, 12); d.c.closePath(); d.c.fillStyle = shade(k, 0.15); d.c.fill(); d.c.strokeStyle = O; d.c.stroke(); d.C(W / 2, 5, 2, '#E8B040', false); wdDoors(d, 2, 13, W - 4, H - 22, o, k, (x, y, w, h) => { d.c.beginPath(); d.c.moveTo(x + 2, y + h - 3); d.c.lineTo(x + 2, y + 10); d.c.quadraticCurveTo(x + w / 2, y + 1, x + w - 2, y + 10); d.c.lineTo(x + w - 2, y + h - 3); d.c.closePath(); d.c.strokeStyle = '#B8803A'; d.c.lineWidth = 1; d.c.stroke(); }); d.R(1, H - 9, W - 2, 5, shade(k, 0.1)); d.R(2, H - 4, 3, 4, k); d.R(W - 5, H - 4, 3, 4, k); } },
    wd_plastic: { c: '#F4F4FA', h: 62, f(d, W, H, o, k) { d.R(2, 2, W - 4, H - 6, '#F4F4FA'); ['#9AC8FF', '#FFE88A', '#FFB0C8', '#A8E8D8'].forEach((col, i) => { const y = 4 + i * 13.5; d.R(4, y, W - 8, 12, col); d.R(W / 2 - 3, y + 2.5, 6, 2, 'rgba(255,255,255,.8)', false); }); d.C(6, H - 2, 2, '#1D2340'); d.C(W - 6, H - 2, 2, '#1D2340'); } },
    wd_jewel: { c: '#5A2A60', h: 96, f(d, W, H, o, k) { d.R(0, 1, W, 6, '#E8B040'); wdDoors(d, 2, 8, W - 4, H - 14, o, k, (x, y, w, h) => { d.R(x + 2, y + 3, w - 4, h - 6, null, '#E8B040'); d.P([[x + w / 2, y + h * 0.3], [x + w / 2 + 3, y + h * 0.36], [x + w / 2, y + h * 0.42], [x + w / 2 - 3, y + h * 0.36]], '#FF5A9A'); d.C(x + w / 2, y + h * 0.7, 2, '#4AD8FF'); }); d.R(0, H - 6, W, 4, '#E8B040'); } },
    wd_multi: { c: '#FFD23F', h: 92, f(d, W, H, o, k) { wdInside(d, 2, 3, W - 4, H - 6); const C = ['#FFD23F', '#4A8AE8', '#E8505A']; C.forEach((col, i) => { const w0 = (W - 4) / 3, w = w0 * (1 - o * 0.8), x = i === 0 ? 2 : i === 2 ? W - 2 - w : 2 + w0 + (w0 - w) / 2; d.R(x, 3, w, H - 6, col); if (o < 0.3) d.C(x + (i === 0 ? w - 2 : 2), H / 2, 0.9, O, false); }); d.R(1, H - 5, W - 2, 3, '#3EA85A'); } },
    wd_study: { c: '#9A6A40', h: 92, f(d, W, H, o, k) { d.R(1, 2, W - 2, H - 2, k); d.R(3, 4, 13, H - 6, shade(k, -0.4)); [4, 26, 48, 70].forEach((y, r) => { d.R(3, y + 18, 13, 2, k, false); const BK = ['#E8505A', '#4A8AE8', '#3EA85A', '#FFD23F', '#B07CFF']; for (let i = 0; i < 4; i++) d.R(4 + i * 3, y + 6 + (i % 2) * 2, 2.6, 12 - (i % 2) * 2, BK[(i + r) % 5], false); }); wdInside(d, 17, 4, 13, H - 6); d.R(17, 4, 13 * (1 - o * 0.8), H - 6, shade(k, 0.06)); if (o < 0.3) d.C(19, H / 2, 0.9, '#FFD23F'); } },
    wd_cloth: { c: '#3A4A70', h: 90, f(d, W, H, o, k) { d.R(1, 2, W - 2, 3, '#C8D4EC'); d.c.beginPath(); d.c.moveTo(2, 5); d.c.lineTo(W - 2, 5); d.c.quadraticCurveTo(W, H / 2, W - 2, H - 2); d.c.lineTo(2, H - 2); d.c.quadraticCurveTo(0, H / 2, 2, 5); d.c.fillStyle = k; d.c.fill(); d.c.strokeStyle = O; d.c.lineWidth = 1.2; d.c.stroke(); if (o > 0.3) { d.c.beginPath(); d.c.moveTo(W / 2, 8); d.c.quadraticCurveTo(W / 2 - 10 * o, H / 2, W / 2 - 8, H - 4); d.c.lineTo(W / 2 + 8, H - 4); d.c.quadraticCurveTo(W / 2 + 10 * o, H / 2, W / 2, 8); d.c.fillStyle = '#2A2238'; d.c.fill(); } d.L([[W / 2, 8], [W / 2, H - 4]], '#C8D4EC', 0.8); d.R(W / 2 - 1, 8, 2, 3, '#C8D4EC', false); for (let y = 12; y < H - 4; y += 3) d.L([[W / 2 - 0.8, y], [W / 2 + 0.8, y]], 'rgba(200,212,236,.7)', 0.5); } },
    wd_magic: { c: '#4A2A8A', h: 96, f(d, W, H, o, k) { const c = d.c; c.save(); c.globalAlpha = 0.5; [[3, H - 4, 6], [W - 3, H - 8, 7], [W - 6, 10, 5]].forEach(([x, y, r]) => d.C(x, y, r, '#C8B8FF', false)); c.restore(); d.R(0, 1, W, 5, '#E8B040'); wdDoors(d, 2, 7, W - 4, H - 13, o, k, (x, y, w, h, left) => { d.R(x + 2, y + 3, w - 4, h - 6, null, '#E8B040'); if (left) { d.C(x + w / 2, y + h * 0.35, 3, '#FFE88A', false); d.C(x + w / 2 + 1.5, y + h * 0.33, 2.6, k, false); } else d.star(x + w / 2, y + h * 0.35, 3, '#FFE88A'); d.star(x + w / 2, y + h * 0.7, 1.8, '#C8B8FF'); }); d.R(0, H - 6, W, 4, '#E8B040'); } },
    wd_toy: { c: '#E8C890', h: 60, f(d, W, H, o, k) { d.R(1, 2, W - 2, H - 2, k); [[3, 4], [17, 4], [3, 30], [17, 30]].forEach(([x, y], i) => { d.R(x, y, 12, 24, shade(k, -0.45)); if (i === 0) { d.C(x + 6, y + 16, 5, '#C8925A'); d.C(x + 6, y + 9, 3.6, '#C8925A'); } else if (i === 1) { d.C(x + 6, y + 18, 5, '#E8505A'); d.L([[x + 1.5, y + 18], [x + 10.5, y + 18]], '#FFFFFF', 1); } else if (i === 2) { d.R(x + 1, y + 14, 5, 5, '#4A8AE8', O); d.R(x + 6, y + 14, 5, 5, '#FFD23F', O); d.R(x + 3.5, y + 9, 5, 5, '#3EA85A', O); } else { d.R(x + 2, y + 10, 8, 9, '#FF9AC0', O); d.C(x + 6, y + 8, 3, '#FFD6E6'); } }); } },
    wd_pirate: { c: '#7A5030', h: 80, f(d, W, H, o, k) { d.c.beginPath(); d.c.moveTo(1, 14); d.c.quadraticCurveTo(W / 2, 0, W - 1, 14); d.c.lineTo(W - 1, H - 2); d.c.lineTo(1, H - 2); d.c.closePath(); d.c.fillStyle = k; d.c.fill(); d.c.strokeStyle = O; d.c.lineWidth = 1.2; d.c.stroke(); if (o > 0.3) wdInside(d, 4, 18, W - 8, H - 24); else { for (let y = 20; y < H - 2; y += 8) d.L([[2, y], [W - 2, y]], shade(k, -0.25), 0.8); } [5, W - 7].forEach(x => d.R(x, 8, 2.5, H - 10, '#3A4270', false)); d.R(1, 16, W - 2, 3, '#3A4270', false); d.R(W / 2 - 3, 20, 6, 7, '#E8B040', O); d.C(W / 2, 23, 1, O, false); } },
    wd_grid: { c: '#7A4A2A', h: 92, f(d, W, H, o, k) { wdDoors(d, 2, 3, W - 4, H - 6, o, k, (x, y, w, h) => { d.R(x + 2, y + 3, w - 4, h * 0.55, '#F4E8C8'); for (let xx = x + 2 + (w - 4) / 3; xx < x + w - 2.5; xx += (w - 4) / 3) d.L([[xx, y + 3], [xx, y + 3 + h * 0.55]], k, 0.8); for (let yy = y + 3 + 6; yy < y + 3 + h * 0.55; yy += 6) d.L([[x + 2, yy], [x + w - 2, yy]], k, 0.8); d.R(x + 2, y + h * 0.62, w - 4, h * 0.32, null, shade(k, -0.25)); }); } }
  };
  [['wd_sliding', '슬라이딩 옷장', 40], ['wd_vintage', '빈티지 캐비닛', 25], ['wd_mirror', '거울 달린 옷장', 35], ['wd_bear', '귀여운 곰 옷장', 45], ['wd_boxes', '조립식 수납장', 20],
    ['wd_locker', '철제 락커', 18], ['wd_glass', '유리 장식장', 45], ['wd_bandaji', '한옥 반닫이', 30], ['wd_hanger', '공간 절약 행거', 15], ['wd_drawer', '서랍형 옷장', 28],
    ['wd_cyber', '사이버 펑크 옷장', 60], ['wd_bunny', '토끼 옷장', 45], ['wd_bamboo', '대나무 옷장', 35], ['wd_corner', '코너 옷장', 38], ['wd_showroom', '쇼룸 드레스룸', 55],
    ['wd_retro', '레트로 서랍장', 22], ['wd_antique', '엔틱 아모아', 50], ['wd_plastic', '미니 플라스틱 함', 12], ['wd_jewel', '보석함 옷장', 40], ['wd_multi', '컬러풀 멀티장', 25],
    ['wd_study', '학습용 옷장', 30], ['wd_cloth', '간이 천 옷장', 10], ['wd_magic', '마법사의 장롱', 60], ['wd_toy', '장난감 보관장', 28], ['wd_pirate', '해적 보물장', 45], ['wd_grid', '도트 격자 옷장', 18]
  ].forEach(([id, name, price]) => WARDROBES.push([id, name, price, WDS[id].c]));
  // 옷장 몸통 + 앞면 그림
  function drawWdSpr(g, it, i, j, r, open) {
    const S2 = WDS[it.id], L = local(g, i, j, r), h = S2.h, k = S2.c;
    if (S2.box !== false) L.box(0.04, 0.42, 0.92, 0.58, h - 2, 0, shade(k, -0.05), { top: shade(k, 0.12) });
    else { L.box(0.04, 0.3, 0.06, 0.66, 2, 0, k); L.box(0.9, 0.3, 0.06, 0.66, 2, 0, k); }
    const o = r ? L.P(1, 1, h) : L.P(0, 1, h), x1 = r ? L.P(0, 1, h) : L.P(1, 1, h), c = g.c;
    c.save(); c.transform((x1[0] - o[0]) / 32, (x1[1] - o[1]) / 32, 0, 1, o[0], o[1]); c.lineJoin = 'round'; c.lineCap = 'round';
    try { S2.f(sprPen(c), 32, h, open || 0, k); } catch (err) { /* noop */ }
    c.restore();
  }
  /* ---- v93 바닥 20종: 바닥 전체에 그리는 무늬 (가로 W · 세로 D = 칸 수 × 32, i 방향이 가로) ---- */
  const FLS = {
    fl_herring(d, W, D) { for (let y = -16, r = 0; y < D + 16; y += 8, r++) for (let x = -16 + (r % 2) * 8; x < W + 16; x += 16) { d.c.save(); d.c.translate(x, y); d.c.rotate(r % 2 ? Math.PI / 4 : -Math.PI / 4); d.R(-8, -2.6, 16, 5.2, r % 3 ? '#C8925A' : '#B8824A', 'rgba(90,50,20,.45)'); d.c.restore(); } },
    fl_darkwood(d, W, D) { for (let y = 0, r = 0; y < D; y += 8, r++) { d.R(0, y, W, 8, r % 2 ? '#6A4026' : '#5A3420', false); for (let x = (r * 13) % 40; x < W; x += 40) d.L([[x, y], [x, y + 8]], '#3A2014', 0.8); d.L([[0, y], [W, y]], '#3A2014', 0.8); } },
    fl_whitetile(d, W, D) { for (let x = 0; x <= W; x += 16) d.L([[x, 0], [x, D]], '#BFD8EE', 1); for (let y = 0; y <= D; y += 16) d.L([[0, y], [W, y]], '#BFD8EE', 1); },
    fl_hex(d, W, D) { const s = 7; for (let r = 0, y = 0; y < D + s; y += s * 1.5, r++) for (let x = (r % 2) * s * 0.87; x < W + s; x += s * 1.74) { const pts = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; pts.push([x + Math.cos(a) * s, y + Math.sin(a) * s]); } d.P(pts, (r * 7 + Math.round(x)) % 9 === 0 ? '#9AE6D0' : null, '#B8AE9A'); } },
    fl_mosaic(d, W, D) { const rn = seeded(201), C = ['#2A6AC8', '#4A8AE8', '#8AC8FF', '#FFFFFF', '#3A5AA8']; for (let y = 0; y < D; y += 8) for (let x = 0; x < W; x += 8) d.R(x + 0.5, y + 0.5, 7, 7, C[Math.floor(rn() * 5)], false); },
    fl_pinkcheck(d, W, D) { for (let y = 0, r = 0; y < D; y += 16, r++) for (let x = 0, k = 0; x < W; x += 16, k++) if ((r + k) % 2) d.R(x, y, 16, 16, '#FF9AC0', false); },
    fl_mintcheck(d, W, D) { for (let y = 0, r = 0; y < D; y += 16, r++) for (let x = 0, k = 0; x < W; x += 16, k++) if ((r + k) % 2) d.R(x, y, 16, 16, '#7FD8B8', false); },
    fl_sand(d, W, D) { const rn = seeded(211); for (let k = 0; k < W * D / 30; k++) d.C(rn() * W, rn() * D, 0.6, rn() < 0.5 ? 'rgba(180,140,70,.35)' : 'rgba(255,255,255,.5)', false); for (let k = 0; k < W * D / 3000; k++) { const x = rn() * W, y = rn() * D; if (k % 2) d.star(x, y, 4, '#FF8A5A'); else { d.c.beginPath(); d.c.arc(x, y, 3.5, Math.PI, 0); d.c.closePath(); d.c.fillStyle = '#FFD6E6'; d.c.fill(); d.c.strokeStyle = O; d.c.lineWidth = 0.8; d.c.stroke(); } } },
    fl_water(d, W, D) { for (let y = 6; y < D; y += 10) for (let x = (y % 20) / 2; x < W; x += 20) d.Q(x, y, x + 5, y - 3, x + 10, y, 'rgba(255,255,255,.65)', 1); for (let i = 0; i < W / 32; i++) for (let j = 0; j < D / 32; j++) if ((i + j * 3) % 4 === 0 || (i * 5 + j) % 7 === 0) d.E(i * 32 + 16, j * 32 + 16, 10, 8, '#C8C0B0', O); },
    fl_snow(d, W, D) { const rn = seeded(221); for (let k = 0; k < W * D / 40; k++) d.C(rn() * W, rn() * D, 0.7, rn() < 0.6 ? '#C8E0FF' : '#FFFFFF', false); for (let k = 0; k < 6; k++) { const x = 20 + k * 30, y = 30 + (k % 2) * 8 + k * 26; if (x < W && y < D) { d.E(x, y, 2.5, 4, 'rgba(150,180,220,.5)', false); d.E(x + 6, y + 6, 2.5, 4, 'rgba(150,180,220,.5)', false); } } },
    fl_brick(d, W, D) { for (let y = 0, r = 0; y < D; y += 10, r++) for (let x = (r % 2) * -10; x < W; x += 20) d.R(x + 0.8, y + 0.8, 18.4, 8.4, r % 3 ? '#B8603A' : '#A8502E', false); for (let y = 0; y < D; y += 10) d.L([[0, y], [W, y]], '#E8C8A8', 1.2); },
    fl_stone(d, W, D) { const rn = seeded(231); for (let k = 0; k < W * D / 90; k++) d.C(rn() * W, rn() * D, 0.8, '#5A9A48', false); for (let j = 0; j < D; j += 16) for (let i = (j / 16 % 2) * 8; i < W; i += 16) d.E(i + 8 + (rn() - 0.5) * 3, j + 8 + (rn() - 0.5) * 3, 6 + rn() * 1.5, 5 + rn(), '#D8D0C0', '#8A8070', rn() * 3); },
    fl_neon(d, W, D) { const c = d.c; c.save(); c.shadowBlur = 5; c.shadowColor = '#4AE8FF'; for (let x = 0; x <= W; x += 32) d.L([[x, 0], [x, D]], '#4AE8FF', 1.2); c.shadowColor = '#FF4AC8'; for (let y = 0; y <= D; y += 32) d.L([[0, y], [W, y]], '#FF4AC8', 1.2); c.restore(); },
    fl_rainbow(d, W, D) { const C = ['#FF9AA8', '#FFC08A', '#FFE88A', '#A8E8A0', '#9AD8FF', '#C8B0FF']; for (let y = 0, k = 0; y < D; y += 16, k++) d.R(0, y, W, 16.4, C[k % 6], false); },
    fl_flower(d, W, D) { const rn = seeded(241), C = ['#FFFFFF', '#FFD23F', '#FF8AB8', '#B07CFF', '#FF6A5A']; for (let k = 0; k < W * D / 70; k++) { const x = rn() * W, y = rn() * D, col = C[k % 5]; for (let p = 0; p < 5; p++) { const a = p / 5 * 6.28; d.C(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.3, col, false); } d.C(x, y, 1, '#FFB020', false); } },
    fl_pixel(d, W, D) { for (let y = 0; y < D; y += 16) for (let x = 0; x < W; x += 16) { const top = ((x + y) / 16) % 5 === 0; d.R(x, y, 16, 16, top ? '#5AC85A' : '#C8783A', false); d.L([[x, y + 16], [x, y], [x + 16, y]], 'rgba(255,255,255,.35)', 1.2); d.L([[x + 16, y], [x + 16, y + 16], [x, y + 16]], 'rgba(60,30,10,.4)', 1.2); if (!top) { d.R(x + 4, y + 5, 2, 2, '#8A5A2A', false); d.R(x + 10, y + 10, 2, 2, '#8A5A2A', false); } } },
    fl_heartcarpet(d, W, D) { for (let y = 8, r = 0; y < D; y += 16, r++) for (let x = (r % 2) * 8 + 8; x < W; x += 16) d.heart(x, y, 2.8, '#FF9AB8'); },
    fl_station(d, W, D) { for (let x = 0; x < W; x += 32) for (let y = 0; y < D; y += 32) { d.R(x + 1, y + 1, 30, 30, null, '#5A6684'); [[4, 4], [28, 4], [4, 28], [28, 28]].forEach(([u, v]) => d.C(x + u, y + v, 1, '#5A6684', false)); } const c = d.c; c.save(); c.shadowBlur = 5; c.shadowColor = '#4AD8FF'; for (let y = 16; y < D; y += 64) d.L([[0, y], [W, y]], '#4AD8FF', 1.4); c.restore(); },
    fl_terrazzo(d, W, D) { const rn = seeded(251), C = ['#E8A0A0', '#9AC8E8', '#E8C878', '#8AC8A0', '#3A4270']; for (let k = 0; k < W * D / 45; k++) { const x = rn() * W, y = rn() * D, s = 0.8 + rn() * 1.8; d.P([[x, y - s], [x + s, y], [x + s * 0.3, y + s], [x - s, y + s * 0.2]], C[k % 5], false); } },
    fl_wool(d, W, D) { const rn = seeded(261); for (let k = 0; k < W * D / 12; k++) { const x = rn() * W, y = rn() * D; d.L([[x, y], [x + (rn() - 0.5) * 3, y + (rn() - 0.5) * 3]], rn() < 0.5 ? 'rgba(200,170,140,.35)' : 'rgba(255,255,255,.6)', 1); } }
  };
  [['fl_herring', '헤링본 마루', 25, '#D8A468'], ['fl_darkwood', '짙은 원목', 15, '#6A4026'], ['fl_whitetile', '화이트 타일', 12, '#F8F8FC'], ['fl_hex', '육각 타일', 20, '#F0E8DA'], ['fl_mosaic', '모자이크 타일', 22, '#4A8AE8'],
    ['fl_pinkcheck', '분홍 체크 바닥', 15, '#FFFFFF'], ['fl_mintcheck', '민트 체크 바닥', 15, '#FFFFFF'], ['fl_sand', '모래사장', 20, '#F4D898'], ['fl_water', '물 위 징검다리', 30, '#5AB8F0'], ['fl_snow', '눈 바닥', 20, '#F4F8FF'],
    ['fl_brick', '벽돌 바닥', 18, '#E8C8A8'], ['fl_stone', '돌길 정원', 18, '#7FB060'], ['fl_neon', '네온 그리드', 30, '#14082E'], ['fl_rainbow', '무지개 바닥', 25, '#FFFFFF'], ['fl_flower', '꽃밭', 25, '#6AC060'],
    ['fl_pixel', '게임 블록 바닥', 22, '#C8783A'], ['fl_heartcarpet', '하트 카펫', 18, '#E8505A'], ['fl_station', '우주 정거장 바닥', 35, '#8A96B0'], ['fl_terrazzo', '테라조', 22, '#F4ECE0'], ['fl_wool', '털 카펫', 15, '#F4E8D8']
  ].forEach(([id, name, price, color]) => FLOORS.push([id, name, price, color, 'spr']));
  function floorSpr(g, n, flI) {
    if (flI.pat !== 'spr' || !FLS[flI.id]) return;
    const c = g.c, o = g.P(0, 0, 0), a = g.P(1, 0, 0), b = g.P(0, 1, 0);
    c.save(); c.beginPath(); [g.P(0, 0, 0), g.P(n, 0, 0), g.P(n, n, 0), g.P(0, n, 0)].forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.clip();
    c.transform((a[0] - o[0]) / 32, (a[1] - o[1]) / 32, (b[0] - o[0]) / 32, (b[1] - o[1]) / 32, o[0], o[1]); c.lineJoin = 'round'; c.lineCap = 'round';
    try { FLS[flI.id](sprPen(c), n * 32, n * 32); } catch (err) { /* noop */ }
    c.restore();
  }

  /* ---- v93 새 가구 30종 (L = 가구 좌표 도구: box · front · side · flat · ell · dot · P · poly) ---- */
  const cyl = (L, u, v, z, rx, ry, h, col) => { for (let t = 0; t < h; t += 1.5) L.ell(u, v, z + t, rx, ry, shade(col, -0.22), false); L.ell(u, v, z + h, rx, ry, col); };
  const cone = (L, u, v, z, R, H, col) => { const p = L.P(u, v, z); L.poly([[p[0], p[1] - H], [p[0] - R, p[1]], [p[0] + R, p[1]]], col); };
  [
    ['f_sofa2', '2인 패브릭 소파', 35, 'chair', 2, 1, 30, (L, k) => { k = k || '#7A9AE8'; L.box(0, 0, 2, 0.3, 28, 0, k); L.box(0, 0.3, 2, 0.7, 10, 0, shade(k, -0.2)); L.box(0.15, 0.3, 0.84, 0.65, 6, 10, k); L.box(1.01, 0.3, 0.84, 0.65, 6, 10, k); L.box(0, 0.3, 0.15, 0.7, 18, 0, k); L.box(1.85, 0.3, 0.15, 0.7, 18, 0, k); L.box(0.3, 0.12, 0.4, 0.2, 12, 14, '#FFD23F'); }, 'sit'],
    ['f_armchair', '1인 안락의자', 22, 'chair', 1, 1, 34, (L, k) => { k = k || '#E8A05A'; L.box(0, 0, 1, 0.28, 32, 0, k); L.box(0, 0.28, 1, 0.72, 10, 0, shade(k, -0.2)); L.box(0.15, 0.28, 0.7, 0.67, 6, 10, k); L.box(0, 0.28, 0.15, 0.72, 20, 0, k); L.box(0.85, 0.28, 0.15, 0.72, 20, 0, k); }, 'sit'],
    ['f_stool', '동그란 스툴', 8, 'chair', 1, 1, 22, (L, k) => { L.box(0.44, 0.44, 0.12, 0.12, 16, 0, W2); L.ell(0.5, 0.5, 2, 9, 4.5, W2); cyl(L, 0.5, 0.5, 16, 12, 6, 4, k || '#FF8AB8'); }, 'sit'],
    ['f_gamechair', '게이밍 의자', 40, 'chair', 1, 1, 50, (L, k) => { k = k || '#E8505A'; L.ell(0.5, 0.5, 1, 13, 6.5, NAVY); L.box(0.45, 0.45, 0.1, 0.1, 14, 0, NAVY); L.box(0.15, 0.2, 0.7, 0.7, 6, 14, '#1D2340'); L.box(0.18, 0.12, 0.64, 0.12, 36, 18, k); L.front(0.24, 0.3, 0.7, 24, 50, '#1D2340', false); L.box(0.08, 0.3, 0.08, 0.5, 4, 24, NAVY); L.box(0.84, 0.3, 0.08, 0.5, 4, 24, NAVY); }, 'sit'],
    ['f_swing', '그네 의자', 45, 'chair', 1, 1, 70, (L, k) => { L.ell(0.85, 0.15, 0, 9, 4.5, '#C8D4EC'); L.box(0.82, 0.12, 0.07, 0.07, 70, 0, '#C8D4EC'); L.box(0.45, 0.12, 0.44, 0.07, 4, 66, '#C8D4EC'); L.box(0.49, 0.49, 0.03, 0.03, 30, 38, '#C8D4EC'); L.ell(0.5, 0.52, 26, 17, 14, '#E8C890'); L.ell(0.5, 0.58, 26, 12, 8, k || '#7FE0C4'); L.ell(0.5, 0.45, 42, 12, 8, '#E8C890'); }, 'sit'],
    ['f_canopy', '캐노피 공주 침대', 60, 'bed', 2, 2, 90, (L, k) => { k = k || '#FF9AC0'; [[0, 0], [1.9, 0]].forEach(([u, v]) => L.box(u, v, 0.1, 0.1, 88, 0, '#FFFFFF')); L.box(0, 0, 2, 0.14, 40, 0, '#FFFFFF'); L.box(0, 0.14, 2, 1.86, 10, 0, '#F4E8F0'); L.box(0.06, 0.14, 1.88, 1.8, 7, 10, WHITE); L.box(0.15, 0.18, 0.75, 0.42, 6, 17, '#FFFFFF'); L.box(1.1, 0.18, 0.75, 0.42, 6, 17, '#FFFFFF'); L.box(0.06, 0.7, 1.88, 1.24, 3, 17, k); [[0, 1.9], [1.9, 1.9]].forEach(([u, v]) => L.box(u, v, 0.1, 0.1, 88, 0, '#FFFFFF')); L.box(0, 0, 2, 2, 3, 86, '#FFD6E6'); L.front(2, 0, 2, 76, 86, k); L.side(2, 0, 2, 76, 86, shade(k, -0.1)); }, 'sleep'],
    ['f_yo', '한옥 이불(요)', 20, 'bed', 1, 2, 10, (L, k) => { L.box(0.05, 0.1, 0.9, 1.85, 4, 0, '#F4E8C8'); L.box(0.2, 0.15, 0.6, 0.3, 4, 4, '#E8505A'); L.box(0.05, 0.6, 0.9, 1.35, 3, 4, k || '#4A8AE8'); [[0.3, 0.9], [0.7, 1.2], [0.4, 1.6]].forEach(([u, v]) => L.dot(u, v, 7.2, 1.5, '#FFD23F')); }, 'sleep'],
    ['f_dresser', '화장대', 30, 'storage', 1, 1, 70, (L, k) => { k = k || '#F4E8E0'; L.box(0.05, 0.35, 0.08, 0.08, 20, 0, W2); L.box(0.87, 0.35, 0.08, 0.08, 20, 0, W2); L.box(0.05, 0.85, 0.08, 0.08, 20, 0, W2); L.box(0.87, 0.85, 0.08, 0.08, 20, 0, W2); L.box(0, 0.3, 1, 0.7, 10, 20, k); L.front(1, 0.3, 0.7, 23, 27, shade(k, -0.15)); L.box(0.15, 0.3, 0.7, 0.08, 38, 30, k); L.front(0.38, 0.22, 0.78, 36, 64, '#D8F0FF'); L.dot(0.3, 0.6, 32, 2, PINK); L.dot(0.7, 0.55, 32, 1.6, YEL); }, null],
    ['f_kitchen', '미니 주방', 50, 'elec', 2, 1, 46, (L, k) => { k = k || '#F4F0E8'; L.box(0, 0.2, 2, 0.8, 40, 0, k); L.box(0, 0.2, 2, 0.8, 3, 40, '#C8D4EC'); L.front(1, 0.06, 0.94, 4, 34, '#BDE6FF'); L.front(1, 1.06, 1.94, 4, 34, '#BDE6FF'); L.flat(0.15, 0.35, 0.85, 0.85, 43.2, '#8AC8FF'); L.box(0.45, 0.22, 0.06, 0.06, 10, 43, '#C8D4EC'); L.ell(1.3, 0.5, 43.4, 6, 3, NAVY); L.ell(1.7, 0.7, 43.4, 6, 3, NAVY); L.box(1.6, 0.6, 0.25, 0.2, 8, 43, RED); }, 'play'],
    ['f_dining', '식탁 세트', 35, 'desk', 2, 1, 32, (L, k) => { legs(L, 2, 1, 26, W2); L.box(0, 0, 2, 1, 4, 26, k || '#E8C890'); [[0.5, 0.5], [1.5, 0.5]].forEach(([u, v]) => { L.ell(u, v, 30.5, 8, 4, '#FFFFFF'); L.ell(u, v, 31, 4, 2, '#FF8A3D', false); }); L.box(0.95, 0.4, 0.1, 0.1, 8, 30, '#BDE6FF'); }, null],
    ['f_guitar', '기타 스탠드', 25, 'elec', 1, 1, 64, (L, k) => { L.box(0.4, 0.45, 0.2, 0.12, 3, 0, NAVY); L.ell(0.5, 0.55, 16, 10, 11, k || '#E8903A'); L.ell(0.5, 0.55, 30, 8, 8, k || '#E8903A'); L.ell(0.5, 0.6, 22, 3, 3, '#3A2014', false); L.box(0.47, 0.52, 0.06, 0.06, 26, 36, '#8A5A34'); L.box(0.44, 0.5, 0.12, 0.1, 6, 60, '#5A3420'); }, 'music'],
    ['f_drum', '드럼 세트', 55, 'elec', 2, 1, 46, (L, k) => { L.box(1.6, 0.3, 0.05, 0.05, 38, 0, '#C8D4EC'); L.ell(1.62, 0.32, 38, 10, 4, '#FFD23F'); cyl(L, 1, 0.45, 0, 14, 8, 20, k || RED); L.ell(1, 0.6, 12, 6, 6, '#FFFFFF', false); cyl(L, 0.7, 0.35, 22, 7, 4, 6, k || RED); cyl(L, 1.3, 0.35, 22, 7, 4, 6, k || RED); L.box(0.38, 0.7, 0.05, 0.05, 14, 0, '#C8D4EC'); cyl(L, 0.4, 0.72, 14, 8, 4, 5, '#F4F0E8'); }, 'music'],
    ['f_arcade', '오락실 게임기', 60, 'elec', 1, 1, 82, (L, k) => { k = k || '#4A2A8A'; L.box(0.1, 0.2, 0.8, 0.8, 80, 0, k); L.front(1, 0.1, 0.9, 72, 80, '#FFD23F'); L.front(1, 0.18, 0.82, 44, 68, '#1D2340'); L.front(1, 0.24, 0.76, 48, 64, '#3A6AD8', false); L.dot(0.4, 1, 58, 2, '#FFE45C'); L.dot(0.6, 1, 52, 2, '#5AFF8A'); L.front(1, 0.14, 0.86, 30, 38, RED); L.dot(0.35, 1, 34, 1.6, YEL); L.dot(0.65, 1, 34, 1.6, '#4AD8FF'); }, 'play'],
    ['f_tvstand', '대형 TV 장', 50, 'elec', 2, 1, 62, (L, k) => { L.box(0, 0.4, 2, 0.6, 16, 0, k || W); L.front(1, 0.1, 0.95, 3, 13, shade(k || W, -0.15)); L.front(1, 1.05, 1.9, 3, 13, shade(k || W, -0.15)); L.box(0.9, 0.5, 0.2, 0.15, 3, 16, NAVY); L.box(0.1, 0.55, 1.8, 0.06, 40, 20, NAVY); L.front(0.61, 0.16, 1.84, 23, 57, '#3A5AC8'); L.front(0.61, 0.3, 0.9, 40, 52, '#7FE0C4', false); }, 'screen'],
    ['f_gamingpc', '게이밍 PC 책상', 55, 'desk', 2, 1, 60, (L, k) => { legs(L, 2, 1, 28, NAVY); L.box(0, 0, 2, 1, 3, 28, '#1D2340'); L.box(0.95, 0.2, 0.1, 0.08, 4, 31, NAVY); L.box(0.4, 0.15, 1.1, 0.06, 22, 34, NAVY); L.front(0.21, 0.45, 1.45, 36, 54, '#4AD8FF'); L.flat(0.6, 0.55, 1.3, 0.75, 31.2, '#FF8AB8'); L.box(1.6, 0.2, 0.3, 0.6, 24, 31, '#2A3050'); L.front(0.8, 1.63, 1.87, 34, 52, '#B07CFF'); }, 'screen'],
    ['f_cattower', '캣타워', 35, 'deco', 1, 1, 84, (L, k) => { k = k || '#C8925A'; L.box(0, 0, 1, 1, 6, 0, k); L.box(0.2, 0.2, 0.12, 0.12, 60, 6, '#E8D4A8'); L.box(0.68, 0.6, 0.12, 0.12, 26, 6, '#E8D4A8'); L.box(0.45, 0.45, 0.5, 0.5, 5, 30, k); L.box(0.05, 0.05, 0.55, 0.55, 14, 66, k); L.front(0.6, 0.2, 0.45, 68, 76, '#3A2014'); L.ell(0.72, 0.72, 39, 7, 5, '#FF9A3A'); L.ell(0.62, 0.7, 45, 4.5, 4, '#FF9A3A'); }, 'play'],
    ['f_monstera', '몬스테라 화분', 15, 'plant', 1, 1, 64, (L, k) => { L.box(0.3, 0.3, 0.4, 0.4, 16, 0, k || '#F4F0E8'); [[0.3, 0.4, 40, -0.5], [0.7, 0.4, 48, 0.4], [0.45, 0.7, 34, 0.2], [0.55, 0.3, 58, -0.2], [0.3, 0.7, 50, 0.8]].forEach(([u, v, z, a]) => { L.box(0.48, 0.48, 0.03, 0.03, z - 16, 16, '#2E8A4A', { line: false }); const p = L.P(u, v, z); L.c.save(); L.c.translate(p[0], p[1]); L.c.rotate(a); L.c.beginPath(); L.c.ellipse(0, 0, 11, 7, 0, 0, 7); L.c.fillStyle = '#2E8A4A'; L.c.fill(); L.c.strokeStyle = O; L.c.lineWidth = 1; L.c.stroke(); L.c.strokeStyle = '#7FCF6A'; L.c.beginPath(); L.c.moveTo(-9, 0); L.c.lineTo(9, 0); L.c.stroke(); L.c.restore(); }); }, null],
    ['f_sunflower', '해바라기 화분', 12, 'plant', 1, 1, 62, (L, k) => { L.box(0.35, 0.35, 0.3, 0.3, 12, 0, k || '#D87A4A'); L.box(0.48, 0.48, 0.04, 0.04, 40, 12, GRN, { line: false }); L.ell(0.38, 0.5, 28, 6, 3, GRN); L.ell(0.62, 0.5, 36, 6, 3, GRN); L.ell(0.5, 0.5, 54, 10, 10, YEL); L.ell(0.5, 0.5, 54, 5, 5, '#8A5A34'); }, null],
    ['f_mushlamp', '버섯 무드등', 18, 'light', 1, 1, 30, (L, k) => { L.box(0.42, 0.42, 0.16, 0.16, 14, 0, '#F4F0E8'); L.ell(0.5, 0.5, 16, 13, 7, shade(k || RED, -0.2)); L.ell(0.5, 0.5, 20, 12, 7, k || RED); L.ell(0.5, 0.5, 24, 8, 4.5, k || RED, false); [[0.4, 0.45], [0.6, 0.55], [0.55, 0.35]].forEach(([u, v]) => L.dot(u, v, 23, 1.5, '#FFFFFF')); }, 'light'],
    ['f_fireplace', '벽난로', 55, 'deco', 2, 1, 62, (L, k) => { L.box(0, 0.3, 2, 0.7, 56, 0, k || '#C8603A'); for (let z = 8; z < 56; z += 8) L.front(1, 0.02, 1.98, z, z + 0.6, '#E8C8A8', false); L.box(-0.05, 0.25, 2.1, 0.8, 4, 56, '#8A5A34'); L.front(1, 0.5, 1.5, 4, 32, '#1D2340'); L.front(1, 0.62, 1.38, 4, 20, '#FF8A3D', false); L.front(1, 0.8, 1.2, 4, 14, '#FFD23F', false); L.box(0.2, 0.4, 0.15, 0.15, 10, 60, YEL); }, 'light'],
    ['f_snowman', '눈사람', 20, 'deco', 1, 1, 58, (L, k) => { L.ell(0.5, 0.5, 10, 11, 10, '#FFFFFF'); L.ell(0.5, 0.5, 28, 8, 8, '#FFFFFF'); L.ell(0.5, 0.5, 31, 8, 3, k || RED); L.ell(0.5, 0.5, 42, 6, 6, '#FFFFFF'); L.box(0.43, 0.43, 0.14, 0.14, 8, 46, NAVY); L.dot(0.52, 0.62, 43, 1, O); L.dot(0.62, 0.55, 43, 1, O); L.dot(0.6, 0.62, 40, 1.4, '#FF8A3D'); }, 'play'],
    ['f_xmastree', '크리스마스 트리', 35, 'light', 1, 1, 90, (L, k) => { L.box(0.38, 0.38, 0.24, 0.24, 10, 0, k || RED); L.box(0.46, 0.46, 0.08, 0.08, 6, 10, W2); cone(L, 0.5, 0.5, 16, 22, 34, '#2E8A4A'); cone(L, 0.5, 0.5, 36, 17, 30, '#3EA85A'); cone(L, 0.5, 0.5, 54, 12, 26, '#4AB868'); const p = L.P(0.5, 0.5, 80); L.c.fillStyle = YEL; L.c.fillRect(p[0] - 2, p[1] - 2, 5, 5); [[-10, 20, RED], [8, 24, '#4AD8FF'], [-4, 38, YEL], [6, 46, PINK], [-6, 56, '#4AD8FF'], [3, 64, RED]].forEach(([dx, z, col]) => { const q = L.P(0.5, 0.5, z); L.c.fillStyle = col; L.c.fillRect(q[0] + dx - 1.5, q[1] - 1.5, 3, 3); }); }, 'light'],
    ['f_tent', '인디언 텐트', 40, 'deco', 2, 2, 82, (L, k) => { k = k || '#F4E2C0'; const A = L.P(1, 1, 80), F0 = L.P(0.1, 1.9, 0), F1 = L.P(1.9, 1.9, 0), R0 = L.P(1.9, 0.1, 0); L.poly([A, F0, F1], k); L.poly([A, F1, R0], shade(k, -0.15)); const m = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; L.poly([m(A, F0, 0.55), m(A, F1, 0.55), m(A, F1, 0.65), m(A, F0, 0.65)], '#E8505A', false); L.poly([m(A, F1, 0.55), m(A, R0, 0.55), m(A, R0, 0.65), m(A, F1, 0.65)], '#C8403A', false); const C = L.P(1, 1.9, 0); L.poly([m(A, C, 0.45), m(C, F0, 0.3), m(C, F1, 0.3)], '#3A2A28'); [[-6, -10], [0, -12], [6, -10]].forEach(([dx, dy]) => { L.c.beginPath(); L.c.moveTo(A[0], A[1] + 4); L.c.lineTo(A[0] + dx, A[1] + dy); L.c.strokeStyle = '#8A5A34'; L.c.lineWidth = 1.6; L.c.stroke(); }); }, 'play'],
    ['f_globe', '지구본', 12, 'deco', 1, 1, 42, (L, k) => { L.ell(0.5, 0.5, 0, 8, 4, '#E8B040'); L.box(0.47, 0.47, 0.06, 0.06, 14, 0, '#E8B040'); L.ell(0.5, 0.5, 26, 10, 10, k || '#4A8AE8'); L.ell(0.45, 0.48, 29, 4, 3, '#3EA85A', false); L.ell(0.58, 0.55, 22, 3, 4, '#3EA85A', false); }, null],
    ['f_easel', '이젤 그림', 18, 'deco', 1, 1, 70, (L, k) => { L.box(0.47, 0.2, 0.06, 0.06, 58, 0, W2); L.box(0.2, 0.62, 0.06, 0.06, 62, 0, W2); L.box(0.74, 0.62, 0.06, 0.06, 62, 0, W2); L.box(0.12, 0.6, 0.76, 0.12, 3, 22, W); L.front(0.7, 0.15, 0.85, 25, 62, '#FFFFFF'); L.front(0.7, 0.2, 0.8, 30, 56, '#BDE6FF', false); L.front(0.7, 0.2, 0.8, 30, 38, GRN, false); L.dot(0.65, 0.7, 50, 2.5, YEL); }, null],
    ['f_robot', '장난감 로봇', 25, 'deco', 1, 1, 54, (L, k) => { k = k || '#C8D4EC'; L.box(0.32, 0.4, 0.12, 0.2, 12, 0, NAVY); L.box(0.56, 0.4, 0.12, 0.2, 12, 0, NAVY); L.box(0.25, 0.35, 0.5, 0.35, 18, 12, k); L.front(0.7, 0.4, 0.6, 18, 24, '#4AD8FF'); L.box(0.15, 0.45, 0.1, 0.15, 14, 14, k); L.box(0.75, 0.45, 0.1, 0.15, 14, 14, k); L.box(0.3, 0.37, 0.4, 0.3, 14, 30, k); L.dot(0.42, 0.67, 38, 1.6, RED); L.dot(0.58, 0.67, 38, 1.6, RED); L.box(0.48, 0.5, 0.04, 0.04, 8, 44, NAVY); L.dot(0.5, 0.52, 52, 2, YEL); }, 'play'],
    ['f_vending', '음료 자판기', 45, 'elec', 1, 1, 90, (L, k) => { k = k || RED; L.box(0.05, 0.25, 0.9, 0.75, 88, 0, k); L.front(1, 0.1, 0.62, 34, 82, '#BDE6FF'); for (let r = 0; r < 3; r++) for (let n = 0; n < 3; n++) L.front(1, 0.14 + n * 0.16, 0.24 + n * 0.16, 40 + r * 14, 50 + r * 14, ['#FFD23F', '#4A8AE8', '#3EA85A'][(r + n) % 3], false); L.front(1, 0.1, 0.62, 8, 20, NAVY); L.front(1, 0.7, 0.88, 50, 72, '#FFFFFF'); L.dot(0.79, 1, 44, 2, '#5AFF8A'); }, 'play'],
    ['f_bench', '나무 벤치', 18, 'chair', 2, 1, 32, (L, k) => { k = k || W; L.box(0.1, 0.3, 0.1, 0.55, 14, 0, W2); L.box(1.8, 0.3, 0.1, 0.55, 14, 0, W2); L.box(0, 0.25, 2, 0.6, 4, 14, k); L.box(0, 0.2, 2, 0.08, 14, 18, k); L.box(0.1, 0.2, 0.08, 0.08, 16, 14, W2); L.box(1.82, 0.2, 0.08, 0.08, 16, 14, W2); }, 'sit'],
    ['f_ballpool', '볼풀', 40, 'deco', 2, 2, 22, (L, k) => { L.box(0, 0, 2, 2, 16, 0, k || '#7FE0C4', { top: '#FFFFFF' }); const rn = seeded(301), C = [RED, YEL, BLUE, PINK, GRN, '#B07CFF']; for (let n = 0; n < 40; n++) L.dot(0.2 + rn() * 1.6, 0.2 + rn() * 1.6, 17, 2.2, C[n % 6]); }, 'play'],
    ['f_telescope', '천체 망원경', 30, 'deco', 1, 1, 66, (L, k) => { const T = [L.P(0.5, 0.5, 34), L.P(0.2, 0.75, 0), L.P(0.8, 0.75, 0), L.P(0.5, 0.15, 0)]; T.slice(1).forEach(p => { L.c.beginPath(); L.c.moveTo(T[0][0], T[0][1]); L.c.lineTo(p[0], p[1]); L.c.strokeStyle = NAVY; L.c.lineWidth = 2; L.c.stroke(); }); const a = L.P(0.3, 0.65, 40), b = L.P(0.7, 0.3, 62); L.c.beginPath(); L.c.moveTo(a[0], a[1]); L.c.lineTo(b[0], b[1]); L.c.lineCap = 'round'; L.c.strokeStyle = O; L.c.lineWidth = 9; L.c.stroke(); L.c.strokeStyle = k || '#F4F0E8'; L.c.lineWidth = 7; L.c.stroke(); L.c.strokeStyle = BLUE; L.c.lineWidth = 7; L.c.beginPath(); L.c.moveTo(b[0] - 3, b[1] + 2); L.c.lineTo(b[0], b[1]); L.c.stroke(); L.c.lineCap = 'butt'; }, null]
  ].forEach(x => FURN.push(x));
  /* v94 그림자: 가구·옷장이 바닥에 닿는 모양대로 (가구 좌표 u0, v0, u1, v1 · 'e' = 둥근 그림자) · 벽지·바닥·러그·벽 장식은 그림자 없음 */
  const ROUND = new Set(['f_pot', 'f_tree', 'f_cactus', 'f_vase', 'f_round', 'f_beanbag', 'f_stool', 'f_globe', 'f_snowman', 'f_xmastree', 'f_sunflower', 'f_monstera', 'f_mushlamp', 'f_guitar', 'f_bear', 'f_basket', 'f_floorlamp', 'f_lamp', 'f_starlamp', 'f_swing', 'f_telescope', 'f_robot', 'f_easel', 'f_drum']);
  const SHB = { f_chair: [0.02, 0.02, 0.68, 0.72], f_rocking: [0, 0.02, 0.7, 0.82], f_pot: [0.25, 0.25, 0.75, 0.75], f_cactus: [0.28, 0.28, 0.72, 0.72], f_vase: [0.3, 0.3, 0.7, 0.7], f_lamp: [0.25, 0.25, 0.75, 0.75], f_globe: [0.28, 0.28, 0.72, 0.72], f_sunflower: [0.28, 0.28, 0.72, 0.72], f_mushlamp: [0.2, 0.22, 0.8, 0.8], f_floorlamp: [0.25, 0.25, 0.75, 0.75], f_tree: [0.15, 0.15, 0.85, 0.85], f_monstera: [0.1, 0.1, 0.9, 0.9], f_guitar: [0.25, 0.3, 0.75, 0.85], f_basket: [0.25, 0.25, 0.75, 0.75], f_swing: [0.15, 0.1, 1, 0.95], f_telescope: [0.12, 0.1, 0.88, 0.85], f_robot: [0.15, 0.3, 0.85, 0.75], f_easel: [0.12, 0.15, 0.88, 0.75], f_tent: [0.05, 0.05, 1.95, 1.95], f_tvstand: [0.02, 0.38, 1.98, 1.02], f_fireplace: [-0.05, 0.25, 2.05, 1.05], f_vending: [0.05, 0.25, 0.95, 1.02], f_arcade: [0.1, 0.2, 0.9, 1.02], f_dresser: [0.02, 0.3, 0.98, 1], f_kitchen: [0, 0.2, 2, 1.02], f_bench: [0, 0.2, 2, 0.88], f_cattower: [0, 0, 1, 1], f_gamechair: [0.1, 0.1, 0.9, 0.9], f_bear: [0.22, 0.25, 0.78, 0.85], f_stool: [0.2, 0.2, 0.8, 0.8], f_round: [0.12, 0.12, 0.88, 0.88], f_snowman: [0.15, 0.15, 0.85, 0.85], f_xmastree: [0.08, 0.08, 0.92, 0.92], f_beanbag: [0.05, 0.08, 0.95, 0.92], f_drum: [0.2, 0.05, 1.8, 0.98] };
  function drawShadow(g, it, i, j, r) {
    if (!it || (it.slot !== 'furn' && it.slot !== 'wardrobe')) return;
    const L = local(g, i, j, r), w = it.w || 1, d = it.d || 1;
    let b = SHB[it.id];
    if (!b) b = it.slot === 'wardrobe' ? (WDS[it.id] ? (WDS[it.id].box === false ? [0.04, 0.3, 0.96, 0.96] : [0.04, 0.42, 0.96, 1.02]) : [0.04, 0.12, 0.96, 1]) : [0.02, 0.02, w - 0.02, d - 0.02];
    const round = ROUND.has(it.id), c = g.c, sh = 0;   // 빛이 왼쪽 위에서 → 그림자는 조금 앞(화면 아래)으로
    const path = (grow) => {
      c.beginPath();
      if (round) { const cu = (b[0] + b[2]) / 2 + sh, cv = (b[1] + b[3]) / 2 + sh, ru = (b[2] - b[0]) / 2 + grow, rv = (b[3] - b[1]) / 2 + grow; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, p = L.P(cu + Math.cos(a) * ru, cv + Math.sin(a) * rv, 0); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } }
      else [[b[0] - grow, b[1] - grow], [b[2] + grow, b[1] - grow], [b[2] + grow, b[3] + grow], [b[0] - grow, b[3] + grow]].forEach(([u, v], k) => { const p = L.P(u + sh, v + sh, 0); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
      c.closePath();
    };
    c.save(); c.translate(5, 2); c.fillStyle = 'rgba(29,35,64,.09)'; path(0.08); c.fill(); c.fillStyle = 'rgba(29,35,64,.17)'; path(0.01); c.fill(); c.restore();   // 오른쪽 아래로 살짝 (빛은 왼쪽 위)
  }
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
    if (WDS[it.id]) return drawWdSpr(g, it, i, j, r, open);   // v93 코드 그림 옷장
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
      else if (pat === 'spr' && WPS[wpI.id]) {   // v93 벽지 무늬 (벽 면 좌표: 보는 사람 기준 왼쪽 위가 0,0)
        const o = side === 'R' ? g.P(0, 0, WH) : g.P(0, N, WH), x1 = side === 'R' ? g.P(1, 0, WH) : g.P(0, N - 1, WH);
        c.save(); c.transform((x1[0] - o[0]) / 32, (x1[1] - o[1]) / 32, 0, 1, o[0], o[1]); c.lineJoin = 'round'; c.lineCap = 'round';
        try { WPS[wpI.id](sprPen(c), N * 32, WH, side); } catch (err) { /* noop */ }
        c.restore(); if (f) { c.fillStyle = 'rgba(0,0,20,.07)'; c.fillRect(-4000, -4000, 8000, 8000); }
      }
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
      g.flat(i, j, i + 1, j + 1, 0, col, pat === 'plank' || pat === 'maru' || pat === 'tatami' ? shade(flI.color, -0.25) : pat === 'check' || pat === 'spr' ? false : shade(col, -0.06));
      if (pat === 'star' && (i * 3 + j * 7) % 5 === 0) g.dot(i + 0.5, j + 0.5, 0, 1, '#FFF3B0');
      if (pat === 'grass' && (i * 3 + j) % 3 === 0) g.dot(i + 0.3, j + 0.6, 0, 1, shade(flI.color, 0.35));
    }
    floorSpr(g, N, flI);   // v93 무늬 바닥
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
      if (it.slot === 'wardrobe' && !WDS[id] && !wdImg(id, false)) ready = false;
      drawShadow(g, it, 0, 0, 0);
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
      g.flat(i, j, i + 1, j + 1, 0, col, pat === 'plank' || pat === 'maru' || pat === 'tatami' ? shade(flI.color, -0.25) : pat === 'check' || pat === 'spr' ? false : shade(col, -0.06));
      if (pat === 'star' && (i + j) % 2 === 0) g.dot(i + 0.5, j + 0.5, 0, 1.5, '#FFF3B0');
      if (pat === 'grass' && (i * 3 + j) % 3 === 0) g.dot(i + 0.3, j + 0.6, 0, 1, shade(flI.color, 0.35));
    }
    floorSpr(g, n, flI);
    g.poly([g.P(0, 0, 0), g.P(n, 0, 0), g.P(n, n, 0), g.P(0, n, 0)], null, O);
    // 두께 (바닥판 옆면)
    g.poly([g.P(0, n, 0), g.P(n, n, 0), g.P(n, n, -6), g.P(0, n, -6)], shade(flI.color, -0.3), O);
    g.poly([g.P(n, 0, 0), g.P(n, n, 0), g.P(n, n, -6), g.P(n, 0, -6)], shade(flI.color, -0.42), O);
  }

  window.GoFurn = { ITEMS, byId, CATS, SHOP_CATS, MUSIC, TW, TH, pen, local, drawItem, drawShadow, drawWallItem, drawRoomShell, thumb, shade,
    free: () => ITEMS.filter(it => it.price === 0).map(it => it.id),
    // 처음 방 (기본 가구만)
    DEFAULT_ROOM: { wp: 'wp_basic', fl: 'fl_wood', wd: 'wd_basic', wdAt: [0, 2, 1], items: [['f_bed1', 6, 0, 0], ['f_desk', 0, 5, 1], ['f_chair', 1, 5, 1], ['f_pot', 7, 7, 0]], walls: [['w_window', 'R', 3]] } };
})();
