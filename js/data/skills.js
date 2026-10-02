'use strict';
// 냉기 마법사 주문/특성 데이터
// kind: auto(자동 시전) | active(단축키) | passive(능력치/특성) | legendary(전설) | evolution(진화)
const D = v => `<b class="v">${Math.round(v * (G.player ? G.player.stats.dmg : 1))}</b>`;
const N = (v, d = 1) => `<b class="v">${+v.toFixed(d)}</b>`;
const P = v => `<b class="v">${Math.round(v * 100)}%</b>`;
const node = (id, name, max, desc, apply, extra = {}) => ({ id, name, max, desc, apply, ...extra });
const dmgNode = (pct = 0.3, max = 5, name = '주문 강화') => node('dmg', name, max, `피해 +${pct * 100}%`, s => (s.dmg *= 1 + pct));
const cdNode = (pct = 0.12, max = 3) => node('cd', '빠른 회복', max, `재사용 대기시간 -${pct * 100}%`, s => (s.cd *= 1 - pct));

G.SKILLS = {
  // ================= 자동 시전 =================
  frostbolt: {
    name: '얼음화살', icon: 'frostbolt', kind: 'auto', school: 'frost', color: '#3fa7ff',
    base: { dmg: 30, cast: 0.8, count: 1, pierce: 0, speed: 560, slow: 0.3, explode: 0, freezeCh: 0, proj: true },
    tip: s => `가장 가까운 적에게 얼음화살을 날려 ${D(s.dmg)}의 냉기 피해를 입히고 ${P(s.slow)} 감속시킵니다.` +
      (s.count > 1 ? `<br>투사체 ${N(s.count, 0)}개` : '') + (s.pierce ? ` · 관통 ${N(s.pierce, 0)}` : '') +
      (s.explode ? `<br>적중 시 주변에 ${P(0.4)} 피해 폭발` : '') + (s.freezeCh ? `<br>${P(s.freezeCh)} 확률로 빙결` : ''),
    castInfo: s => `시전 시간 ${s.cast.toFixed(2)}초`,
    nodes: [
      node('count', '다중 시전', 4, '얼음화살 투사체 <b class="v">+1</b>', s => s.count++),
      node('cast', '빠른 시전', 4, '시전 시간 <b class="v">-12%</b>', s => (s.cast *= 0.88)),
      node('pierce', '꿰뚫는 냉기', 3, '관통 <b class="v">+1</b>', s => s.pierce++, { icon: 'icelance' }),
      node('dmg', '뼛속까지 시림', 5, '피해 <b class="v">+30%</b>', s => (s.dmg *= 1.3), { icon: 'bonechilling' }),
      node('explode', '냉기 파열', 3, '적중 시 폭발하여 주변에 피해 (등급마다 범위 증가)', s => s.explode++, { icon: 'chillstreak' }),
      node('freeze', '동상', 3, '적중 시 <b class="v">6%</b> 확률로 대상 빙결', s => (s.freezeCh += 0.06), { icon: 'frostbite' }),
    ],
  },
  icicles: {
    name: '고드름', icon: 'icicles', kind: 'auto', school: 'frost', color: '#7fd4ff',
    base: { dmg: 18, max: 5, pierce: 0 },
    tip: s => `특화: 얼음화살이 적중하면 고드름이 생성됩니다 (최대 ${N(s.max, 0)}개). 최대치를 넘으면 가장 오래된 고드름이 발사되어 ${D(s.dmg)}의 피해를 입힙니다.<br>얼음창이 모든 고드름을 발사시킵니다.`,
    castInfo: () => '지속 효과',
    nodes: [
      dmgNode(0.3, 5, '날카로운 고드름'),
      node('max', '고드름 저장', 3, '최대 고드름 <b class="v">+1</b>', s => s.max++),
      node('pierce', '관통 고드름', 2, '고드름 관통 <b class="v">+1</b>', s => s.pierce++),
    ],
  },
  icelance: {
    name: '얼음창', icon: 'icelance', kind: 'auto', school: 'frost', color: '#9fdcff',
    base: { dmg: 22, cd: 2.2, count: 1, speed: 800, mult: 3, split: 0, proj: true },
    tip: s => `얼어붙은 적을 우선 노려 ${D(s.dmg)}의 피해를 입힙니다. 얼어붙은 대상(빙결/겨울의 한기)에게는 피해가 <b class="v">${s.mult}배</b>입니다.` +
      (s.count > 1 ? `<br>동시에 ${N(s.count, 0)}개 발사` : '') + (s.split ? `<br>얼음 분열: 주변 ${N(s.split, 0)}명에게 튕김` : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      node('count', '얼음창 연사', 3, '얼음창 <b class="v">+1</b>개 (다른 대상)', s => s.count++),
      dmgNode(0.2, 5, '날카로운 얼음'),
      cdNode(0.12, 4),
      node('split', '얼음 분열', 2, '얼음창이 주변 적 1명에게 <b class="v">65%</b> 피해로 튕깁니다', s => s.split++, { icon: 'splittingice' }),
      node('mult', '산산조각의 창', 2, '얼어붙은 대상 피해 배율 <b class="v">+0.5</b>', s => (s.mult += 0.5), { icon: 'shatter' }),
    ],
  },
  flurry: {
    name: '진눈깨비', icon: 'flurry', kind: 'auto', school: 'frost', color: '#6fbfff',
    base: { dmg: 13, cd: 7, bolts: 3, targets: 1, proj: true },
    tip: s => `얼음 조각 ${N(s.bolts, 0)}개를 연달아 날려 각각 ${D(s.dmg)}의 피해를 입히고 <b class="v">겨울의 한기</b>를 겁니다.<br><span class="tt-sub">겨울의 한기: 2회 동안 얼어붙은 것으로 간주</span>` +
      (s.targets > 1 ? `<br>대상 ${N(s.targets, 0)}명` : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      node('bolts', '눈보라 조각', 3, '조각 <b class="v">+1</b>', s => s.bolts++),
      node('targets', '흩날리는 진눈깨비', 2, '대상 <b class="v">+1</b>', s => s.targets++),
      dmgNode(0.2, 5), cdNode(0.12, 3),
    ],
  },
  blizzard: {
    name: '눈보라', icon: 'blizzard', kind: 'auto', school: 'frost', color: '#5fb4ff',
    base: { dmg: 14, cd: 10, dur: 8, radius: 120, slow: 0.5, count: 1 },
    tip: s => `적이 가장 많은 곳에 ${N(s.dur, 0)}초 동안 눈보라를 일으켜 매초 ${D(s.dmg)}의 피해를 입히고 ${P(s.slow)} 감속시킵니다.<br>적중할 때마다 얼어붙은 구슬의 재사용 대기시간이 줄어듭니다.` +
      (s.count > 1 ? `<br>동시에 ${N(s.count, 0)}개` : ''),
    castInfo: s => `자동 · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      dmgNode(0.2, 5), node('radius', '거센 바람', 3, '범위 <b class="v">+15%</b>', s => (s.radius *= 1.15), { icon: 'area' }),
      node('dur', '끝없는 겨울', 2, '지속시간 <b class="v">+2초</b>', s => (s.dur += 2), { icon: 'duration' }),
      node('count', '얼음비', 2, '눈보라 <b class="v">+1</b>개', s => s.count++, { icon: 'freezingrain' }), cdNode(0.12, 3),
    ],
  },
  cometstorm: {
    name: '혜성 폭풍', icon: 'cometstorm', kind: 'auto', school: 'frost', color: '#8fb8ff',
    base: { dmg: 32, cd: 14, comets: 7, radius: 55 },
    tip: s => `적 무리에 얼음 혜성 ${N(s.comets, 0)}개를 떨어뜨려 각각 주변에 ${D(s.dmg)}의 피해를 입힙니다.`,
    castInfo: s => `자동 · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [node('comets', '유성우', 3, '혜성 <b class="v">+2</b>', s => (s.comets += 2)), dmgNode(0.2, 5), cdNode(0.12, 3),
      node('radius', '거대 혜성', 2, '폭발 범위 <b class="v">+20%</b>', s => (s.radius *= 1.2), { icon: 'area' })],
  },
  icenova: {
    name: '얼음 회오리', icon: 'icenova', kind: 'auto', school: 'frost', color: '#a0e0ff',
    base: { dmg: 55, cd: 11, radius: 100, freeze: 2 },
    tip: s => `적 하나를 중심으로 얼음 회오리를 일으켜 ${D(s.dmg)}의 피해를 입히고 ${N(s.freeze, 1)}초 동안 빙결시킵니다.`,
    castInfo: s => `자동 · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.25, 5), cdNode(0.12, 3), node('radius', '넓은 회오리', 2, '범위 <b class="v">+20%</b>', s => (s.radius *= 1.2), { icon: 'area' }),
      node('freeze', '깊은 동결', 2, '빙결 <b class="v">+0.75초</b>', s => (s.freeze += 0.75), { icon: 'freeze' })],
  },
  waterelemental: {
    name: '물의 정령', icon: 'waterelemental', kind: 'auto', school: 'frost', color: '#47c6e6',
    base: { dmg: 20, atk: 1.4, count: 1, freezeCd: 14, freezeR: 90, freezeDur: 3 },
    tip: s => `물의 정령을 소환합니다. 정령은 물화살로 ${D(s.dmg)}의 피해를 입히고, ${N(s.freezeCd, 0)}초마다 <b class="v">얼리기</b>로 적 무리를 빙결시킵니다.` +
      (s.count > 1 ? `<br>정령 ${N(s.count, 0)}마리` : ''),
    castInfo: s => `소환수 · 공격 간격 ${s.atk.toFixed(2)}초`,
    nodes: [dmgNode(0.25, 5, '응축된 물'), node('atk', '흐르는 물', 3, '공격 속도 <b class="v">+15%</b>', s => (s.atk *= 0.85)),
      node('count', '쌍둥이 정령', 1, '물의 정령 <b class="v">+1</b>', s => s.count++),
      node('freeze', '얼리기 강화', 2, '얼리기 범위 <b class="v">+20%</b>, 재사용 <b class="v">-2초</b>', s => { s.freezeR *= 1.2; s.freezeCd -= 2; }, { icon: 'freeze' })],
  },

  // ================= 단축키 (핵심 주문) =================
  frozenorb: {
    name: '얼어붙은 구슬', icon: 'frozenorb', kind: 'active', key: 'Q', school: 'frost', color: '#4fc0ff',
    base: { dmg: 16, cd: 20, dur: 7, radius: 110, speed: 220, count: 1 },
    tip: s => `마우스 방향으로 구슬을 발사합니다. 구슬은 ${N(s.dur, 1)}초 동안 주변 적에게 0.5초마다 ${D(s.dmg)}의 피해를 입히고 감속시키며, 서리의 손가락을 발동시킬 수 있습니다.` + (s.count > 1 ? `<br>구슬 ${N(s.count, 0)}개` : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.2, 5), cdNode(0.12, 3), node('radius', '거대한 구슬', 2, '범위 <b class="v">+20%</b>', s => (s.radius *= 1.2), { icon: 'area' }),
      node('dur', '영구 동토', 2, '지속시간 <b class="v">+1.5초</b>', s => (s.dur += 1.5), { icon: 'permafrost' }),
      node('count', '이중 구슬', 1, '구슬 <b class="v">+1</b>개', s => s.count++)],
  },
  coneofcold: {
    name: '냉기 돌풍', icon: 'coneofcold', kind: 'active', key: 'E', school: 'frost', color: '#88d0ff',
    base: { dmg: 48, cd: 9, range: 230, angle: 1.25, slow: 0.5, freeze: 0 },
    tip: s => `마우스 방향 부채꼴의 적에게 ${D(s.dmg)}의 피해를 입히고 ${P(s.slow)} 감속시킵니다.` + (s.freeze ? `<br>대상을 ${N(s.freeze, 1)}초 동안 빙결` : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.25, 5), cdNode(0.12, 3), node('range', '넓은 돌풍', 2, '사거리 <b class="v">+15%</b>, 각도 <b class="v">+10%</b>', s => { s.range *= 1.15; s.angle *= 1.1; }, { icon: 'area' }),
      node('freeze', '얼어붙은 냉기', 1, '냉기 돌풍이 <b class="v">2초</b> 동안 빙결', s => (s.freeze = 2), { icon: 'freeze' })],
  },
  glacialspike: {
    name: '빙하 가시', icon: 'glacialspike', kind: 'active', key: 'R', school: 'frost', color: '#c0ecff', req: p => !!p.skills.icicles,
    base: { dmg: 90, splash: 70, freeze: 4, pierce: 0 },
    tip: s => `고드름이 가득 차면 사용 가능. 모든 고드름을 합쳐 거대한 가시를 날려 ${D(s.dmg)} + 고드름 피해를 입히고 ${N(s.freeze, 0)}초 동안 빙결시킵니다. 주변 적도 피해를 입고 얼어붙습니다.<br><span class="tt-sub">빙하 가시를 배우면 고드름이 자동 발사되지 않습니다.</span>`,
    castInfo: () => '즉시 시전 · 고드름 최대치 필요',
    nodes: [dmgNode(0.25, 5), node('splash', '파편 폭발', 2, '폭발 범위 <b class="v">+30%</b>', s => (s.splash *= 1.3), { icon: 'area' }),
      node('pierce', '관통 가시', 2, '관통 <b class="v">+2</b>', s => (s.pierce += 2))],
  },
  frostnova: {
    name: '서리 회오리', icon: 'frostnova', kind: 'active', key: 'F', school: 'frost', color: '#bfe8ff',
    base: { dmg: 12, cd: 18, radius: 170, freeze: 4, charges: 1 },
    tip: s => `주변 ${N(s.radius, 0)} 거리의 모든 적에게 ${D(s.dmg)}의 피해를 입히고 ${N(s.freeze, 0)}초 동안 빙결시킵니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초` + (s.charges > 1 ? ` · 충전 ${s.charges}회` : ''),
    nodes: [node('radius', '넓은 회오리', 2, '범위 <b class="v">+20%</b>', s => (s.radius *= 1.2), { icon: 'area' }), cdNode(0.12, 3),
      node('freeze', '혹한', 2, '빙결 <b class="v">+1초</b>', s => (s.freeze += 1), { icon: 'freeze' }),
      node('charges', '얼음 감옥', 1, '충전 <b class="v">+1</b>', s => s.charges++)],
  },
  rayoffrost: {
    name: '서리 광선', icon: 'rayoffrost', kind: 'active', key: 'T', school: 'frost', color: '#9fe6ff',
    base: { dmg: 12, cd: 40, dur: 3, len: 480, width: 22, ramp: 0.12 },
    tip: s => `${N(s.dur, 0)}초 동안 마우스 방향으로 서리 광선을 집중시켜 경로의 모든 적에게 0.25초마다 ${D(s.dmg)}의 피해를 입힙니다. 피해는 매 틱마다 ${P(s.ramp)}씩 증가합니다.<br><span class="tt-sub">정신 집중 중에는 얼음화살을 시전하지 못하고 이동 속도가 감소합니다.</span>`,
    castInfo: s => `정신 집중 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.25, 5), node('dur', '지속 광선', 2, '지속시간 <b class="v">+1초</b>', s => (s.dur += 1), { icon: 'duration' }), cdNode(0.12, 3),
      node('width', '굵은 광선', 2, '굵기 <b class="v">+30%</b>, 길이 <b class="v">+10%</b>', s => { s.width *= 1.3; s.len *= 1.1; }, { icon: 'area' })],
  },
  blink: {
    name: '점멸', icon: 'blink', kind: 'active', key: 'SPACE', school: 'arcane', color: '#c45bff',
    base: { cd: 12, dist: 220, charges: 1, trail: 0 },
    tip: s => `이동 방향(정지 시 마우스 방향)으로 ${N(s.dist, 0)} 거리를 순간이동합니다.` + (s.trail ? '<br>출발 지점의 적을 빙결시킵니다.' : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(1)}초` + (s.charges > 1 ? ` · 충전 ${s.charges}회` : ''),
    nodes: [cdNode(0.15, 3), node('charges', '일렁임', 1, '충전 <b class="v">+1</b>', s => s.charges++),
      node('trail', '얼음 흔적', 1, '출발 지점에 서리 회오리 발생', s => (s.trail = 1), { icon: 'frostnova' })],
  },
  icyveins: {
    name: '얼음 핏줄', icon: 'icyveins', kind: 'active', key: '1', school: 'frost', color: '#5fb4ff',
    base: { cd: 75, dur: 15, haste: 0.3, thermal: 0, extraProj: 0 },
    tip: s => `${N(s.dur, 0)}초 동안 가속이 ${P(s.haste)} 증가합니다.` + (s.thermal ? '<br>열 공허: 얼음창 시전 시 지속시간 0.5초 증가' : '') + (s.extraProj ? '<br>지속 중 얼음화살 투사체 +1' : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [cdNode(0.12, 3), node('dur', '오래가는 냉기', 2, '지속시간 <b class="v">+3초</b>', s => (s.dur += 3), { icon: 'duration' }),
      node('haste', '서리 폭풍', 2, '가속 효과 <b class="v">+10%</b>', s => (s.haste += 0.1), { icon: 'haste' }),
      node('thermal', '열 공허', 1, '지속 중 얼음창 시전 시 지속시간 <b class="v">+0.5초</b>', s => (s.thermal = 1), { icon: 'thermalvoid' }),
      node('extraProj', '한파의 쇄도', 1, '지속 중 얼음화살 투사체 <b class="v">+1</b>', s => (s.extraProj = 1), { icon: 'frostbolt' })],
  },
  icebarrier: {
    name: '얼음 보호막', icon: 'icebarrier', kind: 'active', key: '2', school: 'frost', color: '#bfe8ff',
    base: { cd: 25, pct: 0.35, reflect: 0 },
    tip: s => `최대 생명력의 ${P(s.pct)}만큼 피해를 흡수하는 보호막을 두릅니다. 보호막이 있는 동안 공격한 근접 적은 감속됩니다.` + (s.reflect ? '<br>공격자에게 냉기 피해를 반사합니다.' : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('pct', '두꺼운 얼음', 3, '흡수량 <b class="v">+10%</b>', s => (s.pct += 0.1), { icon: 'frostarmor' }), cdNode(0.12, 3),
      node('reflect', '냉기 갑옷', 1, '공격자에게 <b class="v">30</b> 냉기 피해 반사', s => (s.reflect = 1), { icon: 'chillstreak' })],
  },
  iceblock: {
    name: '얼음 방패', icon: 'iceblock', kind: 'active', key: '3', school: 'frost', color: '#bfe8ff',
    base: { cd: 120, dur: 6, heal: 0, nova: 0 },
    tip: s => `${N(s.dur, 0)}초 동안 얼음에 갇혀 모든 피해에 면역이 됩니다. 이동과 시전이 불가능합니다. 다시 누르면 취소됩니다.` + (s.heal ? `<br>지속 중 초당 ${P(s.heal)} 회복` : '') + (s.nova ? '<br>종료 시 서리 회오리' : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('cd', '빙하의 결계', 2, '재사용 대기시간 <b class="v">-20%</b>', s => (s.cd *= 0.8)),
      node('heal', '빙하의 회복', 2, '지속 중 초당 생명력 <b class="v">6%</b> 회복', s => (s.heal += 0.06), { icon: 'regen' }),
      node('nova', '산산조각 나는 얼음', 1, '종료 시 주변 적 빙결', s => (s.nova = 1), { icon: 'frostnova' })],
  },
  coldsnap: {
    name: '매서운 한파', icon: 'coldsnap', kind: 'active', key: '4', school: 'frost', color: '#bfe8ff',
    base: { cd: 100, heal: 0.25 },
    tip: s => `냉기 돌풍, 서리 회오리, 얼음 보호막, 얼음 방패의 재사용 대기시간을 초기화하고 생명력을 ${P(s.heal)} 회복합니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [cdNode(0.15, 2), node('heal', '되살아나는 냉기', 2, '회복량 <b class="v">+15%</b>', s => (s.heal += 0.15), { icon: 'regen' })],
  },
  mirrorimage: {
    name: '환영 복제', icon: 'mirrorimage', kind: 'active', key: '5', school: 'arcane', color: '#b07bff',
    base: { cd: 55, dur: 20, count: 3, dmg: 9 },
    tip: s => `${N(s.dur, 0)}초 동안 환영 ${N(s.count, 0)}개를 만들어 적의 주의를 끌고, 각각 얼음화살로 ${D(s.dmg)}의 피해를 입힙니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('count', '분신술', 2, '환영 <b class="v">+1</b>', s => s.count++), dmgNode(0.3, 3), cdNode(0.15, 2)],
  },
  shiftingpower: {
    name: '힘의 전환', icon: 'shiftingpower', kind: 'active', key: '6', school: 'nature', color: '#58e0a0',
    base: { cd: 55, dur: 4, dmg: 18, reduce: 2.5, radius: 200 },
    tip: s => `${N(s.dur, 0)}초 동안 정신을 집중해 매초 주변 적에게 ${D(s.dmg)}의 피해를 입히고 다른 모든 주문의 재사용 대기시간을 ${N(s.reduce, 1)}초씩 감소시킵니다.`,
    castInfo: s => `정신 집중 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('reduce', '시간의 흐름', 2, '감소량 <b class="v">+1초</b>', s => (s.reduce += 1), { icon: 'timewarp' }), dmgNode(0.3, 3), cdNode(0.15, 2)],
  },

  // ================= 특성/능력치 =================
  arcaneint: { name: '신비한 지능', icon: 'arcaneint', kind: 'passive', max: 5, val: 8, unit: '%', desc: v => `주문력 +${v}%`, apply: (st, v) => (st.dmg += v / 100) },
  haste: { name: '가속', icon: 'haste', kind: 'passive', max: 5, val: 6, unit: '%', desc: v => `시전 속도 및 재사용 속도 +${v}%`, apply: (st, v) => (st.haste += v / 100) },
  crit: { name: '치명타', icon: 'crit', kind: 'passive', max: 5, val: 4, unit: '%', desc: v => `치명타 확률 +${v}%`, apply: (st, v) => (st.crit += v / 100) },
  stamina: { name: '체력', icon: 'stamina', kind: 'passive', max: 5, val: 15, unit: '%', desc: v => `최대 생명력 +${v}%`, apply: (st, v) => (st.hpMul += v / 100) },
  speed: { name: '질주', icon: 'speed', kind: 'passive', max: 4, val: 7, unit: '%', desc: v => `이동 속도 +${v}%`, apply: (st, v) => (st.speedMul += v / 100) },
  pickup: { name: '마력 흡수', icon: 'pickup', kind: 'passive', max: 4, val: 25, unit: '%', desc: v => `획득 반경 +${v}%`, apply: (st, v) => (st.pickupMul += v / 100) },
  area: { name: '북극의 바람', icon: 'area', kind: 'passive', max: 5, val: 10, unit: '%', desc: v => `주문 범위 +${v}%`, apply: (st, v) => (st.area += v / 100) },
  duration: { name: '영원한 겨울', icon: 'duration', kind: 'passive', max: 5, val: 12, unit: '%', desc: v => `주문 지속시간 +${v}%`, apply: (st, v) => (st.dur += v / 100) },
  regen: { name: '창조된 물', icon: 'regen', kind: 'passive', max: 5, val: 0.8, unit: '', desc: v => `초당 생명력 회복 +${v.toFixed(1)}`, apply: (st, v) => (st.regen += v) },
  frostarmor: { name: '서리 갑옷', icon: 'frostarmor', kind: 'passive', max: 5, val: 6, unit: '%', desc: v => `받는 피해 -${v}%`, apply: (st, v) => (st.armor += v / 100) },
  luck: { name: '행운', icon: 'luck', kind: 'passive', max: 3, val: 15, unit: '%', desc: v => `높은 등급 선택지 확률 +${v}%`, apply: (st, v) => (st.luck += v / 100) },
  icefloes: { name: '얼음발', icon: 'icefloes', kind: 'passive', max: 2, val: 50, unit: '%', fixed: true, desc: v => `이동 중 시전 속도 감소 효과 -${v}%`, apply: (st, v) => (st.movePenalty *= 1 - v / 100) },
  projectile: { name: '주문 분열', icon: 'projectile', kind: 'passive', max: 2, val: 1, unit: '', fixed: true, rarity: 3, desc: () => `모든 투사체 주문의 투사체 +1`, apply: (st, v) => (st.proj += v) },
  fingersoffrost: {
    name: '서리의 손가락', icon: 'fingersoffrost', kind: 'passive', max: 3, val: 12, unit: '%', fixed: true, req: p => !!p.skills.icelance,
    desc: v => `얼음화살/구슬/광선 적중 시 ${v}% 확률로 발동: 다음 얼음창이 즉시 시전되며 얼어붙은 대상처럼 취급`, apply: (st, v) => (st.fof += v / 100),
  },
  brainfreeze: {
    name: '두뇌 빙결', icon: 'brainfreeze', kind: 'passive', max: 3, val: 12, unit: '%', fixed: true, req: p => !!p.skills.flurry,
    desc: v => `얼음화살 시전 시 ${v}% 확률로 발동: 진눈깨비 재사용 초기화 및 피해 +60%`, apply: (st, v) => (st.bf += v / 100),
  },
  shatter: {
    name: '산산조각', icon: 'shatter', kind: 'passive', max: 3, val: 15, unit: '%', fixed: true,
    desc: v => `얼어붙은 대상에 대한 치명타 확률 +${v}%, 치명타 피해 +${v}%`, apply: (st, v) => { st.shatterCrit += v / 100; st.critMul += v / 100; },
  },

  // ================= 전설 =================
  coldfront: { name: '냉기 전선', icon: 'coldfront', kind: 'legendary', req: p => p.skills.frostbolt && p.skills.frozenorb, desc: () => '얼음화살을 25회 시전할 때마다 가장 가까운 적에게 얼어붙은 구슬을 무료로 발사합니다.' },
  freezingwinds: { name: '얼어붙은 바람', icon: 'freezingwinds', kind: 'legendary', req: p => p.skills.frozenorb && p.skills.flurry, desc: () => '얼어붙은 구슬이 있는 동안 2초마다 두뇌 빙결이 발동합니다.' },
  glacialfrag: { name: '빙하 파편', icon: 'glacialfrag', kind: 'legendary', req: p => p.skills.blizzard && p.skills.icelance, desc: () => '눈보라 안의 적에게 얼음창이 적중하면 파편이 폭발하여 주변에 얼음창 피해의 100%를 입힙니다.' },
  coldhearted: { name: '냉혈', icon: 'coldhearted', kind: 'legendary', desc: () => '치명타 피해 +25%. 치명타 시 5% 확률로 대상을 2초 동안 빙결시킵니다.' },
  giantheart: { name: '얼음 거인의 심장', icon: 'giantheart', kind: 'legendary', req: p => !!p.skills.icicles, desc: () => '최대 고드름 +3, 고드름 피해 +60%.' },
  timewarp: { name: '시간 왜곡', icon: 'timewarp', kind: 'legendary', desc: () => '가속 +20%, 이동 속도 +10%.' },

  // ================= 진화 =================
  frostfire: {
    name: '서리불꽃 화살', icon: 'frostfire', kind: 'evolution', target: 'frostbolt',
    req: p => p.skills.frostbolt && p.skillLevel('frostbolt') >= 8 && p.skills.icyveins,
    reqText: '얼음화살 8레벨 + 얼음 핏줄',
    desc: () => '<b>영웅 특성: 서리불꽃</b><br>얼음화살이 서리불꽃 화살로 진화합니다. 피해 +60%, 항상 폭발하며 3초 동안 화염 피해를 입히는 불길을 남깁니다.',
  },
  splinterstorm: {
    name: '파편 폭풍', icon: 'splinterstorm', kind: 'evolution', target: 'icelance',
    req: p => p.skills.icelance && p.skillLevel('icelance') >= 5 && p.passives.fingersoffrost,
    reqText: '얼음창 5레벨 + 서리의 손가락',
    desc: () => '<b>영웅 특성: 주문술사</b><br>얼음창 시전 시 추적하는 비전 서리 파편 2개를 생성합니다. 8초마다 파편 폭풍을 일으켜 파편 14개를 발사합니다.',
  },
};
for (const id in G.SKILLS) G.SKILLS[id].id = id;

