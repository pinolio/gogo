/*
 * gogo?gogo! — 메카 대전 (선생님이 예전에 하던 온라인 로봇 대전 게임 방식을 참고해 새로 만든 게임)
 *  - 로봇 12종 (테라 연합 6 · 제노 군단 6) 중 하나를 골라 1:1 · 2:2 로 싸웁니다. AI 대전 · 온라인만 (오프라인 없음)
 *  - 우주 경기장: 미끄러지듯 움직이고(관성), 부스터(Shift·Space)로 빠르게 피함. 부스터와 무기는 에너지를 씀
 *  - 무기 3개: 1 근접 · 2 원거리 · 3 특수 (J·K·L 또는 1·2·3). 꾹 누르면 힘을 모아 3단계까지 강해짐
 *  - 조준은 가장 가까운 상대에게 자동 (휴대폰에서도 쉽게)
 *  - 7~12번 로봇 기술은 시중 게임 참고: 화염·로켓 점프·빙결 장판·회복 구역·은신·부메랑·연쇄 번개·블랙홀·거미줄·포탑
 *  - 상대 팀 로봇을 모두 쓰러뜨리면 승리. 시간이 끝나면 남은 체력(%) 합이 많은 팀 승리
 *  - 로봇·경기장 그림: Meshy AI 로 만든 그림을 줄여서 사용 (img/), 그림이 없으면 코드로 그린 도트 로봇
 */
