/*
 * gogo?gogo! — 관리자 설정 (GoAdmin)
 *  - 관리자(role = 'admin')에게만 맨 위 메뉴에 보입니다.
 *  - 탭: 전적 종합 · 회원 관리 · 댓글·피드백 · 채팅 기록
 *  - 실제 권한 확인은 서버(Supabase 함수·보안 규칙)가 합니다. 이 화면은 보기 좋게 보여 주는 역할만 해요.
 */
(function () {
  'use strict';
  const Hub = window.GameHub, F = window.GoFilter, AV = window.GoAvatar;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const TABS = [['stats', '전적 종합'], ['members', '회원 관리'], ['comments', '댓글·피드백'], ['chat', '채팅 기록']];
  let tab = 'stats';

  function csv(name, head, rows) {
    const cell = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const text = '﻿' + [head].concat(rows).map(r => r.map(cell).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = name + '.csv'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const day = iso => { const d = new Date(iso); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); };

  function render(root, ui) {
    let alive = true;
    if (!Hub.isAdmin()) {
      root.innerHTML = `<div class="panel gate"><h2>관리자만 들어올 수 있어요</h2><p>관리자 아이디로 로그인해 주세요.</p>
        <div class="row" style="justify-content:center">${Hub.user ? '<a class="btn" href="#home">홈으로</a>' : '<button class="btn btn-primary" type="button" data-auth="login">로그인</button>'}</div></div>`;
      return () => {};
    }
    root.innerHTML = `
      <div class="admin">
        <div class="page-head"><h1>관리자 설정</h1><p>회원, 전적, 댓글·피드백, 채팅을 한곳에서 확인해요. 바꾼 내용은 바로 사이트에 반영돼요.</p></div>
        <div class="admin-tabs" role="tablist">${TABS.map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${n}</button>`).join('')}</div>
        <div id="adminBody" class="admin-body"><p class="empty">불러오는 중…</p></div>
      </div>`;
    const body = $('#adminBody');
    const fail = e => { if (alive) body.innerHTML = `<div class="panel"><p class="err">${ui.esc(e.message)}</p></div>`; };
    $$('[data-tab]', root).forEach(b => b.addEventListener('click', () => {
      tab = b.dataset.tab; $$('[data-tab]', root).forEach(x => x.setAttribute('aria-selected', String(x === b))); show();
    }));
    function show() { body.innerHTML = '<p class="empty">불러오는 중…</p>'; ({ stats, members, comments, chat })[tab]().catch(fail); }

    /* ---------- 전적 종합 ---------- */
    async function stats() {
      const o = await Hub.adminOverview(); if (!alive || tab !== 'stats') return;
      const per = {}; (o.per_game || []).forEach(g => { per[g.game_id] = g; });
      const games = ui.games.map(g => Object.assign({ game_id: g.id, name: g.name, plays: 0, plays_7d: 0, players: 0, wins: 0, losses: 0, avg_sec: 0, best: 0, rating: null, comments: 0 }, per[g.id] || {}, { name: g.name }));
      Object.keys(per).forEach(id => { if (!games.some(g => g.game_id === id)) games.push(Object.assign({ name: ui.nameOf(id) }, per[id])); });
      games.sort((a, b) => b.plays - a.plays);
      // 최근 14일 (빈 날은 0)
      const byDay = {}; (o.daily || []).forEach(d => { byDay[String(d.day).slice(0, 10)] = d; });
      const days = []; for (let i = 13; i >= 0; i--) { const t = new Date(Date.now() + 9 * 3600e3 - i * 864e5).toISOString().slice(0, 10); days.push(Object.assign({ day: t, plays: 0, players: 0 }, byDay[t] || {})); }
      const max = Math.max(1, ...days.map(d => d.plays));
      body.innerHTML = `
        <div class="tiles admin-tiles">
          <div class="tile"><span class="lbl">회원</span><b class="num">${ui.fmt(o.members)}명</b><span class="small">7일 신규 ${ui.fmt(o.members_7d)}명${o.banned ? ' · 정지 ' + o.banned + '명' : ''}</span></div>
          <div class="tile"><span class="lbl">오늘 플레이</span><b class="num">${ui.fmt(o.plays_today)}판</b><span class="small">전체 ${ui.fmt(o.plays)}판</span></div>
          <div class="tile"><span class="lbl">7일 활동 회원</span><b class="num">${ui.fmt(o.players_7d)}명</b></div>
          <div class="tile"><span class="lbl">총 플레이 시간</span><b class="num" style="font-size:15px">${ui.dur(o.total_sec || 0)}</b></div>
          <div class="tile"><span class="lbl">댓글 · 피드백</span><b class="num">${ui.fmt(o.comments)} · ${ui.fmt(o.feedback)}</b><span class="small">7일 채팅 ${ui.fmt(o.chats_7d)}개</span></div>
        </div>
        <div class="panel"><h3>최근 14일 플레이 <small>한국 시간 기준</small></h3>
          <div class="bars" role="img" aria-label="최근 14일 하루 플레이 수">${days.map(d => `<div class="bar" title="${d.day} · ${d.plays}판 · ${d.players}명"><span class="bar-v">${d.plays || ''}</span><i style="height:${Math.round(d.plays / max * 100)}%"></i><span class="bar-d">${+d.day.slice(8)}</span></div>`).join('')}</div>
        </div>
        <div class="panel"><h3>게임별 집계 <small>게임 이름을 누르면 회원별 상세</small> <button class="btn btn-sm" type="button" id="csvGames">CSV 내려받기</button></h3>
          <div class="tbl-wrap"><table><thead><tr><th>게임</th><th class="n">전체 판</th><th class="n">7일 판</th><th class="n">플레이 회원</th><th class="n">승</th><th class="n">패</th><th class="n">평균 시간</th><th class="n">최고 점수</th><th class="n">별점</th><th class="n">댓글</th></tr></thead>
          <tbody id="gRows">${games.map(g => `<tr class="g-row" data-game="${ui.esc(g.game_id)}"><td><button class="link g-open" type="button" aria-expanded="false">${ui.esc(g.name)} ▸</button></td><td class="n">${ui.fmt(g.plays)}</td><td class="n">${ui.fmt(g.plays_7d)}</td><td class="n">${ui.fmt(g.players)}</td><td class="n plus">${ui.fmt(g.wins)}</td><td class="n minus">${ui.fmt(g.losses)}</td><td class="n">${g.plays ? ui.dur(g.avg_sec || 0) : '-'}</td><td class="n">${g.plays ? ui.fmt(g.best) : '-'}</td><td class="n">${g.rating ? '★ ' + g.rating : '-'}</td><td class="n">${ui.fmt(g.comments)}</td></tr>`).join('')}</tbody></table></div>
        </div>`;
      $('#gRows').addEventListener('click', e => {
        const btn = e.target.closest('.g-open'); if (!btn) return;
        const tr = btn.closest('tr'), next = tr.nextElementSibling, open = next && next.classList.contains('g-detail');
        $$('.g-detail', body).forEach(r => r.remove()); $$('.g-open', body).forEach(b => { b.setAttribute('aria-expanded', 'false'); b.textContent = b.textContent.replace('▾', '▸'); });
        if (open) return;
        btn.setAttribute('aria-expanded', 'true'); btn.textContent = btn.textContent.replace('▸', '▾');
        tr.insertAdjacentHTML('afterend', '<tr class="g-detail"><td colspan="10"><p class="empty">불러오는 중…</p></td></tr>');
        gameDetail(tr.dataset.game, tr.nextElementSibling.firstElementChild).catch(err => { const c = $('.g-detail td', body); if (c) c.innerHTML = `<p class="err">${ui.esc(err.message)}</p>`; });
      });
      $('#csvGames').addEventListener('click', () => csv('게임별집계', ['게임', '전체 판', '7일 판', '플레이 회원', '승', '패', '평균 시간(초)', '최고 점수', '별점', '댓글'], games.map(g => [g.name, g.plays, g.plays_7d, g.players, g.wins, g.losses, g.avg_sec, g.best, g.rating, g.comments])));
    }

    // 게임 하나: 회원별 판수·승·패·무
    async function gameDetail(game, cell) {
      const rows = await Hub.adminGameRecords(game); if (!alive || !cell.isConnected) return;
      const per = {};
      rows.forEach(r => {
        const x = per[r.user_id] || (per[r.user_id] = { nickname: r.nickname, username: r.username, avatar: r.avatar, plays: 0, win: 0, lose: 0, draw: 0, local: 0, best: 0, sec: 0, last: null });
        const ex = r.extra || {}, draw = ex.winner === -1 && r.result == null;
        x.plays++; x.sec += r.duration_sec || 0; x.best = Math.max(x.best, r.score || 0);
        if (r.result === 'win') x.win++; else if (r.result === 'lose') x.lose++; else if (draw) x.draw++; else if (ex.mode === 'local') x.local++;
        if (!x.last || r.played_at > x.last) x.last = r.played_at;
      });
      const list = Object.values(per).sort((a, b) => b.plays - a.plays);
      const name = ui.nameOf(game), rate = x => (x.win + x.lose + x.draw ? Math.round(x.win / (x.win + x.lose + x.draw) * 100) + '%' : '-');
      cell.innerHTML = list.length ? `<div class="g-detail-in">
        <div class="g-detail-head"><b>${ui.esc(name)}</b> · 회원 ${list.length}명 · ${ui.fmt(rows.length)}판<button class="btn btn-sm" type="button" data-csv>CSV</button></div>
        <div class="tbl-wrap"><table class="admin-tbl"><thead><tr><th>회원</th><th class="n">판수</th><th class="n">승</th><th class="n">패</th><th class="n">무</th><th class="n">승률</th><th class="n">친구 대전</th><th class="n">최고 점수</th><th class="n">총 시간</th><th>마지막</th></tr></thead>
        <tbody>${list.map(x => `<tr><td><span class="nm">${ui.avCanvas(x.avatar, 1, 'bust', 'rk-av')}<b>${ui.esc(x.nickname || '?')}</b> <span class="small">@${ui.esc(x.username || '')}</span></span></td><td class="n">${ui.fmt(x.plays)}</td><td class="n plus">${x.win}</td><td class="n minus">${x.lose}</td><td class="n">${x.draw}</td><td class="n">${rate(x)}</td><td class="n">${x.local || '-'}</td><td class="n">${ui.fmt(x.best)}</td><td class="n">${ui.dur(x.sec)}</td><td>${ui.ago(x.last)}</td></tr>`).join('')}</tbody></table></div>
        <p class="small">무 = 무승부로 끝난 판 · 친구 대전 = 한 기기로 친구와 둔 판(승패·포인트 없이 기록만)</p></div>` : '<p class="empty">아직 이 게임 기록이 없어요.</p>';
      AV.paintAll(cell);
      const b = cell.querySelector('[data-csv]');
      if (b) b.addEventListener('click', () => csv(name + '_회원별', ['닉네임', '아이디', '판수', '승', '패', '무', '승률', '친구 대전', '최고 점수', '총 시간(초)', '마지막 플레이'], list.map(x => [x.nickname, x.username, x.plays, x.win, x.lose, x.draw, rate(x), x.local, x.best, x.sec, x.last || ''])));
    }

    /* ---------- 회원 관리 ---------- */
    let mq = '', mf = 'all';
    async function members() {
      let list = await Hub.adminMembers(); if (!alive || tab !== 'members') return;
      list = list.filter(m => !m.sample);
      body.innerHTML = `
        <div class="panel">
          <div class="admin-tools">
            <label class="sr-only" for="mSearch">회원 찾기</label><input id="mSearch" type="search" placeholder="닉네임·아이디로 찾기" value="${ui.esc(mq)}">
            <div class="mini-tabs">${[['all', '전체'], ['banned', '정지'], ['admin', '관리자']].map(([k, n]) => `<button type="button" data-mf="${k}" aria-pressed="${mf === k}">${n}</button>`).join('')}</div>
            <span class="small" id="mCount"></span>
            <button class="btn btn-sm" type="button" id="csvMembers">CSV 내려받기</button>
          </div>
          <div class="tbl-wrap"><table class="admin-tbl"><thead><tr><th>회원</th><th>아이디</th><th class="n">Lv</th><th class="n">포인트</th><th class="n">판수</th><th class="n">댓글</th><th>최근 플레이</th><th>가입일</th><th>상태</th><th></th></tr></thead><tbody id="mRows"></tbody></table></div>
        </div>`;
      const rowsEl = $('#mRows');
      function draw() {
        const q = mq.trim().toLowerCase();
        const shown = list.filter(m => (!q || (m.nickname || '').toLowerCase().includes(q) || (m.username || '').includes(q)) && (mf === 'all' || (mf === 'banned' ? m.banned : m.role === 'admin')));
        $('#mCount').textContent = shown.length + '명';
        rowsEl.innerHTML = shown.map(m => `<tr data-uid="${m.id}" class="${m.banned ? 'is-banned' : ''}">
          <td><span class="nm">${ui.avCanvas(m.avatar, 1, 'bust', 'rk-av')}<b>${ui.esc(m.nickname)}</b></span>${F.has(m.nickname) ? ' <span class="cm-tag hid">비속어</span>' : ''}</td>
          <td>@${ui.esc(m.username)}</td><td class="n">${Hub.levelInfo(m.earned).level}</td><td class="n">${ui.fmt(m.points)}P</td><td class="n">${ui.fmt(m.plays)}</td><td class="n">${ui.fmt(m.comments)}</td>
          <td>${ui.ago(m.last_played)}</td><td>${m.created_at ? day(m.created_at) : '-'}</td>
          <td>${m.role === 'admin' ? '<span class="cm-tag fb">관리자</span>' : ''}${m.banned ? '<span class="cm-tag hid">정지</span>' : m.role === 'admin' ? '' : '정상'}</td>
          <td><button class="btn btn-sm" type="button" data-manage>관리</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty">해당하는 회원이 없어요.</td></tr>';
        AV.paintAll(rowsEl);
      }
      draw();
      $('#mSearch').addEventListener('input', e => { mq = e.target.value; draw(); });
      $$('[data-mf]', body).forEach(b => b.addEventListener('click', () => { mf = b.dataset.mf; $$('[data-mf]', body).forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); }));
      $('#csvMembers').addEventListener('click', () => csv('회원목록', ['닉네임', '아이디', '레벨', '포인트', '누적 포인트', '판수', '댓글', '최근 플레이', '가입일', '관리자', '정지'], list.map(m => [m.nickname, m.username, Hub.levelInfo(m.earned).level, m.points, m.earned, m.plays, m.comments, m.last_played || '', m.created_at || '', m.role === 'admin' ? 'O' : '', m.banned ? 'O' : ''])));
      rowsEl.addEventListener('click', e => {
        const b = e.target.closest('[data-manage]'); if (!b) return;
        const tr = b.closest('tr'), m = list.find(x => x.id === tr.dataset.uid);
        const open = tr.nextElementSibling && tr.nextElementSibling.classList.contains('manage-row');
        $$('.manage-row', rowsEl).forEach(r => r.remove());
        if (open) return;
        const me = Hub.user && m.id === Hub.user.id;
        tr.insertAdjacentHTML('afterend', `<tr class="manage-row"><td colspan="10"><div class="manage">
          <form class="mg" data-act="points"><label>포인트 주기/빼기 <input type="number" step="1" min="-999" max="999" placeholder="예: 5 또는 -3" required></label><button class="btn btn-sm" type="submit">적용</button></form>
          <form class="mg" data-act="nickname"><label>닉네임 바꾸기 <input maxlength="10" value="${ui.esc(m.nickname)}" required></label><button class="btn btn-sm" type="submit">바꾸기</button></form>
          <div class="mg">${m.banned ? '<button class="btn btn-sm" type="button" data-do="unban">정지 풀기</button>' : `<button class="btn btn-sm btn-danger" type="button" data-do="ban" ${me ? 'disabled' : ''}>이용 정지</button>`}
            <button class="btn btn-sm" type="button" data-do="reset_records">전적 모두 지우기</button>
            ${m.role === 'admin' ? `<button class="btn btn-sm" type="button" data-do="remove_admin" ${me ? 'disabled' : ''}>관리자 해제</button>` : '<button class="btn btn-sm" type="button" data-do="make_admin">관리자로 지정</button>'}</div>
          <p class="small">이용 정지: 게임 기록 저장·댓글·채팅이 막혀요(게임은 할 수 있음). 비밀번호 초기화·계정 삭제는 Supabase 대시보드 Authentication에서 할 수 있어요.</p>
        </div></td></tr>`);
        const box = tr.nextElementSibling;
        const run = async (act, val, label) => {
          try { await Hub.adminMember(m.id, act, val); ui.toast(m.nickname + ' · ' + label); members(); }
          catch (err) { ui.toast(err.message); }
        };
        $$('form.mg', box).forEach(f => f.addEventListener('submit', ev => {
          ev.preventDefault(); const v = f.querySelector('input').value.trim(); if (!v) return;
          if (f.dataset.act === 'points') run('points', parseInt(v, 10), '포인트 ' + (v > 0 ? '+' : '') + v + 'P');
          else run('nickname', v, '닉네임 변경');
        }));
        $$('[data-do]', box).forEach(btn => btn.addEventListener('click', () => {
          const act = btn.dataset.do, label = btn.textContent;
          if (['ban', 'reset_records', 'make_admin', 'remove_admin'].includes(act) && btn.dataset.sure !== '1') { btn.dataset.sure = '1'; btn.textContent = '한 번 더 누르면 ' + label; return; }
          run(act, null, label.replace('한 번 더 누르면 ', ''));
        }));
      });
    }

    /* ---------- 댓글 · 피드백 ---------- */
    let cg = '', ck = '', cbad = false;
    const gameOpts = sel => '<option value="">모든 게임</option>' + ui.games.map(g => `<option value="${g.id}" ${sel === g.id ? 'selected' : ''}>${ui.esc(g.name)}</option>`).join('');
    async function comments() {
      body.innerHTML = `
        <div class="panel">
          <div class="admin-tools">
            <label class="sr-only" for="cGame">게임</label><select id="cGame">${gameOpts(cg)}</select>
            <div class="mini-tabs">${[['', '전체'], ['comment', '댓글'], ['feedback', '피드백']].map(([k, n]) => `<button type="button" data-ck="${k}" aria-pressed="${ck === k}">${n}</button>`).join('')}</div>
            <label class="chk"><input type="checkbox" id="cBad" ${cbad ? 'checked' : ''}> 비속어 포함만</label>
            <span class="small" id="cCount"></span><button class="btn btn-sm" type="button" id="csvComments">CSV 내려받기</button>
          </div>
          <div id="cSummary"></div>
          <ul class="cm-list admin-cm" id="cRows"><li class="cm-empty">불러오는 중…</li></ul>
        </div>`;
      $('#cGame').addEventListener('change', e => { cg = e.target.value; comments(); });
      $$('[data-ck]', body).forEach(b => b.addEventListener('click', () => { ck = b.dataset.ck; comments(); }));
      $('#cBad').addEventListener('change', e => { cbad = e.target.checked; comments(); });
      let rows = await Hub.adminComments({ game: cg || null, kind: ck || null, limit: 500 }); if (!alive || tab !== 'comments') return;
      if (cbad) rows = rows.filter(c => F.has(c.body));
      $('#cCount').textContent = rows.length + '개';
      // 피드백 별점 요약
      const fb = rows.filter(c => c.kind === 'feedback'), rated = {};
      fb.filter(c => c.rating).forEach(c => { const r = rated[c.game_id] || (rated[c.game_id] = { n: 0, s: 0 }); r.n++; r.s += c.rating; });
      $('#cSummary').innerHTML = Object.keys(rated).length ? `<div class="rate-sum">${Object.entries(rated).map(([g, r]) => `<span><b>${ui.esc(ui.nameOf(g))}</b> ★ ${(r.s / r.n).toFixed(1)} <small>(${r.n}명)</small></span>`).join('')}</div>` : '';
      const el = $('#cRows');
      el.innerHTML = rows.map(c => `<li class="cm-item ${c.kind === 'feedback' ? 'is-fb' : ''} ${c.hidden ? 'is-hidden' : ''}" data-id="${c.id}">
        ${ui.avCanvas(c.avatar, 2, 'bust', 'cm-av')}
        <div class="cm-main"><div class="cm-meta"><span class="cm-game">${ui.esc(ui.nameOf(c.game_id))}</span><b>${ui.esc(c.nickname)}</b><span class="small">@${ui.esc(c.username || '')}</span>
          ${c.kind === 'feedback' ? '<span class="cm-tag fb">피드백</span>' : ''}${c.hidden ? '<span class="cm-tag hid">숨김</span>' : ''}${c.rating ? `<span class="cm-stars">${'★'.repeat(c.rating)}${'☆'.repeat(5 - c.rating)}</span>` : ''}<time>${ui.ago(c.created_at)}</time></div>
          <p class="cm-body">${F.html(c.body, true)}</p></div>
        <div class="cm-act">${c.kind === 'comment' ? `<button class="link" type="button" data-hide="${c.hidden ? 0 : 1}">${c.hidden ? '보이기' : '숨기기'}</button>` : ''}<button class="link" type="button" data-del>지우기</button></div></li>`).join('') || '<li class="cm-empty">해당하는 글이 없어요.</li>';
      AV.paintAll(el);
      $('#csvComments').addEventListener('click', () => csv('댓글피드백', ['게임', '종류', '별점', '닉네임', '아이디', '내용', '숨김', '작성 시각'], rows.map(c => [ui.nameOf(c.game_id), c.kind === 'feedback' ? '피드백' : '댓글', c.rating || '', c.nickname, c.username, c.body, c.hidden ? 'O' : '', c.created_at])));
      el.addEventListener('click', async e => {
        const li = e.target.closest('[data-id]'); if (!li) return;
        const id = isNaN(+li.dataset.id) ? li.dataset.id : +li.dataset.id, del = e.target.closest('[data-del]'), hide = e.target.closest('[data-hide]');
        try {
          if (del) { if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = '정말 지울까요?'; return; } await Hub.deleteComment(id); li.remove(); ui.toast('지웠어요.'); }
          else if (hide) { await Hub.setCommentHidden(id, hide.dataset.hide === '1'); comments(); }
        } catch (err) { ui.toast(err.message); }
      });
    }

    /* ---------- 채팅 기록 ---------- */
    let tg = '', tbad = false;
    async function chat() {
      body.innerHTML = `
        <div class="panel">
          <div class="admin-tools">
            <label class="sr-only" for="tGame">게임</label><select id="tGame">${gameOpts(tg)}</select>
            <label class="chk"><input type="checkbox" id="tBad" ${tbad ? 'checked' : ''}> 비속어 포함만</label>
            <span class="small" id="tCount"></span><span class="small">30일이 지난 대화는 자동으로 지워져요.</span>
          </div>
          <div class="tbl-wrap"><table class="admin-tbl"><thead><tr><th>시각</th><th>게임</th><th>보낸 사람</th><th>내용 (원문)</th><th></th></tr></thead><tbody id="tRows"><tr><td colspan="5" class="empty">불러오는 중…</td></tr></tbody></table></div>
        </div>`;
      $('#tGame').addEventListener('change', e => { tg = e.target.value; chat(); });
      $('#tBad').addEventListener('change', e => { tbad = e.target.checked; chat(); });
      let rows = await Hub.adminChat({ game: tg || null, limit: 500 }); if (!alive || tab !== 'chat') return;
      if (tbad) rows = rows.filter(m => F.has(m.body));
      $('#tCount').textContent = rows.length + '개';
      const el = $('#tRows');
      el.innerHTML = rows.map(m => `<tr data-id="${m.id}"><td>${day(m.created_at)} ${new Date(m.created_at).toTimeString().slice(0, 5)}</td><td>${ui.esc(ui.nameOf(m.game_id))}</td><td><b>${ui.esc(m.nickname)}</b> <span class="small">@${ui.esc(m.username || '')}</span></td><td>${F.html(m.body, true)}</td><td><button class="link" type="button" data-del>지우기</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">대화가 없어요.</td></tr>';
      el.addEventListener('click', async e => {
        const del = e.target.closest('[data-del]'); if (!del) return;
        const tr = del.closest('tr'), id = isNaN(+tr.dataset.id) ? tr.dataset.id : +tr.dataset.id;
        if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = '정말 지울까요?'; return; }
        try { await Hub.adminDeleteChat(id); tr.remove(); } catch (err) { ui.toast(err.message); }
      });
    }

    show();
    return () => { alive = false; };
  }

  window.GoAdmin = { render };
})();
