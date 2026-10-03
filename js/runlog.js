'use strict';
// ================= 판 기록 (밸런스 분석용) =================
// 한 판 동안 무엇을 골랐고 어떤 주문이 얼마나 때렸는지 모아 판 보고(/api/runs/report)에 같이 보낸다.
// 서버는 run_logs에 저장하고, 관리자 로비의 '밸런스' 탭이 직업 · 전문화별로 모아 보여준다.
//   dmg   — 주문별 피해 (src → [전체, 유효]) · 유효 = 남은 생명력까지만 (넘친 피해 제외)
//   boss  — 보스마다 등장 · 처치 시각과 주문별 유효 피해 (단일 대상 화력 비교용)
//   tl    — 30초 구간별 유효 피해 합
//   picks — 레벨업 · 상자 선택 [시각, 레벨, 고른 키, 제시된 키들, 등급, 상자 여부]
G.RunLog = {
  BUCKET: 30,
  d: null,

  start() {
    const p = G.player, cls = p.cls, M = G.Meta, tree = M.specTree(cls);
    this.d = {
      v: G.VERSION, spec: M.spec(cls), ilvl: M.avgIlvl(cls),
      talents: { ...M.tree(tree).ranks }, lib: { ...M.tree('library').ranks },
      stats0: this.stats(), dmg: {}, boss: [], tl: [], picks: [], taken: {}, death: null,
    };
    this.bossOf = new Map();
  },

  stats() {
    const p = G.player, s = p.stats, r = v => Math.round(v * 1000) / 1000;
    return { dmg: r(s.dmg), crit: r(s.crit), critMul: r(s.critMul), haste: r(s.haste), mastery: r(s.mastery), vers: r(s.vers), area: r(s.area), dotMul: r(s.dotMul || 1), hp: p.maxHp };
  },

  // G.hit에서 피해를 깎기 직전에 부른다
  hit(e, src, d) {
    const L = this.d; if (!L) return;
    const eff = Math.min(d, Math.max(0, e.hp));
    const m = L.dmg[src] || (L.dmg[src] = [0, 0]);
    m[0] += d; m[1] += eff;
    const b = Math.floor(Math.max(0, G.t) / this.BUCKET);
    L.tl[b] = (L.tl[b] || 0) + eff;
    if (e.boss) {
      const bo = this.bossOf.get(e);
      if (bo) { bo.dmg[src] = (bo.dmg[src] || 0) + eff; if (!bo.first) bo.first = +G.t.toFixed(1); }
    }
  },

  bossSpawn(e) {
    if (!this.d) return;
    const bo = { id: e.id, hp: Math.round(e.maxHp), at: +G.t.toFixed(1), kill: null, first: null, dmg: {} };
    this.d.boss.push(bo); this.bossOf.set(e, bo);
  },
  bossDead(e) {
    const bo = this.d && this.bossOf.get(e);
    if (bo) bo.kill = +G.t.toFixed(1);
  },

  // 고른 선택지 (i < 0 = 건너뛰기)
  pick(opts, i, chest) {
    if (!this.d) return;
    const o = opts[i], key = o ? G.Upg.key(o) : 'skip', p = G.player;
    this.d.picks.push([+G.t.toFixed(1), p.level, key, opts.map(x => G.Upg.key(x)), o ? o.rarity || 0 : 0, chest ? 1 : 0]);
  },

  hurt(src, dmg) {
    if (!this.d) return;
    const k = src && typeof src.id === 'string' ? src.id : 'etc'; // 지정 없음 = 투사체 · 장판
    this.d.taken[k] = (this.d.taken[k] || 0) + dmg;
    this.lastHit = k;
  },
  death() { if (this.d) this.d.death = { t: +G.t.toFixed(1), by: this.lastHit || null, lv: G.player.level }; },

  // 보고에 실어 보낼 스냅숏
  snapshot() {
    const L = this.d; if (!L) return null;
    const p = G.player, r = v => Math.round(v);
    const dmg = {}; for (const k in L.dmg) dmg[k] = [r(L.dmg[k][0]), r(L.dmg[k][1])];
    const boss = L.boss.map(b => { const o = { ...b, dmg: {} }; for (const k in b.dmg) o.dmg[k] = r(b.dmg[k]); return o; });
    const taken = {}; for (const k in L.taken) taken[k] = r(L.taken[k]);
    const skills = {}; for (const id of p.order) skills[id] = { lv: p.skillLevel(id), ranks: { ...p.skills[id].ranks } };
    const passives = {}; for (const id in p.passives) passives[id] = [p.passives[id].rank, +(+p.passives[id].total).toFixed(1)];
    return {
      ...L, dmg, boss, taken, tl: Array.from(L.tl, v => r(v || 0)),
      stats1: this.stats(), skills, passives, legend: Object.keys(p.legend), evo: Object.keys(p.evo),
      endless: G.Waves.endless ? G.Waves.level : 0,
    };
  },
};
