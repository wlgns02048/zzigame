'use strict';
// ================= 직업: 사격 사냥꾼 =================
// 한밤(12.0) 사격 특성을 바탕으로: 고정 사격으로 집중을 벌고, 멈춰 서서 조준 사격을 꽂으면 정밀 사격이 붙어
// 신비한 사격 · 일제 사격이 강해진다. 일제 사격이 여럿을 맞히면 속임수 사격으로 다음 조준 사격 · 속사가 튕긴다.
// 펫 대신 하늘의 감시하는 독수리가 표적에 관측자의 징표를 찍는다. 특화 '저격 훈련': 멀리 있는 적일수록 더 아프다.
// 다른 직업 파일과 전역 이름이 겹치지 않게 사냥꾼 전용 이름은 H로 시작한다.

const H = () => G.player;
const H_ATTACKS = ['volley', 'wailingarrow', 'bindingshot', 'burstingshot', 'freezingtrap'];
const H_DEFENSIVE = ['disengage', 'turtle', 'exhilaration', 'feigndeath', 'burstingshot'];
const H_RANGE = 720; // 사냥꾼 사거리 (마법사 640보다 길다)
const H_MOVE_AIM = 0.4; // 움직이는 동안 조준 사격을 겨누는 속도

// ---------- 주문 데이터 ----------
Object.assign(G.SKILLS, {
  // ===== 자동 시전 =====
  steadyshot: {
    cls: 'hunter', name: '고정 사격', icon: 'steadyshot', kind: 'auto', school: 'physical', color: '#d8b070',
    base: { dmg: 26, cast: 0.6, count: 1, pierce: 1, speed: 1100, focus: 8, proj: true, basic: true },
    tip: s => `가장 가까운 적에게 화살을 쏴 ${D(s.dmg)}의 물리 피해를 입히고 <b class="v">집중 ${N(s.focus, 0)}</b>을 얻습니다.<br>이동 중에도 시전 속도가 느려지지 않습니다. 조준 사격을 겨누는 동안에는 쏘지 않습니다.` +
      (s.count > 1 ? `<br>화살 ${N(s.count, 0)}개 (추가 화살은 ${P(G.EXTRA_BOLT)} 피해)` : '') + `<br>관통 ${N(s.pierce, 0)}`,
    castInfo: s => `시전 시간 ${s.cast.toFixed(2)}초`,
    nodes: [
      node('count', '다중 사격', 2, '화살 <b class="v">+1</b> (60% 피해)', s => s.count++, { icon: 'multishot' }),
      node('cast', '빠른 손놀림', 3, '시전 시간 <b class="v">-8%</b>', s => (s.cast *= 0.92)),
      node('dmg', '원거리 무기 숙련', 5, '피해 <b class="v">+20%</b> (기본 피해 기준)', s => (s.dmg += 4.8), { icon: 'rangedspec' }),
      node('focus', '집중 사격', 2, '집중 획득 <b class="v">+3</b>', s => (s.focus += 3), { icon: 'focus' }),
      node('pierce', '관통 화살', 2, '관통 <b class="v">+1</b>', s => s.pierce++, { icon: 'aimedshot' }),
    ],
  },
  aimedshot: {
    cls: 'hunter', name: '조준 사격', icon: 'aimedshot', kind: 'auto', school: 'physical', color: '#ffe08a',
    base: { dmg: 150, cd: 9, cast: 1.4, charges: 2, pierce: 3 },
    tip: s => `${N(s.cast, 1)}초 동안 겨눠, 적을 꿰뚫는 화살로 ${D(s.dmg)}의 피해를 입힙니다 (관통 ${N(s.pierce, 0)}). <b class="v">멈춰 서 있어야 제 속도로 겨누고</b>, 움직이는 동안은 40% 속도로만 겨눕니다. 서서 겨누는 동안 고정 사격은 쉽니다.<br>` +
      `관측자의 징표 → 정예 · 보스 → 적이 몰린 곳 순으로 노립니다. 맞히면 <b class="v">정밀 사격</b> 2회: 다음 신비한 사격 · 일제 사격 피해 증가.`,
    castInfo: s => `시전 ${s.cast.toFixed(1)}초 (서서) · 충전 ${s.charges}회 · 재충전 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.25, 5, '치명적인 조준'), node('cast', '빠른 조준', 3, '시전 시간 <b class="v">-10%</b>', s => (s.cast *= 0.9), { icon: 'carefulaim' }),
      node('pierce', '꿰뚫는 사격', 2, '관통 <b class="v">+2</b>', s => (s.pierce += 2), { icon: 'aimedshot' }), cdNode(0.12, 3)],
  },
  arcaneshot: {
    cls: 'hunter', name: '신비한 사격', icon: 'arcaneshot', kind: 'auto', school: 'arcane', color: '#c070ff',
    base: { dmg: 55, cd: 0.8, cost: 20, targets: 1, proj: true },
    tip: s => `집중 ${N(s.cost, 0)}을 써서 적에게 마력이 깃든 화살을 쏴 ${D(s.dmg)}의 비전 피해를 입힙니다. 정예 · 보스 · 징표가 찍힌 적을 먼저 노립니다.<br>` +
      `<b class="v">정밀 사격</b>을 쓰면 피해 2배.` + (s.targets > 1 ? `<br>대상 ${N(s.targets, 0)}명` : ''),
    castInfo: s => `즉시 · 집중 ${s.cost.toFixed(0)} · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.3, 5, '신비한 숙련'), node('cost', '효율적인 사격', 2, '집중 소모 <b class="v">-3</b>', s => (s.cost -= 3), { icon: 'efficiency' }),
      node('targets', '키메라 사격', 2, '대상 <b class="v">+1</b>', s => s.targets++, { icon: 'arcaneshot' })],
  },
  multishot: {
    cls: 'hunter', name: '일제 사격', icon: 'multishot', kind: 'auto', school: 'physical', color: '#e0c080',
    base: { dmg: 30, cd: 2.2, cost: 25, arrows: 5, angle: 0.7, pierce: 1 },
    tip: s => `집중 ${N(s.cost, 0)}을 써서 적이 몰린 곳으로 화살 ${N(s.arrows, 0)}개를 부채꼴로 쏴 각각 ${D(s.dmg)}의 피해를 입힙니다.<br>` +
      `<b class="v">3명 이상</b> 맞히면 <b class="v">속임수 사격</b>: 다음 조준 사격 · 속사가 주변 적에게 튕깁니다. 정밀 사격을 쓰면 피해 +75%.`,
    castInfo: s => `즉시 · 집중 ${s.cost.toFixed(0)} · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [node('arrows', '화살 세례', 3, '화살 <b class="v">+2</b>', s => (s.arrows += 2), { icon: 'barrage' }), dmgNode(0.3, 5),
      node('cost', '효율적인 사격', 2, '집중 소모 <b class="v">-4</b>', s => (s.cost -= 4), { icon: 'efficiency' }),
      node('angle', '넓은 부채꼴', 2, '각도 <b class="v">+25%</b>', s => (s.angle *= 1.25), { icon: 'area' })],
  },
  rapidfire: {
    cls: 'hunter', name: '속사', icon: 'rapidfire', kind: 'auto', school: 'physical', color: '#ff9060',
    base: { dmg: 20, cd: 14, shots: 8, dur: 1.6, focus: 2 },
    tip: s => `${N(s.dur, 1)}초 동안 화살 ${N(s.shots, 0)}발을 연달아 쏴 각각 ${D(s.dmg)}의 피해를 입히고 발마다 집중 ${N(s.focus, 0)}을 얻습니다. 쏘는 동안 움직일 수 있습니다.<br>속임수 사격이 있으면 화살마다 주변 적에게 튕깁니다.`,
    castInfo: s => `정신 집중 (이동 가능) · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('shots', '연사', 3, '화살 <b class="v">+2</b>', s => (s.shots += 2), { icon: 'rapidfire' }), dmgNode(0.3, 5), cdNode(0.12, 3),
      node('focus', '사냥꾼의 리듬', 2, '발마다 집중 <b class="v">+1</b>', s => s.focus++, { icon: 'focus' })],
  },
  killshot: {
    cls: 'hunter', name: '마무리 사격', icon: 'killshot', kind: 'auto', school: 'physical', color: '#ff5040',
    base: { dmg: 160, cd: 8, thr: 0.2, charges: 1 },
    tip: s => `생명력이 <b class="v">${Math.round(s.thr * 100)}%</b> 이하인 적(가장 튼튼한 적 먼저)을 처형해 ${D(s.dmg)}의 피해를 입힙니다. 대상이 죽으면 충전이 돌아옵니다.` +
      (s.ba ? '<br><b class="v">검은 화살</b>: 생명력과 상관없이 쏘고, 8초 동안 암흑 지속 피해. 그 지속 피해로 적이 죽으면 그림자 화살 3발이 튑니다.' : ''),
    castInfo: s => `즉시 · 충전 ${s.charges}회 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 5, '사냥꾼의 일격'), node('thr', '처형인', 2, '처형 기준 <b class="v">+5%</b>', s => (s.thr += 0.05), { icon: 'killshot' }),
      node('charges', '연속 처형', 1, '충전 <b class="v">+1</b>', s => s.charges++, { icon: 'deadeye' }), cdNode(0.15, 2)],
  },
  eagle: {
    cls: 'hunter', name: '감시하는 독수리', icon: 'eagle', kind: 'auto', school: 'physical', color: '#e8d8a0',
    base: { dmg: 40, markCd: 7, bonus: 0.4, talon: 0 },
    tip: s => `머리 위를 맴도는 독수리를 부립니다. ${N(s.markCd, 1)}초마다 보스 → 정예 → 가장 튼튼한 적에게 내리꽂아 ${D(s.dmg)}의 피해를 입히고 <b class="v">관측자의 징표</b>를 찍습니다.<br>` +
      `징표가 찍힌 적은 다음 조준 사격에 <b class="v">${Math.round(s.bonus * 100)}%</b> 더 큰 피해를 받습니다 (조준 사격이 징표가 찍힌 적을 먼저 노림).` + (s.talon ? '<br>날카로운 발톱: 정예 · 보스에게 급강하 피해 2배' : ''),
    castInfo: () => '영구 소환',
    nodes: [node('markCd', '날카로운 눈', 2, '징표 주기 <b class="v">-1.5초</b>', s => (s.markCd -= 1.5), { icon: 'huntersmark' }),
      node('bonus', '관측자의 징표', 2, '징표 추가 피해 <b class="v">+20%</b>', s => (s.bonus += 0.2), { icon: 'snipertraining' }), dmgNode(0.3, 3, '맹금의 일격'),
      node('talon', '날카로운 발톱', 1, '정예 · 보스에게 급강하 피해 <b class="v">2배</b>', s => (s.talon = 1), { icon: 'eagle' })],
  },
  barrage: {
    cls: 'hunter', name: '탄막', icon: 'barrage', kind: 'auto', school: 'physical', color: '#e0a060',
    base: { dmg: 14, cd: 10, arrows: 18, angle: 0.9 },
    tip: s => `적이 몰린 쪽으로 0.6초 동안 화살 ${N(s.arrows, 0)}발을 흩뿌려 각각 ${D(s.dmg)}의 피해를 입힙니다 (관통 1).`,
    castInfo: s => `재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 5), node('arrows', '화살 폭풍', 3, '화살 <b class="v">+6</b>', s => (s.arrows += 6), { icon: 'barrage' }), cdNode(0.12, 3),
      node('angle', '넓은 탄막', 2, '각도 <b class="v">+20%</b>', s => (s.angle *= 1.2), { icon: 'area' })],
  },

  // ===== 단축키 주문 =====
  volley: {
    cls: 'hunter', name: '연발 사격', icon: 'volley', kind: 'active', key: 'Q', school: 'physical', color: '#f0c070',
    base: { dmg: 16, cd: 24, radius: 150, dur: 6 },
    tip: s => `마우스 위치(사거리 안)에 ${N(s.dur, 0)}초 동안 화살비를 내려 0.25초마다 범위 안의 적 최대 4명에게 ${D(s.dmg)}의 피해를 입힙니다.<br>화살비가 내리는 동안 <b class="v">속임수 사격</b>이 유지됩니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 5), node('radius', '넓은 화살비', 3, '범위 <b class="v">+15%</b>', s => (s.radius *= 1.15), { icon: 'area' }),
      node('dur', '끝없는 화살비', 2, '지속시간 <b class="v">+2초</b>', s => (s.dur += 2), { icon: 'duration' }), cdNode(0.15, 2)],
  },
  freezingtrap: {
    cls: 'hunter', name: '얼음의 덫', icon: 'freezingtrap', kind: 'active', key: 'E', school: 'frost', color: '#90d8ff',
    base: { cd: 14, charges: 1, freeze: 4, radius: 130, tar: 0 },
    tip: s => `마우스 위치(사거리 안)에 덫을 던집니다. 적이 밟으면 반경 ${N(s.radius, 0)} 안의 적을 ${N(s.freeze, 0)}초 동안 얼립니다 (정예는 절반, 보스는 잠깐 얼어붙은 것으로 간주). 덫은 30초 동안 남습니다.` +
      (s.tar ? '<br>끈적이는 타르: 터진 자리에 6초 동안 이동 속도 50% 감소 장판' : ''),
    castInfo: s => `즉시 시전 · 충전 ${s.charges}회 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('charges', '덫 전문가', 1, '충전 <b class="v">+1</b>', s => s.charges++, { icon: 'freezingtrap' }), node('freeze', '혹한의 덫', 2, '빙결 <b class="v">+1초</b>', s => (s.freeze += 1), { icon: 'freeze' }),
      node('radius', '넓은 덫', 2, '범위 <b class="v">+20%</b>', s => (s.radius *= 1.2), { icon: 'area' }), node('tar', '끈적이는 타르', 1, '터진 자리에 감속 장판', s => (s.tar = 1), { icon: 'bindingshot' }), cdNode(0.15, 2)],
  },
  wailingarrow: {
    cls: 'hunter', name: '울부짖는 화살', icon: 'wailingarrow', kind: 'active', key: 'R', school: 'shadow', color: '#80e090',
    base: { dmg: 90, boom: 130, cd: 28, radius: 170, stun: 2 },
    tip: s => `마우스 방향으로 모든 적을 꿰뚫는 화살을 쏴 ${D(s.dmg)}의 피해를 입히고, 끝에서 밴시의 울부짖음이 터져 반경 ${N(s.radius, 0)} 안에 ${D(s.boom)}의 피해를 입히고 ${N(s.stun, 0)}초 동안 기절시킵니다 (정예는 절반, 보스 제외).`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 5), node('radius', '날카로운 울음', 2, '폭발 범위 <b class="v">+20%</b>', s => (s.radius *= 1.2), { icon: 'area' }), cdNode(0.15, 2),
      node('stun', '공포의 울음', 1, '기절 <b class="v">+1초</b>', s => (s.stun += 1), { icon: 'feigndeath' })],
  },
  bindingshot: {
    cls: 'hunter', name: '결박의 사격', icon: 'bindingshot', kind: 'active', key: 'T', school: 'nature', color: '#80ffb0',
    base: { cd: 22, radius: 160, dur: 10, root: 3 },
    tip: s => `마우스 위치(사거리 안)에 결박의 화살을 박습니다. ${N(s.dur, 0)}초 동안 반경 ${N(s.radius, 0)} 안에 들어온 적은 사슬에 묶이고, 범위를 벗어나려 하면 ${N(s.root, 0)}초 동안 꼼짝 못 합니다 (보스 제외, 정예는 절반).`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('radius', '넓은 결박', 2, '범위 <b class="v">+20%</b>', s => (s.radius *= 1.2), { icon: 'area' }), node('root', '단단한 사슬', 2, '속박 <b class="v">+1초</b>', s => (s.root += 1), { icon: 'bindingshot' }), cdNode(0.15, 2)],
  },
  trueshot: {
    cls: 'hunter', name: '정조준', icon: 'trueshot', kind: 'active', key: 'F', school: 'physical', color: '#ffd060',
    base: { cd: 80, dur: 15, crit: 0.15 },
    tip: s => `${N(s.dur, 0)}초 동안 조준 사격 · 속사의 재사용 대기시간이 <b class="v">2.5배</b> 빨리 돌고, 치명타 확률 ${P(s.crit)} · 치명타 피해 +15%, 집중 회복 +50%.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('dur', '오래가는 집중', 2, '지속시간 <b class="v">+3초</b>', s => (s.dur += 3), { icon: 'duration' }), node('crit', '저격수', 2, '치명타 확률 <b class="v">+5%</b>', s => (s.crit += 0.05), { icon: 'lethalshots' }), cdNode(0.15, 2)],
  },
  disengage: {
    cls: 'hunter', name: '철수', icon: 'disengage', kind: 'active', key: 'SPACE', school: 'physical', color: '#a0e0a0',
    base: { cd: 14, charges: 1, dist: 230, haste: 0.4 },
    tip: s => `마우스 반대 방향으로 ${N(s.dist, 0)}만큼 뒤로 도약합니다 (도약 중 피해 면역). 착지하면 3초 동안 이동 속도 ${P(s.haste)} 증가 (가속).`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('charges', '연속 철수', 1, '충전 <b class="v">+1</b>', s => s.charges++, { icon: 'disengage' }), cdNode(0.15, 2), node('haste', '가속', 2, '이동 속도 증가 <b class="v">+20%</b>', s => (s.haste += 0.2), { icon: 'speed' })],
  },
  turtle: {
    cls: 'hunter', name: '거북의 상', icon: 'turtle', kind: 'active', key: '1', school: 'nature', color: '#80c0a0',
    base: { cd: 100, dur: 6, heal: 0 },
    tip: s => `${N(s.dur, 0)}초 동안 모든 피해를 막아내고 날아오는 투사체를 튕겨냅니다. <b class="v">이동은 할 수 있지만</b> 공격은 할 수 없습니다. 다시 누르면 취소됩니다.<br>거북의 상이 준비돼 있으면 치명적인 피해를 받을 때 자동으로 발동합니다.` + (s.heal ? `<br>지속 중 초당 ${P(s.heal)} 회복` : ''),
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('cd', '단단한 껍질', 2, '재사용 대기시간 <b class="v">-20%</b>', s => (s.cd *= 0.8)), node('heal', '자연의 회복', 2, '지속 중 초당 생명력 <b class="v">8%</b> 회복', s => (s.heal += 0.08), { icon: 'regen' })],
  },
  exhilaration: {
    cls: 'hunter', name: '활기', icon: 'exhilaration', kind: 'active', key: '2', school: 'nature', color: '#60ff80',
    base: { cd: 55, heal: 0.35 },
    tip: s => `생명력을 ${P(s.heal)} 회복합니다.`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('heal', '생명의 활력', 2, '회복 <b class="v">+10%</b>', s => (s.heal += 0.1), { icon: 'regen' }), cdNode(0.15, 2)],
  },
  feigndeath: {
    cls: 'hunter', name: '죽은 척하기', icon: 'feigndeath', kind: 'active', key: '3', school: 'physical', color: '#c0c0c0',
    base: { cd: 30, dur: 4 },
    tip: s => `쓰러진 척해 그 자리에 미끼를 남기고 주변 적의 투사체를 지웁니다. 미끼가 더 가까운 적은 ${N(s.dur, 0)}초 동안 미끼를 공격하고, 주변 일반 적은 잠깐 머뭇거립니다.`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('dur', '그럴듯한 연기', 2, '지속시간 <b class="v">+2초</b>', s => (s.dur += 2), { icon: 'duration' }), cdNode(0.15, 2)],
  },
  burstingshot: {
    cls: 'hunter', name: '파열 사격', icon: 'burstingshot', kind: 'active', key: '4', school: 'physical', color: '#d0e0ff',
    base: { dmg: 40, cd: 16, range: 300, push: 170 },
    tip: s => `마우스 방향 부채꼴(사거리 ${N(s.range, 0)}) 안의 적에게 ${D(s.dmg)}의 피해를 입히고 ${N(s.push, 0)}만큼 밀쳐내며 3초 동안 50% 감속시킵니다 (보스 제외).`,
    castInfo: s => `즉시 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 4), node('push', '강한 반동', 2, '밀쳐내기 <b class="v">+30%</b>', s => (s.push *= 1.3), { icon: 'disengage' }), cdNode(0.15, 2)],
  },

  // ===== 사냥꾼 전용 능력치 =====
  preciseshotsP: { cls: 'hunter', name: '정밀 사격', icon: 'preciseshots', kind: 'passive', max: 3, val: 25, unit: '%', req: p => !!(p.skills.aimedshot && (p.skills.arcaneshot || p.skills.multishot)),
    desc: v => `정밀 사격 추가 피해 +${v}%`, apply: (st, v) => (st.precise = (st.precise || 0) + v / 100) },
  trickshotsP: { cls: 'hunter', name: '속임수 사격', icon: 'trickshots', kind: 'passive', max: 3, val: 1, unit: '', fixed: true, req: p => !!(p.skills.multishot || p.skills.volley),
    desc: () => '속임수 사격으로 튕기는 대상 +1, 튕긴 화살 피해 +10%', apply: (st, v) => (st.trick = (st.trick || 0) + v) },
  lockandload: { cls: 'hunter', name: '장전', icon: 'lockandload', kind: 'passive', max: 3, val: 6, unit: '%', fixed: true, req: p => !!(p.skills.aimedshot && p.skills.steadyshot),
    desc: v => `고정 사격 시 ${v}% 확률로 발동: 다음 조준 사격이 즉시 나가며 충전을 쓰지 않음 (이동 중에도)`, apply: (st, v) => (st.lnl = (st.lnl || 0) + v / 100) },
  carefulaim: { cls: 'hunter', name: '신중한 조준', icon: 'carefulaim', kind: 'passive', max: 3, val: 15, unit: '%', req: p => !!(p.skills.aimedshot || p.skills.arcaneshot),
    desc: v => `생명력 70% 이상인 적에게 조준 사격 · 신비한 사격 피해 +${v}%`, apply: (st, v) => (st.careful = (st.careful || 0) + v / 100) },
  movingtarget: { cls: 'hunter', name: '이동 표적', icon: 'movingtarget', kind: 'passive', max: 2, val: 15, unit: '%', req: p => !!p.skills.aimedshot,
    desc: v => `정밀 사격을 쓸 때마다 다음 조준 사격 피해 +${v}% (2회까지 쌓임)`, apply: (st, v) => (st.mvTarget = (st.mvTarget || 0) + v / 100) },
  bulletstorm: { cls: 'hunter', name: '탄환 폭풍', icon: 'bulletstorm', kind: 'passive', max: 2, val: 2, unit: '%', req: p => !!(p.skills.rapidfire && p.skills.aimedshot),
    desc: v => `속사가 맞힐 때마다 다음 조준 사격 피해 +${v}% (15회까지 쌓임)`, apply: (st, v) => (st.bstorm = (st.bstorm || 0) + v / 100) },
  huntersmark: { cls: 'hunter', name: '사냥꾼의 징표', icon: 'huntersmark', kind: 'passive', max: 3, val: 6, unit: '%', desc: v => `정예 · 보스가 받는 피해 +${v}%`, apply: (st, v) => (st.hmark = (st.hmark || 0) + v / 100) },
  steadyfocus: { cls: 'hunter', name: '고정 집중', icon: 'steadyfocus', kind: 'passive', max: 3, val: 4, unit: '%', req: p => !!p.skills.steadyshot,
    desc: v => `고정 사격 3회마다 6초 동안 가속 +${v}%`, apply: (st, v) => (st.steadyFocus = (st.steadyFocus || 0) + v / 100) },
  aspectwild: { cls: 'hunter', name: '야생의 상', icon: 'survivalinstincts', kind: 'passive', max: 5, val: 6, unit: '%', desc: v => `받는 피해 -${v}%`, apply: (st, v) => (st.armor += v / 100) },

  // ===== 전설 =====
  hydra: { cls: 'hunter', name: '히드라의 상', icon: 'hydra', kind: 'legendary', req: p => !!(p.skills.aimedshot || p.skills.arcaneshot || p.skills.rapidfire), desc: () => '조준 사격 · 신비한 사격 · 속사가 주변의 두 번째 대상에게도 40% 피해로 날아갑니다.' },
  doubletap: { cls: 'hunter', name: '이중 사격', icon: 'doubletap', kind: 'legendary', req: p => !!(p.skills.aimedshot && p.skills.trueshot), desc: () => '정조준을 쓰면 다음 조준 사격 2회가 한 번 더 나갑니다 (100% 위력).' },
  windrunner: { cls: 'hunter', name: '윈드러너의 화살통', icon: 'windrunner', kind: 'legendary', req: p => !!p.skills.aimedshot, desc: () => '조준 사격 충전 +1, 정밀 사격이 3회까지 쌓입니다.' },
  deadeye: { cls: 'hunter', name: '사신의 눈', icon: 'deadeye', kind: 'legendary', req: p => !!p.skills.killshot, desc: () => '마무리 사격 충전 +1, 처형 기준 +5%, 마무리 사격 피해 +30%.' },

  // ===== 진화 (영웅 특성) =====
  blackarrow: {
    cls: 'hunter', name: '검은 화살', icon: 'blackarrow', kind: 'evolution', target: 'killshot',
    req: p => p.skills.killshot && p.skillLevel('killshot') >= 5 && p.skills.trueshot, reqText: '마무리 사격 5레벨 + 정조준',
    desc: () => '<b>영웅 특성: 어둠 순찰자</b><br>마무리 사격이 검은 화살로 진화합니다. 생명력과 상관없이 쏘고 피해 +30%, 8초 동안 암흑 지속 피해를 남깁니다. 그 지속 피해가 걸린 적이 죽으면 그림자 화살 3발이 주변 적에게 튑니다.',
  },
  sentinel: {
    cls: 'hunter', name: '파수꾼', icon: 'sentinel', kind: 'evolution', target: 'eagle',
    req: p => p.skills.eagle && p.skillLevel('eagle') >= 4 && p.passives.huntersmark, reqText: '감시하는 독수리 4레벨 + 사냥꾼의 징표',
    desc: () => '<b>영웅 특성: 파수꾼</b><br>독수리가 파수꾼 올빼미가 됩니다. 사격이 맞을 때마다 20% 확률로 파수꾼 징표가 쌓이고(최대 6), 3초 뒤 한꺼번에 터집니다. 15초마다 적이 몰린 곳에 달의 폭풍을 내립니다.',
  },
});
for (const id in G.SKILLS) G.SKILLS[id].id = id;
Object.assign(G.SOURCES, {
  steadyshot: ['고정 사격', 'steadyshot', '#d8b070'], aimedshot: ['조준 사격', 'aimedshot', '#ffe08a'], arcaneshot: ['신비한 사격', 'arcaneshot', '#c070ff'],
  multishot: ['일제 사격', 'multishot', '#e0c080'], rapidfire: ['속사', 'rapidfire', '#ff9060'], killshot: ['마무리 사격', 'killshot', '#ff5040'],
  blackarrow: ['검은 화살', 'blackarrow', '#9050c0'], blackarrowdot: ['검은 화살 (지속)', 'blackarrow', '#7040a0'], shadowarrow: ['그림자 화살', 'blackarrow', '#a070e0'],
  eagle: ['감시하는 독수리', 'eagle', '#e8d8a0'], sentinel: ['파수꾼 징표', 'sentinel', '#80b0ff'], lunarstorm: ['달의 폭풍', 'sentinel', '#a0c8ff'],
  barrage: ['탄막', 'barrage', '#e0a060'], volley: ['연발 사격', 'volley', '#f0c070'], trickshot: ['속임수 사격', 'trickshots', '#ffd080'],
  wailingarrow: ['울부짖는 화살', 'wailingarrow', '#80e090'], burstingshot: ['파열 사격', 'burstingshot', '#d0e0ff'], hydra: ['히드라의 상', 'hydra', '#e06040'],
  freezingtrap: ['얼음의 덫', 'freezingtrap', '#90d8ff'],
});

