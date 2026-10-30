/*
 * gogo?gogo! — 스포츠 게임 공통 도구 (GoSport)
 *  - keys(map)        : 키보드 입력 (채팅 입력 중에는 무시)
 *  - pad(canvas, W, H, buttons) : 휴대폰용 화면 버튼 (여러 손가락 동시 입력)
 *  - fighter(av)      : 플레이어 아바타를 자세별 도트 그림으로 (서기·걷기·주먹·발차기·막기·점프)
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

  /* ---------- 아바타 자세 그림 ----------
   * 18 × 29 칸 아바타 그림을 바탕으로 팔·다리를 덧그려 자세를 만듭니다.
   * pose: 'idle' | 'walk1' | 'walk2' | 'punch' | 'kick' | 'guard' | 'jump' | 'hit' | 'spike'
   * 오른쪽을 보는 그림. 왼쪽은 그릴 때 뒤집음. 가로 폭을 6칸 늘려 팔다리가 들어갈 자리를 둠. */
  const EXTRA = 6, SW = AV.size.w + EXTRA, SH = AV.size.h;
  const cache = new Map();
  function fighter(av, pose) {
    const key = AV.attr(av) + '|' + pose;
    if (cache.has(key)) return cache.get(key);
    const frame = pose === 'walk1' ? 1 : pose === 'walk2' ? 3 : 0;
    const g = AV.grid(av, frame).map(r => r.concat(Array(EXTRA).fill(null)));
    const at = (x, y) => (g[y] && g[y][x]) || null;
    // 칸 좌표는 테두리 1칸 포함 기준
    const skin = at(5, 9) || '#F2C6A0', sleeve = at(13, 14) || skin, pant = at(10, 21) || '#3A5A9A', shoe = at(10, 26) || OUT, shirt = at(8, 15) || sleeve;
    const put = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const yy = y + j, xx = x + i; if (g[yy] && xx >= 0 && xx < SW) g[yy][xx] = c; } };
    const clear = (x, y, w, h) => put(x, y, w, h, null);
    if (pose === 'punch' || pose === 'spike') {
      clear(12, 13, 2, 7);                                  // 오른팔 지우고
      if (pose === 'punch') { put(12, 13, 6, 2, sleeve); put(18, 12, 3, 4, skin); }          // 앞으로 뻗은 팔 + 주먹
      else { put(12, 6, 2, 7, sleeve); put(12, 3, 3, 3, skin); }                           // 위로 뻗은 팔 (스파이크)
    } else if (pose === 'kick') {
      clear(9, 20, 3, 7);                                   // 오른다리 지우고
      put(10, 19, 7, 3, pant); put(17, 18, 3, 4, shoe);     // 옆으로 뻗은 다리 + 신발
    } else if (pose === 'guard') {
      clear(12, 13, 2, 7); clear(4, 13, 2, 7);
      put(12, 8, 2, 6, sleeve); put(14, 7, 2, 7, sleeve); put(14, 6, 2, 2, skin); put(12, 7, 2, 2, skin);
    } else if (pose === 'jump') {
      clear(4, 13, 2, 7); clear(12, 13, 2, 7);
      put(3, 9, 2, 5, sleeve); put(13, 9, 2, 5, sleeve); put(3, 8, 2, 1, skin); put(13, 8, 2, 1, skin);
    }
    // 테두리 다시 계산
    const base = g.map(r => r.map(c => (c === OUT ? null : c)));
    const out = base.map(r => r.slice());
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      if (base[y][x]) continue;
      if ((y > 0 && base[y - 1][x]) || (y < SH - 1 && base[y + 1][x]) || (x > 0 && base[y][x - 1]) || (x < SW - 1 && base[y][x + 1])) out[y][x] = OUT;
    }
    // v39: 아바타와 같은 2배 정교한 그림 (부드러운 대각선 · 명암 · 반짝이는 눈)
    const hi = AV.refine ? AV.refine(out, true) : out, K = AV.refine ? 2 : 1;
    const c = document.createElement('canvas'); c.width = SW * K; c.height = SH * K;
    const cx = c.getContext('2d');
    for (let y = 0; y < SH * K; y++) for (let x = 0; x < SW * K; x++) if (hi[y][x]) { cx.fillStyle = hi[y][x]; cx.fillRect(x, y, 1, 1); }
    // 맞았을 때: 하얗게 번쩍
    if (pose === 'hit') { cx.globalCompositeOperation = 'source-atop'; cx.fillStyle = 'rgba(255,255,255,.65)'; cx.fillRect(0, 0, SW * K, SH * K); }
    cache.set(key, c);
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return c;
  }
  // (x: 발 가운데, y: 발바닥) 기준으로 그림. face: 1 오른쪽, -1 왼쪽
  function drawFighter(ctx, av, pose, x, y, scale, face, alpha) {
    const spr = fighter(av, pose), w = SW * scale, h = SH * scale, bodyCx = (AV.size.w / 2) * scale;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y - h));
    if (face < 0) ctx.scale(-1, 1);
    ctx.drawImage(spr, Math.round(-bodyCx), 0, w, h);
    ctx.restore();
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

  window.GoSport = { image, ready, onImages, keys, pad, touchDevice, fighter, drawFighter, shadow, text, bar, cpuAvatar, myAvatar, myName, slotOrder, teamOf, smoother, SPRITE: { w: SW, h: SH } };
})();
