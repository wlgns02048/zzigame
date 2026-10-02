'use strict';
// ================= 직업: 고통 흑마법사 =================
// 지속 피해(부패 · 고통 · 불안정한 고통)를 퍼뜨리고, 영혼의 조각을 모아 악의적인 환희로 터뜨린다.
// 주문 데이터 · 구현 · 직업 훅 · 그림을 이 파일에 모은다. (공통 도우미 D/N/P/node/dmgNode/cdNode는 data/skills.js)

// ---------- 지속 피해 시스템 (직업 공용) ----------
G.Dots = {
  // o: { dmg(틱당), dur, interval, src, stack, maxStack, ramp(틱마다 중첩 +1), onTick, color }
  apply(e, id, o) {
    if (e.dead) return null;
    e.dots ||= {};
    const d = e.dots[id];
    const dur = o.dur * G.player.stats.dur;
    if (d) { d.t = 0; d.dur = dur; d.dmg = o.dmg; if (o.addStack) d.stack = Math.min(d.maxStack || 99, d.stack + o.addStack); return d; }
    return (e.dots[id] = Object.assign({ stack: 1 }, o, { dur, t: 0, tickT: o.interval }));
  },
  has(e, id) { return !!(e.dots && e.dots[id]); },
  count(e) { return e.dots ? Object.keys(e.dots).length : 0; },
  tick(e, dt) {
    const p = G.player, st = p.stats, hs = 1 + G.P.haste();
    for (const id in e.dots) {
      const d = e.dots[id];
      d.t += dt; d.tickT -= dt * hs;
      if (d.tickT <= 0) {
        d.tickT += d.interval;
        if (d.ramp && d.stack < d.maxStack) d.stack++;
        const mul = st.dotMul * (e.haunted > G.t ? 1.25 : 1) * (1 + (e.embrace || 0) * 0.04);
        const dealt = G.hit(e, d.dmg * d.stack * mul, d.src, { school: 'shadow', small: true });
        if (st.dotLeech && dealt) G.P.healSilent(dealt * st.dotLeech);
        if (d.onTick) d.onTick(e, d);
        if (e.dead) return;
        if (Math.random() < 0.25) G.fx.part({ x: e.x + U.rand(-10, 10), y: e.y - U.rand(0, 20), vy: -40, life: 0.5, size: U.rand(5, 9), rgb: d.color || '150,60,220' });
      }
      if (d.t >= d.dur) delete e.dots[id];
    }
    if (!Object.keys(e.dots).length) e.dots = null;
  },
};

