'use strict';
// ================= 게임 루프 =================
const KEYMAP = { KeyQ: 'Q', KeyE: 'E', KeyR: 'R', KeyF: 'F', KeyT: 'T', Space: 'SPACE', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6' };

G.timeScale = Math.max(1, Math.min(20, +(G.params.get('ts') || 1)));
G.stats = { kills: 0, gold: 0, banked: 0 };
G.chests = [];

G.init = async () => {
  await G.loadAssets();
  G.Spr.build();
  G.Meta.load();
  await G.Net.init();
  G.UI.init();
  G.R.init();
  G.Input();
  G.cam.x = 0; G.cam.y = 0;
  G.UI.showMenu();
  if (G.params.get('test')) { G.Bot.on = true; G.startRun(); }
  if (G.params.get('sim')) G.simulate(+G.params.get('sim'));
  let last = performance.now();
  const frame = now => {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);
    try {
      if (G.state === 'play' && !G.paused && !G.simulating) { for (let i = 0; i < G.timeScale; i++) G.update(dt); }
      else if (G.state === 'menu') { G.cam.x += dt * 25; G.cam.y += dt * 8; }
      G.R.draw(dt);
      G.UI.update(dt);
    } catch (err) {
      // 한 프레임의 오류로 게임 전체가 멈추지 않도록
      console.error(err);
      if (!G.errShown) { G.errShown = true; const el = document.getElementById('errlog'); if (el) el.textContent += 'ERR ' + err.message + '\n'; }
    }
  };
  requestAnimationFrame(frame);
};

G.Input = () => {
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return; // 입력창 타이핑은 게임 키로 쓰지 않음
    G.Audio.init();
    if (e.code === 'Tab') { e.preventDefault(); if (G.state === 'play') G.UI.toggleMeter(); return; }
    if (e.code === 'KeyM') { G.Audio.toggle(); return; }
    if (e.code === 'Escape') {
      if (G.state !== 'play') return;
      if (G.UI.modalKind === 'pause') G.resume();
      else if (G.UI.modalKind === 'help') G.UI.showPause();
      else if (!G.UI.modalKind) G.pause();
      return;
    }
    if (G.UI.modalKind === 'levelup') {
      const m = e.code.match(/^(?:Digit|Numpad)(\d)$/);
      if (m) { const i = +m[1] - 1; if (i >= 0 && i < G.UI.lvOpts.length) G.pickUpgrade(i); }
      return;
    }
    if (e.code === 'Space') e.preventDefault();
    G.keys[e.code] = true;
    const k = KEYMAP[e.code];
    if (k && !e.repeat && G.state === 'play' && !G.paused) { const id = G.UI.skillForKey(k); if (id) G.Skills.activate(id); }
  });
  addEventListener('keyup', e => { G.keys[e.code] = false; });
  addEventListener('blur', () => { G.keys = {}; if (G.state === 'play' && !G.paused && !G.Bot.on) G.pause(); });
  addEventListener('mousemove', e => { G.mouse.sx = e.clientX; G.mouse.sy = e.clientY; });
  addEventListener('mousedown', () => G.Audio.init());
};

G.startRun = () => {
  Object.assign(G, { t: 0, enemies: [], projs: [], eprojs: [], zones: [], tele: [], pickups: [], parts: [], texts: [], rings: [], pets: [], images: [], delayed: [], chests: [] });
  G.stats = { kills: 0, gold: 0, banked: 0 };
  G.state = 'play'; G.paused = false;
  G.player = G.P.create();
  G.meter.reset(); G.Waves.reset();
  G.P.recalc();
  G.P.learn('frostbolt');
  if (G.params.get('all')) for (const id in G.SKILLS) { const k = G.SKILLS[id].kind; if ((k === 'auto' || k === 'active') && !G.player.skills[id]) G.P.learn(id); }
  if (G.params.get('t')) G.t = +G.params.get('t');
  G.cam.x = 0; G.cam.y = 0;
  G.UI.close();
  G.UI.el.hud.classList.remove('hidden');
  G.UI.buffSig = null; G.UI.bfTgt = null;
};

