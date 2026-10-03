'use strict';
// ================= 필드 이벤트 =================
// 판 도중 가끔 나타나는 선택형 목표. 모든 주기는 웨이브와 같은 900초 척도(Waves.k)로 압축되고, 보스가 살아 있으면 새로 생기지 않는다.
//  · 보물 코볼트: 플레이어에게서 도망치는 적 (멀면 느릿느릿, 가까우면 내 속도의 70% + 가끔 숨 고르기, 맞으면 잠깐 내달림 — js/enemies.js). 놓치면 40초 뒤 사라지고, 잡으면 골드를 쏟는다
//  · 성소: 밟으면 30초 강화 (광란 · 신속 · 보호 · 지혜)
//  · 저주받은 상자: 열면 정예 셋이 나타나고, 모두 쓰러뜨리면 보스 전리품 상자
G.SHRINES = {
  power: { name: '광란의 성소', icon: 'crit', color: '255,90,60', desc: '주문력 +25%', apply: st => { st.dmg *= 1.25; } },
  speed: { name: '신속의 성소', icon: 'speed', color: '120,220,255', desc: '이동 속도 +30% · 가속 +15%', apply: st => { st.speedMul *= 1.3; st.haste += 0.15; } },
  guard: { name: '보호의 성소', icon: 'stamina', color: '255,215,90', desc: '최대 생명력 40% 보호막 · 생명력 30% 회복', instant: p => { p.absorb = Math.max(p.absorb, p.maxHp * 0.4); G.P.heal(p.maxHp * 0.3); } },
  wisdom: { name: '지혜의 성소', icon: 'xp', color: '130,255,140', desc: '경험치 획득 +50%', apply: st => { st.xpMul *= 1.5; } },
};

