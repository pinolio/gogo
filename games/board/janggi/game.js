/*
 * gogo?gogo! — 장기 (9 × 10, 초 먼저)
 *  - 궁·사: 궁성 안에서 선을 따라 한 칸 / 차: 직선 + 궁성 대각선 / 포: 다른 기물 하나(포 제외)를 넘어 이동, 포는 못 잡음
 *  - 마: 직선 1 + 대각 1 (막히면 못 감) / 상: 직선 1 + 대각 2 (막히면 못 감) / 졸·병: 앞·옆 1칸 (상대 궁성에서는 대각선 앞도)
 *  - 장군을 피할 수 없으면(외통) 패배. 200수가 지나면 남은 기물 점수로 판정 (한에 덤 1.5)
 */
(function () {
  'use strict';
  const B = window.GoBoard;
  const COLS = 9, ROWS = 10, C = 46, MX = 34, MY = 30, BW = MX * 2 + C * (COLS - 1), H = MY * 2 + C * (ROWS - 1);
  // v52: 판 양옆에 아바타 자리 (초 왼쪽 아래 · 한 오른쪽 위). 아바타가 걸어가 말을 집어 옮김
  const SIDE = 100, W = BW + SIDE * 2;                                  // 화면 636 × 474
  const CHO = 0, HAN = 1;                        // 초(아래, 먼저) / 한(위)
  const VAL = { K: 0, C: 13, P: 7, H: 5, E: 3, A: 3, S: 2 };
  const NAME_KO = { K: ['초', '한'], C: ['차', '차'], P: ['포', '포'], H: ['마', '마'], E: ['상', '상'], A: ['사', '사'], S: ['졸', '병'] };
  const NAME_HJ = { K: ['楚', '漢'], C: ['車', '車'], P: ['包', '包'], H: ['馬', '馬'], E: ['象', '象'], A: ['士', '士'], S: ['卒', '兵'] };

  const inB = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const inPalace = (x, y) => x >= 3 && x <= 5 && ((y >= 0 && y <= 2) || (y >= 7 && y <= 9));
  // 궁성 대각선: 모서리 ↔ 가운데
  const PAL_CENTERS = [[4, 1], [4, 8]];
  function palaceDiag(x, y) {
    const out = [];
    for (const [cx, cy] of PAL_CENTERS) {
      if (Math.abs(x - cx) > 1 || Math.abs(y - cy) > 1) continue;
      if (x === cx && y === cy) { for (const dx of [-1, 1]) for (const dy of [-1, 1]) out.push([dx, dy]); }
      else if (Math.abs(x - cx) === 1 && Math.abs(y - cy) === 1) out.push([cx - x, cy - y]);
    }
    return out;
  }

  /* ---------- 규칙 ---------- */
  function initial() {
    const b = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const back = ['C', 'H', 'E', 'A', null, 'A', 'E', 'H', 'C'];   // 마상상마
    const put = (x, y, t, s) => { b[y][x] = { t, s }; };
    back.forEach((t, x) => { if (t) { put(x, 9, t, CHO); put(x, 0, t, HAN); } });
    put(4, 8, 'K', CHO); put(4, 1, 'K', HAN);
    put(1, 7, 'P', CHO); put(7, 7, 'P', CHO); put(1, 2, 'P', HAN); put(7, 2, 'P', HAN);
    [0, 2, 4, 6, 8].forEach(x => { put(x, 6, 'S', CHO); put(x, 3, 'S', HAN); });
    return b;
  }
  // 한 기물의 이동 후보 (자기 궁이 잡히는지는 따지지 않음)
  function pseudo(b, x, y) {
    const p = b[y][x]; if (!p) return [];
    const out = [], side = p.s;
    const add = (nx, ny) => { if (!inB(nx, ny)) return false; const q = b[ny][nx]; if (q && q.s === side) return false; out.push([nx, ny]); return !q; };
    const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    switch (p.t) {
      case 'K': case 'A':
        for (const [dx, dy] of ORTH) { const nx = x + dx, ny = y + dy; if (inPalace(nx, ny) && sameHalf(ny, y)) add(nx, ny); }
        for (const [dx, dy] of palaceDiag(x, y)) add(x + dx, y + dy);
        break;
      case 'C':
        for (const [dx, dy] of ORTH) { let nx = x + dx, ny = y + dy; while (inB(nx, ny) && add(nx, ny)) { nx += dx; ny += dy; } }
        for (const [dx, dy] of palaceDiag(x, y)) { let nx = x + dx, ny = y + dy; while (inPalace(nx, ny) && add(nx, ny)) { if (!onDiag(nx, ny)) break; nx += dx; ny += dy; } }
        break;
      case 'P': {
        const jump = (dx, dy, limitPalace) => {
          let nx = x + dx, ny = y + dy, screen = false;
          while (inB(nx, ny) && (!limitPalace || inPalace(nx, ny))) {
            const q = b[ny][nx];
            if (!screen) { if (q) { if (q.t === 'P') return; screen = true; } }
            else { if (q) { if (q.t !== 'P' && q.s !== side) out.push([nx, ny]); return; } out.push([nx, ny]); }
            nx += dx; ny += dy;
          }
        };
        for (const [dx, dy] of ORTH) jump(dx, dy, false);
        // 궁성 모서리에서 가운데(포 아닌 기물)를 넘어 반대 모서리로
        for (const [cx, cy] of PAL_CENTERS) {
          if (Math.abs(x - cx) === 1 && Math.abs(y - cy) === 1) {
            const mid = b[cy][cx], tx = cx * 2 - x, ty = cy * 2 - y, q = b[ty][tx];
            if (mid && mid.t !== 'P' && (!q || (q.s !== side && q.t !== 'P'))) out.push([tx, ty]);
          }
        }
        break;
      }
      case 'H':
        for (const [dx, dy] of ORTH) {
          if (!inB(x + dx, y + dy) || b[y + dy][x + dx]) continue;
          const sides = dx ? [[dx, 1], [dx, -1]] : [[1, dy], [-1, dy]];
          for (const [sx, sy] of sides) add(x + dx + sx, y + dy + sy);
        }
        break;
      case 'E':
        for (const [dx, dy] of ORTH) {
          if (!inB(x + dx, y + dy) || b[y + dy][x + dx]) continue;
          const sides = dx ? [[dx, 1], [dx, -1]] : [[1, dy], [-1, dy]];
          for (const [sx, sy] of sides) {
            const mx = x + dx + sx, my = y + dy + sy;
            if (!inB(mx, my) || b[my][mx]) continue;
            add(mx + sx, my + sy);
          }
        }
        break;
      case 'S': {
        const fwd = side === CHO ? -1 : 1;
        add(x, y + fwd); add(x - 1, y); add(x + 1, y);
        for (const [dx, dy] of palaceDiag(x, y)) if (dy === fwd) add(x + dx, y + dy);
        break;
      }
    }
    return out;
  }
  const sameHalf = (a, b) => (a <= 4) === (b <= 4);
  const onDiag = (x, y) => palaceDiag(x, y).length > 0;
  function findKing(b, s) { for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const p = b[y][x]; if (p && p.t === 'K' && p.s === s) return [x, y]; } return null; }
  function attacked(b, x, y, by) {
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const p = b[j][i]; if (!p || p.s !== by) continue;
      if (pseudo(b, i, j).some(([a, c]) => a === x && c === y)) return true;
    }
    return false;
  }
  const inCheck = (b, s) => { const k = findKing(b, s); return !k || attacked(b, k[0], k[1], 1 - s); };
  function applyMove(b, m) { const nb = b.map(r => r.slice()); nb[m[3]][m[2]] = nb[m[1]][m[0]]; nb[m[1]][m[0]] = null; return nb; }
  function legalFrom(b, x, y) { const p = b[y][x]; return pseudo(b, x, y).filter(([nx, ny]) => !inCheck(applyMove(b, [x, y, nx, ny]), p.s)); }
  function allLegal(b, s) {
    const out = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const p = b[y][x]; if (p && p.s === s) legalFrom(b, x, y).forEach(([nx, ny]) => out.push([x, y, nx, ny])); }
    return out;
  }
  function material(b, s) { let v = 0; b.forEach(r => r.forEach(p => { if (p && p.s === s) v += VAL[p.t]; })); return v; }

  /* ---------- 컴퓨터 (알파베타 탐색) ---------- */
  function evalBoard(b, s) {
    let v = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const p = b[y][x]; if (!p) continue;
      let pv = p.t === 'K' ? 1000 : VAL[p.t];
      if (p.t === 'S') pv += (p.s === CHO ? (6 - y) : (y - 3)) * 0.15;           // 졸은 앞으로 갈수록
      if (p.t === 'C' || p.t === 'H' || p.t === 'P') pv += (4 - Math.abs(4 - x)) * 0.05;
      v += p.s === s ? pv : -pv;
    }
    return v;
  }
  function pseudoAll(b, s) {
    const out = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const p = b[y][x]; if (p && p.s === s) pseudo(b, x, y).forEach(([nx, ny]) => { const q = b[ny][nx]; out.push([x, y, nx, ny, q ? (q.t === 'K' ? 1000 : VAL[q.t]) : 0]); }); }
    out.sort((a, c) => c[4] - a[4]);
    return out;
  }
  function search(b, s, depth, alpha, beta) {
    if (!findKing(b, s)) return -9999;
    if (!findKing(b, 1 - s)) return 9999;
    if (depth === 0) return evalBoard(b, s);
    const moves = pseudoAll(b, s);
    if (!moves.length) return -500;
    for (const m of moves) {
      const v = -search(applyMove(b, m), 1 - s, depth - 1, -beta, -alpha);
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return alpha;
  }
  /* v61 단계 1~10
   *  1~3단계 = 예전 쉬움·보통·어려움 (depth 수 앞까지, noise = 일부러 흔드는 정도, 기물 점수 단위: 차 13 · 포 7 · 마 5 · 상·사 3 · 졸 2)
   *  4단계부터 = 새 탐색: 한 수씩 깊이 늘리기 + 잡는 수 끝까지 따라가기 + 좋은 수 먼저 + 시간 한도(ms)
   *   tol = 이만큼 차이 안 나는 수 중 무작위 (같은 판에 늘 같은 수를 두지 않게) */
  const LV = [null,
    { depth: 1, noise: 2.5 }, { depth: 2, noise: 0.4 }, { depth: 3, noise: 0.05 },
    { depth: 3, ms: 600, noise: 0.5, tol: 0 },
    { depth: 3, ms: 800, noise: 0.1, tol: 0 },
    { depth: 4, ms: 1000, noise: 0, tol: 0.15 },
    { depth: 5, ms: 1300, noise: 0, tol: 0.12 },
    { depth: 5, ms: 1700, noise: 0, tol: 0.03 },
    { depth: 6, ms: 2300, noise: 0, tol: 0.03 },
    { depth: 8, ms: 3000, noise: 0, tol: 0.02 },
    { depth: 10, ms: 4200, noise: 0, tol: 0.01 }   // 11 = AI 대전 (10단계를 이기면 열림 · 나중에 학습한 AI 로 바꿀 자리)
  ];
  function aiMoveOld(b, s, L) {
    const moves = allLegal(b, s);
    let best = null;
    for (const m of B.shuffle(moves)) {
      const v = -search(applyMove(b, m), 1 - s, L.depth - 1, -1e9, 1e9) + Math.random() * L.noise;
      if (!best || v > best.v) best = { m, v };
    }
    return best && best.m;
  }
  // 새 평가: 기물 + 졸 전진 + 가운데 + 궁 지키는 사·상 + 상대 궁 가까이 간 차·마·포
  function eval2(b, s) {
    let v = evalBoard(b, s);
    const k = [findKing(b, CHO), findKing(b, HAN)];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const p = b[y][x]; if (!p) continue;
      const ek = k[1 - p.s]; let e = 0;
      if (ek && (p.t === 'C' || p.t === 'H' || p.t === 'P')) e += Math.max(0, 6 - Math.abs(ek[0] - x) - Math.abs(ek[1] - y)) * 0.08;
      if (p.t === 'A' && inPalace(x, y)) e += 0.15;
      v += p.s === s ? e : -e;
    }
    return v;
  }
  function engine(b0, s0, L) {
    const stop = B.deadline(L.ms), killers = []; let nodes = 0, aborted = false;
    const capsOf = (b, s) => pseudoAll(b, s).filter(m => m[4] > 0);
    function qs(b, s, alpha, beta, qd) {
      if (!findKing(b, s)) return -9999;
      const stand = eval2(b, s);
      if (stand >= beta) return stand; if (stand > alpha) alpha = stand;
      if (qd > 5) return alpha;
      for (const m of capsOf(b, s)) {
        if (m[4] >= 1000) return 9999;
        const v = -qs(applyMove(b, m), 1 - s, -beta, -alpha, qd + 1);
        if (v >= beta) return v; if (v > alpha) alpha = v;
      }
      return alpha;
    }
    function ab(b, s, depth, alpha, beta, ply) {
      if ((++nodes & 511) === 0 && stop()) aborted = true;
      if (aborted) return 0;
      if (!findKing(b, s)) return -9999 + ply;
      if (depth <= 0) return qs(b, s, alpha, beta, 0);
      const k = killers[ply] || [], key = m => m[0] * 1000 + m[1] * 100 + m[2] * 10 + m[3];
      const moves = pseudoAll(b, s).sort((a, c) => (c[4] * 10 + (k.includes(key(c)) ? 5 : 0)) - (a[4] * 10 + (k.includes(key(a)) ? 5 : 0)));
      if (!moves.length) return -500;
      if (moves[0][4] >= 1000) return 9999 - ply;
      // 차례를 넘겨도(한수쉼) 상대가 못 따라오면 더 볼 필요 없음 — 깊을 때만
      if (depth >= 3 && ply > 0) { const nv = -ab(b, 1 - s, depth - 3, -beta, -beta + 0.01, ply + 1); if (aborted) return 0; if (nv >= beta) return beta; }
      let best = -1e9, cnt = 0;
      for (const m of moves) {
        if (m[4] >= 1000) return 9999 - ply;
        cnt++; let v;
        if (cnt > 4 && depth >= 3 && !m[4]) { v = -ab(applyMove(b, m), 1 - s, depth - 2, -alpha - 0.01, -alpha, ply + 1); if (!aborted && v > alpha) v = -ab(applyMove(b, m), 1 - s, depth - 1, -beta, -alpha, ply + 1); }
        else v = -ab(applyMove(b, m), 1 - s, depth - 1, -beta, -alpha, ply + 1);
        if (aborted) return 0;
        if (v > best) best = v; if (v > alpha) alpha = v;
        if (alpha >= beta) { if (!m[4]) killers[ply] = [key(m)].concat(k).slice(0, 2); break; }
      }
      return best;
    }
    let root = B.shuffle(allLegal(b0, s0)), done = null;
    if (root.length <= 1) return root[0] || null;
    root.sort((a, c) => { const va = b0[a[3]][a[2]], vc = b0[c[3]][c[2]]; return (vc ? VAL[vc.t] : 0) - (va ? VAL[va.t] : 0); });
    for (let d = 1; d <= L.depth; d++) {
      const vals = []; let alpha = -1e9;
      for (const m of root) {   // 가장 좋은 수보다 tol 이상 나쁜지만 알면 되므로 창을 좁힘 (빨라짐)
        const raw = -ab(applyMove(b0, m), 1 - s0, d - 1, -1e9, -alpha, 1), v = raw + Math.random() * L.noise;
        if (raw - (L.tol || 0) - L.noise - 0.01 > alpha) alpha = raw - (L.tol || 0) - L.noise - 0.01;   // 흔들기(noise) 만큼 여유
        if (aborted) break;
        vals.push({ m, v, raw });
      }
      // 시간이 다 돼서 이번 깊이를 다 못 봤어도, 이미 본 수 중 지난 최선보다 좋은 것이 있으면 그 수 (조금 더 깊이 본 결과)
      if (aborted) { if (done && vals.length > 1) { const b1 = vals.reduce((a, c) => (c.raw > a.raw ? c : a)); if (b1 !== vals[0] && b1.raw > vals[0].raw) done = [b1]; } break; }
      vals.sort((a, c) => c.v - a.v); done = vals; root = vals.map(x => x.m); window.__janggiDepth = d;
      if (vals[0].v > 9000) break;
    }
    if (!done) return root[0];
    const top = done[0].v, near = Math.abs(top) < 9000 && L.tol ? done.filter(x => x.v >= top - L.tol) : [done[0]];
    return near[B.rand(near.length)].m;
  }
  function aiMove(b, s, level) {
    const n = B.step(level), L = LV[n];
    return n <= 3 ? aiMoveOld(b, s, L) : engine(b, s, L);
  }

  /* ---------- 화면 ---------- */
  const px = x => MX + x * C, py = y => MY + y * C;
  const COLOR = [{ fill: '#F6EEDB', ink: '#1E7A4F', rim: '#1E7A4F' }, { fill: '#F6EEDB', ink: '#C9343A', rim: '#C9343A' }];
  function drawPiece(ctx, p, cx, cy, labels, sel) {
    const r = p.t === 'K' ? 21 : p.t === 'S' ? 15 : 18, k = COLOR[p.s];
    if (labels !== 'ko') { B.janggiPiece(ctx, cx, cy, r * 0.98, NAME_HJ[p.t][p.s], p.s === 0 ? '#11603A' : '#B21F2A', sel); return; }
    B.disc(ctx, cx, cy, r + 2, k.rim, { shine: false, px: 2 });
    B.disc(ctx, cx, cy, r, sel ? '#FFE9A0' : k.fill, { rim: '#C8B994', px: 2, light: '#FFFCF2' });
    const hj = labels !== 'ko';
    B.label(ctx, (hj ? NAME_HJ : NAME_KO)[p.t][p.s], cx, cy + (hj ? 1 : 0), Math.round((p.t === 'K' ? 20 : p.t === 'S' ? 14 : 17) * (hj ? 1.22 : 1)), k.ink, hj ? 900 : 700, hj ? 'hanja' : null);
  }
  const ANIM_MS = 300;   // v32: 말이 움직이는 시간(밀리초). 0 이면 예전처럼 바로 옮김
  function drawBoard(ctx, st, labels) {
    B.wood(ctx, 0, 0, BW, H);
    for (let y = 0; y < ROWS; y++) B.line(ctx, px(0), py(y), px(COLS - 1), py(y), B.LINE, 2);
    for (let x = 0; x < COLS; x++) B.line(ctx, px(x), py(0), px(x), py(ROWS - 1), B.LINE, 2);
    for (const [y0, y1] of [[0, 2], [7, 9]]) { B.line(ctx, px(3), py(y0), px(5), py(y1), B.LINE, 2); B.line(ctx, px(5), py(y0), px(3), py(y1), B.LINE, 2); }
    if (st.last) { ctx.fillStyle = 'rgba(255,210,63,.45)'; [[st.last[0], st.last[1]], [st.last[2], st.last[3]]].forEach(([x, y]) => ctx.fillRect(px(x) - 22, py(y) - 22, 44, 44)); ctx.strokeStyle = '#FF9A1F'; ctx.lineWidth = 3; ctx.strokeRect(px(st.last[2]) - 23, py(st.last[3]) - 23, 46, 46); }   // v32: 방금 움직인 자리 주황 테두리
    // v32 (학생 의견 '말이 순간이동해서 뭘 움직이는지 모르겠어요'): 움직인 말이 0.3초 동안 미끄러져 감
    const an = st.anim, k = an ? Math.min(1, (performance.now() - an.t0) / ANIM_MS) : 1, moving = an && k < 1;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const p = st.b[y][x]; if (p && !(st.hide && st.hide[0] === x && st.hide[1] === y) && !(moving && an.m[2] === x && an.m[3] === y)) drawPiece(ctx, p, px(x), py(y), labels, st.sel && st.sel[0] === x && st.sel[1] === y); }
    if (moving) {
      if (an.cap) { ctx.globalAlpha = 1 - k; drawPiece(ctx, an.cap, px(an.m[2]), py(an.m[3]), labels, false); ctx.globalAlpha = 1; }
      const e = 1 - Math.pow(1 - k, 3), m = an.m;
      drawPiece(ctx, an.p, px(m[0]) + (px(m[2]) - px(m[0])) * e, py(m[1]) + (py(m[3]) - py(m[1])) * e - Math.sin(k * Math.PI) * 6, labels, false);
    }
    (st.targets || []).forEach(([x, y]) => {
      if (st.b[y][x]) { ctx.strokeStyle = '#FF5A5F'; ctx.lineWidth = 3; ctx.strokeRect(px(x) - 20, py(y) - 20, 40, 40); }
      else { ctx.fillStyle = 'rgba(61,220,132,.9)'; ctx.fillRect(px(x) - 6, py(y) - 6, 12, 12); }
    });
  }

  window.GoGames.janggi = {
    id: 'janggi', size: [W, H], initial, legalFrom, allLegal, inCheck, applyMove, aiMove, material, pseudo,
    thumb(ctx, w, h) {
      B.wood(ctx, 0, 0, w, h);
      for (let y = 0; y < 5; y++) B.line(ctx, 16, 15 + y * 30, w - 16, 15 + y * 30, B.INK, 2);
      for (let x = 0; x < 9; x++) B.line(ctx, 16 + x * 26, 15, 16 + x * 26, 135, B.INK, 2);
      B.line(ctx, 16 + 3 * 26, 75, 16 + 5 * 26, 135, B.INK, 2); B.line(ctx, 16 + 5 * 26, 75, 16 + 3 * 26, 135, B.INK, 2);
      [[4, 4, 'K', 0], [0, 4, 'C', 0], [2, 2, 'P', 0], [6, 3, 'H', 0], [3, 1, 'S', 1], [5, 0, 'C', 1], [7, 1, 'P', 1]].forEach(([x, y, t, s]) => drawPiece(ctx, { t, s }, 16 + x * 26, 15 + y * 30, 'hanja'));
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      const labels = (window.GoSettings.get('janggi') || {}).labels || 'hanja';
      let log = [];   // v62 기보
      let st = { b: initial(), turn: CHO, sel: null, targets: [], last: null, moves: 0 }, mode = 'ai', level = 'normal', busy = false, over = false, timer = 0, side = CHO;
      const name = s => (s === CHO ? '초' : '한');
      const human = () => mode === 'local' || (mode === 'online' ? st.turn === side : st.turn === CHO);
      const send = m => { if (mode === 'online' && hooks.onMove) hooks.onMove(m); };
      const cfg = (window.GoSettings && GoSettings.get('janggi')) || {}, MO = cfg.motion || {};
      let names = {};
      const homes = {};
      const mv = B.porter({ redraw: () => draw(), scale: MO.scale || 2.5, speed: MO.speed, backSpeed: MO.backSpeed, pickMs: MO.pickMs, placeMs: MO.placeMs, homes });
      homes[CHO] = [SIDE / 2 - 4, H - 24 - mv.size.h * 0.42]; homes[HAN] = [W - SIDE / 2 + 4, mv.size.h * 0.58 + 34];
      const cellXY = (x, y) => [SIDE + px(x), py(y)];
      const draw = () => {
        B.table(ctx, W, H);
        B.tag(ctx, '초', homes[CHO][0], homes[CHO][1] - mv.size.h * 0.58 - 22, 14); if (names[CHO]) B.tag(ctx, names[CHO], homes[CHO][0], homes[CHO][1] - mv.size.h * 0.58 - 6, 11);
        B.tag(ctx, '한', homes[HAN][0], 22, 14); if (names[HAN]) B.tag(ctx, names[HAN], homes[HAN][0], homes[HAN][1] + mv.size.h * 0.42 + 16, 11);
        ctx.save(); ctx.translate(SIDE, 0); drawBoard(ctx, st, labels); ctx.restore();
        mv.draw(ctx);
      };
      // 말 하나를 아바타가 옮김: 집는 순간 원래 자리에서 사라지고, 내려놓는 순간 수가 둬짐
      function carry(m, done) {
        busy = true;
        const p = st.b[m[1]][m[0]];
        mv.add({ who: String(p.s), from: cellXY(m[0], m[1]), to: cellXY(m[2], m[3]), piece: (cx, x2, y2) => drawPiece(cx, p, x2, y2 - 4, labels, false),
          onPick: () => { st.hide = [m[0], m[1]]; st.sel = null; st.targets = []; draw(); },
          onPlace: () => { st.hide = null; doMove(m, true); draw(); },
          onDone: () => { busy = mv.busy(); if (!over) done(); } });
      }
      function buttons() { hooks.onButtons([]); }
      function turnText() {
        if (over) return;
        const chk = inCheck(st.b, st.turn) ? ' · 장군!' : '';
        const who = mode === 'ai' ? (st.turn === CHO ? '내 차례 (초)' : '컴퓨터 생각 중… (한)') : mode === 'online' ? (human() ? '내 차례 (' + name(st.turn) + ')' : '상대 차례… (' + name(st.turn) + ')') : name(st.turn) + ' 차례';
        hooks.onTurn({ text: who + chk + ' · ' + st.moves + '수', side: st.turn });
      }
      let raf = 0;
      function animate() { cancelAnimationFrame(raf); const tick = () => { draw(); if (st.anim && performance.now() - st.anim.t0 < ANIM_MS) raf = requestAnimationFrame(tick); else { st.anim = null; draw(); } }; raf = requestAnimationFrame(tick); }
      function doMove(m, carried) {
        const cap = st.b[m[3]][m[2]];
        st.anim = ANIM_MS > 0 && !carried ? { t0: performance.now(), m, p: st.b[m[1]][m[0]], cap } : null;
        st.b = applyMove(st.b, m); log.push([m[0], m[1], m[2], m[3]]); st.last = m; st.moves++;   // v62 기보 (x, y → x, y) st.sel = null; st.targets = [];
        st.turn = 1 - st.turn;
        if (st.anim) animate();
        if (cap && hooks.onToast && cap.t !== 'S') hooks.onToast(name(1 - st.turn) + '이(가) ' + NAME_KO[cap.t][cap.s] + '을(를) 잡았어요');
      }
      function after() {
        draw();
        const legal = allLegal(st.b, st.turn);
        if (!legal.length) { const w = 1 - st.turn; return end(w, (inCheck(st.b, st.turn) ? '외통수! ' : '둘 수가 없어요! ') + name(w) + ' 승'); }
        if (st.moves >= 200) {
          const c = material(st.b, CHO), h = material(st.b, HAN) + 1.5, w = c > h ? CHO : HAN;
          return end(w, `200수 판정: 초 ${c}점 · 한 ${h}점 — ${name(w)} 승`);
        }
        turnText();
        if (mode === 'ai' && st.turn === HAN) {
          busy = true;
          timer = B.think(() => { const m = aiMove(st.b, HAN, level); if (!m) { busy = false; return after(); } carry(m, after); }, 300);
        }
      }
      function end(w, msg) {
        over = true; mv.clear(); busy = false; st.hide = null; clock.stop(); draw();
        hooks.onTurn({ text: msg, side: -1 });
        hooks.onOver({ winner: w, message: msg, moves: st.moves, duration_sec: clock.sec(), extra: { moves: st.moves }, record: { side, moves: log.slice() } });
      }
      const off = B.pointer(canvas, W, H, (t, x, y) => {
        if (t !== 'up' || over || busy || !human()) return;
        const gx = Math.round((x - SIDE - MX) / C), gy = Math.round((y - MY) / C); if (!inB(gx, gy)) return;
        const p = st.b[gy][gx];
        if (st.sel && st.targets.some(([a, c]) => a === gx && c === gy)) { const m = [st.sel[0], st.sel[1], gx, gy]; send(m); st.sel = null; st.targets = []; carry(m, after); return turnText(); }
        if (p && p.s === st.turn) { st.sel = [gx, gy]; st.targets = legalFrom(st.b, gx, gy); if (!st.targets.length && hooks.onToast) hooks.onToast('그 기물은 지금 움직일 수 없어요'); }
        else { st.sel = null; st.targets = []; }
        draw();
      });
      draw(); B.whenHanja(draw);
      const onImg = () => draw(); window.addEventListener('gogo:img', onImg);
      return {
        get state() { return over ? 'over' : 'playing'; },
        start(o) {
          clearTimeout(timer); o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal'; side = o.side || CHO;
          mv.clear(); { const pl = B.players(mode, o, side, 'janggi', level); mv.setAvatars({ [CHO]: pl.av[0], [HAN]: pl.av[1] }); names = { [CHO]: pl.name[0], [HAN]: pl.name[1] }; }
          st = { b: initial(), turn: CHO, sel: null, targets: [], last: null, moves: 0, hide: null }; log = []; over = false; busy = false;
          clock.reset(); clock.start(); hooks.onState('playing'); buttons(); after();
        },
        press(id) { if (id === 'resign' && !over) { clearTimeout(timer); mv.clear(); busy = false; const loser = mode === 'ai' ? CHO : mode === 'online' ? side : st.turn; send({ resign: 1 }); end(1 - loser, name(loser) + ' 기권 · ' + name(1 - loser) + ' 승'); } },
        remote(m) {
          if (over) return;
          if (m && m.resign) { const loser = 1 - side; return end(side, (m.left ? '상대가 나갔어요 · ' : name(loser) + ' 기권 · ') + name(side) + ' 승'); }
          if (Array.isArray(m) && m.length === 4) { const p = st.b[m[1]] && st.b[m[1]][m[0]]; if (p && p.s === st.turn && legalFrom(st.b, m[0], m[1]).some(([a, c]) => a === m[2] && c === m[3])) carry(m, after); }
        },
        togglePause() {}, action() {},
        destroy() { window.removeEventListener('gogo:img', onImg); clearTimeout(timer); cancelAnimationFrame(raf); mv.clear(); off(); }
      };
    }
  };
})();
