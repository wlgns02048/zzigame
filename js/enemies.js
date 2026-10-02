'use strict';
// ================= 적 =================
let enemyUid = 0;
G.Enemy = {
  spawn(id, x, y, o = {}) {
    const def = G.ENEMIES[id], elite = !!o.elite;
    const hm = def.boss ? 1 : G.Waves.hpMul();
    const hp = Math.round(def.hp * hm * (elite ? 9 : 1));
    const e = {
      uid: ++enemyUid, id, def, x, y, r: def.r * (elite ? 1.4 : 1), hp, maxHp: hp,
      speed: def.speed * U.rand(0.92, 1.08) * (elite ? 0.95 : 1), dmg: def.dmg * (elite ? 1.5 : 1), xp: def.xp * (elite ? 12 : 1),
      frozenT: 0, slowT: 0, slowAmt: 0, wc: 0, wcT: 0, flash: 0, atkT: 0, shootT: U.rand(1, 3), t: Math.random() * 10, face: -1,
      elite, boss: !!def.boss, scale: def.scale * (elite ? 1.4 : 1), ai: {},
    };
    G.enemies.push(e);
    return e;
  },

  update(dt) {
    const p = G.player;
    G.Grid.clear();
    for (const e of G.enemies) if (!e.dead) G.Grid.add(e);
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.t += dt; e.flash -= dt; e.atkT -= dt;
      if (e.wcT > 0 && (e.wcT -= dt) <= 0) e.wc = 0;
      if (e.slowT > 0 && (e.slowT -= dt) <= 0) e.slowAmt = 0;
      if (e.frozenT > 0) { e.frozenT -= dt; continue; }
      // 대상 선택 (환영이 더 가까우면 환영)
      let tx = p.x, ty = p.y, tgtImg = null, bd = U.d2(e.x, e.y, p.x, p.y);
      for (const im of G.images) { const d = U.d2(e.x, e.y, im.x, im.y); if (d < bd) { bd = d; tx = im.x; ty = im.y; tgtImg = im; } }
      const spd = e.speed * (1 - e.slowAmt);
      const dx = tx - e.x, dy = ty - e.y, dist = Math.sqrt(bd) || 1;
      if (e.boss) G.Boss.update(e, dt, dx / dist, dy / dist, dist, spd);
      else if (e.def.ranged) {
        const rg = e.def.ranged;
        let mv = dist > rg.range ? 1 : dist < rg.range * 0.7 ? -0.6 : 0;
        e.x += dx / dist * spd * mv * dt; e.y += dy / dist * spd * mv * dt;
        e.shootT -= dt;
        if (e.shootT <= 0 && dist < rg.range * 1.3) {
          e.shootT = rg.cd;
          G.EProj.spawn(e.x, e.y - 16, Math.atan2(ty - e.y + 10, tx - e.x), rg.speed, rg.dmg, 'shadow');
        }
      } else {
        e.x += dx / dist * spd * dt; e.y += dy / dist * spd * dt;
      }
      if (Math.abs(dx) > 2) e.face = dx > 0 ? 1 : -1;
      // 밀어내기
      if (!e.def.fly || e.boss) {
        const ns = G.Grid.query(e.x, e.y, e.r * 0.8);
        let c = 0;
        for (const o of ns) {
          if (o === e || o.boss && !e.boss) continue;
          const ox = e.x - o.x, oy = e.y - o.y, d = Math.hypot(ox, oy) || 0.1, ov = (e.r + o.r) * 0.8 - d;
          if (ov > 0) { const push = Math.min(ov, 4) * (e.boss ? 0.1 : 0.5); e.x += ox / d * push; e.y += oy / d * push; }
          if (++c > 6) break;
        }
      }
      // 근접 공격
      const reach = e.r + 12;
      if (e.atkT <= 0) {
        if (tgtImg && Math.sqrt(U.d2(e.x, e.y, tgtImg.x, tgtImg.y)) < reach + 6) { tgtImg.hp -= e.dmg; e.atkT = 0.9; }
        else if (Math.sqrt(U.d2(e.x, e.y, p.x, p.y)) < reach + p.r * 0.5) { G.hurtPlayer(e.dmg, e); e.atkT = 1.0; }
      }
      // 너무 멀어지면 반대편으로 재배치
      if (!e.boss && bd > 1500 * 1500) {
        const a = Math.atan2(p.y - e.y, p.x - e.x) + U.rand(-0.6, 0.6), R = Math.max(G.W, G.H) / 2 + 80;
        e.x = p.x + Math.cos(a) * R; e.y = p.y + Math.sin(a) * R;
      }
    }
    G.enemies = G.enemies.filter(e => !e.dead);
  },
};

