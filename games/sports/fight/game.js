/*
 * gogo?gogo! — 일단 덤벼 (원작: 선생님의 '대난투 격투 게임' 파이썬 게임을 웹으로 옮김)
 *  - 스틱맨 대신 내 아바타가 싸웁니다. 컴퓨터 / 둘이서 한 기기.
 *  - 팔 공격(약 5) · 다리 공격(강 15) · 뒤로 누르면 자동 막기(피해 줄임) · 맞으면 잠깐 경직
 *  - 스킬 3가지 (경기 전에 하나 고름): 강화 팔공격(아래+팔) · 텔레포트(아래 두 번) · 더블 점프(공중에서 위 두 번)
 *  - 체력을 먼저 0으로 만들거나, 시간이 끝났을 때 체력이 많으면 승리 (같으면 무승부)
 *  - 배경 '학교 옥상' 그림은 Meshy AI 로 만든 그림을 줄여서 사용 (arena.jpg)
 */
(function () {
  'use strict';
  const S = window.GoSport;
  const W = 960, H = 540, FLOOR = 492, BW = 48, BH = 112, SCALE = 4;
  const SPEED = 4.6, JUMP = -13.2, GRAV = 0.78, DOUBLE_TAP = 400;
  const DIR = 'games/sports/fight/';
  const SKILLS = [
    { id: 1, name: '강화 팔공격', how: '아래 + 팔 공격', desc: '팔 공격이 2.5배 오래 유지돼요. 쿨타임 0.5초', color: '#FF9A3D' },
    { id: 2, name: '텔레포트', how: '아래 두 번', desc: '상대 등 뒤로 순간이동. 쿨타임 2초', color: '#A66BFF' },
    { id: 3, name: '더블 점프', how: '공중에서 위 두 번', desc: '공중에서 한 번 더 점프. 땅에 닿으면 다시 사용', color: '#3BC8F5' }
  ];
  const LV = { easy: { think: 26, guard: 0.15, attack: 0.35, skill: 0.15 }, normal: { think: 14, guard: 0.5, attack: 0.6, skill: 0.35 }, hard: { think: 5, guard: 0.85, attack: 0.9, skill: 0.6 } };
  const cfg = () => window.GoSettings.get('fight') || {};

  function drawStage(ctx, bg) {
    if (S.ready(bg)) { ctx.imageSmoothingEnabled = false; ctx.drawImage(bg, 0, 0, W, H); }
    else { const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#3B3570'); gr.addColorStop(0.55, '#E9875A'); gr.addColorStop(1, '#5A5A66'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, FLOOR, W, 2);
  }

  window.GoGames.fight = {
    id: 'fight', size: [W, H], SKILLS,
    thumb(ctx, w, h) {
      const bg = S.image(DIR + 'arena.jpg');
      const paint = () => {
        ctx.save(); ctx.clearRect(0, 0, w, h); ctx.scale(w / W, h / H); drawStage(ctx, bg);
        S.drawFighter(ctx, S.myAvatar(), 'punch', 380, FLOOR, 6, 1);
        S.drawFighter(ctx, S.cpuAvatar('f1'), 'guard', 600, FLOOR, 6, -1);
        ctx.restore();
      };
      paint(); S.onImages(paint);
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      const bg = S.image(DIR + 'arena.jpg');
      let mode = 'ai', level = 'normal', phase = 'idle', raf = 0, last = 0, frames = 0, timeLeft = 99, n = 2;
      let P = [], pick = 0, fx = [], shake = 0, banner = null, intro = 0, slow = 0, net = null;
      const online = () => mode === 'online';
      const isHost = () => !online() || (net && net.host);

      /* ---------- 조작 키 (원작 1:1 · 2:2 배치를 따름) ----------
       * 1:1  1P: WASD + G 팔 · H 다리      2P: 방향키 + K 팔 · L 다리 (숫자패드 1·2, 쉼표·마침표)
       * 2:2  1P: WASD + F 팔 · G 다리      2P: U H J K + P 팔 · [ 다리
       *      3P: 방향키 + 숫자패드 1·2 (쉼표·마침표)   4P: 숫자패드 8 4 5 6 + 숫자패드 - · + */
      const KEYS2 = {
        KeyA: 'k0.left', KeyD: 'k0.right', KeyW: 'k0.up', KeyS: 'k0.down', KeyG: 'k0.punch', KeyH: 'k0.kick',
        ArrowLeft: 'k2.left', ArrowRight: 'k2.right', ArrowUp: 'k2.up', ArrowDown: 'k2.down',
        Numpad1: 'k2.punch', Numpad2: 'k2.kick', KeyK: 'k2.punch', KeyL: 'k2.kick', Comma: 'k2.punch', Period: 'k2.kick',
        Digit1: 'pick1', Digit2: 'pick2', Digit3: 'pick3'
      };
      const KEYS4 = {
        KeyA: 'k0.left', KeyD: 'k0.right', KeyW: 'k0.up', KeyS: 'k0.down', KeyF: 'k0.punch', KeyG: 'k0.kick',
        KeyH: 'k1.left', KeyK: 'k1.right', KeyU: 'k1.up', KeyJ: 'k1.down', KeyP: 'k1.punch', BracketLeft: 'k1.kick',
        ArrowLeft: 'k2.left', ArrowRight: 'k2.right', ArrowUp: 'k2.up', ArrowDown: 'k2.down', Numpad1: 'k2.punch', Numpad2: 'k2.kick', Comma: 'k2.punch', Period: 'k2.kick',
        Numpad4: 'k3.left', Numpad6: 'k3.right', Numpad8: 'k3.up', Numpad5: 'k3.down', NumpadSubtract: 'k3.punch', NumpadAdd: 'k3.kick',
        Digit1: 'pick1', Digit2: 'pick2', Digit3: 'pick3'
      };
      let input = S.keys(KEYS2, a => onKey(a)), touch = null;
      function buildControls(map) {
        input.off(); if (touch) touch.off();
        input = S.keys(map, a => onKey(a));
        touch = S.touchDevice() ? S.pad(canvas, W, H, [
          { id: 'me.left', label: '◀', x: 66, y: 462, r: 58, font: 30 }, { id: 'me.right', label: '▶', x: 200, y: 462, r: 58, font: 30 },
          { id: 'me.up', label: '▲', x: 133, y: 360, r: 48, font: 28 }, { id: 'me.down', label: '▼', x: 300, y: 492, r: 42, font: 24 },
          { id: 'me.punch', label: '팔', x: W - 196, y: 470, r: 60, font: 30 }, { id: 'me.kick', label: '다리', x: W - 68, y: 400, r: 58, font: 26 }
        ], input, a => onKey(a)) : null;
      }
      buildControls(KEYS2);
      const pickRects = () => SKILLS.map((s, i) => ({ s, x: 120 + i * 250, y: 190, w: 220, h: 200 }));
      const onDown = e => {
        if (phase === 'paused') { phase = 'fight'; return; }   // 일시정지 중 화면을 누르면 계속
        if (phase !== 'pick') return;
        const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
        const r = pickRects().find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
        if (r) choose(r.s.id);
      };
      canvas.addEventListener('pointerdown', onDown);

      const homeX = slot => (n === 4 ? [170, 340, W - 340, W - 170][slot] : [300, W - 300][slot]);
      const COLORS = ['#FF8A8E', '#FFB27A', '#9DC0FF', '#8FE3C4'];
      function fighter(slot, av, name, human, ks, mine) {
        const team = S.teamOf(slot, n);
        return { i: slot, av, name, human, ks: ks || [], mine: !!mine, remote: null, color: n === 4 ? COLORS[slot] : (team === 0 ? '#FF8A8E' : '#9DC0FF'), team, x: homeX(slot), y: FLOOR, vy: 0, air: false, faceLeft: team === 1,
          hp: 100, attacking: false, type: 0, atkT: 0, hitList: [], guardT: 0, guardCd: 0, stun: 0, skill: 0, skillCd: 0, doubled: false,
          lastDown: -1e9, lastUp: -1e9, walk: 0, ai: { t: 0, hold: {} } };
      }
      const rect = f => ({ x: f.x - BW / 2, y: f.y - BH, w: BW, h: BH });
      const hitbox = (f, type) => {
        const dir = f.faceLeft ? -1 : 1, top = f.y - BH;
        const [off, w, y, h] = type === 2 ? [16, 54, 64, 24] : [16, 40, 16, 26];
        const x0 = f.x + dir * off;
        return { x: dir > 0 ? x0 : x0 - w, y: top + y, w, h };
      };
      const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      const enemiesOf = f => P.filter(e => e.team !== f.team && e.hp > 0);
      const closest = f => enemiesOf(f).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0];
      const ctl = (f, k) => (f.remote ? !!f.remote[k] : f.ks.some(q => input.down['k' + q + '.' + k]) || (f.mine && !!input.down['me.' + k]));
      const teamName = t => P.filter(f => f.team === t).map(f => f.name).join('·');
      const myTeam = () => { const me = P.find(f => f.mine); return me ? me.team : 0; };

      function onKey(a) {
        if (phase === 'pick') { const v = { pick1: 1, pick2: 2, pick3: 3 }[a]; if (v) choose(v); return; }
        if (phase !== 'fight') return;
        const m = a.match(/^(k(\d)|me)\.(\w+)$/); if (!m) return;
        const f = m[1] === 'me' ? P.find(q => q.mine) : P.find(q => q.human && !q.remote && q.ks.includes(+m[2]));
        if (!f || f.hp <= 0) return;
        const held = { down: ctl(f, 'down') };
        if (isHost()) act(f, m[3], held); else send({ k: 'act', s: f.i, a: m[3], d: held.down ? 1 : 0 });
      }
      function act(f, what, held) {
        const t = performance.now();
        if (what === 'punch') {
          if (f.skill === 1 && held.down && f.skillCd <= 0 && !f.attacking && f.guardT <= 0 && f.stun <= 0) skill1(f);
          else attack(f, 1);
        } else if (what === 'kick') attack(f, 2);
        else if (what === 'down') {
          if (f.skill === 2 && f.skillCd <= 0 && !f.attacking && f.guardT <= 0 && f.stun <= 0 && t - f.lastDown <= DOUBLE_TAP) skill2(f);
          f.lastDown = t;
        } else if (what === 'up') {
          if (f.skill === 3 && f.air && !f.doubled && f.stun <= 0 && t - f.lastUp <= DOUBLE_TAP) skill3(f);
          f.lastUp = t;
        }
      }
      function attack(f, type) {
        if (f.hp <= 0 || f.attacking || f.stun > 0 || f.guardT > 0) return;
        f.attacking = true; f.type = type; f.hitList = []; f.atkT = type === 1 ? 15 : 30;
      }
      function skill1(f) { f.attacking = true; f.type = 3; f.hitList = []; f.atkT = Math.floor(15 * 2.5); f.skillCd = 30; say(f, SKILLS[0]); }
      function skill2(f) {
        const tg = closest(f); if (!tg) return;
        const nx = tg.faceLeft ? tg.x + BW + 10 : tg.x - BW - 10;
        burst(f.x, f.y - BH / 2, '#A66BFF', 16);
        f.x = Math.max(BW / 2, Math.min(W - BW / 2, nx)); f.y = tg.y; f.vy = tg.vy; f.air = tg.air;
        f.skillCd = 30 * 2 + 60; burst(f.x, f.y - BH / 2, '#A66BFF', 16); say(f, SKILLS[1]);
      }
      function skill3(f) { f.vy = JUMP; f.doubled = true; burst(f.x, f.y, '#3BC8F5', 10); say(f, SKILLS[2]); }
      function say(f, sk) { banner = { text: f.name + ' · ' + sk.name + '!', color: sk.color, t: 50 }; }
      // 효과: 방장은 손님 기기에도 같은 효과를 보내 줌
      function addFx(e) { fx.push(e); if (net && net.host && (e.kind !== 'dot')) net.fx.push(e); }
      function burst(x, y, color, cnt) { for (let k = 0; k < cnt; k++) fx.push({ kind: 'dot', x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.7) * 7, life: 26, color }); if (net && net.host) net.fx.push({ kind: 'burst', x, y, color, n: cnt }); }
      function spark(x, y, big) {
        addFx({ kind: 'star', x, y, life: big ? 16 : 10, big });
        for (let k = 0; k < (big ? 12 : 6); k++) fx.push({ kind: 'dot', x, y, vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.6) * 8, life: 18, color: big ? '#FFD23F' : '#FFFFFF' });
      }

      /* ---------- 컴퓨터 ---------- */
      function ai(f) {
        const L = LV[level] || LV.normal, e = closest(f), hold = f.ai.hold;
        if (!e) { f.ai.hold = {}; return; }
        if (--f.ai.t > 0) return;
        f.ai.t = L.think + Math.floor(Math.random() * L.think);
        const dx = e.x - f.x, d = Math.abs(dx), toward = dx > 0 ? 'right' : 'left', away = dx > 0 ? 'left' : 'right';
        f.ai.hold = {};
        const threat = e.attacking && d < 90;
        if (threat && Math.random() < L.guard) { f.ai.hold[away] = true; f.ai.t = 10; return; }
        if (d > 92) {
          if (f.skill === 2 && d > 260 && f.skillCd <= 0 && Math.random() < L.skill) { act(f, 'down', {}); f.lastDown = performance.now(); act(f, 'down', {}); return; }
          f.ai.hold[toward] = true;
          if (Math.random() < 0.08) { f.ai.hold.up = true; if (f.skill === 3) setTimeout(() => { if (f.air) { act(f, 'up', {}); act(f, 'up', {}); } }, 260); }
        } else {
          if (Math.random() < L.attack) {
            if (f.skill === 1 && f.skillCd <= 0 && Math.random() < L.skill) act(f, 'punch', { down: true });
            else act(f, Math.random() < 0.55 ? 'punch' : 'kick', {});
          } else if (Math.random() < 0.4) f.ai.hold[away] = true;
        }
        hold.done = true;
      }

      /* ---------- 한 프레임 (원작과 같은 60프레임 기준, 방장·혼자일 때만) ---------- */
      function step() {
        frames++;
        P.forEach(f => {
          if (f.hp <= 0) return;
          if (!f.human) ai(f);
          const k = f.human ? nm => ctl(f, nm) : nm => !!f.ai.hold[nm];
          if (f.stun > 0) f.stun--;
          if (f.guardT > 0) f.guardT--;
          if (f.guardCd > 0) f.guardCd--;
          if (f.skillCd > 0) f.skillCd--;
          const e = closest(f); if (e) f.faceLeft = e.x < f.x;
          if (f.stun <= 0 && !f.attacking && !f.air && f.guardT <= 0 && f.guardCd <= 0) {
            const back = (f.faceLeft && k('right')) || (!f.faceLeft && k('left'));
            if (back && enemiesOf(f).some(en => en.attacking && overlap(hitbox(en, en.type === 2 ? 2 : 1), rect(f)))) { f.guardT = 15; f.guardCd = 30; }
          }
          let dx = 0;
          if (f.stun <= 0) {
            const can = !(f.attacking && !f.air) && f.guardT <= 0;
            if (can || f.air) {
              if (k('left')) dx = -SPEED; if (k('right')) dx = SPEED;
              if (k('up') && !f.air) { f.vy = JUMP; f.air = true; f.lastUp = performance.now(); }
            }
          }
          if (dx) f.walk += 0.18;
          f.vy += GRAV; f.y += f.vy; f.x += dx;
          if (f.y >= FLOOR) { f.y = FLOOR; f.vy = 0; f.air = false; f.doubled = false; }
          f.x = Math.max(BW / 2, Math.min(W - BW / 2, f.x));
        });
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j]; if (a.hp <= 0 || b.hp <= 0 || Math.abs(a.y - b.y) > BH * 0.6) continue;
          const d = b.x - a.x, need = BW * 0.9 - Math.abs(d);
          if (need > 0) { const s = d >= 0 ? 1 : -1; a.x -= s * need / 2; b.x += s * need / 2; a.x = Math.max(BW / 2, Math.min(W - BW / 2, a.x)); b.x = Math.max(BW / 2, Math.min(W - BW / 2, b.x)); }
        }
        P.forEach(f => {
          if (f.hp <= 0 || !f.attacking) return;
          f.atkT--;
          const hb = hitbox(f, f.type === 2 ? 2 : 1);
          if (f.atkT > 0) enemiesOf(f).forEach(t => {
            if (f.hitList.includes(t) || !overlap(hb, rect(t))) return;
            const heavy = f.type === 2, cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
            if (!t.human && t.stun <= 0 && !t.attacking && Math.random() < (LV[level] || LV.normal).guard * 0.5) { t.guardT = 15; t.guardCd = 20; }
            if (t.guardT > 0) { t.hp -= heavy ? 3 : 1; addFx({ kind: 'txt', x: t.x, y: t.y - BH - 10, text: '막기!', color: '#BFE3FF', life: 30 }); spark(cx, cy, false); }
            else {
              const dmg = heavy ? 15 : 5; t.hp -= dmg; t.stun = 18; t.attacking = false; t.atkT = 0;
              t.x += (f.faceLeft ? -1 : 1) * (heavy ? 18 : 10);
              addFx({ kind: 'txt', x: t.x, y: t.y - BH - 10, text: '-' + dmg, color: heavy ? '#FF5A5F' : '#FFE48A', life: 36 });
              spark(cx, cy, heavy); if (heavy) shake = 10;
            }
            f.hitList.push(t);
          });
          if (f.atkT <= 0) f.attacking = false;
        });
        if (frames % 60 === 0) timeLeft = Math.max(0, timeLeft - 1);
        const hp = team => P.filter(f => f.team === team).reduce((s, f) => s + Math.max(0, f.hp), 0);
        if (hp(0) <= 0 || hp(1) <= 0 || timeLeft <= 0) end(hp(0), hp(1));
        else if (frames % 15 === 0) status();
      }
      function end(h0, h1) {
        phase = 'ko'; slow = 90;
        const winner = h0 > h1 ? 0 : h1 > h0 ? 1 : -1, ko = h0 <= 0 || h1 <= 0;
        banner = { text: ko ? 'K.O.!' : (winner === -1 ? '무승부!' : '시간 종료!'), color: '#FFD23F', t: 999, big: true };
        P._result = { winner, ko, hp: [h0, h1] };
      }
      function finish(why) {
        if (phase === 'over') return;
        phase = 'over'; clock.stop();
        const { winner, ko, hp } = P._result || { winner: -1, ko: false, hp: [0, 0] };
        if (net && net.host) send({ k: 'end', r: P._result, why: why || '' });
        let msg;
        if (why && winner === -1) msg = why;
        else if (winner === -1) msg = `무승부 (체력 ${Math.max(0, hp[0])} : ${Math.max(0, hp[1])})`;
        else if (mode === 'local') msg = teamName(winner) + ' 승리!' + (ko ? ' (K.O.)' : '');
        else msg = (winner === myTeam() ? (ko ? '승리! K.O.로 이겼어요' : '승리! 체력이 더 많았어요') : (ko ? '아쉬워요… K.O.' : '아쉬워요… 체력이 모자랐어요')) + (why ? ' · ' + why : '');
        hooks.onTurn({ text: msg, side: -1 });
        const me = P.find(f => f.mine) || P[0];
        hooks.onOver({ winner, win: winner < 0 ? null : (mode === 'local' ? undefined : winner === myTeam()), message: msg, moves: 0, duration_sec: clock.sec(), extra: { hp: hp.map(v => Math.max(0, v)), ko, skill: me.skill, players: n } });
      }
      function status() {
        if (phase === 'pick') { const p = pickers()[pick]; return hooks.onTurn({ text: (p ? p.name : '') + ' · 스킬을 고르세요 (1~3)', side: p ? p.team : 0 }); }
        if (phase === 'waitpick') return hooks.onTurn({ text: '다른 사람이 스킬을 고르는 중…', side: -1 });
        const hp = team => P.filter(f => f.team === team).reduce((s, f) => s + Math.max(0, f.hp), 0);
        hooks.onTurn({ text: `${teamName(0)} ${hp(0)} vs ${hp(1)} ${teamName(1)} · 남은 시간 ${timeLeft}초`, side: 0 });
      }
      const pickers = () => P.filter(f => f.human && !f.remote);
      function choose(v) {
        const list = pickers(), p = list[pick]; if (!p) return;
        p.skill = v; pick++;
        if (online()) { send({ k: 'pick', s: p.i, v }); if (pick >= list.length) { phase = 'waitpick'; status(); } if (isHost()) hostTryGo(); return; }
        if (pick >= list.length) { P.forEach(q => { if (!q.skill) q.skill = 1 + Math.floor(Math.random() * 3); }); phase = 'intro'; intro = 100; status(); }
        else status();
      }
      function hostTryGo() {
        if (!isHost() || phase === 'intro' || phase === 'fight') return;
        if (P.some(q => q.human && !q.skill)) return;
        P.forEach(q => { if (!q.skill) q.skill = 1 + Math.floor(Math.random() * 3); });
        send({ k: 'go', sk: P.map(q => q.skill) });
        phase = 'intro'; intro = 100; status();
      }

      /* ---------- 온라인 ---------- */
      const SNAP_MS = 80;
      function send(m) { if (online() && hooks.onMove) hooks.onMove(m); }
      function hostSnap() {
        send({ k: 'st', ph: phase, tl: timeLeft, it: intro, sh: shake, bn: banner && banner.t > 0 ? [banner.text, banner.color, banner.big ? 1 : 0] : 0,
          p: P.map(f => [Math.round(f.x), Math.round(f.y), f.faceLeft ? 1 : 0, Math.round(f.hp), f.attacking ? f.type : 0, f.stun, f.guardT, f.air ? 1 : 0, f.skillCd, f.doubled ? 1 : 0, Math.round(f.walk * 4) % 8, f.skill]),
          fx: net.fx.splice(0) });
      }
      function applySnap(m) {
        net.sm.push(m);
        if (phase !== 'over' && phase !== 'pick' && m.ph !== phase) { phase = m.ph; if (phase === 'ko') slow = 90; status(); }
        timeLeft = m.tl; intro = m.it; if (m.sh) shake = Math.max(shake, m.sh);
        banner = m.bn ? { text: m.bn[0], color: m.bn[1], t: 999, big: !!m.bn[2] } : null;
        m.p.forEach((a, i) => { const f = P[i]; if (!f) return; f.faceLeft = !!a[2]; f.hp = a[3]; f.attacking = !!a[4]; f.type = a[4]; f.stun = a[5]; f.guardT = a[6]; f.air = !!a[7]; f.skillCd = a[8]; f.doubled = !!a[9]; f.walk = a[10] / 4; if (a[11]) f.skill = a[11]; });
        (m.fx || []).forEach(e => { if (e.kind === 'burst') { for (let k = 0; k < e.n; k++) fx.push({ kind: 'dot', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.7) * 7, life: 26, color: e.color }); } else fx.push({ ...e }); });
        if (frames++ % 15 === 0) status();
      }
      function clientPose() {
        const sm = net.sm; if (!sm.ready) return;
        const a = sm.prev, b = sm.cur;
        P.forEach((f, i) => { const pa = a.p[i], pb = b.p[i]; if (!pa || !pb) return; f.x = sm.mix(pa[0], pb[0]); f.y = sm.mix(pa[1], pb[1]); });
      }
      function clientInput() {
        const me = P.find(f => f.mine); if (!me || phase !== 'fight') return;
        const key = (ctl(me, 'left') ? 1 : 0) | (ctl(me, 'right') ? 2 : 0) | (ctl(me, 'up') ? 4 : 0) | (ctl(me, 'down') ? 8 : 0);
        if (key !== net.lastKey || performance.now() - net.lastSent > 1000) { net.lastKey = key; net.lastSent = performance.now(); send({ k: 'in', s: me.i, b: key }); }
      }

      /* ---------- 그리기 ---------- */
      function poseOf(f) {
        if (f.hp <= 0) return 'hit';
        if (f.stun > 0) return f.stun % 4 < 2 ? 'hit' : 'idle';
        if (f.guardT > 0) return 'guard';
        if (f.attacking) return f.type === 2 ? 'kick' : 'punch';
        if (f.air) return 'jump';
        return f.walk ? (Math.floor(f.walk) % 2 ? 'walk1' : 'walk2') : 'idle';
      }
      const tagOf = f => (mode === 'online' ? (f.mine ? '나' : f.human || f.netId ? f.name : 'CPU') : f.human ? (f.i + 1) + 'P' : 'CPU');
      function render() {
        ctx.save(); ctx.imageSmoothingEnabled = false;
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        drawStage(ctx, bg);
        if (phase === 'pick') { drawPick(); ctx.restore(); return; }
        if (!P.length) { ctx.restore(); return; }
        P.forEach(f => {
          S.shadow(ctx, f.x, FLOOR + 4, 84);
          if (f.attacking && f.type === 3) { ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.sin(frames / 2); ctx.fillStyle = '#FF9A3D'; const hb = hitbox(f, 1); ctx.fillRect(hb.x - 4, hb.y - 4, hb.w + 8, hb.h + 8); ctx.restore(); }
          S.drawFighter(ctx, f.av, poseOf(f), f.x, f.y, SCALE, f.faceLeft ? -1 : 1, f.hp <= 0 ? 0.5 : 1);
          S.text(ctx, tagOf(f), f.x, f.y - BH - 22, 14, f.color);
        });
        fx.forEach(p => {
          const a = Math.max(0, p.life / 26);
          if (p.kind === 'dot') { ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); }
          else if (p.kind === 'star') { ctx.globalAlpha = 1; const r = (p.big ? 30 : 18) * (1 - p.life / 20); ctx.fillStyle = p.big ? '#FFD23F' : '#FFFFFF'; for (let q = 0; q < 8; q++) { const an = q * Math.PI / 4; ctx.fillRect(p.x + Math.cos(an) * r - 3, p.y + Math.sin(an) * r - 3, 6, 6); } ctx.fillRect(p.x - 6, p.y - 6, 12, 12); }
          else if (p.kind === 'txt') { ctx.globalAlpha = Math.min(1, p.life / 15); S.text(ctx, p.text, p.x, p.y, 20, p.color); }
        });
        ctx.globalAlpha = 1;
        hud();
        if (banner && banner.t > 0) S.text(ctx, banner.text, W / 2, banner.big ? H / 2 - 30 : 150, banner.big ? 72 : 26, banner.color);
        if (phase === 'intro') S.text(ctx, intro > 40 ? '준비…' : '일단 덤벼!', W / 2, H / 2 - 30, intro > 40 ? 56 : 72, intro > 40 ? '#FFFFFF' : '#FF5A5F');
        if (phase === 'waitpick') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); S.text(ctx, '다른 사람이 스킬을 고르는 중…', W / 2, H / 2, 32, '#fff'); }
        if (phase === 'paused') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); S.text(ctx, '일시정지', W / 2, H / 2 - 20, 48, '#fff'); S.text(ctx, '화면을 누르거나 [일시정지 / 계속] 버튼을 누르면 계속해요', W / 2, H / 2 + 36, 22, '#FFE45C'); }
        if (touch && (phase === 'fight' || phase === 'intro')) touch.draw(ctx);
        ctx.restore();
      }
      function hud() {
        // 1:1 은 큰 체력 막대 2개, 2:2 는 팀마다 2줄 (원작과 같은 배치)
        const rows = n === 4 ? [[0, 0], [1, 1], [2, 0], [3, 1]] : [[0, 0], [1, 0]];
        const bw = n === 4 ? 300 : 360, bh = n === 4 ? 14 : 20;
        rows.forEach(([i, row]) => {
          const f = P[i]; if (!f) return;
          const right = f.team === 1, x = right ? W - 30 - bw : 30, y = 30 + row * 46, sk = SKILLS[f.skill - 1];
          S.bar(ctx, x, y, bw, bh, Math.max(0, f.hp) / 100, f.hp > 30 ? (f.team === 0 ? '#FF5A5F' : '#4C7DFF') : '#FFD23F');
          S.text(ctx, f.name + (f.mine && n === 4 ? ' (나)' : ''), right ? x + bw : x, y - 14, n === 4 ? 13 : 15, '#fff', right ? 'right' : 'left');
          if (sk) {
            const ready = f.skill === 3 ? !f.doubled : f.skillCd <= 0;
            S.text(ctx, sk.name + (ready ? ' 준비' : ' ' + Math.ceil(f.skillCd / 60) + '초'), right ? x + bw : x, y + bh + 12, 12, ready ? sk.color : '#C9CEE6', right ? 'right' : 'left', 400);
          }
        });
        ctx.fillStyle = 'rgba(11,14,34,.8)'; ctx.fillRect(W / 2 - 42, 16, 84, 52); ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - 42, 16, 84, 52);
        S.text(ctx, String(timeLeft), W / 2, 43, 32, timeLeft <= 10 ? '#FF5A5F' : '#fff');
      }
      const KEYHELP2 = ['G 팔 · H 다리', '', 'K 팔 · L 다리 (숫자패드 1·2)'], KEYHELP4 = ['F 팔 · G 다리', 'P 팔 · [ 다리', '숫자패드 1 팔 · 2 다리', '숫자패드 - 팔 · + 다리'];
      function drawPick() {
        ctx.fillStyle = 'rgba(11,14,34,.72)'; ctx.fillRect(0, 0, W, H);
        const p = pickers()[pick];
        S.text(ctx, (p ? p.name : '') + ' · 스킬을 고르세요', W / 2, 90, 30, '#FFD23F');
        const keys = !p ? '' : mode === 'local' ? (n === 4 ? KEYHELP4 : KEYHELP2)[p.ks[0]] : 'G 팔 · H 다리 (방향키는 K · L)';
        S.text(ctx, '숫자 1~3 키 또는 카드를 눌러요 · 공격 키: ' + keys, W / 2, 135, 15, '#fff', 'center', 400);
        pickRects().forEach((r, i) => {
          ctx.fillStyle = '#FFFDF6'; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.fillStyle = r.s.color; ctx.fillRect(r.x, r.y, r.w, 8);
          ctx.strokeStyle = '#1A1F3D'; ctx.lineWidth = 3; ctx.strokeRect(r.x, r.y, r.w, r.h);
          S.text(ctx, (i + 1) + '. ' + r.s.name, r.x + r.w / 2, r.y + 40, 21, '#1A1F3D');
          S.text(ctx, r.s.how, r.x + r.w / 2, r.y + 74, 15, r.s.color);
          wrap(r.s.desc, r.x + r.w / 2, r.y + 112, r.w - 26, 14);
        });
      }
      function wrap(s, x, y, w, size) {
        ctx.save(); ctx.font = `400 ${size}px Pretendard, sans-serif`; ctx.fillStyle = '#1A1F3D'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        let line = '', yy = y; for (const ch of s) { if (ctx.measureText(line + ch).width > w) { ctx.fillText(line, x, yy); line = ch; yy += size + 6; } else line += ch; }
        ctx.fillText(line, x, yy); ctx.restore();
      }

      function loop(ts) {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
        let k = Math.round(dt * 60) || 1;
        if (!isHost()) { if (phase !== 'over') { clientPose(); clientInput(); } }
        else if (phase === 'intro') { intro -= k; if (intro <= 0) { phase = 'fight'; banner = null; } }
        else if (phase === 'fight') { while (k-- > 0 && phase === 'fight') step(); }
        else if (phase === 'ko') { if (--slow % 3 === 0) { P.forEach(f => { f.vy += GRAV; f.y = Math.min(FLOOR, f.y + f.vy); }); } if (slow <= 0) finish(); }
        if (net && net.host && phase !== 'over' && phase !== 'pick' && phase !== 'waitpick' && ts - net.lastSnap >= SNAP_MS) { net.lastSnap = ts; hostSnap(); }
        if (shake > 0) shake -= 1;
        if (banner && banner.t < 999) banner.t--;
        fx.forEach(p => { if (p.kind === 'dot') { p.x += p.vx; p.y += p.vy; p.vy += 0.35; } else if (p.kind === 'txt') p.y -= 0.8; p.life--; });
        fx = fx.filter(p => p.life > 0);
        render();
      }
      const offImg = S.onImages(render);
      const vis = () => { if (document.hidden && phase === 'fight' && !online()) phase = 'paused'; };
      document.addEventListener('visibilitychange', vis);
      render(); raf = requestAnimationFrame(loop);

      return {
        get state() { return phase === 'over' ? 'over' : phase === 'idle' ? 'ready' : 'playing'; },
        start(o) {
          o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal'; n = o.players === 4 ? 4 : 2;
          buildControls(n === 4 ? KEYS4 : KEYS2);
          const me = S.myAvatar(), meName = S.myName();
          // 혼자(컴퓨터·온라인)는 WASD+G·H 와 방향키+K·L 둘 다 내 아바타
          const solo = n === 4 ? [0, 2] : [0, 2];
          net = null; P = [];
          if (mode === 'online') {
            const roster = o.roster || [], order = S.slotOrder(n);
            net = { host: !!o.host, sm: S.smoother(SNAP_MS), fx: [], lastSnap: 0, lastKey: -1, lastSent: 0 };
            for (let slot = 0; slot < n; slot++) {
              const ri = order.indexOf(slot), r = ri >= 0 ? roster[ri] : null, mine = ri === o.me;
              const f = r ? fighter(slot, mine ? me : (r.avatar || S.cpuAvatar('net-' + r.id)), mine ? meName : r.nick, true, mine ? solo : [], mine) : fighter(slot, S.cpuAvatar('fnet-' + slot), '컴퓨터', false);
              if (r && !mine) { f.netId = r.id; f.remote = net.host ? {} : null; if (!net.host) f.human = false; }
              P.push(f);
            }
          } else if (mode === 'local') {
            const KS = n === 4 ? [[0], [1], [2], [3]] : [[0], [2]];
            for (let slot = 0; slot < n; slot++) P.push(fighter(slot, slot === 0 ? me : S.cpuAvatar('rival-' + slot), slot === 0 ? '1P ' + meName : (slot + 1) + 'P', true, KS[slot], slot === 0));
          } else {
            for (let slot = 0; slot < n; slot++) P.push(slot === 0 ? fighter(0, me, meName, true, solo, true) : fighter(slot, S.cpuAvatar('fight-' + level + slot), n > 2 && S.teamOf(slot, n) === 0 ? '우리 편 컴퓨터' : '컴퓨터' + (n > 2 ? ' ' + (slot - 1) : ''), false));
          }
          timeLeft = cfg().timeLimit || 99; frames = 0; fx = []; banner = null; pick = 0; phase = 'pick'; P._result = null;
          clock.reset(); clock.start(); hooks.onState('playing'); hooks.onButtons(online() ? [] : [{ id: 'pause', label: '일시정지 / 계속' }]); status(); render();
        },
        remote(m) {
          if (!m || !net) return;
          if (m.left) {
            if (m.wasHost && !net.host) { P._result = { winner: -1, ko: false, hp: [0, 0] }; return finish('방장이 나가서 경기가 끝났어요'); }
            const f = P.find(q => q.netId === m.left); if (f && net.host) { f.human = false; f.remote = null; f.name += '(컴퓨터)'; hostTryGo(); }
            return;
          }
          if (net.host) {
            const f = P[m.s];
            if (m.k === 'in' && f && f.remote) f.remote = { left: !!(m.b & 1), right: !!(m.b & 2), up: !!(m.b & 4), down: !!(m.b & 8) };
            else if (m.k === 'act' && f && phase === 'fight' && f.hp > 0) act(f, m.a, { down: !!m.d });
            else if (m.k === 'pick' && f) { f.skill = m.v; hostTryGo(); }
            else if (m.k === 'resign' && f) { const h = [0, 0]; h[f.team] = 0; h[1 - f.team] = 1; P._result = { winner: 1 - f.team, ko: false, hp: h }; finish(f.name + ' 기권'); }
          } else {
            if (m.k === 'st') applySnap(m);
            else if (m.k === 'go') { m.sk.forEach((v, i) => { if (P[i]) P[i].skill = v; }); if (phase === 'waitpick' || phase === 'pick') { phase = 'intro'; status(); } }
            else if (m.k === 'end') { P._result = m.r || { winner: -1, ko: false, hp: [0, 0] }; finish(m.why); }
          }
        },
        press(id) {
          if (id === 'pause') { if (online()) return; if (phase === 'fight') phase = 'paused'; else if (phase === 'paused') phase = 'fight'; return; }
          if (id === 'resign' && phase !== 'over' && phase !== 'idle') {
            if (online()) {
              const me = P.find(f => f.mine);
              if (net.host) { P._result = { winner: 1 - me.team, ko: false, hp: me.team === 0 ? [0, 1] : [1, 0] }; finish(me.name + ' 기권'); }
              else send({ k: 'resign', s: me.i });
              return;
            }
            phase = 'over'; clock.stop();
            const msg = mode === 'ai' ? '기권 · 컴퓨터 승' : P[0].name + ' 기권';
            hooks.onTurn({ text: msg, side: -1 });
            hooks.onOver({ winner: 1, message: msg, moves: 0, duration_sec: clock.sec(), extra: { resigned: true } });
          }
        },
        togglePause() { if (online()) return; if (phase === 'fight') phase = 'paused'; else if (phase === 'paused') phase = 'fight'; },
        action() {},
        destroy() { cancelAnimationFrame(raf); input.off(); if (touch) touch.off(); offImg(); canvas.removeEventListener('pointerdown', onDown); document.removeEventListener('visibilitychange', vis); }
      };
    }
  };
})();
