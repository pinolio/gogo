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
    WOOD: '#E8B864', WOOD_D: '#C9933F', WOOD_L: '#F3CF8A', LINE: 'rgba(52,28,8,.85)',
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
    // 굵은 선 (도트 느낌을 위해 정수 좌표)
    line(ctx, x1, y1, x2, y2, c, w) {
      ctx.strokeStyle = c || B.LINE; ctx.lineWidth = w || 2; ctx.beginPath();
      ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5); ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5); ctx.stroke();
    },
    // 글자 (한글·한자)
    // family 'hanja' = 장기알 한자 (붓글씨 느낌 명조체)
    label(ctx, str, x, y, size, color, weight, family) {
      const fam = family === 'hanja' ? '"Noto Serif KR", "Batang", "AppleMyungjo", serif' : '"Jua", "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
      ctx.font = (weight || 700) + ' ' + size + 'px ' + fam;
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(str, x, y + 1);
    },

    /* ================= 고급 도트 그림 (한 번 그려 두고 재사용) =================
     * 1칸 = 게임 좌표 1px. 화면에서는 확대돼도 또렷한 픽셀로 보입니다.
     * 색은 몇 단계 팔레트로 끊고, 사이는 바둑판 디더링(Bayer)으로 섞어 도트 느낌을 냅니다. */
    _cache: new Map(),
    sprite(key, w, h, paint) {
      let c = B._cache.get(key);
      if (c) return c;
      c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h);
      const g = c.getContext('2d'), img = g.createImageData(c.width, c.height);
      const put = (x, y, hex, a) => {
        if (x < 0 || y < 0 || x >= c.width || y >= c.height || !hex) return;
        const i = (y * c.width + x) * 4, n = parseInt(hex.slice(1), 16);
        img.data[i] = n >> 16; img.data[i + 1] = (n >> 8) & 255; img.data[i + 2] = n & 255; img.data[i + 3] = a == null ? 255 : a;
      };
      paint(put, c.width, c.height);
      g.putImageData(img, 0, 0);
      B._cache.set(key, c);
      return c;
    },
    blit(ctx, spr, x, y, alpha) {
      const s = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      if (alpha != null) ctx.globalAlpha = alpha;
      ctx.drawImage(spr, Math.round(x), Math.round(y));
      ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = s;
    },
    // 0~1 값을 팔레트 색으로 (디더링 포함)
    BAYER: [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5],
    ramp(pal, v, x, y) {
      const t = Math.max(0, Math.min(0.9999, v)) * (pal.length - 1), i = Math.floor(t), f = t - i;
      const th = (B.BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      return pal[Math.min(pal.length - 1, i + (f > th ? 1 : 0))];
    },
    // 값 노이즈 (나뭇결·돌 질감)
    _h(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
    noise(x, y) {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = B._h(i, j), b = B._h(i + 1, j), c = B._h(i, j + 1), d = B._h(i + 1, j + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    },
    fbm(x, y) { return B.noise(x, y) * 0.55 + B.noise(x * 2.1, y * 2.1) * 0.3 + B.noise(x * 4.3, y * 4.3) * 0.15; },

    // 나무판: 결이 흐르는 원목 + 모서리 빛·그림자. tone: 'kaya'(바둑·오목·장기) | 'dark'
    WOODS: {
      kaya: ['#A86F2C', '#C58A3F', '#D9A250', '#E6B565', '#EFC57C', '#F6D696'],
      dark: ['#5A3518', '#6E4421', '#83552B', '#986737', '#AC7A45', '#C08F57']
    },
    woodTex(w, h, tone) {
      const pal = B.WOODS[tone || 'kaya'];
      return B.sprite('wood:' + w + 'x' + h + ':' + tone, w, h, (put, W, H) => {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const warp = B.fbm(x * 0.006, y * 0.02) * 6;
          const grain = 0.5 + 0.5 * Math.sin(y * 0.42 + warp * 2 + Math.sin(x * 0.012) * 1.2);
          const ring = Math.pow(0.5 + 0.5 * Math.sin(y * 0.09 + warp), 6);
          const fine = B.noise(x * 0.12, y * 2.2);
          let v = 0.5 + grain * 0.14 - ring * 0.16 + (fine - 0.5) * 0.14 + (B.fbm(x * 0.015, y * 0.015) - 0.5) * 0.12;
          // 모서리 입체: 위·왼쪽 밝게, 아래·오른쪽 어둡게
          const e = Math.min(x, y, W - 1 - x, H - 1 - y);
          if (e < 5) v += (x < 5 || y < 5) && !(x > W - 6 || y > H - 6) ? 0.25 : -0.35;
          put(x, y, e === 0 ? '#4A2A10' : B.ramp(pal, v, x, y));
        }
      });
    },
    wood(ctx, x, y, w, h, tone) { B.blit(ctx, B.woodTex(Math.round(w), Math.round(h), tone), x, y); },

    // 바둑돌: 둥근 빛·반사광·그림자
    STONE: {
      black: ['#06070B', '#11131A', '#1D202B', '#2C3040', '#454B60', '#8C93AE'],
      white: ['#8E8677', '#B4AD9D', '#D2CDBF', '#E7E3D8', '#F6F4EE', '#FFFFFF']
    },
    stoneSprite(r, black) {
      const pal = black ? B.STONE.black : B.STONE.white, S = r * 2 + 6;
      return B.sprite('stone:' + r + ':' + (black ? 1 : 0), S, S, (put) => {
        const c = r + 2;
        // 그림자
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const sx = x + 0.5 - c - 2, sy = y + 0.5 - c - 3;
          if (sx * sx + sy * sy <= r * r && ((x + y) & 1)) put(x, y, '#2B1606', 110);
        }
        const L = [-0.48, -0.62, 0.62], Lm = Math.hypot(...L), Ln = L.map(v => v / Lm);
        const Hn = [Ln[0], Ln[1], Ln[2] + 1], Hm = Math.hypot(...Hn);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
          if (d > r) continue;
          if (d > r - 1) { put(x, y, black ? '#000000' : '#6F6858'); continue; }
          const nz = Math.sqrt(Math.max(0, 1 - (d / r) * (d / r))), nx = dx / r, ny = dy / r;
          const lam = Math.max(0, nx * Ln[0] + ny * Ln[1] + nz * Ln[2]);
          const spec = Math.pow(Math.max(0, (nx * Hn[0] + ny * Hn[1] + nz * Hn[2]) / Hm), black ? 30 : 18);
          const rim = black ? Math.max(0, 1 - nz) * Math.max(0, ny) * 0.35 : 0;      // 아래쪽 반사광
          const v = (black ? 0.12 : 0.28) + lam * (black ? 0.42 : 0.62) + spec * (black ? 0.9 : 0.4) + rim;
          put(x, y, B.ramp(pal, v, x, y));
        }
      });
    },
    stone(ctx, cx, cy, r, black, alpha) {
      r = Math.round(r);
      B.blit(ctx, B.stoneSprite(r, black), cx - r - 2, cy - r - 2, alpha);
    },

    // 장기알: 팔각형 회양목 알 (두께·모서리 깎임·나뭇결)
    PIECE: ['#4A2E12', '#8C6534', '#B88F55', '#D9B97F', '#E8CE98', '#F3E0B5', '#FFF2D2'],
    pieceSprite(a, sel) {
      const P = B.PIECE, T = 4, S = Math.ceil(a * 2 + 4), H = S + T;
      return B.sprite('piece:' + a + ':' + (sel ? 1 : 0), S, H, (put) => {
        const c = S / 2, k = Math.SQRT2;
        const dist = (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) / k);
        for (let y = 0; y < H; y++) for (let x = 0; x < S; x++) {
          const dx = x + 0.5 - c;
          // 옆면(두께)
          const ys = y + 0.5 - c - T, es = a - dist(dx, ys);
          const dy = y + 0.5 - c, ef = a - dist(dx, dy);
          if (ef >= 0) {
            if (ef < 1) { put(x, y, P[0]); continue; }
            if (ef < 3.5) {      // 깎인 모서리: 빛 방향에 따라
              const ax = Math.abs(dx), ay = Math.abs(dy), diag = (ax + ay) / k;
              let nx = 0, ny = 0;
              if (diag >= ax && diag >= ay) { nx = Math.sign(dx) / k; ny = Math.sign(dy) / k; } else if (ax > ay) nx = Math.sign(dx); else ny = Math.sign(dy);
              const lit = -(nx * 0.6 + ny * 0.8);
              put(x, y, lit > 0.2 ? P[6] : lit < -0.2 ? P[2] : P[4]); continue;
            }
            const g = 0.5 + 0.5 * Math.sin(dy * 0.5 + B.fbm(x * 0.05, y * 0.2) * 5);
            const v = 0.62 + g * 0.18 + (B.noise(x * 0.5, y * 1.5) - 0.5) * 0.12 - (dx + dy) / (a * 9);
            put(x, y, sel ? B.ramp(['#E8C35C', '#F2D677', '#FBE89C'], v, x, y) : B.ramp(P.slice(3), v, x, y));
          } else if (es >= 0) {
            put(x, y, es < 1 ? P[0] : B.ramp([P[1], P[2]], 0.3 + (x / S) * 0.1 - (dx / a) * 0.3, x, y));
          } else {
            const sh = a - dist(dx - 1.5, y + 0.5 - c - T - 2);
            if (sh >= 0 && ((x + y) & 1)) put(x, y, '#2B1606', 90);
          }
        }
      });
    },
    // 새긴 글자 (밝은 아래 테두리 + 진한 글자)
    carve(ctx, str, x, y, size, color, family) {
      const fam = family === 'hanja' ? '"Noto Serif KR", "Batang", "AppleMyungjo", serif' : '"Galmuri11", "Jua", "Noto Sans KR", sans-serif';
      ctx.font = '900 ' + size + 'px ' + fam; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,248,226,.85)'; ctx.fillText(str, x + 0.6, y + 1.6);
      ctx.fillStyle = color; ctx.fillText(str, x, y + 0.6);
    },
    janggiPiece(ctx, cx, cy, a, text, color, sel) {
      a = Math.round(a);
      const S = Math.ceil(a * 2 + 4);
      B.blit(ctx, B.pieceSprite(a, sel), cx - S / 2, cy - S / 2);
      B.carve(ctx, text, cx, cy, Math.round(a * 1.22), color, 'hanja');
    },
    // 도트 스프라이트 문자열 → 그림 (체스 말)
    pixelSprite(key, rows, pal) {
      return B.sprite('px:' + key, rows[0].length, rows.length, (put) => {
        rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = pal[row[x]]; if (c) put(x, y, c); } });
      });
    },
    drawScaled(ctx, spr, x, y, w, h) {
      const s = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(spr, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      ctx.imageSmoothingEnabled = s;
    },
    // 화점 (작은 마름모 점)
    star(ctx, x, y, s) {
      ctx.fillStyle = 'rgba(40,20,4,.9)';
      x = Math.round(x); y = Math.round(y);
      ctx.fillRect(x - s, y - 1, s * 2 + 1, 3); ctx.fillRect(x - 1, y - s, 3, s * 2 + 1); ctx.fillRect(x - s + 1, y - s + 1, s * 2 - 1, s * 2 - 1);
    },
    // 펠트 (카드 테이블 천)
    feltTex(w, h) {
      const P = ['#103C2E', '#154A39', '#1A5643', '#20644E', '#277258'];
      return B.sprite('felt' + w + 'x' + h, w, h, (put, W, H) => {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const dx = (x - W / 2) / W, dy = (y - H / 2) / H, vig = 1 - (dx * dx + dy * dy) * 1.6;
          const v = 0.25 + vig * 0.45 + (B.fbm(x / 6, y / 6) - 0.5) * 0.35 + (((x + y) & 3) === 0 ? 0.04 : 0);
          put(x, y, B.ramp(P, v, x, y));
        }
      });
    },
    // 선 (판 위 먹선)
    INK: 'rgba(52,28,8,.82)',

    // 컴퓨터 생각 (화면이 먼저 그려지도록 잠깐 쉬었다가 계산)
    // 한자 글꼴이 늦게 도착하면 다시 그리기
    whenHanja(cb) { try { document.fonts.load('700 20px "Noto Serif KR"', '楚漢車包馬象士卒兵').then(() => cb()).catch(() => {}); } catch (e) { /* noop */ } },
    think(fn, ms) { return setTimeout(fn, ms == null ? 350 : ms); },
    rand: (n) => Math.floor(Math.random() * n),
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    LEVELS: { easy: '쉬움', normal: '보통', hard: '어려움' }
  };
  window.GoBoard = B;
})();
