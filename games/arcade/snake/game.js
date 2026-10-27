/* 고고고고 — 스네이크 (20×20, 사과 1개당 10점, 먹을수록 빨라짐) */
(function () {
  'use strict';
  const P = window.GoPixel;
  const N = 20, C = 20, W = N * C, H = N * C;
  const BODY = '#3DDC84', HEAD = '#21B866', APPLE = '#FF5A5F', LEAF = '#3DDC84';
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  function apple(ctx, x, y, s) {
    const u = s / 10;
    ctx.fillStyle = APPLE;
    ctx.fillRect(x + 2 * u, y + 3 * u, 6 * u, 6 * u);
    ctx.fillRect(x + 1 * u, y + 4 * u, 8 * u, 4 * u);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + 3 * u, y + 4 * u, 2 * u, 2 * u);
    ctx.fillStyle = '#7A4A2A'; ctx.fillRect(x + 5 * u, y + 1 * u, 1 * u, 2 * u);
    ctx.fillStyle = LEAF; ctx.fillRect(x + 6 * u, y + 1 * u, 2 * u, 1 * u);
  }
  function board(ctx, w, h, s) {
    for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
      ctx.fillStyle = (x + y) % 2 ? P.BOARD : '#1A2144';
      ctx.fillRect(x * s, y * s, s, s);
    }
  }

  window.GoGames.snake = {
    id: 'snake', size: [W, H],

    thumb(ctx, w, h) {
      const s = 15; board(ctx, w, h, s);
      const path = [[3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [7, 5], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4]];
      path.forEach(([x, y], i) => P.block(ctx, x * s, y * s, s, i === path.length - 1 ? HEAD : BODY));
      apple(ctx, 13 * s, 4 * s, s);
    },

    create(canvas, hooks) {
      const ctx = P.setup(canvas, W, H);
      const clock = P.clock();
      let snake, dir, queue, food, score, apples, step, acc, state = 'ready', last = 0, raf = 0;

      function place() {
        if (snake.length >= N * N) return over();
        do { food = { x: Math.random() * N | 0, y: Math.random() * N | 0 }; }
        while (snake.some(s => s.x === food.x && s.y === food.y));
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
        if (eating) {
          apples++; score += 10; step = Math.max(65, 140 - apples * 3);
          hooks.onScore(score); place();
        } else snake.pop();
      }
      function over() {
        if (state === 'over') return;
        state = 'over'; clock.stop(); hooks.onState('over');
        hooks.onOver({ score, duration_sec: clock.sec(), extra: { apples, length: snake.length } });
      }
      function draw() {
        board(ctx, W, H, C);
        apple(ctx, food.x * C, food.y * C, C);
        for (let i = snake.length - 1; i >= 0; i--) P.block(ctx, snake[i].x * C, snake[i].y * C, C, i === 0 ? HEAD : BODY);
        // 눈
        const h = snake[0], u = C / 10;
        ctx.fillStyle = '#0F1430';
        const fx = dir.x < 0 ? 2 : dir.x > 0 ? 6 : null, fy = dir.y < 0 ? 2 : dir.y > 0 ? 6 : null;
        if (fx != null) { ctx.fillRect(h.x * C + fx * u, h.y * C + 2 * u, 2 * u, 2 * u); ctx.fillRect(h.x * C + fx * u, h.y * C + 6 * u, 2 * u, 2 * u); }
        else { ctx.fillRect(h.x * C + 2 * u, h.y * C + fy * u, 2 * u, 2 * u); ctx.fillRect(h.x * C + 6 * u, h.y * C + fy * u, 2 * u, 2 * u); }
        P.text(ctx, 'x' + apples, W - 8, 8, 10, 'rgba(238,241,255,.55)', 'right');
      }
      function tick(t) {
        raf = requestAnimationFrame(tick);
        const dt = Math.min(100, t - (last || t)); last = t;
        if (state === 'playing') { acc += dt; while (acc >= step && state === 'playing') { acc -= step; advance(); } }
        draw();
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
