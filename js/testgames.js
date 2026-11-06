/*
 * gogo?gogo! — 관리자 '테스트 게임' (v70)
 *  - 관리자에게만 맨 위 메뉴 '테스트 게임' 이 보임 (#test). 정식으로 내보내기 전에 미리 해 보는 곳
 *  - 여기 게임은 게임 목록·랭킹·전적에 나오지 않고 포인트·기록도 저장하지 않음 (이 기기 최고 점수만)
 *  - 내보내기(정식 게임으로 등록)는 Claude 에게 '○○ 테스트 게임 내보내 줘' 라고 하면 games/ 폴더 + settings.js 로 옮김
 *  - 새 테스트 게임: 아래 GAMES 에 { id, name, desc, render(el, ui) } 를 더하면 목록에 나옴 (#test-아이디)
 */
(function () {
  'use strict';
  const Hub = window.GameHub;
  const $ = (s, r) => (r || document).querySelector(s);

  const CSS = `
  .tg-wrap { max-width: 1040px; margin: 0 auto; }
  /* 신호등 구구단: 왼쪽 놀이 화면 · 오른쪽 규칙 (좁은 화면은 아래로) */
  .gg-2col { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; align-items: start; }
  .gg-2col > .gg-rules { width: auto; position: sticky; top: 90px; }
  @media (max-width: 860px) { .gg-2col { grid-template-columns: minmax(0, 1fr); } .gg-2col > .gg-rules { position: static; } }
  .gg-hint:empty { display: none; }
  .tg-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .tg-card { display: grid; gap: 6px; background: #FFFFFF; border: 3px solid #1D2340; border-radius: 14px; padding: 14px; text-decoration: none; color: #1D2340; box-shadow: 0 4px 0 #1D2340; }
  .tg-card:hover { transform: translateY(-2px); }
  .tg-card b { font-size: 20px; } .tg-card .tag { justify-self: start; background: #FFD23F; color: #1D2340; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 700; }
  .tg-note { background: #E8F1FF; border: 2px solid #4C7DFF; border-radius: 12px; padding: 10px 14px; color: #1D2340; margin: 0 0 14px; line-height: 1.6; }
  /* 신호등 구구단 */
  .gg { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; justify-items: center; min-width: 0; }
  .gg > * { max-width: 100%; }
  .gg-top { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; font-weight: 700; }
  .gg-top span { background: #1D2340; color: #FFFFFF; border-radius: 999px; padding: 6px 14px; }
  .gg-top .sc { background: #FFD23F; color: #1D2340; font-size: 20px; }
  .gg-light { display: flex; gap: 14px; background: #1D2340; border: 4px solid #0A0E24; border-radius: 40px; padding: 10px 18px; box-shadow: 0 4px 0 #0A0E24; }
  .gg-light i { width: 54px; height: 54px; border-radius: 50%; display: block; border: 3px solid #0A0E24; }
  .gg-light .r { background: #5A1A22; } .gg-light .g { background: #123A22; }
  .gg-light.red .r { background: #FF3A3A; box-shadow: 0 0 22px 6px rgba(255, 58, 58, .75); }
  .gg-light.green .g { background: #2FE07A; box-shadow: 0 0 22px 6px rgba(47, 224, 122, .75); }
  .gg-frame { width: min(560px, 100%); background: linear-gradient(180deg, #2A3A8A, #1D2340); border: 6px solid #FFD23F; border-radius: 22px; padding: 26px 16px; text-align: center; color: #FFFFFF; box-shadow: 0 6px 0 #0A0E24; position: relative; }
  .gg-q { font-size: clamp(56px, 13vw, 104px); font-weight: 800; letter-spacing: 4px; line-height: 1.1; font-family: var(--f-display, inherit); }
  .gg-q .x { color: #FFD23F; margin: 0 .25em; }
  .gg-hint { margin-top: 6px; font-size: 18px; font-weight: 700; }
  .gg-hint.green { color: #7DFFB0; } .gg-hint.red { color: #FF9A9E; }
  .gg-flash { position: absolute; inset: 0; border-radius: 16px; display: grid; place-items: center; font-size: 26px; font-weight: 800; pointer-events: none; }
  .gg-flash.ok { background: rgba(47, 224, 122, .28); } .gg-flash.bad { background: rgba(255, 58, 58, .3); }
  .gg-form { display: flex; gap: 8px; width: min(560px, 100%); }
  .gg-form input { flex: 1; min-width: 0; font-size: 34px; font-weight: 800; text-align: center; border: 4px solid #1D2340; border-radius: 14px; padding: 8px; color: #1D2340; background: #FFFFFF; }
  .gg-form button { font-size: 20px; }
  .gg-form #ggRe { font-size: 16px; background: #BDE8FF; color: #1D2340; white-space: nowrap; }
  .gg-form #ggMusic { font-size: 15px; background: #E7D9FF; color: #1D2340; white-space: nowrap; }
  @media (max-width: 560px) { .gg-form #ggRe { font-size: 13px; padding: 6px 8px; } }
  .gg-pad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: min(360px, 100%); }
  .gg-pad button { font-size: 24px; font-weight: 800; padding: 12px 0; border-radius: 12px; border: 3px solid #1D2340; background: #FFFFFF; color: #1D2340; cursor: pointer; box-shadow: 0 3px 0 #1D2340; }
  .gg-pad button.ok { background: #FFD23F; } .gg-pad button.del { background: #BDE8FF; }
  .gg-log { width: min(560px, 100%); background: #FFFFFF; border: 3px solid #1D2340; border-radius: 12px; padding: 8px 12px; color: #1D2340; font-size: 15px; min-height: 44px; }
  .gg-over { width: min(560px, 100%); background: #FFF8D6; border: 4px solid #FFB020; border-radius: 16px; padding: 18px; text-align: center; color: #1D2340; }
  .gg-over b.big { display: block; font-size: 48px; }
  .gg-rules { width: min(560px, 100%); background: #E8F1FF; border: 2px solid #4C7DFF; border-radius: 12px; padding: 10px 14px; color: #1D2340; line-height: 1.7; }
  .gg-rules .gt { color: #138A3E; font-weight: 800; } .gg-rules .rt { color: #D6202A; font-weight: 800; }
  /* v73 Meshy 그림으로 꾸미기 (둘째 키 18크레딧): 건널목 배경 · 칠판 틀 · 신호등 마스코트 */
  .gg { background: url(img/test/gugu_bg.jpg) center top / 100% auto no-repeat, linear-gradient(180deg, #CFEFFF, #EAF7FF); border: 4px solid #1D2340; border-radius: 20px; padding: 16px 12px 18px; box-shadow: 0 5px 0 #1D2340; }
  .gg-frame { background: url(img/test/gugu_board.jpg) center / 100% 100% no-repeat; border: 0; border-radius: 6px; box-shadow: 0 6px 0 rgba(29, 35, 64, .45); aspect-ratio: 1000 / 496; display: grid; place-items: center; padding: 6% 9%; }
  .gg-frame .gg-q { text-shadow: 0 4px 0 rgba(0, 0, 0, .35); }
  .gg-frame .gg-flash { inset: 9% 7%; }
  .gg-log, .gg-pad button, .gg-form input { box-shadow: 0 3px 0 #1D2340; }
  .gg-top span { box-shadow: 0 3px 0 rgba(10, 14, 36, .35); }
  .gg-mascot { float: right; width: 96px; height: auto; image-rendering: pixelated; margin: -6px -4px 4px 8px; }
  @media (max-width: 560px) { .gg-frame { aspect-ratio: auto; min-height: 150px; } .gg-mascot { width: 72px; } }
  @media (max-width: 560px) { .gg-light i { width: 40px; height: 40px; } .gg-pad button { padding: 10px 0; } }
  /* v77 Meshy 꾸미기 2 (첫째 키): 제목 간판 · 도트 신호등(꺼짐·빨강·초록) · 마스코트 기쁨/앗 · 트로피 · 숫자 키 3색 · 아이콘 */
  .gg-title { width: min(520px, 100%); aspect-ratio: 640 / 232; background: url(img/test/gugu_title.png) center / 100% 100% no-repeat; display: grid; place-items: center; padding: 0 16% 7%; margin-bottom: -4px; }
  .gg-title b { font-family: var(--f-display, inherit); font-size: clamp(22px, 5.4vw, 40px); color: #1D2340; letter-spacing: 2px; text-shadow: 0 3px 0 #FFF6B0; white-space: nowrap; }
  .gg-top span { display: inline-flex; align-items: center; gap: 6px; }
  .gg-top img { width: 26px; height: 26px; image-rendering: pixelated; margin: -4px 0; }
  .gg-light { width: 250px; aspect-ratio: 340 / 203; background: url(img/test/gugu_light_off.png) center / contain no-repeat; border: 0; border-radius: 0; padding: 0; box-shadow: none; filter: drop-shadow(0 5px 0 rgba(29, 35, 64, .35)); }
  .gg-light i { display: none; }
  .gg-light.red { background-image: url(img/test/gugu_light_red.png); animation: ggGlowR 1s ease-in-out infinite; }
  .gg-light.green { background-image: url(img/test/gugu_light_green.png); animation: ggGlowG 1s ease-in-out infinite; }
  @keyframes ggGlowR { 50% { filter: drop-shadow(0 5px 0 rgba(29, 35, 64, .35)) drop-shadow(0 0 14px rgba(255, 58, 58, .85)); } }
  @keyframes ggGlowG { 50% { filter: drop-shadow(0 5px 0 rgba(29, 35, 64, .35)) drop-shadow(0 0 14px rgba(47, 224, 122, .85)); } }
  .gg-frame { position: relative; }
  .gg-react { position: absolute; right: -14px; bottom: -22px; width: 104px; height: auto; image-rendering: pixelated; pointer-events: none; opacity: 0; transform: scale(.4) translateY(20px); transition: opacity .15s, transform .18s cubic-bezier(.3, 1.6, .5, 1); z-index: 2; }
  .gg-react.on { opacity: 1; transform: scale(1) translateY(0); }
  .gg-pad { gap: 6px; }
  .gg-pad button { background: url(img/test/gugu_key.png) center / 100% 100% no-repeat; border: 0; box-shadow: none; border-radius: 0; aspect-ratio: 1 / .78; padding: 0 0 6%; font-size: 30px; text-shadow: 0 2px 0 #FFFFFF; transition: transform .06s; }
  .gg-pad button:active { transform: translateY(3px) scale(.97); }
  .gg-pad button.ok { background-image: url(img/test/gugu_key_ok.png); color: #FFFFFF; text-shadow: 0 2px 0 #1D2340; font-size: 22px; }
  .gg-pad button.del { background-image: url(img/test/gugu_key_del.png); color: #FFFFFF; text-shadow: 0 2px 0 #1D2340; }
  .gg-over { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 12px; align-items: center; text-align: left; }
  .gg-over .trophy { width: 110px; height: auto; image-rendering: pixelated; animation: ggBounce 1s ease-in-out infinite; }
  @keyframes ggBounce { 50% { transform: translateY(-6px) rotate(-3deg); } }
  @media (max-width: 560px) { .gg-light { width: 170px; } .gg-react { width: 78px; right: -6px; bottom: -16px; } .gg-pad button { font-size: 24px; } .gg-over { grid-template-columns: 76px minmax(0, 1fr); } .gg-over .trophy { width: 76px; } .gg-top img { width: 20px; height: 20px; } }
  @media (prefers-reduced-motion: reduce) { .gg-light.red, .gg-light.green, .gg-over .trophy { animation: none; } }
  /* v79 정식 게임(#gugu): 오른쪽 칸 = 랭킹 + 규칙 */
  .gg-2col > .gg-side { display: grid; gap: 14px; position: sticky; top: 90px; align-content: start; }
  .gg-side .gg-rules { width: auto; position: static; }
  .gg-rank h3 { margin: 0 0 8px; } .gg-rank h3 small { font-size: 12px; color: #4C7DFF; }
  .gg-ev { font-size: 13px; background: #FF5A5F; color: #FFFFFF; border-radius: 999px; padding: 2px 10px; vertical-align: middle; }
  @media (max-width: 860px) { .gg-2col > .gg-side { position: static; } }
  `;
  function css() { if (!document.getElementById('tgCss')) { const s = document.createElement('style'); s.id = 'tgCss'; s.textContent = CSS; document.head.appendChild(s); } }

  /* ---------------- 신호등 구구단 ----------------
   *  큰 틀 안에 한 자리 수 두 개 (a × b). 위 신호등:
   *   녹색불 → 바른 답 (4×6 → 24)
   *   빨간불 → 십의 자리와 일의 자리를 바꾼 답 (4×6 → 42 · 3×3 = 09 → 90 · 4×5 = 20 → 02 = 2)
   *  맞으면 +1점, 틀리면 −1점 · 45초 */
  const GUGU = { sec: 45, redRatio: 0.5, min: 1, max: 9 };
  const flip = n => (n % 10) * 10 + Math.floor(n / 10);   // 두 자리로 보고 자리 바꾸기 (9 → 09 → 90, 20 → 02 → 2)
  // v79: 정식 게임(games/study/gugu, 이벤트)에서도 같은 화면을 씀 — opt = { bgm: 음악 id, best: 내 최고, onOver(st) → 결과 상자 안내 글(HTML) }
  function gugu(el, ui, opt) {
    opt = opt || {};
    let st = { phase: 'ready' }, timer = 0, best = 0;
    try { best = +localStorage.getItem('gogo_test_gugu_best') || 0; } catch (e) { /* noop */ }
    if (opt.best != null) best = opt.best;
    const rnd = () => GUGU.min + Math.floor(Math.random() * (GUGU.max - GUGU.min + 1));
    el.innerHTML = `<div class="gg-2col"><div class="gg">
      <div class="gg-title"><b>신호등 구구단</b></div>
      <div class="gg-top"><span class="sc"><img src="img/test/gugu_ic_star.png" alt="">점수 <b id="ggScore">0</b></span><span><img src="img/test/gugu_ic_clock.png" alt="">남은 시간 <b id="ggTime">${GUGU.sec}</b>초</span><span><img src="img/test/gugu_ic_ok.png" alt="" onerror="this.remove()">맞힘 <b id="ggOk">0</b> · <img src="img/test/gugu_ic_no.png" alt="" onerror="this.remove()">틀림 <b id="ggNo">0</b></span><span><img src="img/test/gugu_ic_crown.png" alt="" onerror="this.remove()">최고 <b id="ggBest">${best}</b></span></div>
      <div class="gg-light" id="ggLight" aria-label="신호등"><i class="r"></i><i class="g"></i></div>
      <div class="gg-frame"><div class="gg-q" id="ggQ">? <span class="x">×</span> ?</div><div class="gg-hint" id="ggHint">시작을 누르세요</div><div class="gg-flash" id="ggFlash" hidden></div><img class="gg-react" id="ggReact" src="img/test/gugu_happy.png" alt=""></div>
      <form class="gg-form" id="ggForm" autocomplete="off"><input id="ggIn" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="답" aria-label="답 입력" disabled><button class="btn btn-sun" type="submit" id="ggGo">시작 ▶</button><button class="btn" type="button" id="ggRe" title="처음부터 다시">↻ 다시 하기</button><button class="btn" type="button" id="ggMusic" title="배경음악 켜기·끄기" hidden>♪</button></form>
      <div class="gg-pad" id="ggPad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" tabindex="-1" data-n="${n}">${n}</button>`).join('')}<button type="button" tabindex="-1" class="del" data-n="del">←</button><button type="button" tabindex="-1" data-n="0">0</button><button type="button" tabindex="-1" class="ok" data-n="ok">확인</button></div>
      <div class="gg-log" id="ggLog">녹색불이면 바른 답, 빨간불이면 자리를 바꾼 답!</div>
      </div>
      <div class="gg-rules"><img class="gg-mascot" src="img/test/gugu_mascot.png" alt="신호등 마스코트"><b>규칙</b><br>
        <span class="gt">● 녹색불</span>: 바른 답을 적어요. 4 × 6 → <b>24</b><br>
        <span class="rt">● 빨간불</span>: 답의 <b>십의 자리와 일의 자리를 바꿔서</b> 적어요. 4 × 6 → 24 → <b>42</b> · 3 × 3 → 09 → <b>90</b> · 4 × 5 → 20 → 02 → <b>2</b><br>
        맞으면 <b>+1점</b>, 틀리면 <b>−1점</b> · ${GUGU.sec}초 동안 · Enter 또는 확인으로 내기</div>
    </div>`;
    const inp = $('#ggIn', el), form = $('#ggForm', el), go = $('#ggGo', el);
    const set = (id, v) => { const x = $('#' + id, el); if (x) x.textContent = v; };
    function next() {
      const a = rnd(), b = rnd(), red = Math.random() < GUGU.redRatio;
      st.q = { a, b, red, ans: red ? flip(a * b) : a * b };
      $('#ggQ', el).innerHTML = `${a}<span class="x">×</span>${b}`;
      $('#ggLight', el).className = 'gg-light ' + (red ? 'red' : 'green');
      const h = $('#ggHint', el); h.className = 'gg-hint'; h.textContent = '';   // v70 선생님: 문제 아래 녹색·빨강 안내는 지움 (신호등만 보고 판단)
      inp.value = ''; inp.focus({ preventScroll: true });
    }
    // v78 배경음악: 블록 대전과 같은 곡 (games/puzzle/battle/bgm/bgm.mp3, 「Block Rush」) — 시작하면 처음부터, 끝나면 멈춤
    const BGM = window.GoBGM;
    if (BGM) BGM.load(opt.bgm || 'battle');
    const mBtn = $('#ggMusic', el);
    const syncM = () => { if (!mBtn.isConnected || !BGM) return; mBtn.hidden = !BGM.ready; mBtn.textContent = BGM.isMuted() ? '♪ 켜기' : '♪ 끄기'; };
    const offM = BGM ? BGM.onChange(syncM) : () => {};
    if (BGM) { mBtn.addEventListener('click', () => { BGM.toggleMute(); syncM(); }); syncM(); }
    // v77 그림 미리 받기 (신호등 켜짐·마스코트 반응·트로피)
    ['gugu_light_red', 'gugu_light_green', 'gugu_happy', 'gugu_oops', 'gugu_trophy'].forEach(n => { const im = new Image(); im.src = 'img/test/' + n + '.png'; });
    function flash(ok, txt) {
      const f = $('#ggFlash', el); f.hidden = false; f.className = 'gg-flash ' + (ok ? 'ok' : 'bad'); f.textContent = txt; clearTimeout(f._t); f._t = setTimeout(() => { f.hidden = true; }, 420);
      const m = $('#ggReact', el); if (!m) return;   // v77 맞으면 기뻐하는 마스코트, 틀리면 '앗!' 마스코트
      m.src = 'img/test/' + (ok ? 'gugu_happy' : 'gugu_oops') + '.png'; m.classList.add('on'); clearTimeout(m._t); m._t = setTimeout(() => m.classList.remove('on'), 650);
    }
    function submit() {
      if (st.phase !== 'play') { start(); return; }
      const v = inp.value.trim(); if (v === '') return;
      const q = st.q, n = parseInt(v, 10), ok = n === q.ans;
      if (ok) { st.score++; st.right++; } else { st.score--; st.wrong++; }
      set('ggScore', st.score); set('ggOk', st.right); set('ggNo', st.wrong);
      flash(ok, ok ? '+1' : '−1');
      $('#ggLog', el).innerHTML = `${ok ? '<b style="color:#138A3E">정답 +1</b>' : '<b style="color:#D6202A">틀림 −1</b>'} · ${q.a} × ${q.b} = ${q.a * q.b}${q.red ? ` → <b style="color:#D6202A">빨간불</b> 자리 바꾸기 → <b>${q.ans}</b>` : ` · <b style="color:#138A3E">녹색불</b> → <b>${q.ans}</b>`}${ok ? '' : ` (내 답 ${n})`}`;
      next();
    }
    function start() {
      st = { phase: 'play', score: 0, right: 0, wrong: 0, left: GUGU.sec, q: null };
      set('ggScore', 0); set('ggOk', 0); set('ggNo', 0); set('ggTime', GUGU.sec);
      const ov = $('.gg-over', el); if (ov) ov.remove();
      inp.disabled = false; go.textContent = '내기'; next();
      if (BGM) BGM.restart();
      clearInterval(timer); timer = setInterval(() => { st.left--; set('ggTime', Math.max(0, st.left)); if (st.left <= 0) over(); }, 1000);
    }
    function over() {
      if (st.phase === 'over') return;   // v77 한 번만
      clearInterval(timer); st.phase = 'over'; inp.disabled = true; go.textContent = '다시 ▶';
      if (BGM) BGM.pause();
      el.querySelectorAll('.gg-over').forEach(x => x.remove());
      $('#ggLight', el).className = 'gg-light'; $('#ggQ', el).innerHTML = '끝!'; $('#ggHint', el).textContent = '';
      const nb = st.score > best; if (nb) { best = st.score; try { localStorage.setItem('gogo_test_gugu_best', String(best)); } catch (e) { /* noop */ } set('ggBest', best); }
      const box = document.createElement('div'); box.className = 'gg-over';
      box.innerHTML = `<img class="trophy" src="img/test/gugu_trophy.png" alt="트로피"><div><b class="big">${st.score}점</b>맞힘 ${st.right} · 틀림 ${st.wrong}${nb ? ' · <b style="color:#D6202A">최고 점수!</b>' : ''}<br><small class="gg-note">${opt.onOver ? '기록을 저장하는 중…' : '테스트 게임이라 랭킹·포인트에는 남지 않아요 (이 기기 최고 점수만)'}</small><div style="margin-top:10px"><button class="btn btn-sun" type="button" data-again>↻ 다시 하기</button></div></div>`;
      box.querySelector('[data-again]').addEventListener('click', start);
      $('.gg-frame', el).after(box);
      if (opt.onOver) Promise.resolve(opt.onOver({ score: st.score, right: st.right, wrong: st.wrong, sec: GUGU.sec })).then(h => { const n = box.querySelector('.gg-note'); if (n && h != null) n.innerHTML = h; }).catch(() => {});
    }
    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    $('#ggRe', el).addEventListener('click', start);   // v71 다시 하기: 언제든 처음부터 (점수·시간 처음으로)
    // v81 버그 고침: 숫자판을 마우스로 누르면 그 버튼에 초점이 남아, 다음 Enter 가 그 숫자를 한 번 더 눌러 '12 → 122' 가 됨
    //  → 숫자판 버튼은 초점을 받지 않게 하고(초점은 답 칸에 그대로), 혹시 초점이 버튼에 있어도 Enter 는 '내기'로 처리
    $('#ggPad', el).addEventListener('mousedown', e => { if (e.target.closest('[data-n]')) e.preventDefault(); });
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !e.target.closest || !e.target.closest('#ggPad')) return;
      e.preventDefault(); submit();
    });
    $('#ggPad', el).addEventListener('click', e => {
      const b = e.target.closest('[data-n]'); if (!b) return; const n = b.dataset.n;
      if (st.phase !== 'play') { if (n === 'ok') start(); return; }
      if (n === 'del') inp.value = inp.value.slice(0, -1); else if (n === 'ok') submit(); else if (inp.value.length < 3) inp.value += n;
      if (st.phase === 'play' && document.activeElement !== inp && !matchMedia('(pointer: coarse)').matches) inp.focus({ preventScroll: true });   // 컴퓨터: 초점을 답 칸으로 (휴대폰은 화면 자판이 뜨지 않게 그대로)
    });
    return () => { clearInterval(timer); offM(); if (BGM) BGM.stop(); };
  }

  // v79: 신호등 구구단은 정식 게임(#gugu · 이벤트 칸 · 공부? 목록)으로 내보냄 → 테스트 목록에서는 빠짐
  const GAMES = [];

  function render(root, ui, gid) {
    css();
    if (!Hub.isAdmin()) {
      root.innerHTML = `<div class="panel gate"><h2>관리자만 들어올 수 있어요</h2><p>테스트 게임은 관리자 아이디로 로그인해야 볼 수 있어요.</p><div class="row" style="justify-content:center"><a class="btn" href="#home">홈으로</a></div></div>`;
      return () => {};
    }
    const g = gid && GAMES.find(x => x.id === gid);
    if (!g) {
      root.innerHTML = `<div class="tg-wrap"><div class="page-head"><h1>테스트 게임</h1><p>정식으로 내보내기 전에 관리자만 미리 해 보는 곳이에요.</p></div>
        <p class="tg-note">여기 게임은 게임 목록·랭킹·전적에 나오지 않고 포인트도 없어요. 해 보고 괜찮으면 Claude 에게 <b>"○○ 내보내 줘"</b> 라고 하면 정식 게임으로 옮겨요.</p>
        ${GAMES.length ? '' : '<p class="tg-note">지금 테스트 중인 게임이 없어요. (신호등 구구단은 정식 게임으로 내보냈어요 → <a href="#gugu">신호등 구구단</a>)</p>'}<div class="tg-list">${GAMES.map(x => `<a class="tg-card" href="#test-${x.id}"><span class="tag">테스트</span><b>${ui.esc(x.name)}</b><span>${ui.esc(x.desc)}</span></a>`).join('')}</div></div>`;
      return () => {};
    }
    root.innerHTML = `<div class="tg-wrap"><div class="page-head"><h1>${ui.esc(g.name)} <small style="font-size:14px;background:#FFD23F;color:#1D2340;border-radius:999px;padding:2px 10px;vertical-align:middle">테스트</small></h1><p><a href="#test">← 테스트 게임 목록</a></p></div><div id="tgBody"></div></div>`;
    return g.render($('#tgBody', root), ui) || (() => {});
  }

  window.GoTestGames = { render, GAMES, flip, gugu, css, GUGU };
})();
