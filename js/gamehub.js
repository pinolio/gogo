/*
 * gogo?gogo! — GameHub: 로그인 · 전적 · 포인트 · 아바타 · 상점을 담당하는 공통 모듈
 * 모든 게임은 끝날 때 GameHub.submitScore({ game_id, score, duration_sec, extra, result, points_delta }) 하나만 호출합니다.
 *  - result       : 'win' | 'lose'
 *  - points_delta : 이번 판 포인트 변화 (각 게임 폴더 settings.js 의 points 값)
 *  - 보유 포인트는 0P 아래로 내려가지 않습니다. 서버는 한 판에 ±10P 까지만 인정합니다.
 * - config.js 에 Supabase 정보가 있으면 온라인 모드 (어느 기기에서든 유지)
 * - 없으면 체험 모드 (localStorage, 이 브라우저에만 저장)
 */
(function () {
  'use strict';
  const cfg = window.GOGO_CONFIG || {};
  const ID_RE = /^[a-z0-9_]{4,16}$/;
  const MAX_DELTA = 10;                 // 한 판 포인트 변화 한도 (schema.sql 과 같게)
  const AV = window.GoAvatar;

  const Hub = { mode: 'demo', user: null };
  const subs = new Set();
  Hub.onChange = fn => { subs.add(fn); return () => subs.delete(fn); };
  function setUser(u) {
    if (u) { u.avatar = AV.normalize(u.avatar); u.owned = u.owned || []; u.points = u.points || 0; u.earned = u.earned || 0; u.role = u.role || 'user'; u.banned = !!u.banned; }
    Hub.user = u;
    subs.forEach(fn => { try { fn(u); } catch (e) { console.error(e); } });
  }
  const COMMENT_MAX = 300, CHAT_MAX = 120;
  function cleanText(body, max) {
    body = String(body || '').replace(/\s+/g, ' ').trim();
    if (!body) throw new Error('내용을 입력해 주세요.');
    if (body.length > max) throw new Error(max + '자까지 쓸 수 있어요.');
    return body;
  }
  Hub.isAdmin = () => !!(Hub.user && Hub.user.role === 'admin');
  const clampDelta = d => Math.max(-MAX_DELTA, Math.min(MAX_DELTA, Math.round(d || 0)));
  /* v68 무단 이탈: 온라인 대결 시작 QUIT_SEC 초 안에 상대가 나가거나 기권하면 그 판은 무효 (승패·무승부·포인트 없음)
   *  + 관리자만 보는 기록 한 줄 (Hub.logQuit). 숫자를 바꾸려면 여기 QUIT_SEC 만 고치면 됨 */
  Hub.QUIT_SEC = 5;
  let quitOff = false;
  const quitRow = r => ({ game_id: String(r.game_id || '').slice(0, 30), quitter: r.quitter || null, quitter_nick: String(r.quitter_nick || '').slice(0, 30) || null,
    kind: r.kind === 'resign' ? 'resign' : 'left', sec: Math.max(0, Math.min(60, Math.round((+r.sec || 0) * 10) / 10)), extra: r.extra || null });

  // 레벨: 지금까지 '얻은' 포인트(earned) 기준. 상점에서 써도 레벨은 내려가지 않음.
  // Lv2 = 4P, Lv3 = 16P, Lv4 = 36P, Lv5 = 64P ... (Lv = √(earned/4) + 1)  ※ 밸런스 조정 예정
  Hub.levelInfo = function (earned) {
    earned = earned || 0;
    const level = Math.floor(Math.sqrt(earned / 4)) + 1;
    const cur = 4 * (level - 1) ** 2, next = 4 * level ** 2;
    return { level, cur, next, toNext: next - earned, progress: (earned - cur) / (next - cur) };
  };
  Hub.owns = id => { const it = AV.byId[id]; return !!it && (Hub.price(id) === 0 || (Hub.user && Hub.user.owned.includes(id))); };
  // 상점 가격: 온라인이면 서버(shop_items) 가격, 아니면 avatar.js 가격
  let serverPrices = null;
  Hub.price = id => (serverPrices && id in serverPrices ? serverPrices[id] : (AV.byId[id] ? AV.byId[id].price : 0));

  function check({ username, password, nickname, signup }) {
    username = String(username || '').trim().toLowerCase();
    if (!ID_RE.test(username)) throw new Error('아이디는 영문 소문자·숫자·밑줄(_)로 4~16자여야 해요.');
    if (!password || password.length < 6) throw new Error('비밀번호는 6자 이상이어야 해요.');
    if (signup) {
      nickname = String(nickname || '').trim();
      if (nickname.length < 2 || nickname.length > 10) throw new Error('닉네임은 2~10자로 정해 주세요.');
      if (window.GoFilter && window.GoFilter.has(nickname)) throw new Error('닉네임에 쓸 수 없는 말이 들어 있어요.');
    }
    return { username, password, nickname };
  }
  // v33 배너: 글자 길이·링크 주소·그림 크기 검사 (서버 표의 검사와 같게)
  const BANNER_IMG_MAX = 400000;   // 그림(data URL) 최대 글자 수 ≈ 300KB
  function cleanBanner(b) {
    b = b || {};
    const title = String(b.title || '').trim().slice(0, 40), body = String(b.body || '').trim().slice(0, 200);
    let link = String(b.link || '').trim();
    if (link && !/^https?:\/\/[^\s<>"']+$/i.test(link)) throw new Error('링크 주소는 http:// 또는 https:// 로 시작해야 해요.');
    const image = b.image ? String(b.image) : null;
    if (image && (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(image) || image.length > BANNER_IMG_MAX)) throw new Error('그림이 너무 크거나 형식이 맞지 않아요.');
    if (b.enabled && !title && !body && !image) throw new Error('제목·내용·그림 중 하나는 넣어 주세요.');
    return { enabled: !!b.enabled, title, body, image, link: link.slice(0, 500) };
  }
  Hub.BANNER_IMG_MAX = BANNER_IMG_MAX;
  function validateAvatar(av) {
    av = AV.normalize(av);
    for (const [slot] of AV.SLOTS) {
      const id = av[slot];
      if (id && !Hub.owns(id)) throw new Error(AV.byId[id].name + '은(는) 아직 구입하지 않았어요.');
    }
    return av;
  }

  // 코디 3칸: [아바타 또는 null] × 3
  const OUTFITS = 3;
  function normOutfits(list) {
    list = Array.isArray(list) ? list : [];
    return Array.from({ length: OUTFITS }, (_, i) => (list[i] && typeof list[i] === 'object' ? AV.normalize(list[i]) : null));
  }

  function summarize(records) {
    const per = {};
    window.GoSettings.ids().forEach(g => { per[g] = { plays: 0, best: 0, totalSec: 0, last: null, wins: 0, losses: 0 }; });
    records.forEach(r => {
      const p = per[r.game_id]; if (!p) return;
      p.plays++; p.best = Math.max(p.best, r.score); p.totalSec += r.duration_sec;
      if (r.result === 'win') p.wins++; else if (r.result === 'lose') p.losses++;
      if (!p.last || r.played_at > p.last) p.last = r.played_at;
    });
    const recent = records.slice().sort((a, b) => (a.played_at < b.played_at ? 1 : -1)).slice(0, 10);
    return {
      per, recent,
      total: {
        plays: records.length, totalSec: records.reduce((s, r) => s + r.duration_sec, 0),
        wins: records.filter(r => r.result === 'win').length, losses: records.filter(r => r.result === 'lose').length
      }
    };
  }

  const kstDay = iso => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  function overviewFrom(users, records, comments, chat) {
    const now = Date.now(), week = now - 7 * 864e5, today = kstDay(new Date().toISOString());
    const per = {};
    records.forEach(r => {
      const g = per[r.game_id] || (per[r.game_id] = { game_id: r.game_id, plays: 0, users: new Set(), wins: 0, losses: 0, sec: 0, best: 0, plays_7d: 0 });
      g.plays++; g.users.add(r.user_id); g.sec += r.duration_sec; g.best = Math.max(g.best, r.score);
      if (r.result === 'win') g.wins++; else if (r.result === 'lose') g.losses++;
      if (new Date(r.played_at).getTime() > week) g.plays_7d++;
    });
    const daily = {};
    records.filter(r => new Date(r.played_at).getTime() > now - 14 * 864e5).forEach(r => {
      const k = kstDay(r.played_at), x = daily[k] || (daily[k] = { day: k, plays: 0, u: new Set() }); x.plays++; x.u.add(r.user_id);
    });
    const rating = gid => { const rs = comments.filter(c => c.game_id === gid && c.rating); return rs.length ? Math.round(rs.reduce((s, c) => s + c.rating, 0) / rs.length * 10) / 10 : null; };
    return {
      members: users.length, members_7d: users.filter(u => u.created_at && new Date(u.created_at).getTime() > week).length, banned: users.filter(u => u.banned).length,
      plays: records.length, plays_today: records.filter(r => kstDay(r.played_at) === today).length,
      players_7d: new Set(records.filter(r => new Date(r.played_at).getTime() > week).map(r => r.user_id)).size,
      total_sec: records.reduce((s, r) => s + r.duration_sec, 0),
      comments: comments.filter(c => c.kind === 'comment').length, feedback: comments.filter(c => c.kind === 'feedback').length,
      chats_7d: chat.filter(m => new Date(m.created_at).getTime() > week).length,
      per_game: Object.values(per).sort((a, b) => b.plays - a.plays).map(g => ({ game_id: g.game_id, plays: g.plays, players: g.users.size, wins: g.wins, losses: g.losses, avg_sec: Math.round(g.sec / g.plays), best: g.best, plays_7d: g.plays_7d, rating: rating(g.game_id), comments: comments.filter(c => c.game_id === g.game_id).length })),
      daily: Object.values(daily).sort((a, b) => (a.day < b.day ? -1 : 1)).map(x => ({ day: x.day, plays: x.plays, players: x.u.size }))
    };
  }

  /* ---------------- 체험 모드 (localStorage) ---------------- */
  function Demo() {
    const KEY = 'gogogogo.demo.v2', SKEY = 'gogogogo.demo.session';
    const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 저장 불가 환경 */ } };
    let mem = null;

    // 랭킹이 비어 보이지 않도록 넣어 둔 예시 플레이어 (로그인 불가, 화면에 '예시'로 표시)
    const SAMPLE = [
      ['블록장인', 46, [['blocks', 18400], ['2048', 6280], ['battle', 1]]],
      ['합쳐라', 31, [['2048', 12640], ['snake', 180], ['battle', 0]]],
      ['고고왕', 24, [['blocks', 9800], ['snake', 260], ['2048', 3920], ['battle', 1]]],
      ['뱀뱀이', 12, [['snake', 420], ['blocks', 5300]]],
      ['새내기', 3, [['snake', 90], ['2048', 1480]]]
    ];
    function seed() {
      const now = Date.now(), day = 864e5, users = {}, records = [];
      SAMPLE.forEach(([nickname, earned, scores], i) => {
        const id = 'sample' + i;
        users[id] = { id, username: id, nickname, pw: null, points: Math.round(earned / 3), earned, avatar: AV.random(nickname), owned: [], sample: true };
        scores.forEach(([game_id, score], j) => {
          records.push({ user_id: id, game_id, score, result: j % 2 ? 'lose' : 'win', duration_sec: 90 + (score * 7) % 500, extra: {}, played_at: new Date(now - (i + j + 1) * day * 0.7).toISOString() });
        });
      });
      return { users, records };
    }
    function db() {
      if (mem) return mem;
      try { mem = JSON.parse(read(KEY) || 'null'); } catch (e) { mem = null; }
      if (!mem || !mem.users) mem = seed();
      return mem;
    }
    const persist = () => write(KEY, JSON.stringify(mem));
    async function hash(s) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('gogo:' + s));
        return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        let h = 0; for (const ch of s) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0; return 'f' + h;
      }
    }
    // 체험 모드 관리자: 아이디가 config.js 의 demoAdmin(기본 'gogoadmin')인 계정
    const DEMO_ADMIN = cfg.demoAdmin || 'gogoadmin';
    const pub = u => ({ id: u.id, username: u.username, nickname: u.nickname, points: u.points, earned: u.earned || 0, avatar: u.avatar, owned: (u.owned || []).slice(), role: u.username === DEMO_ADMIN ? 'admin' : (u.role || 'user'), banned: !!u.banned, created_at: u.created_at });
    const me = () => { const u = Hub.user && db().users[Hub.user.id]; if (!u) throw new Error('로그인이 필요해요.'); return u; };

    return {
      async init() { const id = read(SKEY); const u = id && db().users[id]; setUser(u ? pub(u) : null); },
      async signUp(a) {
        const { username, password, nickname } = check({ ...a, signup: true });
        const d = db();
        if (Object.values(d.users).some(u => u.username === username)) throw new Error('이미 사용 중인 아이디예요.');
        const id = 'u' + Date.now().toString(36);
        d.users[id] = { id, username, nickname, pw: await hash(password), points: 0, earned: 0, avatar: AV.normalize({}), owned: [], created_at: new Date().toISOString() };
        persist(); write(SKEY, id); setUser(pub(d.users[id]));
      },
      async signIn(a) {
        const { username, password } = check(a);
        const u = Object.values(db().users).find(x => x.username === username && !x.sample);
        if (!u || u.pw !== await hash(password)) throw new Error('아이디 또는 비밀번호가 맞지 않아요.');
        write(SKEY, u.id); setUser(pub(u));
      },
      async signOut() { write(SKEY, null); setUser(null); },
      async submitScore(rec) {
        const d = db(), u = me();
        if (u.banned) throw new Error('이용이 정지된 계정이에요.');
        const prevBest = d.records.filter(r => r.user_id === u.id && r.game_id === rec.game_id).reduce((m, r) => Math.max(m, r.score), 0);
        const delta = clampDelta(rec.points_delta), before = u.points;
        d.records.push({ user_id: u.id, game_id: rec.game_id, score: rec.score, result: rec.result || null, points_delta: delta, duration_sec: rec.duration_sec, extra: rec.extra || {}, played_at: new Date().toISOString() });
        u.points = Math.max(0, u.points + delta); u.earned = (u.earned || 0) + Math.max(0, delta);
        persist(); setUser(pub(u));
        return { gained: u.points - before, delta, best: Math.max(prevBest, rec.score), newBest: rec.score > prevBest };
      },
      async myBest(game) {
        if (!Hub.user) return null;
        return db().records.filter(r => r.user_id === Hub.user.id && r.game_id === game).reduce((m, r) => Math.max(m, r.score), 0);
      },
      async myStats() { return Hub.user ? summarize(db().records.filter(r => r.user_id === Hub.user.id)) : null; },
      // 한 게임의 내 전적만 지움 (포인트·레벨·아이템은 유지)
      async resetStats(game) {
        me();
        const d = db(), before = d.records.length;
        d.records = d.records.filter(r => !(r.user_id === Hub.user.id && r.game_id === game));
        persist(); return before - d.records.length;
      },
      async leaderboard(game, limit) {
        const d = db(), best = {};
        d.records.forEach(r => {
          if (r.game_id !== game) return;
          const x = best[r.user_id] || (best[r.user_id] = { user_id: r.user_id, best_score: -Infinity, plays: 0, best_at: null });
          if (r.score > x.best_score || (r.score === x.best_score && r.played_at < x.best_at)) { x.best_score = r.score; x.best_at = r.played_at; }
          x.plays++;
        });
        return Object.values(best)
          .map(x => { const u = d.users[x.user_id] || {}; return { ...x, nickname: u.nickname || '?', avatar: u.avatar, sample: !!u.sample }; })
          .sort((a, b) => b.best_score - a.best_score || (a.best_at < b.best_at ? -1 : a.best_at > b.best_at ? 1 : 0)).slice(0, limit || 10);
      },
      // v75: 이번 시즌(since 이후) 기록 — wins 면 승리 기록만
      async seasonRows(game, since, wins) {
        const d = db(), t = new Date(since).getTime();
        return d.records.filter(r => r.game_id === game && new Date(r.played_at).getTime() >= t && (!wins || r.result === 'win'))
          .map(r => ({ user_id: r.user_id, score: r.score, played_at: r.played_at, nickname: (d.users[r.user_id] || {}).nickname || '?' }))
          .sort((a, b) => b.score - a.score || (a.played_at < b.played_at ? -1 : 1)).slice(0, wins ? 5000 : 1);
      },
      async pointRanking(limit) {
        return Object.values(db().users).map(u => ({ user_id: u.id, nickname: u.nickname, earned: u.earned || 0, avatar: u.avatar, sample: !!u.sample }))
          .sort((a, b) => b.earned - a.earned).slice(0, limit || 10);
      },
      async loadPrices() { return null; },
      async buyItem(id) {
        const u = me(), it = AV.byId[id];
        if (!it) throw new Error('없는 아이템이에요.');
        if (Hub.owns(id)) throw new Error('이미 가지고 있는 아이템이에요.');
        const price = Hub.price(id);
        if (u.points < price) throw new Error('포인트가 ' + (price - u.points) + 'P 부족해요.');
        u.points -= price; u.owned = (u.owned || []).concat(id);
        persist(); setUser(pub(u));
      },
      async setAvatar(av) {
        const u = me(); u.avatar = validateAvatar(av); persist(); setUser(pub(u));
      },
      /* ---- 옷장: 코디 3칸 ---- */
      async getOutfits() { const u = me(); return normOutfits(u.outfits); },
      async saveOutfits(list) { const u = me(); u.outfits = normOutfits(list); persist(); return u.outfits; },
      /* ---- 댓글 · 피드백 ---- */
      async listComments(game) {
        const d = db(), uid = Hub.user && Hub.user.id, admin = Hub.isAdmin();
        return (d.comments || []).filter(c => c.game_id === game && ((c.kind === 'comment' && !c.hidden) || c.user_id === uid || admin))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 50).map(c => withUser(d, c));
      },
      async addComment(c) {
        const d = db(), u = me();
        if (u.banned) throw new Error('이용이 정지된 계정이에요.');
        const body = cleanText(c.body, COMMENT_MAX), list = d.comments || (d.comments = []);
        const last = list.filter(x => x.user_id === u.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
        if (last && Date.now() - new Date(last.created_at).getTime() < 10000) throw new Error('댓글은 10초에 한 번만 쓸 수 있어요');
        const row = { id: Date.now(), game_id: c.game_id, user_id: u.id, kind: c.kind === 'feedback' ? 'feedback' : 'comment', body, rating: c.kind === 'feedback' && c.rating ? Math.max(1, Math.min(5, c.rating | 0)) : null, hidden: false, created_at: new Date().toISOString() };
        list.push(row); persist(); return withUser(d, row);
      },
      async deleteComment(id) {
        const d = db(), u = me(), c = (d.comments || []).find(x => x.id === id);
        if (!c) return; if (c.user_id !== u.id && !Hub.isAdmin()) throw new Error('지울 수 없어요.');
        d.comments = d.comments.filter(x => x.id !== id); persist();
      },
      async setCommentHidden(id, hidden) {
        if (!Hub.isAdmin()) throw new Error('관리자만 할 수 있어요.');
        const c = (db().comments || []).find(x => x.id === id); if (c) { c.hidden = !!hidden; persist(); }
      },
      // v32: 관리자 '반영여부' 체크 (kind: 'comments' 댓글·피드백 | 'chat' 채팅)
      async setResolved(kind, id, v) {
        if (!Hub.isAdmin()) throw new Error('관리자만 할 수 있어요.');
        const d = db(), list = kind === 'chat' ? (d.chat || []) : (d.comments || []), c = list.find(x => x.id === id);
        if (c) { c.resolved = !!v; persist(); }
      },
      async adminComments(f) {
        if (!Hub.isAdmin()) throw new Error('관리자만 볼 수 있어요.');
        f = f || {}; const d = db();
        return (d.comments || []).filter(c => (!f.game || c.game_id === f.game) && (!f.kind || c.kind === f.kind))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, f.limit || 300).map(c => withUser(d, c));
      },
      /* ---- 채팅 ---- */
      async chatHistory(game, limit) {
        const d = db();
        return (d.chat || []).filter(m => m.game_id === game).slice(-(limit || 40)).map(m => withUser(d, m));
      },
      async chatSend(game, body) {
        const d = db(), u = me();
        if (u.banned) throw new Error('이용이 정지된 계정이에요.');
        body = cleanText(body, CHAT_MAX);
        const list = d.chat || (d.chat = []), recent = list.filter(m => m.user_id === u.id && Date.now() - new Date(m.created_at).getTime() < 10000);
        if (recent.length >= 5) throw new Error('채팅을 너무 빨리 보내고 있어요. 잠시 뒤에 보내 주세요');
        const row = { id: Date.now(), game_id: game, user_id: u.id, body, created_at: new Date().toISOString() };
        list.push(row); d.chat = list.slice(-500); persist(); return withUser(d, row);
      },
      async adminChat(f) {
        if (!Hub.isAdmin()) throw new Error('관리자만 볼 수 있어요.');
        f = f || {}; const d = db();
        return (d.chat || []).filter(m => !f.game || m.game_id === f.game).slice().reverse().slice(0, f.limit || 300).map(m => withUser(d, m));
      },
      async adminDeleteChat(id) { if (!Hub.isAdmin()) throw new Error('관리자만 할 수 있어요.'); const d = db(); d.chat = (d.chat || []).filter(m => m.id !== id); persist(); },
      /* ---- 관리자 ---- */
      async adminMembers() {
        if (!Hub.isAdmin()) throw new Error('관리자만 볼 수 있어요.');
        const d = db();
        return Object.values(d.users).map(u => {
          const rs = d.records.filter(r => r.user_id === u.id);
          return Object.assign(pub(u), { sample: !!u.sample, plays: rs.length, last_played: rs.reduce((m, r) => (r.played_at > (m || '') ? r.played_at : m), null), comments: (d.comments || []).filter(c => c.user_id === u.id).length });
        });
      },
      async adminMember(uid, action, value) {
        if (!Hub.isAdmin()) throw new Error('관리자만 할 수 있어요.');
        const d = db(), u = d.users[uid]; if (!u) throw new Error('없는 회원이에요.');
        if (action === 'ban') { if (uid === Hub.user.id) throw new Error('자기 자신은 정지할 수 없어요'); u.banned = true; }
        else if (action === 'unban') u.banned = false;
        else if (action === 'points') { const v = parseInt(value, 10) || 0; u.points = Math.max(0, u.points + v); u.earned = (u.earned || 0) + Math.max(0, v); }
        else if (action === 'nickname') { const n = String(value || '').trim(); if (n.length < 2 || n.length > 10) throw new Error('닉네임은 2~10자'); u.nickname = n; }
        else if (action === 'reset_records') d.records = d.records.filter(r => r.user_id !== uid);
        else if (action === 'make_admin') u.role = 'admin';
        else if (action === 'remove_admin') { if (uid === Hub.user.id) throw new Error('자기 자신의 관리자 권한은 뺄 수 없어요'); u.role = 'user'; }
        persist(); if (uid === Hub.user.id) setUser(pub(u));
      },
      async adminGameRecords(game) {
        if (!Hub.isAdmin()) throw new Error('관리자만 볼 수 있어요.');
        const d = db();
        return d.records.filter(r => r.game_id === game).map(r => withUser(d, r));
      },
      async adminOverview() {
        if (!Hub.isAdmin()) throw new Error('관리자만 볼 수 있어요.');
        return overviewFrom(Object.values(db().users), db().records, db().comments || [], db().chat || []);
      },
      /* ---- v35 실시간 접속자 (체험: 이 브라우저 안 저장소 'gogogogo.demo.online' — 탭끼리 같이 보도록 매번 새로 읽음) ---- */
      async onlinePing(c, game, mobile) {
        const OK = 'gogogogo.demo.online'; let o = {}; try { o = JSON.parse(localStorage.getItem(OK) || '{}') || {}; } catch (e) { o = {}; }
        const now = Date.now(), r = o[c], g = /^[a-z0-9_-]{2,30}$/.test(game || '') ? game : '';
        if (!r || now - r.last_seen > 600000) o[c] = { client_id: c, user_id: Hub.user ? Hub.user.id : null, game: g, mobile: !!mobile, started_at: now, game_at: now, last_seen: now };
        else Object.assign(r, { user_id: Hub.user ? Hub.user.id : null, mobile: !!mobile, game_at: r.game !== g ? now : r.game_at, game: g, last_seen: now });
        Object.keys(o).forEach(k => { if (now - o[k].last_seen > 600000) delete o[k]; });
        try { localStorage.setItem(OK, JSON.stringify(o)); } catch (e) { /* noop */ }
      },
      async onlineLeave(c) { const OK = 'gogogogo.demo.online'; try { const o = JSON.parse(localStorage.getItem(OK) || '{}') || {}; delete o[c]; localStorage.setItem(OK, JSON.stringify(o)); } catch (e) { /* noop */ } },
      async adminOnline() {
        if (!Hub.isAdmin()) throw new Error('관리자만 볼 수 있어요.');
        let o = {}; try { o = JSON.parse(localStorage.getItem('gogogogo.demo.online') || '{}') || {}; } catch (e) { o = {}; }
        const d = db(), now = Date.now(), iso = t => new Date(t).toISOString();
        let users = d.users; try { users = (JSON.parse(localStorage.getItem('gogogogo.demo.v2')) || d).users || d.users; } catch (e) { /* noop */ }
        return Object.values(o).filter(r => now - r.last_seen < 120000).sort((a, b) => a.started_at - b.started_at)
          .map(r => ({ client_id: r.client_id, user_id: r.user_id, nickname: r.user_id && users[r.user_id] ? users[r.user_id].nickname : '손님', game: r.game, mobile: r.mobile, started_at: iso(r.started_at), game_at: iso(r.game_at), last_seen: iso(r.last_seen), server_now: iso(now) }));
      },
      /* ---- v68 무단 이탈 기록 (관리자만 봄) ---- */
      async logQuit(r) {
        if (!Hub.user) return; const d = db(); d.quits = d.quits || [];
        d.quits.push(Object.assign(quitRow(r), { id: Date.now() + Math.random(), user_id: Hub.user.id, created_at: new Date().toISOString() }));
        if (d.quits.length > 500) d.quits = d.quits.slice(-500); persist();
      },
      async adminQuits(f) {
        if (!Hub.isAdmin()) throw new Error('관리자만 볼 수 있어요.');
        f = f || {}; const d = db();
        return (d.quits || []).filter(q => !f.game || q.game_id === f.game).slice().reverse().slice(0, f.limit || 500)
          .map(q => { const a = d.users[q.quitter] || {}, b = d.users[q.user_id] || {}; return Object.assign({}, q, { q_nick: a.nickname || q.quitter_nick || '손님', q_user: a.username || '', r_nick: b.nickname || '?', r_user: b.username || '' }); });
      },
      async adminDeleteQuit(id) { if (!Hub.isAdmin()) throw new Error('관리자만 할 수 있어요.'); const d = db(); d.quits = (d.quits || []).filter(q => q.id !== id); persist(); },
      /* ---- v33 로그인 팝업 배너 (한 개) ---- */
      /* ---- v75 시즌 1위 보상 (체험 모드: 이 브라우저 안에서 같은 규칙으로 계산) ---- */
      async seasonSettle() {
        if (!Hub.user) return 0;
        const d = db(); d.awards = d.awards || []; d.settled = d.settled || {};
        let n = 0;
        for (const s of Hub.seasonList()) {
          if (s.current || d.settled[s.key]) continue;
          const t0 = Date.parse(s.start), t1 = Date.parse(s.end), ok = r => { const t = Date.parse(r.played_at), u = d.users[r.user_id]; return t >= t0 && t < t1 && u && !u.banned && u.username !== DEMO_ADMIN && u.role !== 'admin'; };
          const recs = d.records.filter(ok), win = {};
          recs.filter(r => !Hub.SEASON_SKIP.includes(r.game_id) && r.game_id !== 'scfight' && r.score > 0).forEach(r => {
            const w = win[r.game_id]; if (!w || r.score > w.score || (r.score === w.score && r.played_at < w.at)) win[r.game_id] = { user_id: r.user_id, score: r.score, at: r.played_at };
          });
          const fw = {}; recs.filter(r => r.game_id === 'scfight' && r.result === 'win').sort((a, b) => (a.played_at < b.played_at ? -1 : 1)).forEach(r => { const x = fw[r.user_id] || (fw[r.user_id] = { n: 0, at: '' }); x.n++; x.at = r.played_at; });
          const fb = Object.keys(fw).sort((a, b) => fw[b].n - fw[a].n || (fw[a].at < fw[b].at ? -1 : 1))[0];
          if (fb) win.scfight = { user_id: fb, score: fw[fb].n };
          Object.keys(win).forEach(g => {
            const w = win[g], u = d.users[w.user_id];
            d.awards.push({ id: Date.now() + Math.random(), season: s.key, game_id: g, user_id: w.user_id, score: w.score, points: Hub.SEASON_POINTS, notified: false, created_at: new Date().toISOString() });
            u.points += Hub.SEASON_POINTS; u.earned = (u.earned || 0) + Hub.SEASON_POINTS; n++;
          });
          d.settled[s.key] = new Date().toISOString();
        }
        persist(); if (n) setUser(pub(d.users[Hub.user.id]));
        return n;
      },
      async seasonInbox() { if (!Hub.user) return []; return (db().awards || []).filter(a => a.user_id === Hub.user.id && !a.notified); },
      async seasonAck(ids) { const d = db(); (d.awards || []).forEach(a => { if (Hub.user && a.user_id === Hub.user.id && ids.includes(a.id)) a.notified = true; }); persist(); },
      async adminSeasonAwards(season) {
        if (!Hub.isAdmin()) throw new Error('관리자만 볼 수 있어요.');
        const d = db();
        return (d.awards || []).filter(a => a.season === season).map(a => { const u = d.users[a.user_id] || {}; return Object.assign({}, a, { nickname: u.nickname || '?', username: u.username || '' }); });
      },
      async seasonSettledAt(season) { return (db().settled || {})[season] || null; },
      /* ---- v33 ---- */
      async getBanner() { return db().banner || null; },
      async saveBanner(b) {
        if (!Hub.isAdmin()) throw new Error('관리자만 할 수 있어요.');
        const d = db(); d.banner = Object.assign(cleanBanner(b), { updated_at: new Date().toISOString() }); persist(); return d.banner;
      }
    };
    function withUser(d, x) { const u = d.users[x.user_id] || {}; return Object.assign({}, x, { nickname: u.nickname || '?', avatar: u.avatar, username: u.username }); }
  }

  /* ---------------- 온라인 모드 (Supabase) ---------------- */
  function Online() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    let seasonOff = false;   // v75 시즌 표가 없으면 다시 묻지 않음
    let lbAt = true;         // v76 leaderboard.best_at 있음
    Hub._sb = sb;
    const email = id => id + '@' + (cfg.idDomain || 'gogogogo.game');
    const PKEY = 'gogogogo.profile', QKEY = 'gogogogo.pending';
    const COLS = 'id,username,nickname,points,earned,avatar,owned', COLS2 = COLS + ',role,banned';
    let newCols = true;   // DB가 아직 옛 버전이면 role·banned 없이 읽음
    const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
    const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* noop */ } };
    const isNet = err => !navigator.onLine || /fetch|network|load failed|timeout/i.test((err && err.message) || '');
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const CCOLS = 'id,game_id,user_id,kind,body,rating,hidden,created_at,profiles(nickname,avatar,username)';
    const MCOLS = 'id,game_id,user_id,body,created_at,profiles(nickname,avatar,username)';
    const flat = x => { const p = x.profiles || {}; const o = Object.assign({}, x, { nickname: p.nickname || '?', avatar: p.avatar, username: p.username }); delete o.profiles; return o; };
    const row = rec => ({ game_id: rec.game_id, score: rec.score, duration_sec: rec.duration_sec, extra: rec.extra || {}, result: rec.result || null, points_delta: clampDelta(rec.points_delta) });
    const friendly = (err, fallback) => {
      const m = (err && err.message) || '';
      if (/column .* does not exist|function .* does not exist|schema cache|relation .* does not exist|Could not find/i.test(m)) return 'DB가 최신이 아니에요. Supabase SQL Editor에서 schema.sql을 다시 실행해 주세요.';
      if (/row-level security/i.test(m)) return '이용이 정지된 계정이거나 권한이 없어요.';
      if (/[가-힣]/.test(m) && !/[a-z]{6,}/i.test(m)) return m;     // 서버가 보낸 한글 안내 그대로
      return isNet(err) ? '인터넷 연결 후 다시 시도해 주세요.' : fallback + (m ? ': ' + m : '');
    };

    async function loadProfile(uid) {
      if (!uid) { lsSet(PKEY, null); return setUser(null); }
      let { data, error } = await sb.from('profiles').select(newCols ? COLS2 : COLS).eq('id', uid).single();
      if (error && newCols && /column/i.test(error.message || '')) { newCols = false; ({ data, error } = await sb.from('profiles').select(COLS).eq('id', uid).single()); }
      if (error) {
        const cached = lsGet(PKEY, null);
        if (isNet(error) && cached && cached.id === uid) return setUser(cached);   // 오프라인이면 마지막 프로필 유지
        console.error(error);
        if (/column/i.test(error.message || '')) Hub.lastError = friendly(error, '');
        return setUser(null);
      }
      lsSet(PKEY, data); setUser(data);
    }

    // 오프라인에서 끝낸 판은 기기에 모아 두었다가 연결되면 순서대로 저장
    let flushing = false;
    async function flush() {
      if (flushing || !Hub.user || !navigator.onLine) return;
      flushing = true;
      try {
        let q = lsGet(QKEY, []), sent = 0;
        while (q.length) {
          const item = q.find(x => x.user_id === Hub.user.id); if (!item) break;
          if (sent) await wait(3500); // 서버의 '3초 간격' 규칙
          const { error } = await sb.from('play_records').insert(row(item));
          if (error && isNet(error)) break;
          q = lsGet(QKEY, []).filter(x => x.qid !== item.qid); lsSet(QKEY, q); sent++;
        }
        if (sent) await loadProfile(Hub.user.id);
      } finally { flushing = false; }
    }
    window.addEventListener('online', () => flush());
    Hub.pendingCount = () => lsGet(QKEY, []).filter(x => Hub.user && x.user_id === Hub.user.id).length;

    return {
      async init() {
        const { data } = await sb.auth.getSession();
        Hub._token = data.session ? data.session.access_token : null;   // v35: 창을 닫을 때 보내는 요청에 씀
        await loadProfile(data.session && data.session.user.id);
        sb.auth.onAuthStateChange((ev, session) => {
          Hub._token = session ? session.access_token : null;
          if (ev === 'SIGNED_OUT') { lsSet(PKEY, null); setUser(null); }
          else if (ev === 'SIGNED_IN' && session && (!Hub.user || Hub.user.id !== session.user.id)) setTimeout(() => loadProfile(session.user.id), 0);
        });
        this.loadPrices().catch(() => {});
        flush();
      },
      async signUp(a) {
        const { username, password, nickname } = check({ ...a, signup: true });
        const { data: taken } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
        if (taken) throw new Error('이미 사용 중인 아이디예요.');
        const { data, error } = await sb.auth.signUp({ email: email(username), password, options: { data: { username, nickname } } });
        if (error) throw new Error(/registered|exists/i.test(error.message) ? '이미 사용 중인 아이디예요.' : '가입하지 못했어요: ' + error.message);
        if (!data.session) throw new Error('가입은 됐지만 로그인되지 않았어요. Supabase에서 이메일 확인(Confirm email)을 꺼 주세요.');
        await loadProfile(data.user.id);
        if (!Hub.user && Hub.lastError) throw new Error(Hub.lastError);
      },
      async signIn(a) {
        const { username, password } = check(a);
        const { data, error } = await sb.auth.signInWithPassword({ email: email(username), password });
        if (error) throw new Error(isNet(error) ? '인터넷에 연결되어 있지 않아요. 연결 후 다시 로그인해 주세요.' : '아이디 또는 비밀번호가 맞지 않아요.');
        await loadProfile(data.user.id);
        if (!Hub.user && Hub.lastError) throw new Error(Hub.lastError);
        flush();
      },
      async signOut() { await sb.auth.signOut(); lsSet(PKEY, null); setUser(null); },
      async submitScore(rec) {
        if (!Hub.user) throw new Error('로그인이 필요해요.');
        const prevBest = (await this.myBest(rec.game_id)) || 0, before = Hub.user.points, r = row(rec);
        const { error } = await sb.from('play_records').insert(r);
        if (error && isNet(error)) {
          const q = lsGet(QKEY, []);
          q.push({ qid: Date.now() + '-' + Math.random().toString(36).slice(2, 7), user_id: Hub.user.id, ...r });
          lsSet(QKEY, q.slice(-200));
          return { queued: true, delta: r.points_delta, gained: Math.max(-before, r.points_delta), best: Math.max(prevBest, rec.score), newBest: false };
        }
        if (error) throw new Error(friendly(error, '기록을 저장하지 못했어요'));
        await loadProfile(Hub.user.id);
        return { delta: r.points_delta, gained: Hub.user ? Hub.user.points - before : 0, best: Math.max(prevBest, rec.score), newBest: rec.score > prevBest };
      },
      async resetStats(game) {
        if (!Hub.user) throw new Error('로그인이 필요해요.');
        const { data, error } = await sb.from('play_records').delete().eq('user_id', Hub.user.id).eq('game_id', game).select('id');
        if (error) throw new Error(friendly(error, '초기화하지 못했어요'));
        lsSet(QKEY, lsGet(QKEY, []).filter(x => !(x.user_id === Hub.user.id && x.game_id === game)));
        return (data || []).length;
      },
      async myBest(game) {
        if (!Hub.user) return null;
        const { data } = await sb.from('play_records').select('score').eq('user_id', Hub.user.id).eq('game_id', game).order('score', { ascending: false }).limit(1);
        return (data && data[0] && data[0].score) || 0;
      },
      async myStats() {
        if (!Hub.user) return null;
        const { data, error } = await sb.from('play_records').select('game_id,score,result,duration_sec,played_at').eq('user_id', Hub.user.id).order('played_at', { ascending: false }).limit(1000);
        if (error) throw error;
        return summarize(data);
      },
      async leaderboard(game, limit) {
        // v76: 같은 점수면 그 점수를 먼저 낸 사람이 위 (best_at, supabase/rank_v76.sql). 아직 SQL 전이면 예전 정렬
        if (lbAt) {
          const r = await sb.from('leaderboard').select('user_id,nickname,best_score,plays,avatar,best_at').eq('game_id', game).order('best_score', { ascending: false }).order('best_at', { ascending: true }).limit(limit || 10);
          if (!r.error) return r.data;
          if (!/best_at|column/i.test(r.error.message || '')) throw r.error;
          lbAt = false;
        }
        const { data, error } = await sb.from('leaderboard').select('user_id,nickname,best_score,plays,avatar').eq('game_id', game).order('best_score', { ascending: false }).limit(limit || 10);
        if (error) throw error;
        return data;
      },
      // v75: 이번 시즌(since 이후) 기록 — 점수 1등 한 줄, wins 면 승리 기록 전부(최대 5000)
      async seasonRows(game, since, wins) {
        let q = sb.from('play_records').select('user_id,score,played_at').eq('game_id', game).gte('played_at', since);
        q = wins ? q.eq('result', 'win').order('played_at', { ascending: true }).limit(5000) : q.order('score', { ascending: false }).order('played_at', { ascending: true }).limit(1);   // v76 같은 점수면 먼저 낸 사람
        const { data, error } = await q;
        if (error) throw error;
        const rows = data || [], ids = [...new Set(rows.map(r => r.user_id))];
        if (!ids.length) return [];
        const names = {};
        if (!wins) {
          const { data: ps } = await sb.from('profiles').select('id,nickname').in('id', ids);
          (ps || []).forEach(p => { names[p.id] = p.nickname; });
        }
        return rows.map(r => ({ user_id: r.user_id, score: r.score, played_at: r.played_at, nickname: names[r.user_id] || '?' }));
      },
      async nicknames(ids) {
        if (!ids.length) return {};
        const { data } = await sb.from('profiles').select('id,nickname').in('id', ids);
        const o = {}; (data || []).forEach(p => { o[p.id] = p.nickname; }); return o;
      },
      async pointRanking(limit) {
        const { data, error } = await sb.from('profiles').select('id,nickname,earned,avatar').order('earned', { ascending: false }).limit(limit || 10);
        if (error) throw error;
        return data.map(d => ({ user_id: d.id, nickname: d.nickname, earned: d.earned, avatar: d.avatar }));
      },
      async loadPrices() {
        const { data, error } = await sb.from('shop_items').select('id,price');
        if (error) throw error;
        serverPrices = {}; (data || []).forEach(r => { serverPrices[r.id] = r.price; });
        return serverPrices;
      },
      async buyItem(id) {
        if (!Hub.user) throw new Error('로그인이 필요해요.');
        const { error } = await sb.rpc('buy_item', { p_item: id });
        if (error) throw new Error(friendly(error, '구입하지 못했어요'));
        await loadProfile(Hub.user.id);
      },
      async setAvatar(av) {
        if (!Hub.user) throw new Error('로그인이 필요해요.');
        av = validateAvatar(av);
        const send = Object.assign({}, av); if (send.bg == null) delete send.bg;   // 배경이 없으면 보내지 않음 (DB가 옛 버전이어도 착용 가능)
        const { error } = await sb.rpc('set_avatar', { p_avatar: send });
        if (error) throw new Error(friendly(error, '착용하지 못했어요'));
        await loadProfile(Hub.user.id);
      },
      /* ---- 옷장: 코디 3칸 (profiles.outfits) ---- */
      async getOutfits() {
        if (!Hub.user) throw new Error('로그인이 필요해요.');
        const { data, error } = await sb.from('profiles').select('outfits').eq('id', Hub.user.id).single();
        if (error) throw new Error(friendly(error, '코디를 불러오지 못했어요'));
        return normOutfits(data && data.outfits);
      },
      async saveOutfits(list) {
        if (!Hub.user) throw new Error('로그인이 필요해요.');
        const out = normOutfits(list);
        const { error } = await sb.rpc('save_outfits', { p_outfits: out });
        if (error) throw new Error(friendly(error, '코디를 저장하지 못했어요'));
        return out;
      },
      /* ---- 댓글 · 피드백 ---- */
      async listComments(game) {
        const { data, error } = await sb.from('comments').select(CCOLS).eq('game_id', game).order('created_at', { ascending: false }).limit(50);
        if (error) throw new Error(friendly(error, '댓글을 불러오지 못했어요'));
        return data.map(flat);
      },
      async addComment(c) {
        if (!Hub.user) throw new Error('로그인이 필요해요.');
        const row = { game_id: c.game_id, kind: c.kind === 'feedback' ? 'feedback' : 'comment', body: cleanText(c.body, COMMENT_MAX), rating: c.kind === 'feedback' && c.rating ? Math.max(1, Math.min(5, c.rating | 0)) : null };
        const { data, error } = await sb.from('comments').insert(row).select(CCOLS).single();
        if (error) throw new Error(friendly(error, '댓글을 올리지 못했어요'));
        return flat(data);
      },
      async deleteComment(id) {
        const { error } = await sb.from('comments').delete().eq('id', id);
        if (error) throw new Error(friendly(error, '지우지 못했어요'));
      },
      async setCommentHidden(id, hidden) {
        const { error } = await sb.from('comments').update({ hidden: !!hidden }).eq('id', id);
        if (error) throw new Error(friendly(error, '바꾸지 못했어요'));
      },
      // v32: 관리자 '반영여부' 체크. 서버에 resolved 열이 없으면(supabase/feedback_v32.sql 실행 전) 안내
      async setResolved(kind, id, v) {
        const { error } = await sb.from(kind === 'chat' ? 'chat_messages' : 'comments').update({ resolved: !!v }).eq('id', id);
        if (error) throw new Error(/resolved/.test(error.message || '') ? '반영여부 칸이 아직 없어요. supabase/feedback_v32.sql 을 먼저 실행해 주세요.' : friendly(error, '바꾸지 못했어요'));
      },
      async adminComments(f) {
        f = f || {};
        const run = cols => { let q = sb.from('comments').select(cols).order('created_at', { ascending: false }).limit(f.limit || 300); if (f.game) q = q.eq('game_id', f.game); if (f.kind) q = q.eq('kind', f.kind); return q; };
        let { data, error } = await run(CCOLS + ',resolved');   // v32 반영여부 (열이 없으면 예전처럼)
        Hub.noResolved = !!error;
        if (error) ({ data, error } = await run(CCOLS));
        if (error) throw new Error(friendly(error, '댓글을 불러오지 못했어요'));
        return data.map(flat);
      },
      /* ---- 채팅 ---- */
      async chatHistory(game, limit) {
        const { data, error } = await sb.from('chat_messages').select(MCOLS).eq('game_id', game).order('created_at', { ascending: false }).limit(limit || 40);
        if (error) throw new Error(friendly(error, '채팅을 불러오지 못했어요'));
        return data.map(flat).reverse();
      },
      async chatSend(game, body) {
        if (!Hub.user) throw new Error('로그인이 필요해요.');
        const { data, error } = await sb.from('chat_messages').insert({ game_id: game, body: cleanText(body, CHAT_MAX) }).select(MCOLS).single();
        if (error) throw new Error(friendly(error, '보내지 못했어요'));
        return flat(data);
      },
      async adminChat(f) {
        f = f || {};
        const run = cols => { let q = sb.from('chat_messages').select(cols).order('created_at', { ascending: false }).limit(f.limit || 300); if (f.game) q = q.eq('game_id', f.game); return q; };
        let { data, error } = await run(MCOLS + ',resolved');   // v32 반영여부 (열이 없으면 예전처럼)
        Hub.noResolved = !!error;
        if (error) ({ data, error } = await run(MCOLS));
        if (error) throw new Error(friendly(error, '채팅을 불러오지 못했어요'));
        return data.map(flat);
      },
      async adminDeleteChat(id) {
        const { error } = await sb.from('chat_messages').delete().eq('id', id);
        if (error) throw new Error(friendly(error, '지우지 못했어요'));
      },
      /* ---- 관리자 ---- */
      async adminMembers() {
        const { data, error } = await sb.rpc('admin_members');
        if (error) throw new Error(friendly(error, '회원 목록을 불러오지 못했어요'));
        return data;
      },
      async adminMember(uid, action, value) {
        const { error } = await sb.rpc('admin_update_member', { p_uid: uid, p_action: action, p_value: value == null ? null : String(value) });
        if (error) throw new Error(friendly(error, '바꾸지 못했어요'));
        if (Hub.user && uid === Hub.user.id) await loadProfile(uid);
      },
      // 한 게임의 모든 판 (1000개씩 나눠 받음, 최대 2만 판)
      async adminGameRecords(game) {
        const out = [];
        for (let from = 0; from < 20000; from += 1000) {
          const { data, error } = await sb.from('play_records').select('user_id,result,score,duration_sec,extra,played_at,profiles(nickname,username,avatar)').eq('game_id', game).order('id').range(from, from + 999);
          if (error) throw new Error(friendly(error, '기록을 불러오지 못했어요'));
          out.push(...data.map(flat)); if (data.length < 1000) break;
        }
        return out;
      },
      async adminOverview() {
        const { data, error } = await sb.rpc('admin_overview');
        if (error) throw new Error(friendly(error, '집계를 불러오지 못했어요'));
        return data;
      },
      /* ---- v35 실시간 접속자: 1분마다 기록 (supabase/online_v35.sql 의 online_ping · online_leave · admin_online) ---- */
      async onlinePing(c, game, mobile) {
        const { error } = await sb.rpc('online_ping', { p_client: c, p_game: game || '', p_mobile: !!mobile });
        if (error && /online_ping|function|schema cache/i.test(error.message || '')) Hub.noOnline = true;   // SQL 실행 전
      },
      // 창을 닫을 때: 페이지가 사라져도 끝까지 보내지도록 keepalive (실패해도 2분 뒤 목록에서 빠짐)
      onlineLeave(c) {
        try {
          fetch(cfg.supabaseUrl + '/rest/v1/rpc/online_leave', { method: 'POST', keepalive: true,
            headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + (Hub._token || cfg.supabaseAnonKey), 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_client: c }) }).catch(() => {});
        } catch (e) { /* noop */ }
      },
      async adminOnline() {
        const { data, error } = await sb.rpc('admin_online');
        if (error) throw new Error(/admin_online|function|schema cache/i.test(error.message || '') ? '실시간 접속자 기능이 아직 서버에 없어요. supabase/online_v35.sql 을 먼저 실행해 주세요.' : friendly(error, '접속자를 불러오지 못했어요'));
        return data || [];
      },
      /* ---- v68 무단 이탈 기록 (supabase/quit_v68.sql 의 quit_logs 표 · 학생은 못 읽고 관리자만 봄) ---- */
      async logQuit(r) {
        if (!Hub.user || quitOff) return;
        const row = quitRow(r); if (row.quitter && !/^[0-9a-f-]{36}$/i.test(row.quitter)) row.quitter = null;
        try {
          const { error } = await sb.from('quit_logs').insert(row);
          if (error) { if (/quit_logs|relation|schema cache|does not exist/i.test(error.message || '')) quitOff = true; console.warn('[gogo] 이탈 기록 안 됨', error.message); }
        } catch (e) { /* noop */ }
      },
      async adminQuits(f) {
        f = f || {};
        let q = sb.from('quit_logs').select('id,game_id,user_id,quitter,quitter_nick,kind,sec,extra,created_at').order('created_at', { ascending: false }).limit(f.limit || 500);
        if (f.game) q = q.eq('game_id', f.game);
        const { data, error } = await q;
        if (error) throw new Error(/quit_logs|relation|schema cache/i.test(error.message || '') ? '무단 이탈 표가 아직 없어요. supabase/quit_v68.sql 을 먼저 실행해 주세요.' : friendly(error, '이탈 기록을 불러오지 못했어요'));
        const ids = Array.from(new Set(data.flatMap(x => [x.user_id, x.quitter]).filter(Boolean))), who = {};
        if (ids.length) { const r = await sb.from('profiles').select('id,nickname,username').in('id', ids.slice(0, 300)); (r.data || []).forEach(p => { who[p.id] = p; }); }
        return data.map(x => { const a = who[x.quitter] || {}, b = who[x.user_id] || {}; return Object.assign({}, x, { q_nick: a.nickname || x.quitter_nick || '손님', q_user: a.username || '', r_nick: b.nickname || '?', r_user: b.username || '' }); });
      },
      async adminDeleteQuit(id) {
        const { error } = await sb.from('quit_logs').delete().eq('id', id);
        if (error) throw new Error(friendly(error, '지우지 못했어요'));
      },
      /* ---- v75 시즌 1위 보상 (supabase/season_v75.sql: season_awards · season_settled 표, season_settle()·season_ack() 함수) ---- */
      async seasonSettle() {
        if (!Hub.user || seasonOff) return 0;
        const { data, error } = await sb.rpc('season_settle');
        if (error) { if (/season_|function|schema cache|does not exist/i.test(error.message || '')) seasonOff = true; console.warn('[gogo] 시즌 정산 안 됨', error.message); return 0; }
        if (data > 0 && Hub.user) await loadProfile(Hub.user.id);   // 포인트가 바뀌었을 수 있음
        return data || 0;
      },
      async seasonInbox() {
        if (!Hub.user || seasonOff) return [];
        const { data, error } = await sb.from('season_awards').select('id,season,game_id,score,points').eq('user_id', Hub.user.id).eq('notified', false).order('id');
        if (error) return [];
        if ((data || []).length) await loadProfile(Hub.user.id);
        return data || [];
      },
      async seasonAck(ids) { if (ids.length) await sb.rpc('season_ack', { p_ids: ids }); },
      async adminSeasonAwards(season) {
        const { data, error } = await sb.from('season_awards').select('id,season,game_id,user_id,score,points,notified,created_at').eq('season', season);
        if (error) throw new Error(/season_awards|relation|schema cache/i.test(error.message || '') ? '시즌 표가 아직 없어요. supabase/season_v75.sql 을 먼저 실행해 주세요.' : friendly(error, '시즌 기록을 불러오지 못했어요'));
        const ids = [...new Set(data.map(x => x.user_id))], who = {};
        if (ids.length) { const r = await sb.from('profiles').select('id,nickname,username').in('id', ids); (r.data || []).forEach(p => { who[p.id] = p; }); }
        return data.map(x => Object.assign({}, x, { nickname: (who[x.user_id] || {}).nickname || '?', username: (who[x.user_id] || {}).username || '' }));
      },
      async seasonSettledAt(season) {
        const { data } = await sb.from('season_settled').select('settled_at').eq('season', season).maybeSingle();
        return data ? data.settled_at : null;
      },
      /* ---- v33 로그인 팝업 배너 (한 개, site_banner 표의 id = 1 줄) ---- */
      async getBanner() {
        const { data, error } = await sb.from('site_banner').select('enabled,title,body,image,link,updated_at').eq('id', 1).maybeSingle();
        if (error) { if (/site_banner|relation|schema cache/i.test(error.message || '')) return null; throw new Error(friendly(error, '배너를 불러오지 못했어요')); }
        return data;
      },
      async saveBanner(b) {
        const row = Object.assign({ id: 1 }, cleanBanner(b), { updated_at: new Date().toISOString() });
        const { data, error } = await sb.from('site_banner').upsert(row).select('enabled,title,body,image,link,updated_at').single();
        if (error) throw new Error(/site_banner|relation|schema cache/i.test(error.message || '') ? '배너 표가 아직 없어요. supabase/banner_v33.sql 을 먼저 실행해 주세요.' : friendly(error, '배너를 저장하지 못했어요'));
        return data;
      }
    };
  }

  /* ---------------- 실시간 채널 (대전용) ----------------
   * Hub.channel(name, { onMsg(payload), onPeers(list) }) → { send(payload), track(state), leave() }
   *  - 온라인: Supabase Realtime (broadcast + presence) → 다른 기기와 대전
   *  - 체험 : BroadcastChannel → 같은 브라우저의 다른 탭과 대전 (테스트용)
   */
  Hub.clientId = 'c' + Math.random().toString(36).slice(2, 10);

  // v68 실시간 방에 들어갈 때 회원 id(uid)를 함께 알림 → 상대가 무단 이탈하면 누구인지 기록할 수 있음
  const withUid = st => (st && typeof st === 'object' && !Array.isArray(st) && !('uid' in st) ? Object.assign({ uid: Hub.user ? Hub.user.id : null }, st) : st);
  function localChannel(name, h) {
    const me = Hub.clientId, peers = new Map();
    let mine = null, closed = false, bc = null;
    try { bc = new BroadcastChannel('gogo-' + name); } catch (e) { bc = null; }
    const list = () => { const a = Array.from(peers.values()).map(p => p.state); if (mine) a.push(mine); return a; };
    const emit = () => h.onPeers && h.onPeers(list());
    const post = m => { if (bc && !closed) try { bc.postMessage(m); } catch (e) { /* noop */ } };
    if (bc) bc.onmessage = ev => {
      const d = ev.data || {};
      if (d.k === 'p') {
        const known = peers.has(d.from);
        if (d.state) peers.set(d.from, { state: d.state, seen: Date.now() }); else peers.delete(d.from);
        if (!known && d.state && mine) post({ k: 'p', from: me, state: mine });
        emit();
      } else if (d.k === 'm') h.onMsg && h.onMsg(d.payload);
    };
    const hb = setInterval(() => {
      if (mine) post({ k: 'p', from: me, state: mine });
      const now = Date.now(); let changed = false;
      peers.forEach((p, id) => { if (now - p.seen > 3500) { peers.delete(id); changed = true; } });
      if (changed) emit();
    }, 1000);
    return {
      send(payload) { post({ k: 'm', payload }); },
      track(state) { state = withUid(state); mine = state; post({ k: 'p', from: me, state }); emit(); },
      untrack() { if (!mine) return; mine = null; post({ k: 'p', from: me, state: null }); emit(); },
      leave() { if (closed) return; post({ k: 'p', from: me, state: null }); closed = true; clearInterval(hb); if (bc) bc.close(); }
    };
  }

  function supaChannel(sb, name, h) {
    const ch = sb.channel('gogo-' + name, { config: { broadcast: { self: false }, presence: { key: Hub.clientId } } });
    let ready = false, pending = null;
    ch.on('broadcast', { event: 'm' }, ({ payload }) => h.onMsg && h.onMsg(payload));
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState();
      h.onPeers && h.onPeers(Object.values(st).map(a => a[a.length - 1]).filter(Boolean));
    });
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') { ready = true; if (pending) ch.track(pending); }
      else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && h.onError) h.onError(status);
    });
    return {
      send(payload) { if (ready) ch.send({ type: 'broadcast', event: 'm', payload }); },
      track(state) { state = withUid(state); pending = state; if (ready) ch.track(state); },
      untrack() { pending = null; if (ready) ch.untrack(); },
      leave() { sb.removeChannel(ch); }
    };
  }

  /* 게임 채팅방: Hub.chatRoom(gameId, { onMsg(row), onPeers(list) }) → { leave() }
   *  - 메시지는 DB에 저장한 뒤, 같은 방 사람들에게 바로 전달 (Realtime broadcast) */
  Hub.chatRoom = function (game, h) {
    const ch = Hub.channel('chat-' + game, { onMsg: p => p && p.k === 'chat' && h.onMsg && h.onMsg(p.row), onPeers: list => h.onPeers && h.onPeers(list) });
    const me = () => (Hub.user ? { id: Hub.clientId, nick: Hub.user.nickname } : { id: Hub.clientId, nick: '손님' });
    ch.track(me());
    const off = Hub.onChange(() => ch.track(me()));
    return {
      async send(body) { const row = await Hub.chatSend(game, body); ch.send({ k: 'chat', row }); return row; },
      leave() { off(); ch.leave(); }
    };
  };

  const online = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  Hub.mode = online ? 'online' : 'demo';
  Object.assign(Hub, online ? Online() : Demo());
  // v58: 게임 랭킹을 다른 기록 이름으로 보여 줄 때 (settings.js 의 rankId). 예: 블록 대전 랭킹 = 랭킹 대전 점수('battle-rank')
  // v75: 시즌 = 매월 1일 0시(한국 시간)에 새로 시작
  Hub.season = function (now) {
    const k = new Date((now || Date.now()) + 9 * 36e5), y = k.getUTCFullYear(), m = k.getUTCMonth();
    return { key: y + '-' + String(m + 1).padStart(2, '0'), start: new Date(Date.UTC(y, m, 1) - 9 * 36e5).toISOString(), end: new Date(Date.UTC(y, m + 1, 1) - 9 * 36e5).toISOString(), month: m + 1, year: y, label: (m + 1) + '월 시즌' };
  };
  // v75 시즌 보상: 첫 시즌 2026-11 · 1위 +50P · 빼는 게임(RPG·Ultimate 는 선생님이 따로, 나머지는 랭킹에 안 쓰는 옛 기록) — supabase/season_v75.sql 과 같게
  Hub.SEASON_FIRST = '2026-11'; Hub.SEASON_POINTS = 50;
  Hub.SEASON_SKIP = ['rpg', 'ultimate', 'battle', 'blocks', '2048', 'p1024'];
  Hub.seasonList = function (now) {   // 첫 시즌 ~ 지금 시즌 (지금 것이 맨 뒤, current: true)
    const cur = Hub.season(now), out = [];
    let [y, m] = Hub.SEASON_FIRST.split('-').map(Number);
    for (let i = 0; i < 240; i++) {
      const s = Hub.season(Date.UTC(y, m - 1, 15)); s.current = s.key === cur.key; out.push(s);
      if (s.current || s.key > cur.key) break;
      if (++m > 12) { m = 1; y++; }
    }
    return out;
  };
  // v75: 이번 시즌 1위 { nickname, score } 또는 null. settings 의 seasonWins 면 시즌 승리 수(누적 점수 게임: Skillcom Fight)
  Hub.seasonTop = async function (game) {
    const s = window.GoSettings && window.GoSettings.get(game), id = (s && s.rankId) || game, wins = !!(s && s.seasonWins);
    const rows = await this.seasonRows(id, this.season().start, wins);
    if (!wins) { const r = rows[0]; return r && r.score > 0 ? { nickname: r.nickname, score: r.score, user_id: r.user_id } : null; }
    // 승리 수가 같으면 그 수에 먼저 닿은 사람 (마지막 승리 시각이 빠른 사람)
    const cnt = {}, last = {};
    rows.slice().sort((a, b) => (a.played_at < b.played_at ? -1 : 1)).forEach(r => { cnt[r.user_id] = (cnt[r.user_id] || 0) + 1; last[r.user_id] = r.played_at; });
    const best = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || (last[a] < last[b] ? -1 : 1))[0];
    if (!best) return null;
    let nick = (rows.find(r => r.user_id === best) || {}).nickname;
    if ((!nick || nick === '?') && this.nicknames) nick = (await this.nicknames([best]))[best];
    return { nickname: nick || '?', score: cnt[best], user_id: best };
  };
  ['leaderboard', 'myBest'].forEach(k => {
    const f = Hub[k];
    Hub[k] = function (game, ...rest) { const s = window.GoSettings && window.GoSettings.get(game); return f.call(this, (s && s.rankId) || game, ...rest); };
  });
  Hub.channel = online ? (n, h) => supaChannel(Hub._sb, n, h) : localChannel;
  window.GameHub = Hub;
})();
