/*
 * gogo?gogo! — 숫자 코드 추리 (다빈치 코드 방식, 2인)
 *  - 0~11 숫자 타일이 검정·흰색 한 벌씩 (24장). 처음에 4장씩 받습니다.
 *  - 타일은 작은 수부터 왼쪽에 놓이고, 같은 숫자면 검정이 왼쪽입니다. 타일 색은 상대에게도 보입니다.
 *  - 내 차례: 검정 또는 흰 더미에서 1장 뽑기 → 상대의 숨은 타일 하나를 골라 숫자 맞히기
 *      맞히면 그 타일이 공개되고, 더 맞히거나 '그만하기'(뽑은 타일은 숨긴 채 내 줄에 놓음)
 *      틀리면 뽑은 타일을 공개해서 내 줄에 놓고 차례 끝 (더미가 비었으면 내 숨은 타일 하나를 공개)
 *  - 상대 타일을 모두 공개하면 승리. (조커는 넣지 않았습니다)
 */
(function () {
  'use strict';
  const Bd = window.GoBoard;
  const W = 480, H = 480, TW = 32, TH = 46, GAP = 5;
  const key = t => t.n * 2 + (t.c === 'w' ? 1 : 0);

  /* ---------- 규칙 ---------- */
  function newGame() {
    const piles = { b: [], w: [] };
    for (let n = 0; n < 12; n++) { piles.b.push({ n, c: 'b' }); piles.w.push({ n, c: 'w' }); }
    Bd.shuffle(piles.b); Bd.shuffle(piles.w);
    const g = { piles, rows: [[], []], turn: 0, drawn: null, phase: 'draw', streak: 0, winner: null, log: [] };
    const take = c => { const p = g.piles[c].length ? g.piles[c] : g.piles[c === 'b' ? 'w' : 'b']; return p.pop(); };
    for (let k = 0; k < 4; k++) for (const s of [0, 1]) { const t = take(Math.random() < 0.5 ? 'b' : 'w'); t.open = false; insert(g.rows[s], t); }
    g.take = take;
    return g;
  }
  function insert(row, t) { let i = 0; while (i < row.length && key(row[i]) < key(t)) i++; row.splice(i, 0, t); return i; }
  const hidden = row => row.filter(t => !t.open);
  const deckSize = g => g.piles.b.length + g.piles.w.length;
  function draw(g, c) {
    if (!deckSize(g)) { g.drawn = null; g.phase = 'guess'; return null; }
    const pile = g.piles[c] && g.piles[c].length ? c : c === 'b' ? 'w' : 'b';
    const t = g.piles[pile].pop(); t.open = false; t.fresh = true; g.drawn = t; g.phase = 'guess'; return t;
  }
  // 추리: 맞으면 true
  function guess(g, idx, n) {
    const opp = g.rows[1 - g.turn], t = opp[idx];
    if (!t || t.open) return null;
    if (t.n === n) {
      t.open = true; g.streak++; g.log.push({ by: g.turn, idx, n, ok: true, tile: t });
      if (!hidden(opp).length) { g.winner = g.turn; g.phase = 'over'; }
      else g.phase = 'more';
      return true;
    }
    g.log.push({ by: g.turn, idx, n, ok: false, tile: t });
    if (g.drawn) { g.drawn.open = true; insert(g.rows[g.turn], g.drawn); g.drawn = null; endTurn(g); }
    else g.phase = 'penalty';          // 더미가 비었으면 내 타일 하나 공개
    return false;
  }
  function stop(g) { if (g.drawn) { insert(g.rows[g.turn], g.drawn); g.drawn = null; } endTurn(g); }
  function penalty(g, idx) {
    const t = g.rows[g.turn][idx]; if (!t || t.open) return false;
    t.open = true; endTurn(g); return true;
  }
  function endTurn(g) {
    g.rows.forEach(r => r.forEach(t => { t.fresh = false; }));
    // 내 타일이 모두 공개되면 패배
    if (!hidden(g.rows[g.turn]).length) { g.winner = 1 - g.turn; g.phase = 'over'; return; }
    g.turn = 1 - g.turn; g.streak = 0; g.phase = 'draw';
  }

  /* ---------- 컴퓨터: 가능한 숫자 좁히기 ---------- */
  function possibilities(g, me, smart) {
    const opp = g.rows[1 - me], known = new Set();
    const mark = t => known.add(t.c + t.n);
    g.rows[me].forEach(mark); if (g.drawn) mark(g.drawn); opp.filter(t => t.open).forEach(mark);
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
        // 이미 틀렸던 추측은 제외
        g.log.forEach(l => { if (l.by === me && !l.ok && l.tile === t) { const j = c.indexOf(l.n); if (j >= 0) c.splice(j, 1); } });
        cand[i] = c;
        if (smart && c.length) { lo[i] = Math.max(lo[i], c[0] * 2 + (t.c === 'w' ? 1 : 0)); hi[i] = Math.min(hi[i], c[c.length - 1] * 2 + (t.c === 'w' ? 1 : 0)); }
      });
    }
    return cand;
  }
  const LV = { easy: { smart: false, keepGoing: 1 }, normal: { smart: true, keepGoing: 1 }, hard: { smart: true, keepGoing: 2 } };
  function aiPick(g, level) {
    const L = LV[level] || LV.normal, cand = possibilities(g, g.turn, L.smart);
    let best = null;
    cand.forEach((c, i) => { if (c && c.length && (!best || c.length < best.c.length || (c.length === best.c.length && Math.random() < 0.5))) best = { i, c }; });
    if (!best) {   // 안전장치: 규칙상 있을 수 없지만, 후보가 비면 아무 숨은 타일
      const opp = g.rows[1 - g.turn], i = opp.findIndex(t => !t.open); if (i < 0) return null;
      return { idx: i, n: Bd.rand(12), size: 12 };
    }
    if (level === 'easy' && Math.random() < 0.5) { const opts = cand.map((c, i) => ({ c, i })).filter(o => o.c && o.c.length); best = opts[Bd.rand(opts.length)]; }
    return { idx: best.i, n: best.c[Bd.rand(best.c.length)], size: best.c.length };
  }
  // 맞힌 뒤 계속할지: 확실(또는 어려움은 2지선다 이하)하면 계속
  function aiContinue(g, level) {
    const L = LV[level] || LV.normal, p = aiPick(g, level);
    return p && p.size <= L.keepGoing ? p : null;
  }
  function aiPenalty(g) { const r = g.rows[g.turn]; const hs = r.map((t, i) => (t.open ? -1 : i)).filter(i => i >= 0); return hs[Bd.rand(hs.length)]; }
  function aiPile(g) { return g.piles.b.length > g.piles.w.length ? 'b' : g.piles.w.length > g.piles.b.length ? 'w' : Math.random() < 0.5 ? 'b' : 'w'; }

  /* ---------- 화면 ---------- */
  function tile(ctx, t, x, y, faceUp, opt) {
    opt = opt || {};
    const dark = t.c === 'b';
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x + 3, y + 4, TW, TH);
    ctx.fillStyle = dark ? '#262A3A' : '#F4F1E8'; ctx.fillRect(x, y, TW, TH);
    ctx.fillStyle = dark ? '#3A4058' : '#FFFFFF'; ctx.fillRect(x, y, TW, 3); ctx.fillRect(x, y, 3, TH);
    ctx.fillStyle = dark ? '#14161F' : '#B9B2A0'; ctx.fillRect(x, y + TH - 3, TW, 3); ctx.fillRect(x + TW - 3, y, 3, TH);
    if (faceUp) Bd.label(ctx, String(t.n), x + TW / 2, y + TH / 2, 20, dark ? '#F4F1E8' : '#262A3A', 700);
    else { ctx.fillStyle = dark ? '#3A4058' : '#D9D3C2'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 8 + k * 6, y + TH / 2 - 2, 4, 4); }
    if (t.open && opt.mineOpen) { ctx.fillStyle = '#FF5A5F'; ctx.fillRect(x, y - 6, TW, 3); }
    if (opt.hl) { ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 3; ctx.strokeRect(x - 3, y - 3, TW + 6, TH + 6); }
    if (opt.sel) { ctx.strokeStyle = '#3DDC84'; ctx.lineWidth = 4; ctx.strokeRect(x - 4, y - 4, TW + 8, TH + 8); }
  }
  function rowX(len) { return (W - (len * TW + (len - 1) * GAP)) / 2; }

  window.GoGames.code = {
    id: 'code', size: [W, H], newGame, draw, guess, stop, penalty, possibilities, aiPick, aiContinue, insert, key,
    thumb(ctx, w, h) {
      ctx.fillStyle = '#1E5A46'; ctx.fillRect(0, 0, w, h);
      const top = [{ n: 1, c: 'b' }, { n: 4, c: 'w' }, { n: 7, c: 'b', open: true }, { n: 9, c: 'w' }];
      const bot = [{ n: 0, c: 'w' }, { n: 3, c: 'b' }, { n: 6, c: 'w' }, { n: 10, c: 'b' }];
      top.forEach((t, i) => tile(ctx, t, 50 + i * 38, 12, !!t.open));
      bot.forEach((t, i) => tile(ctx, t, 50 + i * 38, 90, true));
      Bd.label(ctx, '?', 210, 75, 30, '#FFD23F', 700);
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      let g = newGame(), mode = 'ai', level = 'normal', busy = false, over = false, timer = 0, sel = -1, cover = false, msg = '', hits = [];
      const view = () => (mode === 'local' ? g.turn : 0);            // 화면 아래에 보이는 사람
      const name = s => (mode === 'ai' ? (s === 0 ? '나' : '컴퓨터') : '플레이어 ' + (s + 1));
      const human = () => !over && !busy && !cover && (mode === 'local' || g.turn === 0);

      function layout() {
        const me = view(), op = 1 - me, out = { top: [], bot: [], piles: [], nums: [], stop: null, cover: null };
        const tr = g.rows[op], br = g.rows[me];
        let x = rowX(tr.length); tr.forEach((t, i) => { out.top.push({ i, x, y: 40, t }); x += TW + GAP; });
        x = rowX(br.length); br.forEach((t, i) => { out.bot.push({ i, x, y: 388, t }); x += TW + GAP; });
        out.piles = [{ c: 'b', x: 150, y: 140, w: 70, h: 60 }, { c: 'w', x: 260, y: 140, w: 70, h: 60 }];
        if (sel >= 0) for (let n = 0; n < 12; n++) out.nums.push({ n, x: 48 + (n % 6) * 66, y: 238 + Math.floor(n / 6) * 52, w: 56, h: 42 });
        if (g.phase === 'more' && human()) out.stop = { x: 170, y: 336, w: 140, h: 36 };
        return out;
      }
      function render() {
        const me = view(), op = 1 - me, Ly = layout();
        ctx.fillStyle = '#1E5A46'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#18493A'; for (let y = 0; y < H; y += 8) ctx.fillRect(0, y, W, 2);
        Bd.label(ctx, name(op) + ' 타일 (숨은 ' + hidden(g.rows[op]).length + '장)', W / 2, 20, 14, '#CFE8DC', 700);
        Bd.label(ctx, name(me) + ' 타일 (숨은 ' + hidden(g.rows[me]).length + '장)', W / 2, 456, 14, '#CFE8DC', 700);
        if (cover) {
          ctx.fillStyle = '#14161F'; ctx.fillRect(0, 0, W, H);
          Bd.label(ctx, name(g.turn) + ' 차례', W / 2, H / 2 - 30, 30, '#FFD23F', 700);
          Bd.label(ctx, '상대가 보지 않게 화면을 넘겨 주세요', W / 2, H / 2 + 10, 15, '#CFE8DC', 400);
          ctx.fillStyle = '#FFD23F'; ctx.fillRect(W / 2 - 70, H / 2 + 40, 140, 40); Bd.label(ctx, '시작 ▶', W / 2, H / 2 + 60, 17, '#1D2340', 700);
          return;
        }
        Ly.top.forEach(o => tile(ctx, o.t, o.x, o.y, o.t.open || over, { hl: human() && !o.t.open && (g.phase === 'guess' || g.phase === 'more'), sel: o.i === sel }));
        Ly.bot.forEach(o => tile(ctx, o.t, o.x, o.y, true, { mineOpen: true, hl: human() && g.phase === 'penalty' && !o.t.open }));
        hits.forEach(hh => { if (hh.until > Date.now()) { const o = (hh.row === 'top' ? Ly.top : Ly.bot)[hh.i]; if (o) { ctx.strokeStyle = hh.ok ? '#3DDC84' : '#FF5A5F'; ctx.lineWidth = 4; ctx.strokeRect(o.x - 5, o.y - 5, TW + 10, TH + 10); } } });
        // 더미
        Ly.piles.forEach(p => {
          const n = g.piles[p.c].length, active = human() && g.phase === 'draw' && n > 0;
          for (let k = Math.min(3, n) - 1; k >= 0; k--) tile(ctx, { c: p.c }, p.x + 19 - k * 3, p.y + 6 - k * 3, false);
          if (active) { ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 3; ctx.strokeRect(p.x + 10, p.y - 6, TW + 18, TH + 18); }
          Bd.label(ctx, (p.c === 'b' ? '검정 ' : '흰색 ') + n, p.x + 35, p.y + 70, 12, '#CFE8DC', 700);
        });
        // 뽑은 타일 (내 것만 보임)
        if (g.drawn) {
          const mine = mode === 'local' || g.turn === 0;
          Bd.label(ctx, mine ? '뽑은 타일' : '컴퓨터가 뽑음', 390, 128, 12, '#CFE8DC', 700);
          tile(ctx, g.drawn, 374, 140, mine);
        }
        if (Ly.nums.length) {
          ctx.fillStyle = 'rgba(15,20,48,.85)'; ctx.fillRect(30, 226, W - 60, 118);
          const t = g.rows[op][sel], known = new Set();
          g.rows[me].forEach(k => known.add(k.c + k.n)); g.rows[op].filter(k => k.open).forEach(k => known.add(k.c + k.n)); if (g.drawn) known.add(g.drawn.c + g.drawn.n);
          Ly.nums.forEach(b => {
            const dis = known.has(t.c + b.n);
            ctx.fillStyle = dis ? '#2A3366' : t.c === 'b' ? '#262A3A' : '#F4F1E8'; ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = dis ? 0 : 2; if (!dis) ctx.strokeRect(b.x, b.y, b.w, b.h);
            Bd.label(ctx, String(b.n), b.x + b.w / 2, b.y + b.h / 2, 18, dis ? '#566086' : t.c === 'b' ? '#F4F1E8' : '#262A3A', 700);
          });
        } else if (msg) Bd.label(ctx, msg, W / 2, 285, 16, '#FFFFFF', 700);
        if (Ly.stop) { ctx.fillStyle = '#FFD23F'; ctx.fillRect(Ly.stop.x, Ly.stop.y, Ly.stop.w, Ly.stop.h); Bd.label(ctx, '그만하기 (턴 넘김)', Ly.stop.x + Ly.stop.w / 2, Ly.stop.y + Ly.stop.h / 2, 14, '#1D2340', 700); }
      }
      function status() {
        if (over) return;
        const who = mode === 'ai' ? (g.turn === 0 ? '내 차례' : '컴퓨터 차례') : name(g.turn) + ' 차례';
        const step = { draw: deckSize(g) ? '더미에서 1장 뽑기' : '더미가 비었어요', guess: '상대 타일을 골라 숫자 맞히기', more: '맞혔어요! 더 맞히거나 그만하기', penalty: '틀렸어요 · 내 타일 하나를 골라 공개' }[g.phase] || '';
        hooks.onTurn({ text: who + ' · ' + step + ' · 남은 더미 ' + deckSize(g), side: g.turn });
      }
      function flash(row, i, ok) { hits.push({ row, i, ok, until: Date.now() + 900 }); setTimeout(render, 950); }
      function after() {
        render(); status();
        if (g.phase === 'over') return finish();
        if (g.phase === 'draw' && !deckSize(g)) { g.phase = 'guess'; status(); }
        if (mode === 'ai' && g.turn === 1) aiTurn();
      }
      function newTurnCover() { if (mode === 'local' && !over) { cover = true; render(); } }
      function aiTurn() {
        busy = true; render();
        const stepAi = () => {
          if (g.phase === 'over') { busy = false; return after(); }
          if (g.phase === 'draw') { draw(g, aiPile(g)); render(); timer = Bd.think(stepAi, 600); return; }
          if (g.phase === 'guess' || g.phase === 'more') {
            const p = g.phase === 'guess' ? aiPick(g, level) : aiContinue(g, level);
            if (!p) { stop(g); msg = '컴퓨터가 그만했어요'; busy = false; return after(); }
            sel = p.idx; render();
            timer = Bd.think(() => {
              const ok = guess(g, p.idx, p.n); sel = -1;
              msg = '컴퓨터: ' + (p.idx + 1) + '번째 타일은 ' + p.n + '? → ' + (ok ? '정답!' : '틀림');
              flash('bot', p.idx, ok);
              if (g.phase === 'penalty') penalty(g, aiPenalty(g));
              render(); timer = Bd.think(stepAi, 900);
            }, 700);
            return;
          }
          busy = false; after();
        };
        timer = Bd.think(stepAi, 500);
      }
      function finish(resigned) {
        over = true; clock.stop(); render();
        const m = resigned ? name(1 - g.winner) + ' 기권 · ' + name(g.winner) + ' 승' : name(g.winner) + (mode === 'ai' ? (g.winner === 0 ? ' 승리! 컴퓨터의 코드를 모두 맞혔어요' : '… 컴퓨터가 내 코드를 모두 맞혔어요') : ' 승리!');
        hooks.onTurn({ text: m, side: -1 });
        hooks.onOver({ winner: g.winner, message: m, moves: g.log.length, duration_sec: clock.sec(), extra: { guesses: g.log.filter(l => l.by === 0).length } });
      }
      const inR = (o, x, y, w, h) => x >= o.x && x <= o.x + (w || o.w) && y >= o.y && y <= o.y + (h || o.h);
      const off = Bd.pointer(canvas, W, H, (t, x, y) => {
        if (t !== 'up' || over) return;
        if (cover) { if (x > W / 2 - 70 && x < W / 2 + 70 && y > H / 2 + 40 && y < H / 2 + 80) { cover = false; after(); } return; }
        if (!human()) return;
        const Ly = layout();
        if (g.phase === 'draw') { const p = Ly.piles.find(pp => inR(pp, x, y)); if (p && g.piles[p.c].length) { draw(g, p.c); msg = ''; after(); } return; }
        if (sel >= 0) {
          const b = Ly.nums.find(bb => inR(bb, x, y));
          if (b) {
            const idx = sel; sel = -1;
            const ok = guess(g, idx, b.n);
            msg = (idx + 1) + '번째 타일은 ' + b.n + '? → ' + (ok ? '정답!' : '틀렸어요');
            flash('top', idx, ok);
            if (!ok && g.phase !== 'penalty') newTurnCover();
            return after();
          }
        }
        if (g.phase === 'guess' || g.phase === 'more') {
          const o = Ly.top.find(oo => inR(oo, x, y, TW, TH));
          if (o && !o.t.open) { sel = o.i; render(); return; }
          if (Ly.stop && inR(Ly.stop, x, y)) { stop(g); msg = ''; newTurnCover(); return after(); }
          sel = -1; render(); return;
        }
        if (g.phase === 'penalty') {
          const o = Ly.bot.find(oo => inR(oo, x, y, TW, TH));
          if (o && !o.t.open) { penalty(g, o.i); newTurnCover(); after(); }
        }
      });
      render();
      return {
        get state() { return over ? 'over' : 'playing'; },
        start(o) {
          clearTimeout(timer); o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal';
          g = newGame(); over = false; busy = false; sel = -1; msg = ''; hits = []; cover = mode === 'local';
          clock.reset(); clock.start(); hooks.onState('playing'); hooks.onButtons([]); after();
        },
        press(id) {
          if (id === 'resign' && !over) { clearTimeout(timer); busy = false; cover = false; g.winner = mode === 'ai' ? 1 : 1 - g.turn; g.phase = 'over'; finish(true); }
        },
        togglePause() {}, action() {},
        destroy() { clearTimeout(timer); off(); }
      };
    }
  };
})();