// ---------- 공용 도우미 ----------
// 장착한 원거리 무기 → 화살 모양 · 발사음 (활: 화살 · 총: 탄환 · 석궁: 볼트)
const hAmmo = () => {
  const mh = G.Meta.equipped('hunter').mainhand, t = mh && mh.slot;
  return t === 'gun' ? 'bullet' : t === 'crossbow' ? 'bolt' : 'arrow';
};
const hShotSound = (vol = 0.5) => { const a = H().ammo; G.Audio.play(a === 'bullet' ? 'gun' : a === 'bolt' ? 'xbow' : 'bow', vol); };
// 사냥꾼의 모든 피해는 여기를 거친다: 사냥꾼의 징표 · 신중한 조준 · 저격 훈련(특화: 거리 비례) · 파수꾼 징표
const hHit = (e, base, src, o = {}) => {
  const p = H(), st = p.stats;
  let m = 1;
  if (st.hmark && (e.elite || e.boss)) m *= 1 + st.hmark;
  if (o.careful && st.careful && e.hp > e.maxHp * 0.7) m *= 1 + st.careful;
  if (st.mastery) m *= 1 + st.mastery * 0.005 * Math.min(4, Math.sqrt(U.d2(p.x, p.y, e.x, e.y)) / 100);
  const dealt = G.hit(e, base * m, src, o);
  if (p.evo.sentinel && !o.noSentinel && !e.dead && Math.random() < 0.2) hSentinel(e);
  return dealt;
};
const hFocus = n => { const p = H(); p.focus = Math.min(p.focusMax, p.focus + n); };
// 우선 대상: 관측자의 징표 > 보스 > 정예 > 가까운 적
const hPriority = (range, x = H().x, y = H().y) => {
  let best = null, bs = -Infinity;
  for (const e of G.Grid.query(x, y, range)) {
    const sc = (e.spotT > G.t ? 3000 : 0) + (e.boss ? 2000 : e.elite ? 1000 : 0) - Math.sqrt(U.d2(x, y, e.x, e.y));
    if (sc > bs) { bs = sc; best = e; }
  }
  return best;
};
const hSpot = range => { const p = H(), m = G.aimPoint(), a = Math.atan2(m.y - p.y, m.x - p.x), d = Math.min(range, Math.hypot(m.x - p.x, m.y - p.y)); return [p.x + Math.cos(a) * d, p.y + Math.sin(a) * d]; };
const hMuzzle = () => { const p = H(); return [p.x + p.face * 18, p.y - 26]; };
// 화살 하나 쏘기. o: Proj.spawn 옵션 + tint(색) · big(굵기) · trail
const hArrow = o => {
  const [x, y] = hMuzzle();
  return G.Proj.spawn(Object.assign({ x, y, r: 8, kind: 'harrow', ammo: H().ammo, life: 0.9, speed: 1100, turn: 0, draw: hDrawArrow, update: hArrowTrail }, o));
};
// 속임수 사격 · 히드라: 맞은 적에서 주변 다른 적에게 튕기는 작은 화살
const hRicochet = (from, n, dmg, src) => {
  const tg = nearestN(from.x, from.y, n + 1, 260).filter(e => e !== from).slice(0, n);
  for (const t of tg) G.Proj.spawn({ x: from.x, y: from.y - 10, a: Math.atan2(t.y - from.y, t.x - from.x), speed: 1000, r: 7, kind: 'harrow', ammo: 'arrow', tint: '255,210,120', homing: t, turn: 12, life: 0.6,
    draw: hDrawArrow, update: hArrowTrail, onHit: e => { hHit(e, dmg, src, { small: true }); G.fx.burst(e.x, e.y, 4, { rgb: '255,210,120', sp: 90, size: 7 }); } });
};
const hTrickN = () => 2 + (H().stats.trick || 0);
const hTrickMul = () => 0.45 + (H().stats.trick || 0) * 0.1;
const hPreciseMax = () => (H().legend.windrunner ? 3 : 2);

