'use strict';
// ================= 적 =================
let enemyUid = 0;
G.Enemy = {
  spawn(id, x, y, o = {}) {
    const def = G.ENEMIES[id], elite = !!o.elite;
    const hm = def.boss ? G.Waves.bossHpMul() : G.Waves.hpMul();
    const hp = Math.round(def.hp * hm * (elite ? 9 : 1));
    const um = G.Waves.unitDmgMul(def.boss, elite);
    const e = {
      uid: ++enemyUid, id, def, x, y, r: def.r * (elite ? 1.4 : 1), hp, maxHp: hp,
      speed: def.speed * U.rand(0.92, 1.08) * (elite ? 0.95 : 1), dmg: def.dmg * (elite ? 1.5 : 1) * um, dmgMul: um, xp: def.xp * (elite ? 12 : 1),
      frozenT: 0, slowT: 0, slowAmt: 0, wc: 0, wcT: 0, flash: 0, atkT: 0, shootT: U.rand(1, 3), t: Math.random() * 10, face: -1,
      elite, boss: !!def.boss, scale: def.scale * (elite ? 1.4 : 1), ai: {},
    };
    G.enemies.push(e);
    return e;
  },

  update(dt) {
    const p = G.player;
    // 재배치 한계 거리: 생성 고리(화면 대각선 절반 + 40)보다 항상 멀어야 한다. 넓은 화면에서 고정 1500이면 생성 즉시 재배치가 반복된다.
    const leash = Math.max(1500, Math.hypot(G.W, G.H) / 2 + 300);
    G.Grid.clear();
    G.Mob.casting = 0;
    for (const e of G.enemies) if (!e.dead) { G.Grid.add(e); if (e.mcast) G.Mob.casting++; }
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.t += dt; e.flash -= dt; e.atkT -= dt;
      if (e.wcT > 0 && (e.wcT -= dt) <= 0) e.wc = 0;
      if (e.slowT > 0 && (e.slowT -= dt) <= 0) e.slowAmt = 0;
      if (e.dots) G.Dots.tick(e, dt);
      if (e.dead) continue;
      if (e.stunT > 0) { e.stunT -= dt; continue; }
      if (e.frozenT > 0) { e.frozenT -= dt; continue; }
      // 대상 선택 (환영이 더 가까우면 환영)
      let tx = p.x, ty = p.y, tgtImg = null, bd = U.d2(e.x, e.y, p.x, p.y);
      for (const im of G.images) { const d = U.d2(e.x, e.y, im.x, im.y); if (d < bd) { bd = d; tx = im.x; ty = im.y; tgtImg = im; } }
      // 공포: 플레이어에게서 도망
      if (e.fearT > 0) {
        e.fearT -= dt;
        const fx = e.x - p.x, fy = e.y - p.y, fd = Math.hypot(fx, fy) || 1, fs = e.speed * 0.8 * (1 - e.slowAmt);
        e.x += fx / fd * fs * dt; e.y += fy / fd * fs * dt; e.face = fx > 0 ? 1 : -1;
        continue;
      }
      const spd = e.speed * (1 - e.slowAmt);
      const dx = tx - e.x, dy = ty - e.y, dist = Math.sqrt(bd) || 1;
      if (e.boss) G.Boss.update(e, dt, dx / dist, dy / dist, dist, spd);
      else if (G.Mob.update(e, dt, dist)) { /* 기술 시전 중: 제자리 */ }
      else if (e.def.ranged) {
        const rg = e.def.ranged;
        let mv = dist > rg.range ? 1 : dist < rg.range * 0.7 ? -0.6 : 0;
        e.x += dx / dist * spd * mv * dt; e.y += dy / dist * spd * mv * dt;
        e.shootT -= dt;
        if (e.shootT <= 0 && dist < rg.range * 1.3) {
          e.shootT = rg.cd;
          G.EProj.spawn(e.x, e.y - 16, Math.atan2(ty - e.y + 10, tx - e.x), rg.speed, rg.dmg * e.dmgMul, rg.kind || 'shadow');
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
      if (!e.boss && bd > leash * leash) {
        const a = Math.atan2(p.y - e.y, p.x - e.x) + U.rand(-0.6, 0.6), R = Math.max(G.W, G.H) / 2 + 80;
        e.x = p.x + Math.cos(a) * R; e.y = p.y + Math.sin(a) * R;
      }
    }
    G.enemies = G.enemies.filter(e => !e.dead);
  },
};

// ================= 적 투사체 =================
const EPROJ_RGB = { frost: '100,180,255', shadow: '140,40,220', fire: '255,120,30', arcane: '230,110,255', holy: '255,220,120', blade: '200,200,210' };
G.EProj = {
  spawn(x, y, a, speed, dmg, kind = 'shadow', r = 9) {
    G.eprojs.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg, kind, r, life: 5 });
  },
  update(dt) {
    const p = G.player;
    for (const b of G.eprojs) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (Math.random() < 0.5) G.fx.part({ x: b.x, y: b.y, life: 0.3, size: 10, rgb: EPROJ_RGB[b.kind] || '140,40,220' });
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
      if (k.owner && k.owner.dead) { k.done = true; continue; } // 시전하던 적이 죽으면 취소
      if (k.t >= k.max) { k.done = true; if (k.tag) G.Aim.record(k); if (k.onBoom) k.onBoom(k); }
    }
    G.tele = G.tele.filter(k => !k.done);
  },
};
const playerIn = (x, y, r) => U.d2(x, y, G.player.x, G.player.y) < r * r;

