// Audio: synthesised SFX and a small step-sequencer for per-boss music with intensity layers. No samples, no files.
const Sound = {
  ctx: null, master: null, sfxBus: null, musBus: null, rev: null, muted: QS.has('mute'),
  init() {
    if (this.ctx || this.muted) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext; const ctx = this.ctx = new C();
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.connect(this.master);
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(comp);
      this.musBus = ctx.createGain(); this.musBus.connect(comp);
      // generated reverb impulse
      const len = ctx.sampleRate * 2.6, buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      this.rev = ctx.createConvolver(); this.rev.buffer = buf;
      const rg = ctx.createGain(); rg.gain.value = 0.32; this.rev.connect(rg); rg.connect(comp);
      const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      this.applyVolume();
    } catch (e) { this.ctx = null; }
  },
  applyVolume() { if (!this.ctx) return; this.master.gain.value = Settings.vol / 100; this.musBus.gain.value = 0.55 * Settings.mus / 100; },
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  ok() { return this.ctx && !G.headless; },
  // one oscillator note with an envelope. o: {f, type, dur, vol, a (attack), slide (end freq), lp (lowpass Hz), lpEnd, bus, rev, det, when}
  tone(o) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = (o.when || ctx.currentTime), dur = o.dur || 0.2, vol = o.vol === undefined ? 0.2 : o.vol;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    if (o.det) osc.detune.value = o.det;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t); if (o.lpEnd) f.frequency.exponentialRampToValueAtTime(o.lpEnd, t + dur); f.Q.value = o.q || 1; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || this.sfxBus); if (o.rev) g.connect(this.rev);
    osc.start(t); osc.stop(t + dur + 0.05);
  },
  // filtered noise burst. o: {dur, vol, f (filter Hz), fEnd, type ('bandpass'|'lowpass'|'highpass'), q, a, bus, rev, when}
  noise(o) {
    if (!this.ok()) return;
    const ctx = this.ctx, t = (o.when || ctx.currentTime), dur = o.dur || 0.2;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t + dur); f.Q.value = o.q || 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol === undefined ? 0.2 : o.vol, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus); if (o.rev) g.connect(this.rev);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  sfx(name, v = 1, p = 1) {
    if (!this.ok()) return;
    const S = this, T = (o) => S.tone(o), N = (o) => S.noise(o);
    switch (name) {
      case 'slash': N({ dur: 0.13, vol: 0.22 * v, f: 2600 * p, fEnd: 700, q: 1.2 }); break;
      case 'hit': N({ dur: 0.09, vol: 0.25 * v, f: 900 * p, type: 'lowpass' }); T({ f: 150 * p, slide: 60, dur: 0.1, vol: 0.22 * v, type: 'triangle' }); break;
      case 'crit': N({ dur: 0.16, vol: 0.3 * v, f: 1800, fEnd: 300 }); T({ f: 220 * p, slide: 50, dur: 0.22, vol: 0.3 * v, type: 'sawtooth', lp: 1400 }); T({ f: 1320 * p, dur: 0.25, vol: 0.08 * v, rev: 1 }); break;
      case 'cast': T({ f: 300 * p, slide: 620 * p, dur: 0.3, vol: 0.07 * v, type: 'triangle', rev: 1 }); break;
      case 'bolt': N({ dur: 0.2, vol: 0.2 * v, f: 5000, fEnd: 900, q: 2 }); T({ f: 900 * p, slide: 160, dur: 0.16, vol: 0.13 * v, type: 'sawtooth', lp: 3000 }); break;
      case 'zap': N({ dur: 0.3, vol: 0.28 * v, f: 6000, fEnd: 500, q: 1.5, rev: 1 }); T({ f: 1500 * p, slide: 90, dur: 0.28, vol: 0.16 * v, type: 'square', lp: 4000 }); break;
      case 'boom': N({ dur: 0.5, vol: 0.4 * v, f: 500 * p, fEnd: 60, type: 'lowpass', rev: 1 }); T({ f: 110 * p, slide: 32, dur: 0.5, vol: 0.4 * v }); break;
      case 'bigboom': N({ dur: 1.4, vol: 0.55 * v, f: 900, fEnd: 40, type: 'lowpass', rev: 1 }); T({ f: 80, slide: 24, dur: 1.2, vol: 0.55 * v }); T({ f: 46, dur: 1.6, vol: 0.3 * v, type: 'triangle' }); break;
      case 'warn': T({ f: 660 * p, dur: 0.12, vol: 0.07 * v, type: 'triangle' }); break;
      case 'tick': T({ f: 1100 * p, dur: 0.04, vol: 0.06 * v, type: 'square', lp: 3000 }); break;
      case 'interrupt': N({ dur: 0.25, vol: 0.3 * v, f: 3000, fEnd: 200 }); T({ f: 880, slide: 110, dur: 0.3, vol: 0.2 * v, type: 'square', lp: 2500, rev: 1 }); break;
      case 'parry': T({ f: 2100 * p, dur: 0.5, vol: 0.2 * v, type: 'triangle', rev: 1 }); T({ f: 3150 * p, dur: 0.4, vol: 0.12 * v, rev: 1 }); N({ dur: 0.07, vol: 0.3 * v, f: 6000, type: 'highpass' }); break;
      case 'heal': [523, 659, 784, 1046].forEach((f, i) => T({ f, dur: 0.5, vol: 0.09 * v, when: S.ctx.currentTime + i * 0.07, rev: 1, type: 'triangle' })); break;
      case 'hurt': T({ f: 190, slide: 70, dur: 0.22, vol: 0.32 * v, type: 'sawtooth', lp: 900 }); N({ dur: 0.12, vol: 0.2 * v, f: 400, type: 'lowpass' }); break;
      case 'death': T({ f: 220, slide: 30, dur: 1.6, vol: 0.4 * v, type: 'sawtooth', lp: 700, lpEnd: 80, rev: 1 }); N({ dur: 1.2, vol: 0.2, f: 300, fEnd: 40, type: 'lowpass', rev: 1 }); break;
      case 'ui': T({ f: 720, dur: 0.05, vol: 0.05, type: 'triangle' }); break;
      case 'uiok': T({ f: 520, dur: 0.1, vol: 0.08, type: 'triangle' }); T({ f: 780, dur: 0.16, vol: 0.08, type: 'triangle', when: S.ctx.currentTime + 0.07, rev: 1 }); break;
      case 'blink': N({ dur: 0.22, vol: 0.2 * v, f: 800, fEnd: 7000, q: 2, rev: 1 }); T({ f: 400, slide: 1800, dur: 0.18, vol: 0.1 * v }); break;
      case 'dash': N({ dur: 0.2, vol: 0.2 * v, f: 500, fEnd: 3000, q: 0.7 }); break;
      case 'shield': T({ f: 330, slide: 660, dur: 0.35, vol: 0.12 * v, type: 'triangle', rev: 1 }); T({ f: 990, dur: 0.5, vol: 0.05 * v, rev: 1 }); break;
      case 'shatter': for (let i = 0; i < 6; i++) T({ f: 1800 + Math.random() * 3800, dur: 0.25 + Math.random() * 0.4, vol: 0.06 * v, when: S.ctx.currentTime + Math.random() * 0.2, rev: 1, type: 'triangle' }); N({ dur: 0.4, vol: 0.25 * v, f: 5000, type: 'highpass' }); break;
      case 'wave': N({ dur: 2.2, vol: 0.4 * v, f: 300, fEnd: 1400, type: 'lowpass', a: 1.2, rev: 1 }); break;
      case 'roar': T({ f: 95 * p, slide: 55 * p, dur: 1.5, vol: 0.4 * v, type: 'sawtooth', lp: 600, lpEnd: 200, a: 0.15, rev: 1 }); T({ f: 143 * p, slide: 70 * p, dur: 1.4, vol: 0.25 * v, type: 'square', lp: 500, a: 0.2, det: 30 }); N({ dur: 1.4, vol: 0.2 * v, f: 700, fEnd: 200, a: 0.2, rev: 1 }); break;
      case 'laser': T({ f: 1400 * p, slide: 300, dur: 0.45, vol: 0.13 * v, type: 'sawtooth', lp: 5000, rev: 1 }); T({ f: 70, dur: 0.5, vol: 0.2 * v, type: 'square', lp: 300 }); break;
      case 'bell': [1, 2.01, 2.76, 5.4].forEach((m, i) => T({ f: 110 * p * m, dur: 3.2 / (1 + i * 0.6), vol: 0.22 * v / (1 + i), rev: 1 })); break;
      case 'charge': T({ f: 120 * p, slide: 900 * p, dur: 0.9, vol: 0.12 * v, type: 'sawtooth', lp: 500, lpEnd: 5000, a: 0.5 }); break;
      case 'kill': S.sfx('bigboom', v); [262, 392, 523, 784].forEach((f, i) => T({ f, dur: 2.4, vol: 0.12, when: S.ctx.currentTime + 0.3 + i * 0.14, rev: 1, type: 'triangle' })); break;
      case 'thunder': N({ dur: 2.4, vol: 0.5 * v, f: 220, fEnd: 50, type: 'lowpass', a: 0.02, rev: 1 }); N({ dur: 0.25, vol: 0.35 * v, f: 3000, fEnd: 400 }); break;
      case 'steam': N({ dur: 0.9, vol: 0.2 * v, f: 4500, fEnd: 2200, type: 'highpass', a: 0.1 }); break;
      case 'sword': T({ f: 2600 * p, slide: 3400 * p, dur: 0.35, vol: 0.1 * v, type: 'triangle', rev: 1 }); N({ dur: 0.1, vol: 0.2 * v, f: 7000, type: 'highpass' }); break;
    }
  },
  // A pitched note for boss mechanics (e.g. the organ). midi note number.
  note(midi, voice = 'organ', dur = 0.8, vol = 0.2) { if (this.ok()) Music.voice(voice, 440 * Math.pow(2, (midi - 69) / 12), this.ctx.currentTime, dur, vol, this.sfxBus); },
};

