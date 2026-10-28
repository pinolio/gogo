/*
 * gogo?gogo! — 아바타 배구 (원작: 선생님의 '피카츄 배구' 파이썬 게임을 웹으로 옮김)
 *  - 내 아바타 vs 컴퓨터 / 둘이서 한 기기. 먼저 정해진 점수(settings.js winScore)를 내면 승리.
 *  - 스킬 4가지 (경기 전에 하나 고름): 순간이동 · 거대화 · 속박 · 혼란
 *  - 배경 '학교 강당' 그림은 Meshy AI 로 만든 그림을 줄여서 사용 (gym.jpg)
 */
(function () {
  'use strict';
  const S = window.GoSport, AV = window.GoAvatar;
  const W = 960, H = 540, GROUND = 488, NET_X = W / 2, NET_H = 168, NET_TOP = GROUND - NET_H;
  const G = 0.5, BALL_G = 0.3, BALL_R = 20, SPEED = 6.4, JUMP = -14;
  const SCALE = 3, PW = 46, PH = 80;                 // 아바타 3배, 몸 판정 크기
  const DIR = 'games/sports/volley/';
  const SKILLS = [
    { id: 1, name: '순간이동', cd: 6, desc: '공이 있는 곳으로 순간이동 (공이 그물보다 낮을 때)', color: '#3BC8F5' },
    { id: 2, name: '거대화', cd: 4, desc: '2초 동안 몸이 2배로 커짐', color: '#3DDC84' },
    { id: 3, name: '속박', cd: 8, desc: '상대를 0.5초 동안 바닥에 묶어 둠', color: '#FF5A5F' },
    { id: 4, name: '혼란', cd: 9, desc: '상대의 좌우 이동을 2초 동안 반대로', color: '#A66BFF' }
  ];
  const LV = { easy: { react: 0.55, err: 70, speed: 0.72, skill: 0.004 }, normal: { react: 0.8, err: 34, speed: 0.9, skill: 0.01 }, hard: { react: 1, err: 10, speed: 1, skill: 0.02 } };

  function settings() { return (window.GoSettings.get('volley') || {}); }

  function drawCourt(ctx, bg) {
    if (S.ready(bg)) { ctx.imageSmoothingEnabled = false; ctx.drawImage(bg, 0, 0, W, H); }
    else { const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#F4E3C3'); gr.addColorStop(0.7, '#E2B97A'); gr.addColorStop(1, '#C98F4A'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
    // 코트 바닥선
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(0, GROUND, W, 3);
    ctx.fillStyle = 'rgba(40,20,0,.18)'; ctx.fillRect(0, GROUND + 3, W, H - GROUND - 3);
  }
  function drawNet(ctx) {
    ctx.fillStyle = '#2B2F45'; ctx.fillRect(NET_X - 4, NET_TOP - 6, 8, NET_H + 6);
    ctx.fillStyle = '#F4F4F4'; ctx.fillRect(NET_X - 3, NET_TOP, 6, NET_H);
    ctx.fillStyle = 'rgba(30,30,50,.35)'; for (let y = NET_TOP + 6; y < GROUND; y += 10) ctx.fillRect(NET_X - 3, y, 6, 2);
    ctx.fillStyle = '#FF5A5F'; ctx.fillRect(NET_X - 6, NET_TOP - 10, 12, 8);
  }

  window.GoGames.volley = {
    id: 'volley', size: [W, H], SKILLS,
    thumb(ctx, w, h) {
      const bg = S.image(DIR + 'gym.jpg');
      const paint = () => {
        ctx.save(); ctx.clearRect(0, 0, w, h); ctx.scale(w / W, h / H); drawCourt(ctx, bg); drawNet(ctx);
        S.drawFighter(ctx, S.myAvatar(), 'spike', 250, GROUND, 4, 1);
        S.drawFighter(ctx, S.cpuAvatar('v1'), 'jump', 720, GROUND - 40, 4, -1);
        const ball = S.image(DIR + 'ball.png'); if (S.ready(ball)) ctx.drawImage(ball, 360, 150, 66, 66);
        ctx.restore();
      };
      paint(); S.onImages(paint);
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      const bg = S.image(DIR + 'gym.jpg'), ballImg = S.image(DIR + 'ball.png');
      let mode = 'ai', level = 'normal', phase = 'idle', raf = 0, last = 0, timer = 0, n = 2;
      let players = [], ball = null, score = [0, 0], serveSide = 0, count = 0, pick = 0, rallies = 0, flash = null, fx = [];
      // 온라인: host = 실제로 경기를 계산하는 기기(방장), mySlot = 내 자리
      let net = null;
      const goal = () => settings().winScore || 15;
      const online = () => mode === 'online';
      const isHost = () => !online() || (net && net.host);

      /* ---------- 조작 키 (원작 2:2 배치를 따름) ----------
       * 1P: A·D 이동, W 점프, G 스킬   2P: H·K 이동, U 점프, P 스킬
       * 3P: ←→ 이동, ↑ 점프, 엔터(/) 스킬   4P: 숫자패드 4·6 이동, 8 점프, 9 스킬
       * 컴퓨터·온라인은 WASD 와 방향키 둘 다 내 아바타 */
      const KEYSET = {
        KeyA: 'k0.left', KeyD: 'k0.right', KeyW: 'k0.up', KeyG: 'k0.skill', KeyF: 'k0.skill',
        KeyH: 'k1.left', KeyK: 'k1.right', KeyU: 'k1.up', KeyP: 'k1.skill',
        ArrowLeft: 'k2.left', ArrowRight: 'k2.right', ArrowUp: 'k2.up', Enter: 'k2.skill', NumpadEnter: 'k2.skill', Slash: 'k2.skill', Numpad0: 'k2.skill',
        Numpad4: 'k3.left', Numpad6: 'k3.right', Numpad8: 'k3.up', Numpad9: 'k3.skill',
        Digit1: 'pick1', Digit2: 'pick2', Digit3: 'pick3', Digit4: 'pick4'
      };
      const input = S.keys(KEYSET, a => onKey(a));
      const touch = S.touchDevice() ? S.pad(canvas, W, H, [
        { id: 'me.left', label: '◀', x: 72, y: 466, r: 60, font: 30 }, { id: 'me.right', label: '▶', x: 212, y: 466, r: 60, font: 30 },
        { id: 'me.up', label: '점프', x: W - 204, y: 466, r: 62, font: 26 }, { id: 'me.skill', label: '스킬', x: W - 70, y: 400, r: 54, font: 24 }
      ], input, a => onKey(a)) : null;
      const pickRects = () => SKILLS.map((s, i) => ({ s, x: 90 + i * 200, y: 190, w: 180, h: 200 }));
      const onDown = e => {
        if (phase === 'paused') { phase = 'play'; return; }   // 일시정지 중 화면을 누르면 계속
        if (phase !== 'pick') return;
        const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
        const r = pickRects().find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
        if (r) choose(r.s.id);
      };
      canvas.addEventListener('pointerdown', onDown);

      // 자리별 처음 위치 (2:2 는 앞·뒤로 나눔)
      const homeX = slot => (n === 4 ? [110, 330, W - 330, W - 110][slot] : [200, W - 200][slot]);
      function makePlayer(slot, av, name, human, ks, mine) {
        const side = S.teamOf(slot, n), x = homeX(slot);
        return { i: slot, side, av, name, skill: 0, human, ks: ks || [], mine: !!mine, remote: null, x, y: GROUND, vy: 0, air: false, face: side === 0 ? 1 : -1,
          lastSkill: -99, giantUntil: 0, snareUntil: 0, reverseUntil: 0, walk: 0, spike: 0, ai: { tx: x, think: 0 } };
      }
      const size = p => (now() < p.giantUntil ? 2 : 1);
      const now = () => performance.now() / 1000;
      const ctl = (p, k) => (p.remote ? !!p.remote[k] : p.ks.some(q => input.down['k' + q + '.' + k]) || (p.mine && !!input.down['me.' + k]));
      const teamName = side => players.filter(p => p.side === side).map(p => p.name).join('·');
      function resetBall(side) { ball = { x: side === 0 ? W * 0.25 : W * 0.75, y: 70, vx: side === 0 ? 4 : -4, vy: 0, rot: 0 }; }
      function onKey(a) {
        if (phase === 'pick') { const v = { pick1: 1, pick2: 2, pick3: 3, pick4: 4 }[a]; if (v) choose(v); return; }
        if (phase !== 'play') return;
        const m = a.match(/^(k(\d)|me)\.skill$/); if (!m) return;
        const p = m[1] === 'me' ? players.find(q => q.mine) : players.find(q => q.human && !q.remote && q.ks.includes(+m[2]));
        if (!p) return;
        if (isHost()) useSkill(p); else send({ k: 'act', s: p.i, a: 'skill' });
      }
      // 스킬 고르기: 한 기기의 사람들은 차례로, 온라인은 각자 자기 것만
      const pickers = () => players.filter(p => p.human && !p.remote);
      function choose(v) {
        const list = pickers(), p = list[pick]; if (!p) return;
        p.skill = v; pick++;
        if (online()) { send({ k: 'pick', s: p.i, v }); if (pick >= list.length) { phase = 'waitpick'; status(); } if (isHost()) hostTryGo(); return; }
        if (pick >= list.length) { players.forEach(q => { if (!q.skill) q.skill = 1 + Math.floor(Math.random() * 4); }); startRally(true); }
        else status();
      }
      function hostTryGo() {
        if (!isHost() || phase === 'count' || phase === 'play') return;
        if (players.some(q => q.human && !q.skill)) return;
        players.forEach(q => { if (!q.skill) q.skill = 1 + Math.floor(Math.random() * 4); });
        send({ k: 'go', sk: players.map(q => q.skill) });
        startRally(true);
      }
      function startRally(first) {
        resetBall(serveSide); players.forEach(p => { p.x = homeX(p.i); p.y = GROUND; p.vy = 0; p.air = false; });
        phase = 'count'; count = first ? 3 : 1.2; status();
      }
      function useSkill(p) {
        const sk = SKILLS[p.skill - 1], t = now();
        if (!sk || t - p.lastSkill < sk.cd || t < p.snareUntil) return false;
        const foes = players.filter(q => q.side !== p.side);
        if (p.skill === 1) {
          if (ball.y + BALL_R < NET_TOP) return false;                        // 원작 규칙: 공이 그물 높이보다 낮을 때만
          const onMine = p.side === 0 ? ball.x < NET_X : ball.x > NET_X; if (!onMine) return false;
          p.x = ball.x + (p.side === 0 ? -34 : 34); p.y = Math.min(GROUND, ball.y + 60); p.vy = 0; p.air = p.y < GROUND;
          puff(p.x, p.y - 40, sk.color);
        } else if (p.skill === 2) { p.giantUntil = t + 2; puff(p.x, p.y - 60, sk.color); }
        else if (p.skill === 3) { foes.forEach(q => { q.snareUntil = t + 0.5; q.y = GROUND; q.vy = 0; q.air = false; puff(q.x, q.y - 20, sk.color); }); }
        else if (p.skill === 4) { foes.forEach(q => { q.reverseUntil = t + 2; puff(q.x, q.y - 90, sk.color); }); }
        p.lastSkill = t; flash = { text: p.name + ' · ' + sk.name + '!', color: sk.color, until: t + 1 };
        return true;
      }
      function puff(x, y, color) {
        for (let k = 0; k < 14; k++) fx.push({ x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.8) * 6, life: 30, color });
        if (net && net.host) net.fx.push([Math.round(x), Math.round(y), color]);
      }

      /* ---------- 컴퓨터 ---------- */
      function landingX() {
        let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;
        for (let k = 0; k < 200; k++) {
          vy += BALL_G; x += vx; y += vy;
          if (x < BALL_R || x > W - BALL_R) vx = -vx;
          if (y >= GROUND - 70 && vy > 0) break;
        }
        return x;
      }
      function aiControl(p, dt) {
        const L = LV[level] || LV.normal, mine = p.side === 0 ? x => x < NET_X : x => x > NET_X;
        p.ai.think -= dt;
        if (p.ai.think <= 0) {
          p.ai.think = 0.12 + (1 - L.react) * 0.35;
          const lx = landingX();
          // 2:2: 같은 팀에서 공에 더 가까운 사람만 받으러 감
          const mates = players.filter(q => q.side === p.side && q !== p);
          const nearest = !mates.some(q => Math.abs(q.x - lx) < Math.abs(p.x - lx) - 20);
          if (mine(lx) && nearest) p.ai.tx = lx + (p.side === 0 ? -14 : 14) + (Math.random() - 0.5) * L.err;
          else p.ai.tx = homeX(p.i);
        }
        const c = { left: false, right: false, up: false };
        const dx = p.ai.tx - p.x;
        if (Math.abs(dx) > 8) { if (dx < 0) c.left = true; else c.right = true; }
        const close = Math.abs(ball.x - p.x) < 70 && ball.y < p.y - 60 && ball.y > p.y - 260 && ball.vy > -2 && mine(ball.x);
        if (close && Math.random() < L.react) c.up = true;
        if (Math.random() < L.skill) {
          const sk = p.skill;
          if (sk === 1 && mine(ball.x) && Math.abs(ball.x - p.x) > 220 && ball.y > NET_TOP) useSkill(p);
          else if (sk === 2 && mine(ball.x)) useSkill(p);
          else if ((sk === 3 || sk === 4) && !mine(ball.x) && ball.vx !== 0) useSkill(p);
        }
        c.speed = L.speed;
        return c;
      }

      /* ---------- 한 프레임 (방장·혼자일 때만 계산) ---------- */
      function step(dt) {
        const t = now();
        players.forEach(p => {
          const c = p.human ? { left: ctl(p, 'left'), right: ctl(p, 'right'), up: ctl(p, 'up'), speed: 1 } : aiControl(p, dt);
          const k = size(p), half = PW * k / 2;
          if (t >= p.snareUntil) {
            let l = c.left, r = c.right;
            if (t < p.reverseUntil) [l, r] = [r, l];
            const sp = SPEED * (c.speed || 1);
            if (l) p.x -= sp; if (r) p.x += sp;
            if (l || r) p.walk += 0.25;
            if (c.up && !p.air) { p.vy = JUMP; p.air = true; }
          }
          if (p.side === 0) p.x = Math.max(half, Math.min(NET_X - 6 - half, p.x));
          else p.x = Math.max(NET_X + 6 + half, Math.min(W - half, p.x));
          p.vy += G; p.y += p.vy;
          if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.air = false; }
          if (p.spike > 0) p.spike -= dt;
          const top = p.y - PH * k, left = p.x - half, right = p.x + half;
          const nx = Math.max(left, Math.min(ball.x, right)), ny = Math.max(top, Math.min(ball.y, p.y));
          if ((ball.x - nx) ** 2 + (ball.y - ny) ** 2 < BALL_R * BALL_R && ball.vy > -11) {
            ball.vy = -12 - (p.air ? 1.5 : 0);
            ball.vx = Math.max(-12, Math.min(12, (ball.x - p.x) / 3));
            if (Math.abs(ball.vx) < 1.2) ball.vx = p.side === 0 ? 2 : -2;
            ball.y = top - BALL_R - 1; p.spike = 0.25; rallies++;
          }
        });
        ball.vy += BALL_G; ball.x += ball.vx; ball.y += ball.vy; ball.rot += ball.vx * 0.04;
        if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
        if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }
        if (Math.abs(ball.x - NET_X) < BALL_R + 3 && ball.y + BALL_R > NET_TOP) {
          if (ball.y < NET_TOP + 6 && ball.vy > 0) { ball.vy = -Math.abs(ball.vy) * 0.8; ball.y = NET_TOP - BALL_R; }
          else { ball.vx = -ball.vx || (ball.x < NET_X ? -3 : 3); ball.x = NET_X + (ball.x < NET_X ? -(BALL_R + 4) : BALL_R + 4); }
        }
        if (ball.y + BALL_R >= GROUND) {
          const scorer = ball.x < NET_X ? 1 : 0;
          score[scorer]++; serveSide = scorer; puff(ball.x, GROUND - 6, '#FFD23F');
          flash = { text: teamName(scorer) + ' 득점!', color: '#FFD23F', until: t + 1.1 };
          if (score[scorer] >= goal()) return finish(scorer);
          phase = 'point'; timer = 1.1; status();
        }
      }
      const mySide = () => { const me = players.find(p => p.mine); return me ? me.side : 0; };
      function finish(winSide, why) {
        if (phase === 'over') return;
        phase = 'over'; clock.stop(); render();
        if (net && net.host) send({ k: 'end', w: winSide, sc: score, why: why || '' });
        let msg;
        if (winSide < 0) msg = why || '경기가 끝났어요';
        else if (mode === 'local') msg = `${teamName(winSide)} 승리! ${score[0]} : ${score[1]}`;
        else msg = (winSide === mySide() ? '승리! ' : '아쉬워요 ') + `${score[0]} : ${score[1]}` + (why ? ' · ' + why : '');
        hooks.onTurn({ text: msg, side: -1 });
        const me = players.find(p => p.mine) || players[0];
        hooks.onOver({ winner: winSide, win: winSide < 0 ? null : (mode === 'local' ? undefined : winSide === mySide()), message: msg, moves: rallies, duration_sec: clock.sec(), extra: { score: score.slice(), skill: me.skill, players: n } });
      }
      function status() {
        if (phase === 'pick') { const p = pickers()[pick]; return hooks.onTurn({ text: (p ? p.name : '') + ' · 스킬을 고르세요 (1~4)', side: p ? p.side : 0 }); }
        if (phase === 'waitpick') return hooks.onTurn({ text: '다른 사람이 스킬을 고르는 중…', side: -1 });
        hooks.onTurn({ text: `${teamName(0)} ${score[0]} : ${score[1]} ${teamName(1)} · ${goal()}점 먼저`, side: serveSide });
      }

      /* ---------- 온라인 ---------- */
      const SNAP_MS = 80;                 // 방장이 화면 상태를 보내는 간격 (초당 약 12번)
      function send(m) { if (online() && hooks.onMove) hooks.onMove(m); }
      function hostSnap() {
        const t = now();
        send({ k: 'st', ph: phase, c: Math.round(count * 10) / 10, sc: score, sv: serveSide,
          b: [Math.round(ball.x), Math.round(ball.y), Math.round(ball.rot * 100) / 100],
          p: players.map(p => [Math.round(p.x), Math.round(p.y), p.air ? 1 : 0, p.spike > 0 ? 1 : 0, Math.max(0, Math.round((p.giantUntil - t) * 10)), Math.max(0, Math.round((p.snareUntil - t) * 10)), Math.max(0, Math.round((p.reverseUntil - t) * 10)), Math.round(Math.min(99, (t - p.lastSkill) * 10)), Math.round(p.walk * 4) % 8, p.skill]),
          fl: flash && flash.until > t ? [flash.text, flash.color] : 0, fx: net.fx.splice(0) });
      }
      function applySnap(m) {
        net.sm.push(m);
        const t = now();
        if (phase !== 'over' && phase !== 'pick' && m.ph !== phase) { phase = m.ph; status(); }
        count = m.c; score = m.sc; serveSide = m.sv;
        m.p.forEach((a, i) => { const p = players[i]; if (!p) return; p.air = !!a[2]; p.spike = a[3] ? 0.2 : 0; p.giantUntil = t + a[4] / 10; p.snareUntil = t + a[5] / 10; p.reverseUntil = t + a[6] / 10; p.lastSkill = t - a[7] / 10; p.walk = a[8] / 4; if (a[9]) p.skill = a[9]; });
        if (m.fl && (!flash || flash.text !== m.fl[0])) flash = { text: m.fl[0], color: m.fl[1], until: t + 1 };
        (m.fx || []).forEach(f => { for (let k = 0; k < 10; k++) fx.push({ x: f[0], y: f[1], vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.8) * 6, life: 30, color: f[2] }); });
      }
      // 손님 기기: 이어 그릴 위치
      function clientPose() {
        const sm = net.sm; if (!sm.ready) return;
        const a = sm.prev, b = sm.cur;
        ball = ball || { x: 0, y: 0, rot: 0 };
        ball.x = sm.mix(a.b[0], b.b[0]); ball.y = sm.mix(a.b[1], b.b[1]); ball.rot = b.b[2];
        players.forEach((p, i) => { const pa = a.p[i], pb = b.p[i]; if (!pa || !pb) return; p.x = sm.mix(pa[0], pb[0]); p.y = sm.mix(pa[1], pb[1]); });
      }
      function clientInput() {
        const me = players.find(p => p.mine); if (!me || phase !== 'play' && phase !== 'count') return;
        const st = { left: ctl(me, 'left'), right: ctl(me, 'right'), up: ctl(me, 'up') }, key = (st.left ? 1 : 0) | (st.right ? 2 : 0) | (st.up ? 4 : 0);
        if (key !== net.lastKey || performance.now() - net.lastSent > 1000) { net.lastKey = key; net.lastSent = performance.now(); send({ k: 'in', s: me.i, b: key }); }
      }

      /* ---------- 그리기 ---------- */
      function render() {
        ctx.save(); ctx.imageSmoothingEnabled = false;
        drawCourt(ctx, bg);
        if (phase === 'pick') { drawPick(); ctx.restore(); return; }
        drawNet(ctx);
        if (ball) S.shadow(ctx, ball.x, GROUND + 4, 30 * Math.max(0.4, 1 - (GROUND - ball.y) / 500));
        const t = now();
        players.forEach(p => {
          const k = size(p), sc = SCALE * k;
          S.shadow(ctx, p.x, GROUND + 4, 60 * k);
          const pose = p.spike > 0 ? 'spike' : p.air ? 'jump' : (t < p.snareUntil ? 'guard' : (Math.floor(p.walk) % 2 ? 'walk1' : (p.walk ? 'walk2' : 'idle')));
          S.drawFighter(ctx, p.av, pose, p.x, p.y, sc, p.face);
          const sk = SKILLS[p.skill - 1], ready = sk ? Math.min(1, (t - p.lastSkill) / sk.cd) : 0, top = p.y - PH * k - 34;
          S.text(ctx, (p.mine && n > 2 ? '▼ ' : '') + p.name, p.x, top - 10, 14, p.side === 0 ? '#FFE48A' : '#BFE3FF');
          S.bar(ctx, p.x - 30, top + 2, 60, 6, ready, ready >= 1 ? (sk ? sk.color : '#fff') : '#8890B8');
          if (t < p.snareUntil) S.text(ctx, '속박!', p.x, top - 30, 16, '#FF5A5F');
          if (t < p.reverseUntil) S.text(ctx, '혼란!', p.x, top - (t < p.snareUntil ? 48 : 30), 16, '#C9A6FF');
        });
        if (ball) {
          ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.rot);
          if (S.ready(ballImg)) ctx.drawImage(ballImg, -BALL_R - 2, -BALL_R - 2, BALL_R * 2 + 4, BALL_R * 2 + 4);
          else { ctx.fillStyle = '#FFD23F'; ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, Math.PI * 2); ctx.fill(); }
          ctx.restore();
          if (ball.y < -BALL_R) { ctx.fillStyle = '#FFD23F'; ctx.fillRect(ball.x - 6, 4, 12, 6); }
        }
        fx.forEach(f => { ctx.globalAlpha = Math.max(0, f.life / 30); ctx.fillStyle = f.color; ctx.fillRect(f.x - 3, f.y - 3, 6, 6); }); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(11,14,34,.78)'; ctx.fillRect(W / 2 - 150, 12, 300, 54);
        ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - 150, 12, 300, 54);
        S.text(ctx, String(score[0]), W / 2 - 70, 40, 36, '#FFE48A'); S.text(ctx, ':', W / 2, 38, 28, '#fff'); S.text(ctx, String(score[1]), W / 2 + 70, 40, 36, '#BFE3FF');
        S.text(ctx, goal() + '점 먼저' + (n > 2 ? ' · 2:2' : ''), W / 2, 80, 13, '#fff', 'center', 400);
        if (flash && flash.until > t) S.text(ctx, flash.text, W / 2, 130, 26, flash.color);
        if (phase === 'count') S.text(ctx, String(Math.max(1, Math.ceil(count))), W / 2, H / 2 - 20, 96, '#FF5A5F');
        if (phase === 'waitpick') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); S.text(ctx, '다른 사람이 스킬을 고르는 중…', W / 2, H / 2, 32, '#fff'); }
        if (phase === 'paused') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); S.text(ctx, '일시정지', W / 2, H / 2 - 20, 48, '#fff'); S.text(ctx, '화면을 누르거나 [일시정지 / 계속] 버튼을 누르면 계속해요', W / 2, H / 2 + 36, 22, '#FFE45C'); }
        if (touch && (phase === 'play' || phase === 'count' || phase === 'point')) touch.draw(ctx);
        ctx.restore();
      }
      const KEYHELP = ['G (휴대폰: 스킬 버튼)', 'P', '엔터 · / · 숫자패드 0', '숫자패드 9'];
      function drawPick() {
        ctx.fillStyle = 'rgba(11,14,34,.72)'; ctx.fillRect(0, 0, W, H);
        const p = pickers()[pick];
        S.text(ctx, (p ? p.name : '') + ' · 스킬을 고르세요', W / 2, 90, 30, '#FFD23F');
        const keyTxt = !p ? '' : (mode === 'local' ? KEYHELP[p.ks[0]] : 'G 또는 엔터 (휴대폰: 스킬 버튼)');
        S.text(ctx, '숫자 1~4 키 또는 카드를 눌러요 · 경기 중 스킬 키: ' + keyTxt, W / 2, 135, 15, '#fff', 'center', 400);
        pickRects().forEach((r, i) => {
          ctx.fillStyle = '#FFFDF6'; ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = r.s.color; ctx.fillRect(r.x, r.y, r.w, 8);
          ctx.strokeStyle = '#1A1F3D'; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h);
          S.text(ctx, (i + 1) + '. ' + r.s.name, r.x + r.w / 2, r.y + 40, 22, '#1A1F3D');
          S.text(ctx, '쿨타임 ' + r.s.cd + '초', r.x + r.w / 2, r.y + 72, 14, '#566086', 'center', 400);
          wrap(r.s.desc, r.x + r.w / 2, r.y + 110, r.w - 24, 14);
        });
        if (p) S.drawFighter(ctx, p.av, 'idle', W / 2, H - 30, 3, 1);
      }
      function wrap(s, x, y, w, size) {
        ctx.save(); ctx.font = `400 ${size}px Pretendard, sans-serif`; ctx.fillStyle = '#1A1F3D'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let line = '', yy = y; for (const ch of s) { if (ctx.measureText(line + ch).width > w) { ctx.fillText(line, x, yy); line = ch; yy += size + 6; } else line += ch; }
        ctx.fillText(line, x, yy); ctx.restore();
      }

      function loop(ts) {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
        if (!isHost()) { if (phase !== 'over') { clientPose(); clientInput(); } }
        else if (phase === 'count') { count -= dt; if (count <= 0) { phase = 'play'; status(); } }
        else if (phase === 'point') { timer -= dt; if (timer <= 0) startRally(false); }
        else if (phase === 'play') { let acc = dt * 60; while (acc > 0 && phase === 'play') { step(Math.min(1, acc) / 60); acc -= 1; } }
        if (net && net.host && phase !== 'over' && phase !== 'pick' && phase !== 'waitpick' && ts - net.lastSnap >= SNAP_MS && ball) { net.lastSnap = ts; hostSnap(); }
        fx.forEach(f => { f.x += f.vx; f.y += f.vy; f.vy += 0.3; f.life--; }); fx = fx.filter(f => f.life > 0);
        render();
      }
      const offImg = S.onImages(render);
      const vis = () => { if (document.hidden && phase === 'play' && !online()) phase = 'paused'; };
      document.addEventListener('visibilitychange', vis);
      render();
      raf = requestAnimationFrame(loop);

      return {
        get state() { return phase === 'over' ? 'over' : phase === 'idle' ? 'ready' : 'playing'; },
        start(o) {
          o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal'; n = o.players === 4 ? 4 : 2;
          const me = S.myAvatar(), meName = S.myName();
          net = null; players = [];
          if (mode === 'online') {
            const roster = o.roster || [], order = S.slotOrder(n);
            net = { host: !!o.host, sm: S.smoother(SNAP_MS), fx: [], lastSnap: 0, lastKey: -1, lastSent: 0 };
            for (let slot = 0; slot < n; slot++) {
              const ri = order.indexOf(slot), r = ri >= 0 ? roster[ri] : null, mine = ri === o.me;
              if (r) players.push(makePlayer(slot, mine ? me : (r.avatar || S.cpuAvatar('net-' + r.id)), mine ? meName : r.nick, true, mine ? [0, 2] : [], mine));
              else players.push(makePlayer(slot, S.cpuAvatar('vnet-' + slot), '컴퓨터', false));
              if (r && !mine) { players[slot].remote = net.host ? {} : null; players[slot].netId = r.id; }
            }
            if (!net.host) players.forEach(p => { if (!p.mine) p.human = false; });   // 손님 기기는 방장이 보낸 대로만 그림
          } else if (mode === 'local') {
            const KS = n === 4 ? [[0], [1], [2], [3]] : [[0], [2]];
            for (let slot = 0; slot < n; slot++) players.push(makePlayer(slot, slot === 0 ? me : S.cpuAvatar('friend-' + slot), slot === 0 ? '1P ' + meName : (slot + 1) + 'P', true, KS[slot], slot === 0));
          } else {
            for (let slot = 0; slot < n; slot++) players.push(slot === 0 ? makePlayer(0, me, meName, true, [0, 2], true) : makePlayer(slot, S.cpuAvatar('volley-' + level + slot), n > 2 ? (S.teamOf(slot, n) === 0 ? '우리 편 컴퓨터' : '컴퓨터 ' + (slot - 1)) : '컴퓨터', false));
          }
          score = [0, 0]; serveSide = 0; rallies = 0; fx = []; flash = null; pick = 0; phase = 'pick'; resetBall(0);
          clock.reset(); clock.start(); hooks.onState('playing');
          hooks.onButtons(online() ? [] : [{ id: 'pause', label: '일시정지 / 계속' }]); status(); render();
        },
        // 온라인: 다른 기기에서 온 것
        remote(m) {
          if (!m || !net) return;
          if (m.left) {                 // 누가 나감
            if (m.wasHost && !net.host) return finish(-1, '방장이 나가서 경기가 끝났어요');
            const p = players.find(q => q.netId === m.left); if (p && net.host) { p.human = false; p.remote = null; p.name += '(컴퓨터)'; if (!p.skill) p.skill = 1; hostTryGo(); }
            return;
          }
          if (net.host) {
            const p = players[m.s];
            if (m.k === 'in' && p && p.remote) p.remote = { left: !!(m.b & 1), right: !!(m.b & 2), up: !!(m.b & 4) };
            else if (m.k === 'act' && p && phase === 'play') useSkill(p);
            else if (m.k === 'pick' && p) { p.skill = m.v; hostTryGo(); }
            else if (m.k === 'resign' && p) finish(1 - p.side, p.name + ' 기권');
          } else {
            if (m.k === 'st') applySnap(m);
            else if (m.k === 'go') { m.sk.forEach((v, i) => { if (players[i]) players[i].skill = v; }); if (phase === 'waitpick' || phase === 'pick') { phase = 'count'; status(); } }
            else if (m.k === 'end') { score = m.sc; finish(m.w, m.why); }
          }
        },
        press(id) {
          if (id === 'pause') { if (online()) return; if (phase === 'play') phase = 'paused'; else if (phase === 'paused') phase = 'play'; return; }
          if (id === 'resign' && phase !== 'over' && phase !== 'idle') {
            if (online()) { const me = players.find(p => p.mine); if (net.host) finish(1 - me.side, me.name + ' 기권'); else { send({ k: 'resign', s: me.i }); } return; }
            const loserSide = mode === 'ai' ? 0 : 0;
            const msg = mode === 'ai' ? '기권 · 컴퓨터 승' : teamName(loserSide) + ' 기권';
            phase = 'over'; clock.stop();
            hooks.onTurn({ text: msg, side: -1 });
            hooks.onOver({ winner: 1 - loserSide, message: msg, moves: rallies, duration_sec: clock.sec(), extra: { score: score.slice(), resigned: true } });
          }
        },
        togglePause() { if (online()) return; if (phase === 'play') phase = 'paused'; else if (phase === 'paused') phase = 'play'; },
        action() {},
        destroy() { cancelAnimationFrame(raf); input.off(); if (touch) touch.off(); offImg(); canvas.removeEventListener('pointerdown', onDown); document.removeEventListener('visibilitychange', vis); }
      };
    }
  };
})();
