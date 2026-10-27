/*
 * gogo?gogo! — 체스 (백 먼저)
 *  - 캐슬링, 앙파상, 폰 승진(퀸으로 자동), 체크·체크메이트·스테일메이트
 *  - 무승부: 스테일메이트, 기물 부족, 50수 규칙
 */
(function () {
  'use strict';
  const B = window.GoBoard;
  const S = 60, W = S * 8, H = S * 8;
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const isW = p => p && p === p.toUpperCase();
  const col = p => (p ? (isW(p) ? 'w' : 'b') : null);
  const sq = (x, y) => y * 8 + x, X = i => i & 7, Y = i => i >> 3;

  /* ---------- 규칙 ---------- */
  function initial() {
    const rows = ['rnbqkbnr', 'pppppppp', '........', '........', '........', '........', 'PPPPPPPP', 'RNBQKBNR'];
    return { b: rows.join('').split('').map(c => (c === '.' ? null : c)), turn: 'w', castle: { K: true, Q: true, k: true, q: true }, ep: -1, half: 0, moves: 0 };
  }
  function attacked(b, i, by) {
    const x = X(i), y = Y(i);
    // 폰
    const pd = by === 'w' ? 1 : -1, pawn = by === 'w' ? 'P' : 'p';
    for (const dx of [-1, 1]) { const nx = x + dx, ny = y + pd; if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && b[sq(nx, ny)] === pawn) return true; }
    // 나이트
    const kn = by === 'w' ? 'N' : 'n';
    for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && b[sq(nx, ny)] === kn) return true; }
    // 킹
    const kg = by === 'w' ? 'K' : 'k';
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && b[sq(nx, ny)] === kg) return true; }
    // 직선·대각
    const lines = [[[1, 0], [-1, 0], [0, 1], [0, -1]], [[1, 1], [1, -1], [-1, 1], [-1, -1]]];
    for (let k = 0; k < 2; k++) for (const [dx, dy] of lines[k]) {
      let nx = x + dx, ny = y + dy;
      while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
        const p = b[sq(nx, ny)];
        if (p) { if (col(p) === by) { const t = p.toLowerCase(); if (t === 'q' || (k === 0 ? t === 'r' : t === 'b')) return true; } break; }
        nx += dx; ny += dy;
      }
    }
    return false;
  }
  const kingSq = (b, c) => b.indexOf(c === 'w' ? 'K' : 'k');
  const inCheck = (st, c) => attacked(st.b, kingSq(st.b, c), c === 'w' ? 'b' : 'w');
  function pseudo(st) {
    const b = st.b, c = st.turn, out = [], opp = c === 'w' ? 'b' : 'w';
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p || col(p) !== c) continue;
      const x = X(i), y = Y(i), t = p.toLowerCase();
      const push = (to, flag) => { const q = b[to]; if (q && col(q) === c) return false; out.push({ from: i, to, cap: q || (flag === 'ep' ? 'p' : null), flag }); return !q; };
      if (t === 'p') {
        const d = c === 'w' ? -1 : 1, start = c === 'w' ? 6 : 1, ny = y + d;
        if (ny >= 0 && ny < 8 && !b[sq(x, ny)]) {
          out.push({ from: i, to: sq(x, ny), cap: null, promo: ny === 0 || ny === 7 ? 'q' : null });
          if (y === start && !b[sq(x, y + 2 * d)]) out.push({ from: i, to: sq(x, y + 2 * d), cap: null, flag: 'double' });
        }
        for (const dx of [-1, 1]) {
          const nx = x + dx; if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue;
          const to = sq(nx, ny), q = b[to];
          if (q && col(q) === opp) out.push({ from: i, to, cap: q, promo: ny === 0 || ny === 7 ? 'q' : null });
          else if (to === st.ep) out.push({ from: i, to, cap: 'p', flag: 'ep' });
        }
      } else if (t === 'n' || t === 'k') {
        const ds = t === 'n' ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dx, dy] of ds) { const nx = x + dx, ny = y + dy; if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) push(sq(nx, ny)); }
        if (t === 'k') {
          const r = c === 'w' ? 7 : 0, K = c === 'w' ? 'K' : 'k', Q = c === 'w' ? 'Q' : 'q';
          if (i === sq(4, r) && !attacked(b, i, opp)) {
            if (st.castle[K] && !b[sq(5, r)] && !b[sq(6, r)] && b[sq(7, r)] === (c === 'w' ? 'R' : 'r') && !attacked(b, sq(5, r), opp) && !attacked(b, sq(6, r), opp)) out.push({ from: i, to: sq(6, r), cap: null, flag: 'castle' });
            if (st.castle[Q] && !b[sq(3, r)] && !b[sq(2, r)] && !b[sq(1, r)] && b[sq(0, r)] === (c === 'w' ? 'R' : 'r') && !attacked(b, sq(3, r), opp) && !attacked(b, sq(2, r), opp)) out.push({ from: i, to: sq(2, r), cap: null, flag: 'castle' });
          }
        }
      } else {
        const ds = t === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : t === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dx, dy] of ds) { let nx = x + dx, ny = y + dy; while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && push(sq(nx, ny))) { nx += dx; ny += dy; } }
      }
    }
    return out;
  }
  function make(st, m) {
    const b = st.b.slice(), p = b[m.from], c = st.turn, t = p.toLowerCase();
    b[m.to] = m.promo ? (c === 'w' ? m.promo.toUpperCase() : m.promo) : p; b[m.from] = null;
    if (m.flag === 'ep') b[m.to + (c === 'w' ? 8 : -8)] = null;
    if (m.flag === 'castle') { const r = Y(m.to); if (X(m.to) === 6) { b[sq(5, r)] = b[sq(7, r)]; b[sq(7, r)] = null; } else { b[sq(3, r)] = b[sq(0, r)]; b[sq(0, r)] = null; } }
    const castle = Object.assign({}, st.castle);
    if (t === 'k') { if (c === 'w') castle.K = castle.Q = false; else castle.k = castle.q = false; }
    [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']].forEach(([s, k]) => { if (m.from === s || m.to === s) castle[k] = false; });
    return { b, turn: c === 'w' ? 'b' : 'w', castle, ep: m.flag === 'double' ? (m.from + m.to) / 2 : -1, half: t === 'p' || m.cap ? 0 : st.half + 1, moves: st.moves + 1 };
  }
  function legal(st) { return pseudo(st).filter(m => { const n = make(st, m); return !attacked(n.b, kingSq(n.b, st.turn), n.turn); }); }
  function insufficient(b) {
    const rest = b.filter(p => p && p.toLowerCase() !== 'k');
    return !rest.length || (rest.length === 1 && 'nb'.includes(rest[0].toLowerCase()));
  }
  // 결과: null = 진행 중, { winner: 'w'|'b'|null, why }
  function status(st) {
    const ms = legal(st);
    if (!ms.length) return inCheck(st, st.turn) ? { winner: st.turn === 'w' ? 'b' : 'w', why: '체크메이트' } : { winner: null, why: '스테일메이트' };
    if (insufficient(st.b)) return { winner: null, why: '기물 부족' };
    if (st.half >= 100) return { winner: null, why: '50수 규칙' };
    if (st.moves >= 300) return { winner: null, why: '수 제한' };
    return null;
  }

  /* ---------- 컴퓨터 ---------- */
  const PST_P = [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0];
  const CENTER = i => { const x = X(i), y = Y(i); return 3.5 - Math.max(Math.abs(x - 3.5), Math.abs(y - 3.5)); };
  function evaluate(st, c) {
    let v = 0;
    for (let i = 0; i < 64; i++) {
      const p = st.b[i]; if (!p) continue;
      const t = p.toLowerCase(), w = isW(p);
      let s = VAL[t];
      if (t === 'p') s += PST_P[w ? i : 63 - i];
      else if (t === 'n' || t === 'b') s += CENTER(i) * 10;
      else if (t === 'q') s += CENTER(i) * 3;
      else if (t === 'k') s += st.moves < 40 ? -CENTER(i) * 8 : CENTER(i) * 6;
      v += (w ? 1 : -1) * s;
    }
    return c === 'w' ? v : -v;
  }
  function order(ms) { return ms.sort((a, b) => (b.cap ? VAL[b.cap.toLowerCase()] * 10 - 1 : 0) + (b.promo ? 800 : 0) - ((a.cap ? VAL[a.cap.toLowerCase()] * 10 - 1 : 0) + (a.promo ? 800 : 0))); }
  function search(st, depth, alpha, beta) {
    const ms = legal(st);
    if (!ms.length) return inCheck(st, st.turn) ? -100000 - depth : 0;
    if (depth === 0) return evaluate(st, st.turn);
    for (const m of order(ms)) {
      const v = -search(make(st, m), depth - 1, -beta, -alpha);
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return alpha;
  }
  const LV = { easy: { depth: 1, noise: 120 }, normal: { depth: 2, noise: 20 }, hard: { depth: 3, noise: 4 } };
  function aiMove(st, level) {
    const L = LV[level] || LV.normal; let best = null;
    for (const m of order(B.shuffle(legal(st)))) {
      const v = -search(make(st, m), L.depth - 1, -1e9, 1e9) + Math.random() * L.noise;
      if (!best || v > best.v) best = { m, v };
    }
    return best && best.m;
  }

  /* ---------- 도트 기물 (12 × 12) ---------- */
  const SPR = {
    p: ['............', '.....##.....', '....####....', '....####....', '.....##.....', '....####....', '.....##.....', '.....##.....', '....####....', '...######...', '..########..', '............'],
    r: ['............', '..##.##.##..', '..########..', '...######...', '....####....', '....####....', '....####....', '....####....', '...######...', '..########..', '..########..', '............'],
    n: ['............', '.....#.#....', '....#####...', '...###.###..', '..########..', '..##..####..', '......####..', '.....####...', '....#####...', '...######...', '..########..', '............'],
    b: ['............', '.....##.....', '....####....', '....##.#....', '...###.##...', '...######...', '....####....', '.....##.....', '....####....', '...######...', '..########..', '............'],
    q: ['............', '..#..##..#..', '..##.##.##..', '..########..', '...######...', '....####....', '....####....', '...######...', '....####....', '...######...', '..########..', '............'],
    k: ['.....##.....', '....####....', '.....##.....', '...######...', '..########..', '..########..', '...######...', '....####....', '....####....', '...######...', '..########..', '............']
  };
  function drawPiece(ctx, p, x, y, size) {
    const s = SPR[p.toLowerCase()], u = size / 12, w = isW(p);
    const fill = w ? '#F7F3E8' : '#2A2E3D', edge = '#14161F', hi = w ? '#FFFFFF' : '#4A5070';
    const on = (i, j) => i >= 0 && j >= 0 && i < 12 && j < 12 && s[j][i] === '#';
    for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
      if (on(i, j)) { ctx.fillStyle = (on(i - 1, j) && on(i, j - 1)) ? fill : hi; ctx.fillRect(x + i * u, y + j * u, u, u); }
      else if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) { ctx.fillStyle = edge; ctx.fillRect(x + i * u, y + j * u, u, u); }
    }
  }
  function drawBoard(ctx, st, ui) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#B9824A' : '#F0D6A8'; ctx.fillRect(x * S, y * S, S, S);
    }
    if (ui.last) { ctx.fillStyle = 'rgba(255,210,63,.5)'; [ui.last.from, ui.last.to].forEach(i => ctx.fillRect(X(i) * S, Y(i) * S, S, S)); }
    if (ui.check >= 0) { ctx.fillStyle = 'rgba(255,90,95,.6)'; ctx.fillRect(X(ui.check) * S, Y(ui.check) * S, S, S); }
    if (ui.sel >= 0) { ctx.fillStyle = 'rgba(76,125,255,.45)'; ctx.fillRect(X(ui.sel) * S, Y(ui.sel) * S, S, S); }
    for (let i = 0; i < 64; i++) if (st.b[i]) drawPiece(ctx, st.b[i], X(i) * S + 6, Y(i) * S + 6, S - 12);
    (ui.targets || []).forEach(m => {
      const cx = X(m.to) * S + S / 2, cy = Y(m.to) * S + S / 2;
      if (m.cap) { ctx.strokeStyle = 'rgba(255,90,95,.9)'; ctx.lineWidth = 4; ctx.strokeRect(X(m.to) * S + 3, Y(m.to) * S + 3, S - 6, S - 6); }
      else { ctx.fillStyle = 'rgba(30,138,90,.75)'; ctx.fillRect(cx - 7, cy - 7, 14, 14); }
    });
    ctx.font = '700 11px "Press Start 2P", monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 2 ? '#F0D6A8' : '#B9824A'; ctx.fillText(8 - k, 3, k * S + 3);
      ctx.fillStyle = k % 2 ? '#B9824A' : '#F0D6A8'; ctx.fillText('abcdefgh'[k], k * S + S - 12, H - 13);
    }
  }

  window.GoGames.chess = {
    id: 'chess', size: [W, H], initial, legal, make, status, aiMove, inCheck,
    thumb(ctx, w, h) {
      const s = 30;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { ctx.fillStyle = (x + y) % 2 ? '#B9824A' : '#F0D6A8'; ctx.fillRect(x * s, y * s, s, s); }
      [['k', 4, 0], ['q', 2, 1], ['n', 6, 1], ['p', 3, 2], ['P', 4, 3], ['B', 5, 3], ['K', 6, 4], ['R', 1, 4]].forEach(([p, x, y]) => drawPiece(ctx, p, x * s + 3, y * s + 3, s - 6));
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      let st = initial(), ui = { sel: -1, targets: [], last: null, check: -1 }, mode = 'ai', level = 'normal', busy = false, over = false, timer = 0;
      const name = c => (c === 'w' ? '백' : '흑');
      const human = () => mode === 'local' || st.turn === 'w';
      const draw = () => { ui.check = inCheck(st, st.turn) ? kingSq(st.b, st.turn) : -1; drawBoard(ctx, st, ui); };
      function turnText() {
        if (over) return;
        const chk = ui.check >= 0 ? ' · 체크!' : '';
        const who = mode === 'ai' ? (st.turn === 'w' ? '내 차례 (백)' : '컴퓨터 생각 중… (흑)') : name(st.turn) + ' 차례';
        hooks.onTurn({ text: who + chk + ' · ' + Math.ceil(st.moves / 2 + 0.5) + '번째 수', side: st.turn === 'w' ? 0 : 1 });
      }
      function play(m) {
        const cap = m.cap; st = make(st, m); ui.last = m; ui.sel = -1; ui.targets = [];
        if (m.promo && hooks.onToast) hooks.onToast('폰이 퀸으로 승진했어요!');
        else if (m.flag === 'castle' && hooks.onToast) hooks.onToast('캐슬링!');
        void cap;
      }
      function after() {
        draw();
        const s = status(st);
        if (s) { const w = s.winner === 'w' ? 0 : s.winner === 'b' ? 1 : -1; return end(w, s.winner ? s.why + '! ' + name(s.winner) + ' 승' : s.why + ' — 무승부'); }
        turnText();
        if (mode === 'ai' && st.turn === 'b') {
          busy = true;
          timer = B.think(() => { const m = aiMove(st, level); if (m) play(m); busy = false; after(); }, 250);
        }
      }
      function end(w, msg) {
        over = true; clock.stop(); draw();
        hooks.onTurn({ text: msg, side: -1 });
        hooks.onOver({ winner: w, message: msg, moves: st.moves, duration_sec: clock.sec(), extra: { moves: st.moves } });
      }
      const off = B.pointer(canvas, W, H, (t, x, y) => {
        if (t !== 'up' || over || busy || !human()) return;
        const i = sq(Math.min(7, Math.floor(x / S)), Math.min(7, Math.floor(y / S)));
        const m = ui.targets.find(mm => mm.to === i);
        if (m) { play(m); return after(); }
        if (st.b[i] && col(st.b[i]) === st.turn) { ui.sel = i; ui.targets = legal(st).filter(mm => mm.from === i); }
        else { ui.sel = -1; ui.targets = []; }
        draw();
      });
      draw();
      return {
        get state() { return over ? 'over' : 'playing'; },
        start(o) {
          clearTimeout(timer); o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal';
          st = initial(); ui = { sel: -1, targets: [], last: null, check: -1 }; over = false; busy = false;
          clock.reset(); clock.start(); hooks.onState('playing'); hooks.onButtons([]); after();
        },
        press(id) { if (id === 'resign' && !over) { clearTimeout(timer); busy = false; const loser = mode === 'ai' ? 'w' : st.turn; end(loser === 'w' ? 1 : 0, name(loser) + ' 기권 · ' + name(loser === 'w' ? 'b' : 'w') + ' 승'); } },
        togglePause() {}, action() {},
        destroy() { clearTimeout(timer); off(); }
      };
    }
  };
})();
