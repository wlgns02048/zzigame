'use strict';
// ================= 플레이어 =================
G.P = {
  create(cls = 'mage') {
    const m = G.Meta;
    const p = {
      cls,
      x: 0, y: 0, r: 14, hp: 1, maxHp: 1, absorb: 0, level: 1, xp: 0, xpNeed: G.P.xpNeed(1), pendingLv: 0,
      skills: {}, passives: {}, legend: {}, evo: {}, order: [],
      stats: {}, face: 1, moving: false, mvx: 0, mvy: 0, dead: false,
      channel: null, rootT: 0, hurtT: 0,
      rerolls: 2 + m.rank('reroll'), revives: m.rank('revive'),
      skillLevel(id) { const sk = this.skills[id]; if (!sk) return 0; let l = 1; for (const k in sk.ranks) l += sk.ranks[k]; return l; },
    };
    G.CLASSES[cls].init(p);
    return p;
  },
  xpNeed: l => Math.floor(2 + (l - 1) * 3 + Math.pow(l - 1, 1.6)),

  recalc() {
    const p = G.player, m = G.Meta;
    const st = {
      dmg: 1 + m.rank('power') * 0.05, haste: m.rank('haste') * 0.03, crit: 0.08, critMul: 2, area: 1, dur: 1, proj: 0,
      hpMul: 1 + m.rank('stamina') * 0.1, regen: 0.5, pickupMul: 1 + m.rank('pickup') * 0.15, luck: m.rank('luck') * 0.05, armor: 0,
      movePenalty: 0.15, fof: 0, bf: 0, shatterCrit: 0.35, speedMul: 1 + m.rank('speed') * 0.04, xpMul: 1 + m.rank('xp') * 0.06,
    };
    for (const id in p.passives) { const def = G.SKILLS[id]; def.apply(st, p.passives[id].total); }
    G.cls(p).recalc(st, p);
    const oldMax = p.maxHp;
    p.stats = st;
    p.maxHp = Math.round(150 * st.hpMul);
    if (oldMax > 1) p.hp = Math.min(p.maxHp, p.hp + Math.max(0, p.maxHp - oldMax)); else p.hp = p.maxHp;
    st.speed = 175 * st.speedMul; st.pickup = 115 * st.pickupMul;
    for (const id in p.skills) G.P.computeSkill(p.skills[id]);
    G.Pets.sync();
    G.UI.buildBars();
  },

  computeSkill(sk) {
    const p = G.player, def = sk.def, s = Object.assign({}, def.base);
    for (const n of def.nodes || []) { const r = sk.ranks[n.id] || 0; for (let i = 0; i < r; i++) n.apply(s); }
    if (s.proj) {
      if (s.count !== undefined) s.count += p.stats.proj;
      else if (s.targets !== undefined) s.targets += p.stats.proj;
    }
    G.cls(p).computeSkill(sk, s, p);
    sk.s = s;
    const mc = s.charges || 1;
    if (sk.charges === undefined) sk.charges = mc;
    sk.maxCharges = mc;
    if (sk.charges > mc) sk.charges = mc;
  },

  learn(id) {
    const p = G.player, def = G.SKILLS[id];
    const sk = { id, def, ranks: {}, cdT: 0, cdFull: 1, charges: undefined, castT: 0, t: 0 };
    p.skills[id] = sk; p.order.push(id);
    G.P.recalc();
    return sk;
  },
  rankUp(id, nodeId) { const sk = G.player.skills[id]; sk.ranks[nodeId] = (sk.ranks[nodeId] || 0) + 1; G.P.recalc(); },
  addPassive(id, v) {
    const p = G.player;
    const ps = p.passives[id] || (p.passives[id] = { rank: 0, total: 0 });
    ps.rank++; ps.total += v; G.P.recalc();
  },

  gainXp(v) {
    const p = G.player;
    p.xp += v * p.stats.xpMul;
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed; p.level++; p.xpNeed = G.P.xpNeed(p.level); p.pendingLv++;
      G.Audio.play('levelup');
      G.fx.burst(p.x, p.y, 30, { rgb: '255,215,90', sp: 160, size: 10, life: 0.9 });
      for (let i = 0; i < 26; i++) G.fx.part({ x: p.x + U.rand(-18, 18), y: p.y + U.rand(-10, 20), vy: U.rand(-260, -120), life: U.rand(0.6, 1.1), size: U.rand(6, 12), rgb: '255,220,110' });
      G.fx.ring(p.x, p.y, 10, 90, 0.6, '255,215,90', 5);
    }
  },

  heal(v) {
    const p = G.player; if (p.dead) return;
    const h = Math.min(p.maxHp - p.hp, v); if (h <= 0) return;
    p.hp += h; G.fx.text(p.x, p.y - 34, '+' + Math.round(h), '#40ff60', 15);
  },

  haste() { const p = G.player; return p.stats.haste + G.cls(p).haste(p); },

  inputDir() {
    if (G.Bot.on) return G.Bot.dir();
    const k = G.keys; let dx = 0, dy = 0;
    if (k.KeyW || k.ArrowUp) dy--; if (k.KeyS || k.ArrowDown) dy++;
    if (k.KeyA || k.ArrowLeft) dx--; if (k.KeyD || k.ArrowRight) dx++;
    const l = Math.hypot(dx, dy); return l ? [dx / l, dy / l] : [0, 0];
  },

  update(dt) {
    const p = G.player, st = p.stats;
    if (p.dead) return;
    p.hurtT -= dt; p.rootT -= dt;
    const C = G.cls(p);
    C.update(p, dt);
    // 이동
    let [dx, dy] = G.P.inputDir();
    let sp = st.speed;
    if (p.channel) sp *= 0.45;
    if (p.rootT > 0 || C.busy(p)) sp = 0;
    p.mvx = dx; p.mvy = dy;
    p.moving = sp > 0 && (dx || dy);
    p.x += dx * sp * dt; p.y += dy * sp * dt;
    p.face = G.mouse.x >= p.x ? 1 : -1;
    // 회복
    if (st.regen > 0) p.hp = Math.min(p.maxHp, p.hp + st.regen * dt);
  },
};

