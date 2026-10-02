'use strict';
const U = G.U;

// ================= 이펙트 =================
G.fx = {
  part(o) {
    if (G.parts.length > 2600) return;
    G.parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 6, size1: 0, rgb: '160,220,255', type: 'glow', add: true, rot: 0, vr: 0, drag: 0, grav: 0, alpha: 1 }, o, { max: o.life || 0.5 }));
  },
  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(o.spMin || 40, o.sp || 180);
      this.part({
        x: x + U.rand(-(o.spread || 0), o.spread || 0), y: y + U.rand(-(o.spread || 0), o.spread || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: U.rand(0.25, o.life || 0.6), size: U.rand(o.sMin || 3, o.size || 8), size1: o.size1 ?? 0, rgb: o.rgb || '170,225,255',
        type: o.type || 'glow', drag: o.drag ?? 3, grav: o.grav || 0, rot: Math.random() * 6, vr: U.rand(-10, 10), add: o.add ?? true,
      });
    }
  },
  shards(x, y, n, sp = 220, rgb = '220,245,255') {
    this.burst(x, y, n, { type: 'shard', sp, spMin: 60, size: 9, sMin: 4, size1: 3, life: 0.7, drag: 2.5, grav: 120, rgb, add: false });
  },
  ring(x, y, r0, r1, dur, color = '180,230,255', width = 4, fill = 0) {
    G.rings.push({ x, y, r0, r1, t: 0, dur, color, width, fill });
  },
  text(x, y, str, col = '#fff', size = 16, crit = false) {
    if ((G.texts.length > 90 && !crit) || G.texts.length > 160) return;
    G.texts.push({ x: x + U.rand(-8, 8), y, vy: -60, str, col, size, t: 0, max: crit ? 1.0 : 0.75, crit, vx: U.rand(-20, 20) });
  },
  shake(v) { G.cam.shake = Math.min(18, Math.max(G.cam.shake, v)); },
};

// ================= 피해 미터 =================
G.meter = {
  d: {}, total: 0,
  reset() { this.d = {}; this.total = 0; },
  add(src, v) { this.d[src] = (this.d[src] || 0) + v; this.total += v; },
};

// ================= 상태 =================
G.frozenLike = e => e.frozenT > 0 || e.wc > 0;

G.freeze = (e, dur) => {
  if (e.dead) return;
  dur *= G.player.stats.dur;
  if (e.boss) { G.chill(e, 0.3, dur); return; }
  if (e.elite) dur *= 0.5;
  if (e.frozenT <= 0) { G.Audio.play('freeze', 0.5); G.fx.burst(e.x, e.y, 6, { rgb: '200,240,255', sp: 80, size: 8 }); }
  e.frozenT = Math.max(e.frozenT, dur);
};
G.chill = (e, amt, dur) => {
  if (e.boss) amt *= 0.5;
  if (e.slowT <= 0) e.slowAmt = 0;
  e.slowAmt = Math.max(e.slowAmt, amt); e.slowT = Math.max(e.slowT, dur);
};
G.addWC = (e, n = 1) => { e.wc = Math.min(2, e.wc + n); e.wcT = 6; };

// ================= 피해 처리 =================
// o: { frozenMult, consumeWC, crit, school, noText, forceFrozen }
G.hit = (e, base, src, o = {}) => {
  if (e.dead || base <= 0) return 0;
  const p = G.player, st = p.stats;
  const frozen = o.forceFrozen || G.frozenLike(e);
  let d = base * st.dmg;
  if (frozen && o.frozenMult) d *= o.frozenMult;
  let cc = st.crit + (o.crit || 0);
  if (frozen) cc += st.shatterCrit;
  const crit = Math.random() < cc;
  if (crit) d *= st.critMul;
  if (e.boss && G.t < 0) d = 0;
  d = Math.max(1, Math.round(d * U.rand(0.93, 1.07) * (e.dmgTaken || 1)));
  if (o.consumeWC && e.wc > 0 && e.frozenT <= 0) e.wc--;
  e.hp -= d; e.flash = 0.05;
  G.meter.add(src, d);
  if (!o.noText) {
    const col = o.school === 'fire' ? (crit ? '#ffb347' : '#ff8a3c') : o.school === 'arcane' ? (crit ? '#ff9cff' : '#e4a6ff') : (crit ? '#ffe14d' : '#ffffff');
    G.fx.text(e.x, e.y - e.r - 6, crit ? U.num(d) + '!' : U.num(d), col, crit ? 24 : 15, crit);
  }
  if (crit) G.cls(p).onCrit(e, p);
  if (e.hp <= 0) G.killEnemy(e, frozen);
  return d;
};

