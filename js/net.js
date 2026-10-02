'use strict';
// ================= 서버 통신 (계정 / 세이브 / 건의사항) =================
G.Net = {
  token: null,
  user: null,         // { username, admin } — 로그인 중일 때만
  online: false,      // 서버에 연결되었는지

  // 공개 주소(GitHub Pages)에서 열리면 화면은 Pages가, 서버 기능은 나스 베타 서버가 맡는다
  base: location.hostname === 'icecrown-trial.duckdns.org' ? 'https://Godlovesyou.synology.me:10443' : '',

  async api(method, url, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    let res;
    try { res = await fetch(this.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new Error('서버에 연결할 수 없습니다.'); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && this.token && !url.startsWith('/api/auth/')) this.dropSession();
    if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
    return data;
  },

  // 시작 시 서버 확인 + 저장된 토큰으로 자동 로그인. 서버가 없으면(정적 호스팅 등) 게스트 전용으로 동작
  async init() {
    try { this.token = localStorage.getItem('frostmage_token'); } catch (e) { /* 저장소 사용 불가 */ }
    let res;
    try { res = await fetch(this.base + '/api/me', { headers: this.token ? { Authorization: 'Bearer ' + this.token } : {} }); }
    catch (e) { return; }
    this.online = res.status === 200 || res.status === 401;
    if (res.status === 200) { const r = await res.json(); this.setSession(this.token, r.user, r.profile); }
    else if (this.token && res.status === 401) this.dropSession();
    else if (this.online) G.Meta.reset(); // 서버가 있으면 게스트는 저장 없음
  },

  setSession(token, user, profile) {
    this.token = token; this.user = user;
    try { localStorage.setItem('frostmage_token', token); } catch (e) { /* 무시 */ }
    G.Meta.useProfile(profile);
  },
  dropSession() {
    this.token = null; this.user = null;
    try { localStorage.removeItem('frostmage_token'); } catch (e) { /* 무시 */ }
    G.Meta.reset();
  },

  async login(username, password) {
    const r = await this.api('POST', '/api/auth/login', { username, password });
    this.setSession(r.token, r.user, r.profile);
  },
  async register(username, password) {
    const r = await this.api('POST', '/api/auth/register', { username, password });
    this.setSession(r.token, r.user, r.profile);
  },
  async logout() {
    try { await this.api('POST', '/api/auth/logout'); } catch (e) { /* 이미 만료되어도 로컬에서는 로그아웃 */ }
    this.dropSession();
  },

  // ---------- 런 ----------
  // 시작 요청은 기다리지 않고 바로 게임을 시작한다. 보고할 때 시작 응답을 기다린다.
  startRun(cls, stage, difficulty) {
    const run = { id: null };
    run.ready = this.api('POST', '/api/runs/start', { cls, stage, difficulty })
      .then(r => { run.id = r.runId; run.affixes = r.affixes; })
      .catch(e => { run.error = e.message; G.UI.toast('서버 등록 실패 — 이번 판 보상은 저장되지 않습니다. (' + e.message + ')'); });
    return run;
  },
  // 누적값 보고 → { gain, loot, endlessLv, profile }
  async reportRun(run, { victory, final }) {
    await run.ready;
    if (!run.id) throw new Error(run.error || '서버에 기록되지 않은 판입니다.');
    const r = await this.api('POST', '/api/runs/report', {
      runId: run.id, t: G.t, kills: G.stats.kills, gold: G.stats.gold, level: G.player.level, bossKills: G.Waves.bossKills, victory, final,
    });
    G.Meta.useProfile(r.profile);
    return r;
  },
};
