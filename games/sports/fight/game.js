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
      let mode = 'ai', level = 'normal', phase = 'idle', raf = 0, last = 0, frames = 0, timeLeft = 99;
      let P = [], pick = 0, fx = [], shake = 0, banner = null, intro = 0, slow = 0;

      const input = S.keys({
        KeyA: 'p0.left', KeyD: 'p0.right', KeyW: 'p0.up', KeyS: 'p0.down', KeyG: 'p0.punch', KeyH: 'p0.kick',
        ArrowLeft: 'p1.left', ArrowRight: 'p1.right', ArrowUp: 'p1.up', ArrowDown: 'p1.down',
        Numpad1: 'p1.punch', Numpad2: 'p1.kick', KeyK: 'p1.punch', KeyL: 'p1.kick', Comma: 'p1.punch', Period: 'p1.kick',
        Digit1: 'k1', Digit2: 'k2', Digit3: 'k3'
      }, a => onKey(a));
      const touch = S.touchDevice() ? S.pad(canvas, W, H, [
        { id: 'p0.left', label: '◀', x: 66, y: 462, r: 58, font: 30 }, { id: 'p0.right', label: '▶', x: 200, y: 462, r: 58, font: 30 },
        { id: 'p0.up', label: '▲', x: 133, y: 360, r: 48, font: 28 }, { id: 'p0.down', label: '▼', x: 300, y: 492, r: 42, font: 24 },
        { id: 'p0.punch', label: '팔', x: W - 196, y: 470, r: 60, font: 30 }, { id: 'p0.kick', label: '다리', x: W - 68, y: 400, r: 58, font: 26 }
      ], input, a => onKey(a)) : null;
      const pickRects = () => SKILLS.map((s, i) => ({ s, x: 120 + i * 250, y: 190, w: 220, h: 200 }));
      const onDown = e => {
        if (phase !== 'pick') return;
        const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
        const r = pickRects().find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
        if (r) choose(r.s.id);
      };
      canvas.addEventListener('pointerdown', onDown);

      function fighter(i, av, name, human, color) {
        const left = i === 0;
        return { i, av, name, human, color, team: left ? 0 : 1, x: left ? 300 : W - 300, y: FLOOR, vy: 0, air: false, faceLeft: !left,
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

      function onKey(a) {
        if (phase === 'pick') { const n = { k1: 1, k2: 2, k3: 3 }[a]; if (n) choose(n); return; }
        if (phase !== 'fight') return;
        const m = a.match(/^p(\d)\.(\w+)$/); if (!m) return;
        const f = P[+m[1]]; if (!f || !f.human || f.hp <= 0) return;
        act(f, m[2], { down: !!input.down['p' + f.i + '.down'] });
      }
      // 버튼 한 번 누름 → 공격·스킬 (사람과 컴퓨터가 같이 씀)
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
      function burst(x, y, color, n) { for (let k = 0; k < n; k++) fx.push({ kind: 'dot', x, y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.7) * 7, life: 26, color }); }
      function spark(x, y, big) {
        fx.push({ kind: 'star', x, y, life: big ? 16 : 10, big });
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

      /* ---------- 한 프레임 (원작과 같은 60프레임 기준) ---------- */
      function step() {
        frames++;
        P.forEach(f => {
          if (f.hp <= 0) return;
          if (!f.human) ai(f);
          const k = f.human ? n => !!input.down['p' + f.i + '.' + n] : n => !!f.ai.hold[n];
          if (f.stun > 0) f.stun--;
          if (f.guardT > 0) f.guardT--;
          if (f.guardCd > 0) f.guardCd--;
          if (f.skillCd > 0) f.skillCd--;
          const e = closest(f); if (e) f.faceLeft = e.x < f.x;
          // 자동 막기: 뒤로 누르고 있을 때 상대 공격이 닿으려 하면
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
        // 몸끼리 겹치지 않게 살짝 밀어냄 (점프로 넘어가는 건 가능)
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j]; if (a.hp <= 0 || b.hp <= 0 || Math.abs(a.y - b.y) > BH * 0.6) continue;
          const d = b.x - a.x, need = BW * 0.9 - Math.abs(d);
          if (need > 0) { const s = d >= 0 ? 1 : -1; a.x -= s * need / 2; b.x += s * need / 2; a.x = Math.max(BW / 2, Math.min(W - BW / 2, a.x)); b.x = Math.max(BW / 2, Math.min(W - BW / 2, b.x)); }
        }
        // 공격 판정
        P.forEach(f => {
          if (f.hp <= 0 || !f.attacking) return;
          f.atkT--;
          const hb = hitbox(f, f.type === 2 ? 2 : 1);
          if (f.atkT > 0) enemiesOf(f).forEach(t => {
            if (f.hitList.includes(t) || !overlap(hb, rect(t))) return;
            const heavy = f.type === 2, cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
            // 컴퓨터는 난이도만큼 공격을 읽고 막음 (연타만으로는 못 이기게)
            if (!t.human && t.stun <= 0 && !t.attacking && Math.random() < (LV[level] || LV.normal).guard * 0.5) { t.guardT = 15; t.guardCd = 20; }
            if (t.guardT > 0) { t.hp -= heavy ? 3 : 1; fx.push({ kind: 'txt', x: t.x, y: t.y - BH - 10, text: '막기!', color: '#BFE3FF', life: 30 }); spark(cx, cy, false); }
            else {
              const dmg = heavy ? 15 : 5; t.hp -= dmg; t.stun = 18; t.attacking = false; t.atkT = 0;
              t.x += (f.faceLeft ? -1 : 1) * (heavy ? 18 : 10);
              fx.push({ kind: 'txt', x: t.x, y: t.y - BH - 10, text: '-' + dmg, color: heavy ? '#FF5A5F' : '#FFE48A', life: 36 });
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
        P._result = { winner, ko };
      }
      function finish() {
        phase = 'over'; clock.stop();
        const { winner, ko } = P._result, me = P[0], op = P[1];
        let msg;
        if (winner === -1) msg = `무승부 (체력 ${Math.max(0, me.hp)} : ${Math.max(0, op.hp)})`;
        else if (mode === 'ai') msg = winner === 0 ? (ko ? '승리! K.O.로 이겼어요' : '승리! 체력이 더 많았어요') : (ko ? '아쉬워요… K.O.' : '아쉬워요… 체력이 모자랐어요');
        else msg = P[winner].name + ' 승리!' + (ko ? ' (K.O.)' : '');
        hooks.onTurn({ text: msg, side: -1 });
        hooks.onOver({ winner, message: msg, moves: 0, duration_sec: clock.sec(), extra: { hp: [Math.max(0, me.hp), Math.max(0, op.hp)], ko, skill: me.skill } });
      }
      function status() {
        if (phase === 'pick') return hooks.onTurn({ text: (P[pick] ? P[pick].name : '') + ' · 스킬을 고르세요 (1~3)', side: pick === 0 ? 0 : 1 });
        hooks.onTurn({ text: `${P[0].name} ${Math.max(0, P[0].hp)} vs ${Math.max(0, P[1].hp)} ${P[1].name} · 남은 시간 ${timeLeft}초`, side: 0 });
      }
      function choose(n) {
        P[pick].skill = n; pick++;
        while (pick < P.length && !P[pick].human) { P[pick].skill = 1 + Math.floor(Math.random() * 3); pick++; }
        if (pick >= P.length) { phase = 'intro'; intro = 100; status(); } else status();
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
          S.text(ctx, f.i === 0 ? '1P' : (f.human ? '2P' : 'CPU'), f.x, f.y - BH - 22, 14, f.color);
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
        if (phase === 'paused') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); S.text(ctx, '일시정지', W / 2, H / 2, 48, '#fff'); }
        if (touch && (phase === 'fight' || phase === 'intro')) touch.draw(ctx);
        ctx.restore();
      }
      function hud() {
        const bw = 360;
        [0, 1].forEach(i => {
          const f = P[i], x = i === 0 ? 30 : W - 30 - bw, sk = SKILLS[f.skill - 1];
          S.bar(ctx, x, 30, bw, 20, Math.max(0, f.hp) / 100, f.hp > 30 ? (i === 0 ? '#FF5A5F' : '#4C7DFF') : '#FFD23F');
          S.text(ctx, f.name, i === 0 ? x : x + bw, 14, 15, '#fff', i === 0 ? 'left' : 'right');
          if (sk) {
            const ready = f.skill === 3 ? !f.doubled : f.skillCd <= 0;
            S.text(ctx, sk.name + (ready ? ' 준비' : ' ' + Math.ceil(f.skillCd / 60) + '초'), i === 0 ? x : x + bw, 66, 13, ready ? sk.color : '#C9CEE6', i === 0 ? 'left' : 'right', 400);
          }
        });
        ctx.fillStyle = 'rgba(11,14,34,.8)'; ctx.fillRect(W / 2 - 42, 16, 84, 52); ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - 42, 16, 84, 52);
        S.text(ctx, String(timeLeft), W / 2, 43, 32, timeLeft <= 10 ? '#FF5A5F' : '#fff');
      }
      function drawPick() {
        ctx.fillStyle = 'rgba(11,14,34,.72)'; ctx.fillRect(0, 0, W, H);
        const p = P[pick];
        S.text(ctx, (p ? p.name : '') + ' · 스킬을 고르세요', W / 2, 90, 30, '#FFD23F');
        S.text(ctx, '숫자 1~3 키 또는 카드를 눌러요', W / 2, 135, 15, '#fff', 'center', 400);
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
        let n = Math.round(dt * 60) || 1;
        if (phase === 'intro') { intro -= n; if (intro <= 0) { phase = 'fight'; banner = null; } }
        else if (phase === 'fight') { while (n-- > 0 && phase === 'fight') step(); }
        else if (phase === 'ko') { if (--slow % 3 === 0) { P.forEach(f => { f.vy += GRAV; f.y = Math.min(FLOOR, f.y + f.vy); }); } if (slow <= 0) finish(); }
        if (shake > 0) shake -= 1;
        if (banner && banner.t < 999) banner.t--;
        fx.forEach(p => { if (p.kind === 'dot') { p.x += p.vx; p.y += p.vy; p.vy += 0.35; } else if (p.kind === 'txt') p.y -= 0.8; p.life--; });
        fx = fx.filter(p => p.life > 0);
        render();
      }
      const offImg = S.onImages(render);
      const vis = () => { if (document.hidden && phase === 'fight') phase = 'paused'; };
      document.addEventListener('visibilitychange', vis);
      render(); raf = requestAnimationFrame(loop);

      return {
        get state() { return phase === 'over' ? 'over' : phase === 'idle' ? 'ready' : 'playing'; },
        start(o) {
          o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal';
          const me = S.myAvatar(), meName = S.myName();
          P = [fighter(0, me, mode === 'local' ? '1P ' + meName : meName, true, '#FF8A8E'),
            mode === 'local' ? fighter(1, S.cpuAvatar('rival'), '2P 친구', true, '#9DC0FF') : fighter(1, S.cpuAvatar('fight-' + level), '컴퓨터', false, '#9DC0FF')];
          timeLeft = cfg().timeLimit || 99; frames = 0; fx = []; banner = null; pick = 0; phase = 'pick';
          clock.reset(); clock.start(); hooks.onState('playing'); hooks.onButtons([{ id: 'pause', label: '일시정지 / 계속' }]); status(); render();
        },
        press(id) {
          if (id === 'pause') { if (phase === 'fight') phase = 'paused'; else if (phase === 'paused') phase = 'fight'; return; }
          if (id === 'resign' && phase !== 'over' && phase !== 'idle') {
            phase = 'over'; clock.stop();
            const msg = mode === 'ai' ? '기권 · 컴퓨터 승' : P[0].name + ' 기권';
            hooks.onTurn({ text: msg, side: -1 });
            hooks.onOver({ winner: 1, message: msg, moves: 0, duration_sec: clock.sec(), extra: { resigned: true } });
          }
        },
        togglePause() { if (phase === 'fight') phase = 'paused'; else if (phase === 'paused') phase = 'fight'; },
        action() {},
        destroy() { cancelAnimationFrame(raf); input.off(); if (touch) touch.off(); offImg(); canvas.removeEventListener('pointerdown', onDown); document.removeEventListener('visibilitychange', vis); }
      };
    }
  };
})();
