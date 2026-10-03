'use strict';
// ================= 배경음악 (WebAudio 실시간 합성, 음원 파일 없음) =================
// 던전마다 테마(음계 · 화음 진행 · 악기 · 리듬)를 정해 두고, 박자 스케줄러가 조금 앞서 음을 예약한다.
// 4마디 프레이즈마다 층(패드 · 베이스 → 아르페지오 → 선율)이 들고 나며, 보스가 살아 있으면 북이 더해지고 템포가 오른다.
// 선율은 테마 id로 시드를 정해 만들므로 같은 던전은 늘 같은 주제 선율을 갖는다.
(() => {
  const SC = {
    aeol: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10], phry: [0, 1, 3, 5, 7, 8, 10],
    harm: [0, 2, 3, 5, 7, 8, 11], ion: [0, 2, 4, 5, 7, 9, 11],
  };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const mod = (a, n) => ((a % n) + n) % n;

  // 패턴 문자: 화음 패턴은 숫자 = 화음 구성음 번호(0 근음, 1 3음, 2 5음, 3~ 한 옥타브 위), '-' 이전 음 유지, 'c' 화음 전체.
  // 선율 리듬(2마디)은 'x' 음 시작, '-' 유지. 타악기는 'X' 강, 'x' 약.
  // 타악기 키: k 킥, t 타이코, r 심장 박동, o 탐, s 스네어, h 하이햇, m 모루(곡괭이), b 종(짝수 마디만)
  const THEMES = {
    // 로비: 달라란 같은 평온함
    lobby: {
      calm: true, bpm: 72, steps: 16, root: 55, scale: SC.ion, prog: [0, 3, 5, 4], verb: 0.45,
      pad: { inst: 'warm', vol: 0.03, cut: 1200 },
      bass: { pat: '0-------2-------', wave: 'sine', vol: 0.12 },
      arp: { inst: 'harp', pat: '0.1.2.3.4.3.2.1.', vol: 0.05, oct: 1 },
      mel: { inst: 'flute', rhythm: 'x--.x.x-x---x-x-x--.x.x-x-------', vol: 0.05, oct: 1 },
      drums: {},
    },
    // 죽음의 폐광: 해적 · 광산, 셋잇단 뱃노래
    mine: {
      bpm: 88, div: 3, steps: 12, root: 50, scale: SC.dor, prog: [0, 0, 6, 3], verb: 0.25, bossBpm: 1.1,
      pad: { inst: 'warm', vol: 0.028, cut: 900 },
      bass: { pat: '0-.2-.0-.2-.', wave: 'triangle', vol: 0.14 },
      arp: { inst: 'pluck', pat: '0.1.2.3.2.1.', vol: 0.045, oct: 1 },
      mel: { inst: 'flute', rhythm: 'x-.x.xx-.x..x-.x.xx--...', vol: 0.05, oct: 1 },
      drums: { k: 'X.....x.....', m: '...x.....x..', h: '..x..x..x..x' },
      boss: { k: 'X..x..X..x..', s: '...X.....X.x', m: 'x..x..x..x..' },
    },
    // 그림자송곳니 성채: 고딕, 하프시코드와 오르간
    forest: {
      bpm: 70, steps: 16, root: 50, scale: SC.harm, prog: [0, 5, 3, 4], verb: 0.45, wind: true,
      pad: { inst: 'organ', vol: 0.02 },
      bass: { pat: '0-------2-------', wave: 'sawtooth', cut: 500, vol: 0.1 },
      arp: { inst: 'harpsi', pat: '0121312101213121', vol: 0.025, oct: 1 },
      mel: { inst: 'violin', rhythm: 'x-----x-x-x-x---x-----x-x---x---', vol: 0.05, oct: 1 },
      drums: { k: 'x.......x.......', b: 'x...............' },
      boss: { k: 'X..x....X..x....', s: '....X.......X...', o: '..............xx' },
    },
    // 붉은십자군 수도원: 성가대 · 오르간 · 종
    monastery: {
      bpm: 64, steps: 16, root: 52, scale: SC.phry, prog: [0, 1, 0, 6], verb: 0.6,
      pad: { inst: 'organ', vol: 0.022 },
      bass: { pat: '0---------------', wave: 'sine', vol: 0.13 },
      arp: { inst: 'bell', pat: '0...1...2...1...', vol: 0.035, oct: 1 },
      mel: { inst: 'choir', rhythm: 'x---x---x-x-x---x---x-x-x-------', vol: 0.05, oct: 1 },
      drums: { k: 'x.......x.......', b: 'x...............' },
      boss: { k: 'X...X...X...X...', s: '....x.......x.xx', o: 'x.x.............' },
    },
    // 스칼로맨스: 오르골과 시계 초침
    crypt: {
      bpm: 78, steps: 16, root: 49, scale: SC.harm, prog: [0, 5, 1, 4], verb: 0.55, wind: true,
      pad: { inst: 'choir', vol: 0.018 },
      bass: { pat: '0-------0-------', wave: 'sine', vol: 0.12 },
      arp: { inst: 'musicbox', pat: '0.1.2.4.3.2.1...', vol: 0.035, oct: 2 },
      mel: { inst: 'bell', rhythm: 'x...x...x.x.x...x...x.x.x-------', vol: 0.04, oct: 1 },
      drums: { r: 'x.x.............', h: '..x...x...x...x.' },
      boss: { r: 'X.x.....X.x.....', s: '....x.......x...', o: '............x.x.' },
    },
    // 스트라솔름: 불타는 도시의 행진
    ruins: {
      bpm: 100, steps: 16, root: 53, scale: SC.aeol, prog: [0, 5, 2, 6], verb: 0.35,
      pad: { inst: 'strings', vol: 0.022 },
      bass: { pat: '0.0.0.0.2.2.3.2.', wave: 'sawtooth', cut: 600, vol: 0.09 },
      arp: { inst: 'brass', pat: 'c.......c...c.c.', vol: 0.035, oct: 0 },
      mel: { inst: 'violin', rhythm: 'x---x-x-x---x-x-x---x-x-x-x-x---', vol: 0.05, oct: 1 },
      drums: { k: 'X.......X.......', s: 'x..x.x..x..x.xxx' },
      boss: { k: 'X..X..X.X..X..X.', s: '....X.......X.xx', h: 'x.x.x.x.x.x.x.x.' },
    },
    // 화산 심장부: 타이코와 낮은 금관
    lava: {
      bpm: 90, steps: 16, root: 48, scale: SC.phry, prog: [0, 0, 1, 0], verb: 0.3, bossBpm: 1.08,
      pad: { inst: 'warm', vol: 0.03, cut: 500 },
      bass: { pat: '0--0--0-0--0--1-', wave: 'sawtooth', cut: 350, vol: 0.12 },
      arp: { inst: 'brass', pat: 'c...........c.c.', vol: 0.03, oct: 0 },
      mel: { inst: 'brass', rhythm: 'x-------x---x---x---x---x-------', vol: 0.045, oct: 0 },
      drums: { t: 'X..x..x.X...x...' },
      boss: { t: 'X..x..x.X..x.xx.', s: '....X.......X...', k: 'x.......x.......' },
    },
    // 검은날개 둥지: 빠른 현 오스티나토와 금관
    lair: {
      bpm: 112, steps: 16, root: 52, scale: SC.harm, prog: [0, 3, 5, 4], verb: 0.35,
      pad: { inst: 'strings', vol: 0.02 },
      bass: { pat: '0.0.0.0.0.0.0.0.', wave: 'sawtooth', cut: 500, vol: 0.08 },
      arp: { inst: 'pluck', pat: '0102010201020102', vol: 0.03, oct: 1 },
      mel: { inst: 'brass', rhythm: 'x-----x-x-------x-----x-x---x---', vol: 0.05, oct: 1 },
      drums: { k: 'X.....x.X.......', o: '............x.x.' },
      boss: { k: 'X.x...x.X.x...x.', s: '....X.......X...', o: '..........x.x.xx', h: '..x...x...x...x.' },
    },
    // 낙스라마스: 느린 심장 박동과 성가대
    necropolis: {
      bpm: 58, steps: 16, root: 47, scale: SC.phry, prog: [0, 4, 0, 1], verb: 0.6, wind: true,
      pad: { inst: 'choir', vol: 0.022 },
      bass: { pat: '0---------------', wave: 'sine', vol: 0.14 },
      arp: { inst: 'bell', pat: '0.......2.......', vol: 0.035, oct: 2 },
      mel: { inst: 'violin', rhythm: 'x-------x---x---x---x---x-------', vol: 0.045, oct: 1 },
      drums: { r: 'x.x.............' },
      boss: { r: 'X.x.....X.x.....', t: 'x.......x...x...', s: '............x...' },
    },
    // 얼음왕관: 성가대 · 종 · 바람
    icecrown: {
      bpm: 82, steps: 16, root: 57, scale: SC.aeol, prog: [0, 3, 5, 6], verb: 0.55, wind: true,
      pad: { inst: 'choir', vol: 0.022 },
      bass: { pat: '0-------0---2---', wave: 'triangle', vol: 0.12 },
      arp: { inst: 'bell', pat: '0.2.4.2.0.2.4.2.', vol: 0.03, oct: 1 },
      mel: { inst: 'violin', rhythm: 'x---x-x-x-----x-x---x-x-x-------', vol: 0.05, oct: 1 },
      drums: { k: 'X.......X.......', b: 'x...............' },
      boss: { t: 'X..x..x.X..x..x.', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
    },
  };

  G.Music = {
    THEMES, vol: 0.5, on: true, id: null, T: null, bus: null, out: null, verb: null,
    pos: 0, nextT: 0, int: 1, duck: -1, dens: 0, lpf: 20000, heartT: 0, motif: null, motifs: {},
    KEY: 'frostmage_music',

    start() {
      try { this.on = localStorage.getItem(this.KEY) !== 'off'; } catch { /* 저장소 사용 불가 */ }
      setInterval(() => this.tick(), 50);
    },
    toggle() {
      this.on = !this.on;
      try { localStorage.setItem(this.KEY, this.on ? 'on' : 'off'); } catch { /* 저장소 사용 불가 */ }
      G.UI.toast(`배경음악 ${this.on ? '켬' : '끔'} (N)`);
    },
    setup() {
      const c = G.Audio.ctx;
      // out(음량 · 일시 정지 감쇠) → lp(위기 때 먹먹하게) → dk(효과음 덕킹) → master
      this.out = c.createGain(); this.out.gain.value = 0;
      this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.Q.value = 0.7;
      this.dk = c.createGain();
      this.out.connect(this.lp); this.lp.connect(this.dk); this.dk.connect(G.Audio.master);
      // 던전 잔향: 지수 감쇠 잡음으로 만든 2.8초 임펄스
      const len = c.sampleRate * 2.8, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      this.verb = c.createConvolver(); this.verb.buffer = ir; this.verb.connect(this.out);
    },
    want() {
      if (!this.on || G.Audio.muted || G.simulating) return null;
      if (G.state === 'menu') return 'lobby';
      if (G.state === 'play') { const th = G.Waves.stage && G.Waves.stage.theme; return THEMES[th] ? th : 'icecrown'; }
      return null; // 결과 화면은 승리 · 패배 효과음만
    },
    tick() {
      const c = G.Audio.ctx; if (!c || c.state !== 'running') return;
      if (!this.out) this.setup();
      const id = this.want();
      if (id !== this.id) this.play(id);
      const play = G.state === 'play', p = G.player;
      this.int = play && G.enemies.some(e => e.boss && !e.dead) ? 2 : 1;
      // 혼잡도: 플레이어 주변 적 수 (많으면 아르페지오 · 하이햇 층이 더해진다)
      let n = 0;
      if (play && p) for (const e of G.enemies) if (!e.dead && Math.abs(e.x - p.x) < 800 && Math.abs(e.y - p.y) < 500) n++;
      this.dens += (Math.min(1, n / 70) - this.dens) * 0.05;
      const duck = (play && (G.UI.modalKind === 'pause' || G.UI.modalKind === 'help' || G.UI.modalKind === 'settings') ? 0.35 : 1) * G.Settings.get('music');
      if (duck !== this.duck) { this.duck = duck; this.out.gain.setTargetAtTime(this.vol * duck, c.currentTime, 0.3); }
      // 위기(생명력 30% 미만): 음악이 먹먹해지고 심장 박동이 들린다 (15% 미만이면 더 빨리)
      const low = play && !G.paused && p && !p.dead ? Math.round(p.hp / p.maxHp * 20) / 20 : 1;
      const lpf = low < 0.3 ? 600 + low * 3000 : 20000;
      if (lpf !== this.lpf) { this.lpf = lpf; this.lp.frequency.setTargetAtTime(lpf, c.currentTime, lpf < 20000 ? 0.4 : 0.8); }
      if (low < 0.3 && c.currentTime >= this.heartT) { this.heartT = c.currentTime + (low < 0.15 ? 0.6 : 0.85); G.Audio.play('heart', low < 0.15 ? 1 : 0.7); }
      if (!this.T) return;
      if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05; // 탭이 잠들었다 깨면 밀린 음을 몰아 치지 않는다
      while (this.nextT < c.currentTime + 0.25) { this.step(this.nextT); this.nextT += this.stepDur(); }
    },
    // 테마 전환: 이전 버스는 1.5초에 걸쳐 줄이고 새 버스를 키운다
    play(id) {
      const c = G.Audio.ctx, now = c.currentTime;
      if (this.bus) {
        const b = this.bus;
        b.gain.cancelScheduledValues(now); b.gain.setValueAtTime(b.gain.value, now); b.gain.linearRampToValueAtTime(0, now + 1.5);
        setTimeout(() => b.disconnect(), 4000);
      }
      this.id = id; this.T = THEMES[id] || null; this.bus = null;
      if (!this.T) return;
      this.bus = c.createGain(); this.bus.gain.setValueAtTime(0, now); this.bus.gain.linearRampToValueAtTime(1, now + 1.5);
      this.bus.connect(this.out);
      const send = c.createGain(); send.gain.value = this.T.verb; this.bus.connect(send); send.connect(this.verb);
      this.pos = 0; this.nextT = now + 0.1;
      this.motif = this.makeMotif(id);
    },
    stepDur() { const T = this.T; return 60 / (T.bpm * (this.int >= 2 && !T.calm ? (T.bossBpm || 1.06) : 1)) / (T.div || 4); },
    hold(pat, s) { let l = 1; while (pat[s + l] === '-') l++; return l; },
    deg(d, base) { const T = this.T; return base + T.scale[mod(d, 7)] + 12 * Math.floor(d / 7); },
    // 강박의 선율 음은 지금 화음의 구성음으로 끌어당긴다
    snap(d, ch) { for (const o of [0, -1, 1, -2, 2]) if ([0, 2, 4].includes(mod(d + o - ch, 7))) return d + o; return d; },

    step(t) {
      const T = this.T, n = T.steps, s = this.pos % n, bar = Math.floor(this.pos / n), bi = bar % 4, ph = Math.floor(bar / 4);
      const boss = this.int >= 2 && !T.calm, busy = !boss && !T.calm && this.dens > 0.45, sec = ph % 4, intro = ph === 0 && !boss && !busy, sd = this.stepDur();
      const ch = T.prog[bar % T.prog.length];
      const tone = (k, base) => this.deg(ch + 2 * (k % 3) + 7 * Math.floor(k / 3), base);
      this.pos++;
      if (s === 0) {
        for (let k = 0; k < 3; k++) this.note(T.pad.inst, t, tone(k, T.root), n * sd * 0.98, T.pad.vol);
        if (T.wind && bar % 2 === 0) this.wind(t, n * sd * 2);
      }
      const bc = T.bass.pat[s];
      if (bc >= '0' && bc <= '9') {
        let m = tone(+bc, T.root - 12); while (m > 50) m -= 12;
        this.bass(t, m, this.hold(T.bass.pat, s) * sd, T.bass.vol * (boss ? 1.15 : 1));
      }
      // 층 구성: 프레이즈 0 패드 · 베이스 → 1 +아르페지오 → 2 +선율 → 3 선율만. 보스전은 전부.
      if (!intro && (boss || busy || sec === 1 || sec === 2)) {
        const c = T.arp.pat[s], base = T.root + 12 * T.arp.oct;
        if (c === 'c') for (let k = 0; k < 3; k++) this.note(T.arp.inst, t, tone(k, base), sd * 1.5, T.arp.vol * 0.7);
        else if (c >= '0' && c <= '9') this.note(T.arp.inst, t, tone(+c, base), this.hold(T.arp.pat, s) * sd, T.arp.vol);
      }
      if (!intro && (boss ? sec >= 1 : sec >= 2)) {
        const mo = this.motif[bi < 2 ? 0 : 1][(bi % 2) * n + s];
        if (mo) {
          const d = s % (n / 2) === 0 || mo.last ? this.snap(mo.deg, ch) : mo.deg;
          this.note(T.mel.inst, t, this.deg(d, T.root + 12 * T.mel.oct), mo.len * sd * 0.95, T.mel.vol);
        }
      }
      if (!intro) {
        // 적이 몰려들면 하이햇이 더해져 긴장감이 오른다
        const P = boss ? { ...T.drums, ...T.boss } : busy && !T.drums.h ? { ...T.drums, h: T.steps === 12 ? '..x..x..x..x' : '..x...x...x...x.' } : T.drums;
        for (const k in P) {
          const c = P[k][s];
          if ((c === 'x' || c === 'X') && !(k === 'b' && bar % 2)) this.drum(k, t, c === 'X' ? 1 : 0.6);
        }
      }
    },

    // 테마 선율: 2마디 동기(A)와 대답(B, 끝음은 으뜸음 쪽으로). 테마 id로 시드를 고정한다.
    makeMotif(id) {
      if (this.motifs[id]) return this.motifs[id];
      let h = 2166136261;
      for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      const rnd = () => { h += 0x6D2B79F5; let x = h; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const rh = THEMES[id].mel.rhythm;
      const mk = (d, answer) => {
        const arr = []; let last = null;
        for (let i = 0; i < rh.length; i++) {
          if (rh[i] !== 'x') continue;
          let len = 1; while (rh[i + len] === '-') len++;
          if (last) { const u = rnd(); d += u < 0.15 ? -2 : u < 0.45 ? -1 : u < 0.55 ? 0 : u < 0.85 ? 1 : 2; }
          d = d < 0 ? 1 : d > 9 ? 8 : d;
          arr[i] = last = { deg: d, len };
        }
        if (answer && last) { last.deg = 7; last.last = true; }
        return arr;
      };
      const a = mk(4, false);
      return (this.motifs[id] = [a, mk(a.find(Boolean).deg, true)]);
    },

    // ---------- 악기 ----------
    note(inst, t, m, dur, v) {
      const c = G.Audio.ctx, f = hz(m), bus = this.bus;
      const env = (atk, rel, sus = 1) => {
        const g = c.createGain(), t1 = t + Math.max(atk, dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + atk);
        g.gain.exponentialRampToValueAtTime(v * sus, t1); g.gain.exponentialRampToValueAtTime(0.0001, t1 + rel);
        g.connect(bus); return [g, t1 + rel + 0.05];
      };
      const perc = (vol, dec) => {
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dec); g.connect(bus); return [g, t + dec + 0.05];
      };
      const osc = (type, freq, dst, t1, det = 0) => { const o = c.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det; o.connect(dst); o.start(t); o.stop(t1); return o; };
      const filt = (type, freq, q, dst) => { const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q; fl.connect(dst); return fl; };
      const vib = (os, t1, cents, delay) => {
        const l = c.createOscillator(), g = c.createGain(); l.frequency.value = 5.2;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(cents, t + delay);
        l.connect(g); os.forEach(o => g.connect(o.detune)); l.start(t); l.stop(t1);
      };
      switch (inst) {
        case 'harp': { const [g, t1] = perc(v, 1.6); osc('triangle', f, g, t1); break; }
        case 'pluck': {
          const [g, t1] = perc(v, 0.6), fl = filt('lowpass', 2600, 3, g);
          fl.frequency.setValueAtTime(2600, t); fl.frequency.exponentialRampToValueAtTime(320, t + 0.35);
          osc('sawtooth', f, fl, t1); break;
        }
        case 'harpsi': { const [g, t1] = perc(v, 0.9), fl = filt('lowpass', 3200, 0.7, g); osc('square', f, fl, t1); osc('sawtooth', f * 2, fl, t1); break; }
        case 'bell': case 'musicbox': {
          const parts = inst === 'bell' ? [[1, 1, 2.4], [2.76, 0.35, 1.0], [5.4, 0.15, 0.45]] : [[1, 1, 1.1], [4, 0.25, 0.3]];
          for (const [x, a, d] of parts) { const [g, t1] = perc(v * a, d); osc('sine', f * x, g, t1); }
          break;
        }
        case 'flute': { const [g, t1] = env(0.06, 0.18, 0.8); vib([osc('triangle', f, g, t1)], t1, 10, 0.2); break; }
        case 'violin': {
          const [g, t1] = env(0.1, 0.3, 0.9), fl = filt('lowpass', 2200, 1, g);
          vib([osc('sawtooth', f, fl, t1, -6), osc('sawtooth', f, fl, t1, 6)], t1, 14, 0.25); break;
        }
        case 'brass': {
          const [g, t1] = env(0.05, 0.2, 0.75), fl = filt('lowpass', 400, 2, g);
          fl.frequency.setValueAtTime(400, t); fl.frequency.exponentialRampToValueAtTime(2200, t + 0.08); fl.frequency.exponentialRampToValueAtTime(1000, t + 0.4);
          osc('sawtooth', f, fl, t1, -5); osc('sawtooth', f, fl, t1, 5); break;
        }
        case 'choir': {
          // 톱니파 셋을 '아' 모음 포먼트(대역 통과 셋)로 걸러 사람 목소리처럼
          const [g, t1] = env(0.4, 0.9), mix = c.createGain(); mix.gain.value = 3;
          for (const [ff, q] of [[650, 5], [1100, 6], [2400, 8]]) mix.connect(filt('bandpass', ff, q, g));
          vib([-9, 0, 9].map(d => osc('sawtooth', f, mix, t1, d)), t1, 8, 0.5); break;
        }
        case 'organ': {
          const [g, t1] = env(0.03, 0.2);
          for (const [x, a] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.2]]) { const pg = c.createGain(); pg.gain.value = a; pg.connect(g); osc('sine', f * x, pg, t1); }
          break;
        }
        case 'warm': { const [g, t1] = env(0.7, 1.0), fl = filt('lowpass', this.T.pad.cut || 1000, 0.7, g); osc('sawtooth', f, fl, t1, -8); osc('sawtooth', f, fl, t1, 8); break; }
        case 'strings': { const [g, t1] = env(0.45, 0.8), fl = filt('lowpass', 1700, 0.7, g); vib([-10, 0, 10].map(d => osc('sawtooth', f, fl, t1, d)), t1, 10, 0.5); break; }
      }
    },
    bass(t, m, dur, v) {
      const c = G.Audio.ctx, B = this.T.bass, g = c.createGain(), t1 = t + dur;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(v * 0.7, t1); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.12); g.connect(this.bus);
      const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = B.cut || 700; fl.connect(g);
      const o = c.createOscillator(); o.type = B.wave || 'triangle'; o.frequency.value = hz(m); o.connect(fl); o.start(t); o.stop(t1 + 0.2);
    },
    // ---------- 타악기 ----------
    thump(t, f0, f1, dur, v) {
      const c = G.Audio.ctx, o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.05);
    },
    hiss(t, dur, type, f0, f1, v, q = 1) {
      const c = G.Audio.ctx, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = G.Audio.noiseBuf; fl.type = type; fl.Q.value = q;
      fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(fl); fl.connect(g); g.connect(this.bus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    },
    ping(t, f, dur, v) {
      const c = G.Audio.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.05);
    },
    drum(k, t, v) {
      switch (k) {
        case 'k': this.thump(t, 110, 42, 0.32, 0.45 * v); break;
        case 't': this.thump(t, 85, 48, 0.6, 0.55 * v); this.hiss(t, 0.25, 'lowpass', 600, 120, 0.2 * v); break;
        case 'r': this.thump(t, 60, 40, 0.25, 0.35 * v); break;
        case 'o': this.thump(t, 190, 110, 0.25, 0.28 * v); break;
        case 's': this.hiss(t, 0.16, 'bandpass', 2200, 1400, 0.22 * v, 0.8); this.thump(t, 220, 160, 0.08, 0.1 * v); break;
        case 'h': this.hiss(t, 0.04, 'highpass', 8000, 9000, 0.06 * v); break;
        case 'm': for (const x of [1, 1.63, 2.6]) this.ping(t, 1300 * x, 0.35, 0.025 * v); this.hiss(t, 0.03, 'highpass', 4000, 5000, 0.08 * v); break;
        case 'b': this.note('bell', t, this.T.root - 12, 0, 0.1 * v); break;
      }
    },
    // 바람: 두 마디에 걸쳐 차오르고 잦아드는 대역 통과 잡음
    wind(t, dur) {
      const c = G.Audio.ctx, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      src.buffer = G.Audio.noiseBuf; src.loop = true; fl.type = 'bandpass'; fl.Q.value = 2.5;
      fl.frequency.setValueAtTime(300, t); fl.frequency.linearRampToValueAtTime(900, t + dur / 2); fl.frequency.linearRampToValueAtTime(350, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + dur / 2); g.gain.linearRampToValueAtTime(0, t + dur);
      src.connect(fl); fl.connect(g); g.connect(this.bus); src.start(t); src.stop(t + dur + 0.05);
    },
  };
})();
