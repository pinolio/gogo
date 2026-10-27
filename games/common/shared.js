/* gogo?gogo! — 게임 공통 도구 (픽셀 블록 그리기, 캔버스 설정, 플레이 시간 측정, 스와이프) */
(function () {
  'use strict';
  window.GoGames = window.GoGames || {};

  const P = {
    // 게임 화면은 테마와 관계없이 '어두운 오락실 스크린'으로 통일합니다.
    BOARD: '#161C3A', PANEL: '#0F1430', GRID: '#20294F', INK: '#EEF1FF', DIM: '#8A93C0',
    PIECE: { I: '#3BC8F5', O: '#FFD23F', T: '#A66BFF', S: '#3DDC84', Z: '#FF5A5F', J: '#4C7DFF', L: '#FF9A3D' },

    setup(canvas, w, h) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      return ctx;
    },

    // 도트 느낌의 입체 블록 (밝은 위·왼쪽, 어두운 아래·오른쪽)
    block(ctx, x, y, s, color) {
      const b = Math.max(2, Math.round(s / 8));
      ctx.fillStyle = color; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fillRect(x, y, s, b); ctx.fillRect(x, y, b, s);
      ctx.fillStyle = 'rgba(0,0,0,.30)'; ctx.fillRect(x, y + s - b, s, b); ctx.fillRect(x + s - b, y, b, s);
    },

    text(ctx, str, x, y, size, color, align) {
      ctx.font = size + 'px "Press Start 2P", "Courier New", monospace';
      ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
      ctx.fillText(String(str), x, y);
    },

    // 일시정지 시간을 뺀 실제 플레이 시간
    clock() {
      let acc = 0, t0 = null;
      return {
        start() { if (t0 == null) t0 = performance.now(); },
        stop() { if (t0 != null) { acc += performance.now() - t0; t0 = null; } },
        reset() { acc = 0; t0 = null; },
        sec() { return Math.round((acc + (t0 != null ? performance.now() - t0 : 0)) / 1000); }
      };
    },

    // 화면 밀기(스와이프) → 'left' | 'right' | 'up' | 'down' | 'tap'
    swipe(el, cb) {
      let sx = 0, sy = 0, id = null;
      const down = e => { sx = e.clientX; sy = e.clientY; id = e.pointerId; };
      const up = e => {
        if (e.pointerId !== id) return; id = null;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return cb('tap');
        cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointerup', up); };
    }
  };
  window.GoPixel = P;
})();

/* ------------------------------------------------------------------
 * 게임 설정 모음 (GoSettings)
 *  - 각 게임 폴더의 settings.js 가 GoSettings.register({...}) 로 등록합니다.
 *  - 포인트·승리 조건·배경음악·소개 문구를 게임 폴더 안에서 따로 관리하기 위한 장치입니다.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';
  const all = {};
  window.GoSettings = {
    // 카테고리 폴더 이름 → 화면에 보이는 이름 (games/ 아래 폴더와 같게 유지)
    CATEGORIES: { puzzle: '퍼즐', arcade: '아케이드', board: '보드게임', action: '액션', shooting: '슈팅' },
    register(s) {
      s.points = Object.assign({ win: 2, lose: -1 }, s.points || {});
      all[s.id] = s;
      return s;
    },
    get: id => all[id] || null,
    list: () => Object.values(all).sort((a, b) => (a.order || 99) - (b.order || 99)),
    ids: () => Object.keys(all),
    // 한 판 결과 → { win, delta }  (delta = 이번 판 포인트 변화. 실제 지급은 최하 0P 규칙 적용)
    pointsFor(id, win, variant) {
      const s = all[id]; if (!s) return { win, delta: 0 };
      const table = (variant && s.points[variant]) || s.points;
      return { win, delta: win ? table.win : table.lose };
    }
  };
})();

/* ------------------------------------------------------------------
 * 배경음악 (GoBGM)
 *  - 게임 폴더의 bgm/ 안에 settings.js 에 적힌 파일(기본 bgm.mp3)을 넣으면 자동으로 재생됩니다.
 *  - 파일이 없으면 조용히 넘어가고, 음악 버튼도 나타나지 않습니다.
 * ------------------------------------------------------------------ */
(function () {
  'use strict';
  const KEY = 'gogogogo.bgmMuted';
  let muted = false; try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* noop */ }
  const subs = new Set();
  const B = { audio: null, id: null, ready: false, wanted: false };
  const emit = () => subs.forEach(fn => { try { fn(B); } catch (e) { /* noop */ } });
  B.onChange = fn => { subs.add(fn); return () => subs.delete(fn); };
  B.isMuted = () => muted;
  B.load = function (id) {
    B.stop();
    const s = window.GoSettings.get(id);
    if (!s || !s.bgm || !s.bgm.file) return;
    const a = new Audio(s.folder + '/' + s.bgm.file);
    a.loop = s.bgm.loop !== false; a.volume = s.bgm.volume == null ? 0.5 : s.bgm.volume; a.preload = 'auto';
    a.addEventListener('canplay', () => { if (B.audio === a) { B.ready = true; emit(); if (B.wanted && !muted) a.play().catch(() => {}); } }, { once: true });
    a.addEventListener('error', () => { if (B.audio === a) { B.ready = false; emit(); } });
    B.audio = a; B.id = id; B.ready = false; emit();
  };
  B.play = function () { B.wanted = true; if (B.audio && B.ready && !muted) B.audio.play().catch(() => {}); };
  B.pause = function () { B.wanted = false; if (B.audio) B.audio.pause(); };
  B.restart = function () { if (B.audio) { try { B.audio.currentTime = 0; } catch (e) { /* noop */ } } B.play(); };
  B.stop = function () {
    B.wanted = false;
    if (B.audio) { B.audio.pause(); B.audio.removeAttribute('src'); try { B.audio.load(); } catch (e) { /* noop */ } }
    B.audio = null; B.id = null; B.ready = false; emit();
  };
  B.toggleMute = function () {
    muted = !muted;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* noop */ }
    if (B.audio) { if (muted) B.audio.pause(); else if (B.wanted) B.audio.play().catch(() => {}); }
    emit(); return muted;
  };
  window.GoBGM = B;
})();
