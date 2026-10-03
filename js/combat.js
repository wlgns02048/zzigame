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
    if ((G.texts.length > 90 && !crit) || G.texts.length > 160) return null;
    const t = { x: x + U.rand(-8, 8), y, vy: crit ? -110 : -60, str, col, size, t: 0, max: crit ? 1.0 : 0.75, crit, vx: U.rand(-20, 20), pop: 0, rot: crit ? U.rand(-0.12, 0.12) : 0 };
    G.texts.push(t);
    return t;
  },
  // 화면 흔들림: v는 최대 흔들림 픽셀(18까지). dx, dy를 주면 그 방향으로 화면이 한 번 밀린다
  shake(v, dx = 0, dy = 0) {
    const cam = G.cam;
    cam.trauma = Math.min(1, Math.max(cam.trauma, Math.sqrt(Math.min(18, v) / 18)));
    if (dx || dy) { cam.kx += dx * v * 0.7; cam.ky += dy * v * 0.7; }
  },
  // 히트스톱: 큰 타격 순간 실제 시간 sec초 동안 게임을 멈춘다 (연달아 걸려 끊겨 보이지 않게 0.25초 간격, 더 큰 멈춤은 간격을 무시)
  hitStop(sec) {
    if (!G.Settings.get('hitstop') || G.Bot.on || G.simulating || (G.t < G.stopCd && sec <= G.stopLast)) return;
    G.stopT = Math.max(G.stopT, Math.min(0.15, sec)); G.stopCd = G.t + 0.25; G.stopLast = sec;
  },
  // 슬로모션: 실제 시간 dur초 동안 게임이 k배 속도로 흐른다
  slowMo(k, dur) {
    if (G.Bot.on || G.simulating) return;
    G.slowK = k; G.slowT = Math.max(G.slowT, dur);
  },
  // 화면 전체가 잠깐 물드는 빛 (설정에서 끌 수 있음)
  flash(rgb = '255,255,255', a = 0.25, dur = 0.18) {
    if (!G.Settings.get('flash') || G.simulating) return;
    G.R.scr = { rgb, a, t: 0, dur };
  },
  // 충격파: 굵고 밝은 띠가 빠르게 퍼진다
  wave(x, y, r, rgb = '220,245,255', dur = 0.35) { G.rings.push({ kind: 'wave', x, y, r0: r * 0.15, r1: r, t: 0, dur, color: rgb }); },
  // 적이 쓰러지는 모습 (하얗게 번쩍 → 납작하게 눌리며 사라짐)
  corpse(e) {
    if (G.simulating) return;
    if (G.corpses.length > 80) G.corpses.shift();
    G.corpses.push({ e, t: 0, max: e.boss ? 1.4 : 0.32 });
  },
  // 바닥 자국: kind = ichor(일반) · frost(빙결) · scorch(화염 · 암흑)
  decal(x, y, kind, s = 1) {
    if (G.simulating) return;
    if (G.decals.length > 140) G.decals.shift();
    G.decals.push({ x, y, kind, s: s * U.rand(0.8, 1.2), rot: Math.random() * 6.28, v: U.randi(0, 2), t: 0, max: U.rand(7, 10) });
  },
};

// ================= 피해 미터 =================
G.meter = {
  d: {}, total: 0,
  reset() { this.d = {}; this.total = 0; },
  add(src, v) { this.d[src] = (this.d[src] || 0) + v; this.total += v; },
};

// ================= 연속 처치 =================
// 3초 안에 다음 적을 쓰러뜨리면 이어진다. 단계마다 알림 · 소리 · 작은 골드 보너스
G.Streak = {
  WINDOW: 3,
  STEPS: [[50, 2], [100, 5], [200, 8], [300, 10], [500, 15], [1000, 25]], // [처치 수, 보너스 골드]
  n: 0, lastT: -99, best: 0, next: 0,
  reset() { this.n = 0; this.lastT = -99; this.best = 0; this.next = 0; },
  // 1000 이후로는 500마다
  step(i) { return i < this.STEPS.length ? this.STEPS[i] : [1000 + 500 * (i - this.STEPS.length + 1), 15]; },
  kill() {
    if (G.t - this.lastT > this.WINDOW) { this.n = 0; this.next = 0; }
    this.n++; this.lastT = G.t; this.best = Math.max(this.best, this.n);
    const [at, gold] = this.step(this.next);
    if (this.n < at) return;
    this.next++;
    const p = G.player, g = gold * G.Waves.goldMul;
    G.stats.gold += g;
    G.fx.text(p.x, p.y - 60, `${at} 연속 처치! +${Math.round(g)} 골드`, '#ffd100', 20, true);
    G.Audio.play('combo'); G.UI.streakPop = true;
  },
  alive() { return G.t - this.lastT <= this.WINDOW; },
};

