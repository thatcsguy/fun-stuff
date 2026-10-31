// =============================================================================
//  §5  Audio — procedural WebAudio synth. Unlocked on the first gesture.
//      API:  sfx(name, opts)  ·  Audio.music.play(key) / setPhase(n) / stop()
//            Audio.updateTele(telegraphs)  (rising 220→660 Hz telegraph tones)
//      Every sound is synthesised; nothing is loaded.
// =============================================================================
const Audio = {
  ctx: null, master: null, sfxBus: null, musicBus: null, verb: null, noiseBuf: null,
  tele: [], teleOn: false,
  volume: Save.settings.volume, muted: !!Save.settings.mute,

  unlock() {
    // any non-running state is resumable: WebKit uses a non-standard 'interrupted' state after calls / Siri / lock screen
    if (this.ctx) { if (this.ctx.state !== 'running' && this.ctx.state !== 'closed' && !Game.hidden) this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.55; this.musicBus.connect(this.master);
    // white-noise buffer (2 s)
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // small synthetic reverb (decaying noise impulse)
    try {
      const len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      this.verb = ctx.createConvolver(); this.verb.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.22;
      this.verbSend = ctx.createGain(); this.verbSend.gain.value = 1;
      this.verbSend.connect(this.verb); this.verb.connect(wet); wet.connect(this.master);
    } catch (e) { this.verbSend = null; }
    // telegraph voices
    const T = CONFIG.telegraph.tone;
    for (let i = 0; i < T.voices; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = T.f0; g.gain.value = 0;
      o.connect(g); g.connect(this.sfxBus); o.start();
      this.tele.push({ o, g, on: false });
    }
    if (this.music.pending) { const k = this.music.pending; this.music.pending = null; this.music.play(k); }
  },
  get ready() { return !!(this.ctx && this.ctx.state === 'running'); },
  setVolume(v) { this.volume = v; Save.settings.volume = v; Save.save(); if (this.master && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03); },
  setMute(m) { this.muted = m; Save.settings.mute = m; Save.save(); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.03); },
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); },
  resume() { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {}); },

  // ---------------------------------------------------------------- primitives
  /** oscillator voice with an attack/exp-decay envelope */
  tone(o) {
    const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    const f0 = o.f || 440;
    osc.frequency.setValueAtTime(f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + (o.glide || o.dur || 0.2));
    if (o.detune) osc.detune.value = o.detune;
    const a = o.a || 0.004, dur = o.dur || 0.2, vol = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    let node = osc;
    if (o.lp || o.hp || o.bp) {
      const f = ctx.createBiquadFilter();
      f.type = o.lp ? 'lowpass' : o.hp ? 'highpass' : 'bandpass';
      f.frequency.value = o.lp || o.hp || o.bp; f.Q.value = o.q || 0.8;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(o.dest || this.sfxBus);
    if (o.verb && this.verbSend) g.connect(this.verbSend);
    osc.start(t); osc.stop(t + a + dur + 0.05);
  },
  /** filtered white-noise burst, filter frequency can sweep f → f1 */
  noise(o) {
    const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1000, t);
    const a = o.a || 0.004, dur = o.dur || 0.2;
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(10, o.f1), t + a + dur);
    const g = ctx.createGain(), vol = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || this.sfxBus);
    if (o.verb && this.verbSend) g.connect(this.verbSend);
    const off = Math.random() * 1.5;
    src.start(t, off); src.stop(t + a + dur + 0.05);
  },
  glass(n, base, vol, delay) {
    for (let i = 0; i < n; i++) {
      const f = (base || 2600) * (0.8 + Math.random() * 0.7), d = (delay || 0) + i * 0.025 + Math.random() * 0.03;
      this.tone({ f, dur: 0.35, vol: vol || 0.06, delay: d, verb: true });
      this.tone({ f: f * 2.71, dur: 0.18, vol: (vol || 0.06) * 0.5, delay: d });
    }
  },

  // ---------------------------------------------------------------- the SFX table (§8.6)
  sfx(name, o) {
    if (!this.ready || this.muted) return;
    o = o || {};
    try {
      switch (name) {
        case 'dash': this.noise({ type: 'bandpass', f: 500, f1: 3400, q: 1.1, dur: 0.26, vol: 0.38 }); this.tone({ f: 200, f1: 70, dur: 0.16, vol: 0.14 }); break;
        case 'slipstream':
          this.tone({ f: 2600, dur: 0.1, vol: 0.25 }); this.tone({ f: 3900, dur: 0.06, vol: 0.12, delay: 0.05 });
          this.tone({ f: 900, f1: 2800, glide: 0.35, type: 'triangle', dur: 0.4, vol: 0.08, delay: 0.02, verb: true }); break;
        case 'tink': this.glass(3, o.f || 2800, 0.07); break;
        case 'rendShatter': this.noise({ type: 'highpass', f: 3800, dur: 0.22, vol: 0.18 }); this.glass(5, 3000, 0.05); break;
        case 'swing': this.noise({ type: 'bandpass', f: o.f || 900, f1: (o.f || 900) * 2.6, q: 1.4, dur: 0.13, vol: 0.12 }); break;
        case 'hit': this.tone({ f: 170, f1: 60, dur: 0.12, vol: 0.22 }); this.noise({ type: 'bandpass', f: 1500, q: 0.8, dur: 0.06, vol: 0.13 }); break;
        case 'rend': this.noise({ type: 'bandpass', f: 700, f1: 3200, q: 0.9, dur: 0.22, vol: 0.3 }); this.tone({ f: 330, f1: 120, dur: 0.2, vol: 0.18, type: 'triangle' }); break;
        case 'needle': this.tone({ f: 3400, f1: 2400, dur: 0.07, vol: 0.04 }); break;
        case 'needleHit': this.tone({ f: 2900 + Math.random() * 800, dur: 0.12, vol: 0.05 }); break;
        case 'shatter': this.tone({ f: 150, f1: 48, dur: 0.35, vol: 0.5 }); this.noise({ type: 'highpass', f: 2200, dur: 0.12, vol: 0.3 }); this.glass(4, 2600, 0.06); break;
        case 'grandShatter':
          this.tone({ f: 95, f1: 30, dur: 0.95, vol: 1.0 }); this.tone({ f: 48, dur: 0.7, vol: 0.5 });
          this.noise({ type: 'bandpass', f: 1400, f1: 300, q: 0.6, dur: 0.35, vol: 0.55 }); this.noise({ type: 'highpass', f: 5000, dur: 0.5, vol: 0.2, verb: true });
          this.glass(8, 2400, 0.06, 0.04);
          for (const f of [880, 1318.5, 1760]) this.tone({ f, type: 'triangle', dur: 1.3, vol: 0.04, delay: 0.05, verb: true });
          break;
        case 'slam': this.noise({ type: 'lowpass', f: 500, f1: 90, dur: 0.9, vol: 0.65 }); this.tone({ f: 72, f1: 32, dur: 0.6, vol: 0.55 }); break;
        case 'boom': this.noise({ type: 'lowpass', f: 900, f1: 120, dur: 0.6, vol: 0.45 }); this.tone({ f: 90, f1: 40, dur: 0.4, vol: 0.35 }); break;
        case 'chime': {
          const scale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88];
          const deg = ((o.degree | 0) % 7 + 7) % 7, f = scale[deg] * 2 * (o.octave || 1);
          this.tone({ f, dur: 1.6, vol: 0.18, verb: true }); this.tone({ f: f * 2.76, dur: 0.8, vol: 0.06 }); this.tone({ f: f * 5.4, dur: 0.3, vol: 0.03 });
          break;
        }
        case 'castSting': {
          const f = o.f || 220;
          this.tone({ f, type: 'sawtooth', dur: 0.16, vol: 0.11, lp: 1800 });
          this.tone({ f: f * 1.498, type: 'sawtooth', dur: 0.26, vol: 0.11, lp: 2200, delay: 0.11 });
          break;
        }
        case 'click': this.noise({ type: 'highpass', f: 3000, dur: 0.03, vol: 0.22 }); this.tone({ f: 2800, dur: 0.04, vol: 0.1 }); break;
        case 'lance': this.noise({ type: 'bandpass', f: 2400, f1: 500, q: 1.3, dur: 0.35, vol: 0.25 }); this.tone({ f: 1800, f1: 420, type: 'triangle', dur: 0.32, vol: 0.1 }); break;
        case 'interrupt':
          this.noise({ type: 'highpass', f: 2500, dur: 0.5, vol: 0.35, verb: true }); this.glass(7, 2200, 0.07);
          this.tone({ f: 320, f1: 70, dur: 0.45, vol: 0.32 }); this.tone({ f: 1200, f1: 3600, type: 'triangle', dur: 0.4, vol: 0.06, delay: 0.05 });
          break;
        case 'recall':
          this.noise({ type: 'bandpass', f: 300, f1: 2600, q: 1.2, a: 0.12, dur: 0.06, vol: 0.32 });
          this.tone({ f: 280, f1: 1400, a: 0.1, dur: 0.12, vol: 0.12, type: 'triangle', verb: true });
          break;
        case 'pierce': this.tone({ f: 620, f1: 2480, glide: 0.16, type: 'triangle', dur: 0.2, vol: 0.12, verb: true }); this.noise({ type: 'highpass', f: 4200, dur: 0.18, vol: 0.12 }); break;
        // shock-ring timing cue: a dry clock tick (ring k of n rises in pitch) — "dash NOW"
        case 'ringTick': { const f = 1480 * (1 + 0.12 * (o.k || 0)); this.noise({ type: 'bandpass', f: 3200, q: 3, dur: 0.025, vol: 0.32 }); this.tone({ f, dur: 0.09, vol: 0.16 }); this.tone({ f: f * 2, dur: 0.05, vol: 0.05, delay: 0.01 }); break; }
        case 'ringSafe': this.tone({ f: 990, dur: 0.12, vol: 0.06, type: 'triangle' }); this.tone({ f: 1320, dur: 0.14, vol: 0.05, type: 'triangle', delay: 0.05 }); break;
        case 'hurt': this.tone({ f: 120, f1: 50, dur: 0.22, vol: 0.32 }); this.noise({ type: 'lowpass', f: 1000, dur: 0.14, vol: 0.22 }); break;
        case 'heal': [660, 880, 1318.5].forEach((f, i) => this.tone({ f, dur: 0.32, vol: 0.06, delay: i * 0.06, verb: true })); break;
        case 'ultCharge':
          this.noise({ type: 'bandpass', f: 180, f1: 4200, q: 1.5, a: 1.1, dur: 0.25, vol: 0.32 });
          this.tone({ f: 110, f1: 880, glide: 1.25, a: 1.1, dur: 0.2, vol: 0.12, type: 'sawtooth', lp: 2400 });
          break;
        case 'ultRelease':
          this.tone({ f: 72, f1: 26, dur: 1.7, vol: 1.0 });
          this.noise({ type: 'lowpass', f: 9000, f1: 300, dur: 1.5, vol: 0.55, verb: true });
          for (const f of [440, 554.37, 659.25, 880]) this.tone({ f, type: 'triangle', dur: 2.2, vol: 0.05, delay: 0.05, verb: true });
          this.glass(10, 2600, 0.05, 0.1);
          break;
        case 'heartbeat': this.tone({ f: 62, f1: 40, dur: 0.13, vol: 0.45 }); this.tone({ f: 56, f1: 36, dur: 0.11, vol: 0.32, delay: 0.2 }); break;
        case 'ui': this.tone({ f: 1250, dur: 0.05, vol: 0.07 }); break;
        case 'uiConfirm': this.tone({ f: 880, dur: 0.12, vol: 0.08 }); this.tone({ f: 1318.5, dur: 0.16, vol: 0.07, delay: 0.06 }); break;
        case 'deny': this.tone({ f: 190, dur: 0.07, vol: 0.06, type: 'triangle' }); break;
        case 'countdown': this.tone({ f: 880, dur: 0.18, vol: 0.14, verb: true }); break;
        case 'fight':
          for (const f of [220, 277.18, 329.63, 440]) this.tone({ f, type: 'sawtooth', dur: 0.6, vol: 0.05, lp: 2600, verb: true });
          this.tone({ f: 80, f1: 40, dur: 0.4, vol: 0.4 });
          break;
        case 'death': this.tone({ f: 220, f1: 50, dur: 1.6, vol: 0.28, type: 'triangle', verb: true }); this.noise({ type: 'lowpass', f: 600, f1: 80, dur: 1.2, vol: 0.3 }); break;
        case 'victory': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 1.6, vol: 0.08, delay: i * 0.09, verb: true })); break;
        case 'rumble': this.noise({ type: 'lowpass', f: 140, q: 0.7, a: 0.6, dur: o.dur || 2.0, vol: 0.55 }); break;
        case 'bell': { const f = o.f || 320; [1, 2.41, 3.93, 5.62].forEach((k, i) => this.tone({ f: f * k, dur: 2.2 / (1 + i * 0.6), vol: 0.12 / (1 + i), verb: true })); break; }
        case 'stamp': this.tone({ f: 1760, type: 'triangle', dur: 0.35, vol: 0.04, verb: true }); this.tone({ f: 2637, type: 'triangle', dur: 0.3, vol: 0.03, delay: 0.04 }); break;
        case 'explode': this.noise({ type: 'lowpass', f: 1200, f1: 100, dur: 0.65, vol: 0.5 }); this.tone({ f: 95, f1: 38, dur: 0.45, vol: 0.4 }); break;
        case 'tap': this.noise({ type: 'bandpass', f: 520, dur: 0.1, vol: 0.22 }); this.tone({ f: 130, f1: 70, dur: 0.12, vol: 0.2 }); break;
        case 'fracture': this.tone({ f: 1900 + (o.n || 0) * 260, dur: 0.18, vol: 0.06 }); break;
        case 'spawn': this.noise({ type: 'bandpass', f: 300, f1: 1200, dur: 0.4, vol: 0.2 }); this.tone({ f: 200, f1: 400, dur: 0.3, vol: 0.08, type: 'triangle' }); break;
        case 'echo': this.tone({ f: 1500, f1: 900, dur: 0.25, vol: 0.04, verb: true }); break;
        case 'whoosh': this.noise({ type: 'bandpass', f: o.f || 400, f1: o.f1 || 1800, q: 0.9, a: o.a || 0.05, dur: o.dur || 0.4, vol: o.vol || 0.25 }); break;
        case 'pool': this.noise({ type: 'lowpass', f: 700, dur: 0.3, vol: 0.18 }); break;
        default: break;
      }
    } catch (e) { /* audio is best-effort */ }
  },

  // ---------------------------------------------------------------- telegraph tones (§3): pitch rises 220→660 Hz
  updateTele(list) {
    if (!this.ready || !this.tele.length) return;
    const T = CONFIG.telegraph.tone, now = this.ctx.currentTime;
    // pick the (up to) 3 most imminent unresolved telegraphs without allocating
    let a = null, b = null, c = null;
    for (let i = 0; i < list.length; i++) {
      const tg = list[i];
      if (!tg.active || tg.resolved || tg.silent) continue;
      const r = tg.windup - tg.t;
      if (!a || r < a.windup - a.t) { c = b; b = a; a = tg; }
      else if (!b || r < b.windup - b.t) { c = b; b = tg; }
      else if (!c || r < c.windup - c.t) c = tg;
    }
    const picks = this._picks || (this._picks = [null, null, null]);
    picks[0] = a; picks[1] = b; picks[2] = c;
    const vol = this.muted ? 0 : T.vol;
    for (let i = 0; i < this.tele.length; i++) {
      const v = this.tele[i], tg = picks[i];
      if (tg && Game.timeScale > 0) {
        const p = clamp01(tg.t / tg.windup);
        v.o.frequency.setTargetAtTime(T.f0 + (T.f1 - T.f0) * p, now, 0.02);
        v.g.gain.setTargetAtTime(vol * (0.5 + 0.5 * p), now, 0.03);
        v.on = true;
      } else if (v.on) { v.g.gain.setTargetAtTime(0, now, 0.04); v.on = false; }
    }
  },

  // ---------------------------------------------------------------- music: drone pad + percussion loop (§8.6)
  music: {
    key: null, nodes: null, phase: 0, bpm: 84, next: 0, step: 0, pending: null, out: null,
    chords: {
      training: { notes: [110.0, 164.81, 246.94], bpm: 80, cutoff: 700 },
      title:    { notes: [82.41, 123.47, 185.0], bpm: 0, cutoff: 500 },
      pyrrha:   { notes: [73.42, 110.0, 174.61], bpm: 92, cutoff: 650 },   // D minor
      nerith:   { notes: [92.5, 138.59, 220.0], bpm: 86, cutoff: 750 },   // F# minor
      auren:    { notes: [65.41, 92.5, 138.59], bpm: 98, cutoff: 600 },   // tritone cluster
    },
    play(key) {
      const A = Audio;
      if (!A.ctx) { this.pending = key; return; }
      if (this.key === key && this.nodes) return;
      this.stop(1.2);
      const def = this.chords[key] || this.chords.training, ctx = A.ctx, t = ctx.currentTime;
      const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(1, t + 2.5); out.connect(A.musicBus);
      const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = def.cutoff; filt.Q.value = 3; filt.connect(out);
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.06; lfoG.gain.value = def.cutoff * 0.55;
      lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start();
      const oscs = [lfo];
      const dets = [-9, 0, 8];
      def.notes.forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dets[i % 3];
        const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(filt); o.start(); oscs.push(o);
      });
      const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = def.notes[0] / 2;
      const sg = ctx.createGain(); sg.gain.value = 0.12; sub.connect(sg); sg.connect(out); sub.start(); oscs.push(sub);
      this.nodes = { out, oscs, filt }; this.key = key; this.def = def;
      this.phase = 0; this.bpm = def.bpm; this.next = t + 0.6; this.step = 0;
    },
    setPhase(n) { this.phase = n; if (this.def) this.bpm = this.def.bpm + n * 10; },
    stop(fade) {
      const A = Audio;
      if (!this.nodes || !A.ctx) { this.key = null; return; }
      const t = A.ctx.currentTime, n = this.nodes, f = fade || 0.8;
      n.out.gain.cancelScheduledValues(t); n.out.gain.setValueAtTime(Math.max(0.0001, n.out.gain.value), t);
      n.out.gain.exponentialRampToValueAtTime(0.0001, t + f);
      for (const o of n.oscs) { try { o.stop(t + f + 0.1); } catch (e) { /* ignore */ } }
      this.nodes = null; this.key = null;
    },
    tick() {
      const A = Audio; if (!this.nodes || !this.bpm || !A.ready) return;
      const ctx = A.ctx, spb = 60 / this.bpm / 4;   // 16th notes
      if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05;
      const fighting = Game.state === 'fight' || Game.state === 'transition';
      while (this.next < ctx.currentTime + 0.12) {
        const s = this.step & 15, t = this.next;
        if (fighting) {
          if (s === 0 || s === 8 || (this.phase >= 1 && s === 11) || (this.phase >= 2 && s === 14)) this._kick(t);
          if ((s & 1) === 0) this._hat(t, (s & 3) === 2 ? 0.05 : 0.025);
          if (this.phase >= 2 && (s & 1) === 1) this._hat(t, 0.012);
        }
        this.next += spb; this.step++;
      }
    },
    _kick(t) {
      const ctx = Audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g); g.connect(this.nodes.out); o.start(t); o.stop(t + 0.3);
    },
    _hat(t, v) {
      const ctx = Audio.ctx, s = ctx.createBufferSource(); s.buffer = Audio.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f); f.connect(g); g.connect(this.nodes.out); s.start(t, Math.random()); s.stop(t + 0.07);
    },
  },

  update(dt) {
    if (!this.ctx) return;
    this.music.tick();
    this.updateTele(Telegraphs.list);
  },
};
/** Shorthand used everywhere: sfx('dash'), sfx('chime', {degree: 3}) */
const sfx = (name, opts) => Audio.sfx(name, opts);
