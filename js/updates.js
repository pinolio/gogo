/*
 * GoUpdates — 게임별 업데이트 띠 (v147, 선생님 2026-11-14)
 *  - 메인 화면에서 게임(또는 상점·메이커)에 들어가면 화면 위에 작은 띠로 그 게임의 최근 업데이트를 보여 줌.
 *  - 보여 주는 범위: 한국 시간 '가장 최근 오전 6시' 기준 그 전 48시간 동안 올린 것.
 *      예) 11/14 15:00 에 올린 것 → 11/15 06:00 부터 띠에 나오고 → 11/17 06:00 에 사라짐 (이틀 동안).
 *  - 같은 게임은 하루(오전 6시 ~ 다음 오전 6시)에 한 번만. 5초 뒤 저절로 사라지고 ✕ 로 바로 닫음.
 *  - 업데이트를 올릴 때 아래 LIST 에 한 줄 더하기: { g: '게임 id(주소 # 뒤)', at: '2026-11-14 12:45'(한국 시간), t: '아주 짧게' }
 *    (game id 예: rpg · battle · p512 · scfight · mecha · sky · omok … · 게임이 아닌 화면: shop · maker)
 */
(function () {
  'use strict';
  const LIST = [
    // skillcom RPG
    { g: 'rpg', at: '2026-11-12 18:00', t: '메이커 지도 그리기 · 금테 화면' },
    { g: 'rpg', at: '2026-11-12 23:00', t: '건물 실내 새 그림 · 저승 웹툰 · 환생' },
    { g: 'rpg', at: '2026-11-12 23:30', t: '저승 결전장 새 지도' },
    { g: 'rpg', at: '2026-11-13 12:00', t: '환생 랭킹 · 메이커 지도가 게임과 연결' },
    { g: 'rpg', at: '2026-11-13 22:30', t: '1:1 결투장 오픈' },
    { g: 'rpg', at: '2026-11-14 09:40', t: '마을 건물 새 그림 · 훈련장 오픈' },
    { g: 'rpg', at: '2026-11-14 10:30', t: '골드↔포인트 교환 · 죽음의 위험' },
    { g: 'rpg', at: '2026-11-14 12:45', t: '창 새 꾸밈 · 장승·구미호 새 그림 · 마법 그림 고침' },
    { g: 'rpg', at: '2026-11-14 20:30', t: '거래 버그 고침' },
    // 6.25. 하늘
    { g: 'sky', at: '2026-11-14 21:50', t: '적·보스 10종·아이템 새 그림' },
    { g: 'sky', at: '2026-11-14 23:00', t: '로봇 변신(C) · Z 총 · X 폭탄' },
    { g: 'sky', at: '2026-11-14 23:00', t: '1~10스테이지 배경 모두 새 그림' },
    // 블록 대전
    { g: 'battle', at: '2026-11-14 12:45', t: '블록이 바닥에 닿고 0.2초 뒤에 붙어요' },
    // 상점
    { g: 'shop', at: '2026-11-12 12:00', t: '상점 다시 열림' },
    { g: 'shop', at: '2026-11-13 12:00', t: '등 장식 10종' },
    { g: 'shop', at: '2026-11-13 15:00', t: '신발·얼굴 장식·모자' },
    { g: 'shop', at: '2026-11-13 20:00', t: '화려한 상의·하의 20종' },
    // 메이커
    { g: 'maker', at: '2026-11-12 18:00', t: '메이커 메뉴 · 지도 제출·회수' },
    { g: 'maker', at: '2026-11-12 23:00', t: '샘플 지도 10개' },
    { g: 'maker', at: '2026-11-13 22:30', t: '몬스터 종류마다 레벨·마릿수' }
  ];
  const MAX = 3, SHOW_MS = 5000, KEY = 'gogo.upd.';
  const NAMES = { shop: '상점', maker: '메이커', closet: '옷장' };
  const kst = s => Date.parse(s.replace(' ', 'T') + ':00+09:00');
  // 가장 최근 한국 시간 오전 6시 (ms)
  function lastSix(now) {
    const k = new Date(now + 9 * 3600e3);   // UTC 값으로 한국 시간 읽기
    let six = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), 6) - 9 * 3600e3;
    if (six > now) six -= 24 * 3600e3;
    return six;
  }
  function items(g, now) {
    const end = lastSix(now), start = end - 48 * 3600e3;
    return LIST.filter(u => u.g === g).map(u => Object.assign({ ms: kst(u.at) }, u))
      .filter(u => u.ms >= start && u.ms < end).sort((a, b) => b.ms - a.ms);
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let el = null, timer = 0;
  function hide() { clearTimeout(timer); if (el) { el.classList.remove('on'); const e = el; setTimeout(() => e.remove(), 300); el = null; } }
  function show(g, opt) {
    opt = opt || {}; hide();
    if (!g) return;
    const now = opt.now || Date.now(), list = items(g, now);
    if (!list.length) return;
    const day = String(lastSix(now));
    if (!opt.force) { try { if (localStorage.getItem(KEY + g) === day) return; localStorage.setItem(KEY + g, day); } catch (e) { /* noop */ } }
    let name = NAMES[g] || g;
    try { const s = window.GoSettings && window.GoSettings.get(g); if (s && s.name) name = s.name; } catch (e) { /* noop */ }
    const more = list.length > MAX ? ` <small>외 ${list.length - MAX}개</small>` : '';
    el = document.createElement('div'); el.className = 'gu-strip'; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="gu-ic">📢</span><span class="gu-tx"><b>${esc(name)} 업데이트</b> ${list.slice(0, MAX).map(u => `<span class="gu-it">${esc(u.t)}</span>`).join('')}${more}</span><button type="button" class="gu-x" aria-label="닫기">✕</button>`;
    el.querySelector('.gu-x').addEventListener('click', hide);
    const hd = document.querySelector('header'); el.style.top = Math.max(8, Math.round(hd ? hd.getBoundingClientRect().bottom + 8 : 64)) + 'px';   // 메뉴 바로 아래
    document.body.appendChild(el); requestAnimationFrame(() => el && el.classList.add('on'));
    timer = setTimeout(hide, SHOW_MS);
  }
  window.GoUpdates = { LIST, show, hide, items, lastSix };
})();
