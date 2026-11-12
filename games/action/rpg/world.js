/*
 * gogo?gogo! — skillcom RPG · 세계 그리기 (지도 만들기 · 지도/건물/몬스터/아바타+장비 그림)
 *   game.js 가 window.__GoRPGParts 로 가져다 씀
 *
 *  화면: 960 × 540 캔버스 (칸 32px) + 아래 메뉴 버튼 + 창(가방·마법·가게…) + 랭킹(레벨)
 *  캐릭터: 사이트 아바타 그대로 (GoAvatar). 장비는 아바타 위에 겹쳐 그림 → 가방 창 '장비 안보이기' 를 켜면
 *          그림만 숨기고 능력치는 그대로
 *  세계: data.js 의 MAPS (마을 9 + 사냥터 90, 왼쪽 끝 = 이전 지도, 오른쪽 끝 = 다음 지도)
 *  저장: 이 기기(localStorage) + 로그인하면 서버(game_saves 표 · supabase/rpg_v40.sql)
 *        둘 중 더 최근 것을 불러옴. 서버 표가 아직 없으면 이 기기에만 저장
 *  조작: WASD/방향키 이동 · Space/J 공격 · 1~4 마법 · Q/E 포션 · I 가방 · K 마법 · F/Enter 들어가기 · Esc 닫기
 *        휴대폰: 왼쪽 조이스틱, 오른쪽 공격·마법·포션 버튼 (캔버스 위에 그림)
 */
