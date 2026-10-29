/*
 * gogo?gogo! — 아바타 테니스 (오락실 '버추어 테니스'처럼 내 코트가 아래, 상대가 위쪽인 원근 코트)
 *  - 1:1 · AI 대전(쉬움·보통·어려움) · 한 기기 둘이서 · 온라인(다른 기기 친구)
 *  - 실제 코트 크기(m)로 계산하고 화면에는 원근으로 그림: x = 좌우(가운데 0), y = 길이(내 베이스라인 0 → 상대 23.77), z = 높이
 *  - 서브: 스트로크 키 한 번 = 공 올리기, 한 번 더 = 치기. 대각선 서비스 박스에 넣어야 함 (폴트 2번 = 더블 폴트)
 *  - 랠리: 상대 코트에 한 번 튀게 넣기. 한 번 튀기 전이나 튄 뒤에 받아치기 (두 번 튀면 실점, 아웃·네트면 친 사람 실점)
 *  - 스트로크 키를 공이 오기 전에 미리 눌러 두면 공이 닿는 거리에 왔을 때 알아서 침. 칠 때 방향키로 보낼 곳을 정함
 *  - 점수: 0 · 15 · 30 · 40 · 게임 (40:40 듀스 → AD → 게임). settings.js 의 gamesToWin 게임을 먼저 따면 승리
 *  - 온라인: 방장 기기가 경기를 계산하고 상태를 보냄. 손님은 자기 쪽이 아래로 보이게 뒤집어서 그림
 *  - 스킬 5가지 (v30, 경기 전에 하나 고름 · 아바타 배구처럼): 순간이동 · 거대화 · 불꽃 스매시 · 마구 커브 · 얼음
 *    이름·다시 쓰기 시간·효과 시간은 settings.js 의 skills 에서 바꿈
 */
