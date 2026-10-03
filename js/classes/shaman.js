'use strict';
// ================= 직업: 정기 주술사 =================
// 한밤(12.0) 정기 특성을 바탕으로: 번개 화살 · 용암 폭발로 소용돌이를 모으고 대지 충격 · 지진으로 쏟아낸다.
// 화염 충격이 걸린 적에게 용암 폭발은 항상 치명타, 화염 충격 틱마다 용암 쇄도(용암 폭발 충전)가 터진다.
// 특화 '정령 과부하': 번개 화살 · 용암 폭발 · 연쇄 번개가 특화 비례 확률로 한 번 더 나간다(75% 피해, 소용돌이 추가).
// 다른 직업 파일과 전역 이름이 겹치지 않게 주술사 전용 이름은 SM / sm으로 시작한다.

const SM = () => G.player;
const SM_RANGE = 640;
const SM_ATTACKS = ['stormkeeper', 'capacitortotem', 'elementalblast', 'earthbindtotem', 'ascendance', 'thunderstorm'];
const SM_DEFENSIVE = ['astralshift', 'healingsurge', 'earthelemental', 'gustofwind', 'spiritwalker', 'reincarnation', 'thunderstorm'];
const SM_OVERLOAD = 0.03; // 특화 1점당 과부하 확률 (과부하는 75% 피해 → 실질 약 2.25%/점)
const SM_OL_DMG = 0.75;
const SM_SURGE_ICD = 1.5; // 용암 쇄도는 1.5초에 한 번까지 (적이 많을 때 끝없이 터지지 않도록)
const SM_TEMPEST = 200; // 폭풍인도자: 소용돌이를 이만큼 쓸 때마다 폭풍우

