'use strict';
// ================= 렌더링 =================
G.R = {
  init() {
    this.cv = $('cv'); this.c = this.cv.getContext('2d');
    this.snow = [];
    for (let i = 0; i < 160; i++) this.snow.push({ x: Math.random(), y: Math.random(), s: U.rand(0.6, 2.4), v: U.rand(20, 60), ph: Math.random() * 6 });
    addEventListener('resize', () => this.resize());
    this.resize();
  },
  // 시야 고정: 해상도 · 화면비와 상관없이 세상은 항상 VIEW_W × VIEW_H만 보인다 (랭킹 공정성).
  // 화면에 맞게 확대/축소하고, 16:9보다 넓거나 좁으면 남는 띠에는 바닥만 어둡게 이어 그린다.
  // G.W · G.H는 이 논리 시야 크기이고, 실제 화면 크기는 this.SW · this.SH다.
  VIEW_W: 1920, VIEW_H: 1080,
  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.SW = innerWidth; this.SH = innerHeight;
    G.W = this.VIEW_W; G.H = this.VIEW_H;
    this.s = Math.min(this.SW / G.W, this.SH / G.H);
    this.ox = (this.SW - G.W * this.s) / 2; this.oy = (this.SH - G.H * this.s) / 2;
    this.cv.width = Math.round(this.SW * this.dpr); this.cv.height = Math.round(this.SH * this.dpr);
    this.vig = G.Spr.make(G.W, G.H, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,4,18,0.75)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
    this.lowhp = G.Spr.make(G.W, G.H, (x, w, h) => {
      const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, 'rgba(160,0,0,0.6)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
  },

  // ---------- 파티클/효과 갱신 (게임 시간) ----------
  fxUpdate(dt) {
    for (const p of G.parts) {
      p.life -= dt;
      if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
      p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    G.parts = G.parts.filter(p => p.life > 0);
    for (const r of G.rings) r.t += dt;
    G.rings = G.rings.filter(r => r.t < r.dur);
    for (const t of G.texts) { t.t += dt; t.y += t.vy * dt; t.x += t.vx * dt; t.vy *= 0.94; }
    G.texts = G.texts.filter(t => t.t < t.max);
  },
  zoneFx(z, dt) {
    if (z.kind === 'blizzard') {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * z.r, x = z.x + Math.cos(a) * r, y = z.y + Math.sin(a) * r * 0.75;
        G.fx.part({ x: x - 60, y: y - 160, vx: 300, vy: 800, life: 0.2, size: U.rand(4, 7), size1: 3, rgb: '230,248,255', type: 'shard', add: false, rot: 1.2, vr: 0 });
        if (Math.random() < 0.4) G.fx.part({ x, y, life: 0.3, size: U.rand(10, 18), rgb: '120,190,255' });
      }
    } else if (z.kind === 'burn' && z.target && !z.target.dead && Math.random() < 0.5) {
      G.fx.part({ x: z.target.x + U.rand(-8, 8), y: z.target.y - U.rand(0, 20), vy: -60, life: 0.4, size: U.rand(6, 11), rgb: Math.random() < 0.5 ? '255,130,40' : '200,90,255' });
    } else if (z.kind === 'singularity') {
      // 바깥에서 중심으로 빨려 들어가는 입자
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * 6.28, r = z.r * U.rand(0.7, 1), x = z.x + Math.cos(a) * r, y = z.y + Math.sin(a) * r * 0.75;
        G.fx.part({ x, y, vx: (z.x - x) * 2.2 - Math.sin(a) * 60, vy: (z.y - y) * 2.2 + Math.cos(a) * 45, life: 0.45, size: U.rand(5, 9), size1: 1, rgb: Math.random() < 0.5 ? '140,80,230' : '200,160,255' });
      }
    } else if (z.kind === 'tinted' && Math.random() < 0.3) {
      G.fx.part({ x: z.x + U.rand(-z.r, z.r) * 0.7, y: z.y + U.rand(-z.r, z.r) * 0.5, vy: -30, life: 0.8, size: U.rand(4, 8), rgb: z.color });
    } else if (z.kind === 'poison' && Math.random() < 0.3) {
      G.fx.part({ x: z.x + U.rand(-z.r, z.r) * 0.7, y: z.y + U.rand(-z.r, z.r) * 0.5, vy: -30, life: 0.8, size: U.rand(4, 8), rgb: '120,255,60' });
    } else if (z.kind === 'defile' && Math.random() < 0.6) {
      const a = Math.random() * 6.28;
      G.fx.part({ x: z.x + Math.cos(a) * z.r, y: z.y + Math.sin(a) * z.r * 0.8, vx: -Math.sin(a) * 60, vy: Math.cos(a) * 60 - 20, life: 0.7, size: U.rand(8, 14), rgb: '120,30,160' });
    }
  },

  draw(realDt) {
    const c = this.c, W = G.W, H = G.H, cam = G.cam, k = this.dpr * this.s;
    c.setTransform(k, 0, 0, k, this.dpr * this.ox, this.dpr * this.oy);
    let sx = 0, sy = 0;
    if (cam.shake > 0) { sx = U.rand(-cam.shake, cam.shake); sy = U.rand(-cam.shake, cam.shake); }
    const ox = Math.round(W / 2 - cam.x + sx), oy = Math.round(H / 2 - cam.y + sy);
    // 화면 전체(띠 포함)의 논리 좌표 범위
    const bx = this.ox / this.s, by = this.oy / this.s, sx0 = -bx, sy0 = -by, sx1 = W + bx, sy1 = H + by;
    // 지형 (띠까지)
    const T = 512, theme = G.theme(), g = G.Spr.groundFor((G.state !== 'menu' && G.Waves.stage && G.Waves.stage.theme) || 'icecrown');
    const gx = sx0 - ((((sx0 - ox) % T) + T) % T), gy = sy0 - ((((sy0 - oy) % T) + T) % T);
    for (let x = gx; x < sx1; x += T) for (let y = gy; y < sy1; y += T) c.drawImage(g, x, y);
    c.save(); c.translate(ox, oy);
    this.drawDecor(c, cam.x - W / 2 - bx - 100, cam.y - H / 2 - by - 120, cam.x + W / 2 + bx + 100, cam.y + H / 2 + by + 160);
    c.restore();
    // 유닛 · 효과는 시야 안에만
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip(); c.translate(ox, oy);
    const vx0 = cam.x - W / 2 - 100, vy0 = cam.y - H / 2 - 120, vx1 = cam.x + W / 2 + 100, vy1 = cam.y + H / 2 + 160;
    if (G.state !== 'menu' && G.player) {
      for (const z of G.zones) this.drawZone(c, z);
      for (const k of G.tele) this.drawTele(c, k);
      this.drawPickups(c);
      this.drawUnits(c, vx0, vy0, vx1, vy1);
      this.drawProjs(c);
      this.drawParts(c);
      this.drawRings(c);
      this.drawTexts(c);
    }
    c.restore();
    this.drawSnow(c, realDt, theme.particles);
    c.drawImage(this.vig, 0, 0);
    const p = G.player;
    if (G.state === 'play' && p && p.hp / p.maxHp < 0.3) { c.globalAlpha = 0.5 + Math.sin(performance.now() / 200) * 0.3; c.drawImage(this.lowhp, 0, 0); c.globalAlpha = 1; }
    if (bx > 0.5 || by > 0.5) this.drawBars(c, W, H, bx, by);
  },
  // 시야 밖 띠: 어둡게 덮고 경계는 그라데이션으로 부드럽게
  drawBars(c, W, H, bx, by) {
    const F = 60, dark = 'rgba(2,4,10,0.82)', clear = 'rgba(2,4,10,0)';
    c.fillStyle = dark;
    if (bx > 0.5) {
      c.fillRect(-bx, -by, bx, H + by * 2); c.fillRect(W, -by, bx, H + by * 2);
      let g = c.createLinearGradient(0, 0, F, 0); g.addColorStop(0, dark); g.addColorStop(1, clear); c.fillStyle = g; c.fillRect(0, 0, F, H);
      g = c.createLinearGradient(W, 0, W - F, 0); g.addColorStop(0, dark); g.addColorStop(1, clear); c.fillStyle = g; c.fillRect(W - F, 0, F, H);
    }
    if (by > 0.5) {
      c.fillStyle = dark;
      c.fillRect(0, -by, W, by); c.fillRect(0, H, W, by);
      let g = c.createLinearGradient(0, 0, 0, F); g.addColorStop(0, dark); g.addColorStop(1, clear); c.fillStyle = g; c.fillRect(0, 0, W, F);
      g = c.createLinearGradient(0, H, 0, H - F); g.addColorStop(0, dark); g.addColorStop(1, clear); c.fillStyle = g; c.fillRect(0, H - F, W, F);
    }
  },
  // 화면(CSS 픽셀) 좌표 → 논리 시야 좌표
  toView(x, y) { return [(x - this.ox) / this.s, (y - this.oy) / this.s]; },

  drawDecor(c, x0, y0, x1, y1) {
    const CH = 340, D = G.Spr.decor, th = G.theme(), types = th.decor, glows = th.glow || {};
    for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++) {
      const n = Math.floor(U.hash(cx, cy, 1) * 2.4);
      for (let i = 0; i < n; i++) {
        if (Math.abs(cx) <= 0 && Math.abs(cy) <= 0) continue;
        const t = types[Math.floor(U.hash(cx, cy, 10 + i) * types.length)], s = D[t];
        const x = cx * CH + U.hash(cx, cy, 20 + i) * CH, y = cy * CH + U.hash(cx, cy, 30 + i) * CH;
        const gc = t === 'saronite' ? '60,255,200' : glows[t];
        if (gc) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35; const gl = G.Spr.glow(gc, 128); c.drawImage(gl, x - 64, y - 70); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
        c.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height));
      }
    }
  },

  drawZone(c, z) {
    const life = Math.min(1, z.life * 2, z.t * 4);
    if (z.kind === 'blizzard') {
      c.save(); c.translate(z.x, z.y); c.scale(1, 0.75);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, z.r);
      g.addColorStop(0, `rgba(140,200,255,${0.22 * life})`); g.addColorStop(0.8, `rgba(90,160,255,${0.16 * life})`); g.addColorStop(1, 'rgba(90,160,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.fill();
      c.strokeStyle = `rgba(210,240,255,${0.35 * life})`; c.lineWidth = 2; c.setLineDash([14, 10]); c.lineDashOffset = -z.t * 40;
      c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.stroke(); c.setLineDash([]);
      c.restore();
    } else if (z.kind === 'comet') {
      const f = z.t / 0.4, x = z.x + 160 * (1 - f), y = z.y - 520 * (1 - f);
      c.strokeStyle = `rgba(150,210,255,${0.4 + f * 0.4})`; c.lineWidth = 2;
      c.beginPath(); c.ellipse(z.x, z.y, z.r * (1.2 - f * 0.4), z.r * 0.6 * (1.2 - f * 0.4), 0, 0, 7); c.stroke();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const tf = Math.max(0, f - i * 0.05); c.globalAlpha = 0.5 - i * 0.07; c.drawImage(G.Spr.glow('110,180,255', 64), z.x + 160 * (1 - tf) - 28, z.y - 520 * (1 - tf) - 28, 56, 56); }
      c.globalAlpha = 1; c.drawImage(G.Spr.glow('200,240,255', 64), x - 24, y - 24, 48, 48);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#eaf8ff'; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill();
    } else if (z.kind === 'novaice') {
      if (!z.spikes) { z.spikes = []; const n = Math.floor(z.r / 6); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * z.r; z.spikes.push([z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * 0.75, U.rand(6, 16), U.rand(-0.4, 0.4)]); } z.max = z.life; }
      const a = Math.min(1, z.life / (z.max * 0.5));
      c.save(); c.translate(z.x, z.y); c.scale(1, 0.75);
      c.fillStyle = `rgba(170,225,255,${0.18 * a})`; c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.fill(); c.restore();
      c.globalAlpha = a;
      for (const [x, y, h, tilt] of z.spikes) {
        c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x + tilt * h, y - h); c.lineTo(x + 4, y); c.closePath();
        c.fillStyle = 'rgba(210,240,255,0.85)'; c.fill(); c.strokeStyle = 'rgba(80,150,230,0.8)'; c.lineWidth = 1; c.stroke();
      }
      c.globalAlpha = 1;
    } else if (z.kind === 'tinted' || z.kind === 'singularity') {
      // 범용 장판 (보스 기술 · 접두어 · 유령 특이점)
      const col = z.kind === 'singularity' ? '110,60,200' : z.color;
      c.save(); c.translate(z.x, z.y); c.scale(1, 0.75);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, z.r);
      g.addColorStop(0, `rgba(${col},${0.42 * life})`); g.addColorStop(0.8, `rgba(${col},${0.25 * life})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.fill();
      c.strokeStyle = `rgba(${col},${0.6 * life})`; c.lineWidth = 2; c.setLineDash([12, 10]); c.lineDashOffset = -z.t * 30;
      c.beginPath(); c.arc(0, 0, z.r * 0.95, 0, 7); c.stroke(); c.setLineDash([]); c.restore();
      if (z.kind === 'singularity') {
        const cy = z.y - 16 + Math.sin(z.t * 3) * 3, cr = 11 + Math.sin(z.t * 8) * 1.5;
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = life; c.drawImage(G.Spr.glow('150,80,255', 128), z.x - 38, cy - 38, 76, 76); c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#12051f'; c.beginPath(); c.arc(z.x, cy, cr, 0, 7); c.fill();
        c.strokeStyle = 'rgba(210,170,255,0.8)'; c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1;
      }
    } else if (z.kind === 'poison') {
      c.save(); c.translate(z.x, z.y); c.scale(1, 0.75);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, z.r);
      g.addColorStop(0, `rgba(110,220,40,${0.4 * life})`); g.addColorStop(1, 'rgba(60,140,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.fill(); c.restore();
    } else if (z.kind === 'defile') {
      c.save(); c.translate(z.x, z.y); c.scale(1, 0.8);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, z.r);
      g.addColorStop(0, `rgba(10,0,20,${0.85 * life})`); g.addColorStop(0.75, `rgba(50,10,70,${0.75 * life})`); g.addColorStop(1, 'rgba(110,30,160,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.fill();
      c.strokeStyle = `rgba(170,70,230,${0.6 * life})`; c.lineWidth = 3; c.setLineDash([20, 12]); c.lineDashOffset = z.t * 30;
      c.beginPath(); c.arc(0, 0, z.r * 0.92, 0, 7); c.stroke(); c.setLineDash([]); c.restore();
    }
  },

  drawTele(c, k) {
    const f = k.t / k.max;
    if (k.shape === 'cone') { // 부채꼴: 판정과 같은 평면 좌표로 그린다
      const a0 = k.a - k.arc / 2, a1 = k.a + k.arc / 2;
      c.save(); c.translate(k.x, k.y);
      c.fillStyle = `rgba(${k.color},0.13)`; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, k.r, a0, a1); c.closePath(); c.fill();
      c.fillStyle = `rgba(${k.color},0.3)`; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, k.r * f, a0, a1); c.closePath(); c.fill();
      c.strokeStyle = `rgba(${k.color},0.9)`; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, k.r, a0, a1); c.closePath(); c.stroke();
      c.restore(); return;
    }
    c.save(); c.translate(k.x, k.y); c.scale(1, 0.75);
    c.fillStyle = `rgba(${k.color},0.13)`; c.beginPath(); c.arc(0, 0, k.r, 0, 7); c.fill();
    c.fillStyle = `rgba(${k.color},0.3)`; c.beginPath(); c.arc(0, 0, k.r * f, 0, 7); c.fill();
    c.strokeStyle = `rgba(${k.color},0.9)`; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, k.r, 0, 7); c.stroke();
    c.restore();
  },

  drawPickups(c) {
    const now = G.t;
    for (const p of G.pickups) {
      const bob = Math.sin(now * 3 + p.bob) * 3;
      if (p.kind === 'xp') {
        const tier = p.v < 5 ? 0 : p.v < 20 ? 1 : p.v < 50 ? 2 : 3, s = G.Spr.gems[tier], sc = 0.7 + tier * 0.15;
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
        c.drawImage(G.Spr.glow(['80,160,255', '80,255,140', '200,110,255', '255,180,60'][tier], 32), p.x - 14, p.y - 16 + bob, 28, 28);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        c.drawImage(s, p.x - 8 * sc, p.y - 10 * sc - 2 + bob, 16 * sc, 20 * sc);
      } else {
        const size = p.kind === 'chest' ? 34 : p.kind === 'gold' ? 18 : 24, im = G.IMG[p.kind === 'gold' ? 'gold' : p.kind];
        const col = p.kind === 'chest' ? '255,200,80' : p.kind === 'gold' ? '255,210,80' : p.kind === 'magnet' ? '120,200,255' : '255,220,160';
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55 + Math.sin(now * 5) * 0.2;
        c.drawImage(G.Spr.glow(col, 64), p.x - size * 1.1, p.y - size * 1.1 + bob, size * 2.2, size * 2.2);
        if (p.kind === 'chest') { c.globalAlpha = 0.25; c.drawImage(G.Spr.glow(col, 64), p.x - 20, p.y - 200, 40, 200); }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        c.fillStyle = '#000'; c.fillRect(p.x - size / 2 - 2, p.y - size / 2 - 2 + bob, size + 4, size + 4);
        c.strokeStyle = p.kind === 'chest' ? '#ffd100' : '#c9a24a'; c.lineWidth = 1.5; c.strokeRect(p.x - size / 2 - 2, p.y - size / 2 - 2 + bob, size + 4, size + 4);
        if (im && im.complete) c.drawImage(im, p.x - size / 2, p.y - size / 2 + bob, size, size);
      }
    }
  },

  drawUnits(c, x0, y0, x1, y1) {
    const p = G.player, list = [];
    for (const e of G.enemies) if (e.x > x0 && e.x < x1 && e.y > y0 && e.y < y1 + 60) list.push(e);
    list.sort((a, b) => a.y - b.y);
    // 그림자
    c.fillStyle = 'rgba(0,0,10,0.35)';
    for (const e of list) { c.beginPath(); c.ellipse(e.x, e.y + e.r * 0.75, e.r * 1.05, e.r * 0.38, 0, 0, 7); c.fill(); }
    c.beginPath(); c.ellipse(p.x, p.y + 12, 15, 6, 0, 0, 7); c.fill();
    for (const e of list) this.drawEnemy(c, e);
    // 보스 오라
    for (const e of list) if (e.boss && e.auraR) {
      c.save(); c.translate(e.x, e.y); c.scale(1, 0.75);
      c.strokeStyle = 'rgba(150,215,255,0.35)'; c.lineWidth = 3; c.setLineDash([10, 8]); c.lineDashOffset = G.t * 20;
      c.beginPath(); c.arc(0, 0, e.auraR, 0, 7); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(120,190,255,0.06)'; c.fill(); c.restore();
    }
    for (const q of G.pets) this.drawWater(c, q);
    for (const im of G.images) if (im.draw) im.draw(c, im); else G.cls().drawBody(c, im.x, im.y, im.face, 0.5, true, im.t);
    this.drawPlayer(c);
    // 머리 위 높이: 보스는 그림이 커서 실제 그림 윗끝에 맞춘다 (그리는 기준은 drawEnemy와 같음)
    const headY = e => e.boss
      ? Math.min(e.y - e.r * 2.6 * e.scale / 1.2, e.y + e.r * 0.85 + (e.def.fly ? -14 : 0) - G.Spr.enemy[e.id].n.height * e.scale * 0.94)
      : e.y - e.r * 2.6 * e.scale / 1.2;
    // 체력바 (피해 입은 적, 정예 · 보스는 이름표와 함께 항상)
    for (const e of list) {
      if (e.hp >= e.maxHp && !e.elite && !e.boss) continue;
      const y = headY(e) - 6;
      if (e.elite || e.boss) { this.drawNameBar(c, e, y); continue; }
      const w = Math.max(24, e.r * 2);
      c.fillStyle = '#000'; c.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 6);
      c.fillStyle = e.elite ? '#e0a020' : '#c81e1e'; c.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4);
    }
    // 지속 피해 아이콘 (체력바 위)
    for (const e of list) if (e.dots || e.haunted > G.t) G.Dots.drawIcons(c, e, headY(e) - 26 + (e.def.fly && !e.boss ? -10 : 0) - (e.elite || e.boss ? 16 : 0));
  },

  // 정예 표시 ① 발밑: 금색 이중 고리 + 돌아가는 가시 (덩치 큰 일반 적과 구분)
  drawEliteRing(c, e) {
    const y = e.y + e.r * 0.8, rx = e.r * 1.45 + 6, ry = rx * 0.42, rot = G.t * 0.9;
    c.save(); c.translate(e.x, y); c.scale(1, ry / rx);
    c.fillStyle = 'rgba(255,190,40,0.12)'; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,205,70,0.95)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,170,30,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, rx - 7, 0, 7); c.stroke();
    c.fillStyle = 'rgba(255,215,90,0.95)';
    for (let i = 0; i < 8; i++) {
      const a = rot + i * Math.PI / 4;
      c.beginPath(); c.moveTo(Math.cos(a) * (rx + 9), Math.sin(a) * (rx + 9));
      c.lineTo(Math.cos(a - 0.09) * rx, Math.sin(a - 0.09) * rx); c.lineTo(Math.cos(a + 0.09) * rx, Math.sin(a + 0.09) * rx); c.fill();
    }
    c.restore();
  },
  // 정예 표시 ② 머리 위: 이름표 + 금테 체력바 (항상 보임). 보스는 붉은 테 (화면 위 보스 프레임과 같은 색)
  drawNameBar(c, e, y) {
    const boss = e.boss, w = Math.max(boss ? 80 : 56, e.r * 2.6), x = e.x - w / 2;
    const [dark, fill, rim] = boss ? ['#3a0c08', '#e0301e', '#ff6a4a'] : ['#3a2a08', '#ffb820', '#ffd25a'];
    c.fillStyle = '#000'; c.fillRect(x - 2, y - 2, w + 4, 9);
    c.fillStyle = dark; c.fillRect(x, y, w, 5);
    c.fillStyle = fill; c.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 5);
    c.strokeStyle = rim; c.lineWidth = 1; c.strokeRect(x - 1.5, y - 1.5, w + 3, 8);
    c.font = `bold ${boss ? 13 : 12}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const label = (boss ? '보스 · ' : '정예 · ') + e.def.name;
    c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(label, e.x, y - 5);
    c.fillStyle = rim; c.fillText(label, e.x, y - 5);
    c.textAlign = 'left';
  },

  drawEnemy(c, e) {
    const set = G.Spr.enemy[e.id], img = e.frozenT > 0 || e.shatterT > G.t ? set.frozen : e.slowT > 0 ? set.chill : set.n;
    const s = e.scale, w = img.width * s, h = img.height * s;
    const moving = e.frozenT <= 0;
    const fly = e.def.fly ? -10 + Math.sin(e.t * 3) * 4 : 0;
    const bob = moving ? Math.abs(Math.sin(e.t * 9)) * -2.5 : 0;
    const sq = moving ? 1 + Math.sin(e.t * 18) * 0.025 : 1;
    if (e.elite || e.boss) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45 + Math.sin(e.t * 4) * 0.15;
      const gr = e.boss ? (e.def.glow || '90,170,255') : '255,190,60';
      c.drawImage(G.Spr.glow(gr, 128), e.x - e.r * 2.2, e.y - e.r * 2.2 + fly, e.r * 4.4, e.r * 4.4);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    if (e.elite) this.drawEliteRing(c, e);
    if (e.dots) G.Dots.drawRing(c, e);
    c.save();
    c.translate(e.x, e.y + e.r * 0.85 + fly + bob);
    if (e.face < 0) c.scale(-1, 1);
    c.scale(1, sq);
    c.drawImage(img, -w / 2, -h * 0.94, w, h);
    if (e.flash > 0) { c.globalAlpha = e.boss ? 0.25 : 0.6; c.drawImage(set.flash, -w / 2, -h * 0.94, w, h); c.globalAlpha = 1; }
    c.restore();
    if (e.wc > 0) {
      for (let i = 0; i < e.wc; i++) { c.fillStyle = '#9fdcff'; c.save(); c.translate(e.x - 5 + i * 10, e.y - e.r * 2.2 * s - 4 + fly); c.rotate(Math.PI / 4); c.fillRect(-3, -3, 6, 6); c.strokeStyle = '#fff'; c.strokeRect(-3, -3, 6, 6); c.restore(); }
    }
    if (e.id === 'kelthuzad' || e.id === 'lichking') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6;
      const ey = e.y + e.r * 0.85 + fly - (e.id === 'lichking' ? 95 : 80) * s;
      c.drawImage(G.Spr.glow('90,200,255', 64), e.x - 30, ey - 30, 60, 60);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  },

  drawPlayer(c) {
    const p = G.player; if (p.dead) return;
    const C = G.cls(p);
    C.drawUnder(c, p);
    C.drawBody(c, p.x, p.y, p.face, 1, false);
    C.drawOver(c, p);
  },

  drawWater(c, q) {
    const x = q.x, y = q.y + Math.sin(q.t * 3) * 3, t = q.t;
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
    c.drawImage(G.Spr.glow('60,150,255', 128), x - 40, y - 60, 80, 90);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // 소용돌이 하체
    c.beginPath(); c.moveTo(x - 12, y - 12);
    for (let i = 0; i <= 10; i++) { const f = i / 10; c.lineTo(x - 12 * (1 - f) + Math.sin(t * 8 + f * 6) * 3 * f, y - 12 + f * 26); }
    for (let i = 10; i >= 0; i--) { const f = i / 10; c.lineTo(x + 12 * (1 - f) + Math.sin(t * 8 + f * 6) * 3 * f, y - 12 + f * 26); }
    c.closePath();
    let g = c.createLinearGradient(0, y - 12, 0, y + 14); g.addColorStop(0, 'rgba(70,160,255,0.85)'); g.addColorStop(1, 'rgba(70,160,255,0)');
    c.fillStyle = g; c.fill();
    // 몸통
    g = c.createRadialGradient(x - 3, y - 26, 2, x, y - 22, 18);
    g.addColorStop(0, 'rgba(230,250,255,0.95)'); g.addColorStop(0.5, 'rgba(90,180,255,0.85)'); g.addColorStop(1, 'rgba(30,90,210,0.7)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y - 22, 14 + Math.sin(t * 5) * 1, 16, 0, 0, 7); c.fill();
    // 팔
    c.beginPath(); c.ellipse(x - 16, y - 24 + Math.sin(t * 4) * 2, 6, 9, 0.5, 0, 7); c.ellipse(x + 16, y - 24 - Math.sin(t * 4) * 2, 6, 9, -0.5, 0, 7); c.fill();
    // 머리
    g = c.createRadialGradient(x - 2, y - 44, 1, x, y - 42, 10);
    g.addColorStop(0, 'rgba(240,252,255,1)'); g.addColorStop(1, 'rgba(60,150,255,0.8)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y - 42, 9, 0, 7); c.fill();
    c.fillStyle = '#ffffff'; c.shadowColor = '#bff'; c.shadowBlur = 6;
    c.fillRect(x + q.face * 2 - 4, y - 44, 3, 2); c.fillRect(x + q.face * 2 + 1, y - 44, 3, 2);
    c.shadowBlur = 0;
    // 물방울 궤도
    for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.09; c.fillStyle = 'rgba(160,220,255,0.8)'; c.beginPath(); c.arc(x + Math.cos(a) * 20, y - 26 + Math.sin(a) * 8, 2, 0, 7); c.fill(); }
  },

  drawProjs(c) {
    const S = G.Spr;
    for (const pr of G.projs) {
      const a = Math.atan2(pr.vy, pr.vx), k = pr.kind;
      if (k === 'orb') { this.drawOrb(c, pr); continue; }
      const map = { frostbolt: [S.bolt, '100,180,255', 44], frostfire: [S.boltFF, '210,110,255', 54], lance: [S.lance, '150,215,255', 30], icicle: [S.icicle, '150,215,255', 22],
        flurry: [S.flurry, '120,190,255', 30], spike: [S.spike, '120,200,255', 90], water: [S.water, '60,150,255', 34], splinter: [S.splinter, '190,110,255', 24],
        shadowbolt: [S.boltShadow, '150,60,240', 44], chaos: [S.boltChaos, '110,255,60', 58], haunt: [S.shadow, '110,130,255', 40], deathcoil: [S.boltCoil, '80,230,100', 44], firebolt: [S.boltFire, '255,130,40', 28] };
      const [img, rgb, gs] = map[k] || map.frostbolt, sc = pr.scale;
      c.globalCompositeOperation = 'lighter';
      c.drawImage(S.glow(rgb, 64), pr.x - gs * sc / 2, pr.y - gs * sc / 2, gs * sc, gs * sc);
      c.save(); c.translate(pr.x, pr.y); c.rotate(a); c.scale(sc, sc);
      c.drawImage(img, -img.width * 0.7, -img.height / 2);
      c.restore();
      c.globalCompositeOperation = 'source-over';
    }
    for (const b of G.eprojs) {
      const img = S.eshots[b.kind] || S.shadow;
      c.globalCompositeOperation = 'lighter';
      c.drawImage(S.glow(EPROJ_RGB[b.kind] || '150,40,230', 64), b.x - 22, b.y - 22, 44, 44);
      c.globalCompositeOperation = 'source-over';
      c.drawImage(img, b.x - 12, b.y - 12, 24, 24);
    }
  },

  drawOrb(c, pr) {
    const x = pr.x, y = pr.y, R = pr.R, fade = Math.min(1, pr.life * 2, pr.t * 5);
    c.save(); c.translate(x, y + 10); c.scale(1, 0.7);
    c.fillStyle = `rgba(120,190,255,${0.08 * fade})`; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
    c.strokeStyle = `rgba(190,230,255,${0.25 * fade})`; c.lineWidth = 2; c.stroke(); c.restore();
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = fade;
    c.drawImage(G.Spr.glow('70,150,255', 128), x - 70, y - 70, 140, 140);
    c.drawImage(G.Spr.glow('170,225,255', 64), x - 30, y - 30, 60, 60);
    c.globalCompositeOperation = 'source-over';
    const g = c.createRadialGradient(x - 5, y - 6, 2, x, y, 20);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(160,220,255,0.95)'); g.addColorStop(1, 'rgba(40,110,230,0.6)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill();
    c.strokeStyle = 'rgba(235,250,255,0.85)'; c.lineWidth = 2.5; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = pr.spin + i * 2.094; c.beginPath(); c.arc(x, y, 26, a, a + 1.2); c.stroke(); }
    c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const a = -pr.spin * 1.3 + i * 2.094; c.beginPath(); c.arc(x, y, 12, a, a + 1.4); c.stroke(); }
    c.globalAlpha = 1;
  },

  drawParts(c) {
    const S = G.Spr;
    c.globalCompositeOperation = 'source-over';
    for (const p of G.parts) {
      if (p.add) continue;
      const f = p.life / p.max, s = p.size1 + (p.size - p.size1) * f;
      c.globalAlpha = Math.min(1, f * 1.5) * p.alpha;
      if (p.type === 'shard') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.drawImage(S.shard, -s / 2, -s, s, s * 2); c.restore(); }
      else if (p.type === 'bone') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.drawImage(S.bone, -6, -3); c.restore(); }
      else if (p.type === 'smoke') { c.fillStyle = `rgba(${p.rgb},0.5)`; c.beginPath(); c.arc(p.x, p.y, s, 0, 7); c.fill(); }
      else { c.fillStyle = `rgb(${p.rgb})`; c.beginPath(); c.arc(p.x, p.y, s * 0.5, 0, 7); c.fill(); }
    }
    c.globalCompositeOperation = 'lighter';
    for (const p of G.parts) {
      if (!p.add) continue;
      const f = p.life / p.max, s = p.size1 + (p.size - p.size1) * f;
      c.globalAlpha = Math.min(1, f * 1.4) * p.alpha;
      c.drawImage(S.glow(p.rgb, 32), p.x - s, p.y - s, s * 2, s * 2);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },

  drawRings(c) {
    for (const r of G.rings) {
      const f = r.t / r.dur, e = 1 - Math.pow(1 - f, 3);
      if (r.kind === 'cone') {
        c.save(); c.translate(r.x, r.y);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r.r * e);
        g.addColorStop(0, `rgba(220,245,255,${0.6 * (1 - f)})`); g.addColorStop(1, `rgba(90,170,255,${0.15 * (1 - f)})`);
        c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r.r * e, r.a - r.half, r.a + r.half); c.closePath(); c.fill();
        c.restore(); continue;
      }
      const rad = r.r0 + (r.r1 - r.r0) * e;
      c.save(); c.translate(r.x, r.y); c.scale(1, 0.75);
      if (r.fill) { c.fillStyle = `rgba(${r.color},${r.fill * (1 - f)})`; c.beginPath(); c.arc(0, 0, rad, 0, 7); c.fill(); }
      c.strokeStyle = `rgba(${r.color},${1 - f})`; c.lineWidth = r.width * (1 - f * 0.5);
      c.beginPath(); c.arc(0, 0, rad, 0, 7); c.stroke(); c.restore();
    }
  },

  drawTexts(c) {
    c.textAlign = 'center'; c.lineJoin = 'round';
    for (const t of G.texts) {
      const f = t.t / t.max;
      let sz = t.size;
      if (t.crit) sz *= f < 0.12 ? 1 + (0.12 - f) * 6 : 1;
      c.font = `900 ${Math.round(sz)}px 'Noto Sans KR','Malgun Gothic',sans-serif`;
      c.globalAlpha = f > 0.6 ? 1 - (f - 0.6) / 0.4 : 1;
      c.lineWidth = 3.5; c.strokeStyle = '#000'; c.strokeText(t.str, t.x, t.y);
      c.fillStyle = t.col; c.fillText(t.str, t.x, t.y);
    }
    c.globalAlpha = 1;
  },

  // 화면 입자: 눈(기본) · 먼지 · 재 · 불씨(위로 떠오름)
  drawSnow(c, dt, kind = 'snow') {
    if (kind === 'none') return;
    const W = G.W, H = G.H, up = kind === 'ember';
    c.fillStyle = { snow: 'rgba(235,245,255,0.75)', dust: 'rgba(200,170,120,0.5)', ash: 'rgba(150,150,150,0.55)', ember: 'rgba(255,140,40,0.85)' }[kind];
    for (const f of this.snow) {
      f.y += (up ? -0.6 : kind === 'snow' ? 1 : 0.35) * f.v * dt / H; f.ph += dt; f.x += (Math.sin(f.ph) * 8 + 10) * dt / W;
      if (f.y < 0) { f.y = 1; f.x = Math.random(); }
      if (f.y > 1) { f.y = 0; f.x = Math.random(); } if (f.x > 1) f.x = 0;
      c.globalAlpha = 0.25 + f.s / 4;
      c.fillRect(f.x * W, f.y * H, f.s, f.s);
    }
    c.globalAlpha = 1;
  },
};