(function () {
  'use strict';
  const S = window.GoSport, AV = window.GoAvatar;
  const W = 960, H = 540;
  // 코트 (m)
  const L = 23.77, NETY = L / 2, SX = 4.115, DX = 5.485, SVC = 6.4, NET_H = 0.95, BALL_R = 0.07;
  const G = 9.8, RUN = 6.2, REACH = 1.35, Y_NEAR = [-1.4, NETY - 0.6], Y_FAR = [NETY + 0.6, L + 3], X_LIM = 6.4;
  // 원근 (카메라는 내 베이스라인 뒤 위쪽)
  const CAMD = 15.1, CAMH = 8, F = 991, H0 = -55;   // 내 베이스라인이 화면 아래쪽에 크게, 상대 베이스라인은 위쪽 1/4 쯤
  const cfg = () => window.GoSettings.get('tennis') || {};
  const DIR = 'games/sports/tennis/';
  const sideName = s => (s === 0 ? '아래' : '위');
  const SKILLS = () => cfg().skills || [];
  const skillOf = p => SKILLS()[(p.skill || 0) - 1];

  /* ---------- 화면 좌표 ---------- */
  let FLIP = false;   // 온라인 손님(위쪽 자리)은 자기 쪽이 아래로 보이게 뒤집음
  function proj(x, y, z) {
    if (FLIP) { x = -x; y = L - y; }
    const d = Math.max(4, y + CAMD), s = F / d;
    return { x: W / 2 + x * s, y: H0 + (CAMH - (z || 0)) * s, s };
  }
  const viewY = y => (FLIP ? L - y : y);   // 화면 앞뒤 순서 정렬용

  /* ---------- 코트 그리기 ---------- */
  function poly(ctx, pts, fill) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function line(ctx, a, b, w) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineWidth = w; ctx.stroke(); }
  function drawStadium(ctx) {
    // 위쪽 관중석 · 광고판
    const top = H0 + CAMH * F / (L + 6.5 + CAMD);   // 화면 위쪽 관중석 경계 (뒤집힌 화면에서도 같은 자리)
    const sky = ctx.createLinearGradient(0, 0, 0, top); sky.addColorStop(0, '#141A44'); sky.addColorStop(1, '#2A3478');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, top + 2);
    for (let i = 0; i < 260; i++) { const x = (i * 97) % W, y = 8 + ((i * 53) % Math.max(10, top - 40)); ctx.fillStyle = ['#FFD23F', '#FF7EB6', '#7FE3FF', '#FFFFFF', '#3DDC84'][i % 5]; ctx.globalAlpha = 0.5; ctx.fillRect(x, y, 3, 3); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1D3FA0'; ctx.fillRect(0, top - 30, W, 30);
    ctx.font = '700 18px Galmuri11, Pretendard, sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (let x = 60; x < W; x += 190) { ctx.fillStyle = (x / 190 | 0) % 2 ? '#FFD23F' : '#FFFFFF'; ctx.fillText((x / 190 | 0) % 2 ? 'gogo?gogo!' : 'GOGO TENNIS', x, top - 15); }
    // 바닥 (코트 밖은 초록)
    ctx.fillStyle = '#2E9E5B'; ctx.fillRect(0, top, W, H - top);
  }
  function drawCourt(ctx) {
    const c = (x, y) => proj(x, y, 0);
    poly(ctx, [c(-DX - 1.2, -3), c(DX + 1.2, -3), c(DX + 1.2, L + 3), c(-DX - 1.2, L + 3)], '#3FA866');
    poly(ctx, [c(-DX, 0), c(DX, 0), c(DX, L), c(-DX, L)], '#2F7FD0');
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineCap = 'butt';
    const lw = (y) => Math.max(1.5, 0.06 * F / (y + CAMD) * (FLIP ? 1 : 1));
    [[-DX, 0, -DX, L], [DX, 0, DX, L], [-SX, 0, -SX, L], [SX, 0, SX, L], [-DX, 0, DX, L * 0], [-DX, L, DX, L],
      [-SX, NETY - SVC, SX, NETY - SVC], [-SX, NETY + SVC, SX, NETY + SVC], [0, NETY - SVC, 0, NETY + SVC], [0, 0, 0, 0.3], [0, L, 0, L - 0.3]]
      .forEach(([x1, y1, x2, y2]) => line(ctx, c(x1, y1), c(x2, y2), lw(Math.min(viewY(y1), viewY(y2)))));
    line(ctx, c(-DX, 0), c(DX, 0), lw(0));
  }
  function drawNet(ctx) {
    const px = DX + 0.9;
    const a = proj(-px, NETY, 0), b = proj(px, NETY, 0), at = proj(-px, NETY, 1.07), bt = proj(px, NETY, 1.07), mt = proj(0, NETY, NET_H);
    // 그물
    ctx.fillStyle = 'rgba(20,24,40,.35)';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(bt.x, bt.y); ctx.lineTo(mt.x, mt.y); ctx.lineTo(at.x, at.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
    for (let i = 1; i < 40; i++) { const x = -px + (2 * px * i) / 40, p0 = proj(x, NETY, 0), p1 = proj(x, NETY, NET_H + (1.07 - NET_H) * Math.abs(x) / px); line(ctx, p0, p1, 1); }
    for (let z = 0.15; z < 1; z += 0.15) line(ctx, proj(-px, NETY, z), proj(px, NETY, z), 1);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(at.x, at.y); ctx.lineTo(mt.x, mt.y); ctx.lineTo(bt.x, bt.y); ctx.stroke();
    ctx.fillStyle = '#1D2340'; [[a, at], [b, bt]].forEach(([p, q]) => ctx.fillRect(p.x - 4, q.y - 4, 8, p.y - q.y + 4));
    // 심판 의자 (그물 왼쪽)
    const u = proj(-DX - 2.2, NETY, 0), us = u.s;
    ctx.fillStyle = '#E8ECF8'; ctx.fillRect(u.x - 0.45 * us, u.y - 1.6 * us, 0.12 * us, 1.6 * us); ctx.fillRect(u.x + 0.33 * us, u.y - 1.6 * us, 0.12 * us, 1.6 * us);
    ctx.fillStyle = '#1D3FA0'; ctx.fillRect(u.x - 0.55 * us, u.y - 1.75 * us, 1.1 * us, 0.25 * us); ctx.fillRect(u.x - 0.55 * us, u.y - 2.5 * us, 0.18 * us, 0.8 * us);
    S.drawFighter(ctx, S.cpuAvatar('umpire'), 'idle', u.x + 0.05 * us, u.y - 1.7 * us, Math.max(0.8, 1.2 * us / S.SPRITE.h), 1);
  }

  /* ---------- 라켓 (아바타 손 위치에) ---------- */
  const HAND = { idle: [13.5, 19.5, 0.9, 1.1], walk1: [13.5, 19.5, 0.9, 1.1], walk2: [13.5, 19.5, 0.9, 1.1], punch: [20, 13.5, 1, -0.5], spike: [13.5, 3.5, 0.25, -1], jump: [14, 8.5, 0.6, -1] };
  function drawRacket(ctx, pose, x, y, sc, face) {
    const h = HAND[pose] || HAND.idle, gw = AV.size.w;
    const hx = x + face * (h[0] - gw / 2) * sc, hy = y - S.SPRITE.h * sc + h[1] * sc;
    const dx = face * h[2], dy = h[3], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const ex = hx + ux * 3.2 * sc, ey = hy + uy * 3.2 * sc, cx = hx + ux * 5.6 * sc, cy = hy + uy * 5.6 * sc;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#2B2B3A'; ctx.lineWidth = Math.max(1.5, sc * 0.9); ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.translate(cx, cy); ctx.rotate(Math.atan2(uy, ux));
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.strokeStyle = '#FF5A5F'; ctx.lineWidth = Math.max(1.5, sc * 0.8);
    ctx.beginPath(); ctx.ellipse(0, 0, 2.6 * sc, 1.9 * sc, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  window.GoGames.tennis = {
    id: 'tennis', size: [W, H],
    thumb(ctx, w, h) {
      ctx.save(); ctx.scale(w / W, h / H); FLIP = false;
      drawStadium(ctx); drawCourt(ctx);
      const far = proj(1.5, L - 0.5, 0); S.drawFighter(ctx, S.cpuAvatar('tn1'), 'idle', far.x, far.y, 1.4, -1);
      drawNet(ctx);
      const me = proj(-1.2, -0.4, 0); S.drawFighter(ctx, S.myAvatar(), 'spike', me.x, me.y, 3.2, 1); drawRacket(ctx, 'spike', me.x, me.y, 3.2, 1);
      const b = proj(-0.9, 0, 3.1); ctx.fillStyle = '#E8FF4A'; ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      let mode = 'ai', level = 'normal', phase = 'idle', raf = 0, last = 0, timer = 0, count = 0;
      let P = [], ball = null, pts = [0, 0], games = [0, 0], server = 0, faults = 0, rallies = 0, msg = null, net = null, trail = [];
      const online = () => mode === 'online', isHost = () => !online() || (net && net.host);
      const SPD = () => cfg().speed || 1;
      const now = () => performance.now() / 1000;

      /* ---------- 조작 ---------- */
      const KEYS = {
        KeyA: 'k0.left', KeyD: 'k0.right', KeyW: 'k0.up', KeyS: 'k0.down', KeyF: 'k0.shot', KeyG: 'k0.lob', KeyJ: 'k0.shot', Space: 'k0.shot', KeyK: 'k0.lob', KeyE: 'k0.skill', KeyL: 'k0.skill',
        ArrowLeft: 'k1.left', ArrowRight: 'k1.right', ArrowUp: 'k1.up', ArrowDown: 'k1.down', Enter: 'k1.shot', NumpadEnter: 'k1.shot', Period: 'k1.shot', Numpad0: 'k1.shot', ShiftRight: 'k1.lob', Slash: 'k1.lob', ControlRight: 'k1.skill', Comma: 'k1.skill', NumpadDecimal: 'k1.skill',
        Digit1: 'pick1', Digit2: 'pick2', Digit3: 'pick3', Digit4: 'pick4', Digit5: 'pick5', Numpad1: 'pick1', Numpad2: 'pick2', Numpad3: 'pick3', Numpad4: 'pick4', Numpad5: 'pick5'
      };
      const input = S.keys(KEYS, a => onKey(a));
      const touch = S.touchDevice() ? S.pad(canvas, W, H, [
        { id: 'me.left', label: '◀', x: 70, y: 450, r: 48, font: 28 }, { id: 'me.right', label: '▶', x: 200, y: 450, r: 48, font: 28 },
        { id: 'me.up', label: '▲', x: 135, y: 385, r: 40, font: 24 }, { id: 'me.down', label: '▼', x: 135, y: 505, r: 32, font: 20 },
        { id: 'me.shot', label: '스트로크', x: W - 175, y: 460, r: 56, font: 18 }, { id: 'me.lob', label: '로브', x: W - 62, y: 380, r: 42, font: 18 },
        { id: 'me.skill', label: '스킬', x: W - 62, y: 488, r: 38, font: 18 }
      ], input, a => onKey(a)) : null;
      // 이 사람이 쓰는 키 묶음: 혼자·온라인·AI 대전은 0·1(WASD·방향키 둘 다)과 화면 버튼, 한 기기 둘이서는 1P=0, 2P=1
      const ctl = (p, k) => (p.remote ? !!p.remote[k] : p.ks.some(q => input.down['k' + q + '.' + k]) || (p.mine && !!input.down['me.' + k]));
      function onKey(a) {
        if (phase === 'pick') { const v = /^pick(\d)$/.exec(a); if (v) choose(+v[1]); return; }
        const m = a.match(/^(k(\d)|me)\.(shot|lob|skill)$/); if (!m) return;
        const p = P.find(q => q.human && !q.remote && (m[1] === 'me' ? q.mine : q.ks.includes(+m[2])));
        if (!p) return;
        if (m[3] === 'skill') { if (isHost()) useSkill(p); else send({ k: 'act', s: p.side, a: 'skill' }); return; }
        if (isHost()) act(p, m[3]); else send({ k: 'act', s: p.side, a: m[3] });
      }

      /* ---------- 스킬 고르기 (경기 전, 아바타 배구와 같은 방식) ---------- */
      // 한 기기의 사람들은 차례로(1P → 2P), 온라인은 각자 자기 것만. 컴퓨터는 무작위
      let pick = 0;
      const pickers = () => P.filter(p => p.human && !p.remote);
      const randSkill = () => 1 + Math.floor(Math.random() * Math.max(1, SKILLS().length));
      function choose(v) {
        if (phase !== 'pick' || v < 1 || v > SKILLS().length) return;
        const list = pickers(), p = list[pick]; if (!p) return;
        p.skill = v; pick++;
        if (online()) { send({ k: 'pick', s: p.side, v }); if (pick >= list.length) { phase = 'waitpick'; status(); } if (isHost()) hostTryGo(); return; }
        if (pick >= list.length) { P.forEach(q => { if (!q.skill) q.skill = randSkill(); }); goCount(); }
        else status();
      }
      function hostTryGo() {
        if (!isHost() || (phase !== 'pick' && phase !== 'waitpick')) return;
        if (P.some(q => q.human && !q.skill)) return;
        P.forEach(q => { if (!q.skill) q.skill = randSkill(); });
        send({ k: 'go', sk: P.map(q => q.skill) });
        goCount();
      }
      function goCount() { phase = 'count'; count = 2.5; status(); }
      const pickRects = () => { const n = SKILLS().length, w = 168, gap = 14, x0 = (W - (n * w + (n - 1) * gap)) / 2; return SKILLS().map((s, i) => ({ s, x: x0 + i * (w + gap), y: 178, w, h: 230 })); };
      const onPick = e => {
        if (phase !== 'pick') return;
        const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
        const r = pickRects().find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
        if (r) choose(r.s.id);
      };
      canvas.addEventListener('pointerdown', onPick);

      /* ---------- 스킬 쓰기 (방장·혼자만 계산) ---------- */
      function useSkill(p) {
        const sk = skillOf(p), t = now();
        if (!sk || t - p.lastSkill < sk.cd) return false;
        if (phase !== 'rally' && phase !== 'serve' && phase !== 'toss') return false;
        const o = P[1 - p.side];
        if (sk.id === 1) {                                    // 순간이동: 칠 수 있는 곳으로
          if (!ball || !ball.live || ball.last === p.side || phase !== 'rally') return false;
          const pr = predict(p, 999); if (!pr) return false;
          puff(p.x, p.y, sk.color); p.x = pr.x - 0.45 * Math.sign(pr.x - p.x || 1); p.y = pr.y; p.ai.tx = p.x; p.ai.ty = p.y;
          if (p.human) { p.ready = 0.9; p.kind = 'shot'; }
        } else if (sk.id === 2) p.giantUntil = t + (sk.dur || 3);   // 거대화
        else if (sk.id === 3 || sk.id === 4) { p.armed = sk.id; p.armUntil = t + (sk.dur || 4); }   // 다음 공 강화
        else if (sk.id === 5) o.slowUntil = t + (sk.dur || 2);      // 얼음
        p.lastSkill = t; puff(p.x, p.y, sk.color);
        say(p.name + ' · ' + sk.name + '!', sk.color, 1.1);
        return true;
      }
      let fx = [];
      function puff(x, y, color) { for (let i = 0; i < 14; i++) fx.push({ x, y, z: 0.4 + Math.random() * 1.4, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: Math.random() * 3, life: 0.6, color }); }
      // 다음 공 강화(불꽃·커브)를 칠 때 적용
      function applyArmed(p, b) {
        if (!p.armed || now() > p.armUntil) { p.armed = 0; return 1; }
        const sk = SKILLS()[p.armed - 1] || {}, a = p.armed; p.armed = 0;
        if (a === 3) { b.fx = 3; return sk.power || 1.4; }
        b.fx = 4; b.curve = (Math.random() < 0.5 ? -1 : 1) * (sk.curve || 7); return 1;
      }
      // 커브 공: 휘어도 같은 곳에 떨어지도록 처음 옆 속도를 반대로 조금
      function bend(b) { if (!b.curve) return; const T = Math.abs(b.vy) > 0.1 ? Math.abs((b.ty - b.y) / b.vy) : 0; b.vx -= b.curve * T / 2; }

      /* ---------- 선수 ---------- */
      function makePlayer(side, av, name, human, ks, mine) {
        return { side, av, name, human, ks: ks || [], mine: !!mine, remote: null, flip: false, x: 0, y: side === 0 ? -0.8 : L + 0.8, face: 1, walk: 0, swing: 0, ready: 0, kind: 'shot', toss: 0,
          skill: 0, lastSkill: -99, giantUntil: 0, slowUntil: 0, armed: 0, armUntil: 0,
          ai: { tx: 0, ty: side === 0 ? -0.8 : L + 0.8, think: 0, wait: 0 } };
      }
      const toward = p => (p.side === 0 ? 1 : -1);   // 상대 코트 쪽 (y 방향)
      // 화면 기준 입력 → 경기장 방향 (손님 뒤집힌 화면은 반대로)
      function moveInput(p) {
        let mx = (ctl(p, 'right') ? 1 : 0) - (ctl(p, 'left') ? 1 : 0), my = (ctl(p, 'up') ? 1 : 0) - (ctl(p, 'down') ? 1 : 0);
        if (p.flip) { mx = -mx; my = -my; }
        return { mx, my };
      }

      /* ---------- 공 ---------- */
      function newBall(x, y, z) { return { x, y, z, vx: 0, vy: 0, vz: 0, last: -1, bounces: 0, serve: false, live: false, firstAt: null, fx: 0, curve: 0 }; }
      // 목표 지점(tx, ty)에 떨어지도록 속도 정하기 (그물은 넘게)
      function launch(b, tx, ty, hsp, minNet) {
        const dx = tx - b.x, dy = ty - b.y, dist = Math.hypot(dx, dy) || 1;
        let T = dist / hsp;
        for (let k = 0; k < 30; k++) {
          const vz = (G * T * T / 2 - b.z) / T, vy = dy / T;
          const tn = (NETY - b.y) / vy;
          if (!(tn > 0 && tn < T)) break;
          const zn = b.z + vz * tn - G * tn * tn / 2;
          if (zn >= minNet) break;
          T *= 1.07;
        }
        b.vx = dx / T; b.vy = dy / T; b.vz = (G * T * T / 2 - b.z) / T; b.ty = ty;
      }
      const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;

      /* ---------- 서브 ---------- */
      const deuceCourt = () => (pts[0] + pts[1]) % 2 === 0;
      function serveX(side) { const s = deuceCourt() ? 1 : -1; return s * (side === 0 ? 1 : -1) * 0.9; }
      function setupServe() {
        const sv = P[server], rc = P[1 - server], sx = serveX(server);
        sv.x = sx; sv.y = server === 0 ? -0.5 : L + 0.5; sv.toss = 0;
        rc.x = -Math.sign(sx) * 2.4; rc.y = server === 0 ? L + 0.9 : -0.9;
        P.forEach(p => { p.swing = 0; p.ready = 0; p.ai.wait = 0.7 + Math.random() * 0.6; });
        ball = newBall(sv.x + 0.35 * toward(sv), sv.y + 0.2 * toward(sv), 1.0); ball.held = true;
        phase = 'serve'; status();
      }
      function act(p, kind) {
        if (phase === 'serve' && P[server] === p && ball && ball.held) {   // 공 올리기
          ball.held = false; ball.z = 1.2; ball.vz = 6.2; ball.vx = ball.vy = 0; p.toss = 1; phase = 'toss'; return;
        }
        if (phase === 'toss' && P[server] === p) return hitServe(p);
        if (phase === 'rally') { p.ready = 0.8; p.kind = kind; }
      }
      function hitServe(p) {
        const peak = 1.2 + 6.2 * 6.2 / (2 * G), q = Math.max(0, 1 - Math.abs(ball.z - peak) / 1.4);   // 꼭대기에서 칠수록 좋음
        const side = p.side, box = -Math.sign(serveX(side));          // 대각선 박스 쪽 x 부호
        let ax = 0;
        if (p.human) { const mv = moveInput(p); ax = mv.mx; } else ax = Math.random() < 0.5 ? -1 : 1;
        let tx = box * (2.05 + ax * box * 1.3), ty = NETY + toward(p) * (SVC - 0.9);
        const L2 = p.human ? null : cfg().bots[level] || cfg().bots.normal;
        const err = p.human ? 0.25 + (1 - q) * 1.4 : 0.25 + (L2 ? L2.out * 4 : 0.3);
        tx += gauss() * err; ty += gauss() * err * 0.9 * toward(p);
        ball.serve = true; ball.live = true; ball.last = side; ball.bounces = 0; ball.fx = 0; ball.curve = 0;
        const boost = applyArmed(p, ball);
        launch(ball, tx, ty, (15 + q * 11) * SPD() * (boost > 1 ? 1 + (boost - 1) * 0.6 : 1), q > 0.35 ? 1.02 : 0.85); bend(ball);
        p.swing = 0.3; p.toss = 0; phase = 'rally'; rallies++;
        if (q > 0.85) say('나이스 서브!', '#FFD23F', 0.8);
      }

      /* ---------- 받아치기 ---------- */
      function tryHit(p, dt) {
        if (!ball.live || ball.last === p.side || ball.bounces > 1) return;
        if (ball.serve && ball.bounces === 0) return;   // 서브는 한 번 튄 뒤에 받기
        const dx = ball.x - p.x, dy = ball.y - p.y, d = Math.hypot(dx, dy);
        const big = now() < p.giantUntil, reach = REACH * (big ? 1.75 : 1);
        if (d > reach || ball.z > (big ? 3.6 : 2.8) || ball.z < 0.02) return;
        // 공이 내 코트 쪽으로 오고 있을 때만
        if ((ball.vy * toward(p)) > 0 && ball.bounces === 0) return;
        let kind = p.kind, ax = 0, depth = 0, err;
        if (p.human) {
          if (p.ready <= 0) return;
          const mv = moveInput(p); ax = mv.mx; depth = mv.my * toward(p);
          err = 0.22 + Math.pow(d / reach, 2) * 0.9 + (ball.z > 2.2 && !big ? 0.4 : 0) + (ball.fx === 3 ? 0.35 : 0);   // 불꽃 공은 받기 어려움
        } else {
          const B = cfg().bots[level] || cfg().bots.normal;
          if (p.ai.miss) return;
          const opp = P[1 - p.side];
          ax = opp.x > 0.8 ? -1 : opp.x < -0.8 ? 1 : (Math.random() < 0.5 ? -1 : 1);
          depth = Math.random() < 0.6 ? 1 : Math.random() < 0.5 ? 0 : -1;
          kind = Math.abs(opp.y - NETY) < 4 && Math.random() < 0.55 ? 'lob' : 'shot';
          err = B.err * 0.5 + (Math.random() < B.out ? 1.6 : 0);
        }
        const into = (dist) => NETY + toward(p) * dist;
        let tx = ax * 3.45 + (ax === 0 ? gauss() * 1.2 : 0), ty = into(kind === 'lob' ? 9.6 : depth > 0 ? 10.1 : depth < 0 ? 4.6 : 8.0);
        tx += gauss() * err; ty += gauss() * err * toward(p);
        tx = Math.max(-X_LIM, Math.min(X_LIM, tx));
        ball.last = p.side; ball.bounces = 0; ball.serve = false; ball.firstAt = null; ball.fx = 0; ball.curve = 0;
        ball.z = Math.max(ball.z, 0.4);
        const boost = applyArmed(p, ball); if (boost > 1) kind = 'shot';
        const hsp = (kind === 'lob' ? 8.6 : 17 + (p.human ? 4 * (1 - d / reach) : (level === 'hard' ? 3.5 : level === 'easy' ? -2.5 : 1))) * SPD() * boost;   // 가운데로 맞히면 더 빠름
        launch(ball, tx, ty, hsp, kind === 'lob' ? 3.6 : boost > 1 ? 1.02 : 1.12); bend(ball);
        p.swing = 0.28; p.ready = 0; rallies++;
        P.forEach(q => { q.ai.think = 0; });
      }

      /* ---------- 점수 ---------- */
      function pointTo(side, why) {
        if (phase !== 'rally' && phase !== 'toss') return;
        ball.live = false;
        pts[side]++;
        const o = 1 - side;
        let text = why;
        if (pts[side] >= 4 && pts[side] - pts[o] >= 2) {
          games[side]++; pts = [0, 0]; faults = 0;
          text = why + ' · ' + P[side].name + ' 게임!';
          if (games[side] >= (cfg().gamesToWin || 3)) { say(text, '#FFD23F', 2.4); phase = 'end'; timer = 1.8; status(); return; }
          server = 1 - server;
        }
        faults = 0;
        say(text, side === 0 ? '#FFE48A' : '#BFE3FF', 1.6);
        phase = 'point'; timer = 1.7; status();
      }
      function fault(why) {
        ball.live = false;
        if (faults === 0) { faults = 1; say(why + ' · 폴트!', '#FF9A3D', 1.3); phase = 'refault'; timer = 1.3; return; }
        faults = 0; phase = 'rally'; pointTo(1 - server, '더블 폴트');
      }
      const ptText = (a, b) => {
        if (a >= 3 && b >= 3) return a === b ? '듀스' : a > b ? 'AD' : '40';
        return ['0', '15', '30', '40'][Math.min(3, a)];
      };
      function say(text, color, sec) { msg = { text, color, until: now() + (sec || 1.4) }; }

      /* ---------- 컴퓨터 ---------- */
      // 공이 내 쪽에서 칠 수 있는 곳을 미리 계산: 튄 뒤(또는 그물 앞이면 튀기 전) 높이 0.25~2.2m, 내가 갈 수 있는 범위,
      // 그 시간 안에 뛰어갈 수 있는 가장 빠른 곳. 없으면 가장 가까운 곳
      const slowK = p => (now() < p.slowUntil ? (SKILLS()[4] || {}).slow || 0.4 : 1);
      function predict(p, spOver) {
        const side = p.side, B = cfg().bots[level] || cfg().bots.normal, sp = spOver || RUN * B.run * slowK(p);
        let x = ball.x, y = ball.y, z = ball.z, vx = ball.vx, vy = ball.vy, vz = ball.vz, bo = ball.bounces;
        const dt = 1 / 60, yr = side === 0 ? Y_NEAR : Y_FAR; let near = null, nearD = 1e9;
        for (let k = 1; k < 260; k++) {
          vz -= G * dt; x += vx * dt; y += vy * dt; z += vz * dt;
          if (z <= BALL_R && vz < 0) { z = BALL_R; vz = -vz * 0.72; vx *= 0.82; vy *= 0.82; bo++; if (bo > 1) break; }
          const mine = side === 0 ? y < NETY - 0.5 : y > NETY + 0.5;
          if (!mine || z < 0.25 || z > 2.2 || (ball.serve && bo === 0)) continue;
          const gy = Math.max(yr[0], Math.min(yr[1], y)), gap = Math.abs(gy - y);
          if (gap > REACH * 0.8) continue;                                   // 내가 설 수 없는 곳(코트 훨씬 뒤)
          if (bo === 0 && Math.abs(y - NETY) > 4.5) continue;               // 튀기 전에는 그물 가까이에서만 (발리)
          const need = Math.hypot(x - p.x, gy - p.y) / sp;
          if (need <= k * dt + 0.05) return { x, y: gy, t: k * dt };
          if (need - k * dt < nearD) { nearD = need - k * dt; near = { x, y: gy, t: k * dt }; }
        }
        return near;
      }
      // 컴퓨터 스킬: 쓸 만한 때에만 B.skill 확률로
      function aiSkill(p, B, hard, coming) {
        const sk = skillOf(p); if (!sk || now() - p.lastSkill < sk.cd || Math.random() > (B.skill || 0)) return;
        if (sk.id === 1 && coming && hard) { if (useSkill(p)) p.ai.miss = Math.random() < B.miss; }   // 못 갈 공 → 순간이동
        else if (sk.id === 2 && coming && hard) { useSkill(p); p.ai.tight = 0; p.ai.miss = Math.random() < B.miss; }
        else if ((sk.id === 3 || sk.id === 4) && coming && !p.armed) useSkill(p);
        else if (sk.id === 5 && !coming) useSkill(p);
      }
      function aiStep(p, dt) {
        const B = cfg().bots[level] || cfg().bots.normal;
        p.ai.think -= dt;
        if (p.ai.think <= 0) {
          p.ai.think = B.react;
          const coming = ball && ball.live && ball.last !== p.side;
          if (coming) {
            const pr = predict(p);
            const need = pr ? Math.hypot(pr.x - p.x, pr.y - p.y) / (RUN * B.run * slowK(p)) : 9;
            if (pr && p.ai.shot !== rallies) p.ai.tight = need > pr.t * 0.75 ? 0.22 : 0;   // 멀리 뛰어야 하면 더 놓침
            if (pr) { p.ai.tx = pr.x + gauss() * B.err * 0.2; p.ai.ty = pr.y; }
            if (p.ai.shot !== rallies) {   // 공 하나마다 한 번만 정함 (빠른 공·커브 공은 더 놓침)
              p.ai.shot = rallies; const fast = Math.hypot(ball.vx, ball.vy) > 18 ? 0.08 : 0, trick = ball.fx === 3 ? 0.12 : ball.fx === 4 ? 0.1 : 0;
              p.ai.miss = Math.random() < B.miss + fast + trick + (p.ai.tight || 0);
              aiSkill(p, B, need > (pr ? pr.t : 0) || (p.ai.tight > 0), true);
            }
          } else { p.ai.tx = (ball ? ball.x : 0) * 0.3; p.ai.ty = p.side === 0 ? -0.6 : L + 0.6; p.ai.miss = false; if (ball && ball.live && ball.last === p.side && p.ai.sent !== rallies) { p.ai.sent = rallies; aiSkill(p, B, false, false); } }
        }
        let mx = p.ai.tx - p.x, my = p.ai.ty - p.y; const d = Math.hypot(mx, my);
        if (d < 0.12) return { mx: 0, my: 0, sp: 0 };
        return { mx: mx / d, my: my / d, sp: B.run * Math.min(1, d / 0.6) };
      }

      /* ---------- 한 프레임 (방장·혼자만) ---------- */
      function step(dt) {
        P.forEach(p => {
          let mv, sp = 1;
          if (p.human) { mv = moveInput(p); const l = Math.hypot(mv.mx, mv.my) || 1; mv.mx /= l; mv.my /= l; }
          else { const a = aiStep(p, dt); mv = { mx: a.mx, my: a.my }; sp = a.sp; }
          const serving = (phase === 'serve' || phase === 'toss') && P[server] === p;
          if (serving) { if (p.human) { p.x += mv.mx * RUN * 0.3 * dt; } mv = { mx: 0, my: 0 }; }
          sp *= slowK(p);
          p.x += mv.mx * RUN * sp * dt; p.y += mv.my * RUN * sp * dt;
          p.x = Math.max(-X_LIM, Math.min(X_LIM, p.x));
          const yr = p.side === 0 ? Y_NEAR : Y_FAR; p.y = Math.max(yr[0], Math.min(yr[1], p.y));
          if (serving) { const sx = serveX(server); p.x = Math.max(Math.min(sx, 0) - 0.2, Math.min(Math.max(sx, 0) + 0.2, p.x)); if (ball && ball.held) { ball.x = p.x + 0.35 * toward(p); ball.y = p.y + 0.2 * toward(p); } }
          if (mv.mx || mv.my) p.walk += dt * 9; else p.walk = 0;
          if (p.swing > 0) p.swing -= dt; if (p.ready > 0) p.ready -= dt;
          // 공 쪽을 바라봄 (화면 기준 좌우)
          if (ball) { const ps = proj(p.x, p.y, 0), bs = proj(ball.x, ball.y, 0); if (Math.abs(bs.x - ps.x) > 4) p.face = bs.x > ps.x ? 1 : -1; }
          if (phase === 'rally') tryHit(p, dt);
          // 컴퓨터 서브
          if (!p.human && P[server] === p) {
            if (phase === 'serve') { p.ai.wait -= dt; if (p.ai.wait <= 0) act(p, 'shot'); }
            else if (phase === 'toss') { const peak = 1.2 + 6.2 * 6.2 / (2 * G); if (ball.vz <= 0.4 + Math.random() * 0.8 || ball.z > peak - 0.05) hitServe(p); }
          }
        });
        if (!ball || ball.held) return;
        // 공 움직이기
        const py = ball.y;
        if (ball.curve && ball.bounces === 0 && ball.live) ball.vx += ball.curve * dt;   // 커브 공 (튀기 전까지 휘어짐)
        ball.vz -= G * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
        if (phase === 'toss') {
          if (ball.z < 1.0 && ball.vz < 0) { ball.held = true; ball.z = 1.0; phase = 'serve'; P[server].toss = 0; P[server].ai.wait = 0.5; say('다시 올려요', '#FFFFFF', 0.8); }
          return;
        }
        // 그물
        if (ball.live && (py - NETY) * (ball.y - NETY) <= 0 && ball.z < NET_H + 0.04 && Math.abs(ball.x) < DX + 0.9) {
          ball.y = NETY - 0.05 * Math.sign(ball.vy); ball.vy = -ball.vy * 0.12; ball.vx *= 0.3; ball.vz = Math.min(ball.vz, 0);
          if (ball.serve) { fault('네트'); return; }
          ball.netted = true;
        }
        if (ball.z <= BALL_R && ball.vz < 0) {
          ball.z = BALL_R; ball.vz = -ball.vz * 0.72; ball.vx *= 0.82; ball.vy *= 0.82; ball.curve = 0;
          trail.push({ x: ball.x, y: ball.y, t: now() });
          if (!ball.live) return;
          const hitter = ball.last, oppSide = 1 - hitter;
          const onOpp = hitter === 0 ? ball.y > NETY : ball.y < NETY;
          if (ball.bounces === 0) {
            if (ball.serve) {
              const box = -Math.sign(serveX(hitter));
              const inBox = onOpp && Math.abs(ball.y - NETY) <= SVC + 0.05 && ball.x * box >= -0.05 && Math.abs(ball.x) <= SX + 0.05;
              if (!inBox) { fault(onOpp ? '아웃' : '네트'); return; }
            } else {
              const inCourt = onOpp && Math.abs(ball.x) <= SX + 0.05 && (hitter === 0 ? ball.y <= L + 0.05 : ball.y >= -0.05);
              if (!inCourt) { pointTo(oppSide, onOpp ? '아웃!' : '네트!'); return; }
            }
            ball.bounces = 1;
          } else {
            pointTo(hitter, ball.serve ? '서브 에이스!' : '두 번 튀었어요');
          }
        }
        // 멀리 날아가면 (튀기 전에 밖으로 나가는 경우 등)
        if (ball.live && (ball.y < -9 || ball.y > L + 9 || Math.abs(ball.x) > 14)) pointTo(ball.bounces ? ball.last : 1 - ball.last, ball.bounces ? '받지 못했어요' : '아웃!');
      }

      /* ---------- 끝 ---------- */
      const mySide = () => { const me = P.find(p => p.mine); return me ? me.side : 0; };
      function finish(winSide, why) {
        if (phase === 'over') return;
        phase = 'over'; clock.stop();
        if (net && net.host) send({ k: 'end', w: winSide, g: games, why: why || '' });
        let m;
        if (winSide < 0) m = why || '경기가 끝났어요';
        else if (mode === 'local') m = `${P[winSide].name} 승리! 게임 ${games[0]} : ${games[1]}`;
        else m = (winSide === mySide() ? '승리! ' : '아쉬워요 ') + `게임 ${games[mySide()]} : ${games[1 - mySide()]}` + (why ? ' · ' + why : '');
        hooks.onTurn({ text: m, side: -1 });
        hooks.onOver({ winner: winSide < 0 ? -1 : (mode === 'online' ? winSide : winSide), win: winSide < 0 ? null : (mode === 'local' ? undefined : winSide === mySide()), message: m, moves: rallies, duration_sec: clock.sec(), extra: { games: games.slice(), players: 2, skill: (P.find(p => p.mine) || P[0]).skill } });
        render();
      }
      function status() {
        if (!P.length) return;
        if (phase === 'pick') { const p = pickers()[pick]; return hooks.onTurn({ text: (p ? p.name : '') + ' · 스킬을 고르세요 (1~' + SKILLS().length + ')', side: p ? p.side : 0 }); }
        if (phase === 'waitpick') return hooks.onTurn({ text: '다른 사람이 스킬을 고르는 중…', side: -1 });
        const g = cfg().gamesToWin || 3;
        hooks.onTurn({ text: `${P[0].name} ${games[0]} : ${games[1]} ${P[1].name} · 게임 점수 ${ptText(pts[0], pts[1])}-${ptText(pts[1], pts[0])} · ${g}게임 먼저 · 서브 ${P[server].name}`, side: server });
      }

      /* ---------- 온라인 ---------- */
      const SNAP_MS = 70;
      function send(m) { if (online() && hooks.onMove) hooks.onMove(m); }
      const r2 = v => Math.round(v * 100) / 100;
      function hostSnap() {
        send({ k: 'st', ph: phase, c: Math.round(count * 10) / 10, pt: pts, gm: games, sv: server, fa: faults, rl: rallies,
          b: ball ? [r2(ball.x), r2(ball.y), r2(ball.z), ball.held ? 1 : 0, ball.fx || 0] : 0,
          p: P.map(p => { const t = now(); return [r2(p.x), r2(p.y), p.face, p.swing > 0 ? 1 : 0, p.toss ? 1 : 0, Math.round(p.walk * 2) % 8,
            p.skill, Math.round(Math.min(99, (t - p.lastSkill) * 10)), Math.max(0, Math.round((p.giantUntil - t) * 10)), Math.max(0, Math.round((p.slowUntil - t) * 10)), p.armed && t < p.armUntil ? p.armed : 0]; }),
          m: msg && msg.until > now() ? [msg.text, msg.color, Math.round((msg.until - now()) * 10)] : 0 });
      }
      function applySnap(m) {
        net.sm.push(m);
        if (phase !== 'over' && phase !== 'pick' && m.ph !== phase) { phase = m.ph; }
        count = m.c; pts = m.pt; games = m.gm; server = m.sv; faults = m.fa; rallies = m.rl;
        const t = now();
        m.p.forEach((a, i) => { const p = P[i]; if (!p) return; p.face = a[2]; p.swing = a[3] ? 0.2 : 0; p.toss = a[4]; p.walk = a[5] / 2;
          if (a[6]) p.skill = a[6]; p.lastSkill = t - (a[7] || 0) / 10; p.giantUntil = t + (a[8] || 0) / 10; p.slowUntil = t + (a[9] || 0) / 10; p.armed = a[10] || 0; p.armUntil = t + 1; });
        if (ball && m.b) ball.fx = m.b[4] || 0;
        if (m.m && (!msg || msg.text !== m.m[0])) msg = { text: m.m[0], color: m.m[1], until: now() + m.m[2] / 10 };
        status();
      }
      function clientPose() {
        const sm = net.sm; if (!sm.ready) return;
        const a = sm.prev, b = sm.cur;
        if (b.b) { ball = ball || newBall(0, 0, 0); ball.fx = b.b[4] || 0; const ab = a.b || b.b; ball.x = sm.mix(ab[0], b.b[0]); ball.y = sm.mix(ab[1], b.b[1]); ball.z = sm.mix(ab[2], b.b[2]); ball.held = !!b.b[3]; }
        P.forEach((p, i) => { const pa = a.p[i], pb = b.p[i]; if (!pa || !pb) return; p.x = sm.mix(pa[0], pb[0]); p.y = sm.mix(pa[1], pb[1]); });
      }
      function clientInput() {
        const me = P.find(p => p.mine); if (!me) return;
        const ks = ['left', 'right', 'up', 'down'], bits = ks.reduce((s, k, i) => s | (ctl(me, k) ? 1 << i : 0), 0);
        if (bits !== net.lastKey || performance.now() - net.lastSent > 900) { net.lastKey = bits; net.lastSent = performance.now(); send({ k: 'in', s: me.side, b: bits }); }
      }

      /* ---------- 그리기 ---------- */
      function render() {
        ctx.save(); ctx.imageSmoothingEnabled = false;
        drawStadium(ctx); drawCourt(ctx);
        if (phase === 'pick') { drawPick(); ctx.restore(); return; }
        // 공 자국
        const t = now(); trail = trail.filter(m => t - m.t < 1.2);
        trail.forEach(m => { const p = proj(m.x, m.y, 0); ctx.globalAlpha = 1 - (t - m.t) / 1.2; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.16 * p.s, 0.06 * p.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; });
        // 앞뒤 순서: 화면 위쪽(먼 쪽)부터 → 그물 → 가까운 쪽
        const things = P.map(p => ({ y: viewY(p.y), draw: () => drawPlayer(p) }));
        if (ball) things.push({ y: viewY(ball.y), draw: drawBall });
        const farFirst = things.filter(o => o.y > NETY).sort((a, b) => b.y - a.y), near = things.filter(o => o.y <= NETY).sort((a, b) => b.y - a.y);
        farFirst.forEach(o => o.draw()); drawNet(ctx); near.forEach(o => o.draw());
        fx.forEach(f => { const q = proj(f.x, f.y, f.z); ctx.globalAlpha = Math.max(0, f.life / 0.6); ctx.fillStyle = f.color; const r = Math.max(2, 0.07 * q.s); ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2); }); ctx.globalAlpha = 1;
        hud();
        if (phase === 'waitpick') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); S.text(ctx, '다른 사람이 스킬을 고르는 중…', W / 2, H / 2, 32, '#fff'); }
        if (phase === 'count') S.text(ctx, String(Math.max(1, Math.ceil(count))), W / 2, H / 2 - 20, 96, '#FF5A5F');
        if (phase === 'paused') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); S.text(ctx, '일시정지', W / 2, H / 2 - 20, 48, '#fff'); S.text(ctx, '화면을 누르거나 [일시정지 / 계속] 버튼을 누르면 계속해요', W / 2, H / 2 + 36, 22, '#FFE45C'); }
        if (touch && phase !== 'over' && phase !== 'idle' && phase !== 'waitpick') touch.draw(ctx);
        ctx.restore();
      }
      // 스킬 고르기 화면
      function keyHelp(p) {
        if (!p) return '';
        if (touch && p.mine) return '휴대폰: 스킬 버튼';
        if (mode === 'local') return p.ks[0] === 0 ? 'E 또는 L' : '오른쪽 Ctrl 또는 ,';
        return 'E 또는 L';
      }
      function drawPick() {
        ctx.fillStyle = 'rgba(11,14,34,.74)'; ctx.fillRect(0, 0, W, H);
        const p = pickers()[pick];
        S.text(ctx, (p ? p.name : '') + ' · 스킬을 고르세요', W / 2, 82, 30, '#FFD23F');
        S.text(ctx, '숫자 1~' + SKILLS().length + ' 키 또는 카드를 눌러요 · 경기 중 스킬 키: ' + keyHelp(p), W / 2, 128, 15, '#fff', 'center', 400);
        pickRects().forEach((r, i) => {
          ctx.fillStyle = '#FFFDF6'; ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = r.s.color; ctx.fillRect(r.x, r.y, r.w, 10);
          ctx.strokeStyle = '#1A1F3D'; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h);
          S.text(ctx, (i + 1) + '. ' + r.s.name, r.x + r.w / 2, r.y + 40, 20, '#1A1F3D');
          skillIcon(ctx, r.s.id, r.x + r.w / 2, r.y + 92, r.s.color);
          wrap(r.s.desc, r.w - 22).forEach((ln, k) => S.text(ctx, ln, r.x + r.w / 2, r.y + 140 + k * 19, 13, '#3A3F5C', 'center', 400));
          S.text(ctx, '다시 쓰기 ' + r.s.cd + '초', r.x + r.w / 2, r.y + r.h - 16, 12, '#8890B8', 'center', 400);
        });
        if (mode === 'ai') S.text(ctx, '컴퓨터는 무작위로 하나를 골라요', W / 2, 446, 14, '#BFE3FF', 'center', 400);
      }
      function wrap(t, w) {
        ctx.font = '400 13px Galmuri11, Pretendard, sans-serif';
        const out = []; let cur = '';
        for (const ch of t) { if (ctx.measureText(cur + ch).width > w && cur) { out.push(cur.trim()); cur = ''; } cur += ch; }
        if (cur.trim()) out.push(cur.trim()); return out.slice(0, 4);
      }
      // 카드 그림 (간단한 픽셀 기호)
      function skillIcon(c, id, x, y, col) {
        c.save(); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 4;
        if (id === 1) { for (let i = 0; i < 3; i++) { c.globalAlpha = 0.35 + i * 0.3; c.fillRect(x - 34 + i * 22, y - 12, 14, 24); } }
        else if (id === 2) { c.fillRect(x - 6, y - 26, 12, 52); c.fillRect(x - 26, y - 6, 52, 12); c.fillRect(x - 20, y - 20, 12, 12); c.fillRect(x + 8, y + 8, 12, 12); }
        else if (id === 3) { c.beginPath(); c.moveTo(x - 6, y - 28); c.lineTo(x + 14, y - 2); c.lineTo(x + 2, y - 2); c.lineTo(x + 8, y + 28); c.lineTo(x - 14, y - 2); c.lineTo(x - 2, y - 2); c.closePath(); c.fill(); }
        else if (id === 4) { c.beginPath(); c.arc(x, y + 30, 40, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); c.beginPath(); c.arc(x + 32, y + 6, 7, 0, Math.PI * 2); c.fillStyle = '#E8FF4A'; c.fill(); }
        else { for (let i = 0; i < 3; i++) { c.save(); c.translate(x, y); c.rotate(i * Math.PI / 3); c.fillRect(-3, -26, 6, 52); c.restore(); } }
        c.restore();
      }
      function drawPlayer(p) {
        const t = now(), big = t < p.giantUntil, cold = t < p.slowUntil;
        const g = proj(p.x, p.y, 0), sc = Math.max(0.9, 1.85 * g.s / S.SPRITE.h) * (big ? 1.5 : 1);
        S.shadow(ctx, g.x, g.y + 2, 0.9 * g.s);
        const pose = p.toss ? 'spike' : p.swing > 0 ? 'punch' : p.walk > 0 ? (Math.floor(p.walk) % 2 ? 'walk1' : 'walk2') : 'idle';
        S.drawFighter(ctx, p.av, pose, g.x, g.y, sc, p.face);
        drawRacket(ctx, pose, g.x, g.y, sc, p.face);
        if (cold) { ctx.fillStyle = 'rgba(159,232,255,.38)'; ctx.fillRect(g.x - 0.5 * g.s, g.y - S.SPRITE.h * sc, g.s, S.SPRITE.h * sc); }
        const top = g.y - S.SPRITE.h * sc - 10;
        S.text(ctx, (p.mine && online() ? '▼ ' : '') + p.name, g.x, top, Math.max(11, Math.min(15, 0.32 * g.s)), p.side === 0 ? '#FFE48A' : '#BFE3FF');
        const sk = skillOf(p);
        if (sk) { const rd = Math.min(1, (t - p.lastSkill) / sk.cd), bw = Math.max(34, 0.9 * g.s); S.bar(ctx, g.x - bw / 2, top + 9, bw, 5, rd, rd >= 1 ? sk.color : '#8890B8'); }
        if (cold) S.text(ctx, '얼음!', g.x, top - 18, 15, '#9FE8FF');
        if (p.armed && t < p.armUntil && sk) S.text(ctx, sk.name + ' 준비', g.x, top - 18, 13, sk.color);
        if (p.human && p.ready > 0 && phase === 'rally') { ctx.strokeStyle = p.kind === 'lob' ? '#C792FF' : '#FFD23F'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, 0.75 * g.s, 0.22 * g.s, 0, 0, Math.PI * 2); ctx.stroke(); }
      }
      function drawBall() {
        if (!ball) return;
        const gnd = proj(ball.x, ball.y, 0), b = proj(ball.x, ball.y, ball.z), r = Math.max(3, BALL_R * 1.6 * b.s);
        S.shadow(ctx, gnd.x, gnd.y, Math.max(6, 0.3 * gnd.s));
        if (ball.fx === 3) { ctx.fillStyle = 'rgba(255,122,47,.45)'; ctx.beginPath(); ctx.arc(b.x, b.y, r * 2.3, 0, Math.PI * 2); ctx.fill(); }
        if (ball.fx === 4) { ctx.fillStyle = 'rgba(255,126,182,.45)'; ctx.beginPath(); ctx.arc(b.x, b.y, r * 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = ball.fx === 3 ? '#FFB13D' : '#E8FF4A'; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(30,40,0,.6)'; ctx.lineWidth = 1; ctx.stroke();
      }
      function hud() {
        if (!P.length) return;
        // 왼쪽 위 점수판 (게임 · 포인트)
        const x = 14, y = 12, rows = FLIP ? [0, 1] : [1, 0];   // 위 줄 = 화면 위쪽 선수
        ctx.fillStyle = 'rgba(11,14,34,.85)'; ctx.fillRect(x, y, 300, 66);
        ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 300, 66);
        ctx.fillStyle = 'rgba(255,210,63,.18)'; ctx.fillRect(x + 196, y + 2, 36, 62);   // 게임 수 칸
        rows.forEach((side, i) => {
          const yy = y + 18 + i * 30, p = P[side];
          if (server === side) { ctx.fillStyle = '#E8FF4A'; ctx.beginPath(); ctx.arc(x + 12, yy, 5, 0, Math.PI * 2); ctx.fill(); }
          S.text(ctx, p.name.slice(0, 8), x + 24, yy, 15, side === 0 ? '#FFE48A' : '#BFE3FF', 'left');
          S.text(ctx, String(games[side]), x + 214, yy, 18, '#FFFFFF');
          S.text(ctx, ptText(pts[side], pts[1 - side]), x + 268, yy, 16, '#FFD23F');
        });
        if (faults && (phase === 'serve' || phase === 'toss')) S.text(ctx, '세컨드 서브', W - 90, 92, 16, '#FF9A3D');
        // 오른쪽 위: 내 스킬 (한 기기 둘이서는 두 사람 다)
        const shown = mode === 'local' ? P : P.filter(p => p.mine);
        shown.forEach((p, i) => {
          const sk = skillOf(p); if (!sk) return;
          const rd = Math.min(1, (now() - p.lastSkill) / sk.cd), bx = W - 214, by = 12 + i * 36;
          ctx.fillStyle = 'rgba(11,14,34,.85)'; ctx.fillRect(bx, by, 200, 30); ctx.strokeStyle = sk.color; ctx.lineWidth = 2; ctx.strokeRect(bx, by, 200, 30);
          S.text(ctx, (mode === 'local' ? (p.side === 0 ? '1P ' : '2P ') : '') + sk.name, bx + 10, by + 15, 14, sk.color, 'left');
          S.bar(ctx, bx + 112, by + 11, 78, 8, rd, rd >= 1 ? sk.color : '#8890B8');
        });
        const t = now();
        if (msg && msg.until > t) S.text(ctx, msg.text, W / 2, 150, 30, msg.color);
        const me = P.find(p => p.mine && p.human) || (mode === 'local' ? P[server] : null);
        if (phase === 'serve' && P[server] && P[server].human && (mode === 'local' || P[server].mine)) S.text(ctx, (mode === 'local' ? P[server].name + ' · ' : '') + (touch ? '서브: 스트로크 버튼' : '서브: 스트로크 키로 공 올리기'), W / 2, touch ? H - 90 : H - 40, 18, '#FFFFFF');
        if (phase === 'toss' && P[server] && P[server].human && (mode === 'local' || P[server].mine)) S.text(ctx, '꼭대기에서 한 번 더!', W / 2, touch ? H - 90 : H - 40, 20, '#FFD23F');
        if (me && phase === 'rally' && rallies <= 2 && !me.ready) S.text(ctx, touch ? '공이 오기 전에 스트로크!' : '공이 오기 전에 스트로크 키를 미리 눌러요 · 칠 때 ←→ 방향', W / 2, touch ? H - 90 : H - 40, 16, '#FFFFFF', 'center', 400);
      }

      function loop(ts) {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
        if (!isHost()) { if (phase !== 'over') { clientPose(); clientInput(); } }
        else if (phase === 'count') { count -= dt; if (count <= 0) setupServe(); }
        else if (phase === 'point') { timer -= dt; stepIdle(dt); if (timer <= 0) setupServe(); }
        else if (phase === 'refault') { timer -= dt; if (timer <= 0) { const keep = faults; setupServe(); faults = keep; } }
        else if (phase === 'end') { timer -= dt; stepIdle(dt); if (timer <= 0) finish(games[0] > games[1] ? 0 : 1); }
        else if (phase === 'serve' || phase === 'toss' || phase === 'rally') { let acc = dt; while (acc > 1e-4 && (phase === 'serve' || phase === 'toss' || phase === 'rally')) { const h = Math.min(1 / 120, acc); step(h); acc -= h; } }
        if (net && net.host && phase !== 'over' && phase !== 'pick' && phase !== 'waitpick' && ts - net.lastSnap >= SNAP_MS) { net.lastSnap = ts; hostSnap(); }
        fx.forEach(f => { f.x += f.vx * dt; f.y += f.vy * dt; f.z = Math.max(0, f.z + f.vz * dt); f.vz -= 6 * dt; f.life -= dt; }); fx = fx.filter(f => f.life > 0);
        render();
      }
      // 점수가 난 뒤: 공만 굴러가게
      function stepIdle(dt) { if (!ball || ball.held) return; ball.vz -= G * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; if (ball.z <= BALL_R && ball.vz < 0) { ball.z = BALL_R; ball.vz = -ball.vz * 0.6; ball.vx *= 0.7; ball.vy *= 0.7; } P.forEach(p => { if (p.swing > 0) p.swing -= dt; p.walk = 0; }); }
      const onDown = () => { if (phase === 'paused') phase = pausedFrom; };
      canvas.addEventListener('pointerdown', onDown);
      const vis = () => { if (document.hidden && (phase === 'rally' || phase === 'serve' || phase === 'toss') && !online()) { pausedFrom = phase; phase = 'paused'; } };
      let pausedFrom = 'rally';
      document.addEventListener('visibilitychange', vis);
      render(); raf = requestAnimationFrame(loop);

      return {
        get state() { return phase === 'over' ? 'over' : phase === 'idle' ? 'ready' : 'playing'; },
        start(o) {
          o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal';
          const me = S.myAvatar(), meName = S.myName();
          net = null; P = []; FLIP = false;
          if (mode === 'online') {
            const roster = o.roster || [];
            net = { host: !!o.host, sm: S.smoother(SNAP_MS), lastSnap: 0, lastKey: -1, lastSent: 0 };
            for (let side = 0; side < 2; side++) {
              const r = roster[side], mine = side === o.me;
              const p = r ? makePlayer(side, mine ? me : (r.avatar || S.cpuAvatar('net-' + r.id)), mine ? meName : r.nick, true, mine ? [0, 1] : [], mine) : makePlayer(side, S.cpuAvatar('tnet-' + side), '컴퓨터', false);
              if (r && !mine) { p.remote = net.host ? {} : null; p.netId = r.id; if (!net.host) p.human = false; }
              p.flip = side === 1;   // 위쪽 자리 사람은 뒤집힌 화면으로 조작
              P.push(p);
            }
            FLIP = o.me === 1;
          } else if (mode === 'local') {
            P.push(makePlayer(0, me, '1P ' + meName, true, [0], true));
            P.push(makePlayer(1, S.cpuAvatar('friend-tn'), '2P', true, [1], false));
          } else {
            P.push(makePlayer(0, me, meName, true, [0, 1], true));
            P.push(makePlayer(1, S.cpuAvatar('tennis-' + level), '컴퓨터', false));
          }
          pts = [0, 0]; games = [0, 0]; faults = 0; rallies = 0; msg = null; trail = []; fx = []; pick = 0;
          server = online() ? 0 : Math.random() < 0.5 ? 0 : 1;
          ball = null; phase = SKILLS().length ? 'pick' : 'count'; count = 2.5;
          clock.reset(); clock.start(); hooks.onState('playing');
          hooks.onButtons(online() ? [] : [{ id: 'pause', label: '일시정지 / 계속' }]); status(); render();
        },
        remote(m) {
          if (!m || !net) return;
          if (m.left && !m.k) {
            if (m.wasHost && !net.host) return finish(-1, '방장이 나가서 경기가 끝났어요');
            const p = P.find(q => q.netId === m.left); if (p && net.host) { p.human = false; p.remote = null; p.name += '(컴퓨터)'; if (!p.skill) p.skill = randSkill(); hostTryGo(); }
            return;
          }
          if (net.host) {
            const p = P[m.s];
            if (m.k === 'in' && p && p.remote) p.remote = { left: !!(m.b & 1), right: !!(m.b & 2), up: !!(m.b & 4), down: !!(m.b & 8) };
            else if (m.k === 'act' && p && p.remote) { if (m.a === 'skill') useSkill(p); else act(p, m.a); }
            else if (m.k === 'pick' && p) { p.skill = m.v; hostTryGo(); }
            else if (m.k === 'resign' && p) finish(1 - p.side, p.name + ' 기권');
          } else {
            if (m.k === 'st') applySnap(m);
            else if (m.k === 'go') { m.sk.forEach((v, i) => { if (P[i]) P[i].skill = v; }); if (phase === 'waitpick' || phase === 'pick') goCount(); }
            else if (m.k === 'end') { games = m.g; finish(m.w, m.why); }
          }
        },
        press(id) {
          if (id === 'pause') return this.togglePause();
          if (id === 'resign' && phase !== 'over' && phase !== 'idle') {
            if (online()) { const me = P.find(p => p.mine); if (net.host) finish(1 - me.side, me.name + ' 기권'); else send({ k: 'resign', s: me.side }); return; }
            const m = mode === 'ai' ? '기권 · 컴퓨터 승' : P[0].name + ' 기권';
            phase = 'over'; clock.stop();
            hooks.onTurn({ text: m, side: -1 });
            hooks.onOver({ winner: 1, win: mode === 'ai' ? false : undefined, message: m, moves: rallies, duration_sec: clock.sec(), extra: { games: games.slice(), resigned: true } });
          }
        },
        togglePause() {
          if (online()) return;
          if (phase === 'rally' || phase === 'serve' || phase === 'toss') { pausedFrom = phase; phase = 'paused'; }
          else if (phase === 'paused') phase = pausedFrom;
        },
        action() {},
        destroy() { cancelAnimationFrame(raf); input.off(); if (touch) touch.off(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerdown', onPick); document.removeEventListener('visibilitychange', vis); }
      };
    }
  };
})();
