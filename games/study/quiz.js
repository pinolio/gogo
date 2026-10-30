/*
 * gogo?gogo! — '공부?' 4지선다 퀴즈 공통 화면 (GoQuiz) · v36
 *  - 사자성어 맞추기와 같은 방식: 제한 시간 동안 4지선다, 맞히면 점수 + 연속 보너스, 틀리면 정답·풀이를 1.5초 보여 줌
 *  - 영어 단어 퀴즈(english) · 한국사 퀴즈(history) 가 이 화면을 같이 씀 (사자성어는 원래 파일 그대로)
 *  - 게임마다 넘겨 주는 것 (spec)
 *    id, title, sub, rules[], watermark(빈 화면 큰 글자), colors{top,bottom}
 *    modes: [{ id, label, desc }] — 시작 화면에서 고르는 단계 (없으면 바로 시작)
 *    make(mode, used) → 문제 { badge, badgeColor, prompt, big(크게 쓸 글자 여부), choices[4], ans(정답 번호), worth(이 문제 점수), long(보기가 긴 글), revealTitle, revealSub }
 *  - 기록: score · extra { mode, right, wrong, streak } (포인트 없음, 최고 점수 랭킹)
 */
(function () {
  'use strict';
  const T = window.GoStudy, BGM = window.GoBGM, Hub = window.GameHub;
  const W = 720, H = 540;

  function wrap(ctx, s, maxW, size) {
    ctx.font = `700 ${size}px Galmuri11, Pretendard, sans-serif`;
    const out = []; let line = '';
    for (const word of String(s).split(' ')) { const t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; }
    if (line) out.push(line);
    // 한 낱말이 너무 길면 글자 단위로 자름
    return out.flatMap(l => { if (ctx.measureText(l).width <= maxW) return [l]; const r = []; let c = ''; for (const ch of l) { if (ctx.measureText(c + ch).width > maxW && c) { r.push(c); c = ''; } c += ch; } if (c) r.push(c); return r; });
  }

  function make(spec) {
    const CFG = () => window.GoSettings.get(spec.id) || {};
    return {
      render(el, A) {
        const cfg = CFG(), LIMIT = (cfg.timeLimit || 60) * 1000;
        BGM.load(spec.id);
        const page = T.soloPage(el, A, { id: spec.id, title: spec.title, tag: '공부?', sub: spec.sub(LIMIT / 1000), w: W, h: H, cab: 'cab-study', rules: spec.rules(cfg) });
        // 단계 고르기는 게임판 아래 (보기 버튼 자리)에 — 시작 전·끝난 뒤에만 보임. 휴대폰처럼 작은 화면에서도 안내 칸이 넘치지 않게
        page.under.innerHTML = '<div class="qz-modes-wrap" id="qzModes"></div><div class="idm-choices" id="qzCh"></div>';
        const box = page.under.querySelector('#qzCh'), modesBox = page.under.querySelector('#qzModes');
        const ctx = window.GoPixel.setup(page.canvas, W, H), best = T.bestKeeper(spec.id);
        const MKEY = 'gogogogo.' + spec.id + '.mode';
        let mode = (() => { try { const m = localStorage.getItem(MKEY); return spec.modes && spec.modes.some(x => x.id === m) ? m : (spec.modes ? spec.modes[0].id : ''); } catch (e) { return spec.modes ? spec.modes[0].id : ''; } })();
        let st = { phase: 'ready' }, raf = 0, last = 0;
        const fitView = () => T.fitView(page.canvas.closest('.ult-stage'), box);

        function start() {
          if (st.phase === 'play') return;
          st = { phase: 'play', mode, left: LIMIT, score: 0, streak: 0, maxStreak: 0, right: 0, wrong: 0, used: new Set(), q: null, lock: 0, saved: null };
          page.ov.hidden = true; paintModes(); next(); BGM.restart(); fitView();
        }
        function next() { st.q = Object.assign(spec.make(st.mode, st.used), { picked: -1 }); drawChoices(); }
        function drawChoices() {
          const q = st.q;
          if (!q || st.phase !== 'play') { box.innerHTML = ''; return; }
          box.className = 'idm-choices ' + (q.long ? 'idm-long' : 'idm-short');
          box.innerHTML = q.choices.map((c, k) => {
            const cls = q.picked < 0 ? '' : k === q.ans ? 'ok' : k === q.picked ? 'bad' : 'dim';
            return `<button type="button" class="idm-btn ${cls}" data-k="${k}" ${q.picked >= 0 ? 'disabled' : ''}><b>${k + 1}</b><span>${A.esc(c)}</span></button>`;
          }).join('');
          box.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => pick(+b.dataset.k)));
        }
        function pick(k) {
          const q = st.q; if (!q || st.phase !== 'play' || q.picked >= 0 || st.lock > 0 || k >= q.choices.length) return;
          q.picked = k;
          const ok = k === q.ans;
          if (ok) { st.right++; st.streak++; st.maxStreak = Math.max(st.maxStreak, st.streak); const g = (q.worth || cfg.scoreRight || 100) + Math.min(10, st.streak - 1) * (cfg.streakBonus || 20); st.score += g; st.gain = g; st.lock = 700; }
          else { st.wrong++; st.streak = 0; st.gain = 0; st.lock = 1600; }
          st.lastOk = ok; drawChoices();
        }
        const rec = s => ({ score: s.score, duration_sec: Math.round(LIMIT / 1000), extra: { mode: s.mode, right: s.right, wrong: s.wrong, streak: s.maxStreak } });
        function over() {
          st.phase = 'over'; st.q = null; drawChoices();
          st.newBest = best.add(st.score);
          st.saved = { status: Hub.user ? 'saving' : 'guest' }; overlay();
          const s = st;
          if (Hub.user) page.save(rec(s)).then(r => { s.saved = r; if (st === s) overlay(); });
        }
        function paintModes() {
          if (!spec.modes || st.phase === 'play') { modesBox.innerHTML = ''; modesBox.hidden = true; return; }
          modesBox.hidden = false;
          modesBox.innerHTML = `<span class="qz-modes-lbl">단계</span><div class="qz-modes" role="radiogroup" aria-label="단계">${spec.modes.map(m => `<button type="button" role="radio" class="btn ${m.id === mode ? 'btn-sun' : ''}" aria-checked="${m.id === mode}" data-mode="${m.id}"><b>${m.label}</b><small>${m.desc}</small></button>`).join('')}</div>`;
          modesBox.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; try { localStorage.setItem(MKEY, mode); } catch (e) { /* noop */ } paintModes(); }));
        }
        function overlay() {
          const ov = page.ov; if (!ov.isConnected) return;
          ov.hidden = false;
          const label = spec.modes ? (spec.modes.find(m => m.id === (st.mode || mode)) || {}).label : '';
          if (st.phase === 'ready') ov.innerHTML = `<div class="ov-box"><span class="ov-best">공부?</span><div class="ov-title">${spec.title}</div><p class="ov-goal">${spec.goal(LIMIT / 1000)}</p><button class="btn btn-primary" type="button" data-go>시작 ▶</button><p class="ov-note">${Hub.user ? '최고 점수가 오른쪽 랭킹에 올라가요' : '손님 플레이 · 로그인하면 랭킹에 올라가요'}</p></div>`;
          else ov.innerHTML = `<div class="ov-box result"><div class="ov-title">시간 끝!</div><div class="ult-score num">${A.fmt(st.score)}</div>
            <p class="ov-hint">${label ? label + ' · ' : ''}맞힘 ${st.right} · 틀림 ${st.wrong} · 최대 ${st.maxStreak}연속</p>
            <p class="ov-note">${st.newBest ? '<b class="ult-nb">최고 점수 갱신!</b> ' : ''}내 최고 점수 <b class="num">${A.fmt(best.best)}</b></p>
            ${page.noteHTML(st.saved)}
            <div class="ov-btns"><button class="btn btn-sun" type="button" data-go>다시 도전 ▶</button><a class="btn" href="#home">다른 게임</a></div></div>`;
          paintModes();
          const go = ov.querySelector('[data-go]'); if (go) go.addEventListener('click', start);
          const sv = ov.querySelector('[data-st-save]'); if (sv) sv.addEventListener('click', () => A.openAuth('login', () => { if (st.saved && st.saved.status === 'guest') { const s = st; s.saved = { status: 'saving' }; overlay(); page.save(rec(s)).then(r => { best.add(s.score); s.saved = r; if (st === s) overlay(); }); } }));
        }
        function draw() {
          const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, spec.colors.top); bg.addColorStop(1, spec.colors.bottom);
          ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
          if (spec.bg && T.scene(ctx, spec.bg, W, H, 0.12)) T.glass(ctx, 22, 74, W - 44, H - 92, st.phase === 'play' ? 0.74 : 0.35);   // v39 배경 그림 + 유리판
          ctx.fillStyle = 'rgba(15,20,48,.92)'; ctx.fillRect(0, 0, W, 56);
          const sc = st.score || 0;
          T.text(ctx, '점수', 16, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, A.fmt(sc), 16, 38, 22, '#FFD23F', 'left');
          T.text(ctx, '최고', 170, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, A.fmt(Math.max(best.best, st.phase === 'play' ? sc : 0)), 170, 38, 18, sc > best.best && best.best > 0 && st.phase === 'play' ? '#FF3D8B' : '#7DFFC4', 'left');
          T.text(ctx, '연속', 320, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, st.streak || 0, 320, 38, 20, (st.streak || 0) >= 3 ? '#FF9A3D' : '#FFFFFF', 'left');
          if (spec.modes && st.mode) { const m = spec.modes.find(x => x.id === st.mode); if (m) { T.text(ctx, '단계', 420, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, m.label, 420, 38, 16, '#FFFFFF', 'left'); } }
          const sec = Math.max(0, Math.ceil((st.left == null ? LIMIT : st.left) / 1000));
          T.text(ctx, '남은 시간', 580, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, sec + '초', 580, 38, 22, sec <= 10 && st.phase === 'play' ? '#FF5A5F' : '#9AE6FF', 'left');
          ctx.fillStyle = '#0B0F28'; ctx.fillRect(0, 56, W, 6); ctx.fillStyle = '#FFD23F'; ctx.fillRect(0, 56, W * Math.max(0, (st.left == null ? LIMIT : st.left) / LIMIT), 6);
          const q = st.q; if (!q || st.phase !== 'play') { T.text(ctx, spec.watermark, W / 2, 300, 72, spec.bg ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.12)', 'center'); return; }
          ctx.font = '700 17px Galmuri11, Pretendard, sans-serif'; const bw = Math.max(300, ctx.measureText(q.badge).width + 40);
          T.round(ctx, W / 2 - bw / 2, 84, bw, 34, 17, q.badgeColor || '#3B5BDB');
          T.text(ctx, q.badge, W / 2, 102, 17, '#FFFFFF', 'center');
          if (q.big) T.text(ctx, q.prompt, W / 2, 215, q.prompt.length > 12 ? 48 : 64, '#FFFFFF', 'center');
          else { const lines = wrap(ctx, q.prompt, W - 110, 27).slice(0, 5); lines.forEach((l, i) => T.text(ctx, l, W / 2, 225 - (lines.length - 1) * 20 + i * 40, 27, '#FFFFFF', 'center')); }
          if (q.picked >= 0) {
            const ok = st.lastOk;
            T.round(ctx, 40, 360, W - 80, 140, 16, ok ? 'rgba(61,220,132,.16)' : 'rgba(255,90,95,.16)', ok ? '#3DDC84' : '#FF5A5F', 3);
            T.text(ctx, ok ? '정답! +' + st.gain : '아쉬워요! 정답은', W / 2, 390, 24, ok ? '#7DFFC4' : '#FF8A8A', 'center');
            const tl = wrap(ctx, q.revealTitle, W - 140, 24).slice(0, 1);
            T.text(ctx, tl[0] || '', W / 2, 428, 24, '#FFD23F', 'center');
            if (q.revealSub) wrap(ctx, q.revealSub, W - 140, 16).slice(0, 2).forEach((l, i) => T.text(ctx, l, W / 2, 461 + i * 23, 16, '#EEF1FF', 'center', 400));
          }
        }
        function loop(t) {
          raf = requestAnimationFrame(loop);
          const dt = Math.min(80, t - (last || t)); last = t;
          if (st.phase === 'play') {
            st.left -= dt;
            if (st.lock > 0) { st.lock -= dt; if (st.lock <= 0 && st.left > 0) next(); }
            if (st.left <= 0) { st.left = 0; over(); }
          }
          draw();
        }
        const onKey = e => {
          const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
          const k = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
          if (k != null && st.phase === 'play') { e.preventDefault(); pick(k); return; }
          if ((e.code === 'Enter' || e.code === 'Space') && st.phase !== 'play' && tag !== 'button' && tag !== 'a' && !document.querySelector('.modal:not([hidden])')) { e.preventDefault(); start(); }
        };
        document.addEventListener('keydown', onKey);
        overlay(); page.loadRank();
        raf = requestAnimationFrame(loop);
        return function cleanup() { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); BGM.stop(); st = { phase: 'gone' }; };
      }
    };
  }
  // 보기 4개 만들기: 정답 + 다른 것 3개(같은 글자 겹치지 않게) 섞기 → { choices, ans }
  function choices4(answer, pool, rnd) {
    const others = T.shuffle(pool.filter(x => x !== answer)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
    const all = T.shuffle([answer].concat(others));
    return { choices: all, ans: all.indexOf(answer) };
  }
  window.GoQuiz = { make, choices4, wrap };
})();
