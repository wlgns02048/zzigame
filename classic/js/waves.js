'use strict';
// ================= 웨이브 감독 =================
G.Waves = {
  reset() {
    this.spawnAcc = 0; this.eliteT = 75; this.bossIdx = 0; this.swarmIdx = 0; this.boss = null; this.warned = {};
    this.endless = false;
  },
  hpMul() { const t = G.t; return 1 + Math.pow(t / 300, 1.5) * 1.6; },
  dmgMul() { return 1 + G.t / 700; },
  rate() { const t = G.t; return Math.min(15, 0.6 + t / 110 + Math.pow(t / 300, 2) * 2); },
  maxEnemies() { return 200 + Math.min(250, G.t / 3); },

  pickType() {
    const t = G.t;
    const list = Object.values(G.ENEMIES).filter(d => !d.boss && t >= d.t0);
    return U.wpick(list, d => d.w * (d.id === 'ghoul' ? Math.max(0.25, 1 - t / 600) : 1) * Math.min(1, (t - d.t0 + 20) / 60)).id;
  },
  ringPos(extra = 0) {
    const p = G.player, a = Math.random() * Math.PI * 2;
    const R = Math.hypot(G.W, G.H) / 2 + 40 + extra;
    return [p.x + Math.cos(a) * R, p.y + Math.sin(a) * R];
  },

  update(dt) {
    const t = G.t;
    // 보스
    const bs = G.BOSS_SCHEDULE[this.bossIdx];
    if (bs) {
      if (t >= bs.t - 6 && !this.warned[bs.id]) { this.warned[bs.id] = true; G.UI.warn(bs.warn, '#ff6a1a', 5); G.Audio.play('warn'); }
      if (t >= bs.t) {
        this.bossIdx++;
        const [x, y] = this.ringPos(-60);
        this.boss = G.Enemy.spawn(bs.id, x, y);
        G.Audio.play('boss'); G.fx.shake(8);
      }
    }
    // 무리 습격
    const sw = G.SWARMS[this.swarmIdx];
    if (sw !== undefined && t >= sw) {
      this.swarmIdx++;
      const id = t > 400 ? (Math.random() < 0.5 ? 'gargoyle' : 'skeleton') : 'ghoul', n = 18 + Math.floor(t / 25);
      const p = G.player, R = Math.max(G.W, G.H) * 0.55;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; G.Enemy.spawn(id, p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); }
      G.UI.warn('스컬지 무리가 포위합니다!', '#ff6a1a', 2.5); G.Audio.play('warn');
    }
    // 정예
    this.eliteT -= dt;
    if (this.eliteT <= 0) {
      this.eliteT = 65;
      const [x, y] = this.ringPos();
      const pool = Object.values(G.ENEMIES).filter(d => !d.boss && t >= d.t0 && !d.ranged);
      G.Enemy.spawn(U.choice(pool).id, x, y, { elite: true });
      G.UI.warn('정예 몬스터가 나타났습니다!', '#ffd100', 2);
    }
    // 일반 생성
    const bossAlive = this.boss && !this.boss.dead;
    this.spawnAcc += dt * this.rate() * (bossAlive ? 0.45 : 1);
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (G.enemies.length >= this.maxEnemies()) { this.spawnAcc = 0; break; }
      const [x, y] = this.ringPos();
      G.Enemy.spawn(this.pickType(), x, y);
    }
  },

  onBossDeath(e) {
    G.UI.warn(`${e.def.name} 처치!`, '#ffd100', 3);
    G.fx.shake(14); G.Audio.play('victory');
    if (e.id === 'lichking' && !this.endless) {
      G.later(2.5, () => G.endRun(true));
    }
  },
};
