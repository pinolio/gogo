/*
 * gogo?gogo! — 로그인 팝업 배너 (GoBanner) · v33
 *  - 선생님 요청(2026-10-29): "배너도 넣을 수 있어? 새 창으로? 작게. 관리자 아이디에서 관리할 수 있게 · 로그인하면 뜨게"
 *  - 로그인하면 화면 위쪽 가운데에 작은 팝업 창이 뜸 (그림 + 제목 + 내용). 누르면 링크가 **새 탭**으로 열림
 *    ※ 브라우저의 진짜 새 창(window.open)은 로그인처럼 잠깐 기다린 뒤 띄우면 팝업 차단에 막히므로 화면 안 팝업으로 만듦
 *  - 같은 브라우저 창(탭)에서는 한 번만 뜸 (로그아웃 후 다시 로그인하면 다시 뜸). '오늘 하루 보지 않기'를 누르면 그날은 안 뜸
 *  - 관리자가 배너 내용을 바꾸면(저장 시각이 바뀌면) 다시 뜸
 *  - 내용 관리: 관리자 설정 → '배너' 탭 (js/admin.js), 저장 위치: Supabase site_banner 표 (supabase/banner_v33.sql)
 */
(function () {
  'use strict';
  const Hub = window.GameHub;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const today = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); };   // 한국 날짜
  const ss = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* noop */ } } };
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } } };
  const KEY_HIDE = 'gogogogo.banner.hideDay';      // '오늘 하루 보지 않기' 날짜|배너 시각
  const KEY_SEEN = 'gogogogo.banner.seen';         // 이 탭에서 본 사람|배너 시각

  let box = null, lastUid;
  function close() { if (box) { box.remove(); box = null; document.removeEventListener('keydown', onEsc); } }
  const onEsc = e => { if (e.key === 'Escape') close(); };

  // b: { title, body, image, link, updated_at }, opt.preview = 관리자 미리보기 (보지 않기 기록 안 함)
  function show(b, opt) {
    opt = opt || {};
    close();
    if (!b) return;
    const ver = b.updated_at || '';
    const main = `${b.image ? `<img class="bn-img" src="${esc(b.image)}" alt="">` : ''}
      ${b.title ? `<b class="bn-title">${esc(b.title)}</b>` : ''}
      ${b.body ? `<p class="bn-body">${esc(b.body).replace(/\n/g, '<br>')}</p>` : ''}
      ${b.link ? '<span class="bn-go">자세히 보기 ↗ <small>(새 탭)</small></span>' : ''}`;
    box = document.createElement('div');
    box.className = 'bn-pop' + (opt.preview ? ' is-preview' : '');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '알림 배너');
    box.innerHTML = `
      <div class="bn-head"><span>${opt.preview ? '미리보기 · ' : ''}알림</span><button type="button" class="bn-x" aria-label="닫기">✕</button></div>
      ${b.link ? `<a class="bn-main" href="${esc(b.link)}" target="_blank" rel="noopener noreferrer">${main}</a>` : `<div class="bn-main">${main}</div>`}
      <div class="bn-foot"><label><input type="checkbox" class="bn-hide"> 오늘 하루 보지 않기</label><button type="button" class="bn-close">닫기</button></div>`;
    document.body.appendChild(box);
    const done = () => { if (!opt.preview && box && box.querySelector('.bn-hide').checked) ls.set(KEY_HIDE, today() + '|' + ver); close(); };
    box.querySelector('.bn-x').addEventListener('click', done);
    box.querySelector('.bn-close').addEventListener('click', done);
    const a = box.querySelector('a.bn-main'); if (a) a.addEventListener('click', () => setTimeout(done, 50));
    document.addEventListener('keydown', onEsc);
  }

  // 로그인했을 때 보여 줄지 정하기
  async function maybe(u) {
    let b = null;
    try { b = await Hub.getBanner(); } catch (e) { return; }
    if (!b || !b.enabled || (!b.title && !b.body && !b.image)) return;
    if (!Hub.user || Hub.user.id !== u.id) return;            // 그사이 로그아웃
    const ver = b.updated_at || '';
    if (ls.get(KEY_HIDE) === today() + '|' + ver) return;    // 오늘 하루 보지 않기
    if (ss.get(KEY_SEEN) === u.id + '|' + ver) return;       // 이 탭에서 이미 봄
    ss.set(KEY_SEEN, u.id + '|' + ver);
    setTimeout(() => show(b), 400);
  }
  /* ---- v75 시즌 1위 쪽지 ----
   *  로그인하면 지난 시즌을 정산(Hub.seasonSettle — 서버가 1위 계산·+50P, 두 번 주지 않음)하고
   *  아직 안 읽은 상이 있으면 쪽지 창: '11월 시즌 스네이크 1등! +50P'. [확인] → 읽음(다시 안 뜸) */
  const gameName = id => {
    const S = window.GoSettings; if (!S) return id;
    const g = S.get(id) || S.listAll().find(x => x.rankId === id);
    return g ? g.name : id;
  };
  const scoreText = (id, v) => {
    const S = window.GoSettings, g = S && (S.get(id) || S.listAll().find(x => x.rankId === id));
    if (g && g.seasonWins) return v + '승';
    return g && g.scoreText ? g.scoreText(v) : Number(v || 0).toLocaleString('ko-KR');
  };
  let note = null;
  function closeNote() { if (note) { note.remove(); note = null; } }
  function showNote(list, onOk) {
    closeNote();
    const sum = list.reduce((a, x) => a + (x.points || 0), 0);
    note = document.createElement('div');
    note.className = 'sn-pop'; note.setAttribute('role', 'dialog'); note.setAttribute('aria-label', '시즌 1등 쪽지');
    note.innerHTML = `
      <div class="sn-card">
        <div class="sn-head">📮 쪽지 도착!</div>
        <div class="sn-body">
          <p class="sn-big">🏆 시즌 1등 축하해요!</p>
          <ul class="sn-list">${list.map(x => `<li><b>${esc(+x.season.slice(5) + '월 시즌')}</b> · <b>${esc(gameName(x.game_id))}</b> 1등 <span class="sn-rec">(기록 ${esc(scoreText(x.game_id, x.score))})</span> <span class="sn-pt">+${x.points}P</span></li>`).join('')}</ul>
          <p class="sn-sum">포인트 <b>+${sum}P</b> 를 받았어요. 상점에서 써 보세요!</p>
        </div>
        <div class="sn-foot"><button type="button" class="btn btn-sun sn-ok">확인</button></div>
      </div>`;
    document.body.appendChild(note);
    note.querySelector('.sn-ok').addEventListener('click', () => { closeNote(); onOk(); });
  }
  async function seasonNote(u) {
    if (!Hub.seasonSettle) return;
    try {
      await Hub.seasonSettle();
      const list = await Hub.seasonInbox();
      if (!list.length || !Hub.user || Hub.user.id !== u.id) return;
      setTimeout(() => showNote(list, () => Hub.seasonAck(list.map(x => x.id)).catch(() => {})), 300);
    } catch (e) { /* 시즌 표가 없으면 조용히 넘어감 */ }
  }

  if (Hub && Hub.onChange) Hub.onChange(u => {
    const uid = u ? u.id : null;
    if (uid && uid !== lastUid) { maybe(u); seasonNote(u); }
    if (!uid) closeNote();
    if (!uid) { close(); if (lastUid) ss.set(KEY_SEEN, ''); }   // 로그아웃하면 다음 로그인 때 다시 뜸
    lastUid = uid;
  });

  window.GoBanner = { show, close, showNote };
})();
