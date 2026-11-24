/* 고고고고 — 스네이크 (20×20, 사과 1개당 10점, 먹을수록 빨라짐) */
(function () {
  'use strict';
  const P = window.GoPixel;
  const N = 20, C = 20, W = N * C, H = N * C;
  const BODY = '#3DDC84', HEAD = '#21B866', APPLE = '#FF5A5F', LEAF = '#3DDC84';
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  function apple(ctx, x, y, s) {
    const im = P.img('apple');
    if (P.ok(im)) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, x - s * 0.05, y - s * 0.05, s * 1.1, s * 1.1); ctx.restore(); return; }
    const u = s / 10;
    ctx.fillStyle = APPLE;
    ctx.fillRect(x + 2 * u, y + 3 * u, 6 * u, 6 * u);
    ctx.fillRect(x + 1 * u, y + 4 * u, 8 * u, 4 * u);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + 3 * u, y + 4 * u, 2 * u, 2 * u);
    ctx.fillStyle = '#7A4A2A'; ctx.fillRect(x + 5 * u, y + 1 * u, 1 * u, 2 * u);
    ctx.fillStyle = LEAF; ctx.fillRect(x + 6 * u, y + 1 * u, 2 * u, 1 * u);
  }
  // v205 그래픽 업그레이드 (선생님 11/24): 꽃·버섯 정원 바닥 · 비늘 마디 뱀(눈·혀·꼬리 방울) · 과일 여러 가지 · 먹으면 하트·별 + '+10' · 지나간 자리 반짝이
  const GARDEN = (() => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); let sd = 7; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { g.fillStyle = (x + y) % 2 ? '#8ED35E' : '#7CC650'; g.fillRect(x * C, y * C, C, C); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x * C, y * C, C, 2); }
    for (let k = 0; k < 160; k++) { g.fillStyle = rn() < 0.5 ? '#6AB743' : '#A6E072'; g.fillRect(rn() * W | 0, rn() * H | 0, 2, 3); }   // 풀잎
    const FL = ['#FF8AD8', '#FFE45C', '#FFFFFF', '#8FC8FF', '#FF9A6A'];
    for (let k = 0; k < 26; k++) { const x = rn() * W | 0, y = rn() * H | 0, c = FL[k % 5]; g.fillStyle = c; g.fillRect(x - 2, y, 2, 2); g.fillRect(x + 2, y, 2, 2); g.fillRect(x, y - 2, 2, 2); g.fillRect(x, y + 2, 2, 2); g.fillStyle = '#FFD23F'; g.fillRect(x, y, 2, 2); }   // 꽃
    for (let k = 0; k < 6; k++) { const x = rn() * (W - 12) | 0, y = rn() * (H - 12) | 0; g.fillStyle = '#F4E6C8'; g.fillRect(x + 3, y + 5, 3, 4); g.fillStyle = k % 2 ? '#FF5A5F' : '#B57BFF'; g.fillRect(x, y + 1, 9, 4); g.fillRect(x + 1, y, 7, 1); g.fillStyle = '#FFFFFF'; g.fillRect(x + 2, y + 2, 2, 1); g.fillRect(x + 6, y + 1, 1, 1); }   // 버섯
    const vg = g.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,60,10,.28)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c; })();
  const FRUIT = ['apple', 'straw', 'grape', 'gold'];
  function fruit(ctx, x, y, s, kind, t) {
    if (kind === 'apple') return apple(ctx, x, y, s);
    const u = s / 10, bob = Math.sin((t || 0) / 220) * u * 0.6; y += bob;
    if (kind === 'straw') { ctx.fillStyle = '#FF3D5A'; ctx.fillRect(x + 2 * u, y + 3 * u, 6 * u, 4 * u); ctx.fillRect(x + 3 * u, y + 7 * u, 4 * u, 1.5 * u); ctx.fillRect(x + 4 * u, y + 8.5 * u, 2 * u, 1 * u); ctx.fillStyle = '#FFE45C'; [[3, 4], [6, 4], [4.5, 5.5], [3.5, 7], [6, 6.5]].forEach(([a, b]) => ctx.fillRect(x + a * u, y + b * u, u * 0.8, u * 0.8)); ctx.fillStyle = '#3DDC84'; ctx.fillRect(x + 2.5 * u, y + 2 * u, 5 * u, 1.3 * u); ctx.fillRect(x + 4.5 * u, y + 0.8 * u, u, 1.4 * u); return; }
    if (kind === 'grape') { ctx.fillStyle = '#9A5BFF'; [[3, 3], [5, 3], [7, 3], [4, 5], [6, 5], [5, 7]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(x + a * u, y + b * u + u, u * 1.25, 0, Math.PI * 2); ctx.fill(); }); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x + 2.6 * u, y + 3.4 * u, u * 0.8, u * 0.8); ctx.fillStyle = '#3DDC84'; ctx.fillRect(x + 5 * u, y + 0.6 * u, 2 * u, u); return; }
    // gold: 반짝이는 황금 사과 (점수는 같음)
    ctx.save(); ctx.shadowColor = '#FFE45C'; ctx.shadowBlur = 8; ctx.fillStyle = '#FFC83D'; ctx.fillRect(x + 2 * u, y + 3 * u, 6 * u, 6 * u); ctx.fillRect(x + 1 * u, y + 4 * u, 8 * u, 4 * u); ctx.restore();
    ctx.fillStyle = '#FFF4B0'; ctx.fillRect(x + 3 * u, y + 4 * u, 2 * u, 2 * u); ctx.fillStyle = '#7A4A2A'; ctx.fillRect(x + 5 * u, y + 1 * u, u, 2 * u); ctx.fillStyle = '#3DDC84'; ctx.fillRect(x + 6 * u, y + 1 * u, 2 * u, u);
    if (Math.floor((t || 0) / 300) % 2) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 8 * u, y + 1.5 * u, u, u); ctx.fillRect(x + 1 * u, y + 8 * u, u * 0.8, u * 0.8); }
  }
  function snakeDraw(ctx, sn, dir, t, alive) {   // 마디 뱀: 꼬리 → 머리
    const n = sn.length, cx = p => p.x * C + C / 2, cy = p => p.y * C + C / 2;
    for (let i = n - 1; i >= 1; i--) {   // 마디 사이를 이어 둥근 몸
      const a = sn[i], b = sn[i - 1], k = i / Math.max(1, n - 1), r = C * (0.42 - 0.12 * k);
      ctx.fillStyle = i % 2 ? '#3DBE5C' : '#4FD36C'; ctx.beginPath(); ctx.arc(cx(a), cy(a), r, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(Math.min(cx(a), cx(b)) - (a.y !== b.y ? r : 0), Math.min(cy(a), cy(b)) - (a.x !== b.x ? r : 0), Math.abs(cx(a) - cx(b)) + (a.y !== b.y ? r * 2 : 0), Math.abs(cy(a) - cy(b)) + (a.x !== b.x ? r * 2 : 0));
    }
    for (let i = n - 1; i >= 1; i--) { const a = sn[i], k = i / Math.max(1, n - 1), r = C * (0.42 - 0.12 * k);   // 비늘 무늬 · 반짝이
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.arc(cx(a) - r * 0.3, cy(a) - r * 0.3, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i % 3 ? 'rgba(20,90,40,.35)' : '#FFE45C'; ctx.fillRect(cx(a) - 1.5, cy(a) - 1.5, 3, 3); }
    if (n > 1) { const tl = sn[n - 1]; ctx.fillStyle = '#FFD23F'; ctx.beginPath(); ctx.arc(cx(tl), cy(tl), C * 0.18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#C8922E'; ctx.fillRect(cx(tl) - 1, cy(tl) - 3, 2, 6); }   // 꼬리 방울
    const h = sn[0], hx = cx(h), hy = cy(h), ang = Math.atan2(dir.y, dir.x);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    if (alive && Math.floor(t / 420) % 3 === 0) { ctx.fillStyle = '#FF3D5A'; ctx.fillRect(C * 0.45, -1, C * 0.32, 2); ctx.fillRect(C * 0.72, -3, 3, 2); ctx.fillRect(C * 0.72, 1, 3, 2); }   // 혀 날름
    ctx.fillStyle = '#2FAE52'; ctx.beginPath(); ctx.ellipse(0, 0, C * 0.56, C * 0.48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(-C * 0.1, -C * 0.18, C * 0.28, C * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    [-1, 1].forEach(sg => { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(C * 0.18, sg * C * 0.22, C * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#0F1430'; ctx.beginPath(); ctx.arc(C * 0.24, sg * C * 0.22, C * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(C * 0.22, sg * C * 0.22 - 2, 2, 2); });
    ctx.fillStyle = '#FF8AB0'; ctx.fillRect(-C * 0.05, -C * 0.42, 3, 2); ctx.fillRect(-C * 0.05, C * 0.38, 3, 2);   // 볼
    ctx.restore();
  }
  function board(ctx, w, h, s) {
    if (w === W && h === H) { ctx.drawImage(GARDEN, 0, 0); return; }   // v205 정원 바닥
    const im = P.img('grass');
    if (P.ok(im)) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, 0, 0, w, h); ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) if ((x + y) % 2) ctx.fillRect(x * s, y * s, s, s); ctx.restore(); return; }
    for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
      ctx.fillStyle = (x + y) % 2 ? P.BOARD : '#1A2144';
      ctx.fillRect(x * s, y * s, s, s);
    }
  }

  window.GoGames.snake = {
    id: 'snake', size: [W, H],

    thumb(ctx, w, h) {
      if (w === W && h === H) {   // v205 큰 그림(카드 사진 만들기용): 새 정원 · 긴 뱀 · 딸기
        board(ctx, W, H, C); const path = [[3, 14], [4, 14], [5, 14], [6, 14], [7, 14], [7, 13], [7, 12], [7, 11], [8, 11], [9, 11], [10, 11], [11, 11], [12, 11], [12, 10], [12, 9], [12, 8], [13, 8], [14, 8]].reverse().map(([x, y]) => ({ x, y }));
        fruit(ctx, 16 * C, 8 * C, C, 'straw', 0); fruit(ctx, 4 * C, 5 * C, C, 'gold', 300); snakeDraw(ctx, path, { x: 1, y: 0 }, 0, true);
        [[15.5, 8.5], [16.8, 7.6], [15.9, 7.2]].forEach(([a, b], k) => { ctx.fillStyle = k % 2 ? '#FF5A8A' : '#FFE45C'; ctx.fillRect(a * C - 3, b * C - 1, 6, 2); ctx.fillRect(a * C - 1, b * C - 3, 2, 6); });
        return;
      }
      const s = 15; board(ctx, w, h, s);
      const path = [[3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [7, 5], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4]];
      path.forEach(([x, y], i) => P.flat(ctx, x * s, y * s, s, i === path.length - 1 ? HEAD : BODY));
      apple(ctx, 13 * s, 4 * s, s);
    },

    create(canvas, hooks) {
      const ctx = P.setup(canvas, W, H);
      const clock = P.clock();
      let snake, dir, queue, food, score, apples, step, acc, state = 'ready', last = 0, raf = 0, fx = [], trail = [];

      function place() {
        if (snake.length >= N * N) return over();
        do { food = { x: Math.random() * N | 0, y: Math.random() * N | 0 }; }
        while (snake.some(s => s.x === food.x && s.y === food.y));
        food.kind = FRUIT[Math.random() < 0.12 ? 3 : Math.floor(Math.random() * 3)];   // v205 과일 모양만 여러 가지 (점수는 모두 10)
      }
      function reset() {
        snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
        dir = { x: 1, y: 0 }; queue = []; score = 0; apples = 0; step = 140; acc = 0; clock.reset();
        place(); hooks.onScore(0);
      }
      function turn(name) {
        const d = DIRS[name]; if (!d) return;
        const ref = queue.length ? queue[queue.length - 1] : dir;
        if ((ref.x === -d[0] && ref.y === -d[1]) || (ref.x === d[0] && ref.y === d[1])) return;
        if (queue.length < 2) queue.push({ x: d[0], y: d[1] });
      }
      function advance() {
        if (queue.length) dir = queue.shift();
        const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        const eating = h.x === food.x && h.y === food.y;
        const body = eating ? snake : snake.slice(0, -1);
        if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || body.some(s => s.x === h.x && s.y === h.y)) return over();
        snake.unshift(h);
        const tl = snake[snake.length - 1]; trail.push({ x: tl.x * C + C / 2, y: tl.y * C + C / 2, t: 0 });   // 지나간 자리 반짝이
        if (eating) {
          for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; fx.push({ x: h.x * C + C / 2, y: h.y * C + C / 2, vx: Math.cos(a) * 0.07, vy: Math.sin(a) * 0.07 - 0.03, t: 0, kind: k % 2 ? 'heart' : 'star' }); }
          fx.push({ x: h.x * C + C / 2, y: h.y * C, t: 0, kind: 'txt' });
          apples++; score += 10; step = Math.max(65, 140 - apples * 3);
          hooks.onScore(score); place();
        } else snake.pop();
      }
      function over() {
        if (state === 'over') return;
        state = 'over'; clock.stop(); hooks.onState('over');
        hooks.onOver({ score, duration_sec: clock.sec(), extra: { apples, length: snake.length } });
      }
      function draw(dt) {
        const t = performance.now(); dt = dt || 16;
        board(ctx, W, H, C);
        trail = trail.filter(p => (p.t += dt) < 600); trail.forEach(p => { const q = p.t / 600; ctx.globalAlpha = 0.8 * (1 - q); ctx.fillStyle = '#FFF4B0'; ctx.fillRect(p.x - 1, p.y - 3, 2, 6); ctx.fillRect(p.x - 3, p.y - 1, 6, 2); }); ctx.globalAlpha = 1;
        { const fx0 = food.x * C + C / 2, fy0 = food.y * C + C / 2, gl = ctx.createRadialGradient(fx0, fy0, 2, fx0, fy0, C); gl.addColorStop(0, 'rgba(255,244,176,.55)'); gl.addColorStop(1, 'rgba(255,244,176,0)'); ctx.fillStyle = gl; ctx.fillRect(fx0 - C, fy0 - C, C * 2, C * 2); }
        fruit(ctx, food.x * C, food.y * C, C, food.kind || 'apple', t);
        snakeDraw(ctx, snake, dir, t, state !== 'over');
        fx = fx.filter(f => (f.t += dt) < 700); fx.forEach(f => { const q = f.t / 700; ctx.globalAlpha = 1 - q;
          if (f.kind === 'txt') { ctx.font = '12px "Press Start 2P", "Courier New", monospace'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1D2340'; ctx.strokeText('+10', f.x, f.y - q * 26); ctx.fillStyle = '#FFE45C'; ctx.fillText('+10', f.x, f.y - q * 26); }
          else { const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t; if (f.kind === 'heart') { ctx.fillStyle = '#FF5A8A'; ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2); ctx.fillRect(x - 3, y, 6, 2); ctx.fillRect(x - 2, y + 2, 4, 1); ctx.fillRect(x - 1, y + 3, 2, 1); } else { ctx.fillStyle = '#FFE45C'; ctx.fillRect(x - 3, y - 0.5, 6, 1.5); ctx.fillRect(x - 0.75, y - 3, 1.5, 6); } }
          ctx.globalAlpha = 1; });
        P.text(ctx, 'x' + apples, W - 8, 8, 10, 'rgba(29,35,64,.7)', 'right');
      }
      function tick(t) {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(100, t - (last || t)); last = t;
        if (state === 'playing') { acc += dt; while (acc >= step && state === 'playing') { acc -= step; advance(); } }
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
        action(a) { if (state === 'playing') turn(a); },
        destroy() { cancelAnimationFrame(raf); }
      };
    }
  };
})();
