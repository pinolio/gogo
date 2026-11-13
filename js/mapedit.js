/*
 * gogo?gogo! — 메이커 · Skillcom RPG 지도 그리기 (v125)
 *  - #maker  : 메이커 메뉴 (누구나) — 지도 그리기 들어가기 · 내 지도 목록
 *  - #mapedit: 지도 그리기 (누구나 그림 · 로그인하면 저장·수정·제출) — 관리자는 공식 맵(rpg_maps)으로 저장·반영도
 *  - #mapadmin: 관리자 'Skillcom RPG 맵 관리' — 플레이어가 제출한 지도 목록 · 누르면 옆에 지도 · 편집기에서 고쳐 반영 · 돌려보내기
 *  - 50 × 34 칸(한 칸 32px) · 게임과 같은 그림 (games/action/rpg/world.js 의 previewMap · drawMapObj)
 *  - 저장: 플레이어 지도 = rpg_map_drafts (supabase/rpg_map_drafts_v125.sql) · 공식 맵 = rpg_maps (supabase/rpg_maps_v124.sql)
 *  칸 번호: 0 풀 · 1 길 · 2 나무 · 3 바위 · 4 물 · 5 꽃 · 12 연못 물가(연못 그림 테두리, 지나갈 수 있음)
 */
(function () {
  'use strict';
  const Hub = window.GameHub;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const W = 50, H = 34, TS = 32, DRAFT = 'gogo_mapedit_draft', OPEN = 'gogo_mapedit_open';
  const STATUS = { draft: ['작성 중', 'st-draft'], submitted: ['제출함', 'st-sub'], returned: ['돌려받음', 'st-ret'], accepted: ['반영됨', 'st-ok'] };
  const stBadge = (st, esc) => { const s = STATUS[st] || [st, '']; return `<span class="me-st ${s[1]}">${esc(s[0])}</span>`; };
  /* v126 내 지도 목록: '작성 중인 지도'(작성 중·돌려받음) · '제출한 지도'(제출함·반영됨) — 제출한 지도는 회수(다시 작성 중)·지우기 가능, 반영된 지도는 잠김
   *  p = 단추 data 앞글자 ('d' 편집기 · 'k' 메이커): data-<p>load 열기 · data-<p>del 지우기 · data-<p>back 회수 */
  function myListHtml(rows, esc, p) {
    const li = r => `<li><b>${esc(r.title || '이름 없음')}</b> ${stBadge(r.status, esc)} <span class="mk-date">${esc(((r.submitted_at || r.updated_at) || '').slice(0, 10))}</span>${r.admin_note ? `<span class="me-note">관리자: ${esc(r.admin_note)}</span>` : ''}
      <span class="mk-acts"><button type="button" class="btn btn-mini" data-${p}load="${r.id}">열기</button>${r.status === 'submitted' ? `<button type="button" class="btn btn-mini" data-${p}back="${r.id}">↩ 회수</button>` : ''}${r.status !== 'accepted' ? `<button type="button" class="btn btn-mini" data-${p}del="${r.id}">지우기</button>` : ''}</span></li>`;
    const work = rows.filter(r => r.status === 'draft' || r.status === 'returned'), sent = rows.filter(r => r.status === 'submitted' || r.status === 'accepted');
    return `<h4 class="mk-sec">✏ 작성 중인 지도 (${work.length})</h4>${work.length ? `<ul class="mk-list">${work.map(li).join('')}</ul>` : '<p class="empty">없어요.</p>'}
      <h4 class="mk-sec">📮 제출한 지도 (${sent.length})</h4><p class="mk-help">마음에 안 들면 <b>↩ 회수</b>해서 다시 고치거나 <b>지우기</b>를 눌러요. 반영된 지도는 이미 게임에 들어가 바꿀 수 없어요.</p>${sent.length ? `<ul class="mk-list">${sent.map(li).join('')}</ul>` : '<p class="empty">없어요.</p>'}`;
  }
  const TILES = [
    { k: 0, n: '풀(바닥)', ic: '🌱', col: '#6DB85C' }, { k: 1, n: '길', ic: '🟫', col: '#C9A26A' },
    { k: 2, n: '나무', ic: '🌳', col: '#2E6E30' }, { k: 3, n: '바위', ic: '🪨', col: '#8A8A96' },
    { k: 4, n: '물', ic: '💧', col: '#4FA8E8' }, { k: 5, n: '꽃', ic: '🌼', col: '#FFD23F' }
  ];
  const PONDS = [['pond_s', '작은 연못'], ['pond_m', '중간 연못'], ['pond_l', '큰 연못']];
  const EXITS = [['u', '위'], ['d', '아래'], ['l', '왼쪽'], ['r', '오른쪽']];
  const DGS = [['dg_cave', '동굴 입구'], ['dg_ruin', '돌문 유적']];   // v128 던전 입구
  const tileName = v => (TILES.find(x => x.k === v) || { n: v === 12 ? '연못 물가·둘레' : v === 10 ? '던전 입구(막힘)' : v === 13 ? '던전 입구 문' : '?' }).n;

  function blank(region) {
    const t = new Array(W * H).fill(0);
    for (let x = 0; x < W; x++) { t[x] = 2; t[(H - 1) * W + x] = 2; }
    for (let y = 0; y < H; y++) { t[y * W] = 2; t[y * W + W - 1] = 2; }
    return { w: W, h: H, region: region || 0, t, ponds: [], dungeons: [], exits: {} };
  }

  /* ---------- v130 샘플 지도 (메이커 · 지도 그리기) ----------
   *  f: 게임 사냥터 아이디 (data.js MAPS) → 그 사냥터 칸·연못을 그대로 복사 (지역마다 가운데쯤 사냥터 1곳)
   *  f 가 없으면 cross = 위·아래·왼쪽·오른쪽 길이 만나는 빈 풀밭 (처음부터 그리기 좋게) */
  let SAMPLES_ = null;
  const samples = () => SAMPLES_ || (SAMPLES_ = (() => {
    const D = window.GoRPGData; if (!D) return [];
    const out = D.REGIONS.map((R, ri) => {
      const fs = D.MAPS.filter(m => m.kind === 'field' && !m.hell && m.region === ri), m = fs[Math.min(4, fs.length - 1)];
      return m ? { f: m.id, name: m.name, sub: R.name + ' 사냥터 · Lv.' + m.rec } : null;
    }).filter(Boolean);
    out.push({ cross: true, region: 0, name: '십자 길 기본 지도', sub: '네 방향 출구 · 빈 풀밭' });
    return out.slice(0, 10);
  })());
  const sampleC = {};
  function sampleDef(i) {
    const q = samples()[i]; if (!q) throw new Error('없는 샘플');
    if (!sampleC[i]) {
      if (q.cross) {
        const d = blank(q.region), mx = W >> 1, my = H >> 1;
        for (let x = 0; x < W; x++) for (let k = -1; k <= 1; k++) d.t[(my + k) * W + x] = 1;
        for (let y = 0; y < H; y++) for (let k = -1; k <= 1; k++) d.t[y * W + mx + k] = 1;
        d.exits = { u: '', d: '', l: '', r: '' }; sampleC[i] = d;
      } else {
        const P = window.__GoRPGParts, m = P.getMap(q.f), M = m.M, keep = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 12: 1 };
        const t = Array.from(m.t, v => (keep[v] ? v : 0));
        const ex = {}; if (M.prev) ex.l = ''; if (M.next) ex.r = '';   // 출구 자리만 (갈 곳은 비워 둠)
        sampleC[i] = { w: W, h: H, region: M.region, t, ponds: (m.ponds || []).map(p => ({ k: p.k, x: p.x, y: p.y })), dungeons: [], exits: ex };
      }
    }
    return JSON.parse(JSON.stringify(sampleC[i]));
  }

  function render(root, ui) {
    const admin = Hub.isAdmin();
    const P = window.__GoRPGParts, D = window.GoRPGData;
    if (!P || !P.previewMap) { root.innerHTML = '<div class="panel"><p class="err">RPG 그림 도구를 불러오지 못했어요. 새로고침해 주세요.</p></div>'; return () => {}; }
    let alive = true;
    // 지금 맵 · 이름 · 도구
    // draftId·draftSt = 플레이어 지도(rpg_map_drafts) · review = 관리자가 고치는 제출 지도 { id, nick }
    let def = null, mapId = '', mapName = '', draftId = null, draftSt = null, review = null;
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (d && d.def && d.def.t && d.def.t.length === W * H) { def = d.def; mapId = d.id || ''; mapName = d.name || ''; draftId = d.draftId || null; draftSt = d.draftSt || null; review = admin ? d.review || null : null; } } catch (e) { /* noop */ }
    if (!def) def = blank(0);
    let openReq = null; try { openReq = JSON.parse(sessionStorage.getItem(OPEN) || 'null'); sessionStorage.removeItem(OPEN); } catch (e) { /* noop */ }
    let tool = { kind: 'tile', v: 0 }, brush = 1, mode = 'paint', zoom = 0.75, grid = true;
    const undo = [], redo = [];
    const regions = D.REGIONS.map((r, i) => [i, r.name]);
    // v134 몬스터 고르기: 게임 사냥터의 몬스터를 빌려 씀 (값 = 사냥터 아이디) · 보스 칸은 보스 사냥터를 먼저
    const monOpts = bossFirst => D.REGIONS.map((R, ri) => {
      const fs = D.MAPS.filter(m => m.kind === 'field' && !m.hell && m.region === ri && m.mon).sort((a, b) => bossFirst ? (b.boss - a.boss) || a.no - b.no : a.no - b.no);
      return `<optgroup label="${ui.esc(R.name)}">${fs.map(m => `<option value="${m.id}">${ui.esc(m.mon.name)}${m.boss ? ' 👑' : ''} · ${m.no}번 사냥터 Lv.${m.rec}</option>`).join('')}</optgroup>`;
    }).join('');

    root.innerHTML = `
      <div class="mapedit">
        <div class="page-head"><h1>🗺 Skillcom RPG 지도 그리기</h1><p>왼쪽에서 고른 것을 지도에 끌어서 칠해요. 게임과 같은 그림으로 바로 보여요. 로그인하면 저장해 두고 고칠 수 있고, 다 되면 <b>제출</b>을 눌러 관리자에게 보내요. <a href="#maker">← 메이커</a></p></div>
        <div class="me-bar panel">
          <label>지도 이름 <input id="meName" type="text" maxlength="30" placeholder="예: 숨은 던전" value="${ui.esc(mapName)}"></label>
          <label>지역 그림 <select id="meRegion">${regions.map(([i, n]) => `<option value="${i}" ${+def.region === i ? 'selected' : ''}>${ui.esc(n)}</option>`).join('')}</select></label>
          <div class="me-btns">
            <button type="button" class="btn" data-act="new">새 지도</button>
            <button type="button" class="btn" data-act="mine">내 지도</button>
            <button type="button" class="btn btn-sun" data-act="save">저장</button>
            <button type="button" class="btn btn-primary" data-act="submit">📮 제출</button>
            <button type="button" class="btn" data-act="export">파일로 내보내기</button>
            <label class="btn me-file">파일 가져오기<input type="file" id="meImport" accept=".json,application/json" hidden></label>
            <button type="button" class="btn btn-sky" data-act="samples">🗺 샘플 지도 불러오기</button>
          </div>
          <p class="me-status" id="meStatus"></p>
          ${admin ? `<div class="me-admin">
            <b>관리자</b>
            <label>공식 맵 아이디 <input id="meId" type="text" maxlength="40" placeholder="예: hidden1 (영문 소문자·숫자)" value="${ui.esc(mapId)}"></label>
            <button type="button" class="btn" data-act="list">공식 맵 불러오기</button>
            <button type="button" class="btn btn-sun" data-act="official">✅ 공식 맵으로 저장·반영</button>
            <button type="button" class="btn" data-act="return" id="meReturn">↩ 돌려보내기</button>
            <label class="me-chk"><input type="checkbox" id="mePub"> 🌏 공개 (끄면 관리자만 들어가 시험)</label>
            <a class="btn" href="#mapadmin">맵 관리로</a>
          </div>` : ''}
        </div>
        <div id="meList" class="me-list panel" hidden></div>
        <div class="me-main">
          <aside class="me-side panel">
            <h3>그리기</h3>
            <div class="me-pal">${TILES.map(x => `<button type="button" data-tile="${x.k}"><span class="sw" style="background:${x.col}">${x.ic}</span>${x.n}</button>`).join('')}</div>
            <h3>연못 (한 번 누르면 놓임)</h3>
            <div class="me-pal me-ponds">${PONDS.map(([k, n]) => `<button type="button" data-pond="${k}"><img src="games/action/rpg/img/v79/${k}.png" alt="">${n}</button>`).join('')}</div>
            <h3>던전 입구 (한 번 누르면 놓임)</h3>
            <div class="me-pal me-ponds">${DGS.map(([k, n]) => `<button type="button" data-dg="${k}"><img src="games/action/rpg/img/v79/${k}.png" alt="">${n}</button>`).join('')}</div>
            <h3>도구</h3>
            <div class="me-seg" data-g="mode"><button type="button" data-mode="paint">🖌 붓</button><button type="button" data-mode="rect">▭ 네모</button><button type="button" data-mode="fill">🪣 채우기</button></div>
            <div class="me-seg" data-g="brush">붓 크기 <button type="button" data-brush="1">1</button><button type="button" data-brush="2">2</button><button type="button" data-brush="3">3</button></div>
            <div class="me-seg"><button type="button" data-act="undo">↶ 되돌리기</button><button type="button" data-act="redo">↷ 다시</button></div>
            <div class="me-seg" data-g="zoom">보기 <button type="button" data-zoom="0.5">작게</button><button type="button" data-zoom="0.75">보통</button><button type="button" data-zoom="1">크게</button></div>
            <label class="me-chk"><input type="checkbox" id="meGrid" checked> 칸 줄 보기</label>
            <h3>출구 (켜면 가장자리에 길이 뚫려요)</h3>
            <div class="me-exits">${EXITS.map(([k, n]) => `<label><input type="checkbox" data-exit="${k}"> ${n} → <input type="text" data-exitto="${k}" placeholder="갈 맵 (예: f2)" maxlength="40"></label>`).join('')}</div>
            <p class="me-hint">갈 맵: 마을 v1~v9 · 사냥터 f1~f90 · 다른 공식 맵 아이디. 게임에서는 갈 맵 쪽에도 돌아오는 길이 저절로 생겨요 (마을은 한쪽으로만).</p>
            <h3>던전 통로 (던전 입구 → 갈 곳)</h3>
            <div class="me-exits" id="meDgList"></div>
            <h3>몬스터 (게임에서 나올 몬스터)</h3>
            <div class="me-mons">
              <label>몬스터 <select data-mon="mob"><option value="">없음 (안 나옴)</option>${monOpts()}</select></label>
              <label>섞일 몬스터 <select data-mon="mob2"><option value="">없음</option>${monOpts()}</select></label>
              <label>보스 <select data-mon="boss"><option value="">없음</option>${monOpts(true)}</select></label>
              <div class="me-mrow"><label>레벨 <input type="number" data-mon="lv" min="1" max="${D.MAX_LV}" placeholder="자동"></label><label>마릿수 <input type="number" data-mon="n" min="0" max="30" placeholder="18"></label></div>
            </div>
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
      (def.dungeons || []).forEach((d, i) => {   // v128 던전 통로 표시
        const DG = P.DUNGEON[d.k]; if (!DG) return; const cx = d.x * TS + DG.w / 2, label = '⛩ ' + (i + 1) + ' → ' + (d.to || '?');
        ox.font = 'bold 18px "Jua", sans-serif'; ox.fillStyle = '#FFD23F'; ox.strokeStyle = '#1D2340'; ox.lineWidth = 4; ox.strokeText(label, cx, d.y * TS - 8); ox.fillText(label, cx, d.y * TS - 8);
      });
      if (rectA && rectB) { const x0 = Math.min(rectA[0], rectB[0]), y0 = Math.min(rectA[1], rectB[1]), x1 = Math.max(rectA[0], rectB[0]), y1 = Math.max(rectA[1], rectB[1]); ox.strokeStyle = '#FFD23F'; ox.lineWidth = 3; ox.strokeRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS); }
      if (hover) {
        if (tool.kind === 'dg') { const DG = P.DUNGEON[tool.v], tw = DG.t[0].length, th = DG.t.length, x0 = hover[0] - (tw >> 1), y0 = hover[1] - th + 1; const im = P.img79(tool.v); ox.globalAlpha = 0.75; if (im) ox.drawImage(im, x0 * TS, y0 * TS); ox.globalAlpha = 1; ox.strokeStyle = '#FFD23F'; ox.lineWidth = 2; ox.strokeRect(x0 * TS, y0 * TS, tw * TS, th * TS); }
        else if (tool.kind === 'pond') { const PD = P.POND[tool.v], tw = PD.t[0].length, th = PD.t.length, x0 = hover[0] - (tw >> 1), y0 = hover[1] - (th >> 1); const im = P.img79(tool.v); ox.globalAlpha = 0.7; if (im) ox.drawImage(im, x0 * TS, y0 * TS); ox.globalAlpha = 1; ox.strokeStyle = '#FFD23F'; ox.lineWidth = 2; ox.strokeRect(x0 * TS, y0 * TS, tw * TS, th * TS); }
        else { const b = mode === 'paint' ? brush : 1, o = (b - 1) >> 1; ox.strokeStyle = '#FFFFFF'; ox.lineWidth = 2; ox.strokeRect((hover[0] - o) * TS + 1, (hover[1] - o) * TS + 1, b * TS - 2, b * TS - 2); }
      }
    }
    function setZoom(z) { zoom = z; wrap.style.width = W * TS * z + 'px'; wrap.style.height = H * TS * z + 'px'; syncBtns(); }
    function syncBtns() {
      $$('[data-tile]', root).forEach(b => b.setAttribute('aria-pressed', String(tool.kind === 'tile' && +b.dataset.tile === tool.v)));
      $$('[data-pond]', root).forEach(b => b.setAttribute('aria-pressed', String(tool.kind === 'pond' && b.dataset.pond === tool.v)));
      $$('[data-dg]', root).forEach(b => b.setAttribute('aria-pressed', String(tool.kind === 'dg' && b.dataset.dg === tool.v)));
      dgList();
      $$('[data-mode]', root).forEach(b => b.setAttribute('aria-pressed', String(mode === b.dataset.mode)));
      $$('[data-brush]', root).forEach(b => b.setAttribute('aria-pressed', String(brush === +b.dataset.brush)));
      $$('[data-zoom]', root).forEach(b => b.setAttribute('aria-pressed', String(zoom === +b.dataset.zoom)));
      const mo = def.mons || {}; $$('[data-mon]', root).forEach(el => { const v = mo[el.dataset.mon]; el.value = v == null ? '' : v; });
      const pb = $('#mePub', root); if (pb) pb.checked = !!def.pub;
      EXITS.forEach(([k]) => { const c = $(`[data-exit="${k}"]`, root), t = $(`[data-exitto="${k}"]`, root); c.checked = !!(def.exits && k in def.exits); t.value = (def.exits && def.exits[k]) || ''; t.disabled = !c.checked; });
    }

    // ---------- 고치기 ----------
    const snap = () => JSON.stringify({ t: def.t, ponds: def.ponds, dungeons: def.dungeons || [], exits: def.exits });
    function push() { undo.push(snap()); if (undo.length > 60) undo.shift(); redo.length = 0; }
    function restore(sn) { const o = JSON.parse(sn); def.t = o.t; def.ponds = o.ponds; def.dungeons = o.dungeons || []; def.exits = o.exits || {}; syncBtns(); schedule(); saveDraft(); }
    const idEl = () => $('#meId', root);
    function saveDraft() { try { localStorage.setItem(DRAFT, JSON.stringify({ def, id: idEl() ? idEl().value.trim() : mapId, name: $('#meName', root).value.trim(), draftId, draftSt, review })); } catch (e) { /* noop */ } }
    function showStatus() {
      const el = $('#meStatus', root); if (!el) return;
      const parts = [];
      if (review) parts.push(`관리자 검토 중: <b>${ui.esc(review.nick || '')}</b> 님의 지도 #${review.id}`);
      else if (draftId) parts.push(`내 지도 #${draftId} · ${stBadge(draftSt || 'draft', ui.esc)}${draftSt === 'submitted' ? ' — 관리자에게 제출한 지도예요. 고치려면 <button type="button" class="btn btn-mini" data-act="withdraw">↩ 회수</button> 를 눌러 다시 작성 중으로 바꿔요.' : draftSt === 'accepted' ? ' — 게임에 반영된 지도예요. 고쳐서 저장하면 새 지도로 저장돼요.' : ''}`);
      else parts.push(Hub.user ? '아직 저장하지 않은 새 지도예요.' : '로그인하면 지도를 저장하고 제출할 수 있어요.');
      el.innerHTML = parts.join(' ');
      const rb = $('#meReturn', root); if (rb) rb.hidden = !review;
    }
    // 연못이 있던 칸을 건드리면 그 연못 전체를 없앰 (물·물가 칸 → 풀)
    function dropPondAt(x, y) {
      def.ponds = def.ponds.filter(p => {
        const PD = P.POND[p.k], inside = x >= p.x && y >= p.y && x < p.x + PD.t[0].length && y < p.y + PD.t.length && PD.t[y - p.y][x - p.x] !== '.';
        if (!inside) return true;
        PD.t.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') setT(p.x + i, p.y + j, 0, true); }));
        return false;
      });
    }
    // v128 던전 입구가 있던 칸을 건드리면 그 입구 전체를 없앰 (칸 → 풀)
    function dropDgAt(x, y) {
      def.dungeons = (def.dungeons || []).filter(d => {
        const DG = P.DUNGEON[d.k], inside = DG && x >= d.x && y >= d.y && x < d.x + DG.t[0].length && y < d.y + DG.t.length && DG.t[y - d.y][x - d.x] !== '.';
        if (!inside) return true;
        DG.t.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') setT(d.x + i, d.y + j, 0, true); }));
        return false;
      });
    }
    function setT(x, y, v, raw) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      if (!raw && (def.t[y * W + x] === 12 || def.ponds.length)) dropPondAt(x, y);
      if (!raw && (def.dungeons || []).length) dropDgAt(x, y);
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
    function placeDg(cx, cy) {
      const DG = P.DUNGEON[tool.v], tw = DG.t[0].length, th = DG.t.length, x0 = Math.max(1, Math.min(W - 1 - tw, cx - (tw >> 1))), y0 = Math.max(1, Math.min(H - 1 - th, cy - th + 1));
      DG.t.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') { dropPondAt(x0 + i, y0 + j); dropDgAt(x0 + i, y0 + j); } }));
      DG.t.forEach((row, j) => [...row].forEach((c, i) => { if (c === 'X') setT(x0 + i, y0 + j, 10, true); else if (c === 'D') setT(x0 + i, y0 + j, 13, true); else if (c === 'r') setT(x0 + i, y0 + j, 12, true); }));
      // 문 앞 한 칸은 풀로 (막히지 않게)
      DG.t[th - 1].split('').forEach((c, i) => { if (c === 'D' && y0 + th < H - 1 && [2, 3, 4, 10].includes(at(x0 + i, y0 + th))) setT(x0 + i, y0 + th, 0, true); });
      def.dungeons = def.dungeons || []; def.dungeons.push({ k: tool.v, x: x0, y: y0, to: '' });
    }
    // 던전 통로 목록 (입구마다 갈 곳 메모)
    function dgList() {
      const box = $('#meDgList', root); if (!box) return;
      const L = def.dungeons || [];
      box.innerHTML = L.length ? L.map((d, i) => `<label>⛩ ${i + 1}. ${ui.esc((DGS.find(x => x[0] === d.k) || [0, ''])[1])} → <input type="text" data-dgto="${i}" placeholder="갈 맵 (예: dungeon1)" maxlength="40" value="${ui.esc(d.to || '')}"></label>`).join('') : '<p class="me-hint">위에서 던전 입구를 지도에 놓으면 여기서 갈 곳을 적을 수 있어요.</p>';
      $$('[data-dgto]', box).forEach(inp => inp.addEventListener('input', () => { const d = def.dungeons[+inp.dataset.dgto]; if (d) { d.to = inp.value.trim(); drawOver(); saveDraft(); } }));
    }
    function fillAt(x, y) {
      const from = at(x, y); if (from === tool.v || from === 12 || from === 10 || from === 13) return;
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
      if (tool.kind === 'dg') { placeDg(x, y); down = false; dgList(); finish(); return; }
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
    function finish() { dgList(); drawOver(); schedule(); saveDraft(); }
    const onKey = e => {
      if (!(e.ctrlKey || e.metaKey) || /INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); if (undo.length) { redo.push(snap()); restore(undo.pop()); } }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); if (redo.length) { undo.push(snap()); restore(redo.pop()); } }
    };
    document.addEventListener('keydown', onKey);

    // ---------- 단추 ----------
    $$('[data-tile]', root).forEach(b => b.addEventListener('click', () => { tool = { kind: 'tile', v: +b.dataset.tile }; syncBtns(); }));
    $$('[data-pond]', root).forEach(b => b.addEventListener('click', () => { tool = { kind: 'pond', v: b.dataset.pond }; P.img79(b.dataset.pond); syncBtns(); }));
    $$('[data-dg]', root).forEach(b => b.addEventListener('click', () => { tool = { kind: 'dg', v: b.dataset.dg }; P.img79(b.dataset.dg); syncBtns(); }));
    $$('[data-mode]', root).forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; if (tool.kind === 'pond' || tool.kind === 'dg') tool = { kind: 'tile', v: 0 }; syncBtns(); }));
    $$('[data-brush]', root).forEach(b => b.addEventListener('click', () => { brush = +b.dataset.brush; syncBtns(); }));
    $$('[data-zoom]', root).forEach(b => b.addEventListener('click', () => setZoom(+b.dataset.zoom)));
    $('#meGrid', root).addEventListener('change', e => { grid = e.target.checked; drawOver(); });
    $('#meRegion', root).addEventListener('change', e => { def.region = +e.target.value; schedule(); saveDraft(); });
    ['#meName', '#meId'].forEach(s => { const el = $(s, root); if (el) el.addEventListener('input', saveDraft); });
    EXITS.forEach(([k]) => {
      $(`[data-exit="${k}"]`, root).addEventListener('change', e => setExit(k, e.target.checked, $(`[data-exitto="${k}"]`, root).value.trim()));
      $(`[data-exitto="${k}"]`, root).addEventListener('input', e => { if (def.exits && k in def.exits) { def.exits[k] = e.target.value.trim(); drawOver(); saveDraft(); } });
    });
    const idOk = id => /^[a-z0-9_-]{2,40}$/.test(id);
    // v134 몬스터 · 공개
    $$('[data-mon]', root).forEach(el => el.addEventListener('change', () => {
      const mo = def.mons = Object.assign({}, def.mons || {}), k = el.dataset.mon, v = el.value.trim();
      if (k === 'lv' || k === 'n') { if (v === '') delete mo[k]; else mo[k] = Math.max(k === 'n' ? 0 : 1, Math.min(k === 'n' ? 30 : D.MAX_LV, Math.floor(+v || 0))); }
      else if (v) mo[k] = v; else delete mo[k];
      if (k === 'mob' && v && mo.lv == null) { const F = D.MAPS.find(m => m.id === v); if (F) mo.lv = F.rec; }
      syncBtns(); saveDraft();
    }));
    const pubEl = $('#mePub', root); if (pubEl) pubEl.addEventListener('change', () => { def.pub = pubEl.checked; saveDraft(); });
    const list = $('#meList', root);
    async function showMine() {
      if (!Hub.user) { ui.toast('로그인하면 내 지도를 볼 수 있어요'); if (ui.openAuth) ui.openAuth('login'); return; }
      list.hidden = false; list.innerHTML = '<p class="empty">불러오는 중…</p>';
      try {
        const rows = await Hub.myMaps(); if (!alive) return;
        list.innerHTML = (rows.length ? `<h3>내 지도 (${rows.length}/20)</h3>` + myListHtml(rows, ui.esc, 'd') : '<p class="empty">아직 저장한 지도가 없어요. 그린 뒤 <b>저장</b>을 눌러 보세요.</p>') + '<button type="button" class="btn" data-act="close">닫기</button>';
      } catch (e) { list.innerHTML = `<p class="err">${ui.esc(e.message)}</p><button type="button" class="btn" data-act="close">닫기</button>`; }
    }
    async function loadDraft(id, asReview) {
      const r = await Hub.draftGet(id); if (!r) { ui.toast('지도를 찾지 못했어요'); return; }
      push(); def = Object.assign(blank(0), r.data); def.exits = def.exits || {};
      $('#meName', root).value = r.title || ''; $('#meRegion', root).value = def.region;
      if (asReview) { review = { id: r.id, nick: (r.profiles && r.profiles.nickname) || '' }; draftId = null; draftSt = null; if (idEl() && r.official_id) idEl().value = r.official_id; }
      else { review = null; draftId = r.id; draftSt = r.status; }
      syncBtns(); schedule(); saveDraft(); showStatus(); list.hidden = true;
    }
    async function showList() {
      list.hidden = false; list.innerHTML = '<p class="empty">불러오는 중…</p>';
      try {
        const rows = await Hub.mapList(); if (!alive) return;
        list.innerHTML = rows.length ? `<h3>저장된 맵</h3><ul>${rows.map(r => `<li><button type="button" class="btn" data-load="${ui.esc(r.id)}"><b>${ui.esc(r.name || r.id)}</b> <span>${ui.esc(r.id)}</span></button> <button type="button" class="btn btn-mini" data-del="${ui.esc(r.id)}">지우기</button></li>`).join('')}</ul><button type="button" class="btn" data-act="close">닫기</button>` : '<p class="empty">아직 저장된 맵이 없어요.</p><button type="button" class="btn" data-act="close">닫기</button>';
      } catch (e) { list.innerHTML = `<p class="err">${ui.esc(e.message)}</p><button type="button" class="btn" data-act="close">닫기</button>`; }
    }
    // v130 샘플 지도: 게임 사냥터를 그대로 가져와 고쳐 쓰기 (지역마다 1개 + 기본 십자길)
    function showSamples() {
      list.hidden = false;
      list.innerHTML = `<h3>🗺 샘플 지도 <small>(${samples().length}개)</small></h3><p class="mk-help">게임에 있는 사냥터를 그대로 가져와요. 고른 뒤 마음대로 고쳐서 <b>저장</b>하면 내 지도가 돼요. (지금 그리던 그림은 ↶ 되돌리기로 다시 볼 수 있어요)</p>
        <ul class="me-samples">${samples().map((q, i) => `<li><button type="button" data-sample="${i}"><canvas width="200" height="136"></canvas><b>${ui.esc(q.name)}</b><small>${ui.esc(q.sub)}</small></button></li>`).join('')}</ul><button type="button" class="btn" data-act="close">닫기</button>`;
      $$('[data-sample]', list).forEach((b, i) => setTimeout(() => { if (alive && b.isConnected) { try { drawPreview(b.querySelector('canvas'), sampleDef(i), 0.125); } catch (er) { console.warn('[mapedit] 샘플', er); } } }, 30 * i));
    }
    list.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'close') { list.hidden = true; return; }
      if (b.dataset.sample != null) {
        const i = +b.dataset.sample, q = samples()[i]; let d;
        try { d = sampleDef(i); } catch (er) { ui.toast('샘플을 만들지 못했어요: ' + er.message); return; }
        push(); def = d; if (idEl()) idEl().value = ''; $('#meName', root).value = (q.name + ' 고쳐 그리기').slice(0, 30); $('#meRegion', root).value = def.region;
        draftId = null; draftSt = null; review = null; syncBtns(); schedule(); saveDraft(); showStatus(); list.hidden = true;
        ui.toast('샘플을 불러왔어요: ' + q.name + ' — 고쳐서 저장하면 내 지도가 돼요'); return;
      }
      if (b.dataset.dload) { try { await loadDraft(+b.dataset.dload, false); ui.toast('불러왔어요'); } catch (er) { ui.toast(er.message); } return; }
      if (b.dataset.ddel) { if (!confirm('이 지도를 지울까요? 되돌릴 수 없어요.')) return; try { await Hub.draftDelete(+b.dataset.ddel); if (draftId === +b.dataset.ddel) { draftId = null; draftSt = null; saveDraft(); showStatus(); } ui.toast('지웠어요'); showMine(); } catch (er) { ui.toast(er.message); } return; }
      if (b.dataset.dback) { if (!confirm('제출을 회수할까요? 다시 작성 중으로 바뀌어 고칠 수 있어요.')) return; try { await Hub.draftWithdraw(+b.dataset.dback); if (draftId === +b.dataset.dback) { draftSt = 'draft'; saveDraft(); showStatus(); } ui.toast('↩ 회수했어요'); showMine(); } catch (er) { ui.toast(er.message); } return; }
      if (b.dataset.load) {
        try { const r = await Hub.mapGet(b.dataset.load); if (!r) return ui.toast('맵을 찾지 못했어요'); push(); def = Object.assign(blank(0), r.data); def.exits = def.exits || {}; idEl().value = r.id; $('#meName', root).value = r.name || ''; $('#meRegion', root).value = def.region; draftId = null; draftSt = null; review = null; syncBtns(); schedule(); saveDraft(); showStatus(); list.hidden = true; ui.toast('불러왔어요: ' + (r.name || r.id)); } catch (er) { ui.toast(er.message); }
      }
      if (b.dataset.del) { if (!confirm(`'${b.dataset.del}' 맵을 지울까요? 되돌릴 수 없어요.`)) return; try { await Hub.mapDelete(b.dataset.del); ui.toast('지웠어요'); showList(); } catch (er) { ui.toast(er.message); } }
    });
    root.addEventListener('click', async e => {
      if (!alive) return;   // v126 예전 화면의 단추 처리기가 남아 같이 움직이지 않게
      const b = e.target.closest('[data-act]'); if (!b || b.closest('#meList')) return;
      const a = b.dataset.act;
      if (a === 'undo') { if (undo.length) { redo.push(snap()); restore(undo.pop()); } }
      if (a === 'redo') { if (redo.length) { undo.push(snap()); restore(redo.pop()); } }
      if (a === 'new') { if (!confirm('지금 그림을 지우고 새 지도를 시작할까요? (저장 안 한 것은 사라져요)')) return; push(); def = blank(+$('#meRegion', root).value); if (idEl()) idEl().value = ''; $('#meName', root).value = ''; draftId = null; draftSt = null; review = null; syncBtns(); schedule(); saveDraft(); showStatus(); }
      if (a === 'list') showList();
      if (a === 'samples') showSamples();
      if (a === 'mine') showMine();
      if (a === 'withdraw' && draftId) { if (!confirm('제출을 회수할까요? 다시 작성 중으로 바뀌어 고칠 수 있어요.')) return; try { await Hub.draftWithdraw(draftId); draftSt = 'draft'; saveDraft(); showStatus(); ui.toast('↩ 회수했어요. 이제 고칠 수 있어요'); } catch (er) { ui.toast(er.message); } }
      if (a === 'save' || a === 'submit') {
        if (!Hub.user) { ui.toast('로그인하면 저장할 수 있어요'); if (ui.openAuth) ui.openAuth('login'); return; }
        const title = $('#meName', root).value.trim();
        if (!title) { ui.toast('지도 이름을 적어 주세요'); $('#meName', root).focus(); return; }
        if (window.GoFilter && window.GoFilter.has(title)) { ui.toast('지도 이름에 쓸 수 없는 말이 있어요'); return; }
        if (a === 'submit' && !confirm('이 지도를 관리자에게 제출할까요? 제출하면 관리자가 확인할 때까지 고칠 수 없어요.')) return;
        try {
          if (draftId && draftSt === 'submitted') { ui.toast('제출한 지도예요. 먼저 ↩ 회수 를 눌러 주세요'); return; }
          const keep = draftId && ['draft', 'returned'].includes(draftSt) ? draftId : null;   // 반영된 지도는 새 지도로 저장
          draftId = await Hub.draftSave(keep, title, def); draftSt = 'draft'; review = null;
          if (a === 'submit') { await Hub.draftSubmit(draftId); draftSt = 'submitted'; ui.toast('📮 제출했어요! 관리자가 확인하면 게임에 들어갈 수 있어요.'); }
          else ui.toast(keep ? '저장했어요' : '새 지도로 저장했어요');
          saveDraft(); showStatus();
        } catch (er) { ui.toast(er.message); }
      }
      if (a === 'official' && admin) {
        const id = idEl().value.trim(), name = $('#meName', root).value.trim();
        if (!idOk(id)) return ui.toast('공식 맵 아이디는 영문 소문자·숫자·_·- 로 2~40자예요. (예: hidden1)');
        if (/^(f\d+|v\d+|h\d+-\d+)$/.test(id) && !confirm(`'${id}' 는 지금 게임에 있는 맵 이름이에요. 그래도 이 이름으로 저장할까요? (나중에 게임에 연결하면 그 맵 대신 이 그림이 나와요)`)) return;
        try {
          await Hub.mapSave(id, name || id, def);
          if (review) { await Hub.adminDraftSet(review.id, { status: 'accepted', official_id: id, admin_note: '반영했어요 (공식 맵 ' + id + ')' }); ui.toast('✅ 반영했어요: ' + id + ' (만든 학생 지도는 \'반영됨\')'); review = null; }
          else ui.toast('공식 맵으로 저장했어요: ' + id);
          saveDraft(); showStatus();
        } catch (er) { ui.toast(er.message); }
      }
      if (a === 'return' && admin && review) {
        const note = prompt('돌려보내는 까닭을 적어 주세요 (학생에게 보여요, 200자까지)', '');
        if (note == null) return;
        try { await Hub.adminDraftSet(review.id, { status: 'returned', admin_note: note.slice(0, 200) }); ui.toast('돌려보냈어요'); review = null; saveDraft(); showStatus(); } catch (er) { ui.toast(er.message); }
      }
      if (a === 'export') {
        const id = (idEl() && idEl().value.trim()) || (draftId ? 'my' + draftId : 'map'), blob = new Blob([JSON.stringify({ id, name: $('#meName', root).value.trim(), data: def })], { type: 'application/json' });
        const u = URL.createObjectURL(blob), l = document.createElement('a'); l.href = u; l.download = 'rpg_map_' + id + '.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
      }
    });
    $('#meImport', root).addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try { const o = JSON.parse(await f.text()), d = o.data || o; if (!d.t || d.t.length !== W * H) throw new Error('50×34 맵 파일이 아니에요'); push(); def = Object.assign(blank(0), d); def.exits = def.exits || {}; if (idEl()) idEl().value = o.id || ''; $('#meName', root).value = o.name || ''; draftId = null; draftSt = null; review = null; showStatus(); $('#meRegion', root).value = def.region; syncBtns(); schedule(); saveDraft(); ui.toast('가져왔어요'); }
      catch (er) { ui.toast('파일을 읽지 못했어요: ' + er.message); }
      e.target.value = '';
    });

    setZoom(zoom); syncBtns(); fullRender(); showStatus();
    // 메이커·맵 관리에서 '열기'로 들어온 경우
    if (openReq) {
      if (openReq.draft) loadDraft(openReq.draft, !!openReq.review && admin).catch(er => ui.toast(er.message));
      else if (openReq.official && admin) Hub.mapGet(openReq.official).then(r => { if (!r) return; push(); def = Object.assign(blank(0), r.data); def.exits = def.exits || {}; idEl().value = r.id; $('#meName', root).value = r.name || ''; $('#meRegion', root).value = def.region; draftId = null; draftSt = null; review = null; syncBtns(); schedule(); saveDraft(); showStatus(); }).catch(er => ui.toast(er.message));
      else if (openReq.samples) showSamples();
      else if (openReq.fresh) { def = blank(0); $('#meName', root).value = ''; draftId = null; draftSt = null; review = null; syncBtns(); schedule(); saveDraft(); showStatus(); }
    }
    return () => { alive = false; clearTimeout(rTimer); document.removeEventListener('keydown', onKey); };
  }

  /* ---------- 지도 미리보기 그림 (맵 관리·메이커) ---------- */
  function drawPreview(cv, def, scale, again) {
    const P = window.__GoRPGParts; if (!P || !def || !def.t) return;
    const d = Object.assign(blank(0), def), r = P.previewMap(d, 'pv'), k = scale || 0.5;
    cv.width = W * TS * k; cv.height = H * TS * k;
    const x = cv.getContext('2d'); x.save(); x.scale(k, k); x.drawImage(r.ground, 0, 0); r.objs.slice().sort((a, b) => a.sy - b.sy).forEach(o => P.drawMapObj(x, o)); x.restore();
    const need = r.need.concat(r.objs.filter(o => o.alt2 && !P.img79(o.alt2)).map(o => o.alt2));
    if (need.length && again !== false) { let left = need.length; need.forEach(n => P.img79(n, () => { if (--left === 0 && cv.isConnected) drawPreview(cv, def, scale, false); })); }
  }
  const go = (req, hash) => { try { sessionStorage.setItem(OPEN, JSON.stringify(req)); } catch (e) { /* noop */ } location.hash = hash || '#mapedit'; };

  /* ---------- #maker 메이커 메뉴 (누구나) ---------- */
  function renderMaker(root, ui) {
    let alive = true;
    root.innerHTML = `
      <div class="maker">
        <div class="page-head"><h1>🛠 메이커</h1><p>내가 직접 게임 속 세상을 만들어요. 다 만든 작품은 <b>제출</b>하면 선생님(관리자)이 보고 게임에 넣어 줘요.</p></div>
        <div class="maker-cards">
          <div class="panel maker-card">
            <div class="mk-ic">🗺</div>
            <h2>Skillcom RPG 지도 그리기</h2>
            <p>풀·길·나무·바위·물·꽃·연못을 끌어서 50×34칸 사냥터 지도를 그려요. 게임과 같은 그림으로 바로 보여요.</p>
            <ol class="mk-steps"><li>그리기</li><li>저장 (로그인 · 20개까지 · 언제든 고치기)</li><li>📮 제출 → 관리자 검토 (마음이 바뀌면 ↩ 회수·지우기)</li><li>반영되면 게임 속으로!</li></ol>
            <div class="row"><button type="button" class="btn btn-sun" data-mk="new">새 지도 그리기</button><button type="button" class="btn btn-sky" data-mk="samples">🗺 샘플 지도로 시작</button><button type="button" class="btn" data-mk="cont">그리던 지도 이어서</button></div>
          </div>
        </div>
        <div class="panel maker-mine"><h2>내 지도</h2><div id="mkMine"><p class="empty">불러오는 중…</p></div></div>
      </div>`;
    const box = $('#mkMine', root);
    root.addEventListener('click', async e => {
      if (!alive) return;   // v126 예전 화면의 단추 처리기가 남아 같이 움직이지 않게
      const b = e.target.closest('[data-mk],[data-kload],[data-kdel],[data-kback]'); if (!b) return;
      if (b.dataset.mk === 'new') go({ fresh: 1 });
      if (b.dataset.mk === 'cont') location.hash = '#mapedit';
      if (b.dataset.mk === 'samples') go({ samples: 1 });   // v130 샘플 지도 목록을 연 채로
      if (b.dataset.kload) go({ draft: +b.dataset.kload });
      if (b.dataset.kdel) { if (!confirm('이 지도를 지울까요? 되돌릴 수 없어요.')) return; try { await Hub.draftDelete(+b.dataset.kdel); ui.toast('지웠어요'); loadMine(); } catch (er) { ui.toast(er.message); } }
      if (b.dataset.kback) { if (!confirm('제출을 회수할까요? 다시 작성 중으로 바뀌어 고칠 수 있어요.')) return; try { await Hub.draftWithdraw(+b.dataset.kback); ui.toast('↩ 회수했어요. 열어서 고칠 수 있어요'); loadMine(); } catch (er) { ui.toast(er.message); } }
    });
    const loadMine = () => { if (!Hub.user) box.innerHTML = '<p class="empty">로그인하면 내가 저장한 지도가 여기에 보여요.</p><button class="btn btn-primary" type="button" data-auth="login">로그인</button>';
    else Hub.myMaps().then(rows => {
      if (!alive) return;
      box.innerHTML = rows.length ? myListHtml(rows, ui.esc, 'k') : '<p class="empty">아직 저장한 지도가 없어요. 첫 지도를 그려 보세요!</p>';
    }).catch(er => { if (alive) box.innerHTML = `<p class="err">${ui.esc(er.message)}</p>`; }); };
    loadMine();
    return () => { alive = false; };
  }

  /* ---------- #mapadmin 관리자 'Skillcom RPG 맵 관리' ---------- */
  function renderAdmin(root, ui) {
    if (!Hub.isAdmin()) {
      root.innerHTML = `<div class="panel gate"><h2>관리자만 들어올 수 있어요</h2><p>관리자 아이디로 로그인해 주세요.</p>
        <div class="row" style="justify-content:center">${Hub.user ? '<a class="btn" href="#home">홈으로</a>' : '<button class="btn btn-primary" type="button" data-auth="login">로그인</button>'}</div></div>`;
      return () => {};
    }
    let alive = true, tab = 'submitted', sel = null;
    const TABS = [['submitted', '제출함'], ['returned', '돌려보냄'], ['accepted', '반영됨'], ['draft', '작성 중'], ['', '전체'], ['official', '공식 맵']];
    root.innerHTML = `
      <div class="mapadmin">
        <div class="page-head"><h1>🗺 Skillcom RPG 맵 관리</h1><p>플레이어가 제출한 지도를 보고, 편집기에서 조금 고쳐 공식 맵으로 반영하거나 돌려보내요. <a href="#admin">← 관리자 설정</a> · <a href="#mapedit">관리자 편집기 열기</a></p></div>
        <div class="admin-tabs" role="tablist">${TABS.map(([k, n]) => `<button type="button" role="tab" data-mt="${k}" aria-selected="${tab === k}">${n}</button>`).join('')}</div>
        <div class="ma-main">
          <div class="panel ma-list" id="maList"><p class="empty">불러오는 중…</p></div>
          <div class="panel ma-view" id="maView"><p class="empty">왼쪽 목록에서 지도를 누르면 여기에 지도가 보여요.</p></div>
        </div>
      </div>`;
    const list = $('#maList', root), view = $('#maView', root);
    let rows = [];
    async function load() {
      list.innerHTML = '<p class="empty">불러오는 중…</p>';
      try {
        rows = tab === 'official' ? (await Hub.mapList()).map(r => ({ official: true, id: r.id, title: r.name, updated_at: r.updated_at })) : await Hub.adminDrafts(tab || null);
        if (!alive) return;
        list.innerHTML = rows.length ? `<ul>${rows.map((r, i) => `<li><button type="button" data-i="${i}" aria-pressed="${sel === i}"><b>${ui.esc(r.title || r.id || '이름 없음')}</b>${r.official ? `<span>${ui.esc(r.id)}</span>` : `<span>${ui.esc((r.profiles && r.profiles.nickname) || '')} · ${ui.esc(((r.submitted_at || r.updated_at) || '').slice(0, 16).replace('T', ' '))}</span> ${stBadge(r.status, ui.esc)}`}</button></li>`).join('')}</ul>` : '<p class="empty">이 목록은 비어 있어요.</p>';
      } catch (er) { list.innerHTML = `<p class="err">${ui.esc(er.message)}</p>`; }
    }
    async function show(i) {
      sel = i; $$('[data-i]', list).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
      const r = rows[i]; view.innerHTML = '<p class="empty">지도를 불러오는 중…</p>';
      try {
        const full = r.official ? await Hub.mapGet(r.id) : await Hub.draftGet(r.id); if (!alive || sel !== i) return;
        if (!full) { view.innerHTML = '<p class="err">지도를 찾지 못했어요.</p>'; return; }
        const def = full.data, rg = window.GoRPGData.REGIONS[def.region || 0];
        view.innerHTML = `
          <h2>${ui.esc(full.title || full.name || full.id)}</h2>
          <p class="ma-meta">${r.official ? `공식 맵 아이디 <b>${ui.esc(full.id)}</b>` : `만든 사람 <b>${ui.esc((full.profiles && full.profiles.nickname) || '')}</b> · ${stBadge(full.status, ui.esc)}${full.official_id ? ` · 공식 맵 <b>${ui.esc(full.official_id)}</b>` : ''}`} · 지역 ${ui.esc(rg ? rg.name : '')} · 던전 입구 ${(def.dungeons || []).length ? (def.dungeons || []).map((d, j) => (j + 1) + '→' + ui.esc(d.to || '?')).join(', ') : '없음'} · 출구 ${Object.keys(def.exits || {}).map(k => ({ u: '위', d: '아래', l: '왼쪽', r: '오른쪽' })[k] + (def.exits[k] ? '→' + ui.esc(def.exits[k]) : '')).join(', ') || '없음'}</p>
          ${full.admin_note ? `<p class="me-note">메모: ${ui.esc(full.admin_note)}</p>` : ''}
          <div class="ma-canvas"><canvas id="maCv"></canvas></div>
          <div class="row">
            <button type="button" class="btn btn-sun" data-ma="edit">✏ 편집기에서 열어 고치기·반영</button>
            ${r.official ? '' : '<button type="button" class="btn" data-ma="return">↩ 돌려보내기</button>'}
          </div>`;
        drawPreview($('#maCv', view), def, 0.5);
      } catch (er) { view.innerHTML = `<p class="err">${ui.esc(er.message)}</p>`; }
    }
    root.addEventListener('click', async e => {
      if (!alive) return;   // v126 예전 화면의 단추 처리기가 남아 같이 움직이지 않게
      const t = e.target.closest('[data-mt]'); if (t) { tab = t.dataset.mt; sel = null; $$('[data-mt]', root).forEach(b => b.setAttribute('aria-selected', String(b.dataset.mt === tab))); view.innerHTML = '<p class="empty">왼쪽 목록에서 지도를 누르면 여기에 지도가 보여요.</p>'; load(); return; }
      const b = e.target.closest('[data-i]'); if (b) { show(+b.dataset.i); return; }
      const m = e.target.closest('[data-ma]'); if (!m || sel == null) return; const r = rows[sel];
      if (m.dataset.ma === 'edit') go(r.official ? { official: r.id } : { draft: r.id, review: 1 });
      if (m.dataset.ma === 'return') {
        const note = prompt('돌려보내는 까닭을 적어 주세요 (학생에게 보여요, 200자까지)', ''); if (note == null) return;
        try { await Hub.adminDraftSet(r.id, { status: 'returned', admin_note: note.slice(0, 200) }); ui.toast('돌려보냈어요'); load(); show(sel); } catch (er) { ui.toast(er.message); }
      }
    });
    load();
    return () => { alive = false; };
  }
  window.GoMapEdit = { render, renderMaker, renderAdmin, drawPreview };

})();
