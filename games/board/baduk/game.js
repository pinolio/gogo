/*
 * gogo?gogo! — 바둑 (9줄 · 흑 먼저 · 덤 6.5집)
 *  - 따내기, 자충수 금지, 패(같은 모양 반복) 금지
 *  - 두 사람이 연속으로 '수 넘기기'를 하면 끝나고 계가(중국식: 돌 + 둘러싼 빈 곳)
 *  - 끝내기 전에 죽은 돌은 따내 주세요. (판 위에 남은 돌은 모두 살아 있는 돌로 셉니다)
 */
(function () {
  'use strict';
  const B = window.GoBoard;
  const N = 9, M = 40, C = 50, BW = M * 2 + C * (N - 1), H = BW;    // 판 480 × 480
  // v52: 판 양옆에 돌 통 (흑 왼쪽 · 백 오른쪽). 아바타가 통 아래에서 기다리다 돌을 집어 와서 둠
  const SIDE = 116, W = BW + SIDE * 2;                                  // 화면 712 × 480
  const POT = { 1: [SIDE / 2, 150], 2: [W - SIDE / 2, 150] };
  const KOMI = 6.5;

  /* ---------- 규칙 ---------- */
  const nb = i => { const x = i % N, y = (i / N) | 0, r = []; if (x > 0) r.push(i - 1); if (x < N - 1) r.push(i + 1); if (y > 0) r.push(i - N); if (y < N - 1) r.push(i + N); return r; };
  const NB = Array.from({ length: N * N }, (_, i) => nb(i));
  function group(b, i) {
    const c = b[i], stones = [i], seen = new Set([i]), libs = new Set();
    for (let k = 0; k < stones.length; k++) for (const j of NB[stones[k]]) {
      if (b[j] === 0) libs.add(j);
      else if (b[j] === c && !seen.has(j)) { seen.add(j); stones.push(j); }
    }
    return { stones, libs };
  }
  function Rules() {
    const g = { b: Array(N * N).fill(0), turn: 1, caps: { 1: 0, 2: 0 }, passes: 0, moves: 0, history: new Set(), over: false, last: -1, log: [] };   // v62 log = 기보 (칸 번호 · -1 = 수 넘김)
    const key = b => b.join('');
    g.history.add(key(g.b));
    // 두어 보기 (실제로 바꾸지 않고 결과만): null = 둘 수 없음
    g.tryPlay = function (i, c) {
      c = c || g.turn;
      if (g.b[i] !== 0) return null;
      const b = g.b.slice(); b[i] = c; let captured = 0;
      for (const j of NB[i]) if (b[j] === 3 - c) { const gr = group(b, j); if (!gr.libs.size) { gr.stones.forEach(s => { b[s] = 0; }); captured += gr.stones.length; } }
      if (!group(b, i).libs.size) return null;            // 자충수
      if (g.history.has(key(b))) return null;            // 패
      return { b, captured };
    };
    g.play = function (i) {
      const r = g.tryPlay(i); if (!r) return false;
      g.b = r.b; g.caps[g.turn] += r.captured; g.history.add(key(g.b));
      g.turn = 3 - g.turn; g.passes = 0; g.moves++; g.last = i; g.log.push(i); return true;
    };
    g.pass = function () { g.log.push(-1); g.passes++; g.moves++; g.turn = 3 - g.turn; g.last = -1; if (g.passes >= 2) g.over = true; };
    g.legal = function () { const out = []; for (let i = 0; i < N * N; i++) if (g.b[i] === 0 && g.tryPlay(i)) out.push(i); return out; };
    // 계가: 돌 수 + 한 색으로만 둘러싸인 빈 곳
    g.score = function () {
      const s = { 1: 0, 2: KOMI }, seen = new Set(), terr = Array(N * N).fill(0);
      g.b.forEach(v => { if (v) s[v]++; });
      for (let i = 0; i < N * N; i++) {
        if (g.b[i] !== 0 || seen.has(i)) continue;
        const area = [i], border = new Set(); seen.add(i);
        for (let k = 0; k < area.length; k++) for (const j of NB[area[k]]) {
          if (g.b[j] === 0) { if (!seen.has(j)) { seen.add(j); area.push(j); } } else border.add(g.b[j]);
        }
        if (border.size === 1) { const c = [...border][0]; s[c] += area.length; area.forEach(a => { terr[a] = c; }); }
      }
      return { black: s[1], white: s[2], terr };
    };
    return g;
  }

  /* ---------- 컴퓨터 ---------- */
  // 내 집(눈): 상하좌우가 모두 내 돌이고 대각선도 대부분 내 돌인 빈 곳은 메우지 않음
  function isEye(g, i, c) {
    if (NB[i].some(j => g.b[j] !== c)) return false;
    const x = i % N, y = (i / N) | 0; let bad = 0, edge = 0;
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) { edge = 1; continue; }
      if (g.b[ny * N + nx] === 3 - c) bad++;
    }
    return bad + edge < 2;
  }
  // 빠른 무작위 대국 (몬테카를로): 끝까지 둬 본 뒤 흑-백 집 차이
  // v61 빠르게: 표시 배열을 새로 만들지 않고 번호(stamp)로 다시 씀 → 시뮬레이션 약 3배
  const SEEN = new Int32Array(N * N), LSEEN = new Int32Array(N * N); let STAMP = 0;
  function fastGroupLibs(b, i) {
    const c = b[i], st = [i], s0 = ++STAMP; SEEN[i] = s0; let libs = 0;
    for (let k = 0; k < st.length; k++) for (const j of NB[st[k]]) {
      if (b[j] === 0) { if (LSEEN[j] !== s0) { LSEEN[j] = s0; libs++; } }
      else if (b[j] === c && SEEN[j] !== s0) { SEEN[j] = s0; st.push(j); }
    }
    return { st, libs };
  }
  function fastPlay(b, i, c) {          // 성공하면 true (b 변경), 자충이면 false
    b[i] = c;
    for (const j of NB[i]) if (b[j] === 3 - c) { const gr = fastGroupLibs(b, j); if (!gr.libs) gr.st.forEach(s => { b[s] = 0; }); }
    if (!fastGroupLibs(b, i).libs) { b[i] = 0; return false; }
    return true;
  }
  const simpleEye = (b, i, c) => NB[i].every(j => b[j] === c);
  function playout(b0, turn) {
    const b = Int8Array.from(b0); let t = turn, passes = 0, n = 0;
    const NN = N * N;
    while (passes < 2 && n < 160) {
      // 무작위 시작점에서 한 바퀴 돌며 둘 수 있는 첫 곳 (섞기보다 빠름)
      const start = (Math.random() * NN) | 0, step = [1, 7, 11, 13, 17, 19][(Math.random() * 6) | 0]; let played = false;
      for (let k = 0; k < NN; k++) { const i = (start + k * step) % NN; if (b[i] !== 0 || simpleEye(b, i, t)) continue; if (fastPlay(b, i, t)) { played = true; break; } }
      if (played) passes = 0; else passes++;
      t = 3 - t; n++;
    }
    let black = 0, white = KOMI;
    for (let i = 0; i < N * N; i++) {
      if (b[i] === 1) black++; else if (b[i] === 2) white++;
      else { const c = NB[i].map(j => b[j]); if (c.every(v => v === 1)) black++; else if (c.every(v => v === 2)) white++; }
    }
    return black - white;
  }
  // 수 하나의 간단 점수 (후보 고르기용)
  function heuristic(g, i, me, r) {
    const op = 3 - me; let s = r.captured * 12;
    const mine = group(r.b, i);
    if (NB[i].some(j => g.b[j] === me && group(g.b, j).libs.size === 1) && mine.libs.size >= 2) s += 9 * mine.stones.length;
    if (mine.libs.size === 1 && !r.captured) s -= 10 * mine.stones.length; else s += Math.min(mine.libs.size, 4);
    for (const j of NB[i]) if (r.b[j] === op) { const gl = group(r.b, j).libs.size; if (gl === 1) s += 4; else if (gl === 2) s += 1; }
    const x = i % N, y = (i / N) | 0, line = Math.min(x, y, N - 1 - x, N - 1 - y);
    if (line === 0) s -= 2.5; else if (line >= 2) s += g.moves < 12 ? 2 : 0.6;
    return s + NB[i].filter(j => g.b[j] === 0).length * 0.4;
  }
  /* v61 단계 1~10
   *  1~3단계 = 예전 쉬움·보통·어려움 (후보 cand 개를 sims 번씩 끝까지 둬 봄)
   *  4단계부터 = 좋은 후보에 시뮬레이션을 더 몰아주는 방식(UCB) · total = 전체 시뮬레이션 수 · ms = 생각 시간 한도
   *  (후보를 너무 많이 잡으면 후보마다 시뮬레이션이 모자라 오히려 약해짐 → 후보 수는 조금씩만 늘림) */
  const LV = [null,
    { cand: 0, sims: 0, noise: 5 },
    { cand: 7, sims: 12, noise: 0.5 },
    { cand: 10, sims: 30, noise: 0 },
    { cand: 10, total: 400, ms: 800, noise: 0.3 },
    { cand: 12, total: 700, ms: 1000, noise: 0.15 },
    { cand: 14, total: 1000, ms: 1200, noise: 0 },
    { cand: 16, total: 1400, ms: 1400, noise: 0 },
    { cand: 18, total: 1900, ms: 1700, noise: 0 },
    { cand: 20, total: 2500, ms: 2000, noise: 0 },
    { cand: 22, total: 3200, ms: 2400, noise: 0 },
    { cand: 24, total: 5000, ms: 3800, noise: 0 }   // 11 = AI 대전 (10단계를 이기면 열림 · 나중에 학습한 AI 로 바꿀 자리)
  ];
  function winRate(b, turnAfter, me, sims) {
    let w = 0;
    for (let k = 0; k < sims; k++) { const d = playout(b, turnAfter); if ((d > 0) === (me === 1)) w++; }
    return w / sims;
  }
  function aiMove(g, level) {
    const st = B.step(level), L = LV[st], me = g.turn, op = 3 - me;
    const cands = [];
    for (let i = 0; i < N * N; i++) {
      if (g.b[i] !== 0 || isEye(g, i, me)) continue;
      const r = g.tryPlay(i, me); if (!r) continue;
      cands.push({ i, r, h: heuristic(g, i, me, r) + Math.random() * L.noise });
    }
    if (!cands.length) return -1;
    cands.sort((a, b) => b.h - a.h);
    // 상대가 수를 넘겼고 지금 계가로 이기고 있으면 같이 넘겨서 끝냄
    if (g.passes) { const sc = g.score(); if ((me === 1 ? sc.black - sc.white : sc.white - sc.black) > 0) return -1; }
    if (!L.sims && !L.total) return cands[0].h < 0.5 && g.moves > 30 ? -1 : cands[0].i;
    if (L.total) return ucbMove(g, cands.slice(0, L.cand), me, op, L);
    let best = null;
    for (const c of cands.slice(0, L.cand)) {
      const wr = winRate(c.r.b, op, me, L.sims) + c.h * 0.002;
      if (!best || wr > best.wr) best = { i: c.i, wr };
    }
    // 수를 넘기는 것이 더 낫다면 넘김 (막바지)
    if (g.moves > 30) { const passWr = winRate(g.b, op, me, L.sims); if (passWr >= best.wr + 0.02) return -1; }
    return best.i;
  }
  // UCB: 모든 후보를 조금씩 둬 본 뒤, 이길 확률이 높아 보이는 후보에 시뮬레이션을 더 많이 씀 → 가장 많이 둬 본 수
  function ucbMove(g, list, me, op, L) {
    const stop = B.deadline(L.ms), arms = list.map(c => ({ i: c.i, b: c.r.b, w: 0, n: 0, prior: Math.max(-0.05, Math.min(0.05, c.h * 0.004)) }));
    if (g.moves > 30) arms.push({ i: -1, b: g.b, w: 0, n: 0, prior: -0.02 });    // 수 넘기기도 후보
    const run = a => { const d = playout(a.b, op); if ((d > 0) === (me === 1)) a.w++; a.n++; };
    let total = 0;
    for (let r = 0; r < 3; r++) for (const a of arms) { run(a); total++; }
    while (total < L.total && !(total % 20 === 0 && stop())) {
      let best = null, bv = -1e9; const ln = Math.log(total);
      for (const a of arms) { const v = a.w / a.n + a.prior + 0.9 * Math.sqrt(ln / a.n); if (v > bv) { bv = v; best = a; } }
      run(best); total++;
    }
    arms.sort((a, b) => b.n - a.n || b.w / b.n - a.w / a.n);
    const top = arms[0];
    if (top.i === -1 && (!arms[1] || top.w / top.n >= arms[1].w / arms[1].n)) return -1;
    return top.i === -1 ? arms[1].i : top.i;
  }

  /* ---------- 화면 ---------- */
  const px = k => M + k * C;
  function drawTable(ctx, names) {
    B.table(ctx, W, H);
    [1, 2].forEach(c => { const [x, y] = POT[c]; B.tag(ctx, c === 1 ? '흑' : '백', x, y - 34, 14); B.pot(ctx, x, y, c === 1, 20); if (names && names[c]) B.tag(ctx, names[c], x, H - 8, 12); });
  }
  function drawBoard(ctx, g, hover, showTerr) {
    B.wood(ctx, 0, 0, BW, H);
    for (let k = 0; k < N; k++) { B.line(ctx, px(0), px(k), px(N - 1), px(k), B.INK, 2); B.line(ctx, px(k), px(0), px(k), px(N - 1), B.INK, 2); }
    ctx.strokeStyle = 'rgba(52,28,8,.6)'; ctx.lineWidth = 3; ctx.strokeRect(px(0) - 1, px(0) - 1, px(N - 1) - px(0) + 2, px(N - 1) - px(0) + 2);
    [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]].forEach(([x, y]) => B.star(ctx, px(x), px(y), 4));
    const sc = showTerr ? g.score() : null;
    for (let i = 0; i < N * N; i++) {
      const x = i % N, y = (i / N) | 0;
      if (g.b[i]) B.stone(ctx, px(x), px(y), 22, g.b[i] === 1);
      else if (sc && sc.terr[i]) { ctx.fillStyle = sc.terr[i] === 1 ? '#1F222C' : '#F2EFE6'; ctx.fillRect(px(x) - 6, px(y) - 6, 12, 12); }
    }
    if (g.last >= 0) { ctx.fillStyle = '#FF5A5F'; ctx.fillRect(px(g.last % N) - 4, px((g.last / N) | 0) - 4, 8, 8); }
    if (hover != null && !g.over && g.b[hover] === 0) B.stone(ctx, px(hover % N), px((hover / N) | 0), 22, g.turn === 1, g.tryPlay(hover) ? 0.45 : 0.15);
  }

  window.GoGames.baduk = {
    id: 'baduk', size: [W, H], Rules, aiMove, N,
    thumb(ctx, w, h) {
      B.wood(ctx, 0, 0, w, h);
      for (let k = 0; k < 7; k++) { B.line(ctx, 30 + k * 30, 15, 30 + k * 30, h - 15, B.INK, 2); }
      for (let k = 0; k < 5; k++) B.line(ctx, 30, 15 + k * 30, 210, 15 + k * 30, B.INK, 2);
      [[1, 1], [2, 1], [3, 2], [2, 3], [5, 3]].forEach(([x, y]) => B.stone(ctx, 30 + x * 30, 15 + y * 30, 13, true));
      [[3, 1], [4, 2], [3, 3], [4, 3], [1, 2]].forEach(([x, y]) => B.stone(ctx, 30 + x * 30, 15 + y * 30, 13, false));
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      let g = Rules(), mode = 'ai', level = 'normal', hover = null, busy = false, over = false, timer = 0, side = 0;
      const name = c => (c === 1 ? '흑' : '백');
      // online: 내 쪽(side 0=흑, 1=백) 차례일 때만 둠
      const human = () => mode === 'local' || (mode === 'online' ? g.turn - 1 === side : g.turn === 1);
      const send = m => { if (mode === 'online' && hooks.onMove) hooks.onMove(m); };
      const capsText = () => `따낸 돌 흑 ${g.caps[1]} · 백 ${g.caps[2]}`;
      function turnText(extra) {
        if (over) return;
        const who = mode === 'ai' ? (g.turn === 1 ? '내 차례 (흑)' : '컴퓨터 생각 중… (백)') : mode === 'online' ? (human() ? '내 차례 (' + name(g.turn) + ')' : '상대 차례… (' + name(g.turn) + ')') : name(g.turn) + ' 차례';
        hooks.onTurn({ text: (extra ? extra + ' · ' : '') + who + ' · ' + capsText(), side: g.turn - 1 });
      }
      function buttons() { hooks.onButtons([{ id: 'pass', label: '수 넘기기', disabled: over || busy || !human() }]); }
      const cfg = (window.GoSettings && GoSettings.get('baduk')) || {}, MO = cfg.motion || {};
      let names = {};
      const homes = {};
      const mv = B.porter({ redraw: () => draw(), scale: MO.scale || 3, speed: MO.speed, backSpeed: MO.backSpeed, pickMs: MO.pickMs, placeMs: MO.placeMs, homes });
      [1, 2].forEach(c => { homes[c] = [POT[c][0] + (c === 1 ? -4 : 4), H - 22 - mv.size.h * 0.42]; });
      const draw = () => { drawTable(ctx, names); ctx.save(); ctx.translate(SIDE, 0); drawBoard(ctx, g, busy ? null : hover, over); ctx.restore(); mv.draw(ctx); };
      // 돌 하나를 아바타가 옮겨서 둠: 내려놓는 순간 판에 놓임
      function carry(c, i, done) {
        busy = true; buttons();
        mv.add({ who: String(c), pot: POT[c], to: [SIDE + px(i % N), px((i / N) | 0)], piece: (cx, x2, y2) => B.stone(cx, x2, y2, 22, c === 1),
          onPlace: () => { g.play(i); draw(); }, onDone: () => { busy = mv.busy(); buttons(); if (!over) done(); } });
      }
      function after(note) {
        draw(); buttons();
        if (g.over) return finish();
        turnText(note);
        if (mode === 'ai' && g.turn === 2) {
          busy = true; buttons();
          timer = B.think(() => {
            const m = aiMove(g, level);
            let n = '';
            if (m < 0) { g.pass(); n = '컴퓨터가 수를 넘겼어요'; busy = false; return after(n); }
            carry(2, m, () => after());
          }, 450);
        }
      }
      function finish() {
        const s = g.score(), w = s.black > s.white ? 0 : 1;
        end(w, `계가 결과 흑 ${s.black}집 : 백 ${s.white}집 (덤 ${KOMI}) — ${w === 0 ? '흑' : '백'} 승`, s);
      }
      function end(w, msg, s) {
        over = true; g.over = true; mv.clear(); busy = false; clock.stop(); draw(); buttons();
        hooks.onTurn({ text: msg, side: -1 });
        hooks.onOver({ winner: w, message: msg, moves: g.moves, duration_sec: clock.sec(), extra: { moves: g.moves, black: s && s.black, white: s && s.white }, record: { side, moves: g.log.slice(), extra: s ? { black: s.black, white: s.white } : null } });
      }
      const off = B.pointer(canvas, W, H, (t, x, y) => {
        const gx = Math.round((x - SIDE - M) / C), gy = Math.round((y - M) / C), ok = gx >= 0 && gy >= 0 && gx < N && gy < N;
        const i = ok ? gy * N + gx : null;
        if (t === 'move') { if (i !== hover) { hover = i; draw(); } }
        else if (t === 'leave') { hover = null; draw(); }
        else if (t === 'up' && ok && !over && !busy && human()) {
          if (g.tryPlay(i)) { hover = null; send(i); carry(g.turn, i, () => after()); turnText(); } else if (g.b[i] === 0) hooks.onToast && hooks.onToast('그곳은 둘 수 없어요 (자충수 또는 패)');
        }
      });
      draw();
      const onImg = () => draw(); window.addEventListener('gogo:img', onImg);
      return {
        get state() { return over ? 'over' : 'playing'; },
        start(o) {
          clearTimeout(timer); mv.clear(); o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal'; side = o.side || 0;
          { const pl = B.players(mode, o, side, 'baduk', level); mv.setAvatars({ 1: pl.av[0], 2: pl.av[1] }); names = { 1: pl.name[0], 2: pl.name[1] }; }
          g = Rules(); over = false; busy = false; clock.reset(); clock.start(); hooks.onState('playing'); after();
        },
        press(id) {
          if (over) return;
          if (id === 'pass' && !busy && human()) { g.pass(); send('pass'); after(name(3 - g.turn) + '이(가) 수를 넘겼어요'); }
          if (id === 'resign') { clearTimeout(timer); const loser = mode === 'ai' ? 1 : mode === 'online' ? side + 1 : g.turn; send({ resign: 1 }); end(loser === 1 ? 1 : 0, name(loser) + ' 기권 · ' + name(3 - loser) + ' 승'); }
        },
        // 온라인: 상대가 둔 수
        remote(m) {
          if (over) return;
          if (m && m.resign) { const loser = 2 - side; return end(loser === 1 ? 1 : 0, (m.left ? '상대가 나갔어요 · ' : name(loser) + ' 기권 · ') + name(3 - loser) + ' 승'); }
          if (m === 'pass') { g.pass(); return after('상대가 수를 넘겼어요'); }
          if (typeof m === 'number' && g.tryPlay(m)) carry(g.turn, m, () => after());
        },
        togglePause() {}, action() {},
        destroy() { window.removeEventListener('gogo:img', onImg); clearTimeout(timer); mv.clear(); off(); }
      };
    }
  };
})();
