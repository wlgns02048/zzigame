'use strict';
// ================= 특성 (브라우저 · 서버 공용) =================
// 클래식 방식: 포인트를 골드로 사서 노드에 배분. 한 줄 아래로 내려가려면 그 트리에 (줄 × 5)점을 써야 한다.
//  - library: 계정 공용 '달라란 도서관' — 레벨업 선택지 자체를 바꾸는 로그라이크 특성
//  - mage / warlock: 캐릭터별 직업 특성
// stat(st, r): 판 시작 시 능력치에 적용 / skill(id, s, r): 주문 수치에 적용 / 나머지는 코드가 rank를 직접 읽는다.
(function (root) {
  const n = (id, name, icon, row, col, max, desc, extra = {}) => ({ id, name, icon, row, col, max, desc, ...extra });

  const LIBRARY = [
    n('reroll', '운명의 주사위', 'reroll', 0, 0, 3, r => `다시 굴리기 +${r}회`),
    n('pickup', '마력 끌어당김', 'pickup', 0, 1, 3, r => `획득 반경 +${r * 15}%`, { stat: (st, r) => (st.pickupMul += r * 0.15) }),
    n('xp', '대마법사의 지식', 'xp', 0, 2, 5, r => `경험치 획득 +${r * 5}%`, { stat: (st, r) => (st.xpMul += r * 0.05) }),
    n('autoCast', '자동 시전 숙련', 'autocast', 0, 3, 3, r => `자동 시전한 핵심 주문의 재사용 대기시간 증가 ${40 - r * 10}% (기본 40%)`),
    n('luck', '행운의 동전', 'luck', 1, 0, 3, r => `높은 등급 선택지 확률 +${r * 6}%, 골드 획득 +${r * 10}%`, { stat: (st, r) => (st.luck += r * 0.06) }),
    n('schoolAuto', '학파 연구: 자동 시전', 'schoolauto', 1, 1, 2, r => `자동 시전 주문 선택지 출현 +${r * 30}%`),
    n('schoolActive', '학파 연구: 핵심 주문', 'schoolactive', 1, 2, 2, r => `핵심 주문 선택지 출현 +${r * 30}%`),
    n('schoolPassive', '학파 연구: 능력치', 'schoolpassive', 1, 3, 2, r => `능력치 선택지 출현 +${r * 30}%`),
    n('scroll', '준비된 주문서', 'scroll', 2, 0, 1, () => '판 시작 시 무작위 자동 시전 주문 1개를 배운 상태로 시작'),
    n('banish', '추방', 'banish', 2, 1, 3, r => `판마다 선택지 ${r}개를 그 판에서 영구 제외할 수 있음`),
    n('seal', '봉인', 'seal', 2, 2, 1, () => '레벨업 선택지 하나를 다음 선택까지 보관할 수 있음'),
    n('speed', '바람의 걸음', 'speed', 2, 3, 3, r => `이동 속도 +${r * 4}%`, { stat: (st, r) => (st.speedMul += r * 0.04) }),
    n('treasure', '보물 사냥꾼', 'treasure', 3, 0, 2, r => `정예 출현 주기 -${r * 15}%` + (r >= 2 ? ', 전리품 상자 선택지 +1' : '')),
    n('legendCall', '전설의 부름', 'legendcall', 3, 1, 2, r => `전설 효과 출현 확률 +${r * 50}%`),
    n('revive', '영혼석', 'soulstone', 3, 2, 1, () => '판마다 1회 부활 (생명력 50%)'),
    n('wideVision', '넓어진 시야', 'widevision', 4, 1, 1, () => '레벨업 선택지 3개 → 4개', { req: 'reroll' }),
  ];

  const MAGE = [
    n('impFrostbolt', '얼음화살 연마', 'frostbolt', 0, 0, 5, r => `얼음화살 시전 시간 -${r * 3}%`, { skill: (id, s, r) => { if (id === 'frostbolt') s.cast *= 1 - r * 0.03; } }),
    n('elemPrecision', '원소 정밀함', 'elementalprecision', 0, 1, 3, r => `치명타 확률 +${r}%`, { stat: (st, r) => (st.crit += r * 0.01) }),
    n('iceShards', '얼음 파편', 'iceshards', 0, 2, 5, r => `치명타 피해 +${r * 6}%`, { stat: (st, r) => (st.critMul += r * 0.06) }),
    n('frostbite', '동상', 'frostbite', 1, 0, 3, r => `얼음화살 적중 시 빙결 확률 +${r * 3}%`, { skill: (id, s, r) => { if (id === 'frostbolt') s.freezeCh += r * 0.03; } }),
    n('impNova', '서리 회오리 연마', 'frostnova', 1, 1, 2, r => `서리 회오리 재사용 대기시간 -${r * 10}%`, { skill: (id, s, r) => { if (id === 'frostnova') s.cd *= 1 - r * 0.1; } }),
    n('permafrost', '영구 동토', 'permafrost', 1, 2, 3, r => `주문 지속시간 +${r * 5}%`, { stat: (st, r) => (st.dur += r * 0.05) }),
    n('piercingIce', '꿰뚫는 얼음', 'icelance', 2, 0, 3, r => `모든 주문 피해 +${r * 2}%`, { stat: (st, r) => (st.dmg += r * 0.02) }),
    n('arcticReach', '북극의 손길', 'arcticreach', 2, 1, 2, r => `주문 범위 +${r * 5}%`, { stat: (st, r) => (st.area += r * 0.05) }),
    n('impBlizzard', '눈보라 연마', 'improvedblizzard', 2, 2, 3, r => `눈보라 피해 +${r * 10}%`, { skill: (id, s, r) => { if (id === 'blizzard') s.dmg *= 1 + r * 0.1; } }),
    n('frostChanneling', '냉기 집중', 'frostchanneling', 3, 0, 2, r => `최대 고드름 +${r}`, { skill: (id, s, r) => { if (id === 'icicles') s.max += r; } }),
    n('shatter', '산산조각', 'shatter', 3, 1, 3, r => `얼어붙은 대상에 대한 치명타 확률 +${r * 5}%`, { stat: (st, r) => (st.shatterCrit += r * 0.05) }),
    n('wintersGrasp', '겨울의 손아귀', 'wintersgrasp', 3, 2, 3, r => `얼음창 피해 +${r * 8}%`, { skill: (id, s, r) => { if (id === 'icelance') s.dmg *= 1 + r * 0.08; } }),
    n('frostArmor', '향상된 서리 갑옷', 'frostarmor', 4, 0, 2, r => `받는 피해 -${r * 3}%`, { stat: (st, r) => (st.armor += r * 0.03) }),
    n('impCone', '냉기 돌풍 연마', 'coneofcold', 4, 1, 2, r => `냉기 돌풍 피해 +${r * 15}%`, { skill: (id, s, r) => { if (id === 'coneofcold') s.dmg *= 1 + r * 0.15; } }),
    n('iceBarrier', '얼음 보호막 숙련', 'icebarrier', 4, 2, 1, () => '판 시작 시 최대 생명력 30%의 보호막', { req: 'frostArmor' }),
    n('frostMastery', '냉기의 정수', 'winterschill', 5, 1, 1, () => '모든 주문 피해 +6%, 가속 +3%', { stat: st => { st.dmg += 0.06; st.haste += 0.03; } }),
  ];

  const WARLOCK = [
    n('suppression', '억제', 'suppression', 0, 0, 5, r => `지속 피해 +${r * 2}%`, { stat: (st, r) => (st.dotMul += r * 0.02) }),
    n('impCorruption', '향상된 부패', 'corruption', 0, 1, 5, r => `부패 피해 +${r * 6}%`, { skill: (id, s, r) => { if (id === 'corruption') s.dmg *= 1 + r * 0.06; } }),
    n('impShadowbolt', '어둠의 화살 연마', 'shadowbolt', 0, 2, 5, r => `어둠의 화살 시전 시간 -${r * 3}%`, { skill: (id, s, r) => { if (id === 'shadowbolt') s.cast *= 1 - r * 0.03; } }),
    n('impDrainLife', '향상된 생명력 흡수', 'drainlife', 1, 0, 2, r => `생명력 흡수 회복량 +${r * 15}%`, { skill: (id, s, r) => { if (id === 'drainlife') s.heal *= 1 + r * 0.15; } }),
    n('impAgony', '향상된 고통', 'agony', 1, 1, 3, r => `고통 피해 +${r * 8}%`, { skill: (id, s, r) => { if (id === 'agony') s.dmg *= 1 + r * 0.08; } }),
    n('amplifyCurse', '저주 증폭', 'amplifycurse', 1, 2, 1, () => '고통 최대 중첩 +3', { skill: (id, s) => { if (id === 'agony') s.maxStack += 3; } }),
    n('grimReach', '음산한 손길', 'grimreach', 2, 0, 2, r => `주문 범위 +${r * 5}%`, { stat: (st, r) => (st.area += r * 0.05) }),
    n('nightfallT', '해질녘 숙련', 'nightfall', 2, 1, 2, r => `해질녘 발동 확률 +${r * 2}%`, { stat: (st, r) => (st.nightfall += r * 0.02) }),
    n('felConcentration', '지옥 집중', 'felconcentration', 2, 2, 2, r => `이동 중 시전 속도 감소 -${r * 25}%`, { stat: (st, r) => (st.movePenalty *= 1 - r * 0.25) }),
    n('siphonLife', '영혼 흡수 숙련', 'soulleech', 3, 0, 2, r => `지속 피해의 ${r}%만큼 생명력 회복`, { stat: (st, r) => (st.dotLeech += r * 0.01) }),
    n('shadowMastery', '어둠의 숙련', 'shadowmastery', 3, 1, 5, r => `모든 주문 피해 +${r * 2}%`, { stat: (st, r) => (st.dmg += r * 0.02) }),
    n('demonArmor', '향상된 악마의 갑옷', 'demonarmor', 3, 2, 2, r => `받는 피해 -${r * 3}%`, { stat: (st, r) => (st.armor += r * 0.03) }),
    n('impShards', '영혼 착취', 'soulshard', 4, 0, 2, r => `영혼의 조각 최대 +${r}`, { stat: (st, r) => (st.shardMax += r) }),
    n('impUA', '향상된 불안정한 고통', 'unstableaffliction', 4, 1, 2, r => `불안정한 고통 피해 +${r * 15}%`, { skill: (id, s, r) => { if (id === 'unstableaffliction') s.dmg *= 1 + r * 0.15; } }),
    n('darkPact', '암흑의 서약', 'darkpact', 4, 2, 1, () => '판 시작 시 최대 생명력 30%의 보호막', { req: 'demonArmor' }),
    n('affMastery', '고통의 정수', 'shadowembrace', 5, 1, 1, () => '지속 피해 +8%, 가속 +3%', { stat: st => { st.dotMul += 0.08; st.haste += 0.03; } }),
  ];

  const TREES = {
    library: { name: '달라란 도서관', desc: '계정 공용 · 레벨업 선택지를 바꾸는 이 게임만의 특성', nodes: LIBRARY, maxPoints: 29, pointBase: 150, pointGrowth: 1.14 },
    mage: { name: '냉기 특성', desc: '냉기 마법사 직업 특성', nodes: MAGE, maxPoints: 31, pointBase: 80, pointGrowth: 1.12 },
    warlock: { name: '고통 특성', desc: '고통 흑마법사 직업 특성', nodes: WARLOCK, maxPoints: 31, pointBase: 80, pointGrowth: 1.12 },
  };
  const ROW_POINTS = 5;
  const TALENTS = {
    TREES, ROW_POINTS,
    node(tree, id) { return TREES[tree] && TREES[tree].nodes.find(x => x.id === id); },
    // n번째 포인트(0부터) 가격
    pointCost(tree, bought) { const t = TREES[tree]; return Math.round(t.pointBase * Math.pow(t.pointGrowth, bought)); },
    respecCost(resets) { return Math.min(1000, 100 * (resets + 1)); },
    spent(ranks) { let s = 0; for (const k in ranks) s += ranks[k]; return s; },
    // 배분이 규칙에 맞는지 (서버 검증 · UI 버튼 상태 공용). 맞으면 null, 아니면 이유
    validate(tree, ranks, bought) {
      const T = TREES[tree]; if (!T) return '알 수 없는 특성 트리입니다.';
      if (this.spent(ranks) > bought) return '포인트가 부족합니다.';
      // 줄 순서대로: 각 노드는 그 위 줄들에 쓴 포인트가 row*5 이상이어야 함
      for (const k in ranks) {
        const nd = this.node(tree, k); if (!nd) return '알 수 없는 특성입니다.';
        const r = ranks[k]; if (!(r >= 0 && r <= nd.max && Number.isInteger(r))) return '등급이 올바르지 않습니다.';
        if (!r) continue;
        let above = 0; for (const j in ranks) { const o = this.node(tree, j); if (o && o.row < nd.row) above += ranks[j]; }
        if (above < nd.row * ROW_POINTS) return `${nd.name}: 윗줄에 ${nd.row * ROW_POINTS}점이 필요합니다.`;
        if (nd.req) { const q = this.node(tree, nd.req); if ((ranks[nd.req] || 0) < q.max) return `${nd.name}: ${q.name}을(를) 먼저 모두 배워야 합니다.`; }
      }
      return null;
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TALENTS;
  else root.G.TALENTS = TALENTS;
})(this);
