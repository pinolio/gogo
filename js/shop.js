/*
 * gogo?gogo! — 상점 (아바타 꾸미기)
 *  - 아이템을 누르면 아래 '미리보기'에서 입어 본 모습이 보입니다.
 *  - 구입하면 바로 착용되고, 게임 화면·대전·랭킹에도 같은 모습으로 나옵니다.
 *  - 아이템 모양은 avatar/avatar.js, 가격은 (온라인) Supabase shop_items 표 / (체험) avatar.js
 */
(function () {
  'use strict';
  const Hub = window.GameHub, AV = window.GoAvatar;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let A = null, root = null, slot = 'top', theme = 'all', picked = null, trial = null, confirmBuy = false, busy = false, walkTimer = 0, walking = false;
  let mode = 'avatar', fcat = 'furn', fpick = null;   // v88 '내 방 가구' 상점 (mode = 'furn')
  const F = window.GoFurn;

  const saved = () => (Hub.user ? Hub.user.avatar : AV.normalize({}));
  const slotName = id => (AV.SLOTS.find(s => s[0] === id) || [])[1] || id;
  // 테마 고르기: 'all' 전체 · 'basic' 처음부터 있던 아이템 · 그 밖은 avatar.js 의 theme 값
  const inTheme = it => theme === 'all' || (theme === 'basic' ? !it.theme : it.theme === theme);
  const itemsOf = s => AV.ITEMS.filter(it => it.slot === s && inTheme(it)).sort((a, b) => Hub.price(a.id) - Hub.price(b.id));
  const PREMIUM = 40;   // 이 가격 이상은 '고급' 표시

  function statusOf(id) {
    const cur = saved();
    if (id === null) return cur[slot] === null ? 'wearing' : 'none';
    if (cur[AV.byId[id].slot] === id) return 'wearing';
    if (Hub.owns(id)) return 'owned';
    return 'shop';
  }
  function badge(id) {
    const st = statusOf(id), price = id ? Hub.price(id) : 0;
    if (st === 'wearing') return '<span class="it-badge wearing">착용 중</span>';
    if (id === null) return '<span class="it-badge">벗기</span>';
    if (price === 0) return '<span class="it-badge free">무료</span>';
    if (st === 'owned') return '<span class="it-badge owned">보유</span>';
    return `<span class="it-badge price num ${price >= PREMIUM ? 'premium' : ''}">${price >= PREMIUM ? '★' : ''}${price}P</span>`;
  }

  const modeTabs = () => `<div class="shop-mode" role="tablist" aria-label="상점 고르기">
    <button type="button" role="tab" data-mode="avatar" aria-selected="${mode === 'avatar'}" class="sm-tab sm-av"><span class="sm-ic" aria-hidden="true">👕</span><span class="sm-tx"><b>아바타 꾸미기</b><small>옷 · 헤어 · 배경 ${AV.ITEMS.length}종</small></span></button>
    <button type="button" role="tab" data-mode="furn" aria-selected="${mode === 'furn'}" class="sm-tab sm-room"><span class="sm-ic" aria-hidden="true">🛋️</span><span class="sm-tx"><b>내 방 가구</b><small>가구 · 벽지 · 옷장 · 음악 ${F.ITEMS.length}종</small></span></button>
    <button type="button" role="tab" data-mode="nick" aria-selected="${mode === 'nick'}" class="sm-tab sm-nick"><span class="sm-ic" aria-hidden="true">🏷️</span><span class="sm-tx"><b>변경권</b><small>닉네임·성별 ${Hub.NICK_PRICE || 100}P</small></span></button>
  </div>`;
  /* v112 성별 변환권 (기본 몸 남 ↔ 여, 100P) · 아직 안 고른 사람은 무료로 한 번 고르기 */
  function genderHTML() {
    const u = Hub.user, price = Hub.GENDER_PRICE || 100, g = u && u.avatar && u.avatar.g, to = g === 'm' ? 'f' : 'm', nm = x => (x === 'm' ? '남자' : '여자');
    const sk = u && u.avatar ? u.avatar.skin : 's1', fig = (x, on) => `<figure class="g-fig${on ? ' on' : ''}"><img src="${AV.bodySrc(x, 'f', sk)}" alt="" width="54" height="117"><figcaption>${nm(x)}${on ? ' · 지금' : ''}</figcaption></figure>`;
    return `<div class="panel nick-shop g-shop">
      <div class="nick-ticket" aria-hidden="true"><span>🔁</span><b>성별 변환권</b><em class="num">${price}P</em></div>
      <div>${!u ? '<p class="small">로그인하면 기본 아바타의 성별을 바꿀 수 있어요.</p>'
        : !g ? `<div class="gpick" id="gFirst" role="radiogroup" aria-label="기본 아바타">
            <button type="button" role="radio" aria-checked="false" data-g="m"><img src="${AV.bodySrc('m', 'f', 's1')}" alt="" width="54" height="117"><b>남자</b></button>
            <button type="button" role="radio" aria-checked="false" data-g="f"><img src="${AV.bodySrc('f', 'f', 's1')}" alt="" width="53" height="115"><b>여자</b></button></div>
            <button class="btn btn-sun" type="button" id="gFirstOk" style="margin-top:10px">처음 한 번 무료로 정하기</button>`
        : `<div class="g-row">${fig(g, true)}<span class="g-arrow" aria-hidden="true">→</span>${fig(to, false)}</div>
          <button class="btn btn-sun" type="button" id="gChange" ${u.points < price ? 'disabled' : ''}>${price}P로 ${nm(to)}로 바꾸기</button>
          <p class="small ${u.points < price ? 'bad' : ''}" style="margin:8px 0 0">${u.points < price ? `포인트가 ${price - u.points}P 부족해요.` : '바꾸면 포인트는 돌려받을 수 없어요.'}</p>`}
      <ul class="small nick-rules"><li>기본 몸(얼굴·머리·옷 모양)이 남자 ↔ 여자로 바뀌어요. 산 옷은 그대로 가지고 있어요.</li><li>지금은 skillcom RPG 에서 기본 옷을 입었을 때 새 몸으로 보여요.</li></ul></div>
    </div>`;
  }
  function bindGender() {
    const ch = $('#gChange'), first = $('#gFirstOk');
    if (ch) ch.addEventListener('click', async () => {
      const to = Hub.user.avatar.g === 'm' ? '여자' : '남자';
      if (!confirm(`기본 아바타를 ${to}로 바꿀까요? ${Hub.GENDER_PRICE || 100}P가 빠져요.`)) return;
      ch.disabled = true;
      try { await Hub.changeGender(); A.toast(`기본 아바타를 ${to}로 바꿨어요!`); render(); } catch (e) { A.toast(e.message); ch.disabled = false; }
    });
    if (first) first.addEventListener('click', async () => {
      const sel = $('#gFirst [aria-checked="true"]'); if (!sel) return A.toast('남자 또는 여자를 골라 주세요.');
      first.disabled = true;
      try { await Hub.chooseGender(sel.dataset.g); A.toast('기본 아바타를 정했어요!'); render(); } catch (e) { A.toast(e.message); first.disabled = false; }
    });
  }
  /* v98 닉네임 변경권 */
  function renderNick() {
    const u = Hub.user, price = Hub.NICK_PRICE || 100;
    root.innerHTML = `
      <div class="page-head shop-head shop-hero">
        <div><h1>상점</h1><p>포인트로 <b>닉네임</b>을 바꿀 수 있어요. 랭킹·채팅·내 방에 새 닉네임이 보여요.</p></div>
        <div class="wallet-big">${u ? `<span class="lbl">MY POINTS</span><b class="num">${A.fmt(u.points)}P</b>` : '<button class="btn btn-primary" type="button" data-auth="login">로그인하고 쇼핑하기</button>'}</div>
      </div>
      ${modeTabs()}
      <div class="panel nick-shop">
        <div class="nick-ticket" aria-hidden="true"><span>🏷️</span><b>닉네임 변경권</b><em class="num">${price}P</em></div>
        ${u ? `<form class="nick-form" id="nickForm">
          <p class="small" style="margin:0 0 6px">지금 닉네임: <b>${A.esc(u.nickname)}</b></p>
          <label class="lbl" for="nickNew">새 닉네임 (2~10자)</label>
          <div class="row" style="margin:6px 0 0"><input id="nickNew" maxlength="10" autocomplete="off" placeholder="새 닉네임" value=""><button class="btn btn-sun" type="submit" ${u.points < price ? 'disabled' : ''}>${price}P로 바꾸기</button></div>
          <p class="small ${u.points < price ? 'bad' : ''}" style="margin:8px 0 0">${u.points < price ? `포인트가 ${price - u.points}P 부족해요. 게임을 해서 포인트를 모아 보세요.` : '바꾸면 포인트는 돌려받을 수 없어요.'}</p>
        </form>` : '<p class="small">로그인하면 닉네임을 바꿀 수 있어요.</p>'}
        <ul class="small nick-rules"><li>2~10자 · 나쁜 말은 쓸 수 없어요.</li><li>다른 사람이 쓰고 있는 닉네임은 쓸 수 없어요.</li><li>아이디(로그인할 때 쓰는 것)는 바뀌지 않아요.</li></ul>
      </div>
      ${genderHTML()}`;
    $$('[data-mode]', root).forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; render(); }));
    $$('[data-auth]', root).forEach(b => b.addEventListener('click', () => A.openAuth(b.dataset.auth)));
    bindGender();
    const f = $('#nickForm'); if (!f) return;
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const n = $('#nickNew').value.trim();
      if (n.length < 2) return A.toast('새 닉네임을 2자 이상 써 주세요.');
      if (!confirm(`'${n}'(으)로 바꿀까요? ${price}P가 빠져요.`)) return;
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      try { await Hub.changeNickname(n); A.toast(`닉네임을 '${Hub.user.nickname}'(으)로 바꿨어요!`); render(); }
      catch (err) { A.toast(err.message); btn.disabled = false; }
    });
  }
  /* v88 내 방 가구 상점 */
  function renderFurn() {
    const u = Hub.user, list = F.ITEMS.filter(it => it.slot === fcat).sort((a, b) => Hub.price(a.id) - Hub.price(b.id) || (a.name < b.name ? -1 : 1));
    const fbadge = id => { const p = Hub.price(id); if (p === 0) return '<span class="it-badge free">기본</span>'; if (Hub.owns(id)) return '<span class="it-badge owned">보유</span>'; return `<span class="it-badge price num ${p >= PREMIUM ? 'premium' : ''}">${p >= PREMIUM ? '★' : ''}${p}P</span>`; };
    root.innerHTML = `
      <div class="page-head shop-head shop-hero">
        <div><h1>상점</h1><p>포인트로 가구를 사서 <a href="#room">내 방</a>을 꾸며요. 산 가구는 내 방의 <b>방 꾸미기</b>에서, 산 <b>음악</b>은 내 방 왼쪽 프로필의 <b>방 음악</b>에서 골라요.</p></div>
        <div class="wallet-big">${u ? `<span class="lbl">MY POINTS</span><b class="num">${A.fmt(u.points)}P</b>` : '<button class="btn btn-primary" type="button" data-auth="login">로그인하고 쇼핑하기</button>'}</div>
      </div>
      ${modeTabs()}
      <div class="shop-layout">
      <div class="panel shop-items">
        <div class="slot-tabs" role="tablist" aria-label="가구 종류">${F.SHOP_CATS.map(([id, name]) => `<button type="button" role="tab" aria-selected="${id === fcat}" data-fcat="${id}">${name}</button>`).join('')}</div>
        <div class="item-grid furn-grid">${list.map(it => `<button type="button" class="item ${fpick === it.id ? 'sel' : ''}" data-fitem="${it.id}" aria-pressed="${fpick === it.id}"><canvas data-fth="${it.id}" width="160" height="160" aria-hidden="true"></canvas><span class="it-name">${A.esc(it.name)}</span>${fbadge(it.id)}</button>`).join('')}</div>
      </div>
      <div class="panel shop-preview">
        <h3>미리보기</h3>
        <div class="pv-stage furn-pv">${fpick ? `<canvas data-fth="${fpick}" data-big width="320" height="320" aria-hidden="true"></canvas>` : '<p class="small">왼쪽에서 가구를 눌러 보세요.</p>'}</div>
        <div class="pv-info" id="pvInfo">${fpick ? furnInfo() : ''}</div>
      </div>
      </div>`;
    $$('canvas[data-fth]', root).forEach(c => { const big = c.hasAttribute('data-big'), t = F.thumb(c.dataset.fth, big ? 160 : 80), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(t, 0, 0, c.width, c.height); });
    $$('[data-mode]', root).forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; render(); }));
    $$('[data-fcat]', root).forEach(b => b.addEventListener('click', () => { fcat = b.dataset.fcat; fpick = null; confirmBuy = false; stopPv(); render(); }));
    $$('[data-fitem]', root).forEach(b => b.addEventListener('click', () => { if (fpick !== b.dataset.fitem) stopPv(); fpick = b.dataset.fitem; confirmBuy = false; render(); }));
    $$('[data-fact]', root).forEach(b => b.addEventListener('click', () => furnAct(b.dataset.fact)));
  }
  function furnInfo() {
    const u = Hub.user, it = F.byId[fpick], price = Hub.price(fpick), cat = (F.SHOP_CATS.find(c => c[0] === it.slot) || [, '가구'])[1];
    const actDesc = { sleep: '누우면 쿨쿨 잠들어요', sit: '앉을 수 있어요', light: '눌러서 켜고 꺼요', screen: '화면을 켜요', music: '음악이 나와요', play: '눌러서 놀아요', window: '눌러서 낮 ↔ 밤', wardrobe: '누르면 옷을 갈아입어요' }[it.act] || '';
    let actions = '';
    if (!u) actions = '<button class="btn btn-primary" type="button" data-auth="login">로그인하고 구입하기</button>';
    else if (Hub.owns(fpick)) actions = it.slot === 'music' ? '<a class="btn btn-sun" href="#room">내 방에서 틀기</a>' : '<a class="btn btn-sun" href="#room">내 방에서 놓기</a>';
    else if (u.points < price) actions = `<button class="btn" type="button" disabled>${price - u.points}P 부족해요</button>`;
    else if (!confirmBuy) actions = `<button class="btn btn-primary" type="button" data-fact="ask">${price}P로 구입하기</button>`;
    else actions = `<span class="reset-q">${A.esc(it.name)}을(를) ${price}P에 살까요?</span><button class="btn btn-primary" type="button" data-fact="buy">구입</button><button class="btn btn-ghost" type="button" data-fact="cancel">취소</button>`;
    return `<div class="pv-item"><div><span class="cat">${cat}</span><b class="pv-name">${A.esc(it.name)}</b><span class="pv-price num">${price === 0 ? '기본' : price + 'P'}</span></div><div class="pv-actions">${actions}</div></div>
      <p class="small">${it.slot === 'music' ? `<b>${A.esc(it.game)}</b> 게임의 배경음악 · 내 방에서 계속 흘러나와요 <button class="btn btn-sm" type="button" data-fact="preview">${pv ? '■ 그만 듣기' : '▶ 미리 듣기 (15초)'}</button>` : `${it.w ? `크기 ${it.w}×${it.d || 1}칸 · ` : ''}${actDesc}`}${Hub.owns(fpick) ? ' · 가지고 있어요' : ''}</p>`;
  }
  // v91 음악 미리 듣기 (15초)
  let pv = null, pvT = 0;
  function stopPv() { clearTimeout(pvT); if (pv) { pv.pause(); pv.removeAttribute('src'); } pv = null; }
  async function furnAct(a) {
    if (a === 'preview') { if (pv) { stopPv(); render(); return; } const it = F.byId[fpick]; pv = new Audio(it.file); pv.volume = 0.45; pv.play().catch(() => { A.toast('음악을 틀지 못했어요'); stopPv(); render(); }); pvT = setTimeout(() => { stopPv(); render(); }, 15000); render(); return; }
    if (busy) return;
    if (a === 'ask') { confirmBuy = true; render(); return; }
    if (a === 'cancel') { confirmBuy = false; render(); return; }
    busy = true;
    try { await Hub.buyItem(fpick); A.toast(F.byId[fpick].name + ' 구입 완료! 내 방의 방 꾸미기에서 놓아 보세요.'); confirmBuy = false; } catch (e) { A.toast(e.message); }
    busy = false; render();
  }

  function render() {
    if (!root) return;
    if (mode === 'furn') return renderFurn();
    if (mode === 'nick') return renderNick();
    const u = Hub.user;
    root.innerHTML = `
      <div class="page-head shop-head shop-hero">
        <div><h1>상점</h1><p>게임에서 이기면 포인트를 받아요. 아이템을 누르면 옆에서 미리 입어 볼 수 있어요. 산 옷은 <a href="#closet">옷장</a>에서 언제든 갈아입어요.</p></div>
        <div class="wallet-big">${u ? `<span class="lbl">MY POINTS</span><b class="num">${A.fmt(u.points)}P</b>` : '<button class="btn btn-primary" type="button" data-auth="login">로그인하고 쇼핑하기</button>'}</div>
      </div>
      ${modeTabs()}
      <div class="shop-layout">
      <div class="panel shop-items">
        <div class="slot-tabs" role="tablist" aria-label="아이템 종류">
          ${AV.SLOTS.map(([id, name]) => `<button type="button" role="tab" aria-selected="${id === slot}" data-slot="${id}">${name}</button>`).join('')}
        </div>
        <div class="theme-chips" role="group" aria-label="테마">
          ${(AV.THEMES || []).map(([id, name]) => `<button type="button" class="chip" aria-pressed="${id === theme}" data-theme="${id}">${name}</button>`).join('')}
        </div>
        <div class="item-grid" id="itemGrid">
          ${AV.OPTIONAL[slot] ? card(null) : ''}
          ${itemsOf(slot).map(it => card(it.id)).join('')}
          ${itemsOf(slot).length ? '' : '<p class="empty small">이 테마에는 이 부위 아이템이 없어요. 다른 부위나 테마를 골라 보세요.</p>'}
        </div>
      </div>
      <div class="panel shop-preview">
        <h3>미리보기</h3>
        <div class="pv-pair">
          <figure><div class="pv-stage">${A.avCanvas(saved(), 6, 'full', 'pv-av', true)}</div><figcaption>지금 내 모습</figcaption></figure>
          <div class="pv-arrow" aria-hidden="true">▶</div>
          <figure><div class="pv-stage try"><canvas id="pvTry" aria-label="미리보기 아바타"></canvas></div><figcaption>입어 본 모습</figcaption></figure>
        </div>
        <div class="pv-tools">
          <button class="btn btn-sm btn-ghost" type="button" id="pvWalk">${walking ? '■ 멈추기' : '▶ 걸어 보기'}</button>
          <button class="btn btn-sm btn-ghost" type="button" id="pvReset">미리보기 처음으로</button>
        </div>
        <div class="pv-info" id="pvInfo"></div>
      </div>
      </div>`;
    AV.paintAll(root);
    paintTry(0);
    renderInfo();
    $$('[data-mode]', root).forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; fpick = null; confirmBuy = false; render(); }));
    $$('[data-slot]', root).forEach(b => b.addEventListener('click', () => { slot = b.dataset.slot; picked = undefined; confirmBuy = false; render(); }));
    $$('[data-theme]', root).forEach(b => b.addEventListener('click', () => { theme = b.dataset.theme; picked = undefined; confirmBuy = false; render(); }));
    $$('[data-item]', root).forEach(b => b.addEventListener('click', () => pick(b.dataset.item === '' ? null : b.dataset.item)));
    $('#pvReset').addEventListener('click', () => { trial = Object.assign({}, saved()); picked = undefined; confirmBuy = false; render(); });
    $('#pvWalk').addEventListener('click', () => { walking = !walking; startWalk(); $('#pvWalk').textContent = walking ? '■ 멈추기' : '▶ 걸어 보기'; });
    startWalk();
  }

  // v114 선생님 그림이 있는 헤어 (상점 카드에 그림으로 보임)
  const HAIR_IMG = ['h_short', 'h_short_brown', 'h_long', 'h_bob', 'h_ponytail', 'h_spiky', 'h_curly', 'h_bun', 'h_topknot', 'h_twin', 'h_twotone', 'h_mohawk'];
  // v114 상점 머리(얹는 머리)는 내 피부·성별 몸에 얹은 모습으로 보여 줌 (옷은 기본)
  const ovHair = id => slot === 'hair' && id && AV.HAIR_OV && AV.HAIR_OV.includes(id) && (trial.g === 'm' || trial.g === 'f' || !Hub.user);
  const hairLook = id => ({ skin: AV.BODY_SKINS.includes(trial.skin) ? trial.skin : 's1', g: trial.g === 'f' ? 'f' : 'm', hair: id });
  function card(id) {
    const it = id ? AV.byId[id] : null;
    const look = ovHair(id) ? hairLook(id) : Object.assign({}, trial, { [slot]: id });
    const sel = picked === id;
    const tier = !it ? '' : Hub.price(id) >= PREMIUM ? ' tier-premium' : Hub.price(id) === 0 ? ' tier-free' : '';
    return `<button type="button" class="item${tier} ${sel ? 'sel' : ''}" data-item="${id || ''}" aria-pressed="${sel}">
      ${slot === 'skin' && id && AV.BODY_SKINS && AV.BODY_SKINS.includes(id) ? `<span class="it-img"><img src="${AV.bodySrc(trial.g || 'm', 'f', id)}" alt="" loading="lazy"></span>`
        : slot === 'hair' && id && HAIR_IMG.includes(id) && !ovHair(id) ? `<span class="it-img"><img src="${AV.hairSrc(id)}" alt="" loading="lazy"></span>`
        : `<canvas data-avatar="${AV.attr(look)}" data-scale="3" data-scene data-body aria-hidden="true"></canvas>`}
      <span class="it-name">${it ? A.esc(it.name) : '없음'}</span>${badge(id)}</button>`;
  }

  function pick(id) {
    picked = id; confirmBuy = false;
    trial = Object.assign({}, trial, { [slot]: id });
    $$('[data-item]', root).forEach(b => { const on = (b.dataset.item || null) === id; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
    // 다른 칸 썸네일도 새 미리보기 기준으로 다시 그림
    $$('[data-item]', root).forEach(b => {
      const c = b.querySelector('canvas'), v = b.dataset.item || null; if (!c) return;   // v114 그림 카드(피부·헤어)는 그대로
      const look = ovHair(v) ? hairLook(v) : Object.assign({}, trial, { [slot]: v }), o = { scale: 3, scene: true, body: true }; o.onBody = () => AV.paint(c, look, o);
      AV.paint(c, look, o);
    });
    paintTry(0);
    renderInfo();
  }

  function paintTry(frame) { const c = $('#pvTry'); if (c) AV.paint(c, trial, Object.assign({ scale: 6, scene: true, body: true, onBody: () => paintTry(0) }, frame && frame.walk != null ? frame : { frame })); }   // v114 기본 옷이면 새 몸 그림
  function startWalk() {
    clearInterval(walkTimer);
    if (!walking || reduce) { paintTry(0); return; }
    const t0 = performance.now();   // v105 부드러운 걷기: 1초에 약 30번 그림 (한 걸음 0.44초)
    walkTimer = setInterval(() => { if (!$('#pvTry')) { clearInterval(walkTimer); return; } paintTry({ walk: (performance.now() - t0) / 880 * Math.PI * 2 }); }, 33);
  }

  function renderInfo() {
    const el = $('#pvInfo'); if (!el) return;
    const u = Hub.user;
    if (picked === undefined) {
      el.innerHTML = `<p class="small">위에서 <b>${slotName(slot)}</b> 아이템을 눌러 보세요. 여러 부위를 골라 한꺼번에 입어 볼 수도 있어요.</p>`;
      return;
    }
    const id = picked, it = id ? AV.byId[id] : null, st = statusOf(id), price = id ? Hub.price(id) : 0;
    let actions = '', note = '';
    if (!u) {
      actions = '<button class="btn btn-primary" type="button" data-auth="login">로그인하고 구입하기</button>';
      note = '로그인하면 기본 아바타가 만들어지고, 게임에서 모은 포인트로 꾸밀 수 있어요.';
    } else if (st === 'wearing') {
      actions = it && AV.OPTIONAL[slot] ? '<button class="btn" type="button" data-act="takeoff">벗기</button>' : '';
      note = '지금 착용 중이에요.';
    } else if (id === null) {
      actions = '<button class="btn btn-sun" type="button" data-act="wear">벗기</button>';
    } else if (st === 'owned') {
      actions = '<button class="btn btn-sun" type="button" data-act="wear">착용하기</button>';
      note = price === 0 ? '무료 아이템이에요.' : '이미 가지고 있는 아이템이에요.';
    } else if (u.points < price) {
      actions = `<button class="btn" type="button" disabled>${price - u.points}P 부족해요</button>`;
      note = '게임에서 이기면 포인트를 받아요. (승리 +2P)';
    } else if (!confirmBuy) {
      actions = `<button class="btn btn-primary" type="button" data-act="ask">${price}P로 구입하기</button>`;
      note = `구입하면 바로 착용돼요. 남는 포인트: ${u.points - price}P`;
    } else {
      actions = `<span class="reset-q">${A.esc(it.name)}을(를) ${price}P에 살까요?</span><button class="btn btn-primary" type="button" data-act="buy">구입</button><button class="btn btn-ghost" type="button" data-act="cancel">취소</button>`;
    }
    el.innerHTML = `
      <div class="pv-item">
        <div><span class="cat">${slotName(slot)}</span><b class="pv-name">${it ? A.esc(it.name) : '없음 (벗기)'}</b>
          ${id ? `<span class="pv-price num">${price === 0 ? '무료' : price + 'P'}</span>` : ''}</div>
        <div class="pv-actions">${actions}</div>
      </div>
      ${note ? `<p class="small">${note}</p>` : ''}`;
    $$('[data-act]', el).forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
  }

  async function act(a) {
    if (busy) return;
    if (a === 'ask') { confirmBuy = true; renderInfo(); return; }
    if (a === 'cancel') { confirmBuy = false; renderInfo(); return; }
    busy = true;
    const id = a === 'takeoff' ? null : picked, it = id ? AV.byId[id] : null;
    try {
      if (a === 'buy') await Hub.buyItem(id);
      await Hub.setAvatar(Object.assign({}, saved(), { [slot]: id }));
      A.toast(a === 'buy' ? `${it.name} 구입 완료! 바로 착용했어요.` : id ? `${it.name}을(를) 착용했어요.` : `${slotName(slot)}을(를) 벗었어요.`);
      confirmBuy = false;
    } catch (e) { A.toast(e.message); }
    busy = false;
    trial = Object.assign({}, trial, { [slot]: id });
    render();
  }

  window.GoShop = {
    render(el, app, m) {
      A = app; root = el; picked = undefined; confirmBuy = false; walking = false; mode = m === 'furn' || m === 'music' ? 'furn' : m === 'nick' ? 'nick' : 'avatar'; fpick = null; if (m === 'music') fcat = 'music'; else if (m === 'furn' && fcat === 'music') fcat = 'furn';
      trial = Object.assign({}, saved());
      render();
      Hub.loadPrices().then(p => { if (p && root) render(); }).catch(() => {});
      return function cleanup() { clearInterval(walkTimer); stopPv(); root = null; };
    },
    // 로그인·구입 등으로 내 정보가 바뀌었을 때
    refresh() { if (!root) return; if (!busy) { trial = Object.assign({}, saved(), picked !== undefined ? { [slot]: picked } : {}); render(); } }
  };
})();
