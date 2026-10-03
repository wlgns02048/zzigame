'use strict';
// 절차적 스프라이트 생성 (캐릭터/적/투사체/장식물/지형)
G.Spr = {
  glowCache: {},
  make(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h); return c;
  },
  // 가산 합성용 광원 스프라이트
  glow(rgb, size = 64) {
    const k = rgb + '|' + size;
    if (this.glowCache[k]) return this.glowCache[k];
    const c = this.make(size, size, x => {
      const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.22, `rgba(${rgb},0.6)`);
      g.addColorStop(0.55, `rgba(${rgb},0.16)`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(0, 0, size, size);
    });
    return (this.glowCache[k] = c);
  },
  // 꽉 찬 원 (보통 합성 입자 · 연기). 입자마다 arc 경로를 채우는 것보다 그림 한 장을 찍는 게 훨씬 가볍다
  dotCache: {},
  dot(rgb) {
    return this.dotCache[rgb] || (this.dotCache[rgb] = this.make(32, 32, x => { x.fillStyle = `rgb(${rgb})`; x.beginPath(); x.arc(16, 16, 15.5, 0, 7); x.fill(); }));
  },
  // 기본 → 감속/빙결/피격 변형
  variants(base) {
    const w = base.width, h = base.height;
    const tint = (col, alpha) => this.make(w, h, x => {
      x.drawImage(base, 0, 0); x.globalCompositeOperation = 'source-atop';
      x.globalAlpha = alpha; x.fillStyle = col; x.fillRect(0, 0, w, h);
    });
    const frozen = this.make(w, h, x => {
      x.drawImage(base, 0, 0); x.globalCompositeOperation = 'source-atop';
      x.globalAlpha = 0.6; x.fillStyle = '#9fd8ff'; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      // 얼음 덩어리
      const cx = w / 2, cy = h * 0.55, rx = w * 0.42, ry = h * 0.44;
      x.beginPath();
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + 0.3, rr = 0.85 + ((i * 7) % 5) / 18;
        x.lineTo(cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr);
      }
      x.closePath();
      const g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(220,245,255,0.45)'); g.addColorStop(0.5, 'rgba(120,190,255,0.22)'); g.addColorStop(1, 'rgba(200,235,255,0.4)');
      x.fillStyle = g; x.fill();
      x.strokeStyle = 'rgba(235,250,255,0.85)'; x.lineWidth = 1.5; x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(cx - rx * 0.5, cy - ry * 0.6); x.lineTo(cx - rx * 0.1, cy - ry * 0.2); x.lineTo(cx + rx * 0.2, cy - ry * 0.5); x.stroke();
      x.beginPath(); x.moveTo(cx + rx * 0.4, cy + ry * 0.1); x.lineTo(cx + rx * 0.1, cy + ry * 0.5); x.stroke();
    });
    return { n: base, chill: tint('#5aa8ff', 0.35), frozen, flash: tint('#ffffff', 0.55) };
  },

  build() {
    const S = this;
    this.player = this.make(64, 76, drawMage);
    this.playerFlash = this.variants(this.player).flash;
    this.enemy = {};
    const defs = {
      ghoul: [60, 60, drawGhoul], skeleton: [60, 66, drawSkeleton], zombie: [64, 66, drawZombie], gargoyle: [80, 62, drawGargoyle],
      necromancer: [64, 74, drawNecro], cryptfiend: [84, 64, drawFiend], abomination: [104, 104, (x, w, h) => drawAbom(x, w, h, false)],
      patchwerk: [104, 104, (x, w, h) => drawAbom(x, w, h, true)], kelthuzad: [104, 116, drawKT], lichking: [116, 126, drawLK],
    };
    Object.assign(defs, G.EXTRA_SPRITES || {}); // 챕터별 추가 스프라이트 (sprites_classic.js)
    // ramstein 같은 재사용 보스: 기존 그림을 그대로 쓴다
    defs.ramstein = defs.abomination;
    for (const k in defs) { const [w, h, f] = defs[k]; this.enemy[k] = this.variants(this.make(w, h, f)); }

    // 투사체
    this.bolt = this.make(72, 36, (x) => drawBolt(x, '170,225,255', '#ffffff', '#bfeaff'));
    this.boltFF = this.make(72, 36, (x) => drawBolt(x, '200,110,255', '#ffe6c0', '#ff9a3c'));
    this.lance = this.make(96, 20, drawLance);
    this.icicle = this.make(40, 14, (x) => drawCrystal(x, 40, 14, 0.9));
    this.flurry = this.make(44, 22, (x) => drawBolt(x, '150,200,255', '#ffffff', '#9fd0ff', 0.6));
    this.spike = this.make(140, 50, drawSpike);
    this.water = this.make(36, 36, (x) => drawOrbBlob(x, 36, ['#e8fbff', '#59b8ff', 'rgba(30,90,200,0)']));
    this.splinter = this.make(32, 12, (x) => drawCrystal(x, 32, 12, 1, ['#f6e0ff', '#b56bff', '#5a2bd0']));
    this.shadow = this.make(36, 36, (x) => drawOrbBlob(x, 36, ['#f0c8ff', '#7a1fd0', 'rgba(40,0,80,0)']));
    this.frostshot = this.make(36, 36, (x) => drawOrbBlob(x, 36, ['#ffffff', '#6fd0ff', 'rgba(20,60,160,0)']));
    // 흑마법사 투사체 · 적 투사체 종류별 색
    this.boltShadow = this.make(72, 36, (x) => drawBolt(x, '170,90,255', '#ffffff', '#c890ff'));
    this.boltChaos = this.make(72, 36, (x) => drawBolt(x, '120,255,80', '#f0ffe0', '#80ff40'));
    this.boltCoil = this.make(72, 36, (x) => drawBolt(x, '90,230,110', '#e0ffe8', '#60e080', 0.8));
    this.boltFire = this.make(44, 22, (x) => drawBolt(x, '255,140,40', '#fff0c0', '#ff9030', 0.6));
    const orb = cols => this.make(36, 36, x => drawOrbBlob(x, 36, cols));
    this.eshots = {
      shadow: this.shadow, frost: this.frostshot,
      fire: orb(['#fff4c0', '#ff8020', 'rgba(160,30,0,0)']), arcane: orb(['#ffe8ff', '#e060ff', 'rgba(90,0,140,0)']),
      holy: orb(['#ffffff', '#ffe080', 'rgba(160,120,0,0)']), blade: orb(['#ffffff', '#c0c8d0', 'rgba(60,60,70,0)']),
    };
    this.shard = this.make(10, 10, x => { x.fillStyle = '#e8f8ff'; x.beginPath(); x.moveTo(5, 0); x.lineTo(8, 5); x.lineTo(5, 10); x.lineTo(2, 5); x.closePath(); x.fill(); });
    this.bone = this.make(12, 6, x => { x.fillStyle = '#d9d2bc'; x.fillRect(2, 2, 8, 2); x.beginPath(); x.arc(2, 2, 2, 0, 7); x.arc(2, 4, 2, 0, 7); x.arc(10, 2, 2, 0, 7); x.arc(10, 4, 2, 0, 7); x.fill(); });

    // 경험치 보석
    this.gems = [['#5fb0ff', '#1b4fb0'], ['#5dff8a', '#118a3a'], ['#d083ff', '#6a1bb0'], ['#ffc04d', '#b06a10']].map(([a, b]) => this.make(16, 20, x => {
      x.beginPath(); x.moveTo(8, 0); x.lineTo(15, 7); x.lineTo(8, 20); x.lineTo(1, 7); x.closePath();
      const g = x.createLinearGradient(0, 0, 16, 20); g.addColorStop(0, '#fff'); g.addColorStop(0.3, a); g.addColorStop(1, b);
      x.fillStyle = g; x.fill(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 1; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.moveTo(8, 1); x.lineTo(11, 7); x.lineTo(8, 9); x.lineTo(5, 7); x.closePath(); x.fill();
    }));

    // 장식물
    this.decor = {
      rock: this.make(70, 50, drawRock), pine: this.make(70, 110, drawPine), tree: this.make(80, 100, drawDeadTree),
      grave: this.make(36, 46, drawGrave), saronite: this.make(60, 70, drawSaronite), ice: this.make(60, 60, drawIceCluster),
      bones: this.make(40, 24, drawBones),
    };
    this.ground = this.make(512, 512, drawGround);
    for (const k in G.EXTRA_DECOR || {}) { const [w, h, f] = G.EXTRA_DECOR[k]; this.decor[k] = this.make(w, h, f); }
  },
};