// ================= 상태 =================
// 보스는 빙결되지 않는 대신 잠깐 '얼어붙은 것으로 간주'(shatterT)된다
G.frozenLike = e => e.frozenT > 0 || e.wc > 0 || e.shatterT > G.t;

G.freeze = (e, dur) => {
  if (e.dead) return;
  dur *= G.player.stats.dur;
  if (e.boss) {
    G.chill(e, 0.3, dur);
    // 8초에 한 번, 2초 동안 얼음창 · 산산조각이 통하는 상태
    if (G.t >= (e.shatterCd || 0)) {
      e.shatterT = G.t + 2; e.shatterCd = G.t + 8;
      G.fx.text(e.x, e.y - e.r * 2.4, '얼어붙음', '#bfe8ff', 16, true);
      G.fx.burst(e.x, e.y, 14, { rgb: '200,240,255', sp: 140, size: 12 });
      G.Audio.play('freeze', 0.6, e.x);
    }
    return;
  }
  if (e.elite) dur *= 0.5;
  if (e.frozenT <= 0) { G.Audio.play('freeze', 0.5, e.x); G.fx.burst(e.x, e.y, 6, { rgb: '200,240,255', sp: 80, size: 8 }); }
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
  G.RunLog.hit(e, src, d);
  e.hp -= d; e.flash = 0.07;
  if (e.goblin) G.Events.goblinHit(e);
  G.meter.add(src, d);
  // 맞은 적이 플레이어 반대쪽으로 살짝 밀려 보인다 (그림만, 실제 위치는 그대로)
  if (!e.boss && !o.small) {
    const kx = e.x - p.x, ky = e.y - p.y, kd = Math.hypot(kx, ky) || 1;
    e.kbx = kx / kd; e.kby = ky / kd; e.kb = Math.min(12, (e.kb || 0) + (crit ? 7 : 3));
  }
  if (!o.noText) {
    const col = o.school === 'fire' ? (crit ? '#ffb347' : '#ff8a3c') : o.school === 'arcane' ? (crit ? '#ff9cff' : '#e4a6ff') : o.school === 'shadow' ? (crit ? '#e6b3ff' : '#c58bff') : (crit ? '#ffe14d' : '#ffffff');
    // 짧은 간격으로 같은 적에게 들어간 일반 피해는 숫자 하나로 합쳐 커지게 한다 (지속 피해 · 다단 히트가 화면을 덮지 않도록)
    const tx = e.dtx;
    if (!crit && tx && tx.col === col && tx.t < 0.45) {
      tx.val += d; tx.str = U.num(tx.val); tx.pop = 1; tx.t = Math.min(tx.t, 0.2); tx.size = Math.min(tx.base * 1.45, tx.size + 0.7);
    } else {
      const t = G.fx.text(e.x, e.y - e.r - 6, crit ? U.num(d) + '!' : U.num(d), col, crit ? (o.small ? 18 : 24) : (o.small ? 12 : 15), crit);
      if (t && !crit) { t.val = d; t.base = t.size; e.dtx = t; }
    }
  }
  if (crit) {
    G.cls(p).onCrit(e, p);
    if (!o.small) G.Audio.play('crit', 0.5, e.x);
    if ((e.boss || e.elite) && d >= e.maxHp * 0.04) G.fx.hitStop(0.035);
  }
  if (e.hp <= 0) G.killEnemy(e, frozen, o.school);
  return d;
};

// 범위 피해
G.aoe = (x, y, r, base, src, o = {}, each) => {
  const list = G.Grid.query(x, y, r);
  for (const e of list) { G.hit(e, base, src, o); if (each) each(e); }
  return list.length;
};