G.pause = () => { G.paused = true; G.UI.showPause(); };
G.resume = () => { G.UI.close(); G.paused = false; G.checkModals(); };

G.update = dt => {
  const p = G.player;
  G.t += dt;
  G.mouse.x = G.cam.x + (G.mouse.sx - G.W / 2);
  G.mouse.y = G.cam.y + (G.mouse.sy - G.H / 2);
  if (G.Bot.on) G.Bot.update(dt);
  G.P.update(dt);
  G.Enemy.update(dt);
  G.Skills.update(dt);
  G.Pets.update(dt);
  G.Waves.update(dt);
  G.Proj.update(dt);
  G.EProj.update(dt);
  G.Zones.update(dt);
  G.Tele.update(dt);
  // 지연 실행
  if (G.delayed.length) {
    const due = [];
    for (const d of G.delayed) { d.t -= dt; if (d.t <= 0) due.push(d); }
    if (due.length) { G.delayed = G.delayed.filter(d => d.t > 0); for (const d of due) d.fn(); }
  }
  G.updatePickups(dt);
  G.R.fxUpdate(dt);
  // 카메라
  const k = Math.min(1, dt * 8);
  G.cam.x += (p.x - G.cam.x) * k; G.cam.y += (p.y - G.cam.y) * k;
  G.cam.shake = Math.max(0, G.cam.shake - dt * 40);
  G.checkModals();
};

G.updatePickups = dt => {
  const p = G.player, R = p.stats.pickup;
  for (const k of G.pickups) {
    k.t += dt;
    const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
    if (!k.mag && !p.dead && d < (k.kind === 'xp' || k.kind === 'gold' ? R : 46)) k.mag = true;
    if (k.mag) {
      k.ms = (k.ms || 150) + dt * 900;
      k.x += dx / d * k.ms * dt; k.y += dy / d * k.ms * dt;
      if (d < 18) {
        k.done = true;
        if (k.kind === 'xp') { G.P.gainXp(k.v); G.Audio.play('xp'); }
        else if (k.kind === 'gold') { G.stats.gold += k.v * (1 + G.Meta.rank('luck') * 0.1); G.Audio.play('gold'); }
        else if (k.kind === 'food') { G.P.heal(p.maxHp * 0.3); G.Audio.play('buff', 0.5); }
        else if (k.kind === 'magnet') { for (const o of G.pickups) if (o.kind === 'xp') o.mag = true; G.Audio.play('orb'); }
        else if (k.kind === 'chest') { G.chests.push(k.v); G.Audio.play('chest'); }
      }
    }
  }
  G.pickups = G.pickups.filter(k => !k.done);
};

// ---------- 레벨업 / 상자 ----------
G.checkModals = () => {
  const p = G.player;
  if (G.state !== 'play' || G.UI.modalKind || p.dead) return;
  if (p.pendingLv > 0) {
    G.paused = true; G.lvMode = 'level';
    G.UI.showLevelUp(G.Upg.gen(3), '레벨 업!', `${p.level - p.pendingLv + 1}레벨 달성 · 배울 주문을 선택하세요 (1 / 2 / 3)`);
  } else if (G.chests.length) {
    G.paused = true; G.lvMode = 'chest';
    const v = G.chests[0];
    G.UI.showLevelUp(G.Upg.gen(v >= 2 ? 4 : 3, v), v >= 2 ? '보스 전리품' : '전리품 상자', '보상을 하나 선택하세요');
  }
  if (G.Bot.sync && G.UI.modalKind === 'levelup') G.pickUpgrade(G.Bot.pick());
  else if (G.Bot.on && G.UI.modalKind === 'levelup') setTimeout(() => G.UI.modalKind === 'levelup' && G.pickUpgrade(G.Bot.pick()), 30);
};
G.pickUpgrade = i => {
  const p = G.player;
  if (i < 0) G.stats.gold += 10;
  else G.Upg.apply(G.UI.lvOpts[i]);
  if (G.lvMode === 'chest') G.chests.shift(); else p.pendingLv--;
  G.UI.close(); G.paused = false;
  G.checkModals();
};
G.rerollUpgrade = () => {
  const p = G.player; if (p.rerolls <= 0) return;
  p.rerolls--; G.UI.close();
  G.checkModals();
};

