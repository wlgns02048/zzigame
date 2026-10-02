'use strict';
// WebAudio 합성 효과음 (외부 파일 없이)
G.Audio = {
  ctx: null, master: null, muted: false, last: {}, noiseBuf: null, vol: 0.45,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.vol;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.0;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  toggle() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : this.vol; },
  noise(t0, dur, type, f0, f1, vol, q = 1) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  },
  tone(t0, dur, type, f0, f1, vol, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  },
  play(name, vol = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const gap = { hit: 0.05, xp: 0.06, shatter: 0.07, cast: 0.06, lance: 0.08, icicle: 0.06, hurt: 0.15, tick: 0.12, gold: 0.08, explode: 0.08 }[name] || 0.03;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const t = now + 0.005, v = vol;
    switch (name) {
      case 'cast': this.noise(t, 0.22, 'bandpass', 2600, 700, 0.35 * v, 2); this.tone(t, 0.18, 'sine', 900, 1500, 0.05 * v); break;
      case 'hit': this.noise(t, 0.08, 'highpass', 3500, 2500, 0.25 * v); this.tone(t, 0.07, 'triangle', 1800, 900, 0.06 * v); break;
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
      case 'xp': this.tone(t, 0.07, 'sine', 1100 + Math.random() * 200, 1700, 0.04 * v); break;
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
