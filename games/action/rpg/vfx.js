/*
 * gogo?gogo! — skillcom RPG · v153 화려한 마법 그림(VFX) + 마법 쓸 때 몸 동작
 *  선생님 11/16 "스킬이 좀 더 화려했으면 · 해일이나 위에서 물 떨어지는 스킬 · 스킬 쓸 때 모션도 다양하게"
 *  - 그림: img/vfx/<마법 id>.webp (Gemini · 검은 바탕을 투명으로 바꾼 것) — fx.js 의 예전 효과(입자·빛) 위에 큰 그림을 더 그림
 *  - 융합 마법은 원소·모양이 비슷한 기본 마법 그림을 빌려 씀 (FUSE)
 *  - 몸 동작(motion): 마법 모양(kind)·마법마다 다름 — 앞으로 찌르기 · 두 손 들고 뛰기 · 한 바퀴 돌기 · 뛰어올라 내려찍기 · 뒤로 밀리며 쏘기 · 떠올라 기도 · 큰 마법은 높이 떠서 돌기
 *  - 그림을 아직 못 받았으면 예전 효과만 나옴 (게임은 그대로 됨)
 */
(function () {
  'use strict';
  const Fx = window.GoRPGFx; if (!Fx) return;
  const TAU = Math.PI * 2, rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const DIR = 'games/action/rpg/img/vfx/', IM = {};
  const NAMES = ['circle', 'magicarrow', 'fireball', 'watershot', 'darkorb', 'windblade', 'thunderarrow', 'chainbolt', 'stormblade', 'firering', 'tornado', 'cursefog', 'quake', 'sunburst', 'elemental',
    'tidal', 'earthsplit', 'lightspear', 'shadowspear', 'thorspear', 'firerain', 'thunderfall', 'waterfall', 'earthrage', 'judgement',
    'abyss', 'heal1', 'holylight', 'stonewall', 'barrier', 'gale'];
  function img(n) {
    if (!n || !NAMES.includes(n)) return null;
    let e = IM[n];
    if (!e) { e = IM[n] = { im: new Image(), ok: false }; e.im.onload = () => { e.ok = true; }; e.im.src = (window.GOGO_BASE || '') + DIR + n + '.webp?v=153'; }
    return e.ok ? e.im : null;
  }
  let loaded = false; const preload = () => { if (!loaded) { loaded = true; NAMES.forEach(img); } };

  /* 융합 마법 → 빌려 쓸 그림 */
  const FUSE = { '증기 폭발': 'firering', '화염 폭풍': 'firerain', '플라즈마 탄': 'chainbolt', '태양 광선': 'lightspear', '눈보라': 'tornado', '감전 파도': 'tidal', '모래 폭풍': 'earthrage', '뇌우': 'thunderfall',
    '빛의 깃털': 'magicarrow', '자력 폭발': 'quake', '검은 소용돌이': 'cursefog', '그림자 칼바람': 'windblade', '무덤 가시': 'earthrage', '검은 번개': 'thorspear', '혼돈의 일격': 'elemental', '치유의 비': 'holylight', '섬광 돌진': 'gale' };
  const vOf = id => (!id ? null : id.startsWith('f:') ? FUSE[id.slice(2)] || null : id);
  let V = null;
  const useV = id => { V = vOf(id); };

  /* ---------- 내 효과 목록 (fx.js 와 같은 방식 · 같은 층에 그림) ---------- */
  const L = [];
  const add = f => { f.t = f.t || 0; L.push(f); return f; };
  function sprite(c, im, x, y, w, h, o) {   // (x, y) = 그림 가운데 · o: ang 회전 · fx 좌우 뒤집기 · a 투명 · lit 빛 더하기 · ax/ay 기준점(0~1)
    o = o || {}; if (!im || w < 1 || h < 1) return;
    c.save(); c.globalAlpha = clamp(o.a == null ? 1 : o.a, 0, 1); if (o.lit) c.globalCompositeOperation = 'lighter';
    c.translate(x, y); if (o.ang) c.rotate(o.ang); if (o.fx) c.scale(-1, 1); if (o.fy) c.scale(1, -1);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(im, -w * (o.ax == null ? 0.5 : o.ax), -h * (o.ay == null ? 0.5 : o.ay), w, h); c.restore();
  }
  const H = (im, w) => w * im.naturalHeight / im.naturalWidth;   // 너비 w 일 때 높이
  const W = (im, h) => h * im.naturalWidth / im.naturalHeight;

  /* ---------- 마법진 (원소 색으로 물들인 그림) ---------- */
  const tintC = {};
  function tinted(col) {
    const im = img('circle'); if (!im) return null; if (tintC[col]) return tintC[col];
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d');
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.72; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    c.naturalWidth = c.width; c.naturalHeight = c.height; return (tintC[col] = c);
  }

  /* ---------- 탄 (날아가는 마법) ---------- */
  const SHOT = { magicarrow: 110, fireball: 104, watershot: 96, darkorb: 96, windblade: 90, thunderarrow: 116, chainbolt: 62, stormblade: 64 };
  const SPIN = { chainbolt: 1, stormblade: 1 };
  /* ---------- 큰 마법 ---------- */
  const NOVA = {
    firering(x, y, r, im) { add({ dur: 0.85, under: true, draw(c, k) { const e = easeOut(Math.min(1, k / 0.45)), w = r * 2.3 * (0.35 + 0.75 * e); sprite(c, im, x, y + 14, w, H(im, w) * 0.85, { a: k > 0.6 ? (1 - k) / 0.4 : 1, lit: true }); } });
      add({ dur: 0.85, draw(c, k, now) { const e = easeOut(Math.min(1, k / 0.45)), w = r * 2.3 * (0.35 + 0.75 * e); c.save(); c.beginPath(); c.rect(x - w, y + 14 - H(im, w), w * 2, H(im, w) * 0.5); c.clip(); sprite(c, im, x, y + 14, w, H(im, w) * (0.85 + 0.08 * Math.sin(now / 40)), { a: (k > 0.6 ? (1 - k) / 0.4 : 1) * 0.8, lit: true }); c.restore(); } }); },
    tornado(x, y, r, im) { add({ dur: 1.1, draw(c, k, now) { const g = Math.min(1, k / 0.18), h = r * 1.9 * g, w = W(im, h); const flip = Math.floor(now / 70) % 2 === 1;
      sprite(c, im, x + Math.sin(now / 70) * 5, y + 24, w * (0.85 + 0.15 * Math.sin(now / 45)), h, { ay: 1, fx: flip, a: k > 0.75 ? (1 - k) / 0.25 : 1, lit: true }); } }); },
    cursefog(x, y, r, im) { add({ dur: 1.2, draw(c, k, now) { const w = r * 2.4 * (0.45 + 0.65 * easeOut(Math.min(1, k / 0.5))); sprite(c, im, x, y + 4, w * (1 + 0.04 * Math.sin(now / 120)), H(im, w) * 0.75, { a: (k < 0.15 ? k / 0.15 : k > 0.6 ? (1 - k) / 0.4 : 1) * 0.72 }); } }); },
    quake(x, y, r, im) { add({ dur: 1.15, under: true, draw(c, k) { const w = r * 2.3 * (0.6 + 0.4 * easeOut(Math.min(1, k / 0.15))); sprite(c, im, x, y + 18, w, H(im, w) * 0.8, { ay: 0.62, a: k > 0.65 ? (1 - k) / 0.35 : 1 }); } }); },
    sunburst(x, y, r, im) { add({ dur: 1.0, draw(c, k, now) { const w = r * 2.5 * (0.15 + 1.0 * easeOut(Math.min(1, k / 0.4))); sprite(c, im, x, y - 6, w, H(im, w), { ang: now / 900, a: (k > 0.45 ? (1 - k) / 0.55 : 1) * 0.8, lit: true }); } }); },
    elemental(x, y, r, im) { add({ dur: 1.3, draw(c, k, now) { const w = r * 2.3 * (0.2 + 0.9 * easeOut(Math.min(1, k / 0.45))); sprite(c, im, x, y - 10, w, H(im, w), { ang: now / 400, a: (k > 0.5 ? (1 - k) / 0.5 : 1) * 0.7, lit: true });
      sprite(c, im, x, y - 10, w * 0.6, H(im, w * 0.6), { ang: -now / 250, a: (k > 0.5 ? (1 - k) / 0.5 : 1) * 0.35, lit: true }); } }); }
  };
  const BEAM = {
    tidal(x, y, dx, dy, len, w, im) {   // 해일: 거대한 파도가 내 앞에서 일어나 밀려감 (두 겹)
      [0, 0.14].forEach((d, j) => add({ t: -d, dur: 1.0, draw(c, k, now) {
        const p = easeOut(Math.min(1, k / 0.75)), ww = Math.max(230, len * 0.85) * (j ? 0.75 : 1) * (0.5 + 0.5 * Math.min(1, k / 0.3)), hh = H(im, ww) * (0.55 + 0.45 * Math.min(1, k / 0.35)) * (w / 70 * 0.4 + 0.75);
        const along = -ww * 0.15 + (len - ww * 0.35) * p, cx = x + dx * along, cy = y + dy * along;
        const side = Math.abs(dx) >= Math.abs(dy) * 0.6, a = (k > 0.7 ? (1 - k) / 0.3 : 1) * (j ? 0.75 : 1);
        if (side) sprite(c, im, cx, cy + 24 + Math.sin(now / 90) * 2, ww, hh, { ay: 1, fx: dx < 0, a, lit: true });
        else sprite(c, im, cx, cy, ww, hh, { ang: Math.atan2(dy, dx), fy: dx < 0, ay: 0.7, a, lit: true });
      } }));
    },
    earthsplit(x, y, dx, dy, len, w, im) { add({ dur: 1.0, under: true, draw(c, k) { const p = Math.min(1, k / 0.35), ang = Math.atan2(dy, dx), hh = H(im, len) * 1.6;
      c.save(); c.translate(x, y + 18); c.rotate(ang); if (Math.cos(ang) < 0) c.scale(1, -1); c.beginPath(); c.rect(0, -hh, len * p, hh * 2); c.clip(); sprite(c, im, len / 2, 0, len * 1.04, hh, { ay: 0.62, a: k > 0.65 ? (1 - k) / 0.35 : 1 }); c.restore(); } }); },
    spear(x, y, dx, dy, len, w, im, big) { add({ dur: big ? 0.75 : 0.6, draw(c, k, now) { const p = Math.min(1, k / 0.14), ang = Math.atan2(dy, dx), hh = Math.max(H(im, len), w * 1.6) * (1 + 0.12 * Math.sin(now / 25));
      const L2 = len * 1.05 * p; sprite(c, im, x + dx * L2 / 2, y + dy * L2 / 2, L2, hh, { ang, fy: Math.cos(ang) < 0, a: k > 0.5 ? (1 - k) / 0.5 : 1, lit: true }); } }); }
  };
  BEAM.lightspear = (x, y, dx, dy, len, w, im) => BEAM.spear(x, y, dx, dy, len, w, im);
  BEAM.shadowspear = (x, y, dx, dy, len, w, im) => BEAM.spear(x, y, dx, dy, len, w, im);
  BEAM.thorspear = (x, y, dx, dy, len, w, im) => BEAM.spear(x, y, dx, dy, len, w, im, true);
  const LEAD = 0.32;   // fx.js 의 떨어지는 시간과 같게 (맞는 때가 같음)
  const FALL = {
    firerain(x, y, r, d, im) { add({ t: -d, dur: LEAD + 0.08, draw(c, k) { const q = Math.min(1, k * (LEAD + 0.08) / LEAD), w = 150, sx = x - 160 * (1 - q), sy = y - 420 * (1 - q); sprite(c, im, sx, sy, w, H(im, w), { ax: 0.85, ay: 0.8, lit: true }); } }); },
    thunderfall(x, y, r, d, im) { add({ t: -d - 0.05, dur: LEAD + 0.3, draw(c, k, now) { const tt = k * (LEAD + 0.3); if (tt < LEAD * 0.55) return; const h = 440, w2 = W(im, h) * 0.9;
      sprite(c, im, x, y + 6, w2, h, { ay: 1, fx: Math.floor(now / 50) % 2 === 1, a: (tt > LEAD + 0.12 ? 1 - (tt - LEAD - 0.12) / 0.18 : 1) * (Math.floor(now / 35) % 3 ? 1 : 0.55), lit: true }); } }); },
    waterfall(x, y, r, d, im) { add({ t: -d, dur: LEAD + 0.6, draw(c, k, now) { const tt = k * (LEAD + 0.6), q = Math.min(1, tt / LEAD), full = 430, w2 = Math.max(r * 1.7, 90), hh = full * q;
      c.save(); c.beginPath(); c.rect(x - w2, y + 14 - full, w2 * 2, hh); c.clip();
      sprite(c, im, x, y + 14 + Math.sin(now / 50) * 2, w2 * (1 + 0.05 * Math.sin(now / 60)), full, { ay: 1, a: tt > LEAD + 0.35 ? 1 - (tt - LEAD - 0.35) / 0.25 : 1, lit: true }); c.restore(); } }); },
    earthrage(x, y, r, d, im) { const sp = rand(-1, 1); add({ t: -d, dur: LEAD, draw(c, k) { const q = easeOut(k) * 0 + k, w = Math.max(70, r * 1.25); sprite(c, im, x, y - 420 * (1 - q) - 10, w, H(im, w), { ay: 0.85, ang: sp * 0.3 * (1 - q) }); } });
      const qi = img('quake'); if (qi) add({ t: -d - LEAD, dur: 0.9, under: true, draw(c, k) { const w = r * 2.1; sprite(c, qi, x, y + 12, w, H(qi, w) * 0.75, { ay: 0.62, a: k > 0.55 ? (1 - k) / 0.45 : 1 }); } }); },
    abyss(x, y, r, d, im) { add({ t: -d, dur: LEAD + 0.25, draw(c, k, now) { const tt = k * (LEAD + 0.25), q = Math.min(1, tt / LEAD), h = 150, w2 = W(im, h);
      sprite(c, im, x, y + 8 - 420 * (1 - q), w2, h, { ay: 0.95, a: tt > LEAD ? 1 - (tt - LEAD) / 0.25 : 1, lit: true }); } }); },
    judgement(x, y, r, d, im) { add({ t: -d, dur: LEAD + 0.7, draw(c, k, now) { const tt = k * (LEAD + 0.7), q = Math.min(1, tt / LEAD), h = 210, w2 = W(im, h), py = y + 10 - 420 * (1 - easeOut(q) * 0 - q) ;
      sprite(c, im, x, Math.min(y + 10, py), w2, h, { ay: 1, a: tt > LEAD + 0.4 ? 1 - (tt - LEAD - 0.4) / 0.3 : 1, lit: true });
      if (tt > LEAD) Fx.drawGlow(c, x, y, 70 * (1 + 0.1 * Math.sin(now / 40)), '#FFF0A0', (1 - (tt - LEAD) / 0.7) * 0.8); } }); }
  };

  /* ---------- fx.js 감싸기 ---------- */
  const O = { use: Fx.use, drawShot: Fx.drawShot, nova: Fx.nova, beam: Fx.beam, fall: Fx.fall, castCircle: Fx.castCircle, updateFx: Fx.updateFx, drawFx: Fx.drawFx, reset: Fx.reset };
  Fx.useV = useV;
  Fx.use = id => { O.use(id); V = vOf(id); };
  Fx.drawShot = (c, s, now) => {
    const id = s.mine !== false ? vOf(s.vid || s.sid) : null, im = id && SHOT[id] && img(id);
    if (!im) return O.drawShot(c, s, now);
    const P = Fx.pal((s.els && s.els[0]) || 'light'), ang = Math.atan2(s.vy, s.vx), L2 = SHOT[id] * (1 + 0.06 * Math.sin(now / 40));
    c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, s.x, s.y, 34, P[3], 0.5); c.restore();
    if (SPIN[id]) sprite(c, im, s.x, s.y, L2, H(im, L2), { ang: now / 60, lit: true });
    else sprite(c, im, s.x, s.y, L2, H(im, L2), { ang, fy: Math.cos(ang) < 0, ax: 0.78, lit: true });
  };
  Fx.nova = (x, y, r, els) => { O.nova(x, y, r, els); const im = V && NOVA[V] && img(V); if (im) NOVA[V](x, y, r, im); };
  /* 그림이 예전 모양을 대신하는 마법 (예전 모양은 안 그리고 입자만 따로 뿌림) */
  const OWN = { abyss: 1, tidal: 1, waterfall: 1, thunderfall: 1, earthrage: 1, judgement: 1, firerain: 1, lightspear: 1, shadowspear: 1, thorspear: 1, earthsplit: 1 };
  const SPL = { abyss: 'dark', tidal: 'water', waterfall: 'water', thunderfall: 'thunder', earthrage: 'earth', judgement: 'light', firerain: 'fire', lightspear: 'light', shadowspear: 'dark', thorspear: 'thunder', earthsplit: 'earth' };
  const splash = (x, y, el, n, big) => { const P = Fx.pal(el), sh = el === 'water' ? 'drop' : el === 'earth' ? 'rock' : el === 'thunder' ? 'spark' : 'glow';
    Fx.burst(x, y, n, P, { min: 60, max: big ? 300 : 220, up: el === 'water' || el === 'earth' ? -220 : -60, g: el === 'water' || el === 'earth' ? 650 : -40, flat: 0.6, lmin: 0.3, lmax: 0.8, shape: sh, add: el !== 'earth' && el !== 'water', smin: 3, smax: big ? 8 : 6 }); };
  Fx.beam = (x, y, dx, dy, len, w, els) => {
    const im = V && BEAM[V] && img(V);
    if (!(im && OWN[V])) O.beam(x, y, dx, dy, len, w, els);
    if (im) { BEAM[V](x, y, dx, dy, len, w, im); const el = SPL[V] || els[0]; for (let i = 1; i <= 4; i++) add({ dur: 0.01, at: 0.12 * i, onAt: () => splash(x + dx * len * i / 4.4, y + dy * len * i / 4.4 + 14, el, 10, V === 'tidal') }); }
  };
  Fx.fall = (x, y, r, els, delay) => {
    const im = V && FALL[V] && img(V);
    if (!(im && OWN[V])) O.fall(x, y, r, els, delay);
    if (im) { FALL[V](x, y, r, delay || 0, im); const el = SPL[V] || els[0];
      add({ t: -(delay || 0), dur: LEAD + 0.5, under: true, draw(c, k) { const tt = k * (LEAD + 0.5); if (tt > LEAD) return; const P = Fx.pal(el); c.globalAlpha = 0.25 + tt / LEAD * 0.45; c.strokeStyle = P[2]; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y + 8, r * (1 - tt / LEAD * 0.3), r * 0.45 * (1 - tt / LEAD * 0.3), 0, 0, TAU); c.stroke(); } });
      add({ t: -(delay || 0), dur: LEAD + 0.05, at: LEAD, onAt: () => { splash(x, y + 8, el, 18, true); if (Fx.onBoom) try { Fx.onBoom(r > 70 ? 6 : 4); } catch (e) { /* noop */ } } });
      add({ t: -(delay || 0) - LEAD, dur: 0.5, under: true, draw(c, k) { const P = Fx.pal(el); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; c.strokeStyle = P[1]; c.lineWidth = 5 * (1 - k) + 1; c.beginPath(); c.ellipse(x, y + 8, r * (0.4 + k), r * (0.4 + k) * 0.5, 0, 0, TAU); c.stroke(); Fx.drawGlow(c, x, y, r * 1.4, P[2], (1 - k) * 0.6); } });
    }
  };
  Fx.castCircle = (x, y, els, big) => {
    O.castCircle(x, y, els, big); preload();
    const col = Fx.pal(els[0])[2], cv = tinted(col); if (!cv) return;
    const R = big ? 62 : 46;
    add({ dur: big ? 0.9 : 0.7, under: true, draw(c, k, now) { const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85; c.save(); c.translate(x, y); c.scale(1, 0.42); sprite(c, cv, 0, 0, R * 2 * (0.8 + 0.2 * easeOut(Math.min(1, k / 0.3))), R * 2 * cv.height / cv.width, { ang: now / 500, a: a * 0.95, lit: true }); c.restore(); } });
  };
  /* 회복 · 보호막 · 돌진 */
  const O2 = { heal: Fx.heal, drawShield: Fx.drawShield, shieldCast: Fx.shieldCast, dash: Fx.dash };
  Fx.heal = (x, y, big) => {
    O2.heal(x, y, big);
    if (V === 'heal1' && img('heal1')) { const im = img('heal1'); add({ dur: 1.1, draw(c, k) { const h = 120, w = W(im, h); sprite(c, im, x, y + 34 - 30 * k, w * (0.8 + 0.2 * k), h, { ay: 1, a: k < 0.15 ? k / 0.15 : (1 - k) / 0.85, lit: true }); } }); }
    if (V === 'holylight' && img('holylight')) { const im = img('holylight'); add({ dur: 1.2, draw(c, k, now) { const h = 420, w = Math.min(120, W(im, h)) * (0.85 + 0.15 * Math.sin(now / 60)); sprite(c, im, x, y + 36, w, h, { ay: 1, a: (k < 0.12 ? k / 0.12 : k > 0.6 ? (1 - k) / 0.4 : 1) * 0.9, lit: true }); } }); }
  };
  const SHD = { stonewall: 1, barrier: 1 };
  Fx.shieldCast = (x, y, id) => {
    const r = O2.shieldCast(x, y, id);
    if (SHD[id] && img(id)) { const im = img(id); add({ dur: 0.5, draw(c, k) { const w = (id === 'barrier' ? 110 : 120) * (0.3 + 0.9 * easeOut(k)); sprite(c, im, x, id === 'barrier' ? y + 34 : y + 30, w, H(im, w), { ay: id === 'barrier' ? 1 : 0.6, a: 1 - k * 0.6, lit: id === 'barrier' }); } }); }
    return r;
  };
  Fx.drawShield = (c, x, y, now, el, left, sid) => {
    const im = sid && SHD[sid] && img(sid); if (!im) return O2.drawShield(c, x, y, now, el, left, sid);
    const blink = left < 1 ? (Math.floor(now / 100) % 2 ? 0.35 : 0.85) : 1;
    if (sid === 'barrier') { const w = 96; sprite(c, im, x, y + 34, w, H(im, w), { ay: 1, a: (0.45 + 0.12 * Math.sin(now / 200)) * blink, lit: true }); }
    else { const w = 92; sprite(c, im, x, y + 30, w, H(im, w), { ay: 0.6, a: 0.92 * blink }); }
  };
  Fx.dash = (x, y, dx, dy, len) => {
    if (O2.dash) O2.dash(x, y, dx, dy, len);
    const im = V === 'gale' && img('gale'); if (!im) return;
    add({ dur: 0.5, draw(c, k) { const ang = Math.atan2(dy, dx), L2 = len * 1.1, p = Math.min(1, k / 0.35); sprite(c, im, x + dx * L2 * p * 0.5, y + dy * L2 * p * 0.5, L2 * Math.max(0.2, p), H(im, L2) * 0.8, { ang, fy: Math.cos(ang) < 0, a: k > 0.5 ? (1 - k) / 0.5 : 1, lit: true }); } });
  };
  Fx.updateFx = dt => { O.updateFx(dt); for (let i = L.length - 1; i >= 0; i--) { const f = L[i]; f.t += dt; if (f.onAt && !f.fired && f.t >= f.at) { f.fired = 1; try { f.onAt(); } catch (e) { /* noop */ } } if (f.t >= Math.max(f.dur, f.at || 0)) L.splice(i, 1); } };
  Fx.drawFx = (ctx, under, now) => {
    O.drawFx(ctx, under, now);
    for (const f of L) { if (!f.draw || !!f.under !== under || f.t < 0) continue; ctx.save(); try { f.draw(ctx, clamp(f.t / f.dur, 0, 1), now, f); } catch (e) { /* noop */ } ctx.restore(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  };
  Fx.reset = () => { O.reset(); L.length = 0; };

  /* ================= 몸 동작 =================
   *  motionFor(마법) → 동작 이름 · motionTf(동작, 지금) → { dx, dy, rot, sx, sy } (발밑 기준) · 끝나면 null
   *  thrust 앞으로 찌르기 · raise 두 손 들고 살짝 뜀 · spin 한 바퀴 · slam 뛰어올라 내려찍기 · push 뒤로 밀리며 쏘기 · pray 떠올라 기도 · dashm 앞으로 기울어 돌진 · ult 높이 떠서 돌고 내려옴 */
  const MOT_DUR = { thrust: 0.3, raise: 0.6, spin: 0.5, slam: 0.7, push: 0.5, pray: 0.8, dashm: 0.4, ult: 1.0 };
  const MOT_SK = { quake: 'slam', earthrage: 'slam', earthsplit: 'slam', tornado: 'spin', firering: 'spin', cursefog: 'spin', sunburst: 'ult', elemental: 'ult', judgement: 'ult', thorspear: 'push', tidal: 'push', waterfall: 'raise', thunderfall: 'raise', firerain: 'raise', abyss: 'raise' };
  const MOT_KIND = { bolt: 'thrust', nova: 'spin', beam: 'push', rain: 'raise', pool: 'raise', heal: 'pray', shield: 'pray', dash: 'dashm' };
  function motionFor(sk) { if (!sk) return null; const k = (!sk.fusion && MOT_SK[sk.id]) || MOT_KIND[sk.kind] || 'thrust'; return { k, t0: performance.now(), dur: MOT_DUR[k] }; }
  function motionTf(m, now, face) {
    if (!m) return null; const t = (now - m.t0) / 1000, k = t / m.dur; if (k < 0 || k >= 1) return null;
    const f = face < 0 ? -1 : 1, bump = Math.sin(k * Math.PI);
    switch (m.k) {
      case 'thrust': return { dx: f * 6 * bump, dy: 0, rot: f * 0.12 * bump, sx: 1, sy: 1 };
      case 'raise': return { dx: 0, dy: -12 * bump, rot: 0, sx: 1 - 0.04 * bump, sy: 1 + 0.08 * bump };
      case 'spin': { const s = Math.cos(k * TAU); return { dx: 0, dy: -6 * bump, rot: 0, sx: Math.abs(s) < 0.15 ? 0.15 * Math.sign(s || 1) : s, sy: 1 }; }
      case 'slam': { if (k < 0.62) { const q = k / 0.62; return { dx: 0, dy: -30 * Math.sin(q * Math.PI * 0.5) * (q < 0.8 ? 1 : (1 - q) / 0.2 * 0.6 + 0.4 * (1 - q) / 0.2), rot: f * -0.1 * q, sx: 1 - 0.06 * q, sy: 1 + 0.08 * q }; }
        const q = (k - 0.62) / 0.38; return { dx: 0, dy: 0, rot: 0, sx: 1 + 0.22 * (1 - q), sy: 1 - 0.2 * (1 - q) }; }
      case 'push': { if (k < 0.3) { const q = k / 0.3; return { dx: -f * 4 * q, dy: 0, rot: -f * 0.14 * q, sx: 1, sy: 1 }; } const q = (k - 0.3) / 0.7; return { dx: f * (10 * Math.sin(q * Math.PI) - 4 * (1 - q)), dy: 0, rot: f * 0.16 * Math.sin(q * Math.PI), sx: 1 + 0.05 * Math.sin(q * Math.PI), sy: 1 }; }
      case 'pray': return { dx: 0, dy: -10 * bump, rot: 0, sx: 1, sy: 1 + 0.03 * Math.sin(k * TAU * 2) };
      case 'dashm': return { dx: f * 4 * bump, dy: 0, rot: f * 0.28 * bump, sx: 1 + 0.15 * bump, sy: 1 - 0.06 * bump };
      case 'ult': { const up = k < 0.25 ? easeOut(k / 0.25) : k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1, s = Math.cos(clamp((k - 0.2) / 0.5, 0, 1) * TAU * 2); return { dx: 0, dy: -26 * up, rot: 0, sx: Math.abs(s) < 0.15 ? 0.15 * Math.sign(s || 1) : s, sy: 1 + 0.05 * up }; }
    }
    return null;
  }
  // 동작 중 빛 (발밑·몸 둘레) — game.js drawMe 에서 몸을 그린 뒤 부름
  function motionGlow(c, m, now, x, y, el) {
    if (!m) return; const k = (now - m.t0) / 1000 / m.dur; if (k < 0 || k >= 1) return;
    const P = Fx.pal(el || 'light'), a = Math.sin(k * Math.PI);
    c.save(); c.globalCompositeOperation = 'lighter';
    if (m.k === 'ult' || m.k === 'pray') Fx.drawGlow(c, x, y - 34, m.k === 'ult' ? 70 : 46, P[2], a * 0.6);
    if (m.k === 'raise') Fx.drawGlow(c, x, y - 70, 30, P[1], a * 0.7);
    if (m.k === 'slam' && k > 0.62) { c.globalAlpha = (1 - k) / 0.38; c.strokeStyle = P[1]; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 20 + (k - 0.62) * 260, 6 + (k - 0.62) * 80, 0, 0, TAU); c.stroke(); }
    c.restore();
    if (m.k === 'ult' && Math.random() < 0.5) Fx.emit({ x: x + rand(-20, 20), y: y - rand(0, 60), vx: rand(-30, 30), vy: rand(-120, -40), life: 0.6, size: rand(3, 5), color: P[Math.floor(rand(0, 3))], shape: 'star', add: true });
  }
  Object.assign(Fx, { motionFor, motionTf, motionGlow, vfxImg: img, VFX_NAMES: NAMES });
})();
