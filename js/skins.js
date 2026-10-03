'use strict';
// ================= 외형 (스킨) =================
// 직업마다 고를 수 있는 캐릭터 그림. 첫 항목이 기본(코드로 그린 그림)이고, src가 있는 항목은 assets/skins/의 투명 PNG다.
// 그림 규격: 화면 크기(w × h)의 2배로 그리고, 오른쪽을 보게(왼쪽은 코드가 뒤집음), 발이 아래쪽 가운데에 오게.
//   ax · ay = 화면 크기 기준 발 위치 (그림 왼쪽 위에서), staff = 발 기준 지팡이 수정 빛 위치
//   walk = 걷기 프레임 만들기 (G.Spr.walkFrames의 rig) + cycle = 걸음 한 바퀴(두 발짝)에 걷는 거리(px) — 이동 속도에 맞춰 빨라진다
// 고른 외형은 이 브라우저 설정(skins: { 직업: 외형 id })에 저장되고, 판을 시작할 때 G.Spr.player에 입힌다.
G.Skins = {
  LIST: {
    mage: [
      { id: 'default', name: '기본' },
      { id: 'snow', name: '눈꽃 마법사', src: 'assets/skins/mage_snow.png', w: 64, h: 76, ax: 32, ay: 74, staff: [16, -60],
        walk: { cycle: 96, legY: 110, footY: 120, legs: [[44, 61], [64, 85]] } },
    ],
  },
  imgs: {},
  of(cls) { return this.LIST[cls] || []; },
  get(cls) {
    const id = (G.Settings.get('skins') || {})[cls], list = this.of(cls);
    return list.find(s => s.id === id) || list[0] || null;
  },
  set(cls, id) {
    G.Settings.set('skins', { ...(G.Settings.get('skins') || {}), [cls]: id });
    this.load(this.get(cls));
  },
  // 그림은 처음 쓸 때 한 번만 받는다 (실패하면 null → 기본 그림)
  load(s) {
    if (!s || !s.src) return Promise.resolve(null);
    return (this.imgs[s.src] ||= new Promise(res => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = `${s.src}?v=${G.VERSION}`;
    }));
  },
  preload() { for (const cls in this.LIST) this.load(this.get(cls)); },
  // 판 시작: 기본 그림으로 돌려 두고, 고른 외형 그림이 준비되면 입힌다
  apply(cls) {
    const s = this.get(cls);
    this.want = cls;
    G.Spr.usePlayerSkin(null);
    if (s && s.src) this.load(s).then(im => { if (im && this.want === cls) G.Spr.usePlayerSkin(s, im); });
  },
  // 로비 미리보기 그림 주소
  thumb(s) {
    if (s.src) return `${s.src}?v=${G.VERSION}`;
    return (this.defThumb ||= G.Spr.basePlayer.toDataURL());
  },
};
