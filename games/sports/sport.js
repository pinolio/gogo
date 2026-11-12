/*
 * gogo?gogo! — 스포츠 게임 공통 도구 (GoSport)
 *  - keys(map)        : 키보드 입력 (채팅 입력 중에는 무시)
 *  - pad(canvas, W, H, buttons) : 휴대폰용 화면 버튼 (여러 손가락 동시 입력)
 *  - drawFighter(...) : 플레이어 아바타(새 몸 그림 옆모습)를 자세별로 (서기·걷기·주먹·발차기·막기·점프·스파이크) — v120 예전 도트 자세 그림은 뺐음
 *  - image(src)       : 그림 불러오기 (다 불러오면 다시 그리도록 알림)
 */
(function () {
  'use strict';
  const AV = window.GoAvatar;
  const OUT = '#1D2340';

  /* ---------- 그림 불러오기 ---------- */
  const imgs = {}, waiters = [];
  function image(src) {
    if (imgs[src]) return imgs[src];
    const im = new Image(); im.decoding = 'async'; im.src = src; imgs[src] = im;
    im.onload = () => waiters.slice().forEach(fn => { try { fn(); } catch (e) { /* noop */ } });
    return im;
  }
  const ready = im => im && im.complete && im.naturalWidth > 0;
  const onImages = fn => { waiters.push(fn); return () => { const i = waiters.indexOf(fn); if (i >= 0) waiters.splice(i, 1); }; };

  /* ---------- 키보드 ---------- */
  // map: { 'KeyA': 'p0.left', ... } → down['p0.left'] = true, press 콜백(처음 눌렀을 때)
  function keys(map, onPress) {
    const down = {};
    const typing = e => { const t = (e.target && e.target.tagName || '').toLowerCase(); return t === 'input' || t === 'textarea' || (e.target && e.target.isContentEditable); };
    const kd = e => {
      if (typing(e)) return;
      const a = map[e.code]; if (!a) return;
      e.preventDefault();
      if (!down[a]) { down[a] = true; onPress && onPress(a); }
    };
    const ku = e => { const a = map[e.code]; if (a) down[a] = false; };
    const blur = () => Object.keys(down).forEach(k => { down[k] = false; });
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    return { down, off() { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); } };
  }

  /* ---------- 휴대폰 화면 버튼 ---------- */
  const touchDevice = () => (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  // buttons: [{ id, label, x, y, r }] (게임 좌표). input.down[id] 에 반영, onPress(id)
  function pad(canvas, W, H, buttons, input, onPress) {
    const active = new Map();   // pointerId → id
    const pos = e => { const b = canvas.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
    const hit = (x, y) => { for (const bt of buttons) { if ((x - bt.x) ** 2 + (y - bt.y) ** 2 <= (bt.r + 6) ** 2) return bt.id; } return null; };
    const refresh = () => { buttons.forEach(bt => { input.down[bt.id] = false; }); active.forEach(id => { if (id) input.down[id] = true; }); };
    const dn = e => { const [x, y] = pos(e), id = hit(x, y); if (!id) return; e.preventDefault(); active.set(e.pointerId, id); refresh(); onPress && onPress(id); try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* noop */ } };
    const mv = e => { if (!active.has(e.pointerId)) return; const [x, y] = pos(e), id = hit(x, y); if (id !== active.get(e.pointerId)) { active.set(e.pointerId, id); refresh(); if (id) onPress && onPress(id); } };
    const up = e => { if (!active.has(e.pointerId)) return; active.delete(e.pointerId); refresh(); };
    canvas.addEventListener('pointerdown', dn); canvas.addEventListener('pointermove', mv);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => canvas.addEventListener(ev, up));
    canvas.style.touchAction = 'none';
    return {
      buttons,
      draw(ctx) {
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        buttons.forEach(bt => {
          const on = input.down[bt.id];
          ctx.globalAlpha = on ? 0.85 : 0.5;
          ctx.fillStyle = on ? '#FFD23F' : '#1A1F3D'; ctx.beginPath(); ctx.arc(bt.x, bt.y, bt.r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.9; ctx.lineWidth = 3; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
          ctx.fillStyle = on ? '#1A1F3D' : '#FFFFFF'; ctx.font = `700 ${bt.font || 18}px Galmuri11, Pretendard, sans-serif`;
          ctx.fillText(bt.label, bt.x, bt.y + 1);
        });
        ctx.restore();
      },
      off() { canvas.removeEventListener('pointerdown', dn); canvas.removeEventListener('pointermove', mv); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => canvas.removeEventListener(ev, up)); }
    };
  }

  /* ---------- 아바타 자세 그림 (v120: 새 몸 그림만) ---------- SPRITE = 그림 칸 크기 (게임들이 위치 계산에 씀) */
  const EXTRA = 6, SW = AV.size.w + EXTRA, SH = AV.size.h;
  // (x: 발 가운데, y: 발바닥) 기준으로 그림. face: 1 오른쪽, -1 왼쪽
  // v105 walk = 걸음 위상(라디안)을 주면 서 있는 그림을 조각내어 부드럽게 걷기 (AV.rig, RPG 순찰병과 같은 방식) · arms 'left' = 오른손에 라켓
  // v114 새 몸 그림(옆모습)이 있으면 그것으로: 걷기 = AV.rigSide, 주먹·발차기 등은 몸을 기울여 표현, 맞으면 하얗게
  let emptyCv = null; const flashCv = new Map();
  const BODY_TILT = { punch: [0.13, 1.2], kick: [-0.16, -0.6], guard: [-0.08, -0.4], spike: [-0.1, 0], jump: [0, 0], hit: [-0.1, -0.5] };
  /* v120 선생님 11/12 "도트 아바타 말고 부드러운 아바타로": 새 몸 그림(옆모습)에 주먹·발차기·막기·점프·스파이크 팔다리를 그려 줌
   *  각도: 0 = 아래, 90 = 앞, 180 = 위 (칸 단위, 오른쪽을 보는 그림 기준) */
  const LIMB_OUT = '#2A2438';
  const rgbS = c => Array.isArray(c) ? 'rgb(' + c.map(v => Math.round(v)).join(',') + ')' : c;
  function limbColors(av) {
    const n = AV.bodyNorm ? AV.bodyNorm(av) : AV.normalize(av), C = AV.CLOTH || {};
    const skin = (AV.byId[n.skin] && AV.byId[n.skin].color) || '#F2C6A0';
    const top = C[n.top] ? rgbS(C[n.top].c) : '#F3F6FF', bot = C[n.bottom] ? rgbS(C[n.bottom].c) : '#2F5A96';
    return { skin, top, bot, f: n.g === 'f' };
  }
  // 둥근 막대 (테두리 + 속) — a(시작 칸) → b(끝 칸), wd = 굵기(칸)
  function rod(ctx, k, a, b, wd, col) {
    ctx.lineCap = 'round';
    const ln = (w, c, o) => { ctx.strokeStyle = c; ctx.lineWidth = w * k; ctx.beginPath(); ctx.moveTo((a[0] + (o ? o[0] : 0)) * k, (a[1] + (o ? o[1] : 0)) * k); ctx.lineTo((b[0] + (o ? o[0] : 0)) * k, (b[1] + (o ? o[1] : 0)) * k); ctx.stroke(); };
    ln(wd + 0.55, LIMB_OUT); ln(wd, col);
    // 명암: 아래쪽은 조금 어둡게, 위쪽은 밝게 (몸 그림처럼 부드럽게)
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, sgn = ny > 0 ? 1 : -1;
    ctx.globalAlpha = 0.22; ln(wd * 0.35, '#000', [nx * sgn * wd * 0.3, ny * sgn * wd * 0.3]);
    ctx.globalAlpha = 0.35; ln(wd * 0.3, '#fff', [-nx * sgn * wd * 0.28, -ny * sgn * wd * 0.28]); ctx.globalAlpha = 1;
  }
  const pt = (o, ang, len) => [o[0] + Math.sin(ang * Math.PI / 180) * len, o[1] + Math.cos(ang * Math.PI / 180) * len];
  // 팔: 어깨 → 팔꿈치(a1) → 손(a2)
  function arm(ctx, k, co, a1, a2, hand) {
    const sh = [7.5, 14.1];
    let el = pt(sh, a1, 2.9), hd = hand || pt(el, a2, 2.7);
    if (hand) el = [(sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2 + 0.6];   // 손 자리가 정해지면 팔꿈치는 가운데쯤 (살짝 아래로 굽힘)
    rod(ctx, k, el, hd, 1.9, co.skin);
    rod(ctx, k, sh, pt(sh, Math.atan2(el[0] - sh[0], el[1] - sh[1]) * 180 / Math.PI, Math.min(2.2, Math.hypot(el[0] - sh[0], el[1] - sh[1]))), 2.5, co.top);   // 소매
    ctx.fillStyle = LIMB_OUT; ctx.beginPath(); ctx.arc(hd[0] * k, hd[1] * k, 1.35 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = co.skin; ctx.beginPath(); ctx.arc(hd[0] * k, hd[1] * k, 1.05 * k, 0, Math.PI * 2); ctx.fill();
  }
  function leg(ctx, k, co, a1) {
    const hp = [8.4, 20.4], kn = pt(hp, a1, 3.3), ft = pt(kn, a1 + 8, 3.3);
    if (co.f) { rod(ctx, k, kn, ft, 2.1, co.skin); rod(ctx, k, hp, pt(hp, a1, 1.8), 3.2, co.bot); } else { rod(ctx, k, kn, ft, 2.7, co.bot); rod(ctx, k, hp, kn, 3.0, co.bot); }
    ctx.save(); ctx.translate(ft[0] * k, ft[1] * k); ctx.rotate((90 - a1) * Math.PI / 180);
    ctx.fillStyle = LIMB_OUT; ctx.beginPath(); ctx.ellipse(1.1 * k, 0, 2.3 * k, 1.5 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3A3A48'; ctx.beginPath(); ctx.ellipse(1.1 * k, 0, 1.9 * k, 1.1 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F3F6FF'; ctx.fillRect(-0.6 * k, 0.5 * k, 3.4 * k, 0.5 * k); ctx.restore();
  }
  const LIMBS = {
    punch: (ctx, k, co) => arm(ctx, k, co, 92, 92),
    kick: (ctx, k, co) => leg(ctx, k, co, 82),
    guard: (ctx, k, co) => arm(ctx, k, co, 50, 175),
    jump: (ctx, k, co) => arm(ctx, k, co, 200, 190),
    spike: (ctx, k, co) => arm(ctx, k, co, 188, 178)
  };
  function bodyFighter(ctx, av, pose, x, y, scale, face, alpha, walk, hand) {
    if (!AV.useBody || !AV.useBody(av) || !AV.bodyCanvas) return false;
    let bc = AV.bodyCanvas(av, 's'); if (!bc) return false;
    if (pose === 'hit') {
      let f = flashCv.get(bc);
      if (!f) { f = document.createElement('canvas'); f.width = bc.width; f.height = bc.height; const fx = f.getContext('2d'); fx.drawImage(bc, 0, 0); fx.globalCompositeOperation = 'source-atop'; fx.fillStyle = 'rgba(255,255,255,.65)'; fx.fillRect(0, 0, f.width, f.height); flashCv.set(bc, f); }
      bc = f;
    }
    const w = AV.size.w * scale, h = AV.size.h * scale, t = hand ? [0, 0] : BODY_TILT[pose] || [0, 0];
    ctx.save(); if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y)); if (face < 0) ctx.scale(-1, 1);
    if (walk != null && (pose === 'idle' || pose === 'walk1' || pose === 'walk2') && AV.rigSide) {
      if (!emptyCv) { emptyCv = document.createElement('canvas'); emptyCv.width = bc.width; emptyCv.height = bc.height; }
      ctx.imageSmoothingEnabled = true; AV.rigSide(ctx, bc, emptyCv, Math.round(-w / 2), -h, w, h, walk, true, {});
    } else {
      ctx.translate(t[1] * scale, 0); ctx.rotate(t[0]);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bc, Math.round(-w / 2), -h, w, h);
    }
    const lf = walk != null && (pose === 'idle' || pose === 'walk1' || pose === 'walk2') ? null : LIMBS[pose];
    if (lf || hand) {   // v120 동작 팔다리 (hand = 라켓 쥔 손 자리[칸] → 그 자리까지 팔을 뻗음)
      ctx.save(); ctx.translate(-w / 2, -h);
      const co = limbColors(av);
      if (hand) { const sh = [7.5, 14.1], d = Math.hypot(hand[0] - sh[0], hand[1] - sh[1]); if (d > 2.6) arm(ctx, scale, co, 0, 0, hand); }
      else lf(ctx, scale, co);
      if (pose === 'hit') { /* noop */ }
      ctx.restore();
    }
    ctx.restore(); return true;
  }
  function drawFighter(ctx, av, pose, x, y, scale, face, alpha, walk, arms, hand) {
    if (bodyFighter(ctx, av, pose, x, y, scale, face, alpha, walk, hand)) return;
    // v120 새 몸 그림을 받는 중이면 잠깐 안 그림 (예전 도트는 뺐음)
  }
  function shadow(ctx, x, y, w) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, w / 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

  /* ---------- 글자 (도트 글꼴 + 그림자) ---------- */
  function text(ctx, s, x, y, size, color, align, weight) {
    ctx.save(); ctx.font = `${weight || 700} ${size}px Galmuri11, Pretendard, sans-serif`; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(10,12,30,.75)'; ctx.fillText(s, x + Math.max(1, size / 14), y + Math.max(1, size / 14));
    ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y); ctx.restore();
  }
  function bar(ctx, x, y, w, h, ratio, color, back) {
    ctx.fillStyle = '#0B0E22'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = back || '#3A3F66'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, Math.min(1, ratio)) * w, h);
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, Math.max(0, Math.min(1, ratio)) * w, Math.max(2, h / 4));
  }

  // 상대(컴퓨터) 아바타: 이름으로 늘 같은 모습
  const cpuAvatar = seed => AV.random('cpu-' + seed);
  const myAvatar = () => (window.GameHub && window.GameHub.user ? window.GameHub.user.avatar : AV.normalize({}));
  const myName = () => (window.GameHub && window.GameHub.user ? window.GameHub.user.nickname : '나');

  /* ---------- 1:1 · 2:2 자리와 온라인 ----------
   * 자리(slot): 1:1 = [0 왼쪽, 1 오른쪽] / 2:2 = [0·1 왼쪽 팀, 2·3 오른쪽 팀]
   * 온라인은 들어온 순서대로 팀이 번갈아 가도록 자리를 정함 */
  const slotOrder = n => (n === 4 ? [0, 2, 1, 3] : [0, 1]);
  const teamOf = (slot, n) => (n === 4 ? (slot < 2 ? 0 : 1) : slot);
  // 온라인 방장이 보내는 화면 상태를 부드럽게 (지난 상태 → 이번 상태 사이를 이어 그림)
  function smoother(every) {
    let prev = null, cur = null, at = 0;
    return {
      push(st) { prev = cur || st; cur = st; at = performance.now(); },
      get ready() { return !!cur; },
      get cur() { return cur; },
      // 숫자 하나를 이어 그림 (a: 지난 값, b: 이번 값)
      mix(a, b) { const k = Math.min(1, (performance.now() - at) / every); return a + (b - a) * k; },
      get prev() { return prev; }
    };
  }

  window.GoSport = { image, ready, onImages, keys, pad, touchDevice, drawFighter, shadow, text, bar, cpuAvatar, myAvatar, myName, slotOrder, teamOf, smoother, SPRITE: { w: SW, h: SH } };
})();
