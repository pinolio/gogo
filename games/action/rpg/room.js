/*
 * gogo?gogo! — skillcom RPG · 건물 안 (v41)
 *   약방 · 도술 서원 · 이장 댁 · 왕성 — 문으로 걸어 들어가면 실내 지도로 바뀜
 *   실내 = 26 × 15 칸 (832 × 480, 화면 가운데에 놓임). 위 3줄 = 뒷벽, 아래 가운데 2칸 = 나가는 문
 *   사람(NPC)은 사이트 아바타 그림 그대로 (data.js 의 NPCS). 가까이 가면 대화 → 가게·학교·이동 창
 *   v129 이장 댁 · 도술 서원 · v130 약방 · 도원수 진영 = 선생님 그림 실내 (PIC 표)
 *   world.js 의 __GoRPGParts 에 getRoom · npcSprite · npcPortrait 를 더해 줌
 */
(function () {
  'use strict';
  const D = window.GoRPGData, AV = window.GoAvatar, P = window.__GoRPGParts;
  const { mk, shade, seeded, TS } = P;
  const RW = 26, RH = 15, K = '#1D2340';

  /* ---------- 사람 그림 (아바타) ---------- */
  const npcC = {};
  function npcSprite(av, frame) {
    const key = JSON.stringify(av) + (frame || 0); if (npcC[key]) return npcC[key];
    return (npcC[key] = P.avatarSprite(AV.normalize(av), {}, true, frame || 0));
  }
  const portC = {};
  function npcPortrait(av) {
    const key = JSON.stringify(av); if (portC[key]) return portC[key];
    const [c, x] = mk(64, 64); AV.draw(x, AV.normalize(av), 0, 0, 4, { crop: 'bust' });
    return (portC[key] = c.toDataURL());
  }

  /* ---------- 그림 도구 ---------- */
  const spr = (w, h, fn) => { const [c, x] = mk(w, h); const p = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(a, b, ww, hh); }; fn(p, x); return c; };
  // 테두리 있는 상자
  const box = (p, a, b, w, h, col, lt, dk) => { p(a, b, w, h, K); p(a + 2, b + 2, w - 4, h - 4, col); if (lt) p(a + 2, b + 2, w - 4, 3, lt); if (dk) p(a + 2, b + h - 5, w - 4, 3, dk); };
  const BOTTLES = ['#FF5A5F', '#4C7DFF', '#3DDC84', '#FFD23F', '#B07AF0', '#FF9A3D', '#5AD8F5'];
  function bottle(p, a, b, col, big) {
    const w = big ? 10 : 8, h = big ? 14 : 11;
    p(a + w / 2 - 2, b - 3, 4, 4, K); p(a + w / 2 - 1, b - 2, 2, 2, '#C8A070');
    p(a, b, w, h, K); p(a + 1, b + 1, w - 2, h - 2, '#D9E4FF'); p(a + 1, b + Math.floor(h / 3), w - 2, h - 1 - Math.floor(h / 3), col); p(a + 2, b + 2, 2, 3, '#FFFFFF');
  }

  /* ---------- 가구 그림 ---------- */
  // 벽 선반 (물약 / 책) : 칸 w 개, 높이 104
  function shelf(w, kind, rnd) {
    const W = w * TS, Hh = 104;
    return spr(W, Hh, p => {
      const wood = kind === 'book' ? '#6B4226' : '#8A5A36', dk = shade(wood, -0.3), lt = shade(wood, 0.2);
      p(0, 0, W, Hh, K); p(2, 2, W - 4, Hh - 4, dk); p(2, 2, W - 4, 4, lt); p(2, 2, 4, Hh - 4, wood); p(W - 6, 2, 4, Hh - 4, wood);
      for (let r = 0; r < 3; r++) {
        const y0 = 8 + r * 30;
        p(4, y0 + 24, W - 8, 4, wood); p(4, y0 + 24, W - 8, 1, lt);
        for (let x0 = 8; x0 < W - 12;) {
          if (kind === 'book') {
            const bw = 4 + Math.floor(rnd() * 4), bh = 14 + Math.floor(rnd() * 9), col = ['#D2343A', '#3E7BD8', '#3E9E58', '#E8B04A', '#7E4DE0', '#2E3870', '#C86A2A'][Math.floor(rnd() * 7)];
            if (rnd() < 0.08) { x0 += 6; continue; }
            p(x0, y0 + 24 - bh, bw, bh, K); p(x0 + 1, y0 + 25 - bh, bw - 2, bh - 1, col); p(x0 + 1, y0 + 28 - bh, bw - 2, 1, shade(col, 0.45));
            x0 += bw;
          } else {
            if (rnd() < 0.15) { x0 += 9; continue; }
            const big = rnd() < 0.35; bottle(p, x0, y0 + (big ? 10 : 13), BOTTLES[Math.floor(rnd() * BOTTLES.length)], big); x0 += big ? 12 : 10;
          }
        }
      }
    });
  }
  function counter(w, top) {   // 가게 계산대 (앞면 판자 + 위에 물건)
    const W = w * TS, Hh = 58;
    return spr(W, Hh, (p, x) => {
      p(0, 18, W, Hh - 18, K); p(2, 20, W - 4, Hh - 22, '#9A6338'); for (let i = 2; i < W - 4; i += 24) { p(i, 22, 1, Hh - 26, '#6B4226'); p(i + 1, 22, 2, Hh - 26, '#B07A48'); }
      p(2, Hh - 6, W - 4, 4, '#6B4226');
      p(0, 12, W, 10, K); p(2, 13, W - 4, 7, '#C89058'); p(2, 13, W - 4, 2, '#E0B07A');
      if (top === 'potion') { [[10, '#FF5A5F'], [24, '#4C7DFF'], [W - 30, '#3DDC84'], [W - 18, '#FFD23F']].forEach(([a, c]) => bottle(p, a, 2, c, false)); p(W / 2 + 30, 6, 18, 8, K); p(W / 2 + 31, 7, 16, 6, '#E8C07A'); }
      else if (top === 'book') { p(10, 4, 22, 10, K); p(11, 5, 20, 8, '#F5E2B8'); p(21, 5, 1, 8, '#B8834A'); p(W - 30, 2, 8, 12, K); p(W - 29, 3, 6, 10, '#FFE9A8'); p(W - 27, 0, 2, 3, '#FF9A3D'); p(W - 50, 8, 14, 6, '#7E4DE0'); p(W - 50, 6, 14, 2, K); }
    });
  }
  function barrel() { return spr(28, 36, p => { p(2, 2, 24, 32, K); p(4, 4, 20, 28, '#9A6338'); p(4, 4, 6, 28, '#B07A48'); p(18, 4, 6, 28, '#7A4A28'); [8, 26].forEach(y => { p(2, y, 24, 3, K); p(4, y, 20, 2, '#8A93C0'); }); p(5, 5, 18, 3, '#6B4226'); }); }
  function crate() { return spr(30, 30, p => { box(p, 0, 0, 30, 30, '#C89058', '#E0B07A', '#8A5A36'); p(3, 3, 24, 2, '#8A5A36'); p(3, 13, 24, 3, '#8A5A36'); for (let i = 4; i < 26; i += 3) p(i, 4 + i * 0.85, 3, 3, '#8A5A36'); }); }
  function plant() { return spr(30, 46, (p, x) => { p(7, 30, 16, 14, K); p(9, 32, 12, 10, '#C86A2A'); p(9, 32, 12, 3, '#E08A4A'); x.fillStyle = K; x.beginPath(); x.arc(15, 20, 13, 0, 7); x.fill(); x.fillStyle = '#3E9E45'; x.beginPath(); x.arc(15, 20, 11, 0, 7); x.fill(); x.fillStyle = '#5CC85A'; x.beginPath(); x.arc(11, 15, 5, 0, 7); x.fill(); p(14, 6, 2, 6, '#3E9E45'); p(19, 14, 3, 3, '#FF8AB0'); p(9, 22, 3, 3, '#FFE45C'); }); }
  function cauldron() { return spr(56, 44, (p, x) => { p(10, 34, 6, 10, K); p(40, 34, 6, 10, K); x.fillStyle = K; x.beginPath(); x.ellipse(28, 24, 27, 19, 0, 0, 7); x.fill(); x.fillStyle = '#3A3A4A'; x.beginPath(); x.ellipse(28, 24, 24, 16, 0, 0, 7); x.fill(); x.fillStyle = '#55556A'; x.beginPath(); x.ellipse(22, 26, 10, 9, 0, 0, 7); x.fill(); p(2, 10, 52, 6, K); p(4, 11, 48, 3, '#6A6A80'); x.fillStyle = '#3DDC84'; x.beginPath(); x.ellipse(28, 10, 22, 4, 0, 0, 7); x.fill(); x.fillStyle = '#9AF0B0'; x.beginPath(); x.ellipse(24, 9, 8, 2, 0, 0, 7); x.fill(); }); }
  function table(w, cloth) {
    const W = w * TS; return spr(W, 44, p => { p(6, 24, 6, 20, K); p(W - 12, 24, 6, 20, K); p(7, 24, 4, 19, '#6B4226'); p(W - 11, 24, 4, 19, '#6B4226'); p(0, 6, W, 22, K); p(2, 8, W - 4, 18, cloth || '#B07A48'); p(2, 8, W - 4, 4, shade(cloth || '#B07A48', 0.25)); if (cloth) for (let i = 4; i < W - 4; i += 8) p(i, 22, 4, 4, '#FFFFFF');
      p(W / 2 - 6, 0, 12, 10, K); p(W / 2 - 5, 1, 10, 8, '#F5E2B8'); p(W / 2 - 2, 2, 4, 3, '#C86A2A'); });
  }
  function chair() { return spr(22, 34, p => { p(2, 0, 18, 18, K); p(4, 2, 14, 14, '#9A6338'); p(4, 2, 14, 3, '#C89058'); p(0, 16, 22, 8, K); p(2, 17, 18, 5, '#B07A48'); p(3, 24, 4, 10, K); p(15, 24, 4, 10, K); }); }
  function bed() { return spr(70, 100, p => { box(p, 0, 0, 70, 22, '#8A5A36', '#B07A48'); p(0, 18, 70, 80, K); p(3, 20, 64, 76, '#F5E2B8'); p(8, 24, 54, 16, '#FFFFFF'); p(8, 36, 54, 4, '#D9E4FF'); p(3, 46, 64, 50, '#3E9E58'); p(3, 46, 64, 4, '#5CC85A'); for (let i = 8; i < 64; i += 14) for (let j = 54; j < 92; j += 14) p(i, j, 6, 6, '#358C3E'); p(0, 94, 70, 6, '#6B4226'); }); }
  function wardrobe() { return spr(64, 110, p => { box(p, 0, 0, 64, 110, '#8A5A36', '#B07A48', '#5A3A1E'); p(31, 6, 2, 96, K); p(6, 8, 22, 88, '#9A6338'); p(36, 8, 22, 88, '#9A6338'); p(25, 50, 3, 8, '#FFD23F'); p(36, 50, 3, 8, '#FFD23F'); p(0, 100, 64, 10, K); }); }
  function chest() { return spr(42, 34, p => { box(p, 0, 4, 42, 30, '#9A6338', '#C89058', '#6B4226'); p(0, 0, 42, 14, K); p(2, 2, 38, 10, '#B07A48'); p(2, 13, 38, 3, '#FFD23F'); p(18, 12, 6, 9, K); p(19, 13, 4, 6, '#FFD23F'); }); }
  function pedestal() { return spr(36, 64, (p, x) => { p(8, 30, 20, 34, K); p(10, 32, 16, 30, '#8A86A8'); p(10, 32, 4, 30, '#B8B4D0'); p(4, 26, 28, 8, K); p(6, 27, 24, 5, '#B8B4D0'); p(4, 58, 28, 6, K); x.fillStyle = K; x.beginPath(); x.arc(18, 16, 14, 0, 7); x.fill(); const g = x.createRadialGradient(14, 12, 2, 18, 16, 13); g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.4, '#C8A8FF'); g.addColorStop(1, '#5A3AA0'); x.fillStyle = g; x.beginPath(); x.arc(18, 16, 12, 0, 7); x.fill(); }); }
  function candle() { return spr(16, 52, p => { p(4, 20, 8, 30, K); p(5, 21, 6, 28, '#B8B4D0'); p(1, 46, 14, 6, K); p(2, 47, 12, 3, '#8A86A8'); p(5, 10, 6, 12, K); p(6, 11, 4, 10, '#FFF3D8'); }); }
  function desk(w) { const W = w * TS; return spr(W, 40, p => { p(0, 8, W, 16, K); p(2, 10, W - 4, 12, '#7A4A28'); p(2, 10, W - 4, 3, '#9A6338'); p(4, 24, 5, 16, K); p(W - 9, 24, 5, 16, K); p(10, 0, 18, 10, K); p(11, 1, 16, 8, '#F5E2B8'); p(W - 30, 2, 10, 8, '#3E7BD8'); p(W - 30, 2, 10, 2, K); p(W - 18, 0, 3, 10, '#FFFFFF'); }); }
  function pillar() { return spr(40, 132, p => { p(0, 0, 40, 14, K); p(2, 2, 36, 10, '#E8E4F0'); p(4, 12, 32, 108, K); p(6, 12, 28, 108, '#D8D4E0'); for (let i = 10; i < 32; i += 7) p(i, 14, 2, 104, '#B8B2C8'); p(6, 12, 4, 108, '#F4F2F8'); p(0, 118, 40, 14, K); p(2, 120, 36, 10, '#E8E4F0'); }); }
  function throne() { return spr(80, 104, p => { p(8, 0, 64, 70, K); p(11, 3, 58, 64, '#B0202A'); p(11, 3, 58, 8, '#D8404A'); p(24, 0, 32, 10, K); p(26, 0, 6, 8, '#FFD23F'); p(37, 0, 6, 8, '#FFD23F'); p(48, 0, 6, 8, '#FFD23F'); p(0, 52, 80, 30, K); p(3, 55, 74, 24, '#FFD23F'); p(3, 55, 74, 5, '#FFF3B0'); p(3, 74, 74, 5, '#C8A020'); p(0, 30, 14, 52, K); p(66, 30, 14, 52, K); p(3, 33, 9, 46, '#E8C040'); p(68, 33, 9, 46, '#E8C040'); p(6, 82, 8, 22, K); p(66, 82, 8, 22, K); p(36, 20, 8, 8, '#5AD8F5'); }); }
  function banner(col) { return spr(34, 80, p => { p(0, 0, 34, 6, K); p(2, 1, 30, 3, '#FFD23F'); p(3, 6, 28, 64, K); p(5, 6, 24, 62, col); p(5, 6, 24, 4, shade(col, 0.3)); p(3, 66, 12, 12, K); p(19, 66, 12, 12, K); p(5, 66, 9, 9, col); p(20, 66, 9, 9, col); p(12, 24, 10, 10, '#FFD23F'); p(14, 26, 6, 6, shade(col, -0.2)); p(16, 36, 2, 16, '#FFD23F'); }); }
  function windowW(night) { return spr(56, 60, p => { p(0, 0, 56, 60, K); p(3, 3, 50, 54, '#7A4A28'); p(7, 7, 42, 46, night ? '#2E3870' : '#9AD8F5'); p(7, 7, 42, 14, night ? '#3E4A90' : '#BDE8FF'); p(26, 7, 4, 46, '#7A4A28'); p(7, 27, 42, 4, '#7A4A28'); p(11, 11, 6, 3, '#FFFFFF'); p(0, 54, 56, 6, K); p(2, 55, 52, 4, '#B07A48'); p(6, 46, 8, 8, '#FF8AB0'); p(40, 46, 8, 8, '#FFE45C'); }); }
  function stained() { return spr(150, 76, (p, x) => { p(0, 0, 150, 76, K); const cols = ['#7E4DE0', '#3E7BD8', '#FFD23F', '#D2343A', '#3DDC84', '#5AD8F5']; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) p(4 + i * 29, 4 + j * 23, 26, 20, cols[(i + j * 2) % 6]); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(75, 38, 22, 0, 7); x.fill(); p(73, 10, 4, 56, K); p(47, 36, 56, 4, K); }); }
  function fireplace() { return spr(128, 104, p => { p(0, 0, 128, 104, K); p(3, 3, 122, 98, '#8A86A8'); for (let j = 3; j < 100; j += 12) for (let i = 3 + (j % 24 ? 0 : 10); i < 124; i += 20) p(i, j, 18, 10, '#9E9ABA'); p(0, 26, 128, 10, K); p(2, 28, 124, 6, '#6B4226'); p(26, 44, 76, 60, K); p(30, 48, 68, 56, '#2A1A14'); p(36, 92, 56, 8, '#6B4226'); p(10, 12, 12, 14, '#D2343A'); p(104, 14, 10, 12, '#3E7BD8'); p(56, 14, 16, 12, '#FFD23F'); }); }
  function mapFrame() { return spr(80, 56, p => { p(0, 0, 80, 56, K); p(3, 3, 74, 50, '#B07A48'); p(6, 6, 68, 44, '#F5E2B8'); p(12, 14, 20, 12, '#7CC66A'); p(36, 22, 26, 14, '#4FA8E8'); p(18, 32, 12, 10, '#B0804A'); p(30, 20, 30, 2, '#D2343A'); p(58, 12, 6, 6, '#D2343A'); }); }
  function herbs() { return spr(60, 34, p => { p(0, 0, 60, 3, K); for (let i = 4; i < 56; i += 12) { p(i + 3, 3, 1, 8, K); p(i, 10, 8, 18, '#3E9E45'); p(i + 1, 12, 3, 12, '#5CC85A'); p(i + 2, 26, 4, 6, '#358C3E'); } }); }
  /* v144 훈련장 소품 */
  function scenery(w, h, rnd) {   // 창 너머 풍경 (하늘 · 산 · 소나무 · 성곽)
    return spr(w, h, (p, x) => {
      p(0, 0, w, h, K); const g = x.createLinearGradient(0, 3, 0, h - 3); g.addColorStop(0, '#5AB8F5'); g.addColorStop(1, '#BDE8FF'); x.fillStyle = g; x.fillRect(3, 3, w - 6, h - 6);
      p(12 + rnd() * (w - 60), 9, 22, 5, '#FFFFFF'); p(18 + rnd() * (w - 60), 15, 30, 5, '#FFFFFF');
      x.fillStyle = '#5A8A6A'; x.beginPath(); x.moveTo(3, h - 16); for (let i = 0; i <= 6; i++) x.lineTo(3 + (w - 6) * i / 6, h - 26 - (i % 2 ? 16 : 4) - rnd() * 8); x.lineTo(w - 3, h - 3); x.lineTo(3, h - 3); x.fill();
      x.fillStyle = '#3E9E58'; x.beginPath(); x.moveTo(3, h - 10); for (let i = 0; i <= 8; i++) x.lineTo(3 + (w - 6) * i / 8, h - 16 - (i % 2 ? 8 : 2)); x.lineTo(w - 3, h - 3); x.lineTo(3, h - 3); x.fill();
      p(3, h - 9, w - 6, 6, '#B89A6A'); for (let i = 6; i < w - 10; i += 14) p(i, h - 13, 8, 5, '#B89A6A');   // 성벽
      for (let i = 0; i < 2; i++) { const tx = 10 + rnd() * (w - 30); p(tx + 5, h - 24, 3, 14, '#6B4226'); x.fillStyle = '#2E7A3E'; x.beginPath(); x.moveTo(tx - 2, h - 20); x.lineTo(tx + 6, h - 34); x.lineTo(tx + 15, h - 20); x.fill(); }
      p(w / 2 - 2, 3, 4, h - 6, '#7A4A28'); p(3, h / 2 - 2, w - 6, 4, '#7A4A28');   // 창살
    });
  }
  function rack() {   // 무기 걸이 (창 · 칼 · 활)
    return spr(84, 92, p => {
      p(4, 10, 6, 82, K); p(74, 10, 6, 82, K); p(5, 11, 4, 80, '#9A6338'); p(75, 11, 4, 80, '#9A6338');
      p(0, 20, 84, 8, K); p(2, 21, 80, 5, '#B07A48'); p(0, 66, 84, 8, K); p(2, 67, 80, 5, '#B07A48');
      [16, 30].forEach(a => { p(a, 0, 4, 90, K); p(a + 1, 6, 2, 84, '#C89058'); p(a - 2, 0, 8, 8, '#B8C4E8'); p(a, 0, 4, 3, '#FFFFFF'); });   // 창
      [46, 58].forEach(a => { p(a, 30, 5, 58, K); p(a + 1, 32, 3, 44, '#D9E4FF'); p(a - 3, 74, 11, 4, '#FFD23F'); p(a + 1, 78, 3, 10, '#6B4226'); });   // 칼
      p(68, 8, 3, 76, '#7A4A28'); p(66, 8, 3, 4, K); p(66, 80, 3, 4, K);   // 활
    });
  }
  function target() {   // 과녁
    return spr(60, 80, (p, x) => {
      p(27, 44, 6, 36, K); p(28, 45, 4, 34, '#9A6338'); p(12, 72, 36, 6, K);
      [[28, K], [26, '#FFFFFF'], [20, '#D2343A'], [14, '#FFFFFF'], [8, '#3E7BD8'], [4, '#FFD23F']].forEach(([r, col]) => { x.fillStyle = col; x.beginPath(); x.arc(30, 28, r, 0, 7); x.fill(); });
      p(29, 8, 2, 12, '#6B4226'); p(36, 22, 10, 2, '#6B4226');   // 꽂힌 화살
    });
  }
  function drum() {   // 북
    return spr(56, 58, (p, x) => {
      p(6, 40, 6, 18, K); p(44, 40, 6, 18, K);
      x.fillStyle = K; x.beginPath(); x.ellipse(28, 28, 27, 24, 0, 0, 7); x.fill(); x.fillStyle = '#D2343A'; x.beginPath(); x.ellipse(28, 28, 24, 21, 0, 0, 7); x.fill();
      x.fillStyle = '#F5E2B8'; x.beginPath(); x.ellipse(28, 16, 22, 9, 0, 0, 7); x.fill(); x.fillStyle = '#3E7BD8'; x.beginPath(); x.arc(28, 16, 5, 0, 7); x.fill();
      for (let i = 8; i < 50; i += 7) p(i, 32, 3, 3, '#FFD23F');
    });
  }
  function stones() {   // 들돌 (힘 기르는 돌)
    return spr(64, 34, (p, x) => { [[16, 22, 14], [42, 24, 11], [30, 12, 9]].forEach(([a, b, r]) => { x.fillStyle = K; x.beginPath(); x.ellipse(a, b, r + 2, r * 0.8 + 2, 0, 0, 7); x.fill(); x.fillStyle = '#8A86A8'; x.beginPath(); x.ellipse(a, b, r, r * 0.8, 0, 0, 7); x.fill(); x.fillStyle = '#B8B4D0'; x.beginPath(); x.ellipse(a - r * 0.3, b - r * 0.3, r * 0.4, r * 0.25, 0, 0, 7); x.fill(); }); });
  }
  function torch() { return spr(16, 34, p => { p(5, 12, 6, 20, K); p(6, 13, 4, 18, '#6B4226'); p(2, 10, 12, 5, K); p(3, 11, 10, 3, '#8A86A8'); }); }

  /* ---------- 실내 바닥·벽 ---------- */
  const STYLE = {
    potion: { floor: '#B07A48', floor2: '#9A6338', wall: '#E8D2A8', beam: '#7A4A28', base: '#8A5A36', kind: 'wood', light: '#FFD9A0' },
    school: { floor: '#5A5480', floor2: '#4A4470', wall: '#3E3870', beam: '#2A2650', base: '#2A2650', kind: 'stone', light: '#C8A8FF' },
    chief: { floor: '#A8743E', floor2: '#946434', wall: '#D9C08F', beam: '#6B4226', base: '#6B4226', kind: 'wood', light: '#FFC878' },
    train: { floor: '#C8935A', floor2: '#B07A48', wall: '#E8D2A8', beam: '#6B4226', base: '#5A3A1E', kind: 'wood', light: '#FFE2A8' },   // v144 훈련장
    castle: { floor: '#D8D4E0', floor2: '#BCB6CC', wall: '#6A6478', beam: '#4A4458', base: '#3A3448', kind: 'marble', light: '#FFE9A8' }
  };
  function paintRoom(map, st) {
    const W = RW * TS, Hh = RH * TS, [c, x] = mk(W, Hh), p = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); }, rnd = seeded('room-' + map.id);
    // 바닥
    for (let ty = 3; ty < RH; ty++) for (let tx = 0; tx < RW; tx++) {
      const X = tx * TS, Y = ty * TS;
      if (st.kind === 'wood') { const off = (ty % 2) * 16; p(X, Y, TS, TS, st.floor); p(X, Y + 15, TS, 2, st.floor2); p(X, Y + 31, TS, 1, shade(st.floor, -0.25)); p(X + ((off + 8) % 32), Y, 2, 15, shade(st.floor, -0.2)); p(X + ((off + 24) % 32), Y + 16, 2, 15, shade(st.floor, -0.2)); if (rnd() < 0.3) p(X + 6 + rnd() * 18, Y + 6 + rnd() * 20, 3, 1, shade(st.floor, 0.18)); }
      else if (st.kind === 'stone') { p(X, Y, TS, TS, (tx + ty) % 2 ? st.floor : st.floor2); p(X, Y, TS, 2, shade(st.floor, 0.12)); p(X, Y, 2, TS, shade(st.floor, 0.08)); p(X, Y + 30, TS, 2, shade(st.floor, -0.3)); if (rnd() < 0.2) p(X + 8 + rnd() * 14, Y + 8 + rnd() * 14, 4, 2, shade(st.floor, -0.2)); }
      else { p(X, Y, TS, TS, (tx + ty) % 2 ? st.floor : st.floor2); p(X + 2, Y + 2, 10, 2, 'rgba(255,255,255,.5)'); p(X, Y + 31, TS, 1, shade(st.floor, -0.25)); }
    }
    // 뒷벽 (위 3줄)
    p(0, 0, W, 3 * TS, st.wall);
    if (st.kind === 'stone' || st.kind === 'marble') { for (let j = 0; j < 3 * TS - 8; j += 16) for (let i = (j / 16) % 2 ? 0 : -16; i < W; i += 32) { p(i, j, 32, 16, K); p(i + 1, j + 1, 30, 14, shade(st.wall, rnd() * 0.1 - 0.02)); p(i + 1, j + 1, 30, 2, shade(st.wall, 0.15)); } }
    else { for (let i = 0; i < W; i += 96) { p(i, 0, 10, 3 * TS, st.beam); p(i + 2, 0, 2, 3 * TS, shade(st.beam, 0.2)); } p(0, 30, W, 6, st.beam); p(0, 30, W, 2, shade(st.beam, 0.2)); for (let i = 0; i < 40; i++) p(rnd() * W, 40 + rnd() * 40, 2, 2, shade(st.wall, -0.06)); }
    p(0, 0, W, 6, K); p(0, 3 * TS - 12, W, 12, st.base); p(0, 3 * TS - 12, W, 2, shade(st.base, 0.25)); p(0, 3 * TS, W, 6, 'rgba(0,0,0,.28)');
    // 옆벽
    [0, W - 12].forEach(a => { p(a, 0, 12, Hh, shade(st.beam, -0.2)); p(a === 0 ? 10 : a, 0, 2, Hh, K); });
    // 앞벽 (맨 아래 줄) + 문
    const dx0 = map.exit.x0 * TS, dx1 = (map.exit.x1 + 1) * TS, Y = (RH - 1) * TS;
    p(0, Y + 8, W, TS - 8, shade(st.beam, -0.2)); p(0, Y + 6, W, 3, K);
    p(dx0 - 6, Y, dx1 - dx0 + 12, TS, K); p(dx0, Y, dx1 - dx0, TS, '#FFF3C2'); p(dx0 + 4, Y + 4, dx1 - dx0 - 8, TS - 8, '#D2343A'); p(dx0 + 4, Y + 4, dx1 - dx0 - 8, 3, '#E8606A'); for (let i = dx0 + 8; i < dx1 - 8; i += 8) p(i, Y + 12, 4, 12, '#B0202A');
    return c;
  }

  /* ---------- v129 그림 실내 (img/v79/room_<종류>.png · 832×480 = 26×15칸) ----------
   *   solid: [x, y, 너비, 높이] 칸 (벽 3줄 · 옆·아래 벽 · 문은 자동) · npc: 그림 속 사람 발(x, y)·머리 위(top) · talk: 말 거는 자리
   *   glows: [칸 x, 칸 y, 반지름, 색] (촛불·창문 빛이 살짝 일렁이게) */
  const PIC = {
    castle: {   // v130 도원수 진영 (파수꾼 둘은 그림에서 지우고 npc_guard 그림으로 따로 세움)
      solid: [[0, 3, 26, 2], [8, 5, 4, 4], [14, 5, 4, 4], [12, 5, 2, 3], [1, 5, 4, 5], [21, 5, 4, 5], [5, 5, 2, 8], [19, 5, 2, 8], [1, 9, 1, 2], [0, 11, 3, 3], [23, 10, 3, 4], [21, 11, 1, 2], [9, 9, 1, 1], [16, 9, 1, 1]],
      npc: { x: 13 * TS, y: 5.6 * TS, top: 112 }, talk: { x: 13 * TS, y: 8.7 * TS, r: 70 },
      extra: [{ key: 'guard', x: 9.6 * TS, y: 9.4 * TS, talk: { x: 9.6 * TS, y: 10.4 * TS, r: 46 }, guard: true, face: 1 }, { key: 'guard', x: 16.5 * TS, y: 9.4 * TS, talk: { x: 16.5 * TS, y: 10.4 * TS, r: 46 }, guard: true, face: -1 }],
      glows: [[1.5, 3.3, 80, '#FFB13D'], [6.8, 3.3, 80, '#FFB13D'], [19, 3.3, 80, '#FFB13D'], [24.5, 3.3, 80, '#FFB13D'], [10, 1.7, 50, '#FFD27A'], [16, 1.7, 50, '#FFD27A'], [24, 1.6, 50, '#FFD27A']]
    },
    potion: {   // v130 약방
      solid: [[0, 3, 26, 3], [9, 6, 9, 2], [1, 6, 5, 2], [3, 8, 4, 3], [6, 9, 2, 2], [2, 9, 1, 2], [1, 10, 2, 1], [1, 11, 6, 3], [7, 12, 2, 2], [20, 5, 2, 2], [23, 6, 2, 2], [20, 7, 5, 4], [23, 11, 2, 2], [17, 13, 3, 1], [20, 12, 5, 2], [12, 9, 2, 2]],
      npc: { x: 13 * TS, y: 5.8 * TS, top: 136 }, talk: { x: 13 * TS, y: 8.4 * TS, r: 66 },
      glows: [[9, 2.2, 90, '#FFE2A8'], [17.5, 2.2, 90, '#FFE2A8'], [5, 10.3, 100, '#FF9A3D'], [5, 8.6, 70, '#FFD27A']]
    },
    chief: {
      solid: [[0, 3, 26, 1], [22, 4, 4, 1], [11, 4, 6, 2], [17, 4, 1, 1], [11, 7, 4, 2], [2, 6, 6, 4], [1, 10, 1, 1], [1, 12, 2, 2], [3, 12, 2, 2], [24, 7, 1, 5], [23, 10, 1, 2], [19, 12, 4, 2], [23, 12, 2, 2]],
      npc: { x: 13 * TS, y: 5.4 * TS, top: 108 }, talk: { x: 13 * TS, y: 6.6 * TS, r: 66 },
      glows: [[21, 1.6, 110, '#FFD9A0'], [2, 12.6, 70, '#FF9A3D'], [13, 4, 120, '#FFC878']]
    },
    school: {
      solid: [[0, 3, 26, 2], [0, 5, 3, 1], [23, 5, 3, 1], [10, 5, 6, 2], [8, 6, 1, 1], [18, 6, 1, 1], [3, 7, 3, 2], [1, 8, 1, 2], [24, 7, 2, 4], [1, 10, 1, 2], [2, 11, 3, 1], [21, 11, 3, 1], [8, 12, 1, 1], [18, 12, 1, 1], [1, 12, 1, 2], [2, 13, 3, 1], [24, 11, 1, 3], [22, 13, 2, 1]],
      npc: { x: 13 * TS, y: 5.2 * TS, top: 90 }, talk: { x: 13 * TS, y: 7.5 * TS, r: 66 },
      glows: [[8.5, 5.5, 60, '#FFD27A'], [18.5, 5.5, 60, '#FFD27A'], [8.5, 11.6, 60, '#FFD27A'], [18.5, 11.6, 60, '#FFD27A'], [14.7, 4.3, 50, '#FFD27A'], [25, 7.2, 50, '#FFD27A'], [0.9, 8, 50, '#FFD27A'], [4.5, 7.2, 90, '#C8A8FF'], [13, 9.3, 120, '#B48CFF']]
    }
  };
  ['room_chief', 'room_school', 'room_potion', 'room_castle', 'npc_guard'].forEach(n => P.img79(n));   // 미리 불러 둠

  /* ---------- 실내 만들기 ---------- */
  const roomCache = {};
  function getRoom(type, region) {
    const id = 'room-' + type + '-' + region; if (roomCache[id]) return roomCache[id];
    const R = D.REGIONS[region], st = STYLE[type], rnd = seeded(id), B = D.BUILDINGS.concat([D.CASTLE]).find(b => b.type === type);
    const t = new Uint8Array(RW * RH), at = (x, y) => (x < 0 || y < 0 || x >= RW || y >= RH ? 2 : t[y * RW + x]), set = (x, y, v) => { if (x >= 0 && y >= 0 && x < RW && y < RH) t[y * RW + x] = v; };
    const M = { id, kind: 'room', region, name: B ? B.name : type, type };
    const map = { id, M, R, w: RW, h: RH, t, at, set, mid: 9, room: type, buildings: [], doors: [], spawns: [], objs: [], water: [], glows: [], fx: [], npcs: [], exitL: null, exitR: null, exit: { x0: 12, x1: 13, y: RH - 1 } };
    // 벽: 위 3줄 · 옆 1줄 · 아래 1줄 (문 2칸 빼고)
    for (let x = 0; x < RW; x++) { for (let y = 0; y < 3; y++) set(x, y, 2); set(x, RH - 1, x >= map.exit.x0 && x <= map.exit.x1 ? 1 : 2); }
    for (let y = 0; y < RH; y++) { set(0, y, 2); set(RW - 1, y, 2); }
    const solid = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, 2); };
    // obj: 그림을 칸 (tx, ty) 의 아래쪽(바닥 선 = by)에 맞춤 · sy = 앞뒤 순서
    const put = (img, tx, by, opt) => { opt = opt || {}; const ox = opt.cx != null ? opt.cx - img.width / 2 : tx * TS + (opt.dx || 0); map.objs.push({ img, x: Math.round(ox), y: Math.round(by - img.height + (opt.dy || 0)), sy: opt.sy != null ? opt.sy : by, kind: 'furn' }); };
    const wall = (img, cx, by) => put(img, 0, by, { cx, sy: -1 });      // 벽에 붙은 것 (항상 뒤)
    const NP = D.NPCS;
    const npc = (key, x, y, talk, extra) => map.npcs.push(Object.assign({ key, def: D.npcDef(NP[key], region), x, y, talk, face: 1, ph: rnd() * 6 }, extra || {}));

    // v129 선생님 그림 실내 (이장 댁 · 도술 서원) — 그림을 통째로 바닥으로 쓰고, 가구 자리만 막음. 사람은 그림 속에 있음(baked: 이름·느낌표만 그림)
    const pic = PIC[type] && P.img79('room_' + type, () => { delete roomCache[id]; });
    if (pic) {
      const Q = PIC[type];
      Q.solid.forEach(r => solid(r[0], r[1], r[2], r[3]));
      map.npcs.push({ key: type, def: D.npcDef(NP[type], region), x: Q.npc.x, y: Q.npc.y, topY: Q.npc.top, talk: Q.talk, face: 1, ph: rnd() * 6, baked: true });
      (Q.extra || []).forEach(e => map.npcs.push(Object.assign({ def: D.npcDef(NP[e.key], region), ph: rnd() * 6 }, e)));
      Q.glows.forEach(g => map.glows.push({ x: g[0] * TS, y: g[1] * TS, r: g[2], col: g[3] }));
      const [gc, gx] = mk(RW * TS, RH * TS); gx.imageSmoothingEnabled = true; gx.imageSmoothingQuality = 'high'; gx.drawImage(pic, 0, 0, RW * TS, RH * TS);
      map.ground = gc; map.mini = gc; map.pic = true;
      map.startL = { x: 13 * TS, y: 13.5 * TS };
      roomCache[id] = map; const ids0 = Object.keys(roomCache); if (ids0.length > 6) delete roomCache[ids0[0]];
      return map;
    }

    if (type === 'potion') {
      wall(shelf(4, 'potion', rnd), 3.5 * TS, 3 * TS + 6); solid(1, 3, 5, 1);
      wall(shelf(4, 'potion', rnd), 22.5 * TS, 3 * TS + 6); solid(20, 3, 5, 1);
      wall(windowW(false), 8 * TS, 2.4 * TS); wall(windowW(false), 18 * TS, 2.4 * TS);
      wall(shelf(6, 'potion', rnd), 13 * TS, 3 * TS + 22); solid(10, 3, 6, 1);
      wall(herbs(), 13 * TS, 1.1 * TS);
      put(counter(8, 'potion'), 9, 7 * TS + 2); solid(9, 6, 8, 1);
      npc('potion', 13 * TS, 5.7 * TS, { x: 13 * TS, y: 7.5 * TS, r: 64 });
      put(cauldron(), 0, 10 * TS + 4, { cx: 4 * TS }); solid(3, 9, 2, 1); map.fx.push({ type: 'cauldron', x: 4 * TS, y: 9 * TS - 4 });
      put(barrel(), 21, 10 * TS); put(barrel(), 22, 10 * TS - 4, { dx: 4 }); solid(21, 9, 2, 1);
      put(crate(), 23, 12 * TS); put(crate(), 23, 11 * TS - 10, { dx: 2, sy: 12 * TS + 1 }); solid(23, 11, 1, 1);
      put(plant(), 1, 13 * TS + 4); solid(1, 12, 1, 1); put(plant(), 24, 8 * TS); solid(24, 7, 1, 1);
      map.rug = { x: 9.5 * TS, y: 9 * TS, w: 7 * TS, h: 3.5 * TS, col: '#B0202A', col2: '#FFD23F' };
      map.glows.push({ x: 4 * TS, y: 9 * TS, r: 90, col: '#3DDC84' });
    } else if (type === 'school') {
      [[3, 4], [8, 3], [18, 3], [22.5, 4]].forEach(([cx, w]) => { wall(shelf(w, 'book', rnd), cx * TS, 3 * TS + 6); solid(Math.round(cx - w / 2), 3, w, 1); });
      wall(stained(), 13 * TS, 2.5 * TS);
      put(counter(5, 'book'), 0, 6 * TS + 2, { cx: 13 * TS }); solid(11, 5, 4, 1);
      npc('school', 13 * TS, 4.75 * TS, { x: 13 * TS, y: 6.6 * TS, r: 62 });
      map.fx.push({ type: 'circle', x: 13 * TS, y: 9.6 * TS, r: 86 });
      put(pedestal(), 0, 9 * TS, { cx: 4.5 * TS }); solid(4, 8, 1, 1); map.glows.push({ x: 4.5 * TS, y: 7.6 * TS, r: 80, col: '#C8A8FF' });
      [[8, 6], [18, 6], [8, 12], [18, 12]].forEach(([a, b]) => { put(candle(), 0, (b + 1) * TS - 2, { cx: (a + 0.5) * TS }); solid(a, b, 1, 1); map.fx.push({ type: 'flame', x: (a + 0.5) * TS, y: (b + 1) * TS - 46 }); map.glows.push({ x: (a + 0.5) * TS, y: (b + 1) * TS - 46, r: 60, col: '#FFD27A' }); });
      put(desk(3), 2, 12 * TS + 2); solid(2, 11, 3, 1); put(desk(3), 21, 12 * TS + 2); solid(21, 11, 3, 1);
      put(chair(), 0, 13 * TS + 2, { cx: 3.5 * TS }); put(chair(), 0, 13 * TS + 2, { cx: 22.5 * TS });
      map.fx.push({ type: 'books', x: 20 * TS, y: 8 * TS });
    } else if (type === 'chief') {
      wall(fireplace(), 13 * TS, 3 * TS + 8); solid(11, 3, 4, 1); map.fx.push({ type: 'fire', x: 13 * TS, y: 3 * TS - 4 }); map.glows.push({ x: 13 * TS, y: 3 * TS - 10, r: 150, col: '#FF9A3D' });
      wall(windowW(false), 4 * TS, 2.4 * TS); wall(windowW(false), 21 * TS, 2.4 * TS); wall(mapFrame(), 8 * TS, 2.1 * TS);
      put(wardrobe(), 1, 4 * TS + 6); solid(1, 3, 2, 1);
      put(bed(), 21, 6 * TS + 4, { dx: 4 }); solid(21, 3, 3, 3);
      map.rug = { x: 8 * TS, y: 5.5 * TS, w: 10 * TS, h: 5.5 * TS, col: '#3E9E58', col2: '#FFE9A8' };
      npc('chief', 13 * TS, 5.4 * TS, { x: 13 * TS, y: 6.7 * TS, r: 66 }); solid(12, 4, 2, 1);
      put(table(4, '#FFFFFF'), 3, 9 * TS); solid(3, 8, 4, 1);
      put(chair(), 0, 9 * TS, { cx: 2.4 * TS }); put(chair(), 0, 9 * TS, { cx: 7.6 * TS }); solid(2, 8, 1, 1); solid(7, 8, 1, 1);
      put(chest(), 1, 12 * TS); solid(1, 11, 1, 1); put(plant(), 24, 12 * TS + 4); solid(24, 11, 1, 1); put(plant(), 6, 4 * TS + 4); solid(6, 3, 1, 1);
      put(barrel(), 3, 13 * TS); solid(3, 12, 1, 1); put(crate(), 22, 12 * TS + 2); solid(22, 11, 1, 1);
    } else if (type === 'train') {   // v144 훈련장: 창 너머 풍경 · 무기 걸이 · 과녁 · 북 · 가운데 허수아비(game.js 가 몬스터 자리로 세움)
      M.train = true;
      [5, 13, 21].forEach(cx => wall(scenery(150, 70, rnd), cx * TS, 2.55 * TS));
      [[9, '#D2343A'], [17, '#3E7BD8']].forEach(([cx, col]) => wall(banner(col), cx * TS, 2.7 * TS));
      put(rack(), 0, 6 * TS + 6, { cx: 2.6 * TS }); solid(1, 4, 3, 2);
      put(rack(), 0, 6 * TS + 6, { cx: 23.4 * TS }); solid(22, 4, 3, 2);
      put(target(), 0, 11 * TS, { cx: 2.5 * TS }); solid(2, 10, 1, 1);
      put(target(), 0, 11 * TS, { cx: 23.5 * TS }); solid(23, 10, 1, 1);
      put(drum(), 0, 13.6 * TS, { cx: 3 * TS }); solid(2, 12, 2, 2);
      put(stones(), 0, 13.5 * TS, { cx: 22.8 * TS }); solid(22, 12, 2, 2);
      put(barrel(), 5, 5 * TS + 4); solid(5, 4, 1, 1); put(barrel(), 20, 5 * TS + 4); solid(20, 4, 1, 1);
      map.rug = { x: 7 * TS, y: 4.5 * TS, w: 12 * TS, h: 8 * TS, col: '#3E7BD8', col2: '#FFD23F' };
      set(12, 8, 4); set(13, 8, 4);   // 허수아비 받침: 4 = 못 걸어 들어가지만 마법은 지나감 (13 × TS, 9 × TS 에 섬)
      map.dummy = { x: 13 * TS, y: 9 * TS - 2 };
    } else {   // castle
      [[3, '#B0202A'], [7.5, '#3E4AC0'], [18.5, '#3E4AC0'], [23, '#B0202A']].forEach(([cx, col]) => wall(banner(col), cx * TS, 2.7 * TS));
      wall(stained(), 13 * TS, 2.1 * TS);
      map.rug = { x: 11.5 * TS, y: 3 * TS, w: 3 * TS, h: 11 * TS, col: '#B0202A', col2: '#FFD23F', carpet: true };
      map.dais = { x: 8 * TS, y: 3 * TS, w: 10 * TS, h: 3 * TS };
      put(throne(), 0, 5 * TS + 6, { cx: 13 * TS }); solid(12, 3, 2, 2);
      npc('castle', 13 * TS, 5.3 * TS, { x: 13 * TS, y: 6.8 * TS, r: 64 }, { scale: 1.15 });
      npc('guard', 9.5 * TS, 6.5 * TS, { x: 9.5 * TS, y: 7.6 * TS, r: 46 }, { guard: true }); solid(9, 5, 1, 1);
      npc('guard', 16.5 * TS, 6.5 * TS, { x: 16.5 * TS, y: 7.6 * TS, r: 46 }, { guard: true, face: -1 }); solid(16, 5, 1, 1);
      [[5, 7], [20, 7], [5, 11], [20, 11]].forEach(([a, b]) => { put(pillar(), 0, (b + 1) * TS, { cx: (a + 0.5) * TS }); solid(a, b, 1, 1); });
      [[2, 1.4], [10, 1.4], [16, 1.4], [24, 1.4]].forEach(([a, b]) => { wall(torch(), a * TS, (b + 1) * TS); map.fx.push({ type: 'flame', x: a * TS, y: (b + 1) * TS - 28 }); map.glows.push({ x: a * TS, y: (b + 1) * TS - 30, r: 80, col: '#FFB13D' }); });
    }
    map.objs.sort((a, b) => a.sy - b.sy);
    map.ground = paintRoom(map, st);
    // 깔개·카펫·단상은 바닥 그림에 바로 그림
    const x = map.ground.getContext('2d'), p = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    if (map.dais) { const d = map.dais; p(d.x - 4, d.y, d.w + 8, d.h + 6, K); p(d.x, d.y, d.w, d.h, '#8A86A8'); p(d.x, d.y + d.h - 8, d.w, 8, '#6A6478'); p(d.x, d.y, d.w, 3, '#B8B4D0'); }
    if (map.rug) { const r = map.rug; p(r.x - 2, r.y - 2, r.w + 4, r.h + 4, K); p(r.x, r.y, r.w, r.h, r.col); p(r.x + 6, r.y + 6, r.w - 12, r.h - 12, r.col2); p(r.x + 9, r.y + 9, r.w - 18, r.h - 18, r.col); if (!r.carpet) { for (let i = r.x + 18; i < r.x + r.w - 18; i += 24) for (let j = r.y + 18; j < r.y + r.h - 18; j += 24) { p(i, j, 8, 8, r.col2); p(i + 2, j + 2, 4, 4, shade(r.col, -0.2)); } } for (let i = r.x; i < r.x + r.w; i += 6) { p(i, r.y - 6, 2, 4, r.col2); p(i, r.y + r.h + 2, 2, 4, r.col2); } }
    map.objs.forEach(o => { if (o.sy > 0) { x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(o.x + o.img.width / 2, o.sy - 2, o.img.width * 0.45, 6, 0, 0, 7); x.fill(); } });
    map.startL = { x: 13 * TS, y: 13.5 * TS };
    map.mini = map.ground;
    roomCache[id] = map; const ids = Object.keys(roomCache); if (ids.length > 6) delete roomCache[ids[0]];
    return map;
  }

  /* ---------- 마을 사람 (마을마다 2명) ---------- */
  function villagers(map) {
    const V = D.VILLAGERS, r = map.M.region, a = V[r % V.length], b = V[(r + 1) % V.length];
    const spots = [[15, map.mid + 1.75], [24.5, map.mid + 1.6]];   // 큰길 위 (좌우로만 천천히 걸음)
    const folk = [a, b].map((d0, i) => ({ key: 'v' + i, def: D.npcDef(d0, r), x: spots[i][0] * TS, y: spots[i][1] * TS, hx: spots[i][0] * TS, hy: spots[i][1] * TS, face: i ? -1 : 1, ph: i * 3, wt: 1 + i, vx: 0, vy: 0, walker: true }));
    // v80 조선 병사·다친 병사·군의관 (world.js armyCamp 가 정한 자리 · 그림은 data.js ARMY)
    const army = (map.army || []).filter(q => D.ARMY && D.ARMY[q.k]).map((q, i) => ({ key: 'a' + i, def: D.ARMY[q.k], x: q.x * TS, y: q.y * TS, hx: q.x * TS, hy: q.y * TS,
      face: i % 2 ? -1 : 1, ph: i * 1.7, wt: 0.5 + i * 0.4, vx: 0, vy: 0, range: q.range || 0, spd: q.spd, still: !!q.still, walker: !q.still, guard: !!q.still }));
    return folk.concat(army);
  }

  Object.assign(P, { getRoom, npcSprite, npcPortrait, villagers, ROOM_W: RW, ROOM_H: RH });
})();
