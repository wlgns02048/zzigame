'use strict';
// ================= 밸런스 분석 (관리자 로비 탭) =================
// 판 기록(js/runlog.js → run_logs)을 직업 · 전문화별로 모아 본다 — server/balance.js의 /api/admin/*.
//   요약표: 판 수 · 클리어율 · 사망률 · 유효/원시/보스 DPS(중앙값, 사분위)
//   시간대별 DPS 곡선 · 스테이지별 · 보스별 비교 · 직업마다 주문 피해 비중 · 선택률 · 판 목록과 판 하나의 기록
// 유효 피해 = 적의 남은 생명력까지만 (넘친 피해 제외). 일반 몹이 모자라면 유효 DPS는 화력과 상관없이 막히므로
// 직업 화력 비교는 '보스 DPS'(첫 피해 ~ 처치, 단일 대상)를 먼저 본다.
G.Balance = {
  f: { days: '14', stage: '', difficulty: '', version: '', ilvlMin: '', ilvlMax: '', minT: '60' },
  view: 'overview', data: null, runs: null,

  q(extra = {}) { return new URLSearchParams(Object.entries({ ...this.f, ...extra }).filter(([, v]) => v !== '' && v != null)).toString(); },
  gname(g) { const c = G.CLASSES[g.cls], sp = g.spec && G.ITEMS.SPECS[g.spec]; return c ? (sp ? `${sp.name} ${c.className}` : c.name) : esc(g.cls); },
  gicon(cls) { const c = G.CLASSES[cls]; return c ? `<img src="${G.icon(c.icon)}">` : ''; },
  gcol(cls) { return (G.CLASSES[cls] && G.CLASSES[cls].color) || '#ccc'; },
  srcName(s) { const x = G.SOURCES[s]; return x ? `<img src="${G.icon(x[1])}">${x[0]}` : esc(s); },
  bossName(id) { const e = G.ENEMIES[id]; return e ? e.name : esc(id); },
  stageName(id, d) { const s = G.STAGE_DATA.STAGES[id], df = G.STAGE_DATA.DIFFICULTY[d]; return `${s ? s.name : esc(id)}${df ? ' · ' + df.name : ''}`; },
  // 선택지 키(type:id:nodeId) → 이름
  pickName(k) {
    const [type, id, node] = k.split(':'), def = G.SKILLS[id];
    if (!def) return esc(k);
    const ic = `<img src="${G.icon(G.skIcon(def))}">`;
    if (type === 'new') return `${ic}<b>${def.name}</b> <span class="dim">배움</span>`;
    if (type === 'node') { const n = (def.nodes || []).find(x => x.id === node); return `${ic}${def.name} · ${n ? n.name : esc(node)}`; }
    if (type === 'passive') return `${ic}${G.skName(def)} <span class="dim">능력치</span>`;
    if (type === 'legendary') return `${ic}<span style="color:#ff8000">${def.name}</span>`;
    if (type === 'evolution') return `${ic}<span style="color:#e6cc80">${def.name}</span>`;
    return esc(k);
  },
  n(v) { return v == null ? '-' : U.num(v); },
  pc(a, b) { return b ? (a / b * 100).toFixed(0) + '%' : '-'; },

  async render(m) {
    const F = this.f, S = G.STAGE_DATA.STAGES;
    const seg = (k, opts) => `<div class="rkSeg">${opts.map(([v, label]) => `<a href="#" data-bf="${k}" data-v="${v}" class="${F[k] === v ? 'on' : ''}">${label}</a>`).join('')}</div>`;
    const vers = (this.data && this.data.versions) || [];
    m.innerHTML = `<div class="balWrap"><h2>밸런스 분석 <small class="dim">관리자 전용</small></h2>
      <div class="rankFilters">
        ${seg('view', [['overview', '직업 비교'], ['runs', '판 목록']])}
        ${seg('days', [['1', '하루'], ['7', '7일'], ['14', '14일'], ['30', '30일'], ['90', '90일']])}
        ${seg('difficulty', [['', '모든 난이도'], ['normal', '일반'], ['heroic', '영웅']])}
        <select data-bs="stage"><option value="">모든 스테이지</option>${Object.values(S).map(s => `<option value="${s.id}" ${F.stage === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select>
        <select data-bs="version"><option value="">모든 버전</option>${vers.concat(F.version && !vers.includes(F.version) ? [F.version] : []).map(v => `<option ${F.version === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
        <label class="small dim">아이템 레벨 <input data-bs="ilvlMin" value="${esc(F.ilvlMin)}" size="3" placeholder="최소"> ~ <input data-bs="ilvlMax" value="${esc(F.ilvlMax)}" size="3" placeholder="최대"></label>
        <label class="small dim">최소 판 길이(초) <input data-bs="minT" value="${esc(F.minT)}" size="3"></label>
        <a href="#" class="btn small" id="balExport">JSON 내보내기</a>
      </div>
      <div class="dim small">유효 피해 = 적의 남은 생명력까지만 센 피해 (넘친 피해 제외). 몹이 모자라면 유효 DPS는 막히므로 화력 비교는 <b>보스 DPS</b>(첫 피해 ~ 처치)를 먼저 보세요. 기록은 플레이어 브라우저가 보낸 값입니다.</div>
      <div id="balBody" class="dim">불러오는 중…</div></div>`;
    m.querySelectorAll('[data-bf]').forEach(a => (a.onclick = e => {
      e.preventDefault();
      if (a.dataset.bf === 'view') this.view = a.dataset.v; else F[a.dataset.bf] = a.dataset.v;
      this.render(m);
    }));
    m.querySelector('[data-bf="view"][data-v="' + this.view + '"]').classList.add('on');
    m.querySelectorAll('[data-bs]').forEach(s => (s.onchange = () => { F[s.dataset.bs] = s.value.trim(); this.render(m); }));
    $('balExport').onclick = e => { e.preventDefault(); this.exportJson(); };
    const body = $('balBody');
    try {
      if (this.view === 'runs') {
        const r = await G.Net.api('GET', '/api/admin/runlogs?' + this.q({ limit: 200 }));
        if ($('balBody') === body) this.renderRuns(body, r.rows);
      } else {
        const r = await G.Net.api('GET', '/api/admin/balance?' + this.q());
        this.data = r;
        if ($('balBody') === body) this.renderOverview(body, r);
      }
    } catch (err) { if ($('balBody') === body) body.innerHTML = `<div class="err">${esc(err.message)}</div>`; }
  },

  // ---------- 직업 비교 ----------
  renderOverview(box, r) {
    if (!r.groups.length) { box.innerHTML = '<div class="dim">조건에 맞는 기록이 없습니다. (판 기록은 v2.16.0부터 쌓입니다)</div>'; return; }
    const gs = r.groups.slice().sort((a, b) => (b.bossDps.med || 0) - (a.bossDps.med || 0));
    const top = k => Math.max(...gs.map(g => g[k].med || 0)) || 1;
    const rel = (v, k) => v == null ? '' : ` <span class="balRel">${(v / top(k) * 100).toFixed(0)}%</span>`;
    const q = s => s.med == null ? '-' : `<b>${U.num(s.med)}</b>${s.n > 3 ? ` <span class="dim small">${U.num(s.p25)}~${U.num(s.p75)}</span>` : ''}`;
    const sum = `<table class="statTable balTable"><tr><th>직업</th><th>판</th><th>인원</th><th>평균 템렙</th><th>클리어율</th><th>사망률</th><th>평균 시간</th><th>보스 DPS</th><th>유효 DPS</th><th>원시 DPS</th></tr>
      ${gs.map(g => `<tr><td>${this.gicon(g.cls)}<span style="color:${this.gcol(g.cls)}">${this.gname(g)}</span></td><td>${g.runs}</td><td>${g.users}</td><td>${g.ilvl.mean == null ? '-' : g.ilvl.mean.toFixed(0)}</td>
        <td>${this.pc(g.clears, g.runs)}</td><td>${this.pc(g.deaths, g.runs)}</td><td>${U.fmtTime(g.t.mean || 0)}</td>
        <td>${q(g.bossDps)}${rel(g.bossDps.med, 'bossDps')}</td><td>${q(g.eff)}${rel(g.eff.med, 'eff')}</td><td>${q(g.raw)}</td></tr>`).join('')}</table>
      <div class="dim small">중앙값 (옅은 숫자는 하위 25% ~ 상위 25%). 오른쪽 %는 가장 높은 직업 대비. 총 ${r.total}판.</div>`;

    // 스테이지별
    const keys = gs.map(g => g.key), byKey = Object.fromEntries(gs.map(g => [g.key, g]));
    const stages = r.stages.slice().sort((a, b) => (G.STAGE_DATA.STAGES[a.stage] || {}).ilvl - (G.STAGE_DATA.STAGES[b.stage] || {}).ilvl || a.difficulty.localeCompare(b.difficulty));
    const stTab = `<h3>스테이지별 (중앙값)</h3><table class="statTable balTable"><tr><th>스테이지</th>${keys.map(k => `<th>${this.gicon(byKey[k].cls)}${this.gname(byKey[k])}</th>`).join('')}</tr>
      ${stages.map(s => `<tr><td>${this.stageName(s.stage, s.difficulty)}</td>${keys.map(k => { const x = s.groups[k]; return `<td>${x ? `보스 <b>${this.n(x.bossDps)}</b> · 유효 ${this.n(x.eff)}<br><span class="dim small">${x.runs}판 · 클리어 ${this.pc(x.clears, x.runs)}${x.clearT ? ' · ' + U.fmtTime(x.clearT) : ''} · 템렙 ${x.ilvl.toFixed(0)}</span>` : '-'}</td>`; }).join('')}</tr>`).join('')}</table>`;

    // 보스별
    const bossTab = `<h3>보스별 처치 시간 · 보스 DPS (중앙값)</h3><table class="statTable balTable"><tr><th>보스</th>${keys.map(k => `<th>${this.gicon(byKey[k].cls)}${this.gname(byKey[k])}</th>`).join('')}</tr>
      ${Object.entries(r.bosses).map(([id, x]) => `<tr><td>${this.bossName(id)}</td>${keys.map(k => { const b = x[k]; return `<td>${b ? `${U.fmtTime(b.ttk)} · <b>${U.num(b.dps)}</b> <span class="dim small">(${b.n})</span>` : '-'}</td>`; }).join('')}</tr>`).join('')}</table>
      <div class="dim small">처치 시간 = 등장 ~ 처치. 보스 DPS = 첫 피해 ~ 처치 동안 보스에게 준 유효 피해 / 시간.</div>`;

    box.innerHTML = sum + `<h3>시간대별 유효 DPS (30초 구간 평균)</h3>${this.curve(gs)}` + stTab + bossTab +
      `<h3>직업별 상세</h3>${gs.map(g => this.groupDetail(g)).join('')}`;
  },

  // 시간대별 DPS 곡선 (SVG)
  curve(gs) {
    const W = 760, H = 220, P = 40, len = Math.max(1, ...gs.map(g => g.tl.length));
    const max = Math.max(1, ...gs.flatMap(g => g.tl.filter(Boolean).map(x => x.dps)));
    const X = i => P + (i + 0.5) / len * (W - P - 10), Y = v => H - 24 - v / max * (H - 40);
    const grid = [0.25, 0.5, 0.75, 1].map(f => `<line x1="${P}" x2="${W - 10}" y1="${Y(max * f)}" y2="${Y(max * f)}" stroke="#2a2a2a"/><text x="${P - 4}" y="${Y(max * f) + 4}" text-anchor="end">${U.num(max * f)}</text>`).join('');
    const xs = []; for (let i = 0; i < len; i += 4) xs.push(`<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${Math.round(i * 30 / 60)}분</text>`);
    const lines = gs.map(g => {
      const pts = g.tl.map((x, i) => (x ? `${X(i).toFixed(1)},${Y(x.dps).toFixed(1)}` : null)).filter(Boolean);
      return pts.length > 1 ? `<polyline fill="none" stroke="${this.gcol(g.cls)}" stroke-width="2" points="${pts.join(' ')}"><title>${this.gname(g)}</title></polyline>` : '';
    }).join('');
    const legend = gs.map(g => `<span style="color:${this.gcol(g.cls)}">■ ${this.gname(g)}</span>`).join(' ');
    return `<svg class="balCurve" viewBox="0 0 ${W} ${H}">${grid}${xs.join('')}${lines}</svg><div class="small">${legend} <span class="dim">(구간마다 그 구간을 끝까지 산 판만 평균 — 뒤로 갈수록 판 수가 적어 흔들립니다)</span></div>`;
  },

  groupDetail(g) {
    const srcTab = (src, title) => {
      const tot = Object.values(src).reduce((a, b) => a + b, 0) || 1;
      return `<div><h4>${title}</h4><table class="statTable balTable">${Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 14)
        .map(([k, v]) => `<tr><td>${this.srcName(k)}</td><td><div class="balBar" style="width:${(v / tot * 100).toFixed(1)}%;background:${this.gcol(g.cls)}"></div></td><td>${(v / tot * 100).toFixed(1)}%</td></tr>`).join('')}</table></div>`;
    };
    // 선택: 제시 대비 선택률. 많이 제시된 순
    const picks = Object.entries(g.offered).filter(([k]) => !k.startsWith('gold') && !k.startsWith('heal')).sort((a, b) => b[1] - a[1]).slice(0, 40);
    const pickTab = `<div><h4>선택지 (제시 → 선택)</h4><table class="statTable balTable"><tr><th>선택지</th><th>제시</th><th>선택</th><th>선택률</th><th>고른 판</th></tr>
      ${picks.map(([k, n]) => `<tr><td>${this.pickName(k)}</td><td>${n}</td><td>${g.picked[k] || 0}</td><td>${this.pc(g.picked[k] || 0, n)}</td><td>${this.pc(g.pickedRuns[k] || 0, g.runs)}</td></tr>`).join('')}</table></div>`;
    const skills = Object.entries(g.skills).sort((a, b) => b[1].n - a[1].n);
    const skTab = `<div><h4>판 끝 주문 (보유율 · 평균 레벨)</h4><table class="statTable balTable">${skills.map(([id, s]) => { const d = G.SKILLS[id]; return `<tr><td>${d ? `<img src="${G.icon(d.icon)}">${d.name}` : esc(id)}</td><td>${this.pc(s.n, g.runs)}</td><td>${(s.lv / s.n).toFixed(1)}레벨</td></tr>`; }).join('')}</table>
      ${['legend', 'evo'].map(k => Object.keys(g[k]).length ? `<h4>${k === 'legend' ? '전설' : '진화'}</h4>${Object.entries(g[k]).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<div class="small">${this.pickName((k === 'legend' ? 'legendary:' : 'evolution:') + id)} ${this.pc(n, g.runs)}</div>`).join('')}` : '').join('')}
      ${Object.keys(g.deathBy).length ? `<h4>사망 원인</h4>${Object.entries(g.deathBy).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => `<div class="small">${id === 'etc' ? '투사체 · 장판' : this.bossName(id)} ${n}</div>`).join('')}` : ''}</div>`;
    return `<details class="balGroup"><summary>${this.gicon(g.cls)}<b style="color:${this.gcol(g.cls)}">${this.gname(g)}</b> <span class="dim">${g.runs}판 · 보스 DPS ${this.n(g.bossDps.med)} · 유효 DPS ${this.n(g.eff.med)}</span></summary>
      <div class="balCols">${srcTab(g.src, '주문별 유효 피해 (전체)')}${srcTab(g.bossSrc, '주문별 유효 피해 (보스)')}${skTab}${pickTab}</div></details>`;
  },

  // ---------- 판 목록 ----------
  renderRuns(box, rows) {
    if (!rows.length) { box.innerHTML = '<div class="dim">조건에 맞는 기록이 없습니다.</div>'; return; }
    box.innerHTML = `<table class="statTable balTable balRuns"><tr><th>시각</th><th>플레이어</th><th>직업</th><th>스테이지</th><th>템렙</th><th>시간</th><th>레벨</th><th>결과</th><th>유효 DPS</th><th>원시 DPS</th><th>버전</th></tr>
      ${rows.map(r => `<tr data-run="${esc(r.id)}"><td>${new Date(r.updated_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td>${esc(r.username)}</td>
        <td>${this.gicon(r.cls)}${this.gname(r)}</td><td>${this.stageName(r.stage, r.difficulty)}</td><td>${r.ilvl}</td><td>${U.fmtTime(r.t)}</td><td>${r.level}</td>
        <td>${r.clear_t != null ? `<span style="color:#1eff00">클리어 ${U.fmtTime(r.clear_t)}</span>${r.endless_lv ? ` +${r.endless_lv}단계` : ''}` : r.status === 'active' ? '<span class="dim">진행/중단</span>' : '<span class="err">사망</span>'}</td>
        <td>${U.num(r.eff / r.t)}</td><td>${U.num(r.dmg / r.t)}</td><td>${esc(r.version)}</td></tr>`).join('')}</table>`;
    box.querySelectorAll('[data-run]').forEach(tr => (tr.onclick = () => this.showRun(box, tr.dataset.run)));
  },

  async showRun(box, id) {
    box.innerHTML = '<div class="dim">불러오는 중…</div>';
    let r; try { r = await G.Net.api('GET', '/api/admin/runlog?id=' + encodeURIComponent(id)); } catch (e) { box.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
    const L = r.data, t = Math.max(1, r.t);
    const dmg = Object.entries(L.dmg).sort((a, b) => b[1][1] - a[1][1]), tot = dmg.reduce((a, [, v]) => a + v[1], 0) || 1;
    const st = (o, k, f = 1, sfx = '') => o && o[k] != null ? (o[k] * f).toFixed(f === 100 ? 1 : 2) + sfx : '-';
    const statRow = o => `피해 ×${st(o, 'dmg')} · 치명 ${st(o, 'crit', 100, '%')} · 치명 배율 ×${st(o, 'critMul')} · 가속 ${st(o, 'haste', 100, '%')} · 특화 ${st(o, 'mastery', 100, '%')} · 유연 ${st(o, 'vers', 100, '%')} · 범위 ×${st(o, 'area')} · 생명력 ${o && o.hp}`;
    const tal = Object.entries(L.talents).filter(([, v]) => v).map(([k, v]) => { const nd = G.TALENTS.node(G.ITEMS.SPECS[r.spec || L.spec] ? G.ITEMS.SPECS[r.spec || L.spec].tree : r.cls, k); return `${nd ? nd.name : esc(k)} ${v}`; }).join(' · ');
    const maxTl = Math.max(1, ...L.tl);
    box.innerHTML = `<a href="#" class="btn small" id="balBack">← 판 목록</a>
      <h3>${esc(r.username)} · ${this.gicon(r.cls)}${this.gname(r)} · ${this.stageName(r.stage, r.difficulty)} <span class="dim small">v${esc(r.version)} · 템렙 ${r.ilvl}</span></h3>
      <div class="summary"><div>시간<b>${U.fmtTime(r.t)}</b></div><div>레벨<b>${r.level}</b></div><div>처치<b>${r.kills.toLocaleString()}</b></div><div>보스<b>${r.boss_kills}</b></div><div>유효 DPS<b>${U.num(tot / t)}</b></div>
        <div>결과<b>${r.clear_t != null ? '클리어' + (r.endless_lv ? ` +${r.endless_lv}` : '') : L.death ? '사망' : '중단'}</b></div></div>
      ${L.death ? `<div class="small">사망: ${U.fmtTime(L.death.t)} · ${L.death.by === 'etc' || !L.death.by ? '투사체 · 장판' : this.bossName(L.death.by)}</div>` : ''}
      <div class="small dim">시작 능력치: ${statRow(L.stats0)}<br>끝 능력치: ${statRow(L.stats1)}</div>
      ${tal ? `<div class="small dim">특성: ${tal}</div>` : ''}
      <h4>30초 구간별 유효 DPS</h4><div class="balSpark">${L.tl.map((v, i) => `<i style="height:${(v / maxTl * 100).toFixed(0)}%" title="${U.fmtTime(i * 30)} ${U.num(v / 30)}"></i>`).join('')}</div>
      <div class="balCols">
        <div><h4>주문별 피해</h4><table class="statTable balTable"><tr><th>주문</th><th>유효</th><th>DPS</th><th>비율</th><th>넘친 피해</th></tr>
          ${dmg.map(([k, v]) => `<tr><td>${this.srcName(k)}</td><td>${U.num(v[1])}</td><td>${U.num(v[1] / t)}</td><td>${(v[1] / tot * 100).toFixed(1)}%</td><td class="dim">${this.pc(v[0] - v[1], v[0])}</td></tr>`).join('')}</table></div>
        <div><h4>보스</h4><table class="statTable balTable"><tr><th>보스</th><th>등장</th><th>처치</th><th>보스 DPS</th><th>주력</th></tr>
          ${L.boss.map(b => { const bd = Object.values(b.dmg).reduce((a, c) => a + c, 0), main = Object.entries(b.dmg).sort((a, c) => c[1] - a[1]).slice(0, 2);
            return `<tr><td>${this.bossName(b.id)}</td><td>${U.fmtTime(b.at)}</td><td>${b.kill != null ? U.fmtTime(b.kill) + ` <span class="dim small">(${Math.round(b.kill - b.at)}초)</span>` : '-'}</td><td>${b.kill != null && b.first != null ? U.num(bd / Math.max(1, b.kill - b.first)) : '-'}</td>
              <td class="small">${main.map(([k, v]) => `${this.srcName(k)} ${(v / (bd || 1) * 100).toFixed(0)}%`).join('<br>')}</td></tr>`; }).join('')}</table></div>
        <div><h4>선택 순서</h4><table class="statTable balTable"><tr><th>시각</th><th>레벨</th><th>고른 것</th><th>나머지</th></tr>
          ${L.picks.map(p => `<tr><td>${U.fmtTime(p[0])}${p[5] ? ' <span title="상자">📦</span>' : ''}</td><td>${p[1]}</td><td>${p[2] === 'skip' ? '<span class="dim">건너뜀</span>' : this.pickName(p[2])}</td>
            <td class="small dim">${p[3].filter(k => k !== p[2]).map(k => this.pickName(k)).join('<br>')}</td></tr>`).join('')}</table></div>
      </div>`;
    $('balBack').onclick = e => { e.preventDefault(); this.render($('lbMain')); };
  },

  // 같은 조건의 판 기록 원본을 파일로 (따로 분석하거나 Claude에게 넘길 때)
  async exportJson() {
    try {
      const r = await G.Net.api('GET', '/api/admin/runlogs?' + this.q({ full: 1, limit: 2000 }));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(r.rows)], { type: 'application/json' }));
      a.download = `runlogs-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { G.UI.toast(e.message); }
  },
};
