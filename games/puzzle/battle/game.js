/*
 * gogo?gogo! — 블록 대전 (최대 6명 실시간)
 *  공격 규칙: 한 번에 3줄 지우면 상대 모두에게 1줄, 4줄 지우면 3줄 (빈칸 위치는 무작위)
 *  흐름: 로비(방 목록·코드 입장) → 대기실(방장이 컴퓨터 추가·시작) → 경기 → 결과
 */
(function () {
  'use strict';
  const Hub = window.GameHub, P = window.GoPixel, B = window.GoBlocks;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const AV = window.GoAvatar, BGM = window.GoBGM;
  const CFG = window.GoSettings.get('battle');          // 이 폴더의 settings.js
  const ATTACK = CFG.attack || { 3: 1, 4: 3 };          // 지운 줄 수 → 상대에게 보내는 줄 수
  const MAX = CFG.maxPlayers || 6;                      // 한 방 최대 인원 (컴퓨터 포함)
  const C = 24, METER = 14, SIDE = 132, W = METER + B.COLS * C + SIDE, H = B.ROWS * C, MINI = 9;
  const levelFn = e => Math.min(15, Math.max(1 + Math.floor(e.lines / 10), 1 + Math.floor(e.elapsed / 30000))); // 30초마다 빨라짐
  const battleScore = (n, place, sent) => (n - place) * 100 + sent * 10;
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.random() * CODE_CHARS.length | 0]).join('');
  const BOT_NAMES = ['블록봇', '테트봇', '쌓기봇', '고고봇', '줄삭봇'];
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'rotate', KeyS: 'down', KeyX: 'rotate', KeyZ: 'rotateL', Space: 'drop' };

  let A = null;          // app 도우미 { toast, esc, fmt, dur, openAuth }
  let root = null;       // 화면 영역
  let lobby = null;      // { ch, rooms }
  let room = null;       // 현재 방
  let match = null;      // 현재 경기
  let guestNick = null;
  try { guestNick = sessionStorage.getItem('gogogogo.guestNick'); } catch (e) { /* noop */ }
  if (!guestNick) guestNick = '손님' + (1000 + Math.random() * 9000 | 0);

  const myNick = () => (Hub.user ? Hub.user.nickname : guestNick);
  const myAvatar = () => (Hub.user ? Hub.user.avatar : AV.normalize({}));
  const bust = (av, scale) => `<canvas class="av-bust" data-avatar="${AV.attr(av)}" data-crop="bust" data-scale="${scale || 2}" aria-hidden="true"></canvas>`;
  const esc = s => A.esc(s);

  /* ================= 로비 ================= */
  function openLobby() {
    if (lobby) return;
    lobby = { rooms: [] };
    lobby.ch = Hub.channel('lobby', {
      onPeers(list) { lobby.rooms = list.filter(r => r && r.code); if (!room) renderRoomList(); },
      onMsg() { /* 로비는 presence만 사용 */ },
      onError() { A.toast('실시간 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
    });
  }
  function closeLobby() { if (lobby) { lobby.ch.leave(); lobby = null; } }

  function renderLobby() {
    root.innerHTML = `
      <div class="page-head"><h1>블록 대전</h1><p>최대 ${MAX}명이 개인전 또는 블루·레드 팀전으로 겨뤄요. 마지막까지 살아남으면 승리!</p></div>
      ${Hub.mode === 'demo' ? '<div class="note-box"><b>체험 모드</b> · 지금은 같은 브라우저의 다른 탭끼리만 대전돼요. 방을 만든 뒤 <b>컴퓨터 상대</b>를 추가하면 혼자서도 바로 해 볼 수 있어요.</div>' : ''}
      <div class="battle-lobby">
        <div class="panel">
          <h3>대전 시작</h3>
          ${Hub.user ? `<p class="small" style="margin:0 0 12px"><b>${esc(Hub.user.nickname)}</b> 님으로 참가해요. 결과가 전적에 저장됩니다. ${A.resetHTML('battle', '대전 전적 초기화')}</p>`
            : `<form class="form" id="nickForm" novalidate><label for="bt-nick">닉네임 <small>손님은 기록이 저장되지 않아요</small></label><input id="bt-nick" maxlength="10" value="${esc(guestNick)}"></form>
               <p class="small" style="margin:6px 0 12px"><button class="link" type="button" data-auth="login">로그인</button>하면 대전 결과가 내 전적에 남아요.</p>`}
          <button class="btn btn-primary btn-block" type="button" id="btCreate">방 만들기</button>
          <form class="code-join" id="joinForm" novalidate>
            <label for="bt-code">방 코드로 입장</label>
            <div class="code-row"><input id="bt-code" maxlength="4" placeholder="ABCD" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn" type="submit">입장</button></div>
          </form>
        </div>
        <div class="panel">
          <h3>열린 방 <small>누르면 입장</small></h3>
          <ul class="room-list" id="roomList"><li class="empty">방을 찾는 중…</li></ul>
        </div>
        <div class="panel rules">
          <h3>공격 규칙</h3>
          <table class="atk-table"><thead><tr><th>한 번에 지운 줄</th><th class="n">상대에게</th></tr></thead>
            <tbody><tr><td>1~2줄</td><td class="n">-</td></tr><tr><td>3줄</td><td class="n hot">1줄</td></tr><tr><td>4줄</td><td class="n hot">3줄</td></tr></tbody></table>
          <ul class="rule-list">
            <li><b>개인전</b>: 공격이 살아 있는 모든 상대에게 동시에 올라가요.</li>
            <li><b>팀전 (블루 vs 레드)</b>: 공격은 상대 팀에게만 가요. 한 팀이 모두 탈락하면 끝!</li>
            <li>올라오는 줄은 빈칸 위치가 <b>무작위</b>예요. 왼쪽 빨간 막대가 받을 줄 수예요.</li>
            <li>모두 같은 순서로 블록이 나오고, 30초마다 빨라져요.</li>
            <li>개인전 점수 = (참가자 수 − 순위) × 100 + 보낸 공격 줄 × 10</li>
            <li>팀전 점수 = 승리 팀 200 + 보낸 공격 줄 × 10</li>
          </ul>
        </div>
      </div>`;
    const nickIn = $('#bt-nick');
    if (nickIn) nickIn.addEventListener('change', () => {
      const v = nickIn.value.trim();
      if (v.length >= 2) { guestNick = v.slice(0, 10); try { sessionStorage.setItem('gogogogo.guestNick', guestNick); } catch (e) { /* noop */ } }
      else nickIn.value = guestNick;
    });
    $('#btCreate').addEventListener('click', () => { syncNick(); joinRoom(newCode()); });
    $('#joinForm').addEventListener('submit', e => {
      e.preventDefault(); syncNick();
      const code = $('#bt-code').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(code)) { A.toast('방 코드 4자리를 입력해 주세요.'); return; }
      joinRoom(code);
    });
    $('#roomList').addEventListener('click', e => { const b = e.target.closest('[data-code]'); if (b) { syncNick(); joinRoom(b.dataset.code); } });
    renderRoomList();
  }
  function syncNick() { const i = $('#bt-nick'); if (i && i.value.trim().length >= 2) { guestNick = i.value.trim().slice(0, 10); try { sessionStorage.setItem('gogogogo.guestNick', guestNick); } catch (e) { /* noop */ } } }

  function renderRoomList() {
    const ul = $('#roomList'); if (!ul || !lobby) return;
    const rooms = lobby.rooms.slice().sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1) || b.at - a.at);
    if (!rooms.length) { ul.innerHTML = '<li class="empty">아직 열린 방이 없어요. 방을 만들고 코드를 친구에게 알려 주세요.</li>'; return; }
    ul.innerHTML = rooms.map(r => {
      const full = r.count >= MAX;
      return `<li><button type="button" class="room-item" ${full ? 'disabled' : ''} data-code="${esc(r.code)}">
        <span class="room-code">${esc(r.code)}</span>
        <span class="room-host">${esc(r.nick)}의 방</span>
        <span class="room-meta">${r.mode === 'team' ? '팀전' : '개인전'} · ${r.count}/${MAX}명 · ${r.status === 'playing' ? '경기 중' : full ? '꽉 참' : '대기 중'}</span></button></li>`;
    }).join('');
  }

  /* ================= 방 (대기실) ================= */
  function joinRoom(code) {
    leaveRoom(true);
    room = { code, peers: [], bots: [], status: 'waiting', mode: 'solo', myTeam: null, hostId: null, joinedAt: Date.now(), checkedFull: false };
    room.ch = Hub.channel('room-' + code, { onMsg: onRoomMsg, onPeers: onRoomPeers, onError() { A.toast('방에 연결하지 못했어요.'); } });
    retrack();
    renderRoom();
    // 늦게 들어왔는데 자리가 없으면 나가기
    setTimeout(() => {
      if (!room || room.code !== code || room.checkedFull) return;
      room.checkedFull = true;
      const before = room.peers.filter(p => p.joinedAt < room.joinedAt).length + room.bots.length;
      if (before >= MAX) { A.toast('방이 꽉 찼어요. 다른 방을 골라 주세요.'); leaveRoom(); }
    }, 1500);
  }
  function leaveRoom(silent) {
    stopMatch();
    if (!room) return;
    if (lobby) lobby.ch.untrack();
    room.ch.leave(); room = null;
    if (!silent) renderLobby();
  }
  const isHost = () => room && room.hostId === Hub.clientId;
  const totalCount = () => room.peers.length + room.bots.length;
  function retrack() {
    room.ch.track({ id: Hub.clientId, nick: myNick(), uid: Hub.user ? Hub.user.id : null, joinedAt: room.joinedAt, team: room.myTeam, avatar: myAvatar() });
  }

  /* ---- 팀 ---- */
  // 대기실에서 각 참가자의 팀 (사람은 본인이 고르고, 컴퓨터는 방장이 정함)
  function roomTeamOf(id) {
    if (id === Hub.clientId) return room.myTeam;
    const p = room.peers.find(x => x.id === id); if (p) return p.team;
    const b = room.bots.find(x => x.id === id); return b ? b.team : null;
  }
  function teamCounts(exceptId) {
    const c = { blue: 0, red: 0 };
    room.peers.forEach(p => { const t = roomTeamOf(p.id); if (p.id !== exceptId && c[t] != null) c[t]++; });
    room.bots.forEach(b => { if (b.id !== exceptId && c[b.team] != null) c[b.team]++; });
    return c;
  }
  const smallerTeam = exceptId => { const c = teamCounts(exceptId); return c.blue <= c.red ? 'blue' : 'red'; };
  function autoTeam() {
    if (room.mode !== 'team' || room.myTeam) return;
    room.myTeam = smallerTeam(Hub.clientId); retrack();
  }
  function setMyTeam(t) { room.myTeam = t; retrack(); renderRoom(); }

  function onRoomPeers(list) {
    if (!room) return;
    room.peers = list.filter(p => p && p.id).sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    const prevHost = room.hostId;
    room.hostId = room.peers.length ? room.peers[0].id : Hub.clientId;
    if (prevHost && prevHost !== room.hostId && room.hostId === Hub.clientId) {
      A.toast('방장이 나가서 내가 방장이 됐어요.');
      room.bots = room.bots.filter(b => b.owner === Hub.clientId);
    }
    // 경기 중 나간 사람(과 그 사람이 돌리던 컴퓨터)은 탈락 처리
    if (match && !match.ended) {
      const here = new Set(room.peers.map(p => p.id));
      match.roster.forEach(r => {
        const gone = r.bot ? !here.has(r.owner) : !here.has(r.id);
        if (gone && match.alive.has(r.id)) koLocal(r.id, true);
      });
    }
    if (isHost()) { broadcastRoom(); advertise(); }
    autoTeam();
    if (!match) renderRoom();
  }
  function broadcastRoom() { room.ch.send({ t: 'room', bots: room.bots, status: room.status, mode: room.mode }); }
  function advertise() {
    if (!lobby || !room || !isHost()) return;
    lobby.ch.track({ code: room.code, nick: myNick(), count: totalCount(), status: room.status, mode: room.mode, at: room.joinedAt });
  }
  function setMode(mode) {
    room.mode = mode;
    if (mode === 'team') {
      if (!room.myTeam) room.myTeam = smallerTeam(Hub.clientId);
      retrack();
      room.bots.forEach(b => { b.team = null; });
      room.bots.forEach(b => { b.team = smallerTeam(b.id); });
    }
    broadcastRoom(); advertise(); renderRoom();
  }

  function onRoomMsg(m) {
    if (!room || !m) return;
    if (m.t === 'room') {
      if (!isHost()) { room.bots = m.bots || []; room.status = m.status; room.mode = m.mode || 'solo'; autoTeam(); if (!match) renderRoom(); }
    } else if (m.t === 'start') startMatch(m.seed, m.roster, m.mode);
    else if (!match) return;
    else if (m.t === 'board') { match.others[m.id] = m; drawMini(m.id); if (match.ended) showResult(); }
    else if (m.t === 'atk') applyAttackLocal(m.from, m.n);
    else if (m.t === 'ko') koLocal(m.id, false);
  }

  const TEAM_NAME = { blue: '블루', red: '레드' };
  function memberLi(m, host) {
    const isBot = !!m.bot, mine = m.id === Hub.clientId, t = room.mode === 'team' ? roomTeamOf(m.id) : null;
    let ctrl = '';
    if (t && mine) ctrl = `<button class="link" type="button" data-myteam="${t === 'blue' ? 'red' : 'blue'}">${TEAM_NAME[t === 'blue' ? 'red' : 'blue']} 팀으로</button>`;
    else if (t && isBot && host) ctrl = `<button class="link" type="button" data-botteam="${esc(m.id)}">팀 바꾸기</button>`;
    const rm = isBot && host ? `<button class="link" type="button" data-rmbot="${esc(m.id)}">빼기</button>` : '';
    return `<li class="${t ? 'team-' + t : ''}">${bust(m.avatar || AV.random(m.id), 2)}<span class="nm">${esc(m.nick)}</span>`
      + (m.id === room.hostId ? '<span class="badge host">방장</span>' : '')
      + (mine ? '<span class="badge me">나</span>' : '')
      + (isBot ? `<span class="badge bot">컴퓨터 · ${B.BOT_LEVELS[m.level].name}</span>` : '')
      + `<span class="li-ctrl">${ctrl}${rm}</span></li>`;
  }
  function canStart() {
    const total = totalCount();
    if (total < 2) return { ok: false, why: '2명 이상이어야 시작할 수 있어요. 친구를 기다리거나 컴퓨터를 추가해 보세요.' };
    if (room.mode === 'team') {
      const c = teamCounts();
      if (!c.blue || !c.red) return { ok: false, why: '블루 팀과 레드 팀에 각각 1명 이상 있어야 해요.' };
      return { ok: true, why: `블루 ${c.blue}명 vs 레드 ${c.red}명` + (c.blue !== c.red ? ' · 인원이 다르면 적은 팀이 불리해요.' : '으로 시작해요.') };
    }
    return { ok: true, why: `${total}명이 개인전으로 시작해요.` };
  }

  function renderRoom() {
    if (!room || !root) return;
    const host = isHost(), total = totalCount();
    const meInGame = match && match.roster.some(r => r.id === Hub.clientId);
    if (room.status === 'playing' && !meInGame) {
      root.innerHTML = `<div class="panel gate"><h2>경기가 진행 중이에요</h2><p>방 <b class="num">${esc(room.code)}</b> · 이번 판이 끝나면 다음 판부터 함께할 수 있어요.</p><button class="btn" type="button" id="btLeave">나가기</button></div>`;
      $('#btLeave').addEventListener('click', () => leaveRoom());
      return;
    }
    const hostPeer = room.peers.find(p => p.id === room.hostId);
    const members = room.peers.map(p => ({ id: p.id, nick: p.nick, avatar: p.avatar })).concat(room.bots.map(b => ({ ...b, bot: true })));
    const team = room.mode === 'team';
    const list = team
      ? `<div class="teams">${['blue', 'red'].map(t => `<div class="team-col team-${t}"><div class="team-title">${TEAM_NAME[t]} 팀 <small>${members.filter(m => roomTeamOf(m.id) === t).length}명</small></div><ul class="players">${members.filter(m => roomTeamOf(m.id) === t).map(m => memberLi(m, host)).join('') || '<li class="empty">아직 없어요</li>'}</ul></div>`).join('')}</div>`
      : `<ul class="players">${members.map(m => memberLi(m, host)).join('')}</ul>`;
    const cs = canStart();
    root.innerHTML = `
      <div class="room">
        <div class="panel room-head">
          <div><span class="lbl">ROOM CODE</span><div class="room-code-big num">${esc(room.code)}</div><p class="small" style="margin:4px 0 0">친구에게 이 코드를 알려 주면 같은 방에 들어올 수 있어요.</p></div>
          <div class="row" style="margin:0"><button class="btn" type="button" id="btCopy">코드 복사</button><button class="btn" type="button" id="btLeave">나가기</button></div>
        </div>
        <div class="room-grid">
          <div class="panel">
            <h3>${team ? '팀 구성' : '참가자'} <small>${total}/${MAX}명 · ${team ? '팀전' : '개인전'}</small></h3>
            ${list}
          </div>
          <div class="panel">
            ${host ? `
              <h3>방장 설정</h3>
              <p class="small" style="margin:0 0 8px">경기 방식</p>
              <div class="seg" role="radiogroup" aria-label="경기 방식">
                <button type="button" role="radio" aria-checked="${!team}" data-mode="solo">개인전<small>모두가 서로 공격</small></button>
                <button type="button" role="radio" aria-checked="${team}" data-mode="team">팀전<small>블루 vs 레드</small></button>
              </div>
              <p class="small" style="margin:16px 0 8px">컴퓨터 상대 추가</p>
              <div class="bot-add">${Object.entries(B.BOT_LEVELS).map(([k, v]) => `<button class="btn btn-sm" type="button" data-addbot="${k}" ${total >= MAX ? 'disabled' : ''}>+ ${v.name}</button>`).join('')}</div>
              <button class="btn btn-primary btn-block" type="button" id="btStart" ${cs.ok ? '' : 'disabled'} style="margin-top:16px">대전 시작 ▶</button>
              <p class="small">${cs.why}</p>`
            : `<h3>준비 완료</h3><p class="small" style="margin:0">${team ? `<b>${TEAM_NAME[room.myTeam] || ''} 팀</b>으로 참가해요. 팀은 왼쪽에서 바꿀 수 있어요. ` : ''}${esc(hostPeer ? hostPeer.nick : '방장')} 님이 시작하면 바로 경기가 시작돼요.</p>
               <div class="waiting-dots" aria-hidden="true"><i></i><i></i><i></i></div>`}
          </div>
        </div>
      </div>`;
    AV.paintAll(root);
    $('#btLeave').addEventListener('click', () => leaveRoom());
    $('#btCopy').addEventListener('click', () => {
      const done = () => A.toast('방 코드 ' + room.code + '를 복사했어요.');
      try { navigator.clipboard.writeText(room.code).then(done, () => A.toast('방 코드: ' + room.code)); } catch (e) { A.toast('방 코드: ' + room.code); }
    });
    $$('[data-myteam]', root).forEach(b => b.addEventListener('click', () => setMyTeam(b.dataset.myteam)));
    if (host) {
      $$('[data-mode]', root).forEach(b => b.addEventListener('click', () => { if (room.mode !== b.dataset.mode) setMode(b.dataset.mode); }));
      $$('[data-addbot]', root).forEach(b => b.addEventListener('click', () => {
        if (totalCount() >= MAX) return;
        const used = new Set(room.bots.map(x => x.nick));
        const nick = BOT_NAMES.find(n => !used.has(n)) || ('봇' + (room.bots.length + 1));
        const id = 'bot-' + Math.random().toString(36).slice(2, 8);
        room.bots.push({ id, nick, level: b.dataset.addbot, owner: Hub.clientId, team: room.mode === 'team' ? smallerTeam(id) : null, avatar: AV.random(id) });
        broadcastRoom(); advertise(); renderRoom();
      }));
      $$('[data-rmbot]', root).forEach(b => b.addEventListener('click', () => {
        room.bots = room.bots.filter(x => x.id !== b.dataset.rmbot); broadcastRoom(); advertise(); renderRoom();
      }));
      $$('[data-botteam]', root).forEach(b => b.addEventListener('click', () => {
        const bot = room.bots.find(x => x.id === b.dataset.botteam); if (!bot) return;
        bot.team = bot.team === 'blue' ? 'red' : 'blue'; broadcastRoom(); renderRoom();
      }));
      const st = $('#btStart');
      if (st) st.addEventListener('click', hostStart);
    }
  }

  function hostStart() {
    if (!isHost() || !canStart().ok) return;
    const seed = (Math.random() * 2147483647) | 0, mode = room.mode, team = id => (mode === 'team' ? roomTeamOf(id) : null);
    const roster = room.peers.map(p => ({ id: p.id, nick: p.nick, team: team(p.id), avatar: p.avatar }))
      .concat(room.bots.map(b => ({ id: b.id, nick: b.nick, bot: true, level: b.level, owner: b.owner, team: team(b.id), avatar: b.avatar })));
    room.ch.send({ t: 'start', seed, roster, mode });
    startMatch(seed, roster, mode);
  }

  /* ================= 경기 ================= */
  function startMatch(seed, roster, mode) {
    if (!room) return;
    stopMatch();
    room.status = 'playing';
    if (isHost()) { broadcastRoom(); advertise(); }
    const inGame = roster.some(r => r.id === Hub.clientId);
    if (!inGame) { renderRoom(); return; }

    match = {
      seed, roster, n: roster.length, alive: new Set(roster.map(r => r.id)), places: {}, others: {},
      mode: mode === 'team' ? 'team' : 'solo', teamOf: Object.fromEntries(roster.map(r => [r.id, r.team || null])), winTeam: null,
      running: false, ended: false, raf: 0, last: 0, clock: P.clock(), flash: 0, popups: [], saved: null,
      local: {} // 이 기기에서 돌리는 참가자: 나 + (방장이면) 컴퓨터
    };
    const mk = id => ({
      seed, levelFn,
      onClear: n => onClear(id, n),
      onLock: () => sendBoard(id),
      onTopOut: () => { sendBoard(id, true); ko(id); }
    });
    match.local[Hub.clientId] = { eng: B.Engine(mk(Hub.clientId)), bot: null };
    roster.filter(r => r.bot && r.owner === Hub.clientId).forEach(r => {
      const bot = B.Bot(r.level, mk(r.id));
      match.local[r.id] = { eng: bot.eng, bot };
    });
    roster.forEach(r => { match.others[r.id] = { id: r.id, rows: null, sent: 0, lines: 0 }; });
    renderMatch();
    countdown();
  }

  function stopMatch() {
    if (!match) return;
    BGM.pause();
    cancelAnimationFrame(match.raf);
    clearTimeout(match.cdTimer);
    Object.values(match.throttle || {}).forEach(q => clearTimeout(q.timer));
    match = null;
  }

  const myEng = () => match && match.local[Hub.clientId] && match.local[Hub.clientId].eng;

  function onClear(id, n) {
    const atk = ATTACK[n] || 0;
    if (id === Hub.clientId) match.popups.push({ text: n + '줄!' + (atk ? ' 공격 +' + atk : ''), t: 0, hot: !!atk });
    if (!atk) return;
    const L = match.local[id]; if (L) L.eng.sent += atk;
    room.ch.send({ t: 'atk', from: id, n: atk });
    applyAttackLocal(id, atk);
  }
  function applyAttackLocal(from, n) {
    if (!match || match.ended || !match.running) return;
    Object.entries(match.local).forEach(([id, L]) => {
      if (id === from || !match.alive.has(id)) return;
      if (match.mode === 'team' && match.teamOf[id] === match.teamOf[from]) return;   // 같은 팀은 공격받지 않음
      L.eng.addGarbage(n);
      if (id === Hub.clientId) match.flash = 400;
    });
  }
  // 상대 화면 갱신은 참가자마다 최대 2초에 1번만 전송 (무료 요금제 메시지 한도 절약)
  const BOARD_EVERY = 2000;
  function sendBoard(id, now) {
    const L = match && match.local[id]; if (!L) return;
    const msg = { t: 'board', id, rows: L.eng.rows(), sent: L.eng.sent, lines: L.eng.lines };
    match.others[id] = msg; drawMini(id);
    const tq = match.throttle || (match.throttle = {});
    const q = tq[id] || (tq[id] = { last: 0, timer: 0 });
    const m = match;
    const fire = () => { q.timer = 0; q.last = Date.now(); if (match === m && room) room.ch.send(m.others[id]); };
    if (now || Date.now() - q.last >= BOARD_EVERY) { clearTimeout(q.timer); fire(); }
    else if (!q.timer) q.timer = setTimeout(fire, BOARD_EVERY - (Date.now() - q.last));
  }
  function ko(id) {
    if (!match || !match.alive.has(id)) return;
    room.ch.send({ t: 'ko', id });
    koLocal(id, false);
  }
  function koLocal(id, left) {
    if (!match || !match.alive.has(id)) return;
    match.places[id] = match.alive.size;
    match.alive.delete(id);
    const r = match.roster.find(x => x.id === id);
    if (id === Hub.clientId) { match.clock.stop(); A.toast(match.mode === 'team' ? '탈락! 남은 팀원을 응원해 주세요.' : '탈락! ' + match.places[id] + '위 · 다른 사람 경기를 지켜볼 수 있어요.'); }
    else if (r && match.running) A.toast(r.nick + (left ? ' 님이 나갔어요' : ' 님 탈락') + ' · ' + aliveText());
    drawMini(id);
    checkEnd();
  }
  function aliveText() {
    if (!match) return '';
    if (match.mode !== 'team') return match.alive.size + '/' + match.n + '명 생존';
    const c = { blue: 0, red: 0 }; match.alive.forEach(id => { c[match.teamOf[id]]++; });
    return '블루 ' + c.blue + ' · 레드 ' + c.red + ' 생존';
  }
  function checkEnd() {
    if (!match || match.ended) return;
    if (match.mode === 'team') {
      const teams = new Set(Array.from(match.alive).map(id => match.teamOf[id]));
      if (teams.size > 1) return;
      match.winTeam = Array.from(teams)[0] || null;
      match.roster.forEach(r => { match.places[r.id] = r.team === match.winTeam ? 1 : 2; });
      match.ended = true; match.running = false;
      match.alive.forEach(id => { if (match.local[id]) sendBoard(id, true); });
    } else {
      if (match.alive.size > 1) return;
      match.ended = true; match.running = false;
      const winner = Array.from(match.alive)[0];
      if (winner) match.places[winner] = 1;
      if (winner && match.local[winner]) sendBoard(winner, true);  // 우승자의 최종 공격 수 공유
    }
    match.clock.stop();
    room.status = 'waiting';
    if (isHost()) { broadcastRoom(); advertise(); }
    saveResult();
    showResult();
  }

  async function saveResult() {
    const eng = myEng(); const place = match.places[Hub.clientId];
    if (!eng || !place) return;
    const team = match.mode === 'team', win = team ? match.teamOf[Hub.clientId] === match.winTeam : place === 1;
    const res = { place, win, score: team ? (win ? 200 : 0) + eng.sent * 10 : battleScore(match.n, place, eng.sent), sent: eng.sent };
    // 포인트: settings.js — 상대가 모두 컴퓨터면 botsOnly 값 사용
    const humansAgainst = match.roster.some(r => !r.bot && r.id !== Hub.clientId && (!team || r.team !== match.teamOf[Hub.clientId]));
    res.delta = window.GoSettings.pointsFor('battle', win, humansAgainst ? null : 'botsOnly').delta;
    match.saved = { status: Hub.user ? 'saving' : 'guest', ...res };
    if (!Hub.user) return;
    const m = match;
    try {
      const r = await Hub.submitScore({ game_id: 'battle', score: res.score, result: res.win ? 'win' : 'lose', points_delta: res.delta, duration_sec: Math.max(m.clock.sec(), 3), extra: { mode: m.mode, team: m.teamOf[Hub.clientId], win: res.win, place, players: m.n, sent: eng.sent, lines: eng.lines, bots: m.roster.filter(x => x.bot).length } });
      m.saved = { ...m.saved, status: r.queued ? 'queued' : 'saved', gained: r.gained };
    } catch (e) { m.saved = { ...m.saved, status: 'error', msg: e.message }; }
    if (match === m) showResult();
  }

  function renderMatch() {
    const team = match.mode === 'team', myTeam = match.teamOf[Hub.clientId];
    // 팀전: 우리 팀을 먼저, 상대 팀을 뒤에
    const others = match.roster.filter(r => r.id !== Hub.clientId).sort((a, b) => team ? (a.team === myTeam ? 0 : 1) - (b.team === myTeam ? 0 : 1) : 0);
    root.innerHTML = `
      <div class="match ${team ? 'team-' + myTeam : ''}">
        <div class="play-head"><span class="cat">방 ${esc(room.code)}</span><h1>${team ? `팀전 · <span class="team-word t-${myTeam}">${TEAM_NAME[myTeam]} 팀</span>` : '블록 대전'}</h1><span class="small" id="aliveTxt" style="margin:0">${aliveText()}</span></div>
        <div class="match-grid">
          <div class="stage-col">
            <div class="cabinet ${team ? 'cab-' + myTeam : ''}" style="--cw:${W}px;--ar:${W / H}"><div class="screen"><canvas id="btCanvas" aria-label="내 게임 화면"></canvas><div class="overlay" id="btOv"></div></div></div>
            <div class="pad" id="pad"><button type="button" data-act="left" aria-label="왼쪽">◀</button><button type="button" data-act="rotate" aria-label="회전">⟳</button><button type="button" data-act="right" aria-label="오른쪽">▶</button><button type="button" data-act="down" aria-label="천천히 내리기">▼</button><button type="button" class="pad-a" data-act="drop" aria-label="한 번에 내리기">⤓</button></div>
          </div>
          <div class="minis" style="--n:${others.length}">
            ${others.map(r => `<div class="mini ${team ? 'team-' + r.team : ''}" data-mini="${esc(r.id)}"><div class="mini-screen"><canvas aria-hidden="true"></canvas><div class="mini-ko" hidden></div></div><div class="mini-name"><span>${bust(r.avatar || AV.random(r.id), 1)}${team ? `<i class="dot t-${r.team}"></i>` : ''}${esc(r.nick)}</span>${team ? `<small>${r.team === myTeam ? '우리 팀' : '상대 팀'}</small>` : ''}${r.bot ? `<small>컴퓨터·${B.BOT_LEVELS[r.level].name}</small>` : ''}</div><div class="mini-stat num" data-stat>ATK 0</div></div>`).join('')}
          </div>
        </div>
      </div>`;
    match.ctx = P.setup($('#btCanvas'), W, H);
    $$('.mini-screen canvas', root).forEach(c => P.setup(c, B.COLS * MINI, B.ROWS * MINI));
    AV.paintAll(root);
    others.forEach(r => drawMini(r.id));
    // 터치 패드
    $$('#pad [data-act]', root).forEach(b => {
      let t1 = 0, t2 = 0;
      const stop = () => { clearTimeout(t1); clearInterval(t2); };
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); act(b.dataset.act);
        if (['left', 'right', 'down'].includes(b.dataset.act)) t1 = setTimeout(() => { t2 = setInterval(() => act(b.dataset.act), 70); }, 200);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
    });
    P.swipe($('#btCanvas'), d => act(d === 'down' ? 'drop' : d === 'up' || d === 'tap' ? 'rotate' : d));
    const loop = t => {
      if (!match) return;
      match.raf = requestAnimationFrame(loop);
      const dt = Math.min(100, t - (match.last || t)); match.last = t;
      if (match.running && !match.ended) Object.entries(match.local).forEach(([id, L]) => {
        if (!match.alive.has(id)) return;
        if (L.bot) L.bot.update(dt); else L.eng.update(dt);
      });
      drawMain(dt);
    };
    match.raf = requestAnimationFrame(loop);
  }

  function countdown() {
    const ov = $('#btOv'); let n = 3;
    const step = () => {
      if (!match || !ov.isConnected) return;
      if (n > 0) { ov.hidden = false; ov.innerHTML = `<div class="ov-box"><div class="count num">${n}</div><p class="ov-hint">${match.mode === 'team' ? `당신은 <b class="t-${match.teamOf[Hub.clientId]}">${TEAM_NAME[match.teamOf[Hub.clientId]]} 팀</b> · 공격은 상대 팀에게만 가요` : match.n + '명 개인전 · 3줄=1줄, 4줄=3줄 공격'}</p></div>`; n--; match.cdTimer = setTimeout(step, 1000); }
      else { ov.hidden = true; match.running = true; match.clock.start(); BGM.restart(); }
    };
    step();
  }

  function act(a) {
    const eng = myEng();
    if (!match || !match.running || match.ended || !eng || eng.over) return;
    if (a === 'left') eng.move(-1, 0);
    else if (a === 'right') eng.move(1, 0);
    else if (a === 'down') eng.soft();
    else if (a === 'rotate') eng.rotate(false);
    else if (a === 'rotateL') eng.rotate(true);
    else if (a === 'drop') eng.hard();
  }

  function drawMain(dt) {
    const ctx = match.ctx, eng = myEng(); if (!ctx || !eng) return;
    // 받을 공격 막대
    ctx.fillStyle = P.PANEL; ctx.fillRect(0, 0, METER, H);
    const pend = eng.pendingLines();
    if (pend) {
      const blink = Math.floor(performance.now() / 180) % 2;
      ctx.fillStyle = blink ? '#FF5A5F' : '#C9343A';
      ctx.fillRect(2, H - Math.min(H, pend * C), METER - 4, Math.min(H, pend * C));
    }
    B.drawBoard(ctx, eng, METER, 0, C, { live: match.running && !eng.over });
    if (match.flash > 0) { match.flash -= dt; ctx.fillStyle = 'rgba(255,90,95,' + (0.25 * match.flash / 400) + ')'; ctx.fillRect(METER, 0, B.COLS * C, H); }
    // 오른쪽 정보
    const x0 = METER + B.COLS * C, cx = x0 + 18;
    ctx.fillStyle = P.PANEL; ctx.fillRect(x0, 0, SIDE, H);
    ctx.fillStyle = '#2A3366'; ctx.fillRect(x0, 0, 2, H);
    P.text(ctx, 'NEXT', cx, 18, 10, P.DIM);
    B.drawNext(ctx, eng, cx, 36, 96, 72);
    P.text(ctx, 'ATTACK', cx, 136, 10, P.DIM); P.text(ctx, eng.sent, cx, 154, 13, '#FF5A5F');
    P.text(ctx, 'LINES', cx, 196, 10, P.DIM); P.text(ctx, eng.lines, cx, 214, 13, P.INK);
    P.text(ctx, 'SPEED', cx, 256, 10, P.DIM); P.text(ctx, eng.level, cx, 274, 13, P.PIECE.O);
    if (match.mode === 'team') {
      const c = { blue: 0, red: 0 }; match.alive.forEach(id => { c[match.teamOf[id]]++; });
      P.text(ctx, 'ALIVE', cx, 316, 10, P.DIM);
      P.text(ctx, 'B' + c.blue, cx, 334, 13, '#6F95FF'); P.text(ctx, 'R' + c.red, cx + 50, 334, 13, '#FF6B70');
    } else { P.text(ctx, 'ALIVE', cx, 316, 10, P.DIM); P.text(ctx, match.alive.size + '/' + match.n, cx, 334, 13, P.PIECE.S); }
    if (pend) { P.text(ctx, 'INCOMING', cx, 376, 9, '#FF5A5F'); P.text(ctx, pend, cx, 394, 13, '#FF5A5F'); }
    // 줄 지우기 알림
    match.popups = match.popups.filter(p => (p.t += dt) < 1100);
    match.popups.forEach(p => {
      ctx.globalAlpha = 1 - p.t / 1100;
      P.text(ctx, p.text, METER + B.COLS * C / 2, 200 - p.t / 30, p.hot ? 13 : 11, p.hot ? P.PIECE.O : P.INK, 'center');
      ctx.globalAlpha = 1;
    });
    if (eng.over && !match.ended) {
      ctx.fillStyle = 'rgba(10,14,36,.7)'; ctx.fillRect(METER, 0, B.COLS * C, H);
      P.text(ctx, 'K.O.', METER + B.COLS * C / 2, 200, 22, '#FF5A5F', 'center');
      P.text(ctx, match.mode === 'team' ? 'CHEER!' : (match.places[Hub.clientId] || '-') + '위', METER + B.COLS * C / 2, 236, 13, P.INK, 'center');
    }
    const at = $('#aliveTxt'); if (at) at.textContent = aliveText();
  }

  function drawMini(id) {
    if (!match || id === Hub.clientId) return;
    const box = root && root.querySelector(`[data-mini="${CSS.escape(id)}"]`); if (!box) return;
    const c = box.querySelector('.mini-screen canvas'), ctx = c.getContext('2d');
    const o = match.others[id] || {};
    const dpr = c.width / (B.COLS * MINI);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    B.drawRows(ctx, o.rows, 0, 0, MINI);
    box.querySelector('[data-stat]').textContent = 'ATK ' + (o.sent || 0) + ' · ' + (o.lines || 0) + '줄';
    const k = box.querySelector('.mini-ko');
    const won = match.ended && match.places[id] === 1;
    if (won && match.alive.has(id)) { k.hidden = false; k.textContent = 'WIN'; box.classList.add('win'); }
    else if (!match.alive.has(id) && match.places[id]) { k.hidden = false; k.textContent = won ? 'WIN' : match.mode === 'team' ? 'KO' : 'KO ' + match.places[id] + '위'; box.classList.toggle('win', won); }
    else k.hidden = true;
  }

  function showResult() {
    const ov = $('#btOv'); if (!ov || !match) return;
    match.roster.forEach(r => drawMini(r.id));
    const order = match.roster.slice().sort((a, b) => (match.places[a.id] || 99) - (match.places[b.id] || 99));
    const myPlace = match.places[Hub.clientId], s = match.saved || {};
    const team = match.mode === 'team', myTeam = match.teamOf[Hub.clientId], won = team ? match.winTeam === myTeam : myPlace === 1;
    const sentOf = r => (r.id === Hub.clientId && myEng() ? myEng().sent : (match.others[r.id] && match.others[r.id].sent) || 0);
    let note = '';
    if (s.status === 'saving') note = '<p class="ov-note">기록 저장 중…</p>';
    else if (s.status === 'saved') note = `<p class="ov-note ${s.gained > 0 ? 'ok' : ''}">${s.win ? '승리' : '패배'} ${A.pointText(s.gained, s.delta)} · 전적에 저장했어요</p>`;
    else if (s.status === 'queued') note = '<p class="ov-note">오프라인이라 연결되면 저장돼요.</p>';
    else if (s.status === 'error') note = `<p class="ov-note bad">${esc(s.msg)}</p>`;
    else if (s.status === 'guest') note = `<p class="ov-note">손님 플레이 · ${s.score}점 (로그인하면 기록이 남아요)</p>`;
    ov.hidden = false;
    ov.innerHTML = `<div class="ov-box result">
      <canvas class="ov-avatar" data-avatar="${AV.attr(myAvatar())}" data-scale="3" aria-hidden="true"></canvas>
      ${team
        ? `<div class="ov-title"><span class="t-${match.winTeam}">${TEAM_NAME[match.winTeam] || ''} 팀</span> 승리!</div><span class="ov-best">${won ? 'VICTORY' : 'DEFEAT'}</span>`
        : `<div class="ov-title">${myPlace === 1 ? '우승!' : myPlace + '위'}</div>${myPlace === 1 ? '<span class="ov-best">WINNER</span>' : ''}`}
      <ol class="result-list">${order.map(r => `<li class="${r.id === Hub.clientId ? 'mine' : ''}"><span class="num">${team ? `<i class="dot t-${r.team}"></i>` : match.places[r.id] || '-'}</span><span class="rl-name">${bust(r.avatar || AV.random(r.id), 1)}${esc(r.nick)}</span><span class="num">${sentOf(r)}</span></li>`).join('')}</ol>
      <p class="ov-hint">오른쪽 숫자 = 보낸 공격 줄</p>
      ${note}
      <div class="ov-btns">${isHost() ? '<button class="btn btn-sun" type="button" id="btAgain">한 판 더 ▶</button>' : ''}<button class="btn" type="button" id="btBack">대기실로</button></div>
      ${isHost() ? '' : '<p class="ov-hint">방장이 다음 판을 시작하면 바로 시작돼요.</p>'}
    </div>`;
    AV.paintAll(ov);
    const again = $('#btAgain');
    if (again) again.addEventListener('click', () => { stopMatch(); hostStart(); if (!match) renderRoom(); });
    $('#btBack').addEventListener('click', () => { stopMatch(); renderRoom(); });
  }

  /* ================= 키보드 ================= */
  function onKey(e) {
    if (!match || !match.running) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const a = KEYMAP[e.code]; if (!a) return;
    e.preventDefault(); act(a);
  }

  /* ================= 진입점 ================= */
  window.GoBattle = {
    render(el, app) {
      A = app; root = el;
      BGM.load('battle');
      openLobby();
      document.addEventListener('keydown', onKey);
      if (room) renderRoom(); else renderLobby();
      return function cleanup() {
        document.removeEventListener('keydown', onKey);
        leaveRoom(true); closeLobby(); root = null; BGM.stop();
      };
    },
    _debug: () => ({ room, match })
  };

  // 대전 카드 썸네일
  window.GoGames.battle = {
    id: 'battle',
    thumb(ctx, w, h) {
      ctx.fillStyle = P.PANEL; ctx.fillRect(0, 0, w, h);
      const s = 7, bw = B.COLS * s, bh = B.ROWS * s, y0 = (h - bh) / 2;
      const left = Array.from({ length: B.ROWS }, (_, r) => r < 13 ? '..........' : r < 17 ? 'TTJJ.LLSSO' : 'IIIIOOZ.LL');
      const right = Array.from({ length: B.ROWS }, (_, r) => r < 9 ? '..........' : r < 15 ? 'SZZ.JJLTTO' : 'GGGG.GGGGG');
      B.drawRows(ctx, left, 22, y0, s);
      B.drawRows(ctx, right, w - 22 - bw, y0, s);
      P.text(ctx, 'VS', w / 2, h / 2 - 9, 16, P.PIECE.O, 'center');
      // 공격 화살표
      ctx.fillStyle = P.PIECE.Z;
      for (let i = 0; i < 3; i++) ctx.fillRect(w / 2 - 14 + i * 10, h / 2 + 18, 6, 6);
    }
  };
})();