// ---------- 사망 / 종료 ----------
G.playerDeath = () => {
  const p = G.player;
  if (p.revives > 0) {
    p.revives--; p.hp = p.maxHp * 0.5;
    G.aoe(p.x, p.y, 260, 50, 'frostnova', {}, e => G.freeze(e, 4));
    G.fx.ring(p.x, p.y, 10, 260, 0.6, '200,120,255', 8, 0.3);
    G.fx.text(p.x, p.y - 60, '영혼석 사용!', '#c87bff', 24, true);
    G.Audio.play('buff');
    return;
  }
  p.dead = true; p.hp = 0;
  G.fx.shards(p.x, p.y, 30, 200);
  G.Audio.play('death');
  G.later(1.6, () => G.endRun(false));
};
G.endRun = victory => {
  if (G.state !== 'play') return;
  const m = G.Meta.data;
  const gain = Math.floor(G.stats.gold - G.stats.banked + (G.stats.banked ? 0 : G.t / 6) + (victory ? 500 : 0));
  G.stats.banked = G.stats.gold;
  m.gold += gain; m.best = Math.max(m.best, G.t); if (victory) m.wins++;
  G.Meta.save();
  G.state = 'over'; G.paused = true;
  if (victory) G.Audio.play('victory');
  G.UI.showEnd(victory, gain);
};

// ================= 자동 플레이 봇 (테스트용 ?test=1) =================
G.Bot = {
  on: false, actT: 0,
  dir() {
    // 16방향 중 적 밀도가 가장 낮은 방향으로 이동 (관성 포함)
    const p = G.player, N = 16;
    let best = 0, bs = Infinity;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
      let sc = 0;
      for (const e of G.enemies) {
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d > 360) continue;
        const dot = (dx * cx + dy * cy) / (d || 1);
        if (dot > 0.3) sc += (e.boss ? 8 : 1) * (dot) * (400 - d) / 400 * (d < 80 ? 3 : 1);
      }
      for (const z of G.zones) if ((z.kind === 'defile' || z.kind === 'poison') && U.d2(p.x + cx * 80, p.y + cy * 80, z.x, z.y) < (z.r + 30) ** 2) sc += 30;
      for (const k of G.tele) if (U.d2(p.x + cx * 80, p.y + cy * 80, k.x, k.y) < (k.r + 30) ** 2) sc += 30;
      for (const k of G.pickups) {
        const dx = k.x - p.x, dy = k.y - p.y, d = Math.hypot(dx, dy);
        if (d > 450 || d < 1) continue;
        if ((dx * cx + dy * cy) / d > 0.6) sc -= (k.kind === 'chest' ? 25 : Math.min(3, k.v) * 0.9) * (450 - d) / 450;
      }
      sc += Math.abs(U.angDiff(a, this.lastA ?? a)) * 1.2;
      if (sc < bs) { bs = sc; best = a; }
    }
    this.lastA = best;
    return [Math.cos(best), Math.sin(best)];
  },
  update(dt) {
    const p = G.player, e = G.densestPoint(p.x, p.y, 500, 120) || G.nearestEnemy(p.x, p.y);
    if (e) { G.mouse.sx = G.W / 2 + (e.x - G.cam.x); G.mouse.sy = G.H / 2 + (e.y - G.cam.y); }
    this.actT -= dt; if (this.actT > 0) return; this.actT = 0.3;
    for (const id of p.order) {
      const def = G.SKILLS[id]; if (def.kind !== 'active') continue;
      if (id === 'iceblock' && (p.hp > p.maxHp * 0.25 || p.iceblockT > 0)) continue;
      if (id === 'coldsnap' && p.hp > p.maxHp * 0.5) continue;
      if (id === 'blink' && p.hp > p.maxHp * 0.6) continue;
      const sk = p.skills[id], impl = G.SKILL_IMPL[id];
      if (sk.charges > 0 && (!impl.usable || impl.usable(sk)) && !(p.channel && p.channel.id === id)) G.Skills.activate(id);
    }
  },
  pick() {
    // 사람처럼: 진화 > 전설 > 얼음화살 핵심 강화 > 공격 주문 > 피해 강화 > 능력치 > 기타
    const p = G.player, o = G.UI.lvOpts;
    const score = x => {
      if (x.type === 'evolution') return 100;
      if (x.type === 'legendary') return 80;
      if (x.type === 'node' && x.id === 'frostbolt' && (x.nodeId === 'count' || x.nodeId === 'cast')) return 60;
      if (x.type === 'new' && G.SKILLS[x.id].kind === 'auto') return p.order.length < 6 ? 55 : 20;
      if (x.type === 'node' && x.nodeId === 'dmg') return 45;
      if (x.type === 'passive' && ['arcaneint', 'haste', 'crit', 'projectile', 'fingersoffrost', 'brainfreeze'].includes(x.id)) return 40 + x.rarity * 5;
      if (x.type === 'new' && ['frozenorb', 'frostnova', 'coneofcold', 'glacialspike', 'icebarrier'].includes(x.id)) return 35;
      if (x.type === 'node') return 30;
      if (x.type === 'passive') return 25 + x.rarity * 5;
      return 10;
    };
    let bi = 0, bs = -1; o.forEach((x, i) => { const s = score(x) + Math.random() * 12; if (s > bs) { bs = s; bi = i; } });
    return bi;
  },
};

