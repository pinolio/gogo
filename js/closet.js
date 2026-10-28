/*
 * gogo?gogo! — 옷장 (GoCloset, 주소 #closet)
 *  - 내가 가진 옷·배경(무료 + 구입한 것)만 모아 보여 주고, 언제든 갈아입을 수 있습니다.
 *  - 아이템을 누르면 미리보기에 입혀 보고, '이대로 입기'를 누르면 저장(착용)됩니다.
 *  - 코디 3칸: 지금 모습을 저장해 두었다가 한 번에 갈아입기. (온라인: Supabase profiles.outfits / 체험: 이 브라우저)
 *  - 사지 않은 아이템은 상점(#shop)에서 삽니다.
 */
(function () {
  'use strict';
  const Hub = window.GameHub, AV = window.GoAvatar;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let A = null, root = null, slot = 'top', look = null, outfits = null, busy = false, walking = false, walkTimer = 0;

  const saved = () => (Hub.user ? Hub.user.avatar : AV.normalize({}));
  const same = (a, b) => JSON.stringify(AV.normalize(a)) === JSON.stringify(AV.normalize(b));
  const ownedOf = s => AV.ITEMS.filter(it => it.slot === s && Hub.owns(it.id)).sort((a, b) => Hub.price(a.id) - Hub.price(b.id));
  const ownedCount = () => AV.ITEMS.filter(it => Hub.owns(it.id)).length;
  // 코디를 불러올 때: 지금 가지고 있지 않은 아이템은 빼고(기본값으로) 입힘
  const wearable = av => { const out = {}; AV.SLOTS.forEach(([s]) => { const id = av && av[s]; out[s] = id && Hub.owns(id) ? id : (AV.OPTIONAL[s] ? null : AV.DEFAULT[s]); }); return out; };
  const canvas = (av, scale, cls, extra) => `<canvas class="${cls || ''}" data-avatar="${AV.attr(av)}" data-scale="${scale}" data-scene ${extra || ''} aria-hidden="true"></canvas>`;

  function render() {
    if (!root) return;
    const u = Hub.user;
    if (!u) {
      root.innerHTML = `<div class="panel gate"><h2>로그인하면 내 옷장이 보여요</h2><p>구입한 옷과 배경이 모두 옷장에 모여, 언제든 갈아입을 수 있어요.</p>
        <div class="row" style="justify-content:center"><button class="btn btn-primary" type="button" data-auth="login">로그인</button></div></div>`;
      return;
    }
    const changed = !same(look, saved());
    const total = AV.ITEMS.length, have = ownedCount();
    const list = ownedOf(slot);
    root.innerHTML = `
      <div class="page-head shop-head">
        <div><h1>옷장</h1><p>내가 가진 옷과 배경이 모두 여기 있어요. 눌러서 입혀 보고 <b>이대로 입기</b>를 누르면 저장돼요.</p></div>
        <div class="row" style="margin:0"><a class="btn btn-sun" href="#shop">상점 가기</a></div>
      </div>
      <div class="closet">
        <div class="panel closet-pv">
          <h3>미리보기 <small>보유 ${have} / ${total}개</small></h3>
          <div class="pv-stage try closet-stage"><canvas id="clTry" aria-label="옷장 미리보기 아바타"></canvas></div>
          <div class="pv-tools">
            <button class="btn btn-sm btn-ghost" type="button" id="clWalk">${walking ? '■ 멈추기' : '▶ 걸어 보기'}</button>
            <button class="btn btn-sm btn-ghost" type="button" id="clUndo" ${changed ? '' : 'disabled'}>원래대로</button>
          </div>
          <button class="btn btn-primary btn-block" type="button" id="clWear" ${changed && !busy ? '' : 'disabled'}>${changed ? '이대로 입기' : '지금 입고 있는 모습이에요'}</button>
        </div>
        <div class="panel closet-items">
          <div class="slot-tabs" role="tablist" aria-label="아이템 종류">
            ${AV.SLOTS.map(([id, name]) => `<button type="button" role="tab" aria-selected="${id === slot}" data-slot="${id}">${name} <small>${ownedOf(id).length}</small></button>`).join('')}
          </div>
          <div class="item-grid">
            ${AV.OPTIONAL[slot] ? card(null) : ''}
            ${list.map(it => card(it.id)).join('')}
          </div>
          ${list.filter(it => Hub.price(it.id) > 0).length ? '' : `<p class="small">아직 산 ${A.esc(slotName(slot))} 아이템이 없어요. <a href="#shop">상점</a>에서 포인트로 살 수 있어요.</p>`}
        </div>
      </div>
      <div class="panel closet-sets">
        <h3>내 코디 <small>3칸 · 지금 미리보기 모습을 저장해 두고 한 번에 갈아입어요</small></h3>
        <div class="outfit-grid" id="clSets">${outfits ? outfits.map(setCard).join('') : '<p class="empty">불러오는 중…</p>'}</div>
      </div>`;
    AV.paintAll(root);
    paintTry(0);
    $$('[data-slot]', root).forEach(b => b.addEventListener('click', () => { slot = b.dataset.slot; render(); }));
    $$('[data-item]', root).forEach(b => b.addEventListener('click', () => { look = Object.assign({}, look, { [slot]: b.dataset.item || null }); render(); }));
    $('#clUndo').addEventListener('click', () => { look = Object.assign({}, saved()); render(); });
    $('#clWear').addEventListener('click', wear);
    $('#clWalk').addEventListener('click', () => { walking = !walking; startWalk(); $('#clWalk').textContent = walking ? '■ 멈추기' : '▶ 걸어 보기'; });
    $$('[data-set]', root).forEach(b => b.addEventListener('click', () => setAction(+b.dataset.i, b.dataset.set)));
    startWalk();
  }
  const slotName = id => (AV.SLOTS.find(s => s[0] === id) || [])[1] || id;

  function card(id) {
    const it = id ? AV.byId[id] : null, on = look[slot] === id, wearing = saved()[slot] === id;
    return `<button type="button" class="item ${on ? 'sel' : ''}" data-item="${id || ''}" aria-pressed="${on}">
      ${canvas(Object.assign({}, look, { [slot]: id }), 2)}
      <span class="it-name">${it ? A.esc(it.name) : '없음'}</span>
      ${wearing ? '<span class="it-badge wearing">착용 중</span>' : it && Hub.price(id) === 0 ? '<span class="it-badge free">기본</span>' : it ? '<span class="it-badge owned">보유</span>' : '<span class="it-badge">벗기</span>'}</button>`;
  }
  function setCard(av, i) {
    return `<div class="outfit ${av ? '' : 'empty'}">
      <div class="outfit-pv">${av ? canvas(wearable(av), 3) : '<span>빈 칸</span>'}</div>
      <b>코디 ${i + 1}</b>
      <div class="outfit-btns">
        ${av ? `<button class="btn btn-sm btn-sun" type="button" data-set="load" data-i="${i}">입어 보기</button>` : ''}
        <button class="btn btn-sm" type="button" data-set="save" data-i="${i}">${av ? '지금 모습으로 바꾸기' : '지금 모습 저장'}</button>
        ${av ? `<button class="btn btn-sm btn-ghost" type="button" data-set="clear" data-i="${i}">비우기</button>` : ''}
      </div>
    </div>`;
  }

  function paintTry(frame) { const c = $('#clTry'); if (c) AV.paint(c, look, { scale: 6, frame, scene: true }); }
  function startWalk() {
    clearInterval(walkTimer);
    if (!walking || reduce) { paintTry(0); return; }
    const seq = [1, 0, 3, 0]; let i = 0;
    walkTimer = setInterval(() => { if (!$('#clTry')) { clearInterval(walkTimer); return; } paintTry(seq[i++ % 4]); }, 220);
  }

  async function wear() {
    if (busy) return;
    busy = true; render();
    try { await Hub.setAvatar(look); A.toast('옷을 갈아입었어요. 게임·랭킹에도 이 모습으로 보여요.'); }
    catch (e) { A.toast(e.message); }
    busy = false; look = Object.assign({}, saved()); render();
  }
  async function setAction(i, act) {
    if (busy || !outfits) return;
    if (act === 'load') { look = wearable(outfits[i]); A.toast('코디 ' + (i + 1) + '을(를) 입혀 봤어요. 마음에 들면 이대로 입기를 누르세요.'); render(); return; }
    const next = outfits.slice();
    next[i] = act === 'save' ? AV.normalize(look) : null;
    busy = true;
    try { outfits = await Hub.saveOutfits(next); A.toast(act === 'save' ? '코디 ' + (i + 1) + '에 저장했어요.' : '코디 ' + (i + 1) + '을(를) 비웠어요.'); }
    catch (e) { A.toast(e.message); }
    busy = false; render();
  }
  async function loadOutfits() {
    if (!Hub.user) return;
    try { outfits = await Hub.getOutfits(); }
    catch (e) { outfits = [null, null, null]; A.toast(e.message); }
    render();
  }

  window.GoCloset = {
    render(el, app) {
      A = app; root = el; walking = false; outfits = null; busy = false;
      look = Object.assign({}, saved());
      render(); loadOutfits();
      Hub.loadPrices().then(p => { if (p && root) render(); }).catch(() => {});
      return function cleanup() { clearInterval(walkTimer); root = null; };
    },
    // 로그인·로그아웃 등으로 내 정보가 바뀌었을 때
    refresh() { if (!root || busy) return; look = Object.assign({}, saved()); outfits = null; render(); loadOutfits(); }
  };
})();
