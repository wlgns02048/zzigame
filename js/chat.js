'use strict';
// ================= 접속자 · 채팅 =================
// 화면 왼쪽 아래의 접속자/채팅 창. 서버를 몇 초마다 폴링한다 (server/chat.js).
// 판 중에도 보이며(작고 반투명하게), Enter로 입력창을 열고 Enter로 보내면 다시 게임 조작으로 돌아간다.
// 접속자 목록에는 판 중인 사람이 "출정 중: 스테이지"로 보인다.
G.Chat = {
  open: false, tab: 'chat', lastId: 0, msgs: [], online: [], guests: 0, unread: 0, timer: null, busy: false, el: null,
  cid: null, // 게스트 id — 서버가 이걸로 '게스트1234' 이름을 만든다. 브라우저에 간직해 다시 와도 같은 이름
  you: null, // 게스트일 때 서버가 정해 준 이름

  init() {
    if (!G.Net.online) return;
    try { this.open = localStorage.getItem('frostmage_chat_open') === '1'; } catch (e) { /* 저장소 사용 불가 */ }
    try { this.cid = localStorage.getItem('frostmage_guest_id'); } catch (e) { /* 무시 */ }
    if (!/^[\w-]{8,40}$/.test(this.cid || '')) {
      this.cid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem('frostmage_guest_id', this.cid); } catch (e) { /* 무시 */ }
    }
    const el = this.el = document.createElement('div');
    el.id = 'chat';
    el.innerHTML = `<button class="chatPill" type="button"><b class="chatDot"></b><span class="chatCount">접속 중</span><span class="chatUnread hidden"></span></button>
      <div class="chatBox">
        <div class="chatHead"><a href="#" data-ctab="chat">채팅</a><a href="#" data-ctab="who">접속자 <span class="chatN"></span></a><button class="chatX" type="button" title="닫기">✕</button></div>
        <div class="chatMsgs"></div>
        <div class="chatWho hidden"></div>
        <form class="chatForm"><input maxlength="200" placeholder="메시지 입력 (Enter 전송 · Esc 취소)" autocomplete="off"><button class="btn small" type="submit">전송</button></form>
        <div class="chatGuest hidden"><span></span><button class="btn small" type="button">로그인</button></div>
      </div>`;
    $('game').appendChild(el);
    el.querySelector('.chatPill').onclick = () => this.toggle(true);
    el.querySelector('.chatX').onclick = () => this.toggle(false);
    el.querySelectorAll('[data-ctab]').forEach(a => (a.onclick = e => { e.preventDefault(); this.tab = a.dataset.ctab; this.render(); }));
    el.querySelector('.chatGuest button').onclick = () => G.UI.showAuth();
    el.querySelector('.chatForm').onsubmit = e => { e.preventDefault(); this.send(); };
    const inp = el.querySelector('.chatForm input');
    // 입력창에서 Esc: 입력을 그만두고 게임 조작으로 (빈 입력창이면 판 중에는 창도 닫는다)
    inp.addEventListener('keydown', e => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      if (!inp.value && G.state === 'play') this.toggle(false);
      inp.blur();
    });
    // Enter: 채팅 입력 시작 (게임 키 처리보다 먼저 등록됨 — game.js G.Input)
    addEventListener('keydown', e => {
      if ((e.code !== 'Enter' && e.code !== 'NumpadEnter') || e.repeat) return;
      if (e.target.closest && e.target.closest('input, textarea, select, button, a')) return;
      if (G.UI.modalKind || el.classList.contains('hidden')) return;
      e.preventDefault();
      if (!this.open) this.toggle(true);
      this.tab = 'chat'; this.render();
      G.keys = {}; // 누르고 있던 이동 키가 입력 중에 계속 눌린 것으로 남지 않게
      inp.focus();
    });
    // 판 중에는 작고 반투명하게 (레벨업 · 일시정지 창보다는 아래 — css #chat.play)
    setInterval(() => el.classList.toggle('play', G.state === 'play'), 250);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.poll(); });
    this.render();
    this.poll();
  },

  toggle(open) {
    this.open = open;
    try { localStorage.setItem('frostmage_chat_open', open ? '1' : '0'); } catch (e) { /* 무시 */ }
    if (open) { this.unread = 0; this.poll(); }
    this.render();
    if (open && G.state !== 'play') this.el.querySelector('.chatForm input').focus(); // 판 중에는 Enter를 눌러야 입력
  },

  myName() { return G.Net.user ? G.Net.user.username : this.you; },
  where() { return G.state === 'play' && G.runInfo ? `${G.runInfo.stage}:${G.runInfo.diff}` : 'lobby'; },
  // 창을 열어 두면 자주, 닫혀 있거나 백그라운드면 드물게
  interval() {
    if (document.hidden) return 60000;
    return this.open ? 3000 : 15000;
  },

  async poll() {
    clearTimeout(this.timer);
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await G.Net.api('POST', '/api/chat/poll', { after: this.lastId, cid: this.cid, where: this.where() });
      this.online = r.online; this.guests = r.guests; this.you = r.you;
      const gone = new Set(r.deleted);
      const fresh = r.messages.filter(m => m.id > this.lastId);
      if (!this.lastId) this.msgs = fresh; // 처음: 최근 대화 (안 읽음으로 세지 않음)
      else {
        const me = this.myName();
        if (!this.open) this.unread += fresh.filter(m => m.name !== me).length;
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
    try { await G.Net.api('POST', '/api/chat', { text, cid: this.cid }); inp.value = ''; this.poll(); }
    catch (e) { G.UI.toast(e.message); }
    inp.disabled = false;
    if (G.state === 'play') inp.blur(); else inp.focus(); // 판 중이면 보내고 바로 게임 조작으로
  },

  placeName(where) {
    if (where === 'lobby') return '달라란';
    const [stage, diff] = where.split(':'), S = G.STAGE_DATA.STAGES[stage], D = G.STAGE_DATA.DIFFICULTY[diff];
    return S ? `출정 중 · ${S.name}${D && diff !== 'normal' ? ` (${D.name})` : ''}` : '출정 중';
  },
  time(at) { const d = new Date(at); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },

  render() {
    const el = this.el; if (!el) return;
    const n = this.online.length, me = G.Net.user, myName = this.myName();
    el.classList.toggle('open', this.open);
    el.querySelector('.chatCount').textContent = `접속 중 ${n}명 · 채팅`;
    el.querySelector('.chatN').textContent = n;
    const ub = el.querySelector('.chatUnread');
    ub.textContent = this.unread > 99 ? '99+' : this.unread; ub.classList.toggle('hidden', !this.unread);
    el.querySelectorAll('[data-ctab]').forEach(a => a.classList.toggle('on', a.dataset.ctab === this.tab));
    if (!this.open) return;

    const box = el.querySelector('.chatMsgs'), who = el.querySelector('.chatWho');
    box.classList.toggle('hidden', this.tab !== 'chat'); who.classList.toggle('hidden', this.tab !== 'who');
    el.querySelector('.chatForm').classList.toggle('hidden', this.tab !== 'chat');
    const gb = el.querySelector('.chatGuest');
    gb.classList.toggle('hidden', !!me || !this.you || this.tab !== 'chat');
    gb.querySelector('span').textContent = `${this.you || '게스트'}(으)로 대화 중`;

    if (this.tab === 'chat') {
      const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      box.innerHTML = this.msgs.length ? this.msgs.map(m => `<div class="cm ${m.name === myName ? 'mine' : ''}"><i>${this.time(m.at)}</i>
        <b class="${m.admin ? 'adm' : m.guest ? 'gst' : ''}">${esc(m.name)}</b> ${esc(m.text)}${me && me.admin ? ` <a href="#" class="cmDel" data-cdel="${m.id}" title="삭제">✕</a>` : ''}</div>`).join('')
        : '<div class="dim">아직 대화가 없습니다. 첫 인사를 남겨 보세요!</div>';
      if (atBottom || !this._scrolled) { box.scrollTop = box.scrollHeight; this._scrolled = true; }
      box.querySelectorAll('[data-cdel]').forEach(a => (a.onclick = async e => {
        e.preventDefault();
        try { await G.Net.api('DELETE', '/api/chat/' + a.dataset.cdel); this.msgs = this.msgs.filter(m => m.id !== +a.dataset.cdel); this.render(); }
        catch (err) { G.UI.toast(err.message); }
      }));
    } else {
      who.innerHTML = this.online.map(o => `<div class="cw"><b class="${o.admin ? 'adm' : o.guest ? 'gst' : ''}">${esc(o.name)}</b>${o.name === myName ? ' <span class="dim">(나)</span>' : ''}<small>${esc(this.placeName(o.where))}</small></div>`).join('')
        || '<div class="dim">접속자가 없습니다.</div>';
    }
  },
};
