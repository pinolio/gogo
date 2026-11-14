/*
 * gogo?gogo! — skillcom RPG · 효과(FX) 엔진  (v40 그래픽 강화)
 *  - 빛나는 입자(파티클) · 마법 모양(원소 6 × 종류 8) · 맞을 때 불꽃 · 몬스터 사라짐 · 동전 · 레벨 업 기둥
 *  - 지역 분위기(날씨·안개·반딧불·눈·불티·꽃잎·동굴 어둠과 빛) · 마법 아이콘 그림
 *  - game.js 가 위치·피해를 계산하고, 그림은 모두 여기서 그림 (window.GoRPGFx)
 */
(function () {
  'use strict';
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

  /* ---------- 원소 색 (밝은 → 진한) ---------- */
  const PAL = {
    fire: ['#FFFBE0', '#FFE45C', '#FF9A3D', '#E8402A', '#8A1E10'],
    water: ['#FFFFFF', '#CFF0FF', '#6CC4FF', '#2F7FE0', '#183E8A'],
    wind: ['#FFFFFF', '#E8FFF6', '#9AF0D4', '#3EC09A', '#1E6A58'],
    earth: ['#FFF0CC', '#E8C07A', '#B8834A', '#7A5228', '#3E2814'],
    thunder: ['#FFFFFF', '#FFFBC8', '#FFE45C', '#C8A0FF', '#6A3ED0'],
    light: ['#FFFFFF', '#FFFCE8', '#FFF0A0', '#FFD23F', '#C89A1A'],
    dark: ['#E8D8FF', '#B08AF0', '#7A4AD0', '#4A2A8A', '#1E1040'],
    blood: ['#FFFFFF', '#FFC0C0', '#FF6A6E', '#D2343A', '#6A1018']
  };
  const pal = el => PAL[el] || PAL.light;

  /* ---------- 빛 번짐 그림 (색·크기마다 한 번만 만듦) ---------- */
  const glowC = {};
  function glow(color, r) {
    r = Math.max(4, Math.round(r / 4) * 4); const k = color + r;
    if (glowC[k]) return glowC[k];
    const [c, x] = mk(r * 2, r * 2), g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, color); g.addColorStop(0.35, color + 'AA'); g.addColorStop(1, color + '00');
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
    return (glowC[k] = c);
  }
  const drawGlow = (ctx, x, y, r, color, a) => { const g = glow(color, r); ctx.globalAlpha = a == null ? 1 : a; ctx.drawImage(g, x - g.width / 2, y - g.height / 2); ctx.globalAlpha = 1; };

  /* ---------- 번개 모양 (꺾인 선) ---------- */
  function boltPath(x1, y1, x2, y2, jag, seg) {
    const pts = [[x1, y1]], n = seg || Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 22));
    const nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < n; i++) { const t = i / n, o = rand(-jag, jag); pts.push([x1 + (x2 - x1) * t + nx / l * o, y1 + (y2 - y1) * t + ny / l * o]); }
    pts.push([x2, y2]); return pts;
  }
  function strokeBolt(ctx, pts, P, w) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [[w * 3.2, P[3], 0.35], [w * 1.8, P[2], 0.8], [w * 0.8, P[0], 1]].forEach(([lw, col, a]) => {
      ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  /* ================= 입자 ================= */
  const parts = [];        // 세계 좌표
  const MAX = 1400;
  // o: { x, y, vx, vy, life, size, color, g(중력), drag, shape: 'sq'|'glow'|'spark'|'ring'|'star'|'rock'|'leaf'|'coin'|'drop', grow, add(빛남), spin, target }
  function emit(o) { if (parts.length >= MAX) parts.shift(); o.t = 0; o.life = o.life || 0.6; o.size = o.size || 4; o.drag = o.drag == null ? 1.5 : o.drag; o.rot = o.rot || Math.random() * TAU; parts.push(o); return o; }
  function burst(x, y, n, P, opt) {
    opt = opt || {};
    for (let i = 0; i < n; i++) {
      const a = opt.angle != null ? opt.angle + rand(-(opt.spread || 0.6), opt.spread || 0.6) : Math.random() * TAU, sp = rand(opt.min || 40, opt.max || 220);
      emit({ x: x + rand(-(opt.jit || 0), opt.jit || 0), y: y + rand(-(opt.jit || 0), opt.jit || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (opt.flat || 1) + (opt.up || 0), life: rand(opt.lmin || 0.3, opt.lmax || 0.8),
        size: rand(opt.smin || 2, opt.smax || 6), color: P[Math.floor(Math.random() * Math.min(P.length, opt.cols || 4))], g: opt.g || 0, drag: opt.drag, shape: opt.shape || 'sq', add: opt.add !== false, grow: opt.grow || 0, spin: rand(-8, 8) });
    }
  }
  function updateParts(dt, me) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      if (p.target && me) {   // 동전: 잠깐 튀었다가 나에게 날아옴
        if (p.t > 0.35) { const dx = me.x - p.x, dy = me.y - 30 - p.y, d = Math.hypot(dx, dy); if (d < 14) { p.t = p.life; continue; } const sp = 520 * Math.min(1, (p.t - 0.35) * 3); p.vx = dx / d * sp; p.vy = dy / d * sp; }
      } else { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy = p.vy * k + (p.g || 0) * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.spin || 0) * dt;
      if (p.wave) p.x += Math.sin(p.t * p.wave + p.seed) * 20 * dt;
    }
  }
  function drawParts(ctx, view) {
    let mode = null;
    for (const p of parts) {
      if (view && (p.x < view.x - 40 || p.x > view.x + view.w + 40 || p.y < view.y - 60 || p.y > view.y + view.h + 60)) continue;
      const k = p.t / p.life, a = p.fade === false ? 1 : 1 - k * k, s = p.size * (1 + (p.grow || 0) * k);
      const m = p.add ? 'lighter' : 'source-over'; if (m !== mode) { ctx.globalCompositeOperation = m; mode = m; }
      ctx.globalAlpha = clamp(a, 0, 1);
      switch (p.shape) {
        case 'glow': { const g = glow(p.color, s * 2); ctx.drawImage(g, p.x - g.width / 2, p.y - g.height / 2); break; }
        case 'spark': { ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.5); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke(); break; }
        case 'ring': { ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.stroke(); break; }
        case 'star': { ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s, -s / 4, s * 2, s / 2); ctx.fillRect(-s / 4, -s, s / 2, s * 2); ctx.restore(); break; }
        case 'rock': { ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s / 2, -s / 2, s, s * 0.8); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-s / 2, s * 0.1, s, s * 0.2); ctx.restore(); break; }
        case 'leaf': { ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s / 2, -s / 4, s, s / 2); ctx.restore(); break; }
        case 'coin': { const w = Math.abs(Math.cos(p.t * 12)) * 5 + 1; ctx.fillStyle = '#8A5A10'; ctx.fillRect(p.x - w / 2 - 1, p.y - 4, w + 2, 8); ctx.fillStyle = '#FFD23F'; ctx.fillRect(p.x - w / 2, p.y - 3, w, 6); ctx.fillStyle = '#FFF6C2'; ctx.fillRect(p.x - w / 2, p.y - 3, Math.max(1, w / 3), 2); break; }
        case 'drop': { ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - s, 2, s); break; }
        default: ctx.fillStyle = p.color; ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  /* ================= 효과 (모양이 있는 것) ================= */
  const fxs = [];   // { t, dur, draw(ctx, k, now), update(dt), under(바닥에 그림) }
  const add = f => { f.t = f.t || 0; fxs.push(f); return f; };
  function updateFx(dt) { for (let i = fxs.length - 1; i >= 0; i--) { const f = fxs[i]; f.t += dt; if (f.update) f.update(dt, f); if (f.t >= f.dur) fxs.splice(i, 1); } }
  function drawFx(ctx, under, now) {
    for (const f of fxs) {
      if (!!f.under !== under || f.t < 0) continue;
      ctx.save(); f.draw(ctx, clamp(f.t / f.dur, 0, 1), now, f); ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // 마법진 (쓸 때 발밑)
  function castCircle(x, y, els, big) {
    const P = pal(els[0]), P2 = pal(els[els.length - 1]), r = big ? 46 : 34;
    add({ dur: 0.55, under: true, draw(c, k, now) {
      const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.9; c.translate(x, y); c.scale(1, 0.45); c.rotate(now / 300);
      c.strokeStyle = P[2]; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
      c.strokeStyle = P2[1]; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, r * 0.72, 0, TAU); c.stroke();
      for (let i = 0; i < 6; i++) { const a2 = i * TAU / 6; c.fillStyle = i % 2 ? P[1] : P2[2]; c.fillRect(Math.cos(a2) * r * 0.86 - 3, Math.sin(a2) * r * 0.86 - 3, 6, 6); }
      c.beginPath(); for (let i = 0; i <= 6; i++) { const a2 = i * TAU / 3 * 1; const px = Math.cos(a2) * r * 0.72, py = Math.sin(a2) * r * 0.72; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.strokeStyle = P[1]; c.lineWidth = 1.5; c.stroke();
    } });
    burst(x, y - 10, big ? 18 : 10, P, { min: 20, max: 80, up: -80, lmin: 0.4, lmax: 0.8, shape: 'glow', smin: 2, smax: 4, g: -40 });
  }

  /* ---------- 탄 그리기 (원소마다 다른 모양) ---------- */
  function drawShot(c, s, now) {
    const el = (s.els && s.els[0]) || 'light', P = s.mine ? pal(el) : pal(s.monEl || 'dark'), ang = Math.atan2(s.vy, s.vx), r = s.r;
    const two = s.mine && s.els && s.els.length > 1 && s.els[s.els.length - 1] !== el, P2 = two ? pal(s.els[s.els.length - 1]) : P;   // v146 융합 탄: 두 번째 원소 색도 보이게 (빛의 깃털 · 그림자 칼바람이 바람 칼날과 똑같았음)
    c.save(); c.globalCompositeOperation = 'lighter';
    drawGlow(c, s.x, s.y, r * 3.2, P[3], 0.55); if (two) drawGlow(c, s.x, s.y, r * 2.2, P2[2], 0.6);
    c.translate(s.x, s.y); c.rotate(ang);
    const SS = s.sid && SFX[s.sid]; if (SS && SS.shot) { SS.shot(c, s, now); c.restore(); return; }   // v102 마법마다 다른 탄
    if (!s.mine) { c.fillStyle = P[2]; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.fillStyle = P[0]; c.beginPath(); c.arc(0, 0, r * 0.45, 0, TAU); c.fill(); }
    else if (el === 'fire') {   // 불덩이: 뒤로 늘어진 불꽃
      for (let i = 4; i >= 0; i--) { c.fillStyle = P[Math.min(4, i)]; c.beginPath(); c.ellipse(-i * r * 0.55, 0, r * (1.3 - i * 0.18), r * (1 - i * 0.15), 0, 0, TAU); c.fill(); }
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(r * 0.2, 0, r * 0.4, 0, TAU); c.fill();
    } else if (el === 'water') {   // 물방울: 앞이 둥근 물줄기
      c.fillStyle = P[3]; c.beginPath(); c.moveTo(-r * 2.4, 0); c.quadraticCurveTo(-r * 0.6, -r * 1.1, r, 0); c.quadraticCurveTo(-r * 0.6, r * 1.1, -r * 2.4, 0); c.fill();
      c.fillStyle = P[2]; c.beginPath(); c.arc(0, 0, r * 0.85, 0, TAU); c.fill(); c.fillStyle = P[0]; c.fillRect(-r * 0.3, -r * 0.5, r * 0.5, r * 0.3);
    } else if (el === 'wind') {   // 바람 칼날: 도는 초승달
      c.rotate(now / 50); if (two) c.globalCompositeOperation = 'source-over'; c.strokeStyle = two ? P2[1] : P[1]; c.lineWidth = r * 0.5; c.beginPath(); c.arc(0, 0, r * 1.3, -1.2, 1.2); c.stroke(); c.strokeStyle = two ? P[1] : P[3]; c.lineWidth = r * 0.25; c.beginPath(); c.arc(0, 0, r * 1.7, -0.9, 0.9); c.stroke();
    } else if (el === 'earth') {   // 바위 조각
      c.rotate(now / 90); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#1D2340'; c.fillRect(-r - 1, -r - 1, r * 2 + 2, r * 2 + 2); c.fillStyle = P[2]; c.fillRect(-r, -r, r * 2, r * 2); c.fillStyle = P[1]; c.fillRect(-r, -r, r, r * 0.6); c.fillStyle = P[3]; c.fillRect(0, r * 0.3, r, r * 0.7);
    } else if (el === 'thunder') {   // 번개 구슬 + 튀는 전기
      c.fillStyle = P[2]; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.fill();
      c.rotate(-ang); strokeBolt(c, boltPath(0, 0, rand(-r * 3, r * 3), rand(-r * 3, r * 3), 4, 3), P, 1.2);
    } else {   // 빛: 반짝이는 별
      c.rotate(now / 120); c.fillStyle = P[2]; c.fillRect(-r * 2, -r * 0.3, r * 4, r * 0.6); c.fillRect(-r * 0.3, -r * 2, r * 0.6, r * 4); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, 0, r * 0.7, 0, TAU); c.fill();
    }
    c.restore();
  }
  // 날아가는 동안 꼬리 입자
  function trail(s, dt) {
    if (Math.random() > dt * 60) return;
    const ST = s.sid && SFX[s.sid]; if (ST && ST.trail) { ST.trail(s, dt); return; }
    const el = (s.els && s.els[0]) || 'light', P = s.mine ? (s.els && s.els.length > 1 && Math.random() < 0.5 ? pal(s.els[s.els.length - 1]) : pal(el)) : pal('dark');   // v146 융합 탄 꼬리는 두 원소 색을 섞음
    const shape = el === 'fire' ? 'glow' : el === 'earth' ? 'rock' : el === 'water' ? 'sq' : el === 'thunder' ? 'spark' : el === 'wind' ? 'leaf' : 'star';
    emit({ x: s.x + rand(-3, 3), y: s.y + rand(-3, 3), vx: -s.vx * 0.15 + rand(-30, 30), vy: -s.vy * 0.15 + rand(-30, 30) + (el === 'fire' ? -40 : 0), life: rand(0.25, 0.5), size: rand(2, el === 'fire' ? 6 : 4), color: P[Math.floor(rand(0, 4))], shape, add: el !== 'earth', g: el === 'earth' || el === 'water' ? 300 : 0, spin: rand(-10, 10) });
  }

  /* ---------- 맞음 · 사라짐 · 레벨 업 ---------- */
  function hit(x, y, els, crit) {
    const el = (els && els[0]) || null, P = el ? pal(el) : ['#FFFFFF', '#FFF6C2', '#FFD23F', '#FF9A3D'];
    burst(x, y, crit ? 16 : 8, P, { min: 80, max: crit ? 320 : 220, lmin: 0.15, lmax: 0.35, shape: 'spark', smin: 2, smax: 4, drag: 4 });
    add({ dur: 0.18, draw(c, k) { c.globalCompositeOperation = 'lighter'; drawGlow(c, x, y, (crit ? 40 : 26) * (1 - k * 0.5), P[1], 1 - k); c.strokeStyle = P[0]; c.globalAlpha = 1 - k; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 8 + k * (crit ? 30 : 18), 0, TAU); c.stroke(); } });
    if (el === 'fire') burst(x, y, 5, P, { min: 20, max: 80, up: -60, g: -60, shape: 'glow', lmin: 0.3, lmax: 0.6 });
    if (el === 'water') burst(x, y, 6, P, { min: 60, max: 160, up: -120, g: 500, shape: 'drop', add: false, lmin: 0.3, lmax: 0.5, smin: 3, smax: 6 });
    if (el === 'earth') burst(x, y, 5, P, { min: 60, max: 160, up: -140, g: 600, shape: 'rock', add: false, lmin: 0.4, lmax: 0.7, smin: 3, smax: 6 });
  }
  function death(x, y, colors, big) {
    const P = [colors.c || '#FFFFFF', colors.a, colors.b, colors.d || '#FFFFFF'];
    burst(x, y, big ? 60 : 22, P, { min: 60, max: big ? 380 : 220, lmin: 0.4, lmax: big ? 1.4 : 0.8, shape: 'sq', add: false, smin: 3, smax: big ? 9 : 6, g: 200, up: -100 });
    burst(x, y, big ? 30 : 10, ['#FFFFFF', '#FFF6C2'], { min: 30, max: 140, lmin: 0.3, lmax: 0.7, shape: 'glow', smin: 3, smax: 6 });
    add({ dur: big ? 0.7 : 0.4, draw(c, k) { c.globalCompositeOperation = 'lighter'; drawGlow(c, x, y, (big ? 140 : 60) * (0.5 + k), '#FFFFFF', (1 - k) * 0.8); c.strokeStyle = colors.a; c.globalAlpha = 1 - k; c.lineWidth = 4 * (1 - k) + 1; c.beginPath(); c.ellipse(x, y + 10, (big ? 120 : 50) * k, (big ? 60 : 24) * k, 0, 0, TAU); c.stroke(); } });
  }
  function coins(x, y, n) { for (let i = 0; i < n; i++) emit({ x, y, vx: rand(-140, 140), vy: rand(-260, -120), g: 700, drag: 1, life: 1.6, size: 4, shape: 'coin', add: false, target: true, fade: false }); }
  function levelUp(x, y) {
    const P = PAL.light;
    add({ dur: 1.4, draw(c, k) {
      c.globalCompositeOperation = 'lighter'; const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, w = 46 * (1 - k * 0.5);
      const g = c.createLinearGradient(0, y - 420, 0, y); g.addColorStop(0, 'rgba(255,240,160,0)'); g.addColorStop(1, 'rgba(255,240,160,' + (0.75 * a) + ')');
      c.fillStyle = g; c.fillRect(x - w, y - 420, w * 2, 420); c.fillStyle = 'rgba(255,255,255,' + (0.8 * a) + ')'; c.fillRect(x - w * 0.25, y - 420, w * 0.5, 420);
      drawGlow(c, x, y - 10, 90, '#FFE45C', a);
    } });
    for (let i = 0; i < 40; i++) emit({ x: x + rand(-40, 40), y: y + rand(-10, 10), vx: rand(-20, 20), vy: rand(-260, -80), g: -40, life: rand(0.8, 1.5), size: rand(3, 6), color: P[Math.floor(rand(0, 4))], shape: i % 3 ? 'glow' : 'star', add: true, spin: 6 });
    add({ dur: 0.8, under: true, draw(c, k) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; c.strokeStyle = '#FFE45C'; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, 30 + k * 120, (30 + k * 120) * 0.45, 0, 0, TAU); c.stroke(); } });
  }
  function dust(x, y, color) { if (Math.random() < 0.5) emit({ x: x + rand(-8, 8), y: y - 2, vx: rand(-20, 20), vy: rand(-30, -10), g: 0, life: 0.4, size: rand(3, 5), color: color || 'rgba(255,255,255,.5)', shape: 'sq', add: false, grow: 1 }); }
  function heal(x, y, big) {
    if (CUR && SFX[CUR] && SFX[CUR].heal && SFX[CUR].heal(x, y, big)) return;
    const P = ['#FFFFFF', '#C8FFD8', '#3DDC84', '#1E9E5A'];
    for (let i = 0; i < (big ? 36 : 22); i++) emit({ x: x + rand(-26, 26), y: y + rand(-30, 20), vx: rand(-10, 10), vy: rand(-140, -40), g: -20, life: rand(0.7, 1.2), size: rand(3, 6), color: P[Math.floor(rand(0, 3))], shape: i % 4 ? 'glow' : 'star', add: true });
    add({ dur: 0.9, under: true, draw(c, k) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; c.strokeStyle = '#3DDC84'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 26, 40 * (0.6 + k), 18 * (0.6 + k), 0, 0, TAU); c.stroke(); drawGlow(c, x, y, 80, '#3DDC84', (1 - k) * 0.6); } });
    for (let i = 0; i < 5; i++) add({ t: -i * 0.12, dur: 0.8, draw(c, k) { const px = x + Math.sin(i * 2.3) * 22, py = y + 10 - k * 60; c.globalAlpha = 1 - k; c.fillStyle = '#1D2340'; c.fillRect(px - 5, py - 2, 10, 5); c.fillRect(px - 2, py - 5, 5, 11); c.fillStyle = '#7CFFB0'; c.fillRect(px - 4, py - 1, 8, 3); c.fillRect(px - 1, py - 4, 3, 9); } });
  }

  /* ---------- 큰 마법 ---------- */
  function nova(x, y, r, els) {
    if (CUR && SFX[CUR] && SFX[CUR].nova && SFX[CUR].nova(x, y, r, els)) return;
    const el = els[0], P = pal(el), P2 = pal(els[els.length - 1]);
    add({ dur: 0.7, under: true, draw(c, k) {   // 바닥 그을음·충격파
      c.globalAlpha = (1 - k) * 0.5; c.fillStyle = P[4]; c.beginPath(); c.ellipse(x, y + 20, r * 0.9, r * 0.45, 0, 0, TAU); c.fill();
    } });
    add({ dur: 0.55, draw(c, k) {
      c.globalCompositeOperation = 'lighter'; const e = 1 - Math.pow(1 - k, 3), rr = r * (0.2 + 0.85 * e);
      drawGlow(c, x, y, r * 1.2 * (0.6 + e * 0.6), P[3], (1 - k) * 0.7);
      [[10, P[2]], [5, P2[1]], [2, '#FFFFFF']].forEach(([lw, col]) => { c.globalAlpha = 1 - k; c.strokeStyle = col; c.lineWidth = lw * (1 - k) + 1; c.beginPath(); c.ellipse(x, y, rr, rr * 0.62, 0, 0, TAU); c.stroke(); });
      if (el === 'thunder' || els.includes('thunder')) { c.globalAlpha = 1 - k; for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + k; strokeBolt(c, boltPath(x, y, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.62, 10), pal('thunder'), 1.6); } }
      if (el === 'wind' || els.includes('wind')) { c.globalAlpha = 1 - k; c.strokeStyle = PAL.wind[1]; c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(x, y - i * 14 * e, rr * (0.4 + i * 0.12), rr * 0.2, 0, k * 8 + i, k * 8 + i + 4); c.stroke(); } }
    } });
    const n = Math.round(r / 3);
    if (el === 'earth' || els.includes('earth')) spikes(x, y, r, pal('earth'));
    burst(x, y, n, P, { min: r * 1.2, max: r * 3.2, flat: 0.62, lmin: 0.3, lmax: 0.6, shape: el === 'earth' ? 'rock' : el === 'water' ? 'drop' : 'glow', smin: 3, smax: 7, add: el !== 'earth', drag: 3 });
    burst(x, y, Math.round(n / 2), P2, { min: 40, max: 160, up: -120, g: el === 'fire' ? -80 : 200, lmin: 0.4, lmax: 0.9, shape: 'star', smin: 2, smax: 5 });
  }
  function spikes(x, y, r, P) {   // 땅에서 솟는 바위 가시
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12 + rand(-0.2, 0.2), d = r * rand(0.35, 0.95), px = x + Math.cos(a) * d, py = y + 20 + Math.sin(a) * d * 0.5, h = rand(18, 34);
      add({ t: -i * 0.02, dur: 0.6, draw(c, k) {
        const up = k < 0.25 ? k / 0.25 : 1, a2 = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; c.globalAlpha = a2;
        c.fillStyle = '#1D2340'; c.beginPath(); c.moveTo(px - 9, py); c.lineTo(px, py - h * up - 2); c.lineTo(px + 9, py); c.fill();
        c.fillStyle = P[2]; c.beginPath(); c.moveTo(px - 7, py); c.lineTo(px, py - h * up); c.lineTo(px + 7, py); c.fill(); c.fillStyle = P[1]; c.beginPath(); c.moveTo(px - 7, py); c.lineTo(px, py - h * up); c.lineTo(px - 2, py); c.fill();
      } });
    }
  }
  function beam(x, y, dx, dy, len, w, els) {
    if (CUR && SFX[CUR] && SFX[CUR].beam && SFX[CUR].beam(x, y, dx, dy, len, w, els)) return;
    const el = els[0], P = pal(el), P2 = pal(els[els.length - 1]), ang = Math.atan2(dy, dx);
    if (el === 'earth' && els.length === 1) {   // 대지 가르기: 줄지어 솟는 바위
      const n = Math.round(len / 26);
      for (let i = 0; i < n; i++) { const px = x + dx * (i + 1) * 26, py = y + dy * (i + 1) * 26 + 20, h = rand(22, 40); add({ t: -i * 0.03, dur: 0.55, draw(c, k) { const up = k < 0.25 ? k / 0.25 : 1; c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; c.fillStyle = '#1D2340'; c.beginPath(); c.moveTo(px - 11, py); c.lineTo(px, py - h * up - 2); c.lineTo(px + 11, py); c.fill(); c.fillStyle = P[2]; c.beginPath(); c.moveTo(px - 9, py); c.lineTo(px, py - h * up); c.lineTo(px + 9, py); c.fill(); c.fillStyle = P[1]; c.beginPath(); c.moveTo(px - 9, py); c.lineTo(px, py - h * up); c.lineTo(px - 3, py); c.fill(); } }); burst(px, py, 3, P, { min: 40, max: 120, up: -100, g: 500, shape: 'rock', add: false }); }
      return;
    }
    add({ dur: 0.45, draw(c, k, now) {
      c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.rotate(ang);
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, ww = w * (0.6 + 0.4 * Math.sin(now / 30)) * (k < 0.15 ? 0.5 + k * 3 : 1);
      if (el === 'thunder') { c.globalAlpha = a; for (let i = 0; i < 3; i++) strokeBolt(c, boltPath(0, 0, len, rand(-w / 3, w / 3), w * 0.4), P, 2.4 - i * 0.6); }
      else {
        const g = c.createLinearGradient(0, -ww, 0, ww); g.addColorStop(0, P[3] + '00'); g.addColorStop(0.3, P[3]); g.addColorStop(0.5, P[0]); g.addColorStop(0.7, P2[3]); g.addColorStop(1, P2[3] + '00');
        c.globalAlpha = a; c.fillStyle = g; c.fillRect(0, -ww, len, ww * 2);
        c.fillStyle = '#FFFFFF'; c.fillRect(0, -ww * 0.12, len, ww * 0.24);
        if (el === 'water') { c.fillStyle = P[1]; for (let i = 0; i < len; i += 24) c.fillRect(i + (now / 4 % 24), -ww * 0.6 + Math.sin(i + now / 80) * 6, 10, 3); }
      }
      c.rotate(-ang); drawGlow(c, 0, 0, w * 1.6, P[2], a);
    } });
    for (let i = 0; i < len / 10; i++) { const t = Math.random() * len; emit({ x: x + dx * t + rand(-w / 3, w / 3), y: y + dy * t + rand(-w / 3, w / 3), vx: -dy * rand(-80, 80) + dx * 60, vy: dx * rand(-80, 80) + dy * 60, life: rand(0.3, 0.6), size: rand(2, 5), color: P[Math.floor(rand(0, 3))], shape: el === 'thunder' ? 'spark' : 'glow', add: true }); }
  }
  // 하늘에서 떨어지는 것 (화염 비=운석, 낙뢰=번개, 대지의 분노=바위, 대폭포=물기둥, 심판의 빛=빛기둥)
  function fall(x, y, r, els, delay) {
    if (CUR && SFX[CUR] && SFX[CUR].fall && SFX[CUR].fall(x, y, r, els, delay)) return;
    const el = els[0], P = pal(el), P2 = pal(els[els.length - 1]), lead = 0.32;
    add({ t: -delay, dur: lead + 0.45, under: true, draw(c, k) {   // 떨어질 곳 표시
      const tt = k * (lead + 0.45); if (tt > lead) return; c.globalAlpha = 0.25 + tt / lead * 0.4; c.strokeStyle = P[2]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, r * (1 - tt / lead * 0.3), r * 0.5 * (1 - tt / lead * 0.3), 0, 0, TAU); c.stroke();
    } });
    add({ t: -delay, dur: lead + 0.45, draw(c, k) {
      const tt = k * (lead + 0.45);
      c.globalCompositeOperation = 'lighter';
      if (tt < lead) {
        const q = tt / lead, sy = y - 420 * (1 - q), sx = x - 140 * (1 - q) * (el === 'fire' || el === 'earth' ? 1 : 0);
        if (el === 'thunder') { if (q > 0.6) { c.globalAlpha = 1; strokeBolt(c, boltPath(x + rand(-20, 20), y - 420, x, y, 18), P, 3); } }
        else if (el === 'light') { c.globalAlpha = q; const g = c.createLinearGradient(0, y - 420, 0, y); g.addColorStop(0, 'rgba(255,250,200,0)'); g.addColorStop(1, 'rgba(255,250,200,.9)'); c.fillStyle = g; c.fillRect(x - r * 0.35 * q, y - 420, r * 0.7 * q, 420); }
        else if (el === 'water') { c.globalAlpha = 0.85; c.fillStyle = P[2]; c.fillRect(x - 8, sy - 80, 16, 80); c.fillStyle = P[0]; c.fillRect(x - 3, sy - 80, 6, 80); }
        else { const rr = el === 'earth' ? 14 : 12; drawGlow(c, sx, sy, rr * 3.5, P[3], 0.8); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#1D2340'; c.beginPath(); c.arc(sx, sy, rr + 2, 0, TAU); c.fill(); c.fillStyle = P[el === 'earth' ? 2 : 1]; c.beginPath(); c.arc(sx, sy, rr, 0, TAU); c.fill(); c.fillStyle = P[0]; c.beginPath(); c.arc(sx + 3, sy - 3, rr * 0.4, 0, TAU); c.fill(); }
      } else {
        const q = (tt - lead) / 0.45; c.globalAlpha = 1 - q;
        drawGlow(c, x, y, r * 1.6 * (0.6 + q), P[2], 1 - q);
        c.strokeStyle = P2[1]; c.lineWidth = 6 * (1 - q) + 1; c.beginPath(); c.ellipse(x, y, r * (0.4 + q), r * (0.4 + q) * 0.55, 0, 0, TAU); c.stroke();
      }
    }, update(dt, f) {
      if (!f.boom && f.t >= lead) { f.boom = true; burst(x, y, 16, P, { min: 60, max: r * 4, flat: 0.6, lmin: 0.3, lmax: 0.7, shape: el === 'earth' ? 'rock' : el === 'water' ? 'drop' : 'glow', add: el !== 'earth', g: el === 'earth' || el === 'water' ? 400 : -30, up: -100, smin: 3, smax: 7 }); burst(x, y, 6, P2, { min: 40, max: 120, shape: 'star', lmin: 0.4, lmax: 0.7 }); if (Fx.onBoom) Fx.onBoom(r > 70 ? 5 : 3); }
      if (el === 'fire' && !f.boom && Math.random() < 0.6) { const q = f.t / lead; if (q > 0) emit({ x: x - 140 * (1 - q) + rand(-5, 5), y: y - 420 * (1 - q), vx: rand(-20, 20), vy: rand(-40, 0), life: 0.4, size: rand(3, 6), color: P[Math.floor(rand(0, 4))], shape: 'glow', add: true }); }
    } });
  }
  function drawPool(c, p, now) {
    const el = p.els[0], P = pal(el), P2 = pal(p.els[p.els.length - 1]), fade = Math.min(1, (p.dur - p.t) / 0.5, p.t / 0.2);
    c.save(); c.globalAlpha = 0.55 * fade;
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, P[2]); g.addColorStop(0.7, P2[3]); g.addColorStop(1, P2[4] + '00');
    c.fillStyle = g; c.beginPath(); c.ellipse(p.x, p.y, p.r, p.r * 0.55, 0, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * fade; c.strokeStyle = P[1]; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const rr = p.r * ((now / 900 + i / 3) % 1); c.beginPath(); c.ellipse(p.x, p.y, rr, rr * 0.55, 0, 0, TAU); c.stroke(); }
    c.restore();
    if (Math.random() < 0.5) { const a = Math.random() * TAU, d = Math.random() * p.r; emit({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.55, vx: 0, vy: rand(-60, -20), life: 0.6, size: rand(3, 6), color: P[Math.floor(rand(0, 3))], shape: el === 'fire' ? 'glow' : 'ring', add: true, grow: 0.5 }); }
  }
  function drawShield(c, x, y, now, el, left, sid) {
    if (sid && SFX[sid] && SFX[sid].shield && SFX[sid].shield(c, x, y, now, left)) return;
    const P = pal(el), a = left < 1 ? (Math.floor(now / 100) % 2 ? 0.3 : 0.8) : 0.8;
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.35;
    const g = c.createRadialGradient(x, y, 10, x, y, 40); g.addColorStop(0, P[3] + '00'); g.addColorStop(0.8, P[2] + '66'); g.addColorStop(1, P[1]);
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 30, 40, 0, 0, TAU); c.fill();
    c.globalAlpha = a; c.strokeStyle = P[1]; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const t = now / 600 + i * TAU / 6, px = x + Math.cos(t) * 26, py = y + Math.sin(t) * 34; c.beginPath(); for (let j = 0; j <= 6; j++) { const a2 = j * TAU / 6; j ? c.lineTo(px + Math.cos(a2) * 6, py + Math.sin(a2) * 6) : c.moveTo(px + Math.cos(a2) * 6, py + Math.sin(a2) * 6); } c.stroke(); }
    c.beginPath(); c.ellipse(x, y, 30, 40, 0, 0, TAU); c.stroke(); c.restore();
  }
  // v146 방향을 돌려 그릴 때 왼쪽(또는 바로 위)으로 쓰면 그림이 뒤집혀 보이던 것 → 위아래를 다시 뒤집어 '위쪽'이 늘 화면 위쪽이 되게
  function upright(c, ang) { const cs = Math.cos(ang); if (cs < -1e-6 || (Math.abs(cs) <= 1e-6 && Math.sin(ang) < 0)) c.scale(1, -1); }
  function slash(x, y, dx, dy, staff) {
    const ang = Math.atan2(dy, dx), col = staff ? PAL.dark : ['#FFFFFF', '#E8EEFF', '#B8C4FF', '#6A7AD0'];
    add({ dur: 0.18, draw(c, k) {
      c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.rotate(ang); upright(c, ang); const a0 = -1.3 + k * 1.6;   // v146 왼쪽 공격도 위→아래로 휘두름
      [[44, 10, col[2]], [44, 4, col[0]]].forEach(([r, lw, cc]) => { c.globalAlpha = 1 - k; c.strokeStyle = cc; c.lineWidth = lw; c.beginPath(); c.arc(0, 0, r, a0, a0 + 1.6); c.stroke(); });
    } });
  }
  function afterimage(img, x, y, w, h, flip, color) {
    add({ dur: 0.28, draw(c, k) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - k) * 0.45; if (flip) { c.translate(x + w, y); c.scale(-1, 1); } else c.translate(x, y); c.drawImage(img, 0, 0, w, h); } });
    if (Math.random() < 0.6) emit({ x: x + w / 2 + rand(-8, 8), y: y + h * rand(0.3, 0.9), vx: rand(-30, 30), vy: rand(-30, 30), life: 0.4, size: rand(3, 5), color, shape: 'glow', add: true });
  }
  function slamWarn(c, x, y, r, k, now) {
    c.save(); c.globalAlpha = 0.25 + k * 0.4; c.fillStyle = '#FF3D4A'; c.beginPath(); c.ellipse(x, y, r * k, r * k * 0.6, 0, 0, TAU); c.fill();
    c.globalAlpha = 0.9; c.strokeStyle = Math.floor(now / 80) % 2 ? '#FFD23F' : '#FF3D4A'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0, 0, TAU); c.stroke(); c.restore();
  }

  /* ================= 지역 분위기 ================= */
  // 지역 번호(0~8)마다: 날씨 입자 · 색 덧칠 · 안개 · 어둠
  const AMB = [
    { tint: 'rgba(255,240,200,.06)', bits: 'petal', rate: 3, cols: ['#FFFFFF', '#FFE45C', '#FFB3D1'] },
    { tint: 'rgba(40,120,60,.10)', bits: 'firefly', rate: 5, cols: ['#E8FF8A', '#B8FF6A'], rays: true },
    { tint: 'rgba(40,60,40,.22)', bits: 'firefly', rate: 6, cols: ['#9AFFD8', '#C8FF8A'], fog: 'rgba(220,235,220,' },
    { tint: 'rgba(255,190,90,.10)', bits: 'sand', rate: 10, cols: ['#F5E2A8', '#E8C878'], haze: true },
    { tint: 'rgba(120,100,80,.08)', bits: 'dust', rate: 4, cols: ['#E8E0C8', '#C8B898'] },
    { tint: 'rgba(160,200,255,.12)', bits: 'snow', rate: 22, cols: ['#FFFFFF', '#E8F4FF'] },
    { tint: 'rgba(60,30,120,.10)', bits: 'sparkle', rate: 8, cols: ['#C8A8FF', '#7FE0F0', '#FF9AE0'], dark: 0.62 },
    { tint: 'rgba(200,230,255,.08)', bits: 'petal', rate: 8, cols: ['#FFB3D1', '#FFD8E8', '#FFFFFF'], clouds: true },
    { tint: 'rgba(255,60,20,.12)', bits: 'ember', rate: 14, cols: ['#FFB13D', '#FF6A3D', '#FFE45C'], haze: true, dark: 0.25 }
  ];
  const amb = [];    // 화면 좌표 입자 (날씨)
  let ambT = 0;
  function ambient(region, dt, W, H, cam) {
    const A = AMB[region] || AMB[0]; ambT += dt;
    const want = A.rate * dt; let n = Math.floor(want) + (Math.random() < want % 1 ? 1 : 0);
    while (n-- > 0 && amb.length < 220) {
      const p = { t: 0, x: rand(-20, W + 20), y: rand(-20, H), cx: cam.x, cy: cam.y, seed: Math.random() * 10, col: A.cols[Math.floor(Math.random() * A.cols.length)], kind: A.bits };
      if (A.bits === 'snow') { p.y = -10; p.vy = rand(30, 70); p.vx = rand(-15, 5); p.life = 12; p.s = rand(2, 4); }
      else if (A.bits === 'petal') { p.y = -10; p.vy = rand(25, 50); p.vx = rand(10, 40); p.life = 14; p.s = rand(3, 5); }
      else if (A.bits === 'ember') { p.y = H + 10; p.vy = rand(-70, -30); p.vx = rand(-15, 15); p.life = 8; p.s = rand(2, 4); }
      else if (A.bits === 'sand') { p.x = -10; p.vx = rand(60, 140); p.vy = rand(-5, 10); p.life = 10; p.s = rand(1, 3); }
      else if (A.bits === 'firefly' || A.bits === 'sparkle') { p.vx = rand(-10, 10); p.vy = rand(-10, 10); p.life = rand(3, 6); p.s = rand(2, 3); }
      else { p.vx = rand(-8, 8); p.vy = rand(-6, 6); p.life = 5; p.s = rand(2, 3); }
      amb.push(p);
    }
    for (let i = amb.length - 1; i >= 0; i--) {
      const p = amb[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'snow' || p.kind === 'petal') p.x += Math.sin(p.t * 1.5 + p.seed) * 18 * dt;
      if (p.t > p.life || p.y > H + 30 || p.y < -40 || p.x > W + 40) amb.splice(i, 1);
    }
  }
  function drawAmbient(ctx, region, W, H, cam, now, lights) {
    const A = AMB[region] || AMB[0];
    ctx.save();
    if (A.rays) {   // 숲: 비스듬한 햇살
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) { const x0 = ((i * 300 - cam.x * 0.3 + now / 60) % (W + 400)) - 200; ctx.globalAlpha = 0.06 + 0.03 * Math.sin(now / 900 + i); ctx.fillStyle = '#FFF6C2'; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 80, 0); ctx.lineTo(x0 - 120, H); ctx.lineTo(x0 - 220, H); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (A.clouds) {   // 하늘섬: 지나가는 구름 그림자
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#5A6A9A';
      for (let i = 0; i < 3; i++) { const x0 = ((i * 420 - cam.x * 0.6 + now / 25) % (W + 500)) - 250, y0 = 80 + i * 170 - (cam.y * 0.6) % 200; ctx.beginPath(); ctx.ellipse(x0, y0, 160, 60, 0, 0, TAU); ctx.ellipse(x0 + 90, y0 + 20, 110, 50, 0, 0, TAU); ctx.fill(); }
    }
    if (A.fog) {   // 늪: 흘러가는 안개
      for (let i = 0; i < 5; i++) { const x0 = ((i * 260 - cam.x * 0.5 + now / 40) % (W + 600)) - 300, y0 = (i * 130 + 60 - cam.y * 0.5) % (H + 100); const g = glow('#E8F0E8', 180); ctx.globalAlpha = 0.18; ctx.drawImage(g, x0 - 180, y0 - 90, 360, 180); }
    }
    ctx.globalAlpha = 1; ctx.fillStyle = A.tint; ctx.fillRect(0, 0, W, H);
    // 날씨 입자
    ctx.globalCompositeOperation = A.bits === 'firefly' || A.bits === 'sparkle' || A.bits === 'ember' ? 'lighter' : 'source-over';
    for (const p of amb) {
      const x = p.x - (cam.x - p.cx) * 0.6, y = p.y - (cam.y - p.cy) * 0.6, k = p.t / p.life, a = Math.min(1, p.t * 2, (1 - k) * 3);
      if (p.kind === 'firefly' || p.kind === 'sparkle') { ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(now / 200 + p.seed * 5)); const g = glow(p.col, 10); ctx.drawImage(g, x - 10, y - 10); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1, y - 1, 2, 2); }
      else if (p.kind === 'ember') { ctx.globalAlpha = a; const g = glow(p.col, 8); ctx.drawImage(g, x - 8, y - 8); ctx.fillStyle = p.col; ctx.fillRect(x - 1, y - 1, p.s, p.s); }
      else if (p.kind === 'petal') { ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.save(); ctx.translate(x, y); ctx.rotate(p.t * 2 + p.seed); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
      else { ctx.globalAlpha = a * 0.85; ctx.fillStyle = p.col; ctx.fillRect(x, y, p.s, p.s); }
    }
    ctx.restore();
    // 어둠 (수정 동굴·불꽃왕성): 내 주변과 빛나는 것들 둘레만 밝게
    if (A.dark) {
      const [dc, dx] = darkCanvas(W, H);
      dx.globalCompositeOperation = 'source-over'; dx.clearRect(0, 0, W, H); dx.fillStyle = region === 8 ? 'rgba(40,8,8,' + A.dark + ')' : 'rgba(12,6,30,' + A.dark + ')'; dx.fillRect(0, 0, W, H);
      dx.globalCompositeOperation = 'destination-out';
      lights.forEach(l => { const g = glow('#FFFFFF', l.r); dx.globalAlpha = l.a == null ? 1 : l.a; dx.drawImage(g, l.x - g.width / 2, l.y - g.height / 2); });
      dx.globalAlpha = 1; ctx.drawImage(dc, 0, 0);
      // 빛 색 번짐
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      lights.forEach(l => { if (l.col) drawGlow(ctx, l.x, l.y, l.r * 0.6, l.col, 0.18); });
      ctx.restore();
    }
    if (A.haze) { ctx.save(); ctx.globalAlpha = 0.05 + 0.03 * Math.sin(now / 500); ctx.fillStyle = region === 8 ? '#FF6A3D' : '#FFE0A0'; ctx.fillRect(0, H * 0.6, W, H * 0.4); ctx.restore(); }
    // 가장자리 어둡게 (모든 지역)
    ctx.drawImage(vignette(W, H), 0, 0);
  }
  let darkC = null; const darkCanvas = (W, H) => (darkC && darkC[0].width === W ? darkC : (darkC = mk(W, H)));
  let vigC = null;
  function vignette(W, H) {
    if (vigC && vigC.width === W) return vigC;
    const [c, x] = mk(W, H), g = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(10,14,36,0)'); g.addColorStop(1, 'rgba(10,14,36,.45)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    return (vigC = c);
  }

  /* ================= 마법 아이콘 (창·마법 칸) ================= */
  const iconC = {};
  // v101 기본 마법 30종 = 선생님이 주신 그림 (img/ic_skill.png · 34px 칸 30개, 배우는 레벨 순). 융합 마법은 그대로 코드 그림
  const SK_IMG = new Image(), SK_ORDER = ['magicarrow', 'fireball', 'watershot', 'heal1', 'darkorb', 'stonewall', 'windblade', 'firering', 'thunderarrow', 'earthsplit', 'tornado', 'lightspear', 'cursefog', 'firerain', 'tidal', 'chainbolt', 'gale', 'holylight', 'thunderfall', 'quake', 'shadowspear', 'stormblade', 'barrier', 'waterfall', 'sunburst', 'thorspear', 'abyss', 'earthrage', 'judgement', 'elemental'];
  SK_IMG.src = 'games/action/rpg/img/ic_skill.png?v=101';
  // v101 융합 마법 21가지(원소 짝) = 선생님이 주신 그림 (img/ic_fusion.png · 48px 칸 21개, 원소 영문 이름을 알파벳 순으로 붙인 짝)
  const FU_IMG = new Image(), FU_ORDER = ['fire+water', 'fire+wind', 'earth+fire', 'fire+thunder', 'fire+light', 'water+wind', 'earth+water', 'thunder+water', 'light+water', 'earth+wind', 'thunder+wind', 'light+wind', 'earth+thunder', 'earth+light', 'light+thunder', 'dark+fire', 'dark+water', 'dark+wind', 'dark+earth', 'dark+thunder', 'dark+light'];
  FU_IMG.src = 'games/action/rpg/img/ic_fusion.png?v=101';
  function icon(sk, size) {
    size = size || 40;
    const fi = sk.fusion && sk.els && sk.els.length === 2 && FU_IMG.complete && FU_IMG.naturalWidth ? FU_ORDER.indexOf(sk.els.slice().sort().join('+')) : -1;
    const si = !sk.fusion && SK_IMG.complete && SK_IMG.naturalWidth ? SK_ORDER.indexOf(sk.id) : -1, key = sk.id + size + (si >= 0 || fi >= 0 ? 'i' : '');
    if (iconC[key]) return iconC[key];
    if (fi >= 0) { const [c, x] = mk(size, size); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(FU_IMG, fi * 48, 0, 48, 48, 0, 0, size, size); return (iconC[key] = c); }
    if (si >= 0) { const [c, x] = mk(size, size); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(SK_IMG, si * 34, 0, 34, 34, 0, 0, size, size); return (iconC[key] = c); }
    const [c, x] = mk(size, size), s = size / 40, P = pal(sk.els[0]), P2 = pal(sk.els[sk.els.length - 1]);
    x.scale(s, s);
    const g = x.createLinearGradient(0, 0, 40, 40); g.addColorStop(0, P[3]); g.addColorStop(1, P2[4]);
    x.fillStyle = '#0A0E24'; x.fillRect(0, 0, 40, 40); x.fillStyle = g; x.fillRect(2, 2, 36, 36);
    x.globalCompositeOperation = 'lighter'; x.drawImage(glow(P[1], 20), 0, 0, 40, 40); x.globalCompositeOperation = 'source-over';
    // 원소 문양
    const el = sk.els[0], O = '#1D2340';
    const sym = (e, cx, cy, k) => {
      x.save(); x.translate(cx, cy); x.scale(k, k);
      if (e === 'fire') { x.fillStyle = O; x.beginPath(); x.moveTo(0, -13); x.quadraticCurveTo(11, -2, 8, 7); x.quadraticCurveTo(4, 13, 0, 13); x.quadraticCurveTo(-4, 13, -8, 7); x.quadraticCurveTo(-11, -2, 0, -13); x.fill(); x.fillStyle = PAL.fire[2]; x.beginPath(); x.moveTo(0, -10); x.quadraticCurveTo(9, -1, 6, 6); x.quadraticCurveTo(3, 11, 0, 11); x.quadraticCurveTo(-3, 11, -6, 6); x.quadraticCurveTo(-9, -1, 0, -10); x.fill(); x.fillStyle = PAL.fire[1]; x.beginPath(); x.moveTo(0, -2); x.quadraticCurveTo(5, 4, 3, 8); x.lineTo(-3, 8); x.quadraticCurveTo(-5, 4, 0, -2); x.fill(); }
      else if (e === 'water') { x.fillStyle = O; x.beginPath(); x.moveTo(0, -13); x.quadraticCurveTo(11, 3, 0, 12); x.quadraticCurveTo(-11, 3, 0, -13); x.fill(); x.fillStyle = PAL.water[2]; x.beginPath(); x.moveTo(0, -10); x.quadraticCurveTo(8, 3, 0, 10); x.quadraticCurveTo(-8, 3, 0, -10); x.fill(); x.fillStyle = '#FFFFFF'; x.fillRect(-4, 0, 2, 5); }
      else if (e === 'wind') { x.strokeStyle = O; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 9, 0.5, 5.2); x.stroke(); x.strokeStyle = PAL.wind[1]; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 9, 0.5, 5.2); x.stroke(); x.beginPath(); x.arc(0, 0, 4, 2, 6.5); x.stroke(); }
      else if (e === 'earth') { x.fillStyle = O; x.beginPath(); x.moveTo(-12, 10); x.lineTo(-5, -8); x.lineTo(1, 0); x.lineTo(5, -12); x.lineTo(12, 10); x.fill(); x.fillStyle = PAL.earth[2]; x.beginPath(); x.moveTo(-9, 8); x.lineTo(-5, -4); x.lineTo(1, 3); x.lineTo(5, -8); x.lineTo(9, 8); x.fill(); x.fillStyle = PAL.earth[1]; x.fillRect(3, -6, 2, 8); }
      else if (e === 'thunder') { x.fillStyle = O; x.beginPath(); x.moveTo(3, -14); x.lineTo(-9, 2); x.lineTo(-1, 2); x.lineTo(-4, 14); x.lineTo(9, -3); x.lineTo(1, -3); x.closePath(); x.fill(); x.fillStyle = PAL.thunder[2]; x.beginPath(); x.moveTo(2, -10); x.lineTo(-6, 0); x.lineTo(0, 0); x.lineTo(-2, 9); x.lineTo(6, -1); x.lineTo(0, -1); x.closePath(); x.fill(); }
      else if (e === 'dark') { x.fillStyle = O; x.beginPath(); x.arc(0, 0, 13, 0, TAU); x.fill(); x.fillStyle = PAL.dark[1]; x.beginPath(); x.arc(0, 0, 10, 0, TAU); x.fill(); x.fillStyle = O; x.beginPath(); x.arc(5, -4, 9, 0, TAU); x.fill(); x.fillStyle = PAL.dark[0]; x.fillRect(-7, 3, 2, 2); }   // v87 어둠 = 초승달
      else { x.fillStyle = O; x.fillRect(-2, -13, 4, 26); x.fillRect(-13, -2, 26, 4); x.fillStyle = PAL.light[2]; x.fillRect(-1, -11, 2, 22); x.fillRect(-11, -1, 22, 2); x.beginPath(); x.arc(0, 0, 5, 0, TAU); x.fillStyle = '#FFFFFF'; x.fill(); }
      x.restore();
    };
    if (sk.els.length > 1) { sym(sk.els[0], 14, 15, 0.85); sym(sk.els[1], 26, 25, 0.85); }
    else sym(el, 20, 20, 1.1);
    // 종류 표시 (작은 모서리 그림)
    x.fillStyle = 'rgba(10,14,36,.75)'; x.fillRect(27, 27, 12, 12); x.fillStyle = '#FFFFFF';
    const k = sk.kind;
    if (k === 'bolt') { x.fillRect(29, 32, 6, 2); x.fillRect(34, 31, 2, 4); }
    else if (k === 'nova') { x.strokeStyle = '#FFFFFF'; x.lineWidth = 1.5; x.beginPath(); x.arc(33, 33, 4, 0, TAU); x.stroke(); }
    else if (k === 'beam') x.fillRect(28, 32, 10, 2);
    else if (k === 'rain') { x.fillRect(29, 29, 2, 5); x.fillRect(33, 31, 2, 5); x.fillRect(36, 29, 1, 4); }
    else if (k === 'pool') x.fillRect(28, 34, 10, 3);
    else if (k === 'dash') { x.fillRect(28, 31, 4, 2); x.fillRect(31, 33, 5, 2); }
    else if (k === 'heal') { x.fillRect(32, 29, 2, 8); x.fillRect(29, 32, 8, 2); }
    else if (k === 'shield') { x.fillRect(29, 29, 8, 5); x.fillRect(30, 34, 6, 2); x.fillRect(32, 36, 2, 1); }
    if (sk.fusion) { x.fillStyle = '#FFD23F'; x.fillRect(2, 2, 8, 3); x.fillRect(2, 2, 3, 8); }
    x.strokeStyle = sk.fusion ? '#FFD23F' : 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.strokeRect(1, 1, 38, 38);
    return (iconC[key] = c);
  }
  const iconURL = (sk, size) => { const c = icon(sk, size || 40); return c._url || (c._url = c.toDataURL()); };

  /* ================= v102 기본 마법마다 다른 효과 (선생님 사진처럼) =================
   *  game.js 가 마법을 쓸 때 Fx.use(마법 id) 를 부르고, 탄에는 s.sid 를 붙임.
   *  SFX[id] 의 shot(탄 모양) · trail(꼬리) · hit(맞을 때) · nova/beam/heal/fall(큰 마법) · shieldCast/shield(보호막) 이 있으면 그것을 씀.
   *  느린 컴퓨터를 위해 효과·입자가 많으면(busy) 덜 그림 */
  let CUR = null;
  const use = id => { CUR = id || null; };
  const busy = () => fxs.length > 60 || parts.length > 600;
  const SFX = {
    // 1. 마법 화살: 금빛 화살 + 긴 빛줄기, 맞으면 금빛 빛살이 퍼짐
    magicarrow: {
      shot(c) {
        const P = PAL.light, L = 52;
        const g = c.createLinearGradient(-L, 0, 8, 0); g.addColorStop(0, 'rgba(255,210,63,0)'); g.addColorStop(0.7, 'rgba(255,224,110,.75)'); g.addColorStop(1, P[1]);
        c.fillStyle = g; c.beginPath(); c.moveTo(-L, 0); c.lineTo(6, -4); c.lineTo(6, 4); c.closePath(); c.fill();
        c.fillStyle = '#FFFFFF'; c.fillRect(-L * 0.55, -1, L * 0.55 + 8, 2);
        c.fillStyle = P[3]; c.beginPath(); c.moveTo(-L * 0.5, 0); c.lineTo(-L * 0.68, -7); c.lineTo(-L * 0.56, 0); c.lineTo(-L * 0.68, 7); c.fill();
        c.fillStyle = P[3]; c.beginPath(); c.moveTo(18, 0); c.lineTo(4, -8); c.lineTo(8, 0); c.lineTo(4, 8); c.closePath(); c.fill();
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(15, 0); c.lineTo(7, -4); c.lineTo(9, 0); c.lineTo(7, 4); c.fill();
      },
      trail(s) { if (busy() || Math.random() < 0.4) return; emit({ x: s.x + rand(-4, 4), y: s.y + rand(-4, 4), vx: -s.vx * 0.1, vy: -s.vy * 0.1 + rand(-20, 20), life: rand(0.2, 0.4), size: rand(2, 4), color: PAL.light[Math.floor(rand(1, 4))], shape: 'star', add: true }); },
      hit(x, y, s) {
        const ang = Math.atan2(s.vy, s.vx);
        add({ dur: 0.35, draw(c, k) {
          c.globalCompositeOperation = 'lighter'; c.translate(x, y); drawGlow(c, 0, 0, 40 * (1 - k * 0.4), PAL.light[3], 1 - k);
          c.rotate(ang); c.globalAlpha = 1 - k;
          for (let i = -3; i <= 3; i++) { const a = i * 0.28, L = (34 + (3 - Math.abs(i)) * 10) * (0.4 + k * 0.8); c.save(); c.rotate(a); const g = c.createLinearGradient(0, 0, L, 0); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, 'rgba(255,210,63,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, -3); c.lineTo(L, 0); c.lineTo(0, 3); c.fill(); c.restore(); }
        } });
        burst(x, y, busy() ? 4 : 10, PAL.light, { min: 60, max: 200, lmin: 0.2, lmax: 0.4, shape: 'star', smin: 2, smax: 4 });
      }
    },
    // 2. 파이어볼: 꼬리가 긴 불덩이(혜성), 맞으면 불꽃 폭발
    fireball: {
      shot(c, s, now) {
        const P = PAL.fire, L = 58, f = Math.sin(now / 40) * 2;
        const g = c.createLinearGradient(-L, 0, 0, 0); g.addColorStop(0, 'rgba(232,64,42,0)'); g.addColorStop(0.5, 'rgba(255,154,61,.8)'); g.addColorStop(1, P[1]);
        c.fillStyle = g; c.beginPath(); c.moveTo(-L, f); c.quadraticCurveTo(-L * 0.4, -14, 4, -12); c.lineTo(4, 12); c.quadraticCurveTo(-L * 0.4, 14, -L, -f); c.closePath(); c.fill();
        for (let i = 0; i < 4; i++) { const t = (now / 90 + i / 4) % 1; c.fillStyle = P[1 + (i % 3)]; c.globalAlpha = 1 - t; c.beginPath(); c.ellipse(-t * L * 0.8, Math.sin(i * 2 + now / 60) * 6 * t, 9 * (1 - t) + 2, 6 * (1 - t) + 2, 0, 0, TAU); c.fill(); }
        c.globalAlpha = 1; drawGlow(c, 0, 0, 30, P[2], 0.9);
        c.fillStyle = P[3]; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill(); c.fillStyle = P[2]; c.beginPath(); c.arc(1, 0, 9, 0, TAU); c.fill(); c.fillStyle = P[1]; c.beginPath(); c.arc(2, -1, 6, 0, TAU); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(3, -2, 3, 0, TAU); c.fill();
      },
      trail(s) { if (busy()) return; for (let i = 0; i < 2; i++) emit({ x: s.x + rand(-6, 6), y: s.y + rand(-6, 6), vx: -s.vx * 0.2 + rand(-30, 30), vy: -s.vy * 0.2 + rand(-60, -10), life: rand(0.25, 0.5), size: rand(4, 8), color: PAL.fire[Math.floor(rand(1, 4))], shape: 'glow', add: true, grow: -0.6 }); },
      hit(x, y) {
        const P = PAL.fire;
        add({ dur: 0.5, draw(c, k) {
          c.globalCompositeOperation = 'lighter'; const e = 1 - Math.pow(1 - k, 3);
          drawGlow(c, x, y, 70 * (0.5 + e * 0.6), P[2], 1 - k);
          c.globalAlpha = 1 - k; c.strokeStyle = P[1]; c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.ellipse(x, y, 14 + e * 46, (14 + e * 46) * 0.7, 0, 0, TAU); c.stroke();
          for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + 0.3, d = 10 + e * 40; c.fillStyle = P[1 + (i % 3)]; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 9 * (1 - k) + 1, 0, TAU); c.fill(); }
        } });
        burst(x, y, busy() ? 6 : 18, P, { min: 60, max: 240, up: -80, g: -60, lmin: 0.3, lmax: 0.7, shape: 'glow', smin: 3, smax: 7 });
      }
    },
    // 3. 물방울 탄: 꿈틀거리는 물줄기(물뱀), 맞으면 왕관 모양 물보라
    watershot: {
      shot(c, s, now) {
        const P = PAL.water, L = 60, ph = now / 70 + (s.vy > 0 ? 1.5 : 0);
        const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([-L * t, Math.sin(ph - t * 6) * 9 * t]); }
        [[11, P[3], 0.9], [7, P[2], 1], [3, P[1], 1]].forEach(([w, col, a]) => { c.globalAlpha = a; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([px, py], i) => { c.lineWidth = w * (1 - i / 14); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.lineWidth = w; c.stroke(); });
        c.globalAlpha = 1; c.fillStyle = P[2]; c.beginPath(); c.ellipse(2, 0, 10, 8, 0, 0, TAU); c.fill(); c.fillStyle = P[1]; c.beginPath(); c.ellipse(4, -2, 5, 4, 0, 0, TAU); c.fill(); c.fillStyle = '#FFFFFF'; c.fillRect(4, -4, 3, 2);
      },
      trail(s) { if (busy() || Math.random() < 0.3) return; emit({ x: s.x + rand(-5, 5), y: s.y + rand(-5, 5), vx: rand(-40, 40), vy: rand(-60, 0), g: 400, life: rand(0.3, 0.5), size: rand(3, 5), color: PAL.water[Math.floor(rand(1, 4))], shape: 'drop' }); },
      hit(x, y) {
        const P = PAL.water;
        add({ dur: 0.45, draw(c, k) { c.globalAlpha = 1 - k; c.strokeStyle = P[1]; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 10, 10 + k * 34, (10 + k * 34) * 0.4, 0, 0, TAU); c.stroke();
          c.fillStyle = P[2]; for (let i = 0; i < 8; i++) { const a = Math.PI + i * Math.PI / 7, h = Math.sin(k * Math.PI) * 26; c.fillRect(x + Math.cos(a) * (8 + k * 26) - 2, y + 6 - h * Math.abs(Math.sin(a + 0.3)) - 6, 4, 8); } } });
        burst(x, y, busy() ? 5 : 14, P, { min: 80, max: 200, up: -160, g: 600, shape: 'drop', add: false, lmin: 0.35, lmax: 0.6, smin: 3, smax: 7 });
      }
    },
    // 4. 회복의 물: 발밑에서 솟는 초록빛 기둥 + 머리 위 빛 십자가
    heal1: {
      heal(x, y) {
        const P = ['#FFFFFF', '#C8FFE8', '#5CF0B0', '#1EB880'], fy = y + 28;
        add({ dur: 1.0, draw(c, k) {
          c.globalCompositeOperation = 'lighter'; const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
          const g = c.createLinearGradient(0, fy - 120, 0, fy); g.addColorStop(0, 'rgba(92,240,176,0)'); g.addColorStop(0.6, 'rgba(92,240,176,.45)'); g.addColorStop(1, 'rgba(200,255,232,.8)');
          c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - 22, fy - 120, 44, 120);
          c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(x - 6, fy - 110, 12, 110);
          for (let i = 0; i < 3; i++) { const q = (k * 1.6 + i / 3) % 1; c.globalAlpha = a * (1 - q); c.strokeStyle = P[2]; c.lineWidth = 3; c.beginPath(); c.ellipse(x, fy - q * 70, 30 - q * 8, 10 - q * 3, 0, 0, TAU); c.stroke(); }
        } });
        add({ t: -0.15, dur: 0.9, draw(c, k) {   // 빛 십자가
          c.globalCompositeOperation = 'lighter'; const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8, sc = 0.6 + Math.min(1, k * 3) * 0.4, cx = x + 30, cy = y - 46 - k * 10;
          drawGlow(c, cx, cy, 34, P[2], a * 0.8); c.globalAlpha = a; c.fillStyle = P[1]; c.fillRect(cx - 4 * sc, cy - 20 * sc, 8 * sc, 40 * sc); c.fillRect(cx - 14 * sc, cy - 9 * sc, 28 * sc, 8 * sc);
          c.fillStyle = '#FFFFFF'; c.fillRect(cx - 2 * sc, cy - 18 * sc, 4 * sc, 36 * sc); c.fillRect(cx - 12 * sc, cy - 7 * sc, 24 * sc, 4 * sc);
        } });
        for (let i = 0; i < (busy() ? 8 : 22); i++) emit({ x: x + rand(-22, 22), y: fy - rand(0, 40), vx: rand(-10, 10), vy: rand(-140, -50), g: -20, life: rand(0.6, 1.1), size: rand(2, 5), color: P[Math.floor(rand(0, 3))], shape: i % 3 ? 'glow' : 'star', add: true });
        return true;
      }
    },
    // 5. 어둠 구슬: 연기를 끄는 보라 구슬, 맞으면 빨아들이는 소용돌이
    darkorb: {
      shot(c, s, now) {
        const P = PAL.dark; c.rotate(now / 160);
        drawGlow(c, 0, 0, 34, P[2], 0.8);
        c.globalCompositeOperation = 'source-over'; c.fillStyle = P[4]; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill();
        c.globalCompositeOperation = 'lighter'; c.strokeStyle = P[1]; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 9 + i * 3, i * 2.1, i * 2.1 + 1.6); c.stroke(); }
        c.fillStyle = P[0]; c.beginPath(); c.arc(-3, -3, 3, 0, TAU); c.fill();
      },
      trail(s) { if (busy()) return; emit({ x: s.x + rand(-6, 6), y: s.y + rand(-6, 6), vx: -s.vx * 0.12 + rand(-20, 20), vy: -s.vy * 0.12 + rand(-30, 10), life: rand(0.4, 0.7), size: rand(5, 9), color: Math.random() < 0.5 ? '#2A1650' : '#4A2A8A', shape: 'glow', grow: 0.8 }); },
      hit(x, y) {
        const P = PAL.dark;
        add({ dur: 0.65, draw(c, k, now) {
          const r = 40 * (1 - k * 0.6); c.translate(x, y); c.scale(1, 0.75);
          c.globalAlpha = (1 - k) * 0.85; c.fillStyle = '#12082A'; c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.fill();
          c.globalCompositeOperation = 'lighter'; c.rotate(-now / 70); c.lineWidth = 4; for (let i = 0; i < 5; i++) { c.strokeStyle = P[1 + (i % 3)]; c.beginPath(); c.arc(0, 0, r * (0.6 + i * 0.12), i * 1.3, i * 1.3 + 2.2); c.stroke(); }
        } });
        burst(x, y, busy() ? 5 : 14, P, { min: 40, max: 150, lmin: 0.3, lmax: 0.6, shape: 'glow', smin: 3, smax: 6 });
      }
    },
    // 6. 돌 방패: 땅에서 바위가 솟아 둘레를 감싸고, 켜져 있는 동안 바위가 빙빙 돎
    stonewall: {
      shieldCast(x, y) {
        const P = PAL.earth, fy = y + 28;
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8, px = x + Math.cos(a) * 34, py = fy + Math.sin(a) * 14, h = rand(20, 30), w = rand(14, 20);
          add({ t: -i * 0.03, dur: 0.7, under: Math.sin(a) < 0, draw(c, k) { const up = Math.min(1, k / 0.3), a2 = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; c.globalAlpha = a2;
            c.fillStyle = '#1D2340'; c.beginPath(); c.moveTo(px - w / 2 - 2, py); c.lineTo(px - w / 3, py - h * up - 2); c.lineTo(px + w / 3, py - h * up - 2); c.lineTo(px + w / 2 + 2, py); c.fill();
            c.fillStyle = P[2]; c.beginPath(); c.moveTo(px - w / 2, py); c.lineTo(px - w / 3, py - h * up); c.lineTo(px + w / 3, py - h * up); c.lineTo(px + w / 2, py); c.fill(); c.fillStyle = P[1]; c.fillRect(px - w / 3, py - h * up, w / 3, h * up * 0.5); } }); }
        burst(x, fy, busy() ? 6 : 16, P, { min: 60, max: 180, up: -160, g: 600, shape: 'rock', add: false, lmin: 0.4, lmax: 0.7, smin: 3, smax: 6 });
        return true;
      },
      shield(c, x, y, now, left) {
        const P = PAL.earth, a = left < 1 ? (Math.floor(now / 100) % 2 ? 0.35 : 0.9) : 0.9;
        c.save(); c.globalAlpha = a;
        for (let i = 0; i < 6; i++) { const t = now / 700 + i * TAU / 6, px = x + Math.cos(t) * 30, py = y + 8 + Math.sin(t) * 12 - 6, s = 7;
          c.fillStyle = '#1D2340'; c.fillRect(px - s - 1, py - s - 1, s * 2 + 2, s * 1.6 + 2); c.fillStyle = P[2]; c.fillRect(px - s, py - s, s * 2, s * 1.6); c.fillStyle = P[1]; c.fillRect(px - s, py - s, s, s * 0.6); }
        c.globalAlpha = a * 0.3; c.strokeStyle = P[1]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 4, 32, 38, 0, 0, TAU); c.stroke(); c.restore();
        return true;
      }
    },
    // 7. 바람 칼날: 커다란 초승달 바람, 맞으면 초록 베기 자국
    windblade: {
      shot(c, s, now) {
        const P = PAL.wind;
        for (let i = 0; i < 3; i++) { c.globalAlpha = 0.25; c.strokeStyle = P[2]; c.lineWidth = 2; c.beginPath(); c.moveTo(-14 - i * 10, -14 + i * 12); c.lineTo(-40 - i * 10, -14 + i * 12); c.stroke(); }
        c.globalAlpha = 1;
        const g = c.createLinearGradient(-20, 0, 14, 0); g.addColorStop(0, 'rgba(62,192,154,0)'); g.addColorStop(0.6, P[3]); g.addColorStop(1, P[1]);
        c.fillStyle = g; c.beginPath(); c.arc(-14, 0, 30, -1.15, 1.15); c.arc(-24, 0, 24, 1.05, -1.05, true); c.closePath(); c.fill();
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 2.5; c.beginPath(); c.arc(-14, 0, 29, -1.0, 1.0); c.stroke();
      },
      trail(s) { if (busy() || Math.random() < 0.5) return; emit({ x: s.x + rand(-14, 14), y: s.y + rand(-14, 14), vx: -s.vx * 0.2, vy: -s.vy * 0.2, life: 0.3, size: rand(3, 5), color: PAL.wind[Math.floor(rand(1, 4))], shape: 'leaf', add: true }); },
      hit(x, y) {
        const P = PAL.wind;
        add({ dur: 0.25, draw(c, k) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; c.translate(x, y); [[-0.7, P[2]], [0.7, P[1]]].forEach(([a, col]) => { c.save(); c.rotate(a); c.strokeStyle = col; c.lineWidth = 4 * (1 - k) + 1; c.beginPath(); c.moveTo(-26, 0); c.lineTo(26, 0); c.stroke(); c.restore(); }); } });
        burst(x, y, busy() ? 4 : 10, P, { min: 80, max: 200, lmin: 0.2, lmax: 0.4, shape: 'leaf', smin: 3, smax: 5 });
      }
    },
    // 8. 불꽃 고리: 바닥에 붉은 고리가 그려진 뒤 불길이 솟는 고리로 퍼짐
    firering: {
      nova(x, y, r) {
        const P = PAL.fire, fy = y + 20;
        add({ dur: 0.9, under: true, draw(c, k) { c.globalCompositeOperation = 'lighter'; const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, rr = r * (0.35 + 0.65 * Math.min(1, k * 2.2));
          c.globalAlpha = a; c.strokeStyle = P[3]; c.lineWidth = 8; c.beginPath(); c.ellipse(x, fy, rr, rr * 0.5, 0, 0, TAU); c.stroke(); c.strokeStyle = P[1]; c.lineWidth = 3; c.stroke(); } });
        add({ t: -0.08, dur: 0.85, draw(c, k, now) { c.globalCompositeOperation = 'lighter'; const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, rr = r * (0.35 + 0.65 * Math.min(1, k * 2.2)), n = 20;
          for (let i = 0; i < n; i++) { const t = i * TAU / n, px = x + Math.cos(t) * rr, py = fy + Math.sin(t) * rr * 0.5, h = (16 + Math.sin(now / 50 + i * 1.7) * 6) * (Math.sin(t) > 0 ? 1.1 : 0.8);
            c.globalAlpha = a; c.fillStyle = P[2 + (i % 2)]; c.beginPath(); c.moveTo(px - 6, py); c.quadraticCurveTo(px - 4, py - h * 0.6, px, py - h); c.quadraticCurveTo(px + 4, py - h * 0.6, px + 6, py); c.fill();
            c.fillStyle = P[1]; c.beginPath(); c.moveTo(px - 3, py); c.quadraticCurveTo(px - 1, py - h * 0.4, px, py - h * 0.6); c.quadraticCurveTo(px + 1, py - h * 0.4, px + 3, py); c.fill(); }
          drawGlow(c, x, fy, rr * 1.2, P[3], a * 0.4); } });
        burst(x, fy, busy() ? 8 : 24, P, { min: r * 1.4, max: r * 2.6, flat: 0.5, up: -40, g: -40, lmin: 0.35, lmax: 0.7, shape: 'glow', smin: 3, smax: 6 });
        return true;
      }
    },
    // 9. 번개 화살: 지그재그 번개가 꼬리처럼 따라오는 화살, 맞으면 전기가 튐
    thunderarrow: {
      shot(c) {
        const P = PAL.thunder;
        drawGlow(c, 0, 0, 26, P[2], 0.9); strokeBolt(c, boltPath(-80, 0, 0, 0, 8, 7), P, 2.4);
        c.fillStyle = P[2]; c.beginPath(); c.moveTo(14, 0); c.lineTo(0, -7); c.lineTo(3, 0); c.lineTo(0, 7); c.closePath(); c.fill();
        c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(11, 0); c.lineTo(3, -3); c.lineTo(4, 0); c.lineTo(3, 3); c.fill();
      },
      trail(s) { if (busy() || Math.random() < 0.5) return; emit({ x: s.x, y: s.y, vx: rand(-120, 120), vy: rand(-120, 120), life: 0.15, size: 3, color: PAL.thunder[Math.floor(rand(0, 3))], shape: 'spark', add: true }); },
      hit(x, y) {
        const P = PAL.thunder;
        add({ dur: 0.3, draw(c, k) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; drawGlow(c, x, y, 40, P[2], 1 - k); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + k * 2; strokeBolt(c, boltPath(x, y, x + Math.cos(a) * 34, y + Math.sin(a) * 26, 6, 3), P, 1); } } });
        burst(x, y, busy() ? 5 : 12, P, { min: 120, max: 280, lmin: 0.12, lmax: 0.25, shape: 'spark', smin: 2, smax: 4 });
      }
    },
    // 10. 대지 가르기: 땅이 갈라지며(금) 큰 바위 가시가 줄지어 솟음 + 흙먼지
    earthsplit: {
      beam(x, y, dx, dy, len) {
        const P = PAL.earth, fy = y + 20, pts = [[x, fy]];
        for (let i = 1; i <= 10; i++) { const t = i / 10 * len; pts.push([x + dx * t + rand(-6, 6), fy + dy * t + rand(-4, 4)]); }
        add({ dur: 1.1, under: true, draw(c, k) { c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; c.strokeStyle = '#2A1A0C'; c.lineWidth = 4; c.lineJoin = 'round'; c.beginPath(); const m = Math.min(pts.length, Math.ceil(k / 0.25 * pts.length)); pts.slice(0, m).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke(); c.strokeStyle = P[4]; c.lineWidth = 1.5; c.stroke(); } });
        const n = Math.round(len / 22);
        for (let i = 0; i < n; i++) { const px = x + dx * (i + 1) * 22 + rand(-8, 8), py = fy + dy * (i + 1) * 22 + rand(-5, 5), h = rand(26, 46) * (0.7 + i / n * 0.5), w = rand(14, 22), lean = rand(-6, 6);
          add({ t: -i * 0.035, dur: 0.75, draw(c, k) { const up = k < 0.2 ? k / 0.2 : 1; c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
            c.fillStyle = '#1D2340'; c.beginPath(); c.moveTo(px - w / 2 - 2, py); c.lineTo(px + lean, py - h * up - 3); c.lineTo(px + w / 2 + 2, py); c.fill();
            c.fillStyle = P[2]; c.beginPath(); c.moveTo(px - w / 2, py); c.lineTo(px + lean, py - h * up); c.lineTo(px + w / 2, py); c.fill();
            c.fillStyle = P[1]; c.beginPath(); c.moveTo(px - w / 2, py); c.lineTo(px + lean, py - h * up); c.lineTo(px - w / 6, py); c.fill();
            c.fillStyle = P[3]; c.beginPath(); c.moveTo(px + w / 5, py); c.lineTo(px + lean, py - h * up); c.lineTo(px + w / 2, py); c.fill(); }, update(dt, f) { if (!f.d && f.t > 0) { f.d = 1; if (!busy()) burst(px, py, 4, P, { min: 30, max: 90, up: -60, g: 300, shape: 'rock', add: false, lmin: 0.3, lmax: 0.5, smin: 2, smax: 4 }); } } }); }
        return true;
      }
    },
    // ---------- 2차 (11~20번) ----------
    // 11. 회오리: 초록 바람 기둥이 빙글빙글 돌며 솟음
    tornado: {
      nova(x, y, r) {
        const P = PAL.wind, fy = y + 20;
        add({ dur: 1.0, draw(c, k, now) {
          c.globalCompositeOperation = 'lighter'; const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, H = r * 1.1 * Math.min(1, k * 3);
          for (let i = 0; i < 9; i++) { const q = i / 8, yy = fy - q * H, rw = (14 + q * r * 0.55), sp = now / 60 + i * 0.9;
            c.globalAlpha = a * (0.9 - q * 0.4); c.strokeStyle = i % 2 ? P[2] : P[1]; c.lineWidth = 4 - q * 2;
            c.beginPath(); c.ellipse(x + Math.sin(sp * 0.3 + q * 3) * 6, yy, rw, rw * 0.28, 0, sp % TAU, sp % TAU + 4.2); c.stroke(); }
          drawGlow(c, x, fy - H * 0.4, r * 0.7, P[3], a * 0.5);
          c.globalAlpha = a * 0.6; c.strokeStyle = P[2]; c.lineWidth = 3; c.beginPath(); c.ellipse(x, fy, r * (0.4 + k * 0.6), r * (0.4 + k * 0.6) * 0.45, 0, 0, TAU); c.stroke();
        }, update(dt, f) { if (!busy() && Math.random() < 0.7) { const a = Math.random() * TAU; emit({ x: x + Math.cos(a) * r * 0.5, y: fy - rand(0, r), vx: -Math.sin(a) * 200, vy: rand(-80, -20), life: 0.5, size: rand(3, 5), color: PAL.wind[Math.floor(rand(1, 4))], shape: 'leaf', add: true }); } } });
        return true;
      }
    },
    // 12. 빛의 창: 금빛 큰 창이 길게 뻗음
    lightspear: {
      beam(x, y, dx, dy, len) {
        const P = PAL.light, ang = Math.atan2(dy, dx);
        add({ dur: 0.5, draw(c, k) {
          c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.rotate(ang);
          const a = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9, L = len * Math.min(1, k / 0.12); c.globalAlpha = a;
          drawGlow(c, 0, 0, 40, P[3], a);
          const g = c.createLinearGradient(0, 0, L, 0); g.addColorStop(0, 'rgba(255,210,63,.2)'); g.addColorStop(1, P[2]);
          c.fillStyle = g; c.fillRect(0, -5, L - 30, 10); c.fillStyle = '#FFFFFF'; c.fillRect(0, -1.5, L - 30, 3);
          c.fillStyle = P[3]; c.beginPath(); c.moveTo(L + 6, 0); c.lineTo(L - 34, -16); c.lineTo(L - 24, 0); c.lineTo(L - 34, 16); c.closePath(); c.fill();
          c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(L, 0); c.lineTo(L - 26, -8); c.lineTo(L - 20, 0); c.lineTo(L - 26, 8); c.fill();
          for (let i = 0; i < 4; i++) { c.globalAlpha = a * 0.5; c.fillStyle = P[1]; c.fillRect(L * (0.2 + i * 0.18), -12 + (i % 2) * 20, 24, 2); }
          drawGlow(c, L - 10, 0, 34, P[2], a);
        } });
        burst(x + dx * len, y + dy * len, busy() ? 4 : 12, P, { min: 60, max: 180, lmin: 0.25, lmax: 0.5, shape: 'star', smin: 2, smax: 4 });
        return true;
      }
    },
    // 13. 저주의 안개: 보라 안개가 퍼지고 그림자 손이 솟음
    cursefog: {
      nova(x, y, r) {
        const P = PAL.dark, fy = y + 20, blobs = Array.from({ length: 9 }, () => [rand(-1, 1) * r * 0.8, rand(-1, 1) * r * 0.35, rand(0.4, 0.7)]);
        add({ dur: 1.3, under: true, draw(c, k) { const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8, e = Math.min(1, k * 2);
          blobs.forEach(([bx, by, s]) => drawGlow(c, x + bx * e, fy + by * e - 10, r * s, '#5A2AA0', a * 0.8)); } });
        for (let i = 0; i < 5; i++) { const a0 = i * TAU / 5 + rand(-0.3, 0.3), px = x + Math.cos(a0) * r * 0.55, py = fy + Math.sin(a0) * r * 0.25, h = rand(28, 44), fl = Math.random() < 0.5 ? -1 : 1;
          add({ t: -0.15 - i * 0.06, dur: 0.9, draw(c, k) { const up = Math.min(1, k / 0.3), a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; c.globalAlpha = a; c.translate(px, py); c.scale(fl, 1);
            c.fillStyle = '#1A0A30'; c.beginPath(); c.moveTo(-5, 0); c.quadraticCurveTo(-8, -h * up * 0.6, -2, -h * up); c.lineTo(6, -h * up - 6); c.lineTo(4, -h * up + 2); c.lineTo(9, -h * up - 2); c.lineTo(6, -h * up + 6); c.quadraticCurveTo(4, -h * up * 0.5, 5, 0); c.fill();
            c.strokeStyle = P[2]; c.lineWidth = 1.5; c.stroke(); } }); }
        burst(x, fy, busy() ? 6 : 16, P, { min: 30, max: 120, flat: 0.4, up: -30, lmin: 0.5, lmax: 0.9, shape: 'glow', smin: 4, smax: 8 });
        return true;
      }
    },
    // 14. 화염 비: 꼬리 긴 운석이 비스듬히 떨어져 폭발
    firerain: { fall(x, y, r, els, delay) { meteor(x, y, r, delay, PAL.fire, 'fire'); return true; } },
    // 15. 해일: 거대한 파도가 밀려감
    tidal: {
      beam(x, y, dx, dy, len, w) {
        const P = PAL.water, ang = Math.atan2(dy, dx), H = w * 1.1;
        add({ dur: 0.9, draw(c, k, now) {
          c.translate(x, y + 18); c.rotate(ang); upright(c, ang); const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1, front = len * Math.min(1, k / 0.55);
          c.globalAlpha = a * 0.85; const g = c.createLinearGradient(0, -H, 0, H * 0.3); g.addColorStop(0, P[1]); g.addColorStop(0.4, P[2]); g.addColorStop(1, P[3]);
          c.fillStyle = g; c.beginPath(); c.moveTo(0, H * 0.3);
          for (let i = 0; i <= 20; i++) { const t = i / 20 * front, wv = Math.sin(t / 22 - now / 90) * 6; c.lineTo(t, -H * 0.5 - wv - (t / front) * H * 0.4); }
          c.quadraticCurveTo(front + 30, -H * 1.1, front + 18, -H * 0.4); c.quadraticCurveTo(front + 8, -H * 0.1, front, H * 0.3); c.closePath(); c.fill();
          c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.beginPath();
          for (let i = 0; i <= 20; i++) { const t = i / 20 * front, wv = Math.sin(t / 22 - now / 90) * 6; c.lineTo(t, -H * 0.5 - wv - (t / front) * H * 0.4); } c.stroke();
          c.fillStyle = '#FFFFFF'; for (let i = 0; i < 6; i++) c.fillRect(front - 10 + Math.sin(now / 50 + i) * 10, -H * 0.9 + i * 8, 5, 3);
        }, update(dt, f) { if (!busy() && f.t < 0.6) { const t = len * Math.min(1, f.t / 0.55); emit({ x: x + dx * t + rand(-10, 10), y: y + dy * t + rand(-20, 10), vx: dx * 120 + rand(-40, 40), vy: rand(-160, -60), g: 500, life: 0.5, size: rand(3, 6), color: PAL.water[Math.floor(rand(0, 3))], shape: 'drop' }); } } });
        return true;
      }
    },
    // 16. 연쇄 번개: 보라 번개 구슬, 맞으면 사방으로 번개가 튐
    chainbolt: {
      shot(c) { const P = PAL.thunder; drawGlow(c, 0, 0, 30, P[4], 0.9); c.fillStyle = P[3]; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
        for (let i = 0; i < 3; i++) strokeBolt(c, boltPath(0, 0, rand(-40, -10), rand(-22, 22), 5, 3), P, 1); strokeBolt(c, boltPath(-50, 0, 0, 0, 6, 5), P, 1.2); },
      trail(s) { if (busy() || Math.random() < 0.5) return; emit({ x: s.x, y: s.y, vx: rand(-140, 140), vy: rand(-140, 140), life: 0.15, size: 3, color: PAL.thunder[Math.floor(rand(0, 4))], shape: 'spark', add: true }); },
      hit(x, y) { const P = PAL.thunder, ends = Array.from({ length: 3 }, () => [x + rand(-110, 110), y + rand(-60, 60)]);
        add({ dur: 0.35, draw(c, k) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; drawGlow(c, x, y, 46, P[3], 1 - k); ends.forEach(([ex, ey]) => { strokeBolt(c, boltPath(x, y, ex, ey, 12), P, 1.4); drawGlow(c, ex, ey, 22, P[3], 1 - k); }); } }); }
    },
    // 17. 질풍 돌진: 초록 바람을 두르고 돌진, 지나간 길에 바람 줄기
    gale: {
      dash(x, y, dx, dy, len) {
        const P = PAL.wind, ang = Math.atan2(dy, dx);
        add({ dur: 0.55, draw(c, k) { c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.rotate(ang); const a = 1 - k, L = len * Math.min(1, k / 0.25);
          for (let i = 0; i < 6; i++) { const yy = (i - 2.5) * 7, l0 = L * (0.3 + (i % 3) * 0.2); c.globalAlpha = a * 0.8; c.strokeStyle = i % 2 ? P[1] : P[2]; c.lineWidth = 3 - Math.abs(i - 2.5) * 0.5; c.beginPath(); c.moveTo(L - l0, yy * 1.6); c.quadraticCurveTo(L - l0 * 0.4, yy * 0.6, L + 10, 0); c.stroke(); }
          drawGlow(c, L, 0, 40, P[3], a); c.globalAlpha = a; c.fillStyle = P[1]; c.beginPath(); c.moveTo(L + 22, 0); c.lineTo(L - 4, -14); c.lineTo(L + 4, 0); c.lineTo(L - 4, 14); c.fill(); } });
        burst(x, y, busy() ? 4 : 12, P, { min: 60, max: 180, lmin: 0.3, lmax: 0.5, shape: 'leaf', smin: 3, smax: 5 });
        return true;
      }
    },
    // 18. 성스러운 빛: 하늘에서 금빛 기둥이 내려와 감쌈
    holylight: {
      heal(x, y) {
        const P = PAL.light, fy = y + 28;
        add({ dur: 1.1, draw(c, k) { c.globalCompositeOperation = 'lighter'; const a = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88, wv = 30 * (k < 0.12 ? 0.4 + k * 5 : 1);
          const g = c.createLinearGradient(x - wv, 0, x + wv, 0); g.addColorStop(0, 'rgba(255,210,63,0)'); g.addColorStop(0.5, 'rgba(255,250,200,.9)'); g.addColorStop(1, 'rgba(255,210,63,0)');
          c.globalAlpha = a; c.fillStyle = g; c.fillRect(x - wv, fy - 260, wv * 2, 260); c.fillStyle = '#FFFFFF'; c.fillRect(x - 4, fy - 260, 8, 260);
          c.strokeStyle = P[2]; c.lineWidth = 3; c.beginPath(); c.ellipse(x, fy, 34 + k * 20, (34 + k * 20) * 0.35, 0, 0, TAU); c.stroke(); drawGlow(c, x, fy - 30, 60, P[3], a * 0.6); } });
        for (let i = 0; i < (busy() ? 8 : 24); i++) emit({ x: x + rand(-30, 30), y: fy - rand(0, 120), vx: rand(-20, 20), vy: rand(-80, 40), life: rand(0.6, 1.1), size: rand(2, 5), color: P[Math.floor(rand(0, 4))], shape: 'star', add: true });
        return true;
      }
    },
    // 19. 낙뢰: 하늘에서 굵은 번개가 내리꽂힘
    thunderfall: {
      fall(x, y, r, els, delay) {
        const P = PAL.thunder, lead = 0.32;
        add({ t: -delay, dur: lead + 0.45, under: true, draw(c, k) { const tt = k * (lead + 0.45); if (tt > lead) return; c.globalAlpha = 0.3 + tt / lead * 0.5; c.strokeStyle = P[3]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, 0, TAU); c.stroke(); } });
        add({ t: -delay, dur: lead + 0.5, draw(c, k) { const tt = k * (lead + 0.5); c.globalCompositeOperation = 'lighter';
          if (tt < lead) { if (tt > lead * 0.5 && Math.random() < 0.5) { c.globalAlpha = 0.5; strokeBolt(c, boltPath(x + rand(-30, 30), y - 420, x + rand(-20, 20), y - 200, 14), P, 1); } return; }
          const q = (tt - lead) / 0.5; c.globalAlpha = 1 - q; strokeBolt(c, boltPath(x + rand(-16, 16), y - 440, x, y, 20, 12), P, 3.4 * (1 - q) + 1);
          drawGlow(c, x, y, r * 0.9, P[3], (1 - q) * 0.6); for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + q * 3; strokeBolt(c, boltPath(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, 8, 3), P, 1); } },
          update(dt, f) { if (!f.boom && f.t >= lead) { f.boom = 1; burst(x, y, busy() ? 6 : 16, P, { min: 120, max: 300, lmin: 0.15, lmax: 0.3, shape: 'spark', smin: 2, smax: 4 }); } } });
        return true;
      }
    },
    // 20. 지진: 땅이 사방으로 쩍 갈라지고 바위가 솟음
    quake: {
      nova(x, y, r) {
        const P = PAL.earth, fy = y + 20, cracks = Array.from({ length: 7 }, (_, i) => { const a = i * TAU / 7 + rand(-0.3, 0.3); const pts = [[x, fy]]; for (let j = 1; j <= 5; j++) { const d = r * j / 5; pts.push([x + Math.cos(a) * d + rand(-8, 8), fy + Math.sin(a) * d * 0.5 + rand(-4, 4)]); } return pts; });
        add({ dur: 1.2, under: true, draw(c, k) { c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; c.fillStyle = 'rgba(62,40,20,.35)'; c.beginPath(); c.ellipse(x, fy, r * Math.min(1, k * 3), r * 0.5 * Math.min(1, k * 3), 0, 0, TAU); c.fill();
          c.lineJoin = 'round'; cracks.forEach(pts => { const m = Math.max(2, Math.ceil(Math.min(1, k * 4) * pts.length)); c.strokeStyle = '#1E140A'; c.lineWidth = 5; c.beginPath(); pts.slice(0, m).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke(); c.strokeStyle = P[2]; c.lineWidth = 1.5; c.stroke(); }); } });
        spikes(x, y, r, P);
        burst(x, fy, busy() ? 8 : 26, P, { min: r * 0.8, max: r * 2.4, flat: 0.5, up: -120, g: 500, lmin: 0.4, lmax: 0.8, shape: 'rock', add: false, smin: 3, smax: 7 });
        return true;
      }
    },
    // ---------- 3차 (21~30번) ----------
    // 21. 그림자 창: 검붉은 가시 창이 꿰뚫음
    shadowspear: {
      beam(x, y, dx, dy, len, w) {
        const ang = Math.atan2(dy, dx), tend = Array.from({ length: 9 }, () => [rand(0.15, 0.95), rand(-1, 1), rand(14, 30)]), hw = Math.max(9, (w || 34) * 0.42);   // v146 창을 굵게 (너무 가늘어 잘 안 보였음)
        add({ dur: 0.6, draw(c, k) { c.translate(x, y); c.rotate(ang); const a = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9, L = len * Math.min(1, k / 0.12); c.globalAlpha = a;
          drawGlow(c, L * 0.5, 0, hw * 2.6, '#5A1030', a * 0.55);
          c.fillStyle = '#14060E'; c.beginPath(); c.moveTo(0, -hw); c.lineTo(L * 0.82, -hw * 0.55); c.lineTo(L + 4, 0); c.lineTo(L * 0.82, hw * 0.55); c.lineTo(0, hw); c.closePath(); c.fill();
          c.fillStyle = '#8A1A2A'; c.beginPath(); c.moveTo(0, -hw * 0.55); c.lineTo(L * 0.8, -hw * 0.3); c.lineTo(L - 6, 0); c.lineTo(L * 0.8, hw * 0.3); c.lineTo(0, hw * 0.55); c.closePath(); c.fill();
          c.strokeStyle = '#14060E'; c.lineWidth = 3; tend.forEach(([t, s, l]) => { if (t * len > L) return; c.beginPath(); c.moveTo(t * L, 0); c.quadraticCurveTo(t * L - l * 0.4, s * l, t * L - l, s * l * 1.4); c.stroke(); });
          c.globalCompositeOperation = 'lighter'; drawGlow(c, L, 0, 30, '#D2343A', a * 0.7); c.fillStyle = '#FF6A6E'; c.fillRect(0, -1, L - 10, 2); } });
        burst(x + dx * len, y + dy * len, busy() ? 4 : 12, PAL.blood, { min: 60, max: 180, lmin: 0.3, lmax: 0.5, shape: 'glow', smin: 3, smax: 5 });
        return true;
      }
    },
    // 22. 폭풍 칼날: 하얀 초승달 칼날 여러 개
    stormblade: {
      shot(c) { const P = PAL.wind; for (let i = 0; i < 2; i++) { c.globalAlpha = 0.3; c.strokeStyle = P[1]; c.lineWidth = 2; c.beginPath(); c.moveTo(-10 - i * 8, -8 + i * 16); c.lineTo(-34 - i * 8, -8 + i * 16); c.stroke(); }
        c.globalAlpha = 1; c.fillStyle = 'rgba(232,255,246,.9)'; c.beginPath(); c.arc(-10, 0, 20, -1.1, 1.1); c.arc(-17, 0, 16, 1.0, -1.0, true); c.closePath(); c.fill(); c.strokeStyle = P[2]; c.lineWidth = 1.5; c.stroke(); },
      trail(s) { if (busy() || Math.random() < 0.6) return; emit({ x: s.x, y: s.y, vx: -s.vx * 0.2, vy: -s.vy * 0.2, life: 0.25, size: 3, color: '#FFFFFF', shape: 'leaf', add: true }); },
      hit(x, y) { SFX.windblade.hit(x, y); }
    },
    // 23. 빛의 결계: 발밑에 금빛 육망성 결계
    barrier: {
      shieldCast(x, y) { const P = PAL.light; add({ dur: 0.8, under: true, draw(c, k, now) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8; hexa(c, x, y + 28, 50 * (0.5 + Math.min(1, k * 3) * 0.5), now, P); } });
        burst(x, y, busy() ? 6 : 18, P, { min: 60, max: 160, up: -60, lmin: 0.4, lmax: 0.8, shape: 'star', smin: 2, smax: 4 }); return true; },
      shield(c, x, y, now, left) { const a = left < 1 ? (Math.floor(now / 100) % 2 ? 0.3 : 0.85) : 0.85; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.8; hexa(c, x, y + 28, 40, now, PAL.light);
        c.globalAlpha = a * 0.25; c.strokeStyle = PAL.light[2]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, 30, 40, 0, 0, TAU); c.stroke(); c.restore(); return true; }
    },
    // 24. 대폭포: 하늘에서 물기둥이 쏟아져 물보라
    waterfall: {
      fall(x, y, r, els, delay) {
        const P = PAL.water, lead = 0.32;
        add({ t: -delay, dur: lead + 0.55, draw(c, k, now) { const tt = k * (lead + 0.55); const top = y - 420; c.globalCompositeOperation = 'lighter';
          if (tt < lead) { const q = tt / lead; c.globalAlpha = 0.9; c.fillStyle = P[2]; c.fillRect(x - 14, top, 28, (y - top) * q); c.fillStyle = P[1]; c.fillRect(x - 5, top, 10, (y - top) * q); return; }
          const q = (tt - lead) / 0.55; c.globalAlpha = 1 - q; const w = 26 * (1 - q * 0.5); c.fillStyle = P[2]; c.fillRect(x - w, top, w * 2, y - top); c.fillStyle = P[1]; for (let i = 0; i < 4; i++) c.fillRect(x - w + 4 + i * w / 2, top + ((now / 3 + i * 40) % (y - top)), 3, 30);
          c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, r * (0.5 + q), r * (0.5 + q) * 0.4, 0, 0, TAU); c.stroke(); },
          update(dt, f) { if (!f.boom && f.t >= lead) { f.boom = 1; burst(x, y, busy() ? 8 : 20, P, { min: 100, max: 240, up: -200, g: 600, shape: 'drop', add: false, lmin: 0.4, lmax: 0.7, smin: 3, smax: 7 }); } } });
        return true;
      }
    },
    // 25. 태양 폭발: 커다란 해가 터지고 바닥이 용암처럼 갈라짐
    sunburst: {
      nova(x, y, r) {
        const P = PAL.fire, fy = y + 20, cr = Array.from({ length: 10 }, () => [rand(0, TAU), rand(0.3, 0.95)]);
        add({ dur: 1.4, under: true, draw(c, k) { const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85; c.globalAlpha = a * 0.75; c.fillStyle = '#5A1408'; c.beginPath(); c.ellipse(x, fy, r, r * 0.5, 0, 0, TAU); c.fill();
          c.globalCompositeOperation = 'lighter'; c.strokeStyle = P[2]; c.lineWidth = 3; cr.forEach(([a0, d]) => { c.beginPath(); c.moveTo(x, fy); c.lineTo(x + Math.cos(a0) * r * d * 0.5, fy + Math.sin(a0) * r * d * 0.25 + 4); c.lineTo(x + Math.cos(a0 + 0.2) * r * d, fy + Math.sin(a0 + 0.2) * r * d * 0.5); c.stroke(); }); } });
        add({ dur: 0.9, draw(c, k, now) { c.globalCompositeOperation = 'lighter'; const e = 1 - Math.pow(1 - Math.min(1, k * 1.5), 3), rr = r * 0.42 * e, a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
          drawGlow(c, x, y - 10, rr * 1.4, P[3], a * 0.6); c.globalAlpha = a; c.fillStyle = P[2]; c.beginPath(); c.arc(x, y - 10, rr, 0, TAU); c.fill(); c.fillStyle = P[1]; c.beginPath(); c.arc(x, y - 10, rr * 0.7, 0, TAU); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(x, y - 10, rr * 0.35, 0, TAU); c.fill();
          c.strokeStyle = P[2]; c.lineWidth = 4; for (let i = 0; i < 12; i++) { const t = i * TAU / 12 + now / 300; c.beginPath(); c.moveTo(x + Math.cos(t) * rr * 1.05, y - 10 + Math.sin(t) * rr * 1.05); c.lineTo(x + Math.cos(t) * rr * 1.35, y - 10 + Math.sin(t) * rr * 1.35); c.stroke(); } } });
        burst(x, y, busy() ? 10 : 32, P, { min: r, max: r * 2.4, up: -60, g: -40, lmin: 0.4, lmax: 0.9, shape: 'glow', smin: 4, smax: 8 });
        return true;
      }
    },
    // 26. 천둥의 창: 보라·흰 번개 창이 길게 꿰뚫음
    thorspear: {
      beam(x, y, dx, dy, len) {
        const P = PAL.thunder, ang = Math.atan2(dy, dx);
        add({ dur: 0.55, draw(c, k) { c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.rotate(ang); const a = k < 0.08 ? k / 0.08 : 1 - (k - 0.08) / 0.92, L = len * Math.min(1, k / 0.1); c.globalAlpha = a;
          drawGlow(c, 0, 0, 44, P[4], a); c.fillStyle = P[3]; c.fillRect(0, -6, L - 20, 12); c.fillStyle = '#FFFFFF'; c.fillRect(0, -2, L - 20, 4);
          c.fillStyle = P[1]; c.beginPath(); c.moveTo(L + 8, 0); c.lineTo(L - 26, -14); c.lineTo(L - 18, 0); c.lineTo(L - 26, 14); c.closePath(); c.fill();
          for (let i = 0; i < 3; i++) strokeBolt(c, boltPath(0, rand(-14, 14), L, rand(-14, 14), 14), P, 1.1); drawGlow(c, L, 0, 36, P[3], a); } });
        burst(x + dx * len, y + dy * len, busy() ? 5 : 14, P, { min: 120, max: 300, lmin: 0.15, lmax: 0.3, shape: 'spark', smin: 2, smax: 4 });
        return true;
      }
    },
    // 27. 심연의 비: 검은 구슬이 떨어지고 바닥에 보라 소용돌이
    abyss: {
      fall(x, y, r, els, delay) {
        const P = PAL.dark, lead = 0.32;
        add({ t: -delay, dur: lead + 0.7, under: true, draw(c, k, now) { const tt = k * (lead + 0.7); if (tt < lead) return; const q = (tt - lead) / 0.7; c.globalAlpha = 1 - q; c.translate(x, y); c.scale(1, 0.45); c.rotate(-now / 120);
          c.fillStyle = '#12082A'; c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.fill(); c.globalCompositeOperation = 'lighter'; c.lineWidth = 5; for (let i = 0; i < 4; i++) { c.strokeStyle = P[1 + (i % 3)]; c.beginPath(); c.arc(0, 0, r * (0.55 + i * 0.13), i * 1.6, i * 1.6 + 2.4); c.stroke(); } } });
        add({ t: -delay, dur: lead + 0.4, draw(c, k) { const tt = k * (lead + 0.4); c.globalCompositeOperation = 'lighter';
          if (tt < lead) { const q = tt / lead, sy = y - 400 * (1 - q); c.globalAlpha = 0.5; c.fillStyle = 'rgba(74,42,138,.5)'; c.fillRect(x - 10, sy - 120, 20, 120); drawGlow(c, x, sy, 30, P[2], 0.9); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = '#12082A'; c.beginPath(); c.arc(x, sy, 10, 0, TAU); c.fill(); c.strokeStyle = P[1]; c.lineWidth = 2; c.stroke(); return; }
          const q = (tt - lead) / 0.4; c.globalAlpha = 1 - q; drawGlow(c, x, y, r * 0.9, P[2], (1 - q) * 0.6); } });
        return true;
      }
    },
    // 28. 대지의 분노: 땅에서 큰 바위 가시 무더기가 솟음
    earthrage: {
      fall(x, y, r, els, delay) {
        const P = PAL.earth, lead = 0.32;
        add({ t: -delay, dur: lead, under: true, draw(c, k) { c.globalAlpha = 0.3 + k * 0.4; c.strokeStyle = P[2]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, 0, TAU); c.stroke(); } });
        for (let i = 0; i < 5; i++) rockSpike(x + rand(-r * 0.5, r * 0.5), y + rand(-r * 0.2, r * 0.25), rand(30, 54), rand(16, 24), rand(-8, 8), delay + lead + i * 0.02, P);
        add({ t: -delay - lead, dur: 0.1, update(dt, f) { if (!f.d && f.t > 0) { f.d = 1; burst(x, y, busy() ? 5 : 14, P, { min: 60, max: 200, up: -180, g: 600, shape: 'rock', add: false, lmin: 0.4, lmax: 0.8, smin: 3, smax: 7 }); } }, draw() {} });
        return true;
      }
    },
    // 29. 심판의 빛: 하늘에서 금빛 기둥이 내리꽂히고 빛이 튐
    judgement: {
      fall(x, y, r, els, delay) {
        const P = PAL.light, lead = 0.32;
        add({ t: -delay, dur: lead + 0.6, draw(c, k) { const tt = k * (lead + 0.6); c.globalCompositeOperation = 'lighter';
          if (tt < lead) { const q = tt / lead; c.globalAlpha = q * 0.5; c.fillStyle = P[2]; c.fillRect(x - 4, y - 420, 8, 420); c.globalAlpha = 0.5; c.strokeStyle = P[3]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, r, r * 0.5, 0, 0, TAU); c.stroke(); return; }
          const q = (tt - lead) / 0.6, w = r * 0.45 * (1 - q * 0.6); c.globalAlpha = 1 - q; const g = c.createLinearGradient(x - w, 0, x + w, 0); g.addColorStop(0, 'rgba(255,210,63,0)'); g.addColorStop(0.5, 'rgba(255,252,232,1)'); g.addColorStop(1, 'rgba(255,210,63,0)');
          c.fillStyle = g; c.fillRect(x - w, y - 440, w * 2, 440); drawGlow(c, x, y, r * 0.9, P[3], (1 - q) * 0.55); c.strokeStyle = P[2]; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, r * (0.5 + q), r * (0.5 + q) * 0.45, 0, 0, TAU); c.stroke(); },
          update(dt, f) { if (!f.boom && f.t >= lead) { f.boom = 1; burst(x, y, busy() ? 6 : 18, P, { min: 80, max: 240, up: -120, lmin: 0.3, lmax: 0.6, shape: 'star', smin: 2, smax: 5 }); } } });
        return true;
      }
    },
    // 30. 원소 해방: 여섯 원소 구슬이 빙 돌며 터짐 (무지개 폭발)
    elemental: {
      nova(x, y, r) {
        const E6 = ['fire', 'water', 'wind', 'earth', 'thunder', 'dark'];
        add({ dur: 1.1, draw(c, k, now) { c.globalCompositeOperation = 'lighter'; const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4, d = r * 0.7 * Math.min(1, k * 1.6);
          E6.forEach((el, i) => { const P = PAL[el], t = i * TAU / 6 + now / 260, px = x + Math.cos(t) * d, py = y + Math.sin(t) * d * 0.55; drawGlow(c, px, py, 34, P[2], a); c.globalAlpha = a; c.fillStyle = P[1]; c.beginPath(); c.arc(px, py, 9, 0, TAU); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(px - 2, py - 2, 3, 0, TAU); c.fill(); });
          drawGlow(c, x, y, r * 0.35 * (1 + k), '#FFFFFF', a * 0.35); c.globalAlpha = a; c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, d * 1.2, d * 0.66, 0, 0, TAU); c.stroke(); },
          update(dt, f) { if (!f.boom && f.t > 0.55) { f.boom = 1; E6.forEach((el, i) => { const t = i * TAU / 6; burst(x + Math.cos(t) * r * 0.7, y + Math.sin(t) * r * 0.38, busy() ? 4 : 10, PAL[el], { min: 60, max: 200, lmin: 0.3, lmax: 0.7, shape: 'glow', smin: 3, smax: 6 }); }); } } });
        return true;
      }
    }
  };
  // 공통: 비스듬히 떨어지는 운석(화염 비)
  function meteor(x, y, r, delay, P, el) {
    const lead = 0.32, sx0 = x - 160, sy0 = y - 420;
    add({ t: -delay, dur: lead, under: true, draw(c, k) { c.globalAlpha = 0.3 + k * 0.4; c.strokeStyle = P[3]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, r * (1 - k * 0.3), r * 0.5 * (1 - k * 0.3), 0, 0, TAU); c.stroke(); } });
    add({ t: -delay, dur: lead + 0.5, draw(c, k) { const tt = k * (lead + 0.5); c.globalCompositeOperation = 'lighter';
      if (tt < lead) { const q = tt / lead, mx = sx0 + (x - sx0) * q, my = sy0 + (y - sy0) * q, ang = Math.atan2(y - sy0, x - sx0);
        c.save(); c.translate(mx, my); c.rotate(ang); const g = c.createLinearGradient(-110, 0, 0, 0); g.addColorStop(0, 'rgba(232,64,42,0)'); g.addColorStop(1, P[1]); c.fillStyle = g; c.beginPath(); c.moveTo(-110, 0); c.lineTo(0, -12); c.lineTo(0, 12); c.fill(); c.restore();
        drawGlow(c, mx, my, 40, P[2], 1); c.fillStyle = P[3]; c.beginPath(); c.arc(mx, my, 11, 0, TAU); c.fill(); c.fillStyle = P[1]; c.beginPath(); c.arc(mx + 2, my - 2, 6, 0, TAU); c.fill(); return; }
      const q = (tt - lead) / 0.5; c.globalAlpha = 1 - q; drawGlow(c, x, y, r * 1.1 * (0.6 + q), P[2], (1 - q) * 0.55);
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10, h = (22 + (i % 3) * 8) * (1 - q * 0.5), px = x + Math.cos(a) * r * 0.5 * (0.5 + q), py = y + Math.sin(a) * r * 0.25 * (0.5 + q); c.fillStyle = P[1 + (i % 3)]; c.beginPath(); c.moveTo(px - 6, py); c.quadraticCurveTo(px, py - h * 0.6, px, py - h); c.quadraticCurveTo(px, py - h * 0.6, px + 6, py); c.fill(); } },
      update(dt, f) { if (!f.boom && f.t >= lead) { f.boom = 1; burst(x, y, busy() ? 6 : 18, P, { min: 60, max: r * 3.4, up: -80, g: -40, lmin: 0.3, lmax: 0.7, shape: 'glow', smin: 3, smax: 7 }); } } });
  }
  // 공통: 땅에서 솟는 바위 가시 하나
  function rockSpike(px, py, h, w, lean, delay, P) {
    add({ t: -delay, dur: 0.8, draw(c, k) { const up = k < 0.2 ? k / 0.2 : 1; c.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      c.fillStyle = '#1D2340'; c.beginPath(); c.moveTo(px - w / 2 - 2, py); c.lineTo(px + lean, py - h * up - 3); c.lineTo(px + w / 2 + 2, py); c.fill();
      c.fillStyle = P[2]; c.beginPath(); c.moveTo(px - w / 2, py); c.lineTo(px + lean, py - h * up); c.lineTo(px + w / 2, py); c.fill();
      c.fillStyle = P[1]; c.beginPath(); c.moveTo(px - w / 2, py); c.lineTo(px + lean, py - h * up); c.lineTo(px - w / 6, py); c.fill();
      c.fillStyle = P[3]; c.beginPath(); c.moveTo(px + w / 5, py); c.lineTo(px + lean, py - h * up); c.lineTo(px + w / 2, py); c.fill(); } });
  }
  // 공통: 금빛 육망성 (빛의 결계)
  function hexa(c, x, y, r, now, P) {
    c.save(); c.translate(x, y); c.scale(1, 0.5); c.rotate(now / 900);
    c.strokeStyle = P[3]; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, r * 0.82, 0, TAU); c.stroke();
    [0, Math.PI].forEach(o => { c.beginPath(); for (let i = 0; i <= 3; i++) { const a = o + i * TAU / 3 - Math.PI / 2; i ? c.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82) : c.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82); } c.strokeStyle = P[2]; c.lineWidth = 3; c.stroke(); });
    c.restore();
  }
  const shotHit = s => { const S = s && s.sid && SFX[s.sid]; if (S && S.hit) S.hit(s.x, s.y, s); };
  const dash = (x, y, dx, dy, len) => { const S = CUR && SFX[CUR]; if (S && S.dash) S.dash(x, y, dx, dy, len); };
  const shieldCast = (x, y, id) => { const S = SFX[id]; return !!(S && S.shieldCast && S.shieldCast(x, y)); };

  function reset() { parts.length = 0; fxs.length = 0; amb.length = 0; }

  const Fx = { PAL, pal, glow, drawGlow, emit, burst, updateParts, drawParts, updateFx, drawFx, castCircle, drawShot, trail, hit, death, coins, levelUp, dust, heal, nova, beam, fall, drawPool, drawShield, slash, afterimage, slamWarn, strokeBolt, boltPath,
    ambient, drawAmbient, icon, iconURL, reset, use, shotHit, shieldCast, dash, SFX, onBoom: null, count: () => parts.length + fxs.length };
  window.GoRPGFx = Fx;
})();
