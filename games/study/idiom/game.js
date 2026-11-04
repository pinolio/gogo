/*
 * gogo?gogo! — 사자성어 맞추기 (공부?, 혼자 도전 + 랭킹)
 *  - 60초 동안 4지선다. 문제 종류 두 가지가 섞여 나옴
 *    ① 뜻 → 사자성어 고르기   ② 사자성어 → 뜻 고르기
 *  - 맞히면 100점 + 연속 보너스(20점씩, 최대 +200). 틀리면 연속이 끊기고 정답을 1.5초 보여 줌
 *  - 고르기: 아래 보기 버튼을 누르거나 키보드 1 · 2 · 3 · 4
 */
(function () {
  'use strict';
  const T = window.GoStudy, BGM = window.GoBGM, Hub = window.GameHub;
  const W = 720, H = 540;
  const CFG = window.GoSettings.get('idiom');
  const DATA = () => window.GoIdioms || [];
  const LIMIT = (CFG.timeLimit || 60) * 1000;

  // 긴 글을 폭에 맞게 여러 줄로
  function wrap(ctx, s, maxW, size) {
    ctx.font = `700 ${size}px Galmuri11, Pretendard, sans-serif`;
    const out = []; let line = '';
    for (const word of s.split(' ')) { const t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; }
    if (line) out.push(line); return out;
  }

  /* v70 뜻이 비슷한 성어 묶음: 같은 묶음은 한 문제의 보기에 함께 나오지 않음 (정답이 둘처럼 보이지 않게) */
  const GROUPS = [
    '죽마고우 막역지우 수어지교 금란지교 금석지교 지란지교 문경지교', '풍전등화 누란지위 백척간두 위기일발 명재경각 일촉즉발 여리박빙', '박장대소 파안대소 포복절도',
    '천차만별 천양지차 각양각색 형형색색', '자업자득 자승자박 인과응보', '시종일관 초지일관', '망양보뢰 만시지탄 후회막급', '부지기수 비일비재 인산인해 문전성시',
    '사면초가 진퇴양난 고립무원 사고무친 혈혈단신', '표리부동 양두구육 면종복배 구밀복검 교언영색', '무위도식 허송세월', '주객전도 본말전도', '우공이산 마부작침 칠전팔기 수불석권',
    '각주구검 수주대토', '반포지효 혼정신성', '조삼모사 조령모개 조변석개 일구이언', '이란투석 당랑거철', '안하무인 유아독존 기고만장', '일석이조 일거양득', '동고동락 상부상조',
    '대동소이 오십보백보', '남가일몽 일장춘몽', '청출어람 후생가외', '감지덕지 각골난망 백골난망 결초보은', '희희낙락 환호작약', '오리무중 암중모색', '백전백승 연전연승'
  ].map(g => g.split(' '));
  const GROUP_OF = {}; GROUPS.forEach((g, n) => g.forEach(w => { GROUP_OF[w] = n; }));
  const sameGroup = (a, b) => GROUP_OF[a] != null && GROUP_OF[a] === GROUP_OF[b];
  const SEEN = T.recent('idiom', 220);   // 이 기기에서 최근 220문제는 뒤로 미룸

  window.GoIdiom = {
    render(el, A) {
      BGM.load('idiom');
      const page = T.soloPage(el, A, {
        id: 'idiom', title: '사자성어 맞추기', tag: '공부?', sub: `${LIMIT / 1000}초 · 4지선다 · 연속 보너스`, w: W, h: H, cab: 'cab-study',
        rules: [`<b>${LIMIT / 1000}초</b> 동안 최대한 많이 맞혀요.`, '문제 모양 4가지가 섞여 나와요: ① 뜻 → <b>사자성어</b> ② 사자성어 → <b>뜻</b> ③ <b>한자</b> → 한글 읽기 ④ <b>빈칸</b>에 들어갈 글자', '아래 보기를 누르거나 키보드 <b>1 · 2 · 3 · 4</b>.', `맞히면 ${CFG.scoreRight}점 + 연속 보너스(${CFG.streakBonus}점씩). 틀리면 정답과 한자를 보여 줘요.`, '포인트는 없고, 가장 높은 점수가 랭킹에 올라가요. (로그인 필요)']
      });
      page.under.innerHTML = '<div class="idm-choices" id="idmCh"></div>';
      const box = page.under.querySelector('#idmCh');
      const ctx = window.GoPixel.setup(page.canvas, W, H), best = T.bestKeeper('idiom');
      let st = { phase: 'ready' }, raf = 0, last = 0;

      function start() {
        if (st.phase === 'play') return;
        st = { phase: 'play', left: LIMIT, score: 0, streak: 0, maxStreak: 0, right: 0, wrong: 0, deck: T.shuffle(DATA().map((d, i) => i)), q: null, lock: 0, saved: null };
        page.ov.hidden = true; next(); BGM.restart(); fitView();
      }
      // v34 (플레이어 입장 점검): 낮은 화면에서 보기 버튼이 게임판 아래로 숨지 않게 (GoStudy.fitView)
      const fitView = () => T.fitView(page.canvas.closest('.ult-stage'), box);
      function next() {
        const D = DATA();
        if (!st.deck.length) st.deck = T.shuffle(D.map((d, i) => i));
        // v70 최근(이 기기)에 나온 성어는 뒤로 미룸 + 문제 모양 4가지 (뜻→성어 · 성어→뜻 · 한자→성어 · 빈칸 글자)
        let ans = st.deck.pop(); for (let k = 0; k < 40 && SEEN.has(D[ans][0]) && st.deck.length; k++) { st.deck.unshift(ans); ans = st.deck.pop(); }
        SEEN.add(D[ans][0]);
        const r = Math.random(), type = r < 0.32 ? 'meaning' : r < 0.62 ? 'idiom' : r < 0.82 ? 'hanja' : 'blank';
        const okOther = i => i !== ans && !sameGroup(D[i][0], D[ans][0]);
        let opts, ansK;
        if (type === 'blank') {   // 한 글자를 가리고 알맞은 글자 고르기 (보기: 다른 성어의 같은 자리 글자)
          const pos = Math.floor(Math.random() * 4), ch = D[ans][0][pos], nm = D[ans][0], names = new Set(D.map(d => d[0])), pool = T.shuffle(Array.from(new Set(D.map(d => d[0][pos]).filter(c => c !== ch && !names.has(nm.slice(0, pos) + c + nm.slice(pos + 1)))))).slice(0, 3);   // 다른 성어가 되는 글자는 보기에서 뺌
          opts = T.shuffle([ch].concat(pool)); ansK = opts.indexOf(ch); st.q = { ans, type, opts, ansK, pos, picked: -1 };
        } else {
          const others = T.shuffle(D.map((d, i) => i).filter(okOther)).slice(0, 3), ids = T.shuffle([ans].concat(others));
          opts = ids.map(i => (type === 'idiom' ? D[i][2] : D[i][0])); ansK = ids.indexOf(ans); st.q = { ans, type, opts, ansK, picked: -1 };
        }
        drawChoices();
      }
      function drawChoices() {
        const D = DATA(), q = st.q;
        if (!q || st.phase !== 'play') { box.innerHTML = ''; return; }
        box.className = 'idm-choices ' + (q.type === 'idiom' ? 'idm-long' : 'idm-short');
        box.innerHTML = q.opts.map((i, k) => {
          const cls = q.picked < 0 ? '' : k === q.ansK ? 'ok' : k === q.picked ? 'bad' : 'dim';
          return `<button type="button" class="idm-btn ${cls}" data-k="${k}" ${q.picked >= 0 ? 'disabled' : ''}><b>${k + 1}</b><span>${i}</span></button>`;
        }).join('');
        box.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => pick(+b.dataset.k)));
      }
      function pick(k) {
        const q = st.q; if (!q || st.phase !== 'play' || q.picked >= 0 || st.lock > 0) return;
        q.picked = k;
        const ok = k === q.ansK;
        if (ok) { st.right++; st.streak++; st.maxStreak = Math.max(st.maxStreak, st.streak); const g = CFG.scoreRight + Math.min(10, st.streak - 1) * CFG.streakBonus; st.score += g; st.gain = g; st.lock = 700; }
        else { st.wrong++; st.streak = 0; st.gain = 0; st.lock = 1500; }
        st.lastOk = ok; drawChoices();
      }
      function over() {
        st.phase = 'over'; st.q = null; drawChoices();
        st.newBest = best.add(st.score);
        st.saved = { status: Hub.user ? 'saving' : 'guest' }; overlay();
        const s = st;
        if (Hub.user) page.save({ score: s.score, duration_sec: Math.round(LIMIT / 1000), extra: { right: s.right, wrong: s.wrong, streak: s.maxStreak } }).then(r => { s.saved = r; if (st === s) overlay(); });
      }
      function overlay() {
        const ov = page.ov; if (!ov.isConnected) return;
        ov.hidden = false;
        if (st.phase === 'ready') ov.innerHTML = `<div class="ov-box"><span class="ov-best">공부?</span><div class="ov-title">사자성어 맞추기</div><p class="ov-goal">${LIMIT / 1000}초 동안 뜻 ↔ 사자성어를 맞혀요.<br>연속으로 맞히면 보너스!</p><button class="btn btn-primary" type="button" data-go>시작 ▶</button><p class="ov-note">${Hub.user ? '최고 점수가 오른쪽 랭킹에 올라가요' : '손님 플레이 · 로그인하면 랭킹에 올라가요'}</p></div>`;
        else ov.innerHTML = `<div class="ov-box result"><div class="ov-title">시간 끝!</div><div class="ult-score num">${A.fmt(st.score)}</div>
          <p class="ov-hint">맞힘 ${st.right} · 틀림 ${st.wrong} · 최대 ${st.maxStreak}연속</p>
          <p class="ov-note">${st.newBest ? '<b class="ult-nb">최고 점수 갱신!</b> ' : ''}내 최고 점수 <b class="num">${A.fmt(best.best)}</b></p>
          ${page.noteHTML(st.saved)}
          <div class="ov-btns"><button class="btn btn-sun" type="button" data-go>다시 도전 ▶</button><a class="btn" href="#home">다른 게임</a></div></div>`;
        const go = ov.querySelector('[data-go]'); if (go) go.addEventListener('click', start);
        const sv = ov.querySelector('[data-st-save]'); if (sv) sv.addEventListener('click', () => A.openAuth('login', () => { if (st.saved && st.saved.status === 'guest') { st.saved = { status: 'saving' }; overlay(); page.save({ score: st.score, duration_sec: Math.round(LIMIT / 1000), extra: { right: st.right, wrong: st.wrong, streak: st.maxStreak } }).then(r => { best.add(st.score); st.saved = r; overlay(); }); } }));
      }
      function draw() {
        const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2A1E4F'); bg.addColorStop(1, '#16193A');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        if (T.scene(ctx, 'games/study/idiom/img/bg.jpg', W, H, 0.12)) T.glass(ctx, 22, 74, W - 44, H - 92, st.phase === 'play' ? 0.74 : 0.35);   // v39 선비 서재 배경
        ctx.fillStyle = 'rgba(15,20,48,.92)'; ctx.fillRect(0, 0, W, 56);
        const sc = st.score || 0;
        T.text(ctx, '점수', 16, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, A.fmt(sc), 16, 38, 22, '#FFD23F', 'left');
        T.text(ctx, '최고', 170, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, A.fmt(Math.max(best.best, st.phase === 'play' ? sc : 0)), 170, 38, 18, sc > best.best && best.best > 0 && st.phase === 'play' ? '#FF3D8B' : '#7DFFC4', 'left');
        T.text(ctx, '연속', 320, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, st.streak || 0, 320, 38, 20, (st.streak || 0) >= 3 ? '#FF9A3D' : '#FFFFFF', 'left');
        const sec = Math.max(0, Math.ceil((st.left == null ? LIMIT : st.left) / 1000));
        T.text(ctx, '남은 시간', 560, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, sec + '초', 560, 38, 22, sec <= 10 && st.phase === 'play' ? '#FF5A5F' : '#9AE6FF', 'left');
        ctx.fillStyle = '#0B0F28'; ctx.fillRect(0, 56, W, 6); ctx.fillStyle = '#FFD23F'; ctx.fillRect(0, 56, W * Math.max(0, (st.left == null ? LIMIT : st.left) / LIMIT), 6);
        const q = st.q, D = DATA(); if (!q || st.phase !== 'play') { T.text(ctx, '四字成語', W / 2, 300, 72, 'rgba(255,255,255,.4)', 'center'); return; }
        const a = D[q.ans];
        const BADGE = { meaning: ['이 뜻의 사자성어는?', '#3B5BDB'], idiom: ['이 사자성어의 뜻은?', '#9C36B5'], hanja: ['이 한자 성어를 한글로 읽으면?', '#C2255C'], blank: ['빈칸에 들어갈 글자는?', '#2B8A3E'] }[q.type];
        T.round(ctx, W / 2 - 170, 84, 340, 34, 17, BADGE[1]);
        T.text(ctx, BADGE[0], W / 2, 102, 17, '#FFFFFF', 'center');
        if (q.type === 'hanja') {
          T.text(ctx, a[1], W / 2, 220, 84, '#FFFFFF', 'center');
          if (q.picked >= 0) T.text(ctx, a[0], W / 2, 300, 34, '#FFD23F', 'center', 400);
        } else if (q.type === 'blank') {
          const shown = a[0].split('').map((c, i) => (i === q.pos && q.picked < 0 ? '□' : c)).join(' ');
          T.text(ctx, shown, W / 2, 200, 76, '#FFFFFF', 'center');
          const ml = wrap(ctx, '뜻: ' + a[2], W - 140, 22).slice(0, 2);
          if (q.picked < 0) ml.forEach((l, i) => T.text(ctx, l, W / 2, 280 + i * 30, 22, '#BDE8FF', 'center', 400));
        } else if (q.type === 'meaning') {
          const lines = wrap(ctx, a[2], W - 120, 30);
          lines.forEach((l, i) => T.text(ctx, l, W / 2, 240 - (lines.length - 1) * 22 + i * 44, 30, '#FFFFFF', 'center'));
        } else {
          T.text(ctx, a[0], W / 2, 220, 84, '#FFFFFF', 'center');
          if (q.picked >= 0) T.text(ctx, a[1], W / 2, 300, 34, '#FFD23F', 'center', 400);
        }
        // 고른 뒤: 맞음/틀림 + 정답 풀이
        if (q.picked >= 0) {
          const ok = st.lastOk;
          T.round(ctx, 40, 360, W - 80, 140, 16, ok ? 'rgba(61,220,132,.16)' : 'rgba(255,90,95,.16)', ok ? '#3DDC84' : '#FF5A5F', 3);
          T.text(ctx, ok ? '정답! +' + st.gain : '아쉬워요! 정답은', W / 2, 390, 24, ok ? '#7DFFC4' : '#FF8A8A', 'center');
          T.text(ctx, a[0] + ' (' + a[1] + ')', W / 2, 428, 26, '#FFD23F', 'center');
          const ml = wrap(ctx, a[2], W - 140, 17).slice(0, 2);
          ml.forEach((l, i) => T.text(ctx, l, W / 2, 462 + i * 24, 17, '#EEF1FF', 'center', 400));
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

  window.GoGames.idiom = {
    id: 'idiom',
    thumb(ctx, w, h) {
      { const im = T.pic('games/study/idiom/img/bg.jpg'); if (!(im.complete && im.naturalWidth)) im.addEventListener('load', () => { try { this.thumb(ctx, w, h); } catch (e) { /* noop */ } }, { once: true }); }   // v39 배경 그림이 오면 다시 그림
      ctx.save(); ctx.scale(w / W, h / H);
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2A1E4F'); bg.addColorStop(1, '#16193A'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); T.scene(ctx, 'games/study/idiom/img/bg.jpg', W, H, 0.35);
      T.text(ctx, '苦盡甘來', W / 2, 150, 92, '#FFD23F', 'center', 400);
      T.text(ctx, '고진감래', W / 2, 260, 64, '#FFFFFF', 'center');
      ['① 일석이조', '② 고진감래', '③ 동문서답', '④ 작심삼일'].forEach((s, i) => { const x = 40 + (i % 2) * 330, y = 330 + Math.floor(i / 2) * 90; T.round(ctx, x, y, 310, 72, 14, i === 1 ? '#3DDC84' : '#26306A', '#0A0E24', 4); T.text(ctx, s, x + 155, y + 37, 34, i === 1 ? '#0F1430' : '#EEF1FF', 'center'); });
      ctx.restore();
    }
  };
})();
