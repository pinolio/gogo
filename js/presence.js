/*
 * gogo?gogo! — 실시간 접속자 기록 (GoPresence) · v35
 *  - 선생님 요청(2026-10-30): "관리자 메뉴에 '실시간 접속자' — 지금 접속한 사람 수가 위에, 아래에 지금 플레이하면서 접속 시간이 긴 사람부터 30명"
 *  - 방식: 사이트를 연 창(손님 포함)이 **1분마다** 서버에 "아직 여기 있어요 + 지금 보는 게임"을 한 줄 고쳐 씀 (Hub.onlinePing)
 *    · 게임을 바꾸면 0.8초 뒤 바로 한 번 더. 창을 닫으면 지움(Hub.onlineLeave). 관리자 화면은 최근 2분 안에 기록한 창만 셈
 *    · 실시간 연결(Realtime)을 쓰지 않음 → Supabase 무료 요금제의 동시 연결 200개 · 초당 메시지 100개 · 접속 알림 초당 20개 제한과 상관없고,
 *      온라인 대전 연결에도 영향 없음 (처음 v35 는 Realtime 방식이었다가 선생님과 상의해 이 방식으로 바꿈)
 *    · 서버: supabase/online_v35.sql (site_online 표 + online_ping · online_leave · admin_online 함수)
 *  - 보내는 것: 창 번호(이 탭에서만 쓰는 무작위 글자), 지금 게임 id, 휴대폰 여부. 회원 여부는 서버가 로그인 정보로 알아냄
 */
(function () {
  'use strict';
  const Hub = window.GameHub, SET = window.GoSettings;
  if (!Hub || !Hub.onlinePing) return;
  const PING_MS = 60000;
  const cid = (() => {
    const k = 'gogogogo.cid';
    try { const v = sessionStorage.getItem(k); if (v && /^[a-z0-9]{6,24}$/.test(v)) return v; } catch (e) { /* noop */ }
    let v = ''; const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 16; i++) v += a[Math.floor(Math.random() * a.length)];
    try { sessionStorage.setItem(k, v); } catch (e) { /* noop */ }
    return v;
  })();
  const mobile = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } })();
  const gameOf = () => { const h = decodeURIComponent(location.hash.slice(1)); return SET && SET.get(h) ? h : ''; };
  let started = false, iv = 0, soon = 0, last = { g: null, u: null, t: 0 };
  function ping(force) {
    const g = gameOf(), u = Hub.user ? Hub.user.id : null, now = Date.now();
    if (!force && g === last.g && u === last.u && now - last.t < PING_MS - 2000) return;   // 바뀐 것이 없으면 1분에 한 번만
    last = { g, u, t: now };
    Promise.resolve(Hub.onlinePing(cid, g, mobile)).catch(() => {});
  }
  function start() {
    if (started) return; started = true;
    ping(true);
    iv = setInterval(() => ping(false), PING_MS);
  }
  const later = () => { clearTimeout(soon); soon = setTimeout(() => ping(false), 800); };
  window.addEventListener('hashchange', later);
  Hub.onChange(() => { if (started) later(); });
  // 창을 닫으면 지움 (새로고침 때도 한 번 지웠다가 다시 기록 → 접속 시간이 새로 시작됨)
  window.addEventListener('pagehide', () => { if (started) { try { Hub.onlineLeave(cid); } catch (e) { /* noop */ } } });
  // 다시 보이면(휴대폰에서 앱으로 돌아오면) 바로 한 번
  document.addEventListener('visibilitychange', () => { if (!document.hidden && started) ping(true); });
  if (document.readyState === 'complete') setTimeout(start, 500); else window.addEventListener('load', () => setTimeout(start, 500));

  window.GoPresence = { id: () => cid, ping: () => ping(true) };
})();
