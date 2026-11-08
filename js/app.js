/* gogo?gogo! — 포털 화면 (홈 · 게임 · 대전 · 상점 · 랭킹 · 내 전적) */
(function () {
  'use strict';
  const Hub = window.GameHub, P = window.GoPixel, AV = window.GoAvatar, BGM = window.GoBGM, SET = window.GoSettings;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  // 게임 썸네일 그리기 (그림을 늦게 불러와도 다시 그림)
  const drawThumbs = root => $$('canvas[data-thumb]', root).forEach(c => { try { const ctx = window.GoPixel.setup(c, 240, 150); window.GoGames[c.dataset.thumb].thumb(ctx, 240, 150); } catch (e) { /* noop */ } });
  let thumbT = 0;
  window.addEventListener('gogo:img', () => { clearTimeout(thumbT); thumbT = setTimeout(() => drawThumbs(document), 120); });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('ko-KR');
  // 게임별 점수 표시: settings.js 에 scoreText(점수) 가 있으면 그 글자로 (예: 지뢰찾기 = 걸린 시간)
  const sfmt = (gid, v) => { const s = gid && SET.get(gid); return s && s.scoreText ? s.scoreText(v) : fmt(v); };
  const dur = s => s < 60 ? s + '초' : s < 3600 ? Math.floor(s / 60) + '분 ' + (s % 60) + '초' : Math.floor(s / 3600) + '시간 ' + Math.floor(s % 3600 / 60) + '분';
  function ago(iso) {
    if (!iso) return '-';
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return '방금';
    if (d < 3600) return Math.floor(d / 60) + '분 전';
    if (d < 86400) return Math.floor(d / 3600) + '시간 전';
    if (d < 86400 * 7) return Math.floor(d / 86400) + '일 전';
    const t = new Date(iso); return (t.getMonth() + 1) + '월 ' + t.getDate() + '일';
  }

  /* ---------- 게임 목록 (각 게임 폴더의 settings.js 에서 자동으로 모음) ---------- */
  const CATNAME = SET.CATEGORIES;
  const GAMES = SET.list().map(g => Object.assign(Object.create(g), { cat: CATNAME[g.category] || g.category }));
  const SOON = [['벽돌깨기', '액션'], ['플래피 점프', '아케이드']];
  const CATS = ['전체'].concat(Object.values(CATNAME));
  const gameById = id => GAMES.find(g => g.id === id && !g.battle);
  const nameOf = id => (SET.get(id) || {}).name || id;

  /* ---------- 공통 조각 ---------- */
  // 아바타 캔버스 (그린 뒤 AV.paintAll 로 채움)
  // scene = true 이면 배경(옷장에서 고른 배경)까지 그림 — 내 아바타 크게 보이는 곳에만 사용
  const avCanvas = (av, scale, crop, cls, scene) => `<canvas class="av ${cls || ''}" data-avatar="${AV.attr(av)}" data-scale="${scale}" data-crop="${crop || 'full'}" ${scene ? 'data-scene' : ''} aria-hidden="true"></canvas>`;
  // 포인트 변화 문구: gained = 실제 변화, delta = 규칙상 변화
  function pointText(gained, delta) {
    if (gained > 0) return '+' + gained + 'P';
    if (gained < 0) return gained + 'P';
    if (delta < 0) return delta + 'P (보유 0P라 그대로)';
    return '±0P';
  }

  function toast(msg) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 2800);
  }

  function rankItems(rows, valueKey, gid) {
    if (!rows.length) return '<li class="empty">아직 기록이 없어요. 첫 1위가 되어 보세요!</li>';
    const me = Hub.user && Hub.user.id;
    return rows.map((r, i) => `<li class="${r.user_id === me ? 'mine' : ''}"><span class="rk">${i + 1}</span><span class="nm">${avCanvas(r.user_id === me ? Hub.user.avatar : r.avatar, 1.5, 'bust', 'rk-av')}${!r.user_id ? `<span class="nm-t">${esc(r.nickname)}</span>` : `<a class="nm-t" href="#room/${esc(r.user_id)}" title="${esc(r.nickname)}님의 방 구경">${esc(r.nickname)}</a>`}${r.sample ? '<span class="ex">예시</span>' : ''}</span><span class="sc">${valueKey === 'best_score' ? sfmt(gid, r[valueKey]) : fmt(r[valueKey])}${valueKey === 'earned' ? 'P' : ''}</span></li>`).join('');
  }
  function fillRank(el, rows, key, gid) { if (!el || !el.isConnected) return; el.innerHTML = rankItems(rows, key, gid); AV.paintAll(el); }

  function levelBlock(u) {
    const L = Hub.levelInfo(u.earned);
    return `<div class="xp"><div class="wallet"><span>보유 포인트</span><b class="num">${fmt(u.points)}P</b></div><div class="xp-bar" role="progressbar" aria-label="다음 레벨까지" aria-valuenow="${Math.round(L.progress * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.round(L.progress * 100)}%"></i></div><span>누적 ${fmt(u.earned)}P · Lv.${L.level + 1}까지 ${fmt(L.toNext)}P</span></div>`;
  }

  /* ---------- 헤더 ---------- */
  function renderUserChip() {
    const u = Hub.user, el = $('#userChip');
    const na = $('#navAdmin'); if (na) na.hidden = !Hub.isAdmin();
    const nt = $('#navTest'); if (nt) nt.hidden = !Hub.isAdmin();   // v70 테스트 게임 (관리자만)
    if (u) {
      el.innerHTML = `<a class="who" href="#my">${avCanvas(u.avatar, 2.5, 'bust', 'chip-av')}<span class="who-n">${esc(u.nickname)}</span><span class="lv">Lv.${Hub.levelInfo(u.earned).level}</span><span class="pt num">${fmt(u.points)}P</span></a><button class="btn btn-sm chip-out" type="button" data-logout>로그아웃</button>`;
      AV.paintAll(el);
    } else {
      el.innerHTML = '<button class="btn btn-sm" type="button" data-auth="login">로그인</button><button class="btn btn-sm btn-primary" type="button" data-auth="signup">회원가입</button>';
    }
  }
  function setNav(name) {
    $$('.nav a').forEach(a => { if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  /* ---------- 인증 모달 ---------- */
  let afterAuth = null;
  function openAuth(tab, cb) {
    afterAuth = cb || null;
    $('#authModal').hidden = false;
    setTab(tab || 'login');
    $('#loginErr').hidden = true; $('#signupErr').hidden = true;
    setTimeout(() => (tab === 'signup' ? $('#su-id') : $('#li-id')).focus(), 30);
  }
  // 창을 닫으면 입력한 아이디·비밀번호를 지움 (학교 공용 PC 대비)
  function closeAuth() { $('#authModal').hidden = true; afterAuth = null; $('#loginForm').reset(); $('#signupForm').reset(); $('#loginErr').hidden = true; $('#signupErr').hidden = true; }
  function setTab(t) {
    $('#tabLogin').setAttribute('aria-selected', String(t === 'login'));
    $('#tabSignup').setAttribute('aria-selected', String(t === 'signup'));
    $('#loginForm').hidden = t !== 'login'; $('#signupForm').hidden = t !== 'signup';
  }
  function showErr(el, msg) { el.textContent = msg; el.hidden = false; }
  async function doLogin(username, password, errEl, btn) {
    btn.disabled = true;
    try {
      await Hub.signIn({ username, password });
      toast(Hub.user.nickname + '님, 어서 와요!');
      return true;
    } catch (e) { showErr(errEl, e.message); return false; }
    finally { btn.disabled = false; }
  }
  function bindAuth() {
    $('#authModal').addEventListener('click', e => { if (e.target.id === 'authModal' || e.target.closest('[data-close]')) closeAuth(); });
    $$('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const ok = await doLogin($('#li-id').value, $('#li-pw').value, $('#loginErr'), e.submitter || $('#loginForm button'));
      if (ok) { const cb = afterAuth; closeAuth(); $('#li-pw').value = ''; cb && cb(); }
    });
    $('#signupForm').addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('#signupErr'), btn = e.submitter || $('#signupForm button');
      if ($('#su-pw').value !== $('#su-pw2').value) return showErr(err, '비밀번호 확인이 일치하지 않아요.');
      btn.disabled = true;
      try {
        await Hub.signUp({ username: $('#su-id').value, nickname: $('#su-nick').value, password: $('#su-pw').value });
        toast('가입 완료! 기본 아바타가 만들어졌어요. 상점에서 꾸며 보세요.');
        const cb = afterAuth; closeAuth(); $('#signupForm').reset(); cb && cb();
      } catch (ex) { showErr(err, ex.message); }
      finally { btn.disabled = false; }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#authModal').hidden) closeAuth(); });
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-auth]'); if (a) { e.preventDefault(); openAuth(a.dataset.auth); }
      const lo = e.target.closest('[data-logout]'); if (lo) { e.preventDefault(); Hub.signOut().then(() => toast('로그아웃했어요.')); }
    });
  }

  /* ---------- 화면 공통 ---------- */
  const view = () => $('#view');
  let cleanups = [];
  function cleanup() { cleanups.forEach(f => { try { f(); } catch (e) { /* noop */ } }); cleanups = []; }
  let current = 'home';

  /* ---------- 홈 ---------- */
  let homeCat = '전체', homeRankGame = 'battle';
  async function renderHome() {
    current = 'home'; setNav('home');
    view().innerHTML = `
      <div class="home">
        <div class="home-main">
          <section class="hero hero-img" id="heroBox" aria-roledescription="carousel" aria-label="이벤트 · 업데이트 소개">
            <div class="hero-slides" id="heroSlides" aria-live="polite"></div>
            <div class="hero-timer" aria-hidden="true"><i id="heroBar"></i></div>
          </section>
          ${eventHTML()}
          <section aria-labelledby="gamesTitle">
            <div class="sec-head">
              <h2 id="gamesTitle">게임 목록</h2>
              <div class="cats" id="cats">${CATS.map(c => `<button type="button" aria-pressed="${c === homeCat}" data-cat="${c}">${c}</button>`).join('')}</div>
            </div>
            <div class="grid" id="gameGrid"></div>
          </section>
        </div>
        <aside class="side">
          <div class="panel" id="accountBox"></div>
          <div class="panel">
            <h3>게임별 랭킹 <small>최고 점수</small></h3>
            <div class="mini-tabs" id="rankTabs">${GAMES.map(g => `<button type="button" data-g="${g.id}" aria-pressed="${g.id === homeRankGame}">${g.name}</button>`).join('')}</div>
            <ol class="rank" id="rankList"><li class="empty">불러오는 중…</li></ol>
          </div>
        </aside>
      </div>`;
    renderGrid();
    renderAccountBox();
    startHeroRain();
    $('#cats').addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      homeCat = b.dataset.cat; $$('#cats button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderGrid();
    });
    $('#rankTabs').addEventListener('click', e => {
      const b = e.target.closest('[data-g]'); if (!b) return;
      homeRankGame = b.dataset.g; $$('#rankTabs button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); loadHomeRank();
    });
    loadHomeRank();
    loadEventRank();
  }

  /* ---------- 홈 이벤트 칸 (맨 위 소개와 게임 목록 사이) ----------
   * settings.js 에 event: true 인 게임 (지금은 Ultimate mode). 왼쪽 소개·도전 버튼, 오른쪽 바로 랭킹 TOP 5 */
  const eventGames = () => SET.listAll().filter(s => s.event);
  function eventHTML() {
    return eventGames().map(s => `
      <section class="event-box" aria-label="이벤트 ${esc(s.name)}">
        <div class="event-copy">
          <span class="event-tag">EVENT</span>
          <h2>${esc(s.eventTitle || s.name)}</h2>
          <p>${s.eventDesc || esc(s.blurb)}</p>
          <div class="event-btns"><a class="btn btn-sun" href="#${s.id}">도전하기 ▶</a><span class="event-mine" data-event-mine="${s.id}"></span></div>
        </div>
        <div class="event-rank">
          <h3>랭킹 TOP 5</h3>
          <ol class="rank" data-event-rank="${s.id}"><li class="empty">불러오는 중…</li></ol>
        </div>
      </section>`).join('');
  }
  async function loadEventRank() {
    for (const s of eventGames()) {
      const el = $(`[data-event-rank="${s.id}"]`), mine = $(`[data-event-mine="${s.id}"]`);
      try {
        fillRank(el, await Hub.leaderboard(s.id, 5), 'best_score', s.id);
        const best = Hub.user ? await Hub.myBest(s.id) : null;
        if (mine && mine.isConnected) mine.innerHTML = Hub.user ? (best ? `내 최고 <b class="num">${sfmt(s.id, best)}</b>` : '아직 도전 기록이 없어요') : '로그인하면 랭킹에 올라가요';
      } catch (e) { if (el && el.isConnected) el.innerHTML = '<li class="empty">랭킹을 불러오지 못했어요.</li>'; }
    }
  }

  async function renderGrid() {
    const grid = $('#gameGrid'); if (!grid) return;
    const show = g => homeCat === '전체' || g.cat === homeCat;
    const live = GAMES.filter(show), soon = SOON.filter(([, c]) => homeCat === '전체' || c === homeCat);
    grid.innerHTML = live.map(g => `
      <a class="card" data-cat="${g.cat}" href="#${g.id}">
        <canvas class="thumb" data-thumb="${g.id}" aria-hidden="true"></canvas>
        <div class="card-body">
          <span class="cat">${g.cat}</span>
          <h3>${g.name}${g.tag ? `<span class="tag ${g.tag === 'NEW' ? 'new' : g.tag === 'VS' ? 'vs' : ''}">${g.tag}</span>` : ''}</h3>
          <p>${g.blurb}</p>
          <div class="card-foot" data-foot="${g.id}"><span>기록 불러오는 중…</span></div>
        </div>
      </a>`).join('') + soon.map(([n, c]) => `
      <div class="card soon" aria-label="${n} 준비 중">
        <div class="soon-thumb">COMING SOON</div>
        <div class="card-body"><span class="cat">${c}</span><h3>${n}</h3><p>2단계에서 추가될 예정이에요.</p></div>
      </div>`).join('');
    if (!live.length && !soon.length) grid.innerHTML = '<p class="empty">이 분류의 게임은 곧 추가돼요.</p>';
    drawThumbs(grid);
    // v75: 카드 아래 기록 3줄 (게임 신기록 · 이번 시즌 신기록 · 내 기록). v84 RPG 는 1·2·3위
    const season = Hub.season();
    const recLine = (cls, label, who, val) => `<div class="rec ${cls}"><span class="rec-l">${label}</span><span class="rec-v">${who ? `<span class="rec-who">${esc(who)}</span>` : ''}<b class="num">${val}</b></span></div>`;
    await Promise.all(live.map(async g => {
      const foot = $(`[data-foot="${g.id}"]`, grid);
      try {
        if (SET.get(g.id) && SET.get(g.id).cardOld) {
          const tops = (await Hub.leaderboard(g.id, 3) || []).filter(t => t && t.best_score > 0);   // v84 RPG 카드: 1~3위
          if (!foot.isConnected) return;
          foot.classList.add('rec3');
          foot.innerHTML = ['🥇', '🥈', '🥉'].map((m, i) => recLine('r-rank', `<i>${m} </i>${i + 1}위`, tops[i] && tops[i].nickname, tops[i] ? sfmt(g.id, tops[i].best_score) : '-')).join('');
          return;
        }
        const st = SET.get(g.id) || {};
        const [tops, sea, mine] = await Promise.all([
          Hub.leaderboard(g.id, 1),
          Hub.seasonTop(g.id).catch(() => undefined),
          Hub.user ? Hub.myBest(g.id) : Promise.resolve(null)
        ]);
        if (!foot.isConnected) return;
        const top = tops && tops[0] && tops[0].best_score > 0 ? tops[0] : null;
        const sv = v => st.seasonWins ? v + '승' : sfmt(g.id, v);
        foot.classList.add('rec3');
        foot.innerHTML =
          recLine('r-all', '<i>🏆 </i>신기록', top && top.nickname, top ? sfmt(g.id, top.best_score) : '-') +
          recLine('r-season', '<i>⭐ </i>' + season.label, sea && sea.nickname, sea === undefined ? '…' : sea ? sv(sea.score) : '-') +
          recLine('r-me', '<i>🙂 </i>내 기록', '', !Hub.user ? '로그인 필요' : mine ? sfmt(g.id, mine) : '-');
      } catch (e) { if (foot.isConnected) foot.innerHTML = '<span>기록을 불러오지 못했어요</span>'; }
    }));
  }

  function renderAccountBox() {
    const box = $('#accountBox'); if (!box) return;
    const u = Hub.user;
    if (u) {
      box.innerHTML = `
        <div class="me">${avCanvas(u.avatar, 4, 'full', 'me-av', true)}
          <div><b>${esc(u.nickname)}</b><span class="lv">Lv.${Hub.levelInfo(u.earned).level}</span>${levelBlock(u)}</div></div>
        <div class="row"><a class="btn btn-sun" href="#room">내 방으로 <small>(아바타 꾸미기)</small></a><a class="btn" href="#my">내 전적</a></div>
        <p class="small acct-links"><a class="link" href="#shop">아바타 상점</a><button class="link" type="button" data-logout>로그아웃</button></p>`;
      AV.paintAll(box);
    } else {
      box.innerHTML = `
        <h3>로그인</h3>
        <form class="form" id="sideLogin" novalidate>
          <label for="sl-id">아이디</label>
          <input id="sl-id" autocomplete="username" autocapitalize="off" spellcheck="false">
          <label for="sl-pw">비밀번호</label>
          <input id="sl-pw" type="password" autocomplete="current-password">
          <p class="err" id="slErr" hidden></p>
          <button class="btn btn-primary btn-block" type="submit">로그인</button>
        </form>
        <p class="small">처음이세요? <button class="link" type="button" data-auth="signup">회원가입</button> 하고 모든 게임 전적을 남겨 보세요.</p>`;
      $('#sideLogin').addEventListener('submit', async e => {
        e.preventDefault();
        await doLogin($('#sl-id').value, $('#sl-pw').value, $('#slErr'), e.submitter || $('#sideLogin button'));
      });
    }
  }

  async function loadHomeRank() {
    const el = $('#rankList'); if (!el) return;
    try { fillRank(el, await Hub.leaderboard(homeRankGame, 10), 'best_score', homeRankGame); }
    catch (e) { el.innerHTML = '<li class="empty">랭킹을 불러오지 못했어요.</li>'; }
  }

  /* ---------- 맨 위 소개: 10초마다 다른 게임 ----------
   * 문구는 각 게임 폴더 settings.js 의 hero 값, 그림은 각 게임의 썸네일을 크게 그림 */
  const HERO_MS = 10000;
  let heroIndex = 0;
  // v92 선생님 그림 2장을 그대로 소개 화면으로 (그림 속 버튼 · ◀ ▶ 자리를 누르면 동작)
  //   자리는 그림 크기에 대한 % (왼쪽, 위, 너비, 높이)
  const HERO_SLIDES = [
    { id: 'event', img: 'img/hero/event.jpg', w: 1024, h: 525, alt: '신호등 구구단 이벤트 — 이번 시즌 1위에 도전! 녹색불이면 구구단 바른 답, 빨간불이면 답의 십의 자리와 일의 자리를 바꿔서. 45초 동안 맞으면 +1점, 틀리면 -1점.', cta: '이벤트 도전하기',
      go: [6.0, 73.0, 18.4, 10.0], prev: [5.6, 84.6, 4.6, 8.6], next: [16.6, 84.6, 4.6, 8.6] },
    { id: 'room', href: '#room', img: 'img/hero/room.jpg', w: 1024, h: 444, alt: '내 방 업데이트 — 가구를 사서 꾸미는 나만의 미니룸! 옷장을 누르면 아바타가 걸어가 옷을 갈아입어요.', cta: '내 방 가기',
      go: [3.2, 73.5, 14.8, 12.4], prev: [3.0, 87.6, 4.6, 9.0], next: [14.6, 87.6, 4.6, 9.0] }
  ];
  function startHeroRain() {
    const box = $('#heroSlides'); if (!box) return;
    const evg = SET.listAll().find(g => g.event && !g.hidden);
    const slides = HERO_SLIDES.filter(s => s.id !== 'event' || evg).map(s => Object.assign({}, s, { href: s.href || '#' + evg.id }));
    if (!slides.length) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pos = r => `left:${r[0]}%;top:${r[1]}%;width:${r[2]}%;height:${r[3]}%`;
    box.innerHTML = slides.map((g, i) => `
      <div class="hero-slide" data-i="${i}" ${i ? 'hidden' : ''}>
        <a class="hero-pic" href="${g.href}" tabindex="-1" aria-hidden="true"><img src="${g.img}?v=92" width="${g.w}" height="${g.h}" alt="" draggable="false"></a>
        <span class="sr-only">${esc(g.alt)}</span>
        <a class="hero-hot" style="${pos(g.go)}" href="${g.href}" aria-label="${esc(g.cta)}"></a>
        <button type="button" class="hero-hot" style="${pos(g.prev)}" data-step="-1" aria-label="이전 소개"></button>
        <button type="button" class="hero-hot" style="${pos(g.next)}" data-step="1" aria-label="다음 소개"></button>
      </div>`).join('');
    const els = $$('.hero-slide', box);
    let elapsed = 0, paused = false, raf = 0, last = 0;
    function go(i) {
      heroIndex = (i + slides.length) % slides.length; elapsed = 0;
      els.forEach((el, k) => { el.hidden = k !== heroIndex; if (k === heroIndex && !reduce) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); } });
    }
    $$('button[data-step]', box).forEach(b => b.addEventListener('click', e => { e.preventDefault(); go(heroIndex + Number(b.dataset.step)); }));
    const hero = $('#heroBox');
    hero.addEventListener('mouseenter', () => { paused = true; });
    hero.addEventListener('mouseleave', () => { paused = false; });
    hero.addEventListener('focusin', () => { paused = true; });
    hero.addEventListener('focusout', () => { paused = false; });
    // 손가락으로 밀어서 넘기기 (민 경우에는 그림 링크로 가지 않음)
    let sx = null, swiped = false;
    hero.addEventListener('pointerdown', e => { sx = e.clientX; swiped = false; });
    hero.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) { swiped = true; go(heroIndex + (dx < 0 ? 1 : -1)); } });
    hero.addEventListener('click', e => { if (swiped) { e.preventDefault(); swiped = false; } }, true);
    const bar = $('#heroBar');
    function tick(t) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, t - (last || t)); last = t;
      if (!paused && !document.hidden) { elapsed += dt; if (elapsed >= HERO_MS) go(heroIndex + 1); }
      if (bar) bar.style.width = (elapsed / HERO_MS * 100).toFixed(1) + '%';
    }
    go(heroIndex % slides.length);
    raf = requestAnimationFrame(tick);
    cleanups.push(() => cancelAnimationFrame(raf));
  }

  /* ---------- 게임 화면: 채팅 · 댓글 ---------- */
  const SOC = window.GoSocial;
  function mountSocial(id) {
    const ui = { toast, esc, openAuth, avCanvas, ago };
    cleanups.push(SOC.mountChat(id, ui));
    cleanups.push(SOC.mountComments(id, ui));
  }

  /* ---------- 게임 화면 ---------- */
  let session = null;
  function renderPlay(id) {
    if ((SET.get(id) || {}).board) return renderBoardPlay(id);
    const g = gameById(id), cfg = SET.get(id); current = 'play'; setNav('home');
    BGM.load(id);
    const pad = id === 'blocks'
      ? `<div class="pad" id="pad"><button type="button" data-act="left" aria-label="왼쪽">◀</button><button type="button" data-act="rotate" aria-label="회전">⟲</button><button type="button" data-act="right" aria-label="오른쪽">▶</button><button type="button" data-act="down" aria-label="천천히 내리기">▼</button><button type="button" class="pad-a" data-act="drop" aria-label="한 번에 내리기">⤓</button></div>`
      : `<div class="pad cross" id="pad"><span class="sp"></span><button type="button" data-act="up" aria-label="위">▲</button><span class="sp"></span><button type="button" data-act="left" aria-label="왼쪽">◀</button><button type="button" data-act="down" aria-label="아래">▼</button><button type="button" data-act="right" aria-label="오른쪽">▶</button></div>`;
    view().innerHTML = `
      <div class="play">
        <div class="play-head"><a class="back" href="#home">← 게임 목록</a><h1>${g.name}</h1><span class="cat">${g.cat}</span></div>
        <div class="play-grid">
          <div class="stage-col">
            <div class="cabinet" style="--cw:${g.w}px;--ar:${g.id === 'blocks' ? 0.75 : 1}"><div class="screen"><canvas id="gameCanvas" aria-label="${g.name} 게임 화면"></canvas><div class="overlay" id="ov"></div></div></div>
            ${pad}
          </div>
          <aside class="side">
            <div class="panel score-panel">
              <div class="score-line"><span class="lbl">SCORE</span><b class="num big" id="curScore">0</b></div>
              <div class="score-line"><span class="lbl">MY BEST</span><b class="num" id="myBest">${Hub.user ? '…' : '로그인 필요'}</b></div>
              <div class="ctrl-row"><button class="btn" type="button" id="btnPause">일시정지</button><button class="btn" type="button" id="btnRestart">처음부터</button></div>
              <button class="btn btn-sm btn-ghost music-btn" type="button" id="btnMusic" hidden></button>
              ${Hub.user ? `<div class="reset-line">${resetHTML(id, '내 ' + g.name + ' 전적 초기화')}</div>` : ''}
            </div>
            ${SOC.chatHTML()}
            <div class="panel player-card" id="playerCard"></div>
            <div class="panel"><h3>조작법</h3><dl class="keys">${g.keys.map(([k, d]) => `<dt><kbd>${k}</kbd></dt><dd>${d}</dd>`).join('')}</dl></div>
            <div class="panel"><h3>${g.name} 랭킹 <small>TOP 10</small></h3><ol class="rank" id="gameRank"><li class="empty">불러오는 중…</li></ol></div>
          </aside>
        </div>
        ${SOC.commentsHTML(g.name)}
      </div>`;
    if (!Hub.user) $('#myBest').style.fontSize = '9px';
    mountSocial(id);

    const hooks = {
      onScore: s => { const el = $('#curScore'); if (el) el.textContent = fmt(s); },
      onState: st => {
        if (!session) return; session.state = st; renderOverlay(); $('#btnPause').textContent = st === 'paused' ? '계속하기' : '일시정지';
        if (st === 'paused' || st === 'over') BGM.pause(); else if (st === 'playing') BGM.play();
      },
      onOver: res => finish(res),
      onToast: m => toast(m)
    };
    session = { id, state: 'ready', result: null, save: null };
    session.inst = window.GoGames[id].create($('#gameCanvas'), hooks);
    renderOverlay(); refreshBest(); refreshGameRank(); renderPlayerCard();
    // 배경음악 버튼 (bgm 파일이 있을 때만 보임)
    const musicBtn = $('#btnMusic');
    const syncMusic = () => { if (!musicBtn.isConnected) return; musicBtn.hidden = !BGM.ready; musicBtn.textContent = BGM.isMuted() ? '♪ 음악 켜기' : '♪ 음악 끄기'; };
    musicBtn.addEventListener('click', () => { BGM.toggleMute(); syncMusic(); });
    cleanups.push(BGM.onChange(syncMusic)); syncMusic();
    cleanups.push(() => BGM.stop());

    $('#btnPause').addEventListener('click', () => { if (session.state === 'ready') startGame(); else session.inst.togglePause(); });
    $('#btnRestart').addEventListener('click', () => {
      if (session.state === 'playing' || session.state === 'paused') { cleanup(); renderPlay(id); startGame(); }
      else startGame();
    });

    // 터치 패드 (누르고 있으면 반복)
    $$('#pad [data-act]').forEach(b => {
      let t1 = 0, t2 = 0;
      const stop = () => { clearTimeout(t1); clearInterval(t2); };
      b.addEventListener('pointerdown', e => {
        e.preventDefault();
        const act = b.dataset.act;
        if (session.state === 'ready' || session.state === 'over') { startGame(); return; }
        session.inst.action(act);
        if (id === 'blocks' && ['left', 'right', 'down'].includes(act)) t1 = setTimeout(() => { t2 = setInterval(() => session && session.inst.action(act), 70); }, 200);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
      cleanups.push(stop);
    });
    // 화면 밀기
    cleanups.push(P.swipe($('#gameCanvas'), dir => {
      if (!session || session.state !== 'playing') return;
      session.inst.action(id === 'blocks' && dir === 'down' ? 'drop' : dir);
    }));
    cleanups.push(() => { if (session) { session.inst.destroy(); session = null; } });
  }

  /* ---------- 보드게임 화면 (바둑·오목·장기·체스·알까기·숫자 코드) ----------
   * 게임 폴더의 game.js 가 GoBoard 약속을 따름:
   *   start({mode:'ai'|'local', level}), press(buttonId), hooks.onTurn / onButtons / onOver({winner:0|1|-1, message})
   * 컴퓨터와 둘 때 사람은 항상 먼저 두는 쪽(0). 둘이서 한 기기로 둔 판은 포인트 없이 기록만 남음. */
  const LEVEL_NAME = { easy: '쉬움', normal: '보통', hard: '어려움' };
  function renderBoardPlay(id) {
    const g = gameById(id), cfg = SET.get(id); current = 'play'; setNav('home');
    BGM.load(id);
    const sides = (cfg.sides || '선 · 후').split('/')[0].split('·').map(x => x.trim());
    view().innerHTML = `
      <div class="play board-play">
        <div class="play-head"><a class="back" href="#home">← 게임 목록</a><h1>${g.name}</h1><span class="cat">${g.cat}</span></div>
        <div class="play-grid">
          <div class="stage-col">
            <div class="cabinet${(cfg.ar || 1) > 1.2 ? ' wide' : ''}${cfg.stepLevels ? ' steps' : ''}" data-g="${g.id}" style="--cw:${g.w}px;--ar:${cfg.ar || 1}"><div class="screen"><canvas id="gameCanvas" aria-label="${g.name} 게임 화면"></canvas><div class="overlay" id="ov"></div></div></div>
          </div>
          <aside class="side">
            <div class="panel turn-panel">
              <div class="turn-line"><i class="turn-dot" id="turnDot"></i><b id="turnText">대국 방식을 골라 주세요</b></div>
              <div class="turn-sub small" id="turnSub">${esc(sides.join(' vs '))}</div>
              <div class="board-btns" id="boardBtns"></div>
              <div class="ctrl-row"><button class="btn" type="button" id="btnResign" disabled>${cfg.resignLabel || '기권'}</button><button class="btn" type="button" id="btnRestart">처음부터</button></div>
              <button class="btn btn-sm btn-ghost music-btn" type="button" id="btnMusic" hidden></button>
              ${Hub.user ? `<div class="reset-line">${resetHTML(id, '내 ' + g.name + ' 전적 초기화')}</div>` : ''}
            </div>
            ${SOC.chatHTML()}
            <div class="panel player-card" id="playerCard"></div>
            <div class="panel"><h3>조작법</h3><dl class="keys">${g.keys.map(([k, d]) => `<dt><kbd>${k}</kbd></dt><dd>${d}</dd>`).join('')}</dl></div>
            <div class="panel"><h3>${g.name} 랭킹 <small>${cfg.rankSub || '이긴 난이도 TOP 10'}</small></h3><ol class="rank" id="gameRank"><li class="empty">불러오는 중…</li></ol></div>
          </aside>
        </div>
        ${SOC.commentsHTML(g.name)}
      </div>`;
    const hooks = {
      onTurn: t => {
        const el = $('#turnText'), dot = $('#turnDot'); if (!el) return;
        el.textContent = t.text || '';
        dot.className = 'turn-dot' + (t.side === 0 ? ' s0' : t.side === 1 ? ' s1' : '');
      },
      onButtons: list => {
        const box = $('#boardBtns'); if (!box) return;
        box.innerHTML = (list || []).map(b => `<button class="btn btn-sm" type="button" data-press="${esc(b.id)}" ${b.disabled ? 'disabled' : ''}>${esc(b.label)}</button>`).join('');
      },
      onState: st => {
        if (!session) return; session.state = st; renderOverlay();
        const rb = $('#btnResign'); if (rb) { rb.disabled = st !== 'playing'; rb.textContent = SET.get(session.id).resignLabel || '기권'; rb.classList.remove('btn-danger'); }
        if (st === 'over') BGM.pause(); else if (st === 'playing') BGM.play();
      },
      onOver: res => finishBoard(res),
      onToast: m => toast(m),
      onMove: m => { if (session && session.net) session.net.ch.send({ t: 'mv', m }); }   // 온라인: 내가 둔 수를 상대에게
    };
    mountSocial(id);
    session = { id, board: true, state: 'ready', mode: 'ai', level: 'normal', result: null, save: null };
    try { const last = JSON.parse(localStorage.getItem('gogo_board_pick') || '{}'); if (last.mode && last.mode !== 'online' && !(cfg.noLocal && last.mode === 'local')) { session.mode = last.mode; session.level = last.level || 'normal'; } } catch (e) { /* noop */ }
    // v61: 단계는 게임마다 따로 기억 · 이 게임에 없는 단계면 바꿈 (예전 쉬움·보통·어려움 → 1·2·3단계)
    { const AL = cfg.aiLevels || ['easy', 'normal', 'hard']; let lv = session.level; try { const g = localStorage.getItem('gogo_lv_' + id); if (g) lv = g; } catch (e) { /* noop */ }
      if (!AL.includes(lv)) { const OLD = { easy: 'l1', normal: 'l2', hard: 'l3' }; lv = AL.includes(OLD[lv]) ? OLD[lv] : AL.includes(cfg.defaultLevel) ? cfg.defaultLevel : AL[Math.min(1, AL.length - 1)]; }
      session.level = lv; fixLockedLevel(cfg); }
    if (cfg.unlockFree) loadBeaten(id);
    if (cfg.players) { session.players = 2; try { const n = +localStorage.getItem('gogo_players_' + id); if (cfg.players.includes(n)) session.players = n; } catch (e) { /* noop */ } }
    if (cfg.subModes) { session.sub = cfg.subModes[0][0]; try { const v = localStorage.getItem('gogo_sub_' + id); if (cfg.subModes.some(m => m[0] === v)) session.sub = v; } catch (e) { /* noop */ } }   // v49: 둘이서·온라인의 '방식' (예: 닷지 협동/대결)
    session.inst = window.GoGames[id].create($('#gameCanvas'), hooks); session.hooks = hooks;
    renderOverlay(); refreshGameRank(); renderBoardCard();
    const musicBtn = $('#btnMusic');
    const syncMusic = () => { if (!musicBtn.isConnected) return; musicBtn.hidden = !BGM.ready; musicBtn.textContent = BGM.isMuted() ? '♪ 음악 켜기' : '♪ 음악 끄기'; };
    musicBtn.addEventListener('click', () => { BGM.toggleMute(); syncMusic(); });
    cleanups.push(BGM.onChange(syncMusic)); syncMusic();
    cleanups.push(() => BGM.stop());

    $('#boardBtns').addEventListener('click', e => { const b = e.target.closest('[data-press]'); if (b && !b.disabled && session) session.inst.press(b.dataset.press); });
    // 기권: 실수 방지로 두 번 눌러야 함
    let resignTimer = 0;
    const rb = $('#btnResign');
    rb.addEventListener('click', () => {
      if (!session || session.state !== 'playing') return;
      if (!rb.classList.contains('btn-danger')) {
        rb.classList.add('btn-danger'); rb.textContent = '한 번 더 누르면 ' + (cfg.resignLabel || '기권');
        resignTimer = setTimeout(() => { if (rb.isConnected) { rb.classList.remove('btn-danger'); rb.textContent = cfg.resignLabel || '기권'; } }, 3000);
        return;
      }
      clearTimeout(resignTimer);
      if (session.mode === 'online' && session.net && !cfg.netRoom) netEarly(session, { id: Hub.clientId, nick: netNick(), uid: Hub.user ? Hub.user.id : null }, 'resign');   // v68 5초 안에 기권 → 무효
      session.inst.press('resign');
    });
    cleanups.push(() => clearTimeout(resignTimer));
    $('#btnRestart').addEventListener('click', () => { cleanup(); renderPlay(id); });
    cleanups.push(() => { netLeave(); if (session && session.lobby) { session.lobby.ch.leave(); session.lobby = null; } });
    cleanups.push(() => { if (session) { session.inst.destroy(); session = null; } });
  }

  /* ---------- 보드게임 온라인 대결 (방 코드, 2명) ----------
   * 방장 = 먼저 들어온 사람. 판마다 선/후를 번갈아 맡음. 수는 { t:'mv', m } 로 주고받음. */
  const NET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let netGuest = '손님' + (1000 + Math.random() * 9000 | 0);
  const netNick = () => (Hub.user ? Hub.user.nickname : netGuest);
  function netLobby() {
    if (!session || session.lobby) return;
    const s = session;
    s.lobby = { rooms: [] };
    s.lobby.ch = Hub.channel('blobby-' + s.id, {
      onPeers(list) { s.lobby.rooms = list.filter(r => r && r.code); if (session === s && s.mode === 'online' && !s.net && s.state !== 'playing') renderOverlay(); },
      onMsg() {}, onError() { toast('실시간 서버에 연결하지 못했어요.'); }
    });
  }
  function netAdvertise() {
    const s = session, n = s && s.net; if (!n || !s.lobby || n.hostId !== Hub.clientId) return;
    s.lobby.ch.track({ code: n.code, nick: netNick(), count: n.peers.length, status: s.state === 'playing' ? 'playing' : 'waiting', at: n.joinedAt });
  }
  function netJoin(code) {
    netLeave();
    const s = session, n = s.net = { code, peers: [], hostId: Hub.clientId, joinedAt: Date.now(), round: 0, side: 0, oppId: null, oppNick: '' };
    n.ch = Hub.channel('broom-' + s.id + '-' + code, {
      onPeers: list => netPeers(s, list),
      onMsg: m => netMsg(s, m),
      onError() { toast('방에 연결하지 못했어요.'); }
    });
    netTrack();
    renderOverlay();
    const max = netMax();
    setTimeout(() => {
      if (session !== s || s.net !== n) return;
      if (!n.peers.slice(0, max).some(p => p.id === Hub.clientId) && n.peers.length >= max) { toast('방이 꽉 찼어요. (최대 ' + max + '명)'); netLeave(); renderOverlay(); }
    }, 1500);
  }
  // 'room' 방식(숫자 코드·배구·격투): 최대 인원 = 고를 수 있는 가장 큰 인원
  const netMax = () => { const cfg = SET.get(session.id) || {}; return cfg.netRoom ? Math.max(...(cfg.players || [2])) : 2; };
  function netTrack() {
    const n = session && session.net; if (!n) return;
    n.ch.track({ id: Hub.clientId, nick: netNick(), avatar: Hub.user ? Hub.user.avatar : null, joinedAt: n.joinedAt, players: session.players || 2, sub: session.sub || null });
  }
  function netLeave() {
    const s = session, n = s && s.net; if (!n) return;
    try { n.ch.leave(); } catch (e) { /* noop */ }
    if (s.lobby) try { s.lobby.ch.untrack(); } catch (e) { /* noop */ }
    s.net = null;
  }
  function netPeers(s, list) {
    const n = s.net; if (!n || session !== s) return;
    n.peers = list.filter(p => p && p.id).sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    n.hostId = n.peers.length ? n.peers[0].id : Hub.clientId;
    // 대국 중 상대가 나가면 내 승리
    if (s.state === 'playing' && n.oppId && !n.peers.some(p => p.id === n.oppId)) { if (!netEarly(s, n.opp || { id: n.oppId, nick: n.oppNick }, 'left')) toast('상대가 나갔어요.'); s.inst.remote({ resign: 1, left: 1 }); }
    if (n.roster && s.state === 'playing') n.roster.forEach(r => {
      if (r.id !== Hub.clientId && !r.gone && !n.peers.some(p => p.id === r.id)) { r.gone = true; if (!netEarly(s, r, 'left')) toast(r.nick + ' 님이 나갔어요.'); s.inst.remote({ left: r.id, wasHost: r.id === n.roster[0].id }); }
    });
    netAdvertise();
    if (s.state !== 'playing') renderOverlay();
  }
  function netMsg(s, m) {
    if (!m || session !== s || !s.net) return;
    if (m.t === 'start') { if (m.roster) netStartRoom(m); else netStart(m.hostSide); }
    else if (m.t === 'mv' && s.state === 'playing') {
      if (m.m && m.m.resign && !m.m.left && s.net.oppId && !(SET.get(s.id) || {}).netRoom) netEarly(s, s.net.opp || { id: s.net.oppId, nick: s.net.oppNick }, 'resign');   // v68 상대가 5초 안에 기권
      s.inst.remote(m.m);
    }
  }
  /* v68 무단 이탈: 온라인 대결 시작 5초(Hub.QUIT_SEC) 안에 누가 나가거나(창 닫기·방 나가기) 기권하면 → 그 판은 무효(승패·무승부·포인트 없음)
   *  + 관리자만 보는 '무단 이탈' 기록 한 줄. 남은 사람 중 맨 앞 사람(회원) 화면이 남김. 내가 기권했는데 상대가 모두 손님이면 내 화면이 남김 */
  function netEarly(s, who, kind) {
    const n = s && s.net; if (!n || n.early || !n.startAt || s.state !== 'playing' || !who) return false;
    const ms = Date.now() - n.startAt; if (ms >= (Hub.QUIT_SEC || 5) * 1000) return false;
    const me = who.id === Hub.clientId, e = n.early = { id: who.id, nick: who.nick || '', uid: who.uid || null, kind, sec: ms / 1000, me };
    const humans = n.roster ? n.roster.map(r => ({ id: r.id, uid: r.uid || null })) : [{ id: Hub.clientId, uid: Hub.user ? Hub.user.id : null }, { id: n.oppId, uid: n.opp ? n.opp.uid || null : null }];
    const stay = humans.filter(h => h.id !== who.id && !(n.roster || []).some(r => r.id === h.id && r.gone && r.id !== who.id));
    const reporter = me ? (stay.some(h => h.uid) ? null : Hub.clientId) : (stay.find(h => h.uid) || {}).id;
    if (reporter === Hub.clientId && Hub.user && Hub.logQuit) Hub.logQuit({ game_id: s.id, quitter: e.uid, quitter_nick: e.nick, kind, sec: e.sec, extra: { code: n.code, players: humans.length, mode: n.roster ? 'room' : 'pair' } });
    toast(me ? `시작 ${Hub.QUIT_SEC || 5}초 안에 기권해서 이 판은 무효예요.` : `${who.nick || '상대'} 님이 ${Hub.QUIT_SEC || 5}초 안에 ${kind === 'resign' ? '기권해' : '나가'}서 이 판은 무효예요. (승패·포인트 없음)`);
    // room 방식(배구·격투 등): 남은 사람이 나 혼자면 컴퓨터와 계속하지 않고 바로 '무효 판'으로 끝냄
    if (n.roster && !me && n.roster.every(r => r.id === Hub.clientId || r.gone || r.id === who.id) && s.hooks) setTimeout(() => {
      if (session !== s || s.state !== 'playing' || !s.net || s.net.early !== e) return;
      try { s.inst.destroy(); } catch (er) { /* noop */ }
      s.inst = window.GoGames[s.id].create($('#gameCanvas'), s.hooks);
      finishBoard({ winner: -1, duration_sec: Math.round(e.sec), message: '' });
    }, 0);
    return true;
  }
  function netStart(hostSide) {
    const s = session, n = s.net; if (!n) return;
    const players = n.peers.slice(0, 2); if (!players.some(p => p.id === Hub.clientId)) return;
    n.side = n.hostId === Hub.clientId ? hostSide : 1 - hostSide;
    const opp = players.find(p => p.id !== Hub.clientId) || {};
    n.oppId = opp.id || null; n.oppNick = opp.nick || '상대'; n.opp = opp.id ? { id: opp.id, nick: opp.nick || '상대', uid: opp.uid || null } : null;
    n.startAt = Date.now(); n.early = null;   // v68
    s.result = null; s.save = null;
    s.inst.start({ mode: 'online', side: n.side, oppAvatar: opp.avatar || null, oppNick: n.oppNick }); BGM.restart();
    netAdvertise();
  }
  // 'room' 방식: 방장이 들어온 순서대로 자리를 정해 모두에게 보냄 (빈자리는 방장 기기의 컴퓨터)
  function netStartRoom(m) {
    const s = session, n = s.net; if (!n) return;
    const me = m.roster.findIndex(r => r.id === Hub.clientId); if (me < 0) return;
    n.roster = m.roster.map(r => ({ ...r })); n.side = null; n.oppId = null;
    n.oppNick = m.roster.filter(r => r.id !== Hub.clientId).map(r => r.nick).join(', ');
    n.startAt = Date.now(); n.early = null;   // v68
    s.result = null; s.save = null;
    s.inst.start({ mode: 'online', players: m.players, sub: m.sub || null, seed: m.seed, roster: m.roster, me, host: m.roster[0].id === Hub.clientId, level: 'normal' }); BGM.restart();
    netAdvertise();
  }
  function netHostStart() {
    const n = session && session.net; if (!n || n.hostId !== Hub.clientId || n.peers.length < 2) return;
    const cfg = SET.get(session.id) || {};
    if (cfg.netRoom) {
      const np = session.players || 2, humans = n.peers.slice(0, netMax());
      if (humans.length > np) { toast('사람이 ' + humans.length + '명이에요. 인원을 ' + humans.length + ' 이상으로 골라 주세요.'); return; }
      const m = { t: 'start', seed: (Math.random() * 2147483647) | 0, players: np, sub: session.sub || null, roster: humans.map(p => ({ id: p.id, nick: p.nick, avatar: p.avatar || null, uid: p.uid || null })) };
      n.ch.send(m); netStartRoom(m); return;
    }
    const hostSide = n.round++ % 2;
    n.ch.send({ t: 'start', hostSide });
    netStart(hostSide);
  }
  // 온라인 대기 화면 (오버레이 안)
  const playersLabel = (cfg, n) => (cfg.teamLabels && cfg.teamLabels[n]) || n + '명';
  function netPanelHTML(cfg) {
    const s = session, n = s.net;
    const sides = (cfg.sides || '선 · 후').split('/')[0].split('·').map(x => x.trim());
    if (!n) {
      const rooms = (s.lobby ? s.lobby.rooms : []).filter(r => r.status !== 'playing' && r.count < 2);
      return `<div class="net-box">
        <button class="btn btn-primary" type="button" data-net="create">방 만들기</button>
        <form class="code-row" data-net-form><input maxlength="4" placeholder="코드 4자리" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="방 코드"><button class="btn" type="submit">입장</button></form>
        ${rooms.length ? `<div class="net-rooms">${rooms.slice(0, 5).map(r => `<button class="btn btn-sm" type="button" data-net-join="${esc(r.code)}">${esc(r.nick)}의 방 · ${esc(r.code)}</button>`).join('')}</div>` : '<p class="ov-hint">열린 방이 없으면 방을 만들고 코드를 친구에게 알려 주세요.</p>'}
        <button class="btn btn-sm" type="button" data-net="back">← 뒤로 (AI 대전 고르기)</button>
      </div>`;
    }
    const host = n.hostId === Hub.clientId, two = n.peers.length >= 2, max = netMax();
    const mySide = host ? n.round % 2 : 1 - n.round % 2;
    const hostPeer = n.peers.find(p => p.id === n.hostId) || {}, np = host ? (session.players || 2) : (hostPeer.players || 2);
    return `<div class="net-box">
      <div class="net-code">방 코드 <b class="num">${esc(n.code)}</b></div>
      ${host ? `<button class="btn btn-primary" type="button" data-net="start" ${two ? '' : 'disabled'}>${two ? '시작 ▶' : '친구를 기다리는 중…'}</button>` : `<p class="ov-hint">${two ? '방장이 시작하면 바로 시작돼요.' : '방장을 기다리는 중…'}</p>`}
      <ul class="net-peers">${n.peers.slice(0, max).map(p => `<li>${esc(p.nick)}${p.id === Hub.clientId ? ' <small>(나)</small>' : ''}${p.id === n.hostId ? ' <small>방장</small>' : ''}</li>`).join('')}${n.peers.length < max ? `<li class="wait">${two ? '더 들어올 수 있어요…' : '상대를 기다리는 중…'}</li>` : ''}</ul>
      ${cfg.netRoom ? `<p class="ov-hint">방장 설정: <b>${esc(playersLabel(cfg, np))}</b>${np > n.peers.length ? ' · 빈자리는 컴퓨터' : ''}</p>` : two ? `<p class="ov-hint">이번 판: 나는 <b>${esc(sides[mySide] || (mySide ? '후' : '선'))}</b> (판마다 바뀌어요)</p>` : ''}
      <button class="btn btn-sm" type="button" data-net="leave">방 나가기</button>
    </div>`;
  }
  function renderBoardCard() {
    const el = $('#playerCard'); if (!el || !session) return;
    const cfg = SET.get(session.id), u = Hub.user, pts = cfg.points, ls = cfg.levelScore || {};
    el.innerHTML = `
      <div class="pc-top">${avCanvas(u ? u.avatar : {}, 4, 'full', 'pc-av')}
        <div class="pc-info"><b>${u ? esc(u.nickname) : '손님'}</b>${u ? `<span class="lv">Lv.${Hub.levelInfo(u.earned).level}</span><span class="num pc-pt">${fmt(u.points)}P</span>` : '<span class="small">로그인하면 포인트를 모아요</span>'}</div></div>
      <dl class="rules">${cfg.cardRules ? cfg.cardRules() : `
        <dt>포인트</dt><dd>${(session.players || 2) > 2 && cfg.pointsByRank ? rankPointText(cfg, session.players) : `컴퓨터에게 승리 <b class="plus">+${pts.win}P</b> · 패배 <b class="minus">${pts.lose}P</b> · 무승부 0P`}</dd>
        <dt>랭킹 점수</dt><dd>${cfg.stepLevels ? `이긴 단계 × 100 · 1단계 ${ls.l1} … ${cfg.stepLevels}단계 ${fmt(ls['l' + cfg.stepLevels])}${ls['l' + (cfg.stepLevels + 1)] ? ` · AI 대전 ${fmt(ls['l' + (cfg.stepLevels + 1)])}` : ''} (랭킹에는 'N단계'로 보여요)` : `이긴 난이도 · 쉬움 ${ls.easy || 100} / 보통 ${ls.normal || 200} / 어려움 ${ls.hard || 300}`}</dd>
        ${cfg.noLocal ? '' : '<dt>오프라인</dt><dd>한 기기로 번갈아 두기 · 포인트 없음</dd>'}
        ${cfg.online ? `<dt>온라인</dt><dd>방 코드로 다른 기기 친구와 · 승리 <b class="plus">+${pts.win}P</b> · 패배 <b class="minus">${pts.lose}P</b></dd>` : ''}`}
      </dl>`;
    AV.paintAll(el);
  }
  function renderBoardOverlay() {
    const ov = $('#ov'); if (!ov || !session) return;
    const g = gameById(session.id), cfg = SET.get(session.id), st = session.state;
    // 방 목록이 바뀌어 화면을 다시 그려도, 입력 중인 방 코드는 지우지 않음
    const codeIn = ov.querySelector('[data-net-form] input'), keep = codeIn ? { v: codeIn.value, f: document.activeElement === codeIn } : null;
    ov.hidden = st === 'playing';
    const np = session.players || 2;
    if (st === 'ready') {
      const lvName = l => (cfg.levelNames && cfg.levelNames[l]) || LEVEL_NAME[l];
      fixLockedLevel(cfg);
      const lv = (cfg.aiLevels || ['easy', 'normal', 'hard']).map(l => { const open = levelOpen(cfg, session.id, l), n = stepOf(l), ai = cfg.stepLevels && n > cfg.stepLevels;
        return `<button class="btn ${session.mode === 'ai' && session.level === l ? 'btn-sun' : ''}${open ? '' : ' locked'}${ai ? ' ai-lv' : ''}" type="button" data-pick="ai:${l}" ${open ? '' : `disabled title="${ai ? cfg.stepLevels + '단계' : (n - 1) + '단계'}를 이기면 열려요"`}>${lvName(l)}${open ? '' : '<small>잠김</small>'}</button>`; }).join('');
      const openTo = Math.min((cfg.aiLevels || []).length, Math.max(cfg.unlockFree, beaten(session.id) + 1));   // AI 대전이 없으면 10단계까지
      const lockNote = cfg.unlockFree ? `<p class="lv-note">1~${cfg.unlockFree}단계 자유 · 이기면 다음 단계가 열려요 · 지금 <b>${openTo > cfg.stepLevels ? 'AI 대전' : openTo + '단계'}</b>까지</p>` : '';
      const subName = v => ((cfg.subModes || []).find(m => m[0] === v) || [, ''])[1];
      const inRoom = session.mode === 'online' && session.net, roomHost = inRoom && session.net.hostId === Hub.clientId;   // 방 안: 꼭 필요한 것만 (시작 버튼이 화면 밖으로 밀리지 않게)
      ov.innerHTML = `<div class="ov-box ov-board"><div class="ov-title">${g.name}</div>
        ${inRoom ? '' : `<p class="ov-goal">${esc(g.blurb)}</p>`}
        <div class="mode-pick">
          ${inRoom ? '' : `<div class="mode-row"><span class="mode-lbl">${cfg.aiLabel || 'AI 대전'}</span><div class="mode-btns${cfg.stepLevels ? ' steps' : ''}">${lv}</div></div>${lockNote}`}
          ${cfg.noLocal || inRoom ? '' : `<div class="mode-row"><span class="mode-lbl">오프라인</span><div class="mode-btns"><button class="btn ${session.mode === 'local' ? 'btn-sun' : ''}" type="button" data-pick="local">${np > 2 ? np + '명이' : '둘이서'} 한 기기</button></div></div>`}
          ${cfg.online && !inRoom ? `<div class="mode-row"><span class="mode-lbl">온라인</span><div class="mode-btns"><button class="btn ${session.mode === 'online' ? 'btn-sun' : ''}" type="button" data-pick="online">${cfg.onlineBtn || '다른 기기 친구와'}</button></div></div>` : ''}
          ${cfg.subModes && session.mode !== 'ai' && (!inRoom || roomHost) ? `<div class="mode-row"><span class="mode-lbl">방식</span><div class="mode-btns">${cfg.subModes.map(([v, t]) => `<button class="btn ${session.sub === v ? 'btn-sun' : ''}" type="button" data-sub="${v}">${esc(t)}</button>`).join('')}</div></div>` : ''}
          ${cfg.players && (!inRoom || roomHost) ? `<div class="mode-row"><span class="mode-lbl">인원</span><div class="mode-btns">${cfg.players.map(n => `<button class="btn ${np === n ? 'btn-sun' : ''}" type="button" data-players="${n}">${esc(playersLabel(cfg, n))}</button>`).join('')}</div></div>` : ''}
        </div>
        ${session.mode === 'online' ? netPanelHTML(cfg) : `<button class="btn btn-primary" type="button" data-ov="start">${cfg.startLabel ? (session.mode === 'local' ? (np > 2 ? np + '명' : '둘이서') : '') : session.mode === 'local' ? (np > 2 ? np + '명' : '둘이서') + (cfg.subModes ? ' · ' + esc(subName(session.sub).split(' ')[0]) : '') : lvName(session.level) + (np > 2 ? ' · ' + np + '명' : '')} 시작 ▶</button>`}
        <p class="ov-note">${cfg.noteText ? cfg.noteText(session.mode) : session.mode === 'local' ? '포인트 없이 기록만 남아요' : session.mode === 'online' ? `온라인 승리 +${cfg.points.win}P / 패배 ${cfg.points.lose}P` : rankPointText(cfg, np)}${Hub.user ? '' : ' · 손님 플레이'}</p></div>`;
    } else if (st === 'over') {
      const r = session.result || {}, s = session.save || {};
      let note = '';
      if (session.mode === 'ai' || session.mode === 'online') {
        if (s.status === 'saving') note = '<p class="ov-note">기록 저장 중…</p>';
        else if (s.status === 'saved' && s.queued) note = '<p class="ov-note">지금은 오프라인이에요. 연결되면 자동으로 저장돼요.</p>';
        else if (s.status === 'saved') note = `<p class="ov-note ${s.gained > 0 ? 'ok' : ''}">${pointText(s.gained, s.delta)} · 전적에 저장했어요</p>`;
        else if (s.status === 'error') note = `<p class="ov-note bad">${esc(s.msg)}</p>`;
        else if (s.status === 'void') note = '<p class="ov-note">승리·패배·무승부와 포인트 없이 끝났어요. 전적에 남지 않아요.</p>';
        else if (s.status === 'guest') note = `<p class="ov-note">로그인하면 이 기록과 포인트(${r.points_delta > 0 ? '+' : ''}${r.points_delta || 0}P)가 남아요.</p><button class="btn btn-primary" type="button" data-ov="save">로그인하고 기록 저장</button>`;
      } else if (s.status === 'saved') note = `<p class="ov-note">${((r.extra || {}).players || 2) > 2 ? (r.extra || {}).players + '명이' : '둘이서'} 한 판 · 전적에 기록했어요</p>`;
      const ex = r.extra || {}, multi = (ex.players || 2) > 2 && !cfg.teamLabels;
      const title = r.title ? r.title : session.mode === 'local' ? '대국 끝!' : multi ? (ex.rank === 1 ? '1등!' : ex.rank + '등') : r.result === 'win' ? '승리!' : r.result === 'lose' ? '아쉬워요!' : '무승부';
      ov.innerHTML = `<div class="ov-box">
        ${avCanvas(Hub.user ? Hub.user.avatar : {}, 4, 'full', 'ov-avatar')}
        <div class="ov-title">${title}</div>
        <p class="ov-goal">${esc(r.message || '')}</p>
        <p class="ov-hint">${session.mode === 'local' ? (multi ? ex.players + '명이서' : '둘이서') : session.mode === 'online' ? '온라인 · ' + esc(session.net ? session.net.oppNick : '상대') : (cfg.aiLabel ? cfg.aiLabel + ' ' : '컴퓨터 ') + ((cfg.levelNames && cfg.levelNames[session.level]) || LEVEL_NAME[session.level]) + (multi ? ' · ' + ex.players + '명' : '')} · ${r.moves ? r.moves + (cfg.category === 'sports' ? '랠리' : cfg.category === 'study' ? '단어' : '수') + ' · ' : ''}${dur(r.duration_sec || 0)}</p>
        ${note}
        ${session.mode === 'online' && session.net
          ? `<div class="ov-btns">${session.net.hostId === Hub.clientId ? `<button class="btn btn-sun" type="button" data-net="start" ${session.net.peers.length >= 2 ? '' : 'disabled'}>한 판 더 ▶</button>` : ''}<button class="btn" type="button" data-net="leave">방 나가기</button></div>${session.net.hostId === Hub.clientId ? '' : '<p class="ov-hint">방장이 한 판 더를 누르면 바로 시작돼요.</p>'}`
          : `<div class="ov-btns"><button class="btn btn-sun" type="button" data-ov="again">다시 하기</button><button class="btn" type="button" data-ov="menu">방식 바꾸기</button><a class="btn" href="#home">다른 게임</a></div>`}</div>`;
    } else ov.innerHTML = '';
    AV.paintAll(ov);
    if (st === 'ready' && session.mode === 'online' && session.net) ov.scrollTop = 0;   // 방 안: 맨 위(방 코드·시작 버튼)가 보이게
    if (keep) { const ni = ov.querySelector('[data-net-form] input'); if (ni) { ni.value = keep.v; if (keep.f) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } } }
    $$('[data-sub]', ov).forEach(b => b.addEventListener('click', () => {
      session.sub = b.dataset.sub; netTrack();
      try { localStorage.setItem('gogo_sub_' + session.id, session.sub); } catch (e) { /* noop */ }
      renderOverlay();
    }));
    $$('[data-players]', ov).forEach(b => b.addEventListener('click', () => {
      session.players = +b.dataset.players; netTrack();
      try { localStorage.setItem('gogo_players_' + session.id, String(session.players)); } catch (e) { /* noop */ }
      renderOverlay(); renderBoardCard();
    }));
    $$('[data-net]', ov).forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.net;
      if (a === 'create') netJoin(Array.from({ length: 4 }, () => NET_CODE[Math.random() * NET_CODE.length | 0]).join(''));
      else if (a === 'start') netHostStart();
      else if (a === 'leave') { netLeave(); session.state = 'ready'; renderOverlay(); }
      else if (a === 'back') {   // 온라인 대기 화면 → 처음 고르기 화면 (AI 대전)
        netLeave(); session.mode = 'ai';
        try { localStorage.setItem('gogo_board_pick', JSON.stringify({ mode: session.mode, level: session.level })); } catch (e) { /* noop */ }
        renderOverlay();
      }
    }));
    $$('[data-net-join]', ov).forEach(b => b.addEventListener('click', () => netJoin(b.dataset.netJoin)));
    const nf = $('[data-net-form]', ov);
    if (nf) nf.addEventListener('submit', e => {
      e.preventDefault();
      const code = nf.querySelector('input').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(code)) { toast('방 코드 4자리를 입력해 주세요.'); return; }
      netJoin(code);
    });
    $$('[data-pick]', ov).forEach(b => b.addEventListener('click', () => {
      const [m, l] = b.dataset.pick.split(':');
      if (m !== 'online') netLeave(); else netLobby();
      session.mode = m; if (l) session.level = l;
      try { localStorage.setItem('gogo_board_pick', JSON.stringify({ mode: session.mode, level: session.level })); if (l) localStorage.setItem('gogo_lv_' + session.id, l); } catch (e) { /* noop */ }
      renderOverlay();
    }));
    $$('[data-ov]', ov).forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.ov;
      if (a === 'start' || a === 'again') startGame();
      else if (a === 'menu') { const id = session.id; cleanup(); renderPlay(id); }
      else if (a === 'save') openAuth('login', () => { if (session && session.save && session.save.status === 'guest') saveResult(); });
    }));
  }
  // 등수별 포인트 안내 (예: 1등 +4P · 2등 +2P · 3등 0P · 4등 -1P)
  function rankPointText(cfg, n) {
    if (n <= 2 || !cfg.pointsByRank || !cfg.pointsByRank[n]) return `${cfg.vsText || '내가 먼저 둬요'} · 승리 +${cfg.points.win}P / 패배 ${cfg.points.lose}P`;
    return '컴퓨터 ' + (n - 1) + '명과 · ' + cfg.pointsByRank[n].map((p, i) => `${i + 1}등 ${p > 0 ? '+' : ''}${p}P`).join(' · ');
  }
  function finishBoard(res) {
    if (!session) return;
    session.state = 'over'; BGM.pause();
    const rb = $('#btnResign'); if (rb) { rb.disabled = true; rb.textContent = SET.get(session.id).resignLabel || '기권'; rb.classList.remove('btn-danger'); }
    const cfg = SET.get(session.id), ai = session.mode === 'ai', online = session.mode === 'online' && session.net;
    let result = null, delta = 0, score = 0;
    if (cfg.scoreRank) {   // 점수 랭킹 게임 (예: 하늘 편대): 게임이 준 점수·포인트 그대로 (둘이서 한 기기는 기록만)
      if (ai || online) { result = res.win ? 'win' : 'lose'; score = Math.max(0, Math.round(res.score || 0)); delta = Math.round(res.points || 0); }
    } else {
    const onlineWin = !online ? null : res.rank && res.players > 2 ? res.rank === 1 : res.win != null ? res.win : res.winner >= 0 ? res.winner === session.net.side : null;
    if (online && onlineWin != null) {
      const win = onlineWin;
      result = win ? 'win' : 'lose';
      delta = res.rank && res.players > 2 && cfg.pointsByRank && cfg.pointsByRank[res.players] ? (cfg.pointsByRank[res.players][res.rank - 1] || 0) : SET.pointsFor(session.id, win).delta;
      score = win ? ((cfg.levelScore || {}).online || (cfg.levelScore || {}).hard || 300) : 0;
    } else
    if (ai && res.rank && res.players > 2 && cfg.pointsByRank) {
      const table = cfg.pointsByRank[res.players] || [];
      delta = table[res.rank - 1] || 0; result = res.rank === 1 ? 'win' : 'lose';
      if (res.rank === 1) score = ((cfg.levelScore || {})[session.level] || 100) + (res.players - 2) * (cfg.playersBonus || 0);
    } else if (ai && res.winner === 0) { result = 'win'; delta = SET.pointsFor(session.id, true).delta; score = (cfg.levelScore || {})[session.level] || 100; }
    else if (ai && res.winner === 1) { result = 'lose'; delta = SET.pointsFor(session.id, false).delta; }
    }
    const early = online && session.net.early;   // v68 시작 5초 안에 누가 나가거나 기권 → 무효 (저장 안 함)
    if (early) { result = null; delta = 0; score = 0; }
    session.result = {
      game_id: session.id, score, duration_sec: res.duration_sec || 0, result, points_delta: delta,
      message: early ? (early.me ? `시작 ${Hub.QUIT_SEC || 5}초 안에 기권해서 무효예요.` : `${early.nick || '상대'} 님이 시작 ${Hub.QUIT_SEC || 5}초 안에 ${early.kind === 'resign' ? '기권해' : '나가'}서 무효예요.`) : res.message,
      moves: res.moves, title: early ? '무효 판' : res.title, void: !!early,
      extra: Object.assign({}, res.extra || {}, { mode: session.mode, level: ai ? session.level : null, winner: res.winner }, online ? { side: session.net.side } : {})
    };
    session.save = { status: early ? 'void' : Hub.user ? 'saving' : (ai || online ? 'guest' : 'none') };
    if (online) netAdvertise();
    renderOverlay();
    if (Hub.user && !early) saveResult();
    if (ai && cfg.records && res.record) saveRecord(session.id, session.level, res);
    if (ai && cfg.unlockFree && res.winner === 0) {   // v63 이기면 다음 단계 열림
      const n = stepOf(session.level);
      if (setBeaten(session.id, n)) { const next = (cfg.aiLevels || [])[n]; if (n >= cfg.unlockFree && n <= cfg.stepLevels) toast(!next ? `${n}단계 승리! 모든 단계를 깼어요` : n >= cfg.stepLevels ? `${n}단계 승리! AI 대전이 열렸어요` : `${n}단계 승리! ${n + 1}단계가 열렸어요`); }
    }
  }
  /* v63 단계 열기: 1~unlockFree 단계는 자유, 그 위는 바로 아래 단계를 이겨야 열림 (10단계를 이기면 AI 대전)
   *  이긴 가장 높은 단계 = max(이 기기 기록, 서버 최고 점수 ÷ 100). 랭킹 점수 = 이긴 단계 × 100 이라 서버 기록으로 알 수 있음 */
  const beatKey = id => 'gogo_beat_' + id + '_' + (Hub.user ? Hub.user.id : 'guest'), beatSrv = {};
  function beaten(id) { let v = 0; try { v = +localStorage.getItem(beatKey(id)) || 0; } catch (e) { /* noop */ } return Math.max(v, beatSrv[(Hub.user ? Hub.user.id : 'guest') + id] || 0); }
  function setBeaten(id, n) { if (n <= beaten(id)) return false; try { localStorage.setItem(beatKey(id), String(n)); } catch (e) { /* noop */ } return true; }
  async function loadBeaten(id) {
    if (!Hub.user) return;
    try { const b = await Hub.myBest(id), n = Math.floor((b || 0) / 100), k = Hub.user.id + id; if (n > (beatSrv[k] || 0)) { beatSrv[k] = n; if (session && session.id === id && session.state === 'ready') renderOverlay(); } } catch (e) { /* noop */ }
  }
  const stepOf = l => (window.GoBoard && window.GoBoard.step ? window.GoBoard.step(l) : 2);
  function levelOpen(cfg, id, l) { if (!cfg.unlockFree) return true; const n = stepOf(l); return n <= cfg.unlockFree || n <= beaten(id) + 1; }
  function fixLockedLevel(cfg) { if (!session || !cfg.unlockFree || levelOpen(cfg, session.id, session.level)) return; const AL = cfg.aiLevels || []; session.level = AL.filter(l => levelOpen(cfg, session.id, l)).pop() || AL[0]; }
  // v62 기보 저장 (머신러닝 준비): 로그인 + 서버 모드 + 컴퓨터와 둔 판만. 표가 없으면(SQL 전) 조용히 넘어감
  let recordOff = false;
  async function saveRecord(gid, level, res) {
    if (recordOff || Hub.mode !== 'online' || !Hub.user || !Hub._sb) return;
    const r = res.record || {}, mv = Array.isArray(r.moves) ? r.moves.slice(0, 1000) : [];
    if (mv.length < 2) return;
    const step = (window.GoBoard && window.GoBoard.step) ? window.GoBoard.step(level) : 2;
    const row = { game_id: gid, level: step, human_side: r.side ? 1 : 0, result: res.winner === 0 ? 'win' : res.winner === 1 ? 'lose' : 'draw',
      n_moves: Math.min(1000, mv.length), moves: mv, extra: r.extra || null, duration_sec: Math.max(0, Math.min(86400, Math.round(res.duration_sec || 0))), ver: 'v63' };
    try {
      const { error } = await Hub._sb.from('game_records').insert(row);
      if (error) { if (/relation|does not exist|schema cache|permission/i.test(error.message)) recordOff = true; console.warn('[gogo] 기보 저장 안 됨', error.message); }
    } catch (e) { /* noop */ }
  }

  function startGame() {
    if (!session) return;
    session.result = null; session.save = null;
    if (session.board) {
      if (session.mode === 'ai') fixLockedLevel(SET.get(session.id));   // v63 잠긴 단계로는 시작하지 않음
      session.inst.start({ mode: session.mode, level: session.level, players: session.players || 2, sub: session.sub || null }); BGM.restart();
      // 휴대폰: 시작하면 게임 화면이 화면 가운데로 오게 (가로로 돌렸을 때 위가 잘리지 않게)
      const cv = $('#gameCanvas'); if (cv && window.matchMedia && matchMedia('(pointer: coarse)').matches) setTimeout(() => { try { cv.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* noop */ } }, 80);
      return;
    }
    $('#curScore').textContent = '0';
    session.inst.start();
    BGM.restart();
  }
  // 게임 화면 오른쪽: 내 아바타 + 승리 조건 + 포인트 규칙
  function renderPlayerCard() {
    const el = $('#playerCard'); if (!el || !session) return;
    const cfg = SET.get(session.id), u = Hub.user, pts = cfg.points;
    el.innerHTML = `
      <div class="pc-top">${avCanvas(u ? u.avatar : {}, 4, 'full', 'pc-av')}
        <div class="pc-info"><b>${u ? esc(u.nickname) : '손님'}</b>${u ? `<span class="lv">Lv.${Hub.levelInfo(u.earned).level}</span><span class="num pc-pt">${fmt(u.points)}P</span>` : '<span class="small">로그인하면 포인트를 모아요</span>'}</div></div>
      <dl class="rules">
        <dt>승리 조건</dt><dd>${esc(cfg.goalText ? cfg.goalText() : '-')}</dd>
        <dt>포인트</dt><dd>승리 <b class="plus">+${pts.win}P</b> · 패배 <b class="minus">${pts.lose}P</b></dd>
      </dl>`;
    AV.paintAll(el);
  }

  function renderOverlay() {
    if (session && session.board) return renderBoardOverlay();
    const ov = $('#ov'); if (!ov || !session) return;
    const g = gameById(session.id), st = session.state;
    ov.hidden = st === 'playing';
    if (st === 'ready') {
      const cfg = SET.get(session.id);
      ov.innerHTML = `<div class="ov-box"><div class="ov-title">${g.name}</div>
        <p class="ov-goal">승리 조건 · <b>${esc(cfg.goalText())}</b><br>승리 +${cfg.points.win}P / 패배 ${cfg.points.lose}P</p>
        <button class="btn btn-sun" type="button" data-ov="start">시작하기 ▶</button>
        <p class="ov-hint">Enter · Space 또는 방향키로도 시작해요</p>
        ${Hub.user ? `<p class="ov-note">${esc(Hub.user.nickname)}님의 기록으로 저장돼요</p>` : '<p class="ov-note">지금은 손님 플레이예요. 끝난 뒤 로그인하면 그 판 기록도 저장할 수 있어요.</p>'}</div>`;
    } else if (st === 'paused') {
      ov.innerHTML = '<div class="ov-box"><div class="ov-title">일시정지</div><button class="btn btn-sun" type="button" data-ov="resume">계속하기</button><p class="ov-hint">P 또는 Esc</p></div>';
    } else if (st === 'over') {
      const r = session.result, s = session.save || {};
      let note = '';
      if (s.status === 'saving') note = '<p class="ov-note">기록 저장 중…</p>';
      else if (s.status === 'saved' && s.queued) note = '<p class="ov-note">지금은 오프라인이에요. 인터넷이 연결되면 이 기록이 자동으로 저장돼요.</p>';
      else if (s.status === 'saved') note = `${s.newBest ? '<span class="ov-best">NEW BEST!</span>' : ''}<p class="ov-note ${s.gained > 0 ? 'ok' : ''}">${pointText(s.gained, s.delta)} · 전적에 저장했어요</p>`;
      else if (s.status === 'error') note = `<p class="ov-note bad">${esc(s.msg)}</p>`;
      else if (s.status === 'guest') note = `<p class="ov-note">로그인하면 이 기록과 포인트(${r && r.result === 'win' ? '+' : ''}${r ? r.points_delta : 0}P)가 남아요.</p><button class="btn btn-primary" type="button" data-ov="save">로그인하고 기록 저장</button>`;
      const win = r && r.result === 'win', cfg = SET.get(session.id);
      ov.innerHTML = `<div class="ov-box">
        ${avCanvas(Hub.user ? Hub.user.avatar : {}, 4, 'full', 'ov-avatar')}
        <div class="ov-title">${win ? '승리!' : '아쉬워요!'}</div>
        <p class="ov-goal">${win ? '목표 달성' : '목표'} · ${esc(cfg.goalText())}</p>
        <div class="ov-score">${fmt(r ? r.score : 0)}</div>
        <p class="ov-hint">플레이 시간 ${dur(r ? r.duration_sec : 0)}</p>
        ${note}
        <div class="ov-btns"><button class="btn btn-sun" type="button" data-ov="again">다시 하기</button><a class="btn" href="#home">다른 게임</a></div></div>`;
    }
    AV.paintAll(ov);
    $$('[data-ov]', ov).forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.ov;
      if (a === 'start' || a === 'again') startGame();
      else if (a === 'resume') session.inst.togglePause();
      else if (a === 'save') openAuth('login', () => { if (session && session.save && session.save.status === 'guest') saveResult(); });
    }));
  }

  function finish(res) {
    if (!session) return;
    // 승패 판정과 포인트는 게임 폴더의 settings.js 규칙을 따름
    const cfg = SET.get(session.id), win = !!cfg.judge(res), pts = SET.pointsFor(session.id, win);
    session.result = { game_id: session.id, ...res, result: win ? 'win' : 'lose', points_delta: pts.delta };
    session.save = { status: Hub.user ? 'saving' : 'guest' };
    renderOverlay();
    if (Hub.user) saveResult();
  }
  async function saveResult() {
    const s = session; if (!s || !s.result) return;
    s.save = { status: 'saving' }; renderOverlay();
    try { const { message, moves, title, void: _void, ...rec } = s.result; const r = await Hub.submitScore(rec); s.save = { status: 'saved', ...r }; }
    catch (e) { s.save = { status: 'error', msg: e.message }; }
    if (session === s) { renderOverlay(); refreshBest(); refreshGameRank(); if (s.board) renderBoardCard(); }
  }
  async function refreshBest() {
    const el = $('#myBest'); if (!el || !session) return;
    if (!Hub.user) { el.textContent = '로그인 필요'; el.style.fontSize = '9px'; return; }
    el.style.fontSize = '';
    try { el.textContent = sfmt(session.id, await Hub.myBest(session.id)); } catch (e) { el.textContent = '-'; }
  }
  async function refreshGameRank() {
    const el = $('#gameRank'); if (!el || !session) return;
    try { fillRank(el, await Hub.leaderboard(session.id, 10), 'best_score', session.id); }
    catch (e) { el.innerHTML = '<li class="empty">랭킹을 불러오지 못했어요.</li>'; }
  }

  // 키보드
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', KeyX: 'rotate', KeyZ: 'rotateL', Space: 'drop' };
  document.addEventListener('keydown', e => {
    if (!session || session.board || !$('#authModal').hidden) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const st = session.state;
    if (tag === 'button' && (e.code === 'Enter' || e.code === 'Space') && st !== 'playing') return;
    if (e.code === 'KeyP' || (e.code === 'Escape' && (st === 'playing' || st === 'paused'))) { e.preventDefault(); session.inst.togglePause(); return; }
    const act = KEYMAP[e.code];
    if (st === 'ready' || st === 'over') {
      if (e.code === 'Enter' || e.code === 'Space' || (st === 'ready' && act)) { e.preventDefault(); startGame(); }
      return;
    }
    if (st === 'playing' && act) { e.preventDefault(); session.inst.action(act); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && session && !session.board && session.state === 'playing') session.inst.togglePause(); });
  // v34 (플레이어 입장 점검): 게임판이 화면에 보이는 동안 방향키·스페이스·PageUp/Down 이 페이지를 스크롤하지 않게
  //   (배구·격투·스네이크·지뢰찾기에서 ↓ 나 스페이스를 누르면 페이지가 1,000px 넘게 내려가 게임판이 사라지던 문제)
  //   입력칸·버튼·링크에 포커스가 있을 때와, 게임판이 화면 밖으로 내려가 있을 때(랭킹·채팅을 보는 중)는 원래대로 스크롤
  const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'PageUp', 'PageDown']);
  document.addEventListener('keydown', e => {
    if (!SCROLL_KEYS.has(e.code) || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target || {}, tag = (t.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select', 'button', 'a', 'summary'].includes(tag) || t.isContentEditable) return;
    if (!$('#authModal').hidden || document.querySelector('.modal:not([hidden])')) return;
    const gid = decodeURIComponent(location.hash.slice(1)); if (!SET.get(gid)) return;   // 게임 화면에서만 (홈의 작은 그림 캔버스 제외)
    const view = $('#view'); if (!view) return;
    const cv = [...view.querySelectorAll('canvas')].find(c => { const r = c.getBoundingClientRect(); if (r.width < 150 || r.height < 120) return false; const vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0); return vis > r.height * 0.4; });
    if (cv) e.preventDefault();
  });

  /* ---------- 랭킹 ---------- */
  async function renderRank() {
    current = 'rank'; setNav('rank');
    view().innerHTML = `
      <div class="page-head"><h1>랭킹</h1><p>게임별 최고 점수 순위예요.</p></div>
      <div class="rank-grid">
        ${GAMES.map(g => `<div class="panel"><h3>${g.name} <small>${g.scoreText ? '최고 기록' : '최고 점수'} TOP 20</small></h3><ol class="rank" data-rank="${g.id}"><li class="empty">불러오는 중…</li></ol></div>`).join('')}
      </div>`;
    GAMES.forEach(g => Hub.leaderboard(g.id, 20).then(rows => fillRank($(`[data-rank="${g.id}"]`), rows, 'best_score', g.id)).catch(() => {}));
  }

  /* ---------- 내 전적 ---------- */
  async function renderMy() {
    current = 'my'; setNav('my');
    const u = Hub.user;
    if (!u) {
      view().innerHTML = `<div class="panel gate"><h2>로그인하면 내 전적이 보여요</h2><p>게임별 최고 점수, 플레이 횟수, 플레이 시간이 자동으로 쌓입니다.</p>
        <div class="row" style="justify-content:center"><button class="btn" type="button" data-auth="login">로그인</button><button class="btn btn-primary" type="button" data-auth="signup">회원가입</button></div></div>`;
      return;
    }
    view().innerHTML = '<div class="panel"><p class="empty">전적을 불러오는 중…</p></div>';
    let st;
    try { st = await Hub.myStats(); } catch (e) { view().innerHTML = '<div class="panel"><p class="err">전적을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p></div>'; return; }
    if (current !== 'my' || !Hub.user) return;
    const L = Hub.levelInfo(u.earned);
    const favorite = GAMES.slice().sort((a, b) => st.per[b.id].plays - st.per[a.id].plays)[0];
    view().innerHTML = `
      <div class="stack">
        <div class="panel profile">
          ${avCanvas(u.avatar, 6, 'full', 'profile-av', true)}
          <div><h1>${esc(u.nickname)} <span class="lv">Lv.${L.level}</span></h1><div class="sub">@${esc(u.username)}</div>
            <a class="btn btn-sun btn-sm" href="#shop" style="margin-top:10px">아바타 꾸미기</a> <a class="btn btn-sm btn-room" href="#room" style="margin-top:10px"><span>내 방</span><i class="room-spark" aria-hidden="true">✦</i></a></div>
          ${levelBlock(u)}
        </div>
        <div class="tiles">
          <div class="tile"><span class="lbl">TOTAL PLAYS</span><b class="num">${fmt(st.total.plays)}판</b></div>
          <div class="tile"><span class="lbl">PLAY TIME</span><b class="num" style="font-size:14px">${dur(st.total.totalSec)}</b></div>
          <div class="tile"><span class="lbl">WIN / LOSE</span><b class="num"><span class="plus">${fmt(st.total.wins)}승</span> <span class="minus">${fmt(st.total.losses)}패</span></b></div>
          <div class="tile"><span class="lbl">POINTS</span><b class="num">${fmt(u.points)}P</b><span class="small" style="margin:0">누적 ${fmt(u.earned)}P</span></div>
          <div class="tile"><span class="lbl">FAVORITE</span><b style="font-family:var(--f-display);font-size:20px">${st.total.plays ? favorite.name : '-'}</b></div>
        </div>
        <div class="panel"><h3>게임별 전적</h3><div class="tbl-wrap"><table>
          <thead><tr><th>게임</th><th class="n">최고 점수</th><th class="n">승</th><th class="n">패</th><th class="n">플레이</th><th class="n">플레이 시간</th><th>마지막 플레이</th><th></th><th>전적 초기화</th></tr></thead>
          <tbody>${GAMES.map(g => { const p = st.per[g.id]; return `<tr><td><b>${g.name}</b></td><td class="n">${p.plays ? sfmt(g.id, p.best) : '-'}</td><td class="n plus">${fmt(p.wins)}</td><td class="n minus">${fmt(p.losses)}</td><td class="n">${fmt(p.plays)}</td><td class="n">${p.plays ? dur(p.totalSec) : '-'}</td><td>${ago(p.last)}</td><td><a class="btn btn-sm" href="#${g.id}">플레이</a></td><td>${p.plays ? resetHTML(g.id) : '<span class="small">-</span>'}</td></tr>`; }).join('')}</tbody>
        </table></div></div>
        <div class="panel"><h3>최근 기록 <small>최근 10판</small></h3>
          ${st.recent.length ? `<div class="tbl-wrap"><table><thead><tr><th>게임</th><th>결과</th><th class="n">점수</th><th class="n">시간</th><th>언제</th></tr></thead><tbody>
          ${st.recent.map(r => `<tr><td>${esc(nameOf(r.game_id))}</td><td>${r.result === 'win' ? '<span class="res win">승리</span>' : r.result === 'lose' ? '<span class="res lose">패배</span>' : '-'}</td><td class="n">${sfmt(r.game_id, r.score)}</td><td class="n">${dur(r.duration_sec)}</td><td>${ago(r.played_at)}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="empty">아직 플레이 기록이 없어요. <a href="#battle">블록 대전</a>으로 첫 기록을 남겨 보세요.</p>'}
        </div>
      </div>`;
    AV.paintAll(view());
  }

  /* ---------- 라우팅 ---------- */
  function route() {
    cleanup();
    const h = (location.hash || '').replace(/^#/, '') || 'home';
    if (h === 'battle') {
      current = 'battle'; setNav('home');
      cleanups.push(window.GoBattle.render(view(), { toast, esc, fmt, dur, openAuth, resetHTML, pointText }));
    }
    else if (h === 'shop' || h === 'shop/furn' || h === 'shop/music' || h === 'shop/nick') {
      current = 'shop'; setNav('shop');
      cleanups.push(window.GoShop.render(view(), { toast, esc, fmt, openAuth, avCanvas }, h === 'shop/furn' ? 'furn' : h === 'shop/music' ? 'music' : h === 'shop/nick' ? 'nick' : null));
    }
    else if (h === 'room' || h.startsWith('room/')) {   // v88 내 방 · 친구 방 (#room/아이디)
      current = 'room'; setNav('my');
      cleanups.push(window.GoRoom.render(view(), { toast, esc, fmt, ago, openAuth, avCanvas }, h.startsWith('room/') ? decodeURIComponent(h.slice(5)) : null));
    }
    else if (h === 'closet') {
      current = 'closet'; setNav('shop');
      cleanups.push(window.GoCloset.render(view(), { toast, esc, fmt, openAuth }));
    }
    else if (h === 'blocks') { location.replace('#battle'); return; }   // 블록 쌓기는 블록 대전으로 합침
    else if (h === '2048' || h === 'p1024') { location.replace('#p512'); return; }   // 2048 → 퍼즐512
    else if (SET.get(h) && SET.get(h).page && window[SET.get(h).page]) {
      current = h; setNav('home');
      cleanups.push(window[SET.get(h).page].render(view(), { toast, esc, fmt, dur, openAuth, resetHTML, pointText, rankItems, ago, avCanvas }));
    }
    else if (gameById(h)) renderPlay(h);
    else if (h === 'rank') renderRank();
    else if (h === 'admin') {
      current = 'admin'; setNav('admin');
      cleanups.push(window.GoAdmin.render(view(), { toast, esc, fmt, dur, ago, nameOf, avCanvas, games: SET.listAll().map(g => ({ id: g.id, name: g.name })) }));
    }
    else if ((h === 'test' || h.startsWith('test-')) && window.GoTestGames) {   // v70 관리자 테스트 게임
      current = h; setNav('test');
      cleanups.push(window.GoTestGames.render(view(), { toast, esc, fmt }, h.startsWith('test-') ? h.slice(5) : null));
    }
    else if (h === 'my') renderMy();
    else renderHome();
    window.scrollTo(0, 0);
  }

  /* ---------- 전적 초기화 (게임별, 화면 안에서 한 번 더 확인) ---------- */
  function resetHTML(gameId, label) {
    return `<span class="reset-box" data-reset="${gameId}"><button class="btn btn-sm btn-ghost" type="button" data-reset-ask>${label || '초기화'}</button></span>`;
  }
  document.addEventListener('click', async e => {
    const box = e.target.closest('[data-reset]'); if (!box) return;
    const id = box.dataset.reset, g = { name: nameOf(id) };
    if (e.target.closest('[data-reset-ask]')) {
      box.dataset.label = e.target.closest('[data-reset-ask]').textContent;
      box.innerHTML = `<span class="reset-q">${g.name} 기록을 모두 지울까요? 되돌릴 수 없어요.</span><button class="btn btn-sm btn-danger" type="button" data-reset-yes>지우기</button><button class="btn btn-sm btn-ghost" type="button" data-reset-no>취소</button>`;
      const no = box.querySelector('[data-reset-no]'); if (no) no.focus();
    } else if (e.target.closest('[data-reset-no]')) {
      box.innerHTML = `<button class="btn btn-sm btn-ghost" type="button" data-reset-ask>${esc(box.dataset.label || '초기화')}</button>`;
    } else if (e.target.closest('[data-reset-yes]')) {
      box.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        const n = await Hub.resetStats(id);
        toast(`${g.name} 전적 ${n}판을 지웠어요. 포인트·레벨·아이템은 그대로예요.`);
        if (current === 'my') renderMy();
        else if (current === 'play') { refreshBest(); refreshGameRank(); box.innerHTML = `<button class="btn btn-sm btn-ghost" type="button" data-reset-ask>${esc(box.dataset.label || '초기화')}</button>`; }
        else box.innerHTML = `<button class="btn btn-sm btn-ghost" type="button" data-reset-ask>${esc(box.dataset.label || '초기화')}</button>`;
      } catch (err) {
        toast(err.message);
        box.innerHTML = `<button class="btn btn-sm btn-ghost" type="button" data-reset-ask>${esc(box.dataset.label || '초기화')}</button>`;
      }
    }
  });

  async function boot() {
    if (Hub.mode === 'demo') $('#demoStrip').hidden = false;
    bindAuth();
    Hub.onChange(() => {
      renderUserChip();
      if (current === 'home') { renderAccountBox(); renderGrid(); loadHomeRank(); }
      else if (current === 'my') renderMy();
      else if (current === 'play') { refreshBest(); refreshGameRank(); if (session && session.board) renderBoardCard(); else renderPlayerCard(); if (session && session.state === 'ready') renderOverlay(); }
      else if (current === 'shop' && window.GoShop.refresh) window.GoShop.refresh();
      else if (current === 'closet' && window.GoCloset.refresh) window.GoCloset.refresh();
      else if (current === 'room' && window.GoRoom.refresh) window.GoRoom.refresh();
      else if (current === 'admin' || String(current).startsWith('test')) route();
    });
    try { await Hub.init(); } catch (e) { console.error(e); }
    renderUserChip();
    window.addEventListener('hashchange', route);
    route();
  }
  boot();
})();