// ---------- 그리기 도우미 ----------
function ell(x, cx, cy, rx, ry, fill, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); x.fillStyle = fill; x.fill(); }
function poly(x, pts, fill, stroke, lw = 1) {
  x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath();
  if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
}
function line(x, x0, y0, x1, y1, col, lw, cap = 'round') { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.strokeStyle = col; x.lineWidth = lw; x.lineCap = cap; x.stroke(); }
function lg(x, x0, y0, x1, y1, stops) { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function rg(x, cx, cy, r, stops) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
function eyes(x, pts, col, r = 1.6) {
  x.save(); x.shadowColor = col; x.shadowBlur = 6;
  pts.forEach(([a, b]) => ell(x, a, b, r, r * 0.8, col)); x.restore();
}

// ---------- 냉기 마법사 ----------
function drawMage(x) {
  // 망토
  poly(x, [[22, 26], [42, 26], [48, 66], [16, 66]], '#121b3a');
  // 로브
  poly(x, [[23, 27], [41, 27], [50, 66], [14, 66]], lg(x, 0, 27, 0, 66, [[0, '#4a86e8'], [0.5, '#2a56b8'], [1, '#162d6e']]));
  // 로브 장식 (은빛 테두리)
  poly(x, [[14, 66], [50, 66], [49, 62], [15, 62]], '#cfe3ff');
  line(x, 32, 30, 32, 62, '#cfe3ff', 2);
  poly(x, [[29, 46], [35, 46], [36, 62], [28, 62]], '#7fb6ff');
  // 허리띠
  poly(x, [[21, 42], [43, 42], [44, 46], [20, 46]], '#d9b24c', '#5a4512');
  ell(x, 32, 44, 2.6, 2.6, '#7fe0ff');
  // 어깨 (얼음 수정 견갑)
  poly(x, [[16, 30], [22, 22], [28, 28], [24, 34]], '#bfe8ff', '#3a7fd0', 1);
  poly(x, [[18, 24], [14, 14], [22, 22]], '#e8f8ff', '#3a7fd0', 1);
  poly(x, [[48, 30], [42, 22], [36, 28], [40, 34]], '#bfe8ff', '#3a7fd0', 1);
  poly(x, [[46, 24], [50, 14], [42, 22]], '#e8f8ff', '#3a7fd0', 1);
  // 두건
  ell(x, 32, 19, 10, 11, '#2148a8');
  poly(x, [[24, 16], [30, 2], [36, 12]], '#2148a8');
  ell(x, 34, 21, 6.5, 7.5, '#0a1430');
  // 얼굴
  ell(x, 35, 22, 4.5, 5.5, '#f1c9a5');
  ell(x, 37, 21, 1.1, 1.1, '#9fe8ff');
  line(x, 33, 26, 37, 26, '#e8e8e8', 2.5); // 수염
  // 지팡이
  line(x, 48, 14, 45, 70, '#6a4423', 3.2);
  line(x, 48, 14, 45, 70, '#a8743c', 1.2);
  poly(x, [[48, 2], [52, 10], [48, 18], [44, 10]], '#bff1ff', '#ffffff', 1);
  poly(x, [[48, 5], [50, 10], [48, 15], [46, 10]], '#ffffff');
  // 손
  ell(x, 46, 40, 3.2, 3.2, '#f1c9a5');
}

// ---------- 언데드 ----------
function drawGhoul(x) {
  line(x, 24, 40, 18, 54, '#3e463b', 4); line(x, 32, 42, 36, 55, '#3e463b', 4);
  line(x, 18, 54, 13, 55, '#3e463b', 3); line(x, 36, 55, 42, 56, '#3e463b', 3);
  ell(x, 28, 35, 13, 10, lg(x, 0, 25, 0, 45, [[0, '#8d9b83'], [1, '#4b5646']]), -0.35);
  for (let i = 0; i < 4; i++) ell(x, 18 + i * 5, 27 - i * 1.5 + (i > 1 ? 1 : 0), 2.2, 2, '#5c6656');
  line(x, 24, 34, 31, 38, '#5b6653', 1.5); line(x, 25, 38, 32, 41, '#5b6653', 1.5);
  // 팔
  line(x, 36, 31, 46, 38, '#7a8872', 3.5); line(x, 46, 38, 53, 40, '#7a8872', 3);
  line(x, 53, 40, 57, 37, '#d7d3c0', 1.2); line(x, 53, 40, 58, 41, '#d7d3c0', 1.2); line(x, 53, 40, 56, 44, '#d7d3c0', 1.2);
  // 머리
  ell(x, 42, 26, 8, 7, lg(x, 0, 19, 0, 33, [[0, '#a4b298'], [1, '#6c7964']]));
  poly(x, [[42, 30], [50, 29], [49, 34], [42, 33]], '#59624f');
  line(x, 44, 31, 49, 31, '#e6e2cf', 1);
  eyes(x, [[45, 24], [49, 25]], '#ffe14a', 1.5);
}
function drawSkeleton(x) {
  const b = '#e3dcc6', d = '#9a937f';
  line(x, 28, 46, 23, 60, b, 3); line(x, 33, 46, 37, 60, b, 3);
  line(x, 23, 60, 19, 61, b, 3); line(x, 37, 60, 42, 61, b, 3);
  poly(x, [[25, 43], [36, 43], [34, 48], [27, 48]], b, d);
  line(x, 30, 26, 30, 44, d, 2.5);
  for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(30, 30 + i * 3.4, 8 - i, 2.2, 0, Math.PI * 0.05, Math.PI * 0.95); x.strokeStyle = b; x.lineWidth = 1.8; x.stroke(); }
  // 방패
  ell(x, 20, 36, 8, 9, lg(x, 12, 27, 28, 45, [[0, '#7a5530'], [1, '#3e2812']]));
  x.beginPath(); x.ellipse(20, 36, 8, 9, 0, 0, 7); x.strokeStyle = '#a0a6ad'; x.lineWidth = 1.6; x.stroke();
  ell(x, 20, 36, 2, 2, '#a0a6ad');
  // 검
  line(x, 34, 28, 42, 36, b, 2.5);
  line(x, 42, 36, 56, 16, '#c8cfd8', 3); line(x, 42, 36, 56, 16, '#eef3f8', 1);
  line(x, 39, 33, 45, 39, '#7a5530', 2.5);
  // 두개골
  ell(x, 31, 17, 8, 8.5, rg(x, 29, 14, 10, [[0, '#fbf6e6'], [1, '#bdb59d']]));
  poly(x, [[28, 22], [36, 22], [35, 27], [29, 27]], '#d6cfb8');
  line(x, 30, 24.5, 35, 24.5, '#6a6352', 1);
  ell(x, 33, 16, 2.4, 2.6, '#1b1210'); ell(x, 38, 16.5, 1.9, 2.4, '#1b1210');
  eyes(x, [[33, 16], [38, 16.5]], '#ff3b2a', 1.1);
}
function drawZombie(x) {
  line(x, 27, 46, 25, 61, '#3d3328', 6); line(x, 37, 46, 40, 61, '#3d3328', 6);
  poly(x, [[20, 26], [44, 26], [46, 48], [18, 48]], lg(x, 0, 26, 0, 48, [[0, '#6e5b44'], [1, '#3e3226']]));
  poly(x, [[18, 48], [22, 44], [26, 50], [31, 44], [35, 50], [40, 44], [46, 48], [44, 52], [20, 52]], '#3e3226');
  ell(x, 31, 36, 4, 5, '#6f8a52'); // 찢어진 옷 사이 살갗
  // 팔 (앞으로 뻗음)
  line(x, 40, 30, 58, 31, '#7e9a5e', 5); line(x, 38, 36, 56, 38, '#6f8a52', 5);
  line(x, 40, 30, 48, 30, '#6e5b44', 6);
  ell(x, 34, 18, 9, 9, lg(x, 0, 9, 0, 27, [[0, '#93ad72'], [1, '#5e7744']]));
  line(x, 36, 23, 42, 23, '#2c3a20', 2);
  eyes(x, [[37, 16], [42, 16.5]], '#8dff5a', 1.6);
  line(x, 27, 12, 31, 9, '#3a3020', 1.2); line(x, 31, 10, 35, 9, '#3a3020', 1.2);
}
function drawGargoyle(x) {
  const wing = (s) => {
    x.save(); x.translate(38, 28); x.scale(s, 1);
    poly(x, [[0, 0], [-10, -18], [-26, -22], [-36, -12], [-32, -6], [-26, -2], [-20, 2], [-12, 4]], lg(x, 0, -22, 0, 4, [[0, '#5e566e'], [1, '#2f2a3b']]), '#1c1826', 1.2);
    line(x, 0, 0, -26, -22, '#26212f', 1.5); line(x, -6, -6, -36, -12, '#26212f', 1); line(x, -6, -3, -26, -2, '#26212f', 1);
    x.restore();
  };
  wing(1); wing(-0.55);
  line(x, 34, 40, 30, 52, '#4c4757', 4); line(x, 42, 40, 46, 52, '#4c4757', 4);
  x.beginPath(); x.moveTo(30, 40); x.quadraticCurveTo(14, 50, 10, 40); x.strokeStyle = '#4c4757'; x.lineWidth = 3; x.stroke();
  ell(x, 38, 34, 9, 10, lg(x, 0, 24, 0, 44, [[0, '#8a8498'], [1, '#4b4558']]));
  ell(x, 44, 22, 7, 6.5, lg(x, 0, 15, 0, 29, [[0, '#948ea2'], [1, '#5a5468']]));
  poly(x, [[40, 18], [36, 8], [43, 16]], '#cfc7b0'); poly(x, [[46, 17], [48, 7], [49, 17]], '#cfc7b0');
  poly(x, [[47, 25], [54, 24], [50, 28]], '#3a3546');
  eyes(x, [[46, 21], [50, 21.5]], '#ff2a2a', 1.3);
}
function drawNecro(x) {
  line(x, 50, 10, 47, 70, '#2a1a10', 3);
  ell(x, 50, 9, 5, 5, '#d8d0b8'); ell(x, 49, 8, 1.2, 1.2, '#42ff70'); ell(x, 52, 8, 1.2, 1.2, '#42ff70');
  poly(x, [[30, 18], [14, 68], [48, 68]], lg(x, 0, 18, 0, 68, [[0, '#4a2a68'], [0.6, '#2c1840'], [1, '#170b24']]));
  poly(x, [[14, 68], [48, 68], [46, 63], [16, 63]], '#3fbf5e');
  line(x, 31, 28, 31, 63, '#3fbf5e', 1.5);
  poly(x, [[30, 6], [40, 22], [36, 32], [24, 32], [20, 22]], '#2a1640');
  ell(x, 32, 24, 5.5, 6.5, '#0b0612');
  ell(x, 33, 25, 4, 5, '#cfc6b0');
  eyes(x, [[33, 23.5], [36, 24]], '#42ff70', 1.2);
  line(x, 38, 38, 47, 36, '#2c1840', 4); ell(x, 47, 36, 2.5, 2.5, '#cfc6b0');
}
function drawFiend(x) {
  const leg = (sx, sy, kx, ky, ex, ey) => { line(x, sx, sy, kx, ky, '#22322f', 3.5); line(x, kx, ky, ex, ey, '#22322f', 2.5); };
  leg(36, 36, 26, 22, 14, 52); leg(40, 36, 36, 18, 28, 56); leg(46, 36, 50, 18, 46, 58);
  leg(50, 36, 62, 22, 66, 56); leg(42, 38, 30, 44, 22, 58); leg(48, 38, 58, 44, 60, 60);
  ell(x, 30, 32, 18, 13, lg(x, 0, 19, 0, 45, [[0, '#527a71'], [1, '#22392f']]));
  for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(30, 32, 14 - i * 4, 9 - i * 3, 0, Math.PI * 1.1, Math.PI * 1.9); x.strokeStyle = '#7fb3a4'; x.lineWidth = 1.4; x.stroke(); }
  poly(x, [[22, 22], [20, 12], [26, 20]], '#a7cfc0'); poly(x, [[30, 20], [30, 9], [34, 19]], '#a7cfc0');
  ell(x, 54, 32, 10, 9, lg(x, 0, 23, 0, 41, [[0, '#668f84'], [1, '#2c463d']]));
  line(x, 62, 34, 70, 38, '#cfd8c0', 2); line(x, 62, 30, 70, 28, '#cfd8c0', 2);
  eyes(x, [[58, 29], [61, 31], [57, 33]], '#a8ff3a', 1.2);
}
function drawAbom(x, w, h, patch) {
  const skin = patch ? ['#a3c09a', '#4f6b52'] : ['#d8c3b2', '#8a7064'];
  line(x, 40, 72, 36, 92, patch ? '#4f6b52' : '#7b6157', 11); line(x, 62, 72, 66, 92, patch ? '#4f6b52' : '#7b6157', 11);
  // 갈고리 팔
  line(x, 28, 50, 12, 62, skin[1], 7);
  x.beginPath(); x.arc(10, 72, 8, -Math.PI * 0.5, Math.PI * 0.8); x.strokeStyle = '#9aa2aa'; x.lineWidth = 3; x.stroke();
  ell(x, 50, 56, 30, 27, rg(x, 44, 46, 36, [[0, skin[0]], [1, skin[1]]]));
  // 상처와 꿰맨 자국
  ell(x, 48, 64, 9, 7, '#5a1d1d'); ell(x, 48, 64, 6, 4, patch ? '#6dff4a' : '#9a3b2b');
  x.setLineDash([3, 3]); x.strokeStyle = '#3a2320'; x.lineWidth = 1.5;
  x.beginPath(); x.moveTo(30, 44); x.quadraticCurveTo(50, 36, 72, 48); x.stroke();
  x.beginPath(); x.moveTo(60, 60); x.lineTo(74, 72); x.stroke(); x.setLineDash([]);
  for (let i = 0; i < 6; i++) line(x, 32 + i * 7, 41 - (i % 2), 33 + i * 7, 47 - (i % 2), '#3a2320', 1.2);
  // 식칼 팔
  line(x, 74, 46, 88, 38, skin[1], 7);
  poly(x, [[84, 22], [100, 20], [100, 42], [88, 44]], lg(x, 84, 20, 100, 44, [[0, '#d5dde4'], [1, '#6a737c']]), '#2b3036', 1.2);
  if (patch) { // 갑옷판
    poly(x, [[26, 32], [44, 26], [46, 36], [28, 42]], '#5a6470', '#222', 1);
    poly(x, [[60, 26], [76, 32], [74, 42], [58, 36]], '#5a6470', '#222', 1);
  }
  ell(x, 66, 26, 10, 9, lg(x, 0, 17, 0, 35, [[0, skin[0]], [1, skin[1]]]));
  poly(x, [[64, 30], [76, 30], [74, 35], [65, 35]], '#3a1414');
  eyes(x, [[68, 23], [73, 24]], patch ? '#ff3030' : '#ffe14a', 1.6);
}
function drawKT(x) {
  // 하단 망령 꼬리
  poly(x, [[30, 70], [74, 70], [80, 96], [70, 88], [62, 104], [52, 90], [42, 106], [34, 88], [24, 98]], lg(x, 0, 70, 0, 106, [[0, '#2b2f78'], [1, 'rgba(60,80,200,0.1)']]));
  poly(x, [[34, 34], [70, 34], [78, 74], [26, 74]], lg(x, 0, 34, 0, 74, [[0, '#3b3f9a'], [0.6, '#22245e'], [1, '#14163c']]));
  line(x, 52, 38, 52, 74, '#d9b24c', 3);
  poly(x, [[26, 74], [78, 74], [77, 70], [27, 70]], '#d9b24c');
  // 견갑
  poly(x, [[18, 38], [30, 24], [42, 34], [34, 44]], '#4148a8', '#d9b24c', 1.5);
  poly(x, [[86, 38], [74, 24], [62, 34], [70, 44]], '#4148a8', '#d9b24c', 1.5);
  poly(x, [[24, 28], [18, 14], [30, 26]], '#cfeaff'); poly(x, [[80, 28], [86, 14], [74, 26]], '#cfeaff');
  // 해골 머리
  ell(x, 52, 24, 11, 12, rg(x, 49, 20, 14, [[0, '#f2ecda'], [1, '#a59c84']]));
  poly(x, [[46, 30], [58, 30], [57, 38], [47, 38]], '#cfc6ae');
  for (let i = 0; i < 4; i++) line(x, 48 + i * 3, 33, 48 + i * 3, 37, '#5a5242', 1);
  ell(x, 48, 22, 3, 3.4, '#0b0b18'); ell(x, 56, 22, 3, 3.4, '#0b0b18');
  eyes(x, [[48, 22], [56, 22]], '#6fe0ff', 2);
  // 손
  ell(x, 22, 54, 4, 4, '#d8d0b8'); ell(x, 82, 54, 4, 4, '#d8d0b8');
}
function drawLK(x) {
  // 망토
  poly(x, [[34, 36], [82, 36], [96, 118], [20, 118]], lg(x, 0, 36, 0, 118, [[0, '#2a2f3e'], [1, '#0c0e14']]));
  // 다리/갑옷
  poly(x, [[42, 82], [54, 82], [52, 116], [40, 116]], '#3c4558'); poly(x, [[62, 82], [74, 82], [76, 116], [64, 116]], '#3c4558');
  poly(x, [[38, 40], [78, 40], [80, 86], [36, 86]], lg(x, 0, 40, 0, 86, [[0, '#6c7a92'], [0.5, '#3c465a'], [1, '#232a38']]), '#11141c', 1.5);
  line(x, 58, 44, 58, 84, '#7fe0ff', 1.5);
  x.save(); x.shadowColor = '#5fd0ff'; x.shadowBlur = 8;
  poly(x, [[52, 54], [64, 54], [58, 66]], '#9fe8ff'); x.restore();
  // 견갑 (해골)
  poly(x, [[24, 46], [32, 28], [50, 34], [44, 50]], '#5a667e', '#11141c', 1.5);
  poly(x, [[92, 46], [84, 28], [66, 34], [72, 50]], '#5a667e', '#11141c', 1.5);
  ell(x, 34, 40, 5, 5, '#d8d0b8'); ell(x, 82, 40, 5, 5, '#d8d0b8');
  // 투구 (왕관)
  ell(x, 58, 26, 13, 14, lg(x, 0, 12, 0, 40, [[0, '#8c99b0'], [1, '#3a4256']]));
  const spikes = [[44, 22, 38, 2], [50, 18, 48, -2], [58, 16, 58, -6], [66, 18, 68, -2], [72, 22, 78, 2]];
  for (const [a, b, c, d] of spikes) poly(x, [[a - 3, b], [c, d], [a + 3, b]], '#9aa8c0', '#2a3040', 1);
  poly(x, [[48, 26], [68, 26], [66, 34], [50, 34]], '#0b0e16');
  eyes(x, [[54, 29], [62, 29]], '#7fe8ff', 2.2);
  // 서리한
  x.save(); x.translate(84, 64); x.rotate(0.5);
  poly(x, [[-4, 0], [4, 0], [3, 56], [0, 64], [-3, 56]], lg(x, -4, 0, 4, 0, [[0, '#9fc6e0'], [0.5, '#e8f6ff'], [1, '#6a90b0']]), '#2a4058', 1);
  x.shadowColor = '#5fd0ff'; x.shadowBlur = 6;
  for (let i = 0; i < 5; i++) line(x, 0, 10 + i * 9, 0, 14 + i * 9, '#5fe0ff', 1.5);
  x.shadowBlur = 0;
  poly(x, [[-12, -2], [12, -2], [8, 3], [-8, 3]], '#4a5266', '#11141c', 1);
  line(x, 0, -2, 0, -16, '#2a2f3e', 4);
  ell(x, 0, -18, 4, 4, '#cfc6ae');
  x.restore();
  ell(x, 82, 62, 5, 5, '#3c465a');
}

