/*
 * gogo?gogo! — 장기 (9 × 10, 초 먼저)
 *  - 궁·사: 궁성 안에서 선을 따라 한 칸 / 차: 직선 + 궁성 대각선 / 포: 다른 기물 하나(포 제외)를 넘어 이동, 포는 못 잡음
 *  - 마: 직선 1 + 대각 1 (막히면 못 감) / 상: 직선 1 + 대각 2 (막히면 못 감) / 졸·병: 앞·옆 1칸 (상대 궁성에서는 대각선 앞도)
 *  - 장군을 피할 수 없으면(외통) 패배. 200수가 지나면 남은 기물 점수로 판정 (한에 덤 1.5)
 */
(function () {
  'use strict';
  const B = window.GoBoard;
  const COLS = 9, ROWS = 10, C = 46, MX = 34, MY = 30, W = MX * 2 + C * (COLS - 1), H = MY * 2 + C * (ROWS - 1);
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
  const LV = { easy: { depth: 1, noise: 2.5 }, normal: { depth: 2, noise: 0.4 }, hard: { depth: 3, noise: 0.05 } };
  function aiMove(b, s, level) {
    const L = LV[level] || LV.normal, moves = allLegal(b, s);
    let best = null;
    for (const m of B.shuffle(moves)) {
      const v = -search(applyMove(b, m), 1 - s, L.depth - 1, -1e9, 1e9) + Math.random() * L.noise;
      if (!best || v > best.v) best = { m, v };
    }
    return best && best.m;
  }

  /* ---------- 화면 ---------- */
  const px = x => MX + x * C, py = y => MY + y * C;
  const COLOR = [{ fill: '#F6EEDB', ink: '#1E7A4F', rim: '#1E7A4F' }, { fill: '#F6EEDB', ink: '#C9343A', rim: '#C9343A' }];
  function drawPiece(ctx, p, cx, cy, labels, sel) {
    const r = p.t === 'K' ? 21 : p.t === 'S' ? 15 : 18, k = COLOR[p.s];
    B.disc(ctx, cx, cy, r + 2, k.rim, { shine: false, px: 2 });
    B.disc(ctx, cx, cy, r, sel ? '#FFE9A0' : k.fill, { rim: '#C8B994', px: 2 });
    B.label(ctx, (labels === 'hanja' ? NAME_HJ : NAME_KO)[p.t][p.s], cx, cy, p.t === 'K' ? 20 : p.t === 'S' ? 14 : 17, k.ink, 700);
  }
  function drawBoard(ctx, st, labels) {
    B.wood(ctx, 0, 0, W, H);
    for (let y = 0; y < ROWS; y++) B.line(ctx, px(0), py(y), px(COLS - 1), py(y), B.LINE, 2);
    for (let x = 0; x < COLS; x++) B.line(ctx, px(x), py(0), px(x), py(ROWS - 1), B.LINE, 2);
    for (const [y0, y1] of [[0, 2], [7, 9]]) { B.line(ctx, px(3), py(y0), px(5), py(y1), B.LINE, 2); B.line(ctx, px(5), py(y0), px(3), py(y1), B.LINE, 2); }
    if (st.last) { ctx.fillStyle = 'rgba(255,210,63,.45)'; [[st.last[0], st.last[1]], [st.last[2], st.last[3]]].forEach(([x, y]) => ctx.fillRect(px(x) - 22, py(y) - 22, 44, 44)); }
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const p = st.b[y][x]; if (p) drawPiece(ctx, p, px(x), py(y), labels, st.sel && st.sel[0] === x && st.sel[1] === y); }
    (st.targets || []).forEach(([x, y]) => {
      if (st.b[y][x]) { ctx.strokeStyle = '#FF5A5F'; ctx.lineWidth = 3; ctx.strokeRect(px(x) - 20, py(y) - 20, 40, 40); }
      else { ctx.fillStyle = 'rgba(61,220,132,.9)'; ctx.fillRect(px(x) - 6, py(y) - 6, 12, 12); }
    });
  }

  window.GoGames.janggi = {
    id: 'janggi', size: [W, H], initial, legalFrom, allLegal, inCheck, applyMove, aiMove, material, pseudo,
    thumb(ctx, w, h) {
      B.wood(ctx, 0, 0, w, h);
      for (let y = 0; y < 5; y++) B.line(ctx, 16, 15 + y * 30, w - 16, 15 + y * 30, B.LINE, 2);
      for (let x = 0; x < 9; x++) B.line(ctx, 16 + x * 26, 15, 16 + x * 26, 135, B.LINE, 2);
      B.line(ctx, 16 + 3 * 26, 75, 16 + 5 * 26, 135, B.LINE, 2); B.line(ctx, 16 + 5 * 26, 75, 16 + 3 * 26, 135, B.LINE, 2);
      [[4, 4, 'K', 0], [0, 4, 'C', 0], [2, 2, 'P', 0], [6, 3, 'H', 0], [3, 1, 'S', 1], [5, 0, 'C', 1], [7, 1, 'P', 1]].forEach(([x, y, t, s]) => drawPiece(ctx, { t, s }, 16 + x * 26, 15 + y * 30, 'ko'));
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      const labels = (window.GoSettings.get('janggi') || {}).labels || 'ko';
      let st = { b: initial(), turn: CHO, sel: null, targets: [], last: null, moves: 0 }, mode = 'ai', level = 'normal', busy = false, over = false, timer = 0;
      const name = s => (s === CHO ? '초' : '한');
      const human = () => mode === 'local' || st.turn === CHO;
      const draw = () => drawBoard(ctx, st, labels);
      function buttons() { hooks.onButtons([]); }
      function turnText() {
        if (over) return;
        const chk = inCheck(st.b, st.turn) ? ' · 장군!' : '';
        const who = mode === 'ai' ? (st.turn === CHO ? '내 차례 (초)' : '컴퓨터 생각 중… (한)') : name(st.turn) + ' 차례';
        hooks.onTurn({ text: who + chk + ' · ' + st.moves + '수', side: st.turn });
      }
      function doMove(m) {
        const cap = st.b[m[3]][m[2]];
        st.b = applyMove(st.b, m); st.last = m; st.moves++; st.sel = null; st.targets = [];
        st.turn = 1 - st.turn;
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
          timer = B.think(() => { const m = aiMove(st.b, HAN, level); if (m) doMove(m); busy = false; after(); }, 300);
        }
      }
      function end(w, msg) {
        over = true; clock.stop(); draw();
        hooks.onTurn({ text: msg, side: -1 });
        hooks.onOver({ winner: w, message: msg, moves: st.moves, duration_sec: clock.sec(), extra: { moves: st.moves } });
      }
      const off = B.pointer(canvas, W, H, (t, x, y) => {
        if (t !== 'up' || over || busy || !human()) return;
        const gx = Math.round((x - MX) / C), gy = Math.round((y - MY) / C); if (!inB(gx, gy)) return;
        const p = st.b[gy][gx];
        if (st.sel && st.targets.some(([a, c]) => a === gx && c === gy)) { doMove([st.sel[0], st.sel[1], gx, gy]); return after(); }
        if (p && p.s === st.turn) { st.sel = [gx, gy]; st.targets = legalFrom(st.b, gx, gy); if (!st.targets.length && hooks.onToast) hooks.onToast('그 기물은 지금 움직일 수 없어요'); }
        else { st.sel = null; st.targets = []; }
        draw();
      });
      draw();
      return {
        get state() { return over ? 'over' : 'playing'; },
        start(o) {
          clearTimeout(timer); o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal';
          st = { b: initial(), turn: CHO, sel: null, targets: [], last: null, moves: 0 }; over = false; busy = false;
          clock.reset(); clock.start(); hooks.onState('playing'); buttons(); after();
        },
        press(id) { if (id === 'resign' && !over) { clearTimeout(timer); busy = false; const loser = mode === 'ai' ? CHO : st.turn; end(1 - loser, name(loser) + ' 기권 · ' + name(1 - loser) + ' 승'); } },
        togglePause() {}, action() {},
        destroy() { clearTimeout(timer); off(); }
      };
    }
  };
})();