// ================= 바닥 기술 겨냥 =================
// 시전 순간의 플레이어 위치를 노리면, 계속 움직이는 플레이어는 경고(1~1.5초) 동안 200px 넘게 벗어나서 저절로 빗나간다.
// 그래서 최근 이동을 평균 내 두었다가 경고가 끝날 때 있을 자리를 앞질러 노리고(lead),
// 일렬(wall) · 포위(ring) · 추적(trail)처럼 한 방향으로 달리기만 해서는 피할 수 없는 배치를 섞는다.
G.Aim = {
  vx: 0, vy: 0, w: 0, a: null,
  reset() { this.vx = this.vy = this.w = 0; this.a = null; G.hazStats = {}; },
  // 매 프레임: 0.25초 평균 속도 (방향키를 잠깐 바꾼 것에 휘둘리지 않도록) + 0.5초 평균 회전 속도 (원을 그리며 도는 카이팅 예측)
  track(dt) {
    const p = G.player, sp = p.moving ? p.stats.speed : 0;
    let k = Math.min(1, dt / 0.25);
    this.vx += (p.mvx * sp - this.vx) * k; this.vy += (p.mvy * sp - this.vy) * k;
    if (Math.hypot(this.vx, this.vy) < 60) { this.a = null; this.w *= 1 - k; return; }
    const a = Math.atan2(this.vy, this.vx);
    if (this.a !== null && dt > 0) { k = Math.min(1, dt / 0.5); this.w += (U.clamp(U.angDiff(this.a, a) / dt, -2, 2) - this.w) * k; }
    this.a = a;
  },
  // 앞지르는 정도 (1 = 지금 속도 그대로 가면 정확히 맞는 자리). 일반 0.7 · 정예 0.85 · 보스 1 (흔들림 ±0.2, 보스 ±0.1)
  // 엔드리스는 단계마다 조금씩 정확해진다. 직진하는 플레이어 기준 일반 몹 장판 적중 약 45% (tools/sim.cjs --query "&runner=line")
  lead(e, mul = 1) {
    const base = e && e.boss ? 1 : e && e.elite ? 0.85 : 0.7, lv = G.Waves.endless ? Math.min(0.15, G.Waves.level * 0.015) : 0;
    return Math.min(1.1, (base + lv) * mul + U.rand(-0.2, 0.2) * (e && e.boss ? 0.5 : 1));
  },
  // T초 뒤 예상 위치 (f: 앞지르는 정도)
  at(T, f) {
    const p = G.player, t = T * f, w = this.w;
    if (Math.abs(w) < 0.08 || this.a === null) return { x: p.x + this.vx * t, y: p.y + this.vy * t };
    // 같은 빠르기로 같은 만큼 계속 돈다고 보고 호를 따라간다
    const v = Math.hypot(this.vx, this.vy), a = this.a;
    return { x: p.x + v / w * (Math.sin(a + w * t) - Math.sin(a)), y: p.y - v / w * (Math.cos(a + w * t) - Math.cos(a)) };
  },
  // 진행 방향. 거의 멈춰 있으면 시전자 → 플레이어 방향
  dir(e) {
    const v = Math.hypot(this.vx, this.vy);
    if (v > 40) return [this.vx / v, this.vy / v];
    const p = G.player, dx = e ? p.x - e.x : 0, dy = e ? p.y - e.y : 0, d = Math.hypot(dx, dy);
    if (d > 1) return [dx / d, dy / d];
    const a = Math.random() * Math.PI * 2; return [Math.cos(a), Math.sin(a)];
  },
  // 장판 위치 목록. aim: lead(예측 지점 + 주변) · wall(진행 방향을 가로막는 일렬) · ring(틈 하나 남긴 포위)
  // wall · ring 간격 1.45r: 바닥은 세로로 0.75배 눌려 그려지므로, 세로로 늘어서도 그려진 타원끼리 맞닿게 (보이는 틈 = 실제 틈)
  place(aim, e, s, T) {
    const n = s.n || 1, r = s.r, pts = [];
    if (aim === 'wall') {
      const c = this.at(T, this.lead(e)), [dx, dy] = this.dir(e), gap = r * 1.45;
      for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * gap; pts.push({ x: c.x - dy * o, y: c.y + dx * o }); }
    } else if (aim === 'ring') {
      // 멈추면 안쪽에 갇히고, 그대로 달리면 고리에 걸린다 → 틈을 찾아 나가야 한다
      const c = this.at(T, 0.3), m = n + 1, R = Math.max(r * 2, m * r * 1.45 / (Math.PI * 2)), skip = U.randi(0, m - 1), a0 = Math.random() * Math.PI * 2;
      for (let i = 0; i < m; i++) if (i !== skip) { const a = a0 + i / m * Math.PI * 2; pts.push({ x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R }); }
    } else {
      const c = this.at(T, this.lead(e)); pts.push(c);
      for (let i = 1; i < n; i++) { const a = Math.random() * Math.PI * 2, d = r * U.rand(1.4, 2.6); pts.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d }); }
    }
    return pts;
  },
  // 장판 경고를 깔고, 터지면 피해 장판을 남긴다. o: { tag, r, T, color, life, dmg, owner }
  drop(pts, o) {
    for (const q of pts) G.Tele.add({ tag: o.tag, x: q.x, y: q.y, r: o.r, max: o.T, owner: o.owner, color: o.color, onBoom: k => hurtZone(k.x, k.y, o.r, o.life, o.color, o.dmg) });
  },
  // 추적: 간격을 두고 플레이어의 "그 순간" 위치에 하나씩 떨어진다 → 멈추면 맞고, 지나온 길은 막힌다
  trail(e, o, n, gap = 0.35) {
    for (let i = 0; i < n; i++) G.later(i * gap, () => { if (!e.dead && G.state === 'play') this.drop([{ x: G.player.x, y: G.player.y }], o); });
  },
  // 경고가 터지는 순간 플레이어가 안에 있었는지 기록 (?sim 결과 · 밸런스 확인용)
  record(k) {
    const s = (G.hazStats ||= {})[k.tag] ||= [0, 0];
    s[0]++; if (playerIn(k.x, k.y, k.r + G.player.r)) s[1]++;
  },
};
// 플레이어 피해를 주는 장판 (봇이 피해 간다)
const hurtZone = (x, y, r, life, color, dmg) => G.Zones.add({ kind: 'tinted', hurt: true, color, x, y, r, life, tick: 0.5, tickT: 0, onTick: z => { if (playerIn(z.x, z.y, z.r)) G.hurtPlayer(dmg); } });