// ---------- 주문 데이터 ----------
Object.assign(G.SKILLS, {
  // ===== 자동 시전 =====
  shadowbolt: {
    cls: 'warlock', name: '어둠의 화살', icon: 'shadowbolt', kind: 'auto', school: 'shadow', color: '#a050ff',
    base: { dmg: 36, cast: 0.9, count: 1, pierce: 0, speed: 520, explode: 0, embrace: 0, slow: 0.3, proj: true },
    tip: s => `가장 가까운 적에게 어둠의 화살을 날려 ${D(s.dmg)}의 암흑 피해를 입히고 탈진의 저주로 ${P(s.slow)} 감속시킵니다.` + (s.count > 1 ? `<br>투사체 ${N(s.count, 0)}개` : '') +
      (s.pierce ? ` · 관통 ${N(s.pierce, 0)}` : '') + (s.explode ? '<br>적중 시 주변에 폭발' : '') + (s.embrace ? `<br>어둠의 포옹: 대상이 받는 지속 피해 +${s.embrace * 4}%` : ''),
    castInfo: s => `시전 시간 ${s.cast.toFixed(2)}초`,
    nodes: [
      node('count', '다중 시전', 4, '어둠의 화살 투사체 <b class="v">+1</b>', s => s.count++),
      node('cast', '어둠의 집중', 4, '시전 시간 <b class="v">-12%</b>', s => (s.cast *= 0.88)),
      node('dmg', '어둠의 숙련', 5, '피해 <b class="v">+30%</b>', s => (s.dmg *= 1.3), { icon: 'shadowmastery' }),
      node('pierce', '꿰뚫는 어둠', 3, '관통 <b class="v">+1</b>', s => s.pierce++),
      node('explode', '어둠의 폭발', 3, '적중 시 폭발하여 주변에 피해', s => s.explode++, { icon: 'shadowburn' }),
      node('embrace', '어둠의 포옹', 3, '적중 대상이 받는 지속 피해 <b class="v">+4%</b> (중첩)', s => s.embrace++, { icon: 'shadowembrace' }),
    ],
  },
  corruption: {
    cls: 'warlock', name: '부패', icon: 'corruption', kind: 'auto', school: 'shadow', color: '#9a40e0',
    base: { dmg: 12, cd: 1.4, targets: 4, dur: 12, interval: 1.5, spread: 0 },
    tip: s => `부패에 걸리지 않은 적 ${N(s.targets, 0)}명에게 부패를 겁니다. ${N(s.dur, 0)}초 동안 ${N(s.interval, 1)}초마다 ${D(s.dmg)}의 암흑 피해.` + (s.spread ? `<br>부패에 걸린 적이 죽으면 주변 ${N(s.spread, 0)}명에게 옮겨갑니다.` : ''),
    castInfo: s => `재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      node('targets', '확산', 4, '대상 <b class="v">+2</b>', s => (s.targets += 2), { icon: 'seedofcorruption' }),
      dmgNode(0.3, 5, '향상된 부패'),
      node('dur', '끈질긴 부패', 2, '지속시간 <b class="v">+4초</b>', s => (s.dur += 4), { icon: 'doom' }),
      node('spread', '전염', 3, '대상이 죽으면 주변 <b class="v">+2</b>명에게 옮겨감', s => (s.spread += 2), { icon: 'amplifycurse' }),
      cdNode(0.15, 2),
    ],
  },
  agony: {
    cls: 'warlock', name: '고통', icon: 'agony', kind: 'auto', school: 'shadow', color: '#c02080',
    base: { dmg: 4, cd: 2.5, targets: 3, dur: 18, interval: 2, maxStack: 10, shardCh: 0.06 },
    tip: s => `적 ${N(s.targets, 0)}명에게 고통을 겁니다. 2초마다 피해가 중첩되며(최대 ${N(s.maxStack, 0)}중첩) 중첩당 ${D(s.dmg)}의 피해. 틱마다 ${P(s.shardCh)} 확률로 영혼의 조각 생성.`,
    castInfo: s => `재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      node('targets', '저주의 손길', 4, '대상 <b class="v">+2</b>', s => (s.targets += 2), { icon: 'curseofweakness' }),
      dmgNode(0.3, 5, '향상된 고통'),
      node('stack', '고뇌', 3, '최대 중첩 <b class="v">+4</b>', s => (s.maxStack += 4), { icon: 'amplifycurse' }),
      node('shard', '영혼 착취', 3, '영혼의 조각 생성 확률 <b class="v">+3%</b>', s => (s.shardCh += 0.03), { icon: 'soulshard' }),
    ],
  },
  seedofcorruption: {
    cls: 'warlock', name: '부패의 씨앗', icon: 'seedofcorruption', kind: 'auto', school: 'shadow', color: '#7a2ab0',
    base: { dmg: 46, cd: 9, radius: 110, count: 1, delay: 3, corrupt: 0 },
    tip: s => `적이 가장 많은 곳의 적에게 씨앗을 심습니다. ${N(s.delay, 0)}초 뒤(또는 대상이 죽으면) 폭발해 주변에 ${D(s.dmg)}의 피해.` + (s.corrupt ? '<br>폭발한 적에게 부패를 겁니다.' : ''),
    castInfo: s => `재사용 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.3, 5), node('radius', '번지는 타락', 3, '폭발 범위 <b class="v">+20%</b>', s => (s.radius *= 1.2)), node('count', '씨앗 뿌리기', 3, '씨앗 <b class="v">+1</b>', s => s.count++),
      node('corrupt', '타락의 씨앗', 1, '폭발한 적에게 부패를 겁니다', s => (s.corrupt = 1), { icon: 'corruption' }), cdNode(0.15, 2)],
  },
  drainlife: {
    cls: 'warlock', name: '생명력 흡수', icon: 'drainlife', kind: 'auto', school: 'shadow', color: '#40e070',
    base: { dmg: 12, cd: 6, dur: 3, heal: 0.8, beams: 1 },
    tip: s => `가장 가까운 적과 연결해 ${N(s.dur, 0)}초 동안 0.5초마다 ${D(s.dmg)}의 피해를 입히고 피해의 ${P(s.heal)}만큼 생명력을 회복합니다. 이동을 방해하지 않습니다.`,
    castInfo: s => `재사용 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.3, 5), node('heal', '흡혈', 3, '회복 비율 <b class="v">+20%</b>', s => (s.heal += 0.2), { icon: 'soulleech' }), node('beams', '다중 흡수', 3, '연결 대상 <b class="v">+1</b>', s => s.beams++), cdNode(0.15, 2)],
  },
  rainoffire: {
    cls: 'warlock', name: '불의 비', icon: 'rainoffire', kind: 'auto', school: 'fire', color: '#ff7020',
    base: { dmg: 12, cd: 10, dur: 7, radius: 115, count: 1 },
    tip: s => `적이 가장 많은 곳에 ${N(s.dur, 0)}초 동안 불의 비를 내려 매초 ${D(s.dmg)}의 화염 피해.` + (s.count > 1 ? `<br>${N(s.count, 0)}곳` : ''),
    castInfo: s => `재사용 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.3, 5), node('radius', '불바다', 3, '범위 <b class="v">+15%</b>', s => (s.radius *= 1.15)), node('count', '화염 폭풍', 2, '불의 비 <b class="v">+1</b>곳', s => s.count++), cdNode(0.12, 3)],
  },
  imp: {
    cls: 'warlock', name: '임프 소환', icon: 'imp', kind: 'auto', school: 'fire', color: '#ff9030',
    base: { dmg: 14, atk: 1.1, count: 1 },
    tip: s => `임프 ${N(s.count, 0)}마리를 소환합니다. 임프는 ${N(s.atk, 1)}초마다 화염 화살로 ${D(s.dmg)}의 피해를 입힙니다.`,
    castInfo: () => '영구 소환',
    nodes: [node('count', '임프 무리', 3, '임프 <b class="v">+1</b>', s => s.count++), dmgNode(0.3, 5), node('atk', '불타는 성급함', 3, '공격 속도 <b class="v">+15%</b>', s => (s.atk *= 0.87))],
  },
  felhunter: {
    cls: 'warlock', name: '지옥사냥개 소환', icon: 'felhunter', kind: 'auto', school: 'shadow', color: '#5a9a40',
    base: { dmg: 22, atk: 0.9, count: 1, bite: 0 },
    tip: s => `지옥사냥개 ${N(s.count, 0)}마리를 소환합니다. 적에게 달려들어 ${N(s.atk, 1)}초마다 ${D(s.dmg)}의 피해를 입힙니다.` + (s.bite ? '<br>적의 지속 피해 수만큼 피해 +20%' : ''),
    castInfo: () => '영구 소환',
    nodes: [node('count', '사냥개 무리', 2, '지옥사냥개 <b class="v">+1</b>', s => s.count++), dmgNode(0.3, 5), node('bite', '마력 흡수', 1, '대상의 지속 피해 수만큼 피해 <b class="v">+20%</b>', s => (s.bite = 1))],
  },

  // ===== 단축키 주문 =====
  unstableaffliction: {
    cls: 'warlock', name: '불안정한 고통', icon: 'unstableaffliction', kind: 'active', key: 'Q', school: 'shadow', color: '#c060ff',
    base: { dmg: 28, cd: 8, targets: 3, dur: 8, interval: 1, burst: 0 },
    tip: s => `조준 방향에서 가장 가까운 적 ${N(s.targets, 0)}명에게 불안정한 고통을 겁니다. ${N(s.dur, 0)}초 동안 매초 ${D(s.dmg)}의 피해.` + (s.burst ? '<br>대상이 죽으면 주변에 폭발' : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('targets', '번지는 고통', 4, '대상 <b class="v">+2</b>', s => (s.targets += 2)), dmgNode(0.3, 5), node('burst', '폭발하는 고통', 1, '대상이 죽으면 주변에 피해', s => (s.burst = 1), { icon: 'hellfire' }), cdNode(0.15, 2)],
  },
  shadowfury: {
    cls: 'warlock', name: '어둠의 격노', icon: 'shadowfury', kind: 'active', key: 'E', school: 'shadow', color: '#8040ff',
    base: { dmg: 60, cd: 14, radius: 130, stun: 2.5 },
    tip: s => `마우스 위치(사거리 안)에 어둠의 격노를 일으켜 ${D(s.dmg)}의 피해를 입히고 ${N(s.stun, 1)}초 동안 기절시킵니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 5), node('radius', '확장', 3, '범위 <b class="v">+15%</b>', s => (s.radius *= 1.15)), node('stun', '마비', 2, '기절 <b class="v">+1초</b>', s => (s.stun += 1)), cdNode(0.15, 2)],
  },
  maleficrapture: {
    cls: 'warlock', name: '악의적인 환희', icon: 'maleficrapture', kind: 'active', key: 'R', school: 'shadow', color: '#e060ff', req: p => !!(p.skills.agony || p.skills.corruption),
    base: { dmg: 22, radius: 520 },
    tip: s => `영혼의 조각을 모두 소모해, 주변 모든 적에게 걸린 지속 피해 하나당 ${D(s.dmg)} × 조각 수의 피해를 입힙니다. 조각이 3개 이상이어야 사용할 수 있습니다.`,
    castInfo: () => '즉시 시전 · 영혼의 조각 3개 이상',
    nodes: [dmgNode(0.3, 5)],
  },
  fear: {
    cls: 'warlock', name: '공포의 울부짖음', icon: 'fear', kind: 'active', key: 'F', school: 'shadow', color: '#a040c0',
    base: { cd: 18, radius: 180, dur: 3, dmg: 10 },
    tip: s => `주변 적을 ${N(s.dur, 0)}초 동안 공포에 빠뜨려 도망치게 하고 ${D(s.dmg)}의 피해를 입힙니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('radius', '울려퍼지는 공포', 3, '범위 <b class="v">+15%</b>', s => (s.radius *= 1.15)), node('dur', '깊은 공포', 2, '지속 <b class="v">+1초</b>', s => (s.dur += 1)), cdNode(0.15, 2)],
  },
  haunt: {
    cls: 'warlock', name: '유령 출몰', icon: 'haunt', kind: 'active', key: 'T', school: 'shadow', color: '#6070ff',
    base: { dmg: 120, cd: 10, count: 1 },
    tip: s => `조준 방향의 적에게 유령을 보내 ${D(s.dmg)}의 피해를 입히고, 10초 동안 그 적이 받는 지속 피해를 25% 늘립니다. 대상이 죽으면 재사용 대기시간 초기화.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.35, 5), node('count', '유령 무리', 2, '유령 <b class="v">+1</b>', s => s.count++), cdNode(0.15, 2)],
  },
  demoniccircle: {
    cls: 'warlock', name: '악마의 마법진', icon: 'demoniccircle', kind: 'active', key: 'SPACE', school: 'shadow', color: '#80ff80',
    base: { cd: 10, charges: 1 },
    tip: () => '처음 사용하면 발밑에 마법진을 그립니다. 다시 사용하면 마법진으로 순간이동합니다.',
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('charges', '이중 마법진', 1, '충전 <b class="v">+1</b>', s => (s.charges = 2)), cdNode(0.2, 2)],
  },
  darksoul: {
    cls: 'warlock', name: '어둠의 영혼: 불행', icon: 'darksoul', kind: 'active', key: '1', school: 'shadow', color: '#c040ff',
    base: { cd: 75, dur: 15, haste: 0.3, dot: 0.2 },
    tip: s => `${N(s.dur, 0)}초 동안 가속 ${P(s.haste)}, 지속 피해 ${P(s.dot)} 증가.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('dur', '오래가는 어둠', 2, '지속시간 <b class="v">+5초</b>', s => (s.dur += 5)), node('dot', '불행', 2, '지속 피해 <b class="v">+10%</b>', s => (s.dot += 0.1)), cdNode(0.15, 2)],
  },
  unendingresolve: {
    cls: 'warlock', name: '불굴의 의지', icon: 'unendingresolve', kind: 'active', key: '2', school: 'shadow', color: '#e0c060',
    base: { cd: 40, dur: 8, dr: 0.4 },
    tip: s => `${N(s.dur, 0)}초 동안 받는 피해 ${P(s.dr)} 감소.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('dr', '강철 의지', 2, '피해 감소 <b class="v">+10%</b>', s => (s.dr += 0.1)), cdNode(0.15, 2)],
  },
  healthstone: {
    cls: 'warlock', name: '생명석', icon: 'healthstone', kind: 'active', key: '3', school: 'shadow', color: '#60ff60',
    base: { cd: 60, heal: 0.4, charges: 1 },
    tip: s => `생명력을 ${P(s.heal)} 회복합니다.`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('charges', '생명석 꾸러미', 1, '충전 <b class="v">+1</b>', s => (s.charges = 2)), node('heal', '향상된 생명석', 2, '회복 <b class="v">+10%</b>', s => (s.heal += 0.1))],
  },
  deathcoil: {
    cls: 'warlock', name: '죽음의 고리', icon: 'deathcoil', kind: 'active', key: '4', school: 'shadow', color: '#40c060',
    base: { dmg: 70, cd: 12, heal: 0.15, horror: 2 },
    tip: s => `조준 방향에 죽음의 고리를 날려 ${D(s.dmg)}의 피해를 입히고 ${N(s.horror, 0)}초 동안 공포에 빠뜨리며, 생명력을 ${P(s.heal)} 회복합니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 4), node('heal', '죽음의 서약', 2, '회복 <b class="v">+5%</b>', s => (s.heal += 0.05)), cdNode(0.15, 2)],
  },
  voidwalker: {
    cls: 'warlock', name: '공허방랑자 소환', icon: 'voidwalker', kind: 'active', key: '5', school: 'shadow', color: '#6080ff',
    base: { cd: 45, dur: 15, hp: 300, dmg: 10 },
    tip: s => `${N(s.dur, 0)}초 동안 공허방랑자를 소환합니다. 적의 주의를 끌고(생명력 ${N(s.hp, 0)}) 주변에 ${D(s.dmg)}의 피해를 줍니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('hp', '공허의 갑옷', 3, '생명력 <b class="v">+40%</b>', s => (s.hp *= 1.4)), node('dur', '오래 머무는 공허', 2, '지속시간 <b class="v">+5초</b>', s => (s.dur += 5)), cdNode(0.15, 2)],
  },
  inferno: {
    cls: 'warlock', name: '지옥불정령 소환', icon: 'inferno', kind: 'active', key: '6', school: 'fire', color: '#60ff40',
    base: { cd: 90, dur: 20, dmg: 80, radius: 150, stun: 2, aura: 14 },
    tip: s => `마우스 위치에 지옥불정령을 떨어뜨려 ${D(s.dmg)}의 피해와 ${N(s.stun, 0)}초 기절. 지옥불정령은 ${N(s.dur, 0)}초 동안 주변에 매초 ${D(s.aura)}의 화염 피해.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 4), node('dur', '불지옥', 2, '지속시간 <b class="v">+5초</b>', s => (s.dur += 5)), cdNode(0.15, 2)],
  },

  // ===== 흑마법사 전용 능력치 =====
  nightfall: {
    cls: 'warlock', name: '해질녘', icon: 'nightfall', kind: 'passive', max: 3, val: 6, unit: '%', fixed: true, req: p => !!(p.skills.corruption && p.skills.shadowbolt),
    desc: v => `부패 피해 시 ${v}% 확률로 발동: 다음 어둠의 화살이 즉시 시전되며 피해 +50%`, apply: (st, v) => (st.nightfall += v / 100),
  },
  demonarmor: { cls: 'warlock', name: '악마의 갑옷', icon: 'demonarmor', kind: 'passive', max: 5, val: 6, unit: '%', desc: v => `받는 피해 -${v}%`, apply: (st, v) => (st.armor += v / 100) },
  siphonlifeP: { cls: 'warlock', name: '생명력 착취', icon: 'siphonlife', kind: 'passive', max: 3, val: 2, unit: '%', desc: v => `지속 피해의 ${v}%만큼 생명력 회복`, apply: (st, v) => (st.dotLeech += v / 100) },
  shadowembraceP: { cls: 'warlock', name: '악의', icon: 'shadowembrace', kind: 'passive', max: 5, val: 8, unit: '%', desc: v => `지속 피해 +${v}%`, apply: (st, v) => (st.dotMul += v / 100) },
  soulharvest: { cls: 'warlock', name: '영혼 수확', icon: 'soulshard', kind: 'passive', max: 2, val: 1, unit: '', fixed: true, rarity: 3, desc: () => '영혼의 조각 최대 +1, 적 처치 시 2% 확률로 영혼의 조각', apply: st => { st.shardMax += 1; st.shardOnKill = 0.02; } },

  // ===== 전설 =====
  eternalagony: { cls: 'warlock', name: '영원한 고뇌', icon: 'agony', kind: 'legendary', req: p => !!p.skills.agony, desc: () => '고통 최대 중첩 +5, 고통 피해 +40%.' },
  corruptspring: { cls: 'warlock', name: '타락의 원천', icon: 'corruption', kind: 'legendary', req: p => !!p.skills.corruption, desc: () => '부패에 걸린 적이 죽으면 주변 3명에게 부패가 옮겨갑니다.' },
  demonbond: { cls: 'warlock', name: '악마의 결속', icon: 'imp', kind: 'legendary', req: p => !!(p.skills.imp || p.skills.felhunter), desc: () => '임프 · 지옥사냥개 +1마리, 소환수 피해 +50%.' },
  darkharvest: { cls: 'warlock', name: '어둠의 수확', icon: 'drainsoul', kind: 'legendary', desc: () => '치명타 피해 +25%. 적 처치 시 3% 확률로 영혼의 조각을 얻습니다.' },

  // ===== 진화 =====
  chaosbolt: {
    cls: 'warlock', name: '혼돈의 화살', icon: 'chaosbolt', kind: 'evolution', target: 'shadowbolt',
    req: p => p.skills.shadowbolt && p.skillLevel('shadowbolt') >= 8 && p.skills.darksoul, reqText: '어둠의 화살 8레벨 + 어둠의 영혼',
    desc: () => '<b>영웅 특성: 혼돈</b><br>어둠의 화살이 혼돈의 화살로 진화합니다. 피해 +80%, 항상 치명타, 관통 +3.',
  },
  soulrot: {
    cls: 'warlock', name: '영혼 부식', icon: 'siphonlife', kind: 'evolution', target: 'agony',
    req: p => p.skills.agony && p.skillLevel('agony') >= 5 && p.passives.shadowembraceP, reqText: '고통 5레벨 + 악의',
    desc: () => '<b>영웅 특성: 영혼 수확자</b><br>고통이 모든 적에게 자동으로 퍼지고, 고통 중첩이 두 배로 쌓입니다.',
  },
});
for (const id in G.SKILLS) G.SKILLS[id].id = id;
Object.assign(G.SOURCES, {
  shadowbolt: ['어둠의 화살', 'shadowbolt', '#a050ff'], chaosbolt: ['혼돈의 화살', 'chaosbolt', '#60ff40'], corruption: ['부패', 'corruption', '#9a40e0'],
  agony: ['고통', 'agony', '#c02080'], seedofcorruption: ['부패의 씨앗', 'seedofcorruption', '#7a2ab0'], drainlife: ['생명력 흡수', 'drainlife', '#40e070'],
  rainoffire: ['불의 비', 'rainoffire', '#ff7020'], imp: ['임프', 'imp', '#ff9030'], felhunter: ['지옥사냥개', 'felhunter', '#5a9a40'],
  unstableaffliction: ['불안정한 고통', 'unstableaffliction', '#c060ff'], shadowfury: ['어둠의 격노', 'shadowfury', '#8040ff'],
  maleficrapture: ['악의적인 환희', 'maleficrapture', '#e060ff'], fear: ['공포의 울부짖음', 'fear', '#a040c0'], haunt: ['유령 출몰', 'haunt', '#6070ff'],
  deathcoil: ['죽음의 고리', 'deathcoil', '#40c060'], voidwalker: ['공허방랑자', 'voidwalker', '#6080ff'], inferno: ['지옥불정령', 'inferno', '#60ff40'],
  uaburst: ['불안정한 고통 폭발', 'hellfire', '#c060ff'],
});

// ---------- 구현 ----------
const W = () => G.player;
const addShard = n => { const p = W(); const was = p.shards; p.shards = Math.min(p.shardMax, p.shards + n); if (p.shards > was) { G.fx.text(p.x, p.y - 44, '영혼의 조각', '#e080ff', 13); G.Audio.play('tick', 0.5); } };
const corruptionOpts = s => ({ dmg: s.dmg, dur: s.dur, interval: s.interval, src: 'corruption', color: '150,60,220',
  onTick: (e) => { const p = W(); if (p.stats.nightfall && Math.random() < p.stats.nightfall) { p.nightfall = 1; p.nfT = 12; } } });
const agonyOpts = (s, p) => ({ dmg: s.dmg * (p.legend.eternalagony ? 1.4 : 1), dur: s.dur, interval: s.interval, src: 'agony', ramp: true, maxStack: s.maxStack + (p.legend.eternalagony ? 5 : 0), color: '200,40,140',
  // 조각 생성은 대상 수와 상관없이 2초에 한 번까지 (적이 많을 때 무한히 차지 않도록)
  onTick: (e, d) => { if (p.evo.soulrot && d.stack < d.maxStack) d.stack++; if (G.t >= (p.shardICD || 0) && Math.random() < s.shardCh * 4) { p.shardICD = G.t + 2; addShard(1); } } });

Object.assign(G.SKILL_IMPL, {
  shadowbolt: {
    update(sk, dt, busy) {
      const p = W(), s = sk.s;
      if (busy) { sk.castT = 0; return; }
      const pen = p.moving ? p.stats.movePenalty : 0;
      const speed = p.nightfall ? 6 : 1; // 해질녘: 즉시 시전
      sk.castT = Math.min(1, sk.castT + dt * (1 + G.P.haste()) * (1 - pen) * speed / s.cast);
      if (sk.castT < 1) return;
      const tg = nearestN(p.x, p.y, s.count, 640);
      if (!tg.length) return;
      sk.castT = 0;
      const nf = p.nightfall ? 1.5 : 1; p.nightfall = 0;
      const cb = !!s.cb, src = cb ? 'chaosbolt' : 'shadowbolt';
      for (let i = 0; i < s.count; i++) {
        const t = tg[i % tg.length];
        G.Proj.spawn({
          x: p.x + p.face * 14, y: p.y - 24, a: Math.atan2(t.y - p.y, t.x - p.x) + (i >= tg.length ? (i - tg.length + 1) * 0.15 : 0), speed: s.speed, r: 9, kind: cb ? 'chaos' : 'shadowbolt', homing: t, turn: 3.5, src, life: 1.8, pierce: s.pierce + (cb ? 3 : 0), scale: cb ? 1.3 : 1,
          onHit: e => {
            const dealt = G.hit(e, s.dmg * nf, src, { school: cb ? 'fire' : 'shadow', crit: cb ? 1 : 0 });
            G.P.healSilent(dealt * 0.03); // 영혼 흡수
            G.chill(e, s.slow, 2);
            if (s.embrace) e.embrace = Math.min(5, (e.embrace || 0) + s.embrace * 0.34);
            if (s.explode) { const R = (25 + 18 * s.explode) * p.stats.area; G.Grid.query(e.x, e.y, R).forEach(o => { if (o !== e) G.hit(o, s.dmg * 0.4, src, { noText: true }); }); G.fx.ring(e.x, e.y, 5, R, 0.3, '170,90,255', 3, 0.2); }
            G.fx.burst(e.x, e.y, 8, { rgb: cb ? '120,255,80' : '170,90,255', sp: 130, size: 10 });
            G.Audio.play('hit', 0.5);
          },
        });
      }
      G.Audio.play('shadow', 0.45);
    },
  },
  corruption: {
    auto(sk) {
      const p = W(), s = sk.s;
      const tg = nearestN(p.x, p.y, s.targets, 560, e => !G.Dots.has(e, 'corruption')).filter(e => !G.Dots.has(e, 'corruption'));
      if (!tg.length) return false;
      for (const e of tg) { G.Dots.apply(e, 'corruption', corruptionOpts(s)); G.fx.burst(e.x, e.y - 10, 5, { rgb: '150,60,220', sp: 60, size: 8 }); }
      return true;
    },
  },
  agony: {
    auto(sk) {
      const p = W(), s = sk.s, n = p.evo.soulrot ? 999 : s.targets;
      const tg = nearestN(p.x, p.y, n, p.evo.soulrot ? 700 : 560, e => !G.Dots.has(e, 'agony')).filter(e => !G.Dots.has(e, 'agony'));
      if (!tg.length) return false;
      for (const e of tg) G.Dots.apply(e, 'agony', agonyOpts(s, p));
      return true;
    },
  },
  seedofcorruption: {
    auto(sk) {
      const p = W(), s = sk.s;
      let made = 0;
      for (let k = 0; k < s.count; k++) {
        const d = G.densestPoint(p.x, p.y, 520, 90), e = d && G.nearestEnemy(d.x, d.y, 120, o => !o.seed);
        if (!e) break;
        e.seed = true; made++;
        const R = s.radius * p.stats.area;
        const boom = () => {
          if (e.seedDone) return; e.seedDone = true;
          G.aoe(e.x, e.y, R, s.dmg, 'seedofcorruption', { school: 'shadow' }, o => { if (s.corrupt && p.skills.corruption) G.Dots.apply(o, 'corruption', corruptionOpts(p.skills.corruption.s)); });
          G.fx.ring(e.x, e.y, 5, R, 0.4, '150,60,220', 6, 0.3); G.fx.burst(e.x, e.y, 24, { rgb: '150,60,220', sp: 220, size: 12 }); G.Audio.play('explode', 0.5);
        };
        e.onDeath = boom;
        G.later(s.delay, boom);
      }
      return made > 0;
    },
  },
  drainlife: {
    auto(sk) {
      const p = W(), s = sk.s;
      const tg = nearestN(p.x, p.y, s.beams, 360);
      if (!tg.length) return false;
      p.drains = tg.map(e => ({ e, t: 0, tickT: 0.5 }));
      p.drainDur = s.dur;
      return true;
    },
  },
  rainoffire: {
    auto(sk) {
      const p = W(), s = sk.s, R = s.radius * p.stats.area;
      const pts = [];
      for (let k = 0; k < s.count; k++) {
        const d = G.densestPoint(p.x + (k ? U.rand(-200, 200) : 0), p.y + (k ? U.rand(-200, 200) : 0), 520, R);
        if (d) pts.push(d);
      }
      if (!pts.length) return false;
      for (const pt of pts) G.Zones.add({ kind: 'rainoffire', x: pt.x, y: pt.y, r: R, life: s.dur * p.stats.dur, tick: 1, tickT: 0.3, onTick: z => G.aoe(z.x, z.y, z.r, s.dmg, 'rainoffire', { school: 'fire' }) });
      return true;
    },
  },
  imp: {}, felhunter: {},

  unstableaffliction: {
    cast(sk) {
      const p = W(), s = sk.s, a = aimAngle();
      const cx = p.x + Math.cos(a) * 200, cy = p.y + Math.sin(a) * 200;
      const tg = nearestN(cx, cy, s.targets, 400);
      if (!tg.length) { G.UI.error('대상이 없습니다.'); return false; }
      for (const e of tg) {
        G.Dots.apply(e, 'ua', { dmg: s.dmg, dur: s.dur, interval: s.interval, src: 'unstableaffliction', color: '200,100,255' });
        if (s.burst) e.onDeath = () => { G.aoe(e.x, e.y, 90 * p.stats.area, s.dmg * 2, 'uaburst'); G.fx.ring(e.x, e.y, 5, 90, 0.35, '200,100,255', 5, 0.2); };
        G.fx.burst(e.x, e.y - 10, 10, { rgb: '200,100,255', sp: 120, size: 10 });
      }
      G.Audio.play('shadow', 0.6);
    },
  },
  shadowfury: {
    cast(sk) {
      const p = W(), s = sk.s, a = aimAngle(), d = Math.min(300, Math.hypot(G.mouse.x - p.x, G.mouse.y - p.y));
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, R = s.radius * p.stats.area;
      G.aoe(x, y, R, s.dmg, 'shadowfury', { school: 'shadow' }, e => { if (!e.boss) e.stunT = Math.max(e.stunT || 0, s.stun * (e.elite ? 0.5 : 1)); });
      G.fx.ring(x, y, 5, R, 0.4, '130,70,255', 8, 0.35); G.fx.burst(x, y, 40, { rgb: '130,70,255', sp: 260, size: 12 }); G.fx.shake(5);
      G.Audio.play('explode', 0.6);
    },
  },
  maleficrapture: {
    usable() { return W().shards >= 3; },
    cast(sk) {
      const p = W(), s = sk.s, n = p.shards;
      p.shards = 0;
      let hits = 0;
      for (const e of G.Grid.query(p.x, p.y, s.radius)) {
        const c = G.Dots.count(e); if (!c) continue;
        G.hit(e, s.dmg * c * n, 'maleficrapture', { school: 'shadow' });
        G.fx.burst(e.x, e.y - 10, 6, { rgb: '230,100,255', sp: 140, size: 10 }); hits++;
      }
      G.fx.ring(p.x, p.y, 10, s.radius, 0.5, '230,100,255', 4, 0.1);
      G.Audio.play('shatter', 0.7);
      if (!hits) G.UI.error('지속 피해가 걸린 적이 없습니다.');
    },
  },
  fear: {
    cast(sk) {
      const p = W(), s = sk.s, R = s.radius * p.stats.area;
      G.aoe(p.x, p.y, R, s.dmg, 'fear', { school: 'shadow' }, e => { if (!e.boss) e.fearT = s.dur * (e.elite ? 0.5 : 1); });
      G.fx.ring(p.x, p.y, 10, R, 0.5, '170,70,200', 6, 0.2); G.Audio.play('shadow');
    },
  },
  haunt: {
    cast(sk) {
      const p = W(), s = sk.s, a = aimAngle();
      const tg = nearestN(p.x + Math.cos(a) * 220, p.y + Math.sin(a) * 220, s.count, 520);
      if (!tg.length) { G.UI.error('대상이 없습니다.'); return false; }
      tg.forEach((t, i) => G.Proj.spawn({
        x: p.x, y: p.y - 20, a: a + (i - (tg.length - 1) / 2) * 0.3, speed: 420, r: 10, kind: 'haunt', homing: t, turn: 6, src: 'haunt', life: 2.4,
        onHit: e => {
          G.hit(e, s.dmg, 'haunt', { school: 'shadow' }); e.haunted = G.t + 10;
          G.fx.burst(e.x, e.y, 14, { rgb: '120,140,255', sp: 160, size: 12 });
          if (e.dead) G.Skills.resetCd(sk);
        },
      }));
      G.Audio.play('shadow', 0.6);
    },
  },
  demoniccircle: {
    cast(sk) {
      const p = W();
      if (!p.circle) { p.circle = { x: p.x, y: p.y }; G.fx.ring(p.x, p.y, 5, 40, 0.5, '120,255,120', 4); G.Audio.play('buff', 0.5); sk.charges++; return; }
      G.fx.burst(p.x, p.y, 20, { rgb: '120,255,120', sp: 160, size: 10 });
      p.x = p.circle.x; p.y = p.circle.y;
      G.fx.burst(p.x, p.y, 20, { rgb: '120,255,120', sp: 160, size: 10 });
      G.Audio.play('blink');
    },
  },
  darksoul: {
    cast(sk) { const p = W(); p.dsT = sk.s.dur * p.stats.dur; G.P.recalc(); G.fx.burst(p.x, p.y, 30, { rgb: '190,70,255', sp: 180, size: 12 }); G.Audio.play('buff'); },
  },
  unendingresolve: {
    cast(sk) { const p = W(); p.drT = sk.s.dur; p.dr = sk.s.dr; G.fx.ring(p.x, p.y, 10, 60, 0.5, '230,200,100', 5); G.Audio.play('buff'); },
  },
  healthstone: {
    usable() { const p = W(); return p.hp < p.maxHp; },
    cast(sk) { const p = W(); G.P.heal(p.maxHp * sk.s.heal); G.fx.burst(p.x, p.y, 20, { rgb: '100,255,100', sp: 120, size: 10 }); G.Audio.play('buff', 0.6); },
  },
  deathcoil: {
    cast(sk) {
      const p = W(), s = sk.s, a = aimAngle();
      G.Proj.spawn({ x: p.x, y: p.y - 20, a, speed: 560, r: 12, kind: 'deathcoil', src: 'deathcoil', life: 1.2, pierce: 0,
        onHit: e => { G.hit(e, s.dmg, 'deathcoil', { school: 'shadow' }); if (!e.boss) e.fearT = s.horror; G.P.heal(p.maxHp * s.heal); G.fx.burst(e.x, e.y, 12, { rgb: '80,220,100', sp: 140, size: 10 }); } });
      G.Audio.play('shadow', 0.7);
    },
  },
  voidwalker: {
    cast(sk) {
      const p = W(), s = sk.s;
      G.images.push({ kind: 'voidwalker', x: p.x + 40, y: p.y, t: 0, life: s.dur * p.stats.dur, hp: s.hp, maxHp: s.hp, atkT: 1, face: 1, dmg: s.dmg,
        update: voidwalkerAI, draw: (c, im) => drawDemon(c, im, 'voidwalker') });
      G.fx.burst(p.x + 40, p.y, 30, { rgb: '100,120,255', sp: 160, size: 12 }); G.Audio.play('buff', 0.6);
    },
  },
  inferno: {
    cast(sk) {
      const p = W(), s = sk.s, a = aimAngle(), d = Math.min(320, Math.hypot(G.mouse.x - p.x, G.mouse.y - p.y));
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d, R = s.radius * p.stats.area;
      G.Tele.add({ x, y, r: R, max: 0.6, color: '120,255,60', onBoom: () => {
        G.aoe(x, y, R, s.dmg, 'inferno', { school: 'fire' }, e => { if (!e.boss) e.stunT = Math.max(e.stunT || 0, s.stun); });
        G.fx.ring(x, y, 5, R, 0.5, '120,255,60', 8, 0.3); G.fx.burst(x, y, 50, { rgb: '120,255,60', sp: 300, size: 14 }); G.fx.shake(10); G.Audio.play('explode');
        W().infernal = { x, y, t: 0, life: s.dur * p.stats.dur, tickT: 1, aura: s.aura };
      } });
    },
  },
});

function voidwalkerAI(im, dt) {
  const p = W();
  im.t += dt; im.life -= dt;
  const tgt = G.nearestEnemy(im.x, im.y, 300);
  const tx = tgt ? tgt.x : p.x + 50, ty = tgt ? tgt.y : p.y;
  const dx = tx - im.x, dy = ty - im.y, d = Math.hypot(dx, dy) || 1;
  if (d > 30) { im.x += dx / d * 150 * dt; im.y += dy / d * 150 * dt; }
  im.face = dx > 0 ? 1 : -1;
  im.atkT -= dt;
  if (im.atkT <= 0) { im.atkT = 1; G.aoe(im.x, im.y, 70, im.dmg, 'voidwalker', { school: 'shadow', noText: true }); }
}

// 소환수 (임프 · 지옥사냥개 · 지옥불정령) — 매 프레임
function updateDemons(p, dt) {
  const imp = p.skills.imp, fh = p.skills.felhunter, bond = p.legend.demonbond ? 1 : 0, pm = bond ? 1.5 : 1;
  const want = { imp: imp ? imp.s.count + bond : 0, felhunter: fh ? fh.s.count + bond : 0 };
  for (const kind of ['imp', 'felhunter']) {
    while (p.demons.filter(q => q.kind === kind).length < want[kind]) {
      p.demons.push({ kind, x: p.x - 30, y: p.y + 10, t: Math.random() * 6, atkT: 1, face: 1, idx: p.demons.length });
      G.fx.burst(p.x - 30, p.y, 16, { rgb: kind === 'imp' ? '255,140,40' : '120,200,80', sp: 140, size: 10 });
    }
  }
  const hs = 1 + G.P.haste();
  for (const q of p.demons) {
    q.t += dt; q.atkT -= dt * hs;
    if (q.kind === 'imp') {
      const ang = q.idx * 2.1 + q.t * 0.4, tx = p.x + Math.cos(ang) * 60, ty = p.y + Math.sin(ang) * 34 - 12;
      q.x += (tx - q.x) * Math.min(1, dt * 4); q.y += (ty - q.y) * Math.min(1, dt * 4);
      const tgt = G.nearestEnemy(q.x, q.y, 480);
      if (tgt) {
        q.face = tgt.x > q.x ? 1 : -1;
        if (q.atkT <= 0) {
          q.atkT = imp.s.atk;
          G.Proj.spawn({ x: q.x, y: q.y - 8, a: Math.atan2(tgt.y - q.y, tgt.x - q.x), speed: 460, r: 7, kind: 'firebolt', homing: tgt, turn: 6, src: 'imp', life: 1.4,
            onHit: e => { G.hit(e, imp.s.dmg * pm, 'imp', { school: 'fire', noText: true }); G.fx.burst(e.x, e.y, 4, { rgb: '255,140,40', sp: 80, size: 7 }); } });
        }
      }
    } else {
      const tgt = G.nearestEnemy(q.x, q.y, 420) ;
      const tx = tgt ? tgt.x : p.x - 40, ty = tgt ? tgt.y : p.y + 20;
      const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy) || 1;
      if (d > (tgt ? tgt.r + 8 : 30)) { const sp = tgt ? 260 : 200; q.x += dx / d * sp * dt; q.y += dy / d * sp * dt; }
      q.face = dx > 0 ? 1 : -1;
      if (tgt && d < tgt.r + 16 && q.atkT <= 0) {
        q.atkT = fh.s.atk;
        const bonus = fh.s.bite ? 1 + 0.2 * G.Dots.count(tgt) : 1;
        G.hit(tgt, fh.s.dmg * pm * bonus, 'felhunter', { school: 'shadow', noText: true });
        G.fx.burst(tgt.x, tgt.y, 5, { rgb: '120,200,80', sp: 90, size: 8 });
      }
    }
  }
  // 지옥불정령
  const inf = p.infernal;
  if (inf) {
    inf.t += dt; inf.life -= dt; inf.tickT -= dt;
    const tgt = G.nearestEnemy(inf.x, inf.y, 500);
    if (tgt) { const dx = tgt.x - inf.x, dy = tgt.y - inf.y, d = Math.hypot(dx, dy) || 1; if (d > 40) { inf.x += dx / d * 120 * dt; inf.y += dy / d * 120 * dt; } }
    if (inf.tickT <= 0) { inf.tickT = 1; G.aoe(inf.x, inf.y, 110 * p.stats.area, inf.aura, 'inferno', { school: 'fire', noText: true }); }
    if (inf.life <= 0) { G.fx.burst(inf.x, inf.y, 30, { rgb: '120,255,60', sp: 200, size: 12 }); p.infernal = null; }
  }
  // 생명력 흡수 줄기
  if (p.drains) {
    const s = p.skills.drainlife && p.skills.drainlife.s;
    p.drainDur -= dt;
    for (const d of p.drains) {
      if (d.e.dead || U.d2(p.x, p.y, d.e.x, d.e.y) > 420 * 420) { d.done = true; continue; }
      d.tickT -= dt * hs;
      if (d.tickT <= 0) { d.tickT = 0.5; const dealt = G.hit(d.e, s.dmg, 'drainlife', { school: 'shadow', noText: true }); G.P.healSilent(dealt * s.heal / p.stats.dmg); }
    }
    p.drains = p.drains.filter(d => !d.done);
    if (p.drainDur <= 0 || !p.drains.length || !s) p.drains = null;
  }
}

// ---------- 그림 ----------
function drawWarlockSprite(x) {
  // 로브
  poly(x, [[22, 26], [42, 26], [50, 66], [14, 66]], lg(x, 0, 26, 0, 66, [[0, '#5a2a7a'], [0.5, '#3a1452'], [1, '#1c0828']]));
  poly(x, [[14, 66], [50, 66], [49, 62], [15, 62]], '#5aff6a');
  line(x, 32, 30, 32, 62, '#3a8a3a', 2);
  poly(x, [[21, 42], [43, 42], [44, 46], [20, 46]], '#2a2a2a', '#000');
  ell(x, 32, 44, 2.6, 2.6, '#80ff60');
  // 어깨 해골
  ell(x, 18, 28, 6, 5.5, '#d8d0b8'); ell(x, 46, 28, 6, 5.5, '#d8d0b8');
  ell(x, 17, 28, 1.3, 1.3, '#3a1a1a'); ell(x, 20, 28, 1.3, 1.3, '#3a1a1a'); ell(x, 45, 28, 1.3, 1.3, '#3a1a1a'); ell(x, 48, 28, 1.3, 1.3, '#3a1a1a');
  // 뿔 달린 두건
  ell(x, 32, 19, 10, 11, '#3a1452');
  poly(x, [[24, 12], [16, 0], [27, 9]], '#c8c0a8'); poly(x, [[40, 12], [48, 0], [37, 9]], '#c8c0a8');
  ell(x, 34, 21, 6.5, 7.5, '#0a0410');
  eyes(x, [[33, 21], [37, 21.5]], '#60ff60', 1.4);
  // 지팡이 (해골)
  line(x, 48, 14, 45, 70, '#2a1a10', 3.2);
  ell(x, 48, 10, 5, 5.5, '#d8d0b8'); ell(x, 47, 9, 1.2, 1.2, '#60ff60'); ell(x, 50, 9, 1.2, 1.2, '#60ff60');
  ell(x, 46, 40, 3.2, 3.2, '#c8a890');
}
function drawDemon(c, q, kind) {
  const x = q.x, y = q.y + Math.sin(q.t * 3) * 2;
  c.save(); c.translate(x, y); if (q.face < 0) c.scale(-1, 1);
  if (kind === 'imp') {
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5; c.drawImage(G.Spr.glow('255,120,30', 64), -20, -36, 40, 40); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#c84a1a'; c.beginPath(); c.ellipse(0, -8, 7, 9, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(1, -20, 6, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#ffd040'; c.fillRect(2, -22, 2, 2);
    c.strokeStyle = '#e0c080'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-3, -24); c.lineTo(-6, -30); c.moveTo(3, -25); c.lineTo(5, -31); c.stroke();
    c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,180,40,0.9)'; c.beginPath(); c.ellipse(9, -14, 3, 4, 0, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
  } else if (kind === 'felhunter') {
    c.fillStyle = '#4a6a3a'; c.beginPath(); c.ellipse(0, -8, 16, 8, 0, 0, 7); c.fill();
    c.strokeStyle = '#2a3a20'; c.lineWidth = 3; for (const lx of [-10, -4, 6, 12]) { c.beginPath(); c.moveTo(lx, -4); c.lineTo(lx, 6); c.stroke(); }
    c.beginPath(); c.ellipse(16, -12, 8, 6, 0, 0, 7); c.fill();
    c.strokeStyle = '#80c060'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(14, -16); c.quadraticCurveTo(10, -30, 4, -26); c.moveTo(18, -16); c.quadraticCurveTo(20, -30, 26, -26); c.stroke();
    c.fillStyle = '#c0ff60'; c.fillRect(20, -14, 2, 2);
  } else if (kind === 'voidwalker') {
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45; c.drawImage(G.Spr.glow('80,100,255', 128), -40, -70, 80, 90); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const g = c.createLinearGradient(0, -60, 0, 10); g.addColorStop(0, '#4a5ad0'); g.addColorStop(1, 'rgba(30,30,120,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-16, -40); c.quadraticCurveTo(-22, -10, -6, 10); c.lineTo(6, 10); c.quadraticCurveTo(22, -10, 16, -40); c.closePath(); c.fill();
    c.fillStyle = '#3a48b0'; c.beginPath(); c.ellipse(0, -48, 12, 11, 0, 0, 7); c.fill();
    c.fillStyle = '#d0e0ff'; c.fillRect(-5, -50, 3, 3); c.fillRect(3, -50, 3, 3);
    c.strokeStyle = '#e0c060'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, -30); c.lineTo(14, -30); c.stroke();
  }
  c.restore();
}

// ---------- 직업 정의 ----------
const WL_DEFENSIVE = ['unendingresolve', 'healthstone', 'demoniccircle', 'voidwalker', 'darksoul', 'deathcoil'];
G.CLASSES.warlock = {
  id: 'warlock', name: '고통 흑마법사', className: '흑마법사', spec: '고통', color: '#8788ee', icon: 'classwarlock',
  starter: 'shadowbolt', masteryText: '특화: 지속 피해 +2%/점',

  init(p) { Object.assign(p, { shards: 0, shardMax: 5, demons: [], drains: null, nightfall: 0, nfT: 0, dsT: 0, drT: 0, dr: 0, circle: null, infernal: null }); },
  recalc(st, p) {
    st.armor += 0.03; // 악마의 피부: 흑마법사 기본 피해 감소
    st.dotLeech += 0.02; // 영혼 흡수: 지속 피해의 2% 회복
    st.dotMul += st.mastery * 0.02;
    if (p.dsT > 0 && p.skills.darksoul) { st.haste += p.skills.darksoul.s.haste; st.dotMul += p.skills.darksoul.s.dot; }
    if (p.legend.darkharvest) { st.critMul += 0.25; st.shardOnKill = (st.shardOnKill || 0) + 0.03; }
    p.shardMax = 5 + st.shardMax;
  },
  computeSkill(sk, s, p) {
    if (sk.id === 'shadowbolt' && p.evo.chaosbolt) { s.dmg *= 1.8; s.cb = 1; }
  },
  haste() { return 0; },
  onCrit() {},
  onKill(e, p) {
    if (e.onDeath) { const f = e.onDeath; e.onDeath = null; f(); }
    if (p.skills.corruption && G.Dots.has(e, 'corruption')) {
      const s = p.skills.corruption.s, n = s.spread + (p.legend.corruptspring ? 3 : 0);
      if (n) for (const o of nearestN(e.x, e.y, n, 200, x => !G.Dots.has(x, 'corruption'))) G.Dots.apply(o, 'corruption', corruptionOpts(s));
    }
    if (p.stats.shardOnKill && Math.random() < p.stats.shardOnKill) addShard(1);
  },
  busy() { return false; },
  immune() { return false; },
  activate() {},
  update(p, dt) {
    if (p.nfT > 0 && (p.nfT -= dt) <= 0) p.nightfall = 0;
    if (p.drT > 0) p.drT -= dt;
    if (p.dsT > 0 && (p.dsT -= dt) <= 0) G.P.recalc();
  },
  skillsUpdate(p, dt) { updateDemons(p, dt); },

  skillIcon(id, p) { return id === 'shadowbolt' && p.evo.chaosbolt ? 'chaosbolt' : G.SKILLS[id].icon; },
  resource(p) { return { cur: p.shards, max: p.shardMax, label: '영혼의 조각' }; },
  castbar(p) {
    const sb = p.skills.shadowbolt;
    if (!sb || !(sb.castT > 0 && sb.castT < 1)) return null;
    return { f: sb.castT, name: p.evo.chaosbolt ? '혼돈의 화살' : '어둠의 화살', total: sb.s.cast / (1 + G.P.haste()) };
  },
  slotState(id, p, impl, sk) { return { glow: id === 'maleficrapture' && p.shards >= 3, active: (id === 'darksoul' && p.dsT > 0) || (id === 'unendingresolve' && p.drT > 0) }; },
  autoGlow(id, p) { return id === 'shadowbolt' && p.nightfall > 0; },
  buffs(p) {
    const b = [];
    if (p.dsT > 0) b.push(['darksoul', p.dsT, '', '어둠의 영혼: 불행', '가속 · 지속 피해 증가']);
    if (p.nightfall > 0) b.push(['nightfall', p.nfT, '', '해질녘', '다음 어둠의 화살 즉시 시전']);
    if (p.drT > 0) b.push(['unendingresolve', p.drT, '', '불굴의 의지', '받는 피해 감소']);
    if (p.absorb > 0) b.push(['darkpact', -1, Math.round(p.absorb), '암흑의 서약', '피해 흡수']);
    if (p.circle) b.push(['demoniccircle', -1, '', '악마의 마법진', '순간이동 가능']);
    return b;
  },

  drawBody(c, x, y, face, alpha, image, t) {
    const S = G.Spr;
    if (!S.warlock) { S.warlock = S.make(64, 76, drawWarlockSprite); S.warlockFlash = S.variants(S.warlock).flash; }
    const p = G.player, spr = !image && p.hurtT > 0 ? S.warlockFlash : S.warlock;
    const bob = (image || p.moving) ? Math.abs(Math.sin((t ?? G.t) * 10)) * -2.5 : Math.sin(G.t * 2) * 0.8;
    c.save(); c.globalAlpha = alpha; c.translate(x, y + 14 + bob); if (face < 0) c.scale(-1, 1); c.drawImage(spr, -32, -74); c.restore();
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7 + Math.sin(G.t * 6) * 0.15;
    c.drawImage(S.glow('90,255,90', 64), x + face * 16 - 16, y + 14 + bob - 80, 32, 32);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
  drawUnder(c, p) {
    if (p.circle) {
      c.save(); c.translate(p.circle.x, p.circle.y); c.scale(1, 0.5);
      c.strokeStyle = 'rgba(120,255,120,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 26, 0, 7); c.stroke();
      c.rotate(G.t); c.beginPath(); for (let i = 0; i < 5; i++) { const a = i * 2.513; c.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); } c.closePath(); c.stroke(); c.restore();
    }
    if (p.dsT > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.4; c.drawImage(G.Spr.glow('170,60,255', 128), p.x - 46, p.y - 64, 92, 100); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    if (p.drains) {
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (const d of p.drains) {
        const wob = Math.sin(G.t * 30) * 2;
        c.strokeStyle = 'rgba(80,255,120,0.35)'; c.lineWidth = 8 + wob; c.beginPath(); c.moveTo(p.x, p.y - 20); c.lineTo(d.e.x, d.e.y - 10); c.stroke();
        c.strokeStyle = 'rgba(200,255,200,0.8)'; c.lineWidth = 2; c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    }
    for (const q of p.demons) drawDemon(c, q, q.kind);
    if (p.infernal) {
      const f = p.infernal; c.save(); c.translate(f.x, f.y); c.scale(1.2, 1.2);
      c.fillStyle = '#3a3a30'; c.beginPath(); c.ellipse(0, -20, 18, 22, 0, 0, 7); c.fill();
      c.globalCompositeOperation = 'lighter'; c.drawImage(G.Spr.glow('120,255,60', 128), -40, -60, 80, 80); c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#a0ff40'; c.fillRect(-6, -34, 4, 3); c.fillRect(3, -34, 4, 3); c.restore();
    }
  },
  drawOver(c, p) {
    // 영혼의 조각 (머리 위에 보라색 수정)
    for (let i = 0; i < p.shards; i++) {
      const a = G.t * 1.6 + i / Math.max(1, p.shards) * Math.PI * 2, x = p.x + Math.cos(a) * 26, y = p.y - 70 + Math.sin(a) * 6;
      c.globalCompositeOperation = 'lighter'; c.drawImage(G.Spr.glow('200,80,255', 32), x - 10, y - 10, 20, 20); c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#e0a0ff'; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 3, y); c.lineTo(x, y + 6); c.lineTo(x - 3, y); c.closePath(); c.fill();
    }
    if (p.absorb > 0) { c.strokeStyle = 'rgba(180,120,255,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y - 12, 34, 0, 7); c.stroke(); }
  },

  upgWeight(o, p) {
    if (o.type === 'new') return G.SKILLS[o.id].kind === 'auto' ? 1.15 : WL_DEFENSIVE.includes(o.id) && p.level < 8 ? 0.35 : 0.95;
    if (o.type === 'passive') return o.id === 'nightfall' ? 1.2 : 0.75;
    if (o.type === 'node') {
      let w = 1.2;
      if (o.id === 'shadowbolt' && p.level < 8) w = 2.2;
      if (o.id === 'shadowbolt' && (o.nodeId === 'count' || o.nodeId === 'cast') && p.level < 12) w += 0.8;
      return w;
    }
  },
  botUse(id, p) {
    if (id === 'healthstone' && p.hp > p.maxHp * 0.5) return false;
    if (id === 'unendingresolve' && p.hp > p.maxHp * 0.4) return false;
    if (id === 'demoniccircle') return !p.circle || p.hp < p.maxHp * 0.3;
    return true;
  },
  botScore(x, p) {
    if (x.type === 'evolution') return 100;
    if (x.type === 'legendary') return 80;
    if (x.type === 'node' && x.id === 'shadowbolt' && (x.nodeId === 'count' || x.nodeId === 'cast')) return 60;
    if (x.type === 'new' && G.SKILLS[x.id].kind === 'auto') return p.order.length < 6 ? 55 : 20;
    if (x.type === 'node' && (x.nodeId === 'dmg' || x.nodeId === 'targets')) return 45;
    if (x.type === 'passive' && ['arcaneint', 'haste', 'crit', 'shadowembraceP', 'nightfall', 'projectile'].includes(x.id)) return 40 + x.rarity * 5;
    if (x.type === 'new' && ['unstableaffliction', 'shadowfury', 'maleficrapture', 'haunt', 'fear'].includes(x.id)) return 35;
    if (x.type === 'node') return 30;
    if (x.type === 'passive') return 25 + x.rarity * 5;
    return 10;
  },
};
// 마법사에는 없는 훅의 기본값
G.CLASSES.mage.onKill = () => {};
G.CLASSES.mage.masteryText = '특화: 고드름 · 얼음창 피해 +2%/점';
