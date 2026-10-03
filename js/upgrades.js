'use strict';
// ================= 레벨업 선택지 =================
G.RARITY = [
  { name: '일반', color: '#ffffff', mult: 1 },
  { name: '고급', color: '#1eff00', mult: 1.35 },
  { name: '희귀', color: '#0070dd', mult: 1.75 },
  { name: '영웅', color: '#a335ee', mult: 2.2 },
  { name: '전설', color: '#ff8000', mult: 1 },
  { name: '유물', color: '#e6cc80', mult: 1 },
];

G.Upg = {
  count(kind) { return G.player.order.filter(id => G.SKILLS[id].kind === kind).length; },

  pool(chest) {
    const p = G.player, C = G.cls(p), out = [];
    const npass = Object.keys(p.passives).length;
    const M = G.Meta, school = { auto: 1 + 0.3 * M.lib('schoolAuto'), active: 1 + 0.3 * M.lib('schoolActive') };
    const add = o => {
      o.w = C.upgWeight(o, p) ?? o.w ?? 1;
      // 달라란 도서관: 학파 연구 · 전설의 부름
      if (o.type === 'new') o.w *= school[G.SKILLS[o.id].kind];
      else if (o.type === 'passive') o.w *= 1 + 0.3 * M.lib('schoolPassive');
      else if (o.type === 'legendary') o.w *= 1 + 0.5 * M.lib('legendCall');
      if (p.banished.has(this.key(o))) return;
      out.push(o);
    };
    for (const id in G.SKILLS) {
      const def = G.SKILLS[id], ok = (def.cls === p.cls || def.cls === 'any') && (!def.req || def.req(p));
      if (!ok) continue;
      if ((def.kind === 'auto' || def.kind === 'active') && !p.skills[id] && this.count(def.kind) < G.LIMITS[def.kind]) {
        add({ type: 'new', id });
      } else if (def.kind === 'passive') {
        const r = p.passives[id] ? p.passives[id].rank : 0;
        if (r < def.max && (r > 0 || npass < G.LIMITS.passive)) add({ type: 'passive', id });
      } else if (def.kind === 'legendary' && !p.legend[id] && (p.level >= 8 || chest)) {
        add({ type: 'legendary', id, w: chest ? 1.4 : 0.1 + p.stats.luck * 0.4 });
      } else if (def.kind === 'evolution' && !p.evo[id]) {
        add({ type: 'evolution', id, w: chest ? 8 : 3 });
      }
    }
    for (const id of p.order) {
      const sk = p.skills[id];
      for (const n of sk.def.nodes || []) {
        if ((sk.ranks[n.id] || 0) >= n.max) continue;
        add({ type: 'node', id, nodeId: n.id });
      }
    }
    return out;
  },

  rollRarity() {
    const l = G.player.stats.luck, r = Math.random();
    if (r < 0.05 + l * 0.15) return 3;
    if (r < 0.17 + l * 0.3) return 2;
    if (r < 0.45 + l * 0.3) return 1;
    return 0;
  },

  key(o) { return `${o.type}:${o.id}:${o.nodeId || ''}`; },

  gen(n = 3, chest = 0) {
    let pool = this.pool(chest);
    const picks = [], p = G.player;
    // 봉인해 둔 선택지가 아직 유효하면 맨 앞에
    if (p.sealed) {
      const k = this.key(p.sealed), s = pool.find(o => this.key(o) === k);
      p.sealed = null;
      if (s) { s.wasSealed = true; picks.push(s); pool = pool.filter(o => o !== s); }
    }
    if (chest >= 2) {
      const special = pool.filter(o => o.type === 'evolution' || o.type === 'legendary');
      if (special.length) { const s = U.wpick(special, o => o.w); picks.push(s); pool = pool.filter(o => o !== s); }
    }
    while (picks.length < n && pool.length) {
      const o = U.wpick(pool, x => x.w);
      picks.push(o);
      pool = pool.filter(x => !(x === o || (x.type === 'node' && o.type === 'node' && x.id === o.id && x.nodeId === o.nodeId)));
    }
    if (!picks.length) picks.push({ type: 'gold', id: 'gold' }, { type: 'heal', id: 'food' });
    return picks.map(o => this.describe(o));
  },

  // 달라란 도서관: 추방 — opts[i] 한 장만 새로 뽑는다 (나머지 선택지와 겹치지 않게)
  replace(opts, i, chest = 0) {
    const taken = new Set(opts.map(o => this.key(o)));
    const pool = this.pool(chest).filter(o => !taken.has(this.key(o)));
    return this.describe(pool.length ? U.wpick(pool, x => x.w) : { type: 'gold', id: 'gold' });
  },

  describe(o) {
    const p = G.player, def = G.SKILLS[o.id];
    const KIND = { auto: '자동 시전 주문', active: '핵심 주문', passive: '능력치', legendary: '전설 효과', evolution: '진화' };
    if (o.type === 'gold') return Object.assign(o, { rarity: 0, icon: 'gold', name: '골드 주머니', label: '보상', desc: '골드 <b class="v">+25</b>', lv: '' });
    if (o.type === 'heal') return Object.assign(o, { rarity: 0, icon: 'food', name: '창조된 계피 롤빵', label: '보상', desc: '생명력 <b class="v">50%</b> 회복', lv: '' });
    if (o.type === 'new') {
      Object.assign(o, { rarity: 3, icon: def.icon, name: def.name, label: '새 주문 · ' + KIND[def.kind], key: def.key });
      // 미리보기용 계산
      const tmp = { id: o.id, def, ranks: {} }; const save = p.skills[o.id];
      G.P.computeSkill(tmp); o.desc = def.tip(tmp.s); o.cast = def.castInfo(tmp.s); o.lv = '새로 배움';
      if (save) p.skills[o.id] = save;
      return o;
    }
    if (o.type === 'node') {
      const sk = p.skills[o.id], node = def.nodes.find(n => n.id === o.nodeId), r = sk.ranks[o.nodeId] || 0;
      return Object.assign(o, {
        rarity: 2, icon: node.icon || def.icon, name: node.name, label: `${def.name} 강화`, nodeDesc: node.desc,
        desc: '', lv: `${def.name} ${p.skillLevel(o.id)} → ${p.skillLevel(o.id) + 1}레벨 · 등급 ${r}/${node.max}`, key: def.key,
      });
    }
    if (o.type === 'passive') {
      const r = p.passives[o.id] ? p.passives[o.id].rank : 0;
      const rar = def.fixed ? (def.rarity || 2) : this.rollRarity();
      const v = def.fixed ? def.val : +(def.val * G.RARITY[rar].mult).toFixed(1);
      return Object.assign(o, { rarity: rar, value: v, icon: G.skIcon(def), name: G.skName(def), label: KIND.passive, nodeDesc: def.desc(v), desc: r ? `현재: ${def.desc(p.passives[o.id].total)}` : '', lv: `등급 ${r} → ${r + 1} / ${def.max}` });
    }
    if (o.type === 'legendary') return Object.assign(o, { rarity: 4, icon: def.icon, name: def.name, label: KIND.legendary, desc: def.desc(), lv: '' });
    if (o.type === 'evolution') return Object.assign(o, { rarity: 5, icon: def.icon, name: def.name, label: KIND.evolution, desc: def.desc(), lv: def.reqText });
    return o;
  },

  apply(o) {
    const p = G.player;
    switch (o.type) {
      case 'new': G.P.learn(o.id); break;
      case 'node': G.P.rankUp(o.id, o.nodeId); break;
      case 'passive': G.P.addPassive(o.id, o.value); break;
      case 'legendary': p.legend[o.id] = true; G.P.recalc(); break;
      case 'evolution':
        p.evo[o.id] = true; G.P.recalc();
        G.fx.burst(p.x, p.y, 60, { rgb: '255,170,80', sp: 260, size: 14, life: 1 });
        G.fx.ring(p.x, p.y, 10, 160, 0.7, '255,200,120', 8);
        break;
      case 'gold': G.stats.gold += 25; break;
      case 'heal': G.P.heal(p.maxHp * 0.5); break;
    }
    G.Audio.play('click');
  },
};
