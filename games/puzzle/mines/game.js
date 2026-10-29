/*
 * gogo?gogo! — 지뢰찾기 (퍼즐, 혼자 도전 + 걸린 시간 랭킹)
 *  - 가로 10 × 세로 10, 지뢰 20개 (settings.js 의 cols · rows · mines)
 *  - 첫 클릭한 칸과 그 주변 8칸에는 지뢰가 없음 (첫 클릭에 지는 일 없음, 처음에 넓게 열림)
 *  - 열기: 클릭·터치 / 깃발: 오른쪽 클릭·길게 누르기·'깃발 모드' 버튼 / 숫자 칸을 누르면 깃발 수가 맞을 때 주변을 한꺼번에 열기
 *  - 키보드: 방향키(또는 WASD)로 칸 고르기, 스페이스·엔터 열기, F 깃발, R 새 판
 *  - 시간은 첫 칸을 연 순간부터 0.1초 단위. 성공하면 기록 저장 (실패는 저장 안 함)
 *  - 화면 모양은 '공부?' 게임의 혼자 도전 화면(GoStudy.soloPage)을 같이 씀: 왼쪽 게임판, 바로 오른쪽 랭킹
 */
(function () {
  'use strict';
  const T = window.GoStudy, BGM = window.GoBGM, Hub = window.GameHub;
  const CFG = window.GoSettings.get('mines');
  const COLS = CFG.cols || 10, ROWS = CFG.rows || 10, MINES = Math.min(CFG.mines || 20, COLS * ROWS - 9);
  const W = 600, H = 680, TOP = 78, PAD = 20, CELL = Math.floor(Math.min((W - PAD * 2) / COLS, (H - TOP - 46) / ROWS));
  const GX = Math.round((W - CELL * COLS) / 2), GY = TOP + 4;
  const NUMC = ['', '#2F6BFF', '#1E9E5A', '#E8383E', '#283593', '#8E2424', '#0E8A8A', '#222222', '#7A7A7A'];
  const LONG_MS = 380;   // 길게 누르면 깃발

  const fmtT = sec => { const m = Math.floor(sec / 60), s = (sec - m * 60).toFixed(1); return m ? `${m}:${s.padStart(4, '0')}` : s; };

  /* ---------- 그림 조각 ---------- */
  function drawMine(ctx, cx, cy, s) {
    const u = s / 16;
    ctx.fillStyle = '#1A1F3D';
    ctx.fillRect(cx - 5 * u, cy - 5 * u, 10 * u, 10 * u); ctx.fillRect(cx - 7 * u, cy - 3 * u, 14 * u, 6 * u); ctx.fillRect(cx - 3 * u, cy - 7 * u, 6 * u, 14 * u);
    ctx.fillRect(cx - 1 * u, cy - 9 * u, 2 * u, 18 * u); ctx.fillRect(cx - 9 * u, cy - 1 * u, 18 * u, 2 * u);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(cx - 3 * u, cy - 3 * u, 2.5 * u, 2.5 * u);
  }
  function drawFlag(ctx, cx, cy, s) {
    const u = s / 16;
    ctx.fillStyle = '#1A1F3D'; ctx.fillRect(cx - 1 * u, cy - 7 * u, 2 * u, 13 * u); ctx.fillRect(cx - 5 * u, cy + 5 * u, 10 * u, 2.5 * u);
    ctx.fillStyle = '#FF3D4A'; ctx.beginPath(); ctx.moveTo(cx + 1 * u, cy - 8 * u); ctx.lineTo(cx - 8 * u, cy - 4 * u); ctx.lineTo(cx + 1 * u, cy); ctx.closePath(); ctx.fill();
  }

  window.GoMines = {
    render(el, A) {
      BGM.load('mines');
      const page = T.soloPage(el, A, {
        id: 'mines', title: '지뢰찾기', tag: '퍼즐', sub: `가로 ${COLS} × 세로 ${ROWS} · 지뢰 ${MINES}개 · 걸린 시간 기록`, w: W, h: H, cab: 'cab-blue',
        rankLabel: '가장 빠른 시간', fmt: v => CFG.scoreText(v),
        rules: [
          `가로 ${COLS} × 세로 ${ROWS} = <b>${COLS * ROWS}칸</b> 속에 <b>지뢰 ${MINES}개</b>. 지뢰가 아닌 칸을 모두 열면 성공!`,
          '숫자는 그 칸 <b>주변 8칸</b>에 있는 지뢰 수예요.',
          '<b>클릭·터치</b> = 열기 · <b>오른쪽 클릭·길게 누르기</b> = 깃발 (아래 <b>깃발 모드</b> 버튼도 있어요)',
          '숫자 칸을 누르면, 주변 깃발 수가 숫자와 같을 때 나머지 칸을 한꺼번에 열어요.',
          '첫 칸은 언제나 안전해요. 시간은 첫 칸을 연 순간부터 재요.',
          '성공한 시간이 기록으로 남고, <b>가장 빠른 시간</b>이 랭킹에 올라가요. (로그인 필요 · 포인트 없음)',
          '키보드: 방향키로 칸 고르기 · 스페이스 열기 · F 깃발 · R 새 판'
        ]
      });
      page.under.innerHTML = `<div class="mn-bar">
          <button type="button" class="btn mn-flag" data-mn="flag" aria-pressed="false">깃발 모드 <b>꺼짐</b></button>
          <button type="button" class="btn btn-sun" data-mn="new">새 판 (R)</button>
        </div>`;
      const flagBtn = page.under.querySelector('[data-mn="flag"]');
      const canvas = page.canvas, ctx = window.GoPixel.setup(canvas, W, H), best = T.bestKeeper('mines');
      let st = null, raf = 0, flagMode = false, cur = null, press = null;

      /* ---------- 판 만들기 ---------- */
      function fresh() {
        st = { phase: 'ready', cells: [], opened: 0, flags: 0, t0: 0, sec: 0, boom: -1, saved: null, newBest: false, endAt: 0, placed: false };
        for (let i = 0; i < COLS * ROWS; i++) st.cells.push({ mine: false, n: 0, open: false, flag: false });
        overlay();
      }
      const idx = (c, r) => r * COLS + c;
      const around = i => { const c = i % COLS, r = (i / COLS) | 0, out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const cc = c + dc, rr = r + dr; if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS) out.push(idx(cc, rr)); } return out; };
      // 첫 클릭 칸과 주변은 비우고 지뢰 놓기
      function place(first) {
        const safe = new Set([first].concat(around(first)));
        const pool = st.cells.map((c, i) => i).filter(i => !safe.has(i));
        for (let k = 0; k < MINES; k++) { const j = k + Math.floor(Math.random() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; st.cells[pool[k]].mine = true; }
        st.cells.forEach((c, i) => { c.n = around(i).filter(j => st.cells[j].mine).length; });
        st.placed = true; st.phase = 'play'; st.t0 = performance.now(); page.ov.hidden = true; BGM.restart();
      }

      /* ---------- 열기 · 깃발 ---------- */
      function open(i) {
        if (st.phase === 'won' || st.phase === 'lost') return;
        if (!st.placed) place(i);
        const c = st.cells[i]; if (c.flag) return;
        if (c.open) return chord(i);
        if (c.mine) return lose(i);
        // 0 이면 이어서 넓게 열기
        const q = [i];
        while (q.length) {
          const k = q.pop(), cc = st.cells[k]; if (cc.open || cc.flag) continue;
          cc.open = true; st.opened++;
          if (cc.n === 0) around(k).forEach(j => { if (!st.cells[j].open && !st.cells[j].mine) q.push(j); });
        }
        if (st.opened >= COLS * ROWS - MINES) win();
      }
      function chord(i) {   // 숫자 칸: 깃발 수가 맞으면 주변 열기
        const c = st.cells[i]; if (!c.open || !c.n) return;
        const nb = around(i), fl = nb.filter(j => st.cells[j].flag).length;
        if (fl !== c.n) return;
        nb.forEach(j => { if (st.phase === 'play' && !st.cells[j].open && !st.cells[j].flag) open(j); });
      }
      function flag(i) {
        if (!canPlay()) return;
        const c = st.cells[i]; if (c.open) return;
        c.flag = !c.flag; st.flags += c.flag ? 1 : -1;
        if (navigator.vibrate) try { navigator.vibrate(18); } catch (e) { /* noop */ }
      }
      const elapsed = () => (st.phase === 'play' ? (performance.now() - st.t0) / 1000 : st.sec);

      /* ---------- 끝 ---------- */
      function lose(i) {
        st.sec = elapsed(); st.phase = 'lost'; st.boom = i; st.endAt = performance.now();
        st.cells.forEach(c => { if (c.mine && !c.flag) c.open = true; });
        setTimeout(() => { if (st && st.phase === 'lost') overlay(); }, 1300);
      }
      function win() {
        st.sec = Math.round(elapsed() * 10) / 10; st.phase = 'won'; st.endAt = performance.now();
        st.cells.forEach(c => { if (c.mine && !c.flag) { c.flag = true; st.flags++; } });
        const score = CFG.toScore(st.sec);
        st.newBest = best.add(score);
        st.saved = { status: Hub.user ? 'saving' : 'guest' };
        const s = st;
        if (Hub.user) save(s).then(r => { s.saved = r; if (st === s) overlay(); });
        setTimeout(() => { if (st === s) overlay(); }, 900);
      }
      function save(s) {
        const pts = (CFG.points && CFG.points.win) || 0;
        return page.save({ score: CFG.toScore(s.sec), result: 'win', points_delta: pts, duration_sec: Math.max(3, Math.ceil(s.sec)), extra: { sec: s.sec, cols: COLS, rows: ROWS, mines: MINES } });
      }
      function overlay() {
        const ov = page.ov; if (!ov.isConnected) return;
        if (st.phase === 'play') { ov.hidden = true; return; }
        const bestTxt = best.best ? CFG.scoreText(best.best) : '아직 없음';
        if (st.phase === 'ready') {
          ov.hidden = false;
          ov.innerHTML = `<div class="ov-box"><span class="ov-best">퍼즐</span><div class="ov-title">지뢰찾기</div>
            <p class="ov-goal">${COLS * ROWS}칸 속 지뢰 ${MINES}개를 피해<br>모든 칸을 열어요!</p>
            <p class="ov-hint">클릭 = 열기 · 오른쪽 클릭 / 길게 누르기 = 깃발</p>
            <button class="btn btn-primary" type="button" data-go>시작 ▶</button>
            <p class="ov-note">내 최고 기록 <b class="num">${bestTxt}</b> · ${Hub.user ? '가장 빠른 시간이 랭킹에 올라가요' : '손님 플레이 · 로그인하면 랭킹에 올라가요'}</p></div>`;
        } else if (st.phase === 'won') {
          ov.hidden = false;
          ov.innerHTML = `<div class="ov-box result"><div class="ov-title">성공!</div><div class="ult-score num">${CFG.scoreText(CFG.toScore(st.sec))}</div>
            <p class="ov-note">${st.newBest ? '<b class="ult-nb">최고 기록 갱신!</b> ' : ''}내 최고 기록 <b class="num">${bestTxt}</b></p>
            ${page.noteHTML(st.saved)}
            <div class="ov-btns"><button class="btn btn-sun" type="button" data-go>새 판 ▶</button><a class="btn" href="#home">다른 게임</a></div></div>`;
        } else if (st.phase === 'lost') {
          ov.hidden = false;
          ov.innerHTML = `<div class="ov-box result"><div class="ov-title">펑! 지뢰를 밟았어요</div>
            <p class="ov-hint">연 칸 ${st.opened} / ${COLS * ROWS - MINES} · ${fmtT(st.sec)}초</p>
            <p class="ov-note">내 최고 기록 <b class="num">${bestTxt}</b></p>
            <div class="ov-btns"><button class="btn btn-sun" type="button" data-go>다시 도전 ▶</button><button class="btn" type="button" data-look>판 보기</button></div></div>`;
        }
        const go = ov.querySelector('[data-go]');
        if (go) go.addEventListener('click', () => { if (st.phase === 'ready') { ov.hidden = true; st.phase = 'ready-go'; } else { fresh(); ov.hidden = true; st.phase = 'ready-go'; } });
        const look = ov.querySelector('[data-look]'); if (look) look.addEventListener('click', () => { ov.hidden = true; });
        const sv = ov.querySelector('[data-st-save]');
        if (sv) sv.addEventListener('click', () => A.openAuth('login', () => { if (st.phase === 'won' && st.saved && st.saved.status === 'guest') { const s = st; s.saved = { status: 'saving' }; overlay(); save(s).then(r => { best.add(CFG.toScore(s.sec)); s.saved = r; if (st === s) overlay(); }); } }));
      }
      function newGame() { fresh(); page.ov.hidden = true; st.phase = 'ready-go'; }

      /* ---------- 입력 ---------- */
      const canPlay = () => st.phase === 'play' || st.phase === 'ready-go';
      function cellAt(e) {
        const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
        const c = Math.floor((x - GX) / CELL), r = Math.floor((y - GY) / CELL);
        return c >= 0 && r >= 0 && c < COLS && r < ROWS ? idx(c, r) : -1;
      }
      const onDown = e => {
        if (!canPlay()) return;
        const i = cellAt(e); if (i < 0) return;
        e.preventDefault(); cur = null;
        if (e.button === 2) { flag(i); return; }
        if (e.button === 1) { chord(i); return; }
        press = { i, id: e.pointerId, done: false, timer: setTimeout(() => { if (press && !press.done) { press.done = true; flag(press.i); } }, LONG_MS) };
      };
      const onUp = e => {
        if (!press || press.id !== e.pointerId) return;
        clearTimeout(press.timer);
        const p = press; press = null;
        if (p.done || !canPlay()) return;
        if (cellAt(e) !== p.i) return;   // 누른 채로 다른 칸으로 옮기면 취소
        if (flagMode && !st.cells[p.i].open) flag(p.i); else open(p.i);
      };
      const onCancel = () => { if (press) { clearTimeout(press.timer); press = null; } };
      const noMenu = e => e.preventDefault();
      canvas.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onCancel);
      canvas.addEventListener('contextmenu', noMenu);
      canvas.style.touchAction = 'none';
      function setFlagMode(v) { flagMode = v; flagBtn.setAttribute('aria-pressed', String(v)); flagBtn.innerHTML = '깃발 모드 <b>' + (v ? '켜짐' : '꺼짐') + '</b>'; flagBtn.classList.toggle('btn-primary', v); }
      flagBtn.addEventListener('click', () => setFlagMode(!flagMode));
      page.under.querySelector('[data-mn="new"]').addEventListener('click', newGame);
      const onKey = e => {
        const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || document.querySelector('.modal:not([hidden])')) return;
        if (e.code === 'KeyR') { e.preventDefault(); newGame(); return; }
        if (st.phase === 'ready' && (e.code === 'Enter' || e.code === 'Space') && tag !== 'button' && tag !== 'a') { e.preventDefault(); page.ov.hidden = true; st.phase = 'ready-go'; cur = cur || { c: (COLS / 2) | 0, r: (ROWS / 2) | 0 }; return; }
        if (!canPlay()) return;
        const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[e.code];
        if (mv) { e.preventDefault(); cur = cur || { c: (COLS / 2) | 0, r: (ROWS / 2) | 0 }; cur.c = Math.max(0, Math.min(COLS - 1, cur.c + mv[0])); cur.r = Math.max(0, Math.min(ROWS - 1, cur.r + mv[1])); return; }
        if (!cur) return;
        if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); open(idx(cur.c, cur.r)); }
        else if (e.code === 'KeyF') { e.preventDefault(); flag(idx(cur.c, cur.r)); }
      };
      document.addEventListener('keydown', onKey);

      /* ---------- 그리기 ---------- */
      function draw() {
        const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1C2457'); bg.addColorStop(1, '#10143A');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        // 위쪽 상태 줄
        ctx.fillStyle = 'rgba(8,12,36,.9)'; ctx.fillRect(0, 0, W, 66);
        const left = MINES - st.flags, sec = elapsed();
        T.text(ctx, '남은 지뢰', 20, 18, 12, '#8A93C0', 'left', 400); T.text(ctx, String(left), 20, 44, 26, left < 0 ? '#FF5A5F' : '#FF8A8A', 'left');
        T.text(ctx, '시간', 170, 18, 12, '#8A93C0', 'left', 400); T.text(ctx, fmtT(sec) + '초', 170, 44, 26, st.phase === 'won' ? '#7DFFC4' : '#9AE6FF', 'left');
        T.text(ctx, '내 최고', 360, 18, 12, '#8A93C0', 'left', 400); T.text(ctx, best.best ? CFG.scoreText(best.best) : '-', 360, 44, 20, '#FFD23F', 'left');
        // 칸
        const t = performance.now();
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const i = idx(c, r), cell = st.cells[i], x = GX + c * CELL, y = GY + r * CELL, s = CELL;
          const pr = press && press.i === i && !press.done && !cell.open;
          if (cell.open) {
            ctx.fillStyle = i === st.boom ? '#FF5A5F' : '#E9EDFB'; ctx.fillRect(x, y, s, s);
            ctx.fillStyle = 'rgba(26,31,61,.18)'; ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y, 1, s);
            if (cell.mine) drawMine(ctx, x + s / 2, y + s / 2, s * 0.62);
            else if (cell.n) T.text(ctx, String(cell.n), x + s / 2, y + s / 2 + 2, Math.round(s * 0.56), NUMC[cell.n], 'center');
          } else {
            ctx.fillStyle = pr ? '#9FB0E8' : '#7C91E0'; ctx.fillRect(x, y, s, s);
            if (!pr) { ctx.fillStyle = '#B4C3FF'; ctx.fillRect(x, y, s, 4); ctx.fillRect(x, y, 4, s); ctx.fillStyle = '#4A5BB0'; ctx.fillRect(x, y + s - 4, s, 4); ctx.fillRect(x + s - 4, y, 4, s); }
            if (cell.flag) {
              drawFlag(ctx, x + s / 2, y + s / 2, s * 0.62);
              if (st.phase === 'lost' && !cell.mine) { ctx.strokeStyle = '#E8383E'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + s - 8, y + s - 8); ctx.moveTo(x + s - 8, y + 8); ctx.lineTo(x + 8, y + s - 8); ctx.stroke(); }   // 틀린 깃발
            }
          }
        }
        ctx.strokeStyle = '#0A0E24'; ctx.lineWidth = 3; ctx.strokeRect(GX - 1.5, GY - 1.5, CELL * COLS + 3, CELL * ROWS + 3);
        if (cur && canPlay()) { ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 4; ctx.strokeRect(GX + cur.c * CELL + 2, GY + cur.r * CELL + 2, CELL - 4, CELL - 4); }
        // 아래 안내
        const by = GY + CELL * ROWS + 24;
        let hint = flagMode ? '깃발 모드: 누르는 칸에 깃발을 꽂아요' : '클릭 = 열기 · 오른쪽 클릭 / 길게 누르기 = 깃발';
        if (st.phase === 'won') hint = '성공! ' + fmtT(st.sec) + '초';
        else if (st.phase === 'lost') hint = '지뢰를 밟았어요 · R 또는 [새 판]';
        else if (st.phase === 'ready-go') hint = '아무 칸이나 눌러 시작! (첫 칸은 안전)';
        T.text(ctx, hint, W / 2, by, 16, st.phase === 'won' ? '#7DFFC4' : st.phase === 'lost' ? '#FF8A8A' : flagMode ? '#FF9AA2' : '#C9D2F5', 'center', 400);
        if (st.phase === 'won' && t - st.endAt < 900) { ctx.fillStyle = `rgba(125,255,196,${0.25 * (1 - (t - st.endAt) / 900)})`; ctx.fillRect(0, 0, W, H); }
      }
      function loop() { raf = requestAnimationFrame(loop); draw(); }

      fresh(); page.loadRank();
      raf = requestAnimationFrame(loop);
      return function cleanup() {
        cancelAnimationFrame(raf); onCancel(); BGM.stop();
        document.removeEventListener('keydown', onKey); window.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointercancel', onCancel); canvas.removeEventListener('contextmenu', noMenu);
        st = { phase: 'gone', cells: [] };
      };
    }
  };

  // 게임 목록 그림
  window.GoGames.mines = {
    id: 'mines',
    thumb(ctx, w, h) {
      ctx.save(); ctx.scale(w / W, h / H);
      ctx.fillStyle = '#1C2457'; ctx.fillRect(0, 0, W, H);
      const demo = ['1100000111', 'F210001F21', '22F1001221', '1111000000', '000012210F', '01110F2F10', '01F1012110', '0111000000', '0000111110', '00001F11F1'];
      for (let r = 0; r < ROWS && r < 10; r++) for (let c = 0; c < COLS && c < 10; c++) {
        const ch = demo[r][c], x = GX + c * CELL, y = GY + r * CELL, s = CELL, closed = ch === 'F' || (r > 6 && c > 6);
        if (closed) { ctx.fillStyle = '#7C91E0'; ctx.fillRect(x, y, s, s); ctx.fillStyle = '#B4C3FF'; ctx.fillRect(x, y, s, 4); ctx.fillRect(x, y, 4, s); ctx.fillStyle = '#4A5BB0'; ctx.fillRect(x, y + s - 4, s, 4); ctx.fillRect(x + s - 4, y, 4, s); if (ch === 'F') drawFlag(ctx, x + s / 2, y + s / 2, s * 0.62); }
        else { ctx.fillStyle = '#E9EDFB'; ctx.fillRect(x, y, s, s); ctx.fillStyle = 'rgba(26,31,61,.18)'; ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y, 1, s); if (ch !== '0') T.text(ctx, ch, x + s / 2, y + s / 2 + 2, 30, NUMC[+ch], 'center'); }
      }
      drawMine(ctx, GX + 8.5 * CELL, GY + 8.5 * CELL, CELL * 0.62);
      T.text(ctx, '지뢰찾기', W / 2, 38, 34, '#FFD23F', 'center');
      ctx.restore();
    }
  };
})();
