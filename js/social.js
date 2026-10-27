/*
 * gogo?gogo! — 게임 화면의 채팅 · 댓글/피드백 (GoSocial)
 *  - chatHTML() / mountChat(gameId, ui)        : 오른쪽 채팅 칸 (실시간, 비속어 모자이크)
 *  - commentsHTML() / mountComments(gameId, ui) : 게임 화면 아래 댓글·피드백
 *  - mount 함수는 화면을 떠날 때 부를 정리 함수를 돌려줍니다.
 */
(function () {
  'use strict';
  const Hub = window.GameHub, F = window.GoFilter, AV = window.GoAvatar;
  const $ = (s, r) => (r || document).querySelector(s);
  const hhmm = iso => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  /* ---------------- 채팅 ---------------- */
  function chatHTML() {
    return `<div class="panel chat-panel">
      <h3>채팅 <small id="chatPeers">연결 중…</small></h3>
      <ol class="chat-log" id="chatLog" aria-live="polite" aria-label="채팅 내용"><li class="chat-empty">불러오는 중…</li></ol>
      <div id="chatForm"></div>
      <p class="chat-note">욕설·비속어는 자동으로 가려져요.</p>
    </div>`;
  }
  function mountChat(game, ui) {
    const log = $('#chatLog'), peersEl = $('#chatPeers'), formBox = $('#chatForm');
    if (!log) return () => {};
    let alive = true, room = null;
    const seen = new Set();
    const line = m => {
      const mine = Hub.user && m.user_id === Hub.user.id;
      return `<li class="${mine ? 'mine' : ''}"><b class="chat-nick">${ui.esc(m.nickname || '?')}</b><span class="chat-body">${F.html(m.body)}</span><time datetime="${ui.esc(m.created_at)}">${hhmm(m.created_at)}</time></li>`;
    };
    const atBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 30;
    function add(m) {
      if (!alive || !m || seen.has(m.id)) return;
      seen.add(m.id);
      const stick = atBottom(), empty = log.querySelector('.chat-empty');
      if (empty) empty.remove();
      log.insertAdjacentHTML('beforeend', line(m));
      while (log.children.length > 80) log.firstElementChild.remove();
      if (stick) log.scrollTop = log.scrollHeight;
    }
    function renderForm() {
      if (!formBox.isConnected) return;
      if (!Hub.user) { formBox.innerHTML = '<button class="btn btn-sm btn-block" type="button" data-auth="login">로그인하고 채팅하기</button>'; return; }
      if (Hub.user.banned) { formBox.innerHTML = '<p class="chat-note bad">이용이 정지된 계정이라 채팅할 수 없어요.</p>'; return; }
      formBox.innerHTML = `<form class="chat-form" novalidate><label class="sr-only" for="chatInput">채팅 메시지</label>
        <input id="chatInput" maxlength="120" autocomplete="off" placeholder="메시지 입력 후 Enter"><button class="btn btn-sm" type="submit">보내기</button></form>`;
      const form = formBox.querySelector('form'), input = form.querySelector('input'), btn = form.querySelector('button');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const text = input.value.trim(); if (!text || !room) return;
        btn.disabled = true;
        try { const row = await room.send(text); input.value = ''; add(row); }
        catch (err) { ui.toast(err.message); }
        finally { btn.disabled = false; input.focus(); }
      });
    }
    Hub.chatHistory(game, 40).then(rows => {
      if (!alive) return;
      log.innerHTML = rows.length ? '' : '<li class="chat-empty">아직 대화가 없어요. 먼저 인사해 보세요!</li>';
      rows.forEach(add); log.scrollTop = log.scrollHeight;
    }).catch(err => { if (alive) log.innerHTML = `<li class="chat-empty">${ui.esc(err.message)}</li>`; });
    try {
      room = Hub.chatRoom(game, {
        onMsg: add,
        onPeers: list => { if (peersEl.isConnected) peersEl.textContent = '지금 ' + Math.max(1, list.length) + '명'; }
      });
    } catch (e) { peersEl.textContent = '연결 안 됨'; }
    renderForm();
    const off = Hub.onChange(renderForm);
    return () => { alive = false; off(); if (room) room.leave(); };
  }

  /* ---------------- 댓글 · 피드백 ---------------- */
  function commentsHTML(name) {
    return `<section class="panel comments" aria-labelledby="cmTitle">
      <h3 id="cmTitle">${name} 댓글 <small id="cmCount"></small></h3>
      <div id="cmForm"></div>
      <ul class="cm-list" id="cmList"><li class="cm-empty">불러오는 중…</li></ul>
    </section>`;
  }
  function mountComments(game, ui) {
    const formBox = $('#cmForm'), list = $('#cmList'), count = $('#cmCount');
    if (!list) return () => {};
    let alive = true, kind = 'comment', rating = 0, rows = [];
    const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
    function item(c) {
      const mine = Hub.user && c.user_id === Hub.user.id, admin = Hub.isAdmin();
      const tags = (c.kind === 'feedback' ? '<span class="cm-tag fb">피드백</span>' : '') + (c.hidden ? '<span class="cm-tag hid">숨김</span>' : '');
      return `<li class="cm-item ${c.kind === 'feedback' ? 'is-fb' : ''}" data-id="${c.id}">
        ${ui.avCanvas(c.avatar, 2, 'bust', 'cm-av')}
        <div class="cm-main"><div class="cm-meta"><b>${ui.esc(c.nickname)}</b>${tags}${c.rating ? `<span class="cm-stars" aria-label="별점 ${c.rating}점">${stars(c.rating)}</span>` : ''}<time datetime="${ui.esc(c.created_at)}">${ui.ago(c.created_at)}</time></div>
          <p class="cm-body">${F.html(c.body)}</p></div>
        ${mine || admin ? `<div class="cm-act">${admin && c.kind === 'comment' ? `<button class="link" type="button" data-cm-hide="${c.hidden ? 0 : 1}">${c.hidden ? '보이기' : '숨기기'}</button>` : ''}<button class="link" type="button" data-cm-del>지우기</button></div>` : ''}
      </li>`;
    }
    function renderList() {
      if (!alive) return;
      const pub = rows.filter(c => c.kind === 'comment' && !c.hidden).length;
      count.textContent = pub + '개';
      list.innerHTML = rows.length ? rows.map(item).join('') : '<li class="cm-empty">첫 댓글을 남겨 보세요. 고칠 점은 \'피드백\'으로 보내 주면 관리자에게만 전달돼요.</li>';
      AV.paintAll(list);
    }
    function renderForm() {
      if (!formBox.isConnected) return;
      if (!Hub.user) { formBox.innerHTML = '<p class="cm-gate">로그인하면 댓글과 피드백을 남길 수 있어요. <button class="link" type="button" data-auth="login">로그인</button></p>'; return; }
      if (Hub.user.banned) { formBox.innerHTML = '<p class="cm-gate bad">이용이 정지된 계정이라 댓글을 쓸 수 없어요.</p>'; return; }
      formBox.innerHTML = `<form class="cm-form" novalidate>
        <div class="cm-kind" role="radiogroup" aria-label="글 종류">
          <button type="button" role="radio" data-kind="comment" aria-checked="${kind === 'comment'}">댓글</button>
          <button type="button" role="radio" data-kind="feedback" aria-checked="${kind === 'feedback'}">피드백 <small>관리자에게만</small></button>
        </div>
        <div class="cm-rate" ${kind === 'feedback' ? '' : 'hidden'} role="radiogroup" aria-label="별점">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" data-rate="${n}" aria-checked="${rating === n}" aria-label="${n}점">${n <= rating ? '★' : '☆'}</button>`).join('')}<span class="small">별점 (선택)</span></div>
        <label class="sr-only" for="cmInput">내용</label>
        <textarea id="cmInput" maxlength="300" rows="2" placeholder="${kind === 'feedback' ? '좋았던 점, 고칠 점, 버그를 알려 주세요' : '게임 어땠나요? 바르고 고운 말로 남겨 주세요'}"></textarea>
        <div class="cm-foot"><span class="small" id="cmLen">0 / 300</span><button class="btn btn-sm btn-primary" type="submit">${kind === 'feedback' ? '피드백 보내기' : '댓글 올리기'}</button></div>
      </form>`;
      const form = formBox.querySelector('form'), ta = form.querySelector('textarea'), len = form.querySelector('#cmLen');
      ta.addEventListener('input', () => { len.textContent = ta.value.length + ' / 300'; });
      form.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => { const keep = ta.value; kind = b.dataset.kind; renderForm(); const t = formBox.querySelector('textarea'); t.value = keep; t.dispatchEvent(new Event('input')); }));
      form.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => { const keep = ta.value; rating = +b.dataset.rate === rating ? 0 : +b.dataset.rate; renderForm(); const t = formBox.querySelector('textarea'); t.value = keep; t.dispatchEvent(new Event('input')); }));
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('[type=submit]'); btn.disabled = true;
        try {
          const c = await Hub.addComment({ game_id: game, body: ta.value, kind, rating });
          rows.unshift(c); renderList();
          ui.toast(kind === 'feedback' ? '피드백을 보냈어요. 고마워요!' : '댓글을 올렸어요.');
          rating = 0; renderForm();
        } catch (err) { ui.toast(err.message); btn.disabled = false; }
      });
    }
    async function load() {
      try { rows = await Hub.listComments(game); } catch (err) { if (alive) list.innerHTML = `<li class="cm-empty">${ui.esc(err.message)}</li>`; return; }
      renderList();
    }
    list.addEventListener('click', async e => {
      const li = e.target.closest('[data-id]'); if (!li) return;
      const id = isNaN(+li.dataset.id) ? li.dataset.id : +li.dataset.id;
      const del = e.target.closest('[data-cm-del]'), hide = e.target.closest('[data-cm-hide]');
      try {
        if (del) {
          if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = '정말 지울까요?'; return; }
          await Hub.deleteComment(id); rows = rows.filter(c => c.id !== id); renderList(); ui.toast('지웠어요.');
        } else if (hide) {
          await Hub.setCommentHidden(id, hide.dataset.cmHide === '1');
          const c = rows.find(x => x.id === id); if (c) c.hidden = hide.dataset.cmHide === '1'; renderList();
        }
      } catch (err) { ui.toast(err.message); }
    });
    renderForm(); load();
    const off = Hub.onChange(() => { renderForm(); load(); });
    return () => { alive = false; off(); };
  }

  window.GoSocial = { chatHTML, mountChat, commentsHTML, mountComments };
})();
