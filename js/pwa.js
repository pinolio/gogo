/* 고고고고 — 앱 설치(PWA) 담당: 휴대폰·노트북 홈 화면에 앱처럼 설치 */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const isSamsung = /samsungbrowser/i.test(ua);
  const isKakao = /kakaotalk/i.test(ua);
  let deferred = null;

  if (standalone) document.documentElement.classList.add('is-app');
  const btn = $('#installBtn');
  const show = () => { if (!standalone && btn) btn.hidden = false; };

  // 서비스 워커 등록 (https 또는 localhost에서만 동작)
  if ('serviceWorker' in navigator && /^https:|^http:\/\/(localhost|127\.0\.0\.1)/.test(location.href)) {
    navigator.serviceWorker.register('./sw.js').then(show).catch(() => { /* 미리보기 등 지원하지 않는 환경 */ });
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show(); });
  window.addEventListener('appinstalled', () => { deferred = null; if (btn) btn.hidden = true; closeGuide(); });

  function guideHTML() {
    if (isKakao) return `<p>카카오톡 안에서는 설치할 수 없어요.</p><ol><li>오른쪽 아래 <b>⋮</b> 또는 <b>공유</b> 버튼을 누르세요.</li><li><b>다른 브라우저로 열기</b>를 고른 뒤 크롬이나 사파리에서 다시 설치해 주세요.</li></ol>`;
    if (isIOS) return `<p>아이폰·아이패드는 <b>사파리</b>에서 설치해요.</p><ol><li>화면 아래(아이패드는 위)의 <b>공유 버튼 ⬆︎</b>을 누르세요.</li><li><b>홈 화면에 추가</b>를 누르세요.</li><li>오른쪽 위 <b>추가</b>를 누르면 홈 화면에 gogo?gogo! 아이콘이 생겨요.</li></ol>`;
    if (isSamsung) return `<ol><li>아래쪽 메뉴 <b>≡</b>를 누르세요.</li><li><b>현재 페이지 추가 → 홈 화면</b>을 고르세요.</li></ol>`;
    if (isAndroid) return `<ol><li>크롬 오른쪽 위 <b>⋮</b> 메뉴를 누르세요.</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 고르세요.</li></ol>`;
    return `<p>노트북·PC에서는 <b>크롬</b> 또는 <b>엣지</b>에서 설치할 수 있어요.</p><ol><li>주소창 오른쪽의 <b>설치 아이콘(⊕ 또는 모니터 모양)</b>을 누르세요.</li><li>보이지 않으면 <b>⋮ 메뉴 → 전송, 저장 및 공유 → 페이지를 앱으로 설치</b>를 고르세요.</li><li>설치하면 바탕화면·시작 메뉴에서 바로 실행돼요.</li></ol>`;
  }
  function openGuide() {
    $('#installGuide').innerHTML = guideHTML();
    $('#installModal').hidden = false;
  }
  function closeGuide() { const m = $('#installModal'); if (m) m.hidden = true; }

  if (btn) btn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === 'accepted') btn.hidden = true;
      return;
    }
    openGuide();
  });
  const modal = $('#installModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) closeGuide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeGuide(); });

  window.GoPWA = { standalone, openGuide };
})();
