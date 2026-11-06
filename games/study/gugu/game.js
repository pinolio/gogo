/*
 * gogo?gogo! — 신호등 구구단 (v79 정식 게임 · 이벤트)
 *  - 게임 화면은 js/testgames.js 의 GoTestGames.gugu() 를 그대로 쓰고, 여기서는 랭킹·기록 저장·포인트만 붙임
 *  - 점수 = 맞힘 − 틀림 (0 아래는 0으로 저장), 포인트 = 점수 10점마다 +1P (최대 3P, settings.js)
 */
(function () {
  'use strict';
  const Hub = window.GameHub, AV = window.GoAvatar;
  const $ = (s, r) => (r || document).querySelector(s);
  const GAME = 'gugu', CFG = () => window.GoSettings.get(GAME) || {};
  const LS = 'gogo_gugu_best';
  const localBest = () => { try { return +localStorage.getItem(LS) || 0; } catch (e) { return 0; } };

  function render(el, A) {
    const T = window.GoTestGames; T.css();
    el.innerHTML = `<div class="gg-page"><div class="page-head"><a class="back" href="#home">← 게임 목록</a><h1>신호등 구구단 <small class="gg-ev">EVENT</small></h1><p>${CFG().blurb}</p></div><div id="ggBody"><p class="empty">불러오는 중…</p></div></div>`;
    const body = $('#ggBody', el);
    let stop = null, alive = true;
    async function save(r) {
      const score = Math.max(0, r.score), C = CFG(), pts = Math.min(C.maxPoints || 3, Math.floor(score / (C.pointsPer || 10)));
      if (!Hub.user) { try { if (score > localBest()) localStorage.setItem(LS, String(score)); } catch (e) { /* noop */ } return '로그인하면 기록이 랭킹에 올라가고 포인트도 받아요.'; }
      try {
        const res = await Hub.submitScore({ game_id: GAME, score, duration_sec: r.sec, result: null, points_delta: pts, extra: { right: r.right, wrong: r.wrong } });
        loadRank();
        return `기록 저장! ${pts ? `<b style="color:#138A3E">+${pts}P</b>` : '포인트는 10점부터'}${res && res.newBest ? ' · <b style="color:#D6202A">내 최고 기록!</b>' : ''}`;
      } catch (e) { return '기록을 저장하지 못했어요: ' + A.esc(e.message || ''); }
    }
    async function loadRank() {
      const list = $('#ggRank', el), mine = $('#ggMine', el); if (!list) return;
      try {
        const rows = await Hub.leaderboard(GAME, 10); if (!list.isConnected) return;
        list.innerHTML = A.rankItems(rows, 'best_score'); AV.paintAll(list);
        if (Hub.user) { const b = await Hub.myBest(GAME); if (mine.isConnected) mine.innerHTML = b ? `내 최고 <b class="num">${A.fmt(b)}</b>점` : '아직 내 기록이 없어요. 도전해 보세요!'; }
        else mine.textContent = '로그인하면 내 기록이 랭킹에 올라가요.';
      } catch (e) { list.innerHTML = '<li class="empty">랭킹을 불러오지 못했어요.</li>'; }
    }
    (async () => {
      let best = localBest();
      if (Hub.user) { try { best = (await Hub.myBest(GAME)) || 0; } catch (e) { /* noop */ } }
      if (!alive) return;
      body.innerHTML = '';
      stop = T.gugu(body, A, { bgm: GAME, best, onOver: save });
      // 오른쪽 칸: 랭킹 + 규칙
      const rules = $('.gg-rules', body);
      if (rules) {
        const side = document.createElement('div'); side.className = 'gg-side';
        rules.parentNode.insertBefore(side, rules); side.appendChild(rules);
        side.insertAdjacentHTML('afterbegin', `<div class="panel gg-rank"><h3>신호등 구구단 랭킹 <small>최고 점수</small></h3><ol class="rank" id="ggRank"><li class="empty">불러오는 중…</li></ol><p class="small" id="ggMine"></p></div>`);
        loadRank();
      }
    })();
    return () => { alive = false; if (stop) stop(); };
  }
  window.GoGugu = { render };

  // 게임 카드·이벤트 그림: 녹색불 신호등 + 구구단
  window.GoGames = window.GoGames || {};
  window.GoGames.gugu = {
    thumb(ctx, w, h) {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#CFEFFF'); g.addColorStop(1, '#EAF7FF');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 28) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, h * 0.82, 16, h * 0.18); }   // 건널목 줄
      const im = new Image(); im.src = 'img/test/gugu_light_green.png';
      const draw = () => { const iw = w * 0.42, ih = iw * im.naturalHeight / im.naturalWidth; ctx.drawImage(im, w * 0.05, h * 0.18, iw, ih); };
      if (im.complete && im.naturalWidth) draw(); else im.addEventListener('load', () => { try { draw(); } catch (e) { /* noop */ } }, { once: true });
      ctx.fillStyle = '#1D2340'; ctx.font = `bold ${Math.round(h * 0.2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('4×6', w * 0.74, h * 0.34);
      ctx.fillStyle = '#138A3E'; ctx.fillText('=24', w * 0.74, h * 0.56);
    }
  };
})();
