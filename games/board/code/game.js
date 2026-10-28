/*
 * gogo?gogo! — 숫자 코드 추리 (다빈치 코드 방식, 2~4인)
 *  - 0~11 숫자 타일이 검정·흰색 한 벌씩 (24장). 2~3인은 4장씩, 4인은 3장씩 받습니다.
 *  - 타일은 작은 수부터 왼쪽에 놓이고, 같은 숫자면 검정이 왼쪽입니다. 타일 색은 모두에게 보입니다.
 *  - 내 차례: 검정 또는 흰 더미에서 1장 뽑기 → 아무 상대의 숨은 타일 하나를 골라 숫자 맞히기
 *      맞히면 그 타일이 공개되고, 더 맞히거나 '그만하기'(뽑은 타일은 숨긴 채 내 줄에 놓음)
 *      틀리면 뽑은 타일을 공개해서 내 줄에 놓고 차례 끝 (더미가 비었으면 내 숨은 타일 하나를 공개)
 *  - 숨은 타일이 모두 공개된 사람은 탈락. 마지막까지 남은 사람이 1등, 먼저 탈락할수록 순위가 낮아요.
 */
(function () {
  'use strict';
  const Bd = window.GoBoard;
  const W = 480, H = 480, TW1 = 32, TH1 = 46, TW2 = 26, TH2 = 36, GAP = 5;
  const TW = TW1, TH = TH1;
  const key = t => t.n * 2 + (t.c === 'w' ? 1 : 0);

  /* ---------- 규칙 ---------- */
  // 온라인은 모두 같은 씨앗(seed)으로 섞어서 같은 판을 만듦
  function seeded(a) {
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function newGame(n, rnd) {
    n = Math.max(2, Math.min(4, n || 2)); rnd = rnd || Math.random;
    const piles = { b: [], w: [] };
    for (let k = 0; k < 12; k++) { piles.b.push({ n: k, c: 'b' }); piles.w.push({ n: k, c: 'w' }); }
    const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } };
    shuf(piles.b); shuf(piles.w);
    const g = { n, piles, rows: Array.from({ length: n }, () => []), out: [], turn: 0, drawn: null, phase: 'draw', streak: 0, winner: null, log: [] };
    const take = c => { const p = g.piles[c].length ? g.piles[c] : g.piles[c === 'b' ? 'w' : 'b']; return p.pop(); };
    const deal = n === 4 ? 3 : 4;
    for (let k = 0; k < deal; k++) for (let s = 0; s < n; s++) { const t = take(rnd() < 0.5 ? 'b' : 'w'); t.open = false; insert(g.rows[s], t); }
    g.take = take;
    return g;
  }
  function insert(row, t) { let i = 0; while (i < row.length && key(row[i]) < key(t)) i++; row.splice(i, 0, t); return i; }
  const hidden = row => row.filter(t => !t.open);
  const deckSize = g => g.piles.b.length + g.piles.w.length;
  const alive = g => { const a = []; for (let s = 0; s < g.n; s++) if (!g.out.includes(s)) a.push(s); return a; };
  const rankOf = (g, s) => (g.winner === s ? 1 : g.out.includes(s) ? g.n - g.out.indexOf(s) : 0);
  function eliminate(g, s) {
    if (g.out.includes(s)) return;
    g.out.push(s);
    const a = alive(g);
    if (a.length === 1) { g.winner = a[0]; g.phase = 'over'; }
  }
  function draw(g, c) {
    if (!deckSize(g)) { g.drawn = null; g.phase = 'guess'; return null; }
    const pile = g.piles[c] && g.piles[c].length ? c : c === 'b' ? 'w' : 'b';
    const t = g.piles[pile].pop(); t.open = false; t.fresh = true; g.drawn = t; g.phase = 'guess'; return t;
  }
  // 추리: seat 번 사람의 idx 번째 타일이 n 인가? 맞으면 true
  function guess(g, seat, idx, n) {
    if (seat === g.turn || g.out.includes(seat)) return null;
    const opp = g.rows[seat], t = opp && opp[idx];
    if (!t || t.open) return null;
    if (t.n === n) {
      t.open = true; g.streak++; g.log.push({ by: g.turn, seat, idx, n, ok: true, tile: t });
      if (!hidden(opp).length) eliminate(g, seat);
      if (g.phase !== 'over') g.phase = 'more';
      return true;
    }
    g.log.push({ by: g.turn, seat, idx, n, ok: false, tile: t });
    if (g.drawn) { g.drawn.open = true; insert(g.rows[g.turn], g.drawn); g.drawn = null; endTurn(g); }
    else g.phase = 'penalty';          // 더미가 비었으면 내 타일 하나 공개
    return false;
  }
  function stop(g) { if (g.drawn) { insert(g.rows[g.turn], g.drawn); g.drawn = null; } endTurn(g); }
  function penalty(g, idx) {
    const t = g.rows[g.turn][idx]; if (!t || t.open) return false;
    t.open = true; endTurn(g); return true;
  }
  function nextSeat(g, s) { for (let k = 1; k <= g.n; k++) { const t = (s + k) % g.n; if (!g.out.includes(t)) return t; } return s; }
  function endTurn(g) {
    g.rows.forEach(r => r.forEach(t => { t.fresh = false; }));
    if (g.phase === 'over') return;
    // 내 숨은 타일이 모두 공개되면 탈락
    if (!hidden(g.rows[g.turn]).length) { eliminate(g, g.turn); if (g.phase === 'over') return; }
    g.turn = nextSeat(g, g.turn); g.streak = 0; g.phase = 'draw';
  }
  function resign(g, s) {               // 기권: 그 사람만 탈락, 남은 사람끼리 계속
    if (g.drawn && g.turn === s) { g.drawn = null; }
    eliminate(g, s);
    if (g.phase !== 'over' && g.turn === s) { g.turn = nextSeat(g, s); g.streak = 0; g.phase = 'draw'; }
  }

  /* ---------- 컴퓨터: 가능한 숫자 좁히기 ---------- */
  function possibilities(g, me, smart, seat) {
    if (seat == null) seat = nextSeat(g, me);
    const opp = g.rows[seat], known = new Set();
    const mark = t => known.add(t.c + t.n);
    g.rows[me].forEach(mark); if (g.drawn && g.turn === me) mark(g.drawn);
    g.rows.forEach(r => r.filter(t => t.open).forEach(mark));
    const n = opp.length, lo = Array(n).fill(-1), hi = Array(n).fill(24), cand = [];
    opp.forEach((t, i) => { if (t.open) lo[i] = hi[i] = key(t); });
    for (let pass = 0; pass < 3; pass++) {
      if (smart) {
        for (let i = 1; i < n; i++) lo[i] = Math.max(lo[i], lo[i - 1] + 1);
        for (let i = n - 2; i >= 0; i--) hi[i] = Math.min(hi[i], hi[i + 1] - 1);
      }
      opp.forEach((t, i) => {
        if (t.open) { cand[i] = null; return; }
        const c = [];
        for (let v = 0; v < 12; v++) { const k = v * 2 + (t.c === 'w' ? 1 : 0); if (!known.has(t.c + v) && (!smart || (k >= lo[i] && k <= hi[i]))) c.push(v); }
        // 이미 틀린 추측(누가 했든 모두 봤음)은 제외
        g.log.forEach(l => { if (!l.ok && l.tile === t) { const j = c.indexOf(l.n); if (j >= 0) c.splice(j, 1); } });
        cand[i] = c;
        if (smart && c.length) { lo[i] = Math.max(lo[i], c[0] * 2 + (t.c === 'w' ? 1 : 0)); hi[i] = Math.min(hi[i], c[c.length - 1] * 2 + (t.c === 'w' ? 1 : 0)); }
      });
    }
    return cand;
  }
  const LV = { easy: { smart: false, keepGoing: 1 }, normal: { smart: true, keepGoing: 1 }, hard: { smart: true, keepGoing: 2 } };
  function aiPick(g, level) {
    const L = LV[level] || LV.normal, me = g.turn, opts = [];
    alive(g).filter(s => s !== me).forEach(seat => {
      possibilities(g, me, L.smart, seat).forEach((c, i) => { if (c && c.length) opts.push({ seat, i, c }); });
    });
    if (!opts.length) {   // 안전장치: 후보가 비면 아무 숨은 타일
      for (const seat of alive(g)) { if (seat === me) continue; const i = g.rows[seat].findIndex(t => !t.open); if (i >= 0) return { seat, idx: i, n: Bd.rand(12), size: 12 }; }
      return null;
    }
    let best = null;
    if (level === 'easy' && Math.random() < 0.5) best = opts[Bd.rand(opts.length)];
    else opts.forEach(o => { if (!best || o.c.length < best.c.length || (o.c.length === best.c.length && Math.random() < 0.5)) best = o; });
    return { seat: best.seat, idx: best.i, n: best.c[Bd.rand(best.c.length)], size: best.c.length };
  }
  // 맞힌 뒤 계속할지: 확실(또는 어려움은 2지선다 이하)하면 계속
  function aiContinue(g, level) {
    const L = LV[level] || LV.normal, p = aiPick(g, level);
    return p && p.size <= L.keepGoing ? p : null;
  }
  function aiPenalty(g) { const r = g.rows[g.turn]; const hs = r.map((t, i) => (t.open ? -1 : i)).filter(i => i >= 0); return hs[Bd.rand(hs.length)]; }
  function aiPile(g) { return g.piles.b.length > g.piles.w.length ? 'b' : g.piles.w.length > g.piles.b.length ? 'w' : Math.random() < 0.5 ? 'b' : 'w'; }

  /* ---------- 화면 ---------- */
  // 타일: 두께·모서리 깎임·빛 그라데이션이 있는 도트 블록
  const TPAL = { b: ['#07080D', '#141824', '#202638', '#2D3550', '#3E4870', '#5A6694'], w: ['#7E7766', '#ABA390', '#CFC8B5', '#E6E0D0', '#F6F2E8', '#FFFFFF'] };
  function tileSprite(c, TW, TH) {
    return Bd.sprite('codeTile' + c + TW + 'x' + TH, TW + 4, TH + 6, (put) => {
      const pal = TPAL[c], D = 4;
      for (let y = 0; y < TH + D; y++) for (let x = 0; x < TW; x++) {
        const cut = (x < 2 && (y < 2 || y > TH + D - 3)) || (x > TW - 3 && (y < 2 || y > TH + D - 3)) || ((x < 1 || x > TW - 2) && (y < 3 || y > TH + D - 4));
        if (cut) continue;
        if (y >= TH - 1) { put(x, y, y === TH + D - 1 ? '#000000' : pal[1]); continue; }       // 옆면(두께)
        const edge = x === 0 || y === 0 || x === TW - 1;
        let v = 0.62 + (1 - y / TH) * 0.22 - x / TW * 0.12 + (Bd.noise(x / 3, y / 3) - 0.5) * 0.1;
        if (x < 3 || y < 3) v += 0.18;
        if (x > TW - 4) v -= 0.14;
        put(x, y, edge ? pal[c === 'b' ? 0 : 1] : Bd.ramp(pal, v, x, y));
      }
      for (let y = 6; y < TH + D + 2; y++) for (let x = 3; x < TW + 3; x++) if (x >= TW || y >= TH + D) put(x, y, '#000000', 60);
    });
  }
  function tile(ctx, t, x, y, faceUp, opt) {
    opt = opt || {};
    const dark = t.c === 'b', TW = opt.small ? TW2 : TW1, TH = opt.small ? TH2 : TH1;
    Bd.blit(ctx, tileSprite(t.c, TW, TH), x, y);
    if (faceUp) Bd.label(ctx, String(t.n), x + TW / 2, y + TH / 2, opt.small ? 16 : 20, dark ? '#F4F1E8' : '#262A3A', 700);
    else { ctx.fillStyle = dark ? '#3A4058' : '#D9D3C2'; for (let k = 0; k < 3; k++) ctx.fillRect(x + TW / 2 - 10 + k * 7, y + TH / 2 - 2, 4, 4); }
    if (t.open && opt.mineOpen) { ctx.fillStyle = '#FF5A5F'; ctx.fillRect(x, y - 6, TW, 3); }
    if (opt.hl) { ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 3; ctx.strokeRect(x - 3, y - 3, TW + 6, TH + 6); }
    if (opt.sel) { ctx.strokeStyle = '#3DDC84'; ctx.lineWidth = 4; ctx.strokeRect(x - 4, y - 4, TW + 8, TH + 8); }
  }
  window.GoGames.code = {
    id: 'code', size: [W, H], newGame, draw, guess, stop, penalty, resign, possibilities, aiPick, aiContinue, insert, key, alive, rankOf,
    thumb(ctx, w, h) {
      Bd.blit(ctx, Bd.feltTex(w, h), 0, 0);
      const top = [{ n: 1, c: 'b' }, { n: 4, c: 'w' }, { n: 7, c: 'b', open: true }, { n: 9, c: 'w' }];
      const bot = [{ n: 0, c: 'w' }, { n: 3, c: 'b' }, { n: 6, c: 'w' }, { n: 10, c: 'b' }];
      top.forEach((t, i) => tile(ctx, t, 50 + i * 38, 12, !!t.open));
      bot.forEach((t, i) => tile(ctx, t, 50 + i * 38, 90, true));
      Bd.label(ctx, '?', 210, 75, 30, '#FFD23F', 700);
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      let g = newGame(2), mode = 'ai', level = 'normal', busy = false, over = false, timer = 0, sel = null, cover = false, msg = '', hits = [], lastView = 0;
      // 온라인: roster = 사람 자리(들어온 순서), me = 내 자리, isHost = 컴퓨터 자리를 돌리는 기기
      let roster = [], me = 0, isHost = false, reported = false;
      const isHuman = s => mode === 'local' || (mode === 'online' ? s < roster.length : s === 0);
      const view = () => (mode === 'local' ? (isHuman(g.turn) && !g.out.includes(g.turn) ? g.turn : lastView) : me);
      const name = s => (mode === 'ai' ? (s === 0 ? '나' : g.n === 2 ? '컴퓨터' : '컴퓨터 ' + s) : mode === 'online' ? (s === me ? '나' : s < roster.length ? roster[s].nick : '컴퓨터 ' + s) : '플레이어 ' + (s + 1));
      const human = () => !over && !busy && !cover && isHuman(g.turn) && (mode !== 'online' || g.turn === me);
      // 한 수 = { a:'draw'|'guess'|'stop'|'pen'|'resign', ... } → 적용하고 온라인이면 다른 사람에게도 보냄
      function apply(a) {
        if (a.a === 'draw') { draw(g, a.c); msg = ''; }
        else if (a.a === 'guess') {
          const before = g.turn, who = name(g.turn), ok = guess(g, a.seat, a.idx, a.n);
          msg = who + ' → ' + name(a.seat) + ' ' + (a.idx + 1) + '번째 = ' + a.n + '? ' + (ok ? '정답!' : '틀림');
          flash(a.seat, a.idx, ok);
          if (!ok && g.phase !== 'penalty' && g.turn !== before) newTurnCover();
        } else if (a.a === 'stop') { const who = name(g.turn); stop(g); msg = who + ': 그만하기'; newTurnCover(); }
        else if (a.a === 'pen') { penalty(g, a.idx); newTurnCover(); }
        else if (a.a === 'resign') { const who = name(a.seat); resign(g, a.seat); msg = who + ' 기권'; }
      }
      function act(a) { apply(a); if (mode === 'online' && hooks.onMove) hooks.onMove(a); }
      const multi = () => g.n > 2;
      // 한 줄 배치: 타일이 많으면 간격을 좁혀 화면 안에 맞춤
      function rowPos(len, small) {
        const tw = small ? TW2 : TW1, full = len * tw + (len - 1) * GAP, step = full > W - 24 ? (W - 24 - tw) / Math.max(1, len - 1) : tw + GAP;
        const width = (len - 1) * step + tw;
        return { x0: (W - width) / 2, step, tw, th: small ? TH2 : TH1 };
      }
      function layout() {
        const me = view(), out = { opps: [], bot: [], piles: [], nums: [], stop: null, me };
        const others = []; for (let k = 1; k < g.n; k++) others.push((me + k) % g.n);
        others.forEach((seat, k) => {
          const small = multi(), ly = multi() ? 12 + k * 62 : 20, ty = multi() ? 22 + k * 62 : 40, rp = rowPos(g.rows[seat].length, small);
          const tiles = g.rows[seat].map((t, i) => ({ i, x: rp.x0 + i * rp.step, y: ty, t, w: rp.tw, h: rp.th }));
          out.opps.push({ seat, ly, tiles, small });
        });
        const rb = rowPos(g.rows[me].length, false);
        g.rows[me].forEach((t, i) => out.bot.push({ i, x: rb.x0 + i * rb.step, y: 388, t, w: rb.tw, h: rb.th }));
        const py = multi() ? 206 : 140;
        out.piles = [{ c: 'b', x: 150, y: py, w: 70, h: 60 }, { c: 'w', x: 260, y: py, w: 70, h: 60 }];
        out.drawnAt = { x: 374, y: py };
        if (sel) for (let n = 0; n < 12; n++) out.nums.push({ n, x: 48 + (n % 6) * 66, y: 238 + Math.floor(n / 6) * 52, w: 56, h: 42 });
        if (g.phase === 'more' && human()) out.stop = { x: 170, y: 336, w: 140, h: 36 };
        return out;
      }
      const canGuess = () => human() && (g.phase === 'guess' || g.phase === 'more');
      function render() {
        const Ly = layout(), me = Ly.me;
        Bd.blit(ctx, Bd.feltTex(W, H), 0, 0);
        ctx.fillStyle = 'rgba(255,230,160,.18)'; ctx.fillRect(10, 10, W - 20, 2); ctx.fillRect(10, H - 12, W - 20, 2); ctx.fillRect(10, 10, 2, H - 20); ctx.fillRect(W - 12, 10, 2, H - 20);
        if (cover) {
          ctx.fillStyle = '#14161F'; ctx.fillRect(0, 0, W, H);
          Bd.label(ctx, name(g.turn) + ' 차례', W / 2, H / 2 - 30, 30, '#FFD23F', 700);
          Bd.label(ctx, '다른 사람이 보지 않게 화면을 넘겨 주세요', W / 2, H / 2 + 10, 15, '#CFE8DC', 400);
          ctx.fillStyle = '#FFD23F'; ctx.fillRect(W / 2 - 70, H / 2 + 40, 140, 40); Bd.label(ctx, '시작 ▶', W / 2, H / 2 + 60, 17, '#1D2340', 700);
          return;
        }
        Ly.opps.forEach(o => {
          const out = g.out.includes(o.seat), turn = g.turn === o.seat && !over;
          const txt = (turn ? '▶ ' : '') + name(o.seat) + (out ? ' · 탈락' : ' (숨은 ' + hidden(g.rows[o.seat]).length + '장)');
          Bd.label(ctx, txt, W / 2, o.ly, multi() ? 12 : 14, out ? '#7F9C90' : turn ? '#FFD23F' : '#CFE8DC', 700);
          o.tiles.forEach(tt => tile(ctx, tt.t, tt.x, tt.y, tt.t.open || over, { small: o.small, hl: canGuess() && !out && !tt.t.open, sel: sel && sel.seat === o.seat && sel.i === tt.i }));
        });
        Ly.bot.forEach(o => tile(ctx, o.t, o.x, o.y, true, { mineOpen: true, hl: human() && g.phase === 'penalty' && !o.t.open }));
        const meOut = g.out.includes(me), meTurn = g.turn === me && !over;
        Bd.label(ctx, (meTurn ? '▶ ' : '') + name(me) + (meOut ? ' · 탈락' : ' 타일 (숨은 ' + hidden(g.rows[me]).length + '장)'), W / 2, 456, 14, meTurn ? '#FFD23F' : '#CFE8DC', 700);
        hits.forEach(hh => {
          if (hh.until <= Date.now()) return;
          let o = null;
          if (hh.seat === me) o = Ly.bot[hh.i]; else { const r = Ly.opps.find(x => x.seat === hh.seat); o = r && r.tiles[hh.i]; }
          if (o) { ctx.strokeStyle = hh.ok ? '#3DDC84' : '#FF5A5F'; ctx.lineWidth = 4; ctx.strokeRect(o.x - 5, o.y - 5, (o.w || TW1) + 10, (o.h || TH1) + 10); }
        });
        // 더미
        Ly.piles.forEach(p => {
          const n = g.piles[p.c].length, active = human() && g.phase === 'draw' && n > 0;
          for (let k = Math.min(3, n) - 1; k >= 0; k--) tile(ctx, { c: p.c }, p.x + 19 - k * 3, p.y + 6 - k * 3, false);
          if (active) { ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 3; ctx.strokeRect(p.x + 10, p.y - 6, TW1 + 18, TH1 + 18); }
          Bd.label(ctx, (p.c === 'b' ? '검정 ' : '흰색 ') + n, p.x + 35, p.y + 70, 12, '#CFE8DC', 700);
        });
        // 뽑은 타일 (차례인 사람이 사람일 때만 보임)
        if (g.drawn) {
          const mine = isHuman(g.turn) && g.turn === me;
          Bd.label(ctx, mine ? '뽑은 타일' : name(g.turn) + ' 뽑음', Ly.drawnAt.x + 16, Ly.drawnAt.y - 12, 12, '#CFE8DC', 700);
          tile(ctx, g.drawn, Ly.drawnAt.x, Ly.drawnAt.y, mine);
        }
        if (Ly.nums.length) {
          ctx.fillStyle = 'rgba(15,20,48,.9)'; ctx.fillRect(30, 226, W - 60, 118);
          const t = g.rows[sel.seat][sel.i], known = new Set();
          g.rows[me].forEach(k => known.add(k.c + k.n)); g.rows.forEach(r => r.filter(k => k.open).forEach(k => known.add(k.c + k.n))); if (g.drawn) known.add(g.drawn.c + g.drawn.n);
          Ly.nums.forEach(b => {
            const dis = known.has(t.c + b.n);
            ctx.fillStyle = dis ? '#2A3366' : t.c === 'b' ? '#262A3A' : '#F4F1E8'; ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = dis ? 0 : 2; if (!dis) ctx.strokeRect(b.x, b.y, b.w, b.h);
            Bd.label(ctx, String(b.n), b.x + b.w / 2, b.y + b.h / 2, 18, dis ? '#566086' : t.c === 'b' ? '#F4F1E8' : '#262A3A', 700);
          });
        } else if (msg) Bd.label(ctx, msg, W / 2, multi() ? 306 : 285, 15, '#FFFFFF', 700);
        if (Ly.stop) { ctx.fillStyle = '#FFD23F'; ctx.fillRect(Ly.stop.x, Ly.stop.y, Ly.stop.w, Ly.stop.h); Bd.label(ctx, '그만하기 (턴 넘김)', Ly.stop.x + Ly.stop.w / 2, Ly.stop.y + Ly.stop.h / 2, 14, '#1D2340', 700); }
      }
      function status() {
        if (over) return;
        const who = mode === 'ai' ? (g.turn === 0 ? '내 차례' : name(g.turn) + ' 차례') : name(g.turn) + ' 차례';
        const step = { draw: deckSize(g) ? '더미에서 1장 뽑기' : '더미가 비었어요', guess: '상대 타일을 골라 숫자 맞히기', more: '맞혔어요! 더 맞히거나 그만하기', penalty: '틀렸어요 · 내 타일 하나를 골라 공개' }[g.phase] || '';
        hooks.onTurn({ text: who + ' · ' + step + ' · 남은 더미 ' + deckSize(g), side: g.turn === 0 ? 0 : 1 });
      }
      function flash(seat, i, ok) { hits.push({ seat, i, ok, until: Date.now() + 900 }); setTimeout(render, 950); }
      function after() {
        const meOut = mode !== 'local' && g.out.includes(me);
        if (g.phase === 'over' || meOut) {
          render(); finish();
          // 온라인 방장은 내가 탈락해도 컴퓨터 자리를 계속 돌림
          if (!(mode === 'online' && isHost && g.phase !== 'over')) return;
        }
        if (g.phase === 'draw' && !deckSize(g)) g.phase = 'guess';
        render(); if (!reported) status();
        if (!isHuman(g.turn) && (mode !== 'online' || isHost) && !busy) aiTurn();
      }
      // 한 기기로 여럿이: 차례가 바뀌면 화면 가리기
      function newTurnCover() { if (mode === 'local' && !over && g.phase !== 'over') { lastView = g.turn; cover = true; render(); } }
      function aiTurn() {
        busy = true; render();
        const stepAi = () => {
          if (g.phase === 'over') { busy = false; return after(); }
          if (!isHuman(g.turn) && g.phase === 'draw') { act({ a: 'draw', c: aiPile(g) }); render(); timer = Bd.think(stepAi, 600); return; }
          if (!isHuman(g.turn) && (g.phase === 'guess' || g.phase === 'more')) {
            const p = g.phase === 'guess' ? aiPick(g, level) : aiContinue(g, level);
            if (!p) { act({ a: 'stop' }); render(); timer = Bd.think(stepAi, 600); return; }
            sel = { seat: p.seat, i: p.idx }; render(); sel = null;
            timer = Bd.think(() => {
              act({ a: 'guess', seat: p.seat, idx: p.idx, n: p.n });
              if (g.phase === 'penalty') act({ a: 'pen', idx: aiPenalty(g) });
              render(); timer = Bd.think(stepAi, 900);
            }, 700);
            return;
          }
          busy = false; after();
        };
        timer = Bd.think(stepAi, 500);
      }
      function finish(resigned) {
        if (over || reported) return;
        reported = true; over = true; clock.stop(); if (!(mode === 'online' && isHost)) busy = false; render();
        const rank = rankOf(g, me) || (g.winner === me ? 1 : g.n);
        let m;
        if (mode === 'ai') {
          if (g.n === 2) m = resigned ? '기권 · 컴퓨터 승' : g.winner === 0 ? '승리! 컴퓨터의 코드를 모두 맞혔어요' : '… 컴퓨터가 내 코드를 모두 맞혔어요';
          else m = (resigned ? '기권 · ' : '') + g.n + '명 중 ' + rank + '등' + (rank === 1 ? '! 마지막까지 살아남았어요' : '');
        } else if (mode === 'online') {
          m = (resigned ? '기권 · ' : '') + (g.n === 2 ? (rank === 1 ? '승리! 상대 코드를 모두 맞혔어요' : '… 상대가 내 코드를 모두 맞혔어요') : g.n + '명 중 ' + rank + '등');
        } else {
          const order = [g.winner].concat(g.out.slice().reverse()).filter(s => s != null);
          m = order.map((s, k) => (k + 1) + '등 ' + name(s)).join(' · ');
        }
        hooks.onTurn({ text: m, side: -1 });
        hooks.onOver({ win: mode === 'online' ? rank === 1 : undefined, winner: mode === 'online' ? (rank === 1 ? 0 : 1) : g.n === 2 ? g.winner : (g.winner === 0 ? 0 : 1), rank, players: g.n, message: m, moves: g.log.length, duration_sec: clock.sec(), extra: { guesses: g.log.filter(l => l.by === me).length, players: g.n, rank } });
      }
      const inR = (o, x, y) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
      const off = Bd.pointer(canvas, W, H, (t, x, y) => {
        if (t !== 'up' || over) return;
        if (cover) { if (x > W / 2 - 70 && x < W / 2 + 70 && y > H / 2 + 40 && y < H / 2 + 80) { cover = false; lastView = g.turn; after(); } return; }
        if (!human()) return;
        const Ly = layout();
        if (g.phase === 'draw') { const p = Ly.piles.find(pp => inR(pp, x, y)); if (p && g.piles[p.c].length) { act({ a: 'draw', c: p.c }); after(); } return; }
        if (sel) {
          const b = Ly.nums.find(bb => inR(bb, x, y));
          if (b) {
            const target = sel; sel = null;
            act({ a: 'guess', seat: target.seat, idx: target.i, n: b.n });
            return after();
          }
        }
        if (g.phase === 'guess' || g.phase === 'more') {
          for (const r of Ly.opps) {
            if (g.out.includes(r.seat)) continue;
            const o = r.tiles.find(oo => inR(oo, x, y));
            if (o && !o.t.open) { sel = { seat: r.seat, i: o.i }; render(); return; }
          }
          if (Ly.stop && inR(Ly.stop, x, y)) { act({ a: 'stop' }); return after(); }
          sel = null; render(); return;
        }
        if (g.phase === 'penalty') {
          const o = Ly.bot.find(oo => inR(oo, x, y));
          if (o && !o.t.open) { act({ a: 'pen', idx: o.i }); after(); }
        }
      });
      render();
      return {
        get state() { return over ? 'over' : 'playing'; },
        start(o) {
          clearTimeout(timer); o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal';
          roster = mode === 'online' ? (o.roster || []) : []; me = mode === 'online' ? (o.me || 0) : 0; isHost = !!o.host; reported = false;
          g = newGame(o.players || 2, mode === 'online' ? seeded(o.seed || 1) : null); over = false; busy = false; sel = null; msg = ''; hits = []; lastView = 0; cover = mode === 'local';
          clock.reset(); clock.start(); hooks.onState('playing'); hooks.onButtons([]); after();
        },
        press(id) {
          if (id !== 'resign' || over) return;
          if (mode === 'online') { act({ a: 'resign', seat: me }); return after(); }
          clearTimeout(timer); busy = false; cover = false; sel = null;
          if (mode === 'ai') { if (g.n === 2) g.winner = 1; g.out = g.out.filter(s => s !== 0); g.out.unshift(0); g.phase = 'over'; finish(true); return; }
          const who = name(g.turn); resign(g, g.turn); msg = who + ' 기권';
          if (g.phase === 'over') return after();
          newTurnCover(); after();
        },
        // 온라인: 다른 사람의 수 / 나간 사람
        remote(m) {
          if (!m || g.phase === 'over') return;
          if (m.left) {
            const seat = roster.findIndex(r => r.id === m.left);
            if (seat >= 0 && !g.out.includes(seat)) { apply({ a: 'resign', seat }); msg = name(seat) + ' 님이 나갔어요'; }
            // 방장이 나가면 컴퓨터 자리도 멈추므로 함께 탈락
            if (m.wasHost) for (let s2 = roster.length; s2 < g.n; s2++) if (!g.out.includes(s2) && g.phase !== 'over') resign(g, s2);
            return after();
          }
          apply(m); after();
        },
        togglePause() {}, action() {},
        destroy() { clearTimeout(timer); off(); }
      };
    }
  };
})();
