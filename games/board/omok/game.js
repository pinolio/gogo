/* gogo?gogo! — 오목 (15줄, 흑 먼저, 다섯 개 이상 연속이면 승리)
 *  v67 3·3 금지 (흑·백 모두): 한 수로 '열린 3' 이 두 줄 동시에 생기면 둘 수 없음. 4·3, 4·4 는 됨. 다섯이 되는 수는 언제나 됨 */
(function () {
  'use strict';
  const B = window.GoBoard;
  const N = 15, M = 30, C = 30, BW = M * 2 + C * (N - 1), H = BW;   // 판 480 × 480
  // v52: 판 양옆에 돌 통 자리 (흑 왼쪽 · 백 오른쪽). 아바타가 여기서 돌을 집어 와서 둠
  const SIDE = 96, W = BW + SIDE * 2;                                   // 화면 672 × 480
  const POT = { 1: [SIDE / 2, 170], 2: [W - SIDE / 2, 170] };                    // 돌 통 (흑·백)
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
    // v67 3·3 인지: (x, y) 에 c 를 두면 열린 3 이 두 줄 이상 생기나 (빈 곳만 검사)
    g.banned = function (x, y, c) {
      if (g.at(x, y) !== 0) return false;
      c = c || g.turn; const i0 = y * N + x; g.b[i0] = c;
      let five = false, threes = 0;
      for (const [dx, dy] of DIRS) {
        if (g.run(x, y, dx, dy, c) + g.run(x, y, -dx, -dy, c) + 1 >= 5) { five = true; break; }
        if (openThree(g, x, y, dx, dy, c)) threes++;
      }
      g.b[i0] = 0;
      return !five && threes >= 2;
    };
    g.undo = function () { const m = g.moves.pop(); if (!m) return; g.b[m[1] * N + m[0]] = 0; g.turn = 3 - g.turn; g.winner = 0; g.line = null; };
    return g;
  }

  // 열린 3: 이 줄에서 한 수 더 두면 '양쪽이 빈 4'(.●●●●.) 가 되는 3. 이미 4 인 줄은 3 이 아님 (4·3 은 됨)
  function openThree(g, x, y, dx, dy, c) {
    for (let k = -4; k <= 4; k++) {                             // 같은 줄의 빈 곳에 하나 더 둬 봄
      if (!k) continue;
      const ex = x + dx * k, ey = y + dy * k; if (g.at(ex, ey) !== 0) continue;
      g.b[ey * N + ex] = c;
      const a = g.run(x, y, dx, dy, c), b = g.run(x, y, -dx, -dy, c), n = a + b + 1;
      const four = n >= 5 ? 'five' : n === 4 && g.at(x + dx * (a + 1), y + dy * (a + 1)) === 0 && g.at(x - dx * (b + 1), y - dy * (b + 1)) === 0 ? 'open' : n === 4 ? 'closed' : '';
      g.b[ey * N + ex] = 0;
      if (four === 'five' || four === 'closed') {               // 이 줄이 이미 4 (한 수로 다섯) 이면 3 이 아님
        if (four === 'five') return false;
      }
      if (four === 'open') {
        // 이 줄이 이미 사(4) 인지 확인: 줄의 다른 빈 곳 한 수로 다섯이 되면 3 이 아니고 4
        for (let j = -4; j <= 4; j++) { const fx = x + dx * j, fy = y + dy * j; if (!j || g.at(fx, fy) !== 0) continue; g.b[fy * N + fx] = c; const f = g.run(x, y, dx, dy, c) + g.run(x, y, -dx, -dy, c) + 1 >= 5; g.b[fy * N + fx] = 0; if (f) return false; }
        return true;
      }
    }
    return false;
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
    // v67 3·3 은 둘 수 없으므로 점수 없음
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
  /* v61 단계 1~10
   *  1~3단계 = 예전 쉬움·보통·어려움 (한 수만 보고 점수가 높은 곳)
   *  4단계부터 = 몇 수 앞까지 읽기(알파베타) + 사(4) 연속 공격 읽기(VCF) + 상대 VCF 막기
   *   depth = 읽는 수, k = 한 번에 살펴볼 후보 수, vcf = 연속 4 공격을 몇 번까지 읽나, ms = 생각 시간 한도, noise = 일부러 흔드는 정도 */
  const LV = [null,
    { def: 0.6, noise: 0.5, pick: 4 },
    { def: 0.95, noise: 0.08, pick: 2 },
    { def: 1.05, noise: 0, pick: 1 },
    { depth: 2, k: 10, vcf: 2, ms: 500, noise: 0.15 },
    { depth: 2, k: 12, vcf: 3, ms: 600, noise: 0.08 },
    { depth: 3, k: 10, vcf: 4, ms: 800, noise: 0.03 },
    { depth: 4, k: 8, vcf: 5, ms: 1000, noise: 0 },
    { depth: 4, k: 10, vcf: 6, ms: 1400, noise: 0 },
    { depth: 4, k: 12, vcf: 8, ms: 1800, noise: 0 },
    { depth: 4, k: 14, vcf: 12, ms: 2500, noise: 0 },
    { depth: 4, k: 18, vcf: 16, ms: 4000, noise: 0 }     // 11 = AI 대전 (10단계를 이기면 열림 · 지금은 가장 깊게 읽는 컴퓨터, 나중에 학습한 AI 로 바꿀 자리)
  ];
  function greedy(g, L) {
    const me = g.turn, op = 3 - me;
    const list = candidates(g).filter(([x, y]) => !g.banned(x, y, me)).map(([x, y]) => {
      const atk = pointScore(g, x, y, me), def = pointScore(g, x, y, op);
      let s = atk + def * L.def + (7 - Math.max(Math.abs(x - 7), Math.abs(y - 7))) * 2;
      if (atk >= 1e6) s = 1e9;                                  // 바로 이기는 수
      else if (def >= 1e6) s = 5e8;                             // 바로 막아야 하는 수
      s *= 1 + (Math.random() - 0.5) * L.noise;
      return { x, y, s };
    }).sort((a, b) => b.s - a.s);
    if (!list.length) return null;
    let top = list[0].s >= 5e8 ? 1 : Math.min(L.pick, list.length);
    if (top === 1) while (top < list.length && list[top].s >= list[0].s * 0.97) top++;   // v61 거의 같은 수는 그중 하나
    return list[B.rand(top)];
  }
  // 판 전체 점수: 다섯 칸 창마다 한 색만 있으면 그 개수로 점수 (막힌 3·띈 3 도 함께 셈)
  const WIN = [0, 1, 12, 160, 2600, 1e6];
  function evalBoard(g, me) {
    const b = g.b; let s = 0;
    for (const [dx, dy] of DIRS) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const ex = x + dx * 4, ey = y + dy * 4; if (ex < 0 || ex >= N || ey >= N) continue;
      let c1 = 0, c2 = 0;
      for (let k = 0; k < 5; k++) { const v = b[(y + dy * k) * N + x + dx * k]; if (v === 1) c1++; else if (v === 2) c2++; }
      if (c1 && !c2) s += me === 1 ? WIN[c1] : -WIN[c1] * 1.15; else if (c2 && !c1) s += me === 2 ? WIN[c2] : -WIN[c2] * 1.15;
    }
    return s;
  }
  const fiveAt = (g, x, y, c) => DIRS.some(([dx, dy]) => g.run(x, y, dx, dy, c) + g.run(x, y, -dx, -dy, c) + 1 >= 5);
  // 놓으면 다섯이 되는 빈 곳들
  function winSpots(g, c) { const out = []; for (const [x, y] of candidates(g)) if (g.at(x, y) === 0 && fiveAt(g, x, y, c)) out.push([x, y]); return out; }
  // 사(4)를 만드는 곳: 놓은 뒤 이기는 곳이 생김
  function fourMoves(g, c) {
    const out = [];
    for (const [x, y] of candidates(g)) {
      if (g.at(x, y) !== 0) continue;
      let ok = false;
      for (const [dx, dy] of DIRS) { const a = g.run(x, y, dx, dy, c), b2 = g.run(x, y, -dx, -dy, c); if (a + b2 + 1 >= 3) { ok = true; break; } const a2 = g.at(x + dx * (a + 1), y + dy * (a + 1)) === 0 ? g.run(x + dx * (a + 1), y + dy * (a + 1), dx, dy, c) : 0, b3 = g.at(x - dx * (b2 + 1), y - dy * (b2 + 1)) === 0 ? g.run(x - dx * (b2 + 1), y - dy * (b2 + 1), -dx, -dy, c) : 0; if (a + b2 + 1 + a2 + b3 >= 4) { ok = true; break; } }
      if (!ok || g.banned(x, y, c)) continue;                  // v67 3·3 자리는 못 둠
      g.b[y * N + x] = c; const w = winSpots(g, c); g.b[y * N + x] = 0;
      if (w.length) out.push([x, y, w]);
    }
    return out;
  }
  // VCF: c 가 계속 '사'를 두어 이길 수 있나 (상대는 막을 수밖에 없음). 이기면 첫 수
  function vcf(g, c, depth, stop) {
    if (depth <= 0 || stop()) return null;
    for (const [x, y, w] of fourMoves(g, c)) {
      if (w.length >= 2) return [x, y];                          // 사가 두 군데 → 못 막음
      g.b[y * N + x] = c; const [bx, by] = w[0];
      // 상대가 막는 자리에서 상대가 다섯이 되면 실패
      let ok = !fiveAt(g, bx, by, 3 - c);
      if (ok) { g.b[by * N + bx] = 3 - c; ok = !winSpots(g, 3 - c).length || winSpots(g, c).length > 0; if (ok) ok = !!vcf(g, c, depth - 1, stop); g.b[by * N + bx] = 0; }
      g.b[y * N + x] = 0;
      if (ok) return [x, y];
    }
    return null;
  }
  function ordered(g, c, k) {
    const op = 3 - c;
    const all = candidates(g).map(([x, y]) => ({ x, y, s: pointScore(g, x, y, c) + pointScore(g, x, y, op) * 0.9 })).sort((a, b) => b.s - a.s), out = [];
    for (const m of all) { if (out.length >= k) break; if (!g.banned(m.x, m.y, c)) out.push(m); }   // v67 3·3 자리는 빼고
    return out;
  }
  function negamax(g, depth, alpha, beta, k, stop) {
    const me = g.turn, op = 3 - me;
    const mine = winSpots(g, me); if (mine.length) return 9e5 + depth;   // 내 차례에 다섯 → 이김
    const theirs = winSpots(g, op);
    if (theirs.length > 1) return -9e5 - depth;                 // 상대 사(4)가 두 곳 → 못 막음
    if (depth === 0 || stop()) return evalBoard(g, me) - (theirs.length ? 2000 : 0);
    const list = theirs.length ? theirs.filter(([x, y]) => !g.banned(x, y, me)).map(([x, y]) => ({ x, y })) : ordered(g, me, k);
    if (!list.length) return theirs.length ? -9e5 - depth : evalBoard(g, me);   // v67 막을 자리가 3·3 이면 못 막음
    let best = -1e9;
    for (const m of list) {
      g.b[m.y * N + m.x] = me; g.turn = op;
      const v = -negamax(g, depth - 1, -beta, -alpha, k, stop);
      g.b[m.y * N + m.x] = 0; g.turn = me;
      if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
    }
    return best;
  }
  function aiMove(g, level) {
    const st = B.step(level), L = LV[st];
    if (st <= 3) return greedy(g, L);
    const me = g.turn, op = 3 - me;
    if (!g.moves.length) return { x: 7, y: 7 };
    const w = winSpots(g, me); if (w.length) return { x: w[0][0], y: w[0][1] };     // 바로 이김
    const t = winSpots(g, op).filter(([x, y]) => !g.banned(x, y, me)); if (t.length) return { x: t[0][0], y: t[0][1] };     // 바로 막음 (3·3 자리는 못 둠)
    const stop = B.deadline(L.ms);
    if (L.vcf) { const v = vcf(g, me, L.vcf, stop); if (v) return { x: v[0], y: v[1] }; }
    let root = ordered(g, me, L.k + 4);
    if (!root.length) return greedy(g, LV[3]);
    // 상대가 VCF 로 이길 수 있으면 그것을 깨는 수만 고름
    if (L.vcf && vcf(g, op, L.vcf, B.deadline(L.ms / 3))) {
      const safe = root.filter(m => { g.b[m.y * N + m.x] = me; const r = !vcf(g, op, L.vcf, B.deadline(L.ms / 6)); g.b[m.y * N + m.x] = 0; return r; });
      if (safe.length) root = safe;
    }
    let best = root[0], vals = null;
    for (let d = 1; d <= L.depth; d++) {                        // 한 수씩 더 깊이 (시간이 다 되면 그 전 결과)
      let bd = null, alpha = -1e9; const vs = [];
      for (const m of root) {                                   // 가장 좋은 수와 비슷한지만 알면 되므로 창을 좁힘
        g.b[m.y * N + m.x] = me; g.turn = op;
        const raw = -negamax(g, d - 1, -1e9, -alpha, L.k, stop), v = raw * (1 + (Math.random() - 0.5) * L.noise);
        if (raw - 16 - Math.abs(raw) * (0.03 + L.noise) > alpha) alpha = raw - 16 - Math.abs(raw) * (0.03 + L.noise);
        g.b[m.y * N + m.x] = 0; g.turn = me;
        if (stop() && d > 1) { bd = null; break; }
        vs.push({ x: m.x, y: m.y, v }); if (!bd || v > bd.v) bd = { x: m.x, y: m.y, v };
      }
      if (!bd) break;
      best = bd; vals = vs; root.sort((a, b2) => (a.x === bd.x && a.y === bd.y ? -1 : b2.x === bd.x && b2.y === bd.y ? 1 : 0));
      if (bd.v >= 9e5) break;
    }
    // 같은 판이면 늘 같은 수를 두지 않게: 가장 좋은 수와 거의 같은 수들 중 하나 (외워서 이기기 어렵게)
    if (vals && Math.abs(best.v) < 9e5) { const tol = Math.max(15, Math.abs(best.v) * 0.03), near = vals.filter(m => m.v >= best.v - tol); best = near[B.rand(near.length)]; }
    return { x: best.x, y: best.y };
  }

  /* ---------- 화면 ---------- */
  const px = i => M + i * C;
  // 판 옆 탁자 · 돌 통 · 이름
  function drawTable(ctx, names) {
    B.table(ctx, W, H);
    [1, 2].forEach(c => {
      const [x, y] = POT[c];
      B.tag(ctx, c === 1 ? '흑' : '백', x, y - 26, 13);
      B.pot(ctx, x, y, c === 1, 13);
      if (names && names[c]) B.tag(ctx, names[c], x, H - 8, 11);
    });
  }
  function drawBoard(ctx, g, hover, lastAi) {
    B.wood(ctx, 0, 0, BW, H);
    for (let i = 0; i < N; i++) { B.line(ctx, px(0), px(i), px(N - 1), px(i), B.INK, 1); B.line(ctx, px(i), px(0), px(i), px(N - 1), B.INK, 1); }
    ctx.strokeStyle = 'rgba(52,28,8,.6)'; ctx.lineWidth = 2; ctx.strokeRect(px(0) - 1, px(0) - 1, px(N - 1) - px(0) + 2, px(N - 1) - px(0) + 2);
    [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]].forEach(([x, y]) => B.star(ctx, px(x), px(y), 3));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = g.at(x, y); if (v) B.stone(ctx, px(x), px(y), 13, v === 1); }
    const last = g.moves[g.moves.length - 1];
    if (last) { ctx.fillStyle = '#FF5A5F'; ctx.fillRect(px(last[0]) - 3, px(last[1]) - 3, 6, 6); }
    if (hover && !g.winner && g.at(hover[0], hover[1]) === 0) {
      if (g.banned(hover[0], hover[1])) { const hx = px(hover[0]), hy = px(hover[1]); ctx.strokeStyle = '#E8202A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx - 8, hy - 8); ctx.lineTo(hx + 8, hy + 8); ctx.moveTo(hx + 8, hy - 8); ctx.lineTo(hx - 8, hy + 8); ctx.stroke(); }   // v67 3·3 자리 표시
      else B.stone(ctx, px(hover[0]), px(hover[1]), 13, g.turn === 1, 0.45);
    }
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
      let g = Rules(), mode = 'ai', level = 'normal', hover = null, busy = false, over = false, timer = 0, side = 0;
      const cfg = (window.GoSettings && GoSettings.get('omok')) || {}, MO = cfg.motion || {};
      let names = {};
      const homes = {};
      const mv = B.porter({ redraw: () => draw(), scale: MO.scale, speed: MO.speed, backSpeed: MO.backSpeed, pickMs: MO.pickMs, placeMs: MO.placeMs, homes });
      [1, 2].forEach(c => { homes[c] = [POT[c][0] + (c === 1 ? -4 : 4), H - 24 - mv.size.h * 0.42]; });   // 통 아래에서 기다림 (손 위치)
      const cell = (x, y) => [SIDE + px(x), px(y)];
      // 돌 하나를 아바타가 옮겨서 둠: 내려놓는 순간 판에 놓이고(place), 집에 돌아오면 done
      function carry(c, x, y, place, done) {
        busy = true; buttons();
        mv.add({ who: String(c), pot: POT[c], to: cell(x, y), piece: (cx, x2, y2) => B.stone(cx, x2, y2, 13, c === 1),
          onPlace: () => { place(); draw(); }, onDone: () => { busy = mv.busy(); done && done(); } });
      }
      function setPlayers(o) {
        const pl = B.players(mode, o, side, 'omok', level);
        mv.setAvatars({ 1: pl.av[0], 2: pl.av[1] }); names = { 1: pl.name[0], 2: pl.name[1] };
      }
      const human = () => mode === 'local' || (mode === 'online' ? g.turn - 1 === side : g.turn === 1);
      const send = m => { if (mode === 'online' && hooks.onMove) hooks.onMove(m); };
      const name = c => (c === 1 ? '흑' : '백');
      function turnText() {
        if (over) return;
        const who = mode === 'ai' ? (g.turn === 1 ? '내 차례 (흑)' : '컴퓨터 생각 중… (백)') : mode === 'online' ? (human() ? '내 차례 (' + name(g.turn) + ')' : '상대 차례… (' + name(g.turn) + ')') : name(g.turn) + ' 차례';
        hooks.onTurn({ text: who + ' · ' + g.moves.length + '수', side: g.turn - 1 });
      }
      function buttons() { hooks.onButtons([{ id: 'undo', label: '한 수 무르기', disabled: over || busy || mode === 'online' || !g.moves.length || (mode === 'ai' && g.moves.length < 2) }]); }
      function draw() {
        drawTable(ctx, names);
        ctx.save(); ctx.translate(SIDE, 0); drawBoard(ctx, g, busy ? null : hover); ctx.restore();
        mv.draw(ctx);
      }
      function after() {
        draw(); buttons();
        if (g.winner) return end();
        turnText();
        if (mode === 'ai' && g.turn === 2) {
          busy = true; buttons();
          timer = B.think(() => { const m = aiMove(g, level); if (!m) { busy = false; return after(); } carry(2, m.x, m.y, () => g.place(m.x, m.y), () => { if (!over) after(); }); }, 400);
        }
      }
      function end(resignSide, left) {
        over = true; clock.stop(); buttons();
        const w = resignSide ? 2 - resignSide : g.winner === 3 ? -1 : g.winner - 1;
        mv.clear(); busy = false; draw();
        const msg = w === -1 ? '판이 가득 차서 무승부!' : resignSide ? (left ? '상대가 나갔어요 · ' : name(resignSide) + ' 기권 · ') + name(3 - resignSide) + ' 승' : name(g.winner) + ' 다섯 줄 완성! ' + name(g.winner) + ' 승';
        hooks.onTurn({ text: msg, side: -1 });
        hooks.onOver({ winner: w, message: msg, moves: g.moves.length, duration_sec: clock.sec(), extra: { moves: g.moves.length }, record: { side, moves: g.moves.map(m => [m[0], m[1]]) } });   // v62 기보 (x, y)
      }
      const off = B.pointer(canvas, W, H, (t, x, y) => {
        const gx = Math.round((x - SIDE - M) / C), gy = Math.round((y - M) / C);
        const ok = gx >= 0 && gy >= 0 && gx < N && gy < N;
        if (t === 'move') { const nh = ok ? [gx, gy] : null; if (String(nh) !== String(hover)) { hover = nh; draw(); } }
        else if (t === 'leave') { hover = null; draw(); }
        else if (t === 'up' && ok && !over && !busy && human() && g.at(gx, gy) === 0 && g.banned(gx, gy)) { hooks.onToast && hooks.onToast('3·3 자리는 둘 수 없어요 (열린 3 이 두 줄 생김)'); }
        else if (t === 'up' && ok && !over && !busy && human() && g.at(gx, gy) === 0) {
          const c = g.turn; hover = null; send([gx, gy]);
          carry(c, gx, gy, () => g.place(gx, gy), () => { if (!over) after(); });
          turnText();
        }
      });
      draw();
      const onImg = () => draw(); window.addEventListener('gogo:img', onImg);
      return {
        get state() { return over ? 'over' : 'playing'; },
        start(o) {
          clearTimeout(timer); mv.clear(); o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal'; side = o.side || 0;
          setPlayers(o);
          g = Rules(); over = false; busy = false; clock.reset(); clock.start(); hooks.onState('playing'); after();
        },
        press(id) {
          if (id === 'resign' && !over) { clearTimeout(timer); mv.clear(); busy = false; send({ resign: 1 }); end(mode === 'ai' ? 1 : mode === 'online' ? side + 1 : g.turn); }
          if (id === 'undo' && !over && !busy && mode !== 'online') { g.undo(); if (mode === 'ai' && g.turn === 2) g.undo(); after(); }
        },
        remote(m) {
          if (over) return;
          if (m && m.resign) return end(2 - side, m.left);
          if (Array.isArray(m) && g.at(m[0], m[1]) === 0) { const c = g.turn; carry(c, m[0], m[1], () => g.place(m[0], m[1]), () => { if (!over) after(); }); }
        },
        togglePause() {}, action() {},
        destroy() { window.removeEventListener('gogo:img', onImg); clearTimeout(timer); mv.clear(); off(); }
      };
    }
  };
})();
