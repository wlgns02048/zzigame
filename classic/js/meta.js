'use strict';
// ================= 영구 강화 (달라란 도서관) =================
G.META_DEFS = [
  { id: 'power', name: '신비한 지능', icon: 'arcaneint', max: 5, base: 120, desc: r => `주문력 +${r * 5}%` },
  { id: 'stamina', name: '인내', icon: 'stamina', max: 5, base: 100, desc: r => `최대 생명력 +${r * 10}%` },
  { id: 'haste', name: '시간의 흐름', icon: 'haste', max: 5, base: 150, desc: r => `가속 +${r * 3}%` },
  { id: 'speed', name: '바람의 걸음', icon: 'speed', max: 3, base: 120, desc: r => `이동 속도 +${r * 4}%` },
  { id: 'pickup', name: '마력 끌어당김', icon: 'pickup', max: 3, base: 80, desc: r => `획득 반경 +${r * 15}%` },
  { id: 'xp', name: '대마법사의 지식', icon: 'xp', max: 5, base: 120, desc: r => `경험치 획득 +${r * 6}%` },
  { id: 'reroll', name: '운명의 주사위', icon: 'reroll', max: 3, base: 200, desc: r => `다시 굴리기 +${r}회` },
  { id: 'luck', name: '행운의 동전', icon: 'luck', max: 3, base: 180, desc: r => `행운 +${r * 5}%, 골드 획득 +${r * 10}%` },
  { id: 'revive', name: '영혼석', icon: 'soulstone', max: 1, base: 1500, desc: r => (r ? '사망 시 1회 부활 (50% 생명력)' : '사망 시 1회 부활') },
];

G.Meta = {
  data: { gold: 0, ranks: {}, best: 0, wins: 0 },
  load() {
    try { const s = localStorage.getItem('frostmage_meta'); if (s) this.data = Object.assign(this.data, JSON.parse(s)); } catch (e) { /* 저장소 사용 불가 */ }
  },
  save() { try { localStorage.setItem('frostmage_meta', JSON.stringify(this.data)); } catch (e) { /* 무시 */ } },
  rank(id) { return this.data.ranks[id] || 0; },
  cost(def) { return Math.round(def.base * Math.pow(1.6, this.rank(def.id))); },
  buy(id) {
    const def = G.META_DEFS.find(d => d.id === id), r = this.rank(id);
    if (r >= def.max) return false;
    const c = this.cost(def);
    if (this.data.gold < c) return false;
    this.data.gold -= c; this.data.ranks[id] = r + 1; this.save(); return true;
  },
};
