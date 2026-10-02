'use strict';
// ================= 직업: 고통 흑마법사 =================
// 지속 피해(부패 · 고통 · 생명력 착취 · 불안정한 고통)를 퍼뜨리고, 영혼의 조각을 모아 악의적인 환희로 터뜨린다.
// 주문 데이터 · 구현 · 직업 훅 · 그림을 이 파일에 모은다. (공통 도우미 D/N/P/node/dmgNode/cdNode는 data/skills.js)

// ---------- 지속 피해 시스템 (직업 공용) ----------
G.Dots = {
  // o: { dmg(틱당), dur, interval, src, stack, maxStack, ramp(틱마다 중첩 +1), onTick, color, icon(적 머리 위 표시), heal(피해의 n배 회복) }
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
        if (d.heal && dealt) G.P.healSilent(dealt * d.heal / st.dmg);
        if (d.onTick) d.onTick(e, d);
        if (e.dead) return;
        if (Math.random() < 0.25) G.fx.part({ x: e.x + U.rand(-10, 10), y: e.y - U.rand(0, 20), vy: -40, life: 0.5, size: U.rand(5, 9), rgb: d.color || '150,60,220' });
      }
      if (d.t >= d.dur) delete e.dots[id];
    }
    if (!Object.keys(e.dots).length) e.dots = null;
  },

  // ---------- 표시: 누가 어떤 지속 피해에 걸렸는지 ----------
  // 발밑: 걸린 지속 피해 색으로 나눈 고리 (멀리서도 구분)
  drawRing(c, e) {
    const ids = Object.keys(e.dots), n = ids.length, y = e.y + e.r * 0.8, rx = e.r * 1.25 + 3, ry = e.r * 0.5 + 2;
    const seg = Math.PI * 2 / n, gap = n > 1 ? 0.25 : 0, rot = G.t * 1.5;
    c.lineWidth = 3;
    ids.forEach((id, i) => {
      c.strokeStyle = `rgba(${e.dots[id].color},0.9)`;
      c.beginPath(); c.ellipse(e.x, y, rx, ry, 0, rot + i * seg, rot + (i + 1) * seg - gap); c.stroke();
    });
  },
  // 머리 위: 지속 피해 아이콘 + 남은 시간 막대 + 중첩 수 (유령 출몰 표시 포함)
  drawIcons(c, e, top) {
    const ids = Object.keys(e.dots || {}); if (e.haunted > G.t) ids.push('haunt');
    if (!ids.length) return;
    const sz = 14, gap = 2;
    let x = e.x - (ids.length * (sz + gap) - gap) / 2;
    c.font = 'bold 10px sans-serif'; c.textAlign = 'right'; c.textBaseline = 'alphabetic';
    for (const id of ids) {
      const d = e.dots && e.dots[id], col = d ? d.color : '110,130,255', img = G.IMG[d ? d.icon : 'haunt'];
      c.fillStyle = `rgb(${col})`; c.fillRect(x - 1, top - 1, sz + 2, sz + 2);
      if (img && img.complete && img.naturalWidth) c.drawImage(img, x, top, sz, sz);
      const f = d ? Math.max(0, 1 - d.t / d.dur) : Math.max(0, (e.haunted - G.t) / 10);
      c.fillStyle = '#000'; c.fillRect(x - 1, top + sz + 1, sz + 2, 3);
      c.fillStyle = `rgb(${col})`; c.fillRect(x, top + sz + 1.5, sz * f, 2);
      if (d && d.stack > 1) { c.fillStyle = '#000'; c.fillText(d.stack, x + sz + 1, top + sz); c.fillStyle = '#fff'; c.fillText(d.stack, x + sz, top + sz - 1); }
      x += sz + gap;
    }
    c.textAlign = 'left';
  },
};