// ---------- 투사체 ----------
function drawBolt(x, glowRgb, core, mid, sc = 1) {
  const w = x.canvas.width, h = x.canvas.height, cy = h / 2;
  x.save(); x.translate(w * 0.6, cy); x.scale(2.4, 1);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, h * 0.5);
  g.addColorStop(0, `rgba(${glowRgb},0.95)`); g.addColorStop(0.4, `rgba(${glowRgb},0.4)`); g.addColorStop(1, `rgba(${glowRgb},0)`);
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, h * 0.5, 0, 7); x.fill(); x.restore();
  ell(x, w * 0.66, cy, w * 0.16, h * 0.16, mid);
  ell(x, w * 0.7, cy, w * 0.1, h * 0.1, core);
  poly(x, [[w * 0.74, cy - h * 0.1], [w * 0.98, cy], [w * 0.74, cy + h * 0.1]], core);
}
function drawLance(x) {
  const g = x.createLinearGradient(0, 0, 96, 0);
  g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.6, 'rgba(150,215,255,0.5)'); g.addColorStop(1, 'rgba(200,240,255,0.7)');
  x.fillStyle = g; x.fillRect(0, 4, 96, 12);
  poly(x, [[18, 10], [70, 5], [95, 10], [70, 15]], lg(x, 0, 5, 0, 15, [[0, '#ffffff'], [0.5, '#9fdcff'], [1, '#4aa0e8']]), '#e8f8ff', 0.8);
  line(x, 40, 10, 92, 10, '#ffffff', 1);
}
function drawCrystal(x, w, h, tail, cols = ['#ffffff', '#a8e0ff', '#4a90d8']) {
  const cy = h / 2;
  poly(x, [[w * 0.05, cy], [w * 0.55, cy - h * 0.42], [w, cy], [w * 0.55, cy + h * 0.42]], lg(x, 0, 0, 0, h, [[0, cols[0]], [0.5, cols[1]], [1, cols[2]]]), 'rgba(255,255,255,.8)', 0.6);
  line(x, w * 0.3, cy, w * 0.95, cy, '#fff', 0.8);
}
function drawSpike(x) {
  x.save(); x.shadowColor = '#7fd4ff'; x.shadowBlur = 14;
  poly(x, [[4, 25], [60, 6], [138, 25], [60, 44]], lg(x, 0, 6, 0, 44, [[0, '#ffffff'], [0.4, '#b7e6ff'], [1, '#3b82d0']]), '#ffffff', 1.2);
  x.restore();
  poly(x, [[30, 25], [70, 12], [80, 20]], 'rgba(255,255,255,.6)');
  poly(x, [[40, 30], [90, 34], [70, 38]], 'rgba(60,120,200,.5)');
  poly(x, [[50, 8], [58, 0], [64, 10]], '#d8f4ff'); poly(x, [[70, 40], [80, 50], [84, 38]], '#9fd4ff');
  line(x, 20, 25, 132, 25, '#fff', 1.2);
}
function drawOrbBlob(x, s, [a, b, c]) {
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, a); g.addColorStop(0.35, b); g.addColorStop(1, c);
  x.fillStyle = g; x.beginPath(); x.arc(s / 2, s / 2, s / 2, 0, 7); x.fill();
}

