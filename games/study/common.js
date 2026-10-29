/*
 * gogo?gogo! — '공부?' 게임 공통 도구 (GoStudy)
 *  - 한글: 글자 나누기, 두음법칙(끝말잇기에서 '력'→'역' 처럼 이어 쓰기)
 *  - 사전: games/study/wordchain/words.txt (전체 낱말) · common.txt (자주 쓰는 낱말) — 처음 필요할 때 한 번만 불러옴
 *  - 혼자 도전 화면: 왼쪽 게임판, 바로 오른쪽 랭킹 (타자연습·사자성어). Ultimate mode 와 같은 모양
 *  - 글씨: 한글이 잘 보이는 Galmuri11 / Pretendard
 */
(function () {
  'use strict';
  const Hub = window.GameHub, AV = window.GoAvatar;
  const $ = (s, r) => (r || document).querySelector(s);

  /* ---------- 한글 ---------- */
  const BASE = 0xAC00;
  const isSyl = ch => { const c = ch.charCodeAt(0); return c >= BASE && c <= 0xD7A3; };
  const split = ch => { const c = ch.charCodeAt(0) - BASE; return [Math.floor(c / 588), Math.floor((c % 588) / 28), c % 28]; };
  const join = (cho, jung, jong) => String.fromCharCode(BASE + cho * 588 + jung * 28 + jong);
  // 두음법칙: 첫소리 ㄹ → ㄴ(ㅏㅐㅗㅚㅜㅡ 앞) 또는 ㅇ(ㅑㅕㅖㅛㅠㅣ 앞), ㄴ → ㅇ(ㅕㅖㅛㅠㅣ 앞)
  function dueum(ch) {
    if (!ch || !isSyl(ch)) return null;
    const [cho, jung, jong] = split(ch);
    if (cho === 5) {
      if ([2, 6, 7, 12, 17, 20].includes(jung)) return join(11, jung, jong);
      if ([0, 1, 8, 11, 13, 18].includes(jung)) return join(2, jung, jong);
    }
    if (cho === 2 && [6, 7, 12, 17, 20].includes(jung)) return join(11, jung, jong);
    return null;
  }
  // 이 글자로 끝난 낱말 다음에 올 수 있는 첫 글자들
  const starts = last => { const d = dueum(last); return d ? [last, d] : [last]; };

  /* ---------- 사전 ---------- */
  let dictP = null;
  function dict() {
    if (dictP) return dictP;
    const get = f => fetch('games/study/wordchain/' + f).then(r => { if (!r.ok) throw new Error('사전 파일을 불러오지 못했어요'); return r.text(); });
    dictP = Promise.all([get('words.txt'), get('common.txt')]).then(([a, c]) => {
      const all = new Set(a.split('\n').map(s => s.trim()).filter(Boolean));
      const common = c.split('\n').map(s => s.trim()).filter(Boolean);
      const byFirst = {};   // 첫 글자 → 자주 쓰는 낱말 목록 (컴퓨터가 고를 때)
      common.forEach(w => { (byFirst[w[0]] || (byFirst[w[0]] = [])).push(w); });
      const firstAll = {};  // 첫 글자 → 전체 낱말 수 (막다른 글자 판단)
      all.forEach(w => { firstAll[w[0]] = (firstAll[w[0]] || 0) + 1; });
      return { all, common, byFirst, firstAll, size: all.size };
    }).catch(e => { dictP = null; throw e; });
    return dictP;
  }

  /* ---------- 캔버스 글씨 (한글) ---------- */
  function text(ctx, str, x, y, size, color, align, weight, base) {
    ctx.font = `${weight || 700} ${size}px Galmuri11, Pretendard, "Malgun Gothic", sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = base || 'middle';
    ctx.fillText(String(str), x, y);
  }
  function round(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }

  /* ---------- 혼자 도전 화면 (게임판 + 바로 옆 랭킹) ----------
   * opt: { id, title, tag, sub, w, h, rules: [문장…], cab: 'cab-blue' 등 }
   * 돌려줌: { canvas, ov(안내 칸), stage, loadRank(), save(rec) } */
  function soloPage(el, A, opt) {
    el.innerHTML = `
      <div class="ult study-page">
        <div class="play-head"><a class="back" href="#home">← 게임 목록</a><span class="cat ult-tag study-tag">${opt.tag || '공부?'}</span><h1>${opt.title}</h1><span class="small" style="margin:0">${opt.sub || ''}</span></div>
        <div class="ult-grid">
          <div class="ult-stage">
            <div class="cabinet ${opt.cab || 'cab-study'}" style="--cw:${opt.w}px;--ar:${opt.w / opt.h}"><div class="screen"><canvas id="stCanvas" aria-label="${opt.title} 게임 화면"></canvas><div class="overlay" id="stOv"></div></div></div>
            <div class="study-under" id="stUnder"></div>
          </div>
          <aside class="ult-side">
            <div class="panel ult-rank-panel">
              <h3>${opt.title} 랭킹 <small>최고 점수</small></h3>
              <ol class="rank" id="stRank"><li class="empty">불러오는 중…</li></ol>
              <p class="small ult-mine" id="stMine"></p>
            </div>
            <div class="panel"><h3>규칙</h3><ul class="ult-rules">${opt.rules.map(r => `<li>${r}</li>`).join('')}</ul></div>
          </aside>
        </div>
      </div>`;
    const page = {
      canvas: $('#stCanvas', el), ov: $('#stOv', el), under: $('#stUnder', el),
      async loadRank() {
        const rk = $('#stRank', el), mine = $('#stMine', el); if (!rk) return;
        try {
          const rows = await Hub.leaderboard(opt.id, 10);
          if (!rk.isConnected) return;
          rk.innerHTML = A.rankItems(rows, 'best_score'); AV.paintAll(rk);
          if (Hub.user) {
            const best = await Hub.myBest(opt.id), all = await Hub.leaderboard(opt.id, 500), pos = all.findIndex(r => r.user_id === Hub.user.id);
            if (mine.isConnected) mine.innerHTML = best ? `내 최고 <b class="num">${A.fmt(best)}</b>${pos >= 0 ? ` · ${pos + 1}위` : ''}` : '아직 내 기록이 없어요. 도전해 보세요!';
          } else if (mine.isConnected) mine.textContent = '로그인하면 내 기록이 랭킹에 올라가요.';
        } catch (e) { rk.innerHTML = '<li class="empty">랭킹을 불러오지 못했어요.</li>'; }
      },
      // 기록 저장 → { status, best, newBest, msg }
      async save(rec) {
        if (!Hub.user) return { status: 'guest' };
        try {
          const r = await Hub.submitScore(Object.assign({ game_id: opt.id, result: null, points_delta: 0 }, rec));
          page.loadRank();
          return { status: r.queued ? 'queued' : 'saved', best: r.best, newBest: r.newBest };
        } catch (e) { return { status: 'error', msg: e.message }; }
      },
      // 결과 아래 문구 + (손님) 로그인 버튼
      noteHTML(s) {
        if (!s) return '';
        if (s.status === 'saving') return '<p class="ov-note">기록 저장 중…</p>';
        if (s.status === 'saved') return '<p class="ov-note ok">랭킹에 저장했어요</p>';
        if (s.status === 'queued') return '<p class="ov-note">지금은 오프라인이에요. 연결되면 자동으로 저장돼요.</p>';
        if (s.status === 'error') return `<p class="ov-note bad">${A.esc(s.msg)}</p>`;
        if (s.status === 'guest') return '<p class="ov-note">로그인하면 이 기록이 랭킹에 올라가요.</p><button class="btn btn-primary" type="button" data-st-save>로그인하고 기록 저장</button>';
        return '';
      }
    };
    return page;
  }
  // 내 최고 점수 (로그인: 서버, 손님: 이 기기) — 다시 도전해도 유지
  function bestKeeper(id) {
    const key = 'gogogogo.' + id + '.best';
    const local = () => { try { return +localStorage.getItem(key) || 0; } catch (e) { return 0; } };
    const k = { best: Hub.user ? 0 : local() };
    if (Hub.user) Hub.myBest(id).then(v => { k.best = Math.max(k.best, v || 0); }).catch(() => {});
    k.add = v => { const nb = v > k.best; k.best = Math.max(k.best, v); if (!Hub.user) { try { if (v > local()) localStorage.setItem(key, String(v)); } catch (e) { /* noop */ } } return nb; };
    return k;
  }
  const shuffle = (a, rnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((rnd || Math.random)() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  window.GoStudy = { isSyl, split, join, dueum, starts, dict, text, round, soloPage, bestKeeper, shuffle };
})();