// 파수꾼 징표: 쌓였다가 3초 뒤 한꺼번에 터진다
function hSentinel(e) {
  const p = H();
  if (!e.sentN) { e.sentN = 0; e.sentT = G.t + 3; p.sentList.push(e); }
  e.sentN = Math.min(6, e.sentN + 1);
}

// ---------- 구현 ----------
Object.assign(G.SKILL_IMPL, {
  steadyshot: {
    update(sk, dt, busy) {
      const p = H(), s = sk.s;
      if (busy || p.turtleT > 0 || p.aiming) { if (!p.aiming) sk.castT = 0; return; }
      sk.castT = Math.min(1, sk.castT + dt * (1 + G.P.haste()) / s.cast); // 이동해도 느려지지 않는다
      if (sk.castT < 1) return;
      const tg = nearestN(p.x, p.y, s.count, H_RANGE);
      if (!tg.length) return;
      sk.castT = 0;
      hFocus(s.focus);
      for (let i = 0; i < s.count; i++) {
        const t = tg[i % tg.length], base = s.dmg * (i ? G.EXTRA_BOLT : 1);
        hArrow({ a: Math.atan2(t.y - 24 - (p.y - 26), t.x - p.x) + (i >= tg.length ? (i - tg.length + 1) * 0.12 : 0), homing: t, turn: 4, noRetarget: true, pierce: s.pierce,
          onHit: e => { hHit(e, base, 'steadyshot'); G.fx.burst(e.x, e.y, 5, { rgb: '230,200,150', sp: 100, size: 7 }); G.Audio.play('arrowHit', 0.6, e.x); } });
      }
      // 고정 집중: 3회마다 가속 · 장전: 확률로 다음 조준 사격 즉시
      if (p.stats.steadyFocus && ++p.sfN >= 3) { p.sfN = 0; p.sfT = 6; }
      if (p.stats.lnl && p.skills.aimedshot && !p.lnl && Math.random() < p.stats.lnl) { p.lnl = 1; G.fx.text(p.x, p.y - 60, '장전!', '#ffe08a', 16, true); G.Audio.play('tick', 0.7); }
      hShotSound(0.4);
    },
  },
  aimedshot: {
    update(sk, dt, busy) {
      const p = H(), s = sk.s;
      p.aiming = false; p.aimTgt = null;
      if (busy || p.turtleT > 0) { sk.castT = 0; return; }
      // 장전: 즉시 · 충전 소모 없음 · 이동 중에도
      if (p.lnl) { const t = hAimTarget(); if (t) { p.lnl = 0; hFireAimed(sk, t); } return; }
      if (sk.charges <= 0) { sk.castT = 0; return; }
      const t = hAimTarget(); if (!t) { sk.castT = Math.max(0, sk.castT - dt); return; }
      // 서 있으면 온전히 겨누고(고정 사격은 쉰다), 움직이면 40% 속도로만 겨눈다 (고정 사격은 계속)
      p.aiming = !p.moving; p.aimTgt = t;
      sk.castT = Math.min(1, sk.castT + dt * (1 + G.P.haste()) / s.cast * (p.moving ? H_MOVE_AIM : 1));
      if (sk.castT < 1) return;
      sk.castT = 0; p.aiming = false;
      hFireAimed(sk, t); G.Skills.startCd(sk); G.UI.pressed('aimedshot');
    },
  },
  arcaneshot: {
    auto(sk) {
      const p = H(), s = sk.s, cost = Math.max(5, s.cost * (1 - (p.stats.focusCost || 0)));
      if (p.turtleT > 0 || p.focus < cost) return false;
      // 일제 사격을 배웠고 적이 몰려 있으면 정밀 사격은 일제 사격에 양보
      const ms = p.skills.multishot;
      if (ms && ms.charges > 0 && p.focus < cost + ms.s.cost) { const d = G.densestPoint(p.x, p.y, 600, 150); if (d && d.n >= 4) return false; }
      const first = hPriority(H_RANGE); if (!first) return false;
      const tg = [first].concat(nearestN(first.x, first.y, s.targets, 400).filter(e => e !== first)).slice(0, s.targets);
      p.focus -= cost;
      const pr = hUsePrecise(), mul = pr ? 2 + (p.stats.precise || 0) : 1;
      for (const t of tg) hArcane(t, s.dmg * mul, !!pr);
      if (p.legend.hydra) { const o = nearestN(first.x, first.y, 2, 300).find(e => e !== first); if (o) hArcane(o, s.dmg * mul * 0.4, false, 'hydra'); }
      return true;
    },
  },
  multishot: {
    auto(sk) {
      const p = H(), s = sk.s, cost = Math.max(5, s.cost * (1 - (p.stats.focusCost || 0)));
      if (p.turtleT > 0 || p.focus < cost) return false;
      const d = G.densestPoint(p.x, p.y, 600, 150); if (!d || d.n < 2) return false;
      p.focus -= cost;
      const pr = hUsePrecise(), mul = pr ? 1.75 + (p.stats.precise || 0) : 1, a0 = Math.atan2(d.y - p.y, d.x - p.x), hit = new Set();
      for (let i = 0; i < s.arrows; i++) {
        const a = a0 + (s.arrows > 1 ? (i / (s.arrows - 1) - 0.5) * s.angle : 0);
        hArrow({ a, speed: 1000, life: 0.7, pierce: s.pierce, tint: pr ? '255,220,120' : null,
          onHit: e => {
            hHit(e, s.dmg * mul, 'multishot'); hit.add(e); G.fx.burst(e.x, e.y, 4, { rgb: '230,200,150', sp: 90, size: 7 });
            if (hit.size === 3 && !(p.trickT > G.t)) { p.trickT = G.t + 8; G.fx.text(p.x, p.y - 60, '속임수 사격', '#ffd080', 15, true); }
          } });
      }
      G.fx.ring(p.x, p.y - 20, 6, 40, 0.2, '255,220,150', 3);
      hShotSound(0.6);
      return true;
    },
  },
  rapidfire: {
    auto(sk) {
      const p = H(), s = sk.s;
      if (p.turtleT > 0 || !G.nearestEnemy(p.x, p.y, H_RANGE)) return false;
      p.rapid = { n: s.shots, t: 0, iv: s.dur / s.shots, trick: p.trickT > G.t };
      if (p.rapid.trick) p.trickT = 0;
      return true;
    },
  },
  killshot: {
    auto(sk) {
      const p = H(), s = sk.s;
      if (p.turtleT > 0) return false;
      let t = null, bs = -1;
      for (const e of G.Grid.query(p.x, p.y, H_RANGE + 80)) {
        const low = e.hp <= e.maxHp * s.thr;
        if (!low && !s.ba) continue;
        const sc = s.ba ? (e.boss ? 1e6 : e.elite ? 5e5 : 0) + (low ? 2e5 : 0) + e.hp : e.maxHp;
        if (sc > bs) { bs = sc; t = e; }
      }
      if (!t) return false;
      const ba = !!s.ba, src = ba ? 'blackarrow' : 'killshot';
      hArrow({ a: Math.atan2(t.y - 20 - (p.y - 26), t.x - p.x), homing: t, turn: 20, noRetarget: true, speed: 1500, r: 10, big: 1.4, tint: ba ? '120,60,200' : '255,90,70', life: 1,
        onHit: e => {
          hHit(e, s.dmg, src, { careful: true, crit: 0.1 });
          if (ba && !e.dead) G.Dots.apply(e, 'blackarrow', { dmg: s.dmg * 0.12, dur: 8, interval: 1, src: 'blackarrowdot', color: '120,60,190', icon: 'blackarrow' });
          G.fx.burst(e.x, e.y, 14, { rgb: ba ? '140,80,220' : '255,110,80', sp: 180, size: 11 }); G.fx.ring(e.x, e.y, 6, 60, 0.3, ba ? '160,100,240' : '255,140,100', 4);
          G.Audio.play('crit', 0.6, e.x);
          if (e.dead) { G.fx.text(e.x, e.y - 50, '처형!', ba ? '#c090ff' : '#ff8060', 18, true); if (sk.charges < sk.maxCharges) { sk.charges++; if (sk.charges >= sk.maxCharges) sk.cdT = 0; } }
        } });
      G.Audio.play('aimed', 0.5);
      return true;
    },
  },
  eagle: {},
  barrage: {
    auto(sk) {
      const p = H(), s = sk.s;
      if (p.turtleT > 0) return false;
      const d = G.densestPoint(p.x, p.y, 520, 140); if (!d) return false;
      p.barrage = { n: s.arrows, t: 0, iv: 0.6 / s.arrows, a: Math.atan2(d.y - p.y, d.x - p.x), ang: s.angle, dmg: s.dmg };
      return true;
    },
  },

  volley: {
    cast(sk) {
      const p = H(), s = sk.s, [x, y] = hSpot(480), R = s.radius * p.stats.area;
      G.Zones.add({ kind: 'hvolley', x, y, r: R, life: s.dur * p.stats.dur, tick: 0.25, tickT: 0.15, draw: hDrawVolley,
        onTick: z => {
          const list = G.Grid.query(z.x, z.y, z.r);
          for (let i = 0; i < Math.min(4, list.length); i++) { const e = list[Math.floor(Math.random() * list.length)]; hHit(e, s.dmg, 'volley', { small: true }); }
          const pl = H(); if (U.d2(pl.x, pl.y, z.x, z.y) < 900 * 900) pl.trickT = Math.max(pl.trickT, G.t + 0.4); // 화살비가 내리는 동안 속임수 사격 유지
        } });
      G.Audio.play('bow', 0.8); G.later(0.15, () => G.Audio.play('bow', 0.6)); G.later(0.3, () => G.Audio.play('bow', 0.5));
    },
  },
  freezingtrap: {
    cast(sk) {
      const p = H(), s = sk.s, [x, y] = hSpot(420), R = s.radius * p.stats.area;
      // 덫은 3개까지 (오래된 것부터 사라짐)
      const mine = G.zones.filter(z => z.kind === 'htrap'); if (mine.length >= 3) mine[0].life = 0;
      G.Zones.add({ kind: 'htrap', x, y, r: 34, R, life: 30, tick: 0.1, tickT: 0.5, draw: hDrawTrap,
        onTick: z => {
          if (z.sprung || !G.Grid.query(z.x, z.y, z.r).length) return;
          z.sprung = true; z.life = 0;
          for (const e of G.Grid.query(z.x, z.y, z.R)) G.freeze(e, s.freeze);
          G.fx.ring(z.x, z.y, 10, z.R, 0.45, '160,220,255', 6, 0.3); G.fx.burst(z.x, z.y, 30, { rgb: '190,235,255', sp: 220, size: 11, spread: z.R * 0.3 });
          G.fx.shards(z.x, z.y, 14, 220); G.Audio.play('freeze');
          if (s.tar) G.Zones.add({ kind: 'tinted', color: '40,30,20', x: z.x, y: z.y, r: z.R, life: 6, tick: 0.3, tickT: 0, onTick: t => { for (const e of G.Grid.query(t.x, t.y, t.r)) G.chill(e, 0.5, 0.6); } });
        } });
      G.fx.burst(x, y, 8, { rgb: '200,230,255', sp: 80, size: 8 });
      G.Audio.play('click');
    },
  },
  wailingarrow: {
    cast(sk) {
      const p = H(), s = sk.s, m = G.aimPoint(), a = Math.atan2(m.y - (p.y - 26), m.x - p.x);
      hArrow({ a, speed: 950, life: 0.75, pierce: 999, r: 14, big: 1.8, tint: '120,230,140', wail: true,
        onHit: e => { hHit(e, s.dmg, 'wailingarrow', { school: 'shadow' }); G.fx.burst(e.x, e.y, 6, { rgb: '120,230,140', sp: 120, size: 9 }); },
        onExpire: pr => {
          const R = s.radius * p.stats.area;
          G.aoe(pr.x, pr.y, R, s.boom, 'wailingarrow', { school: 'shadow' }, e => { if (!e.boss) e.stunT = Math.max(e.stunT || 0, s.stun * (e.elite ? 0.5 : 1)); });
          G.fx.wave(pr.x, pr.y, R * 1.3, '140,240,160', 0.5); G.fx.ring(pr.x, pr.y, 8, R, 0.5, '100,220,130', 7, 0.3);
          G.fx.burst(pr.x, pr.y, 36, { rgb: '120,230,150', sp: 260, size: 12, spread: R * 0.2 }); G.fx.shake(6);
          G.Audio.play('shadow'); G.Audio.play('explode', 0.5);
        } });
      G.Audio.play('aimed', 0.8); G.Audio.play('shadow', 0.5);
    },
  },
  bindingshot: {
    cast(sk) {
      const p = H(), s = sk.s, [x, y] = hSpot(450), R = s.radius * p.stats.area;
      G.Zones.add({ kind: 'hbind', x, y, r: R, life: s.dur * p.stats.dur, tick: 0.1, tickT: 0, bound: new Set(), draw: hDrawBind,
        onTick: z => {
          for (const e of G.Grid.query(z.x, z.y, z.r)) if (!e.boss) z.bound.add(e);
          for (const e of z.bound) {
            if (e.dead) { z.bound.delete(e); continue; }
            if (U.d2(e.x, e.y, z.x, z.y) > z.r * z.r) {
              e.stunT = Math.max(e.stunT || 0, s.root * (e.elite ? 0.5 : 1)); z.bound.delete(e);
              const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy) || 1; e.x += dx / d * 20; e.y += dy / d * 20; // 사슬에 끌려 범위 안으로
              G.fx.burst(e.x, e.y, 6, { rgb: '120,255,170', sp: 100, size: 8 });
            }
          }
        } });
      G.fx.ring(x, y, 6, R, 0.4, '120,255,170', 4); G.Audio.play('bow', 0.7);
    },
  },
  trueshot: {
    cast(sk) {
      const p = H(); p.tsT = sk.s.dur * p.stats.dur; G.P.recalc();
      if (p.legend.doubletap) p.dtap = 2;
      G.fx.burst(p.x, p.y - 20, 30, { rgb: '255,210,90', sp: 200, size: 12 }); G.fx.ring(p.x, p.y, 10, 90, 0.5, '255,220,120', 5);
      G.Audio.play('buff');
    },
  },
  disengage: {
    cast(sk) {
      const p = H(), m = G.aimPoint();
      let a = Math.atan2(p.y - m.y, p.x - m.x);
      if (!Number.isFinite(a) || (m.x === p.x && m.y === p.y)) a = p.face > 0 ? Math.PI : 0;
      const dur = 0.24, d = sk.s.dist;
      p.leap = { vx: Math.cos(a) * d / dur, vy: Math.sin(a) * d / dur, t: 0, dur };
      G.fx.burst(p.x, p.y, 14, { rgb: '200,230,180', sp: 140, size: 9, type: 'smoke', add: false });
      G.Audio.play('blink', 0.6);
    },
  },
  turtle: {
    cast(sk) { const p = H(); p.turtleT = sk.s.dur; p.rapid = null; p.barrage = null; G.fx.ring(p.x, p.y, 10, 50, 0.4, '120,220,170', 5); G.Audio.play('buff', 0.7); },
  },
  exhilaration: {
    usable() { const p = H(); return p.hp < p.maxHp; },
    cast(sk) { const p = H(); G.P.heal(p.maxHp * sk.s.heal); G.fx.burst(p.x, p.y, 24, { rgb: '120,255,140', sp: 140, size: 10 }); G.Audio.play('buff', 0.6); },
  },
  feigndeath: {
    cast(sk) {
      const p = H(), s = sk.s;
      G.images.push({ kind: 'hdecoy', x: p.x, y: p.y, face: p.face, hp: p.maxHp * 4, life: s.dur, t: 0, update(im, dt) { im.t += dt; im.life -= dt; }, draw: hDrawDecoy });
      G.eprojs = G.eprojs.filter(b => U.d2(b.x, b.y, p.x, p.y) > 320 * 320);
      for (const e of G.Grid.query(p.x, p.y, 500)) if (!e.boss) e.fearT = Math.max(e.fearT || 0, e.elite ? 0.4 : 0.8);
      G.fx.burst(p.x, p.y, 16, { rgb: '200,200,200', sp: 90, size: 10, type: 'smoke', add: false });
      G.fx.text(p.x, p.y - 60, '죽은 척하기', '#d0d0d0', 16, true);
      G.Audio.play('death', 0.25);
    },
  },
  burstingshot: {
    cast(sk) {
      const p = H(), s = sk.s, m = G.aimPoint(), a = Math.atan2(m.y - p.y, m.x - p.x), half = 0.6, R = s.range * p.stats.area;
      for (const e of G.Grid.query(p.x, p.y, R)) {
        const ea = Math.atan2(e.y - p.y, e.x - p.x); if (Math.abs(U.angDiff(a, ea)) > half) continue;
        hHit(e, s.dmg, 'burstingshot');
        if (!e.boss) { const k = s.push * (e.elite ? 0.5 : 1); e.x += Math.cos(ea) * k; e.y += Math.sin(ea) * k; G.chill(e, 0.5, 3); }
      }
      G.rings.push({ kind: 'cone', x: p.x, y: p.y - 6, a, half, r: R, t: 0, dur: 0.3 });
      G.fx.burst(p.x + Math.cos(a) * 40, p.y - 20 + Math.sin(a) * 40, 20, { rgb: '220,235,255', sp: 260, size: 10 });
      G.fx.shake(4); G.Audio.play('gun', 0.7);
    },
  },
});