// Music spec: { bpm, root (midi), scale: [semitones], prog: [scale degree per bar], layers: [{v, from, to, pat, oct, len, vol}] }
// pat is 16 chars per bar: '.' rest, 'x' hit (drums), digits 0-9 = scale steps above the bar's chord root (melodic voices).
const Music = {
  spec: null, level: 0, step: 0, nextT: 0, timer: null, gain: null,
  play(spec, level = 0) {
    this.stop(0.3); if (!Sound.ctx) return;
    this.spec = spec; this.level = level; this.step = 0; this.nextT = Sound.ctx.currentTime + 0.15;
    this.gain = Sound.ctx.createGain(); this.gain.gain.value = 1; this.gain.connect(Sound.musBus); this.gain.connect(Sound.rev);
    this.timer = setInterval(() => this.tick(), 60);
  },
  stop(fade = 1.5) {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.gain && Sound.ctx) { const g = this.gain; g.gain.setTargetAtTime(0, Sound.ctx.currentTime, fade / 3); setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, fade * 1000 + 600); }
    this.gain = null; this.spec = null;
  },
  intensity(n) { this.level = n; },
  tick() {
    const s = this.spec; if (!s || !Sound.ctx || Sound.ctx.state !== 'running') return;
    const spb = 60 / s.bpm / 4, ctx = Sound.ctx;
    if (this.nextT < ctx.currentTime - 0.5) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.25) {
      const st = this.step % 16, bar = Math.floor(this.step / 16), deg = s.prog[bar % s.prog.length];
      for (const L of s.layers) {
        if (this.level < (L.from || 0) || (L.to !== undefined && this.level > L.to)) continue;
        const pat = Array.isArray(L.pat) ? L.pat[bar % L.pat.length] : L.pat, ch = pat[st];
        if (!ch || ch === '.') continue;
        if (ch === 'x' || ch === 'X') this.voice(L.v, 0, this.nextT, 0, (L.vol || 0.3) * (ch === 'X' ? 1.3 : 1), this.gain);
        else {
          const d = deg + parseInt(ch, 36), sc = s.scale, oct = Math.floor(d / sc.length), semi = sc[((d % sc.length) + sc.length) % sc.length];
          const midi = s.root + (L.oct || 0) * 12 + oct * 12 + semi;
          this.voice(L.v, 440 * Math.pow(2, (midi - 69) / 12), this.nextT, (L.len || 2) * spb, L.vol || 0.15, this.gain);
        }
      }
      this.nextT += spb; this.step++;
    }
  },
  voice(v, f, t, dur, vol, bus) {
    const S = Sound, T = (o) => S.tone(Object.assign({ when: t, bus }, o)), N = (o) => S.noise(Object.assign({ when: t, bus }, o));
    switch (v) {
      case 'kick': T({ f: 150, slide: 38, dur: 0.28, vol: vol * 1.5 }); break;
      case 'snare': N({ dur: 0.16, vol, f: 1900, q: 0.6 }); T({ f: 190, slide: 110, dur: 0.1, vol: vol * 0.6, type: 'triangle' }); break;
      case 'hat': N({ dur: 0.04, vol: vol * 0.6, f: 8500, type: 'highpass' }); break;
      case 'tom': T({ f: 105, slide: 52, dur: 0.4, vol: vol * 1.5, type: 'triangle' }); N({ dur: 0.07, vol: vol * 0.5, f: 300, type: 'lowpass' }); break;
      case 'taiko': T({ f: 78, slide: 40, dur: 0.6, vol: vol * 1.8 }); N({ dur: 0.1, vol: vol * 0.7, f: 500, type: 'lowpass' }); break;
      case 'clap': N({ dur: 0.1, vol, f: 1300, q: 1.4 }); break;
      case 'bass': T({ f, dur, vol, type: 'sawtooth', lp: 700, lpEnd: 160, q: 3 }); T({ f: f / 2, dur, vol: vol * 0.8 }); break;
      case 'sub': T({ f, dur, vol: vol * 1.2, a: 0.05 }); break;
      case 'pad': [-9, 0, 8].forEach((d) => T({ f, dur: dur * 1.3, vol: vol * 0.4, type: 'sawtooth', lp: 900, a: dur * 0.3, det: d })); break;
      case 'arp': T({ f, dur, vol, type: 'triangle', lp: 4000, lpEnd: 500 }); T({ f: f * 2, dur: dur * 0.5, vol: vol * 0.25, type: 'square', lp: 2500 }); break;
      case 'lead': T({ f, dur, vol, type: 'sawtooth', lp: 2600, lpEnd: 900, a: 0.02, det: 6 }); T({ f, dur, vol: vol * 0.6, type: 'square', lp: 1800, det: -6 }); break;
      case 'organ': [1, 2, 3, 4, 6, 8].forEach((m, i) => T({ f: f * m, dur, vol: vol * [0.5, 0.35, 0.22, 0.16, 0.08, 0.05][i], a: 0.03 })); break;
      case 'bell': T({ f, dur: dur * 2, vol }); T({ f: f * 2.76, dur: dur, vol: vol * 0.35 }); T({ f: f * 5.4, dur: dur * 0.5, vol: vol * 0.15 }); break;
      case 'choir': [-7, 7].forEach((d) => { T({ f, dur: dur * 1.2, vol: vol * 0.5, type: 'sawtooth', lp: 1100, q: 4, a: dur * 0.35, det: d }); }); T({ f: f * 2, dur: dur * 1.2, vol: vol * 0.12, a: dur * 0.4 }); break;
      case 'koto': T({ f, dur: dur * 1.5, vol, type: 'triangle', lp: 5000, lpEnd: 700 }); N({ dur: 0.02, vol: vol * 0.5, f: 5000, type: 'highpass' }); break;
      case 'flute': T({ f, dur, vol, type: 'sine', a: 0.08 }); T({ f: f * 2, dur, vol: vol * 0.12, a: 0.1 }); N({ dur: dur * 0.6, vol: vol * 0.08, f: f * 2, q: 6, a: 0.05 }); break;
      case 'brass': T({ f, dur, vol, type: 'sawtooth', lp: 500, lpEnd: 1800, a: 0.06, q: 2 }); T({ f: f * 1.005, dur, vol: vol * 0.7, type: 'sawtooth', lp: 1200, a: 0.08 }); break;
      case 'pulse': T({ f, dur, vol, type: 'square', lp: 1600, lpEnd: 300, q: 5 }); break;
    }
  },
};
addEventListener('pointerdown', () => Sound.resume(), { capture: true });
addEventListener('keydown', () => Sound.resume(), { capture: true });
