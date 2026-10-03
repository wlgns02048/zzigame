'use strict';
// ================= 판 기록 · 밸런스 분석 (관리자) =================
// 브라우저가 판 보고에 실어 보내는 기록(js/runlog.js)을 다듬어 run_logs에 저장하고,
// 관리자 전용 API로 직업 · 전문화별 DPS · 보스 처치 시간 · 주문 선택률 · 주문별 피해 비중을 모아 준다.
// 기록은 플레이어 브라우저가 만든 값이라 조작될 수 있다 — 거부된 판은 빼고, 판정에는 쓰지 않고 참고용으로만 본다.

module.exports = ({ db, route, fail }) => {
  // ---------- 저장 (보고 검증을 통과한 판만) ----------
  const KEY = /^[\w:.\-]{1,60}$/;
  const key = s => (typeof s === 'string' && KEY.test(s) ? s : null);
  const num = (v, max = 1e12) => { v = +v; return Number.isFinite(v) ? Math.max(-max, Math.min(max, v)) : 0; };
  const r1 = v => Math.round(num(v) * 10) / 10;
  // { 키: 값 } → 키를 검사하고 값을 f로 다듬는다 (n개까지)
  const map = (o, f, n = 200) => {
    const out = {};
    if (o && typeof o === 'object' && !Array.isArray(o)) for (const k of Object.keys(o).slice(0, n)) { const kk = key(k); if (kk) out[kk] = f(o[k]); }
    return out;
  };
  const list = (a, f, n) => (Array.isArray(a) ? a.slice(0, n).map(f) : []);
  const clean = L => {
    if (!L || typeof L !== 'object') return null;
    return {
      v: typeof L.v === 'string' ? L.v.slice(0, 16) : '', spec: key(L.spec) || '', ilvl: num(L.ilvl, 1000),
      talents: map(L.talents, v => num(v, 100)), lib: map(L.lib, v => num(v, 100)),
      stats0: map(L.stats0, num, 40), stats1: map(L.stats1, num, 40),
      dmg: map(L.dmg, v => (Array.isArray(v) ? [num(v[0]), num(v[1])] : [0, 0])),
      boss: list(L.boss, b => ({
        id: key(b && b.id) || '?', hp: num(b && b.hp), at: r1(b && b.at),
        kill: b && b.kill != null ? r1(b.kill) : null, first: b && b.first != null ? r1(b.first) : null, dmg: map(b && b.dmg, num),
      }), 60),
      tl: list(L.tl, num, 480),
      picks: list(L.picks, p => (Array.isArray(p) ? [r1(p[0]), num(p[1], 1000), key(p[2]) || '?', list(p[3], x => key(x) || '?', 8), num(p[4], 10), p[5] ? 1 : 0] : [0, 0, '?', [], 0, 0]), 400),
      taken: map(L.taken, num),
      death: L.death && typeof L.death === 'object' ? { t: r1(L.death.t), by: key(L.death.by), lv: num(L.death.lv, 1000) } : null,
      skills: map(L.skills, s => ({ lv: num(s && s.lv, 100), ranks: map(s && s.ranks, v => num(v, 100), 40) }), 40),
      passives: map(L.passives, v => (Array.isArray(v) ? [num(v[0], 100), num(v[1], 1e6)] : [0, 0]), 40),
      legend: list(L.legend, x => key(x) || '?', 40), evo: list(L.evo, x => key(x) || '?', 40),
      endless: num(L.endless, 1000),
    };
  };
  const saveLog = (uid, runId, raw) => {
    const L = clean(raw); if (!L) return;
    let dmg = 0, eff = 0; for (const k in L.dmg) { dmg += L.dmg[k][0]; eff += L.dmg[k][1]; }
    db.prepare(`INSERT INTO run_logs (run_id, user_id, version, dmg, eff, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (run_id) DO UPDATE SET version = excluded.version, dmg = excluded.dmg, eff = excluded.eff, data = excluded.data, updated_at = excluded.updated_at`)
      .run(runId, uid, L.v, dmg, eff, JSON.stringify(L), Date.now());
  };

  // ---------- 조회 (관리자) ----------
  const admin = u => (u && u.info.admin) || fail(403, '관리자만 볼 수 있습니다.');
  // 공통 필터: days · stage · difficulty · cls · spec · version · ilvlMin · ilvlMax · user · minT(초, 이보다 짧은 판 제외)
  const query = (url, cols, lim) => {
    const q = k => url.searchParams.get(k);
    const days = Math.min(365, Math.max(1, +q('days') || 14));
    const where = ["r.status != 'rejected'", 'l.updated_at >= ?'], args = [Date.now() - days * 86400000];
    const eq = (col, v) => { if (v) { where.push(`${col} = ?`); args.push(v); } };
    eq('r.stage', q('stage')); eq('r.difficulty', q('difficulty')); eq('r.cls', q('cls')); eq('r.spec', q('spec')); eq('l.version', q('version'));
    eq('us.username', q('user'));
    if (+q('ilvlMin')) { where.push('r.ilvl >= ?'); args.push(+q('ilvlMin')); }
    if (+q('ilvlMax')) { where.push('r.ilvl <= ?'); args.push(+q('ilvlMax')); }
    const minT = q('minT') == null ? 60 : Math.max(0, +q('minT') || 0);
    where.push('r.t >= ?'); args.push(minT);
    return db.prepare(`SELECT ${cols} FROM run_logs l JOIN runs r ON r.id = l.run_id JOIN users us ON us.id = r.user_id
      WHERE ${where.join(' AND ')} ORDER BY l.updated_at DESC LIMIT ${lim}`).all(...args);
  };
  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const pct = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const stat = a => ({ n: a.length, mean: mean(a), med: median(a), p25: pct(a, 0.25), p75: pct(a, 0.75) });
  const groupKey = r => `${r.cls}/${r.spec || ''}`;

  route('GET', '/api/admin/balance', async (req, u, url) => {
    admin(u);
    const rows = query(url, 'r.id, r.user_id, r.cls, r.spec, r.stage, r.difficulty, r.ilvl, r.t, r.level, r.clear_t, r.endless_lv, l.version, l.data', 5000);
    const BUCKET = 30, groups = {}, stages = {}, bosses = {}, versions = new Set();
    for (const r of rows) {
      const L = JSON.parse(r.data), gk = groupKey(r);
      versions.add(r.version);
      const g = groups[gk] ||= {
        cls: r.cls, spec: r.spec, runs: 0, users: new Set(), ilvl: [], t: [], clears: 0, deaths: 0, eff: [], raw: [], bossDps: [],
        src: {}, bossSrc: {}, offered: {}, picked: {}, pickedRuns: {}, skills: {}, legend: {}, evo: {}, tlSum: [], tlN: [], deathBy: {}, firstPicks: {},
      };
      g.runs++; g.users.add(r.user_id); g.ilvl.push(r.ilvl); g.t.push(r.t);
      if (r.clear_t != null) g.clears++;
      if (L.death) { g.deaths++; const b = L.death.by || 'etc'; g.deathBy[b] = (g.deathBy[b] || 0) + 1; }
      let raw = 0, eff = 0;
      for (const k in L.dmg) { raw += L.dmg[k][0]; eff += L.dmg[k][1]; g.src[k] = (g.src[k] || 0) + L.dmg[k][1]; }
      g.eff.push(eff / r.t); g.raw.push(raw / r.t);
      // 보스: 첫 피해부터 처치까지의 단일 대상 DPS
      for (const b of L.boss) {
        let bd = 0; for (const k in b.dmg) { bd += b.dmg[k]; g.bossSrc[k] = (g.bossSrc[k] || 0) + b.dmg[k]; }
        if (b.kill == null || b.first == null) continue;
        const dur = Math.max(1, b.kill - b.first), dps = bd / dur;
        g.bossDps.push(dps);
        const bb = (bosses[b.id] ||= {})[gk] ||= { ttk: [], dps: [] };
        bb.ttk.push(b.kill - b.at); bb.dps.push(dps);
      }
      // 30초 구간별 유효 DPS (그 구간을 끝까지 산 판만)
      L.tl.forEach((v, i) => { if ((i + 1) * BUCKET > r.t || i >= 120) return; g.tlSum[i] = (g.tlSum[i] || 0) + v / BUCKET; g.tlN[i] = (g.tlN[i] || 0) + 1; });
      // 선택: 제시 횟수 · 고른 횟수 · 고른 판 수
      const seen = new Set();
      L.picks.forEach((p, i) => {
        for (const k of p[3]) g.offered[k] = (g.offered[k] || 0) + 1;
        if (p[2] === 'skip') return;
        g.picked[p[2]] = (g.picked[p[2]] || 0) + 1;
        if (!seen.has(p[2])) { seen.add(p[2]); g.pickedRuns[p[2]] = (g.pickedRuns[p[2]] || 0) + 1; }
        if (i < 3 && p[2].startsWith('new:')) g.firstPicks[p[2]] = (g.firstPicks[p[2]] || 0) + 1;
      });
      for (const id in L.skills) { const s = g.skills[id] ||= { n: 0, lv: 0 }; s.n++; s.lv += L.skills[id].lv; }
      for (const id of L.legend) g.legend[id] = (g.legend[id] || 0) + 1;
      for (const id of L.evo) g.evo[id] = (g.evo[id] || 0) + 1;
      // 스테이지 · 난이도별
      const st = ((stages[`${r.stage}/${r.difficulty}`] ||= { stage: r.stage, difficulty: r.difficulty, groups: {} }).groups[gk] ||= { runs: 0, clears: 0, eff: [], clearT: [], bossDps: [], ilvl: [] });
      st.runs++; st.eff.push(eff / r.t); st.ilvl.push(r.ilvl);
      if (r.clear_t != null) { st.clears++; st.clearT.push(r.clear_t); }
      for (const b of L.boss) if (b.kill != null && b.first != null) { let bd = 0; for (const k in b.dmg) bd += b.dmg[k]; st.bossDps.push(bd / Math.max(1, b.kill - b.first)); }
    }
    const out = Object.entries(groups).map(([gk, g]) => ({
      key: gk, cls: g.cls, spec: g.spec, runs: g.runs, users: g.users.size, clears: g.clears, deaths: g.deaths,
      ilvl: stat(g.ilvl), t: stat(g.t), eff: stat(g.eff), raw: stat(g.raw), bossDps: stat(g.bossDps),
      src: g.src, bossSrc: g.bossSrc, offered: g.offered, picked: g.picked, pickedRuns: g.pickedRuns, firstPicks: g.firstPicks,
      skills: g.skills, legend: g.legend, evo: g.evo, deathBy: g.deathBy,
      tl: g.tlSum.map((s, i) => (g.tlN[i] ? { dps: s / g.tlN[i], n: g.tlN[i] } : null)),
    }));
    return {
      total: rows.length, versions: [...versions].sort().reverse(), groups: out,
      stages: Object.values(stages).map(s => ({ stage: s.stage, difficulty: s.difficulty, groups: Object.fromEntries(Object.entries(s.groups).map(([k, x]) => [k, {
        runs: x.runs, clears: x.clears, eff: median(x.eff), clearT: median(x.clearT), bossDps: median(x.bossDps), ilvl: mean(x.ilvl),
      }])) })),
      bosses: Object.fromEntries(Object.entries(bosses).map(([id, gs]) => [id, Object.fromEntries(Object.entries(gs).map(([k, x]) => [k, { n: x.ttk.length, ttk: median(x.ttk), dps: median(x.dps) }]))])),
    };
  });

  // 판 목록 (?full=1 이면 기록 원본까지 — 내려받아 따로 분석할 때)
  route('GET', '/api/admin/runlogs', async (req, u, url) => {
    admin(u);
    const full = url.searchParams.get('full') === '1', lim = Math.min(full ? 2000 : 300, Math.max(1, +url.searchParams.get('limit') || 100));
    const rows = query(url, `r.id, us.username, r.cls, r.spec, r.stage, r.difficulty, r.ilvl, r.t, r.level, r.kills, r.clear_t, r.endless_lv, r.boss_kills, r.status,
      l.version, l.dmg, l.eff, l.updated_at${full ? ', l.data' : ''}`, lim);
    return { rows: rows.map(r => (full ? { ...r, data: JSON.parse(r.data) } : r)) };
  });
  // 판 하나의 기록
  route('GET', '/api/admin/runlog', async (req, u, url) => {
    admin(u);
    const r = db.prepare(`SELECT r.id, us.username, r.cls, r.spec, r.stage, r.difficulty, r.ilvl, r.t, r.level, r.kills, r.clear_t, r.endless_lv, r.boss_kills, r.status,
      l.version, l.data, l.updated_at FROM run_logs l JOIN runs r ON r.id = l.run_id JOIN users us ON us.id = r.user_id WHERE l.run_id = ?`).get(String(url.searchParams.get('id')));
    if (!r) fail(404, '기록이 없습니다.');
    return { ...r, data: JSON.parse(r.data) };
  });

  return { saveLog };
};
