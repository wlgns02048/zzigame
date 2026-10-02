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
  // 판 시작 시 능력치에 영구 진행도 적용 (특성 → 장비)
  applyLoadout(st, cls) {
    const T = G.TALENTS;
    for (const tree of ['library', cls]) {
      const ranks = this.tree(tree).ranks;
      for (const id in ranks) { const nd = T.node(tree, id); if (nd && nd.stat && ranks[id]) nd.stat(st, ranks[id]); }
    }
    const { tot, effects } = this.gearTotals(cls);
    if (!Object.keys(tot).length && !effects.length) return;
    const d = G.ITEMS.derive(tot);
    st.dmg += d.dmg; st.hpFlat += d.hp; st.crit += d.crit; st.haste += d.haste; st.mastery += d.mastery; st.vers += d.vers;
    st.dmg *= 1 + d.vers;
    for (const ef of effects) for (const k in ef) st[k] = (st[k] || 0) + ef[k];
  },
  // 주문 수치에 직업 특성 적용
  applySkillTalents(id, s, cls) {
    const ranks = this.tree(cls).ranks;
    for (const k in ranks) { const nd = G.TALENTS.node(cls, k); if (nd && nd.skill && ranks[k]) nd.skill(id, s, ranks[k]); }
  },
  // 특성 포인트 구매 / 배분 / 초기화
  async buyPoint(tree) { this.useProfile((await G.Net.api('POST', '/api/talents/point', { tree })).profile); },
  async setRanks(tree, ranks) { this.useProfile((await G.Net.api('POST', '/api/talents/set', { tree, ranks })).profile); },
  async resetTree(tree) { this.useProfile((await G.Net.api('POST', '/api/talents/reset', { tree })).profile); },
};
