/*
 * gogo?gogo! — 마법 융합 모험 (도트 RPG · 혼자 플레이 첫 버전 v40)
 *
 *  파일 3개: data.js (숫자·목록) · world.js (지도 만들기·그림) · game.js (이 파일: 움직임·전투·창·저장)
 *  캐릭터: 사이트 아바타 그대로 + 장비를 위에 겹쳐 그림. 가방 창 '장비 안보이기' = 그림만 숨김 (능력치 그대로)
 *  저장: 이 기기(localStorage) + 로그인하면 서버 game_saves 표 (supabase/rpg_v40.sql). 더 최근 것을 불러옴
 *  조작: WASD/방향키 이동 · Space/J 공격 · 1~4 마법 · Q/E 포션 · I 가방 · K 마법 · F/Enter 들어가기 · Esc 닫기
 *        휴대폰: 왼쪽 조이스틱 + 오른쪽 버튼 (캔버스 위)
 */
(function () {
  'use strict';
  const D = window.GoRPGData, AV = window.GoAvatar, Hub = window.GameHub, BGM = window.GoBGM;
  const P = window.__GoRPGParts, CFG = window.GoSettings.get('rpg');
  const { loadImages, imgOk, getMap, solidAt, monSprite, avatarSprite, itemIcon, clamp, rand, pick, dist, fmtN, W, H, TS, SAVE_V, GAME, MAPBY } = P;
  const ITEMS = D.ITEMS, SKILLS = D.SKILLS, ELEM = D.ELEM, Fx = window.GoRPGFx;
  const POT_T = D.POTIONS.filter(p => p.kind === 'hp').map(p => p.tier + 1).reverse();   // 포션 단계 (큰 것부터) 9 … 1
  const ROMAN = ['', ' Ⅱ', ' Ⅲ', ' Ⅳ', ' Ⅴ'];
  const KIND_TXT = { bolt: '탄', nova: '주변 폭발', beam: '일직선', rain: '여러 곳에 떨어짐', pool: '바닥 장판', dash: '돌진', heal: '회복', shield: '보호막' };
  const FX_TXT = { burn: '화상', slow: '느려짐', stun: '기절', push: '밀어내기', heavy: '큰 피해', holy: '흡수 회복' };

  /* ================= 마법 (기본 + 융합) ================= */
  const fuseId = (a, b) => 'fu:' + [a, b].sort().join('+');
  function skill(id) {
    if (!id) return null;
    if (SKILLS[id]) return Object.assign({ els: [SKILLS[id].el] }, SKILLS[id]);
    if (!id.startsWith('fu:')) return null;
    const [a, b] = id.slice(3).split('+'), A = SKILLS[a], B = SKILLS[b]; if (!A || !B) return null;
    const rec = D.fusionOf(A.el, B.el); if (!rec) return null;
    const lv = Math.max(A.lv, B.lv), ap = X => (X.kind === 'heal' || X.kind === 'shield' ? 1.5 + X.lv / 40 : X.pow);
    const kind = rec[3];
    const pow = kind === 'heal' ? Math.min(0.85, 0.35 + lv / 250) : kind === 'shield' ? Math.min(0.7, 0.4 + lv / 400) : Math.round((ap(A) + ap(B)) * 0.85 * 10) / 10;
    return Object.assign({ id, name: rec[2] + ROMAN[Math.min(4, Math.floor((lv - 1) / 20))], el: A.el, els: [A.el, B.el], lv, kind, pow, mp: Math.round((A.mp + B.mp) * 0.75), cd: Math.max(2, Math.max(A.cd, B.cd)), fusion: [a, b], dur: 6 }, rec[4]);
  }
  const fusePrice = (a, b) => { const lv = Math.max(SKILLS[a].lv, SKILLS[b].lv); return Math.round(100 + lv * lv * 2); };
  function describe(sk) {
    const els = sk.els.map(e => `<b style="color:${ELEM[e].color}">${ELEM[e].name}</b>`).join(' + ');
    const fx = sk.els.map(e => FX_TXT[ELEM[e].fx]).join('·');
    const p = sk.kind === 'heal' ? `최대 체력의 ${Math.round(sk.pow * 100)}% 회복` : sk.kind === 'shield' ? `받는 피해 ${Math.round(sk.pow * 100)}% 줄임 · ${sk.dur || 6}초` : `위력 ×${sk.pow}${sk.count ? ' · ' + sk.count + '번' : ''} · ${fx}`;
    return `${els} · ${KIND_TXT[sk.kind]} · ${p} · 마나 ${sk.mp} · ${sk.cd}초`;
  }

  /* ================= 저장 ================= */
  function newSave() {
    const s = { v: SAVE_V, lv: 1, exp: 0, gold: 50, hp: 0, mp: 0, map: 'v1', x: null, y: null, home: 'v1',
      inv: [{ id: 'hp1', n: 5 }, { id: 'mp1', n: 3 }, { id: 'scroll', n: 1 }], eq: {}, hide: false,
      skills: [], slots: [null, null, null, null], visited: ['v1'], play: 0, kills: 0, bosses: {}, help: false, savedAt: 0 };
    return s;
  }
  function fixSave(s) {
    const n = newSave(); if (!s || typeof s !== 'object' || s.v !== SAVE_V) return n;
    Object.keys(n).forEach(k => { if (s[k] === undefined) s[k] = n[k]; });
    s.lv = clamp(Math.floor(+s.lv || 1), 1, D.MAX_LV); s.exp = Math.max(0, +s.exp || 0); s.gold = Math.max(0, Math.floor(+s.gold || 0));
    if (!MAPBY[s.map]) s.map = 'v1'; if (!MAPBY[s.home] || MAPBY[s.home].kind !== 'village') s.home = 'v1';
    s.inv = (Array.isArray(s.inv) ? s.inv : []).filter(x => x && ITEMS[x.id] && x.n > 0).slice(0, 60);
    Object.keys(s.eq || {}).forEach(k => { if (!ITEMS[s.eq[k]] || ITEMS[s.eq[k]].slot !== k) delete s.eq[k]; });
    s.skills = (s.skills || []).filter(id => skill(id)); s.slots = [0, 1, 2, 3].map(i => (s.slots && s.skills.includes(s.slots[i]) ? s.slots[i] : null));
    s.visited = (s.visited || []).filter(id => MAPBY[id]); if (!s.visited.includes('v1')) s.visited.unshift('v1');
    return s;
  }
  const Store = {
    noServer: false,
    key: uid => 'gogogogo.rpg.' + (uid || 'guest'),
    local(uid) { try { return JSON.parse(localStorage.getItem(this.key(uid)) || 'null'); } catch (e) { return null; } },
    setLocal(uid, s) { try { localStorage.setItem(this.key(uid), JSON.stringify(s)); } catch (e) { /* noop */ } },
    online: () => Hub.mode === 'online' && Hub.user && Hub._sb,
    async server() {
      if (!this.online() || this.noServer) return null;
      try {
        const { data, error } = await Hub._sb.from('game_saves').select('data').eq('user_id', Hub.user.id).eq('game_id', GAME).maybeSingle();
        if (error) { this.noServer = true; console.warn('[rpg] 서버 저장 표 없음 → 이 기기에만 저장', error.message); return null; }
        return data ? data.data : null;
      } catch (e) { return null; }
    },
    async push(s) {
      if (!this.online() || this.noServer) return false;
      try {
        const { error } = await Hub._sb.from('game_saves').upsert({ user_id: Hub.user.id, game_id: GAME, data: s, updated_at: new Date().toISOString() });
        if (error) { if (/relation|does not exist|schema cache|permission/i.test(error.message)) this.noServer = true; console.warn('[rpg] 서버 저장 실패', error.message); return false; }
        return true;
      } catch (e) { return false; }
    },
    async load() {
      const uid = Hub.user && Hub.user.id;
      let s = this.local(uid);
      const srv = await this.server();
      if (srv && (!s || (srv.savedAt || 0) > (s.savedAt || 0))) s = srv;
      if (!s && uid) { const g = this.local(null); if (g && g.lv > 1) s = g; }   // 손님으로 하던 기록을 로그인 계정으로 이어서
      return fixSave(s);
    }
  };

  /* ================= 화면 모양 (이 게임 전용 CSS) ================= */
  const CSS = `
  .rg-page .rg-wrap { display: grid; gap: 12px; justify-items: center; }
  .rg-page .cabinet { max-width: min(calc(960px + 32px), max(320px, calc((100svh - 190px) * 1.7778 + 32px))); padding: 12px; }
  .rg-page .screen { outline: none; }
  .rg-bar { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .rg-bar .btn { min-width: 0; padding: 8px 12px; font-size: 14px; }
  .rg-panel { position: absolute; inset: 4% 6%; background: linear-gradient(180deg, rgba(34, 42, 92, .97), rgba(12, 16, 40, .97)); color: #EEF1FF; border: 3px solid #0A0E24; border-radius: 10px; padding: 12px 14px; overflow-y: auto; overscroll-behavior: contain; font-size: 14px; z-index: 3; box-shadow: 0 6px 0 rgba(0,0,0,.35); }
  .rg-panel[hidden] { display: none; }
  .rg-panel h3 { font-family: var(--f-display); font-size: 22px; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
  .rg-panel h3 .x { margin-left: auto; background: #2A325E; color: #fff; border: 2px solid #0A0E24; border-radius: 6px; font-size: 14px; padding: 2px 10px; cursor: pointer; }
  .rg-panel .sub { color: #AEB7E0; font-size: 13px; margin: 0 0 8px; }
  .rg-tabs { display: flex; gap: 6px; margin: 4px 0 10px; flex-wrap: wrap; }
  .rg-tabs button { background: #222A52; color: #C9D0F0; border: 2px solid #0A0E24; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 13px; }
  .rg-tabs button[aria-pressed="true"] { background: #FFD23F; color: #1D2340; }
  .rg-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .rg-row { display: flex; align-items: center; gap: 10px; background: linear-gradient(180deg, #232B5C, #1A2148); border: 2px solid #0A0E24; border-radius: 10px; padding: 6px 8px; box-shadow: 0 2px 0 rgba(0,0,0,.25); transition: transform .1s; }
  .rg-row:hover { transform: translateY(-1px); border-color: #3A4690; }
  .rg-row.off { opacity: .55; }
  .rg-row .nm { font-weight: 700; }
  .rg-row .ds { color: #AEB7E0; font-size: 12px; display: block; font-weight: 400; }
  .rg-row .grow { flex: 1; min-width: 0; }
  .rg-row .btn, .rg-mini { padding: 4px 10px; font-size: 13px; min-width: 0; border-radius: 6px; cursor: pointer; background: #FFD23F; color: #1D2340; border: 2px solid #0A0E24; white-space: nowrap; }
  .rg-mini.ghost { background: #2A325E; color: #EEF1FF; }
  .rg-mini[disabled] { opacity: .45; cursor: default; }
  .rg-mini.on { background: #3DDC84; }
  .rg-ic { width: 40px; height: 40px; flex: none; border-radius: 8px; background: radial-gradient(circle at 35% 30%, #2E3870, #0F1430 70%); border: 2px solid var(--c); image-rendering: pixelated; padding: 1px; box-sizing: border-box; }
  .rg-ic.rare { box-shadow: 0 0 10px var(--g), 0 0 0 1px var(--g) inset; animation: rgShine 1.6s ease-in-out infinite; }
  @keyframes rgShine { 50% { box-shadow: 0 0 16px var(--g), 0 0 0 1px var(--g) inset; } }
  .rg-sk { width: 40px; height: 40px; flex: none; border-radius: 8px; border: 2px solid #0A0E24; box-shadow: 0 2px 0 rgba(0,0,0,.35); }
  .rg-slots { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0 10px; }
  .rg-slot { display: inline-flex; align-items: center; gap: 6px; background: #1A2148; border: 2px solid #0A0E24; border-radius: 8px; padding: 3px 8px 3px 3px; font-size: 13px; }
  .rg-slot b { background: #FFD23F; color: #1D2340; border-radius: 4px; padding: 0 5px; }
  .rg-slot .rg-sk { width: 28px; height: 28px; }
  .rg-slot i { color: #8A93C0; font-style: normal; padding: 4px; }
  .rg-eq { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px; margin-bottom: 8px; }
  .rg-stats { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 13px; color: #C9D0F0; margin: 6px 0 10px; }
  .rg-stats b { color: #FFD23F; }
  .rg-check { display: inline-flex; align-items: center; gap: 6px; background: #222A52; border: 2px solid #0A0E24; border-radius: 8px; padding: 4px 10px; cursor: pointer; font-size: 13px; }
  .rg-check input { width: 18px; height: 18px; }
  .rg-gold { color: #FFD23F; font-weight: 700; }
  .rg-fuse { display: grid; gap: 8px; background: #1A2148; border: 2px dashed #5A64A0; border-radius: 8px; padding: 8px; margin-bottom: 10px; }
  .rg-fuse select { width: 100%; padding: 4px; border-radius: 6px; font-size: 14px; }
  .rg-msg { position: absolute; left: 50%; top: 66%; transform: translateX(-50%); background: rgba(10,14,36,.85); color: #FFE45C; border: 2px solid #0A0E24; border-radius: 8px; padding: 6px 14px; font-size: 15px; pointer-events: none; z-index: 2; white-space: nowrap; font-family: var(--f-display); }
  .rg-msg[hidden] { display: none; }
  .rg-side { width: min(100%, 992px); display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rg-side .panel { margin: 0; }
  @media (max-height: 520px) {   /* 휴대폰 가로: 게임판을 화면 높이에 꽉 차게 */
    .rg-page .cabinet { max-width: min(100%, calc((100svh - 64px) * 1.7778 + 12px)); padding: 6px; border-radius: 10px; }
    .rg-panel { position: fixed; inset: 6px 8% 6px 8%; max-height: none; z-index: 60; }
  }
  @media (max-width: 760px) {
    .rg-side { grid-template-columns: 1fr; }
    .rg-panel { position: fixed; inset: auto 0 0 0; max-height: 72svh; border-radius: 14px 14px 0 0; z-index: 60; }
    .rg-msg { font-size: 12px; }
  }`;

  /* ================= 본체 ================= */
  window.GoRPG = {
    render(el, A) {
      BGM.load(GAME);
      if (!document.getElementById('rgCss')) { const st = document.createElement('style'); st.id = 'rgCss'; st.textContent = CSS; document.head.appendChild(st); }
      el.innerHTML = `
        <div class="rg-page">
          <div class="play-head"><a class="back" href="#home">← 게임 목록</a><span class="cat">RPG</span><h1>${CFG.name}</h1><span class="small" style="margin:0">마을 9 · 사냥터 90 · 만렙 100 · 혼자 플레이</span></div>
          <div class="rg-wrap">
            <div class="cabinet cab-blue" style="--cw:960px;--ar:1.7778"><div class="screen" id="rgScreen" tabindex="0">
              <canvas id="rgCanvas" aria-label="${CFG.name} 게임 화면"></canvas>
              <div class="rg-msg" id="rgMsg" hidden></div>
              <div class="rg-panel" id="rgPanel" hidden></div>
            </div></div>
            <div class="rg-bar">
              <button type="button" class="btn" data-rg="inv">가방 · 장비 (I)</button>
              <button type="button" class="btn" data-rg="skill">마법 (K)</button>
              <button type="button" class="btn" data-rg="help">도움말</button>
              <button type="button" class="btn btn-sun" data-rg="save">지금 저장</button>
            </div>
            <div class="rg-side">
              <div class="panel"><h3>레벨 랭킹</h3><ol class="rank" id="rgRank"><li class="empty">불러오는 중…</li></ol><p class="small" id="rgMine"></p></div>
              <div class="panel"><h3>안내</h3><ul class="ult-rules">
                <li>캐릭터는 <b>내 아바타</b>예요. 상점·옷장에서 꾸민 모습 그대로 모험해요.</li>
                <li>오른쪽 끝으로 가면 다음 지도, 왼쪽 끝은 이전 지도. 사냥터 이름 옆 <b>권장 레벨</b>을 보고 가요.</li>
                <li>마을: <b>포션 가게</b> · <b>마법 학교</b>(마법 배우기·<b>융합</b>) · <b>이장 집</b>(마을·사냥터 이동). 마지막 마을엔 <b>성</b>.</li>
                <li>몬스터가 떨어뜨린 장비를 입으면 아바타 위에 겹쳐 보여요. 가방에서 <b>장비 안보이기</b>를 켜면 능력치는 그대로, 그림만 숨겨요.</li>
                <li id="rgSaveNote">${Hub.user ? '진행은 자동 저장돼요.' : '손님은 이 기기에만 저장돼요. 로그인하면 어느 기기에서나 이어서 해요.'}</li>
              </ul></div>
            </div>
          </div>
        </div>`;
      const $ = s => el.querySelector(s);
      const canvas = $('#rgCanvas'), screenEl = $('#rgScreen'), panel = $('#rgPanel'), msgEl = $('#rgMsg');
      let ctx = window.GoPixel.setup(canvas, W, H);
      const onResize = () => { ctx = window.GoPixel.setup(canvas, W, H); };
      window.addEventListener('resize', onResize);

      let S = null, alive = true, raf = 0, last = 0, loadingText = '';
      const G = { map: null, px: 0, py: 0, fx: 1, fy: 0, face: 1, walk: 0, moving: false, mons: [], shots: [], fxs: [], texts: [], pools: [],
        atkCd: 0, cds: {}, inv: 0, shield: null, dash: null, lastHit: 99, dead: false, paused: true, saveT: 0, srvT: 0, dirty: false,
        keys: {}, touch: false, joy: null, btnDown: {}, onDoor: null, lastSubmit: 0, playMark: 0, shake: 0, hurt: 0, flash: 0, hitstop: 0, title: null };
      Fx.onBoom = n => { G.shake = Math.max(G.shake, n); };

      /* ---------- 능력치 ---------- */
      function stats() {
        const F = D.F, lv = S.lv, st = { atk: F.atk(lv), mag: F.mag(lv), def: F.def(lv), hp: F.hp(lv), mp: F.mp(lv), spd: 0 };
        Object.values(S.eq).forEach(id => { const it = ITEMS[id]; if (it && it.st) Object.keys(it.st).forEach(k => { st[k] += it.st[k]; }); });
        return st;
      }
      let ST = null; const restat = () => { ST = stats(); S.hp = clamp(S.hp, 0, ST.hp); S.mp = clamp(S.mp, 0, ST.mp); };

      /* ---------- 가방 ---------- */
      const count = id => (S.inv.find(x => x.id === id) || { n: 0 }).n;
      function addItem(id, n) {
        n = n || 1; const e = S.inv.find(x => x.id === id);
        if (e) { e.n += n; return true; }
        if (S.inv.length >= 40) { say('가방이 가득 찼어요! (40칸)'); return false; }
        S.inv.push({ id, n }); return true;
      }
      function takeItem(id, n) { n = n || 1; const e = S.inv.find(x => x.id === id); if (!e || e.n < n) return false; e.n -= n; if (!e.n) S.inv.splice(S.inv.indexOf(e), 1); return true; }

      /* ---------- 글자 띄우기 ---------- */
      let msgT = 0;
      function say(t, sec) { msgEl.textContent = t; msgEl.hidden = false; msgT = sec || 2.4; }
      const float = (x, y, text, color, big) => G.texts.push({ x, y, text, color: color || '#FFFFFF', t: 0, big });

      /* ---------- 지도 들어가기 ---------- */
      function enter(id, side) {
        const M = MAPBY[id]; if (!M) return;
        const map = getMap(id);
        G.map = map; S.map = id; G.shots = []; G.fxs = []; G.pools = []; G.texts = []; Fx.reset(); G.hpGhost = null;
        G.title = { t: 0, text: M.kind === 'village' ? M.name : M.name, sub: M.kind === 'village' ? (D.REGIONS[M.region].castle ? '마지막 마을 · 왕성' : `마을 ${M.region + 1}`) : `사냥터 ${M.no} · 권장 Lv.${M.rec}${M.boss ? ' · 보스' : ''}` };
        const p = side === 'R' ? map.startR : side === 'door' ? doorFront(map) : side === 'pos' && S.x ? { x: S.x, y: S.y } : map.startL;
        G.px = p.x; G.py = p.y;
        if (solidAt(map, G.px, G.py)) { const q = map.startL; G.px = q.x; G.py = q.y; }
        if (!S.visited.includes(id)) S.visited.push(id);
        if (M.kind === 'village') { S.home = id; spawnNone(); }
        else { spawnAll(); if (M.rec > S.lv + 6) say(`권장 Lv.${M.rec} — 지금 레벨로는 위험해요!`, 3); }
        G.onDoor = null; markDirty(true);
      }
      function doorFront(map) {
        const b = map.buildings.find(x => x.type === 'chief') || map.buildings[0];
        return { x: (b.door.x + 0.5) * TS, y: (b.door.y + 1.9) * TS };
      }
      function spawnNone() { G.mons = []; }
      function spawnAll() {
        const M = G.map.M; G.mons = [];
        if (M.boss) {
          G.mons.push(makeMon(M.mon, M.rec + 2, true));
          const minion = D.MAPS.find(m => m.kind === 'field' && m.no === M.no - 1);
          for (let i = 0; i < 6; i++) G.mons.push(makeMon(minion.mon, M.rec - 1));
        } else for (let i = 0; i < 12; i++) G.mons.push(makeMon(M.mon, M.rec - 1 + (Math.random() < 0.5 ? 0 : 1)));
      }
      function spawnPoint() {
        const sp = G.map.spawns; let p = pick(sp);
        for (let i = 0; i < 12 && Math.hypot(p.x - G.px, p.y - G.py) < 260; i++) p = pick(sp);
        return p;
      }
      function makeMon(def, lvl, boss) {
        lvl = clamp(lvl, 1, D.MAX_LV); const F = D.F, B = F.boss;
        const p = boss ? { x: G.map.w * TS * 0.62, y: (G.map.mid + 1) * TS } : spawnPoint();
        const sc = boss ? 6 : 3, spr = monSprite(def, sc);
        const hp = Math.round(F.monHp(lvl) * (boss ? B.hp : 1));
        return { def, name: def.name, lvl, boss: !!boss, kind: boss ? 'boss' : def.kind, x: p.x, y: p.y, hx: p.x, hy: p.y, hp, max: hp,
          atk: Math.round(F.monAtk(lvl) * (boss ? B.atk : 1)), mdef: F.monDef(lvl), spr, r: boss ? 30 : 14,
          exp: Math.round(F.monExp(lvl) * (boss ? B.exp : 1)), gold: Math.round(F.monGold(lvl) * (boss ? B.gold : 1)),
          spd: boss ? 70 : def.kind === 'shoot' ? 60 : 80, cd: rand(0.5, 1.5), wt: 0, wx: 0, wy: 0, aggro: false, flash: 0,
          burn: null, slow: 0, stun: 0, dead: false, respawn: 0, slam: null };
      }

      /* ---------- 전투: 피해 계산 ---------- */
      function hitMon(m, base, els, opt) {
        if (m.dead) return 0;
        opt = opt || {};
        const diff = m.lvl - S.lv, lvF = diff > 0 ? Math.max(0.4, 1 - 0.06 * diff) : 1 + Math.min(0.3, -diff * 0.03);
        let dmg = (base * rand(0.9, 1.1) - m.mdef * 0.5) * lvF;
        if ((els || []).some(e => ELEM[e].fx === 'heavy')) dmg *= 1.2;
        const crit = Math.random() < 0.08; if (crit) dmg *= 1.6;
        dmg = Math.max(1, Math.round(dmg));
        m.hp -= dmg; m.flash = 0.12; m.aggro = true; m.knock = (m.x < G.px ? -1 : 1) * (crit ? 6 : 3);
        const elc = els && els.length ? Fx.pal(els[0])[1] : '#FFFFFF';
        G.texts.push({ x: m.x + rand(-8, 8), y: m.y - m.spr.h - 4, text: (crit ? '치명! ' : '') + dmg, color: crit ? '#FFD23F' : elc, t: 0, big: crit, dmg: true });
        Fx.hit(m.x, m.y - m.spr.h / 2, els, crit);
        if (crit) { G.shake = Math.max(G.shake, 4); G.hitstop = 0.05; }
        (els || []).forEach(e => {
          const fx = ELEM[e].fx;
          if (fx === 'burn') m.burn = { t: 3, dps: dmg * 0.12, tick: 0.5 };
          else if (fx === 'slow') m.slow = 2.5;
          else if (fx === 'stun' && !opt.noStun) m.stun = m.boss ? 0.25 : 0.7;
          else if (fx === 'push') { const a = Math.atan2(m.y - G.py, m.x - G.px), k = m.boss ? 8 : 46; moveMon(m, Math.cos(a) * k, Math.sin(a) * k); }
          else if (fx === 'holy') S.hp = Math.min(ST.hp, S.hp + Math.max(1, Math.round(dmg * 0.03)));
        });
        if (m.hp <= 0) killMon(m);
        return dmg;
      }
      function killMon(m) {
        m.dead = true; m.respawn = m.boss ? 60 : 9; S.kills++;
        const low = m.lvl < S.lv - 10 ? 0.2 : 1;
        gainExp(Math.round(m.exp * low)); S.gold += m.gold; float(m.x, m.y - m.spr.h - 18, `+${fmtN(m.gold)}G`, '#FFD23F');
        Fx.death(m.x, m.y - m.spr.h / 2, m.def.colors, m.boss); Fx.coins(m.x, m.y - m.spr.h / 2, m.boss ? 14 : Math.min(6, 2 + Math.floor(m.gold / 40)));
        if (m.boss) { G.shake = 10; G.flash = 0.35; G.hitstop = 0.12; G.title = { t: 0, text: '보스 처치!', sub: m.name }; }
        // 떨어뜨리는 물건
        const M = G.map.M, t = M.region, k = (M.no - 1) % 10, drops = [];
        const gear = rare => { const ids = Object.keys(ITEMS).filter(id => { const it = ITEMS[id]; return it.slot && it.tier === t && it.rare === rare; }); return pick(ids); };
        if (m.boss) { drops.push(gear(Math.random() < 0.5)); drops.push('hp' + (t + 1), 'hp' + (t + 1), 'mp' + (t + 1)); S.bosses[M.id] = (S.bosses[M.id] || 0) + 1; bossReward(); }
        else {
          if (Math.random() < 0.025) drops.push(gear(false));
          if (k >= 5 && Math.random() < 0.01) drops.push(gear(true));
          if (Math.random() < 0.06) drops.push((Math.random() < 0.6 ? 'hp' : 'mp') + (t + 1));
        }
        drops.forEach((id, i) => { if (addItem(id, 1)) setTimeout(() => float(m.x, m.y - m.spr.h - 34 - i * 14, '획득: ' + ITEMS[id].name, ITEMS[id].rare ? '#C8A8FF' : '#9AE6FF'), i * 150); });
        if (drops.some(id => ITEMS[id].slot)) say('장비를 얻었어요! 가방(I)에서 입어 보세요');
        markDirty();
      }
      function gainExp(n) {
        if (S.lv >= D.MAX_LV) return;
        S.exp += n;
        let up = false;
        while (S.lv < D.MAX_LV && S.exp >= D.F.need(S.lv)) { S.exp -= D.F.need(S.lv); S.lv++; up = true; }
        if (S.lv >= D.MAX_LV) S.exp = 0;
        if (up) {
          restat(); S.hp = ST.hp; S.mp = ST.mp;
          float(G.px, G.py - 70, `레벨 업! Lv.${S.lv}`, '#FFE45C', true);
          Fx.levelUp(G.px, G.py); G.flash = 0.25;
          const learnable = Object.values(SKILLS).filter(s => s.lv === S.lv);
          if (learnable.length) say(`Lv.${S.lv} — 마법 학교에서 '${learnable[0].name}'을(를) 배울 수 있어요!`, 3.5);
          submitRank(); markDirty(true);
        }
      }
      function hitPlayer(dmg0, lvl) {
        if (G.inv > 0 || G.dead) return;
        const diff = lvl - S.lv, lvF = diff > 0 ? 1 + 0.08 * diff : Math.max(0.5, 1 + 0.05 * diff);
        let dmg = (dmg0 * rand(0.9, 1.1) - ST.def * 0.5) * lvF;
        if (G.shield) dmg *= 1 - G.shield.pow;
        dmg = Math.max(1, Math.round(dmg));
        S.hp -= dmg; G.inv = 0.35; G.lastHit = 0; G.hurt = 0.22; G.shake = Math.max(G.shake, 3);
        G.texts.push({ x: G.px + rand(-8, 8), y: G.py - 64, text: '-' + dmg, color: '#FF6A6E', t: 0, dmg: true });
        Fx.hit(G.px, G.py - 28, ['fire'], false);
        if (S.hp <= 0) { S.hp = 0; die(); }
      }
      function die() {
        G.dead = true; const loss = Math.round(D.F.need(S.lv) * (CFG.deathExpLoss || 0.05));
        S.exp = Math.max(0, S.exp - loss);
        openPanel('dead', { loss });
      }

      /* ---------- 마법 쓰기 ---------- */
      function nearest(range, from) {
        from = from || { x: G.px, y: G.py - 20 }; let best = null, bd = range;
        G.mons.forEach(m => { if (m.dead) return; const d = Math.hypot(m.x - from.x, m.y - m.spr.h / 2 - from.y); if (d < bd) { bd = d; best = m; } });
        return best;
      }
      function aimDir(range) {
        const m = nearest(range); if (m) { const a = Math.atan2(m.y - m.spr.h / 2 - (G.py - 20), m.x - G.px); return [Math.cos(a), Math.sin(a)]; }
        const l = Math.hypot(G.fx, G.fy) || 1; return [G.fx / l, G.fy / l];
      }
      function cast(slot) {
        const id = S.slots[slot]; if (!id) { say(`${slot + 1}번 칸이 비어 있어요. 마법 창(K)에서 넣어 주세요`); return; }
        const sk = skill(id); if (!sk) return;
        if (G.map.M.kind === 'village' && sk.kind !== 'heal' && sk.kind !== 'shield') { say('마을에서는 공격 마법을 쓸 수 없어요'); return; }
        if ((G.cds[id] || 0) > 0) return;
        if (S.mp < sk.mp) { say('마나가 부족해요 (E: 마나 포션)'); return; }
        S.mp -= sk.mp; G.cds[id] = sk.cd; Fx.castCircle(G.px, G.py, sk.els, !!sk.fusion);
        const els = sk.els, col = ELEM[els[0]].color, col2 = ELEM[els[els.length - 1]].light, base = ST.mag * sk.pow;
        const ox = G.px, oy = G.py - 22;
        if (sk.kind === 'bolt') {
          const [dx, dy] = aimDir(420), n = sk.count || 1, sp = 430 * (sk.speed || 1);
          for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.18; G.shots.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1, dmg: base, els, pierce: !!sk.pierce, hit: new Set(), r: 9, color: col, color2: col2, mine: true }); }
        } else if (sk.kind === 'nova') {
          const r = sk.radius || 120; Fx.nova(ox, oy, r, els); G.shake = Math.max(G.shake, r > 150 ? 6 : 3);
          G.mons.forEach(m => { if (!m.dead && Math.hypot(m.x - ox, m.y - m.spr.h / 2 - oy) < r + m.r) hitMon(m, base, els); });
        } else if (sk.kind === 'beam') {
          const [dx, dy] = aimDir(sk.len || 300), len = sk.len || 300, w = sk.w || 30;
          Fx.beam(ox, oy, dx, dy, len, w, els); G.shake = Math.max(G.shake, 3);
          G.mons.forEach(m => { if (m.dead) return; const mx = m.x - ox, my = m.y - m.spr.h / 2 - oy, along = mx * dx + my * dy, off = Math.abs(mx * dy - my * dx); if (along > -10 && along < len && off < w / 2 + m.r) hitMon(m, base, els); });
        } else if (sk.kind === 'rain') {
          const n = sk.count || 5, r = sk.radius || 60, targets = G.mons.filter(m => !m.dead && Math.hypot(m.x - ox, m.y - oy) < 420).sort((a, b) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy));
          for (let i = 0; i < n; i++) {
            const tg = targets[i % Math.max(1, targets.length)];
            const p = tg ? { x: tg.x + rand(-20, 20), y: tg.y - tg.spr.h / 2 + rand(-20, 20) } : { x: ox + G.fx * 160 + rand(-90, 90), y: oy + G.fy * 160 + rand(-70, 70) };
            G.fxs.push({ type: 'strike', x: p.x, y: p.y, r, t: -i * 0.1, dur: 0.54, done: false, dmg: base, els }); Fx.fall(p.x, p.y, r, els, i * 0.1);
          }
        } else if (sk.kind === 'pool') {
          const m = nearest(360), p = m ? { x: m.x, y: m.y - 8 } : { x: ox + G.fx * 120, y: G.py + G.fy * 120 };
          G.pools.push({ x: p.x, y: p.y, r: sk.radius || 90, t: 0, dur: sk.dur || 4, tick: 0, dmg: base * 0.35, els, color: col, color2: col2 });
        } else if (sk.kind === 'dash') {
          const [dx, dy] = aimDir(sk.len || 220); G.dash = { dx, dy, left: sk.len || 220, hit: new Set(), dmg: base, els, color: col }; G.inv = 0.45;
        } else if (sk.kind === 'heal') {
          const v = Math.round(ST.hp * sk.pow); S.hp = Math.min(ST.hp, S.hp + v); float(G.px, G.py - 70, '+' + v, '#3DDC84', true);
          Fx.heal(G.px, G.py - 28, sk.pow > 0.4);
        } else if (sk.kind === 'shield') {
          G.shield = { pow: sk.pow, t: sk.dur || 6, color: col, el: els[0] }; Fx.burst(G.px, G.py - 28, 20, Fx.pal(els[0]), { min: 60, max: 160, shape: 'star', lmin: 0.4, lmax: 0.7 }); say(`${sk.name}: 받는 피해 ${Math.round(sk.pow * 100)}% 감소`, 1.6);
        }
      }
      function basicAttack() {
        if (G.atkCd > 0 || G.dead) return;
        G.atkCd = 0.42;
        const staff = S.eq.weapon && ITEMS[S.eq.weapon].look === 'staff';
        const [dx, dy] = aimDir(staff ? 150 : 70);
        G.face = dx < 0 ? -1 : 1;
        Fx.slash(G.px, G.py - 24, dx, dy, staff);
        if (G.map.M.kind === 'village') return;
        if (staff) { G.shots.push({ x: G.px, y: G.py - 24, vx: dx * 380, vy: dy * 380, life: 0.42, dmg: ST.atk * 0.6 + ST.mag * 0.5, els: [], look: ['light'], pierce: false, hit: new Set(), r: 7, color: '#C8A8FF', color2: '#FFFFFF', mine: true }); return; }
        G.mons.forEach(m => {
          if (m.dead) return; const mx = m.x - G.px, my = m.y - m.spr.h / 2 - (G.py - 24), d = Math.hypot(mx, my);
          if (d < 58 + m.r && (d < 24 + m.r || (mx * dx + my * dy) / (d || 1) > 0.2)) hitMon(m, ST.atk, []);
        });
      }
      function usePotion(kind) {
        const tiers = POT_T, id = kind === 'hp'
          ? (tiers.map(t => 'hp' + t).filter(i => count(i) > 0).find(i => ITEMS[i].amount <= ST.hp - S.hp) || tiers.map(t => 'hp' + t).slice().reverse().find(i => count(i) > 0))
          : (tiers.map(t => 'mp' + t).filter(i => count(i) > 0).find(i => ITEMS[i].amount <= ST.mp - S.mp) || tiers.map(t => 'mp' + t).slice().reverse().find(i => count(i) > 0));
        if (!id) { say(kind === 'hp' ? '체력 포션이 없어요' : '마나 포션이 없어요'); return; }
        useItem(id);
      }
      function useItem(id) {
        const it = ITEMS[id]; if (!it || !count(id)) return;
        if (it.kind === 'hp') { if (S.hp >= ST.hp) { say('체력이 가득 찼어요'); return; } takeItem(id); S.hp = Math.min(ST.hp, S.hp + it.amount); float(G.px, G.py - 70, '+' + it.amount, '#3DDC84'); Fx.heal(G.px, G.py - 28, false); }
        else if (it.kind === 'mp') { if (S.mp >= ST.mp) { say('마나가 가득 찼어요'); return; } takeItem(id); S.mp = Math.min(ST.mp, S.mp + it.amount); float(G.px, G.py - 70, '+' + it.amount, '#6FA0FF'); Fx.burst(G.px, G.py - 28, 16, Fx.pal('water'), { min: 30, max: 90, up: -90, g: -40, shape: 'glow', lmin: 0.5, lmax: 0.9 }); }
        else if (it.kind === 'scroll') { if (G.map.M.kind === 'village' && S.map === S.home) { say('이미 마을이에요'); return; } takeItem(id); closePanel(); enter(S.home, 'door'); }
        markDirty();
      }

      /* ---------- 움직임 ---------- */
      function canStand(map, x, y) { return !solidAt(map, x - 9, y - 4) && !solidAt(map, x + 9, y - 4) && !solidAt(map, x - 9, y) && !solidAt(map, x + 9, y); }
      function movePlayer(dx, dy) {
        const map = G.map;
        if (dx && canStand(map, G.px + dx, G.py)) G.px += dx;
        if (dy && canStand(map, G.px, G.py + dy)) G.py += dy;
        G.px = clamp(G.px, 4, map.w * TS - 4); G.py = clamp(G.py, 8, map.h * TS - 2);
      }
      function moveMon(m, dx, dy) {
        const map = G.map, ok = (x, y) => !solidAt(map, x - 8, y - 2) && !solidAt(map, x + 8, y - 2) && !solidAt(map, x, y);
        if (ok(m.x + dx, m.y)) m.x += dx; else m.wt = 0;
        if (ok(m.x, m.y + dy)) m.y += dy; else m.wt = 0;
      }

      /* ---------- 한 틱 ---------- */
      function update(dt) {
        const map = G.map, M = map.M;
        S.play += dt; G.saveT += dt; G.srvT += dt; if (msgT > 0 && (msgT -= dt) <= 0) msgEl.hidden = true;
        G.atkCd -= dt; G.inv -= dt; G.lastHit += dt;
        G.shake = Math.max(0, G.shake * Math.pow(0.002, dt) - dt); G.hurt = Math.max(0, G.hurt - dt); G.flash = Math.max(0, G.flash - dt); if (G.title) G.title.t += dt;
        Fx.updateParts(dt, { x: G.px, y: G.py }); Fx.updateFx(dt); Fx.ambient(M.region, dt, W, H, cam);
        Object.keys(G.cds).forEach(k => { G.cds[k] -= dt; });
        if (G.shield && (G.shield.t -= dt) <= 0) G.shield = null;
        // 자연 회복
        const reg = (M.kind === 'village' ? 3 : 1) * (G.lastHit > 5 ? 1 : 0.25);
        S.hp = Math.min(ST.hp, S.hp + ST.hp * 0.012 * reg * dt); S.mp = Math.min(ST.mp, S.mp + ST.mp * 0.02 * reg * dt);

        // 입력 → 이동
        let mx = 0, my = 0; const K = G.keys;
        if (K.ArrowLeft || K.KeyA) mx--; if (K.ArrowRight || K.KeyD) mx++; if (K.ArrowUp || K.KeyW) my--; if (K.ArrowDown || K.KeyS) my++;
        if (G.joy && G.joy.on) { mx = G.joy.vx; my = G.joy.vy; }
        const ml = Math.hypot(mx, my);
        if (G.dash) {
          const step = Math.min(G.dash.left, 1100 * dt); movePlayer(G.dash.dx * step, G.dash.dy * step); G.dash.left -= step;
          G.mons.forEach(m => { if (!m.dead && !G.dash.hit.has(m) && Math.hypot(m.x - G.px, m.y - m.spr.h / 2 - (G.py - 20)) < 40 + m.r) { G.dash.hit.add(m); hitMon(m, G.dash.dmg, G.dash.els); } });
          if (G.dash.left <= 0) G.dash = null;
        } else if (ml > 0.15) {
          const sp = 150 * (1 + ST.spd / 100) * dt * Math.min(1, ml);
          G.fx = mx / ml; G.fy = my / ml; if (Math.abs(mx) > 0.2) G.face = mx < 0 ? -1 : 1;
          movePlayer(G.fx * sp, G.fy * sp); G.moving = true; G.walk += dt; if (Math.floor(G.walk * 8) !== Math.floor((G.walk - dt) * 8)) Fx.dust(G.px, G.py, M.region === 5 ? 'rgba(255,255,255,.8)' : 'rgba(255,240,210,.55)');
        } else { G.moving = false; G.walk = 0; }
        if (K.Space || K.KeyJ || G.btnDown.atk) basicAttack();

        // 출구
        if (G.px < 6 && map.exitL) { enter(map.exitL, 'R'); return; }
        if (G.px > map.w * TS - 6 && map.exitR) { enter(map.exitR, 'L'); return; }
        // 건물 문
        //  문 칸에 들어가거나, 문 바로 아래 칸에서 위(↑)로 걸으면 들어감
        const ty = Math.floor((G.py - 4) / TS);
        const door = map.doors.find(b => Math.abs((b.door.x + 0.5) * TS - G.px) < 30 && (ty === b.door.y || (ty === b.door.y + 1 && my < -0.3)));
        if (door && G.onDoor !== door) { G.onDoor = door; openPanel(door.type); return; }
        if (!door) G.onDoor = null;

        // 몬스터
        G.mons.forEach(m => {
          if (m.dead) { if ((m.respawn -= dt) <= 0) { const n = makeMon(m.def, m.lvl, m.boss); Object.assign(m, n); } return; }
          m.flash -= dt; m.cd -= dt; if (m.lunge > 0) m.lunge -= dt; if (m.knock) m.knock *= Math.pow(0.001, dt);
          if (m.burn) { m.burn.t -= dt; m.burn.tick -= dt; if (m.burn.tick <= 0) { m.burn.tick = 0.5; m.hp -= Math.max(1, Math.round(m.burn.dps * 0.5)); float(m.x, m.y - m.spr.h, Math.max(1, Math.round(m.burn.dps * 0.5)), '#FF9A3D'); if (m.hp <= 0) { killMon(m); return; } } if (m.burn.t <= 0) m.burn = null; }
          if (m.stun > 0) { m.stun -= dt; return; }
          const slowF = m.slow > 0 ? 0.5 : 1; if (m.slow > 0) m.slow -= dt;
          const dx = G.px - m.x, dy = G.py - m.y, d = Math.hypot(dx, dy), home = Math.hypot(m.x - m.hx, m.y - m.hy);
          if (m.kind === 'aggro' || m.kind === 'shoot' || m.kind === 'boss') { if (d < (m.boss ? 320 : 200)) m.aggro = true; }
          if (m.aggro && (d > 520 || home > 640)) { m.aggro = false; }
          if (G.dead) m.aggro = false;
          const sp = m.spd * slowF * dt;
          if (m.aggro) {
            if (m.kind === 'shoot') {
              const want = 170; if (d > want + 30) moveMon(m, dx / d * sp, dy / d * sp); else if (d < want - 40) moveMon(m, -dx / d * sp, -dy / d * sp);
              if (m.cd <= 0 && d < 300) { m.cd = 2.2; const a = Math.atan2(G.py - 24 - (m.y - m.spr.h / 2), G.px - m.x); G.shots.push({ x: m.x, y: m.y - m.spr.h / 2, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 1.6, dmg: m.atk * 0.8, lvl: m.lvl, r: 6, color: m.def.colors.d, color2: '#FFFFFF', mine: false, monEl: 'dark' }); m.lunge = 0.2; }
            } else {
              if (d > m.r + 12) moveMon(m, dx / d * sp, dy / d * sp);
              if (d < m.r + 22 && m.cd <= 0) { m.cd = m.boss ? 1.4 : 1.2; m.lunge = 0.25; hitPlayer(m.atk, m.lvl); }
              if (m.boss) {
                if (!m.slam && m.cd <= 0.2 && Math.random() < 0.01 + dt) m.slam = { t: 0, x: m.x, y: m.y - 20 };
                if (m.slam) { m.slam.t += dt; if (m.slam.t >= 0.9) { if (Math.hypot(G.px - m.slam.x, G.py - 20 - m.slam.y) < 130) hitPlayer(m.atk * 1.5, m.lvl); Fx.nova(m.slam.x, m.slam.y, 130, ['fire', 'earth']); G.shake = Math.max(G.shake, 9); m.slam = null; m.cd = 2.2; } }
              }
            }
          } else {
            m.wt -= dt;
            if (m.wt <= 0) { m.wt = rand(1.5, 3.5); const a = Math.random() * Math.PI * 2, go = Math.random() < 0.6; m.wx = go ? Math.cos(a) : 0; m.wy = go ? Math.sin(a) : 0; if (home > 140) { const b = Math.atan2(m.hy - m.y, m.hx - m.x); m.wx = Math.cos(b); m.wy = Math.sin(b); } }
            moveMon(m, m.wx * sp * 0.5, m.wy * sp * 0.5);
          }
        });
        // 탄
        G.shots = G.shots.filter(s => {
          s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; Fx.trail(s, dt);
          if (s.life <= 0 || solidAt(map, s.x, s.y + 16) && map.at(Math.floor(s.x / TS), Math.floor((s.y + 16) / TS)) !== 4) return false;
          if (s.mine) {
            for (const m of G.mons) {
              if (m.dead || s.hit.has(m)) continue;
              if (Math.hypot(m.x - s.x, m.y - m.spr.h / 2 - s.y) < m.r + s.r) { s.hit.add(m); hitMon(m, s.dmg, s.els); if (!s.pierce) return false; }
            }
          } else if (Math.hypot(G.px - s.x, G.py - 24 - s.y) < 16 + s.r) { hitPlayer(s.dmg, s.lvl); return false; }
          return true;
        });
        // 장판
        G.pools = G.pools.filter(p => {
          p.t += dt; p.tick -= dt;
          if (p.tick <= 0) { p.tick = 0.5; G.mons.forEach(m => { if (!m.dead && Math.hypot(m.x - p.x, m.y - 8 - p.y) < p.r + m.r) hitMon(m, p.dmg, p.els, { noStun: true }); }); }
          return p.t < p.dur;
        });
        // 효과 (떨어지는 마법은 시간이 되면 피해)
        G.fxs = G.fxs.filter(f => {
          f.t += dt;
          if (f.type === 'strike' && !f.done && f.t >= f.dur * 0.6) { f.done = true; G.mons.forEach(m => { if (!m.dead && Math.hypot(m.x - f.x, m.y - m.spr.h / 2 - f.y) < f.r + m.r) hitMon(m, f.dmg, f.els); }); }
          return f.t < f.dur;
        });
        G.texts = G.texts.filter(t => (t.t += dt) < 1.1);
        if (G.saveT > (CFG.autosaveSec || 20)) save(false);
        if (G.srvT > (CFG.serverSaveSec || 60) && G.dirty) save(true);
      }

      /* ---------- 그리기 (v40 그래픽 강화) ----------
       *  땅 → 물결 → 바닥 효과(마법진·장판·예고) → 나무·건물·몬스터·나(아래쪽이 앞) → 탄 → 빛나는 효과·입자 → 글자
       *  → 지역 분위기(날씨·안개·어둠) → 화면 흔들림 · 맞으면 붉은 번쩍 → HUD(초상화·막대·작은 지도·마법 칸) */
      let cam = { x: 0, y: 0 };
      const glowLights = [];
      function draw(now) {
        const map = G.map, c = ctx;
        cam.x = clamp(G.px - W / 2, 0, Math.max(0, map.w * TS - W)); cam.y = clamp(G.py - 30 - H / 2, 0, Math.max(0, map.h * TS - H));
        let sx = 0, sy = 0; if (G.shake > 0.2) { sx = rand(-G.shake, G.shake); sy = rand(-G.shake, G.shake); }
        const cx = Math.round(cam.x + sx), cy = Math.round(cam.y + sy);
        c.fillStyle = map.R.sky; c.fillRect(0, 0, W, H);
        c.drawImage(map.ground, clamp(cx, 0, map.ground.width - W), clamp(cy, 0, map.ground.height - H), W, H, clamp(cx, 0, map.ground.width - W) - cx, clamp(cy, 0, map.ground.height - H) - cy, W, H);
        c.save(); c.translate(-cx, -cy);
        const view = { x: cx, y: cy, w: W, h: H };
        // 물결 (보이는 물 칸만)
        const lava = map.R.water === '#FF5A2A';
        c.globalCompositeOperation = lava ? 'lighter' : 'source-over';
        for (const [tx, ty] of map.water) {
          const X = tx * TS, Y = ty * TS; if (X < cx - TS || X > cx + W || Y < cy - TS || Y > cy + H) continue;
          const ph = now / (lava ? 700 : 500) + tx * 0.7 + ty * 1.3;
          c.globalAlpha = lava ? 0.25 + 0.2 * Math.sin(ph) : 0.35 + 0.25 * Math.sin(ph);
          c.fillStyle = lava ? '#FFB13D' : '#FFFFFF';
          c.fillRect(X + 4 + ((now / 40 + tx * 9) % 20), Y + 12 + Math.sin(ph) * 3, 8, 2);
          c.fillRect(X + 18 - ((now / 55 + ty * 7) % 16), Y + 22 + Math.cos(ph) * 2, 6, 2);
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        // 출구 화살표 (움직이며 빛남)
        const arrows = (X, dir) => { for (let i = 0; i < 3; i++) { const yy = (map.mid - 0.5) * TS + i * 22, off = ((now / 300 + i * 0.3) % 1) * 14 * dir; c.globalAlpha = 0.5 + 0.4 * Math.sin(now / 200 + i); c.fillStyle = '#FFF6C2'; c.beginPath(); c.moveTo(X + off, yy); c.lineTo(X + off + dir * 14, yy + 7); c.lineTo(X + off, yy + 14); c.fill(); } c.globalAlpha = 1; };
        if (map.exitL && cx < 80) arrows(14, -1); if (map.exitR && cx > map.w * TS - W - 80) arrows(map.w * TS - 14, 1);
        // 바닥 효과
        Fx.drawFx(c, true, now);
        G.pools.forEach(p => Fx.drawPool(c, p, now));
        G.mons.forEach(m => { if (m.slam) Fx.slamWarn(c, m.slam.x, m.slam.y + 20, 130, Math.min(1, m.slam.t / 0.9), now); });
        // 나무·건물·몬스터·나 — 아래쪽(sy)이 큰 것이 앞
        const list = [];
        for (const o of map.objs) { if (o.x > cx + W + 40 || o.x + o.img.width < cx - 40 || o.y > cy + H + 40 || o.y + o.img.height < cy - 40) continue; list.push({ y: o.sy, o }); }
        G.mons.forEach(m => { if (!m.dead) list.push({ y: m.y, m }); });
        list.push({ y: G.py, me: true }); list.sort((a, b) => a.y - b.y);
        list.forEach(e => (e.me ? drawMe(c, now) : e.m ? drawMon(c, e.m, now) : drawObj(c, e.o, now)));
        // 분수 물보라
        if (map.fountain && Math.random() < 0.5) Fx.emit({ x: map.fountain.x + rand(-4, 4), y: map.fountain.y, vx: rand(-50, 50), vy: rand(-150, -90), g: 420, life: 0.7, size: 3, color: pick(['#FFFFFF', '#BDE8FF', '#8AD0FF']), shape: 'drop', add: false });
        // 탄
        G.shots.forEach(s => Fx.drawShot(c, s, now));
        // 빛나는 효과 · 입자
        Fx.drawFx(c, false, now);
        Fx.drawParts(c, view);
        // 글자 (톡 튀어나왔다가 올라가며 사라짐)
        c.textAlign = 'center'; c.textBaseline = 'middle';
        G.texts.forEach(t => {
          const k = t.t / 1.1, pop = t.t < 0.12 ? 0.6 + t.t / 0.12 * 0.7 : t.t < 0.22 ? 1.3 - (t.t - 0.12) / 0.1 * 0.3 : 1, size = (t.big ? 22 : t.dmg ? 17 : 14) * pop;
          c.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.5) * 2); c.font = Math.round(size) + 'px "Jua", "Malgun Gothic", sans-serif';
          const y = t.y - t.t * 40; c.lineWidth = 4; c.strokeStyle = '#1D2340'; c.strokeText(t.text, t.x, y); c.fillStyle = t.color; c.fillText(t.text, t.x, y);
        });
        c.globalAlpha = 1;
        // 출구 이름
        c.font = '13px "Jua", "Malgun Gothic", sans-serif';
        const ex = (id, x, al) => { const M = MAPBY[id]; const t = (al === 'left' ? '← ' : '') + (M.kind === 'village' ? M.name : `${M.no}. ${M.name} (Lv.${M.rec})`) + (al === 'right' ? ' →' : ''), y = (map.mid + 3.4) * TS; c.textAlign = al; c.lineWidth = 3; c.strokeStyle = '#1D2340'; c.strokeText(t, x, y); c.fillStyle = '#FFFFFF'; c.fillText(t, x, y); };
        if (map.exitL && cx <= 4) ex(map.exitL, 8, 'left');
        if (map.exitR && cx >= map.w * TS - W - 4) ex(map.exitR, map.w * TS - 8, 'right');
        c.restore();
        // 지역 분위기 (어두운 지역은 나·빛나는 것 둘레만 밝게)
        glowLights.length = 0;
        glowLights.push({ x: G.px - cx, y: G.py - 30 - cy, r: 190, col: '#FFF6C2' });
        map.glows.forEach(g => { const x = g.x - cx, y = g.y - cy; if (x > -100 && x < W + 100 && y > -100 && y < H + 100) glowLights.push({ x, y, r: g.r, col: g.col, a: 0.85 }); });
        G.shots.forEach(s => { if (s.mine) glowLights.push({ x: s.x - cx, y: s.y - cy, r: 60, col: Fx.pal((s.els && s.els[0]) || 'light')[2] }); });
        G.pools.forEach(p => glowLights.push({ x: p.x - cx, y: p.y - cy, r: p.r * 1.2 }));
        Fx.drawAmbient(c, map.R === D.REGIONS[map.M.region] ? map.M.region : 0, W, H, { x: cx, y: cy }, now, glowLights);
        if (G.hurt > 0) { c.fillStyle = 'rgba(255,40,60,' + (G.hurt * 1.2).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
        if (G.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + (G.flash * 1.5).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
        drawHud(c, now);
        if (G.touch) drawTouch(c);
      }
      function drawObj(c, o, now) {
        // Meshy 그림이 있으면: 장애물은 칸 아래 가운데에 세움, 건물은 건물 칸 폭에 맞춤 (+ 이름표)
        const alt = o.alt && imgOk(o.alt), bim = o.b && imgOk('bld_' + o.b.type);
        if (bim) {
          const b = o.b, ww = b.w * TS + (b.type === 'castle' ? 90 : 34), hh = bim.naturalHeight * ww / bim.naturalWidth, cx0 = (b.x + b.w / 2) * TS, by = (b.y + b.h) * TS + 6;
          c.drawImage(bim, Math.round(cx0 - ww / 2), Math.round(by - hh), Math.round(ww), Math.round(hh));
          const label = b.type === 'castle' ? '왕성 · 퀘스트' : b.name; c.font = '13px "Jua", "Malgun Gothic", sans-serif'; const lw = c.measureText(label).width + 20, ly = by - hh - 4;
          c.fillStyle = 'rgba(10,14,36,.82)'; c.fillRect(cx0 - lw / 2, ly - 11, lw, 22); c.fillStyle = '#FFD23F'; c.fillRect(cx0 - lw / 2, ly + 10, lw, 2);
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = b.type === 'potion' ? '#FF9AA0' : b.type === 'school' ? '#D8B8FF' : b.type === 'chief' ? '#9AF0B0' : '#FFE45C'; c.fillText(label, cx0, ly + 1);
          return;
        }
        if (alt) {
          const im = alt, x = o.tx * TS + 16 - im.naturalWidth / 2, y = (o.ty + 1) * TS - im.naturalHeight + 2, tree = im.naturalHeight > 56;
          if (tree) { const sway = Math.sin(now / 900 + o.tx * 0.7) * 0.012; c.save(); c.translate(x + im.naturalWidth / 2, y + im.naturalHeight); c.transform(1, 0, sway, 1, 0, 0); c.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight); c.restore(); }
          else c.drawImage(im, Math.round(x), Math.round(y));
        } else if (o.kind === 'tree' || o.kind === 'blossom' || o.kind === 'pine' || o.kind === 'snowpine') {   // 바람에 살짝 흔들림
          const sway = Math.sin(now / 900 + o.tx * 0.7) * 0.012;
          c.save(); c.translate(o.x + 32, o.y + 74); c.transform(1, 0, sway, 1, 0, 0); c.drawImage(o.img, -32, -74); c.restore();
        } else c.drawImage(o.img, o.x, o.y);
        if (o.kind === 'crystal') { c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, o.tx * TS + 16, o.ty * TS + 6, 40, '#B08AFF', 0.35 + 0.15 * Math.sin(now / 400 + o.tx)); c.restore(); }
      }
      function drawMe(c, now) {
        const fr = G.moving ? [1, 0, 3, 0][Math.floor(G.walk * 8) % 4] : 0;
        const img = avatarSprite(Hub.user ? Hub.user.avatar : AV.normalize({}), S.eq, S.hide, fr);
        const s = img.width > AV.size.w ? 1 : 2, w = img.width * s, h = img.height * s, bob = G.moving ? 0 : Math.round(Math.sin(now / 400)), x = Math.round(G.px - w / 2), y = Math.round(G.py - h + 2 + bob);
        G.meImg = { img, x, y, w, h };
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(G.px, G.py, 16, 5, 0, 0, Math.PI * 2); c.fill();
        if (G.dash) Fx.afterimage(img, x, y, w, h, G.face < 0, Fx.pal(G.dash.els[0])[2]);
        if (G.inv > 0 && !G.dash && Math.floor(now / 60) % 2) c.globalAlpha = 0.45;
        if (G.face < 0) { c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(img, 0, 0, w, h); c.restore(); } else c.drawImage(img, x, y, w, h);
        c.globalAlpha = 1;
        // 장비 단계 빛 (정예 무기)
        const wp = S.eq.weapon && ITEMS[S.eq.weapon]; if (wp && wp.rare && !S.hide) { c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, G.px + (G.face < 0 ? -14 : 14), y + 14, 18, D.TIER[wp.tier].gem, 0.35 + 0.2 * Math.sin(now / 200)); c.restore(); }
        if (G.shield) Fx.drawShield(c, G.px, G.py - 28, now, G.shield.el, G.shield.t);
        c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
        const nm = (Hub.user ? Hub.user.nickname : '손님') + ' Lv.' + S.lv; c.strokeText(nm, G.px, y - 6); c.fillStyle = '#FFE45C'; c.fillText(nm, G.px, y - 6);
      }
      function drawMon(c, m, now) {
        const sp = m.spr, moving = m.aggro || Math.abs(m.wx) + Math.abs(m.wy) > 0.1;
        const ph = now / (moving ? 110 : 260) + m.hx, hop = moving ? Math.abs(Math.sin(ph)) * (m.boss ? 6 : 5) : 0, sq = moving ? 1 + Math.cos(ph * 2) * 0.05 : 1 + Math.sin(ph) * 0.04;
        const lunge = m.lunge > 0 ? Math.sin(m.lunge / 0.25 * Math.PI) * 10 : 0, la = Math.atan2(G.py - m.y, G.px - m.x);
        const w = sp.w * (2 - sq), h = sp.h * sq, bx = m.x + Math.cos(la) * lunge + (m.knock || 0), x = Math.round(bx - w / 2), y = Math.round(m.y - h - hop + Math.sin(la) * lunge * 0.5);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(m.x, m.y, sp.w * 0.38 * (1 - hop / 30), sp.w * 0.12, 0, 0, Math.PI * 2); c.fill();
        if (m.boss) { c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, m.x, m.y - sp.h / 2, sp.w * 0.9, m.def.colors.d || '#FF3D4A', 0.35 + 0.15 * Math.sin(now / 300)); c.restore(); if (Math.random() < 0.3) Fx.emit({ x: m.x + rand(-sp.w / 2, sp.w / 2), y: m.y - rand(0, sp.h), vx: 0, vy: rand(-60, -20), life: 0.8, size: rand(3, 5), color: m.def.colors.d || '#FF3D4A', shape: 'glow', add: true }); }
        const flip = G.px < m.x;
        c.save(); if (flip) { c.translate(x + w, y); c.scale(-1, 1); } else c.translate(x, y);
        c.drawImage(m.flash > 0 ? sp.flash : sp.img, 0, 0, w, h); c.restore();
        if (m.stun > 0) for (let i = 0; i < 3; i++) { const a = now / 150 + i * 2.1; c.fillStyle = '#FFE45C'; c.fillRect(m.x + Math.cos(a) * 14 - 2, y - 6 + Math.sin(a) * 4, 4, 4); }
        if (m.slow > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5; c.drawImage(Fx.glow('#5AB8F5', 24), m.x - 24, m.y - sp.h / 2 - 24); c.restore(); if (Math.random() < 0.1) Fx.emit({ x: m.x + rand(-10, 10), y: m.y - rand(0, sp.h), vx: 0, vy: 20, life: 0.5, size: 2, color: '#BDE8FF', shape: 'star', add: true }); }
        if (m.burn && Math.random() < 0.4) Fx.emit({ x: m.x + rand(-sp.w / 3, sp.w / 3), y: m.y - rand(4, sp.h * 0.8), vx: rand(-10, 10), vy: rand(-80, -40), life: 0.5, size: rand(3, 5), color: pick(['#FFE45C', '#FF9A3D', '#E8402A']), shape: 'glow', add: true });
        if ((m.hp < m.max || m.aggro) && !m.boss) {
          const bw = 36, hpw = bw * Math.max(0, m.hp / m.max); m.hpShow = m.hpShow == null ? hpw : m.hpShow + (hpw - m.hpShow) * 0.1;
          c.fillStyle = '#0A0E24'; c.fillRect(m.x - bw / 2 - 1, y - 9, bw + 2, 6); c.fillStyle = '#FFE45C'; c.fillRect(m.x - bw / 2, y - 8, m.hpShow, 4); c.fillStyle = '#FF5A5F'; c.fillRect(m.x - bw / 2, y - 8, hpw, 4); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(m.x - bw / 2, y - 8, hpw, 1);
          c.font = '11px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
          const t = m.name + ' Lv.' + m.lvl; c.strokeText(t, m.x, y - 13); c.fillStyle = m.lvl > S.lv + 3 ? '#FF8A8E' : '#FFFFFF'; c.fillText(t, m.x, y - 13);
        }
      }
      // HUD 도구
      function panelBox(c, x, y, w, h, r) {
        const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(30,38,84,.92)'); g.addColorStop(1, 'rgba(12,16,40,.92)');
        c.fillStyle = '#0A0E24'; rr(c, x - 2, y - 2, w + 4, h + 4, r + 2); c.fill();
        c.fillStyle = g; rr(c, x, y, w, h, r); c.fill(); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; rr(c, x + 1, y + 1, w - 2, h - 2, r); c.stroke();
      }
      function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
      function bar(c, x, y, w, h, v, cols, label, ghost) {
        c.fillStyle = '#0A0E24'; rr(c, x - 2, y - 2, w + 4, h + 4, 4); c.fill(); c.fillStyle = '#1E2650'; c.fillRect(x, y, w, h);
        if (ghost != null && ghost > v) { c.fillStyle = '#FFF3B0'; c.fillRect(x, y, Math.round(w * clamp(ghost, 0, 1)), h); }
        const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
        c.fillStyle = g; c.fillRect(x, y, Math.round(w * clamp(v, 0, 1)), h); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y + 1, Math.round(w * clamp(v, 0, 1)), Math.max(1, h / 4));
        if (label) { c.font = '11px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = 'rgba(10,14,36,.8)'; c.strokeText(label, x + w / 2, y + h / 2 + 1); c.fillStyle = '#FFFFFF'; c.fillText(label, x + w / 2, y + h / 2 + 1); }
      }
      let portrait = null, portraitKey = '';
      function getPortrait() {
        const av = Hub.user ? Hub.user.avatar : AV.normalize({}), k = JSON.stringify(av);
        if (portrait && portraitKey === k) return portrait;
        const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
        AV.draw(x, av, 0, 0, 4, { crop: 'bust' }); portraitKey = k; return (portrait = cv);
      }
      function drawHud(c, now) {
        const M = G.map.M;
        // 왼쪽 위: 초상화 + 이름·레벨 + 체력·마나 + 골드
        panelBox(c, 8, 8, 270, 82, 10);
        c.fillStyle = '#0A0E24'; rr(c, 14, 14, 70, 70, 8); c.fill();
        const pg = c.createLinearGradient(0, 16, 0, 82); pg.addColorStop(0, '#5C86FF'); pg.addColorStop(1, '#2F3FA0'); c.fillStyle = pg; rr(c, 16, 16, 66, 66, 7); c.fill();
        c.drawImage(getPortrait(), 17, 17, 64, 64);
        c.fillStyle = '#FFD23F'; rr(c, 12, 70, 36, 18, 5); c.fill(); c.fillStyle = '#1D2340'; c.font = '12px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Lv.' + S.lv, 30, 80);
        c.font = '14px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = '#FFFFFF'; c.fillText(Hub.user ? Hub.user.nickname : '손님', 92, 28);
        c.textAlign = 'right'; c.fillStyle = '#FFD23F'; c.fillText(fmtN(S.gold) + ' G', 270, 28);
        c.fillStyle = '#8A5A10'; c.beginPath(); c.arc(270 - c.measureText(fmtN(S.gold) + ' G').width - 10, 23, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#FFD23F'; c.beginPath(); c.arc(270 - c.measureText(fmtN(S.gold) + ' G').width - 10, 23, 4.5, 0, Math.PI * 2); c.fill();
        G.hpGhost = G.hpGhost == null ? S.hp / ST.hp : Math.max(S.hp / ST.hp, G.hpGhost - 0.4 / 60);
        const low = S.hp / ST.hp < 0.3 && Math.floor(now / 250) % 2;
        bar(c, 92, 36, 178, 16, S.hp / ST.hp, low ? ['#FFB0B0', '#FF5A5F'] : ['#FF7A7E', '#D2343A'], `체력 ${fmtN(S.hp)} / ${fmtN(ST.hp)}`, G.hpGhost);
        bar(c, 92, 58, 178, 12, S.mp / ST.mp, ['#7FA0FF', '#2F55D9'], `마나 ${fmtN(S.mp)} / ${fmtN(ST.mp)}`);
        // 맨 아래 경험치 막대
        const ex = S.lv >= D.MAX_LV ? 1 : S.exp / D.F.need(S.lv);
        c.fillStyle = 'rgba(10,14,36,.85)'; c.fillRect(0, H - 8, W, 8); const eg = c.createLinearGradient(0, 0, W, 0); eg.addColorStop(0, '#FFD23F'); eg.addColorStop(1, '#FFF3B0'); c.fillStyle = eg; c.fillRect(0, H - 7, W * ex, 6);
        for (let i = 1; i < 10; i++) { c.fillStyle = 'rgba(10,14,36,.6)'; c.fillRect(W * i / 10, H - 7, 1, 6); }
        c.font = '10px "Jua", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#0A0E24'; const et = S.lv >= D.MAX_LV ? '만렙!' : `경험치 ${(ex * 100).toFixed(1)}%`; c.strokeText(et, W - 6, H - 11); c.fillStyle = '#FFF3B0'; c.fillText(et, W - 6, H - 11);
        // 위 가운데: 지도 이름
        const t = M.kind === 'village' ? M.name : `사냥터 ${M.no}. ${M.name}`, rec = M.kind === 'village' ? '마을' : `권장 Lv.${M.rec}`;
        c.font = '16px "Jua", "Malgun Gothic", sans-serif'; const tw = Math.max(c.measureText(t).width, 80) + 30;
        panelBox(c, W / 2 - tw / 2, 8, tw, 38, 10);
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText(t, W / 2, 21);
        c.font = '11px "Jua", sans-serif'; c.fillStyle = M.kind === 'village' ? '#9AE6FF' : M.rec > S.lv + 6 ? '#FF8A8E' : M.rec > S.lv + 2 ? '#FFD23F' : '#9AF0B0'; c.fillText(rec + (M.kind !== 'village' && M.rec > S.lv + 6 ? ' · 위험!' : ''), W / 2, 37);
        // 오른쪽 위: 작은 지도
        drawMini(c, now);
        // 보스 체력 (큰 막대)
        const boss = G.mons.find(m => m.boss && !m.dead && (m.aggro || Math.hypot(m.x - G.px, m.y - G.py) < 420));
        if (boss) {
          const bw = 420, bx = W / 2 - bw / 2, by = 54; panelBox(c, bx - 8, by - 4, bw + 16, 34, 8);
          c.font = '13px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#FF8A8E'; c.fillText('보스 ' + boss.name + ' Lv.' + boss.lvl, bx, by + 7);
          c.textAlign = 'right'; c.fillStyle = '#FFFFFF'; c.fillText(Math.ceil(boss.hp / boss.max * 100) + '%', bx + bw, by + 7);
          boss.hpShow = boss.hpShow == null ? boss.hp / boss.max : Math.max(boss.hp / boss.max, boss.hpShow - 0.3 / 60);
          bar(c, bx, by + 16, bw, 9, boss.hp / boss.max, ['#FF5A5F', '#8A1E22'], null, boss.hpShow);
        }
        // 지도 들어올 때 큰 제목
        if (G.title && G.title.t < 3) {
          const k = G.title.t, a = k < 0.4 ? k / 0.4 : k > 2.3 ? 1 - (k - 2.3) / 0.7 : 1;
          c.save(); c.globalAlpha = clamp(a, 0, 1); c.textAlign = 'center'; c.textBaseline = 'middle';
          const g = c.createLinearGradient(W / 2 - 260, 0, W / 2 + 260, 0); g.addColorStop(0, 'rgba(10,14,36,0)'); g.addColorStop(0.5, 'rgba(10,14,36,.75)'); g.addColorStop(1, 'rgba(10,14,36,0)');
          c.fillStyle = g; c.fillRect(W / 2 - 260, H * 0.3 - 40, 520, 84);
          c.fillStyle = '#FFD23F'; c.fillRect(W / 2 - 160 * a, H * 0.3 - 34, 320 * a, 2); c.fillRect(W / 2 - 160 * a, H * 0.3 + 38, 320 * a, 2);
          c.font = '14px "Jua", "Malgun Gothic", sans-serif'; c.fillStyle = '#FFE9A8'; c.fillText(G.title.sub, W / 2, H * 0.3 - 16);
          c.font = '32px "Jua", "Malgun Gothic", sans-serif'; c.lineWidth = 5; c.strokeStyle = '#0A0E24'; c.strokeText(G.title.text, W / 2, H * 0.3 + 14); c.fillStyle = '#FFFFFF'; c.fillText(G.title.text, W / 2, H * 0.3 + 14);
          c.restore();
        }
        if (G.touch) return;
        // 아래 가운데: 마법 4칸 + 포션 2칸
        const x0 = W / 2 - 186, y0 = H - 66;
        panelBox(c, x0 - 8, y0 - 8, 372 + 16, 64, 12);
        for (let i = 0; i < 4; i++) skillSlot(c, x0 + i * 58, y0, 50, i, now);
        potionSlot(c, x0 + 4 * 58 + 14, y0, 50, 'hp', 'Q'); potionSlot(c, x0 + 5 * 58 + 14, y0, 50, 'mp', 'E');
      }
      function drawMini(c, now) {
        const map = G.map, mw = 150, k = mw / map.w, mh = Math.round(map.h * k), x0 = W - mw - 14, y0 = 12;
        panelBox(c, x0 - 4, y0 - 4, mw + 8, mh + 8, 6);
        c.save(); c.globalAlpha = 0.9; c.imageSmoothingEnabled = false; c.drawImage(map.mini, x0, y0, mw, mh); c.restore();
        G.mons.forEach(m => { if (m.dead) return; c.fillStyle = m.boss ? '#FF3D4A' : m.aggro ? '#FF8A3D' : '#FFD8D8'; const s = m.boss ? 5 : 3; c.fillRect(x0 + m.x / TS * k - s / 2, y0 + m.y / TS * k - s / 2, s, s); });
        map.buildings.forEach(b => { c.fillStyle = '#FFD27A'; c.fillRect(x0 + (b.door.x + 0.5) * k - 2, y0 + (b.door.y + 0.5) * k - 2, 4, 4); });
        const bl = Math.floor(now / 300) % 2; c.fillStyle = bl ? '#FFFFFF' : '#3DDC84'; c.fillRect(x0 + G.px / TS * k - 3, y0 + G.py / TS * k - 3, 6, 6); c.strokeStyle = '#0A0E24'; c.lineWidth = 1; c.strokeRect(x0 + G.px / TS * k - 3, y0 + G.py / TS * k - 3, 6, 6);
        c.strokeStyle = 'rgba(255,255,255,.6)'; c.strokeRect(x0 + cam.x / TS * k, y0 + cam.y / TS * k, W / TS * k, H / TS * k);
      }
      function skillSlot(c, x, y, s, i, now) {
        const id = S.slots[i], sk = skill(id);
        c.fillStyle = '#0A0E24'; rr(c, x - 1, y - 1, s + 2, s + 2, 7); c.fill(); c.fillStyle = '#1A2148'; rr(c, x, y, s, s, 6); c.fill();
        if (sk) {
          c.save(); rr(c, x + 1, y + 1, s - 2, s - 2, 5); c.clip(); c.drawImage(Fx.icon(sk, 48), x + 1, y + 1, s - 2, s - 2);
          const cd = G.cds[id] || 0;
          if (cd > 0) { c.fillStyle = 'rgba(10,14,36,.72)'; c.beginPath(); c.moveTo(x + s / 2, y + s / 2); c.arc(x + s / 2, y + s / 2, s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / sk.cd)); c.closePath(); c.fill(); c.font = '15px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText(cd >= 1 ? Math.ceil(cd) : cd.toFixed(1), x + s / 2, y + s / 2 + 1); }
          else if (G.ready && G.ready[id] > 0) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,' + G.ready[id].toFixed(2) + ')'; c.fillRect(x, y, s, s); c.globalCompositeOperation = 'source-over'; }
          if (S.mp < sk.mp) { c.fillStyle = 'rgba(40,60,160,.6)'; c.fillRect(x, y, s, s); }
          c.restore();
        }
        c.fillStyle = '#0A0E24'; rr(c, x - 3, y - 3, 15, 15, 4); c.fill(); c.font = '11px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFD23F'; c.fillText(String(i + 1), x + 4.5, y + 5);
      }
      function potionSlot(c, x, y, s, kind, key) {
        const n = POT_T.reduce((a, t) => a + count(kind + t), 0);
        c.fillStyle = '#0A0E24'; rr(c, x - 1, y - 1, s + 2, s + 2, 7); c.fill(); c.fillStyle = '#1A2148'; rr(c, x, y, s, s, 6); c.fill();
        const best = POT_T.map(t => kind + t).find(i => count(i) > 0) || kind + '1';
        const im = potionImgs[best] || (potionImgs[best] = Object.assign(new Image(), { src: P.itemImg(best) }));
        if (im.complete) { c.globalAlpha = n ? 1 : 0.35; c.drawImage(im, x + 5, y + 4, 40, 40); c.globalAlpha = 1; }
        c.font = '12px "Jua", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#0A0E24'; c.strokeText(String(n), x + s - 3, y + s - 4); c.fillStyle = '#FFFFFF'; c.fillText(String(n), x + s - 3, y + s - 4);
        c.fillStyle = '#0A0E24'; rr(c, x - 3, y - 3, 15, 15, 4); c.fill(); c.font = '11px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFD23F'; c.fillText(key, x + 4.5, y + 5);
      }
      const potionImgs = {};
      // 휴대폰 버튼 (캔버스 좌표)
      const TB = { atk: { x: 880, y: 456, r: 48 }, s0: { x: 768, y: 482, r: 31 }, s1: { x: 778, y: 398, r: 31 }, s2: { x: 836, y: 346, r: 31 }, s3: { x: 914, y: 334, r: 31 }, hp: { x: 688, y: 500, r: 25 }, mp: { x: 636, y: 500, r: 25 } };
      function drawTouch(c) {
        if (G.joy && G.joy.on) { c.globalAlpha = 0.3; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(G.joy.cx, G.joy.cy, 62, 0, Math.PI * 2); c.fill(); c.globalAlpha = 0.85; const g = c.createRadialGradient(G.joy.cx + G.joy.vx * 50, G.joy.cy + G.joy.vy * 50, 4, G.joy.cx + G.joy.vx * 50, G.joy.cy + G.joy.vy * 50, 28); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#9AA8E0'); c.fillStyle = g; c.beginPath(); c.arc(G.joy.cx + G.joy.vx * 50, G.joy.cy + G.joy.vy * 50, 28, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
        else { c.globalAlpha = 0.3; c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.beginPath(); c.arc(110, 436, 62, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(110, 436, 24, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
        Object.entries(TB).forEach(([k, b]) => {
          c.globalAlpha = G.btnDown[k] ? 0.9 : 0.62; c.fillStyle = '#0A0E24'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
          if (k === 'atk') { const g = c.createRadialGradient(b.x, b.y - 10, 4, b.x, b.y, b.r); g.addColorStop(0, '#FFE45C'); g.addColorStop(1, '#C88A10'); c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r - 5, 0, Math.PI * 2); c.fill(); c.font = '18px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1D2340'; c.fillText('공격', b.x, b.y + 1); return; }
          if (k === 'hp' || k === 'mp') { const n = POT_T.reduce((a, t) => a + count(k + t), 0); c.fillStyle = k === 'hp' ? '#D2343A' : '#2F55D9'; c.beginPath(); c.arc(b.x, b.y, b.r - 4, 0, Math.PI * 2); c.fill(); c.font = '13px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText(String(n), b.x, b.y + 1); return; }
          const i = +k[1], sk = skill(S.slots[i]);
          c.save(); c.beginPath(); c.arc(b.x, b.y, b.r - 4, 0, Math.PI * 2); c.clip();
          if (sk) { c.drawImage(Fx.icon(sk, 64), b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); const cd = G.cds[sk.id] || 0; if (cd > 0) { c.fillStyle = 'rgba(10,14,36,.7)'; c.beginPath(); c.moveTo(b.x, b.y); c.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd / sk.cd); c.fill(); c.font = '14px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText(cd.toFixed(1), b.x, b.y + 1); } }
          else { c.fillStyle = '#2A325E'; c.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); c.font = '14px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#8A93C0'; c.fillText(String(i + 1), b.x, b.y + 1); }
          c.restore();
        });
        c.globalAlpha = 1;
      }

      /* ---------- 고리 ---------- */
      function loop(t) {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
        if (!S || !G.map) { if (loadingText) { ctx.fillStyle = '#0F1430'; ctx.fillRect(0, 0, W, H); const k = imgOk('key'); if (k) { ctx.globalAlpha = 0.6; ctx.drawImage(k, 0, 0, W, H); ctx.globalAlpha = 1; } ctx.font = '22px "Jua", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'; ctx.fillText(loadingText, W / 2, H - 40); } return; }
        if (G.hitstop > 0) G.hitstop -= dt;
        else if (!G.paused && !G.dead && !document.hidden) update(dt);
        draw(t);
      }

      /* ---------- 저장 ---------- */
      function markDirty(soon) { G.dirty = true; if (soon && G.srvT < (CFG.serverSaveSec || 60) - 8) G.srvT = (CFG.serverSaveSec || 60) - 8; }
      async function save(server) {
        if (!S) return;
        S.x = Math.round(G.px); S.y = Math.round(G.py); S.savedAt = Date.now();
        const copy = JSON.parse(JSON.stringify(S));
        Store.setLocal(Hub.user && Hub.user.id, copy); G.saveT = 0;
        if (server) { G.srvT = 0; G.dirty = false; return Store.push(copy); }
        return true;
      }
      async function submitRank(pd) {
        if (!Hub.user) return;
        const now = Date.now(); if (now - G.lastSubmit < 4000 && !pd) return; G.lastSubmit = now;
        const sec = Math.min(86400, Math.round(S.play - G.playMark)); G.playMark = S.play;
        try { await Hub.submitScore({ game_id: GAME, score: S.lv, duration_sec: Math.max(0, sec), result: null, points_delta: pd || 0, extra: { lv: S.lv, map: S.map, kills: S.kills } }); loadRank(); } catch (e) { console.warn('[rpg] 랭킹 저장 실패', e.message); }
      }
      function bossReward() { const p = (CFG.points && CFG.points.boss) || 0; if (p) { submitRank(p); A.toast(`보스 처치! +${p}P`); } }
      async function loadRank() {
        const rk = $('#rgRank'), mine = $('#rgMine'); if (!rk) return;
        try {
          const rows = await Hub.leaderboard(GAME, 10); if (!rk.isConnected) return;
          rk.innerHTML = A.rankItems(rows, 'best_score', GAME); AV.paintAll(rk);
          mine.textContent = Hub.user ? `내 레벨 Lv.${S ? S.lv : '-'}` : '로그인하면 레벨이 랭킹에 올라가요.';
        } catch (e) { rk.innerHTML = '<li class="empty">랭킹을 불러오지 못했어요.</li>'; }
      }

      /* ================= 창 ================= */
      let pane = null, paneArg = null, tab = {};
      function openPanel(kind, arg) { pane = kind; paneArg = arg || null; G.paused = true; G.keys = {}; G.btnDown = {}; G.joy = null; renderPanel(); panel.hidden = false; }
      function closePanel() {
        if (pane === 'dead') return;
        const wasDoor = ['potion', 'school', 'chief', 'castle'].includes(pane);
        pane = null; panel.hidden = true; G.paused = false;
        if (wasDoor && G.onDoor) { const b = G.onDoor; G.px = (b.door.x + 0.5) * TS; G.py = (b.door.y + 1.9) * TS; G.onDoor = null; }
        if (!S.help) { S.help = true; markDirty(); }
        try { screenEl.focus({ preventScroll: true }); } catch (e) { /* noop */ }
      }
      const head = (t, sub) => `<h3>${t}<button type="button" class="x" data-x>닫기 (Esc)</button></h3>${sub ? `<p class="sub">${sub}</p>` : ''}`;
      const tabs = (key, list) => `<div class="rg-tabs">${list.map(([k, n]) => `<button type="button" data-tab="${key}:${k}" aria-pressed="${(tab[key] || list[0][0]) === k}">${n}</button>`).join('')}</div>`;
      const stOf = it => Object.entries(it.st || {}).map(([k, v]) => ({ atk: '공격', mag: '마력', def: '방어', hp: '체력', mp: '마나', spd: '속도%' }[k] + ' +' + v)).join(' · ');
      function renderPanel() {
        const k = pane; let h = '';
        if (k === 'inv') {
          const t = tab.inv || 'eq';
          h = head('가방 · 장비', `<span class="rg-gold">${fmtN(S.gold)} G</span> · 가방 ${S.inv.length}/40칸`) + tabs('inv', [['eq', '장비'], ['bag', '가방']]);
          h += `<div class="rg-stats">${[['공격', ST.atk], ['마력', ST.mag], ['방어', ST.def], ['체력', ST.hp], ['마나', ST.mp], ['속도', '+' + ST.spd + '%']].map(([a, b]) => `<span>${a} <b>${b}</b></span>`).join('')}</div>`;
          if (t === 'eq') {
            h += `<label class="rg-check"><input type="checkbox" data-hide ${S.hide ? 'checked' : ''}> 장비 안보이기 <small style="color:#AEB7E0">(그림만 숨김 · 능력치는 그대로)</small></label><div style="height:8px"></div>`;
            h += `<div class="rg-eq">${Object.entries(D.SLOT_NAME).map(([s, n]) => { const id = S.eq[s], it = ITEMS[id]; return `<div class="rg-row">${it ? itemIcon(id) : '<i class="rg-ic" style="--c:#3A4270">·</i>'}<span class="grow"><span class="nm">${n}</span><span class="ds">${it ? it.name + ' · ' + stOf(it) : '비어 있음'}</span></span>${it ? `<button type="button" class="rg-mini ghost" data-unequip="${s}">벗기</button>` : ''}</div>`; }).join('')}</div>`;
            const gear = S.inv.filter(x => ITEMS[x.id].slot);
            h += `<p class="sub">가방 속 장비 ${gear.length ? '' : '— 아직 없어요. 사냥터 몬스터가 가끔 떨어뜨려요 (보스는 꼭!)'}</p><ul class="rg-list">${gear.map(x => { const it = ITEMS[x.id], ok = S.lv >= it.req; return `<li class="rg-row${ok ? '' : ' off'}">${itemIcon(x.id)}<span class="grow"><span class="nm">${it.name}${x.n > 1 ? ' ×' + x.n : ''}</span><span class="ds">${D.SLOT_NAME[it.slot]} · Lv.${it.req} 이상 · ${stOf(it)}</span></span><button type="button" class="rg-mini" data-equip="${x.id}" ${ok ? '' : 'disabled'}>${ok ? '입기' : 'Lv.' + it.req}</button></li>`; }).join('')}</ul>`;
          } else {
            h += `<ul class="rg-list">${S.inv.length ? S.inv.map(x => { const it = ITEMS[x.id]; return `<li class="rg-row">${itemIcon(x.id)}<span class="grow"><span class="nm">${it.name} ×${x.n}</span><span class="ds">${it.slot ? D.SLOT_NAME[it.slot] + ' · ' + stOf(it) : it.desc}</span></span>${it.stack ? `<button type="button" class="rg-mini" data-use="${x.id}">쓰기</button>` : `<button type="button" class="rg-mini" data-equip="${x.id}" ${S.lv >= it.req ? '' : 'disabled'}>입기</button>`}</li>`; }).join('') : '<li class="rg-row">비어 있어요</li>'}</ul>`;
          }
        } else if (k === 'skill') {
          h = head('마법', '마법을 누른 뒤 1~4 칸 버튼으로 넣어요. 같은 마법을 다른 칸에 넣으면 옮겨져요. 새 마법은 마을의 <b>마법 학교</b>에서 배워요.');
          h += `<div class="rg-slots">${[0, 1, 2, 3].map(i => { const sk = skill(S.slots[i]); return `<span class="rg-slot"><b>${i + 1}</b>${sk ? `<img class="rg-sk" src="${Fx.iconURL(sk)}" alt="">${sk.name}` : '<i>비어 있음</i>'}</span>`; }).join('')}</div>`;
          h += `<ul class="rg-list">${S.skills.length ? S.skills.map(id => { const sk = skill(id); return `<li class="rg-row"><img class="rg-sk" src="${Fx.iconURL(sk)}" alt=""><span class="grow"><span class="nm">${sk.fusion ? '융합 · ' : ''}${sk.name} <small style="color:#AEB7E0">Lv.${sk.lv}</small></span><span class="ds">${describe(sk)}</span></span>${[0, 1, 2, 3].map(i => `<button type="button" class="rg-mini${S.slots[i] === id ? ' on' : ' ghost'}" data-slot="${i}:${id}">${i + 1}</button>`).join('')}</li>`; }).join('') : '<li class="rg-row">아직 배운 마법이 없어요. Lv.3이 되면 새싹 마을 마법 학교에서 파이어볼을 배울 수 있어요.</li>'}</ul>`;
        } else if (k === 'potion') {
          const ri = G.map.M.region, t = tab.potion || 'buy';
          h = head('포션 가게', `<span class="rg-gold">${fmtN(S.gold)} G</span> · 이 마을은 ${ri + 1}단계 포션까지 팔아요`) + tabs('potion', [['buy', '사기'], ['sell', '팔기']]);
          if (t === 'buy') h += `<ul class="rg-list">${D.POTIONS.filter(p => p.tier <= ri).map(p => `<li class="rg-row">${itemIcon(p.id)}<span class="grow"><span class="nm">${p.name} <small style="color:#AEB7E0">가진 수 ${count(p.id)}</small></span><span class="ds">${p.desc} · ${fmtN(p.price)} G</span></span><button type="button" class="rg-mini" data-buy="${p.id}:1" ${S.gold >= p.price ? '' : 'disabled'}>1개</button><button type="button" class="rg-mini" data-buy="${p.id}:10" ${S.gold >= p.price * 10 ? '' : 'disabled'}>10개</button></li>`).join('')}</ul>`;
          else h += `<p class="sub">팔면 원래 값의 40%를 받아요. 입고 있는 장비는 팔 수 없어요.</p><ul class="rg-list">${S.inv.length ? S.inv.map(x => { const it = ITEMS[x.id], pr = Math.max(1, Math.round(it.price * 0.4)); return `<li class="rg-row">${itemIcon(x.id)}<span class="grow"><span class="nm">${it.name} ×${x.n}</span><span class="ds">1개 ${fmtN(pr)} G</span></span><button type="button" class="rg-mini" data-sell="${x.id}:1">1개</button>${x.n > 1 ? `<button type="button" class="rg-mini ghost" data-sell="${x.id}:${x.n}">모두</button>` : ''}</li>`; }).join('') : '<li class="rg-row">팔 물건이 없어요</li>'}</ul>`;
        } else if (k === 'school') {
          const ri = G.map.M.region, t = tab.school || 'learn';
          h = head('마법 학교', `<span class="rg-gold">${fmtN(S.gold)} G</span> · ※ 지금 마법은 임시 목록 (skillcom 마법으로 바꿀 예정)`) + tabs('school', [['learn', '마법 배우기'], ['fuse', '마법 융합']]);
          if (t === 'learn') {
            const list = Object.values(SKILLS).filter(s => s.village <= ri).sort((a, b) => a.lv - b.lv);
            h += `<p class="sub">이 마을까지의 마법을 배울 수 있어요. 다음 마을에 가면 더 강한 마법이 있어요.</p><ul class="rg-list">${list.map(s => { const has = S.skills.includes(s.id), ok = S.lv >= s.lv, sk = skill(s.id); return `<li class="rg-row${ok || has ? '' : ' off'}"><img class="rg-sk" src="${Fx.iconURL(sk)}" alt=""><span class="grow"><span class="nm">${s.name} <small style="color:#AEB7E0">Lv.${s.lv} · ${fmtN(s.price)} G</small></span><span class="ds">${describe(sk)}</span></span>${has ? '<span class="rg-mini on">배움</span>' : `<button type="button" class="rg-mini" data-learn="${s.id}" ${ok && S.gold >= s.price ? '' : 'disabled'}>${ok ? '배우기' : 'Lv.' + s.lv}</button>`}</li>`; }).join('')}</ul>`;
          } else {
            const base = S.skills.filter(id => SKILLS[id]);
            const a = tab.fa && base.includes(tab.fa) ? tab.fa : base[0], b = tab.fb && base.includes(tab.fb) ? tab.fb : base.find(x => SKILLS[x].el !== (SKILLS[a] || {}).el);
            tab.fa = a; tab.fb = b;
            h += `<p class="sub">서로 <b>다른 원소</b> 마법 2개를 섞으면 새 마법이 생겨요. 재료 마법은 그대로 남아요. (원소 짝 15가지)</p>`;
            if (base.length < 2) h += '<div class="rg-fuse">배운 마법이 2개 이상 있어야 융합할 수 있어요.</div>';
            else {
              const opt = sel => base.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${SKILLS[id].name} (${ELEM[SKILLS[id].el].name} · Lv.${SKILLS[id].lv})</option>`).join('');
              const res = a && b && SKILLS[a].el !== SKILLS[b].el ? skill(fuseId(a, b)) : null, has = res && S.skills.includes(res.id), price = res ? fusePrice(a, b) : 0;
              h += `<div class="rg-fuse"><label>재료 1 <select data-fa>${opt(a)}</select></label><label>재료 2 <select data-fb>${opt(b)}</select></label>
                ${res ? `<div class="rg-row"><img class="rg-sk" src="${Fx.iconURL(res)}" alt=""><span class="grow"><span class="nm">→ ${res.name}</span><span class="ds">${describe(res)}</span></span>${has ? '<span class="rg-mini on">이미 있음</span>' : `<button type="button" class="rg-mini" data-fuse="${a}+${b}" ${S.gold >= price ? '' : 'disabled'}>융합 ${fmtN(price)} G</button>`}</div>` : '<div class="rg-row">같은 원소끼리는 섞을 수 없어요. 다른 원소를 골라 주세요.</div>'}</div>`;
            }
            h += `<p class="sub">원소 짝 결과표</p><ul class="rg-list">${D.FUSION.map(f => `<li class="rg-row" style="padding:4px 8px"><span class="grow"><b style="color:${ELEM[f[0]].color}">${ELEM[f[0]].name}</b> + <b style="color:${ELEM[f[1]].color}">${ELEM[f[1]].name}</b> = ${f[2]} <small style="color:#AEB7E0">(${KIND_TXT[f[3]]})</small></span></li>`).join('')}</ul>`;
          }
        } else if (k === 'chief') {
          const vis = S.visited;
          h = head('이장 집', '어서 오게! 여기가 자네의 귀환 장소일세. 가 본 곳이면 어디든 보내 주지. (이동은 무료)');
          h += `<div class="rg-tabs"><button type="button" class="rg-mini" data-savenow>지금 저장</button><span class="rg-mini ghost" style="cursor:default">처치 ${fmtN(S.kills)} · 플레이 ${Math.floor(S.play / 60)}분</span></div>`;
          D.REGIONS.forEach((R, ri) => {
            const vid = 'v' + (ri + 1), fs = D.MAPS.filter(m => m.kind === 'field' && m.region === ri);
            if (!vis.includes(vid) && !fs.some(m => vis.includes(m.id))) return;
            h += `<p class="sub" style="margin-top:8px"><b>${R.name}</b> 지역</p><div class="rg-tabs">${vis.includes(vid) ? `<button type="button" class="rg-mini" data-go="${vid}">${R.name}</button>` : ''}${fs.map(m => vis.includes(m.id) ? `<button type="button" class="rg-mini ghost" data-go="${m.id}">${m.no}. ${m.name} (Lv.${m.rec})</button>` : '').join('')}</div>`;
          });
          h += '<p class="sub" style="margin-top:8px">※ 퀘스트는 준비 중이에요. 나중에 마지막 마을의 성에서 나눠 줄 예정이에요.</p>';
        } else if (k === 'castle') {
          h = head('왕성', '왕: "용사여, 잘 왔다." — 퀘스트는 아직 준비 중이에요. 다음 업데이트에서 이곳에서 퀘스트를 받을 수 있어요.');
        } else if (k === 'dead') {
          h = `<h3>쓰러졌어요…</h3><p class="sub">경험치를 ${fmtN(paneArg.loss)} 잃었어요. (레벨은 그대로)<br>마지막으로 들른 마을(${MAPBY[S.home].name})의 이장 집 앞에서 다시 시작해요.</p><button type="button" class="btn btn-primary" data-revive>마을에서 다시 시작</button>`;
        } else if (k === 'help') {
          h = head('도움말', '내 아바타로 떠나는 도트 RPG — 혼자 플레이 첫 버전') + (imgOk('key') ? `<img src="${imgOk('key').src}" alt="" style="width:100%;border-radius:10px;border:2px solid #0A0E24;margin:4px 0 10px;display:block">` : '');
          h += `<ul class="ult-rules">
            <li><b>이동</b> WASD·방향키 · <b>공격</b> Space·J · <b>마법</b> 1~4 · <b>포션</b> Q(체력) E(마나) · <b>가방</b> I · <b>마법 창</b> K · <b>창 닫기</b> Esc</li>
            <li>휴대폰은 화면 왼쪽을 끌면 이동(조이스틱), 오른쪽 버튼으로 공격·마법·포션. 가로로 돌리면 더 커요.</li>
            <li>지도 <b>오른쪽 끝 → 다음 지도</b>, 왼쪽 끝 → 이전 지도. 마을 → 사냥터 10곳 → 다음 마을 … 마을 하나가 10레벨씩(새싹 마을 Lv.1~10 … 하늘섬 마을 Lv.71~80), 마지막 불꽃왕성은 Lv.80~100.</li>
            <li>문 앞으로 걸어가면 건물에 들어가요: <b>포션 가게</b> · <b>마법 학교</b>(마법 배우기·융합) · <b>이장 집</b>(무료 이동·저장).</li>
            <li>직업은 없어요. 레벨이 오르면 마법 학교에서 새 마법을 배우고, 두 원소를 섞어 <b>융합 마법</b>을 만들어요.</li>
            <li>장비는 몬스터가 떨어뜨려요(보스는 꼭). 입으면 아바타 위에 보이고, 가방의 <b>장비 안보이기</b>로 그림만 숨길 수 있어요.</li>
            <li>쓰러지면 경험치가 조금 줄고 마지막 마을에서 다시 시작해요. <b>귀환 주문서</b>로 언제든 마을로 돌아갈 수 있어요.</li>
          </ul><button type="button" class="btn btn-primary" data-x>모험 시작!</button>`;
        }
        panel.innerHTML = h;
      }
      panel.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-hide]')) { S.hide = t.checked; markDirty(); renderPanel(); }
        else if (t.matches('[data-fa]')) { tab.fa = t.value; if (tab.fb === t.value || (SKILLS[tab.fb] && SKILLS[tab.fb].el === SKILLS[t.value].el)) tab.fb = null; renderPanel(); }
        else if (t.matches('[data-fb]')) { tab.fb = t.value; renderPanel(); }
      });
      panel.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        const d = b.dataset;
        if ('x' in d) { closePanel(); return; }
        if (d.tab) { const [k, v] = d.tab.split(':'); tab[k] = v; renderPanel(); return; }
        if (d.equip) {
          const it = ITEMS[d.equip]; if (!it || S.lv < it.req || !takeItem(d.equip)) return;
          const old = S.eq[it.slot]; if (old) addItem(old, 1);
          S.eq[it.slot] = d.equip; restat(); markDirty(); say(`${it.name} 착용!`, 1.4);
        } else if (d.unequip) {
          const id = S.eq[d.unequip]; if (!id) return; if (!addItem(id, 1)) return; delete S.eq[d.unequip]; restat(); markDirty();
        } else if (d.use) { useItem(d.use); }
        else if (d.slot) {
          const [i, id] = d.slot.split(':'); const n = +i;
          if (S.slots[n] === id) S.slots[n] = null; else { S.slots = S.slots.map(x => (x === id ? null : x)); S.slots[n] = id; }
          markDirty();
        } else if (d.buy) {
          const [id, n] = d.buy.split(':'), it = ITEMS[id], cost = it.price * +n; if (S.gold < cost) return;
          if (addItem(id, +n)) { S.gold -= cost; markDirty(true); }
        } else if (d.sell) {
          const [id, n] = d.sell.split(':'), it = ITEMS[id]; if (takeItem(id, +n)) { S.gold += Math.max(1, Math.round(it.price * 0.4)) * +n; markDirty(true); }
        } else if (d.learn) {
          const s = SKILLS[d.learn]; if (S.lv < s.lv || S.gold < s.price || S.skills.includes(s.id)) return;
          S.gold -= s.price; S.skills.push(s.id); const free = S.slots.indexOf(null); if (free >= 0) S.slots[free] = s.id;
          say(`'${s.name}' 배움!${free >= 0 ? ` ${free + 1}번 키로 써 보세요` : ' 마법 창(K)에서 칸에 넣어요'}`, 3); markDirty(true);
        } else if (d.fuse) {
          const [a, bb] = d.fuse.split('+'), id = fuseId(a, bb), price = fusePrice(a, bb);
          if (S.gold < price || S.skills.includes(id) || !skill(id)) return;
          S.gold -= price; S.skills.push(id); const free = S.slots.indexOf(null); if (free >= 0) S.slots[free] = id;
          say(`융합 성공! '${skill(id).name}'`, 3); markDirty(true);
        } else if (d.go) { const id = d.go; pane = null; panel.hidden = true; G.paused = false; enter(id, MAPBY[id].kind === 'village' ? 'door' : 'L'); return; }
        else if ('savenow' in d) { save(true).then(ok => say(ok || !Store.online() ? '저장했어요' : '이 기기에 저장했어요 (서버 저장은 준비 중)')); return; }
        else if ('revive' in d) { G.dead = false; pane = null; panel.hidden = true; G.paused = false; restat(); S.hp = ST.hp; S.mp = ST.mp; enter(S.home, 'door'); return; }
        renderPanel();
      });
      el.querySelector('.rg-bar').addEventListener('click', e => {
        const b = e.target.closest('[data-rg]'); if (!b || !S) return; b.blur();
        const k = b.dataset.rg;
        if (k === 'save') { save(true).then(ok => say(ok || !Store.online() ? '저장했어요' : '이 기기에 저장했어요 (서버 저장은 준비 중)')); return; }
        if (G.dead) return;
        if (pane === k) closePanel(); else openPanel(k);
      });

      /* ================= 입력 ================= */
      const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyJ', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyE', 'KeyI', 'KeyK', 'KeyF', 'Enter', 'Escape']);
      function onKey(e) {
        if (!S || !G.map) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (document.querySelector('#authModal:not([hidden])')) return;
        const r = canvas.getBoundingClientRect(); if (r.bottom < 60 || r.top > innerHeight - 60) return;   // 게임판이 화면에 없으면 무시
        if (!GAME_KEYS.has(e.code)) return;
        const down = e.type === 'keydown';
        if (down && e.code === 'Escape') { if (pane) { e.preventDefault(); closePanel(); } return; }
        if (down && (e.code === 'KeyI' || e.code === 'KeyK')) { e.preventDefault(); const k = e.code === 'KeyI' ? 'inv' : 'skill'; if (G.dead) return; if (pane === k) closePanel(); else if (!pane || pane === 'inv' || pane === 'skill' || pane === 'help') openPanel(k); return; }
        if (pane) { if (tag !== 'button') e.preventDefault(); return; }
        if (tag === 'button' && (e.code === 'Space' || e.code === 'Enter')) return;
        e.preventDefault();
        G.keys[e.code] = down;
        if (!down || e.repeat) return;
        if (e.code.startsWith('Digit')) cast(+e.code.slice(5) - 1);
        else if (e.code === 'KeyQ') usePotion('hp');
        else if (e.code === 'KeyE') usePotion('mp');
        else if (e.code === 'KeyF' || e.code === 'Enter') { const tx = Math.floor(G.px / TS); const b = G.map.doors.find(x => Math.abs(x.door.x - tx) <= 1 && Math.abs((x.door.y + 1) * TS - G.py) < 48); if (b) openPanel(b.type); }
      }
      document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
      const blurKeys = () => { G.keys = {}; G.btnDown = {}; if (G.joy) G.joy.on = false; };
      window.addEventListener('blur', blurKeys);

      // 터치 (캔버스 좌표로 바꿔서)
      const pts = {};
      const toC = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
      const btnAt = p => Object.keys(TB).find(k => Math.hypot(p.x - TB[k].x, p.y - TB[k].y) < TB[k].r + 10);
      canvas.addEventListener('pointerdown', e => {
        if (!S || pane) return;
        if (e.pointerType === 'touch' || e.pointerType === 'pen') G.touch = true;
        if (!G.touch) { screenEl.focus({ preventScroll: true }); return; }
        e.preventDefault(); canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        const p = toC(e), b = btnAt(p);
        if (b) { pts[e.pointerId] = { btn: b }; G.btnDown[b] = true; if (b[0] === 's') cast(+b[1]); else if (b === 'hp' || b === 'mp') usePotion(b); return; }
        if (p.x < W * 0.55) { pts[e.pointerId] = { joy: true }; G.joy = { on: true, cx: p.x, cy: p.y, vx: 0, vy: 0 }; }
      }, { passive: false });
      canvas.addEventListener('pointermove', e => {
        const s = pts[e.pointerId]; if (!s || !s.joy || !G.joy) return; e.preventDefault();
        const p = toC(e), dx = p.x - G.joy.cx, dy = p.y - G.joy.cy, l = Math.hypot(dx, dy), k = Math.min(1, l / 50);
        G.joy.vx = l ? dx / l * k : 0; G.joy.vy = l ? dy / l * k : 0;
      }, { passive: false });
      const up = e => { const s = pts[e.pointerId]; if (!s) return; if (s.btn) G.btnDown[s.btn] = false; if (s.joy && G.joy) G.joy.on = false; delete pts[e.pointerId]; };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      const onHide = () => { if (document.hidden && S) save(true); };
      document.addEventListener('visibilitychange', onHide);
      const onUnload = () => { if (S) save(false); };
      window.addEventListener('pagehide', onUnload);

      // 휴대폰 가로(낮은 화면): 게임판 위쪽을 화면 맨 위에 맞춤 / 그 밖: 게임판과 아래 버튼이 한 화면에 보이게
      function fitScreen() {
        const cab = el.querySelector('.cabinet'); if (!cab || !cab.isConnected) return;
        if (innerHeight < 520) {
          const top = document.querySelector('.top'), pos = top ? getComputedStyle(top).position : '';
          const th = top && (pos === 'sticky' || pos === 'fixed') ? top.getBoundingClientRect().bottom : 0;
          window.scrollTo(0, Math.max(0, scrollY + cab.getBoundingClientRect().top - th - 2));
        } else if (window.GoStudy && GoStudy.fitView) GoStudy.fitView(cab, el.querySelector('.rg-bar'));
      }
      const onOrient = () => setTimeout(fitScreen, 250);
      window.addEventListener('orientationchange', onOrient);

      /* ================= 시작 ================= */
      (async () => {
        loadingText = '그림 불러오는 중…';
        const [s] = await Promise.all([Store.load(), loadImages(6000)]); if (!alive) return; loadingText = '';
        S = s; restat(); if (!S.hp) S.hp = ST.hp; if (!S.mp) S.mp = ST.mp;
        G.touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
        enter(S.map, S.x ? 'pos' : 'L');
        if (MAPBY[S.map].kind === 'field' && S.x) { /* 그 자리에서 이어서 */ }
        G.paused = false; G.playMark = S.play;
        fitScreen();
        if (!S.help) openPanel('help');
        loadRank();
        if (Hub.user) Hub.myBest(GAME).then(b => { if ((b || 0) < S.lv) submitRank(); }).catch(() => {});
        window.__rpg = { S: () => S, G: () => G, ST: () => ST, enter, cast, gainExp, save, openPanel, closePanel, skill, addItem };   // 점검(테스트)용
      })();
      raf = requestAnimationFrame(loop);
      BGM.play();

      return () => {
        alive = false; cancelAnimationFrame(raf);
        if (S) save(true);
        document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onOrient); window.removeEventListener('blur', blurKeys); window.removeEventListener('pagehide', onUnload);
        BGM.stop();
      };
    }
  };
})();
