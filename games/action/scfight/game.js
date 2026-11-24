/*
 * gogo?gogo! — Skillcom Fight (3D 마법 대결 · v45 첫 버전)
 *
 *  화면: ① 대기방(왼쪽: 컴퓨터와 대결 · 온라인 1:1 방 / 오른쪽: 스킬 고르기 + 그 아래 스탯) ② 3D 대결
 *  캐릭터: skillcom RPG 저장(game_saves 'rpg' 또는 이 기기)에서 **아바타 + 레벨만** (장비 X). 아바타 도트를 3D 블록으로 세움
 *  마법: 원소 6개(화염·냉기·번개·땅·암흑·빛) 중 4개를 1~4 칸에. 숫자 하나 = 차지(발사 대기) → 마우스 왼쪽 = 발사, 오른쪽 = 취소. 차지 중 숫자 하나 더 = 융합 차지 (같은 숫자 = 강화)
 *  스탯: 레벨당 2포인트 · 최대 50 — 힘(피해 +2%) 민첩(이동 +1%) 지혜(마나 회복 +4%) 체력(최대 체력 +2%) + 원소 저항 6개(그 원소 피해 −1%)
 *  저장: game_saves 'scfight' {stat, skills, wins} (로그인) + 이 기기
 *  대결: 1:1 또는 2:2 (컴퓨터와 · 온라인). 2:2 는 같은 편끼리 안 맞음. 한 편이 모두 쓰러지면 끝
 *  온라인: Hub.channel 'scf-lobby'(방 목록) · 'scf-room-<코드>'(1:1 = 2명, 2:2 = 4명. 모자라면 방장이 빈자리를 컴퓨터로 채워 시작)
 *          방장이 'start'(편 나눔) 를 보냄. 각자 자기 몸(방장은 컴퓨터도)의 자리·체력을 보내고, 맞았는지는 맞은 몸을 맡은 기기가 판단
 *  v192(2단계 · 선생님 11/23): skillcom RPG '대결 카드'(rpg 저장 S.fc = 레벨·능력치·마법 8칸)를 읽음 · RPG 를 안 했으면 Lv.1 기본 카드
 *     대기방 = 내 능력치 · 마법 8칸(1234 · QWER) · 물약 3개씩 (예전 스탯 나누기 · 스킬 6개 중 4개 고르기 · 차지·즉석 융합 없앰)
 *     조작 = 이동 S(앞) Z(왼) X(뒤) C(오른) · 마법 1~4 QWER 바로 쏨 · 마우스 왼쪽 기본 공격(마법 화살) · F 체력 물약 · G 마나 물약 · Space 대시 · B 시점 · 마우스 시야
 *     (마법 모양·피해 공식·레벨 보정은 3단계 — 지금은 마법마다 원소에 맞는 예전 Fight 탄을 위력만큼 키워 쏨)
 *  전장·컴퓨터 (v46): Skillcom 원본 그대로 — 전장 3곳(성벽 위 · 판옥선 갑판 · 관아 앞마당, 판마다 뽑기) · 컴퓨터 = Skillcom 원본 장수 7명(Haesu · Beopsan · Seonbi · Taegang · Kan · Cute · Seacher)
 *     3D 파일은 assets/ (원본 Godot 파일을 줄임 · 장수 1개 ≈ 1.1MB) · 불러오는 도구 vendor/three-gltf.min.js · 못 불러오면 예전 블록 모양으로
 */
