'use strict';
// ================= 서버 통신 (계정 / 세이브 / 건의사항) =================
G.Net = {
  token: null,
  user: null,         // { username, admin } — 로그인 중일 때만
  online: false,      // 서버에 연결되었는지
  dirty: false, flushing: false, retryT: null,

  async api(method, url, body) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    let res;
    try { res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
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
    try { res = await fetch('/api/me', { headers: this.token ? { Authorization: 'Bearer ' + this.token } : {} }); }
    catch (e) { return; }
    this.online = res.status === 200 || res.status === 401;
    if (res.status === 200) { const r = await res.json(); this.setSession(this.token, r.user, r.save); }
    else if (this.token && res.status === 401) this.dropSession();
  },

  setSession(token, user, save) {
    this.token = token; this.user = user;
    try { localStorage.setItem('frostmage_token', token); } catch (e) { /* 무시 */ }
    G.Meta.useAccount(save);
  },
  dropSession() {
    this.token = null; this.user = null; this.dirty = false;
    try { localStorage.removeItem('frostmage_token'); } catch (e) { /* 무시 */ }
    G.Meta.load();
  },

  async login(username, password) {
    const r = await this.api('POST', '/api/auth/login', { username, password });
    this.setSession(r.token, r.user, r.save);
  },
  async register(username, password) {
    // 게스트로 모은 골드/강화를 새 계정으로 가져간다
    const r = await this.api('POST', '/api/auth/register', { username, password, save: G.Meta.guestData() });
    this.setSession(r.token, r.user, r.save);
  },
  async logout() {
    try { await this.api('POST', '/api/auth/logout'); } catch (e) { /* 이미 만료되어도 로컬에서는 로그아웃 */ }
    this.dropSession();
  },

  // 세이브: 가장 최신 데이터만 순서대로 올리고, 실패하면 잠시 후 재시도
  pushSave() { this.dirty = true; this.flush(); },
  async flush() {
    if (this.flushing || !this.dirty || !this.user) return;
    this.flushing = true; this.dirty = false;
    try { await this.api('PUT', '/api/save', { save: G.Meta.data }); }
    catch (e) {
      if (this.user) {
        this.dirty = true;
        G.UI.toast('세이브 동기화 실패 — 잠시 후 다시 시도합니다.');
        clearTimeout(this.retryT); this.retryT = setTimeout(() => { this.retryT = null; this.flush(); }, 10000);
      }
    } finally { this.flushing = false; }
    if (this.dirty && !this.retryT) this.flush();
  },
};
