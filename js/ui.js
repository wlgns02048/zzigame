'use strict';
// ================= HUD / 메뉴 =================
const $ = id => document.getElementById(id);

G.UI = {
  el: {}, slotEls: {}, autoEls: [], meterT: 0, warnT: 0, errT: 0, modalKind: null,

  init() {
    const ids = ['hud', 'pfLevel', 'pfHp', 'pfAbs', 'pfHpText', 'pfIcicle', 'pfIcicleText', 'buffs', 'timer', 'kills', 'goldTxt', 'bossFrame', 'bfIcon', 'bfName', 'bfPct', 'bfHp', 'bfCast',
      'raidWarn', 'castbar', 'autoBar', 'passiveBar', 'actionBar', 'xpBar', 'meter', 'meterRows', 'modal', 'tooltip', 'flash'];
    for (const id of ids) this.el[id] = $(id);
    // 오류 메시지 (와우 UIErrorsFrame)
    const err = document.createElement('div');
    err.style.cssText = 'position:absolute;left:0;right:0;top:15%;text-align:center;font-weight:700;font-size:18px;color:#ff2020;text-shadow:1px 1px 0 #000,-1px -1px 0 #000;opacity:0;transition:opacity .3s;pointer-events:none';
    this.el.hud.appendChild(err); this.el.err = err;
    // 액션바 12칸
    const ab = this.el.actionBar;
    for (const k of G.ACTION_KEYS) {
      const d = document.createElement('div');
      d.className = 'slot empty'; d.dataset.key = k;
      d.innerHTML = `<img class="hidden"><div class="cd"></div><div class="cdt"></div><span class="key">${G.KEY_LABEL[k] || k}</span><span class="chg"></span>`;
      ab.appendChild(d); this.slotEls[k] = d;
      d.addEventListener('mousedown', e => { e.stopPropagation(); const id = this.skillForKey(k); if (id) G.Skills.activate(id); });
    }
    // 툴팁 (위임)
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-tip]'), s = e.target.closest('[data-skill]');
      if (s && s.dataset.skill) this.showTip(this.skillTip(s.dataset.skill), e);
      else if (t) this.showTip(t.dataset.tip, e);
      else if (e.target.closest('.slot')) { const k = e.target.closest('.slot').dataset.key; const id = k && this.skillForKey(k); if (id) this.showTip(this.skillTip(id), e); else this.hideTip(); }
      else this.hideTip();
    });
    document.addEventListener('mousemove', e => { if (!this.el.tooltip.classList.contains('hidden')) this.placeTip(e); });
  },

  skillForKey(k) { const p = G.player; if (!p) return null; for (const id of p.order) if (G.SKILLS[id].key === k) return id; return null; },

  // ---------- 툴팁 ----------
  showTip(html, e) { const t = this.el.tooltip; t.innerHTML = html; t.classList.remove('hidden'); this.placeTip(e); },
  placeTip(e) {
    const t = this.el.tooltip, w = t.offsetWidth, h = t.offsetHeight;
    let x = e.clientX + 16, y = e.clientY - h - 12;
    if (x + w > innerWidth - 8) x = e.clientX - w - 16;
    if (y < 8) y = e.clientY + 20;
    t.style.left = x + 'px'; t.style.top = y + 'px';
  },
  hideTip() { this.el.tooltip.classList.add('hidden'); },
  skillTip(id) {
    const p = G.player, def = G.SKILLS[id];
    if (def.kind === 'passive') {
      const ps = p.passives[id];
      return `<div class="tt-title">${def.name}</div><div class="tt-row"><span>능력치</span><span>등급 ${ps.rank}/${def.max}</span></div><div class="tt-desc">${def.desc(ps.total)}</div>`;
    }
    if (def.kind === 'legendary' || def.kind === 'evolution') {
      const c = def.kind === 'legendary' ? '#ff8000' : '#e6cc80';
      return `<div class="tt-title" style="color:${c}">${def.name}</div><div class="tt-row"><span>${def.kind === 'legendary' ? '전설 효과' : '진화'}</span></div><div class="tt-desc">${def.desc()}</div>`;
    }
    const sk = p.skills[id]; if (!sk) return '';
    const isFF = id === 'frostbolt' && p.evo.frostfire;
    const ranks = (def.nodes || []).filter(n => sk.ranks[n.id]).map(n => `<span class="tt-green">${n.name} ${sk.ranks[n.id]}/${n.max}</span>`).join(' · ');
    return `<div class="tt-title" style="${isFF ? 'color:#e6cc80' : ''}">${isFF ? '서리불꽃 화살' : def.name}</div>
      <div class="tt-row"><span>${def.castInfo(sk.s)}</span><span>${p.skillLevel(id)}레벨</span></div>
      ${def.key ? `<div class="tt-row"><span>단축키: ${G.KEY_LABEL[def.key] || def.key}</span></div>` : ''}
      <div class="tt-desc">${def.tip(sk.s)}</div>${ranks ? `<div class="tt-sub">${ranks}</div>` : ''}`;
  },

  // ---------- 바 구성 ----------
  buildBars() {
    const p = G.player; if (!p) return;
    for (const k of G.ACTION_KEYS) {
      const d = this.slotEls[k], id = this.skillForKey(k), img = d.querySelector('img');
      if (id) { img.src = G.icon(G.SKILLS[id].icon); img.classList.remove('hidden'); d.classList.remove('empty'); }
      else { img.classList.add('hidden'); d.classList.add('empty'); }
    }
    const ab = this.el.autoBar; ab.innerHTML = ''; this.autoEls = [];
    for (const id of p.order) {
      const def = G.SKILLS[id]; if (def.kind !== 'auto') continue;
      const d = document.createElement('div'); d.className = 'slot small'; d.dataset.skill = id;
      const icon = id === 'frostbolt' && p.evo.frostfire ? 'frostfire' : def.icon;
      d.innerHTML = `<img src="${G.icon(icon)}"><div class="cd"></div><div class="cdt"></div><span class="lv">${p.skillLevel(id)}</span><span class="chg"></span>`;
      ab.appendChild(d); this.autoEls.push([id, d]);
    }
    for (let i = this.autoEls.length; i < G.LIMITS.auto; i++) { const d = document.createElement('div'); d.className = 'slot small empty'; ab.appendChild(d); }
    const pb = this.el.passiveBar; pb.innerHTML = '';
    const addP = (id, lv, cls = '') => { const d = document.createElement('div'); d.className = 'pslot ' + cls; d.dataset.skill = id; d.innerHTML = `<img src="${G.icon(G.SKILLS[id].icon)}"><span class="lv">${lv}</span>`; pb.appendChild(d); };
    for (const id in p.passives) addP(id, p.passives[id].rank);
    for (const id in p.legend) addP(id, '', 'legend');
    for (const id in p.evo) addP(id, '', 'legend');
  },

  setCd(d, sk) {
    const cdEl = d.querySelector('.cd'), tEl = d.querySelector('.cdt'), cEl = d.querySelector('.chg');
    const hs = 1 + G.P.haste();
    let frac = 0, txt = '';
    if (sk.s.cd && sk.charges <= 0 && sk.cdT > 0) {
      frac = Math.min(1, sk.cdT / sk.cdFull);
      const rem = sk.cdT / hs; txt = rem >= 1 ? Math.ceil(rem) : rem >= 0.05 ? rem.toFixed(1) : '';
    }
    cdEl.style.setProperty('--p', frac.toFixed(3));
    if (tEl.textContent !== String(txt)) tEl.textContent = txt;
    const ch = sk.maxCharges > 1 ? sk.charges : '';
    if (cEl.textContent !== String(ch)) cEl.textContent = ch;
  },

  // ---------- 매 프레임 갱신 ----------
  update(dt) {
    const p = G.player; if (!p || G.state === 'menu') return;
    const el = this.el;
    el.pfLevel.textContent = p.level;
    el.pfHp.style.width = (p.hp / p.maxHp * 100).toFixed(1) + '%';
    el.pfAbs.style.width = Math.min(100, p.absorb / p.maxHp * 100).toFixed(1) + '%';
    el.pfHpText.textContent = `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}` + (p.absorb > 0 ? ` (+${Math.round(p.absorb)})` : '');
    const ic = p.skills.icicles;
    el.pfIcicle.style.width = ic ? (p.icicles.length / ic.s.max * 100) + '%' : '0%';
    el.pfIcicleText.textContent = ic ? `고드름 ${p.icicles.length} / ${ic.s.max}` : '';
    el.timer.textContent = U.fmtTime(G.t);
    el.kills.textContent = G.stats.kills.toLocaleString();
    el.goldTxt.textContent = Math.floor(G.stats.gold);
    el.xpBar.firstElementChild.style.width = (p.xp / p.xpNeed * 100).toFixed(1) + '%';
    el.xpBar.lastElementChild.textContent = `레벨 ${p.level} · 경험치 ${Math.floor(p.xp)} / ${p.xpNeed}`;

    // 시전바
    const cb = el.castbar, fb = p.skills.frostbolt;
    if (p.channel) {
      cb.classList.remove('hidden'); cb.classList.add('channel');
      const f = 1 - p.channel.t / p.channel.dur;
      cb.firstElementChild.style.width = (f * 100) + '%'; cb.querySelector('.spark').style.left = (f * 100) + '%';
      cb.querySelector('.name').textContent = p.channel.name; cb.querySelector('.time').textContent = (p.channel.dur - p.channel.t).toFixed(1);
    } else if (fb && p.iceblockT <= 0 && fb.castT > 0 && fb.castT < 1) {
      cb.classList.remove('hidden', 'channel');
      cb.firstElementChild.style.width = (fb.castT * 100) + '%'; cb.querySelector('.spark').style.left = (fb.castT * 100) + '%';
      cb.querySelector('.name').textContent = p.evo.frostfire ? '서리불꽃 화살' : '얼음화살';
      const tot = fb.s.cast / (1 + G.P.haste());
      cb.querySelector('.time').textContent = `${((1 - fb.castT) * tot).toFixed(1)} / ${tot.toFixed(1)}`;
    } else cb.classList.add('hidden');

    // 액션바 쿨다운
    for (const k of G.ACTION_KEYS) {
      const id = this.skillForKey(k), d = this.slotEls[k];
      if (!id) continue;
      const sk = p.skills[id];
      this.setCd(d, sk);
      const impl = G.SKILL_IMPL[id];
      d.classList.toggle('unusable', !!(impl.usable && !impl.usable(sk)) || p.iceblockT > 0 && id !== 'iceblock');
      d.classList.toggle('glow', id === 'glacialspike' && impl.usable(sk));
      d.classList.toggle('active', !!(p.channel && p.channel.id === id) || (id === 'iceblock' && p.iceblockT > 0));
    }
    for (const [id, d] of this.autoEls) {
      const sk = p.skills[id];
      if (sk.s.cd) this.setCd(d, sk);
      d.classList.toggle('glow', (id === 'icelance' && p.fof > 0) || (id === 'flurry' && p.bf > 0));
    }

    // 버프
    const buffs = [];
    if (p.ivT > 0) buffs.push(['icyveins', p.ivT, '', '얼음 핏줄', '가속 증가']);
    if (p.fof > 0) buffs.push(['fingersoffrost', p.fofT, p.fof > 1 ? p.fof : '', '서리의 손가락', '다음 얼음창이 얼어붙은 대상처럼 취급']);
    if (p.bf > 0) buffs.push(['brainfreeze', p.bfT, '', '두뇌 빙결', '다음 진눈깨비 강화']);
    if (p.absorb > 0) buffs.push(['icebarrier', -1, Math.round(p.absorb), '얼음 보호막', '피해 흡수']);
    if (p.iceblockT > 0) buffs.push(['iceblock', p.iceblockT, '', '얼음 방패', '모든 피해 면역']);
    if (G.images.length) buffs.push(['mirrorimage', G.images[0].life, G.images.length, '환영 복제', '환영이 적의 주의를 끕니다']);
    if (p.rootT > 0) buffs.push(['freeze', p.rootT, '', '서리 폭발', '이동 불가', true]);
    const sig = buffs.map(b => b[0]).join();
    if (sig !== this.buffSig) {
      this.buffSig = sig;
      el.buffs.innerHTML = buffs.map(b => `<div class="buff ${b[5] ? 'debuff' : ''}" data-tip="<div class='tt-title'>${b[3]}</div><div class='tt-desc'>${b[4]}</div>"><img src="${G.icon(b[0])}"><div class="bs"></div><div class="bt"></div></div>`).join('');
    }
    [...el.buffs.children].forEach((d, i) => {
      const b = buffs[i]; if (!b) return;
      d.querySelector('.bt').textContent = b[1] < 0 ? '' : b[1] >= 60 ? Math.ceil(b[1] / 60) + '분' : Math.ceil(b[1]) + '초';
      d.querySelector('.bs').textContent = b[2];
    });

    // 보스/정예 프레임
    let tgt = G.Waves.boss && !G.Waves.boss.dead ? G.Waves.boss : null;
    if (!tgt) tgt = G.enemies.find(e => e.elite && U.d2(e.x, e.y, p.x, p.y) < 700 * 700) || null;
    if (tgt) {
      el.bossFrame.classList.remove('hidden');
      if (this.bfTgt !== tgt) { this.bfTgt = tgt; el.bfIcon.src = G.icon(tgt.def.icon); el.bfName.textContent = tgt.boss ? `${tgt.def.name} - ${tgt.def.title}` : `${tgt.def.name} (정예)`; }
      const f = Math.max(0, tgt.hp / tgt.maxHp);
      el.bfHp.style.width = (f * 100).toFixed(1) + '%'; el.bfPct.textContent = `${U.num(Math.max(0, tgt.hp))} (${(f * 100).toFixed(0)}%)`;
      if (tgt.cast) {
        el.bfCast.classList.remove('hidden');
        el.bfCast.firstElementChild.style.width = (tgt.cast.t / tgt.cast.max * 100) + '%';
        el.bfCast.lastElementChild.textContent = tgt.cast.name;
      } else el.bfCast.classList.add('hidden');
    } else el.bossFrame.classList.add('hidden');

    // 경보 타이머
    if (this.warnT > 0 && (this.warnT -= dt) <= 0) el.raidWarn.classList.remove('show');
    if (this.errT > 0 && (this.errT -= dt) <= 0) el.err.style.opacity = 0;

    // 피해 미터
    this.meterT -= dt;
    if (this.meterT <= 0 && !el.meter.classList.contains('hidden')) { this.meterT = 0.5; this.renderMeter(el.meterRows, 8); }
  },

  renderMeter(box, n) {
    const rows = Object.entries(G.meter.d).sort((a, b) => b[1] - a[1]).slice(0, n);
    const top = rows.length ? rows[0][1] : 1, tot = G.meter.total || 1, dur = Math.max(1, G.t);
    box.innerHTML = rows.map(([src, v]) => {
      const [name, icon, col] = G.SOURCES[src] || [src, 'frostbolt', '#3fa7ff'];
      return `<div class="mRow"><div class="mFill" style="width:${(v / top * 100).toFixed(1)}%;background:linear-gradient(90deg,${col}cc,${col}77)"></div><img src="${G.icon(icon)}"><span class="mName">${name}</span><span class="mVal">${U.num(v)} (${U.num(v / dur)}, ${(v / tot * 100).toFixed(1)}%)</span></div>`;
    }).join('') || '<div style="padding:6px;color:#888">아직 기록이 없습니다</div>';
  },

  // ---------- 알림 ----------
  warn(text, color = '#ff6a1a', dur = 3) { const w = this.el.raidWarn; w.textContent = text; w.style.color = color; w.classList.add('show'); this.warnT = dur; },
  error(text) { this.el.err.textContent = text; this.el.err.style.opacity = 1; this.errT = 1.2; },
  hurtFlash() { const f = this.el.flash; f.style.transition = 'none'; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity .4s'; f.style.opacity = 0; }); },
  flashReady(id) { const k = G.SKILLS[id].key, d = k && this.slotEls[k]; if (!d) return; d.classList.remove('flashready'); void d.offsetWidth; d.classList.add('flashready'); },
  pressed(id) { const k = G.SKILLS[id].key, d = k && this.slotEls[k]; if (!d) return; d.classList.add('pressed'); setTimeout(() => d.classList.remove('pressed'), 90); },
  toggleMeter() { this.el.meter.classList.toggle('hidden'); this.meterT = 0; },

  // ---------- 모달 ----------
  open(kind, html) { document.body.classList.add('modal-open'); this.modalKind = kind; this.el.modal.innerHTML = html; this.el.modal.classList.remove('hidden'); this.hideTip(); },
  close() { document.body.classList.remove('modal-open'); this.modalKind = null; this.el.modal.classList.add('hidden'); this.el.modal.innerHTML = ''; this.hideTip(); },

  showMenu() {
    const m = G.Meta.data;
    this.el.hud.classList.add('hidden');
    this.open('menu', `<div class="menuWrap">
      <div class="logo">얼음왕관의 시련</div>
      <div class="logo2">냉기 마법사 로그라이크</div>
      <button class="btn" id="mStart">전투 시작</button>
      <button class="btn" id="mMeta">영구 강화 (달라란 도서관)</button>
      <button class="btn" id="mHelp">조작법</button>
      <div class="goldLine">보유 골드: ${Math.floor(m.gold)} · 최고 기록: ${U.fmtTime(m.best)} · 리치 왕 처치: ${m.wins}회</div>
      <div class="tt-sub">15분 동안 살아남아 리치 왕을 쓰러뜨리세요.</div></div>`);
    $('mStart').onclick = () => { G.Audio.init(); G.startRun(); };
    $('mMeta').onclick = () => { G.Audio.init(); this.showMeta(); };
    $('mHelp').onclick = () => this.showHelp();
  },
  showHelp() {
    const keys = [['WASD / 방향키', '이동'], ['마우스', '조준 (단축키 주문 방향)'], ['자동 주문', '얼음화살·얼음창·진눈깨비 등은 자동 시전'],
      ['Q', '얼어붙은 구슬'], ['E', '냉기 돌풍'], ['R', '빙하 가시 (고드름 최대치)'], ['F', '서리 회오리'], ['T', '서리 광선'], ['Space', '점멸'],
      ['1 ~ 6', '얼음 핏줄 · 얼음 보호막 · 얼음 방패 · 매서운 한파 · 환영 복제 · 힘의 전환'], ['TAB', '피해 미터 (Details!)'], ['ESC', '일시 정지'], ['M', '소리 켜기/끄기'],
      ['레벨업', '1/2/3 키 또는 클릭으로 선택']];
    this.open('help', `<div class="panel"><h2>조작법</h2><div class="helpGrid">${keys.map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join('')}</div>
      <p class="tt-sub" style="max-width:520px">단축키 주문은 레벨업에서 배워야 액션바에 나타납니다. 얼어붙은 적(빙결/겨울의 한기)은 얼음창에 3배 피해를 받고, 모든 냉기 주문의 치명타 확률이 높아집니다(산산조각).</p>
      <button class="btn" id="hBack">돌아가기</button></div>`);
    $('hBack').onclick = () => (G.state === 'play' ? this.showPause() : this.showMenu());
  },
  showMeta() {
    const m = G.Meta;
    this.open('meta', `<div class="panel"><h2>달라란 도서관</h2><div class="sub">보유 골드: <span style="color:#ffd100">${Math.floor(m.data.gold)}</span></div>
      <div class="metaGrid">${G.META_DEFS.map(d => {
        const r = m.rank(d.id), max = r >= d.max, c = m.cost(d);
        return `<div class="metaItem"><img src="${G.icon(d.icon)}"><div class="mi"><b>${d.name}</b> <span class="r">${r}/${d.max}</span><br>${d.desc(Math.max(1, r))}</div>
          <button class="btn small" data-buy="${d.id}" ${max || m.data.gold < c ? 'disabled' : ''}>${max ? '최대' : c + 'G'}</button></div>`;
      }).join('')}</div><button class="btn" id="metaBack">돌아가기</button></div>`);
    this.el.modal.querySelectorAll('[data-buy]').forEach(b => (b.onclick = () => { if (m.buy(b.dataset.buy)) { G.Audio.play('gold'); this.showMeta(); } }));
    $('metaBack').onclick = () => this.showMenu();
  },

  showLevelUp(opts, title, sub) {
    const p = G.player;
    this.lvOpts = opts;
    const card = (o, i) => {
      const r = G.RARITY[o.rarity];
      return `<div class="card" style="--qc:${r.color}" data-i="${i}">
        <div class="chead"><img src="${G.icon(o.icon)}"><div><div class="cname">${o.name}</div><div class="ctype">${o.label}</div><div class="clv">${o.lv || ''}</div></div></div>
        ${o.nodeDesc ? `<div class="cnode">${o.nodeDesc}</div>` : ''}
        ${o.cast ? `<div class="tt-row" style="font-size:12px;margin-bottom:4px"><span>${o.cast}</span></div>` : ''}
        <div class="cdesc">${o.desc || ''}</div>
        <div class="cfoot"><span style="color:${r.color}">${r.name}</span><span>${o.key ? `단축키 ${G.KEY_LABEL[o.key] || o.key} · ` : ''}<span class="ckey">${i + 1}</span></span></div></div>`;
    };
    this.open('levelup', `<div><div class="lvTitle">${title}</div><div class="lvSub">${sub}</div>
      <div class="cards">${opts.map(card).join('')}</div>
      <div class="lvBtns"><button class="btn small" id="lvReroll" ${p.rerolls > 0 ? '' : 'disabled'}>다시 굴리기 (${p.rerolls})</button><button class="btn small" id="lvSkip">건너뛰기 (+10 골드)</button></div></div>`);
    this.el.modal.querySelectorAll('.card').forEach(c => (c.onclick = () => G.pickUpgrade(+c.dataset.i)));
    $('lvReroll').onclick = () => G.rerollUpgrade();
    $('lvSkip').onclick = () => G.pickUpgrade(-1);
  },

  buildSummary() {
    const p = G.player;
    const icons = p.order.map(id => `<div class="pslot" data-skill="${id}"><img src="${G.icon(id === 'frostbolt' && p.evo.frostfire ? 'frostfire' : G.SKILLS[id].icon)}"><span class="lv">${p.skillLevel(id)}</span></div>`)
      .concat(Object.keys(p.passives).map(id => `<div class="pslot" data-skill="${id}"><img src="${G.icon(G.SKILLS[id].icon)}"><span class="lv">${p.passives[id].rank}</span></div>`))
      .concat(Object.keys(p.legend).concat(Object.keys(p.evo)).map(id => `<div class="pslot legend" data-skill="${id}"><img src="${G.icon(G.SKILLS[id].icon)}"></div>`));
    return `<div class="buildRow">${icons.join('')}</div>`;
  },

  showPause() {
    const st = G.player.stats;
    this.open('pause', `<div class="panel"><h2>일시 정지</h2>
      <div class="summary"><div>시간<b>${U.fmtTime(G.t)}</b></div><div>레벨<b>${G.player.level}</b></div><div>처치<b>${G.stats.kills}</b></div><div>주문력<b>${Math.round(st.dmg * 100)}%</b></div><div>가속<b>${Math.round(G.P.haste() * 100)}%</b></div><div>치명타<b>${Math.round(st.crit * 100)}%</b></div></div>
      ${this.buildSummary()}
      <button class="btn" id="pResume">계속하기</button><button class="btn" id="pHelp">조작법</button><button class="btn" id="pQuit">포기하고 메인 메뉴로</button></div>`);
    $('pResume').onclick = () => G.resume();
    $('pHelp').onclick = () => this.showHelp();
    $('pQuit').onclick = () => G.endRun(false);
  },

  showEnd(victory, goldGain) {
    const rows = Object.entries(G.meter.d).sort((a, b) => b[1] - a[1]);
    const tot = G.meter.total || 1, dur = Math.max(1, G.t);
    this.open('end', `<div class="panel" style="max-height:92vh;overflow:auto">
      <h1 style="color:${victory ? '#ffd100' : '#ff4b3a'}">${victory ? '승리!' : '당신은 죽었습니다'}</h1>
      <div class="sub">${victory ? '리치 왕이 쓰러졌습니다. 얼음왕관 성채에 평화가 찾아옵니다.' : '영혼이 망령으로 떠돌고 있습니다...'}</div>
      <div class="summary"><div>생존 시간<b>${U.fmtTime(G.t)}</b></div><div>레벨<b>${G.player.level}</b></div><div>처치<b>${G.stats.kills.toLocaleString()}</b></div><div>획득 골드<b>+${goldGain}</b></div><div>총 피해<b>${U.num(tot)}</b></div></div>
      ${this.buildSummary()}
      <table class="statTable"><tr><th>주문</th><th>피해량</th><th>DPS</th><th>비율</th></tr>
      ${rows.map(([s, v]) => { const [n, ic] = G.SOURCES[s] || [s, 'frostbolt']; return `<tr><td><img src="${G.icon(ic)}">${n}</td><td>${U.num(v)}</td><td>${U.num(v / dur)}</td><td>${(v / tot * 100).toFixed(1)}%</td></tr>`; }).join('')}</table>
      ${victory ? '<button class="btn" id="eEndless">무한 모드로 계속하기</button>' : ''}
      <button class="btn" id="eAgain">다시 도전</button><button class="btn" id="eMenu">메인 메뉴</button></div>`);
    $('eAgain').onclick = () => G.startRun();
    $('eMenu').onclick = () => { G.state = 'menu'; this.showMenu(); };
    if (victory) $('eEndless').onclick = () => { G.Waves.endless = true; G.state = 'play'; G.resume(); };
  },
};