// ================= 적 투사체 =================
G.EProj = {
  spawn(x, y, a, speed, dmg, kind = 'shadow', r = 9) {
    G.eprojs.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg, kind, r, life: 5 });
  },
  update(dt) {
    const p = G.player;
    for (const b of G.eprojs) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (Math.random() < 0.5) G.fx.part({ x: b.x, y: b.y, life: 0.3, size: 10, rgb: b.kind === 'frost' ? '100,180,255' : '140,40,220' });
      if (U.d2(b.x, b.y, p.x, p.y - 10) < (b.r + p.r) ** 2) { G.hurtPlayer(b.dmg); b.life = 0; G.fx.burst(b.x, b.y, 8, { rgb: '160,60,240', sp: 100, size: 9 }); }
      for (const im of G.images) if (U.d2(b.x, b.y, im.x, im.y) < 18 * 18) { im.hp -= b.dmg; b.life = 0; }
    }
    G.eprojs = G.eprojs.filter(b => b.life > 0);
  },
};

// ================= 바닥 경고 표시 (보스 기술) =================
G.Tele = {
  add(o) { G.tele.push(Object.assign({ t: 0, max: 1.2, r: 80, color: '255,60,30' }, o)); },
  update(dt) {
    for (const k of G.tele) {
      k.t += dt;
      if (k.follow) { k.x = k.follow.x; k.y = k.follow.y; }
      if (k.t >= k.max) { k.done = true; if (k.onBoom) k.onBoom(k); }
    }
    G.tele = G.tele.filter(k => !k.done);
  },
};
const playerIn = (x, y, r) => U.d2(x, y, G.player.x, G.player.y) < r * r;

