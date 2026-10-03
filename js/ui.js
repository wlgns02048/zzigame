'use strict';
// ================= HUD / 메뉴 =================
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

G.UI = {
  el: {}, slotEls: {}, autoEls: [], meterT: 0, warnT: 0, errT: 0, modalKind: null,

  init() {
    const ids = ['hud', 'pfLevel', 'pfHp', 'pfAbs', 'pfHpText', 'pfIcicle', 'pfIcicleText', 'buffs', 'timer', 'kills', 'goldTxt', 'bossFrame', 'bfIcon', 'bfName', 'bfPct', 'bfHp', 'bfCast',
      'raidWarn', 'castbar', 'autoBar', 'passiveBar', 'actionBar', 'xpBar', 'meter', 'meterRows', 'modal', 'tooltip', 'flash', 'streak'];
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
      d.innerHTML = `<img class="hidden"><div class="cd"></div><div class="cdt"></div><span class="key">${G.KEY_LABEL[k] || k}</span><span class="chg"></span><span class="ac">자동</span>`;
      ab.appendChild(d); this.slotEls[k] = d;
      // 왼쪽 클릭: 시전 · 오른쪽 클릭: 자동 시전 켜기/끄기
      d.addEventListener('mousedown', e => { e.stopPropagation(); if (e.button !== 0) return; const id = this.skillForKey(k); if (id) G.Skills.activate(id); });
      d.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); const id = this.skillForKey(k); if (id) { G.Skills.toggleAuto(id); this.showTip(this.skillTip(id), e); } });
    }
    // 툴팁 (위임)
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-tip]'), s = e.target.closest('[data-skill]'), it = e.target.closest('[data-item]');
      const itTip = it && G.Lobby.itemTipFor(it); // 가방 · 장비 칸 (안쪽 그림 위로 옮겨도 유지)
      if (s && s.dataset.skill) this.showTip(this.skillTip(s.dataset.skill), e);
      else if (itTip) this.showTip(itTip, e);
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
      return `<div class="tt-title">${G.skName(def)}</div><div class="tt-row"><span>능력치</span><span>등급 ${ps.rank}/${def.max}</span></div><div class="tt-desc">${def.desc(ps.total)}</div>`;
    }
    if (def.kind === 'legendary' || def.kind === 'evolution') {
      const c = def.kind === 'legendary' ? '#ff8000' : '#e6cc80';
      return `<div class="tt-title" style="color:${c}">${def.name}</div><div class="tt-row"><span>${def.kind === 'legendary' ? '전설 효과' : '진화'}</span></div><div class="tt-desc">${def.desc()}</div>`;
    }
    const sk = p.skills[id]; if (!sk) return '';
    const isFF = id === 'frostbolt' && p.evo && p.evo.frostfire;
    const ranks = (def.nodes || []).filter(n => sk.ranks[n.id]).map(n => `<span class="tt-green">${n.name} ${sk.ranks[n.id]}/${n.max}</span>`).join(' · ');
    return `<div class="tt-title" style="${isFF ? 'color:#e6cc80' : ''}">${isFF ? '서리불꽃 화살' : def.name}</div>
      <div class="tt-row"><span>${def.castInfo(sk.s)}</span><span>${p.skillLevel(id)}레벨</span></div>
      ${def.key ? `<div class="tt-row"><span>단축키: ${G.KEY_LABEL[def.key] || def.key}</span></div>` : ''}
      ${def.kind === 'active' ? `<div class="tt-sub">${def.noAuto ? '자동 시전할 수 없는 주문입니다.' : sk.autoCast ? `<span class="tt-green">자동 시전 중</span> · 재사용 대기시간 +${Math.round(G.Skills.autoPen() * 100)}% · 오른쪽 클릭으로 끄기` : `오른쪽 클릭: 자동 시전 (재사용 대기시간 +${Math.round(G.Skills.autoPen() * 100)}%)`}</div>` : ''}
      <div class="tt-desc">${def.tip(sk.s)}</div>${ranks ? `<div class="tt-sub">${ranks}</div>` : ''}`;
  },

  // ---------- 바 구성 ----------
  buildBars() {
    const p = G.player; if (!p) return;
    for (const k of G.ACTION_KEYS) {
      const d = this.slotEls[k], id = this.skillForKey(k), img = d.querySelector('img');
      if (id) { img.src = G.icon(G.SKILLS[id].icon); img.classList.remove('hidden'); d.classList.remove('empty'); }
      else {
        // 빈 칸: 이전 판(다른 직업)의 표시가 남지 않도록 상태 표시를 모두 지운다
        img.classList.add('hidden'); d.classList.add('empty');
        d.classList.remove('autocast', 'glow', 'active', 'unusable');
        const cd = d.querySelector('.cd'), t = d.querySelector('.cdt'), ch = d.querySelector('.chg');
        cd.style.setProperty('--p', 0); t.textContent = ''; ch.textContent = '';
      }
    }
    const ab = this.el.autoBar; ab.innerHTML = ''; this.autoEls = [];
    for (const id of p.order) {
      const def = G.SKILLS[id]; if (def.kind !== 'auto') continue;
      const d = document.createElement('div'); d.className = 'slot small'; d.dataset.skill = id;
      const icon = G.cls(p).skillIcon(id, p);
      d.innerHTML = `<img src="${G.icon(icon)}"><span class="lv">${p.skillLevel(id)}</span><span class="chg"></span>`;
      ab.appendChild(d); this.autoEls.push([id, d]);
    }
    for (let i = this.autoEls.length; i < G.LIMITS.auto; i++) { const d = document.createElement('div'); d.className = 'slot small empty'; ab.appendChild(d); }
    const pb = this.el.passiveBar; pb.innerHTML = '';
    const addP = (id, lv, cls = '') => { const d = document.createElement('div'); d.className = 'pslot ' + cls; d.dataset.skill = id; d.innerHTML = `<img src="${G.icon(G.skIcon(G.SKILLS[id]))}"><span class="lv">${lv}</span>`; pb.appendChild(d); };
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
      const rem = sk.cdT / hs * (sk.autoCast ? 1 + G.Skills.autoPen() : 1); txt = rem >= 1 ? Math.ceil(rem) : rem >= 0.05 ? rem.toFixed(1) : '';
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
    const C = G.cls(p), res = C.resource(p);
    el.pfIcicle.style.width = res ? (res.cur / res.max * 100) + '%' : '0%';
    el.pfIcicleText.textContent = res ? `${res.label} ${res.cur} / ${res.max}` : '';
    el.timer.textContent = U.fmtTime(G.t);
    el.kills.textContent = G.stats.kills.toLocaleString();
    el.goldTxt.textContent = Math.floor(G.stats.gold);
    // 연속 처치 (10 이상일 때): 숫자 + 이어지기까지 남은 시간 막대
    const S = G.Streak, on = S.alive() && S.n >= 10, sk = el.streak;
    sk.classList.toggle('show', on);
    if (on) {
      const txt = `${S.n} 연속 처치`;
      if (sk.firstChild.textContent !== txt) sk.firstChild.textContent = txt;
      sk.lastChild.style.width = ((1 - (G.t - S.lastT) / S.WINDOW) * 100).toFixed(1) + '%';
      if (this.streakPop) { this.streakPop = false; sk.classList.remove('pop'); void sk.offsetWidth; sk.classList.add('pop'); }
    }
    el.xpBar.firstElementChild.style.width = (p.xp / p.xpNeed * 100).toFixed(1) + '%';
    el.xpBar.lastElementChild.textContent = `레벨 ${p.level} · 경험치 ${Math.floor(p.xp)} / ${p.xpNeed}`;

    // 시전바
    const cb = el.castbar, cast = C.castbar(p);
    if (p.channel) {
      cb.classList.remove('hidden'); cb.classList.add('channel');
      const f = 1 - p.channel.t / p.channel.dur;
      cb.firstElementChild.style.width = (f * 100) + '%'; cb.querySelector('.spark').style.left = (f * 100) + '%';
      cb.querySelector('.name').textContent = p.channel.name; cb.querySelector('.time').textContent = (p.channel.dur - p.channel.t).toFixed(1);
    } else if (cast) {
      cb.classList.remove('hidden', 'channel');
      cb.firstElementChild.style.width = (cast.f * 100) + '%'; cb.querySelector('.spark').style.left = (cast.f * 100) + '%';
      cb.querySelector('.name').textContent = cast.name;
      cb.querySelector('.time').textContent = `${((1 - cast.f) * cast.total).toFixed(1)} / ${cast.total.toFixed(1)}`;
    } else cb.classList.add('hidden');

    // 액션바 쿨다운
    for (const k of G.ACTION_KEYS) {
      const id = this.skillForKey(k), d = this.slotEls[k];
      if (!id) continue;
      const sk = p.skills[id];
      this.setCd(d, sk);
      const impl = G.SKILL_IMPL[id];
      const ss = C.slotState(id, p, impl, sk);
      // 반드시 true/false로 넘긴다 (undefined면 toggle이 매 프레임 켜고 꺼서 깜빡인다)
      d.classList.toggle('unusable', !!((impl.usable && !impl.usable(sk)) || ss.unusable));
      d.classList.toggle('glow', !!ss.glow);
      d.classList.toggle('active', !!(p.channel && p.channel.id === id) || ss.active);
      d.classList.toggle('autocast', !!sk.autoCast);
    }
    // 자동 주문 칸은 재사용 대기 표시를 그리지 않는다 (재사용이 1~2초라 계속 깜빡임). 시전할 때 한 번 눌리는 것으로 보여준다.
    for (const [id, d] of this.autoEls) d.classList.toggle('glow', !!C.autoGlow(id, p));

    // 버프
    const buffs = C.buffs(p);
    if (p.rootT > 0) buffs.push([G.P.ROOT_FX[p.rootFx || 'shadow'].icon, p.rootT, '', p.rootName || '속박', '이동 불가', true]);
    if (G.lustT > 0) buffs.push(['bloodlust', G.lustT, '', '피의 욕망', `게임 전체 속도 +${Math.round((G.LUST.speed - 1) * 100)}%`]);
    const sb = G.Events.buff; if (sb) { const S = G.SHRINES[sb.type]; buffs.push([S.icon, sb.t, '', S.name, S.desc]); }
    // 오른쪽부터 지속시간이 긴 순서 (끝없는 버프가 맨 오른쪽). 순서 기준은 버프가 생길 때의 남은 시간으로 고정해,
    // 시간이 흐르거나 갱신돼도 자리가 바뀌지 않는다 → 자주 켜졌다 꺼지는 짧은 버프(해질녘 등)만 왼쪽 끝에서 한 칸 움직인다.
    // 칸은 버프마다 따로 두고 생기거나 사라진 칸만 넣고 뺀다 (통째로 다시 그리면 이미지가 깜빡임)
    if (this.buffSig !== 'keyed') { this.buffSig = 'keyed'; this.buffEls = new Map(); el.buffs.innerHTML = ''; }
    const seen = new Set();
    for (const b of buffs) {
      const id = b[0]; seen.add(id);
      let r = this.buffEls.get(id);
      if (!r) {
        const d = document.createElement('div');
        d.className = 'buff in' + (b[5] ? ' debuff' : '');
        d.dataset.tip = `<div class='tt-title'>${b[3]}</div><div class='tt-desc'>${b[4]}</div>`;
        d.innerHTML = `<img src="${G.icon(id)}"><div class="bs"></div><div class="bt"></div>`;
        r = { d, bs: d.querySelector('.bs'), bt: d.querySelector('.bt'), key: b[1] < 0 ? Infinity : b[1] };
        this.buffEls.set(id, r);
        const after = [...this.buffEls.values()].filter(o => o !== r && o.key >= r.key).length; // 나보다 긴 버프 개수 = 오른쪽에서 몇째
        el.buffs.insertBefore(d, el.buffs.children[after] || null);
      }
      const bt = b[1] < 0 ? '' : b[1] >= 60 ? Math.ceil(b[1] / 60) + '분' : Math.ceil(b[1]) + '초', bs = String(b[2]);
      if (r.bt.textContent !== bt) r.bt.textContent = bt;
      if (r.bs.textContent !== bs) r.bs.textContent = bs;
      r.d.classList.toggle('ending', b[1] >= 0 && b[1] < 3);
    }
    for (const [id, r] of this.buffEls) if (!seen.has(id)) { r.d.remove(); this.buffEls.delete(id); }

    // 보스/정예 프레임
    let tgt = G.Waves.boss && !G.Waves.boss.dead ? G.Waves.boss : null;
    if (!tgt) tgt = G.enemies.find(e => e.elite && U.d2(e.x, e.y, p.x, p.y) < 700 * 700) || null;
    if (tgt) {
      el.bossFrame.classList.remove('hidden');
      if (this.bfTgt !== tgt) { this.bfTgt = tgt; el.bfIcon.src = G.icon(tgt.def.icon); el.bfName.textContent = tgt.boss ? `${tgt.def.name} - ${tgt.def.title}` : `${tgt.affixes ? tgt.affixes.map(a => G.ELITE_AFFIXES[a].name).join(' ') + ' ' : ''}${tgt.def.name} (정예)`; }
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
  error(text) { if (G.autoCasting) return; this.el.err.textContent = text; this.el.err.style.opacity = 1; this.errT = 1.2; },
  hurtFlash() { const f = this.el.flash; f.style.transition = 'none'; f.style.opacity = G.Settings.get('flash') ? 1 : 0.5; requestAnimationFrame(() => { f.style.transition = 'opacity .4s'; f.style.opacity = 0; }); },
  flashReady(id) { const k = G.SKILLS[id].key, d = k && this.slotEls[k]; if (!d) return; d.classList.remove('flashready'); void d.offsetWidth; d.classList.add('flashready'); },
  pressed(id) {
    const k = G.SKILLS[id].key, a = !k && this.autoEls && this.autoEls.find(x => x[0] === id), d = k ? this.slotEls[k] : a && a[1];
    if (!d) return;
    d.classList.add('pressed'); setTimeout(() => d.classList.remove('pressed'), 120);
  },
  toggleMeter() { this.el.meter.classList.toggle('hidden'); this.meterT = 0; },

  // ---------- 모달 ----------
  open(kind, html) { document.body.classList.add('modal-open'); this.modalKind = kind; this.el.modal.innerHTML = html; this.el.modal.classList.remove('hidden'); this.hideTip(); },
  close() { document.body.classList.remove('modal-open'); this.modalKind = null; this.el.modal.classList.add('hidden'); this.el.modal.innerHTML = ''; this.hideTip(); },

  showMenu() { G.state = 'menu'; G.Lobby.show(); },

  // ---------- 계정 ----------
  showAuth() {
    this.open('auth', `<div class="panel authPanel"><h2>계정</h2>
      <div class="sub">아이디와 비밀번호만으로 가입합니다. 가입하면 지금까지 모은 골드와 강화가 계정으로 옮겨집니다.</div>
      <form id="authForm">
        <label>아이디<input id="aUser" name="username" maxlength="16" autocomplete="username" placeholder="2~16자 (한글/영문/숫자/_)"></label>
        <label>비밀번호<input id="aPw" name="password" type="password" maxlength="64" autocomplete="current-password" placeholder="4자 이상"></label>
        <div class="formErr" id="aErr"></div>
        <button class="btn" type="submit" id="aLogin">로그인</button>
        <button class="btn" type="button" id="aReg">회원가입</button>
      </form>
      <button class="btn" id="aBack">돌아가기</button></div>`);
    const submit = async register => {
      const u = $('aUser').value.trim(), pw = $('aPw').value;
      $('aErr').textContent = '';
      $('aLogin').disabled = $('aReg').disabled = true;
      try {
        if (register) await G.Net.register(u, pw); else await G.Net.login(u, pw);
        this.toast(register ? `환영합니다, ${u} 님!` : `${G.Net.user.username} 님, 다시 오신 걸 환영합니다.`);
        this.showMenu();
      } catch (e) {
        $('aErr').textContent = e.message;
        $('aLogin').disabled = $('aReg').disabled = false;
      }
    };
    $('authForm').onsubmit = e => { e.preventDefault(); submit(false); };
    $('aReg').onclick = () => submit(true);
    $('aBack').onclick = () => this.showMenu();
    $('aUser').focus();
  },

  // ---------- 건의사항 게시판 ----------
  board: { sort: 'new', items: [], more: false },
  async showBoard(reload = true) {
    const b = this.board, net = G.Net;
    if (reload) {
      try { const r = await net.api('GET', `/api/suggestions?sort=${b.sort}`); b.items = r.items; b.more = r.more; }
      catch (e) { this.toast(e.message); return; }
    }
    if (!['menu', 'board', 'lobby'].includes(this.modalKind)) return; // 불러오는 사이 다른 화면으로 이동함
    const STATUS = { open: '접수', planned: '반영 예정', done: '반영 완료', rejected: '보류' };
    const admin = net.user && net.user.admin;
    const item = s => `<div class="sgItem">
        <button class="vote ${s.voted ? 'on' : ''}" data-vote="${s.id}" ${net.user ? '' : 'disabled'} title="${net.user ? '추천' : '로그인하면 추천할 수 있습니다'}">▲<span>${s.votes}</span></button>
        <div class="sgMain">
          <div class="sgHead"><span class="st st-${s.status}">${STATUS[s.status] || s.status}</span><b class="sgTitle">${esc(s.title)}</b></div>
          <div class="sgMeta">${esc(s.author)} · ${new Date(s.created_at).toLocaleDateString('ko-KR')}
            ${admin ? `<select data-status="${s.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === s.status ? 'selected' : ''}>${v}</option>`).join('')}</select>` : ''}
            ${s.mine || admin ? `<a href="#" data-del="${s.id}">삭제</a>` : ''}</div>
          <div class="sgBody">${esc(s.body)}</div>
        </div></div>`;
    this.open('board', `<div class="panel boardPanel"><h2>건의사항 게시판</h2>
      <div class="sub">원하는 기능이나 개선점을 남겨 주세요. 공감하는 건의는 추천해 주세요.</div>
      ${net.user ? `<form id="sgForm" class="sgForm">
          <input id="sgTitle" maxlength="80" placeholder="제목">
          <textarea id="sgBody" maxlength="2000" rows="3" placeholder="내용 (어떤 점이 불편했는지, 어떻게 바뀌면 좋을지)"></textarea>
          <div class="formErr" id="sgErr"></div>
          <button class="btn small" type="submit">건의하기</button></form>`
        : `<div class="sgLogin">글을 쓰거나 추천하려면 <a href="#" id="sgLogin">로그인</a>하세요.</div>`}
      <div class="sgTabs"><a href="#" data-sort="new" class="${b.sort === 'new' ? 'on' : ''}">최신순</a><a href="#" data-sort="top" class="${b.sort === 'top' ? 'on' : ''}">추천순</a></div>
      <div class="sgList">${b.items.map(item).join('') || '<div class="sgEmpty">아직 건의사항이 없습니다. 첫 번째 의견을 남겨 주세요!</div>'}</div>
      ${b.more ? '<button class="btn small" id="sgMore">더 보기</button>' : ''}
      <button class="btn" id="sgBack">돌아가기</button></div>`);
    const root = this.el.modal;
    $('sgBack').onclick = () => G.Lobby.show('stage');
    if ($('sgLogin')) $('sgLogin').onclick = e => { e.preventDefault(); this.showAuth(); };
    root.querySelectorAll('[data-sort]').forEach(a => (a.onclick = e => { e.preventDefault(); b.sort = a.dataset.sort; this.showBoard(); }));
    root.querySelectorAll('.sgMain').forEach(el => (el.onclick = e => { if (!e.target.closest('a, select')) el.parentNode.classList.toggle('open'); }));
    if ($('sgMore')) $('sgMore').onclick = async () => {
      try { const r = await net.api('GET', `/api/suggestions?sort=${b.sort}&offset=${b.items.length}`); b.items = b.items.concat(r.items); b.more = r.more; this.showBoard(false); }
      catch (e) { this.toast(e.message); }
    };
    if ($('sgForm')) $('sgForm').onsubmit = async e => {
      e.preventDefault();
      const btn = e.target.querySelector('button'); btn.disabled = true;
      try {
        await net.api('POST', '/api/suggestions', { title: $('sgTitle').value, body: $('sgBody').value });
        b.sort = 'new'; this.toast('건의사항이 등록되었습니다. 감사합니다!'); this.showBoard();
      } catch (err) { $('sgErr').textContent = err.message; btn.disabled = false; }
    };
    root.querySelectorAll('[data-vote]').forEach(btn => (btn.onclick = async () => {
      try {
        const r = await net.api('POST', `/api/suggestions/${btn.dataset.vote}/vote`);
        const s = b.items.find(x => x.id === +btn.dataset.vote); s.votes = r.votes; s.voted = r.voted;
        btn.classList.toggle('on', r.voted); btn.querySelector('span').textContent = r.votes;
      } catch (e) { this.toast(e.message); }
    }));
    root.querySelectorAll('[data-del]').forEach(a => (a.onclick = async e => {
      e.preventDefault();
      if (!confirm('이 건의사항을 삭제할까요?')) return;
      try { await net.api('DELETE', `/api/suggestions/${a.dataset.del}`); this.showBoard(); } catch (err) { this.toast(err.message); }
    }));
    root.querySelectorAll('[data-status]').forEach(sel => (sel.onchange = async () => {
      try { await net.api('PATCH', `/api/suggestions/${sel.dataset.status}`, { status: sel.value }); this.showBoard(); } catch (e) { this.toast(e.message); }
    }));
  },

  toast(text) {
    let t = $('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; $('game').appendChild(t); }
    t.textContent = text; t.classList.add('show');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('show'), 2800);
  },

  showHelp() {
    // 판 중이면 그 직업, 아니면 로비에서 고른 직업의 단축키 주문
    const cls = (G.state === 'play' && G.player && G.player.cls) || (G.Lobby && G.Lobby.cls) || 'mage', C = G.CLASSES[cls];
    const actives = Object.values(G.SKILLS).filter(d => d.cls === cls && d.kind === 'active' && d.key).sort((a, b) => G.ACTION_KEYS.indexOf(a.key) - G.ACTION_KEYS.indexOf(b.key));
    const autos = Object.values(G.SKILLS).filter(d => d.cls === cls && d.kind === 'auto').map(d => d.name);
    const tips = {
      mage: '얼어붙은 적(빙결/겨울의 한기)은 얼음창에 3배 피해를 받고, 모든 냉기 주문의 치명타 확률이 높아집니다(산산조각). 보스는 빙결되지 않는 대신 8초에 한 번, 2초 동안 얼어붙은 것으로 간주됩니다. 얼음 방패는 치명적인 피해를 받으면 자동으로 발동합니다.',
      warlock: '부패 · 고통 · 생명력 착취 · 불안정한 고통 같은 지속 피해를 여러 적에게 걸고(적 발밑 고리와 머리 위 아이콘으로 표시), 어둠의 화살은 지속 피해가 많이 걸린 적에게 더 아픕니다. 고통이 만드는 영혼의 조각 3개 이상을 악의적인 환희(R)로 한 번에 터뜨리세요. 악마의 마법진(Space)은 처음엔 마법진을 그리고, 다시 누르면 그곳으로 돌아갑니다.',
      hunter: '고정 사격(이동 중에도 그대로)으로 집중을 모으고, 멈춰 서면 조준 사격을 겨눕니다(붉은 조준선). 조준 사격이 맞으면 정밀 사격이 붙어 다음 신비한 사격 · 일제 사격이 강해지고, 일제 사격이 3명 이상 맞히면 속임수 사격으로 다음 조준 사격 · 속사가 주변 적에게 튕깁니다. 독수리가 찍은 관측자의 징표(머리 위 독수리 아이콘)가 있는 적은 조준 사격에 더 아프고, 멀리 있는 적일수록 피해가 커집니다(저격 훈련). 거북의 상은 치명적인 피해를 받으면 자동으로 발동합니다.',
    };
    const keys = [['WASD / 방향키', '이동'], ['마우스 오른쪽 클릭', '그 지점으로 이동 (누르고 있으면 커서를 따라감)'], ['마우스', '조준 (단축키 주문 방향)'], ['자동 주문', autos.join(' · ')],
      ...actives.map(d => [G.KEY_LABEL[d.key] || d.key, d.name]), ['액션바 오른쪽 클릭', `자동 시전 켜기/끄기 (재사용 대기시간 +${Math.round(G.Skills.autoPen() * 100)}%, 달라란 도서관에서 줄일 수 있음)`], ['TAB', '피해 미터 (Details!)'], ['ESC', '일시 정지'], ['M', '소리 켜기/끄기'], ['N', '배경음악 켜기/끄기'],
      ['레벨업', '숫자 키 또는 클릭으로 선택']];
    this.open('help', `<div class="panel"><h2>조작법 · ${C.name}</h2><div class="helpGrid">${keys.map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join('')}</div>
      <p class="tt-sub" style="max-width:560px">단축키 주문은 레벨업에서 배워야 액션바에 나타납니다. ${tips[cls] || ''}</p>
      <button class="btn" id="hBack">돌아가기</button></div>`);
    $('hBack').onclick = () => (G.state === 'play' ? this.showPause() : this.showMenu());
  },
  // ---------- 설정 (연출 · 소리) ----------
  SETTINGS: [
    { k: 'sfx', type: 'range', name: '효과음 음량', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%', apply: v => { G.Audio.setSfx(v); G.Audio.play('gold'); } },
    { k: 'music', type: 'range', name: '배경음악 음량', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' },
    { k: 'shake', type: 'range', name: '화면 흔들림', min: 0, max: 1.5, step: 0.25, fmt: v => v ? Math.round(v * 100) + '%' : '끔' },
    { k: 'flash', type: 'check', name: '화면 번쩍임', desc: '큰 기술 · 보스 처치 때 화면이 잠깐 밝아짐' },
    { k: 'hitstop', type: 'check', name: '타격 멈춤', desc: '큰 타격 순간 아주 잠깐 멈칫함' },
    { k: 'light', type: 'check', name: '던전 조명', desc: '어두운 던전에서 빛이 닿는 곳만 밝게 (끄면 조금 가벼워짐)' },
  ],
  showSettings() {
    const S = G.Settings, row = o => o.type === 'range'
      ? `<label class="setRow"><span>${o.name}</span><input type="range" data-set="${o.k}" min="${o.min}" max="${o.max}" step="${o.step}" value="${S.get(o.k)}"><b data-val="${o.k}">${o.fmt(S.get(o.k))}</b></label>`
      : `<label class="setRow"><span>${o.name}${o.desc ? `<small>${o.desc}</small>` : ''}</span><input type="checkbox" data-set="${o.k}" ${S.get(o.k) ? 'checked' : ''}><b></b></label>`;
    this.open('settings', `<div class="panel setPanel"><h2>설정</h2><div class="sub">이 브라우저에 저장됩니다.</div>
      <div class="setList">${this.SETTINGS.map(row).join('')}</div><button class="btn" id="sBack">돌아가기</button></div>`);
    this.el.modal.querySelectorAll('[data-set]').forEach(inp => (inp.oninput = () => {
      const o = this.SETTINGS.find(x => x.k === inp.dataset.set), v = o.type === 'range' ? +inp.value : inp.checked;
      S.set(o.k, v);
      if (o.type === 'range') this.el.modal.querySelector(`[data-val="${o.k}"]`).textContent = o.fmt(v);
      if (o.apply) o.apply(v);
      if (o.k === 'shake' && v) G.fx.shake(10 * v); // 미리 보기
    }));
    $('sBack').onclick = () => (G.state === 'play' ? this.showPause() : this.showMenu());
  },

  showLevelUp(opts, title, sub) {
    const p = G.player;
    this.lvOpts = opts;
    const card = (o, i) => {
      const r = G.RARITY[o.rarity];
      return `<div class="card r${o.rarity}" style="--qc:${r.color};--d:${(0.08 + i * 0.13).toFixed(2)}s" data-i="${i}">
        <div class="chead"><img src="${G.icon(o.icon)}"><div><div class="cname">${o.name}</div><div class="ctype">${o.label}</div><div class="clv">${o.lv || ''}</div></div></div>
        ${o.nodeDesc ? `<div class="cnode">${o.nodeDesc}</div>` : ''}
        ${o.cast ? `<div class="tt-row" style="font-size:12px;margin-bottom:4px"><span>${o.cast}</span></div>` : ''}
        <div class="cdesc">${o.desc || ''}</div>
        <div class="cfoot"><span style="color:${r.color}">${r.name}${o.wasSealed ? ' · 봉인됨' : ''}</span><span>${o.key ? `단축키 ${G.KEY_LABEL[o.key] || o.key} · ` : ''}<span class="ckey">${i + 1}</span></span></div>
        ${o.type !== 'gold' && o.type !== 'heal' ? `<div class="cacts">${p.banishes > 0 ? `<a href="#" data-banish="${i}">추방 (${p.banishes})</a>` : ''}${G.Meta.lib('seal') ? `<a href="#" data-seal="${i}" class="${p.sealPick === i ? 'on' : ''}">봉인</a>` : ''}</div>` : ''}</div>`;
    };
    this.open('levelup', `<div><div class="lvTitle">${title}</div><div class="lvSub">${sub}</div>
      <div class="cards">${opts.map(card).join('')}</div>
      <div class="lvBtns"><button class="btn small" id="lvReroll" ${p.rerolls > 0 ? '' : 'disabled'}>다시 굴리기 (${p.rerolls})</button><button class="btn small" id="lvSkip">건너뛰기 (+10 골드)</button></div></div>`);
    this.el.modal.querySelectorAll('.card').forEach(c => (c.onclick = e => { if (!e.target.closest('.cacts')) G.pickUpgrade(+c.dataset.i); }));
    // 달라란 도서관: 추방(이 판에서 영구 제외) · 봉인(다음 선택까지 보관)
    this.el.modal.querySelectorAll('[data-banish]').forEach(a => (a.onclick = e => { e.preventDefault(); G.banishUpgrade(+a.dataset.banish); }));
    this.el.modal.querySelectorAll('[data-seal]').forEach(a => (a.onclick = e => { e.preventDefault(); p.sealPick = p.sealPick === +a.dataset.seal ? null : +a.dataset.seal; a.classList.toggle('on'); }));
    $('lvReroll').onclick = () => G.rerollUpgrade();
    $('lvSkip').onclick = () => G.pickUpgrade(-1);
    // 카드가 한 장씩 뒤집힐 때 소리 (희귀할수록 화려하게)
    if (!G.Bot.on) opts.forEach((o, i) => setTimeout(() => {
      if (this.modalKind === 'levelup' && this.lvOpts === opts) G.Audio.play(o.rarity >= 4 ? 'legend' : o.rarity >= 2 ? 'revealRare' : 'reveal');
    }, 80 + i * 130 + 120));
  },

  // 전리품 상자: 아이콘 릴이 돌다가 가장 좋은 보상에서 멈추고, 등급 색 빛기둥이 솟은 뒤 카드가 열린다 (클릭하면 건너뜀)
  showChest(opts, v, done) {
    if (this.noReel) { this.noReel = false; done(); return; }
    const best = opts.reduce((a, o) => (o.rarity > a.rarity ? o : a), opts[0]);
    const col = best.rarity >= 4 ? G.RARITY[best.rarity].color : best.rarity >= 2 ? G.RARITY[best.rarity].color : '#bfe4ff';
    const pool = Object.values(G.SKILLS).filter(d => d.cls === G.player.cls && d.icon).map(d => d.icon);
    const strip = Array.from({ length: 16 }, () => U.choice(pool)).concat(best.icon);
    this.open('chestopen', `<div class="chestOpen" style="--qc:${col}">
      <div class="lvTitle">${v >= 2 ? '보스 전리품' : '전리품 상자'}</div>
      <div class="reel"><div class="reelStrip">${strip.map(ic => `<img src="${G.icon(ic)}">`).join('')}</div></div>
      <div class="pillar"></div><div class="lvSub">클릭하면 바로 엽니다</div></div>`);
    let pending = true;
    const finish = () => { if (!pending || this.modalKind !== 'chestopen') return; pending = false; done(); };
    this.el.modal.onclick = () => { this.el.modal.onclick = null; finish(); };
    // 릴 소리: 점점 느려지는 딸깍 → 멈추면 상자 소리 (전설 이상이면 웅장하게)
    let t = 0;
    for (let i = 0; i < 12; i++) { t += 40 + i * i * 4; setTimeout(() => this.modalKind === 'chestopen' && G.Audio.play('tick', 0.5), t); }
    setTimeout(() => { if (this.modalKind !== 'chestopen') return; this.el.modal.querySelector('.chestOpen').classList.add('stop'); G.Audio.play(best.rarity >= 4 ? 'legend' : 'chest'); }, 1050);
    setTimeout(() => { this.el.modal.onclick = null; finish(); }, 1700);
  },

  // 보스 등장: 위아래 검은 띠 + 이름 카드
  bossIntro(def) {
    let b = $('bossIntro');
    if (!b) { b = document.createElement('div'); b.id = 'bossIntro'; this.el.hud.prepend(b); } // 맨 앞: 띠가 HUD 프레임 아래에 깔리도록
    b.innerHTML = `<div class="biBar top"></div><div class="biBar bot"></div><div class="biName"><small>${esc(def.title || '보스')}</small><b>${esc(def.name)}</b></div>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.biT); this.biT = setTimeout(() => b.classList.remove('show'), 2800);
  },

  buildSummary() {
    const p = G.player;
    const icons = p.order.map(id => `<div class="pslot" data-skill="${id}"><img src="${G.icon(G.cls(p).skillIcon(id, p))}"><span class="lv">${p.skillLevel(id)}</span></div>`)
      .concat(Object.keys(p.passives).map(id => `<div class="pslot" data-skill="${id}"><img src="${G.icon(G.skIcon(G.SKILLS[id]))}"><span class="lv">${p.passives[id].rank}</span></div>`))
      .concat(Object.keys(p.legend).concat(Object.keys(p.evo)).map(id => `<div class="pslot legend" data-skill="${id}"><img src="${G.icon(G.SKILLS[id].icon)}"></div>`));
    return `<div class="buildRow">${icons.join('')}</div>`;
  },

  showPause() {
    const st = G.player.stats;
    this.open('pause', `<div class="panel"><h2>일시 정지</h2>
      <div class="summary"><div>시간<b>${U.fmtTime(G.t)}</b></div><div>레벨<b>${G.player.level}</b></div><div>처치<b>${G.stats.kills}</b></div><div>주문력<b>${Math.round(st.dmg * 100)}%</b></div><div>가속<b>${Math.round(G.P.haste() * 100)}%</b></div><div>치명타<b>${Math.round(st.crit * 100)}%</b></div></div>
      ${this.buildSummary()}
      <button class="btn" id="pResume">계속하기</button><button class="btn" id="pHelp">조작법</button><button class="btn" id="pSet">설정</button><button class="btn" id="pQuit">포기하고 메인 메뉴로</button></div>`);
    $('pResume').onclick = () => G.resume();
    $('pHelp').onclick = () => this.showHelp();
    $('pSet').onclick = () => this.showSettings();
    $('pQuit').onclick = () => G.endRun(false);
  },

  // 서버 정산 결과 (재화 · 전리품) 표시
  setEndRewards(r, err) {
    const box = $('eRewards'); if (!box) return;
    if (err) { box.innerHTML = `<div class="err">${esc(err)}</div>`; return; }
    const I = G.ITEMS, gain = Object.entries(r.gain || {});
    box.innerHTML = (gain.length ? `<div class="eGain">${gain.map(([k, v]) => `<span><img class="ci" src="${G.icon(I.CURRENCIES[k].icon)}">+${v} ${I.CURRENCIES[k].name}</span>`).join('')}</div>` : '<div class="dim">새로 받은 재화가 없습니다.</div>') +
      (r.loot && r.loot.length ? `<div class="eLoot">${r.loot.map(it => `<div class="pull" style="--qc:${I.QUALITY[it.quality].color}" data-tip="${esc(G.Lobby.itemTip(it, G.runInfo && G.runInfo.cls))}"><img src="${G.icon(it.icon)}"><span>${esc(it.name)}</span><small>${it.ilvl}${it.autoDE ? ' · 가방 가득: 분해' : ''}</small></div>`).join('')}</div>` : '') +
      (r.endlessLv ? `<div class="dim">엔드리스 ${r.endlessLv}단계 도달</div>` : '');
  },

  showEnd(victory, mode) {
    const rows = Object.entries(G.meter.d).sort((a, b) => b[1] - a[1]);
    const tot = G.meter.total || 1, dur = Math.max(1, G.t), W = G.Waves, st = W.stage;
    const endless = W.endless, title = victory ? '스테이지 클리어!' : endless ? `엔드리스 ${W.level}단계에서 쓰러졌습니다` : '당신은 죽었습니다';
    this.open('end', `<div class="panel" style="max-height:92vh;overflow:auto">
      <h1 style="color:${victory ? '#ffd100' : '#ff4b3a'}">${title}</h1>
      <div class="sub">${st.name} · ${W.diff.name}${victory ? ' — 보상을 받고 끝내거나, 엔드리스로 계속 도전할 수 있습니다.' : ''}</div>
      <div class="summary"><div>시간<b>${U.fmtTime(G.t)}</b></div><div>레벨<b>${G.player.level}</b></div><div>처치<b>${G.stats.kills.toLocaleString()}</b></div><div>보스<b>${W.bossKills}</b></div><div>총 피해<b>${U.num(tot)}</b></div></div>
      <div id="eRewards" class="eRewards">${mode === 'account' ? '<div class="dim">정산 중…</div>' : '<div class="dim">게스트는 보상이 저장되지 않습니다. 로그인하면 골드 · 휘장 · 장비를 받을 수 있습니다.</div>'}</div>
      ${this.buildSummary()}
      <table class="statTable"><tr><th>주문</th><th>피해량</th><th>DPS</th><th>비율</th></tr>
      ${rows.map(([s, v]) => { const [n, ic] = G.SOURCES[s] || [s, 'frostbolt']; return `<tr><td><img src="${G.icon(ic)}">${n}</td><td>${U.num(v)}</td><td>${U.num(v / dur)}</td><td>${(v / tot * 100).toFixed(1)}%</td></tr>`; }).join('')}</table>
      ${victory ? '<button class="btn" id="eEndless">엔드리스로 계속하기</button><button class="btn" id="eLeave">보상 받고 종료</button>'
        : '<button class="btn" id="eAgain">다시 도전</button><button class="btn" id="eMenu">로비로</button>'}</div>`);
    if (victory) {
      $('eEndless').onclick = () => { W.startEndless(); G.state = 'play'; G.resume(); };
      $('eLeave').onclick = () => G.leaveRun();
    } else {
      $('eAgain').onclick = () => { const r = G.runInfo; G.startRun(r.cls, r.stage, r.diff); };
      $('eMenu').onclick = () => { G.state = 'menu'; this.showMenu(); };
    }
  },
};