G.killEnemy = (e, frozen, school) => {
  if (e.dead) return;
  e.dead = true; G.stats.kills++; G.Streak.kill();
  const big = e.boss || e.elite, ds = e.r / 14;
  if (frozen || e.frozenT > 0) {
    G.fx.shards(e.x, e.y, e.boss ? 40 : e.elite ? 22 : 10, e.boss ? 400 : 220);
    G.fx.burst(e.x, e.y, 5, { rgb: '190,235,255', sp: 100, size: 14 });
    G.fx.decal(e.x, e.y + e.r * 0.6, 'frost', ds);
    G.Audio.play('shatter', 0.6, e.x);
  } else {
    G.fx.corpse(e);
    G.fx.burst(e.x, e.y, 6, { rgb: '30,30,40', add: false, type: 'smoke', sp: 60, size: 12, life: 0.6, drag: 4 });
    if (Math.random() < 0.4) G.fx.burst(e.x, e.y, 2, { type: 'bone', add: false, sp: 120, size: 1, sMin: 1, size1: 1, life: 0.7, grav: 200, drag: 1 });
    G.fx.decal(e.x, e.y + e.r * 0.6, school === 'fire' || school === 'shadow' ? 'scorch' : 'ichor', ds);
    G.Audio.play('pop', 0.35, e.x);
  }
  if (big) {
    G.Audio.play('eliteKill', e.boss ? 1 : 0.7, e.x); G.Audio.duck(e.boss ? 0.25 : 0.5, e.boss ? 1 : 0.3);
    G.fx.wave(e.x, e.y, e.boss ? 260 : 120, e.boss ? '255,230,160' : '255,210,110', e.boss ? 0.6 : 0.4);
    G.fx.shake(e.boss ? 16 : 7);
    G.fx.hitStop(e.boss ? 0.15 : 0.07);
    if (e.boss) { G.fx.slowMo(0.3, 1.1); G.fx.flash('255,240,200', 0.35, 0.5); }
  }
  // 전리품
  let xp = e.xp;
  if (xp > 0) {
    while (xp >= 50) { G.dropPickup('xp', e.x + U.rand(-20, 20), e.y + U.rand(-20, 20), 50); xp -= 50; }
    if (xp > 0) G.dropPickup('xp', e.x, e.y, xp);
  }
  const gm = 1 + (G.Meta.lib('luck') * 0.1);
  if (e.elite || e.boss) {
    G.dropPickup('chest', e.x, e.y, e.boss ? 2 : 1);
    for (let i = 0; i < (e.boss ? 12 : 4); i++) G.dropPickup('gold', e.x + U.rand(-40, 40), e.y + U.rand(-40, 40), U.randi(3, 6));
  } else {
    if (Math.random() < 0.025 * gm) G.dropPickup('gold', e.x, e.y, U.randi(1, 3));
    if (Math.random() < 0.005) G.dropPickup('food', e.x, e.y, 1);
    if (Math.random() < 0.0035) G.dropPickup('magnet', e.x, e.y, 1);
    else if (Math.random() < 0.0006) G.dropPickup('bloodlust', e.x, e.y, 1); // 피의 욕망: 10분 판에 한두 번
  }
  G.Events.onKill(e);
  G.cls().onKill(e, G.player);
  G.Waves.onKill(e);
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
  if (src && src.hp !== undefined && src.hp < src.maxHp * 0.3 && G.Waves.affix('raging')) dmg *= 1.5;
  dmg *= (1 - Math.min(0.6, p.stats.armor)) * G.Waves.dmgMul() * (1 - (p.stats.vers || 0) * 0.5) * (p.drT > 0 ? 1 - p.dr : 1);
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
  G.RunLog.hurt(src, dmg);
  if (G.Bot.sync) { (G.dmgLog ||= []).push([G.t.toFixed(1), src && src.id ? src.id : 'proj', dmg]); if (G.dmgLog.length > 30) G.dmgLog.shift(); }
  G.fx.text(p.x, p.y - 34, '-' + dmg, '#ff4040', 17);
  // 맞은 방향으로 화면이 밀린다. 큰 피해(최대 생명력 12% 이상)는 잠깐 멈칫
  const sx = src && src.x !== undefined ? p.x - src.x : 0, sy = src && src.x !== undefined ? p.y - src.y : 0, sd = Math.hypot(sx, sy) || 1;
  G.fx.shake(Math.min(10, 3 + 40 * dmg / p.maxHp), sx / sd, sy / sd);
  if (dmg >= p.maxHp * 0.12) G.fx.hitStop(0.05);
  G.Audio.play('hurt', 0.7);
  G.UI.hurtFlash();
  if (p.hp <= 0 && !G.cls(p).preventDeath(p)) G.playerDeath();
};
