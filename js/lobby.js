'use strict';
// ================= 로비 (달라란) =================
// 출정 · 캐릭터(장비/가방) · 특성 · 상점(가챠) · 퀘스트 · 금고 · 랭킹 · 주문 도감 · 게시판 · 패치노트.
// 모든 변경은 서버 API를 거치고, 응답의 profile로 다시 그린다.
const IT = () => G.ITEMS, SD = () => G.STAGE_DATA;
const qcol = q => IT().QUALITY[q].color;
const fmtNum = n => Math.floor(n).toLocaleString();

G.Lobby = {
  tab: 'stage', codexCls: 'mage', cls: null, stage: 'deadmines', diff: 'normal', selItem: null, tree: null, pending: null,
  rank: { stage: '', difficulty: 'normal', kind: 'clear', scope: 'week', cls: '' }, bagSort: 'new',

  TABS: [
    ['stage', '출정', 'portal'], ['char', '캐릭터', 'bag'], ['talent', '특성', 'talents'], ['shop', '상점', 'gacha_equip'],
    ['quest', '퀘스트', 'quest'], ['vault', '위대한 금고', 'vault'], ['ranking', '랭킹', 'ranking'], ['codex', '주문 도감', 'scroll'], ['board', '게시판', 'board'], ['patch', '패치노트', 'library'],
    ['balance', '밸런스', 'ranking'], // 관리자만 (js/balance.js)
  ],
  tabs() { return this.TABS.filter(([id]) => id !== 'balance' || (G.Net.user && G.Net.user.admin)); },
  // 패치노트: 마지막으로 읽은 버전을 브라우저에 기억해 두고, 새 패치가 있으면 탭에 NEW 표시
  PATCH_SEEN: 'frostmage_patch_seen',
  patchUnseen() { let s = null; try { s = localStorage.getItem(this.PATCH_SEEN); } catch { /* 저장소 사용 불가 */ } return !!G.PATCH_NOTES.length && s !== G.PATCH_NOTES[0].v; },
  needLogin: ['char', 'talent', 'shop', 'quest', 'vault'],

  pr() { return G.Meta.profile; },
  chars() { return this.pr() ? this.pr().characters : ['mage']; },
  curCls() { const cs = this.chars(); if (!cs.includes(this.cls)) this.cls = cs[0]; return this.cls; },

  show(tab) {
    G.Update.apply(); // 로비로 돌아오거나 탭을 옮길 때 새 버전이 있으면 적용 (새로고침)
    if (tab) this.tab = tab;
    if (!this.tabs().some(([id]) => id === this.tab)) this.tab = 'stage';
    G.UI.el.hud.classList.add('hidden');
    G.UI.open('lobby', `<div class="lobby">
      <div class="lbTop">
        <div class="lbLogo">얼음왕관의 시련<span class="beta" title="v${G.VERSION}">BETA</span><small>달라란 · v${G.VERSION}</small></div>
        <div class="lbCur">${this.currencyBar()}</div>
        <div class="lbAcct">${this.account()}</div>
      </div>
      <div class="lbBody">
        <nav class="lbNav">${this.tabs().map(([id, name, icon]) => `<a href="#" data-tab="${id}" class="${this.tab === id ? 'on' : ''}"><img src="${G.icon(icon)}"><span>${name}</span>${id === 'patch' && this.tab !== 'patch' && this.patchUnseen() ? '<em class="newTag">NEW</em>' : ''}</a>`).join('')}
          <a href="#" data-help="1"><img src="${G.icon('reroll')}"><span>조작법</span></a>
          <a href="#" data-settings="1"><img src="${G.icon('scroll')}"><span>설정</span></a></nav>
        <main class="lbMain" id="lbMain"></main>
      </div></div>`);
    const root = G.UI.el.modal;
    root.querySelectorAll('[data-tab]').forEach(a => (a.onclick = e => { e.preventDefault(); this.show(a.dataset.tab); }));
    root.querySelector('[data-help]').onclick = e => { e.preventDefault(); G.UI.showHelp(); };
    root.querySelector('[data-settings]').onclick = e => { e.preventDefault(); G.UI.showSettings(); };
    const lo = $('lbLogin'), lg = $('lbLogout');
    if (lo) lo.onclick = () => G.UI.showAuth();
    if (lg) lg.onclick = async () => { await G.Net.logout(); G.UI.toast('로그아웃했습니다.'); this.show('stage'); };
    this.render();
  },
  render() {
    const m = $('lbMain'); if (!m) return;
    if (this.needLogin.includes(this.tab) && G.Meta.mode() !== 'account') {
      m.innerHTML = `<div class="lbEmpty"><img src="${G.icon('portal')}"><p>${G.Net.online ? '이 기능은 로그인해야 사용할 수 있습니다.<br>계정은 아이디와 비밀번호만으로 만들 수 있습니다.' : '서버에 연결되지 않아 사용할 수 없습니다.'}</p>${G.Net.online ? '<button class="btn" id="lbNeedLogin">로그인 / 회원가입</button>' : ''}</div>`;
      if ($('lbNeedLogin')) $('lbNeedLogin').onclick = () => G.UI.showAuth();
      return;
    }
    if (this.tab === 'board') { G.UI.showBoard(); return; }
    if (this.tab === 'balance') { G.Balance.render(m); return; }
    this[{ stage: 'renderStage', char: 'renderChar', talent: 'renderTalent', shop: 'renderShop', quest: 'renderQuest', vault: 'renderVault', ranking: 'renderRanking', codex: 'renderCodex', patch: 'renderPatch' }[this.tab]](m);
  },
  refreshTop() { const c = G.UI.el.modal.querySelector('.lbCur'); if (c) c.innerHTML = this.currencyBar(); },
  currencyBar() {
    if (G.Meta.mode() !== 'account') return '';
    return Object.entries(IT().CURRENCIES).map(([k, c]) => `<span data-tip="<div class='tt-title'>${c.name}</div>${c.desc ? `<div class='tt-desc'>${c.desc}</div>` : ''}"><img src="${G.icon(c.icon)}">${fmtNum(G.Meta.wallet(k))}</span>`).join('');
  },
  account() {
    if (!G.Net.online) return '<span class="dim">오프라인</span>';
    return G.Net.user ? `<b>${esc(G.Net.user.username)}</b> <button class="btn small" id="lbLogout">로그아웃</button>`
      : `<span class="dim">게스트</span> <button class="btn small" id="lbLogin">로그인 / 회원가입</button>`;
  },
  // 서버 호출 공통: 실패 시 토스트, 성공 시 다시 그리기
  async act(fn, okMsg) {
    try { const r = await fn(); if (r && r.profile) G.Meta.useProfile(r.profile); if (okMsg) G.UI.toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); this.refreshTop(); this.render(); return r; }
    catch (e) { G.UI.toast(e.message); return null; }
  },
  api(method, url, body) { return G.Net.api(method, url, body); },

  // ===================== 출정 =====================
  stageOpen(id, diff = 'normal') {
    if (G.Meta.mode() !== 'account') return diff === 'normal' && (id === 'deadmines' || id === 'icecrown');
    const pr = this.pr().progress, prev = SD().prevStage(id);
    const cleared = (s, d) => !!(pr[s] && pr[s][d] && pr[s][d].clears);
    if (prev && !cleared(prev, 'normal')) return false;
    if (diff === 'heroic' && !cleared(id, 'normal')) return false;
    return true;
  },
  renderStage(m) {
    const S = SD().STAGES, cls = this.curCls(), st = S[this.stage], pr = this.pr() ? this.pr().progress : {};
    if (!this.stageOpen(this.stage, this.diff)) this.diff = 'normal';
    const prog = d => (pr[this.stage] && pr[this.stage][d]) || null;
    const chapters = SD().CHAPTERS.map(ch => `<div class="chap"><h3>${ch.name}<small>${ch.desc}</small></h3><div class="stageList">${
      Object.values(S).filter(s => s.chapter === ch.id).sort((a, b) => a.order - b.order).map(s => {
        const open = this.stageOpen(s.id), pn = pr[s.id] && pr[s.id].normal, ph = pr[s.id] && pr[s.id].heroic;
        return `<div class="stageCard ${this.stage === s.id ? 'on' : ''} ${open ? '' : 'locked'}" data-stage="${s.id}">
          <img src="${G.icon(s.icon)}"><div><b>${s.name}</b><small>${s.type === 'raid' ? '공격대' : '던전'} · 권장 ${s.ilvl}</small>
          <span class="marks">${pn ? '<i class="ok">일반</i>' : ''}${ph ? '<i class="hc">영웅</i>' : ''}${open ? '' : '<i>잠김</i>'}</span></div></div>`;
      }).join('')}</div></div>`).join('');
    const df = SD().DIFFICULTY, aff = (this.pr() && this.pr().affixes) || SD().weeklyAffixes(IT().periodKeys().weekly), E = SD().ENDLESS;
    const p = prog(this.diff);
    const chars = Object.values(G.CLASSES).map(C => {
      const have = this.chars().includes(C.id);
      return `<div class="clsPick ${cls === C.id ? 'on' : ''} ${have ? '' : 'new'}" data-cls="${C.id}" style="--cc:${C.color}"><img src="${G.icon(C.icon)}"><b>${C.name}</b>
        <small>${have ? (G.Meta.mode() === 'account' ? `아이템 레벨 ${G.Meta.avgIlvl(C.id)}` : '') : (G.Meta.mode() === 'account' ? '캐릭터 만들기' : '로그인 필요')}</small></div>`;
    }).join('');
    m.innerHTML = `<div class="stageWrap"><div class="stageCol">${chapters}</div>
      <div class="stageDetail">
        <div class="sdHead"><img src="${G.icon(st.icon)}"><div><h2>${st.name}</h2><div class="dim">${st.type === 'raid' ? '공격대' : '던전'} · ${Math.round(st.duration / 60)}분 · 권장 아이템 레벨 ${st.ilvl + df[this.diff].ilvl}</div></div></div>
        <p class="sdDesc">${st.desc}</p>
        <div class="diffs">${Object.entries(df).map(([k, d]) => `<button class="btn small ${this.diff === k ? 'sel' : ''}" data-diff="${k}" ${this.stageOpen(this.stage, k) ? '' : 'disabled'}>${d.name}</button>`).join('')}</div>
        <div class="bossRow">${st.bosses.map(b => `<div class="boss" data-tip="<div class='tt-title'>${G.ENEMIES[b.id].name}</div><div class='tt-desc'>${G.ENEMIES[b.id].title || ''}</div>"><img src="${G.icon(G.ENEMIES[b.id].icon)}"><small>${G.ENEMIES[b.id].name}</small></div>`).join('')}</div>
        <div class="sdRec">${p ? `클리어 ${p.clears}회 · 최고 기록 <b>${U.fmtTime(p.best)}</b>${p.endless ? ` · 엔드리스 최고 <b>${p.endless}단계</b>` : ''}` : '아직 클리어하지 못했습니다.'}</div>
        <div class="sdRew">보상 배율: 골드 <b>×${SD().goldMul(this.stage, this.diff)}</b> · 정의의 휘장 <b>×${df[this.diff].badge}</b>${this.diff === 'heroic' ? ' · 아이템 레벨 +' + df.heroic.ilvl + ' · 높은 품질 · 클리어 상자 +1' : ''}</div>
        <div class="sdLoot"><h4>주요 전리품</h4>${st.loot.map(l => `<span style="color:${qcol(3)}">${l.name}</span>`).join(' · ')}</div>
        <div class="sdAffix"><h4>이번 주 엔드리스 접두어</h4>${aff.map((a, i) => `<span data-tip="<div class='tt-title'>${E.affixes[a].name}</div><div class='tt-desc'>${E.affixes[a].desc}</div>"><img src="${G.icon(E.affixes[a].icon)}">${E.affixes[a].name}<small>${E.slots[i].at}단계~</small></span>`).join('')}</div>
        <h4>캐릭터</h4><div class="clsRow">${chars}</div>
        <button class="btn big" id="sdGo" ${this.stageOpen(this.stage, this.diff) && this.chars().includes(cls) ? '' : 'disabled'}>출정</button>
        ${G.Meta.mode() !== 'account' ? '<div class="dim center">게스트는 죽음의 폐광과 얼음왕관의 시련(일반)만 플레이할 수 있고, 보상이 저장되지 않습니다.</div>' : ''}
      </div></div>`;
    m.querySelectorAll('[data-stage]').forEach(el => (el.onclick = () => { this.stage = el.dataset.stage; this.render(); }));
    m.querySelectorAll('[data-diff]').forEach(el => (el.onclick = () => { this.diff = el.dataset.diff; this.render(); }));
    m.querySelectorAll('[data-cls]').forEach(el => (el.onclick = async () => {
      const id = el.dataset.cls;
      if (!this.chars().includes(id)) {
        if (G.Meta.mode() !== 'account') return G.UI.showAuth();
        if (!confirm(`${G.CLASSES[id].name} 캐릭터를 만들까요?`)) return;
        await this.act(() => this.api('POST', '/api/characters', { cls: id }), `${G.CLASSES[id].name} 캐릭터를 만들었습니다.`);
      }
      this.cls = id; this.render();
    }));
    $('sdGo').onclick = () => { G.Audio.init(); G.startRun(cls, this.stage, this.diff); };
  },

  // ===================== 캐릭터 · 장비 · 가방 =====================
  statSheet(cls) {
    const st = { dmg: 1, haste: 0, crit: 0.08, critMul: 2, area: 1, dur: 1, proj: 0, hpMul: 1, hpFlat: 0, regen: 0.5, pickupMul: 1, luck: 0, armor: 0, movePenalty: 0.15, fof: 0, bf: 0, shatterCrit: 0.35, speedMul: 1, xpMul: 1, mastery: 0, vers: 0, dotMul: 1, dotLeech: 0, dotHaste: 0, nightfall: 0, shardMax: 0 };
    G.Meta.applyLoadout(st, cls);
    return st;
  },
  renderChar(m) {
    const cls = this.curCls(), C = G.CLASSES[cls], eq = G.Meta.equipped(cls), I = IT();
    const { tot } = G.Meta.gearTotals(cls), st = this.statSheet(cls), prim = G.Meta.primary(cls), specs = I.specsOf(cls), gear = I.CLASS_GEAR[cls];
    const armorSpec = G.Meta.armorSpec(cls);
    const slot = e => {
      const it = eq[e.id];
      return `<div class="eqSlot ${this.selItem === (it && it.id) ? 'sel' : ''}" data-eq="${e.id}" ${it ? `data-item="${it.id}"` : ''} style="--qc:${it ? qcol(it.quality) : '#333'}">
        <img src="${G.icon(it ? it.icon : 'empty_slot')}" class="${it ? '' : 'emptyImg'}"><div><small>${e.name}</small>${it ? `<b style="color:${qcol(it.quality)}">${esc(it.name)}</b><i>${it.ilvl}</i>` : '<i class="dim">비어 있음</i>'}</div></div>`;
    };
    const half = Math.ceil(I.EQUIP.length / 2);
    const bag = this.pr().items.filter(i => !i.equip);
    const sorted = bag.slice().sort(this.bagSort === 'ilvl' ? (a, b) => b.ilvl - a.ilvl || b.quality - a.quality : this.bagSort === 'quality' ? (a, b) => b.quality - a.quality || b.ilvl - a.ilvl : (a, b) => b.id - a.id);
    const stacks = this.pr().stacks;
    const pct = v => (v * 100).toFixed(1) + '%';
    m.innerHTML = `<div class="charWrap">
      <div class="charHead">${this.chars().map(c => `<a href="#" data-cls="${c}" class="${c === cls ? 'on' : ''}" style="--cc:${G.CLASSES[c].color}"><img src="${G.icon(G.CLASSES[c].icon)}">${G.CLASSES[c].name}</a>`).join('')}
        <span class="dim">평균 아이템 레벨 <b>${G.Meta.avgIlvl(cls)}</b></span>
        ${specs.length > 1 ? `<span class="specPick">전문화 ${specs.map(sp => `<button class="btn small ${G.Meta.spec(cls) === sp ? 'sel' : ''}" data-spec="${sp}">${I.SPECS[sp].name} (${I.STATS[I.SPECS[sp].primary].name})</button>`).join('')}</span>` : ''}</div>
      <div class="charBody">
        <div class="paper"><div class="eqCol">${I.EQUIP.slice(0, half).map(slot).join('')}</div><div class="eqCol">${I.EQUIP.slice(half).map(slot).join('')}</div></div>
        <div class="statBox"><h4>능력치</h4>
          <div class="stl"><span>${I.STATS[prim].name}</span><b>${fmtNum(Math.round(((tot[prim] || 0) + (tot.main || 0)) * (armorSpec ? 1.05 : 1)))}</b></div><div class="stl"><span>체력</span><b>${fmtNum(tot.sta || 0)}</b></div>
          <div class="stl"><span>치명타</span><b>${fmtNum(tot.crit || 0)}</b></div><div class="stl"><span>가속</span><b>${fmtNum(tot.haste || 0)}</b></div>
          <div class="stl"><span>특화</span><b>${fmtNum(tot.mastery || 0)}</b></div><div class="stl"><span>유연성</span><b>${fmtNum(tot.vers || 0)}</b></div>
          <h4>판 시작 시</h4>
          <div class="stl"><span>${prim === 'int' ? '주문력' : '공격력'}</span><b>${pct(st.dmg - 1)}</b></div><div class="stl"><span>최대 생명력</span><b>${Math.round(150 * st.hpMul + st.hpFlat)}</b></div>
          <div class="stl"><span>치명타 확률</span><b>${pct(st.crit)}</b></div><div class="stl"><span>치명타 피해</span><b>${Math.round(st.critMul * 100)}%</b></div>
          <div class="stl"><span>가속</span><b>${pct(st.haste)}</b></div><div class="stl"><span>특화</span><b>${st.mastery.toFixed(1)}점</b></div>
          <div class="stl"><span>유연성</span><b>${pct(st.vers)}</b></div><div class="stl"><span>받는 피해 감소</span><b>${pct(Math.min(0.6, st.armor))}</b></div>
          <div class="dim small">${C.masteryText || ''}<br>2차 능력치는 30%를 넘으면 효율이 줄어듭니다.<br>
            주 능력치: <b>${I.STATS[prim].name}</b> (${I.SPECS[G.Meta.spec(cls)].name} 전문화) · 다른 주 능력치는 적용되지 않습니다.<br>
            착용: ${I.ARMOR[gear.armor].name} 이하 방어구${gear.dual ? ' · 쌍수 가능' : ''} ·
            <span class="${armorSpec ? 'tt-green' : ''}">방어구 전문화 ${armorSpec ? '활성' : '비활성'}</span> (방어구 8부위를 모두 ${I.ARMOR[gear.armor].name}으로: 주 능력치 +5%)</div>
          <h4>소모품</h4><div class="stacks">${Object.entries(stacks.gem || {}).map(([g, n]) => `<span class="stk" data-tip="${esc(this.gemTip(g))}" style="--qc:${qcol(I.GEMS[g].quality)}"><img src="${G.icon(I.GEMS[g].icon)}"><i>${n}</i></span>`).join('')}
            ${Object.entries(stacks.enchant || {}).map(([e, n]) => `<span class="stk" data-tip="${esc(this.enchTip(e))}" style="--qc:${qcol(I.ENCHANTS[e].quality)}"><img src="${G.icon(I.ENCHANTS[e].slots.some(s => I.SLOT[s].weapon) ? 'enchant_weapon' : 'enchant')}"><i>${n}</i></span>`).join('') || '<span class="dim">보석 · 마법부여서가 없습니다</span>'}</div>
        </div>
        <div class="bagBox"><h4>가방 <span class="dim">${bag.length} / ${I.BAG_SIZE}</span>
          <select id="bagSort"><option value="new">최근</option><option value="ilvl">아이템 레벨</option><option value="quality">품질</option></select>
          <button class="btn small" id="bagDE">일괄 분해</button></h4>
          <div class="bagGrid">${sorted.map(it => `<div class="bagItem ${this.selItem === it.id ? 'sel' : ''} ${I.canUse(cls, it) ? '' : 'noUse'}" data-item="${it.id}" style="--qc:${qcol(it.quality)}"><img src="${G.icon(it.icon)}"><i>${it.ilvl}</i>${it.locked ? '<u>🔒</u>' : ''}</div>`).join('')}
            ${Array(Math.max(0, I.BAG_SIZE - bag.length)).fill('<div class="bagItem empty"></div>').join('')}</div>
          <div id="itemPanel" class="itemPanel">${this.itemPanel(cls)}</div>
        </div>
      </div></div>`;
    $('bagSort').value = this.bagSort;
    $('bagSort').onchange = e => { this.bagSort = e.target.value; this.render(); };
    m.querySelectorAll('.charHead [data-cls]').forEach(a => (a.onclick = e => { e.preventDefault(); this.cls = a.dataset.cls; this.selItem = null; this.render(); }));
    // 툴팁은 ui.js의 mouseover 위임이 itemTipFor로 띄운다
    m.querySelectorAll('[data-item]').forEach(el => (el.onclick = () => { this.selItem = +el.dataset.item; this.render(); }));
    $('bagDE').onclick = () => this.bulkDE(cls);
    m.querySelectorAll('[data-spec]').forEach(b => (b.onclick = () => this.act(() => this.api('POST', '/api/characters/spec', { cls, spec: b.dataset.spec }), `${I.SPECS[b.dataset.spec].name} 전문화로 바꿨습니다.`)));
    this.bindItemPanel(cls);
  },
  findItem(id) { return this.pr().items.find(i => i.id === id); },
  itemTipFor(el) { const it = this.pr() && this.findItem(+el.dataset.item); return it ? this.itemTip(it, this.curCls()) : ''; },
  itemPanel(cls) {
    const it = this.selItem && this.findItem(this.selItem);
    if (!it) return '<div class="dim">아이템을 선택하세요. 마우스를 올리면 착용 중인 장비와 비교합니다.</div>';
    const I = IT(), stacks = this.pr().stacks;
    const targets = I.EQUIP.filter(e => I.canEquipFor(cls, e.id, it));
    const gems = Object.keys(stacks.gem || {});
    const ench = Object.keys(stacks.enchant || {}).filter(e => I.canEnchant(it.slot, e));
    return `<div class="ipHead" style="color:${qcol(it.quality)}"><img src="${G.icon(it.icon)}"> ${esc(it.name)} <span class="dim">${it.ilvl}</span></div>
      <div class="ipBtns">
        ${it.equip ? `<button class="btn small" data-act="unequip">해제</button>` : targets.length ? targets.map(t => `<button class="btn small" data-act="equip" data-slot="${t.id}">${t.name}에 착용</button>`).join('') : `<span class="tt-red">${G.CLASSES[cls].className}은(는) 착용할 수 없습니다</span>`}
        <button class="btn small" data-act="lock">${it.locked ? '잠금 해제' : '잠금'}</button>
        ${it.equip ? '' : `<button class="btn small" data-act="sell" ${it.locked ? 'disabled' : ''}>판매 (${I.sellPrice(it)}골드)</button>
        <button class="btn small" data-act="de" ${it.locked ? 'disabled' : ''}>분해</button>`}
      </div>
      ${it.sockets.length ? `<div class="ipRow"><b>보석</b>${it.sockets.map((s, i) => `<select data-socket="${i}"><option value="">${it.gems[i] ? I.GEMS[it.gems[i]].name : (s === 'meta' ? '빈 얼개 홈' : '빈 보석 홈')}</option>
        ${gems.filter(g => I.canSocket(s, g)).map(g => `<option value="${g}">${I.GEMS[g].name} (${stacks.gem[g]})</option>`).join('')}</select>`).join('')}</div>` : ''}
      <div class="ipRow"><b>마법부여</b><select data-ench=""><option value="">${it.enchant ? I.ENCHANTS[it.enchant].name : '없음'}</option>
        ${ench.map(e => `<option value="${e}">${I.ENCHANTS[e].name} (${stacks.enchant[e]})</option>`).join('')}</select></div>
      <div class="dim small">보석이나 마법부여를 덮어쓰면 이전 것은 사라집니다.</div>`;
  },
  bindItemPanel(cls) {
    const it = this.selItem && this.findItem(this.selItem); if (!it) return;
    const box = $('itemPanel');
    box.querySelectorAll('[data-act]').forEach(b => (b.onclick = async () => {
      const a = b.dataset.act;
      if (a === 'equip') await this.act(() => this.api('POST', '/api/items/equip', { itemId: it.id, cls, slot: b.dataset.slot }));
      else if (a === 'unequip') await this.act(() => this.api('POST', '/api/items/unequip', { cls: it.equip.cls, slot: it.equip.slot }));
      else if (a === 'lock') await this.act(() => this.api('POST', '/api/items/lock', { itemId: it.id, locked: !it.locked }));
      else if (a === 'sell') { this.selItem = null; await this.act(() => this.api('POST', '/api/items/sell', { ids: [it.id] }), r => `${this.gotText(r.got)} 획득`); }
      else if (a === 'de') { this.selItem = null; await this.act(() => this.api('POST', '/api/items/disenchant', { ids: [it.id] }), r => `분해: ${this.gotText(r.got)}`); }
    }));
    box.querySelectorAll('[data-socket]').forEach(sel => (sel.onchange = () => sel.value && this.act(() => this.api('POST', '/api/items/socket', { itemId: it.id, index: +sel.dataset.socket, gemId: sel.value }), '보석을 박았습니다.')));
    box.querySelectorAll('[data-ench]').forEach(sel => (sel.onchange = () => sel.value && this.act(() => this.api('POST', '/api/items/enchant', { itemId: it.id, enchantId: sel.value }), '마법부여했습니다.')));
  },
  bulkDE(cls) {
    const q = prompt('이 품질 이하의 잠기지 않은 가방 아이템을 모두 분해합니다.\n0 일반 · 1 고급 · 2 희귀 · 3 영웅\n뒤에 x를 붙이면 내 캐릭터 누구도 착용할 수 없는 것만 (예: 3x)', '1');
    if (q === null) return;
    const onlyNoUse = /x/i.test(q), lv = parseInt(q), I = IT(), mine = this.chars();
    if (!(lv >= 0)) return;
    const ids = this.pr().items.filter(i => !i.equip && !i.locked && i.quality <= lv && (!onlyNoUse || !mine.some(c => I.canUse(c, i)))).map(i => i.id).slice(0, 100);
    if (!ids.length) return G.UI.toast('분해할 아이템이 없습니다.');
    if (!confirm(`${ids.length}개를 분해할까요?`)) return;
    this.selItem = null;
    this.act(() => this.api('POST', '/api/items/disenchant', { ids }), r => `분해: ${this.gotText(r.got)}`);
  },
  gotText(got) { return Object.entries(got).map(([k, v]) => `${IT().CURRENCIES[k].name} ${v}`).join(', '); },

  // ---------- 툴팁 ----------
  // 주 능력치는 지금 전문화가 쓰는 것만 흰색, 나머지는 회색 (한밤 방식)
  statLines(t, prim) {
    const I = IT(), S = I.STATS;
    const order = prim ? [prim].concat(I.PRIMARY.filter(k => k !== prim)) : I.PRIMARY;
    return order.concat(['main', 'sta']).filter(k => t[k]).map(k => `<div class="${prim && I.PRIMARY.includes(k) && k !== prim ? 'tt-off' : ''}">+${t[k]} ${S[k].name}</div>`).join('') +
      I.SECONDARY.filter(k => t[k]).map(k => `<div class="tt-green">+${t[k]} ${S[k].name}</div>`).join('');
  },
  itemTip(it, cls) {
    if (!it) return '';
    const I = IT(), prim = cls && G.Meta.primary(cls), use = !cls || I.canUse(cls, it), type = I.typeName(it);
    const where = I.SLOT[it.slot].weapon ? I.handName(it) : I.SLOT[it.slot].name;
    let h = `<div class="tt-title" style="color:${qcol(it.quality)}">${esc(it.name)}</div><div class="tt-gold">아이템 레벨 ${it.ilvl} · ${I.QUALITY[it.quality].name}</div>
      <div class="tt-row"><span>${where}</span><span class="${use ? '' : 'tt-red'}">${type}</span></div>${this.statLines(it.stats, prim)}`;
    if (!use) h += `<div class="tt-red">${G.CLASSES[cls].className}은(는) 착용할 수 없습니다</div>`;
    if (it.effect) h += `<div class="tt-green">사용 효과 없음 · 착용 효과: ${this.effText(it)}</div>`;
    it.sockets.forEach((s, i) => { const g = it.gems[i] && I.GEMS[it.gems[i]]; h += `<div class="${g ? '' : 'dim'}">◆ ${g ? `${g.name} (${this.statText(g.stats)})${g.effectText ? ' · ' + g.effectText : ''}` : s === 'meta' ? '얼개 보석 홈' : '보석 홈'}</div>`; });
    if (it.enchant) { const e = I.ENCHANTS[it.enchant]; h += `<div class="tt-green">마법부여: ${e.name} (${this.statText(e.stats)}${e.effectText ? ', ' + e.effectText : ''})</div>`; }
    h += `<div class="dim">판매 가격: ${I.sellPrice(it)} 골드</div>`;
    // 비교
    if (!it.equip && cls) {
      const eq = G.Meta.equipped(cls), slots = I.EQUIP.filter(e => e.accepts.includes(it.slot)).map(e => eq[e.id]).filter(Boolean);
      for (const cur of slots) {
        const a = I.itemTotals(it), b = I.itemTotals(cur), keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
        h += `<div class="tt-cmp"><div class="dim">착용 중: <span style="color:${qcol(cur.quality)}">${esc(cur.name)}</span> (${cur.ilvl})</div>${keys.map(k => { const d = (a[k] || 0) - (b[k] || 0); return d ? `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d} ${I.STATS[k].short}</span>` : ''; }).join(' ')}</div>`;
      }
    }
    return h;
  },
  effText(it) { const L = IT().LEGENDARIES.concat(IT().VAULT_ITEMS).find(l => l.name === it.name); return L ? L.effectText : Object.entries(it.effect).map(([k, v]) => `${k} +${v}`).join(', '); },
  statText(st) { return Object.entries(st).map(([k, v]) => `${IT().STATS[k].short} +${v}`).join(', '); },
  gemTip(g) { const G2 = IT().GEMS[g]; return `<div class='tt-title' style='color:${qcol(G2.quality)}'>${G2.name}</div><div>${this.statText(G2.stats)}</div>${G2.effectText ? `<div class='tt-green'>${G2.effectText}</div>` : ''}<div class='dim'>${G2.color === 'meta' ? '머리 얼개 홈 전용' : '보석 홈'}</div>`; },
  enchTip(e) { const E = IT().ENCHANTS[e]; return `<div class='tt-title' style='color:${qcol(E.quality)}'>${E.name}</div><div>${this.statText(E.stats)}</div>${E.effectText ? `<div class='tt-green'>${E.effectText}</div>` : ''}<div class='dim'>부위: ${E.slots.map(s => IT().SLOT[s].name).join(', ')}</div>`; },

  // ===================== 특성 =====================
  renderTalent(m) {
    const cls = this.curCls(), T = G.TALENTS, I = IT();
    // 탭: 캐릭터마다 전문화별 특성 트리 (지금은 직업마다 전문화 하나)
    const tabs = this.chars().flatMap(c => I.specsOf(c).map(sp => ({ tree: I.SPECS[sp].tree, cls: c }))).filter(x => T.TREES[x.tree]);
    if (!this.tree || (this.tree !== 'library' && !tabs.some(x => x.tree === this.tree))) this.tree = G.Meta.specTree(cls);
    const tree = this.tree, def = T.TREES[tree], cur = G.Meta.tree(tree);
    if (!this.pending || this.pending.tree !== tree) this.pending = { tree, ranks: Object.assign({}, cur.ranks) };
    const ranks = this.pending.ranks, spent = T.spent(ranks), changed = JSON.stringify(ranks) !== JSON.stringify(cur.ranks);
    const free = cur.bought - spent, canBuy = cur.bought < def.maxPoints, cost = T.pointCost(tree, cur.bought);
    const rows = Math.max(...def.nodes.map(n => n.row)) + 1;
    const cell = n => {
      const r = ranks[n.id] || 0, trial = Object.assign({}, ranks, { [n.id]: r + 1 });
      const can = r < n.max && free > 0 && !T.validate(tree, trial, cur.bought);
      const locked = !r && !can;
      return `<div class="tal ${r ? 'has' : ''} ${r >= n.max ? 'max' : ''} ${locked ? 'locked' : ''}" data-node="${n.id}" style="grid-row:${n.row + 1};grid-column:${n.col + 1}"
        data-tip="${esc(`<div class='tt-title'>${n.name}</div><div class='tt-row'><span>등급 ${r}/${n.max}</span></div>${r ? `<div class='tt-desc'>${n.desc(r)}</div>` : ''}${r < n.max ? `<div class='tt-green'>다음 등급: ${n.desc(r + 1)}</div>` : ''}${n.row ? `<div class='dim'>윗줄에 ${n.row * T.ROW_POINTS}점 필요</div>` : ''}${n.req ? `<div class='dim'>선행: ${T.node(tree, n.req).name} 최대</div>` : ''}`)}">
        <img src="${G.icon(n.icon)}"><i>${r}/${n.max}</i></div>`;
    };
    m.innerHTML = `<div class="talWrap">
      <div class="talTabs">${tabs.map(x => `<a href="#" data-tree="${x.tree}" class="${tree === x.tree ? 'on' : ''}"><img src="${G.icon(G.CLASSES[x.cls].icon)}">${T.TREES[x.tree].name}</a>`).join('')}
        <a href="#" data-tree="library" class="${tree === 'library' ? 'on' : ''}"><img src="${G.icon('library')}">달라란 도서관</a></div>
      <div class="talInfo"><h3>${def.name}</h3><div class="dim">${def.desc}. 포인트를 골드로 사서 배분합니다. 한 줄 아래로 가려면 그 위 줄들에 5점씩 필요합니다.</div>
        <div class="talPts">구매한 포인트 <b>${cur.bought}</b> / ${def.maxPoints} · 남은 포인트 <b>${free}</b></div>
        <div class="talBtns"><button class="btn small" id="talBuy" ${canBuy && G.Meta.wallet('gold') >= cost ? '' : 'disabled'}>포인트 구매 (${canBuy ? cost + ' 골드' : '최대'})</button>
          <button class="btn small" id="talApply" ${changed ? '' : 'disabled'}>배분 적용</button>
          <button class="btn small" id="talUndo" ${changed ? '' : 'disabled'}>되돌리기</button>
          <button class="btn small" id="talReset" ${T.spent(cur.ranks) ? '' : 'disabled'}>초기화 (${T.respecCost(cur.resets)} 골드)</button></div>
        <div class="dim small">클릭: 등급 올리기 · 우클릭: 적용 전 등급 내리기</div></div>
      <div class="talGrid" style="grid-template-rows:repeat(${rows},64px)">${def.nodes.map(cell).join('')}</div></div>`;
    m.querySelectorAll('[data-tree]').forEach(a => (a.onclick = e => { e.preventDefault(); this.tree = a.dataset.tree; this.pending = null; this.render(); }));
    m.querySelectorAll('[data-node]').forEach(el => {
      const id = el.dataset.node, n = T.node(tree, id);
      el.onclick = () => {
        const r = ranks[id] || 0, trial = Object.assign({}, ranks, { [id]: r + 1 });
        if (r >= n.max || free <= 0) return;
        const err = T.validate(tree, trial, cur.bought); if (err) return G.UI.error(err);
        ranks[id] = r + 1; G.Audio.play('click'); this.render();
      };
      el.oncontextmenu = e => {
        e.preventDefault();
        const r = ranks[id] || 0; if (r <= (cur.ranks[id] || 0)) return;
        const trial = Object.assign({}, ranks, { [id]: r - 1 });
        if (T.validate(tree, trial, cur.bought)) return G.UI.error('아래 줄 특성이 이 포인트에 의존합니다.');
        ranks[id] = r - 1; if (!ranks[id]) delete ranks[id]; this.render();
      };
    });
    $('talBuy').onclick = () => this.act(() => this.api('POST', '/api/talents/point', { tree }), '포인트를 구매했습니다.'); // 배분 중이던 내용(pending)은 그대로 유지
    $('talApply').onclick = () => { const r = this.pending.ranks; this.pending = null; this.act(() => this.api('POST', '/api/talents/set', { tree, ranks: r }), '특성을 적용했습니다.'); };
    $('talUndo').onclick = () => { this.pending = null; this.render(); };
    $('talReset').onclick = () => { if (confirm('모든 포인트를 돌려받고 배분을 초기화할까요?')) { this.pending = null; this.act(() => this.api('POST', '/api/talents/reset', { tree }), '초기화했습니다.'); } };
  },

  // ===================== 상점 (가챠) =====================
  renderShop(m) {
    const I = IT(), gs = this.pr().gacha;
    const card = (kind, g) => {
      const st = gs[kind] || { pity: 0, pulls: 0 }, cur = I.CURRENCIES[g.currency], have = G.Meta.wallet(g.currency);
      const tot = g.table.reduce((a, [, w]) => a + w, 0);
      return `<div class="gacha"><div class="gHead"><img src="${G.icon(g.icon)}"><div><h3>${g.name}</h3><div class="dim"><img class="ci" src="${G.icon(cur.icon)}">${cur.name} ${fmtNum(have)}</div></div></div>
        <table class="gProb">${g.table.map(([v, w], i) => `<tr><td>${g.tableNames[i]}</td><td>${(w / tot * 100).toFixed(1)}%</td></tr>`).join('')}</table>
        <div class="dim small">천장: ${g.pity.at}회 안에 ${g.pity.label} 확정 (현재 ${st.pity}/${g.pity.at}) · ${g.ten.label}${kind === 'equip' ? `<br>아이템 레벨은 클리어한 가장 높은 스테이지 기준 (${this.pr().progressIlvl})` : ''}</div>
        <div class="gBtns"><button class="btn small" data-pull="${kind}" data-n="1" ${have >= g.cost ? '' : 'disabled'}>1회 (${g.cost})</button>
          <button class="btn small" data-pull="${kind}" data-n="10" ${have >= g.cost10 ? '' : 'disabled'}>10회 (${g.cost10})</button>
          ${g.premium ? `<button class="btn small" data-pull="${kind}" data-n="1" data-premium="1" ${G.Meta.wallet(g.premium.currency) >= g.premium.cost ? '' : 'disabled'}>${g.premium.label}</button>` : ''}</div></div>`;
    };
    m.innerHTML = `<div class="shopWrap"><p class="dim">모든 확률은 아래 표 그대로 서버에서 굴립니다. 재화는 스테이지 · 분해 · 엔드리스 · 퀘스트로 얻습니다.</p>
      <div class="gachaRow">${Object.entries(I.GACHA).map(([k, g]) => card(k, g)).join('')}</div><div id="gachaResult" class="gachaResult"></div></div>`;
    m.querySelectorAll('[data-pull]').forEach(b => (b.onclick = async () => {
      b.disabled = true;
      const r = await this.act(() => this.api('POST', '/api/gacha', { kind: b.dataset.pull, count: +b.dataset.n, premium: !!b.dataset.premium }));
      if (r) this.showPulls(r.results);
    }));
  },
  showPulls(results) {
    const I = IT(), box = $('gachaResult'); if (!box) return;
    box.innerHTML = results.map((r, i) => {
      let icon, name, q, tip;
      if (r.type === 'item') { icon = r.item.icon; name = r.item.name; q = r.item.quality; tip = this.itemTip(r.item, this.curCls()); }
      else if (r.type === 'gem') { const g = I.GEMS[r.id]; icon = g.icon; name = g.name; q = g.quality; tip = this.gemTip(r.id); }
      else { const e = I.ENCHANTS[r.id]; icon = e.slots.includes('staff') ? 'enchant_weapon' : 'enchant'; name = e.name; q = e.quality; tip = this.enchTip(r.id); }
      return `<div class="pull q${q}" style="--qc:${qcol(q)};animation-delay:${i * 0.07}s" data-tip="${esc(tip)}"><img src="${G.icon(icon)}"><span>${esc(name)}</span>${r.item && r.item.autoDE ? '<small>가방 가득: 자동 분해</small>' : ''}</div>`;
    }).join('');
    // 결과가 하나씩 나타날 때 소리, 영웅 이상은 화음 · 전설(또는 메타 보석)은 종소리와 빛 번짐
    const top = r => (r.item && r.item.quality >= 4) || (r.type === 'gem' && I.GEMS[r.id].color === 'meta');
    const qOf = r => (r.item ? r.item.quality : r.type === 'gem' ? I.GEMS[r.id].quality : I.ENCHANTS[r.id].quality);
    results.forEach((r, i) => setTimeout(() => G.Audio.play(top(r) ? 'legend' : qOf(r) >= 3 ? 'revealRare' : 'reveal', 0.8), i * 70 + 150));
    box.classList.remove('burst'); void box.offsetWidth;
    if (results.some(top)) box.classList.add('burst');
    G.Audio.play('chest');
  },

  // ===================== 퀘스트 =====================
  renderQuest(m) {
    const Q = this.pr().quests, I = IT();
    const rew = r => Object.entries(r).map(([k, v]) => `<span><img class="ci" src="${G.icon(I.CURRENCIES[k].icon)}">${v}</span>`).join(' ');
    const list = (period, title, defs) => `<div class="qBox"><h3><img src="${G.icon(period === 'daily' ? 'quest' : 'questweekly')}">${title}</h3>${Q[period].list.map(q => {
      const d = defs.find(x => x.id === q.id), done = q.progress >= q.goal;
      return `<div class="quest ${q.claimed ? 'claimed' : done ? 'done' : ''}"><div><b>${d.name}</b><small>${d.desc}</small>
        <div class="qBar"><div style="width:${q.progress / q.goal * 100}%"></div><span>${fmtNum(q.progress)} / ${fmtNum(q.goal)}</span></div></div>
        <div class="qRew">${rew(d.reward)}<button class="btn small" data-claim="${period}:${q.id}" ${done && !q.claimed ? '' : 'disabled'}>${q.claimed ? '완료' : '보상 받기'}</button></div></div>`;
    }).join('')}</div>`;
    m.innerHTML = `<div class="questWrap">${list('daily', '일일 퀘스트', I.QUESTS.daily)}${list('weekly', '주간 퀘스트', I.QUESTS.weekly)}
      <p class="dim">일일 퀘스트는 매일 오전 ${I.RESET.dailyHour}시, 주간 퀘스트와 금고는 매주 목요일 오전 ${I.RESET.weeklyHour}시(한국 시간)에 초기화됩니다.</p></div>`;
    m.querySelectorAll('[data-claim]').forEach(b => (b.onclick = () => { const [period, id] = b.dataset.claim.split(':'); this.act(() => this.api('POST', '/api/quests/claim', { period, id }), '보상을 받았습니다.'); }));
  },

  // ===================== 위대한 금고 =====================
  renderVault(m) {
    const V = this.pr().vault, I = IT();
    m.innerHTML = `<div class="vaultWrap"><p class="dim">이번 주 활동에 따라 칸이 열리고, <b>다음 주</b>에 열린 칸마다 보상 선택지가 생깁니다. 그중 하나만 고를 수 있습니다. 금고에서만 나오는 장비도 있습니다.</p>
      <h3>이번 주 진행</h3><div class="vRows">${V.rows.map(r => {
        const name = I.VAULT.rows.find(x => x.id === r.id).name;
        return `<div class="vRow"><b>${name}</b>${r.goals.map(g => `<div class="vCell ${r.have >= g ? 'open' : ''}"><img src="${G.icon('vault')}"><small>${Math.min(r.have, g)} / ${g}</small></div>`).join('')}</div>`;
      }).join('')}</div>
      <div class="dim small">던전: 던전 클리어 횟수 · 공격대: 공격대 보스 처치 수 · 엔드리스: 5단계 이상 도달한 판 수</div>
      <h3>이번 주 보상 (지난주 진행 기준)</h3>
      <div class="vOpts">${V.options.length ? V.options.map((o, i) => `<div class="vOpt ${V.claimed === i ? 'picked' : ''}" data-tip="${esc(this.itemTip(o.item, this.curCls()))}" style="--qc:${qcol(o.item.quality)}">
          <img src="${G.icon(o.item.icon)}"><b style="color:${qcol(o.item.quality)}">${esc(o.item.name)}</b><small>${I.VAULT.rows.find(x => x.id === o.row).name} · ${o.item.ilvl}</small>
          ${V.claimed == null ? `<button class="btn small" data-vault="${i}">선택</button>` : V.claimed === i ? '<span class="tt-green">받음</span>' : ''}</div>`).join('') : '<div class="dim">지난주에 연 칸이 없어 이번 주 보상이 없습니다.</div>'}</div></div>`;
    m.querySelectorAll('[data-vault]').forEach(b => (b.onclick = () => { if (confirm('이 보상을 선택할까요? 다른 선택지는 사라집니다.')) this.act(() => this.api('POST', '/api/vault/claim', { index: +b.dataset.vault }), r => `${r.item.name}을(를) 받았습니다.`); }));
  },

  // ===================== 랭킹 =====================
  // 주문 도감: 직업마다 배울 수 있는 모든 주문 · 능력치 · 전설 · 진화를 기본 수치로 보여준다 (로그인 불필요)
  renderCodex(m) {
    const cls = G.CLASSES[this.codexCls] ? this.codexCls : 'mage', C = G.CLASSES[cls];
    // 설명 함수들이 G.player(주문력 · 직업별 이름)를 읽으므로 기본값 플레이어로 잠시 바꿔 그린다
    const real = G.player;
    G.player = { cls, stats: { dmg: 1 }, skills: {}, passives: {}, legend: {}, evo: {} };
    const safe = f => { try { return f(); } catch (e) { return ''; } };
    const card = (def, body, sub = '') => `<div class="cdx"><img src="${G.icon(G.skIcon(def))}"><div><div class="cdxName">${G.skName(def)}${def.key ? ` <span class="cdxKey">${G.KEY_LABEL[def.key] || def.key}</span>` : ''}</div>
      ${sub ? `<div class="cdxSub">${sub}</div>` : ''}<div class="cdxDesc">${body}</div></div></div>`;
    const spell = def => card(def, safe(() => def.tip(Object.assign({}, def.base))) +
      (def.nodes && def.nodes.length ? `<div class="cdxNodes">${def.nodes.map(n => `<span><b>${n.name}</b> ${n.max}단계 · ${n.desc}</span>`).join('')}</div>` : ''), safe(() => def.castInfo(def.base)));
    const all = Object.values(G.SKILLS), mine = all.filter(d => d.cls === cls);
    const commons = all.filter(d => d.cls === 'any' && (!d.req || safe(() => d.req(G.player))));
    const sec = (title, list, f) => list.length ? `<h3 class="cdxH">${title} <small>${list.length}</small></h3><div class="cdxGrid">${list.map(f).join('')}</div>` : '';
    const passive = d => card(d, safe(() => d.desc(d.val * d.max)), `최대 ${d.max}단계 (단계당 ${d.val}${d.unit})`);
    let html;
    try {
      html = `<div class="cdxWrap"><div class="talTabs">${Object.values(G.CLASSES).map(c => `<a href="#" data-cdx="${c.id}" class="${c.id === cls ? 'on' : ''}"><img src="${G.icon(c.icon)}">${c.name}</a>`).join('')}</div>
        <div class="dim small">수치는 강화 · 특성 · 장비가 없는 기본값입니다. 능력치는 최대 단계 기준.</div>
        ${sec('자동 시전 주문', mine.filter(d => d.kind === 'auto'), spell)}
        ${sec('핵심 주문', mine.filter(d => d.kind === 'active'), spell)}
        ${sec('진화 · 영웅 특성', mine.filter(d => d.kind === 'evolution'), d => card(d, safe(() => d.desc()), '조건: ' + d.reqText))}
        ${sec('전설 효과', mine.filter(d => d.kind === 'legendary'), d => card(d, safe(() => d.desc())))}
        ${sec(C.name + ' 전용 능력치', mine.filter(d => d.kind === 'passive'), passive)}
        ${sec('공용 능력치', commons, passive)}</div>`;
    } finally { G.player = real; }
    m.innerHTML = html;
    m.querySelectorAll('[data-cdx]').forEach(a => (a.onclick = e => { e.preventDefault(); this.codexCls = a.dataset.cdx; this.render(); }));
  },

  // 기본은 모든 스테이지를 카드로 한눈에 (상위 3명 · 참여 인원 · 내 순위), 카드를 누르면 그 스테이지의 50위까지
  async renderRanking(m) {
    const R = this.rank, S = SD().STAGES, stage = S[R.stage] ? S[R.stage] : null;
    const seg = (k, opts) => `<div class="rkSeg">${opts.map(([v, label, icon]) =>
      `<a href="#" data-rk="${k}" data-v="${v}" class="${R[k] === v ? 'on' : ''}">${icon ? `<img src="${G.icon(icon)}">` : ''}${label}</a>`).join('')}</div>`;
    m.innerHTML = `<div class="rankWrap"><div class="rankFilters">
      ${seg('difficulty', [['normal', '일반'], ['heroic', '영웅']])}
      ${seg('kind', [['clear', '최단 클리어'], ['endless', '엔드리스 최고 단계']])}
      ${seg('scope', [['week', '이번 주'], ['all', '전체 기간']])}
      ${seg('cls', [['', '모든 직업']].concat(Object.values(G.CLASSES).map(c => [c.id, c.name, c.icon])))}</div>
      <div class="dim small">${R.kind === 'clear'
        ? '순위 기준: 가장 빨리 클리어한 시간. 사람마다 최고 기록 하나만 올라가며, 더 빨리 깨야 순위가 오릅니다.'
        : '순위 기준: 클리어 후 엔드리스로 도달한 가장 높은 단계. 사람마다 최고 기록 하나만 올라갑니다.'}</div>
      ${stage ? `<div class="rkHead"><a href="#" id="rkBack" class="btn small">← 모든 스테이지</a><img src="${G.icon(stage.icon)}"><b>${stage.name}</b></div>` : ''}
      <div id="rkBody" class="dim">불러오는 중…</div></div>`;
    m.querySelectorAll('[data-rk]').forEach(a => (a.onclick = e => { e.preventDefault(); R[a.dataset.rk] = a.dataset.v; this.render(); }));
    if (stage) $('rkBack').onclick = e => { e.preventDefault(); R.stage = ''; this.render(); };
    const val = v => R.kind === 'clear' ? U.fmtTime(v) : v + '단계';
    const medal = n => `<span class="rkMedal r${n}">${n}</span>`;
    const who = x => `<span class="rkName">${esc(x.username)}</span><img class="rkCls" src="${G.icon(G.CLASSES[x.cls].icon)}" data-tip="${G.CLASSES[x.cls].name} · 아이템 레벨 ${x.ilvl}">`;
    try {
      const q = new URLSearchParams(Object.entries(R).filter(([k, v]) => v && (stage || k !== 'stage'))).toString();
      const body = () => $('rkBody');
      if (!stage) {
        const r = await this.api('GET', '/api/rankings/overview?' + q);
        if (!body()) return;
        const byId = Object.fromEntries(r.stages.map(s => [s.stage, s]));
        const card = s => {
          const d = byId[s.id] || { count: 0, top: [], me: null };
          return `<div class="rkCard ${d.me ? 'mine' : ''}" data-stage="${s.id}">
            <div class="rkCardHead"><img src="${G.icon(s.icon)}"><div><b>${s.name}</b><small>${s.type === 'raid' ? '공격대' : '던전'} · ${d.count}명 참여</small></div></div>
            ${d.top.length ? d.top.map(x => `<div class="rkRow ${x.me ? 'me' : ''}">${medal(x.rank)}${who(x)}<b class="rkVal">${val(x.value)}</b></div>`).join('')
              : '<div class="rkEmpty">아직 기록이 없습니다</div>'}
            <div class="rkMine">${d.me ? `내 순위 <b>${d.me.rank}위</b> / ${d.count}명 · ${val(d.me.value)}` : `<span class="dim">${G.Net.user ? '내 기록 없음' : '로그인하면 내 순위가 보입니다'}</span>`}</div></div>`;
        };
        body().className = '';
        body().innerHTML = SD().CHAPTERS.map(ch => {
          const list = Object.values(S).filter(s => s.chapter === ch.id).sort((a, b) => a.order - b.order);
          return list.length ? `<h3 class="cdxH">${ch.name}</h3><div class="rkGrid">${list.map(card).join('')}</div>` : '';
        }).join('');
        body().querySelectorAll('[data-stage]').forEach(c => (c.onclick = () => { R.stage = c.dataset.stage; G.Audio.play('click'); this.render(); }));
        return;
      }
      const r = await this.api('GET', '/api/rankings?' + q);
      if (!body()) return;
      const row = x => `<tr class="${x.me ? 'me' : ''}"><td>${x.rank <= 3 ? medal(x.rank) : x.rank}</td><td>${esc(x.username)}</td><td style="color:${G.CLASSES[x.cls].color}">${G.CLASSES[x.cls].name}</td><td>${x.ilvl}</td><td><b>${val(x.value)}</b></td></tr>`;
      body().className = '';
      body().innerHTML = r.rows.length ? `<div class="dim small">${r.count}명 참여${r.count > 50 ? ' · 50위까지 표시' : ''}</div>
        <table class="rankTable"><tr><th>순위</th><th>이름</th><th>직업</th><th>아이템 레벨</th><th>${R.kind === 'clear' ? '클리어 시간' : '단계'}</th></tr>
        ${r.rows.map(row).join('')}${r.me ? `<tr class="gap"><td colspan="5">⋯</td></tr>${row(r.me)}` : ''}</table>`
        : '<div class="dim">아직 기록이 없습니다.</div>';
    } catch (e) { const t = $('rkBody'); if (t) t.textContent = e.message; }
  },

  // ---------- 패치노트 (js/data/patchnotes.js) ----------
  renderPatch(m) {
    const N = G.PATCH_NOTES;
    let seen = null; try { seen = localStorage.getItem(this.PATCH_SEEN); } catch { /* 저장소 사용 불가 */ }
    // 처음 보는 사람은 최신 하나만 NEW, 그 뒤로는 지난번에 읽은 버전보다 새것 모두 NEW
    const seenIdx = N.findIndex(n => n.v === seen), newCount = seenIdx < 0 ? 1 : seenIdx;
    const li = s => `<li>${esc(s)}</li>`;
    const body = notes => `<ul>${notes.map(x => typeof x === 'string' ? li(x) : `<li class="pnH">${esc(x.h)}<ul>${x.items.map(li).join('')}</ul></li>`).join('')}</ul>`;
    m.innerHTML = `<div class="patchWrap"><h2>패치노트</h2><p class="dim">업데이트마다 바뀐 점을 여기에 정리합니다. 지금 버전은 <b>v${G.VERSION}</b>입니다.</p>
      ${N.map((n, i) => `<details class="patch" ${i < 3 ? 'open' : ''}><summary><b>v${esc(n.v)}</b> ${esc(n.title)}
        ${i < newCount ? '<em class="newTag">NEW</em>' : ''}${n.v === G.VERSION ? '<em class="curTag">현재 버전</em>' : ''}<small>${esc(n.date)}</small></summary>${body(n.notes)}</details>`).join('')}</div>`;
    if (N.length) try { localStorage.setItem(this.PATCH_SEEN, N[0].v); } catch { /* 무시 */ }
    const tag = G.UI.el.modal.querySelector('[data-tab="patch"] .newTag'); if (tag) tag.remove();
  },
};
