/*
 * gogo?gogo! — Skillcom RPG '맵 만들기' (관리자 전용 · v124 · 주소 #mapedit)
 *  - 50 × 34 칸(한 칸 32px) 바둑판에 풀·길·나무·바위·물·꽃·연못을 마우스(손가락)로 끌어 칠함
 *  - 게임과 같은 그림으로 바로 보임 (games/action/rpg/world.js 의 previewMap · drawMapObj)
 *  - 저장: Supabase rpg_maps 표 (supabase/rpg_maps_v124.sql) · 체험 모드는 이 브라우저 · JSON 파일 내보내기/가져오기
 *  - 아직 게임에는 연결 안 함 (다음 단계: 스테이지 출구 → 이 맵)
 *  칸 번호: 0 풀 · 1 길 · 2 나무 · 3 바위 · 4 물 · 5 꽃 · 12 연못 물가(연못 그림 테두리, 지나갈 수 있음)
 */
(function () {
  'use strict';
  const Hub = window.GameHub;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const W = 50, H = 34, TS = 32, DRAFT = 'gogo_mapedit_draft';
  const TILES = [
    { k: 0, n: '풀(바닥)', ic: '🌱', col: '#6DB85C' }, { k: 1, n: '길', ic: '🟫', col: '#C9A26A' },
    { k: 2, n: '나무', ic: '🌳', col: '#2E6E30' }, { k: 3, n: '바위', ic: '🪨', col: '#8A8A96' },
    { k: 4, n: '물', ic: '💧', col: '#4FA8E8' }, { k: 5, n: '꽃', ic: '🌼', col: '#FFD23F' }
  ];
  const PONDS = [['pond_s', '작은 연못'], ['pond_m', '중간 연못'], ['pond_l', '큰 연못']];
  const EXITS = [['u', '위'], ['d', '아래'], ['l', '왼쪽'], ['r', '오른쪽']];
  const tileName = v => (TILES.find(x => x.k === v) || { n: v === 12 ? '연못 물가' : '?' }).n;

  function blank(region) {
    const t = new Array(W * H).fill(0);
    for (let x = 0; x < W; x++) { t[x] = 2; t[(H - 1) * W + x] = 2; }
    for (let y = 0; y < H; y++) { t[y * W] = 2; t[y * W + W - 1] = 2; }
    return { w: W, h: H, region: region || 0, t, ponds: [], exits: {} };
  }

  function render(root, ui) {
    if (!Hub.isAdmin()) {
      root.innerHTML = `<div class="panel gate"><h2>관리자만 들어올 수 있어요</h2><p>관리자 아이디로 로그인해 주세요.</p>
        <div class="row" style="justify-content:center">${Hub.user ? '<a class="btn" href="#home">홈으로</a>' : '<button class="btn btn-primary" type="button" data-auth="login">로그인</button>'}</div></div>`;
      return () => {};
    }
    const P = window.__GoRPGParts, D = window.GoRPGData;
    if (!P || !P.previewMap) { root.innerHTML = '<div class="panel"><p class="err">RPG 그림 도구를 불러오지 못했어요. 새로고침해 주세요.</p></div>'; return () => {}; }
    let alive = true;
    // 지금 맵 · 이름 · 도구
    let def = null, mapId = '', mapName = '';
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && d.def && d.def.t && d.def.t.length === W * H) { def = d.def; mapId = d.id || ''; mapName = d.name || ''; } } catch (e) { /* noop */ }
    if (!def) def = blank(0);
    let tool = { kind: 'tile', v: 0 }, brush = 1, mode = 'paint', zoom = 0.75, grid = true;
    const undo = [], redo = [];
    const regions = D.REGIONS.map((r, i) => [i, r.name]);

    root.innerHTML = `
      <div class="mapedit">
        <div class="page-head"><h1>🗺 Skillcom RPG 맵 만들기</h1><p>왼쪽에서 고른 것을 지도에 끌어서 칠해요. 게임과 같은 그림으로 바로 보여요. (관리자 전용 · 아직 게임에는 연결 전)</p></div>
        <div class="me-bar panel">
          <label>맵 이름 <input id="meName" type="text" maxlength="30" placeholder="예: 숨은 던전 1" value="${ui.esc(mapName)}"></label>
          <label>맵 아이디 <input id="meId" type="text" maxlength="40" placeholder="예: hidden1 (영문 소문자·숫자)" value="${ui.esc(mapId)}"></label>
          <label>지역 그림 <select id="meRegion">${regions.map(([i, n]) => `<option value="${i}" ${+def.region === i ? 'selected' : ''}>${ui.esc(n)}</option>`).join('')}</select></label>
          <div class="me-btns">
            <button type="button" class="btn" data-act="new">새 맵</button>
            <button type="button" class="btn" data-act="list">불러오기</button>
            <button type="button" class="btn btn-sun" data-act="save">저장</button>
            <button type="button" class="btn" data-act="export">파일로 내보내기</button>
            <label class="btn me-file">파일 가져오기<input type="file" id="meImport" accept=".json,application/json" hidden></label>
          </div>
        </div>
        <div id="meList" class="me-list panel" hidden></div>
        <div class="me-main">
          <aside class="me-side panel">
            <h3>그리기</h3>
            <div class="me-pal">${TILES.map(x => `<button type="button" data-tile="${x.k}"><span class="sw" style="background:${x.col}">${x.ic}</span>${x.n}</button>`).join('')}</div>
            <h3>연못 (한 번 누르면 놓임)</h3>
            <div class="me-pal me-ponds">${PONDS.map(([k, n]) => `<button type="button" data-pond="${k}"><img src="games/action/rpg/img/v79/${k}.png" alt="">${n}</button>`).join('')}</div>
            <h3>도구</h3>
            <div class="me-seg" data-g="mode"><button type="button" data-mode="paint">🖌 붓</button><button type="button" data-mode="rect">▭ 네모</button><button type="button" data-mode="fill">🪣 채우기</button></div>
            <div class="me-seg" data-g="brush">붓 크기 <button type="button" data-brush="1">1</button><button type="button" data-brush="2">2</button><button type="button" data-brush="3">3</button></div>
            <div class="me-seg"><button type="button" data-act="undo">↶ 되돌리기</button><button type="button" data-act="redo">↷ 다시</button></div>
            <div class="me-seg" data-g="zoom">보기 <button type="button" data-zoom="0.5">작게</button><button type="button" data-zoom="0.75">보통</button><button type="button" data-zoom="1">크게</button></div>
            <label class="me-chk"><input type="checkbox" id="meGrid" checked> 칸 줄 보기</label>
            <h3>출구 (켜면 가장자리에 길이 뚫려요)</h3>
            <div class="me-exits">${EXITS.map(([k, n]) => `<label><input type="checkbox" data-exit="${k}"> ${n} → <input type="text" data-exitto="${k}" placeholder="갈 맵 (예: f2)" maxlength="40"></label>`).join('')}</div>
            <p class="me-hint">Ctrl+Z 되돌리기 · Ctrl+Y 다시 · 칠한 것은 이 브라우저에 자동으로 임시 저장돼요.</p>
          </aside>
          <div class="me-stage panel">
            <div class="me-info" id="meInfo">칸 위에 마우스를 올려 보세요</div>
            <div class="me-scroll" id="meScroll"><div class="me-canvases" id="meWrap"><canvas id="meBase"></canvas><canvas id="meOver"></canvas></div></div>
          </div>
        </div>
      </div>`;

    const base = $('#meBase', root), over = $('#meOver', root), wrap = $('#meWrap', root), info = $('#meInfo', root);
    base.width = over.width = W * TS; base.height = over.height = H * TS;
    const bx = base.getContext('2d'), ox = over.getContext('2d');
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : def.t[y * W + x]);

    // ---------- 그리기 ----------
    let rTimer = 0, waiting = new Set();
    function fullRender() {
      if (!alive) return;
      const r = P.previewMap(def, 'edit');
      bx.clearRect(0, 0, base.width, base.height); bx.drawImage(r.ground, 0, 0);
      r.objs.slice().sort((a, b) => a.sy - b.sy).forEach(o => P.drawMapObj(bx, o));
      pending.clear(); drawOver();
      r.need.forEach(n => { if (waiting.has(n)) return; waiting.add(n); P.img79(n, () => { waiting.delete(n); schedule(); }); });
      // 나무·바위 Meshy 그림(받는 대로 다시)
      r.objs.forEach(o => { if (o.alt2 && !P.img79(o.alt2) && !waiting.has(o.alt2)) { waiting.add(o.alt2); P.img79(o.alt2, () => { waiting.delete(o.alt2); schedule(); }); } });
    }
    const schedule = () => { clearTimeout(rTimer); rTimer = setTimeout(fullRender, 120); };
    const pending = new Map();   // 끄는 동안 바로 보이는 칸 (다 그리면 비움)
    let hover = null, rectA = null, rectB = null;
    function drawOver() {
      ox.clearRect(0, 0, over.width, over.height);
      pending.forEach((v, i) => { const x = i % W, y = (i / W) | 0, T = TILES.find(q => q.k === v); ox.globalAlpha = 0.75; ox.fillStyle = T ? T.col : '#4FA8E8'; ox.fillRect(x * TS, y * TS, TS, TS); ox.globalAlpha = 1; });
      if (grid) { ox.strokeStyle = 'rgba(29,35,64,.22)'; ox.lineWidth = 1; ox.beginPath(); for (let x = 0; x <= W; x++) { ox.moveTo(x * TS + 0.5, 0); ox.lineTo(x * TS + 0.5, H * TS); } for (let y = 0; y <= H; y++) { ox.moveTo(0, y * TS + 0.5); ox.lineTo(W * TS, y * TS + 0.5); } ox.stroke(); }
      // 출구 표시
      ox.font = 'bold 22px "Jua", sans-serif'; ox.textAlign = 'center'; ox.textBaseline = 'middle';
      Object.entries(def.exits || {}).forEach(([k, to]) => {
        const p = { u: [W / 2, 0.6, '▲'], d: [W / 2, H - 0.6, '▼'], l: [0.6, H / 2, '◀'], r: [W - 0.6, H / 2, '▶'] }[k]; if (!p) return;
        ox.fillStyle = '#FFD23F'; ox.strokeStyle = '#1D2340'; ox.lineWidth = 4; const label = p[2] + ' ' + (to || '?');
        ox.strokeText(label, p[0] * TS, p[1] * TS); ox.fillText(label, p[0] * TS, p[1] * TS);
      });
      if (rectA && rectB) { const x0 = Math.min(rectA[0], rectB[0]), y0 = Math.min(rectA[1], rectB[1]), x1 = Math.max(rectA[0], rectB[0]), y1 = Math.max(rectA[1], rectB[1]); ox.strokeStyle = '#FFD23F'; ox.lineWidth = 3; ox.strokeRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS); }
      if (hover) {
        if (tool.kind === 'pond') { const PD = P.POND[tool.v], tw = PD.t[0].length, th = PD.t.length, x0 = hover[0] - (tw >> 1), y0 = hover[1] - (th >> 1); const im = P.img79(tool.v); ox.globalAlpha = 0.7; if (im) ox.drawImage(im, x0 * TS, y0 * TS); ox.globalAlpha = 1; ox.strokeStyle = '#FFD23F'; ox.lineWidth = 2; ox.strokeRect(x0 * TS, y0 * TS, tw * TS, th * TS); }
        else { const b = mode === 'paint' ? brush : 1, o = (b - 1) >> 1; ox.strokeStyle = '#FFFFFF'; ox.lineWidth = 2; ox.strokeRect((hover[0] - o) * TS + 1, (hover[1] - o) * TS + 1, b * TS - 2, b * TS - 2); }
      }
    }
    function setZoom(z) { zoom = z; wrap.style.width = W * TS * z + 'px'; wrap.style.height = H * TS * z + 'px'; syncBtns(); }
    function syncBtns() {
      $$('[data-tile]', root).forEach(b => b.setAttribute('aria-pressed', String(tool.kind === 'tile' && +b.dataset.tile === tool.v)));
      $$('[data-pond]', root).forEach(b => b.setAttribute('aria-pressed', String(tool.kind === 'pond' && b.dataset.pond === tool.v)));
      $$('[data-mode]', root).forEach(b => b.setAttribute('aria-pressed', String(mode === b.dataset.mode)));
      $$('[data-brush]', root).forEach(b => b.setAttribute('aria-pressed', String(brush === +b.dataset.brush)));
      $$('[data-zoom]', root).forEach(b => b.setAttribute('aria-pressed', String(zoom === +b.dataset.zoom)));
      EXITS.forEach(([k]) => { const c = $(`[data-exit="${k}"]`, root), t = $(`[data-exitto="${k}"]`, root); c.checked = !!(def.exits && k in def.exits); t.value = (def.exits && def.exits[k]) || ''; t.disabled = !c.checked; });
    }

    // ---------- 고치기 ----------
    const snap = () => JSON.stringify({ t: def.t, ponds: def.ponds, exits: def.exits });
    function push() { undo.push(snap()); if (undo.length > 60) undo.shift(); redo.length = 0; }
    function restore(sn) { const o = JSON.parse(sn); def.t = o.t; def.ponds = o.ponds; def.exits = o.exits || {}; syncBtns(); schedule(); saveDraft(); }
    function saveDraft() { try { localStorage.setItem(DRAFT, JSON.stringify({ def, id: $('#meId', root).value.trim(), name: $('#meName', root).value.trim() })); } catch (e) { /* noop */ } }
    // 연못이 있던 칸을 건드리면 그 연못 전체를 없앰 (물·물가 칸 → 풀)
    function dropPondAt(x, y) {
      def.ponds = def.ponds.filter(p => {
        const PD = P.POND[p.k], inside = x >= p.x && y >= p.y && x < p.x + PD.t[0].length && y < p.y + PD.t.length && PD.t[y - p.y][x - p.x] !== '.';
        if (!inside) return true;
        PD.t.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') setT(p.x + i, p.y + j, 0, true); }));
        return false;
      });
    }
    function setT(x, y, v, raw) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      if (!raw && (def.t[y * W + x] === 12 || def.ponds.length)) dropPondAt(x, y);
      def.t[y * W + x] = v; pending.set(y * W + x, v);
    }
    function paintAt(x, y) {
      const b = brush, o = (b - 1) >> 1;
      for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) setT(x - o + i, y - o + j, tool.v);
    }
    function placePond(cx, cy) {
      const PD = P.POND[tool.v], tw = PD.t[0].length, th = PD.t.length, x0 = Math.max(1, Math.min(W - 1 - tw, cx - (tw >> 1))), y0 = Math.max(1, Math.min(H - 1 - th, cy - (th >> 1)));
      PD.t.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') dropPondAt(x0 + i, y0 + j); }));
      PD.t.forEach((row, j) => [...row].forEach((c, i) => { if (c === 'W') setT(x0 + i, y0 + j, 4, true); else if (c === 'r') setT(x0 + i, y0 + j, 12, true); }));
      def.ponds.push({ k: tool.v, x: x0, y: y0 });
    }
    function fillAt(x, y) {
      const from = at(x, y); if (from === tool.v || from === 12) return;
      const q = [[x, y]], seen = new Set([y * W + x]);
      while (q.length) {
        const [a, b] = q.pop(); setT(a, b, tool.v, true);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = a + dx, ny = b + dy, k = ny * W + nx; if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen.has(k) && at(nx, ny) === from) { seen.add(k); q.push([nx, ny]); } });
      }
    }
    function setExit(k, on, to) {
      push(); def.exits = def.exits || {};
      if (on) {
        def.exits[k] = to || '';
        const mx = W >> 1, my = H >> 1;   // 가장자리 가운데 6칸을 길로 뚫음 (안쪽 1칸까지)
        for (let d = -3; d <= 2; d++) {
          if (k === 'u') { setT(mx + d, 0, 1); setT(mx + d, 1, 1); } if (k === 'd') { setT(mx + d, H - 1, 1); setT(mx + d, H - 2, 1); }
          if (k === 'l') { setT(0, my + d, 1); setT(1, my + d, 1); } if (k === 'r') { setT(W - 1, my + d, 1); setT(W - 2, my + d, 1); }
        }
      } else delete def.exits[k];
      syncBtns(); schedule(); saveDraft();
    }

    // ---------- 마우스·손가락 ----------
    const cellOf = e => { const r = over.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * W), Math.floor((e.clientY - r.top) / r.height * H)]; };
    let down = false;
    over.addEventListener('pointerdown', e => {
      e.preventDefault(); over.setPointerCapture(e.pointerId); const [x, y] = cellOf(e); if (at(x, y) < 0) return;
      push(); down = true;
      if (tool.kind === 'pond') { placePond(x, y); down = false; finish(); return; }
      if (mode === 'fill') { fillAt(x, y); down = false; finish(); return; }
      if (mode === 'rect') { rectA = rectB = [x, y]; drawOver(); return; }
      paintAt(x, y); drawOver();
    });
    over.addEventListener('pointermove', e => {
      const [x, y] = cellOf(e); hover = at(x, y) < 0 ? null : [x, y];
      if (hover) info.textContent = `칸 (${x}, ${y}) · ${tileName(at(x, y))}`;
      if (down && hover) { if (mode === 'rect') rectB = [x, y]; else if (tool.kind === 'tile') paintAt(x, y); }
      drawOver();
    });
    over.addEventListener('pointerleave', () => { hover = null; drawOver(); });
    const up = () => {
      if (!down) return; down = false;
      if (mode === 'rect' && rectA && rectB && tool.kind === 'tile') { const x0 = Math.min(rectA[0], rectB[0]), y0 = Math.min(rectA[1], rectB[1]), x1 = Math.max(rectA[0], rectB[0]), y1 = Math.max(rectA[1], rectB[1]); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setT(x, y, tool.v); }
      rectA = rectB = null; finish();
    };
    over.addEventListener('pointerup', up); over.addEventListener('pointercancel', up);
    function finish() { drawOver(); schedule(); saveDraft(); }
    const onKey = e => {
      if (!(e.ctrlKey || e.metaKey) || /INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); if (undo.length) { redo.push(snap()); restore(undo.pop()); } }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); if (redo.length) { undo.push(snap()); restore(redo.pop()); } }
    };
    document.addEventListener('keydown', onKey);

    // ---------- 단추 ----------
    $$('[data-tile]', root).forEach(b => b.addEventListener('click', () => { tool = { kind: 'tile', v: +b.dataset.tile }; syncBtns(); }));
    $$('[data-pond]', root).forEach(b => b.addEventListener('click', () => { tool = { kind: 'pond', v: b.dataset.pond }; P.img79(b.dataset.pond); syncBtns(); }));
    $$('[data-mode]', root).forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; if (tool.kind === 'pond') tool = { kind: 'tile', v: 0 }; syncBtns(); }));
    $$('[data-brush]', root).forEach(b => b.addEventListener('click', () => { brush = +b.dataset.brush; syncBtns(); }));
    $$('[data-zoom]', root).forEach(b => b.addEventListener('click', () => setZoom(+b.dataset.zoom)));
    $('#meGrid', root).addEventListener('change', e => { grid = e.target.checked; drawOver(); });
    $('#meRegion', root).addEventListener('change', e => { def.region = +e.target.value; schedule(); saveDraft(); });
    ['#meName', '#meId'].forEach(s => $(s, root).addEventListener('input', saveDraft));
    EXITS.forEach(([k]) => {
      $(`[data-exit="${k}"]`, root).addEventListener('change', e => setExit(k, e.target.checked, $(`[data-exitto="${k}"]`, root).value.trim()));
      $(`[data-exitto="${k}"]`, root).addEventListener('input', e => { if (def.exits && k in def.exits) { def.exits[k] = e.target.value.trim(); drawOver(); saveDraft(); } });
    });
    const idOk = id => /^[a-z0-9_-]{2,40}$/.test(id);
    const list = $('#meList', root);
    async function showList() {
      list.hidden = false; list.innerHTML = '<p class="empty">불러오는 중…</p>';
      try {
        const rows = await Hub.mapList(); if (!alive) return;
        list.innerHTML = rows.length ? `<h3>저장된 맵</h3><ul>${rows.map(r => `<li><button type="button" class="btn" data-load="${ui.esc(r.id)}"><b>${ui.esc(r.name || r.id)}</b> <span>${ui.esc(r.id)}</span></button> <button type="button" class="btn btn-mini" data-del="${ui.esc(r.id)}">지우기</button></li>`).join('')}</ul><button type="button" class="btn" data-act="close">닫기</button>` : '<p class="empty">아직 저장된 맵이 없어요.</p><button type="button" class="btn" data-act="close">닫기</button>';
      } catch (e) { list.innerHTML = `<p class="err">${ui.esc(e.message)}</p><button type="button" class="btn" data-act="close">닫기</button>`; }
    }
    list.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'close') { list.hidden = true; return; }
      if (b.dataset.load) {
        try { const r = await Hub.mapGet(b.dataset.load); if (!r) return ui.toast('맵을 찾지 못했어요'); push(); def = Object.assign(blank(0), r.data); def.exits = def.exits || {}; $('#meId', root).value = r.id; $('#meName', root).value = r.name || ''; $('#meRegion', root).value = def.region; syncBtns(); schedule(); saveDraft(); list.hidden = true; ui.toast('불러왔어요: ' + (r.name || r.id)); } catch (er) { ui.toast(er.message); }
      }
      if (b.dataset.del) { if (!confirm(`'${b.dataset.del}' 맵을 지울까요? 되돌릴 수 없어요.`)) return; try { await Hub.mapDelete(b.dataset.del); ui.toast('지웠어요'); showList(); } catch (er) { ui.toast(er.message); } }
    });
    root.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b || b.closest('#meList')) return;
      const a = b.dataset.act;
      if (a === 'undo') { if (undo.length) { redo.push(snap()); restore(undo.pop()); } }
      if (a === 'redo') { if (redo.length) { undo.push(snap()); restore(redo.pop()); } }
      if (a === 'new') { if (!confirm('지금 그림을 지우고 새 맵을 시작할까요? (저장 안 한 것은 사라져요)')) return; push(); def = blank(+$('#meRegion', root).value); $('#meId', root).value = ''; $('#meName', root).value = ''; syncBtns(); schedule(); saveDraft(); }
      if (a === 'list') showList();
      if (a === 'save') {
        const id = $('#meId', root).value.trim(), name = $('#meName', root).value.trim();
        if (!idOk(id)) return ui.toast('맵 아이디는 영문 소문자·숫자·_·- 로 2~40자예요. (예: hidden1)');
        if (/^(f\d+|v\d+|h\d+-\d+)$/.test(id) && !confirm(`'${id}' 는 지금 게임에 있는 맵 이름이에요. 그래도 이 이름으로 저장할까요? (나중에 게임에 연결하면 그 맵 대신 이 그림이 나와요)`)) return;
        try { await Hub.mapSave(id, name || id, def); ui.toast('저장했어요: ' + (name || id)); } catch (er) { ui.toast(er.message); }
      }
      if (a === 'export') {
        const id = $('#meId', root).value.trim() || 'map', blob = new Blob([JSON.stringify({ id, name: $('#meName', root).value.trim(), data: def })], { type: 'application/json' });
        const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'rpg_map_' + id + '.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
      }
    });
    $('#meImport', root).addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try { const o = JSON.parse(await f.text()), d = o.data || o; if (!d.t || d.t.length !== W * H) throw new Error('50×34 맵 파일이 아니에요'); push(); def = Object.assign(blank(0), d); def.exits = def.exits || {}; $('#meId', root).value = o.id || ''; $('#meName', root).value = o.name || ''; $('#meRegion', root).value = def.region; syncBtns(); schedule(); saveDraft(); ui.toast('가져왔어요'); }
      catch (er) { ui.toast('파일을 읽지 못했어요: ' + er.message); }
      e.target.value = '';
    });

    setZoom(zoom); syncBtns(); fullRender();
    return () => { alive = false; clearTimeout(rTimer); document.removeEventListener('keydown', onKey); };
  }
  window.GoMapEdit = { render };
})();