// 범위 피해
G.aoe = (x, y, r, base, src, o = {}, each) => {
  const list = G.Grid.query(x, y, r);
  for (const e of list) { G.hit(e, base, src, o); if (each) each(e); }
  return list.length;
};

G.killEnemy = (e, frozen) => {
  if (e.dead) return;
  e.dead = true; G.stats.kills++;
  if (frozen || e.frozenT > 0) {
    G.fx.shards(e.x, e.y, e.boss ? 40 : 10, e.boss ? 400 : 220);
    G.fx.burst(e.x, e.y, 5, { rgb: '190,235,255', sp: 100, size: 14 });
    G.Audio.play('shatter', 0.6);
  } else {
    G.fx.burst(e.x, e.y, 6, { rgb: '30,30,40', add: false, type: 'smoke', sp: 60, size: 12, life: 0.6, drag: 4 });
    if (Math.random() < 0.4) G.fx.burst(e.x, e.y, 2, { type: 'bone', add: false, sp: 120, size: 1, sMin: 1, size1: 1, life: 0.7, grav: 200, drag: 1 });
  }
  // 전리품
  let xp = e.xp;
  if (xp > 0) {
    while (xp >= 50) { G.dropPickup('xp', e.x + U.rand(-20, 20), e.y + U.rand(-20, 20), 50); xp -= 50; }
    if (xp > 0) G.dropPickup('xp', e.x, e.y, xp);
  }
  const gm = 1 + (G.Meta.rank('luck') * 0.1);
  if (e.elite || e.boss) {
    G.dropPickup('chest', e.x, e.y, e.boss ? 2 : 1);
    for (let i = 0; i < (e.boss ? 12 : 4); i++) G.dropPickup('gold', e.x + U.rand(-40, 40), e.y + U.rand(-40, 40), U.randi(3, 6));
  } else {
    if (Math.random() < 0.025 * gm) G.dropPickup('gold', e.x, e.y, U.randi(1, 3));
    if (Math.random() < 0.008) G.dropPickup('food', e.x, e.y, 1);
    if (Math.random() < 0.0012) G.dropPickup('magnet', e.x, e.y, 1);
  }
  if (e.boss) G.Waves.onBossDeath(e);
};

G.dropPickup = (kind, x, y, v) => {
  if (kind === 'xp' && G.pickups.length > 450) {
    // 보석이 너무 많으면 기존 보석에 합치기
    const g = G.pickups.find(p => p.kind === 'xp' && !p.mag);
    if (g) { g.v += v; return; }
  }
  G.pickups.push({ kind, x, y, v, mag: false, vx: 0, vy: 0, t: 0, bob: Math.random() * 6 });
};

// ================= 플레이어 피격 =================
G.hurtPlayer = (dmg, src) => {
  const p = G.player;
  if (p.dead || G.cls(p).immune(p) || G.params.get('god')) return;
  dmg *= (1 - Math.min(0.6, p.stats.armor)) * G.Waves.dmgMul();
  dmg = Math.round(dmg);
  if (p.absorb > 0) {
    const a = Math.min(p.absorb, dmg); p.absorb -= a; dmg -= a;
    G.fx.burst(p.x, p.y, 3, { rgb: '200,240,255', sp: 80, size: 8 });
    if (src && !src.dead && src.hp !== undefined) {
      G.chill(src, 0.5, 2);
      if (p.skills.icebarrier && p.skills.icebarrier.s.reflect) G.hit(src, 30, 'reflect');
    }
    if (p.absorb <= 0) { G.fx.shards(p.x, p.y, 14, 200); G.Audio.play('shatter'); }
  }
  if (dmg <= 0) return;
  p.hp -= dmg; p.hurtT = 0.15;
  if (G.Bot.sync) { (G.dmgLog ||= []).push([G.t.toFixed(1), src && src.id ? src.id : 'proj', dmg]); if (G.dmgLog.length > 30) G.dmgLog.shift(); }
  G.fx.text(p.x, p.y - 34, '-' + dmg, '#ff4040', 17);
  G.Audio.play('hurt', 0.7);
  G.UI.hurtFlash();
  if (p.hp <= 0) G.playerDeath();
};
