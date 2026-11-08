/*
 * gogo?gogo! — 블록 쌓기
 *  - GoBlocks.Engine : 화면 없이 규칙만 담당 (혼자 하기·대전·컴퓨터 상대가 함께 사용)
 *  - GoBlocks.drawBoard / drawRows : 그리기
 *  - GoBlocks.bestMove : 컴퓨터 상대의 놓을 자리 계산
 *  - GoGames.blocks : 혼자 하기 모드
 */
(function () {
  'use strict';
  const P = window.GoPixel;
  const COLS = 10, ROWS = 20;
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    // v96 아이템전 '기괴한 모양' (5칸짜리 · 보통 순서에는 안 나옴)
    a: [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
    b: [[1, 0, 1], [1, 1, 1], [0, 0, 0]],
    c: [[0, 0, 0, 0], [1, 1, 1, 1], [1, 0, 0, 0], [0, 0, 0, 0]],
    d: [[1, 0, 0], [1, 1, 0], [0, 1, 1]],
    e: [[1, 1, 0], [0, 1, 0], [0, 1, 1]],
    f: [[1, 0, 0], [1, 0, 0], [1, 1, 1]],
    g: [[1, 1, 1], [0, 1, 0], [0, 1, 0]]
  };
  const WEIRD = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const WEIRD_COL = { a: '#FF5FD2', b: '#B26BFF', c: '#FF8A3D', d: '#3FE0C8', e: '#E8FF5A', f: '#FF4A6E', g: '#8AA0FF' };
  const ITEM_CELL = '@', ITEM_COL = '#FFC83D';
  const KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const LINE_PTS = [0, 100, 300, 500, 800];
  const GARBAGE = '#5B6390';
  const rotCW = m => m[0].map((_, i) => m.map(r => r[i]).reverse());
  const KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]];
  const colorOf = k => (k === 'G' ? GARBAGE : k === ITEM_CELL ? ITEM_COL : P.PIECE[k] || WEIRD_COL[k] || GARBAGE);
  // 아이템 칸: 금색 블록 위에 반짝이는 별
  function itemMark(ctx, x, y, C) {
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 260, cx = x + C / 2, cy = y + C / 2, r = C * (0.3 + 0.05 * Math.sin(t));
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * 0.42 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  // 같은 씨앗(seed)이면 모두에게 같은 블록 순서 → 공정한 대전
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- 규칙 엔진 ---------------- */
  function Engine(opt) {
    opt = opt || {};
    const rnd = opt.seed != null ? mulberry32(opt.seed) : Math.random;
    const e = { grid: null, cur: null, queue: [], hold: null, canHold: true, score: 0, lines: 0, level: 1, sent: 0, over: false, acc: 0, pending: [], elapsed: 0, hidePieces: 0 };
    let bag = [];
    // 다음 블록: 5개까지 미리 보임 (e.next = 바로 다음 1개)
    Object.defineProperty(e, 'next', { get: () => e.queue[0] || null });

    function newBag() {
      const b = KEYS.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [b[i], b[j]] = [b[j], b[i]]; }
      return b;
    }
    function take() { if (!bag.length) bag = newBag(); const k = bag.pop(); return { k, m: SHAPES[k].map(r => r.slice()), x: 0, y: 0 }; }
    e.hit = function (m, x, y, grid) {
      grid = grid || e.grid;
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const gx = x + c, gy = y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
      return false;
    };
    function topOut() { if (e.over) return; e.over = true; opt.onTopOut && opt.onTopOut(); }
    function place(p) {
      e.cur = p; e.cur.x = ((COLS - e.cur.m[0].length) / 2) | 0; e.cur.y = e.cur.k === 'I' ? -1 : 0;
      if (e.hit(e.cur.m, e.cur.x, e.cur.y)) topOut();
    }
    function spawn() {
      while (e.queue.length < 6) e.queue.push(take());
      const p = e.queue.shift(); e.queue.push(take());
      e.canHold = true;
      place(p);
    }
    // 블록 저장(홀드): 저장 칸이 비면 지금 블록을 넣고 다음 블록을 꺼냄, 차 있으면 서로 바꿈 (블록 하나당 1번)
    e.holdSwap = function () {
      if (e.over || !e.canHold || !e.cur) return false;
      const k = e.cur.k;
      if (e.hold) { const h = e.hold; e.hold = k; place({ k: h, m: SHAPES[h].map(r => r.slice()), x: 0, y: 0 }); }
      else { e.hold = k; spawn(); }
      e.canHold = false; e.acc = 0;
      return true;
    };
    e.reset = function () {
      e.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      bag = []; e.queue = []; e.hold = null; e.canHold = true; e.score = 0; e.lines = 0; e.level = 1; e.sent = 0;
      e.over = false; e.acc = 0; e.pending = []; e.elapsed = 0; e.hidePieces = 0;
      if (opt.startRows) e.setRows(opt.startRows);   // v96 아이템전: 모두 같은 줄로 시작
      spawn();
    };
    e.interval = () => Math.max(90, 800 - (e.level - 1) * 65) / (opt.speed || 1);   // v58: opt.speed = 빠르기 배수 (랭킹 대전 1.5)
    e.move = function (dx, dy) {
      if (e.over || e.hit(e.cur.m, e.cur.x + dx, e.cur.y + dy)) return false;
      e.cur.x += dx; e.cur.y += dy; return true;
    };
    e.rotate = function (ccw) {
      if (e.over) return;
      // v50: 기본 회전(↑·W·탭)은 반시계방향, 반대 키(Z·Q·/)는 시계방향 (선생님 요청)
      let m = rotCW(rotCW(rotCW(e.cur.m))); if (ccw) m = rotCW(rotCW(m));
      for (const [ox, oy] of KICKS) if (!e.hit(m, e.cur.x + ox, e.cur.y + oy)) { e.cur.m = m; e.cur.x += ox; e.cur.y += oy; return; }
    };
    // 받은 공격 줄을 바닥에서 밀어 올림 (한 번의 공격마다 빈칸 위치는 무작위)
    function applyGarbage() {
      let out = false;
      while (e.pending.length) {
        const n = e.pending.shift(), hole = Math.random() * COLS | 0;
        for (let i = 0; i < n; i++) {
          const top = e.grid.shift();
          if (top.some(Boolean)) out = true;
          const row = Array(COLS).fill('G'); row[hole] = null;
          e.grid.push(row);
        }
      }
      if (out) topOut();
    }
    function lock() {
      let out = false;
      e.cur.m.forEach((row, r) => row.forEach((v, c) => {
        if (!v) return; const gy = e.cur.y + r;
        if (gy < 0) out = true; else e.grid[gy][e.cur.x + c] = e.cur.k;
      }));
      if (out) return topOut();
      const full = [];
      e.grid.forEach((row, i) => { if (row.every(Boolean)) full.push(i); });
      if (full.length) {
        const items = full.reduce((a, i) => a + e.grid[i].filter(k => k === ITEM_CELL).length, 0);   // v96 아이템 칸이 든 줄을 지우면 아이템
        full.forEach(i => { e.grid.splice(i, 1); e.grid.unshift(Array(COLS).fill(null)); });
        if (items && opt.onItems) opt.onItems(items);
        e.lines += full.length;
        e.score += LINE_PTS[full.length] * e.level;
        e.level = opt.levelFn ? opt.levelFn(e) : 1 + Math.floor(e.lines / 10);
        opt.onClear && opt.onClear(full.length);
      }
      if (e.over) return;
      applyGarbage();
      if (e.over) return;
      e.acc = 0;
      if (e.hidePieces > 0) e.hidePieces--;
      spawn();
      opt.onLock && opt.onLock();
    }
    e.soft = function () { if (e.over) return; if (e.move(0, 1)) { e.score += 1; e.acc = 0; } else lock(); };
    e.hard = function () { if (e.over) return; let n = 0; while (e.move(0, 1)) n++; e.score += n * 2; lock(); };
    e.update = function (dt) {
      if (e.over) return;
      e.elapsed += dt; e.acc += dt;
      if (opt.levelFn) e.level = opt.levelFn(e);
      if (e.acc >= e.interval()) { e.acc = 0; if (!e.move(0, 1)) lock(); }
    };
    e.addGarbage = n => { if (!e.over && n > 0) e.pending.push(n); };
    /* ---- v96 아이템전 ---- */
    // 문자열 줄(위→아래, '.' = 빈칸)로 판을 바꿈 (시작 줄 · 판 바꾸기)
    e.setRows = function (rows) {
      const g = Array.from({ length: ROWS }, () => Array(COLS).fill(null)), off = ROWS - rows.length;
      rows.forEach((row, r) => { for (let c = 0; c < COLS; c++) { const k = row[c]; if (k && k !== '.' && r + off >= 0) g[r + off][c] = k; } });
      e.grid = g;
      if (e.cur) { let n = 0; while (e.hit(e.cur.m, e.cur.x, e.cur.y) && n++ < 4) e.cur.y--; }   // 지금 블록이 겹치면 위로
    };
    // 맨 아래 n줄 없애기
    e.removeBottom = function (n) { for (let i = 0; i < n; i++) { e.grid.pop(); e.grid.unshift(Array(COLS).fill(null)); } };
    // 판 비우기 (받을 공격 줄도 없앰)
    e.clearAll = function () { e.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null)); e.pending = []; };
    // 다음 블록 n개를 5칸짜리 기괴한 모양으로
    e.makeWeird = function (n) { for (let i = 0; i < n && i < e.queue.length; i++) { const k = WEIRD[Math.random() * WEIRD.length | 0]; e.queue[i] = { k, m: SHAPES[k].map(r => r.slice()), x: 0, y: 0 }; } };
    // 쌓인 블록 한 칸을 아이템 칸으로 (이미 max 개 있으면 안 함)
    e.addItemCell = function (max) {
      const cells = [];
      let have = 0;
      e.grid.forEach((row, r) => row.forEach((k, c) => { if (k === ITEM_CELL) have++; else if (k) cells.push([r, c]); }));
      if (have >= (max || 3) || !cells.length) return false;
      const [r, c] = cells[Math.random() * cells.length | 0]; e.grid[r][c] = ITEM_CELL; return true;
    };
    e.height = function () { for (let r = 0; r < ROWS; r++) if (e.grid[r].some(Boolean)) return ROWS - r; return 0; };
    e.pendingLines = () => e.pending.reduce((a, b) => a + b, 0);
    e.ghostY = function () { let y = e.cur.y; while (!e.hit(e.cur.m, e.cur.x, y + 1)) y++; return y; };
    e.rows = () => e.grid.map(r => r.map(k => k || '.').join(''));
    e.reset();
    return e;
  }

  /* ---------------- 그리기 ---------------- */
  function drawBoard(ctx, e, ox, oy, C, opts) {
    opts = opts || {};
    P.boardBg(ctx, ox, oy, COLS * C, ROWS * C);
    ctx.fillStyle = 'rgba(120,140,230,.16)';
    for (let c = 1; c < COLS; c++) ctx.fillRect(ox + c * C, oy, 1, ROWS * C);
    for (let r = 1; r < ROWS; r++) ctx.fillRect(ox, oy + r * C, COLS * C, 1);
    e.grid.forEach((row, r) => row.forEach((k, c) => { if (k) { P.block(ctx, ox + c * C, oy + r * C, C, colorOf(k)); if (k === ITEM_CELL) itemMark(ctx, ox + c * C, oy + r * C, C); } }));
    if (!e.over && e.cur && opts.live !== false && !(e.hidePieces > 0)) {
      const gy = e.ghostY();
      ctx.strokeStyle = colorOf(e.cur.k); ctx.globalAlpha = 0.45; ctx.lineWidth = 2;
      e.cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && gy + r >= 0) ctx.strokeRect(ox + (e.cur.x + c) * C + 2, oy + (gy + r) * C + 2, C - 4, C - 4); }));
      ctx.globalAlpha = 1;
      e.cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && e.cur.y + r >= 0) P.block(ctx, ox + (e.cur.x + c) * C, oy + (e.cur.y + r) * C, C, colorOf(e.cur.k)); }));
    }
    if (!e.over && e.hidePieces > 0 && opts.live !== false) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(ox, oy, COLS * C, ROWS * C); P.text(ctx, '??? ' + e.hidePieces, ox + COLS * C / 2, oy + 24, 12, '#B9C2FF', 'center'); }
  }
  // 상대 화면(작은 판): 문자열 20줄을 그대로 그림
  function drawRows(ctx, rows, ox, oy, C) {
    P.boardBg(ctx, ox, oy, COLS * C, ROWS * C);
    (rows || []).forEach((row, r) => { for (let c = 0; c < COLS; c++) { const k = row[c]; if (k && k !== '.') { P.block(ctx, ox + c * C, oy + r * C, C, colorOf(k)); if (k === ITEM_CELL) itemMark(ctx, ox + c * C, oy + r * C, C); } } });
  }
  function drawPiece(ctx, k, m, ox, oy, s) {
    m.forEach((row, r) => row.forEach((v, c) => { if (v) P.block(ctx, ox + c * s, oy + r * s, s, colorOf(k)); }));
  }
  // 블록 하나를 상자 가운데에 (k 없으면 빈 상자)
  function drawBox(ctx, k, x, y, w, h, s, dim) {
    ctx.fillStyle = P.BOARD; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(120,140,230,.18)'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    if (!k) return;
    const m = SHAPES[k].filter(r => r.some(Boolean)), mw = m[0].length * s, mh = m.length * s;
    if (dim) ctx.globalAlpha = 0.35;
    drawPiece(ctx, k, m, Math.round(x + (w - mw) / 2), Math.round(y + (h - mh) / 2), s);
    ctx.globalAlpha = 1;
  }
  // 다음 블록 n개 (첫 번째는 크게)
  function drawQueue(ctx, e, x, y, w, n) {
    const q = e.queue.slice(0, n || 5);
    q.forEach((p, i) => {
      if (i === 0) drawBox(ctx, p.k, x, y, w, 64, 16);
      else drawBox(ctx, p.k, x + 12, y + 70 + (i - 1) * 44, w - 24, 40, 11);
    });
  }
  function drawNext(ctx, e, x, y, w, h) {
    ctx.fillStyle = P.BOARD; ctx.fillRect(x, y, w, h);
    if (!e.next) return;
    const s = 18, mw = e.next.m[0].length * s, mh = e.next.m.length * s;
    drawPiece(ctx, e.next.k, e.next.m, x + (w - mw) / 2, y + (h - mh) / 2 + (e.next.k === 'I' ? 9 : 0), s);
  }

  /* ---------------- 컴퓨터 상대 ---------------- */
  function evaluate(grid) {
    const heights = Array(COLS).fill(0); let holes = 0;
    for (let c = 0; c < COLS; c++) {
      let seen = false;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r][c]) { if (!seen) { heights[c] = ROWS - r; seen = true; } }
        else if (seen) holes++;
      }
    }
    let bump = 0; for (let c = 0; c < COLS - 1; c++) bump += Math.abs(heights[c] - heights[c + 1]);
    const agg = heights.reduce((a, b) => a + b, 0);
    return { agg, holes, bump, maxH: Math.max.apply(null, heights) };
  }
  function bestMove(e, err) {
    const cands = [];
    let m = SHAPES[e.cur.k].map(r => r.slice());
    for (let rot = 0; rot < 4; rot++) {
      for (let x = -2; x < COLS; x++) {
        if (e.hit(m, x, -2)) continue;
        let y = -2; while (!e.hit(m, x, y + 1)) y++;
        const g = e.grid.map(r => r.slice()); let bad = false;
        m.forEach((row, r) => row.forEach((v, c) => { if (!v) return; if (y + r < 0) bad = true; else g[y + r][x + c] = e.cur.k; }));
        if (bad) continue;
        let cleared = 0;
        for (let r = ROWS - 1; r >= 0; r--) if (g[r].every(Boolean)) { g.splice(r, 1); g.unshift(Array(COLS).fill(null)); cleared++; r++; }
        const f = evaluate(g);
        const s = -0.51 * f.agg + 0.76 * cleared - 0.36 * f.holes - 0.18 * f.bump + (cleared >= 3 ? 1.5 : 0) - (f.maxH > 15 ? 4 : 0);
        cands.push({ s, m: m.map(r => r.slice()), x });
      }
      m = rotCW(m);
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.s - a.s);
    if (err && Math.random() < err) return cands[Math.min(cands.length - 1, 1 + (Math.random() * 3 | 0))];
    return cands[0];
  }
  const BOT_LEVELS = {
    easy: { name: '쉬움', delay: 1100, err: 0.35 },
    normal: { name: '보통', delay: 650, err: 0.12 },
    hard: { name: '어려움', delay: 320, err: 0.03 }
  };
  // 컴퓨터 한 명: 엔진 + 생각하는 시간
  function Bot(level, opt) {
    const L = BOT_LEVELS[level] || BOT_LEVELS.normal;
    const eng = Engine(opt);
    let t = 0;
    return {
      eng,
      update(dt) {
        if (eng.over) return;
        eng.update(dt); t += dt;
        if (t >= L.delay * (0.8 + Math.random() * 0.4)) {
          t = 0;
          const mv = bestMove(eng, L.err);
          if (mv && !eng.hit(mv.m, mv.x, eng.cur.y)) { eng.cur.m = mv.m; eng.cur.x = mv.x; }
          eng.hard();
        }
      }
    };
  }

  window.GoBlocks = { Engine, Bot, BOT_LEVELS, drawBoard, drawRows, drawNext, drawPiece, drawBox, drawQueue, bestMove, COLS, ROWS, SHAPES, colorOf, mulberry32, ITEM_CELL, itemMark };

  /* ---------------- 혼자 하기 모드 ---------------- */
  const C = 24, SIDE = 132, W = COLS * C + SIDE, H = ROWS * C;
  window.GoGames.blocks = {
    id: 'blocks', size: [W, H],

    thumb(ctx, w, h) {
      ctx.fillStyle = P.BOARD; ctx.fillRect(0, 0, w, h);
      const s = 15, cols = Math.ceil(w / s), base = Math.floor(h / s);
      const heights = [3, 4, 2, 5, 3, 3, 1, 4, 5, 2, 3, 4, 2, 3, 4, 5, 3];
      for (let c = 0; c < cols; c++) {
        const hh = heights[c % heights.length];
        for (let r = 0; r < hh; r++) P.block(ctx, c * s, (base - 1 - r) * s, s, P.PIECE[KEYS[(c * 3 + r) % 7]]);
      }
      drawPiece(ctx, 'T', SHAPES.T, Math.round(w / 2 - s * 1.5), s * 2, s);
      drawPiece(ctx, 'I', SHAPES.I, s * 2, 0, s);
    },

    create(canvas, hooks) {
      const ctx = P.setup(canvas, W, H);
      const clock = P.clock();
      let state = 'ready', last = 0, raf = 0, shown = -1;
      const eng = Engine({
        onTopOut() {
          state = 'over'; clock.stop(); hooks.onScore(eng.score); hooks.onState('over');
          hooks.onOver({ score: eng.score, duration_sec: clock.sec(), extra: { lines: eng.lines, level: eng.level } });
        }
      });

      function draw() {
        drawBoard(ctx, eng, 0, 0, C, { live: state !== 'over' });
        const x0 = COLS * C, cx = x0 + 18;
        ctx.fillStyle = P.PANEL; ctx.fillRect(x0, 0, SIDE, H);
        ctx.fillStyle = '#2A3366'; ctx.fillRect(x0, 0, 2, H);
        P.text(ctx, 'NEXT', cx, 18, 10, P.DIM);
        drawNext(ctx, eng, cx, 36, 96, 72);
        P.text(ctx, 'SCORE', cx, 136, 10, P.DIM);
        P.text(ctx, eng.score, cx, 154, eng.score > 99999 ? 11 : 13, P.INK);
        P.text(ctx, 'LINES', cx, 196, 10, P.DIM);
        P.text(ctx, eng.lines, cx, 214, 13, P.INK);
        P.text(ctx, 'LEVEL', cx, 256, 10, P.DIM);
        P.text(ctx, eng.level, cx, 274, 13, P.PIECE.O);
        ctx.fillStyle = P.BOARD; ctx.fillRect(cx, 300, 96, 8);
        ctx.fillStyle = P.PIECE.O; ctx.fillRect(cx, 300, 96 * ((eng.lines % 10) / 10), 8);
      }
      function tick(t) {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(100, t - (last || t)); last = t;
        if (state === 'playing') eng.update(dt);
        if (eng.score !== shown) { shown = eng.score; hooks.onScore(eng.score); }
        draw();
      }
      raf = requestAnimationFrame(tick);

      return {
        get state() { return state; },
        start() {
          if (state === 'over') { eng.reset(); clock.reset(); }
          state = 'playing'; clock.start(); hooks.onState('playing');
        },
        togglePause() {
          if (state === 'playing') { state = 'paused'; clock.stop(); hooks.onState('paused'); }
          else if (state === 'paused') { state = 'playing'; clock.start(); hooks.onState('playing'); }
        },
        action(a) {
          if (state !== 'playing') return;
          if (a === 'left') eng.move(-1, 0);
          else if (a === 'right') eng.move(1, 0);
          else if (a === 'down') eng.soft();
          else if (a === 'up' || a === 'rotate' || a === 'tap') eng.rotate(false);
          else if (a === 'rotateL') eng.rotate(true);
          else if (a === 'drop') eng.hard();
        },
        destroy() { cancelAnimationFrame(raf); }
      };
    }
  };

})();
