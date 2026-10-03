'use strict';
// WebAudio 합성 효과음 (외부 파일 없이)
// 효과음은 sfx 버스(설정 음량)를 거쳐 master로, 배경음악은 G.Music이 따로 master로 보낸다.
G.Audio = {
  ctx: null, master: null, sfx: null, out: null, muted: false, last: {}, noiseBuf: null, vol: 0.45,
  pm: 1, xpN: 0, xpT: 0,
  // 음높이를 흔들지 않는 소리 (음계 · 신호음)
  TUNED: new Set(['levelup', 'victory', 'chest', 'buff', 'warn', 'boss', 'death', 'click', 'xp', 'heart', 'combo', 'reveal', 'revealRare', 'legend', 'shrine', 'goblin']),
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.vol;
      this.sfx = this.ctx.createGain(); this.sfx.gain.value = G.Settings.get('sfx'); this.sfx.connect(this.master);
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.0;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  toggle() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : this.vol; },
  setSfx(v) { if (this.sfx) this.sfx.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); },
  noise(t0, dur, type, f0, f1, vol, q = 1) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0 * this.pm, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * this.pm), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  },
  tone(t0, dur, type, f0, f1, vol, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0 * this.pm, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * this.pm), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.out); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  // 배경음악을 잠깐 줄여 중요한 효과음이 또렷하게 들리게 한다
  duck(depth = 0.45, hold = 0.25) {
    const dk = G.Music && G.Music.dk; if (!dk || this.muted) return;
    const now = this.ctx.currentTime;
    dk.gain.cancelScheduledValues(now); dk.gain.setValueAtTime(dk.gain.value, now);
    dk.gain.linearRampToValueAtTime(depth, now + 0.04); dk.gain.setTargetAtTime(1, now + 0.04 + hold, 0.3);
  },
  // x: 소리가 난 세상 좌표 (있으면 화면 위치에 따라 좌우로)
  play(name, vol = 1, x) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const gap = { hit: 0.05, hitFire: 0.05, hitShadow: 0.05, crit: 0.07, pop: 0.05, xp: 0.045, shatter: 0.07, cast: 0.06, lance: 0.08, icicle: 0.06, hurt: 0.15, tick: 0.12, gold: 0.08, explode: 0.08, heart: 0.3 }[name] || 0.03;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    // 같은 소리가 기관총처럼 반복되지 않게 음높이 · 크기를 조금씩 흔든다
    const tuned = this.TUNED.has(name);
    this.pm = tuned ? 1 : 0.94 + Math.random() * 0.12;
    const t = now + 0.005, v = tuned ? vol : vol * (0.85 + Math.random() * 0.2);
    this.out = this.sfx;
    if (x !== undefined && G.cam && this.ctx.createStereoPanner) {
      const pn = this.ctx.createStereoPanner();
      pn.pan.value = Math.max(-0.7, Math.min(0.7, (x - G.cam.x) / (G.W / 2) * 0.7));
      pn.connect(this.sfx); this.out = pn;
    }
    switch (name) {
      case 'cast': this.noise(t, 0.22, 'bandpass', 2600, 700, 0.35 * v, 2); this.tone(t, 0.18, 'sine', 900, 1500, 0.05 * v); break;
      case 'hit': this.noise(t, 0.08, 'highpass', 3500, 2500, 0.25 * v); this.tone(t, 0.07, 'triangle', 1800, 900, 0.06 * v); break;
      // 화염: 낮고 퍽 · 암흑: 웅 하고 가라앉음
      case 'hitFire': this.noise(t, 0.14, 'lowpass', 1800, 300, 0.4 * v); this.tone(t, 0.1, 'triangle', 300, 120, 0.12 * v); break;
      case 'hitShadow': this.noise(t, 0.16, 'bandpass', 900, 300, 0.35 * v, 2); this.tone(t, 0.16, 'sawtooth', 260, 90, 0.05 * v); break;
      // 치명타: 짧고 높은 금속성 울림
      case 'crit': this.tone(t, 0.12, 'square', 2200, 1600, 0.025 * v); this.tone(t, 0.18, 'sine', 3300, 3100, 0.05 * v); this.noise(t, 0.05, 'highpass', 6000, 8000, 0.18 * v); break;
      // 일반 처치: 작고 둔한 퍽
      case 'pop': this.noise(t, 0.09, 'lowpass', 1200, 200, 0.22 * v); this.tone(t, 0.08, 'sine', 220, 90, 0.08 * v); break;
      // 정예 처치: 묵직한 충격 + 반짝임
      case 'eliteKill':
        this.tone(t, 0.5, 'sine', 140, 40, 0.4 * v); this.noise(t, 0.4, 'lowpass', 3000, 150, 0.45 * v);
        [784, 1175, 1568].forEach((f, i) => this.tone(t + 0.08 + i * 0.05, 0.4, 'triangle', f, f, 0.06 * v));
        break;
      // 레벨업 카드 · 상자: 뒤집히는 소리. 희귀 이상은 화음, 전설 · 진화는 종소리와 반짝임
      case 'reveal': this.noise(t, 0.12, 'bandpass', 1800, 4000, 0.15 * v, 3); this.tone(t, 0.15, 'triangle', 880, 880, 0.04 * v); break;
      case 'revealRare': this.noise(t, 0.15, 'bandpass', 2000, 5000, 0.18 * v, 3); [988, 1319].forEach((f, i) => this.tone(t + i * 0.04, 0.3, 'triangle', f, f, 0.05 * v)); break;
      case 'legend':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(t + i * 0.06, 0.9, 'triangle', f, f, 0.08 * v, 0.01));
        this.tone(t, 1.6, 'sine', 131, 131, 0.15 * v, 0.02); this.noise(t + 0.2, 1.2, 'highpass', 6000, 10000, 0.12 * v);
        break;
      // 보물 코볼트: 동전 짤랑 + 킬킬 / 성소 · 저주받은 상자: 울리는 종
      case 'goblin':
        for (let i = 0; i < 5; i++) this.tone(t + i * 0.05, 0.1, 'square', 1800 + i * 220, 2000 + i * 220, 0.025 * v);
        [0, 0.09, 0.18].forEach(d => this.tone(t + 0.3 + d, 0.07, 'sawtooth', 700, 900, 0.04 * v));
        break;
      case 'shrine': [659, 988, 1319].forEach((f, i) => this.tone(t + i * 0.12, 1.2, 'sine', f, f, 0.06 * v, 0.02)); this.noise(t, 1, 'bandpass', 3000, 6000, 0.06 * v, 4); break;
      case 'heart': this.tone(t, 0.12, 'sine', 70, 45, 0.5 * v); this.tone(t + 0.16, 0.14, 'sine', 62, 40, 0.38 * v); break;
      case 'lance': this.noise(t, 0.12, 'highpass', 5000, 2000, 0.3 * v); this.tone(t, 0.12, 'sine', 2400, 3400, 0.08 * v); break;
      case 'icicle': this.tone(t, 0.1, 'sine', 3000, 4200, 0.06 * v); break;
      case 'shatter':
        this.noise(t, 0.2, 'highpass', 4000, 6000, 0.35 * v);
        for (let i = 0; i < 3; i++) this.tone(t + i * 0.02, 0.12, 'sine', 2500 + Math.random() * 2500, 3000 + Math.random() * 3000, 0.05 * v);
        break;
      case 'freeze': this.noise(t, 0.35, 'bandpass', 6000, 1500, 0.3 * v, 3); this.tone(t, 0.3, 'sine', 1800, 600, 0.06 * v); break;
      case 'nova': this.noise(t, 0.5, 'lowpass', 6000, 300, 0.5 * v); this.tone(t, 0.45, 'sine', 600, 90, 0.2 * v); this.noise(t + 0.05, 0.4, 'highpass', 5000, 7000, 0.2 * v); break;
      case 'orb': this.noise(t, 0.6, 'bandpass', 400, 1800, 0.4 * v, 1.5); this.tone(t, 0.6, 'sine', 300, 900, 0.1 * v); break;
      case 'explode': this.noise(t, 0.35, 'lowpass', 2500, 200, 0.45 * v); this.tone(t, 0.25, 'sine', 160, 50, 0.25 * v); break;
      case 'comet': this.noise(t, 0.5, 'lowpass', 1800, 120, 0.6 * v); this.tone(t, 0.4, 'sine', 120, 40, 0.35 * v); break;
      case 'blink': this.tone(t, 0.18, 'sine', 400, 2400, 0.15 * v); this.noise(t, 0.2, 'bandpass', 1500, 5000, 0.2 * v, 4); break;
      case 'buff': [523, 659, 784].forEach((f, i) => this.tone(t + i * 0.05, 0.35, 'triangle', f, f, 0.08 * v)); this.noise(t, 0.4, 'highpass', 3000, 8000, 0.12 * v); break;
      case 'xp': {
        // 연달아 주우면 5음 음계를 따라 한 칸씩 올라간다. 세 옥타브를 다 오르면 반짝 소리 후 한 옥타브 위에서 다시
        this.xpN = now - this.xpT < 0.4 ? this.xpN + 1 : 0; this.xpT = now;
        if (this.xpN >= 15) { this.xpN = 5; this.play('combo', 0.8); this.out = this.sfx; }
        const n = this.xpN, f = 523 * Math.pow(2, ([0, 2, 4, 7, 9][n % 5] + 12 * Math.floor(n / 5)) / 12);
        this.tone(t, 0.09, 'sine', f, f * 1.01, 0.045 * v); this.tone(t, 0.06, 'triangle', f * 2, f * 2, 0.012 * v);
        break;
      }
      case 'combo': [1568, 2093, 2637, 3136].forEach((f, i) => this.tone(t + i * 0.035, 0.3, 'sine', f, f, 0.04 * v)); this.noise(t, 0.4, 'highpass', 7000, 10000, 0.08 * v); break;
      case 'gold': this.tone(t, 0.08, 'square', 1500, 1500, 0.03 * v); this.tone(t + 0.06, 0.1, 'square', 2000, 2000, 0.03 * v); break;
      case 'levelup':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.07, 0.6, 'triangle', f, f, 0.12 * v, 0.01));
        this.noise(t, 1.0, 'highpass', 4000, 9000, 0.12 * v);
        break;
      case 'hurt': this.tone(t, 0.18, 'sine', 140, 60, 0.35 * v); this.noise(t, 0.1, 'lowpass', 800, 200, 0.25 * v); break;
      case 'warn': [0, 0.18].forEach(d => this.tone(t + d, 0.22, 'square', 880, 880, 0.06 * v)); break;
      case 'boss': this.tone(t, 1.4, 'sawtooth', 73, 55, 0.12 * v, 0.2); this.tone(t, 1.4, 'sawtooth', 110, 82, 0.08 * v, 0.2); this.noise(t, 1.2, 'lowpass', 400, 80, 0.3 * v); break;
      case 'chest': [659, 784, 988, 1318].forEach((f, i) => this.tone(t + i * 0.08, 0.4, 'sine', f, f, 0.1 * v)); break;
      case 'click': this.tone(t, 0.05, 'square', 600, 600, 0.04 * v); break;
      case 'shadow': this.noise(t, 0.25, 'bandpass', 600, 300, 0.25 * v, 3); this.tone(t, 0.2, 'sawtooth', 200, 100, 0.05 * v); break;
      case 'tick': this.noise(t, 0.12, 'bandpass', 3000, 1500, 0.12 * v, 2); break;
      case 'death': this.tone(t, 1.5, 'sine', 300, 60, 0.3 * v); this.noise(t, 1.2, 'lowpass', 2000, 100, 0.3 * v); break;
      case 'victory': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(t + i * 0.12, 0.5, 'triangle', f, f, 0.12 * v)); break;
    }
  },
};
