'use strict';
// ================= 웨이브 감독 (스테이지 기반) =================
// 모든 성장 곡선은 기준 길이 900초 척도(tt)로 계산한다. 짧은 스테이지는 시간이 압축(k = 900/길이)되고,
// 경험치 흐름을 맞추려고 생성 속도에 k를 곱한다. 얼음왕관(900초)은 k = 1이라 원래 게임과 같다.
G.Waves = {
  reset(stageId = 'icecrown', diff = 'normal') {
    const SD = G.STAGE_DATA;
    this.stage = SD.STAGES[stageId]; this.diffId = diff; this.diff = SD.DIFFICULTY[diff];
    this.k = 900 / this.stage.duration;
    this.roster = this.stage.roster.map(([id, t0, w]) => ({ id, t0, w }));
    this.spawnAcc = 0; this.eliteT = 75 / this.k; this.bossIdx = 0; this.swarmIdx = 0; this.boss = null; this.warned = {};
    this.endless = false; this.clearT = null; this.level = 0; this.bossKills = 0; this.volcT = 6;
    this.affixes = G.run && G.run.affixes ? G.run.affixes : SD.weeklyAffixes(G.ITEMS.periodKeys().weekly);
    const tr = G.Meta.lib('treasure');
    this.eliteEvery = 65 * (1 - tr * 0.15) / this.k;
    this.goldMul = SD.goldMul(stageId, diff);
  },
  tt() { return G.t * this.k; },
  affix(a) { return this.endless && this.activeAffixes().includes(a); },
  activeAffixes() { return this.affixes.filter((a, i) => this.level >= G.STAGE_DATA.ENDLESS.slots[i].at); },
  endlessMul(per) { return 1 + per * this.level; },

  hpMul() {
    const t = this.tt(), E = G.STAGE_DATA.ENDLESS;
    let m = (1 + Math.pow(t / 300, 1.5) * 1.6) * this.stage.power.hp * this.diff.hp;
    if (this.endless) m *= this.endlessMul(E.hpPer) * (this.affix('fortified') ? 1.2 : 1);
    return m;
  },
  bossHpMul() {
    let m = this.stage.power.hp * this.diff.hp;
    if (this.endless) m *= this.endlessMul(G.STAGE_DATA.ENDLESS.hpPer) * (this.affix('tyrannical') ? 1.3 : 1);
    return m;
  },
  dmgMul() {
    let m = (1 + this.tt() / 700) * this.stage.power.dmg * this.diff.dmg;
    if (this.endless) m *= this.endlessMul(G.STAGE_DATA.ENDLESS.dmgPer);
    return m;
  },
  // 개체별 추가 공격력 (접두어)
  unitDmgMul(boss, elite) {
    if (!this.endless) return 1;
    if (boss || elite) return this.affix('tyrannical') ? 1.15 : 1;
    return this.affix('fortified') ? 1.3 : 1;
  },
  rate() { const t = this.tt(); return Math.min(15, 0.6 + t / 110 + Math.pow(t / 300, 2) * 2); },
  maxEnemies() { return 200 + Math.min(250, this.tt() / 3); },

  pickType() {
    const t = this.tt();
    const list = this.roster.filter(d => t >= d.t0);
    return U.wpick(list, d => d.w * (d === this.roster[0] ? Math.max(0.25, 1 - t / 600) : 1) * Math.min(1, (t - d.t0 + 20) / 60)).id;
  },
  ringPos(extra = 0) {
    const p = G.player, a = Math.random() * Math.PI * 2;
    const R = Math.hypot(G.W, G.H) / 2 + 40 + extra;
    return [p.x + Math.cos(a) * R, p.y + Math.sin(a) * R];
  },
  spawnBoss(id, warn) {
    const [x, y] = this.ringPos(-60);
    const e = G.Enemy.spawn(id, x, y);
    G.RunLog.bossSpawn(e);
    G.Audio.play('boss'); G.Audio.duck(0.3, 1.2); G.fx.shake(8); G.UI.bossIntro(e.def);
    if (warn) G.UI.warn(warn, '#ff6a1a', 3);
    return e;
  },

  update(dt) {
    const t = G.t, st = this.stage, D = st.duration;
    // 보스
    const bs = st.bosses[this.bossIdx];
    if (bs) {
      const at = bs.at * D;
      if (t >= at - 6 && !this.warned[bs.id]) { this.warned[bs.id] = true; G.UI.warn(bs.warn, '#ff6a1a', 5); G.Audio.play('warn'); }
      if (t >= at) {
        this.bossIdx++;
        this.boss = this.spawnBoss(bs.id);
        this.boss.final = this.bossIdx === st.bosses.length;
      }
    }
    // 무리 습격
    const sw = G.STAGE_DATA.SWARMS[this.swarmIdx];
    if (sw !== undefined && t >= sw * D) {
      this.swarmIdx++;
      const tt = this.tt(), opts = st.swarm[tt > 400 ? 1 : 0].split('|');
      const id = opts.length > 1 ? opts[Math.floor(Math.random() * opts.length)] : opts[0], n = 18 + Math.floor(tt / 25);
      const p = G.player, R = Math.max(G.W, G.H) * 0.55;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; G.Enemy.spawn(id, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
      G.UI.warn(`${G.ENEMIES[id].name} 무리가 포위합니다!`, '#ff6a1a', 2.5); G.Audio.play('warn');
    }
    // 정예
    this.eliteT -= dt;
    if (this.eliteT <= 0) {
      this.eliteT = this.eliteEvery;
      const [x, y] = this.ringPos();
      const tt = this.tt(), pool = this.roster.filter(d => !G.ENEMIES[d.id].ranged && tt >= d.t0);
      const el = G.Enemy.spawn(U.choice(pool).id, x, y, { elite: true });
      G.UI.warn(`정예 몬스터가 나타났습니다! (${el.affixes.map(a => G.ELITE_AFFIXES[a].name).join(' · ')})`, '#ffd100', 2);
    }
    // 엔드리스: 단계 · 주기 보스 · 화산
    if (this.endless) {
      const E = G.STAGE_DATA.ENDLESS, lv = Math.floor((t - this.clearT) / E.interval);
      if (lv > this.level) {
        this.level = lv;
        const newAff = this.affixes.find((a, i) => E.slots[i].at === lv);
        G.UI.warn(`엔드리스 ${lv}단계` + (newAff ? ` · 새 접두어: ${E.affixes[newAff].name}` : ''), '#ff9cff', 3);
        G.Audio.play('warn');
        if (lv % E.bossEvery === 0) {
          const b = U.choice(st.bosses);
          this.boss = this.spawnBoss(b.id, `${G.ENEMIES[b.id].name}이(가) 다시 나타났습니다!`);
        }
      }
      if (this.affix('volcanic') && (this.volcT -= dt) <= 0) {
        this.volcT = 7;
        const p = G.player;
        for (let i = 0; i < 2; i++) {
          const x = p.x + U.rand(-120, 120), y = p.y + U.rand(-120, 120);
          G.Tele.add({ x, y, r: 60, max: 1.4, color: '255,110,20', onBoom: k => { if (playerIn(k.x, k.y, 60 + p.r)) G.hurtPlayer(18); G.fx.burst(k.x, k.y, 20, { rgb: '255,120,30', sp: 220, size: 12 }); } });
        }
      }
    }
    // 일반 생성
    const bossAlive = this.boss && !this.boss.dead;
    this.spawnAcc += dt * this.rate() * this.k * (bossAlive ? 0.45 : 1);
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (G.enemies.length >= this.maxEnemies()) { this.spawnAcc = 0; break; }
      const [x, y] = this.ringPos();
      G.Enemy.spawn(this.pickType(), x, y);
    }
  },

  startEndless() {
    this.endless = true; this.clearT = G.t; this.level = 0;
    G.UI.warn('엔드리스 시작! 60초마다 단계가 오릅니다.', '#ff9cff', 3);
  },

  onKill(e) {
    if (!this.endless || e.boss) return;
    // 강화: 정예가 죽을 때만 (졸개마다 터지면 몹이 몰리는 이 게임에선 금방 전부 10중첩이 된다)
    if (this.affix('bolstering') && e.elite) {
      G.fx.ring(e.x, e.y, 10, 260, 0.5, '255,140,60', 6, 0.25);
      for (const o of G.Grid.query(e.x, e.y, 260)) {
        if (o === e || o.boss || o.dead || (o.bolster || 0) >= 10) continue;
        o.bolster = (o.bolster || 0) + 1; o.maxHp *= 1.1; o.hp *= 1.1; o.dmg *= 1.05;
      }
    }
    if (this.affix('sanguine') && Math.random() < 0.3) {
      G.Zones.add({ kind: 'tinted', color: '170,20,30', x: e.x, y: e.y, r: 45, life: 6, tick: 0.5, tickT: 0, onTick: z => {
        for (const o of G.Grid.query(z.x, z.y, z.r)) if (!o.boss) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.05);
        if (playerIn(z.x, z.y, z.r)) G.hurtPlayer(6);
      } });
    }
  },

  onBossDeath(e) {
    this.bossKills++;
    G.RunLog.bossDead(e);
    G.UI.warn(`${e.def.name} 처치!`, '#ffd100', 3);
    G.fx.shake(14); G.Audio.play('victory');
    if (e.final && !this.endless) G.later(2.5, () => G.endRun(true));
  },
};
