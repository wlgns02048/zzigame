'use strict';
// ================= 장비 · 능력치 · 보석 · 마법부여 · 가챠 · 퀘스트 · 금고 (브라우저 · 서버 공용) =================
// 서버는 아이템 생성/가챠/보상을 이 파일로 계산하고, 브라우저는 툴팁과 능력치 계산에 쓴다.
// 난수는 rng() 인자로 받는다 (서버는 crypto 기반, 테스트는 고정 시드).
(function (root) {
  // ---------- 화폐 ----------
  const CURRENCIES = {
    gold: { name: '골드', icon: 'gold', color: '#ffd100' },
    badge: { name: '정의의 휘장', icon: 'badge', color: '#7fd4ff', desc: '보스 처치 · 스테이지 클리어로 획득. 장비 뽑기에 사용' },
    dust: { name: '신비한 가루', icon: 'dust', color: '#c9a7ff', desc: '장비 분해로 획득. 마법부여 뽑기에 사용' },
    essence: { name: '영원의 정수', icon: 'essence', color: '#ff9cff', desc: '희귀 이상 장비 분해로 획득. 상급 마법부여 뽑기에 사용' },
    rough: { name: '미가공 원석', icon: 'roughgem', color: '#9fe0a0', desc: '엔드리스 진행 · 퀘스트로 획득. 보석 뽑기에 사용' },
  };

  // ---------- 품질 ----------
  const QUALITY = [
    { name: '일반', color: '#ffffff', budget: 0.6 },
    { name: '고급', color: '#1eff00', budget: 0.8 },
    { name: '희귀', color: '#0070dd', budget: 1.0 },
    { name: '영웅', color: '#a335ee', budget: 1.15 },
    { name: '전설', color: '#ff8000', budget: 1.35 },
  ];

  // ---------- 능력치 ----------
  // 수치(rating) → 효과. 2차 능력치는 와우처럼 30% 이후 효율 감소.
  const STATS = {
    int: { name: '지능', short: '지능', primary: true },
    sta: { name: '체력', short: '체력', primary: true },
    crit: { name: '치명타', short: '치명', per: 25 },     // 25 = 1%
    haste: { name: '가속', short: '가속', per: 25 },
    mastery: { name: '특화', short: '특화', per: 25 },   // 25 = 1점 (직업별 효과)
    vers: { name: '유연성', short: '유연', per: 30 },    // 30 = 피해 +1%, 받는 피해 -0.5%
  };
  const SECONDARY = ['crit', 'haste', 'mastery', 'vers'];
  const DR = [[30, 1], [39, 0.9], [47, 0.8], [54, 0.7], [66, 0.6], [126, 0.5]];
  // % 값에 효율 감소 적용
  const diminish = pct => {
    let out = 0, prev = 0;
    for (const [cap, eff] of DR) { if (pct <= prev) break; out += (Math.min(pct, cap) - prev) * eff; prev = cap; }
    return out;
  };
  // 장비 능력치 합 → 게임 수치
  const derive = t => ({
    dmg: (t.int || 0) * 0.0012,                       // 지능 1당 주문력 +0.12%
    hp: (t.sta || 0) * 0.4,                           // 체력 1당 생명력 +0.4
    crit: diminish((t.crit || 0) / STATS.crit.per) / 100,
    haste: diminish((t.haste || 0) / STATS.haste.per) / 100,
    mastery: diminish((t.mastery || 0) / STATS.mastery.per),
    vers: diminish((t.vers || 0) / STATS.vers.per) / 100,
  });

  // ---------- 부위 ----------
  // mod: 아이템 레벨 대비 능력치 예산 비율 (와우 부위 계수)
  const SLOTS = [
    { id: 'head', name: '머리', mod: 1, icon: 'eq_head', bases: ['두건', '관', '왕관'] },
    { id: 'neck', name: '목', mod: 0.56, icon: 'eq_neck', bases: ['목걸이', '펜던트', '목장식'] },
    { id: 'shoulder', name: '어깨', mod: 0.77, icon: 'eq_shoulder', bases: ['어깨보호구', '어깨덧옷'] },
    { id: 'back', name: '등', mod: 0.56, icon: 'eq_back', bases: ['망토', '외투'] },
    { id: 'chest', name: '가슴', mod: 1, icon: 'eq_chest', bases: ['로브', '예복', '조끼'] },
    { id: 'wrist', name: '손목', mod: 0.56, icon: 'eq_wrist', bases: ['손목보호구', '팔찌'] },
    { id: 'hands', name: '손', mod: 0.77, icon: 'eq_hands', bases: ['장갑', '손싸개'] },
    { id: 'waist', name: '허리', mod: 0.77, icon: 'eq_waist', bases: ['허리띠', '장식띠'] },
    { id: 'legs', name: '다리', mod: 1, icon: 'eq_legs', bases: ['바지', '다리보호구'] },
    { id: 'feet', name: '발', mod: 0.77, icon: 'eq_feet', bases: ['신발', '장화'] },
    { id: 'finger', name: '손가락', mod: 0.56, icon: 'eq_finger', bases: ['반지', '인장 반지'] },
    { id: 'trinket', name: '장신구', mod: 0.7, icon: 'eq_trinket', bases: ['부적', '우상', '유물'] },
    { id: 'staff', name: '양손 무기', mod: 2, icon: 'eq_staff', bases: ['지팡이'], twoHand: true },
    { id: 'dagger', name: '한손 무기', mod: 1.1, icon: 'eq_dagger', bases: ['단검', '마법봉'] },
    { id: 'offhand', name: '보조장비', mod: 0.9, icon: 'eq_offhand', bases: ['마법서', '수정구', '해골'] },
  ];
  const SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]));
  // 착용 칸 16개 → 들어갈 수 있는 부위
  const EQUIP = [
    ['head', 'head'], ['neck', 'neck'], ['shoulder', 'shoulder'], ['back', 'back'], ['chest', 'chest'], ['wrist', 'wrist'],
    ['hands', 'hands'], ['waist', 'waist'], ['legs', 'legs'], ['feet', 'feet'], ['finger1', 'finger'], ['finger2', 'finger'],
    ['trinket1', 'trinket'], ['trinket2', 'trinket'], ['mainhand', 'staff|dagger'], ['offhand', 'offhand'],
  ].map(([id, accepts]) => ({ id, accepts: accepts.split('|'), name: id === 'mainhand' ? '주무기' : id === 'offhand' ? '보조장비' : SLOT[accepts.split('|')[0]].name + (/\d$/.test(id) ? ' ' + id.slice(-1) : '') }));
  const canEquip = (eqSlot, itemSlot) => { const e = EQUIP.find(x => x.id === eqSlot); return !!e && e.accepts.includes(itemSlot); };

  // 무작위 2차 능력치 조합 → 접미사 (와우 클래식 "~의" 방식)
  const SUFFIXES = [
    { name: '올빼미의', stats: ['crit', 'haste'] }, { name: '매의', stats: ['crit', 'mastery'] }, { name: '독수리의', stats: ['crit', 'vers'] },
    { name: '고래의', stats: ['haste', 'mastery'] }, { name: '여우의', stats: ['haste', 'vers'] }, { name: '거북의', stats: ['mastery', 'vers'] },
  ];

  // ---------- 아이템 생성 ----------
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const weighted = (rng, entries) => { // [[value, weight], ...]
    let tot = 0; for (const [, w] of entries) tot += w;
    let r = rng() * tot;
    for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
    return entries[entries.length - 1][0];
  };
  // 예산 → 능력치. 주 능력치 55%(지능 6 : 체력 4), 2차 능력치 45%를 두 가지로 나눔
  const rollStats = (rng, slotId, quality, ilvl, sec) => {
    const b = ilvl * SLOT[slotId].mod * QUALITY[quality].budget;
    const prim = b * 0.55, second = b * 0.45;
    const split = 0.4 + rng() * 0.2;
    const st = { int: Math.round(prim * 0.6), sta: Math.round(prim * 0.4 * 1.5) };
    st[sec[0]] = Math.round(second * split * 1.2);
    st[sec[1]] = Math.round(second * (1 - split) * 1.2);
    if (slotId === 'trinket') { st.int = Math.round(st.int * 1.3); delete st.sta; } // 장신구는 체력 대신 지능 위주
    if (slotId === 'neck' || slotId === 'finger') st.sta = Math.round((st.sta || 0) * 1.2);
    return st;
  };
  const rollSockets = (rng, slotId, quality) => {
    if (slotId === 'head' && quality >= 3) return ['meta'];
    const n = quality >= 4 ? 2 : quality === 3 ? (rng() < 0.5 ? 1 : 0) : quality === 2 ? (rng() < 0.25 ? 1 : 0) : 0;
    return Array(n).fill('prism');
  };
  // 무작위 아이템 (접미사형). named가 있으면 그 이름/고정 2차 능력치를 쓴다.
  const makeItem = (rng, { slot, quality, ilvl, named }) => {
    slot = slot || pick(rng, SLOTS).id;
    const s = SLOT[slot];
    let name, sec, icon = s.icon, effect = null;
    if (named) {
      name = named.name; sec = named.stats; icon = named.icon || icon; effect = named.effect || null; quality = named.quality ?? quality;
    } else {
      const suf = pick(rng, SUFFIXES);
      name = `${suf.name} ${pick(rng, s.bases)}`; sec = suf.stats;
      if (slot === 'staff' || slot === 'dagger') icon = slot === 'staff' ? pick(rng, ['eq_staff', 'eq_staff2']) : pick(rng, ['eq_dagger', 'eq_wand']);
      else if (quality >= 3 && ['head', 'chest', 'shoulder', 'legs', 'hands', 'finger', 'neck', 'trinket', 'back'].includes(slot)) icon = s.icon + '2';
    }
    return { slot, quality, ilvl, name, icon, stats: rollStats(rng, slot, quality, ilvl, sec), sockets: rollSockets(rng, slot, quality), gems: [], enchant: null, effect };
  };

  // 아이템 하나의 능력치 합 (보석 · 마법부여 포함)
  const itemTotals = it => {
    const t = Object.assign({}, it.stats);
    const add = (o, m = 1) => { for (const k in o) t[k] = (t[k] || 0) + o[k] * m; };
    for (const g of it.gems || []) if (g && GEMS[g]) add(GEMS[g].stats);
    if (it.enchant && ENCHANTS[it.enchant]) add(ENCHANTS[it.enchant].stats || {});
    return t;
  };
  const sellPrice = it => Math.round(it.ilvl * (1 + it.quality * 1.5));
  // 분해 결과 (rng 없이 고정: 서버/클라이언트 미리보기 일치)
  const disenchant = it => {
    const q = it.quality, lv = it.ilvl / 20;
    if (q >= 4) return { essence: 10, dust: Math.round(30 * lv) };
    return { dust: Math.max(1, Math.round([1, 3, 6, 10][q] * lv)), ...(q >= 2 ? { essence: q === 3 ? 2 : 1 } : {}) };
  };

  // ---------- 전설 · 특수 아이템 ----------
  const LEGENDARIES = [
    { name: '아티에시, 수호자의 위대한 지팡이', slot: 'staff', icon: 'atiesh', stats: ['haste', 'crit'], effect: { area: 0.12, haste: 0.04 }, effectText: '주문 범위 +12%, 가속 +4%' },
    { name: '설퍼라스의 눈', slot: 'trinket', icon: 'eyeofsulfuras', stats: ['crit', 'mastery'], effect: { critMul: 0.2 }, effectText: '치명타 피해 +20%' },
    { name: '네파리안의 그림자 망토', slot: 'back', icon: 'eq_back2', stats: ['haste', 'vers'], effect: { dur: 0.15, speedMul: 0.06 }, effectText: '주문 지속시간 +15%, 이동 속도 +6%' },
    { name: '켈투자드의 서리 인장', slot: 'finger', icon: 'eq_finger2', stats: ['crit', 'haste'], effect: { proj: 1 }, effectText: '모든 투사체 주문의 투사체 +1' },
  ];
  // 금고 전용
  const VAULT_ITEMS = [
    { name: '티탄의 금고 열쇠', slot: 'trinket', icon: 'eq_trinket2', stats: ['mastery', 'haste'], quality: 3, effect: { xpMul: 0.1, luck: 0.05 }, effectText: '경험치 획득 +10%, 행운 +5%' },
    { name: '고대 금고지기의 반지', slot: 'finger', icon: 'eq_finger2', stats: ['crit', 'vers'], quality: 3, effect: { pickupMul: 0.25 }, effectText: '획득 반경 +25%' },
    { name: '봉인된 시간의 망토', slot: 'back', icon: 'eq_back2', stats: ['haste', 'mastery'], quality: 3, effect: { haste: 0.05 }, effectText: '가속 +5%' },
  ];

  // ---------- 보석 ----------
  // 등급(1~4)별 수치. 다색 보석은 두 능력치에 나눔.
  const GEM_COLORS = {
    red: { name: '루비', stats: { int: 1 }, icon: 'gem_red', label: '붉은' },
    yellow: { name: '여명석', stats: { crit: 1.5 }, icon: 'gem_yellow', label: '노란' },
    blue: { name: '별사파이어', stats: { sta: 1.5 }, icon: 'gem_blue', label: '푸른' },
    orange: { name: '귀족 토파즈', stats: { int: 0.5, haste: 0.75 }, icon: 'gem_orange', label: '주황' },
    purple: { name: '밤의 눈', stats: { int: 0.5, sta: 0.75 }, icon: 'gem_purple', label: '보라' },
    green: { name: '탈라사이트', stats: { mastery: 0.75, vers: 0.75 }, icon: 'gem_green', label: '초록' },
  };
  const GEM_TIER = [null, { name: '조잡한', amt: 6, quality: 0 }, { name: '빛나는', amt: 9, quality: 1 }, { name: '찬란한', amt: 12, quality: 2 }, { name: '완벽한', amt: 16, quality: 3 }];
  const GEMS = {};
  for (const c in GEM_COLORS) for (let tier = 1; tier <= 4; tier++) {
    const C = GEM_COLORS[c], T = GEM_TIER[tier], st = {};
    for (const k in C.stats) st[k] = Math.round(C.stats[k] * T.amt);
    GEMS[`${c}${tier}`] = { id: `${c}${tier}`, name: `${T.name} ${C.name}`, color: c, tier, quality: T.quality, icon: C.icon, stats: st };
  }
  // 얼개 보석 (머리 전용)
  GEMS.meta1 = { id: 'meta1', name: '혼돈의 하늘불꽃 다이아몬드', color: 'meta', tier: 4, quality: 3, icon: 'gem_meta', stats: { int: 8 }, effect: { critMul: 0.06 }, effectText: '치명타 피해 +6%' };
  GEMS.meta2 = { id: 'meta2', name: '은밀한 대지분노 다이아몬드', color: 'meta', tier: 4, quality: 3, icon: 'gem_meta', stats: { sta: 12 }, effect: { armor: 0.04 }, effectText: '받는 피해 -4%' };
  GEMS.meta3 = { id: 'meta3', name: '신비한 하늘불꽃 다이아몬드', color: 'meta', tier: 4, quality: 3, icon: 'gem_meta', stats: { haste: 12 }, effect: { haste: 0.03 }, effectText: '가속 +3%' };
  const canSocket = (socket, gemId) => { const g = GEMS[gemId]; return !!g && (socket === 'meta' ? g.color === 'meta' : g.color !== 'meta'); };

  // ---------- 마법부여 ----------
  // 부위별로 붙일 수 있는 종류가 정해져 있다 (와우와 같음). rank 1~3.
  const ENCHANT_BASE = [
    { id: 'head_arcanum', slots: ['head'], name: '집중의 비전 문장', stats: { int: 6, sta: 6 } },
    { id: 'shoulder_inscription', slots: ['shoulder'], name: '마력의 인장', stats: { int: 5, crit: 6 } },
    { id: 'back_int', slots: ['back'], name: '망토 - 상급 지능', stats: { int: 6 } },
    { id: 'back_speed', slots: ['back'], name: '망토 - 은신', stats: { vers: 8 } },
    { id: 'chest_stats', slots: ['chest'], name: '가슴 - 최상급 능력치', stats: { int: 4, sta: 6 } },
    { id: 'wrist_int', slots: ['wrist'], name: '손목 - 상급 지능', stats: { int: 6 } },
    { id: 'hands_haste', slots: ['hands'], name: '장갑 - 주문 가속', stats: { haste: 10 } },
    { id: 'hands_crit', slots: ['hands'], name: '장갑 - 냉기 주문 강화', stats: { crit: 10 } },
    { id: 'legs_spellthread', slots: ['legs'], name: '황금 주문실', stats: { int: 7, sta: 7 } },
    { id: 'feet_speed', slots: ['feet'], name: '장화 - 미끄러운 발걸음', stats: { sta: 4 }, effect: { speedMul: 0.03 }, effectText: '이동 속도 +3%' },
    { id: 'feet_vers', slots: ['feet'], name: '장화 - 활력', stats: { vers: 9 } },
    { id: 'finger_int', slots: ['finger'], name: '반지 - 주문력', stats: { int: 5 } },
    { id: 'finger_mastery', slots: ['finger'], name: '반지 - 특화', stats: { mastery: 9 } },
    { id: 'weapon_power', slots: ['staff', 'dagger'], name: '무기 - 주문력', stats: { int: 12 } },
    { id: 'weapon_soulfrost', slots: ['staff', 'dagger'], name: '무기 - 영혼서리', stats: { int: 8, crit: 8 } },
    { id: 'offhand_int', slots: ['offhand'], name: '보조장비 - 지능', stats: { int: 6 } },
  ];
  const ENCHANT_RANK = [null, { name: '하급', mult: 1, quality: 1 }, { name: '상급', mult: 1.6, quality: 2 }, { name: '최상급', mult: 2.3, quality: 3 }];
  const ENCHANTS = {};
  for (const e of ENCHANT_BASE) for (let r = 1; r <= 3; r++) {
    const st = {}; for (const k in e.stats) st[k] = Math.round(e.stats[k] * ENCHANT_RANK[r].mult);
    const eff = e.effect ? Object.fromEntries(Object.entries(e.effect).map(([k, v]) => [k, +(v * ENCHANT_RANK[r].mult).toFixed(3)])) : null;
    ENCHANTS[`${e.id}${r}`] = { id: `${e.id}${r}`, base: e.id, slots: e.slots, rank: r, quality: ENCHANT_RANK[r].quality, name: `${ENCHANT_RANK[r].name} ${e.name}`, stats: st, effect: eff,
      effectText: e.effectText ? e.effectText.replace(/\d+%/, m => Math.round(parseInt(m) * ENCHANT_RANK[r].mult) + '%') : null };
  }
  const canEnchant = (itemSlot, enchId) => { const e = ENCHANTS[enchId]; return !!e && e.slots.includes(itemSlot); };

  // ---------- 가챠 ----------
  // 확률은 화면에 그대로 공개한다. pity: 해당 횟수 안에 최상위 등급 확정.
  const GACHA = {
    equip: {
      name: '장비 뽑기', icon: 'gacha_equip', currency: 'badge', cost: 10, cost10: 90,
      table: [[1, 55], [2, 33], [3, 11], [4, 1]], tableNames: ['고급', '희귀', '영웅', '전설'],
      pity: { at: 80, value: 4, label: '전설' }, ten: { min: 2, label: '10회 뽑기 시 희귀 이상 1개 보장' },
    },
    enchant: {
      name: '마법부여 뽑기', icon: 'gacha_enchant', currency: 'dust', cost: 20, cost10: 180,
      table: [[1, 60], [2, 32], [3, 8]], tableNames: ['하급', '상급', '최상급'],
      pity: { at: 30, value: 3, label: '최상급' }, ten: { min: 2, label: '10회 뽑기 시 상급 이상 1개 보장' },
      premium: { currency: 'essence', cost: 5, table: [[2, 75], [3, 25]], label: '상급 이상 확정 (영원의 정수 5)' },
    },
    gem: {
      name: '보석 뽑기', icon: 'gacha_gem', currency: 'rough', cost: 5, cost10: 45,
      table: [[1, 48], [2, 32], [3, 15], [4, 4], ['meta', 1]], tableNames: ['조잡한', '빛나는', '찬란한', '완벽한', '얼개 보석'],
      pity: { at: 40, value: 4, label: '완벽한' }, ten: { min: 2, label: '10회 뽑기 시 빛나는 이상 1개 보장' },
    },
  };
  const rank = v => (v === 'meta' ? 5 : v);
  // 한 번 뽑기. state.pity = 최상위 미획득 횟수 (서버가 저장)
  const gachaRoll = (rng, kind, state, opts = {}) => {
    const g = GACHA[kind];
    let table = opts.premium ? g.premium.table : g.table;
    if (opts.floor) table = table.filter(([v]) => rank(v) >= opts.floor);
    let v = weighted(rng, table);
    state.pity = (state.pity || 0) + 1;
    if (state.pity >= g.pity.at && rank(v) < rank(g.pity.value)) v = g.pity.value;
    if (rank(v) >= rank(g.pity.value)) state.pity = 0;
    return v;
  };
  // 뽑기 결과 → 실제 보상
  const gachaReward = (rng, kind, v, ctx) => {
    if (kind === 'equip') {
      if (v === 4) { const L = pick(rng, LEGENDARIES); return { type: 'item', item: makeItem(rng, { slot: L.slot, quality: 4, ilvl: ctx.ilvl + 6, named: L }) }; }
      return { type: 'item', item: makeItem(rng, { quality: v, ilvl: ctx.ilvl + Math.floor(rng() * 7) - 3 }) };
    }
    if (kind === 'enchant') { const b = pick(rng, ENCHANT_BASE); return { type: 'enchant', id: `${b.id}${v}` }; }
    if (kind === 'gem') {
      if (v === 'meta') return { type: 'gem', id: pick(rng, ['meta1', 'meta2', 'meta3']) };
      return { type: 'gem', id: `${pick(rng, Object.keys(GEM_COLORS))}${v}` };
    }
  };

  // ---------- 일일 · 주간 퀘스트 ----------
  // track: 런 보고/행동에서 올라가는 카운터 이름
  // 보상 기준: 일반 던전 1회 클리어 ≈ 골드 1,000~1,300 · 휘장 6 · 장비 3~4개 (영웅 ≈ 골드 1,500 · 휘장 12).
  // 퀘스트 하나는 필요한 판 수만큼의 재화 보상과 비슷하거나 조금 더 주도록 맞춘다.
  const QUESTS = {
    daily: [
      { id: 'd_clear2', name: '던전 정복', desc: '스테이지 2회 클리어', track: 'clear', goal: 2, reward: { badge: 12, gold: 500 } },
      { id: 'd_kill2000' /* 목표를 올렸지만 오늘 이미 받은 사람이 또 받지 않게 id 유지 */, name: '스컬지 소탕', desc: '적 10,000마리 처치', track: 'kill', goal: 10000, reward: { gold: 1200 } },
      { id: 'd_boss5', name: '우두머리 사냥', desc: '보스 5회 처치', track: 'boss', goal: 5, reward: { badge: 12 } },
      { id: 'd_endless5', name: '끝없는 시련', desc: '엔드리스 5단계 도달', track: 'endless', goal: 5, reward: { rough: 25 } },
      { id: 'd_heroic1', name: '영웅의 길', desc: '영웅 난이도 클리어 1회', track: 'heroic', goal: 1, reward: { badge: 15 } },
      { id: 'd_de5', name: '마력 추출', desc: '장비 5개 분해', track: 'de', goal: 5, reward: { dust: 40, essence: 2 } },
      { id: 'd_gacha3', name: '운명 시험', desc: '뽑기 3회', track: 'gacha', goal: 3, reward: { rough: 15 } },
      { id: 'd_play3', name: '출정', desc: '3판 플레이 (5분 이상 생존)', track: 'play', goal: 3, reward: { gold: 1500, badge: 6 } },
    ],
    weekly: [
      { id: 'w_clear12', name: '주간 원정', desc: '스테이지 12회 클리어', track: 'clear', goal: 12, reward: { badge: 60, essence: 6 } },
      { id: 'w_raid3', name: '공격대의 위협', desc: '공격대 3회 클리어', track: 'raid', goal: 3, reward: { badge: 50, essence: 3 } },
      { id: 'w_endless10', name: '시간의 균열', desc: '엔드리스 10단계 도달', track: 'endless', goal: 10, reward: { rough: 80 } },
    ],
    dailyCount: 3,
  };

  // ---------- 위대한 금고 ----------
  // 주간 활동에 따라 칸이 열리고, 다음 주에 열린 칸 수만큼 선택지가 생긴다 (하나 선택)
  const VAULT = {
    rows: [
      { id: 'dungeon', name: '던전', track: 'dungeonClears', goals: [1, 4, 8] },
      { id: 'raid', name: '공격대', track: 'raidBosses', goals: [2, 4, 6] },
      { id: 'endless', name: '엔드리스', track: 'endlessRuns', goals: [1, 3, 6] },
    ],
    bonusIlvl: 6,
    exclusiveChance: 0.2,
  };
  // 주간/일일 경계 (KST). 서버 설정으로 바꿀 수 있게 상수로 둔다.
  const RESET = { tzOffsetH: 9, dailyHour: 6, weeklyDay: 4 /* 목요일 */, weeklyHour: 8 };
  const periodKeys = (now = Date.now()) => {
    const k = new Date(now + RESET.tzOffsetH * 3600000); // KST 기준 '벽시계'를 UTC 필드로 다룸
    const d = new Date(k); d.setUTCHours(d.getUTCHours() - RESET.dailyHour);
    const daily = d.toISOString().slice(0, 10);
    const w = new Date(k); w.setUTCHours(w.getUTCHours() - RESET.weeklyHour);
    const back = (w.getUTCDay() - RESET.weeklyDay + 7) % 7; w.setUTCDate(w.getUTCDate() - back);
    const weekly = w.toISOString().slice(0, 10);
    return { daily, weekly };
  };

  const ITEMS = {
    CURRENCIES, QUALITY, STATS, SECONDARY, SLOTS, SLOT, EQUIP, SUFFIXES, LEGENDARIES, VAULT_ITEMS,
    GEMS, GEM_COLORS, ENCHANTS, ENCHANT_BASE, GACHA, QUESTS, VAULT, RESET,
    diminish, derive, canEquip, canSocket, canEnchant, makeItem, itemTotals, sellPrice, disenchant, gachaRoll, gachaReward, periodKeys, weighted, pick,
    BAG_SIZE: 80,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = ITEMS;
  else root.G.ITEMS = ITEMS;
})(this);