// ================= 소환수 (물의 정령 / 환영) =================
G.Pets = {
  sync() {
    const p = G.player, we = p.skills.waterelemental;
    const want = we ? we.s.count : 0;
    let have = G.pets.filter(q => q.kind === 'water');
    while (have.length < want) {
      const q = { kind: 'water', x: p.x - 40, y: p.y, atkT: 1, frzT: 4, t: Math.random() * 6, idx: have.length, face: 1 };
      G.pets.push(q); have.push(q);
      G.fx.burst(q.x, q.y, 20, { rgb: '80,180,255', sp: 140, size: 10 });
    }
  },
  update(dt) {
    const p = G.player, we = p.skills.waterelemental;
    for (const q of G.pets) {
      q.t += dt;
      const ang = q.idx * Math.PI + Math.PI * 0.75;
      const tx = p.x + Math.cos(ang) * 55, ty = p.y + Math.sin(ang) * 30 - 10;
      q.x += (tx - q.x) * Math.min(1, dt * 4); q.y += (ty - q.y) * Math.min(1, dt * 4);
      if (!we) continue;
      const s = we.s, hs = 1 + G.P.haste();
      q.atkT -= dt * hs; q.frzT -= dt * hs;
      const tgt = G.nearestEnemy(q.x, q.y, 520);
      if (tgt) {
        q.face = tgt.x > q.x ? 1 : -1;
        if (q.atkT <= 0) {
          q.atkT = s.atk;
          const a = Math.atan2(tgt.y - q.y, tgt.x - q.x);
          G.Proj.spawn({ x: q.x, y: q.y - 6, a, speed: 430, r: 8, kind: 'water', src: 'waterelemental', life: 1.6, onHit: e => { G.hit(e, s.dmg, 'waterelemental'); G.chill(e, 0.25, 1.5); G.fx.burst(e.x, e.y, 5, { rgb: '80,170,255', sp: 90, size: 7 }); } });
        }
        if (q.frzT <= 0) {
          const d = G.densestPoint(q.x, q.y, 450, s.freezeR) || { x: tgt.x, y: tgt.y };
          q.frzT = s.freezeCd;
          const R = s.freezeR * p.stats.area;
          G.aoe(d.x, d.y, R, 10, 'waterelemental', {}, e => G.freeze(e, s.freezeDur));
          G.fx.ring(d.x, d.y, 10, R, 0.45, '120,200,255', 6, 0.25);
          G.fx.burst(d.x, d.y, 24, { rgb: '120,200,255', sp: 200, size: 10, spread: R * 0.3 });
          G.Audio.play('freeze');
        }
      }
    }
    // 환영
    for (const im of G.images) {
      im.t += dt; im.life -= dt;
      const a = im.idx / im.n * Math.PI * 2 + im.t * 0.8;
      im.x += (p.x + Math.cos(a) * 70 - im.x) * Math.min(1, dt * 5); im.y += (p.y + Math.sin(a) * 50 - im.y) * Math.min(1, dt * 5);
      im.atkT -= dt;
      const tgt = G.nearestEnemy(im.x, im.y, 520);
      if (tgt) {
        im.face = tgt.x > im.x ? 1 : -1;
        if (im.atkT <= 0) {
          im.atkT = 1.4;
          G.Proj.spawn({ x: im.x, y: im.y - 10, a: Math.atan2(tgt.y - im.y, tgt.x - im.x), speed: 520, r: 8, kind: 'frostbolt', scale: 0.7, src: 'mirrorimage', life: 1.4, onHit: e => G.hit(e, im.dmg, 'mirrorimage') });
        }
      }
      if (im.hp <= 0 || im.life <= 0) { im.dead = true; G.fx.burst(im.x, im.y, 14, { rgb: '190,140,255', sp: 120, size: 8 }); }
    }
    G.images = G.images.filter(im => !im.dead);
  },
};
