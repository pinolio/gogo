/*
 * gogo?gogo! — skillcom RPG (도트 RPG · 혼자 플레이 첫 버전 v40 · v41 건물 안·사람·가방 창)
 *
 *  파일 3개: data.js (숫자·목록) · world.js (지도 만들기·그림) · game.js (이 파일: 움직임·전투·창·저장)
 *  캐릭터: 사이트 아바타 그대로 + 장비를 위에 겹쳐 그림. 가방 창 '장비 안보이기' = 그림만 숨김 (능력치 그대로)
 *  저장: 이 기기(localStorage) + 로그인하면 서버 game_saves 표 (supabase/rpg_v40.sql). 더 최근 것을 불러옴
 *  조작: 방향키 이동 · Space/J 공격 · 1~4 기본 마법 · Q W E R 융합 마법 · Z/X 포션 · V 귀환(가까운 마을, 2분) · I 가방 · K 마법 · F/Enter 들어가기 · Esc 닫기 (v53)
 *        휴대폰: 왼쪽 조이스틱 + 오른쪽 버튼 (캔버스 위)
 */
(function () {
  'use strict';
  const D = window.GoRPGData, AV = window.GoAvatar, Hub = window.GameHub, BGM = window.GoBGM;
  const P = window.__GoRPGParts, CFG = window.GoSettings.get('rpg');
  const { registerCustom, arrivePos, gateAt, dungeonAt, loadImages, imgOk, img79, getMap, solidAt, monSprite, avatarSprite, itemIcon, clamp, rand, pick, dist, fmtN, W, H, TS, SAVE_V, GAME, MAPBY, getRoom, npcSprite, npcPortrait, villagers } = P;
  const ITEMS = D.ITEMS, SKILLS = D.SKILLS, ELEM = D.ELEM, Fx = window.GoRPGFx;
  const EL_IC = { fire: '🔥', water: '💧', wind: '🌪', earth: '🪨', thunder: '⚡', light: '☀', dark: '🌙' };   // v130 스탯 창 속성 방어 그림
  const POT_T = D.POTIONS.filter(p => p.kind === 'hp').map(p => p.tier + 1).reverse();   // 포션 단계 (큰 것부터) 9 … 1
  const ROMAN = ['', ' Ⅱ', ' Ⅲ', ' Ⅳ', ' Ⅴ'];
  const KIND_TXT = { bolt: '탄', nova: '주변 폭발', beam: '일직선', rain: '여러 곳에 떨어짐', pool: '바닥 장판', dash: '돌진', heal: '회복', shield: '보호막' };
  const FX_TXT = { burn: '화상', slow: '느려짐', stun: '기절', push: '밀어내기', heavy: '큰 피해', holy: '흡수 회복', curse: '저주' };

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
      .map(o => { const fx = B.fixOpt && B.fixOpt[o[0]]; return [o[0], fx != null ? fx : clamp(r1(+o[1]), -OPTS[o[0]].max, OPTS[o[0]].max)]; }).filter(o => o[1] !== 0);   // v187 고침: 광개토대왕의 반지(모든 속성 방어 15)·이순신 장군의 신발(이동 속도 10) 고정 옵션이 다시 불러올 때 최대치(8)로 깎이던 것 → 고정값으로 되돌림
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
      const neg = out.length > 0 && Math.random() < 0.35, v = Math.max(0.1, r1(OPTS[q].max * (0.25 + 0.75 * t / 9) * rand(0.2, 1) * (neg ? rand(0.5, 1) : 1)));   // v84 폭 키움
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
      stat: { str: 0, dex: 0, int: 0, vit: 0, res: 0 }, statV: 2, sp: 0, skills: ['magicarrow'], slots: ['magicarrow', null, null, null], fslots: [null, null, null, null], visited: ['v1'], play: 0, kills: 0, bosses: {}, help: false, savedAt: 0, reb: 0, rebReady: false, toonSeen: [], dpsBest: 0 };
    s.pets = []; s.petOn = ''; s.petOpen = { hero: 0, legend: 0 };
    s.sasin = { cr: 0, jj: 0, bh: 0, hm: 0 }; s.sasinAll = 0; s.ysp = [0, 0, 0, 0, 0, 0, 0, 0, 0]; s.ysMural = 0; s.ysAll = 0;   // v172 이순신 장군님 던전: 벽화 조각 9 · 벽화 완성 · 왜장 회합을 깸
      // v150 사신의 땅: 이긴 사방신(불) · 사방신 모두 방을 깸   // v149 펫: [{u, id, en}] · 데리고 다니는 펫 u · 열린 등급
    return s;
  }
  const statMax = () => D.STAT.max;   // v149 스탯 최대치 없앰 (Infinity) — 예전: 50 + 환생마다 +10
  const PETBY = {}; D.PETS.forEach(p => { PETBY[p.id] = p; });
  const petVal = p => { const P = PETBY[p.id]; return P ? D.PET_GRADE[P.g].stat * (1 + D.PET.per * (p.en || 0)) : 0; };   // v149 펫 한 마리 올스탯
  const petBonus = s => {   // 가진 펫 모두 더함 — 같은 펫이 여러 마리면 가장 강화된 한 마리만 (나머지는 강화 재료. 모두 더하면 강화할수록 손해라서)
    const best = {}; ((s && s.pets) || []).forEach(p => { const v = petVal(p); if (!(best[p.id] >= v)) best[p.id] = v; });
    return Math.round(Object.values(best).reduce((a, v) => a + v, 0) * 10) / 10;
  };
  function fixSave(s) {
    const n = newSave(); if (!s || typeof s !== 'object' || s.v !== SAVE_V) return n;
    const oldStatV = s.statV;   // 기본값을 채우기 전에 기억 (v44 스탯 바뀜 확인용)
    Object.keys(n).forEach(k => { if (s[k] === undefined) s[k] = n[k]; });
    s.lv = clamp(Math.floor(+s.lv || 1), 1, D.MAX_LV); s.exp = Math.max(0, +s.exp || 0); s.gold = Math.max(0, Math.floor(+s.gold || 0));
    if (!MAPBY[s.home] || MAPBY[s.home].kind !== 'village') s.home = 'v1'; if (!MAPBY[s.map]) { s.map = s.home; s.x = 0; }   // v134 특별 지역이 없어지면(비공개·삭제) 마지막 마을로
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
    s.reb = clamp(Math.floor(+s.reb || 0), 0, D.REBIRTH.max);
    s.stat = {}; D.STAT.keys.forEach(k => { s.stat[k] = clamp(Math.floor(+st[k] || 0), 0, statMax(s)); });
    s.dpsBest = clamp(Math.round(+s.dpsBest || 0), 0, 1e13);   // v144 훈련장 10초 평균 딜량 최고값 (최대 10조)
    s.reb = clamp(Math.floor(+s.reb || 0), 0, D.REBIRTH.max); s.rebReady = !!s.rebReady;   // v131 환생 횟수 · 이번에 환생할 수 있는지(10-5를 깸)
    // v149 펫 확인 (없는 펫·이상한 값 지움)
    s.pets = (Array.isArray(s.pets) ? s.pets : []).filter(p => p && PETBY[p.id] && /^[a-z0-9]{4,16}$/.test(String(p.u || ''))).slice(0, D.PET.maxOwn).map(p => ({ u: String(p.u), id: p.id, en: clamp(Math.floor(+p.en || 0), 0, D.PET.max) }));
    if (!s.pets.some(p => p.u === s.petOn)) s.petOn = '';
    s.petOpen = { hero: s.petOpen && s.petOpen.hero ? 1 : 0, legend: s.petOpen && s.petOpen.legend ? 1 : 0, ysT: s.petOpen && s.petOpen.ysT ? 1 : 0, ysY: s.petOpen && s.petOpen.ysY ? 1 : 0 };   // v182 거북선·이순신 펫
    s.ysAt = +s.ysAt || 0;   // v182 이순신 던전을 처음 깬 때(ms) — 메인 카드 '이순신 던전 첫 공략자' · 10명 순위
    s.kingAt = +s.kingAt || (s.petOpen.legend ? Date.now() : 0);   // v158 광개토대왕을 처음 이긴 때(ms) — 예전에 이긴 사람(전설 펫 열림)은 지금 시각으로 · 메인 카드 '광개토대왕 최초 토벌자'
    const sa = s.sasin && typeof s.sasin === 'object' ? s.sasin : {}; s.sasin = {}; D.SASIN.gods.forEach(k => { s.sasin[k] = sa[k] ? 1 : 0; }); s.sasinAll = s.sasinAll ? 1 : 0;
    const yp = Array.isArray(s.ysp) ? s.ysp : []; s.ysp = [0, 0, 0, 0, 0, 0, 0, 0, 0].map((_, i) => yp[i] ? 1 : 0); s.ysMural = s.ysMural ? 1 : 0; s.ysAll = s.ysAll ? 1 : 0;   // v172
    s.title = (D.TITLES || []).some(t => t.id === s.title) ? s.title : '';   // v176 고른 타이틀
    const bw = s.bossWon && typeof s.bossWon === 'object' ? s.bossWon : {}; s.bossWon = {}; Object.keys(bw).slice(0, 400).forEach(k => { if (k.length <= 40) s.bossWon[k] = clamp(Math.floor(+bw[k] || 1), 1, 600); });   // v174 이긴 보스 (Skillcom Fight 보스 도전)
    const total = (s.lv - 1) * (CFG.statPerLevel || 2) + s.reb * D.REBIRTH.bonus, used = D.STAT.keys.reduce((a, k) => a + s.stat[k], 0);
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
      for (let t = 0; t < 3; t++) {   // v168 서버를 못 읽으면 두 번 더 해 봄 (못 읽은 채 새 캐릭터로 시작하지 않게)
        try {
          const { data, error } = await Hub._sb.from('game_saves').select('data').eq('user_id', Hub.user.id).eq('game_id', GAME).maybeSingle();
          if (!error) return data ? data.data : null;
          if (/relation|does not exist|schema cache/i.test(error.message)) { this.noServer = true; console.warn('[rpg] 서버 저장 표 없음 → 이 기기에만 저장', error.message); return null; }
        } catch (e) { /* 다시 */ }
        await new Promise(r => setTimeout(r, 800 * (t + 1)));
      }
      return null;
    },
    async push(s) {
      if (!this.online() || this.noServer) return false;
      try {
        // v168 지킴이: 처치 수(kills)는 절대 줄지 않음 → 서버에 더 많은 처치 수가 있으면 '덮어쓰기' 대신 멈춤
        //   (11/18 한 학생 캐릭터가 Lv.1 새 캐릭터로 덮어써짐 — 서버를 못 읽은 채 새로 시작한 저장이 올라간 것으로 보임)
        const { data: cur, error: e1 } = await Hub._sb.from('game_saves').select('kills:data->kills').eq('user_id', Hub.user.id).eq('game_id', GAME).maybeSingle();
        if (e1) { console.warn('[rpg] 서버 확인 실패 → 이번 저장은 건너뜀', e1.message); return false; }
        if (cur && (+cur.kills || 0) > (+s.kills || 0)) { this.guard = true; console.warn('[rpg] 서버에 더 진행된 캐릭터가 있어 덮어쓰지 않음', cur.kills, s.kills); if (window.GoRPGGuard) window.GoRPGGuard(); return false; }
        const { error } = await Hub._sb.from('game_saves').upsert({ user_id: Hub.user.id, game_id: GAME, data: s, updated_at: new Date().toISOString() });
        if (error) { if (/relation|does not exist|schema cache|permission/i.test(error.message)) this.noServer = true; console.warn('[rpg] 서버 저장 실패', error.message); return false; }
        return true;
      } catch (e) { return false; }
    },
    async load() {
      const uid = Hub.user && Hub.user.id;
      let s = this.local(uid);
      const srv = await this.server();
      // v203 고침(선생님 11/24 '파워복복 Lv.1'): 이 기기 저장이 더 '나중'이어도 서버 캐릭터가 더 많이 진행했으면(처치 수 — 절대 줄지 않음) 서버 것을 씀
      //   (로그인이 늦게 붙어 손님 Lv.1 로 시작한 판이 계정 칸에 저장되면, 다음에 그 Lv.1 이 '더 최근'이라 불려 나오던 것)
      const kk = o => +(o && o.kills) || 0;
      if (srv && (!s || kk(srv) > kk(s) || (kk(srv) === kk(s) && (srv.savedAt || 0) > (s.savedAt || 0)))) s = srv;
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
  /* v164 아래 메뉴 = 게임 창과 같은 남색·금테 단추 + Gemini 아이콘 (선생님 11/17: 딱딱한 흰 단추 다듬기) */
  .rg-bar { gap: 4px; padding: 7px 6px; width: min(100%, 1000px); box-sizing: border-box; border-radius: 12px; background: linear-gradient(180deg, #1E2A55, #0E1532); border: 3px solid #C9A24A; box-shadow: 0 0 0 3px #0A0E24, inset 0 0 0 2px rgba(243,210,122,.18), 0 6px 0 rgba(0,0,0,.25); }
  .rg-bar .rg-mb { display: inline-flex; align-items: center; gap: 6px; padding: 4px 7px 4px 4px; font-size: 13px; gap: 4px; font-weight: 700; color: #FFF4D0; background: linear-gradient(180deg, #2C3A66, #1A2446); border: 2px solid #8FA6C8; border-radius: 8px; box-shadow: 0 0 0 1px #0A0E24, inset 0 1px 0 rgba(255,255,255,.18), 0 3px 0 #0A0E24; text-decoration: none; transition: transform .08s, border-color .12s, box-shadow .12s; }
  .rg-bar .rg-mb:hover { transform: translateY(-2px); border-color: #F3D27A; box-shadow: 0 0 0 1px #0A0E24, inset 0 1px 0 rgba(255,255,255,.25), 0 5px 0 #0A0E24, 0 0 10px rgba(243,210,122,.45); }
  .rg-bar .rg-mb:active { transform: translateY(1px); box-shadow: 0 0 0 1px #0A0E24, 0 1px 0 #0A0E24; }
  .rg-bar .rg-mb i { width: 24px; height: 24px; flex: none; background: var(--ic) center / contain no-repeat; image-rendering: pixelated; filter: drop-shadow(0 1px 0 #0A0E24); }
  .rg-bar .rg-mb kbd { font: 700 11px/1 var(--f-display, inherit); color: #1D2340; background: linear-gradient(180deg, #F3D27A, #C8922E); border: 1px solid #6B4A12; border-radius: 4px; padding: 2px 4px; }
  .rg-bar .rg-mb-fight { background: linear-gradient(180deg, #8A5AE8, #5A2FB0); border-color: #C9A8FF; color: #FFFFFF; }
  .rg-bar .rg-mb-save { background: linear-gradient(180deg, #F3D27A, #C8922E); border-color: #6B4A12; color: #1D2340; }
  .rg-panel { position: absolute; inset: 4% 6%; background: linear-gradient(180deg, rgba(34, 42, 92, .97), rgba(12, 16, 40, .97)); color: #EEF1FF; border: 3px solid #0A0E24; border-radius: 10px; padding: 12px 14px; overflow-y: auto; overscroll-behavior: contain; font-size: 14px; z-index: 3; box-shadow: 0 6px 0 rgba(0,0,0,.35); }
  .rg-panel[hidden] { display: none; }
  .rg-panel.rg-fit { bottom: auto; max-height: 92%; }   /* v169 마법 창 아래 빈 공간 없앰 (많으면 92% 까지 커지고 스크롤) */
  .rg-panel h3 { font-family: var(--f-display); font-size: 22px; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
  .rg-panel h3 .x { margin-left: auto; background: #2A325E; color: #fff; border: 2px solid #0A0E24; border-radius: 6px; font-size: 14px; padding: 2px 10px; cursor: pointer; }
  .rg-panel .sub { color: #AEB7E0; font-size: 13px; margin: 0 0 8px; }
  .rg-tabs { display: flex; gap: 6px; margin: 4px 0 10px; flex-wrap: wrap; }
  .rg-tabs button { background: #222A52; color: #C9D0F0; border: 2px solid #0A0E24; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 13px; }
  .rg-tabs button[aria-pressed="true"] { background: #FFD23F; color: #1D2340; }
  .rg-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
  /* v172 이순신 장군님 벽화 퍼즐 */
  .rg-ys-pz, .rg-ys-have { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; width: min(420px, 100%); margin: 8px auto; aspect-ratio: 755 / 584; background: #0A0E24; border: 3px solid #FFD23F; border-radius: 8px; padding: 3px; }
  .rg-ys-have { width: min(300px, 100%); border-color: #3C5AA8; }
  .rg-ys-t, .rg-ys-have > div { border: 0; border-radius: 4px; background-size: 300% 300%; background-color: #1D2340; cursor: pointer; padding: 0; min-height: 0; }
  .rg-ys-have > div { display: flex; align-items: center; justify-content: center; color: #9AE6FF; font-weight: bold; font-size: 20px; cursor: default; }
  .rg-ys-have > div.on { color: transparent; }
  .rg-ys-t:hover { outline: 2px solid #FFD23F; }
  .rg-ys-t.blank { background: #0A0E24; cursor: default; outline: none; }
  .rg-ys-pz.done { gap: 0; } .rg-ys-pz.done .rg-ys-t { border-radius: 0; cursor: default; outline: none; }
  /* v172 큰 지도 */
  .rg-wm-list { display: grid; gap: 5px; }
  .rg-wm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; }
  .rg-wm-v, .rg-wm-f, .rg-wm-c, .rg-wm-key { background: #1D2340; color: #9AE6FF; border: 1px solid #3C5AA8; border-radius: 5px; font-size: 12px; text-align: center; }
  .rg-wm-v { min-width: 92px; padding: 3px 6px; font-weight: bold; margin-right: 4px; }
  .rg-wm-f { min-width: 26px; padding: 3px 2px; }
  .rg-wm-f + .rg-wm-f::before { content: ''; }
  .rg-wm-grid { display: grid; gap: 4px; grid-auto-rows: minmax(44px, auto); }
  .rg-wm-c { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3px; font-size: 11px; line-height: 1.25; }
  .rg-wm-grid.tall { grid-auto-rows: minmax(30px, auto); gap: 3px; } .rg-wm-grid.tall .rg-wm-c { font-size: 10px; padding: 2px; }
  .rg-wm-c.kill, .rg-wm-key.kill { position: relative; background: #4A1630; color: #FFE0E0; border-color: #FF6A6A; } .rg-wm-c.kill::after, .rg-wm-key.kill::before { content: '✖'; color: #FF5A5A; font-weight: 900; text-shadow: 0 0 3px #0A0E24; } .rg-wm-c.kill::after { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 30px; opacity: .85; pointer-events: none; } .rg-wm-grid.tall .rg-wm-c.kill::after { font-size: 22px; } .rg-wm-key.kill::before { margin-right: 4px; }   /* v190 이긴 방 ✖ */
  .rg-wm-v.vis, .rg-wm-f.vis, .rg-wm-c.vis, .rg-wm-key.vis { background: #2F6BFF; color: #FFFFFF; border-color: #9AE6FF; }
  .rg-wm-v.cur, .rg-wm-f.cur, .rg-wm-c.cur, .rg-wm-key.cur { background: #FFD23F; color: #1D2340; border-color: #FFFFFF; font-weight: bold; }
  .rg-wm-key { display: inline-block; padding: 2px 8px; margin-right: 4px; }
  .rg-row { display: flex; align-items: center; gap: 10px; background: linear-gradient(180deg, #232B5C, #1A2148); border: 2px solid #0A0E24; border-radius: 10px; padding: 6px 8px; box-shadow: 0 2px 0 rgba(0,0,0,.25); transition: transform .1s; }
  .rg-row:hover { transform: translateY(-1px); border-color: #3A4690; }
  .rg-row.off { opacity: .55; }
  .rg-row .nm { font-weight: 700; }
  .rg-row .ds { color: #AEB7E0; font-size: 12px; display: block; font-weight: 400; }
  .rg-row .grow { flex: 1; min-width: 0; }
  .rg-row .btn, .rg-mini { padding: 4px 10px; font-size: 13px; min-width: 0; border-radius: 6px; cursor: pointer; background: #FFD23F; color: #1D2340; border: 2px solid #0A0E24; white-space: nowrap; }
  .rg-mini.ghost { background: #2A325E; color: #EEF1FF; }
  /* v143 결투 신청 */
  .rg-mini.duel { background: #FF5A5F; color: #FFFFFF; }
  .rg-duelask { margin-top: 12px; padding: 10px 12px; border: 2px solid #FF5A5F; border-radius: 10px; background: rgba(255,90,95,.12); display: grid; gap: 6px; }
  .rg-duelask b { color: #FF8A8E; font-size: 16px; } .rg-duelask p { margin: 0; font-size: 13px; color: #EEF1FF; }
  .rg-duelask label { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #EEF1FF; } .rg-duelask input { width: 120px; padding: 3px 6px; border-radius: 6px; border: 2px solid #0A0E24; font: inherit; background: #FFFFFF; color: #1D2340; }
  .rg-duelask .rg-mini { justify-self: start; }
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
  /* v104 채널 이동 버튼 (게임 화면 왼쪽) · 창 */
  .rg-chbtn { position: absolute; left: 1.2%; top: 18.5%; z-index: 2; display: grid; gap: 2px; justify-items: center; min-width: 58px; padding: 7px 10px; border-radius: 10px; background: linear-gradient(180deg, rgba(36,44,88,.95), rgba(12,16,40,.95)); border: 2px solid #D8B25A; outline: 2px solid #0A0E24; color: #FFF3D6; font-family: var(--f-display); font-size: 15px; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(255,226,150,.35), 0 3px 0 rgba(0,0,0,.35); }   /* v127 금테 */
  .rg-chbtn small { font-family: inherit; font-size: 11px; color: #F2D58A; }
  .rg-chbtn:hover { filter: brightness(1.15); }
  .rg-chs { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .rg-chs .rg-srv.cur[disabled] { opacity: 1; border-color: #9AE6FF; box-shadow: 0 0 0 2px rgba(154,230,255,.35), 0 3px 0 rgba(0,0,0,.3); }
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
  .rg-st small { grid-area: ds; color: #AEB7E0; font-size: 12px; } .rg-st .lab .rg-stmax { font-style: normal; font-size: 12px; font-weight: 700; color: #14193A; background: #FFD23F; border-radius: 999px; padding: 1px 8px; align-self: center; }   /* v187 최대 도달 */ .rg-st .lab small.mx { font-size: 12px; color: #8A93C0; }
  .rg-st .btns { grid-area: btns; display: flex; gap: 6px; } .rg-st .btns .rg-mini { font-size: 15px; padding: 6px 12px; }
  .rg-detailgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
  .rg-detailgrid div { background: #141A3C; border: 2px solid #0A0E24; border-radius: 10px; padding: 7px 9px; display: grid; gap: 1px; }
  .rg-detailgrid span { font-size: 12px; } .rg-detailgrid b { font-family: var(--f-display); font-size: 19px; color: #FFFFFF; }
  .rg-detailgrid small { font-size: 11px; color: #AEB7E0; line-height: 1.35; } .rg-detailgrid small.pt { color: #8A93C0; }
  .rg-detailgrid em { font-style: normal; } .rg-detailgrid em.s { color: #FFD23F; } .rg-detailgrid em.g { color: #9AE6FF; }
  /* v130 스탯 창 새 꾸미기 (선생님 시안): 금테 칸 · 색 띠 스탯 줄 · 금색 +1 · 테두리 색 능력치 카드 */
  .rg-statui { --gold: #C9A24A; --gold2: #F3D27A; --steel: #8FA6C8; }
  .rg-statui .rg-statwin { grid-template-columns: 230px 1fr; gap: 14px; }
  .rg-statui .rg-doll, .rg-statui .rg-bag { position: relative; border: 2px solid var(--gold); border-radius: 6px; padding: 14px;
    background: radial-gradient(circle at 7px 7px, var(--gold2) 2px, transparent 3px), radial-gradient(circle at calc(100% - 7px) 7px, var(--gold2) 2px, transparent 3px), radial-gradient(circle at 7px calc(100% - 7px), var(--gold2) 2px, transparent 3px), radial-gradient(circle at calc(100% - 7px) calc(100% - 7px), var(--gold2) 2px, transparent 3px), linear-gradient(180deg, #172A47, #0E1A30);
    box-shadow: 0 0 0 2px #0A0E24, inset 0 0 0 2px #0A0E24; }
  .rg-statui .rg-statfig .rg-fig { height: 190px; border: 2px solid #0A0E24; border-radius: 8px; background: radial-gradient(circle at 50% 56%, transparent 30%, rgba(120,210,230,.28) 31%, transparent 33%, transparent 43%, rgba(120,210,230,.2) 44%, transparent 46%), radial-gradient(circle at 50% 50%, #24566A, #0E2434 78%); }
  .rg-statui .rg-statfig .rg-fig img { height: 168px; }
  .rg-statui .rg-fig .lv { left: 8px; top: 0; padding: 6px 7px 12px; border-radius: 0; border: 2px solid #6B4A12; border-top: 0; background: linear-gradient(180deg, var(--gold2), #B8862E); color: #1D2340; font-size: 13px; clip-path: polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%); }
  .rg-statui .rg-statfig .nm { color: var(--gold2); font-size: 21px; margin-top: 6px; text-shadow: 0 2px 0 #0A0E24; }
  .rg-statui .rg-xp { height: 14px; border: 2px solid var(--gold); border-radius: 8px; box-shadow: 0 0 0 1px #0A0E24; } .rg-statui .rg-xp i { background: linear-gradient(180deg, #FFE79A, #E8A92A); }
  .rg-statui .rg-statfig small { color: #C9D0F0; }
  .rg-statui .rg-alloc { gap: 9px; }
  .rg-statui .rg-sp { font-size: 16px; font-weight: 700; color: #FFFFFF; display: flex; align-items: center; gap: 4px; } .rg-statui .rg-sp b { font-size: 28px; color: var(--gold2); text-shadow: 0 2px 0 #0A0E24, 0 0 6px rgba(243,210,122,.5); }
  .rg-statui .rg-st { border: 2px solid var(--c); border-left-width: 2px; border-radius: 6px; padding: 9px 12px; box-shadow: 0 0 0 2px #0A0E24, inset 0 0 0 1px rgba(0,0,0,.4);
    background: linear-gradient(90deg, color-mix(in srgb, var(--c) 32%, #121C33) 0%, #121C33 38%, #121C33 100%); position: relative; }
  .rg-statui .rg-st::before { content: ''; position: absolute; left: -2px; top: 6px; bottom: 6px; width: 4px; border-radius: 2px; background: var(--c); box-shadow: 0 0 8px var(--c); }
  .rg-statui .rg-st .lab b { font-size: 24px; text-shadow: 0 2px 0 #0A0E24; } .rg-statui .rg-st .lab span { font-size: 26px; } .rg-statui .rg-st .lab small.mx { font-size: 15px; color: #AEB7E0; }
  .rg-statui .rg-st small { color: #DDE2F5; font-size: 13px; }
  .rg-statui .rg-st .btns { gap: 8px; } .rg-statui .rg-st .btns .rg-mini { min-width: 50px; height: 42px; font-size: 17px; font-family: var(--f-display); border-radius: 6px; border: 2px solid #6B4A12; box-shadow: 0 0 0 1px #0A0E24, inset 0 2px 0 rgba(255,255,255,.4); background: linear-gradient(180deg, var(--gold2), #C8922E); color: #1D2340; }
  .rg-statui .rg-st .btns .rg-mini.ghost { background: linear-gradient(180deg, #2C3A66, #1A2446); color: #FFFFFF; border-color: var(--steel); box-shadow: 0 0 0 1px #0A0E24, inset 0 1px 0 rgba(255,255,255,.2); }
  .rg-statui .rg-detailgrid { gap: 10px; margin-top: 14px; }
  .rg-statui .rg-detailgrid div { background: linear-gradient(180deg, #141F3C, #0E1530); border: 2px solid var(--gold); border-radius: 6px; padding: 9px 12px; box-shadow: 0 0 0 2px #0A0E24, inset 0 0 0 1px rgba(0,0,0,.5); }
  .rg-statui .rg-detailgrid div:nth-child(4n+2), .rg-statui .rg-detailgrid div:nth-child(4n+4) { border-color: var(--steel); }
  .rg-statui .rg-detailgrid span { font-size: 13px; font-weight: 700; } .rg-statui .rg-detailgrid b { font-size: 26px; color: var(--c); text-shadow: 0 2px 0 #0A0E24; margin: 2px 0; }
  .rg-statui .rg-detailgrid small { color: #C9D0F0; font-size: 12px; } .rg-statui .rg-detailgrid small.pt { color: #AEB7E0; }
  .rg-statui .sub { color: #DDE2F5; }
  .rg-statui .rg-defgrid { grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 10px; }
  .rg-statui .rg-defgrid div { border: 2px solid var(--c); border-radius: 6px; background: linear-gradient(180deg, #141F3C, #0E1530); padding: 5px 6px; box-shadow: 0 0 0 2px #0A0E24; font-size: 13px; font-weight: 700; }
  .rg-statui .rg-defgrid b { font-size: 18px; }
  /* v130 저승 웹툰 (관문 소개 · 보스 등장 컷) */
  .rg-toon { position: absolute; inset: 0; z-index: 6; background: rgba(6,4,14,.84); display: flex; justify-content: center; }
  .rg-toon[hidden] { display: none; }
  .rg-toon .tn-strip { width: min(600px, 94%); height: 100%; display: flex; flex-direction: column; background: #F7F1E3; border-left: 3px solid #0A0E24; border-right: 3px solid #0A0E24; }
  .rg-toon .tn-top { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #1D2340; color: #FFE79A; font-family: var(--f-display); font-size: 16px; }
  .rg-toon .tn-top b { flex: 1; } .rg-toon .tn-skip { background: #2C3A66; color: #FFFFFF; border: 2px solid #8FA6C8; border-radius: 6px; font-size: 13px; padding: 3px 10px; cursor: pointer; }
  .rg-toon .tn-list { flex: 1; overflow-y: auto; padding: 12px 14px 4px; display: flex; flex-direction: column; gap: 14px; scroll-behavior: smooth; cursor: pointer; }
  .rg-toon .tn-cut { position: relative; border: 3px solid #0A0E24; border-radius: 4px; overflow: hidden; animation: tnIn .45s ease-out both; flex: none; box-shadow: 4px 4px 0 rgba(10,14,36,.25); }
  @keyframes tnIn { from { opacity: 0; transform: translateY(26px) scale(.97); } to { opacity: 1; transform: none; } }
  /* v170 그림 컷 (왕을 죽인 검이 깨어나는 웹툰) · sfx = 큰 효과음 글자 · cap = 아래 설명 상자 */
  .rg-toon .tn-cut.pic { padding: 0; background: #0A0E24; }
  .rg-toon .tn-cut.pic img { display: block; width: 100%; height: auto; image-rendering: auto; }
  .rg-toon .tn-cut.pic.shake img { animation: tnShake .09s linear 6 alternate, tnIn .45s ease-out both; }
  @keyframes tnShake { from { transform: translate(-3px, 1px) rotate(-.4deg); } to { transform: translate(3px, -1px) rotate(.4deg); } }
  .rg-toon .tn-cut.pic.flash::after { content: ''; position: absolute; inset: 0; background: #FFFFFF; animation: tnFlash .9s ease-out both; pointer-events: none; }
  @keyframes tnFlash { from { opacity: 1; } to { opacity: 0; } }
  .rg-toon .tn-sfx { position: absolute; top: 8%; right: 5%; font-family: var(--f-display); font-size: 34px; color: #FFE79A; transform: rotate(-8deg); text-shadow: 0 3px 0 #0A0E24, 3px 0 0 #0A0E24, -3px 0 0 #0A0E24, 0 -3px 0 #0A0E24, 0 0 14px #FF8A3D; animation: tnPop .45s .25s ease-out both; }
  .rg-toon .tn-sfx.l { right: auto; left: 5%; transform: rotate(6deg); }
  .rg-toon .tn-sfx.big { font-size: 46px; color: #FFFFFF; text-shadow: 0 4px 0 #8A5A12, 4px 0 0 #8A5A12, -4px 0 0 #8A5A12, 0 -4px 0 #8A5A12, 0 0 20px #FFD23F; }
  .rg-toon .tn-cap { position: absolute; left: 10px; bottom: 10px; max-width: 86%; background: #FFF3B0; color: #1D2340; border: 2px solid #1D2340; padding: 6px 12px; font-size: 14px; line-height: 1.5; box-shadow: 3px 3px 0 #0A0E24; animation: tnIn .4s .35s ease-out both; }
  .rg-toon .tn-cap b { color: #B8321E; }
  @media (max-width: 760px) { .rg-toon .tn-sfx { font-size: 24px; } .rg-toon .tn-sfx.big { font-size: 32px; } .rg-toon .tn-cap { font-size: 12.5px; } }
  .rg-toon .tn-cut.nar { min-height: 150px; padding: 18px 16px; background-size: cover; background-position: center; color: #FFFFFF; display: grid; align-content: center; gap: 10px; }
  .rg-toon .tn-big { font-family: var(--f-display); font-size: 28px; color: #FFE79A; text-shadow: 0 3px 0 #0A0E24, 0 0 12px var(--c); }
  .rg-toon .tn-big small { display: block; font-size: 15px; color: #FFFFFF; text-shadow: 0 2px 0 #0A0E24; }
  .rg-toon .tn-box { justify-self: start; max-width: 92%; background: #FFF3B0; color: #1D2340; border: 2px solid #1D2340; padding: 8px 12px; font-size: 14px; line-height: 1.55; box-shadow: 3px 3px 0 #0A0E24; }
  .rg-toon .tn-cut.say { display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: 4px; min-height: 180px; padding: 10px 12px 10px 4px;
    background: radial-gradient(circle at 22% 60%, color-mix(in srgb, var(--c) 55%, transparent), transparent 60%), repeating-conic-gradient(from 0deg at 22% 60%, rgba(255,255,255,.06) 0 6deg, transparent 6deg 14deg), linear-gradient(180deg, #2A1838, #120A1E); }
  .rg-toon .tn-cut.say.r { grid-template-columns: 1fr 150px; padding: 10px 4px 10px 12px; background: radial-gradient(circle at 78% 60%, color-mix(in srgb, var(--c) 55%, transparent), transparent 60%), repeating-conic-gradient(from 0deg at 78% 60%, rgba(255,255,255,.06) 0 6deg, transparent 6deg 14deg), linear-gradient(180deg, #2A1838, #120A1E); }
  .rg-toon .tn-cut.say.r img { order: 2; } .rg-toon .tn-cut.say.r .tn-bub { order: 1; }
  .rg-toon .tn-cut.say img { width: 150px; height: 170px; object-fit: contain; object-position: bottom; filter: drop-shadow(0 4px 0 rgba(0,0,0,.5)); animation: tnPop .5s .15s ease-out both; }
  @keyframes tnPop { from { transform: translateY(14px) scale(.9); opacity: 0; } to { transform: none; opacity: 1; } }
  .rg-toon .tn-cut.say.king { min-height: 230px; grid-template-columns: 190px 1fr; } .rg-toon .tn-cut.say.king img { width: 190px; height: 215px; }
  .rg-toon .tn-bub { position: relative; background: #FFFFFF; color: #1D2340; border: 3px solid #0A0E24; border-radius: 22px; padding: 10px 14px 12px; font-size: 14.5px; line-height: 1.55; box-shadow: 3px 3px 0 #0A0E24; animation: tnIn .4s .3s ease-out both; }
  .rg-toon .tn-bub::before { content: ''; position: absolute; left: -16px; top: 46%; border: 9px solid transparent; border-right: 14px solid #0A0E24; }
  .rg-toon .tn-bub::after { content: ''; position: absolute; left: -10px; top: calc(46% + 2px); border: 7px solid transparent; border-right: 11px solid #FFFFFF; }
  .rg-toon .r .tn-bub::before { left: auto; right: -16px; border-right: 9px solid transparent; border-left: 14px solid #0A0E24; }
  .rg-toon .r .tn-bub::after { left: auto; right: -10px; border-right: 7px solid transparent; border-left: 11px solid #FFFFFF; }
  .rg-toon .king .tn-bub { border-color: #8A5A12; box-shadow: 3px 3px 0 #8A5A12, 0 0 0 3px #F3D27A; }
  .rg-toon .tn-nm { display: inline-block; margin: -2px 0 4px; padding: 1px 10px; border-radius: 10px; background: var(--c); color: #1D2340; font-family: var(--f-display); font-size: 14px; border: 2px solid #0A0E24; }
  .rg-toon .tn-nm small { font-family: inherit; font-size: 11px; margin-left: 4px; }
  .rg-toon .tn-bub p { margin: 0; }
  .rg-toon .tn-end { padding: 8px 14px 12px; display: flex; justify-content: center; gap: 8px; }
  .rg-toon .tn-end[hidden] { display: none; }
  .rg-toon.one .tn-list { justify-content: center; }   /* 보스 한 컷은 가운데 */
  .rg-toon .tn-go { font-family: var(--f-display); font-size: 18px; padding: 8px 22px; border-radius: 8px; border: 2px solid #6B4A12; background: linear-gradient(180deg, #F3D27A, #C8922E); color: #1D2340; cursor: pointer; box-shadow: 0 3px 0 #0A0E24; }
  .rg-toon .tn-hint { text-align: center; font-size: 12px; color: #3A4270; padding: 2px 0 6px; }
  @media (max-width: 760px) { .rg-toon .tn-cut.say, .rg-toon .tn-cut.say.king { grid-template-columns: 110px 1fr; min-height: 150px; } .rg-toon .tn-cut.say.r { grid-template-columns: 1fr 110px; } .rg-toon .tn-cut.say img, .rg-toon .tn-cut.say.king img { width: 110px; height: 140px; } .rg-toon .tn-bub { font-size: 13px; } }
  /* v131 환생 */
  .rg-reb { width: 100%; display: grid; gap: 4px; justify-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(243,210,122,.5); }
  .rg-reb .cnt { font-size: 13px; color: #C9D0F0; } .rg-reb .cnt b { color: #F3D27A; font-family: var(--f-display); font-size: 17px; }
  .rg-rebbtn { width: 100%; font-family: var(--f-display); font-size: 16px; padding: 7px 10px; border-radius: 8px; cursor: pointer; border: 2px solid #6B4A12; background: linear-gradient(180deg, #FFE79A, #E8A92A); color: #1D2340; box-shadow: 0 0 0 1px #0A0E24, 0 0 12px rgba(255,210,90,.55); }
  .rg-rebbtn[disabled] { background: linear-gradient(180deg, #2C3A66, #1A2446); color: #AEB7E0; border-color: #4A5A8A; box-shadow: 0 0 0 1px #0A0E24; cursor: default; }
  .rg-king10 { margin-top: 10px; padding: 8px 10px; border: 2px solid #F3D27A; border-radius: 10px; background: #1D2340; } .rg-king10 .tt { color: #FFD23F; display: block; margin-bottom: 6px; } .rg-king10 ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; } .rg-king10 li { display: grid; grid-template-columns: 26px 1fr auto; gap: 6px; align-items: center; font-size: 13px; color: #FFFFFF; } .rg-king10 li .no { color: #FFD23F; font-weight: bold; text-align: center; } .rg-king10 li small { color: #9AE6FF; font-size: 11px; } .rg-king10 li.me b { color: #9AF0B0; }
  .rg-god { margin-top: 6px; font-size: 12px; color: #FFD23F; display: flex; gap: 6px; align-items: center; white-space: nowrap; }
  .rg-ttl { width: 100%; display: grid; gap: 4px; justify-items: center; margin-top: 6px; } .rg-ttl label { font-size: 12px; color: #F3D27A; display: flex; white-space: nowrap; gap: 6px; align-items: center; } .rg-ttl select { max-width: 150px; font-size: 11px; padding: 2px 4px; border-radius: 6px; border: 1px solid #F3D27A; background: #1D2340; color: #FFE45C; } .rg-ttl small { font-size: 10px; color: #9AE6FF; line-height: 1.4; text-align: left; }
  .rg-reb small { font-size: 11px; color: #AEB7E0; text-align: center; line-height: 1.35; }
  .rg-rebwin { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 6px 0 12px; }
  .rg-rebinfo, .rg-rebwarn { border: 2px solid #C9A24A; border-radius: 8px; padding: 10px 12px; background: linear-gradient(180deg, #172A47, #0E1A30); }
  .rg-rebwarn { border-color: #FF8A8E; background: linear-gradient(180deg, #3A1A2A, #1E0E1A); }
  .rg-rebwin .tt { font-family: var(--f-display); font-size: 17px; color: #F3D27A; } .rg-rebwarn .tt { color: #FF9AA0; }
  .rg-rebwin ul { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 5px; font-size: 13.5px; line-height: 1.5; } .rg-rebwin b.g { color: #9AF0B0; } .rg-rebwarn b { color: #FFE45C; }
  @media (max-width: 760px) { .rg-rebwin { grid-template-columns: 1fr; } }
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
  .rg-guest { position: absolute; left: 50%; top: 6px; transform: translateX(-50%); z-index: 2; font: 700 13px/1.2 inherit; background: #FFD23F; color: #1D2340; border: 2px solid #1D2340; border-radius: 999px; padding: 5px 12px; box-shadow: 0 3px 0 #1D2340; cursor: pointer; animation: rgGuestB 1.6s ease-in-out infinite; }
  @keyframes rgGuestB { 50% { transform: translateX(-50%) scale(1.05); } }
  .rg-guestwarn { background: rgba(255,210,63,.12); border: 2px solid #FFD23F; border-radius: 10px; padding: 8px 14px; margin: 8px 0; line-height: 1.6; } .rg-guestwarn ul { margin: 4px 0 0; padding-left: 20px; }
  .rg-srv.busy { background: linear-gradient(180deg, #FFB25C, #E0701E); color: #1D2340; border-color: #7A3A00; }   /* v203 50명부터 주황 */
  .rg-srv.full { background: linear-gradient(180deg, #FF6E73, #C8282E); color: #FFFFFF; border-color: #5A0A0E; opacity: 1; }   /* v203 60명 빨강 */
  .rg-srv.busy small, .rg-srv.full small { font-weight: 700; }
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
  .rg-inv { display: grid; grid-template-columns: 318px minmax(0, 1fr); gap: 12px; align-items: start; }   /* v129 왼쪽 넓힘 (캐릭터·능력치가 잘리지 않게) */
  .rg-doll, .rg-bag { background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(0,0,0,.14)); border: 2px solid #0A0E24; border-radius: 14px; padding: 10px; box-shadow: inset 0 1px 0 rgba(255,255,255,.12); }
  .rg-dollgrid { display: grid; grid-template-columns: 64px minmax(0, 1fr) 64px; grid-template-rows: repeat(3, 76px); grid-template-areas: "helmet fig weapon" "armor fig ring" "boots fig ."; gap: 6px; }
  .rg-fig { grid-area: fig; position: relative; border-radius: 12px; background: radial-gradient(ellipse at 50% 88%, rgba(255,210,63,.38), transparent 40%), radial-gradient(circle at 50% 35%, #4A5AB0, #1A2148 75%); border: 2px solid #0A0E24; display: grid; place-items: center; overflow: hidden; }
  .rg-fig img { height: 196px; max-width: 100%; object-fit: contain; image-rendering: auto; filter: drop-shadow(0 4px 0 rgba(0,0,0,.35)); }
  .rg-fig .lv { position: absolute; left: 6px; top: 6px; background: #FFD23F; color: #1D2340; border: 2px solid #0A0E24; border-radius: 6px; font-size: 12px; padding: 0 6px; font-family: var(--f-display); }
  .rg-eqs { position: relative; display: grid; place-items: center; background: radial-gradient(circle at 35% 30%, #2E3870, #0F1430 70%); border: 2px solid var(--c); border-radius: 10px; cursor: pointer; padding: 0 0 10px; color: #EEF1FF; transition: transform .1s, filter .1s; }
  .rg-eqs img { width: 42px; height: 42px; image-rendering: pixelated; }
  .rg-eqs small { position: absolute; bottom: 2px; left: 0; right: 0; font-size: 10px; color: #AEB7E0; text-align: center; }
  .rg-eqs.empty { border-style: dashed; border-color: #3A4270; }
  .rg-eqs img.ph { opacity: .2; filter: grayscale(1) brightness(1.6); }
  .rg-eqs.rare, .rg-cell.rare { box-shadow: 0 0 10px var(--g), inset 0 0 0 1px var(--g); }
  .rg-eqs.sel, .rg-cell.sel { outline: 3px solid #FFD23F; outline-offset: 1px; }
  .rg-statgrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin: 10px 0; }
  .rg-statgrid div { min-width: 0; overflow: hidden; white-space: nowrap; gap: 3px; background: #141A3C; border: 2px solid #0A0E24; border-radius: 8px; padding: 4px 6px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
  .rg-statgrid span { overflow: hidden; text-overflow: ellipsis; }
  .rg-statgrid b { color: #FFFFFF; font-family: var(--f-display); font-size: 14px; }
  .rg-bag { min-width: 0; } .rg-bag .rg-tabs { margin-top: 0; }
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
  .rg-grid.trashing .rg-cell:not(.empty) { cursor: pointer; outline: 2px dashed #FF5A5F; outline-offset: -3px; }
  .rg-grid.trashing .rg-cell.tsel { outline: 3px solid #FF5A5F; outline-offset: 0; background: radial-gradient(circle at 35% 30%, #6A2A40, #3A1020 75%); }
  .rg-cell .tck { position: absolute; left: 2px; top: 1px; font-size: 13px; color: #FFFFFF; background: #FF5A5F; border-radius: 4px; padding: 0 3px; line-height: 1.3; border: 1px solid #0A0E24; }
  .rg-trashbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px; } .rg-trashbar span { margin-right: auto; }
  .rg-tslist { display: flex; flex-wrap: wrap; gap: 6px; max-height: 190px; overflow-y: auto; margin: 6px 0; justify-content: center; }
  .rg-tslist .it { display: grid; justify-items: center; width: 74px; font-size: 11px; line-height: 1.2; text-align: center; } .rg-tslist .it em { font-style: normal; }
  .rg-tslist .it.hi { outline: 2px solid #FFD23F; border-radius: 6px; background: rgba(255,210,63,.14); }
  .rg-warn p.hi { color: #FFD23F; font-weight: 700; }
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
  .rg-detail .rg-itdesc { display: block; margin: 4px 0 2px; color: #FFE48A; font-size: 12.5px; line-height: 1.45; }   /* v162 장비 간단 설명 (옵션 위) */
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
  .rg-xchg { margin-top: 8px; padding: 12px; border: 2px solid #FFD23F; border-radius: 12px; background: #1D2340; }
  .rg-xchg .t { display: block; color: #FFD23F; font-size: 16px; margin-bottom: 10px; text-align: center; }
  .rg-xgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 560px) { .rg-xgrid { gap: 6px; } .rg-xc { padding: 8px 6px; } .rg-xc .h { font-size: 14px; } .rg-xc input { width: 64px; font-size: 15px; } .rg-xc .go { font-size: 13px; padding: 7px 8px; } .rg-xc .qk .rg-mini { padding: 4px 7px; } }
  .rg-xc { border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; align-items: center; text-align: center; }
  .rg-xc.g2p { background: #3A2E0A; border: 2px solid #FFD23F; }
  .rg-xc.p2g { background: #0E2E3E; border: 2px solid #5AD8F5; }
  .rg-xc .h { font-size: 17px; color: #FFFFFF; }
  .rg-xc .h .ar { color: #9AF0B0; }
  .rg-xc .have { margin: 0; color: #9AE6FF; font-size: 13px; }
  .rg-xc .have b { color: #FFFFFF; }
  .rg-xc .num { color: #FFFFFF; font-size: 14px; }
  .rg-xc input { width: 90px; padding: 6px 8px; border-radius: 8px; border: 2px solid #FFD23F; background: #FFF6C2; color: #1D2340; font: inherit; font-size: 17px; text-align: center; }
  .rg-xc .qk { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; }
  .rg-xc .calc { margin: 2px 0; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: center; font-size: 13px; color: #FFE9A8; }
  .rg-xc .calc .out b { color: #FF9AA0; font-size: 15px; } .rg-xc .calc .in b { color: #9AF0B0; font-size: 15px; } .rg-xc .calc .ar { color: #FFFFFF; font-size: 16px; }
  .rg-xc .go { font-size: 15px; padding: 8px 16px; }
  .rg-xc.g2p .go { background: #FFD23F; color: #1D2340; } .rg-xc.p2g .go { background: #5AD8F5; color: #1D2340; }
  .rg-xc .lim { margin: 0; color: #9AF0B0; font-size: 12px; }
  .rg-xchg .ok { color: #9AF0B0; margin: 8px 0 0; text-align: center; }
  .rg-xchg .err { color: #FF9AA0; margin: 8px 0 0; text-align: center; }
  .rg-xchg .note { color: #9AE6FF; font-size: 12px; margin: 8px 0 0; text-align: center; }
  .rg-vanish { margin-top: 12px; padding: 10px 12px; border: 2px solid #FF5A5F; border-radius: 12px; background: #2A1430; text-align: left; }
  .rg-vanish .t { display: block; color: #FF9AA0; font-size: 15px; margin-bottom: 6px; }
  .rg-vanish .ok { color: #9AF0B0; margin: 0; }
  .rg-vanish .rg-list { max-height: 210px; overflow: auto; margin: 0; }
  .rg-vanish .wh { margin-left: 6px; color: #FFD23F; font-size: 12px; }
  .rg-vanish .sub2 { color: #9AE6FF; font-size: 12px; margin: 8px 0 0; }
  .rg-vanish-note { margin-top: 10px; color: #9AF0B0; font-size: 13px; }
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
  /* v146 금테 꾸미기 — 스탯 창·가방 창과 같은 느낌을 다른 창(마법·대장간·약방·서원·이장 댁·역참·저승문·거래·채널 등)에도 (선생님 11/14) */
  .rg-panel.rg-deco { --gold: #C9A24A; --gold2: #F3D27A; --steel: #8FA6C8; border: 3px solid var(--gold); box-shadow: 0 0 0 3px #0A0E24, inset 0 0 0 2px #0A0E24, inset 0 0 0 4px rgba(243,210,122,.22), 0 8px 0 rgba(0,0,0,.35);
    background: radial-gradient(circle at 10px 10px, var(--gold2) 3px, transparent 4px), radial-gradient(circle at calc(100% - 10px) 10px, var(--gold2) 3px, transparent 4px), radial-gradient(circle at 10px calc(100% - 10px), var(--gold2) 3px, transparent 4px), radial-gradient(circle at calc(100% - 10px) calc(100% - 10px), var(--gold2) 3px, transparent 4px),
      radial-gradient(ellipse at 50% 0%, rgba(120,210,230,.16), transparent 55%), linear-gradient(180deg, rgba(23,36,70,.98), rgba(10,16,36,.98)); padding: 14px 18px; }
  .rg-deco h3 { color: var(--gold2); font-size: 24px; text-shadow: 0 2px 0 #0A0E24, 0 0 8px rgba(243,210,122,.35); padding-bottom: 8px; margin-bottom: 8px; position: relative; }
  .rg-deco h3::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; border-radius: 2px; background: linear-gradient(90deg, transparent, #9A6E22 6%, var(--gold2) 50%, #9A6E22 94%, transparent); }
  .rg-deco h3 .x { background: linear-gradient(180deg, #2C3A66, #1A2446); border: 2px solid var(--steel); box-shadow: 0 0 0 1px #0A0E24; font-family: inherit; }
  .rg-deco .sub { color: #C9D0F0; }
  .rg-deco .rg-tabs button { background: linear-gradient(180deg, #2C3A66, #1A2446); color: #FFFFFF; border: 2px solid var(--steel); box-shadow: 0 0 0 1px #0A0E24, inset 0 1px 0 rgba(255,255,255,.2); padding: 6px 14px; font-size: 14px; }
  .rg-deco .rg-tabs button[aria-pressed="true"] { background: linear-gradient(180deg, var(--gold2), #C8922E); color: #1D2340; border-color: #6B4A12; box-shadow: 0 0 0 1px #0A0E24, inset 0 2px 0 rgba(255,255,255,.4), 0 0 8px rgba(243,210,122,.4); font-weight: 700; }
  .rg-deco .rg-tabs .rg-mini:not(.ghost):not(.on) { background: linear-gradient(180deg, var(--gold2), #C8922E); color: #1D2340; border-color: #6B4A12; font-weight: 700; }
  .rg-deco .rg-row { position: relative; --c: var(--gold); background: linear-gradient(90deg, color-mix(in srgb, var(--c) 16%, #141F3C), #0E1530 55%); border: 2px solid var(--c); border-radius: 6px; padding: 8px 12px 8px 14px; box-shadow: 0 0 0 2px #0A0E24, inset 0 0 0 1px rgba(0,0,0,.4); }
  .rg-deco .rg-row::before { content: ''; position: absolute; left: -2px; top: 6px; bottom: 6px; width: 4px; border-radius: 2px; background: var(--c); box-shadow: 0 0 8px var(--c); }
  .rg-deco .rg-list > .rg-row:nth-child(even):not([style*="--c"]) { --c: var(--steel); }
  .rg-deco .rg-row:hover { border-color: var(--gold2); }
  .rg-deco .rg-row .nm { font-size: 15px; } .rg-deco .rg-row .ds { color: #DDE2F5; }
  .rg-deco .rg-row.sel { outline: none; border-color: var(--gold2); box-shadow: 0 0 0 2px #0A0E24, 0 0 0 4px rgba(243,210,122,.55), 0 0 14px rgba(243,210,122,.45); }
  .rg-deco .rg-row.ask { --c: #FF5A5F; }
  .rg-deco .rg-row.off { opacity: .6; }
  .rg-deco .rg-mini { border: 2px solid #6B4A12; box-shadow: 0 0 0 1px #0A0E24, inset 0 2px 0 rgba(255,255,255,.4); background: linear-gradient(180deg, var(--gold2), #C8922E); color: #1D2340; font-weight: 700; padding: 6px 12px; }
  .rg-deco .rg-mini.ghost { background: linear-gradient(180deg, #2C3A66, #1A2446); color: #FFFFFF; border-color: var(--steel); box-shadow: 0 0 0 1px #0A0E24, inset 0 1px 0 rgba(255,255,255,.2); font-weight: 400; }
  .rg-deco .rg-mini[disabled] { background: linear-gradient(180deg, #2C3A66, #1A2446); color: #9AE6FF; border-color: #4A5A8A; opacity: 1; box-shadow: 0 0 0 1px #0A0E24; }
  .rg-deco .rg-mini.on { background: linear-gradient(180deg, #8AF5B5, #2FB868); border-color: #135A32; color: #0A2A18; }
  .rg-deco .rg-mini.warn, .rg-deco .rg-mini.duel { background: linear-gradient(180deg, #FF9A9E, #D2343A); border-color: #5A1018; color: #FFFFFF; }
  .rg-deco .rg-sk, .rg-deco .rg-row .rg-ic { border: 2px solid var(--gold); box-shadow: 0 0 0 2px #0A0E24, 0 0 6px rgba(243,210,122,.3); border-radius: 6px; }
  .rg-deco .rg-npc { border: 2px solid var(--gold); border-radius: 6px; background: linear-gradient(90deg, rgba(243,210,122,.14), rgba(14,26,48,.6)); box-shadow: 0 0 0 2px #0A0E24; }
  .rg-deco .rg-npc img { border: 2px solid var(--gold); box-shadow: 0 0 0 2px #0A0E24; background: radial-gradient(circle at 50% 50%, #24566A, #0E2434 78%); }
  .rg-deco .rg-bagup { border: 2px solid var(--gold2); border-radius: 6px; box-shadow: 0 0 0 2px #0A0E24, 0 0 12px rgba(243,210,122,.25); background: linear-gradient(90deg, #2A4A9A, #172A47); }
  .rg-deco .rg-fuse { border: 2px solid #B57BFF; border-radius: 6px; background: linear-gradient(180deg, #2A1F4E, #150F30); box-shadow: 0 0 0 2px #0A0E24; }
  /* 마법 창: 위 = 기본 1~4 · 융합 QWER 두 칸 판 */
  .rg-skbar { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 4px 0 12px; }
  .rg-skset { position: relative; border: 2px solid var(--gold); border-radius: 6px; padding: 10px 12px 12px; box-shadow: 0 0 0 2px #0A0E24, inset 0 0 0 2px #0A0E24;
    background: radial-gradient(circle at 7px 7px, var(--gold2) 2px, transparent 3px), radial-gradient(circle at calc(100% - 7px) 7px, var(--gold2) 2px, transparent 3px), radial-gradient(circle at 7px calc(100% - 7px), var(--gold2) 2px, transparent 3px), radial-gradient(circle at calc(100% - 7px) calc(100% - 7px), var(--gold2) 2px, transparent 3px), linear-gradient(180deg, #172A47, #0E1A30); }
  .rg-skset.fu { --gold: #B57BFF; --gold2: #E7A6FF; background: radial-gradient(circle at 7px 7px, #E7A6FF 2px, transparent 3px), radial-gradient(circle at calc(100% - 7px) 7px, #E7A6FF 2px, transparent 3px), radial-gradient(circle at 7px calc(100% - 7px), #E7A6FF 2px, transparent 3px), radial-gradient(circle at calc(100% - 7px) calc(100% - 7px), #E7A6FF 2px, transparent 3px), linear-gradient(180deg, #24183F, #120C28); }
  .rg-skset h4 { margin: 0 0 8px; font: 17px var(--f-display); color: var(--gold2); text-shadow: 0 2px 0 #0A0E24; } .rg-skset h4 small { color: #C9D0F0; font-size: 12px; font-family: inherit; margin-left: 4px; }
  .rg-skset .rg-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0; }
  .rg-deco .rg-slot { position: relative; display: grid; justify-items: center; align-content: start; gap: 4px; padding: 14px 4px 6px; min-height: 92px; text-align: center; font-size: 12px; line-height: 1.2; border: 2px solid var(--gold); border-radius: 6px; background: radial-gradient(circle at 50% 38%, rgba(120,210,230,.25), transparent 60%), #0E1A30; box-shadow: 0 0 0 2px #0A0E24; }
  .rg-deco .rg-slot b { position: absolute; left: 50%; top: -9px; transform: translateX(-50%); min-width: 22px; padding: 1px 6px; border: 2px solid #6B4A12; border-radius: 4px; background: linear-gradient(180deg, var(--gold2), #C8922E); color: #1D2340; font: 13px var(--f-display); box-shadow: 0 0 0 1px #0A0E24; }
  .rg-deco .rg-slot .rg-sk { width: 46px; height: 46px; }
  .rg-deco .rg-slot i { color: #9AE6FF; padding: 14px 0 0; font-size: 12px; }
  .rg-deco .rg-slot i::before { content: '＋'; display: block; font-size: 22px; color: var(--gold2); opacity: .7; }
  .rg-deco .rg-row .keys { display: flex; gap: 6px; } .rg-deco .rg-row .keys .rg-mini { min-width: 38px; height: 36px; padding: 0 8px; font: 15px var(--f-display); }
  /* 대장간 */
  .rg-deco .rg-forge { gap: 14px; }
  .rg-deco .rg-forge > .rg-list { border: 2px solid var(--steel); border-radius: 6px; padding: 10px; background: linear-gradient(180deg, #172A47, #0E1A30); box-shadow: 0 0 0 2px #0A0E24; max-height: 360px; align-content: start; }
  .rg-deco .rg-anvil { border: 2px solid var(--gold); border-radius: 6px; box-shadow: 0 0 0 2px #0A0E24, inset 0 0 0 2px #0A0E24; padding: 12px 14px;
    background: radial-gradient(circle at 7px 7px, var(--gold2) 2px, transparent 3px), radial-gradient(circle at calc(100% - 7px) 7px, var(--gold2) 2px, transparent 3px), radial-gradient(circle at 7px calc(100% - 7px), var(--gold2) 2px, transparent 3px), radial-gradient(circle at calc(100% - 7px) calc(100% - 7px), var(--gold2) 2px, transparent 3px), radial-gradient(circle at 50% 18%, rgba(255,138,61,.3), transparent 60%), linear-gradient(180deg, #2A1E30, #120E22); }
  .rg-deco .rg-forgeh { margin: 0 0 8px; font: 16px var(--f-display); color: var(--gold2); text-shadow: 0 2px 0 #0A0E24; }
  .rg-deco .rg-anvil .big { padding: 10px; border: 2px solid var(--gold); border-radius: 6px; background: rgba(10,14,36,.55); box-shadow: 0 0 0 2px #0A0E24; }
  .rg-deco .rg-anvil .big .rg-ic { width: 72px; height: 72px; }
  .rg-deco .rg-anvil .ladder { gap: 4px; margin: 12px 0 8px; }
  .rg-deco .rg-anvil .ladder span { font-size: 12px; padding: 4px 0; border-radius: 4px; border: 2px solid #2A3A66; background: linear-gradient(180deg, #1C2850, #10183A); box-shadow: 0 0 0 1px #0A0E24; color: #DDE2F5; }
  .rg-deco .rg-anvil .ladder span.done { background: linear-gradient(180deg, var(--gold2), #C8922E); border-color: #6B4A12; color: #1D2340; }
  .rg-deco .rg-anvil .ladder span.next { background: linear-gradient(180deg, #FFB86B, #FF6A3D); border-color: #FFE7A0; color: #1D2340; font-weight: 700; }
  .rg-deco .rg-anvil .ladder span.risk { box-shadow: 0 0 0 1px #0A0E24, inset 0 -4px 0 #FF3A3A; }
  .rg-deco .rg-anvil .go { border: 2px solid #6B4A12; border-radius: 6px; box-shadow: 0 0 0 2px #0A0E24, inset 0 2px 0 rgba(255,255,255,.4), 0 4px 0 #0A0E24; }
  /* 이장 댁 지역 묶음 */
  .rg-deco .rg-region { border: 2px solid var(--steel); border-radius: 6px; padding: 8px 10px 4px; margin-top: 10px; background: linear-gradient(180deg, #172A47, #0E1A30); box-shadow: 0 0 0 2px #0A0E24; }
  .rg-deco .rg-region > b { display: block; font: 16px var(--f-display); color: var(--gold2); margin-bottom: 4px; text-shadow: 0 2px 0 #0A0E24; }
  @media (max-width: 760px) { .rg-skbar { grid-template-columns: 1fr; } .rg-deco .rg-slot { min-height: 80px; } }
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
    .rg-statui .rg-statwin { grid-template-columns: 1fr; } .rg-statui .rg-detailgrid { grid-template-columns: repeat(2, 1fr); } .rg-statui .rg-defgrid { grid-template-columns: repeat(4, 1fr); } .rg-statui .rg-st .btns .rg-mini { min-width: 42px; height: 38px; }
    .rg-panel { position: fixed; inset: auto 0 0 0; max-height: 72svh; border-radius: 14px 14px 0 0; z-index: 60; }
    .rg-msg { font-size: 12px; }
  }
  /* v149 펫 (이장 댁 뽑기 · 펫 창) — 회색 안 씀 */
  .rg-petshop { display: grid; gap: 10px; }
  .rg-pethead { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; background: linear-gradient(90deg, #3A2A6A, #1A2048); border: 2px solid #FFD23F; border-radius: 10px; padding: 8px 12px; }
  .rg-pethead b { color: #FFD23F; font-size: 17px; }
  .rg-petrates { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .rg-petrates div { display: grid; gap: 2px; text-align: center; padding: 6px 4px; border-radius: 8px; background: #141A3C; border: 2px solid var(--c); }
  .rg-petrates div b { color: var(--c); } .rg-petrates div span { color: #FFFFFF; font-size: 16px; font-weight: 700; } .rg-petrates div small { color: #C9D0F0; font-size: 11px; }
  .rg-petrates div.lock { background: #0E1230; border-style: dashed; } .rg-petrates div em { font-style: normal; font-size: 10px; color: #9AE6FF; }
  .rg-pcard { position: relative; display: grid; justify-items: center; gap: 2px; padding: 8px 6px; border-radius: 10px; background: radial-gradient(circle at 50% 35%, #2A3266, #12183A 75%); border: 2px solid var(--c); text-align: center; min-width: 0; }
  .rg-pcard img { height: 56px; max-width: 100%; object-fit: contain; image-rendering: auto; filter: drop-shadow(0 2px 0 #0A0E24); }
  .rg-pcard b { color: #FFFFFF; font-size: 13px; } .rg-pcard small { font-size: 11px; font-weight: 700; } .rg-pcard em { font-style: normal; font-size: 11px; color: #FFE48A; }
  .rg-pcard .btns { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; margin-top: 2px; }
  .rg-pcard.on { box-shadow: 0 0 0 2px #3DDC84, 0 0 14px #3DDC8488; }
  .rg-pcard.none img { filter: brightness(0) drop-shadow(0 0 1px #5A64A0); opacity: .55; }
  .rg-pcard .q { font-size: 34px; color: #5A64A0; }
  .rg-pgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; margin-top: 8px; }
  .rg-petres { display: grid; justify-items: center; padding: 6px; }
  .rg-petres .rg-pcard { width: 220px; padding: 10px; } .rg-petres .rg-pcard img { height: 70px; } .rg-petres .rg-pcard b { font-size: 18px; } .rg-petres .rg-pcard small { font-size: 14px; }
  .rg-pcard.flip { animation: rgPetFlip .9s cubic-bezier(.2,1.4,.4,1) both; box-shadow: 0 0 22px var(--c); }
  .rg-petres.g3 .rg-pcard, .rg-petres.g4 .rg-pcard { animation: rgPetFlip .9s cubic-bezier(.2,1.4,.4,1) both, rgPetGlow 1.2s ease-in-out .9s infinite; }
  @keyframes rgPetFlip { 0% { transform: perspective(600px) rotateY(180deg) scale(.6); filter: brightness(3); } 60% { transform: perspective(600px) rotateY(-12deg) scale(1.08); } 100% { transform: none; filter: none; } }
  @keyframes rgPetGlow { 50% { box-shadow: 0 0 34px var(--c), 0 0 60px var(--c); } }
  .rg-petgo, .rg-petenh .go { min-width: 240px; font-size: 16px; font-weight: 700; padding: 10px 18px; border-radius: 10px; border: 2px solid #0A0E24; background: linear-gradient(180deg, #FFE48A, #FFB02A); color: #1D2340; cursor: pointer; box-shadow: 0 3px 0 #0A0E24; }
  .rg-petgo:disabled, .rg-petenh .go:disabled { background: #2A325E; color: #9AE6FF; cursor: default; }
  .rg-petenh { position: relative; } .rg-petenh .big { display: flex; gap: 12px; align-items: center; } .rg-petenh .big .rg-pcard { width: 150px; } .rg-petenh .grow { display: grid; gap: 4px; } .rg-petenh .grow b { color: #FFFFFF; } .rg-petenh .grow small { color: #FFE48A; }
  .rg-petenh .up { color: #3DDC84; }
  @media (max-width: 640px) { .rg-petrates { grid-template-columns: repeat(3, 1fr); } }`;

  /* ================= 본체 ================= */
  window.GoRPG = {
    render(el, A) {
      BGM.load(GAME);
      const syncBgm = () => { const b = el.querySelector('#rgBgm'); if (b) (b.querySelector('span') || b).textContent = BGM.isMuted() ? '음악 켜기' : '음악 끄기'; };   // v73 · v164 아이콘은 두고 글자만
      if (!document.getElementById('rgCss')) { const st = document.createElement('style'); st.id = 'rgCss'; st.textContent = CSS; document.head.appendChild(st); }
      el.innerHTML = `
        <div class="rg-page">
          <div class="play-head"><a class="back" href="#home">← 게임 목록</a><span class="cat">RPG</span><h1>${CFG.name}</h1></div>
          <div class="rg-wrap">
            <div class="cabinet cab-blue" style="--cw:960px;--ar:1.7778"><div class="screen" id="rgScreen" tabindex="0">
              <canvas id="rgCanvas" aria-label="${CFG.name} 게임 화면"></canvas>
              <div class="rg-msg" id="rgMsg" hidden></div>
              <button type="button" class="rg-guest" id="rgGuest" hidden>⚠ 손님 플레이 중 · 계정에 저장되지 않아요 · 눌러서 로그인</button>
              <button type="button" class="rg-chbtn" id="rgChBtn" hidden aria-label="채널 이동"><span>1채널</span><small>채널 이동</small></button>
              <button type="button" class="rg-full" id="rgFull" aria-label="화면 크게 보기"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>
              <div class="rg-panel" id="rgPanel" hidden></div>
              <div class="rg-toon" id="rgToon" hidden></div>
            </div></div>
            <div class="rg-bar">
              <button type="button" class="btn rg-mb" data-rg="stat"><i style="--ic:url(games/action/rpg/img/v79/mb_stat.png)"></i><span>스탯</span><kbd>C</kbd></button>
              <button type="button" class="btn rg-mb" data-rg="inv"><i style="--ic:url(games/action/rpg/img/v79/mb_bag.png)"></i><span>가방</span><kbd>I</kbd></button>
              <button type="button" class="btn rg-mb" data-rg="skill"><i style="--ic:url(games/action/rpg/img/v79/mb_magic.png)"></i><span>마법</span><kbd>K</kbd></button>
              <button type="button" class="btn rg-mb" data-rg="pet"><i style="--ic:url(games/action/rpg/img/v79/mb_pet.png)"></i><span>펫</span><kbd>P</kbd></button>
              <button type="button" class="btn rg-mb" data-rg="servers"><i style="--ic:url(games/action/rpg/img/v79/mb_server.png)"></i><span>서버</span></button>
              <button type="button" class="btn rg-mb" data-rg="help"><i style="--ic:url(games/action/rpg/img/v79/mb_help.png)"></i><span>도움말</span></button>
              <button type="button" class="btn rg-mb" data-rg="full"><i style="--ic:url(games/action/rpg/img/v79/mb_full.png)"></i><span>크게 보기</span></button>
              <a class="btn rg-mb rg-mb-fight" href="#scfight"><i style="--ic:url(games/action/rpg/img/v79/mb_duel.png)"></i><span>Fight 대결</span></a>
              <button type="button" class="btn rg-mb" data-rg="bgm" id="rgBgm"><i style="--ic:url(games/action/rpg/img/v79/mb_music.png)"></i><span>음악 끄기</span></button>
              <button type="button" class="btn rg-mb rg-mb-save" data-rg="save"><i style="--ic:url(games/action/rpg/img/v79/mb_save.png)"></i><span>지금 저장</span></button>
            </div>
            <div class="rg-side">
              <div id="rgChatBox"></div>
              <div class="panel"><h3>레벨 랭킹</h3><ol class="rank" id="rgRank"><li class="empty">불러오는 중…</li></ol><p class="small" id="rgMine"></p></div>
            </div>
          </div>
          <div class="rg-cm">${window.GoSocial ? window.GoSocial.commentsHTML(CFG.name) : ''}</div>
        </div>`;
      const $ = s => el.querySelector(s);
      const canvas = $('#rgCanvas'), screenEl = $('#rgScreen'), panel = $('#rgPanel'), msgEl = $('#rgMsg'), toonEl = $('#rgToon');
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
        const F = D.F, T = D.STAT, lv = S.lv, pb = petBonus(S), a = {}; T.keys.forEach(q => { a[q] = ((S.stat || {})[q] || 0) + pb; });   // v149 펫 올스탯
        const base = { atk: F.atk(lv), mag: F.mag(lv), def: F.def(lv), hp: F.hp(lv), mp: F.mp(lv), spd: 0, dmg: 0, mpRegen: 100, crit: T.baseCrit, pdef: 0, edef: 0 };
        const sta = { dmg: (a.str || 0) * T.str.dmg, spd: (a.dex || 0) * T.dex.spd, mpRegen: (a.int || 0) * T.int.mpRegen, hp: Math.round(base.hp * (a.vit || 0) * T.vit.hpPct / 100), pdef: (a.res || 0) * T.res.pdef, edef: (a.res || 0) * T.res.edef };
        const gear = {}, opt = {};
        Object.values(S.eq).forEach(id => { const it = ITEMS[id]; if (!it) return; if (it.st) Object.keys(it.st).forEach(k => { gear[k] = (gear[k] || 0) + it.st[k]; }); (it.op || []).forEach(o => { opt[o[0]] = r1((opt[o[0]] || 0) + o[1]); }); });
        if (part) return { base, sta, gear, opt, pb };
        const st = {}, o = q => opt[q] || 0; Object.keys(base).forEach(k => { st[k] = base[k] + (sta[k] || 0) + (gear[k] || 0); });
        st.atk *= 1 + o('atkP') / 100; st.mag *= 1 + o('magP') / 100; st.hp *= 1 + o('hpP') / 100; st.mp *= 1 + o('mpP') / 100;
        st.spd = Math.min(T.spdMax || 100, r1(st.spd + o('spdP')));   /* v149 이동 속도 최대 +100% */ st.crit = r1(st.crit + o('crit')); st.dmg = r1(st.dmg + o('dmg')); st.mpRegen = r1(st.mpRegen + o('mpReg'));
        st.goldP = o('goldP'); st.expP = o('expP'); st.critD = T.critDmg + o('critD') / 100;
        const cap = v => clamp(r1(v), -50, T.defCap);
        st.pdef = cap(st.pdef + o('pdef')); st.edefs = {}; Object.keys(ELEM).forEach(e => { st.edefs[e] = cap(st.edef + o('e_all') + o('e_' + e)); });
        ['atk', 'mag', 'def', 'hp', 'mp'].forEach(k => { st[k] = Math.max(1, Math.round(st[k])); });
        st.atkCd = T.atkCd;
        return st;
      }
      /* v176 무적 아이디 (선생님 11/22): 관리자 + 닉네임 '파워복복' 만 · 어디서든 피해 0 · 스탯 창에서 켜고 끌 수 있음(S.godOff) */
      const godAcct = () => !!(Hub.user && Hub.isAdmin && Hub.isAdmin() && Hub.user.nickname === '파워복복');
      const godOn = () => godAcct() && !S.godOff;
      function fightCard() {   // v174 Skillcom Fight 용: 지금 능력치(장비·옵션·강화·펫·스탯 다 반영) + 마법 8칸(1~4 · QWER)
        const K = ['id', 'name', 'el', 'els', 'lv', 'kind', 'pow', 'mp', 'cd', 'count', 'radius', 'len', 'w', 'dur', 'pierce', 'speed'];
        const sl = S.slots.concat(S.fslots).map(id => { const sk = skill(id); if (!sk) return null; const o = {}; K.forEach(k => { if (sk[k] != null) o[k] = sk[k]; }); return o; });
        const st = {}; ['atk', 'mag', 'def', 'hp', 'mp', 'spd', 'dmg', 'mpRegen', 'crit', 'critD', 'pdef', 'edefs'].forEach(k => { st[k] = ST[k]; });
        return { v: 1, lv: S.lv, reb: S.reb || 0, st, slots: sl, at: Date.now() };
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
      /* ---------- v149 펫 ---------- */
      const PG = D.PET_GRADE, petCache = {};
      const petDef = id => { const P = PETBY[id]; if (!P) return null; if (P.art) return { name: 'pet:' + P.name, img79: P.art, h: P.ph || 72 }; const F = D.MAPS.find(m => m.kind === 'field' && m.mon && m.mon.name === P.mon); return F ? F.mon : null; };
      function petSpr(id) {   // 몬스터 그림(작게 줄이기 전) — Meshy 그림이 늦게 오면 다시 받음
        const c = petCache[id]; if (c && !c.wait) return c;
        const m = petDef(id); if (!m) return null;
        return (petCache[id] = monSprite(m, 3));
      }
      let petRe = 0;
      const petUrl = id => { const sp = petSpr(id); if (!sp || sp.wait) { if (!petRe) petRe = setTimeout(() => { petRe = 0; if (pane === 'pet' || pane === 'chief') renderPanel(); }, 600); return ''; } try { return sp.img ? sp.img.toDataURL() : ''; } catch (e) { return ''; } };   // 그림이 아직이면 조금 뒤 다시 그림
      const petOpenOf = g => !g.lock || (S.petOpen && S.petOpen[g.lock]);
      function petRates() {   // 잠긴 등급 확률은 열린 등급에 비율대로 나눔 (선생님 (가))
        const open = PG.map((g, i) => ({ i, g, on: petOpenOf(g) })), tot = open.filter(o => o.on).reduce((a, o) => a + o.g.rate, 0);
        return open.map(o => ({ i: o.i, g: o.g, on: o.on, p: o.on ? o.g.rate / tot * 100 : 0 }));
      }
      function petRoll() {
        const R = petRates(); let r = Math.random() * 100, gi = R.filter(x => x.on).slice(-1)[0].i;
        for (const x of R) { if (!x.on) continue; if (r < x.p) { gi = x.i; break; } r -= x.p; }
        const list = D.PETS.filter(p => p.g === gi && (!p.plock || (S.petOpen && S.petOpen[p.plock]))); return list[Math.floor(Math.random() * list.length)];   // v182 펫마다 잠김(거북선·이순신)
      }
      function petDraw() {
        if (S.gold < D.PET.price) { say('골드가 모자라요 (' + fmtN(D.PET.price) + ' G 필요)'); return; }
        if (S.pets.length >= D.PET.maxOwn) { say('펫이 너무 많아요 (' + D.PET.maxOwn + '마리). 강화에 써서 줄여 주세요'); return; }
        const P = petRoll(), u = newUid();
        S.gold -= D.PET.price; S.pets.push({ u, id: P.id, en: 0 }); if (!S.petOn) S.petOn = u;
        tab.petRes = { id: P.id, t: performance.now(), dup: S.pets.filter(p => p.id === P.id).length > 1 };
        restat(); markDirty(true); petNet();
        if (P.g >= 2) Fx.levelUp && Fx.levelUp(G.px, G.py);
      }
      function petEnh(u) {   // 같은 펫 1마리를 재료로 +1 · 골드 안 씀 · 실패해도 부서지지 않음 (유지 또는 −1)
        const t = S.pets.find(p => p.u === u); if (!t || t.en >= D.PET.max) return;
        const mats = S.pets.filter(p => p.id === t.id && p.u !== u).sort((a, b) => a.en - b.en); if (!mats.length) { say('같은 펫이 한 마리 더 있어야 강화할 수 있어요'); return; }
        const m = mats[0]; S.pets.splice(S.pets.indexOf(m), 1); if (S.petOn === m.u) S.petOn = u;
        const i = t.en, ok = Math.random() * 100 < ENH.rate[i], keep = !ok && Math.random() < D.PET.keep(i);
        if (ok) t.en++; else if (!keep) t.en = Math.max(0, t.en - 1);
        tab.petEnhRes = { ok, keep, en: t.en, id: t.id };
        restat(); markDirty(true); petNet();
      }
      setTimeout(() => D.PETS.forEach(p => petSpr(p.id)), 2000);   // 펫 그림 미리 받기
      const petNet = () => { if (net && net.joined) net.retrack(); };   // 다른 사람 화면의 내 펫 바꾸기
      function drawPetAt(c, id, x, y, face, now, ph) {
        const sp = petSpr(id); if (!sp || !sp.img) return;
        const H0 = 30, k = H0 / sp.h, w = sp.w * k, h = H0, bob = Math.sin(now / 260 + (ph || 0)) * 3;
        c.fillStyle = 'rgba(0,0,0,.24)'; c.beginPath(); c.ellipse(x, y, w * 0.32, 3.5, 0, 0, Math.PI * 2); c.fill();
        c.save(); c.translate(Math.round(x), Math.round(y - 6 + bob)); if (face < 0) c.scale(-1, 1);
        c.imageSmoothingEnabled = true; c.drawImage(sp.img, -w / 2, -h, w, h); c.restore();
        const P = PETBY[id]; if (P && P.g >= 3) { c.save(); c.globalAlpha = 0.35 + 0.2 * Math.sin(now / 200); c.fillStyle = PG[P.g].color; c.beginPath(); c.arc(x, y - 6 - h / 2 + bob, w * 0.55, 0, Math.PI * 2); c.fill(); c.restore(); }   // 영웅·전설은 빛
      }
      function petFollow(o, tx, ty, dt) { if (!o.pp) o.pp = { x: tx, y: ty }; const k = 1 - Math.exp(-dt * 5); o.pp.x += (tx - o.pp.x) * k; o.pp.y += (ty - o.pp.y) * k; if (Math.hypot(tx - o.pp.x, ty - o.pp.y) > 400) { o.pp.x = tx; o.pp.y = ty; } return o.pp; }
      const myPetId = () => { const p = S.pets.find(q => q.u === S.petOn); return p ? p.id : ''; };

      function takeItem(id, n) { n = n || 1; const e = S.inv.find(x => x.id === id); if (!e || e.n < n) return false; e.n -= n; if (!e.n) S.inv.splice(S.inv.indexOf(e), 1); return true; }

      /* ---------- 글자 띄우기 ---------- */
      let msgT = 0;
      function say(t, sec) { msgEl.textContent = t; msgEl.hidden = false; msgT = sec || 2.4; }
      window.GoRPGGuard = () => say('⚠ 서버에 더 진행된 내 캐릭터가 있어서 저장을 멈췄어요. 새로고침(F5) 해 주세요!', 8);   // v168 덮어쓰기 막음 알림
      const float = (x, y, text, color, big) => { if (G.texts.length >= 40) { const i = G.texts.findIndex(t => !t.big); G.texts.splice(i < 0 ? 0 : i, 1); } G.texts.push({ x, y, text, color: color || '#FFFFFF', t: 0, big }); };   // v174 렉: 떠오르는 글자 최대 40개

      /* ---------- 지도 들어가기 ---------- */
      /* v183 보스 방 앞 가방 가득 참 경고 */
      function bagFull() { return S.inv.length >= bagMax(); }
      function bagWarn() { if (bagFull()) say(`⚠️ 가방이 가득 차있어서 아이템을 얻을 수 없습니다. (가방 ${bagMax()}칸이 가득 찼어요)`, 7); }
      function enter(id, side, quiet) {
        const M = MAPBY[id]; if (!M) return;
        const map = getMap(id); G.ysNav = null; G.bfx = []; G.dmark = null; G.stackN = 0; G.slideV = null;
        window.GoRPGKingRoom = M.sx === 'king';   // v150 왕을 죽인 검 아이콘: 전당 안에서만 화려한 그림
        G.map = map; S.map = id; G.room = null; G.npcs = M.kind === 'village' ? villagers(map).concat(smithNpc(map), stationNpc(map), hellNpc(map)) : []; G.hellRun = null; G.onNpc = null; G.pst = null; G.shots = []; G.fxs = []; G.pools = []; G.texts = []; Fx.reset(); G.hpGhost = null;
        if (!quiet) G.title = { t: 0, text: M.kind === 'village' ? M.name : M.name, sub: M.custom ? `특별 지역 · 권장 Lv.${M.lvMin < M.rec ? M.lvMin + '~' + M.rec : M.rec}${M.boss ? ' · 보스' : ''}${M.test ? ' · 🔒 시험 중 (관리자만)' : ''}` : M.hell ? `저승 ${M.gate}관문 · 몬스터 Lv.${100 + (M.gate - 1) * 5 + M.stage}${M.stage >= 5 ? ' · 대왕 Lv.' + M.rec : M.stage >= 3 ? ` · ${D.HELL.kills}마리 뒤 ${M.stage === 3 ? '옥졸' : '판관'}` : ` · ${D.HELL.kills}마리 잡으면 통과`}` : M.kind === 'village' ? (M.region === D.REGIONS.length - 1 ? '마지막 마을 · 부산진성 도원수' : `마을 ${M.region + 1}${D.REGIONS[M.region].castle ? ' · 성' : ''}`) : `사냥터 ${M.no} · 권장 Lv.${M.rec}${M.boss ? ' · 보스' : ''}` };
        const p = side && typeof side === 'object' ? (side.from != null ? arrivePos(map, side.from) || map.startL : side) : side === 'R' ? map.startR : side === 'door' ? doorFront(map) : side === 'pos' && S.x ? { x: S.x, y: S.y } : map.startL;
        G.px = p.x; G.py = p.y;
        if (solidAt(map, G.px, G.py)) { const q = map.startL; G.px = q.x; G.py = q.y; }
        if (!S.visited.includes(id)) S.visited.push(id);
        if (M.kind === 'village') { S.home = id; spawnNone(); }
        else { spawnAll(); if (!M.hell && M.rec > S.lv + 6) say(`권장 Lv.${M.rec} — 지금 레벨로는 위험해요!`, 3); }
        if ((M.sx === 'king' && S.sasinAll) || (M.ys === 'boss' && (!S.ysMural || S.ysAll))) bagWarn();   // v183 보스 방에 들어갈 때 가방이 가득 차 있으면 경고
        G.onDoor = null; markDirty(!quiet); netRoom();
      }
      // v41 건물 안: 문으로 걸어 들어가면 실내 지도 · 아래 가운데 문으로 나가면 그 건물 문 앞
      function enterRoom(b) {
        const vmap = G.map, back = { x: (b.door.x + 0.5) * TS, y: (b.door.y + 1.9) * TS }, room = getRoom(b.type, vmap.M.region);
        G.map = room; G.room = { type: b.type, back, village: S.map }; G.npcs = room.npcs.map(n => Object.assign({}, n)); G.onNpc = null;
        G.mons = []; G.shots = []; G.fxs = []; G.pools = []; G.texts = []; Fx.reset(); G.hpGhost = null;
        G.px = room.startL.x; G.py = room.startL.y; G.fx = 0; G.fy = -1; G.onDoor = null; G.keys = {};
        if (room.M.train) { trainStart(room); return; }   // v144 훈련장
        const main = G.npcs.find(n => !n.guard);
        G.title = null; say(main ? `${main.def.name}에게 가까이 가면 이야기할 수 있어요` : room.M.name, 2.6);
        netRoom();
      }
      /* ---------- v42 온라인 (net.js) ---------- */
      const roomKey = () => (G.room ? (G.room.duel ? 'duel-' + G.room.id : 'r-' + G.room.type + '-' + G.map.M.region) : G.map && G.map.M.solo ? 'solo-' + Hub.clientId : S.map);   // v150 사신의 땅 = 나 혼자 채널   // v143 결투장 = 두 사람만의 채널
      const netRoom = () => { if (net && net.joined) net.setRoom(roomKey()); };
      let net = null;
      const baseEq = () => { const o = {}; Object.keys(S.eq).forEach(k => { const it = ITEMS[S.eq[k]]; if (it) o[k] = it.base || it.id; }); return o; };   // v60 다른 사람에게는 기본 장비 id 만 (그림용)
      function makeNet() {
        net = window.GoRPGNet.create({
          me: () => ({ nick: Hub.user ? Hub.user.nickname : '손님', title: myTitle(), lv: S.lv, av: Hub.user ? Hub.user.avatar : AV.normalize({}), eq: baseEq(), hide: S.hide, pet: myPetId(), x: G.px, y: G.py }),
          onPeers: () => {},
          onFx: (m, p) => { if (p) p.poseUntil = performance.now() + 380; peerFx(m, p); },   // v79 다른 사람이 마법 쓰면 팔 들기
          onTrade: (m, p) => onTrade(m, p),
          onLeave: cid => {
            if (G.trade && G.trade.with === cid) { say('상대가 떠나서 거래가 취소됐어요', 2.6); endTrade(false); }
            if (G.dreq && G.dreq.with === cid) G.dreq = null;   // v143 결투 신청한 상대가 떠남
            if (G.dpend && G.dpend.with === cid) { S.gold += G.dpend.bet; G.dpend = null; say('상대가 떠나서 결투가 취소됐어요', 2.6); }
            if (pane === 'duelIn' && paneArg && paneArg.cid === cid) { pane = null; panel.hidden = true; G.paused = false; }
          },
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
        if (!ok) { say('가방이 바뀌어서 거래를 할 수 없어요', 3); endTrade(true); return false; }
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
        return true;
      }
      /* v146 거래 마무리 2단계 (복사 버그 고침 — 전에는 먼저 확인한 쪽이 바로 바꾸고 상대에게 알렸는데, 그 사이 상대가 올린 것을 바꾸거나 물건을 쓰면
       *  상대만 실패해서 물건이 두 배가 됐음)
       *  ① 번호가 작은 쪽: 바로 바꾸지 않고 commit(열쇠)만 보내고 잠금(T.pend) — 잠긴 동안 올리기·빼기·확인 풀기·취소 막음
       *  ② 받은 쪽: 내 확인 + 열쇠 같음 + 내 가방에 물건이 그대로면 먼저 바꾸고 done(열쇠) · 아니면 abort
       *  ③ 번호가 작은 쪽: done 을 받으면 그때 바꿈 · abort 나 8초 동안 답이 없으면 잠금을 풀고 '다시 확인' */
      function tradeCommit() {
        const T = G.trade; if (!T || T.pend) return;
        T.pend = tradeKey(); T.pendT = 0; net.trade({ k: 'commit', to: T.with, key: T.pend });
        if (pane === 'trade') renderPanel();
      }
      function tradeUnlock(msg) {
        const T = G.trade; if (!T) return;
        T.pend = null; T.myOk = false; T.theirOk = false; if (msg) say(msg, 3);
        if (pane === 'trade') renderPanel();
      }
      const tradeLocked = () => { if (G.trade && G.trade.pend) { say('교환하는 중이에요… 잠시만 기다려 주세요', 1.6); return true; } return false; };
      function onTrade(m, p) {
        const T = G.trade, nick = p.nick || '상대';
        if (DUEL_MSG.includes(m.k)) { onDuel(m, p); return; }   // v143 결투
        if (m.k === 'req') {
          if (T || pane || G.dead || G.duel || G.dreq || G.dpend) { net.trade({ k: 'busy', to: m.cid }); return; }
          openPanel('tradeIn', { cid: m.cid, nick }); return;
        }
        if (!T || T.with !== m.cid) return;
        if (m.k === 'busy' || m.k === 'no') { say(m.k === 'busy' ? `${nick}님은 지금 다른 일을 하고 있어요` : `${nick}님이 거래를 거절했어요`, 2.6); G.trade = null; return; }
        if (m.k === 'yes' && T.state === 'wait') { startTrade(m.cid, nick); return; }
        if (m.k === 'cancel') { say(`${nick}님이 거래를 취소했어요`, 2.6); endTrade(false); return; }
        if (m.k === 'offer') { T.theirs = cleanOffer(m); T.myOk = false; T.theirOk = false; if (pane === 'trade') renderPanel(); return; }
        if (m.k === 'ok') { T.theirOk = m.key === tradeKey(); if (T.myOk && T.theirOk && Hub.clientId < T.with) { tradeCommit(); return; } if (pane === 'trade') renderPanel(); return; }
        if (m.k === 'unok') { T.theirOk = false; if (pane === 'trade') renderPanel(); return; }
        if (m.k === 'commit') {   // v146 받은 쪽이 먼저 바꾸고 done
          const cid = T.with;
          if (T.myOk && m.key === tradeKey() && !T.pend) { if (applyTrade()) net.trade({ k: 'done', to: cid, key: m.key }); }
          else { net.trade({ k: 'abort', to: cid }); tradeUnlock('거래 내용이 바뀌어서 다시 확인해 주세요'); }
          return;
        }
        if (m.k === 'done') { if (T.pend && m.key === T.pend) { T.pend = null; applyTrade(); } return; }
        if (m.k === 'abort') { tradeUnlock('거래 내용이 바뀌어서 다시 확인해 주세요'); return; }
      }
      /* ---------- v143 1:1 결투 (선생님 11/13 "두 캐릭이 서로 결투 신청 · 동의하면 결투장으로 이동 · 3초 뒤 결투 · 골드 배팅 · 승자가 다 가져감 · 승패 기록") ----------
       *  거래처럼 사람을 누르거나(F) → 거래·결투 창에서 '결투 신청' (배팅 골드 = 둘 다 같은 금액, 0 = 친선전)
       *  흐름: A dreq → B 수락 dyes (B 배팅금 먼저 맡김) → A dgo(결투 번호) → 둘 다 결투장(G.room.duel, 채널 'duel-번호')으로 이동
       *        A 왼쪽 · B 오른쪽 → 둘이 서로 보이면 3초 세고 결투 → HP 0 이 된 사람이 dend → 이긴 사람이 배팅금 2배 + 기록(rpg_duels)
       *        결투 중 상대가 나가면(5초 넘게 안 보이면) 이긴 것으로 · 끝나면 3초 뒤 원래 자리로, HP·MP 는 결투 전 그대로
       *  규칙: HP·MP 가득 · 물약·귀환 못 씀 · HP 저절로 안 참 · 시간 제한 없음
       *  피해: 공격하는 쪽이 '맞혔다'(dhit, 방어 전 피해) → 맞은 쪽이 내 방어·속성 방어·보호막으로 줄여서 받고 남은 HP 를 알려 줌(dhp) */
      const DCFG = Object.assign({ dmgMul: 0.5, countSec: 3, waitSec: 15, backSec: 3, goneSec: 5 }, CFG.duel || {});
      const DUEL_MSG = ['dreq', 'dyes', 'dno', 'dbusy', 'dgo', 'dhit', 'dhp', 'dend'];
      let arenaMap = null;
      function getArena() {
        if (arenaMap) return arenaMap;
        const AW = 30, AH = 17, t = new Uint8Array(AW * AH).fill(2), at = (x, y) => (x < 0 || y < 0 || x >= AW || y >= AH ? 2 : t[y * AW + x]), set = (x, y, v) => { if (x >= 0 && y >= 0 && x < AW && y < AH) t[y * AW + x] = v; };
        // 걸을 수 있는 바닥 (줄마다 칸 범위) — 그림의 용암·가시 철창·바위·화로는 막힘
        [[3, 12, 17], [4, 10, 19], [5, 9, 20], [6, 8, 23], [7, 6, 24], [8, 5, 24], [9, 5, 24], [10, 5, 24], [11, 5, 24], [12, 5, 23], [13, 6, 22], [14, 9, 20]].forEach(([y, a, b]) => { for (let x = a; x <= b; x++) set(x, y, 0); });
        const M = { id: 'duel', kind: 'field', arena: true, region: 8, name: '결투장', rec: 1 };
        const map = { id: 'duel', M, R: D.REGIONS[8], w: AW, h: AH, t, at, set, mid: 9, buildings: [], doors: [], spawns: [], objs: [], water: [], gates: [], glows: [], fx: [], npcs: [], exitL: null, exitR: null, exit: { x0: -9, x1: -9, y: 99 } };
        [[11.6, 3.1], [18.4, 3.1], [12.6, 14.6], [17.4, 14.6]].forEach(([x, y]) => { map.glows.push({ x: x * TS, y: y * TS, r: 90, col: '#FF9A3D' }); map.fx.push({ type: 'flame', x: x * TS, y: y * TS - 6 }); });
        const [gc, gx] = P.mk(AW * TS, AH * TS);
        const paint = () => { const im = img79('duel_arena'); gx.fillStyle = '#2A1410'; gx.fillRect(0, 0, AW * TS, AH * TS); if (im) { gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high'; gx.drawImage(im, 0, 0, AW * TS, AH * TS); } };
        paint(); if (!img79('duel_arena')) img79('duel_arena', paint);
        map.ground = gc; map.mini = gc; map.pic = true;
        map.startL = { x: 8.5 * TS, y: 9.7 * TS }; map.startR = { x: 21.5 * TS, y: 9.7 * TS };
        return (arenaMap = map);
      }
      img79('duel_arena');   // 미리 불러 둠
      const duelBusy = () => !!(G.trade || G.duel || G.dreq || G.dpend || G.dead || G.hellRun);
      function askDuel(pp, bet) {
        if (!net || !net.joined) return;
        bet = clamp(Math.floor(+bet || 0), 0, 1e9);
        if (duelBusy()) { say('지금은 결투를 신청할 수 없어요', 2); return; }
        if (bet > S.gold) { say('골드가 모자라요', 2); return; }
        G.dreq = { with: pp.cid, nick: pp.nick, bet, t: 0 };
        net.trade({ k: 'dreq', to: pp.cid, bet });
        say(`${pp.nick}님에게 결투를 신청했어요… (배팅 ${fmtN(bet)}G)`, 3);
      }
      function startDuel(id, opp, nick, bet, side) {
        const pp = net.peers.get(opp);
        const origin = { map: S.map, back: G.room ? G.room.back : { x: G.px, y: G.py } };
        S.gold -= bet; save(true);   // 배팅금은 결투장에 들어가며 맡김 (이기면 2배로 돌아옴)
        G.duel = { id, opp, nick, bet, side, st: 'join', t: 0, origin, hp0: S.hp, mp0: S.mp, oppHp: 1, oppLv: pp ? pp.lv : 1, oppUid: pp ? pp.uid : '', gone: 0, hpT: 0, hpLast: 1 };
        G.dreq = null; G.dpend = null;
        if (pane) { pane = null; panel.hidden = true; G.paused = false; }
        const map = getArena(), p = side === 'L' ? map.startL : map.startR;
        G.map = map; G.room = { type: 'duel', duel: true, id, back: origin.back, village: origin.map };
        G.npcs = []; G.onNpc = null; G.mons = []; G.shots = []; G.fxs = []; G.pools = []; G.texts = []; Fx.reset(); G.hpGhost = null; G.pst = null; G.shield = null; G.dash = null;
        G.px = p.x; G.py = p.y; G.fx = side === 'L' ? 1 : -1; G.fy = 0; G.face = side === 'L' ? 1 : -1; G.view = 's'; G.onDoor = null; G.keys = {};
        restat(); S.hp = ST.hp; S.mp = ST.mp;   // 결투는 HP·MP 가득으로
        G.title = { t: 0, text: '⚔ 결투장', sub: `${nick}님과 결투 · 배팅 ${fmtN(bet)}G${bet ? ` (이기면 ${fmtN(bet * 2)}G)` : ' (친선전)'}` };
        net.fast = true; netRoom();
      }
      function duelDummy() {   // 상대를 '몬스터 자리'로 둬서 내 마법·공격이 원래대로 맞게 함 (그림은 사람으로 그림 · 움직임은 상대 위치)
        const pp = net.peers.get(G.duel.opp);
        return { pvp: true, cid: G.duel.opp, x: pp ? pp.x : 0, y: pp ? pp.y : 0, r: 14, spr: { w: 32, h: 56 }, lvl: G.duel.oppLv, mdef: 0, hp: 1, max: 1, dead: false, def: { colors: {} }, name: G.duel.nick, flash: 0, cd: 9, hx: 0, hy: 0 };
      }
      function duelHit(m, base, els, opt) {   // 내가 상대를 맞힘 → 방어 전 피해를 보냄 (상대 게임이 방어를 빼고 받음)
        const D2 = G.duel; if (!D2 || D2.st !== 'fight') return 0;
        if (m.hitCd > 0) return 0; m.hitCd = 0.12;   // 한 번에 여러 갈래가 맞으면 하나만
        let raw = base * rand(0.9, 1.1) * (1 + (ST.dmg || 0) / 100);
        if ((els || []).some(e => ELEM[e].fx === 'heavy')) raw *= 1.2;
        const crit = Math.random() < ST.crit / 100; if (crit) raw *= ST.critD || D.STAT.critDmg;
        raw = Math.max(1, Math.round(raw * DCFG.dmgMul));
        const el = (els || []).find(e => ELEM[e]) || '';
        net.trade({ k: 'dhit', to: D2.opp, d: raw, el, lv: S.lv, c: crit ? 1 : 0, x: Math.round(G.px), y: Math.round(G.py) });
        Fx.hit(m.x, m.y - m.spr.h / 2, els, crit); m.flash = 0.12;
        if (crit) { G.shake = Math.max(G.shake, 4); G.hitstop = 0.05; }
        if ((els || []).some(e => ELEM[e].fx === 'holy')) S.hp = Math.min(ST.hp, S.hp + Math.max(1, Math.round(raw * 0.03)));
        return raw;
      }
      function duelLose(why) {   // 내 HP 가 0 → 짐
        const D2 = G.duel; if (!D2 || D2.st === 'end') return;
        S.hp = 0; D2.st = 'end'; D2.t = 0; D2.win = false; D2.why = why || 'ko';
        net.trade({ k: 'dend', to: D2.opp, id: D2.id });
        S.duel = S.duel || { w: 0, l: 0 }; S.duel.l++;
        D2.winner = D2.nick; D2.sub = D2.bet ? `배팅 ${fmtN(D2.bet)}G 를 잃었어요` : '친선전';   // v146 결과 창(drawDuelHud)에 승리자 · 3초 뒤 복귀 안내
        G.title = null;
        G.shake = 8; G.flash = 0.3; markDirty(true);
      }
      function duelWin(why) {
        const D2 = G.duel; if (!D2 || D2.st === 'end') return;
        D2.st = 'end'; D2.t = 0; D2.win = true; D2.why = why;
        S.gold += D2.bet * 2; S.duel = S.duel || { w: 0, l: 0 }; S.duel.w++;
        D2.winner = (Hub.user ? Hub.user.nickname : '나'); D2.sub = (why === 'left' ? `${D2.nick}님이 결투장을 나갔어요` : `${D2.nick}님을 이겼어요`) + (D2.bet ? ` · +${fmtN(D2.bet * 2)}G` : '');   // v146
        G.title = null;
        Fx.levelUp(G.px, G.py); Fx.coins(G.px, G.py - 30, D2.bet ? 12 : 4); G.flash = 0.3;
        save(true); recordDuel(D2, why);
      }
      async function recordDuel(D2, why) {   // 승패 기록 (아직 화면에는 안 보임 · 선생님 11/13 "기록만 해놓자")
        if (!(Hub.mode === 'online' && Hub._sb && Hub.user)) return;
        const row = { duel_id: String(D2.id).slice(0, 40), winner: Hub.user.id, loser: /^[0-9a-f-]{36}$/.test(D2.oppUid || '') ? D2.oppUid : null, winner_nick: String(Hub.user.nickname || '').slice(0, 20), loser_nick: String(D2.nick || '').slice(0, 20), winner_lv: S.lv, loser_lv: D2.oppLv | 0, bet: D2.bet | 0, reason: why === 'left' ? 'left' : 'ko' };
        try { await Hub._sb.from('rpg_duels').insert(row); } catch (e) { /* 표가 아직 없으면 그냥 넘어감 */ }
      }
      function duelBack() {   // 결투장 → 원래 자리 (HP·MP 는 결투 전 그대로)
        const D2 = G.duel; if (!D2) return;
        G.duel = null; net.fast = false;
        const o = D2.origin, M = MAPBY[o.map] ? o.map : S.home;
        enter(M, o.back && MAPBY[o.map] ? { x: o.back.x, y: o.back.y } : 'door', true);
        restat(); S.hp = clamp(D2.hp0, 1, ST.hp); S.mp = clamp(D2.mp0, 0, ST.mp);
        say(D2.res === 'cancel' ? '결투가 취소됐어요' : '원래 자리로 돌아왔어요', 2.4); markDirty(true);
      }
      function duelCancel(msg) {   // 상대가 결투장에 오지 않음 → 맡긴 배팅금 돌려받고 돌아감
        const D2 = G.duel; if (!D2) return;
        S.gold += D2.bet; D2.res = 'cancel'; say(msg || '상대가 오지 않아 결투가 취소됐어요', 3); duelBack(); save(true);
      }
      function duelTick(dt) {
        if (G.dreq && (G.dreq.t += dt) > 30) { G.dreq = null; }   // 답이 없으면 신청 취소
        if (G.dpend && (G.dpend.t += dt) > 10) { S.gold += G.dpend.bet; G.dpend = null; say('결투가 시작되지 않아 배팅금을 돌려받았어요', 2.6); }
        const D2 = G.duel; if (!D2) return;
        D2.t += dt;
        const pp = net && net.peers.get(D2.opp);
        if (D2.st === 'join') {
          if (pp) { D2.st = 'count'; D2.t = 0; G.title = null; D2.oppLv = pp.lv; if (pp.uid) D2.oppUid = pp.uid; G.mons = [duelDummy()]; }
          else if (D2.t > DCFG.waitSec) duelCancel();
          return;
        }
        if (D2.st === 'count' || D2.st === 'fight') {
          if (!pp) { if ((D2.gone += dt) > DCFG.goneSec) duelWin('left'); }
          else { D2.gone = 0; const m = G.mons[0]; if (m && m.pvp) { m.x = pp.x; m.y = pp.y; m.hitCd = Math.max(0, (m.hitCd || 0) - dt); m.flash -= dt; } }
        }
        if (D2.st === 'count' && D2.t >= DCFG.countSec) { D2.st = 'fight'; D2.t = 0; G.title = { t: 1.6, text: '결투 시작!', sub: '' }; G.shake = 5; }
        if (D2.st === 'fight' && (D2.hpT += dt) > 0.5) {   // 회복 마법 등으로 HP 가 바뀌면 알려 줌
          D2.hpT = 0; const r = S.hp / ST.hp; if (Math.abs(r - D2.hpLast) > 0.01) { D2.hpLast = r; net.trade({ k: 'dhp', to: D2.opp, hp: +r.toFixed(3) }); }
        }
        if (D2.st === 'end' && D2.t >= DCFG.backSec) duelBack();
      }
      function onDuel(m, p) {
        const nick = p.nick || '상대';
        if (m.k === 'dreq') {
          if (duelBusy() || pane || (G.room && G.room.duel)) { net.trade({ k: 'dbusy', to: m.cid }); return; }
          openPanel('duelIn', { cid: m.cid, nick, lv: p.lv, bet: clamp(Math.floor(+m.bet || 0), 0, 1e9) }); return;
        }
        if (m.k === 'dno' || m.k === 'dbusy') {
          if (G.dreq && G.dreq.with === m.cid) { say(m.k === 'dbusy' ? `${nick}님은 지금 다른 일을 하고 있어요` : `${nick}님이 결투를 거절했어요`, 2.6); G.dreq = null; }
          if (G.dpend && G.dpend.with === m.cid) { S.gold += G.dpend.bet; G.dpend = null; say(`${nick}님이 결투를 취소했어요 (배팅금은 돌려받았어요)`, 2.6); }
          return;
        }
        if (m.k === 'dyes') {   // 신청한 내가 받음 → 결투 번호를 정해서 함께 출발
          const R = G.dreq; if (!R || R.with !== m.cid) return;
          if (S.gold < R.bet || G.dead) { net.trade({ k: 'dno', to: m.cid }); G.dreq = null; say('골드가 모자라 결투가 취소됐어요', 2.6); return; }
          const id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          net.trade({ k: 'dgo', to: m.cid, id, bet: R.bet });
          startDuel(id, m.cid, R.nick || nick, R.bet, 'L'); return;
        }
        if (m.k === 'dgo') {
          const Q = G.dpend; if (!Q || Q.with !== m.cid || +m.bet !== Q.bet || !/^[a-z0-9]{4,40}$/.test(String(m.id))) return;
          S.gold += Q.bet;   // 맡긴 것을 풀고 startDuel 에서 다시 맡김
          startDuel(String(m.id), m.cid, Q.nick || nick, Q.bet, 'R'); return;
        }
        const D2 = G.duel; if (!D2 || D2.opp !== m.cid) return;
        if (m.k === 'dhit' && D2.st === 'fight') {
          const el = ELEM[m.el] ? m.el : null, raw = clamp(+m.d || 0, 0, 1e7);
          const d = hitPlayer(raw, clamp(+m.lv || 1, 1, 200), el, { x: +m.x || G.px, y: +m.y || G.py, pvp: 1 });
          if (d && G.duel && G.duel.st === 'fight') { D2.hpLast = S.hp / ST.hp; net.trade({ k: 'dhp', to: D2.opp, hp: +D2.hpLast.toFixed(3), d, c: m.c ? 1 : 0 }); }
          return;
        }
        if (m.k === 'dhp') {
          D2.oppHp = clamp(+m.hp || 0, 0, 1);
          const mm = G.mons[0]; if (m.d && mm && mm.pvp) G.texts.push({ x: mm.x + rand(-8, 8), y: mm.y - 62, text: (m.c ? '치명! ' : '') + m.d, color: m.c ? '#FFD23F' : '#FFFFFF', t: 0, big: !!m.c, dmg: true });
          return;
        }
        if (m.k === 'dend' && (D2.st === 'fight' || D2.st === 'count')) { D2.oppHp = 0; duelWin('ko'); }
      }
      function drawDuelHud(c) {   // 결투 중: 위 가운데 두 사람 HP 막대 · 3초 세기
        const D2 = G.duel; if (!D2) return;
        const me = S.hp / ST.hp, bw = 170, y = 86;
        const bar2 = (x, r, name, col, right) => {
          c.fillStyle = 'rgba(10,14,36,.82)'; c.fillRect(x - 4, y - 4, bw + 8, 34);
          c.fillStyle = '#3A1418'; c.fillRect(x, y + 12, bw, 12);
          c.fillStyle = col; const w = Math.round(bw * clamp(r, 0, 1)); c.fillRect(right ? x + bw - w : x, y + 12, w, 12);
          c.font = '14px "Jua", "Malgun Gothic", sans-serif'; c.textBaseline = 'alphabetic'; c.textAlign = right ? 'right' : 'left'; c.fillStyle = '#FFFFFF'; c.fillText(name, right ? x + bw : x, y + 8);
        };
        const L = D2.side === 'L', myName = (Hub.user ? Hub.user.nickname : '나') + ' (나)';
        bar2(W / 2 - bw - 40, L ? me : D2.oppHp, L ? myName : D2.nick, L ? '#3DDC84' : '#FF5A5F', false);
        bar2(W / 2 + 40, L ? D2.oppHp : me, L ? D2.nick : myName, L ? '#FF5A5F' : '#3DDC84', true);
        c.font = '22px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#0A0E24'; c.strokeText('VS', W / 2, y + 22); c.fillStyle = '#FFD23F'; c.fillText('VS', W / 2, y + 22);
        if (D2.bet) { c.font = '13px "Jua", "Malgun Gothic", sans-serif'; c.strokeText(`배팅 ${fmtN(D2.bet)}G × 2`, W / 2, y + 44); c.fillStyle = '#FFE9A8'; c.fillText(`배팅 ${fmtN(D2.bet)}G × 2`, W / 2, y + 44); }
        if (D2.st === 'end') {   // v146 결투 결과: 승리자 · 3초 뒤 원래 자리로 (선생님 11/14)
          const left = Math.max(1, Math.ceil(DCFG.backSec - D2.t)), bw2 = Math.min(W - 40, 440), bh2 = 150, bx = W / 2 - bw2 / 2, by = H * 0.36 - bh2 / 2;
          c.save(); c.fillStyle = 'rgba(10,14,36,.45)'; c.fillRect(0, 0, W, H);
          panelBox(c, bx, by, bw2, bh2, 10);
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 5; c.strokeStyle = '#0A0E24';
          c.font = '34px "Jua", "Malgun Gothic", sans-serif'; const head = D2.win ? '🏆 승리!' : '패배…';
          c.strokeText(head, W / 2, by + 30); c.fillStyle = D2.win ? '#FFD23F' : '#FF8A8E'; c.fillText(head, W / 2, by + 30);
          c.font = '20px "Jua", "Malgun Gothic", sans-serif'; const wl = `승리자 : ${D2.winner || ''}`;
          c.strokeText(wl, W / 2, by + 66); c.fillStyle = '#FFFFFF'; c.fillText(wl, W / 2, by + 66);
          c.font = '14px "Jua", "Malgun Gothic", sans-serif'; c.lineWidth = 4; c.strokeText(D2.sub || '', W / 2, by + 92); c.fillStyle = '#FFE9A8'; c.fillText(D2.sub || '', W / 2, by + 92);
          c.font = '16px "Jua", "Malgun Gothic", sans-serif'; const bk = `${left}초 뒤 원래 자리로 돌아가요`;
          c.strokeText(bk, W / 2, by + 122); c.fillStyle = '#9AE6FF'; c.fillText(bk, W / 2, by + 122);
          c.restore(); return;
        }
        let big = null;
        if (D2.st === 'join') big = '상대를 기다리는 중…';
        else if (D2.st === 'count') big = String(Math.max(1, Math.ceil(DCFG.countSec - D2.t)));
        if (big) {
          c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = (D2.st === 'count' ? '96px' : '30px') + ' "Jua", "Malgun Gothic", sans-serif';
          c.lineWidth = 8; c.strokeStyle = '#0A0E24'; c.strokeText(big, W / 2, H * 0.36); c.fillStyle = D2.st === 'count' ? '#FFD23F' : '#FFFFFF'; c.fillText(big, W / 2, H * 0.36); c.restore();
        }
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
        Fx.castCircle(p.x, p.y, els, !!sk.fusion); Fx.use(sk.fusion ? null : sk.id); if (sk.fusion && Fx.useV) Fx.useV('f:' + sk.name);
        if (sk.kind === 'bolt') { const n = sk.count || 1, sp = 430 * (sk.speed || 1); for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.18; G.shots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1, dmg: 0, els, pierce: true, hit: new Set(), r: 9, color: col, color2: col2, mine: false, ghost: true, sid: sk.fusion ? null : sk.id, vid: sk.fusion ? 'f:' + sk.name : sk.id }); } }
        else if (sk.kind === 'nova') Fx.nova(x, y, sk.radius || 120, els);
        else if (sk.kind === 'beam') Fx.beam(x, y, dx, dy, sk.len || 300, sk.w || 30, els);
        else if (sk.kind === 'rain') { for (let i = 0; i < (sk.count || 5); i++) Fx.fall(x + dx * 160 + rand(-90, 90), y + dy * 160 + rand(-60, 60), sk.radius || 60, els, i * 0.1); }
        else if (sk.kind === 'pool') Fx.nova(x + dx * 120, y + dy * 120, (sk.radius || 90) * 0.7, els);
        else if (sk.kind === 'heal') Fx.heal(p.x, p.y - 28, sk.pow > 0.4);
        else if (sk.kind === 'dash') Fx.dash(p.x, p.y - 22, dx, dy, sk.len || 220);
        else if (sk.kind === 'shield' && !Fx.shieldCast(p.x, p.y - 28, sk.id)) Fx.burst(p.x, p.y - 28, 16, Fx.pal(els[0]), { min: 60, max: 140, shape: 'star', lmin: 0.4, lmax: 0.7 });
        Fx.use(null);
      }
      /* ---------- v144 훈련장: 가운데 허수아비를 때려 '지난 10초 평균 딜량'(합 ÷ 10) 을 잼 ----------
       *  허수아비 = G.mons 안의 몬스터 자리(m.dummy) → 마법·평타·불타기 피해가 그대로 들어옴 · 체력 안 줄고 죽지 않음
       *  내 최고값 S.dpsBest (최대 10조) → 랭킹 기록 extra.dps (메인 카드 '10초 딜 1위') */
      const DPS_WIN = 10, DPS_MAX = 1e13;
      function trainStart(room) {
        G.room.train = true;
        const d = room.dummy;
        G.mons = [{ dummy: true, def: { name: '허수아비', colors: { d: '#FFD23F' } }, name: '허수아비', lvl: S.lv, x: d.x, y: d.y, hx: d.x, hy: d.y, r: 18, spr: { w: 48, h: 84 }, mdef: 0, hp: 1, max: 1,
          dead: false, flash: 0, cd: 99, wx: 0, wy: 0, wob: 0, wobV: 0, burn: null, slow: 0, stun: 0, curse: 0, kind: 'dummy' }];
        G.dps = { hits: [], cur: 0, first: 0, best0: S.dpsBest || 0, dirty: false, lastUp: 0, top: G.dpsTop || null };
        G.title = { t: 0, text: '🎯 훈련장', sub: '허수아비를 때려 10초 평균 딜량을 재 보세요' };
        say('마법·평타로 허수아비를 때려 보세요 · 지난 10초 동안 준 피해 ÷ 10 = 10초 평균 딜량', 4);
        if (Hub.extraTop) Hub.extraTop(GAME, 'dps').then(t => { if (G.dps) G.dps.top = t; }).catch(() => {});
        netRoom();
      }
      function dpsAdd(dmg) {
        const P2 = G.dps; if (!P2) return;
        const t = performance.now() / 1000; if (!P2.hits.length && !P2.first) P2.first = t;
        P2.hits.push([t, dmg]);
      }
      function dpsTick() {   // 매 프레임: 10초 지난 타격 빼고 평균 · 최고값 바뀌면 저장
        const P2 = G.dps; if (!P2) return;
        const t = performance.now() / 1000;
        while (P2.hits.length && t - P2.hits[0][0] > DPS_WIN) P2.hits.shift();
        if (!P2.hits.length) P2.first = 0;
        const sum = P2.hits.reduce((a, h) => a + h[1], 0);
        P2.cur = Math.min(DPS_MAX, Math.round(sum / DPS_WIN));
        if (P2.cur > (S.dpsBest || 0)) { S.dpsBest = P2.cur; P2.dirty = true; P2.lastUp = t; G.dirty = true; }
        if (P2.dirty && t - P2.lastUp > 5) { P2.dirty = false; save(true); submitRank(0, true); }   // 5초 동안 안 오르면 기록
      }
      function dummyHit(m, dmg, crit, weakHit, els) {
        m.flash = 0.12; m.wobV += (m.x < G.px ? -1 : 1) * (crit ? 7 : 4);
        dpsAdd(dmg);
        const elc = els && els.length ? Fx.pal(els[0])[1] : '#FFFFFF';
        G.texts.push({ x: m.x + rand(-10, 10), y: m.y - m.spr.h - 4, text: (crit ? '치명! ' : '') + fmtN(dmg), color: crit ? '#FFD23F' : elc, t: 0, big: crit, dmg: true });
        Fx.hit(m.x, m.y - m.spr.h / 2, els, crit);
        (els || []).forEach(e => { const fx = ELEM[e].fx; if (fx === 'burn') m.burn = { t: 3, dps: dmg * 0.12, tick: 0.5 }; else if (fx === 'slow') m.slow = 2.5; else if (fx === 'curse') m.curse = 4; else if (fx === 'holy') S.hp = Math.min(ST.hp, S.hp + Math.max(1, Math.round(dmg * 0.03))); });
        return dmg;
      }
      function dummyTick(m, dt) {
        m.flash -= dt; if (m.curse > 0) m.curse -= dt; if (m.slow > 0) m.slow -= dt; m.stun = 0;
        m.wobV += -m.wob * 60 * dt; m.wobV *= Math.pow(0.02, dt); m.wob += m.wobV * dt * 6; m.wob = clamp(m.wob, -14, 14);   // 맞으면 흔들흔들
        if (m.burn) { m.burn.t -= dt; m.burn.tick -= dt; if (m.burn.tick <= 0) { m.burn.tick = 0.5; const bd = Math.max(1, Math.round(m.burn.dps * 0.5)); dpsAdd(bd); float(m.x, m.y - m.spr.h, fmtN(bd), '#FF9A3D'); } if (m.burn.t <= 0) m.burn = null; }
        dpsTick();
      }
      function drawDummy(c, m, now) {   // 나무 기둥 + 짚 몸통 + 자루 머리 + 가슴 과녁 (맞으면 하얗게 번쩍 · 흔들림)
        const x = m.x, y = m.y, K2 = '#1D2340', fl = m.flash > 0;
        c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y, 26, 8, 0, 0, 7); c.fill();
        c.fillStyle = K2; c.fillRect(x - 20, y - 8, 40, 10); c.fillStyle = '#7A4A28'; c.fillRect(x - 18, y - 6, 36, 6);   // 받침
        c.save(); c.translate(x, y - 6); c.rotate(m.wob * Math.PI / 180);
        const R = (a, b, w, h, col) => { c.fillStyle = fl ? '#FFFFFF' : col; c.fillRect(a, b, w, h); };
        R(-4, -80, 8, 80, K2); R(-2, -78, 4, 78, '#9A6338');   // 기둥
        R(-30, -62, 60, 8, K2); R(-28, -60, 56, 4, '#B07A48');   // 팔
        [-30, 26].forEach(a => { R(a - 2, -66, 8, 16, K2); R(a, -64, 4, 12, '#E8C878'); });   // 손 짚
        R(-17, -58, 34, 44, K2); R(-15, -56, 30, 40, '#E8C878'); for (let i = -12; i < 14; i += 6) R(i, -54, 2, 36, '#C8A050');   // 짚 몸통
        R(-15, -46, 30, 3, '#8A5A36'); R(-15, -26, 30, 3, '#8A5A36');   // 새끼줄
        if (!fl) { [[10, '#FFFFFF'], [7, '#D2343A'], [4, '#FFFFFF'], [2, '#D2343A']].forEach(([r, col]) => { c.fillStyle = col; c.beginPath(); c.arc(0, -36, r, 0, 7); c.fill(); }); }
        c.fillStyle = K2; c.beginPath(); c.arc(0, -72, 13, 0, 7); c.fill(); c.fillStyle = fl ? '#FFFFFF' : '#F2E6CC'; c.beginPath(); c.arc(0, -72, 11, 0, 7); c.fill();   // 자루 머리
        if (!fl) { R(-6, -76, 3, 3, K2); R(3, -76, 3, 3, K2); R(-4, -68, 8, 2, K2); R(-11, -84, 22, 4, '#D2343A'); }   // 얼굴 · 머리띠
        c.restore();
        if (m.burn && Math.random() < 0.4) Fx.emit({ x: x + rand(-14, 14), y: y - rand(10, 70), vx: rand(-10, 10), vy: rand(-80, -40), life: 0.5, size: rand(3, 5), color: pick(['#FFE45C', '#FF9A3D', '#E8402A']), shape: 'glow', add: true });
      }
      const kfmt = v => { v = Math.round(v || 0); if (v >= 1e12) return (Math.floor(v / 1e11) / 10) + '조'; if (v >= 1e8) return (Math.floor(v / 1e7) / 10) + '억'; if (v >= 1e4) return (Math.floor(v / 1e3) / 10) + '만'; return fmtN(v); };
      function drawTrainHud(c) {   // 오른쪽 위: 지난 10초 평균 · 내 최고 · 전체 1위
        const P2 = G.dps; if (!P2 || !G.room || !G.room.train) return;
        const w = 330, h = 96, x = W - w - 12, y = 12, t = performance.now() / 1000;   // 오른쪽 위 (가운데 창 풍경이 보이게)
        panelBox(c, x, y, w, h, 12);
        c.textBaseline = 'middle'; c.textAlign = 'left';
        c.font = '14px "Jua", "Malgun Gothic", sans-serif'; c.fillStyle = '#9AE6FF';
        const secs = P2.first ? Math.min(DPS_WIN, t - P2.first) : 0;
        c.fillText(P2.first ? `🎯 지난 10초 평균 딜량 (${secs < DPS_WIN ? secs.toFixed(1) + '초째' : '10초 꽉 참'})` : '🎯 허수아비를 때리면 재기 시작해요', x + 16, y + 18);
        c.font = '28px "Jua", "Malgun Gothic", sans-serif'; c.fillStyle = '#FFFFFF'; c.fillText(fmtN(P2.cur) + ' /초', x + 16, y + 48);
        c.font = '14px "Jua", "Malgun Gothic", sans-serif'; c.fillStyle = '#FFD23F'; c.fillText(`🏅 내 최고 ${kfmt(S.dpsBest)}/초` + (S.dpsBest > P2.best0 ? '  ✨ 새 기록!' : ''), x + 16, y + 78);
        c.textAlign = 'right'; c.fillStyle = '#9AF0B0';
        const tp = P2.top; c.fillText(tp ? `👑 1위 ${tp.nickname} ${kfmt(Math.max(tp.value, 0))}` : '👑 1위 아직 없음', x + w - 14, y + 78);
        if (P2.cur >= DPS_MAX) { c.fillStyle = '#FF9AA0'; c.fillText('최대 10조!', x + w - 14, y + 48); }
      }
      /* ---------- v145 약방 '포인트 교환': RPG 골드 100 = 사이트 포인트 1 (양쪽) · 방향마다 하루 100P ----------
       *  온라인: 지금 캐릭터를 서버에 먼저 저장 → rpg_exchange(서버가 저장된 골드를 직접 확인·차감) → 받은 골드로 맞춤 */
      const XRATE = 100, XDAY = 100;
      function xchgLoad() {
        if (!Hub.user || !Hub.rpgExchangeToday) return;
        Hub.rpgExchangeToday().then(r => { tab.xday = r; tab.xerr = null; if (pane === 'potion') renderPanel(); }).catch(e => { tab.xerr = e.message; if (pane === 'potion') renderPanel(); });
      }
      function xchgHtml() {
        if (!Hub.user) return `<div class="rg-xchg"><p class="sub">로그인하면 RPG 골드와 사이트 상점 포인트를 바꿀 수 있어요.</p></div>`;
        if (!tab.xday && !tab.xload) { tab.xload = true; setTimeout(xchgLoad, 0); }   // 창을 처음 열 때 오늘 바꾼 양 불러옴
        const xd = tab.xday || { g2p_today: 0, p2g_today: 0 }, pts = Hub.user.points || 0, xn = tab.xn || {};
        const card = (dir, from, to, left, have) => {   // 왼쪽 골드→포인트 · 오른쪽 포인트→골드
          const n = xn[dir] || 10, cost = dir === 'g2p' ? `${fmtN(n * XRATE)} G` : `${n} P`, get = dir === 'g2p' ? `${n} P` : `${fmtN(n * XRATE)} G`;
          return `<div class="rg-xc ${dir}"><b class="h">${from} <span class="ar">→</span> ${to}</b>
            <p class="have">${have}</p>
            <label class="num"><input id="rg-xn-${dir}" data-xin="${dir}" type="number" min="1" max="${XDAY}" value="${n}" inputmode="numeric" aria-label="${from}을 ${to}로 바꿀 양 (포인트)"> 포인트</label>
            <div class="qk">${[1, 10, 50, 100].map(q => `<button type="button" class="rg-mini ghost" data-xset="${dir}:${q}">${q}</button>`).join('')}</div>
            <p class="calc"><span class="out">내는 것 <b>${cost}</b></span><span class="ar">➜</span><span class="in">받는 것 <b>${get}</b></span></p>
            <button type="button" class="rg-mini go" data-xdir="${dir}" ${tab.xbusy || !left ? 'disabled' : ''}>${dir === 'g2p' ? '⭐ 포인트로 바꾸기' : '🪙 골드로 바꾸기'}</button>
            <p class="lim">오늘 남은 한도 <b>${left} P</b> / ${XDAY} P</p></div>`;
        };
        return `<div class="rg-xchg"><b class="t">💱 골드 ↔ 사이트 포인트 · 100 G = 1 P</b>
          <div class="rg-xgrid">${card('g2p', '🪙 골드', '⭐ 포인트', Math.max(0, XDAY - (xd.g2p_today || 0)), `가진 골드 <b>${fmtN(S.gold)} G</b>`)}${card('p2g', '⭐ 포인트', '🪙 골드', Math.max(0, XDAY - (xd.p2g_today || 0)), `가진 포인트 <b>${fmtN(pts)} P</b>`)}</div>
          ${tab.xmsg ? `<p class="ok">${tab.xmsg}</p>` : ''}${tab.xerr ? `<p class="err">${tab.xerr}</p>` : ''}
          <p class="note">한도는 방향마다 하루 ${XDAY} P · 한국 시간 자정에 다시 채워져요.</p></div>`;
      }
      function xchgCalc(dir) {   // 숫자를 바꾸면 '내는 것 → 받는 것' 만 바로 고침 (창을 다시 그리지 않아 입력이 끊기지 않음)
        const inp = panel.querySelector('#rg-xn-' + dir), box = inp && inp.closest('.rg-xc'); if (!box) return;
        const n = Math.max(0, Math.floor(+inp.value || 0)); tab.xn = Object.assign({}, tab.xn, { [dir]: n });
        box.querySelector('.out b').textContent = dir === 'g2p' ? `${fmtN(n * XRATE)} G` : `${n} P`;
        box.querySelector('.in b').textContent = dir === 'g2p' ? `${n} P` : `${fmtN(n * XRATE)} G`;
      }
      async function xchgDo(dir, n) {
        if (tab.xbusy || !Hub.user || !Hub.rpgExchange) return;
        n = Math.floor(+n || 0); tab.xn = Object.assign({}, tab.xn, { [dir]: n }); tab.xmsg = null; tab.xerr = null;
        if (n < 1 || n > XDAY) { tab.xerr = `1~${XDAY} 포인트 사이로 적어 주세요`; renderPanel(); return; }
        if (dir === 'g2p' && S.gold < n * XRATE) { tab.xerr = `골드가 모자라요 (필요 ${fmtN(n * XRATE)} G)`; renderPanel(); return; }
        if (dir === 'p2g' && (Hub.user.points || 0) < n) { tab.xerr = `포인트가 모자라요 (필요 ${n} P)`; renderPanel(); return; }
        tab.xbusy = true; renderPanel();
        try {
          G.xLock = true;
          if (Store.online()) { const ok = await save(true, true); if (!ok) throw new Error('서버에 저장하지 못했어요. 잠시 뒤 다시 해 주세요'); }   // 서버가 지금 골드를 보게
          const r = await Hub.rpgExchange(dir, n, S.gold);
          S.gold = Math.max(0, Math.floor(+r.gold || 0)); tab.xday = r; G.xLock = false; save(true);
          tab.xmsg = dir === 'g2p' ? `✅ ${fmtN(n * XRATE)} G → ${n} P 로 바꿨어요` : `✅ ${n} P → ${fmtN(n * XRATE)} G 로 바꿨어요`;
          A.toast(tab.xmsg.replace('✅ ', ''));
        } catch (e) { tab.xerr = e.message || '교환하지 못했어요'; }
        G.xLock = false; tab.xbusy = false; if (pane === 'potion') renderPanel();
      }
      function leaveRoom() {
        const r = G.room; if (!r) return;
        if (r.train && G.dps) { if (G.dps.dirty || (S.dpsBest || 0) > G.dps.best0) { G.dps.dirty = false; save(true); submitRank(0, true); } G.dpsTop = G.dps.top; G.dps = null; }
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
        if (M.sx && M.sx !== 'path') return spawnSasin(M);
        if (M.ys && M.id === D.YS.muralAt) {   // v177 쌍룡 벽화 틀 + 석등·벽화 빛 (어두운 곳에서도 보이게)
          const fx0 = (G.map.w >> 1) * TS + 165, fy0 = ((G.map.h >> 1) - 1.2) * TS;
          G.npcs = [{ key: 'ysmural', def: D.YS.frame, mural: true, x: fx0, y: fy0, face: -1, ph: 1, smith: true }];
          if (!G.map.ysFrameGlow) { G.map.ysFrameGlow = 1; G.map.glows.push({ x: fx0 - 116, y: fy0 - 62, r: 90, col: '#FFB050' }, { x: fx0 + 116, y: fy0 - 62, r: 90, col: '#FFB050' }, { x: fx0, y: fy0 - 120, r: 170, col: '#FFE9A0' }); }
        }   // v174 빈 벽화 틀 (퍼즐)
        if (M.ys && M.ys !== 'path') return spawnYs(M);   // v172 이순신 장군님 던전 장수·회합·본진·어귀   // v150 사신의 땅 보스 방 · 어귀
        if (M.custom) {   // v134 특별 지역: 메이커에서 고른 몬스터 · 레벨 · 마릿수 (+ 보스) · v143 몬스터마다 레벨 따로
          if (M.bossMon) G.mons.push(makeMon(M.bossMon, M.bossLv, true));
          (M.monList || []).forEach(e => { for (let i = 0; i < e.n; i++) G.mons.push(makeMon(e.mon, e.old ? e.lv - 1 + (Math.random() < 0.5 ? 0 : 1) : e.lv)); });
          return;
        }
        if (M.boss) {
          G.mons.push(makeMon(M.mon, M.rec + 2, true));
          const minion = D.MAPS.find(m => m.kind === 'field' && m.no === M.no - 1);
          for (let i = 0; i < 9; i++) G.mons.push(makeMon(minion.mon, M.rec - 1));   // v109 몬스터 1.5배 (6 → 9)
        } else for (let i = 0; i < 18; i++) G.mons.push(makeMon(M.mon2 && i % (M.mix || 3) === (M.mix || 3) - 1 ? M.mon2 : M.mon, M.rec - 1 + (Math.random() < 0.5 ? 0 : 1)));   // v80 왜군 진지: 다른 왜군이 섞여 나옴 · v109 몬스터 1.5배 (12 → 18)
      }
      /* v69 저승 보스 기술: 기술 목록(data.js HELL.gates 의 skills)에서 골라 씀. 체력 절반 아래 = 분노(더 자주·더 많이)
       *  slam 내려찍기 · charge 돌진 · blades 칼비 · ring 사방 탄 · fan 부채꼴 탄 · summon 망령 3마리 */
      const SKILL_NAME = { slam: '내려찍기!', charge: '돌진!', blades: '칼비가 쏟아진다!', ring: '사방 원혼탄!', fan: '판결의 붓!', summon: '망령을 부른다!', snipe: '저격!', boomer: '부메랑!', bounce: '튕기는 불덩이!', homing: '유도탄!', split: '분열탄!', orb: '거대 구체!', spiral: '나선탄!', volley: '연발 사격!', web: '거미줄!', hush: '침묵탄!', scare: '공포탄!', harpoon: '작살!', donut: '도넛 폭발!', cage: '고리 감옥!', cross: '십자 폭발!', chain: '연쇄 폭발!', meteor: '운석 낙하!', poison: '독 장판!', swamp: '늪!', ice: '얼음 바닥!', safe: '피할 곳은 하나뿐!', tentacle: '촉수!', sweep: '휩쓸기!', spin: '회전 칼날!', leap: '도약!', burrow: '땅굴!', stealth: '투명!', tele: '순간이동!', kick: '걷어차기!', bash: '밀치기!', headbutt: '박치기!', turret: '포탑 설치!', phalanx: '병사 돌격!', shadow: '그림자!', healer: '회복 정령!', orbit: '위성 구슬!', shieldup: '보호막!', guard: '방패!', rewind: '되감기!', drain: '흡혈!', bloodpool: '피 웅덩이!', dark: '어둠!', deathmark: '데스마크!', mend: '부하 회복!', laser: '빛줄기!', hook: '끌어당기기!', whirl: '소용돌이!', mines: '지뢰를 깐다!', bomb: '시한폭탄!', barrage: '전체 폭격!', gaze: '보면 굳는다!', clones: '분신술!', blink: '순간이동!', windwall: '바람 장벽!', realm: '결투장!', charge3: '3연속 돌진!' };
      /* v173 보스 기술 다양화 (선생님 11/21 · 롤에서 아이디어) — 새 기술 11가지 + 체력 단계 패턴 + 쿨타임↓ 범위↑
       *  laser 직선 레이저 · hook 끌어당기기 · whirl 소용돌이 끌림 · mines 지뢰 · bomb 시간차 폭탄 · barrage 전체 예고 폭격 · gaze 보면 굳기
       *  clones 분신술 · blink 순간이동 기습 · windwall 바람 장벽 · realm 1:1 결투장 · charge3 3연속 돌진 · (패시브) def.undying 죽지 않는 분노
       *  G.bfx = 바닥에 남는 것들(지뢰·폭탄·소용돌이·장벽·결투장·폭격) — 맵을 옮기면 지움 */
      const BIG = m => !!(m.def.hard || m.lvl > 30);   // 1~30 단계 보스는 범위 그대로 (쿨타임만 줄임)
      const slamRo = m => m.slamRo || m.def.slamR || (m.boss && BIG(m) ? 170 : 130);
      function segDist(px, py, x, y, a, L) { const dx = Math.cos(a), dy = Math.sin(a), qx = px - x, qy = py - y, t = Math.max(0, Math.min(L, qx * dx + qy * dy)); return Math.hypot(qx - dx * t, qy - dy * t); }
      function walkable(x, y) { return !solidAt(G.map, x, y) && x > TS && y > TS && x < G.map.w * TS - TS && y < G.map.h * TS - TS; }
      function newSkill(m, k, a0) {   // 새 기술 시작 (true = 처리함)
        const big = BIG(m), cx = m.x, cy = m.y - m.spr.h / 2;
        if (newSkill2(m, k, a0, big)) return true;   // v173 기술 사전
        if (k === 'laser') { m.cast = { k, t: 0, a: a0, x: cx, y: cy, L: 950, w: big ? 34 : 26 }; return true; }
        if (k === 'hook') { m.cast = { k, t: 0, a: a0, x: cx, y: cy, L: 720 }; return true; }
        if (k === 'gaze') { m.cast = { k, t: 0 }; return true; }
        if (k === 'whirl') { G.bfx.push({ k, m, x: G.px, y: G.py - 10, r: big ? 165 : 130, t: 0, warn: 0.7, dur: 3.4, tick: 0 }); m.cast = { k, t: 0 }; return true; }
        if (k === 'mines') { const n = big ? 6 : 4; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = rand(40, 230), x = G.px + Math.cos(a) * d, y = G.py + Math.sin(a) * d * 0.75; if (walkable(x, y)) G.bfx.push({ k: 'mine', m, x, y, t: 0, arm: 0.8, life: 10, boom: big ? 80 : 64 }); } m.cast = { k, t: 0 }; return true; }
        if (k === 'bomb') { G.bfx.push({ k, m, x: G.px, y: G.py, t: 0, follow: 2.0, dur: 3.0, r: big ? 125 : 100 }); m.cast = { k, t: 0 }; return true; }
        if (k === 'barrage') { G.bfx.push({ k, m, t: 0, dur: 3.0 }); m.cast = { k, t: 0 }; return true; }
        if (k === 'windwall') { const a = a0; G.bfx.push({ k: 'wall', m, x: cx + Math.cos(a) * 95, y: cy + 20 + Math.sin(a) * 95, a: a + Math.PI / 2, L: big ? 280 : 220, t: 0, dur: 4.5 }); m.cast = { k, t: 0 }; return true; }
        if (k === 'realm') { if (!G.bfx.some(q => q.k === 'realm')) G.bfx.push({ k, m, x: (m.x + G.px) / 2, y: (m.y + G.py) / 2, r: 290, t: 0, dur: 7 }); m.cast = { k, t: 0 }; return true; }
        if (k === 'charge3') { const a = Math.atan2(G.py - m.y, G.px - m.x), v = m.def.hard ? 580 : 430; m.cast = { k: 'charge', t: 0, a, vx: Math.cos(a) * v, vy: Math.sin(a) * v, n: 3 }; return true; }
        if (k === 'blink') {
          const fx = G.fx || G.face || 1, fy = G.fy || 0, l = Math.hypot(fx, fy) || 1; let tx = G.px - fx / l * 95, ty = G.py - fy / l * 95;
          if (!walkable(tx, ty)) { tx = G.px + (G.px > m.x ? 95 : -95); ty = G.py; } if (!walkable(tx, ty)) return false;
          Fx.nova(m.x, m.y - 40, 70, [m.el || 'dark', 'dark']); m.x = tx; m.y = ty; Fx.nova(m.x, m.y - 40, 70, [m.el || 'dark', 'dark']);
          m.slamRo = big ? 115 : 95; m.slam = { t: 0.25, x: m.x, y: m.y - 20, ro: 1 }; return true;
        }
        if (k === 'clones') {
          if (G.mons.some(q => q.isClone && !q.dead)) return false;
          const pos = [[0, 0], [-170, 30], [170, 30]].sort(() => Math.random() - 0.5), bx = m.x, by = m.y;
          pos.forEach(([dx, dy], i) => {
            const x = bx + dx, y = by + dy; if (!walkable(x, y)) return;
            if (i === 0) { m.x = x; m.y = y; }
            else { const q = makeMon(Object.assign({}, m.def, { skills: ['fan'], nb: 1, undying: false, ysBoss: false, ysGen: null, allRoom: false }), m.lvl, true); q.isClone = true; q.noRespawn = true; q.x = q.hx = x; q.y = q.hy = y; q.max = q.hp = Math.max(1, Math.round(m.max * 0.03)); q.atk = Math.round(m.atk * 0.4); q.aggro = true; q.cloneT = 10; G.mons.push(q); }
            Fx.death(x, y - 40, m.def.colors, false);
          });
          m.cast = { k, t: 0 }; return true;
        }
        return false;
      }
      function newCastTick(m, c, dt) {   // 새 기술 진행 (true = 처리함)
        if (newCastTick2(m, c, dt)) return true;
        if (c.k === 'laser') { if (c.t >= 0.95 && !c.fired) { c.fired = true; if (segDist(G.px, G.py - 24, c.x, c.y, c.a, c.L) < c.w) hitPlayer(m.atk * 1.5, m.lvl, m.el, m); G.shake = Math.max(G.shake, 6); } if (c.t >= 1.25) m.cast = null; return true; }
        if (c.k === 'hook') {
          if (c.t >= 0.6 && !c.fired) { c.fired = true; if (segDist(G.px, G.py - 24, c.x, c.y, c.a, c.L) < 30) { const a = Math.atan2(G.py - m.y, G.px - m.x); let tx = m.x + Math.cos(a) * 60, ty = m.y + Math.sin(a) * 40; if (c.both) { const hx = (m.x + G.px) / 2, hy = (m.y + G.py) / 2; if (walkable(hx, hy)) { m.x = hx - Math.cos(a) * 40; m.y = hy - Math.sin(a) * 25; tx = hx + Math.cos(a) * 20; ty = hy + Math.sin(a) * 15; } } if (!walkable(tx, ty)) { tx = m.x; ty = m.y + 30; } G.bfx.push({ k: 'pull', m, x0: G.px, y0: G.py, tx, ty, t: 0, dur: 0.25 }); hitPlayer(m.atk * 0.8, m.lvl, m.el, m); G.pst = G.pst || {}; G.pst.stun = Math.max(G.pst.stun || 0, 0.5); float(G.px, G.py - 70, '끌려간다!', '#FF8A8E'); } }
          if (c.t >= 0.9) m.cast = null; return true;
        }
        if (c.k === 'gaze') {
          if (c.t >= 1.1 && !c.fired) { c.fired = true; const bx = m.x - G.px, by = m.y - m.spr.h / 2 - G.py, dot = bx * (G.fx || G.face || 0) + by * (G.fy || 0); G.pst = G.pst || {};
            if (dot > 0) { G.pst.stun = Math.max(G.pst.stun || 0, 1.6); float(G.px, G.py - 70, '돌처럼 굳었다!', '#C8A8FF'); } else { G.pst.slow = Math.max(G.pst.slow || 0, 2); float(G.px, G.py - 70, '등을 돌려 피했다! (느려짐)', '#9AE6FF'); } }
          if (c.t >= 1.3) m.cast = null; return true;
        }
        if (['whirl', 'mines', 'bomb', 'barrage', 'windwall', 'realm', 'clones'].includes(c.k)) { if (c.t > 0.6) m.cast = null; return true; }
        return false;
      }
      function bfxTick(dt) {
        const cur = G.bfx; G.bfx = [];   // 도는 동안 새로 생긴 것(밀기·지연 폭발)은 G.bfx 에 따로 쌓였다가 뒤에 합침
        const kept = cur.filter(f => {
          f.t += dt; const r2 = bfxTick2(f, dt); if (r2 !== undefined) return r2;
          const m = f.m, alive = m && !m.dead;
          if (f.k === 'pull') { const k = Math.min(1, f.t / f.dur); G.px = f.x0 + (f.tx - f.x0) * k; G.py = f.y0 + (f.ty - f.y0) * k; return f.t < f.dur; }
          if (!alive && f.k !== 'mine') return false;
          if (f.k === 'whirl') {
            if (f.t > f.warn && !G.dead) { const dx = f.x - G.px, dy = f.y - G.py, d = Math.hypot(dx, dy); if (d < f.r && d > 4) { const sp = 120 * dt, nx = G.px + dx / d * sp, ny = G.py + dy / d * sp; if (walkable(nx, ny)) { G.px = nx; G.py = ny; } }
              if ((f.tick -= dt) <= 0) { f.tick = 0.5; if (d < 60) hitPlayer(m.atk * 0.55, m.lvl, m.el, m); } }
            return f.t < f.warn + f.dur;
          }
          if (f.k === 'mine') { if (f.t > f.arm && !G.dead && Math.hypot(G.px - f.x, G.py - f.y) < 28) { Fx.nova(f.x, f.y - 10, f.boom, [m.el || 'fire', 'fire']); if (m) hitPlayer(m.atk * 1.2, m.lvl, m.el, m); G.shake = Math.max(G.shake, 6); return false; } return f.t < f.life; }
          if (f.k === 'bomb') { if (f.t < f.follow) { f.x = G.px; f.y = G.py; } if (f.t >= f.dur) { Fx.nova(f.x, f.y - 20, f.r, [m.el || 'fire', 'fire']); if (Math.hypot(G.px - f.x, G.py - f.y) < f.r) hitPlayer(m.atk * 1.8, m.lvl, m.el, m); G.shake = Math.max(G.shake, 9); return false; } return true; }
          if (f.k === 'barrage') { if (f.t >= f.dur) { hitPlayer(m.atk * 0.9, m.lvl, m.el, m); G.flash = 0.35; G.shake = 12; for (let i = 0; i < 10; i++) Fx.nova(G.px + rand(-W / 2, W / 2), G.py + rand(-H / 2, H / 2), 60, [m.el || 'fire', 'fire']); return false; } return true; }
          if (f.k === 'wall') { G.shots.forEach(s => { if (s.mine && s.life > 0 && segDist(s.x, s.y, f.x - Math.cos(f.a) * f.L / 2, f.y - Math.sin(f.a) * f.L / 2, f.a, f.L) < 16) { s.life = 0; Fx.nova(s.x, s.y, 20, ['wind', 'wind']); } }); return f.t < f.dur; }
          if (f.k === 'realm') { const dx = G.px - f.x, dy = G.py - f.y, d = Math.hypot(dx, dy); if (d > f.r - 16) { G.px = f.x + dx / d * (f.r - 16); G.py = f.y + dy / d * (f.r - 16); } m.skCd = Math.min(m.skCd, 1.2); return f.t < f.dur; }
          return false;
        });
        G.bfx = kept.concat(G.bfx);
        G.mons.forEach(q => { if (q.isClone && !q.dead && (q.cloneT -= dt) <= 0) { q.dead = true; Fx.death(q.x, q.y - 40, q.def.colors, false); } if (q.inv2 > 0) q.inv2 -= dt; });
      }
      function drawBossFx(c, now) {   // 바닥 표시 + 기술 예고선
        G.bfx.forEach(f => {
          c.save();
          if (drawBossFx2(c, f, now)) { c.restore(); return; }
          if (f.k === 'whirl') { const k = Math.min(1, f.t / f.warn); c.globalAlpha = 0.25 + 0.3 * k; c.strokeStyle = '#3BA8F5'; c.fillStyle = 'rgba(59,168,245,0.18)'; c.lineWidth = 3; c.beginPath(); c.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, Math.PI * 2); c.fill(); c.stroke(); if (f.t > f.warn) for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(f.x, f.y, f.r * (0.25 + i * 0.2), f.r * 0.6 * (0.25 + i * 0.2), 0, now / 200 + i, now / 200 + i + 4); c.stroke(); } }
          else if (f.k === 'mine') { const on = f.t > f.arm, bl = on && Math.floor(now / 250) % 2; c.fillStyle = '#1D2340'; c.beginPath(); c.arc(f.x, f.y - 6, 11, 0, Math.PI * 2); c.fill(); c.fillStyle = bl ? '#FF4A3A' : '#FFD23F'; c.beginPath(); c.arc(f.x, f.y - 6, 4, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#FFD23F'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; c.beginPath(); c.moveTo(f.x + Math.cos(a) * 11, f.y - 6 + Math.sin(a) * 11); c.lineTo(f.x + Math.cos(a) * 16, f.y - 6 + Math.sin(a) * 16); c.stroke(); } }
          else if (f.k === 'bomb') { const left = Math.max(0, f.dur - f.t); if (f.t >= f.follow) Fx.slamWarn(c, f.x, f.y, f.r, Math.min(1, (f.t - f.follow) / (f.dur - f.follow)), now); c.font = 'bold 22px "Jua", sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#1D2340'; c.fillStyle = '#FF4A3A'; const tx = f.t < f.follow ? G.px : f.x, ty = (f.t < f.follow ? G.py : f.y) - 88; c.strokeText('💣 ' + left.toFixed(1), tx, ty); c.fillText('💣 ' + left.toFixed(1), tx, ty); }
          else if (f.k === 'barrage') { const n = Math.ceil(f.dur - f.t); c.setTransform(1, 0, 0, 1, 0, 0); c.font = 'bold 64px "Jua", sans-serif'; c.textAlign = 'center'; c.lineWidth = 8; c.strokeStyle = '#1D2340'; c.fillStyle = '#FF4A3A'; c.strokeText(n, W / 2, H * 0.32); c.fillText(n, W / 2, H * 0.32); c.font = 'bold 20px "Jua", sans-serif'; c.lineWidth = 5; c.fillStyle = '#FFD23F'; c.strokeText('전체 폭격이 온다! 체력을 채워 버티세요', W / 2, H * 0.32 + 38); c.fillText('전체 폭격이 온다! 체력을 채워 버티세요', W / 2, H * 0.32 + 38); }
          else if (f.k === 'wall') { const k = Math.min(1, f.t / 0.3) * Math.min(1, (f.dur - f.t) / 0.5); c.globalAlpha = 0.75 * k; c.strokeStyle = '#9AF0B0'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(f.x - Math.cos(f.a) * f.L / 2, f.y - Math.sin(f.a) * f.L / 2); c.lineTo(f.x + Math.cos(f.a) * f.L / 2, f.y + Math.sin(f.a) * f.L / 2); c.stroke(); c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.stroke(); }
          else if (f.k === 'realm') { const k = Math.min(1, f.t / 0.5) * Math.min(1, (f.dur - f.t) / 0.5); c.globalAlpha = 0.6 * k; c.fillStyle = '#140A24'; c.beginPath(); c.rect(f.x - 3000, f.y - 3000, 6000, 6000); c.arc(f.x, f.y, f.r, 0, Math.PI * 2, true); c.fill('evenodd'); c.globalAlpha = k; c.strokeStyle = '#B07AFF'; c.lineWidth = 4; c.beginPath(); c.arc(f.x, f.y, f.r, 0, Math.PI * 2); c.stroke(); }
          c.restore();
        });
        G.mons.forEach(m => { if (!m.dead) drawMonFx2(c, m, now); });
        G.mons.forEach(m => { const q = m.cast; if (!q || m.dead) return; c.save();
          if (q.k === 'laser' || q.k === 'hook') { const fire = q.k === 'laser' ? q.t >= 0.95 : q.t >= 0.6, ex = q.x + Math.cos(q.a) * q.L, ey = q.y + Math.sin(q.a) * q.L;
            c.lineCap = 'round'; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(ex, ey);
            if (!fire) { c.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(now / 90)); c.strokeStyle = q.k === 'laser' ? '#FF4A3A' : '#FFD23F'; c.lineWidth = q.k === 'laser' ? q.w * 2 : 8; c.stroke(); }
            else if (q.k === 'laser') { c.globalAlpha = 0.9; c.strokeStyle = Fx.pal(m.el || 'fire')[1] || '#FF9A3D'; c.lineWidth = q.w * 2; c.stroke(); c.strokeStyle = '#FFFFFF'; c.lineWidth = q.w * 0.7; c.stroke(); }
            else { c.strokeStyle = '#B0B8C8'; c.lineWidth = 5; c.setLineDash([10, 6]); c.stroke(); } }
          if (q.k === 'gaze' && q.t < 1.2) { const y = m.y - m.spr.h - 50; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('👁', m.x, y); c.font = 'bold 16px "Jua", sans-serif'; c.lineWidth = 4; c.strokeStyle = '#1D2340'; c.fillStyle = '#C8A8FF'; c.strokeText('등을 돌려요!', m.x, y + 26); c.fillText('등을 돌려요!', m.x, y + 26); }
          c.restore(); });
      }
      /* ================= v173 보스 기술 사전 (선생님 11/21: 쉬움·보통만 미리 준비 · 아직 보스에 안 붙임) =================
       *  쓰는 법: data.js 보스의 skills 에 아래 이름을 넣으면 됨. 패시브는 def 에 표시 (egg · stack · phase2)
       *  나중에 넣기로 한 것(만들지 않음): 반격 자세 · 움직이면/멈추면 피해 · 수호 토템 · 처형 · 벽 세우기
       *  상태 이상: 기절 stun · 둔화 slow · 속박 root(못 움직임, 공격 됨) · 침묵 silence(마법 못 씀) · 공포 fear(반대로 도망, 아무것도 못 함)
       *  수업용 규칙: 움직임 막는 것(기절·속박·공포)은 2초까지 + 풀린 뒤 1초 면역 */
      const CC_TXT = { stun: ['기절!', '#FFE45C'], slow: ['느려짐!', '#3BA8F5'], root: ['속박!', '#9AF0B0'], silence: ['침묵!', '#C8A8FF'], fear: ['공포!', '#FF8A8E'], air: ['공중에 떴다!', '#FFFFFF'] };
      function pCC(k, dur, src) {
        if (G.dead) return false; const P = G.pst || (G.pst = {}); dur = Math.min(dur, 2.0);
        if (k === 'air') { k = 'stun'; P.air = Math.min(dur, 0.8); }
        if (k === 'stun' || k === 'root' || k === 'fear') { if ((P.ccImm || 0) > 0) return false; P.ccImm = dur + 1; }
        P[k] = Math.max(P[k] || 0, dur); if (k === 'fear' && src) P.fearSrc = { x: src.x, y: src.y };
        const t = CC_TXT[P.air > 0 && k === 'stun' ? 'air' : k]; if (t) G.texts.push({ x: G.px, y: G.py - 82, text: t[0], color: t[1], t: 0 });
        return true;
      }
      // 보스 탄 (효과 붙이기): ex = { onHit, upd, r, life, color }
      function eShot(m, x, y, a, sp, k, ex) { const E = ELEM[m.el || 'earth']; const s = Object.assign({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2.4, dmg: m.atk * k, lvl: m.lvl, r: 7, color: E.color, color2: E.light, mine: false, monEl: 'dark', el: m.el || 'earth', src: m }, ex || {}); G.shots.push(s); return s; }
      // 바닥 예고 → 터짐: shape circle · donut(r2 안쪽 안전) · rect(a 방향 길이 L 폭 w) · sector(a ± sp) · inv(원 밖 전부)
      function zone(m, z) { G.bfx.push(Object.assign({ k: 'zone', m, t: 0, warn: 0.9, dmgK: 1.4, shape: 'circle' }, z)); }
      function inZone(z, x, y) {
        const dx = x - z.x, dy = y - z.y, d = Math.hypot(dx, dy);
        if (z.shape === 'circle') return d < z.r;
        if (z.shape === 'donut') return d < z.r && d > z.r2;
        if (z.shape === 'inv') return d > z.r;
        if (z.shape === 'sector') { let da = Math.atan2(dy, dx) - z.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; return d < z.r && Math.abs(da) < z.sp; }
        if (z.shape === 'rect') { const ca = Math.cos(z.a), sa = Math.sin(z.a), u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return u > -z.w / 2 && u < z.L && Math.abs(v) < z.w / 2; }
        return false;
      }
      function drawZoneShape(c, z) {
        c.beginPath();
        if (z.shape === 'circle') c.ellipse(z.x, z.y, z.r, z.r * 0.62, 0, 0, Math.PI * 2);
        else if (z.shape === 'donut') { c.ellipse(z.x, z.y, z.r, z.r * 0.62, 0, 0, Math.PI * 2); c.ellipse(z.x, z.y, z.r2, z.r2 * 0.62, 0, 0, Math.PI * 2, true); }
        else if (z.shape === 'inv') { c.rect(z.x - 3000, z.y - 3000, 6000, 6000); c.ellipse(z.x, z.y, z.r, z.r * 0.62, 0, 0, Math.PI * 2, true); }
        else if (z.shape === 'sector') { c.moveTo(z.x, z.y); c.ellipse(z.x, z.y, z.r, z.r * 0.62, 0, z.a - z.sp, z.a + z.sp); c.closePath(); }
        else if (z.shape === 'rect') { c.save(); c.translate(z.x, z.y); c.rotate(z.a); c.rect(-z.w / 2, -z.w / 2, z.L + z.w / 2, z.w); c.restore(); }
      }
      // 강제로 밀기: 벽에 부딪히면 wallStun 초 기절 (벽꿍)
      function knock(a, dist, wallStun) { G.bfx.push({ k: 'push', t: 0, a, left: dist, wallStun: wallStun || 0 }); }
      const PASSIVE = ['egg', 'stack'];
      function lunge(m) { const a = Math.atan2(G.py - m.y, G.px - m.x), d = Math.hypot(G.px - m.x, G.py - m.y), go = Math.max(0, Math.min(220, d - 80)); for (let i = 0; i < 10; i++) { const nx = m.x + Math.cos(a) * go / 10, ny = m.y + Math.sin(a) * go / 10; if (!canStand(G.map, nx, ny)) break; m.x = nx; m.y = ny; } Fx.dust(m.x, m.y, '#FF8A6A'); }   // 걷어차기 전에 휙 다가옴
      function newSkill2(m, k, a0, big) {
        const cx = m.x, cy = m.y - m.spr.h / 2, pa = Math.atan2(G.py - 24 - cy, G.px - cx), R = big ? 1.25 : 1;
        switch (k) {
          // ── 투사체 ──
          case 'snipe': m.cast = { k: 'laser', t: 0, a: a0, x: cx, y: cy, L: 2400, w: 22, fast: true }; return true;   // 4 화면 끝 저격 (예고 1초 → 빠른 직선)
          case 'boomer': for (let i = -1; i <= 1; i++) eShot(m, cx, cy, pa + i * 0.35, 420, 1.0, { r: 12, life: 2.6, upd: (s, dt) => { s.age = (s.age || 0) + dt; if (s.age > 1.05 && !s.back) { s.back = true; s.vx = -s.vx * 1.1; s.vy = -s.vy * 1.1; } } }); return true;   // 5 부메랑 (돌아올 때 또 맞음)
          case 'bounce': { let n = 0; const go = (x, y, a) => eShot(m, x, y, a, 380, 1.1, { r: 11, onHit: s => { if (++n < 4) { const t = G.mons.filter(q => !q.dead && q !== m).sort((p, q) => Math.hypot(p.x - G.px, p.y - G.py) - Math.hypot(q.x - G.px, q.y - G.py))[0]; if (t) G.bfx.push({ k: 'later', t: 0, at: 0.5, fn: () => { go(t.x, t.y - 30, Math.atan2(G.py - 24 - (t.y - 30), G.px - t.x)); } }); } } }); go(cx, cy, pa); return true; }   // 6 튕기는 불덩이 (근처 졸개에서 다시 날아옴)
          case 'homing': for (let i = 0; i < (big ? 3 : 2); i++) eShot(m, cx, cy, pa + (i - 0.5) * 1.2, 170, 1.0, { r: 13, life: 3.2, upd: (s, dt) => { const ta = Math.atan2(G.py - 24 - s.y, G.px - s.x), ca = Math.atan2(s.vy, s.vx); let da = ta - ca; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; const na = ca + Math.max(-1.6 * dt, Math.min(1.6 * dt, da)), v = Math.hypot(s.vx, s.vy); s.vx = Math.cos(na) * v; s.vy = Math.sin(na) * v; } }); return true;   // 7 유도탄 (천천히 따라옴)
          case 'split': eShot(m, cx, cy, pa, 300, 0.9, { r: 14, life: 0.8, upd: (s, dt) => { if (s.life - dt <= 0 && !s.done) { s.done = true; const n = big ? 7 : 5; for (let i = 0; i < n; i++) eShot(m, s.x, s.y, Math.atan2(s.vy, s.vx) + (i - (n - 1) / 2) * 0.32, 340, 0.8); } } }); return true;   // 8 분열탄
          case 'orb': eShot(m, cx, cy, pa, 150, 1.6, { r: 26, life: 3.6, onHit: () => pCC('stun', 1.2, m) }); return true;   // 9 느린 큰 구체 (맞으면 기절)
          case 'spiral': G.bfx.push({ k: 'spiral', m, t: 0, dur: 2.4, tick: 0, a: Math.random() * 6.28, dir: Math.random() < 0.5 ? 1 : -1 }); m.cast = { k: 'hold', t: 0, end: 2.4 }; return true;   // 10 회전 나선탄
          case 'volley': G.bfx.push({ k: 'volley', m, t: 0, dur: 2.0, tick: 0, a: pa }); m.cast = { k: 'hold', t: 0, end: 2.0 }; return true;   // 11 연발 사격 (한 방향)
          case 'web': for (let i = -1; i <= 1; i += 2) eShot(m, cx, cy, pa + i * 0.12, 460, 0.7, { r: 10, color: '#9AF0B0', onHit: () => pCC('root', 1.5, m) }); return true;   // 12 거미줄탄 (속박)
          case 'hush': eShot(m, cx, cy, pa, 420, 0.8, { r: 12, color: '#C8A8FF', onHit: () => pCC('silence', 2, m) }); return true;   // 13 침묵탄
          case 'scare': for (let i = -1; i <= 1; i++) eShot(m, cx, cy, pa + i * 0.25, 380, 0.6, { r: 10, color: '#FF8A8E', onHit: () => pCC('fear', 1.4, m) }); return true;   // 14 공포탄 (매혹 대신)
          case 'harpoon': m.cast = { k: 'hook', t: 0, a: a0, x: cx, y: cy, L: 620, both: true }; return true;   // 16 작살 (맞으면 보스도 다가옴)
          // ── 바닥 범위 ──
          case 'donut': zone(m, { shape: 'donut', x: m.x, y: m.y, r: 300 * R, r2: 95, warn: 1.0, dmgK: 1.5 }); return true;   // 19 도넛 (보스 가까이가 안전)
          case 'cage': G.bfx.push({ k: 'cage', m, x: G.px, y: G.py, r: 150, t: 0, warn: 0.7, dur: 3.5 }); return true;   // 20 고리 감옥 (테두리 닿으면 기절)
          case 'cross': { const x = G.px, y = G.py, a = Math.random() < 0.5 ? 0 : Math.PI / 4; for (let i = 0; i < 4; i++) zone(m, { shape: 'rect', x, y, a: a + i * Math.PI / 2, L: 520, w: 60 * R, warn: 1.0, dmgK: 1.4 }); return true; }   // 21 십자·X자
          case 'chain': { const n = 6; for (let i = 0; i < n; i++) zone(m, { x: cx + Math.cos(pa) * (90 + i * 95), y: m.y + Math.sin(pa) * (90 + i * 95), r: 80 * R, warn: 0.6 + i * 0.22, dmgK: 1.2 }); return true; }   // 22 차례 폭발 줄
          case 'meteor': zone(m, { x: G.px, y: G.py, r: 230 * R, warn: 1.8, dmgK: 2.4, big: true }); return true;   // 23 운석 낙하
          case 'poison': G.bfx.push({ k: 'field', sub: 'poison', m, x: G.px, y: G.py, r: 120 * R, t: 0, dur: 6, tick: 0 }); return true;   // 24 독 장판
          case 'swamp': G.bfx.push({ k: 'field', sub: 'swamp', m, x: G.px, y: G.py, r: 150 * R, t: 0, dur: 6, tick: 0 }); return true;   // 25 늪 (느려짐)
          case 'ice': G.bfx.push({ k: 'field', sub: 'ice', m, x: G.px, y: G.py, r: 190 * R, t: 0, dur: 7, tick: 0 }); return true;   // 26 얼음 (미끄러짐)
          case 'safe': { let sx = G.px, sy = G.py; for (let i = 0; i < 20; i++) { const a = Math.random() * 6.28, d = rand(180, 320), x = G.px + Math.cos(a) * d, y = G.py + Math.sin(a) * d * 0.7; if (canStand(G.map, x, y)) { sx = x; sy = y; break; } } zone(m, { shape: 'inv', x: sx, y: sy, r: 85, warn: 2.6, dmgK: 1.8, big: true, safe: true }); return true; }   // 31 안전지대 하나
          case 'tentacle': for (let i = 0; i < (big ? 3 : 2); i++) G.bfx.push({ k: 'later', t: 0, at: i * 0.7, fn: () => zone(m, { x: G.px, y: G.py, r: 70, warn: 0.8, dmgK: 1.3, eff: ['air', 0.6], tent: true }) }); return true;   // 32 땅속 촉수 (발밑)
          case 'sweep': zone(m, { shape: 'sector', x: m.x, y: m.y, a: Math.atan2(G.py - m.y, G.px - m.x), sp: Math.PI / 2, r: 260 * R, warn: 0.8, dmgK: 1.5 }); return true;   // 33 반원 휩쓸기
          case 'spin': G.bfx.push({ k: 'spin', m, t: 0, dur: 3, r: 150 * R, tick: 0 }); return true;   // 34 회전 칼날 (보스 둘레 3초)
          // ── 이동기 ──
          case 'leap': m.cast = { k: 'leap', t: 0, tx: G.px, ty: G.py }; m.inv2 = 1.05; m.hidden = true; return true;   // 38 도약 착지 (그림자 예고 → 띄움)
          case 'burrow': m.cast = { k: 'burrow', t: 0 }; m.hidden = true; m.inv2 = 1.9; Fx.dust(m.x, m.y, 'rgba(176,122,69,.9)'); return true;   // 39 땅굴
          case 'stealth': m.stealth = 3; m.spdB = m.spdB || m.spd; m.spd = m.spdB * 1.4; return true;   // 40 투명 접근 (발자국)
          case 'tele': { let p = null; for (let i = 0; i < 20 && !p; i++) { const a = Math.random() * 6.28, d = rand(140, 380), x = G.px + Math.cos(a) * d, y = G.py + Math.sin(a) * d * 0.7; if (canStand(G.map, x, y)) p = { x, y }; } if (!p) return false; zone(m, { x: p.x, y: p.y, r: 130 * R, warn: 1.3, dmgK: 1.4, tele: true }); return true; }   // 41 맵 아무 곳 순간이동
          case 'kick': lunge(m); m.cast = { k: 'kick', t: 0, a: Math.atan2(G.py - m.y, G.px - m.x), dist: 300, ws: 1.0 }; return true;   // 42 걷어차기 (멀리 날림)
          case 'bash': lunge(m); m.cast = { k: 'kick', t: 0, a: Math.atan2(G.py - m.y, G.px - m.x), dist: 190, ws: 1.6 }; return true;   // 43 벽꿍 (벽에 닿으면 오래 기절)
          case 'headbutt': { const a = Math.atan2(G.py - m.y, G.px - m.x), v = 520; m.cast = { k: 'charge', t: 0.3, a, vx: Math.cos(a) * v, vy: Math.sin(a) * v, air: true }; return true; }   // 44 박치기 (띄움)
          // ── 소환 ──
          case 'turret': for (let i = 0; i < (big ? 3 : 2); i++) { const a = Math.random() * 6.28, x = G.px + Math.cos(a) * 220, y = G.py + Math.sin(a) * 150; if (!canStand(G.map, x, y)) continue; const q = makeMon({ name: '포탑', img: m.def.img, h: 40, el: m.el, kind: 'shoot', shape: 'golem', colors: m.def.colors }, Math.max(1, m.lvl - 5), false); q.x = q.hx = x; q.y = q.hy = y; q.spd = 0; q.noRespawn = true; q.turret = 10; q.max = q.hp = Math.round(q.max * 2); q.aggro = true; G.mons.push(q); } return true;   // 47 포탑 (10초)
          case 'phalanx': G.bfx.push({ k: 'phalanx', m, t: 0, dur: 3.2, a: pa, x: cx - Math.cos(pa) * 40, y: m.y - Math.sin(pa) * 40, L: 520, hit: false }); return true;   // 49 병사 벽 돌격 (밀어냄)
          case 'shadow': { const x = G.px + rand(-260, 260), y = G.py + rand(-160, 160); if (!canStand(G.map, x, y)) return false; m.shadow = { x, y, t: 7 }; Fx.nova(x, y - 40, 60, ['dark', 'dark']); return true; }   // 50 그림자 (7초 동안 부채·링을 같이 씀)
          case 'healer': for (let i = 0; i < 2; i++) { const x = m.x + (i ? 160 : -160), y = m.y + 40; if (!canStand(G.map, x, y)) continue; const q = makeMon({ name: '회복 정령', img: m.def.img, h: 50, el: 'light', kind: 'aggro', shape: 'slime', colors: { a: '#9AF0B0', b: '#3DDC84', c: '#FFFFFF', d: '#FFFFFF' } }, m.lvl, false); q.x = q.hx = x; q.y = q.hy = y; q.spd = 40; q.noRespawn = true; q.healer = m; q.healT = 1.5; q.aggro = true; G.mons.push(q); } return true;   // 52 회복 정령
          case 'orbit': G.bfx.push({ k: 'orbit', m, t: 0, dur: 6, a: 0, cd: 0 }); return true;   // 53 도는 위성 공
          // ── 방어 ──
          case 'shieldup': m.shieldHp = Math.round(m.max * 0.12); m.shieldT = 6; float(m.x, m.y - m.spr.h - 40, '보호막!', '#FFD23F', true); return true;   // 56 보호막 (먼저 깨야 함)
          case 'guard': m.guard = { t: 4, a: Math.atan2(G.py - m.y, G.px - m.x) }; return true;   // 57 방패 들기 (앞쪽 공격 막음 → 옆·뒤로)
          case 'rewind': { if (m.rewound || !m.hist || m.hist.length < 10) return false; const h = m.hist[0]; m.rewound = true; Fx.nova(m.x, m.y - 40, 90, ['light', 'light']); m.x = h.x; m.y = h.y; m.hp = Math.max(m.hp, h.hp); Fx.nova(m.x, m.y - 40, 90, ['light', 'light']); float(m.x, m.y - m.spr.h - 40, '시간을 되돌렸다!', '#FFD23F', true); return true; }   // 60 되감기 (3초 전 위치·피 · 한 번)
          case 'drain': m.drainT = 6; float(m.x, m.y - m.spr.h - 40, '흡혈!', '#FF4A3A', true); return true;   // 61 흡혈 (6초 동안 맞히면 회복)
          case 'bloodpool': m.inv2 = 2; m.poolT = 2; m.spdB = m.spdB || m.spd; m.spd = m.spdB * 1.3; return true;   // 62 피 웅덩이 (2초 무적·빠르게)
          // ── 공간·조건 ──
          case 'dark': G.bfx.push({ k: 'dark', m, t: 0, dur: 4.5 }); return true;   // 65 어둠 (시야 좁아짐)
          case 'deathmark': G.bfx.push({ k: 'dmark', m, t: 0, dur: 3, acc: 0 }); return true;   // 66 데스마크 (3초 동안 받은 피해만큼 마지막에 더)
          case 'mend': G.mons.forEach(q => { if (!q.dead && q !== m && !q.boss) { q.hp = q.max; Fx.nova(q.x, q.y - 30, 40, ['light', 'light']); } }); m.hp = Math.min(m.max, m.hp + Math.round(m.max * 0.05)); return true;   // 74 부하 모두 회복
        }
        return false;
      }
      function newCastTick2(m, c, dt) {
        if (c.k === 'hold') { if (c.t >= c.end) m.cast = null; return true; }
        if (c.k === 'leap') { if (c.t >= 1.0 && !c.done) { c.done = true; m.hidden = false; if (canStand(G.map, c.tx, c.ty)) { m.x = c.tx; m.y = c.ty; } const z = { shape: 'circle', x: m.x, y: m.y, r: 140 }; if (inZone(z, G.px, G.py)) { hitPlayer(m.atk * 1.6, m.lvl, m.el, m); pCC('air', 0.8, m); } Fx.nova(m.x, m.y - 10, 140, [m.el || 'earth', 'earth']); G.shake = Math.max(G.shake, 10); } if (c.t >= 1.3) m.cast = null; return true; }
        if (c.k === 'burrow') { if (c.t < 1.4) { if (Math.floor(c.t * 10) !== Math.floor((c.t - dt) * 10)) Fx.dust(G.px + rand(-20, 20), G.py, 'rgba(176,122,69,.9)'); c.tx = G.px; c.ty = G.py; } else if (!c.done) { c.done = true; zone(m, { x: c.tx, y: c.ty, r: 105, warn: 0.5, dmgK: 1.5, eff: ['air', 0.6], pop: true }); } if (c.t >= 2.0) { m.hidden = false; if (canStand(G.map, c.tx, c.ty)) { m.x = c.tx; m.y = c.ty; } m.cast = null; } return true; }
        if (c.k === 'kick') { if (c.t >= 0.6 && !c.done) { c.done = true; const z = { shape: 'sector', x: m.x, y: m.y, a: c.a, sp: 0.9, r: 190 }; if (inZone(z, G.px, G.py)) { hitPlayer(m.atk * 1.2, m.lvl, m.el, m); knock(Math.atan2(G.py - m.y, G.px - m.x), c.dist, c.ws); } Fx.nova(m.x + Math.cos(c.a) * 80, m.y + Math.sin(c.a) * 50, 60, [m.el || 'earth', 'earth']); } if (c.t >= 0.9) m.cast = null; return true; }
        return false;
      }
      function bfxTick2(f, dt) {   // true/false = 남김/지움 · undefined = 내 것이 아님
        const m = f.m;
        if (f.k === 'later') { if (f.t >= f.at) { if (!m || !m.dead) f.fn(); return false; } return true; }
        if (f.k === 'push') { const step = Math.min(f.left, 900 * dt), nx = G.px + Math.cos(f.a) * step, ny = G.py + Math.sin(f.a) * step; if (!canStand(G.map, nx, ny)) { if (f.wallStun) { G.pst = G.pst || {}; G.pst.ccImm = 0; pCC('stun', f.wallStun); G.shake = 10; float(G.px, G.py - 100, '벽에 쾅!', '#FFD23F'); } return false; } G.px = nx; G.py = ny; f.left -= step; return f.left > 0; }
        if (m && m.dead) return false;
        if (f.k === 'zone') {
          if (f.t >= f.warn && !f.done) { f.done = true; const hit = inZone(f, G.px, G.py);
            if (f.tele) { m.x = f.x; m.y = f.y; Fx.nova(f.x, f.y - 40, 80, [m.el || 'dark', 'dark']); }
            if (hit) { hitPlayer(m.atk * f.dmgK, m.lvl, m.el, m); if (f.eff) pCC(f.eff[0], f.eff[1], m); }
            if (f.shape !== 'inv') Fx.nova(f.x, f.y - 10, Math.min(260, f.r || f.L || 100), [m.el || 'fire', 'fire']); else { G.flash = 0.3; for (let i = 0; i < 8; i++) Fx.nova(G.px + rand(-W / 2, W / 2), G.py + rand(-H / 2, H / 2), 60, [m.el || 'fire', 'fire']); }
            if (f.big) G.shake = Math.max(G.shake, 10); }
          return f.t < f.warn + 0.25;
        }
        if (f.k === 'spiral') { if ((f.tick -= dt) <= 0) { f.tick = 0.11; f.a += 0.38 * f.dir; for (let i = 0; i < 3; i++) eShot(m, m.x, m.y - m.spr.h / 2, f.a + i * 2.094, 260, 0.6, { r: 8 }); } return f.t < f.dur; }
        if (f.k === 'volley') { if ((f.tick -= dt) <= 0) { f.tick = 0.09; eShot(m, m.x, m.y - m.spr.h / 2, f.a + rand(-0.18, 0.18), 520, 0.5, { r: 7 }); } return f.t < f.dur; }
        if (f.k === 'cage') { if (f.t > f.warn) { const d = Math.hypot(G.px - f.x, G.py - f.y); if (Math.abs(d - f.r) < 14 && !f.hit) { f.hit = true; pCC('stun', 1.5, m); hitPlayer(m.atk * 0.8, m.lvl, m.el, m); } } return f.t < f.warn + f.dur; }
        if (f.k === 'field') { const inside = Math.hypot(G.px - f.x, (G.py - f.y) / 0.62) < f.r;
          if (inside && (f.tick -= dt) <= 0) { f.tick = 0.5; if (f.sub === 'poison') hitPlayer(m.atk * 0.35, m.lvl, m.el, m); if (f.sub === 'swamp') pCC('slow', 1.0, m); }
          if (f.sub === 'ice') { if (inside) { if (G.moving) G.slideV = { x: (G.px - (G.lastPx == null ? G.px : G.lastPx)) / Math.max(dt, 0.001), y: (G.py - (G.lastPy == null ? G.py : G.lastPy)) / Math.max(dt, 0.001) }; else if (G.slideV) { const nx = G.px + G.slideV.x * dt, ny = G.py + G.slideV.y * dt; if (canStand(G.map, nx, ny)) { G.px = nx; G.py = ny; } G.slideV.x *= Math.pow(0.35, dt); G.slideV.y *= Math.pow(0.35, dt); } } else G.slideV = null; G.lastPx = G.px; G.lastPy = G.py; }
          return f.t < f.dur; }
        if (f.k === 'spin') { if ((f.tick -= dt) <= 0) { f.tick = 0.4; if (Math.hypot(G.px - m.x, (G.py - m.y) / 0.62) < f.r) hitPlayer(m.atk * 0.5, m.lvl, m.el, m); } return f.t < f.dur; }
        if (f.k === 'phalanx') { const sp = 170, adv = f.t * sp, ox = f.x + Math.cos(f.a) * adv, oy = f.y + Math.sin(f.a) * adv, px = -Math.sin(f.a), py = Math.cos(f.a); f.ox = ox; f.oy = oy;
          if (!f.hit) { const u = (G.px - ox) * Math.cos(f.a) + (G.py - oy) * Math.sin(f.a), v = (G.px - ox) * px + (G.py - oy) * py; if (Math.abs(u) < 22 && Math.abs(v) < f.L / 2) { f.hit = true; hitPlayer(m.atk * 1.0, m.lvl, m.el, m); knock(f.a, 200, 0.8); } }
          return f.t < f.dur; }
        if (f.k === 'orbit') { f.a += dt * 2.6; const x = m.x + Math.cos(f.a) * 150, y = m.y - 20 + Math.sin(f.a) * 95; f.ox = x; f.oy = y; if ((f.cd -= dt) <= 0 && Math.hypot(G.px - x, G.py - 20 - y) < 34) { f.cd = 1; hitPlayer(m.atk * 0.9, m.lvl, m.el, m); Fx.nova(x, y, 40, [m.el || 'light', 'light']); } return f.t < f.dur; }
        if (f.k === 'dark') return f.t < f.dur;
        if (f.k === 'dmark') { if (f.t >= f.dur) { const d = Math.round(f.acc * 1.0 + m.atk * 0.5); G.dmark = null; hitPlayer(d, m.lvl, m.el, m); Fx.nova(G.px, G.py - 30, 70, ['dark', 'dark']); float(G.px, G.py - 100, '데스마크 폭발!', '#FF4A3A'); return false; } G.dmark = f; return true; }
        return undefined;
      }
      function monTick2(m, dt) {   // 보스·소환물 매 프레임 (true = 이번 프레임 행동 끝)
        if (m.hist !== undefined || (m.def.skills || []).includes('rewind')) { m.histT = (m.histT || 0) - dt; if (m.histT <= 0) { m.histT = 0.25; (m.hist = m.hist || []).push({ x: m.x, y: m.y, hp: m.hp }); if (m.hist.length > 12) m.hist.shift(); } }
        if (m.eggT > 0) { m.eggT -= dt; if (m.eggT <= 0) { m.hp = Math.round(m.max * 0.5); float(m.x, m.y - m.spr.h - 30, '알에서 다시 태어났다!', '#FF9A3D', true); Fx.nova(m.x, m.y - 40, 120, ['fire', 'light']); } return true; }
        if (m.hidden) return true;
        if (m.stealth > 0) { m.stealth -= dt; if (Math.floor(m.stealth * 4) !== Math.floor((m.stealth + dt) * 4)) Fx.dust(m.x, m.y, 'rgba(255,255,255,.7)'); if (m.stealth <= 0 || Math.hypot(G.px - m.x, G.py - m.y) < 70) { m.stealth = 0; m.spd = m.spdB || m.spd; m.slam = { t: 0.3, x: m.x, y: m.y - 20 }; m.slamRo = 110; } }
        if (m.poolT > 0) { m.poolT -= dt; if (m.poolT <= 0) m.spd = m.spdB || m.spd; }
        if (m.shieldT > 0) { m.shieldT -= dt; if (m.shieldT <= 0) m.shieldHp = 0; }
        if (m.guard) { m.guard.t -= dt; if (m.guard.t <= 0) m.guard = null; }
        if (m.drainT > 0) m.drainT -= dt;
        if (m.shadow) { m.shadow.t -= dt; if (m.shadow.t <= 0) m.shadow = null; }
        if (m.turret) { m.turret -= dt; if (m.turret <= 0) { m.dead = true; m.noRespawn = true; Fx.death(m.x, m.y - 20, m.def.colors, false); return true; } }
        if (m.healer) { if (m.healer.dead) { m.dead = true; return true; } if ((m.healT -= dt) <= 0) { m.healT = 1.5; const b = m.healer; b.hp = Math.min(b.max, b.hp + Math.round(b.max * 0.025)); m.beam = 0.4; float(b.x, b.y - b.spr.h - 20, '+회복', '#3DDC84'); } if (m.beam > 0) m.beam -= dt; }
        if (m.def.phase2 && !m.ph2 && m.hp <= m.max * (m.def.phase2.at || 0.5)) { m.ph2 = true; m.skl = m.def.phase2.skills; m.inv2 = 1.5; G.title = { t: 0, text: m.name + ' 2단계!', sub: m.def.phase2.say || '모습이 바뀌었다! 새로운 기술을 쓴다' }; G.flash = 0.4; G.shake = 12; Fx.nova(m.x, m.y - 40, 160, [m.el || 'dark', 'dark']); }   // 71 2페이즈 변신
        return false;
      }
      // 보스가 맞을 때 (보호막·방패) — 남은 피해를 돌려줌
      function monGuard(m, dmg) {
        if (m.guard) { const a = Math.atan2(G.py - m.y, G.px - m.x), fa = m.guard.a != null ? m.guard.a : (m.guard.a = a); let da = a - fa; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; if (Math.abs(da) < 1.05) { immTxt(m, '방패로 막았다!', '#FFD23F'); return 0; } }
        if (m.shieldHp > 0) { const k = Math.min(m.shieldHp, dmg); m.shieldHp -= k; dmg -= k; if (m.shieldHp <= 0) { m.shieldT = 0; float(m.x, m.y - m.spr.h - 30, '보호막이 깨졌다!', '#FFD23F', true); } }
        return dmg;
      }
      function drawBossFx2(c, f, now) {
        if (f.k === 'zone') { const k = Math.min(1, f.t / f.warn); c.globalAlpha = 0.25 + 0.4 * k; c.fillStyle = f.safe ? 'rgba(255,74,58,.35)' : 'rgba(255,74,58,.28)'; c.strokeStyle = '#FF4A3A'; c.lineWidth = 3; drawZoneShape(c, f); c.fill('evenodd'); c.stroke();
          if (f.safe) { c.globalAlpha = 1; c.strokeStyle = '#3DDC84'; c.lineWidth = 5; c.beginPath(); c.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, Math.PI * 2); c.stroke(); c.font = 'bold 18px "Jua", sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#1D2340'; c.fillStyle = '#3DDC84'; c.strokeText('여기로!', f.x, f.y - 10); c.fillText('여기로!', f.x, f.y - 10); }
          if (f.shape === 'circle' && !f.safe) { c.globalAlpha = 0.6; c.fillStyle = 'rgba(255,210,63,.45)'; c.beginPath(); c.ellipse(f.x, f.y, f.r * k, f.r * 0.62 * k, 0, 0, Math.PI * 2); c.fill(); } return true; }
        if (f.k === 'cage') { const on = f.t > f.warn; c.globalAlpha = on ? 0.9 : 0.4; c.strokeStyle = '#B07AFF'; c.lineWidth = on ? 10 : 4; c.beginPath(); c.arc(f.x, f.y, f.r, 0, Math.PI * 2); c.stroke(); if (on) { c.strokeStyle = '#FFFFFF'; c.lineWidth = 2; c.stroke(); } return true; }
        if (f.k === 'field') { const col = { poison: ['rgba(140,220,60,.32)', '#8CDC3C'], swamp: ['rgba(90,70,40,.38)', '#7A5A2A'], ice: ['rgba(154,230,255,.35)', '#9AE6FF'] }[f.sub]; const fade = Math.min(1, (f.dur - f.t) / 0.6); c.globalAlpha = fade; c.fillStyle = col[0]; c.strokeStyle = col[1]; c.lineWidth = 2; c.beginPath(); c.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, Math.PI * 2); c.fill(); c.stroke(); return true; }
        if (f.k === 'spin') { c.globalAlpha = 0.5; c.strokeStyle = '#FFFFFF'; c.lineWidth = 4; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(f.m.x, f.m.y, f.r, f.r * 0.62, 0, now / 120 + i * 2.1, now / 120 + i * 2.1 + 0.9); c.stroke(); } return true; }
        if (f.k === 'phalanx' && f.ox != null) { const px = -Math.sin(f.a), py = Math.cos(f.a); for (let i = -5; i <= 5; i++) { const x = f.ox + px * i * f.L / 11, y = f.oy + py * i * f.L / 11; c.globalAlpha = 1; c.fillStyle = '#5A3A22'; c.fillRect(x - 8, y - 34, 16, 30); c.fillStyle = '#C0A060'; c.fillRect(x - 10, y - 40, 20, 8); c.strokeStyle = '#E0E8F0'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x + Math.cos(f.a) * 34, y - 30 + Math.sin(f.a) * 34); c.stroke(); } return true; }
        if (f.k === 'orbit' && f.ox != null) { c.globalAlpha = 1; const g = c.createRadialGradient(f.ox, f.oy, 2, f.ox, f.oy, 24); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, 'rgba(255,210,63,0)'); c.fillStyle = g; c.beginPath(); c.arc(f.ox, f.oy, 24, 0, Math.PI * 2); c.fill(); return true; }
        if (f.k === 'dark') { const k = Math.min(1, f.t / 0.4) * Math.min(1, (f.dur - f.t) / 0.4); c.globalAlpha = 0.92 * k; c.fillStyle = '#05060F'; c.beginPath(); c.rect(G.px - 3000, G.py - 3000, 6000, 6000); c.arc(G.px, G.py - 24, 170, 0, Math.PI * 2, true); c.fill('evenodd'); return true; }
        if (f.k === 'dmark') { c.globalAlpha = 1; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('☠', G.px, G.py - 104); c.font = 'bold 14px "Jua", sans-serif'; c.lineWidth = 3; c.strokeStyle = '#1D2340'; c.fillStyle = '#FF4A3A'; const t = '데스마크 ' + Math.max(0, f.dur - f.t).toFixed(1); c.strokeText(t, G.px, G.py - 128); c.fillText(t, G.px, G.py - 128); return true; }
        return false;
      }
      function drawMonFx2(c, m, now) {   // 보스 위에 그리는 것 (보호막·방패·알·그림자·회복 줄·도약 그림자)
        c.save();
        if (m.shieldHp > 0) { c.globalAlpha = 0.45 + 0.15 * Math.sin(now / 150); c.strokeStyle = '#FFD23F'; c.fillStyle = 'rgba(255,210,63,.12)'; c.lineWidth = 4; c.beginPath(); c.ellipse(m.x, m.y - m.spr.h / 2, m.spr.w * 0.45 + 20, m.spr.h * 0.55 + 10, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
        if (m.guard) { const fa = m.guard.a != null ? m.guard.a : Math.atan2(G.py - m.y, G.px - m.x); c.globalAlpha = 0.85; c.strokeStyle = '#C0C8D8'; c.lineWidth = 10; c.beginPath(); c.arc(m.x, m.y - m.spr.h / 2, m.spr.w * 0.45 + 18, fa - 1.0, fa + 1.0); c.stroke(); }
        if (m.eggT > 0) { c.globalAlpha = 0.95; c.fillStyle = '#F5E2B8'; c.strokeStyle = '#FF9A3D'; c.lineWidth = 4; c.beginPath(); c.ellipse(m.x, m.y - 60, 55, 70, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.font = 'bold 16px "Jua", sans-serif'; c.textAlign = 'center'; c.fillStyle = '#FF4A3A'; c.fillText(m.eggT.toFixed(1), m.x, m.y - 55); }
        if (m.shadow) { c.globalAlpha = 0.55; c.fillStyle = '#140A24'; c.beginPath(); c.ellipse(m.shadow.x, m.shadow.y - 50, 28, 55, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#B07AFF'; c.lineWidth = 2; c.stroke(); }
        if (m.healer && m.beam > 0 && !m.healer.dead) { c.globalAlpha = 0.8; c.strokeStyle = '#3DDC84'; c.lineWidth = 4; c.beginPath(); c.moveTo(m.x, m.y - 30); c.lineTo(m.healer.x, m.healer.y - m.healer.spr.h / 2); c.stroke(); }
        if (m.cast && m.cast.k === 'leap' && !m.cast.done) { const k = Math.min(1, m.cast.t / 1.0); c.globalAlpha = 0.35 + 0.4 * k; c.fillStyle = '#1D2340'; c.beginPath(); c.ellipse(m.cast.tx, m.cast.ty, 140 * k, 87 * k, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#FF4A3A'; c.lineWidth = 3; c.beginPath(); c.ellipse(m.cast.tx, m.cast.ty, 140, 87, 0, 0, Math.PI * 2); c.stroke(); }
        c.restore();
      }
      function bossShot(m, a, sp, dmgK) { if (m.shadow) { const sx = m.shadow.x, sy = m.shadow.y - 50, a2 = a + Math.atan2(G.py - 24 - sy, G.px - sx) - Math.atan2(G.py - 24 - (m.y - m.spr.h / 2), G.px - m.x); eShot(m, sx, sy, a2, sp, dmgK); }   // v173 그림자도 같이 쏨
        const E = ELEM[m.el || 'earth']; G.shots.push({ x: m.x, y: m.y - m.spr.h / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 2.2, dmg: m.atk * dmgK, lvl: m.lvl, r: 7, color: E.color, color2: E.light, mine: false, monEl: 'dark', el: m.el || 'earth' }); }
      function bossSkill(m, dt, d) {
        const rage = m.hp < m.max * 0.5, c = m.cast, H = !!m.def.hard;   // v157 H = 사방신·광개토대왕: 마법 준비 빨리 · 쿨타임 반쯤 · 탄 더 많이·빠르게 · 더 멀리서도 씀
        if (c) {
          c.t += dt * (H ? 1.35 : 1);
          if (c.k === 'blades' && c.t >= 1.0) {
            const br = m.def.bladeR || (BIG(m) ? 60 : 46); c.pts.forEach(q => { if (Math.hypot(G.px - q.x, G.py - 20 - q.y) < br) hitPlayer(m.atk * 1.1, m.lvl, m.el, q); Fx.nova(q.x, q.y, br, [m.el || 'earth', 'earth']); });   // v171 칼비 범위 (광개토대왕 bladeR)
            G.shake = Math.max(G.shake, 7); m.cast = null;
          } else if (newCastTick(m, c, dt)) {
          } else if (c.k === 'charge') {
            if (c.t >= 0.7 && c.t < 1.3) { moveMon(m, c.vx * dt, c.vy * dt); Fx.dust(m.x, m.y, '#FF8A6A'); if (!c.hit && Math.hypot(G.px - m.x, G.py - m.y) < m.r + 24) { c.hit = true; hitPlayer(m.atk * 1.6, m.lvl, m.el); if (c.air) pCC('air', 0.7, m); G.shake = Math.max(G.shake, 8); } }
            else if (c.t >= 1.3) { if (c.n > 1) { const a = Math.atan2(G.py - m.y, G.px - m.x), v = Math.hypot(c.vx, c.vy); c.n--; c.t = 0.45; c.hit = false; c.vx = Math.cos(a) * v; c.vy = Math.sin(a) * v; } else m.cast = null; }   // v173 3연속 돌진
          } else if (c.t > 0.6) m.cast = null;
          return;
        }
        m.skCd -= dt * (rage ? 1.5 : 1) * (m.def.aspd || 1);   // v177 이순신 던전 장수·와키자카 공격 속도 1.5배
        if (m.skCd > 0 || d > (H ? 700 : 560) || m.slam || m.isClone && Math.random() < 0.5) return;   // v173 쓰는 거리 460→560 · 620→700
        // v173 체력 단계 패턴: 100~70% 앞의 기본 기술(nb개, 기본 2)만 · 70% 아래 대표 기술까지 · 같은 기술 두 번 연속 안 씀 · 30% 아래 40% 확률로 바로 이어서(연계)
        const hpK = m.hp / m.max, all = m.skl || m.def.skills, nb = m.def.nb || 2; let pool = hpK > 0.7 ? all.slice(0, Math.min(nb, all.length)) : all.slice();
        if (pool.length > 1 && m.lastSk) pool = pool.filter(q => q !== m.lastSk);
        const k = pick(pool); m.lastSk = k; m.skCd = m.def.skCd ? rand(m.def.skCd[0], m.def.skCd[1]) : H ? rand(1.1, 1.6) : rand(2.0, 2.8);   // v173 쿨타임 3.2~4.4→2.0~2.8 · 1.5~2.2→1.1~1.6
        if (hpK < 0.3 && Math.random() < 0.4) m.skCd = Math.min(m.skCd, 0.45);
        float(m.x, m.y - m.spr.h - 26, (rage ? '분노! ' : '') + (SKILL_NAME[k] || k), '#FF8A8E', true);
        const a0 = Math.atan2(G.py - 24 - (m.y - m.spr.h / 2), G.px - m.x), bg = BIG(m);
        if (newSkill(m, k, a0)) return;
        if (k === 'slam') m.slam = { t: 0, x: m.x, y: m.y - 20 };
        else if (k === 'blades') m.cast = { k, t: 0, pts: Array.from({ length: (bg ? (rage ? 9 : 7) : (rage ? 7 : 5)) + (H ? 3 : 0) }, (_, i) => ({ x: G.px + (i ? rand(-120, 120) * (m.def.bladeSpread || 1) : 0), y: G.py - 20 + (i ? rand(-80, 80) * (m.def.bladeSpread || 1) : 0) })) };
        else if (k === 'charge') { const a = Math.atan2(G.py - m.y, G.px - m.x); const v = H ? 580 : 430; m.cast = { k, t: 0, a, vx: Math.cos(a) * v, vy: Math.sin(a) * v }; }   // v157 H 는 준비가 1.35배 빨라 돌진 시간이 짧으니 속도를 올림
        else if (k === 'ring') { const n = (bg ? (rage ? 24 : 16) : (rage ? 18 : 12)) + (H ? 6 : 0); for (let i = 0; i < n; i++) bossShot(m, a0 + i / n * Math.PI * 2, H ? 230 : 190, 0.7); m.cast = { k, t: 0 }; }
        else if (k === 'fan') { const n = (bg ? (rage ? 9 : 7) : (rage ? 7 : 5)) + (H ? 2 : 0); for (let i = 0; i < n; i++) bossShot(m, a0 + (i - (n - 1) / 2) * (H ? 0.17 : 0.2), H ? 300 : 250, 0.8); m.cast = { k, t: 0 }; }
        else if (k === 'summon') {
          const g = D.HELL.gates[(G.map.M.gate || 1) - 1];
          if (G.mons.filter(x => !x.dead && !x.boss).length < 8) for (let i = 0; i < 3; i++) { const x = makeMon(i === 2 && g.mob2 ? g.mob2 : g.mob, m.lvl - 3); x.noRespawn = true; x.x = m.x + rand(-70, 70); x.y = m.y + rand(-40, 40); x.aggro = true; G.mons.push(x); Fx.death(x.x, x.y - 20, x.def.colors, false); }
          m.cast = { k, t: 0 };
        }
      }
      /* v130 저승 웹툰: 관문에 처음 들어가면 4컷(장소 소개 → 옥졸 → 판관 → 대왕이 차례로 자기소개) · 보스가 나올 때 그 보스 한 컷
       *  컷은 2.6초마다 하나씩 내려오고, 화면을 누르거나 Space·Enter 로 바로 다음 컷 · Esc·건너뛰기로 닫기. 보는 동안 게임은 멈춤 */
      let toon = null;
      const TIMG = 'games/action/rpg/img/v79/', ROLE = { guard: '옥졸 · 3단계', judge: '판관 · 4단계', king: '대왕 · 5단계' };
      const toonSay = (g, k, side) => { const d = k === 'king' ? g.boss : g[k]; return { kind: 'say', img: `hell${g.no}_${k}`, name: d.name, role: ROLE[k], text: d.intro || d.say, side, king: k === 'king', col: ELEM[g.el].color }; };
      const gateCuts = g => [{ kind: 'nar', gate: g, col: ELEM[g.el].color, wait: 3200 }, toonSay(g, 'guard', 'l'), toonSay(g, 'judge', 'r'), Object.assign(toonSay(g, 'king', 'l'), { wait: 3400 })];
      function cutHtml(c) {
        if (c.kind === 'pic') return `<div class="tn-cut pic${c.fx ? ' ' + c.fx : ''}"><img src="${TIMG}${c.img}?v=170" alt="">${c.sfx ? `<div class="tn-sfx${c.sfxCls ? ' ' + c.sfxCls : ''}">${c.sfx}</div>` : ''}${c.cap ? `<div class="tn-cap">${c.cap}</div>` : ''}</div>`;   // v170 그림 컷
        if (c.kind === 'nar2') return `<div class="tn-cut nar" style="--c:${c.col};background-image:linear-gradient(rgba(14,6,24,.45),rgba(14,6,24,.8)),url(${TIMG}${c.bg})"><div class="tn-big"><small>${c.small}</small>${c.big}</div><div class="tn-box">${c.text}</div></div>`;
        if (c.kind === 'nar') { const g = c.gate; return `<div class="tn-cut nar" style="--c:${c.col};background-image:linear-gradient(rgba(14,6,24,.5),rgba(14,6,24,.82)),url(${TIMG}hellfloor${g.no}.jpg?v=80)"><div class="tn-big"><small>저승 제${g.no}관문 · ${g.day}</small>${g.hell}</div><div class="tn-box">${g.about}</div></div>`; }
        return `<div class="tn-cut say ${c.side === 'r' ? 'r' : ''}${c.king ? ' king' : ''}" style="--c:${c.col}"><img src="${c.src || TIMG + c.img + '.png?v=80'}" alt="${c.name}"><div class="tn-bub"><span class="tn-nm">${c.name}<small>${c.role}</small></span><p>${c.text}</p></div></div>`;
      }
      /* v170 왕을 죽인 검이 깨어나는 웹툰 (선생님 11/19: 저승 관문 소개처럼) — 광개토대왕의 전당에 그 검을 차고 처음 들어갈 때 (새로고침마다 한 번)
       *  그림 img/v79/toon_sw1~3.jpg (Gemini) · 닫으면 예전 게임 속 변신 연출(머리 위로 떠올라 바뀜)이 이어짐 */
      const swordCuts = () => {
        const av = Hub.user ? Hub.user.avatar : AV.normalize({}), kr = window.GoRPGKingRoom; window.GoRPGKingRoom = false; const me = avatarSprite(av, S.eq, S.hide, 0).toDataURL(); window.GoRPGKingRoom = kr; const nick = Hub.user ? Hub.user.nickname : '나';
        return [
          { kind: 'nar2', bg: 'arena_sx_king.png?v=80', col: '#FFD23F', small: '숨은 던전 · 마지막 방', big: '광개토대왕의 전당', text: '전당 문턱을 넘자, 허리에 찬 낡은 검이 덜덜 떨리기 시작했다…', wait: 3000 },
          { kind: 'pic', img: 'toon_sw1.jpg', fx: 'shake', sfx: '우우웅…', cap: '녹슨 칼날 위로 <b>금빛 금</b>이 번져 간다!', wait: 2800 },
          { kind: 'say', src: me, name: nick, role: '나', text: '검이… 스스로 울고 있어?!', side: 'r', col: '#9AE6FF', wait: 2200 },
          { kind: 'pic', img: 'toon_sw2.jpg', fx: 'flash', sfx: '번쩍!!', sfxCls: 'big l', cap: '녹슨 껍데기가 <b>산산조각</b> 났다!', wait: 2600 },
          { kind: 'pic', img: 'toon_sw3.jpg', sfx: '화르륵', cap: '<b>왕을 죽인 검</b>이 깨어났다! 이 검이라야 대왕에게 피해가 들어가고 상태 이상도 걸려요', wait: 3200 },
          { kind: 'say', img: 'sx_king_idle', name: '광개토대왕', role: '전당의 주인', text: '그 검은… 나를 쓰러뜨렸던 바로 그 검이로구나. 좋다, 덤벼 보거라!', side: 'l', king: true, col: '#FFD23F', wait: 3400 }
        ];
      };
      let swordToonSeen = false;
      function showToon(cuts, opt) {
        if (!toonEl) { if (opt.done) opt.done(); return; }
        if (toon) toonClose(true);
        toon = { cuts, i: 0, opt, t: null }; G.paused = true; G.keys = {}; G.btnDown = {}; G.joy = null;
        toonEl.innerHTML = `<div class="tn-strip"><div class="tn-top"><b>${opt.title}</b><button type="button" class="tn-skip" data-toon="skip">건너뛰기 ▶▶</button></div><div class="tn-list" data-toon="next"></div><div class="tn-hint">화면을 누르면 다음 컷 · Esc 건너뛰기</div><div class="tn-end" hidden><button type="button" class="tn-go" data-toon="go">${opt.go || '⚔ 싸우러 가기'}</button></div></div>`;
        toonEl.classList.toggle('one', cuts.length === 1); toonEl.hidden = false; toonNext();
      }
      function toonNext() {
        if (!toon) return; clearTimeout(toon.t);
        const list = toonEl.querySelector('.tn-list');
        if (toon.i >= toon.cuts.length) { toonEl.querySelector('.tn-end').hidden = false; const hn = toonEl.querySelector('.tn-hint'); if (hn) hn.hidden = true; if (toon.opt.auto) toon.t = setTimeout(() => toonClose(), toon.opt.auto); return; }
        const c = toon.cuts[toon.i++]; list.insertAdjacentHTML('beforeend', cutHtml(c));
        requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
        toon.t = setTimeout(toonNext, c.wait || 2600);
      }
      function toonClose(silent) {
        if (!toon) return; clearTimeout(toon.t); const o = toon.opt; toon = null; toonEl.hidden = true; toonEl.innerHTML = '';
        G.paused = !!pane && !(net && net.joined); G.keys = {};
        if (!silent && o.done) o.done();
      }
      if (toonEl) toonEl.addEventListener('click', e => {
        const b = e.target.closest('[data-toon]'); if (!b || !toon) return;
        const a = b.dataset.toon;
        if (a === 'skip' || a === 'go') toonClose(); else if (toon.i < toon.cuts.length) toonNext(); else toonClose();
      });
      function hellIntro(g) {   // 관문 처음 = 4컷 · S.toonSeen 에 본 관문 번호
        S.toonSeen = Array.isArray(S.toonSeen) ? S.toonSeen : [];
        if (S.toonSeen.includes(g.no)) return;
        S.toonSeen.push(g.no); markDirty(false);
        showToon(gateCuts(g), { title: `저승 제${g.no}관문 · ${g.hell}`, go: `⚔ ${g.stageName[0]}(으)로` });
      }
      const bossCut = (g, k) => showToon([Object.assign(toonSay(g, k, 'l'), { wait: 1200 })], { title: `${g.no}-${k === 'guard' ? 3 : k === 'judge' ? 4 : 5} · ${(k === 'king' ? g.boss : g[k]).name} 등장!`, go: '⚔ 싸우기', auto: 5200 });
      /* v69 저승 던전: 단계마다 몬스터 50마리 → (3단계 옥졸 · 4단계 판관) → 통과. 5단계는 대왕만 */
      function spawnHell() {
        const M = G.map.M, g = D.HELL.gates[M.gate - 1], s = M.stage, lv = 100 + (M.gate - 1) * 5 + s;
        G.hellRun = { gate: M.gate, stage: s, kills: 0, phase: s === 5 ? 'boss' : 'mob', lv };
        if (s === 5) { G.mons.push(makeMon(g.boss, lv + D.HELL.bossPlus, true)); G.title = { t: 0, text: g.boss.name, sub: g.boss.say }; setTimeout(() => { if (G.hellRun && G.hellRun.stage === 5 && G.map.M.hell) bossCut(g, 'king'); }, 600); return; }
        for (let i = 0; i < 18; i++) G.mons.push(makeMon(i % 3 === 2 && g.mob2 ? g.mob2 : g.mob, lv));   // v109 몬스터 1.5배 (12 → 18)
        if (s === 1) setTimeout(() => { if (G.hellRun && G.map.M.hell && G.map.M.gate === g.no) hellIntro(g); }, 500);   // v130 관문 첫 웹툰
      }

      /* ================= v150 숨은 던전 '사신의 땅' ================= */
      const SX = D.SASIN, godsDone = () => SX.gods.filter(k => S.sasin[k]).length;
      function spawnSasin(M) {
        const k = M.sx, mk2 = (def, lv, dx, dy) => { const m = makeMon(Object.assign({ sx: k }, def), lv, true); m.noRespawn = true; if (dx != null) { const cx = G.map.w * TS / 2, cy = (G.map.h >> 1) * TS; m.x = m.hx = cx + dx; m.y = m.hy = cy + dy; } return m; };
        if (SX.boss[k] && k !== 'king') { if (!S.sasin[k]) { const def = Object.assign({ god: k }, SX.boss[k]); G.mons.push(mk2(def, SX.lv.god, 0, def.bh >= 250 ? 140 : -40)); /* v150 큰 사방신은 아래쪽에 (머리까지 지도 안에) */ G.title = { t: 0, text: def.name + ` (Lv.${SX.lv.god})`, sub: def.say }; G.shake = 6; } return; }
        if (k === 'all' && godsDone() === 4 && !S.sasinAll) { [[-300, 20], [300, 20], [-300, 230], [300, 230]].forEach(([dx, dy], i) => { const g = SX.gods[i]; G.mons.push(mk2(Object.assign({ god: g, allRoom: true }, SX.boss[g], { bh: 300 }), SX.lv.god, dx, dy)); }); /* v150 회합 방: 넷이 함께 나오니 크기를 줄임 (300) */ G.title = { t: 0, text: '사방신이 한꺼번에 나타났다!', sub: '넷 모두 자기 속성의 힘은 통하지 않는다' }; G.shake = 10; return; }
        if (k === 'king' && S.sasinAll) { G.mons.push(mk2(Object.assign({ god: 'king' }, SX.boss.king), SX.lv.king, 0, 140)); G.title = { t: 0, text: `광개토대왕 (Lv.${SX.lv.king})`, sub: SX.boss.king.say }; G.shake = 12; G.flash = 0.4; }
        if (k === 'npc') G.npcs = [{ key: 'sxnpc', def: SX.npc, x: (G.map.w >> 1) * TS + 70, y: ((G.map.h >> 1) + 0.6) * TS, face: -1, ph: 1, smith: true }];
      }
      // 들어갈 수 있는지 (막히면 까닭) — 18번 숨은 입구 = 환생 1번 · 사방신 모두 방 = 불 넷 · 광개토대왕 방 = 사방신 모두 방을 깸
      function sxBlock(to) {
        const T = MAPBY[to]; if (!T || !T.sx) return '';
        if (to === SX.entry && (G.map.M.id === SX.gateMap) && !(S.reb >= 1)) return SX.rock;
        if (T.sx === 'all' && godsDone() < 4) return `사방신의 불이 모두 켜져야 열린다 (${godsDone()}/4)`;
        if (T.sx === 'king' && !S.sasinAll) return '사방신을 한꺼번에 이겨야 광개토대왕의 방이 열린다';
        return '';
      }
      function sxPush() { const m = G.map, b = 40; if (G.py < b) G.py = b + 4; else if (G.py > m.h * TS - b) G.py = m.h * TS - b - 4; else if (G.px < b) G.px = b + 4; else if (G.px > m.w * TS - b) G.px = m.w * TS - b - 4; else G.py += 26; }
      // 왕을 죽인 검: 광개토대왕 방에서만 화려한 모양 · 설명
      const kingSwordOn = () => { const w = S.eq.weapon && ITEMS[S.eq.weapon]; return !!(w && (w.kingSword || (ITEMS[w.base] || {}).kingSword)); };
      const inKingRoom = () => !!(G.map && G.map.M.sx === 'king');
      function sasinKill(m) {
        const g = m.def.god; if (!g) return;
        if (g === 'king') {   // 반지 · 전설 펫 열림 · 지역 처음으로 → 18번 사냥터
          const u = newUid(), base = ITEMS.rgKing, good = base.goodOpts.slice().sort(() => Math.random() - 0.5).slice(0, 1), rest = rollOpts(9, 5).filter(o => !good.includes(o[0]) && o[0] !== 'e_all').slice(0, 2);   // v149 선생님 11/15: ① 모든 속성 방어 15% 고정 ② 좋은 옵션 1개 최대치 ③④ 무작위
          S.gear[u] = { b: 'rgKing', en: 0, op: [['e_all', 15]].concat(good.map(q => [q, OPTS[q].max]), rest) };
          const id = regGear(u, S.gear[u]); const got = addItem(id, 1);
          if (!S.kingAt) S.kingAt = Date.now(); setTimeout(() => submitRank(0, true), 500); setTimeout(() => { G.kingTop = null; }, 4000);   /* v176 10명 목록 새로 */   // v158 최초 토벌 기록 (메인 카드)
          S.petOpen.legend = 1; D.SASIN.gods.forEach(q => { S.sasin[q] = 0; }); S.sasinAll = 0;
          G.title = { t: 0, text: '광개토대왕을 이겼다!', sub: (got ? '광개토대왕의 반지를 얻었다 · ' : '가방이 가득 차서 반지를 못 받았어요… · ') + '이장 댁 펫 뽑기에 「전설」이 열렸어요' }; G.flash = 0.6; G.shake = 14; Fx.levelUp(G.px, G.py);
          save(true); setTimeout(() => { if (!G.dead && inKingRoom()) { enter(SX.home, { from: SX.entry }); say('광개토대왕 던전이 처음으로 돌아갔어요. 다시 사방신을 이기면 광개토대왕을 만날 수 있어요', 5); } }, 6000);
          return;
        }
        if (m.def.allRoom) { if (G.mons.every(x => x.dead || !x.def.allRoom)) { S.sasinAll = 1; G.title = { t: 0, text: '사방신을 모두 이겼다!', sub: '위쪽 광개토대왕의 방이 열렸어요' }; G.flash = 0.5; save(true); bagWarn(); } return; }
        S.sasin[g] = 1; const n = godsDone();
        G.title = { t: 0, text: `${SX.godName[g]}을(를) 이겼다!`, sub: `광개토대왕 던전 어귀 문에 ${SX.godName[g]}의 불이 켜졌어요 (${n}/4)` }; G.flash = 0.45;
        if (n === 4 && !S.petOpen.hero) { S.petOpen.hero = 1; setTimeout(() => say('사방신을 모두 이겼어요! 이장 댁 펫 뽑기에 「영웅」(청룡·주작·백호·현무)이 열렸어요', 5), 2500); }
        save(true);
      }
      /* ================= v172 이순신 장군님 던전 ================= */
      const YS = D.YS, ysHave = () => S.ysp.filter(Boolean).length, isAdm = () => !!(Hub.isAdmin && Hub.isAdmin() && Hub.user && YS.only.includes(Hub.user.nickname));   // v174 관리자 '파워복복'만
      function spawnYs(M) {
        const k = M.ys, cx = G.map.w * TS / 2, cy = (G.map.h >> 1) * TS, mk = (def, lv, dx, dy) => { const m = makeMon(def, lv, true); m.noRespawn = true; m.x = m.hx = cx + dx; m.y = m.hy = cy + dy; return m; };
        if (k === 'gen') { const i = M.yi, g = YS.gens[i]; if (!S.ysp[i]) { G.mons.push(mk(Object.assign({ ysGen: i }, g), M.rec, 0, 120)); G.title = { t: 0, text: `${g.name} (Lv.${M.rec})`, sub: g.say }; G.shake = 6; } else say(`${g.name}의 벽화 조각은 이미 되찾았어요`, 3); return; }
        if (k === 'all' && S.ysMural && !S.ysAll) { const pick4 = YS.gens.map((g, i) => i).sort(() => Math.random() - 0.5).slice(0, YS.allN || 4).sort((a, b) => a - b);   /* v199 선생님 11/24: 회합이 어렵다는 말 → 아홉 중 무작위 넷만 (들어올 때마다 새로 뽑음) */ pick4.forEach((i, j) => { const g = YS.gens[i], [dx, dy] = [[-300, 20], [300, 20], [-300, 230], [300, 230]][j];   /* 사방신 회합과 같은 자리 */ G.mons.push(mk(Object.assign({ ysGen: i, allRoom: true }, g, { bh: 210 }), YS.lv.all, dx, dy)); }); G.title = { t: 0, text: '왜장 넷이 나타났다!', sub: `아홉 중 무작위 넷: ${pick4.map(i => YS.gens[i].name).join(' · ')} · 저마다 통하지 않는 원소가 둘씩 있다` }; G.shake = 10; return; }
        if (k === 'boss' && (!S.ysMural || S.ysAll)) { const E7 = Object.keys(ELEM).slice(), imm4 = []; while (imm4.length < 4) imm4.push(E7.splice(Math.floor(Math.random() * E7.length), 1)[0]);   /* v178 선생님 11/23: 도전할 때마다 4가지 원소를 무작위로 무시 */ G.mons.push(mk(Object.assign({}, YS.boss, { immune: imm4 }), YS.lv.boss, 0, 140)); G.ysNav = null; G.title = { t: 0, text: `${YS.boss.name} (Lv.${YS.lv.boss})`, sub: `이번 도전: ${imm4.map(e => ELEM[e].name).join('·')} 공격이 통하지 않는다!` }; G.shake = 12; G.flash = 0.4; return; }
        if (k === 'npc') G.npcs = [{ key: 'ysnpc', def: YS.npc, x: (G.map.w >> 1) * TS + 70, y: ((G.map.h >> 1) + 0.6) * TS, face: -1, ph: 1, smith: true }];
      }
      // 들어갈 수 있는지 (막히면 까닭) — 입구 = 광개토대왕을 이긴 사람(관리자는 시험용으로 통과) · 회합 = 벽화 완성 · 본진 = 회합을 깸
      function ysBlock(to) {
        const T = MAPBY[to]; if (!T || !T.ys) return '';
        // v182 선생님 11/23: 광개토대왕을 못 이긴 사람도 누구나 들어갈 수 있음 (예전: 광개토대왕을 이긴 사람만)
        if (T.ys === 'boss' && S.ysMural && !S.ysAll) return '이순신 장군님 벽화가 완성되어 왜장들이 깨어났다! 회합에서 나타난 왜장 넷을 모두 이겨야 본진이 열린다';   // v173 선생님 11/20: 벽화가 없으면 회합은 빈 방 · 본진은 그냥 열림
        return '';
      }
      function ysKill(m) {
        const d = m.def;
        if (d.ysBoss) {   // v173 이순신 장군의 신발 + 던전 처음으로 (조각·벽화·회합 모두 지움 — 선생님 11/20)
          const u = newUid(), base = ITEMS.btYi, good = base.goodOpts.slice().sort(() => Math.random() - 0.5).slice(0, 1), rest = rollOpts(9, 6).filter(o => !good.includes(o[0]) && o[0] !== 'spdP').slice(0, 2);
          S.gear[u] = { b: 'btYi', en: 0, op: [['spdP', base.spdOpt]].concat(good.map(q => [q, OPTS[q].max]), rest) };
          const got = addItem(regGear(u, S.gear[u]), 1);
          S.ysp = S.ysp.map(() => 0); S.ysMural = 0; S.ysAll = 0; S.ysWin = (S.ysWin || 0) + 1;
          const firstYs = !S.ysAt; if (firstYs) S.ysAt = Date.now(); if (!S.petOpen.ysY) { S.petOpen.ysY = 1; setTimeout(() => say('👑 이장 댁 펫 뽑기에 「이순신」(전설) · 「거북선」(영웅)이 나오기 시작해요! · 타이틀 「이순신과 함께한 자」를 얻었어요', 6), 2500); }   // v182 첫 공략 시각 · 이순신 펫 · 타이틀
          setTimeout(() => submitRank(0, true), 800); setTimeout(() => { G.ysTop = null; }, 4500);
          G.title = { t: 0, text: '와키자카 야스하루를 이겼다!', sub: got ? '이순신 장군의 신발을 얻었다!' : '가방이 가득 차서 신발을 못 받았어요…' }; G.flash = 0.6; G.shake = 14; Fx.levelUp(G.px, G.py);
          save(true); setTimeout(() => { if (!G.dead && G.map && G.map.M.ys === 'boss') { enter(YS.entry, { from: YS.home }); say('이순신 장군님 던전이 처음으로 돌아갔어요. 왜장 아홉을 다시 이기면 또 도전할 수 있어요', 5); } }, 6000);
          return;
        }
        if (d.ysGen == null) return;
        if (d.allRoom) { if (G.mons.every(x => x.dead || !x.def.allRoom)) { S.ysAll = 1; G.title = { t: 0, text: '회합의 왜장 넷을 모두 이겼다!', sub: '아래쪽 와키자카 야스하루의 본진이 열렸어요' }; G.flash = 0.5; save(true); bagWarn(); } return; }
        if (!S.ysp[d.ysGen]) { S.ysp[d.ysGen] = 1; const n = ysHave(); G.title = { t: 0, text: `${d.name}을(를) 이겼다!`, sub: `벽화 조각을 되찾았다 (${n}/9)` + (n === 9 ? ' · 왜장의 길목의 빈 벽화 틀로 가서 맞춰 보세요' : '') }; G.flash = 0.45; save(true); }
      }
      // 3×3 밀기 퍼즐: 0~8 = 조각 자리 (8 = 빈칸) · 열 때마다 무작위로 섞음 (빈칸을 300번 움직여서 늘 풀 수 있게)
      function ysShuffle() {
        const b = [0, 1, 2, 3, 4, 5, 6, 7, 8]; let e = 8, prev = -1;
        for (let k = 0; k < 300; k++) { const x = e % 3, y = Math.floor(e / 3), nb = []; if (x > 0) nb.push(e - 1); if (x < 2) nb.push(e + 1); if (y > 0) nb.push(e - 3); if (y < 2) nb.push(e + 3); const c2 = nb.filter(q => q !== prev); const q = c2[Math.floor(Math.random() * c2.length)]; b[e] = b[q]; b[q] = 8; prev = e; e = q; }
        if (b.every((v, i) => v === i)) return ysShuffle(); return b;
      }
      function ysSlide(i) {
        const P = tab.ysPz; if (!P || P.done) return; const e = P.b.indexOf(8), ex = e % 3, ey = Math.floor(e / 3), x = i % 3, y = Math.floor(i / 3);
        if (Math.abs(ex - x) + Math.abs(ey - y) !== 1) return;
        P.b[e] = P.b[i]; P.b[i] = 8; P.moves++;
        if (P.b.every((v, k) => v === k)) { P.done = true; S.ysMural = 1; S.ysAll = 0; save(true); setTimeout(() => { if (pane === 'ysmural') closePanel(); showToon(ysCuts(), { title: '⚓ 이순신 장군님 벽화', go: '⚔ 왜장들의 회합으로', done: () => { G.flash = 0.5; say('이순신의 축복을 받았어요! (이 던전 안에서만) 아래쪽 왜장들의 회합이 열렸어요', 5); } }); }, 1400); }   // v173 벽화 완성 → 이순신 장군 웹툰
      }
      /* v173 선생님 11/20: 벽화를 완성하면 벽화에서 이순신 장군이 나와 축복 (웹툰 · Gemini 그림 img/v79/toon_ys1~3.jpg · ys_yi.png) */
      const ysCuts = () => {
        const av = Hub.user ? Hub.user.avatar : AV.normalize({}), me = avatarSprite(av, S.eq, S.hide, 0).toDataURL(), nick = Hub.user ? Hub.user.nickname : '나';
        return [
          { kind: 'pic', img: 'toon_ys1.jpg', fx: 'shake', sfx: '우우웅…', cap: '마지막 조각이 맞춰지자 <b>벽화가 빛나기 시작했다</b>!', wait: 2800 },
          { kind: 'pic', img: 'toon_ys2.jpg', fx: 'flash', sfx: '번쩍!!', sfxCls: 'big l', cap: '벽화 속에서 <b>이순신 장군</b>이 걸어 나온다!', wait: 2800 },
          { kind: 'say', img: 'ys_yi', name: '이순신 장군', role: '삼도수군통제사', text: '죽고자 하는 자는 살 것이고, 살고자 하는 자는 죽을 것이다. 용감한 그대여, 그대를 위해 나도 함께 하겠다.', side: 'l', king: true, col: '#FFD23F', wait: 4200 },
          { kind: 'say', src: me, name: nick, role: '나', text: '장군님…! 함께 싸우겠습니다!', side: 'r', col: '#9AE6FF', wait: 2200 },
          { kind: 'pic', img: 'toon_ys3.jpg', sfx: '화아악', cap: '<b>이순신의 축복</b>을 받았다! (이 던전 안에서만 · 벽화가 완성되어 있는 동안)', wait: 3200 }
        ];
      };
      // 와키자카 피 10%: 무적 + 속박 마법 + 왜선 8척이 둘러싸고 10초 동안 대포 (한 발 1,000만) · 축복이 있으면 거북선 방패(10초 무적) → 왜선·거북선이 안개처럼 사라지고 광폭화 (피 50% · 이동·공격 2배)
      function ysNavStart(m) {
        if (m.ysPh) return;
        m.ysPh = 1; m.ysInv = true; m.dead = false; m.hp = Math.max(1, Math.ceil(m.max * 0.1)); m.burn = null; m.cast = null; m.slam = null; m.stun = 0;
        const n = 8, ships = []; for (let i = 0; i < n; i++) ships.push({ a: -Math.PI / 2 + (i + 0.5) / n * Math.PI * 2, cd: 1.1 + i * 0.13 + Math.random() * 0.4, fire: 0 });
        G.ysNav = { m, t: 0, dur: 10, bless: !!S.ysMural, ships, balls: [], R0: Math.min(W, H) * 0.44, cx: G.px, cy: G.py - 20, fade: 0, done: false };
        G.pst = G.pst || {}; G.pst.stun = 10.4; G.pst.slow = 0;   // 100% 속박 (못 움직이고 마법·공격도 못 씀)
        G.title = { t: 0, text: '와키자카: 「꼼짝 마라!」', sub: '속박 마법에 걸려 움직일 수 없다! 왜선이 사방을 둘러쌌다…' }; G.shake = 12; G.flash = 0.35;
        Fx.nova(G.px, G.py - 10, 90, ['dark', 'dark']);
      }
      function ysCannon() {
        if (godOn()) { G.texts.push({ x: G.px, y: G.py - 70, text: '무적', color: '#FFD23F', t: 0, big: true }); return; }   // v176
        const dmg = 10000000; S.hp -= dmg; G.hurt = 0.45; G.shake = Math.max(G.shake, 14);
        G.texts.push({ x: G.px + rand(-10, 10), y: G.py - 70, text: '-' + fmtN(dmg), color: '#FF4A3A', t: 0, big: true, dmg: true });
        if (S.hp <= 0) { S.hp = 0; G.pst.stun = 0; die(); }
      }
      function ysNavTick(dt) {
        const N = G.ysNav, m = N.m; N.t += dt;
        if (N.t < N.dur) {
          if (N.t > 0.9 && !G.dead) N.ships.forEach(sh => {
            if (sh.fire > 0) sh.fire -= dt;
            if ((sh.cd -= dt) <= 0) { sh.cd = rand(0.8, 1.4); sh.fire = 0.3; const p = ysShipPos(N, sh); N.balls.push({ x0: p.x, y0: p.y - 18, t: 0, d: rand(0.65, 0.85) }); G.shake = Math.max(G.shake, 3); }
          });
        }
        N.balls = N.balls.filter(b => {
          b.t += dt; if (b.t < b.d) return true;
          const ix = G.px + rand(-6, 6), iy = G.py - 26;
          if (N.bless) { Fx.nova(ix + (b.x0 - ix) * 0.18, iy + (b.y0 - iy) * 0.18, 30, ['light', 'water']); if (!(N.txtT > N.t - 0.7)) { N.txtT = N.t; G.texts.push({ x: ix + (b.x0 - ix) * 0.2, y: iy - 20 + (b.y0 - iy) * 0.2, text: '막았다!', color: '#9AE6FF', t: 0 }); } G.shake = Math.max(G.shake, 4); }
          else if (!G.dead) { Fx.nova(ix, iy, 50, ['fire', 'fire']); ysCannon(); }
          return false;
        });
        if (N.t >= N.dur) {
          N.fade += dt;
          if (N.fade >= 1.8 && !N.done) {
            N.done = true; G.ysNav = null; if (G.pst) G.pst.stun = 0;
            if (m && !m.dead) {   // 광폭화
              m.ysPh = 2; m.ysInv = false; m.hp = Math.round(m.max * 0.5); m.spd *= 2; m.atk *= 2; m.cd = 0.6; m.aggro = true;
              G.title = { t: 0, text: '와키자카 야스하루가 광폭해졌다!', sub: '피가 절반까지 돌아왔다 · 이동 속도와 공격력 2배! 마지막 싸움이다' }; G.shake = 16; G.flash = 0.5;
              Fx.nova(m.x, m.y - 40, 160, ['fire', 'dark']);
            }
          }
        }
      }
      const ysShipPos = (N, sh) => ({ x: N.cx + Math.cos(sh.a) * N.R0 * 1.15, y: N.cy + Math.sin(sh.a) * N.R0 * 0.78 });
      function drawShipShape(c, x, y, s, flip, turtle) {   // 그림이 없을 때 코드로 그린 배
        c.save(); c.translate(x, y); c.scale(flip ? -s : s, s);
        c.fillStyle = turtle ? '#3A5A3A' : '#5A3A22'; c.beginPath(); c.moveTo(-60, -10); c.lineTo(60, -10); c.lineTo(46, 14); c.lineTo(-46, 14); c.closePath(); c.fill();
        c.strokeStyle = '#1D2340'; c.lineWidth = 3; c.stroke();
        if (turtle) { c.fillStyle = '#4A7A4A'; c.beginPath(); c.ellipse(0, -10, 50, 18, 0, Math.PI, 0); c.fill(); c.stroke(); c.fillStyle = '#C0A060'; for (let i = -40; i <= 40; i += 12) { c.beginPath(); c.moveTo(i - 3, -20); c.lineTo(i, -28); c.lineTo(i + 3, -20); c.fill(); } c.fillStyle = '#FFD23F'; c.beginPath(); c.arc(60, -16, 9, 0, Math.PI * 2); c.fill(); c.stroke(); }
        else { c.fillStyle = '#7A4A2A'; c.fillRect(-30, -42, 50, 32); c.strokeRect(-30, -42, 50, 32); c.fillStyle = '#F0E8D8'; c.fillRect(-4, -92, 40, 46); c.strokeRect(-4, -92, 40, 46); c.fillStyle = '#FF4A3A'; c.beginPath(); c.arc(16, -69, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1D2340'; c.fillRect(-6, -96, 4, 86); }
        c.restore();
      }
      function drawYsNav(c, now) {
        const N = G.ysNav; if (!N) return;
        const fade = N.t < N.dur ? 1 : Math.max(0, 1 - N.fade / 1.8), app = Math.min(1, N.t / 0.9), A = app * fade;
        if (N.t < N.dur && !G.dead) { c.save(); c.globalAlpha = 0.8 * A; c.strokeStyle = '#B07AFF'; c.lineWidth = 4; for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(G.px, G.py - 18 - k * 16, 30 - k * 3, 9, 0, now / 300 + k, now / 300 + k + Math.PI * 1.6); c.stroke(); } c.restore(); }   // 속박 사슬
        if (N.bless) {   // 거북선 방패
          const ta = Math.min(1, N.t / 0.6) * fade, pul = 1 + 0.04 * Math.sin(now / 150);
          c.save(); c.globalAlpha = ta * 0.55; const g = c.createRadialGradient(G.px, G.py - 30, 20, G.px, G.py - 30, 105 * pul); g.addColorStop(0, 'rgba(154,230,255,0.05)'); g.addColorStop(0.75, 'rgba(154,230,255,0.28)'); g.addColorStop(1, 'rgba(255,210,63,0.8)'); c.fillStyle = g; c.beginPath(); c.arc(G.px, G.py - 30, 105 * pul, 0, Math.PI * 2); c.fill();
          c.globalAlpha = ta * 0.9; c.strokeStyle = '#FFD23F'; c.lineWidth = 3; c.stroke(); c.restore();
          const tim = img79('ys_turtle'), ty = G.py + 70 - (1 - Math.min(1, N.t / 0.6)) * 30;
          c.save(); c.globalAlpha = ta;
          if (tim) { const tw = 260, th = tw * tim.naturalHeight / tim.naturalWidth; c.drawImage(tim, G.px - tw / 2, ty - th * 0.75, tw, th); } else drawShipShape(c, G.px, ty, 0.95, false, true);
          c.restore();
        }
        const sim = img79('ys_ship');
        N.ships.forEach(sh => {   // 왜선 8척
          const p = ysShipPos(N, sh), flip = p.x > G.px, bob = Math.sin(now / 400 + sh.a * 3) * 4;
          c.save(); c.globalAlpha = A;
          if (sim) { const sw = 170, shh = sw * sim.naturalHeight / sim.naturalWidth; c.translate(p.x, p.y + bob); if (flip) c.scale(-1, 1); c.drawImage(sim, -sw / 2, -shh * 0.8, sw, shh); } else drawShipShape(c, p.x, p.y + bob, 0.85, flip, false);
          c.restore();
          if (sh.fire > 0 && N.t < N.dur) { c.save(); c.globalAlpha = sh.fire / 0.3; c.fillStyle = '#FFD23F'; c.beginPath(); c.arc(p.x + (flip ? -52 : 52), p.y - 18, 16, 0, Math.PI * 2); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(p.x + (flip ? -52 : 52), p.y - 18, 7, 0, Math.PI * 2); c.fill(); c.restore(); }
        });
        N.balls.forEach(b => {   // 포탄 (포물선 · 방패가 있으면 방패 앞에서 멈춤)
          const k = b.t / b.d, kk = k * (N.bless ? 0.82 : 1), x = b.x0 + (G.px - b.x0) * kk, y = b.y0 + (G.py - 26 - b.y0) * kk - Math.sin(Math.PI * kk) * 70;
          c.save(); c.fillStyle = '#1D2340'; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = '#FF9A3D'; c.beginPath(); c.arc(x + 3, y - 3, 3, 0, Math.PI * 2); c.fill(); c.restore();
        });
        if (N.t >= N.dur) { c.save(); for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = N.R0 * (0.6 + 0.5 * ((i * 37) % 10) / 10), x = N.cx + Math.cos(a) * r * 1.1, y = N.cy + Math.sin(a) * r * 0.75; c.globalAlpha = 0.45 * Math.sin(Math.PI * Math.min(1, N.fade / 1.8)); c.fillStyle = '#F0F4FF'; c.beginPath(); c.arc(x, y, 60 + (i % 4) * 14, 0, Math.PI * 2); c.fill(); } c.restore(); }   // 안개처럼 사라짐
      }
      function drawYsBless(c, now) {   // 왼쪽 위 칸 아래: 이순신의 축복
        const x = 8, y = 96, w = 150, h = 26, k = 0.75 + 0.25 * Math.sin(now / 400);
        c.save(); c.fillStyle = '#1D2340'; rr(c, x, y, w, h, 7); c.fill(); c.strokeStyle = `rgba(255,210,63,${k})`; c.lineWidth = 2; rr(c, x, y, w, h, 7); c.stroke();
        c.font = '13px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#FFD23F'; c.fillText('⚓ 이순신의 축복', x + 10, y + h / 2 + 1); c.restore();
      }
      function ysPaneHtml(fr) {
        const n = ysHave(), img = 'games/action/rpg/img/v79/' + YS.mural + '.jpg?v=172', P = tab.ysPz;
        let h = fr ? head(YS.frame.name, '왜장의 길목 · 왜군이 벽화를 떼어 간 자리') : head(YS.npc.name, '이순신 장군님 던전 어귀 · 혼자 들어온 곳 (다른 사람은 보이지 않아요)');
        if (P) {
          h += `<p class="sub">조각을 눌러 빈칸으로 밀어요. 그림이 제자리에 오면 벽화가 완성돼요. (움직인 수 ${P.moves})</p><div class="rg-ys-pz${P.done ? ' done' : ''}">`
            + P.b.map((v, i) => v === 8 && !P.done ? `<button type="button" class="rg-ys-t blank" disabled></button>` : `<button type="button" class="rg-ys-t" data-yss="${i}" style="background-image:url(${img});background-position:${(v % 3) * 50}% ${Math.floor(v / 3) * 50}%"></button>`).join('') + '</div>';
          h += P.done ? '<p style="text-align:center;color:#FFD23F;font-weight:bold;margin:8px 0">✨ 벽화 완성! 아래쪽 왜장들의 회합이 열렸어요</p><div class="rg-srvact"><button type="button" class="rg-mini" data-x>닫기</button></div>'
            : '<div class="rg-srvact"><button type="button" class="rg-mini ghost" data-yspz="0">그만하기</button><button type="button" class="rg-mini ghost" data-yspz="1">다시 섞기</button></div>';
          return h;
        }
        h += `<div class="rg-fuse" style="text-align:left;line-height:1.7">${(fr ? (S.ysMural ? ['이순신 장군님 벽화가 제자리에 걸려 은은하게 빛나고 있다.'] : n >= 9 ? ['빈 벽화 틀 앞에 서자 지니고 있던 조각 아홉 개가 함께 울린다. 조각을 밀어서 제자리에 맞춰 보자.'] : ['왜군이 벽화를 떼어 가고 못 자국만 남은 빈 틀이다.', `왜장을 이겨 조각 아홉을 모두 되찾아 오면 여기서 벽화를 맞출 수 있다. (지금 ${n}/9)`]) : YS.npc.lines).map(l => `<p style="margin:0 0 6px">${l}</p>`).join('')}</div>`;
        h += `<div class="rg-ys-have">${S.ysp.map((v, i) => `<div class="${v ? 'on' : ''}" style="${v ? `background-image:url(${img});background-position:${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%` : ''}">${v ? '' : '?'}</div>`).join('')}</div>`;
        h += `<p class="sub" style="text-align:center">되찾은 벽화 조각 <b style="color:#FFD23F">${n}/9</b>${S.ysMural ? ' · 벽화 완성 ✔ (왜장들의 회합 열림)' : ''}${S.ysAll ? ' · 본진 열림 ✔' : ''}</p>`;
        h += `<div class="rg-srvact">${S.ysMural || !fr ? '' : `<button type="button" class="rg-mini" data-yspz="1"${n < 9 ? ' disabled' : ''}>🧩 벽화 맞추기${n < 9 ? ' (조각 9개 필요)' : ''}</button>`}<button type="button" class="rg-mini ghost" data-x>닫기</button></div>`;
        if (!fr) {   // v182 이순신 던전을 먼저 깬 10명 (서버 기록 · 날짜·시간 · 관리자 시험은 기록 안 됨)
          const esc2 = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]), K = G.ysTop, fmt = v => { const d = new Date(9e12 - v); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
          if (!K && !G.ysTopReq && Hub.extraTopN) { G.ysTopReq = 1; Hub.extraTopN(GAME, 'ys', 10).then(r => { G.ysTop = r || []; G.ysTopReq = 0; if (pane === 'ysnpc') renderPanel(); }).catch(() => { G.ysTop = []; G.ysTopReq = 0; if (pane === 'ysnpc') renderPanel(); }); }
          h += `<div class="rg-king10" style="border-color:#9AE6FF"><b class="tt" style="color:#9AE6FF">⚓ 이순신 장군님 던전을 먼저 깬 용사 10명</b>${!K ? '<p class="sub">불러오는 중…</p>' : !K.length ? '<p class="sub">아직 아무도 와키자카를 이기지 못했어요. 첫 번째 용사가 되어 보세요!</p>' : `<ol>${K.map((r, i) => `<li${Hub.user && r.user_id === Hub.user.id ? ' class="me"' : ''}><span class="no">${i + 1}</span><b>${esc2(r.nickname)}</b><small>${fmt(r.value)}</small></li>`).join('')}</ol>`}</div>`;
        }
        return h;
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
          G.mons.push(makeMon(who, H.lv + (D.HELL.midPlus || 0), true)); G.title = { t: 0, text: `${who.name} 등장! (Lv.${H.lv + (D.HELL.midPlus || 0)})`, sub: who.say }; G.shake = 8; bossCut(g, H.stage === 3 ? 'guard' : 'judge');   // v130 보스 자기소개 컷
        }
      }
      /* v131 환생: Lv.1 · 경험치 0 · 스탯 모두 돌려받고 (환생 횟수 × 20) 포인트 · 마법은 기본 마법(마법 화살)만 · 장비·가방·골드·저승 기록은 그대로 · 솔뫼 마을에서 다시 시작 */
      function doRebirth() {
        if (!S.rebReady || (S.reb || 0) >= D.REBIRTH.max) return;
        S.reb = (S.reb || 0) + 1; S.rebReady = false; S.lv = 1; S.exp = 0;
        D.STAT.keys.forEach(q => { S.stat[q] = 0; }); S.sp = S.reb * D.REBIRTH.bonus;
        S.skills = ['magicarrow']; S.slots = ['magicarrow', null, null, null]; S.fslots = [null, null, null, null];
        S.home = 'v1'; restat(); S.hp = ST.hp; S.mp = ST.mp;
        pane = null; panel.hidden = true; G.paused = false;
        enter('v1', 'door');
        G.title = { t: 0, text: `${S.reb}번째 환생!`, sub: `Lv.1 · 스탯 포인트 ${S.sp}개를 받았어요 (스탯 창에서 나눠 주세요)` }; G.flash = 0.5; Fx.levelUp(G.px, G.py);
        markDirty(true); save(true); G.lastSubmit = 0; submitRank(); if (net) net.retrack();   // v134 환생하자마자 환생 횟수 기록
      }
      function hellClear() {
        const H = G.hellRun; if (!H || H.phase === 'done') return; H.phase = 'done';
        const idx = (H.gate - 1) * 5 + H.stage, first = idx > (S.hell || 0);
        if (first) S.hell = idx;
        const last = H.stage >= 5, nx = last ? null : `h${H.gate}-${H.stage + 1}`;
        G.title = { t: 0, text: `${H.gate}-${H.stage} 통과!`, sub: last ? (H.gate >= D.HELL.gates.length ? `${D.HELL.gates[H.gate - 1].king}을(를) 이기고 명부를 되찾았어요! 저승의 질서가 돌아왔어요` : `${D.HELL.gates[H.gate - 1].king}의 시험을 이겼어요! 제${H.gate + 1}관문이 열렸어요`) : '잠시 뒤 다음 단계로 내려가요' }; G.flash = 0.4; Fx.levelUp(G.px, G.py);
        const final = last && H.gate >= D.HELL.gates.length;   // v131 마지막 관문 대왕 → 환생할 수 있음
        if (final && (S.reb || 0) < D.REBIRTH.max) S.rebReady = true;
        markDirty(true); if (first) submitRank();
        setTimeout(() => { if (G.hellRun !== H || G.dead || !G.map || !G.map.M.hell) return; if (nx && MAPBY[nx]) enter(nx, 'L'); else { enter('v9', 'door'); if (final && S.rebReady) setTimeout(() => { if (!G.dead && !pane) openPanel('rebirth', { first: true }); }, 1200); } }, 4000);
      }
      const rankScore = () => ((S.hell || 0) > 0 ? 1000 + S.hell : S.lv);   // v69 랭킹: 지옥을 깨면 1000 + 깬 단계
      const hellTxt = n => (n > 0 ? `${Math.ceil(n / 5)}-${n - (Math.ceil(n / 5) - 1) * 5}` : '-');
      function spawnPoint() {
        const sp = G.map.spawns; let p = pick(sp);
        for (let i = 0; i < 12 && Math.hypot(p.x - G.px, p.y - G.py) < 260; i++) p = pick(sp);
        return p;
      }
      // v83 보스 자리: 지도 62% 지점 큰길 — 그 칸이 바위·나무면 가장 가까운 빈 칸 (전에는 바위 속에 나와 못 움직이는 일이 있었음)
      function bossPoint(def) {
        if (G.map.bossAt) return { x: G.map.bossAt.x, y: G.map.bossAt.y };   // v132 결전장: 정해진 자리
        const x0 = G.map.w * TS * 0.62; let y0 = (G.map.mid + 1) * TS;
        if (def && def.bh >= 250) for (let ty = G.map.h - 4; ty > G.map.mid + 1; ty--) { const y = ty * TS; if (y - def.bh - 40 > 0 && ![-40, 0, 40].some(dx => solidAt(G.map, x0 + dx, y - 4) || solidAt(G.map, x0 + dx, y - 70))) { y0 = y; break; } }   // v150 큰 보스(사방신)는 아래쪽에 서야 머리까지 지도 안에 들어옴
        let best = { x: x0, y: y0 }, bd = 1e9;   // v150 큰 보스(사방신)는 아래쪽에 서야 머리까지 지도 안에 들어옴
        if (!solidAt(G.map, x0, y0 - 4) && !solidAt(G.map, x0 - 20, y0 - 4) && !solidAt(G.map, x0 + 20, y0 - 4)) return best;
        G.map.spawns.forEach(q => { const d = Math.hypot(q.x - x0, q.y - y0); if (d < bd && !solidAt(G.map, q.x - 20, q.y - 4) && !solidAt(G.map, q.x + 20, q.y - 4)) { bd = d; best = q; } });
        return { x: best.x, y: best.y };
      }
      function makeMon(def, lvl, boss) {
        lvl = clamp(lvl, 1, G.map && G.map.M.hell ? D.HELL.maxMonLv : G.map && G.map.M.ys ? 520 : G.map && G.map.M.sx ? D.SASIN.lv.king : D.MAX_LV); /* v150 사신의 땅 Lv.150~400 */ const F = D.F, B = F.boss;   // v69 저승 몬스터는 Lv.100 넘음
        const p = boss ? bossPoint(def) : spawnPoint();
        const sc = boss ? 6 : 3, spr = monSprite(def, sc);
        const hp = Math.round(F.monHp(lvl) * (boss ? B.hp : 1));
        const m = { def, name: def.name, lvl, boss: !!boss, kind: boss ? 'boss' : def.kind, x: p.x, y: p.y, hx: p.x, hy: p.y, hp, max: hp,
          atk: Math.round(F.monAtk(lvl) * (boss ? B.atk : 1)), mdef: F.monDef(lvl), spr, r: boss ? 30 : 14, hr: def.bh >= 250 ? Math.round(def.bh * 0.3) : 0,   // v150 큰 그림(사방신)은 맞는 범위도 크게
          exp: Math.round(F.monExp(lvl) * (boss ? B.exp : 1)), gold: Math.round(F.monGold(lvl) * (boss ? B.gold : 1)),
          spd: (boss ? 137 : def.kind === 'shoot' ? 60 : 80) * (def.spdK || 1), cd: rand(0.5, 1.5), wt: 0, wx: 0, wy: 0, aggro: false, flash: 0,   /* v157 선생님 11/17: 모든 보스 이동 속도 1.3배 (70 → 91) · v171 선생님 11/20: 1.5배 더 (91 → 137) */
          burn: null, slow: 0, stun: 0, dead: false, respawn: 0, slam: null, el: def.el || null, cast: null, skCd: 2.5 };
        if (boss && !def.skills && !def.noSkill) { const FS = { fire: 'mines', water: 'bomb', wind: 'laser', earth: 'mines', thunder: 'laser', light: 'laser', dark: 'bomb' }; m.skl = ['slam', 'fan', FS[m.el] || 'laser']; }   // v173 사냥터 보스도 기술 3개 (기본 2 + 속성별 1)
        return m;
      }

      function immTxt(m, t, col) { if ((m.immT || 0) > performance.now()) return; m.immT = performance.now() + 400; G.texts.push({ x: m.x + rand(-10, 10), y: m.y - m.spr.h - 10, text: t, color: col, t: 0 }); }
      /* ---------- 전투: 피해 계산 ---------- */
      function hitMon(m, base, els, opt) {
        if (m.dead) return 0;
        if (m.ysInv) { immTxt(m, '무적!', '#FF4A8A'); return 0; }
        if (m.inv2 > 0) { immTxt(m, '죽지 않는다!', '#FF4A3A'); return 0; }   // v173 죽지 않는 분노   // v173 와키자카: 왜선이 둘러싼 10초 동안 무적
        if (m.pvp) return duelHit(m, base, els, opt);   // v143 결투 상대
        opt = opt || {};
        const diff = m.lvl - S.lv, lvF = diff > 0 ? Math.max(0.4, 1 - 0.06 * diff) : 1 + Math.min(0.3, -diff * 0.03);
        let dmg = (base * rand(0.9, 1.1) * (1 + (ST.dmg || 0) / 100) - m.mdef * 0.5) * lvF;   // v44 힘 → 주는 피해 +%
        if ((els || []).some(e => ELEM[e].fx === 'heavy')) dmg *= 1.2;
        if (m.curse > 0) dmg *= 1.2;   // v87 저주 걸린 적
        const imm = m.def.immune;   // v150 사신의 땅: 사방신 = 자기 속성(기본·융합 마법에 그 속성) 피해 0 · 광개토대왕 = 왕을 죽인 검이 없으면 0, 있으면 ×1 (v171 · 예전 ×2)
        if (imm === 'all') { if (!kingSwordOn()) { immTxt(m, '무효! (어떤 공격도 통하지 않는다)', '#FFD23F'); return 0; } }   // v171 선생님 11/20: 왕을 죽인 검 피해 ×2 → ×1 (너무 쉽게 잡음 · 검이 있어야 피해가 들어가는 것만 남김)
        else if (Array.isArray(imm)) { const hit = (els || []).find(e => imm.includes(e)); if (hit) { immTxt(m, ELEM[hit].name + ' 무효!', ELEM[hit].color); return 0; } }   // v177 이순신 던전 장수: 원소 2가지 무시 (융합 마법에 들어 있어도)
        else if (imm && (els || []).includes(imm)) { immTxt(m, '무효!', ELEM[imm].color); return 0; }
        let weakHit = false;
        if (m.el && !m.def.immune) { if ((els || []).includes(m.el)) dmg *= D.HELL.resist; if ((els || []).includes(D.HELL.weak[m.el])) { dmg *= D.HELL.weakMul; weakHit = true; } }   // v69 저승 몬스터 속성: 같은 원소 ×0.7 · 약점 ×1.3
        const crit = Math.random() < ST.crit / 100; if (crit) dmg *= ST.critD || D.STAT.critDmg;
        dmg = Math.max(1, Math.round(dmg));
        if (m.dummy) return dummyHit(m, dmg, crit, weakHit, els);   // v144 훈련장 허수아비
        if (m.hidden) return 0; dmg = monGuard(m, dmg); if (dmg <= 0) return 0;   // v173 땅속·방패·보호막
        m.hp -= dmg; m.flash = 0.12; m.aggro = true; const fq = m.def.noFx ? (kingSwordOn() ? 0.25 : 0) : (m.def.fxQ || 1); m.knock = fq === 0 || m.def.noFx || m.def.noKnock ? 0 : (m.x < G.px ? -1 : 1) * (crit ? 6 : 3) * (m.def.fxQ || m.def.noFx ? fq : m.boss ? 1 / 3 : 1); /* v146 보스는 맞아도 1/3 만 움찔 (선생님 11/14) · v149 광개토대왕은 안 움찔 */
        const elc = els && els.length ? Fx.pal(els[0])[1] : '#FFFFFF';
        G.texts.push({ x: m.x + rand(-8, 8), y: m.y - m.spr.h - 4, text: (crit ? '치명! ' : '') + (weakHit ? '약점! ' : '') + dmg, color: crit ? '#FFD23F' : elc, t: 0, big: crit, dmg: true });
        Fx.hit(m.x, m.y - m.spr.h / 2, els, crit);
        if (crit) { G.shake = Math.max(G.shake, 4); G.hitstop = 0.05; }
        (els || []).forEach(e => {
          const fx = ELEM[e].fx;
          if (m.def.noCC && fx !== 'holy') { if (fx !== 'heavy' && !m.ccTxt) { m.ccTxt = 1; setTimeout(() => { m.ccTxt = 0; }, 1500); float(m.x, m.y - m.spr.h - 30, '상태 이상 무시!', '#FF4A8A'); } return; }   // v177 와키자카
          if ((fq === 0 && fx !== 'holy') || (m.def.noFx && (fx === 'push' || fx === 'stun'))) return;   // v152 광개토대왕: 넉백·기절은 검을 껴도 안 걸림 (선생님 11/16 05:47)   // v152 광개토대왕 넉백은 검을 껴도 안 걸림 (선생님 11/16 05:41)   // v152 광개토대왕: 넉백·상태 이상 안 걸림 (왕을 죽인 검을 끼면 1/4) · 빛 회복은 나에게 오는 것이라 그대로
          const q = (m.def.fxQ || m.def.noFx) ? fq : 1;   // v152 사방신·(검 낀) 광개토대왕 = 1/4 (시간·거리)
          if (fx === 'burn') m.burn = { t: 3 * q, dps: dmg * 0.12, tick: 0.5 };
          else if (fx === 'slow') m.slow = 2.5 * q;
          else if (fx === 'stun' && !opt.noStun) m.stun = q < 1 ? 0.7 * q : m.boss ? 0.25 : 0.7;
          else if (fx === 'push') { if (m.def.noKnock) return; const a = Math.atan2(m.y - G.py, m.x - G.px), k = q < 1 ? 46 * q : m.boss ? 8 / 3 : 46; /* v146 보스 밀어내기 1/3 · v152 사방신 1/4 */ moveMon(m, Math.cos(a) * k, Math.sin(a) * k); }
          else if (fx === 'holy') S.hp = Math.min(ST.hp, S.hp + Math.max(1, Math.round(dmg * 0.03)));
          else if (fx === 'curse') m.curse = 4 * q;   // v87 어둠: 4초 동안 받는 피해 +20%
        });
        if (m.def.ysBoss && !m.ysPh && m.hp <= m.max * 0.1) { ysNavStart(m); return dmg; }
        if (m.def.undying && !m.undyUsed && m.hp <= 0) { m.hp = 1; m.undyUsed = true; m.inv2 = 4; float(m.x, m.y - m.spr.h - 26, '죽지 않는 분노!', '#FF4A3A', true); Fx.nova(m.x, m.y - 40, 120, ['fire', 'fire']); G.shake = 10; return dmg; }   // v173 피 1에서 4초 무적   // v173 와키자카 피 10% → 속박 + 왜선 대포
        if (m.hp <= 0) killMon(m);
        return dmg;
      }
      function killMon(m) {
        if (m.isClone) { m.dead = true; Fx.death(m.x, m.y - 40, m.def.colors, false); float(m.x, m.y - 80, '가짜였다!', '#9AE6FF'); return; }   // v173 분신 (보상 없음)
        if (m.def.undying && !m.undyUsed) { m.dead = false; m.hp = 1; m.undyUsed = true; m.inv2 = 4; return; }
        if (m.def.egg && !m.eggUsed) { m.dead = false; m.eggUsed = true; m.eggT = 6; m.cast = null; m.slam = null; m.hp = Math.round(m.max * 0.2); float(m.x, m.y - m.spr.h - 30, '알이 되었다! 6초 안에 깨세요', '#FF9A3D', true); return; }   // v173 59 알 부활
        if (m.def.ysBoss && !m.ysPh) { ysNavStart(m); return; }   // v173 불 등으로 한 번에 쓰러져도 먼저 왜선 단계
        m.dead = true; m.respawn = m.boss ? (CFG.bossRespawnSec || 30) : (CFG.respawnSec || 3); S.kills++;
        if (m.boss || m.def.kind === 'boss') { const bk = m.def.name; if (bk && !m.allRoom) { const W = S.bossWon || (S.bossWon = {}); W[bk] = Math.max(W[bk] || 0, m.lvl || 1); } }   // v174 Fight 보스 도전 열림   // v43 다시 나오는 시간 단축
        if (G.map.M.hell) hellKill(m);   // v69 저승 단계 진행
        if (G.map.M.sx) sasinKill(m);   // v150 사신의 땅
        if (G.map.M.ys) ysKill(m);   // v172 이순신 장군님 던전
        const low = m.lvl < S.lv - 10 ? 0.2 : 1;
        const gold = Math.round(m.gold * (1 + (ST.goldP || 0) / 100)); gainExp(Math.round(m.exp * low * (1 + (ST.expP || 0) / 100))); S.gold += gold; float(m.x, m.y - m.spr.h - 18, `+${fmtN(gold)}G`, '#FFD23F');
        Fx.death(m.x, m.y - m.spr.h / 2, m.def.colors, m.boss); Fx.coins(m.x, m.y - m.spr.h / 2, m.boss ? 14 : Math.min(6, 2 + Math.floor(m.gold / 40)));
        if (m.boss) { G.shake = 10; G.flash = 0.35; G.hitstop = 0.12; G.title = { t: 0, text: '보스 처치!', sub: m.name }; }
        // 떨어뜨리는 물건
        const M = G.map.M, t = M.dropR != null ? M.dropR : M.region, k = ((M.dropNo || M.no) - 1) % 10, drops = [];   // v134 특별 지역은 고른 몬스터의 사냥터 기준
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
        if (SX.on && M.id === SX.swordMap && S.reb >= 1 && Math.random() < (m.boss ? SX.swordRate.boss : SX.swordRate.mob)) { const u = newUid(); S.gear[u] = { b: 'swKing', en: 0, op: rollOpts(8, optCount(false, m.boss, false)) }; drops.push(regGear(u, S.gear[u])); }   // v150 왕을 죽인 검
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
      /* v87 몬스터 속성 공격 → 나에게 상태 효과 (내 마법보다 약함 · 그 속성 방어 % 만큼 짧아지고 약해짐)
       *  불 화상(3초, 맞은 피해의 24%) · 물 느려짐(2초, 이동 −40%) · 바람 밀려남 · 땅 큰 피해(+15%) · 번개 기절(0.4초, 3초 동안 다시 안 걸림) · 빛 마나 빼앗김(맞은 피해의 20%) · 어둠 저주(3초, 받는 피해 +15%) */
      const PST = { burn: '화상!', slow: '느려짐!', stun: '기절!', push: '밀려남!', curse: '저주!', holy: '마나 빼앗김!' };
      function pStatus(el, dmg, src) {
        if (!el || !ELEM[el] || G.dead) return;
        const fx = ELEM[el].fx, k = Math.max(0.15, 1 - (ST.edefs[el] || 0) / 100), P = G.pst || (G.pst = {});
        let ok = true;
        if (fx === 'burn') P.burn = { t: 3 * k, dps: dmg * 0.08 * k, tick: 0.5 };
        else if (fx === 'slow') P.slow = Math.max(P.slow || 0, 2 * k);
        else if (fx === 'stun') { if ((P.stunImm || 0) > 0) ok = false; else { P.stun = 0.4 * k; P.stunImm = 3; } }
        else if (fx === 'push' && src) { const a = Math.atan2(G.py - src.y, G.px - src.x); for (let i = 0; i < 6; i++) { const nx = G.px + Math.cos(a) * 7 * k, ny = G.py + Math.sin(a) * 7 * k; if (solidAt(G.map, nx, ny)) break; G.px = nx; G.py = ny; } }
        else if (fx === 'holy') S.mp = Math.max(0, S.mp - Math.round(dmg * 0.2 * k));
        else if (fx === 'curse') P.curse = Math.max(P.curse || 0, 3 * k);
        else ok = false;
        if (ok && PST[fx]) G.texts.push({ x: G.px, y: G.py - 82, text: PST[fx], color: ELEM[el].color, t: 0 });
      }
      function hitPlayer(dmg0, lvl, el, src) {
        if (G.inv > 0 || G.dead) return;
        if (godOn()) { if (!(G.godT > 0)) { G.godT = 0.6; G.texts.push({ x: G.px, y: G.py - 64, text: '무적', color: '#FFD23F', t: 0 }); } return 0; }   // v176 무적 아이디
        if (G.ysNav && G.ysNav.bless && !G.ysNav.done) return;   // v173 거북선 방패 안 = 무적
        const diff = lvl - S.lv, lvF = src && src.pvp ? 1 : diff > 0 ? 1 + 0.08 * diff : Math.max(0.5, 1 + 0.05 * diff);   // v187 선생님 11/23: 결투(PvP)는 레벨 차이 보정 없음 (몬스터는 그대로 +8% · −5%)
        let dmg = (dmg0 * rand(0.9, 1.1) - ST.def * 0.5) * lvF;
        dmg *= 1 - (el ? (ST.edefs[el] || 0) : ST.pdef) / 100;
        if (G.shield) dmg *= 1 - G.shield.pow;
        if (el && ELEM[el] && ELEM[el].fx === 'heavy') dmg *= 1.15;   // v87 땅 속성 공격
        if (G.pst && G.pst.curse > 0) dmg *= 1.15;   // v87 저주 걸린 나
        dmg = Math.max(1, Math.round(dmg));
        { const sm = src && (src.src || src); if (sm && sm.drainT > 0 && sm.max) { sm.hp = Math.min(sm.max, sm.hp + Math.round(sm.max * 0.01)); float(sm.x, sm.y - sm.spr.h - 20, '흡혈', '#FF4A3A'); }   // v173 흡혈 · 3중첩 · 데스마크
          if (sm && sm.def && sm.def.stack) { G.stackN = (G.stackN || 0) + 1; if (G.stackN >= 3) { G.stackN = 0; dmg = Math.round(dmg * 2.5); Fx.nova(G.px, G.py - 30, 70, [sm.el || 'fire', 'fire']); float(G.px, G.py - 100, '표식 폭발!', '#FF4A3A'); } }
          if (G.dmark) G.dmark.acc += dmg; }
        S.hp -= dmg; G.inv = 0.35; G.lastHit = 0; G.hurt = 0.22; G.shake = Math.max(G.shake, 3);
        G.texts.push({ x: G.px + rand(-8, 8), y: G.py - 64, text: '-' + dmg, color: el ? ELEM[el].color : '#FF6A6E', t: 0, dmg: true });
        Fx.hit(G.px, G.py - 28, [el || 'fire'], false);
        if (S.hp <= 0) { S.hp = 0; die(); return dmg; }
        if (el) pStatus(el, dmg, src);
        return dmg;
      }
      function die() {
        if (godOn()) { S.hp = Math.max(1, ST.hp); return; }   // v176 무적 아이디는 쓰러지지 않음
        if (G.duel) { duelLose('ko'); return; }   // v143 결투에서 쓰러짐 = 패배 (경험치 안 잃음)
        G.dead = true; const loss = Math.round(D.F.need(S.lv) * (CFG.deathExpLoss || 0.05));
        S.exp = Math.max(0, S.exp - loss);
        const risk = deathRisk(), gone = risk ? vaporize() : [];
        if (gone.length) { restat(); S.hp = 0; save(true); }   // 바로 저장 (새로 고침으로 피하지 못하게)
        openPanel('dead', { loss, risk, gone });
      }
      /* v145 죽음의 위험: 권장 Lv.101 이상 사냥터(저승 관문 · 지도 만들기 Lv.101~)에서 쓰러지면
       *  착용 장비 · 가방 속 장비가 하나하나 CFG.deathVanish(2%) 확률로 증발. 사냥터 1~100 은 아무것도 안 사라짐 */
      const deathRisk = () => { const M = G.map && G.map.M; return !!(M && M.kind === 'field' && !M.arena && !M.train && (M.rec || 0) >= (CFG.deathRiskLv || 101)); };
      function vaporize() {
        const p = CFG.deathVanish != null ? CFG.deathVanish : 0.02, gone = [];
        Object.keys(S.eq).forEach(slot => { const id = S.eq[slot]; if (id && ITEMS[id] && ITEMS[id].slot && Math.random() < p) { gone.push({ id, where: '착용' }); delete S.eq[slot]; } });
        S.inv.slice().forEach(x => { const it = ITEMS[x.id]; if (!it || !it.slot) return; let k = 0; for (let i = 0; i < x.n; i++) if (Math.random() < p) k++; for (let i = 0; i < k; i++) { takeItem(x.id, 1); gone.push({ id: x.id, where: '가방' }); } });
        return gone;
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
        if (G.pst && G.pst.stun > 0) return;   // v87 기절 중엔 마법 못 씀
        if (G.pst && (G.pst.silence > 0 || G.pst.fear > 0)) { if (!(G.silT > performance.now())) { G.silT = performance.now() + 900; say(G.pst.fear > 0 ? '공포에 질려 마법을 쓸 수 없어요!' : '침묵! 지금은 마법을 쓸 수 없어요', 1.2); } return; }   // v173
        if (G.duel && G.duel.st !== 'fight') return;   // v143 결투 시작 전·끝난 뒤
        if (G.map.M.kind !== 'field' && !G.map.M.train && sk.kind !== 'heal' && sk.kind !== 'shield') {   // v144 훈련장은 공격 마법 됨
          say(G.room ? '건물 안에서는 공격 마법을 쓸 수 없어요' : '마을에서는 공격 마법을 쓸 수 없어요'); return; }
        if ((G.cds[id] || 0) > 0) return;
        if (S.mp < sk.mp) { say('마나가 부족해요 (X: 마나 포션)'); return; }
        S.mp -= sk.mp; G.cds[id] = sk.cd; Fx.castCircle(G.px, G.py, sk.els, !!sk.fusion || sk.lv >= 60); G.poseK = 'c'; G.poseUntil = performance.now() + 380;   // v79 마법 동작
        G.mot = Fx.motionFor ? Fx.motionFor(sk) : null; G.motEl = sk.els[0];   // v153 마법마다 몸 동작 (vfx.js)
        if (G.mot) { G.poseUntil = performance.now() + Math.max(380, G.mot.dur * 800); if (G.mot.k === 'ult') G.flash = Math.max(G.flash || 0, 0.35); if (G.mot.k === 'slam') setTimeout(() => { G.shake = Math.max(G.shake || 0, 9); }, G.mot.dur * 620); }
        if (net && net.joined) { const [adx, ady] = aimDir(sk.len || 420); net.cast({ id, x: Math.round(G.px), y: Math.round(G.py - 22), dx: +adx.toFixed(2), dy: +ady.toFixed(2) }); }
        const els = sk.els, col = ELEM[els[0]].color, col2 = ELEM[els[els.length - 1]].light, base = ST.mag * sk.pow;
        const ox = G.px, oy = G.py - 22;
        Fx.use(sk.fusion ? null : sk.id);   // v102 기본 마법마다 다른 효과
        if (sk.fusion && Fx.useV) Fx.useV('f:' + sk.name);   // v153 융합 마법은 비슷한 기본 마법 그림을 빌려 씀
        if (sk.kind === 'bolt') {
          const [dx, dy] = aimDir(420), n = sk.count || 1, sp = 430 * (sk.speed || 1);
          for (let i = 0; i < n; i++) { const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.18; G.shots.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1, dmg: base, els, pierce: !!sk.pierce, hit: new Set(), r: 9, color: col, color2: col2, mine: true, sid: sk.fusion ? null : sk.id, vid: sk.fusion ? 'f:' + sk.name : sk.id }); }
        } else if (sk.kind === 'nova') {
          const r = sk.radius || 120; Fx.nova(ox, oy, r, els); G.shake = Math.max(G.shake, r > 150 ? 6 : 3);
          G.mons.forEach(m => { if (!m.dead && Math.hypot(m.x - ox, m.y - m.spr.h / 2 - oy) < r + (m.hr || m.r)) hitMon(m, base, els); });
        } else if (sk.kind === 'beam') {
          const [dx, dy] = aimDir(sk.len || 300), len = sk.len || 300, w = sk.w || 30;
          Fx.beam(ox, oy, dx, dy, len, w, els); G.shake = Math.max(G.shake, 3);
          G.mons.forEach(m => { if (m.dead) return; const mx = m.x - ox, my = m.y - m.spr.h / 2 - oy, along = mx * dx + my * dy, off = Math.abs(mx * dy - my * dx); if (along > -10 && along < len && off < w / 2 + (m.hr || m.r)) hitMon(m, base, els); });
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
          const [dx, dy] = aimDir(sk.len || 220); G.dash = { dx, dy, left: sk.len || 220, hit: new Set(), dmg: base, els, color: col }; G.inv = 0.45; Fx.dash(G.px, G.py - 22, dx, dy, sk.len || 220);
        } else if (sk.kind === 'heal') {
          const v = Math.round(ST.hp * sk.pow); S.hp = Math.min(ST.hp, S.hp + v); float(G.px, G.py - 70, '+' + v, '#3DDC84', true);
          Fx.heal(G.px, G.py - 28, sk.pow > 0.4);
        } else if (sk.kind === 'shield') {
          G.shield = { pow: sk.pow, t: sk.dur || 6, color: col, el: els[0], sid: sk.fusion ? null : sk.id }; if (!Fx.shieldCast(G.px, G.py - 28, sk.id)) Fx.burst(G.px, G.py - 28, 20, Fx.pal(els[0]), { min: 60, max: 160, shape: 'star', lmin: 0.4, lmax: 0.7 }); say(`${sk.name}: 받는 피해 ${Math.round(sk.pow * 100)}% 감소`, 1.6);
        }
        Fx.use(null);
      }
      function basicAttack() {
        if (G.atkCd > 0 || G.dead || (G.pst && (G.pst.stun > 0 || G.pst.fear > 0)) || (G.duel && G.duel.st !== 'fight')) return;
        G.atkCd = ST.atkCd; G.poseK = 'a'; G.poseUntil = performance.now() + 220;   // v79 공격 동작
        const staff = S.eq.weapon && ITEMS[S.eq.weapon].look === 'staff';
        const [dx, dy] = aimDir(staff ? 150 : 70);
        G.face = dx < 0 ? -1 : 1;
        Fx.slash(G.px, G.py - 24, dx, dy, staff, !staff && window.GoRPGKingRoom && kingSwordOn());   // v151 왕을 죽인 검: 전당 안에서 금빛 불꽃 빛 꼬리
        if (G.map.M.kind !== 'field' && !G.map.M.train) return;
        if (staff) { G.shots.push({ x: G.px, y: G.py - 24, vx: dx * 380, vy: dy * 380, life: 0.42, dmg: ST.atk * 0.6 + ST.mag * 0.5, els: [], look: ['light'], pierce: false, hit: new Set(), r: 7, color: '#C8A8FF', color2: '#FFFFFF', mine: true }); return; }
        G.mons.forEach(m => {
          if (m.dead) return; const mx = m.x - G.px, my = m.y - m.spr.h / 2 - (G.py - 24), d = Math.hypot(mx, my);
          if (d < 58 + m.r && (d < 24 + m.r || (mx * dx + my * dy) / (d || 1) > 0.2)) hitMon(m, ST.atk, []);
        });
      }
      /* v125 귀환 (선생님 11/12: 물약 오른쪽 · 가까운 마을로 바로 · 쿨타임 2분) — 사냥터면 그 지역 마을, 저승 등은 마지막 마을 */
      const RECALL_CD = 120;
      const recallLeft = () => Math.max(0, ((S.recallAt || 0) + RECALL_CD * 1000 - Date.now()) / 1000);
      function recallTown() {
        const M = MAPBY[S.map]; if (!M || M.hell) return S.home;
        const v = 'v' + ((M.region || 0) + 1); return MAPBY[v] ? v : S.home;
      }
      function doRecall() {
        if (!S || G.dead || pane) return;
        if (G.duel) { say('결투 중에는 귀환할 수 없어요'); return; }
        if (G.room || (MAPBY[S.map] && MAPBY[S.map].kind === 'village')) { say('이미 마을이에요'); return; }
        const left = recallLeft(); if (left > 0) { say(`귀환은 ${Math.ceil(left)}초 뒤에 쓸 수 있어요`); return; }
        S.recallAt = Date.now(); const to = recallTown(); enter(to, 'door'); say(`🏠 ${MAPBY[to].name}(으)로 돌아왔어요`, 2.6);
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
        if (G.duel) { say('결투 중에는 물약을 쓸 수 없어요'); return; }   // v143
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
        const map = G.map, ok = (x, y) => !solidAt(map, x - 8, y - 2) && !solidAt(map, x + 8, y - 2) && !solidAt(map, x, y), x0 = m.x, y0 = m.y;
        if (m.ghost > 0) { m.x = clamp(m.x + dx, TS + 8, map.w * TS - TS - 8); m.y = clamp(m.y + dy, TS + 8, map.h * TS - TS - 2); return true; }   // v202 끼인 보스: 잠깐 나무·바위를 지나감
        if (ok(m.x + dx, m.y)) m.x += dx; else m.wt = 0;
        if (ok(m.x, m.y + dy)) m.y += dy; else m.wt = 0;
        return m.x !== x0 || m.y !== y0;
      }
      // v202 선생님 11/24 '보스가 나무·바위에 걸려 못 움직인다': 쫓아갈 때 막히면 옆으로 돌아가고(모든 몬스터), 보스는 1.2초 넘게 막히면 잠깐 통과
      function chaseMon(m, ux, uy, sp, dt) {
        const x0 = m.x, y0 = m.y;
        if (m.detour > 0) { m.detour -= dt; if (!moveMon(m, m.dvx * sp, m.dvy * sp)) m.detour = 0; moveMon(m, ux * sp * 0.35, uy * sp * 0.35); }
        else moveMon(m, ux * sp, uy * sp);
        const got = (m.x - x0) * ux + (m.y - y0) * uy;   // 플레이어 쪽으로 실제로 간 만큼
        if (got < sp * 0.3) {
          m.stuckT = (m.stuckT || 0) + dt;
          if (!(m.detour > 0)) { const s0 = m.dside || (Math.random() < 0.5 ? 1 : -1);
            for (const side of [s0, -s0]) { const px = -uy * side, py = ux * side, sx = m.x, sy = m.y; if (moveMon(m, px * sp, py * sp)) { m.detour = 0.5; m.dvx = px; m.dvy = py; m.dside = side; break; } m.x = sx; m.y = sy; } }
          if (m.boss && m.stuckT > 1.2) { m.ghost = 1.0; m.stuckT = 0; m.detour = 0; }
        } else { m.stuckT = Math.max(0, (m.stuckT || 0) - dt * 2); if (got > sp * 0.8) m.dside = 0; }
      }

      /* ---------- 사람(NPC) ---------- */
      // v60 대장장이: 대장간 앞에 서 있음 · 가까이 가면 강화 창
      const smithNpc = map => (map.forge ? [{ key: 'forge', def: D.npcDef(D.SMITH, map.M.region), x: (map.forge.x + map.forge.w + 1) * TS, y: (map.forge.y + map.forge.h + 0.2) * TS, face: -1, ph: 2, smith: true }] : []);
      // v85 역참지기: 역참 앞에 서 있음 · 가까이 가면 마을 이동 창
      const stationNpc = map => (map.station ? [{ key: 'station', def: D.npcDef(D.STATION, map.M.region), x: map.station.nx * TS, y: (map.station.y + map.station.h + 0.4) * TS, face: map.station.nx > map.station.x ? -1 : 1, ph: 3, smith: true }] : []);
      const villageNo = id => +String(id).slice(1) - 1;   // 'v3' → 2
      const stationFront = id => { const m = getMap(id), st = m.station; return st ? { x: (st.path + 0.5) * TS, y: (st.y + st.h + 1.2) * TS } : doorFront(m); };
      function stationGo(id) {
        const M = MAPBY[id]; if (!M || M.kind !== 'village' || G.map.M.kind !== 'village' || id === S.map) return;
        const to = villageNo(id), fee = D.stationFee(villageNo(S.map), to), need = D.LV_RANGE[to][0];
        if (S.lv < need) { say(`Lv.${need} 부터 갈 수 있어요`); return; }
        if (S.gold < fee) { say('골드가 모자라요'); return; }
        S.gold -= fee; pane = null; panel.hidden = true; G.paused = false;
        enter(id, stationFront(id)); say(`역참 말을 타고 ${M.name}에 왔어요 (−${fmtN(fee)} G)`, 3); markDirty(true);
      }
      // v157 선생님 11/17: 사방신 넷을 모두 이겨 '사방신 모두 방'에 들어갈 자격이 되면, 역참에서 '광개토대왕 던전 어귀'(사방신 모두 방 바로 앞, 지킴이 NPC 옆)로 바로 감 · 이용료 D.STATION.sxFee
      function stationSx() {
        if (G.map.M.kind !== 'village' || godsDone() < 4) return;
        const fee = D.STATION.sxFee || 3000;
        if (S.gold < fee) { say('골드가 모자라요'); return; }
        const m = getMap('sx_npc'); if (!m) return;
        S.gold -= fee; pane = null; panel.hidden = true; G.paused = false;
        enter('sx_npc', { x: (m.w >> 1) * TS - 50, y: ((m.h >> 1) + 0.6) * TS }); say(`역참 말을 타고 광개토대왕 던전 어귀에 왔어요 (−${fmtN(fee)} G) · 위쪽이 사방신 모두 방이에요`, 4); markDirty(true);
      }
      // v69 저승차사 강림: Lv.100 이 되면 마지막 마을(도원수 진영) 큰길 오른쪽에 나타남
      const hellNpc = map => (map.M.region === D.REGIONS.length - 1 && S.lv >= D.MAX_LV ? [{ key: 'hell', def: D.HELL.npc, x: window.__GoRPGParts.VXf(30.5) * TS, y: (map.mid + 0.2) * TS, face: -1, ph: 1, smith: true }] : []);   // v158 넓은 마을
      function talk(n) {
        if (n.guard || !['potion', 'school', 'chief', 'castle', 'forge', 'hell', 'station', 'sxnpc', 'ysnpc', 'ysmural'].includes(n.key)) { n.say = pick(n.def.lines || ['…']); n.sayT = 3; return; }
        n.say = null; openPanel(n.key, { npc: n, hello: n.def.hello && n.def.hello.length ? pick(n.def.hello) : '' });   // v180 인사말이 없는 NPC(송희립·벽화 틀)도 열리게
      }
      function updateNpcs(dt) {
        (G.npcs || []).forEach(n => {
          const d = Math.hypot(G.px - n.x, G.py - n.y);
          if (n.sayT > 0) n.sayT -= dt;
          if (n.walker) {   // 마을 사람: 큰길에서 좌우로 천천히 · 내가 가까이 오면 멈춰서 말 걸기
            if (d < 90) { n.vx = 0; if (!n.near) { n.near = true; n.say = pick(n.def.lines); n.sayT = 3.2; } }
            else { n.near = false; n.wt -= dt; const sp = n.spd || 32, rg = n.range == null ? 60 : n.range; if (n.wt <= 0) { n.wt = rand(1.5, 3.5); n.vx = rg && Math.random() < 0.6 ? (Math.random() < 0.5 ? -1 : 1) * sp : 0; if (Math.abs(n.x - n.hx) > rg) n.vx = Math.sign(n.hx - n.x) * sp; } else if (n.vx && Math.abs(n.x - n.hx) > rg + 4 && Math.sign(n.vx) === Math.sign(n.x - n.hx)) n.vx = -n.vx; }   // v80 병사: 순찰 폭(range)·빠르기(spd)
            const nx = n.x + n.vx * dt; if (n.vx && !solidAt(G.map, nx + Math.sign(n.vx) * 10, n.y - 4)) n.x = nx; else n.vx = 0;
            n.moving = !!n.vx; if (n.vx) n.face = n.vx < 0 ? -1 : 1; else if (d < 160) n.face = G.px < n.x ? -1 : 1;
            n.walk = (n.walk || 0) + (n.moving ? dt : 0);
          } else if (!n.guard && d < 220) n.face = G.px < n.x ? -1 : 1;
          if (!n.walker && n.def.nearSay) {   // v162 서 있는 NPC: 가까이 오면 한마디 (가까이 있는 동안 6초마다 다시)
            if (d < 180) { n.nst = (n.nst || 0) - dt; if (!n.near || n.nst <= 0) { n.near = true; n.nst = 6; n.say = n.def.nearSay; n.sayT = 3.5; } }
            else n.near = false;
          }
        });
      }

      /* ---------- 한 틱 ---------- */
      /* v190 선생님 11/23: 지역마다 다른 배경음악 (Suno) — 마을·사냥터 = bgm.mp3 · 저승 = hell · 광개토대왕 던전 = sx · 이순신 던전 = ys · 가까이(700px) 살아 있는 보스가 있으면 boss
       *  GoBGM 의 audio 하나에서 src 만 바꿈 (음악 끄기·켜기는 그대로) · 보스가 사라져도 4초 동안은 보스 음악 유지 */
      const TRACK = { bgm: 'bgm/bgm.mp3', hell: 'bgm/hell.mp3', sx: 'bgm/sx.mp3', ys: 'bgm/ys.mp3', boss: 'bgm/boss.mp3' };
      function bgmPick(M) {
        let k = M.hell ? 'hell' : M.sx ? 'sx' : M.ys ? 'ys' : 'bgm';
        if (!G.room && G.mons.some(m => !m.dead && m.boss && Math.abs(m.x - G.px) < 700 && Math.abs(m.y - G.py) < 500)) G.bossMusic = 4; else G.bossMusic = Math.max(0, (G.bossMusic || 0) - 0.5);
        if (G.bossMusic > 0) k = 'boss';
        const a = BGM.audio; if (!a) return; const cur = ((a.getAttribute('src') || a.src || '').match(/bgm\/(\w+)\.mp3/) || [])[1]; if (!cur || cur === k) return;
        const st = window.GoSettings && window.GoSettings.get(GAME); if (!st) return;
        try { a.src = st.folder + '/' + TRACK[k]; a.load(); if (BGM.wanted && !BGM.isMuted()) a.play().catch(() => {}); } catch (e) { /* noop */ }
      }
      function update(dt) {
        const map = G.map, M = map.M;
        if (pane === 'ysmural' && M.ys) { G.inv = Math.max(G.inv, 0.3); if (G.title) G.title.t += dt; return; }   // v180 선생님 11/23: 벽화 퍼즐 중엔 시간이 멈춤 (몬스터·탄·기술 모두 멈추고 나도 안 다침, 혼자 하는 던전)
        S.play += dt; G.saveT += dt; G.srvT += dt; if (msgT > 0 && (msgT -= dt) <= 0) msgEl.hidden = true;
        if ((G.trackT = (G.trackT || 0) - dt) <= 0) { G.trackT = 0.5; bgmPick(M); }   // v190 지역·보스 음악
        G.atkCd -= dt; G.inv -= dt; G.lastHit += dt;
        duelTick(dt);   // v143 결투
        if (G.trade && G.trade.pend && (G.trade.pendT += dt) > 8) tradeUnlock('상대의 답이 없어요. 다시 확인을 눌러 주세요');   // v146
        if (G.pst) {   // v87 내 상태 효과 시간
          const P = G.pst; ['slow', 'stun', 'stunImm', 'curse', 'root', 'silence', 'fear', 'ccImm', 'air'].forEach(k2 => { if (P[k2] > 0) P[k2] -= dt; });
          if (P.burn) { P.burn.t -= dt; P.burn.tick -= dt; if (P.burn.tick <= 0 && !G.dead && !godOn()) { P.burn.tick = 0.5; const bd = Math.max(1, Math.round(P.burn.dps * 0.5)); S.hp -= bd; G.texts.push({ x: G.px + rand(-6, 6), y: G.py - 60, text: '-' + bd, color: '#FF8A3D', t: 0, dmg: true }); if (S.hp <= 0) { S.hp = 0; die(); } } if (P.burn && P.burn.t <= 0) P.burn = null; }
        }
        if (G.godT > 0) G.godT -= dt; G.shake = Math.max(0, G.shake * Math.pow(0.002, dt) - dt); G.hurt = Math.max(0, G.hurt - dt); G.flash = Math.max(0, G.flash - dt); if (G.title) G.title.t += dt;
        Fx.updateParts(dt, { x: G.px, y: G.py }); Fx.updateFx(dt); if (!G.room) Fx.ambient(M.region, dt, W, H, cam);
        Object.keys(G.cds).forEach(k => { G.cds[k] -= dt; });
        if (G.shield && (G.shield.t -= dt) <= 0) G.shield = null;
        // 자연 회복
        const reg = (M.kind !== 'field' ? 3 : 1) * (G.lastHit > 5 ? 1 : 0.25);
        if (!G.duel) S.hp = Math.min(ST.hp, S.hp + ST.hp * 0.012 * reg * dt);   // v143 결투 중엔 HP 저절로 안 참
        S.mp = Math.min(ST.mp, S.mp + ST.mp * 0.02 * reg * (ST.mpRegen / 100) * dt);   // v44 지혜 → 마나 회복 · v166 고침: 이 줄이 위 줄 주석 뒤에 붙어 있어 마나가 저절로 전혀 안 찼음

        // 입력 → 이동
        let mx = 0, my = 0; const K = G.keys;
        if (K.ArrowLeft) mx--; if (K.ArrowRight) mx++; if (K.ArrowUp) my--; if (K.ArrowDown) my++;   // v53: 이동은 방향키 (W 는 융합 마법)
        if (G.joy && G.joy.on) { mx = G.joy.vx; my = G.joy.vy; }
        if (G.duel && G.duel.st !== 'fight') { mx = 0; my = 0; }   // v143 결투 시작 전·끝난 뒤엔 못 움직임
        if (G.pst && G.pst.fear > 0 && G.pst.fearSrc) { const fa = Math.atan2(G.py - G.pst.fearSrc.y, G.px - G.pst.fearSrc.x); mx = Math.cos(fa); my = Math.sin(fa); }   // v173 공포: 저절로 도망
        const ml = Math.hypot(mx, my);
        if (G.dash) {
          const step = Math.min(G.dash.left, 1100 * dt); movePlayer(G.dash.dx * step, G.dash.dy * step); G.dash.left -= step;
          G.mons.forEach(m => { if (!m.dead && !G.dash.hit.has(m) && Math.hypot(m.x - G.px, m.y - m.spr.h / 2 - (G.py - 20)) < 40 + (m.hr || m.r)) { G.dash.hit.add(m); hitMon(m, G.dash.dmg, G.dash.els); } });
          if (G.dash.left <= 0) G.dash = null;
        } else if (ml > 0.15) {
          const sp = 150 * (1 + ST.spd / 100) * dt * Math.min(1, ml) * (G.pst && G.pst.slow > 0 ? 0.6 : 1) * (G.pst && (G.pst.stun > 0 || G.pst.root > 0) ? 0 : 1);   // v87 느려짐 · 기절 · v173 속박
          G.fx = mx / ml; G.fy = my / ml; if (Math.abs(mx) > 0.2) G.face = mx < 0 ? -1 : 1;
          G.view = Math.abs(G.fy) > Math.abs(G.fx) * 1.15 ? (G.fy > 0 ? 'f' : 'b') : 's';   // v107 아래 = 앞모습 · 위 = 뒷모습 · 옆 = 옆모습
          movePlayer(G.fx * sp, G.fy * sp); G.moving = true; G.walk += dt; if (Math.floor(G.walk * 8) !== Math.floor((G.walk - dt) * 8)) Fx.dust(G.px, G.py, M.region === 5 ? 'rgba(255,255,255,.8)' : 'rgba(255,240,210,.55)');
        } else { G.moving = false; G.walk = 0; }
        if ((K.Space || K.KeyJ || G.btnDown.atk) && !(G.duel && G.duel.st !== 'fight')) basicAttack();
        if (net) { const vx = (G.px - (G.lpx == null ? G.px : G.lpx)) / dt, vy = (G.py - (G.lpy == null ? G.py : G.lpy)) / dt; G.lpx = G.px; G.lpy = G.py; net.tick(dt, { x: G.px, y: G.py, vx, vy, face: G.face, lv: S.lv }); }

        // 출구 (v41: 벽 판정 때문에 끝 6px 까지 못 가서 안 넘어가던 것 → 끝 16px 안에 들어오면 넘어감)
        //  v134 출구마다 판정 (위·아래 출구 · 메이커 지도 연결 · 한쪽에 출구 여러 개) — 원래 왼쪽·오른쪽 출구는 예전 그대로 'R'·'L' 자리로
        if (!G.room) {
          const gt = gateAt(map, G.px, G.py);
          if (gt) { const bm = sxBlock(gt.to) || ysBlock(gt.to); if (bm) { sxPush(); say(bm, 3.5); return; } }   // v150 사신의 땅 문
          if (gt) { const T = MAPBY[gt.to]; if (T) { enter(gt.to, T.kind === 'village' && !map.M.ys && !map.M.sx ? 'door' : gt.legacy ? (gt.side === 'l' ? 'R' : 'L') : { from: map.id }); return; } }
          const dg = dungeonAt(map, G.px, G.py);
          if (dg) { const bm = sxBlock(dg.to); if (bm) { G.py += 30; say(bm, 4); return; } }   // v150 숨은 입구: 환생 1번 이상
          if (dg) { const T = MAPBY[dg.to]; if (T) { enter(dg.to, T.kind === 'village' ? 'door' : { from: map.id }); return; } if (!G.dgSaid) { G.dgSaid = true; say('이 던전 입구는 아직 아무 데도 이어지지 않았어요', 2.4); setTimeout(() => { G.dgSaid = false; }, 3000); } }
        }
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
          const nearS = sm.mural ? Math.abs(G.px - sm.x) < 125 && G.py > sm.y - 40 && G.py < sm.y + 46 : Math.hypot(G.px - sm.x, G.py - sm.y) < 40; /* v180 벽화 틀은 틀 앞 어디든 다가가면 열림 */ if (nearS && G.onNpc !== sm) { G.onNpc = sm; talk(sm); return; } if (!nearS && G.onNpc === sm) G.onNpc = null;
        }
        // 건물 문
        //  문 칸에 들어가거나, 문 바로 아래 칸에서 위(↑)로 걸으면 들어감
        const ty = Math.floor((G.py - 4) / TS);
        const door = map.doors.find(b => Math.abs((b.door.x + 0.5) * TS - G.px) < 30 && (ty === b.door.y || (ty === b.door.y + 1 && my < -0.3)));
        if (door && G.onDoor !== door) { G.onDoor = door; enterRoom(door); return; }
        if (!door) G.onDoor = null;

        if (G.ysNav) ysNavTick(dt);   // v173 왜선 대포 · 거북선 방패
        if (!G.bfx) G.bfx = []; bfxTick(dt);   // v173 보스 기술 바닥 효과
        // 몬스터
        G.mons.forEach(m => {
          if (m.pvp) return;   // v143 결투 상대 자리 (움직임은 상대 위치)
          if (m.dummy) { dummyTick(m, dt); return; }   // v144 허수아비
          if (m.dead) { if (m.noRespawn) return; if ((m.respawn -= dt) <= 0) { const n = makeMon(m.def, m.lvl, m.boss); Object.assign(m, n); } return; }
          if (m.ysInv) { m.flash -= dt; return; }   // v173 왜선 단계: 와키자카는 멈춰 서서 지켜봄
          m.flash -= dt; m.cd -= dt * (m.def.aspd || 1); if (m.lunge > 0) m.lunge -= dt; if (m.knock) m.knock *= Math.pow(0.001, dt);
          if (m.burn) { m.burn.t -= dt; m.burn.tick -= dt; if (m.burn.tick <= 0) { m.burn.tick = 0.5; let bd = Math.max(1, Math.round(m.burn.dps * 0.5)); if (m.inv2 > 0 || m.hidden) bd = 0; else if (m.shieldHp > 0) { const k = Math.min(m.shieldHp, bd); m.shieldHp -= k; bd -= k; } if (bd > 0) { m.hp -= bd; float(m.x, m.y - m.spr.h, bd, '#FF9A3D'); if (m.hp <= 0) { killMon(m); return; } } } if (m.burn.t <= 0) m.burn = null; }   // v187 고침: 화상이 '죽지 않는 분노'·땅속·보호막을 뚫고 피해를 주던 것
          if (m.curse > 0) m.curse -= dt;
          if (m.ghost > 0) { m.ghost -= dt; if (m.ghost <= 0 && (solidAt(G.map, m.x, m.y) || solidAt(G.map, m.x - 8, m.y - 2) || solidAt(G.map, m.x + 8, m.y - 2))) m.ghost = 0.15; }   // v202 통과가 끝날 때 나무·바위 속이면 빠져나올 때까지 조금 더
          if (m.def.noCC) { m.stun = 0; m.slow = 0; m.burn = null; m.curse = 0; }   // v177 와키자카: 어디서 걸려도 바로 풀림
          if (m.stun > 0) { m.stun -= dt; return; }
          if (monTick2(m, dt) && !(m.hidden && m.cast)) return;   // v173 알·땅굴·투명·포탑·정령·2단계
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
              if (d > m.r + 12 && !m.cast) chaseMon(m, dx / d, dy / d, sp, dt);
              if (d < m.r + 22 && m.cd <= 0) { m.cd = m.def.hard ? 0.8 : m.boss ? 1.4 : 1.2; m.lunge = 0.25; const md = hitPlayer(m.atk, m.lvl); if (md && m.el && Math.random() < 0.25) pStatus(m.el, md, m); }   // v87 몸통 박치기 = 물리 피해 + 25% 확률로 속성 효과
              if (m.boss) {
                if (m.def.skills || m.skl) bossSkill(m, dt, d);   // v69 저승 보스 기술
                else if (!m.slam && m.cd <= 0.2 && Math.random() < 0.01 + dt) m.slam = { t: 0, x: m.x, y: m.y - 20 };
                const sel = m.el || D.RG_EL[G.map.M.region];
                if (m.slam) { m.slam.t += dt; if (m.slam.t >= 0.9) { const sr = slamRo(m); if (Math.hypot(G.px - m.slam.x, G.py - 20 - m.slam.y) < sr) hitPlayer(m.atk * 1.5, m.lvl, sel, m.slam); Fx.nova(m.slam.x, m.slam.y, sr, [sel, 'earth']); G.shake = Math.max(G.shake, 9); m.slam = null; m.slamRo = 0; m.cd = m.def.slamCd || (m.def.hard ? 1.2 : 2.2); } }   // v171 내려찍기 범위·쿨타임 (광개토대왕 slamR·slamCd)
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
          if (s.upd) s.upd(s, dt);   // v173 유도·부메랑·분열
          s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; Fx.trail(s, dt);
          if (s.life <= 0 || solidAt(map, s.x, s.y + 16) && map.at(Math.floor(s.x / TS), Math.floor((s.y + 16) / TS)) !== 4) return false;
          if (s.ghost) return true;   // 다른 사람 마법 그림 (피해 없음)
          if (s.mine) {
            for (const m of G.mons) {
              if (m.dead || s.hit.has(m)) continue;
              if (Math.hypot(m.x - s.x, m.y - m.spr.h / 2 - s.y) < (m.hr || m.r) + s.r) { s.hit.add(m); hitMon(m, s.dmg, s.els); Fx.shotHit(s); if (!s.pierce) return false; }
            }
          } else if (Math.hypot(G.px - s.x, G.py - 24 - s.y) < 16 + s.r) { hitPlayer(s.dmg, s.lvl, s.el, s); if (s.onHit) s.onHit(s); return false; }
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
          if (f.type === 'strike' && !f.done && f.t >= f.dur * 0.6) { f.done = true; G.mons.forEach(m => { if (!m.dead && Math.hypot(m.x - f.x, m.y - m.spr.h / 2 - f.y) < f.r + (m.hr || m.r)) hitMon(m, f.dmg, f.els); }); }
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
        // v150 큰 보스(사방신)가 가까우면 화면 가운데를 플레이어와 보스 몸 사이로 옮겨 보스가 더 잘 보이게
        let fx = G.px, fy = G.py - 30; const bb = !G.ysNav && G.mons.find(m => m.hr && !m.dead);   // v173 왜선 단계엔 나를 가운데로 (배 8척이 다 보이게)
        if (bb && Math.hypot(bb.x - G.px, bb.y - G.py) < 760) { const k = 0.5, ty = bb.y - (bb.def.float ? 26 : 0) - bb.spr.h * 0.5; fx += (bb.x - fx) * 0.3; fy += (ty - fy) * k; }
        G.camF = G.camF && G.camF.m === map && bb ? { m: map, x: G.camF.x + (fx - G.camF.x) * 0.08, y: G.camF.y + (fy - G.camF.y) * 0.08 } : { m: map, x: fx, y: fy };
        cam.x = map.w * TS <= W ? (map.w * TS - W) / 2 : clamp(G.camF.x - W / 2, 0, map.w * TS - W);   // 작은 지도(건물 안)는 화면 가운데
        cam.y = map.h * TS <= H ? (map.h * TS - H) / 2 + 12 : clamp(G.camF.y - H / 2, 0, map.h * TS - H);
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
        const arrowsV = (Y, xc, dir) => { for (let i = 0; i < 3; i++) { const xx = xc - 33 + i * 22, off = ((now / 300 + i * 0.3) % 1) * 14 * dir; c.globalAlpha = 0.5 + 0.4 * Math.sin(now / 200 + i); c.fillStyle = '#FFF6C2'; c.beginPath(); c.moveTo(xx, Y + off); c.lineTo(xx + 7, Y + off + dir * 14); c.lineTo(xx + 14, Y + off); c.fill(); } c.globalAlpha = 1; };
        (map.gates || []).forEach(g => {   // v134 출구마다 화살표 (위·아래·옆)
          const m2 = (g.a0 + g.a1 + 1) / 2;
          if (g.side === 'l' && cx < 80) { if (g.legacy) arrows(14, -1); else { const yy0 = (m2 - 1) * TS; for (let i = 0; i < 3; i++) { const yy = yy0 + i * 22, off = ((now / 300 + i * 0.3) % 1) * -14; c.globalAlpha = 0.5 + 0.4 * Math.sin(now / 200 + i); c.fillStyle = '#FFF6C2'; c.beginPath(); c.moveTo(14 + off, yy); c.lineTo(off, yy + 7); c.lineTo(14 + off, yy + 14); c.fill(); } c.globalAlpha = 1; } }
          else if (g.side === 'r' && cx > map.w * TS - W - 80) { if (g.legacy) arrows(map.w * TS - 14, 1); else { const yy0 = (m2 - 1) * TS, X = map.w * TS - 14; for (let i = 0; i < 3; i++) { const yy = yy0 + i * 22, off = ((now / 300 + i * 0.3) % 1) * 14; c.globalAlpha = 0.5 + 0.4 * Math.sin(now / 200 + i); c.fillStyle = '#FFF6C2'; c.beginPath(); c.moveTo(X + off, yy); c.lineTo(X + off + 14, yy + 7); c.lineTo(X + off, yy + 14); c.fill(); } c.globalAlpha = 1; } }
          else if (g.side === 'u' && cy < 80) arrowsV(24, m2 * TS, -1);
          else if (g.side === 'd' && cy > map.h * TS - H - 80) arrowsV(map.h * TS - 24, m2 * TS, 1);
        });
        // 바닥 효과
        Fx.drawFx(c, true, now);
        G.pools.forEach(p => Fx.drawPool(c, p, now));
        G.mons.forEach(m => { if (m.slam) Fx.slamWarn(c, m.slam.x, m.slam.y + 20, slamRo(m), Math.min(1, m.slam.t / 0.9), now); });
        G.mons.forEach(m => {   // v69 보스 기술 예고: 칼비 자리 · 돌진 방향
          const k = m.cast; if (!k || m.dead) return;
          if (k.k === 'blades') k.pts.forEach(q => Fx.slamWarn(c, q.x, q.y + 20, 46, Math.min(1, k.t / 1.0), now));
          if (k.k === 'charge' && k.t < 0.7) { c.save(); c.globalAlpha = 0.35 + 0.3 * Math.sin(now / 60); c.strokeStyle = '#FF3A3A'; c.lineWidth = 2 * m.r; c.lineCap = 'round'; c.beginPath(); c.moveTo(m.x, m.y - 10); c.lineTo(m.x + Math.cos(k.a) * 250, m.y - 10 + Math.sin(k.a) * 250); c.stroke(); c.restore(); }
        });
        // 나무·건물·몬스터·나 — 아래쪽(sy)이 큰 것이 앞
        const list = [];
        for (const o of map.objs) { if (o.x > cx + W + 40 || o.x + o.img.width < cx - 40 || o.y > cy + H + 40 || o.y + o.img.height < cy - 40) continue; list.push({ y: o.sy, o }); }
        G.mons.forEach(m => { if (!m.dead && !m.pvp) list.push({ y: m.y, m }); });
        (G.npcs || []).forEach(n => list.push({ y: n.y, n }));
        if (net) net.peers.forEach(pp => list.push({ y: pp.y, pp }));
        if (G.room) drawRoomFx(c, now, false);   // 벽난로 불·촛불 등은 사람보다 먼저 (머리 위 느낌표·말풍선이 가려지지 않게)
        // v149 펫: 나 · 다른 사람 옆을 따라다님 (작은 몬스터 그림)
        const pdt = Math.min(0.1, (now - (G.petT || now)) / 1000); G.petT = now;
        const mp = myPetId(); if (mp && !G.duel) { const q = petFollow(G, G.px - (G.face || 1) * 34, G.py - 4, pdt); list.push({ y: q.y, pet: { id: mp, x: q.x, y: q.y, face: G.px >= q.x ? 1 : -1, ph: 0 } }); }
        if (net) net.peers.forEach(pp => { if (!pp.pet || !PETBY[pp.pet]) return; const q = petFollow(pp, pp.x - (pp.face || 1) * 34, pp.y - 4, pdt); list.push({ y: q.y, pet: { id: pp.pet, x: q.x, y: q.y, face: pp.x >= q.x ? 1 : -1, ph: 2 } }); });
        list.push({ y: G.py, me: true }); list.sort((a, b) => a.y - b.y);
        list.forEach(e => (e.me ? drawMe(c, now) : e.pet ? drawPetAt(c, e.pet.id, e.pet.x, e.pet.y, e.pet.face, now, e.pet.ph) : e.m ? drawMon(c, e.m, now) : e.n ? drawNpc(c, e.n, now) : e.pp ? drawPeer(c, e.pp, now) : drawObj(c, e.o, now)));
        if (G.ysNav) drawYsNav(c, now);   // v173 왜선 · 거북선
        if (G.bfx) drawBossFx(c, now);   // v173 보스 기술 표시
        drawSasinFx(c, map, now);   // v150 사신의 땅 (바위 글씨 · 사방신 불 · 왕을 죽인 검 빛)
        sayFlush(c);   // v158 말풍선은 비석보다 위에
        if (G.room) {
          const ex = map.exit, dx = (ex.x0 + ex.x1 + 1) / 2 * TS, dy = (ex.y + 0.5) * TS, k = Math.abs(Math.sin(now / 300));
          c.font = '13px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = '#1D2340'; c.strokeText('▼ 나가기', dx, dy - 22 + k * 3); c.fillStyle = '#FFF6C2'; c.fillText('▼ 나가기', dx, dy - 22 + k * 3);
        }
        // 분수 물보라
        if (map.fountain && Math.random() < 0.5) Fx.emit({ x: (imgOk('bld_fountain') ? (map.fx + 1) * TS - 24 : map.fountain.x) + rand(-4, 4), y: imgOk('bld_fountain') ? (map.fy + 1) * TS - 26 : map.fountain.y, vx: rand(-50, 50), vy: rand(-150, -90), g: 420, life: 0.7, size: 3, color: pick(['#FFFFFF', '#BDE8FF', '#8AD0FF']), shape: 'drop', add: false });
        // 탄
        G.shots.forEach(s => Fx.drawShot(c, s, now));
        // 빛나는 효과 · 입자
        Fx.drawFx(c, false, now);
        Fx.drawParts(c, view);
        // 글자 (톡 튀어나왔다가 올라가며 사라짐)
        c.textAlign = 'center'; c.textBaseline = 'middle';
        let lastF = '';
        G.texts.forEach(t => {
          const k = t.t / 1.1, pop = t.t < 0.12 ? 0.6 + t.t / 0.12 * 0.7 : t.t < 0.22 ? 1.3 - (t.t - 0.12) / 0.1 * 0.3 : 1, size = Math.round((t.big ? 22 : t.dmg ? 17 : 14) * pop / 3) * 3;   // v174 렉: 글자 크기를 3px 단위로 (글꼴을 매번 새로 만들지 않게)
          c.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.5) * 2); const fnt = size + 'px "Jua", "Malgun Gothic", sans-serif'; if (lastF !== fnt) { c.font = lastF = fnt; }
          const y = t.y - t.t * 40; c.lineWidth = 4; c.strokeStyle = '#1D2340'; c.strokeText(t.text, t.x, y); c.fillStyle = t.color; c.fillText(t.text, t.x, y);
        });
        c.globalAlpha = 1;
        // 출구 이름
        c.font = '13px "Jua", "Malgun Gothic", sans-serif';
        const mapLabel = M => (M.kind === 'village' ? M.name : M.custom ? `${M.name} (Lv.${M.rec})` : `${M.no}. ${M.name} (Lv.${M.rec})`);
        const ex = (id, x, al, yy, pre, post) => { const M = MAPBY[id]; if (!M) return; const t = (pre || (al === 'left' ? '← ' : '')) + mapLabel(M) + (post || (al === 'right' ? ' →' : '')), y = yy == null ? (map.mid + 3.4) * TS : yy; c.textAlign = al; c.lineWidth = 3; c.strokeStyle = '#1D2340'; c.strokeText(t, x, y); c.fillStyle = '#FFFFFF'; c.fillText(t, x, y); };
        (map.gates || []).forEach(g => {   // v134 출구 이름 (위·아래·옆)
          const m2 = (g.a0 + g.a1 + 1) / 2;
          if (g.side === 'l' && cx <= 4) ex(g.to, 8, 'left', g.legacy ? null : (m2 + 2.9) * TS);
          else if (g.side === 'r' && cx >= map.w * TS - W - 4) ex(g.to, map.w * TS - 8, 'right', g.legacy ? null : (m2 + 2.9) * TS);
          else if (g.side === 'u') ex(g.to, m2 * TS, 'center', 2.1 * TS, '↑ ', ' ');
          else if (g.side === 'd') ex(g.to, m2 * TS, 'center', (map.h - 1.5) * TS, '↓ ', ' ');
        });
        c.restore();
        // 지역 분위기 (어두운 지역은 나·빛나는 것 둘레만 밝게)
        glowLights.length = 0;
        glowLights.push({ x: G.px - cx, y: G.py - 30 - cy, r: 190, col: '#FFF6C2' });
        map.glows.forEach(g => { const x = g.x - cx, y = g.y - cy; if (x > -100 && x < W + 100 && y > -100 && y < H + 100) glowLights.push({ x, y, r: g.r, col: g.col, a: 0.85 }); });
        G.shots.forEach(s => { if (s.mine) glowLights.push({ x: s.x - cx, y: s.y - cy, r: 60, col: Fx.pal((s.els && s.els[0]) || 'light')[2] }); });
        G.pools.forEach(p => glowLights.push({ x: p.x - cx, y: p.y - cy, r: p.r * 1.2 }));
        if (G.ysNav) { const N = G.ysNav; if (N.bless) glowLights.push({ x: G.px - cx, y: G.py + 20 - cy, r: 230, col: '#FFE9A0' }); N.ships.forEach(sh => { const p = ysShipPos(N, sh); glowLights.push({ x: p.x - cx, y: p.y - 40 - cy, r: 130, col: '#FFD8B0', a: 0.7 }); }); }   // v173 배가 어둠에 묻히지 않게
        if (G.room) {   // 건물 안: 따뜻한 빛 + 가장자리 어둡게
          c.save(); c.globalCompositeOperation = 'lighter';
          map.glows.forEach(g => { const fl = 0.85 + 0.15 * Math.sin(now / 130 + g.x); Fx.drawGlow(c, g.x - cx, g.y - cy, g.r, g.col, 0.32 * fl); });
          c.restore();
          const vg = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); vg.addColorStop(0, 'rgba(10,14,36,0)'); vg.addColorStop(1, 'rgba(10,14,36,.55)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
        } else Fx.drawAmbient(c, map.R === D.REGIONS[map.M.region] ? map.M.region : 0, W, H, { x: cx, y: cy }, now, glowLights);
        if (map.M && map.M.hell && !map.noTint) { c.fillStyle = `rgba(150, 20, 30, ${0.2 + Math.sin(now / 900) * 0.04})`; c.fillRect(0, 0, W, H); }   // v69 저승: 붉은 기운
        if (G.hurt > 0) { c.fillStyle = 'rgba(255,40,60,' + (G.hurt * 1.2).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
        if (G.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + (G.flash * 1.5).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
        drawHud(c, now);
        if (map.M.ys && S.ysMural && !G.room) drawYsBless(c, now);   // v173 이순신의 축복 (이 던전 안에서만)
        if (G.touch) drawTouch(c);
        if (pane === 'ysmural' && G.map.M.ys) { c.save(); c.fillStyle = 'rgba(60,120,240,.16)'; c.fillRect(0, 0, W, H); c.font = '16px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#1D2340'; c.fillStyle = '#9AE6FF'; c.strokeText('⏳ 벽화를 맞추는 동안 시간이 멈췄다', W / 2, H - 92); c.fillText('⏳ 벽화를 맞추는 동안 시간이 멈췄다', W / 2, H - 92); c.restore(); }   // v180
        if (!G.dead) drawMenuTab(c, now);   // v173 지도 아래 메뉴 탭 (휴대폰 큰 화면용 · 터치 버튼보다 위에)
      }

      // v150 사신의 땅 그리기: 18번 사냥터 바위 글씨 · 어귀 문의 사방신 불 4개 · 광개토대왕 방의 왕을 죽인 검
      function bubble(c, x, y, text, col) {
        c.font = '14px "Jua", "Malgun Gothic", sans-serif'; const words = text.split(' '), lines = []; let ln = '';
        words.forEach(w => { const t = ln ? ln + ' ' + w : w; if (c.measureText(t).width > 260 && ln) { lines.push(ln); ln = w; } else ln = t; }); if (ln) lines.push(ln);
        const bw = Math.max(...lines.map(l => c.measureText(l).width)) + 24, bh = lines.length * 20 + 14, bx = x - bw / 2, by = y - bh;
        c.fillStyle = 'rgba(14,18,44,.92)'; c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.roundRect ? c.roundRect(bx, by, bw, bh, 8) : c.rect(bx, by, bw, bh); c.fill(); c.stroke();
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; lines.forEach((l, i) => c.fillText(l, x, by + 17 + i * 20));
      }
      // v158 선생님 11/17: 사람 말풍선을 모든 그림(광개토대왕비 등) 위에 — 그리기 끝에 한꺼번에
      function sayFlush(c) {
        const q = G.sayQ; if (!q || !q.length) return; G.sayQ = [];
        q.forEach(([n, top]) => {
          c.save(); c.globalAlpha = Math.min(1, n.sayT * 3); c.font = '13px "Jua", "Malgun Gothic", sans-serif';
          const tw = c.measureText(n.say).width + 20, bx = clamp(n.x - tw / 2, cam.x + 4, cam.x + W - tw - 4), by = top - 30;
          c.fillStyle = '#1D2340'; rr(c, bx - 2, by - 2, tw + 4, 30, 9); c.fill(); c.beginPath(); c.moveTo(n.x - 7, by + 26); c.lineTo(n.x + 7, by + 26); c.lineTo(n.x, by + 36); c.fill();
          c.fillStyle = '#FFFFFF'; rr(c, bx, by, tw, 26, 8); c.fill(); c.beginPath(); c.moveTo(n.x - 5, by + 25); c.lineTo(n.x + 5, by + 25); c.lineTo(n.x, by + 32); c.fill();
          c.fillStyle = '#1D2340'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(n.say, bx + 10, by + 14); c.restore();
        });
      }
      function drawSasinFx(c, map, now) {
        const GS = map.gStele;   // v149 구리마을 광개토대왕비: 가까이 가면 비문 (선생님 그림이 오면 그 그림을 위에 덮어 그림)
        if (GS) { const im = img79(GS.img); if (im) c.drawImage(im, Math.round(GS.x - im.naturalWidth / 2), Math.round(GS.y - im.naturalHeight + 6));
          if (Math.hypot(G.px - GS.x, G.py - GS.y) < 120) bubble(c, GS.x, GS.y - (im ? im.naturalHeight : 132) - 10, GS.name + ' — ' + GS.text, '#FFD23F'); }
        const R2 = map.sxRock;
        if (R2) { const d = Math.hypot(G.px - R2.x, G.py - R2.y); c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, R2.x, R2.y - 50, 46 + 6 * Math.sin(now / 400), '#9AE6FF', 0.22); c.restore(); if (d < 110) bubble(c, R2.x, R2.y - 100, R2.text, '#9AE6FF'); }
        const M = map.M; if (!M.sx) return;
        const gate = M.sx === 'npc' && img79('sx_gate');
        if (gate) {   // v150 Gemini 문 그림 (사신 넷이 새겨진 돌문 + 화로 넷) · 잡은 신의 화로에 불
          const k = 0.85, gw = gate.naturalWidth * k, gh = gate.naturalHeight * k, gx = (map.w >> 1) * TS - gw / 2, gy = 9 * TS - gh;
          c.drawImage(gate, gx, gy, gw, gh);
          [[120, 280, 'cr'], [177, 262, 'jj'], [235, 245, 'bh'], [292, 228, 'hm']].forEach(([bx, by, g], i) => {   // 화로 입구 자리 (그림 320×331 기준)
            const x = gx + bx * k, y = gy + by * k, on = S.sasin[g], col = SX.fire[g];
            if (on) { const f = Math.sin(now / 90 + i) * 3; c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, x, y - 14, 34 + f, col, 0.6); c.restore();
              c.fillStyle = col; c.beginPath(); c.moveTo(x - 11, y); c.quadraticCurveTo(x - 12, y - 18 - f, x, y - 34 - f); c.quadraticCurveTo(x + 12, y - 18 + f, x + 11, y); c.closePath(); c.fill();
              c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(x - 5, y); c.quadraticCurveTo(x - 5, y - 10, x, y - 20 - f); c.quadraticCurveTo(x + 5, y - 10, x + 5, y); c.closePath(); c.fill(); }
            c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#141833'; c.strokeText(SX.godName[g], x, y + 48); c.fillStyle = on ? col : '#9AE6FF'; c.fillText(SX.godName[g], x, y + 48);
          });
        } else if (M.sx === 'npc') {   // 위쪽 문 양옆 불 네 개 (청룡 노랑 · 주작 빨강 · 백호 흙색 · 현무 파랑) — 문 그림을 못 불러왔을 때
          const cx = (map.w >> 1) * TS, y = 3.2 * TS;
          [[-150, 'cr'], [-110, 'jj'], [110, 'bh'], [150, 'hm']].forEach(([dx, g]) => {
            const x = cx + dx, on = S.sasin[g], col = SX.fire[g];
            c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + 26, 16, 5, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#141833'; c.fillRect(x - 5, y, 10, 26); c.fillStyle = '#3A4466'; c.fillRect(x - 3, y, 6, 26);
            c.fillStyle = '#141833'; c.beginPath(); c.moveTo(x - 16, y - 4); c.lineTo(x + 16, y - 4); c.lineTo(x + 10, y + 6); c.lineTo(x - 10, y + 6); c.closePath(); c.fill();
            c.fillStyle = on ? col : '#2A325E'; c.fillRect(x - 12, y - 3, 24, 4);
            if (on) { const f = Math.sin(now / 90 + dx) * 3; c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, x, y - 14, 30 + f, col, 0.55); c.restore();
              c.fillStyle = col; c.beginPath(); c.moveTo(x - 9, y - 4); c.quadraticCurveTo(x - 10, y - 18 - f, x, y - 30 - f); c.quadraticCurveTo(x + 10, y - 18 + f, x + 9, y - 4); c.closePath(); c.fill();
              c.fillStyle = '#FFFFFF'; c.beginPath(); c.moveTo(x - 4, y - 4); c.quadraticCurveTo(x - 4, y - 12, x, y - 18 - f); c.quadraticCurveTo(x + 4, y - 12, x + 4, y - 4); c.closePath(); c.fill(); }
            c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#141833'; c.strokeText(SX.godName[g], x, y + 42); c.fillStyle = on ? col : '#9AE6FF'; c.fillText(SX.godName[g], x, y + 42);
          });
        }
        if (M.sx === 'king' && kingSwordOn()) {   // 왕을 죽인 검이 화려하게 (빛 · 불꽃 · 번쩍)
          if (!G.kingSwordShown) { G.kingSwordShown = true;
            if (!swordToonSeen && toonEl) { swordToonSeen = true; showToon(swordCuts(), { title: '⚔ 왕을 죽인 검', go: '⚔ 싸우러 가기', done: () => { G.swordMorph = { t0: performance.now(), burst: false }; G.shake = 3; } }); }   // v170 처음엔 웹툰 먼저
            else { G.swordMorph = { t0: now, burst: false }; G.shake = 3; } }   // v151 선생님 11/15: 검이 머리 위로 떠올라 허술한 검 → 화려한 검으로 바뀌는 연출 (2.6초)
          const sm = G.swordMorph;
          if (sm) {
            const e = (now - sm.t0) / 1000, old = img79('ic_sw_king'), neu = img79('ic_sw_king2'), sx = G.px, sy = G.py - 80 - Math.min(1, e / 0.6) * 34, S0 = 78;
            if (e > 2.6) G.swordMorph = null;
            else {
              if (!sm.burst && e >= 0.95) { sm.burst = true; G.flash = 0.7; G.shake = 9; G.title = { t: 0, text: '왕을 죽인 검이 깨어났다!', sub: '광개토대왕을 쓰러뜨린 그 검 — 이 검이라야 대왕에게 피해가 들어감 · 상태 이상도 걸림' };
                for (let i = 0; i < 48; i++) { const a = Math.random() * Math.PI * 2, v = rand(120, 320); Fx.emit({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 260, life: 1.1, size: rand(2.5, 4.5), color: pick(['#FFD23F', '#FFFFFF', '#FF8A3D', '#9AE6FF']), shape: 'glow', add: true }); } }
              c.save();
              // 빛기둥: 땅에서 하늘로
              c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, e / 0.4) * (e > 2.1 ? Math.max(0, (2.6 - e) / 0.5) : 1) * 0.55;
              const gr = c.createLinearGradient(sx, G.py, sx, sy - 120); gr.addColorStop(0, 'rgba(255,210,63,0)'); gr.addColorStop(0.35, 'rgba(255,210,63,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
              const bw = 26 + 10 * Math.sin(now / 90); c.fillStyle = gr; c.fillRect(sx - bw / 2, sy - 120, bw, G.py - sy + 120);
              c.globalAlpha = 1; Fx.drawGlow(c, sx, sy, 50 + 25 * Math.min(1, e) + 8 * Math.sin(now / 80), e < 0.95 ? '#9AE6FF' : '#FFD23F', 0.7);
              // 번쩍 고리 (바뀌는 순간)
              if (e >= 0.95 && e < 1.6) { const k = (e - 0.95) / 0.65; c.strokeStyle = '#FFFFFF'; c.globalAlpha = 1 - k; c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.arc(sx, sy, 20 + 140 * k, 0, Math.PI * 2); c.stroke(); c.strokeStyle = '#FFD23F'; c.beginPath(); c.arc(sx, sy, 10 + 90 * k, 0, Math.PI * 2); c.stroke(); }
              c.restore(); c.save(); c.translate(sx, sy);
              if (e < 0.95) {   // 허술한 검이 떨리며 금이 감
                const sh = e > 0.5 ? (e - 0.5) * 10 : 0; c.translate(rand(-sh, sh), rand(-sh, sh)); c.rotate(Math.sin(now / 60) * 0.05 * sh);
                if (old) c.drawImage(old, -S0 / 2, -S0 / 2, S0, S0);
                if (e > 0.55) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = (e - 0.55) / 0.4; if (old) c.drawImage(old, -S0 / 2, -S0 / 2, S0, S0); }
              } else {   // 화려한 검: 크게 나타났다가 손으로 내려옴
                const k = Math.min(1, (e - 0.95) / 0.25), down = e > 2.0 ? (e - 2.0) / 0.6 : 0, sc = (0.6 + 0.6 * k) * (1 - 0.5 * down);
                c.translate((G.face || 1) * 18 * down, 40 * down); c.rotate(Math.sin(now / 200) * 0.06); c.globalAlpha = 1 - 0.6 * down;
                if (neu) c.drawImage(neu, -S0 * sc / 2 - 4, -S0 * sc / 2 - 4, S0 * sc + 8, S0 * sc + 8); else if (old) c.drawImage(old, -S0 / 2, -S0 / 2, S0, S0);
                if (Math.random() < 0.5) Fx.emit({ x: sx + rand(-20, 20), y: sy + rand(-20, 20), vx: rand(-20, 20), vy: rand(-70, -20), g: -10, life: 0.6, size: 2.5, color: pick(['#FFD23F', '#FFFFFF']), shape: 'glow', add: true });
              }
              c.restore();
            }
          }
          const hx = G.px + (G.face || 1) * 18, hy = G.py - 34;
          c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, hx, hy, 38 + 8 * Math.sin(now / 120), '#FFD23F', 0.55); Fx.drawGlow(c, G.px, G.py - 30, 70 + 10 * Math.sin(now / 300), '#FF8A3D', 0.18); c.restore();
          if (Math.random() < 0.6) Fx.emit({ x: hx + rand(-10, 10), y: hy + rand(-16, 10), vx: rand(-30, 30), vy: rand(-90, -30), g: -20, life: 0.7, size: 2.5, color: pick(['#FFD23F', '#FFFFFF', '#FFB13D']) });
        } else if (M.sx !== 'king') G.kingSwordShown = false;
      }
      function drawObj(c, o, now) {
        if (o.ysSign) {   // v174 통영 아래쪽 '이순신 장군님 던전' 나무 푯말
          const cx = o.x + 76, by = o.sy; c.save();
          c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(cx, by, 26, 6, 0, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#5A3A1E'; c.fillRect(cx - 4, by - 58, 8, 58); c.fillStyle = '#7A4E28'; c.fillRect(cx - 3, by - 58, 3, 58);
          c.fillStyle = '#3A2410'; rr(c, cx - 76, by - 92, 152, 40, 5); c.fill(); c.fillStyle = '#C8955A'; rr(c, cx - 73, by - 89, 146, 34, 4); c.fill();
          c.font = '13px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1D2340'; c.fillText('⚓ 이순신 장군님 던전', cx, by - 80); c.font = '11px "Jua", "Malgun Gothic", sans-serif'; c.fillText('↓ 통영 남쪽 바닷길', cx, by - 63);
          c.restore(); return;
        }
        if (o.sign) { const ri = D.SASIN.rockImg && img79(D.SASIN.rockImg); if (ri) { const ww = 104, hh = ri.naturalHeight * ww / ri.naturalWidth, cx = o.x + o.img.width / 2; c.drawImage(ri, Math.round(cx - ww / 2), Math.round(o.sy - hh + 8), ww, Math.round(hh)); } else c.drawImage(o.img, Math.round(o.x), Math.round(o.y)); return; }   // v151 입구 바위: Gemini 그림(SASIN.rockImg)이 들어오면 그림   // v150 글씨 새긴 바위
        if (o.p79) { const im = img79(o.p79); if (im) { const hh = im.naturalHeight * o.pw / im.naturalWidth; c.drawImage(im, Math.round(o.cx - o.pw / 2), Math.round(o.by - hh), o.pw, Math.round(hh));
          if (o.fire) { const fl = 0.7 + 0.3 * Math.sin(performance.now() / 95 + o.cx) * Math.sin(performance.now() / 157); c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, o.cx, o.by - hh * 0.6, o.pw * 0.6, '#FF8A2A', 0.32 * fl); c.restore(); }   // v186 불타는 집: 불빛이 일렁임
          if (o.label) { c.font = '13px "Jua", "Malgun Gothic", sans-serif'; const lw = c.measureText(o.label).width + 20, ly = Math.max(o.by - hh - 2, 16), lx = o.cx; c.fillStyle = 'rgba(10,14,36,.82)'; c.fillRect(lx - lw / 2, ly - 11, lw, 22); c.fillStyle = '#5AD1FF'; c.fillRect(lx - lw / 2, ly + 10, lw, 2); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#9AE6FF'; c.fillText(o.label, lx, ly + 1); } } return; }   // v80 진영 소품   // v169 명소 이름표
        // Meshy 그림이 있으면: 장애물은 칸 아래 가운데에 세움, 건물은 건물 칸 폭에 맞춤 (+ 이름표)
        if (o.fountain && imgOk('bld_fountain')) {   // v86 분수: Meshy 그림 (6×4 칸, 가운데 맞춤) + 물 반짝임
          const fim = imgOk('bld_fountain'), ww = 6 * TS, hh = fim.naturalHeight * ww / fim.naturalWidth, x0 = (G.map.fx + 1) * TS - ww / 2, y0 = (G.map.fy + 1) * TS - hh / 2;   // v158 분수 자리
          c.drawImage(fim, Math.round(x0), Math.round(y0), ww, Math.round(hh));
          c.fillStyle = '#FFFFFF';
          for (let i = 0; i < 6; i++) { const ph = (now / 700 + i * 1.7) % 3; if (ph > 1) continue; const a = Math.sin(ph * Math.PI); c.globalAlpha = a * 0.9; const sx = x0 + ww * (0.3 + 0.4 * ((i * 0.37) % 1)), sy0 = y0 + hh * (0.32 + 0.22 * ((i * 0.61) % 1)); c.fillRect(Math.round(sx), Math.round(sy0), 2, 2); c.fillRect(Math.round(sx) - 2, Math.round(sy0), 1, 1); c.fillRect(Math.round(sx) + 3, Math.round(sy0), 1, 1); }
          c.globalAlpha = 1;
          return;
        }
        if (o.station) {   // v85 역참: Meshy 그림(bld_station) 이 있으면 그것, 없으면 간단한 도트 그림 + 이름표
          const st = o.station, sim = imgOk('bld_station'), cx0 = (st.x + st.w / 2) * TS, by = (st.y + st.h) * TS + 6;
          let top;
          if (sim) { const ww = st.w * TS + 66, hh = sim.naturalHeight * ww / sim.naturalWidth; top = by - hh; c.drawImage(sim, Math.round(cx0 - ww / 2), Math.round(top), Math.round(ww), Math.round(hh)); }
          else {
            const x0 = st.x * TS, w0 = st.w * TS; top = by - 112;
            c.fillStyle = '#7A5A3A'; c.fillRect(x0 + 6, by - 58, w0 - 12, 52); c.fillStyle = '#F2E6CC'; c.fillRect(x0 + 14, by - 52, w0 - 28, 36);
            c.fillStyle = '#8A6A44'; for (let i = 0; i < 4; i++) c.fillRect(x0 + 22 + i * 26, by - 50, 3, 32);
            c.fillStyle = '#2E3444'; c.beginPath(); c.moveTo(x0 - 6, by - 56); c.lineTo(x0 + 18, by - 86); c.lineTo(x0 + w0 - 18, by - 86); c.lineTo(x0 + w0 + 6, by - 56); c.closePath(); c.fill();
            c.fillStyle = '#4A5266'; c.fillRect(x0 + 14, by - 82, w0 - 28, 4);
            c.fillStyle = '#6A4A2A'; c.fillRect(x0 + w0 - 10, top + 6, 4, 106); c.fillStyle = '#D2343A'; c.fillRect(x0 + w0 - 6, top + 8, 22, 30);
            c.fillStyle = '#B8B0A0'; c.fillRect(x0 + 2, by - 8, w0 - 4, 8);
          }
          const label = '역참 · 마을 이동'; c.font = '13px "Jua", "Malgun Gothic", sans-serif'; const lw = c.measureText(label).width + 20, ly = top - 6;
          c.fillStyle = 'rgba(10,14,36,.82)'; c.fillRect(cx0 - lw / 2, ly - 11, lw, 22); c.fillStyle = '#9AE6FF'; c.fillRect(cx0 - lw / 2, ly + 10, lw, 2);
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#9AE6FF'; c.fillText(label, cx0, ly + 1);
          return;
        }
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
        const alt = (o.alt2 && img79(o.alt2)) || (o.alt && imgOk(o.alt)), bim = o.b && (o.b.img ? img79(o.b.img) : imgOk('bld_' + o.b.type));   // v169 성마다 다른 그림 (img/v79/bld_<도시>.png)
        if (bim) {
          const b = o.b, ww = b.w * TS + (b.type === 'castle' ? 150 : 34),   // v144 성 +150 (world.js castleGeo 와 같게)
          hh = bim.naturalHeight * ww / bim.naturalWidth, cx0 = (b.x + b.w / 2) * TS, by = (b.y + b.h) * TS + 6;
          c.drawImage(bim, Math.round(cx0 - ww / 2), Math.round(by - hh), Math.round(ww), Math.round(hh));
          const label = b.type === 'castle' ? (b.quest ? b.name + ' · 퀘스트' : b.name) : b.name; c.font = '13px "Jua", "Malgun Gothic", sans-serif'; const lw = c.measureText(label).width + 20, ly = Math.max(by - hh - 4, 16);   // v144 큰 서원 그림은 지도 맨 위에 닿아 이름표가 잘리지 않게
          c.fillStyle = 'rgba(10,14,36,.82)'; c.fillRect(cx0 - lw / 2, ly - 11, lw, 22); c.fillStyle = '#FFD23F'; c.fillRect(cx0 - lw / 2, ly + 10, lw, 2);
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = b.type === 'potion' ? '#FF9AA0' : b.type === 'school' ? '#D8B8FF' : b.type === 'chief' ? '#9AF0B0' : '#FFE45C'; c.fillText(label, cx0, ly + 1);
          return;
        }
        if (alt) {
          const im = alt, x = o.tx * TS + 16 - im.naturalWidth / 2, y = (o.ty + 1) * TS - im.naturalHeight + 2, tree = o.alt2 && img79(o.alt2) ? o.alt2.startsWith('env_t') : im.naturalHeight > 56;
          if (tree) { const sway = Math.sin(now / 900 + o.tx * 0.7) * 0.012; c.save(); c.translate(x + im.naturalWidth / 2, y + im.naturalHeight); c.transform(1, 0, sway, 1, 0, 0); c.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight); c.restore(); }
          else c.drawImage(im, Math.round(x), Math.round(y));
        } else if (o.kind === 'tree' || o.kind === 'blossom' || o.kind === 'pine' || o.kind === 'snowpine') {   // 바람에 살짝 흔들림
          const sway = Math.sin(now / 900 + o.tx * 0.7) * 0.012;
          c.save(); c.translate(o.x + 32, o.y + 74); c.transform(1, 0, sway, 1, 0, 0); c.drawImage(o.img, -32, -74); c.restore();
        } else c.drawImage(o.img, o.x, o.y);
        if (o.kind === 'crystal') { c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, o.tx * TS + 16, o.ty * TS + 6, 40, '#B08AFF', 0.35 + 0.15 * Math.sin(now / 400 + o.tx)); c.restore(); }
      }
      // v80 조선 병사 (Meshy 그림 한 장): 걸을 때 통통 + 살짝 기울기 · 다친 병사는 가만히
      // v129 사람 이름 · 느낌표 · 말풍선 (그림 NPC · 실내 그림 속 사람 같이 씀)
      function npcTags(c, n, y, now) {
        c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
        c.strokeText(n.def.name, n.x, y - 6); c.fillStyle = n.def.color || '#9AE6FF'; c.fillText(n.def.name, n.x, y - 6);
        let top = y - 22;
        if (!n.guard && !n.walker) {   // v110 가게 사람 머리 위 느낌표 (그림 NPC 도 같게)
          const by = top - 8 - Math.abs(Math.sin(now / 260)) * 5; c.fillStyle = '#1D2340'; rr(c, n.x - 9, by - 12, 18, 22, 6); c.fill(); c.fillStyle = '#FFD23F'; rr(c, n.x - 7, by - 10, 14, 18, 5); c.fill();
          c.fillStyle = '#1D2340'; c.fillRect(n.x - 1.5, by - 7, 3, 8); c.fillRect(n.x - 1.5, by + 3, 3, 3); top = by - 16;
        }
        if (n.say && n.sayT > 0) (G.sayQ || (G.sayQ = [])).push([n, top]);   // v158 말풍선은 맨 마지막에 (비석·건물에 가려지지 않게) — sayFlush
      }
      function drawArmy(c, n, now) {
        const im = img79(n.def.img), H0 = Math.round((n.def.h || 64) * (n.scale || 1));
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(n.x, n.y, n.still ? 28 : 16, 5, 0, 0, Math.PI * 2); c.fill();
        if (!im) return;
        const h = H0, w = Math.round(im.naturalWidth * h / im.naturalHeight), y = Math.round(n.y - h + 3);
        if (!n.cv) { const [cv, cx] = P.mk(w, h); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high'; cx.drawImage(im, 0, 0, w, h); n.cv = cv; }   // v83 병사도 팔다리 움직임 (그림을 한 번 줄여 둠)
        c.save(); c.translate(n.x, y); if (n.face < 0) c.scale(-1, 1); c.translate(-w / 2, 0);
        if (n.still) c.drawImage(n.cv, 0, 0); else rig(c, n.cv, w, h, n.def.img === 'jo_horse' ? 'quad' : 'biped', n.moving ? (n.walk || 0) * 8.5 : now / 700 + n.ph, n.moving, 0);
        c.restore();
        npcTags(c, n, y, now);
      }
      function drawMe(c, now) {
        const posing = now < (G.poseUntil || 0), walkMv = G.moving && !posing, fr = posing ? G.poseK : 0;   // v79 마법·공격 동작 · v105 걷기는 한 장을 조각내 부드럽게(drawFig)
        const view = posing ? 'f' : G.view || 'f', fs = figSet(Hub.user ? Hub.user.avatar : AV.normalize({}), S.eq, S.hide, fr, view), img = fs.img;
        const s = img.width > AV.size.w ? 1 : 2, w = img.width * s, h = img.height * s, bob = G.moving ? 0 : Math.round(Math.sin(now / 400)), x = Math.round(G.px - w / 2), y = Math.round(G.py - h + 2 + bob);
        G.meImg = { img, x, y, w, h };
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(G.px, G.py, 16, 5, 0, 0, Math.PI * 2); c.fill();
        if (G.dash) Fx.afterimage(img, x, y, w, h, G.face < 0, Fx.pal(G.dash.els[0])[2]);
        if (G.inv > 0 && !G.dash && Math.floor(now / 60) % 2) c.globalAlpha = 0.45;
        const mt = Fx.motionTf ? Fx.motionTf(G.mot, now, G.face) : null;   // v153 마법 동작 (발밑을 기준으로 옮기고·기울이고·늘이고)
        if (mt) { c.save(); c.translate(G.px + mt.dx, G.py + mt.dy); c.rotate(mt.rot); c.scale(mt.sx, mt.sy); c.translate(-G.px, -G.py); }
        drawFig(c, img, x, y, w, h, G.face, G.walk * Math.PI * 4, walkMv, S.eq.weapon && !S.hide ? 'left' : true, fs.side);
        if (mt) c.restore();
        if (Fx.motionGlow) Fx.motionGlow(c, G.mot, now, G.px, G.py, G.motEl);
        c.globalAlpha = 1;
        // 장비 단계 빛 (정예 무기)
        const wp = S.eq.weapon && ITEMS[S.eq.weapon]; if (wp && wp.rare && !S.hide) { c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, G.px + (G.face < 0 ? -14 : 14), y + 14, 18, D.TIER[wp.tier].gem, 0.35 + 0.2 * Math.sin(now / 200)); c.restore(); }
        if (G.shield) Fx.drawShield(c, G.px, G.py - 28, now, G.shield.el, G.shield.t, G.shield.sid);
        c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
        const nm = (Hub.user ? Hub.user.nickname : '손님') + ' Lv.' + S.lv; c.strokeText(nm, G.px, y - 6); c.fillStyle = '#FFE45C'; c.fillText(nm, G.px, y - 6);
        if (myTitle()) { c.save(); drawTitle(c, myTitle(), G.px, y - 6 + 6); c.restore(); }   // v176 타이틀
        if (G.pst) {   // v87 내 상태 효과 표시 (이름 위 작은 딱지) + 효과 그림
          const P = G.pst, chips = [];
          if (P.burn) chips.push(['화상', '#FF6A3D']); if (P.slow > 0) chips.push(['느림', '#3BA8F5']); if (P.stun > 0) chips.push(['기절', '#FFE45C']); if (P.curse > 0) chips.push(['저주', '#B08AFF']); if (P.root > 0) chips.push(['속박', '#9AF0B0']); if (P.silence > 0) chips.push(['침묵', '#C8A8FF']); if (P.fear > 0) chips.push(['공포', '#FF8A8E']);
          c.font = '10px "Jua", "Malgun Gothic", sans-serif'; let cx = G.px - chips.length * 17;
          chips.forEach(([t, col]) => { c.fillStyle = 'rgba(10,14,36,.85)'; c.fillRect(cx, y - 34, 32, 14); c.fillStyle = col; c.fillRect(cx, y - 22, 32, 2); c.fillText(t, cx + 16, y - 23); cx += 34; });
          if (P.burn && Math.random() < 0.4) Fx.emit({ x: G.px + rand(-10, 10), y: G.py - rand(6, 40), vx: rand(-10, 10), vy: rand(-80, -40), life: 0.5, size: rand(3, 5), color: pick(['#FFE45C', '#FF9A3D', '#E8402A']), shape: 'glow', add: true });
          if (P.stun > 0) for (let i = 0; i < 3; i++) { const a = now / 150 + i * 2.1; c.fillStyle = '#FFE45C'; c.fillRect(G.px + Math.cos(a) * 14 - 2, y - 42 + Math.sin(a) * 4, 4, 4); }
          if (P.curse > 0 && Math.random() < 0.2) Fx.emit({ x: G.px + rand(-12, 12), y: G.py - rand(10, 50), vx: 0, vy: -30, life: 0.7, size: 3, color: '#B08AFF', shape: 'glow', add: true });
        }
      }
      /* v83 몬스터·병사 움직임: 그림 한 장을 조각내어 다리·팔을 따로 흔듦 (Meshy 그림·도트 그림 모두)
       *  biped 두 발(왜군·해골·도깨비·골렘…): 다리 두 쪽을 엉덩이 기준으로 번갈아 앞뒤로 · 팔(몸 양옆)은 다리와 반대로 · 공격하면 앞팔을 휘두름
       *  quad 네 발(짐승·구미호·전갈·용·기마): 다리 네 조각을 짝지어 번갈아 · float 유령·박쥐: 둥실 + 날갯짓 · plant 식물: 줄기째 흔들림
       *  blob 슬라임·버섯 / hop 장승: 예전처럼 통통 튀며 찌그러짐 */
      const RIG = { ashigaru: 'biped', gunner: 'biped', samurai: 'biped', skeleton: 'biped', imp: 'biped', golem: 'biped', beast: 'quad', gumiho: 'quad', scorpion: 'quad', dragon: 'quad', ghost: 'float', bat: 'flap', plant: 'plant', slime: 'blob', mushroom: 'blob', jangseung: 'hop' };
      const rigKind = def => (def.rig || (def.img79 === 'wae_cavalry' ? 'quad' : RIG[def.shape] || 'blob'));
      function rig(c, im, w, h, kind, p, mv, atk) {
        const SW = im.width, SH = im.height, kx = w / SW, ky = h / SH;
        // 조각 그리기: 그림의 (x0~x1, y0~y1) 비율 부분을, 기준선 ay(비율) 를 축으로 sh 만큼 기울이고 (dx, dy) 옮김
        const pc = (x0, y0, x1, y1, sh, ay, dx, dy) => {
          const sx = Math.round(x0 * SW), sy = Math.round(y0 * SH), sw = Math.max(1, Math.round((x1 - x0) * SW)), shh = Math.max(1, Math.round((y1 - y0) * SH));
          c.save(); if (sh) { c.translate(0, ay * h); c.transform(1, 0, sh, 1, 0, 0); c.translate(0, -ay * h); }
          c.drawImage(im, sx, sy, sw, shh, sx * kx + (dx || 0), sy * ky + (dy || 0), sw * kx, shh * ky); c.restore();
        };
        const s = mv ? Math.sin(p) : 0, cs = mv ? Math.cos(p) : 0;
        if (kind === 'biped') {
          const HIP = 0.64, SHO = 0.3, bob = mv ? -Math.abs(cs) * h * 0.03 : Math.sin(p) * h * 0.006, leg = s * 0.42, arm = -s * 0.2;
          pc(0, HIP - 0.03, 0.53, 1, leg, HIP, 0, -Math.max(0, -cs) * h * 0.025);         // 뒷다리
          pc(0.47, HIP - 0.03, 1, 1, -leg, HIP, 0, -Math.max(0, cs) * h * 0.025);          // 앞다리
          c.save(); if (atk) { c.translate(w * 0.5, HIP * h); c.rotate(atk * 0.16); c.translate(-w * 0.5 + atk * w * 0.07, -HIP * h); }   // 공격: 윗몸을 앞으로 숙이며 내지름 (무기는 몸과 함께)
          pc(0, SHO, 0.4, HIP + 0.03, arm, SHO, 0, bob);                                    // 뒷팔 쪽
          pc(0.28, 0, 0.72, HIP + 0.04, 0, 0, 0, bob); pc(0, 0, 1, SHO + 0.02, 0, 0, 0, bob);  // 몸통 · 머리
          pc(0.6, SHO, 1, HIP + 0.03, -arm + atk * 0.2, SHO, 0, bob);                       // 앞팔 쪽
          c.restore();
        } else if (kind === 'quad') {
          const HIP = 0.6, bob = mv ? -Math.abs(cs) * h * 0.025 : Math.sin(p) * h * 0.006, leg = s * 0.4;
          [[0, 0.27, leg], [0.25, 0.5, -leg], [0.48, 0.75, leg * 0.9], [0.73, 1, -leg * 0.9]].forEach(([a, b, k]) => pc(a, HIP - 0.03, b, 1, k, HIP, 0, -Math.max(0, k > 0 ? -cs : cs) * h * 0.02));
          pc(0, 0, 1, HIP + 0.03, 0, 0, atk * w * 0.08, bob);
        } else if (kind === 'float' || kind === 'flap') {
          const t = performance.now() / 380, fy = Math.sin(t + p) * h * 0.05;
          if (kind === 'flap') { const f = 1 + Math.sin(t * 4 + p) * 0.12; c.save(); c.translate(w / 2, h / 2 + fy); c.scale(1, f); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore(); }
          else { pc(0, 0, 1, 0.7, 0, 0, atk * w * 0.08, fy); pc(0, 0.68, 1, 1, Math.sin(t * 2 + p) * 0.15, 0.68, atk * w * 0.08, fy); }   // 유령: 아래 꼬리가 하늘하늘
        } else if (kind === 'plant') {
          const t = performance.now() / 600; pc(0, 0, 1, 1, Math.sin(t + p) * 0.09 + atk * 0.3, 1, 0, 0);
        } else c.drawImage(im, 0, 0, w, h);
      }
      function drawMon(c, m, now) {
        if (m.hidden) return;   // v173 땅속·공중
        if (m.stealth > 0 && !m.drawingSt) { c.save(); c.globalAlpha = 0.14; m.drawingSt = true; drawMon(c, m, now); m.drawingSt = false; c.restore(); return; }   // v173 투명
        if (m.dummy) return drawDummy(c, m, now);   // v144
        if (m.spr.wait) { const s2 = monSprite(m.def, m.boss ? 6 : 3); if (!s2.wait) m.spr = s2; }   // v80 Meshy 그림이 늦게 오면 바꿔 끼움
        if (m.def.float || m.def.aura) return drawFloater(c, m, now);   // v150 사방신: 떠 있음(float) · 땅을 딛고 섬(aura) + 발밑 물·불·바람 기운
        const sp = m.spr, moving = m.aggro || Math.abs(m.wx) + Math.abs(m.wy) > 0.1, kind = rigKind(m.def);
        const ph = now / (moving ? 110 : 260) + m.hx, bounce = (kind === 'blob' || kind === 'hop') && !(m.boss && rbFrames(m.def));   // v83 통통 튀기·찌그러지기는 슬라임·버섯·장승만
        const hop = bounce && moving ? Math.abs(Math.sin(ph)) * (m.boss ? 6 : 5) : 0, sq = !bounce ? 1 : moving ? 1 + Math.cos(ph * 2) * 0.05 : 1 + Math.sin(ph) * 0.04;
        const lunge = m.lunge > 0 ? Math.sin(m.lunge / 0.25 * Math.PI) * 10 : 0, la = Math.atan2(G.py - m.y, G.px - m.x);
        const w = sp.w * (2 - sq), h = sp.h * sq, bx = m.x + Math.cos(la) * lunge + (m.knock || 0), x = Math.round(bx - w / 2), y = Math.round(m.y - h - hop + Math.sin(la) * lunge * 0.5);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(m.x, m.y, sp.w * 0.38 * (1 - hop / 30), sp.w * 0.12, 0, 0, Math.PI * 2); c.fill();
        if (m.boss) { c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, m.x, m.y - sp.h / 2, sp.w * 0.9, m.def.colors.d || '#FF3D4A', 0.35 + 0.15 * Math.sin(now / 300)); c.restore(); if (Math.random() < 0.3) Fx.emit({ x: m.x + rand(-sp.w / 2, sp.w / 2), y: m.y - rand(0, sp.h), vx: 0, vy: rand(-60, -20), life: 0.8, size: rand(3, 5), color: m.def.colors.d || '#FF3D4A', shape: 'glow', add: true }); }
        const flip = m.aggro || Math.abs(m.wx) < 0.1 ? G.px < m.x : m.wx < 0;   // v83 돌아다닐 때는 가는 쪽을 봄
        c.save(); if (flip) { c.translate(x + w, y); c.scale(-1, 1); } else c.translate(x, y);
        const atk = m.lunge > 0 ? Math.sin(Math.min(1, m.lunge / 0.25) * Math.PI) : 0, wp = now / (m.boss ? 170 : kind === 'quad' ? 95 : 125) + m.hx * 3;
        const RF = m.boss && rbFrames(m.def);
        if (RF) {   /* v150 지역 보스: 하는 일에 따라 그림을 바꿔 끼움 (공격·마법·맞음) + 숨 쉬듯 들썩 */
          const fim = kingFrame(m, now, RF), fd = frameDim(fim, RF, sp), br = 1 + 0.02 * Math.sin(now / 420 + m.hx);
          c.translate(w / 2, h); c.scale(1, br); c.drawImage(fim, -fd.w / 2, -fd.h, fd.w, fd.h);
          if (m.flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45; c.drawImage(fim, -fd.w / 2, -fd.h, fd.w, fd.h); }
          if (m._fr === 'cast') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1; Fx.drawGlow(c, 0, -fd.h * 0.55, 50 + 10 * Math.sin(now / 110), m.def.colors.d || '#FFE45C', 0.4); }
        } else if (bounce) c.drawImage(m.flash > 0 ? sp.flash : sp.img, 0, 0, w, h);
        else rig(c, m.flash > 0 ? sp.flash : sp.img, w, h, kind, moving ? wp : now / 700 + m.hx, moving, atk);
        c.restore();
        if (m.stun > 0) for (let i = 0; i < 3; i++) { const a = now / 150 + i * 2.1; c.fillStyle = '#FFE45C'; c.fillRect(m.x + Math.cos(a) * 14 - 2, y - 6 + Math.sin(a) * 4, 4, 4); }
        if (m.slow > 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5; c.drawImage(Fx.glow('#5AB8F5', 24), m.x - 24, m.y - sp.h / 2 - 24); c.restore(); if (Math.random() < 0.1) Fx.emit({ x: m.x + rand(-10, 10), y: m.y - rand(0, sp.h), vx: 0, vy: 20, life: 0.5, size: 2, color: '#BDE8FF', shape: 'star', add: true }); }
        if (m.curse > 0 && Math.random() < 0.15) Fx.emit({ x: m.x + rand(-10, 10), y: m.y - rand(4, sp.h), vx: 0, vy: -30, life: 0.7, size: 3, color: '#B08AFF', shape: 'glow', add: true });   // v87 저주
        if (m.burn && Math.random() < 0.4) Fx.emit({ x: m.x + rand(-sp.w / 3, sp.w / 3), y: m.y - rand(4, sp.h * 0.8), vx: rand(-10, 10), vy: rand(-80, -40), life: 0.5, size: rand(3, 5), color: pick(['#FFE45C', '#FF9A3D', '#E8402A']), shape: 'glow', add: true });
        if ((m.hp < m.max || m.aggro) && !m.boss) {
          const bw = 36, hpw = bw * Math.max(0, m.hp / m.max); m.hpShow = m.hpShow == null ? hpw : m.hpShow + (hpw - m.hpShow) * 0.1;
          c.fillStyle = '#0A0E24'; c.fillRect(m.x - bw / 2 - 1, y - 9, bw + 2, 6); c.fillStyle = '#FFE45C'; c.fillRect(m.x - bw / 2, y - 8, m.hpShow, 4); c.fillStyle = '#FF5A5F'; c.fillRect(m.x - bw / 2, y - 8, hpw, 4); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(m.x - bw / 2, y - 8, hpw, 1);
          c.font = '11px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
          const t = m.name + ' Lv.' + m.lvl; c.strokeText(t, m.x, y - 13); c.fillStyle = m.lvl > S.lv + 3 ? '#FF8A8E' : '#FFFFFF'; c.fillText(t, m.x, y - 13);
          if (m.el && ELEM[m.el]) { const tw = c.measureText(t).width, ex = m.x - tw / 2 - 11, ey = y - 17; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(ex - 2, ey, 9, 0, Math.PI * 2); c.fill(); c.fillStyle = ELEM[m.el].color; c.beginPath(); c.arc(ex - 2, ey, 7.5, 0, Math.PI * 2); c.fill(); c.font = '11px "Jua", "Malgun Gothic", sans-serif'; c.fillStyle = '#1D2340'; c.fillText(ELEM[m.el].name[0], ex - 2, ey + 4); }   // v87 속성 표시
        }
      }
      // v150 떠다니는 보스 (청룡 …): 몸은 그림 그대로 위아래로 둥실 · 살짝 기울기 · 발밑 소용돌이 그림은 일렁이며 물결 고리가 퍼짐
      /* v150 광개토대왕 그림 고르기: 칼 기술은 0.7초 들었다가 내려치고(0.3초 더 멈춤), 마법은 손을 뻗고, 움직이면 걷기 두 장, 맞으면 1.4초에 한 번 0.22초 움찔 */
      /* v150 자세 그림 크기: 기본(idle) 그림의 높이 = 화면 높이(sp.h) 가 되는 비율로 다른 자세도 같은 비율로 키움 (자세마다 칼·불꽃 때문에 그림 크기가 다름) */
      function frameDim(im, F, sp) {
        const b = img79(F.idle), k = b && b.naturalHeight ? sp.h / b.naturalHeight : 0;
        return k && im.naturalWidth ? { w: im.naturalWidth * k, h: im.naturalHeight * k } : { w: sp.w, h: sp.h };
      }
      /* v150 지역 보스 9마리: Gemini 그림 4장 (기본·공격·마법·맞음) — 그림이 다 들어간 지역만 RB_ART 에 적음 */
      const RB_ART = P.RB_ART || [];
      const rbFrames = def => def && def.kind === 'boss' && def.ri != null && !def.dot && !def.img && !def.img79 && RB_ART.includes(def.ri) ? (def._rbF || (def._rbF = { idle: 'rb' + def.ri + '_idle', atk1: 'rb' + def.ri + '_atk', atk2: 'rb' + def.ri + '_atk', cast: 'rb' + def.ri + '_cast', hit: 'rb' + def.ri + '_hit' })) : null;
      const BIG_CAST = { ring: 1, laser: 1, mines: 1, windwall: 1, whirl: 1, bomb: 1, realm: 1, hook: 1, barrage: 1 };
      function kingFrame(m, now, F) {
        F = F || m.def.frames; const c = m.cast;
        if (!m._pre) { m._pre = 1; [F.idle, F.atk1, F.atk2, F.cast, F.hit, F.melee, F.cast2].concat(F.walk || []).forEach(n => n && img79(n)); }
        /* v192 선생님 11/23: 기본 공격·마법 공격 그림 더 넣음 — melee(돌진·박치기·순간이동·몸통 박치기) · cast2(큰 마법: 고리·레이저·지뢰·바람벽 …) · 그림이 없으면 예전대로 */
        let k = 'idle';
        if (c && F.melee && (c.k === 'charge' || c.k === 'blink' || c.k === 'kick')) k = 'melee';
        else if (c && (c.k === 'blades' || c.k === 'charge')) k = c.t < 0.7 ? 'atk1' : 'atk2';
        else if (m.slam) k = m.slam.t < 0.6 ? 'atk1' : 'atk2';
        else if (c && F.cast2 && BIG_CAST[c.k]) k = 'cast2';
        else if (c && (c.k === 'ring' || c.k === 'fan' || BIG_CAST[c.k])) k = 'cast';
        else if (m.lunge > 0) k = F.melee ? 'melee' : 'atk2';
        else if (m._hold && now < m._hold.until) k = m._hold.k;
        else if (m.flash > 0 && now > (m._hitNext || 0)) { m._hitNext = now + 1400; m._hold = { k: 'hit', until: now + 220 }; k = 'hit'; }
        else {
          if (m._lx != null && Math.hypot(m.x - m._lx, m.y - m._ly) > 0.3) m._mvT = now;
          if (now - (m._mvT || -1e9) < 160) k = 'walk';
        }
        if (k === 'atk2' || k === 'cast' || k === 'melee' || k === 'cast2') m._hold = { k, until: now + 300 };
        m._lx = m.x; m._ly = m.y; m._fr = k;
        const n = k === 'walk' ? (F.walk ? F.walk[Math.floor(now / 260) % 2] : F.idle) : F[k] || F.idle;
        return img79(n) || img79(F.idle) || m.spr.img;
      }
      function drawFloater(c, m, now) {
        const sp = m.spr, d = m.def, t = now / 1000, col = d.baseCol || '#9AE6FF';
        const fly = !!d.float, bob = fly ? Math.sin(t * 1.6 + m.hx) * 9 : 0, lift = fly ? 26 + bob : 0, flip = G.px < m.x, breath = fly ? 1 : 1 + 0.018 * Math.sin(t * 2.1 + m.hx);   // v150 aura = 땅을 딛고 숨 쉬듯 들썩
        const lunge = m.lunge > 0 ? Math.sin(m.lunge / 0.25 * Math.PI) * 14 : 0, la = Math.atan2(G.py - m.y, G.px - m.x);
        const bx = m.x + Math.cos(la) * lunge, by = m.y + Math.sin(la) * lunge * 0.4;
        // 발밑 소용돌이 (그림 + 일렁임 + 퍼지는 물결)
        const pool = img79(d.base);
        if (pool) {
          const pw = sp.w * 1.08, ph = pw * pool.naturalHeight / pool.naturalWidth, sx = 1 + 0.035 * Math.sin(t * 2.2), sy = 1 + 0.06 * Math.sin(t * 2.2 + 1.3);
          c.save(); c.translate(bx, by); c.globalAlpha = 0.95; c.scale(sx * (flip ? -1 : 1), sy); c.drawImage(pool, -pw / 2, -ph * 0.62, pw, ph);
          c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 + 0.1 * Math.sin(t * 3.1); c.drawImage(pool, -pw / 2 + 6 * Math.sin(t * 1.7), -ph * 0.62, pw, ph); c.restore();
        } else { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(bx, by, sp.w * 0.38, sp.w * 0.1, 0, 0, Math.PI * 2); c.fill(); c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, bx, by, sp.w * 0.45, col, 0.25 + 0.1 * Math.sin(t * 2.6)); c.restore(); }
        c.save(); c.strokeStyle = col;
        for (let i = 0; i < 3; i++) { const k = ((t * 0.45 + i / 3) % 1), r = sp.w * (0.22 + 0.42 * k); c.globalAlpha = 0.45 * (1 - k); c.lineWidth = 2.5 * (1 - k) + 0.5; c.beginPath(); c.ellipse(bx, by - 4, r, r * 0.26, 0, 0, Math.PI * 2); c.stroke(); }
        c.restore();
        if (Math.random() < 0.35) Fx.emit({ x: bx + rand(-sp.w * 0.35, sp.w * 0.35), y: by - rand(0, 10), vx: rand(-15, 15), vy: rand(-90, -40), life: rand(0.5, 0.9), size: rand(2, 4), color: pick([col, '#FFFFFF', '#9AE6FF']), shape: 'glow', add: true });
        // 그림자처럼 몸 밑에 빛
        c.save(); c.globalCompositeOperation = 'lighter'; Fx.drawGlow(c, bx, by - sp.h * 0.45 - lift, Math.min(sp.w * 0.8, 260), col, 0.16 + 0.06 * Math.sin(t * 2)); c.restore();
        // 몸
        const tilt = Math.sin(t * 1.1 + m.hx) * 0.035 + (m.lunge > 0 ? 0.08 * (flip ? -1 : 1) : 0);
        c.save(); c.translate(bx, by - lift); c.rotate(fly ? tilt : tilt * 0.4); c.scale(flip ? -1 : 1, breath);
        if (d.frames) {   // v150 광개토대왕: 하는 일에 따라 그림을 바꿔 끼움 (그림은 모두 같은 크기 · 발 위치 ax)
          const fim = kingFrame(m, now), fd = frameDim(fim, d.frames, sp), ax = fd.w * (d.ax || 0.5);   /* v150 사방신 자세 그림은 크기가 저마다 달라서 기본 그림 비율로 맞춤 */
          c.drawImage(fim, -ax, -fd.h, fd.w, fd.h);
          if (m.flash > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45; c.drawImage(fim, -ax, -fd.h, fd.w, fd.h); }
          if (m._fr === 'cast') { const ca = d.castAt || [0, 0.55]; c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1; Fx.drawGlow(c, fd.w * ca[0], -fd.h * ca[1], 60 + 12 * Math.sin(t * 9), d.castCol || col, 0.55); }
        } else c.drawImage(m.flash > 0 ? sp.flash : sp.img, -sp.w / 2, -sp.h, sp.w, sp.h);
        c.restore();
        const top = by - lift - sp.h;
        if (m.stun > 0) for (let i = 0; i < 3; i++) { const a = now / 150 + i * 2.1; c.fillStyle = '#FFE45C'; c.fillRect(m.x + Math.cos(a) * 18 - 2, top + 10 + Math.sin(a) * 4, 4, 4); }
        if (m.burn && Math.random() < 0.4) Fx.emit({ x: m.x + rand(-sp.w / 3, sp.w / 3), y: by - lift - rand(4, sp.h * 0.8), vx: rand(-10, 10), vy: rand(-80, -40), life: 0.5, size: rand(3, 5), color: pick(['#FFE45C', '#FF9A3D', '#E8402A']), shape: 'glow', add: true });
        if (m.curse > 0 && Math.random() < 0.15) Fx.emit({ x: m.x + rand(-10, 10), y: by - lift - rand(4, sp.h), vx: 0, vy: -30, life: 0.7, size: 3, color: '#B08AFF', shape: 'glow', add: true });
      }
      // v105 사람 그리기: 걸을 때는 AV.rig 로 다리·팔·몸을 이어서 움직임 (순찰병처럼 부드럽게), 왼쪽을 보면 뒤집음
      function drawFig(c, img, x, y, w, h, face, ph, mv, arms, side) {
        c.save(); if (face < 0) { c.translate(x + w, y); c.scale(-1, 1); } else c.translate(x, y);
        if (side && AV.rigSide) AV.rigSide(c, side.body, side.arm, 0, 0, w, h, ph, mv);   // v107 옆모습: 다리 둘·가까운 팔(무기)을 따로 흔듦
        else if (AV.rig) AV.rig(c, img, 0, 0, w, h, ph, mv, { arms }); else c.drawImage(img, 0, 0, w, h);
        c.restore();
      }
      // v107 방향별 그림 묶음 (옆모습이면 몸·팔 따로)
      function figSet(av, eq, hide, fr, view) {
        const img = avatarSprite(av, eq, hide, fr, view);
        return { img, side: view === 's' ? { body: avatarSprite(av, eq, hide, 0, 's', 'noArm'), arm: avatarSprite(av, eq, hide, 0, 's', 'arm') } : null };
      }
      function drawNpc(c, n, now) {
        if (n.mural) return drawYsFrame(c, n, now);   // v174 빈 벽화 틀
        if (n.baked) return npcTags(c, n, n.topY, now);   // v129 실내 그림 속 사람 (몸은 바닥 그림에 있음)
        if (n.def.img && (!n.def.av || img79(n.def.img))) return drawArmy(c, n, now);   // v110 NPC 그림 (못 불러오면 예전 아바타)
        const nv = n.moving ? 's' : 'f', fs = nv === 's' ? figSet(AV.normalize(n.def.av), {}, true, 0, 's') : null, img = fs ? fs.img : npcSprite(n.def.av, 0);   // v107 걸어 다니는 마을 사람은 옆모습
        const k = (img.width > AV.size.w ? 1 : 2) * (n.scale || 1), w = img.width * k, h = img.height * k, bob = n.moving ? 0 : Math.round(Math.sin(now / 420 + n.ph));
        const x = Math.round(n.x - w / 2), y = Math.round(n.y - h + 2 + bob);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(n.x, n.y, 16 * (n.scale || 1), 5, 0, 0, Math.PI * 2); c.fill();
        drawFig(c, img, x, y, w, h, n.face, (n.walk || 0) * Math.PI * 3.5, n.moving, true, fs && fs.side);
        c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
        c.strokeText(n.def.name, n.x, y - 6); c.fillStyle = n.def.color || '#9AE6FF'; c.fillText(n.def.name, n.x, y - 6);
        let top = y - 22;
        if (!n.guard && !n.walker) {   // 가게 사람 머리 위 느낌표 (통통 튐)
          const by = top - 8 - Math.abs(Math.sin(now / 260)) * 5; c.fillStyle = '#1D2340'; rr(c, n.x - 9, by - 12, 18, 22, 6); c.fill(); c.fillStyle = '#FFD23F'; rr(c, n.x - 7, by - 10, 14, 18, 5); c.fill();
          c.fillStyle = '#1D2340'; c.fillRect(n.x - 1.5, by - 7, 3, 8); c.fillRect(n.x - 1.5, by + 3, 3, 3); top = by - 16;
        }
        if (n.say && n.sayT > 0) (G.sayQ || (G.sayQ = [])).push([n, top]);   // v158 말풍선은 맨 마지막에 (비석·건물에 가려지지 않게) — sayFlush
      }
      let ysMuralImg = null;
      function drawYsFrame(c, n, now) {   // v177 Gemini 쌍룡 벽화 틀(img/v79/ys_frame.png · 선생님 11/23 A안) · 되찾은 조각은 그 자리에 · '?' = 아직 · 다 맞추면 금빛
        if (!ysMuralImg) { ysMuralImg = new Image(); ysMuralImg.src = 'games/action/rpg/img/v79/' + D.YS.mural + '.jpg?v=172'; }
        const fim = img79('ys_frame'), FW = 270, FH = fim ? Math.round(fim.naturalHeight * FW / fim.naturalWidth) : 212, fx = Math.round(n.x - FW / 2), fy = Math.round(n.y - FH + 6);
        const x = Math.round(fx + FW * 0.1908), y = Math.round(fy + FH * 0.2867), w = Math.round(FW * 0.6196), h = Math.round(FH * 0.4197), have = S.ysp, done = S.ysMural, ok = ysMuralImg.complete && ysMuralImg.naturalWidth;
        c.save(); c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(n.x, n.y, FW * 0.46, 10, 0, 0, Math.PI * 2); c.fill();
        if (fim) c.drawImage(fim, fx, fy, FW, FH); else { c.fillStyle = '#7A4A22'; c.fillRect(x - 8, y - 8, w + 16, h + 16); }
        c.fillStyle = '#1D2340'; c.fillRect(x, y, w, h);
        const cw = w / 3, ch = h / 3, iw = ok ? ysMuralImg.naturalWidth / 3 : 0, ih = ok ? ysMuralImg.naturalHeight / 3 : 0;
        if (done && ok) {
          c.save(); c.shadowColor = '#FFD23F'; c.shadowBlur = 14 + 6 * Math.sin(now / 300); c.strokeStyle = '#FFD23F'; c.lineWidth = 3; c.strokeRect(x - 2, y - 2, w + 4, h + 4); c.restore();
          c.drawImage(ysMuralImg, x, y, w, h);
        } else {
          c.font = '15px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          for (let i = 0; i < 9; i++) { const cx = x + (i % 3) * cw, cy = y + Math.floor(i / 3) * ch;
            /* v179 선생님 11/23: 조각은 캐릭터가 들고 있음 → 퍼즐을 맞추기 전까지 틀은 비어 있음 */ { c.strokeStyle = '#3C78F0'; c.lineWidth = 1.5; c.strokeRect(cx + 1.5, cy + 1.5, cw - 3, ch - 3); c.fillStyle = '#9AE6FF'; c.fillText('?', cx + cw / 2, cy + ch / 2 + 1); } }
        }
        c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
        const nh = have.filter(Boolean).length, label = done ? '이순신 장군님 벽화' : nh >= 9 ? `들고 있는 벽화 조각 9개 · 틀 앞으로 다가가면 맞추기` : `${n.def.name} · 들고 있는 조각 ${nh}/9`; c.strokeText(label, n.x, fy - 4); c.fillStyle = n.def.color; c.fillText(label, n.x, fy - 4); c.restore();
        if (!done && nh >= 9 && Math.hypot(G.px - n.x, G.py - n.y) > 60) { const by = n.y + 26 + Math.sin(now / 250) * 4; c.save(); c.fillStyle = '#FFD23F'; c.strokeStyle = '#1D2340'; c.lineWidth = 3; c.font = '13px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.strokeText('▲ 여기로 오면 벽화 맞추기', n.x, by + 14); c.fillText('▲ 여기로 오면 벽화 맞추기', n.x, by + 14); c.restore(); }   // v180 어디로 가야 하는지
        if (n.say && n.sayT > 0) (G.sayQ || (G.sayQ = [])).push([n, fy - 16]);
      }
      // 다른 플레이어 (아바타 + 장비, 이름 하늘색)
      function drawPeer(c, p, now) {
        if (!p.av) return;
        if (Math.hypot(p.vx || 0, p.vy || 0) > 12) p.view = Math.abs(p.vy) > Math.abs(p.vx) * 1.15 ? (p.vy > 0 ? 'f' : 'b') : 's';   // v107 다른 사람도 움직이는 방향 모습
        const posing = now < (p.poseUntil || 0), pv = posing ? 'f' : p.view || 'f', fs = figSet(AV.normalize(p.av), p.eq || {}, p.hide, posing ? 'c' : 0, pv), img = fs.img;
        const k = img.width > AV.size.w ? 1 : 2, w = img.width * k, h = img.height * k, x = Math.round(p.x - w / 2), y = Math.round(p.y - h + 2);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(p.x, p.y, 16, 5, 0, 0, Math.PI * 2); c.fill();
        drawFig(c, img, x, y, w, h, p.face, (p.walk || 0) * Math.PI * 4, p.moving && !posing, p.eq && p.eq.weapon && !p.hide ? 'left' : true, fs.side);
        c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
        const nm = p.nick + ' Lv.' + p.lv; c.strokeText(nm, p.x, y - 6); c.fillStyle = '#9AE6FF'; c.fillText(nm, p.x, y - 6);
        if (p.title) { c.save(); drawTitle(c, p.title, p.x, y); c.restore(); }   // v176 다른 사람 타이틀
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
      /* v127 선생님 시안: 금테 두른 남색 판 (바깥 검은 선 · 금 테두리 · 안쪽 옅은 금 선 · 네 귀퉁이 금 장식) */
      const GOLD = ['#FFE7A0', '#D8B25A', '#9A6E22'];
      function goldStroke(c, y, h) { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, GOLD[0]); g.addColorStop(0.5, GOLD[1]); g.addColorStop(1, GOLD[2]); return g; }
      function gem(c, x, y, s) {   // 귀퉁이 마름모 장식
        c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
        c.fillStyle = '#0A0E24'; c.fillRect(-s - 1.5, -s - 1.5, s * 2 + 3, s * 2 + 3);
        const g = c.createLinearGradient(-s, -s, s, s); g.addColorStop(0, GOLD[0]); g.addColorStop(1, GOLD[2]); c.fillStyle = g; c.fillRect(-s, -s, s * 2, s * 2);
        c.fillStyle = '#7A2A3A'; c.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8); c.restore();
      }
      function panelBox(c, x, y, w, h, r, opt) {
        opt = opt || {};
        const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(38,46,96,.94)'); g.addColorStop(1, 'rgba(12,16,40,.94)');
        c.fillStyle = '#0A0E24'; rr(c, x - 3, y - 3, w + 6, h + 6, r + 3); c.fill();
        c.fillStyle = g; rr(c, x, y, w, h, r); c.fill();
        c.strokeStyle = goldStroke(c, y, h); c.lineWidth = 2.5; rr(c, x - 0.5, y - 0.5, w + 1, h + 1, r + 0.5); c.stroke();
        c.strokeStyle = 'rgba(255,226,150,.28)'; c.lineWidth = 1; rr(c, x + 3, y + 3, w - 6, h - 6, Math.max(1, r - 3)); c.stroke();
        if (opt.gems !== false) { const s = w > 120 && h > 30 ? 3.2 : 2.4; gem(c, x + 1, y + 1, s); gem(c, x + w - 1, y + 1, s); gem(c, x + 1, y + h - 1, s); gem(c, x + w - 1, y + h - 1, s); }
      }
      // v127 지도 이름 띠: 양 끝이 뾰족한 두루마리 모양 + 금테
      function bannerBox(c, cx, y, w, h) {
        const x0 = cx - w / 2, x1 = cx + w / 2, k = 14, path = (d) => { c.beginPath(); c.moveTo(x0 + k - d, y - d); c.lineTo(x1 - k + d, y - d); c.lineTo(x1 + d * 0.6, y + h / 2); c.lineTo(x1 - k + d, y + h + d); c.lineTo(x0 + k - d, y + h + d); c.lineTo(x0 - d * 0.6, y + h / 2); c.closePath(); };
        path(4); c.fillStyle = '#0A0E24'; c.fill();
        const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(44,52,108,.96)'); g.addColorStop(1, 'rgba(14,18,46,.96)');
        path(0); c.fillStyle = g; c.fill(); c.strokeStyle = goldStroke(c, y, h); c.lineWidth = 2.5; c.stroke();
        c.save(); c.translate(0, 0); path(-4); c.strokeStyle = 'rgba(255,226,150,.3)'; c.lineWidth = 1; c.stroke(); c.restore();
        gem(c, x0 - 1, y + h / 2, 3.2); gem(c, x1 + 1, y + h / 2, 3.2);
        // 위·아래 가운데 작은 장식 줄
        c.fillStyle = goldStroke(c, y - 3, 6); c.fillRect(cx - 18, y - 2, 36, 3); c.fillRect(cx - 18, y + h - 1, 36, 3);
      }
      function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
      function bar(c, x, y, w, h, v, cols, label, ghost) {
        c.fillStyle = '#0A0E24'; rr(c, x - 3, y - 3, w + 6, h + 6, 5); c.fill(); c.strokeStyle = goldStroke(c, y - 2, h + 4); c.lineWidth = 1.5; rr(c, x - 1.5, y - 1.5, w + 3, h + 3, 4); c.stroke(); c.fillStyle = '#1E2650'; c.fillRect(x, y, w, h);   // v127 금테
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
        c.fillStyle = '#0A0E24'; rr(c, 14, 14, 70, 70, 8); c.fill(); c.strokeStyle = goldStroke(c, 14, 70); c.lineWidth = 2; rr(c, 14, 14, 70, 70, 8); c.stroke();   // v127 금테 초상화
        const pg = c.createLinearGradient(0, 16, 0, 82); pg.addColorStop(0, '#5C86FF'); pg.addColorStop(1, '#2F3FA0'); c.fillStyle = pg; rr(c, 16, 16, 66, 66, 7); c.fill();
        c.drawImage(getPortrait(), 17, 17, 64, 64);
        if (S.sp > 0) {   // 올릴 스탯 포인트가 있으면 얼굴 오른쪽 위에 + 표시 (톡톡 튐)
          const k2 = 1 + 0.12 * Math.abs(Math.sin(now / 250)); c.save(); c.translate(80, 18); c.scale(k2, k2);
          c.fillStyle = '#0A0E24'; c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fill(); c.fillStyle = '#FF5A5F'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#FFFFFF'; c.fillRect(-5, -1.5, 10, 3); c.fillRect(-1.5, -5, 3, 10); c.restore();
        }
        c.fillStyle = '#0A0E24'; rr(c, 10, 68, 40, 22, 6); c.fill(); c.fillStyle = goldStroke(c, 70, 18); rr(c, 12, 70, 36, 18, 5); c.fill(); c.fillStyle = '#1D2340'; c.font = '12px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Lv.' + S.lv, 30, 80);
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
        const t = M.kind !== 'field' || M.hell || M.custom || M.arena ? M.name + (M.test ? ' 🔒' : '') : `사냥터 ${M.no}. ${M.name}`, rec = M.arena ? '⚔ 1:1 결투' : M.kind === 'room' ? MAPBY[S.map].name + ' · 건물 안' : M.kind === 'village' ? '마을' : `권장 Lv.${M.rec}`;
        c.font = '17px "Jua", "Malgun Gothic", sans-serif'; const tw = Math.max(c.measureText(t).width, 90) + 56;
        bannerBox(c, W / 2, 9, tw, 40);   // v127 두루마리 띠
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = '#0A0E24'; c.strokeText(t, W / 2, 23); c.fillStyle = '#FFF3D6'; c.fillText(t, W / 2, 23);
        c.font = '11px "Jua", sans-serif'; c.fillStyle = M.kind !== 'field' ? '#9AE6FF' : M.rec > S.lv + 6 ? '#FF8A8E' : M.rec > S.lv + 2 ? '#FFD23F' : '#9AF0B0'; c.fillText(rec + (M.kind !== 'village' && M.rec > S.lv + 6 ? ' · 위험!' : ''), W / 2, 39);
        // v104 채널 이동 버튼 (온라인일 때만)
        { const want = !!(net && net.joined && net.chNo), b = $('#rgChBtn'); if (b && b.hidden === want) b.hidden = !want; if (want && b._no !== net.chNo) { b._no = net.chNo; b.firstChild.textContent = net.chNo + '채널'; } }
        // 서버 표시 (위 가운데 이름 아래)
        if (net && net.joined) {
          const st = `${net.name(net.server)}${net.chNo ? ` · ${net.chNo}채널` : ''} · 여기 ${net.peers.size + 1}명`; c.font = '12px "Jua", "Malgun Gothic", sans-serif'; const sw = c.measureText(st).width + 18;
          c.fillStyle = 'rgba(10,14,36,.85)'; rr(c, W / 2 - sw / 2, 55, sw, 20, 9); c.fill(); c.strokeStyle = goldStroke(c, 55, 20); c.lineWidth = 1.5; rr(c, W / 2 - sw / 2, 55, sw, 20, 9); c.stroke(); c.fillStyle = '#F2E6C4'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(st, W / 2, 66);
        }
        // 오른쪽 위: 작은 지도
        if (!G.room) drawMini(c, now);
        // 보스 체력 (큰 막대)
        const boss = G.mons.find(m => m.boss && !m.isClone && !m.dead && (m.aggro || Math.hypot(m.x - G.px, m.y - G.py) < 420));
        if (boss) {
          const bw = 420, bx = W / 2 - bw / 2, by = net && net.joined ? 84 : 58; panelBox(c, bx - 8, by - 4, bw + 16, 34, 8);
          c.font = '13px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#FF8A8E'; c.fillText('보스 ' + boss.name + ' Lv.' + boss.lvl + (boss.def && boss.def.immune ? (Array.isArray(boss.def.immune) ? ' · ' + boss.def.immune.map(e => ELEM[e].name).join('·') + ' 공격 무효' : boss.def.immune === 'all' ? ' · 모든 공격 무효' : ' · ' + ELEM[boss.def.immune].name + ' 공격 무효') : boss.el && ELEM[boss.el] ? ' · ' + ELEM[boss.el].name + ' 속성 (약점 ' + ELEM[D.HELL.weak[boss.el]].name + ')' : ''), bx, by + 7);
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
        drawDuelHud(c);   // v143 결투 HP 막대 · 3초 세기
        drawTrainHud(c);   // v144 훈련장 딜량
        if (G.touch || (G.room && !G.room.duel && !G.room.train)) return;   // v144 훈련장은 마법 칸 보임   // 건물 안에서는 아래 마법 칸을 숨김 (나가는 문이 보이게) · 결투장은 보임
        // 아래 가운데: 기본 마법 4칸(1~4) + 융합 마법 4칸(Q W E R) + 포션 2칸(Z X) + v125 귀환(V)
        const bw = 11 * 54 + 2 * 12 - 4, x0 = Math.round(W / 2 - bw / 2), y0 = H - 62;
        panelBox(c, x0 - 8, y0 - 8, bw + 16, 60, 12);
        for (let i = 0; i < 4; i++) skillSlot(c, x0 + i * 54, y0, 46, i, now);
        for (let i = 0; i < 4; i++) skillSlot(c, x0 + 4 * 54 + 12 + i * 54, y0, 46, 4 + i, now);
        potionSlot(c, x0 + 8 * 54 + 24, y0, 46, 'hp', 'Z'); potionSlot(c, x0 + 9 * 54 + 24, y0, 46, 'mp', 'X');
        recallSlot(c, x0 + 10 * 54 + 24, y0, 46); G.recallBox = { x: x0 + 10 * 54 + 24, y: y0, s: 46 };
      }
      // v125 귀환 칸: 집 그림 + 남은 시간
      function recallSlot(c, x, y, s) {
        const left = recallLeft();
        const ric = img79('ic_recall');   /* v150 Gemini 귀환 아이콘 (소용돌이 문 + 한옥) — 못 불러오면 예전 그림 */
        if (ric) { c.fillStyle = '#0A0E24'; rr(c, x - 1, y - 1, s + 2, s + 2, 7); c.fill(); c.drawImage(ric, x, y, s, s); if (recallLeft() <= 0) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.18 + 0.12 * Math.sin(performance.now() / 380); c.drawImage(ric, x, y, s, s); c.restore(); } }
        else { c.fillStyle = '#0A0E24'; rr(c, x - 1, y - 1, s + 2, s + 2, 7); c.fill(); c.fillStyle = '#1F4A3A'; rr(c, x, y, s, s, 6); c.fill(); }
        if (!ric) { c.save(); c.translate(x + s / 2, y + s / 2 + 2);
        c.fillStyle = '#FFD23F'; c.beginPath(); c.moveTo(-14, -2); c.lineTo(0, -15); c.lineTo(14, -2); c.closePath(); c.fill();   // 지붕
        c.fillStyle = '#F5E2B8'; c.fillRect(-10, -3, 20, 15); c.fillStyle = '#8A5A2B'; c.fillRect(-3, 3, 6, 9);                    // 벽 · 문
        c.strokeStyle = '#0A0E24'; c.lineWidth = 2; c.strokeRect(-10, -3, 20, 15); c.restore(); }
        if (left > 0) {
          c.save(); rr(c, x, y, s, s, 6); c.clip(); c.fillStyle = 'rgba(10,14,36,.72)'; c.beginPath(); c.moveTo(x + s / 2, y + s / 2); c.arc(x + s / 2, y + s / 2, s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / RECALL_CD)); c.closePath(); c.fill(); c.restore();
          c.font = '15px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = '#0A0E24'; const t = left >= 60 ? Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0') : String(Math.ceil(left)); c.strokeText(t, x + s / 2, y + s / 2); c.fillStyle = '#FFFFFF'; c.fillText(t, x + s / 2, y + s / 2);
        }
        c.fillStyle = '#0A0E24'; rr(c, x - 3, y - 3, 15, 15, 4); c.fill(); c.font = '11px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFD23F'; c.fillText('V', x + 4.5, y + 5);
      }
      /* v173 지도 아래 「☰ 메뉴」 (선생님 11/21): 누르면 3×3 — 스탯·가방·마법·펫·서버·도움말·Fight 대결·음악·저장 (크게 보기 뺌)
       *  건물 안(작은 지도 없음)에서는 오른쪽 위 · 펼친 동안에도 게임은 계속 진행 · 하나 고르거나 밖을 누르면 닫힘 */
      const MENU = [['stat', 'mb_stat', '스탯'], ['inv', 'mb_bag', '가방'], ['skill', 'mb_magic', '마법'], ['pet', 'mb_pet', '펫'], ['servers', 'mb_server', '서버'], ['help', 'mb_help', '도움말'], ['fight', 'mb_duel', 'Fight 대결'], ['bgm', 'mb_music', '음악'], ['save', 'mb_save', '지금 저장']];
      function menuGeo() {
        const mb = G.miniBox, x = W - 168, tw = 158, ty = !G.room && mb ? mb.y + mb.h + 22 : 12, cw = 78, ch = 64, gap = 6, pw = cw * 3 + gap * 4, ph = ch * 3 + gap * 4;
        return { tab: { x, y: ty, w: tw, h: 28 }, pop: { x: x + tw - pw, y: ty + 34, w: pw, h: ph }, cw, ch, gap };
      }
      function drawMenuTab(c, now) {
        const g = menuGeo(), t = g.tab; G.menuGeo = g;
        c.save(); c.fillStyle = '#0A0E24'; rr(c, t.x, t.y + 3, t.w, t.h, 8); c.fill();
        const gr = c.createLinearGradient(0, t.y, 0, t.y + t.h); gr.addColorStop(0, '#FFE48A'); gr.addColorStop(1, '#F3C23A'); c.fillStyle = gr; rr(c, t.x, t.y, t.w, t.h, 8); c.fill(); c.strokeStyle = '#6B4A12'; c.lineWidth = 2; rr(c, t.x, t.y, t.w, t.h, 8); c.stroke();
        c.font = '15px "Jua", "Malgun Gothic", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1D2340'; c.fillText('☰ 메뉴 ' + (G.menuOpen ? '▲' : '▼'), t.x + t.w / 2, t.y + t.h / 2 + 1);
        if (G.menuOpen) {
          const p = g.pop; c.fillStyle = 'rgba(0,0,0,.35)'; rr(c, p.x + 3, p.y + 6, p.w, p.h, 12); c.fill();
          const gp = c.createLinearGradient(0, p.y, 0, p.y + p.h); gp.addColorStop(0, '#1E2A55'); gp.addColorStop(1, '#0E1532'); c.fillStyle = gp; rr(c, p.x, p.y, p.w, p.h, 12); c.fill(); c.strokeStyle = '#C9A24A'; c.lineWidth = 3; rr(c, p.x, p.y, p.w, p.h, 12); c.stroke();
          const bgmOff = (($('#rgBgm') || {}).textContent || '').includes('켜기');
          MENU.forEach(([k, ic, lb], i) => {
            const x = p.x + g.gap + (i % 3) * (g.cw + g.gap), y = p.y + g.gap + Math.floor(i / 3) * (g.ch + g.gap);
            const cols = k === 'fight' ? ['#8A5AE8', '#5A2FB0', '#C9A8FF', '#FFFFFF'] : k === 'save' ? ['#F3D27A', '#C8922E', '#6B4A12', '#1D2340'] : ['#2C3A66', '#1A2446', '#5A6CA8', '#FFF4D0'];
            const gb = c.createLinearGradient(0, y, 0, y + g.ch); gb.addColorStop(0, cols[0]); gb.addColorStop(1, cols[1]); c.fillStyle = gb; rr(c, x, y, g.cw, g.ch, 8); c.fill(); c.strokeStyle = cols[2]; c.lineWidth = 2; rr(c, x, y, g.cw, g.ch, 8); c.stroke();
            const im = img79(ic); if (im) { c.imageSmoothingEnabled = false; c.drawImage(im, x + g.cw / 2 - 15, y + 7, 30, 30); c.imageSmoothingEnabled = true; }
            c.font = '12px "Jua", "Malgun Gothic", sans-serif'; c.fillStyle = cols[3]; c.fillText(k === 'bgm' ? (bgmOff ? '음악 켜기' : '음악 끄기') : lb, x + g.cw / 2, y + g.ch - 13);
          });
        }
        c.restore();
      }
      function menuClick(q) {   // true = 메뉴가 눌림을 썼음
        const g = G.menuGeo; if (!g) return false; const inR = (r) => q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h;
        if (inR(g.tab)) { G.menuOpen = !G.menuOpen; return true; }
        if (!G.menuOpen) return false;
        G.menuOpen = false;
        if (!inR(g.pop)) return true;   // 밖을 누르면 닫기만
        const cx = Math.floor((q.x - g.pop.x - g.gap / 2) / (g.cw + g.gap)), cy = Math.floor((q.y - g.pop.y - g.gap / 2) / (g.ch + g.gap)), it = MENU[cy * 3 + cx]; if (!it) return true;
        const b = it[0] === 'fight' ? el.querySelector('.rg-mb-fight') : el.querySelector(`.rg-bar [data-rg="${it[0]}"]`); if (b) b.click();
        return true;
      }
      function drawMini(c, now) {
        const map = G.map, mw = 150, k = mw / map.w, mh = Math.round(map.h * k), x0 = W - mw - 14, y0 = 12;
        panelBox(c, x0 - 4, y0 - 4, mw + 8, mh + 8, 6); G.miniBox = { x: x0 - 4, y: y0 - 4, w: mw + 8, h: mh + 8 };   // v172 누르면 큰 지도
        c.save(); c.globalAlpha = 0.9; c.imageSmoothingEnabled = false; c.drawImage(map.mini, x0, y0, mw, mh); c.restore();
        G.mons.forEach(m => { if (m.dead) return; c.fillStyle = m.boss ? '#FF3D4A' : m.aggro ? '#FF8A3D' : '#FFD8D8'; const s = m.boss ? 5 : 3; c.fillRect(x0 + m.x / TS * k - s / 2, y0 + m.y / TS * k - s / 2, s, s); });
        if (net) net.peers.forEach(p => { c.fillStyle = '#9AE6FF'; c.fillRect(x0 + p.x / TS * k - 2, y0 + p.y / TS * k - 2, 4, 4); });
        map.buildings.forEach(b => { c.fillStyle = '#FFD27A'; c.fillRect(x0 + (b.door.x + 0.5) * k - 2, y0 + (b.door.y + 0.5) * k - 2, 4, 4); });
        c.font = '11px "Jua", sans-serif'; c.textAlign = 'right'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = '#0A0E24'; c.strokeText('🗺 지도 (M)', x0 + mw, y0 + mh + 6); c.fillStyle = '#FFD23F'; c.fillText('🗺 지도 (M)', x0 + mw, y0 + mh + 6);
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
      const TB = { atk: { x: 880, y: 456, r: 48 }, s0: { x: 768, y: 482, r: 31 }, s1: { x: 778, y: 398, r: 31 }, s2: { x: 836, y: 346, r: 31 }, s3: { x: 914, y: 334, r: 31 }, f0: { x: 694, y: 420, r: 26 }, f1: { x: 712, y: 346, r: 26 }, f2: { x: 768, y: 290, r: 26 }, f3: { x: 842, y: 262, r: 26 }, hp: { x: 688, y: 500, r: 25 }, mp: { x: 636, y: 500, r: 25 }, rc: { x: 584, y: 500, r: 25 } };   // v125 rc = 귀환
      function drawTouch(c) {
        if (G.joy && G.joy.on) { c.globalAlpha = 0.3; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(G.joy.cx, G.joy.cy, 62, 0, Math.PI * 2); c.fill(); c.globalAlpha = 0.85; const g = c.createRadialGradient(G.joy.cx + G.joy.vx * 50, G.joy.cy + G.joy.vy * 50, 4, G.joy.cx + G.joy.vx * 50, G.joy.cy + G.joy.vy * 50, 28); g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#9AA8E0'); c.fillStyle = g; c.beginPath(); c.arc(G.joy.cx + G.joy.vx * 50, G.joy.cy + G.joy.vy * 50, 28, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
        else { c.globalAlpha = 0.3; c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.beginPath(); c.arc(110, 436, 62, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(110, 436, 24, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
        Object.entries(TB).forEach(([k, b]) => {
          c.globalAlpha = G.btnDown[k] ? 0.9 : 0.62; c.fillStyle = '#0A0E24'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
          if (k === 'atk') { const g = c.createRadialGradient(b.x, b.y - 10, 4, b.x, b.y, b.r); g.addColorStop(0, '#FFE45C'); g.addColorStop(1, '#C88A10'); c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r - 5, 0, Math.PI * 2); c.fill(); c.font = '18px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#1D2340'; c.fillText('공격', b.x, b.y + 1); return; }
          if (k === 'rc') {   // v173 휴대폰 귀환 버튼: 컴퓨터 화면과 같은 Gemini 귀환 그림 (선생님 11/21)
            const left = recallLeft(), R2 = b.r - 4, ric = img79('ic_recall');
            c.save(); c.beginPath(); c.arc(b.x, b.y, R2, 0, Math.PI * 2); c.clip(); c.fillStyle = '#1F4A3A'; c.fillRect(b.x - R2, b.y - R2, R2 * 2, R2 * 2);
            if (ric) c.drawImage(ric, b.x - R2, b.y - R2, R2 * 2, R2 * 2); else { c.font = '20px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText('🏠', b.x, b.y + 1); }
            if (left > 0) { c.fillStyle = 'rgba(10,14,36,.72)'; c.beginPath(); c.moveTo(b.x, b.y); c.arc(b.x, b.y, R2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left / RECALL_CD); c.closePath(); c.fill(); }
            c.restore();
            if (left > 0) { const t = left >= 60 ? Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0') : String(Math.ceil(left)); c.font = '14px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = '#0A0E24'; c.strokeText(t, b.x, b.y + 1); c.fillStyle = '#FFFFFF'; c.fillText(t, b.x, b.y + 1); }
            return;
          }
          if (k === 'hp' || k === 'mp') {   // v173 휴대폰 물약 버튼: 물약 그림 + 오른쪽 아래 개수
            const n = POT_T.reduce((a, t) => a + count(k + t), 0), R2 = b.r - 4, best = POT_T.map(t => k + t).find(i => count(i) > 0) || k + '1';
            const im = potionImgs[best] || (potionImgs[best] = Object.assign(new Image(), { src: P.itemImg(best) }));
            c.fillStyle = '#1A2148'; c.beginPath(); c.arc(b.x, b.y, R2, 0, Math.PI * 2); c.fill(); c.lineWidth = 3; c.strokeStyle = k === 'hp' ? '#FF4A3A' : '#3C78F0'; c.stroke();
            if (im.complete && im.naturalWidth) { const z = R2 * 1.5; c.globalAlpha = n ? 1 : 0.35; c.drawImage(im, b.x - z / 2, b.y - z / 2, z, z); c.globalAlpha = 1; }
            const tx = String(n); c.font = '13px "Jua", sans-serif'; const tw = Math.max(18, c.measureText(tx).width + 8), bx = b.x + R2 * 0.55, by = b.y + R2 * 0.62;
            c.fillStyle = k === 'hp' ? '#D2343A' : '#2F55D9'; rr(c, bx - tw / 2, by - 9, tw, 18, 9); c.fill(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FFFFFF'; c.fillText(tx, bx, by + 1);
            return;
          }
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
      async function save(server, xok) {
        if (!S) return;
        if (G.xLock && !xok) server = false;   // v145 포인트 교환 중에는 서버 저장을 미룸 (서버가 바꾼 골드를 옛 값으로 덮지 않게)
        const at = G.room ? G.room.back : { x: G.px, y: G.py };   // 건물 안이면 그 건물 문 앞을 저장
        S.x = Math.round(at.x); S.y = Math.round(at.y); S.savedAt = Date.now();
        if (!G.trade) pruneGear(S);   // v60 판 장비·부서진 장비 정보 지우기 (거래 중에는 그대로)
        if (ST) S.fc = fightCard();   // v174 Skillcom Fight 가 읽는 대결 카드
        const copy = JSON.parse(JSON.stringify(S));
        if (G.duel) { copy.hp = G.duel.hp0; copy.mp = G.duel.mp0; }   // v143 결투 중 저장: HP·MP 는 결투 전 값
        const uidNow = (Hub.user && Hub.user.id) || null;
        if (uidNow !== G.loadUid) { G.saveT = 0; if (!G.uidWarn) { G.uidWarn = 1; say('⚠ 로그인 상태가 바뀌었어요. 내 계정 캐릭터를 다시 불러옵니다…', 6); } return false; }   // v203 손님으로 시작한 캐릭터를 계정에 저장하지 않음
        Store.setLocal(uidNow, copy); G.saveT = 0;
        if (server) { G.srvT = 0; G.dirty = false; return Store.push(copy); }
        return true;
      }
      async function submitRank(pd, force) {
        if (!Hub.user) return;
        const now = Date.now(); if (now - G.lastSubmit < 4000 && !pd && !force) return; G.lastSubmit = now;
        const sec = Math.min(86400, Math.round(S.play - G.playMark)); G.playMark = S.play;
        try { await Hub.submitScore({ game_id: GAME, score: rankScore(), duration_sec: Math.max(0, sec), result: null, points_delta: pd || 0, extra: { lv: S.lv, map: S.map, kills: S.kills, hell: S.hell ? hellTxt(S.hell) : null, reb: S.reb || 0, dps: Math.min(1e13, Math.round(S.dpsBest || 0)), king: S.kingAt ? 9e12 - S.kingAt : 0, ys: S.ysAt && !(Hub.isAdmin && Hub.isAdmin()) ? 9e12 - S.ysAt : 0 } });   /* v182 ys = 9조 − 이순신 던전을 처음 깬 시각 (관리자는 기록에서 뺌 — 선생님 시험이 '첫 공략자'가 되지 않게) */   /* v158 king = 9조 − 처음 이긴 시각 → 클수록 먼저 이김 (extraTop 이 큰 값 1위) */ loadRank(); } catch (e) { console.warn('[rpg] 랭킹 저장 실패', e.message); }   // v134 환생 횟수(reb)도 기록 (메인 카드 '환생 1위')
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
        if (G.duel && kind !== 'help') { say('결투 중에는 창을 열 수 없어요', 2); return; }   // v143
        pane = kind; paneArg = arg || null; G.keys = {}; G.btnDown = {}; G.joy = null;
        tab.trash = false; tab.trashAsk = null; tab.trashSel = []; tab.sellAsk = null; tab.sellAll = false; tab.ysPz = null;   // v68 창을 새로 열면 버리기·팔기 확인은 꺼짐
        G.paused = !(net && net.joined && kind !== 'help');   // 온라인이면 창을 열어도 세상은 계속 (다른 사람이 계속 움직임)
        if (kind === 'chan') { chList = null; loadChans(); clearInterval(srvTimer); srvTimer = setInterval(() => { if (pane === 'chan') loadChans(); else clearInterval(srvTimer); }, 4000); }
        if (kind === 'servers') { srvList = null; loadServers(); clearInterval(srvTimer); srvTimer = setInterval(() => { if (pane === 'servers') loadServers(); else clearInterval(srvTimer); }, 5000); }
        renderPanel(); panel.hidden = false;
      }
      function closePanel() {
        if (pane === 'dead') return;
        const wasDoor = ['potion', 'school', 'chief', 'castle'].includes(pane);
        if (pane === 'trade' && G.trade) { if (tradeLocked()) return; endTrade(true); say('거래를 취소했어요', 2); return; }
        if (pane === 'tradeIn' && paneArg) net.trade({ k: 'no', to: paneArg.cid });
        if (pane === 'duelIn' && paneArg) net.trade({ k: 'dno', to: paneArg.cid });   // v143 결투 거절
        const was = pane; pane = null; panel.hidden = true; G.paused = false;
        if (was === 'help' && Hub.user && net && !net.joined && !G.srvAsked) { G.srvAsked = true; openPanel('servers'); return; }
        if (wasDoor && G.onDoor) { const b = G.onDoor; G.px = (b.door.x + 0.5) * TS; G.py = (b.door.y + 1.9) * TS; G.onDoor = null; }
        if (!S.help) { S.help = true; markDirty(); }
        try { screenEl.focus({ preventScroll: true }); } catch (e) { /* noop */ }
      }
      // v110 대화 창 얼굴: NPC 그림이 있으면 그림 위쪽(머리·어깨)을 64칸에 맞춤
      const faceC = {};
      function npcFace(d) {
        const im = d.img && img79(d.img); if (!im) return d.av ? npcPortrait(d.av) : '';
        if (faceC[d.img]) return faceC[d.img];
        const [cv, cx] = P.mk(64, 64), sw = im.naturalWidth, sh = Math.min(im.naturalHeight, Math.round(sw * 1.0)), side = Math.max(sw, sh) * 0.62;
        const sx = (sw - side) / 2, k = 64 / side; cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
        cx.drawImage(im, sx, 0, side, side, 0, 2, 64, 64);
        return (faceC[d.img] = cv.toDataURL());
      }
      const npcBox = () => { const a = paneArg; if (!a || !a.npc) return ''; const d = a.npc.def; return `<div class="rg-npc"><img src="${npcFace(d)}" alt=""><div><b style="color:${d.color}">${d.name}</b><p>“${a.hello}”</p></div></div>`; };
      /* v176 타이틀: 얻었는지 · 스탯 창 고르기 칸 · 이름 위 표시 */
      const TT = D.TITLES || [], ttBy = id => TT.find(t => t.id === id);
      const titleHave = id => id === 'reb10' ? (S.reb || 0) >= D.REBIRTH.max : id === 'king' ? !!S.kingAt : id === 'ys' ? !!S.ysAt : id === 'ys1' ? !!(Hub.user && G.ysFirst && G.ysFirst === Hub.user.id) : id === 'king1' ? !!(Hub.user && G.kingFirst && G.kingFirst === Hub.user.id) : false;
      const myTitle = () => (S && S.title && titleHave(S.title) ? S.title : '');
      const titleBox = () => { const have = TT.filter(t => titleHave(t.id));
        return `<div class="rg-ttl"><label>🏅 타이틀 <select data-title${have.length ? '' : ' disabled'}><option value="">${have.length ? '보이지 않기' : '아직 없음'}</option>${have.map(t => `<option value="${t.id}"${myTitle() === t.id ? ' selected' : ''}>${t.name}</option>`).join('')}</select></label><small>${TT.map(t => `${titleHave(t.id) ? '✔' : '·'} ${t.name} — ${t.how}`).join('<br>')}</small></div>`; };
      function drawTitle(c, id, x, y) {   // 이름 위 작은 띠 (y = 이름 글자 밑줄 높이)
        const t = ttBy(id); if (!t) return y;
        c.font = '11px "Jua", "Malgun Gothic", sans-serif'; const w = c.measureText(t.name).width + 14, yy = y - 26;
        c.fillStyle = '#1D2340'; rr(c, x - w / 2, yy - 8, w, 16, 7); c.fill(); c.strokeStyle = t.color; c.lineWidth = 1.5; rr(c, x - w / 2, yy - 8, w, 16, 7); c.stroke();
        c.fillStyle = t.color; c.textBaseline = 'middle'; c.fillText(t.name, x, yy + 0.5); c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = '#1D2340';
        return yy - 10;
      }
      const rebBox = () => { const n = S.reb || 0, max = D.REBIRTH.max, ok = S.rebReady && n < max;   // v131 스탯 창 아바타 아래 환생 칸
        return `<div class="rg-reb"><span class="cnt">환생 <b>${n}</b> / ${max}</span><button type="button" class="rg-rebbtn" data-rg2="rebirth" ${ok ? '' : 'disabled'}>♻ 환생하기</button><small>${n >= max ? '환생을 모두 마쳤어요' : ok ? '지금 환생할 수 있어요!' : '저승 10-5 오도전륜대왕을 이기면 열려요'}</small></div>`; };
      function wmapHtml() {
        const M = G.map.M, cur = S.map, vis = new Set(S.visited || []);
        const cls = id => id === cur ? 'cur' : vis.has(id) ? 'vis' : '';
        const dungeon = (title, sub, rows, extra, hide) => {
          const all = rows.concat(extra || []), cols = Math.max(...all.map(r => r.pos[0])) + 1, nr = Math.max(...all.map(r => r.pos[1])) + 1;
          // v190 선생님 11/23: 보스·장수를 이긴 방은 큰 지도에 ✖ (이순신 던전의 숨은 칸도 이기면 보임)
          const kill = r => { const k = r.kind, d = r.data || {}; if (M.sx) return SX.gods.includes(k) ? !!S.sasin[k] : k === 'all' ? !!S.sasinAll : k === 'king' ? !!S.kingAt : false;
            return k === 'gen' ? !!(S.ysp && S.ysp[d.yi]) : k === 'all' ? !!S.ysAll : k === 'boss' ? !!S.ysAt : false; };
          const show = all.filter(r => !(hide && hide(r)) || r.id === cur || kill(r));   // v172 이순신 던전: 장수·회합·본진 칸은 지도에 아예 안 그림 (지금 그 방에 있을 때만 📍 · v190 이긴 방은 ✖ 로 보임)
          return head(title, sub) + `<div class="rg-wm-grid${nr > 9 ? ' tall' : ''}" style="grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:repeat(${nr},minmax(${nr > 9 ? 30 : 44}px,auto))">${show.map(r => { const x = kill(r), hid = hide && hide(r) && !x; return `<div class="rg-wm-c ${cls(r.id)}${x ? ' kill' : ''}" style="grid-column:${r.pos[0] + 1};grid-row:${r.pos[1] + 1}"${x ? ` title="${r.kind === 'king' || r.kind === 'boss' ? '이긴 적 있음 (다시 도전할 수 있어요)' : '이긴 곳'}"` : ''}>${r.id === cur ? '📍' + (hid ? '' : '<br>') : ''}${hid ? '' : r.name}</div>`; }).join('')}</div>`
            + '<p class="sub" style="margin-top:8px"><span class="rg-wm-key cur">📍 지금 있는 곳</span> <span class="rg-wm-key vis">가 본 곳</span> <span class="rg-wm-key">아직 안 가 본 곳</span> <span class="rg-wm-key kill">보스·장수를 이긴 곳</span></p>';
        };
        if (M.sx && D.SASIN) return dungeon('🗺 광개토대왕 던전', '이 던전 안의 지도예요', D.SASIN.rows);
        if (M.ys && D.YS) return dungeon('🗺 이순신 장군님 던전', '어귀에서 한 바퀴 돌며 왜장 아홉을 만나요 (한산 → 명량 → 노량) · 가운데 길 = 벽화 → 회합 → 본진', D.YS.rows, [{ id: 'v7', name: '통영', pos: [D.YS.top[0], D.YS.top[1]] }]);   // v190 고리 길: 장수 칸도 처음부터 보임 (선생님 11/23 '지도가 너무 복잡하다')
        const rowsH = D.REGIONS.map((R, ri) => { const v = 'v' + (ri + 1); let s = `<div class="rg-wm-row"><span class="rg-wm-v ${cls(v)}">${ri + 1}. ${R.name}${R.castle ? ' 🏯' : ''}</span>`;
          for (let k2 = 0; k2 < 10; k2++) { const n = ri * 10 + k2 + 1, id = 'f' + n; s += `<span class="rg-wm-f ${cls(id)}" title="${R.fields[k2]}">${id === cur ? '📍' : n}</span>`; }
          return s + '</div>'; }).join('');
        const where = M.hell ? '지금은 저승에 있어요 · ' : M.custom ? '지금은 특별 지역에 있어요 · ' : '';
        return head('🗺 지도', where + '마을과 사냥터가 한 줄로 이어져 있어요 (마을 → 사냥터 10곳 → 다음 마을)') + `<div class="rg-wm-list">${rowsH}</div>`
          + '<p class="sub" style="margin-top:8px"><span class="rg-wm-key cur">📍 지금 있는 곳</span> <span class="rg-wm-key vis">가 본 곳</span> <span class="rg-wm-key">아직 안 가 본 곳</span></p>';
      }
      const head = (t, sub) => `<h3>${t}<button type="button" class="x" data-x>닫기 (Esc)</button></h3>${sub ? `<p class="sub">${sub}</p>` : ''}`;
      /* v149 펫 창 HTML */
      const petCard = (id, extra, cls) => { const P = PETBY[id], g = PG[P.g], url = petUrl(id); return `<div class="rg-pcard ${cls || ''}" style="--c:${g.color}">${url ? `<img src="${url}" alt="${P.name}">` : '<span class="q">?</span>'}<b>${P.name}</b><small style="color:${g.color}">${g.name}</small>${extra || ''}</div>`; };
      function petShopHtml() {
        const R = petRates(), ok = S.gold >= D.PET.price, r = tab.petRes;
        let h = `<div class="rg-petshop"><div class="rg-pethead"><b>🐾 이장님의 펫 뽑기</b><span>한 번 <b class="rg-gold">${fmtN(D.PET.price)} G</b> · 가진 골드 <b class="rg-gold">${fmtN(S.gold)} G</b></span></div>`;
        h += `<div class="rg-petrates">${R.map(x => `<div class="${x.on ? '' : 'lock'}" style="--c:${x.g.color}"><b>${x.g.name}</b><span>${x.on ? x.p.toFixed(1) + '%' : '🔒'}</span><small>올스탯 +${x.g.stat}</small>${x.on ? '' : `<em>${x.g.lockTxt}</em>`}</div>`).join('')}</div>`;
        if (R.some(x => !x.on)) {   /* v151 선생님 11/15: 영웅·전설 얻는 법을 뽑기 창에 크게 알림 */
          const hero = PG.find(x => x.lock === 'hero'), leg = PG.find(x => x.lock === 'legend'), soon = D.SASIN && !D.SASIN.on;
          h += `<div class="rg-petlock" style="margin:8px 0;padding:9px 12px;border-radius:10px;background:#1D2340;border:2px solid #D8A8FF;line-height:1.55">`
            + `<b style="color:#FFE45C">🔒 영웅·전설 펫은 보스를 이겨야 뽑기에 나와요</b><br>`
            + (petOpenOf(hero) ? '' : `<span style="color:${hero.color}">🐉 영웅</span> <span style="color:#FFFFFF">청룡·주작·백호·현무 — 숨은 「광개토대왕 던전」에서 <b style="color:${hero.color}">사방신 넷을 모두 이기면</b> 열려요</span><br>`)
            + (petOpenOf(leg) ? '' : `<span style="color:${leg.color}">👑 전설</span> <span style="color:#FFFFFF">광개토대왕 — 광개토대왕 던전 가장 깊은 곳에서 <b style="color:${leg.color}">광개토대왕을 이기면</b> 열려요</span><br>`)
            + `<small style="color:#9AE6FF">${soon ? '광개토대왕 던전은 곧 열려요! (환생한 사람만 들어갈 수 있어요)' : '환생한 사람만 들어갈 수 있는 숨은 입구를 찾아보세요'}</small></div>`;
        }
        { const yl = D.PETS.filter(p => p.plock && !(S.petOpen && S.petOpen[p.plock]));   // v182 거북선·이순신 펫 잠김 안내
          if (yl.length) h += `<div class="rg-petlock" style="margin:8px 0;padding:9px 12px;border-radius:10px;background:#1D2340;border:2px solid #9AE6FF;line-height:1.55"><b style="color:#9AE6FF">⚓ 이순신 장군님 던전 펫</b><br>${yl.map(p => `<span style="color:${PG[p.g].color}">${p.g === 4 ? '👑' : '🐢'} ${p.name}(${PG[p.g].name})</span> <span style="color:#FFFFFF">— ${p.lockTxt} 뽑기에 나와요</span>`).join('<br>')}</div>`; }
        h += `<div class="rg-srvact" style="justify-content:center"><button type="button" class="go rg-petgo" data-petdraw ${ok ? '' : 'disabled'}>${ok ? `🎁 펫 뽑기 · ${fmtN(D.PET.price)} G` : `골드가 모자라요 (${fmtN(D.PET.price)} G 필요)`}</button></div>`;
        if (r) { const P = PETBY[r.id], g = PG[P.g]; h += `<div class="rg-petres g${P.g}" style="--c:${g.color}" data-age="${Math.round(performance.now() - r.t)}">${petCard(r.id, `<em>올스탯 +${g.stat}${r.dup ? ' · 같은 펫이 있어서 펫 창(P)에서 강화할 수 있어요' : ''}</em>`, 'flip')}</div>`; }
        h += `<p class="sub" style="text-align:center">뽑은 펫은 모두 스탯에 더해져요 (지금 올스탯 <b>+${petBonus(S)}</b>) · 펫 창(P)에서 데리고 다닐 펫을 골라요</p></div>`;
        return h;
      }
      function petPaneHtml() {
        const t = tab.pet || 'my', pb = petBonus(S);
        let h = head('🐾 펫', `${S.pets.length}마리 · 가진 펫 모두 더해서 올스탯 <b>+${pb}</b> (힘·민첩·지혜·체력·저항) · 데리고 다니는 펫 1마리 · 이장 댁에서 뽑기`) + tabs('pet', [['my', '내 펫'], ['book', '도감']]);
        if (t === 'book') {
          PG.forEach((g, gi) => {
            const on = petOpenOf(g), list = D.PETS.filter(p => p.g === gi);
            h += `<div class="rg-region" style="--c:${g.color}"><b style="color:${g.color}">${g.name} · 올스탯 +${g.stat}${on ? '' : ' · 🔒 ' + g.lockTxt}</b><div class="rg-pgrid">${list.map(p => { const n = S.pets.filter(q => q.id === p.id).length; return petCard(p.id, `<em>${n ? n + '마리' : '없음'}</em>`, n ? '' : 'none'); }).join('')}</div></div>`;
          });
          return h;
        }
        if (!S.pets.length) return h + '<div class="rg-fuse">아직 펫이 없어요. 마을 <b>이장 댁</b>에서 이장님께 펫을 뽑아 보세요! (한 번 1만 G)</div>';
        const sel = S.pets.find(p => p.u === tab.petSel);
        if (sel) {
          const P = PETBY[sel.id], g = PG[P.g], en = sel.en, full = en >= D.PET.max, mats = S.pets.filter(p => p.id === sel.id && p.u !== sel.u), rate = full ? 0 : ENH.rate[en], keep = full ? 1 : D.PET.keep(en);
          const v0 = petVal(sel), v1 = g.stat * (1 + D.PET.per * (en + 1));
          h += `<section class="rg-anvil rg-petenh"><p class="rg-forgeh">✨ 펫 강화 — 같은 펫 1마리를 재료로 (골드 안 씀 · 부서지지 않음)</p><div class="big">${petCard(sel.id, `<em>+${en} · 올스탯 +${Math.round(v0 * 10) / 10}${full ? '' : ` → <b class="up">+${Math.round(v1 * 10) / 10}</b>`}</em>`)}<div class="grow"><b>재료: 같은 「${P.name}」 ${mats.length}마리 있음</b><small>${full ? '+10 최고 강화!' : `성공 ${rate}% · 실패하면 ${keep >= 1 ? '그대로' : `그대로 ${Math.round(keep * 100)}% · 한 단계 내려감 ${Math.round((1 - keep) * 100)}%`}`}</small></div></div>`;
          h += `<div class="ladder">${ENH.rate.map((r, i) => `<span class="${i < en ? 'done' : i === en ? 'next' : ''}" title="+${i + 1} 성공 ${r}%">+${i + 1}<br>${r}%</span>`).join('')}</div>`;
          h += `<div class="rg-srvact" style="justify-content:center"><button type="button" class="go" data-petenh="${sel.u}" ${!full && mats.length ? '' : 'disabled'}>${full ? '최고 강화' : mats.length ? `✨ 강화하기 · 성공 ${rate}%` : '같은 펫이 한 마리 더 필요해요'}</button><button type="button" class="rg-mini ghost" data-petsel="">닫기</button></div>`;
          const R2 = tab.petEnhRes;
          if (R2) h += `<div class="rg-res ${R2.ok ? 'ok' : R2.keep ? 'down' : 'bad'}"><div><div class="ham">${R2.ok ? '★' : R2.keep ? '=' : '▼'}</div><b>${R2.ok ? `강화 성공! +${R2.en}` : R2.keep ? `강화 실패… 그대로 +${R2.en}` : `강화 실패… +${R2.en} 로 내려감`}</b><small>${PETBY[R2.id].name}</small><button type="button" class="rg-mini x2" data-petok>확인</button></div></div>`;
          h += '</section>';
        }
        const best = {}; S.pets.forEach(p => { const b = best[p.id]; if (!b || p.en > b.en || (p.en === b.en && p.u === S.petOn)) best[p.id] = p; });   // 같은 펫은 한 장(가장 강화된 것) · 나머지는 강화 재료
        const list = Object.values(best).sort((a, b) => PETBY[b.id].g - PETBY[a.id].g || b.en - a.en || (a.id < b.id ? -1 : 1));
        h += `<div class="rg-pgrid">${list.map(p => { const P = PETBY[p.id], same = S.pets.filter(q => q.id === p.id), on = same.some(q => q.u === S.petOn), dup = same.length > 1;
          return petCard(p.id, `<em>${p.en ? '+' + p.en + ' · ' : ''}올스탯 +${Math.round(petVal(p) * 10) / 10}${dup ? ` · ${same.length}마리` : ''}</em><span class="btns"><button type="button" class="rg-mini${on ? ' on' : ''}" data-peton="${on ? '' : p.u}">${on ? '함께 다니는 중' : '데리고 다니기'}</button><button type="button" class="rg-mini ghost" data-petsel="${p.u}" ${dup && p.en < D.PET.max ? '' : 'disabled'}>강화</button></span>`, on ? 'on' : ''); }).join('')}</div>`;
        return h;
      }
      const tabs = (key, list) => `<div class="rg-tabs">${list.map(([k, n]) => `<button type="button" data-tab="${key}:${k}" aria-pressed="${(tab[key] || list[0][0]) === k}">${n}</button>`).join('')}</div>`;
      const edefTxt = () => { const v = Object.values(ST.edefs), lo = Math.min(...v), hi = Math.max(...v); return lo === hi ? lo + '%' : lo + '%+'; };
      /* v162 선생님 11/17: 장비를 누르면 옵션 위에 간단한 설명 (따로 적은 desc 가 있으면 그것 — 왕을 죽인 검·광개토대왕의 반지) */
      const BLURB = { sword: '가까이에서 베는 검이에요. 공격을 크게 올려 줘요.', staff: '마력을 모아 주는 지팡이예요. 공격과 마력을 함께 올려 마법이 세져요.',
        helmet: '머리를 지키는 투구예요. 방어와 체력을 올려 줘요.', armor: '몸을 지키는 갑옷이에요. 방어와 체력을 가장 많이 올려 줘요.',
        boots: '발을 지키는 신발이에요. 방어와 이동 속도를 올려 줘요.', ring: '손에 끼는 반지예요. 마나와 마력을 올려 줘요.' };
      function itemBlurb(it) {
        const B = ITEMS[it.base] || it, d = it.desc || B.desc;
        if (d) return (it.kingSword || B.kingSword) && inKingRoom() ? (it.descKing || B.descKing || d) : d;
        const k = it.slot === 'weapon' ? (B.look === 'staff' ? 'staff' : 'sword') : it.slot;
        const g = B.legend ? ' 전설 단계 — 아주 드물게 얻는 최고 장비예요.' : B.rare ? ' 정예 — 같은 단계 보통 장비보다 강해요.' : '';
        return (BLURB[k] || '') + g;
      }
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
          const cells = list.map(x => { const it = ITEMS[x.id], ok = !it.slot || S.lv >= it.req; const tsel = tab.trash && (tab.trashSel || []).includes(x.id); return `<button type="button" class="rg-cell${sel === x.id && !tab.trash ? ' sel' : ''}${tsel ? ' tsel' : ''}${it.rare ? ' rare' : ''}${ok ? '' : ' off'}" data-pick="${x.id}" style="${tierStyle(it)}" title="${it.name}"><img src="${P.itemImg(x.id)}" alt="${it.name}">${x.n > 1 ? `<span class="n">${x.n}</span>` : ''}${it.en ? `<span class="en">+${it.en}</span>` : ''}${it.grade ? `<span class="gd" style="--gd:${GRADE[it.grade].color}"></span>` : ''}${ok ? '' : `<span class="lk">Lv.${it.req}</span>`}${tsel ? '<span class="tck">✔</span>' : ''}</button>`; });
          const pad = f === 'all' ? bagMax() - list.length : (8 - list.length % 8) % 8 + (list.length ? 0 : 8);
          for (let i = 0; i < pad; i++) cells.push('<span class="rg-cell empty"></span>');
          h += `<section class="rg-bag"><div class="rg-tabs">${[['all', '전체'], ['gear', '장비'], ['use', '물약·물건']].map(([k2, n]) => `<button type="button" data-filt="${k2}" aria-pressed="${f === k2}">${n}</button>`).join('')}<button type="button" class="rg-trash${tab.trash ? ' on' : ''}" data-trash aria-pressed="${!!tab.trash}" title="쓰레기통: 누른 뒤 버릴 물건을 누르세요">🗑 ${tab.trash ? '버리기 켜짐 (끄기)' : '쓰레기통'}</button></div>${tab.trash ? (() => { const ts = (tab.trashSel || []).filter(q => count(q)); return `<div class="rg-trashtip">버릴 물건을 <b>여러 개</b> 눌러 고르세요 (다시 누르면 빼기 · 묶음은 통째로). 입고 있는 장비는 버릴 수 없어요.<div class="rg-trashbar"><span>고른 것 <b>${ts.length}</b>칸</span><button type="button" class="rg-mini" data-tsall>보이는 것 모두 고르기</button><button type="button" class="rg-mini ghost" data-tsnone ${ts.length ? '' : 'disabled'}>모두 빼기</button><button type="button" class="rg-mini warn" data-tsgo ${ts.length ? '' : 'disabled'}>🗑 고른 ${ts.length}칸 버리기</button></div></div>`; })() : ''}<div class="rg-grid${tab.trash ? ' trashing' : ''}">${cells.join('')}</div>`;
          // 고른 물건 자세히
          let it = null, id = null, worn = false;
          if (sel && sel.startsWith('eq:')) { id = S.eq[sel.slice(3)]; worn = true; } else if (sel && count(sel)) id = sel;
          it = ITEMS[id];
          if (it) {
            const cur = it.slot && !worn ? ITEMS[S.eq[it.slot]] : null, keys = ['atk', 'mag', 'def', 'hp', 'mp', 'spd'], nm = { atk: '공격', mag: '마력', def: '방어', hp: '체력', mp: '마나', spd: '속도%' };
            const cmp = it.slot ? keys.filter(q => (it.st || {})[q] || (cur && (cur.st || {})[q])).map(q => { const v = (it.st || {})[q] || 0, d = v - ((cur && cur.st && cur.st[q]) || 0); return `<span>${nm[q]} <b>${v}</b>${!worn && d ? ` <em class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</em>` : ''}</span>`; }).join('') : '';
            const btn = worn ? `<button type="button" class="rg-mini ghost" data-unequip="${it.slot}">벗기</button>` : it.stack ? `<button type="button" class="rg-mini" data-use="${id}">쓰기</button>` : `<button type="button" class="rg-mini" data-equip="${id}" ${S.lv >= it.req ? '' : 'disabled'}>${S.lv >= it.req ? (cur ? '바꿔 입기' : '입기') : 'Lv.' + it.req + ' 필요'}</button>`;
            h += `<div class="rg-detail">${itemIcon(id)}<div class="grow"><b class="nm${it.rare ? ' rare' : ''}"${it.grade != null ? ` style="color:${GRADE[it.grade].color}"` : ''}>${it.name}${it.grade != null ? `<span class="rg-grade">${GRADE[it.grade].name}</span>` : ''}${worn ? ' <small>입는 중</small>' : ''}</b><span class="ds">${it.slot ? `${D.SLOT_NAME[it.slot]} · ${it.rare && !it.legend ? '정예 · ' : ''}Lv.${it.req} 이상 · 강화 +${it.en || 0}/${ENH.max}${cur ? ' · 지금: ' + cur.name : ''}${it.noTrade ? ' · 거래 안 됨' : ''}` : it.desc + ' · 가진 수 ' + count(id)}</span>${it.slot ? `<span class="rg-itdesc">${itemBlurb(it)}</span>` : ''}${cmp ? `<div class="cmp">${cmp}</div>` : ''}${optList(it)}</div>${btn}</div>`;
          } else h += `<div class="rg-detail hint">칸을 누르면 자세히 보여요. 필요 없는 물건은 <b>🗑 쓰레기통</b>을 누른 뒤 고르면 버릴 수 있어요. 장비는 <b>입기</b>, 물약은 <b>쓰기</b>. 사냥터 몬스터가 장비를 떨어뜨려요 (보스는 꼭!)</div>`;
          h += '</section></div>';
          const tsq = tab.trashMulti ? (tab.trashSel || []).filter(q => count(q)) : null;   // v204 여러 개 버리기 경고
          if (tsq && tsq.length) { const tot = tsq.reduce((a, q) => a + (ITEMS[q].slot ? sellPrice(q) * count(q) : 0), 0), hi = tsq.filter(q => ITEMS[q].legend || ITEMS[q].rare || (ITEMS[q].grade || 0) >= 2 || (ITEMS[q].en || 0) >= 5);
            h += `<div class="rg-warnbg"><div class="rg-warn" role="alertdialog" aria-label="여러 아이템 버리기 경고"><b class="t">⚠ ${tsq.length}칸을 정말 버릴까요?</b><div class="rg-tslist">${tsq.map(q => { const it = ITEMS[q], gd = it.slot && it.grade != null ? GRADE[it.grade] : null; return `<span class="it${hi.includes(q) ? ' hi' : ''}">${itemIcon(q)}<em${gd ? ` style="color:${gd.color}"` : ''}>${it.name}${count(q) > 1 ? ' ×' + count(q) : ''}${it.en ? ' +' + it.en : ''}</em></span>`; }).join('')}</div>${hi.length ? `<p class="hi">⚠ 귀한 물건(정예·전설·높은 등급·+5 이상)이 <b>${hi.length}개</b> 들어 있어요!</p>` : ''}<p>버린 물건은 <b>사라지고 되돌릴 수 없어요.</b>${tot ? ` 약방에 팔면 모두 <b class="rg-price">${fmtN(tot)} G</b> 를 받을 수 있어요.` : ''}</p><div class="btns"><button type="button" class="rg-mini warn" data-tsdo>${tsq.length}칸 모두 버리기</button><button type="button" class="rg-mini" data-tsno>취소</button></div></div></div>`; }
          const tq = tab.trashAsk && count(tab.trashAsk) ? tab.trashAsk : null;   // v68 버리기 경고
          if (tq) { const it = ITEMS[tq], n = count(tq), gd = it.slot && it.grade != null ? GRADE[it.grade] : null;
            h += `<div class="rg-warnbg"><div class="rg-warn" role="alertdialog" aria-label="아이템 버리기 경고"><b class="t">⚠ 정말 버릴까요?</b>${itemIcon(tq)}<p class="nm"${gd ? ` style="color:${gd.color}"` : ''}>${it.name}${n > 1 ? ' ×' + n : ''}${gd ? `<span class="rg-grade">${gd.name}</span>` : ''}</p><p>버린 물건은 <b>사라지고 되돌릴 수 없어요.</b>${it.slot ? ` 약방에 팔면 <b class="rg-price">${fmtN(sellPrice(tq))} G</b> 를 받을 수 있어요.` : ''}</p><div class="btns"><button type="button" class="rg-mini warn" data-trashdo="${tq}:1">${n > 1 ? '1개 버리기' : '버리기'}</button>${n > 1 ? `<button type="button" class="rg-mini warn" data-trashdo="${tq}:${n}">${n}개 모두 버리기</button>` : ''}<button type="button" class="rg-mini" data-trashno>취소</button></div></div></div>`; }
        } else if (k === 'skill') {   // v146 금테 꾸미기: 위 두 판(기본 1~4 · 융합 QWER) + 아래 배운 마법 (원소 색 줄)
          h = head('마법', '기본 마법은 <b>1~4</b> 칸, 융합 마법은 <b>Q W E R</b> 칸에 넣어요. 같은 마법을 다른 칸에 넣으면 옮겨져요. 새 마법은 마을의 <b>도술 서원</b>에서 배워요.');
          const slotHtml = (id, key, empty) => { const sk = skill(id); return `<span class="rg-slot"><b>${key}</b>${sk ? `<img class="rg-sk" src="${Fx.iconURL(sk)}" alt="">${sk.name}` : `<i>${empty}</i>`}</span>`; };
          h += `<div class="rg-skbar"><section class="rg-skset"><h4>⚡ 기본 마법<small>숫자 1~4</small></h4><div class="rg-slots">${[0, 1, 2, 3].map(i => slotHtml(S.slots[i], i + 1, '비어 있음')).join('')}</div></section>`;
          h += `<section class="rg-skset fu"><h4>✦ 융합 마법<small>Q W E R</small></h4><div class="rg-slots">${[0, 1, 2, 3].map(i => slotHtml(S.fslots[i], FKEY[i], '융합 마법')).join('')}</div></section></div>`;
          const skCol = sk => (ELEM[(sk.els || [])[0]] || {}).color || '#C9A24A';
          h += `<ul class="rg-list">${S.skills.length ? S.skills.map(id => { const sk = skill(id); return `<li class="rg-row" style="--c:${skCol(sk)}"><img class="rg-sk" src="${Fx.iconURL(sk)}" alt=""><span class="grow"><span class="nm">${sk.fusion ? '융합 · ' : ''}${sk.name} <small style="color:#C9D0F0">Lv.${sk.lv}</small></span><span class="ds">${describe(sk)}</span></span><span class="keys">${[0, 1, 2, 3].map(i => sk.fusion ? `<button type="button" class="rg-mini${S.fslots[i] === id ? ' on' : ' ghost'}" data-slot="f${i}|${id}">${FKEY[i]}</button>` : `<button type="button" class="rg-mini${S.slots[i] === id ? ' on' : ' ghost'}" data-slot="${i}|${id}">${i + 1}</button>`).join('')}</span></li>`; }).join('') : '<li class="rg-row">아직 배운 마법이 없어요. Lv.3이 되면 의주 도술 서원에서 파이어볼을 배울 수 있어요.</li>'}</ul>`;
        } else if (k === 'potion') {
          const ri = G.map.M.region, t = tab.potion || 'buy';
          h = head('약방', `<span class="rg-gold">${fmtN(S.gold)} G</span> · 이 마을은 ${ri + 1}단계 포션까지 팔아요`) + npcBox() + tabs('potion', [['buy', '사기'], ['sell', '팔기'], ['xchg', '💱 포인트 교환']]);   // v145 골드 ↔ 사이트 포인트
          if (t === 'xchg') h += xchgHtml();
          if (t === 'buy') { const bu = S.bagUp || 0, bc = D.BAG.cost(bu); h += `<div class="rg-bagup"><span class="ic">🎒</span><span class="grow"><b>가방 늘리기 +${D.BAG.step}칸</b><small>지금 ${bagMax()}칸 → ${bu < D.BAG.max ? bagMax() + D.BAG.step : bagMax()}칸 · 최대 ${D.BAG.base + D.BAG.step * D.BAG.max}칸 (${bu}/${D.BAG.max}번)</small></span>${bu >= D.BAG.max ? '<span class="rg-mini on">최대</span>' : `<button type="button" class="rg-mini" data-bagup ${S.gold >= bc ? '' : 'disabled'}>${fmtN(bc)} G</button>`}</div>`; }
          if (t === 'buy') h += `<ul class="rg-list">${D.POTIONS.filter(p => p.tier <= ri).map(p => `<li class="rg-row">${itemIcon(p.id)}<span class="grow"><span class="nm">${p.name} <small style="color:#AEB7E0">가진 수 ${count(p.id)}</small></span><span class="ds">${p.desc} · ${fmtN(p.price)} G</span></span><button type="button" class="rg-mini" data-buy="${p.id}:1" ${S.gold >= p.price ? '' : 'disabled'}>1개</button><button type="button" class="rg-mini" data-buy="${p.id}:10" ${S.gold >= p.price * 10 ? '' : 'disabled'}>10개</button></li>`).join('')}</ul>`;
          else if (t === 'sell') {   // v68 팔기: 장비는 등급·레벨·강화로 값이 정해짐. 희귀 이상·강화한 장비는 한 번 더 묻기
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
            h += `<p class="sub">이 마을까지의 마법을 배울 수 있어요. 다음 마을에 가면 더 강한 마법이 있어요.</p><ul class="rg-list">${list.map(s => { const has = S.skills.includes(s.id), ok = S.lv >= s.lv, sk = skill(s.id); return `<li class="rg-row${ok || has ? '' : ' off'}" style="--c:${(ELEM[(sk.els || [])[0]] || {}).color || '#C9A24A'}"><img class="rg-sk" src="${Fx.iconURL(sk)}" alt=""><span class="grow"><span class="nm">${s.name} <small style="color:#AEB7E0">Lv.${s.lv} · ${fmtN(s.price)} G</small></span><span class="ds">${describe(sk)}</span></span>${has ? '<span class="rg-mini on">배움</span>' : `<button type="button" class="rg-mini" data-learn="${s.id}" ${ok && S.gold >= s.price ? '' : 'disabled'}>${ok ? '배우기' : 'Lv.' + s.lv}</button>`}</li>`; }).join('')}</ul>`;
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
          if (t === 'story') h += `<div class="rg-story">${D.HELL.story.map(x => `<p>${x}</p>`).join('')}</div><p class="sub" style="margin:10px 0 6px">📖 관문 웹툰 다시 보기 (들어가 본 관문까지)</p><div class="rg-stages">${D.HELL.gates.map(g => `<button type="button" class="rg-stage" data-toongate="${g.no}" ${(S.hell || 0) >= (g.no - 1) * 5 || (S.toonSeen || []).includes(g.no) ? '' : 'disabled'}><b>${g.no}관문</b><span>${g.hell}</span></button>`).join('')}</div>`;
          else h += D.HELL.gates.map(g => { const base = (g.no - 1) * 5;
            return `<div class="rg-gate"><b class="gt">제${g.no}관문 · ${g.hell} <small>${g.king} · ${g.day}</small></b> <span class="rg-el">속성 ${ELEM[g.el].name} · 약점 <b>${ELEM[D.HELL.weak[g.el]].name}</b> 마법 (×${D.HELL.weakMul})</span><p class="sub" style="margin:4px 0 8px">${g.about}</p><div class="rg-stages">${[1, 2, 3, 4, 5].map(st => { const n = base + st, open = n <= best + 1, done = n <= best, lv = 100 + base + st;
              return `<button type="button" class="rg-stage${done ? ' done' : ''}" data-hellgo="h${g.no}-${st}" ${open ? '' : 'disabled'}><b>${g.no}-${st}</b><span>${g.stageName[st - 1]}</span><small>${st === 5 ? '대왕 Lv.' + (lv + D.HELL.bossPlus) : `Lv.${lv} · ${D.HELL.kills}마리${st === 3 ? ` + 옥졸 Lv.${lv + D.HELL.midPlus}` : st === 4 ? ` + 판관 Lv.${lv + D.HELL.midPlus}` : ''}`}</small><i>${done ? '통과' : open ? '들어가기' : '잠김'}</i></button>`; }).join('')}</div></div>`; }).join('') + `<p class="sub">앞 단계를 깨야 다음 단계가 열려요 (1-1 → … → 10-5). 10관문 오도전륜대왕을 이기면 명부를 되찾아요! 저승에서 쓰러지면 그 단계는 처음부터 다시 해요.</p>`;
        } else if (k === 'wmap') {   // v172 큰 지도 (선생님 11/20): 보통 = 마을·사냥터 한 줄 · 광개토대왕 던전 안 = 그 던전만 · 이순신 장군님 던전 안 = 그 던전만(보스·장수 칸은 이름 없이)
          h = wmapHtml();
        } else if (k === 'station') {   // v85 역참: 다른 마을로 한 번에 (레벨 제한 · 이용료)
          const here = villageNo(S.map);
          h = head('역참 · 마을 이동', `<span class="rg-gold">${fmtN(S.gold)} G</span> · 가는 마을의 <b style="color:#FFD23F">시작 레벨</b> 이상이면 갈 수 있어요 · 이용료 = 거리 × 마을 번호 × ${D.STATION.feeUnit} G`) + npcBox();
          h += `<ul class="rg-list">${D.REGIONS.map((r, i) => { const id = 'v' + (i + 1), need = D.LV_RANGE[i][0], fee = D.stationFee(here, i), lvOk = S.lv >= need, gOk = S.gold >= fee, cur = i === here;
            const why = cur ? '지금 있는 마을' : !lvOk ? `Lv.${need} 부터` : !gOk ? '골드 부족' : '';
            return `<li class="rg-row${cur ? ' sel' : ''}"><span class="grow"><span class="nm">${i + 1}. ${r.name}${r.castle ? ` <small style="color:#FFD23F">🏯 ${r.castle.name}</small>` : ''} <small style="color:#AEB7E0">Lv.${D.LV_RANGE[i][0]}~${D.LV_RANGE[i][1]}</small></span><span class="ds">${cur ? '여기예요' : `이용료 <b style="color:#FFE45C">${fmtN(fee)} G</b> · 시작 레벨 <b style="color:${lvOk ? '#9AF0B0' : '#FF8A8E'}">Lv.${need}</b>`}</span></span><button type="button" class="rg-mini" data-stgo="${id}" ${why ? 'disabled' : ''}>${why || '출발'}</button></li>`; }).join('')}${godsDone() >= 4 ? (() => { const fee = D.STATION.sxFee || 3000, ok = S.gold >= fee;   // v157 사방신 넷을 이기면 보이는 칸
            return `<li class="rg-row" style="border-color:#FFD23F"><span class="grow"><span class="nm" style="color:#FFD23F">🐉 광개토대왕 던전 어귀 <small style="color:#AEB7E0">사방신 모두 방 바로 앞</small></span><span class="ds">이용료 <b style="color:#FFE45C">${fmtN(fee)} G</b> · 사방신 넷을 모두 이겨서 열렸어요</span></span><button type="button" class="rg-mini" data-stsx="1" ${ok ? '' : 'disabled'}>${ok ? '출발' : '골드 부족'}</button></li>`; })() : ''}</ul>`;
        } else if (k === 'forge') {   // v60 대장간: 장비 강화 (+0 → +10 · 실패하면 부서짐)
          const mine = Object.keys(S.eq).map(sl => ({ id: S.eq[sl], worn: true })).concat(S.inv.filter(x => ITEMS[x.id] && ITEMS[x.id].slot).map(x => ({ id: x.id, worn: false })));
          if (!mine.some(x => x.id === tab.fgSel)) tab.fgSel = (mine.find(x => (ITEMS[x.id].en || 0) < ENH.max) || mine[0] || {}).id || null;
          h = head('대장간 · 장비 강화', `<span class="rg-gold">${fmtN(S.gold)} G</span> · +0 → +${ENH.max} · 1강마다 기본 능력치 +${Math.round(ENH.per * 100)}% · <b style="color:#FFD23F">+7 까지는 실패하면 한 단계 내려가요</b> · <b style="color:#FF8A8E">+8 부터는 실패하면 장비가 부서져요!</b>`) + npcBox();
          h += `<div class="rg-forge"><ul class="rg-list"><li class="rg-forgeh">🛡 내 장비 고르기</li>${mine.length ? mine.map(x => { const it = ITEMS[x.id], en = it.en || 0, full = en >= ENH.max; return `<li class="rg-row${tab.fgSel === x.id ? ' sel' : ''}">${itemIcon(x.id)}<span class="grow"><span class="nm" style="color:${GRADE[it.grade || 0].color}">${it.name}${x.worn ? ' <small style="color:#9AF0B0">입는 중</small>' : ''}</span><span class="ds">${full ? '최고 강화!' : `+${en}→+${en + 1} · 성공 ${ENH.rate[en]}% · ${fmtN(ENH.cost(en))} G`}</span></span><button type="button" class="rg-mini${tab.fgSel === x.id ? ' on' : ' ghost'}" data-fgsel="${x.id}">고르기</button></li>`; }).join('') : '<li class="rg-row">강화할 장비가 없어요. 사냥터에서 장비를 얻어 오세요!</li>'}</ul>`;
          const id = tab.fgSel, it = ITEMS[id];
          h += '<section class="rg-anvil"><p class="rg-forgeh">🔨 모루 · 강화하기</p>';
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
          h = head('이장 댁', '이 마을이 귀환 장소가 돼요. 가 본 마을·사냥터로 무료 이동 · 🐾 펫 뽑기') + npcBox() + tabs('chief', [['go', '🗺 이동'], ['pet', '🐾 펫 뽑기']]);
          if ((tab.chief || 'go') === 'pet') h += petShopHtml(); else {
          h += `<div class="rg-tabs"><button type="button" class="rg-mini" data-savenow>지금 저장</button><span class="rg-mini ghost" style="cursor:default">처치 ${fmtN(S.kills)} · 플레이 ${Math.floor(S.play / 60)}분</span></div>`;
          D.REGIONS.forEach((R, ri) => {
            const vid = 'v' + (ri + 1), fs = D.MAPS.filter(m => m.kind === 'field' && !m.hell && m.region === ri);
            if (!vis.includes(vid) && !fs.some(m => vis.includes(m.id))) return;
            h += `<div class="rg-region"><b>${ri + 1}. ${R.name} 지역</b><div class="rg-tabs">${vis.includes(vid) ? `<button type="button" class="rg-mini" data-go="${vid}">${R.name}</button>` : ''}${fs.map(m => vis.includes(m.id) ? `<button type="button" class="rg-mini ghost" data-go="${m.id}">${m.no}. ${m.name} (Lv.${m.rec})</button>` : '').join('')}</div></div>`;
          });
          h += '<p class="sub" style="margin-top:8px">※ 퀘스트는 준비 중이에요. 나중에 마지막 마을의 성에서 나눠 줄 예정이에요.</p>';
          }
        } else if (k === 'ysnpc' || k === 'ysmural') {   // v172 이순신 장군님 던전 지킴이(이야기) · v174 빈 벽화 틀(퍼즐)
          h = ysPaneHtml(k === 'ysmural');
        } else if (k === 'sxnpc') {   // v150 사신의 땅 지킴이
          const n = godsDone();
          h = head(SX.npc.name, '광개토대왕 던전 어귀 · 혼자 들어온 곳 (다른 사람은 보이지 않아요)') + `<div class="rg-fuse" style="text-align:left;line-height:1.7">${SX.npc.lines.map(l => `<p style="margin:0 0 6px">${l}</p>`).join('')}</div>`;
          h += `<div class="rg-petrates">${SX.gods.map(g => `<div style="--c:${SX.fire[g]}" class="${S.sasin[g] ? '' : 'lock'}"><b>${SX.godName[g]}</b><span>${S.sasin[g] ? '🔥' : '·'}</span><small>${S.sasin[g] ? '불이 켜졌다' : '아직'}</small></div>`).join('')}<div style="--c:#FFD23F" class="${S.sasinAll ? '' : 'lock'}"><b>사방신 모두</b><span>${S.sasinAll ? '🔥' : n === 4 ? '열림' : '🔒'}</span><small>${S.sasinAll ? '광개토대왕의 방 열림' : `불 ${n}/4`}</small></div></div>`;
          {   // v176 광개토대왕을 먼저 이긴 10명 (서버 기록 · 날짜·시간)
            const esc2 = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]), K = G.kingTop, fmt = v => { const d = new Date(9e12 - v); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
            if (!K && !G.kingTopReq && Hub.extraTopN) { G.kingTopReq = 1; Hub.extraTopN(GAME, 'king', 10).then(r => { G.kingTop = r || []; G.kingTopReq = 0; if (pane === 'sxnpc') renderPanel(); }).catch(() => { G.kingTop = []; G.kingTopReq = 0; if (pane === 'sxnpc') renderPanel(); }); }
            h += `<div class="rg-king10"><b class="tt">👑 광개토대왕을 먼저 이긴 용사 10명</b>${!K ? '<p class="sub">불러오는 중…</p>' : !K.length ? '<p class="sub">아직 아무도 광개토대왕을 이기지 못했어요. 첫 번째 용사가 되어 보세요!</p>' : `<ol>${K.map((r, i) => `<li${Hub.user && r.user_id === Hub.user.id ? ' class="me"' : ''}><span class="no">${i + 1}</span><b>${esc2(r.nickname)}</b><small>${fmt(r.value)}</small></li>`).join('')}</ol>`}</div>`;
          }
        } else if (k === 'pet') {   // v149 펫 창 (P)
          h = petPaneHtml();
        } else if (k === 'castle') {
          const C = (D.REGIONS[G.map.M.region] || {}).castle || {};   // v169 성마다 성지기 · 역사 이야기 (퀘스트는 부산진성 도원수)
          h = C.quest || !C.name ? head('부산진성 · 도원수', '퀘스트는 아직 준비 중이에요. 다음 업데이트에서 이곳에서 퀘스트를 받을 수 있어요.') + npcBox() + (C.info ? `<p class="sub" style="margin-top:8px">📜 ${C.info}</p>` : '')
            : head(`${C.name} · ${C.lord}`, `📜 ${C.info}`) + npcBox() + `<p class="sub" style="margin-top:8px">퀘스트는 마지막 마을 <b style="color:#FFD23F">부산진성</b>의 도원수에게서 받을 수 있어요.</p>`;
        } else if (k === 'tradeAsk') {
          const pp = paneArg.pp;
          h = head('거래 · 결투 신청', '같은 지도에 있는 사람과 아이템·골드를 바꾸거나, 결투를 신청할 수 있어요.');
          h += `<div class="rg-fuse"><b style="color:#9AE6FF">${pp.nick}</b> (Lv.${pp.lv}) 님에게 무엇을 신청할까요?</div><div class="rg-srvact"><button type="button" class="rg-mini" data-trreq="${pp.cid}">🤝 거래 신청</button><button type="button" class="rg-mini ghost" data-x>취소</button></div>`;
          h += `<div class="rg-duelask"><b>⚔ 결투 신청</b><p>둘 다 같은 골드를 걸고 겨뤄요. 이긴 사람이 모두 가져가요. (0 = 친선전) · HP·MP 가득 · 물약 못 씀</p><label>배팅 골드 <input type="number" min="0" max="${S.gold}" step="10" value="${clamp(tab.dbet || 0, 0, S.gold)}" data-dbet> <small>/ ${fmtN(S.gold)} G</small></label><button type="button" class="rg-mini duel" data-dreq="${pp.cid}">⚔ 결투 신청</button></div>`;
        } else if (k === 'duelIn') {   // v143 결투 신청 받음
          const a = paneArg, ok = S.gold >= a.bet;
          h = `<h3>⚔ 결투 신청이 왔어요</h3><div class="rg-fuse"><b style="color:#9AE6FF">${a.nick}</b> (Lv.${a.lv}) 님이 결투를 신청했어요.<br>배팅: <b class="rg-gold">${fmtN(a.bet)} G</b>${a.bet ? ` (이기면 ${fmtN(a.bet * 2)} G · 지면 ${fmtN(a.bet)} G 잃음)` : ' (친선전)'}<br><small>수락하면 결투장으로 이동해서 3초 뒤에 시작해요. HP·MP 가득 · 물약 못 씀 · 끝나면 지금 자리로 돌아와요.</small></div><div class="rg-srvact"><button type="button" class="rg-mini duel" data-dyes="${a.cid}" ${ok ? '' : 'disabled'}>${ok ? '⚔ 수락' : '골드가 모자라요'}</button><button type="button" class="rg-mini ghost" data-dno="${a.cid}">거절</button></div>`;
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
          h += `<div class="rg-srvact" style="align-items:center"><button type="button" class="rg-mini${T.myOk ? ' on' : ''}" data-trok ${room && !T.pend ? '' : 'disabled'}>${T.myOk ? '확인함 (다시 누르면 풀기)' : '확인'}</button><span class="sub" style="margin:0">${!room ? `가방이 모자라요 (${bagMax()}칸) — 약방에서 가방을 늘리거나 물건을 정리해요` : T.myOk && T.theirOk ? '교환하는 중…' : T.myOk ? '상대가 확인하면 바뀌어요' : T.theirOk ? '상대는 확인했어요. 내용을 보고 확인을 눌러요' : '둘 다 확인을 누르면 바뀌어요'}</span></div>`;
        } else if (k === 'rebirth') {   // v131 환생 확인 창
          const n = S.reb || 0, max = D.REBIRTH.max, ok = S.rebReady && n < max, B = D.REBIRTH.bonus;
          h = head('♻ 환생', paneArg && paneArg.first ? '오도전륜대왕을 이기고 명부를 되찾았어요! 이제 환생할 수 있어요.' : `환생 ${n} / ${max}번 · 저승 마지막 관문(10-5)을 깰 때마다 한 번씩 환생할 수 있어요`);
          h += `<div class="rg-rebwin"><div class="rg-rebinfo"><b class="tt">환생하면</b><ul>
            <li>레벨이 <b>Lv.1</b>로 돌아가요 (경험치 0) · 의주에서 다시 시작해요</li>
            <li>스탯을 모두 돌려받고 <b class="g">추가 스탯 포인트 +${B}</b>개를 더 받아요 (환생 ${n + 1}번째 → 시작 포인트 <b class="g">${(n + 1) * B}</b>개)</li>
            <li>입고 있는 장비 · 가방 물건 · 골드 · 저승 기록은 <b class="g">그대로</b> 가져가요</li>
          </ul></div>
          <div class="rg-rebwarn"><b class="tt">⚠ 꼭 읽어 주세요</b><ul>
            <li>입고 있는 장비는 계속 입고 있어요. 하지만 <b>한 번 벗으면</b> 그 장비의 착용 레벨(예: Lv.90)까지 다시 올라야 입을 수 있어요!</li>
            <li>배운 마법은 <b>모두 사라지고</b> 처음 기본 마법(마법 화살)만 남아요. 마법은 레벨을 올리며 도술 서원에서 다시 배워요.</li>
            <li>환생은 최대 <b>${max}번</b>까지, 저승 10-5를 깰 때마다 한 번씩 할 수 있어요 (지금 ${n}번).</li>
          </ul></div></div>`;
          h += `<div class="rg-srvact" style="justify-content:center;gap:10px">${ok ? '<button type="button" class="btn btn-primary" data-rebgo>♻ 환생하기</button>' : `<span class="sub">${n >= max ? '환생을 모두 마쳤어요.' : '저승 10-5 오도전륜대왕을 이기면 환생할 수 있어요.'}</span>`}<button type="button" class="btn" data-x>${ok ? '나중에 할게요' : '닫기'}</button></div>`;
        } else if (k === 'stat') {   // v44 스탯 창: 왼쪽 캐릭터 · 오른쪽 힘·민첩·지혜·체력 올리기 · 아래 자세한 능력치
          const T = D.STAT, a = S.stat, PT = stats(true), used = T.keys.reduce((x, q) => x + a[q], 0), per = CFG.statPerLevel || 2;
          const av = Hub.user ? Hub.user.avatar : AV.normalize({}), fig = avatarSprite(av, S.eq, S.hide, 0).toDataURL(), ex = S.lv >= D.MAX_LV ? 100 : S.exp / D.F.need(S.lv) * 100;
          h = head('스탯', `레벨이 오를 때마다 포인트 ${per}개 · 원하는 스탯에 올려요 · 최대치 없음${petBonus(S) ? ` · 펫 올스탯 +${petBonus(S)}` : ''}`);
          h += `<div class="rg-statui"><div class="rg-statwin"><section class="rg-doll rg-statfig"><div class="rg-fig"><img src="${fig}" alt="내 캐릭터"><span class="lv">Lv.${S.lv}</span></div><b class="nm">${Hub.user ? Hub.user.nickname : '손님'}</b><div class="rg-xp"><i style="width:${ex.toFixed(1)}%"></i></div><small>경험치 ${ex.toFixed(1)}%</small>${rebBox()}${titleBox()}${godAcct() ? `<label class="rg-god"><input type="checkbox" data-god${S.godOff ? '' : ' checked'}> 🛡 무적 (파워복복 전용)</label>` : ''}</section>`;
          h += `<section class="rg-bag rg-alloc"><div class="rg-sp">남은 포인트 <b>${S.sp}</b></div>${T.keys.map(q => { const full = a[q] >= statMax(S), cap = T.defCap, pF = ST.pdef >= cap, eF = Object.values(ST.edefs).every(v => v >= cap), mx = q === 'dex' && ST.spd >= (T.spdMax || 100) ? '최대 도달' : q === 'res' && pF && eF ? '최대 도달' : q === 'res' && pF ? '물리 방어 최대' : q === 'res' && eF ? '속성 방어 최대' : '';   /* v187 선생님 11/23: 효과가 최대에 닿은 스탯 표시 (민첩 = 이동 속도 +100% · 저항 = 방어 75%) */ return `<div class="rg-st" style="--c:${T[q].color}"><div class="lab"><b>${T[q].name}</b><span>${a[q]}${petBonus(S) ? `<small class="mx"> +펫 ${petBonus(S)}</small>` : ''}</span>${mx ? `<em class="rg-stmax" title="더 올려도 효과가 늘지 않아요 (장비·옵션 포함)">${mx}</em>` : ''}</div><small>${T[q].desc}</small><div class="btns"><button type="button" class="rg-mini" data-addst="${q}:1" ${S.sp < 1 || full ? 'disabled' : ''}>+1</button><button type="button" class="rg-mini ghost" data-addst="${q}:5" ${S.sp < 1 || full ? 'disabled' : ''}>+5</button></div></div>`; }).join('')}<div class="rg-srvact"><button type="button" class="rg-mini ghost" data-streset ${used ? '' : 'disabled'}>포인트 다시 나누기 (무료)</button></div></section></div>`;
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
          h += `<div class="rg-detailgrid">${rows.map(([n, v, d2, parts, c2]) => `<div style="--c:${c2}"><span style="color:${c2}">${n}</span><b>${v}</b>${d2 ? `<small>${d2}</small>` : ''}${parts ? `<small class="pt">${parts}</small>` : ''}</div>`).join('')}</div>`;
          h += `<p class="sub" style="margin:10px 0 0">속성 방어 — 몬스터마다 속성이 있어요(이름 앞 동그라미). 원거리 탄·보스 공격은 그 속성 피해 + 상태 효과(화상·느려짐·기절·저주 …), 속성 방어가 높을수록 피해도 효과도 줄어요 (저항 +${fm(PT.sta.edef || 0)}% 포함, 최대 ${D.STAT.defCap}%)</p><div class="rg-defgrid">${Object.keys(ELEM).map(e => `<div style="--c:${ELEM[e].color}"><span style="color:${ELEM[e].color}">${EL_IC[e] || ''} ${ELEM[e].name}</span><b>${fm(ST.edefs[e])}%</b></div>`).join('')}</div></div>`;
        } else if (k === 'chan') {   // v104 채널 이동
          const L = chList, M = MAPBY[S.map];
          h = head('채널 이동', `${M ? M.name : '이 지도'} · 한 채널에 ${net.opt.chCap || 5}명까지. 같은 채널에 있는 사람끼리만 서로 보여요.`);
          if (!net.joined) h += '<div class="rg-fuse">서버에 들어가야 채널을 고를 수 있어요.</div><button type="button" class="btn btn-primary" data-rg2="servers">서버 고르기</button>';
          else if (!L) h += '<p class="sub">채널 인원을 불러오는 중…</p>';
          else if (L.error) h += `<div class="rg-fuse">${L.error === 'sql' ? '채널 이동 준비가 아직 안 됐어요. (관리자: supabase/rpg_chan_v104.sql 실행 필요)' : '채널 인원을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'}</div>`;
          else {
            const cap = L.cap || 5;
            h += `<div class="rg-chs">${L.rows.map(r => { const n = r.players, cur = r.ch === net.chNo, full = n >= cap && !cur, pct = Math.round(n / cap * 100), col = n >= cap ? '#FF5A5F' : n >= cap - 1 ? '#FF9A3D' : n ? '#FFD23F' : '#3DDC84';
              return `<button type="button" class="rg-srv${cur ? ' cur' : ''}" data-ch="${r.ch}" ${full || cur ? 'disabled' : ''}><b>${r.ch}채널</b>${cur ? '<em class="me">지금</em>' : n === 0 ? '<em>빈 채널</em>' : ''}<span class="bar"><i style="width:${pct}%;background:${col}"></i></span><small>${n} / ${cap}명${full ? ' · 가득' : ''}</small></button>`; }).join('')}</div>`;
            h += `<p class="sub">지금 ${L.rows.filter(r => r.players > 0).length}개 채널에 사람이 있어요. 자리가 있는 채널을 누르면 바로 옮겨요. ${L.demo ? '(체험 모드)' : ''}</p>`;
          }
        } else if (k === 'guest') {   // v203 로그인 경고
          h = `<h3 style="color:#FFD23F">⚠ 로그인하지 않았어요!</h3><div class="rg-guestwarn"><p><b>로그인하지 않고 하면 캐릭터가 계정에 저장되지 않아요.</b></p><ul><li>레벨·아이템·환생이 <b>이 컴퓨터에만</b> 잠깐 남고, 다른 컴퓨터나 다음 시간에는 이어지지 않아요.</li><li>랭킹·Skillcom Fight 카드에도 올라가지 않아요.</li><li>로그인하면 <b>내 계정 캐릭터</b>가 그대로 불러와져요.</li></ul></div><div class="rg-srvact"><button type="button" class="rg-mini" data-login>🔑 로그인하기</button><button type="button" class="rg-mini ghost" data-x>잠깐 손님으로 해 보기</button></div>`;
        } else if (k === 'servers') {   // v42 서버 고르기
          const cap = net.opt.cap, L = srvList;
          h = head('서버 고르기', '같은 서버의 같은 지도에 있는 사람이 보여요. 아이템·마법·레벨은 <b>계정에 저장</b>돼서 어느 서버에서나 그대로 이어져요.');
          if (!Hub.user) h += `<div class="rg-fuse">로그인하면 다른 사람과 함께 모험할 수 있어요.</div><button type="button" class="btn btn-primary" data-x>확인</button>`;   // v203 선생님 11/24: '혼자 하기' 없앰
          else if (!L) h += '<p class="sub">서버 인원을 불러오는 중…</p>';
          else if (L.error) h += `<div class="rg-fuse">${L.error === 'sql' ? '온라인 서버 준비가 아직 안 됐어요. (관리자: supabase/rpg_online_v42.sql 실행 필요)' : '서버 인원을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'}</div><button type="button" class="btn btn-primary" data-x>닫기</button>`;
          else {
            const rows = L.rows, low = rows.reduce((a, r) => (r.players != null && r.players < cap && (a == null || r.players < a.players) ? r : a), null);
            h += `<div class="rg-srvs"${rows.length === 1 ? ' style="grid-template-columns:minmax(0,280px)"' : ''}>${rows.map(r => { const n = r.players, full = n != null && n >= cap, pct = n == null ? 0 : Math.round(n / cap * 100), cur = net.joined && net.server === r.server;
              const busy = n != null && !full && n >= cap * 5 / 6;   // v203 선생님 11/24: 인원 숫자는 안 보임 · 50명(60의 5/6)부터 주황 · 60명(가득) 빨강
              return `<button type="button" class="rg-srv${cur ? ' cur' : ''}${full ? ' full' : busy ? ' busy' : ''}" data-srv="${r.server}" ${full && !cur ? 'disabled' : ''}><b>${net.name(r.server)}</b>${low && low.server === r.server && !cur && !busy ? '<em>추천</em>' : ''}${cur ? '<em class="me">지금</em>' : ''}${full ? '<small>가득 찼어요</small>' : busy ? '<small>사람이 많아요</small>' : ''}</button>`; }).join('')}</div>`;
            h += `<div class="rg-srvact"><button type="button" class="rg-mini" data-srv="auto">${rows.length === 1 ? net.name(rows[0].server) + ' 들어가기' : '가장 한산한 서버로 들어가기'}</button></div>`;
            h += `<p class="sub">${rows.length === 1 ? `서버 하나에 모두 모여요 · 같은 지도에서는 ${net.opt.chCap || 5}명씩 채널로 나뉘어 서로 보여요.` : `한 서버에 ${cap}명까지 · 서버 ${rows.length}개.`} 몬스터와 떨어진 물건은 각자 따로예요. ${L.demo ? '(체험 모드: 같은 브라우저의 다른 탭끼리만 연결돼요)' : ''}</p>`;
          }
        } else if (k === 'dead') {
          h = `<h3>쓰러졌어요…</h3><p class="sub">경험치를 ${fmtN(paneArg.loss)} 잃었어요. (레벨은 그대로)<br>마지막으로 들른 마을(${MAPBY[S.home].name})의 이장 댁 앞에서 다시 시작해요.</p><button type="button" class="btn btn-primary" data-revive>마을에서 다시 시작</button>`;
          // v145 증발한 장비 (부활 버튼 바로 아래 · 그림과 함께)
          const gone = paneArg.gone || [];
          if (!paneArg.risk) h += `<p class="rg-vanish-note">💚 사냥터 1~100 에서는 쓰러져도 장비가 사라지지 않아요.</p>`;
          else if (!gone.length) h += `<div class="rg-vanish"><b class="t">🔥 장비 증발 위험 지역 (권장 Lv.101 이상)</b><p class="ok">다행히 사라진 장비가 없어요! (장비마다 ${Math.round((CFG.deathVanish != null ? CFG.deathVanish : 0.02) * 100)}% 확률)</p></div>`;
          else h += `<div class="rg-vanish"><b class="t">🔥 쓰러지며 장비 ${gone.length}개가 증발했어요</b><ul class="rg-list">${gone.map(g => { const it = ITEMS[g.id] || { name: '장비' }, gd = it.grade != null ? GRADE[it.grade] : null; return `<li class="rg-row">${itemIcon(g.id)}<span class="grow"><span class="nm"${gd ? ` style="color:${gd.color}"` : ''}>${it.name}${gd ? `<span class="rg-grade">${gd.name}</span>` : ''}</span><small class="wh">${g.where}</small></span></li>`; }).join('')}</ul><p class="sub2">권장 Lv.101 이상 사냥터에서는 쓰러질 때마다 착용 장비 · 가방 속 장비가 하나하나 ${Math.round((CFG.deathVanish != null ? CFG.deathVanish : 0.02) * 100)}% 확률로 사라져요.</p></div>`;
        } else if (k === 'help') {
          h = head('도움말', '내 아바타로 떠나는 도트 RPG — 혼자 플레이 첫 버전') + (imgOk('key') ? `<img src="${imgOk('key').src}" alt="" style="width:100%;border-radius:10px;border:2px solid #0A0E24;margin:4px 0 10px;display:block">` : '');
          h += `<ul class="ult-rules">
            <li><b>이동</b> 방향키 · <b>공격</b> Space·J · <b>기본 마법</b> 1~4 · <b>융합 마법</b> Q W E R · <b>포션</b> Z(체력) X(마나) · <b>귀환</b> V(가까운 마을, 2분마다) · <b>가방</b> I · <b>마법 창</b> K · <b>창 닫기</b> Esc</li>
            <li>휴대폰은 화면 왼쪽을 끌면 이동(조이스틱), 오른쪽 버튼으로 공격·마법·포션·귀환(🏠). 가로로 돌리면 더 커요.</li>
            <li>지도 <b>오른쪽 끝 → 다음 지도</b>, 왼쪽 끝 → 이전 지도. 마을 → 사냥터 10곳 → 다음 마을 … 마을 하나가 10레벨씩(의주 Lv.1~10 … 동래 Lv.71~80), 마지막 부산은 Lv.80~100.</li>
            <li>문으로 걸어 들어가면 <b>건물 안</b>이에요. 안에 있는 사람에게 가까이 가면 이야기해요: <b>약방</b> 아씨 · <b>도술 서원</b> 도사(마법 배우기·융합) · <b>이장 댁</b> 이장님(무료 이동·저장). 아래 가운데 문으로 나가요.</li>
            <li>처음부터 <b>마법 화살</b>(1번 키)을 쓸 수 있어요.</li>
            <li><b>스탯</b>: 레벨이 오를 때마다 포인트 2개 — 왼쪽 위 얼굴(또는 C)을 눌러 힘(피해 +2%)·민첩(이동 속도 +0.7%)·지혜(마나 회복 +4%)·체력(최대 체력 +2%)·<b>저항</b>(물리 방어 +0.5% · 속성 방어 +0.5%)에 올려요. 스탯 최대치는 없어요 (이동 속도는 최대 +100%까지).</li>
            <li><b>펫</b>: 이장 댁에서 이장이 팔아요 (한 번 뽑기 1만 G). 가진 펫 모두의 올스탯이 더해지고, 한 마리를 데리고 다녀요. 같은 펫이 또 나오면 펫 창(P)에서 강화 (+10까지).</li>
            <li><b>환생</b>: 저승 10-5 오도전륜대왕을 이길 때마다 한 번 (최대 10번) — Lv.1 로 돌아가고 스탯 포인트 +20 · 장비·가방·골드는 그대로 · 마법은 기본 마법만 남아요.</li>
            <li><b>죽음의 위험</b>: 사냥터 1~100 에서는 쓰러져도 경험치만 조금 잃어요. 권장 <b>Lv.101 이상</b> 사냥터(저승 관문 등)에서 쓰러지면 착용 장비 · 가방 속 장비가 하나하나 <b>2%</b> 확률로 증발해요 (쓰러진 창에 사라진 장비가 나와요).</li>
            <li><b>포인트 교환</b>: 약방의 💱 포인트 교환 탭에서 골드 <b>100 G = 사이트 포인트 1 P</b> (양쪽 모두 · 하루 방향마다 100P 까지).</li>
            <li><b>거래</b>: 온라인 서버에서 같은 지도에 있는 사람을 누르거나 가까이 가서 F → 거래 신청. 둘 다 확인을 누르면 아이템·골드가 바뀌어요.</li>
            <li>직업은 없어요. 레벨이 오르면 도술 서원에서 새 마법을 배우고, 두 원소를 섞어 <b>융합 마법</b>을 만들어요.</li>
            <li><b>속성 상성</b>: 몬스터마다 속성이 있어요(이름 앞 동그라미). <b>약점 속성</b> 마법은 피해 ×1.3 (‘약점!’), 같은 속성은 ×0.7. 약점: 불←물, 물←번개, 번개←땅, 땅←바람, 바람←불, 빛←번개, 어둠←빛. 원소 효과: 불 화상 · 물 느려짐 · 바람 밀어내기 · 땅 큰 피해 · 번개 기절 · 빛 체력 흡수 · <b>어둠 저주(받는 피해 +20%)</b>. 몬스터의 속성 공격도 나에게 같은 종류의 효과를 줘요(속성 방어로 줄어요).</li>
            <li>장비는 몬스터가 떨어뜨려요(보스는 꼭). 장비마다 <b>옵션</b>이 무작위로 붙어요 (예: 공격력 +12% · 물리 방어 −6%). 같은 장비라도 옵션에 따라 성능이 크게 달라져요. 옵션 수에 따라 일반·고급·희귀·영웅, Lv.100 <b>전설</b> 장비도 있어요. 장비마다 입을 수 있는 레벨이 달라요.</li>
            <li><b>역참</b>(마을마다, 오른쪽 아래)의 역참지기에게 가까이 가면 <b>다른 마을로 한 번에</b> 이동해요. 가는 마을의 시작 레벨 이상이어야 하고, 이용료 = 거리 × 마을 번호 × ${D.STATION.feeUnit} G (예: 의주 → 평양 40 G).</li>
            <li><b>대장간</b>(마을마다)의 대장장이에게 가까이 가면 <b>강화</b>: +0 → +10, 1강마다 기본 능력치 +10%. 골드는 100 G 에서 두 배씩(+10 은 51,200 G), 성공 확률은 95% → 30% 로 낮아지고 <b>실패하면 장비가 부서져요!</b></li>
            <li>입으면 아바타 위에 보이고, 가방의 <b>장비 안보이기</b>로 그림만 숨길 수 있어요.</li>
            <li>쓰러지면 경험치가 조금 줄고 마지막 마을에서 다시 시작해요. <b>귀환 주문서</b>로 언제든 마을로 돌아갈 수 있어요.</li>
          </ul><button type="button" class="btn btn-primary" data-x>모험 시작!</button>`;
        }
        panel.classList.toggle('rg-deco', !!k);   // v146 금테 꾸미기 · v164 가방·스탯 창도 같은 금테 (모든 창 통일)
        panel.classList.toggle('rg-fit', k === 'skill' || k === 'castle' || k === 'wmap');   // v169 마법 창: 배운 마법이 적으면 창 높이를 내용에 맞춤 (아래 빈 공간 없앰)
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
      let chList = null;
      async function loadChans() { if (!net) return; const L = await net.channels(); chList = L; if (pane === 'chan') renderPanel(); }
      async function moveChan(no) {
        const r = await net.moveCh(no);
        if (r.ok) { say(`${no}채널로 옮겼어요`, 2.2); closePanel(); }
        else { say(r.reason === 'full' ? `${no}채널은 가득 찼어요 (${net.opt.chCap || 5}명)` : r.reason === 'sql' ? '채널 이동 준비가 아직 안 됐어요' : '채널을 옮기지 못했어요. 잠시 뒤 다시 해 주세요', 3); loadChans(); }
      }
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
        say(`${net.name(n)}에 들어가는 중…`, 2); save(true);
        const r = await net.join(n, roomKey(), S.lv);
        if (r.ok) { say(`${net.name(n)}에 들어왔어요!${r.players ? ` (지금 ${r.players}명)` : ''}`, 2.6); closePanel(); }
        else { say(r.reason === 'full' ? `${net.name(n)}은 가득 찼어요 (${cap}명). 잠시 뒤 다시 해 주세요` : r.reason === 'sql' ? '온라인 서버 준비가 아직 안 됐어요' : r.reason === 'banned' ? '이 계정은 지금 온라인에 들어갈 수 없어요' : '서버에 들어가지 못했어요. 잠시 뒤 다시 해 주세요', 3.5); loadServers(); }
      }
      panel.addEventListener('input', e => { const t = e.target; if (t && t.dataset && t.dataset.xin) xchgCalc(t.dataset.xin); });   // v145 교환 숫자
      panel.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-trgold]')) { const T = G.trade; if (!T || tradeLocked()) { if (T) t.value = T.mine.gold; return; } T.mine.gold = clamp(Math.floor(+t.value || 0), 0, S.gold); sendOffer(); renderPanel(); return; }
        if (t.matches('[data-god]')) { S.godOff = !t.checked; markDirty(true); say(t.checked ? '무적을 켰어요 (피해를 받지 않아요)' : '무적을 껐어요 (밸런스 시험용)', 2.5); return; }   // v176
        if (t.matches('[data-title]')) { S.title = t.value; markDirty(true); if (net) net.retrack(); renderPanel(); return; }   // v176
        if (t.matches('[data-hide]')) { S.hide = t.checked; markDirty(); if (net) net.retrack(); renderPanel(); }
        else if (t.matches('[data-fa]')) { tab.fa = t.value; if (tab.fb === t.value || (SKILLS[tab.fb] && SKILLS[tab.fb].el === SKILLS[t.value].el)) tab.fb = null; renderPanel(); }
        else if (t.matches('[data-fb]')) { tab.fb = t.value; renderPanel(); }
      });
      panel.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        const d = b.dataset;
        if ('x' in d) { closePanel(); return; }
        if (d.tab) { const [k, v] = d.tab.split(':'); tab[k] = v; if (k === 'potion' && v === 'xchg') xchgLoad(); renderPanel(); return; }
        if ('yss' in d) { ysSlide(+d.yss); renderPanel(); return; }   // v172 벽화 퍼즐
        if ('yspz' in d) { tab.ysPz = d.yspz === '1' && pane === 'ysmural' && ysHave() >= 9 && !S.ysMural ? { b: ysShuffle(), moves: 0 } : null; renderPanel(); return; }
        if ('petdraw' in d) { petDraw(); renderPanel(); return; }   // v149 펫
        if ('peton' in d) { S.petOn = d.peton; markDirty(true); petNet(); renderPanel(); return; }
        if ('petsel' in d) { tab.petSel = d.petsel; tab.petEnhRes = null; renderPanel(); return; }
        if ('petenh' in d) { petEnh(d.petenh); renderPanel(); return; }
        if ('petok' in d) { tab.petEnhRes = null; renderPanel(); return; }
        if (d.xdir) { const inp = panel.querySelector('#rg-xn-' + d.xdir); xchgDo(d.xdir, inp ? inp.value : 0); return; }   // v145 골드 ↔ 포인트 (왼쪽 g2p · 오른쪽 p2g)
        if (d.xset) { const [xd2, q] = d.xset.split(':'), inp = panel.querySelector('#rg-xn-' + xd2); if (inp) { inp.value = q; xchgCalc(xd2); } return; }
        if ('trash' in d) { tab.trash = !tab.trash; tab.trashAsk = null; tab.trashSel = []; tab.trashMulti = false; renderPanel(); return; }
        // v204 선생님 11/24: 여러 개 골라 한 번에 버리기
        if ('tsall' in d) { const f = tab.invF || 'all'; tab.trashSel = S.inv.filter(x => f === 'all' || (f === 'gear' ? !!ITEMS[x.id].slot : !ITEMS[x.id].slot)).map(x => x.id); renderPanel(); return; }
        if ('tsnone' in d) { tab.trashSel = []; renderPanel(); return; }
        if ('tsgo' in d) { if ((tab.trashSel || []).some(q => count(q))) tab.trashMulti = true; renderPanel(); return; }
        if ('tsno' in d) { tab.trashMulti = false; renderPanel(); return; }
        if ('tsdo' in d) {
          if (G.trade) say('거래 중에는 버릴 수 없어요', 2);
          else { let k2 = 0; (tab.trashSel || []).forEach(q => { const n = count(q); if (n && takeItem(q, n)) k2++; if (!count(q) && tab.invSel === q) tab.invSel = null; }); if (k2) { markDirty(true); say(`${k2}칸을 버렸어요`, 2); } }
          tab.trashSel = []; tab.trashMulti = false; tab.trash = false; renderPanel(); return;
        }
        if ('trashno' in d) { tab.trashAsk = null; tab.trash = false; renderPanel(); return; }
        if (d.trashdo) {   // v68 쓰레기통: 경고에서 '버리기'를 눌렀을 때만 지움
          const cut = d.trashdo.lastIndexOf(':'), id = d.trashdo.slice(0, cut), n = +d.trashdo.slice(cut + 1);
          if (G.trade) { say('거래 중에는 버릴 수 없어요', 2); }
          else if (takeItem(id, n)) { const nm = ITEMS[id].name; markDirty(true); say(`${nm}${n > 1 ? ' ' + n + '개' : ''}를 버렸어요`, 2); if (!count(id) && tab.invSel === id) tab.invSel = null; }
          tab.trashAsk = null; tab.trash = false; renderPanel(); return;
        }
        if (d.pick && tab.trash && pane === 'inv') {
          if (d.pick.startsWith('eq:')) say('입고 있는 장비는 벗은 뒤에 버릴 수 있어요', 2.2); else if (count(d.pick)) { const ts = tab.trashSel || (tab.trashSel = []), i = ts.indexOf(d.pick); if (i >= 0) ts.splice(i, 1); else ts.push(d.pick); }   // v204 누르면 고르기/빼기
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
        } else if (d.stsx) { stationSx(); return;   // v157 광개토대왕 던전 어귀로
        } else if (d.stgo) { stationGo(d.stgo); return;   // v85 역참 출발
        } else if (d.toongate) { const g = D.HELL.gates[+d.toongate - 1]; if (!g) return; pane = null; panel.hidden = true; showToon(gateCuts(g), { title: `저승 제${g.no}관문 · ${g.hell}`, go: '닫기' }); return;   // v130 관문 웹툰 다시 보기
        } else if (d.hellgo) { const id = d.hellgo, M = MAPBY[id]; if (!M || S.lv < D.MAX_LV || (M.gate - 1) * 5 + M.stage > (S.hell || 0) + 1) return; pane = null; panel.hidden = true; G.paused = false; enter(id, 'L'); return; }   // v69 저승 단계 들어가기
        else if (d.go) { const id = d.go; pane = null; panel.hidden = true; G.paused = false; enter(id, MAPBY[id].kind === 'village' ? 'door' : 'L'); return; }
        else if (d.addst) { const [q, n0] = d.addst.split(':'), n = Math.min(+n0, S.sp, statMax(S) - (S.stat[q] || 0)); if (n > 0 && S.stat[q] != null) { S.stat[q] += n; S.sp -= n; const hr = S.hp / ST.hp; restat(); if (q === 'vit') S.hp = Math.round(ST.hp * hr); markDirty(true); } }
        else if ('streset' in d) { D.STAT.keys.forEach(q => { S.sp += S.stat[q]; S.stat[q] = 0; }); restat(); markDirty(true); say('스탯 포인트를 모두 돌려받았어요. 다시 나눠 주세요', 2.4); }
        else if (d.trreq) { const pp = net.peers.get(d.trreq); if (!pp) { say('상대가 이 지도에 없어요', 2); closePanel(); return; } G.trade = { with: pp.cid, nick: pp.nick, state: 'wait' }; net.trade({ k: 'req', to: pp.cid }); pane = null; panel.hidden = true; G.paused = false; say(`${pp.nick}님에게 거래 신청을 보냈어요…`, 3); setTimeout(() => { if (G.trade && G.trade.state === 'wait' && G.trade.with === pp.cid) { G.trade = null; say('대답이 없어서 거래 신청을 취소했어요', 2.6); } }, 20000); return; }
        else if (d.tryes) { const pp = net.peers.get(d.tryes); if (!pp) { closePanel(); return; } net.trade({ k: 'yes', to: pp.cid }); startTrade(pp.cid, pp.nick); return; }
        else if (d.trno) { net.trade({ k: 'no', to: d.trno }); pane = null; panel.hidden = true; G.paused = false; return; }
        else if (d.dreq) {   // v143 결투 신청 보내기
          const pp = net.peers.get(d.dreq); if (!pp) { say('상대가 이 지도에 없어요', 2); closePanel(); return; }
          const inp = panel.querySelector('[data-dbet]'), bet = clamp(Math.floor(+(inp && inp.value) || 0), 0, 1e9); tab.dbet = bet;
          if (bet > S.gold) { say('골드가 모자라요', 2); return; }
          pane = null; panel.hidden = true; G.paused = false; askDuel(pp, bet); return;
        }
        else if (d.dyes) {   // v143 결투 수락: 배팅금을 먼저 맡기고 상대의 출발 신호(dgo)를 기다림
          const a = paneArg, pp = net.peers.get(d.dyes); if (!pp || !a || S.gold < a.bet || duelBusy()) { closePanel(); return; }
          S.gold -= a.bet; G.dpend = { with: pp.cid, nick: pp.nick, bet: a.bet, t: 0 };
          net.trade({ k: 'dyes', to: pp.cid }); pane = null; panel.hidden = true; G.paused = false; say('결투를 수락했어요! 곧 결투장으로 이동해요…', 2.6); return;
        }
        else if (d.dno) { net.trade({ k: 'dno', to: d.dno }); pane = null; panel.hidden = true; G.paused = false; return; }
        else if ('trcancel' in d) { if (tradeLocked()) return; endTrade(true); say('거래를 취소했어요', 2); return; }
        else if (d.tradd) { const T = G.trade; if (!T || tradeLocked()) return; const id = d.tradd; if (ITEMS[id] && ITEMS[id].noTrade) { say('이 물건은 거래할 수 없어요 (팔기만 돼요)', 2.6); return; } if (count(id) - (T.mine.items[id] || 0) > 0 && Object.keys(T.mine.items).filter(q => T.mine.items[q] > 0).length < 12) { T.mine.items[id] = (T.mine.items[id] || 0) + 1; sendOffer(); } }
        else if (d.trdel) { const T = G.trade; if (!T || tradeLocked()) return; T.mine.items[d.trdel] = Math.max(0, (T.mine.items[d.trdel] || 0) - 1); sendOffer(); }
        else if ('trok' in d) { const T = G.trade; if (!T || tradeLocked()) return; T.myOk = !T.myOk; if (T.myOk) { net.trade({ k: 'ok', to: T.with, key: tradeKey() }); if (T.theirOk && Hub.clientId < T.with) { tradeCommit(); return; } } else net.trade({ k: 'unok', to: T.with }); }
        else if (d.fgsel) { tab.fgSel = d.fgsel; tab.fgAsk = null; tab.fgRes = null; }
        else if (d.fgask) { tab.fgAsk = d.fgask; tab.fgRes = null; }
        else if ('fgno' in d) { tab.fgAsk = null; }
        else if ('fgok' in d) { tab.fgRes = null; }
        else if (d.fgdo) { tab.fgAsk = null; enhance(d.fgdo); }
        else if (d.srv) { joinServer(d.srv); return; }
        else if (d.ch) { moveChan(+d.ch); return; }
        else if ('rebgo' in d) { if (!confirm(`정말 환생할까요? Lv.1로 돌아가고 배운 마법이 모두 사라져요. (환생 ${(S.reb || 0) + 1}/${D.REBIRTH.max})`)) return; doRebirth(); return; }   // v131
        else if (d.rg2) { openPanel(d.rg2); return; }
        else if ('login' in d) { closePanel(); if (window.GoOpenAuth) window.GoOpenAuth('login'); return; }   // v203 로그인 경고 → 로그인 창
        else if ('solo' in d) { if (net.joined) { net.leave(); say('혼자 하기로 바꿨어요', 2); } closePanel(); return; }
        else if ('savenow' in d) { save(true).then(ok => say(ok || !Store.online() ? '저장했어요' : '이 기기에 저장했어요 (서버 저장은 준비 중)')); return; }
        else if ('revive' in d) { G.dead = false; pane = null; panel.hidden = true; G.paused = false; restat(); S.hp = ST.hp; S.mp = ST.mp; if (G.map && G.map.M.sx) enter(SX.home, { from: SX.entry }); else if (G.map && G.map.M.ys) enter(YS.home, { from: YS.entry }); else enter(S.home, 'door'); return; }   // v150 사신의 땅에서 쓰러지면 18번 사냥터
        renderPanel();
      });
      syncBgm();
      $('#rgChBtn').addEventListener('click', e => { e.currentTarget.blur(); if (!S || G.dead) return; if (pane === 'chan') closePanel(); else openPanel('chan'); });   // v104
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
      const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyJ', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyZ', 'KeyX', 'KeyV', 'KeyI', 'KeyK', 'KeyC', 'KeyP', 'KeyF', 'KeyM', 'Enter', 'Escape']);
      function onKey(e) {
        if (!S || !G.map) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (document.querySelector('#authModal:not([hidden])')) return;
        const r = canvas.getBoundingClientRect(); if (r.bottom < 60 || r.top > innerHeight - 60) return;   // 게임판이 화면에 없으면 무시
        if (!GAME_KEYS.has(e.code)) return;
        const down = e.type === 'keydown';
        if (toon) { e.preventDefault(); if (down && !e.repeat) { if (e.code === 'Escape') toonClose(); else if (e.code === 'Space' || e.code === 'Enter') { if (toon.i < toon.cuts.length) toonNext(); else toonClose(); } } return; }   // v130 웹툰 보는 중
        if (down && e.code === 'Escape') { e.preventDefault(); if (pane) closePanel(); else if (fsNow() || (cabEl() && cabEl().classList.contains('rg-max'))) toggleFull(); return; }   // v157 창이 열려 있으면 창만 닫고, 없을 때만 작게 보기 (전체 화면에서 Esc 는 kbLock 으로 게임이 받음)
        if (down && e.code === 'KeyM') { e.preventDefault(); if (G.dead || G.room) return; if (pane === 'wmap') closePanel(); else if (!pane || ['inv', 'skill', 'stat', 'pet', 'help'].includes(pane)) openPanel('wmap'); return; }   // v172 큰 지도
        if (down && (e.code === 'KeyI' || e.code === 'KeyK' || e.code === 'KeyC' || e.code === 'KeyP')) { e.preventDefault(); const k = e.code === 'KeyI' ? 'inv' : e.code === 'KeyK' ? 'skill' : e.code === 'KeyP' ? 'pet' : 'stat'; if (G.dead) return; if (pane === k) closePanel(); else if (!pane || pane === 'inv' || pane === 'skill' || pane === 'stat' || pane === 'pet' || pane === 'help') openPanel(k); return; }
        if (pane) { if (tag !== 'button') e.preventDefault(); return; }
        if (tag === 'button' && (e.code === 'Space' || e.code === 'Enter')) return;
        e.preventDefault();
        G.keys[e.code] = down;
        if (!down || e.repeat) return;
        if (e.code.startsWith('Digit')) cast(+e.code.slice(5) - 1);
        else if (e.code === 'KeyQ' || e.code === 'KeyW' || e.code === 'KeyE' || e.code === 'KeyR') cast(4 + 'QWER'.indexOf(e.code[3]));
        else if (e.code === 'KeyZ') usePotion('hp');
        else if (e.code === 'KeyX') usePotion('mp');
        else if (e.code === 'KeyV') doRecall();   // v125 귀환
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
        { const q0 = toC(e); if (!G.dead && menuClick(q0)) { e.preventDefault(); return; } }   // v173 메뉴 탭
        { const q = toC(e), mb = G.miniBox; if (mb && !G.room && !G.dead && q.x >= mb.x && q.x <= mb.x + mb.w && q.y >= mb.y && q.y <= mb.y + mb.h + 18) { e.preventDefault(); openPanel('wmap'); return; } }   // v172 작은 지도 누르기 → 큰 지도
        { const q = toC(e); if (q.x < 92 && q.y < 96 && !G.dead) { e.preventDefault(); openPanel('stat'); return; }   // v43 왼쪽 위 얼굴 → 스탯 창
          if (!(G.touch && btnAt(q))) { const pp = peerAt(q); if (pp) { e.preventDefault(); askTrade(pp); return; } } }   // v44 다른 사람 누르기 → 거래
        { const q = toC(e), rb = G.recallBox; if (!G.touch && rb && !G.room && q.x >= rb.x && q.x <= rb.x + rb.s && q.y >= rb.y && q.y <= rb.y + rb.s) { e.preventDefault(); doRecall(); return; } }   // v125 귀환 칸 누르기
        if (!G.touch) { screenEl.focus({ preventScroll: true }); return; }
        e.preventDefault(); canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        const p = toC(e), b = btnAt(p);
        if (b) { pts[e.pointerId] = { btn: b }; G.btnDown[b] = true; if (b[0] === 's') cast(+b[1]); else if (b[0] === 'f') cast(4 + +b[1]); else if (b === 'hp' || b === 'mp') usePotion(b); else if (b === 'rc') doRecall(); return; }
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
          if (pr && pr.then) pr.then(() => { kbLock(true); try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* noop */ } setTimeout(onResize, 200); }, fallback);
        } catch (e) { fallback(); }
        try { screenEl.focus({ preventScroll: true }); } catch (e) { /* noop */ }
      }
      // v157 전체 화면에서 Esc 를 브라우저가 가로채서 바로 작게 되던 것 → Keyboard Lock(크롬·엣지·웨일)으로 Esc 를 게임이 받음. 그래도 Esc 를 길게 누르면 브라우저가 전체 화면을 끔
      function kbLock(on) { try { const k = navigator.keyboard; if (!k) return; if (on) { if (k.lock) k.lock(['Escape']).catch(() => {}); } else if (k.unlock) k.unlock(); } catch (e) { /* noop */ } }
      const onFs = () => { if (!fsNow()) kbLock(false); setTimeout(onResize, 150); const b = el.querySelector('[data-rg="full"]'); if (b) b.textContent = fsNow() ? '작게 보기' : '크게 보기'; };
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

      /* ================= v134 메이커 공식 맵 불러오기 ================= */
      async function loadCustom() {
        if (!Hub.mapAll || !registerCustom) return;
        try { const rows = await Promise.race([Hub.mapAll(), new Promise(r => setTimeout(() => r(null), 5000))]); if (rows) registerCustom(rows, Hub.isAdmin && Hub.isAdmin()); }
        catch (e) { console.warn('[rpg] 메이커 지도 불러오기 실패', e.message); }
      }

      /* ================= 시작 ================= */
      (async () => {
        loadingText = '그림 불러오는 중…';
        G.loadUid = (Hub.user && Hub.user.id) || null;   // v203 어느 계정으로 불러왔는지 (중간에 바뀌면 저장 안 함 · 다시 불러옴)
        const [s] = await Promise.all([loadCustom().then(() => Store.load()), loadImages(6000)]); if (!alive) return; loadingText = '';   // v134 메이커 공식 맵을 먼저 등록 (저장된 자리가 특별 지역일 수 있음)
        S = s; restat(); if (!S.hp) S.hp = ST.hp; if (!S.mp) S.mp = ST.mp;
        G.touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
        enter(S.map, S.x ? 'pos' : 'L');
        if (MAPBY[S.map].kind === 'field' && S.x) { /* 그 자리에서 이어서 */ }
        G.paused = false; G.playMark = S.play;
        makeNet();
        fitScreen();
        if (S.statReset) { delete S.statReset; markDirty(true); setTimeout(() => say(`스탯이 힘·민첩·지혜·체력 4가지로 바뀌었어요! 포인트 ${S.sp}개를 다시 나눠 주세요 (왼쪽 위 얼굴)`, 5), 900); }
        else if (G.touch && innerHeight < 520 && !fsNow()) setTimeout(() => say('오른쪽 위 [ ] 버튼을 누르면 화면이 크게 보여요', 3.5), 1200);
        if (!Hub.user) openPanel('guest');   // v203 선생님 11/24: 손님이면 꼭 경고 (로그인하고 플레이) — 도움말보다 먼저
        else if (!S.help) openPanel('help');
        else { G.srvAsked = true; openPanel('servers'); }
        loadRank();
        if (Hub.extraTop) Hub.extraTop(GAME, 'ys').then(t => { G.ysFirst = t ? t.user_id : ''; if (net) net.retrack(); }).catch(() => {});   // v182 '처음으로 이순신과 함께한 자'
        if (Hub.extraTop) Hub.extraTop(GAME, 'king').then(t => { G.kingFirst = t ? t.user_id : ''; if (net) net.retrack(); if (pane === 'stat') renderPanel(); }).catch(() => {});   // v176 '최초로 광개토대왕을 죽인 자' 타이틀 (서버 기록 1위)
        if (Hub.user) Hub.myBest(GAME).then(b => { if ((b || 0) < rankScore()) submitRank(); }).catch(() => {});
        window.__rpg = { bsk: (m, k) => newSkill(m, k, Math.atan2(G.py - 24 - (m.y - m.spr.h / 2), G.px - m.x)), sxBlock: t => sxBlock(t), godsDone: () => godsDone(), roomKey: () => roomKey(), kingSwordOn: () => kingSwordOn(), petDraw, petEnh, petRates, petRoll, petBonus: () => petBonus(S), stats: () => stats(), hitMon: (m, b, e, o) => hitMon(m, b, e, o), hitPlayer: (a, b, c2, d) => hitPlayer(a, b, c2, d), pStatus: (a, b, c2) => pStatus(a, b, c2), stationGo, rig, rigKind, rollOpts, optCount, step: dt => update(dt), drawNow: () => draw(performance.now()), usePotion, basicAttack, net: () => net, S: () => S, G: () => G, ST: () => ST, enter, enterRoom, leaveRoom, cast, gainExp, save, openPanel, closePanel, skill, addItem, renderPanel: () => renderPanel(), killMon, hitPlayer, enhance, cleanOffer, restat, pane: () => pane, sellPrice, mkGear: (b, en, op) => { const u = newUid(); S.gear[u] = { b, en: en || 0, op: op || [] }; const id = regGear(u, S.gear[u]); addItem(id, 1); return id; } };   // 점검(테스트)용
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
        const h3 = box.querySelector('h3'); if (h3 && h3.firstChild) h3.firstChild.textContent = net.name(srv) + ' 채팅 ';
        offChat = SOC.mountChat('rpg-s' + srv, sui);
      }
      chatSync(); const chatT = setInterval(chatSync, 1200);
      $('#rgChatBox').addEventListener('click', e => { if (e.target.closest('[data-rg="servers"]') && S) openPanel('servers'); });

      // v203 로그인 상태가 바뀌면(늦게 로그인됨·로그인·로그아웃) 그 계정 캐릭터로 다시 불러옴 — 손님 캐릭터가 계정 저장을 덮지 않게
      const guestEl = $('#rgGuest'); const showGuest = () => { if (guestEl) guestEl.hidden = !!Hub.user; }; showGuest();
      if (guestEl) guestEl.addEventListener('click', () => { if (window.GoOpenAuth) window.GoOpenAuth('login'); });
      const offUser = Hub.onChange ? Hub.onChange(u => { showGuest(); const id = (u && u.id) || null; if (alive && S && id !== G.loadUid) { say('계정이 바뀌어 캐릭터를 다시 불러와요…', 4); setTimeout(() => { if (alive) location.reload(); }, 1200); } }) : null;
      return () => {
        if (offUser) offUser();
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
      // v84 카드 그림 = 선생님이 주신 그림(img/thumb.jpg). 받기 전에는 아래 도트 그림, 받으면 다시 그림
      const T = window.GoRPGThumb || (window.GoRPGThumb = Object.assign(new Image(), { src: 'games/action/rpg/img/thumb.jpg?v=84' }));
      if (T.complete && T.naturalWidth) { ctx.imageSmoothingEnabled = true; ctx.drawImage(T, 0, 0, w, h); return; }
      T.addEventListener('load', () => { try { this.thumb(ctx, w, h); } catch (e) { /* noop */ } }, { once: true });
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