// ================= 보스 AI =================
G.Boss = {
  cast(e, name, dur, fn) { e.cast = { name, t: 0, max: dur }; e.castFn = fn; },
  summon(e, id, n, R = 140) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const m = G.Enemy.spawn(id, e.x + Math.cos(a) * R, e.y + Math.sin(a) * R);
      G.fx.burst(m.x, m.y, 8, { rgb: '80,255,120', sp: 80, size: 10 });
    }
  },
  update(e, dt, nx, ny, dist, spd) {
    const p = G.player, ai = e.ai, hpPct = e.hp / e.maxHp;
    if (e.cast) {
      e.cast.t += dt;
      if (e.cast.t >= e.cast.max) { const fn = e.castFn; e.cast = null; e.castFn = null; fn && fn(); }
    }
    const casting = !!e.cast;
    if (dist > 520) spd *= 1 + (dist - 520) / 200;
    if (e.id === 'patchwerk') {
      ai.strike ??= 6; ai.cloud ??= 12;
      if (!ai.enr && hpPct < 0.3) { ai.enr = true; G.UI.warn('패치워크가 광폭해집니다!', '#ff3030'); G.Audio.play('boss'); }
      const sp = spd * (ai.enr ? 1.45 : 1) * (casting ? 0.2 : 1);
      if (dist > e.r) { e.x += nx * sp * dt; e.y += ny * sp * dt; }
      ai.strike -= dt; ai.cloud -= dt;
      if (ai.strike <= 0 && !casting) {
        ai.strike = ai.enr ? 6 : 8.5;
        G.Tele.add({ x: e.x, y: e.y, r: 150, max: 1.3, follow: e });
        this.cast(e, '증오의 일격', 1.3, () => {
          if (playerIn(e.x, e.y, 150 + p.r)) G.hurtPlayer(48);
          G.fx.ring(e.x, e.y, 20, 150, 0.4, '255,80,40', 8, 0.25); G.fx.shake(10); G.Audio.play('explode');
        });
      }
      if (ai.cloud <= 0) {
        ai.cloud = 13;
        for (let i = 0; i < 3; i++) {
          const x = p.x + U.rand(-140, 140), y = p.y + U.rand(-140, 140);
          G.Tele.add({ x, y, r: 75, max: 1.4, color: '120,255,60', onBoom: k => G.Zones.add({ kind: 'poison', x: k.x, y: k.y, r: 75, life: 8, tick: 0.5, tickT: 0, onTick: z => { if (playerIn(z.x, z.y, z.r)) G.hurtPlayer(9); } }) });
        }
      }
    } else if (e.id === 'kelthuzad') {
      ai.volley ??= 3; ai.blast ??= 8; ai.summon ??= 6; ai.void ??= 5;
      const f = hpPct < 0.5 ? 0.72 : 1;
      if (hpPct < 0.5 && !ai.p2) { ai.p2 = true; G.UI.warn('켈투자드: "리치 왕이시여, 도와주소서!"', '#7fd4ff'); this.summon(e, 'gargoyle', 10, 200); }
      let mv = dist > 380 ? 1 : dist < 260 ? -1 : 0;
      const sx = -ny, sy = nx;
      e.x += (nx * mv + sx * 0.5) * spd * dt * (casting ? 0.3 : 1); e.y += (ny * mv + sy * 0.5) * spd * dt * (casting ? 0.3 : 1);
      ai.volley -= dt; ai.blast -= dt; ai.summon -= dt; ai.void -= dt;
      if (ai.volley <= 0 && !casting) {
        ai.volley = 4.2 * f;
        this.cast(e, '어둠의 화살 일제 사격', 0.8, () => {
          const n = hpPct < 0.5 ? 18 : 12, off = Math.random();
          for (let i = 0; i < n; i++) G.EProj.spawn(e.x, e.y - 20, off + i / n * Math.PI * 2, 210, 13, 'shadow', 10);
          G.Audio.play('shadow');
        });
      } else if (ai.blast <= 0 && !casting) {
        ai.blast = 10 * f;
        const x = p.x, y = p.y;
        G.Tele.add({ x, y, r: 90, max: 1.5, color: '90,180,255', onBoom: k => {
          if (playerIn(k.x, k.y, 90 + p.r)) { G.hurtPlayer(30); p.rootT = 1.6; G.fx.text(p.x, p.y - 50, '서리 폭발!', '#7fd4ff', 20, true); }
          G.fx.ring(k.x, k.y, 10, 90, 0.4, '150,210,255', 8, 0.3); G.fx.shards(k.x, k.y, 20, 260); G.Audio.play('freeze');
        } });
        this.cast(e, '서리 폭발', 1.5, null);
      }
      if (ai.void <= 0) {
        ai.void = 7 * f;
        for (let i = 0; i < 3; i++) {
          const x = p.x + U.rand(-160, 160), y = p.y + U.rand(-160, 160);
          G.Tele.add({ x, y, r: 70, max: 1.3, color: '170,60,255', onBoom: k => { if (playerIn(k.x, k.y, 70 + p.r)) G.hurtPlayer(26); G.fx.burst(k.x, k.y, 20, { rgb: '150,50,240', sp: 200, size: 14 }); G.Audio.play('shadow'); } });
        }
      }
      if (ai.summon <= 0) { ai.summon = 16 * f; this.summon(e, 'ghoul', 8); G.UI.warn('켈투자드가 구울을 소환합니다!', '#7fff7f', 1.8); }
    } else if (e.id === 'lichking') {
      ai.defile ??= 8; ai.reaper ??= 6; ai.summon ??= 4; ai.aura ??= 0; ai.spirits ??= 20;
      const auraR = hpPct < 0.4 ? 220 : 160;
      e.auraR = auraR;
      if (hpPct < 0.4 && !ai.p2) { ai.p2 = true; G.UI.warn('리치 왕: "무자비한 겨울이 너희를 삼키리라!"', '#7fd4ff'); G.Audio.play('boss'); }
      const sp = spd * (casting ? 0.25 : 1);
      if (dist > e.r) { e.x += nx * sp * dt; e.y += ny * sp * dt; }
      ai.aura -= dt;
      if (ai.aura <= 0) { ai.aura = 0.5; if (playerIn(e.x, e.y, auraR)) G.hurtPlayer(hpPct < 0.4 ? 9 : 6); }
      if (Math.random() < 0.7) { const a = Math.random() * 6.28, r = Math.random() * auraR; G.fx.part({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, vx: 60, vy: 40, life: 0.8, size: 4, size1: 2, rgb: '230,245,255', type: 'snow', add: false }); }
      ai.defile -= dt; ai.reaper -= dt; ai.summon -= dt; ai.spirits -= dt;
      if (ai.defile <= 0 && !casting) {
        ai.defile = 12;
        const x = p.x, y = p.y;
        G.Tele.add({ x, y, r: 60, max: 1.6, color: '60,10,80' });
        this.cast(e, '모독', 1.6, () => {
          G.Zones.add({ kind: 'defile', x, y, r: 60, life: 16, tick: 0.5, tickT: 0, update: (z, dt) => { z.r += dt * 7; }, onTick: z => { if (playerIn(z.x, z.y, z.r)) { G.hurtPlayer(11); z.r += 6; } } });
          G.Audio.play('shadow');
        });
      } else if (ai.reaper <= 0 && !casting && dist < 260) {
        ai.reaper = 8;
        G.Tele.add({ x: e.x, y: e.y, r: 140, max: 1.1, follow: e, color: '120,220,255' });
        this.cast(e, '영혼 수확자', 1.1, () => {
          if (playerIn(e.x, e.y, 140 + p.r)) G.hurtPlayer(52);
          G.fx.ring(e.x, e.y, 20, 140, 0.4, '120,220,255', 8, 0.3); G.fx.shake(10); G.Audio.play('explode');
        });
      }
      if (ai.summon <= 0) { ai.summon = 15; this.summon(e, hpPct < 0.5 ? 'gargoyle' : 'ghoul', 10, 160); G.UI.warn('리치 왕이 구울 무리를 소환합니다!', '#7fff7f', 1.8); }
      if (ai.spirits <= 0 && hpPct < 0.7) {
        ai.spirits = 14;
        for (let i = 0; i < 16; i++) G.EProj.spawn(e.x, e.y - 30, i / 16 * Math.PI * 2, 190, 14, 'frost', 11);
        G.Audio.play('freeze');
      }
    }
  },
};
