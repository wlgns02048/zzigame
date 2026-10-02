'use strict';
// ================= 영구 진행도 (골드 · 달라란 도서관 · 기록) =================
// 저장 방식은 세 가지:
//  - account: 로그인. 서버 프로필이 원본이고, 구매/보상은 서버 API로만 바뀐다
//  - guest:   서버는 있지만 로그인 안 함. 아무것도 저장하지 않는다 (기본 플레이만)
//  - local:   서버가 없는 정적 호스팅. 예전처럼 브라우저에 저장
G.META_DEFS = G.TALENTS.scopes.library;

const META_KEY = 'frostmage_meta';
const metaDefaults = () => ({ gold: 0, ranks: {}, best: 0, wins: 0 });

G.Meta = {
  data: metaDefaults(),
  mode() { return G.Net.user ? 'account' : G.Net.online ? 'guest' : 'local'; },

  load() {
    this.data = metaDefaults();
    try { const s = localStorage.getItem(META_KEY); if (s) Object.assign(this.data, JSON.parse(s)); } catch (e) { /* 저장소 사용 불가 */ }
  },
  reset() { this.data = metaDefaults(); },
  useProfile(pr) {
    this.data = { gold: pr.wallet.gold || 0, ranks: Object.assign({}, pr.talents.library), best: pr.best, wins: pr.wins, wallet: pr.wallet };
  },
  save() {
    if (this.mode() !== 'local') return;
    try { localStorage.setItem(META_KEY, JSON.stringify(this.data)); } catch (e) { /* 무시 */ }
  },

  rank(id) { return this.data.ranks[id] || 0; },
  cost(def) { return G.TALENTS.cost(def, this.rank(def.id)); },
  canBuy(def) { return this.mode() !== 'guest' && this.rank(def.id) < def.max && this.data.gold >= this.cost(def); },
  async buy(id) {
    const def = G.TALENTS.find('library', id);
    if (!def || !this.canBuy(def)) return false;
    if (this.mode() === 'account') {
      const r = await G.Net.api('POST', '/api/talents/buy', { scope: 'library', id });
      this.useProfile(r.profile);
      return true;
    }
    this.data.gold -= this.cost(def); this.data.ranks[id] = this.rank(id) + 1; this.save();
    return true;
  },
};