// 피해 미터용 추가 출처
G.SOURCES = {
  frostbolt: ['얼음화살', 'frostbolt', '#3fa7ff'], frostfire: ['서리불꽃 화살', 'frostfire', '#d977ff'], burn: ['서리불꽃 (지속)', 'frostfire', '#ff8a3c'],
  icicles: ['고드름', 'icicles', '#7fd4ff'], icelance: ['얼음창', 'icelance', '#9fdcff'], flurry: ['진눈깨비', 'flurry', '#6fbfff'],
  blizzard: ['눈보라', 'blizzard', '#5fb4ff'], cometstorm: ['혜성 폭풍', 'cometstorm', '#8fb8ff'], icenova: ['얼음 회오리', 'icenova', '#a0e0ff'],
  waterelemental: ['물의 정령', 'waterelemental', '#47c6e6'], frozenorb: ['얼어붙은 구슬', 'frozenorb', '#4fc0ff'], coneofcold: ['냉기 돌풍', 'coneofcold', '#88d0ff'],
  glacialspike: ['빙하 가시', 'glacialspike', '#c0ecff'], frostnova: ['서리 회오리', 'frostnova', '#bfe8ff'], rayoffrost: ['서리 광선', 'rayoffrost', '#9fe6ff'],
  mirrorimage: ['환영 복제', 'mirrorimage', '#b07bff'], shiftingpower: ['힘의 전환', 'shiftingpower', '#58e0a0'], splinter: ['비전 서리 파편', 'splinter', '#c45bff'],
  glacialfrag: ['빙하 파편', 'glacialfrag', '#7fd4ff'], reflect: ['냉기 갑옷', 'icebarrier', '#bfe8ff'], blink: ['얼음 흔적', 'blink', '#c45bff'],
  iceblock: ['산산조각 나는 얼음', 'iceblock', '#bfe8ff'],
};

// 지금까지의 주문은 냉기 마법사 것. 일반 능력치는 모든 직업 공용('any'). 다른 직업 파일은 cls를 직접 지정한다.
const COMMON_PASSIVES = ['arcaneint', 'haste', 'crit', 'stamina', 'speed', 'pickup', 'area', 'duration', 'regen', 'luck', 'projectile'];
for (const id in G.SKILLS) G.SKILLS[id].cls ||= COMMON_PASSIVES.includes(id) ? 'any' : 'mage';

G.ACTION_KEYS = ['Q', 'E', 'R', 'F', 'T', 'SPACE', '1', '2', '3', '4', '5', '6'];
G.KEY_LABEL = { SPACE: 'Spc' };
G.LIMITS = { auto: 6, active: 6, passive: 8 };
