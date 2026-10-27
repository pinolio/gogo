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
    if (u) { u.avatar = AV.normalize(u.avatar); u.owned = u.owned || []; u.points = u.points || 0; u.earned = u.earned || 0; }
    Hub.user = u;
    subs.forEach(fn => { try { fn(u); } catch (e) { console.error(e); } });
  }
  const clampDelta = d => Math.max(-MAX_DELTA, Math.min(MAX_DELTA, Math.round(d || 0)));

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
    }
    return { username, password, nickname };
  }
  function validateAvatar(av) {
    av = AV.normalize(av);
    for (const [slot] of AV.SLOTS) {
      const id = av[slot];
      if (id && !Hub.owns(id)) throw new Error(AV.byId[id].name + '은(는) 아직 구입하지 않았어요.');
    }
    return av;
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
    const pub = u => ({ id: u.id, username: u.username, nickname: u.nickname, points: u.points, earned: u.earned || 0, avatar: u.avatar, owned: (u.owned || []).slice() });
    const me = () => { const u = Hub.user && db().users[Hub.user.id]; if (!u) throw new Error('로그인이 필요해요.'); return u; };

    return {
      async init() { const id = read(SKEY); const u = id && db().users[id]; setUser(u ? pub(u) : null); },
      async signUp(a) {
        const { username, password, nickname } = check({ ...a, signup: true });
        const d = db();
        if (Object.values(d.users).some(u => u.username === username)) throw new Error('이미 사용 중인 아이디예요.');
        const id = 'u' + Date.now().toString(36);
        d.users[id] = { id, username, nickname, pw: await hash(password), points: 0, earned: 0, avatar: AV.normalize({}), owned: [] };
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
          const x = best[r.user_id] || (best[r.user_id] = { user_id: r.user_id, best_score: 0, plays: 0 });
          x.best_score = Math.max(x.best_score, r.score); x.plays++;
        });
        return Object.values(best)
          .map(x => { const u = d.users[x.user_id] || {}; return { ...x, nickname: u.nickname || '?', avatar: u.avatar, sample: !!u.sample }; })
          .sort((a, b) => b.best_score - a.best_score).slice(0, limit || 10);
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
      }
    };
  }

  /* ---------------- 온라인 모드 (Supabase) ---------------- */
  function Online() {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    Hub._sb = sb;
    const email = id => id + '@' + (cfg.idDomain || 'gogogogo.game');
    const PKEY = 'gogogogo.profile', QKEY = 'gogogogo.pending';
    const COLS = 'id,username,nickname,points,earned,avatar,owned';
    const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
    const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* noop */ } };
    const isNet = err => !navigator.onLine || /fetch|network|load failed|timeout/i.test((err && err.message) || '');
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const row = rec => ({ game_id: rec.game_id, score: rec.score, duration_sec: rec.duration_sec, extra: rec.extra || {}, result: rec.result || null, points_delta: clampDelta(rec.points_delta) });
    const friendly = (err, fallback) => {
      const m = (err && err.message) || '';
      if (/column .* does not exist|function .* does not exist|schema cache/i.test(m)) return 'DB가 최신이 아니에요. Supabase SQL Editor에서 schema.sql을 다시 실행해 주세요.';
      return isNet(err) ? '인터넷 연결 후 다시 시도해 주세요.' : fallback + (m ? ': ' + m : '');
    };

    async function loadProfile(uid) {
      if (!uid) { lsSet(PKEY, null); return setUser(null); }
      const { data, error } = await sb.from('profiles').select(COLS).eq('id', uid).single();
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
        await loadProfile(data.session && data.session.user.id);
        sb.auth.onAuthStateChange((ev, session) => {
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
        const { data, error } = await sb.from('leaderboard').select('user_id,nickname,best_score,plays,avatar').eq('game_id', game).order('best_score', { ascending: false }).limit(limit || 10);
        if (error) throw error;
        return data;
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
        const { error } = await sb.rpc('set_avatar', { p_avatar: av });
        if (error) throw new Error(friendly(error, '착용하지 못했어요'));
        await loadProfile(Hub.user.id);
      }
    };
  }

  /* ---------------- 실시간 채널 (대전용) ----------------
   * Hub.channel(name, { onMsg(payload), onPeers(list) }) → { send(payload), track(state), leave() }
   *  - 온라인: Supabase Realtime (broadcast + presence) → 다른 기기와 대전
   *  - 체험 : BroadcastChannel → 같은 브라우저의 다른 탭과 대전 (테스트용)
   */
  Hub.clientId = 'c' + Math.random().toString(36).slice(2, 10);

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
      track(state) { mine = state; post({ k: 'p', from: me, state }); emit(); },
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
      track(state) { pending = state; if (ready) ch.track(state); },
      untrack() { pending = null; if (ready) ch.untrack(); },
      leave() { sb.removeChannel(ch); }
    };
  }

  const online = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  Hub.mode = online ? 'online' : 'demo';
  Object.assign(Hub, online ? Online() : Demo());
  Hub.channel = online ? (n, h) => supaChannel(Hub._sb, n, h) : localChannel;
  window.GameHub = Hub;
})();