// 조준 사격 대상: 관측자의 징표 > 보스 > 정예 > 적이 몰린 곳 (꿰뚫기 좋게)
function hAimTarget() {
  const p = H(), pr = hPriority(800);
  if (pr && (pr.spotT > G.t || pr.boss || pr.elite)) return pr;
  const d = G.densestPoint(p.x, p.y, 700, 130);
  return d ? G.nearestEnemy(d.x, d.y, 140) : G.nearestEnemy(p.x, p.y, 800);
}
// 정밀 사격 하나 쓰기 → 쓴 경우 true (이동 표적 중첩)
function hUsePrecise() {
  const p = H(); if (!(p.precise > 0)) return false;
  p.precise--; if (!p.precise) p.preciseT = 0;
  if (p.stats.mvTarget) p.mvt = Math.min(2, p.mvt + 1);
  return true;
}
function hArcane(t, dmg, empowered, src = 'arcaneshot') {
  const p = H();
  hArrow({ a: Math.atan2(t.y - 20 - (p.y - 26), t.x - p.x), homing: t, turn: 14, noRetarget: true, speed: 1300, tint: '200,110,255', big: empowered ? 1.4 : 1.1,
    onHit: e => { hHit(e, dmg, src, { school: 'arcane', careful: true }); G.fx.burst(e.x, e.y, empowered ? 14 : 8, { rgb: '210,130,255', sp: 150, size: 10 }); if (empowered) G.fx.ring(e.x, e.y, 5, 44, 0.25, '220,150,255', 3); G.Audio.play('hit', 0.5, e.x); } });
  G.Audio.play('cast', 0.25);
}
// 조준 사격 발사 (이중 사격이면 한 번 더)
function hFireAimed(sk, t, echo) {
  const p = H(), s = sk.s, st = p.stats;
  const mul = (1 + p.bs * (st.bstorm || 0)) * (1 + p.mvt * (st.mvTarget || 0));
  if (!echo) { p.bs = 0; p.mvt = 0; }
  const trick = p.trickT > G.t; if (trick && !echo) p.trickT = 0;
  const [mx, my] = hMuzzle(), a = Math.atan2(t.y - 20 - my, t.x - mx);
  let first = true;
  hArrow({ a, speed: 1900, life: 0.55, pierce: s.pierce, r: 12, big: 1.7, tint: '255,235,160', aimed: true,
    onHit: e => {
      let m = mul;
      if (e.spotT > G.t) { m *= 1 + (p.skills.eagle ? p.skills.eagle.s.bonus : 0.4); e.spotT = 0; G.fx.text(e.x, e.y - 60, '관측자의 징표!', '#ffe08a', 15, true); }
      hHit(e, s.dmg * m, 'aimedshot', { careful: true });
      G.fx.burst(e.x, e.y, 14, { rgb: '255,230,150', sp: 220, size: 11 }); G.fx.ring(e.x, e.y, 5, 50, 0.25, '255,240,190', 4);
      G.Audio.play('arrowHit', 0.9, e.x);
      if (first) {
        first = false;
        p.precise = hPreciseMax(); p.preciseT = 15;
        if (trick) hRicochet(e, hTrickN(), s.dmg * mul * hTrickMul(), 'trickshot');
        if (p.legend.hydra) { const o = nearestN(e.x, e.y, 2, 320).find(x => x !== e); if (o) hRicochet(e, 1, s.dmg * mul * 0.4, 'hydra'); }
        if (e.boss || e.elite) G.fx.hitStop(0.03);
      }
    } });
  G.fx.burst(mx, my, 12, { rgb: '255,230,160', sp: 200, size: 9 }); G.fx.shake(3);
  G.Audio.play('aimed', 0.9); hShotSound(0.6);
  if (!echo && p.dtap > 0) { p.dtap--; G.later(0.15, () => { const tt = t.dead ? hAimTarget() : t; if (tt) hFireAimed(sk, tt, true); }); }
}

