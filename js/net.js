'use strict';
// ================= 서버 통신 (계정 / 세이브 / 건의사항) — 채팅은 js/chat.js =================
G.Net = {
  token: null,
  user: null,         // { username, admin } — 로그인 중일 때만
  online: false,      // 서버에 연결되었는지
  busy: 0,            // 진행 중인 요청 수 (새 버전 새로고침이 보상 정산 등을 끊지 않도록 — js/update.js)

  // 공개 주소(GitHub Pages)에서 열리면 화면은 Pages가, 서버 기능은 나스 베타 서버가 맡는다
  base: location.hostname === 'icecrown-trial.duckdns.org' ? 'https://Godlovesyou.synology.me:10443' : '',

  async api(method, url, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    let res;
    this.busy++;
    try { res = await fetch(this.base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw Object.assign(new Error('서버에 연결할 수 없습니다.'), { down: true }); }
    finally { this.busy--; }
    // 리버스 프록시가 대신 답하는 502~504 = 서버 재시작 중
    if (res.status >= 502 && res.status <= 504) throw Object.assign(new Error(`서버 오류 (${res.status})`), { down: true });
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
    if (G.Chat.el) G.Chat.poll(); // 접속자 목록의 이름 · 채팅 입력창을 바로 바꾼다
  },
  dropSession() {
    this.token = null; this.user = null;
    try { localStorage.removeItem('frostmage_token'); } catch (e) { /* 무시 */ }
    G.Meta.reset();
    if (G.Chat.el) G.Chat.poll();
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

  // 서버가 잠깐 내려가 있을 때(배포 재시작 등)만 다시 시도한다. 4xx · 500처럼 서버가 답한 실패는 바로 던진다.
  // 1 · 2 · 4 · 8 · 8 … 초 간격으로 limit(기본 60초)까지.
  async apiRetry(method, url, body, onWait, limit = 60000) {
    const t0 = Date.now();
    for (let i = 0, wait = 1000; ; i++, wait = Math.min(wait * 2, 8000)) {
      try { return await this.api(method, url, body); }
      catch (e) {
        if (!e.down || Date.now() - t0 + wait > limit) throw e;
        if (onWait) onWait(i + 1);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  },

  // ---------- 런 ----------
  // 시작 요청은 기다리지 않고 바로 게임을 시작한다. 보고할 때 시작 응답을 기다린다.
  startRun(cls, stage, difficulty) {
    const run = { id: null };
    // 시작 등록이 늦어지면 서버의 시간 검증(실제 경과 + 20초 여유)에 걸리므로 15초까지만 다시 시도한다
    run.ready = this.apiRetry('POST', '/api/runs/start', { cls, stage, difficulty }, null, 15000)
      .then(r => { run.id = r.runId; run.affixes = r.affixes; })
      .catch(e => { run.error = e.message; G.UI.toast('서버 등록 실패 — 이번 판 보상은 저장되지 않습니다. (' + e.message + ')'); });
    return run;
  },
  // 누적값 보고 → { gain, loot, endlessLv, profile }
  // 보고는 누적값이라(서버가 이미 지급한 만큼은 빼고 준다) 같은 보고를 다시 보내도 중복 지급되지 않는다.
  // 재시도 대기 중에도 busy로 센다 (그 사이 새로고침되면 보상이 저장되지 않으므로)
  async reportRun(run, { victory, final }, onWait) {
    this.busy++;
    try {
      await run.ready;
      if (!run.id) throw new Error(run.error || '서버에 기록되지 않은 판입니다.');
      const r = await this.apiRetry('POST', '/api/runs/report', {
        runId: run.id, t: G.t, kills: G.stats.kills, gold: G.stats.gold, level: G.player.level, bossKills: G.Waves.bossKills, lust: G.stats.lust, victory, final,
      }, onWait);
      G.Meta.useProfile(r.profile);
      return r;
    } finally { this.busy--; }
  },
};
