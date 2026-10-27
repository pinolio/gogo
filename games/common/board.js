/*
 * gogo?gogo! — 보드게임 공통 도구 (GoBoard)
 *  - 바둑·오목·장기·체스·알까기·숫자 코드가 함께 사용
 *  - 마우스/터치 좌표 변환, 도트 스타일 판·돌 그리기, 컴퓨터 생각 시간(비동기) 처리
 *
 * 보드게임 game.js 의 약속 (app.js 가 이 형태로 부름)
 *   create(canvas, hooks) → inst
 *     inst.start({ mode: 'ai' | 'local', level: 'easy' | 'normal' | 'hard' })
 *     inst.press(buttonId)   // '기권' 등 버튼
 *     inst.destroy()
 *   hooks.onTurn({ text, side })                    // 차례 표시
 *   hooks.onButtons([{ id, label, disabled }])      // 게임별 버튼 (수 넘기기 등)
 *   hooks.onOver({ winner: 0 | 1 | -1, message, moves, duration_sec, extra })
 *       winner 0 = 먼저 두는 쪽(사람), 1 = 나중 두는 쪽(컴퓨터), -1 = 무승부
 */
(function () {
  'use strict';
  const P = window.GoPixel;

  const B = {
    // 판 색 (게임 화면은 테마와 관계없이 고정)
    WOOD: '#E8B864', WOOD_D: '#C9933F', WOOD_L: '#F3CF8A', LINE: '#5A3A1A',
    BLACK: '#20232F', WHITE: '#F4F1E8', RED: '#D2343A', GREEN: '#1E8A5A', BLUE: '#2F55D9',
    SEL: '#FFD23F', HINT: '#3DDC84',

    // 캔버스 위 마우스/터치 → 게임 좌표
    pointer(canvas, W, H, cb) {
      const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
      const h = {
        down: e => { if (e.button > 0) return; canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); const p = pos(e); cb('down', p.x, p.y, e); },
        move: e => { const p = pos(e); cb('move', p.x, p.y, e); },
        up: e => { const p = pos(e); cb('up', p.x, p.y, e); },
        leave: () => cb('leave', -1, -1)
      };
      canvas.addEventListener('pointerdown', h.down);
      canvas.addEventListener('pointermove', h.move);
      canvas.addEventListener('pointerup', h.up);
      canvas.addEventListener('pointerleave', h.leave);
      canvas.style.touchAction = 'none';
      return () => {
        canvas.removeEventListener('pointerdown', h.down); canvas.removeEventListener('pointermove', h.move);
        canvas.removeEventListener('pointerup', h.up); canvas.removeEventListener('pointerleave', h.leave);
      };
    },

    // 도트 나무판 (가로 줄무늬 + 테두리)
    wood(ctx, x, y, w, h) {
      ctx.fillStyle = B.WOOD; ctx.fillRect(x, y, w, h);
      for (let i = 0; i < h; i += 6) { ctx.fillStyle = (i / 6) % 3 === 0 ? B.WOOD_L : (i / 6) % 3 === 1 ? B.WOOD : '#E2AE58'; ctx.fillRect(x, y + i, w, 3); }
      ctx.fillStyle = B.WOOD_D; ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x + w - 4, y, 4, h);
      ctx.fillStyle = B.WOOD_L; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y, 3, h);
    },

    // 도트 원 (네모 칸으로 채운 동그라미) — 바둑돌·장기알
    disc(ctx, cx, cy, r, fill, opt) {
      opt = opt || {};
      const px = opt.px || Math.max(2, Math.round(r / 6));
      const n = Math.ceil(r / px);
      for (let j = -n; j < n; j++) for (let i = -n; i < n; i++) {
        const dx = (i + 0.5) * px, dy = (j + 0.5) * px, d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        let c = fill;
        if (d > r - px * 1.1) c = opt.rim || 'rgba(0,0,0,.35)';
        else if (opt.shine !== false && dx < -r * 0.15 && dy < -r * 0.15 && d < r * 0.75 && d > r * 0.3) c = opt.light || 'rgba(255,255,255,.35)';
        ctx.fillStyle = c; ctx.fillRect(Math.round(cx + i * px), Math.round(cy + j * px), px, px);
      }
    },
    stone(ctx, cx, cy, r, black, alpha) {
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      B.disc(ctx, cx, cy, r, black ? '#1F222C' : '#F2EFE6', { rim: black ? '#000000' : '#9A9384', light: black ? 'rgba(255,255,255,.28)' : '#FFFFFF' });
      ctx.globalAlpha = 1;
    },
    // 굵은 선 (도트 느낌을 위해 정수 좌표)
    line(ctx, x1, y1, x2, y2, c, w) {
      ctx.strokeStyle = c || B.LINE; ctx.lineWidth = w || 2; ctx.beginPath();
      ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5); ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5); ctx.stroke();
    },
    // 글자 (한글·한자)
    label(ctx, str, x, y, size, color, weight) {
      ctx.font = (weight || 700) + ' ' + size + 'px "Jua", "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(str, x, y + 1);
    },
    // 컴퓨터 생각 (화면이 먼저 그려지도록 잠깐 쉬었다가 계산)
    think(fn, ms) { return setTimeout(fn, ms == null ? 350 : ms); },
    rand: (n) => Math.floor(Math.random() * n),
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    LEVELS: { easy: '쉬움', normal: '보통', hard: '어려움' }
  };
  window.GoBoard = B;
})();