// ================= 중간급 적 · 정예의 바닥 기술 =================
// 경고가 뜬 뒤 터지므로 피하면 맞지 않는다. 시전 중에는 제자리에 서 있고, 죽으면 취소된다.
// 피해는 그 적의 근접 피해(e.dmg: 스테이지 · 정예 · 엔드리스 배율 포함) × mul.
const ELITE_SKILLS = [{ type: 'slam', name: '강타', cd: 9, r: 95, mul: 1.8 }];
G.Mob = {
  MAX_CASTING: 3, // 동시에 시전하는 적 수 상한 (화면이 경고로 뒤덮이지 않도록)
  casting: 0,
  range(s) { return s.type === 'slam' ? s.r + 50 : s.type === 'cone' ? s.r * 0.85 : s.type === 'leap' ? 380 : 420; },
  // true를 돌려주면 이번 프레임은 이동하지 않는다
  update(e, dt, dist) {
    const list = e.def.skills || (e.elite ? ELITE_SKILLS : null);
    if (!list) return false;
    const ai = e.ai;
    if (e.mcast) { if ((e.mcast.t += dt) >= e.mcast.max) e.mcast = null; return true; }
    ai.mcd ||= list.map(s => s.cd * U.rand(0.4, 1));
    for (let i = 0; i < list.length; i++) ai.mcd[i] -= dt * (e.elite ? 1.3 : 1);
    if (this.casting >= this.MAX_CASTING) return false;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (ai.mcd[i] > 0 || dist > this.range(s)) continue;
      ai.mcd[i] = s.cd * U.rand(0.9, 1.2);
      this.use(e, s);
      this.casting++;
      return true;
    }
    return false;
  },
  use(e, s) {
    const p = G.player, dmg = e.dmg * s.mul, col = s.color || (e.elite ? '255,170,50' : '255,80,40'), T = s.cast || 1.1;
    e.mcast = { t: 0, max: T };
    G.fx.text(e.x, e.y - e.r * 2.4, s.name, '#ffb040', 13);
    switch (s.type) {
      case 'slam':
        G.Tele.add({ x: e.x, y: e.y, r: s.r, max: T, follow: e, owner: e, color: col, onBoom: () => {
          if (playerIn(e.x, e.y, s.r + p.r)) G.hurtPlayer(dmg, e);
          if (s.zone) hurtZone(e.x, e.y, s.r * 0.7, s.zone.life, col, e.dmg * s.zone.mul);
          G.fx.ring(e.x, e.y, 15, s.r, 0.35, col, 6, 0.25); G.fx.shake(4); G.Audio.play('explode', 0.35);
        } });
        break;
      case 'blast': { // 속박이 붙어 있어 덜 앞지른다
        const { x, y } = G.Aim.at(T + 0.2, G.Aim.lead(e, 0.7));
        G.Tele.add({ tag: s.name, x, y, r: s.r, max: T + 0.2, owner: e, color: col, onBoom: k => {
          if (playerIn(k.x, k.y, s.r + p.r)) { G.hurtPlayer(dmg, e); if (s.root) p.rootT = s.root; }
          G.fx.ring(k.x, k.y, 10, s.r, 0.35, col, 6, 0.25); G.Audio.play('shadow', 0.4);
        } });
        e.mcast.max = T + 0.2;
        break;
      }
      case 'zones': {
        const o = { tag: s.name, r: s.r, T: T + 0.4, owner: e, color: col, life: s.life, dmg }, aim = s.aim || (s.self ? 'self' : 'lead');
        if (aim === 'trail') G.Aim.trail(e, { ...o, T: 0.9 }, s.n || 3);
        else G.Aim.drop(aim === 'self' ? [{ x: e.x, y: e.y }] : G.Aim.place(aim, e, s, o.T), o);
        e.mcast.max = 0.6; // 장판은 던지고 바로 움직인다
        break;
      }
      case 'cone': {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.face = Math.cos(a) > 0 ? 1 : -1;
        G.Tele.add({ x: e.x, y: e.y, r: s.r, a, arc: s.arc, shape: 'cone', max: T, follow: e, owner: e, color: col, onBoom: k => {
          const dx = p.x - k.x, dy = p.y - k.y;
          if (dx * dx + dy * dy < (s.r + p.r) ** 2 && Math.abs(U.angDiff(Math.atan2(dy, dx), a)) < s.arc / 2) G.hurtPlayer(dmg, e);
          for (let i = 0; i < 18; i++) { const b = a + U.rand(-s.arc / 2, s.arc / 2), v = U.rand(200, 380); G.fx.part({ x: k.x, y: k.y - 14, vx: Math.cos(b) * v, vy: Math.sin(b) * v, life: 0.45, size: 14, size1: 4, rgb: col }); }
          G.Audio.play('explode', 0.3);
        } });
        break;
      }
      case 'leap': {
        const { x, y } = G.Aim.at(T + 0.1, G.Aim.lead(e, 0.85));
        G.Tele.add({ tag: s.name, x, y, r: s.r, max: T + 0.1, owner: e, color: col, onBoom: k => {
          G.fx.burst(e.x, e.y, 10, { rgb: col, sp: 120, size: 10 });
          e.x = k.x; e.y = k.y;
          if (playerIn(k.x, k.y, s.r + p.r)) G.hurtPlayer(dmg, e);
          G.fx.ring(k.x, k.y, 10, s.r, 0.3, col, 6, 0.25); G.fx.shake(5); G.Audio.play('explode', 0.35);
        } });
        e.mcast.max = T + 0.1;
        break;
      }
    }
  },
};

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
        for (const { x, y } of G.Aim.place('lead', e, { n: 3, r: 75 }, 1.4)) {
          G.Tele.add({ tag: '독구름', x, y, r: 75, max: 1.4, color: '120,255,60', onBoom: k => G.Zones.add({ kind: 'poison', x: k.x, y: k.y, r: 75, life: 8, tick: 0.5, tickT: 0, onTick: z => { if (playerIn(z.x, z.y, z.r)) G.hurtPlayer(7); } }) });
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
        const { x, y } = G.Aim.at(1.5, G.Aim.lead(e, 0.6));
        G.Tele.add({ tag: '서리 폭발', x, y, r: 90, max: 1.5, color: '90,180,255', onBoom: k => {
          if (playerIn(k.x, k.y, 90 + p.r)) { G.hurtPlayer(30); p.rootT = 1.6; G.fx.text(p.x, p.y - 50, '서리 폭발!', '#7fd4ff', 20, true); }
          G.fx.ring(k.x, k.y, 10, 90, 0.4, '150,210,255', 8, 0.3); G.fx.shards(k.x, k.y, 20, 260); G.Audio.play('freeze');
        } });
        this.cast(e, '서리 폭발', 1.5, null);
      }
      if (ai.void <= 0) {
        ai.void = 7 * f;
        for (const { x, y } of G.Aim.place('lead', e, { n: 3, r: 70 }, 1.3)) {
          G.Tele.add({ tag: '공허 폭발', x, y, r: 70, max: 1.3, color: '170,60,255', onBoom: k => { if (playerIn(k.x, k.y, 70 + p.r)) G.hurtPlayer(22); G.fx.burst(k.x, k.y, 20, { rgb: '150,50,240', sp: 200, size: 14 }); G.Audio.play('shadow'); } });
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
        const { x, y } = G.Aim.at(1.6, G.Aim.lead(e));
        G.Tele.add({ tag: '모독', x, y, r: 60, max: 1.6, color: '60,10,80' });
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
    } else this.generic(e, dt, nx, ny, dist, spd);
  },

  // ---------- 범용 보스 AI: def.skills 목록을 재사용 대기시간대로 사용 ----------
  generic(e, dt, nx, ny, dist, spd) {
    const p = G.player, def = e.def, ai = e.ai, hpPct = e.hp / e.maxHp, dm = e.dmgMul || 1;
    if (!ai.cds) ai.cds = def.skills.map((s, i) => (s.cd || 10) * (0.35 + 0.18 * i));
    // 지속 효과: 광폭화 · 회복 · 오라
    for (const s of def.skills) {
      if (s.type === 'enrage' && !ai.enr && hpPct < s.at) { ai.enr = true; G.UI.warn(`${def.name}이(가) 광폭해집니다!`, '#ff3030'); G.Audio.play('boss'); }
      if (s.type === 'heal' && !ai.healed && hpPct < s.at) {
        ai.healed = true; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * s.amt);
        G.UI.warn(`${def.name}: ${s.name}!`, '#ffe080'); G.fx.ring(e.x, e.y, 10, 120, 0.6, '255,230,150', 6, 0.3);
      }
      if (s.type === 'aura') {
        e.auraR = s.r; ai.auraT = (ai.auraT ?? 0) - dt;
        if (ai.auraT <= 0) { ai.auraT = 0.5; if (playerIn(e.x, e.y, s.r)) G.hurtPlayer(s.dmg * dm); }
      }
    }
    const enr = ai.enr ? 1.4 : 1;
    if (e.cast) {
      e.cast.t += dt;
      if (e.cast.t >= e.cast.max) { const fn = e.castFn; e.cast = null; e.castFn = null; fn && fn(); }
    }
    const casting = !!e.cast;
    // 이동
    if (ai.charge) {
      const c = ai.charge, dx = c.x - e.x, dy = c.y - e.y, d = Math.hypot(dx, dy);
      c.t += dt;
      const st = Math.min(d, 620 * dt); e.x += dx / (d || 1) * st; e.y += dy / (d || 1) * st;
      if (!c.hit && playerIn(e.x, e.y, e.r + p.r + 8)) { c.hit = true; G.hurtPlayer(c.dmg); G.fx.shake(8); }
      if (d < 6 || c.t > 1.2) ai.charge = null;
      if (Math.random() < 0.6) G.fx.part({ x: e.x + U.rand(-10, 10), y: e.y + U.rand(-10, 10), life: 0.4, size: 14, rgb: def.glow || '255,150,60' });
      return;
    }
    if (dist > 520) spd *= 1 + (dist - 520) / 200;
    if (def.move === 'kite') {
      const mv = dist > 380 ? 1 : dist < 260 ? -1 : 0, sx = -ny, sy = nx;
      e.x += (nx * mv + sx * 0.5) * spd * enr * dt * (casting ? 0.3 : 1); e.y += (ny * mv + sy * 0.5) * spd * enr * dt * (casting ? 0.3 : 1);
    } else if (dist > e.r) { const sp = spd * enr * (casting ? 0.2 : 1); e.x += nx * sp * dt; e.y += ny * sp * dt; }
    // 기술
    def.skills.forEach((s, i) => { if (s.cd) ai.cds[i] -= dt * (ai.enr ? 1.3 : 1); });
    if (casting) return;
    for (let i = 0; i < def.skills.length; i++) {
      const s = def.skills[i];
      if (!s.cd || ai.cds[i] > 0) continue;
      if (s.at && hpPct > s.at) continue;
      if (s.type === 'slam' && dist > s.r + 80) continue;
      ai.cds[i] = s.cd;
      this.use(e, s, dm);
      break;
    }
  },
  use(e, s, dm) {
    const p = G.player, glow = e.def.glow || '255,80,40';
    switch (s.type) {
      case 'slam':
        G.Tele.add({ x: e.x, y: e.y, r: s.r, max: 1.2, follow: e, color: glow });
        this.cast(e, s.name, 1.2, () => {
          if (playerIn(e.x, e.y, s.r + p.r)) { G.hurtPlayer(s.dmg * dm); if (s.root) p.rootT = s.root; }
          G.fx.ring(e.x, e.y, 20, s.r, 0.4, glow, 8, 0.25); G.fx.shake(10); G.Audio.play('explode');
        });
        break;
      case 'nova':
        G.Tele.add({ x: e.x, y: e.y, r: s.r, max: s.cast || 1.6, follow: e, color: glow });
        G.UI.warn(`${e.def.name}: ${s.name}!`, '#ff6a1a', 1.6);
        this.cast(e, s.name, s.cast || 1.6, () => {
          if (playerIn(e.x, e.y, s.r + p.r)) G.hurtPlayer(s.dmg * dm);
          G.fx.ring(e.x, e.y, 20, s.r, 0.5, glow, 10, 0.3); G.fx.burst(e.x, e.y, 40, { rgb: glow, sp: 320, size: 14 }); G.fx.shake(12); G.Audio.play('explode');
        });
        break;
      case 'volley':
        this.cast(e, s.name, 0.8, () => {
          const off = Math.random();
          for (let i = 0; i < s.n; i++) G.EProj.spawn(e.x, e.y - 20, off + i / s.n * Math.PI * 2, s.speed || 210, s.dmg * dm, s.kind || 'shadow', 10);
          G.Audio.play('shadow');
        });
        break;
      case 'zones': { // aim: lead(기본) · wall · ring · trail (G.Aim 참고)
        const aim = s.aim || 'lead', o = { tag: s.name, r: s.r, T: aim === 'ring' ? 1.6 : 1.5, color: s.color, life: s.life, dmg: s.dmg * dm };
        if (aim === 'trail') G.Aim.trail(e, { ...o, T: 0.9 }, s.n);
        else G.Aim.drop(G.Aim.place(aim, e, s, o.T), o);
        if (aim === 'ring' || aim === 'wall') G.UI.warn(`${e.def.name}: ${s.name}!`, '#ffb040', 1.4);
        break;
      }
      case 'blast': {
        const { x, y } = G.Aim.at(1.5, G.Aim.lead(e, 0.6));
        G.Tele.add({ tag: s.name, x, y, r: s.r, max: 1.5, color: s.color || glow, onBoom: k => {
          if (playerIn(k.x, k.y, s.r + p.r)) { G.hurtPlayer(s.dmg * dm); if (s.root) { p.rootT = s.root; G.fx.text(p.x, p.y - 50, s.name + '!', '#d090ff', 20, true); } }
          G.fx.ring(k.x, k.y, 10, s.r, 0.4, s.color || glow, 8, 0.3); G.Audio.play('shadow');
        } });
        this.cast(e, s.name, 1.5, null);
        break;
      }
      case 'summon':
        this.summon(e, s.id, s.n, 160);
        G.UI.warn(`${e.def.name}: ${s.name}!`, '#7fff7f', 1.8);
        break;
      case 'charge':
        G.Tele.add({ x: p.x, y: p.y, r: 50, max: 0.7, color: glow });
        this.cast(e, s.name, 0.7, () => { e.ai.charge = { x: p.x, y: p.y, t: 0, dmg: s.dmg * dm }; G.Audio.play('boss'); });
        break;
      case 'teleport': {
        const a = Math.random() * Math.PI * 2, R = U.rand(220, 320);
        G.fx.burst(e.x, e.y, 24, { rgb: glow, sp: 180, size: 12 });
        e.x = p.x + Math.cos(a) * R; e.y = p.y + Math.sin(a) * R;
        G.fx.burst(e.x, e.y, 24, { rgb: glow, sp: 180, size: 12 }); G.Audio.play('orb');
        break;
      }
      case 'portal': { // 간들링: 플레이어를 다른 곳으로 보내고 해골을 붙인다
        G.Tele.add({ x: p.x, y: p.y, r: 40, max: 1.2, color: '60,200,90', onBoom: () => {
          const a = Math.random() * Math.PI * 2, R = U.rand(320, 480);
          G.fx.burst(p.x, p.y, 20, { rgb: '60,220,100', sp: 160, size: 12 });
          p.x += Math.cos(a) * R; p.y += Math.sin(a) * R;
          for (let i = 0; i < 4; i++) { const b = i / 4 * Math.PI * 2; G.Enemy.spawn('skeleton', p.x + Math.cos(b) * 130, p.y + Math.sin(b) * 130); }
          G.UI.warn('어둠의 차원문에 빨려 들어갑니다!', '#7fff7f', 2);
        } });
        break;
      }
    }
  },
};