// ---------- 주문 데이터 ----------
// 고통 특성 주문만 쓴다 (파괴 · 악마 특성 주문인 불의 비 · 지옥불정령 · 어둠의 격노 · 임프 · 공허방랑자 · 혼돈의 화살은 제외)
Object.assign(G.SKILLS, {
  // ===== 자동 시전 =====
  shadowbolt: {
    cls: 'warlock', name: '어둠의 화살', icon: 'shadowbolt', kind: 'auto', school: 'shadow', color: '#a050ff',
    base: { dmg: 30, cast: 0.9, count: 1, speed: 520, embrace: 1, extend: 0, perDot: 0.1, slow: 0.3, proj: true, basic: true },
    tip: s => `가장 가까운 적에게 어둠의 화살을 날려 ${D(s.dmg)}의 암흑 피해를 입히고 탈진의 저주로 ${P(s.slow)} 감속시킵니다.<br>대상에게 걸린 <b class="v">지속 피해 하나당 피해 +${Math.round(s.perDot * 100)}%</b>.` +
      '<br>어둠의 포옹: 적중한 대상이 받는 지속 피해가 늘어납니다 (최대 +20%).' + (s.extend ? `<br>적중 시 대상의 지속 피해 지속시간 +${N(s.extend, 0)}초` : '') +
      (s.count > 1 ? `<br>투사체 ${N(s.count, 0)}개 (추가 투사체는 ${P(G.EXTRA_BOLT)} 피해)` : ''),
    castInfo: s => `시전 시간 ${s.cast.toFixed(2)}초`,
    nodes: [
      node('count', '다중 시전', 2, '어둠의 화살 투사체 <b class="v">+1</b> (60% 피해)', s => s.count++),
      node('cast', '어둠의 집중', 3, '시전 시간 <b class="v">-8%</b>', s => (s.cast *= 0.92)),
      node('dmg', '어둠의 숙련', 5, '피해 <b class="v">+20%</b> (기본 피해 기준)', s => (s.dmg += 6), { icon: 'shadowmastery' }),
      node('embrace', '어둠의 포옹', 3, '어둠의 포옹이 더 빨리 쌓입니다', s => s.embrace++, { icon: 'shadowembrace' }),
      node('extend', '끈질긴 어둠', 2, '적중 시 대상의 지속 피해 지속시간 <b class="v">+1초</b>', s => s.extend++, { icon: 'doom' }),
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
  siphonlife: {
    cls: 'warlock', name: '생명력 착취', icon: 'siphonlife', kind: 'auto', school: 'shadow', color: '#50d070',
    base: { dmg: 9, cd: 2, targets: 3, dur: 15, interval: 1.5, heal: 0.25 },
    tip: s => `생명력 착취에 걸리지 않은 적 ${N(s.targets, 0)}명에게 생명력 착취를 겁니다. ${N(s.dur, 0)}초 동안 ${N(s.interval, 1)}초마다 ${D(s.dmg)}의 암흑 피해를 입히고 피해의 ${P(s.heal)}만큼 생명력을 회복합니다.`,
    castInfo: s => `재사용 ${s.cd.toFixed(1)}초`,
    nodes: [
      node('targets', '번지는 착취', 3, '대상 <b class="v">+2</b>', s => (s.targets += 2), { icon: 'curseofweakness' }),
      dmgNode(0.3, 5, '향상된 생명력 착취'),
      node('heal', '흡혈', 2, '회복 비율 <b class="v">+15%</b>', s => (s.heal += 0.15), { icon: 'soulleech' }),
      node('dur', '오래가는 착취', 2, '지속시간 <b class="v">+5초</b>', s => (s.dur += 5), { icon: 'doom' }),
    ],
  },
  seedofcorruption: {
    cls: 'warlock', name: '부패의 씨앗', icon: 'seedofcorruption', kind: 'auto', school: 'shadow', color: '#7a2ab0',
    base: { dmg: 60, cd: 9, radius: 110, count: 1, delay: 3, corrupt: 0 },
    tip: s => `적이 가장 많은 곳의 적에게 씨앗을 심습니다. ${N(s.delay, 0)}초 뒤(또는 대상이 죽으면) 폭발해 주변에 ${D(s.dmg)}의 피해.` + (s.corrupt ? '<br>폭발한 적에게 부패를 겁니다.' : ''),
    castInfo: s => `재사용 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.3, 5), node('radius', '번지는 타락', 3, '폭발 범위 <b class="v">+20%</b>', s => (s.radius *= 1.2)), node('count', '씨앗 뿌리기', 3, '씨앗 <b class="v">+1</b>', s => s.count++),
      node('corrupt', '타락의 씨앗', 1, '폭발한 적에게 부패를 겁니다', s => (s.corrupt = 1), { icon: 'corruption' }), cdNode(0.15, 2)],
  },
  phantomsingularity: {
    cls: 'warlock', name: '유령 특이점', icon: 'phantomsingularity', kind: 'auto', school: 'shadow', color: '#7050d0',
    base: { dmg: 9, cd: 16, dur: 8, radius: 120, count: 1, pull: 0 },
    tip: s => `적이 가장 많은 곳에 ${N(s.dur, 0)}초 동안 유령 특이점을 만들어 0.5초마다 범위 안의 적에게 ${D(s.dmg)}의 암흑 피해를 입히고, 입힌 피해의 ${P(0.1)}만큼 생명력을 회복합니다.` +
      (s.count > 1 ? `<br>${N(s.count, 0)}곳` : '') + (s.pull ? '<br>범위 안의 적을 중심으로 끌어당깁니다.' : ''),
    castInfo: s => `재사용 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.3, 5), node('radius', '넓은 특이점', 3, '범위 <b class="v">+15%</b>', s => (s.radius *= 1.15), { icon: 'grimreach' }),
      node('dur', '끝없는 공허', 2, '지속시간 <b class="v">+2초</b>', s => (s.dur += 2), { icon: 'doom' }),
      node('count', '쌍둥이 특이점', 1, '특이점 <b class="v">+1</b>곳', s => s.count++),
      node('pull', '중력 붕괴', 1, '범위 안의 적을 중심으로 끌어당깁니다', s => (s.pull = 1)), cdNode(0.12, 3)],
  },
  drainlife: {
    cls: 'warlock', name: '생명력 흡수', icon: 'drainlife', kind: 'auto', school: 'shadow', color: '#40e070',
    base: { dmg: 12, cd: 6, dur: 3, heal: 0.8, beams: 1 },
    tip: s => `가장 가까운 적과 연결해 ${N(s.dur, 0)}초 동안 0.5초마다 ${D(s.dmg)}의 피해를 입히고 피해의 ${P(s.heal)}만큼 생명력을 회복합니다. 이동을 방해하지 않습니다.`,
    castInfo: s => `재사용 ${s.cd.toFixed(1)}초`,
    nodes: [dmgNode(0.3, 5), node('heal', '흡혈', 3, '회복 비율 <b class="v">+20%</b>', s => (s.heal += 0.2), { icon: 'soulleech' }), node('beams', '다중 흡수', 3, '연결 대상 <b class="v">+1</b>', s => s.beams++), cdNode(0.15, 2)],
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
    base: { dmg: 36, cd: 7, targets: 3, dur: 8, interval: 1, burst: 0 },
    tip: s => `조준 방향에서 가장 가까운 적 ${N(s.targets, 0)}명에게 불안정한 고통을 겁니다. ${N(s.dur, 0)}초 동안 매초 ${D(s.dmg)}의 피해.` + (s.burst ? '<br>대상이 죽으면 주변에 폭발' : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [node('targets', '번지는 고통', 4, '대상 <b class="v">+2</b>', s => (s.targets += 2)), dmgNode(0.3, 5), node('burst', '폭발하는 고통', 1, '대상이 죽으면 주변에 피해', s => (s.burst = 1), { icon: 'hellfire' }), cdNode(0.15, 2)],
  },
  viletaint: {
    cls: 'warlock', name: '사악한 오염', icon: 'viletaint', kind: 'active', key: 'E', school: 'shadow', color: '#9a50e0',
    base: { dmg: 70, cd: 12, radius: 140, ua: 0 },
    tip: s => `마우스 위치(사거리 안)에 오염을 퍼뜨려 범위 안의 적에게 ${D(s.dmg)}의 피해를 입히고 <b class="v">고통</b>과 <b class="v">부패</b>를 겁니다. (배운 주문은 그 수치, 배우지 않았으면 기본 수치)` + (s.ua ? '<br>불안정한 고통도 겁니다.' : ''),
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 5), node('radius', '번지는 오염', 3, '범위 <b class="v">+15%</b>', s => (s.radius *= 1.15), { icon: 'grimreach' }), cdNode(0.15, 2),
      node('ua', '불안정한 오염', 1, '불안정한 고통도 겁니다', s => (s.ua = 1), { icon: 'unstableaffliction' })],
  },
  maleficrapture: {
    cls: 'warlock', name: '악의적인 환희', icon: 'maleficrapture', kind: 'active', key: 'R', school: 'shadow', color: '#e060ff', req: p => !!(p.skills.agony || p.skills.corruption || p.skills.siphonlife),
    base: { dmg: 18, cd: 4, radius: 400 },
    tip: s => `영혼의 조각을 모두 소모해, 주변 모든 적에게 걸린 지속 피해 하나당 ${D(s.dmg)} × 조각 수의 피해를 입힙니다. 조각이 3개 이상이어야 사용할 수 있습니다.`,
    castInfo: s => `즉시 시전 · 영혼의 조각 3개 이상 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 5)],
  },
  haunt: {
    cls: 'warlock', name: '유령 출몰', icon: 'haunt', kind: 'active', key: 'T', school: 'shadow', color: '#6070ff',
    base: { dmg: 120, cd: 10, count: 1 },
    tip: s => `조준 방향의 적에게 유령을 보내 ${D(s.dmg)}의 피해를 입히고, 10초 동안 그 적이 받는 지속 피해를 25% 늘립니다. 대상이 죽으면 재사용 대기시간이 절반 줄어듭니다 (정예 · 보스는 초기화).`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.35, 5), node('count', '유령 무리', 2, '유령 <b class="v">+1</b>', s => s.count++), cdNode(0.15, 2)],
  },
  darkglare: {
    cls: 'warlock', name: '암흑시선 소환', icon: 'darkglare', kind: 'active', key: 'F', school: 'shadow', color: '#a070ff',
    base: { cd: 60, dur: 12, dmg: 16, ext: 6 },
    tip: s => `암흑시선을 소환합니다. 소환하는 순간 주변 모든 적의 지속 피해 지속시간이 ${N(s.ext, 0)}초 늘어납니다.<br>암흑시선은 ${N(s.dur, 0)}초 동안 지속 피해가 가장 많이 걸린 적에게 0.5초마다 ${D(s.dmg)} × (지속 피해 수 + 1)의 피해를 입힙니다.`,
    castInfo: s => `즉시 시전 · 재사용 ${s.cd.toFixed(0)}초`,
    nodes: [dmgNode(0.3, 4), node('dur', '오래 머무는 시선', 2, '지속시간 <b class="v">+4초</b>', s => (s.dur += 4), { icon: 'duration' }),
      node('ext', '어둠의 응시', 2, '지속 피해 연장 <b class="v">+3초</b>', s => (s.ext += 3), { icon: 'doom' }), cdNode(0.15, 2)],
  },
  demoniccircle: {
    cls: 'warlock', name: '악마의 마법진', icon: 'demoniccircle', kind: 'active', key: 'SPACE', school: 'shadow', color: '#80ff80', noAuto: true,
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

  // ===== 흑마법사 전용 능력치 =====
  nightfall: {
    cls: 'warlock', name: '해질녘', icon: 'nightfall', kind: 'passive', max: 3, val: 6, unit: '%', fixed: true, req: p => !!(p.skills.corruption && p.skills.shadowbolt),
    desc: v => `부패 피해 시 ${v}% 확률로 발동: 다음 어둠의 화살이 즉시 시전되며 피해 +50%`, apply: (st, v) => (st.nightfall += v / 100),
  },
  demonarmor: { cls: 'warlock', name: '악마의 갑옷', icon: 'demonarmor', kind: 'passive', max: 5, val: 6, unit: '%', desc: v => `받는 피해 -${v}%`, apply: (st, v) => (st.armor += v / 100) },
  siphonlifeP: { cls: 'warlock', name: '영혼 흡수', icon: 'soulleech', kind: 'passive', max: 3, val: 2, unit: '%', desc: v => `지속 피해의 ${v}%만큼 생명력 회복`, apply: (st, v) => (st.dotLeech += v / 100) },
  shadowembraceP: { cls: 'warlock', name: '악의', icon: 'shadowembrace', kind: 'passive', max: 5, val: 8, unit: '%', desc: v => `지속 피해 +${v}%`, apply: (st, v) => (st.dotMul += v / 100) },
  soulharvest: { cls: 'warlock', name: '영혼 수확', icon: 'soulshard', kind: 'passive', max: 2, val: 1, unit: '', fixed: true, rarity: 3, desc: () => '영혼의 조각 최대 +1, 적 처치 시 2% 확률로 영혼의 조각', apply: st => { st.shardMax += 1; st.shardOnKill = 0.02; } },

  // ===== 전설 =====
  eternalagony: { cls: 'warlock', name: '영원한 고뇌', icon: 'agony', kind: 'legendary', req: p => !!p.skills.agony, desc: () => '고통 최대 중첩 +5, 고통 피해 +40%.' },
  corruptspring: { cls: 'warlock', name: '타락의 원천', icon: 'corruption', kind: 'legendary', req: p => !!p.skills.corruption, desc: () => '부패에 걸린 적이 죽으면 주변 3명에게 부패가 옮겨갑니다.' },
  demonbond: { cls: 'warlock', name: '악마의 결속', icon: 'felhunter', kind: 'legendary', req: p => !!p.skills.felhunter, desc: () => '지옥사냥개 +1마리, 지옥사냥개 피해 +50%.' },
  darkharvest: { cls: 'warlock', name: '어둠의 수확', icon: 'drainsoul', kind: 'legendary', desc: () => '치명타 피해 +25%. 적 처치 시 3% 확률로 영혼의 조각을 얻습니다.' },

  // ===== 진화 =====
  drainsoul: {
    cls: 'warlock', name: '영혼 흡수', icon: 'drainsoul', kind: 'evolution', target: 'shadowbolt',
    req: p => p.skills.shadowbolt && p.skillLevel('shadowbolt') >= 8 && p.skills.darksoul, reqText: '어둠의 화살 8레벨 + 어둠의 영혼',
    desc: () => '<b>영웅 특성: 영혼 수확자</b><br>어둠의 화살이 영혼 흡수로 진화합니다. 피해 +50%, 지속 피해 하나당 피해 증가량 2배, 생명력 20% 이하인 적에게 피해 2배. 적을 처치하면 5% 확률로 영혼의 조각을 얻습니다.',
  },
  soulrot: {
    cls: 'warlock', name: '영혼 부식', icon: 'siphonlife', kind: 'evolution', target: 'agony',
    req: p => p.skills.agony && p.skillLevel('agony') >= 5 && p.passives.shadowembraceP, reqText: '고통 5레벨 + 악의',
    desc: () => '<b>영웅 특성: 지옥소환사</b><br>고통이 모든 적에게 자동으로 퍼지고, 고통 중첩이 두 배로 쌓입니다.',
  },
});
for (const id in G.SKILLS) G.SKILLS[id].id = id;
Object.assign(G.SOURCES, {
  shadowbolt: ['어둠의 화살', 'shadowbolt', '#a050ff'], drainsoul: ['영혼 흡수', 'drainsoul', '#c070ff'], corruption: ['부패', 'corruption', '#9a40e0'],
  agony: ['고통', 'agony', '#c02080'], siphonlife: ['생명력 착취', 'siphonlife', '#50d070'], seedofcorruption: ['부패의 씨앗', 'seedofcorruption', '#7a2ab0'],
  phantomsingularity: ['유령 특이점', 'phantomsingularity', '#7050d0'], drainlife: ['생명력 흡수', 'drainlife', '#40e070'], felhunter: ['지옥사냥개', 'felhunter', '#5a9a40'],
  unstableaffliction: ['불안정한 고통', 'unstableaffliction', '#c060ff'], viletaint: ['사악한 오염', 'viletaint', '#9a50e0'],
  maleficrapture: ['악의적인 환희', 'maleficrapture', '#e060ff'], haunt: ['유령 출몰', 'haunt', '#6070ff'],
  deathcoil: ['죽음의 고리', 'deathcoil', '#40c060'], darkglare: ['암흑시선', 'darkglare', '#a070ff'],
  uaburst: ['불안정한 고통 폭발', 'hellfire', '#c060ff'],
});

// ---------- 구현 ----------
const W = () => G.player;
const addShard = n => { const p = W(); const was = p.shards; p.shards = Math.min(p.shardMax, p.shards + n); if (p.shards > was) { G.fx.text(p.x, p.y - 44, '영혼의 조각', '#e080ff', 13); G.Audio.play('tick', 0.5); } };
// 배운 주문은 그 수치, 배우지 않았으면 기본 수치 (사악한 오염이 쓴다)
const dotStats = id => { const sk = W().skills[id]; return sk ? sk.s : G.SKILLS[id].base; };
const corruptionOpts = s => ({ dmg: s.dmg, dur: s.dur, interval: s.interval, src: 'corruption', color: '150,60,220', icon: 'corruption',
  onTick: (e) => { const p = W(); if (p.stats.nightfall && Math.random() < p.stats.nightfall) { p.nightfall = 1; p.nfT = 12; } } });
const agonyOpts = (s, p) => ({ dmg: s.dmg * (p.legend.eternalagony ? 1.4 : 1), dur: s.dur, interval: s.interval, src: 'agony', ramp: true, maxStack: s.maxStack + (p.legend.eternalagony ? 5 : 0), color: '220,40,90', icon: 'agony',
  // 조각 생성은 대상 수와 상관없이 2초에 한 번까지 (적이 많을 때 무한히 차지 않도록)
  onTick: (e, d) => { if (p.evo.soulrot && d.stack < d.maxStack) d.stack++; if (G.t >= (p.shardICD || 0) && Math.random() < s.shardCh * 4) { p.shardICD = G.t + 2; addShard(1); } } });
const uaOpts = s => ({ dmg: s.dmg, dur: s.dur, interval: s.interval, src: 'unstableaffliction', color: '230,110,255', icon: 'unstableaffliction' });
const siphonOpts = s => ({ dmg: s.dmg, dur: s.dur, interval: s.interval, src: 'siphonlife', color: '70,220,110', icon: 'siphonlife', heal: s.heal });
// 아직 그 지속 피해가 없는 적에게 거는 자동 주문 (부패 · 생명력 착취)
const spreadDot = (id, s, opts) => {
  const p = W(), tg = nearestN(p.x, p.y, s.targets, 560, e => !G.Dots.has(e, id)).filter(e => !G.Dots.has(e, id));
  if (!tg.length) return false;
  for (const e of tg) { G.Dots.apply(e, id, opts); G.fx.burst(e.x, e.y - 10, 5, { rgb: opts.color, sp: 60, size: 8 }); }
  return true;
};
// 마우스(자동 시전이면 적 밀집 지점) 방향, 사거리 안의 지점
const aimSpot = range => { const p = W(), m = G.aimPoint(), a = Math.atan2(m.y - p.y, m.x - p.x), d = Math.min(range, Math.hypot(m.x - p.x, m.y - p.y)); return [p.x + Math.cos(a) * d, p.y + Math.sin(a) * d]; };

Object.assign(G.SKILL_IMPL, {
  shadowbolt: {
    update(sk, dt, busy) {
      const p = W(), s = sk.s;
      if (busy) { sk.castT = 0; return; }
      const pen = p.moving ? p.stats.movePenalty : 0;
      const speed = p.nightfall ? 6 : 1; // 해질녘: 즉시 시전
      sk.castT = Math.min(1, sk.castT + dt * (1 + G.P.haste()) * (1 - pen) * speed / s.cast);
      if (sk.castT < 1) return;
      // 지속 피해가 2개 이상 걸린 적을 먼저 노린다
      const tg = nearestN(p.x, p.y, s.count, 640, e => G.Dots.count(e) >= 2);
      if (!tg.length) return;
      sk.castT = 0;
      const nf = p.nightfall ? 1.5 : 1; p.nightfall = 0;
      const ds = !!s.ds, src = ds ? 'drainsoul' : 'shadowbolt';
      for (let i = 0; i < s.count; i++) {
        const t = tg[i % tg.length], base = s.dmg * nf * (i ? G.EXTRA_BOLT : 1);
        G.Proj.spawn({
          x: p.x + p.face * 14, y: p.y - 24, a: Math.atan2(t.y - p.y, t.x - p.x) + (i >= tg.length ? (i - tg.length + 1) * 0.15 : 0), speed: s.speed, r: 9, kind: 'shadowbolt', homing: t, turn: 1.5, noRetarget: true, src, life: 1.8, scale: ds ? 1.35 : 1,
          onHit: e => {
            let m = 1 + G.Dots.count(e) * s.perDot;
            if (ds && e.hp < e.maxHp * 0.2) m *= 2;
            const dealt = G.hit(e, base * m, src, { school: 'shadow' });
            G.P.healSilent(dealt * 0.03); // 영혼 흡수
            G.chill(e, s.slow, 2);
            e.embrace = Math.min(5, (e.embrace || 0) + s.embrace * 0.34);
            if (s.extend && e.dots) for (const id in e.dots) { const d = e.dots[id]; d.dur = Math.min(d.dur + s.extend, d.t + 20); }
            if (ds && e.dead && Math.random() < 0.05) addShard(1);
            G.fx.burst(e.x, e.y, 8, { rgb: ds ? '210,120,255' : '170,90,255', sp: 130, size: 10 });
            G.Audio.play('hit', 0.5);
          },
        });
      }
      G.Audio.play('shadow', 0.45);
    },
  },
  corruption: { auto(sk) { return spreadDot('corruption', sk.s, corruptionOpts(sk.s)); } },
  siphonlife: { auto(sk) { return spreadDot('siphon', sk.s, siphonOpts(sk.s)); } },
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
          G.aoe(e.x, e.y, R, s.dmg, 'seedofcorruption', { school: 'shadow' }, o => { if (s.corrupt) G.Dots.apply(o, 'corruption', corruptionOpts(dotStats('corruption'))); });
          G.fx.ring(e.x, e.y, 5, R, 0.4, '150,60,220', 6, 0.3); G.fx.burst(e.x, e.y, 24, { rgb: '150,60,220', sp: 220, size: 12 }); G.Audio.play('explode', 0.5);
        };
        e.onDeath = boom;
        G.later(s.delay, boom);
      }
      return made > 0;
    },
  },
  phantomsingularity: {
    auto(sk) {
      const p = W(), s = sk.s, R = s.radius * p.stats.area, pts = [];
      for (let k = 0; k < s.count; k++) {
        const d = G.densestPoint(p.x + (k ? U.rand(-220, 220) : 0), p.y + (k ? U.rand(-220, 220) : 0), 520, R);
        if (d) pts.push(d);
      }
      if (!pts.length) return false;
      for (const pt of pts) G.Zones.add({
        kind: 'singularity', x: pt.x, y: pt.y, r: R, life: s.dur * p.stats.dur, tick: 0.5, tickT: 0.2,
        onTick: z => {
          let dealt = 0;
          for (const e of G.Grid.query(z.x, z.y, z.r)) {
            dealt += G.hit(e, s.dmg, 'phantomsingularity', { school: 'shadow', small: true });
            if (s.pull && !e.boss && !e.dead) { const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy) || 1, k = Math.min(d, 16); e.x += dx / d * k; e.y += dy / d * k; }
          }
          if (dealt) G.P.healSilent(dealt * 0.1 / p.stats.dmg);
        },
      });
      G.Audio.play('shadow', 0.5);
      return true;
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
  felhunter: {},

  unstableaffliction: {
    cast(sk) {
      const p = W(), s = sk.s, a = aimAngle();
      const cx = p.x + Math.cos(a) * 200, cy = p.y + Math.sin(a) * 200;
      const tg = nearestN(cx, cy, s.targets, 400);
      if (!tg.length) { G.UI.error('대상이 없습니다.'); return false; }
      for (const e of tg) {
        G.Dots.apply(e, 'ua', uaOpts(s));
        if (s.burst) e.onDeath = () => { G.aoe(e.x, e.y, 90 * p.stats.area, s.dmg * 2, 'uaburst'); G.fx.ring(e.x, e.y, 5, 90, 0.35, '200,100,255', 5, 0.2); };
        G.fx.burst(e.x, e.y - 10, 10, { rgb: '200,100,255', sp: 120, size: 10 });
      }
      G.Audio.play('shadow', 0.6);
    },
  },
  viletaint: {
    cast(sk) {
      const p = W(), s = sk.s, [x, y] = aimSpot(320), R = s.radius * p.stats.area;
      const ag = agonyOpts(dotStats('agony'), p), co = corruptionOpts(dotStats('corruption')), ua = s.ua && uaOpts(dotStats('unstableaffliction'));
      G.aoe(x, y, R, s.dmg, 'viletaint', { school: 'shadow' }, e => { G.Dots.apply(e, 'agony', ag); G.Dots.apply(e, 'corruption', co); if (ua) G.Dots.apply(e, 'ua', ua); });
      G.Zones.add({ kind: 'tinted', color: '140,60,210', x, y, r: R, life: 1.4 });
      G.fx.ring(x, y, 5, R, 0.45, '170,80,240', 8, 0.35); G.fx.burst(x, y, 40, { rgb: '150,70,230', sp: 240, size: 12, spread: R * 0.4 });
      G.Audio.play('shadow'); G.Audio.play('explode', 0.4);
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
          // 정예 · 보스를 처치하면 초기화, 일반 적은 절반만 (졸개를 잡을 때마다 난사되지 않도록)
          if (e.dead) { if (e.elite || e.boss) G.Skills.resetCd(sk); else G.Skills.reduceCd(sk, sk.s.cd * 0.5); }
        },
      }));
      G.Audio.play('shadow', 0.6);
    },
  },
  darkglare: {
    cast(sk) {
      const p = W(), s = sk.s;
      let n = 0;
      for (const e of G.Grid.query(p.x, p.y, 700)) if (e.dots) { for (const id in e.dots) e.dots[id].dur += s.ext; n++; G.fx.burst(e.x, e.y - 10, 4, { rgb: '180,110,255', sp: 80, size: 8 }); }
      p.glare = { x: p.x, y: p.y - 60, t: 0, life: s.dur * p.stats.dur, tickT: 0.3, tgt: null };
      G.fx.burst(p.x, p.y - 60, 40, { rgb: '170,100,255', sp: 220, size: 12 });
      if (n) G.fx.text(p.x, p.y - 90, `지속 피해 +${s.ext}초 (${n})`, '#c890ff', 15);
      G.Audio.play('buff'); G.Audio.play('shadow', 0.6);
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
});

// 소환수 (지옥사냥개 · 암흑시선) · 생명력 흡수 줄기 — 매 프레임
function updateDemons(p, dt) {
  const fh = p.skills.felhunter, bond = p.legend.demonbond ? 1 : 0, pm = bond ? 1.5 : 1;
  const want = fh ? fh.s.count + bond : 0;
  while (p.demons.length < want) {
    p.demons.push({ kind: 'felhunter', x: p.x - 30, y: p.y + 10, t: Math.random() * 6, atkT: 1, face: 1, idx: p.demons.length });
    G.fx.burst(p.x - 30, p.y, 16, { rgb: '120,200,80', sp: 140, size: 10 });
  }
  const hs = 1 + G.P.haste();
  for (const q of p.demons) {
    q.t += dt; q.atkT -= dt * hs;
    const tgt = G.nearestEnemy(q.x, q.y, 420);
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
  // 암흑시선: 지속 피해가 가장 많이 걸린 적을 광선으로 지진다
  const gl = p.glare, dg = p.skills.darkglare;
  if (gl && dg) {
    gl.t += dt; gl.life -= dt; gl.tickT -= dt * hs;
    const tx = p.x + Math.cos(gl.t * 1.3) * 46, ty = p.y - 70 + Math.sin(gl.t * 2.1) * 8;
    gl.x += (tx - gl.x) * Math.min(1, dt * 3); gl.y += (ty - gl.y) * Math.min(1, dt * 3);
    if (!gl.tgt || gl.tgt.dead || U.d2(gl.x, gl.y, gl.tgt.x, gl.tgt.y) > 650 * 650) {
      gl.tgt = null; let best = -1;
      for (const e of G.Grid.query(p.x, p.y, 600)) { const c = G.Dots.count(e) + (e.boss ? 0.5 : 0); if (c > best) { best = c; gl.tgt = e; } }
    }
    if (gl.tickT <= 0 && gl.tgt) {
      gl.tickT = 0.5;
      G.hit(gl.tgt, dg.s.dmg * (G.Dots.count(gl.tgt) + 1), 'darkglare', { school: 'shadow' });
      G.fx.burst(gl.tgt.x, gl.tgt.y - 10, 6, { rgb: '200,130,255', sp: 110, size: 9 });
    }
    if (gl.life <= 0) { G.fx.burst(gl.x, gl.y, 30, { rgb: '170,100,255', sp: 200, size: 12 }); p.glare = null; }
  } else p.glare = null;
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
function drawFelhunter(c, q) {
  const x = q.x, y = q.y + Math.sin(q.t * 3) * 2;
  c.save(); c.translate(x, y); if (q.face < 0) c.scale(-1, 1);
  c.fillStyle = '#4a6a3a'; c.beginPath(); c.ellipse(0, -8, 16, 8, 0, 0, 7); c.fill();
  c.strokeStyle = '#2a3a20'; c.lineWidth = 3; for (const lx of [-10, -4, 6, 12]) { c.beginPath(); c.moveTo(lx, -4); c.lineTo(lx, 6); c.stroke(); }
  c.beginPath(); c.ellipse(16, -12, 8, 6, 0, 0, 7); c.fill();
  c.strokeStyle = '#80c060'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(14, -16); c.quadraticCurveTo(10, -30, 4, -26); c.moveTo(18, -16); c.quadraticCurveTo(20, -30, 26, -26); c.stroke();
  c.fillStyle = '#c0ff60'; c.fillRect(20, -14, 2, 2);
  c.restore();
}
// 암흑시선: 촉수 달린 보라색 눈알 + 대상에게 광선
function drawDarkglare(c, g) {
  const x = g.x, y = g.y + Math.sin(g.t * 3) * 3, fade = Math.min(1, g.life * 2);
  c.globalAlpha = fade;
  if (g.tgt && !g.tgt.dead) {
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    const tx = g.tgt.x, ty = g.tgt.y - 14, w = 3 + Math.sin(G.t * 30) * 1.5;
    c.strokeStyle = 'rgba(170,80,255,0.35)'; c.lineWidth = w * 3; c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke();
    c.strokeStyle = 'rgba(240,200,255,0.9)'; c.lineWidth = w * 0.7; c.stroke();
    c.drawImage(G.Spr.glow('190,110,255', 64), tx - 20, ty - 20, 40, 40);
    c.globalCompositeOperation = 'source-over';
  }
  c.strokeStyle = '#4a2a6a'; c.lineWidth = 3;
  for (let i = 0; i < 5; i++) { const a = Math.PI * (0.25 + i * 0.125), wv = Math.sin(g.t * 4 + i) * 5; c.beginPath(); c.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); c.quadraticCurveTo(x + Math.cos(a) * 22 + wv, y + Math.sin(a) * 22, x + Math.cos(a) * 30, y + Math.sin(a) * 30 + wv); c.stroke(); }
  c.globalCompositeOperation = 'lighter'; c.drawImage(G.Spr.glow('150,70,255', 128), x - 34, y - 34, 68, 68); c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#5a2f86'; c.beginPath(); c.arc(x, y, 15, 0, 7); c.fill();
  c.fillStyle = '#f2e6ff'; c.beginPath(); c.ellipse(x, y, 10, 8, 0, 0, 7); c.fill();
  const lx = g.tgt ? U.clamp((g.tgt.x - x) / 80, -1, 1) * 3 : 0;
  c.fillStyle = '#b040ff'; c.beginPath(); c.arc(x + lx, y, 5, 0, 7); c.fill();
  c.fillStyle = '#1a0628'; c.beginPath(); c.ellipse(x + lx, y, 1.6, 4, 0, 0, 7); c.fill();
  c.globalAlpha = 1;
}

// ---------- 직업 정의 ----------
const WL_DEFENSIVE = ['unendingresolve', 'healthstone', 'demoniccircle', 'darksoul', 'deathcoil'];
G.CLASSES.warlock = {
  id: 'warlock', name: '고통 흑마법사', className: '흑마법사', spec: '고통', color: '#8788ee', icon: 'classwarlock',
  starter: 'shadowbolt', masteryText: '특화: 지속 피해 +2%/점',

  init(p) { Object.assign(p, { shards: 0, shardMax: 5, demons: [], drains: null, nightfall: 0, nfT: 0, dsT: 0, drT: 0, dr: 0, circle: null, glare: null }); },
  recalc(st, p) {
    st.armor += 0.03; // 악마의 피부: 흑마법사 기본 피해 감소
    st.dotLeech += 0.02; // 영혼 흡수: 지속 피해의 2% 회복
    st.dotMul += st.mastery * 0.02;
    if (p.dsT > 0 && p.skills.darksoul) { st.haste += p.skills.darksoul.s.haste; st.dotMul += p.skills.darksoul.s.dot; }
    if (p.legend.darkharvest) { st.critMul += 0.25; st.shardOnKill = (st.shardOnKill || 0) + 0.03; }
    p.shardMax = 5 + st.shardMax;
  },
  computeSkill(sk, s, p) {
    if (sk.id === 'shadowbolt' && p.evo.drainsoul) { s.dmg *= 1.5; s.perDot *= 2; s.ds = 1; }
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
  preventDeath() { return false; },
  // 핵심 주문 자동 시전 조건 (mage.js autoRule 참고)
  autoRule(id, p) {
    const hp = p.hp / p.maxHp, near = G.nearestEnemy(p.x, p.y, 200), boss = !!(G.Waves.boss && !G.Waves.boss.dead);
    if (id === 'unendingresolve') return hp < 0.5 && !!near;
    if (id === 'healthstone') return hp < 0.5;
    if (id === 'darksoul') return G.enemies.length >= 25 || boss;
    if (id === 'maleficrapture') return p.shards >= Math.max(3, p.shardMax - 1) || (boss && G.Dots.count(G.Waves.boss) >= 2);
    if (id === 'darkglare') return G.enemies.filter(e => e.dots).length >= 8 || (boss && G.Dots.count(G.Waves.boss) >= 2);
  },
  update(p, dt) {
    if (p.nfT > 0 && (p.nfT -= dt) <= 0) p.nightfall = 0;
    if (p.drT > 0) p.drT -= dt;
    if (p.dsT > 0 && (p.dsT -= dt) <= 0) G.P.recalc();
  },
  skillsUpdate(p, dt) { updateDemons(p, dt); },

  skillIcon(id, p) { return id === 'shadowbolt' && p.evo.drainsoul ? 'drainsoul' : G.SKILLS[id].icon; },
  resource(p) { return { cur: p.shards, max: p.shardMax, label: '영혼의 조각' }; },
  castbar(p) {
    const sb = p.skills.shadowbolt;
    if (!sb || !(sb.castT > 0 && sb.castT < 1)) return null;
    return { f: sb.castT, name: p.evo.drainsoul ? '영혼 흡수' : '어둠의 화살', total: sb.s.cast / (1 + G.P.haste()) };
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
    for (const q of p.demons) drawFelhunter(c, q);
  },
  drawOver(c, p) {
    if (p.glare) drawDarkglare(c, p.glare);
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
    if (x.type === 'node' && x.id === 'shadowbolt' && (x.nodeId === 'count' || x.nodeId === 'cast')) return 42;
    if (x.type === 'new' && G.SKILLS[x.id].kind === 'auto') return p.order.length < 6 ? 55 : 20;
    if (x.type === 'node' && (x.nodeId === 'dmg' || x.nodeId === 'targets')) return 45;
    if (x.type === 'passive' && ['arcaneint', 'haste', 'crit', 'shadowembraceP', 'nightfall', 'projectile'].includes(x.id)) return 40 + x.rarity * 5;
    if (x.type === 'new' && ['unstableaffliction', 'viletaint', 'maleficrapture', 'haunt', 'darkglare'].includes(x.id)) return 35;
    if (x.type === 'node') return 30;
    if (x.type === 'passive') return 25 + x.rarity * 5;
    return 10;
  },
};
// 마법사에는 없는 훅의 기본값
G.CLASSES.mage.onKill = () => {};
G.CLASSES.mage.masteryText = '특화: 고드름 · 얼음창 피해 +2%/점';
