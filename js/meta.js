'use strict';
// ================= 영구 진행도 (서버 프로필의 브라우저 쪽 보기) =================
// 로그인하면 서버 프로필(재화 · 캐릭터 · 특성 · 장비 · 진행)이 원본이다. 게스트는 아무것도 저장하지 않는다.
G.Meta = {
  profile: null,
  mode() { return G.Net.user ? 'account' : 'guest'; },
  reset() { this.profile = null; },
  useProfile(pr) { this.profile = pr; },

  // 메뉴/상점에서 쓰는 요약 (예전 data 형태 유지)
  get data() {
    const pr = this.profile;
    return pr ? { gold: pr.wallet.gold || 0, best: pr.best, wins: pr.wins } : { gold: 0, best: 0, wins: 0 };
  },
  wallet(c) { return this.profile ? this.profile.wallet[c] || 0 : 0; },
  tree(t) { return (this.profile && this.profile.talents[t]) || { ranks: {}, bought: 0, resets: 0 }; },
  // 달라란 도서관 특성 등급
  lib(id) { return this.tree('library').ranks[id] || 0; },
  equipped(cls) {
    const out = {};
    if (this.profile) for (const it of this.profile.items) if (it.equip && it.equip.cls === cls) out[it.equip.slot] = it;
    return out;
  },
  avgIlvl(cls) {
    let s = 0; for (const it of Object.values(this.equipped(cls))) s += it.ilvl * (G.ITEMS.SLOT[it.slot].twoHand ? 2 : 1);
    return Math.round(s / 16);
  },
  // 장비 능력치 합 (보석 · 마법부여 포함) + 특수 효과 목록
  gearTotals(cls) {
    const tot = {}, effects = [];
    for (const it of Object.values(this.equipped(cls))) {
      const t = G.ITEMS.itemTotals(it);
      for (const k in t) tot[k] = (tot[k] || 0) + t[k];
      if (it.effect) effects.push(it.effect);
      for (const g of it.gems || []) if (g && G.ITEMS.GEMS[g].effect) effects.push(G.ITEMS.GEMS[g].effect);
      if (it.enchant && G.ITEMS.ENCHANTS[it.enchant].effect) effects.push(G.ITEMS.ENCHANTS[it.enchant].effect);
    }
    return { tot, effects };
  },
  // 캐릭터의 전문화 (캐릭터 = 직업, 전문화는 캐릭터에 저장). 주 능력치 · 특성 트리가 전문화를 따른다
  spec(cls) { return G.ITEMS.specOf(cls, this.profile && this.profile.specs && this.profile.specs[cls]); },
  primary(cls) { return G.ITEMS.SPECS[this.spec(cls)].primary; },
  specTree(cls) { return G.ITEMS.SPECS[this.spec(cls)].tree; },
  // 방어구 전문화 (방어구 8부위를 모두 자기 종류로)
  armorSpec(cls) { return G.ITEMS.armorSpec(cls, this.equipped(cls)); },
  // 판 시작 시 능력치에 영구 진행도 적용 (특성 → 장비)
  applyLoadout(st, cls) {
    const T = G.TALENTS, tree = this.specTree(cls);
    for (const tr of ['library', tree]) {
      const ranks = this.tree(tr).ranks;
      for (const id in ranks) { const nd = T.node(tr, id); if (nd && nd.stat && ranks[id]) nd.stat(st, ranks[id]); }
    }
    const { tot, effects } = this.gearTotals(cls);
    if (!Object.keys(tot).length && !effects.length) return;
    const prim = this.primary(cls);
    if (this.armorSpec(cls)) { tot[prim] = (tot[prim] || 0) * 1.05; tot.main = (tot.main || 0) * 1.05; }
    const d = G.ITEMS.derive(tot, prim);
    st.dmg += d.dmg; st.hpFlat += d.hp; st.crit += d.crit; st.haste += d.haste; st.mastery += d.mastery; st.vers += d.vers;
    st.dmg *= 1 + d.vers;
    for (const ef of effects) for (const k in ef) st[k] = (st[k] || 0) + ef[k];
  },
  // 주문 수치에 직업 특성 적용
  applySkillTalents(id, s, cls) {
    const tree = this.specTree(cls), ranks = this.tree(tree).ranks;
    for (const k in ranks) { const nd = G.TALENTS.node(tree, k); if (nd && nd.skill && ranks[k]) nd.skill(id, s, ranks[k]); }
  },
  // 밸런스 시뮬레이터 전용 (?gear=아이템레벨&talents=1): 게스트에게 가상의 장비 · 특성을 입힌다. 서버에는 아무것도 저장되지 않는다.
  useSimLoadout(ilvl, talents) {
    let a = 777; const rng = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    const I = G.ITEMS, items = [], tal = {};
    for (const cls in G.CLASSES) {
      // 직업에 맞는 장비: 자기 방어구 종류 · 전문화 주 능력치 무기 (사냥꾼 = 사슬 + 활, 천 직업 = 천 + 지팡이)
      const g = I.CLASS_GEAR[cls], prim = I.primaryOf(cls), weapon = g.weapons.find(w => I.SLOT[w].twoHand && I.SLOT[w].prim.includes(prim));
      if (ilvl > 0) for (const e of I.EQUIP) {
        if (e.id === 'offhand') continue;
        const slot = e.id === 'mainhand' ? weapon : e.accepts[0];
        const it = I.makeItem(rng, { slot, quality: 3, ilvl, armor: g.armor, prim: slot === 'trinket' || slot === weapon ? prim : null });
        it.equip = { cls, slot: e.id }; items.push(it);
      }
      const tree = I.SPECS[I.defaultSpec(cls)].tree;
      if (talents && G.TALENTS.TREES[tree]) {
        // 줄 순서대로 채워 31점 배분 (규칙 검사 통과하는 것만)
        const ranks = {}, T = G.TALENTS;
        for (const nd of T.TREES[tree].nodes.slice().sort((x, y) => x.row - y.row)) {
          for (let r = 1; r <= nd.max && T.spent(ranks) < 31; r++) { const trial = { ...ranks, [nd.id]: r }; if (!T.validate(tree, trial, 31)) ranks[nd.id] = r; }
        }
        tal[tree] = { ranks, bought: 31, resets: 0 };
      }
    }
    this.profile = { wallet: {}, characters: Object.keys(G.CLASSES), talents: tal, items, stacks: {}, progress: {}, gacha: {}, best: 0, wins: 0 };
  },
  // 특성 포인트 구매 / 배분 / 초기화
  async buyPoint(tree) { this.useProfile((await G.Net.api('POST', '/api/talents/point', { tree })).profile); },
  async setRanks(tree, ranks) { this.useProfile((await G.Net.api('POST', '/api/talents/set', { tree, ranks })).profile); },
  async resetTree(tree) { this.useProfile((await G.Net.api('POST', '/api/talents/reset', { tree })).profile); },
};