(function () {
  'use strict';
  const D = window.GoRPGData, AV = window.GoAvatar, Hub = window.GameHub, BGM = window.GoBGM;
  const CFG = window.GoSettings.get('rpg');
  const W = 960, H = 540, TS = 32;
  const SAVE_V = 1, GAME = 'rpg';
  const MAPBY = {}; D.MAPS.forEach(m => { MAPBY[m.id] = m; });

  /* ================= 작은 도구 ================= */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const fmtN = n => Math.round(n).toLocaleString('ko-KR');
  function seeded(seed) {
    let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; };

  /* ================= 지도 만들기 =================
   * 칸 값: 0 땅 · 1 길 · 2 장애물(큰) · 3 장애물(작은) · 4 물 · 5 꽃(지나갈 수 있음) · 6 건물 · 7 문 · 8 분수 · 9 대장간(v60) */
  const SOLID = { 2: 1, 3: 1, 4: 1, 6: 1, 8: 1, 9: 1, 10: 1, 11: 1 };   // 9 = v60 대장간 · 10 = v80 진영 소품(천막·대포…) · 11 = v85 역참
  const mapCache = {};
  /* v120 연못 그림: t = 칸(32px) 지도 · W 물(못 지나감) · r 물가(지나감, 나무·꽃 안 놓음 = 칸 12) · . 빈칸 */
  /* v128 던전 입구 그림 (선생님 시안 · img/v79/dg_*.png, 칸에 맞춘 그림) · t: X 막힘(칸 10) · D 입구(칸 13, 지나감 · 나중에 다른 맵으로) · r 둘레(칸 12) · . 빈칸 */
  const DUNGEON = {"dg_cave":{"w":224,"h":160,"t":["..rXr..",".rXXXr.","rXXXXXr","rXXDXXr",".XXDXX."]},"dg_ruin":{"w":192,"h":192,"t":["......",".rXXr.",".XXXX.","XXXXXX","XXDXXX","rXDrXX"]}}, DUNGEON_KEYS = ['dg_cave', 'dg_ruin'];
  const POND = {"pond_s":{"w":81,"h":75,"t":["rr.","rWr","..."]},"pond_m":{"w":166,"h":129,"t":[".rrrr.","rWWWr.","rWWWr.","rrWr..","......"]},"pond_l":{"w":206,"h":189,"t":[".rrrrr.","rrWWWr.","rWWWWWr","rWWWWWr","rrWWWr.","rrrrrr."]}}, POND_KEYS = ['pond_s', 'pond_m', 'pond_l'], POND_REG = [0, 1, 2, 3, 4, 7];
  /* v130 성(도원수 진영) 그림 bld_castle.png (820×673) 의 문 자리 → 지도 좌표 (game.js drawObj 와 같은 크기·자리)
   *  A·B = 두 낮은 담 사이 통로가 성벽에 닿는 왼쪽·오른쪽 끝 · u = 통로가 뻗는 쪽(왼쪽 아래, 낮은 담과 나란히) · 박석 길과 들어가는 칸(문 칸)을 여기에 맞춤 */
  function castleGeo(b) {
    const ww = b.w * TS + 90, s = ww / 820, L = (b.x + b.w / 2) * TS - ww / 2, T = (b.y + b.h) * TS + 6 - 673 * s;
    const P = (ix, iy) => [L + ix * s, T + iy * s];
    return { A: P(172, 522), B: P(500, 545), u: [-142 * s, 63 * s] };   // A·B = 양쪽 낮은 담 사이 통로 안쪽 끝(성벽 밑)
  }
  function getMap(id) {
    if (mapCache[id]) return mapCache[id];
    const M = MAPBY[id], R = D.REGIONS[M.region], rnd = seeded('gogo-rpg-' + id);
    const w = M.kind === 'village' ? 36 : 50, h = M.kind === 'village' ? 24 : 34;
    const t = new Uint8Array(w * h), at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 2 : t[y * w + x]), set = (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) t[y * w + x] = v; };
    const mid = M.kind === 'village' ? 9 : Math.floor(h / 2);
    const map = { id, M, R, w, h, t, at, set, mid, buildings: [], doors: [], spawns: [] };
    // 테두리
    for (let x = 0; x < w; x++) { set(x, 0, 2); set(x, h - 1, 2); }
    for (let y = 0; y < h; y++) { set(0, y, 2); set(w - 1, y, 2); }
    if (M.kind === 'village') {
      for (let x = 0; x < w; x++) { set(x, mid, 1); set(x, mid + 1, 1); }
      const bs = D.BUILDINGS.map(b => Object.assign({}, b));
      if (R.castle) bs.push(Object.assign({}, D.CASTLE));
      bs.forEach(b => {
        for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) set(x, y, 6);
        b.door = { x: b.x + Math.floor(b.w / 2), y: b.y + b.h - 1 };
        if (b.type === 'castle') {   // v130 문 칸 = 그림 속 문 앞 통로가 맨 아랫줄 칸을 지나는 곳
          const g = castleGeo(b), yc = (b.door.y + 0.5) * TS, t = (yc - (g.A[1] + g.B[1]) / 2) / g.u[1];
          b.door.x = Math.floor(((g.A[0] + g.B[0]) / 2 + t * g.u[0]) / TS);
        }
        set(b.door.x, b.door.y, 7);
        map.buildings.push(b); map.doors.push(b);
      });
      // 문 → 큰길
      bs.forEach(b => {
        if (b.door.y < mid) { for (let y = b.door.y + 1; y < mid; y++) set(b.door.x, y, 1); }
        else {      // 큰길 아래 건물(성): 양옆으로 내려가 문 앞까지 길
          const yb = b.door.y + 1;
          for (let y = mid + 2; y <= yb; y++) { set(b.x - 2, y, 1); set(b.x + b.w + 1, y, 1); }
          for (let x = b.x - 2; x <= b.x + b.w + 1; x++) set(x, yb, 1);
        }
      });
      if (!R.castle) { set(17, 14, 8); set(18, 14, 8); set(17, 15, 8); set(18, 15, 8); for (let x = 15; x <= 20; x++) { set(x, 13, 1); set(x, 16, 1); } for (let y = 13; y <= 16; y++) { set(15, y, 1); set(20, y, 1); } for (let y = mid + 2; y < 13; y++) set(17, y, 1); }
      // 나무 몇 그루 · 꽃
      for (let i = 0; i < 70; i++) { const x = 1 + Math.floor(rnd() * (w - 2)), y = 1 + Math.floor(rnd() * (h - 2)); if (at(x, y) === 0 && Math.abs(y - mid) > 2 && !nearDoor(map, x, y)) set(x, y, rnd() < 0.35 ? 2 : 5); }
      // v60 대장간 (마을마다 하나 · 3×2 칸) + 큰길에서 내려오는 작은 길. 대장장이는 대장간 앞에 섬 (game.js)
      const fx0 = R.castle ? 16 : 27, fy0 = 14;
      for (let y = fy0 - 1; y <= fy0 + 4; y++) for (let x = fx0 - 2; x <= fx0 + 4; x++) if ([2, 3, 5].includes(at(x, y))) set(x, y, 0);
      for (let y = fy0; y < fy0 + 2; y++) for (let x = fx0; x < fx0 + 3; x++) set(x, y, 9);
      for (let y = mid + 2; y <= fy0 + 3; y++) set(fx0 - 1, y, 1);
      for (let x = fx0 - 1; x <= fx0 + 3; x++) set(x, fy0 + 3, 1);
      map.forge = { x: fx0, y: fy0, w: 3, h: 2 };
      // v85 역참 (4×2 칸, 오른쪽 아래 · 마지막 마을은 왼쪽 아래) + 역참지기 자리 + 길
      const st = R.castle ? { x: 1, y: 19, w: 4, h: 2, nx: 5.6, path: 5 } : { x: 30, y: 19, w: 4, h: 2, nx: 29.4, path: 29 };
      for (let y = st.y - 2; y <= st.y + st.h; y++) for (let x = st.x - 1; x <= st.x + st.w; x++) if ([2, 3, 5].includes(at(x, y))) set(x, y, 0);
      for (let y = st.y; y < st.y + st.h; y++) for (let x = st.x; x < st.x + st.w; x++) set(x, y, 11);
      for (let y = R.castle ? mid + 2 : fy0 + 3; y <= st.y + st.h; y++) set(st.path, y, 1);
      for (let x = Math.min(st.path, st.x); x <= Math.max(st.path, st.x + st.w - 1); x++) set(x, st.y + st.h, 1);
      map.station = st;
      villageRoads(map, rnd);   // v109 직각 길 → 부드럽게 굽은 흙길·마당·디딤돌 (칸도 새 길 모양에 맞춤)
      armyCamp(map, rnd);   // v80 임진왜란 진영 꾸미기 (천막·대포·깃발 + 조선 병사 · 다친 병사)
    } else {
      if (M.hell) {   // 저승: 예전 칸 길 그대로
        let y = mid;
        for (let x = 0; x < w; x++) {
          for (let k = -1; k <= 1; k++) set(x, y + k, 1);
          if (x > 3 && x < w - 4 && rnd() < 0.35) y = clamp(y + (rnd() < 0.5 ? -1 : 1), 5, h - 6);
          if (x >= w - 6) y += Math.sign(mid - y);
        }
      } else fieldRoad(map, rnd);   // v110 사냥터 길도 마을처럼 부드럽게 굽은 흙길
      // 연못 · v120 선생님 그림 연못(작은·중간·큰 3가지, img/v79/pond_*.png)을 통째로 놓음 (풀밭 지역) · 그 밖(눈·용굴·용암·저승)은 예전 칸 연못
      const ponds = 2 + Math.floor(rnd() * 3);
      if (!M.hell && POND_REG.includes(M.region)) {
        map.ponds = [];
        for (let p = 0, tries = 0; p < ponds && tries < 80; tries++) {
          const k = POND_KEYS[Math.floor(rnd() * 3)], PD = POND[k], tw = PD.t[0].length, th = PD.t.length;
          const x0 = 4 + Math.floor(rnd() * (w - 8 - tw)), y0 = 2 + Math.floor(rnd() * (h - 4 - th));
          let okP = true;
          for (let j = 0; j < th && okP; j++) for (let i = 0; i < tw && okP; i++) {
            if (PD.t[j][i] === '.') continue;
            if (at(x0 + i, y0 + j) !== 0) okP = false;
            for (let b = -1; b <= 1 && okP; b++) for (let a = -1; a <= 1; a++) { const v = at(x0 + i + a, y0 + j + b); if (v === 1 || v === 7 || v === 12) okP = false; }
          }
          if (!okP) continue;
          for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) { const c = PD.t[j][i]; if (c === 'W') set(x0 + i, y0 + j, 4); else if (c === 'r') set(x0 + i, y0 + j, 12); }
          map.ponds.push({ k, x: x0, y: y0 }); p++;
        }
      } else for (let p = 0; p < ponds; p++) {
        const cx = 6 + rnd() * (w - 12), cy = 4 + rnd() * (h - 8), rx = 2 + rnd() * 3, ry = 1.5 + rnd() * 2;
        for (let yy = Math.floor(cy - ry); yy <= cy + ry; yy++) for (let xx = Math.floor(cx - rx); xx <= cx + rx; xx++) {
          if (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1 && at(xx, yy) === 0 && !(map.roads && [-1, 0, 1].some(j => [-1, 0, 1].some(k => at(xx + j, yy + k) === 1)))) set(xx, yy, 4);   // v110 굽은 길 바로 옆엔 연못 안 만듦
        }
      }
      for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
        if (at(xx, yy) !== 0) continue;
        let nearPath = false; for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) if (at(xx + j, yy + k) === 1) nearPath = true;
        if (nearPath || xx < 3 || xx > w - 4) { if (rnd() < 0.05) set(xx, yy, 5); continue; }
        const r = rnd();
        if (r < 0.085) set(xx, yy, 2); else if (r < 0.12) set(xx, yy, 3); else if (r < 0.18) set(xx, yy, 5);
      }
    }
    // 출구 (왼쪽 · 오른쪽)
    map.exitL = M.prev ? M.prev : null; map.exitR = M.next ? M.next : null;
    for (let k = -2; k <= 3; k++) {
      if (map.exitL) { set(0, mid + k, 1); set(1, mid + k, at(1, mid + k) === 2 || at(1, mid + k) === 3 ? 0 : at(1, mid + k)); }
      if (map.exitR) { set(w - 1, mid + k, 1); set(w - 2, mid + k, at(w - 2, mid + k) === 2 || at(w - 2, mid + k) === 3 ? 0 : at(w - 2, mid + k)); }
    }
    map.startL = { x: 2.5 * TS, y: (mid + 1) * TS };
    map.startR = { x: (w - 2.5) * TS, y: (mid + 1) * TS };
    // 갈 수 없는 빈칸은 막기 (몬스터가 갇히지 않게) + 몬스터가 나올 칸 목록
    const seen = new Uint8Array(w * h), q = [[2, mid]]; seen[mid * w + 2] = 1;
    while (q.length) {
      const [x, y] = q.pop();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || SOLID[at(nx, ny)]) return; seen[ny * w + nx] = 1; q.push([nx, ny]); });
    }
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const v = at(xx, yy); if (SOLID[v]) continue;
      if (!seen[yy * w + xx]) { set(xx, yy, 3); continue; }
      if (M.kind === 'field' && xx > 6 && xx < w - 7 && v !== 7) map.spawns.push({ x: (xx + 0.5) * TS, y: (yy + 0.8) * TS });
    }
    map.ground = paintGround(map);
    mapCache[id] = map;
    // 그림이 큰 지도(사냥터 1장 ≈ 7MB)가 쌓이지 않게 최근 4개만 남김 (다시 들어가면 같은 모양으로 다시 만듦)
    const ids = Object.keys(mapCache); if (ids.length > 4) delete mapCache[ids[0]];
    return map;
  }
  /* ---------- v124 맵 만들기(관리자): 직접 그린 맵 → 게임과 같은 그림 ----------
   *  def = { w, h, region, t: [칸 번호 w*h 개], ponds: [{ k: 'pond_s'|'pond_m'|'pond_l', x, y }] }
   *  칸 번호: 0 풀(바닥) · 1 길 · 2 나무 · 3 바위 · 4 물 · 5 꽃 · 12 연못 물가(지나감)
   *  돌려줌: { ground(땅 그림 캔버스), objs(나무·바위 그림), need(아직 못 받은 그림 이름) } */
  function previewMap(def, id) {
    const w = def.w, h = def.h, t = Uint8Array.from(def.t);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 2 : t[y * w + x]), set = (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) t[y * w + x] = v; };
    const M = { id: id || 'edit', kind: 'field', region: def.region || 0 }, R = D.REGIONS[M.region];
    const map = { id: M.id, M, R, w, h, t, at, set, mid: Math.floor(h / 2), buildings: [], doors: [], spawns: [], ponds: (def.ponds || []).slice() };
    const dgs = (def.dungeons || []).filter(d => DUNGEON[d.k]);
    const need = texOf(map).concat(map.ponds.map(p => p.k), dgs.map(d => d.k)).filter(n => !img79(n));
    map.ground = paintGround(map);
    dgs.forEach(d => { const im = img79(d.k), DG = DUNGEON[d.k]; if (im) map.objs.push({ img: im, x: d.x * TS, y: d.y * TS, sy: d.y * TS + DG.h - 4, tx: d.x, ty: d.y, kind: 'dungeon' }); });   // v128 던전 입구 (사람과 앞뒤 순서 맞춤)
    return { ground: map.ground, objs: map.objs, need, map };
  }
  // 맵 만들기 화면에서 나무·바위 하나 그리기 (게임과 같은 그림: Meshy 그림이 있으면 그것, 없으면 예전 그림)
  function drawMapObj(c, o) {
    const alt = o.kind !== 'dungeon' && ((o.alt2 && img79(o.alt2)) || (o.alt && imgOk(o.alt)));
    if (alt) c.drawImage(alt, Math.round(o.tx * TS + 16 - alt.naturalWidth / 2), Math.round((o.ty + 1) * TS - alt.naturalHeight + 2));
    else c.drawImage(o.img, o.x, o.y);
  }
  /* ---------- v80 마을 = 조선군 진영 (Meshy 그림 img/v79/) ----------
   *  소품은 칸 10(지나갈 수 없음)으로 막고 그림은 map.objs 로 (사람과 앞뒤 순서 맞춤)
   *  병사·다친 병사·군의관 자리는 map.army → room.js villagers() 가 사람(NPC)으로 만듦 */
  const CAMP_PROPS = [   // n 그림 · x,y 왼쪽 위 칸 · fw,fh 막는 칸 · pw 그림 폭(px)
    { n: 'prop_tent', x: 13, y: 4, fw: 3, fh: 2, pw: 118 }, { n: 'prop_flags', x: 20, y: 5, fw: 2, fh: 1, pw: 78 },
    { n: 'prop_beacon', x: 1, y: 5, fw: 2, fh: 2, pw: 78 }, { n: 'prop_shield', x: 33, y: 5, fw: 2, fh: 1, pw: 74 },
    { n: 'prop_cart', x: 3, y: 19, fw: 3, fh: 2, pw: 104 }, { n: 'prop_jars', x: 13, y: 19, fw: 2, fh: 2, pw: 80 },
    { n: 'prop_cannon', x: 22, y: 19, fw: 3, fh: 2, pw: 108 }, { n: 'prop_fence', x: 8, y: 21, fw: 3, fh: 1, pw: 100 }
  ];
  function armyCamp(map, rnd) {
    const { at, set, w, h } = map, last = !!map.R.castle;
    const free = p => { for (let y = p.y; y < p.y + p.fh; y++) for (let x = p.x; x < p.x + p.fw; x++) if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || ![0, 2, 3, 5].includes(at(x, y))) return false; return true; };
    map.props = [];
    CAMP_PROPS.forEach((p, i) => {
      if (!last && i > 1 && rnd() < 0.3) return;   // 마을마다 조금씩 다르게 (마지막 진영은 전부)
      if (!free(p)) return;
      for (let y = p.y - 1; y <= p.y + p.fh; y++) for (let x = p.x - 1; x <= p.x + p.fw; x++) if ([2, 3].includes(at(x, y))) set(x, y, 0);
      for (let y = p.y; y < p.y + p.fh; y++) for (let x = p.x; x < p.x + p.fw; x++) set(x, y, 10);
      map.props.push(p);
    });
    // 사람 자리 (kind = data.js ARMY 의 열쇠) — 걷는 병사는 큰길 · 아래 빈 땅에서 좌우로 순찰
    const ri = map.M.region, A = [];
    A.push({ k: 'spear', x: 8, y: map.mid + 0.75, range: 90 }, { k: ri % 2 ? 'bow' : 'militia', x: 29, y: map.mid + 1.8, range: 80 });
    A.push({ k: ['porter', 'monk', 'militia', 'spear'][ri % 4], x: 19, y: 19.6, range: 110 });
    A.push({ k: 'horse', x: 20, y: 22.2, range: 240, spd: 66 });
    if (last) A.push({ k: 'general', x: 21, y: map.mid - 0.4, range: 0 });
    // 다친 병사 + 군의관 (천막 앞 또는 항아리 옆)
    const tent = map.props.find(p => p.n === 'prop_tent');
    if (tent) A.push({ k: 'hurt1', x: tent.x + 0.8, y: tent.y + 3.1, still: true }, { k: 'doctor', x: tent.x + 2.9, y: tent.y + 3.0, range: 0 });
    A.push({ k: 'hurt2', x: 16.6, y: 21.3, still: true });
    A.forEach(a => { if (!a.range) return; const ty = Math.floor(a.y), r = Math.ceil(a.range / TS) + 1; for (let x = Math.floor(a.x) - r; x <= Math.floor(a.x) + r; x++) if ([2, 3].includes(at(x, ty))) set(x, ty, 0); });   // 순찰 길의 나무·바위 치움
    map.army = A.filter(a => { const tx = Math.floor(a.x), ty = Math.floor(a.y); return !SOLID[at(tx, ty)]; });
  }
  /* v109 마을 길: 직각 칸 길 대신 굽은 흙길(곡선) · 문 앞 마당 · 분수 둥근 마당
   *  map.roads = [{ pts: [[x, y] …] (칸 좌표, 곡선이 지나는 점), w: 폭(칸), main }] · map.plazas = [{ x, y, r }]
   *  칸 값도 새 길 모양에 맞춰 다시 정함 (가운데가 길 안이면 1, 예전 길이었는데 벗어나면 0) */
  // 캣멀롬 곡선 위 점들을 촘촘히 (칸 좌표)
  function denseCurve(pts) {
    const out = [], P = i => pts[Math.max(0, Math.min(pts.length - 1, i))];
    for (let i = 0; i < pts.length - 1; i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let t = 0; t < 1; t += 0.1) { const t2 = t * t, t3 = t2 * t, f2 = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); out.push([f2(p0[0], p1[0], p2[0], p3[0]), f2(p0[1], p1[1], p2[1], p3[1])]); } }
    out.push(pts[pts.length - 1]); return out;
  }
  /* v110 사냥터 길: 왼쪽 출구 → 오른쪽 출구, 6칸마다 높이가 조금씩 바뀌는 굽은 길 (폭 2.9칸)
   *  양 끝 5칸은 출구 높이(mid)에 맞춤 · 칸 값: 길 가운데가 곡선에서 폭/2 안이면 1 · 그리기는 마을과 같은 drawRoads */
  function fieldRoad(map, rnd) {
    const { w, h, set, mid } = map, cy = mid + 0.5, pts = [[-1, cy], [2, cy], [5, cy]];
    let y = cy;
    for (let x = 10; x < w - 11; x += 5 + Math.floor(rnd() * 3)) { y = clamp(y + (rnd() - 0.5) * 6, 5.5, h - 6.5); pts.push([x, y]); }
    pts.push([w - 8, (y + cy) / 2], [w - 5, cy], [w - 2, cy], [w + 1, cy]);
    const road = { pts, w: 2.9, main: true }; road.d = denseCurve(pts);
    map.roads = [road]; map.plazas = [];
    for (let ty = 1; ty < h - 1; ty++) for (let tx = 0; tx < w; tx++) {
      const X = tx + 0.5, Y = ty + 0.5;
      if (road.d.some(([a, b]) => (a - X) ** 2 + (b - Y) ** 2 <= (road.w / 2) ** 2)) set(tx, ty, 1);
    }
  }
  function villageRoads(map, rnd) {
    const { w, h, at, set, mid } = map, last = !!map.R.castle, cy = mid + 1;   // 큰길 가운데 줄(칸 경계 기준)
    const mainY = x => cy + 0.5 * Math.sin((x + 3) * 0.26) + 0.18 * Math.sin(x * 0.71 + 1.3);
    const roads = [], plazas = [];
    const main = []; for (let x = -1; x <= w + 1; x += 0.5) main.push([x, mainY(x)]);
    roads.push({ pts: main, w: 2.35, main: true });
    const join = x => [x, mainY(x) + 0.6];
    map.doors.forEach(b => {
      const dx = b.door.x + 0.5, dy = b.door.y + 1;
      if (dy < cy) {   // 큰길 위 건물: 문 앞에서 살짝 휘어 큰길로
        const ex = dx + (dx < w / 2 ? 1.2 : -1.2);
        roads.push({ pts: [[dx, dy + 0.1], [dx + (ex - dx) * 0.25, dy + 0.9], [ex, mainY(ex) - 0.3]], w: 1.45 });
        plazas.push({ x: dx, y: dy + 0.35, r: 1.15, door: true });
      } else if (b.type === 'castle') {   // 성: 양옆으로 돌아 내려가 문 앞 넓은 마당
        const L = b.x - 1.4, Rr = b.x + b.w + 1.4, fy = b.y + b.h + 1.1;
        roads.push({ pts: [join(L - 0.4), [L - 0.2, cy + 3.2], [L + 0.2, b.y + b.h - 1.2], [L + 1.6, fy], [dx, fy + 0.15]], w: 1.6 });
        roads.push({ pts: [join(Rr + 0.4), [Rr + 0.2, cy + 3.2], [Rr - 0.2, b.y + b.h - 1.2], [Rr - 1.6, fy], [dx, fy + 0.15]], w: 1.6 });
        plazas.push({ x: dx, y: fy - 0.2, r: 1.9, door: true, castle: b });   // v130 성 문 앞 = 그림 문에 맞춘 박석 길 (paintRoads)
      } else {   // 큰길 아래 집(이장 댁): 오른쪽으로 돌아 문 앞으로
        const R2 = b.x + b.w + 1.3, fy = b.y + b.h + 0.9;
        roads.push({ pts: [join(R2 + 0.8), [R2 + 0.3, cy + 2.6], [R2 + 0.1, b.y + b.h - 1.5], [R2 - 0.9, fy], [dx, fy + 0.1]], w: 1.5 });
        plazas.push({ x: dx, y: fy - 0.25, r: 1.25, door: true });
      }
    });
    if (!last) {   // 분수 둥근 마당 + 큰길에서 내려오는 길
      roads.push({ pts: [join(17.8), [18, 12.2], [18, 13.2]], w: 1.6 });
      plazas.push({ x: 18, y: 15, r: 2.75 });
    }
    const f = map.forge, st = map.station;
    if (f) {   // 대장간 앞 마당
      const sx = f.x - 1.3, fy = f.y + f.h + 1;
      roads.push({ pts: [join(sx), [sx + 0.1, cy + 2.6], [sx + 0.5, fy - 0.6], [f.x + 1.5, fy + 0.15]], w: 1.4 });
      plazas.push({ x: f.x + 1.5, y: fy - 0.3, r: 1.35 });
    }
    if (st) {   // 역참 앞 마당
      const fy = st.y + st.h + 0.9, cx = st.x + st.w / 2;
      if (last) roads.push({ pts: [join(st.path + 0.5), [st.path + 0.4, cy + 4], [st.path + 0.2, st.y - 0.5], [cx + 1.2, fy - 0.2], [cx, fy]], w: 1.4 });
      else roads.push({ pts: [[f.x - 0.8, f.y + f.h + 1.4], [st.x - 1.3, st.y - 0.3], [st.x - 0.4, fy - 0.1], [cx, fy + 0.05]], w: 1.4 });
      plazas.push({ x: cx, y: fy - 0.2, r: 1.4 });
    }
    // 곡선(캣멀롬) 위 점들을 촘촘히
    const dense = denseCurve;
    roads.forEach(r => { r.d = dense(r.pts); });
    map.roads = roads; map.plazas = plazas;
    // 칸 다시 정하기
    const inRoad = (X, Y) => roads.some(r => r.d.some(([x, y]) => (x - X) ** 2 + (y - Y) ** 2 <= (r.w / 2) ** 2)) || plazas.some(q => (q.x - X) ** 2 + (q.y - Y) ** 2 <= q.r * q.r);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const v = at(x, y), on = inRoad(x + 0.5, y + 0.5);
      if (on && [0, 1, 2, 3, 5].includes(v)) set(x, y, 1);
      else if (!on && v === 1) set(x, y, 0);
    }
  }
  function nearDoor(map, x, y) { return map.doors.some(b => Math.abs(b.door.x - x) <= 2 && y >= b.door.y && y <= b.door.y + 3); }
  const solidAt = (map, px, py) => !!SOLID[map.at(Math.floor(px / TS), Math.floor(py / TS))];

  /* ---------- 지도 그림 (v40 그래픽 강화) ----------
   *  땅(map.ground) 은 한 번만 그려 둠: 땅 무늬·풀·자갈·길 가장자리·물가 모래·그림자
   *  나무·바위·건물(map.objs) 은 따로 그림 조각으로 만들어 두고, 화면에서 캐릭터와 함께 '아래쪽이 앞'으로 그림
   *  → 나무 뒤로 걸어가면 나뭇잎이 캐릭터를 가림 */
  const mixC = (a, b, t) => { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16); const r = (A >> 16) + ((B >> 16) - (A >> 16)) * t, g = ((A >> 8) & 255) + (((B >> 8) & 255) - ((A >> 8) & 255)) * t, bl = (A & 255) + ((B & 255) - (A & 255)) * t; return '#' + [r, g, bl].map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); };
  function noise2(seed) {   // 부드러운 값 잡음 (칸 단위)
    const r = seeded(seed), G = {}; const v = (x, y) => { const k = x + ',' + y; if (G[k] == null) G[k] = r(); return G[k]; };
    return (x, y, s) => { const X = x / s, Y = y / s, x0 = Math.floor(X), y0 = Math.floor(Y), fx = X - x0, fy = Y - y0, sm = t => t * t * (3 - 2 * t);
      const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1); return (a + (b - a) * sm(fx)) * (1 - sm(fy)) + (c + (d - c) * sm(fx)) * sm(fy); };
  }
  /* v109 마을 흙길 그리기: 길을 따라 둥근 도장을 촘촘히 찍어(폭이 조금씩 달라짐) 가장자리가 자연스러운 모양을 만들고
   *  그림자 → 흙 재질 → 수레바퀴 자국(큰길) → 가장자리 돌멩이 → 문 앞 디딤돌 · 진영 앞 박석 */
  function drawRoads(x, map, pat, rnd, nz) {
    const { w, h, R } = map, W = w * TS, H = h * TS, P0 = R.path;
    const [mc, mx] = mk(W, H); mx.fillStyle = '#000';
    const dot = (X, Y, r) => { mx.beginPath(); mx.arc(X, Y, r, 0, Math.PI * 2); mx.fill(); };
    const walk = (d, fn) => { for (let i = 0; i < d.length - 1; i++) { const [x0, y0] = d[i], [x1, y1] = d[i + 1], L = Math.hypot(x1 - x0, y1 - y0) * TS, n = Math.max(1, Math.ceil(L / 3)); for (let k = 0; k < n; k++) { const t = k / n; fn(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, x1 - x0, y1 - y0); } } };
    map.roads.forEach(r => walk(r.d, (X, Y) => dot(X * TS, Y * TS, r.w / 2 * TS * (0.9 + 0.2 * nz(X * 3, Y * 3, 2)))));
    map.plazas.forEach(q => { mx.beginPath(); for (let a = 0; a <= 40; a++) { const t = a / 40 * Math.PI * 2, rr = q.r * TS * (0.92 + 0.14 * nz(q.x * 9 + Math.cos(t) * 4, q.y * 9 + Math.sin(t) * 4, 2)); mx[a ? 'lineTo' : 'moveTo'](q.x * TS + Math.cos(t) * rr, q.y * TS + Math.sin(t) * rr); } mx.closePath(); mx.fill(); });
    // 그림자 (길 둘레가 살짝 꺼진 느낌)
    const [sc, sx] = mk(W, H); sx.drawImage(mc, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = 'rgba(52,34,16,.42)'; sx.fillRect(0, 0, W, H);
    x.save(); x.filter = 'blur(3px)'; x.drawImage(sc, 0, 2); x.restore();
    // 흙 재질
    const [lc, lx] = mk(W, H);
    if (pat) { lx.fillStyle = pat[1]; lx.fillRect(0, 0, W, H); }
    else for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const n = nz(tx * 4 + i + 99, ty * 4 + j, 5); lx.fillStyle = n < 0.4 ? shade(P0, -0.14) : n < 0.8 ? P0 : shade(P0, 0.12); lx.fillRect(tx * TS + i * 8, ty * TS + j * 8, 8, 8); }
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) { const n = nz(tx * 2 + 40, ty * 2, 4); lx.fillStyle = n < 0.5 ? `rgba(70,45,20,${((0.5 - n) * 0.3).toFixed(3)})` : `rgba(255,240,210,${((n - 0.5) * 0.18).toFixed(3)})`; lx.fillRect(tx * TS, ty * TS, TS, TS); }   // 얼룩
    lx.globalCompositeOperation = 'destination-in'; lx.drawImage(mc, 0, 0);
    x.drawImage(lc, 0, 0);
    // 가장자리 안쪽 어두운 테 (흙이 눌린 자국)
    const [ec, ex] = mk(W, H); ex.fillStyle = 'rgba(60,38,18,.28)'; ex.fillRect(0, 0, W, H); ex.globalCompositeOperation = 'destination-out'; ex.filter = 'blur(2px)'; ex.drawImage(mc, 0, 0); ex.filter = 'none'; ex.globalCompositeOperation = 'destination-in'; ex.drawImage(mc, 0, 0);
    x.drawImage(ec, 0, 0);
    // 큰길 수레바퀴 자국 두 줄
    map.roads.filter(r => r.main).forEach(r => walk(r.d, (X, Y, dx, dy) => {
      const L = Math.hypot(dx, dy) || 1, nx2 = -dy / L, ny2 = dx / L;
      [-0.42, 0.42].forEach(o => { if (rnd() < 0.82) { const px2 = (X + nx2 * o) * TS, py2 = (Y + ny2 * o) * TS; x.fillStyle = 'rgba(55,35,15,.22)'; x.fillRect(px2 - 2, py2 - 1, 4, 3); x.fillStyle = 'rgba(255,235,200,.12)'; x.fillRect(px2 - 2, py2 + 2, 4, 1); } });
    }));
    // 가장자리 돌멩이
    const stone = (X, Y, s, col) => { x.fillStyle = 'rgba(30,20,10,.35)'; x.fillRect(X - s / 2 + 1, Y - s / 3 + 2, s, s * 0.66); x.fillStyle = col; x.fillRect(X - s / 2, Y - s / 3, s, s * 0.66); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(X - s / 2, Y - s / 3, s * 0.6, 1); };
    map.roads.forEach(r => walk(r.d, (X, Y, dx, dy) => {
      if (rnd() > 0.035) return; const L = Math.hypot(dx, dy) || 1, sd = rnd() < 0.5 ? -1 : 1, o = r.w / 2 * (0.85 + rnd() * 0.25);
      stone((X - dy / L * o * sd) * TS, (Y + dx / L * o * sd) * TS, 3 + Math.floor(rnd() * 4), rnd() < 0.5 ? '#9A9488' : '#B5AC9A');
    }));
    // 문 앞 디딤돌 (넓적한 돌 3장) · 진영 앞은 박석(돌판) 마당
    map.plazas.filter(q => q.door).forEach(q => {
      if (q.castle) {   // v130 성 문 앞 박석 길: 문 아래(A~B)에서 낮은 담과 나란히 왼쪽 아래로 · 끝은 양옆으로 넓어지는 마당
        const g = castleGeo(q.castle), v = [g.B[0] - g.A[0], g.B[1] - g.A[1]], K = 2.1, rows = 20, cols = 9;
        const P = (t, a) => [g.A[0] + a * v[0] + t * g.u[0], g.A[1] + a * v[1] + t * g.u[1]], flare = t => Math.max(0, t - 1.25) * 0.35;
        const quad = (pts, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); x.fill(); };
        // 그림자 · 줄눈(바닥)
        const edge = []; for (let i = 0; i <= rows; i++) { const t = K * i / rows; edge.push(P(t, -flare(t))); } for (let i = rows; i >= 0; i--) { const t = K * i / rows; edge.push(P(t, 1 + flare(t))); }
        x.fillStyle = 'rgba(30,22,14,.55)'; x.beginPath(); edge.forEach((q2, i) => (i ? x.lineTo(q2[0] + 2, q2[1] + 3) : x.moveTo(q2[0] + 2, q2[1] + 3))); x.closePath(); x.fill();
        x.fillStyle = '#5E584E'; x.beginPath(); edge.forEach((q2, i) => (i ? x.lineTo(q2[0], q2[1]) : x.moveTo(q2[0], q2[1]))); x.closePath(); x.fill();
        for (let r = 0; r < rows; r++) {
          const t0 = K * r / rows + 0.012, t1 = K * (r + 1) / rows - 0.012, f = flare((t0 + t1) / 2), a0 = -f, a1 = 1 + f, n = Math.max(cols, Math.round(cols * (a1 - a0))), off = r % 2 ? 0.5 : 0;
          for (let i = -1; i < n; i++) {
            let b0 = a0 + (i + off) / n * (a1 - a0), b1 = a0 + (i + off + 1) / n * (a1 - a0); b0 = Math.max(a0, b0) + 0.012; b1 = Math.min(a1, b1) - 0.012; if (b1 - b0 < 0.03) continue;
            const c = ['#A8A293', '#B6AF9F', '#9A9487', '#ADA798'][Math.floor(rnd() * 4)];
            quad([P(t0, b0), P(t0, b1), P(t1, b1), P(t1, b0)], c);
            const h0 = P(t0, b0), h1 = P(t0, b1); x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 1; x.beginPath(); x.moveTo(h0[0], h0[1] + 0.5); x.lineTo(h1[0], h1[1] + 0.5); x.stroke();
          }
        }
      } else if (q.r > 1.6) {   // 박석
        for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) { const X = (q.x + i * 0.62 + (j % 2) * 0.31) * TS, Y = (q.y + j * 0.42) * TS; if (Math.hypot((X / TS - q.x) / 1.15, (Y / TS - q.y) / 0.75) > q.r * 0.82) continue; const c = ['#A39D90', '#B3AC9C', '#958F83'][Math.floor(rnd() * 3)]; x.fillStyle = 'rgba(40,30,20,.35)'; x.fillRect(X - 9, Y - 5, 18, 11); x.fillStyle = c; x.fillRect(X - 9, Y - 6, 18, 10); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(X - 9, Y - 6, 18, 2); }
      } else for (let k = 0; k < 3; k++) {   // 디딤돌
        const X = (q.x + (k - 1) * 0.12) * TS, Y = (q.y - 0.55 + k * 0.62) * TS, rx = 10 - k, ry = 6;
        x.fillStyle = 'rgba(40,30,20,.35)'; x.beginPath(); x.ellipse(X + 1, Y + 2, rx, ry, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = k % 2 ? '#ADA696' : '#9C9586'; x.beginPath(); x.ellipse(X, Y, rx, ry, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.ellipse(X - 2, Y - 2, rx * 0.55, ry * 0.4, 0, 0, Math.PI * 2); x.fill();
      }
    });
  }
  function paintGround(map) {
    const { w, h, R, at } = map, [c, x] = mk(w * TS, h * TS), rnd = seeded('paint-' + map.id), nz = noise2('nz-' + map.id);
    const px = (X, Y, ww, hh, col) => { x.fillStyle = col; x.fillRect(X, Y, ww, hh); };
    const isPath = v => v === 1 || v === 7, G0 = R.ground[0], G1 = R.ground[1], dark = shade(G0, -0.18), light = shade(G0, 0.16);
    map.water = []; map.objs = []; map.glows = [];
    // v80 Meshy 재질 그림 (땅·길·물 192px 이어 붙는 무늬). 아직 안 불러왔으면 옛 색 무늬로 그리고, 다 불러오면 다시 그림
    const TX = texOf(map), NEED = TX.concat((map.ponds || []).map(p => p.k)), ok = NEED.every(n => img79(n)), pat = ok ? TX.map(n => x.createPattern(img79(n), 'repeat')) : null;
    if (!ok && !map.texWait) {   // v82 고침: 이미 받은 그림은 기다릴 수에서 빼야 함 (전에는 하나라도 먼저 받아져 있으면 영영 다시 안 그렸음)
      map.texWait = true; const need = NEED.filter(n => !img79(n)); let left = need.length;
      const done = () => { if (--left > 0) return; map.texWait = false; if (mapCache[map.id] === map) map.ground = paintGround(map); };
      need.forEach(n => img79(n, done));
    }
    if (ok) {   // 1) 땅 = 재질 무늬 + 큰 얼룩(밝게·어둡게)으로 단조로움 깨기
      x.fillStyle = pat[0]; x.fillRect(0, 0, w * TS, h * TS);
      const [nc, nx] = mk(w, h);   // 칸 하나 = 1점짜리 얼룩 지도를 부드럽게 크게 늘려 덮음 (네모 자국 없게)
      for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) { const n = nz(gx * 2, gy * 2, 5); nx.fillStyle = n < 0.5 ? `rgba(0,0,0,${((0.5 - n) * 0.34).toFixed(3)})` : `rgba(255,255,255,${((n - 0.5) * 0.2).toFixed(3)})`; nx.fillRect(gx, gy, 1, 1); }
      x.save(); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(nc, 0, 0, w * TS, h * TS); x.restore();
    }
    // 1) 땅: 큰 얼룩 무늬(잡음) + 8px 조각 무늬
    if (!ok) for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const gx = tx * 4 + i, gy = ty * 4 + j, n = nz(gx, gy, 6) * 0.7 + rnd() * 0.3;
        px(tx * TS + i * 8, ty * TS + j * 8, 8, 8, n < 0.35 ? shade(G1, -0.06) : n < 0.62 ? G1 : n < 0.85 ? G0 : light);
      }
    }
    // 2) 길: 가장자리 울퉁불퉁 + 테두리 그림자 + 자갈
    const P0 = R.path, Pd = shade(P0, -0.14), Pl = shade(P0, 0.12);
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      const v = at(tx, ty); if (!isPath(v)) continue;
      if (map.roads && v === 1) continue;   // v109 마을 길은 아래 drawRoads 에서 곡선으로
      const X = tx * TS, Y = ty * TS;
      if (ok) { px(X, Y, TS, TS, pat[1]); if (map.M.hell) px(X, Y, TS, TS, 'rgba(0,0,0,.28)'); }
      else for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const n = nz(tx * 4 + i + 99, ty * 4 + j, 5); px(X + i * 8, Y + j * 8, 8, 8, n < 0.4 ? Pd : n < 0.8 ? P0 : Pl); }
      const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([a, b2]) => isPath(at(tx + a, ty + b2)) || tx + a < 0 || tx + a >= w);
      if (ok) {   // 재질: 길 가장자리를 땅 무늬로 들쭉날쭉 + 옅은 그림자
        const E = pat[0], sd = 'rgba(0,0,0,.16)';
        if (!nb[0]) { for (let i = 0; i < 32; i += 4) { const d = Math.floor(rnd() * 3) * 2; if (d) px(X + i, Y, 4, d, E); } px(X, Y + 4, 32, 2, sd); }
        if (!nb[2]) { for (let i = 0; i < 32; i += 4) { const d = Math.floor(rnd() * 3) * 2; if (d) px(X + i, Y + 32 - d, 4, d, E); } px(X, Y + 26, 32, 2, sd); }
        if (!nb[3]) { for (let i = 0; i < 32; i += 4) { const d = Math.floor(rnd() * 3) * 2; if (d) px(X, Y + i, d, 4, E); } px(X + 4, Y, 2, 32, sd); }
        if (!nb[1]) { for (let i = 0; i < 32; i += 4) { const d = Math.floor(rnd() * 3) * 2; if (d) px(X + 32 - d, Y + i, d, 4, E); } px(X + 26, Y, 2, 32, sd); }
        continue;
      }
      // 이웃이 길이 아니면 그쪽 가장자리를 들쭉날쭉하게 + 어두운 선
      if (!nb[0]) { for (let i = 0; i < 32; i += 4) { const d = Math.floor(rnd() * 3) * 2; px(X + i, Y, 4, d, G1); } px(X, Y + 4, 32, 2, shade(P0, -0.22)); }
      if (!nb[2]) { for (let i = 0; i < 32; i += 4) { const d = Math.floor(rnd() * 3) * 2; px(X + i, Y + 32 - d, 4, d, G1); } px(X, Y + 26, 32, 2, shade(P0, -0.22)); }
      if (!nb[3]) { for (let i = 0; i < 32; i += 4) { const d = Math.floor(rnd() * 3) * 2; px(X, Y + i, d, 4, G1); } px(X + 4, Y, 2, 32, shade(P0, -0.22)); }
      if (!nb[1]) { for (let i = 0; i < 32; i += 4) { const d = Math.floor(rnd() * 3) * 2; px(X + 32 - d, Y + i, d, 4, G1); } px(X + 26, Y, 2, 32, shade(P0, -0.22)); }
      for (let k = 0; k < 3; k++) if (rnd() < 0.5) { const a = 6 + Math.floor(rnd() * 20), b2 = 6 + Math.floor(rnd() * 20); px(X + a, Y + b2, 4, 3, shade(P0, -0.3)); px(X + a, Y + b2, 2, 1, Pl); }
    }
    if (map.roads) drawRoads(x, map, ok ? pat : null, rnd, nz);
    // 3) 물: 깊이에 따라 진하게 · 물가 모래 테두리 · 위쪽 물보라
    const W0 = R.water;
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      if (at(tx, ty) !== 4) continue;
      let deep = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (at(tx + i, ty + j) === 4) deep++;
      const X = tx * TS, Y = ty * TS;
      if (ok) { px(X, Y, TS, TS, pat[2]); px(X, Y, TS, TS, `rgba(0,0,0,${(Math.min(1, deep / 25) * 0.3).toFixed(2)})`); }
      else px(X, Y, TS, TS, mixC(shade(W0, 0.15), shade(W0, -0.25), Math.min(1, deep / 25)));
      map.water.push([tx, ty]);
      const up = at(tx, ty - 1) !== 4, dn = at(tx, ty + 1) !== 4, lf = at(tx - 1, ty) !== 4, rt = at(tx + 1, ty) !== 4, sand = shade(R.path, 0.05);
      if (up) { px(X, Y, TS, 6, sand); px(X, Y + 6, TS, 3, shade(W0, 0.55)); }
      if (dn) { px(X, Y + 26, TS, 6, shade(W0, -0.35)); px(X, Y + 30, TS, 2, sand); }
      if (lf) { px(X, Y, 4, TS, sand); px(X + 4, Y, 2, TS, shade(W0, 0.45)); }
      if (rt) { px(X + 28, Y, 4, TS, sand); px(X + 26, Y, 2, TS, shade(W0, 0.45)); }
    }
    // v120 선생님 그림 연못 (물 칸 위에 통째로)
    (map.ponds || []).forEach(p => { const im = img79(p.k); if (im) { x.save(); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(im, p.x * TS, p.y * TS); x.restore(); } });
    // 4) 풀·꽃·돌 장식
    const grassy = !/[#](E8|F3|D6|4A|5A)/.test(G0);
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      const v = at(tx, ty), X = tx * TS, Y = ty * TS;
      if (v === 0) {
        for (let k = 0; k < 3; k++) if (rnd() < (ok ? 0.22 : 0.55)) {   // 풀잎 (V 모양) · 재질이 있으면 조금만
          const a = 2 + Math.floor(rnd() * 26), b2 = 4 + Math.floor(rnd() * 24), col = rnd() < 0.5 ? dark : light;
          if (grassy) { px(X + a, Y + b2, 2, 4, col); px(X + a - 2, Y + b2 + 1, 2, 3, col); px(X + a + 2, Y + b2 + 1, 2, 3, col); }
          else { px(X + a, Y + b2, 3, 2, col); }
        }
      }
      if (v === 5) {   // 꽃 (꽃잎 4장 + 가운데)
        for (let k = 0; k < 3; k++) if (rnd() < 0.75) {
          const a = 4 + Math.floor(rnd() * 22), b2 = 4 + Math.floor(rnd() * 20), col = pick(R.deco);
          px(X + a + 2, Y + b2 + 6, 2, 5, shade(G0, -0.35)); px(X + a, Y + b2 + 2, 6, 2, col); px(X + a + 2, Y + b2, 2, 6, col); px(X + a + 2, Y + b2 + 2, 2, 2, '#FFE45C'); px(X + a + 4, Y + b2 + 9, 3, 2, shade(G0, -0.25));
        }
      }
    }
    // 5) 나무·바위 → 그림 조각 + 땅 그림자
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      const v = at(tx, ty); if (v !== 2 && v !== 3) continue;
      const kind = v === 2 ? R.block : R.block2, vr = Math.floor(rnd() * 3), spr = blockSprite(kind, vr, R);
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(tx * TS + 16, ty * TS + 28, 15, 6, 0, 0, Math.PI * 2); x.fill();
      map.objs.push({ img: spr, x: tx * TS - 16, y: ty * TS - 40, sy: (ty + 1) * TS - 2, kind, tx, ty, alt: 'obj_r' + map.M.region + '_' + (v === 2 ? 1 : 2), alt2: map.M.hell ? null : envPick(map.M.region, v, tx, ty) });
      if (kind === 'crystal') map.glows.push({ x: tx * TS + 16, y: ty * TS + 6, r: 70, col: '#B08AFF' });
      if (kind === 'lavarock') map.glows.push({ x: tx * TS + 16, y: ty * TS + 18, r: 40, col: '#FF6A3D' });
    }
    if (R.water === '#FF5A2A' && TX[2] === 'r8_water') map.water.forEach(([tx, ty]) => { if ((tx + ty) % 3 === 0) map.glows.push({ x: tx * TS + 16, y: ty * TS + 16, r: 60, col: '#FF6A3D' }); });   // 용암 빛
    // 6) 건물 · 분수
    map.buildings.forEach(b => {
      const spr = buildingSprite(b, R);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(b.x * TS - 6, (b.y + b.h) * TS - 10, b.w * TS + 12, 12);
      map.objs.push({ img: spr.c, x: b.x * TS - spr.ox, y: b.y * TS - spr.oy, sy: (b.y + b.h) * TS - 1, b });
      map.glows.push({ x: (b.door.x + 0.5) * TS, y: (b.y + b.h - 1) * TS, r: 70, col: '#FFD27A' });
    });
    if (map.forge) {   // v60 대장간
      const f = map.forge, spr = forgeSprite(R);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(f.x * TS - 4, (f.y + f.h) * TS - 10, f.w * TS + 8, 12);
      map.objs.push({ img: spr, x: f.x * TS + (f.w * TS - spr.width) / 2, y: (f.y + f.h) * TS - spr.height + 4, sy: (f.y + f.h) * TS - 1, forge: f });
      map.glows.push({ x: (f.x + 0.7) * TS, y: (f.y + 1.2) * TS, r: 80, col: '#FF8A3D' });
    }
    if (map.station) {   // v85 역참 (그림은 game.js drawObj 에서)
      const st = map.station;
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(st.x * TS - 4, (st.y + st.h) * TS - 10, st.w * TS + 8, 12);
      map.objs.push({ station: st, img: { width: st.w * TS, height: 120 }, x: st.x * TS, y: (st.y + st.h) * TS - 120, sy: (st.y + st.h) * TS - 1 });
    }
    (map.props || []).forEach(p => {   // v80 진영 소품 (Meshy) — 그림 폭 pw 에 맞춰 칸 아래 가운데에 세움
      const cx0 = (p.x + p.fw / 2) * TS, by = (p.y + p.fh) * TS + 2;
      x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(cx0, by - 6, p.pw * 0.42, 9, 0, 0, Math.PI * 2); x.fill();
      map.objs.push({ p79: p.n, pw: p.pw, cx: cx0, by, img: { width: p.pw, height: p.pw * 1.2 }, x: cx0 - p.pw / 2, y: by - p.pw * 1.2, sy: by - 3 });
    });
    if (map.at(17, 14) === 8) {
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(17 * TS + 32, 16 * TS - 2, 34, 10, 0, 0, Math.PI * 2); x.fill();
      for (let yy = 13; yy <= 15; yy++) for (let xx = 16; xx <= 19; xx++) set8(map, xx, yy);   // v86 새 분수 그림(돌 거북 · 연꽃 · 석등)은 6×4 칸 크기 → 가운데 4×3 칸을 막음
      map.objs.push({ img: fountainSprite(R), x: 17 * TS - 8, y: 14 * TS - 40, sy: 16 * TS - 1, fountain: true });
      map.fountain = { x: 17 * TS + 32, y: 14 * TS - 8 };
    }
    // 7) 출구: 빛나는 길
    const exitGlow = (X0, dir) => { for (let k = 0; k < 4; k++) { x.fillStyle = 'rgba(255,255,220,' + (0.18 - k * 0.04) + ')'; x.fillRect(dir < 0 ? X0 : X0 - (k + 1) * 32, (map.mid - 2) * TS, (k + 1) * 32, 6 * TS); } };
    if (map.exitL) exitGlow(0, -1); if (map.exitR) exitGlow(w * TS, 1);
    map.objs.sort((a, b2) => a.sy - b2.sy);
    map.mini = paintMini(map);
    return c;
  }
  // 작은 지도 (1칸 = 1점)
  function paintMini(map) {
    const { w, h, R, at } = map, [c, x] = mk(w, h), col = { 0: R.ground[0], 1: R.path, 2: shade(R.ground[0], -0.45), 3: shade(R.ground[0], -0.35), 4: R.water, 5: R.ground[0], 6: '#B8A080', 7: '#FFD27A', 8: '#9AD8F5', 9: '#FF8A3D', 10: '#B8A080', 11: '#9AE6FF' };
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { x.fillStyle = col[at(i, y)] || R.ground[0]; x.fillRect(i, y, 1, 1); }
    return c;
  }

  /* ---------- v110 사냥터·마을 나무·바위 여러 가지 (선생님 그림 img/v79/env_t?·env_r?) ----------
   *  지역마다 고를 수 있는 그림 목록 · 'old' = 예전 지역 그림(obj_rN_1·2) 그대로 · 칸마다 정해진 무작위(같은 칸은 늘 같은 그림)
   *  t = 칸 값 2(R.block) 자리 · r = 칸 값 3(R.block2) 자리 */
  const ENV_POOL = [
    { t: ['old', 'old', 'env_tA', 'env_tA', 'env_tB', 'env_tI', 'env_tH', 'env_tF', 'env_tF'], r: ['old', 'env_rA', 'env_rB', 'env_rC', 'env_rD'] },          // 0 솔뫼
    { t: ['old', 'env_tE', 'env_tC', 'env_tB', 'env_tJ'], r: ['old', 'env_rA', 'env_rB', 'env_rG', 'env_rE'] },                     // 1 대숲
    { t: ['old', 'env_tG', 'env_tF', 'env_tF', 'env_tJ', 'env_tH'], r: ['old', 'env_rB', 'env_rG', 'env_rD'] },                               // 2 갈대늪
    { t: ['old', 'env_tC', 'env_tG'], r: ['old', 'env_rC', 'env_rD', 'env_rH'] },                                                   // 3 모래톱 포구
    { t: ['old', 'env_tC', 'env_tE', 'env_tD', 'env_tB'], r: ['old', 'env_rC', 'env_rE', 'env_rH', 'env_rJ', 'env_rD'] },          // 4 돌산성
    { t: ['old', 'old', 'env_tG'], r: ['old', 'env_rH', 'env_rA'] },                                                                       // 5 눈고개 (눈 나무·얼음은 예전 그림 위주)
    { t: ['old', 'env_rI'], r: ['old', 'env_rI', 'env_rH', 'env_rC'] },                                                             // 6 용굴 (수정 + 광물 바위)
    { t: ['old', 'env_tD', 'env_tA', 'env_tF', 'env_tI'], r: ['old', 'env_rJ', 'env_rA', 'env_rB'] },                              // 7 구름절
    { t: ['old', 'env_rI', 'env_rC'], r: ['old', 'env_tG'] }                                                                        // 8 도원수 진영 (용암 바위 · 마른 나무)
  ];
  function envPick(region, v, tx, ty) {
    const P = ENV_POOL[region]; if (!P) return null;
    const L = v === 2 ? P.t : P.r; let h = (tx * 73856093) ^ (ty * 19349663) ^ (region * 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    const n = L[(h >>> 0) % L.length]; if (n === 'old') return null;
    img79(n); return n;   // 미리 받기 시작 (받기 전에는 예전 그림)
  }

  /* ---------- 나무·바위 그림 조각 (64 × 80, 칸 왼쪽 위 = (16, 40)) ---------- */
  const blockC = {};
  function blockSprite(kind, vr, R) {
    const key = kind + vr; if (blockC[key]) return blockC[key];
    const [c, x] = mk(64, 80), rnd = seeded('blk-' + key);
    drawBlock(x, 16, 40, kind, rnd, vr);
    return (blockC[key] = c);
  }
  function drawBlock(x, X, Y, kind, rnd, vr) {
    const p = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(X + a, Y + b, ww, hh); };
    const K = '#1D2340';
    if (kind === 'tree' || kind === 'blossom') {
      const base = kind === 'tree' ? ['#3E9E45', '#46A84A', '#358C3E'][vr] : ['#FF9EC4', '#FFB3D1', '#F58AB8'][vr], lt = shade(base, 0.28), dk = shade(base, -0.22), dk2 = shade(base, -0.38);
      // 줄기·뿌리
      p(11, 12, 10, 22, K); p(12, 12, 8, 21, '#6B4226'); p(12, 12, 3, 21, '#8A5A36'); p(18, 14, 2, 18, '#4E2E1A'); p(8, 30, 16, 3, K); p(9, 30, 4, 2, '#6B4226'); p(19, 30, 4, 2, '#6B4226');
      // 나뭇잎 덩어리 3개 (뒤 → 앞)
      const blob = (cx, cy, r, col, hl) => {
        x.fillStyle = K; x.beginPath(); for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2, rr = r + 1.5 + (a % 2 ? 1 : 0); x.lineTo(X + cx + Math.cos(t) * rr, Y + cy + Math.sin(t) * rr * 0.92); } x.fill();
        x.fillStyle = col; x.beginPath(); for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2, rr = r + (a % 2 ? 1 : 0); x.lineTo(X + cx + Math.cos(t) * rr, Y + cy + Math.sin(t) * rr * 0.92); } x.fill();
        x.fillStyle = dk; x.beginPath(); x.ellipse(X + cx + 2, Y + cy + r * 0.45, r * 0.85, r * 0.45, 0, 0, Math.PI); x.fill();
        if (hl) { x.fillStyle = lt; x.beginPath(); x.ellipse(X + cx - r * 0.3, Y + cy - r * 0.35, r * 0.45, r * 0.3, -0.4, 0, Math.PI * 2); x.fill(); }
      };
      blob(6, 4, 11, dk, false); blob(27, 2, 11, dk, false); blob(16, -8, 15, base, true); blob(5, 6, 9, base, true); blob(27, 5, 9, base, true);
      for (let i = 0; i < 26; i++) { const a = Math.floor(rnd() * 34) - 3, b = Math.floor(rnd() * 26) - 20; p(a, b, 2, 2, rnd() < 0.5 ? lt : dk2); }
      if (kind === 'blossom') for (let i = 0; i < 10; i++) p(Math.floor(rnd() * 30), Math.floor(rnd() * 22) - 18, 2, 2, '#FFFFFF');
      if (kind === 'tree' && vr === 1) [[6, -4], [24, -10], [14, 6]].forEach(([a, b]) => { p(a, b, 4, 4, K); p(a + 1, b + 1, 2, 2, '#FF5A5F'); });   // 사과
    } else if (kind === 'pine' || kind === 'snowpine') {
      const leaf = kind === 'pine' ? ['#2E7A3A', '#2A7036', '#357F40'][vr] : '#3E7A5A', lt = shade(leaf, 0.25), dk = shade(leaf, -0.25);
      p(13, 18, 6, 16, K); p(14, 18, 4, 15, '#6B4226'); p(14, 18, 1, 15, '#8A5A36');
      for (let i = 0; i < 5; i++) {
        const ww = 10 + i * 6, yy = -24 + i * 9;
        x.fillStyle = K; x.beginPath(); x.moveTo(X + 16, Y + yy - 3); x.lineTo(X + 16 + ww / 2 + 2, Y + yy + 11); x.lineTo(X + 16 - ww / 2 - 2, Y + yy + 11); x.fill();
        x.fillStyle = leaf; x.beginPath(); x.moveTo(X + 16, Y + yy - 1); x.lineTo(X + 16 + ww / 2, Y + yy + 10); x.lineTo(X + 16 - ww / 2, Y + yy + 10); x.fill();
        x.fillStyle = lt; x.beginPath(); x.moveTo(X + 16, Y + yy); x.lineTo(X + 16 - ww / 2 + 2, Y + yy + 9); x.lineTo(X + 14, Y + yy + 9); x.fill();
        p(16 - ww / 2, yy + 9, ww, 1, dk);
        if (kind === 'snowpine') { p(16 - ww / 2 + 1, yy + 7, ww - 2, 2, '#FFFFFF'); p(14, yy, 4, 2, '#FFFFFF'); }
      }
    } else if (kind === 'cactus') {
      const g = '#4E9E3A', lt = '#7FC86A', dk = '#2E7A2A';
      const arm = (a, b, ww, hh) => { p(a - 1, b - 1, ww + 2, hh + 2, K); p(a, b, ww, hh, g); p(a + 1, b, 2, hh, lt); p(a + ww - 2, b, 1, hh, dk); };
      arm(12, -6, 9, 38); arm(3, 4, 6, 14); arm(5, 14, 9, 5); arm(23, 0, 6, 16); arm(19, 12, 6, 5);
      for (let i = 0; i < 8; i++) p(12 + Math.floor(rnd() * 9), -4 + Math.floor(rnd() * 34), 1, 1, '#FFF3B0');
      if (vr === 2) { p(14, -9, 5, 4, K); p(15, -8, 3, 2, '#FF7EB6'); }
    } else if (kind === 'crystal') {
      [[2, 8, 8, 24, '#A880F0'], [11, -12, 10, 44, '#C8A8FF'], [22, 2, 8, 30, '#7FE0F0'], [7, 20, 6, 12, '#FF9AE0']].forEach(([a, b, ww, hh, col]) => {
        x.fillStyle = K; x.beginPath(); x.moveTo(X + a - 1, Y + b + hh + 1); x.lineTo(X + a - 1, Y + b + 3); x.lineTo(X + a + ww / 2, Y + b - 4); x.lineTo(X + a + ww + 1, Y + b + 3); x.lineTo(X + a + ww + 1, Y + b + hh + 1); x.fill();
        x.fillStyle = col; x.beginPath(); x.moveTo(X + a, Y + b + hh); x.lineTo(X + a, Y + b + 3); x.lineTo(X + a + ww / 2, Y + b - 2); x.lineTo(X + a + ww, Y + b + 3); x.lineTo(X + a + ww, Y + b + hh); x.fill();
        p(a + 1, b + 3, 2, hh - 5, shade(col, 0.55)); p(a + ww / 2, b, ww / 2, hh, shade(col, -0.18)); p(a + 1, b + 2, 1, 3, '#FFFFFF');
      });
    } else if (kind === 'deadtree') {
      const t = '#5A4A40', lt = '#7A6A5A';
      p(12, -4, 8, 38, K); p(13, -3, 6, 36, t); p(13, -3, 2, 36, lt);
      p(2, 2, 12, 4, K); p(3, 3, 10, 2, t); p(2, -8, 4, 12, K); p(3, -7, 2, 10, t); p(18, 6, 12, 4, K); p(19, 7, 10, 2, t); p(26, -4, 4, 12, K); p(27, -3, 2, 10, t); p(10, -12, 4, 10, K); p(11, -11, 2, 8, t);
      p(8, 30, 16, 3, K); if (vr === 1) { p(20, 12, 6, 4, '#8AB85A'); p(6, 4, 5, 3, '#8AB85A'); }
    } else {
      const col = kind === 'ice' ? '#A8DCF5' : kind === 'sandrock' ? '#C99A5A' : kind === 'lavarock' ? '#3A2A2A' : kind === 'mossrock' ? '#7A8A6A' : kind === 'cloudrock' ? '#F3F6FF' : ['#8A8FA8', '#9096AE', '#7E849C'][vr];
      const lt = shade(col, 0.32), dk = shade(col, -0.28);
      // 둥근 바위 (윗면 밝게 · 아랫면 어둡게 · 금)
      x.fillStyle = K; x.beginPath(); x.moveTo(X + 1, Y + 31); x.lineTo(X + 3, Y + 12); x.lineTo(X + 10, Y + 4); x.lineTo(X + 22, Y + 3); x.lineTo(X + 30, Y + 11); x.lineTo(X + 32, Y + 31); x.fill();
      x.fillStyle = col; x.beginPath(); x.moveTo(X + 3, Y + 30); x.lineTo(X + 5, Y + 13); x.lineTo(X + 11, Y + 6); x.lineTo(X + 21, Y + 5); x.lineTo(X + 28, Y + 12); x.lineTo(X + 30, Y + 30); x.fill();
      x.fillStyle = lt; x.beginPath(); x.moveTo(X + 6, Y + 14); x.lineTo(X + 11, Y + 7); x.lineTo(X + 21, Y + 6); x.lineTo(X + 24, Y + 11); x.lineTo(X + 12, Y + 13); x.fill();
      p(3, 23, 27, 7, dk); p(17, 14, 2, 8, dk); p(18, 21, 5, 2, dk);
      if (kind === 'lavarock') { p(18, 16, 6, 2, '#FF6A3D'); p(10, 22, 4, 2, '#FFB13D'); p(22, 24, 3, 2, '#FFE45C'); }
      if (kind === 'ice') { p(9, 9, 3, 12, '#FFFFFF'); p(22, 12, 2, 6, '#FFFFFF'); }
      if (kind === 'mossrock') { p(5, 6, 20, 5, '#8AB85A'); p(9, 11, 8, 3, '#6E9A44'); p(22, 8, 6, 3, '#8AB85A'); }
      if (kind === 'cloudrock') { p(0, 16, 6, 12, K); p(1, 17, 5, 10, col); p(26, 14, 7, 14, K); p(27, 15, 5, 12, col); p(4, 26, 26, 4, '#D8E4F8'); }
      if (kind === 'sandrock') { p(6, 20, 22, 2, shade(col, -0.15)); p(8, 25, 18, 1, shade(col, -0.15)); }
    }
  }
  /* ---------- 건물 그림 조각 ---------- */
  const bldC = {};
  /* v60 대장간 도트 그림 (Meshy 그림 img/bld_forge.png 이 있으면 game.js 가 그것을 씀)
   *  왼쪽 돌 화덕(불 · 굴뚝) · 나무 차양 · 오른쪽 모루 · 물통 · 걸린 망치 */
  const forgeC = {};
  function forgeSprite(R) {
    const key = R.name; if (forgeC[key]) return forgeC[key];
    const W2 = 128, H2 = 118, [c, x] = mk(W2, H2), K = '#1D2340', p = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const st = '#8A8FA8', sl = '#AEB4CC', sd = '#5E6380', wood = '#9A6A3E', wl = '#C08A52', wd = '#6A4424';
    // 굴뚝
    p(14, 4, 22, 46, K); p(16, 6, 18, 44, st); p(16, 6, 5, 44, sl); p(30, 6, 4, 44, sd); for (let yy = 12; yy < 48; yy += 9) p(16, yy, 18, 2, sd);
    p(12, 2, 26, 6, K); p(14, 3, 22, 3, sl);
    // 차양 (나무 기둥 + 천막)
    p(8, 40, 4, 74, K); p(9, 41, 2, 72, wd); p(116, 40, 4, 74, K); p(117, 41, 2, 72, wd);
    p(2, 30, 124, 16, K);
    for (let i = 0; i < 8; i++) p(4 + i * 15, 32, 15, 12, i % 2 ? '#D2343A' : '#FFE8C8');
    for (let i = 0; i < 8; i++) { p(4 + i * 15, 44, 15, 4, K); p(5 + i * 15, 44, 13, 3, i % 2 ? '#A0202A' : '#E8CFA8'); }
    // 화덕 (돌 · 불 입구)
    p(4, 62, 62, 52, K); p(6, 64, 58, 48, st);
    for (let yy = 66; yy < 110; yy += 10) for (let xx = 6 + ((yy / 10) % 2) * 8; xx < 62; xx += 16) { p(xx, yy, 14, 8, ((xx + yy) % 3) ? st : sl); p(xx, yy + 8, 14, 2, sd); }
    p(18, 80, 34, 26, K); p(20, 82, 30, 24, '#3A1A10');
    p(22, 92, 26, 14, '#FF6A3D'); p(26, 88, 18, 10, '#FF9A3D'); p(30, 86, 10, 8, '#FFD23F'); p(33, 84, 4, 6, '#FFF6C2');
    p(22, 104, 26, 2, '#FFD23F');
    // 모루 (받침 나무통 + 쇠)
    p(76, 92, 26, 22, K); p(78, 94, 22, 20, wood); p(78, 94, 6, 20, wl); p(94, 94, 6, 20, wd); p(78, 100, 22, 2, wd);
    p(70, 78, 40, 16, K); p(72, 80, 36, 6, '#6A7088'); p(72, 80, 36, 2, '#C8CEE8'); p(80, 86, 20, 6, '#4A5068'); p(106, 80, 8, 4, K); p(106, 81, 6, 2, '#6A7088');
    p(88, 74, 6, 4, '#FF9A3D'); p(90, 72, 2, 2, '#FFE45C');   // 달궈진 쇠
    // 망치 (모루 위에 비스듬히)
    p(96, 60, 3, 18, K); p(97, 61, 1, 16, wl); p(91, 56, 14, 8, K); p(92, 57, 12, 6, '#9AA3C7'); p(92, 57, 12, 2, '#E0E6FF');
    // 물통
    p(108, 98, 16, 16, K); p(110, 100, 12, 14, wd); p(110, 100, 12, 3, '#4FA8E8'); p(110, 106, 12, 2, K);
    // 간판 (망치 그림)
    p(46, 48, 34, 14, K); p(48, 50, 30, 10, '#3A2A1A'); p(56, 52, 2, 7, '#FFD23F'); p(52, 51, 10, 3, '#FFD23F'); p(64, 53, 9, 2, '#FFD23F'); p(66, 51, 2, 6, '#FFD23F');
    return (forgeC[key] = c);
  }
  function buildingSprite(b, R) {
    const key = b.type + b.w + b.h + R.name; if (bldC[key]) return bldC[key];
    const ox = 40, oy = 90, w = b.w * TS, h = b.h * TS, [c, x] = mk(w + ox * 2, h + oy + 10), K = '#1D2340';
    const p = (a, d, ww, hh, col) => { x.fillStyle = col; x.fillRect(ox + a, oy + d, ww, hh); };
    if (b.type === 'castle') {
      const st = '#9AA0B8', lt = '#B8BED6', dk = '#5A5F78', dk2 = '#454A60';
      // 본관 벽 (벽돌)
      p(-4, 20, w + 8, h - 20, K); p(-2, 22, w + 4, h - 22, st);
      for (let yy = 26; yy < h; yy += 12) for (let xx = ((yy / 12) % 2) * 14; xx < w; xx += 28) { p(xx - 2, yy, 26, 10, ((xx + yy) / 7) % 3 < 1 ? lt : st); p(xx - 2, yy + 10, 26, 2, dk); }
      for (let i = 0; i < b.w + 1; i++) { p(-4 + i * 32, 6, 18, 16, K); p(-2 + i * 32, 8, 14, 14, st); p(-2 + i * 32, 8, 14, 3, lt); }
      // 탑 2개
      [[-26, -40], [w - 30, -40]].forEach(([a, d]) => {
        p(a, d, 56, h + 40 - d, K); p(a + 2, d + 2, 52, h + 36 - d, dk); p(a + 2, d + 2, 10, h + 36 - d, st); p(a + 44, d + 2, 10, h + 36 - d, dk2);
        x.fillStyle = K; x.beginPath(); x.moveTo(ox + a - 6, oy + d + 4); x.lineTo(ox + a + 28, oy + d - 60); x.lineTo(ox + a + 62, oy + d + 4); x.fill();
        x.fillStyle = b.roof; x.beginPath(); x.moveTo(ox + a - 2, oy + d + 2); x.lineTo(ox + a + 28, oy + d - 55); x.lineTo(ox + a + 58, oy + d + 2); x.fill();
        x.fillStyle = shade(b.roof, 0.25); x.beginPath(); x.moveTo(ox + a + 2, oy + d + 2); x.lineTo(ox + a + 28, oy + d - 50); x.lineTo(ox + a + 22, oy + d + 2); x.fill();
        p(a + 26, d - 76, 3, 22, K); p(a + 29, d - 76, 18, 10, '#D2343A'); p(a + 29, d - 72, 18, 2, '#FFD23F');
        p(a + 18, d + 30, 20, 26, K); p(a + 20, d + 32, 16, 22, '#FFE45C'); p(a + 27, d + 32, 2, 22, K);
        p(a + 18, d + 90, 20, 24, K); p(a + 20, d + 92, 16, 20, '#FFE45C');
      });
      // 정문 (아치) + 깃발 장식
      p(w / 2 - 30, h - 62, 60, 62, K); p(w / 2 - 28, h - 60, 56, 60, '#4A3420'); for (let i = 0; i < 6; i++) p(w / 2 - 26 + i * 10, h - 58, 2, 58, '#3A2814'); p(w / 2 - 1, h - 60, 2, 60, K);
      p(w / 2 - 34, h - 70, 68, 8, '#FFD23F'); p(w / 2 - 34, h - 70, 68, 2, '#FFF3B0');
      [w / 2 - 70, w / 2 + 52].forEach(a => { p(a, 30, 18, 46, K); p(a + 2, 32, 14, 40, '#D2343A'); p(a + 2, 32, 14, 4, '#FFD23F'); p(a + 7, 48, 4, 8, '#FFD23F'); });
      x.font = '14px "Jua", "Malgun Gothic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      p(w / 2 - 54, h - 100, 108, 24, K); p(w / 2 - 52, h - 98, 104, 20, '#3A2A1A'); x.fillStyle = '#FFE45C'; x.fillText('도원수 진영 · 퀘스트', ox + w / 2, oy + h - 87);
    } else {
      const wall = '#F3E6CC', wl = '#FFF6E0', wd = '#D8C8A8', roof = b.roof, rl = shade(roof, 0.25), rd = shade(roof, -0.28);
      // 벽 (나무판 + 기둥)
      p(-4, 28, w + 8, h - 28, K); p(-2, 30, w + 4, h - 30, wall);
      for (let yy = 38; yy < h; yy += 10) p(-2, yy, w + 4, 2, wd);
      p(-2, 30, 8, h - 30, '#8A5A36'); p(w - 6, 30, 8, h - 30, '#8A5A36'); p(-2, 30, 3, h - 30, '#A87048');
      // 지붕 (기와 줄 + 빛)
      x.fillStyle = K; x.beginPath(); x.moveTo(ox - 16, oy + 40); x.lineTo(ox + 10, oy - 30); x.lineTo(ox + w - 10, oy - 30); x.lineTo(ox + w + 16, oy + 40); x.fill();
      x.fillStyle = roof; x.beginPath(); x.moveTo(ox - 12, oy + 37); x.lineTo(ox + 12, oy - 27); x.lineTo(ox + w - 12, oy - 27); x.lineTo(ox + w + 12, oy + 37); x.fill();
      for (let r2 = 0; r2 < 6; r2++) { const yy = -22 + r2 * 10, inset = 12 - r2 * 4; for (let xx = -8 + inset + (r2 % 2) * 6; xx < w + 8 - inset; xx += 12) { p(xx, yy + 6, 10, 3, rd); p(xx, yy, 10, 2, rl); } }
      p(10, -27, w - 20, 4, rl); p(-12, 34, w + 24, 4, rd);
      // 굴뚝
      p(w - 46, -48, 18, 28, K); p(w - 44, -46, 14, 24, '#B8836A'); p(w - 44, -46, 14, 4, '#D8A48A');
      // 창문 (빛나는 유리 + 꽃 상자)
      [[14, 52], [w - 46, 52]].forEach(([a, d]) => { p(a, d, 32, 26, K); p(a + 2, d + 2, 28, 22, '#FFE9A8'); p(a + 2, d + 2, 28, 6, '#FFF6D0'); p(a + 15, d + 2, 2, 22, K); p(a + 2, d + 12, 28, 2, K); p(a - 2, d + 26, 36, 8, K); p(a, d + 27, 32, 6, '#8A5A36'); [4, 12, 20, 26].forEach((q, i) => p(a + q, d + 24, 4, 4, ['#FF5A5F', '#FFE45C', '#FF7EB6', '#FFFFFF'][i])); });
      // 문 (아치 + 손잡이) · 계단
      const dx = (b.door.x - b.x) * TS; p(dx - 4, h - 50, 40, 50, K); p(dx - 2, h - 48, 36, 48, '#7A4A26'); p(dx, h - 46, 14, 46, '#8A5A36'); p(dx + 18, h - 46, 14, 46, '#8A5A36'); p(dx + 24, h - 24, 4, 4, '#FFD23F'); p(dx - 6, h - 4, 44, 4, '#A8A098');
      // 간판 (그림 + 글자)
      const bw = 112, bx = w / 2 - bw / 2; p(bx - 2, 6, bw + 4, 24, K); p(bx, 8, bw, 20, '#8A5A36'); p(bx + 2, 10, bw - 4, 16, '#FFF2D0'); p(bx + 20, 2, 2, 6, K); p(bx + bw - 22, 2, 2, 6, K);
      const ic = (q, d) => { if (b.type === 'potion') { p(q + 3, d, 6, 3, K); p(q + 1, d + 3, 10, 11, K); p(q + 2, d + 4, 8, 9, '#FF5A5F'); p(q + 3, d + 5, 2, 3, '#FFFFFF'); } else if (b.type === 'school') { p(q, d + 2, 14, 11, K); p(q + 1, d + 3, 5, 9, '#A66BFF'); p(q + 8, d + 3, 5, 9, '#7E4DE0'); p(q + 6, d + 2, 2, 11, '#FFE45C'); } else { p(q, d + 6, 14, 8, K); p(q + 1, d + 7, 12, 6, '#3DDC84'); p(q + 2, d + 1, 10, 6, K); p(q + 3, d + 2, 8, 4, '#D2343A'); } };
      ic(bx + 6, 10);
      x.font = '13px "Jua", "Malgun Gothic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#3A2414'; x.fillText(b.name, ox + w / 2 + 8, oy + 19);
      // 가게 앞 소품
      if (b.type === 'potion') { p(w + 4, h - 22, 18, 22, K); p(w + 6, h - 20, 14, 18, '#A87048'); p(w + 8, h - 28, 4, 8, '#FF5A5F'); p(w + 13, h - 30, 4, 10, '#4C7DFF'); }
      if (b.type === 'school') { p(-24, h - 40, 6, 40, K); p(-23, h - 40, 4, 40, '#5A5F78'); p(-28, h - 52, 14, 14, K); p(-26, h - 50, 10, 10, '#FFE45C'); }
      if (b.type === 'chief') { p(w + 2, h - 18, 30, 18, K); p(w + 4, h - 16, 26, 14, '#8A5A36'); p(w + 6, h - 14, 22, 2, '#A87048'); }
    }
    return (bldC[key] = { c, ox, oy });
  }
  function set8(map, x, y) { map.t[y * map.w + x] = 8; }
  function fountainSprite(R) {
    if (bldC.fountain) return bldC.fountain;
    const [c, x] = mk(80, 100), p = (a, d, ww, hh, col) => { x.fillStyle = col; x.fillRect(8 + a, 40 + d, ww, hh); };
    p(0, 14, 64, 44, '#1D2340'); p(2, 16, 60, 40, '#B9C0DE'); p(2, 16, 60, 4, '#D9DEF2'); p(6, 22, 52, 26, '#4FA8E8'); p(6, 22, 52, 4, '#8AD0FF'); p(2, 50, 60, 6, '#8A90B0');
    p(26, -14, 12, 38, '#1D2340'); p(28, -12, 8, 34, '#D9DEF2'); p(20, -18, 24, 8, '#1D2340'); p(22, -16, 20, 4, '#B9C0DE');
    return (bldC.fountain = c);
  }

  /* ================= Meshy 그림 (v40) =================
   *  img/ 폴더의 그림을 불러 두었다가 있으면 쓰고, 없으면(또는 늦으면) 코드로 그린 그림을 씀
   *  bld_potion·bld_school·bld_chief·bld_castle / boss_r0~8 / mon_r0~8 (9칸 × 64px) / obj_r0~8_1·2 / key.jpg */
  const RIMG = {}, IMG_DIR = 'games/action/rpg/img/';
  const IMG_LIST = ['bld_potion', 'bld_school', 'bld_chief', 'bld_castle', 'bld_forge', 'bld_station', 'bld_fountain', 'fx_enh_ok', 'fx_enh_break', 'ic_leg_sw', 'ic_leg_ar', 'ic_sw', 'ic_st', 'ic_hm', 'ic_ar', 'ic_rg', 'ic_bt', 'ic_pot', 'ic_hm_b', 'ic_hm_s', 'ic_ar_b', 'ic_ar_s', 'ic_bt_b', 'ic_bt_s'].concat([0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap(i => ['boss_r' + i, 'mon_r' + i, 'obj_r' + i + '_1', 'obj_r' + i + '_2']));
  let imgPromise = null;
  function loadImages(timeoutMs) {
    if (!imgPromise) imgPromise = Promise.all(IMG_LIST.concat(['key']).map(n => new Promise(res => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => { RIMG[n] = im; res(); }; im.onerror = () => res();
      im.src = IMG_DIR + n + (n === 'key' ? '.jpg' : '.png') + (n === 'ic_sw' ? '?v=99' : /^ic_(st|hm|ar|rg)$/.test(n) ? '?v=100' : n === 'ic_bt' ? '?v=101' : n === 'ic_pot' ? '?v=102' : /^ic_(hm|ar|bt)_[bs]$/.test(n) ? '?v=107' : /^bld_(potion|school|chief|castle|station|fountain)$/.test(n) ? '?v=86' : '?v=40');   // v84 마을 건물 그림 새로
    })));
    [0, 1, 2, 3, 4, 5, 6, 7, 8].forEach(i => ['_ground', '_path', '_water'].forEach(k => img79('r' + i + k)));   // v80 재질은 미리 (기다리지는 않음)
    return Promise.race([imgPromise, new Promise(r => setTimeout(r, timeoutMs || 6000))]);
  }
  const imgOk = n => { const im = RIMG[n]; return im && im.complete && im.naturalWidth ? im : null; };
  /* v80 Meshy 그림 2차 (img/v79/ · 126장): 필요할 때 불러옴. 아직이면 null → 다 불러오면 cb() */
  const V79 = {};
  function img79(n, cb) {
    let e = V79[n];
    if (!e) {
      const im = new Image(); im.decoding = 'async'; e = V79[n] = { im, ok: false, bad: false, cbs: [] };
      im.onload = () => { e.ok = true; e.cbs.splice(0).forEach(f => { try { f(); } catch (er) { console.warn('[rpg] 그림', er); } }); };
      im.onerror = () => { e.bad = true; e.cbs.length = 0; };
      im.src = IMG_DIR + 'v79/' + n + (/_(ground|path|water)$|^hellfloor/.test(n) ? '.jpg' : '.png') + '?v=80';
    }
    if (e.ok) return e.im;
    if (cb && !e.bad) e.cbs.push(cb);
    return null;
  }
  // 지도 재질: [땅, 길, 물]. 저승은 관문마다 바닥 그림 (물 = 용암 · 3관문 얼음 · 6관문 독늪)
  function texOf(map) {
    const M = map.M;
    if (M.hell) { const g = 'hellfloor' + M.gate, wt = M.gate === 3 ? 'r5_water' : M.gate === 6 ? 'r2_water' : 'r8_water'; return [g, g, wt]; }
    const r = 'r' + M.region; return [r + '_ground', r + '_path', r + '_water'];
  }

  /* ================= 그림 조각 (몬스터 · 아바타 + 장비) ================= */
  const monCache = {};
  // 몬스터: 12×12 도트 → 위쪽이 비면 밝게, 아래쪽이 비면 어둡게 (입체감) + 반짝임 점
  /* ---------------- v69 저승 몬스터 도트 그림 (작게 그린 뒤 2배로 키움 · 테두리 자동) ----------------
   *  Meshy 그림으로 바꾸기 전까지 쓰는 손 도트. 일반 몬스터 24×24 · 보스 40×40 칸 */
  function hellPainter(N) {
    const g = Array.from({ length: N }, () => Array(N).fill(null));
    const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
    const r = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
    const e = (cx, cy, rx, ry, c) => { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x - cx) / (rx + 0.35)) ** 2 + ((y - cy) / (ry + 0.35)) ** 2 <= 1) px(x, y, c); };
    const ln = (x0, y0, x1, y1, c, w) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (w > 1) r(x - (w >> 1), y - (w >> 1), w, w, c); else px(x, y, c); } };
    const tri = (x0, y0, x1, y1, x2, y2, c) => { const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2); for (let y = minY; y <= maxY; y++) for (let x = Math.min(x0, x1, x2); x <= Math.max(x0, x1, x2); x++) { const d = (ax, ay, bx, by) => (bx - ax) * (y - ay) - (by - ay) * (x - ax); const a = d(x0, y0, x1, y1), b = d(x1, y1, x2, y2), cc = d(x2, y2, x0, y0); if ((a >= 0 && b >= 0 && cc >= 0) || (a <= 0 && b <= 0 && cc <= 0)) px(x, y, c); } };
    return { N, g, px, r, e, ln, tri };
  }
  const HELL_ART = {
    // 칼산 망령: 칼에 꿰인 채 떠도는 창백한 혼 (붉은 눈 · 너덜너덜한 아랫자락 · 몸을 꿰뚫은 부러진 칼)
    h_wraith(p) {
      const { r, e, ln, px } = p;
      for (let x = 5; x <= 18; x++) r(x, 13, 1, 6 + ((x * 7) % 4), x % 2 ? '#9AA8D8' : '#B4C2EA');           // 너덜너덜한 자락
      e(12, 10, 7, 7, '#C8D4F2'); e(14.5, 11.5, 4, 5, '#9EACDA'); e(9, 7, 2.5, 2.5, '#EEF2FF');           // 몸 · 그늘 · 빛
      r(4, 11, 2, 5, '#B4C2EA'); r(19, 11, 2, 5, '#9EACDA'); px(4, 16, '#9AA8D8'); px(20, 16, '#8A98C8');   // 흐느적거리는 팔
      r(8, 8, 3, 3, '#1A0A1E'); r(14, 8, 3, 3, '#1A0A1E'); px(9, 9, '#FF3A3A'); px(15, 9, '#FF3A3A'); px(9, 8, '#FF8A8A'); px(15, 8, '#FF8A8A');
      r(10, 13, 5, 2, '#2A1830'); px(11, 13, '#E8ECF8'); px(13, 13, '#E8ECF8');                            // 벌린 입
      ln(2, 21, 21, 2, '#C8CCD8', 1); ln(3, 21, 21, 3, '#8A90A8', 1); px(20, 2, '#FFFFFF');                 // 꿰뚫은 칼날
      r(1, 19, 4, 2, '#7A4A20'); r(2, 18, 2, 4, '#5A3010'); px(2, 22, '#FFD23F');                          // 칼자루 · 술
      for (let i = 0; i < 4; i++) px(6 + i * 4, 21 + (i % 2), '#E0E8FF');                                     // 흩날리는 혼불
    },
    // 칼 든 원혼: 녹슨 갑옷을 입은 해골 병사, 이 빠진 칼을 치켜듦
    h_soldier(p) {
      const { r, e, ln, px } = p;
      e(11, 5, 4, 4, '#E8E0CC'); e(12.5, 6, 2, 3, '#C8BEA4'); r(8, 1, 7, 2, '#3A2A20'); r(7, 2, 9, 1, '#5A4030');   // 해골 · 투구
      r(9, 5, 2, 2, '#1A0A10'); r(12, 5, 2, 2, '#1A0A10'); px(9, 5, '#FF4A3A'); px(12, 5, '#FF4A3A'); r(10, 8, 3, 1, '#2A1A14');
      r(7, 10, 9, 7, '#6A4A3A'); r(7, 10, 9, 1, '#8A6A50'); for (let y = 11; y < 17; y += 2) r(8, y, 7, 1, '#4A3020');   // 찢어진 갑옷 (미늘)
      r(10, 11, 3, 5, '#D8D0BC'); px(11, 12, '#A89E88'); px(11, 14, '#A89E88');                                // 갈비뼈
      r(5, 10, 2, 5, '#D8D0BC'); r(16, 9, 2, 3, '#D8D0BC');                                                   // 팔뼈
      ln(17, 9, 21, 1, '#B8BCC8', 2); px(20, 2, '#FFFFFF'); px(19, 5, '#7A808C'); r(16, 9, 3, 2, '#5A3A20');   // 이 빠진 칼
      r(8, 17, 3, 5, '#D8D0BC'); r(12, 17, 3, 5, '#D8D0BC'); r(7, 21, 4, 2, '#4A3020'); r(12, 21, 4, 2, '#4A3020'); // 다리뼈 · 짚신
      r(6, 16, 11, 2, '#8A2A2A');                                                                             // 붉은 허리띠
    },
    // 우두 옥졸: 소머리 옥졸. 굽은 뿔 · 코뚜레 · 근육질 몸 · 가시 박힌 쇠몽둥이 · 쇠사슬
    h_ox(p) {
      const { r, e, ln, px, tri } = p;
      ln(9, 9, 4, 3, '#E8DCC0', 3); ln(4, 3, 6, 1, '#FFF4DC', 2); ln(29, 9, 34, 3, '#E8DCC0', 3); ln(34, 3, 32, 1, '#FFF4DC', 2);   // 뿔
      e(19, 11, 9, 7, '#7A3A26'); e(19, 15, 6, 5, '#9A5A40'); e(16, 8, 3, 2, '#9A5A40');                    // 소머리 · 주둥이
      r(13, 9, 3, 3, '#FFD23F'); r(23, 9, 3, 3, '#FFD23F'); px(14, 10, '#C80A0A'); px(24, 10, '#C80A0A');     // 노란 눈
      r(16, 15, 2, 2, '#2A1008'); r(21, 15, 2, 2, '#2A1008'); e(19.5, 18, 2.5, 1.5, '#C8C8D0'); px(19, 19, '#8A8A98');   // 콧구멍 · 코뚜레
      e(9, 12, 3, 2, '#5A2618'); e(29, 12, 3, 2, '#5A2618');                                                   // 귀
      e(19, 27, 11, 8, '#8A4430'); e(16, 24, 4, 3, '#A85A40'); e(23, 24, 4, 3, '#A85A40'); r(17, 28, 5, 4, '#7A3826');   // 가슴 근육
      e(6, 25, 4, 6, '#8A4430'); e(32, 25, 4, 6, '#7A3826');                                                   // 팔
      r(9, 32, 20, 4, '#3A2A50'); r(9, 32, 20, 1, '#FFD23F'); tri(14, 36, 24, 36, 19, 39, '#2A1A40');         // 허리띠 · 앞치마
      r(11, 36, 5, 4, '#7A3826'); r(22, 36, 5, 4, '#7A3826');                                                  // 다리
      ln(34, 28, 38, 6, '#5A5A6A', 3); e(37.5, 7, 2.5, 4, '#4A4A58'); for (let i = 0; i < 4; i++) { px(35, 4 + i * 2, '#C8C8D8'); px(39, 5 + i * 2, '#C8C8D8'); }   // 가시 쇠몽둥이
      for (let i = 0; i < 6; i++) px(4 + i, 30 + (i % 2), i % 2 ? '#9A9AA8' : '#C8C8D8');                       // 쇠사슬
    },
    // 도산 판관: 사모(날개 달린 검은 관모) · 녹색 관복 · 흉배 · 붉은 명부와 붓 · 긴 수염
    h_judge(p) {
      const { r, e, ln, px } = p;
      r(14, 2, 12, 6, '#1A1A24'); r(15, 1, 10, 2, '#2A2A38'); r(8, 4, 6, 2, '#1A1A24'); r(26, 4, 6, 2, '#1A1A24'); px(8, 4, '#3A3A4A'); px(31, 4, '#3A3A4A');   // 사모와 날개
      e(20, 11, 6, 5, '#F0D2A8'); e(22, 12, 3, 4, '#D8B48C'); r(16, 10, 3, 1, '#1A0A0A'); r(22, 10, 3, 1, '#1A0A0A'); r(15, 8, 4, 1, '#3A2A20'); r(22, 8, 4, 1, '#3A2A20');   // 얼굴 · 성난 눈썹
      px(17, 10, '#FF3A3A'); px(23, 10, '#FF3A3A');
      for (let i = 0; i < 6; i++) r(17 + i, 15, 1, 6 + (i % 3), '#2A2A30');                                    // 긴 수염
      e(20, 28, 12, 10, '#2E7A4A'); e(24, 28, 6, 9, '#22603A'); e(14, 24, 4, 4, '#3E9A5E');                   // 관복
      r(15, 23, 10, 8, '#1E3A8A'); r(16, 24, 8, 6, '#2E5AC8'); e(20, 27, 2.5, 2, '#FFD23F'); px(20, 27, '#FF8A3D');   // 흉배 (학 무늬 자리에 금빛)
      r(9, 34, 22, 3, '#22603A'); r(13, 31, 14, 2, '#C8A040'); px(20, 32, '#FFF4C0');                         // 각대(허리띠)
      e(7, 25, 3, 6, '#2E7A4A'); e(33, 25, 3, 6, '#22603A');                                                   // 넓은 소매
      r(1, 22, 7, 9, '#B8302A'); r(2, 23, 5, 7, '#E8D8B0'); for (let y = 24; y < 30; y += 2) r(3, y, 3, 1, '#5A3A20');   // 붉은 명부
      ln(33, 30, 38, 20, '#7A4A20', 2); r(37, 18, 2, 3, '#1A1A1A');                                            // 붓
      r(14, 37, 5, 3, '#1A1A24'); r(22, 37, 5, 3, '#1A1A24');                                                  // 목화(신)
    },
    // 진광대왕: 면류관(구슬 줄) · 붉은 곤룡포 · 금빛 용 흉배 · 홀 · 등 뒤로 솟은 칼산
    h_king1(p) {
      const { r, e, ln, px, tri } = p;
      for (let i = 0; i < 7; i++) tri(2 + i * 6, 22, 6 + i * 6, 22, 4 + i * 6, 6 + (i % 2) * 5, i % 2 ? '#8A90A8' : '#B8BCC8');   // 뒤 칼산
      for (let i = 0; i < 7; i++) px(4 + i * 6, 7 + (i % 2) * 5, '#FFFFFF');
      r(11, 3, 18, 3, '#1A1A24'); r(10, 2, 20, 1, '#FFD23F'); for (let i = 0; i < 9; i++) { const x = 11 + i * 2; r(x, 6, 1, 4, i % 2 ? '#FF3A3A' : '#FFD23F'); }   // 면류관 · 구슬 줄
      r(15, 6, 10, 2, '#C8A040');
      e(20, 12, 6, 5, '#F0C8A0'); e(22.5, 13, 3, 4, '#D8A880'); r(16, 11, 3, 2, '#1A0A0A'); r(22, 11, 3, 2, '#1A0A0A'); px(17, 11, '#FFD23F'); px(23, 11, '#FFD23F');   // 얼굴 · 금빛 눈
      r(15, 9, 4, 1, '#2A1A10'); r(22, 9, 4, 1, '#2A1A10');
      for (let i = 0; i < 8; i++) r(16 + i, 16, 1, 5 + (i % 3) * 2, '#1A1A20');                               // 수염
      e(20, 30, 14, 10, '#C8302A'); e(26, 30, 7, 9, '#9A1E1A'); e(13, 26, 5, 4, '#E04A3A');                   // 곤룡포
      e(20, 27, 5, 5, '#FFD23F'); e(20, 27, 4, 4, '#E8A020'); ln(17, 25, 23, 29, '#FFF4C0', 1); ln(17, 29, 23, 25, '#C86A10', 1); px(20, 27, '#FF3A3A');   // 금빛 용 보(흉배)
      r(7, 34, 26, 3, '#7A1414'); r(11, 33, 18, 2, '#FFD23F'); for (let i = 0; i < 5; i++) px(13 + i * 3, 33, '#3AA8F5');   // 옥대
      e(5, 27, 4, 7, '#C8302A'); e(35, 27, 4, 7, '#9A1E1A'); e(5, 33, 2, 2, '#F0C8A0'); e(35, 33, 2, 2, '#D8A880');   // 소매 · 손
      ln(35, 33, 38, 14, '#E8DCC0', 2); px(38, 13, '#FFFFFF');                                                 // 홀(笏)
      r(12, 37, 6, 3, '#1A1A24'); r(22, 37, 6, 3, '#1A1A24'); r(12, 37, 6, 1, '#FFD23F'); r(22, 37, 6, 1, '#FFD23F');
    }
  };
  function hellSprite(mon, scale) {
    const big = scale >= 6, N = big ? 40 : 24, P = hellPainter(N); HELL_ART[mon.art](P);
    const g = P.g, filled = (x, y) => x >= 0 && y >= 0 && x < N && y < N && g[y][x] && g[y][x] !== '#140A12';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x] && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) g[y][x] = '#140A12';   // 검붉은 테두리
    const k = 2, [c, x] = mk(N * k, N * k);
    for (let y = 0; y < N; y++) for (let i = 0; i < N; i++) if (g[y][i]) { x.fillStyle = g[y][i]; x.fillRect(i * k, y * k, k, k); }
    const [c2, x2] = mk(N * k, N * k); x2.drawImage(c, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#FFFFFF'; x2.fillRect(0, 0, c2.width, c2.height);
    return { img: c, flash: c2, w: N * k, h: N * k };
  }
  /* v80 Meshy 2차 몬스터: 왜군(mon.img79) · 저승(mon.img) · 지역 보스(boss_r) — 그림 높이를 맞춰 줄임
   *  그림을 아직 못 불러왔으면 옛 그림(도트)을 wait 표시와 함께 돌려줌 → game.js drawMon 이 다 불러오면 바꿔 끼움 */
  function imgSprite(im, H) {
    const w = Math.max(1, Math.round(im.naturalWidth * H / im.naturalHeight)), [c, x] = mk(w, H);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, H);
    const [c2, x2] = mk(w, H); x2.drawImage(c, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#FFFFFF'; x2.fillRect(0, 0, w, H);
    return { img: c, flash: c2, w, h: H, meshy: true };
  }
  function monSprite(mon, scale) {
    const key = mon.name + scale; if (monCache[key]) return monCache[key];
    const boss = scale >= 6, nm = mon.img79 || mon.img || (boss && mon.ri != null && !mon.dot ? 'boss_r' + mon.ri : null);
    if (nm) {
      const H = !boss ? (mon.h || 64) : /_king$|^boss_r/.test(nm) ? 150 : 124, im = img79(nm);
      if (im) return (monCache[key] = imgSprite(im, H));
      const wk = key + '~wait'; if (monCache[wk]) return monCache[wk];
      img79(nm, () => {});
      return (monCache[wk] = Object.assign({}, monSpriteOld(mon, scale, wk), { wait: true }));
    }
    return monSpriteOld(mon, scale, key);
  }
  function monSpriteOld(mon, scale, key) {
    if (monCache[key]) return monCache[key];
    if (mon.art && HELL_ART[mon.art]) return (monCache[key] = hellSprite(mon, scale));   // v69 저승 몬스터
    // Meshy 그림이 있으면 그것을 씀 (보스: boss_r, 일반: mon_r 의 k번째 칸)
    const boss = scale >= 6, im = mon.ri != null && !mon.dot ? imgOk(boss ? 'boss_r' + mon.ri : 'mon_r' + mon.ri) : null;
    if (im && (boss || mon.k < 9)) {
      const sx = boss ? 0 : mon.k * 64, sw = boss ? im.naturalWidth : 64, sh = boss ? im.naturalHeight : 64;
      const [t, tx] = mk(sw, sh); tx.drawImage(im, sx, 0, sw, sh, 0, 0, sw, sh);
      const d = tx.getImageData(0, 0, sw, sh).data; let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (d[(y * sw + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 > 0) {
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1, [c, x] = mk(cw, ch); x.drawImage(t, x0, y0, cw, ch, 0, 0, cw, ch);
        const [c2, x2] = mk(cw, ch); x2.drawImage(c, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#FFFFFF'; x2.fillRect(0, 0, cw, ch);
        return (monCache[key] = { img: c, flash: c2, w: cw, h: ch, meshy: true });
      }
    }
    const sh = D.SHAPES[mon.shape] || D.SHAPES.slime, C = Object.assign({ e: '#FFFFFF', k: '#1D2340' }, mon.colors);
    const [c, x] = mk(12 * scale, 12 * scale), at = (i, j) => (sh[j] && sh[j][i]) || '.';
    const empty = ch => ch === '.' || ch === 'k';
    sh.forEach((row, j) => { for (let i = 0; i < 12; i++) {
      const ch = row[i]; if (ch === '.' || !C[ch]) continue;
      let col = C[ch];
      if (ch === 'a' || ch === 'b' || ch === 'c' || ch === 'd') {
        if (empty(at(i, j - 1))) col = shade(col, 0.22); else if (empty(at(i, j + 1)) || empty(at(i + 1, j))) col = shade(col, -0.18);
      }
      x.fillStyle = col; x.fillRect(i * scale, j * scale, scale, scale);
      if (ch === 'a' && scale >= 3 && empty(at(i, j - 1)) && empty(at(i - 1, j))) { x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(i * scale + 1, j * scale + 1, Math.max(1, scale / 3), Math.max(1, scale / 3)); }
    } });
    // 흰 깜빡임용 (맞았을 때)
    const [c2, x2] = mk(12 * scale, 12 * scale); x2.drawImage(c, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#FFFFFF'; x2.fillRect(0, 0, c2.width, c2.height);
    return (monCache[key] = { img: c, flash: c2, w: 12 * scale, h: 12 * scale });
  }

  // 장비 그림 (아바타 칸 좌표 · 18 × 29 · 테두리 1칸 포함)
  const GW = AV.size.w, GH = AV.size.h;
  function gearCells(eq, frame) {
    const cells = Array.from({ length: GH }, () => Array(GW).fill(null));
    const px = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const gx = x + i + 1, gy = y + j + 1; if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) cells[gy][gx] = c; } };
    const it = s => eq[s] && D.ITEMS[eq[s]], T = s => D.TIER[it(s).tier];
    if (it('boots') && !imgOk('ic_bt')) { const t = T('boots'), L = AV.legs(frame); px(L.L.x, L.LF.y - 2, 3, 3, t.color); px(L.R.x, L.RF.y - 2, 3, 3, t.color); px(L.L.x - 1, L.LF.y, 1, 1, t.dark); px(L.R.x + 3, L.RF.y, 1, 1, t.dark); px(L.L.x, L.LF.y - 2, 3, 1, t.dark); px(L.R.x, L.RF.y - 2, 3, 1, t.dark); }
    if (it('armor') && !imgOk('ic_ar')) { const t = T('armor'), r = it('armor').rare; px(5, 12, 6, 7, t.color); px(5, 18, 6, 1, t.dark); px(2, 12, 3, 2, t.color); px(11, 12, 3, 2, t.color); px(2, 13, 3, 1, t.dark); px(11, 13, 3, 1, t.dark); px(6, 13, 1, 4, shade(t.color, 0.35)); px(7, 14, 2, 2, r ? t.gem : t.dark); }
    if (it('helmet') && !imgOk('ic_hm')) { const t = T('helmet'), r = it('helmet').rare; px(4, 1, 8, 4, t.color); px(3, 3, 1, 4, t.color); px(12, 3, 1, 4, t.color); px(4, 4, 8, 1, t.dark); px(5, 1, 2, 1, shade(t.color, 0.4)); if (r) { px(7, 0, 2, 1, t.gem); px(7, 2, 2, 1, t.gem); } }
    if (it('weapon')) {
      const t = T('weapon'), wp = it('weapon');
      if (wp.look === 'staff') { if (!imgOk('ic_st')) { px(14, 6, 1, 16, '#7A5230'); px(13, 2, 3, 1, t.color); px(13, 3, 3, 3, t.gem); px(12, 4, 1, 1, t.color); px(16, 4, 1, 1, t.color); px(14, 4, 1, 1, '#FFFFFF'); } }
      else if (!imgOk('ic_sw')) { px(14, 5, 1, 12, '#EEF1FF'); px(15, 6, 1, 10, '#B9C0DE'); px(14, 4, 1, 1, '#FFFFFF'); px(12, 17, 5, 1, t.color); px(14, 18, 1, 2, t.dark); px(14, 20, 1, 1, t.gem); }
    }
    if (it('ring') && !imgOk('ic_rg')) px(12, 18, 1, 1, T('ring').gem);
    return cells;
  }

  const SLOT_IC = { helmet: 'ic_hm', armor: 'ic_ar', ring: 'ic_rg', boots: 'ic_bt' }, WP_IC = { sword: 'ic_sw', staff: 'ic_st' }, WP_SZ = { sword: [16, 0.86], staff: [18, 0.8] },   // 무기 높이(칸) · 손잡이 자리(위에서부터 비율)
    WP_ANG = { sword: { 0: 32, c: 40, a: 75 }, staff: { 0: 18, c: 32, a: 45 } },   // 자세별 기울기(도)
    HAND = { 0: [0, 0], 1: [0, 1], 3: [0, -1], c: [0, -6.5], a: [1, -2] };   // 자세별 무기 쥔 손 위치 (서 있을 때 기준, 칸)   // 무기 그림 · 손에 들 때 높이·아래 끝(칸)
  const swBoxC = {};
  function swBox(im, n, nm) {   // v99 무기 그림 칸(80×80)에서 실제 그림이 있는 범위
    const ck = nm + n; if (swBoxC[ck]) return swBoxC[ck];
    const [t, tx] = mk(80, 80); tx.drawImage(im, n * 80, 0, 80, 80, 0, 0, 80, 80);
    const d = tx.getImageData(0, 0, 80, 80).data; let x0 = 80, y0 = 80, x1 = -1, y1 = -1;
    for (let y = 0; y < 80; y++) for (let i = 0; i < 80; i++) if (d[(y * 80 + i) * 4 + 3] > 20) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return (swBoxC[ck] = x1 < 0 ? { x: 0, y: 0, w: 80, h: 80 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  /* v108 투구 그리기: 눈 자리(eye 상자, 그림 점 좌표)의 아주 어두운 점(검은 눈구멍)은 투명하게 → 아래 아바타 눈이 보임 */
  function hmDraw(x, im, sx, sy, sw, sh, X, Y, W, H, eye) {
    const [t, tx] = mk(W, H); tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
    tx.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
    if (eye) {
      const x0 = Math.max(0, Math.round(eye[0] - X)), y0 = Math.max(0, Math.round(eye[1] - Y)), x1 = Math.min(W, Math.round(eye[2] - X)), y1 = Math.min(H, Math.round(eye[3] - Y));
      if (x1 > x0 && y1 > y0) {
        const d = tx.getImageData(x0, y0, x1 - x0, y1 - y0), a = d.data;
        for (let i = 0; i < a.length; i += 4) if (a[i + 3] > 0 && a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11 < 62) a[i + 3] = 0;
        tx.putImageData(d, x0, y0);
      }
    }
    x.drawImage(t, X, Y);
  }
  const HM_GROW = 1.07;   // v108 투구 아주 조금 크게
  /* v112 새 기본 몸 그림 (avatar/body/*.png): 기본 옷만 입었으면 칸 그림 대신 이 그림을 몸으로 씀 (장비 그림은 그 위에 그대로)
   *  그림 키 27.4칸 · 발바닥 28.4칸 · 가운데 cx(점) — 사이트 아바타 칸 그림과 같은 자리 */
  const bodyOf = (av, view, eq, hide) => {
    if (!AV.useBody || !AV.useBody(av)) return null;
    // v120 장비 그림을 아직 못 받았어도 새 몸 그림 (예전 도트 몸은 안 씀 · 장비는 받는 대로 그려짐)
    if (!hide && eq && eq.helmet && D.ITEMS[eq.helmet] && av && av.hat) av = Object.assign({}, av, { hat: null });   // v114 투구를 쓰면 모자 그림은 빼기
    return AV.bodyComp ? AV.bodyComp(av, view, null) : AV.bodyImg(av.g, view, null, AV.normalize(av).skin);   // v114 피부마다 다른 그림 + 상점 머리 얹기
  };
  function drawBody(x, im, cx, k) {
    if (AV.fitBody) { AV.fitBody(x, im, cx, k); x.imageSmoothingEnabled = false; return; }   // v114 머리 얹은 그림(여백 있음)도 같은 크기로
    const hh = Math.round(27.4 * k), ww = Math.round(im.naturalWidth * hh / im.naturalHeight), by = Math.round(28.4 * k);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(im, Math.round(cx - ww / 2), by - hh, ww, hh);
    x.imageSmoothingEnabled = false;
  }
  const avCache = {};
  /* v107 방향 그림: view 'b' 뒤 · 's' 옆(오른쪽을 봄). 사람은 사이트 아바타의 자동 방향 그림(AV.gridView),
   *  장비 그림은 투구 뒷모습 = img/ic_hm_b.png(선생님 그림), 나머지는 앞 그림을 쓰거나(뒤) 좁혀서(옆) 씀.
   *  part: 옆모습 걷기용으로 'noArm'(팔 뺀 몸) · 'arm'(가까운 팔 + 무기) 따로 */
  let blankC = null; const blankSp = k => { if (!blankC) blankC = mk(GW * k, GH * k)[0]; return blankC; };
  function dirSprite(av, eq, hide, view, part) {
    const bodyI = bodyOf(av, view, eq, hide);
    if (!bodyI) return blankSp(view === 's' ? 2 : 2);   // v120 몸 그림을 받는 중이면 잠깐 빈 그림 (도트 안 씀)
    const key = JSON.stringify([av, hide ? {} : eq, view, part || '', !!bodyI, !!imgOk('ic_sw'), !!imgOk('ic_st'), !!imgOk('ic_hm'), !!imgOk('ic_hm_b'), !!imgOk('ic_hm_s'), !!imgOk('ic_ar_b'), !!imgOk('ic_ar_s'), !!imgOk('ic_bt_b'), !!imgOk('ic_bt_s'), !!imgOk('ic_ar'), !!imgOk('ic_bt')]);
    if (avCache[key]) return avCache[key];
    const k = 2, side = view === 's', arm = part === 'arm', noArm = part === 'noArm';
    const wp = !hide && eq && eq.weapon && D.ITEMS[eq.weapon], wIc = wp && WP_IC[wp.look], swI = wIc && imgOk(wIc), PAD = swI ? 9 * k : 0;
    const hmIt = !hide && eq && eq.helmet && D.ITEMS[eq.helmet], hmNm = hmIt && (view === 'b' && imgOk('ic_hm_b') ? 'ic_hm_b' : side && imgOk('ic_hm_s') ? 'ic_hm_s' : 'ic_hm'), hmI = hmIt && imgOk(hmNm);   // v107 투구 뒷모습·옆모습 그림
    const [c, x] = mk(GW * k + PAD * 2, GH * k);
    const nOf = o => (o.legend ? 9 : o.rare ? 10 + o.tier : o.tier);
    const CX = side ? 9.4 : 8.875;   // 몸 가운데 (칸)
    const drawWeapon = () => {
      const n = nOf(wp), b = swBox(swI, n, wIc), [hc, gf] = WP_SZ[wp.look];
      const hx = (side ? 9.9 : 12.75) * k + PAD, hy = 18.5 * k;
      let hh = hc * k, ww = Math.max(1, Math.round(b.w * hh / b.h)); if (ww > 13 * k) { hh = Math.round(hh * 13 * k / ww); ww = 13 * k; }
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.save(); x.translate(hx, hy); x.rotate(WP_ANG[wp.look][0] * Math.PI / 180); x.drawImage(swI, n * 80 + b.x, b.y, b.w, b.h, -ww / 2, -hh * gf, ww, hh); x.restore();
      x.imageSmoothingEnabled = false;
    };
    if (swI && view === 'b') drawWeapon();   // 뒤: 무기는 몸 뒤에
    if (!arm) drawBody(x, bodyI, CX * k + PAD, k);   // v112 새 기본 몸 (옆 걷기용 '팔' 조각은 비움 → 무기만)
    if (!arm) {
      // v107 신발: 뒤 = ic_bt_b(두 짝 그림 → 왼쪽 반은 왼발, 오른쪽 반은 오른발) · 옆 = ic_bt_s(앞코가 오른쪽) · 없으면 앞 그림
      const btOn = !hide && eq && eq.boots && D.ITEMS[eq.boots], btNm = btOn && (view === 'b' && imgOk('ic_bt_b') ? 'ic_bt_b' : side && imgOk('ic_bt_s') ? 'ic_bt_s' : 'ic_bt'), btI = btOn && imgOk(btNm);
      if (btI) {
        const n = nOf(D.ITEMS[eq.boots]), b0 = swBox(btI, n, btNm), L = AV.legs(0), pair = btNm === 'ic_bt_b';
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        const feet = side ? [[{ x: 9.6, y: L.RF.y }, 0, btNm === 'ic_bt']] : [[L.LF, 2.7, false, 0], [L.RF, 3.3, !pair, 1]];
        feet.forEach(([F, dx, flip, half]) => {
          const b = pair ? { x: b0.x + (half ? Math.floor(b0.w / 2) : 0), y: b0.y, w: Math.ceil(b0.w / 2), h: b0.h } : b0;
          let hh = 4.6 * k, ww = b.w * hh / b.h; const mw = (btNm === 'ic_bt_s' ? 6.4 : 5.4) * k; if (ww > mw) { ww = mw; hh = b.h * ww / b.w; }
          const cx = (F.x + dx) * k + PAD, by = (F.y + 3) * k, X = Math.round(cx - ww / 2), Y = Math.round(by - hh), W2 = Math.round(ww), H2 = Math.round(hh);
          if (flip) { x.save(); x.translate(X + W2, Y); x.scale(-1, 1); x.drawImage(btI, n * 80 + b.x, b.y, b.w, b.h, 0, 0, W2, H2); x.restore(); }
          else x.drawImage(btI, n * 80 + b.x, b.y, b.w, b.h, X, Y, W2, H2);
        });
      }
      const arOn = !hide && eq && eq.armor && D.ITEMS[eq.armor], arNm = arOn && (view === 'b' && imgOk('ic_ar_b') ? 'ic_ar_b' : side && imgOk('ic_ar_s') ? 'ic_ar_s' : 'ic_ar'), arI = arOn && imgOk(arNm);   // v107 갑옷 뒷모습·옆모습 그림
      if (arI) {
        const n = nOf(D.ITEMS[eq.armor]), b = swBox(arI, n, arNm);
        let ww = Math.min(14 * k, Math.max(11 * k, Math.round(b.w * 10.5 * k / b.h))), hh = Math.round(b.h * ww / b.w); if (hh > 12.5 * k) { hh = 12.5 * k; ww = Math.round(b.w * hh / b.h); }
        if (side) ww = Math.round(ww * (arNm === 'ic_ar_s' ? 0.85 : 0.72));   // 옆 그림은 비스듬한(3/4) 모습이라 조금만 좁힘
        x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
        x.drawImage(arI, n * 80 + b.x, b.y, b.w, b.h, Math.round(CX * k + PAD - ww / 2), Math.round(11.6 * k), ww, Math.round(hh));
      }
      if (hmI) {
        const n = nOf(hmIt), b = swBox(hmI, n, hmNm);
        let ww = Math.round(12 * k * HM_GROW); const hh = Math.max(Math.round(11 * k * HM_GROW), Math.round(b.h * ww / b.w)); if (side && hmNm === 'ic_hm') ww = Math.round(ww * 0.82);   // 옆 그림이 없을 때만 앞 그림을 좁힘
        const X = Math.round(CX * k + PAD - ww / 2), Y = Math.round(12.8 * k - hh);
        const eye = view === 'b' ? null : side ? [9.5 * k + PAD, 6.5 * k, 13 * k + PAD, 10 * k] : [5.5 * k + PAD, 6.5 * k, 12.5 * k + PAD, 10 * k];
        hmDraw(x, hmI, n * 80 + b.x, b.y, b.w, b.h, X, Y, ww, hh, eye);
      }
    }
    if (swI && side && !noArm) {   // 옆: 무기는 가까운 손에, 손을 손잡이 위에 다시
      const hb = [Math.round(9.9 * k + PAD - 2 * k), Math.round(18.5 * k - 2 * k), 4 * k, 4 * k], [hc2, hx2] = mk(hb[2], hb[3]);
      hx2.drawImage(c, hb[0], hb[1], hb[2], hb[3], 0, 0, hb[2], hb[3]); drawWeapon(); x.drawImage(hc2, hb[0], hb[1]);
    }
    const keys = Object.keys(avCache); if (keys.length > 240) delete avCache[keys[0]];
    return (avCache[key] = c);
  }
  function avatarSprite(av, eq, hide, frame, view, part) {
    if (view === 'b' || view === 's') return dirSprite(av, eq, hide, view, part);
    const bodyI = bodyOf(av, 'f', eq, hide);
    if (!bodyI) return blankSp(2);   // v120
    const key = JSON.stringify([av, hide ? {} : eq, frame, !!bodyI, !!imgOk('ic_sw'), !!imgOk('ic_st'), !!imgOk('ic_hm'), !!imgOk('ic_ar'), !!imgOk('ic_bt')]);
    if (avCache[key]) return avCache[key];
    const pose = frame, leg = typeof frame === 'number' ? frame : 0;   // 'c'·'a' 는 다리는 서 있기
    frame = leg;
    const k = 2;   // v120 몸은 늘 새 몸 그림 (예전 도트 몸·도트 장비 칸 그리기는 뺐음)
    // v99 손에 든 검 · v100 지팡이 = 새 그림 (img/ic_sw.png · ic_st.png). 그림이 넓어서 양옆을 PAD 만큼 넓힘 (가운데는 그대로)
    const wp = !hide && eq && eq.weapon && D.ITEMS[eq.weapon], wIc = wp && WP_IC[wp.look], swI = wIc && imgOk(wIc), PAD = swI ? 9 * k : 0;
    const hmI = !hide && eq && eq.helmet && D.ITEMS[eq.helmet] && imgOk('ic_hm');   // v100 투구 = 새 그림 (머리 전체를 덮음 · 머리칼이 삐져나오지 않게 머리 줄은 비움)
    const [c, x] = mk(GW * k + PAD * 2, GH * k);
    drawBody(x, bodyI, 8.875 * k + PAD, k);   // v112 새 기본 몸 그림   // v108 머리 줄을 비우지 않음 (투구 안 얼굴)
    const btI = !hide && eq && eq.boots && D.ITEMS[eq.boots] && imgOk('ic_bt');   // v101 신발 = 새 그림 (두 발에 하나씩 · 오른발은 뒤집어 앞코가 바깥쪽)
    if (btI) {
      const o = D.ITEMS[eq.boots], n = o.legend ? 9 : o.rare ? 10 + o.tier : o.tier, b = swBox(btI, n, 'ic_bt'), L = AV.legs(frame);
      let hh = 4.6 * k, ww = b.w * hh / b.h; if (ww > 5.4 * k) { ww = 5.4 * k; hh = b.h * ww / b.w; }
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      [[L.LF, 2.7, false], [L.RF, 3.3, true]].forEach(([F, dx, flip]) => {
        const cx = (F.x + dx) * k + PAD, by = (F.y + 3) * k, X = Math.round(cx - ww / 2), Y = Math.round(by - hh), W2 = Math.round(ww), H2 = Math.round(hh);
        if (flip) { x.save(); x.translate(X + W2, Y); x.scale(-1, 1); x.drawImage(btI, n * 80 + b.x, b.y, b.w, b.h, 0, 0, W2, H2); x.restore(); }
        else x.drawImage(btI, n * 80 + b.x, b.y, b.w, b.h, X, Y, W2, H2);
      });
    }
    const arI = !hide && eq && eq.armor && D.ITEMS[eq.armor] && imgOk('ic_ar');   // v100 갑옷 = 새 그림 (몸통 위에 덮음)
    if (arI) {
      const a = D.ITEMS[eq.armor], n = a.legend ? 9 : a.rare ? 10 + a.tier : a.tier, b = swBox(arI, n, 'ic_ar');
      let ww = Math.min(14 * k, Math.max(11 * k, Math.round(b.w * 10.5 * k / b.h))), hh = Math.round(b.h * ww / b.w); if (hh > 12.5 * k) { hh = 12.5 * k; ww = Math.round(b.w * hh / b.h); }
      const cx = 8.875 * k + PAD, ty = 11.6 * k;
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(arI, n * 80 + b.x, b.y, b.w, b.h, Math.round(cx - ww / 2), Math.round(ty), ww, Math.round(hh));
    }
    if (hmI) {
      const h = D.ITEMS[eq.helmet], n = h.legend ? 9 : h.rare ? 10 + h.tier : h.tier, b = swBox(hmI, n, 'ic_hm');
      const ww = Math.round(12 * k * HM_GROW), hh = Math.max(Math.round(11 * k * HM_GROW), Math.round(b.h * ww / b.w)), cx = 8.875 * k + PAD, by = 12.8 * k;
      hmDraw(x, hmI, n * 80 + b.x, b.y, b.w, b.h, Math.round(cx - ww / 2), Math.round(by - hh), ww, hh, [5.5 * k + PAD, 6.5 * k, 12.5 * k + PAD, 10 * k]);   // v108 눈구멍 투명 · 조금 크게
    }
    if (swI) {   // v101 손잡이를 손에 맞춰 쥐게 하고, 손은 무기 위에 다시 그려 '잡은' 모양으로
      const n = wp.legend ? 9 : wp.rare ? 10 + wp.tier : wp.tier, b = swBox(swI, n, wIc), [hc, gf] = WP_SZ[wp.look];
      const o = HAND[pose] || HAND[0], hx = (12.75 + o[0]) * k + PAD, hy = (18.5 + o[1]) * k;   // 무기 쥔 손의 가운데 (칸 → 그림 점)
      const hb = [Math.round(hx - 4 * k / 2), Math.round(hy - 4 * k / 2), 4 * k, 4 * k], [hc2, hx2] = mk(hb[2], hb[3]);
      hx2.drawImage(c, hb[0], hb[1], hb[2], hb[3], 0, 0, hb[2], hb[3]);   // 손 부분 따로 떠 두기
      let hh = hc * k, ww = Math.max(1, Math.round(b.w * hh / b.h)); if (ww > 13 * k) { hh = Math.round(hh * 13 * k / ww); ww = 13 * k; }   // 날개처럼 넓은 무기는 줄여서 얼굴을 덜 가리게
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      const ang = (WP_ANG[wp.look][pose] != null ? WP_ANG[wp.look][pose] : WP_ANG[wp.look][0]) * Math.PI / 180;   // 바깥쪽으로 비스듬히 (머리·얼굴을 가리지 않게)
      x.save(); x.translate(hx, hy); x.rotate(ang); x.drawImage(swI, n * 80 + b.x, b.y, b.w, b.h, -ww / 2, -hh * gf, ww, hh); x.restore();
      x.imageSmoothingEnabled = false; x.drawImage(hc2, hb[0], hb[1]);   // 손을 손잡이 위에
    }
    const keys = Object.keys(avCache); if (keys.length > 240) delete avCache[keys[0]];
    return (avCache[key] = c);
  }
  // 창에 쓰는 작은 그림 (아이템 아이콘): 장비는 그 장비만 따로 그려서 확대, 포션은 병 그림
  const icC = {};
  function itemImg(id) {
    const it = D.ITEMS[id]; if (!it) return '';
    if (it.base) return itemImg(it.base);   // v60 장비 하나하나(g:…) 는 기본 장비 그림을 같이 씀
    if (icC[id]) return icC[id];
    const S = 36, [c, x] = mk(S, S); x.imageSmoothingEnabled = false;
    const swI = it.slot === 'weapon' ? WP_IC[it.look] && imgOk(WP_IC[it.look]) : SLOT_IC[it.slot] && imgOk(SLOT_IC[it.slot]);   // v100 투구·갑옷·반지도   // v99 검 · v100 지팡이 19종 = 새 그림 (img/ic_sw.png · 80px 칸 19개: 1~10단계, 정예 1~9단계)
    if (swI) { const n = it.legend ? 9 : it.rare ? 10 + it.tier : it.tier, [c2, x2] = mk(80, 80); x2.drawImage(swI, n * 80, 0, 80, 80, 0, 0, 80, 80); return (icC[id] = c2.toDataURL()); }
    const poI = it.stack && imgOk('ic_pot'), pn = !poI ? -1 : it.kind === 'hp' ? it.tier : it.kind === 'mp' ? 9 + it.tier : it.kind === 'scroll' ? 18 : -1;   // v102 물약 18종·귀환 주문서 = 새 그림 (img/ic_pot.png · 80px 칸: 체력 1~9, 마나 1~9, 주문서)
    if (pn >= 0 && pn < 19) { const [c2, x2] = mk(80, 80); x2.drawImage(poI, pn * 80, 0, 80, 80, 0, 0, 80, 80); return (icC[id] = c2.toDataURL()); }
    const leg = it.legend && imgOk(it.slot === 'weapon' ? 'ic_leg_sw' : it.slot === 'armor' ? 'ic_leg_ar' : '');   // v60 전설 무기·갑옷 = Meshy 그림
    if (leg && !(it.slot === 'weapon' && it.look === 'staff')) { const k = Math.min((S - 2) / leg.naturalWidth, (S - 2) / leg.naturalHeight), ww = leg.naturalWidth * k, hh = leg.naturalHeight * k; x.imageSmoothingEnabled = true; x.drawImage(leg, (S - ww) / 2, (S - hh) / 2, ww, hh); return (icC[id] = c.toDataURL()); }
    if (it.stack) {
      const col = it.kind === 'hp' ? D.TIER[0] && ['#FF5A5F', '#FF8A3D', '#E8402A', '#FF6A8A', '#D2143A', '#B0102A', '#A040C0', '#FFB3D1', '#FF9A3D'][it.tier] : it.kind === 'mp' ? ['#4C7DFF', '#5AB8F5', '#2EC0B8', '#3E4AC0', '#2F55D9', '#7FA0FF', '#8A6AF0', '#BDE8FF', '#3BC8F5'][it.tier] : null;
      const p = (a, b, w, h, cc) => { x.fillStyle = cc; x.fillRect(a, b, w, h); };
      if (it.kind === 'scroll') { p(7, 8, 22, 22, '#1D2340'); p(9, 10, 18, 18, '#F5E2B8'); p(11, 14, 14, 2, '#B8834A'); p(11, 18, 14, 2, '#B8834A'); p(11, 22, 10, 2, '#B8834A'); p(5, 6, 26, 5, '#1D2340'); p(6, 7, 24, 3, '#E8C07A'); p(22, 24, 6, 6, '#D2343A'); }
      else { p(13, 3, 10, 7, '#1D2340'); p(14, 4, 8, 5, '#C8A070'); p(15, 9, 6, 4, '#1D2340'); p(8, 12, 20, 21, '#1D2340'); p(10, 14, 16, 17, '#D9E4FF'); p(10, 19, 16, 12, col); p(10, 19, 16, 2, shade(col, 0.4)); p(12, 15, 3, 6, '#FFFFFF'); p(20, 26, 4, 3, shade(col, -0.3)); if (it.tier >= 3) { p(16, 22, 4, 4, '#FFFFFF'); } }
    } else {
      const eq = {}; eq[it.slot] = id;
      const g = gearCells(eq, 0); let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
      for (let y = 0; y < GH; y++) for (let i = 0; i < GW; i++) if (g[y][i]) { x0 = Math.min(x0, i); y0 = Math.min(y0, y); x1 = Math.max(x1, i); y1 = Math.max(y1, y); }
      if (it.slot === 'ring') { const t = D.TIER[it.tier]; x.fillStyle = '#1D2340'; x.beginPath(); x.arc(18, 20, 11, 0, Math.PI * 2); x.fill(); x.fillStyle = t.color; x.beginPath(); x.arc(18, 20, 9, 0, Math.PI * 2); x.fill(); x.fillStyle = '#1D2340'; x.beginPath(); x.arc(18, 20, 5, 0, Math.PI * 2); x.fill(); x.fillStyle = t.gem; x.fillRect(14, 4, 8, 8); x.fillStyle = '#FFFFFF'; x.fillRect(15, 5, 3, 3); }
      else {
        const bw = x1 - x0 + 3, bh = y1 - y0 + 3, k = Math.max(1, Math.floor(Math.min((S - 4) / bw, (S - 4) / bh))), ox = Math.floor((S - bw * k) / 2), oy = Math.floor((S - bh * k) / 2);
        const OUT = '#1D2340';
        for (let y = y0 - 1; y <= y1 + 1; y++) for (let i = x0 - 1; i <= x1 + 1; i++) {   // 테두리
          const on = g[y] && g[y][i]; if (on) continue;
          const nb = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([a, b]) => g[y + b] && g[y + b][i + a]);
          if (nb) { x.fillStyle = OUT; x.fillRect(ox + (i - x0 + 1) * k, oy + (y - y0 + 1) * k, k, k); }
        }
        for (let y = y0; y <= y1; y++) for (let i = x0; i <= x1; i++) if (g[y][i]) { x.fillStyle = g[y][i]; x.fillRect(ox + (i - x0 + 1) * k, oy + (y - y0 + 1) * k, k, k); }
      }
    }
    return (icC[id] = c.toDataURL());
  }
  function itemIcon(id) {
    const it = D.ITEMS[id]; if (!it) return '';
    const t = it.slot ? D.TIER[it.tier] : { color: '#5A64A0', gem: '#FFFFFF' };
    return `<span class="rg-icw"><img class="rg-ic${it.rare ? ' rare' : ''}" style="--c:${t.color};--g:${t.gem}${(it.slot === 'weapon' && WP_IC[it.look] && imgOk(WP_IC[it.look])) || (SLOT_IC[it.slot] && imgOk(SLOT_IC[it.slot])) || (it.stack && imgOk('ic_pot')) ? ';image-rendering:auto' : ''}" src="${itemImg(id)}" alt="">${it.en ? `<b class="rg-en">+${it.en}</b>` : ''}</span>`;
  }

  window.__GoRPGParts = { previewMap, drawMapObj, texOf, POND, DUNGEON, DUNGEON_KEYS, loadImages, imgOk, img79, getMap, solidAt, monSprite, avatarSprite, itemIcon, itemImg, seeded, clamp, rand, pick, dist, fmtN, shade, mk, MAPBY, SOLID, W, H, TS, SAVE_V, GAME };
})();
