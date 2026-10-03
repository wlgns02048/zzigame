'use strict';
// ================= 게임 루프 =================
const KEYMAP = { KeyQ: 'Q', KeyE: 'E', KeyR: 'R', KeyF: 'F', KeyT: 'T', Space: 'SPACE', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6' };

G.timeScale = Math.max(1, Math.min(20, +(G.params.get('ts') || 1)));
G.stats = { kills: 0, gold: 0, banked: 0, lust: 0 };
// 피의 욕망 (드문 전리품): 실제 시간 dur초 동안 게임 전체가 speed배로 흐른다. stats.lust = 그 덕에 더 흐른 게임 시간 (서버 시계 검증용)
G.LUST = { speed: 1.5, dur: 40 };
G.lustT = 0;
G.chests = [];

G.init = async () => {
  await G.loadAssets();
  G.Spr.build();
  await G.Net.init();
  // 밸런스 시뮬레이터 전용 가상 장비 · 특성 (?gear=아이템레벨&talents=1)
  if (G.params.get('gear') || G.params.get('talents')) G.Meta.useSimLoadout(+G.params.get('gear') || 0, !!G.params.get('talents'));
  G.UI.init();
  G.Chat.init();
  G.R.init();
  G.Input();
  G.cam.x = 0; G.cam.y = 0;
  G.UI.showMenu();
  G.Update.start();
  G.Music.start();
  if (G.params.get('test')) { G.Bot.on = true; G.startRun(); }
  if (G.params.get('sim')) G.simulate(+G.params.get('sim'));
  let last = performance.now();
  const frame = now => {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = Math.max(last, now);
    try {
      if (G.state === 'play' && !G.paused && !G.simulating) {
        // 히트스톱 동안은 게임을 진행하지 않고, 슬로모션 동안은 느리게 진행한다 (둘 다 실제 시간 기준)
        if (G.stopT > 0) G.stopT -= dt;
        else {
          const gdt = G.slowT > 0 ? dt * G.slowK : dt;
          for (let i = 0; i < G.timeScale; i++) {
            G.update(gdt);
            // 피의 욕망: 남는 배속만큼 한 번 더 진행 (한 번에 큰 dt로 돌리면 빠른 투사체가 적을 뚫고 지나갈 수 있어서)
            if (G.lustT > 0 && G.state === 'play' && !G.paused) { const x = gdt * (G.LUST.speed - 1); G.update(x); G.stats.lust += x; }
          }
        }
        G.slowT = Math.max(0, G.slowT - dt);
        G.lustT = Math.max(0, G.lustT - dt);
      }
      else if (G.state === 'menu') { G.cam.x += dt * 25; G.cam.y += dt * 8; }
      if (!G.simulating) G.R.draw(dt);
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
    if (e.code === 'KeyN') { G.Music.toggle(); return; }
    if (e.code === 'Escape') {
      if (G.state !== 'play') return;
      if (G.UI.modalKind === 'pause') G.resume();
      else if (G.UI.modalKind === 'help' || G.UI.modalKind === 'settings') G.UI.showPause();
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
  addEventListener('blur', () => { G.keys = {}; G.mouse.moveHeld = false; if (G.state === 'play' && !G.paused && !G.Bot.on) G.pause(); });
  addEventListener('mousemove', e => { [G.mouse.sx, G.mouse.sy] = G.R.toView(e.clientX, e.clientY); });
  addEventListener('mousedown', () => G.Audio.init());
  // 마우스 이동: 화면을 오른쪽 클릭하면 그 지점까지 걷고, 누르고 있으면 커서를 계속 따라간다 (이동 키를 누르면 취소)
  const cv = document.getElementById('cv');
  const mouseWorld = () => ({ x: G.cam.x + (G.mouse.sx - G.W / 2), y: G.cam.y + (G.mouse.sy - G.H / 2) });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // 오른쪽 버튼으로 걷다가 레벨업 · 상자 창이 커서 아래에 뜨면 버튼을 뗄 때 브라우저 메뉴가 열리므로, 판 중에는 어디서든 막는다 (입력창 제외)
  addEventListener('contextmenu', e => { if (G.state === 'play' && !(e.target.closest && e.target.closest('input, textarea'))) e.preventDefault(); });
  cv.addEventListener('mousedown', e => {
    if (e.button !== 2 || G.state !== 'play' || G.paused) return;
    [G.mouse.sx, G.mouse.sy] = G.R.toView(e.clientX, e.clientY);
    G.mouse.moveHeld = true; G.moveTo = mouseWorld();
  });
  addEventListener('mouseup', e => {
    if (e.button !== 2 || !G.mouse.moveHeld) return;
    G.mouse.moveHeld = false;
    if (G.state !== 'play' || G.paused) return;
    G.moveTo = mouseWorld(); // 손을 뗀 곳까지 마저 걷는다
    G.fx.ring(G.moveTo.x, G.moveTo.y, 22, 4, 0.35, '120,255,140', 3);
  });
};

// 판 시작. 기본값은 로비 선택 → URL 파라미터(?cls=&stage=&diff=, 시뮬레이션용) → 얼음왕관
G.startRun = (cls, stage, diff) => {
  if (G.Update.apply()) return; // 새 버전이 나왔으면 옛 코드로 출정하지 않고 새로고침
  cls ||= G.selectedClass || G.params.get('cls') || 'mage';
  stage ||= G.selectedStage || G.params.get('stage') || 'icecrown';
  diff ||= G.selectedDiff || G.params.get('diff') || 'normal';
  Object.assign(G, { t: 0, enemies: [], projs: [], eprojs: [], zones: [], tele: [], pickups: [], parts: [], texts: [], rings: [], pets: [], images: [], delayed: [], chests: [], corpses: [], decals: [],
    stopT: 0, stopCd: 0, stopLast: 0, slowT: 0, slowK: 1 });
  Object.assign(G.cam, { trauma: 0, kx: 0, ky: 0 });
  G.stats = { kills: 0, gold: 0, banked: 0, lust: 0 }; G.lustT = 0;
  G.Aim.reset();
  G.state = 'play'; G.paused = false;
  G.moveTo = null; G.mouse.moveHeld = false;
  G.player = G.P.create(cls);
  // 로그인 중이면 서버에 런 등록 (봇/시뮬레이션 제외)
  G.run = G.Meta.mode() === 'account' && !G.Bot.on ? G.Net.startRun(cls, stage, diff) : null;
  G.runInfo = { cls, stage, diff };
  G.meter.reset(); G.Waves.reset(stage, diff); G.Streak.reset(); G.Events.reset();
  G.P.recalc();
  G.P.learn(G.CLASSES[cls].starter);
  // 달라란 도서관: 준비된 주문서
  if (G.Meta.lib('scroll')) {
    const autos = Object.values(G.SKILLS).filter(d => d.cls === cls && d.kind === 'auto' && d.id !== G.CLASSES[cls].starter && !d.req);
    if (autos.length) G.P.learn(U.choice(autos).id);
  }
  // 직업 특성: 시작 보호막
  const tr = G.Meta.tree(G.Meta.specTree(cls)).ranks;
  if (tr.iceBarrier || tr.darkPact || tr.survivalInstincts) G.player.absorb = Math.round(G.player.maxHp * 0.3);
  if (G.params.get('all')) for (const id in G.SKILLS) { const d = G.SKILLS[id]; if (d.cls === cls && (d.kind === 'auto' || d.kind === 'active') && !G.player.skills[id]) G.P.learn(id); }
  if (G.params.get('t')) G.t = +G.params.get('t');
  G.cam.x = 0; G.cam.y = 0;
  G.UI.close();
  G.UI.el.hud.classList.remove('hidden');
  G.UI.buffSig = null; G.UI.bfTgt = null;
  // 플레이어 프레임: 직업 이름 · 초상화 · 자원 막대 색, 이전 판 경고 지우기
  const C = G.CLASSES[cls];
  document.querySelector('#playerFrame .portrait img').src = G.icon(C.icon);
  document.querySelector('#playerFrame .pfName').textContent = C.name;
  const bar = document.querySelector('#playerFrame .bar.mana');
  bar.classList.remove('shards', 'focus'); if (C.bar) bar.classList.add(C.bar);
  G.UI.el.raidWarn.classList.remove('show'); G.UI.warnT = 0;
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
  G.Events.update(dt);
  G.Proj.update(dt);
  G.EProj.update(dt);
  G.Zones.update(dt);
  G.Aim.track(dt);
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
        else if (k.kind === 'gold') { G.stats.gold += k.v * (1 + G.Meta.lib('luck') * 0.1) * G.Waves.goldMul; G.Audio.play('gold'); } // 스테이지 · 난이도 배율
        else if (k.kind === 'food') { G.P.heal(p.maxHp * 0.3); G.Audio.play('buff', 0.5); }
        else if (k.kind === 'magnet') { for (const o of G.pickups) o.mag = true; G.Audio.play('orb'); } // 경험치 · 골드 · 음식 · 상자 등 바닥의 모든 전리품
        else if (k.kind === 'bloodlust') { G.lustT = G.LUST.dur; G.fx.text(p.x, p.y - 44, '피의 욕망!', '#ff5040', 16); G.Audio.play('buff'); }
        else if (k.kind === 'chest') { G.chests.push(k.v); G.Audio.play('chest'); G.Audio.duck(0.5, 0.4); }
      }
    }
  }
  G.pickups = G.pickups.filter(k => !k.done);
};

// ---------- 레벨업 / 상자 ----------
G.checkModals = () => {
  const p = G.player;
  if (G.state !== 'play' || G.UI.modalKind || p.dead || p.lvAt > G.t) return;
  if (p.pendingLv > 0) {
    G.paused = true; G.lvMode = 'level';
    const n = 3 + (G.Meta.lib('wideVision') ? 1 : 0); // 달라란 도서관: 넓어진 시야
    G.UI.showLevelUp(G.Upg.gen(n), '레벨 업!', `${p.level - p.pendingLv + 1}레벨 달성 · 배울 주문을 선택하세요 (1 ~ ${n})`);
  } else if (G.chests.length) {
    G.paused = true; G.lvMode = 'chest';
    const v = G.chests[0], opts = G.Upg.gen((v >= 2 ? 4 : 3) + (G.Meta.lib('treasure') >= 2 ? 1 : 0), v);
    const show = () => G.UI.showLevelUp(opts, v >= 2 ? '보스 전리품' : '전리품 상자', '보상을 하나 선택하세요');
    if (G.Bot.on) show(); else G.UI.showChest(opts, v, show); // 상자는 릴이 돌다 멈춘 뒤 카드가 열린다
  }
  if (G.Bot.sync && G.UI.modalKind === 'levelup') G.pickUpgrade(G.Bot.pick());
  else if (G.Bot.on && G.UI.modalKind === 'levelup') setTimeout(() => G.UI.modalKind === 'levelup' && G.pickUpgrade(G.Bot.pick()), 30);
};
G.pickUpgrade = i => {
  const p = G.player;
  // 봉인 표시한 다른 선택지는 다음 선택까지 보관
  if (p.sealPick != null && p.sealPick !== i && G.UI.lvOpts[p.sealPick]) { const o = G.UI.lvOpts[p.sealPick]; p.sealed = { type: o.type, id: o.id, nodeId: o.nodeId }; }
  p.sealPick = null;
  if (i < 0) G.stats.gold += 10;
  else G.Upg.apply(G.UI.lvOpts[i]);
  if (G.lvMode === 'chest') G.chests.shift(); else p.pendingLv--;
  G.UI.close(); G.paused = false;
  G.checkModals();
};
// 달라란 도서관: 추방 — 이 선택지를 이번 판에서 영구 제외하고 다시 굴림 (굴리기 횟수 소모 없음)
G.banishUpgrade = i => {
  const p = G.player, o = G.UI.lvOpts[i]; if (!o || p.banishes <= 0) return;
  p.banishes--; p.banished.add(G.Upg.key(o)); p.sealPick = null; G.UI.noReel = true;
  G.UI.close(); G.checkModals();
};
G.rerollUpgrade = () => {
  const p = G.player; if (p.rerolls <= 0) return;
  p.rerolls--; G.UI.close(); G.UI.noReel = true;
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
  const mode = G.Meta.mode();
  G.state = 'over'; G.paused = true;
  if (victory) G.Audio.play('victory');
  G.UI.showEnd(victory, mode);
  // 보상은 서버가 계산한다. 클리어 직후(엔드리스 선택 전)는 중간 보고, 그 외는 최종 보고.
  const waitMsg = n => { const box = $('eRewards'); if (box) box.innerHTML = `<div class="dim">서버에 다시 연결하는 중… (${n})</div>`; };
  if (G.run) G.Net.reportRun(G.run, { victory, final: !victory || G.Waves.endless }, waitMsg).then(r => G.UI.setEndRewards(r)).catch(e => G.UI.setEndRewards(null, e.message));
  else if (mode === 'account') G.UI.setEndRewards(null, '이 판은 서버에 등록되지 않았습니다.');
};
// 클리어 후 "보상 받고 종료": 최종 보고만 하고 로비로
G.leaveRun = () => {
  // (Waves.clearT는 엔드리스를 시작할 때만 정해지므로 조건으로 쓰면 안 된다 — 이 버튼은 클리어 화면에만 있다)
  if (G.run && !G.Waves.endless) G.Net.reportRun(G.run, { victory: true, final: true }).catch(() => {});
  G.run = null; G.state = 'menu'; G.UI.showMenu();
};

// ================= 자동 플레이 봇 (테스트용 ?test=1) =================
G.Bot = {
  on: false, actT: 0,
  dir() {
    // 16방향 중 적 밀도가 가장 낮은 방향으로 이동 (관성 포함)
    // ?runner=line 한 방향으로 직진 · ?runner=circle 반경 350px 원을 그리며 카이팅 (바닥 기술 적중률 측정용)
    if (this.runner === 'line') return [1, 0];
    if (this.runner === 'circle') { const a = G.t * 0.5; return [Math.cos(a), Math.sin(a)]; }
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
      // ?runner=1: 바닥 경고 · 장판을 보지 않고 달리기만 하는 봇 (바닥 기술 적중률 측정용)
      if (!this.runner) {
        for (const z of G.zones) if ((z.hurt || z.kind === 'defile' || z.kind === 'poison') && U.d2(p.x + cx * 80, p.y + cy * 80, z.x, z.y) < (z.r + 30) ** 2) sc += 30;
        for (const k of G.tele) if (U.d2(p.x + cx * 80, p.y + cy * 80, k.x, k.y) < (k.r + 30) ** 2) sc += 30;
      }
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
      if (!G.cls(p).botUse(id, p)) continue;
      const sk = p.skills[id], impl = G.SKILL_IMPL[id];
      if (sk.autoCast) continue; // 자동 시전에 맡김
      if (sk.charges > 0 && (!impl.usable || impl.usable(sk)) && !(p.channel && p.channel.id === id)) G.Skills.activate(id);
    }
  },
  pick() {
    const p = G.player, o = G.UI.lvOpts, score = x => G.cls(p).botScore(x, p);
    let bi = 0, bs = -1; o.forEach((x, i) => { const s = score(x) + Math.random() * 12; if (s > bs) { bs = s; bi = i; } });
    return bi;
  },
};

// 빠른 시뮬레이션 (?sim=초): 봇으로 지정 시간까지 즉시 진행 후 결과 출력
G.simulate = secs => {
  G.Bot.on = true; G.Bot.sync = true; G.Bot.runner = G.params.get('runner'); G.startRun(); G.simulating = true;
  const log = [];
  const dt = 1 / 30;
  const el = document.getElementById('errlog');
  const step = () => {
    const t0 = performance.now();
    let n = 0;
    while (G.t < secs && G.state === 'play' && n++ < 300) {
      // 시뮬레이션 중 예외가 나면 멈춰서 기다리지 말고 로그에 남기고 끝낸다
      try { G.update(dt); } catch (err) { el.textContent += `ERR ${err.message}\n`; G.state = 'over'; break; }
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