// 매 프레임: 속사 · 탄막 연사, 독수리, 파수꾼 징표, 달의 폭풍
function hSkillsUpdate(p, dt) {
  const hs = 1 + G.P.haste();
  // 정조준: 조준 사격 · 속사 재사용이 2.5배로 돈다
  if (p.tsT > 0) for (const id of ['aimedshot', 'rapidfire']) { const sk = p.skills[id]; if (sk) G.Skills.reduceCd(sk, dt * hs * 1.5); }
  if (p.rapid && p.skills.rapidfire) {
    const r = p.rapid, s = p.skills.rapidfire.s;
    r.t -= dt * hs;
    while (r.t <= 0 && r.n > 0) {
      r.t += r.iv; r.n--;
      const t = hPriority(H_RANGE); if (!t) { r.n = 0; break; }
      const [mx, my] = hMuzzle();
      hArrow({ a: Math.atan2(t.y - 20 - my, t.x - mx) + U.rand(-0.05, 0.05), homing: t, turn: 10, noRetarget: true, speed: 1300, tint: '255,170,110',
        onHit: e => {
          hHit(e, s.dmg, 'rapidfire', { small: true }); hFocus(s.focus); if (p.stats.bstorm) p.bs = Math.min(15, p.bs + 1);
          if (r.trick) hRicochet(e, 1 + Math.floor((p.stats.trick || 0) / 2), s.dmg * hTrickMul(), 'trickshot');
          if (p.legend.hydra && Math.random() < 0.5) hRicochet(e, 1, s.dmg * 0.4, 'hydra');
          G.fx.burst(e.x, e.y, 3, { rgb: '255,180,120', sp: 80, size: 6 });
        } });
      hShotSound(0.3);
    }
    if (r.n <= 0) p.rapid = null;
  }
  if (p.barrage) {
    const b = p.barrage;
    b.t -= dt;
    while (b.t <= 0 && b.n > 0) {
      b.t += b.iv; b.n--;
      hArrow({ a: b.a + U.rand(-b.ang / 2, b.ang / 2), speed: U.rand(900, 1200), life: 0.6, pierce: 1, tint: '255,190,120',
        onHit: e => { hHit(e, b.dmg, 'barrage', { small: true }); } });
      if (b.n % 3 === 0) hShotSound(0.25);
    }
    if (b.n <= 0) p.barrage = null;
  }
  hEagleUpdate(p, dt);
  // 파수꾼 징표 폭발
  if (p.sentList.length) {
    for (const e of p.sentList) {
      if (e.dead) { e.sentN = 0; continue; }
      if (G.t >= e.sentT) {
        const dmg = (p.skills.eagle ? p.skills.eagle.s.dmg : 40) * 0.6 * e.sentN;
        hHit(e, dmg, 'sentinel', { school: 'arcane', noSentinel: true });
        G.fx.ring(e.x, e.y - 10, 4, 40 + e.sentN * 6, 0.3, '140,190,255', 4); G.fx.burst(e.x, e.y - 10, 6 + e.sentN * 2, { rgb: '150,200,255', sp: 140, size: 9 });
        e.sentN = 0;
      }
    }
    p.sentList = p.sentList.filter(e => e.sentN > 0 && !e.dead);
  }
  if (p.evo.sentinel && p.skills.eagle) {
    p.lunarT -= dt;
    if (p.lunarT <= 0) {
      const d = G.densestPoint(p.x, p.y, 600, 140);
      if (d) {
        p.lunarT = 15;
        const s = p.skills.eagle.s, R = 140 * p.stats.area;
        G.Zones.add({ kind: 'hlunar', x: d.x, y: d.y, r: R, life: 4, tick: 0.5, tickT: 0.2, draw: hDrawLunar,
          onTick: z => { for (const e of G.Grid.query(z.x, z.y, z.r)) hHit(e, s.dmg * 0.5, 'lunarstorm', { school: 'arcane', small: true, noSentinel: true }); } });
        G.Audio.play('comet', 0.5);
      } else p.lunarT = 1;
    }
  }
}