(function () {
  'use strict';
  const Hub = window.GameHub, AV = window.GoAvatar, BGM = window.GoBGM;
  const CFG = window.GoSettings.get('scfight'), GAME = 'scfight', DIR = 'games/action/scfight/';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];

  /* ================= 원소 · 마법 ================= */
  const EL = {
    fire: { n: '화염', c: '#FF6A3D', c2: '#FFD27A' }, cold: { n: '냉기', c: '#7FD8FF', c2: '#E6FBFF' }, bolt: { n: '번개', c: '#FFE45C', c2: '#FFFFFF' },
    earth: { n: '땅', c: '#C8915A', c2: '#F0D2A0' }, dark: { n: '암흑', c: '#9A5AE0', c2: '#E0C8FF' }, light: { n: '빛', c: '#FFF3B0', c2: '#FFFFFF' },
    wind: { n: '바람', c: '#7FE0C4', c2: '#E0FFF4' },   // v192 RPG 원소 (3단계부터 RPG 원소 7개로 싸움)
    water: { n: '물', c: '#3BA8F5', c2: '#BDE8FF' }, thunder: { n: '번개', c: '#FFE45C', c2: '#FFFFFF' }
  };
  const ELS = ['fire', 'cold', 'bolt', 'earth', 'dark', 'light'];   // 컴퓨터가 고르는 원소 (v192 바람은 RPG 마법에서만)
  // 기본 마법 (원소마다 하나): 피해 · 마나 · 재사용(초) · 탄 속도 · 크기 · 특징
  const SK = {
    fire: { n: '화염구', dmg: 14, mp: 12, cd: 0.9, spd: 22, r: 0.45, fx: '맞으면 2초 동안 불탐' },
    cold: { n: '얼음 화살', dmg: 11, mp: 10, cd: 0.7, spd: 30, r: 0.32, fx: '맞으면 느려짐' },
    bolt: { n: '번개 창', dmg: 12, mp: 12, cd: 0.8, spd: 42, r: 0.28, fx: '가장 빠름' },
    earth: { n: '바위 던지기', dmg: 19, mp: 16, cd: 1.2, spd: 16, r: 0.6, fx: '가장 셈 · 느림' },
    dark: { n: '암흑 구슬', dmg: 12, mp: 12, cd: 0.9, spd: 19, r: 0.42, fx: '상대를 살짝 따라감' },
    light: { n: '빛의 화살', dmg: 10, mp: 10, cd: 0.7, spd: 34, r: 0.3, fx: '맞히면 내 체력 회복' },
    wind: { n: '바람 칼날', dmg: 12, mp: 10, cd: 0.8, spd: 36, r: 0.34, fx: '빠르고 곧게' }
  };
  // 융합 이름 (같은 원소 = 강화)
  const FU = {
    'fire+fire': '겁화', 'cold+cold': '절대 영도', 'bolt+bolt': '천둥 벼락', 'earth+earth': '대지 붕괴', 'dark+dark': '심연', 'light+light': '태양 창',
    'cold+fire': '증기 폭발', 'bolt+fire': '플라즈마', 'earth+fire': '용암 탄', 'dark+fire': '지옥불', 'fire+light': '홍염 광선',
    'bolt+cold': '얼음 번개', 'cold+earth': '빙하 바위', 'cold+dark': '어둠 서리', 'cold+light': '오로라',
    'bolt+earth': '자력 폭풍', 'bolt+dark': '검은 번개', 'bolt+light': '섬광',
    'dark+earth': '저주 바위', 'earth+light': '수정 창', 'dark+light': '혼돈'
  };
  const fuseKey = (a, b) => [a, b].sort().join('+');
  function spell(a, b) {   // a, b = 원소 (b 없으면 기본 마법)
    if (!b) return Object.assign({ els: [a], name: SK[a].n, count: 1, fused: false }, SK[a]);
    const A = SK[a], B = SK[b], same = a === b;
    return { els: same ? [a] : [a, b], name: FU[fuseKey(a, b)] || (EL[a].n + '+' + EL[b].n), fused: true, count: 1, dmg: Math.round((A.dmg + B.dmg) * (same ? 1.05 : 1.0)), mp: Math.round((A.mp + B.mp) * 0.85), cd: Math.max(A.cd, B.cd) + 0.6, spd: (A.spd + B.spd) / 2, r: Math.max(A.r, B.r) * (same ? 1.5 : 1.4) };   // v55: 융합은 언제나 큰 한 발 (예전: 다른 원소면 작은 세 발 · 합쳐 피해 ×0.5)
  }

  /* ================= v192 RPG 대결 카드 ================= */
  // RPG 원소 → Fight 탄 원소 (3단계에서 RPG 마법 모양으로 바꿀 때까지)
  const RMAP = { fire: 'fire', water: 'water', wind: 'wind', earth: 'earth', thunder: 'thunder', light: 'light', dark: 'dark' };   // v192 3단계: RPG 원소 그대로
  const RNAME = { fire: '불', water: '물', wind: '바람', earth: '땅', thunder: '번개', light: '빛', dark: '어둠' };
  const KINDN = { bolt: '탄', nova: '둘레 폭발', beam: '광선', rain: '비', heal: '회복', shield: '방패', dash: '돌진', pool: '늪' };
  const SLOTK = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R'];
  const ARROW = { id: 'magicarrow', name: '마법 화살', el: 'light', els: ['light'], lv: 1, kind: 'bolt', pow: 1.25, mp: 3, cd: 0.8 };
  // RPG 를 안 했으면 (선생님 11/23 '나'): Lv.1 기본 카드 = RPG Lv.1 새 캐릭터 능력치 + 기본 마법 2개
  const BASIC_CARD = () => ({ v: 1, lv: 1, reb: 0, basic: true, st: { atk: 9, mag: 9, def: 1, hp: 102, mp: 49, spd: 0, dmg: 0, mpRegen: 100, crit: 8, critD: 1.6, pdef: 0, edefs: {} },
    slots: [Object.assign({}, ARROW), { id: 'fireball', name: '파이어볼', el: 'fire', els: ['fire'], lv: 3, kind: 'bolt', pow: 1.6, mp: 6, cd: 1.2 }, null, null, null, null, null, null], at: 0 });
  const num = (v, a, b, d) => { v = +v; return isFinite(v) ? clamp(v, a, b) : d; };
  function normCard(fc) {   // 저장에서 읽은 카드를 믿을 수 있는 모양으로 (없거나 망가지면 기본 카드)
    if (!fc || typeof fc !== 'object' || !fc.st || !Array.isArray(fc.slots)) return BASIC_CARD();
    const st = {}; ['atk', 'mag', 'def', 'hp', 'mp'].forEach(k => { st[k] = Math.round(num(fc.st[k], 1, 1e7, 1)); });
    ['spd', 'dmg', 'pdef'].forEach(k => { st[k] = num(fc.st[k], -100, 1000, 0); }); st.mpRegen = num(fc.st.mpRegen, 0, 2000, 100); st.crit = num(fc.st.crit, 0, 100, 8); st.critD = num(fc.st.critD, 1, 10, 1.6);
    st.edefs = {}; Object.keys(RMAP).forEach(e => { st.edefs[e] = num(fc.st.edefs && fc.st.edefs[e], -100, 100, 0); });
    const slots = Array.from({ length: 8 }, (_, i) => {
      const o = fc.slots[i]; if (!o || typeof o !== 'object') return null;
      const els = (Array.isArray(o.els) ? o.els : [o.el]).filter(e => RMAP[e]).slice(0, 2); if (!els.length) return null;
      const q = { id: String(o.id || '').slice(0, 40), name: String(o.name || '마법').slice(0, 14), el: els[0], els, lv: Math.round(num(o.lv, 1, 100, 1)), kind: KINDN[o.kind] ? o.kind : 'bolt', pow: num(o.pow, 0, 20, 1), mp: Math.round(num(o.mp, 0, 200, 5)), cd: num(o.cd, 0.3, 60, 1) };
      const LIM = { count: 12, radius: 300, len: 600, w: 120, dur: 12, speed: 3 }; ['count', 'radius', 'len', 'w', 'dur', 'speed'].forEach(k => { if (o[k] != null) q[k] = num(o[k], 0, LIM[k], 0); });   // v199 저장이 망가져도 마당 전체를 덮는 마법이 없게 (RPG 가장 큰 값: 둘레 260 · 길이 400 · 너비 80 · 10초 · 9번 · 속도 1.6) if (o.pierce) q.pierce = true;
      return q;
    });
    if (!slots.some(Boolean)) slots[0] = Object.assign({}, ARROW);
    return { v: 1, lv: Math.round(num(fc.lv, 1, 100, 1)), reb: Math.round(num(fc.reb, 0, 99, 0)), st, slots, at: +fc.at || 0, basic: false };
  }
  // 마법 칸 하나 → 대결 마법 (3단계: RPG 모양 그대로 · 거리는 RPG 22px = 1m)
  const PX = 1 / 22;
  function slotSpell(q) {
    return { name: q.name, id: q.id, els: q.els.slice(0, 2), kind: q.kind, pow: q.pow, mp: q.mp, cd: q.cd, count: q.count || 0, pierce: !!q.pierce, speed: q.speed || 1, radius: q.radius || 0, len: q.len || 0, w: q.w || 0, dur: q.dur || 0, fused: q.els.length > 1 };
  }
  const BASIC_SP = { name: '기본 공격', id: 'basic', els: ['light'], kind: 'bolt', basic: true, pow: 1, mp: 0, cd: 0.45, count: 1, speed: 1.2, fused: false };   // RPG 지팡이 기본 공격 = 공격 0.6 + 마력 0.5
  // 컴퓨터 마법 (원소마다 RPG 마법 하나 · 5단계에서 레벨에 맞게 더 다양하게)
  const CPU_SK = {
    fire: { id: 'fireball', name: '파이어볼', els: ['fire'], kind: 'bolt', pow: 1.6, mp: 6, cd: 1.2 },
    water: { id: 'watershot', name: '물방울 탄', els: ['water'], kind: 'bolt', pow: 1.3, mp: 6, cd: 1.0, count: 2 },
    wind: { id: 'windblade', name: '바람 칼날', els: ['wind'], kind: 'bolt', pow: 1.8, mp: 9, cd: 1.5, pierce: true },
    earth: { id: 'earthsplit', name: '대지 가르기', els: ['earth'], kind: 'beam', pow: 2.8, mp: 16, cd: 4, len: 260, w: 40 },
    thunder: { id: 'thunderarrow', name: '번개 화살', els: ['thunder'], kind: 'bolt', pow: 2.4, mp: 12, cd: 1.4, speed: 1.6 },
    light: { id: 'lightspear', name: '빛의 창', els: ['light'], kind: 'beam', pow: 3.0, mp: 18, cd: 3.5, len: 320, w: 26 },
    dark: { id: 'darkorb', name: '어둠 구슬', els: ['dark'], kind: 'bolt', pow: 1.6, mp: 8, cd: 1.2 }
  };
  // v192 5단계: 컴퓨터도 레벨에 맞는 RPG 마법 (rpg/data.js SK 표와 같음: [id, 이름, 원소, 배우는 레벨, 모양, 위력, 마나, 재사용, 추가])
  const RPG_SK = [
    ['magicarrow', '마법 화살', 'light', 1, 'bolt', 1.25, 3, 0.8, {}], ['fireball', '파이어볼', 'fire', 3, 'bolt', 1.6, 6, 1.2, {}], ['watershot', '물방울 탄', 'water', 6, 'bolt', 1.3, 6, 1.0, { count: 2 }],
    ['heal1', '회복의 물', 'water', 10, 'heal', 0.25, 14, 8, {}], ['darkorb', '어둠 구슬', 'dark', 12, 'bolt', 1.6, 8, 1.2, {}], ['stonewall', '돌 방패', 'earth', 14, 'shield', 0.35, 12, 14, { dur: 6 }],
    ['windblade', '바람 칼날', 'wind', 18, 'bolt', 1.8, 9, 1.5, { pierce: true }], ['firering', '불꽃 고리', 'fire', 22, 'nova', 2.2, 14, 4, { radius: 110 }], ['thunderarrow', '번개 화살', 'thunder', 26, 'bolt', 2.4, 12, 1.4, { speed: 1.6 }],
    ['earthsplit', '대지 가르기', 'earth', 30, 'beam', 2.8, 16, 4, { len: 260, w: 40 }], ['tornado', '회오리', 'wind', 34, 'nova', 2.4, 16, 5, { radius: 130 }], ['lightspear', '빛의 창', 'light', 38, 'beam', 3.0, 18, 3.5, { len: 320, w: 26 }],
    ['cursefog', '저주의 안개', 'dark', 42, 'nova', 2.3, 18, 5, { radius: 120 }], ['firerain', '화염 비', 'fire', 44, 'rain', 2.6, 24, 6, { count: 6, radius: 60 }], ['tidal', '해일', 'water', 48, 'beam', 3.2, 22, 5, { len: 300, w: 70 }],
    ['chainbolt', '연쇄 번개', 'thunder', 52, 'bolt', 2.6, 20, 2.5, { count: 3, pierce: true }], ['gale', '질풍 돌진', 'wind', 56, 'dash', 3.0, 18, 5, { len: 220 }], ['holylight', '성스러운 빛', 'light', 60, 'heal', 0.5, 30, 14, {}],
    ['thunderfall', '낙뢰', 'thunder', 64, 'rain', 3.2, 30, 6, { count: 5, radius: 70 }], ['quake', '지진', 'earth', 68, 'nova', 3.6, 30, 7, { radius: 170 }], ['shadowspear', '그림자 창', 'dark', 70, 'beam', 3.4, 28, 4.5, { len: 330, w: 34 }],
    ['stormblade', '폭풍 칼날', 'wind', 72, 'bolt', 2.4, 26, 2.5, { count: 5, pierce: true }], ['barrier', '빛의 결계', 'light', 76, 'shield', 0.55, 30, 20, { dur: 8 }], ['waterfall', '대폭포', 'water', 80, 'rain', 3.4, 34, 7, { count: 7, radius: 70 }],
    ['sunburst', '태양 폭발', 'fire', 84, 'nova', 4.4, 40, 8, { radius: 200 }], ['thorspear', '천둥의 창', 'thunder', 88, 'beam', 4.8, 40, 6, { len: 400, w: 50 }], ['abyss', '심연의 비', 'dark', 90, 'rain', 4.4, 46, 8, { count: 8, radius: 80 }],
    ['earthrage', '대지의 분노', 'earth', 92, 'rain', 4.2, 44, 8, { count: 9, radius: 80 }], ['judgement', '심판의 빛', 'light', 96, 'rain', 4.8, 50, 9, { count: 8, radius: 90 }], ['elemental', '원소 해방', 'light', 100, 'nova', 6.0, 70, 15, { radius: 260 }]
  ].map(([id, name, el, lv, kind, pow, mp, cd, ex]) => Object.assign({ id, name, el, els: [el], lv, kind, pow, mp, cd }, ex));
  const RPG_SKID = {}; RPG_SK.forEach(q => { RPG_SKID[q.id] = q; });
  const HERO_EL = { Haesu: 'water', Beopsan: 'light', Seonbi: 'wind', Taegang: 'earth', Kan: 'fire', Cute: 'dark', Seacher: 'thunder' };   // 장수마다 주 원소
  // 컴퓨터 마법 꾸러미: 배운 레벨 이하 · 주 원소 가장 센 공격 1개 + 다른 원소 공격 3개(모양이 겹치지 않게) + 회복·방패(배웠으면)
  function cpuKit(hero, lv) {
    const have = RPG_SK.filter(q => q.lv <= lv), atk = have.filter(q => q.kind !== 'heal' && q.kind !== 'shield').sort((a, b) => b.lv - a.lv), kit = [], els = new Set(), kinds = {};
    const add = q => { kit.push(q.id); els.add(q.el); kinds[q.kind] = (kinds[q.kind] || 0) + 1; };
    const main = atk.find(q => q.el === HERO_EL[hero]); if (main) add(main);
    atk.forEach(q => { if (kit.length < 4 && !kit.includes(q.id) && !els.has(q.el) && (kinds[q.kind] || 0) < 2) add(q); });
    atk.forEach(q => { if (kit.length < 4 && !kit.includes(q.id)) add(q); });
    ['heal', 'shield'].forEach(k => { const q = have.filter(x => x.kind === k).sort((a, b) => b.lv - a.lv)[0]; if (q) kit.push(q.id); });
    return kit;
  }

  /* v192 6단계: RPG 보스 도전 — RPG 에서 이긴 보스만 (rpg 저장 bossWon[이름] = 이긴 레벨 · 그 전 기록은 hell·sasin·kingAt·ysp·ysAt 로 채움) */
  const BOSS_TIER = { field: { n: '사냥터 보스', k: 1.0 }, hellMid: { n: '저승 옥졸·판관', k: 1.1 }, hell: { n: '저승 시왕', k: 1.25 }, sasin: { n: '사방신', k: 1.35 }, king: { n: '광개토대왕', k: 1.5 }, ys: { n: '이순신 던전 장수', k: 1.4 }, ysBoss: { n: '이순신 던전 대장', k: 1.6 } };
  let BOSSDEF = null;
  function bossDefs() {   // RPG 자료(GoRPGData)에서 보스 정의를 이름으로 찾음
    if (BOSSDEF) return BOSSDEF; BOSSDEF = {}; const D = window.GoRPGData; if (!D) return BOSSDEF;
    const put = (def, tier) => { if (def && def.name && !BOSSDEF[def.name]) BOSSDEF[def.name] = { def, tier }; };
    (D.HELL && D.HELL.gates || []).forEach(g => { put(g.boss, 'hell'); put(g.guard, 'hellMid'); put(g.judge, 'hellMid'); });
    if (D.SASIN && D.SASIN.boss) Object.keys(D.SASIN.boss).forEach(k => put(D.SASIN.boss[k], k === 'king' ? 'king' : 'sasin'));
    if (D.YS) { (D.YS.gens || []).forEach(g => put(g, 'ys')); put(D.YS.boss, 'ysBoss'); }
    (D.MAPS || []).forEach(m => { if (m.boss && m.mon) put(m.mon, 'field'); if (m.bossMon) put(m.bossMon, 'field'); });
    return BOSSDEF;
  }
  function bossList(rpg) {
    const D = window.GoRPGData, defs = bossDefs(), won = Object.assign({}, rpg && rpg.bossWon || {}), add = (n, lv) => { if (n && !won[n]) won[n] = lv || 1; };
    if (rpg && D) {
      const h = +rpg.hell || 0; (D.HELL && D.HELL.gates || []).forEach((g, i) => { const b = i * 5; if (h >= b + 3 && g.guard) add(g.guard.name); if (h >= b + 4 && g.judge) add(g.judge.name); if (h >= b + 5 && g.boss) add(g.boss.name); });
      if (rpg.sasin && D.SASIN && D.SASIN.boss) Object.keys(rpg.sasin).forEach(k => { if (rpg.sasin[k] && D.SASIN.boss[k]) add(D.SASIN.boss[k].name); });
      if (rpg.kingAt && D.SASIN && D.SASIN.boss && D.SASIN.boss.king) add(D.SASIN.boss.king.name);
      if (Array.isArray(rpg.ysp) && D.YS) rpg.ysp.forEach((v, i) => { if (v && D.YS.gens && D.YS.gens[i]) add(D.YS.gens[i].name); });
      if (rpg.ysAt && D.YS && D.YS.boss) add(D.YS.boss.name);
    }
    const order = Object.keys(BOSS_TIER);
    return Object.keys(won).filter(n => defs[n]).map(n => ({ name: n, lv: Math.round(+won[n] || 1), tier: defs[n].tier, def: defs[n].def })).sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier) || a.lv - b.lv);
  }
  function bossKit(def, lv) {   // 보스 원소의 가장 센 공격 + 다른 원소 공격 + 방패 (회복은 안 씀)
    const el = def.el || 'dark', have = RPG_SK.filter(q => q.lv <= lv), atk = have.filter(q => q.kind !== 'heal' && q.kind !== 'shield').sort((a, b) => b.lv - a.lv), kit = [], els = new Set();
    atk.filter(q => q.el === el).slice(0, 2).forEach((q, i, a) => { if (i && q.lv < a[0].lv / 2) return; kit.push(q.id); els.add(q.el); });   // 둘째 것이 너무 약하면 뺌
    atk.forEach(q => { if (kit.length < 5 && !els.has(q.el)) { kit.push(q.id); els.add(q.el); } });
    const sh = have.filter(q => q.kind === 'shield').sort((a, b) => b.lv - a.lv)[0]; if (sh) kit.push(sh.id);
    return kit;
  }
  // 보스 그림: 자세 그림(frames)이 있으면 대기·공격·마법·맞음, 없으면 한 장 (지역 보스는 rb{번호}_idle·atk·cast·hit)
  function bossFrames(def) {
    if (def.frames) return { idle: def.frames.idle, atk: def.frames.melee || def.frames.atk2, cast: def.frames.cast2 || def.frames.cast, hit: def.frames.hit };
    const one = def.img79 || def.img; if (one) return { idle: one };
    if (def.ri != null && def.ri <= 8) return { idle: 'rb' + def.ri + '_idle', atk: 'rb' + def.ri + '_atk', cast: 'rb' + def.ri + '_cast', hit: 'rb' + def.ri + '_hit' };
    if (def.ri != null) return { idle: 'boss_r' + def.ri };
    return { idle: null };
  }

  // RPG 마법 그림 (rpg/img/ic_skill.png 34px × 30칸 · ic_fusion.png 48px × 21칸 · 물약 ic_pot.png 80px × 19칸)
  const RPG_IMG = 'games/action/rpg/img/';
  const SK_ORDER = ['magicarrow', 'fireball', 'watershot', 'heal1', 'darkorb', 'stonewall', 'windblade', 'firering', 'thunderarrow', 'earthsplit', 'tornado', 'lightspear', 'cursefog', 'firerain', 'tidal', 'chainbolt', 'gale', 'holylight', 'thunderfall', 'quake', 'shadowspear', 'stormblade', 'barrier', 'waterfall', 'sunburst', 'thorspear', 'abyss', 'earthrage', 'judgement', 'elemental'];
  const FU_ORDER = ['fire+water', 'fire+wind', 'earth+fire', 'fire+thunder', 'fire+light', 'water+wind', 'earth+water', 'thunder+water', 'light+water', 'earth+wind', 'thunder+wind', 'light+wind', 'earth+thunder', 'earth+light', 'light+thunder', 'dark+fire', 'dark+water', 'dark+wind', 'dark+earth', 'dark+thunder', 'dark+light'];
  const sheetBg = (file, i, n) => `url(${RPG_IMG}${file}?v=101) ${n > 1 ? (i / (n - 1) * 100).toFixed(3) : 0}% 0 / ${n * 100}% 100% no-repeat`;
  function skIconBg(q) {   // 마법 칸 그림 (없으면 원소 색)
    if (!q) return '';
    if (q.els.length > 1) { const i = FU_ORDER.indexOf(q.els.slice().sort().join('+')); if (i >= 0) return sheetBg('ic_fusion.png', i, 21); }
    const i = SK_ORDER.indexOf(q.id); if (i >= 0) return sheetBg('ic_skill.png', i, 30);
    return `radial-gradient(circle at 35% 30%, ${EL[q.els[q.els.length - 1]].c2}, ${EL[q.els[0]].c} 70%)`;
  }
  const potBg = k => `url(${RPG_IMG}ic_pot.png?v=102) ${((k === 'hp' ? 4 : 13) / 18 * 100).toFixed(3)}% 0 / 1900% 100% no-repeat`;   // 체력 물약 5단계 · 마나 물약 5단계 그림

  /* ================= v192 대결 능력치 (대결 카드 → 싸움 값) ================= */
  const DMUL = CFG.dmgMul || 0.5, LVPEN = CFG.lvPen != null ? CFG.lvPen : 0.01, LVPENMAX = CFG.lvPenMax || 0.5;   // RPG 결투와 같은 피해 배율 0.5 · 레벨 보정 = 레벨 차이 1당 높은 쪽 −1% (최대 −50%)
  const normSt = st => normCard({ st: st || {}, slots: [ARROW] }).st;
  function cardF(st) {
    return { hp: st.hp, mp: st.mp, regen: st.mp * 0.03 * st.mpRegen / 100, spd: 6 * (1 + clamp(st.spd, 0, 100) / 200), atk: st.atk, mag: st.mag, def: st.def, pdef: clamp(st.pdef, -50, 75), edefs: st.edefs || {}, crit: st.crit, critD: st.critD, dmg: st.dmg, pen: 0 };
  }
  const scaleSt = (st, k) => { const o = JSON.parse(JSON.stringify(st)); ['atk', 'mag', 'def', 'hp', 'mp'].forEach(q => { o[q] = Math.max(1, Math.round(o[q] * k)); }); return o; };

  /* ================= 스탯 ================= */
  const STATS = [
    ['str', '힘', '#FF8A8E', '주는 피해 +2%'], ['dex', '민첩', '#9AF0B0', '이동 속도 +1%'], ['int', '지혜', '#C8A8FF', '마나 회복 +4%'], ['vit', '체력', '#FFB86B', '최대 체력 +2%'],
    ['rfire', '화염 저항', EL.fire.c, '화염 피해 −1%'], ['rcold', '냉기 저항', EL.cold.c, '냉기 피해 −1%'], ['rbolt', '번개 저항', EL.bolt.c, '번개 피해 −1%'],
    ['rearth', '땅 저항', EL.earth.c, '땅 피해 −1%'], ['rdark', '암흑 저항', EL.dark.c, '암흑 피해 −1%'], ['rlight', '빛 저항', EL.light.c, '빛 피해 −1%']
  ];
  const MAXS = CFG.statMax || 50, PER = CFG.statPerLevel || 2;
  function fighter(lv, stat) {   // 레벨 + 스탯 → 싸움 능력치
    const s = k => (stat && stat[k]) || 0;
    return { lv, hp: Math.round(((CFG.roundHp || 100) + lv * 9) * (1 + s('vit') * 0.02)), mp: 100, regen: 9 * (1 + s('int') * 0.04), spd: 6 * (1 + s('dex') * 0.01), dmgK: (1 + lv * 0.025) * (1 + s('str') * 0.02), res: { fire: s('rfire'), cold: s('rcold'), bolt: s('rbolt'), earth: s('rearth'), dark: s('rdark'), light: s('rlight') } };
  }

  /* ================= 저장 ================= */
  const newSave = () => ({ v: 1, stat: {}, skills: ['fire', 'cold', 'bolt', 'earth'], wins: 0, losses: 0, view: 1, mode: 2, diff: 'normal', savedAt: 0 });
  function fixSave(s, lv) {
    const n = newSave(); if (!s || typeof s !== 'object') s = n;
    const st = {}; let used = 0; STATS.forEach(([k]) => { st[k] = clamp(Math.floor(+((s.stat || {})[k]) || 0), 0, MAXS); used += st[k]; });
    const total = (lv - 1) * PER; if (used > total) STATS.forEach(([k]) => { st[k] = 0; });
    s.stat = st; s.sp = total - STATS.reduce((a, [k]) => a + st[k], 0);
    s.skills = (Array.isArray(s.skills) ? s.skills : []).filter(e => SK[e]).slice(0, 4); ELS.forEach(e => { if (s.skills.length < 4 && !s.skills.includes(e)) s.skills.push(e); });
    s.wins = Math.max(0, +s.wins || 0); s.losses = Math.max(0, +s.losses || 0); s.view = s.view === 3 ? 3 : 1; s.mode = s.mode === 4 ? 4 : 2; s.diff = ['easy', 'normal', 'hard'].includes(s.diff) ? s.diff : 'normal';
    return s;
  }
  const online = () => Hub.mode === 'online' && Hub.user && Hub._sb;
  const lkey = (g, uid) => 'gogogogo.' + g + '.' + (uid || 'guest');
  async function loadRow(game) {
    const uid = Hub.user && Hub.user.id; let s = null;
    try { s = JSON.parse(localStorage.getItem(lkey(game, uid)) || 'null'); } catch (e) { s = null; }
    if (online()) { try { const { data } = await Hub._sb.from('game_saves').select('data').eq('user_id', uid).eq('game_id', game).maybeSingle(); if (data && data.data && (!s || (data.data.savedAt || 0) > (s.savedAt || 0))) s = data.data; } catch (e) { /* 표 없음 */ } }
    if (!s && uid && game === 'rpg') { try { s = JSON.parse(localStorage.getItem(lkey(game, null)) || 'null'); } catch (e) { /* noop */ } }
    return s;
  }
  async function saveRow(s) {
    s.savedAt = Date.now(); const copy = JSON.parse(JSON.stringify(s));
    try { localStorage.setItem(lkey(GAME, Hub.user && Hub.user.id), JSON.stringify(copy)); } catch (e) { /* noop */ }
    if (online()) { try { await Hub._sb.from('game_saves').upsert({ user_id: Hub.user.id, game_id: GAME, data: copy, updated_at: new Date().toISOString() }); } catch (e) { /* noop */ } }
  }

  /* ================= three.js 불러오기 ================= */
  let threeP = null;
  const loadThree = () => threeP || (threeP = window.THREE ? Promise.resolve(window.THREE) : new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = DIR + 'vendor/three.min.js?v=149'; sc.onload = () => res(window.THREE); sc.onerror = () => { threeP = null; rej(new Error('three')); }; document.head.appendChild(sc);
  }));
  /* Skillcom 원본 3D 파일 (Meshy 로 만든 장수 4명 · 전장 소품 · 그림 하늘) — 못 불러오면 예전 블록 모양으로 */
  const AV_VER = 46;
  let gltfP = null;
  const loadGLTF = () => gltfP || (gltfP = loadThree().then(T => T.GLTFLoader ? T : new Promise(res => {
    const sc = document.createElement('script'); sc.src = DIR + 'vendor/three-gltf.min.js?v=' + AV_VER; sc.onload = () => res(window.THREE.GLTFLoader ? window.THREE : null); sc.onerror = () => { gltfP = null; res(null); }; document.head.appendChild(sc);
  })));
  const assetC = {};
  function asset(name) {
    return assetC[name] || (assetC[name] = loadGLTF().then(T => !T ? null : new Promise(res => {
      const l = new T.GLTFLoader(); l.setMeshoptDecoder(T.MeshoptDecoder);
      l.load(DIR + 'assets/' + name + '.glb?v=' + AV_VER, g => res(g), undefined, () => { delete assetC[name]; res(null); });
    })));
  }
  const skyC = {};
  function skyTex(THREE, t) { return skyC[t] || (skyC[t] = new Promise(res => { new THREE.TextureLoader().load(DIR + 'assets/sky_' + t + '.webp?v=' + AV_VER, tx => res(tx), undefined, () => { delete skyC[t]; res(null); }); })); }
  const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  // 컴퓨터 장수 7명 (Skillcom 원본 마법사 · 움직임: 대기 걷기 시전 융합 맞음 쓰러짐 승리). 내 캐릭터는 늘 gogo?gogo! 아바타
  const HEROES = { Haesu: '판옥선 수군 Haesu', Beopsan: '승병 Beopsan', Seonbi: '의병 선비 Seonbi', Taegang: '마법장수 Taegang', Kan: '초원 주술사 Kan', Cute: '한밤 점술가 Cute', Seacher: '떠돌이 전사 Seacher' };   // v46: Skillcom 원본 마법사 7명
  const HERO_IDS = Object.keys(HEROES);
  // 전장 3곳 (Skillcom 원본 그대로: 성벽 위 · 판옥선 갑판 · 관아 앞마당) — 판마다 뽑기
  const ARENAS = { wall: '성벽 위', ship: '판옥선 갑판', gwana: '관아 앞마당' };
  const ARENA_IDS = Object.keys(ARENAS);
  const PROPS = { wall: ['wall_gate', 'wall_beacon', 'wall_parapet'], ship: ['ship_tower', 'ship_panok', 'ship_turtle'], gwana: ['gwana_hall', 'gwana_cannon', 'gwana_arms', 'gwana_fence'] };
  const FX = { cold: 'fx_ice', water: 'fx_ice', earth: 'fx_earth', dark: 'fx_dark' };

  /* ================= 화면 모양 ================= */
  const CSS = `
  .sf-page .sf-lobby { display: grid; grid-template-columns: 1fr 1.15fr; gap: 14px; }
  .sf-card { background: linear-gradient(180deg, #232B5C, #151B42); color: #EEF1FF; border: 3px solid #0A0E24; border-radius: 16px; padding: 14px; box-shadow: 0 4px 0 rgba(0,0,0,.3); }
  .sf-card h3 { font-family: var(--f-display); font-size: 21px; margin: 0 0 8px; display: flex; align-items: center; gap: 8px; }
  .sf-card .sub { color: #AEB7E0; font-size: 13px; margin: 0 0 10px; }
  .sf-me { display: flex; gap: 12px; align-items: center; background: rgba(255,255,255,.06); border: 2px solid #0A0E24; border-radius: 12px; padding: 8px 10px; margin-bottom: 10px; }
  .sf-me canvas { width: 54px; height: 54px; image-rendering: pixelated; border-radius: 10px; background: radial-gradient(circle at 50% 30%, #5C86FF, #2F3FA0); border: 2px solid #0A0E24; flex: none; }
  .sf-me b { font-family: var(--f-display); font-size: 18px; } .sf-me small { display: block; color: #AEB7E0; font-size: 12px; }
  .sf-rooms { display: grid; gap: 8px; }
  .sf-go { width: 100%; margin-top: 4px; padding: 14px 16px; border: 3px solid #0A0E24; border-radius: 12px; background: #3DDC84; color: #0A0E24; font: 700 20px/1.2 inherit; font-family: inherit; cursor: pointer; box-shadow: 0 4px 0 #0A0E24; }
  .sf-go small { display: block; font-size: 13px; font-weight: 600; opacity: .8; margin-top: 2px; }
  .sf-go:hover:not([disabled]) { filter: brightness(1.06); }
  .sf-go:active:not([disabled]) { transform: translateY(3px); box-shadow: 0 1px 0 #0A0E24; }
  .sf-go[disabled] { background: #3A4170; color: #C7CDEB; cursor: default; box-shadow: none; }
  .sf-room { display: flex; align-items: center; gap: 10px; background: #1A2148; border: 2px solid #0A0E24; border-radius: 12px; padding: 10px 12px; }
  .sf-room .grow { flex: 1; min-width: 0; } .sf-room b { font-size: 15px; } .sf-room small { display: block; color: #AEB7E0; font-size: 12px; }
  .sf-room.cpu { background: linear-gradient(90deg, #3A2050, #1A2148); }
  .sf-btn { background: #FFD23F; color: #1D2340; border: 2px solid #0A0E24; border-radius: 8px; padding: 7px 14px; font-size: 14px; cursor: pointer; white-space: nowrap; font-family: inherit; }
  .sf-btn.ghost { background: #2A325E; color: #EEF1FF; } .sf-btn[disabled] { opacity: .45; cursor: default; }
  .sf-btn.on { background: #3DDC84; }
  .sf-skills { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
  .sf-sk { position: relative; display: grid; gap: 2px; text-align: left; background: #1A2148; color: #EEF1FF; border: 2px solid #0A0E24; border-left: 5px solid var(--c); border-radius: 10px; padding: 7px 9px; cursor: pointer; font-family: inherit; }
  .sf-sk b { font-size: 14px; } .sf-sk small { color: #AEB7E0; font-size: 11px; }
  .sf-sk .no { position: absolute; right: 6px; top: 6px; background: #FFD23F; color: #1D2340; border-radius: 6px; font-size: 13px; padding: 0 7px; font-weight: 700; }
  .sf-sk.sel { box-shadow: 0 0 0 2px var(--c) inset; background: #232D66; }
  .sf-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .sf-st { display: flex; align-items: center; gap: 6px; background: #141A3C; border: 2px solid #0A0E24; border-left: 4px solid var(--c); border-radius: 9px; padding: 4px 6px 4px 8px; }
  .sf-st .grow { flex: 1; min-width: 0; } .sf-st b { color: var(--c); font-size: 13px; } .sf-st span { font-family: var(--f-display); font-size: 16px; margin-left: 4px; } .sf-st small { display: block; color: #8A93C0; font-size: 11px; }
  .sf-st .sf-btn { padding: 2px 9px; font-size: 13px; }
  .sf-sp { display: flex; align-items: center; gap: 8px; margin: 2px 0 8px; font-size: 13px; color: #C9D0F0; } .sf-sp b { font-family: var(--f-display); font-size: 20px; color: #FFD23F; }
  .sf-stage { position: relative; width: min(100%, calc((100svh - 150px) * 1.7778)); margin: 0 auto; aspect-ratio: 16 / 9; background: #05081A; border: 3px solid #0A0E24; border-radius: 14px; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; }
  .sf-stage canvas { display: block; width: 100%; height: 100%; }
  .sf-hud { position: absolute; inset: 0; pointer-events: none; font-family: var(--f-display); color: #FFFFFF; }
  .sf-bar { position: absolute; height: 18px; background: rgba(10,14,36,.8); border: 2px solid #0A0E24; border-radius: 8px; overflow: hidden; }
  .sf-bar i { display: block; height: 100%; transition: width .15s; } .sf-bar span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 700 11px/1 "Noto Sans KR", "Malgun Gothic", sans-serif; letter-spacing: 0; color: #fff; text-shadow: 0 0 2px #000, 0 1px 1px #000; white-space: nowrap; }   /* v55: 글자가 막대 아래로 삐져나가던 것 (제목 글꼴 줄 높이) */
  .sf-name { position: absolute; font-size: 15px; text-shadow: 0 2px 2px #000; }
  .sf-nums { position: absolute; left: 50%; bottom: 3%; transform: translateX(-50%); display: flex; gap: 8px; pointer-events: auto; }
  .sf-num { position: relative; width: 64px; height: 64px; border-radius: 14px; border: 3px solid #0A0E24; background: radial-gradient(circle at 35% 30%, var(--c2), var(--c) 70%); color: #1D2340; font-family: var(--f-display); font-size: 28px; cursor: pointer; box-shadow: 0 4px 0 rgba(0,0,0,.4); touch-action: manipulation; }
  .sf-num small { position: absolute; left: 0; right: 0; bottom: -18px; font-size: 11px; color: #FFFFFF; text-shadow: 0 1px 2px #000; white-space: nowrap; }
  .sf-num .cd { position: absolute; inset: 0; border-radius: 11px; background: rgba(10,14,36,.65); color: #FFF; display: grid; place-items: center; font-size: 16px; }
  .sf-num.wait { outline: 4px solid #FFFFFF; outline-offset: 2px; transform: translateY(-4px); }
  .sf-view { position: absolute; right: 2%; bottom: 4%; pointer-events: auto; }
  .sf-full { position: absolute; right: 2%; bottom: calc(4% + 44px); pointer-events: auto; display: grid; place-items: center; padding: 6px 8px; }
  .sf-hurt { position: absolute; inset: 0; box-shadow: inset 0 0 90px 30px rgba(255,40,60,.75); opacity: 0; transition: opacity .25s; }
  .sf-stage.sf-max { position: fixed; inset: 0; z-index: 200; width: 100vw; height: 100dvh; max-width: none; border: 0; border-radius: 0; aspect-ratio: auto; }
  .sf-diff { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .sf-fu { margin: 0 0 6px; } .sf-fu summary { cursor: pointer; color: #FFD23F; font-size: 13px; padding: 4px 0; }
  .sf-fugrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; margin-top: 6px; }
  .sf-fugrid div { background: linear-gradient(90deg, color-mix(in srgb, var(--c) 30%, #141A3C), color-mix(in srgb, var(--c2) 30%, #141A3C)); border: 2px solid #0A0E24; border-radius: 8px; padding: 4px 8px; font-size: 13px; }
  .sf-fugrid b { color: #FFD23F; margin-right: 4px; } .sf-fugrid small { display: block; color: #C9D0F0; font-size: 11px; }
  .sf-num.ch2 { outline: 4px solid #FFD23F; outline-offset: 2px; transform: translateY(-4px); }
  .sf-act { position: absolute; right: 2%; bottom: calc(4% + 92px); display: none; flex-direction: column; gap: 8px; pointer-events: auto; }
  .sf-act button { width: 74px; height: 56px; border-radius: 14px; border: 3px solid #0A0E24; font-family: var(--f-display); font-size: 18px; color: #1D2340; box-shadow: 0 4px 0 rgba(0,0,0,.4); touch-action: manipulation; }
  .sf-act .fire { background: #FFD23F; } .sf-act .no { background: #E9ECF5; font-size: 15px; height: 40px; }
  .sf-stage.charging .sf-act { display: flex; }
  @media (pointer: fine) { .sf-act { display: none !important; } }
  .sf-teamroom { align-items: flex-start; }
  .sf-teams { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
  .sf-tcol { display: grid; gap: 4px; align-content: start; background: #141A3C; border: 2px solid #0A0E24; border-top: 4px solid #4C7BFF; border-radius: 10px; padding: 6px 8px; }
  .sf-tcol.t1 { border-top-color: #E0484E; } .sf-tcol > b { font-size: 14px; }
  .sf-tcol span { font-size: 13px; background: #1F2752; border-radius: 6px; padding: 3px 7px; } .sf-tcol span.mine { box-shadow: 0 0 0 2px #FFD23F inset; } .sf-tcol span.empty { color: #8A93C0; background: transparent; border: 1px dashed #3A4373; }
  .sf-tcol .sf-btn { padding: 4px 8px; font-size: 12px; margin-top: 2px; }
  .sf-ulist { position: absolute; width: 30%; display: grid; gap: 5px; }
  .sf-ulist.foe { text-align: right; }
  .sf-urow .nm { font-size: 14px; text-shadow: 0 2px 2px #000; } .sf-urow .nm small { font-size: 11px; }
  .sf-urow .sf-bar { position: relative; height: 16px; } .sf-urow.ally i { background: linear-gradient(#9FC4FF,#3E6AD9); } .sf-urow.foe i { background: linear-gradient(#FFB86B,#C86A2A); }
  .sf-urow.ally .nm { color: #BFD6FF; } .sf-urow.dead { opacity: .5; }
  .sf-tag { position: absolute; transform: translate(-50%, -100%); font-size: 13px; padding: 1px 7px; border-radius: 6px; background: rgba(10,14,36,.62); white-space: nowrap; }
  .sf-tag.ally { color: #9FC4FF; } .sf-tag.foe { color: #FFA58A; }
  .sf-combo { position: absolute; left: 50%; bottom: 22%; transform: translateX(-50%); font-size: 26px; text-shadow: 0 2px 3px #000; white-space: nowrap; }
  .sf-cross { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border: 2px solid rgba(255,255,255,.8); border-radius: 50%; box-shadow: 0 0 0 1px rgba(0,0,0,.5); }
  .sf-cross::after { content: ''; position: absolute; left: 50%; top: 50%; width: 4px; height: 4px; margin: -2px; background: #FFF; border-radius: 50%; }
  .sf-msg { position: absolute; left: 50%; top: 30%; transform: translateX(-50%); font-size: 40px; text-shadow: 0 3px 4px #000; white-space: nowrap; }
  .sf-over { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(5,8,26,.72); pointer-events: auto; }
  .sf-over .sf-card { text-align: center; min-width: 280px; }
  .sf-joy { position: absolute; left: 3%; bottom: 6%; width: 120px; height: 120px; border-radius: 50%; border: 3px solid rgba(255,255,255,.35); pointer-events: none; display: none; }
  .sf-joy i { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px; border-radius: 50%; background: rgba(255,255,255,.55); }
  @media (pointer: coarse) { .sf-joy { display: block; } .sf-num { width: 56px; height: 56px; } }
  .sf-page .sf-stage:fullscreen { width: 100vw; height: 100vh; max-width: none; border: 0; border-radius: 0; aspect-ratio: auto; }
  @media (max-width: 860px) { .sf-page .sf-lobby { grid-template-columns: 1fr; } .sf-skills { grid-template-columns: repeat(2, 1fr); } }
  @media (max-height: 520px) { .sf-stage { width: min(100%, calc((100svh - 12px) * 1.7778)); } }
  /* v192 대기방: 대결 카드 · 마법 8칸 · 물약 · 조작 */
  .sf-stgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin: 0 0 10px; }
  .sf-stgrid div { background: #141A3C; border: 2px solid #0A0E24; border-radius: 9px; padding: 4px 7px; } .sf-stgrid small { display: block; color: #AEB7E0; font-size: 11px; } .sf-stgrid b { font-family: var(--f-display); font-size: 16px; color: #FFD23F; }
  .sf-note { background: #FFD23F; color: #1D2340; border: 2px solid #0A0E24; border-radius: 10px; padding: 7px 10px; font-size: 13px; margin: 0 0 10px; } .sf-note a { color: #1D2340; font-weight: 700; }
  .sf-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
  .sf-slot { position: relative; background: #1A2148; border: 2px solid #0A0E24; border-top: 5px solid var(--c); border-radius: 10px; padding: 24px 7px 6px; min-height: 78px; }
  .sf-slot .k { position: absolute; left: 5px; top: 3px; background: #FFD23F; color: #1D2340; border-radius: 6px; font-size: 12px; padding: 0 6px; font-weight: 700; }
  .sf-slot b { display: block; font-size: 13px; line-height: 1.25; } .sf-slot small { display: block; color: #AEB7E0; font-size: 11px; line-height: 1.3; }
  .sf-slot.empty { border-top-color: #3A4373; } .sf-slot.empty b { color: #8FD3FF; font-weight: 400; }
  .sf-pots { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
  .sf-pots div { display: flex; align-items: center; gap: 8px; background: #141A3C; border: 2px solid #0A0E24; border-radius: 10px; padding: 6px 9px; font-size: 13px; }
  .sf-pots i { width: 22px; height: 28px; border-radius: 6px 6px 10px 10px; border: 2px solid #0A0E24; flex: none; } .sf-pots .hp i { background: #FF5A5F; } .sf-pots .mp i { background: #3C78F0; }
  .sf-keys { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 13px; color: #DDE3FF; } .sf-keys kbd { background: #FFD23F; color: #1D2340; border-radius: 5px; padding: 0 6px; font: 700 12px/1.6 inherit; font-family: inherit; text-align: center; white-space: nowrap; }
  .sf-room.boss { background: linear-gradient(135deg, #3A1630, #1A2148); } .sf-bgrp { margin-top: 6px; } .sf-bgrp small { display: block; color: #FFD23F; font-size: 12px; margin-bottom: 3px; } .sf-bgrp div { display: flex; flex-wrap: wrap; gap: 4px; }
  .sf-boss { border: 2px solid #0A0E24; border-radius: 9px; background: #5A2A5A; color: #FFFFFF; font: 600 13px/1 inherit; font-family: inherit; padding: 6px 9px; cursor: pointer; } .sf-boss:hover { background: #7A3A7A; } .sf-boss.won { background: #FFD23F; color: #1D2340; }
  .sf-chips { position: absolute; left: 27%; top: 14%; display: flex; gap: 4px; } .sf-chips b { color: #1D2340; border: 2px solid #0A0E24; border-radius: 8px; padding: 0 7px; font-size: 12px; line-height: 18px; }
  .sf-hudpot { position: absolute; left: 2%; bottom: 4%; display: flex; gap: 6px; pointer-events: auto; }
  .sf-hudpot button { position: relative; width: 52px; height: 52px; border-radius: 12px; border: 3px solid #0A0E24; color: #FFFFFF; font: 700 13px/1.1 inherit; font-family: inherit; box-shadow: 0 3px 0 rgba(0,0,0,.4); touch-action: manipulation; }
  .sf-hudpot .hp { background: #D2343A; } .sf-hudpot .mp { background: #2F55D9; } .sf-hudpot .dash { background: #3DDC84; color: #0A0E24; }
  .sf-hudpot button[disabled] { opacity: .45; } .sf-hudpot .cd { position: absolute; inset: 0; border-radius: 9px; background: rgba(10,14,36,.65); display: grid; place-items: center; font-size: 15px; color: #fff; }
  @media (pointer: coarse) { .sf-hudpot { left: 3%; bottom: calc(6% + 130px); } }
  .sf-nums .sf-num.sm { width: 54px; height: 54px; font-size: 22px; }
  .sf-num.ico, .sf-hudpot .ico { background-color: #141A3C !important; image-rendering: auto; }
  .sf-num .kk, .sf-hudpot .kk { position: absolute; left: -6px; top: -8px; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 7px; background: #FFD23F; color: #1D2340; border: 2px solid #0A0E24; font: 700 12px/16px inherit; font-family: inherit; }
  .sf-hudpot .n { position: absolute; right: -6px; bottom: -8px; min-width: 20px; height: 20px; border-radius: 10px; background: #FFFFFF; color: #1D2340; border: 2px solid #0A0E24; font: 700 12px/16px inherit; font-family: inherit; }
  .sf-slot .ic { float: right; width: 34px; height: 34px; border-radius: 8px; border: 2px solid #0A0E24; margin: -18px -3px 2px 4px; }
  .sf-pots i.ic { width: 34px; height: 34px; border: 0; border-radius: 0; } .sf-nums .sf-num.basic { --c: #FFF3B0; --c2: #FFFFFF; }
  @media (pointer: coarse) { .sf-nums { flex-wrap: wrap-reverse; justify-content: flex-end; gap: 24px 8px; max-width: 48%; left: auto; right: 150px; bottom: calc(3% + 12px); transform: none; } .sf-nums .sf-num small { font-size: 10px; max-width: 54px; overflow: hidden; text-overflow: ellipsis; } .sf-nums .sf-num.sm { width: 46px; height: 46px; font-size: 18px; } }`;

  /* ================= 본체 ================= */
  window.GoSCFight = {
    render(el, A) {
      BGM.load(GAME);
      if (!document.getElementById('sfCss')) { const st = document.createElement('style'); st.id = 'sfCss'; st.textContent = CSS; document.head.appendChild(st); }
      el.innerHTML = `<div class="sf-page"><div class="play-head"><a class="back" href="#home">← 게임 목록</a><span class="cat">3D 대결</span><h1>${CFG.name}</h1></div><div id="sfBody"><p class="small">캐릭터를 불러오는 중…</p></div></div>`;
      const body = el.querySelector('#sfBody');
      let alive = true, S = null, LV = 1, CARD = BASIC_CARD(), BOSSES = [], av = null, lobbyCh = null, roomCh = null, rooms = new Map(), myRoom = null, battle = null;
      let isHost = false, roomSize = 2, roomPeers = [], roomHostId = '', seenHost = false, starting = false, joinAt = 0, myPick = null;
      const TEAM = ['청군', '홍군'];
      const nick = () => (Hub.user ? Hub.user.nickname : '손님');
      const modeName = n => (n === 4 ? '2:2' : '1:1');

      /* ---------- 대기방 (왼쪽) + 스킬 고르기 · 스탯 (오른쪽) ---------- */
      function renderLobby() {
        if (!alive) return;
        const ST = CARD.st, cm = S.mode === 4 ? 4 : 2;
        const roomList = [...rooms.values()].filter(r => r.open && r.host !== Hub.clientId && r.code !== myRoom);
        const members = roomPeers.slice().sort((a, b) => (a.at || 0) - (b.at || 0));
        const tcount = t => members.filter(p => p.team === t).length;
        const myRoomHtml = myRoom ? (roomSize === 4
          ? `<div class="sf-room sf-teamroom"><div class="grow"><b>${isHost ? '내 방' : '들어간 방'} ${myRoom} · 2:2 (${members.length}/4)</b><small>${isHost ? '편을 고른 뒤 아래 [대결 시작]을 누르세요. 빈자리는 컴퓨터가 채워요' : '편을 고르고 기다려 주세요. 방장이 [대결 시작]을 누르면 시작해요'}</small>
              <div class="sf-teams">${[0, 1].map(t => `<div class="sf-tcol t${t}"><b>${TEAM[t]} (${tcount(t)}/2)</b>${members.filter(p => p.team === t).map(p => `<span class="${p.id === Hub.clientId ? 'mine' : ''}">${p.nick}${p.id === roomHostId ? ' (방장)' : ''}${p.id === Hub.clientId ? ' · 나' : ''}</span>`).join('')}${Array.from({ length: Math.max(0, 2 - tcount(t)) }, () => '<span class="empty">빈자리 (컴퓨터)</span>').join('')}${myPick !== t ? `<button type="button" class="sf-btn ghost" data-team="${t}" ${tcount(t) >= 2 ? 'disabled' : ''}>${TEAM[t]}으로 옮기기</button>` : ''}</div>`).join('')}</div></div>
              <div class="sf-diff" style="flex-direction:column;align-items:stretch"><button type="button" class="sf-btn ghost" data-close>${isHost ? '방 닫기' : '나가기'}</button></div></div>`
          : `<div class="sf-room"><div class="grow"><b>${isHost ? '내 방' : '들어간 방'} ${myRoom} · 1:1 (${members.length}/2)</b>
            <small>${members.map(p => p.nick + (p.id === roomHostId ? ' (방장)' : '')).join(', ') || '연결 중…'}</small>
            <small>${isHost ? (members.length >= 2 ? '상대가 들어왔어요! 아래 [대결 시작]을 누르세요' : '상대가 들어오기를 기다리는 중…') : '방장이 [대결 시작]을 누르면 시작해요'}</small></div>
            <div class="sf-diff"><button type="button" class="sf-btn ghost" data-close>${isHost ? '방 닫기' : '나가기'}</button></div></div>`)
          : `<div class="sf-room"><div class="grow"><b>온라인 방 만들기</b><small>${Hub.mode === 'online' ? '친구가 아래 방 목록에서 들어와요 · 2:2 는 같은 편끼리 서로 안 맞아요' : '체험 모드: 같은 브라우저의 다른 탭끼리'}</small></div><div class="sf-diff"><button type="button" class="sf-btn" data-make="2">1:1 방</button><button type="button" class="sf-btn" data-make="4">2:2 방</button></div></div>`;
        body.innerHTML = `<div class="sf-lobby">
          <section class="sf-card"><h3>대기방</h3>
            <div class="sf-me"><canvas width="54" height="54" id="sfMe"></canvas><div><b>${nick()}</b><small>skillcom RPG Lv.${LV}${CARD.reb ? ' · 환생 ' + CARD.reb + '회' : ''} · ${S.wins}승 ${S.losses}패</small><small>${CARD.basic ? 'RPG 기록이 없어 Lv.1 기본 카드로 싸워요' : 'RPG 능력치·마법을 그대로 가져와요' + (CARD.at ? ' (' + new Date(CARD.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' 저장)' : '')}</small></div></div>
            <div class="sf-rooms">
              <div class="sf-room cpu"><div class="grow"><b>Skillcom 컴퓨터와 대결</b><small>혼자 연습 · ${cm === 4 ? '2:2 는 내 편 컴퓨터 1명 + 상대 컴퓨터 2명' : '1:1'} · 쉬움 Lv.${Math.max(1, LV - 3)} · 보통 Lv.${LV} · 어려움 Lv.${Math.min(100, LV + 3)}</small>
                <div class="sf-diff" style="justify-content:flex-start;margin-top:6px"><button type="button" class="sf-btn${cm === 2 ? ' on' : ' ghost'}" data-cpumode="2">1:1</button><button type="button" class="sf-btn${cm === 4 ? ' on' : ' ghost'}" data-cpumode="4">2:2</button></div></div>
                <div class="sf-diff">${[['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']].map(([k, n]) => `<button type="button" class="sf-btn${k === S.diff ? ' on' : ' ghost'}" data-diff="${k}" aria-pressed="${k === S.diff}">${n}</button>`).join('')}</div></div>
              ${myRoom ? '' : bossHtml()}
              ${myRoomHtml}
              ${startBar(members)}
              ${roomList.length ? roomList.map(r => { const full = (r.n || 1) >= (r.size || 2); return `<div class="sf-room"><div class="grow"><b>${r.nick}의 방 · ${modeName(r.size || 2)}</b><small>Lv.${r.lv} · ${r.code} · ${r.n || 1}/${r.size || 2}명</small></div><button type="button" class="sf-btn" data-join="${r.code}" ${myRoom || full ? 'disabled' : ''}>${full ? '가득 참' : '들어가기'}</button></div>`; }).join('') : '<p class="sub" style="margin:4px 0 0">지금 열린 방이 없어요.</p>'}
            </div>
          </section>
          <section class="sf-card"><h3>내 대결 카드</h3>
            ${CARD.basic ? `<p class="sf-note">skillcom RPG 를 아직 안 해서 <b>Lv.1 기본 카드</b>(마법 화살 · 파이어볼)로 싸워요. <a href="#rpg">RPG 에서 키우면</a> 레벨·장비·마법이 그대로 들어와요!</p>` : ''}
            <div class="sf-stgrid">${[['공격', ST.atk], ['마력', ST.mag], ['방어', ST.def], ['체력', ST.hp], ['마나', ST.mp], ['이동', '+' + Math.round(ST.spd) + '%'], ['치명타', Math.round(ST.crit) + '%'], ['물리 방어', Math.round(ST.pdef) + '%']].map(([n, v]) => `<div><small>${n}</small><b>${v}</b></div>`).join('')}</div>
            <h3>마법 8칸 <small style="font-size:12px;color:#AEB7E0;font-family:inherit">RPG 마법 창 그대로</small></h3>
            <div class="sf-slots">${CARD.slots.map((q, i) => q ? `<div class="sf-slot" style="--c:${EL[RMAP[q.els[0]]].c}"><span class="k">${SLOTK[i]}</span><i class="ic" style="background:${skIconBg(q)}"></i><b>${A.esc(q.name)}</b><small>${q.els.map(e => RNAME[e]).join('+')} · ${KINDN[q.kind]}</small><small>마나 ${q.mp} · ${q.cd}초</small></div>` : `<div class="sf-slot empty"><span class="k">${SLOTK[i]}</span><b>빈칸</b><small>${i < 4 ? '기본 마법' : '융합 마법'}</small></div>`).join('')}</div>
            <div class="sf-pots"><div class="hp"><i class="ic" style="background:${potBg('hp')}"></i><span><b>F</b> 체력 물약 × 3<br><small style="color:#AEB7E0">판마다 3개 · 가방은 안 줄어요</small></span></div><div class="mp"><i class="ic" style="background:${potBg('mp')}"></i><span><b>G</b> 마나 물약 × 3<br><small style="color:#AEB7E0">판마다 3개 · 가방은 안 줄어요</small></span></div></div>
            <h3>조작</h3>
            <div class="sf-keys"><kbd>S Z X C</kbd><span>앞 · 왼쪽 · 뒤 · 오른쪽 (방향키도 돼요)</span><kbd>1 2 3 4</kbd><span>기본 마법</span><kbd>Q W E R</kbd><span>융합 마법</span><kbd>마우스 왼쪽</kbd><span>기본 공격 (마법 화살)</span><kbd>마우스</kbd><span>둘러보기 (처음 누르면 고정 · Esc 풀기)</span><kbd>F · G</kbd><span>체력 · 마나 물약</span><kbd>Space</kbd><span>대시 (3초마다)</span><kbd>B</kbd><span>1인칭 ↔ 3인칭</span></div>
            <p class="sub" style="margin:10px 0 0">피해는 RPG 결투와 같은 계산(마력 × 위력 − 상대 방어 · 속성 방어 · 치명타)이에요. 레벨이 상대보다 높으면 1당 피해·체력 −1% (최대 −50%) · 회복·방패 마법은 RPG 의 절반</p>
          </section></div>
          <div class="panel" style="margin-top:14px"><h3>랭킹 (승리 수)</h3><ol class="rank" id="sfRank"><li class="empty">불러오는 중…</li></ol></div>`;
        const cv = body.querySelector('#sfMe'); if (cv) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; AV.draw(x, av, 0, 0, 3, { crop: 'bust' }); }
        loadRank();
      }
      // v192 6단계: RPG 보스 도전 칸 — RPG 에서 이긴 보스만 · 누르면 바로 1:1
      function bossHtml() {
        const bw = S.bw || {};
        if (!BOSSES.length) return `<div class="sf-room boss"><div class="grow"><b>⚔ RPG 보스 도전</b><small>skillcom RPG 에서 보스를 이기면 여기서 그 보스와 다시 싸울 수 있어요 (사냥터 보스 · 저승 · 사방신 · 광개토대왕 · 이순신 던전)</small></div></div>`;
        const groups = {}; BOSSES.forEach((b, i) => { (groups[b.tier] = groups[b.tier] || []).push([b, i]); });
        return `<div class="sf-room boss"><div class="grow"><b>⚔ RPG 보스 도전 <small style="display:inline">· 이긴 보스 ${BOSSES.length}명 · 누르면 1:1 시작</small></b>
          ${Object.keys(groups).map(t => `<div class="sf-bgrp"><small>${BOSS_TIER[t].n}</small><div>${groups[t].map(([b, i]) => `<button type="button" class="sf-boss${bw[b.name] ? ' won' : ''}" data-boss="${i}" title="RPG 에서 Lv.${b.lv} 로 이김">${bw[b.name] ? '★ ' : ''}${A.esc(b.name)}</button>`).join('')}</div></div>`).join('')}</div></div>`;
      }
      function startBoss(i) {
        const b = BOSSES[i]; if (!b) return; const T = BOSS_TIER[b.tier] || BOSS_TIER.field, st = scaleSt(CARD.st, 0.8 * T.k);   // v197 보스 공격 = 내 카드 × 0.8 × 등급
        st.hp = Math.round(CARD.st.hp * T.k * (CFG.bossHp || 2.5) * T.k);   // v198 고침: 이 줄이 위 주석 뒤에 붙어 보스 체력이 내 체력 정도였음 → 내 체력 × 등급 × 2.5 × 등급 (v196 과 같게)
        const ros = [{ id: Hub.clientId, team: 0 }, { id: 'boss', cpu: true, boss: b.name, tier: b.tier, team: 1, nick: b.name, lv: LV, st, kit: bossKit(b.def, b.tier === 'field' ? Math.min(100, Math.max(LV, b.lv)) : 100), diff: 'hard' }];
        startBattle({ cpu: true, diff: 'hard', boss: i, size: 2, roster: ros, arena: (window.__GOGO_QA && window.__GOGO_QA.scfArena) || pick(ARENA_IDS) });
      }

      // v55: 맨 아래 큰 [시작] 버튼 — 방이 없으면 컴퓨터와 대결, 방에 있으면 방장이 대결 시작
      function startBar(members) {
        const DN = { easy: '쉬움', normal: '보통', hard: '어려움' }, cm = S.mode === 4 ? '2:2' : '1:1';
        if (!myRoom) return `<button type="button" class="sf-go" data-go>▶ 컴퓨터와 대결 시작 <small>${cm} · ${DN[S.diff] || '보통'}</small></button>`;
        if (!isHost) return `<button type="button" class="sf-go" disabled>방장이 시작하기를 기다리는 중…</button>`;
        const ok = members.length >= 2;
        return `<button type="button" class="sf-go" data-fill ${ok ? '' : 'disabled'}>${ok ? '▶ 대결 시작' : '상대를 기다리는 중…'} <small>${modeName(roomSize)} · ${members.length}/${roomSize}명${roomSize === 4 && members.length < 4 ? ' · 빈자리는 컴퓨터' : ''}</small></button>`;
      }
      async function loadRank() {
        const rk = body.querySelector('#sfRank'); if (!rk) return;
        try { const rows = await Hub.leaderboard(GAME, 10); if (!rk.isConnected) return; rk.innerHTML = A.rankItems(rows, 'best_score', GAME); AV.paintAll(rk); } catch (e) { rk.innerHTML = '<li class="empty">랭킹을 불러오지 못했어요.</li>'; }
      }
      const need4 = () => true;   // v192 스킬 고르기 없앰 (RPG 마법 8칸 그대로)
      body.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b || b.disabled || battle) return; const d = b.dataset;
        if (d.boss != null && d.boss !== '') startBoss(+d.boss);
        else if (d.cpumode) { S.mode = +d.cpumode === 4 ? 4 : 2; saveRow(S); renderLobby(); }
        else if (d.diff) { S.diff = d.diff; saveRow(S); renderLobby(); }
        else if ('go' in d) { if (need4()) startCpu(S.diff || 'normal'); }
        else if (d.make) makeRoom(+d.make === 4 ? 4 : 2);
        else if ('fill' in d) hostStart();
        else if (d.team) pickTeam(+d.team);
        else if ('close' in d) closeRoom();
        else if (d.join) joinRoom(d.join);
      });

      /* ---------- 컴퓨터와 대결 (1:1 · 2:2) ---------- */
      const DIFFS = { easy: { lv: -3, cast: 1.6, lead: 0.2, aim: 0.09, k: 0.6, n: '쉬움' }, normal: { lv: 0, cast: 1.15, lead: 0.6, aim: 0.03, k: 0.8, n: '보통' }, hard: { lv: 3, cast: 0.85, lead: 0.95, aim: 0.012, k: 1.0, n: '어려움' } };   // v192 k = 컴퓨터 능력치 = 내 카드 × k
      // 컴퓨터 = Skillcom 장수 7명 중 한 명 (한 판에 겹치지 않게). 이름 뒤에 난이도
      function cpuEntry(i, team, lv, diff, tail, ally, used) {
        const left = HERO_IDS.filter(h => !(used || []).includes(h)), QA = window.__forceHeroes, hero = QA && QA.length ? QA.shift() : pick(left.length ? left : HERO_IDS);   // __forceHeroes = 점검용 if (used) used.push(hero);
        const D = DIFFS[diff] || DIFFS.normal;
        return { id: 'cpu' + i, cpu: true, team, hero, nick: HEROES[hero] + (tail ? ' ' + tail : ''), lv, av: makeEnemyAvatar(ally ? 'ally' : i), st: scaleSt(CARD.st, ally ? 0.95 : D.k), kit: cpuKit(hero, lv), diff };
      }
      function startCpu(diff) {
        const D = DIFFS[diff] || DIFFS.normal, lv = clamp(LV + D.lv, 1, 100), four = S.mode === 4, used = [];
        const ros = [{ id: Hub.clientId, team: 0 }];
        if (four) ros.push(cpuEntry(0, 0, LV, 'normal', '', true, used));
        ros.push(cpuEntry(1, 1, lv, diff, '(' + D.n + ')', false, used));
        if (four) ros.push(cpuEntry(2, 1, lv, diff, '(' + D.n + ')', false, used));
        startBattle({ cpu: true, diff, size: four ? 4 : 2, roster: ros, arena: (window.__GOGO_QA && window.__GOGO_QA.scfArena) || pick(ARENA_IDS) });
      }

      /* ---------- 온라인 방 (1:1 = 2명 · 2:2 = 4명, 모자라면 방장이 컴퓨터로 채움) ---------- */
      function lobby() {
        if (lobbyCh) return;
        lobbyCh = Hub.channel('scf-lobby', { onPeers: list => { rooms = new Map(); (list || []).forEach(s => { if (s && s.code) rooms.set(s.code, s); }); if (!battle && !starting) renderLobby(); }, onMsg() {} });
        lobbyCh.track({ id: Hub.clientId });
      }
      const myInfo = () => ({ id: Hub.clientId, nick: nick(), lv: LV, av, st: CARD.st, at: joinAt, team: myPick });
      function pickTeam(t) { if (!roomCh || battle) return; if (roomPeers.filter(p => p.team === t && p.id !== Hub.clientId).length >= 2) { A.toast(TEAM[t] + '이 가득 찼어요'); return; } myPick = t; roomCh.track(myInfo()); renderLobby(); }
      const roomInfo = () => ({ id: Hub.clientId, code: myRoom, host: Hub.clientId, nick: nick(), lv: LV, open: true, size: roomSize, n: Math.max(1, roomPeers.length) });
      function makeRoom(size) {
        if (!need4()) return;
        myRoom = Math.random().toString(36).slice(2, 7).toUpperCase(); isHost = true; roomSize = size; roomHostId = Hub.clientId; roomPeers = []; myPick = 0;
        lobbyCh.track(roomInfo()); openRoom(myRoom); renderLobby();
      }
      function closeRoom() { if (roomCh) { roomCh.leave(); roomCh = null; } myRoom = null; isHost = false; roomPeers = []; seenHost = false; starting = false; myPick = null; lobbyCh && lobbyCh.track({ id: Hub.clientId }); renderLobby(); }
      function joinRoom(code) {
        if (!need4()) return; const r = rooms.get(code); if (!r) return;
        myRoom = code; isHost = false; roomSize = r.size === 4 ? 4 : 2; roomHostId = r.host; seenHost = false; roomPeers = []; myPick = null; openRoom(code); renderLobby();
      }
      function openRoom(code) {
        joinAt = Date.now();
        roomCh = Hub.channel('scf-room-' + code, {
          onPeers: list => {
            roomPeers = (list || []).filter(p => p && p.id);
            if (battle) { battle.onPeers && battle.onPeers(roomPeers); return; }
            if (starting) return;
            if (myPick === null && roomPeers.some(p => p.id !== Hub.clientId)) {   // 처음 들어오면 사람이 적은 편으로
              const c = t => roomPeers.filter(p => p.id !== Hub.clientId && p.team === t).length; myPick = c(1) < c(0) ? 1 : 0; roomCh.track(myInfo());
            } else if (roomSize === 4 && myPick !== null) {   // 동시에 들어와 한 편이 3명이 되면 늦게 온 사람이 다른 편으로
              const same = roomPeers.filter(p => p.team === myPick).sort((x, y) => (x.at || 0) - (y.at || 0));
              if (same.length > 2 && same.slice(2).some(p => p.id === Hub.clientId) && roomPeers.filter(p => p.team === 1 - myPick).length < 2) { myPick = 1 - myPick; roomCh.track(myInfo()); }
            }
            if (isHost) lobbyCh.track(roomInfo());   // v55: 1:1 도 방장이 [대결 시작] 을 눌러야 시작
            else { const hostHere = roomPeers.some(p => p.id === roomHostId); if (hostHere) seenHost = true; else if (seenHost) { A.toast('방장이 방을 닫았어요'); closeRoom(); return; } }
            renderLobby();
          },
          onMsg: m => {
            if (!m) return;
            if (m.t === 'start') { if (!isHost && !battle && !starting) guestStart(m); return; }
            if (battle && battle.net) battle.onMsg(m);
          }
        });
        roomCh.track(myInfo());
      }
      function hostStart() {
        if (starting || battle || !roomCh) return; starting = true;
        const hum = roomPeers.slice().sort((a, b) => (a.id === Hub.clientId ? -1 : b.id === Hub.clientId ? 1 : (a.at || 0) - (b.at || 0))).slice(0, roomSize);
        const cnt = [0, 0], half = roomSize / 2;
        const ros = hum.map((p, i) => {   // 2:2 = 각자 고른 편 (넘치면 다른 편으로) · 1:1 = 방장 청군, 상대 홍군
          let t = roomSize === 2 ? i % 2 : (p.team === 0 || p.team === 1 ? p.team : (cnt[0] <= cnt[1] ? 0 : 1)); if (cnt[t] >= half) t = 1 - t; cnt[t]++;
          return { id: p.id, uid: p.uid || null, nick: String(p.nick || '').slice(0, 12), lv: clamp(+p.lv || 1, 1, 100), av: p.av, st: normSt(p.st), team: t };
        });
        const lv = Math.round(ros.reduce((a, r) => a + r.lv, 0) / ros.length), used = []; let k = 0;
        [0, 1].forEach(t => { while (cnt[t] < half) { cnt[t]++; ros.push(Object.assign(cpuEntry(++k, t, lv, 'normal', '(컴퓨터)', false, used), { owner: Hub.clientId })); } });
        const arena = pick(ARENA_IDS), msg = { t: 'start', from: Hub.clientId, size: roomSize, roster: ros, arena };
        roomCh.send(msg); setTimeout(() => { if (roomCh) roomCh.send(msg); }, 900);   // 혹시 못 받은 사람을 위해 한 번 더
        lobbyCh.track({ id: Hub.clientId });
        startBattle({ net: true, host: true, size: roomSize, roster: ros, arena });
      }
      function guestStart(m) {
        if (!(m.roster || []).some(r => r.id === Hub.clientId && !r.cpu)) { A.toast('방이 가득 차서 못 들어갔어요'); closeRoom(); return; }
        starting = true;
        startBattle({ net: true, host: false, size: m.size, roster: m.roster, arena: ARENAS[m.arena] ? m.arena : 'wall' });
      }

      /* ================= 3D 대결 ================= */
      async function startBattle(opt) {
        starting = true; let THREE;
        try { THREE = await loadThree(); } catch (e) { starting = false; A.toast('3D 엔진을 불러오지 못했어요. 새로고침해 주세요'); return; }
        if (!alive) return;
        // 전장 · 장수 3D 파일 미리 받기 (최대 12초 — 늦거나 없으면 예전 모양으로 그냥 시작)
        if (!ARENAS[opt.arena]) opt.arena = 'wall';
        body.innerHTML = `<div class="sf-card" style="text-align:center;padding:40px 14px"><h3 style="justify-content:center">${ARENAS[opt.arena]} 전장으로 가는 중…</h3><p class="sub">장수와 전장을 불러오고 있어요</p></div>`;
        const heroes = [...new Set(opt.roster.filter(r => r.cpu && HEROES[r.hero]).map(r => r.hero))];
        const names = heroes.map(h => 'hero_' + h).concat(PROPS[opt.arena], Object.values(FX));
        const got = await withTimeout(Promise.all([Promise.all(names.map(asset)), skyTex(THREE, opt.arena)]), 12000);
        if (!alive) return;
        const pre = { gl: {}, sky: got ? got[1] : null }; if (got) names.forEach((n, i) => { pre.gl[n] = got[0][i]; });
        opt.pre = pre;
        try { battle = makeBattle(THREE, opt); }
        catch (e) {   // 혹시 대결 화면을 못 만들면 '불러오는 중' 화면에 갇히지 않게 대기방으로
          battle = null; starting = false; if (window.console) console.error(e);
          A.toast('대결을 시작하지 못했어요. 다시 눌러 주세요'); renderLobby(); return;
        }
        starting = false;
      }

      function makeBattle(THREE, opt) {
        body.innerHTML = `<div class="sf-stage" id="sfStage" tabindex="0"><canvas id="sfCv"></canvas><div class="sf-hud">
          <div class="sf-name" style="left:2%;top:3%">${nick()} <small>Lv.${LV}</small></div><div class="sf-bar" style="left:2%;top:9%;width:30%"><i id="sfHp" style="background:linear-gradient(#FF7A7E,#D2343A);width:100%"></i><span id="sfHpT"></span></div>
          <div class="sf-bar" style="left:2%;top:14.5%;width:24%;height:15px"><i id="sfMp" style="background:linear-gradient(#7FA0FF,#2F55D9);width:100%"></i><span id="sfMpT"></span></div>
          <div class="sf-chips" id="sfChips"></div><div class="sf-ulist" id="sfAllies" style="left:2%;top:19%"></div><div class="sf-ulist foe" id="sfFoes" style="right:2%;top:3%"></div><div id="sfTags"></div>
          <div class="sf-hurt" id="sfHurt"></div><div class="sf-cross" id="sfCross"></div><div class="sf-combo" id="sfCombo"></div><div class="sf-msg" id="sfMsg"></div>
          <button type="button" class="sf-btn ghost sf-view" id="sfView">시점: ${(S.view || 1)}인칭 (B)</button>
          <button type="button" class="sf-btn ghost sf-full" id="sfFull" aria-label="화면 크게 보기"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>
          <div class="sf-joy" id="sfJoy"><i></i></div>
          <div class="sf-hudpot"><button type="button" class="hp ico" id="sfPotH" style="background:${potBg('hp')}"><b class="kk">F</b><span class="n">3</span></button><button type="button" class="mp ico" id="sfPotM" style="background:${potBg('mp')}"><b class="kk">G</b><span class="n">3</span></button><button type="button" class="dash" id="sfDash">대시</button></div>
          <div class="sf-nums">${CARD.slots.map((q, i) => q ? `<button type="button" class="sf-num sm ico" data-slot="${i}" style="background:${skIconBg(q)}"><b class="kk">${SLOTK[i]}</b><small>${A.esc(q.name)}</small></button>` : '').join('')}<button type="button" class="sf-num sm ico basic" data-basic="1" style="background:${skIconBg(ARROW)}"><b class="kk">🖱</b><small>기본 공격</small></button></div>
        </div></div><p class="small" style="text-align:center;margin-top:8px">${modeName(opt.size)} 대결 · 화면을 한 번 누르면 마우스로 둘러봐요 (Esc 로 풀기) · S Z X C 이동 · 1~4 QWER 마법 · 마우스 왼쪽 기본 공격 · F G 물약 · Space 대시 · B 시점${opt.size === 4 ? ' · 같은 편(파란 이름)은 안 맞아요' : ''}</p>`;
        const stage = body.querySelector('#sfStage'), cv = body.querySelector('#sfCv'), $h = id => body.querySelector('#' + id);
        const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.shadowMap.enabled = true;
        const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 300);
        const size = () => { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix(); fitNums(); };
        function fitNums() {   // v198 마법 칸이 물약·대시 · 시점 버튼과 겹치지 않게 (화면이 좁으면 가운데 빈자리에 맞춰 줄임)
          const nb = stage.querySelector('.sf-nums'), pb = stage.querySelector('.sf-hudpot'), vb = stage.querySelector('.sf-view'); if (!nb || !pb || !vb) return;
          nb.style.left = ''; nb.style.transform = ''; if (matchMedia('(pointer: coarse)').matches) return;
          const r = stage.getBoundingClientRect(), a = pb.getBoundingClientRect().right - r.left + 14, b = vb.getBoundingClientRect().left - r.left - 14, need = nb.scrollWidth + 12;
          const k = Math.min(1, (b - a) / need); nb.style.left = ((a + b) / 2) + 'px'; nb.style.transformOrigin = '50% 100%'; nb.style.transform = `translateX(-50%) scale(${Math.max(0.6, k).toFixed(3)})`;
        }
        size(); const onRs = () => size(); window.addEventListener('resize', onRs);
        if (matchMedia('(pointer: coarse)').matches) { try { stage.scrollIntoView({ block: 'center' }); } catch (e) { /* noop */ } }
        const pre = opt.pre || { gl: {} };
        buildArena(THREE, scene, opt.arena, pre);

        /* --- 몸 (아바타 도트 → 3D 블록) --- */
        /* v120 선생님 11/12 "도트 아바타는 안 나오게": 사람 몸 = 새 몸 그림(앞·뒤)을 붙인 판 두 장 (예전: 도트 칸 → 3D 블록)
         *  걸을 때는 사이트 아바타처럼 부드럽게 걷는 그림으로 다시 그림 (userData.walk(위상 | null)) */
        function voxel(avatar, tint) {
          const av = AV.normalize(avatar), grp = new THREE.Group(), H = 1.8, Wd = H * AV.size.w / AV.size.h;
          const mk2 = view => {
            const cvs = document.createElement('canvas'), tex = new THREE.CanvasTexture(cvs);
            if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
            const o = { scale: 8, body: true, view, keepCss: true };
            const draw = walk => { o.walk = walk; AV.paint(cvs, av, o); if (tint) { const x = cvs.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = tint; x.globalAlpha = 0.12; x.fillRect(0, 0, cvs.width, cvs.height); x.restore(); } tex.needsUpdate = true; };
            o.onBody = () => draw(o.walk);
            draw(null);
            const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.35 });
            const m = new THREE.Mesh(new THREE.PlaneGeometry(Wd, H), mat); m.position.y = H / 2; m.castShadow = true;
            grp.add(m); return { m, draw };
          };
          const F = mk2('f'), Bk = mk2('b'), Sd = mk2('s');
          /* 판은 늘 카메라를 봄(빌보드). 몸이 보는 방향과 카메라 방향을 비교해 앞·뒤·옆(좌우 뒤집기) 그림을 고름 → RPG 처럼 4방향 */
          grp.userData.bill = (yaw, cx, cz, dead) => {
            const dx = cx - grp.position.x, dz = cz - grp.position.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
            const fx = Math.sin(yaw + Math.PI), fz = Math.cos(yaw + Math.PI), dot = fx * ux + fz * uz, right = fx * uz - fz * ux;
            const v = dot > 0.7 ? 'f' : dot < -0.7 ? 'b' : 's';
            F.m.visible = v === 'f'; Bk.m.visible = v === 'b'; Sd.m.visible = v === 's'; Sd.m.scale.x = right > 0 ? 1 : -1;
            grp.rotation.set(dead ? -Math.PI / 2 : 0, Math.atan2(ux, uz), 0, 'YXZ');
          };
          F.m.visible = true; Bk.m.visible = false; Sd.m.visible = false;
          let lastW = null, lastT = 0;
          grp.userData.walk = ph => {   // 걷기: 1/20초마다 다시 그림 · 멈추면 서 있는 그림
            const now = performance.now();
            if (ph == null) { if (lastW != null) { lastW = null; F.draw(null); Bk.draw(null); Sd.draw(null); } return; }
            if (now - lastT < 50) return; lastT = now; lastW = ph; F.draw(ph); Bk.draw(ph); Sd.draw(ph);
          };
          const sh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; grp.add(sh);
          grp.userData.body = F.m; return grp;
        }
        function skinnedBox(THREE, root, clip) {
          if (clip) { const mx = new THREE.AnimationMixer(root); mx.clipAction(clip).play(); mx.update(0); }
          root.updateMatrixWorld(true);
          const bx = new THREE.Box3(), v = new THREE.Vector3();
          root.traverse(o => {
            if (!o.isSkinnedMesh) return; o.skeleton.update(); const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 1500));
            for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); bx.expandByPoint(v); }
          });
          if (bx.isEmpty()) bx.setFromObject(root);
          return bx;
        }
        /* --- v192 RPG 보스 몸: RPG 그림을 세운 판(늘 카메라를 봄) · 자세 그림이 있으면 공격·마법·맞음 때 바꿈 · 크기는 등급마다 --- */
        function bossBody(U, name) {
          const bd = bossDefs()[name]; if (!bd) return null;
          const def = bd.def, fr = bossFrames(def), H = bd.tier === 'sasin' ? 4.6 : bd.tier === 'king' || bd.tier === 'hell' || bd.tier === 'ysBoss' ? 3.6 : 3.1;
          const grp = new THREE.Group(), tex = {}, mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
          const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); grp.add(plane); plane.visible = false;
          const fit = t => { const im = t.image; if (!im || !im.width) return; const w = H * im.width / im.height; plane.scale.set(w, H, 1); plane.position.y = H / 2; };
          const loader = new THREE.TextureLoader();
          Object.keys(fr).forEach(k => { const n = fr[k]; if (!n) return; tex[k] = loader.load(RPG_IMG + 'v79/' + n + '.png?v=80', t => { if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; if (k === 'idle') { mat.map = t; mat.needsUpdate = true; fit(t); plane.visible = true; } }); });
          let cur = 'idle', until = 0;
          const show = k => { const t = tex[k] || tex.idle; if (!t || !t.image || !t.image.width || mat.map === t) return; mat.map = t; mat.needsUpdate = true; fit(t); };
          U.act = n => { const k = n === 'hit' ? 'hit' : n === 'cast' || n === 'fuse' ? (tex.cast ? 'cast' : 'atk') : n === 'die' ? 'hit' : null; if (!k || !tex[k]) return; cur = k; until = B ? B.t + (n === 'hit' ? 0.25 : 0.45) : 0; show(k); };
          const sh = new THREE.Mesh(new THREE.CircleGeometry(H * 0.28, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; grp.add(sh);
          grp.userData.bill = (yaw, cx, cz, dead) => {   // 카메라를 봄 · 보스가 보는 쪽(상대 쪽)에 맞춰 좌우 뒤집기 (RPG 그림은 오른쪽을 봄)
            const dx = cx - grp.position.x, dz = cz - grp.position.z; grp.rotation.set(dead ? -Math.PI / 2 : 0, Math.atan2(dx, dz), 0, 'YXZ');
            const fx = -Math.sin(yaw), fz = -Math.cos(yaw), L = Math.hypot(dx, dz) || 1, right = fx * (dz / L) - fz * (dx / L);
            plane.scale.x = Math.abs(plane.scale.x) * (right > 0 ? -1 : 1);
            if (cur !== 'idle' && B && B.t > until) { cur = 'idle'; show('idle'); }
            if (U.hp < U.lastHp - 0.5 && !dead && cur === 'idle') U.act('hit');
          };
          U.rad = H * 0.22; U.hh = H * 0.45; U.big = true;
          return grp;
        }
        /* --- Skillcom 장수 3D 몸 (Meshy) + 움직임. U.act('cast') 처럼 한 번 하는 동작을 틀고, 끝나면 대기·걷기로 --- */
        function heroBody(U, hero) {
          const g = pre.gl['hero_' + hero]; if (!g || !THREE.cloneSkinned) return null;
          const model = THREE.cloneSkinned(g.scene), grp = new THREE.Group();
          // 뼈로 움직이는 몸은 그림 상자 크기가 실제와 달라서, 서 있는 자세의 꼭짓점을 직접 재서 키 1.85m 로 맞춤
          const box = skinnedBox(THREE, model, g.animations.find(c => c.name === 'idle')), h = box.max.y - box.min.y || 1, k = 1.85 / h;
          model.scale.setScalar(k); model.position.y = -box.min.y * k; model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; const m = o.material = o.material.clone(); if ('metalness' in m) { m.metalness = 0; m.metalnessMap = null; m.roughness = 0.85; } } });   // 금속 반사 없이 (환경 그림이 없어 금속은 까맣게 나옴)
          grp.add(model);
          const sh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; grp.add(sh);
          const mixer = new THREE.AnimationMixer(model), acts = {};
          g.animations.forEach(c => { acts[c.name] = mixer.clipAction(c); });
          ['cast', 'fuse', 'hit', 'die', 'win'].forEach(n => { const a = acts[n]; if (a) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } });
          let cur = null, busy = 0;
          const play = (n, fade) => { const a = acts[n]; if (!a || cur === a) return; a.reset().setEffectiveWeight(1).fadeIn(fade || 0.2).play(); if (cur) cur.fadeOut(fade || 0.2); cur = a; };
          U.hero = hero;
          U.act = n => { if (U.dead && n !== 'die') return; const a = acts[n] || (n === 'fuse' && acts.cast); if (!a) return; play(acts[n] ? n : 'cast', n === 'hit' ? 0.1 : 0.15); busy = n === 'die' || n === 'win' ? 1e9 : Math.min(a.getClip().duration, n === 'hit' ? 0.6 : 1.2); };
          U.anim = (dt, moving) => { mixer.update(dt); if (busy > 0) { busy -= dt; return; } if (!U.dead) play(moving ? 'walk' : 'idle'); };
          play('idle', 0); grp.userData.hero = true;
          return grp;
        }

        /* --- 참가자 (나 · 같은 편 · 상대). own = 이 기기가 움직이고 체력을 정하는 몸 (나 + 컴퓨터 대결의 컴퓨터 + 온라인 방장이 맡은 컴퓨터) --- */
        const ros = opt.roster, myR = ros.find(r => r.id === Hub.clientId && !r.cpu), myTeam = myR.team;
        const teamIdx = {}, units = ros.map(r => {
          const isMe = r === myR, F = cardF(isMe ? CARD.st : normSt(r.st)),   /* v192 능력치 = RPG 대결 카드 (컴퓨터 = 내 카드 × 난이도) */ k = teamIdx[r.team] = (teamIdx[r.team] || 0) + 1, inTeam = ros.filter(q => q.team === r.team).length;
          const x = inTeam > 1 ? (k === 1 ? -3 : 3) * (r.team ? -1 : 1) : 0, z = r.team ? -8 : 8;
          const U = { id: r.id, uid: r.uid || null, me: isMe, cpu: !!r.cpu, owner: r.owner || '', team: r.team, nick: isMe ? nick() : String(r.nick || ''), lv: isMe ? LV : clamp(+r.lv || 1, 1, 100), sps: r.cpu ? (Array.isArray(r.kit) ? r.kit : cpuKit(r.hero, r.lv || 1)).filter(id => RPG_SKID[id]).map(id => slotSpell(RPG_SKID[id])) : [], bossName: r.boss ? String(r.boss) : null,
            x, z, y: 0, vy: 0, tx: x, tz: z, px: x, pz: z, vx: 0, vz: 0, yaw: r.team ? Math.PI : 0, pitch: 0, hp: F.hp, mp: F.mp, F, cds: {}, slow: 0, burn: 0, dead: false,
            own: isMe || (!!r.cpu && (opt.cpu || opt.host)), ai: r.cpu ? { t: 1.5, move: 0, strafe: 1, D: DIFFS[r.diff] || DIFFS.normal } : null };
          U.mesh = (r.boss && bossBody(U, r.boss)) || (r.cpu && heroBody(U, r.hero)) || voxel(isMe ? av : r.av, r.cpu && r.team !== myTeam ? '#3A2050' : null); scene.add(U.mesh);
          U.lastHp = U.hp;
          return U;
        });
        const me = units.find(u => u.me), byId = {}; units.forEach(u => { byId[u.id] = u; });
        // v192 레벨 보정 (선생님 결정 '보통'): 상대 편 평균보다 레벨이 높으면 1당 피해·체력 −1% (최대 −50%)
        units.forEach(U => { const fs = units.filter(o => o.team !== U.team), avg = fs.reduce((a, o) => a + o.lv, 0) / Math.max(1, fs.length); U.F.pen = clamp((U.lv - avg) * LVPEN, 0, LVPENMAX); U.F.hp = Math.max(1, Math.round(U.F.hp * (1 - U.F.pen))); U.hp = U.F.hp; U.mp = U.F.mp; U.lastHp = U.hp; });
        const ally = u => u.team === me.team, foes = () => units.filter(u => !ally(u)), anyLeft = { v: false };
        // 이름표 (머리 위) + 체력 줄 (왼쪽 = 같은 편, 오른쪽 = 상대)
        units.forEach(u => {
          if (u.me) return;
          const row = document.createElement('div'); row.className = 'sf-urow ' + (ally(u) ? 'ally' : 'foe');
          row.innerHTML = `<div class="nm">${u.nick} <small>Lv.${u.lv}</small></div><div class="sf-bar"><i></i><span></span></div>`;
          $h(ally(u) ? 'sfAllies' : 'sfFoes').appendChild(row); u.bar = row.querySelector('i'); u.barT = row.querySelector('span'); u.row = row;
          const tag = document.createElement('div'); tag.className = 'sf-tag ' + (ally(u) ? 'ally' : 'foe'); tag.textContent = (ally(u) ? '내 편 ' : '') + u.nick; $h('sfTags').appendChild(tag); u.tag = tag;
        });
        const B = { net: !!opt.net, over: false, shots: [], parts: [], fx: [], seq: 0, view: S.view || 1, keys: {}, ch: null, t: 0, sendT: 0, joy: null, look: null, lock: false };

        /* --- 마법 쓰기 --- */
        function fwd(yaw, pitch) { return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); }
        /* v192 3단계 마법: cast(U, sp, 조준, remote, key) — sp = 마법 정의(RPG 모양 kind) · 조준 = { dir(방향), pt(바닥 점) }
         *  피해 = RPG 결투와 같게: 쏜 쪽이 방어 전 피해(raw)를 정하고(마력×위력·주는 피해%·땅 ×1.2·치명타·×0.5·레벨 보정), 맞은 몸을 맡은 기기가 방어·속성 방어·방패로 줄여서 받음 */
        const pack = sp => ({ name: sp.name, id: sp.id, els: sp.els, kind: sp.kind, pow: sp.pow, count: sp.count, pierce: sp.pierce, speed: sp.speed, radius: sp.radius, len: sp.len, w: sp.w, dur: sp.dur, basic: !!sp.basic });
        function unpack(o) {   // 다른 기기가 보낸 마법 (믿을 수 있는 값으로)
          if (!o || !Array.isArray(o.els)) return null; const els = o.els.filter(e => RNAME[e]).slice(0, 2); if (!els.length) return null;
          return { name: String(o.name || '').slice(0, 14), id: String(o.id || '').slice(0, 40), els, kind: KINDN[o.kind] ? o.kind : 'bolt', pow: num(o.pow, 0, 20, 1), count: Math.round(num(o.count, 0, 12, 0)), pierce: !!o.pierce, speed: num(o.speed, 0.3, 4, 1), radius: num(o.radius, 0, 400, 0), len: num(o.len, 0, 600, 0), w: num(o.w, 0, 200, 0), dur: num(o.dur, 0, 20, 0), basic: !!o.basic, fused: els.length > 1 };
        }
        function rawDmg(U, sp) {
          const F = U.F; let raw = (sp.basic ? F.atk * 0.6 + F.mag * 0.5 : F.mag * sp.pow) * rand(0.9, 1.1) * (1 + (F.dmg || 0) / 100);
          if (sp.els.includes('earth')) raw *= 1.2;
          const crit = Math.random() < F.crit / 100; if (crit) raw *= F.critD || 1.6;
          return { raw: Math.max(1, Math.round(raw * DMUL * (1 - F.pen))), crit };
        }
        // 조준: PC = 화면 가운데 조준점이 가리키는 곳 (바닥에 닿으면 그 점, 아니면 40m 앞) · 휴대폰 = 가장 가까운 상대
        const coarse = matchMedia('(pointer: coarse)').matches;
        function myAim() {
          const near = () => { let T = null, d = 1e9; units.forEach(o => { if (o.team !== me.team && !o.dead) { const dd = Math.hypot(o.x - me.x, o.z - me.z); if (dd < d) { d = dd; T = o; } } }); return T; };
          if (coarse) { const T = near(); if (T) { me.yaw = Math.atan2(-(T.x - me.x), -(T.z - me.z)); return { pt: new THREE.Vector3(T.x, 0, T.z), h: 1.1 }; } }
          const dir = new THREE.Vector3(); cam.getWorldDirection(dir); const o = cam.position;
          if (dir.y < -0.02) { const t = -o.y / dir.y; if (t < 40) return { pt: new THREE.Vector3(o.x + dir.x * t, 0, o.z + dir.z * t), h: 1.0, floor: true }; }
          const p = o.clone().addScaledVector(dir, 40); return { pt: new THREE.Vector3(p.x, 0, p.z), h: clamp(p.y, 0.4, 8), far: true };
        }
        const flatTo = (U, pt) => { const v = new THREE.Vector3(pt.x - U.x, 0, pt.z - U.z); if (v.lengthSq() < 1e-4) v.copy(fwd(U.yaw, 0)).setY(0); return v.normalize(); };
        function clampPt(U, pt, max) {   // 마법 비·늪 자리: 몸에서 최대 max m · 마당 안
          const v = new THREE.Vector3(pt.x - U.x, 0, pt.z - U.z), l = v.length(); if (l > max) v.multiplyScalar(max / l);
          const p = new THREE.Vector3(U.x + v.x, 0, U.z + v.z), L = Math.hypot(p.x, p.z), R = ARENA - 0.8; if (L > R) p.multiplyScalar(R / L); return p;
        }
        function cast(U, sp, aim, remote, key, net) {
          if (U.dead || !sp) return false;
          if (!remote) {
            if ((U.cds[key] || 0) > 0) return false;
            if (U.mp < sp.mp) { if (U.me) flash('마나가 부족해요'); return false; }
            U.mp -= sp.mp; U.cds[key] = sp.cd;
          }
          aim = aim || (U.me ? myAim() : { pt: new THREE.Vector3(U.x, 0, U.z).add(fwd(U.yaw, 0).multiplyScalar(10)), h: 1.1 });
          const dmg = remote ? { raw: clamp(+net.raw || 0, 0, 1e7), crit: !!net.crit } : rawDmg(U, sp), cid = remote ? String(net.cid || '') : U.id + ':' + (++B.seq);
          if (!remote && B.net && U.own) send({ t: 'c', id: U.id, s: pack(sp), raw: dmg.raw, crit: dmg.crit ? 1 : 0, cid, p: [+aim.pt.x.toFixed(2), +aim.pt.z.toFixed(2), +(aim.h || 1).toFixed(2)], y: +U.yaw.toFixed(3) });
          const C = { U, sp, raw: dmg.raw, crit: dmg.crit, cid, team: U.team, els: sp.els, col: EL[sp.els[0]].c, col2: EL[sp.els[sp.els.length - 1]].c2 };
          const k = sp.kind, o = new THREE.Vector3(U.x, U.y + 1.3, U.z), fd = flatTo(U, aim.pt);
          if (k === 'heal' || k === 'shield') {   // 회복·방패 = RPG 의 절반 (선생님 결정)
            if (U.own) {
              if (k === 'heal') { const h = Math.min(U.F.hp - U.hp, Math.round(U.F.hp * clamp(sp.pow, 0, 1) * 0.5)); U.hp += h; floatText(U, '+' + Math.round(h), '#9AF0B0'); }   // v198 실제로 찬 만큼 표시
              else { U.shieldPow = clamp(sp.pow * 0.5, 0, 0.4); U.shieldT = sp.dur || 6; floatText(U, '방패 ' + Math.round(U.shieldPow * 100) + '%', '#9AE6FF'); }
            }
            ringFx(new THREE.Vector3(U.x, 0.05, U.z), 1.6, C.col, 0.5); burst(new THREE.Vector3(U.x, U.y + 1, U.z), sp.els[0], 16);
          } else if (k === 'bolt') {
            const n = clamp(Math.round(sp.count || 1), 1, 7), tgt = new THREE.Vector3(aim.pt.x, aim.h != null ? aim.h : 1, aim.pt.z), dir = tgt.sub(o).normalize();
            if (aim.floor || coarse || !U.me) dir.y = clamp(dir.y, -0.12, 0.12);   // 바닥을 겨눠도 몸 높이로 날아감
            for (let i = 0; i < n; i++) {
              const d = dir.clone().normalize(); if (n > 1) d.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i - (n - 1) / 2) * 0.1);
              const r = sp.basic ? 0.22 : sp.fused ? 0.5 : 0.36, m = orb(sp.els[i % sp.els.length], r), st = o.clone().addScaledVector(d, 0.6);
              m.position.copy(st); scene.add(m); if (m.userData.fx) m.lookAt(st.clone().add(d));
              B.shots.push({ m, v: d.multiplyScalar(30 * (sp.speed || 1)), C, r, life: 2.4, pierce: !!sp.pierce, hitSet: new Set() });
            }
          } else if (k === 'nova') {
            const R = Math.max(2.5, (sp.radius || 120) * PX), c0 = new THREE.Vector3(U.x, 0.05, U.z);
            ringFx(c0, R, C.col, 0.45); discFx(c0, R, C.col, 0.35); burst(new THREE.Vector3(U.x, 1, U.z), sp.els[0], 24);
            later(0.12, () => areaHit(C, c0.x, c0.z, R, 1));
          } else if (k === 'beam') {
            const L = Math.max(4, (sp.len || 300) * PX), Wd = Math.max(0.8, (sp.w || 30) * PX), s0 = new THREE.Vector3(U.x, 0, U.z).addScaledVector(fd, 0.5);
            beamFx(s0, fd, L, Wd, C.col, C.col2);
            later(0.16, () => lineHit(C, s0, fd, L, Wd / 2, 1));
          } else if (k === 'rain') {
            const n = clamp(Math.round(sp.count || 6), 1, 12), ctr = clampPt(U, aim.pt, 18), spread = 2.6, dr = Math.max(1.3, (sp.radius || 70) * PX * 0.8);
            markFx(ctr, spread + dr * 0.5, C.col, 1.1);
            for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * spread, p2 = new THREE.Vector3(ctr.x + Math.cos(a) * rr, 0, ctr.z + Math.sin(a) * rr); const Ci = Object.assign({}, C, { cid: C.cid + '.' + i }); later(0.1 + i * (0.8 / n), () => dropFx(Ci, p2, dr, Math.min(0.45, 1.6 / n))); }   // v198 방울마다 따로 (같은 마법 0.12초 규칙에 막혀 방울이 많을수록 덜 맞던 것 고침)   // v197 방울 몫: 다 맞아도 위력 × 1.6 정도
          } else if (k === 'pool') {
            const ctr = clampPt(U, aim.pt, 16), R = Math.max(2, (sp.radius || 90) * PX), dur = sp.dur || 4;
            poolFx(C, ctr, R, dur);
          } else if (k === 'dash') {
            const L = Math.max(4, (sp.len || 200) * PX), s0 = new THREE.Vector3(U.x, 0, U.z);
            if (U.own) U.dash = { t: L / 30, vx: fd.x * 30, vz: fd.z * 30 };
            later(0.05, () => lineHit(C, s0, fd, L, 1.4, 1)); beamFx(s0, fd, L, 1.2, C.col, C.col2, 0.25);
          }
          if (U.act) U.act(sp.fused ? 'fuse' : 'cast');
          if (U.me && !sp.basic) showCombo(sp);
          if (!(U.me && B.view === 1) && k !== 'heal' && k !== 'shield') burst(o, sp.els[0], 8);   // 1인칭에서는 눈앞 조각이 화면을 가려서 안 뿌림
          return true;
        }
        /* 맞음: 이 기기가 맡은 몸만 계산 (같은 마법은 0.12초 안에 한 번만 — RPG 결투와 같음) */
        function hitU(T, C, k) {
          if (!T.own || T.dead || B.over) return;
          const now = B.t; T.hitCd = T.hitCd || {}; if (now - (T.hitCd[C.cid] || -9) < 0.12) return; T.hitCd[C.cid] = now;
          const F = T.F, basic = !!(C.sp && C.sp.basic), el = basic ? null : C.els[0];   // v198 기본 공격 = 원소 없음 (RPG 와 같게: 물리 방어 · 원소 효과 없음)
          let dmg = (C.raw * k - F.def * 0.5) * (1 - (el ? (F.edefs[el] || 0) : clamp(F.pdef || 0, 0, 75)) / 100);
          if (T.shieldT > 0) dmg *= 1 - (T.shieldPow || 0);
          if (C.els.includes('earth')) dmg *= 1.15;   // 땅 = 큰 피해
          if (T.curse > 0) dmg *= 1.15;   // 저주 걸린 몸
          dmg = Math.max(1, Math.round(dmg));
          T.hp = Math.max(0, T.hp - dmg);
          floatText(T, (C.crit ? '치명! ' : '') + '-' + dmg, C.crit ? '#FFD23F' : '#FFFFFF');
          if (!basic) C.els.forEach(e => status(T, e, dmg, C.U));
        }
        /* v192 4단계 원소 효과 = RPG 에서 내가 받는 효과와 같음 (선생님 결정: 원소 효과만 · 기절 최대 0.8초 + 면역)
         *  불 화상(3초, 1초에 맞은 피해의 8%) · 물 느려짐(2초, 이동 −40%) · 바람 밀려남(약 2m) · 땅 큰 피해(+15%, 위에서)
         *  번개 기절(0.4초, 3초 동안 다시 안 걸림) · 빛 마나 빼앗김(맞은 피해의 20%) · 어둠 저주(3초, 받는 피해 +15%)
         *  그 원소 방어 % 만큼 짧아지고 약해짐 (최소 15%) */
        const PST = { fire: ['화상!', '#FF9A3D'], water: ['느려짐!', '#3BA8F5'], wind: ['밀려남!', '#7FE0C4'], thunder: ['기절!', '#FFE45C'], light: ['마나 빼앗김!', '#FFF3B0'], dark: ['저주!', '#C8A8FF'] };
        function status(T, el, dmg, src) {
          if (!T.own || T.dead) return;
          const k = Math.max(0.15, 1 - (T.F.edefs[el] || 0) / 100); let ok = true;
          if (el === 'fire') T.burn = { t: 3 * k, dps: dmg * 0.08 * k, tick: 0.5 };
          else if (el === 'water') T.slow = Math.max(T.slow || 0, 2 * k);
          else if (el === 'wind' && src) { const dx = T.x - src.x, dz = T.z - src.z, l = Math.hypot(dx, dz) || 1; T.push = { t: 0.15, vx: dx / l * 13 * k, vz: dz / l * 13 * k }; }
          else if (el === 'thunder') { if ((T.stunImm || 0) > 0) ok = false; else { T.stun = Math.min(0.8, 0.4 * k); T.stunImm = 3; } }
          else if (el === 'light') T.mp = Math.max(0, T.mp - Math.round(dmg * 0.2 * k));
          else if (el === 'dark') T.curse = Math.max(T.curse || 0, 3 * k);
          else ok = false;
          if (ok && PST[el]) floatText(T, PST[el][0], PST[el][1], 0.35);
        }
        // 효과 시간 줄이기 · 화상 피해 · 밀려남 (이 기기가 맡은 몸만 · 다른 기기에는 상태 표시만 보냄)
        function statusTick(U, dt) {
          ['slow', 'stun', 'stunImm', 'curse'].forEach(k2 => { if (U[k2] > 0) U[k2] -= dt; });
          if (U.burn) { U.burn.t -= dt; U.burn.tick -= dt; if (U.burn.tick <= 0 && !U.dead && !B.over) { U.burn.tick = 0.5; const bd = Math.max(1, Math.round(U.burn.dps * 0.5)); U.hp = Math.max(0, U.hp - bd); floatText(U, '-' + bd, '#FF9A3D'); } if (U.burn.t <= 0) U.burn = null; }
          if (U.push) { moveBody(U, U.push.vx * dt, U.push.vz * dt); if ((U.push.t -= dt) <= 0) U.push = null; }
        }
        const stBits = U => (U.burn ? 1 : 0) | (U.slow > 0 ? 2 : 0) | (U.stun > 0 ? 4 : 0) | (U.curse > 0 ? 8 : 0);
        function statusLook(U, dt) {   // 모두에게 보이는 상태 모양 (불꽃 조각 · 파란 김 · 별 · 보라 연기)
          const b = U.own ? stBits(U) : (U.stb || 0); if (!b || U.dead) return;
          U.stT = (U.stT || 0) - dt; if (U.stT > 0) return; U.stT = 0.12;
          const p = new THREE.Vector3(U.x + rand(-0.35, 0.35), U.y + rand(0.3, 1.8), U.z + rand(-0.35, 0.35));
          if (b & 1) burst(p, 'fire', 2); if (b & 2) burst(p, 'water', 1); if (b & 4) burst(new THREE.Vector3(U.x, U.y + 2.1, U.z), 'thunder', 2); if (b & 8) burst(p, 'dark', 1);
        }
        const foesOf = C => units.filter(u => u.team !== C.team && !u.dead);
        function areaHit(C, x, z, R, k) { foesOf(C).forEach(u => { if (Math.hypot(u.x - x, u.z - z) < R + (u.rad || 0.45)) hitU(u, C, k); }); }
        function lineHit(C, s0, d, L, half, k) { foesOf(C).forEach(u => { const vx = u.x - s0.x, vz = u.z - s0.z, t = vx * d.x + vz * d.z; if (t < -0.5 || t > L + 0.5) return; if (Math.abs(vx * d.z - vz * d.x) < half + (u.rad || 0.45)) hitU(u, C, k); }); }
        /* 효과 (B.fx: 시간이 지나면 사라짐) */
        function later(sec, f) { B.fx.push({ t: 0, upd(dt) { this.t += dt; if (this.t >= sec) { if (!B.over) f(); return false; } return true; } }); }
        const addM = (m, life, upd) => { scene.add(m); B.fx.push({ t: 0, upd(dt) { this.t += dt; const q = this.t / life; if (q >= 1) { scene.remove(m); m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); return false; } upd(m, q, dt); return true; } }); };
        const glowMat = (c, op) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        function ringFx(p, R, col, life) { const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), glowMat(col, 0.9)); m.rotation.x = -Math.PI / 2; m.position.copy(p); m.position.y = 0.06; addM(m, life, (mm, q) => { const s2 = R * (0.25 + 0.75 * Math.sqrt(q)); mm.scale.set(s2, s2, 1); mm.material.opacity = 0.9 * (1 - q); }); }
        function discFx(p, R, col, life) { const m = new THREE.Mesh(new THREE.CircleGeometry(R, 40), glowMat(col, 0.45)); m.rotation.x = -Math.PI / 2; m.position.copy(p); m.position.y = 0.05; addM(m, life, (mm, q) => { mm.material.opacity = 0.45 * (1 - q); }); const sp2 = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glowMat(col, 0.35)); sp2.position.set(p.x, 0.4, p.z); addM(sp2, life, (mm, q) => { const s2 = R * (0.3 + 0.7 * q); mm.scale.set(s2, s2 * 0.45, s2); mm.material.opacity = 0.35 * (1 - q); }); }
        function markFx(p, R, col, life) { const m = new THREE.Mesh(new THREE.RingGeometry(R - 0.12, R, 40), glowMat(col, 0.7)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z); addM(m, life, (mm, q) => { mm.material.opacity = 0.7 * (1 - q * q); }); }
        function beamFx(s0, d, L, Wd, col, col2, life) {
          life = life || 0.42; const yaw = Math.atan2(d.x, d.z);
          const core = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.45, 0.35, L), glowMat(col2, 0.95)), outer = new THREE.Mesh(new THREE.BoxGeometry(Wd, 0.9, L), glowMat(col, 0.5));
          [core, outer].forEach((m, i) => { m.position.set(s0.x + d.x * L / 2, 1.0, s0.z + d.z * L / 2); m.rotation.y = yaw; addM(m, life, (mm, q) => { const w0 = q < 0.25 ? 0.15 + q * 3.4 : 1; mm.scale.set(w0, w0, 1); mm.material.opacity = (i ? 0.5 : 0.95) * (q < 0.35 ? 1 : 1 - (q - 0.35) / 0.65); }); });
          burst(new THREE.Vector3(s0.x + d.x * L, 1, s0.z + d.z * L), 'light', 6);
        }
        function dropFx(C, p, dr, kk) {
          const m = orb(C.els[Math.floor(Math.random() * C.els.length)], 0.42); m.position.set(p.x, 10, p.z); scene.add(m);
          B.fx.push({ t: 0, upd(dt) { this.t += dt; m.position.y = 10 - 10 * Math.min(1, this.t / 0.42); if (this.t >= 0.42) { scene.remove(m); ringFx(new THREE.Vector3(p.x, 0, p.z), dr, C.col, 0.35); burst(new THREE.Vector3(p.x, 0.3, p.z), C.els[0], 8); areaHit(C, p.x, p.z, dr, kk || 0.45); return false; } return true; } });
        }
        function poolFx(C, p, R, dur) {
          const m = new THREE.Mesh(new THREE.CircleGeometry(R, 40), glowMat(C.col, 0.5)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.05, p.z);
          let tick = 0; addM(m, dur, (mm, q, dt) => { mm.material.opacity = (0.35 + 0.15 * Math.sin(q * dur * 8)) * (q > 0.85 ? (1 - q) / 0.15 : 1); if ((tick -= dt) <= 0) { tick = 0.5; areaHit(C, p.x, p.z, R, 1.2 / Math.max(2, dur * 2)); if (Math.random() < 0.8) burst(new THREE.Vector3(p.x + rand(-R, R) * 0.6, 0.2, p.z + rand(-R, R) * 0.6), C.els[0], 3); } });
        }
        function orb(el, r) {   // 날아가는 구슬 (얼음·땅·어둠은 Skillcom 원본 Meshy 모양)
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshBasicMaterial({ color: EL[el].c }));
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(THREE, EL[el].c2), color: EL[el].c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(r * 5); m.add(glow);
          const fxm = fxModel(el, r); if (fxm) { m.material.visible = false; m.add(fxm); m.userData.fx = true; }
          return m;
        }
        // 얼음 · 땅 · 암흑 마법은 Skillcom 원본의 Meshy 모양 (얼음창 · 바위창 · 암흑수정). 나머지는 빛나는 구슬
        const fxBase = {};
        function fxModel(el, r) {
          const g = pre.gl[FX[el]]; if (!g) return null;
          let b = fxBase[el];
          if (!b) { b = fxBase[el] = g.scene; const bx = new THREE.Box3().setFromObject(b), sz = new THREE.Vector3(); bx.getSize(sz); b.userData.k = 1 / Math.max(sz.x, sz.y, sz.z, 0.001); b.userData.c = bx.getCenter(new THREE.Vector3()); }
          const w = new THREE.Group(), c = b.clone(true), k = b.userData.k * r * (el === 'dark' ? 2.4 : 3.2);
          c.scale.setScalar(k); c.position.copy(b.userData.c).multiplyScalar(-k);
          if (el !== 'dark') { const q = new THREE.Group(); q.rotation.x = Math.PI / 2; q.add(c); w.add(q); } else w.add(c);   // 창 끝이 날아가는 쪽을 보게
          w.userData.spin = el === 'dark' ? 6 : 0; return w;
        }
        /* --- v192 마법 8칸 바로 쓰기 · 기본 공격 · 물약 · 대시 --- */
        const SLOTSP = CARD.slots.map(q => q && slotSpell(q)), BASICSP = BASIC_SP;
        function castSlot(i) {
          if (B.over || !B.started || me.dead) return false; const sp = SLOTSP[i]; if (!sp) return false;
          if (me.stun > 0) { flash('기절해서 마법을 못 써요', 0.5); return false; }
          const cd = me.cds['s' + i] || 0; if (cd > 0) { flash(sp.name + ' ' + cd.toFixed(1) + '초 뒤에', 0.7); return false; }
          return cast(me, sp, null, false, 's' + i);   // 조준 = myAim()
        }
        function basicAttack() { if (B.over || !B.started || me.dead || me.stun > 0) return false; return cast(me, BASICSP, null, false, 'basic'); }
        B.pot = { hp: 3, mp: 3 }; me.dashCd = 0;
        function usePot(k) {
          if (B.over || !B.started || me.dead) return;
          if (B.pot[k] <= 0) { flash('물약을 다 썼어요', 0.8); return; }
          if (B.potCd > 0) return;
          if (k === 'hp') { if (me.hp >= me.F.hp) { flash('체력이 가득해요', 0.7); return; } const h = Math.min(me.F.hp - me.hp, Math.round(me.F.hp * 0.4)); me.hp += h; floatText(me, '+' + Math.round(h), '#9AF0B0'); }
          else { if (me.mp >= me.F.mp) { flash('마나가 가득해요', 0.7); return; } const g = Math.min(me.F.mp - me.mp, me.F.mp * 0.5); me.mp += g; floatText(me, '마나 +' + Math.round(g), '#7FB8FF'); }   // v198 마나 물약도 숫자 보임
          B.potCd = 1;   // 두 번 눌러 둘 다 써 버리지 않게 1초 쉬기 (v198 가득해서 못 쓴 때는 안 쉼)
          B.pot[k]--; const b = $h(k === 'hp' ? 'sfPotH' : 'sfPotM'); b.querySelector('.n').textContent = B.pot[k]; b.disabled = B.pot[k] <= 0;
          burst(new THREE.Vector3(me.x, me.y + 1, me.z), k === 'hp' ? 'fire' : 'water', 10);
        }
        function dash() {
          if (B.over || !B.started || me.dead || me.dashCd > 0 || me.stun > 0) return;
          let mx = 0, mz = 0; const K = B.keys;
          if (K.KeyS || K.ArrowUp) mz -= 1; if (K.KeyX || K.ArrowDown) mz += 1; if (K.KeyZ || K.ArrowLeft) mx -= 1; if (K.KeyC || K.ArrowRight) mx += 1;
          if (B.joy) { mx = B.joy.vx; mz = B.joy.vy; }
          if (Math.hypot(mx, mz) < 0.1) mz = -1;   // 아무 쪽도 안 누르면 앞으로
          const l = Math.hypot(mx, mz), s2 = Math.sin(me.yaw), c2 = Math.cos(me.yaw);
          me.dash = { t: 0.18, vx: (mx * c2 + mz * s2) / l * 26, vz: (-mx * s2 + mz * c2) / l * 26 }; me.dashCd = 3;
          burst(new THREE.Vector3(me.x, me.y + 0.4, me.z), 'wind', 8);
        }
        function markCharge() { /* v192 차지 없앰 */ }
        function showCombo(sp) { const c = $h('sfCombo'); c.textContent = sp.name + (sp.fused ? ' !' : ''); c.style.color = EL[sp.els[0]].c; clearTimeout(B.comboT); B.comboT = setTimeout(() => { if (c.isConnected && !B.ch) c.textContent = ''; }, 900); }
        function flash(t, sec) { const m = $h('sfMsg'); m.textContent = t; m.style.fontSize = t.length > 10 ? '24px' : '40px'; clearTimeout(B.msgT); B.msgT = setTimeout(() => { if (m.isConnected) m.textContent = ''; }, (sec || 1.2) * 1000); }

        /* --- 입력 --- */
        const MOVE_K = ['KeyS', 'KeyZ', 'KeyX', 'KeyC', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], SPELL_K = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, KeyQ: 4, KeyW: 5, KeyE: 6, KeyR: 7 };
        const onKey = e => {
          if (!body.isConnected) return; const down = e.type === 'keydown', c = e.code;
          if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
          if (MOVE_K.includes(c)) { e.preventDefault(); B.keys[c] = down; return; }
          if (c === 'Space') { e.preventDefault(); if (down && !e.repeat) dash(); return; }   // 화면이 내려가지 않게
          if (!down || e.repeat) return;
          if (c in SPELL_K) { e.preventDefault(); castSlot(SPELL_K[c]); }
          else if (c === 'KeyF') { e.preventDefault(); usePot('hp'); }
          else if (c === 'KeyG') { e.preventDefault(); usePot('mp'); }
          else if (c === 'KeyB') { e.preventDefault(); toggleView(); }
        };
        document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKey);
        function toggleView() { B.view = B.view === 1 ? 3 : 1; S.view = B.view; $h('sfView').textContent = `시점: ${B.view}인칭 (B)`; saveRow(S); }
        $h('sfView').addEventListener('click', e => { e.stopPropagation(); toggleView(); });
        // 크게 보기: 브라우저 전체 화면(+가로 고정), 안 되면 페이지 위에 가득
        const fsNow = () => document.fullscreenElement || document.webkitFullscreenElement;
        $h('sfFull').addEventListener('click', e => {
          e.stopPropagation();
          if (fsNow() || stage.classList.contains('sf-max')) { if (fsNow()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); stage.classList.remove('sf-max'); setTimeout(size, 200); return; }
          const req = stage.requestFullscreen || stage.webkitRequestFullscreen, fb = () => { stage.classList.add('sf-max'); setTimeout(size, 100); };
          if (!req) { fb(); return; }
          try { const pr = req.call(stage, { navigationUI: 'hide' }); if (pr && pr.then) pr.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (er) { /* noop */ } setTimeout(size, 200); }, fb); } catch (er) { fb(); }
        });
        const onFs = () => setTimeout(size, 150); document.addEventListener('fullscreenchange', onFs);
        body.querySelectorAll('.sf-num').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (b.dataset.basic) basicAttack(); else castSlot(+b.dataset.slot); }));
        [['sfPotH', () => usePot('hp')], ['sfPotM', () => usePot('mp')], ['sfDash', dash]].forEach(([id, f]) => $h(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); f(); }));
        // 마우스: 화면을 누르면 마우스 고정(포인터 잠금) → 움직이면 둘러보기 / 휴대폰: 왼쪽 끌기 = 이동, 오른쪽 끌기 = 둘러보기
        const onLockCh = () => { B.lock = document.pointerLockElement === stage; };
        document.addEventListener('pointerlockchange', onLockCh);
        const onMove = e => { if (B.lock) { me.yaw -= e.movementX * 0.0026; me.pitch = clamp(me.pitch - e.movementY * 0.0026, -1.2, 1.2); } };
        document.addEventListener('mousemove', onMove);
        stage.addEventListener('contextmenu', e => e.preventDefault());
        const pts = {};
        stage.addEventListener('pointerdown', e => {
          if (e.target.closest('button')) return;
          if (e.pointerType === 'mouse') {
            if (e.button === 2) { e.preventDefault(); return; }
            if (e.button === 0) { if (!B.lock && stage.requestPointerLock && !B.over) { stage.requestPointerLock(); return; } B.holdAtk = true; basicAttack(); }   // 처음 누르면 마우스 고정만, 그다음부터 기본 공격 (누르고 있으면 계속)
            return;
          }
          e.preventDefault(); stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
          const r = stage.getBoundingClientRect(), x = e.clientX - r.left;
          if (x < r.width * 0.4) { pts[e.pointerId] = 'joy'; B.joy = { cx: e.clientX, cy: e.clientY, vx: 0, vy: 0 }; } else { pts[e.pointerId] = 'look'; B.look = { x: e.clientX, y: e.clientY }; }
        });
        stage.addEventListener('pointermove', e => {
          const k = pts[e.pointerId]; if (!k) return;
          if (k === 'joy' && B.joy) { const dx = e.clientX - B.joy.cx, dy = e.clientY - B.joy.cy, l = Math.hypot(dx, dy), q = Math.min(1, l / 50); B.joy.vx = l ? dx / l * q : 0; B.joy.vy = l ? dy / l * q : 0; const j = $h('sfJoy').firstChild; j.style.transform = `translate(${B.joy.vx * 36}px,${B.joy.vy * 36}px)`; }
          if (k === 'look' && B.look) { me.yaw -= (e.clientX - B.look.x) * 0.006; me.pitch = clamp(me.pitch - (e.clientY - B.look.y) * 0.006, -1.2, 1.2); B.look = { x: e.clientX, y: e.clientY }; }
        });
        const up = e => { const k = pts[e.pointerId]; if (k === 'joy') { B.joy = null; $h('sfJoy').firstChild.style.transform = ''; } if (k === 'look') B.look = null; delete pts[e.pointerId]; };
        stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
        const atkUp = e => { if (e.button === 0) B.holdAtk = false; }; document.addEventListener('mouseup', atkUp); document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) B.holdAtk = false; });
        // 휴대폰 기본 공격 버튼도 누르고 있으면 계속
        { const bb = body.querySelector('[data-basic]'); if (bb) { bb.addEventListener('pointerdown', () => { B.holdAtk = true; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => bb.addEventListener(ev, () => { B.holdAtk = false; })); } }

        /* --- 컴퓨터 (Skillcom 장수): 가장 가까운 상대를 노림 --- */
        function aiTick(U, dt) {
          const ai = U.ai, D = ai.D; let T = null, d = 1e9;
          units.forEach(o => { if (o.team !== U.team && !o.dead) { const dd = Math.hypot(o.x - U.x, o.z - U.z); if (dd < d) { d = dd; T = o; } } });
          if (!T) return;
          U.mp = Math.min(U.F.mp, U.mp + U.F.regen * dt);
          if (U.stun > 0) return;   // 기절 = 못 움직이고 마법도 못 씀
          const dx = T.x - U.x, dz = T.z - U.z; d = d || 1;
          U.yaw = Math.atan2(-dx, -dz);
          ai.t -= dt; if (ai.t <= 0) { ai.t = rand(0.8, 1.8); ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.move = d > 13 ? 1 : d < 7 ? -1 : 0; }
          const sp = U.F.spd * (U.slow > 0 ? 0.6 : 1) * 0.8 * dt, fx = dx / d, fz = dz / d;
          moveBody(U, (fx * ai.move + -fz * ai.strafe * 0.8) * sp, (fz * ai.move + fx * ai.strafe * 0.8) * sp);
          ai.cast = (ai.cast || rand(1, 2)) - dt;
          if (ai.cast <= 0) {
            ai.cast = rand(1.1, 2.4) * (LV < 10 ? 1.3 : 1) * D.cast;
            // v192 5단계: 쓸 수 있는 마법(재사용·마나) 중 상황에 맞는 것 — 체력이 낮으면 회복·방패 · 모양마다 닿는 거리 안에서만 · 보통·어려움은 센 마법을 더 자주
            const hpR = U.hp / U.F.hp, ready = U.sps.map((q, i) => [q, i]).filter(([q, i]) => (U.cds['c' + i] || 0) <= 0 && U.mp >= q.mp);
            const reach = q => q.kind === 'nova' ? d < Math.max(2.5, (q.radius || 120) * PX) + 0.3 : q.kind === 'beam' ? d < Math.max(4, (q.len || 300) * PX) - 0.3 : q.kind === 'dash' ? d > 2.5 && d < Math.max(4, (q.len || 200) * PX) : q.kind === 'rain' || q.kind === 'pool' ? d < 17 : d < 30;
            let ch = ready.find(([q]) => q.kind === 'heal' && hpR < 0.45) || ready.find(([q]) => q.kind === 'shield' && hpR < 0.7 && !(U.shieldT > 0));
            if (!ch) {
              const atk = ready.filter(([q]) => q.kind !== 'heal' && q.kind !== 'shield' && reach(q));
              if (atk.length) ch = ai.D === DIFFS.easy ? pick(atk) : atk.map(x => [x, x[0].pow * rand(0.6, 1.4) * (x[0].kind === 'bolt' ? 0.9 : 1)]).sort((a, b) => b[1] - a[1])[0][0];
            }
            if (ch) {
              const [sp2, i] = ch, t = d / (30 * (sp2.speed || 1)), lx = T.x + T.vx * t * D.lead, lz = T.z + T.vz * t * D.lead, ang = rand(-1, 1) * D.aim * 3;
              const vx = lx - U.x, vz = lz - U.z, pt = new THREE.Vector3(U.x + vx * Math.cos(ang) - vz * Math.sin(ang), 0, U.z + vx * Math.sin(ang) + vz * Math.cos(ang));
              cast(U, sp2, { pt, h: 1.0 + rand(-D.aim, D.aim) * 6 }, false, 'c' + i);
            } else if (d < 25 && (U.cds.basic || 0) <= 0) {   // 쓸 마법이 없으면 기본 공격
              cast(U, BASIC_SP, { pt: new THREE.Vector3(T.x, 0, T.z), h: 1.0 }, false, 'basic');
            }
          }
        }
        function moveBody(U, mx, mz) {   // 둥근 전장 (반지름 ARENA) 밖으로 못 나감 · 기둥은 돌아감
          let nx = U.x + mx, nz = U.z + mz; const l = Math.hypot(nx, nz), R = ARENA - 0.6; if (l > R) { nx *= R / l; nz *= R / l; }
          if (!blocked(nx, U.z)) U.x = nx; if (!blocked(U.x, nz)) U.z = nz;
        }

        /* --- 온라인: 각자 맡은 몸의 자리·체력을 보냄 (컴퓨터는 방장이 맡음). 맞았는지는 맞은 몸을 맡은 기기가 판단 --- */
        function send(m) { if (roomCh) roomCh.send(Object.assign({ from: Hub.clientId }, m)); }
        function sendPos() { send({ t: 'p', u: units.filter(u => u.own).map(u => [u.id, +u.x.toFixed(2), +u.z.toFixed(2), +u.y.toFixed(2), +u.yaw.toFixed(3), Math.round(u.hp), stBits(u)]) }); }
        B.onMsg = m => {
          if (!m || m.from === Hub.clientId) return;
          if (m.t === 'p') (m.u || []).forEach(([id, x, z, y, yaw, hp, sb]) => { const u = byId[id]; if (!u || u.own) return; u.tx = x; u.tz = z; u.y = y || 0; u.yaw = yaw; u.lastMsg = performance.now(); if (!u.dead) u.hp = hp; u.stb = (+sb || 0) & 15; });
          else if (m.t === 'c') { const u = byId[m.id], sp = unpack(m.s); if (u && !u.own && sp && Array.isArray(m.p)) { if (isFinite(+m.y)) u.yaw = +m.y; cast(u, sp, { pt: new THREE.Vector3(+m.p[0] || 0, 0, +m.p[1] || 0), h: clamp(+m.p[2] || 1, 0, 8) }, true, null, m); } }
          else if (m.t === 'heal') { const u = byId[m.id]; if (u && u.own && !u.dead) u.hp = Math.min(u.F.hp, u.hp + (+m.n || 0)); }
        };
        // 나간 사람(과 그 사람이 맡은 컴퓨터)은 쓰러진 것으로: 방 목록에서 빠지고 + 5초 넘게 소식이 없을 때 (잠깐 끊긴 것은 봐 줌)
        let here = null;
        B.onPeers = list => { here = new Set(list.map(p => p.id)); const now = performance.now(); units.forEach(u => { if (u.cpu || u.own) return; if (!here.has(u.id)) { if (!u.goneAt) u.goneAt = now; } else u.goneAt = 0; }); };
        /* v68 무단 이탈: 대결 시작(카운트다운 끝) 5초(Hub.QUIT_SEC) 안에 사람이 나가면 이 판은 무효(승패·포인트 없음)
         *  + 관리자만 보는 기록 한 줄 (남은 사람 중 맨 앞 회원의 화면이 남김) */
        function earlyQuit(u) {
          if (B.early || B.over) return; const sec = Math.max(0, ((u.goneAt || performance.now()) - (B.tStart || Infinity)) / 1000);
          if (sec >= (Hub.QUIT_SEC || 5)) return;
          B.early = { nick: u.nick, sec };
          const rep = units.find(x => !x.cpu && x.id !== u.id && !x.goneAt && x.uid && (x.own || (here && here.has(x.id))));
          if (rep && rep.own && Hub.user && Hub.logQuit) Hub.logQuit({ game_id: GAME, quitter: u.uid || null, quitter_nick: u.nick, kind: 'left', sec, extra: { code: myRoom, mode: modeName(opt.size) } });
          flash(u.nick + ` 님이 ${Hub.QUIT_SEC || 5}초 안에 나가서 무효 판이에요`, 3);
        }
        function checkLeft() {
          if (!B.net || !here || B.over) return; const now = performance.now();
          units.forEach(u => { if (u.own || u.dead) return; const who = u.cpu ? u.owner : u.id; if (who && !here.has(who) && now - (u.lastMsg || B.t0) > 5000) { u.hp = 0; anyLeft.v = true; if (!u.cpu) { const was = B.early; earlyQuit(u); if (B.early === was) flash(u.nick + ' 님이 나갔어요', 2); } } });
        }

        /* --- 한 틱 --- */
        let last = performance.now(), raf = 0;
        B.started = false; let countdown = 3; flash('3');
        if (matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) setTimeout(() => flash('오른쪽 아래 [ ] 를 누르면 크게 보여요', 2.4), 3300);
        const sendEvery = units.length > 2 ? 0.12 : 0.08; B.t0 = performance.now();
        function tick(now) {
          if (!alive || !body.isConnected) return;
          raf = requestAnimationFrame(tick);
          const dt = Math.min(0.05, (now - last) / 1000); last = now; B.t += dt;
          if (!B.started) { const c0 = Math.ceil(countdown); countdown -= dt; const c1 = Math.ceil(countdown); if (c1 !== c0) flash(c1 > 0 ? String(c1) : '시작!'); if (countdown <= 0) { B.started = true; B.tStart = performance.now(); } }
          if (me.dashCd > 0) me.dashCd -= dt; if (B.potCd > 0) B.potCd -= dt;
          if (B.holdAtk && B.started && !B.over && (me.cds.basic || 0) <= 0) basicAttack();
          units.forEach(U => { U.px = U.x; U.pz = U.z; Object.keys(U.cds).forEach(k => { U.cds[k] -= dt; }); if (U.shieldT > 0) U.shieldT -= dt; if (U.own) statusTick(U, dt); statusLook(U, dt); });
          if (B.started && !B.over) {
            // 내 움직임 (보는 방향 기준)
            if (!me.dead) {
              let mx = 0, mz = 0; const K = B.keys;
              if (K.KeyS || K.ArrowUp) mz -= 1; if (K.KeyX || K.ArrowDown) mz += 1; if (K.KeyZ || K.ArrowLeft) mx -= 1; if (K.KeyC || K.ArrowRight) mx += 1;   // v192 S 앞 · Z 왼 · X 뒤 · C 오른
              if (B.joy) { mx = B.joy.vx; mz = B.joy.vy; }
              if (me.stun > 0) { mx = 0; mz = 0; }   // 기절 = 못 움직임
              const l = Math.hypot(mx, mz), sp = me.F.spd * (me.slow > 0 ? 0.6 : 1);
              if (l > 0.1) { const s2 = Math.sin(me.yaw), c2 = Math.cos(me.yaw), wx = (mx * c2 + mz * s2) / Math.max(1, l), wz = (-mx * s2 + mz * c2) / Math.max(1, l); moveBody(me, wx * sp * dt, wz * sp * dt); }
              if (me.dash) { moveBody(me, me.dash.vx * dt, me.dash.vz * dt); if ((me.dash.t -= dt) <= 0) me.dash = null; }   // 대시 · 돌진 마법
              me.mp = Math.min(me.F.mp, me.mp + me.F.regen * dt);
            }
            me.vy -= 18 * dt; me.y = Math.max(0, me.y + me.vy * dt); if (me.y === 0) me.vy = 0;
            units.forEach(U => {
              if (U.me || U.dead) return;
              if (U.own && U.ai) aiTick(U, dt);
              if (U.own && U.dash) { moveBody(U, U.dash.vx * dt, U.dash.vz * dt); if ((U.dash.t -= dt) <= 0) U.dash = null; }   // v198 컴퓨터 돌진 마법도 몸이 움직이게
              else if (!U.own) { U.x += (U.tx - U.x) * Math.min(1, dt * 12); U.z += (U.tz - U.z) * Math.min(1, dt * 12); }
            });
            if (B.net && (B.sendT += dt) >= sendEvery) { B.sendT = 0; sendPos(); checkLeft(); }
          }
          units.forEach(U => { U.vx = (U.x - U.px) / Math.max(dt, 0.001); U.vz = (U.z - U.pz) / Math.max(dt, 0.001); });
          // 탄: 다른 편 몸에만 맞음 (같은 편은 지나감) · 꿰뚫는 탄은 맞혀도 계속 날아감
          B.shots = B.shots.filter(s0 => {
            s0.life -= dt;
            const p = s0.m.position, nStep = Math.max(1, Math.ceil(s0.v.length() * dt / 0.35));   // v199 화면이 느려도(한 장면에 많이 날아가도) 몸을 뚫고 지나가지 않게 잘게 나눠 검사
            for (let st = 0; st < nStep; st++) {
              p.addScaledVector(s0.v, dt / nStep);
              if (B.over) continue;
              const T = foesOf(s0.C).find(u => !s0.hitSet.has(u.id) && Math.hypot(p.x - u.x, p.z - u.z) < (u.rad || 0.45) + s0.r && Math.abs(p.y - (u.y + (u.hh || 0.9))) < (u.hh || 0.9) + 0.1 + s0.r);
              if (T) { s0.hitSet.add(T.id); if (T.own) hitU(T, s0.C, 1); else if (s0.C.U.me) floatText(T, '명중!', '#FFD23F'); burst(p, s0.C.els[0], s0.C.sp.fused ? 22 : 12); if (!s0.pierce) { kill(s0); return false; } }
              if (blocked(p.x, p.z)) break;
            }
            const sp3 = s0.m.children[1]; if (sp3 && sp3.userData.spin) sp3.rotation.z += dt * sp3.userData.spin;
            if (s0.life <= 0 || p.y < 0 || Math.hypot(p.x, p.z) > ARENA + 6 || blocked(p.x, p.z)) { burst(p, s0.C.els[0], 6); kill(s0); return false; }
            return true;
          });
          { const cur = B.fx; B.fx = []; const keep = cur.filter(f => f.upd(dt)); B.fx = keep.concat(B.fx); }   // 효과 안에서 새 효과가 생겨도 잃지 않게
          B.parts = B.parts.filter(q => { q.life -= dt; q.m.position.addScaledVector(q.v, dt); q.v.y -= 6 * dt; q.m.material.opacity = Math.max(0, q.life / q.max); if (q.life <= 0) { scene.remove(q.m); q.m.geometry.dispose(); q.m.material.dispose(); return false; } return true; });
          // 쓰러짐 · 승패 (한 편이 모두 쓰러지면 끝)
          units.forEach(U => {
            if (U.dead || U.hp > 0 || !B.started) return;
            U.dead = true; U.hp = 0; burst(new THREE.Vector3(U.x, U.y + 1, U.z), 'dark', 22); if (U.act) U.act('die');
            if (U.me) { B.ch = null; markCharge(); if (units.some(o => ally(o) && !o.dead)) flash('쓰러졌어요! 같은 편을 응원해요', 2.4); }
            else if (!B.over) flash((ally(U) ? '같은 편 ' : '') + U.nick + ' 쓰러짐!', 1.2);
          });
          if (!B.over && B.started) { if (!foes().some(u => !u.dead)) end(true); else if (!units.some(u => ally(u) && !u.dead)) end(false); }
          // 몸 · 카메라 (내가 쓰러지면 살아 있는 같은 편을 따라 봄)
          units.forEach(U => {
            if (U.anim) {   // 3D 장수: 쓰러짐 · 맞음도 움직임으로
              if (U.hp < U.lastHp - 0.5 && !U.dead) U.act('hit');
              U.anim(dt, Math.hypot(U.vx, U.vz) > 0.6);
              U.mesh.position.set(U.x, U.y, U.z); U.mesh.rotation.set(0, U.yaw, 0);   // Meshy 몸은 처음부터 앞(-z)을 봄
            } else { if (U.mesh.userData.walk) U.mesh.userData.walk(!U.dead && Math.hypot(U.vx, U.vz) > 0.5 ? B.t * 9 : null);   // v120 새 몸 그림 걷기
              U.mesh.position.set(U.x, U.y + (U.dead ? 0.25 : 0), U.z);
              if (U.mesh.userData.bill) U.mesh.userData.bill(U.yaw, cam.position.x, cam.position.z, U.dead); else U.mesh.rotation.set(U.dead ? -Math.PI / 2 : 0, U.yaw + Math.PI, 0, 'YXZ'); }
            U.lastHp = U.hp;
          });
          const camU = me.dead ? (units.find(u => ally(u) && !u.dead) || me) : me, third = B.view === 3 || me.dead;
          me.mesh.visible = third;
          if (!third) { cam.position.set(me.x, me.y + 1.6, me.z); }
          else { const back = fwd(me.yaw, 0).multiplyScalar(-3.6); cam.position.set(camU.x + back.x + Math.cos(me.yaw) * 0.6, camU.y + 2.3, camU.z + back.z - Math.sin(me.yaw) * 0.6); }
          const look = fwd(me.yaw, me.pitch); cam.lookAt(cam.position.x + look.x, cam.position.y + look.y - (third ? 0.15 : 0), cam.position.z + look.z);
          renderer.render(scene, cam);
          // HUD
          $h('sfHp').style.width = (me.hp / me.F.hp * 100) + '%'; $h('sfHpT').textContent = me.dead ? '쓰러짐' : `체력 ${Math.ceil(me.hp)} / ${me.F.hp}`;
          $h('sfMp').style.width = (me.mp / me.F.mp * 100) + '%'; $h('sfMpT').textContent = `마나 ${Math.floor(me.mp)} / ${me.F.mp}`;
          { const ch = [me.burn && ['화상', '#FF9A3D'], me.slow > 0 && ['느림', '#3BA8F5'], me.stun > 0 && ['기절', '#FFE45C'], me.curse > 0 && ['저주', '#B08AFF'], me.shieldT > 0 && ['방패', '#9AE6FF']].filter(Boolean).map(([t, c]) => `<b style="background:${c}">${t}</b>`).join(''); const el = $h('sfChips'); if (el.dataset.v !== ch) { el.dataset.v = ch; el.innerHTML = ch; } }
          units.forEach(U => {
            if (U.me) return;
            U.bar.style.width = (Math.max(0, U.hp) / U.F.hp * 100) + '%'; U.barT.textContent = U.dead ? '쓰러짐' : `체력 ${Math.ceil(U.hp)} / ${U.F.hp}`; U.row.classList.toggle('dead', U.dead);
            const v = new THREE.Vector3(U.x, U.y + 2.15, U.z).project(cam);
            if (U.dead || v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) U.tag.style.display = 'none';
            else { U.tag.style.display = ''; U.tag.style.left = ((v.x + 1) / 2 * 100) + '%'; U.tag.style.top = ((1 - v.y) / 2 * 100) + '%'; }
          });
          { const db = $h('sfDash'); let o = db.querySelector('.cd'); if (me.dashCd > 0) { if (!o) { o = document.createElement('span'); o.className = 'cd'; db.appendChild(o); } o.textContent = me.dashCd.toFixed(1); } else if (o) o.remove(); }
          body.querySelectorAll('.sf-num').forEach(b => { const cd = me.cds[b.dataset.basic ? 'basic' : 's' + b.dataset.slot] || 0; let o = b.querySelector('.cd'); if (cd > 0) { if (!o) { o = document.createElement('span'); o.className = 'cd'; b.appendChild(o); } o.textContent = cd.toFixed(1); } else if (o) o.remove(); });
          updFloats(dt);
        }
        raf = requestAnimationFrame(tick);

        /* --- 효과 --- */
        function kill(s) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); }
        function burst(p, el, n) { for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? EL[el].c : EL[el].c2, transparent: true })); m.position.copy(p); scene.add(m); const life = rand(0.3, 0.7); B.parts.push({ m, v: new THREE.Vector3(rand(-3, 3), rand(0, 4), rand(-3, 3)), life, max: life }); } }
        const floats = [];
        function floatText(U, t, col, up) {
          if (U === me && B.view === 1) { const hu = $h('sfHurt'); if (t[0] === '-') { if (hu) { hu.style.opacity = '1'; clearTimeout(B.hurtT); B.hurtT = setTimeout(() => { hu.style.opacity = '0'; }, 180); } return; } }   /* 1인칭: 내 몸 위 피해 숫자 대신 붉은 테두리 · v198 회복·물약·방패·상태 글자는 화면 가운데 아래에 보임 */
          const d = document.createElement('div'); d.className = 'sf-name'; d.textContent = t; d.style.color = col; d.style.fontSize = '22px'; stage.querySelector('.sf-hud').appendChild(d); floats.push({ d, U, t: 0, y: 2.1 + (up || 0), fixed: U === me && B.view === 1, k: (B.fixN = ((B.fixN || 0) + 1) % 3) }); }
        function updFloats(dt) {
          for (let i = floats.length - 1; i >= 0; i--) {
            const f = floats[i]; f.t += dt || 1 / 60;   // v198 화면이 느려도 글자가 같은 시간(0.9초)만 보이게
            if (f.fixed) { if (f.t > 0.9) { f.d.remove(); floats.splice(i, 1); continue; } f.d.style.left = (50 + (f.k - 1) * 9) + '%'; f.d.style.top = (64 - f.t * 10) + '%'; f.d.style.opacity = String(1 - f.t); continue; }
            const v = new THREE.Vector3(f.U.x, f.U.y + f.y + f.t, f.U.z).project(cam);
            if (f.t > 0.9 || v.z > 1) { f.d.remove(); floats.splice(i, 1); continue; }
            f.d.style.left = ((v.x + 1) / 2 * 100) + '%'; f.d.style.top = ((1 - v.y) / 2 * 100) + '%'; f.d.style.opacity = String(1 - f.t);
          }
        }

        /* --- 끝 --- */
        async function end(win) {
          if (B.over) return; B.over = true; if (document.pointerLockElement) document.exitPointerLock();
          units.forEach(u => { if (u.act && !u.dead && ally(u) === win) u.act('win'); });
          if (B.net) sendPos();
          const early = B.net && B.early;   // v68 무효 판: 승패·포인트·전적 없음
          if (!early) { if (win) S.wins++; else S.losses++; if (win && opt.boss != null && BOSSES[opt.boss]) { S.bw = S.bw || {}; S.bw[BOSSES[opt.boss].name] = (S.bw[BOSSES[opt.boss].name] || 0) + 1; } saveRow(S); }   // v192 보스를 이기면 대기방에 ★
          const pts = win && !early ? ((CFG.points && CFG.points.win) || 0) : 0;
          if (Hub.user && !early) { try { await Hub.submitScore({ game_id: GAME, score: S.wins, duration_sec: Math.round(B.t), result: win ? 'win' : 'lose', points_delta: pts, extra: { lv: LV, vs: opt.cpu ? 'cpu' : 'player', mode: modeName(opt.size) } }); } catch (e) { /* noop */ } }
          const ov = document.createElement('div'); ov.className = 'sf-over';
          ov.innerHTML = early ? `<div class="sf-card"><h3 style="justify-content:center;font-size:34px">무효 판</h3><p class="sub">${A.esc(early.nick || '상대')} 님이 시작 ${Hub.QUIT_SEC || 5}초 안에 나가서 승패·포인트 없이 끝났어요. 전적에 남지 않아요. · ${S.wins}승 ${S.losses}패</p><button type="button" class="sf-btn" data-again>대기방으로</button> <button type="button" class="sf-btn ghost" data-lobby>대기방</button></div>` : `<div class="sf-card"><h3 style="justify-content:center;font-size:34px">${opt.size === 4 ? TEAM[win ? me.team : 1 - me.team] + ' 승리!' + (win ? '' : ' (우리 편 패배…)') : (win ? '승리!' : '패배…')}</h3><p class="sub">${modeName(opt.size)} 대결 · ${anyLeft.v ? '나간 사람은 쓰러진 것으로 쳤어요. ' : ''}${S.wins}승 ${S.losses}패${win && pts && Hub.user ? ` · +${pts}P` : ''}</p><button type="button" class="sf-btn" data-again>${opt.cpu ? '다시 대결' : '대기방으로'}</button> <button type="button" class="sf-btn ghost" data-lobby>대기방</button></div>`;
          stage.querySelector('.sf-hud').appendChild(ov);
          ov.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const again = 'again' in b.dataset && opt.cpu; stop(); if (again) { if (opt.boss != null) startBoss(opt.boss); else startCpu(opt.diff); } });
        }
        function stop() {
          cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKey); document.removeEventListener('mouseup', atkUp);
          document.removeEventListener('mousemove', onMove); document.removeEventListener('pointerlockchange', onLockCh); window.removeEventListener('resize', onRs); document.removeEventListener('fullscreenchange', onFs);
          if (fsNow()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (er) { /* noop */ } }
          if (document.pointerLockElement) document.exitPointerLock();
          renderer.dispose(); battle = null;
          if (B.net) { send({ t: 'bye' }); if (roomCh) { roomCh.leave(); roomCh = null; } myRoom = null; isHost = false; roomPeers = []; seenHost = false; starting = false; lobbyCh && lobbyCh.track({ id: Hub.clientId }); }
          if (alive) renderLobby();
        }
        B.stop = stop; B.end = end;
        window.__scf = { B, me, units, scene, THREE, op: foes()[0], foes, castSlot, basicAttack, usePot, dash, card: CARD, cast: (q, aim) => cast(me, slotSpell(q), aim || null, false, 'qa' + Math.random()), hitU, myAim, end };   // 점검(테스트)용
        return B;
      }

      /* ================= 시작 ================= */
      (async () => {
        const rpg = await loadRow(CFG.levelFrom || 'rpg'); if (!alive) return;
        CARD = normCard(rpg && rpg.fc); if (window.__scfCard) CARD = normCard(window.__scfCard);   // __scfCard = 점검용
        BOSSES = bossList(window.__scfRpg || rpg);   // __scfRpg = 점검용 (보스 기록)
        LV = CARD.lv;
        av = Hub.user ? Hub.user.avatar : AV.normalize({});
        S = fixSave(await loadRow(GAME), LV);
        lobby(); renderLobby(); BGM.play();
      })();

      return () => {
        alive = false;
        if (battle) { try { battle.stop(); } catch (e) { /* noop */ } }
        if (roomCh) roomCh.leave(); if (lobbyCh) lobbyCh.leave();
        BGM.stop();
      };
    }
  };

  /* ================= 전장 — Skillcom 원본 (임진왜란 해질녘 전장 3곳) =================
   *  성벽 위(wall) · 판옥선 갑판(ship) · 관아 앞마당(gwana). 그림 하늘 + Meshy 소품 + 둥근 결투 마당 + 기둥 4개(숨을 곳)
   *  소품 자리 · 크기는 원본 mfworld.gd 의 _theme_wall / _theme_ship / _theme_gwana 를 따름 (마당이 원본보다 넓어서 그만큼 바깥으로) */
  const ARENA = 16;                     // 둥근 마당 반지름 (m)
  const blocks = [];
  const blocked = (x, z) => blocks.some(b => Math.abs(x - b.x) < b.w / 2 + 0.3 && Math.abs(z - b.z) < b.d / 2 + 0.3);
  function canvasTex(THREE, w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x, w, h); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t; }
  const glowC = {};
  function glowTex(THREE, col) { return glowC[col] || (glowC[col] = canvasTex(THREE, 64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, col); g.addColorStop(0.3, col + 'AA'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); })); }
  // 원본 theme_palette() 그대로
  const PAL = {
    wall: { top: '#37344A', hor: '#C8653A', fog: 0x7A6656, sun: 0xFFC994, sunE: 1.55, floor: ['#7C776D', '#5C5850', '#2A2622'] },
    ship: { top: '#2E3A4E', hor: '#B8693F', fog: 0x5E6670, sun: 0xFFD0A0, sunE: 1.6, floor: ['#6A4D34', '#4A3524', '#1A120B'] },
    gwana: { top: '#3A3436', hor: '#A85A32', fog: 0x6E6358, sun: 0xFFD2A0, sunE: 1.55, floor: ['#8C8475', '#6A6256', '#37312A'] }
  };
  // 바닥 무늬: 박석 돌판(kind 0) · 널빤지(kind 1)
  function floorTex(THREE, kind, c) {
    const t = canvasTex(THREE, 256, 256, (x) => {
      x.fillStyle = c[1]; x.fillRect(0, 0, 256, 256);
      if (kind === 1) { for (let j = 0; j < 16; j++) { const off = (j * 97) % 256; for (let i = -1; i < 3; i++) { const v = (j * 31 + i * 17) % 7; x.fillStyle = v < 3 ? c[0] : c[1]; x.fillRect(off + i * 128, j * 16 + 1, 126, 14); x.fillStyle = c[2]; x.fillRect(off + i * 128 + 126, j * 16, 2, 16); } x.fillStyle = c[2]; x.fillRect(0, j * 16, 256, 1); } }
      else { for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const o = j % 2 ? 16 : 0, v = (i * 7 + j * 13) % 5; x.fillStyle = v < 2 ? c[0] : c[1]; x.fillRect(i * 32 + o + 1, j * 32 + 1, 30, 30); x.globalAlpha = 0.12; x.fillStyle = '#000'; x.fillRect(i * 32 + o + 1 + (v * 5) % 20, j * 32 + 4 + v * 3, 6, 4); x.globalAlpha = 1; } x.fillStyle = c[2]; for (let j = 0; j <= 8; j++) x.fillRect(0, j * 32, 256, 2); for (let j = 0; j < 8; j++) for (let i = 0; i <= 8; i++) x.fillRect(i * 32 + (j % 2 ? 16 : 0), j * 32, 2, 32); }
    });
    t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function buildArena(THREE, scene, theme, pre) {
    blocks.length = 0; theme = PAL[theme] ? theme : 'wall';
    const P = PAL[theme], gl = (pre && pre.gl) || {};
    const lam = c => new THREE.MeshLambertMaterial({ color: c });
    const box = (w, h, d, mat, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
    const cyl = (rt, rb, h, mat, x, y, z, seg) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
    // 소품: 원본 _prop() 처럼 — 크기(size)를 축(axis 0=가로 1=높이 2=깊이)에 맞추고, 바닥 가운데를 pos 에
    function prop(name, x, y, z, yawDeg, size, axis) {
      const g = gl[name]; if (!g) return null;
      const n = g.scene.clone(true), bx = new THREE.Box3().setFromObject(n), sz = new THREE.Vector3(); bx.getSize(sz);
      const k = size / Math.max(0.001, [sz.x, sz.y, sz.z][axis || 0]), c = bx.getCenter(new THREE.Vector3());
      const w = new THREE.Group(); n.position.set(-c.x * k, -bx.min.y * k, -c.z * k); n.scale.setScalar(k); w.add(n);
      w.position.set(x, y, z); w.rotation.y = (yawDeg || 0) * Math.PI / 180;
      n.traverse(o => { if (o.isMesh) { o.receiveShadow = true; } }); scene.add(w); return w;   // 소품은 그림자를 안 드리움 (느린 컴퓨터·휴대폰 배려)
    }
    // 하늘: 원본 그림 하늘 (없으면 노을 그라데이션)
    if (pre && pre.sky) { const sk = pre.sky; sk.mapping = THREE.EquirectangularReflectionMapping; sk.encoding = THREE.sRGBEncoding; scene.background = sk; }
    else { scene.background = canvasTex(THREE, 4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, P.top); g.addColorStop(0.55, P.hor); g.addColorStop(1, '#2A2018'); x.fillStyle = g; x.fillRect(0, 0, w, h); }); scene.background.magFilter = THREE.LinearFilter; }
    scene.fog = new THREE.Fog(P.fog, 45, 140);
    scene.add(new THREE.HemisphereLight(0xFFE6CC, 0x3A3040, 0.8));
    const fill = new THREE.DirectionalLight(0xFFE0C0, 0.35); fill.position.set(6, 8, 18); scene.add(fill);   // 앞에서 비추는 약한 빛 (장수 얼굴이 어둡지 않게)
    const sun = new THREE.DirectionalLight(P.sun, P.sunE * 0.62); sun.position.set(-14, 18, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24 }); scene.add(sun);
    // 결투 마당 (원반) + 금테
    const ft = floorTex(THREE, theme === 'ship' ? 1 : 0, P.floor); ft.repeat.set(ARENA / 4, ARENA / 4);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(ARENA + 0.4, ARENA + 0.6, 0.3, 64), [new THREE.MeshLambertMaterial({ color: P.floor[2] }), new THREE.MeshLambertMaterial({ map: ft }), lam(P.floor[2])]);
    disc.position.y = -0.15; disc.receiveShadow = true; scene.add(disc);
    const edge = new THREE.Mesh(new THREE.RingGeometry(ARENA - 0.15, ARENA + 0.15, 96), new THREE.MeshBasicMaterial({ color: 0xC9A040 })); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.02; scene.add(edge);
    const mid = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.5, 48), new THREE.MeshBasicMaterial({ color: 0xB8322A })); mid.rotation.x = -Math.PI / 2; mid.position.y = 0.02; scene.add(mid);
    const R = ARENA + 1.2, stone = lam(0x6E6A63), red = lam(0x8E2F24), tile = lam(0x2E333A), wood = lam(0x4A3524);
    if (theme === 'wall') {
      // 🧱 성벽 위 — 성벽 몸통 · 성가퀴(줄지어) · 문루(상대 뒤) · 봉수대 · 아래 성 밖 땅
      const gnd = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), lam(0x3A2F25)); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -7; scene.add(gnd);
      cyl(R + 2.3, R + 2.8, 7.1, stone, 0, -3.65, 0, 48);
      const pr = R + 2.0, n = Math.round(Math.PI * 2 * pr / 3.6);
      for (let i = 0; i < n; i++) { const a = Math.PI * 2 * (i + 0.5) / n; if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.42) continue;
        const pp = prop('wall_parapet', Math.cos(a) * pr, 0, Math.sin(a) * pr, -a * 180 / Math.PI + 90, Math.PI * 2 * pr / n * 1.04, 0); if (pp) pp.scale.y = 2; else box(1.2, 1.1, 0.45, lam(0x74716B), Math.cos(a) * pr, 0.55, Math.sin(a) * pr, -a + Math.PI / 2); }
      if (!prop('wall_gate', 0, 0, -(R + 2.6), 0, 12, 0)) { box(7.6, 0.6, 4, stone, 0, 0.3, -(R + 2.6)); box(8.6, 0.5, 5, tile, 0, 4.2, -(R + 2.6)); }
      const ba = -Math.PI / 2 + 0.95, bp = [Math.cos(ba) * (R + 5), Math.sin(ba) * (R + 5)];
      if (prop('wall_beacon', bp[0], 0, bp[1], -ba * 180 / Math.PI + 90, 6, 2)) cyl(3.4, 3.8, 7.1, stone, bp[0], -3.55, bp[1], 16);
    } else if (theme === 'ship') {
      // 🚢 판옥선 갑판 — 바다 · 갑판 · 주칠 난간 · 지휘 누각(상대 뒤) · 곁에 뜬 판옥선 · 거북선
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshPhongMaterial({ color: 0x2C4A5E, shininess: 60, specular: 0x8A6A50 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -1.7; scene.add(sea);
      const hw = R + 1.6, hl = R + 5, deck = floorTex(THREE, 1, ['#5E4430', '#41301F', '#17100A']); deck.repeat.set(hw / 4, hl / 4);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 2.2, hl * 2), [lam(0x41301F), lam(0x41301F), new THREE.MeshLambertMaterial({ map: deck }), lam(0x2A1E14), lam(0x41301F), lam(0x41301F)]); hull.position.y = -1.25; hull.receiveShadow = true; scene.add(hull);
      const lac = lam(0x8E2F24);
      for (let z = -hl; z <= hl; z += 2.5) [-1, 1].forEach(sx => cyl(0.07, 0.07, 1, lac, sx * (hw - 0.1), 0.4, z, 6));
      for (let x = -hw; x <= hw; x += 2.5) [-1, 1].forEach(sz => cyl(0.07, 0.07, 1, lac, x, 0.4, sz * hl, 6));
      [-1, 1].forEach(sx => box(0.1, 0.1, hl * 2, lac, sx * (hw - 0.1), 0.95, 0)); [-1, 1].forEach(sz => box(hw * 2, 0.1, 0.1, lac, 0, 0.95, sz * hl));
      [-1, 1].forEach(sx => box(0.1, 0.5, hl * 2, lam(0x2A6B5A), sx * (hw + 0.05), -0.65, 0));
      if (!prop('ship_tower', 0, 0, -(R + 3.4), 0, 6.5, 1)) { box(5.4, 1, 3.2, wood, 0, 0.5, -(R + 3.4)); box(6.6, 1.2, 4.4, tile, 0, 3.6, -(R + 3.4)); }
      prop('ship_panok', -(hw + 13), -3.3, -(R + 2), 90, 26, 0);
      prop('ship_turtle', hw + 12, -2.7, -(R + 10), 115, 16, 0);
    } else {
      // 🏛 관아 앞마당 — 박석 · 홍살문(상대 뒤, 도형) · 관아 두 채 · 천자총통 · 무기더미 · 방책
      const gnd = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), lam(0x4A3D30)); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -0.31; scene.add(gnd);
      const hz = -(R + 6), lac = lam(0x9A2A20);
      [-3.3, 3.3].forEach(x => { cyl(0.2, 0.24, 7.2, lac, x, 3.6, hz); box(0.75, 0.5, 0.75, stone, x, 0.25, hz); });
      [5.6, 6.75].forEach(y => box(7.4, 0.3, 0.26, lam(0x2A6B5A), 0, y, hz));
      for (let k = 0; k < 13; k++) cyl(0.035, 0.045, 1.2, lac, -3 + k * 0.5, 6.15, hz, 6);
      const tg = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), new THREE.MeshBasicMaterial({ color: 0xB8322A })); tg.position.set(0, 7.3, hz + 0.05); scene.add(tg);
      const tg2 = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: 0x1F4E9C })); tg2.position.set(0, 7.3, hz + 0.06); scene.add(tg2);
      [-1, 1].forEach(side => {
        const x = side * (R + 6), z = -(R + 1), yaw = -side * 35;
        if (!prop('gwana_hall', x, 0, z, yaw, 12, 0)) { box(8, 2.8, 3.8, lam(0xB5AA94), x, 1.4, z, yaw * Math.PI / 180); box(9, 1.2, 5, tile, x, 3.4, z, yaw * Math.PI / 180); }
        prop('gwana_cannon', side * (R - 1.5), 0, -4, side > 0 ? -70 : 70, 2.6, 0);
        prop('gwana_arms', side * (R - 1.2), 0, 5, side * 30, 2.2, 0);
      });
      for (let i = -5; i <= 5; i++) prop('gwana_fence', i * 3.2, 0, R + 2.5, 180, 3.3, 0);
    }
    // 🏮 기둥 4개 (숨을 곳) — 주칠 기둥 · 화강암 주춧돌 · 기와 지붕 · 청사초롱 (원본 기둥 모양)
    const lanG = new THREE.MeshBasicMaterial({ color: 0xFF7A3A });
    [[-6, -3.5], [6, 3.5], [-6, 4], [6, -4]].forEach(([x, z]) => {
      box(1.5, 0.5, 1.5, stone, x, 0.25, z);
      cyl(0.48, 0.55, 3.2, red, x, 2.1, z, 12);
      box(1.2, 0.25, 1.2, lam(0x2A6B5A), x, 3.75, z);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.9, 4), tile); roof.position.set(x, 4.3, z); roof.rotation.y = Math.PI / 4; roof.castShadow = true; scene.add(roof);
      const lan = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 8), lanG); lan.position.set(x + 0.62, 3.2, z); scene.add(lan);
      blocks.push({ x, z, w: 1.2, d: 1.2 });
    });
  }
  // 컴퓨터 상대 모습 (임시 — Skillcom 원본 상대로 바꿀 자리): 아바타 옷으로 만든 장수
  function makeEnemyAvatar(k) {
    if (k === 'ally') return { skin: 's1', hair: 'h_topknot', hat: 'hat_gat', face: 'f_beard', top: 't_armor', bottom: 'b_armor', shoes: 'sh_boots', back: 'bk_cape' };   // 내 편 장수 (조선)
    if (k === 2) return { skin: 's1', hair: 'h_spiky', hat: 'hat_darkhelm', face: 'f_mask', top: 't_darkarmor', bottom: 'b_ninja', shoes: 'sh_black', back: 'bk_darkcape' };
    return { skin: 's1', hair: 'h_topknot', hat: 'hat_darkhelm', face: 'f_mustache', top: 't_samurai', bottom: 'b_armor', shoes: 'sh_black', back: 'bk_darkcape' };
  }
  function cpuStat(lv) { const st = {}, pts = (lv - 1) * PER; const keys = ['str', 'vit', 'dex', 'int']; for (let i = 0; i < pts; i++) { const k = keys[i % 4]; st[k] = Math.min(MAXS, (st[k] || 0) + 1); } return st; }
  function pickN(a, n) { const c = a.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c.slice(0, n); }

  // 게임 카드 그림
  window.GoGames = window.GoGames || {};
  window.GoGames.scfight = {
    id: 'scfight',
    thumb(ctx, w, h) {
      // v84 카드 그림 = 선생님이 주신 그림(img/thumb.jpg). 받기 전에는 아래 그림, 받으면 다시 그림
      const T = window.GoSCFThumb || (window.GoSCFThumb = Object.assign(new Image(), { src: 'games/action/scfight/img/thumb.jpg?v=84' }));
      if (T.complete && T.naturalWidth) { ctx.imageSmoothingEnabled = true; ctx.drawImage(T, 0, 0, w, h); return; }
      T.addEventListener('load', () => { try { this.thumb(ctx, w, h); } catch (e) { /* noop */ } }, { once: true });
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2A1E4A'); g.addColorStop(0.6, '#C8605A'); g.addColorStop(1, '#F5B060'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#8A7A68'; ctx.fillRect(0, h * 0.55, w, h * 0.12); for (let x = 0; x < w; x += 16) ctx.fillRect(x, h * 0.5, 10, h * 0.06);
      ctx.fillStyle = '#B09A80'; ctx.fillRect(0, h * 0.67, w, h * 0.33);
      [[w * 0.3, '#FF6A3D'], [w * 0.7, '#7FD8FF']].forEach(([x, c]) => { const r = ctx.createRadialGradient(x, h * 0.5, 2, x, h * 0.5, 30); r.addColorStop(0, '#FFFFFF'); r.addColorStop(0.4, c); r.addColorStop(1, c + '00'); ctx.fillStyle = r; ctx.fillRect(x - 30, h * 0.5 - 30, 60, 60); });
      ctx.font = '20px "Jua", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#1D2340'; ctx.strokeText('1 + 2 = 융합!', w / 2, h * 0.88); ctx.fillStyle = '#FFE45C'; ctx.fillText('1 + 2 = 융합!', w / 2, h * 0.88);
    }
  };
})();
