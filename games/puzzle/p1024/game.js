/*
 * gogo?gogo! — 퍼즐1024 (최대 6명, 1024를 먼저 만들면 승리)
 *  대결 방식: AI 대전 · 오프라인 대결(한 키보드 2명) · 온라인 대결(방 코드)
 *  Ctrl(오프라인은 Shift) = 내 판 처음부터 다시 (더 움직일 수 없으면 자동으로 다시 시작)
 */
(function () {
  'use strict';
  const Hub = window.GameHub, P = window.GoPixel, AV = window.GoAvatar, BGM = window.GoBGM;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const CFG = window.GoSettings.get('p1024');
  const GOAL = CFG.goal || 1024, MAX = CFG.maxPlayers || 6, BOTS = CFG.bots;
  const N = 4, W = 400, TOP = 64, H = W + TOP, G = 12, T = (W - G * (N + 1)) / N, MINI = 96;
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.random() * CODE_CHARS.length | 0]).join('');
  const BOT_NAMES = ['숫자봇', '합치봇', '고고봇', '천봇', '퍼즐봇'];
  const DIRS = ['left', 'right', 'up', 'down'];
  // 혼자 조작 (AI 대전·온라인): 방향키·WASD, Ctrl = 다시 시작
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', ControlLeft: 'reset', ControlRight: 'reset' };
  // 오프라인 대결 (한 키보드 2명). Ctrl+W 는 탭이 닫혀서 Shift 사용
  const KEY_1P = { KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', ShiftLeft: 'reset' };
  const KEY_2P = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ShiftRight: 'reset' };
  const P2 = 'local-2p';
  const PLAY = {
    ai: { name: 'AI 대전', desc: '컴퓨터 1~5명과 누가 먼저 1024를 만드는지 겨뤄요.', pts: '승리 +1P · 패배 -1P' },
    offline: { name: '오프라인 대결', desc: '한 컴퓨터에서 키보드를 나눠 2명이 겨뤄요. 컴퓨터도 더할 수 있어요.', pts: '승리 +1P · 패배 -1P (1P 기록)' },
    online: { name: '온라인 대결', desc: '방 코드로 다른 기기의 친구와 실시간으로 겨뤄요.', pts: '사람과 대결 승리 +2P · 패배 -1P' }
  };
  const fakeCh = { send() {}, track() {}, untrack() {}, leave() {} };
  const TILE = {
    2: ['#EEF1FF', '#1D2340'], 4: ['#CFEFFF', '#1D2340'], 8: ['#3BC8F5', '#0F1430'], 16: ['#4C7DFF', '#FFFFFF'],
    32: ['#A66BFF', '#FFFFFF'], 64: ['#FF5A5F', '#FFFFFF'], 128: ['#FF9A3D', '#0F1430'], 256: ['#FFD23F', '#0F1430'],
    512: ['#3DDC84', '#0F1430'], 1024: ['#FF3D8B', '#FFFFFF'], 2048: ['#21B866', '#FFFFFF']
  };
  const tileColor = v => TILE[v] || ['#FFFFFF', '#FF3D8B'];

  /* ================= 규칙 ================= */
  const LINES = { left: [], right: [], up: [], down: [] };
  for (let i = 0; i < N; i++) {
    const row = [0, 1, 2, 3].map(j => i * N + j), col = [0, 1, 2, 3].map(j => j * N + i);
    LINES.left.push(row); LINES.right.push(row.slice().reverse()); LINES.up.push(col); LINES.down.push(col.slice().reverse());
  }
  // 판 b(16칸)를 dir로 밀기 → { b, gained, moved }
  function slide(b, dir) {
    const out = b.slice(); let gained = 0, moved = false;
    LINES[dir].forEach(idx => {
      const vals = idx.map(i => b[i]).filter(Boolean), res = [];
      for (let k = 0; k < vals.length; k++) {
        if (vals[k] === vals[k + 1]) { res.push(vals[k] * 2); gained += vals[k] * 2; k++; } else res.push(vals[k]);
      }
      idx.forEach((i, k) => { const v = res[k] || 0; if (out[i] !== v) moved = true; out[i] = v; });
    });
    return { b: out, gained, moved };
  }
  const canMove = b => b.some(v => !v) || DIRS.some(d => slide(b, d).moved);

  function Engine(opt) {
    opt = opt || {};
    const e = { b: null, score: 0, max: 2, moves: 0, resets: 0, won: false, fresh: [] };
    function spawn() {
      const empty = []; e.b.forEach((v, i) => { if (!v) empty.push(i); });
      if (!empty.length) return;
      const i = empty[Math.random() * empty.length | 0];
      e.b[i] = Math.random() < 0.9 ? 2 : 4; e.fresh.push({ i, t: 0 });
    }
    e.reset = function (count) {
      e.b = Array(N * N).fill(0); e.max = 2; e.fresh = [];
      if (count) e.resets++;
      spawn(); spawn();
      opt.onChange && opt.onChange();
    };
    e.move = function (dir) {
      if (e.won) return false;
      const r = slide(e.b, dir); if (!r.moved) return false;
      e.b = r.b; e.score += r.gained; e.moves++;
      e.max = Math.max(...e.b);
      spawn();
      if (e.max >= GOAL) { e.won = true; opt.onWin && opt.onWin(); }
      else if (!canMove(e.b)) { opt.onStuck && opt.onStuck(); e.reset(true); return true; }
      opt.onChange && opt.onChange();
      return true;
    };
    e.reset(false);
    return e;
  }

  /* ================= 컴퓨터 상대 ================= */
  const W_SNAKE = [15, 14, 13, 12, 8, 9, 10, 11, 7, 6, 5, 4, 0, 1, 2, 3].map(k => Math.pow(4, k / 3));
  function evalBoard(b) {
    let empty = 0, snake = 0, merges = 0;
    for (let i = 0; i < 16; i++) {
      const v = b[i]; if (!v) { empty++; continue; }
      snake += v * W_SNAKE[i];
      if (i % 4 < 3 && b[i + 1] === v) merges += v;
      if (i < 12 && b[i + 4] === v) merges += v;
    }
    return snake / 64 + empty * 220 + merges * 1.5;
  }
  function bestMove(b, err) {
    const opts = [];
    DIRS.forEach(d => {
      const r = slide(b, d); if (!r.moved) return;
      // 새 숫자(2)가 나올 수 있는 칸마다 다음 수의 최선을 평균
      const empty = []; r.b.forEach((v, i) => { if (!v) empty.push(i); });
      let sum = 0;
      const sample = empty.length > 6 ? empty.filter((_, k) => k % 2 === 0) : empty;
      sample.forEach(i => {
        const nb = r.b.slice(); nb[i] = 2;
        let best = -1;
        DIRS.forEach(d2 => { const r2 = slide(nb, d2); if (r2.moved) best = Math.max(best, evalBoard(r2.b) + r2.gained); });
        sum += best < 0 ? -5000 : best;
      });
      opts.push({ d, s: (sample.length ? sum / sample.length : evalBoard(r.b)) + r.gained });
    });
    if (!opts.length) return null;
    opts.sort((a, c) => c.s - a.s);
    if (err && opts.length > 1 && Math.random() < err) return opts[1].d;   // 가끔 두 번째로 좋은 수
    return opts[0].d;
  }
  function Bot(level, opt) {
    const L = BOTS[level] || BOTS.normal, eng = Engine(opt);
    let t = 0;
    return {
      eng,
      update(dt) {
        if (eng.won) return;
        t += dt;
        if (t >= L.delay * (0.8 + Math.random() * 0.4)) { t = 0; const d = bestMove(eng.b, L.err); if (d) eng.move(d); }
      }
    };
  }

  /* ================= 그리기 ================= */
  function tray(ctx, x, y, w) {
    const im = P.img('tray');
    if (P.ok(im)) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(im, x, y, w, w); ctx.restore(); }
    else { ctx.fillStyle = P.BOARD; ctx.fillRect(x, y, w, w); }
  }
  function drawTiles(ctx, b, x, y, w, fresh, small) {
    const g = G * w / W, t = T * w / W;
    tray(ctx, x, y, w);
    for (let i = 0; i < 16; i++) {
      const tx = x + g + (i % 4) * (t + g), ty = y + g + (i / 4 | 0) * (t + g);
      ctx.fillStyle = '#1C2452'; ctx.fillRect(tx, ty, t, t);
      const v = b && b[i]; if (!v) continue;
      const f = fresh && fresh.find(a => a.i === i), sc = f ? Math.min(1, 0.4 + f.t / 120) : 1, s = t * sc, o = (t - s) / 2;
      const [bg, fg] = tileColor(v);
      P.block(ctx, tx + o, ty + o, s, bg);
      if (small && t < 22) continue;
      const str = String(v), size = Math.round(t * (str.length <= 2 ? 0.3 : str.length === 3 ? 0.25 : 0.2));
      ctx.font = size + 'px "Press Start 2P", "Courier New", monospace';
      ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(str, tx + t / 2 + 1, ty + t / 2 + 2);
    }
  }
  // 1024까지 얼마나 왔나 (2 → 1024 = 1~10단계)
  const progress = max => Math.min(1, Math.log2(Math.max(2, max)) / Math.log2(GOAL));

  /* ================= 화면 상태 ================= */
  let A = null, root = null, lobby = null, room = null, match = null, guestNick = null;
  try { guestNick = sessionStorage.getItem('gogogogo.guestNick'); } catch (e) { /* noop */ }
  if (!guestNick) guestNick = '손님' + (1000 + Math.random() * 9000 | 0);
  const myNick = () => (Hub.user ? Hub.user.nickname : guestNick);
  const myAvatar = () => (Hub.user ? Hub.user.avatar : AV.normalize({}));
  const bust = (av, scale) => `<canvas class="av-bust" data-avatar="${AV.attr(av)}" data-crop="bust" data-scale="${scale || 2}" aria-hidden="true"></canvas>`;
  const esc = s => A.esc(s);

  /* ---------- 처음 화면 ---------- */
  function renderHome() {
    root.innerHTML = `
      <div class="page-head"><a class="back" href="#home">← 게임 목록</a><h1>퍼즐1024</h1><p>같은 숫자를 밀어서 합쳐요. 2 → 4 → 8 … → <b>1024</b>를 가장 먼저 만든 사람이 승리! 최대 ${MAX}명.</p></div>
      <div class="play-modes">${Object.entries(PLAY).map(([k, v]) => `
        <button type="button" class="play-mode pm-${k}" data-play="${k}"><span class="pm-name">${v.name}</span><span class="pm-desc">${v.desc}</span><span class="pm-pts">${v.pts}</span></button>`).join('')}
      </div>
      <div class="battle-lobby" style="margin-top:18px">
        <div class="panel b-rules"><h3>규칙</h3><ul class="rule-list">
          <li>방향을 누르면 모든 숫자가 그쪽으로 밀리고, 같은 숫자가 부딪치면 합쳐져요.</li>
          <li><b>${GOAL}</b>을 가장 먼저 만든 사람이 1위, 나머지는 만든 가장 큰 숫자 순서예요.</li>
          <li>막힐 것 같으면 <b>Ctrl</b>(오프라인은 Shift)로 내 판을 처음부터 다시 시작할 수 있어요.</li>
          <li>더 움직일 수 없게 되면 자동으로 처음부터 다시 시작돼요.</li></ul></div>
        <div class="panel b-rules"><h3>조작 키</h3><ul class="rule-list">
          <li><b>혼자</b>: 방향키 또는 WASD 밀기 · Ctrl 다시 시작</li>
          <li><b>오프라인 1P</b>: W A S D 밀기 · 왼쪽 Shift 다시 시작</li>
          <li><b>오프라인 2P</b>: 방향키 밀기 · 오른쪽 Shift 다시 시작</li>
          <li>휴대폰은 화면을 밀거나 아래 버튼으로 해요.</li></ul></div>
      </div>`;
    $$('[data-play]', root).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.play;
      if (k === 'online') { openLobby(); renderLobby(); } else createLocal(k);
    }));
  }
  function createLocal(play) {
    leaveRoom(true);
    const me = { id: Hub.clientId, nick: myNick(), avatar: myAvatar(), joinedAt: Date.now() };
    room = { code: '', local: true, play, ch: fakeCh, peers: [me], bots: [], status: 'waiting', hostId: Hub.clientId, joinedAt: me.joinedAt };
    if (play === 'offline') room.bots.push({ id: P2, nick: '2P', human: true, owner: Hub.clientId, avatar: AV.random('2p-friend') });
    else room.bots.push({ id: 'bot-' + Math.random().toString(36).slice(2, 8), nick: BOT_NAMES[0], level: 'normal', owner: Hub.clientId, avatar: AV.random('nbot-a') });
    renderRoom();
  }

  /* ---------- 온라인 로비 ---------- */
  function openLobby() {
    if (lobby) return;
    lobby = { rooms: [] };
    lobby.ch = Hub.channel('p1024-lobby', {
      onPeers(list) { lobby.rooms = list.filter(r => r && r.code); if (!room) renderRoomList(); },
      onMsg() {},
      onError() { A.toast('실시간 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); }
    });
  }
  function closeLobby() { if (lobby) { lobby.ch.leave(); lobby = null; } }
  function renderLobby() {
    root.innerHTML = `
      <div class="page-head"><button class="back" type="button" data-home>← 대결 방식 고르기</button><h1>퍼즐1024 · 온라인 대결</h1><p>방을 만들고 코드를 친구에게 알려 주세요. 최대 ${MAX}명.</p></div>
      ${Hub.mode === 'demo' ? '<div class="note-box"><b>체험 모드</b> · 지금은 같은 브라우저의 다른 탭끼리만 대결돼요.</div>' : ''}
      <div class="battle-lobby">
        <div class="panel"><h3>대결 시작</h3>
          ${Hub.user ? `<p class="small" style="margin:0 0 12px"><b>${esc(Hub.user.nickname)}</b> 님으로 참가해요. 결과가 전적에 저장됩니다.</p>`
            : `<form class="form" id="nickForm" novalidate><label for="pz-nick">닉네임 <small>손님은 기록이 저장되지 않아요</small></label><input id="pz-nick" maxlength="10" value="${esc(guestNick)}"></form>`}
          <button class="btn btn-primary btn-block" type="button" id="pzCreate">방 만들기</button>
          <form class="code-join" id="joinForm" novalidate><label for="pz-code">방 코드로 입장</label>
            <div class="code-row"><input id="pz-code" maxlength="4" placeholder="ABCD" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn" type="submit">입장</button></div></form>
        </div>
        <div class="panel"><h3>열린 방 <small>누르면 입장</small></h3><ul class="room-list" id="roomList"><li class="empty">방을 찾는 중…</li></ul></div>
      </div>`;
    const sync = () => { const i = $('#pz-nick'); if (i && i.value.trim().length >= 2) { guestNick = i.value.trim().slice(0, 10); try { sessionStorage.setItem('gogogogo.guestNick', guestNick); } catch (e) { /* noop */ } } };
    $('[data-home]', root).addEventListener('click', () => { closeLobby(); renderHome(); });
    $('#pzCreate').addEventListener('click', () => { sync(); joinRoom(newCode()); });
    $('#joinForm').addEventListener('submit', e => {
      e.preventDefault(); sync();
      const code = $('#pz-code').value.trim().toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(code)) { A.toast('방 코드 4자리를 입력해 주세요.'); return; }
      joinRoom(code);
    });
    $('#roomList').addEventListener('click', e => { const b = e.target.closest('[data-code]'); if (b) { sync(); joinRoom(b.dataset.code); } });
    renderRoomList();
  }
  function renderRoomList() {
    const ul = $('#roomList'); if (!ul || !lobby) return;
    const rooms = lobby.rooms.slice().sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1) || b.at - a.at);
    if (!rooms.length) { ul.innerHTML = '<li class="empty">아직 열린 방이 없어요. 방을 만들고 코드를 친구에게 알려 주세요.</li>'; return; }
    ul.innerHTML = rooms.map(r => `<li><button type="button" class="room-item" ${r.count >= MAX ? 'disabled' : ''} data-code="${esc(r.code)}"><span class="room-code">${esc(r.code)}</span><span class="room-host">${esc(r.nick)}의 방</span><span class="room-meta">${r.count}/${MAX}명 · ${r.status === 'playing' ? '경기 중' : r.count >= MAX ? '꽉 참' : '대기 중'}</span></button></li>`).join('');
  }

  /* ---------- 방 (대기실) ---------- */
  function joinRoom(code) {
    leaveRoom(true);
    room = { code, peers: [], bots: [], status: 'waiting', hostId: null, joinedAt: Date.now() };
    room.ch = Hub.channel('p1024-room-' + code, { onMsg: onRoomMsg, onPeers: onRoomPeers, onError() { A.toast('방에 연결하지 못했어요.'); } });
    room.ch.track({ id: Hub.clientId, nick: myNick(), uid: Hub.user ? Hub.user.id : null, joinedAt: room.joinedAt, avatar: myAvatar() });
    renderRoom();
    setTimeout(() => {
      if (!room || room.code !== code) return;
      const before = room.peers.filter(p => p.joinedAt < room.joinedAt).length + room.bots.length;
      if (before >= MAX) { A.toast('방이 꽉 찼어요. 다른 방을 골라 주세요.'); leaveRoom(); }
    }, 1500);
  }
  function leaveRoom(silent) {
    stopMatch();
    if (!room) return;
    if (room.local) { room = null; if (!silent) renderHome(); return; }
    if (lobby) lobby.ch.untrack();
    room.ch.leave(); room = null;
    if (!silent) renderLobby();
  }
  const isHost = () => room && room.hostId === Hub.clientId;
  const totalCount = () => room.peers.length + room.bots.length;
  function onRoomPeers(list) {
    if (!room) return;
    room.peers = list.filter(p => p && p.id).sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    const prev = room.hostId;
    room.hostId = room.peers.length ? room.peers[0].id : Hub.clientId;
    if (prev && prev !== room.hostId && isHost()) { A.toast('방장이 나가서 내가 방장이 됐어요.'); room.bots = room.bots.filter(b => b.owner === Hub.clientId); }
    if (match && !match.ended) {
      const here = new Set(room.peers.map(p => p.id));
      match.roster.forEach(r => { if ((r.bot ? !here.has(r.owner) : !here.has(r.id)) && !match.gone.has(r.id)) { match.gone.add(r.id); A.toast(r.nick + ' 님이 나갔어요'); } });
      if (match.roster.filter(r => !match.gone.has(r.id)).length <= 1) finish(Hub.clientId);
    }
    if (isHost()) { broadcastRoom(); advertise(); }
    if (!match) renderRoom();
  }
  function broadcastRoom() { room.ch.send({ t: 'room', bots: room.bots, status: room.status }); }
  function advertise() { if (lobby && room && !room.local && isHost()) lobby.ch.track({ code: room.code, nick: myNick(), count: totalCount(), status: room.status, at: room.joinedAt }); }
  function onRoomMsg(m) {
    if (!room || !m) return;
    if (m.t === 'room') { if (!isHost()) { room.bots = m.bots || []; room.status = m.status; if (!match) renderRoom(); } }
    else if (m.t === 'start') startMatch(m.seed, m.roster);
    else if (!match) return;
    else if (m.t === 'board') { match.others[m.id] = m; drawMini(m.id); }
    else if (m.t === 'win') finish(m.id, true);
  }

  function memberLi(m, host) {
    const mine = m.id === Hub.clientId;
    return `<li>${bust(m.avatar || AV.random(m.id), 2)}<span class="nm">${esc(m.nick)}</span>`
      + (m.id === room.hostId && !room.local ? '<span class="badge host">방장</span>' : '')
      + (mine ? `<span class="badge me">${room.play === 'offline' ? '1P · 나' : '나'}</span>` : '')
      + (m.human ? '<span class="badge bot">같은 키보드 · 방향키</span>' : '')
      + (m.bot ? `<span class="badge bot">컴퓨터 · ${BOTS[m.level].name}</span>` : '')
      + `<span class="li-ctrl">${m.bot && host ? `<button class="link" type="button" data-rmbot="${esc(m.id)}">빼기</button>` : ''}</span></li>`;
  }
  function renderRoom() {
    if (!room || !root) return;
    const host = isHost(), total = totalCount();
    if (room.status === 'playing' && !(match && match.roster.some(r => r.id === Hub.clientId))) {
      root.innerHTML = `<div class="panel gate"><h2>경기가 진행 중이에요</h2><p>방 <b class="num">${esc(room.code)}</b> · 이번 판이 끝나면 다음 판부터 함께할 수 있어요.</p><button class="btn" type="button" id="pzLeave">나가기</button></div>`;
      $('#pzLeave').addEventListener('click', () => leaveRoom());
      return;
    }
    const members = room.peers.map(p => ({ id: p.id, nick: p.nick, avatar: p.avatar })).concat(room.bots.map(b => ({ ...b, bot: !b.human })));
    const hostPeer = room.peers.find(p => p.id === room.hostId);
    const ok = total >= 2;
    root.innerHTML = `
      <div class="room">
        ${room.local ? `<div class="panel room-head"><div><span class="lbl">퍼즐1024</span><h2 style="margin:4px 0 0">${PLAY[room.play].name}</h2><p class="small" style="margin:4px 0 0">${room.play === 'offline' ? '1P는 WASD·왼쪽 Shift, 2P는 방향키·오른쪽 Shift로 해요.' : '컴퓨터 상대를 더하거나 빼고 시작하세요.'} ${PLAY[room.play].pts}</p></div>
          <div class="row" style="margin:0"><button class="btn" type="button" id="pzLeave">다른 방식 고르기</button></div></div>`
        : `<div class="panel room-head"><div><span class="lbl">ROOM CODE</span><div class="room-code-big num">${esc(room.code)}</div><p class="small" style="margin:4px 0 0">친구에게 이 코드를 알려 주면 같은 방에 들어올 수 있어요.</p></div>
          <div class="row" style="margin:0"><button class="btn" type="button" id="pzCopy">코드 복사</button><button class="btn" type="button" id="pzLeave">나가기</button></div></div>`}
        <div class="room-grid">
          <div class="panel"><h3>참가자 <small>${total}/${MAX}명</small></h3><ul class="players">${members.map(m => memberLi(m, host)).join('')}</ul></div>
          <div class="panel">
            ${host ? `<h3>${room.local ? '경기 설정' : '방장 설정'}</h3>
              <p class="small" style="margin:0 0 8px">컴퓨터 상대 추가</p>
              <div class="bot-add">${Object.entries(BOTS).map(([k, v]) => `<button class="btn btn-sm" type="button" data-addbot="${k}" ${total >= MAX ? 'disabled' : ''}>+ ${v.name}</button>`).join('')}</div>
              <button class="btn btn-primary btn-block" type="button" id="pzStart" ${ok ? '' : 'disabled'} style="margin-top:16px">대결 시작 ▶</button>
              <p class="small">${ok ? total + '명이 1024 먼저 만들기로 겨뤄요.' : '2명 이상이어야 시작할 수 있어요. 친구를 기다리거나 컴퓨터를 추가해 보세요.'}</p>`
            : `<h3>준비 완료</h3><p class="small" style="margin:0">${esc(hostPeer ? hostPeer.nick : '방장')} 님이 시작하면 바로 경기가 시작돼요.</p><div class="waiting-dots" aria-hidden="true"><i></i><i></i><i></i></div>`}
          </div>
        </div>
      </div>`;
    AV.paintAll(root);
    $('#pzLeave').addEventListener('click', () => leaveRoom());
    if ($('#pzCopy')) $('#pzCopy').addEventListener('click', () => { try { navigator.clipboard.writeText(room.code).then(() => A.toast('방 코드 ' + room.code + '를 복사했어요.')); } catch (e) { A.toast('방 코드: ' + room.code); } });
    if (!host) return;
    $$('[data-addbot]', root).forEach(b => b.addEventListener('click', () => {
      if (totalCount() >= MAX) return;
      const used = new Set(room.bots.map(x => x.nick));
      const id = 'bot-' + Math.random().toString(36).slice(2, 8);
      room.bots.push({ id, nick: BOT_NAMES.find(n => !used.has(n)) || ('봇' + (room.bots.length + 1)), level: b.dataset.addbot, owner: Hub.clientId, avatar: AV.random(id) });
      broadcastRoom(); advertise(); renderRoom();
    }));
    $$('[data-rmbot]', root).forEach(b => b.addEventListener('click', () => { room.bots = room.bots.filter(x => x.id !== b.dataset.rmbot || x.human); broadcastRoom(); advertise(); renderRoom(); }));
    $('#pzStart').addEventListener('click', hostStart);
  }
  function hostStart() {
    if (!isHost() || totalCount() < 2) return;
    const seed = (Math.random() * 2147483647) | 0;
    const roster = room.peers.map(p => ({ id: p.id, nick: p.nick, avatar: p.avatar }))
      .concat(room.bots.map(b => ({ id: b.id, nick: b.nick, bot: !b.human, human: !!b.human, level: b.level, owner: b.owner, avatar: b.avatar })));
    room.ch.send({ t: 'start', seed, roster });
    startMatch(seed, roster);
  }

  /* ---------- 경기 ---------- */
  function startMatch(seed, roster) {
    if (!room) return;
    stopMatch();
    room.status = 'playing';
    if (isHost()) { broadcastRoom(); advertise(); }
    if (!roster.some(r => r.id === Hub.clientId)) { renderRoom(); return; }
    match = { roster, n: roster.length, others: {}, gone: new Set(), local: {}, places: {}, running: false, ended: false, raf: 0, last: 0, clock: P.clock(), play: room.local ? room.play : 'online', saved: null, flash: {}, throttle: {} };
    const mk = id => ({ onChange: () => sendBoard(id), onWin: () => { if (!room.local) room.ch.send({ t: 'win', id }); finish(id); }, onStuck: () => { if (mainIds().includes(id)) A.toast((id === Hub.clientId ? '' : '2P ') + '더 움직일 수 없어서 처음부터 다시 시작해요.'); } });
    match.local[Hub.clientId] = { eng: Engine(mk(Hub.clientId)) };
    roster.filter(r => r.human && r.owner === Hub.clientId).forEach(r => { match.local[r.id] = { eng: Engine(mk(r.id)), human: true }; });
    roster.filter(r => r.bot && r.owner === Hub.clientId).forEach(r => { const bot = Bot(r.level, mk(r.id)); match.local[r.id] = { eng: bot.eng, bot }; });
    renderMatch();
    countdown();
  }
  function stopMatch() {
    if (!match) return;
    BGM.pause(); cancelAnimationFrame(match.raf); clearTimeout(match.cdTimer);
    Object.values(match.throttle).forEach(q => clearTimeout(q.timer));
    match = null;
  }
  const mainIds = () => match ? [Hub.clientId].concat(match.roster.filter(r => r.human && match.local[r.id]).map(r => r.id)) : [];
  const BOARD_EVERY = 700;
  function sendBoard(id) {
    const L = match && match.local[id]; if (!L) return;
    match.others[id] = { t: 'board', id, b: L.eng.b.slice(), max: L.eng.max, score: L.eng.score, resets: L.eng.resets };
    drawMini(id);
    if (room.local) return;
    const q = match.throttle[id] || (match.throttle[id] = { last: 0, timer: 0 }), m = match;
    const fire = () => { q.timer = 0; q.last = Date.now(); if (match === m && room) room.ch.send(m.others[id]); };
    if (Date.now() - q.last >= BOARD_EVERY) fire(); else if (!q.timer) q.timer = setTimeout(fire, BOARD_EVERY - (Date.now() - q.last));
  }
  const maxOf = id => (match.local[id] ? match.local[id].eng.max : (match.others[id] && match.others[id].max) || 2);
  const scoreOf = id => (match.local[id] ? match.local[id].eng.score : (match.others[id] && match.others[id].score) || 0);
  function finish(winner) {
    if (!match || match.ended) return;
    match.ended = true; match.running = false; match.clock.stop();
    const rest = match.roster.filter(r => r.id !== winner).sort((a, b) => maxOf(b.id) - maxOf(a.id) || scoreOf(b.id) - scoreOf(a.id));
    match.places[winner] = 1; rest.forEach((r, i) => { match.places[r.id] = i + 2; });
    room.status = 'waiting';
    if (isHost()) { broadcastRoom(); advertise(); }
    saveResult(); showResult();
  }
  async function saveResult() {
    const L = match.local[Hub.clientId], place = match.places[Hub.clientId]; if (!L || !place) return;
    const win = place === 1, eng = L.eng;
    const humansAgainst = match.play === 'online' && match.roster.some(r => !r.bot && r.id !== Hub.clientId);
    const delta = window.GoSettings.pointsFor('p1024', win, humansAgainst ? null : 'botsOnly').delta;
    match.saved = { status: Hub.user ? 'saving' : 'guest', win, delta, score: eng.score };
    if (!Hub.user) return showResult();
    const m = match;
    try {
      const r = await Hub.submitScore({ game_id: 'p1024', score: eng.score, result: win ? 'win' : 'lose', points_delta: delta, duration_sec: Math.max(m.clock.sec(), 3), extra: { play: m.play, place, players: m.n, max: eng.max, resets: eng.resets, moves: eng.moves, bots: m.roster.filter(x => x.bot).length } });
      m.saved = { ...m.saved, status: r.queued ? 'queued' : 'saved', gained: r.gained };
    } catch (e) { m.saved = { ...m.saved, status: 'error', msg: e.message }; }
    if (match === m) showResult();
  }

  function renderMatch() {
    const mains = mainIds(), others = match.roster.filter(r => !mains.includes(r.id));
    const half = Math.ceil(others.length / 2), sides = [others.slice(0, half), others.slice(half)];
    const miniHTML = r => `<div class="mini mini-sq" data-mini="${esc(r.id)}"><div class="mini-screen"><canvas aria-hidden="true"></canvas><div class="mini-ko" hidden></div></div><div class="mini-name"><span>${bust(r.avatar || AV.random(r.id), 1)}${esc(r.nick)}</span>${r.bot ? `<small>컴퓨터·${BOTS[r.level].name}</small>` : ''}</div><div class="mini-stat num" data-stat>MAX 2</div></div>`;
    const nick = id => (match.roster.find(x => x.id === id) || {}).nick || '';
    root.innerHTML = `
      <div class="match">
        <div class="play-head"><span class="cat">${match.play === 'online' ? '방 ' + esc(room.code) : '퍼즐1024'}</span><h1>${PLAY[match.play].name}</h1><span class="small" style="margin:0">${GOAL}을 먼저 만들면 승리</span></div>
        <div class="match-grid v2 ${mains.length > 1 ? 'two' : ''}">
          <div class="minis side-l">${sides[0].map(miniHTML).join('')}</div>
          <div class="stage-col">
            <div class="mains">
              ${mains.map((id, i) => `<div class="main-col">${mains.length > 1 ? `<div class="main-tag">${i ? '2P · 방향키 · 오른쪽 Shift' : '1P · WASD · 왼쪽 Shift'} <b>${esc(nick(id))}</b></div>` : ''}<div class="cabinet" style="--cw:${W}px;--ar:${W / H}"><div class="screen"><canvas data-main="${esc(id)}" aria-label="${i ? '2P' : '내'} 게임 화면"></canvas></div></div></div>`).join('')}
              <div class="overlay" id="pzOv"></div>
            </div>
            <div class="pad cross" id="pad"><span class="sp"></span><button type="button" data-act="up" aria-label="위">▲</button><button type="button" data-act="reset" aria-label="다시 시작" style="font-size:11px">다시</button><button type="button" data-act="left" aria-label="왼쪽">◀</button><button type="button" data-act="down" aria-label="아래">▼</button><button type="button" data-act="right" aria-label="오른쪽">▶</button></div>
          </div>
          <div class="minis side-r">${sides[1].map(miniHTML).join('')}</div>
        </div>
      </div>`;
    match.ctxs = {};
    mains.forEach(id => { match.ctxs[id] = P.setup(root.querySelector(`canvas[data-main="${CSS.escape(id)}"]`), W, H); });
    $$('.mini-screen canvas', root).forEach(c => P.setup(c, MINI, MINI));
    AV.paintAll(root);
    others.forEach(r => drawMini(r.id));
    $$('#pad [data-act]', root).forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); act(b.dataset.act); }));
    P.swipe(root.querySelector(`canvas[data-main="${CSS.escape(Hub.clientId)}"]`), d => { if (d !== 'tap') act(d); });
    const loop = t => {
      if (!match) return;
      match.raf = requestAnimationFrame(loop);
      const dt = Math.min(100, t - (match.last || t)); match.last = t;
      if (match.running && !match.ended) Object.values(match.local).forEach(L => { if (L.bot) L.bot.update(dt); });
      mains.forEach(id => drawMain(id, dt));
    };
    match.raf = requestAnimationFrame(loop);
  }
  function countdown() {
    const ov = $('#pzOv'); let n = 3;
    const hint = match.play === 'offline' ? '1P: WASD · 왼쪽 Shift 다시 시작<br>2P: 방향키 · 오른쪽 Shift 다시 시작' : match.n + '명 · ' + GOAL + ' 먼저 만들기 · Ctrl 다시 시작';
    const step = () => {
      if (!match || !ov.isConnected) return;
      if (n > 0) { ov.hidden = false; ov.innerHTML = `<div class="ov-box"><div class="count num">${n}</div><p class="ov-hint">${hint}</p></div>`; n--; match.cdTimer = setTimeout(step, 1000); }
      else { ov.hidden = true; match.running = true; match.clock.start(); BGM.restart(); }
    };
    step();
  }
  function act(a, id) {
    id = id || Hub.clientId;
    const L = match && match.local[id];
    if (!match || !match.running || match.ended || !L || L.bot) return;
    if (a === 'reset') { L.eng.reset(true); A.toast((id === Hub.clientId ? (match.play === 'offline' ? '1P ' : '') : '2P ') + '판을 처음부터 다시 시작해요.'); return; }
    L.eng.move(a);
  }
  function drawMain(id, dt) {
    const ctx = match.ctxs[id], L = match.local[id]; if (!ctx || !L) return;
    const e = L.eng;
    ctx.fillStyle = P.PANEL; ctx.fillRect(0, 0, W, TOP);
    P.text(ctx, 'MAX', 14, 10, 9, P.DIM); P.text(ctx, e.max, 14, 26, 15, tileColor(e.max)[0]);
    P.text(ctx, 'SCORE', 120, 10, 9, P.DIM); P.text(ctx, e.score, 120, 26, 13, P.INK);
    P.text(ctx, 'RESET', 250, 10, 9, P.DIM); P.text(ctx, e.resets, 250, 26, 13, e.resets ? '#FF9A3D' : P.INK);
    P.text(ctx, 'GOAL', 330, 10, 9, P.DIM); P.text(ctx, GOAL, 330, 26, 13, '#FF3D8B');
    // 1024까지 진행 막대
    ctx.fillStyle = '#0B0F28'; ctx.fillRect(14, 48, W - 28, 8);
    ctx.fillStyle = '#FF3D8B'; ctx.fillRect(14, 48, (W - 28) * progress(e.max), 8);
    e.fresh = e.fresh.filter(f => (f.t += dt) < 160);
    drawTiles(ctx, e.b, 0, TOP, W, e.fresh);
    if (match.ended && match.places[id]) {
      ctx.fillStyle = 'rgba(10,14,36,.6)'; ctx.fillRect(0, TOP, W, W);
      P.text(ctx, match.places[id] === 1 ? 'WIN!' : match.places[id] + '위', W / 2, TOP + W / 2 - 12, 24, match.places[id] === 1 ? P.PIECE.O : P.INK, 'center');
    }
  }
  function drawMini(id) {
    if (!match || mainIds().includes(id)) return;
    const box = root && root.querySelector(`[data-mini="${CSS.escape(id)}"]`); if (!box) return;
    const c = box.querySelector('.mini-screen canvas'), ctx = c.getContext('2d');
    ctx.setTransform(c.width / MINI, 0, 0, c.width / MINI, 0, 0);
    const o = match.others[id] || {};
    drawTiles(ctx, o.b, 0, 0, MINI, null, true);
    box.querySelector('[data-stat]').textContent = 'MAX ' + (o.max || 2) + (o.resets ? ' · 다시 ' + o.resets : '');
    const k = box.querySelector('.mini-ko'), pl = match.ended && match.places[id];
    if (pl) { k.hidden = false; k.textContent = pl === 1 ? 'WIN' : pl + '위'; box.classList.toggle('win', pl === 1); } else k.hidden = true;
  }
  function showResult() {
    const ov = $('#pzOv'); if (!ov || !match) return;
    match.roster.forEach(r => drawMini(r.id));
    const order = match.roster.slice().sort((a, b) => match.places[a.id] - match.places[b.id]);
    const myPlace = match.places[Hub.clientId], s = match.saved || {};
    let note = '';
    if (s.status === 'saving') note = '<p class="ov-note">기록 저장 중…</p>';
    else if (s.status === 'saved') note = `<p class="ov-note ${s.gained > 0 ? 'ok' : ''}">${s.win ? '승리' : '패배'} ${A.pointText(s.gained, s.delta)} · 전적에 저장했어요</p>`;
    else if (s.status === 'queued') note = '<p class="ov-note">오프라인이라 연결되면 저장돼요.</p>';
    else if (s.status === 'error') note = `<p class="ov-note bad">${esc(s.msg)}</p>`;
    else if (s.status === 'guest') note = '<p class="ov-note">손님 플레이 (로그인하면 기록이 남아요)</p>';
    const winner = order[0];
    ov.hidden = false;
    ov.innerHTML = `<div class="ov-box result">
      <canvas class="ov-avatar" data-avatar="${AV.attr(winner.avatar || AV.random(winner.id))}" data-scale="3" aria-hidden="true"></canvas>
      <div class="ov-title">${winner.id === Hub.clientId ? '우승!' : esc(winner.nick) + ' 승리'}</div>${myPlace === 1 ? '<span class="ov-best">WINNER</span>' : `<span class="ov-hint">나는 ${myPlace}위</span>`}
      <ol class="result-list">${order.map(r => `<li class="${r.id === Hub.clientId ? 'mine' : ''}"><span class="num">${match.places[r.id]}</span><span class="rl-name">${bust(r.avatar || AV.random(r.id), 1)}${esc(r.nick)}</span><span class="num">${maxOf(r.id)}</span></li>`).join('')}</ol>
      <p class="ov-hint">오른쪽 숫자 = 만든 가장 큰 숫자</p>
      ${note}
      <div class="ov-btns">${isHost() ? '<button class="btn btn-sun" type="button" id="pzAgain">한 판 더 ▶</button>' : ''}<button class="btn" type="button" id="pzBack">${room && room.local ? '설정으로' : '대기실로'}</button></div>
      ${isHost() ? '' : '<p class="ov-hint">방장이 다음 판을 시작하면 바로 시작돼요.</p>'}
      ${match.play === 'offline' ? '<p class="ov-hint">기록은 1P(로그인한 사람)에게 저장돼요.</p>' : ''}
    </div>`;
    AV.paintAll(ov);
    const again = $('#pzAgain'); if (again) again.addEventListener('click', () => { stopMatch(); hostStart(); if (!match) renderRoom(); });
    $('#pzBack').addEventListener('click', () => { stopMatch(); renderRoom(); });
  }

  function onKey(e) {
    if (!match || !match.running) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    let a, id = Hub.clientId;
    if (match.play === 'offline' && match.local[P2]) {
      if (KEY_1P[e.code]) a = KEY_1P[e.code];
      else if (KEY_2P[e.code]) { a = KEY_2P[e.code]; id = P2; }
    } else a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (e.repeat) return;
    act(a, id);
  }

  window.GoP1024 = {
    render(el, app) {
      A = app; root = el;
      BGM.load('p1024');
      document.addEventListener('keydown', onKey);
      if (room) renderRoom(); else if (lobby) renderLobby(); else renderHome();
      return function cleanup() { document.removeEventListener('keydown', onKey); leaveRoom(true); closeLobby(); root = null; BGM.stop(); };
    },
    _debug: () => ({ room, match, slide, bestMove, Engine })
  };

  // 게임 카드 썸네일
  window.GoGames.p1024 = {
    id: 'p1024',
    thumb(ctx, w, h) {
      ctx.fillStyle = P.BOARD; ctx.fillRect(0, 0, w, h);
      const s = 22, g = 3, bw = 4 * s + 3 * g;
      const mk = (b, x) => b.forEach((v, i) => { const tx = x + (i % 4) * (s + g), ty = (h - bw) / 2 + (i / 4 | 0) * (s + g); ctx.fillStyle = '#1C2452'; ctx.fillRect(tx, ty, s, s); if (!v) return; P.block(ctx, tx, ty, s, tileColor(v)[0]); ctx.font = (v > 99 ? 5 : v > 9 ? 7 : 8) + 'px "Press Start 2P", monospace'; ctx.fillStyle = tileColor(v)[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(v, tx + s / 2 + 1, ty + s / 2 + 1); });
      mk([2, 0, 4, 0, 8, 16, 0, 2, 32, 64, 128, 4, 512, 256, 16, 8], 8);
      mk([0, 2, 0, 0, 4, 8, 2, 0, 16, 32, 64, 2, 1024, 512, 128, 8], w - 8 - bw);
      P.text(ctx, 'VS', w / 2, h / 2 - 7, 12, P.PIECE.O, 'center');
    }
  };
})();
