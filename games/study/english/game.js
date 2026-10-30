/*
 * gogo?gogo! — 영어 단어 퀴즈 (공부?, 혼자 도전 + 랭킹) · v36
 *  - 화면·규칙은 games/study/quiz.js (GoQuiz) 를 같이 씀 — 사자성어 맞추기와 같은 방식
 *  - 문제: ① 영어 → 뜻 고르기 ② 뜻 → 영어 고르기 (반반). 보기 3개는 되도록 같은 품사(명사·동사…)에서 골라 헷갈리게
 *  - 단계: 중학(100점) · 고등(150점) · 섞어서(단어 수준대로) — 시작 화면에서 고름, 이 기기에 기억
 *  - 한 판에서 같은 단어는 다 나올 때까지 다시 안 나옴
 */
(function () {
  'use strict';
  const T = window.GoStudy, Q = window.GoQuiz;
  const CFG = () => window.GoSettings.get('english') || {};
  const POS = { n: '명사', v: '동사', a: '형용사', ad: '부사' };
  const words = mode => {
    const D = window.GoEnglishWords || { mid: [], high: [] };
    const tag = (l, lv) => l.map(x => ({ en: x[0], ko: x[1], pos: x[2], lv }));
    return mode === 'mid' ? tag(D.mid, 'mid') : mode === 'high' ? tag(D.high, 'high') : tag(D.mid, 'mid').concat(tag(D.high, 'high'));
  };
  function make(mode, used) {
    const all = words(mode), cfg = CFG();
    let pool = all.filter(w => !used.has(w.en)); if (!pool.length) { used.clear(); pool = all; }
    const w = pool[Math.floor(Math.random() * pool.length)]; used.add(w.en);
    const same = all.filter(x => x !== w && x.pos === w.pos), others = same.length >= 3 ? same : all.filter(x => x !== w);
    const toKo = Math.random() < 0.5;
    const pick = Q.choices4(toKo ? w.ko : w.en, others.map(x => (toKo ? x.ko : x.en)));
    return {
      badge: toKo ? '이 영어 단어의 뜻은?' : '이 뜻의 영어 단어는?', badgeColor: toKo ? '#3B5BDB' : '#9C36B5',
      prompt: toKo ? w.en : w.ko, big: toKo || w.ko.length <= 8, choices: pick.choices, ans: pick.ans, long: false,
      worth: w.lv === 'high' ? (cfg.scoreHigh || 150) : (cfg.scoreMid || 100),
      revealTitle: w.en + ' = ' + w.ko, revealSub: (w.lv === 'high' ? '고등' : '중학') + ' 단어 · ' + (POS[w.pos] || '')
    };
  }
  window.GoEnglish = Q.make({
    id: 'english', bg: 'games/study/english/img/bg.jpg', title: '영어 단어 퀴즈', watermark: 'ABC', colors: { top: '#173A5E', bottom: '#10213D' },
    sub: s => `${s}초 · 4지선다 · 중학/고등 단계`,
    goal: s => `${s}초 동안 영어 단어 ↔ 뜻을 맞혀요.<br>아래에서 단계를 고르고 시작!`,
    modes: [{ id: 'mid', label: '중학', desc: '312단어 · 100점' }, { id: 'high', label: '고등', desc: '407단어 · 150점' }, { id: 'mix', label: '섞어서', desc: '719단어' }],
    rules: cfg => [`<b>${cfg.timeLimit || 60}초</b> 동안 최대한 많이 맞혀요.`, '① 영어 단어를 보고 알맞은 <b>뜻</b> 고르기, ② 뜻을 보고 알맞은 <b>영어 단어</b> 고르기가 섞여 나와요.', `시작 화면에서 단계를 골라요: <b>중학</b>(${cfg.scoreMid || 100}점) · <b>고등</b>(${cfg.scoreHigh || 150}점) · <b>섞어서</b>.`, '아래 보기를 누르거나 키보드 <b>1 · 2 · 3 · 4</b>.', `연속으로 맞히면 ${cfg.streakBonus || 20}점씩 보너스. 틀리면 정답을 보여 줘요.`, '포인트는 없고, 가장 높은 점수가 랭킹에 올라가요. (로그인 필요)'],
    make
  });
  window.GoGames.english = {
    id: 'english',
    thumb(ctx, w, h) {
      { const im = T.pic('games/study/english/img/bg.jpg'); if (!(im.complete && im.naturalWidth)) im.addEventListener('load', () => { try { this.thumb(ctx, w, h); } catch (e) { /* noop */ } }, { once: true }); }   // v39 배경 그림이 오면 다시 그림
      const W = 720, H = 540; ctx.save(); ctx.scale(w / W, h / H);
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#173A5E'); bg.addColorStop(1, '#10213D'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); T.scene(ctx, 'games/study/english/img/bg.jpg', W, H, 0.35);
      T.text(ctx, 'opportunity', W / 2, 150, 80, '#FFD23F', 'center');
      T.text(ctx, '이 단어의 뜻은?', W / 2, 250, 44, '#FFFFFF', 'center');
      ['① 기회', '② 증거', '③ 전통', '④ 습관'].forEach((s, i) => { const x = 40 + (i % 2) * 330, y = 320 + Math.floor(i / 2) * 95; T.round(ctx, x, y, 310, 78, 14, i === 0 ? '#3DDC84' : '#26306A', '#0A0E24', 4); T.text(ctx, s, x + 155, y + 40, 38, i === 0 ? '#0F1430' : '#EEF1FF', 'center'); });
      ctx.restore();
    }
  };
})();