// ---------- 장식물 ----------
function drawRock(x) {
  ell(x, 35, 40, 30, 8, 'rgba(0,0,0,.35)');
  poly(x, [[6, 40], [12, 20], [28, 10], [48, 12], [62, 26], [64, 40]], lg(x, 0, 10, 0, 40, [[0, '#6b7486'], [1, '#2e3442']]), '#1c2029', 1.5);
  poly(x, [[12, 20], [28, 8], [48, 10], [62, 24], [52, 22], [40, 18], [24, 22]], '#e6f0fa');
  line(x, 30, 26, 38, 36, '#1c2029', 1);
}
function drawPine(x) {
  ell(x, 35, 102, 22, 6, 'rgba(0,0,0,.35)');
  line(x, 35, 100, 35, 84, '#3a2616', 6);
  for (let i = 0; i < 4; i++) {
    const y = 88 - i * 20, w = 30 - i * 6;
    poly(x, [[35 - w, y], [35, y - 32], [35 + w, y]], i % 2 ? '#1d3a2e' : '#183226', '#0c1a14', 1);
    poly(x, [[35 - w * 0.7, y - 8], [35, y - 32], [35 + w * 0.5, y - 12], [35, y - 18]], '#e8f2fa');
  }
}
function drawDeadTree(x) {
  ell(x, 40, 94, 22, 6, 'rgba(0,0,0,.35)');
  const br = (x0, y0, a, len, w, d) => {
    if (d === 0) return;
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    line(x, x0, y0, x1, y1, '#2a221c', w); if (d > 2) line(x, x0, y0, x1, y1, '#e0ebf5', w * 0.25);
    br(x1, y1, a - 0.45, len * 0.7, w * 0.65, d - 1); br(x1, y1, a + 0.4, len * 0.66, w * 0.6, d - 1);
  };
  br(40, 94, -Math.PI / 2, 34, 7, 5);
}
function drawGrave(x) {
  ell(x, 18, 42, 14, 4, 'rgba(0,0,0,.35)');
  poly(x, [[6, 42], [6, 14], [10, 6], [26, 6], [30, 14], [30, 42]], lg(x, 0, 6, 0, 42, [[0, '#8a909c'], [1, '#4a4f5a']]), '#22252c', 1.2);
  poly(x, [[6, 14], [10, 4], [26, 4], [30, 14], [24, 11], [12, 12]], '#eef5fb');
  line(x, 18, 16, 18, 32, '#33373f', 2); line(x, 12, 21, 24, 21, '#33373f', 2);
}
function drawSaronite(x) {
  ell(x, 30, 64, 24, 6, 'rgba(0,0,0,.35)');
  x.save(); x.shadowColor = '#3cffd0'; x.shadowBlur = 8;
  poly(x, [[20, 64], [26, 14], [34, 64]], lg(x, 0, 14, 0, 64, [[0, '#7fffe0'], [0.3, '#1d6b62'], [1, '#0a2a28']]), '#062019', 1);
  poly(x, [[30, 64], [42, 26], [48, 64]], lg(x, 0, 26, 0, 64, [[0, '#7fffe0'], [0.3, '#1d6b62'], [1, '#0a2a28']]), '#062019', 1);
  poly(x, [[8, 64], [14, 40], [22, 64]], lg(x, 0, 40, 0, 64, [[0, '#5fe8c8'], [1, '#0a2a28']]), '#062019', 1);
  x.restore();
}
function drawIceCluster(x) {
  ell(x, 30, 54, 24, 6, 'rgba(0,0,0,.3)');
  const c = (pts) => poly(x, pts, lg(x, 0, 10, 0, 56, [[0, '#ffffff'], [0.4, '#a6dcff'], [1, '#3b7cc0']]), '#e8f8ff', 1);
  c([[14, 54], [20, 22], [28, 54]]); c([[24, 54], [32, 8], [40, 54]]); c([[36, 54], [46, 28], [50, 54]]);
}
function drawBones(x) {
  line(x, 4, 18, 22, 12, '#cfc8b2', 3); line(x, 14, 20, 34, 18, '#cfc8b2', 3);
  ell(x, 30, 10, 6, 5.5, '#ddd6c0'); ell(x, 32, 10, 1.6, 1.8, '#222'); ell(x, 28, 10, 1.6, 1.8, '#222');
}

