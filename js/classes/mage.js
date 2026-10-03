'use strict';
// ================= 직업: 냉기 마법사 =================
// 직업별로 다른 부분(자원, 전설/진화 효과, HUD, 그리기, 봇)을 훅으로 모아둔다.
// 코어(player/skills/ui/render/combat)는 G.cls(p).훅(...) 만 호출한다.
const MAGE_DEFENSIVE = ['iceblock', 'icebarrier', 'blink', 'shiftingpower', 'icyveins'];

G.CLASSES.mage = {
  id: 'mage', name: '냉기 마법사', className: '마법사', spec: '냉기', color: '#3fc7eb', icon: 'classmage',
  starter: 'frostbolt',

  init(p) {
    Object.assign(p, {
      icicles: [], icAngle: 0,
      fof: 0, fofT: 0, bf: 0, bfT: 0, ivT: 0, iceblockT: 0, drT: 0, dr: 0,
      fbCast: 0, fbCount: 0, swT: 0, fwT: 0, splinterT: 8,
    });
  },

  // ---------- 능력치 ----------
  recalc(st, p) {
    if (p.legend.coldhearted) st.critMul += 0.25;
    if (p.legend.timewarp) { st.haste += 0.2; st.speedMul += 0.1; }
  },
  computeSkill(sk, s, p) {
    if (sk.id === 'icicles' && p.legend.giantheart) { s.max += 3; s.dmg *= 1.6; }
    if (sk.id === 'frostbolt' && p.evo.frostfire) { s.dmg *= 1.4; s.explode = Math.max(1, s.explode) + 1; s.ff = 1; }
    if (sk.id === 'icelance' && p.evo.splinterstorm) s.splinters = 1;
    // 특화: 고드름 · 얼음창 피해
    if ((sk.id === 'icicles' || sk.id === 'icelance') && p.stats.mastery) s.dmg *= 1 + p.stats.mastery * 0.02;
  },
  haste(p) { return p.ivT > 0 && p.skills.icyveins ? p.skills.icyveins.s.haste : 0; },
  onCrit(e, p) { if (p.legend.coldhearted && Math.random() < 0.05) G.freeze(e, 2); },

  // ---------- 상태 ----------
  busy() { return false; },     // 행동/이동 불가
  immune() { return false; },   // 피해 면역
  // 시전 가로채기: true/false 반환 시 그대로 사용, undefined면 일반 처리
  activate() {},
  // 치명상: 얼음장이 준비돼 있으면 자동으로 발동하고 생명력 일부(save)로 버틴다
  preventDeath(p) {
    const ib = p.skills.iceblock;
    if (!ib || ib.charges <= 0 || p.iceblockT > 0) return false;
    p.hp = Math.max(1, Math.round(p.maxHp * ib.s.save));
    G.SKILL_IMPL.iceblock.cast(ib); G.Skills.startCd(ib);
    G.fx.text(p.x, p.y - 60, '얼음장!', '#bfe8ff', 22, true);
    return true;
  },
  // 핵심 주문 자동 시전 조건: false = 지금은 쓰지 않음, true = 적이 없어도 사용, undefined = 사거리 안에 적이 있으면 사용
  autoRule(id, p) {
    const hp = p.hp / p.maxHp, near = G.nearestEnemy(p.x, p.y, 160);
    if (id === 'iceblock') return hp < 0.35 && p.iceblockT <= 0 ? true : false;
    if (id === 'icebarrier') return p.absorb <= 0 && !!near ? true : false;
    if (id === 'blink') return hp < 0.4 && !!near ? true : false;
    if (id === 'frostnova') return !!near;
    if (id === 'icyveins') return G.enemies.length >= 25 || !!(G.Waves.boss && !G.Waves.boss.dead) ? true : false;
    if (id === 'shiftingpower') return p.order.filter(k => k !== 'shiftingpower' && p.skills[k].s.cd >= 8 && p.skills[k].charges < p.skills[k].maxCharges).length >= 2 ? true : false;
  },

  update(p, dt) {
    if (p.fofT > 0 && (p.fofT -= dt) <= 0) p.fof = 0;
    if (p.bfT > 0 && (p.bfT -= dt) <= 0) p.bf = 0;
    if (p.ivT > 0) { p.ivT -= dt; if (G.fx.chance(0.6)) G.fx.part({ x: p.x + U.rand(-14, 14), y: p.y + U.rand(-8, 22), vy: U.rand(-90, -40), life: 0.6, size: U.rand(5, 10), rgb: '90,170,255' }); }
    if (p.drT > 0) p.drT -= dt;
    if (p.iceblockT > 0) {
      p.iceblockT -= dt;
      const ib = p.skills.iceblock; if (ib && ib.s.heal) G.P.healSilent(p.maxHp * ib.s.heal * dt);
      if (p.iceblockT <= 0) G.Skills.endIceBlock();
    }
    p.icAngle += dt * 2.2;
    const ic = p.skills.icicles; if (ic) while (p.icicles.length > ic.s.max) p.icicles.shift();
  },
  // 주문 갱신 후 매 프레임 (전설/진화 주기 효과)
  skillsUpdate(p, dt) {
    if (p.legend.freezingwinds && G.projs.some(q => q.kind === 'orb')) {
      p.fwT -= dt; if (p.fwT <= 0) { p.fwT = 2; G.Skills.procBF(); }
    }
    if (p.evo.splinterstorm && p.skills.icelance) {
      p.splinterT -= dt;
      if (p.splinterT <= 0 && G.enemies.length) {
        p.splinterT = 8; G.fx.ring(p.x, p.y, 10, 120, 0.5, '190,110,255', 4);
        G.Skills.splinters(14, true);
      }
    }
  },

  // ---------- HUD ----------
  skillIcon(id, p) { return id === 'frostbolt' && p.evo.frostfire ? 'frostfire' : G.SKILLS[id].icon; },
  resource(p) {
    const ic = p.skills.icicles;
    return ic ? { cur: p.icicles.length, max: ic.s.max, label: '고드름' } : null;
  },
  castbar(p) {
    const fb = p.skills.frostbolt;
    if (!fb || !(fb.castT > 0 && fb.castT < 1)) return null;
    return { f: fb.castT, name: p.evo.frostfire ? '서리불꽃 화살' : '얼음화살', total: fb.s.cast / (1 + G.P.haste()) };
  },
  slotState(id, p, impl, sk) {
    return {
      glow: id === 'glacialspike' && impl.usable(sk),
      active: id === 'iceblock' && p.iceblockT > 0,
    };
  },
  autoGlow(id, p) { return (id === 'icelance' && p.fof > 0) || (id === 'flurry' && p.bf > 0); },
  buffs(p) {
    const b = [];
    if (p.ivT > 0) b.push(['icyveins', p.ivT, '', '얼음 핏줄', '가속 증가']);
    if (p.fof > 0) b.push(['fingersoffrost', p.fofT, p.fof > 1 ? p.fof : '', '서리의 손가락', '다음 얼음창이 얼어붙은 대상처럼 취급']);
    if (p.bf > 0) b.push(['brainfreeze', p.bfT, '', '두뇌 빙결', '다음 진눈깨비 강화']);
    if (p.absorb > 0) b.push(['icebarrier', -1, Math.round(p.absorb), '얼음 보호막', '피해 흡수']);
    if (p.iceblockT > 0) b.push(['icecold', p.iceblockT, '', '얼음장', `받는 피해 ${Math.round(p.dr * 100)}% 감소`]);
    return b;
  },

  // ---------- 그리기 ----------
  drawBody(c, x, y, face, alpha, image, t) {
    const p = G.player, spr = !image && p.hurtT > 0 ? G.Spr.playerFlash : G.Spr.player;
    const bob = (image || p.moving) ? Math.abs(Math.sin((t ?? G.t) * 10)) * -2.5 : Math.sin(G.t * 2) * 0.8;
    c.save(); c.globalAlpha = alpha;
    c.translate(x, y + 14 + bob); if (face < 0) c.scale(-1, 1);
    c.drawImage(spr, -32, -74);
    c.restore();
    // 지팡이 수정 빛
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = (image ? 0.5 : 0.8) + Math.sin(G.t * 6) * 0.15;
    const sx = x + face * 16, sy = y + 14 + bob - 66;
    c.drawImage(G.Spr.glow(image ? '190,120,255' : '120,210,255', 64), sx - 20, sy - 20, 40, 40);
    if (image) { c.globalAlpha = 0.35; c.drawImage(G.Spr.glow('170,100,255', 64), x - 30, y - 40, 60, 70); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
  drawUnder(c, p) {
    if (p.ivT > 0) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.45 + Math.sin(G.t * 8) * 0.15;
      c.drawImage(G.Spr.glow('60,140,255', 128), p.x - 46, p.y - 64, 92, 100);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    if (p.channel && p.channel.id === 'rayoffrost' && p.channel.len) {
      const ch = p.channel, sx = p.x + Math.cos(ch.a) * 18, sy = p.y - 16 + Math.sin(ch.a) * 18;
      const ex = p.x + Math.cos(ch.a) * ch.len, ey = p.y - 16 + Math.sin(ch.a) * ch.len;
      c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      const wob = Math.sin(G.t * 40) * 2;
      [[ch.w * 2.2 + wob, 'rgba(60,130,255,0.25)'], [ch.w * 1.2 + wob, 'rgba(120,200,255,0.5)'], [ch.w * 0.45, 'rgba(235,250,255,0.95)']].forEach(([w, col]) => {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
      });
      c.drawImage(G.Spr.glow('150,220,255', 128), ex - 50, ey - 50, 100, 100);
      c.drawImage(G.Spr.glow('200,240,255', 64), sx - 26, sy - 26, 52, 52);
      c.globalCompositeOperation = 'source-over';
    }
    if (p.channel && p.channel.id === 'shiftingpower') {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.6;
      c.drawImage(G.Spr.glow('80,230,150', 128), p.x - 60, p.y - 70, 120, 120);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  },
  drawOver(c, p) {
    // 고드름
    for (let i = 0; i < p.icicles.length; i++) {
      const [x, y, a] = G.Skills.icPos(i);
      c.save(); c.translate(x, y); c.rotate(-Math.PI / 2 + Math.cos(a) * 0.3);
      c.drawImage(G.Spr.icicle, -20, -7); c.restore();
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5; c.drawImage(G.Spr.glow('130,200,255', 32), x - 12, y - 12, 24, 24);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    // 얼음 보호막
    if (p.absorb > 0) {
      const r = 34 + Math.sin(G.t * 3) * 1.5;
      const g = c.createRadialGradient(p.x - 8, p.y - 22, 4, p.x, p.y - 12, r);
      g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(0.7, 'rgba(150,210,255,0.12)'); g.addColorStop(1, 'rgba(180,230,255,0.45)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y - 12, r, 0, 7); c.fill();
      c.strokeStyle = 'rgba(220,245,255,0.7)'; c.lineWidth = 1.5; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const a = i * 1.047 + G.t * 0.3; c.beginPath(); c.moveTo(p.x + Math.cos(a) * r * 0.4, p.y - 12 + Math.sin(a) * r * 0.4); c.lineTo(p.x + Math.cos(a + 0.4) * r * 0.95, p.y - 12 + Math.sin(a + 0.4) * r * 0.95); c.stroke(); }
    }
    // 얼음장: 몸을 감싼 서리 빛 + 주위를 도는 얼음 조각 (움직일 수 있으니 갇힌 모습이 아니다)
    if (p.iceblockT > 0) {
      const x = p.x, y = p.y - 22;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.35 + Math.sin(G.t * 6) * 0.08;
      c.drawImage(G.Spr.glow('150,220,255', 128), x - 40, y - 46, 80, 92);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(220,245,255,0.85)'; c.strokeStyle = 'rgba(120,190,255,0.9)'; c.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.257 + G.t * 2.4, sx = x + Math.cos(a) * 30, sy = y + 8 + Math.sin(a) * 14;
        c.beginPath(); c.moveTo(sx, sy - 7); c.lineTo(sx + 3, sy); c.lineTo(sx, sy + 7); c.lineTo(sx - 3, sy); c.closePath(); c.fill(); c.stroke();
      }
    }
  },

  // ---------- 레벨업 선택지 가중치 ----------
  upgWeight(o, p) {
    if (o.type === 'new') return G.SKILLS[o.id].kind === 'auto' ? 1.15 : MAGE_DEFENSIVE.includes(o.id) && p.level < 8 ? 0.35 : 0.95;
    if (o.type === 'passive') return o.id === 'fingersoffrost' || o.id === 'brainfreeze' ? 1.2 : 0.75;
    if (o.type === 'node') {
      let w = 1.2;
      if (o.id === 'frostbolt' && p.level < 8) w = 2.2;
      if (o.id === 'frostbolt' && (o.nodeId === 'count' || o.nodeId === 'cast') && p.level < 12) w += 0.8;
      return w;
    }
  },

  // ---------- 자동 플레이 봇 ----------
  botUse(id, p) {
    if (id === 'iceblock' && (p.hp > p.maxHp * 0.35 || p.iceblockT > 0)) return false;
    if (id === 'blink' && p.hp > p.maxHp * 0.6) return false;
    return true;
  },
  // 사람처럼: 진화 > 전설 > 공격 주문 > 피해 강화 > 얼음화살 핵심 강화 > 능력치 > 기타
  botScore(x, p) {
    if (x.type === 'evolution') return 100;
    if (x.type === 'legendary') return 80;
    if (x.type === 'node' && x.id === 'frostbolt' && (x.nodeId === 'count' || x.nodeId === 'cast')) return 42;
    if (x.type === 'new' && G.SKILLS[x.id].kind === 'auto') return p.order.length < 6 ? 55 : 20;
    if (x.type === 'node' && x.nodeId === 'dmg') return 45;
    if (x.type === 'passive' && ['arcaneint', 'haste', 'crit', 'projectile', 'fingersoffrost', 'brainfreeze'].includes(x.id)) return 40 + x.rarity * 5;
    if (x.type === 'new' && ['frozenorb', 'frostnova', 'coneofcold', 'glacialspike', 'icebarrier'].includes(x.id)) return 35;
    if (x.type === 'node') return 30;
    if (x.type === 'passive') return 25 + x.rarity * 5;
    return 10;
  },
};
