// ---------- audio: one context, pentatonic blips, throttled ----------
const AU = {
  ctx: null, on: false, master: null, last: {}, voices: 0, noiseBuf: null,
  PENTA: [0, 2, 4, 7, 9],
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    const n = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, n, n);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  },
  ok(key, gap = 0.03) {
    if (!this.on || !this.ctx || this.voices >= 8) return false;
    const t = this.ctx.currentTime; if (this.last[key] && t - this.last[key] < gap) return false;
    this.last[key] = t; this.voices++; return true;
  },
  hz(i) { i = Math.max(0, Math.min(29, Math.round(i))); return 196 * Math.pow(2, (this.PENTA[i % 5] + 12 * Math.floor(i / 5)) / 12); },
  tone(f, dur, vol, type = 'sine', slide = 0, key) {
    if (!this.ok(key || ('t' + Math.round(f)))) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, freq, vol, type = 'bandpass', q = 1, key = 'n') {
    if (!this.ok(key, 0.04)) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  blip(i, v = 0.18) { this.tone(this.hz(i), 0.16, v, 'sine', 0, 'b' + i); },
  pluck(i, v = 0.16) { this.tone(this.hz(i), 0.35, v, 'triangle', 0, 'p' + i); },
  tick(v = 0.1) { this.tone(2400, 0.03, v, 'square', 0, 'tick'); },
  coin(v = 0.12) { this.tone(1320, 0.07, v, 'square', 1.5, 'coin'); },
  thud(v = 0.3) { this.tone(110, 0.18, Math.min(0.6, v), 'sine', 0.5, 'thud'); },
  pop(v = 0.25) { this.tone(600, 0.09, v, 'triangle', 0.3, 'pop'); this.noise(0.06, 2000, v * 0.6, 'highpass', 1, 'popn'); },
  snip(v = 0.15) { this.noise(0.04, 5000, v, 'highpass', 2, 'snip'); },
  boom(v = 0.5) { this.tone(70, 0.6, v, 'sine', 0.4, 'boom'); this.noise(0.5, 300, v, 'lowpass', 1, 'boomn'); },
  whoosh(v = 0.2) { this.noise(0.35, 900, v, 'bandpass', 0.8, 'wh'); },
  zap(v = 0.2) { this.tone(900, 0.2, v, 'sawtooth', 0.2, 'zap'); },
  ting(v = 0.15) { this.tone(2600, 0.25, v, 'triangle', 0.98, 'ting'); },
  chime() { [0, 2, 4].forEach((k, j) => setTimeout(() => this.tone(this.hz(12 + k * 2), 0.6, 0.2, 'triangle', 0, 'ch' + j), j * 90)); },
  frame() { this.voices = 0; }
};
