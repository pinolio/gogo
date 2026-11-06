/*
 * gogo?gogo! — 내 방 (GoRoom, 주소 #room · 친구 방 #room/아이디, v88)
 *  - 싸이월드 미니룸처럼 비스듬히 내려다보는 방. 바닥을 누르면 아바타가 걸어가고, 가구를 누르면 그 앞으로 가서 동작
 *    (옷장 = 열고 옷 갈아입기 · 침대 = 눕기 · 의자 = 앉기 · 조명 = 켜기 · 창문 = 낮/밤 · 스피커·피아노 = 음악 …)
 *  - [방 꾸미기]: 아래 '내 가구'에서 골라 놓기 · 끌어서 옮기기 · 돌리기 · 보관 · 벽지/바닥/옷장 바꾸기 → [저장]
 *  - 방 아래: 오늘/전체 방문 수 · 방명록 · 이 사람의 게임별 기록 (하나의 프로필)
 *  - 가구 그림·목록 = js/furniture.js (GoFurn) · 저장 = GameHub.saveRoom (온라인: supabase/room_v88.sql)
 */
(function () {
  'use strict';
  const Hub = window.GameHub, AV = window.GoAvatar, F = window.GoFurn, SET = window.GoSettings;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const N = 8, WH = 150, VW = 480, VH = 380, OX = 240, OY = 172, S = 2;   // 방 8×8칸 · 벽 높이 · 화면(논리) 크기 · 바닥 위 꼭짓점
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let A = null, root = null, key = null, owner = null, room = null, draft = null, edit = false, raf = 0, cv = null, ctx = null, closetCleanup = null;
  let shell = null, shellKey = '', tab = 'furn', sel = null, carry = null, busy = false, stats = null, guests = null, visits = null, loadErr = null;
  const st = { on: {}, night: false, wdOpen: 0, wdTarget: 0, sparkle: 0, bubble: null, notes: 0 };
  const me = { i: 4.5, j: 5.5, path: [], act: null, actItem: null, face: 1, walkT: 0, after: null, idleT: 2 };

  const mine = () => !!(Hub.user && owner && Hub.user.id === owner.id);
  const R = () => (edit ? draft : room);
  const P = (i, j, z) => [OX + (i - j) * F.TW, OY + (i + j) * F.TH - (z || 0)];
  const size = (it, r) => (r ? [it.d, it.w] : [it.w, it.d]);
  const esc = s => A.esc(s);

  /* ---------- 칸 · 길 찾기 ---------- */
  function blocks(rm, skip) {   // 아바타가 못 지나가는 칸 (러그 빼고)
    const b = new Set();
    const put = (i0, j0, w, d) => { for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + d; j++) b.add(i + ',' + j); };
    rm.items.forEach((x, k) => { if (skip === k) return; const it = F.byId[x[0]]; if (!it || it.slot === 'rug') return; const [w, d] = size(it, x[3]); put(x[1], x[2], w, d); });
    if (skip !== 'wd') put(rm.wdAt[0], rm.wdAt[1], 1, 1);
    return b;
  }
  function path(from, to, rm) {
    const b = blocks(rm), sk = from[0] + ',' + from[1], goal = to[0] + ',' + to[1];
    if (b.has(goal)) return null;
    const prev = { [sk]: null }, q = [from];
    while (q.length) {
      const [i, j] = q.shift(); if (i + ',' + j === goal) break;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => { const ni = i + di, nj = j + dj, k = ni + ',' + nj; if (ni < 0 || nj < 0 || ni >= N || nj >= N || b.has(k) || k in prev) return; prev[k] = i + ',' + j; q.push([ni, nj]); });
    }
    if (!(goal in prev)) return null;
    const out = []; let k = goal; while (k) { const [i, j] = k.split(',').map(Number); out.unshift([i + 0.5, j + 0.5]); k = prev[k]; }
    return out.slice(1);
  }
  const myTile = () => [Math.max(0, Math.min(N - 1, Math.floor(me.i))), Math.max(0, Math.min(N - 1, Math.floor(me.j)))];
  // 가구 앞(또는 옆)의 빈 칸 중 가장 가까운 곳
  function frontOf(rm, i0, j0, w, d, r) {
    const b = blocks(rm), cand = [];
    const front = r ? (j => [i0 + w, j]) : (i => [i, j0 + d]);
    for (let a = 0; a < (r ? d : w); a++) cand.push(r ? front(j0 + a) : front(i0 + a));
    for (let i = i0 - 1; i <= i0 + w; i++) for (let j = j0 - 1; j <= j0 + d; j++) if (i < i0 || j < j0 || i >= i0 + w || j >= j0 + d) cand.push([i, j]);
    const [mi, mj] = myTile();
    const ok = cand.filter(([i, j]) => i >= 0 && j >= 0 && i < N && j < N && !b.has(i + ',' + j));
    let best = null, bl = 1e9; ok.forEach(c => { const p = path([mi, mj], c, rm); const l = c[0] === mi && c[1] === mj ? 0 : p ? p.length : 1e9; if (l < bl) { bl = l; best = c; } });
    return best;
  }
  function walkTo(tile, after) {
    const p = tile && path(myTile(), tile, R());
    me.act = null; me.actItem = null;
    if (!p) { if (after && tile && tile[0] === myTile()[0] && tile[1] === myTile()[1]) after(); else bubble('갈 수 없어요'); return; }
    me.path = p; me.after = after || null; if (!p.length && after) { me.after = null; after(); }
  }
  function freeSpot() {   // 꾸미고 나서 아바타가 가구 속에 있으면 가까운 빈 칸으로
    const b = blocks(R()), [i, j] = myTile();
    if (!b.has(i + ',' + j)) return;
    for (let r = 1; r < N; r++) for (let a = -r; a <= r; a++) for (const [x, y] of [[i + a, j - r], [i + a, j + r], [i - r, j + a], [i + r, j + a]]) if (x >= 0 && y >= 0 && x < N && y < N && !b.has(x + ',' + y)) { me.i = x + 0.5; me.j = y + 0.5; return; }
  }

  /* ---------- 그리기 ---------- */
  function shellCanvas(rm) {
    const k = rm.wp + '|' + rm.fl + '|' + st.night;
    if (shell && shellKey === k) return shell;
    shell = document.createElement('canvas'); shell.width = VW * S; shell.height = VH * S;
    const c = shell.getContext('2d'); c.scale(S, S); c.lineJoin = 'round';
    F.drawRoomShell(F.pen(c, OX, OY), N, WH, rm.wp, rm.fl, false);
    shellKey = k; return shell;
  }
  function hull(i, j, w, d, h) { return [P(i, j + d, 0), P(i + w, j + d, 0), P(i + w, j, 0), P(i + w, j, h), P(i, j, h), P(i, j + d, h)]; }
  function drawList(rm) {
    const L = [];
    rm.items.forEach((x, k) => { const it = F.byId[x[0]]; if (!it || it.slot === 'rug') return; const [w, d] = size(it, x[3]); L.push({ k, it, i: x[1], j: x[2], w, d, r: x[3] }); });
    const wd = F.byId[rm.wd]; L.push({ k: 'wd', it: wd, i: rm.wdAt[0], j: rm.wdAt[1], w: 1, d: 1, r: rm.wdAt[2] });
    if (!edit) L.push({ k: 'me', av: true, i: me.i - 0.3, j: me.j - 0.3, w: 0.6, d: 0.6 });
    // 앞뒤 순서: 겹치지 않는 상자는 한쪽이 확실히 뒤 → 위상 정렬
    const behind = (a, b) => (a.i + a.w <= b.i + 0.001) || (a.j + a.d <= b.j + 0.001);
    const out = [], left = L.slice();
    while (left.length) {
      let pick = left.findIndex(a => !left.some(b => b !== a && behind(b, a) && !behind(a, b)));
      if (pick < 0) pick = left.reduce((m, a, n) => (a.i + a.j + (a.w + a.d) / 2 < left[m].i + left[m].j + (left[m].w + left[m].d) / 2 ? n : m), 0);
      out.push(left.splice(pick, 1)[0]);
    }
    return out;
  }
  function drawAvatar(c, now) {
    const av = owner ? (mine() ? Hub.user.avatar : owner.avatar) : AV.normalize({});
    let [x, y] = P(me.i, me.j, 0), frame = 0, z = 0;
    const moving = me.path.length > 0;
    if (moving && !reduce) frame = [1, 0, 3, 0][Math.floor(me.walkT * 7) % 4];
    if (me.act === 'sit') z = 14;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(x, y, 11, 5, 0, 0, Math.PI * 2); c.fill();
    if (me.act === 'sleep') {
      c.translate(x, y - 22); c.rotate(-Math.PI / 2.4); AV.draw(c, av, -18, -29, 2, { frame: 0 });
      c.restore(); c.font = '12px "Jua", sans-serif'; c.fillStyle = '#4A5AA8'; const t = (now / 600) % 3; c.fillText('Z', x + 14 + t * 4, y - 40 - t * 8); c.fillText('z', x + 22 + t * 3, y - 54 - t * 6); return;
    }
    const bob = moving || reduce ? 0 : Math.round(Math.sin(now / 500));
    c.translate(x, y - z);
    if (me.face < 0) c.scale(-1, 1);
    AV.draw(c, av, -18, -56 + bob, 2, { frame });
    c.restore();
  }
  function drawWallItems(c, g, rm) {
    rm.walls.forEach((x, k) => { const it = F.byId[x[0]]; if (!it) return; if (edit && sel && sel.kind === 'wall' && sel.k === k) { c.save(); c.shadowColor = '#FFD23F'; c.shadowBlur = 10; } F.drawWallItem(g, it, x[1], x[2], { night: st.night }); if (edit && sel && sel.kind === 'wall' && sel.k === k) c.restore(); });
  }
  function frameDraw(now) {
    if (!ctx) return;
    const c = ctx, rm = R();
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(shellCanvas(rm), 0, 0);
    c.setTransform(S, 0, 0, S, 0, 0); c.lineJoin = 'round';
    const g = F.pen(c, OX, OY);
    // 러그 → 벽 장식 → 가구·아바타 (뒤부터)
    rm.items.forEach((x, k) => { const it = F.byId[x[0]]; if (it && it.slot === 'rug' && !(carry && carry.from === k)) F.drawItem(g, it, x[1], x[2], x[3], {}); });
    drawWallItems(c, g, rm);
    drawList(rm).forEach(o => {
      if (carry && carry.from === o.k) return;
      if (o.av) return drawAvatar(c, now);
      const hl = edit && sel && sel.kind !== 'wall' && sel.k === o.k;
      if (hl) { c.save(); c.shadowColor = '#FFD23F'; c.shadowBlur = 12; }
      F.drawItem(g, o.it, o.i, o.j, o.r, { on: st.on[o.it.id], open: o.k === 'wd' ? st.wdOpen : 0 });
      if (hl) c.restore();
    });
    if (st.night) { c.fillStyle = 'rgba(16,14,60,.38)'; c.fillRect(0, 0, VW, VH); Object.keys(st.on).forEach(id => { if (!st.on[id]) return; const x = rm.items.find(y => y[0] === id); const it = F.byId[id]; if (!x || !it || it.act !== 'light') return; const p = P(x[1] + 0.5, x[2] + 0.5, it.h - 8); const gr = c.createRadialGradient(p[0], p[1], 2, p[0], p[1], 110); gr.addColorStop(0, 'rgba(255,230,160,.45)'); gr.addColorStop(1, 'rgba(255,230,160,0)'); c.fillStyle = gr; c.fillRect(p[0] - 110, p[1] - 110, 220, 220); }); }
    if (carry) drawCarry(c, g);
    if (st.sparkle > 0) { const [x, y] = P(me.i, me.j, 30); for (let n = 0; n < 10; n++) { const a = n / 10 * Math.PI * 2 + now / 300, r = 24 + 8 * Math.sin(now / 120 + n); c.fillStyle = n % 2 ? '#FFE45C' : '#FFFFFF'; c.fillRect(x + Math.cos(a) * r - 2, y + Math.sin(a) * r * 0.8 - 2, 4, 4); } }
    if (st.notes > 0) { const [x, y] = P(me.i, me.j, 64); c.font = '14px sans-serif'; c.fillStyle = '#7E4DE0'; for (let n = 0; n < 3; n++) { const t = ((now / 900) + n / 3) % 1; c.globalAlpha = 1 - t; c.fillText(n % 2 ? '♪' : '♫', x - 16 + n * 14, y - t * 30); } c.globalAlpha = 1; }
    if (st.bubble) { const [x, y] = P(me.i, me.j, me.act === 'sit' ? 82 : 68); c.font = '12px "Jua", "Malgun Gothic", sans-serif'; const tw = c.measureText(st.bubble.t).width + 16; c.fillStyle = '#FFFFFF'; c.strokeStyle = '#1D2340'; c.lineWidth = 1.5; c.beginPath(); c.roundRect ? c.roundRect(x - tw / 2, y - 22, tw, 22, 8) : c.rect(x - tw / 2, y - 22, tw, 22); c.fill(); c.stroke(); c.fillStyle = '#1D2340'; c.textAlign = 'center'; c.fillText(st.bubble.t, x, y - 7); c.textAlign = 'left'; }
  }
  function drawCarry(c, g) {
    const it = carry.it;
    c.save(); c.globalAlpha = 0.85;
    if (it.slot === 'wall') { F.drawWallItem(g, it, carry.side, carry.i, {}); c.globalAlpha = 0.35; if (!carry.ok) { c.fillStyle = '#FF3B3B'; const q = carry.side === 'R' ? [P(carry.i, 0, 30), P(carry.i + it.w, 0, 30), P(carry.i + it.w, 0, 120), P(carry.i, 0, 120)] : [P(0, carry.i, 30), P(0, carry.i + it.w, 30), P(0, carry.i + it.w, 120), P(0, carry.i, 120)]; g.poly(q, '#FF3B3B', false); } }
    else {
      const [w, d] = it.slot === 'wardrobe' ? [1, 1] : size(it, carry.r);
      g.flat(carry.i, carry.j, carry.i + w, carry.j + d, 0, carry.ok ? 'rgba(90,220,140,.45)' : 'rgba(255,60,60,.5)', carry.ok ? '#2E9A5A' : '#C82020');
      F.drawItem(g, it, carry.i, carry.j, carry.r, { open: 0 });
    }
    c.restore();
  }
  function loop(now) {
    if (!root || !cv || !cv.isConnected) { raf = 0; return; }
    step(Math.min(0.05, (now - (loop.t || now)) / 1000)); loop.t = now;
    frameDraw(now); raf = requestAnimationFrame(loop);
  }
  function step(dt) {
    if (st.bubble && (st.bubble.t2 -= dt) <= 0) st.bubble = null;
    if (st.sparkle > 0) st.sparkle -= dt; if (st.notes > 0) st.notes -= dt;
    st.wdOpen += Math.sign(st.wdTarget - st.wdOpen) * Math.min(Math.abs(st.wdTarget - st.wdOpen), dt * 4);
    if (edit) return;
    if (me.path.length) {
      const [ti, tj] = me.path[0], di = ti - me.i, dj = tj - me.j, dist = Math.hypot(di, dj), sp = 2.6 * dt;
      const sx = (di - dj); if (Math.abs(sx) > 0.01) me.face = sx > 0 ? 1 : -1;
      if (dist <= sp) { me.i = ti; me.j = tj; me.path.shift(); if (!me.path.length && me.after) { const f = me.after; me.after = null; f(); } }
      else { me.i += di / dist * sp; me.j += dj / dist * sp; }
      me.walkT += dt;
    } else if (!mine() && !me.act) {   // 친구 방: 주인 아바타가 가끔 돌아다님
      if ((me.idleT -= dt) <= 0) { me.idleT = 3 + Math.random() * 4; const t = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; const p = path(myTile(), t, R()); if (p) me.path = p; }
    }
  }
  function bubble(t, sec) { st.bubble = { t, t2: sec || 1.8 }; }

  /* ---------- 누르기 ---------- */
  function toLogical(ev) { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * VW / r.width, (ev.clientY - r.top) * VH / r.height]; }
  function toTile(x, y) { const a = (x - OX) / F.TW, b = (y - OY) / F.TH; return [(a + b) / 2, (b - a) / 2]; }
  function hitAt(x, y) {
    const rm = R(), list = drawList(rm).filter(o => !o.av).reverse();
    for (const o of list) { const h = o.k === 'wd' ? 96 : o.it.h || 30; const pts = hull(o.i, o.j, o.w, o.d, h); const pth = new Path2D(); pts.forEach((p, n) => (n ? pth.lineTo(p[0], p[1]) : pth.moveTo(p[0], p[1]))); pth.closePath(); if (ctx.isPointInPath(pth, x * S, y * S)) return { kind: o.k === 'wd' ? 'wd' : 'furn', k: o.k, o }; }
    for (let k = rm.walls.length - 1; k >= 0; k--) { const x0 = rm.walls[k], it = F.byId[x0[0]]; if (!it) continue; const W2 = it.wall; const q = x0[1] === 'R' ? [P(x0[2], 0, W2.z0 - 4), P(x0[2] + it.w, 0, W2.z0 - 4), P(x0[2] + it.w, 0, W2.z1 + 4), P(x0[2], 0, W2.z1 + 4)] : [P(0, x0[2], W2.z0 - 4), P(0, x0[2] + it.w, W2.z0 - 4), P(0, x0[2] + it.w, W2.z1 + 4), P(0, x0[2], W2.z1 + 4)]; const pth = new Path2D(); q.forEach((p, n) => (n ? pth.lineTo(p[0], p[1]) : pth.moveTo(p[0], p[1]))); pth.closePath(); if (ctx.isPointInPath(pth, x * S, y * S)) return { kind: 'wall', k, it }; }
    const rug = rm.items.map((x0, k) => ({ x0, k })).reverse().find(({ x0 }) => { const it = F.byId[x0[0]]; if (!it || it.slot !== 'rug') return false; const [w, d] = size(it, x0[3]); const [ti, tj] = toTile(x, y); return ti >= x0[1] && tj >= x0[2] && ti < x0[1] + w && tj < x0[2] + d; });
    if (rug) return { kind: 'rug', k: rug.k };
    return null;
  }
  function useItem(h) {
    const rm = R();
    if (h.kind === 'wall') { const it = h.it; if (it.act === 'window') { st.night = !st.night; bubble(st.night ? '밤이 됐어요 🌙' : '아침이에요 ☀'); } else bubble(it.name); return; }
    const o = h.o, it = o.it;
    const spot = frontOf(rm, o.i, o.j, o.w, o.d, o.r);
    if (!spot) { bubble('가까이 갈 수 없어요'); return; }
    walkTo(spot, () => {
      const [ci, cj] = [o.i + o.w / 2, o.j + o.d / 2]; me.face = (ci - cj) - (me.i - me.j) >= 0 ? 1 : -1;
      if (it.act === 'wardrobe') openWardrobe();
      else if (it.act === 'sleep') { me.i = o.i + o.w / 2; me.j = o.j + o.d / 2; me.act = 'sleep'; bubble('쿨쿨…'); }
      else if (it.act === 'sit') { me.i = o.i + o.w / 2; me.j = o.j + o.d / 2; me.act = 'sit'; bubble('편하다~'); }
      else if (it.act === 'light' || it.act === 'screen') { st.on[it.id] = !st.on[it.id]; bubble(st.on[it.id] ? '켰어요' : '껐어요'); }
      else if (it.act === 'music') { st.notes = 5; bubble('♪ 랄랄라'); }
      else if (it.act === 'play') bubble(['재밌다!', '좋아요 ♥', '헤헤'][Math.floor(Math.random() * 3)]);
      else bubble(it.name);
    });
  }
  function getUp() { if (me.act) { const t = frontOf(R(), Math.floor(me.i), Math.floor(me.j), 1, 1, 0); me.act = null; if (t) { me.i = t[0] + 0.5; me.j = t[1] + 0.5; } } }
  function onTap(ev) {
    const [x, y] = toLogical(ev);
    if (edit) return;
    const h = hitAt(x, y);
    if (h && h.kind !== 'rug') { getUp(); useItem(h); return; }
    const [ti, tj] = toTile(x, y);
    if (ti < 0 || tj < 0 || ti >= N || tj >= N) return;
    getUp(); walkTo([Math.floor(ti), Math.floor(tj)]);
  }

  /* ---------- 옷장 ---------- */
  function openWardrobe() {
    if (!mine()) { bubble(owner ? owner.nickname + '님의 옷장이에요' : '옷장'); return; }
    st.wdTarget = 1; const before = JSON.stringify(Hub.user.avatar);
    setTimeout(() => {
      const m = document.createElement('div'); m.className = 'room-modal'; m.innerHTML = '<div class="room-modal-in" role="dialog" aria-label="옷장"><button class="btn btn-sm room-x" type="button">옷장 닫기 ✕</button><div class="room-closet"></div></div>';
      document.body.appendChild(m); document.body.classList.add('room-modal-open');
      closetCleanup = window.GoCloset.render($('.room-closet', m), A);
      const close = () => { if (closetCleanup) { try { closetCleanup(); } catch (e) { /* noop */ } closetCleanup = null; } m.remove(); document.body.classList.remove('room-modal-open'); st.wdTarget = 0; if (Hub.user && JSON.stringify(Hub.user.avatar) !== before) { st.sparkle = 1.4; bubble('짠! 갈아입었어요'); } document.removeEventListener('keydown', onKey); };
      const onKey = e => { if (e.key === 'Escape') close(); };
      $('.room-x', m).addEventListener('click', close); m.addEventListener('click', e => { if (e.target === m) close(); }); document.addEventListener('keydown', onKey);
    }, reduce ? 0 : 380);
  }

  /* ---------- 꾸미기 ---------- */
  function okSpot(it, i, j, r, skipK) {
    const rm = draft;
    if (it.slot === 'wall') { if (i < 0 || i + it.w > N) return false; return !rm.walls.some((x, k) => k !== skipK && x[1] === carry.side && i < x[2] + F.byId[x[0]].w && x[2] < i + it.w); }
    const [w, d] = it.slot === 'wardrobe' ? [1, 1] : size(it, r);
    if (i < 0 || j < 0 || i + w > N || j + d > N) return false;
    if (it.slot === 'rug') return !rm.items.some((x, k) => { if (k === skipK) return false; const o = F.byId[x[0]]; if (!o || o.slot !== 'rug') return false; const [w2, d2] = size(o, x[3]); return i < x[1] + w2 && x[1] < i + w && j < x[2] + d2 && x[2] < j + d; });
    const b = blocks(rm, skipK);
    for (let a = i; a < i + w; a++) for (let c = j; c < j + d; c++) if (b.has(a + ',' + c)) return false;
    return true;
  }
  function placeCarry() {
    const it = carry.it;
    if (!carry.ok) { bubble('여기엔 놓을 수 없어요'); if (carry.from == null) { carry = null; renderBar(); } return false; }
    if (it.slot === 'wall') { if (carry.from != null) draft.walls[carry.from] = [it.id, carry.side, carry.i]; else draft.walls.push([it.id, carry.side, carry.i]); sel = { kind: 'wall', k: carry.from != null ? carry.from : draft.walls.length - 1 }; }
    else if (it.slot === 'wardrobe') { draft.wdAt = [carry.i, carry.j, carry.r]; sel = { kind: 'wd', k: 'wd' }; }
    else { const row = [it.id, carry.i, carry.j, carry.r]; if (carry.from != null) draft.items[carry.from] = row; else draft.items.push(row); sel = { kind: 'furn', k: carry.from != null ? carry.from : draft.items.length - 1 }; }
    carry = null; renderBar(); return true;
  }
  function moveCarry(x, y) {
    const it = carry.it;
    if (it.slot === 'wall') { carry.side = x < OX ? 'L' : 'R'; const t = carry.side === 'R' ? (x - OX) / F.TW : (OX - x) / F.TW; carry.i = Math.max(0, Math.min(N - it.w, Math.round(t - it.w / 2))); carry.ok = okSpot(it, carry.i, 0, 0, carry.from); return; }
    const [w, d] = it.slot === 'wardrobe' ? [1, 1] : size(it, carry.r), [ti, tj] = toTile(x, y);
    carry.i = Math.round(ti - w / 2); carry.j = Math.round(tj - d / 2);
    carry.ok = okSpot(it, carry.i, carry.j, carry.r, it.slot === 'wardrobe' ? 'wd' : carry.from);
  }
  let down = null;
  function onDown(ev) {
    if (!edit) return;
    const [x, y] = toLogical(ev);
    if (carry) { moveCarry(x, y); return; }
    const h = hitAt(x, y);
    if (!h) { sel = null; renderBar(); return; }
    sel = { kind: h.kind === 'rug' ? 'furn' : h.kind, k: h.k }; renderBar();
    down = { x, y, h, moved: false };
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* noop */ }
  }
  function onMove(ev) {
    if (!edit) return;
    const [x, y] = toLogical(ev);
    if (carry) { moveCarry(x, y); return; }
    if (down && !down.moved && Math.hypot(x - down.x, y - down.y) > 6) {   // 끌기 시작 → 들어 올림
      down.moved = true; const h = down.h;
      if (h.kind === 'wall') { const r0 = draft.walls[h.k]; carry = { it: F.byId[r0[0]], from: h.k, side: r0[1], i: r0[2], r: 0, drag: true }; }
      else if (h.kind === 'wd') carry = { it: F.byId[draft.wd], from: 'wd', i: draft.wdAt[0], j: draft.wdAt[1], r: draft.wdAt[2], drag: true };
      else { const r0 = draft.items[h.k]; carry = { it: F.byId[r0[0]], from: h.k, i: r0[1], j: r0[2], r: r0[3], drag: true }; }
      moveCarry(x, y);
    }
  }
  function onUp(ev) {
    if (!edit) return;
    if (carry && carry.drag) { if (!placeCarry()) carry = null; down = null; return; }
    if (carry && !carry.drag) { const [x, y] = toLogical(ev); moveCarry(x, y); placeCarry(); }
    down = null;
  }
  function rotateSel() {
    if (!sel) return;
    if (sel.kind === 'wd') { const r = draft.wdAt[2] ? 0 : 1; draft.wdAt[2] = r; return; }
    if (sel.kind === 'wall') return;
    const x = draft.items[sel.k], it = F.byId[x[0]], r = x[3] ? 0 : 1;
    const old = x[3]; x[3] = r; if (!okSpot(it, x[1], x[2], r, sel.k)) { x[3] = old; bubble('돌릴 자리가 없어요'); }
  }
  function storeSel() {
    if (!sel) return;
    if (sel.kind === 'wd') { bubble('옷장은 방에 꼭 있어야 해요'); return; }
    if (sel.kind === 'wall') draft.walls.splice(sel.k, 1); else draft.items.splice(sel.k, 1);
    sel = null; renderBar();
  }
  function pickFromBar(id) {
    const it = F.byId[id]; if (!it) return;
    if (it.slot === 'wallpaper') { draft.wp = id; renderBar(); return; }
    if (it.slot === 'floor') { draft.fl = id; renderBar(); return; }
    if (it.slot === 'wardrobe') { draft.wd = id; sel = { kind: 'wd', k: 'wd' }; renderBar(); return; }
    const k = it.slot === 'wall' ? draft.walls.findIndex(x => x[0] === id) : draft.items.findIndex(x => x[0] === id);
    if (k >= 0) { sel = { kind: it.slot === 'wall' ? 'wall' : 'furn', k }; renderBar(); return; }   // 이미 놓은 것 → 고르기
    carry = { it, from: null, i: 3, j: 3, r: 0, side: 'R', ok: false, drag: false }; moveCarry(OX, OY + 96); renderBar();
  }
  const placed = id => { const it = F.byId[id]; if (!it) return false; if (it.slot === 'wallpaper') return draft.wp === id; if (it.slot === 'floor') return draft.fl === id; if (it.slot === 'wardrobe') return draft.wd === id; return (it.slot === 'wall' ? draft.walls : draft.items).some(x => x[0] === id); };
  function renderBar() {
    const bar = $('#rmBar'); if (!bar) return;
    if (!edit) { bar.hidden = true; return; }
    bar.hidden = false;
    const slots = { furn: ['furn'], wall: ['wall'], rug: ['rug'], wardrobe: ['wardrobe'], wallpaper: ['wallpaper'], floor: ['floor'] }[tab];
    const list = F.ITEMS.filter(it => slots.includes(it.slot) && Hub.owns(it.id));
    const selName = sel ? (sel.kind === 'wd' ? F.byId[draft.wd].name : sel.kind === 'wall' ? (F.byId[(draft.walls[sel.k] || [])[0]] || {}).name : (F.byId[(draft.items[sel.k] || [])[0]] || {}).name) : '';
    bar.innerHTML = `
      <div class="rm-tools">${carry ? `<span class="rm-hint">방 안에서 놓을 곳을 누르세요 · <b>${esc(carry.it.name)}</b></span><button class="btn btn-sm" type="button" data-rm="cancelCarry">그만두기</button>`
        : sel ? `<span class="rm-hint">고른 것: <b>${esc(selName || '')}</b> · 끌어서 옮겨요</span>${sel.kind !== 'wall' ? '<button class="btn btn-sm" type="button" data-rm="rot">↻ 돌리기</button>' : ''}${sel.kind !== 'wd' ? '<button class="btn btn-sm" type="button" data-rm="store">보관하기</button>' : ''}`
        : '<span class="rm-hint">가구를 끌어서 옮기거나, 아래에서 골라 놓으세요</span>'}</div>
      <div class="mini-tabs rm-tabs">${F.CATS.map(([k, n]) => `<button type="button" data-rmtab="${k}" aria-pressed="${tab === k}">${n}</button>`).join('')}</div>
      <div class="rm-list">${list.length ? list.map(it => `<button type="button" class="rm-it ${placed(it.id) ? 'on' : ''}" data-rmit="${it.id}" title="${esc(it.name)}"><canvas data-th="${it.id}" width="128" height="128"></canvas><span>${esc(it.name)}</span>${placed(it.id) ? '<i>놓음</i>' : ''}</button>`).join('') : '<p class="empty">이 종류의 가구가 아직 없어요. <a href="#shop/furn" data-shopfurn>상점</a>에서 사 오세요!</p>'}
        <a class="rm-it rm-buy" href="#shop/furn" data-shopfurn><b>＋</b><span>가구 사러 가기</span></a></div>`;
    $$('canvas[data-th]', bar).forEach(c => { const t = F.thumb(c.dataset.th, 64); const g = c.getContext('2d'); g.clearRect(0, 0, 128, 128); g.drawImage(t, 0, 0, 128, 128); });
  }

  /* ---------- 화면 ---------- */
  function sfmt(gid, v) { const s = SET && SET.get(gid); return s && s.scoreText ? s.scoreText(v) : A.fmt(v); }
  function profileHTML() {
    if (!stats) return '<p class="empty">기록을 불러오는 중…</p>';
    const games = SET.listAll().filter(g => stats.per[g.id] && stats.per[g.id].plays > 0).sort((a, b) => stats.per[b.id].plays - stats.per[a.id].plays);
    const L = Hub.levelInfo(owner.earned || 0);
    return `<div class="tiles rm-tiles">
        <div class="tile"><span class="lbl">LEVEL</span><b class="num">Lv.${L.level}</b><span class="small" style="margin:0">누적 ${A.fmt(owner.earned || 0)}P</span></div>
        <div class="tile"><span class="lbl">TOTAL PLAYS</span><b class="num">${A.fmt(stats.total.plays)}판</b></div>
        <div class="tile"><span class="lbl">WIN / LOSE</span><b class="num"><span class="plus">${A.fmt(stats.total.wins)}승</span> <span class="minus">${A.fmt(stats.total.losses)}패</span></b></div>
        <div class="tile"><span class="lbl">GAMES</span><b class="num">${games.length}개</b></div>
      </div>
      ${games.length ? `<div class="tbl-wrap"><table><thead><tr><th>게임</th><th class="n">최고 기록</th><th class="n">승</th><th class="n">패</th><th class="n">플레이</th><th>마지막</th></tr></thead><tbody>
      ${games.map(g => { const p = stats.per[g.id]; return `<tr><td><a href="#${g.id}"><b>${esc(g.name)}</b></a></td><td class="n">${sfmt(g.id, p.best)}</td><td class="n plus">${A.fmt(p.wins)}</td><td class="n minus">${A.fmt(p.losses)}</td><td class="n">${A.fmt(p.plays)}</td><td>${p.last ? A.ago(p.last) : '-'}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="empty">아직 게임 기록이 없어요.</p>'}`;
  }
  function guestHTML() {
    if (!guests) return '<p class="empty">방명록을 불러오는 중…</p>';
    const u = Hub.user, canWrite = u && !u.banned;
    const form = canWrite ? `<form class="rm-gform" id="rmGForm"><input id="rmGIn" maxlength="120" placeholder="${mine() ? '내 방에 한마디 남기기' : esc(owner.nickname) + '님에게 한마디 (120자)'}" autocomplete="off"><button class="btn btn-primary btn-sm" type="submit">남기기</button></form>`
      : `<p class="small">방명록을 쓰려면 <button class="link" type="button" data-auth="login">로그인</button>해 주세요.</p>`;
    const FL = window.GoFilter;
    const note = `<p class="small rm-gnote">🔒 방명록 글은 <b>방 주인</b>과 <b>글쓴이</b>만 볼 수 있어요.${mine() ? '' : ' 다른 사람이 남긴 글은 보이지 않아요.'}</p>`;
    const list = guests.length ? `<ul class="rm-glist">${guests.map(g => { const canDel = u && (u.id === g.user_id || u.id === owner.id || Hub.isAdmin());
      return `<li class="${g.hidden ? 'is-hidden' : ''}">${A.avCanvas(g.avatar, 2, 'bust', 'rm-gav')}<div class="rm-gb"><div class="rm-gh"><a href="#room/${esc(g.username || g.user_id)}"><b>${esc(g.nickname)}</b></a><span class="small">${A.ago(g.created_at)}</span>${g.hidden ? '<span class="cm-tag hid">숨김</span>' : ''}</div><p>${FL ? FL.html(g.body) : esc(g.body)}</p></div>
        <div class="rm-gact">${Hub.isAdmin() ? `<button class="link" type="button" data-ghide="${g.id}" data-v="${g.hidden ? 0 : 1}">${g.hidden ? '보이기' : '숨기기'}</button>` : ''}${canDel ? `<button class="link" type="button" data-gdel="${g.id}">지우기</button>` : ''}</div></li>`; }).join('')}</ul>` : (mine() ? '<p class="empty">아직 방명록이 없어요.</p>' : '<p class="empty">아직 내가 남긴 글이 없어요. 한마디 남겨 보세요!</p>');
    return form + note + list;
  }
  function render() {
    if (!root) return;
    if (loadErr) { root.innerHTML = `<div class="panel"><p class="err">${esc(loadErr)}</p><a class="btn" href="#room">내 방으로</a></div>`; return; }
    if (!owner) {
      if (!key && !Hub.user) { root.innerHTML = `<div class="panel gate"><h2>로그인하면 내 방이 생겨요</h2><p>가구를 사서 방을 꾸미고, 옷장을 열어 옷을 갈아입고, 친구 방에 놀러 가 방명록을 남겨 보세요.</p><div class="row" style="justify-content:center"><button class="btn" type="button" data-auth="login">로그인</button><button class="btn btn-primary" type="button" data-auth="signup">회원가입</button></div></div>`; return; }
      root.innerHTML = '<div class="panel"><p class="empty">방을 불러오는 중…</p></div>'; return;
    }
    const own = mine();
    root.innerHTML = `
      <div class="stack room-page">
        <div class="panel room-box">
          <div class="room-head">
            <div class="room-who">${A.avCanvas(own ? Hub.user.avatar : owner.avatar, 2, 'bust', 'rm-hav')}<div><h1 class="room-title">${esc(owner.nickname)}<small>의 방</small></h1><div class="sub">@${esc(owner.username)}</div></div></div>
            <div class="room-count"><span>TODAY <b class="num" id="rmToday">${visits ? A.fmt(visits.today) : '-'}</b></span><span>TOTAL <b class="num" id="rmTotal">${visits ? A.fmt(visits.total) : '-'}</b></span></div>
            <div class="row room-btns">${own ? (edit ? '<button class="btn btn-primary" type="button" data-rm="save">저장</button><button class="btn" type="button" data-rm="cancel">취소</button>' : '<button class="btn btn-sun" type="button" data-rm="edit">방 꾸미기</button><a class="btn" href="#shop/furn" data-shopfurn>가구 상점</a>')
              : `${Hub.user ? '<a class="btn btn-room" href="#room"><span>내 방으로</span></a>' : ''}`}</div>
          </div>
          <div class="room-stage${edit ? ' editing' : ''}"><canvas id="rmCv" width="${VW * S}" height="${VH * S}" aria-label="${esc(owner.nickname)}의 방"></canvas>
            ${!edit ? `<p class="room-tip">${own ? '바닥을 누르면 걸어가요 · <b>옷장</b>을 누르면 옷을 갈아입어요 · 침대·의자·조명·창문도 눌러 보세요' : '가구를 눌러 보세요 · 아래에 방명록을 남길 수 있어요'}</p>` : ''}</div>
          <div class="room-bar" id="rmBar" hidden></div>
          ${Hub.noRoom && own ? '<p class="small err">아직 서버에 내 방 저장 칸이 없어요. 관리자가 supabase/room_v88.sql 을 실행하면 저장돼요.</p>' : ''}
        </div>
        <div class="panel rm-guest"><h3>방명록 <small>${guests ? guests.length : 0}</small></h3><div id="rmGuest">${guestHTML()}</div></div>
        <div class="panel rm-prof"><h3>${esc(owner.nickname)}님의 게임 기록</h3><div id="rmProf">${profileHTML()}</div></div>
      </div>`;
    AV.paintAll(root);
    cv = $('#rmCv'); ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    cv.addEventListener('click', onTap); cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp);
    renderBar();
    if (!raf) { loop.t = 0; raf = requestAnimationFrame(loop); }
  }
  function partial() {   // 방명록 · 기록만 다시
    const g = $('#rmGuest'); if (g) { g.innerHTML = guestHTML(); AV.paintAll(g); const h = $('.rm-guest h3 small'); if (h) h.textContent = guests ? guests.length : 0; }
    const p = $('#rmProf'); if (p) p.innerHTML = profileHTML();
    const t = $('#rmToday'), tt = $('#rmTotal'); if (t && visits) { t.textContent = A.fmt(visits.today); tt.textContent = A.fmt(visits.total); }
  }
  async function load() {
    loadErr = null; owner = null; stats = null; guests = null; visits = null; edit = false; carry = null; sel = null;
    const k = key || (Hub.user && Hub.user.id);
    if (!k) { render(); return; }
    render();
    try { owner = await Hub.profileOf(k); } catch (e) { loadErr = e.message; render(); return; }
    if (!root) return;
    if (!owner) { loadErr = '그런 아이디의 방을 찾지 못했어요.'; render(); return; }
    room = Hub.normRoom(owner.room);
    const b = blocks(room); me.i = 4.5; me.j = 5.5; me.path = []; me.act = null; if (b.has('4,5')) freeSpotFor(room);
    render();
    Hub.roomVisit(owner.id).then(v => { visits = v; partial(); }).catch(() => {});
    Hub.guestList(owner.id).then(g => { guests = g; partial(); }).catch(() => { guests = []; partial(); });
    Hub.userStats(owner.id).then(s => { stats = s; partial(); }).catch(() => { stats = { per: {}, total: { plays: 0, wins: 0, losses: 0 } }; partial(); });
  }
  function freeSpotFor(rm) { const b = blocks(rm); for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) if (!b.has(i + ',' + j)) { me.i = i + 0.5; me.j = j + 0.5; return; } }

  async function onClick(e) {
    const t = e.target.closest('[data-rm],[data-rmtab],[data-rmit],[data-gdel],[data-ghide]');
    if (!t || !root || !root.contains(t)) return;
    if (t.dataset.rmtab) { tab = t.dataset.rmtab; renderBar(); return; }
    if (t.dataset.rmit) { pickFromBar(t.dataset.rmit); return; }
    if (t.dataset.gdel) { if (!confirm('이 방명록 글을 지울까요?')) return; try { await Hub.guestDelete(+t.dataset.gdel); guests = guests.filter(g => g.id !== +t.dataset.gdel); partial(); } catch (err) { A.toast(err.message); } return; }
    if (t.dataset.ghide) { try { await Hub.guestHide(+t.dataset.ghide, t.dataset.v === '1'); guests = await Hub.guestList(owner.id); partial(); } catch (err) { A.toast(err.message); } return; }
    const a = t.dataset.rm;
    if (a === 'edit') { edit = true; draft = JSON.parse(JSON.stringify(room)); sel = null; carry = null; me.act = null; me.path = []; render(); }
    else if (a === 'cancel') { edit = false; draft = null; carry = null; sel = null; render(); }
    else if (a === 'save') {
      if (busy) return; busy = true; t.disabled = true;
      try { room = await Hub.saveRoom(draft); edit = false; draft = null; carry = null; sel = null; freeSpot(); A.toast('방을 저장했어요!'); render(); }
      catch (err) { A.toast(err.message); t.disabled = false; }
      finally { busy = false; }
    }
    else if (a === 'rot') rotateSel();
    else if (a === 'store') storeSel();
    else if (a === 'cancelCarry') { carry = null; renderBar(); }
  }
  async function onSubmit(e) {
    if (e.target.id !== 'rmGForm') return; e.preventDefault();
    const inp = $('#rmGIn'), body = inp.value.trim(); if (!body || busy) return;
    busy = true;
    try { const row = await Hub.guestAdd(owner.id, body); guests = [row].concat(guests || []); inp.value = ''; partial(); }
    catch (err) { A.toast(err.message); }
    finally { busy = false; }
  }

  window.GoRoom = {
    render(el, app, k) {
      A = app; root = el; key = k || null; tab = 'furn'; st.on = {}; st.night = false; st.wdOpen = 0; st.wdTarget = 0;
      el.addEventListener('click', onClick); el.addEventListener('submit', onSubmit);
      load();
      Hub.loadPrices && Hub.loadPrices().catch(() => {});
      return function cleanup() {
        el.removeEventListener('click', onClick); el.removeEventListener('submit', onSubmit);
        if (raf) cancelAnimationFrame(raf); raf = 0; root = null; cv = null; ctx = null;
        if (closetCleanup) { try { closetCleanup(); } catch (e) { /* noop */ } closetCleanup = null; }
        const m = document.querySelector('.room-modal'); if (m) { m.remove(); document.body.classList.remove('room-modal-open'); }
      };
    },
    refresh() { if (!root || edit) return; if (!key || (owner && Hub.user && owner.id === Hub.user.id)) load(); else render(); },
    // 시험용
    _state: () => ({ owner, room, draft, edit, me, st, sel, carry })
  };
})();
