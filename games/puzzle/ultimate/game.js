/*
 * gogo?gogo! — Ultimate mode (이벤트)
 *  - 퍼즐512 규칙(4×4, 같은 숫자 밀어서 합치기)으로 2분 동안 혼자 도전
 *  - 점수 = 끝났을 때 판 위 숫자를 모두 더한 값 (합쳐도 합은 그대로, 새 숫자가 나올 때마다 늘어남 → 막히지 않고 많이 움직일수록 높음)
 *  - 더 움직일 수 없으면 그 자리에서 끝 (퍼즐512 처럼 다시 시작하지 않음), 다시 시작(Ctrl) 없음
 *  - 랭킹은 게임 오른쪽(휴대폰은 아래)에 바로 보이고, 홈 화면 이벤트 칸에도 나옴
 *  - 규칙·그림은 퍼즐512(games/puzzle/p512/game.js)의 GoP512.kit 을 그대로 씀
 */
(function () {
  'use strict';
  const Hub = window.GameHub, P = window.GoPixel, AV = window.GoAvatar, BGM = window.GoBGM;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const CFG = window.GoSettings.get('ultimate');
  const GAME = 'ultimate', LIMIT = (CFG.timeLimit || 120) * 1000;
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down' };
  const sum = b => b.reduce((s, v) => s + v, 0);
  // 내 최고 점수: 로그인하면 서버 기록, 손님은 이 기기에 저장 → '다시 도전'·새로고침해도 사라지지 않음
  const LS_BEST = 'gogogogo.ultimate.best';
  const localBest = () => { try { return +localStorage.getItem(LS_BEST) || 0; } catch (e) { return 0; } };
  const saveLocalBest = v => { try { if (v > localBest()) localStorage.setItem(LS_BEST, String(v)); } catch (e) { /* noop */ } };

  let A = null, root = null, st = null, raf = 0;

  function render(el, app) {
    A = app; root = el;
    const K = window.GoP512.kit, W = K.W, H = K.H;
    BGM.load(GAME);
    el.innerHTML = `
      <div class="ult">
        <div class="play-head"><a class="back" href="#home">← 게임 목록</a><span class="cat ult-tag">EVENT</span><h1>Ultimate mode</h1><span class="small" style="margin:0">퍼즐512 · ${LIMIT / 60000}분 · 판 위 숫자 합 = 점수</span></div>
        <div class="ult-grid">
          <div class="ult-stage">
            <div class="cabinet cab-ult" style="--cw:${W}px;--ar:${W / H}"><div class="screen"><canvas id="ultCanvas" aria-label="Ultimate mode 게임 화면"></canvas><div class="overlay" id="ultOv"></div></div></div>
            <div class="pad cross" id="pad"><span class="sp"></span><button type="button" data-act="up" aria-label="위">▲</button><span class="sp"></span><button type="button" data-act="left" aria-label="왼쪽">◀</button><button type="button" data-act="down" aria-label="아래">▼</button><button type="button" data-act="right" aria-label="오른쪽">▶</button></div>
          </div>
          <aside class="ult-side">
            <div class="panel ult-rank-panel">
              <h3>Ultimate 랭킹 <small>최고 점수</small></h3>
              <ol class="rank" id="ultRank"><li class="empty">불러오는 중…</li></ol>
              <p class="small ult-mine" id="ultMine"></p>
            </div>
            <div class="panel">
              <h3>규칙</h3>
              <ul class="ult-rules">
                <li>방향키 · WASD (휴대폰은 밀기 또는 아래 버튼)로 숫자를 밀어요.</li>
                <li>같은 숫자가 만나면 합쳐지고, 밀 때마다 새 숫자(2 또는 4)가 생겨요.</li>
                <li><b>${LIMIT / 60000}분</b>이 끝났을 때 <b>판 위 숫자를 모두 더한 값</b>이 점수예요.</li>
                <li>더 움직일 수 없으면 그 자리에서 끝나요. 판이 꽉 차지 않게 합치면서 빨리 밀어 보세요!</li>
                <li>포인트는 없고, 가장 높은 기록이 랭킹에 올라가요. (로그인 필요)</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>`;
    const canvas = $('#ultCanvas', el), ctx = P.setup(canvas, W, H);
    st = { K, W, H, ctx, canvas, phase: 'ready', eng: null, left: LIMIT, last: 0, clock: null, cd: 0, saved: null, endWhy: '', best: Hub.user ? 0 : localBest() };
    if (Hub.user) Hub.myBest(GAME).then(v => { if (st) st.best = Math.max(st.best, v || 0); }).catch(() => {});
    $$('#pad [data-act]', el).forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); act(b.dataset.act); }));
    P.swipe(canvas, d => { if (d !== 'tap') act(d); });
    document.addEventListener('keydown', onKey);
    newBoard(); overlay(); loadRank();
    const loop = t => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(100, t - (st.last || t)); st.last = t;
      if (st.phase === 'play') { st.left -= dt; if (st.left <= 0) end('time'); }
      draw(dt);
    };
    raf = requestAnimationFrame(loop);
    return function cleanup() { cancelAnimationFrame(raf); clearTimeout(st && st.cd); document.removeEventListener('keydown', onKey); BGM.stop(); root = null; st = null; };
  }

  function newBoard() {
    st.eng = st.K.Engine({ goal: Infinity, endOnStuck: true, onStuck: () => setTimeout(() => end('stuck'), 0) });
    st.left = LIMIT; st.saved = null; st.endWhy = '';
  }
  function start() {
    if (!st || st.phase === 'count' || st.phase === 'play') return;
    newBoard(); st.phase = 'count';
    const ov = $('#ultOv'); let n = 3;
    const step = () => {
      if (!st || !ov.isConnected) return;
      if (n > 0) { ov.hidden = false; ov.innerHTML = `<div class="ov-box"><div class="count num">${n}</div><p class="ov-hint">${LIMIT / 60000}분 동안 판 위 숫자 합을 키워요!</p></div>`; n--; st.cd = setTimeout(step, 1000); }
      else { ov.hidden = true; st.phase = 'play'; st.clock = performance.now(); BGM.restart(); }
    };
    step();
  }
  function act(a) {
    if (!st || st.phase !== 'play') return;
    st.eng.move(a);
  }
  function end(why) {
    if (!st || st.phase !== 'play') return;
    st.phase = 'over'; st.endWhy = why; st.left = Math.max(0, st.left);
    st.score = sum(st.eng.b); st.sec = Math.max(3, Math.round((performance.now() - st.clock) / 1000));
    st.newBest = st.score > st.best; st.best = Math.max(st.best, st.score);   // 최고 점수는 다시 도전해도 그대로
    if (!Hub.user) saveLocalBest(st.score);
    save();
  }
  async function save() {
    const s = st; if (!s) return;
    if (!Hub.user) { s.saved = { status: 'guest' }; overlay(); return; }
    s.saved = { status: 'saving' }; overlay();
    try {
      const r = await Hub.submitScore({ game_id: GAME, score: s.score, result: null, points_delta: 0, duration_sec: s.sec, extra: { moves: s.eng.moves, max: s.eng.best || s.eng.max, stuck: s.endWhy === 'stuck' } });
      s.saved = { status: r.queued ? 'queued' : 'saved', best: r.best, newBest: r.newBest }; s.best = Math.max(s.best, r.best || 0);
    } catch (e) { s.saved = { status: 'error', msg: e.message }; }
    if (st === s) { overlay(); loadRank(); }
  }

  /* ---------- 화면 ---------- */
  function overlay() {
    const ov = root && $('#ultOv', root); if (!ov || !st) return;
    if (st.phase === 'play' || st.phase === 'count') return;
    ov.hidden = false;
    if (st.phase === 'ready') {
      ov.innerHTML = `<div class="ov-box"><span class="ov-best">EVENT</span><div class="ov-title">Ultimate mode</div>
        <p class="ov-goal">${LIMIT / 60000}분 동안 숫자를 밀어요.<br>끝났을 때 <b>판 위 숫자의 합</b>이 점수!</p>
        <button class="btn btn-primary" type="button" id="ultStart">도전 시작 ▶</button>
        <p class="ov-note">${Hub.user ? '최고 기록이 오른쪽 랭킹에 올라가요' : '손님 플레이 · 로그인하면 랭킹에 올라가요'}</p></div>`;
    } else {
      const s = st.saved || {};
      let note = '';
      if (s.status === 'saving') note = '<p class="ov-note">기록 저장 중…</p>';
      else if (s.status === 'saved') note = '<p class="ov-note ok">랭킹에 저장했어요</p>';
      else if (s.status === 'queued') note = '<p class="ov-note">지금은 오프라인이에요. 연결되면 자동으로 저장돼요.</p>';
      else if (s.status === 'error') note = `<p class="ov-note bad">${A.esc(s.msg)}</p>`;
      else if (s.status === 'guest') note = '<p class="ov-note">로그인하면 이 기록이 랭킹에 올라가요.</p><button class="btn btn-primary" type="button" id="ultSave">로그인하고 기록 저장</button>';
      ov.innerHTML = `<div class="ov-box result">
        <div class="ov-title">${st.endWhy === 'stuck' ? '더 움직일 수 없어요!' : '시간 종료!'}</div>
        <div class="ult-score num">${A.fmt(st.score)}</div>
        <p class="ov-hint">판 위 숫자 합 · 가장 큰 숫자 ${st.eng.max} · ${st.eng.moves}번 밀기 · ${A.dur(st.sec)}</p>
        <p class="ov-note">${st.newBest ? '<b class="ult-nb">최고 점수 갱신!</b> ' : ''}내 최고 점수 <b class="num">${A.fmt(st.best)}</b></p>
        ${note}
        <div class="ov-btns"><button class="btn btn-sun" type="button" id="ultStart">다시 도전 ▶</button><a class="btn" href="#home">다른 게임</a></div></div>`;
    }
    const b = $('#ultStart', ov); if (b) b.addEventListener('click', start);
    const sv = $('#ultSave', ov); if (sv) sv.addEventListener('click', () => A.openAuth('login', () => { if (st && st.saved && st.saved.status === 'guest') save(); }));
  }
  function draw(dt) {
    const { ctx, W, K } = st, e = st.eng, TOP = K.TOP;
    ctx.fillStyle = P.PANEL; ctx.fillRect(0, 0, W, TOP);
    const total = sum(e.b);
    const best = Math.max(st.best, st.phase === 'play' ? total : 0), beat = st.phase === 'play' && total > st.best && st.best > 0;
    P.text(ctx, 'SCORE', 14, 10, 9, P.DIM); P.text(ctx, total, 14, 26, 17, '#FFD23F');
    P.text(ctx, 'BEST', 104, 10, 9, beat ? '#FF3D8B' : P.DIM); P.text(ctx, best, 104, 26, 13, beat ? '#FF3D8B' : '#7DFFC4');   // 내 최고 점수 (다시 도전해도 유지)
    P.text(ctx, 'MAX', 186, 10, 9, P.DIM); P.text(ctx, e.max, 186, 26, 13, K.tileColor(e.max)[0]);
    P.text(ctx, 'MOVES', 248, 10, 9, P.DIM); P.text(ctx, e.moves, 248, 27, 11, P.INK);
    const sec = Math.max(0, Math.ceil(st.left / 1000)), low = sec <= 15 && st.phase === 'play' && Math.floor(performance.now() / 300) % 2;
    P.text(ctx, 'TIME', 316, 10, 9, P.DIM); P.text(ctx, Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'), 316, 24, 17, low ? '#FF5A5F' : '#7FE3FF');
    // 남은 시간 막대
    ctx.fillStyle = '#0B0F28'; ctx.fillRect(14, 48, W - 28, 8);
    ctx.fillStyle = '#FFD23F'; ctx.fillRect(14, 48, (W - 28) * Math.max(0, st.left / LIMIT), 8);
    e.fresh = e.fresh.filter(f => (f.t += dt) < 160);
    K.drawTiles(ctx, e.b, 0, TOP, W, e.fresh);
  }
  async function loadRank() {
    const el = root && $('#ultRank', root), mine = root && $('#ultMine', root); if (!el) return;
    try {
      const rows = await Hub.leaderboard(GAME, 10);
      if (!el.isConnected) return;
      el.innerHTML = A.rankItems(rows, 'best_score'); AV.paintAll(el);
      if (Hub.user) {
        const best = await Hub.myBest(GAME), all = await Hub.leaderboard(GAME, 500), pos = all.findIndex(r => r.user_id === Hub.user.id);
        if (mine.isConnected) mine.innerHTML = best ? `내 최고 <b class="num">${A.fmt(best)}</b>${pos >= 0 ? ` · ${pos + 1}위` : ''}` : '아직 내 기록이 없어요. 도전해 보세요!';
      } else mine.textContent = '로그인하면 내 기록이 랭킹에 올라가요.';
    } catch (e) { el.innerHTML = '<li class="empty">랭킹을 불러오지 못했어요.</li>'; }
  }
  function onKey(e) {
    if (!st) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.code === 'Enter' || e.code === 'Space') && (st.phase === 'ready' || st.phase === 'over') && !(document.querySelector('#authModal') && !document.querySelector('#authModal').hidden)) {
      if (tag === 'button' || tag === 'a') return;
      e.preventDefault(); start(); return;
    }
    const a = KEYMAP[e.code]; if (!a || st.phase !== 'play') return;
    e.preventDefault(); if (e.repeat) return;
    act(a);
  }

  window.GoUltimate = { render, _debug: () => st };
})();
