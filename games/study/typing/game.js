/*
 * gogo?gogo! — 한글 타자연습 (공부?, 혼자 도전 + 랭킹)
 *  - 하늘에서 낱말이 떨어짐 → 아래 입력 칸에 똑같이 치고 Enter → 사라지며 점수
 *  - 바닥에 닿으면 방어막 -1, 방어막이 모두 없어지면 끝
 *  - 12개를 없앨 때마다 단계 +1 (빨라지고 긴 낱말, 6단계부터 속담)
 *  - 점수 = 글자 수 × 10 × 단계 + 연속 보너스. 끝나면 분당 타수(자모 기준)·정확도
 */
(function () {
  'use strict';
  const T = window.GoStudy, BGM = window.GoBGM, Hub = window.GameHub;
  const W = 720, H = 540, GROUND = 488;
  const CFG = window.GoSettings.get('typing');
  const PROVERBS = ['가는 말이 고와야 오는 말이 곱다', '낮말은 새가 듣고 밤말은 쥐가 듣는다', '원숭이도 나무에서 떨어진다', '세 살 버릇 여든까지 간다', '티끌 모아 태산', '소 잃고 외양간 고친다', '천 리 길도 한 걸음부터', '백지장도 맞들면 낫다', '배보다 배꼽이 더 크다', '등잔 밑이 어둡다', '고래 싸움에 새우 등 터진다', '누워서 떡 먹기', '돌다리도 두들겨 보고 건너라', '말 한마디로 천 냥 빚을 갚는다', '발 없는 말이 천 리 간다', '아니 땐 굴뚝에 연기 날까', '우물 안 개구리', '호랑이도 제 말 하면 온다', '열 번 찍어 안 넘어가는 나무 없다', '빈 수레가 요란하다', '가재는 게 편', '금강산도 식후경', '꿩 먹고 알 먹고', '식은 죽 먹기', '하늘의 별 따기', '쇠뿔도 단김에 빼라', '윗물이 맑아야 아랫물이 맑다', '콩 심은 데 콩 나고 팥 심은 데 팥 난다', '작은 고추가 더 맵다', '같은 값이면 다홍치마'];
  const COLORS = ['#FFD23F', '#7FE3FF', '#7DFFC4', '#FF9A3D', '#C792FF', '#FF7EB6'];
  const norm = s => s.replace(/\s+/g, ' ').trim();
  // 자모 타수: 한 글자 = 첫소리 + 가운뎃소리 (+ 받침), 겹모음·겹받침은 2타
  const DOUBLE_V = [9, 10, 11, 14, 15, 16, 19], DOUBLE_C = [3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18];
  const strokes = s => [...s].reduce((n, ch) => {
    if (!T.isSyl(ch)) return n + (ch === ' ' ? 1 : 0);
    const [, v, c] = T.split(ch); return n + 2 + (DOUBLE_V.includes(v) ? 1 : 0) + (c ? (DOUBLE_C.includes(c) ? 2 : 1) : 0);
  }, 0);

  let words = null;
  const loadWords = () => words ? Promise.resolve(words) : fetch(CFG.folder + '/words.txt').then(r => r.text()).then(t => {
    const all = t.split('\n').map(s => s.trim()).filter(Boolean);
    words = { 2: all.filter(w => w.length === 2), 3: all.filter(w => w.length === 3), 4: all.filter(w => w.length === 4) };
    return words;
  });

  window.GoTyping = {
    render(el, A) {
      BGM.load('typing');
      const page = T.soloPage(el, A, {
        id: 'typing', title: '한글 타자연습', tag: '공부?', sub: '떨어지는 낱말을 입력해서 막기 · 분당 타수 측정', w: W, h: H, cab: 'cab-study',
        rules: ['위에서 떨어지는 낱말을 아래 칸에 <b>똑같이</b> 치고 <b>Enter</b>.', '바닥에 닿으면 방어막이 하나 줄어요. 방어막 ' + CFG.lives + '개가 모두 없어지면 끝.', CFG.levelEvery + '개를 없앨 때마다 단계가 올라 더 빨라지고, 6단계부터는 속담도 나와요.', '점수 = 글자 수 × 10 × 단계 + 연속 보너스. 끝나면 분당 타수와 정확도를 알려 줘요.', '포인트는 없고, 가장 높은 점수가 랭킹에 올라가요. (로그인 필요)']
      });
      page.under.innerHTML = '<form class="ty-form" autocomplete="off"><input type="text" maxlength="30" placeholder="떨어지는 낱말을 입력하고 Enter" aria-label="타자 입력" autocapitalize="off" spellcheck="false" enterkeyhint="send"><button class="btn btn-sun" type="submit">입력</button></form>';
      const form = page.under.querySelector('form'), inp = form.querySelector('input');
      const ctx = window.GoPixel.setup(page.canvas, W, H), best = T.bestKeeper('typing');
      let st = { phase: 'ready' }, raf = 0, last = 0, lastSubmit = { v: '', t: 0 };

      function start() {
        if (st.phase === 'play') return;
        loadWords().then(() => {
          st = { phase: 'play', drops: [], fx: [], score: 0, level: 1, cleared: 0, lives: CFG.lives, combo: 0, spawn: 0.4, t0: performance.now(), hits: 0, tries: 0, keys: 0, saved: null };
          page.ov.hidden = true; inp.value = ''; inp.focus(); BGM.restart();
        });
      }
      function pool() {
        const L = st.level;
        if (L >= 6 && Math.random() < Math.min(0.35, 0.08 * (L - 5))) return PROVERBS[Math.floor(Math.random() * PROVERBS.length)];
        const len = L <= 2 ? 2 : L <= 4 ? (Math.random() < 0.6 ? 2 : 3) : L <= 6 ? (Math.random() < 0.6 ? 3 : 2) : (Math.random() < 0.5 ? 3 : Math.random() < 0.6 ? 4 : 2);
        const list = words[len] || words[2];
        return list[Math.floor(Math.random() * list.length)];
      }
      function spawn() {
        let w = pool(), tries = 0;
        while (st.drops.some(d => d.w === w) && tries++ < 5) w = pool();
        ctx.font = '700 22px Galmuri11, Pretendard, sans-serif';
        const tw = ctx.measureText(w).width + 24;
        const x = 12 + Math.random() * Math.max(10, W - tw - 24);
        st.drops.push({ w, x, y: 70, wpx: tw, v: 22 + st.level * 8 + Math.random() * 8, col: COLORS[(st.level - 1) % COLORS.length] });
      }
      function submit(raw) {
        const v = norm(raw); if (!v) return;
        st.tries++;
        // 같은 낱말이 여럿이면 가장 아래(급한) 것부터
        const hit = st.drops.filter(d => norm(d.w) === v).sort((a, b) => b.y - a.y)[0];
        if (!hit) { st.combo = 0; st.wrong = 1; return; }
        st.drops.splice(st.drops.indexOf(hit), 1);
        st.hits++; st.cleared++; st.combo++; st.keys += strokes(hit.w);
        const gain = hit.w.replace(/\s/g, '').length * 10 * st.level + Math.min(10, st.combo - 1) * 5;
        st.score += gain;
        st.fx.push({ x: hit.x + hit.wpx / 2, y: hit.y, t: 0, txt: '+' + gain, col: hit.col });
        if (st.cleared % CFG.levelEvery === 0) { st.level++; st.fx.push({ x: W / 2, y: H / 2 - 40, t: 0, txt: st.level + '단계!', col: '#FFD23F', big: 1 }); }
      }
      function over() {
        st.phase = 'over'; st.sec = Math.max(3, Math.round((performance.now() - st.t0) / 1000));
        st.cpm = Math.round(st.keys / (st.sec / 60)); st.acc = st.tries ? Math.round(st.hits / st.tries * 100) : 0;
        st.newBest = best.add(st.score);
        st.saved = { status: Hub.user ? 'saving' : 'guest' }; overlay();
        const s = st;
        if (Hub.user) page.save({ score: s.score, duration_sec: s.sec, extra: { level: s.level, cleared: s.cleared, cpm: s.cpm, acc: s.acc } }).then(r => { s.saved = r; if (st === s) overlay(); });
      }
      function overlay() {
        const ov = page.ov; if (!ov.isConnected) return;
        ov.hidden = false;
        if (st.phase === 'ready') ov.innerHTML = `<div class="ov-box"><span class="ov-best">공부?</span><div class="ov-title">한글 타자연습</div><p class="ov-goal">떨어지는 낱말을 바닥에 닿기 전에<br>아래 칸에 입력하고 <b>Enter</b>!</p><button class="btn btn-primary" type="button" data-go>시작 ▶</button><p class="ov-note">${Hub.user ? '최고 점수가 오른쪽 랭킹에 올라가요' : '손님 플레이 · 로그인하면 랭킹에 올라가요'}</p></div>`;
        else ov.innerHTML = `<div class="ov-box result"><div class="ov-title">게임 끝!</div><div class="ult-score num">${A.fmt(st.score)}</div>
          <p class="ov-hint">${st.level}단계 · 낱말 ${st.cleared}개 · 분당 <b>${st.cpm}</b>타 · 정확도 ${st.acc}% · ${A.dur(st.sec)}</p>
          <p class="ov-note">${st.newBest ? '<b class="ult-nb">최고 점수 갱신!</b> ' : ''}내 최고 점수 <b class="num">${A.fmt(best.best)}</b></p>
          ${page.noteHTML(st.saved)}
          <div class="ov-btns"><button class="btn btn-sun" type="button" data-go>다시 도전 ▶</button><a class="btn" href="#home">다른 게임</a></div></div>`;
        const go = ov.querySelector('[data-go]'); if (go) go.addEventListener('click', start);
        const sv = ov.querySelector('[data-st-save]'); if (sv) sv.addEventListener('click', () => A.openAuth('login', () => { if (st.saved && st.saved.status === 'guest') { st.saved = { status: 'saving' }; overlay(); page.save({ score: st.score, duration_sec: st.sec, extra: { level: st.level, cleared: st.cleared, cpm: st.cpm, acc: st.acc } }).then(r => { best.add(st.score); st.saved = r; overlay(); }); } }));
      }
      form.addEventListener('submit', e => {
        e.preventDefault();
        if (st.phase !== 'play') { start(); return; }
        const v = inp.value;
        if (norm(v) === lastSubmit.v && performance.now() - lastSubmit.t < 250) { inp.value = ''; return; }   // 한글 입력기 Enter 두 번
        lastSubmit = { v: norm(v), t: performance.now() };
        inp.value = ''; submit(v);
      });

      function draw(dt) {
        // 하늘 · 바닥
        const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1B1F4A'); sky.addColorStop(1, '#2C2F6E');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 173) % W, 60 + (i * 97) % 380, 2, 2);
        ctx.fillStyle = '#18204A'; for (let i = 0; i < 12; i++) { const bw = 60, bh = 30 + (i * 37) % 60; ctx.fillRect(i * 62, GROUND - bh, bw, bh); }
        ctx.fillStyle = st.hurt > 0 ? '#FF5A5F' : '#3DDC84'; ctx.fillRect(0, GROUND, W, 6);
        ctx.fillStyle = '#0F1430'; ctx.fillRect(0, GROUND + 6, W, H - GROUND - 6);
        // 위쪽 정보
        ctx.fillStyle = 'rgba(15,20,48,.92)'; ctx.fillRect(0, 0, W, 56);
        const sc = st.score || 0, bb = Math.max(best.best, st.phase === 'play' ? sc : 0);
        T.text(ctx, '점수', 16, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, A.fmt(sc), 16, 38, 22, '#FFD23F', 'left');
        T.text(ctx, '최고', 150, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, A.fmt(bb), 150, 38, 18, sc > best.best && best.best > 0 && st.phase === 'play' ? '#FF3D8B' : '#7DFFC4', 'left');
        T.text(ctx, '단계', 280, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, st.level || 1, 280, 38, 20, '#FFFFFF', 'left');
        T.text(ctx, '방어막', 360, 16, 12, '#8A93C0', 'left', 400);
        for (let i = 0; i < CFG.lives; i++) { ctx.fillStyle = i < (st.lives == null ? CFG.lives : st.lives) ? '#3DDC84' : '#2A3160'; ctx.fillRect(360 + i * 22, 30, 16, 16); }
        const mins = st.phase === 'play' ? (performance.now() - st.t0) / 60000 : 0;
        T.text(ctx, '분당 타수', 600, 16, 12, '#8A93C0', 'left', 400); T.text(ctx, st.phase === 'play' && mins > 0.05 ? Math.round(st.keys / mins) : '-', 600, 38, 18, '#9AE6FF', 'left');
        if (st.phase !== 'play') return;
        // 떨어지는 낱말
        st.drops.forEach(d => {
          T.round(ctx, d.x, d.y - 18, d.wpx, 36, 10, 'rgba(10,14,36,.85)', d.col, 2);
          T.text(ctx, d.w, d.x + d.wpx / 2, d.y + 1, 22, '#FFFFFF', 'center');
        });
        st.fx.forEach(f => { ctx.globalAlpha = Math.max(0, 1 - f.t / 900); T.text(ctx, f.txt, f.x, f.y - f.t * 0.05, f.big ? 44 : 20, f.col, 'center'); ctx.globalAlpha = 1; });
        if (st.combo >= 3) T.text(ctx, st.combo + '연속!', W - 16, 80, 18, '#FF9A3D', 'right');
        if (st.wrong > 0) { ctx.fillStyle = `rgba(255,90,95,${st.wrong * 0.25})`; ctx.fillRect(0, GROUND - 8, W, 8); }
      }
      function loop(t) {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(80, t - (last || t)); last = t;
        if (st.phase === 'play') {
          st.spawn -= dt / 1000;
          if (st.spawn <= 0) { spawn(); st.spawn = Math.max(0.75, 2.4 - st.level * 0.17) * (0.8 + Math.random() * 0.4); }
          st.drops.forEach(d => { d.y += d.v * dt / 1000; });
          const fell = st.drops.filter(d => d.y >= GROUND - 16);
          if (fell.length) { st.drops = st.drops.filter(d => !fell.includes(d)); st.lives -= fell.length; st.combo = 0; st.hurt = 1; fell.forEach(d => st.fx.push({ x: d.x + d.wpx / 2, y: GROUND - 30, t: 0, txt: '쿵!', col: '#FF5A5F' })); }
          if (st.lives <= 0) { st.lives = 0; over(); }
          st.fx.forEach(f => { f.t += dt; }); st.fx = st.fx.filter(f => f.t < 900);
          if (st.hurt > 0) st.hurt = Math.max(0, st.hurt - dt / 300);
          if (st.wrong > 0) st.wrong = Math.max(0, st.wrong - dt / 300);
        }
        draw(dt);
      }
      overlay(); page.loadRank(); loadWords().catch(() => {});
      raf = requestAnimationFrame(loop);
      return function cleanup() { cancelAnimationFrame(raf); BGM.stop(); st = { phase: 'gone' }; };
    },
    _strokes: strokes
  };

  window.GoGames.typing = {
    id: 'typing',
    thumb(ctx, w, h) {
      ctx.save(); ctx.scale(w / W, h / H);
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1B1F4A'); sky.addColorStop(1, '#2C2F6E'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      [['사과', 80, 120, '#FFD23F'], ['학교', 330, 220, '#7FE3FF'], ['무지개', 470, 90, '#7DFFC4'], ['연필', 180, 330, '#FF9A3D']].forEach(([wd, x, y, c]) => { T.round(ctx, x, y, 170, 70, 14, 'rgba(10,14,36,.85)', c, 4); T.text(ctx, wd, x + 85, y + 37, 40, '#FFFFFF', 'center'); });
      ctx.fillStyle = '#3DDC84'; ctx.fillRect(0, GROUND, W, 8);
      T.round(ctx, 160, GROUND - 4, 400, 52, 10, '#EEF1FF', '#0A0E24', 4); T.text(ctx, '학교|', 360, GROUND + 22, 32, '#1D2340', 'center');
      ctx.restore();
    }
  };
})();
