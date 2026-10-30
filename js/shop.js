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

  function render() {
    if (!root) return;
    const u = Hub.user;
    root.innerHTML = `
      <div class="page-head shop-head shop-hero">
        <div><h1>상점</h1><p>게임에서 이기면 포인트를 받아요. 아이템을 누르면 옆에서 미리 입어 볼 수 있어요. 산 옷은 <a href="#closet">옷장</a>에서 언제든 갈아입어요.</p></div>
        <div class="wallet-big">${u ? `<span class="lbl">MY POINTS</span><b class="num">${A.fmt(u.points)}P</b>` : '<button class="btn btn-primary" type="button" data-auth="login">로그인하고 쇼핑하기</button>'}</div>
      </div>
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
    $$('[data-slot]', root).forEach(b => b.addEventListener('click', () => { slot = b.dataset.slot; picked = undefined; confirmBuy = false; render(); }));
    $$('[data-theme]', root).forEach(b => b.addEventListener('click', () => { theme = b.dataset.theme; picked = undefined; confirmBuy = false; render(); }));
    $$('[data-item]', root).forEach(b => b.addEventListener('click', () => pick(b.dataset.item === '' ? null : b.dataset.item)));
    $('#pvReset').addEventListener('click', () => { trial = Object.assign({}, saved()); picked = undefined; confirmBuy = false; render(); });
    $('#pvWalk').addEventListener('click', () => { walking = !walking; startWalk(); $('#pvWalk').textContent = walking ? '■ 멈추기' : '▶ 걸어 보기'; });
    startWalk();
  }

  function card(id) {
    const it = id ? AV.byId[id] : null;
    const look = Object.assign({}, trial, { [slot]: id });
    const sel = picked === id;
    const tier = !it ? '' : Hub.price(id) >= PREMIUM ? ' tier-premium' : Hub.price(id) === 0 ? ' tier-free' : '';
    return `<button type="button" class="item${tier} ${sel ? 'sel' : ''}" data-item="${id || ''}" aria-pressed="${sel}">
      <canvas data-avatar="${AV.attr(look)}" data-scale="3" data-scene aria-hidden="true"></canvas>
      <span class="it-name">${it ? A.esc(it.name) : '없음'}</span>${badge(id)}</button>`;
  }

  function pick(id) {
    picked = id; confirmBuy = false;
    trial = Object.assign({}, trial, { [slot]: id });
    $$('[data-item]', root).forEach(b => { const on = (b.dataset.item || null) === id; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
    // 다른 칸 썸네일도 새 미리보기 기준으로 다시 그림
    $$('[data-item]', root).forEach(b => {
      const c = b.querySelector('canvas'), v = b.dataset.item || null;
      AV.paint(c, Object.assign({}, trial, { [slot]: v }), { scale: 3, scene: true });
    });
    paintTry(0);
    renderInfo();
  }

  function paintTry(frame) { const c = $('#pvTry'); if (c) AV.paint(c, trial, { scale: 6, frame, scene: true }); }
  function startWalk() {
    clearInterval(walkTimer);
    if (!walking || reduce) { paintTry(0); return; }
    const seq = [1, 0, 3, 0]; let i = 0;
    walkTimer = setInterval(() => { if (!$('#pvTry')) { clearInterval(walkTimer); return; } paintTry(seq[i++ % 4]); }, 220);
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
    render(el, app) {
      A = app; root = el; picked = undefined; confirmBuy = false; walking = false;
      trial = Object.assign({}, saved());
      render();
      Hub.loadPrices().then(p => { if (p && root) render(); }).catch(() => {});
      return function cleanup() { clearInterval(walkTimer); root = null; };
    },
    // 로그인·구입 등으로 내 정보가 바뀌었을 때
    refresh() { if (!root) return; if (!busy) { trial = Object.assign({}, saved(), picked !== undefined ? { [slot]: picked } : {}); render(); } }
  };
})();