// ---------- 지형 (노스렌드 설원, 이음매 없는 타일) ----------
function drawGround(x, w, h) {
  x.fillStyle = '#1f2a39'; x.fillRect(0, 0, w, h);
  const blob = (cx, cy, r, col, sy = 1) => {
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
      const g = x.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.save(); x.translate(cx + ox, cy + oy); x.scale(1, sy); x.translate(-(cx + ox), -(cy + oy));
      x.fillRect(cx + ox - r, cy + oy - r, r * 2, r * 2); x.restore();
    }
  };
  let s = 7;
  const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 40; i++) blob(R() * w, R() * h, 60 + R() * 120, `rgba(${R() < 0.5 ? '70,90,120' : '18,24,34'},${0.25 + R() * 0.25})`, 0.6 + R() * 0.4);
  for (let i = 0; i < 26; i++) blob(R() * w, R() * h, 40 + R() * 80, `rgba(150,175,205,${0.08 + R() * 0.1})`, 0.4 + R() * 0.3);
  for (let i = 0; i < 10; i++) blob(R() * w, R() * h, 30 + R() * 50, `rgba(90,150,210,${0.12 + R() * 0.1})`, 0.35);
  // 눈 결정 반짝임
  for (let i = 0; i < 700; i++) {
    x.fillStyle = `rgba(${R() < 0.5 ? '220,235,255' : '120,140,170'},${0.05 + R() * 0.2})`;
    x.fillRect(R() * w, R() * h, R() < 0.9 ? 1 : 2, 1);
  }
  // 얼음 균열
  x.strokeStyle = 'rgba(160,210,255,0.08)'; x.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    let px = R() * w, py = R() * h; x.beginPath(); x.moveTo(px, py);
    for (let j = 0; j < 5; j++) { px += (R() - 0.5) * 50; py += (R() - 0.5) * 30; x.lineTo(px, py); }
    x.stroke();
  }
}