G.Events = {
  BUFF_DUR: 30,
  reset() {
    const k = G.Waves.k;
    this.list = []; this.buff = null;
    this.goblinT = U.rand(110, 150) / k; this.shrineT = U.rand(70, 100) / k; this.cursedT = U.rand(200, 240) / k;
  },

  update(dt) {
    const p = G.player, k = G.Waves.k, bossAlive = G.Waves.boss && !G.Waves.boss.dead;
    if (!bossAlive) {
      if ((this.goblinT -= dt) <= 0) { this.goblinT = U.rand(150, 210) / k; this.spawnGoblin(); }
      if ((this.shrineT -= dt) <= 0) { this.shrineT = U.rand(110, 150) / k; this.spawnObject('shrine', U.choice(Object.keys(G.SHRINES)), 45); }
      if ((this.cursedT -= dt) <= 0) { this.cursedT = U.rand(220, 280) / k; this.spawnObject('cursed', null, 45); }
    }
    for (const o of this.list) {
      o.t += dt;
      if (o.kind === 'goblin') {
        const e = o.e;
        if (e.dead) { o.done = true; continue; }
        if (Math.random() < dt * 8) G.fx.part({ x: e.x + U.rand(-10, 10), y: e.y - U.rand(5, 25), vy: -40, life: 0.6, size: U.rand(5, 9), rgb: '255,215,80' });
        if (o.t >= o.life) { // 포털을 열고 달아남
          e.dead = true; o.done = true;
          G.fx.ring(e.x, e.y, 5, 60, 0.5, '180,120,255', 5, 0.3); G.fx.burst(e.x, e.y, 20, { rgb: '180,120,255', sp: 150, size: 10 });
          G.UI.warn('보물 코볼트가 달아났습니다...', '#c8a0ff', 2); G.Audio.play('blink', 0.6, e.x);
        }
        continue;
      }
      if (o.kind === 'cursedFight') { // 저주받은 상자의 정예를 모두 쓰러뜨리면 보상
        if (o.elites.every(e => e.dead)) {
          o.done = true;
          G.dropPickup('chest', o.x, o.y, 2); // 보스 전리품 (전설 · 진화 한 칸 보장)
          for (let i = 0; i < 6; i++) G.dropPickup('gold', o.x + U.rand(-50, 50), o.y + U.rand(-50, 50), U.randi(3, 6));
          G.UI.warn('저주를 풀었습니다! 전리품이 떨어졌습니다', '#ffd100', 2.5); G.Audio.play('victory', 0.7);
          G.fx.wave(o.x, o.y, 200, '255,215,90', 0.5);
        }
        continue;
      }
      // 바닥 물체 (성소 · 저주받은 상자): 시간이 다 되면 사라지고, 밟으면 발동
      if (o.t >= o.life) { o.done = true; G.fx.burst(o.x, o.y - 20, 14, { rgb: o.color, sp: 90, size: 9 }); continue; }
      if (!p.dead && U.d2(p.x, p.y, o.x, o.y) < 44 * 44) { o.done = true; this.trigger(o); }
    }
    this.list = this.list.filter(o => !o.done);
    if (this.buff && (this.buff.t -= dt) <= 0) { this.buff = null; G.P.recalc(); }
  },

  // 화면 밖 가까운 곳 (방향 표시로 찾아가게)
  spot(min, max) {
    const p = G.player, a = Math.random() * Math.PI * 2, d = U.rand(min, max);
    return [p.x + Math.cos(a) * d, p.y + Math.sin(a) * d];
  },

  spawnGoblin() {
    const [x, y] = this.spot(560, 680); // 화면 가장자리 바로 밖 — 화살표 방향으로 몇 걸음이면 보인다
    const e = G.Enemy.spawn('kobold', x, y);
    e.def = Object.assign({}, e.def, { name: '보물 코볼트' });
    e.goblin = true; e.flee = true; e.xp = 0;
    e.maxHp = e.hp = Math.round(G.ENEMIES.kobold.hp * G.Waves.hpMul() * 26);
    e.speed = 190; e.r *= 1.2; e.scale *= 1.25;
    this.list.push({ kind: 'goblin', e, t: 0, life: 40 });
    G.UI.warn('보물 코볼트가 나타났습니다! 달아나기 전에 잡으세요', '#ffd100', 3); G.Audio.play('goblin', 1, x);
  },

  // 보물 코볼트가 맞으면: 0.7초 동안 내 이동 속도의 125%로 내달린다 (숨 고르기도 끊음). 1.6초 재사용 대기 — 계속 때려도 평균은 나보다 느리다
  goblinHit(e) {
    if (e.dashCd > 0) return;
    e.dashT = 0.7; e.dashCd = 2.3; e.restT = 0;
    G.fx.burst(e.x, e.y - 8, 10, { rgb: '255,235,150', sp: 140, size: 8, life: 0.4 });
    G.fx.text(e.x, e.y - 50, '후다닥!', '#ffe070', 13);
  },

  spawnObject(kind, type, life) {
    const [x, y] = this.spot(380, 620);
    const o = { kind, type, x, y, t: 0, life, color: kind === 'shrine' ? G.SHRINES[type].color : '170,60,255' };
    this.list.push(o);
    G.UI.warn(kind === 'shrine' ? `${G.SHRINES[type].name}가 나타났습니다` : '저주받은 상자가 나타났습니다', kind === 'shrine' ? `rgb(${o.color})` : '#c070ff', 2);
    G.Audio.play('shrine', 0.6, x);
  },

  trigger(o) {
    const p = G.player;
    if (o.kind === 'shrine') {
      const S = G.SHRINES[o.type];
      if (S.instant) S.instant(p);
      if (S.apply) { this.buff = { type: o.type, t: this.BUFF_DUR }; G.P.recalc(); }
      G.fx.text(p.x, p.y - 60, S.name, `rgb(${S.color})`, 20, true);
      G.fx.wave(o.x, o.y, 180, S.color, 0.5); G.fx.burst(o.x, o.y - 20, 40, { rgb: S.color, sp: 220, size: 12, life: 0.9 });
      G.Audio.play('buff'); G.Audio.play('shrine', 1, o.x);
      return;
    }
    // 저주받은 상자: 정예 셋 (접두어 포함)
    const tt = G.Waves.tt(), pool = G.Waves.roster.filter(d => !G.ENEMIES[d.id].ranged && tt >= d.t0);
    const elites = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + Math.random(), R = 300;
      elites.push(G.Enemy.spawn(U.choice(pool).id, o.x + Math.cos(a) * R, o.y + Math.sin(a) * R, { elite: true }));
    }
    this.list.push({ kind: 'cursedFight', x: o.x, y: o.y, t: 0, elites });
    G.fx.wave(o.x, o.y, 220, '170,60,255', 0.5); G.fx.shake(8);
    G.UI.warn('저주가 풀려났습니다! 정예 셋을 모두 쓰러뜨리세요', '#c070ff', 3); G.Audio.play('boss', 0.6); G.Audio.duck(0.4, 0.8);
  },

  // 성소 강화 (G.P.recalc에서 호출)
  applyBuff(st) { if (this.buff) G.SHRINES[this.buff.type].apply(st); },

  // 적이 죽을 때: 보물 코볼트 전리품 · 정예 접두어(폭발 · 분열)
  onKill(e) {
    if (e.goblin) {
      for (let i = 0; i < 16; i++) G.dropPickup('gold', e.x + U.rand(-60, 60), e.y + U.rand(-60, 60), U.randi(3, 6));
      if (Math.random() < 0.5) G.dropPickup('chest', e.x, e.y, 1);
      G.fx.burst(e.x, e.y, 40, { rgb: '255,215,80', sp: 260, size: 12, life: 0.9 });
      G.UI.warn('보물 코볼트 처치!', '#ffd100', 2); G.Audio.play('chest', 1, e.x);
      return;
    }
    if (!e.affixes) return;
    if (e.affixes.includes('volatile')) {
      const x = e.x, y = e.y, dmg = e.dmg * 1.6;
      G.Tele.add({ tag: '폭발', x, y, r: 110, max: 1.2, color: '255,140,30', onBoom: k => {
        if (U.d2(k.x, k.y, G.player.x, G.player.y) < (110 + G.player.r) ** 2) G.hurtPlayer(dmg);
        G.fx.wave(k.x, k.y, 130, '255,150,40'); G.fx.burst(k.x, k.y, 30, { rgb: '255,140,30', sp: 260, size: 13 }); G.fx.shake(6); G.Audio.play('explode', 0.8, k.x);
      } });
    }
    if (e.affixes.includes('splitting')) {
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; G.Enemy.spawn(e.id, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30); }
      G.fx.burst(e.x, e.y, 20, { rgb: '120,235,90', sp: 160, size: 10 });
    }
  },

  // ---------- 그리기 ----------
  draw(c) {
    for (const o of this.list) {
      if (o.kind !== 'shrine' && o.kind !== 'cursed') continue;
      const fade = Math.min(1, o.t * 3, (o.life - o.t) * 1.5), blink = o.life - o.t < 8 ? 0.6 + Math.sin(o.t * 12) * 0.4 : 1;
      c.globalAlpha = fade * blink;
      // 바닥 고리
      c.save(); c.translate(o.x, o.y); c.scale(1, 0.4);
      c.strokeStyle = `rgba(${o.color},0.8)`; c.lineWidth = 3; c.setLineDash([10, 8]); c.lineDashOffset = -o.t * 30;
      c.beginPath(); c.arc(0, 0, 44, 0, 7); c.stroke(); c.setLineDash([]); c.restore();
      c.globalCompositeOperation = 'lighter';
      c.drawImage(G.Spr.glow(o.color, 128), o.x - 60, o.y - 90, 120, 120);
      c.globalAlpha = fade * blink * 0.35; c.drawImage(G.Spr.glow(o.color, 64), o.x - 18, o.y - 260, 36, 260);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = fade * blink;
      const bob = Math.sin(o.t * 3) * 4;
      if (o.kind === 'shrine') {
        // 오벨리스크 + 떠 있는 수정
        c.fillStyle = '#2a2a34'; c.strokeStyle = '#000'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(o.x - 14, o.y); c.lineTo(o.x - 8, o.y - 46); c.lineTo(o.x + 8, o.y - 46); c.lineTo(o.x + 14, o.y); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = `rgb(${o.color})`;
        c.beginPath(); c.moveTo(o.x, o.y - 80 + bob); c.lineTo(o.x + 10, o.y - 64 + bob); c.lineTo(o.x, o.y - 48 + bob); c.lineTo(o.x - 10, o.y - 64 + bob); c.closePath(); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
      } else {
        // 보랏빛 사슬에 묶인 상자
        c.fillStyle = '#3a2410'; c.fillRect(o.x - 18, o.y - 26, 36, 24);
        c.fillStyle = '#5a3a18'; c.fillRect(o.x - 20, o.y - 34 + bob * 0.3, 40, 10);
        c.strokeStyle = 'rgba(200,120,255,0.95)'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(o.x - 20, o.y - 32); c.lineTo(o.x + 20, o.y - 4); c.moveTo(o.x + 20, o.y - 32); c.lineTo(o.x - 20, o.y - 4); c.stroke();
      }
      c.font = "700 13px 'Noto Sans KR',sans-serif"; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#000';
      const label = o.kind === 'shrine' ? G.SHRINES[o.type].name : '저주받은 상자';
      c.strokeText(label, o.x, o.y - 92 + bob); c.fillStyle = `rgb(${o.color})`; c.fillText(label, o.x, o.y - 92 + bob);
      c.textAlign = 'left'; c.globalAlpha = 1;
    }
  },
  // 이벤트 방향 표시 (화면 공간 — 유닛 · 어둠 조명 위에 그린다)
  //  · 화면 밖: 가장자리 화살표 (보물 코볼트는 더 크게 + 남은 초)
  //  · 화면 안의 보물 코볼트: 몬스터 무리에 묻히지 않게 머리 위 튀는 화살표 + 발밑에 퍼지는 고리
  drawArrows(c) {
    const cam = G.cam, W = G.W, H = G.H, now = performance.now();
    for (const o of this.list) {
      const goblin = o.kind === 'goblin', tgt = goblin ? o.e : (o.kind === 'shrine' || o.kind === 'cursed') ? o : null;
      if (!tgt) continue;
      const sx = tgt.x - cam.x + W / 2, sy = tgt.y - cam.y + H / 2;
      if (sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30) {
        if (goblin) this.drawGoblinMark(c, o.e, sx, sy, now);
        continue;
      }
      const a = Math.atan2(sy - H / 2, sx - W / 2), m = goblin ? 54 : 46;
      const s = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
      const x = W / 2 + Math.cos(a) * s, y = H / 2 + Math.sin(a) * s, col = goblin ? '255,215,80' : o.color;
      c.save(); c.translate(x, y); c.rotate(a);
      if (goblin) c.scale(1.5, 1.5);
      c.globalAlpha = 0.7 + Math.sin(now / 150) * 0.3;
      c.fillStyle = `rgb(${col})`; c.strokeStyle = '#000'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -11); c.lineTo(-3, 0); c.lineTo(-8, 11); c.closePath(); c.fill(); c.stroke();
      c.restore(); c.globalAlpha = 1;
      if (goblin) { // 화살표 안쪽에 남은 시간
        const tx = x - Math.cos(a) * 30, ty = y - Math.sin(a) * 30;
        c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const label = `${Math.max(0, Math.ceil(o.life - o.t))}초`;
        c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(label, tx, ty);
        c.fillStyle = '#ffe060'; c.fillText(label, tx, ty);
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      }
    }
  },
  drawGoblinMark(c, e, sx, sy, now) {
    // 발밑에서 퍼지는 고리 (두 겹, 엇갈려서)
    for (let i = 0; i < 2; i++) {
      const f = ((now / 900) + i * 0.5) % 1, r = e.r * 1.2 + f * 46;
      c.save(); c.translate(sx, sy + e.r * 0.8); c.scale(1, 0.42);
      c.globalAlpha = (1 - f) * 0.9; c.strokeStyle = '#ffd040'; c.lineWidth = 3;
      c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); c.restore();
    }
    // 이름표 위에서 아래를 가리키며 튀는 화살표
    const head = sy - e.r * 2.6 * e.scale / 1.2, bob = Math.abs(Math.sin(now / 160)) * 10, y = head - 34 - bob;
    c.globalAlpha = 1; c.fillStyle = '#ffd040'; c.strokeStyle = '#000'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(sx, y); c.lineTo(sx - 13, y - 15); c.lineTo(sx - 5, y - 15); c.lineTo(sx - 5, y - 27);
    c.lineTo(sx + 5, y - 27); c.lineTo(sx + 5, y - 15); c.lineTo(sx + 13, y - 15); c.closePath(); c.fill(); c.stroke();
  },
};
