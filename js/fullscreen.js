/*
 * gogo?gogo! — v148 모든 게임 '전체 화면' 버튼
 *  - 게임 화면 틀(.cabinet) 바로 아래 오른쪽에 [⛶ 전체 화면] 버튼을 붙임 (화면이 늦게 그려지는 게임도 저절로)
 *  - 전체 화면에서는 게임 그림의 가로·세로 비율을 그대로 두고 화면에 꽉 차게 키움 (남는 곳은 어두운 바탕)
 *  - 브라우저가 전체 화면을 못 하면(아이폰 등) 창 안에서 꽉 차게(fs-max) 보여 줌 · Esc 또는 버튼으로 나가기
 *  - skillcom RPG 는 자기 전체 화면 버튼이 있어서 건드리지 않음
 */
(function () {
  'use strict';
  const fsNow = () => document.fullscreenElement || document.webkitFullscreenElement;
  let maxCab = null;   // 전체 화면 대신 창 안에서 꽉 채운 틀

  function ratio(cab) {   // 그림 비율 = 캔버스 가로/세로 (없으면 --ar)
    const c = cab.querySelector('.screen canvas');
    if (c && c.width && c.height) return c.width / c.height;
    const v = parseFloat(getComputedStyle(cab).getPropertyValue('--ar'));
    return v > 0 ? v : 1;
  }
  function label(btn, on) { btn.textContent = on ? '⛶ 전체 화면 나가기' : '⛶ 전체 화면'; btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function sync() {
    document.querySelectorAll('.fs-btn').forEach(b => { const cab = b._cab; label(b, !!cab && (fsNow() === cab || maxCab === cab)); });
    const on = fsNow() || maxCab;
    if (on) on.style.setProperty('--fsar', ratio(on));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 60);   // 크기에 맞춰 다시 그리는 게임을 위해
  }
  function exitMax() { if (maxCab) { maxCab.classList.remove('fs-max'); document.documentElement.classList.remove('fs-lock'); maxCab = null; } }
  function toggle(cab) {
    if (fsNow() === cab) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (maxCab === cab) { exitMax(); sync(); return; }
    cab.style.setProperty('--fsar', ratio(cab));
    const req = cab.requestFullscreen || cab.webkitRequestFullscreen;
    const fallback = () => { maxCab = cab; cab.classList.add('fs-max'); document.documentElement.classList.add('fs-lock'); sync(); };
    if (!req) return fallback();
    try { const r = req.call(cab); if (r && r.catch) r.catch(fallback); } catch (e) { fallback(); }
  }
  function attach(cab) {
    if (cab._fsBtn || cab.closest('.rg-page')) return;
    const row = document.createElement('div'); row.className = 'fs-row';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fs-btn'; btn._cab = cab; label(btn, false);
    btn.addEventListener('click', () => toggle(cab));
    row.appendChild(btn); cab.insertAdjacentElement('afterend', row); cab._fsBtn = btn;
    // 전체 화면 안에서도 나갈 수 있게 작은 버튼 하나 더 (틀 안 오른쪽 위)
    const inBtn = document.createElement('button'); inBtn.type = 'button'; inBtn.className = 'fs-in'; inBtn.textContent = '✕ 나가기'; inBtn._cab = cab;
    inBtn.addEventListener('click', () => toggle(cab)); cab.appendChild(inBtn);
  }
  function scan() { document.querySelectorAll('.cabinet').forEach(attach); }
  let pend = 0;
  new MutationObserver(() => { if (!pend) pend = requestAnimationFrame(() => { pend = 0; scan(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && maxCab) { exitMax(); sync(); } });
  window.addEventListener('hashchange', () => { exitMax(); if (fsNow()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* noop */ } } });
  window.addEventListener('resize', () => { const on = fsNow() || maxCab; if (on) on.style.setProperty('--fsar', ratio(on)); });
  if (document.readyState !== 'loading') scan(); else document.addEventListener('DOMContentLoaded', scan);
  window.GoFullscreen = { toggle, scan };
})();