// 감시하는 독수리: 머리 위를 맴돌다가 표적에 내리꽂아 관측자의 징표를 찍는다
function hEagleUpdate(p, dt) {
  const sk = p.skills.eagle;
  if (!sk) { p.eagle = null; return; }
  const s = sk.s, owl = !!p.evo.sentinel;
  const q = p.eagle || (p.eagle = { x: p.x, y: p.y - 120, t: 0, state: 'circle', cdT: 2, tgt: null, ft: 0 });
  q.t += dt; q.cdT -= dt * (1 + G.P.haste());
  if (q.state === 'circle') {
    const tx = p.x + Math.cos(q.t * 1.4) * 70, ty = p.y - 110 + Math.sin(q.t * 2.8) * 14;
    q.x += (tx - q.x) * Math.min(1, dt * 4); q.y += (ty - q.y) * Math.min(1, dt * 4); q.face = Math.cos(q.t * 1.4 + Math.PI / 2) < 0 ? 1 : -1;
    if (q.cdT <= 0) {
      let best = null, bs = -1;
      for (const e of G.Grid.query(p.x, p.y, 650)) { const sc = (e.boss ? 1e7 : e.elite ? 5e6 : 0) + e.hp - (e.spotT > G.t ? 1e8 : 0); if (sc > bs) { bs = sc; best = e; } }
      if (best) { q.state = 'dive'; q.tgt = best; q.ft = 0; q.sx = q.x; q.sy = q.y; G.Audio.play('blink', 0.3); } else q.cdT = 0.5;
    }
  } else if (q.state === 'dive') {
    const e = q.tgt; q.ft += dt / 0.35;
    if (e.dead) { q.state = 'rise'; q.cdT = 1; }
    else {
      const f = Math.min(1, q.ft), tx = e.x, ty = e.y - 20;
      q.x = q.sx + (tx - q.sx) * f * f; q.y = q.sy + (ty - q.sy) * f * f; q.face = tx > q.sx ? 1 : -1;
      if (f >= 1) {
        e.spotT = G.t + 12; p.spotted.push(e);
        hHit(e, s.dmg * (s.talon && (e.elite || e.boss) ? 2 : 1), 'eagle', { noSentinel: true });
        if (owl) hSentinel(e), hSentinel(e);
        G.fx.burst(e.x, e.y - 10, 14, { rgb: owl ? '150,200,255' : '255,230,170', sp: 180, size: 10 });
        G.fx.ring(e.x, e.y, 6, 50, 0.3, owl ? '150,200,255' : '255,220,120', 4);
        G.Audio.play('arrowHit', 0.8, e.x);
        q.state = 'rise'; q.cdT = s.markCd;
      }
    }
  } else { // rise: 다시 머리 위로
    const tx = p.x, ty = p.y - 110;
    q.x += (tx - q.x) * Math.min(1, dt * 3); q.y += (ty - q.y) * Math.min(1, dt * 3);
    if (U.d2(q.x, q.y, tx, ty) < 900) q.state = 'circle';
  }
  p.spotted = p.spotted.filter(e => !e.dead && e.spotT > G.t);
}

// ---------- 그림 ----------
// 사냥꾼 그림 (64×76, 발 기준 y≈70). ammo: arrow 활 · bullet 총 · bolt 석궁
function drawHunterSprite(x, ammo) {
  // 망토
  poly(x, [[21, 27], [43, 27], [49, 66], [15, 66]], '#1e2a14');
  // 사슬 갑옷 (아래로 갈수록 어두운 녹갈색 + 사슬 무늬)
  poly(x, [[23, 28], [41, 28], [46, 64], [18, 64]], lg(x, 0, 28, 0, 64, [[0, '#6a7a4a'], [0.55, '#4a5a32'], [1, '#2a3418']]));
  x.save(); x.globalAlpha = 0.35; for (let yy = 32; yy < 62; yy += 3) for (let xx = 21 + (yy % 2); xx < 44; xx += 3) ell(x, xx, yy, 0.8, 0.8, '#c8d0b0'); x.restore();
  poly(x, [[18, 64], [46, 64], [45, 60], [19, 60]], '#8a6a3a');
  // 화살통 띠 + 허리띠
  line(x, 24, 29, 41, 46, '#5a3a1a', 3);
  poly(x, [[20, 43], [44, 43], [45, 47], [19, 47]], '#3a2410', '#1a0e04');
  ell(x, 32, 45, 2.4, 2.4, '#e0b040');
  // 등의 화살통 (왼쪽 위로 깃이 보인다)
  poly(x, [[12, 18], [19, 15], [25, 40], [18, 42]], '#6a4420', '#2a1808');
  for (const [fx, fy, c] of [[13, 13, '#d04030'], [16, 11, '#f0f0e0'], [19, 12, '#d04030']]) poly(x, [[fx, fy], [fx + 3, fy - 5], [fx + 4, fy + 2]], c);
  // 어깨 (가죽 · 사슬 견갑)
  ell(x, 20, 30, 6.5, 5, '#7a5a30'); ell(x, 44, 30, 6.5, 5, '#7a5a30');
  ell(x, 20, 29, 4.5, 3, '#9aa080'); ell(x, 44, 29, 4.5, 3, '#9aa080');
  // 두건 + 깃털
  ell(x, 32, 19, 10, 11, '#2e4a20');
  poly(x, [[23, 15], [28, 3], [37, 9]], '#2e4a20');
  poly(x, [[37, 9], [46, 0], [42, 11]], '#c04030'); line(x, 38, 9, 45, 1, '#f0d0a0', 1);
  ell(x, 34, 21, 6.5, 7.5, '#0e1408');
  ell(x, 35, 22, 4.5, 5.5, '#d8b090');
  eyes(x, [[36.5, 21]], '#ffe8a0', 1.2);
  line(x, 32, 26, 37, 26, '#4a3020', 1.6); // 수염 그림자
  // 무기
  if (ammo === 'bullet') {
    // 총: 나무 개머리 + 쇠 총열
    poly(x, [[30, 44], [40, 40], [42, 46], [32, 50]], '#6a4020', '#2a1808');
    poly(x, [[38, 40], [60, 33], [61, 36], [40, 44]], '#8a8a90', '#2a2a30');
    ell(x, 60, 34.5, 1.6, 1.6, '#1a1a1a');
    ell(x, 44, 42, 3, 3, '#d8b090');
  } else if (ammo === 'bolt') {
    // 석궁: 가로 활대 + 몸통
    poly(x, [[34, 42], [56, 38], [57, 41], [35, 46]], '#6a4020', '#2a1808');
    x.beginPath(); x.moveTo(52, 28); x.quadraticCurveTo(58, 39, 53, 50); x.strokeStyle = '#4a3018'; x.lineWidth = 3; x.stroke();
    line(x, 52, 28, 47, 40, '#e8e0c8', 0.8); line(x, 53, 50, 47, 40, '#e8e0c8', 0.8);
    ell(x, 40, 44, 3, 3, '#d8b090');
  } else {
    // 활: 크게 휜 활대 + 시위
    x.beginPath(); x.moveTo(47, 10); x.quadraticCurveTo(60, 38, 47, 66); x.strokeStyle = '#5a3a18'; x.lineWidth = 3.2; x.stroke();
    x.strokeStyle = '#a07040'; x.lineWidth = 1.2; x.stroke();
    line(x, 47, 10, 47, 66, '#efe8d0', 0.8);
    ell(x, 54, 38, 3.2, 3.2, '#d8b090');
  }
}
function hDrawArrow(c, pr, a) {
  const sc = pr.big || 1, tint = pr.tint;
  c.save(); c.translate(pr.x, pr.y); c.rotate(a);
  if (tint || pr.aimed) {
    c.globalCompositeOperation = 'lighter';
    const len = pr.aimed ? 120 : 40 * sc, g = c.createLinearGradient(-len, 0, 0, 0);
    g.addColorStop(0, `rgba(${tint || '255,240,190'},0)`); g.addColorStop(1, `rgba(${tint || '255,240,190'},0.75)`);
    c.strokeStyle = g; c.lineWidth = (pr.aimed ? 6 : 4) * sc; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-len, 0); c.lineTo(0, 0); c.stroke();
    c.drawImage(G.Spr.glow(tint || '255,235,160', 64), -14 * sc, -14 * sc, 28 * sc, 28 * sc);
    c.globalCompositeOperation = 'source-over';
  }
  c.scale(sc, sc);
  if (pr.ammo === 'bullet' && !tint) {
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(-34, 0, 0, 0); g.addColorStop(0, 'rgba(255,200,80,0)'); g.addColorStop(1, 'rgba(255,230,150,0.9)');
    c.strokeStyle = g; c.lineWidth = 3; c.beginPath(); c.moveTo(-34, 0); c.lineTo(0, 0); c.stroke();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#ffe8a0'; c.beginPath(); c.ellipse(0, 0, 3.5, 2, 0, 0, 7); c.fill();
  } else {
    const bolt = pr.ammo === 'bolt', tail = bolt ? -14 : -22;
    c.strokeStyle = pr.wail ? '#203a24' : '#8a6038'; c.lineWidth = bolt ? 2.6 : 2; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(tail, 0); c.lineTo(6, 0); c.stroke();
    c.fillStyle = tint ? `rgb(${tint})` : '#d8dce0';
    c.beginPath(); c.moveTo(12, 0); c.lineTo(4, -3.5); c.lineTo(5, 0); c.lineTo(4, 3.5); c.closePath(); c.fill();
    c.fillStyle = bolt ? '#404040' : '#d04030';
    c.beginPath(); c.moveTo(tail + 6, 0); c.lineTo(tail - 1, -4); c.lineTo(tail + 1, 0); c.lineTo(tail - 1, 4); c.closePath(); c.fill();
  }
  c.restore();
}
function hArrowTrail(pr) {
  if (pr.aimed) { if (Math.random() < 0.8) G.fx.part({ x: pr.x, y: pr.y, life: 0.25, size: 8, rgb: '255,235,170' }); }
  else if (pr.tint && Math.random() < 0.45) G.fx.part({ x: pr.x, y: pr.y, life: 0.2, size: 6 * (pr.big || 1), rgb: pr.tint });
  else if (pr.ammo === 'bullet' && Math.random() < 0.2) G.fx.part({ x: pr.x, y: pr.y, life: 0.3, size: 5, rgb: '120,120,120', type: 'smoke', add: false });
}
// 연발 사격: 하늘에서 쏟아지는 화살 + 바닥 고리
function hDrawVolley(c, z, life) {
  c.save(); c.translate(z.x, z.y); c.scale(1, 0.75);
  c.fillStyle = `rgba(255,220,150,${0.1 * life})`; c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.fill();
  c.strokeStyle = `rgba(255,220,150,${0.5 * life})`; c.lineWidth = 2; c.setLineDash([10, 8]); c.lineDashOffset = -z.t * 30;
  c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.stroke(); c.setLineDash([]); c.restore();
  // 비처럼 떨어지는 화살 (매 프레임 위치를 해시로 계산해 입자를 만들지 않는다)
  c.strokeStyle = `rgba(230,210,170,${0.85 * life})`; c.lineWidth = 1.6;
  for (let i = 0; i < 14; i++) {
    const ph = (z.t * 2.4 + i * 0.137) % 1, ang = U.hash(i, Math.floor(z.t * 2.4 + i * 0.137), 3) * 6.283, rr = Math.sqrt(U.hash(i, Math.floor(z.t * 2.4 + i * 0.137), 5)) * z.r;
    const gx = z.x + Math.cos(ang) * rr, gy = z.y + Math.sin(ang) * rr * 0.75, y = gy - 260 * (1 - ph);
    c.beginPath(); c.moveTo(gx + 26 * (1 - ph) + 4, y - 18); c.lineTo(gx + 26 * (1 - ph), y); c.stroke();
    if (ph > 0.92) { c.fillStyle = `rgba(255,230,180,${life})`; c.fillRect(gx - 2, gy - 1, 4, 2); }
  }
}
function hDrawTrap(c, z, life) {
  const armed = z.t > 0.5, pulse = 0.5 + Math.sin(G.t * 6) * 0.3;
  c.save(); c.translate(z.x, z.y); c.scale(1, 0.6);
  c.strokeStyle = `rgba(160,220,255,${(armed ? 0.25 : 0.1) * life})`; c.lineWidth = 1.5; c.setLineDash([6, 6]);
  c.beginPath(); c.arc(0, 0, z.R, 0, 7); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#3a4048'; c.beginPath(); c.arc(0, 0, 16, 0, 7); c.fill();
  c.strokeStyle = '#9aa6b0'; c.lineWidth = 2; c.stroke();
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; c.beginPath(); c.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); c.lineTo(Math.cos(a) * 21, Math.sin(a) * 21); c.stroke(); }
  c.restore();
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = armed ? pulse * life : 0.3;
  c.drawImage(G.Spr.glow('120,200,255', 32), z.x - 10, z.y - 10, 20, 20);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function hDrawBind(c, z, life) {
  c.save(); c.translate(z.x, z.y); c.scale(1, 0.75);
  c.strokeStyle = `rgba(120,255,170,${0.55 * life})`; c.lineWidth = 3; c.setLineDash([14, 8]); c.lineDashOffset = z.t * 40;
  c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.stroke(); c.setLineDash([]); c.restore();
  c.strokeStyle = `rgba(120,255,170,${0.45 * life})`; c.lineWidth = 1.5;
  for (const e of z.bound) { c.beginPath(); c.moveTo(z.x, z.y - 14); c.lineTo(e.x, e.y - 10); c.stroke(); }
  c.fillStyle = '#5a3a18'; c.fillRect(z.x - 1.5, z.y - 30, 3, 30);
  c.globalCompositeOperation = 'lighter'; c.drawImage(G.Spr.glow('120,255,170', 64), z.x - 18, z.y - 44, 36, 36); c.globalCompositeOperation = 'source-over';
}
function hDrawLunar(c, z, life) {
  c.save(); c.translate(z.x, z.y); c.scale(1, 0.75);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, z.r);
  g.addColorStop(0, `rgba(170,210,255,${0.35 * life})`); g.addColorStop(1, 'rgba(120,160,255,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, z.r, 0, 7); c.fill(); c.restore();
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * life;
  const w = 30 + Math.sin(z.t * 10) * 6, gr = c.createLinearGradient(0, z.y - 500, 0, z.y);
  gr.addColorStop(0, 'rgba(160,200,255,0)'); gr.addColorStop(1, 'rgba(200,225,255,0.9)');
  c.fillStyle = gr; c.fillRect(z.x - w / 2, z.y - 500, w, 500);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
// 죽은 척하기 미끼: 쓰러진 사냥꾼
function hDrawDecoy(c, im) {
  const S = G.Spr, spr = S['hunter_' + (H().ammo || 'arrow')];
  if (!spr) return;
  c.save(); c.globalAlpha = Math.min(1, im.life * 2) * 0.9; c.translate(im.x, im.y + 6); c.rotate(-Math.PI / 2 * im.face); c.drawImage(spr, -32, -60); c.restore();
}
function hDrawEagle(c, q, owl) {
  const flap = Math.sin(G.t * (q.state === 'dive' ? 30 : 9)) * (q.state === 'dive' ? 0.3 : 1);
  const x = q.x, y = q.y, body = owl ? '#c8d8f0' : '#6a4020', wing = owl ? '#a0b8e8' : '#4a2c14', head = owl ? '#e8f0ff' : '#f4f0e0';
  c.save(); c.translate(x, y); if (q.face < 0) c.scale(-1, 1);
  if (q.state === 'dive') c.rotate(0.6);
  if (owl) { c.globalCompositeOperation = 'lighter'; c.drawImage(G.Spr.glow('130,180,255', 64), -30, -30, 60, 60); c.globalCompositeOperation = 'source-over'; }
  c.fillStyle = wing;
  c.beginPath(); c.moveTo(-4, -2); c.quadraticCurveTo(-18, -18 * flap - 4, -34, -6 * flap); c.quadraticCurveTo(-18, 2, -4, 4); c.fill();
  c.beginPath(); c.moveTo(4, -2); c.quadraticCurveTo(14, -16 * flap - 4, 28, -8 * flap); c.quadraticCurveTo(14, 2, 4, 4); c.fill();
  c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, 12, 6, 0, 0, 7); c.fill();
  c.beginPath(); c.moveTo(-10, 0); c.lineTo(-18, -4); c.lineTo(-18, 5); c.closePath(); c.fill();
  c.fillStyle = head; c.beginPath(); c.arc(11, -3, 5, 0, 7); c.fill();
  c.fillStyle = '#e8b030'; c.beginPath(); c.moveTo(15, -3); c.lineTo(20, -1); c.lineTo(15, 0); c.closePath(); c.fill();
  c.fillStyle = owl ? '#3060ff' : '#000'; c.fillRect(12, -5, 1.6, 1.6);
  c.restore();
}

