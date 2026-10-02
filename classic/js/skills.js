'use strict';
// ================= 투사체 =================
G.Proj = {
  spawn(o) {
    const pr = Object.assign({ r: 8, life: 2, pierce: 0, t: 0, scale: 1, turn: 6 }, o);
    pr.hits = new Set();
    pr.vx = Math.cos(o.a) * o.speed; pr.vy = Math.sin(o.a) * o.speed;
    G.projs.push(pr); return pr;
  },
  update(dt) {
    for (const pr of G.projs) {
      pr.t += dt; pr.life -= dt;
      if (pr.homing) {
        let tg = pr.homing;
        if (tg.dead) tg = pr.homing = G.nearestEnemy(pr.x, pr.y, 420, e => !pr.hits.has(e));
        if (tg) {
          const cur = Math.atan2(pr.vy, pr.vx), want = Math.atan2(tg.y - pr.y, tg.x - pr.x);
          const na = cur + U.clamp(U.angDiff(cur, want), -pr.turn * dt, pr.turn * dt), sp = Math.hypot(pr.vx, pr.vy);
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.update) pr.update(pr, dt);
      G.Proj.trail(pr);
      if (!pr.noCollide) {
        const hits = G.Grid.query(pr.x, pr.y, pr.r);
        for (const e of hits) {
          if (pr.hits.has(e)) continue;
          pr.hits.add(e);
          if (pr.onHit) pr.onHit(e, pr);
          if (pr.pierce-- <= 0) { pr.dead = true; break; }
        }
      }
      if (pr.life <= 0 && !pr.dead) { pr.dead = true; if (pr.onExpire) pr.onExpire(pr); }
    }
    G.projs = G.projs.filter(p => !p.dead);
  },
  trail(pr) {
    const k = pr.kind, back = Math.atan2(pr.vy, pr.vx) + Math.PI;
    const bx = pr.x + Math.cos(back) * 8, by = pr.y + Math.sin(back) * 8;
    if (k === 'frostbolt') {
      G.fx.part({ x: bx, y: by, life: 0.28, size: 9 * pr.scale, rgb: '90,170,255', vx: U.rand(-15, 15), vy: U.rand(-15, 15) });
      if (Math.random() < 0.35) G.fx.part({ x: bx, y: by, life: 0.5, size: 3, size1: 1, rgb: '230,248,255', type: 'shard', add: false, vx: U.rand(-40, 40), vy: U.rand(-40, 40), drag: 2 });
    } else if (k === 'frostfire') {
      G.fx.part({ x: bx, y: by, life: 0.3, size: 11, rgb: Math.random() < 0.5 ? '200,100,255' : '255,140,60', vx: U.rand(-20, 20), vy: U.rand(-20, 20) });
    } else if (k === 'lance' || k === 'icicle') {
      G.fx.part({ x: bx, y: by, life: 0.18, size: k === 'lance' ? 7 : 5, rgb: '170,225,255' });
    } else if (k === 'flurry') {
      G.fx.part({ x: bx, y: by, life: 0.2, size: 6, rgb: '140,200,255' });
    } else if (k === 'spike') {
      G.fx.part({ x: bx, y: by, life: 0.4, size: 22, rgb: '120,200,255', vx: U.rand(-30, 30), vy: U.rand(-30, 30) });
      if (Math.random() < 0.6) G.fx.part({ x: bx, y: by, life: 0.6, size: 6, size1: 2, rgb: '230,248,255', type: 'shard', add: false, vx: U.rand(-90, 90), vy: U.rand(-90, 90), drag: 2 });
    } else if (k === 'water') {
      G.fx.part({ x: bx, y: by, life: 0.25, size: 8, rgb: '60,150,255' });
    } else if (k === 'splinter') {
      G.fx.part({ x: bx, y: by, life: 0.25, size: 6, rgb: '190,110,255' });
    }
  },
};

// ================= 지면 효과 =================
G.Zones = {
  add(o) { const z = Object.assign({ t: 0, tick: 1, tickT: 0, life: 1 }, o); G.zones.push(z); return z; },
  update(dt) {
    for (const z of G.zones) {
      z.t += dt; z.life -= dt;
      if (z.update) z.update(z, dt);
      G.R.zoneFx(z, dt);
      if (z.onTick) { z.tickT -= dt; while (z.tickT <= 0 && z.life > 0) { z.tickT += z.tick; z.onTick(z); } }
      if (z.life <= 0) { z.dead = true; if (z.onEnd) z.onEnd(z); }
    }
    G.zones = G.zones.filter(z => !z.dead);
  },
};

// ================= 주문 시스템 =================
const aimAngle = () => { const p = G.player; return Math.atan2(G.mouse.y - p.y, G.mouse.x - p.x); };
const nearestN = (x, y, n, range, prefer) => {
  const r2 = range * range;
  const list = [];
  for (const e of G.enemies) { if (e.dead) continue; const d = U.d2(x, y, e.x, e.y); if (d < r2) list.push([prefer && prefer(e) ? d - 1e8 : d, e]); }
  list.sort((a, b) => a[0] - b[0]);
  return list.slice(0, n).map(a => a[1]);
};

G.Skills = {
  startCd(sk) {
    sk.charges--;
    if (sk.cdT <= 0) { sk.cdFull = sk.s.cd; sk.cdT = sk.cdFull; }
  },
  resetCd(sk) { sk.charges = sk.maxCharges; sk.cdT = 0; },

  update(dt) {
    const p = G.player; if (p.dead) return;
    const hs = 1 + G.P.haste(), busy = p.iceblockT > 0;
    for (const id of p.order) {
      const sk = p.skills[id], s = sk.s;
      sk.t += dt;
      if (s.cd && sk.charges < sk.maxCharges) {
        sk.cdT -= dt * hs;
        if (sk.cdT <= 0) {
          sk.charges++;
          if (sk.charges < sk.maxCharges) { sk.cdFull = s.cd; sk.cdT = sk.cdFull; } else sk.cdT = 0;
          if (sk.def.kind === 'active') G.UI.flashReady(id);
        }
      }
      const impl = IMPL[id]; if (!impl) continue;
      if (impl.update) impl.update(sk, dt, busy);
      if (sk.def.kind === 'auto' && !busy && impl.auto && s.cd && sk.charges > 0) { if (impl.auto(sk)) this.startCd(sk); }
    }
    // 정신 집중
    if (p.channel) {
      const c = p.channel; c.t += dt;
      const impl = IMPL[c.id]; if (impl.channel) impl.channel(p.skills[c.id], c, dt);
      if (c.t >= c.dur || busy) p.channel = null;
    }
    // 전설: 얼어붙은 바람
    if (p.legend.freezingwinds && G.projs.some(q => q.kind === 'orb')) {
      p.fwT -= dt; if (p.fwT <= 0) { p.fwT = 2; G.Skills.procBF(); }
    }
    // 진화: 파편 폭풍
    if (p.evo.splinterstorm && p.skills.icelance) {
      p.splinterT -= dt;
      if (p.splinterT <= 0 && G.enemies.length) {
        p.splinterT = 8; G.fx.ring(p.x, p.y, 10, 120, 0.5, '190,110,255', 4);
        G.Skills.splinters(14, true);
      }
    }
  },

  activate(id) {
    const p = G.player, sk = p.skills[id];
    if (!sk || p.dead || G.state !== 'play' || G.paused) return false;
    if (id === 'iceblock' && p.iceblockT > 0) { p.iceblockT = 0; this.endIceBlock(); return true; }
    if (p.iceblockT > 0) return false;
    if (p.channel && p.channel.id === id) { p.channel = null; return true; }
    const impl = IMPL[id];
    if ((sk.s.cd && sk.charges <= 0) || (impl.usable && !impl.usable(sk))) { G.UI.error('아직 사용할 수 없습니다.'); return false; }
    if (impl.cast(sk) !== false) { if (sk.s.cd) this.startCd(sk); G.UI.pressed(id); return true; }
    return false;
  },

  // ---------- 발동 효과 ----------
  procFoF() {
    const p = G.player; if (!p.skills.icelance) return;
    p.fof = Math.min(2, p.fof + 1); p.fofT = 15;
    this.resetCd(p.skills.icelance);
    G.Audio.play('tick', 0.8);
  },
  procBF() {
    const p = G.player; if (!p.skills.flurry) return;
    p.bf = 1; p.bfT = 15; this.resetCd(p.skills.flurry);
  },

  // ---------- 고드름 ----------
  addIcicle() {
    const p = G.player, ic = p.skills.icicles; if (!ic) return;
    if (p.icicles.length >= ic.s.max) { if (p.skills.glacialspike) return; this.launchIcicle(); }
    p.icicles.push({ t: G.t });
  },
  icPos(i) {
    const p = G.player, n = Math.max(1, p.icicles.length), a = p.icAngle + i / n * Math.PI * 2;
    return [p.x + Math.cos(a) * 30, p.y - 6 + Math.sin(a) * 16, a];
  },
  launchIcicle(tgt) {
    const p = G.player, ic = p.skills.icicles; if (!ic || !p.icicles.length) return;
    tgt = tgt && !tgt.dead ? tgt : G.nearestEnemy(p.x, p.y, 650);
    if (!tgt) return;
    const [x, y] = this.icPos(0); p.icicles.shift();
    G.Proj.spawn({ x, y, a: Math.atan2(tgt.y - y, tgt.x - x), speed: 700, r: 7, kind: 'icicle', homing: tgt, turn: 9, src: 'icicles', life: 1.5, pierce: ic.s.pierce,
      onHit: e => { G.hit(e, ic.s.dmg, 'icicles'); G.fx.burst(e.x, e.y, 3, { rgb: '200,240,255', sp: 90, size: 6 }); } });
    G.Audio.play('icicle', 0.6);
  },

  // ---------- 비전 서리 파편 ----------
  splinters(n, ring) {
    const p = G.player, il = p.skills.icelance; if (!il) return;
    const tg = nearestN(p.x, p.y, Math.max(1, n), 650);
    if (!tg.length) return;
    for (let i = 0; i < n; i++) {
      const t = tg[i % tg.length], a = ring ? i / n * Math.PI * 2 : Math.atan2(t.y - p.y, t.x - p.x) + U.rand(-1, 1);
      G.Proj.spawn({ x: p.x, y: p.y - 8, a, speed: 480, r: 7, kind: 'splinter', homing: t, turn: 7, src: 'splinter', life: 2.2,
        onHit: e => { G.hit(e, il.s.dmg * 0.55, 'splinter', { school: 'arcane' }); G.chill(e, 0.3, 1.5); G.fx.burst(e.x, e.y, 4, { rgb: '190,110,255', sp: 90, size: 7 }); } });
    }
  },

  endIceBlock() {
    const p = G.player, ib = p.skills.iceblock;
    G.fx.shards(p.x, p.y, 30, 300); G.Audio.play('shatter');
    if (ib && ib.s.nova) {
      const R = 170 * p.stats.area;
      G.aoe(p.x, p.y, R, 20, 'iceblock', {}, e => G.freeze(e, 3));
      G.fx.ring(p.x, p.y, 10, R, 0.5, '200,240,255', 8, 0.3);
    }
  },

  frozenOrb(s, x, y, a) {
    const p = G.player, R = s.radius * p.stats.area;
    G.Proj.spawn({
      x, y, a, speed: s.speed, r: 20, kind: 'orb', src: 'frozenorb', life: s.dur * p.stats.dur, noCollide: true, tickT: 0.1, R, spin: 0,
      update: (pr, dt) => {
        pr.spin += dt * 5;
        pr.tickT -= dt;
        if (pr.tickT <= 0) {
          pr.tickT = 0.5;
          const n = G.aoe(pr.x, pr.y, R, s.dmg, 'frozenorb', {}, e => G.chill(e, 0.4, 1));
          if (n) {
            pr.slowed = true;
            if (p.stats.fof && Math.random() < p.stats.fof * 0.8) G.Skills.procFoF();
            G.Audio.play('tick', 0.5);
          }
        }
        if (pr.slowed) { const sp = Math.hypot(pr.vx, pr.vy), ns = Math.max(45, sp - 400 * dt); pr.vx *= ns / sp; pr.vy *= ns / sp; }
        for (let i = 0; i < 2; i++) {
          const aa = pr.spin + i * Math.PI + U.rand(-0.3, 0.3), rr = U.rand(R * 0.2, R * 0.9);
          G.fx.part({ x: pr.x + Math.cos(aa) * rr, y: pr.y + Math.sin(aa) * rr * 0.7, vx: -Math.sin(aa) * 120, vy: Math.cos(aa) * 80, life: 0.45, size: U.rand(3, 6), size1: 1, rgb: '220,245,255', type: 'shard', add: false, drag: 1 });
        }
        if (Math.random() < 0.5) G.fx.part({ x: pr.x + U.rand(-R, R) * 0.6, y: pr.y + U.rand(-R, R) * 0.4, life: 0.6, size: U.rand(20, 34), rgb: '60,140,255' });
      },
    });
    G.Audio.play('orb');
  },
};

// ================= 주문별 구현 =================
const IMPL = G.SKILL_IMPL = {
  frostbolt: {
    update(sk, dt, busy) {
      const p = G.player, s = sk.s;
      if (busy || p.channel) return;
      const pen = p.moving ? p.stats.movePenalty : 0;
      sk.castT = Math.min(1, sk.castT + dt * (1 + G.P.haste()) * (1 - pen) / s.cast);
      if (sk.castT < 1) return;
      const iv = p.skills.icyveins;
      const n = s.count + (p.ivT > 0 && iv && iv.s.extraProj ? 1 : 0);
      const tg = nearestN(p.x, p.y, n, 650);
      if (!tg.length) return;
      sk.castT = 0;
      const ff = !!s.ff, src = ff ? 'frostfire' : 'frostbolt';
      const cast = { fof: false };
      if (p.stats.bf && Math.random() < p.stats.bf) G.Skills.procBF();
      if (p.legend.coldfront && p.skills.frozenorb && ++p.fbCount >= 25) {
        p.fbCount = 0; G.Skills.frozenOrb(p.skills.frozenorb.s, p.x, p.y, Math.atan2(tg[0].y - p.y, tg[0].x - p.x));
        G.fx.text(p.x, p.y - 50, '냉기 전선!', '#7fd4ff', 18, true);
      }
      for (let i = 0; i < n; i++) {
        const t = tg[i % tg.length];
        const a = Math.atan2(t.y - p.y, t.x - p.x) + (i >= tg.length ? (i - tg.length + 1) * 0.15 : 0);
        G.Proj.spawn({
          x: p.x + p.face * 14, y: p.y - 22, a, speed: s.speed, r: 9, kind: ff ? 'frostfire' : 'frostbolt', homing: t, turn: 3.5, src, life: 1.6, pierce: s.pierce, scale: ff ? 1.25 : 1,
          onHit: e => {
            G.hit(e, s.dmg, src);
            G.chill(e, s.slow, 2);
            G.Skills.addIcicle();
            if (!cast.fof && p.stats.fof && Math.random() < p.stats.fof) { cast.fof = true; G.Skills.procFoF(); }
            if (s.freezeCh && Math.random() < s.freezeCh) G.freeze(e, 2);
            if (s.explode) {
              const R = (25 + 18 * s.explode) * p.stats.area;
              G.Grid.query(e.x, e.y, R).forEach(o => { if (o !== e) G.hit(o, s.dmg * (ff ? 0.6 : 0.4), src, { noText: !ff }); });
              G.fx.ring(e.x, e.y, 5, R, 0.3, ff ? '230,130,255' : '150,210,255', 3, 0.2);
            }
            if (ff) {
              G.Zones.add({ kind: 'burn', x: e.x, y: e.y, r: 0, life: 3, tick: 0.5, tickT: 0.5, target: e, onTick: z => { if (!z.target.dead) G.hit(z.target, s.dmg * 0.08, 'burn', { school: 'fire' }); else z.life = 0; } });
              G.fx.burst(e.x, e.y, 10, { rgb: Math.random() < 0.5 ? '255,140,60' : '200,100,255', sp: 140, size: 10 });
            } else G.fx.burst(e.x, e.y, 7, { rgb: '150,215,255', sp: 120, size: 9 });
            G.fx.shards(e.x, e.y, 3, 140);
            G.Audio.play('hit', 0.5);
          },
        });
      }
      G.Audio.play('cast', 0.55);
    },
  },

  icicles: {},

  icelance: {
    auto(sk) {
      const p = G.player, s = sk.s;
      const tg = nearestN(p.x, p.y, s.count, 620, G.frozenLike);
      if (!tg.length) return false;
      const emp = p.fof > 0;
      if (emp) { p.fof--; if (!p.fof) p.fofT = 0; }
      for (let i = 0; i < s.count; i++) {
        const t = tg[i % tg.length];
        IMPL.icelance.fire(s, p.x + p.face * 12, p.y - 20, t, emp, 1, 0, i * 0.12);
      }
      if (!p.skills.glacialspike) {
        const n = p.icicles.length;
        for (let i = 0; i < n; i++) G.later(i * 0.07, () => G.Skills.launchIcicle(tg[0]));
      }
      const iv = p.skills.icyveins;
      if (p.ivT > 0 && iv && iv.s.thermal) p.ivT = Math.min(p.ivT + 0.5, 40);
      if (s.splinters) G.Skills.splinters(2);
      G.Audio.play('lance', 0.7);
      return true;
    },
    fire(s, x, y, t, emp, mult, depth, off = 0) {
      G.Proj.spawn({
        x, y, a: Math.atan2(t.y - y, t.x - x) + off, speed: s.speed, r: 9, kind: 'lance', homing: t, turn: 10, src: 'icelance', life: 1.2,
        onHit: e => IMPL.icelance.hit(e, s, emp, mult, depth),
      });
    },
    hit(e, s, emp, mult, depth) {
      const p = G.player, frozen = emp || G.frozenLike(e);
      const d = G.hit(e, s.dmg * mult, 'icelance', { frozenMult: s.mult, consumeWC: true, forceFrozen: emp });
      G.fx.shards(e.x, e.y, frozen ? 8 : 4, frozen ? 240 : 150);
      if (frozen) { G.fx.burst(e.x, e.y, 6, { rgb: '200,240,255', sp: 140, size: 12 }); G.Audio.play('shatter', 0.5); }
      if (p.legend.glacialfrag && G.zones.some(z => z.kind === 'blizzard' && U.d2(z.x, z.y, e.x, e.y) < z.r * z.r)) {
        G.Grid.query(e.x, e.y, 80).forEach(o => { if (o !== e) G.hit(o, d / p.stats.dmg, 'glacialfrag', { noText: true }); });
        G.fx.ring(e.x, e.y, 5, 80, 0.3, '200,240,255', 3, 0.15); G.fx.shards(e.x, e.y, 8, 260);
      }
      if (depth === 0 && s.split) {
        const others = nearestN(e.x, e.y, s.split + 1, 240).filter(o => o !== e).slice(0, s.split);
        for (const o of others) IMPL.icelance.fire(s, e.x, e.y, o, false, 0.65, 1);
      }
    },
  },

  flurry: {
    auto(sk) {
      const p = G.player, s = sk.s;
      const tg = nearestN(p.x, p.y, s.targets, 600);
      if (!tg.length) return false;
      const emp = p.bf > 0; if (emp) { p.bf = 0; p.bfT = 0; }
      const m = emp ? 1.6 : 1;
      tg.forEach((t, ti) => {
        for (let j = 0; j < s.bolts; j++) G.later(j * 0.1 + ti * 0.03, () => {
          if (t.dead) { const n = G.nearestEnemy(p.x, p.y, 600); if (!n) return; t = n; }
          G.Proj.spawn({ x: p.x + p.face * 12, y: p.y - 20, a: Math.atan2(t.y - p.y, t.x - p.x) + U.rand(-0.5, 0.5), speed: 620, r: 8, kind: 'flurry', homing: t, turn: 12, src: 'flurry', life: 1.3, scale: emp ? 1.3 : 1,
            onHit: e => { G.hit(e, s.dmg * m, 'flurry'); G.addWC(e, 1); G.fx.burst(e.x, e.y, 4, { rgb: '140,200,255', sp: 90, size: 7 }); } });
          G.Audio.play('cast', 0.3);
        });
      });
      return true;
    },
  },

  blizzard: {
    auto(sk) {
      const p = G.player, s = sk.s, R = s.radius * p.stats.area;
      const pts = [];
      for (let k = 0; k < s.count; k++) {
        const d = G.densestPoint(p.x, p.y, 520, R);
        if (!d) break;
        if (pts.some(q => U.d2(q.x, q.y, d.x, d.y) < R * R)) { const e = G.nearestEnemy(p.x + U.rand(-300, 300), p.y + U.rand(-300, 300), 520); if (e) pts.push({ x: e.x, y: e.y }); }
        else pts.push(d);
      }
      if (!pts.length) return false;
      for (const pt of pts) {
        G.Zones.add({
          kind: 'blizzard', x: pt.x, y: pt.y, r: R, life: s.dur * p.stats.dur, tick: 1, tickT: 0.4,
          onTick: z => {
            const n = G.aoe(z.x, z.y, z.r, s.dmg, 'blizzard', {}, e => G.chill(e, s.slow, 1.5));
            const orb = p.skills.frozenorb;
            if (n && orb && orb.charges < orb.maxCharges) orb.cdT = Math.max(0.01, orb.cdT - 0.5);
          },
        });
      }
      return true;
    },
  },

  cometstorm: {
    auto(sk) {
      const p = G.player, s = sk.s, R = s.radius * p.stats.area;
      const t0 = G.densestPoint(p.x, p.y, 560, 90) || G.nearestEnemy(p.x, p.y, 560);
      if (!t0) return false;
      for (let i = 0; i < s.comets; i++) {
        G.later(i * 0.15, () => {
          const x = t0.x + U.rand(-90, 90), y = t0.y + U.rand(-90, 90);
          G.Zones.add({
            kind: 'comet', x, y, r: R, life: 0.4,
            onEnd: z => {
              G.aoe(z.x, z.y, z.r, s.dmg, 'cometstorm', {}, e => G.chill(e, 0.4, 2));
              G.fx.ring(z.x, z.y, 5, z.r * 1.2, 0.35, '170,220,255', 5, 0.3);
              G.fx.burst(z.x, z.y, 14, { rgb: '150,210,255', sp: 220, size: 12 });
              G.fx.shards(z.x, z.y, 8, 260); G.fx.shake(3); G.Audio.play('comet', 0.6);
            },
          });
        });
      }
      return true;
    },
  },

  icenova: {
    auto(sk) {
      const p = G.player, s = sk.s, R = s.radius * p.stats.area;
      const t = G.densestPoint(p.x, p.y, 480, R) || G.nearestEnemy(p.x, p.y, 480);
      if (!t) return false;
      G.aoe(t.x, t.y, R, s.dmg, 'icenova', {}, e => G.freeze(e, s.freeze));
      G.fx.ring(t.x, t.y, 5, R, 0.4, '200,240,255', 7, 0.35);
      G.fx.burst(t.x, t.y, 26, { rgb: '170,225,255', sp: 260, size: 12, spread: 10 });
      G.fx.shards(t.x, t.y, 16, 300);
      G.Zones.add({ kind: 'novaice', x: t.x, y: t.y, r: R * 0.9, life: 1.2 });
      G.Audio.play('nova', 0.7);
      return true;
    },
  },

  waterelemental: {},

  // ---------- 단축키 주문 ----------
  frozenorb: {
    cast(sk) {
      const p = G.player, s = sk.s, a = aimAngle();
      for (let k = 0; k < s.count; k++) G.Skills.frozenOrb(s, p.x, p.y - 10, a + (k - (s.count - 1) / 2) * 0.5);
    },
  },
  coneofcold: {
    cast(sk) {
      const p = G.player, s = sk.s, a = aimAngle(), R = s.range * p.stats.area, half = s.angle / 2;
      for (const e of G.Grid.query(p.x, p.y, R)) {
        if (Math.abs(U.angDiff(a, Math.atan2(e.y - p.y, e.x - p.x))) <= half + 0.15) {
          G.hit(e, s.dmg, 'coneofcold'); G.chill(e, s.slow, 3); if (s.freeze) G.freeze(e, s.freeze);
        }
      }
      for (let i = 0; i < 70; i++) {
        const aa = a + U.rand(-half, half), sp = U.rand(R * 1.2, R * 3);
        G.fx.part({ x: p.x + Math.cos(a) * 14, y: p.y - 10, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, life: U.rand(0.3, 0.5), size: U.rand(8, 18), size1: 24, rgb: Math.random() < 0.3 ? '230,248,255' : '120,190,255', drag: 3 });
      }
      for (let i = 0; i < 18; i++) { const aa = a + U.rand(-half, half); G.fx.part({ x: p.x, y: p.y - 10, vx: Math.cos(aa) * U.rand(200, 500), vy: Math.sin(aa) * U.rand(200, 500), life: 0.5, size: 6, size1: 2, rgb: '230,248,255', type: 'shard', add: false, drag: 3 }); }
      G.rings.push({ kind: 'cone', x: p.x, y: p.y - 6, a, half, r: R, t: 0, dur: 0.35 });
      G.Audio.play('nova', 0.6); G.Audio.play('freeze', 0.4);
    },
  },
  glacialspike: {
    usable(sk) { const p = G.player, ic = p.skills.icicles; return ic && p.icicles.length >= ic.s.max; },
    cast(sk) {
      const p = G.player, s = sk.s, ic = p.skills.icicles, a = aimAngle();
      const dmg = s.dmg + p.icicles.length * ic.s.dmg * 0.8;
      p.icicles = [];
      G.Proj.spawn({
        x: p.x + Math.cos(a) * 20, y: p.y - 16 + Math.sin(a) * 20, a, speed: 760, r: 18, kind: 'spike', src: 'glacialspike', life: 1.3, pierce: s.pierce,
        onHit: e => {
          G.hit(e, dmg, 'glacialspike', { consumeWC: true }); G.freeze(e, s.freeze);
          const R = s.splash * p.stats.area;
          G.Grid.query(e.x, e.y, R).forEach(o => { if (o !== e) { G.hit(o, dmg * 0.35, 'glacialspike'); G.freeze(o, 2); } });
          G.fx.ring(e.x, e.y, 5, R, 0.4, '200,240,255', 6, 0.3);
          G.fx.shards(e.x, e.y, 26, 360); G.fx.burst(e.x, e.y, 18, { rgb: '170,225,255', sp: 220, size: 16 });
          G.fx.shake(6); G.Audio.play('shatter'); G.Audio.play('explode', 0.6);
        },
      });
      G.Audio.play('lance'); G.Audio.play('orb', 0.5);
    },
  },
  frostnova: {
    cast(sk) {
      const p = G.player, s = sk.s, R = s.radius * p.stats.area;
      G.aoe(p.x, p.y, R, s.dmg, 'frostnova', {}, e => G.freeze(e, s.freeze));
      G.fx.ring(p.x, p.y, 10, R, 0.45, '210,245,255', 10, 0.35);
      G.fx.burst(p.x, p.y, 50, { rgb: '170,225,255', sp: R * 2.2, spMin: R, size: 14, drag: 5 });
      G.fx.shards(p.x, p.y, 24, R * 2);
      G.Zones.add({ kind: 'novaice', x: p.x, y: p.y, r: R, life: 1.6 });
      G.fx.shake(4); G.Audio.play('nova');
    },
  },
  rayoffrost: {
    cast(sk) {
      const p = G.player;
      p.channel = { id: 'rayoffrost', name: sk.def.name, t: 0, dur: sk.s.dur * p.stats.dur, tickT: 0, ticks: 0, a: aimAngle() };
    },
    channel(sk, c, dt) {
      const p = G.player, s = sk.s;
      c.a += U.clamp(U.angDiff(c.a, aimAngle()), -4 * dt, 4 * dt);
      const L = s.len * p.stats.area, W = s.width * p.stats.area;
      c.len = L; c.w = W;
      c.tickT -= dt;
      if (c.tickT <= 0) {
        c.tickT = 0.25; c.ticks++;
        const ca = Math.cos(c.a), sa = Math.sin(c.a), ox = p.x, oy = p.y - 16;
        let any = false;
        for (const e of G.enemies) {
          if (e.dead) continue;
          const dx = e.x - ox, dy = e.y - oy, along = dx * ca + dy * sa;
          if (along < 0 || along > L) continue;
          if (Math.abs(-dx * sa + dy * ca) <= W + e.r) { G.hit(e, s.dmg * (1 + s.ramp * c.ticks), 'rayoffrost'); G.chill(e, 0.6, 1); any = true; }
        }
        if (any && p.stats.fof && Math.random() < p.stats.fof * 0.6) G.Skills.procFoF();
        G.Audio.play('tick', 0.4);
      }
      for (let i = 0; i < 4; i++) {
        const d = Math.random() * c.len;
        G.fx.part({ x: p.x + Math.cos(c.a) * d, y: p.y - 16 + Math.sin(c.a) * d, vx: U.rand(-40, 40), vy: U.rand(-40, 40), life: 0.35, size: U.rand(6, 14), rgb: Math.random() < 0.5 ? '200,240,255' : '100,180,255' });
      }
    },
  },
  blink: {
    cast(sk) {
      const p = G.player, s = sk.s;
      if (p.rootT > 0) p.rootT = 0;
      const a = p.moving ? Math.atan2(p.mvy, p.mvx) : aimAngle();
      const ox = p.x, oy = p.y;
      G.fx.burst(ox, oy - 10, 24, { rgb: '200,120,255', sp: 160, size: 10 });
      p.x += Math.cos(a) * s.dist; p.y += Math.sin(a) * s.dist;
      G.fx.burst(p.x, p.y - 10, 24, { rgb: '200,120,255', sp: 160, size: 10 });
      for (let i = 0; i < 12; i++) { const t = i / 12; G.fx.part({ x: U.lerp(ox, p.x, t), y: U.lerp(oy, p.y, t) - 10, life: 0.35, size: 14, rgb: '170,100,255' }); }
      if (s.trail) {
        const R = 120 * p.stats.area;
        G.aoe(ox, oy, R, 15, 'blink', {}, e => G.freeze(e, 2.5));
        G.fx.ring(ox, oy, 10, R, 0.4, '210,245,255', 6, 0.3);
        G.Zones.add({ kind: 'novaice', x: ox, y: oy, r: R, life: 1.2 });
      }
      G.Audio.play('blink');
    },
  },
  icyveins: {
    cast(sk) {
      const p = G.player; p.ivT = sk.s.dur * p.stats.dur;
      G.fx.ring(p.x, p.y, 10, 90, 0.5, '90,170,255', 6);
      G.fx.burst(p.x, p.y, 30, { rgb: '90,170,255', sp: 180, size: 12 });
      G.Audio.play('buff');
    },
  },
  icebarrier: {
    cast(sk) {
      const p = G.player; p.absorb = Math.round(p.maxHp * sk.s.pct);
      G.fx.burst(p.x, p.y - 10, 24, { rgb: '200,240,255', sp: 120, size: 10 });
      G.Audio.play('freeze'); G.Audio.play('buff', 0.5);
    },
  },
  iceblock: {
    cast(sk) {
      const p = G.player; p.iceblockT = sk.s.dur; p.channel = null;
      G.fx.shards(p.x, p.y, 16, 180); G.Audio.play('freeze');
    },
  },
  coldsnap: {
    cast(sk) {
      const p = G.player;
      for (const id of ['coneofcold', 'frostnova', 'icebarrier', 'iceblock']) if (p.skills[id]) G.Skills.resetCd(p.skills[id]);
      G.P.heal(p.maxHp * sk.s.heal);
      G.fx.burst(p.x, p.y, 40, { rgb: '220,245,255', sp: 220, size: 10 });
      G.fx.ring(p.x, p.y, 10, 120, 0.5, '220,245,255', 4);
      G.Audio.play('buff');
    },
  },
  mirrorimage: {
    cast(sk) {
      const p = G.player, s = sk.s;
      for (let i = 0; i < s.count; i++) G.images.push({ x: p.x, y: p.y, idx: i, n: s.count, t: 0, life: s.dur * p.stats.dur, hp: 40, atkT: U.rand(0.2, 1), dmg: s.dmg, face: 1 });
      G.fx.burst(p.x, p.y, 30, { rgb: '190,140,255', sp: 160, size: 10 });
      G.Audio.play('blink'); G.Audio.play('buff', 0.4);
    },
  },
  shiftingpower: {
    cast(sk) { const p = G.player; p.channel = { id: 'shiftingpower', name: sk.def.name, t: 0, dur: sk.s.dur, tickT: 0, ticks: 0 }; },
    channel(sk, c, dt) {
      const p = G.player, s = sk.s, R = s.radius * p.stats.area;
      c.tickT -= dt;
      if (c.tickT <= 0) {
        c.tickT = 1; c.ticks++;
        G.aoe(p.x, p.y, R, s.dmg, 'shiftingpower');
        for (const id of p.order) { const o = p.skills[id]; if (id !== 'shiftingpower' && o.charges < o.maxCharges) o.cdT = Math.max(0.01, o.cdT - s.reduce); }
        G.fx.ring(p.x, p.y, R, 10, 0.6, '90,230,160', 5, 0.15);
        G.Audio.play('tick', 0.8);
      }
      if (Math.random() < 0.8) { const a = Math.random() * 6.28; G.fx.part({ x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R, vx: -Math.cos(a) * R * 1.6, vy: -Math.sin(a) * R * 1.6, life: 0.55, size: 9, rgb: '90,230,160' }); }
    },
  },
};
