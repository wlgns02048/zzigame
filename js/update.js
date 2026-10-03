'use strict';
// ================= 새 버전 자동 적용 =================
// 배포할 때마다 G.VERSION을 올린다 (docs/NAS_DEPLOY.md '버전 관리'). 서버의 js/util.js를 가끔 읽어 버전이 바뀌었으면,
// 판 도중에는 기다렸다가 화면이 바뀔 때(로비 탭 이동 · 로비로 돌아오기 · 출정) 새로고침해서 적용한다.
// 코드는 실행 중에 바꿔 끼울 수 없으므로(이미 만든 적 · 주문 객체가 옛 코드를 붙잡고 있다) 새로고침이 유일하게 안전한 방법이다.
G.Update = {
  latest: null,     // 서버에 올라온 새 버전 (없으면 null)
  reloading: false,
  KEY_TRY: 'frostmage_update_try', KEY_DONE: 'frostmage_update_done',
  ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* 저장소 사용 불가 */ } return null; },

  start() {
    if (G.params.get('sim') || G.params.get('test')) return;
    // 새로고침 주소에 붙였던 ?u= 는 지운다
    if (G.params.has('u')) { const u = new URL(location.href); u.searchParams.delete('u'); history.replaceState(null, '', u); }
    if (this.ss(this.KEY_DONE) === G.VERSION) { this.ss(this.KEY_DONE, null); G.UI.toast(`v${G.VERSION}으로 업데이트되었습니다.`); }
    setInterval(() => this.check(), 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
  },
  async check() {
    if (this.latest) return;
    let v;
    try {
      const r = await fetch(`js/util.js?check=${Date.now()}`, { cache: 'no-store' });
      v = r.ok && ((await r.text()).match(/VERSION:\s*'([^']+)'/) || [])[1];
    } catch { return; } // 오프라인 · 배포 중이면 다음에
    if (!v || v === G.VERSION) return;
    this.latest = v;
    // 이미 이 버전으로 새로고침했는데도 옛 화면이면(중간 캐시) 무한 새로고침하지 않고 안내만
    if (this.ss(this.KEY_TRY) === v) { this.latest = null; G.UI.toast(`새 버전 v${v}이 나왔습니다. 새로고침(F5)하면 적용됩니다.`); return; }
    G.UI.toast(`새 버전 v${v}이 나왔습니다. ${G.state === 'play' ? '이번 판이 끝나고 화면을 옮기면' : '화면을 옮기면'} 적용됩니다.`);
  },
  // 화면이 바뀌는 시점에 부른다. 새로고침을 시작했으면 true (판 도중에는 하지 않는다)
  apply() {
    if (!this.latest || G.state === 'play') return false;
    if (this.reloading) return true;
    this.reloading = true;
    G.UI.toast(`v${this.latest}으로 업데이트합니다…`);
    const go = () => {
      this.ss(this.KEY_TRY, this.latest); this.ss(this.KEY_DONE, this.latest);
      // 주소를 바꿔서 새로고침해야 중간 캐시(Pages 10분)를 거치지 않고 새 index.html을 받는다
      const u = new URL(location.href); u.searchParams.set('u', this.latest); location.replace(u);
    };
    // 보상 정산 같은 서버 요청이 끝날 때까지 기다린다 (최대 20초)
    const t0 = Date.now();
    const wait = () => (G.Net.busy > 0 && Date.now() - t0 < 20000 ? setTimeout(wait, 300) : go());
    wait();
    return true;
  },
};
