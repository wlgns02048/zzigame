'use strict';
// ================= 접속자 · 채팅 =================
// 화면 오른쪽 아래의 접속자/채팅 창. 서버를 몇 초마다 폴링한다 (server/chat.js).
// 판 중에는 창을 숨기고 접속 표시만 드물게 갱신한다 (다른 사람에게 "출정 중: 스테이지"로 보임).
G.Chat = {
  open: false, tab: 'chat', lastId: 0, msgs: [], online: [], guests: 0, unread: 0, timer: null, busy: false, el: null,
  cid: null, // 게스트 접속자를 세기 위한 탭별 임의 id

  init() {
    if (!G.Net.online) return;
    try { this.open = localStorage.getItem('frostmage_chat_open') === '1'; } catch (e) { /* 저장소 사용 불가 */ }
    this.cid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const el = this.el = document.createElement('div');
    el.id = 'chat';
    el.innerHTML = `<button class="chatPill" type="button"><b class="chatDot"></b><span class="chatCount">접속 중</span><span class="chatUnread hidden"></span></button>
      <div class="chatBox">
        <div class="chatHead"><a href="#" data-ctab="chat">채팅</a><a href="#" data-ctab="who">접속자 <span class="chatN"></span></a><button class="chatX" type="button" title="닫기">✕</button></div>
        <div class="chatMsgs"></div>
        <div class="chatWho hidden"></div>
        <form class="chatForm"><input maxlength="200" placeholder="메시지 입력 (Enter)" autocomplete="off"><button class="btn small" type="submit">전송</button></form>
        <div class="chatGuest hidden">로그인하면 채팅할 수 있습니다. <button class="btn small" type="button">로그인</button></div>
      </div>`;
    $('game').appendChild(el);
    el.querySelector('.chatPill').onclick = () => this.toggle(true);
    el.querySelector('.chatX').onclick = () => this.toggle(false);
    el.querySelectorAll('[data-ctab]').forEach(a => (a.onclick = e => { e.preventDefault(); this.tab = a.dataset.ctab; this.render(); }));
    el.querySelector('.chatGuest button').onclick = () => G.UI.showAuth();
    el.querySelector('.chatForm').onsubmit = e => { e.preventDefault(); this.send(); };
    // 판 중에는 숨김 (게임 키 입력과 화면을 가리지 않도록)
    setInterval(() => el.classList.toggle('hidden', G.state === 'play'), 250);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.poll(); });
    this.render();
    this.poll();
  },

  toggle(open) {
    this.open = open;
    try { localStorage.setItem('frostmage_chat_open', open ? '1' : '0'); } catch (e) { /* 무시 */ }
    if (open) { this.unread = 0; this.poll(); }
    this.render();
    if (open && G.Net.user) this.el.querySelector('.chatForm input').focus();
  },

  where() { return G.state === 'play' && G.runInfo ? `${G.runInfo.stage}:${G.runInfo.diff}` : 'lobby'; },
  // 창을 열어 두면 자주, 닫혀 있거나 판 중 · 백그라운드면 드물게
  interval() {
    if (document.hidden) return 60000;
    if (G.state === 'play') return 30000;
    return this.open ? 3000 : 15000;
  },

  async poll() {
    clearTimeout(this.timer);
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await G.Net.api('POST', '/api/chat/poll', { after: this.lastId, cid: this.cid, where: this.where() });
      this.online = r.online; this.guests = r.guests;
      const gone = new Set(r.deleted);
      const fresh = r.messages.filter(m => m.id > this.lastId);
      if (!this.lastId) this.msgs = fresh; // 처음: 최근 대화 (안 읽음으로 세지 않음)
      else {
        const me = G.Net.user && G.Net.user.username;
        if (!this.open || G.state === 'play') this.unread += fresh.filter(m => m.name !== me).length;
        this.msgs = this.msgs.concat(fresh);
      }
      if (fresh.length) this.lastId = fresh[fresh.length - 1].id;
      this.msgs = this.msgs.filter(m => !gone.has(m.id)).slice(-200);
      this.render();
    } catch (e) { /* 서버 재시작 중 등 — 다음 폴링에 다시 시도 */ }
    this.busy = false;
    this.timer = setTimeout(() => this.poll(), this.interval());
  },

  async send() {
    const inp = this.el.querySelector('.chatForm input'), text = inp.value.trim();
    if (!text) return;
    inp.disabled = true;
    try { await G.Net.api('POST', '/api/chat', { text }); inp.value = ''; this.poll(); }
    catch (e) { G.UI.toast(e.message); }
    inp.disabled = false; inp.focus();
  },

  placeName(where) {
    if (where === 'lobby') return '달라란';
    const [stage, diff] = where.split(':'), S = G.STAGE_DATA.STAGES[stage], D = G.STAGE_DATA.DIFFICULTY[diff];
    return S ? `출정 중 · ${S.name}${D && diff !== 'normal' ? ` (${D.name})` : ''}` : '출정 중';
  },
  time(at) { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },

  render() {
    const el = this.el; if (!el) return;
    const n = this.online.length + this.guests, me = G.Net.user;
    el.classList.toggle('open', this.open);
    el.querySelector('.chatCount').textContent = `접속 중 ${n}명 · 채팅`;
    el.querySelector('.chatN').textContent = n;
    const ub = el.querySelector('.chatUnread');
    ub.textContent = this.unread > 99 ? '99+' : this.unread; ub.classList.toggle('hidden', !this.unread);
    el.querySelectorAll('[data-ctab]').forEach(a => a.classList.toggle('on', a.dataset.ctab === this.tab));
    if (!this.open) return;

    const box = el.querySelector('.chatMsgs'), who = el.querySelector('.chatWho');
    box.classList.toggle('hidden', this.tab !== 'chat'); who.classList.toggle('hidden', this.tab !== 'who');
    el.querySelector('.chatForm').classList.toggle('hidden', !me || this.tab !== 'chat');
    el.querySelector('.chatGuest').classList.toggle('hidden', !!me || this.tab !== 'chat');

    if (this.tab === 'chat') {
      const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      box.innerHTML = this.msgs.length ? this.msgs.map(m => `<div class="cm ${me && m.name === me.username ? 'mine' : ''}"><i>${this.time(m.at)}</i>
        <b class="${m.admin ? 'adm' : ''}">${esc(m.name)}</b> ${esc(m.text)}${me && me.admin ? ` <a href="#" class="cmDel" data-cdel="${m.id}" title="삭제">✕</a>` : ''}</div>`).join('')
        : '<div class="dim">아직 대화가 없습니다. 첫 인사를 남겨 보세요!</div>';
      if (atBottom || !this._scrolled) { box.scrollTop = box.scrollHeight; this._scrolled = true; }
      box.querySelectorAll('[data-cdel]').forEach(a => (a.onclick = async e => {
        e.preventDefault();
        try { await G.Net.api('DELETE', '/api/chat/' + a.dataset.cdel); this.msgs = this.msgs.filter(m => m.id !== +a.dataset.cdel); this.render(); }
        catch (err) { G.UI.toast(err.message); }
      }));
    } else {
      who.innerHTML = this.online.map(o => `<div class="cw"><b class="${o.admin ? 'adm' : ''}">${esc(o.name)}</b>${me && o.name === me.username ? ' <span class="dim">(나)</span>' : ''}<small>${esc(this.placeName(o.where))}</small></div>`).join('')
        + (this.guests ? `<div class="cw dim">게스트 ${this.guests}명</div>` : '')
        + (this.online.length || this.guests ? '' : '<div class="dim">접속자가 없습니다.</div>');
    }
  },
};