// ---------- 직업 정의 ----------
G.CLASSES.hunter = {
  id: 'hunter', name: '사격 사냥꾼', className: '사냥꾼', spec: '사격', color: '#aad372', icon: 'classhunter',
  starter: 'steadyshot', bar: 'focus', masteryText: '특화(저격 훈련): 적과의 거리 100px마다 피해 +0.5%/점 (400px까지)',

  init(p) {
    Object.assign(p, {
      focus: 50, focusMax: 100, precise: 0, preciseT: 0, trickT: 0, lnl: 0, tsT: 0, turtleT: 0, leap: null, phT: 0, sfN: 0, sfT: 0,
      bs: 0, mvt: 0, dtap: 0, rapid: null, barrage: null, eagle: null, spotted: [], sentList: [], lunarT: 6, aiming: false, aimTgt: null,
      ammo: hAmmo(),
    });
  },
  recalc(st, p) {
    st.armor += 0.05; // 사슬 갑옷: 사냥꾼 기본 피해 감소
    if (p.tsT > 0 && p.skills.trueshot) { st.crit += p.skills.trueshot.s.crit; st.critMul += 0.15; }
    if (p.phT > 0 && p.skills.disengage) st.speedMul += p.skills.disengage.s.haste;
    p.focusMax = 100 + (st.focusMax || 0);
  },
  computeSkill(sk, s, p) {
    if (sk.id === 'aimedshot' && p.legend.windrunner) s.charges += 1;
    if (sk.id === 'killshot' && p.legend.deadeye) { s.charges += 1; s.thr += 0.05; s.dmg *= 1.3; }
    if (sk.id === 'killshot' && p.evo.blackarrow) { s.ba = 1; s.dmg *= 1.3; }
  },
  haste(p) { return p.sfT > 0 ? p.stats.steadyFocus || 0 : 0; },
  onCrit() {},
  onKill(e, p) {
    // 검은 화살: 지속 피해가 걸린 적이 죽으면 그림자 화살 3발
    if (e.dots && e.dots.blackarrow && p.skills.killshot) {
      const s = p.skills.killshot.s;
      for (const t of nearestN(e.x, e.y, 3, 320)) G.Proj.spawn({ x: e.x, y: e.y - 10, a: Math.atan2(t.y - e.y, t.x - e.x), speed: 900, r: 8, kind: 'harrow', ammo: 'arrow', tint: '140,80,220', homing: t, turn: 10, life: 0.8,
        draw: hDrawArrow, update: hArrowTrail, onHit: x => hHit(x, s.dmg * 0.35, 'shadowarrow', { school: 'shadow', small: true }) });
      G.fx.burst(e.x, e.y, 12, { rgb: '130,70,210', sp: 160, size: 10 });
    }
  },
  busy() { return false; },
  immune(p) { return p.turtleT > 0 || !!p.leap; },
  activate(id, p) {
    if (id === 'turtle' && p.turtleT > 0) { p.turtleT = 0; return true; }
    if (p.turtleT > 0 && H_ATTACKS.includes(id)) { G.UI.error('거북의 상 중에는 공격할 수 없습니다.'); return false; }
  },
  // 치명상: 거북의 상이 준비돼 있으면 자동으로 발동하고 생명력 1로 버틴다
  preventDeath(p) {
    const tt = p.skills.turtle;
    if (!tt || tt.charges <= 0 || p.turtleT > 0) return false;
    p.hp = 1; G.SKILL_IMPL.turtle.cast(tt); G.Skills.startCd(tt);
    G.fx.text(p.x, p.y - 60, '거북의 상!', '#a0e0c0', 22, true);
    return true;
  },
  autoRule(id, p) {
    const hp = p.hp / p.maxHp, near = G.nearestEnemy(p.x, p.y, 160), boss = !!(G.Waves.boss && !G.Waves.boss.dead);
    if (id === 'turtle') return hp < 0.25 && p.turtleT <= 0 ? true : false;
    if (id === 'exhilaration') return hp < 0.5 ? true : false;
    if (id === 'feigndeath') return hp < 0.4 && !!near ? true : false;
    if (id === 'disengage') return !!G.nearestEnemy(p.x, p.y, 90);
    if (id === 'trueshot') return G.enemies.length >= 25 || boss ? true : false;
    if (id === 'burstingshot') return G.Grid.query(p.x, p.y, 160).length >= 4;
    if (id === 'volley' || id === 'wailingarrow' || id === 'bindingshot') { const d = G.densestPoint(p.x, p.y, 450, 150); return d && d.n >= 6 ? undefined : false; }
  },

  update(p, dt) {
    const hs = 1 + G.P.haste();
    p.focus = Math.min(p.focusMax, p.focus + 5 * hs * (p.tsT > 0 ? 1.5 : 1) * dt);
    if (p.preciseT > 0 && (p.preciseT -= dt) <= 0) p.precise = 0;
    if (p.sfT > 0) p.sfT -= dt;
    if (p.tsT > 0 && (p.tsT -= dt) <= 0) G.P.recalc();
    if (p.phT > 0 && (p.phT -= dt) <= 0) G.P.recalc();
    if (p.turtleT > 0) {
      p.turtleT -= dt;
      const tt = p.skills.turtle; if (tt && tt.s.heal) G.P.healSilent(p.maxHp * tt.s.heal * dt);
      // 날아오는 투사체를 튕겨낸다
      for (const b of G.eprojs) if (U.d2(b.x, b.y, p.x, p.y - 14) < 46 * 46) { b.life = 0; G.fx.burst(b.x, b.y, 4, { rgb: '160,240,200', sp: 120, size: 7 }); }
    }
    if (p.leap) {
      const l = p.leap; l.t += dt;
      p.x += l.vx * dt; p.y += l.vy * dt;
      if (Math.random() < 0.6) G.fx.part({ x: p.x, y: p.y - 10, life: 0.3, size: 10, rgb: '200,230,180' });
      if (l.t >= l.dur) { p.leap = null; p.phT = 3; G.P.recalc(); G.fx.burst(p.x, p.y + 10, 10, { rgb: '170,150,110', sp: 100, size: 9, type: 'smoke', add: false }); }
    }
  },
  skillsUpdate(p, dt) { hSkillsUpdate(p, dt); },

  // ---------- HUD ----------
  skillIcon(id, p) { return id === 'killshot' && p.evo.blackarrow ? 'blackarrow' : id === 'eagle' && p.evo.sentinel ? 'sentinel' : G.SKILLS[id].icon; },
  resource(p) { return { cur: Math.floor(p.focus), max: p.focusMax, label: '집중' }; },
  castbar(p) {
    const am = p.skills.aimedshot;
    if (am && am.castT > 0 && am.castT < 1 && p.turtleT <= 0) return { f: am.castT, name: p.moving ? '조준 사격 (이동 중 40%)' : '조준 사격', total: am.s.cast / (1 + G.P.haste()) };
    const ss = p.skills.steadyshot;
    if (!ss || p.turtleT > 0 || !(ss.castT > 0 && ss.castT < 1)) return null;
    return { f: ss.castT, name: '고정 사격', total: ss.s.cast / (1 + G.P.haste()) };
  },
  slotState(id, p) {
    return {
      unusable: p.turtleT > 0 && H_ATTACKS.includes(id),
      active: (id === 'trueshot' && p.tsT > 0) || (id === 'turtle' && p.turtleT > 0),
    };
  },
  autoGlow(id, p) { return (id === 'aimedshot' && p.lnl > 0) || ((id === 'arcaneshot' || id === 'multishot') && p.precise > 0) || (id === 'rapidfire' && p.trickT > G.t); },
  buffs(p) {
    const b = [];
    if (p.tsT > 0) b.push(['trueshot', p.tsT, '', '정조준', '조준 사격 · 속사 재사용 2.5배 · 치명타 증가']);
    if (p.precise > 0) b.push(['preciseshots', p.preciseT, p.precise > 1 ? p.precise : '', '정밀 사격', '다음 신비한 사격 · 일제 사격 피해 증가']);
    if (p.trickT > G.t) b.push(['trickshots', p.trickT - G.t, '', '속임수 사격', '다음 조준 사격 · 속사가 주변 적에게 튕김']);
    if (p.lnl > 0) b.push(['lockandload', -1, '', '장전', '다음 조준 사격 즉시 · 충전 소모 없음']);
    if (p.sfT > 0) b.push(['steadyfocus', p.sfT, '', '고정 집중', '가속 증가']);
    if (p.bs > 0) b.push(['bulletstorm', -1, p.bs, '탄환 폭풍', '다음 조준 사격 피해 증가']);
    if (p.mvt > 0) b.push(['movingtarget', -1, p.mvt > 1 ? p.mvt : '', '이동 표적', '다음 조준 사격 피해 증가']);
    if (p.dtap > 0) b.push(['doubletap', -1, p.dtap, '이중 사격', '조준 사격이 한 번 더 나감']);
    if (p.turtleT > 0) b.push(['turtle', p.turtleT, '', '거북의 상', '모든 피해 면역 · 공격 불가']);
    if (p.phT > 0) b.push(['disengage', p.phT, '', '가속', '이동 속도 증가']);
    if (p.absorb > 0) b.push(['survivalinstincts', -1, Math.round(p.absorb), '생존 본능', '피해 흡수']);
    return b;
  },

  // ---------- 그리기 ----------
  drawBody(c, x, y, face, alpha, image, t) {
    const S = G.Spr, p = G.player, ammo = p.ammo || 'arrow', key = 'hunter_' + ammo;
    if (!S[key]) { S[key] = S.make(64, 76, cx => drawHunterSprite(cx, ammo)); S[key + 'Flash'] = S.variants(S[key]).flash; }
    const spr = !image && p.hurtT > 0 ? S[key + 'Flash'] : S[key];
    const bob = (image || p.moving) ? Math.abs(Math.sin((t ?? G.t) * 10)) * -2.5 : Math.sin(G.t * 2) * 0.8;
    c.save(); c.globalAlpha = alpha; c.translate(x, y + 14 + bob); if (face < 0) c.scale(-1, 1); c.drawImage(spr, -32, -74); c.restore();
  },
  drawUnder(c, p) {
    if (p.tsT > 0) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.4 + Math.sin(G.t * 8) * 0.1; c.drawImage(G.Spr.glow('255,200,80', 128), p.x - 46, p.y - 64, 92, 100); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    // 조준 사격을 겨누는 동안: 대상까지 이어지는 붉은 조준선 (차오를수록 진해짐)
    const am = p.skills.aimedshot;
    if (p.aimTgt && !p.aimTgt.dead && am && am.castT > 0) {
      const f = am.castT, [mx, my] = hMuzzle(), t = p.aimTgt;
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      c.strokeStyle = `rgba(255,60,40,${0.15 + f * 0.5})`; c.lineWidth = 1 + f * 2; c.setLineDash([8, 6]); c.lineDashOffset = -G.t * 60;
      c.beginPath(); c.moveTo(mx, my); c.lineTo(t.x, t.y - 20); c.stroke(); c.setLineDash([]);
      c.globalCompositeOperation = 'source-over';
      const r = 26 - f * 14;
      c.strokeStyle = `rgba(255,80,60,${0.5 + f * 0.5})`; c.lineWidth = 2;
      c.beginPath(); c.arc(t.x, t.y - 20, r, 0, 7); c.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; c.beginPath(); c.moveTo(t.x + Math.cos(a) * (r - 6), t.y - 20 + Math.sin(a) * (r - 6)); c.lineTo(t.x + Math.cos(a) * (r + 6), t.y - 20 + Math.sin(a) * (r + 6)); c.stroke(); }
    }
  },
  drawOver(c, p) {
    // 관측자의 징표 · 사냥꾼의 징표 (적 머리 위)
    const img = G.IMG.eagle;
    for (const e of p.spotted) {
      const y = e.y - e.r * 2.6 * e.scale / 1.2 - (e.elite || e.boss ? 52 : 34), bob = Math.sin(G.t * 5) * 2;
      c.fillStyle = '#ffd860'; c.fillRect(e.x - 9, y - 9 + bob, 18, 18);
      if (img && img.complete && img.naturalWidth) c.drawImage(img, e.x - 8, y - 8 + bob, 16, 16);
    }
    if (p.stats.hmark) for (const e of G.enemies) if ((e.elite || e.boss) && !e.dead) {
      const y = e.y + e.r * 0.8;
      c.save(); c.translate(e.x, y); c.scale(1, 0.4); c.rotate(G.t * 0.8);
      c.strokeStyle = 'rgba(255,60,50,0.7)'; c.lineWidth = 2;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(0, 0, e.r * 1.3 + 10, i * Math.PI / 2 + 0.2, i * Math.PI / 2 + 1.2); c.stroke(); }
      c.restore();
    }
    for (const e of p.sentList) if (!e.dead && e.sentN) {
      for (let i = 0; i < e.sentN; i++) { const a = G.t * 3 + i / e.sentN * 6.283; c.fillStyle = '#a8c8ff'; c.beginPath(); c.arc(e.x + Math.cos(a) * (e.r + 8), e.y - 14 + Math.sin(a) * 5, 3, 0, 7); c.fill(); }
    }
    if (p.eagle) hDrawEagle(c, p.eagle, !!p.evo.sentinel);
    // 거북의 상: 몸을 감싼 녹색 등껍질 막
    if (p.turtleT > 0) {
      const r = 32 + Math.sin(G.t * 4) * 1.5;
      c.fillStyle = 'rgba(90,200,140,0.18)'; c.strokeStyle = 'rgba(150,255,190,0.8)'; c.lineWidth = 2;
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + G.t * 0.4; c.lineTo(p.x + Math.cos(a) * r, p.y - 16 + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
    }
    if (p.absorb > 0) { c.strokeStyle = 'rgba(200,230,140,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y - 12, 34, 0, 7); c.stroke(); }
    // 정밀 사격 중첩: 머리 위 금빛 화살촉
    for (let i = 0; i < p.precise; i++) {
      const x = p.x - (p.precise - 1) * 7 + i * 14, y = p.y - 72 + Math.sin(G.t * 4 + i) * 2;
      c.fillStyle = '#ffe08a'; c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 5, y + 3); c.lineTo(x - 5, y + 3); c.closePath(); c.fill();
    }
  },

  // ---------- 레벨업 · 봇 ----------
  upgWeight(o, p) {
    if (o.type === 'new') return G.SKILLS[o.id].kind === 'auto' ? 1.15 : H_DEFENSIVE.includes(o.id) && p.level < 8 ? 0.35 : 0.95;
    if (o.type === 'passive') return o.id === 'preciseshotsP' || o.id === 'lockandload' ? 1.2 : 0.75;
    if (o.type === 'node') {
      let w = 1.2;
      if (o.id === 'steadyshot' && p.level < 8) w = 2.2;
      if (o.id === 'steadyshot' && (o.nodeId === 'count' || o.nodeId === 'cast') && p.level < 12) w += 0.8;
      return w;
    }
  },
  botUse(id, p) {
    if (id === 'turtle' && (p.hp > p.maxHp * 0.25 || p.turtleT > 0)) return false;
    if (id === 'exhilaration' && p.hp > p.maxHp * 0.5) return false;
    if (id === 'feigndeath' && p.hp > p.maxHp * 0.4) return false;
    if (id === 'disengage') return !!G.nearestEnemy(p.x, p.y, 90);
    return true;
  },
  botScore(x, p) {
    if (x.type === 'evolution') return 100;
    if (x.type === 'legendary') return 80;
    if (x.type === 'node' && x.id === 'steadyshot' && (x.nodeId === 'count' || x.nodeId === 'cast')) return 42;
    if (x.type === 'new' && G.SKILLS[x.id].kind === 'auto') return p.order.length < 6 ? 55 : 20;
    if (x.type === 'node' && x.nodeId === 'dmg') return 45;
    if (x.type === 'passive' && ['arcaneint', 'haste', 'crit', 'projectile', 'preciseshotsP', 'lockandload', 'huntersmark'].includes(x.id)) return 40 + x.rarity * 5;
    if (x.type === 'new' && ['volley', 'trueshot', 'wailingarrow', 'freezingtrap', 'exhilaration'].includes(x.id)) return 35;
    if (x.type === 'node') return 30;
    if (x.type === 'passive') return 25 + x.rarity * 5;
    return 10;
  },
};
