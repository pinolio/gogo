/*
 * gogo?gogo! — 한국사 퀴즈 (공부?, 혼자 도전 + 랭킹) · v36
 *  - 화면·규칙은 games/study/quiz.js (GoQuiz) 를 같이 씀 — 사자성어 맞추기와 같은 방식
 *  - 문제 세 가지가 섞여 나옴 (비율: settings.js 의 mix)
 *    ① 설명 → 이름 고르기: 보기는 같은 갈래(인물·사건·문화유산·제도)끼리
 *    ② 시대 고르기: 이름을 보고 시대 고르기 (보기는 가까운 시대에서 골라 헷갈리게). data.js 여섯째 값 1 인 것은 뺌
 *    ③ 순서 고르기: 사건 4개 중 가장 먼저(또는 가장 나중에) 일어난 것 — 사건끼리 15년 넘게 떨어진 것만 골라 겹치지 않게
 *  - 풀이: 정답의 시대·연도와 설명, 순서 문제는 네 사건의 연도를 차례로 보여 줌
 */
(function () {
  'use strict';
  const T = window.GoStudy, Q = window.GoQuiz;
  const CFG = () => window.GoSettings.get('history') || {};
  const D = () => (window.GoHistory || []).map(x => ({ n: x[0], d: x[1], c: x[2], e: x[3], y: x[4], noEra: !!x[5] }));
  const yearTxt = y => (y == null ? '' : y < 0 ? '기원전 ' + (-y) + '년' : y + '년');
  const BADGE = { 인물: '누구일까요?', 사건: '어떤 사건일까요?', 문화유산: '어떤 문화유산일까요?', 제도: '어떤 제도일까요?' };
  function descQ(all, used) {
    let pool = all.filter(x => !used.has('d:' + x.n)); if (!pool.length) { all.forEach(x => used.delete('d:' + x.n)); pool = all; }
    const a = pool[Math.floor(Math.random() * pool.length)]; used.add('d:' + a.n);
    const pick = Q.choices4(a.n, all.filter(x => x.c === a.c && x !== a).map(x => x.n));
    return { badge: BADGE[a.c] || '무엇일까요?', badgeColor: '#9C36B5', prompt: a.d, big: false, choices: pick.choices, ans: pick.ans, long: false,
      revealTitle: a.n, revealSub: a.e + (a.y != null ? ' · ' + yearTxt(a.y) : '') + ' · ' + a.d };
  }
  function eraQ(all, used) {
    const E = window.GoHistoryEras;
    let pool = all.filter(x => !x.noEra && !used.has('e:' + x.n)); if (!pool.length) { all.forEach(x => used.delete('e:' + x.n)); pool = all.filter(x => !x.noEra); }
    const a = pool[Math.floor(Math.random() * pool.length)]; used.add('e:' + a.n);
    const i = E.indexOf(a.e), near = E.filter((e, k) => e !== a.e && Math.abs(k - i) <= 3);   // 가까운 시대에서 보기
    const pick = Q.choices4(a.e, near.length >= 3 ? near : E.filter(e => e !== a.e));
    // 보기를 시대 순서대로 놓기 (헷갈리지 않게)
    const ordered = pick.choices.slice().sort((x, y) => E.indexOf(x) - E.indexOf(y));
    return { badge: '어느 시대일까요? (' + a.c + ')', badgeColor: '#C2410C', prompt: a.n, big: a.n.length <= 9, choices: ordered, ans: ordered.indexOf(a.e), long: false,
      revealTitle: a.n + ' → ' + a.e, revealSub: (a.y != null ? yearTxt(a.y) + ' · ' : '') + a.d };
  }
  function orderQ(all) {
    const ev = T.shuffle(all.filter(x => x.c === '사건' && x.y != null)), picked = [];
    for (const x of ev) { if (picked.every(p => Math.abs(p.y - x.y) >= 15)) picked.push(x); if (picked.length === 4) break; }
    if (picked.length < 4) return null;
    const first = Math.random() < 0.6, sorted = picked.slice().sort((p, q) => p.y - q.y), a = first ? sorted[0] : sorted[3];
    const ch = T.shuffle(picked.map(x => x.n));
    return { badge: first ? '가장 먼저 일어난 일은?' : '가장 나중에 일어난 일은?', badgeColor: '#0E7C66', prompt: first ? '다음 중 가장 먼저 일어난 사건을 고르세요' : '다음 중 가장 나중에 일어난 사건을 고르세요',
      big: false, choices: ch, ans: ch.indexOf(a.n), long: false,
      revealTitle: a.n + ' (' + yearTxt(a.y) + ')', revealSub: sorted.map(x => x.n + ' ' + yearTxt(x.y)).join(' → ') };
  }
  function make(mode, used) {
    const all = D(), mix = CFG().mix || { desc: 0.5, era: 0.25, order: 0.25 }, r = Math.random() * (mix.desc + mix.era + mix.order);
    if (r < mix.desc) return descQ(all, used);
    if (r < mix.desc + mix.era) return eraQ(all, used);
    return orderQ(all) || descQ(all, used);
  }
  window.GoHistoryQuiz = Q.make({
    id: 'history', title: '한국사 퀴즈', watermark: '韓國史', colors: { top: '#4A2A12', bottom: '#2A170A' },
    sub: s => `${s}초 · 4지선다 · 인물·사건·시대·순서`,
    goal: s => `${s}초 동안 한국사 문제를 맞혀요.<br>설명 · 시대 · 순서 문제가 섞여 나와요!`,
    rules: cfg => [`<b>${cfg.timeLimit || 60}초</b> 동안 최대한 많이 맞혀요.`, '① 설명을 보고 알맞은 <b>인물·사건·문화유산·제도</b> 고르기', '② 이름을 보고 <b>어느 시대</b>인지 고르기 (구석기 ~ 현대)', '③ 사건 네 개 중 <b>가장 먼저(나중에) 일어난 일</b> 고르기', '아래 보기를 누르거나 키보드 <b>1 · 2 · 3 · 4</b>. 틀리면 정답과 연도·설명을 보여 줘요.', `맞히면 ${cfg.scoreRight || 100}점 + 연속 보너스(${cfg.streakBonus || 20}점씩). 포인트는 없고 가장 높은 점수가 랭킹에 올라가요.`],
    make
  });
  window.GoGames.history = {
    id: 'history',
    thumb(ctx, w, h) {
      const W = 720, H = 540; ctx.save(); ctx.scale(w / W, h / H);
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#4A2A12'); bg.addColorStop(1, '#2A170A'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      T.text(ctx, '韓國史', W / 2, 120, 80, 'rgba(255,210,63,.35)', 'center', 400);
      T.text(ctx, '훈민정음을 만든 왕은?', W / 2, 230, 46, '#FFFFFF', 'center');
      ['① 세종', '② 정조', '③ 영조', '④ 광해군'].forEach((s, i) => { const x = 40 + (i % 2) * 330, y = 310 + Math.floor(i / 2) * 95; T.round(ctx, x, y, 310, 78, 14, i === 0 ? '#3DDC84' : '#5A3518', '#1A0E05', 4); T.text(ctx, s, x + 155, y + 40, 38, i === 0 ? '#0F1430' : '#FFF3E0', 'center'); });
      ctx.restore();
    }
  };
})();