// ---------- 주문 데이터 ----------
Object.assign(G.SKILLS, {
  // ===== 자동 시전 =====
  lightningbolt: {
    cls: 'shaman', name: '번개 화살', icon: 'lightningbolt', kind: 'auto', school: 'nature', color: '#80c8ff',
    base: { dmg: 50, cast: 0.9, count: 1, ms: 8, arc: 1, proj: true, basic: true },
    tip: s => `가장 가까운 적에게 번개를 내리꽂아 ${D(s.dmg)}의 자연 피해를 입히고 <b class="v">소용돌이 ${N(s.ms, 0)}</b>을 얻습니다. 날아가는 시간 없이 바로 맞습니다.<br>움직이는 동안은 시전이 느려집니다.` +
      (s.count > 1 ? `<br>번개 ${N(s.count, 0)}줄기 (추가 번개는 ${P(G.EXTRA_BOLT)} 피해)` : '') + (s.arc ? `<br>정전기: 맞은 적 주변 ${N(s.arc, 0)}명에게 ${P(0.4)} 피해로 튑니다.` : ''),
    castInfo: s => `시전 시간 ${s.cast.toFixed(2)}초`,
    nodes: [
      node('count', '다중 시전', 2, '번개 <b class="v">+1</b>줄기 (60% 피해)', s => s.count++, { icon: 'chainlightning' }),
      node('cast', '번개 숙련', 3, '시전 시간 <b class="v">-8%</b>', s => (s.cast *= 0.92), { icon: 'lightningmastery' }),
      node('dmg', '진탕', 5, '피해 <b class="v">+20%</b> (기본 피해 기준)', s => (s.dmg += 10), { icon: 'concussion' }),
      node('ms', '전하 충전', 2, '소용돌이 획득 <b class="v">+2</b>', s => (s.ms += 2), { icon: 'maelstrom' }),
      node('arc', '정전기', 2, '튀는 대상 <b class="v">+1</b> (40% 피해)', s => s.arc++, { icon: 'staticshock' }),
    ],
  },
  flameshock: {
    cls: 'shaman', name: '화염 충격', icon: 'flameshock', kind: 'auto', school: 'fire', color: '#ff8030',
    base: { hit: 36, dmg: 28, cd: 2, targets: 3, dur: 18, interval: 1.5, surge: 0.08 },
    tip: s => `화염 충격에 걸리지 않은 적 ${N(s.targets, 0)}명(정예 · 보스 먼저)에게 ${D(s.hit)}의 화염 피해를 입히고 ${N(s.dur, 0)}초 동안 ${N(s.interval, 1)}초마다 ${D(s.dmg)}의 화염 피해.<br>` +
      `틱마다 <b class="v">${Math.round((s.surge + (G.player && G.player.stats.surge || 0)) * 100)}%</b> 확률로 <b class="v">용암 쇄도</b>: 용암 폭발 충전 +1 (${SM_SURGE_ICD}초에 한 번까지). 화염 충격이 걸린 적은 용암 폭발에 항상 치명타를 맞습니다.`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      node('targets', '번지는 불길', 3, '대상 <b class="v">+2</b>', s => (s.targets += 2), { icon: 'firenova' }),
      dmgNode(0.3, 5, '이글거리는 불길'),
      node('dur', '끈질긴 불꽃', 2, '지속시간 <b class="v">+6초</b>', s => (s.dur += 6), { icon: 'duration' }),
      node('surge', '용암 쇄도', 3, '용암 쇄도 확률 <b class="v">+3%</b>', s => (s.surge += 0.03), { icon: 'lavasurge' }),
      cdNode(0.15, 2),
    ],
  },
  lavaburst: {
    cls: 'shaman', name: '용암 폭발', icon: 'lavaburst', kind: 'auto', school: 'fire', color: '#ff6020',
    base: { dmg: 180, cd: 8, charges: 1, ms: 10, splash: 0 },
    tip: s => `화염 충격이 걸린 적(정예 · 보스 먼저)에게 용암 덩이를 던져 ${D(s.dmg)}의 화염 피해를 입히고 <b class="v">소용돌이 ${N(s.ms, 0)}</b>을 얻습니다.<br>` +
      `화염 충격이 걸린 적에게는 <b class="v">항상 치명타</b>. 용암 쇄도가 터지면 충전이 돌아옵니다.` + (s.splash ? `<br>용암 분출: 맞은 자리 주변에 ${P(0.3 * s.splash)} 피해` : ''),
    castInfo: s => `즉시 · 충전 ${s.charges}회 · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      dmgNode(0.25, 5, '용암 숙련'),
      node('charges', '메아리치는 충격', 1, '충전 <b class="v">+1</b>', s => s.charges++, { icon: 'echoingshock' }),
      node('splash', '용암 분출', 2, '맞은 자리 주변에 <b class="v">30%</b> 피해', s => s.splash++, { icon: 'lavasurge' }),
      cdNode(0.12, 3),
    ],
  },
  chainlightning: {
    cls: 'shaman', name: '연쇄 번개', icon: 'chainlightning', kind: 'auto', school: 'nature', color: '#a0d8ff',
    base: { dmg: 54, cd: 2.5, targets: 4, ms: 2 },
    tip: s => `적이 2명 이상 몰려 있으면 번개를 날려 적 ${N(s.targets, 0)}명을 차례로 튀며 각각 ${D(s.dmg)}의 자연 피해를 입히고, 맞힌 적마다 <b class="v">소용돌이 ${N(s.ms, 0)}</b>을 얻습니다.`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      node('targets', '갈래 번개', 3, '대상 <b class="v">+1</b>', s => s.targets++, { icon: 'chainlightning' }),
      dmgNode(0.3, 5, '천둥의 부름'),
      node('ms', '폭풍의 충전', 2, '대상마다 소용돌이 <b class="v">+1</b>', s => s.ms++, { icon: 'maelstrom' }),
      cdNode(0.12, 3),
    ],
  },
  earthshock: {
    cls: 'shaman', name: '대지 충격', icon: 'earthshock', kind: 'auto', school: 'nature', color: '#c0a060',
    base: { dmg: 420, cd: 0.6, cost: 60, after: 0 },
    tip: s => `소용돌이 ${N(s.cost, 0)}을 써서 보스 → 정예 → 가장 튼튼한 적의 발밑을 흔들어 ${D(s.dmg)}의 피해를 입힙니다.<br>지진을 배웠고 적이 3명 이상 몰려 있으면 지진에 양보합니다.` +
      (s.after ? `<br>여진: ${P(s.after)} 확률로 소용돌이를 절반 돌려받음` : ''),
    castInfo: s => `즉시 · 소용돌이 ${s.cost.toFixed(0)} · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      dmgNode(0.3, 5, '대지의 분노'),
      node('cost', '대류', 2, '소용돌이 소모 <b class="v">-5</b>', s => (s.cost -= 5), { icon: 'convection' }),
      node('after', '여진', 2, '<b class="v">15%</b> 확률로 소용돌이 절반 반환', s => (s.after += 0.15), { icon: 'aftershock' }),
    ],
  },
  earthquake: {
    cls: 'shaman', name: '지진', icon: 'earthquake', kind: 'auto', school: 'physical', color: '#b08850',
    base: { dmg: 28, cd: 1.5, cost: 60, radius: 140, dur: 6 },
    tip: s => `소용돌이 ${N(s.cost, 0)}을 써서 적이 3명 이상 몰린 곳(대지 충격이 없으면 보스 · 정예 발밑)에 ${N(s.dur, 0)}초 동안 지진을 일으켜 0.5초마다 범위 안의 적에게 ${D(s.dmg)}의 피해를 입힙니다. 틱마다 10% 확률로 적을 넘어뜨립니다 (1초 기절, 보스 제외).`,
    castInfo: s => `즉시 · 소용돌이 ${s.cost.toFixed(0)} · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      dmgNode(0.3, 5, '대지의 격동'),
      node('radius', '넓은 균열', 3, '범위 <b class="v">+15%</b>', s => (s.radius *= 1.15), { icon: 'area' }),
      node('dur', '끝없는 진동', 2, '지속시간 <b class="v">+2초</b>', s => (s.dur += 2), { icon: 'duration' }),
      node('cost', '대류', 2, '소용돌이 소모 <b class="v">-5</b>', s => (s.cost -= 5), { icon: 'convection' }),
    ],
  },
  fireelemental: {
    cls: 'shaman', name: '불의 정령', icon: 'fireelemental', kind: 'auto', school: 'fire', color: '#ff9040',
    base: { dmg: 38, atk: 1.4, spread: 0 },
    tip: s => `곁에 불의 정령을 부립니다. ${N(s.atk, 1)}초마다 가장 가까운 적에게 불덩이를 던져 ${D(s.dmg)}의 화염 피해를 입힙니다.` +
      (s.spread ? '<br>불씨 퍼뜨리기: 6초마다 화염 충격에 걸리지 않은 적 3명에게 화염 충격' : ''),
    castInfo: () => '영구 소환',
    nodes: [
      dmgNode(0.3, 5, '원시 불꽃'),
      node('atk', '타오르는 분노', 2, '공격 주기 <b class="v">-15%</b>', s => (s.atk *= 0.85), { icon: 'haste' }),
      node('spread', '불씨 퍼뜨리기', 1, '6초마다 적 3명에게 화염 충격', s => (s.spread = 1), { icon: 'flameshock' }),
    ],
  },
  lightningshield: {
    cls: 'shaman', name: '번개 보호막', icon: 'lightningshield', kind: 'auto', school: 'nature', color: '#90b8ff',
    base: { dmg: 22, iv: 0.7, orbs: 3, range: 150, ms: 1 },
    tip: s => `몸 주위에 번개 구슬 ${N(s.orbs, 0)}개를 두릅니다. ${N(s.iv, 1)}초마다 반경 ${N(s.range, 0)} 안의 적에게 방전해 ${D(s.dmg)}의 자연 피해를 입히고 소용돌이 ${N(s.ms, 0)}을 얻습니다 (구슬 하나당 한 명).`,
    castInfo: () => '지속 효과',
    nodes: [
      dmgNode(0.3, 5, '고압 전류'),
      node('orbs', '번개 구슬', 2, '구슬 <b class="v">+1</b>', s => s.orbs++, { icon: 'lightningshield' }),
      node('range', '뻗어 나가는 전류', 2, '범위 <b class="v">+25%</b>', s => (s.range *= 1.25), { icon: 'area' }),
    ],
  },

  // ===== 단축키 주문 =====
  stormkeeper: {
    cls: 'shaman', name: '폭풍수호자', icon: 'stormkeeper', kind: 'active', key: 'Q', school: 'nature', color: '#a0b0ff',
    base: { cd: 40, stacks: 2, bonus: 1.5 },
    tip: s => `폭풍의 힘을 담습니다. 다음 번개 화살 · 연쇄 번개 ${N(s.stacks, 0)}회가 <b class="v">즉시 시전</b>되고 피해가 ${P(s.bonus)} 증가합니다 (20초).`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('stacks', '폭풍 축적', 2, '횟수 <b class="v">+1</b>', s => s.stacks++, { icon: 'stormkeeper' }), node('bonus', '폭풍의 눈', 2, '피해 증가 <b class="v">+50%</b>', s => (s.bonus += 0.5), { icon: 'eyeofstorm' }), cdNode(0.15, 2)],
  },
  capacitortotem: {
    cls: 'shaman', name: '축전 토템', icon: 'capacitortotem', kind: 'active', key: 'E', school: 'nature', color: '#80d0ff',
    base: { dmg: 60, cd: 30, radius: 170, stun: 3, delay: 2 },
    tip: s => `마우스 위치(사거리 안)에 토템을 세웁니다. ${N(s.delay, 0)}초 뒤 방전해 반경 ${N(s.radius, 0)} 안의 적에게 ${D(s.dmg)}의 피해를 입히고 ${N(s.stun, 0)}초 동안 기절시킵니다 (정예는 절반, 보스 제외).`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('radius', '확장된 축전', 2, '범위 <b class="v">+20%</b>', s => (s.radius *= 1.2), { icon: 'area' }), node('stun', '과충전', 2, '기절 <b class="v">+1초</b>', s => (s.stun += 1), { icon: 'capacitortotem' }), dmgNode(0.5, 3), cdNode(0.15, 2)],
  },
  elementalblast: {
    cls: 'shaman', name: '정령 작렬', icon: 'elementalblast', kind: 'active', key: 'R', school: 'nature', color: '#e0a0ff',
    base: { dmg: 220, cd: 12, ms: 10, buff: 0.08 },
    tip: s => `마우스 방향의 적에게 원소의 힘을 터뜨려 ${D(s.dmg)}의 피해를 입히고 소용돌이 ${N(s.ms, 0)}을 얻습니다.<br>10초 동안 치명타 · 가속 · 과부하 확률 중 하나가 ${P(s.buff)} 오릅니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 5, '원소의 정수'), node('buff', '원소의 조화', 2, '능력치 증가 <b class="v">+4%</b>', s => (s.buff += 0.04), { icon: 'elementalblast' }), cdNode(0.15, 2)],
  },
  earthbindtotem: {
    cls: 'shaman', name: '속박의 토템', icon: 'earthbindtotem', kind: 'active', key: 'T', school: 'nature', color: '#a08860',
    base: { cd: 20, radius: 180, dur: 10, slow: 0.5, grip: 0 },
    tip: s => `마우스 위치(사거리 안)에 토템을 세웁니다. ${N(s.dur, 0)}초 동안 반경 ${N(s.radius, 0)} 안의 적 이동 속도가 ${P(s.slow)} 감소합니다.` +
      (s.grip ? '<br>대지 붙잡기: 처음 들어온 적을 2초 동안 묶습니다 (정예는 절반, 보스 제외).' : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('radius', '넓은 속박', 2, '범위 <b class="v">+20%</b>', s => (s.radius *= 1.2), { icon: 'area' }), node('grip', '대지 붙잡기', 1, '처음 들어온 적 2초 속박', s => (s.grip = 1), { icon: 'earthgrab' }), cdNode(0.15, 2)],
  },
  ascendance: {
    cls: 'shaman', name: '승천', icon: 'ascendance', kind: 'active', key: 'F', school: 'fire', color: '#ffb040',
    base: { cd: 90, dur: 15, dmg: 120, haste: 0.1 },
    tip: s => `불의 정령과 하나가 되어 주변 적에게 ${D(s.dmg)}의 화염 피해를 입히고 화염 충격을 겁니다. ${N(s.dur, 0)}초 동안 용암 폭발의 재사용 대기시간이 <b class="v">4배</b> 빨리 돌고 가속이 ${P(s.haste)} 오릅니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('dur', '끝없는 불길', 2, '지속시간 <b class="v">+3초</b>', s => (s.dur += 3), { icon: 'duration' }), node('haste', '불타는 속도', 2, '가속 <b class="v">+5%</b>', s => (s.haste += 0.05), { icon: 'haste' }), cdNode(0.15, 2)],
  },
  gustofwind: {
    cls: 'shaman', name: '바람 돌풍', icon: 'gustofwind', kind: 'active', key: 'SPACE', school: 'nature', color: '#c0f0e0',
    base: { cd: 15, charges: 1, dist: 240 },
    tip: s => `바람을 타고 이동 방향(서 있으면 마우스 방향)으로 ${N(s.dist, 0)}만큼 날아갑니다 (나는 동안 피해 면역).`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('charges', '연속 돌풍', 1, '충전 <b class="v">+1</b>', s => s.charges++, { icon: 'gustofwind' }), node('dist', '강한 바람', 2, '거리 <b class="v">+20%</b>', s => (s.dist *= 1.2), { icon: 'speed' }), cdNode(0.15, 2)],
  },
  astralshift: {
    cls: 'shaman', name: '영혼 이동', icon: 'astralshift', kind: 'active', key: '1', school: 'nature', color: '#a0c0ff',
    base: { cd: 60, dur: 8, dr: 0.4 },
    tip: s => `영혼의 세계로 몸을 옮겨 ${N(s.dur, 0)}초 동안 받는 피해가 ${P(s.dr)} 감소합니다. 공격과 이동은 그대로 할 수 있습니다.`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('dr', '영혼의 장벽', 2, '피해 감소 <b class="v">+10%</b>', s => (s.dr += 0.1), { icon: 'astralshift' }), node('dur', '오래가는 영혼', 2, '지속시간 <b class="v">+2초</b>', s => (s.dur += 2), { icon: 'duration' }), cdNode(0.15, 2)],
  },
  healingsurge: {
    cls: 'shaman', name: '치유의 파도', icon: 'healingsurge', kind: 'active', key: '2', school: 'nature', color: '#60ffb0',
    base: { cd: 18, heal: 0.22, charges: 1 },
    tip: s => `생명력을 ${P(s.heal)} 회복합니다.`,
    castInfo: s => `즉시 · 충전 ${s.charges}회 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('heal', '치유의 물결', 2, '회복 <b class="v">+8%</b>', s => (s.heal += 0.08), { icon: 'regen' }), node('charges', '쇄도하는 물결', 1, '충전 <b class="v">+1</b>', s => s.charges++, { icon: 'healingsurge' }), cdNode(0.15, 2)],
  },
  earthelemental: {
    cls: 'shaman', name: '대지 정령', icon: 'earthelemental', kind: 'active', key: '3', school: 'nature', color: '#c09060',
    base: { cd: 60, dur: 12, dmg: 40, hp: 4 },
    tip: s => `${N(s.dur, 0)}초 동안 바위 정령을 불러냅니다. 정령이 더 가까운 적은 정령을 공격하고, 정령은 1.2초마다 주먹으로 ${D(s.dmg)}의 피해를 입힙니다. 정령의 생명력은 내 최대 생명력의 ${N(s.hp, 0)}배입니다.`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('hp', '단단한 바위', 2, '정령 생명력 <b class="v">+2배</b>', s => (s.hp += 2), { icon: 'stoneskin' }), node('dur', '오래 버티는 바위', 2, '지속시간 <b class="v">+4초</b>', s => (s.dur += 4), { icon: 'duration' }), cdNode(0.15, 2)],
  },
  spiritwalker: {
    cls: 'shaman', name: '영혼걸음의 은총', icon: 'spiritwalker', kind: 'active', key: '4', school: 'nature', color: '#a0ffe0',
    base: { cd: 45, dur: 10, speed: 0.2 },
    tip: s => `${N(s.dur, 0)}초 동안 <b class="v">움직여도 시전이 느려지지 않고</b> 이동 속도가 ${P(s.speed)} 오릅니다.`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('dur', '영혼의 길', 2, '지속시간 <b class="v">+3초</b>', s => (s.dur += 3), { icon: 'duration' }), node('speed', '바람걸음', 2, '이동 속도 <b class="v">+10%</b>', s => (s.speed += 0.1), { icon: 'speed' }), cdNode(0.15, 2)],
  },
  thunderstorm: {
    cls: 'shaman', name: '천둥폭풍', icon: 'thunderstorm', kind: 'active', key: '5', school: 'nature', color: '#90a8ff',
    base: { dmg: 60, cd: 25, radius: 170, push: 160 },
    tip: s => `주변 반경 ${N(s.radius, 0)} 안의 적에게 ${D(s.dmg)}의 자연 피해를 입히고 ${N(s.push, 0)}만큼 밀쳐내며 3초 동안 40% 감속시킵니다 (보스는 밀리지 않음).`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 4), node('radius', '거대한 폭풍', 2, '범위 <b class="v">+15%</b>', s => (s.radius *= 1.15), { icon: 'area' }), node('push', '강한 돌풍', 2, '밀쳐내기 <b class="v">+30%</b>', s => (s.push *= 1.3), { icon: 'gustofwind' }), cdNode(0.15, 2)],
  },
  reincarnation: {
    cls: 'shaman', name: '윤회', icon: 'reincarnation', kind: 'active', key: '6', school: 'nature', color: '#ffe0a0', noAuto: true,
    base: { cd: 180, hp: 0.3 },
    tip: s => `직접 쓰지 않습니다. 치명적인 피해를 받으면 <b class="v">자동으로 되살아나</b> 생명력 ${P(s.hp)}로 일어서고, 2초 동안 피해를 받지 않으며 주변 적을 밀쳐냅니다.`,
    castInfo: s => `자동 발동 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('hp', '선조의 보살핌', 2, '되살아난 생명력 <b class="v">+15%</b>', s => (s.hp += 0.15), { icon: 'regen' }), cdNode(0.15, 2)],
  },

  // ===== 주술사 전용 능력치 =====
  masterofelements: { cls: 'shaman', name: '원소의 지배', icon: 'masterofelements', kind: 'passive', max: 3, val: 15, unit: '%', req: p => !!p.skills.lavaburst,
    desc: v => `용암 폭발을 쓰면 다음 번개 화살 · 연쇄 번개 · 대지 충격 · 지진 피해 +${v}%`, apply: (st, v) => (st.moe = (st.moe || 0) + v / 100) },
  lavasurgeP: { cls: 'shaman', name: '용암 쇄도', icon: 'lavasurge', kind: 'passive', max: 3, val: 4, unit: '%', fixed: true, req: p => !!(p.skills.flameshock && p.skills.lavaburst),
    desc: v => `화염 충격 틱의 용암 쇄도 확률 +${v}%`, apply: (st, v) => (st.surge = (st.surge || 0) + v / 100) },
  lightningrod: { cls: 'shaman', name: '번개 막대', icon: 'lightningrod', kind: 'passive', max: 3, val: 15, unit: '%', req: p => !!((p.skills.earthshock || p.skills.earthquake) && (p.skills.lightningbolt || p.skills.chainlightning)),
    desc: v => `대지 충격 · 지진에 맞은 적이 8초 동안 피뢰침이 됩니다. 번개 화살 · 연쇄 번개 피해의 ${v}%가 피뢰침 적(최대 3명)에게도 들어갑니다.`, apply: (st, v) => (st.rod = (st.rod || 0) + v / 100) },
  stormeye: { cls: 'shaman', name: '폭풍의 눈', icon: 'eyeofstorm', kind: 'passive', max: 3, val: 12, unit: '%', desc: v => `소용돌이 획득 +${v}%`, apply: (st, v) => (st.msGain = (st.msGain || 0) + v / 100) },
  elementalfury: { cls: 'shaman', name: '정령의 격노', icon: 'elementalfury', kind: 'passive', max: 3, val: 10, unit: '%', desc: v => `치명타 피해 +${v}%`, apply: (st, v) => (st.critMul += v / 100) },
  callthunder: { cls: 'shaman', name: '천둥의 부름', icon: 'callthunder', kind: 'passive', max: 3, val: 6, unit: '%', req: p => !!(p.skills.lightningbolt || p.skills.chainlightning),
    desc: v => `번개 화살 · 연쇄 번개 치명타 확률 +${v}%`, apply: (st, v) => (st.lightCrit = (st.lightCrit || 0) + v / 100) },
  searingflames: { cls: 'shaman', name: '이글거리는 불길', icon: 'searingflames', kind: 'passive', max: 3, val: 15, unit: '%', req: p => !!(p.skills.flameshock || p.skills.lavaburst),
    desc: v => `화염 충격 · 용암 폭발 피해 +${v}%`, apply: (st, v) => (st.fireMul = (st.fireMul || 0) + v / 100) },
  earthenward: { cls: 'shaman', name: '대지의 보호', icon: 'stoneskin', kind: 'passive', max: 5, val: 6, unit: '%', desc: v => `받는 피해 -${v}%`, apply: (st, v) => (st.armor += v / 100) },

  // ===== 전설 =====
  skybreaker: { cls: 'shaman', name: '하늘파괴자의 불타는 종말', icon: 'skybreaker', kind: 'legendary', req: p => !!(p.skills.lavaburst && p.skills.flameshock), desc: () => '용암 쇄도 확률 2배. 용암 폭발이 맞은 자리 주변의 화염 충격이 걸린 적에게 40% 피해로 번집니다.' },
  windspeaker: { cls: 'shaman', name: '윈드스피커의 용암 부활', icon: 'windspeaker', kind: 'legendary', req: p => !!((p.skills.earthshock || p.skills.earthquake) && p.skills.lavaburst), desc: () => '대지 충격 · 지진을 쓰면 용암 폭발 충전 +1, 다음 용암 폭발 피해 +50%.' },
  greatsundering: { cls: 'shaman', name: '대분열의 메아리', icon: 'greatsundering', kind: 'legendary', req: p => !!p.skills.earthshock, desc: () => '대지 충격이 대상 자리에 4초 동안 지진을 남기고, 대지 충격 · 지진 피해 +30%.' },
  deeplyrooted: { cls: 'shaman', name: '깊게 뿌리내린 정령', icon: 'deeplyrooted', kind: 'legendary', req: p => !!p.skills.lavaburst, desc: () => '용암 폭발을 쓸 때마다 8% 확률로 6초 동안 승천합니다 (승천을 배우지 않아도). 승천 중 용암 폭발 피해 +20%.' },

  // ===== 진화 (영웅 특성) =====
  tempest: {
    cls: 'shaman', name: '폭풍우', icon: 'tempest', kind: 'evolution', target: 'lightningbolt',
    req: p => p.skills.lightningbolt && p.skillLevel('lightningbolt') >= 5 && p.skills.stormkeeper, reqText: '번개 화살 5레벨 + 폭풍수호자',
    desc: () => `<b>영웅 특성: 폭풍인도자</b><br>번개 화살 피해 +20%. 소용돌이를 ${SM_TEMPEST}만큼 쓸 때마다 다음 번개 화살이 <b>폭풍우</b>가 됩니다: 피해 3배, 맞은 자리에 60% 폭발, 주변 4명에게 40% 연쇄.`,
  },
  farseer: {
    cls: 'shaman', name: '선조의 부름', icon: 'farseer', kind: 'evolution', target: 'fireelemental',
    req: p => p.skills.fireelemental && p.skillLevel('fireelemental') >= 4 && p.skills.elementalblast, reqText: '불의 정령 4레벨 + 정령 작렬',
    desc: () => '<b>영웅 특성: 선견자</b><br>불의 정령이 선조의 영혼이 됩니다. 선조는 번개 화살과 용암 폭발을 번갈아 쓰고(불의 정령 피해 1.5배), 소용돌이를 쓸 때마다 선조 하나가 더 나타나 8초 동안 함께 싸웁니다 (최대 4).',
  },
});
for (const id in G.SKILLS) G.SKILLS[id].id = id;
Object.assign(G.SOURCES, {
  lightningbolt: ['번개 화살', 'lightningbolt', '#80c8ff'], tempest: ['폭풍우', 'tempest', '#b0a0ff'], overload: ['정령 과부하', 'overload', '#d0e8ff'],
  flameshock: ['화염 충격', 'flameshock', '#ff8030'], lavaburst: ['용암 폭발', 'lavaburst', '#ff6020'], chainlightning: ['연쇄 번개', 'chainlightning', '#a0d8ff'],
  earthshock: ['대지 충격', 'earthshock', '#c0a060'], earthquake: ['지진', 'earthquake', '#b08850'], fireelemental: ['불의 정령', 'fireelemental', '#ff9040'],
  ancestor: ['선조의 부름', 'farseer', '#a0e0ff'], lightningshield: ['번개 보호막', 'lightningshield', '#90b8ff'], lightningrod: ['번개 막대', 'lightningrod', '#c0d8ff'],
  capacitortotem: ['축전 토템', 'capacitortotem', '#80d0ff'], elementalblast: ['정령 작렬', 'elementalblast', '#e0a0ff'], ascendance: ['승천', 'ascendance', '#ffb040'],
  thunderstorm: ['천둥폭풍', 'thunderstorm', '#90a8ff'], earthelemental: ['대지 정령', 'earthelemental', '#c09060'], reincarnation: ['윤회', 'reincarnation', '#ffe0a0'],
  skybreaker: ['하늘파괴자', 'skybreaker', '#ff7040'],
});

// ---------- 공용 도우미 ----------
const smMs = n => { const p = SM(); p.ms = Math.min(p.msMax, p.ms + n * (1 + (p.stats.msGain || 0))); };
// 과부하 확률 (특화 + 정령 작렬 과부하 강화)
const smOverloadCh = () => { const p = SM(); return Math.min(1, (p.stats.mastery || 0) * SM_OVERLOAD + (p.ebK === 'mastery' && p.ebT > 0 ? p.ebV : 0)); };
// 주술사의 모든 직접 피해는 여기를 거친다: 이글거리는 불길(화염) · 천둥의 부름(번개 치명타) · 번개 막대
const smHit = (e, base, src, o = {}) => {
  const p = SM(), st = p.stats;
  let m = 1;
  if (o.fire && st.fireMul) m *= 1 + st.fireMul;
  if (o.light && st.lightCrit) o.crit = (o.crit || 0) + st.lightCrit;
  const dealt = G.hit(e, base * m, src, o);
  if (o.light && st.rod && p.rods.length) {
    let n = 0;
    for (const r of p.rods) {
      if (r === e || r.dead || !(r.rodT > G.t)) continue;
      G.hit(r, base * m * st.rod, 'lightningrod', { school: 'nature', small: true, noText: n > 0 });
      p.bolts.push(smBolt(e.x, e.y - 20, r.x, r.y - 20, 0.16, '190,215,255', 1.2));
      if (++n >= 3) break;
    }
  }
  return dealt;
};
// 원소의 지배: 용암 폭발 뒤 다음 번개 · 충격 · 지진 1회 강화 (쓰면 사라짐)
const smMoe = () => { const p = SM(); if (!p.moe || !p.stats.moe) return 1; p.moe = 0; return 1 + p.stats.moe; };
// 소용돌이 쓰기: 폭풍우 축적 · 윈드스피커 · 선조 · 여진
const smSpend = (cost, sk) => {
  const p = SM(); if (p.ms < cost) return false;
  p.ms -= cost;
  if (p.evo.tempest) { p.tmMs += cost; if (p.tmMs >= SM_TEMPEST) { p.tmMs -= SM_TEMPEST; p.tempest = 1; G.fx.text(p.x, p.y - 64, '폭풍우!', '#c0b0ff', 16, true); } }
  if (p.legend.windspeaker && p.skills.lavaburst) { const lb = p.skills.lavaburst; if (lb.charges < lb.maxCharges) { lb.charges++; if (lb.charges >= lb.maxCharges) lb.cdT = 0; } p.wsLava = 1; }
  if (p.evo.farseer && p.skills.fireelemental) smCallAncestor(8);
  if (sk && sk.s.after && Math.random() < sk.s.after) { p.ms = Math.min(p.msMax, p.ms + cost / 2); G.fx.text(p.x, p.y - 56, '여진', '#e0c080', 13); }
  return true;
};
// 우선 대상: 보스 > 정예 > (조건) > 가까운 적
const smPriority = (range, pref, x = SM().x, y = SM().y) => {
  let best = null, bs = -Infinity;
  for (const e of G.Grid.query(x, y, range)) {
    const sc = (e.boss ? 2000 : e.elite ? 1000 : 0) + (pref && pref(e) ? 3000 : 0) - Math.sqrt(U.d2(x, y, e.x, e.y));
    if (sc > bs) { bs = sc; best = e; }
  }
  return best;
};
const smSpot = range => { const p = SM(), m = G.aimPoint(), a = Math.atan2(m.y - p.y, m.x - p.x), d = Math.min(range, Math.hypot(m.x - p.x, m.y - p.y)); return [p.x + Math.cos(a) * d, p.y + Math.sin(a) * d]; };
const smHand = () => { const p = SM(); return [p.x + p.face * 20, p.y - 62]; };
// 지그재그 번개 한 줄기 (그림만): 점 목록을 만들어 두고 life 동안 그린다
function smBolt(x0, y0, x1, y1, life = 0.2, rgb = '170,215,255', w = 2, jag = 0.18) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(3, Math.round(d / 26)), nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1), pts = [[x0, y0]];
  for (let i = 1; i < n; i++) { const t = i / n, o = U.rand(-1, 1) * d * jag * Math.sin(t * Math.PI) * 0.5; pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]); }
  pts.push([x1, y1]);
  return { pts, t: 0, life, rgb, w };
}
// 화염 충격 걸기
const smFsOpts = s => ({ dmg: s.dmg, dur: s.dur, interval: s.interval, src: 'flameshock', color: '255,120,40', icon: 'flameshock', school: 'fire', mul: 1 + (SM().stats.fireMul || 0),
  onTick: () => {
    const p = SM(); if (!p.skills.lavaburst || G.t < p.surgeICD) return;
    const ch = (s.surge + (p.stats.surge || 0)) * (p.legend.skybreaker ? 2 : 1);
    if (Math.random() < ch) smSurge();
  } });
const smFs = (e, s) => { s = s || (SM().skills.flameshock ? SM().skills.flameshock.s : G.SKILLS.flameshock.base); G.Dots.apply(e, 'flameshock', smFsOpts(s)); };
function smSurge() {
  const p = SM(), lb = p.skills.lavaburst; if (!lb) return;
  p.surgeICD = G.t + SM_SURGE_ICD;
  if (lb.charges < lb.maxCharges) { lb.charges++; if (lb.charges >= lb.maxCharges) lb.cdT = 0; }
  p.surgeT = 1.2; // 그림: 손에 용암 빛
  G.fx.text(p.x, p.y - 60, '용암 쇄도', '#ff9040', 14, true); G.Audio.play('tick', 0.7);
}

// ---------- 구현 ----------
Object.assign(G.SKILL_IMPL, {
  lightningbolt: {
    update(sk, dt, busy) {
      const p = SM(), s = sk.s;
      if (busy || p.channel) { sk.castT = 0; return; }
      const pen = p.moving && !(p.swT > 0) ? p.stats.movePenalty : 0;
      const fast = p.skN > 0 ? 8 : 1; // 폭풍수호자: 즉시 시전
      sk.castT = Math.min(1, sk.castT + dt * (1 + G.P.haste()) * (1 - pen) * fast / s.cast);
      if (sk.castT < 1) return;
      const tg = nearestN(p.x, p.y, s.count, SM_RANGE);
      if (!tg.length) return;
      sk.castT = 0;
      let mul = smMoe();
      if (p.skN > 0) { p.skN--; mul *= 1 + (p.skills.stormkeeper ? p.skills.stormkeeper.s.bonus : 1.5); }
      const tempest = p.tempest > 0; if (tempest) { p.tempest = 0; mul *= 3; }
      smMs(s.ms);
      for (let i = 0; i < s.count; i++) {
        const t = tg[i % tg.length], base = s.dmg * mul * (i ? G.EXTRA_BOLT : 1);
        smLightning(t, base, s, tempest && !i, 'lightningbolt');
        if (Math.random() < smOverloadCh()) G.later(0.18, () => { if (!t.dead) { smLightning(t, base * SM_OL_DMG, s, false, 'overload'); smMs(s.ms * 0.5); } });
      }
      G.Audio.play('zap', 0.6);
    },
  },
  flameshock: {
    auto(sk) {
      const p = SM(), s = sk.s;
      const tg = nearestN(p.x, p.y, s.targets, SM_RANGE, e => e.boss || e.elite).filter(e => !G.Dots.has(e, 'flameshock')).slice(0, s.targets);
      const fresh = tg.length ? tg : nearestN(p.x, p.y, s.targets * 3, SM_RANGE).filter(e => !G.Dots.has(e, 'flameshock')).slice(0, s.targets);
      if (!fresh.length) return false;
      for (const e of fresh) {
        smHit(e, s.hit, 'flameshock', { school: 'fire', fire: true, small: true });
        smFs(e, s);
        G.fx.burst(e.x, e.y - 10, 8, { rgb: '255,130,50', sp: 90, size: 9 });
      }
      G.Audio.play('hitFire', 0.4);
      return true;
    },
  },
  lavaburst: {
    auto(sk) {
      const p = SM(), s = sk.s;
      const t = smPriority(SM_RANGE, e => G.Dots.has(e, 'flameshock'));
      if (!t) return false;
      let mul = 1;
      if (p.wsLava) { p.wsLava = 0; mul *= 1.5; }
      if (p.ascT > 0 && p.legend.deeplyrooted) mul *= 1.2;
      smLava(t, s.dmg * mul, s, 'lavaburst');
      if (Math.random() < smOverloadCh()) G.later(0.2, () => { const tt = t.dead ? smPriority(SM_RANGE, e => G.Dots.has(e, 'flameshock')) : t; if (tt) { smLava(tt, s.dmg * mul * SM_OL_DMG, s, 'overload'); smMs(s.ms * 0.5); } });
      smMs(s.ms);
      if (p.stats.moe) p.moe = 1;
      if (p.legend.deeplyrooted && Math.random() < 0.08) smAscend(6, false);
      G.Audio.play('lava', 0.6);
      return true;
    },
  },
  chainlightning: {
    auto(sk) {
      const p = SM(), s = sk.s;
      const d = G.densestPoint(p.x, p.y, 560, 150); if (!d || d.n < 2) return false;
      const first = G.nearestEnemy(d.x, d.y, 160); if (!first) return false;
      let mul = smMoe();
      if (p.skN > 0) { p.skN--; mul *= 1 + (p.skills.stormkeeper ? p.skills.stormkeeper.s.bonus : 1.5); }
      const n = smChain(first, s.targets, s.dmg * mul, 'chainlightning', smHand());
      smMs(s.ms * n);
      if (Math.random() < smOverloadCh()) G.later(0.2, () => { const f = first.dead ? G.nearestEnemy(d.x, d.y, 200) : first; if (f) smMs(s.ms * 0.5 * smChain(f, s.targets, s.dmg * mul * SM_OL_DMG, 'overload', [f.x, f.y - 300])); });
      G.Audio.play('zap', 0.9);
      return true;
    },
  },
  earthshock: {
    auto(sk) {
      const p = SM(), s = sk.s;
      if (p.ms < s.cost) return false;
      const eq = p.skills.earthquake;
      if (eq && eq.charges > 0 && p.ms < s.cost + eq.s.cost) { const d = G.densestPoint(p.x, p.y, 560, 140); if (d && d.n >= 3) return false; }
      let t = null, bs = -1;
      for (const e of G.Grid.query(p.x, p.y, SM_RANGE)) { const sc = (e.boss ? 1e7 : e.elite ? 5e6 : 0) + e.hp; if (sc > bs) { bs = sc; t = e; } }
      if (!t || !smSpend(s.cost, sk)) return false;
      const mul = smMoe() * (p.legend.greatsundering ? 1.3 : 1);
      smHit(t, s.dmg * mul, 'earthshock', { school: 'nature' });
      smRod(t);
      if (p.legend.greatsundering) smQuake(t.x, t.y, p.skills.earthquake ? p.skills.earthquake.s : G.SKILLS.earthquake.base, 4, 1.3);
      G.fx.burst(t.x, t.y, 22, { rgb: '200,170,110', sp: 200, size: 11, type: 'smoke', add: false });
      G.fx.ring(t.x, t.y, 6, 70, 0.35, '230,200,130', 6); G.fx.shake(5);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; G.fx.part({ x: t.x, y: t.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 90 - 60, life: 0.5, size: 6, size1: 3, rgb: '150,120,80', type: 'shard', add: false, grav: 400 }); }
      G.Audio.play('quake', 0.8, t.x);
      return true;
    },
  },
  earthquake: {
    auto(sk) {
      const p = SM(), s = sk.s;
      if (p.ms < s.cost) return false;
      let d = G.densestPoint(p.x, p.y, 560, s.radius * p.stats.area);
      // 적이 적으면 대지 충격에 맡긴다. 대지 충격이 없으면 보스 · 정예 발밑에, 소용돌이가 넘치면 가까운 적 발밑에라도 깐다
      if (!d || d.n < 3) {
        if (p.skills.earthshock) return false;
        const t = smPriority(560, null);
        if (!t || !(t.boss || t.elite || p.ms >= p.msMax - 10)) return false;
        d = { x: t.x, y: t.y };
      }
      if (!smSpend(s.cost, sk)) return false;
      smQuake(d.x, d.y, s, s.dur * p.stats.dur, smMoe() * (p.legend.greatsundering ? 1.3 : 1));
      G.Audio.play('quake');
      return true;
    },
  },
  fireelemental: {},
  lightningshield: {},

  stormkeeper: {
    cast(sk) {
      const p = SM(); p.skN = sk.s.stacks; p.skT = 20;
      G.fx.ring(p.x, p.y - 20, 10, 80, 0.5, '160,180,255', 5);
      for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283; p.bolts.push(smBolt(p.x + Math.cos(a) * 70, p.y - 140, p.x, p.y - 30, 0.3, '190,200,255', 2)); }
      G.Audio.play('thunder', 0.6); G.Audio.play('buff', 0.5);
    },
  },
  capacitortotem: {
    cast(sk) {
      const p = SM(), s = sk.s, [x, y] = smSpot(450), R = s.radius * p.stats.area;
      G.Zones.add({ kind: 'smcap', x, y, r: R, life: s.delay, draw: smDrawCapTotem,
        onEnd: z => {
          G.aoe(z.x, z.y, z.r, s.dmg, 'capacitortotem', { school: 'nature' }, e => { if (!e.boss) e.stunT = Math.max(e.stunT || 0, s.stun * (e.elite ? 0.5 : 1)); });
          for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283, r = Math.random() * z.r; p.bolts.push(smBolt(z.x, z.y - 46, z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * 0.75, 0.3, '150,220,255', 1.8, 0.3)); }
          G.fx.ring(z.x, z.y, 10, z.r, 0.45, '140,210,255', 7, 0.3); G.fx.wave(z.x, z.y, z.r * 1.2, '170,225,255', 0.4);
          G.fx.burst(z.x, z.y - 40, 30, { rgb: '170,225,255', sp: 260, size: 10 }); G.fx.shake(6);
          G.Audio.play('thunder', 0.9, z.x);
        } });
      G.Audio.play('click');
    },
  },
  elementalblast: {
    cast(sk) {
      const p = SM(), s = sk.s, m = G.aimPoint();
      const t = G.nearestEnemy(m.x, m.y, 320) || G.nearestEnemy(p.x, p.y, SM_RANGE);
      if (!t) { G.UI.error('대상이 없습니다.'); return false; }
      const [hx, hy] = smHand();
      G.Proj.spawn({ x: hx, y: hy, a: Math.atan2(t.y - 20 - hy, t.x - hx), speed: 1100, r: 12, kind: 'smblast', homing: t, turn: 14, noRetarget: true, life: 1.2, draw: smDrawBlast, update: smBlastTrail,
        onHit: e => {
          smHit(e, s.dmg, 'elementalblast', { school: 'arcane' });
          G.fx.burst(e.x, e.y, 26, { rgb: Math.random() < 0.5 ? '230,150,255' : '255,160,80', sp: 240, size: 12 });
          G.fx.ring(e.x, e.y, 6, 70, 0.35, '230,170,255', 6); G.fx.shake(4); G.Audio.play('explode', 0.6, e.x);
        } });
      smMs(s.ms);
      const k = U.choice(['crit', 'haste', 'mastery']);
      p.ebK = k; p.ebT = 10; p.ebV = s.buff; G.P.recalc();
      G.fx.text(p.x, p.y - 64, { crit: '치명타 증가', haste: '가속 증가', mastery: '과부하 증가' }[k], '#e0b0ff', 14);
      G.Audio.play('cast', 0.7); G.Audio.play('zap', 0.5);
    },
  },
  earthbindtotem: {
    cast(sk) {
      const p = SM(), s = sk.s, [x, y] = smSpot(450), R = s.radius * p.stats.area;
      G.Zones.add({ kind: 'smbind', x, y, r: R, life: s.dur * p.stats.dur, tick: 0.5, tickT: 0, seen: new Set(), draw: smDrawBindTotem,
        onTick: z => {
          for (const e of G.Grid.query(z.x, z.y, z.r)) {
            G.chill(e, s.slow, 1);
            if (s.grip && !e.boss && !z.seen.has(e)) { z.seen.add(e); e.stunT = Math.max(e.stunT || 0, 2 * (e.elite ? 0.5 : 1)); G.fx.burst(e.x, e.y, 5, { rgb: '170,140,90', sp: 60, size: 8, type: 'smoke', add: false }); }
          }
        } });
      G.Audio.play('quake', 0.4);
    },
  },
  ascendance: {
    cast(sk) { smAscend(sk.s.dur * SM().stats.dur, true); },
  },
  gustofwind: {
    cast(sk) {
      const p = SM(), s = sk.s;
      let a;
      if (p.moving) a = Math.atan2(p.mvy, p.mvx);
      else if (G.autoCasting) { const e = G.nearestEnemy(p.x, p.y, 400); a = e ? Math.atan2(p.y - e.y, p.x - e.x) : 0; }
      else { const m = G.aimPoint(); a = Math.atan2(m.y - p.y, m.x - p.x); }
      const dur = 0.26;
      p.rootT = 0; p.gust = { vx: Math.cos(a) * s.dist / dur, vy: Math.sin(a) * s.dist / dur, t: 0, dur };
      G.fx.burst(p.x, p.y, 16, { rgb: '200,255,230', sp: 160, size: 10 });
      G.Audio.play('blink', 0.6);
    },
  },
  astralshift: {
    cast(sk) { const p = SM(); p.asT = p.drT = sk.s.dur; p.dr = sk.s.dr; G.fx.ring(p.x, p.y, 10, 60, 0.5, '160,190,255', 5); G.Audio.play('buff', 0.7); },
  },
  healingsurge: {
    usable() { const p = SM(); return p.hp < p.maxHp; },
    cast(sk) {
      const p = SM(); G.P.heal(p.maxHp * sk.s.heal);
      G.fx.burst(p.x, p.y - 10, 26, { rgb: '90,255,180', sp: 150, size: 10 });
      for (let i = 0; i < 10; i++) G.fx.part({ x: p.x + U.rand(-16, 16), y: p.y + U.rand(-4, 20), vy: U.rand(-180, -90), life: 0.7, size: 7, rgb: '120,230,255' });
      G.Audio.play('buff', 0.6);
    },
  },
  earthelemental: {
    cast(sk) {
      const p = SM(), s = sk.s, e = G.nearestEnemy(p.x, p.y, 400), a = e ? Math.atan2(e.y - p.y, e.x - p.x) : p.face > 0 ? 0 : Math.PI;
      G.images = G.images.filter(im => im.kind !== 'smearth');
      G.images.push({ kind: 'smearth', x: p.x + Math.cos(a) * 60, y: p.y + Math.sin(a) * 40, face: 1, hp: p.maxHp * s.hp, maxHp: p.maxHp * s.hp, life: s.dur, t: 0, atkT: 0.6, dmg: s.dmg,
        update: smEarthUpdate, draw: smDrawEarth });
      G.fx.burst(p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 40, 26, { rgb: '150,120,80', sp: 200, size: 12, type: 'smoke', add: false });
      G.fx.shake(5); G.Audio.play('quake', 0.8);
    },
  },
  spiritwalker: {
    cast(sk) { const p = SM(); p.swT = sk.s.dur; G.P.recalc(); G.fx.ring(p.x, p.y, 10, 60, 0.5, '160,255,220', 5); G.Audio.play('buff', 0.6); },
  },
  thunderstorm: {
    cast(sk) {
      const p = SM(), s = sk.s, R = s.radius * p.stats.area;
      for (const e of G.Grid.query(p.x, p.y, R)) {
        smHit(e, s.dmg, 'thunderstorm', { school: 'nature' }); G.chill(e, 0.4, 3);
        if (!e.boss) { const k = s.push * (e.elite ? 0.5 : 1), a = Math.atan2(e.y - p.y, e.x - p.x); e.x += Math.cos(a) * k; e.y += Math.sin(a) * k; }
      }
      for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283; p.bolts.push(smBolt(p.x + Math.cos(a) * R * 0.7, p.y - 220, p.x + Math.cos(a) * R * 0.7, p.y + Math.sin(a) * R * 0.5, 0.25, '170,190,255', 2.2)); }
      G.fx.wave(p.x, p.y, R * 1.2, '170,190,255', 0.4); G.fx.ring(p.x, p.y, 10, R, 0.4, '150,170,255', 8, 0.25);
      G.fx.flash('170,190,255', 0.12, 0.15); G.fx.shake(7); G.Audio.play('thunder');
    },
  },
  reincarnation: {
    usable() { return false; },
    cast() { return false; },
  },
});

// 번개 한 줄기: 즉시 맞는다. 폭풍우면 폭발 + 연쇄
function smLightning(t, dmg, s, tempest, src) {
  const p = SM(), [hx, hy] = smHand();
  const tsrc = tempest ? 'tempest' : src;
  smHit(t, dmg, tsrc, { school: 'nature', light: true });
  p.bolts.push(smBolt(hx, hy, t.x, t.y - 20, tempest ? 0.35 : 0.18, tempest ? '190,170,255' : src === 'overload' ? '220,235,255' : '160,210,255', tempest ? 4 : src === 'overload' ? 1.4 : 2.2));
  G.fx.burst(t.x, t.y - 16, tempest ? 26 : 7, { rgb: tempest ? '190,170,255' : '180,220,255', sp: tempest ? 260 : 120, size: tempest ? 13 : 8 });
  if (s.arc) for (const o of nearestN(t.x, t.y, s.arc + 1, 220).filter(o => o !== t).slice(0, s.arc)) {
    smHit(o, dmg * 0.4, src, { school: 'nature', small: true });
    p.bolts.push(smBolt(t.x, t.y - 20, o.x, o.y - 20, 0.14, '170,215,255', 1.2));
  }
  if (tempest) {
    const R = 140 * p.stats.area;
    for (const o of G.Grid.query(t.x, t.y, R)) if (o !== t) smHit(o, dmg * 0.6, 'tempest', { school: 'nature', small: true });
    smChain(t, 5, dmg * 0.4, 'tempest', null, true);
    G.fx.ring(t.x, t.y, 8, R, 0.4, '180,160,255', 7, 0.3); G.fx.wave(t.x, t.y, R * 1.3, '200,180,255', 0.4);
    G.fx.flash('180,170,255', 0.1, 0.15); G.fx.shake(6); G.Audio.play('thunder', 0.9, t.x);
  }
}
// 연쇄: first부터 가까운 적으로 n명까지 튄다. from이 있으면 첫 줄기를 그린다. 맞힌 수를 돌려준다
function smChain(first, n, dmg, src, from, skipFirst) {
  const p = SM(), hit = new Set([first]);
  let cur = first, k = 0;
  if (from) p.bolts.push(smBolt(from[0], from[1], first.x, first.y - 20, 0.22, '170,215,255', 2.4));
  if (!skipFirst) { smHit(first, dmg, src, { school: 'nature', light: true }); k++; }
  while (k < n) {
    const nx = G.nearestEnemy(cur.x, cur.y, 230, e => !hit.has(e)); if (!nx) break;
    hit.add(nx); p.bolts.push(smBolt(cur.x, cur.y - 20, nx.x, nx.y - 20, 0.22, '170,215,255', 2));
    smHit(nx, dmg, src, { school: 'nature', light: true, small: true }); k++; cur = nx;
  }
  return k;
}
function smLava(t, dmg, s, src) {
  const p = SM(), [hx, hy] = smHand();
  G.Proj.spawn({ x: hx, y: hy, a: Math.atan2(t.y - 20 - hy, t.x - hx), speed: 1000, r: 11, kind: 'smlava', homing: t, turn: 16, noRetarget: true, life: 1.1, big: src === 'overload' ? 0.75 : 1, draw: smDrawLava, update: smLavaTrail,
    onHit: e => {
      const fs = G.Dots.has(e, 'flameshock');
      smHit(e, dmg, src, { school: 'fire', fire: true, crit: fs ? 1 : 0 });
      if (s.splash) for (const o of G.Grid.query(e.x, e.y, 90 * p.stats.area)) if (o !== e) smHit(o, dmg * 0.3 * s.splash, src, { school: 'fire', fire: true, small: true });
      if (p.legend.skybreaker) for (const o of G.Grid.query(e.x, e.y, 180)) if (o !== e && G.Dots.has(o, 'flameshock')) smHit(o, dmg * 0.4, 'skybreaker', { school: 'fire', fire: true, small: true, crit: 1 });
      G.fx.burst(e.x, e.y, 18, { rgb: '255,120,40', sp: 200, size: 12 }); G.fx.ring(e.x, e.y, 5, 54, 0.3, '255,150,60', 5);
      G.fx.decal(e.x, e.y + e.r * 0.6, 'scorch', 0.6);
      G.Audio.play('hitFire', 0.8, e.x);
      if (e.boss || e.elite) G.fx.hitStop(0.025);
    } });
}
// 지진 장판
function smQuake(x, y, s, dur, mul) {
  const p = SM(), R = s.radius * p.stats.area;
  G.Zones.add({ kind: 'smquake', x, y, r: R, life: dur, tick: 0.5, tickT: 0.1, draw: smDrawQuake,
    onTick: z => {
      for (const e of G.Grid.query(z.x, z.y, z.r)) {
        smHit(e, s.dmg * mul, 'earthquake', { small: true });
        smRod(e);
        if (!e.boss && Math.random() < 0.1) e.stunT = Math.max(e.stunT || 0, e.elite ? 0.5 : 1);
      }
      G.fx.shake(1.5);
      if (Math.random() < 0.7) G.fx.burst(z.x + U.rand(-z.r, z.r) * 0.7, z.y + U.rand(-z.r, z.r) * 0.5, 5, { rgb: '140,110,70', sp: 80, size: 9, type: 'smoke', add: false });
    } });
}
const smRod = e => { const p = SM(); if (!p.stats.rod || e.dead) return; if (!(e.rodT > G.t)) p.rods.push(e); e.rodT = G.t + 8; };
// 승천: show=true면 주변 폭발 + 화염 충격 (깊게 뿌리내린 정령은 조용히 발동)
function smAscend(dur, show) {
  const p = SM(), sk = p.skills.ascendance, s = sk ? sk.s : G.SKILLS.ascendance.base;
  p.ascT = Math.max(p.ascT, dur); G.P.recalc();
  if (show) {
    const R = 220 * p.stats.area;
    for (const e of G.Grid.query(p.x, p.y, R)) { smHit(e, s.dmg, 'ascendance', { school: 'fire', fire: true }); smFs(e); }
    G.fx.wave(p.x, p.y, R * 1.2, '255,180,80', 0.5); G.fx.ring(p.x, p.y, 10, R, 0.5, '255,150,60', 8, 0.3);
    G.fx.burst(p.x, p.y - 20, 50, { rgb: '255,150,60', sp: 300, size: 13 }); G.fx.flash('255,170,80', 0.15, 0.2); G.fx.shake(8);
    G.Audio.play('explode'); G.Audio.play('buff', 0.6);
  } else G.fx.text(p.x, p.y - 70, '승천!', '#ffb040', 18, true);
}
// 선조: 소용돌이를 쓸 때마다 하나 더 (최대 4)
function smCallAncestor(life) {
  const p = SM(), temps = p.ancestors.filter(a => !a.perm);
  if (temps.length >= 4) { const old = temps.reduce((m, a) => (a.life < m.life ? a : m)); old.life = life; return; }
  p.ancestors.push({ x: p.x, y: p.y - 60, t: Math.random() * 6, atkT: 0.4, life, lava: Math.random() < 0.5, idx: p.ancestors.length });
  G.fx.burst(p.x, p.y - 60, 14, { rgb: '170,230,255', sp: 120, size: 10 });
}

// 매 프레임: 불의 정령 / 선조, 번개 보호막, 승천 중 용암 폭발 재사용, 번개 그림
function smSkillsUpdate(p, dt) {
  const hs = 1 + G.P.haste();
  if (p.ascT > 0 && p.skills.lavaburst) G.Skills.reduceCd(p.skills.lavaburst, dt * hs * 3);
  // 불의 정령 (선견자: 선조)
  const fe = p.skills.fireelemental;
  if (fe) {
    const s = fe.s, far = !!p.evo.farseer;
    if (far) {
      if (!p.ancestors.some(a => a.perm)) p.ancestors.unshift({ x: p.x, y: p.y - 60, t: 0, atkT: 1, life: 1, perm: true, lava: false, idx: 0 });
      p.fe = null;
    } else {
      const q = p.fe || (p.fe = { x: p.x - 50, y: p.y - 30, t: 0, atkT: 1, spT: 3, face: 1 });
      q.t += dt; q.atkT -= dt * hs; q.spT -= dt;
      const tx = p.x - p.face * 50, ty = p.y - 40 + Math.sin(q.t * 2) * 6;
      q.x += (tx - q.x) * Math.min(1, dt * 4); q.y += (ty - q.y) * Math.min(1, dt * 4);
      const t = G.nearestEnemy(q.x, q.y, 560);
      if (t) {
        q.face = t.x > q.x ? 1 : -1;
        if (q.atkT <= 0) {
          q.atkT = s.atk;
          G.Proj.spawn({ x: q.x, y: q.y, a: Math.atan2(t.y - 20 - q.y, t.x - q.x), speed: 700, r: 9, kind: 'smlava', homing: t, turn: 10, noRetarget: true, life: 1.2, big: 0.6, draw: smDrawLava, update: smLavaTrail,
            onHit: e => { smHit(e, s.dmg, 'fireelemental', { school: 'fire', small: true }); G.fx.burst(e.x, e.y, 6, { rgb: '255,140,60', sp: 100, size: 8 }); } });
        }
        if (s.spread && q.spT <= 0) {
          q.spT = 6;
          for (const e of nearestN(q.x, q.y, 3, 500, e => !G.Dots.has(e, 'flameshock')).filter(e => !G.Dots.has(e, 'flameshock'))) { smFs(e); G.fx.burst(e.x, e.y - 10, 6, { rgb: '255,130,50', sp: 80, size: 8 }); }
        }
      }
    }
    for (const a of p.ancestors) {
      a.t += dt; a.atkT -= dt * hs; if (!a.perm) a.life -= dt;
      const ang = a.idx * 1.3 + 2.2, tx = p.x + Math.cos(ang) * 64, ty = p.y - 46 + Math.sin(ang) * 22 + Math.sin(a.t * 2) * 5;
      a.x += (tx - a.x) * Math.min(1, dt * 3); a.y += (ty - a.y) * Math.min(1, dt * 3);
      const t = a.atkT <= 0 && G.nearestEnemy(a.x, a.y, SM_RANGE);
      if (t) {
        a.atkT = 1.5; a.lava = !a.lava;
        if (a.lava) {
          G.Proj.spawn({ x: a.x, y: a.y, a: Math.atan2(t.y - 20 - a.y, t.x - a.x), speed: 900, r: 9, kind: 'smlava', homing: t, turn: 14, noRetarget: true, life: 1.1, big: 0.7, draw: smDrawLava, update: smLavaTrail,
            onHit: e => smHit(e, s.dmg * 1.5, 'ancestor', { school: 'fire', fire: true, small: true, crit: G.Dots.has(e, 'flameshock') ? 1 : 0 }) });
        } else {
          smHit(t, s.dmg * 1.5, 'ancestor', { school: 'nature', light: true, small: true });
          p.bolts.push(smBolt(a.x, a.y, t.x, t.y - 20, 0.16, '170,230,255', 1.6));
        }
      }
    }
    p.ancestors = far ? p.ancestors.filter(a => a.perm || a.life > 0) : [];
    p.ancestors.forEach((a, i) => (a.idx = i));
  } else { p.fe = null; p.ancestors = []; }
  // 번개 보호막: 구슬마다 가까운 적 한 명에게 방전
  const ls = p.skills.lightningshield;
  if (ls) {
    p.lsT -= dt * hs;
    if (p.lsT <= 0) {
      p.lsT = ls.s.iv;
      const tg = nearestN(p.x, p.y, ls.s.orbs, ls.s.range * p.stats.area);
      tg.forEach((e, i) => {
        smHit(e, ls.s.dmg, 'lightningshield', { school: 'nature', small: true });
        const a = p.lsA + i / ls.s.orbs * 6.283;
        p.bolts.push(smBolt(p.x + Math.cos(a) * 30, p.y - 20 + Math.sin(a) * 14, e.x, e.y - 16, 0.12, '150,190,255', 1.3, 0.3));
      });
      if (tg.length) { smMs(ls.s.ms); G.Audio.play('zap', 0.25); }
    }
  }
  p.lsA += dt * 2.5;
  for (const b of p.bolts) b.t += dt;
  p.bolts = p.bolts.filter(b => b.t < b.life);
  if (p.bolts.length > 80) p.bolts.splice(0, p.bolts.length - 80);
  p.rods = p.rods.filter(e => !e.dead && e.rodT > G.t);
}

function smEarthUpdate(im, dt) {
  im.t += dt; im.life -= dt; im.atkT -= dt;
  const e = G.nearestEnemy(im.x, im.y, 300);
  if (!e) return;
  const dx = e.x - im.x, dy = e.y - im.y, d = Math.hypot(dx, dy) || 1;
  im.face = dx > 0 ? 1 : -1;
  if (d > e.r + 26) { im.x += dx / d * 120 * dt; im.y += dy / d * 120 * dt; }
  else if (im.atkT <= 0) {
    im.atkT = 1.2; im.punch = 0.2;
    smHit(e, im.dmg, 'earthelemental', { small: true });
    G.fx.burst(e.x, e.y, 8, { rgb: '170,140,90', sp: 120, size: 9, type: 'smoke', add: false });
  }
  if (im.punch > 0) im.punch -= dt;
}

// ---------- 그림 ----------
// 주술사 그림 (64×76, 발 기준 y≈70): 푸른 사슬 갑옷 · 늑대 가죽 견갑 · 뿔 투구 · 토템 지팡이
function drawShamanSprite(x) {
  // 가죽 치마 · 장화
  poly(x, [[19, 50], [45, 50], [48, 66], [16, 66]], '#5a3a20');
  poly(x, [[16, 62], [48, 62], [48, 68], [16, 68]], '#3a2410');
  // 사슬 갑옷 (청록)
  poly(x, [[22, 27], [42, 27], [46, 52], [18, 52]], lg(x, 0, 27, 0, 52, [[0, '#3a7aa0'], [0.6, '#2a5a7a'], [1, '#18384e']]));
  x.save(); x.globalAlpha = 0.35; for (let yy = 30; yy < 51; yy += 3) for (let xx = 21 + (yy % 2); xx < 44; xx += 3) ell(x, xx, yy, 0.8, 0.8, '#c0e0f0'); x.restore();
  // 허리띠 + 토템 버클
  poly(x, [[19, 46], [45, 46], [46, 50], [18, 50]], '#4a2a10', '#1a0e04');
  poly(x, [[29, 45], [35, 45], [35, 51], [29, 51]], '#c0a040');
  ell(x, 32, 48, 1.6, 1.6, '#60c0ff');
  // 늑대 가죽 견갑 (털 + 이빨)
  ell(x, 19, 29, 8, 6, '#8a8a90'); ell(x, 45, 29, 8, 6, '#8a8a90');
  for (const sx of [13, 17, 21, 39, 43, 47]) poly(x, [[sx, 32], [sx + 2, 37], [sx + 4, 32]], '#e8e0c8');
  ell(x, 19, 27, 5, 3, '#b0b0b8'); ell(x, 45, 27, 5, 3, '#b0b0b8');
  // 뿔 투구
  ell(x, 32, 19, 10, 10, '#4a5a6a');
  poly(x, [[23, 15], [14, 4], [19, 3], [26, 12]], '#e0d8c0'); poly(x, [[41, 15], [50, 4], [45, 3], [38, 12]], '#e0d8c0');
  poly(x, [[24, 18], [40, 18], [40, 21], [24, 21]], '#c0a040');
  ell(x, 34, 24, 6, 5.5, '#c89a78');
  eyes(x, [[32.5, 23], [36.5, 23]], '#80d8ff', 1.3);
  // 수염 (땋은)
  poly(x, [[29, 27], [39, 27], [37, 34], [34, 38], [31, 34]], '#6a4a30');
  // 토템 지팡이 (나무 + 깃털 + 푸른 수정은 drawBody에서 빛으로)
  line(x, 52, 10, 49, 70, '#5a3a18', 3.4);
  poly(x, [[47, 6], [57, 6], [56, 16], [48, 16]], '#7a5030', '#2a1808');
  ell(x, 52, 11, 2, 2, '#60d0ff');
  poly(x, [[47, 14], [43, 22], [46, 23]], '#e0e0e0'); poly(x, [[57, 14], [60, 23], [57, 23]], '#c04030');
  ell(x, 50, 40, 3.2, 3.2, '#c89a78');
}
function smDrawBoltPath(c, b) {
  const f = 1 - b.t / b.life;
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(b.pts[0][0], b.pts[0][1]); for (let i = 1; i < b.pts.length; i++) c.lineTo(b.pts[i][0], b.pts[i][1]);
  c.strokeStyle = `rgba(${b.rgb},${0.3 * f})`; c.lineWidth = b.w * 4; c.stroke();
  c.strokeStyle = `rgba(235,245,255,${0.95 * f})`; c.lineWidth = b.w; c.stroke();
  c.globalCompositeOperation = 'source-over';
}
function smDrawLava(c, pr) {
  const sc = pr.big || 1;
  c.globalCompositeOperation = 'lighter';
  c.drawImage(G.Spr.glow('255,110,30', 64), pr.x - 22 * sc, pr.y - 22 * sc, 44 * sc, 44 * sc);
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#3a1408'; c.beginPath(); c.arc(pr.x, pr.y, 7 * sc, 0, 7); c.fill();
  c.fillStyle = '#ffb040'; c.beginPath(); c.arc(pr.x - 1.5 * sc, pr.y - 1.5 * sc, 4.5 * sc, 0, 7); c.fill();
  c.fillStyle = '#fff0a0'; c.beginPath(); c.arc(pr.x - 2 * sc, pr.y - 2 * sc, 2 * sc, 0, 7); c.fill();
}
function smLavaTrail(pr) {
  if (Math.random() < 0.8) G.fx.part({ x: pr.x, y: pr.y, life: 0.3, size: 9 * (pr.big || 1), rgb: Math.random() < 0.5 ? '255,120,30' : '255,190,80', vx: U.rand(-20, 20), vy: U.rand(-20, 20) });
  if (Math.random() < 0.2) G.fx.part({ x: pr.x, y: pr.y, life: 0.5, size: 7, rgb: '60,40,30', type: 'smoke', add: false });
}
function smDrawBlast(c, pr) {
  c.globalCompositeOperation = 'lighter';
  const r = 26 + Math.sin(G.t * 30) * 3;
  c.drawImage(G.Spr.glow('230,140,255', 64), pr.x - r, pr.y - r, r * 2, r * 2);
  c.drawImage(G.Spr.glow('255,170,80', 32), pr.x - 9, pr.y - 9, 18, 18);
  c.globalCompositeOperation = 'source-over';
}
function smBlastTrail(pr) { G.fx.part({ x: pr.x, y: pr.y, life: 0.3, size: 10, rgb: ['230,140,255', '255,160,80', '140,210,255', '140,255,170'][Math.floor(Math.random() * 4)] }); }
function smDrawQuake(c, z, life) {
  c.save(); c.translate(z.x, z.y); c.scale(1, 0.7);
  c.fillStyle = `rgba(110,80,40,${0.22 * life})`; c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.fill();
  c.strokeStyle = `rgba(60,40,20,${0.7 * life})`; c.lineWidth = 2.5;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * 6.283 + 0.3; c.beginPath(); c.moveTo(0, 0);
    for (let k = 1; k <= 4; k++) { const rr = z.r * k / 4, w = (U.hash(i, k, 7) - 0.5) * 0.5; c.lineTo(Math.cos(a + w) * rr, Math.sin(a + w) * rr); }
    c.stroke();
  }
  c.restore();
  const sh = Math.sin(z.t * 40) * 2;
  c.strokeStyle = `rgba(200,170,110,${0.5 * life})`; c.lineWidth = 2;
  c.beginPath(); c.ellipse(z.x + sh, z.y, z.r, z.r * 0.7, 0, 0, 7); c.stroke();
}
function smDrawTotemPole(c, x, y, top, glowRgb) {
  c.fillStyle = '#5a3a18'; c.fillRect(x - 5, y - 46, 10, 46);
  c.fillStyle = '#7a5030'; c.fillRect(x - 8, y - 56, 16, 14);
  c.fillStyle = top; c.fillRect(x - 6, y - 52, 3, 3); c.fillRect(x + 3, y - 52, 3, 3);
  c.fillStyle = '#3a2410'; c.fillRect(x - 9, y - 30, 18, 4);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6 + Math.sin(G.t * 8) * 0.2;
  c.drawImage(G.Spr.glow(glowRgb, 64), x - 22, y - 70, 44, 44);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function smDrawCapTotem(c, z) {
  const f = Math.min(1, z.t / Math.max(0.01, z.t + z.life));
  c.save(); c.translate(z.x, z.y); c.scale(1, 0.75);
  c.strokeStyle = `rgba(140,210,255,${0.25 + f * 0.5})`; c.lineWidth = 2; c.setLineDash([10, 8]); c.lineDashOffset = -z.t * 60;
  c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.stroke(); c.setLineDash([]);
  c.fillStyle = `rgba(140,210,255,${0.08 + f * 0.12})`; c.beginPath(); c.arc(0, 0, z.r * f, 0, 7); c.fill();
  c.restore();
  smDrawTotemPole(c, z.x, z.y, '#80e0ff', '140,210,255');
  if (Math.random() < 0.5) { c.globalCompositeOperation = 'lighter'; const a = Math.random() * 6.283; smDrawBoltPath(c, smBolt(z.x, z.y - 50, z.x + Math.cos(a) * 30, z.y - 50 + Math.sin(a) * 24, 1, '150,220,255', 1, 0.4)); }
}
function smDrawBindTotem(c, z, life) {
  c.save(); c.translate(z.x, z.y); c.scale(1, 0.75);
  c.fillStyle = `rgba(120,95,60,${0.15 * life})`; c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.fill();
  c.strokeStyle = `rgba(170,140,90,${0.55 * life})`; c.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const r = ((z.t * 0.6 + i / 3) % 1) * z.r; c.globalAlpha = 1 - r / z.r; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); }
  c.globalAlpha = 1; c.restore();
  smDrawTotemPole(c, z.x, z.y, '#c0a060', '200,170,110');
}
function smDrawEarth(c, im) {
  const x = im.x, y = im.y, fade = Math.min(1, im.life * 2), pu = im.punch > 0 ? 8 : 0;
  c.save(); c.globalAlpha = fade; c.translate(x, y); if (im.face < 0) c.scale(-1, 1);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 4, 26, 8, 0, 0, 7); c.fill();
  c.fillStyle = '#6a5a48'; c.beginPath(); c.moveTo(-18, 0); c.lineTo(-22, -40); c.lineTo(-8, -60); c.lineTo(12, -58); c.lineTo(22, -38); c.lineTo(16, 0); c.closePath(); c.fill();
  c.fillStyle = '#857058'; c.beginPath(); c.moveTo(-10, -56); c.lineTo(8, -54); c.lineTo(14, -40); c.lineTo(-6, -36); c.closePath(); c.fill();
  c.fillStyle = '#5a4a38'; c.beginPath(); c.arc(-24, -34, 9, 0, 7); c.fill(); c.beginPath(); c.arc(26 + pu, -32, 10, 0, 7); c.fill();
  c.fillStyle = '#ffb040'; c.fillRect(-2, -50, 4, 3); c.fillRect(6, -50, 4, 3);
  c.restore();
  // 생명력 막대
  const f = Math.max(0, im.hp / im.maxHp);
  c.fillStyle = '#000'; c.fillRect(x - 20, y - 72, 40, 4); c.fillStyle = '#c0a060'; c.fillRect(x - 19, y - 71, 38 * f, 2);
}
function smDrawFireElemental(c, q) {
  const x = q.x, y = q.y, fl = Math.sin(G.t * 12) * 2;
  c.globalCompositeOperation = 'lighter';
  c.drawImage(G.Spr.glow('255,110,30', 128), x - 34, y - 40, 68, 76);
  c.fillStyle = 'rgba(255,140,40,0.85)';
  c.beginPath(); c.moveTo(x - 12, y + 16); c.quadraticCurveTo(x - 18, y - 6, x - 6, y - 24 + fl); c.quadraticCurveTo(x, y - 34, x + 6, y - 24 - fl); c.quadraticCurveTo(x + 18, y - 6, x + 12, y + 16); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,230,140,0.9)'; c.beginPath(); c.ellipse(x, y - 4, 7, 12, 0, 0, 7); c.fill();
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#401000'; c.fillRect(x - 5 + q.face * 2, y - 14, 3, 3); c.fillRect(x + 2 + q.face * 2, y - 14, 3, 3);
  if (Math.random() < 0.5) G.fx.part({ x: x + U.rand(-8, 8), y: y - 20, vy: -60, life: 0.4, size: 7, rgb: '255,150,50' });
}
function smDrawAncestor(c, a) {
  const x = a.x, y = a.y, al = a.perm ? 0.85 : Math.max(0, Math.min(0.85, a.life * 1.5));
  c.globalAlpha = al; c.globalCompositeOperation = 'lighter';
  c.drawImage(G.Spr.glow('140,210,255', 128), x - 26, y - 34, 52, 64);
  c.fillStyle = 'rgba(170,225,255,0.55)';
  c.beginPath(); c.moveTo(x - 9, y + 18); c.quadraticCurveTo(x - 13, y - 4, x - 7, y - 12); c.lineTo(x + 7, y - 12); c.quadraticCurveTo(x + 13, y - 4, x + 9, y + 18); c.closePath(); c.fill();
  c.beginPath(); c.arc(x, y - 18, 7, 0, 7); c.fill();
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#e8f8ff'; c.fillRect(x - 3, y - 20, 2, 2); c.fillRect(x + 2, y - 20, 2, 2);
  c.globalAlpha = 1;
}

// ---------- 직업 정의 ----------
G.CLASSES.shaman = {
  id: 'shaman', name: '정기 주술사', className: '주술사', spec: '정기', color: '#0070dd', icon: 'classshaman',
  starter: 'lightningbolt', bar: 'maelstrom', masteryText: `특화(정령 과부하): 번개 화살 · 용암 폭발 · 연쇄 번개가 ${Math.round(SM_OVERLOAD * 100)}%/점 확률로 한 번 더 (75% 피해)`,

  init(p) {
    Object.assign(p, {
      ms: 0, msMax: 100, skN: 0, skT: 0, tempest: 0, tmMs: 0, moe: 0, wsLava: 0, surgeICD: 0, surgeT: 0,
      ascT: 0, swT: 0, asT: 0, drT: 0, dr: 0, ebT: 0, ebK: null, ebV: 0, gust: null, reincT: 0,
      fe: null, ancestors: [], bolts: [], rods: [], lsT: 0.5, lsA: 0,
    });
  },
  recalc(st, p) {
    st.armor += 0.05; // 사슬 갑옷: 주술사 기본 피해 감소
    if (p.ascT > 0) st.haste += p.skills.ascendance && p.skills.ascendance.s ? p.skills.ascendance.s.haste : 0.1;
    if (p.swT > 0) { st.movePenalty = 0; st.speedMul += p.skills.spiritwalker && p.skills.spiritwalker.s ? p.skills.spiritwalker.s.speed : 0.2; }
    if (p.ebT > 0) { if (p.ebK === 'crit') st.crit += p.ebV; else if (p.ebK === 'haste') st.haste += p.ebV; }
    p.msMax = 100 + (st.msMax || 0);
  },
  computeSkill(sk, s, p) {
    if (sk.id === 'lightningbolt' && p.evo.tempest) s.dmg *= 1.2;
  },
  haste() { return 0; },
  onCrit() {},
  onKill(e, p) { if (e.onDeath) { const f = e.onDeath; e.onDeath = null; f(); } },
  busy() { return false; },
  immune(p) { return !!p.gust || p.reincT > 0; },
  activate(id, p) {
    if (id === 'reincarnation') { G.UI.error('윤회는 쓰러질 때 자동으로 발동합니다.'); return false; }
  },
  // 치명상: 윤회가 준비돼 있으면 되살아난다
  preventDeath(p) {
    const rk = p.skills.reincarnation;
    if (!rk || rk.charges <= 0) return false;
    p.hp = Math.max(1, Math.round(p.maxHp * rk.s.hp)); p.reincT = 2;
    G.Skills.startCd(rk);
    for (const e of G.Grid.query(p.x, p.y, 220)) if (!e.boss) { const a = Math.atan2(e.y - p.y, e.x - p.x), k = e.elite ? 80 : 160; e.x += Math.cos(a) * k; e.y += Math.sin(a) * k; }
    G.eprojs = G.eprojs.filter(b => U.d2(b.x, b.y, p.x, p.y) > 300 * 300);
    G.fx.text(p.x, p.y - 60, '윤회!', '#ffe0a0', 22, true);
    G.fx.wave(p.x, p.y, 260, '255,230,160', 0.6); G.fx.burst(p.x, p.y - 20, 40, { rgb: '255,230,160', sp: 240, size: 12 }); G.fx.flash('255,240,200', 0.25, 0.3);
    G.Audio.play('buff'); G.Audio.play('thunder', 0.5);
    return true;
  },
  autoRule(id, p) {
    const hp = p.hp / p.maxHp, near = G.nearestEnemy(p.x, p.y, 160), boss = !!(G.Waves.boss && !G.Waves.boss.dead);
    if (id === 'stormkeeper') return p.skN > 0 ? false : undefined;
    if (id === 'ascendance') return G.enemies.length >= 25 || boss ? true : false;
    if (id === 'astralshift') return hp < 0.5 && p.asT <= 0 && !!near ? true : false;
    if (id === 'healingsurge') return hp < 0.5 ? true : false;
    if (id === 'earthelemental') return (hp < 0.6 && !!near) || boss ? true : false;
    if (id === 'gustofwind') return hp < 0.5 && !!G.nearestEnemy(p.x, p.y, 90) ? true : false;
    if (id === 'spiritwalker') return p.moving && p.swT <= 0 ? true : false;
    if (id === 'thunderstorm') return G.Grid.query(p.x, p.y, 160).length >= 4;
    if (id === 'capacitortotem' || id === 'earthbindtotem') { const d = G.densestPoint(p.x, p.y, 450, 150); return d && d.n >= 6 ? undefined : false; }
    if (id === 'reincarnation') return false;
  },

  update(p, dt) {
    if (p.skT > 0 && (p.skT -= dt) <= 0) p.skN = 0;
    if (p.ascT > 0 && (p.ascT -= dt) <= 0) G.P.recalc();
    if (p.swT > 0 && (p.swT -= dt) <= 0) G.P.recalc();
    if (p.ebT > 0 && (p.ebT -= dt) <= 0) G.P.recalc();
    if (p.asT > 0) p.asT -= dt;
    if (p.drT > 0) p.drT -= dt;
    if (p.reincT > 0) p.reincT -= dt;
    if (p.surgeT > 0) p.surgeT -= dt;
    if (p.gust) {
      const g = p.gust; g.t += dt;
      p.x += g.vx * dt; p.y += g.vy * dt;
      if (Math.random() < 0.7) G.fx.part({ x: p.x + U.rand(-10, 10), y: p.y - U.rand(0, 30), life: 0.35, size: 10, rgb: '200,255,230' });
      if (g.t >= g.dur) p.gust = null;
    }
    if (p.ascT > 0 && Math.random() < 0.5) G.fx.part({ x: p.x + U.rand(-14, 14), y: p.y + U.rand(-30, 10), vy: U.rand(-120, -60), life: 0.5, size: U.rand(6, 11), rgb: Math.random() < 0.5 ? '255,140,40' : '255,200,90' });
  },
  skillsUpdate(p, dt) { smSkillsUpdate(p, dt); },

  // ---------- HUD ----------
  skillIcon(id, p) { return id === 'lightningbolt' && p.evo.tempest ? 'tempest' : id === 'fireelemental' && p.evo.farseer ? 'farseer' : G.SKILLS[id].icon; },
  resource(p) { return { cur: Math.floor(p.ms), max: p.msMax, label: '소용돌이' }; },
  castbar(p) {
    const lb = p.skills.lightningbolt;
    if (!lb || !(lb.castT > 0 && lb.castT < 1)) return null;
    return { f: lb.castT, name: p.tempest ? '폭풍우' : p.moving && !(p.swT > 0) ? '번개 화살 (이동 중)' : '번개 화살', total: lb.s.cast / (1 + G.P.haste()) };
  },
  slotState(id, p) {
    return {
      unusable: id === 'reincarnation',
      active: (id === 'ascendance' && p.ascT > 0) || (id === 'astralshift' && p.asT > 0) || (id === 'spiritwalker' && p.swT > 0) || (id === 'stormkeeper' && p.skN > 0),
    };
  },
  autoGlow(id, p) { return (id === 'lightningbolt' && (p.skN > 0 || p.tempest > 0)) || (id === 'lavaburst' && p.surgeT > 0) || ((id === 'earthshock' || id === 'earthquake') && p.ms >= 60); },
  buffs(p) {
    const b = [];
    if (p.ascT > 0) b.push(['ascendance', p.ascT, '', '승천', '용암 폭발 재사용 4배 · 가속 증가']);
    if (p.skN > 0) b.push(['stormkeeper', p.skT, p.skN, '폭풍수호자', '번개 화살 · 연쇄 번개 즉시 시전 · 피해 증가']);
    if (p.tempest > 0) b.push(['tempest', -1, '', '폭풍우', '다음 번개 화살이 폭풍우']);
    if (p.moe > 0 && p.stats.moe) b.push(['masterofelements', -1, '', '원소의 지배', '다음 번개 · 충격 · 지진 피해 증가']);
    if (p.wsLava > 0) b.push(['windspeaker', -1, '', '용암 부활', '다음 용암 폭발 피해 +50%']);
    if (p.ebT > 0) b.push(['elementalblast', p.ebT, '', '정령 작렬', { crit: '치명타 증가', haste: '가속 증가', mastery: '과부하 확률 증가' }[p.ebK]]);
    if (p.asT > 0) b.push(['astralshift', p.asT, '', '영혼 이동', `받는 피해 ${Math.round(p.dr * 100)}% 감소`]);
    if (p.swT > 0) b.push(['spiritwalker', p.swT, '', '영혼걸음의 은총', '이동 중 시전 · 이동 속도 증가']);
    if (p.reincT > 0) b.push(['reincarnation', p.reincT, '', '윤회', '피해 면역']);
    if (p.absorb > 0) b.push(['stoneskin', -1, Math.round(p.absorb), '대지 보호막', '피해 흡수']);
    return b;
  },

  // ---------- 그리기 ----------
  drawBody(c, x, y, face, alpha, image, t) {
    const S = G.Spr, p = G.player;
    if (!S.shaman) { S.shaman = S.make(64, 76, drawShamanSprite); S.shamanFlash = S.variants(S.shaman).flash; }
    const spr = !image && p.hurtT > 0 ? S.shamanFlash : S.shaman;
    const bob = (image || p.moving) ? Math.abs(Math.sin((t ?? G.t) * 10)) * -2.5 : Math.sin(G.t * 2) * 0.8;
    c.save(); c.globalAlpha = alpha; c.translate(x, y + 14 + bob); if (face < 0) c.scale(-1, 1); c.drawImage(spr, -32, -74); c.restore();
    // 지팡이 끝 원소 빛 (용암 쇄도면 주황, 폭풍수호자면 크게)
    const rgb = p.surgeT > 0 || p.ascT > 0 ? '255,140,50' : '120,200,255', r = p.skN > 0 || p.tempest > 0 ? 24 : 16;
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.7 + Math.sin(G.t * 7) * 0.2;
    c.drawImage(S.glow(rgb, 64), x + face * 20 - r, y + 14 + bob - 63 - r, r * 2, r * 2);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
  drawUnder(c, p) {
    if (p.ascT > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45 + Math.sin(G.t * 8) * 0.12; c.drawImage(G.Spr.glow('255,130,40', 128), p.x - 52, p.y - 72, 104, 112); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    if (p.asT > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3; c.drawImage(G.Spr.glow('150,180,255', 128), p.x - 44, p.y - 60, 88, 96); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    if (p.fe) smDrawFireElemental(c, p.fe);
  },
  drawOver(c, p) {
    for (const a of p.ancestors) smDrawAncestor(c, a);
    // 번개 보호막 구슬
    const ls = p.skills.lightningshield;
    if (ls) for (let i = 0; i < ls.s.orbs; i++) {
      const a = p.lsA + i / ls.s.orbs * 6.283, ox = p.x + Math.cos(a) * 30, oy = p.y - 20 + Math.sin(a) * 14;
      c.globalCompositeOperation = 'lighter'; c.drawImage(G.Spr.glow('130,180,255', 32), ox - 9, oy - 9, 18, 18); c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#e0f0ff'; c.beginPath(); c.arc(ox, oy, 2.5, 0, 7); c.fill();
    }
    for (const b of p.bolts) smDrawBoltPath(c, b);
    // 피뢰침 (번개 막대)
    if (p.rods.length) for (const e of p.rods) { const y = e.y - e.r * 2.6 * e.scale / 1.2 - 20; c.strokeStyle = 'rgba(190,215,255,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(e.x - 3, y - 8); c.lineTo(e.x + 2, y - 2); c.lineTo(e.x - 2, y); c.lineTo(e.x + 3, y + 7); c.stroke(); }
    // 폭풍수호자 중첩: 머리 위 번개 표식
    for (let i = 0; i < p.skN; i++) {
      const x = p.x - (p.skN - 1) * 8 + i * 16, y = p.y - 76 + Math.sin(G.t * 4 + i) * 2;
      c.fillStyle = '#c0d0ff'; c.beginPath(); c.moveTo(x + 2, y - 8); c.lineTo(x - 4, y + 1); c.lineTo(x, y + 1); c.lineTo(x - 2, y + 8); c.lineTo(x + 4, y - 1); c.lineTo(x, y - 1); c.closePath(); c.fill();
    }
    if (p.reincT > 0) { c.strokeStyle = `rgba(255,230,160,${0.5 + Math.sin(G.t * 10) * 0.3})`; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y - 14, 36, 0, 7); c.stroke(); }
    if (p.absorb > 0) { c.strokeStyle = 'rgba(200,170,110,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y - 12, 34, 0, 7); c.stroke(); }
  },

  // ---------- 레벨업 · 봇 ----------
  upgWeight(o, p) {
    if (o.type === 'new') return G.SKILLS[o.id].kind === 'auto' ? 1.15 : SM_DEFENSIVE.includes(o.id) && p.level < 8 ? 0.35 : 0.95;
    if (o.type === 'passive') return o.id === 'masterofelements' || o.id === 'lavasurgeP' ? 1.2 : 0.75;
    if (o.type === 'node') {
      let w = 1.2;
      if (o.id === 'lightningbolt' && p.level < 8) w = 2.2;
      if (o.id === 'lightningbolt' && (o.nodeId === 'count' || o.nodeId === 'cast') && p.level < 12) w += 0.8;
      return w;
    }
  },
  botUse(id, p) {
    if (id === 'reincarnation') return false;
    if (id === 'healingsurge' && p.hp > p.maxHp * 0.5) return false;
    if (id === 'astralshift' && (p.hp > p.maxHp * 0.5 || p.asT > 0)) return false;
    if (id === 'earthelemental' && p.hp > p.maxHp * 0.6 && !(G.Waves.boss && !G.Waves.boss.dead)) return false;
    if (id === 'gustofwind') return false;
    if (id === 'spiritwalker') return p.swT <= 0;
    if (id === 'stormkeeper') return p.skN <= 0;
    return true;
  },
  botScore(x, p) {
    if (x.type === 'evolution') return 100;
    if (x.type === 'legendary') return 80;
    if (x.type === 'node' && x.id === 'lightningbolt' && (x.nodeId === 'count' || x.nodeId === 'cast')) return 42;
    if (x.type === 'new' && G.SKILLS[x.id].kind === 'auto') return p.order.length < 6 ? 55 : 20;
    if (x.type === 'node' && x.nodeId === 'dmg') return 45;
    if (x.type === 'passive' && ['arcaneint', 'haste', 'crit', 'projectile', 'masterofelements', 'lavasurgeP', 'searingflames'].includes(x.id)) return 40 + x.rarity * 5;
    if (x.type === 'new' && ['stormkeeper', 'ascendance', 'elementalblast', 'capacitortotem', 'astralshift', 'healingsurge', 'reincarnation'].includes(x.id)) return 35;
    if (x.type === 'node') return 30;
    if (x.type === 'passive') return 25 + x.rarity * 5;
    return 10;
  },
};
