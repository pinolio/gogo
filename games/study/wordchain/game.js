/*
 * gogo?gogo! — 끝말잇기 (공부?, 2~4명)
 *  - AI 대전(컴퓨터 1~3명) · 한 기기(돌아가며 입력) · 온라인(방 코드, 빈자리는 컴퓨터)
 *  - 앞 낱말의 끝 글자로 시작하는, 사전에 있는 명사(2~5글자)를 시간 안에 입력. 한 번 나온 낱말은 다시 못 씀
 *  - 두음법칙 인정: 끝 글자가 '력' 이면 '력'·'역' 둘 다 가능, '녀' → '여', '라' → '나' …
 *  - 시간 안에 못 이으면 탈락 → 마지막까지 남은 사람이 1등
 *  - 온라인: 방장 기기가 낱말 확인·시간·컴퓨터를 맡고 상태를 보냄. 다른 사람은 입력한 낱말만 보냄
 */
(function () {
  'use strict';
  const T = window.GoStudy;
  const W = 960, H = 540;
  const COL = ['#FFD23F', '#5B8CFF', '#FF6B70', '#3DDC84'];
  const cfg = () => window.GoSettings.get('wordchain') || {};
  const myName = () => (window.GameHub.user ? window.GameHub.user.nickname : '나');

  window.GoGames.wordchain = {
    id: 'wordchain', size: [W, H],
    thumb(ctx, w, h) {
      { const im = T.pic('games/study/wordchain/img/bg.jpg'); if (!(im.complete && im.naturalWidth)) im.addEventListener('load', () => { try { this.thumb(ctx, w, h); } catch (e) { /* noop */ } }, { once: true }); }   // v39 배경 그림이 오면 다시 그림
      ctx.save(); ctx.scale(w / W, h / H);
      ctx.fillStyle = '#141A3A'; ctx.fillRect(0, 0, W, H); T.scene(ctx, 'games/study/wordchain/img/bg.jpg', W, H, 0.35);
      const words = ['사과', '과자', '자동차', '차표'];
      words.forEach((wd, i) => {
        const x = 70 + i * 215, y = 190 + (i % 2) * 70;
        T.round(ctx, x, y, 190, 110, 18, i === 3 ? '#FFD23F' : '#26306A', '#0A0E24', 4);
        T.text(ctx, wd, x + 95, y + 56, 52, i === 3 ? '#1D2340' : '#EEF1FF', 'center');
        if (i < 3) T.text(ctx, '→', x + 202, y + 56 + (i % 2 ? -35 : 35), 40, '#FFD23F', 'center');
      });
      T.text(ctx, '끝말잇기', W / 2, 90, 64, '#FFFFFF', 'center');
      ctx.restore();
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      let mode = 'ai', level = 'normal', n = 2, net = null, D = null, g = null, raf = 0, botTimer = 0, lastSubmit = { w: '', t: 0 };
      const online = () => mode === 'online', isHost = () => !online() || (net && net.host);

      /* ---------- 입력 칸 (게임 화면 아래쪽에 겹쳐 놓음) ---------- */
      const host = canvas.parentElement;
      const form = document.createElement('form');
      form.className = 'wc-form'; form.hidden = true; form.setAttribute('autocomplete', 'off');
      form.innerHTML = '<input type="text" maxlength="8" placeholder="낱말 입력 후 Enter" aria-label="낱말 입력" autocapitalize="off" spellcheck="false" enterkeyhint="send"><button class="btn btn-sun" type="submit">입력</button>';
      host.appendChild(form);
      const inp = form.querySelector('input');
      inp.addEventListener('focus', () => { if (window.innerWidth < 900) setTimeout(() => { try { canvas.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* noop */ } }, 250); });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const w = inp.value.trim().replace(/\s+/g, '');
        if (!w || !g || g.phase !== 'play') return;
        if (w === lastSubmit.w && performance.now() - lastSubmit.t < 400) return;   // 한글 입력기 Enter 두 번 막기
        lastSubmit = { w, t: performance.now() };
        const slot = g.turn, p = g.P[slot];
        if (!canType(p)) return;
        inp.value = '';
        if (isHost()) submit(slot, w); else send({ k: 'w', s: slot, w });
      });
      const canType = p => p && !p.out && (online() ? p.mine : p.human);
      const whose = p => (mode !== 'local' && p.mine ? '내' : p.name);   // '나 차례' → '내 차례'

      /* ---------- 사전 ---------- */
      const reqOf = word => T.starts(word[word.length - 1]);
      function check(word, req) {
        if (!/^[가-힣]+$/.test(word)) return '한글 낱말만 쓸 수 있어요';
        if (word.length < 2) return '두 글자 이상이어야 해요';
        if (!req.includes(word[0])) return `'${req.join("' 또는 '")}' (으)로 시작해야 해요`;
        if (g.used.has(word)) return '이미 나온 낱말이에요';
        if (!D.all.has(word)) return '사전에 없는 낱말이에요 (명사만 가능)';
        return '';
      }
      // 이 낱말 뒤에 올 수 있는 (아직 안 쓴) 자주 쓰는 낱말 수
      const follow = word => reqOf(word).reduce((s, c) => s + (D.byFirst[c] || []).filter(x => !g.used.has(x)).length, 0);

      /* ---------- 진행 ---------- */
      function timeFor() { const c = cfg(); return Math.max(c.minTime || 7, (c.turnTime || 15) - (c.timeStep || 0.4) * (g.chain.length - 1)) * 1000; }
      function newGame(names) {
        g = { P: names, used: new Set(), chain: [], turn: 0, phase: 'play', out: [], msg: '', msgFor: -1, msgT: 0, left: 0, max: 0, deadline: 0, flash: 0 };
        // 시작 단어: 자주 쓰는 2~3글자, 이어 갈 낱말이 충분한 것
        const pool = D.common.filter(w => w.length >= 2 && w.length <= 3 && follow(w) >= 25);
        const first = pool[Math.floor(Math.random() * pool.length)] || '사과';
        g.chain.push({ w: first, by: -1 }); g.used.add(first);
        g.turn = Math.floor(Math.random() * n);
        say('시작 단어는 「' + first + '」', -1);
        beginTurn();
      }
      function alive() { return g.P.filter(p => !p.out); }
      function beginTurn() {
        g.max = timeFor(); g.deadline = performance.now() + g.max; g.left = g.max;
        clearTimeout(botTimer);
        const p = g.P[g.turn];
        if (isHost() && p.cpu) {
          const L = (cfg().bots || {})[level] || { think: [2, 5], miss: 0.07 };
          const think = (L.think[0] + Math.random() * (L.think[1] - L.think[0])) * 1000;
          botTimer = setTimeout(() => botMove(g.turn, L), Math.min(think, g.max - 600));
        }
        syncInput(); status(); broadcast();
      }
      function botMove(slot, L) {
        if (!g || g.phase !== 'play' || g.turn !== slot) return;
        const cur = g.chain[g.chain.length - 1].w, req = reqOf(cur);
        let cands = req.flatMap(c => D.byFirst[c] || []).filter(w => !g.used.has(w));
        const few = cands.length < 6 ? 0.25 : 0;
        if (!cands.length || Math.random() < L.miss + few * (level === 'hard' ? 0.3 : 1)) return;   // 못 찾음 → 시간 초과로 탈락
        if (level === 'hard') {   // 상대가 잇기 어려운 낱말 고르기
          cands = cands.slice(0, 400).map(w => ({ w, f: follow(w) })).sort((a, b) => a.f - b.f);
          const pick = cands.find(c => c.f >= (g.P[nextSlot(slot)].cpu ? 8 : 2) && Math.random() < 0.5) || cands[Math.floor(Math.random() * cands.length)];   // 다음이 사람이면 세게, 컴퓨터면 살살
          return submit(slot, pick.w);
        }
        if (level === 'easy') cands = cands.filter(w => w.length <= 3).concat(cands).slice(0, 300);
        submit(slot, cands[Math.floor(Math.random() * cands.length)]);
      }
      function submit(slot, word) {
        if (!g || g.phase !== 'play' || g.turn !== slot || g.P[slot].out) return;
        const cur = g.chain[g.chain.length - 1].w, why = check(word, reqOf(cur));
        if (why) { say(why, slot, true); if (online() && net.host && !g.P[slot].mine) send({ k: 'bad', s: slot, why }); render(); return; }
        g.used.add(word); g.chain.push({ w: word, by: slot }); g.P[slot].words++; g.flash = 1;
        say(g.P[slot].name + ' 「' + word + '」', -1);
        nextTurn();
      }
      function nextSlot(from) { let t = from; for (let k = 0; k < n; k++) { t = (t + 1) % n; if (!g.P[t].out) break; } return t; }
      function nextTurn() {
        let t = g.turn;
        for (let k = 0; k < n; k++) { t = (t + 1) % n; if (!g.P[t].out) break; }
        g.turn = t; beginTurn();
      }
      function knockOut(slot, why) {
        const p = g.P[slot]; if (p.out) return;
        p.out = true; g.out.push(slot);
        say(p.name + ' ' + why + ' · 탈락!', -1, true);
        if (alive().length <= 1) return end();
        if (g.turn === slot) nextTurn(); else { syncInput(); status(); broadcast(); }
      }
      function end() {
        clearTimeout(botTimer);
        const last = g.P.findIndex(p => !p.out); if (last >= 0) g.out.push(last);
        g.phase = 'over'; syncInput(); broadcast(); if (online() && net.host) send({ k: 'end', out: g.out });
        finish();
      }
      // 결과 (각 기기에서 내 등수 계산)
      function finish(why) {
        if (g.done) return; g.done = true; g.phase = 'over'; clock.stop(); clearTimeout(botTimer); syncInput();
        const order = g.out.slice().reverse();   // 1등부터
        const winSlot = order[0], winner = g.P[winSlot];
        const meSlot = online() ? g.P.findIndex(p => p.mine) : 0, rank = order.indexOf(meSlot) + 1 || n;
        let msg;
        if (why) msg = why;
        else if (mode === 'local') msg = (winner ? winner.name : '') + ' 우승! (' + g.chain.length + '개 이음)';
        else msg = rank === 1 ? '우승! 마지막까지 살아남았어요' : (n > 2 ? rank + '등 · ' : '') + (winner ? winner.name + ' 우승' : '아쉬워요');
        msg += ' · 내가 이은 낱말 ' + (g.P[meSlot] ? g.P[meSlot].words : 0) + '개';
        hooks.onTurn({ text: msg, side: -1 });
        const res = { message: msg, moves: (g.len || g.chain.length) - 1, duration_sec: clock.sec(), extra: { words: g.P[meSlot] ? g.P[meSlot].words : 0, players: n, rank, chain: (g.len || g.chain.length) - 1 } };
        if (why && online()) Object.assign(res, { winner: -1 });
        else if (mode === 'local') Object.assign(res, { winner: n === 2 ? winSlot : (winSlot === 0 ? 0 : 1) });
        else Object.assign(res, { win: rank === 1, winner: rank === 1 ? 0 : 1, rank, players: n });
        hooks.onOver(res);
        render();
      }
      function say(text, forSlot, bad) { g.msg = text; g.msgFor = forSlot; g.msgBad = !!bad; g.msgT = performance.now(); }
      function status() {
        if (!g) return;
        if (g.phase !== 'play') return;
        const p = g.P[g.turn], req = reqOf(g.chain[g.chain.length - 1].w);
        hooks.onTurn({ text: `${whose(p)} 차례 · '${req.join("' 또는 '")}'(으)로 시작 · 남은 ${alive().length}명`, side: g.turn === 0 ? 0 : 1 });
      }
      function syncInput() {
        const p = g && g.phase === 'play' ? g.P[g.turn] : null, show = !!(p && canType(p));
        form.hidden = !show;
        if (show) {
          inp.placeholder = (mode === 'local' ? p.name + ' · ' : '') + "'" + reqOf(g.chain[g.chain.length - 1].w).join("'/'") + "'(으)로 시작하는 낱말";
          if (document.activeElement !== inp && !document.querySelector('.modal:not([hidden])')) { try { inp.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
        }
      }

      /* ---------- 온라인 ---------- */
      function send(m) { if (online() && hooks.onMove) hooks.onMove(m); }
      // 상태 보내기 (남은 시간은 ms — 'left' 는 '나간 사람' 알림 이름과 겹쳐서 쓰면 안 됨)
      function broadcast() {
        if (!online() || !net.host || !g) return;
        send({ k: 'st', P: g.P.map(p => [p.out ? 1 : 0, p.words, p.cpu ? 1 : 0, p.name]), chain: g.chain.slice(-12), len: g.chain.length, turn: g.turn, ms: Math.max(0, g.deadline - performance.now()), max: g.max, msg: g.msgFor === -1 ? g.msg : '', bad: g.msgBad ? 1 : 0, ph: g.phase });
      }
      function applyState(m) {
        if (!g) return;
        m.P.forEach((a, i) => { const p = g.P[i]; if (!p) return; p.out = !!a[0]; p.words = a[1]; p.cpu = !!a[2]; if (a[3]) p.name = p.mine ? p.name : a[3]; });
        const grew = m.len > g.chain.length;
        g.chain = m.chain; g.len = m.len; g.turn = m.turn; g.max = m.max; g.deadline = performance.now() + m.ms; if (grew) g.flash = 1;
        if (m.msg) say(m.msg, -1, !!m.bad);
        syncInput(); status();
      }

      /* ---------- 그리기 ---------- */
      function render() {
        ctx.fillStyle = '#121735'; ctx.fillRect(0, 0, W, H);
        if (T.scene(ctx, 'games/study/wordchain/img/bg.jpg', W, H, 0.2)) { if (g) T.glass(ctx, 60, 120, W - 120, H - 150, 0.62); }   // v39 밤 도서관 배경
        else { ctx.fillStyle = 'rgba(91,140,255,.06)'; for (let y = 0; y < H; y += 24) ctx.fillRect(0, y, W, 1); }
        if (!g) { T.text(ctx, D ? '끝말잇기' : '사전을 불러오는 중…', W / 2, H / 2, 40, '#EEF1FF', 'center'); return; }
        // 위쪽: 참가자 카드
        const cw = (W - 40 - (n - 1) * 12) / n;
        g.P.forEach((p, i) => {
          const x = 20 + i * (cw + 12), y = 16, on = g.phase === 'play' && g.turn === i && !p.out;
          T.round(ctx, x, y, cw, 74, 12, p.out ? '#1B2042' : on ? '#2A3A86' : '#1E2654', on ? '#FFD23F' : COL[i], on ? 4 : 2);
          T.text(ctx, p.name + (p.mine && online() ? ' (나)' : ''), x + 14, y + 24, 18, p.out ? '#6B7299' : '#FFFFFF', 'left');
          T.text(ctx, p.out ? '탈락' : p.cpu ? '컴퓨터' : '사람', x + cw - 12, y + 24, 13, p.out ? '#FF8A8A' : '#9AA4D8', 'right', 400);
          T.text(ctx, '이은 낱말 ' + p.words + '개', x + 14, y + 54, 14, p.out ? '#6B7299' : COL[i], 'left', 400);
          if (on) {   // 남은 시간 막대
            const r = Math.max(0, (g.deadline - performance.now()) / g.max);
            ctx.fillStyle = r < 0.3 ? '#FF5A5F' : '#FFD23F'; ctx.fillRect(x + 6, y + 68, (cw - 12) * r, 4);
          }
        });
        // 가운데: 지금 낱말 (끝 글자 강조)
        const cur = g.chain[g.chain.length - 1].w, req = reqOf(cur);
        const big = Math.min(96, 640 / Math.max(2, cur.length)), pop = g.flash > 0 ? 1 + g.flash * 0.12 : 1;
        ctx.save(); ctx.translate(W / 2, 205); ctx.scale(pop, pop);
        ctx.font = `700 ${big}px Galmuri11, Pretendard, sans-serif`; const tw = ctx.measureText(cur).width, lw = ctx.measureText(cur.slice(-1)).width;
        T.text(ctx, cur.slice(0, -1), -tw / 2, 0, big, '#EEF1FF', 'left');
        T.round(ctx, tw / 2 - lw - 8, -big * 0.62, lw + 16, big * 1.24, 12, 'rgba(255,210,63,.18)', '#FFD23F', 3);
        T.text(ctx, cur.slice(-1), tw / 2 - lw, 0, big, '#FFD23F', 'left');
        ctx.restore();
        if (g.phase === 'play') {
          const p = g.P[g.turn], secs = Math.max(0, Math.ceil((g.deadline - performance.now()) / 1000));
          T.text(ctx, `다음 글자: ${req.map(c => '「' + c + '」').join(' 또는 ')}`, W / 2, 292, 26, '#FFFFFF', 'center');
          T.text(ctx, `${whose(p)} 차례 · ${secs}초`, W / 2, 330, 22, secs <= 3 ? '#FF5A5F' : '#9AE6FF', 'center');
        }
        // 지나온 낱말들
        const hist = g.chain.slice(-7, -1);
        if (hist.length) T.text(ctx, hist.map(c => c.w).join(' → ') + ' →', W / 2, 372, 16, '#8A93C0', 'center', 400);
        // 알림 (틀린 이유는 입력한 사람에게만)
        if (g.msg && performance.now() - g.msgT < 3500 && (g.msgFor === -1 || canType(g.P[g.msgFor]))) T.text(ctx, g.msg, W / 2, 410, 20, g.msgBad ? '#FF8A8A' : '#7DFFC4', 'center');
        if (g.phase === 'play' && !canType(g.P[g.turn])) T.text(ctx, g.P[g.turn].cpu ? '컴퓨터가 생각하는 중…' : g.P[g.turn].name + ' 님이 입력하는 중…', W / 2, 478, 18, '#9AA4D8', 'center', 400);
      }
      let lastBc = 0;
      function loop() {
        raf = requestAnimationFrame(loop);
        if (g && g.phase === 'play' && isHost() && performance.now() > g.deadline) knockOut(g.turn, '시간 초과');
        // 온라인 방장: 1초마다 상태를 다시 보냄 (늦게 준비된 사람·시간 맞추기)
        if (g && g.phase === 'play' && online() && net && net.host && performance.now() - lastBc > 1000) { lastBc = performance.now(); broadcast(); }
        if (g && g.flash > 0) g.flash = Math.max(0, g.flash - 0.06);
        render();
      }
      raf = requestAnimationFrame(loop);
      T.dict().then(d => { D = d; render(); }).catch(() => {});

      return {
        get state() { return !g ? 'ready' : g.phase === 'over' ? 'over' : 'playing'; },
        async start(o) {
          o = o || {}; mode = o.mode || 'ai'; level = o.level || 'normal'; n = Math.min(4, Math.max(2, o.players || 2));
          clearTimeout(botTimer); g = null; net = null; form.hidden = true;
          hooks.onState('playing'); hooks.onButtons([]); hooks.onTurn({ text: '사전을 불러오는 중…', side: -1 });
          try { D = await T.dict(); } catch (e) { hooks.onTurn({ text: '사전을 불러오지 못했어요. 새로고침해 주세요.', side: -1 }); return; }
          const P = [];
          if (mode === 'online') {
            const roster = o.roster || [];
            net = { host: !!o.host };
            for (let s = 0; s < n; s++) { const r = roster[s]; P.push(r ? { name: r.nick || myName(),   // 온라인은 모두 방 이름표(닉네임)로 — 손님끼리 '나'로 보이던 문제
                mine: s === o.me, human: true, cpu: false, netId: r.id, out: false, words: 0 } : { name: '컴퓨터' + (s + 1), mine: false, human: false, cpu: true, out: false, words: 0 }); }
          } else if (mode === 'local') {
            for (let s = 0; s < n; s++) P.push({ name: s === 0 ? myName() : (s + 1) + '번', human: true, cpu: false, out: false, words: 0 });
          } else {
            for (let s = 0; s < n; s++) P.push(s === 0 ? { name: myName(), human: true, mine: true, cpu: false, out: false, words: 0 } : { name: '컴퓨터' + (n > 2 ? s : ''), human: false, cpu: true, out: false, words: 0 });
          }
          clock.reset(); clock.start();
          if (isHost()) newGame(P);
          else { g = { P, used: new Set(), chain: [{ w: '…', by: -1 }], turn: 0, phase: 'play', out: [], msg: '방장이 시작 단어를 고르는 중…', msgFor: -1, msgT: performance.now(), max: 1, deadline: 0, flash: 0 }; syncInput(); send({ k: 'hi' }); }   // 준비됐으니 상태 보내 달라고
        },
        remote(m) {
          if (!m || !net || !g) return;
          if (m.left && !m.k) {
            if (m.wasHost && !net.host) { if (g.phase === 'play') { g.out = []; finish('방장이 나가서 경기가 끝났어요'); } return; }
            const i = g.P.findIndex(p => p.netId === m.left);
            if (i >= 0 && net.host && !g.P[i].out) { g.P[i].human = false; g.P[i].cpu = true; g.P[i].name += '(CPU)'; say(g.P[i].name.replace('(CPU)', '') + ' 님이 나가서 컴퓨터가 이어서 해요', -1); if (g.turn === i) beginTurn(); else broadcast(); }
            return;
          }
          if (net.host) {
            if (m.k === 'w' && g.P[m.s] && g.P[m.s].netId && !g.P[m.s].mine) submit(m.s, String(m.w || '').slice(0, 8));
            else if (m.k === 'resign' && g.P[m.s]) knockOut(m.s, '기권');
            else if (m.k === 'hi') broadcast();
          } else {
            if (m.k === 'st') applyState(m);
            else if (m.k === 'bad' && g.P[m.s] && g.P[m.s].mine) { say(m.why, m.s, true); }
            else if (m.k === 'end') { g.out = m.out || []; g.P.forEach((p, i) => { p.out = i !== g.out[g.out.length - 1]; }); finish(); }
          }
        },
        press(id) {
          if (id !== 'resign' || !g || g.phase !== 'play') return;
          if (online()) { const me = g.P.findIndex(p => p.mine); if (net.host) knockOut(me, '기권'); else send({ k: 'resign', s: me }); return; }
          if (mode === 'ai') { g.out = g.out.filter(i => i !== 0); g.out.unshift(0); g.P.forEach((p, i) => { if (i && !p.out) g.out.push(i); }); g.P[0].out = true; return finish(); }   // 나 = 꼴찌
          knockOut(g.turn, '기권');
        },
        togglePause() {}, action() {},
        destroy() { cancelAnimationFrame(raf); clearTimeout(botTimer); form.remove(); }
      };
    }
  };
})();
