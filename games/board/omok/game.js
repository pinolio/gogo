/* gogo?gogo! — 오목 (15줄, 흑 먼저, 다섯 개 이상 연속이면 승리) */
(function () {
  'use strict';
  const B = window.GoBoard;
  const N = 15, M = 30, C = 30, W = M * 2 + C * (N - 1), H = W;   // 480 × 480
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  /* ---------- 규칙 ---------- */
  function Rules() {
    const g = { b: Array(N * N).fill(0), turn: 1, moves: [], winner: 0, line: null };   // 1 흑, 2 백
    g.at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? -1 : g.b[y * N + x]);
    g.run = (x, y, dx, dy, c) => { let n = 0; for (let i = 1; i < 6; i++) { if (g.at(x + dx * i, y + dy * i) !== c) break; n++; } return n; };
    g.place = function (x, y) {
      if (g.winner || g.at(x, y) !== 0) return false;
      const c = g.turn; g.b[y * N + x] = c; g.moves.push([x, y]);
      for (const [dx, dy] of DIRS) {
        const a = g.run(x, y, dx, dy, c), b = g.run(x, y, -dx, -dy, c);
        if (a + b + 1 >= 5) { g.winner = c; g.line = [[x - dx * b, y - dy * b], [x + dx * a, y + dy * a]]; break; }
      }
      if (!g.winner && g.moves.length === N * N) g.winner = 3;     // 무승부
      g.turn = 3 - c; return true;
    };
    g.undo = function () { const m = g.moves.pop(); if (!m) return; g.b[m[1] * N + m[0]] = 0; g.turn = 3 - g.turn; g.winner = 0; g.line = null; };
    return g;
  }

  /* ---------- 컴퓨터 ---------- */
  // 한 방향 모양 점수: 연속 개수와 양쪽이 막혔는지
  function shape(count, open) {
    if (count >= 5) return 1e6;
    if (count === 4) return open === 2 ? 1e5 : open === 1 ? 1.2e4 : 0;
    if (count === 3) return open === 2 ? 1e4 : open === 1 ? 600 : 0;
    if (count === 2) return open === 2 ? 400 : open === 1 ? 60 : 0;
    if (count === 1) return open === 2 ? 20 : open === 1 ? 4 : 0;
    return 0;
  }
  function pointScore(g, x, y, c) {
    let s = 0, fours = 0, threes = 0;
    for (const [dx, dy] of DIRS) {
      const a = g.run(x, y, dx, dy, c), b = g.run(x, y, -dx, -dy, c);
      const ea = g.at(x + dx * (a + 1), y + dy * (a + 1)) === 0 ? 1 : 0, eb = g.at(x - dx * (b + 1), y - dy * (b + 1)) === 0 ? 1 : 0;
      const cnt = a + b + 1, v = shape(cnt, ea + eb);
      if (cnt === 4 && ea + eb > 0) fours++;
      if (cnt === 3 && ea + eb === 2) threes++;
      s += v;
    }
    if (fours >= 2 || (fours >= 1 && threes >= 1)) s += 5e4;   // 4-4, 4-3
    if (threes >= 2) s += 8e3;                                  // 3-3
    return s;
  }
  function candidates(g) {
    const out = [];
    if (!g.moves.length) return [[7, 7]];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g.at(x, y) !== 0) continue;
      let near = false;
      for (let j = -2; j <= 2 && !near; j++) for (let i = -2; i <= 2; i++) { const v = g.at(x + i, y + j); if (v > 0) { near = true; break; } }
      if (near) out.push([x, y]);
    }
    return out;
  }
  const LV = { easy: { def: 0.6, noise: 0.5, pick: 4 }, normal: { def: 0.95, noise: 0.08, pick: 2 }, hard: { def: 1.05, noise: 0, pick: 1 } };
  function aiMove(g, level) {
    const L = LV[level] || LV.normal, me = g.turn, op = 3 - me;
    const list = candidates(g).map(([x, y]) => {
      const atk = pointScore(g, x, y, me), def = pointScore(g, x, y, op);
      let s = atk + def * L.def + (7 - Math.max(Math.abs(x - 7), Math.abs(y - 7))) * 2;
      if (atk >= 1e6) s = 1e9;                                  // 바로 이기는 수
      else if (def >= 1e6) s = 5e8;                             // 바로 막아야 하는 수
      s *= 1 + (Math.random() - 0.5) * L.noise;
      return { x, y, s };
    }).sort((a, b) => b.s - a.s);
    if (!list.length) return null;
    const top = list[0].s >= 5e8 ? 1 : Math.min(L.pick, list.length);
    return list[B.rand(top)];
  }

  /* ---------- 화면 ---------- */
  const px = i => M + i * C;
  function drawBoard(ctx, g, hover, lastAi) {
    B.wood(ctx, 0, 0, W, H);
    for (let i = 0; i < N; i++) { B.line(ctx, px(0), px(i), px(N - 1), px(i), B.INK, 1); B.line(ctx, px(i), px(0), px(i), px(N - 1), B.INK, 1); }
    ctx.strokeStyle = 'rgba(52,28,8,.6)'; ctx.lineWidth = 2; ctx.strokeRect(px(0) - 1, px(0) - 1, px(N - 1) - px(0) + 2, px(N - 1) - px(0) + 2);
    [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]].forEach(([x, y]) => B.star(ctx, px(x), px(y), 3));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = g.at(x, y); if (v) B.stone(ctx, px(x), px(y), 13, v === 1); }
    const last = g.moves[g.moves.length - 1];
    if (last) { ctx.fillStyle = '#FF5A5F'; ctx.fillRect(px(last[0]) - 3, px(last[1]) - 3, 6, 6); }
    if (hover && !g.winner && g.at(hover[0], hover[1]) === 0) B.stone(ctx, px(hover[0]), px(hover[1]), 13, g.turn === 1, 0.45);
    if (g.line) { ctx.strokeStyle = '#FF5A5F'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px(g.line[0][0]), px(g.line[0][1])); ctx.lineTo(px(g.line[1][0]), px(g.line[1][1])); ctx.stroke(); }
  }

  window.GoGames.omok = {
    id: 'omok', size: [W, H], Rules, aiMove,
    thumb(ctx, w, h) {
      B.wood(ctx, 0, 0, w, h);
      for (let i = 0; i < 9; i++) { B.line(ctx, 20 + i * 25, 12, 20 + i * 25, h - 12, B.INK, 1); }
      for (let j = 0; j < 6; j++) B.line(ctx, 20, 12 + j * 25, 220, 12 + j * 25, B.INK, 1);
      [[2, 1], [3, 2], [4, 3], [5, 4]].forEach(([x, y]) => B.stone(ctx, 20 + x * 25, 12 + y * 25, 10, true));
      [[3, 1], [4, 2], [6, 2], [2, 3], [5, 3]].forEach(([x, y]) => B.stone(ctx, 20 + x * 25, 12 + y * 25, 10, false));
      B.stone(ctx, 20 + 6 * 25, 12 + 5 * 25, 10, true, 0.5);
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      let g = Rules(), mode = 'ai', level = 'normal', hover = null, busy = false, over = false, timer = 0;
      const human = () => mode === 'local' || g.turn === 1;
      const name = c => (c === 1 ? '흑' : '백');
      function turnText() {
        if (over) return;
        const who = mode === 'ai' ? (g.turn === 1 ? '내 차례 (흑)' : '컴퓨터 생각 중… (백)') : name(g.turn) + ' 차례';
        hooks.onTurn({ text: who + ' · ' + g.moves.length + '수', side: g.turn - 1 });
      }
      function buttons() { hooks.onButtons([{ id: 'undo', label: '한 수 무르기', disabled: over || busy || !g.moves.length || (mode === 'ai' && g.moves.length < 2) }]); }
      function draw() { drawBoard(ctx, g, hover); }
      function after() {
        draw(); buttons();
        if (g.winner) return end();
        turnText();
        if (mode === 'ai' && g.turn === 2) {
          busy = true; buttons();
          timer = B.think(() => { const m = aiMove(g, level); if (m) g.place(m.x, m.y); busy = false; after(); }, 400);
        }
      }
      function end(resignSide) {
        over = true; clock.stop(); buttons();
        const w = resignSide ? 2 - resignSide : g.winner === 3 ? -1 : g.winner - 1;
        const msg = w === -1 ? '판이 가득 차서 무승부!' : resignSide ? name(resignSide) + ' 기권 · ' + name(3 - resignSide) + ' 승' : name(g.winner) + ' 다섯 줄 완성! ' + name(g.winner) + ' 승';
        hooks.onTurn({ text: msg, side: -1 });
        hooks.onOver({ winner: w, message: msg, moves: g.moves.length, duration_sec: clock.sec(), extra: { moves: g.moves.length } });
      }
      const off = B.pointer(canvas, W, H, (t, x, y) => {
        const gx = Math.round((x - M) / C), gy = Math.round((y - M) / C);
        const ok = gx >= 0 && gy >= 0 && gx < N && gy < N;
        if (t === 'move') { const nh = ok ? [gx, gy] : null; if (String(nh) !== String(hover)) { hover = nh; draw(); } }
        else if (t === 'leave') { hover = null; draw(); }
        else if (t === 'up' && ok && !over && !busy && human()) { if (g.place(gx, gy)) after(); }
      });
      draw();
      const onImg = () => draw(); window.addEventListener('gogo:img', onImg);
      return {
        get state() { return over ? 'over' : 'playing'; },
        start(o) {
          clearTimeout(timer); o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal';
          g = Rules(); over = false; busy = false; clock.reset(); clock.start(); hooks.onState('playing'); after();
        },
        press(id) {
          if (id === 'resign' && !over) { clearTimeout(timer); busy = false; end(mode === 'ai' ? 1 : g.turn); }
          if (id === 'undo' && !over && !busy) { g.undo(); if (mode === 'ai' && g.turn === 2) g.undo(); after(); }
        },
        togglePause() {}, action() {},
        destroy() { window.removeEventListener('gogo:img', onImg); clearTimeout(timer); off(); }
      };
    }
  };
})();