(function () {
  'use strict';
  const S = window.GoSport;
  const W = 960, H = 540, M = 18, FPS = 60;
  const DIR = 'games/action/mecha/';
  const TEAM_COL = ['#FF6B70', '#5B8CFF'];

  /* ---------- 로봇 표 (밸런스 조정은 여기서) ----------
   * hp 체력 · spd 최고 속도 · r 몸 크기 · pref 컴퓨터가 좋아하는 거리
   * 무기 kind: melee(앞쪽 부채꼴) · spin(둘레 전체) · shot(탄) · mine(지뢰) · dash(돌진) · pull(끌어당기기) · shield(방패)
   *   cone(화염 부채꼴) · leap(로켓 점프) · zone(장판: ice 빙결 / heal 수리 / hole 블랙홀) · chain(연쇄 번개) · cloak(은신) · turret(포탑)
   *   탄 추가 효과: burn 화상 · slow 느림 · root 묶기 · heal 우리 편 회복 · explode 폭발 반지름 · boomerang 되돌아오는 시간
   *   cd 다시 쓰기까지(프레임, 60 = 1초) · en 에너지 · dmg 피해 · 힘 모으기 1단계마다 피해 ×1.5, 에너지 ×1.5 */
  const ROBOTS = [
    { id: 1, name: '볼트', team: '테라 연합', role: '속도형', color: '#FFD23F', hp: 80, spd: 4.1, r: 21, pref: 190,
      desc: '가장 빠른 로봇. 쌍발 블래스터와 유도 미사일로 치고 빠지기!',
      w: [{ name: '전기 단검', tip: '짧은 마비', kind: 'melee', range: 54, arc: 1.6, dmg: 7, stun: 8, cd: 18, en: 4, col: '#7FE3FF' },
          { name: '쌍발 블래스터', tip: '빠른 2연발', kind: 'shot', spd: 9, dmg: 4, count: 2, extra: 1, spread: 0.1, life: 55, rad: 4, cd: 14, en: 6, col: '#FFE45C' },
          { name: '유도 미사일', tip: '상대를 따라감', kind: 'shot', spd: 5.5, dmg: 9, count: 2, extra: 1, spread: 0.7, life: 150, rad: 6, homing: 0.07, cd: 150, en: 28, col: '#FF9A3D' }] },
    { id: 2, name: '타이탄', team: '테라 연합', role: '중장갑', color: '#FF9A3D', hp: 140, spd: 2.8, r: 26, pref: 80,
      desc: '느리지만 단단해요. 해머로 날려 버리고 지뢰를 깔아요.',
      w: [{ name: '해머 강타', tip: '크게 날려 보냄·마비', kind: 'melee', range: 66, arc: 1.8, dmg: 15, knock: 9, stun: 20, cd: 50, en: 10, col: '#FFD23F' },
          { name: '산탄포', tip: '가까이서 5발', kind: 'shot', spd: 8, dmg: 4, count: 5, extra: 2, spread: 0.5, life: 30, rad: 4, cd: 45, en: 12, col: '#FFB27A' },
          { name: '지뢰', tip: '뒤에 설치, 최대 3개', kind: 'mine', dmg: 22, blast: 75, cd: 110, en: 24, col: '#FF5A5F' }] },
    { id: 3, name: '레이븐', team: '테라 연합', role: '저격형', color: '#7FA2FF', hp: 100, spd: 3.3, r: 22, pref: 340,
      desc: '멀리서 레일 캐논 한 방! 힘을 모으면 장애물도 꿰뚫어요.',
      w: [{ name: '전기 충격', tip: '긴 마비', kind: 'melee', range: 48, arc: 2.2, dmg: 5, stun: 32, cd: 60, en: 10, col: '#7FE3FF' },
          { name: '레일 캐논', tip: '아주 빠른 한 방, 힘 모으면 관통', kind: 'shot', spd: 17, dmg: 17, count: 1, life: 60, rad: 6, pierce: true, cd: 50, en: 16, col: '#BFE6FF' },
          { name: '마비탄', tip: '맞으면 1초 넘게 마비', kind: 'shot', spd: 8, dmg: 3, count: 1, life: 90, rad: 8, stun: 70, cd: 160, en: 28, col: '#C792FF' }] },
    { id: 4, name: '스팅어', team: '제노 군단', role: '근접 독', color: '#B36BFF', hp: 100, spd: 4.0, r: 21, pref: 90,
      desc: '외계 곤충 로봇. 독을 묻히고 순간 돌진으로 파고들어요.',
      w: [{ name: '독 발톱', tip: '독(조금씩 피해)', kind: 'melee', range: 52, arc: 1.4, dmg: 6, poison: 120, cd: 20, en: 5, col: '#7DFF8A' },
          { name: '독침 3갈래', tip: '3발 + 독', kind: 'shot', spd: 9, dmg: 4, count: 3, extra: 0, spread: 0.32, life: 45, rad: 4, poison: 60, cd: 30, en: 9, col: '#7DFF8A' },
          { name: '돌진 찌르기', tip: '앞으로 순간 돌진', kind: 'dash', dist: 190, dmg: 14, cd: 140, en: 24, col: '#E3B3FF' }] },
    { id: 5, name: '메두사', team: '제노 군단', role: '범위형', color: '#3DDCC4', hp: 120, spd: 3.2, r: 23, pref: 160,
      desc: '촉수로 둘레를 휩쓸고, 멀리 있는 상대를 끌어당겨요.',
      w: [{ name: '촉수 회오리', tip: '내 둘레 전체 공격', kind: 'spin', range: 72, dmg: 8, knock: 6, cd: 40, en: 10, col: '#3DDCC4' },
          { name: '에너지 구체', tip: '느린 큰 탄, 맞으면 느려짐', kind: 'shot', spd: 5.5, dmg: 13, count: 1, life: 100, rad: 13, slow: 90, cd: 36, en: 11, col: '#FF7EB6' },
          { name: '끌어당기기', tip: '먼 상대를 내 앞으로', kind: 'pull', range: 380, dmg: 6, stun: 25, cd: 160, en: 26, col: '#FF7EB6' }] },
    { id: 6, name: '골렘', team: '제노 군단', role: '탱커', color: '#8FD16B', hp: 150, spd: 2.6, r: 26, pref: 90,
      desc: '바위 갑옷 로봇. 방패로 버티고 상대 에너지를 빨아들여요.',
      w: [{ name: '바위 창', tip: '길고 좁은 찌르기', kind: 'melee', range: 74, arc: 0.9, dmg: 12, knock: 7, cd: 36, en: 8, col: '#C9A15A' },
          { name: '흡수 빔', tip: '상대 에너지를 빼앗음', kind: 'shot', spd: 11, dmg: 5, count: 1, life: 42, rad: 5, drain: 18, cd: 28, en: 6, col: '#8FD16B' },
          { name: '바위 방패', tip: '받는 피해 70% 줄임', kind: 'shield', time: 150, cd: 300, en: 30, col: '#C9A15A' }] },
    /* ----- 7~12: 추가 로봇 (기술은 시중 게임을 참고: 괄호 안) ----- */
    { id: 7, name: '블레이즈', team: '테라 연합', role: '화염형', color: '#FF5A3D', hp: 105, spd: 3.4, r: 23, pref: 110,
      desc: '불꽃을 뿜어 태워요. 로켓 점프로 날아올라 내려찍기!',
      w: [{ name: '화염 방사', tip: '부채꼴 불, 화상', kind: 'cone', range: 105, arc: 0.9, dmg: 3, burn: 90, knock: 1, cd: 14, en: 5, col: '#FF7A3D' },        // 팀 포트리스 2 파이로 화염 방사기
          { name: '네이팜탄', tip: '터지며 주변에 불', kind: 'shot', spd: 6, dmg: 6, count: 1, extra: 1, spread: 0.25, life: 60, rad: 7, explode: 65, burn: 120, cd: 50, en: 14, col: '#FFB347' },   // 터지면 주변에 불
          { name: '로켓 점프', tip: '날아가 내려찍기(공중 무적)', kind: 'leap', dist: 220, dmg: 12, blast: 85, cd: 150, en: 26, col: '#FF5A3D' }] },    // 오버워치 파라 · 솔저 로켓 점프
    { id: 8, name: '프로스트', team: '테라 연합', role: '빙결 제어', color: '#8FD8FF', hp: 100, spd: 3.3, r: 22, pref: 200,
      desc: '얼음으로 느리게 만들고, 빙결 장판으로 꽁꽁 묶어요.',
      w: [{ name: '얼음 칼', tip: '맞으면 느려짐', kind: 'melee', range: 58, arc: 1.5, dmg: 8, slow: 70, cd: 20, en: 5, col: '#BFF0FF' },
          { name: '고드름 연사', tip: '3발, 느려짐', kind: 'shot', spd: 10, dmg: 4, count: 3, extra: 1, spread: 0.18, life: 50, rad: 4, slow: 25, cd: 30, en: 10, col: '#8FD8FF' },
          { name: '빙결 장판', tip: '상대 자리에 던져 얼림', kind: 'zone', zone: 'ice', r: 90, time: 160, throw: 170, freeze: 30, cd: 200, en: 30, col: '#BFF0FF' }] },  // 오버워치 메이 · 리그 오브 레전드 애니비아
    { id: 9, name: '엔젤', team: '테라 연합', role: '지원형', color: '#7DFFC4', hp: 105, spd: 3.6, r: 21, pref: 220,
      desc: '나노탄은 적은 다치고 우리 편은 고쳐요. 수리 구역에 서 있으면 체력 회복!',
      w: [{ name: '전기봉', tip: '짧은 마비', kind: 'melee', range: 52, arc: 1.6, dmg: 6, stun: 14, cd: 22, en: 5, col: '#7DFFC4' },
          { name: '나노탄', tip: '상대는 피해, 우리 편은 회복', kind: 'shot', spd: 10, dmg: 6, count: 1, extra: 1, spread: 0.15, life: 55, rad: 5, heal: 10, cd: 20, en: 8, col: '#B8FFE0' },
          { name: '수리 구역', tip: '서 있으면 체력 회복', kind: 'zone', zone: 'heal', r: 110, time: 200, throw: 0, cd: 300, en: 32, col: '#7DFFC4' }] },  // 오버워치 메르시·루시우 · 롤 소나
    { id: 10, name: '팬텀', team: '제노 군단', role: '암살자', color: '#C77DFF', hp: 100, spd: 4.4, r: 20, pref: 70,
      desc: '모습을 감추고 다가가 첫 공격 2배! 부메랑 칼날은 돌아와요.',
      w: [{ name: '그림자 베기', tip: '빠른 베기', kind: 'melee', range: 58, arc: 1.6, dmg: 11, cd: 18, en: 5, col: '#E3B3FF' },
          { name: '부메랑 칼날', tip: '돌아오며 한 번 더', kind: 'shot', spd: 8, dmg: 6, count: 1, extra: 1, spread: 0.3, life: 90, rad: 7, boomerang: 28, cd: 40, en: 10, col: '#C77DFF' },   // 젤다 부메랑
          { name: '그림자 은신', tip: '3초 투명, 첫 공격 2배', kind: 'cloak', time: 180, cd: 280, en: 28, col: '#C77DFF' }] },   // 롤 이블린·트위치 · 스타크래프트 클로킹
    { id: 11, name: '볼텍스', team: '제노 군단', role: '중력 제어', color: '#6B5BFF', hp: 105, spd: 3.0, r: 23, pref: 230,
      desc: '번개가 상대끼리 옮겨 다니고, 블랙홀로 한곳에 빨아들여요.',
      w: [{ name: '중력 펀치', tip: '아주 멀리 날려 보냄', kind: 'melee', range: 60, arc: 1.4, dmg: 9, knock: 13, cd: 34, en: 7, col: '#9A8CFF' },
          { name: '연쇄 번개', tip: '반드시 맞음, 옆 상대로 튐', kind: 'chain', range: 250, jump: 150, dmg: 8, hops: 1, stun: 4, cd: 46, en: 14, col: '#9AD0FF' },   // 디아블로 연쇄 번개
          { name: '블랙홀', tip: '가운데로 빨아들임', kind: 'zone', zone: 'hole', r: 140, time: 120, throw: 200, cd: 280, en: 34, col: '#6B5BFF' }] },     // 오버워치 자리야 중력자탄
    { id: 12, name: '스파이더', team: '제노 군단', role: '설치형', color: '#C9D63A', hp: 115, spd: 3.1, r: 24, pref: 230,
      desc: '거미줄로 발을 묶고, 자동 포탑을 세워 함께 싸워요.',
      w: [{ name: '다리 찌르기', tip: '단단한 찌르기', kind: 'melee', range: 62, arc: 1.2, dmg: 10, knock: 5, cd: 28, en: 6, col: '#E6F07A' },
          { name: '거미줄탄', tip: '1초 동안 발이 묶임', kind: 'shot', spd: 8, dmg: 4, count: 1, extra: 1, spread: 0.2, life: 60, rad: 6, root: 60, cd: 34, en: 10, col: '#F2F2F2' },
          { name: '포탑 설치', tip: '8초 동안 자동 사격', kind: 'turret', time: 480, rate: 26, dmg: 3, range: 330, hp: 30, cd: 300, en: 30, col: '#C9D63A' }] }     // 팀 포트리스 2 엔지니어 · 오버워치 토르비욘
  ];
  const ZK = ['ice', 'heal', 'hole'];
  const HP_MUL = 1.8;   // 체력 배율: 표의 hp × 1.8 이 실제 체력 (한 판이 너무 빨리 끝나지 않게, 평균 약 35초)
  const ROCKS = [[300, 150, 34], [660, 390, 34], [480, 270, 26], [190, 410, 22], [770, 130, 22]];   // 경기장 바위 (x, y, 반지름)
  const LV = { easy: { think: 22, err: 0.35, dodge: 0.08, charge: 0.1, aggro: 0.55 }, normal: { think: 12, err: 0.14, dodge: 0.35, charge: 0.35, aggro: 0.8 }, hard: { think: 6, err: 0.04, dodge: 0.7, charge: 0.6, aggro: 1 } };
  const cfg = () => window.GoSettings.get('mecha') || {};
  const img = name => S.image(DIR + 'img/' + name);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  /* ---------- 그림 ---------- */
  // 그림이 없을 때: 코드로 그린 도트 로봇 (위에서 본 모습, 오른쪽을 봄)
  const spr = {};
  function fallbackSprite(rb) {
    if (spr[rb.id]) return spr[rb.id];
    const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d');
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const dark = '#1D2340', base = rb.color, alien = rb.team === '제노 군단';
    px(5, 5, 14, 14, dark); px(6, 6, 12, 12, base);                       // 몸통
    px(6, 2, 8, 4, dark); px(7, 3, 6, 2, base); px(6, 18, 8, 4, dark); px(7, 19, 6, 2, base);   // 어깨
    if (alien) { px(17, 4, 6, 3, dark); px(17, 17, 6, 3, dark); px(18, 5, 5, 1, base); px(18, 18, 5, 1, base); }   // 발톱
    else { px(14, 3, 9, 3, dark); px(14, 18, 9, 3, dark); px(15, 4, 8, 1, '#D9DEF2'); px(15, 19, 8, 1, '#D9DEF2'); }  // 총
    px(12, 10, 5, 4, dark); px(13, 11, 3, 2, alien ? '#7DFF8A' : '#7FE3FF');  // 눈
    px(7, 7, 3, 2, 'rgba(255,255,255,.5)');
    return (spr[rb.id] = c);
  }
  function drawArena(ctx, bg) {
    if (S.ready(bg)) { ctx.imageSmoothingEnabled = false; ctx.drawImage(bg, 0, 0, W, H); ctx.fillStyle = 'rgba(8,10,28,.35)'; ctx.fillRect(0, 0, W, H); }
    else {
      ctx.fillStyle = '#0B0E24'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(91,140,255,.12)'; for (let x = 0; x < W; x += 48) ctx.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 48) ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = '#FFFFFF'; for (let i = 0; i < 70; i++) { const x = (i * 137) % W, y = (i * 251) % H; ctx.fillRect(x, y, i % 5 ? 1 : 2, i % 5 ? 1 : 2); }
    }
    ctx.strokeStyle = 'rgba(127,162,255,.55)'; ctx.lineWidth = 3; ctx.strokeRect(M - 4, M - 4, W - 2 * M + 8, H - 2 * M + 8);
    ROCKS.forEach(([x, y, r]) => {
      ctx.fillStyle = '#2A2442'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4A4170'; ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.15, r * 0.82, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6A5F96'; ctx.fillRect(x - r * 0.45, y - r * 0.4, r * 0.3, r * 0.2); ctx.fillRect(x + r * 0.1, y + r * 0.1, r * 0.22, r * 0.16);
    });
  }
  // 경기 중 로봇: Meshy 그림(옆모습, 오른쪽을 봄)은 돌리지 않고 왼쪽을 볼 때만 뒤집음. 조준 방향은 따로 화살표로 표시
  function drawRobot(ctx, rb, x, y, ang, scale, alpha) {
    const side = img('m' + rb.id + '_top.png'), size = rb.r * 2.9 * (scale || 1);
    ctx.save(); ctx.translate(x, y); if (alpha != null) ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = false;
    if (S.ready(side)) {
      const k = size * 1.45 / Math.max(side.naturalWidth, side.naturalHeight), w = side.naturalWidth * k, h = side.naturalHeight * k;
      if (Math.cos(ang) < 0) ctx.scale(-1, 1);
      ctx.drawImage(side, -w / 2, -h / 2, w, h);
    } else { ctx.rotate(ang); ctx.drawImage(fallbackSprite(rb), -size / 2, -size / 2, size, size); }
    ctx.restore();
  }
  function drawCard(ctx, rb, x, y, w, h) {
    const card = img('m' + rb.id + '_card.png');
    if (S.ready(card)) { const k = Math.min(w / card.naturalWidth, h / card.naturalHeight); ctx.imageSmoothingEnabled = false; ctx.drawImage(card, x + (w - card.naturalWidth * k) / 2, y + (h - card.naturalHeight * k) / 2, card.naturalWidth * k, card.naturalHeight * k); }
    else drawRobot(ctx, rb, x + w / 2, y + h / 2, -Math.PI / 2, Math.min(w, h) / (rb.r * 3.2));
  }

  window.GoGames.mecha = {
    id: 'mecha', size: [W, H], ROBOTS,
    thumb(ctx, w, h) {
      const bg = img('arena.jpg');
      const paint = () => {
        ctx.save(); ctx.clearRect(0, 0, w, h); ctx.scale(w / W, h / H); drawArena(ctx, bg);
        drawCard(ctx, ROBOTS[0], 150, 90, 300, 380); drawCard(ctx, ROBOTS[3], 510, 90, 300, 380);
        S.text(ctx, 'VS', W / 2, H / 2, 64, '#FFD23F');
        ctx.restore();
      };
      paint(); S.onImages(paint);
    },
    create(canvas, hooks) {
      const ctx = window.GoPixel.setup(canvas, W, H), clock = window.GoPixel.clock();
      const bg = img('arena.jpg');
      let mode = 'ai', level = 'normal', phase = 'idle', raf = 0, last = 0, frames = 0, timeLeft = 120, n = 2;
      let P = [], B = [], MINES = [], ZONES = [], TUR = [], fx = [], pick = 0, cur = 0, banner = null, intro = 0, slow = 0, shake = 0, net = null;
      const online = () => mode === 'online';
      const isHost = () => !online() || (net && net.host);

      /* ---------- 조작 ---------- */
      const KEYS = {
        KeyA: 'me.left', KeyD: 'me.right', KeyW: 'me.up', KeyS: 'me.down', ArrowLeft: 'me.left', ArrowRight: 'me.right', ArrowUp: 'me.up', ArrowDown: 'me.down',
        ShiftLeft: 'me.boost', ShiftRight: 'me.boost', Space: 'me.boost',
        KeyJ: 'me.w1', KeyK: 'me.w2', KeyL: 'me.w3', KeyZ: 'me.w1', KeyX: 'me.w2', KeyC: 'me.w3', KeyP: 'pause', Escape: 'pause', Digit1: 'me.w1', Digit2: 'me.w2', Digit3: 'me.w3', Numpad1: 'me.w1', Numpad2: 'me.w2', Numpad3: 'me.w3',
        Digit4: 'pick4', Digit5: 'pick5', Digit6: 'pick6', Digit7: 'pick7', Digit8: 'pick8', Digit9: 'pick9', Digit0: 'pick10', Minus: 'pick11', Equal: 'pick12',
        Enter: 'pickOk', NumpadEnter: 'pickOk'
      };
      const COLS = 4;
      const input = S.keys(KEYS, a => onKey(a));
      const touch = S.touchDevice() ? S.pad(canvas, W, H, [
        { id: 'me.left', label: '◀', x: 70, y: 450, r: 50, font: 28 }, { id: 'me.right', label: '▶', x: 200, y: 450, r: 50, font: 28 },
        { id: 'me.up', label: '▲', x: 135, y: 380, r: 44, font: 26 }, { id: 'me.down', label: '▼', x: 135, y: 505, r: 34, font: 22 },
        { id: 'me.w1', label: '1', x: W - 250, y: 470, r: 46, font: 26 }, { id: 'me.w2', label: '2', x: W - 150, y: 420, r: 46, font: 26 },
        { id: 'me.w3', label: '3', x: W - 60, y: 360, r: 42, font: 26 }, { id: 'me.boost', label: '부스터', x: W - 70, y: 480, r: 44, font: 16 }
      ], input, a => onKey(a, true)) : null;
      // 고르기 화면: 4칸 × 3줄 카드
      const pickRects = () => ROBOTS.map((rb, i) => ({ rb, i, x: 45 + (i % COLS) * 220, y: 112 + Math.floor(i / COLS) * 128, w: 210, h: 120 }));
      const pickAt = e => {
        const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
        return pickRects().find(q => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      };
      const onDown = e => {
        if (phase === 'paused') { phase = 'fight'; hooks.onButtons(pauseBtn()); return; }   // 일시정지 중 화면을 누르면 계속
        if (phase !== 'pick') return; const r = pickAt(e); if (!r) return;
        if (e.pointerType === 'mouse' || r.i === cur) { cur = r.i; choose(r.rb.id); } else { cur = r.i; render(); }
      };
      const onHover = e => { if (phase !== 'pick') return; const r = pickAt(e); if (r && r.i !== cur) { cur = r.i; render(); } };
      canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onHover);

      const pauseBtn = () => (online() ? [] : [{ id: 'pause', label: '일시정지 / 계속' }]);
      function togglePause() {
        if (online()) return;
        if (phase === 'fight') phase = 'paused'; else if (phase === 'paused') phase = 'fight'; else return;
        P.forEach(f => { f.ai.hold = {}; });
        render();
      }
      const onVis = () => { if (document.hidden && phase === 'fight') togglePause(); };   // 다른 탭을 보면 자동 일시정지 (AI 대전)
      document.addEventListener('visibilitychange', onVis);
      function onKey(a, fromPad) {
        if (a === 'pause') return togglePause();
        if (phase !== 'pick' || fromPad) return;   // 휴대폰은 카드를 직접 눌러 고름 (화면 버튼과 겹쳐 잘못 고르지 않게)
        const v = { 'me.w1': 1, 'me.w2': 2, 'me.w3': 3 }[a] || (/^pick\d+$/.test(a) ? +a.slice(4) : 0);
        if (v) { cur = v - 1; return choose(v); }
        const N = ROBOTS.length;
        if (a === 'me.left') cur = (cur + N - 1) % N;
        else if (a === 'me.right') cur = (cur + 1) % N;
        else if (a === 'me.up') cur = (cur + N - COLS) % N;
        else if (a === 'me.down') cur = (cur + COLS) % N;
        else if (a === 'pickOk' || a === 'me.boost') return choose(cur + 1);
        render();
      }

      /* ---------- 로봇 ---------- */
      const homeOf = slot => (n === 4 ? [[110, 170], [110, 370], [W - 110, 170], [W - 110, 370]][slot] : [[130, H / 2], [W - 130, H / 2]][slot]);
      function robot(slot, name, human, mine) {
        const team = S.teamOf(slot, n), [x, y] = homeOf(slot);
        return { i: slot, name, human, mine: !!mine, remote: null, team, rid: 0, rb: null, x, y, vx: 0, vy: 0, ang: team === 0 ? 0 : Math.PI,
          hp: 100, maxHp: 100, en: 100, cd: [0, 0, 0], chg: [-1, -1, -1], prevW: [false, false, false], prevBoost: false, boostCd: 0,
          stun: 0, poison: 0, slowT: 0, shield: 0, burn: 0, rootT: 0, cloak: 0, leap: null, dead: false, hitFlash: 0, ai: { t: 0, hold: {}, strafe: 1, chargeFor: [0, 0, 0], wx: 0, wy: 0 } };
      }
      function setRobot(f, rid) { const rb = ROBOTS[rid - 1] || ROBOTS[0]; f.rid = rb.id; f.rb = rb; f.hp = f.maxHp = Math.round(rb.hp * HP_MUL); }
      const alive = () => P.filter(f => !f.dead);
      const enemiesOf = f => P.filter(e => e.team !== f.team && !e.dead);
      const seen = t => !(t.cloak > 0);   // 은신 중이면 상대가 자동 조준할 수 없음
      const nearestTo = (x, y, team, maxD) => P.filter(e => e.team !== team && !e.dead && seen(e) && (!maxD || Math.hypot(e.x - x, e.y - y) <= maxD)).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
      const nearest = f => nearestTo(f.x, f.y, f.team);
      const rangeOf = w => (w.boomerang ? w.spd * w.boomerang * 1.1 : w.spd ? w.spd * w.life * 0.9 : w.range || 60);
      const ctl = (f, k) => (f.remote ? !!f.remote[k] : f.human ? !!input.down['me.' + k] : !!f.ai.hold[k]);
      const teamName = t => P.filter(f => f.team === t).map(f => f.name).join('·');
      const myTeam = () => { const me = P.find(f => f.mine); return me ? me.team : 0; };
      const teamPct = t => { const fs = P.filter(f => f.team === t); return fs.length ? Math.round(fs.reduce((s, f) => s + Math.max(0, f.hp) / f.maxHp, 0) / fs.length * 100) : 0; };

      /* ---------- 효과 ---------- */
      function addFx(e) { fx.push(e); if (net && net.host && e.kind !== 'dot') net.fx.push(e); }
      function burst(x, y, color, cnt) {
        for (let k = 0; k < cnt; k++) fx.push({ kind: 'dot', x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 24, color });
        if (net && net.host) net.fx.push({ kind: 'burst', x, y, color, n: cnt });
      }
      function say(text, color) { banner = { text, color, t: 70 }; }

      /* ---------- 피해 ---------- */
      function hurt(t, dmg, from, o) {
        if (t.dead || dmg <= 0 || t.leap) return;   // 로켓 점프로 하늘에 있는 동안은 맞지 않음
        o = o || {};
        if (t.shield > 0) dmg *= 0.3;
        dmg = Math.max(1, Math.round(dmg));
        t.hp -= dmg; if (!o.dot) t.hitFlash = 8;
        t.taken = (t.taken || 0) + dmg; if (from && from !== t) from.dealt = (from.dealt || 0) + dmg;
        if (t.cloak > 0) { t.cloak = 0; addFx({ kind: 'ring', x: t.x, y: t.y, r: t.rb.r, color: '#C77DFF', life: 14 }); }   // 맞으면 은신이 풀림
        if (o.stun) t.stun = Math.max(t.stun, o.stun);
        if (o.poison) { t.poison = Math.max(t.poison, o.poison); t.poisonBy = from; }
        if (o.slow) t.slowT = Math.max(t.slowT, o.slow);
        if (o.burn) { t.burn = Math.max(t.burn, o.burn); t.burnBy = from; }
        if (o.root) t.rootT = Math.max(t.rootT, o.root);
        if (o.drain) { t.en = Math.max(0, t.en - o.drain); if (from) from.en = Math.min(100, from.en + o.drain / 2); }
        if (o.knock && from) { const a = Math.atan2(t.y - from.y, t.x - from.x); t.vx += Math.cos(a) * o.knock; t.vy += Math.sin(a) * o.knock; }
        if (!o.dot) addFx({ kind: 'txt', x: t.x, y: t.y - t.rb.r - 12, text: '-' + dmg, color: o.poison ? '#7DFF8A' : o.fire ? '#FF9A3D' : dmg >= 12 ? '#FF5A5F' : '#FFE48A', life: 34 });
        if (dmg >= 12) shake = Math.max(shake, 8);
        if (t.hp <= 0) {
          t.hp = 0; t.dead = true; t.vx = t.vy = 0;
          burst(t.x, t.y, '#FF9A3D', 26); burst(t.x, t.y, '#FFD23F', 14); shake = 14;
          say(t.name + ' 격파!', TEAM_COL[1 - t.team]);
        }
      }

      function heal(t, amt) {
        if (t.dead || t.hp >= t.maxHp) return;
        const v = Math.min(t.maxHp - t.hp, amt); t.hp += v;
        if (v >= 3) addFx({ kind: 'txt', x: t.x, y: t.y - t.rb.r - 12, text: '+' + Math.round(v), color: '#7DFFC4', life: 30 });
      }
      // 폭발: 반지름 안의 상대 모두에게 피해
      function explodeAt(x, y, rad, dmg, team, from, o) {
        addFx({ kind: 'ring', x, y, r: rad, color: (o && o.color) || '#FF9A3D', life: 18 }); burst(x, y, '#FF9A3D', 12); shake = Math.max(shake, 7);
        P.forEach(t => { if (!t.dead && t.team !== team && Math.hypot(t.x - x, t.y - y) < rad + t.rb.r) hurt(t, dmg, from, Object.assign({ knock: 6 }, o)); });
      }
      // 장판·포탑을 던질 자리: 상대가 가까우면 그 자리, 멀면 조준 방향으로 최대 거리만큼
      function throwPos(f, tg, maxD) {
        let x = f.x, y = f.y;
        if (maxD > 0) { if (tg && dist(f, tg) <= maxD) { x = tg.x; y = tg.y; } else { x += Math.cos(f.ang) * maxD; y += Math.sin(f.ang) * maxD; } }
        return [clamp(x, M + 20, W - M - 20), clamp(y, M + 20, H - M - 20)];
      }

      /* ---------- 무기 쏘기 ---------- */
      function fire(f, wi, lv) {
        const w = f.rb.w[wi], cost = Math.round(w.en * (1 + 0.5 * lv));
        let mul = 1 + 0.5 * lv;
        if (f.cd[wi] > 0 || f.dead || f.stun > 0) return;
        if (f.en < cost) { if (f.mine || (net && net.host && f.remote)) addFx({ kind: 'txt', x: f.x, y: f.y - f.rb.r - 26, text: '에너지 부족', color: '#BFC7E0', life: 30 }); return; }
        f.en -= cost; f.cd[wi] = w.cd;
        // 은신 중 첫 공격은 피해 2배, 공격하면 모습이 드러남
        if (f.cloak > 0 && w.kind !== 'cloak') { f.cloak = 0; mul *= 2; addFx({ kind: 'txt', x: f.x, y: f.y - f.rb.r - 26, text: '기습 ×2!', color: '#E3B3FF', life: 34 }); }
        const tg = nearest(f), a = f.ang;
        if (w.kind === 'melee' || w.kind === 'spin' || w.kind === 'cone') {
          const range = w.range * (1 + 0.15 * lv), arc = w.arc * (w.kind === 'cone' ? 1 + 0.2 * lv : 1);
          addFx({ kind: w.kind === 'cone' ? 'fan' : 'arc', x: f.x, y: f.y, a, arc: w.kind === 'spin' ? Math.PI * 2 : arc, r: range, color: w.col, life: 12 });
          enemiesOf(f).forEach(t => {
            const d = dist(f, t); if (d > range + t.rb.r) return;
            if (w.kind !== 'spin' && Math.abs(angDiff(Math.atan2(t.y - f.y, t.x - f.x), a)) > arc / 2 + 0.25) return;
            hurt(t, w.dmg * mul, f, { stun: w.stun, poison: w.poison, slow: w.slow, burn: w.burn, knock: (w.knock || 3) * (1 + 0.3 * lv) });
          });
        } else if (w.kind === 'shot') {
          const cnt = w.count + (w.extra || 0) * lv;
          for (let k = 0; k < cnt; k++) {
            const off = cnt > 1 ? (k / (cnt - 1) - 0.5) * w.spread * (1 + 0.2 * lv) : 0, aa = a + off;
            B.push({ x: f.x + Math.cos(aa) * f.rb.r, y: f.y + Math.sin(aa) * f.rb.r, vx: Math.cos(aa) * w.spd, vy: Math.sin(aa) * w.spd, team: f.team, from: f.i, dmg: w.dmg * mul,
              r: w.rad * (1 + 0.25 * lv), life: w.life, col: w.col, homing: w.homing || 0, pierce: (!!w.pierce && lv >= 1) || !!w.boomerang, rock: !(w.pierce && lv >= 2) && !w.boomerang,
              stun: w.stun || 0, poison: w.poison || 0, slow: w.slow || 0, drain: (w.drain || 0) * mul, burn: w.burn || 0, root: w.root ? w.root + 20 * lv : 0,
              heal: (w.heal || 0) * mul, explode: w.explode ? w.explode * (1 + 0.2 * lv) : 0, boomerang: w.boomerang || 0, age: 0, back: false, hit: [] });
          }
        } else if (w.kind === 'mine') {
          const mine = MINES.filter(m => m.from === f.i); if (mine.length >= 3) MINES.splice(MINES.indexOf(mine[0]), 1);
          MINES.push({ x: f.x - Math.cos(a) * (f.rb.r + 10), y: f.y - Math.sin(a) * (f.rb.r + 10), team: f.team, from: f.i, dmg: w.dmg * mul, blast: w.blast * (1 + 0.2 * lv), arm: 30, life: 60 * 12 });
        } else if (w.kind === 'dash') {
          const len = w.dist + 60 * lv, sx = f.x, sy = f.y;
          f.x = clamp(f.x + Math.cos(a) * len, M + f.rb.r, W - M - f.rb.r); f.y = clamp(f.y + Math.sin(a) * len, M + f.rb.r, H - M - f.rb.r);
          addFx({ kind: 'line', x: sx, y: sy, x2: f.x, y2: f.y, color: w.col, life: 14 });
          enemiesOf(f).forEach(t => { if (segDist(sx, sy, f.x, f.y, t.x, t.y) < t.rb.r + f.rb.r) hurt(t, w.dmg * mul, f, { knock: 6, poison: 60 }); });
        } else if (w.kind === 'pull') {
          if (tg && !tg.leap && dist(f, tg) <= w.range * (1 + 0.2 * lv)) {
            const ang = Math.atan2(f.y - tg.y, f.x - tg.x), d = dist(f, tg) - f.rb.r - tg.rb.r - 20;
            addFx({ kind: 'line', x: f.x, y: f.y, x2: tg.x, y2: tg.y, color: w.col, life: 18 });
            tg.x += Math.cos(ang) * d * 0.8; tg.y += Math.sin(ang) * d * 0.8; tg.vx = tg.vy = 0;
            hurt(tg, w.dmg * mul, f, { stun: w.stun + 10 * lv });
          } else addFx({ kind: 'txt', x: f.x, y: f.y - f.rb.r - 26, text: '너무 멀어요', color: '#BFC7E0', life: 30 });
        } else if (w.kind === 'shield') {
          f.shield = w.time + 60 * lv;
        } else if (w.kind === 'leap') {
          // 로켓 점프: 0.33초 동안 날아올라(무적) 내려앉으며 폭발
          const len = Math.min(w.dist + 50 * lv, tg ? Math.max(40, dist(f, tg)) : w.dist + 50 * lv);
          f.leap = { sx: f.x, sy: f.y, tx: clamp(f.x + Math.cos(a) * len, M + f.rb.r, W - M - f.rb.r), ty: clamp(f.y + Math.sin(a) * len, M + f.rb.r, H - M - f.rb.r), t: 0, T: 20, dmg: w.dmg * mul, blast: w.blast * (1 + 0.15 * lv), col: w.col };
          f.vx = f.vy = 0; burst(f.x, f.y, '#FFB347', 10);
        } else if (w.kind === 'zone') {
          const [x, y] = throwPos(f, tg, w.throw ? w.throw * (1 + 0.2 * lv) : 0);
          ZONES = ZONES.filter(z => !(z.from === f.i && z.kind === w.zone));   // 같은 장판은 하나만
          const z = { x, y, r: w.r * (1 + 0.15 * lv), kind: w.zone, team: f.team, from: f.i, life: w.time + 60 * lv, mul };
          ZONES.push(z);
          addFx({ kind: 'ring', x, y, r: z.r * 0.6, color: w.col, life: 16 });
          if (w.freeze) P.forEach(t => { if (!t.dead && t.team !== f.team && Math.hypot(t.x - x, t.y - y) < z.r + t.rb.r * 0.5) { hurt(t, 4 * mul, f, { stun: w.freeze + 15 * lv }); addFx({ kind: 'txt', x: t.x, y: t.y - t.rb.r - 28, text: '빙결!', color: '#BFF0FF', life: 34 }); } });
        } else if (w.kind === 'chain') {
          // 연쇄 번개: 가까운 상대 → 그 옆 상대로 옮겨 감 (옮길수록 약해짐)
          const hits = []; let from = f;
          for (let h = 0; h <= w.hops + lv; h++) {
            const nx = P.filter(t => !t.dead && t.team !== f.team && seen(t) && !hits.includes(t) && dist(from, t) <= (h === 0 ? w.range * (1 + 0.15 * lv) : w.jump)).sort((p, q) => dist(from, p) - dist(from, q))[0];
            if (!nx) break;
            addFx({ kind: 'bolt', x: from.x, y: from.y, x2: nx.x, y2: nx.y, color: w.col, life: 14 });
            hurt(nx, w.dmg * mul * Math.pow(0.75, h), f, { stun: w.stun });
            hits.push(nx); from = nx;
          }
          if (!hits.length) addFx({ kind: 'txt', x: f.x, y: f.y - f.rb.r - 26, text: '너무 멀어요', color: '#BFC7E0', life: 30 });
        } else if (w.kind === 'cloak') {
          f.cloak = w.time + 60 * lv; burst(f.x, f.y, w.col, 12);
        } else if (w.kind === 'turret') {
          const x = clamp(f.x + Math.cos(a) * (f.rb.r + 24), M + 16, W - M - 16), y = clamp(f.y + Math.sin(a) * (f.rb.r + 24), M + 16, H - M - 16);
          TUR = TUR.filter(t => t.from !== f.i);   // 포탑은 한 개만
          TUR.push({ x, y, team: f.team, from: f.i, life: w.time + 120 * lv, cd: 20, ang: a, rate: w.rate, dmg: w.dmg * mul, range: w.range, hp: w.hp * mul, col: w.col });
          burst(x, y, w.col, 10);
        }
        if (lv >= 2) burst(f.x, f.y, w.col, 10);
        if ((w.kind !== 'melee' && w.kind !== 'shot' && w.kind !== 'cone' && w.kind !== 'chain') || lv >= 2) say(f.name + ' · ' + w.name + (lv ? ' ' + '★'.repeat(lv) : '') + '!', w.col);
      }
      function segDist(x1, y1, x2, y2, px, py) {
        const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
      }

      /* ---------- 컴퓨터 ---------- */
      function ai(f) {
        const L = LV[level] || LV.normal, e = nearest(f), h = f.ai.hold;
        // 힘 모으는 중이면 정한 시간만큼 누르고 있다가 놓음
        for (let k = 0; k < 3; k++) if (h['w' + (k + 1)]) { if (--f.ai.chargeFor[k] <= 0) h['w' + (k + 1)] = false; }
        h.boost = false;
        if (!e) {
          // 상대가 은신해서 안 보이면 이리저리 돌아다니며 찾음
          if (--f.ai.t <= 0) { f.ai.t = 30 + Math.floor(Math.random() * 30); const ra = Math.random() * Math.PI * 2; f.ai.wx = Math.cos(ra); f.ai.wy = Math.sin(ra); }
          let mx = f.ai.wx, my = f.ai.wy;
          if (f.x < M + 90) mx = 1; if (f.x > W - M - 90) mx = -1; if (f.y < M + 80) my = 1; if (f.y > H - M - 80) my = -1;
          h.left = mx < -0.3; h.right = mx > 0.3; h.up = my < -0.3; h.down = my > 0.3;
          return;
        }
        // 날아오는 탄 피하기 (부스터)
        if (Math.random() < L.dodge / 6) {
          const bl = B.find(b => b.team !== f.team && Math.hypot(b.x - f.x, b.y - f.y) < 90 && (b.vx * (f.x - b.x) + b.vy * (f.y - b.y)) > 0);
          if (bl && f.en > 30) { const pa = Math.atan2(bl.vy, bl.vx) + Math.PI / 2 * f.ai.strafe; h.left = Math.cos(pa) < -0.3; h.right = Math.cos(pa) > 0.3; h.up = Math.sin(pa) < -0.3; h.down = Math.sin(pa) > 0.3; h.boost = true; return; }
        }
        if (--f.ai.t > 0) return;
        f.ai.t = L.think + Math.floor(Math.random() * L.think);
        const d = dist(f, e), a = Math.atan2(e.y - f.y, e.x - f.x);
        if (Math.random() < 0.15) f.ai.strafe *= -1;
        let mx = 0, my = 0;
        if (d > f.rb.pref + 50) { mx = Math.cos(a); my = Math.sin(a); }
        else if (d < f.rb.pref - 50) { mx = -Math.cos(a); my = -Math.sin(a); }
        else { mx = Math.cos(a + Math.PI / 2 * f.ai.strafe); my = Math.sin(a + Math.PI / 2 * f.ai.strafe); }
        // 바위·벽 피하기
        ROCKS.forEach(([rx, ry, rr]) => { const rd = Math.hypot(f.x - rx, f.y - ry); if (rd < rr + f.rb.r + 40) { mx += (f.x - rx) / rd * 1.2; my += (f.y - ry) / rd * 1.2; } });
        if (f.x < M + 70) mx += 1; if (f.x > W - M - 70) mx -= 1; if (f.y < M + 60) my += 1; if (f.y > H - M - 60) my -= 1;
        h.left = mx < -0.3; h.right = mx > 0.3; h.up = my < -0.3; h.down = my > 0.3;
        if (Math.random() > L.aggro) return;
        // 무기 고르기
        const w = f.rb.w, ready = k => f.cd[k] <= 0 && !h['w' + (k + 1)] && f.en >= w[k].en, press = (k, lvl) => { h['w' + (k + 1)] = true; f.ai.chargeFor[k] = lvl ? 30 * lvl + 4 : 2; };
        const chargeLv = () => (Math.random() < L.charge ? (Math.random() < 0.5 ? 2 : 1) : 0);
        const k3 = w[2].kind, z3 = w[2].zone;
        const allyHurt = P.some(q => q.team === f.team && !q.dead && q.hp < q.maxHp * 0.6);
        if (ready(2) && ((k3 === 'shield' && f.hp < f.maxHp * 0.7) || (k3 === 'pull' && d > 160 && d < 360) || (k3 === 'dash' && d > 110 && d < 240) || (k3 === 'mine' && d < 160) || (k3 === 'shot' && d < 420 && Math.random() < 0.5)
          || (k3 === 'leap' && d > 90 && d < 260) || (z3 === 'heal' && (f.hp < f.maxHp * 0.75 || allyHurt)) || ((z3 === 'ice' || z3 === 'hole') && d < w[2].throw + 40)
          || (k3 === 'cloak' && d < 340 && Math.random() < 0.5) || (k3 === 'turret' && d < 420 && !TUR.some(t => t.from === f.i)))) return press(2, chargeLv());
        if (ready(0) && d < rangeOf(w[0]) + e.rb.r) return press(0, Math.random() < L.charge * 0.5 ? 1 : 0);
        if (ready(1) && d < rangeOf(w[1])) return press(1, chargeLv());
      }

      /* ---------- 한 프레임 (방장·혼자일 때만 계산) ---------- */
      function step() {
        frames++;
        P.forEach(f => {
          if (f.dead) return;
          if (!f.human && !f.remote) ai(f);
          // 조준: 가장 가까운 상대 (컴퓨터는 난이도만큼 빗나감)
          const e = nearest(f);
          if (e) {
            let ta = Math.atan2(e.y - f.y, e.x - f.x);
            if (!f.human && !f.remote) ta += Math.sin(frames / 23 + f.i) * (LV[level] || LV.normal).err;
            f.ang += angDiff(ta, f.ang) * 0.25;
          }
          if (f.stun > 0) f.stun--; if (f.slowT > 0) f.slowT--; if (f.shield > 0) f.shield--; if (f.hitFlash > 0) f.hitFlash--;
          if (f.boostCd > 0) f.boostCd--;
          for (let k = 0; k < 3; k++) if (f.cd[k] > 0) f.cd[k]--;
          if (f.poison > 0) { f.poison--; if (f.poison % 20 === 0) hurt(f, 1, f.poisonBy, { dot: true }); if (f.dead) return; }
          if (f.burn > 0) { f.burn--; if (f.burn % 15 === 0) hurt(f, 1, f.burnBy, { fire: true, dot: true }); if (f.dead) return; }
          if (f.rootT > 0) f.rootT--;
          if (f.cloak > 0) f.cloak--;
          // 로켓 점프 중: 날아가는 동안 조작 불가, 내려앉으면 폭발
          if (f.leap) {
            const L = f.leap; L.t++;
            const k = L.t / L.T; f.x = L.sx + (L.tx - L.sx) * k; f.y = L.sy + (L.ty - L.sy) * k;
            if (L.t >= L.T) { f.leap = null; explodeAt(f.x, f.y, L.blast, L.dmg, f.team, f, { burn: 60, knock: 9 }); }
            for (let k2 = 0; k2 < 3; k2++) { f.chg[k2] = -1; f.prevW[k2] = ctl(f, 'w' + (k2 + 1)); }
            return;
          }
          f.en = Math.min(100, f.en + 0.28);
          // 이동 (관성)
          const sp = f.rb.spd * (f.slowT > 0 ? 0.5 : 1) * (f.cloak > 0 ? 1.25 : 1);
          let ix = (ctl(f, 'right') ? 1 : 0) - (ctl(f, 'left') ? 1 : 0), iy = (ctl(f, 'down') ? 1 : 0) - (ctl(f, 'up') ? 1 : 0);
          if (f.stun > 0 || f.rootT > 0) ix = iy = 0;
          if (f.rootT > 0) { f.vx *= 0.6; f.vy *= 0.6; }
          if (ix || iy) { const l = Math.hypot(ix, iy); f.vx += ix / l * sp * 0.16; f.vy += iy / l * sp * 0.16; }
          const boost = ctl(f, 'boost');
          if (boost && !f.prevBoost && f.boostCd <= 0 && f.en >= 20 && f.stun <= 0 && f.rootT <= 0) {
            const ba = ix || iy ? Math.atan2(iy, ix) : f.ang;
            f.vx += Math.cos(ba) * sp * 2.3; f.vy += Math.sin(ba) * sp * 2.3; f.en -= 20; f.boostCd = 30;
            addFx({ kind: 'ring', x: f.x, y: f.y, r: f.rb.r, color: '#7FE3FF', life: 14 });
          }
          f.prevBoost = boost;
          const v = Math.hypot(f.vx, f.vy), vmax = sp * (f.boostCd > 18 ? 3 : 1);
          if (v > vmax) { f.vx *= vmax / v; f.vy *= vmax / v; }
          f.vx *= 0.95; f.vy *= 0.95;
          f.x += f.vx; f.y += f.vy;
          // 벽·바위
          if (f.x < M + f.rb.r) { f.x = M + f.rb.r; f.vx = Math.abs(f.vx) * 0.4; } if (f.x > W - M - f.rb.r) { f.x = W - M - f.rb.r; f.vx = -Math.abs(f.vx) * 0.4; }
          if (f.y < M + f.rb.r) { f.y = M + f.rb.r; f.vy = Math.abs(f.vy) * 0.4; } if (f.y > H - M - f.rb.r) { f.y = H - M - f.rb.r; f.vy = -Math.abs(f.vy) * 0.4; }
          ROCKS.forEach(([rx, ry, rr]) => { const d = Math.hypot(f.x - rx, f.y - ry), need = rr + f.rb.r; if (d < need && d > 0) { f.x = rx + (f.x - rx) / d * need; f.y = ry + (f.y - ry) / d * need; } });
          // 무기: 누르면 힘 모으기 시작, 놓으면 발사
          for (let k = 0; k < 3; k++) {
            const down = ctl(f, 'w' + (k + 1));
            if (down && !f.prevW[k] && f.cd[k] <= 0 && f.stun <= 0) f.chg[k] = 0;
            else if (down && f.chg[k] >= 0) f.chg[k]++;
            if (!down && f.prevW[k] && f.chg[k] >= 0) { fire(f, k, Math.min(2, Math.floor(f.chg[k] / 30))); f.chg[k] = -1; }
            if (f.stun > 0) f.chg[k] = -1;
            f.prevW[k] = down;
          }
        });
        // 로봇끼리 밀기
        const al = alive();
        for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) {
          const a = al[i], b = al[j], d = dist(a, b), need = a.rb.r + b.rb.r;
          if (d < need && d > 0) { const push = (need - d) / 2, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
        }
        // 탄
        B.forEach(b => {
          if (b.homing) { const t = nearestTo(b.x, b.y, b.team); if (t) { const sp = Math.hypot(b.vx, b.vy), ca = Math.atan2(b.vy, b.vx), na = ca + clamp(angDiff(Math.atan2(t.y - b.y, t.x - b.x), ca), -b.homing, b.homing); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; } }
          // 부메랑: 일정 거리 뒤 주인에게 돌아옴 (돌아올 때 다시 한 번 맞힘)
          if (b.boomerang) {
            b.age++;
            const out = b.x < M || b.x > W - M || b.y < M || b.y > H - M;
            if (!b.back && (b.age >= b.boomerang || out)) { b.back = true; b.hit = []; }
            const o = P[b.from];
            if (b.back && o && !o.dead) {
              const sp = Math.hypot(b.vx, b.vy), ga = Math.atan2(o.y - b.y, o.x - b.x); b.vx = Math.cos(ga) * sp; b.vy = Math.sin(ga) * sp;
              if (Math.hypot(o.x - b.x, o.y - b.y) < o.rb.r) b.life = 0;
            } else if (b.back) b.life = 0;
          }
          b.x += b.vx; b.y += b.vy; b.life--;
          if (!b.boomerang && (b.x < M || b.x > W - M || b.y < M || b.y > H - M)) b.life = 0;
          if (b.rock && ROCKS.some(([rx, ry, rr]) => Math.hypot(b.x - rx, b.y - ry) < rr + b.r)) { b.life = 0; burst(b.x, b.y, b.col, 4); }
          if (b.life <= 0) return;
          P.forEach(t => {
            if (b.life <= 0 || t.dead || t.leap || b.hit.includes(t.i) || Math.hypot(t.x - b.x, t.y - b.y) > t.rb.r + b.r) return;
            if (t.team === b.team) { if (b.heal && t.i !== b.from && t.hp < t.maxHp) { heal(t, b.heal); burst(b.x, b.y, '#7DFFC4', 5); b.life = 0; } return; }   // 나노탄: 우리 편은 회복
            hurt(t, b.dmg, P[b.from], { stun: b.stun, poison: b.poison, slow: b.slow, drain: b.drain, burn: b.burn, root: b.root, knock: 2 });
            b.hit.push(t.i); burst(b.x, b.y, b.col, 5);
            if (!b.pierce) b.life = 0;
          });
          // 상대 포탑에 맞음
          if (b.life > 0) TUR.forEach(t => { if (b.life > 0 && t.team !== b.team && t.hp > 0 && Math.hypot(t.x - b.x, t.y - b.y) < 14 + b.r) { t.hp -= b.dmg; burst(b.x, b.y, b.col, 4); if (!b.pierce) b.life = 0; } });
        });
        B.forEach(b => { if (b.life <= 0 && b.explode && !b.boomed) { b.boomed = true; explodeAt(b.x, b.y, b.explode, b.dmg * 0.7, b.team, P[b.from], { burn: b.burn }); } });   // 네이팜: 사라질 때 폭발
        B = B.filter(b => b.life > 0);
        // 장판 (빙결 · 수리 · 블랙홀)
        ZONES.forEach(z => {
          z.life--;
          P.forEach(t => {
            if (t.dead || t.leap) return;
            const d = Math.hypot(t.x - z.x, t.y - z.y); if (d > z.r + t.rb.r * 0.5) return;
            if (z.kind === 'heal') { if (t.team === z.team && frames % 10 === 0) heal(t, 1.4 * z.mul); return; }
            if (t.team === z.team) return;
            if (z.kind === 'ice') { t.slowT = Math.max(t.slowT, 10); if (frames % 30 === 0) hurt(t, 1, P[z.from], { dot: true }); }
            else if (z.kind === 'hole' && d > 4) { t.vx += (z.x - t.x) / d * 0.32; t.vy += (z.y - t.y) / d * 0.32; if (frames % 15 === 0) hurt(t, 1 * z.mul, P[z.from], { dot: true }); }
          });
        });
        ZONES = ZONES.filter(z => z.life > 0);
        // 포탑: 가까운 상대에게 자동으로 쏨
        TUR.forEach(t => {
          t.life--; if (t.cd > 0) t.cd--;
          const e = nearestTo(t.x, t.y, t.team, t.range);
          if (e) { t.ang = Math.atan2(e.y - t.y, e.x - t.x); if (t.cd <= 0) { t.cd = t.rate; B.push({ x: t.x + Math.cos(t.ang) * 16, y: t.y + Math.sin(t.ang) * 16, vx: Math.cos(t.ang) * 9, vy: Math.sin(t.ang) * 9, team: t.team, from: t.from, dmg: t.dmg, r: 4, life: 40, col: t.col, homing: 0, pierce: false, rock: true, stun: 0, poison: 0, slow: 0, drain: 0, burn: 0, root: 0, heal: 0, explode: 0, boomerang: 0, hit: [] }); } }
          if (t.hp <= 0) { t.life = 0; burst(t.x, t.y, '#FF9A3D', 14); }
        });
        TUR = TUR.filter(t => t.life > 0 && !(P[t.from] && P[t.from].dead));
        // 지뢰
        MINES.forEach(m => {
          if (m.arm > 0) m.arm--; m.life--;
          if (m.arm <= 0 && P.some(t => !t.dead && t.team !== m.team && Math.hypot(t.x - m.x, t.y - m.y) < 40 + t.rb.r)) {
            m.life = 0; addFx({ kind: 'ring', x: m.x, y: m.y, r: m.blast, color: '#FF5A5F', life: 18 }); burst(m.x, m.y, '#FF9A3D', 18); shake = Math.max(shake, 10);
            P.forEach(t => { if (!t.dead && t.team !== m.team && Math.hypot(t.x - m.x, t.y - m.y) < m.blast + t.rb.r) hurt(t, m.dmg, P[m.from], { knock: 8 }); });
          }
        });
        MINES = MINES.filter(m => m.life > 0);
        if (frames % FPS === 0) timeLeft = Math.max(0, timeLeft - 1);
        const left = t => P.some(f => f.team === t && !f.dead);
        if (!left(0) || !left(1) || timeLeft <= 0) end();
        else if (frames % 15 === 0) status();
      }
      function end() {
        const a0 = P.some(f => f.team === 0 && !f.dead), a1 = P.some(f => f.team === 1 && !f.dead), p0 = teamPct(0), p1 = teamPct(1);
        const ko = !a0 || !a1;
        const winner = ko ? (a0 ? 0 : a1 ? 1 : -1) : (p0 > p1 ? 0 : p1 > p0 ? 1 : -1);
        phase = 'ko'; slow = 80;
        banner = { text: ko ? '격파!' : (winner === -1 ? '무승부!' : '시간 종료!'), color: '#FFD23F', t: 999, big: true };
        P._result = { winner, ko, pct: [p0, p1], dmg: P.map(f => [Math.round(f.dealt || 0), Math.round(f.taken || 0)]) };
      }
      function finish(why) {
        if (phase === 'over') return;
        phase = 'over'; clock.stop();
        const { winner, ko, pct } = P._result || { winner: -1, ko: false, pct: [0, 0] };
        if (net && net.host) send({ k: 'end', r: P._result, why: why || '' });
        let msg;
        if (why && winner === -1) msg = why;
        else if (winner === -1) msg = `무승부 (남은 체력 ${pct[0]}% : ${pct[1]}%)`;
        else msg = (winner === myTeam() ? (ko ? '승리! 상대 로봇을 모두 격파했어요' : '승리! 남은 체력이 더 많았어요') : (ko ? '아쉬워요… 모두 격파당했어요' : '아쉬워요… 남은 체력이 모자랐어요')) + (why ? ' · ' + why : '');
        const me = P.find(f => f.mine) || P[0];
        const dm = P._result && P._result.dmg && P._result.dmg[me.i];
        if (dm && winner !== -1 || dm && !why) msg += ` · 준 피해 ${dm[0]} · 받은 피해 ${dm[1]}`;
        hooks.onTurn({ text: msg, side: -1 });
        hooks.onOver({ winner, win: winner < 0 ? null : winner === myTeam(), message: msg, moves: 0, duration_sec: clock.sec(), extra: { pct, ko, robot: me.rid, players: n } });
      }
      function status() {
        if (phase === 'pick') { const p = pickers()[pick]; return hooks.onTurn({ text: (p ? p.name : '') + ' · 로봇을 고르세요 (1~' + ROBOTS.length + ')', side: 0 }); }
        if (phase === 'waitpick') return hooks.onTurn({ text: '다른 사람이 로봇을 고르는 중…', side: -1 });
        hooks.onTurn({ text: `${teamName(0)} ${teamPct(0)}% vs ${teamPct(1)}% ${teamName(1)} · 남은 시간 ${timeLeft}초`, side: 0 });
      }
      const pickers = () => P.filter(f => f.human && !f.remote);
      function choose(v) {
        const list = pickers(), p = list[pick]; if (!p || v < 1 || v > ROBOTS.length) return;
        setRobot(p, v); pick++;
        if (online()) { send({ k: 'pick', s: p.i, v }); if (pick >= list.length) { phase = 'waitpick'; status(); } if (isHost()) hostTryGo(); return; }
        if (pick >= list.length) { P.forEach(q => { if (!q.rid) setRobot(q, 1 + Math.floor(Math.random() * ROBOTS.length)); }); startIntro(); }
        else status();
      }
      function startIntro() { phase = 'intro'; intro = 100; input.down['me.w1'] = input.down['me.w2'] = input.down['me.w3'] = false; P.forEach(f => { f.prevW = [true, true, true]; }); status(); }
      function hostTryGo() {
        if (!isHost() || phase === 'intro' || phase === 'fight') return;
        if (P.some(q => q.human && !q.rid)) return;
        P.forEach(q => { if (!q.rid) setRobot(q, 1 + Math.floor(Math.random() * ROBOTS.length)); });
        send({ k: 'go', rb: P.map(q => q.rid) });
        startIntro();
      }

      /* ---------- 온라인 (방장이 계산, 손님은 입력만 보냄) ---------- */
      const SNAP_MS = 80;
      function send(m) { if (online() && hooks.onMove) hooks.onMove(m); }
      function hostSnap() {
        send({ k: 'st', ph: phase, tl: timeLeft, it: intro, sh: shake, bn: banner && banner.t > 0 ? [banner.text, banner.color, banner.big ? 1 : 0] : 0,
          p: P.map(f => [Math.round(f.x), Math.round(f.y), Math.round(f.ang * 100), Math.round(f.hp), Math.round(f.en), f.stun > 0 ? 1 : 0, f.shield > 0 ? 1 : 0, f.poison > 0 ? 1 : 0, f.dead ? 1 : 0, f.cd.map(c => Math.ceil(c / 6)), f.chg.map(c => (c < 0 ? -1 : Math.min(2, Math.floor(c / 30)))), f.hitFlash, f.rid, f.cloak > 0 ? 1 : 0, f.burn > 0 ? 1 : 0, f.rootT > 0 ? 1 : 0, f.leap ? 1 : 0]),
          b: B.slice(0, 80).map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.vx * 10), Math.round(b.vy * 10), Math.round(b.r), b.col, b.team]),
          m: MINES.map(m => [Math.round(m.x), Math.round(m.y), m.team, m.arm > 0 ? 0 : 1]),
          z: ZONES.map(z => [Math.round(z.x), Math.round(z.y), Math.round(z.r), ZK.indexOf(z.kind), z.team, z.life]),
          t: TUR.map(t => [Math.round(t.x), Math.round(t.y), t.team, Math.round(t.ang * 100), t.col]),
          fx: net.fx.splice(0) });
      }
      function applySnap(m) {
        net.sm.push(m);
        if (phase !== 'over' && phase !== 'pick' && m.ph !== phase) { phase = m.ph; if (phase === 'ko') slow = 80; status(); }
        timeLeft = m.tl; intro = m.it; if (m.sh) shake = Math.max(shake, m.sh);
        banner = m.bn ? { text: m.bn[0], color: m.bn[1], t: 999, big: !!m.bn[2] } : null;
        m.p.forEach((a, i) => { const f = P[i]; if (!f) return; if (a[12] && f.rid !== a[12]) setRobot(f, a[12]); f.ang = a[2] / 100; f.hp = a[3]; f.en = a[4]; f.stun = a[5]; f.shield = a[6]; f.poison = a[7]; f.dead = !!a[8]; f.cd = a[9].map(c => c * 6); f.chg = a[10].map(c => (c < 0 ? -1 : c * 30)); f.hitFlash = a[11]; f.cloak = a[13] || 0; f.burn = a[14] || 0; f.rootT = a[15] || 0; f.leap = a[16] ? 1 : null; });
        ZONES = (m.z || []).map(a => ({ x: a[0], y: a[1], r: a[2], kind: ZK[a[3]] || 'ice', team: a[4], life: a[5] }));
        TUR = (m.t || []).map(a => ({ x: a[0], y: a[1], team: a[2], ang: a[3] / 100, col: a[4] }));
        B = m.b.map(a => ({ x: a[0], y: a[1], vx: a[2] / 10, vy: a[3] / 10, r: a[4], col: a[5], team: a[6] }));
        MINES = m.m.map(a => ({ x: a[0], y: a[1], team: a[2], arm: a[3] ? 0 : 1 }));
        (m.fx || []).forEach(e => { if (e.kind === 'burst') { for (let k = 0; k < e.n; k++) fx.push({ kind: 'dot', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 24, color: e.color }); } else fx.push({ ...e }); });
        net.snapAt = performance.now();
        if (frames++ % 15 === 0) status();
      }
      function clientPose() {
        const sm = net.sm; if (!sm.ready) return;
        const a = sm.prev, b = sm.cur;
        P.forEach((f, i) => { const pa = a.p[i], pb = b.p[i]; if (!pa || !pb) return; f.x = sm.mix(pa[0], pb[0]); f.y = sm.mix(pa[1], pb[1]); });
        // 탄은 받은 속도로 조금 앞까지 이어 그림
        const k = Math.min(6, (performance.now() - (net.snapAt || 0)) / (1000 / FPS));
        B.forEach(bl => { bl.dx = bl.vx * k; bl.dy = bl.vy * k; });
      }
      function clientInput() {
        const me = P.find(f => f.mine); if (!me || (phase !== 'fight' && phase !== 'intro')) return;
        const keys = ['left', 'right', 'up', 'down', 'boost', 'w1', 'w2', 'w3'];
        const bits = keys.reduce((s, k, i) => s | (input.down['me.' + k] ? 1 << i : 0), 0);
        if (bits !== net.lastKey || performance.now() - net.lastSent > 1000) { net.lastKey = bits; net.lastSent = performance.now(); send({ k: 'in', s: me.i, b: bits }); }
      }

      /* ---------- 그리기 ---------- */
      const tagOf = f => (f.mine ? '나' : online() ? (f.netId ? f.name : 'CPU') : f.team === myTeam() ? '우리 편' : 'CPU');
      function render() {
        ctx.save(); ctx.imageSmoothingEnabled = false;
        if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        drawArena(ctx, bg);
        if (phase === 'pick' || (phase === 'idle' && !P.length)) { if (phase === 'pick') drawPick(); ctx.restore(); return; }
        ZONES.forEach(z => {
          const fade = Math.min(1, z.life / 30), t = frames / 20;
          ctx.globalAlpha = fade;
          if (z.kind === 'ice') { ctx.fillStyle = 'rgba(143,216,255,.2)'; ctx.strokeStyle = 'rgba(191,240,255,.8)'; }
          else if (z.kind === 'heal') { ctx.fillStyle = 'rgba(125,255,196,.15)'; ctx.strokeStyle = 'rgba(125,255,196,.85)'; }
          else { ctx.fillStyle = 'rgba(30,16,70,.45)'; ctx.strokeStyle = 'rgba(155,140,255,.85)'; }
          ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (z.kind === 'hole') { for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (0.25 + 0.25 * k), t * (k + 1), t * (k + 1) + 2.4); ctx.stroke(); } ctx.fillStyle = '#05030F'; ctx.beginPath(); ctx.arc(z.x, z.y, 14, 0, Math.PI * 2); ctx.fill(); }
          else if (z.kind === 'heal') { ctx.fillStyle = 'rgba(125,255,196,.8)'; for (let k = 0; k < 4; k++) { const px = z.x + Math.cos(k * 1.57 + t * 0.3) * z.r * 0.55, py = z.y + Math.sin(k * 1.57 + t * 0.3) * z.r * 0.55; ctx.fillRect(px - 6, py - 2, 12, 4); ctx.fillRect(px - 2, py - 6, 4, 12); } }
          else { ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 6; k++) { const px = z.x + Math.cos(k * 1.05) * z.r * 0.6, py = z.y + Math.sin(k * 1.05) * z.r * 0.6; ctx.fillRect(px - 2, py - 2, 4, 4); } }
          ctx.globalAlpha = 1;
        });
        MINES.forEach(m => { ctx.fillStyle = TEAM_COL[m.team]; ctx.fillRect(m.x - 6, m.y - 6, 12, 12); ctx.fillStyle = m.arm > 0 || frames % 30 < 15 ? '#1D2340' : '#FFD23F'; ctx.fillRect(m.x - 2, m.y - 2, 4, 4); });
        TUR.forEach(t => {   // 포탑: 팀 색 받침 + 총열
          ctx.fillStyle = '#1D2340'; ctx.fillRect(t.x - 13, t.y - 13, 26, 26); ctx.fillStyle = TEAM_COL[t.team]; ctx.fillRect(t.x - 11, t.y - 11, 22, 22);
          ctx.fillStyle = t.col || '#C9D63A'; ctx.fillRect(t.x - 7, t.y - 7, 14, 14);
          ctx.strokeStyle = '#1D2340'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(t.ang) * 20, t.y + Math.sin(t.ang) * 20); ctx.stroke();
        });
        const mt = myTeam();
        P.forEach(f => {
          if (!f.rb) return;
          const hidden = !f.dead && f.cloak > 0 && f.team !== mt;   // 상대 팀이 은신하면 거의 안 보임
          if (f.leap && !f.dead) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(f.x, f.y + f.rb.r, f.rb.r, f.rb.r * 0.4, 0, 0, Math.PI * 2); ctx.fill(); }
          if (!hidden) {
            ctx.globalAlpha = f.dead ? 0.25 : 1;
            ctx.strokeStyle = TEAM_COL[f.team]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, f.rb.r + 6, 0, Math.PI * 2); ctx.stroke();
            if (f.mine && !f.dead) { ctx.strokeStyle = 'rgba(255,210,63,' + (0.55 + 0.35 * Math.sin(frames / 8)) + ')'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(f.x, f.y, f.rb.r + 22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
            ctx.globalAlpha = 1;
          }
          drawRobot(ctx, f.rb, f.x, f.leap && !f.dead ? f.y - 22 : f.y, f.ang, f.leap && !f.dead ? 1.25 : 1, f.dead ? 0.35 : hidden ? 0.08 : f.cloak > 0 ? 0.45 : f.hitFlash % 4 >= 2 ? 0.5 : 1);
          if (f.dead || hidden) return;
          if (f.burn > 0) { ctx.fillStyle = frames % 8 < 4 ? '#FF9A3D' : '#FF5A3D'; ctx.fillRect(f.x - f.rb.r + 8, f.y + f.rb.r + 6, 6, 6); }
          if (f.rootT > 0) { ctx.strokeStyle = 'rgba(242,242,242,.8)'; ctx.lineWidth = 2; for (let k = 0; k < 4; k++) { const ra = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(f.x - Math.cos(ra) * (f.rb.r + 8), f.y - Math.sin(ra) * (f.rb.r + 8)); ctx.lineTo(f.x + Math.cos(ra) * (f.rb.r + 8), f.y + Math.sin(ra) * (f.rb.r + 8)); ctx.stroke(); } }
          { const ax = f.x + Math.cos(f.ang) * (f.rb.r + 12), ay = f.y + Math.sin(f.ang) * (f.rb.r + 12); ctx.save(); ctx.translate(ax, ay); ctx.rotate(f.ang); ctx.fillStyle = TEAM_COL[f.team]; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -6); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill(); ctx.restore(); }   // 조준 방향
          if (f.shield > 0) { ctx.strokeStyle = 'rgba(201,161,90,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.rb.r + 11, 0, Math.PI * 2); ctx.stroke(); }
          if (f.stun > 0) S.text(ctx, '★', f.x + Math.cos(frames / 6) * 14, f.y - f.rb.r - 6, 14, '#FFE45C');
          if (f.poison > 0) { ctx.fillStyle = '#7DFF8A'; ctx.fillRect(f.x - f.rb.r, f.y + f.rb.r + 6, 6, 6); }
          const ch = Math.max(...f.chg);
          if (ch >= 0) { const lv = Math.min(2, Math.floor(ch / 30)), part = lv >= 2 ? 1 : (ch % 30) / 30; ctx.strokeStyle = ['#FFFFFF', '#FFD23F', '#FF5A5F'][lv]; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, f.rb.r + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * part); ctx.stroke(); }
          // 머리 위 이름·체력
          S.bar(ctx, f.x - 26, f.y - f.rb.r - 18, 52, 5, f.hp / f.maxHp, TEAM_COL[f.team]);
          S.text(ctx, tagOf(f), f.x, f.y - f.rb.r - 32, f.mine ? 15 : 13, f.mine ? '#FFD23F' : '#FFFFFF');
          if (f.mine) { const ty = f.y - f.rb.r - 50 + Math.sin(frames / 7) * 3; ctx.fillStyle = '#FFD23F'; ctx.beginPath(); ctx.moveTo(f.x - 7, ty - 6); ctx.lineTo(f.x + 7, ty - 6); ctx.lineTo(f.x, ty + 2); ctx.closePath(); ctx.fill(); }
        });
        // 내가 지금 자동 조준 중인 상대 표시 (가장 가까운, 보이는 상대)
        { const me = P.find(f => f.mine);
          if (me && me.rb && !me.dead && (phase === 'fight' || phase === 'paused')) {
            const tg = nearest(me);
            if (tg) { const r = tg.rb.r + 14, sp = frames / 30; ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 3; for (let k = 0; k < 4; k++) { const a = sp + k * Math.PI / 2; ctx.beginPath(); ctx.arc(tg.x, tg.y, r, a, a + 0.6); ctx.stroke(); } }
          } }
        B.forEach(b => { const x = b.x + (b.dx || 0), y = b.y + (b.dy || 0); ctx.fillStyle = b.col; ctx.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x - b.r / 2, y - b.r / 2, b.r, b.r); });
        fx.forEach(p => {
          const a = Math.max(0, Math.min(1, p.life / 14));
          ctx.globalAlpha = a;
          if (p.kind === 'dot') { ctx.fillStyle = p.color; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); }
          else if (p.kind === 'arc') { ctx.strokeStyle = p.color; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, p.a - p.arc / 2, p.a + p.arc / 2); ctx.stroke(); }
          else if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - a * 0.6), 0, Math.PI * 2); ctx.stroke(); }
          else if (p.kind === 'line') { ctx.strokeStyle = p.color; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke(); }
          else if (p.kind === 'fan') { ctx.globalAlpha = a * 0.55; ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, p.r, p.a - p.arc / 2, p.a + p.arc / 2); ctx.closePath(); ctx.fill(); ctx.globalAlpha = a; ctx.fillStyle = '#FFE45C'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, p.r * 0.55, p.a - p.arc / 4, p.a + p.arc / 4); ctx.closePath(); ctx.fill(); }
          else if (p.kind === 'bolt') {   // 번개: 지그재그 선
            ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, p.y);
            const dx = p.x2 - p.x, dy = p.y2 - p.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
            for (let k = 1; k < 6; k++) { const o = (k % 2 ? 1 : -1) * 10; ctx.lineTo(p.x + dx * k / 6 + nx * o, p.y + dy * k / 6 + ny * o); }
            ctx.lineTo(p.x2, p.y2); ctx.stroke();
          }
          else if (p.kind === 'txt') { ctx.globalAlpha = Math.min(1, p.life / 12); S.text(ctx, p.text, p.x, p.y, 18, p.color); }
        });
        ctx.globalAlpha = 1;
        hud();
        if (banner && banner.t > 0) S.text(ctx, banner.text, W / 2, banner.big ? H / 2 - 20 : 76, banner.big ? 72 : 20, banner.color);
        if (phase === 'intro') S.text(ctx, intro > 40 ? '준비…' : '출격!', W / 2, H / 2 - 20, intro > 40 ? 56 : 80, intro > 40 ? '#FFFFFF' : '#FFD23F');
        if (phase === 'waitpick') { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, W, H); S.text(ctx, '다른 사람이 로봇을 고르는 중…', W / 2, H / 2, 32, '#fff'); }
        if (touch && (phase === 'fight' || phase === 'intro')) { touch.draw(ctx); hudTouch(); }
        { const me = P.find(f => f.mine);
          if (me && me.dead && (phase === 'fight' || phase === 'paused')) { ctx.fillStyle = 'rgba(11,14,34,.7)'; ctx.fillRect(W / 2 - 230, H - 96, 460, 40); S.text(ctx, '내 로봇이 격파됐어요 · 우리 편을 응원하며 관전 중', W / 2, H - 76, 17, '#FFE45C'); } }
        if (phase === 'paused') { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H); S.text(ctx, '일시정지', W / 2, H / 2 - 20, 48, '#fff'); S.text(ctx, touch ? '화면을 누르면 계속해요' : '화면을 누르거나 P · Esc 를 누르면 계속해요', W / 2, H / 2 + 36, 22, '#FFE45C'); }
        ctx.restore();
      }
      function hud() {
        const me = P.find(f => f.mine);
        // 위쪽: 팀별 로봇 카드 (이름 · 체력 · 에너지)
        P.forEach((f, idx) => {
          if (!f.rb) return;
          const side = f.team, row = P.filter((q, j) => q.team === side && j < idx).length, bw = 200;
          const x = side === 0 ? 14 : W - 14 - bw, y = 10 + row * 44;
          ctx.fillStyle = 'rgba(11,14,34,.72)'; ctx.fillRect(x, y, bw, 38);
          if (f.mine) { ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 2; ctx.strokeRect(x, y, bw, 38); }
          if (f.dead) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x, y, bw, 38); S.text(ctx, '격파됨', x + bw / 2, y + 22, 12, '#FF8A8A'); }
          S.text(ctx, f.name + ' · ' + f.rb.name, side === 0 ? x + 6 : x + bw - 6, y + 9, 12, f.mine ? '#FFD23F' : '#FFFFFF', side === 0 ? 'left' : 'right');
          S.bar(ctx, x + 6, y + 19, bw - 12, 7, f.hp / f.maxHp, f.hp / f.maxHp > 0.3 ? TEAM_COL[side] : '#FFD23F');
          S.bar(ctx, x + 6, y + 30, bw - 12, 3, f.en / 100, '#7FE3FF');
        });
        // 가운데 시간
        ctx.fillStyle = 'rgba(11,14,34,.8)'; ctx.fillRect(W / 2 - 40, 10, 80, 46); ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - 40, 10, 80, 46);
        S.text(ctx, String(timeLeft), W / 2, 34, 28, timeLeft <= 10 ? '#FF5A5F' : '#fff');
        // 아래쪽: 내 무기 3개 (다시 쓰기까지 남은 시간)
        if (me && me.rb && !touch && !me.dead) {
          me.rb.w.forEach((w, k) => {
            const x = W / 2 - 165 + k * 112, y = H - 46, cdr = me.cd[k] > 0 ? me.cd[k] / w.cd : 0;
            ctx.fillStyle = 'rgba(11,14,34,.8)'; ctx.fillRect(x, y, 106, 36);
            ctx.fillStyle = w.col; ctx.fillRect(x, y + 36 - 4, 106 * (1 - cdr), 4);
            if (cdr > 0) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y, 106 * cdr, 32); }
            S.text(ctx, (k + 1) + ' ' + w.name, x + 53, y + 12, 12, cdr > 0 ? '#8A93C0' : '#FFFFFF');
            S.text(ctx, '에너지 ' + w.en, x + 53, y + 25, 10, me.en >= w.en ? '#7FE3FF' : '#FF5A5F', 'center', 400);
          });
        }
      }
      function hudTouch() {
        const me = P.find(f => f.mine);
        if (!me || !me.rb || me.dead) return;
        touch.buttons.forEach(bt => {
          const k = { 'me.w1': 0, 'me.w2': 1, 'me.w3': 2 }[bt.id]; if (k == null) return;
          const w = me.rb.w[k], cdr = me.cd[k] > 0 ? me.cd[k] / w.cd : 0, poor = me.en < w.en;
          if (cdr > 0) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.moveTo(bt.x, bt.y); ctx.arc(bt.x, bt.y, bt.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdr); ctx.closePath(); ctx.fill(); }
          if (poor) { ctx.strokeStyle = '#FF5A5F'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bt.x, bt.y, bt.r + 3, 0, Math.PI * 2); ctx.stroke(); }
          S.text(ctx, w.name, bt.x, bt.y - bt.r - 10, 12, '#FFFFFF');
        });
      }
      function drawPick() {
        ctx.fillStyle = 'rgba(11,14,34,.78)'; ctx.fillRect(0, 0, W, H);
        const p = pickers()[pick];
        S.text(ctx, (p ? p.name : '') + ' · 로봇을 고르세요', W / 2, 40, 28, '#FFD23F');
        S.text(ctx, touch ? '한 번 누르면 아래에 설명 · 같은 카드를 한 번 더 누르면 출격' : '마우스를 올리면 아래에 설명 · 클릭 또는 Enter 로 출격 · 방향키로 옮기기 · 숫자 1~9, 0(10), -(11), =(12)', W / 2, 76, 14, '#fff', 'center', 400);
        const KEY = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
        pickRects().forEach(r => {
          const rb = r.rb, alien = rb.team === '제노 군단', on = r.i === cur;
          ctx.fillStyle = on ? (alien ? '#33244F' : '#22305C') : alien ? '#1E1630' : '#141C38'; ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = rb.color; ctx.fillRect(r.x, r.y, r.w, 5);
          ctx.strokeStyle = on ? '#FFD23F' : rb.color; ctx.lineWidth = on ? 4 : 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
          drawCard(ctx, rb, r.x + 4, r.y + 9, 74, 106);
          S.text(ctx, rb.name, r.x + 84, r.y + 22, 16, '#FFFFFF', 'left');
          if (!touch) S.text(ctx, KEY[r.i], r.x + r.w - 12, r.y + 20, 13, '#FFD23F');
          S.text(ctx, rb.role + ' · 체력 ' + rb.hp, r.x + 84, r.y + 42, 11, rb.color, 'left', 400);
          rb.w.forEach((w, k) => S.text(ctx, (k + 1) + ' ' + w.name, r.x + 84, r.y + 64 + k * 18, 11, '#D9DEF2', 'left', 400));
        });
        // 아래: 고른 칸 로봇 설명
        const rb = ROBOTS[cur];
        if (rb) {
          S.text(ctx, rb.name + ' (' + rb.team + ') — ' + rb.desc, W / 2, 503, 13, '#FFE45C', 'center', 400);
          S.text(ctx, rb.w.map((w, k) => (k + 1) + ' ' + w.name + ': ' + w.tip).join('   ·   '), W / 2, 524, 12, '#D9DEF2', 'center', 400);
        }
      }
      function loop(ts) {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
        let k = Math.round(dt * 60) || 1;
        if (!isHost()) { if (phase !== 'over') { clientPose(); clientInput(); } }
        else if (phase === 'intro') { intro -= k; if (intro <= 0) { phase = 'fight'; banner = null; } }
        else if (phase === 'fight') { while (k-- > 0 && phase === 'fight') step(); }
        else if (phase === 'ko') { if (--slow <= 0) finish(); }
        if (net && net.host && phase !== 'over' && phase !== 'pick' && phase !== 'waitpick' && ts - net.lastSnap >= SNAP_MS) { net.lastSnap = ts; hostSnap(); }
        if (shake > 0) shake -= 1;
        if (banner && banner.t < 999) banner.t--;
        fx.forEach(p => { if (p.kind === 'dot') { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; } else if (p.kind === 'txt') p.y -= 0.7; p.life--; });
        fx = fx.filter(p => p.life > 0);
        render();
      }
      const offImg = S.onImages(render);
      render(); raf = requestAnimationFrame(loop);

      return {
        get state() { return phase === 'over' ? 'over' : phase === 'idle' ? 'ready' : 'playing'; },
        start(o) {
          o = o || {}; mode = o.mode === 'online' ? 'online' : 'ai'; level = o.level || 'normal'; n = o.players === 4 ? 4 : 2;
          const meName = S.myName();
          net = null; P = []; B = []; MINES = []; ZONES = []; TUR = []; cur = 0;
          if (mode === 'online') {
            const roster = o.roster || [], order = S.slotOrder(n);
            net = { host: !!o.host, sm: S.smoother(SNAP_MS), fx: [], lastSnap: 0, lastKey: -1, lastSent: 0, snapAt: 0 };
            for (let slot = 0; slot < n; slot++) {
              const ri = order.indexOf(slot), r = ri >= 0 ? roster[ri] : null, mine = ri === o.me;
              const f = r ? robot(slot, mine ? meName : r.nick, true, mine) : robot(slot, '컴퓨터', false);
              if (r && !mine) { f.netId = r.id; f.remote = net.host ? {} : null; if (!net.host) f.human = false; }
              P.push(f);
            }
          } else {
            for (let slot = 0; slot < n; slot++) P.push(slot === 0 ? robot(0, meName, true, true) : robot(slot, n > 2 && S.teamOf(slot, n) === 0 ? '우리 편 CPU' : 'CPU' + (n > 2 ? ' ' + (slot - 1) : ''), false));
          }
          timeLeft = cfg().timeLimit || 120; frames = 0; fx = []; banner = null; pick = 0; phase = 'pick'; P._result = null; shake = 0;
          clock.reset(); clock.start(); hooks.onState('playing'); hooks.onButtons(pauseBtn()); status(); render();
          if (touch) setTimeout(() => { try { canvas.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* noop */ } }, 60);
        },
        remote(m) {
          if (!m || !net) return;
          if (m.left) {
            if (m.wasHost && !net.host) { P._result = { winner: -1, ko: false, pct: [0, 0] }; return finish('방장이 나가서 경기가 끝났어요'); }
            const f = P.find(q => q.netId === m.left); if (f && net.host) { f.human = false; f.remote = null; f.name += '(CPU)'; hostTryGo(); }
            return;
          }
          if (net.host) {
            const f = P[m.s];
            if (m.k === 'in' && f && f.remote) { const ks = ['left', 'right', 'up', 'down', 'boost', 'w1', 'w2', 'w3']; f.remote = {}; ks.forEach((k, i) => { f.remote[k] = !!(m.b & (1 << i)); }); }
            else if (m.k === 'pick' && f && !f.rid) { setRobot(f, m.v); hostTryGo(); }
            else if (m.k === 'resign' && f) { P._result = { winner: 1 - f.team, ko: false, pct: f.team === 0 ? [0, 100] : [100, 0] }; finish(f.name + ' 기권'); }
          } else {
            if (m.k === 'st') applySnap(m);
            else if (m.k === 'pick') { const f = P[m.s]; if (f) setRobot(f, m.v); }
            else if (m.k === 'go') { m.rb.forEach((v, i) => { if (P[i]) setRobot(P[i], v); }); if (phase === 'waitpick' || phase === 'pick') startIntro(); }
            else if (m.k === 'end') { P._result = m.r || { winner: -1, ko: false, pct: [0, 0] }; finish(m.why); }
          }
        },
        press(id) {
          if (id === 'pause') return togglePause();
          if (id === 'resign' && phase !== 'over' && phase !== 'idle') {
            if (online()) {
              const me = P.find(f => f.mine);
              if (net.host) { P._result = { winner: 1 - me.team, ko: false, pct: me.team === 0 ? [0, 100] : [100, 0] }; finish(me.name + ' 기권'); }
              else send({ k: 'resign', s: me.i });
              return;
            }
            phase = 'over'; clock.stop();
            const msg = '기권 · 컴퓨터 승';
            hooks.onTurn({ text: msg, side: -1 });
            hooks.onOver({ winner: 1, win: false, message: msg, moves: 0, duration_sec: clock.sec(), extra: { resigned: true } });
          }
        },
        togglePause, action() {},
        destroy() { cancelAnimationFrame(raf); input.off(); if (touch) touch.off(); offImg(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onHover); document.removeEventListener('visibilitychange', onVis); }
      };
    }
  };
})();
