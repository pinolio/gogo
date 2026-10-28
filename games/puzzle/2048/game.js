/* 고고고고 — 2048 (4×4, 합친 숫자만큼 점수) */
(function () {
  'use strict';
  const P = window.GoPixel;
  const N = 4, W = 400, H = 400, G = 12, T = (W - G * (N + 1)) / N;
  const TILE = {
    2: ['#EEF1FF', '#1D2340'], 4: ['#CFEFFF', '#1D2340'], 8: ['#3BC8F5', '#0F1430'], 16: ['#4C7DFF', '#FFFFFF'],
    32: ['#A66BFF', '#FFFFFF'], 64: ['#FF5A5F', '#FFFFFF'], 128: ['#FF9A3D', '#0F1430'], 256: ['#FFD23F', '#0F1430'],
    512: ['#3DDC84', '#0F1430'], 1024: ['#21B866', '#FFFFFF'], 2048: ['#FF3D8B', '#FFFFFF']
  };
  const tileColor = v => TILE[v] || ['#FFFFFF', '#FF3D8B'];

  function drawTile(ctx, v, x, y, s) {
    const [bg, fg] = tileColor(v);
    P.block(ctx, x, y, s, bg);
    const str = String(v), size = str.length <= 2 ? Math.round(s * 0.3) : str.length === 3 ? Math.round(s * 0.25) : str.length === 4 ? Math.round(s * 0.2) : Math.round(s * 0.16);
    ctx.font = size + 'px "Press Start 2P", "Courier New", monospace';
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x + s / 2 + 1, y + s / 2 + 2);
  }
  const pos = i => G + i * (T + G);
  // 판: Meshy 쟁반 그림 + 빈 칸
  function tray(ctx, w, h) {
    const im = P.img('tray');
    if (P.ok(im)) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, 0, 0, w, h); ctx.restore(); }
    else { ctx.fillStyle = P.BOARD; ctx.fillRect(0, 0, w, h); }
    const g = G * w / W, t = T * w / W;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { ctx.fillStyle = '#1C2452'; ctx.fillRect(g + c * (t + g), g + r * (t + g), t, t); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(g + c * (t + g), g + r * (t + g), t, 3); }
  }

  window.GoGames['2048'] = {
    id: '2048', size: [W, H],

    thumb(ctx, w, h) {
      ctx.fillStyle = P.BOARD; ctx.fillRect(0, 0, w, h);
      const vals = [[2, 8, 64, 4], [16, 128, 2048, 32], [4, 256, 512, 2]];
      const s = 34, g = 6, ox = (w - (4 * s + 3 * g)) / 2, oy = (h - (3 * s + 2 * g)) / 2;
      vals.forEach((row, r) => row.forEach((v, c) => drawTile(ctx, v, ox + c * (s + g), oy + r * (s + g), s)));
    },

    create(canvas, hooks) {
      const ctx = P.setup(canvas, W, H);
      const clock = P.clock();
      let b, score, maxTile, won, anim, state = 'ready', raf = 0, last = 0;

      function empties() { const e = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!b[r][c]) e.push([r, c]); return e; }
      function spawn() {
        const e = empties(); if (!e.length) return;
        const [r, c] = e[Math.random() * e.length | 0];
        b[r][c] = Math.random() < 0.9 ? 2 : 4;
        anim.push({ r, c, t: 0, kind: 'new' });
      }
      function reset() {
        b = Array.from({ length: N }, () => Array(N).fill(0));
        score = 0; maxTile = 2; won = false; anim = []; clock.reset();
        spawn(); spawn(); hooks.onScore(0);
      }
      function line(dir, i) {
        const k = [0, 1, 2, 3];
        if (dir === 'left') return k.map(j => [i, j]);
        if (dir === 'right') return k.map(j => [i, 3 - j]);
        if (dir === 'up') return k.map(j => [j, i]);
        return k.map(j => [3 - j, i]);
      }
      function canMove() {
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          if (!b[r][c]) return true;
          if (c < N - 1 && b[r][c] === b[r][c + 1]) return true;
          if (r < N - 1 && b[r][c] === b[r + 1][c]) return true;
        }
        return false;
      }
      function move(dir) {
        let moved = false; const pops = [];
        for (let i = 0; i < N; i++) {
          const cs = line(dir, i);
          const vals = cs.map(([r, c]) => b[r][c]).filter(Boolean);
          const out = [], merged = [];
          for (let k = 0; k < vals.length; k++) {
            if (vals[k] === vals[k + 1]) {
              const v = vals[k] * 2; out.push(v); score += v; merged.push(out.length - 1);
              if (v > maxTile) maxTile = v; k++;
            } else out.push(vals[k]);
          }
          while (out.length < N) out.push(0);
          cs.forEach(([r, c], k) => { if (b[r][c] !== out[k]) moved = true; b[r][c] = out[k]; });
          merged.forEach(k => pops.push(cs[k]));
        }
        if (!moved) return;
        pops.forEach(([r, c]) => anim.push({ r, c, t: 0, kind: 'pop' }));
        spawn(); hooks.onScore(score);
        if (!won && maxTile >= 2048) { won = true; hooks.onToast && hooks.onToast('2048 달성! 계속하면 점수가 더 올라가요.'); }
        if (!canMove()) over();
      }
      function over() {
        if (state === 'over') return;
        state = 'over'; clock.stop(); hooks.onState('over');
        hooks.onOver({ score, duration_sec: clock.sec(), extra: { maxTile } });
      }
      function draw(dt) {
        tray(ctx, W, H);
        anim.forEach(a => { a.t += dt; });
        anim = anim.filter(a => a.t < 140);
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const v = b[r][c]; if (!v) continue;
          const a = anim.find(x => x.r === r && x.c === c);
          let sc = 1;
          if (a) { const p = a.t / 140; sc = a.kind === 'new' ? 0.4 + 0.6 * p : 1 + 0.12 * Math.sin(p * Math.PI); }
          const s = T * sc, off = (T - s) / 2;
          drawTile(ctx, v, pos(c) + off, pos(r) + off, s);
        }
      }
      function tick(t) {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(100, t - (last || t)); last = t;
        draw(dt);
      }

      reset();
      raf = requestAnimationFrame(tick);

      return {
        get state() { return state; },
        start() {
          if (state === 'over') reset();
          state = 'playing'; clock.start(); hooks.onState('playing');
        },
        togglePause() {
          if (state === 'playing') { state = 'paused'; clock.stop(); hooks.onState('paused'); }
          else if (state === 'paused') { state = 'playing'; clock.start(); hooks.onState('playing'); }
        },
        action(a) { if (state === 'playing' && ['left', 'right', 'up', 'down'].includes(a)) move(a); },
        destroy() { cancelAnimationFrame(raf); }
      };
    }
  };
})();
