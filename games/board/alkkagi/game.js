/*
 * gogo?gogo! — 장기 알까기
 *  - 내 알을 누른 채 뒤로 당겼다 놓으면 반대쪽으로 튕겨 나갑니다. (새총처럼)
 *  - 판 밖으로 나간 알은 없어집니다. 상대 알을 모두 떨어뜨리면 승리!
 *  - 한 번 쏠 때마다 차례가 바뀝니다. 30번씩 쏘아도 끝나지 않으면 남은 알이 많은 쪽이 승리.
 */
(function () {
  'use strict';
  const Bd = window.GoBoard;
  const W = 420, H = 500, L = 18, T = 18, R = W - 18, BOT = H - 18;   // 판 테두리
  const FRICTION = 0.976, STOP = 0.04, MAXV = 14, E = 0.88;   // 마찰·최대 힘 (밸런스 조정 가능)
  const RAD = { K: 18, C: 15, P: 15, H: 15, E: 15, A: 13, S: 12 };
  const KO = { K: ['楚', '漢'], C: ['車', '車'], P: ['包', '包'], H: ['馬', '馬'], E: ['象', '象'], A: ['士', '士'], S: ['卒', '兵'] };   // 장기알 정식 한자
  const MAX_SHOTS = 60;

  function initial() {
    const ps = [], gx = i => 40 + i * 42.5, gy = j => 40 + j * 46.7;
    const put = (i, j, t, s) => ps.push({ x: gx(i), y: gy(j), vx: 0, vy: 0, r: RAD[t], m: RAD[t] * RAD[t], t, s, alive: true, fall: 0 });
    const back = ['C', 'H', 'E', 'A', null, 'A', 'E', 'H', 'C'];
    back.forEach((t, i) => { if (t) { put(i, 9, t, 0); put(i, 0, t, 1); } });
    put(4, 8, 'K', 0); put(4, 1, 'K', 1);
    put(1, 7, 'P', 0); put(7, 7, 'P', 0); put(1, 2, 'P', 1); put(7, 2, 'P', 1);
    [0, 2, 4, 6, 8].forEach(i => { put(i, 6, 'S', 0); put(i, 3, 'S', 1); });
    return ps;
  }
  const clone = ps => ps.map(p => Object.assign({}, p));
  const onBoard = p => p.x >= L && p.x <= R && p.y >= T && p.y <= BOT;
  // 한 걸음 물리 계산. 움직이는 알이 있으면 true
  function step(ps) {
    let moving = false;
    for (const p of ps) {
      if (!p.alive) continue;
      if (p.fall) { p.fall += 1; if (p.fall > 18) p.alive = false; continue; }
      p.x += p.vx; p.y += p.vy; p.vx *= FRICTION; p.vy *= FRICTION;
      if (Math.abs(p.vx) < STOP && Math.abs(p.vy) < STOP) { p.vx = 0; p.vy = 0; } else moving = true;
      if (!onBoard(p)) { p.fall = 1; moving = true; }
    }
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i]; if (!a.alive || a.fall) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j]; if (!b.alive || b.fall) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, rr = a.r + b.r;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const over = rr - d, ta = b.m / (a.m + b.m), tb = a.m / (a.m + b.m);
        a.x -= nx * over * ta; a.y -= ny * over * ta; b.x += nx * over * tb; b.y += ny * over * tb;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel >= 0) continue;
        const jimp = -(1 + E) * rel / (1 / a.m + 1 / b.m);
        a.vx -= jimp * nx / a.m; a.vy -= jimp * ny / a.m; b.vx += jimp * nx / b.m; b.vy += jimp * ny / b.m;
        moving = true;
      }
    }
    return moving;
  }
  function simulate(ps, maxSteps) { let n = 0; while (step(ps) && n++ < (maxSteps || 900)); return ps; }
  const count = (ps, s) => ps.filter(p => p.alive && !p.fall && p.s === s).length;

  /* ---------- 컴퓨터 ---------- */
  const LV = { easy: { pairs: 2, angle: 0.13, power: 0.25 }, normal: { pairs: 5, angle: 0.05, power: 0.12 }, hard: { pairs: 9, angle: 0.015, power: 0.05 } };
  function aiShot(ps, side, level) {
    const Lv = LV[level] || LV.normal, mine = ps.filter(p => p.alive && p.s === side), foes = ps.filter(p => p.alive && p.s !== side);
    const pairs = [];
    mine.forEach((m, mi) => foes.forEach(f => pairs.push({ mi: ps.indexOf(m), fi: ps.indexOf(f), d: Math.hypot(f.x - m.x, f.y - m.y) })));
    pairs.sort((a, b) => a.d - b.d);
    let best = null;
    const before = [count(ps, side), count(ps, 1 - side)];
    for (const pr of pairs.slice(0, Lv.pairs)) {
      const m = ps[pr.mi], f = ps[pr.fi];
      // 상대 알을 판 밖 가까운 쪽으로 밀어내도록 살짝 비껴 조준
      for (const off of [0, -0.12, 0.12]) for (const pw of [0.6, 0.85, 1]) {
        const ang = Math.atan2(f.y - m.y, f.x - m.x) + off;
        const sim = simulate(clone(ps).map((p, k) => (k === pr.mi ? Object.assign(p, { vx: Math.cos(ang) * MAXV * pw, vy: Math.sin(ang) * MAXV * pw }) : p)));
        const lostMine = before[0] - count(sim, side), lostFoe = before[1] - count(sim, 1 - side);
        const score = lostFoe * 10 - lostMine * 12 - (lostMine && sim[pr.mi].alive === false ? 3 : 0) + Math.random();
        if (!best || score > best.score) best = { i: pr.mi, ang, pw, score };
      }
    }
    if (!best) return null;
    return { i: best.i, vx: Math.cos(best.ang + (Math.random() - 0.5) * 2 * Lv.angle) * MAXV * Math.min(1, best.pw * (1 + (Math.random() - 0.5) * Lv.power)), vy: Math.sin(best.ang + (Math.random() - 0.5) * 2 * Lv.angle) * MAXV * Math.min(1, best.pw * (1 + (Math.random() - 0.5) * Lv.power)) };
  }

  /* ---------- 화면 ---------- */
  const COLOR = [{ rim: '#1E7A4F', ink: '#1E7A4F' }, { rim: '#C9343A', ink: '#C9343A' }];
  function drawPiece(ctx, p, sel) {
    const k = COLOR[p.s], scale = p.fall ? Math.max(0.1, 1 - p.fall / 18) : 1, r = p.r * scale;
    ctx.globalAlpha = p.fall ? Math.max(0, 1 - p.fall / 18) : 1;
    if (r > 4) {
      ctx.globalAlpha = p.fall ? Math.max(0, 1 - p.fall / 18) : 1;
      Bd.janggiPiece(ctx, p.x, p.y, Math.max(5, r * 0.98), KO[p.t][p.s], p.s === 0 ? '#11603A' : '#B21F2A', sel);
      ctx.globalAlpha = 1; return;
    }
    Bd.disc(ctx, p.x + 2, p.y + 3, r + 1, 'rgba(0,0,0,.25)', { shine: false, px: 2 });
    Bd.disc(ctx, p.x, p.y, r + 2, k.rim, { shine: false, px: 2 });
    Bd.disc(ctx, p.x, p.y, r, sel ? '#FFE9A0' : '#F6EEDB', { rim: '#C8B994', px: 2, light: '#FFFCF2' });
    if (r > 6) Bd.label(ctx, KO[p.t][p.s], p.x, p.y + 1, Math.round(r * 1.22), k.ink, 900, 'hanja');
    ctx.globalAlpha = 1;
  }
  function drawScene(ctx, ps, aim) {
    const GP = window.GoPixel, tb = GP.img('table');
    if (GP.ok(tb)) { ctx.save(); ctx.imageSmoothingEnabled = false; const iw = tb.naturalWidth, ih = tb.naturalHeight; ctx.drawImage(tb, iw * 0.3, ih * 0.3, iw * 0.4, ih * 0.4 * H / W * (iw / ih) * 1, 0, 0, W, H); ctx.fillStyle = 'rgba(12,8,20,.25)'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    else { ctx.fillStyle = '#1A2144'; ctx.fillRect(0, 0, W, H); }
    Bd.wood(ctx, L, T, R - L, BOT - T);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(L + 4, BOT, R - L, 4); ctx.fillRect(R, T + 4, 4, BOT - T);
    for (let j = 0; j < 10; j++) Bd.line(ctx, 40, 40 + j * 46.7, 380, 40 + j * 46.7, 'rgba(90,58,26,.45)', 1);
    for (let i = 0; i < 9; i++) Bd.line(ctx, 40 + i * 42.5, 40, 40 + i * 42.5, 460, 'rgba(90,58,26,.45)', 1);
    ps.filter(p => p.alive).forEach(p => drawPiece(ctx, p, aim && aim.p === p));
    if (aim && aim.pow > 0.05) {
      const p = aim.p, len = 30 + aim.pow * 110, ex = p.x + Math.cos(aim.ang) * len, ey = p.y + Math.sin(aim.ang) * len;
      const n = Math.floor(len / 10);
      for (let k = 1; k <= n; k++) { ctx.fillStyle = k / n > 0.8 ? '#FF5A5F' : '#FFD23F'; const t = k / n; ctx.fillRect(p.x + (ex - p.x) * t - 3, p.y + (ey - p.y) * t - 3, 6, 6); }
      ctx.fillStyle = '#FFD23F'; ctx.fillRect(L, H - 12, (R - L) * aim.pow, 6);
    }
  }

  window.GoGames.alkkagi = {
    id: 'alkkagi', size: [W, H], initial, step, simulate, aiShot, count,
    thumb(ctx, w, h) {
      ctx.fillStyle = '#1A2144'; ctx.fillRect(0, 0, w, h); Bd.wood(ctx, 8, 8, w - 16, h - 16);
      [[40, 110, 'C', 0], [90, 100, 'K', 0], [150, 40, 'C', 1], [190, 70, 'S', 1], [120, 50, 'H', 1]].forEach(([x, y, t, s]) => drawPiece(ctx, { x, y, r: RAD[t] * 0.9, t, s, fall: 0 }));
      for (let k = 1; k <= 5; k++) { ctx.fillStyle = '#FFD23F'; ctx.fillRect(90 + k * 9, 100 - k * 9, 5, 5); }
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      let ps = initial(), turn = 0, mode = 'ai', level = 'normal', aim = null, rolling = false, over = false, shots = 0, raf = 0, timer = 0;
      const name = s => (s === 0 ? '초' : '한');
      const human = () => !over && !rolling && (mode === 'local' || turn === 0);
      const draw = () => drawScene(ctx, ps, aim);
      function turnText() {
        if (over) return;
        const who = rolling ? '알이 굴러가는 중…' : mode === 'ai' ? (turn === 0 ? '내 차례 (초) · 알을 당겼다 놓으세요' : '컴퓨터가 조준 중… (한)') : name(turn) + ' 차례 · 알을 당겼다 놓으세요';
        hooks.onTurn({ text: who + ` · 남은 알 초 ${count(ps, 0)} : 한 ${count(ps, 1)}`, side: turn });
      }
      function shoot(i, vx, vy) {
        ps[i].vx = vx; ps[i].vy = vy; rolling = true; shots++; turnText();
        const loop = () => {
          let moving = false;
          for (let k = 0; k < 2; k++) moving = step(ps) || moving;   // 한 화면에 두 걸음
          draw();
          if (moving) raf = requestAnimationFrame(loop); else { rolling = false; next(); }
        };
        raf = requestAnimationFrame(loop);
      }
      function next() {
        const a = count(ps, 0), b = count(ps, 1);
        if (!a || !b) return end(!a && !b ? -1 : a ? 0 : 1, !a && !b ? '양쪽 알이 모두 떨어졌어요 — 무승부' : name(a ? 0 : 1) + ' 승! 상대 알을 모두 떨어뜨렸어요');
        if (shots >= MAX_SHOTS) return end(a === b ? -1 : a > b ? 0 : 1, `${MAX_SHOTS}번 판정: 초 ${a}알 · 한 ${b}알 — ` + (a === b ? '무승부' : name(a > b ? 0 : 1) + ' 승'));
        turn = 1 - turn; turnText();
        if (mode === 'ai' && turn === 1) {
          timer = Bd.think(() => { const s = aiShot(ps, 1, level); if (s) shoot(s.i, s.vx, s.vy); }, 600);
        }
      }
      function end(w, msg) {
        over = true; clock.stop(); draw();
        hooks.onTurn({ text: msg, side: -1 });
        hooks.onOver({ winner: w, message: msg, moves: shots, duration_sec: clock.sec(), extra: { shots, left0: count(ps, 0), left1: count(ps, 1) } });
      }
      const off = Bd.pointer(canvas, W, H, (t, x, y) => {
        if (t === 'down' && human()) {
          const p = ps.find(q => q.alive && !q.fall && q.s === turn && Math.hypot(q.x - x, q.y - y) <= q.r + 6);
          if (p) { aim = { p, sx: x, sy: y, ang: 0, pow: 0 }; draw(); }
        } else if (t === 'move' && aim) {
          const dx = aim.sx - x, dy = aim.sy - y, d = Math.hypot(dx, dy);
          aim.ang = Math.atan2(dy, dx); aim.pow = Math.min(1, d / 120); draw();
        } else if ((t === 'up' || t === 'leave') && aim) {
          const a = aim; aim = null;
          if (t === 'up' && a.pow > 0.06) shoot(ps.indexOf(a.p), Math.cos(a.ang) * MAXV * a.pow, Math.sin(a.ang) * MAXV * a.pow);
          else draw();
        }
      });
      draw(); Bd.whenHanja(draw);
      const onImg = () => draw(); window.addEventListener('gogo:img', onImg);
      return {
        get state() { return over ? 'over' : 'playing'; },
        start(o) {
          cancelAnimationFrame(raf); clearTimeout(timer); o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal';
          ps = initial(); turn = 0; shots = 0; rolling = false; over = false; aim = null;
          clock.reset(); clock.start(); hooks.onState('playing'); hooks.onButtons([]); draw(); turnText();
        },
        press(id) { if (id === 'resign' && !over) { cancelAnimationFrame(raf); clearTimeout(timer); rolling = false; const loser = mode === 'ai' ? 0 : turn; end(1 - loser, name(loser) + ' 기권 · ' + name(1 - loser) + ' 승'); } },
        togglePause() {}, action() {},
        destroy() { window.removeEventListener('gogo:img', onImg); cancelAnimationFrame(raf); clearTimeout(timer); off(); }
      };
    }
  };
})();
