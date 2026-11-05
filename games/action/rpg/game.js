/*
 * gogo?gogo! — skillcom RPG (도트 RPG · 혼자 플레이 첫 버전 v40 · v41 건물 안·사람·가방 창)
 *
 *  파일 3개: data.js (숫자·목록) · world.js (지도 만들기·그림) · game.js (이 파일: 움직임·전투·창·저장)
 *  캐릭터: 사이트 아바타 그대로 + 장비를 위에 겹쳐 그림. 가방 창 '장비 안보이기' = 그림만 숨김 (능력치 그대로)
 *  저장: 이 기기(localStorage) + 로그인하면 서버 game_saves 표 (supabase/rpg_v40.sql). 더 최근 것을 불러옴
 *  조작: 방향키 이동 · Space/J 공격 · 1~4 기본 마법 · Q W E R 융합 마법 · Z/X 포션 · I 가방 · K 마법 · F/Enter 들어가기 · Esc 닫기 (v53)
 *        휴대폰: 왼쪽 조이스틱 + 오른쪽 버튼 (캔버스 위)
 */
(function () {
  'use strict';
  const D = window.GoRPGData, AV = window.GoAvatar, Hub = window.GameHub, BGM = window.GoBGM;
  const P = window.__GoRPGParts, CFG = window.GoSettings.get('rpg');
  const { loadImages, imgOk, getMap, solidAt, monSprite, avatarSprite, itemIcon, clamp, rand, pick, dist, fmtN, W, H, TS, SAVE_V, GAME, MAPBY, getRoom, npcSprite, npcPortrait, villagers } = P;
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

  /* ================= v60 장비 하나하나 (옵션 · 강화) =================
   *  떨어진 장비마다 고유 번호(uid)가 있음 → 저장 S.gear[uid] = { b: 기본 장비 id, en: 강화(0~10), op: [[옵션, 값%], …] }
   *  가방·장비 칸에는 'g:' + uid 로 들어감. ITEMS['g:uid'] = 기본 장비를 복사 + 강화만큼 능력치 ↑ + 옵션 (regGear)
   *  예전 저장의 기본 장비(sw1 같은)는 불러올 때 옵션 없는 +0 장비로 바뀜 */
  const OPTS = D.OPTS, ENH = D.ENH, GRADE = D.GRADE;
  const r1 = v => Math.round(v * 10) / 10;
  const newUid = () => Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 7);
  const gradeOf = (b, op) => (ITEMS[b] && ITEMS[b].legend ? 4 : clamp((op || []).length - 1, 0, 3));
  function validGear(g) {   // 저장·거래로 받은 장비 정보 확인 (이상하면 null)
    if (!g || typeof g !== 'object') return null;
    const B = ITEMS[g.b]; if (!B || !B.slot || B.base) return null;
    const seen = {}, op = (Array.isArray(g.op) ? g.op : []).slice(0, 5)
      .filter(o => Array.isArray(o) && OPTS[o[0]] && !seen[o[0]] && (seen[o[0]] = 1) && isFinite(+o[1]))
      .map(o => [o[0], clamp(r1(+o[1]), -OPTS[o[0]].max, OPTS[o[0]].max)]).filter(o => o[1] !== 0);
    return { b: g.b, en: clamp(Math.floor(+g.en || 0), 0, ENH.max), op };
  }
  function regGear(uid, g) {
    const B = ITEMS[g.b], k = 1 + ENH.per * g.en, st = {}, id = 'g:' + uid;
    Object.keys(B.st).forEach(q => { st[q] = q === 'spd' ? B.st[q] : Math.round(B.st[q] * k); });
    ITEMS[id] = Object.assign({}, B, { id, base: g.b, uid, en: g.en, op: g.op, grade: gradeOf(g.b, g.op), st,
      name: (g.en ? '+' + g.en + ' ' : '') + B.name, price: Math.round(B.price * (1 + 0.35 * g.op.filter(o => o[1] > 0).length) * (1 + 0.5 * g.en)) });
    return id;
  }
  function rollOpts(t, n) {   // 단계 t(0~9) 장비에 옵션 n개
    const keys = Object.keys(OPTS), out = [];
    while (out.length < n) {
      const q = pick(keys); if (out.some(o => o[0] === q)) continue;
      const neg = out.length > 0 && Math.random() < 0.3, v = Math.max(0.1, r1(OPTS[q].max * (0.15 + 0.85 * t / 9) * rand(0.2, 1) * (neg ? 0.5 : 1)));
      out.push([q, neg ? -v : v]);
    }
    return out;
  }
  function optCount(rare, boss, legend) { if (legend) return 4; const r = Math.random(); let n = r < 0.45 ? 1 : r < 0.8 ? 2 : r < 0.95 ? 3 : 4; if (rare) n++; if (boss) n++; return Math.min(4, n); }
  const optTxt = o => `${OPTS[o[0]].name} ${o[1] > 0 ? '+' : '−'}${Math.abs(o[1])}%`;
  /* v68 상점에 파는 값 (숫자는 data.js SELL): 장비 = (10 + 착용 레벨×3) × 등급 배수 + 강화에 쓴 골드의 30% · 그 밖의 물건 = 산 값의 40% */
  const SELL = D.SELL;
  const enhSpent = en => { let t = 0; for (let i = 0; i < (en || 0); i++) t += ENH.cost(i); return t; };
  function sellPrice(id) {
    const it = ITEMS[id]; if (!it) return 0;
    if (!it.slot) return Math.max(1, Math.round((it.price || 0) * SELL.other));
    const g = it.grade != null ? it.grade : gradeOf(it.base || it.id, it.op);
    return Math.round((SELL.base + (it.req || 1) * SELL.perLv) * (SELL.grade[g] || 1) + enhSpent(it.en) * SELL.enh);
  }
  function pruneGear(s) {   // 가방·장비 칸에 없는 장비 정보는 지움
    const used = {}; s.inv.forEach(x => { if (String(x.id).startsWith('g:')) used[x.id.slice(2)] = 1; }); Object.values(s.eq).forEach(id => { if (String(id).startsWith('g:')) used[id.slice(2)] = 1; });
    Object.keys(s.gear).forEach(u => { if (!used[u]) delete s.gear[u]; });
  }

  /* ================= 저장 ================= */
  function newSave() {
    const s = { v: SAVE_V, lv: 1, exp: 0, gold: 50, hp: 0, mp: 0, map: 'v1', x: null, y: null, home: 'v1',
      inv: [{ id: 'hp1', n: 5 }, { id: 'mp1', n: 3 }, { id: 'scroll', n: 1 }], eq: {}, gear: {}, hide: false,
      stat: { str: 0, dex: 0, int: 0, vit: 0, res: 0 }, statV: 2, sp: 0, skills: ['magicarrow'], slots: ['magicarrow', null, null, null], fslots: [null, null, null, null], visited: ['v1'], play: 0, kills: 0, bosses: {}, help: false, savedAt: 0 };
    return s;
  }
  function fixSave(s) {
    const n = newSave(); if (!s || typeof s !== 'object' || s.v !== SAVE_V) return n;
    const oldStatV = s.statV;   // 기본값을 채우기 전에 기억 (v44 스탯 바뀜 확인용)
    Object.keys(n).forEach(k => { if (s[k] === undefined) s[k] = n[k]; });
    s.lv = clamp(Math.floor(+s.lv || 1), 1, D.MAX_LV); s.exp = Math.max(0, +s.exp || 0); s.gold = Math.max(0, Math.floor(+s.gold || 0));
    if (!MAPBY[s.map]) s.map = 'v1'; if (!MAPBY[s.home] || MAPBY[s.home].kind !== 'village') s.home = 'v1';
    // v60 장비 하나하나 등록 → 가방·장비 확인 → 예전 기본 장비는 +0 장비로 바꿈 → 안 쓰는 정보 지움
    s.gear = s.gear && typeof s.gear === 'object' && !Array.isArray(s.gear) ? s.gear : {};
    Object.keys(s.gear).forEach(u => { const g = /^[a-z0-9]{4,16}$/.test(u) && validGear(s.gear[u]); if (g) { s.gear[u] = g; regGear(u, g); } else delete s.gear[u]; });
    s.inv = (Array.isArray(s.inv) ? s.inv : []).filter(x => x && ITEMS[x.id] && x.n > 0).slice(0, 120);   // v73 가방 늘리기(최대 80칸) 때문에 60 → 120 (예전엔 61칸째부터 불러올 때 사라질 뻔)
    if (!s.eq || typeof s.eq !== 'object') s.eq = {};
    Object.keys(s.eq).forEach(k => { if (!ITEMS[s.eq[k]] || ITEMS[s.eq[k]].slot !== k) delete s.eq[k]; });
    const inst = b => { const u = newUid(); s.gear[u] = { b, en: 0, op: [] }; return regGear(u, s.gear[u]); };
    s.inv = s.inv.flatMap(x => { const it = ITEMS[x.id]; if (!it.slot) return [x]; if (it.base) return [{ id: x.id, n: 1 }]; return Array.from({ length: Math.min(40, Math.floor(x.n)) }, () => ({ id: inst(x.id), n: 1 })); }).slice(0, 60);
    const seenG = {}; s.inv = s.inv.filter(x => !String(x.id).startsWith('g:') || (!seenG[x.id] && (seenG[x.id] = 1)));
    Object.keys(s.eq).forEach(k => { if (!ITEMS[s.eq[k]].base) s.eq[k] = inst(s.eq[k]); else if (seenG[s.eq[k]]) delete s.eq[k]; });
    pruneGear(s);
    s.skills = (s.skills || []).filter(id => skill(id));
    if (!s.skills.includes('magicarrow')) { s.skills.unshift('magicarrow'); if (Array.isArray(s.slots) && !s.slots.includes('magicarrow')) { const i = s.slots.indexOf(null); if (i >= 0) s.slots[i] = 'magicarrow'; } }   // v41 기본 마법
    // v53: 1~4 = 기본 마법 칸, Q W E R = 융합 마법 칸. 예전 저장의 1~4 칸에 있던 융합 마법은 융합 칸으로 옮김
    const oldF = (s.slots || []).filter(id => id && String(id).startsWith('fu:'));
    s.slots = [0, 1, 2, 3].map(i => (s.slots && s.skills.includes(s.slots[i]) && !String(s.slots[i]).startsWith('fu:') ? s.slots[i] : null));
    s.fslots = [0, 1, 2, 3].map(i => (s.fslots && s.skills.includes(s.fslots[i]) && String(s.fslots[i]).startsWith('fu:') ? s.fslots[i] : null));
    oldF.forEach(id => { if (s.skills.includes(id) && !s.fslots.includes(id)) { const j = s.fslots.indexOf(null); if (j >= 0) s.fslots[j] = id; } });
    s.visited = (s.visited || []).filter(id => MAPBY[id]); if (!s.visited.includes('v1')) s.visited.unshift('v1');
    // v44 스탯 4가지(v60 저항 더해 5가지) · 레벨당 2포인트 · 스탯마다 최대 50. v43(힘·민첩·지혜, 레벨당 3) 저장은 한 번 모두 돌려받아 다시 나눔
    const st = s.stat && typeof s.stat === 'object' && oldStatV === 2 ? s.stat : {}; if (oldStatV !== 2) { s.statV = 2; if (s.lv > 1) s.statReset = true; }
    s.stat = {}; D.STAT.keys.forEach(k => { s.stat[k] = clamp(Math.floor(+st[k] || 0), 0, D.STAT.max); });
    const total = (s.lv - 1) * (CFG.statPerLevel || 2), used = D.STAT.keys.reduce((a, k) => a + s.stat[k], 0);
    if (used > total) { D.STAT.keys.forEach(k => { s.stat[k] = 0; }); s.sp = total; } else s.sp = total - used;
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
  .rg-page .rg-cm { max-width: 960px; margin: 14px auto 0; }
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
  .rg-side { width: min(100%, 560px); display: grid; grid-template-columns: 1fr; gap: 12px; }
  /* v43 크게 보기 */
  .rg-full { position: absolute; top: 2%; right: 18.4%; width: 36px; height: 36px; z-index: 2; border-radius: 9px; background: rgba(10,14,36,.78); border: 2px solid #0A0E24; color: #FFFFFF; display: none; place-items: center; cursor: pointer; padding: 0; }
  @media (pointer: coarse) { .rg-full { display: grid; } }
  .rg-page .cabinet:fullscreen { max-width: none; width: 100vw; height: 100vh; margin: 0; padding: 0; border: 0; border-radius: 0; box-shadow: none; background: #05081A; display: flex; align-items: center; justify-content: center; }
  .rg-page .cabinet:-webkit-full-screen { max-width: none; width: 100vw; height: 100vh; margin: 0; padding: 0; border: 0; border-radius: 0; box-shadow: none; background: #05081A; display: flex; align-items: center; justify-content: center; }
  .rg-page .cabinet.rg-max { position: fixed; inset: 0; z-index: 200; max-width: none; width: 100vw; height: 100dvh; margin: 0; padding: 0; border: 0; border-radius: 0; box-shadow: none; background: #05081A; display: flex; align-items: center; justify-content: center; }
  .rg-page .cabinet:fullscreen .screen { width: min(100vw, calc(100vh * 1.7778)); border: 0; border-radius: 0; }
  .rg-page .cabinet:-webkit-full-screen .screen { width: min(100vw, calc(100vh * 1.7778)); border: 0; border-radius: 0; }
  .rg-page .cabinet.rg-max .screen { width: min(100vw, calc(100dvh * 1.7778)); border: 0; border-radius: 0; }
  /* v43 스탯 창 */
  .rg-statwin { display: grid; grid-template-columns: 200px 1fr; gap: 12px; align-items: stretch; }
  .rg-statfig { display: grid; gap: 6px; justify-items: center; align-content: start; }
  .rg-statfig .rg-fig { grid-area: auto; width: 100%; height: 156px; } .rg-statfig .rg-fig img { height: 140px; }
  .rg-statfig .nm { font-family: var(--f-display); font-size: 17px; }
  .rg-xp { width: 100%; height: 8px; background: #0A0E24; border-radius: 4px; overflow: hidden; } .rg-xp i { display: block; height: 100%; background: linear-gradient(90deg, #FFD23F, #FFF3B0); }
  .rg-statfig small { color: #AEB7E0; font-size: 12px; }
  .rg-alloc { display: grid; gap: 6px; align-content: start; } .rg-alloc .rg-srvact { margin: 2px 0 0; }
  .rg-sp { font-size: 14px; color: #C9D0F0; } .rg-sp b { font-family: var(--f-display); font-size: 22px; color: #FFD23F; margin-left: 6px; }
  .rg-st { display: grid; grid-template-columns: 1fr auto; grid-template-areas: "lab btns" "ds btns"; gap: 0 10px; align-items: center; background: #141A3C; border: 2px solid #0A0E24; border-left: 5px solid var(--c); border-radius: 10px; padding: 5px 10px; }
  .rg-st .lab { grid-area: lab; display: flex; align-items: baseline; gap: 10px; } .rg-st .lab b { color: var(--c); font-family: var(--f-display); font-size: 18px; } .rg-st .lab span { font-family: var(--f-display); font-size: 20px; color: #FFFFFF; }
  .rg-st small { grid-area: ds; color: #AEB7E0; font-size: 12px; } .rg-st .lab small.mx { font-size: 12px; color: #8A93C0; }
  .rg-st .btns { grid-area: btns; display: flex; gap: 6px; } .rg-st .btns .rg-mini { font-size: 15px; padding: 6px 12px; }
  .rg-detailgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
  .rg-detailgrid div { background: #141A3C; border: 2px solid #0A0E24; border-radius: 10px; padding: 7px 9px; display: grid; gap: 1px; }
  .rg-detailgrid span { font-size: 12px; } .rg-detailgrid b { font-family: var(--f-display); font-size: 19px; color: #FFFFFF; }
  .rg-detailgrid small { font-size: 11px; color: #AEB7E0; line-height: 1.35; } .rg-detailgrid small.pt { color: #8A93C0; }
  .rg-detailgrid em { font-style: normal; } .rg-detailgrid em.s { color: #FFD23F; } .rg-detailgrid em.g { color: #9AE6FF; }
  /* v44 거래 */
  .rg-trade { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .rg-trade .rg-bag.ok { border-color: #3DDC84; box-shadow: 0 0 0 2px #3DDC84 inset; }
  .rg-trade .tt { display: flex; align-items: center; gap: 8px; font-family: var(--f-display); font-size: 16px; margin-bottom: 6px; }
  .rg-trade .tt em { font-style: normal; font-size: 12px; background: #3DDC84; color: #0A0E24; border-radius: 6px; padding: 0 6px; }
  .rg-trlist { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; min-height: 52px; align-items: start; }
  .rg-trempty { grid-column: 1 / -1; color: #8A93C0; font-size: 13px; padding: 10px 0; }
  .rg-trgold { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 13px; }
  .rg-trgold input { width: 110px; color: #1D2340; padding: 4px 6px; border-radius: 6px; border: 2px solid #0A0E24; font-size: 14px; }
  .rg-trgold small { color: #AEB7E0; }
  /* v42 서버 고르기 */
  .rg-srvs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .rg-srv { position: relative; display: grid; gap: 6px; text-align: left; background: linear-gradient(180deg, #2A3266, #182050); color: #EEF1FF; border: 2px solid #0A0E24; border-radius: 12px; padding: 10px 10px 8px; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.3); transition: transform .1s, filter .1s; }
  .rg-srv:hover:not([disabled]) { transform: translateY(-2px); filter: brightness(1.12); }
  .rg-srv[disabled] { opacity: .5; cursor: default; }
  .rg-srv.cur { border-color: #9AE6FF; box-shadow: 0 0 0 2px #9AE6FF inset, 0 3px 0 rgba(0,0,0,.3); }
  .rg-srv b { font-family: var(--f-display); font-size: 18px; }
  .rg-srv em { position: absolute; right: 6px; top: 6px; font-style: normal; font-size: 11px; background: #3DDC84; color: #0A0E24; border-radius: 6px; padding: 0 6px; }
  .rg-srv em.me { background: #9AE6FF; }
  .rg-srv .bar { height: 8px; background: #0A0E24; border-radius: 4px; overflow: hidden; }
  .rg-srv .bar i { display: block; height: 100%; border-radius: 4px; }
  .rg-srv small { font-size: 12px; color: #C9D0F0; }
  .rg-srvact { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 6px; }
  .rg-srvact .rg-mini { font-size: 15px; padding: 8px 16px; }
  /* v41 가게 사람 (초상화 + 말풍선) */
  .rg-npc { display: flex; gap: 12px; align-items: center; background: linear-gradient(90deg, rgba(255,255,255,.09), rgba(255,255,255,.02)); border: 2px solid #0A0E24; border-radius: 12px; padding: 8px 12px; margin: 0 0 10px; }
  .rg-npc img { width: 64px; height: 64px; flex: none; image-rendering: pixelated; border-radius: 10px; background: radial-gradient(circle at 50% 30%, #5C86FF, #2F3FA0); border: 2px solid #0A0E24; }
  .rg-npc b { font-family: var(--f-display); font-size: 17px; }
  .rg-npc p { position: relative; margin: 4px 0 0 6px; background: #FFFDF4; color: #1D2340; border: 2px solid #0A0E24; border-radius: 10px; padding: 6px 10px; font-size: 14px; line-height: 1.45; }
  .rg-npc p::before { content: ''; position: absolute; left: -9px; top: 10px; border: 7px solid transparent; border-right-color: #0A0E24; border-left: 0; }
  .rg-npc p::after { content: ''; position: absolute; left: -5px; top: 12px; border: 5px solid transparent; border-right-color: #FFFDF4; border-left: 0; }
  /* v41 가방 창 */
  .rg-inv { display: grid; grid-template-columns: 272px 1fr; gap: 12px; align-items: start; }
  .rg-doll, .rg-bag { background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.14)); border: 2px solid #0A0E24; border-radius: 14px; padding: 10px; box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
  .rg-dollgrid { display: grid; grid-template-columns: 64px 1fr 64px; grid-template-rows: repeat(3, 70px); grid-template-areas: "helmet fig weapon" "armor fig ring" "boots fig ."; gap: 6px; }
  .rg-fig { grid-area: fig; position: relative; border-radius: 12px; background: radial-gradient(ellipse at 50% 88%, rgba(255,210,63,.38), transparent 40%), radial-gradient(circle at 50% 35%, #4A5AB0, #1A2148 75%); border: 2px solid #0A0E24; display: grid; place-items: center; overflow: hidden; }
  .rg-fig img { height: 174px; image-rendering: pixelated; filter: drop-shadow(0 4px 0 rgba(0,0,0,.35)); }
  .rg-fig .lv { position: absolute; left: 6px; top: 6px; background: #FFD23F; color: #1D2340; border: 2px solid #0A0E24; border-radius: 6px; font-size: 12px; padding: 0 6px; font-family: var(--f-display); }
  .rg-eqs { position: relative; display: grid; place-items: center; background: radial-gradient(circle at 35% 30%, #2E3870, #0F1430 70%); border: 2px solid var(--c); border-radius: 10px; cursor: pointer; padding: 0 0 10px; color: #EEF1FF; transition: transform .1s, filter .1s; }
  .rg-eqs img { width: 42px; height: 42px; image-rendering: pixelated; }
  .rg-eqs small { position: absolute; bottom: 2px; left: 0; right: 0; font-size: 10px; color: #AEB7E0; text-align: center; }
  .rg-eqs.empty { border-style: dashed; border-color: #3A4270; }
  .rg-eqs img.ph { opacity: .2; filter: grayscale(1) brightness(1.6); }
  .rg-eqs.rare, .rg-cell.rare { box-shadow: 0 0 10px var(--g), inset 0 0 0 1px var(--g); }
  .rg-eqs.sel, .rg-cell.sel { outline: 3px solid #FFD23F; outline-offset: 1px; }
  .rg-statgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 10px 0; }
  .rg-statgrid div { white-space: nowrap; gap: 4px; background: #141A3C; border: 2px solid #0A0E24; border-radius: 8px; padding: 3px 7px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
  .rg-statgrid b { color: #FFFFFF; font-family: var(--f-display); font-size: 14px; }
  .rg-bag .rg-tabs { margin-top: 0; }
  .rg-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; }
  .rg-cell { position: relative; aspect-ratio: 1; display: grid; place-items: center; background: radial-gradient(circle at 35% 30%, #2A3266, #12183A 75%); border: 2px solid var(--c, #2A3260); border-radius: 8px; padding: 0; cursor: pointer; transition: transform .1s, filter .1s; min-width: 0; }
  .rg-cell.empty { background: rgba(10,14,36,.5); border: 2px solid #20264E; cursor: default; box-shadow: inset 0 2px 4px rgba(0,0,0,.4); }
  .rg-cell img { width: 78%; height: 78%; image-rendering: pixelated; }
  .rg-cell .n { position: absolute; right: 3px; bottom: 0; font-size: 12px; font-family: var(--f-display); color: #FFFFFF; text-shadow: 0 0 2px #0A0E24, 0 0 3px #0A0E24; }
  .rg-cell .lk { position: absolute; left: 0; right: 0; bottom: 0; background: rgba(210,52,58,.88); font-size: 10px; color: #FFFFFF; border-radius: 0 0 6px 6px; line-height: 1.3; }
  .rg-cell.off img { filter: grayscale(.7) brightness(.8); }
  .rg-cell:not(.empty):hover, .rg-eqs:hover { transform: translateY(-1px); filter: brightness(1.15); }
  .rg-detail { display: flex; gap: 10px; align-items: center; margin-top: 10px; background: #141A3C; border: 2px solid #0A0E24; border-radius: 10px; padding: 8px 10px; min-height: 60px; }
  .rg-detail.hint { display: block; color: #AEB7E0; font-size: 13px; line-height: 1.5; }
  /* v68 팔기 · 쓰레기통 */
  .rg-price { color: #FFD23F; }
  /* v72 가방 늘리기 · 강화 경고 */
  .rg-bagup { display: flex; align-items: center; gap: 10px; background: linear-gradient(180deg, #2A4A9A, #1D2A6A); border: 2px solid #FFD23F; border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
  .rg-bagup .ic { font-size: 26px; } .rg-bagup .grow { display: grid; } .rg-bagup small { color: #BDE8FF; }
  .rg-anvil .danger { display: block; margin-top: 6px; background: #FF3A3A; color: #FFFFFF; border-radius: 8px; padding: 6px 8px; font-weight: 700; animation: rgBlink 1s steps(2) infinite; }
  @keyframes rgBlink { 50% { background: #B8102A; } }
  .rg-res.down b { color: #FFB86B; }
  .rg-anvil .ladder span.risk { box-shadow: inset 0 -4px 0 #FF3A3A; }
  /* v69 저승문 */
  .rg-story p { margin: 0 0 8px; line-height: 1.6; background: #1A1438; border-left: 4px solid #B8A8FF; padding: 8px 10px; border-radius: 6px; }
  .rg-gate { background: linear-gradient(180deg, #3A1220, #1A0A18); border: 2px solid #FF5A5F; border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
  .rg-gate .gt { font-size: 16px; color: #FFD23F; } .rg-el { display: inline-block; margin-left: 6px; background: #FFD23F; color: #1D2340; border-radius: 999px; padding: 1px 8px; font-size: 12px; } .rg-gate .gt small { color: #FFB0B8; font-size: 12px; margin-left: 6px; }
  .rg-stages { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
  .rg-stage { display: grid; gap: 1px; text-align: center; background: #FFD23F; color: #1D2340; border: 2px solid #0A0E24; border-radius: 8px; padding: 6px 4px; cursor: pointer; font-family: inherit; }
  .rg-stage b { font-size: 16px; } .rg-stage span { font-size: 11px; } .rg-stage small { font-size: 10px; } .rg-stage i { font-style: normal; font-size: 11px; font-weight: 700; }
  .rg-stage.done { background: #3DDC84; } .rg-stage[disabled] { background: #2A325E; color: #9AA8E8; cursor: default; border-style: dashed; }
  @media (max-width: 700px) { .rg-stages { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .rg-mini.warn { background: #FF5A5F; color: #FFFFFF; }
  .rg-row.ask { border-color: #FF5A5F; background: linear-gradient(180deg, #4A1E3A, #2A1430); }
  .rg-sellall { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: #1E3A6E; border: 2px solid #4C7DFF; border-radius: 10px; padding: 6px 10px; margin: 0 0 8px; font-size: 13px; }
  .rg-sellall > span, .rg-sellall > b { flex: 1; min-width: 160px; }
  .rg-tabs .rg-trash { margin-left: auto; background: #3A2A10; color: #FFD23F; border-color: #FFB020; }
  .rg-tabs .rg-trash.on { background: #FF5A5F; color: #FFFFFF; border-color: #0A0E24; }
  .rg-trashtip { margin: -4px 0 8px; padding: 5px 9px; background: #FFD23F; color: #1D2340; border-radius: 8px; font-size: 13px; font-weight: 700; }
  .rg-grid.trashing .rg-cell:not(.empty) { cursor: crosshair; outline: 2px dashed #FF5A5F; outline-offset: -3px; }
  .rg-warnbg { position: absolute; inset: 0; background: rgba(6, 8, 24, .72); display: grid; place-items: center; z-index: 5; padding: 12px; }
  .rg-warn { width: min(360px, 100%); background: linear-gradient(180deg, #3A1630, #1A1030); border: 3px solid #FF5A5F; border-radius: 12px; padding: 14px; text-align: center; box-shadow: 0 6px 0 rgba(0,0,0,.4); }
  .rg-warn .t { display: block; font-family: var(--f-display); font-size: 22px; color: #FFD23F; margin-bottom: 6px; }
  .rg-warn img { width: 48px; height: 48px; image-rendering: pixelated; }
  .rg-warn .nm { font-weight: 700; margin: 4px 0; }
  .rg-warn p { margin: 4px 0; font-size: 13px; line-height: 1.5; }
  .rg-warn .btns { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 10px; }
  .rg-warn .btns .rg-mini { font-size: 15px; padding: 7px 14px; }
  .rg-detail .grow { flex: 1; min-width: 0; }
  .rg-detail .nm { display: block; font-size: 15px; } .rg-detail .nm.rare { color: #E0C8FF; } .rg-detail .nm small { color: #9AF0B0; font-size: 11px; }
  .rg-detail .ds { display: block; color: #AEB7E0; font-size: 12px; }
  .rg-detail .cmp { display: flex; flex-wrap: wrap; gap: 2px 10px; font-size: 12px; margin-top: 3px; }
  .rg-detail em { font-style: normal; } .rg-detail em.up { color: #3DDC84; } .rg-detail em.dn { color: #FF8A8E; }
  .rg-side .panel { margin: 0; }
  /* v60 장비 옵션 · 강화 */
  .rg-icw { position: relative; display: inline-flex; flex: none; }
  .rg-en { position: absolute; right: -4px; top: -6px; background: #FFD23F; color: #1D2340; border: 2px solid #0A0E24; border-radius: 8px; font: 11px/1.2 var(--f-display); padding: 0 4px; }
  .rg-cell .en { position: absolute; left: 2px; top: 0; font-size: 11px; font-family: var(--f-display); color: #FFE45C; text-shadow: 0 0 2px #0A0E24, 0 0 3px #0A0E24; }
  .rg-cell .gd { position: absolute; right: 3px; top: 3px; width: 7px; height: 7px; border-radius: 50%; background: var(--gd); box-shadow: 0 0 0 1px #0A0E24; }
  .rg-opts { display: flex; flex-wrap: wrap; gap: 3px 6px; margin-top: 4px; padding: 0; list-style: none; }
  .rg-opts li { font-size: 12px; background: rgba(255,255,255,.06); border: 1px solid #2A3266; border-radius: 6px; padding: 1px 6px; }
  .rg-opts li.pos { color: #9AF0B0; } .rg-opts li.neg { color: #FF8A8E; }
  .rg-grade { font-size: 11px; border: 1px solid currentColor; border-radius: 6px; padding: 0 5px; margin-left: 4px; vertical-align: 2px; }
  .rg-forge { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 10px; }
  .rg-forge .rg-list { max-height: 330px; overflow-y: auto; }
  .rg-forge .rg-row.sel { outline: 3px solid #FFD23F; outline-offset: -1px; }
  .rg-anvil { min-height: 300px; background: radial-gradient(circle at 50% 20%, rgba(255,138,61,.22), rgba(20,26,60,.95) 60%); border: 2px solid #0A0E24; border-radius: 12px; padding: 10px 12px; position: relative; overflow: hidden; }
  .rg-anvil .big { display: flex; gap: 10px; align-items: center; }
  .rg-anvil .big .rg-ic { width: 64px; height: 64px; }
  .rg-anvil .ladder { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; margin: 10px 0 6px; }
  .rg-anvil .ladder span { text-align: center; font-size: 11px; border-radius: 5px; padding: 2px 0; background: #141A3C; border: 1px solid #2A3266; color: #C9D0F0; }
  .rg-anvil .ladder span.done { background: #FFD23F; color: #1D2340; border-color: #0A0E24; }
  .rg-anvil .ladder span.next { background: #FF8A3D; color: #1D2340; border-color: #0A0E24; animation: rgShine 1.2s ease-in-out infinite; --g: #FF8A3D; }
  .rg-anvil .go { display: block; width: 100%; margin-top: 8px; font: 18px var(--f-display); padding: 10px; border-radius: 10px; border: 3px solid #0A0E24; background: linear-gradient(180deg, #FFB86B, #FF6A3D); color: #1D2340; cursor: pointer; box-shadow: 0 4px 0 #0A0E24; }
  .rg-anvil .go:disabled { background: #2A325E; color: #AEB7E0; cursor: default; box-shadow: none; }
  .rg-anvil .go.warn { background: linear-gradient(180deg, #FF8A8E, #D2343A); color: #FFFFFF; }
  .rg-anvil .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rg-anvil .warnbox { margin-top: 8px; background: rgba(210,52,58,.2); border: 2px solid #D2343A; border-radius: 8px; padding: 6px 8px; font-size: 13px; color: #FFD0D2; }
  .rg-res { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; z-index: 2; animation: rgPop .45s cubic-bezier(.2,1.6,.4,1); }
  .rg-res.ok { background: radial-gradient(circle, #6A5A20, #141A3C 70%); }
  .rg-res.bad { background: radial-gradient(circle, #6A2028, #141A3C 70%); }
  .rg-res img { width: 150px; height: 150px; object-fit: contain; animation: rgFloat 1.6s ease-in-out infinite; }
  .rg-res.ok img { filter: drop-shadow(0 0 10px #FFE45C) drop-shadow(0 0 22px #FFB86B); }
  .rg-res.bad img { filter: drop-shadow(0 0 10px #FF5A5F); }
  @keyframes rgFloat { 50% { transform: translateY(-6px); } }
  .rg-res b { display: block; font: 26px var(--f-display); } .rg-res.ok b { color: #FFE45C; } .rg-res.bad b { color: #FF8A8E; }
  .rg-res small { display: block; color: #EEF1FF; font-size: 14px; margin-top: 2px; }
  .rg-res .x2 { margin-top: 8px; }
  .rg-res .ham { font: 64px var(--f-display); line-height: 1; }
  @keyframes rgPop { 0% { transform: scale(.85); } 100% { transform: scale(1); } }
  .rg-defgrid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 8px; }
  .rg-defgrid div { background: #141A3C; border: 2px solid #0A0E24; border-radius: 8px; padding: 3px 4px; text-align: center; font-size: 11px; }
  .rg-defgrid b { display: block; font: 14px var(--f-display); color: #FFFFFF; }
  @media (max-width: 640px) { .rg-forge { grid-template-columns: 1fr; } .rg-defgrid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-height: 520px) {   /* 휴대폰 가로: 게임판을 화면 높이에 꽉 차게 */
    .rg-page .cabinet { max-width: min(100%, calc((100svh - 14px) * 1.7778 + 8px)); padding: 3px; border-radius: 8px; border-width: 2px; }
    .rg-page .screen { border-width: 1px; }
    .rg-detailgrid { grid-template-columns: repeat(4, 1fr); }
    .rg-panel { position: fixed; inset: 6px 8% 6px 8%; max-height: none; z-index: 60; }
  }
  @media (max-width: 760px) {
    .rg-inv { grid-template-columns: 1fr; } .rg-grid { grid-template-columns: repeat(6, 1fr); } .rg-srvs { grid-template-columns: repeat(2, 1fr); }
    .rg-statwin { grid-template-columns: 1fr; } .rg-detailgrid { grid-template-columns: repeat(2, 1fr); } .rg-trade { grid-template-columns: 1fr; }
    .rg-panel { position: fixed; inset: auto 0 0 0; max-height: 72svh; border-radius: 14px 14px 0 0; z-index: 60; }
    .rg-msg { font-size: 12px; }
  }`;

  /* ================= 본체 ================= */
  window.GoRPG = {
    render(el, A) {
      BGM.load(GAME);
      const syncBgm = () => { const b = el.querySelector('#rgBgm'); if (b) b.textContent = BGM.isMuted() ? '♪ 음악 켜기' : '♪ 음악 끄기'; };   // v73
      if (!document.getElementById('rgCss')) { const st = document.createElement('style'); st.id = 'rgCss'; st.textContent = CSS; document.head.appendChild(st); }
      el.innerHTML = `
        <div class="rg-page">
          <div class="play-head"><a class="back" href="#home">← 게임 목록</a><span class="cat">RPG</span><h1>${CFG.name}</h1></div>
          <div class="rg-wrap">
            <div class="cabinet cab-blue" style="--cw:960px;--ar:1.7778"><div class="screen" id="rgScreen" tabindex="0">
              <canvas id="rgCanvas" aria-label="${CFG.name} 게임 화면"></canvas>
              <div class="rg-msg" id="rgMsg" hidden></div>
              <button type="button" class="rg-full" id="rgFull" aria-label="화면 크게 보기"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>
              <div class="rg-panel" id="rgPanel" hidden></div>
            </div></div>
            <div class="rg-bar">
              <button type="button" class="btn" data-rg="stat">스탯 (C)</button>
              <button type="button" class="btn" data-rg="inv">가방 · 장비 (I)</button>
              <button type="button" class="btn" data-rg="skill">마법 (K)</button>
              <button type="button" class="btn" data-rg="servers">서버</button>
              <button type="button" class="btn" data-rg="help">도움말</button>
              <button type="button" class="btn" data-rg="full">크게 보기</button>
              <a class="btn" href="#scfight" style="background:#9A5AE0;color:#fff">Skillcom Fight 대결</a>
              <button type="button" class="btn" data-rg="bgm" id="rgBgm">♪ 음악 끄기</button>
              <button type="button" class="btn btn-sun" data-rg="save">지금 저장</button>
            </div>
            <div class="rg-side">
              <div id="rgChatBox"></div>
              <div class="panel"><h3>레벨 랭킹</h3><ol class="rank" id="rgRank"><li class="empty">불러오는 중…</li></ol><p class="small" id="rgMine"></p></div>
            </div>
          </div>
          <div class="rg-cm">${window.GoSocial ? window.GoSocial.commentsHTML(CFG.name) : ''}</div>
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
      // 능력치 = 레벨 기본 + 스탯(힘·민첩·지혜·체력·저항) + 장비(강화 포함) + 장비 옵션(%).  part = 창에서 '기본 + 스탯 + 장비 + 옵션' 으로 나눠 보여 줄 때
      //  v60 pdef = 물리 방어 %, edefs[원소] = 속성 방어 % (저항 0.5%/포인트 + 옵션, 최대 75%)
      function stats(part) {
        const F = D.F, T = D.STAT, lv = S.lv, a = S.stat || {};
        const base = { atk: F.atk(lv), mag: F.mag(lv), def: F.def(lv), hp: F.hp(lv), mp: F.mp(lv), spd: 0, dmg: 0, mpRegen: 100, crit: T.baseCrit, pdef: 0, edef: 0 };
        const sta = { dmg: (a.str || 0) * T.str.dmg, spd: (a.dex || 0) * T.dex.spd, mpRegen: (a.int || 0) * T.int.mpRegen, hp: Math.round(base.hp * (a.vit || 0) * T.vit.hpPct / 100), pdef: (a.res || 0) * T.res.pdef, edef: (a.res || 0) * T.res.edef };
        const gear = {}, opt = {};
        Object.values(S.eq).forEach(id => { const it = ITEMS[id]; if (!it) return; if (it.st) Object.keys(it.st).forEach(k => { gear[k] = (gear[k] || 0) + it.st[k]; }); (it.op || []).forEach(o => { opt[o[0]] = r1((opt[o[0]] || 0) + o[1]); }); });
        if (part) return { base, sta, gear, opt };
        const st = {}, o = q => opt[q] || 0; Object.keys(base).forEach(k => { st[k] = base[k] + (sta[k] || 0) + (gear[k] || 0); });
        st.atk *= 1 + o('atkP') / 100; st.mag *= 1 + o('magP') / 100; st.hp *= 1 + o('hpP') / 100; st.mp *= 1 + o('mpP') / 100;
        st.spd = r1(st.spd + o('spdP')); st.crit = r1(st.crit + o('crit')); st.dmg = r1(st.dmg + o('dmg')); st.mpRegen = r1(st.mpRegen + o('mpReg'));
        st.goldP = o('goldP'); st.expP = o('expP'); st.critD = T.critDmg + o('critD') / 100;
        const cap = v => clamp(r1(v), -50, T.defCap);
        st.pdef = cap(st.pdef + o('pdef')); st.edefs = {}; Object.keys(ELEM).forEach(e => { st.edefs[e] = cap(st.edef + o('e_all') + o('e_' + e)); });
        ['atk', 'mag', 'def', 'hp', 'mp'].forEach(k => { st[k] = Math.max(1, Math.round(st[k])); });
        st.atkCd = T.atkCd;
        return st;
      }
      let ST = null; const restat = () => { ST = stats(); S.hp = clamp(S.hp, 0, ST.hp); S.mp = clamp(S.mp, 0, ST.mp); };

      /* ---------- 가방 ---------- */
      const count = id => (S.inv.find(x => x.id === id) || { n: 0 }).n;
      const bagMax = () => D.BAG.base + D.BAG.step * Math.min(D.BAG.max, S.bagUp || 0);   // v72 가방 칸 (약방에서 늘림)
      function addItem(id, n) {
        n = n || 1; const e = S.inv.find(x => x.id === id);
        if (e) { e.n += n; return true; }
        if (S.inv.length >= bagMax()) { say(`가방이 가득 찼어요! (${bagMax()}칸) 약방에서 가방을 늘릴 수 있어요`); return false; }
        S.inv.push({ id, n }); return true;
      }
      function takeItem(id, n) { n = n || 1; const e = S.inv.find(x => x.id === id); if (!e || e.n < n) return false; e.n -= n; if (!e.n) S.inv.splice(S.inv.indexOf(e), 1); return true; }

      /* ---------- 글자 띄우기 ---------- */
      let msgT = 0;
      function say(t, sec) { msgEl.textContent = t; msgEl.hidden = false; msgT = sec || 2.4; }
      const float = (x, y, text, color, big) => G.texts.push({ x, y, text, color: color || '#FFFFFF', t: 0, big });

      /* ---------- 지도 들어가기 ---------- */
      function enter(id, side, quiet) {
        const M = MAPBY[id]; if (!M) return;
        const map = getMap(id);
        G.map = map; S.map = id; G.room = null; G.npcs = M.kind === 'village' ? villagers(map).concat(smithNpc(map), hellNpc(map)) : []; G.hellRun = null; G.onNpc = null; G.shots = []; G.fxs = []; G.pools = []; G.texts = []; Fx.reset(); G.hpGhost = null;
        if (!quiet) G.title = { t: 0, text: M.kind === 'village' ? M.name : M.name, sub: M.hell ? `저승 ${M.gate}관문 · 몬스터 Lv.${100 + (M.gate - 1) * 5 + M.stage}${M.stage >= 5 ? ' · 대왕 Lv.' + M.rec : M.stage >= 3 ? ` · ${D.HELL.kills}마리 뒤 ${M.stage === 3 ? '옥졸' : '판관'}` : ` · ${D.HELL.kills}마리 잡으면 통과`}` : M.kind === 'village' ? (D.REGIONS[M.region].castle ? '마지막 마을 · 도원수 진영' : `마을 ${M.region + 1}`) : `사냥터 ${M.no} · 권장 Lv.${M.rec}${M.boss ? ' · 보스' : ''}` };
        const p = side && typeof side === 'object' ? side : side === 'R' ? map.startR : side === 'door' ? doorFront(map) : side === 'pos' && S.x ? { x: S.x, y: S.y } : map.startL;
        G.px = p.x; G.py = p.y;
        if (solidAt(map, G.px, G.py)) { const q = map.startL; G.px = q.x; G.py = q.y; }
        if (!S.visited.includes(id)) S.visited.push(id);
        if (M.kind === 'village') { S.home = id; spawnNone(); }
        else { spawnAll(); if (!M.hell && M.rec > S.lv + 6) say(`권장 Lv.${M.rec} — 지금 레벨로는 위험해요!`, 3); }
        G.onDoor = null; markDirty(!quiet); netRoom();
      }
      // v41 건물 안: 문으로 걸어 들어가면 실내 지도 · 아래 가운데 문으로 나가면 그 건물 문 앞
      function enterRoom(b) {
        const vmap = G.map, back = { x: (b.door.x + 0.5) * TS, y: (b.door.y + 1.9) * TS }, room = getRoom(b.type, vmap.M.region);
        G.map = room; G.room = { type: b.type, back, village: S.map }; G.npcs = room.npcs.map(n => Object.assign({}, n)); G.onNpc = null;
        G.mons = []; G.shots = []; G.fxs = []; G.pools = []; G.texts = []; Fx.reset(); G.hpGhost = null;
        G.px = room.startL.x; G.py = room.startL.y; G.fx = 0; G.fy = -1; G.onDoor = null; G.keys = {};
        const main = G.npcs.find(n => !n.guard);
        G.title = null; say(main ? `${main.def.name}에게 가까이 가면 이야기할 수 있어요` : room.M.name, 2.6);
        netRoom();
      }
      /* ---------- v42 온라인 (net.js) ---------- */
      const roomKey = () => (G.room ? 'r-' + G.room.type + '-' + G.map.M.region : S.map);
      const netRoom = () => { if (net && net.joined) net.setRoom(roomKey()); };
      let net = null;
      const baseEq = () => { const o = {}; Object.keys(S.eq).forEach(k => { const it = ITEMS[S.eq[k]]; if (it) o[k] = it.base || it.id; }); return o; };   // v60 다른 사람에게는 기본 장비 id 만 (그림용)
      function makeNet() {
        net = window.GoRPGNet.create({
          me: () => ({ nick: Hub.user ? Hub.user.nickname : '손님', lv: S.lv, av: Hub.user ? Hub.user.avatar : AV.normalize({}), eq: baseEq(), hide: S.hide, x: G.px, y: G.py }),
          onPeers: () => {},
          onFx: (m, p) => peerFx(m, p),
          onTrade: (m, p) => onTrade(m, p),
          onLeave: cid => { if (G.trade && G.trade.with === cid) { say('상대가 떠나서 거래가 취소됐어요', 2.6); endTrade(false); } },
          onKick: why => { say(why === 'full' ? '서버 인원이 가득 차서 나왔어요. 다른 서버를 골라 주세요' : '서버 연결이 끊겼어요. 다시 골라 주세요', 4); if (!pane) openPanel('servers'); }
        });
      }
      /* ---------- v44 1:1 거래 ----------
       *  같은 지도에 있는 사람을 누르거나(F 키: 가까운 사람) → 거래 신청 → 상대가 수락 → 서로 아이템·골드를 올림
       *  둘 다 '확인'을 누르면 교환. 올린 것이 바뀌면 확인이 풀림. 입고 있는 장비는 못 올림(가방에 있는 것만)
       *  확인은 '두 사람이 올린 것 전체'를 글자로 만든 열쇠(key)로 맞춰 봄 → 둘이 본 내용이 같을 때만 교환 */
      const offerOf = o => ({ items: Object.keys(o.items).filter(id => o.items[id] > 0).sort().map(id => [id, o.items[id]]), gold: o.gold | 0 });
      const tradeKey = () => { const T = G.trade, a = JSON.stringify(offerOf(T.mine)), b = JSON.stringify(offerOf(T.theirs)); return Hub.clientId < T.with ? a + '|' + b : b + '|' + a; };
      function cleanOffer(m) {
        // v60 장비(g:uid)는 장비 정보(defs)도 함께 받음 → 확인해서 ITEMS 에 등록 (내 장비와 번호가 같으면 무시)
        const items = {}, defs = {}, md = m.defs && typeof m.defs === 'object' ? m.defs : {};
        (Array.isArray(m.items) ? m.items : []).slice(0, 12).forEach(x => {
          if (!Array.isArray(x)) return; const id = String(x[0]);
          if (id.startsWith('g:')) { const u = id.slice(2), g = /^[a-z0-9]{4,16}$/.test(u) && !S.gear[u] && validGear(md[u]); if (!g) return; defs[u] = g; regGear(u, g); items[id] = 1; return; }
          if (ITEMS[id] && ITEMS[id].stack) items[id] = clamp(Math.floor(+x[1] || 0), 0, 999);
        });
        return { items, defs, gold: clamp(Math.floor(+m.gold || 0), 0, 1e9) };
      }
      function askTrade(pp) {
        if (!net || !net.joined) return;
        if (G.trade) { say('이미 거래 중이에요', 2); return; }
        openPanel('tradeAsk', { pp });
      }
      function sendOffer() { const T = G.trade; T.myOk = false; T.theirOk = false; const o = offerOf(T.mine), defs = {}; o.items.forEach(x => { if (x[0].startsWith('g:') && S.gear[x[0].slice(2)]) defs[x[0].slice(2)] = S.gear[x[0].slice(2)]; }); net.trade({ k: 'offer', to: T.with, items: o.items, gold: o.gold, defs }); }
      function startTrade(cid, nick) {
        G.trade = { with: cid, nick, state: 'open', mine: { items: {}, gold: 0 }, theirs: { items: {}, defs: {}, gold: 0 }, myOk: false, theirOk: false };
        tab.trSel = null; openPanel('trade');
      }
      function endTrade(tell) {
        const T = G.trade; if (!T) return;
        if (tell) net.trade({ k: 'cancel', to: T.with });
        G.trade = null; if (pane === 'trade' || pane === 'tradeIn') { pane = null; panel.hidden = true; G.paused = false; }
      }
      function roomFor(theirs, mine) {   // 받을 물건이 가방 40칸에 들어가나
        let slots = S.inv.length;
        Object.keys(mine.items).forEach(id => { if (mine.items[id] > 0 && mine.items[id] >= count(id)) slots--; });
        Object.keys(theirs.items).forEach(id => { if (theirs.items[id] > 0 && !(count(id) - (mine.items[id] || 0) > 0)) slots++; });
        return slots <= bagMax();
      }
      function applyTrade() {
        const T = G.trade; if (!T) return;
        const ok = Object.keys(T.mine.items).every(id => count(id) >= T.mine.items[id]) && S.gold >= T.mine.gold;
        if (!ok) { say('가방이 바뀌어서 거래를 할 수 없어요', 3); endTrade(true); return; }
        Object.keys(T.mine.items).forEach(id => { if (T.mine.items[id] > 0) takeItem(id, T.mine.items[id]); });
        S.gold -= T.mine.gold;
        Object.keys(T.mine.items).forEach(id => { if (id.startsWith('g:') && !count(id)) delete S.gear[id.slice(2)]; });
        Object.keys(T.theirs.items).forEach(id => {
          const n = T.theirs.items[id]; if (!(n > 0)) return;
          if (id.startsWith('g:')) { const u = id.slice(2), g = T.theirs.defs && T.theirs.defs[u]; if (!g || S.gear[u]) return; S.gear[u] = g; regGear(u, g); S.inv.push({ id, n: 1 }); return; }
          const e = S.inv.find(x => x.id === id); if (e) e.n += n; else S.inv.push({ id, n });
        });
        S.gold += T.theirs.gold;
        const nick = T.nick; G.trade = null; save(true); markDirty(true);
        if (pane === 'trade') { pane = null; panel.hidden = true; G.paused = false; }
        say(`${nick}님과 거래 완료!`, 3); Fx.coins(G.px, G.py - 30, 8);
      }
      function onTrade(m, p) {
        const T = G.trade, nick = p.nick || '상대';
        if (m.k === 'req') {
          if (T || pane || G.dead) { net.trade({ k: 'busy', to: m.cid }); return; }
          openPanel('tradeIn', { cid: m.cid, nick }); return;
        }
        if (!T || T.with !== m.cid) return;
        if (m.k === 'busy' || m.k === 'no') { say(m.k === 'busy' ? `${nick}님은 지금 다른 일을 하고 있어요` : `${nick}님이 거래를 거절했어요`, 2.6); G.trade = null; return; }
        if (m.k === 'yes' && T.state === 'wait') { startTrade(m.cid, nick); return; }
        if (m.k === 'cancel') { say(`${nick}님이 거래를 취소했어요`, 2.6); endTrade(false); return; }
        if (m.k === 'offer') { T.theirs = cleanOffer(m); T.myOk = false; T.theirOk = false; if (pane === 'trade') renderPanel(); return; }
        if (m.k === 'ok') { T.theirOk = m.key === tradeKey(); if (T.myOk && T.theirOk && Hub.clientId < T.with) { net.trade({ k: 'commit', to: T.with, key: tradeKey() }); applyTrade(); return; } if (pane === 'trade') renderPanel(); return; }
        if (m.k === 'unok') { T.theirOk = false; if (pane === 'trade') renderPanel(); return; }
        if (m.k === 'commit') { if (T.myOk && m.key === tradeKey()) applyTrade(); return; }
      }
      // 화면 좌표(캔버스) → 그 자리에 있는 다른 플레이어
      function peerAt(q) {
        if (!net || !net.peers.size) return null;
        const wx = q.x + cam.x, wy = q.y + cam.y; let best = null, bd = 40;
        net.peers.forEach(pp => { if (wy < pp.y - 70 || wy > pp.y + 8) return; const d = Math.abs(wx - pp.x); if (d < bd) { bd = d; best = pp; } });
        return best;
      }
      // 다른 사람이 쓴 마법: 그림만 (피해 없음)
      function peerFx(m, p) {
        const sk = skill(m.id); if (!sk) return;
        const els = sk.els, x = m.x, y = m.y, dx = m.dx || 1, dy = m.dy || 0, col = ELEM[els[0]].color, col2 = ELEM[els[els.length - 1]].light;
        Fx.castCircle(p.x, p.y, els, !!sk.fusion);
        if (sk.kind === 'bolt') { const n = sk.count || 1, sp = 430 * (sk.speed || 1); for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.18; G.shots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1, dmg: 0, els, pierce: true, hit: new Set(), r: 9, color: col, color2: col2, mine: false, ghost: true }); } }
        else if (sk.kind === 'nova') Fx.nova(x, y, sk.radius || 120, els);
        else if (sk.kind === 'beam') Fx.beam(x, y, dx, dy, sk.len || 300, sk.w || 30, els);
        else if (sk.kind === 'rain') { for (let i = 0; i < (sk.count || 5); i++) Fx.fall(x + dx * 160 + rand(-90, 90), y + dy * 160 + rand(-60, 60), sk.radius || 60, els, i * 0.1); }
        else if (sk.kind === 'pool') Fx.nova(x + dx * 120, y + dy * 120, (sk.radius || 90) * 0.7, els);
        else if (sk.kind === 'heal') Fx.heal(p.x, p.y - 28, sk.pow > 0.4);
        else if (sk.kind === 'shield') Fx.burst(p.x, p.y - 28, 16, Fx.pal(els[0]), { min: 60, max: 140, shape: 'star', lmin: 0.4, lmax: 0.7 });
      }
      function leaveRoom() {
        const r = G.room; if (!r) return;
        enter(r.village, r.back, true);
        G.onDoor = G.map.doors.find(d => d.type === r.type) || null; G.fx = 0; G.fy = 1;
      }
      function doorFront(map) {
        const b = map.buildings.find(x => x.type === 'chief') || map.buildings[0];
        return { x: (b.door.x + 0.5) * TS, y: (b.door.y + 1.9) * TS };
      }
      function spawnNone() { G.mons = []; }
      function spawnAll() {
        const M = G.map.M; G.mons = [];
        if (M.hell) return spawnHell();
        if (M.boss) {
          G.mons.push(makeMon(M.mon, M.rec + 2, true));
          const minion = D.MAPS.find(m => m.kind === 'field' && m.no === M.no - 1);
          for (let i = 0; i < 6; i++) G.mons.push(makeMon(minion.mon, M.rec - 1));
        } else for (let i = 0; i < 12; i++) G.mons.push(makeMon(M.mon, M.rec - 1 + (Math.random() < 0.5 ? 0 : 1)));
      }
      /* v69 저승 보스 기술: 기술 목록(data.js HELL.gates 의 skills)에서 골라 씀. 체력 절반 아래 = 분노(더 자주·더 많이)
       *  slam 내려찍기 · charge 돌진 · blades 칼비 · ring 사방 탄 · fan 부채꼴 탄 · summon 망령 3마리 */
      const SKILL_NAME = { slam: '내려찍기!', charge: '돌진!', blades: '칼비가 쏟아진다!', ring: '사방 원혼탄!', fan: '판결의 붓!', summon: '망령을 부른다!' };
      function bossShot(m, a, sp, dmgK) { const E = ELEM[m.el || 'earth']; G.shots.push({ x: m.x, y: m.y - m.spr.h / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2.2, dmg: m.atk * dmgK, lvl: m.lvl, r: 7, color: E.color, color2: E.light, mine: false, monEl: 'dark', el: m.el || 'earth' }); }
      function bossSkill(m, dt, d) {
        const rage = m.hp < m.max * 0.5, c = m.cast;
        if (c) {
          c.t += dt;
          if (c.k === 'blades' && c.t >= 1.0) {
            c.pts.forEach(q => { if (Math.hypot(G.px - q.x, G.py - 20 - q.y) < 46) hitPlayer(m.atk * 1.1, m.lvl, m.el); Fx.nova(q.x, q.y, 46, [m.el || 'earth', 'earth']); });
            G.shake = Math.max(G.shake, 7); m.cast = null;
          } else if (c.k === 'charge') {
            if (c.t >= 0.7 && c.t < 1.3) { moveMon(m, c.vx * dt, c.vy * dt); Fx.dust(m.x, m.y, '#FF8A6A'); if (!c.hit && Math.hypot(G.px - m.x, G.py - m.y) < m.r + 24) { c.hit = true; hitPlayer(m.atk * 1.6, m.lvl, m.el); G.shake = Math.max(G.shake, 8); } }
            else if (c.t >= 1.3) m.cast = null;
          } else if (c.t > 0.6) m.cast = null;
          return;
        }
        m.skCd -= dt * (rage ? 1.5 : 1);
        if (m.skCd > 0 || d > 460 || m.slam) return;
        const k = pick(m.def.skills); m.skCd = rand(3.2, 4.4);
        float(m.x, m.y - m.spr.h - 26, (rage ? '분노! ' : '') + SKILL_NAME[k], '#FF8A8E', true);
        const a0 = Math.atan2(G.py - 24 - (m.y - m.spr.h / 2), G.px - m.x);
        if (k === 'slam') m.slam = { t: 0, x: m.x, y: m.y - 20 };
        else if (k === 'blades') m.cast = { k, t: 0, pts: Array.from({ length: rage ? 7 : 5 }, (_, i) => ({ x: G.px + (i ? rand(-120, 120) : 0), y: G.py - 20 + (i ? rand(-80, 80) : 0) })) };
        else if (k === 'charge') { const a = Math.atan2(G.py - m.y, G.px - m.x); m.cast = { k, t: 0, a, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430 }; }
        else if (k === 'ring') { const n = rage ? 18 : 12; for (let i = 0; i < n; i++) bossShot(m, a0 + i / n * Math.PI * 2, 190, 0.7); m.cast = { k, t: 0 }; }
        else if (k === 'fan') { const n = rage ? 7 : 5; for (let i = 0; i < n; i++) bossShot(m, a0 + (i - (n - 1) / 2) * 0.2, 250, 0.8); m.cast = { k, t: 0 }; }
        else if (k === 'summon') {
          const g = D.HELL.gates[(G.map.M.gate || 1) - 1];
          if (G.mons.filter(x => !x.dead && !x.boss).length < 8) for (let i = 0; i < 3; i++) { const x = makeMon(i === 2 && g.mob2 ? g.mob2 : g.mob, m.lvl - 3); x.noRespawn = true; x.x = m.x + rand(-70, 70); x.y = m.y + rand(-40, 40); x.aggro = true; G.mons.push(x); Fx.death(x.x, x.y - 20, x.def.colors, false); }
          m.cast = { k, t: 0 };
        }
      }
      /* v69 저승 던전: 단계마다 몬스터 50마리 → (3단계 옥졸 · 4단계 판관) → 통과. 5단계는 대왕만 */
      function spawnHell() {
        const M = G.map.M, g = D.HELL.gates[M.gate - 1], s = M.stage, lv = 100 + (M.gate - 1) * 5 + s;
        G.hellRun = { gate: M.gate, stage: s, kills: 0, phase: s === 5 ? 'boss' : 'mob', lv };
        if (s === 5) { G.mons.push(makeMon(g.boss, lv + D.HELL.bossPlus, true)); G.title = { t: 0, text: g.boss.name, sub: g.boss.say }; return; }
        for (let i = 0; i < 12; i++) G.mons.push(makeMon(i % 3 === 2 && g.mob2 ? g.mob2 : g.mob, lv));
      }
      function hellKill(m) {
        const H = G.hellRun; if (!H || H.phase === 'done') return;
        const g = D.HELL.gates[H.gate - 1];
        if (m.boss) { m.noRespawn = true; hellClear(); return; }
        H.kills++;
        if (H.phase === 'mob' && H.kills >= D.HELL.kills) {
          G.mons.forEach(x => { x.noRespawn = true; });   // 50마리를 채우면 더 안 나옴
          if (H.stage <= 2) { hellClear(); return; }
          const who = H.stage === 3 ? g.guard : g.judge; H.phase = 'boss';
          G.mons.push(makeMon(who, H.lv + (D.HELL.midPlus || 0), true)); G.title = { t: 0, text: `${who.name} 등장! (Lv.${H.lv + (D.HELL.midPlus || 0)})`, sub: who.say }; G.shake = 8;
        }
      }
      function hellClear() {
        const H = G.hellRun; if (!H || H.phase === 'done') return; H.phase = 'done';
        const idx = (H.gate - 1) * 5 + H.stage, first = idx > (S.hell || 0);
        if (first) S.hell = idx;
        const last = H.stage >= 5, nx = last ? null : `h${H.gate}-${H.stage + 1}`;
        G.title = { t: 0, text: `${H.gate}-${H.stage} 통과!`, sub: last ? `${D.HELL.gates[H.gate - 1].king}의 시험을 이겼어요! 다음 관문은 곧 열려요` : '잠시 뒤 다음 단계로 내려가요' }; G.flash = 0.4; Fx.levelUp(G.px, G.py);
        markDirty(true); if (first) submitRank();
        setTimeout(() => { if (G.hellRun !== H || G.dead || !G.map || !G.map.M.hell) return; if (nx && MAPBY[nx]) enter(nx, 'L'); else enter('v9', 'door'); }, 4000);
      }
      const rankScore = () => ((S.hell || 0) > 0 ? 1000 + S.hell : S.lv);   // v69 랭킹: 지옥을 깨면 1000 + 깬 단계
      const hellTxt = n => (n > 0 ? `${Math.ceil(n / 5)}-${n - (Math.ceil(n / 5) - 1) * 5}` : '-');
      function spawnPoint() {
        const sp = G.map.spawns; let p = pick(sp);
        for (let i = 0; i < 12 && Math.hypot(p.x - G.px, p.y - G.py) < 260; i++) p = pick(sp);
        return p;
      }
      function makeMon(def, lvl, boss) {
        lvl = clamp(lvl, 1, G.map && G.map.M.hell ? D.HELL.maxMonLv : D.MAX_LV); const F = D.F, B = F.boss;   // v69 저승 몬스터는 Lv.100 넘음
        const p = boss ? { x: G.map.w * TS * 0.62, y: (G.map.mid + 1) * TS } : spawnPoint();
        const sc = boss ? 6 : 3, spr = monSprite(def, sc);
        const hp = Math.round(F.monHp(lvl) * (boss ? B.hp : 1));
        return { def, name: def.name, lvl, boss: !!boss, kind: boss ? 'boss' : def.kind, x: p.x, y: p.y, hx: p.x, hy: p.y, hp, max: hp,
          atk: Math.round(F.monAtk(lvl) * (boss ? B.atk : 1)), mdef: F.monDef(lvl), spr, r: boss ? 30 : 14,
          exp: Math.round(F.monExp(lvl) * (boss ? B.exp : 1)), gold: Math.round(F.monGold(lvl) * (boss ? B.gold : 1)),
          spd: boss ? 70 : def.kind === 'shoot' ? 60 : 80, cd: rand(0.5, 1.5), wt: 0, wx: 0, wy: 0, aggro: false, flash: 0,
          burn: null, slow: 0, stun: 0, dead: false, respawn: 0, slam: null, el: def.el || null, cast: null, skCd: 2.5 };
      }

      /* ---------- 전투: 피해 계산 ---------- */
      function hitMon(m, base, els, opt) {
        if (m.dead) return 0;
        opt = opt || {};
        const diff = m.lvl - S.lv, lvF = diff > 0 ? Math.max(0.4, 1 - 0.06 * diff) : 1 + Math.min(0.3, -diff * 0.03);
        let dmg = (base * rand(0.9, 1.1) * (1 + (ST.dmg || 0) / 100) - m.mdef * 0.5) * lvF;   // v44 힘 → 주는 피해 +%
        if ((els || []).some(e => ELEM[e].fx === 'heavy')) dmg *= 1.2;
        let weakHit = false;
        if (m.el) { if ((els || []).includes(m.el)) dmg *= D.HELL.resist; if ((els || []).includes(D.HELL.weak[m.el])) { dmg *= D.HELL.weakMul; weakHit = true; } }   // v69 저승 몬스터 속성: 같은 원소 ×0.7 · 약점 ×1.3
        const crit = Math.random() < ST.crit / 100; if (crit) dmg *= ST.critD || D.STAT.critDmg;
        dmg = Math.max(1, Math.round(dmg));
        m.hp -= dmg; m.flash = 0.12; m.aggro = true; m.knock = (m.x < G.px ? -1 : 1) * (crit ? 6 : 3);
        const elc = els && els.length ? Fx.pal(els[0])[1] : '#FFFFFF';
        G.texts.push({ x: m.x + rand(-8, 8), y: m.y - m.spr.h - 4, text: (crit ? '치명! ' : '') + (weakHit ? '약점! ' : '') + dmg, color: crit ? '#FFD23F' : elc, t: 0, big: crit, dmg: true });
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
        m.dead = true; m.respawn = m.boss ? (CFG.bossRespawnSec || 30) : (CFG.respawnSec || 3); S.kills++;   // v43 다시 나오는 시간 단축
        if (G.map.M.hell) hellKill(m);   // v69 저승 단계 진행
        const low = m.lvl < S.lv - 10 ? 0.2 : 1;
        const gold = Math.round(m.gold * (1 + (ST.goldP || 0) / 100)); gainExp(Math.round(m.exp * low * (1 + (ST.expP || 0) / 100))); S.gold += gold; float(m.x, m.y - m.spr.h - 18, `+${fmtN(gold)}G`, '#FFD23F');
        Fx.death(m.x, m.y - m.spr.h / 2, m.def.colors, m.boss); Fx.coins(m.x, m.y - m.spr.h / 2, m.boss ? 14 : Math.min(6, 2 + Math.floor(m.gold / 40)));
        if (m.boss) { G.shake = 10; G.flash = 0.35; G.hitstop = 0.12; G.title = { t: 0, text: '보스 처치!', sub: m.name }; }
        // 떨어뜨리는 물건
        const M = G.map.M, t = M.region, k = (M.no - 1) % 10, drops = [];
        // v60 장비는 떨어질 때마다 새 장비(옵션 무작위) · 드랍률 올림: 보통 6% · 정예 2.5%(사냥터 4번째부터) · 물약 10%
        //  보스: 장비 1개 + 25% 로 1개 더 · 마지막 보스(사냥터 90) 35% 전설 · 마지막 사냥터 3곳(98~100) 0.3% 전설
        const gear = (rare, boss, tt) => { tt = tt == null ? t : tt; const ids = D.GEAR_BASE.filter(id => { const it = ITEMS[id]; return it.tier === tt && (tt >= 9 || it.rare === rare); }); const u = newUid(); S.gear[u] = { b: pick(ids), en: 0, op: rollOpts(tt, optCount(rare, boss, tt >= 9)) }; return regGear(u, S.gear[u]); };
        if (m.boss) {
          drops.push(gear(Math.random() < 0.5, true)); if (Math.random() < 0.25) drops.push(gear(Math.random() < 0.5, true));
          if (M.no === 90 && Math.random() < 0.35) drops.push(gear(true, true, 9));
          if (M.hell && Math.random() < (M.stage === 5 ? 0.5 : 0.15)) drops.push(gear(true, true, 9));   // v69 저승 보스: 전설 (대왕 50% · 옥졸·판관 15%)
          drops.push('hp' + (t + 1), 'hp' + (t + 1), 'mp' + (t + 1)); S.bosses[M.id] = (S.bosses[M.id] || 0) + 1; bossReward();
        } else {
          if (Math.random() < 0.06) drops.push(gear(false));
          if (k >= 3 && Math.random() < 0.025) drops.push(gear(true));
          if (t === 8 && k >= 7 && Math.random() < 0.003) drops.push(gear(true, false, 9));
          if (Math.random() < 0.10) drops.push((Math.random() < 0.6 ? 'hp' : 'mp') + (t + 1));
        }
        drops.forEach((id, i) => { const it = ITEMS[id]; if (addItem(id, 1)) setTimeout(() => float(m.x, m.y - m.spr.h - 34 - i * 14, '획득: ' + it.name + (it.grade != null ? ` (${GRADE[it.grade].name})` : ''), it.grade != null ? GRADE[it.grade].color : '#9AE6FF', it.grade === 4), i * 150); });
        if (drops.some(id => ITEMS[id].legend)) { G.title = { t: 0, text: '전설 장비!', sub: drops.map(id => ITEMS[id]).find(it => it.legend).name }; G.flash = 0.4; Fx.levelUp(G.px, G.py); }
        if (drops.some(id => ITEMS[id].slot)) say('장비를 얻었어요! 가방(I)에서 옵션을 보고 입어 보세요');
        markDirty(drops.length > 0);   // 얻은 물건은 곧 계정에 저장 (다른 서버·기기에서도 그대로)
      }
      function gainExp(n) {
        if (S.lv >= D.MAX_LV) return;
        S.exp += n;
        let up = false;
        while (S.lv < D.MAX_LV && S.exp >= D.F.need(S.lv)) { S.exp -= D.F.need(S.lv); S.lv++; S.sp += CFG.statPerLevel || 2; up = true; }
        if (S.lv >= D.MAX_LV) S.exp = 0;
        if (up) {
          restat(); S.hp = ST.hp; S.mp = ST.mp;
          float(G.px, G.py - 70, `레벨 업! Lv.${S.lv}`, '#FFE45C', true);
          Fx.levelUp(G.px, G.py); G.flash = 0.25;
          const learnable = Object.values(SKILLS).filter(s => s.lv === S.lv);
          if (learnable.length) say(`Lv.${S.lv} — 도술 서원에서 '${learnable[0].name}'을(를) 배울 수 있어요!`, 3.5);
          else say(`스탯 포인트 +${CFG.statPerLevel || 2}! 왼쪽 위 얼굴을 눌러 원하는 스탯을 올려요`, 3.2);
          submitRank(); markDirty(true); if (net) net.retrack();
        }
      }
      // v60 el = 속성(원거리 탄·보스 내려찍기) → 그 속성 방어 % 만큼 줄어듦 · el 없음 = 물리(몸통 박치기) → 물리 방어 %
      function hitPlayer(dmg0, lvl, el) {
        if (G.inv > 0 || G.dead) return;
        const diff = lvl - S.lv, lvF = diff > 0 ? 1 + 0.08 * diff : Math.max(0.5, 1 + 0.05 * diff);
        let dmg = (dmg0 * rand(0.9, 1.1) - ST.def * 0.5) * lvF;
        dmg *= 1 - (el ? (ST.edefs[el] || 0) : ST.pdef) / 100;
        if (G.shield) dmg *= 1 - G.shield.pow;
        dmg = Math.max(1, Math.round(dmg));
        S.hp -= dmg; G.inv = 0.35; G.lastHit = 0; G.hurt = 0.22; G.shake = Math.max(G.shake, 3);
        G.texts.push({ x: G.px + rand(-8, 8), y: G.py - 64, text: '-' + dmg, color: el ? ELEM[el].color : '#FF6A6E', t: 0, dmg: true });
        Fx.hit(G.px, G.py - 28, [el || 'fire'], false);
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
      const FKEY = ['Q', 'W', 'E', 'R'];
      // slot: 0~3 = 기본 마법(1~4), 4~7 = 융합 마법(Q W E R)
      function cast(slot) {
        const fu = slot >= 4, id = fu ? S.fslots[slot - 4] : S.slots[slot];
        if (!id) { say(fu ? `${FKEY[slot - 4]} 칸이 비어 있어요. 마법 창(K)에서 융합 마법을 넣어 주세요` : `${slot + 1}번 칸이 비어 있어요. 마법 창(K)에서 넣어 주세요`); return; }
        const sk = skill(id); if (!sk) return;
        if (G.map.M.kind !== 'field' && sk.kind !== 'heal' && sk.kind !== 'shield') { say(G.room ? '건물 안에서는 공격 마법을 쓸 수 없어요' : '마을에서는 공격 마법을 쓸 수 없어요'); return; }
        if ((G.cds[id] || 0) > 0) return;
        if (S.mp < sk.mp) { say('마나가 부족해요 (X: 마나 포션)'); return; }
        S.mp -= sk.mp; G.cds[id] = sk.cd; Fx.castCircle(G.px, G.py, sk.els, !!sk.fusion);
        if (net && net.joined) { const [adx, ady] = aimDir(sk.len || 420); net.cast({ id, x: Math.round(G.px), y: Math.round(G.py - 22), dx: +adx.toFixed(2), dy: +ady.toFixed(2) }); }
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
        G.atkCd = ST.atkCd;
        const staff = S.eq.weapon && ITEMS[S.eq.weapon].look === 'staff';
        const [dx, dy] = aimDir(staff ? 150 : 70);
        G.face = dx < 0 ? -1 : 1;
        Fx.slash(G.px, G.py - 24, dx, dy, staff);
        if (G.map.M.kind !== 'field') return;
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
        else if (it.kind === 'scroll') { if (G.map.M.kind !== 'field' && S.map === S.home) { say('이미 마을이에요'); return; } takeItem(id); closePanel(); enter(S.home, 'door'); }
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

      /* ---------- 사람(NPC) ---------- */
      // v60 대장장이: 대장간 앞에 서 있음 · 가까이 가면 강화 창
      const smithNpc = map => (map.forge ? [{ key: 'forge', def: D.SMITH, x: (map.forge.x + map.forge.w + 1) * TS, y: (map.forge.y + map.forge.h + 0.2) * TS, face: -1, ph: 2, smith: true }] : []);
      // v69 저승차사 강림: Lv.100 이 되면 마지막 마을(도원수 진영) 큰길 오른쪽에 나타남
      const hellNpc = map => (map.R.castle && S.lv >= D.MAX_LV ? [{ key: 'hell', def: D.HELL.npc, x: 30.5 * TS, y: (map.mid + 0.2) * TS, face: -1, ph: 1, smith: true }] : []);
      function talk(n) {
        if (n.guard || !['potion', 'school', 'chief', 'castle', 'forge', 'hell'].includes(n.key)) { n.say = pick(n.def.lines || ['…']); n.sayT = 3; return; }
        n.say = null; openPanel(n.key, { npc: n, hello: pick(n.def.hello) });
      }
      function updateNpcs(dt) {
        (G.npcs || []).forEach(n => {
          const d = Math.hypot(G.px - n.x, G.py - n.y);
          if (n.sayT > 0) n.sayT -= dt;
          if (n.walker) {   // 마을 사람: 큰길에서 좌우로 천천히 · 내가 가까이 오면 멈춰서 말 걸기
            if (d < 90) { n.vx = 0; if (!n.near) { n.near = true; n.say = pick(n.def.lines); n.sayT = 3.2; } }
            else { n.near = false; n.wt -= dt; if (n.wt <= 0) { n.wt = rand(1.5, 3.5); n.vx = Math.random() < 0.6 ? (Math.random() < 0.5 ? -1 : 1) * 32 : 0; if (Math.abs(n.x - n.hx) > 60) n.vx = Math.sign(n.hx - n.x) * 32; } }
            const nx = n.x + n.vx * dt; if (n.vx && !solidAt(G.map, nx + Math.sign(n.vx) * 10, n.y - 4)) n.x = nx; else n.vx = 0;
            n.moving = !!n.vx; if (n.vx) n.face = n.vx < 0 ? -1 : 1; else if (d < 160) n.face = G.px < n.x ? -1 : 1;
            n.walk = (n.walk || 0) + (n.moving ? dt : 0);
          } else if (!n.guard && d < 220) n.face = G.px < n.x ? -1 : 1;
        });
      }

      /* ---------- 한 틱 ---------- */
      function update(dt) {
        const map = G.map, M = map.M;
        S.play += dt; G.saveT += dt; G.srvT += dt; if (msgT > 0 && (msgT -= dt) <= 0) msgEl.hidden = true;
        G.atkCd -= dt; G.inv -= dt; G.lastHit += dt;
        G.shake = Math.max(0, G.shake * Math.pow(0.002, dt) - dt); G.hurt = Math.max(0, G.hurt - dt); G.flash = Math.max(0, G.flash - dt); if (G.title) G.title.t += dt;
        Fx.updateParts(dt, { x: G.px, y: G.py }); Fx.updateFx(dt); if (!G.room) Fx.ambient(M.region, dt, W, H, cam);
        Object.keys(G.cds).forEach(k => { G.cds[k] -= dt; });
        if (G.shield && (G.shield.t -= dt) <= 0) G.shield = null;
        // 자연 회복
        const reg = (M.kind !== 'field' ? 3 : 1) * (G.lastHit > 5 ? 1 : 0.25);
        S.hp = Math.min(ST.hp, S.hp + ST.hp * 0.012 * reg * dt); S.mp = Math.min(ST.mp, S.mp + ST.mp * 0.02 * reg * (ST.mpRegen / 100) * dt);   // v44 지혜 → 마나 회복

        // 입력 → 이동
        let mx = 0, my = 0; const K = G.keys;
        if (K.ArrowLeft) mx--; if (K.ArrowRight) mx++; if (K.ArrowUp) my--; if (K.ArrowDown) my++;   // v53: 이동은 방향키 (W 는 융합 마법)
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
        if (net) { const vx = (G.px - (G.lpx == null ? G.px : G.lpx)) / dt, vy = (G.py - (G.lpy == null ? G.py : G.lpy)) / dt; G.lpx = G.px; G.lpy = G.py; net.tick(dt, { x: G.px, y: G.py, vx, vy, face: G.face, lv: S.lv }); }

        // 출구 (v41: 벽 판정 때문에 끝 6px 까지 못 가서 안 넘어가던 것 → 끝 16px 안에 들어오면 넘어감)
        if (G.px < 16 && map.exitL) { enter(map.exitL, 'R'); return; }
        if (G.px > map.w * TS - 16 && map.exitR) { enter(map.exitR, 'L'); return; }
        // 건물 안: 아래 문으로 나감 · 사람 가까이 가면 대화
        if (G.room) {
          if (G.py > (map.exit.y + 0.25) * TS && G.px > map.exit.x0 * TS - 8 && G.px < (map.exit.x1 + 1) * TS + 8) { leaveRoom(); return; }
          const near = G.npcs.find(n => Math.hypot(G.px - n.talk.x, G.py - n.talk.y) < n.talk.r);
          if (near && G.onNpc !== near) { G.onNpc = near; talk(near); return; }
          if (!near) G.onNpc = null;
        }
        updateNpcs(dt);
        // v60 대장장이 가까이 → 강화 창 (멀어졌다가 다시 오면 또 열림)
        for (const sm of (!G.room && G.npcs ? G.npcs.filter(n => n.smith) : [])) {   // v69 대장장이 · 저승차사 (가까이 가면 창)
          const nearS = Math.hypot(G.px - sm.x, G.py - sm.y) < 40; if (nearS && G.onNpc !== sm) { G.onNpc = sm; talk(sm); return; } if (!nearS && G.onNpc === sm) G.onNpc = null;
        }
        // 건물 문
        //  문 칸에 들어가거나, 문 바로 아래 칸에서 위(↑)로 걸으면 들어감
        const ty = Math.floor((G.py - 4) / TS);
        const door = map.doors.find(b => Math.abs((b.door.x + 0.5) * TS - G.px) < 30 && (ty === b.door.y || (ty === b.door.y + 1 && my < -0.3)));
        if (door && G.onDoor !== door) { G.onDoor = door; enterRoom(door); return; }
        if (!door) G.onDoor = null;

        // 몬스터
        G.mons.forEach(m => {
          if (m.dead) { if (m.noRespawn) return; if ((m.respawn -= dt) <= 0) { const n = makeMon(m.def, m.lvl, m.boss); Object.assign(m, n); } return; }
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
              if (m.cd <= 0 && d < 300) { m.cd = 2.2; const a = Math.atan2(G.py - 24 - (m.y - m.spr.h / 2), G.px - m.x); const rel = m.el || D.RG_EL[m.def.ri != null ? m.def.ri : G.map.M.region]; G.shots.push({ x: m.x, y: m.y - m.spr.h / 2, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 1.6, dmg: m.atk * 0.8, lvl: m.lvl, r: 6, color: ELEM[rel].color, color2: ELEM[rel].light, mine: false, monEl: 'dark', el: rel }); m.lunge = 0.2; }
            } else {
              if (d > m.r + 12 && !m.cast) moveMon(m, dx / d * sp, dy / d * sp);
              if (d < m.r + 22 && m.cd <= 0) { m.cd = m.boss ? 1.4 : 1.2; m.lunge = 0.25; hitPlayer(m.atk, m.lvl); }
              if (m.boss) {
                if (m.def.skills) bossSkill(m, dt, d);   // v69 저승 보스 기술
                else if (!m.slam && m.cd <= 0.2 && Math.random() < 0.01 + dt) m.slam = { t: 0, x: m.x, y: m.y - 20 };
                const sel = m.el || D.RG_EL[G.map.M.region];
                if (m.slam) { m.slam.t += dt; if (m.slam.t >= 0.9) { if (Math.hypot(G.px - m.slam.x, G.py - 20 - m.slam.y) < 130) hitPlayer(m.atk * 1.5, m.lvl, sel); Fx.nova(m.slam.x, m.slam.y, 130, [sel, 'earth']); G.shake = Math.max(G.shake, 9); m.slam = null; m.cd = 2.2; } }
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
          if (s.ghost) return true;   // 다른 사람 마법 그림 (피해 없음)
          if (s.mine) {
            for (const m of G.mons) {
              if (m.dead || s.hit.has(m)) continue;
              if (Math.hypot(m.x - s.x, m.y - m.spr.h / 2 - s.y) < m.r + s.r) { s.hit.add(m); hitMon(m, s.dmg, s.els); if (!s.pierce) return false; }
            }
          } else if (Math.hypot(G.px - s.x, G.py - 24 - s.y) < 16 + s.r) { hitPlayer(s.dmg, s.lvl, s.el); return false; }
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
        cam.x = map.w * TS <= W ? (map.w * TS - W) / 2 : clamp(G.px - W / 2, 0, map.w * TS - W);   // 작은 지도(건물 안)는 화면 가운데
        cam.y = map.h * TS <= H ? (map.h * TS - H) / 2 + 12 : clamp(G.py - 30 - H / 2, 0, map.h * TS - H);
        let sx = 0, sy = 0; if (G.shake > 0.2) { sx = rand(-G.shake, G.shake); sy = rand(-G.shake, G.shake); }
        const cx = Math.round(cam.x + sx), cy = Math.round(cam.y + sy);
        if (G.room) { c.fillStyle = '#0F1430'; c.fillRect(0, 0, W, H); c.drawImage(map.ground, -cx, -cy); }
        else { c.fillStyle = map.R.sky; c.fillRect(0, 0, W, H);
        c.drawImage(map.ground, clamp(cx, 0, map.ground.width - W), clamp(cy, 0, map.ground.height - H), W, H, clamp(cx, 0, map.ground.width - W) - cx, clamp(cy, 0, map.ground.height - H) - cy, W, H); }
        c.save(); c.translate(-cx, -cy);
        if (G.room) drawRoomFx(c, now, true);
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
        G.mons.forEach(m => {   // v69 보스 기술 예고: 칼비 자리 · 돌진 방향
          const k = m.cast; if (!k || m.dead) return;
          if (k.k === 'blades') k.pts.forEach(q => Fx.slamWarn(c, q.x, q.y + 20, 46, Math.min(1, k.t / 1.0), now));
          if (k.k === 'charge' && k.t < 0.7) { c.save(); c.globalAlpha = 0.35 + 0.3 * Math.sin(now / 60); c.strokeStyle = '#FF3A3A'; c.lineWidth = 2 * m.r; c.lineCap = 'round'; c.beginPath(); c.moveTo(m.x, m.y - 10); c.lineTo(m.x + Math.cos(k.a) * 250, m.y - 10 + Math.sin(k.a) * 250); c.stroke(); c.restore(); }
        });
        // 나무·건물·몬스터·나 — 아래쪽(sy)이 큰 것이 앞
        const list = [];
        for (const o of map.objs) { if (o.x > cx + W + 40 || o.x + o.img.width < cx - 40 || o.y > cy + H + 40 || o.y + o.img.height < cy - 40) continue; list.push({ y: o.sy, o }); }
        G.mons.forEach(m => { if (!m.dead) list.push({ y: m.y, m }); });
        (G.npcs || []).forEach(n => list.push({ y: n.y, n }));
        if (net) net.peers.forEach(pp => list.push({ y: pp.y, pp }));
        if (G.room) drawRoomFx(c, now, false);   // 벽난로 불·촛불 등은 사람보다 먼저 (머리 위 느낌표·말풍선이 가려지지 않게)
        list.push({ y: G.py, me: true }); list.sort((a, b) => a.y - b.y);
        list.forEach(e => (e.me ? drawMe(c, now) : e.m ? drawMon(c, e.m, now) : e.n ? drawNpc(c, e.n, now) : e.pp ? drawPeer(c, e.pp, now) : drawObj(c, e.o, now)));
        if (G.room) {
          const ex = map.exit, dx = (ex.x0 + ex.x1 + 1) / 2 * TS, dy = (ex.y + 0.5) * TS, k = Math.abs(Math.sin(now / 300));
          c.font = '13px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = '#1D2340'; c.strokeText('▼ 나가기', dx, dy - 22 + k * 3); c.fillStyle = '#FFF6C2'; c.fillText('▼ 나가기', dx, dy - 22 + k * 3);
        }
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
        if (G.room) {   // 건물 안: 따뜻한 빛 + 가장자리 어둡게
          c.save(); c.globalCompositeOperation = 'lighter';
          map.glows.forEach(g => { const fl = 0.85 + 0.15 * Math.sin(now / 130 + g.x); Fx.drawGlow(c, g.x - cx, g.y - cy, g.r, g.col, 0.32 * fl); });
          c.restore();
          const vg = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(10,14,36,0)'); vg.addColorStop(1, 'rgba(10,14,36,.55)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
        } else Fx.drawAmbient(c, map.R === D.REGIONS[map.M.region] ? map.M.region : 0, W, H, { x: cx, y: cy }, now, glowLights);
        if (map.M && map.M.hell) { c.fillStyle = `rgba(150, 20, 30, ${0.2 + Math.sin(now / 900) * 0.04})`; c.fillRect(0, 0, W, H); }   // v69 저승: 붉은 기운
        if (G.hurt > 0) { c.fillStyle = 'rgba(255,40,60,' + (G.hurt * 1.2).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
        if (G.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + (G.flash * 1.5).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
        drawHud(c, now);
        if (G.touch) drawTouch(c);
      }
      function drawObj(c, o, now) {
        // Meshy 그림이 있으면: 장애물은 칸 아래 가운데에 세움, 건물은 건물 칸 폭에 맞춤 (+ 이름표)
        if (o.forge) {   // v60 대장간: Meshy 그림(bld_forge) 이 있으면 그것, 없으면 도트 그림 · 불빛 깜빡임 · 불티
          const f = o.forge, fim = imgOk('bld_forge'), cx0 = (f.x + f.w / 2) * TS, by = (f.y + f.h) * TS + 4;
          let top = o.y, fireX = o.x + 35, fireY = o.y + 95, anX = o.x + 90, anY = o.y + 74;
          if (fim) { const ww = f.w * TS + 44, hh = fim.naturalHeight * ww / fim.naturalWidth; top = by - hh; c.drawImage(fim, Math.round(cx0 - ww / 2), Math.round(top), Math.round(ww), Math.round(hh)); fireX = cx0 - ww * 0.18; fireY = by - hh * 0.3; anX = cx0 + ww * 0.2; anY = by - hh * 0.35; }
          else c.drawImage(o.img, o.x, o.y);
          c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, fireX, fireY, 34 + 6 * Math.sin(now / 90), '#FF8A3D', 0.45 + 0.15 * Math.sin(now / 70)); c.restore();
          if (Math.random() < 0.06) for (let i = 0; i < 4; i++) Fx.emit({ x: anX + rand(-4, 4), y: anY, vx: rand(-90, 90), vy: rand(-170, -60), g: 500, life: 0.5, size: 2, color: pick(['#FFE45C', '#FF9A3D', '#FFFFFF']), shape: 'sq', add: true });
          const label = '대장간 · 강화'; c.font = '13px "Jua", "Malgun Gothic", sans-serif'; const lw = c.measureText(label).width + 20, ly = top - 6;
          c.fillStyle = 'rgba(10,14,36,.82)'; c.fillRect(cx0 - lw / 2, ly - 11, lw, 22); c.fillStyle = '#FF8A3D'; c.fillRect(cx0 - lw / 2, ly + 10, lw, 2);
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFB86B'; c.fillText(label, cx0, ly + 1);
          return;
        }
        const alt = o.alt && imgOk(o.alt), bim = o.b && imgOk('bld_' + o.b.type);
        if (bim) {
          const b = o.b, ww = b.w * TS + (b.type === 'castle' ? 90 : 34), hh = bim.naturalHeight * ww / bim.naturalWidth, cx0 = (b.x + b.w / 2) * TS, by = (b.y + b.h) * TS + 6;
          c.drawImage(bim, Math.round(cx0 - ww / 2), Math.round(by - hh), Math.round(ww), Math.round(hh));
          const label = b.type === 'castle' ? '도원수 진영 · 퀘스트' : b.name; c.font = '13px "Jua", "Malgun Gothic", sans-serif'; const lw = c.measureText(label).width + 20, ly = by - hh - 4;
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
      function drawNpc(c, n, now) {
        const fr = n.moving ? [1, 0, 3, 0][Math.floor((n.walk || 0) * 7) % 4] : 0, img = npcSprite(n.def.av, fr);
        const k = (img.width > AV.size.w ? 1 : 2) * (n.scale || 1), w = img.width * k, h = img.height * k, bob = n.moving ? 0 : Math.round(Math.sin(now / 420 + n.ph));
        const x = Math.round(n.x - w / 2), y = Math.round(n.y - h + 2 + bob);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(n.x, n.y, 16 * (n.scale || 1), 5, 0, 0, Math.PI * 2); c.fill();
        if (n.face < 0) { c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(img, 0, 0, w, h); c.restore(); } else c.drawImage(img, x, y, w, h);
        c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
        c.strokeText(n.def.name, n.x, y - 6); c.fillStyle = n.def.color || '#9AE6FF'; c.fillText(n.def.name, n.x, y - 6);
        let top = y - 22;
        if (!n.guard && !n.walker) {   // 가게 사람 머리 위 느낌표 (통통 튐)
          const by = top - 8 - Math.abs(Math.sin(now / 260)) * 5; c.fillStyle = '#1D2340'; rr(c, n.x - 9, by - 12, 18, 22, 6); c.fill(); c.fillStyle = '#FFD23F'; rr(c, n.x - 7, by - 10, 14, 18, 5); c.fill();
          c.fillStyle = '#1D2340'; c.fillRect(n.x - 1.5, by - 7, 3, 8); c.fillRect(n.x - 1.5, by + 3, 3, 3); top = by - 16;
        }
        if (n.say && n.sayT > 0) {
          c.save(); c.globalAlpha = Math.min(1, n.sayT * 3); c.font = '13px "Jua", "Malgun Gothic", sans-serif';
          const tw = c.measureText(n.say).width + 20, bx = clamp(n.x - tw / 2, cam.x + 4, cam.x + W - tw - 4), by = top - 30;
          c.fillStyle = '#1D2340'; rr(c, bx - 2, by - 2, tw + 4, 30, 9); c.fill(); c.beginPath(); c.moveTo(n.x - 7, by + 26); c.lineTo(n.x + 7, by + 26); c.lineTo(n.x, by + 36); c.fill();
          c.fillStyle = '#FFFFFF'; rr(c, bx, by, tw, 26, 8); c.fill(); c.beginPath(); c.moveTo(n.x - 5, by + 25); c.lineTo(n.x + 5, by + 25); c.lineTo(n.x, by + 32); c.fill();
          c.fillStyle = '#1D2340'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(n.say, bx + 10, by + 14); c.restore();
        }
      }
      // 다른 플레이어 (아바타 + 장비, 이름 하늘색)
      function drawPeer(c, p, now) {
        if (!p.av) return;
        const fr = p.moving ? [1, 0, 3, 0][Math.floor(p.walk * 8) % 4] : 0, img = avatarSprite(AV.normalize(p.av), p.eq || {}, p.hide, fr);
        const k = img.width > AV.size.w ? 1 : 2, w = img.width * k, h = img.height * k, x = Math.round(p.x - w / 2), y = Math.round(p.y - h + 2);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(p.x, p.y, 16, 5, 0, 0, Math.PI * 2); c.fill();
        if (p.face < 0) { c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(img, 0, 0, w, h); c.restore(); } else c.drawImage(img, x, y, w, h);
        c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
        const nm = p.nick + ' Lv.' + p.lv; c.strokeText(nm, p.x, y - 6); c.fillStyle = '#9AE6FF'; c.fillText(nm, p.x, y - 6);
      }
      // 건물 안 움직이는 장식 (마법진 · 벽난로 불 · 촛불 · 가마솥 거품 · 떠다니는 책)
      function drawRoomFx(c, now, floor) {
        (G.map.fx || []).forEach(f => {
          if (floor && f.type === 'circle') {
            c.save(); c.translate(f.x, f.y); c.scale(1, 0.5); c.globalCompositeOperation = 'lighter';
            const a = 0.35 + 0.15 * Math.sin(now / 500);
            [[f.r, 3], [f.r * 0.78, 2], [f.r * 0.45, 2]].forEach(([r, lw], i) => { c.strokeStyle = `rgba(${i === 1 ? '255,214,120' : '176,138,255'},${a})`; c.lineWidth = lw * 2; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); });
            c.rotate(now / 3000); c.strokeStyle = `rgba(200,168,255,${a + 0.1})`; c.lineWidth = 3;
            for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2, t2 = t + Math.PI * 2 / 3; c.beginPath(); c.moveTo(Math.cos(t) * f.r * 0.78, Math.sin(t) * f.r * 0.78); c.lineTo(Math.cos(t2) * f.r * 0.78, Math.sin(t2) * f.r * 0.78); c.stroke(); }
            for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; c.fillStyle = `rgba(255,230,160,${a + 0.2})`; c.fillRect(Math.cos(t) * f.r * 0.9 - 3, Math.sin(t) * f.r * 0.9 - 3, 6, 6); }
            c.restore();
            if (Math.random() < 0.25) Fx.emit({ x: f.x + rand(-f.r, f.r) * 0.8, y: f.y + rand(-f.r, f.r) * 0.35, vx: 0, vy: rand(-50, -20), life: 1.2, size: rand(2, 4), color: pick(['#C8A8FF', '#FFE9A8', '#FFFFFF']), shape: 'star', add: true });
          }
          if (floor) return;
          if (f.type === 'fire') {
            c.save(); c.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 7; i++) { const ph = now / 120 + i * 1.7, hh = 26 + Math.sin(ph) * 8 + (i % 3) * 6, xx = f.x - 26 + i * 9; c.fillStyle = i % 2 ? 'rgba(255,154,61,.85)' : 'rgba(255,90,40,.8)'; c.beginPath(); c.moveTo(xx - 7, f.y); c.quadraticCurveTo(xx + Math.sin(ph) * 4, f.y - hh, xx + 7, f.y); c.fill(); }
            c.fillStyle = 'rgba(255,240,170,.9)'; c.beginPath(); c.ellipse(f.x, f.y - 6, 18, 8 + Math.sin(now / 90) * 2, 0, 0, Math.PI * 2); c.fill(); c.restore();
            if (Math.random() < 0.3) Fx.emit({ x: f.x + rand(-20, 20), y: f.y - 14, vx: rand(-15, 15), vy: rand(-70, -40), life: 0.8, size: rand(2, 3), color: pick(['#FFE45C', '#FF9A3D']), shape: 'glow', add: true });
          } else if (f.type === 'flame') {
            const fl = Math.sin(now / 80 + f.x) * 1.5; c.save(); c.globalCompositeOperation = 'lighter';
            c.fillStyle = 'rgba(255,154,61,.9)'; c.beginPath(); c.ellipse(f.x, f.y, 4, 8 + fl, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = 'rgba(255,240,180,.95)'; c.beginPath(); c.ellipse(f.x, f.y + 2, 2, 4 + fl / 2, 0, 0, Math.PI * 2); c.fill(); c.restore();
          } else if (f.type === 'cauldron') {
            if (Math.random() < 0.35) Fx.emit({ x: f.x + rand(-16, 16), y: f.y, vx: rand(-8, 8), vy: rand(-45, -25), life: 1.1, size: rand(3, 6), color: pick(['#9AF0B0', '#3DDC84', '#DFFFE8']), shape: 'glow', add: true });
            c.save(); c.globalAlpha = 0.25 + 0.1 * Math.sin(now / 300); c.fillStyle = '#DFFFE8'; c.beginPath(); c.ellipse(f.x + Math.sin(now / 700) * 6, f.y - 30, 16, 8, 0, 0, Math.PI * 2); c.fill(); c.restore();
          } else if (f.type === 'books') {
            for (let i = 0; i < 3; i++) { const t = now / 900 + i * 2.1, bx = f.x + Math.cos(t) * 40, by = f.y - 40 + Math.sin(t * 1.3) * 10 - i * 14, col = ['#D2343A', '#3E7BD8', '#3DDC84'][i];
              c.fillStyle = '#1D2340'; c.fillRect(bx - 9, by - 7, 18, 14); c.fillStyle = col; c.fillRect(bx - 8, by - 6, 16, 12); c.fillStyle = '#F5E2B8'; c.fillRect(bx - 6 + (Math.floor(now / 200 + i) % 2) * 6, by - 4, 6, 8); }
          }
        });
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
        if (S.sp > 0) {   // 올릴 스탯 포인트가 있으면 얼굴 오른쪽 위에 + 표시 (톡톡 튐)
          const k2 = 1 + 0.12 * Math.abs(Math.sin(now / 250)); c.save(); c.translate(80, 18); c.scale(k2, k2);
          c.fillStyle = '#0A0E24'; c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fill(); c.fillStyle = '#FF5A5F'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#FFFFFF'; c.fillRect(-5, -1.5, 10, 3); c.fillRect(-1.5, -5, 3, 10); c.restore();
        }
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
        const t = M.kind !== 'field' || M.hell ? M.name : `사냥터 ${M.no}. ${M.name}`, rec = M.kind === 'room' ? MAPBY[S.map].name + ' · 건물 안' : M.kind === 'village' ? '마을' : `권장 Lv.${M.rec}`;
        c.font = '16px "Jua", "Malgun Gothic", sans-serif'; const tw = Math.max(c.measureText(t).width, 80) + 30;
        panelBox(c, W / 2 - tw / 2, 8, tw, 38, 10);
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText(t, W / 2, 21);
        c.font = '11px "Jua", sans-serif'; c.fillStyle = M.kind !== 'field' ? '#9AE6FF' : M.rec > S.lv + 6 ? '#FF8A8E' : M.rec > S.lv + 2 ? '#FFD23F' : '#9AF0B0'; c.fillText(rec + (M.kind !== 'village' && M.rec > S.lv + 6 ? ' · 위험!' : ''), W / 2, 37);
        // 서버 표시 (위 가운데 이름 아래)
        if (net && net.joined) {
          const st = `${net.server}서버 · 여기 ${net.peers.size + 1}명`; c.font = '12px "Jua", "Malgun Gothic", sans-serif'; const sw = c.measureText(st).width + 18;
          c.fillStyle = 'rgba(10,14,36,.78)'; rr(c, W / 2 - sw / 2, 50, sw, 20, 8); c.fill(); c.fillStyle = '#9AE6FF'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(st, W / 2, 61);
        }
        // 오른쪽 위: 작은 지도
        if (!G.room) drawMini(c, now);
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
        if (G.touch || G.room) return;   // 건물 안에서는 아래 마법 칸을 숨김 (나가는 문이 보이게)
        // 아래 가운데: 기본 마법 4칸(1~4) + 융합 마법 4칸(Q W E R) + 포션 2칸(Z X)
        const bw = 10 * 54 + 2 * 12 - 4, x0 = Math.round(W / 2 - bw / 2), y0 = H - 62;
        panelBox(c, x0 - 8, y0 - 8, bw + 16, 60, 12);
        for (let i = 0; i < 4; i++) skillSlot(c, x0 + i * 54, y0, 46, i, now);
        for (let i = 0; i < 4; i++) skillSlot(c, x0 + 4 * 54 + 12 + i * 54, y0, 46, 4 + i, now);
        potionSlot(c, x0 + 8 * 54 + 24, y0, 46, 'hp', 'Z'); potionSlot(c, x0 + 9 * 54 + 24, y0, 46, 'mp', 'X');
      }
      function drawMini(c, now) {
        const map = G.map, mw = 150, k = mw / map.w, mh = Math.round(map.h * k), x0 = W - mw - 14, y0 = 12;
        panelBox(c, x0 - 4, y0 - 4, mw + 8, mh + 8, 6);
        c.save(); c.globalAlpha = 0.9; c.imageSmoothingEnabled = false; c.drawImage(map.mini, x0, y0, mw, mh); c.restore();
        G.mons.forEach(m => { if (m.dead) return; c.fillStyle = m.boss ? '#FF3D4A' : m.aggro ? '#FF8A3D' : '#FFD8D8'; const s = m.boss ? 5 : 3; c.fillRect(x0 + m.x / TS * k - s / 2, y0 + m.y / TS * k - s / 2, s, s); });
        if (net) net.peers.forEach(p => { c.fillStyle = '#9AE6FF'; c.fillRect(x0 + p.x / TS * k - 2, y0 + p.y / TS * k - 2, 4, 4); });
        map.buildings.forEach(b => { c.fillStyle = '#FFD27A'; c.fillRect(x0 + (b.door.x + 0.5) * k - 2, y0 + (b.door.y + 0.5) * k - 2, 4, 4); });
        const bl = Math.floor(now / 300) % 2; c.fillStyle = bl ? '#FFFFFF' : '#3DDC84'; c.fillRect(x0 + G.px / TS * k - 3, y0 + G.py / TS * k - 3, 6, 6); c.strokeStyle = '#0A0E24'; c.lineWidth = 1; c.strokeRect(x0 + G.px / TS * k - 3, y0 + G.py / TS * k - 3, 6, 6);
        c.strokeStyle = 'rgba(255,255,255,.6)'; c.strokeRect(x0 + cam.x / TS * k, y0 + cam.y / TS * k, W / TS * k, H / TS * k);
      }
      function skillSlot(c, x, y, s, i, now) {
        const fu = i >= 4, id = fu ? S.fslots[i - 4] : S.slots[i], sk = skill(id);
        c.fillStyle = '#0A0E24'; rr(c, x - 1, y - 1, s + 2, s + 2, 7); c.fill(); c.fillStyle = fu ? '#2A1A48' : '#1A2148'; rr(c, x, y, s, s, 6); c.fill();
        if (sk) {
          c.save(); rr(c, x + 1, y + 1, s - 2, s - 2, 5); c.clip(); c.drawImage(Fx.icon(sk, 48), x + 1, y + 1, s - 2, s - 2);
          const cd = G.cds[id] || 0;
          if (cd > 0) { c.fillStyle = 'rgba(10,14,36,.72)'; c.beginPath(); c.moveTo(x + s / 2, y + s / 2); c.arc(x + s / 2, y + s / 2, s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / sk.cd)); c.closePath(); c.fill(); c.font = '15px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText(cd >= 1 ? Math.ceil(cd) : cd.toFixed(1), x + s / 2, y + s / 2 + 1); }
          else if (G.ready && G.ready[id] > 0) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,' + G.ready[id].toFixed(2) + ')'; c.fillRect(x, y, s, s); c.globalCompositeOperation = 'source-over'; }
          if (S.mp < sk.mp) { c.fillStyle = 'rgba(40,60,160,.6)'; c.fillRect(x, y, s, s); }
          c.restore();
        }
        c.fillStyle = '#0A0E24'; rr(c, x - 3, y - 3, 15, 15, 4); c.fill(); c.font = '11px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fu ? '#E7A6FF' : '#FFD23F'; c.fillText(fu ? FKEY[i - 4] : String(i + 1), x + 4.5, y + 5);
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
      const TB = { atk: { x: 880, y: 456, r: 48 }, s0: { x: 768, y: 482, r: 31 }, s1: { x: 778, y: 398, r: 31 }, s2: { x: 836, y: 346, r: 31 }, s3: { x: 914, y: 334, r: 31 }, f0: { x: 694, y: 420, r: 26 }, f1: { x: 712, y: 346, r: 26 }, f2: { x: 768, y: 290, r: 26 }, f3: { x: 842, y: 262, r: 26 }, hp: { x: 688, y: 500, r: 25 }, mp: { x: 636, y: 500, r: 25 } };
      function drawTouch(c) {
        if (G.joy && G.joy.on) { c.globalAlpha = 0.3; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(G.joy.cx, G.joy.cy, 62, 0, Math.PI * 2); c.fill(); c.globalAlpha = 0.85; const g = c.createRadialGradient(G.joy.cx + G.joy.vx * 50, G.joy.cy + G.joy.vy * 50, 4, G.joy.cx + G.joy.vx * 50, G.joy.cy + G.joy.vy * 50, 28); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#9AA8E0'); c.fillStyle = g; c.beginPath(); c.arc(G.joy.cx + G.joy.vx * 50, G.joy.cy + G.joy.vy * 50, 28, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
        else { c.globalAlpha = 0.3; c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.beginPath(); c.arc(110, 436, 62, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(110, 436, 24, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
        Object.entries(TB).forEach(([k, b]) => {
          c.globalAlpha = G.btnDown[k] ? 0.9 : 0.62; c.fillStyle = '#0A0E24'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
          if (k === 'atk') { const g = c.createRadialGradient(b.x, b.y - 10, 4, b.x, b.y, b.r); g.addColorStop(0, '#FFE45C'); g.addColorStop(1, '#C88A10'); c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r - 5, 0, Math.PI * 2); c.fill(); c.font = '18px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1D2340'; c.fillText('공격', b.x, b.y + 1); return; }
          if (k === 'hp' || k === 'mp') { const n = POT_T.reduce((a, t) => a + count(k + t), 0); c.fillStyle = k === 'hp' ? '#D2343A' : '#2F55D9'; c.beginPath(); c.arc(b.x, b.y, b.r - 4, 0, Math.PI * 2); c.fill(); c.font = '13px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText(String(n), b.x, b.y + 1); return; }
          const fu = k[0] === 'f', i = +k[1], sk = skill(fu ? S.fslots[i] : S.slots[i]);
          c.save(); c.beginPath(); c.arc(b.x, b.y, b.r - 4, 0, Math.PI * 2); c.clip();
          if (sk) { c.drawImage(Fx.icon(sk, 64), b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); const cd = G.cds[sk.id] || 0; if (cd > 0) { c.fillStyle = 'rgba(10,14,36,.7)'; c.beginPath(); c.moveTo(b.x, b.y); c.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd / sk.cd); c.fill(); c.font = '14px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText(cd.toFixed(1), b.x, b.y + 1); } }
          else { c.fillStyle = '#2A325E'; c.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); c.font = '14px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#8A93C0'; c.fillText(fu ? FKEY[i] : String(i + 1), b.x, b.y + 1); }
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
        const at = G.room ? G.room.back : { x: G.px, y: G.py };   // 건물 안이면 그 건물 문 앞을 저장
        S.x = Math.round(at.x); S.y = Math.round(at.y); S.savedAt = Date.now();
        if (!G.trade) pruneGear(S);   // v60 판 장비·부서진 장비 정보 지우기 (거래 중에는 그대로)
        const copy = JSON.parse(JSON.stringify(S));
        Store.setLocal(Hub.user && Hub.user.id, copy); G.saveT = 0;
        if (server) { G.srvT = 0; G.dirty = false; return Store.push(copy); }
        return true;
      }
      async function submitRank(pd) {
        if (!Hub.user) return;
        const now = Date.now(); if (now - G.lastSubmit < 4000 && !pd) return; G.lastSubmit = now;
        const sec = Math.min(86400, Math.round(S.play - G.playMark)); G.playMark = S.play;
        try { await Hub.submitScore({ game_id: GAME, score: rankScore(), duration_sec: Math.max(0, sec), result: null, points_delta: pd || 0, extra: { lv: S.lv, map: S.map, kills: S.kills, hell: S.hell ? hellTxt(S.hell) : null } }); loadRank(); } catch (e) { console.warn('[rpg] 랭킹 저장 실패', e.message); }
      }
      function bossReward() { const p = (CFG.points && CFG.points.boss) || 0; if (p) { submitRank(p); A.toast(`보스 처치! +${p}P`); } }
      async function loadRank() {
        const rk = $('#rgRank'), mine = $('#rgMine'); if (!rk) return;
        try {
          const rows = await Hub.leaderboard(GAME, 10); if (!rk.isConnected) return;
          rk.innerHTML = A.rankItems(rows, 'best_score', GAME); AV.paintAll(rk);
          mine.textContent = Hub.user ? `내 레벨 Lv.${S ? S.lv : '-'}${S && S.hell ? ` · 저승 ${hellTxt(S.hell)} 통과` : ''}` : '로그인하면 레벨이 랭킹에 올라가요.';
        } catch (e) { rk.innerHTML = '<li class="empty">랭킹을 불러오지 못했어요.</li>'; }
      }

      /* ================= 창 ================= */
      let pane = null, paneArg = null, tab = {};
      function openPanel(kind, arg) {
        pane = kind; paneArg = arg || null; G.keys = {}; G.btnDown = {}; G.joy = null;
        tab.trash = false; tab.trashAsk = null; tab.sellAsk = null; tab.sellAll = false;   // v68 창을 새로 열면 버리기·팔기 확인은 꺼짐
        G.paused = !(net && net.joined && kind !== 'help');   // 온라인이면 창을 열어도 세상은 계속 (다른 사람이 계속 움직임)
        if (kind === 'servers') { srvList = null; loadServers(); clearInterval(srvTimer); srvTimer = setInterval(() => { if (pane === 'servers') loadServers(); else clearInterval(srvTimer); }, 5000); }
        renderPanel(); panel.hidden = false;
      }
      function closePanel() {
        if (pane === 'dead') return;
        const wasDoor = ['potion', 'school', 'chief', 'castle'].includes(pane);
        if (pane === 'trade' && G.trade) { endTrade(true); say('거래를 취소했어요', 2); return; }
        if (pane === 'tradeIn' && paneArg) net.trade({ k: 'no', to: paneArg.cid });
        const was = pane; pane = null; panel.hidden = true; G.paused = false;
        if (was === 'help' && Hub.user && net && !net.joined && !G.srvAsked) { G.srvAsked = true; openPanel('servers'); return; }
        if (wasDoor && G.onDoor) { const b = G.onDoor; G.px = (b.door.x + 0.5) * TS; G.py = (b.door.y + 1.9) * TS; G.onDoor = null; }
        if (!S.help) { S.help = true; markDirty(); }
        try { screenEl.focus({ preventScroll: true }); } catch (e) { /* noop */ }
      }
      const npcBox = () => { const a = paneArg; if (!a || !a.npc) return ''; const d = a.npc.def; return `<div class="rg-npc"><img src="${npcPortrait(d.av)}" alt=""><div><b style="color:${d.color}">${d.name}</b><p>“${a.hello}”</p></div></div>`; };
      const head = (t, sub) => `<h3>${t}<button type="button" class="x" data-x>닫기 (Esc)</button></h3>${sub ? `<p class="sub">${sub}</p>` : ''}`;
      const tabs = (key, list) => `<div class="rg-tabs">${list.map(([k, n]) => `<button type="button" data-tab="${key}:${k}" aria-pressed="${(tab[key] || list[0][0]) === k}">${n}</button>`).join('')}</div>`;
      const edefTxt = () => { const v = Object.values(ST.edefs), lo = Math.min(...v), hi = Math.max(...v); return lo === hi ? lo + '%' : lo + '%+'; };
      const optList = it => (it && it.op && it.op.length ? `<ul class="rg-opts">${it.op.map(o => `<li class="${o[1] > 0 ? 'pos' : 'neg'}">${optTxt(o)}</li>`).join('')}</ul>` : '');
      const stOf = it => Object.entries(it.st || {}).map(([k, v]) => ({ atk: '공격', mag: '마력', def: '방어', hp: '체력', mp: '마나', spd: '속도%' }[k] + ' +' + v)).join(' · ');
      function renderPanel() {
        const k = pane; let h = '';
        if (k === 'inv') {   // v41 가방 창: 왼쪽 = 내 캐릭터 + 장비 칸 5개 + 능력치 · 오른쪽 = 가방 40칸 + 고른 물건 자세히
          const f = tab.invF || 'all', sel = tab.invSel || null;
          h = head('가방 · 장비', `<span class="rg-gold">${fmtN(S.gold)} G</span> · 가방 <b>${S.inv.length}</b>/${bagMax()}칸${(S.bagUp || 0) < D.BAG.max ? ' · 약방에서 늘릴 수 있어요' : ''}`);
          const av = Hub.user ? Hub.user.avatar : AV.normalize({}), fig = avatarSprite(av, S.eq, S.hide, 0).toDataURL();
          const tierStyle = it => it && it.slot ? `--c:${D.TIER[it.tier].color};--g:${D.TIER[it.tier].gem}` : '--c:#5A64A0;--g:#FFFFFF';
          const slotBtn = sl => { const id = S.eq[sl], it = ITEMS[id]; return `<button type="button" class="rg-eqs${sel === 'eq:' + sl ? ' sel' : ''}${it && it.rare ? ' rare' : ''}${it ? '' : ' empty'}" data-pick="eq:${sl}" style="grid-area:${sl};${tierStyle(it)}">${it ? `<img src="${P.itemImg(id)}" alt="">` : `<img class="ph" src="${P.itemImg(Object.keys(ITEMS).find(q => ITEMS[q].slot === sl && !ITEMS[q].tier && !ITEMS[q].rare))}" alt="">`}<small>${D.SLOT_NAME[sl]}</small></button>`; };
          h += `<div class="rg-inv"><section class="rg-doll"><div class="rg-dollgrid">${['helmet', 'weapon', 'armor', 'ring', 'boots'].map(slotBtn).join('')}<div class="rg-fig"><img src="${fig}" alt="내 캐릭터"><span class="lv">Lv.${S.lv}</span></div></div>`;
          h += `<div class="rg-statgrid">${[['공격', ST.atk, '#FF8A8E'], ['마력', ST.mag, '#C8A8FF'], ['방어', ST.def, '#9AE6FF'], ['체력', ST.hp, '#FF7A7E'], ['마나', ST.mp, '#7FA0FF'], ['속도', '+' + ST.spd + '%', '#9AF0B0'], ['물리 방어', ST.pdef + '%', '#7FE0F0'], ['속성 방어', edefTxt(), '#7FE0F0'], ['치명', ST.crit + '%', '#FFD23F']].map(([a2, v, c2]) => `<div><span style="color:${c2}">${a2}</span><b>${v}</b></div>`).join('')}</div>`;
          h += `<label class="rg-check"><input type="checkbox" data-hide ${S.hide ? 'checked' : ''}> 장비 안보이기 <small style="color:#AEB7E0">(그림만 숨김)</small></label></section>`;
          const list = S.inv.filter(x => f === 'all' || (f === 'gear' ? !!ITEMS[x.id].slot : !ITEMS[x.id].slot));
          const cells = list.map(x => { const it = ITEMS[x.id], ok = !it.slot || S.lv >= it.req; return `<button type="button" class="rg-cell${sel === x.id ? ' sel' : ''}${it.rare ? ' rare' : ''}${ok ? '' : ' off'}" data-pick="${x.id}" style="${tierStyle(it)}" title="${it.name}"><img src="${P.itemImg(x.id)}" alt="${it.name}">${x.n > 1 ? `<span class="n">${x.n}</span>` : ''}${it.en ? `<span class="en">+${it.en}</span>` : ''}${it.grade ? `<span class="gd" style="--gd:${GRADE[it.grade].color}"></span>` : ''}${ok ? '' : `<span class="lk">Lv.${it.req}</span>`}</button>`; });
          const pad = f === 'all' ? bagMax() - list.length : (8 - list.length % 8) % 8 + (list.length ? 0 : 8);
          for (let i = 0; i < pad; i++) cells.push('<span class="rg-cell empty"></span>');
          h += `<section class="rg-bag"><div class="rg-tabs">${[['all', '전체'], ['gear', '장비'], ['use', '물약·물건']].map(([k2, n]) => `<button type="button" data-filt="${k2}" aria-pressed="${f === k2}">${n}</button>`).join('')}<button type="button" class="rg-trash${tab.trash ? ' on' : ''}" data-trash aria-pressed="${!!tab.trash}" title="쓰레기통: 누른 뒤 버릴 물건을 누르세요">🗑 ${tab.trash ? '버리기 켜짐 (끄기)' : '쓰레기통'}</button></div>${tab.trash ? '<p class="rg-trashtip">버릴 물건을 누르세요. 입고 있는 장비는 버릴 수 없어요.</p>' : ''}<div class="rg-grid${tab.trash ? ' trashing' : ''}">${cells.join('')}</div>`;
          // 고른 물건 자세히
          let it = null, id = null, worn = false;
          if (sel && sel.startsWith('eq:')) { id = S.eq[sel.slice(3)]; worn = true; } else if (sel && count(sel)) id = sel;
          it = ITEMS[id];
          if (it) {
            const cur = it.slot && !worn ? ITEMS[S.eq[it.slot]] : null, keys = ['atk', 'mag', 'def', 'hp', 'mp', 'spd'], nm = { atk: '공격', mag: '마력', def: '방어', hp: '체력', mp: '마나', spd: '속도%' };
            const cmp = it.slot ? keys.filter(q => (it.st || {})[q] || (cur && (cur.st || {})[q])).map(q => { const v = (it.st || {})[q] || 0, d = v - ((cur && cur.st && cur.st[q]) || 0); return `<span>${nm[q]} <b>${v}</b>${!worn && d ? ` <em class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</em>` : ''}</span>`; }).join('') : '';
            const btn = worn ? `<button type="button" class="rg-mini ghost" data-unequip="${it.slot}">벗기</button>` : it.stack ? `<button type="button" class="rg-mini" data-use="${id}">쓰기</button>` : `<button type="button" class="rg-mini" data-equip="${id}" ${S.lv >= it.req ? '' : 'disabled'}>${S.lv >= it.req ? (cur ? '바꿔 입기' : '입기') : 'Lv.' + it.req + ' 필요'}</button>`;
            h += `<div class="rg-detail">${itemIcon(id)}<div class="grow"><b class="nm${it.rare ? ' rare' : ''}"${it.grade != null ? ` style="color:${GRADE[it.grade].color}"` : ''}>${it.name}${it.grade != null ? `<span class="rg-grade">${GRADE[it.grade].name}</span>` : ''}${worn ? ' <small>입는 중</small>' : ''}</b><span class="ds">${it.slot ? `${D.SLOT_NAME[it.slot]} · ${it.rare && !it.legend ? '정예 · ' : ''}Lv.${it.req} 이상 · 강화 +${it.en || 0}/${ENH.max}${cur ? ' · 지금: ' + cur.name : ''}` : it.desc + ' · 가진 수 ' + count(id)}</span>${cmp ? `<div class="cmp">${cmp}</div>` : ''}${optList(it)}</div>${btn}</div>`;
          } else h += `<div class="rg-detail hint">칸을 누르면 자세히 보여요. 필요 없는 물건은 <b>🗑 쓰레기통</b>을 누른 뒤 고르면 버릴 수 있어요. 장비는 <b>입기</b>, 물약은 <b>쓰기</b>. 사냥터 몬스터가 장비를 떨어뜨려요 (보스는 꼭!)</div>`;
          h += '</section></div>';
          const tq = tab.trashAsk && count(tab.trashAsk) ? tab.trashAsk : null;   // v68 버리기 경고
          if (tq) { const it = ITEMS[tq], n = count(tq), gd = it.slot && it.grade != null ? GRADE[it.grade] : null;
            h += `<div class="rg-warnbg"><div class="rg-warn" role="alertdialog" aria-label="아이템 버리기 경고"><b class="t">⚠ 정말 버릴까요?</b>${itemIcon(tq)}<p class="nm"${gd ? ` style="color:${gd.color}"` : ''}>${it.name}${n > 1 ? ' ×' + n : ''}${gd ? `<span class="rg-grade">${gd.name}</span>` : ''}</p><p>버린 물건은 <b>사라지고 되돌릴 수 없어요.</b>${it.slot ? ` 약방에 팔면 <b class="rg-price">${fmtN(sellPrice(tq))} G</b> 를 받을 수 있어요.` : ''}</p><div class="btns"><button type="button" class="rg-mini warn" data-trashdo="${tq}:1">${n > 1 ? '1개 버리기' : '버리기'}</button>${n > 1 ? `<button type="button" class="rg-mini warn" data-trashdo="${tq}:${n}">${n}개 모두 버리기</button>` : ''}<button type="button" class="rg-mini" data-trashno>취소</button></div></div></div>`; }
        } else if (k === 'skill') {
          h = head('마법', '기본 마법은 <b>1~4</b> 칸, 융합 마법은 <b>Q W E R</b> 칸에 넣어요. 같은 마법을 다른 칸에 넣으면 옮겨져요. 새 마법은 마을의 <b>도술 서원</b>에서 배워요.');
          h += `<div class="rg-slots">${[0, 1, 2, 3].map(i => { const sk = skill(S.slots[i]); return `<span class="rg-slot"><b>${i + 1}</b>${sk ? `<img class="rg-sk" src="${Fx.iconURL(sk)}" alt="">${sk.name}` : '<i>비어 있음</i>'}</span>`; }).join('')}</div>`;
          h += `<div class="rg-slots">${[0, 1, 2, 3].map(i => { const sk = skill(S.fslots[i]); return `<span class="rg-slot" style="border-color:#B57BFF"><b style="color:#E7A6FF">${FKEY[i]}</b>${sk ? `<img class="rg-sk" src="${Fx.iconURL(sk)}" alt="">${sk.name}` : '<i>융합 마법</i>'}</span>`; }).join('')}</div>`;
          h += `<ul class="rg-list">${S.skills.length ? S.skills.map(id => { const sk = skill(id); return `<li class="rg-row"><img class="rg-sk" src="${Fx.iconURL(sk)}" alt=""><span class="grow"><span class="nm">${sk.fusion ? '융합 · ' : ''}${sk.name} <small style="color:#AEB7E0">Lv.${sk.lv}</small></span><span class="ds">${describe(sk)}</span></span>${[0, 1, 2, 3].map(i => sk.fusion ? `<button type="button" class="rg-mini${S.fslots[i] === id ? ' on' : ' ghost'}" data-slot="f${i}|${id}">${FKEY[i]}</button>` : `<button type="button" class="rg-mini${S.slots[i] === id ? ' on' : ' ghost'}" data-slot="${i}|${id}">${i + 1}</button>`).join('')}</li>`; }).join('') : '<li class="rg-row">아직 배운 마법이 없어요. Lv.3이 되면 솔뫼 마을 도술 서원에서 파이어볼을 배울 수 있어요.</li>'}</ul>`;
        } else if (k === 'potion') {
          const ri = G.map.M.region, t = tab.potion || 'buy';
          h = head('약방', `<span class="rg-gold">${fmtN(S.gold)} G</span> · 이 마을은 ${ri + 1}단계 포션까지 팔아요`) + npcBox() + tabs('potion', [['buy', '사기'], ['sell', '팔기']]);
          if (t === 'buy') { const bu = S.bagUp || 0, bc = D.BAG.cost(bu); h += `<div class="rg-bagup"><span class="ic">🎒</span><span class="grow"><b>가방 늘리기 +${D.BAG.step}칸</b><small>지금 ${bagMax()}칸 → ${bu < D.BAG.max ? bagMax() + D.BAG.step : bagMax()}칸 · 최대 ${D.BAG.base + D.BAG.step * D.BAG.max}칸 (${bu}/${D.BAG.max}번)</small></span>${bu >= D.BAG.max ? '<span class="rg-mini on">최대</span>' : `<button type="button" class="rg-mini" data-bagup ${S.gold >= bc ? '' : 'disabled'}>${fmtN(bc)} G</button>`}</div>`; }
          if (t === 'buy') h += `<ul class="rg-list">${D.POTIONS.filter(p => p.tier <= ri).map(p => `<li class="rg-row">${itemIcon(p.id)}<span class="grow"><span class="nm">${p.name} <small style="color:#AEB7E0">가진 수 ${count(p.id)}</small></span><span class="ds">${p.desc} · ${fmtN(p.price)} G</span></span><button type="button" class="rg-mini" data-buy="${p.id}:1" ${S.gold >= p.price ? '' : 'disabled'}>1개</button><button type="button" class="rg-mini" data-buy="${p.id}:10" ${S.gold >= p.price * 10 ? '' : 'disabled'}>10개</button></li>`).join('')}</ul>`;
          else {   // v68 팔기: 장비는 등급·레벨·강화로 값이 정해짐. 희귀 이상·강화한 장비는 한 번 더 묻기
            const gear = S.inv.filter(x => ITEMS[x.id].slot).sort((a, b) => sellPrice(b.id) - sellPrice(a.id)), etc = S.inv.filter(x => !ITEMS[x.id].slot);
            const plain = gear.filter(x => !ITEMS[x.id].en && (ITEMS[x.id].grade || 0) === 0), plainSum = plain.reduce((t, x) => t + sellPrice(x.id) * x.n, 0);
            const ask = tab.sellAsk && count(tab.sellAsk) ? tab.sellAsk : null;
            const row = x => { const it = ITEMS[x.id], pr = sellPrice(x.id), gd = it.slot && it.grade != null ? GRADE[it.grade] : null, careful = it.slot && (it.en || (it.grade || 0) >= 2);
              return `<li class="rg-row${ask === x.id ? ' ask' : ''}">${itemIcon(x.id)}<span class="grow"><span class="nm"${gd ? ` style="color:${gd.color}"` : ''}>${it.name}${x.n > 1 ? ' ×' + x.n : ''}${gd ? `<span class="rg-grade">${gd.name}</span>` : ''}</span><span class="ds">${it.slot ? `${D.SLOT_NAME[it.slot]} · Lv.${it.req}${it.en ? ' · +' + it.en + ' 강화' : ''}${it.op && it.op.length ? ' · 옵션 ' + it.op.length + '개' : ''} · ` : ''}<b class="rg-price">${fmtN(pr)} G</b>${x.n > 1 ? ' (1개)' : ''}</span></span>${ask === x.id
                ? `<button type="button" class="rg-mini warn" data-sell="${x.id}:1">정말 팔기</button><button type="button" class="rg-mini ghost" data-sellno>취소</button>`
                : careful ? `<button type="button" class="rg-mini" data-sellask="${x.id}">팔기</button>` : `<button type="button" class="rg-mini" data-sell="${x.id}:1">${x.n > 1 ? '1개' : '팔기'}</button>${x.n > 1 ? `<button type="button" class="rg-mini ghost" data-sell="${x.id}:${x.n}">모두</button>` : ''}`}</li>`; };
            h += `<p class="sub">장비 값 = (10 + 착용 레벨 × 3) × 등급 (일반 ×1 · 고급 ×1.5 · 희귀 ×2.2 · 영웅 ×3.2 · 전설 ×5) + 강화에 쓴 골드의 30%. 포션·주문서는 산 값의 40%. 입고 있는 장비는 팔 수 없어요.</p>`;
            if (plain.length) h += `<div class="rg-sellall">${tab.sellAll ? `<b>강화 안 한 일반 장비 ${plain.length}개를 ${fmtN(plainSum)} G 에 모두 팔까요?</b><button type="button" class="rg-mini warn" data-sellall>모두 팔기</button><button type="button" class="rg-mini ghost" data-sellallno>취소</button>` : `<span>강화 안 한 <b>일반</b> 장비 ${plain.length}개 · ${fmtN(plainSum)} G</span><button type="button" class="rg-mini" data-sellallask>한꺼번에 팔기</button>`}</div>`;
            h += `<ul class="rg-list">${S.inv.length ? gear.concat(etc).map(row).join('') : '<li class="rg-row">팔 물건이 없어요. 사냥터 몬스터가 장비를 떨어뜨려요</li>'}</ul>`;
          }
        } else if (k === 'school') {
          const ri = G.map.M.region, t = tab.school || 'learn';
          h = head('도술 서원', `<span class="rg-gold">${fmtN(S.gold)} G</span> · 마법 배우기 · 두 원소 섞기`) + npcBox() + tabs('school', [['learn', '마법 배우기'], ['fuse', '마법 융합']]);
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
        } else if (k === 'hell') {   // v69 저승차사: 이야기 + 관문·단계 고르기
          const best = S.hell || 0, t = tab.hell || 'gate';
          h = head('저승문 · 임진왜란 뒤 저승에서 생긴 일', `깬 단계 <b style="color:#FFD23F">${best ? hellTxt(best) : '없음'}</b> · 몬스터는 Lv.101부터 (내 레벨은 100 그대로라 점점 어려워요)`) + npcBox() + tabs('hell', [['gate', '관문 들어가기'], ['story', '이야기']]);
          if (t === 'story') h += `<div class="rg-story">${D.HELL.story.map(x => `<p>${x}</p>`).join('')}</div>`;
          else h += D.HELL.gates.map(g => { const base = (g.no - 1) * 5;
            return `<div class="rg-gate"><b class="gt">제${g.no}관문 · ${g.hell} <small>${g.king} · ${g.day}</small></b> <span class="rg-el">속성 ${ELEM[g.el].name} · 약점 <b>${ELEM[D.HELL.weak[g.el]].name}</b> 마법 (×${D.HELL.weakMul})</span><p class="sub" style="margin:4px 0 8px">${g.about}</p><div class="rg-stages">${[1, 2, 3, 4, 5].map(st => { const n = base + st, open = n <= best + 1, done = n <= best, lv = 100 + base + st;
              return `<button type="button" class="rg-stage${done ? ' done' : ''}" data-hellgo="h${g.no}-${st}" ${open ? '' : 'disabled'}><b>${g.no}-${st}</b><span>${g.stageName[st - 1]}</span><small>${st === 5 ? '대왕 Lv.' + (lv + D.HELL.bossPlus) : `Lv.${lv} · ${D.HELL.kills}마리${st === 3 ? ` + 옥졸 Lv.${lv + D.HELL.midPlus}` : st === 4 ? ` + 판관 Lv.${lv + D.HELL.midPlus}` : ''}`}</small><i>${done ? '통과' : open ? '들어가기' : '잠김'}</i></button>`; }).join('')}</div></div>`; }).join('') + `<p class="sub">2~10관문(초강대왕 화탕지옥 …)은 곧 열려요. 저승에서 쓰러지면 그 단계는 처음부터 다시 해요.</p>`;
        } else if (k === 'forge') {   // v60 대장간: 장비 강화 (+0 → +10 · 실패하면 부서짐)
          const mine = Object.keys(S.eq).map(sl => ({ id: S.eq[sl], worn: true })).concat(S.inv.filter(x => ITEMS[x.id] && ITEMS[x.id].slot).map(x => ({ id: x.id, worn: false })));
          if (!mine.some(x => x.id === tab.fgSel)) tab.fgSel = (mine.find(x => (ITEMS[x.id].en || 0) < ENH.max) || mine[0] || {}).id || null;
          h = head('대장간 · 장비 강화', `<span class="rg-gold">${fmtN(S.gold)} G</span> · +0 → +${ENH.max} · 1강마다 기본 능력치 +${Math.round(ENH.per * 100)}% · <b style="color:#FFD23F">+7 까지는 실패하면 한 단계 내려가요</b> · <b style="color:#FF8A8E">+8 부터는 실패하면 장비가 부서져요!</b>`) + npcBox();
          h += `<div class="rg-forge"><ul class="rg-list">${mine.length ? mine.map(x => { const it = ITEMS[x.id], en = it.en || 0, full = en >= ENH.max; return `<li class="rg-row${tab.fgSel === x.id ? ' sel' : ''}">${itemIcon(x.id)}<span class="grow"><span class="nm" style="color:${GRADE[it.grade || 0].color}">${it.name}${x.worn ? ' <small style="color:#9AF0B0">입는 중</small>' : ''}</span><span class="ds">${full ? '최고 강화!' : `+${en}→+${en + 1} · 성공 ${ENH.rate[en]}% · ${fmtN(ENH.cost(en))} G`}</span></span><button type="button" class="rg-mini${tab.fgSel === x.id ? ' on' : ' ghost'}" data-fgsel="${x.id}">고르기</button></li>`; }).join('') : '<li class="rg-row">강화할 장비가 없어요. 사냥터에서 장비를 얻어 오세요!</li>'}</ul>`;
          const id = tab.fgSel, it = ITEMS[id];
          h += '<section class="rg-anvil">';
          if (it) {
            const en = it.en || 0, full = en >= ENH.max, cost = full ? 0 : ENH.cost(en), rate = full ? 0 : ENH.rate[en], B = ITEMS[it.base] || it, k2 = 1 + ENH.per * (en + 1);
            const nm = { atk: '공격', mag: '마력', def: '방어', hp: '체력', mp: '마나', spd: '속도%' };
            const after = Object.keys(it.st).map(q => `<span>${nm[q]} <b>${it.st[q]}</b>${!full && q !== 'spd' ? ` <em class="up">→ ${Math.round(B.st[q] * k2)}</em>` : ''}</span>`).join('');
            h += `<div class="big">${itemIcon(id)}<div class="grow"><b class="nm" style="font-size:17px;color:${GRADE[it.grade || 0].color}">${it.name}<span class="rg-grade">${GRADE[it.grade || 0].name}</span></b><div class="cmp" style="display:flex;flex-wrap:wrap;gap:2px 10px;font-size:13px">${after}</div>${optList(it)}</div></div>`;
            h += `<div class="ladder">${ENH.rate.map((r, i) => `<span class="${i < en ? 'done' : i === en ? 'next' : ''}${i >= ENH.safeTo ? ' risk' : ''}" title="+${i + 1} 성공 ${r}% · ${fmtN(ENH.cost(i))} G · 실패하면 ${i >= ENH.safeTo ? '부서짐' : '한 단계 내려감'}">+${i + 1}<br>${r}%</span>`).join('')}</div>`;
            if (full) h += '<p class="sub" style="text-align:center;margin:8px 0">+10 최고 강화! 더는 강화할 수 없어요.</p>';
            else if (tab.fgAsk === id) h += `<div class="warnbox">정말 강화할까요? <b>+${en + 1}</b> 성공 확률 <b>${rate}%</b> · <b>${fmtN(cost)} G</b>${en >= ENH.safeTo ? `<br><span class="danger">⚠ 경고! +${en + 1} 부터는 실패하면 <b>${it.name}</b>이(가) <b>부서져서 영영 사라져요.</b> 되돌릴 수 없어요!</span>` : `<br>실패하면 강화가 <b>+${Math.max(0, en - 1)}</b>${en ? ' 로 한 단계 내려가요' : ' 그대로예요'} (부서지지는 않아요).`}</div><div class="two"><button type="button" class="go warn" data-fgdo="${id}">예, 두드려요!</button><button type="button" class="go" style="background:#2A325E;color:#FFFFFF" data-fgno>아니요</button></div>`;
            else h += `<button type="button" class="go" data-fgask="${id}" ${S.gold >= cost ? '' : 'disabled'}>${S.gold >= cost ? `${en >= ENH.safeTo ? '⚠ 파괴 위험 ' : ''}강화하기 · ${fmtN(cost)} G · 성공 ${rate}%` : `골드가 모자라요 (${fmtN(cost)} G 필요)`}</button>`;
          } else h += '<p class="sub">왼쪽에서 강화할 장비를 골라요.</p>';
          const R2 = tab.fgRes;
          if (R2) { const im = imgOk(R2.ok ? 'fx_enh_ok' : 'fx_enh_break'); h += `<div class="rg-res ${R2.ok ? 'ok' : R2.down ? 'down' : 'bad'}"><div>${im ? `<img src="${im.src}" alt="">` : `<div class="ham">${R2.ok ? '★' : '✕'}</div>`}<b>${R2.ok ? `강화 성공! +${R2.en}` : R2.down ? `강화 실패… +${R2.en}` : '강화 실패… 부서졌어요'}</b><small>${R2.name}</small><button type="button" class="rg-mini x2" data-fgok>확인</button></div></div>`; }
          h += '</section></div>';
        } else if (k === 'chief') {
          const vis = S.visited;
          h = head('이장 댁', '이 마을이 귀환 장소가 돼요. 가 본 마을·사냥터로 무료 이동') + npcBox();
          h += `<div class="rg-tabs"><button type="button" class="rg-mini" data-savenow>지금 저장</button><span class="rg-mini ghost" style="cursor:default">처치 ${fmtN(S.kills)} · 플레이 ${Math.floor(S.play / 60)}분</span></div>`;
          D.REGIONS.forEach((R, ri) => {
            const vid = 'v' + (ri + 1), fs = D.MAPS.filter(m => m.kind === 'field' && !m.hell && m.region === ri);
            if (!vis.includes(vid) && !fs.some(m => vis.includes(m.id))) return;
            h += `<p class="sub" style="margin-top:8px"><b>${R.name}</b> 지역</p><div class="rg-tabs">${vis.includes(vid) ? `<button type="button" class="rg-mini" data-go="${vid}">${R.name}</button>` : ''}${fs.map(m => vis.includes(m.id) ? `<button type="button" class="rg-mini ghost" data-go="${m.id}">${m.no}. ${m.name} (Lv.${m.rec})</button>` : '').join('')}</div>`;
          });
          h += '<p class="sub" style="margin-top:8px">※ 퀘스트는 준비 중이에요. 나중에 마지막 마을의 성에서 나눠 줄 예정이에요.</p>';
        } else if (k === 'castle') {
          h = head('도원수 진영', '퀘스트는 아직 준비 중이에요. 다음 업데이트에서 이곳에서 퀘스트를 받을 수 있어요.') + npcBox();
        } else if (k === 'tradeAsk') {
          const pp = paneArg.pp;
          h = head('거래 신청', '같은 지도에 있는 사람과 아이템·골드를 바꿀 수 있어요. 두 사람 모두 확인을 눌러야 바뀌어요.');
          h += `<div class="rg-fuse"><b style="color:#9AE6FF">${pp.nick}</b> (Lv.${pp.lv}) 님에게 거래를 신청할까요?</div><div class="rg-srvact"><button type="button" class="rg-mini" data-trreq="${pp.cid}">거래 신청</button><button type="button" class="rg-mini ghost" data-x>취소</button></div>`;
        } else if (k === 'tradeIn') {
          h = `<h3>거래 신청이 왔어요</h3><div class="rg-fuse"><b style="color:#9AE6FF">${paneArg.nick}</b> 님이 거래를 하고 싶어 해요.</div><div class="rg-srvact"><button type="button" class="rg-mini" data-tryes="${paneArg.cid}">수락</button><button type="button" class="rg-mini ghost" data-trno="${paneArg.cid}">거절</button></div>`;
        } else if (k === 'trade') {
          const T = G.trade; if (!T) { h = head('거래', '거래가 끝났어요.'); panel.innerHTML = h; return; }
          const list = (o, mine) => { const ids = Object.keys(o.items).filter(id => o.items[id] > 0); return ids.length ? ids.map(id => `<${mine ? 'button type="button" data-trdel="' + id + '"' : 'span'} class="rg-cell${ITEMS[id].rare ? ' rare' : ''}" title="${ITEMS[id].name}${mine ? ' (누르면 빼기)' : ''}"><img src="${P.itemImg(id)}" alt="${ITEMS[id].name}"><span class="n">${o.items[id]}</span></${mine ? 'button' : 'span'}>`).join('') : '<span class="rg-trempty">아직 없어요</span>'; };
          h = `<h3>${T.nick}님과 거래<button type="button" class="x" data-trcancel>거래 취소</button></h3>`;
          h += `<div class="rg-trade"><section class="rg-bag${T.myOk ? ' ok' : ''}"><b class="tt">내가 줄 것 ${T.myOk ? '<em>확인</em>' : ''}</b><div class="rg-trlist">${list(T.mine, true)}</div><label class="rg-trgold">골드 <input type="number" min="0" max="${S.gold}" value="${T.mine.gold}" data-trgold> <small>/ ${fmtN(S.gold)} G</small></label></section>`;
          h += `<section class="rg-bag${T.theirOk ? ' ok' : ''}"><b class="tt">${T.nick}님이 줄 것 ${T.theirOk ? '<em>확인</em>' : ''}</b><div class="rg-trlist">${list(T.theirs, false)}</div><div class="rg-trgold">골드 <b class="rg-gold">${fmtN(T.theirs.gold)} G</b></div></section></div>`;
          const bag = S.inv.filter(x => count(x.id) - (T.mine.items[x.id] || 0) > 0);
          h += `<p class="sub" style="margin-top:10px">내 가방 — 눌러서 올리기 (입고 있는 장비는 못 올려요)</p><div class="rg-grid">${bag.map(x => { const left = x.n - (T.mine.items[x.id] || 0), it = ITEMS[x.id]; return `<button type="button" class="rg-cell${it.rare ? ' rare' : ''}" data-tradd="${x.id}" title="${it.name}"><img src="${P.itemImg(x.id)}" alt="${it.name}">${left > 1 ? `<span class="n">${left}</span>` : ''}</button>`; }).join('') || '<span class="rg-trempty">올릴 물건이 없어요</span>'}</div>`;
          const room = roomFor(T.theirs, T.mine);
          h += `<div class="rg-srvact" style="align-items:center"><button type="button" class="rg-mini${T.myOk ? ' on' : ''}" data-trok ${room ? '' : 'disabled'}>${T.myOk ? '확인함 (다시 누르면 풀기)' : '확인'}</button><span class="sub" style="margin:0">${!room ? `가방이 모자라요 (${bagMax()}칸) — 약방에서 가방을 늘리거나 물건을 정리해요` : T.myOk && T.theirOk ? '교환하는 중…' : T.myOk ? '상대가 확인하면 바뀌어요' : T.theirOk ? '상대는 확인했어요. 내용을 보고 확인을 눌러요' : '둘 다 확인을 누르면 바뀌어요'}</span></div>`;
        } else if (k === 'stat') {   // v44 스탯 창: 왼쪽 캐릭터 · 오른쪽 힘·민첩·지혜·체력 올리기 · 아래 자세한 능력치
          const T = D.STAT, a = S.stat, PT = stats(true), used = T.keys.reduce((x, q) => x + a[q], 0), per = CFG.statPerLevel || 2;
          const av = Hub.user ? Hub.user.avatar : AV.normalize({}), fig = avatarSprite(av, S.eq, S.hide, 0).toDataURL(), ex = S.lv >= D.MAX_LV ? 100 : S.exp / D.F.need(S.lv) * 100;
          h = head('스탯', `레벨이 오를 때마다 포인트 ${per}개 · 원하는 스탯에 올려요 (스탯마다 최대 ${T.max})`);
          h += `<div class="rg-statwin"><section class="rg-doll rg-statfig"><div class="rg-fig"><img src="${fig}" alt="내 캐릭터"><span class="lv">Lv.${S.lv}</span></div><b class="nm">${Hub.user ? Hub.user.nickname : '손님'}</b><div class="rg-xp"><i style="width:${ex.toFixed(1)}%"></i></div><small>경험치 ${ex.toFixed(1)}%</small></section>`;
          h += `<section class="rg-bag rg-alloc"><div class="rg-sp">남은 포인트 <b>${S.sp}</b></div>${T.keys.map(q => { const full = a[q] >= T.max; return `<div class="rg-st" style="--c:${T[q].color}"><div class="lab"><b>${T[q].name}</b><span>${a[q]}<small class="mx"> / ${T.max}</small></span></div><small>${T[q].desc}</small><div class="btns"><button type="button" class="rg-mini" data-addst="${q}:1" ${S.sp < 1 || full ? 'disabled' : ''}>+1</button><button type="button" class="rg-mini ghost" data-addst="${q}:5" ${S.sp < 1 || full ? 'disabled' : ''}>+5</button></div></div>`; }).join('')}<div class="rg-srvact"><button type="button" class="rg-mini ghost" data-streset ${used ? '' : 'disabled'}>포인트 다시 나누기 (무료)</button></div></section></div>`;
          const OK2 = { atk: 'atkP', mag: 'magP', hp: 'hpP', mp: 'mpP', spd: 'spdP', crit: 'crit', dmg: 'dmg', mpRegen: 'mpReg', pdef: 'pdef' };
          const fm = v => (Math.round(v * 10) / 10).toLocaleString('ko-KR'), sg = v => (v < 0 ? '−' + fm(-v) : '+' + fm(v)), pt = (k2, unit) => { const b = PT.base[k2] || 0, sv = PT.sta[k2] || 0, g = PT.gear[k2] || 0, op = PT.opt[OK2[k2]] || 0; return [b ? `기본 ${fm(b)}${unit}` : '', sv ? `<em class="s">스탯 +${fm(sv)}${unit}</em>` : '', g ? `<em class="g">장비 +${fm(g)}${unit}</em>` : '', op ? `<em class="g">옵션 ${sg(op)}%</em>` : ''].filter(Boolean).join(' · ') || '—'; };
          const rows = [
            ['주는 피해', '+' + fm(ST.dmg || 0) + '%', '기본 공격·마법 모두', pt('dmg', '%'), '#FF8A8E'],
            ['공격력', ST.atk, '기본 공격 피해', pt('atk', ''), '#FF8A8E'],
            ['마력', ST.mag, '마법 피해 (마법 위력 × 마력)', pt('mag', ''), '#C8A8FF'],
            ['방어력', ST.def, `받는 피해 −${fm(ST.def * 0.5)}`, pt('def', ''), '#9AE6FF'],
            ['최대 체력', ST.hp, '', pt('hp', ''), '#FFB86B'],
            ['최대 마나', ST.mp, '', pt('mp', ''), '#7FA0FF'],
            ['마나 회복', fm(ST.mpRegen) + '%', `싸우지 않을 때 1초에 마나 ${fm(ST.mp * 0.02 * ST.mpRegen / 100)}`, pt('mpRegen', '%'), '#C8A8FF'],
            ['이동 속도', '+' + fm(ST.spd || 0) + '%', '', pt('spd', '%'), '#9AF0B0'],
            ['물리 방어', fm(ST.pdef) + '%', `몸통 박치기 피해 −${fm(ST.pdef)}% (최대 ${D.STAT.defCap}%)`, pt('pdef', '%'), '#7FE0F0'],
            ['치명타', fm(ST.crit) + '% · ×' + fm(ST.critD), '치명타 확률 · 치명타 피해 배수', pt('crit', '%'), '#FFD23F'],
            ['골드 · 경험치', `+${fm(ST.goldP || 0)}% · +${fm(ST.expP || 0)}%`, '장비 옵션으로만 올라요', '', '#FFE45C']
          ];
          h += `<div class="rg-detailgrid">${rows.map(([n, v, d2, parts, c2]) => `<div><span style="color:${c2}">${n}</span><b>${v}</b>${d2 ? `<small>${d2}</small>` : ''}${parts ? `<small class="pt">${parts}</small>` : ''}</div>`).join('')}</div>`;
          h += `<p class="sub" style="margin:10px 0 0">속성 방어 — 원거리 탄·보스 내려찍기는 그 지역 속성이에요 (저항 +${fm(PT.sta.edef || 0)}% 포함, 최대 ${D.STAT.defCap}%)</p><div class="rg-defgrid">${Object.keys(ELEM).map(e => `<div><span style="color:${ELEM[e].color}">${ELEM[e].name}</span><b>${fm(ST.edefs[e])}%</b></div>`).join('')}</div>`;
        } else if (k === 'servers') {   // v42 서버 고르기
          const cap = net.opt.cap, L = srvList;
          h = head('서버 고르기', '같은 서버의 같은 지도에 있는 사람이 보여요. 아이템·마법·레벨은 <b>계정에 저장</b>돼서 어느 서버에서나 그대로 이어져요.');
          if (!Hub.user) h += `<div class="rg-fuse">로그인하면 다른 사람과 함께 모험할 수 있어요. 손님은 혼자 하기로 이어져요.</div><button type="button" class="btn btn-primary" data-x>혼자 하기</button>`;
          else if (!L) h += '<p class="sub">서버 인원을 불러오는 중…</p>';
          else if (L.error) h += `<div class="rg-fuse">${L.error === 'sql' ? '온라인 서버 준비가 아직 안 됐어요. (관리자: supabase/rpg_online_v42.sql 실행 필요)' : '서버 인원을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'}</div><button type="button" class="btn btn-primary" data-solo>혼자 하기</button>`;
          else {
            const rows = L.rows, low = rows.reduce((a, r) => (r.players != null && r.players < cap && (a == null || r.players < a.players) ? r : a), null);
            h += `<div class="rg-srvs">${rows.map(r => { const n = r.players, full = n != null && n >= cap, pct = n == null ? 0 : Math.round(n / cap * 100), cur = net.joined && net.server === r.server;
              const lab = n == null ? '체험 모드' : full ? '가득' : n >= cap * 2 / 3 ? '혼잡' : n >= cap / 3 ? '보통' : '여유', col = full ? '#FF5A5F' : n >= cap * 2 / 3 ? '#FF9A3D' : n >= cap / 3 ? '#FFD23F' : '#3DDC84';
              return `<button type="button" class="rg-srv${cur ? ' cur' : ''}" data-srv="${r.server}" ${full && !cur ? 'disabled' : ''}><b>${r.server}서버</b>${low && low.server === r.server && !cur ? '<em>추천</em>' : ''}${cur ? '<em class="me">지금</em>' : ''}<span class="bar"><i style="width:${pct}%;background:${col}"></i></span><small>${n == null ? lab : `${n} / ${cap}명 · <span style="color:${col}">${lab}</span>`}</small></button>`; }).join('')}</div>`;
            h += `<div class="rg-srvact"><button type="button" class="rg-mini" data-srv="auto">가장 한산한 서버로 들어가기</button><button type="button" class="rg-mini ghost" data-solo>${net.joined ? '서버에서 나와 혼자 하기' : '혼자 하기'}</button></div>`;
            h += `<p class="sub">한 서버에 ${cap}명까지 · 서버 ${rows.length}개. 몬스터와 떨어진 물건은 각자 따로예요. ${L.demo ? '(체험 모드: 같은 브라우저의 다른 탭끼리만 연결돼요)' : ''}</p>`;
          }
        } else if (k === 'dead') {
          h = `<h3>쓰러졌어요…</h3><p class="sub">경험치를 ${fmtN(paneArg.loss)} 잃었어요. (레벨은 그대로)<br>마지막으로 들른 마을(${MAPBY[S.home].name})의 이장 댁 앞에서 다시 시작해요.</p><button type="button" class="btn btn-primary" data-revive>마을에서 다시 시작</button>`;
        } else if (k === 'help') {
          h = head('도움말', '내 아바타로 떠나는 도트 RPG — 혼자 플레이 첫 버전') + (imgOk('key') ? `<img src="${imgOk('key').src}" alt="" style="width:100%;border-radius:10px;border:2px solid #0A0E24;margin:4px 0 10px;display:block">` : '');
          h += `<ul class="ult-rules">
            <li><b>이동</b> 방향키 · <b>공격</b> Space·J · <b>기본 마법</b> 1~4 · <b>융합 마법</b> Q W E R · <b>포션</b> Z(체력) X(마나) · <b>가방</b> I · <b>마법 창</b> K · <b>창 닫기</b> Esc</li>
            <li>휴대폰은 화면 왼쪽을 끌면 이동(조이스틱), 오른쪽 버튼으로 공격·마법·포션. 가로로 돌리면 더 커요.</li>
            <li>지도 <b>오른쪽 끝 → 다음 지도</b>, 왼쪽 끝 → 이전 지도. 마을 → 사냥터 10곳 → 다음 마을 … 마을 하나가 10레벨씩(솔뫼 마을 Lv.1~10 … 구름절 마을 Lv.71~80), 마지막 도원수 진영은 Lv.80~100.</li>
            <li>문으로 걸어 들어가면 <b>건물 안</b>이에요. 안에 있는 사람에게 가까이 가면 이야기해요: <b>약방</b> 미나 · <b>도술 서원</b> 루멘(마법 배우기·융합) · <b>이장 댁</b> 이장님(무료 이동·저장). 아래 가운데 문으로 나가요.</li>
            <li>처음부터 <b>마법 화살</b>(1번 키)을 쓸 수 있어요.</li>
            <li><b>스탯</b>: 레벨이 오를 때마다 포인트 2개 — 왼쪽 위 얼굴(또는 C)을 눌러 힘(피해)·민첩(이동 속도)·지혜(마나 회복)·체력(최대 체력)·<b>저항</b>(물리 방어 +0.5% · 속성 방어 +0.5%)에 올려요. 스탯마다 최대 50.</li>
            <li><b>거래</b>: 온라인 서버에서 같은 지도에 있는 사람을 누르거나 가까이 가서 F → 거래 신청. 둘 다 확인을 누르면 아이템·골드가 바뀌어요.</li>
            <li>직업은 없어요. 레벨이 오르면 도술 서원에서 새 마법을 배우고, 두 원소를 섞어 <b>융합 마법</b>을 만들어요.</li>
            <li>장비는 몬스터가 떨어뜨려요(보스는 꼭). 장비마다 <b>옵션</b>이 무작위로 붙어요 (예: 번개 속성 방어 +0.8% · 물리 방어 −0.1%). 옵션 수에 따라 일반·고급·희귀·영웅, Lv.100 <b>전설</b> 장비도 있어요. 장비마다 입을 수 있는 레벨이 달라요.</li>
            <li><b>대장간</b>(마을마다)의 대장장이에게 가까이 가면 <b>강화</b>: +0 → +10, 1강마다 기본 능력치 +10%. 골드는 100 G 에서 두 배씩(+10 은 51,200 G), 성공 확률은 95% → 30% 로 낮아지고 <b>실패하면 장비가 부서져요!</b></li>
            <li>입으면 아바타 위에 보이고, 가방의 <b>장비 안보이기</b>로 그림만 숨길 수 있어요.</li>
            <li>쓰러지면 경험치가 조금 줄고 마지막 마을에서 다시 시작해요. <b>귀환 주문서</b>로 언제든 마을로 돌아갈 수 있어요.</li>
          </ul><button type="button" class="btn btn-primary" data-x>모험 시작!</button>`;
        }
        panel.innerHTML = h;
        if (k === 'inv' && tab.trashAsk) panel.scrollTop = 0;   // v68 버리기 경고가 보이게
      }
      function equipNow(id) {
        const it = ITEMS[id]; if (!it || !it.slot || S.lv < it.req || !takeItem(id)) return false;
        const old = S.eq[it.slot]; if (old) addItem(old, 1);
        S.eq[it.slot] = id; restat(); markDirty(true); if (net) net.retrack(); say(`${it.name} 착용!`, 1.4); return true;
      }
      // v60 강화: 골드를 내고 확률로 +1. 실패하면 장비가 부서짐 (입고 있던 것이면 벗겨지고 사라짐)
      function enhance(id) {
        const it = ITEMS[id]; if (!it || !it.uid || !S.gear[it.uid]) return;
        const en = it.en || 0; if (en >= ENH.max) return;
        const cost = ENH.cost(en); if (S.gold < cost) return;
        const worn = Object.keys(S.eq).find(sl => S.eq[sl] === id); if (!worn && !count(id)) return;
        S.gold -= cost;
        const ok = Math.random() * 100 < ENH.rate[en];
        if (ok) {
          const g = S.gear[it.uid]; g.en = en + 1; regGear(it.uid, g);
          tab.fgRes = { ok: true, en: g.en, name: ITEMS[id].name };
          float(G.px, G.py - 74, `강화 성공! +${g.en}`, '#FFE45C', true); Fx.levelUp(G.px, G.py); G.flash = 0.2;
          if (g.en >= 7) say(`+${g.en} 강화 성공! 대단해요!`, 3);
        } else if (en < ENH.safeTo) {   // v72 +7 까지는 실패해도 안 부서지고 한 단계 내려감 (+0 은 그대로)
          const g = S.gear[it.uid]; g.en = Math.max(0, en - 1); regGear(it.uid, g);
          tab.fgRes = { ok: false, down: true, en: g.en, name: ITEMS[id].name };
          float(G.px, G.py - 74, en > 0 ? `강화 실패… +${g.en} 로 내려감` : '강화 실패… (그대로)', '#FFB86B', true); G.shake = Math.max(G.shake, 4);
        } else {
          if (worn) delete S.eq[worn]; else takeItem(id, 1);
          delete S.gear[it.uid];
          tab.fgRes = { ok: false, en, name: it.name }; tab.fgSel = null;
          float(G.px, G.py - 74, '쨍그랑! 부서졌어요', '#FF8A8E', true); G.shake = Math.max(G.shake, 8);
          Fx.death(G.px, G.py - 40, { a: D.TIER[it.tier].color, b: D.TIER[it.tier].dark, c: D.TIER[it.tier].gem, d: '#FFFFFF' }, false);
        }
        restat(); if (worn && net) net.retrack(); save(true); markDirty(true);
      }
      let srvList = null, srvTimer = 0;
      async function loadServers() {
        if (!Hub.user) return;
        const L = await net.list(); srvList = L; if (pane === 'servers') renderPanel();
      }
      async function joinServer(v) {
        if (!Hub.user) return;
        if (!srvList || srvList.error) await loadServers();
        const rows = (srvList && srvList.rows) || [], cap = net.opt.cap;
        let n = +v;
        if (v === 'auto') { const ok = rows.filter(r => r.players == null || r.players < cap).sort((a, b) => (a.players || 0) - (b.players || 0)); if (!ok.length) { say('모든 서버가 가득 찼어요. 잠시 뒤 다시 해 주세요', 3); return; } n = ok[0].server; }
        if (net.joined && net.server === n) { closePanel(); return; }
        say(`${n}서버에 들어가는 중…`, 2); save(true);
        const r = await net.join(n, roomKey(), S.lv);
        if (r.ok) { say(`${n}서버에 들어왔어요!${r.players ? ` (지금 ${r.players}명)` : ''}`, 2.6); closePanel(); }
        else { say(r.reason === 'full' ? `${n}서버는 가득 찼어요 (${cap}명). 다른 서버를 골라 주세요` : r.reason === 'sql' ? '온라인 서버 준비가 아직 안 됐어요' : r.reason === 'banned' ? '이 계정은 지금 온라인에 들어갈 수 없어요' : '서버에 들어가지 못했어요. 잠시 뒤 다시 해 주세요', 3.5); loadServers(); }
      }
      panel.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-trgold]')) { const T = G.trade; if (!T) return; T.mine.gold = clamp(Math.floor(+t.value || 0), 0, S.gold); sendOffer(); renderPanel(); return; }
        if (t.matches('[data-hide]')) { S.hide = t.checked; markDirty(); if (net) net.retrack(); renderPanel(); }
        else if (t.matches('[data-fa]')) { tab.fa = t.value; if (tab.fb === t.value || (SKILLS[tab.fb] && SKILLS[tab.fb].el === SKILLS[t.value].el)) tab.fb = null; renderPanel(); }
        else if (t.matches('[data-fb]')) { tab.fb = t.value; renderPanel(); }
      });
      panel.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        const d = b.dataset;
        if ('x' in d) { closePanel(); return; }
        if (d.tab) { const [k, v] = d.tab.split(':'); tab[k] = v; renderPanel(); return; }
        if ('trash' in d) { tab.trash = !tab.trash; tab.trashAsk = null; renderPanel(); return; }
        if ('trashno' in d) { tab.trashAsk = null; tab.trash = false; renderPanel(); return; }
        if (d.trashdo) {   // v68 쓰레기통: 경고에서 '버리기'를 눌렀을 때만 지움
          const cut = d.trashdo.lastIndexOf(':'), id = d.trashdo.slice(0, cut), n = +d.trashdo.slice(cut + 1);
          if (G.trade) { say('거래 중에는 버릴 수 없어요', 2); }
          else if (takeItem(id, n)) { const nm = ITEMS[id].name; markDirty(true); say(`${nm}${n > 1 ? ' ' + n + '개' : ''}를 버렸어요`, 2); if (!count(id) && tab.invSel === id) tab.invSel = null; }
          tab.trashAsk = null; tab.trash = false; renderPanel(); return;
        }
        if (d.pick && tab.trash && pane === 'inv') {
          if (d.pick.startsWith('eq:')) say('입고 있는 장비는 벗은 뒤에 버릴 수 있어요', 2.2); else if (count(d.pick)) tab.trashAsk = d.pick;
          renderPanel(); return;
        }
        if (d.pick) { tab.invSel = tab.invSel === d.pick && !d.pick.startsWith('eq:') && !ITEMS[d.pick].stack && S.lv >= ITEMS[d.pick].req ? (equipNow(d.pick), 'eq:' + ITEMS[d.pick].slot) : d.pick; renderPanel(); return; }   // 같은 장비를 한 번 더 누르면 입기
        if (d.filt) { tab.invF = d.filt; renderPanel(); return; }
        if (d.equip) { if (equipNow(d.equip)) tab.invSel = 'eq:' + ITEMS[d.equip].slot; }
        else if (d.unequip) {
          const id = S.eq[d.unequip]; if (!id) return; if (!addItem(id, 1)) return; delete S.eq[d.unequip]; restat(); markDirty(true); if (net) net.retrack(); tab.invSel = id;
        } else if (d.use) { useItem(d.use); if (!count(d.use)) tab.invSel = null; }
        else if (d.slot) {
          // v53: 융합 마법 id 에 ':' 가 들어 있어(fu:a+b) 예전엔 칸에 안 들어갔음 → '|' 로 나눔
          const cut = d.slot.indexOf('|'), key = d.slot.slice(0, cut), id = d.slot.slice(cut + 1), fu = key[0] === 'f', n = +key.replace('f', '');
          const arr = fu ? 'fslots' : 'slots';
          if (fu !== String(id).startsWith('fu:')) return;
          if (S[arr][n] === id) S[arr][n] = null; else { S[arr] = S[arr].map(x => (x === id ? null : x)); S[arr][n] = id; }
          markDirty();
        } else if (d.buy) {
          const [id, n] = d.buy.split(':'), it = ITEMS[id], cost = it.price * +n; if (S.gold < cost) return;
          if (addItem(id, +n)) { S.gold -= cost; markDirty(true); }
        } else if ('bagup' in d) {   // v72 가방 늘리기
          const bu = S.bagUp || 0, bc = D.BAG.cost(bu); if (bu >= D.BAG.max || S.gold < bc) return;
          S.gold -= bc; S.bagUp = bu + 1; say(`가방이 ${bagMax()}칸이 됐어요!`, 2.4); markDirty(true);
        } else if (d.sellask) { tab.sellAsk = d.sellask; tab.sellAll = false; }
        else if ('sellno' in d) { tab.sellAsk = null; }
        else if ('sellallask' in d) { tab.sellAll = true; tab.sellAsk = null; }
        else if ('sellallno' in d) { tab.sellAll = false; }
        else if ('sellall' in d) {   // v68 강화 안 한 일반 장비 한꺼번에 팔기
          if (G.trade) { say('거래 중에는 팔 수 없어요', 2); return; }
          let got = 0, n = 0; S.inv.filter(x => ITEMS[x.id].slot && !ITEMS[x.id].en && (ITEMS[x.id].grade || 0) === 0).forEach(x => { const pr = sellPrice(x.id), k = x.n; if (takeItem(x.id, k)) { got += pr * k; n += k; } });
          tab.sellAll = false; if (n) { S.gold += got; markDirty(true); say(`장비 ${n}개를 팔아 ${fmtN(got)} G 받았어요`, 2.4); }
        } else if (d.sell) {
          if (G.trade) { say('거래 중에는 팔 수 없어요', 2); return; }
          const cut = d.sell.lastIndexOf(':'), id = d.sell.slice(0, cut), n = d.sell.slice(cut + 1), pr = sellPrice(id);   // 장비 id 'g:번호' 에도 ':' 가 있어 마지막 ':' 로 나눔
          if (pr > 0 && takeItem(id, +n)) { S.gold += pr * +n; markDirty(true); say(`${fmtN(pr * +n)} G 받았어요`, 1.6); } tab.sellAsk = null;
        } else if (d.learn) {
          const s = SKILLS[d.learn]; if (S.lv < s.lv || S.gold < s.price || S.skills.includes(s.id)) return;
          S.gold -= s.price; S.skills.push(s.id); const free = S.slots.indexOf(null); if (free >= 0) S.slots[free] = s.id;
          say(`'${s.name}' 배움!${free >= 0 ? ` ${free + 1}번 키로 써 보세요` : ' 마법 창(K)에서 칸에 넣어요'}`, 3); markDirty(true);
        } else if (d.fuse) {
          const [a, bb] = d.fuse.split('+'), id = fuseId(a, bb), price = fusePrice(a, bb);
          if (S.gold < price || S.skills.includes(id) || !skill(id)) return;
          S.gold -= price; S.skills.push(id); const free = S.fslots.indexOf(null); if (free >= 0) S.fslots[free] = id;
          say(`융합 성공! '${skill(id).name}'${free >= 0 ? ` ${FKEY[free]} 키로 써 보세요` : ' 마법 창(K)에서 Q W E R 칸에 넣어요'}`, 3); markDirty(true);
        } else if (d.hellgo) { const id = d.hellgo, M = MAPBY[id]; if (!M || S.lv < D.MAX_LV || (M.gate - 1) * 5 + M.stage > (S.hell || 0) + 1) return; pane = null; panel.hidden = true; G.paused = false; enter(id, 'L'); return; }   // v69 저승 단계 들어가기
        else if (d.go) { const id = d.go; pane = null; panel.hidden = true; G.paused = false; enter(id, MAPBY[id].kind === 'village' ? 'door' : 'L'); return; }
        else if (d.addst) { const [q, n0] = d.addst.split(':'), n = Math.min(+n0, S.sp, D.STAT.max - (S.stat[q] || 0)); if (n > 0 && S.stat[q] != null) { S.stat[q] += n; S.sp -= n; const hr = S.hp / ST.hp; restat(); if (q === 'vit') S.hp = Math.round(ST.hp * hr); markDirty(true); } }
        else if ('streset' in d) { D.STAT.keys.forEach(q => { S.sp += S.stat[q]; S.stat[q] = 0; }); restat(); markDirty(true); say('스탯 포인트를 모두 돌려받았어요. 다시 나눠 주세요', 2.4); }
        else if (d.trreq) { const pp = net.peers.get(d.trreq); if (!pp) { say('상대가 이 지도에 없어요', 2); closePanel(); return; } G.trade = { with: pp.cid, nick: pp.nick, state: 'wait' }; net.trade({ k: 'req', to: pp.cid }); pane = null; panel.hidden = true; G.paused = false; say(`${pp.nick}님에게 거래 신청을 보냈어요…`, 3); setTimeout(() => { if (G.trade && G.trade.state === 'wait' && G.trade.with === pp.cid) { G.trade = null; say('대답이 없어서 거래 신청을 취소했어요', 2.6); } }, 20000); return; }
        else if (d.tryes) { const pp = net.peers.get(d.tryes); if (!pp) { closePanel(); return; } net.trade({ k: 'yes', to: pp.cid }); startTrade(pp.cid, pp.nick); return; }
        else if (d.trno) { net.trade({ k: 'no', to: d.trno }); pane = null; panel.hidden = true; G.paused = false; return; }
        else if ('trcancel' in d) { endTrade(true); say('거래를 취소했어요', 2); return; }
        else if (d.tradd) { const T = G.trade; if (!T) return; const id = d.tradd; if (count(id) - (T.mine.items[id] || 0) > 0 && Object.keys(T.mine.items).filter(q => T.mine.items[q] > 0).length < 12) { T.mine.items[id] = (T.mine.items[id] || 0) + 1; sendOffer(); } }
        else if (d.trdel) { const T = G.trade; if (!T) return; T.mine.items[d.trdel] = Math.max(0, (T.mine.items[d.trdel] || 0) - 1); sendOffer(); }
        else if ('trok' in d) { const T = G.trade; if (!T) return; T.myOk = !T.myOk; if (T.myOk) { net.trade({ k: 'ok', to: T.with, key: tradeKey() }); if (T.theirOk && Hub.clientId < T.with) { net.trade({ k: 'commit', to: T.with, key: tradeKey() }); applyTrade(); return; } } else net.trade({ k: 'unok', to: T.with }); }
        else if (d.fgsel) { tab.fgSel = d.fgsel; tab.fgAsk = null; tab.fgRes = null; }
        else if (d.fgask) { tab.fgAsk = d.fgask; tab.fgRes = null; }
        else if ('fgno' in d) { tab.fgAsk = null; }
        else if ('fgok' in d) { tab.fgRes = null; }
        else if (d.fgdo) { tab.fgAsk = null; enhance(d.fgdo); }
        else if (d.srv) { joinServer(d.srv); return; }
        else if ('solo' in d) { if (net.joined) { net.leave(); say('혼자 하기로 바꿨어요', 2); } closePanel(); return; }
        else if ('savenow' in d) { save(true).then(ok => say(ok || !Store.online() ? '저장했어요' : '이 기기에 저장했어요 (서버 저장은 준비 중)')); return; }
        else if ('revive' in d) { G.dead = false; pane = null; panel.hidden = true; G.paused = false; restat(); S.hp = ST.hp; S.mp = ST.mp; enter(S.home, 'door'); return; }
        renderPanel();
      });
      syncBgm();
      el.querySelector('.rg-bar').addEventListener('click', e => {
        const b = e.target.closest('[data-rg]'); if (!b || !S) return; b.blur();
        const k = b.dataset.rg;
        if (k === 'save') { save(true).then(ok => say(ok || !Store.online() ? '저장했어요' : '이 기기에 저장했어요 (서버 저장은 준비 중)')); return; }
        if (k === 'full') { toggleFull(); return; }
        if (k === 'bgm') { BGM.toggleMute(); syncBgm(); return; }   // v73 학생 의견: BGM 끌 수 있게
        if (G.dead) return;
        if (pane === k) closePanel(); else openPanel(k);
      });

      /* ================= 입력 ================= */
      const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyJ', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyZ', 'KeyX', 'KeyI', 'KeyK', 'KeyC', 'KeyF', 'Enter', 'Escape']);
      function onKey(e) {
        if (!S || !G.map) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (document.querySelector('#authModal:not([hidden])')) return;
        const r = canvas.getBoundingClientRect(); if (r.bottom < 60 || r.top > innerHeight - 60) return;   // 게임판이 화면에 없으면 무시
        if (!GAME_KEYS.has(e.code)) return;
        const down = e.type === 'keydown';
        if (down && e.code === 'Escape') { if (pane) { e.preventDefault(); closePanel(); } return; }
        if (down && (e.code === 'KeyI' || e.code === 'KeyK' || e.code === 'KeyC')) { e.preventDefault(); const k = e.code === 'KeyI' ? 'inv' : e.code === 'KeyK' ? 'skill' : 'stat'; if (G.dead) return; if (pane === k) closePanel(); else if (!pane || pane === 'inv' || pane === 'skill' || pane === 'stat' || pane === 'help') openPanel(k); return; }
        if (pane) { if (tag !== 'button') e.preventDefault(); return; }
        if (tag === 'button' && (e.code === 'Space' || e.code === 'Enter')) return;
        e.preventDefault();
        G.keys[e.code] = down;
        if (!down || e.repeat) return;
        if (e.code.startsWith('Digit')) cast(+e.code.slice(5) - 1);
        else if (e.code === 'KeyQ' || e.code === 'KeyW' || e.code === 'KeyE' || e.code === 'KeyR') cast(4 + 'QWER'.indexOf(e.code[3]));
        else if (e.code === 'KeyZ') usePotion('hp');
        else if (e.code === 'KeyX') usePotion('mp');
        else if (e.code === 'KeyF' || e.code === 'Enter') {
          if (net && net.peers.size) { let pp = null, bd = 70; net.peers.forEach(q => { const dd = Math.hypot(G.px - q.x, G.py - q.y); if (dd < bd) { bd = dd; pp = q; } }); if (pp) { askTrade(pp); return; } }
          if (G.room) { const n = (G.npcs || []).find(q => Math.hypot(G.px - q.talk.x, G.py - q.talk.y) < q.talk.r * 1.4); if (n) talk(n); return; }
          const nv = (G.npcs || []).find(q => Math.hypot(G.px - q.x, G.py - q.y) < 70); if (nv) { nv.say = pick(nv.def.lines); nv.sayT = 3.2; return; }
          const tx = Math.floor(G.px / TS); const b = G.map.doors.find(x => Math.abs(x.door.x - tx) <= 1 && Math.abs((x.door.y + 1) * TS - G.py) < 48); if (b) { G.onDoor = b; enterRoom(b); }
        }
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
        { const q = toC(e); if (q.x < 92 && q.y < 96 && !G.dead) { e.preventDefault(); openPanel('stat'); return; }   // v43 왼쪽 위 얼굴 → 스탯 창
          if (!(G.touch && btnAt(q))) { const pp = peerAt(q); if (pp) { e.preventDefault(); askTrade(pp); return; } } }   // v44 다른 사람 누르기 → 거래
        if (!G.touch) { screenEl.focus({ preventScroll: true }); return; }
        e.preventDefault(); canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        const p = toC(e), b = btnAt(p);
        if (b) { pts[e.pointerId] = { btn: b }; G.btnDown[b] = true; if (b[0] === 's') cast(+b[1]); else if (b[0] === 'f') cast(4 + +b[1]); else if (b === 'hp' || b === 'mp') usePotion(b); return; }
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
      // v43 크게 보기: 게임판만 화면 가득 (가능하면 브라우저 전체 화면 + 가로 고정, 안 되면 페이지 위에 가득)
      const cabEl = () => el.querySelector('.cabinet');
      const fsNow = () => document.fullscreenElement || document.webkitFullscreenElement;
      function toggleFull() {
        const cab = cabEl(); if (!cab) return;
        if (fsNow() || cab.classList.contains('rg-max')) {
          if (fsNow()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* noop */ } }
          cab.classList.remove('rg-max'); setTimeout(onResize, 200); return;
        }
        const req = cab.requestFullscreen || cab.webkitRequestFullscreen;
        const fallback = () => { cab.classList.add('rg-max'); setTimeout(onResize, 100); };
        if (!req) { fallback(); return; }
        try {
          const pr = req.call(cab, { navigationUI: 'hide' });
          if (pr && pr.then) pr.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* noop */ } setTimeout(onResize, 200); }, fallback);
        } catch (e) { fallback(); }
        try { screenEl.focus({ preventScroll: true }); } catch (e) { /* noop */ }
      }
      const onFs = () => { setTimeout(onResize, 150); const b = el.querySelector('[data-rg="full"]'); if (b) b.textContent = fsNow() ? '작게 보기' : '크게 보기'; };
      document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
      $('#rgFull').addEventListener('click', e => { e.stopPropagation(); toggleFull(); });
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
        makeNet();
        fitScreen();
        if (S.statReset) { delete S.statReset; markDirty(true); setTimeout(() => say(`스탯이 힘·민첩·지혜·체력 4가지로 바뀌었어요! 포인트 ${S.sp}개를 다시 나눠 주세요 (왼쪽 위 얼굴)`, 5), 900); }
        else if (G.touch && innerHeight < 520 && !fsNow()) setTimeout(() => say('오른쪽 위 [ ] 버튼을 누르면 화면이 크게 보여요', 3.5), 1200);
        if (!S.help) openPanel('help');
        else if (Hub.user) { G.srvAsked = true; openPanel('servers'); }
        loadRank();
        if (Hub.user) Hub.myBest(GAME).then(b => { if ((b || 0) < rankScore()) submitRank(); }).catch(() => {});
        window.__rpg = { net: () => net, S: () => S, G: () => G, ST: () => ST, enter, enterRoom, leaveRoom, cast, gainExp, save, openPanel, closePanel, skill, addItem, renderPanel: () => renderPanel(), killMon, hitPlayer, enhance, cleanOffer, restat, pane: () => pane, sellPrice, mkGear: (b, en, op) => { const u = newUid(); S.gear[u] = { b, en: en || 0, op: op || [] }; const id = regGear(u, S.gear[u]); addItem(id, 1); return id; } };   // 점검(테스트)용
      })();
      raf = requestAnimationFrame(loop);
      BGM.play();

      /* ---------- v53 댓글·피드백 + 서버 채팅 (같은 서버 사람끼리만) ---------- */
      const SOC = window.GoSocial, sui = { toast: A.toast, esc: A.esc, openAuth: A.openAuth, ago: A.ago || (x => x), avCanvas: A.avCanvas || (() => '') };
      const offComments = SOC ? SOC.mountComments(GAME, sui) : () => {};
      let chatSrv = -1, offChat = () => {};
      function chatSync() {
        const box = $('#rgChatBox'); if (!box || !SOC) return;
        const srv = net && net.joined ? net.server : 0; if (srv === chatSrv) return;
        chatSrv = srv; offChat(); offChat = () => {};
        if (!srv) {
          box.innerHTML = `<div class="panel chat-panel"><h3>서버 채팅</h3><p class="chat-note" style="margin:6px 0 10px">서버에 들어가면 <b>같은 서버</b>에 있는 사람끼리 채팅할 수 있어요.</p>${Hub.user ? '<button type="button" class="btn btn-sm btn-block" data-rg="servers">서버 고르기</button>' : '<button type="button" class="btn btn-sm btn-block" data-auth="login">로그인하고 서버 들어가기</button>'}</div>`;
          return;
        }
        box.innerHTML = SOC.chatHTML();
        const h3 = box.querySelector('h3'); if (h3 && h3.firstChild) h3.firstChild.textContent = srv + '서버 채팅 ';
        offChat = SOC.mountChat('rpg-s' + srv, sui);
      }
      chatSync(); const chatT = setInterval(chatSync, 1200);
      $('#rgChatBox').addEventListener('click', e => { if (e.target.closest('[data-rg="servers"]') && S) openPanel('servers'); });

      return () => {
        alive = false; cancelAnimationFrame(raf); clearInterval(srvTimer); clearInterval(chatT); offChat(); offComments();
        if (S) save(true);
        if (net) net.leave();
        document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey);
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onOrient);
        document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs); if (fsNow()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* noop */ } } window.removeEventListener('blur', blurKeys); window.removeEventListener('pagehide', onUnload);
        BGM.stop();
      };
    }
  };
})();

/* ---------- 게임 카드 · 첫 화면 소개 그림 (v48) — 예전에는 없어서 검은 칸으로 보였음 ----------
 *  해 질 녘 조선 마을: 노을 하늘 · 먼 산 · 이장 댁(기와) · 약방(초가) · 흙길 · 왜군 몬스터 · 글자
 *  건물 그림(img/bld_*.png)은 처음엔 없을 수 있어 도형으로 그리고, 그림이 오면 'gogo:img' 로 다시 그림 */
(function () {
  'use strict';
  const IM = {};
  function im(n) {
    let i = IM[n]; if (!i) { i = IM[n] = new Image(); i.decoding = 'async'; i.src = 'games/action/rpg/img/' + n + '.png?v=48'; i.onload = () => { try { window.dispatchEvent(new Event('gogo:img')); } catch (e) { /* noop */ } }; }
    return i.complete && i.naturalWidth ? i : null;
  }
  window.GoGames = window.GoGames || {};
  window.GoGames.rpg = {
    id: 'rpg',
    thumb(ctx, w, h) {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62); sky.addColorStop(0, '#2E2850'); sky.addColorStop(0.55, '#B8583E'); sky.addColorStop(1, '#F2A65A'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FFE0A0'; ctx.beginPath(); ctx.arc(w * 0.78, h * 0.42, 13, 0, Math.PI * 2); ctx.fill();   // 해
      ctx.fillStyle = '#4A3550'; ctx.beginPath(); ctx.moveTo(0, h * 0.58); [[0.12, 0.38], [0.26, 0.5], [0.42, 0.34], [0.58, 0.5], [0.72, 0.4], [0.88, 0.52], [1, 0.44]].forEach(([x, y]) => ctx.lineTo(w * x, h * y)); ctx.lineTo(w, h * 0.62); ctx.lineTo(0, h * 0.62); ctx.fill();   // 먼 산
      ctx.fillStyle = '#5E9A4E'; ctx.fillRect(0, h * 0.6, w, h * 0.4); ctx.fillStyle = '#6DB85C'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % w, h * 0.62 + ((i * 53) % Math.round(h * 0.36)), 3, 2);   // 풀밭
      ctx.fillStyle = '#C9A46A'; ctx.beginPath(); ctx.moveTo(w * 0.42, h); ctx.lineTo(w * 0.52, h * 0.62); ctx.lineTo(w * 0.6, h * 0.62); ctx.lineTo(w * 0.7, h); ctx.fill();   // 흙길
      const hall = im('bld_chief'), hut = im('bld_potion');
      if (hut) ctx.drawImage(hut, w * 0.6, h * 0.36, 82, 82 * hut.naturalHeight / hut.naturalWidth);
      else { ctx.fillStyle = '#D9B25A'; ctx.beginPath(); ctx.ellipse(w * 0.77, h * 0.55, 34, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#C8B89A'; ctx.fillRect(w * 0.66, h * 0.55, 52, 20); }
      if (hall) ctx.drawImage(hall, w * 0.02, h * 0.3, 104, 104 * hall.naturalHeight / hall.naturalWidth);
      else { ctx.fillStyle = '#3A3E48'; ctx.beginPath(); ctx.moveTo(w * 0.02, h * 0.5); ctx.lineTo(w * 0.1, h * 0.36); ctx.lineTo(w * 0.36, h * 0.36); ctx.lineTo(w * 0.44, h * 0.5); ctx.fill(); ctx.fillStyle = '#E8DCC0'; ctx.fillRect(w * 0.06, h * 0.5, w * 0.34, 24); }
      // 왜군 졸병 (도트, 삿갓 + 창) 둘
      const px = (x, y, c, ww, hh) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), ww || 3, hh || 3); };
      [[w * 0.5, h * 0.72], [w * 0.62, h * 0.8]].forEach(([x, y]) => { px(x - 6, y, '#5A5A62', 15, 3); px(x - 3, y - 3, '#5A5A62', 9, 3); px(x - 2, y + 3, '#F0C8A0', 7, 5); px(x - 3, y + 8, '#8A3A2A', 9, 9); px(x - 2, y + 17, '#4A2A20', 3, 5); px(x + 2, y + 17, '#4A2A20', 3, 5); px(x + 8, y - 8, '#7A5A3A', 2, 26); px(x + 7, y - 11, '#E8E8F0', 4, 4); });
      // 내 마법 (빛 구슬)
      const g = ctx.createRadialGradient(w * 0.36, h * 0.8, 1, w * 0.36, h * 0.8, 16); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.4, '#FFE45C'); g.addColorStop(1, 'rgba(255,228,92,0)'); ctx.fillStyle = g; ctx.fillRect(w * 0.36 - 16, h * 0.8 - 16, 32, 32);
      ctx.font = '19px "Jua", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#1D2340'; ctx.strokeText('임진왜란 마법 모험', w / 2, h * 0.2); ctx.fillStyle = '#FFE45C'; ctx.fillText('임진왜란 마법 모험', w / 2, h * 0.2);
    }
  };
})();