// 빠른 시뮬레이션 (?sim=초): 봇으로 지정 시간까지 즉시 진행 후 결과 출력
G.simulate = secs => {
  G.Bot.on = true; G.Bot.sync = true; G.startRun(); G.simulating = true;
  const log = [];
  const dt = 1 / 30;
  const el = document.getElementById('errlog');
  const step = () => {
    const t0 = performance.now();
    let n = 0;
    while (G.t < secs && G.state === 'play' && n++ < 300) {
      G.update(dt);
    if (Math.floor(G.t) % 30 === 0 && Math.floor(G.t - dt) % 30 !== 0) {
      const p = G.player;
      log.push(`t=${Math.floor(G.t)} lv=${p.level} hp=${Math.round(p.hp)}/${p.maxHp} enemies=${G.enemies.length} kills=${G.stats.kills} dps=${Math.round(G.meter.total / G.t)} boss=${G.Waves.boss ? G.Waves.boss.id + ':' + Math.round(G.Waves.boss.hp) : '-'}`);
    }
    }
    el.dataset.prog = `t=${G.t.toFixed(1)} ms=${(performance.now() - t0).toFixed(0)} projs=${G.projs.length} parts=${G.parts.length} zones=${G.zones.length} delayed=${G.delayed.length} enemies=${G.enemies.length} pick=${G.pickups.length} texts=${G.texts.length}`;
    if (G.t < secs && G.state === 'play') { setTimeout(step, 0); return; }
    finish();
  };
  const finish = () => {
  G.Bot.sync = false; G.simulating = false;
  const p = G.player;
  log.push('END t=' + G.t.toFixed(0) + ' state=' + G.state + ' dead=' + p.dead + ' skills=' + p.order.map(id => id + p.skillLevel(id)).join(',') + ' passives=' + Object.keys(p.passives).join(',') + ' legend=' + Object.keys(p.legend).concat(Object.keys(p.evo)).join(','));
  log.push('lastHits=' + (G.dmgLog || []).map(x => x.join(':')).join(' '));
  log.push('meter=' + Object.entries(G.meter.d).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + Math.round(v)).join(','));
  document.getElementById('errlog').textContent += log.join('\n') + '\n';
  G.paused = !!G.params.get('freeze');
  if (G.params.get('lv')) { G.Bot.on = false; G.player.pendingLv = 1; G.checkModals(); }
  };
  step();
};

G.init();
