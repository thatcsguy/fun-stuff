// =====================================================================
// 03_audio.js: fully synthesized WebAudio (spec section 7).
// Music: per-track step sequencer (celesta / music-box arps, FM bells,
// formant choir pads, bass, clockwork percussion) with 4 intensity layers.
// SFX: named one-shots (unknown names are a no-op). Everything is a no-op
// until the first user gesture unlocks the context. Survives iOS suspend.
// =====================================================================
(() => {
  let ctx = null, unlocked = false, master, comp, musicBus, musicFilter, sfxBus, revIn, revOut, dlyIn, noiseBuf, limiter;
  const vol = { master: 0.85, music: 0.55, sfx: 0.85 };
  let muted = !!G.params.mute;
  let wantTrack = null, track = null, intensity = 0, pausedDuck = false;
  const recent = {};
  const LOOKAHEAD = 0.16;
  let timer = null;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const now = () => (ctx ? ctx.currentTime : 0);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ------------------------------------------------------------------
  // graph
  // ------------------------------------------------------------------
  function makeImpulse(sec, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * sec), buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const pre = i < rate * 0.012 ? 0 : 1;
        lp += (Math.random() * 2 - 1 - lp) * (0.55 - t * 0.4);   // darker tail
        d[i] = lp * Math.pow(1 - t, decay) * pre;
      }
    }
    return buf;
  }
  function build() {
    master = ctx.createGain(); master.gain.value = muted ? 0 : vol.master;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.22;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.1;
    master.connect(comp); comp.connect(limiter); limiter.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music;
    musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 18000; musicFilter.Q.value = 0.5;
    musicBus.connect(musicFilter); musicFilter.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    // reverb (shared): long, dark, celestial
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse(3.8, 2.6);
    revIn = ctx.createGain(); revIn.gain.value = 1; revOut = ctx.createGain(); revOut.gain.value = 0.55;
    const revHP = ctx.createBiquadFilter(); revHP.type = 'highpass'; revHP.frequency.value = 180;
    revIn.connect(revHP); revHP.connect(conv); conv.connect(revOut); revOut.connect(master);
    // music-box echo (dotted eighth-ish), lowpassed feedback
    const dly = ctx.createDelay(1.5); dly.delayTime.value = 0.43;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
    dlyIn = ctx.createGain(); dlyIn.gain.value = 1;
    dlyIn.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly);
    const dOut = ctx.createGain(); dOut.gain.value = 0.42; dlp.connect(dOut); dOut.connect(musicFilter); dOut.connect(revIn);
    // noise
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  // ------------------------------------------------------------------
  // primitives
  // ------------------------------------------------------------------
  // out(dest, {pan, rev, dly}) -> GainNode input that routes to dest (+ sends)
  function chain(dest, o = {}) {
    const g = ctx.createGain(); g.gain.value = 1;
    let node = g;
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = G.clamp(o.pan, -1, 1); g.connect(p); node = p; }
    node.connect(dest);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; node.connect(s); s.connect(revIn); }
    if (o.dly) { const s = ctx.createGain(); s.gain.value = o.dly; node.connect(s); s.connect(dlyIn); }
    return g;
  }
  function env(p, t, a, peak, d, end = 0.0001) {
    p.cancelScheduledValues(t); p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + Math.max(0.002, a));
    p.exponentialRampToValueAtTime(Math.max(0.0001, end), t + a + Math.max(0.01, d));
  }
  function osc(type, f, t, dur, dest, gainPeak, a = 0.005, opt = {}) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(1, opt.to), t + (opt.glide || dur));
    if (opt.detune) o.detune.value = opt.detune;
    const g = ctx.createGain(); env(g.gain, t, a, gainPeak, dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  }
  function noise(t, dur, dest, peak, o = {}) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q ?? 1;
    if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + (o.glide || dur));
    const g = ctx.createGain();
    if (o.swell) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.92); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else env(g.gain, t, o.a ?? 0.004, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.1);
    return f;
  }
  // celesta / music-box tine: sine + bright inharmonic partial + soft octave
  function celesta(t, f, v, dest, len = 1.4) {
    osc('sine', f, t, len, dest, 0.32 * v, 0.003);
    osc('sine', f * 4.01, t, len * 0.18, dest, 0.07 * v, 0.001);
    osc('triangle', f * 2, t, len * 0.45, dest, 0.06 * v, 0.002);
  }
  function musicBox(t, f, v, dest, len = 0.9) {
    osc('sine', f, t, len, dest, 0.26 * v, 0.002);
    osc('sine', f * 3.0, t, len * 0.25, dest, 0.06 * v, 0.001);
    osc('sine', f * 5.4, t, len * 0.08, dest, 0.05 * v, 0.001);
  }
  // FM bell
  function bell(t, f, v, dest, len = 3, ratio = 3.5, index = 2.4) {
    const c = ctx.createOscillator(); c.type = 'sine'; c.frequency.value = f;
    const m = ctx.createOscillator(); m.type = 'sine'; m.frequency.value = f * ratio;
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), t + len * 0.7);
    m.connect(mg); mg.connect(c.frequency);
    const g = ctx.createGain(); env(g.gain, t, 0.003, 0.3 * v, len);
    c.connect(g); g.connect(dest);
    c.start(t); m.start(t); c.stop(t + len + 0.1); m.stop(t + len + 0.1);
  }
  // choir pad: detuned saws through formant-ish filters, slow attack, vibrato
  function choir(t, freqs, dur, v, dest, o = {}) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cut || 1500; lp.Q.value = 0.4;
    const f1 = ctx.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = o.f1 || 760; f1.Q.value = 3; f1.gain.value = 9;
    const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = o.f2 || 1180; f2.Q.value = 4; f2.gain.value = 6;
    const g = ctx.createGain();
    const a = o.attack ?? 0.7, rel = o.release ?? 1.4;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11 * v, t + a);
    g.gain.setValueAtTime(0.11 * v, t + Math.max(a, dur)); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, dur) + rel);
    lp.connect(f1); f1.connect(f2); f2.connect(g); g.connect(dest);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6 + Math.random() * 0.8;
    const lg = ctx.createGain(); lg.gain.value = 9; lfo.connect(lg);
    const end = t + Math.max(a, dur) + rel + 0.1;
    for (const f of freqs) {
      for (const dt of [-8, 7]) {
        const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; s.detune.value = dt + rnd(-2, 2);
        lg.connect(s.detune);
        const sg = ctx.createGain(); sg.gain.value = 1 / freqs.length;
        s.connect(sg); sg.connect(lp); s.start(t); s.stop(end);
      }
    }
    lfo.start(t); lfo.stop(end);
  }
  function bass(t, f, v, dest, len = 0.5) {
    osc('sine', f, t, len, dest, 0.42 * v, 0.006);
    osc('triangle', f * 2, t, len * 0.4, dest, 0.08 * v, 0.004);
  }
  function kick(t, v, dest) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = ctx.createGain(); env(g.gain, t, 0.003, 0.6 * v, 0.34); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.42);
  }
  function tick(t, v, dest, hi = 1) {   // clockwork escapement tick
    noise(t, 0.025, dest, 0.2 * v, { type: 'highpass', f: 5200 * hi, q: 0.7, a: 0.001 });
    osc('sine', 3100 * hi, t, 0.03, dest, 0.05 * v, 0.001);
  }
  function hat(t, v, dest, len = 0.05) { noise(t, len, dest, 0.12 * v, { type: 'highpass', f: 8000, q: 0.5, a: 0.001 }); }
  function snare(t, v, dest) { noise(t, 0.16, dest, 0.22 * v, { type: 'bandpass', f: 1900, q: 0.6, a: 0.001 }); osc('triangle', 210, t, 0.08, dest, 0.12 * v, 0.001, { to: 150 }); }
  function pulseSynth(t, f, v, dest, len = 0.12) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(2400, t); fl.frequency.exponentialRampToValueAtTime(260, t + len);
    const g = ctx.createGain(); env(g.gain, t, 0.003, 0.12 * v, len);
    o.connect(fl); fl.connect(g); g.connect(dest); o.start(t); o.stop(t + len + 0.05);
  }

  // ------------------------------------------------------------------
  // music: track definitions
  // ------------------------------------------------------------------
  const SC = {
    lydian: [0, 2, 4, 6, 7, 9, 11], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    harm: [0, 2, 3, 5, 7, 8, 11], phrygdom: [0, 1, 4, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11],
  };
  const deg = (def, d, oct = 0) => { const s = def.scale, n = s.length; const o = Math.floor(d / n); const i = ((d % n) + n) % n; return def.root + s[i] + 12 * (o + oct); };
  const chordTones = (def, rootDeg) => [deg(def, rootDeg), deg(def, rootDeg + 2), deg(def, rootDeg + 4), deg(def, rootDeg + 6)];
  // motif entries: [step, degree, lenSteps, vel]
  const TRACKS = {
    menu: {
      bpm: 72, spb: 4, beats: 4, root: 62, scale: SC.lydian, prog: [0, 4, 5, 3], perc: 'none', maxLayer: 1, bright: 0.8,
      motif: [[0, 4, 4], [4, 6, 2], [6, 7, 2], [8, 9, 6], [16, 8, 2], [18, 7, 2], [20, 6, 4], [24, 4, 8],
        [32, 2, 4], [36, 4, 2], [38, 6, 2], [40, 7, 6], [48, 11, 4], [52, 9, 4], [56, 7, 8]],
      arp: [0, 2, 1, 3, 2, 1, 0, 2, 1, 3, 2, 3, 0, 1, 2, 3], arpOct: 1,
    },
    practice: {
      bpm: 84, spb: 4, beats: 4, root: 60, scale: SC.major, prog: [0, 5, 3, 4], perc: 'clock', maxLayer: 2, bright: 0.85,
      motif: [[0, 7, 2], [2, 9, 2], [4, 11, 4], [8, 9, 2], [10, 7, 2], [12, 4, 4], [16, 5, 2], [18, 7, 2], [20, 9, 4], [24, 8, 4], [28, 7, 4]],
      arp: [0, 1, 2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 3, 2, 1, 2], arpOct: 1,
    },
    // GNOMON, the Brass Warden: clockwork, crystalline, A aeolian
    0: {
      bpm: 100, spb: 4, beats: 4, root: 57, scale: SC.aeolian, prog: [0, 5, 2, 6], perc: 'clock', maxLayer: 3, bright: 1,
      motif: [[0, 7, 2], [2, 6, 2], [4, 4, 2], [6, 2, 2], [8, 4, 4], [12, 3, 4], [16, 7, 2], [18, 6, 2], [20, 4, 2], [22, 6, 2], [24, 7, 6], [30, 9, 2],
        [32, 9, 2], [34, 8, 2], [36, 7, 2], [38, 4, 2], [40, 6, 4], [44, 4, 4], [48, 2, 2], [50, 4, 2], [52, 3, 2], [54, 1, 2], [56, 0, 8]],
      arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2, 1, 2], arpOct: 1,
    },
    // OUROS, the Aurora Coil: sinuous 12/8, E harmonic minor
    1: {
      bpm: 104, spb: 3, beats: 4, root: 52, scale: SC.harm, prog: [0, 5, 3, 4], perc: 'shimmer', maxLayer: 3, bright: 1,
      motif: [[0, 4, 3], [3, 5, 1], [4, 4, 2], [6, 2, 3], [9, 1, 3], [12, 0, 6], [18, 2, 3], [21, 4, 3],
        [24, 7, 3], [27, 8, 1], [28, 7, 2], [30, 5, 3], [33, 4, 3], [36, 6, 6], [42, 4, 3], [45, 3, 3]],
      arp: [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 1], arpOct: 1,
    },
    // HELIARCH, the Dying Sun: heavy tolls, C phrygian dominant
    2: {
      bpm: 112, spb: 4, beats: 4, root: 48, scale: SC.phrygdom, prog: [0, 1, 0, 6], perc: 'toll', maxLayer: 3, bright: 0.95,
      motif: [[0, 7, 4], [4, 8, 2], [6, 7, 2], [8, 5, 6], [14, 4, 2], [16, 5, 4], [20, 4, 2], [22, 2, 2], [24, 1, 8],
        [32, 7, 4], [36, 9, 2], [38, 8, 2], [40, 10, 6], [46, 9, 2], [48, 8, 4], [52, 7, 2], [54, 5, 2], [56, 4, 8]],
      arp: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 3, 2, 1, 0], arpOct: 1,
    },
  };

  class Track {
    constructor(key, def) {
      this.key = key; this.def = def; this.step = 0; this.next = now() + 0.12; this.alive = true;
      // motif lookup: step -> notes; the motif loops over a whole number of bars
      const barLen = def.spb * def.beats, last = def.motif.reduce((a, m) => Math.max(a, m[0] + 1), 1);
      this.motifLen = Math.ceil(last / barLen) * barLen; this.motifAt = {};
      for (const m of def.motif) (this.motifAt[m[0]] || (this.motifAt[m[0]] = [])).push(m);
      this.bus = ctx.createGain(); this.bus.gain.setValueAtTime(0.0001, now()); this.bus.gain.exponentialRampToValueAtTime(1, now() + 1.4);
      this.bus.connect(musicBus);
      this.layers = [0, 1, 2, 3].map((i) => { const g = ctx.createGain(); g.gain.value = i <= this.lvl() ? 1 : 0.0001; g.connect(this.bus); return g; });
      this.dest = this.layers.map((g) => ({
        dry: g, rev: chain(g, { rev: 0.55 }), wet: chain(g, { rev: 0.5, dly: 0.45 }),
      }));
    }
    lvl() { return Math.min(intensity, this.def.maxLayer ?? 3); }
    setLevel(t) {
      const l = this.lvl();
      this.layers.forEach((g, i) => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(i <= l ? 1 : 0.0001, t, 0.6); });
    }
    stop(fade = 1.2) {
      this.alive = false; const t = now();
      this.bus.gain.cancelScheduledValues(t); this.bus.gain.setValueAtTime(Math.max(0.0001, this.bus.gain.value), t);
      this.bus.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      setTimeout(() => { try { this.bus.disconnect(); } catch (e) { /* gone */ } }, (fade + 4) * 1000);
    }
    stepDur() { return 60 / (this.def.bpm * (1 + 0.035 * this.lvl())) / this.def.spb; }
    pump() {
      if (!this.alive) return;
      const t0 = now();
      if (this.next < t0 - 0.05) this.next = t0 + 0.05;   // after a suspend: skip instead of bursting
      while (this.next < t0 + LOOKAHEAD) { try { this.play(this.step, this.next); } catch (e) { G.log.error('audio.play', e); } this.next += this.stepDur(); this.step++; }
    }
    play(step, t) {
      const d = this.def, spb = d.spb, barLen = spb * d.beats, s = step % barLen, bar = Math.floor(step / barLen);
      const L = this.dest, lvl = this.lvl(), chordDeg = d.prog[bar % d.prog.length], ch = chordTones(d, chordDeg);
      const beat = s % spb === 0, beatIdx = Math.floor(s / spb);
      // ---- layer 0: pad, bar bell, sparse arp ----
      if (s === 0) {
        choir(t, [mtof(ch[0] - 12), mtof(ch[1] - 12), mtof(ch[2] - 12), mtof(ch[0])], this.stepDur() * barLen * 0.98, 1.0 * d.bright, L[0].rev, { cut: 1200 + lvl * 350 });
        bell(t, mtof(ch[0] + 12), 0.55, L[0].rev, 3.4);
        if (lvl >= 2) choir(t, [mtof(ch[2]), mtof(ch[3]), mtof(ch[0] + 12)], this.stepDur() * barLen * 0.98, 0.55, L[2].rev, { cut: 2200, f1: 900, f2: 1400 });
      }
      if (beat) {
        const n = ch[d.arp[(beatIdx * 3) % d.arp.length] % 4] + 12 * d.arpOct + (beatIdx % 2 ? 12 : 0);
        celesta(t, mtof(n), 0.42, L[0].wet, 1.6);
        if (G.world && G.world.beat) { const ms = Math.max(0, (t - now()) * 1000); setTimeout(() => { try { G.world.beat(beatIdx === 0 ? 1 : 0.55); } catch (e) { /* */ } }, ms); }
      }
      // ---- layer 1: motif, bass, light percussion ----
      const hits = this.motifAt[step % this.motifLen];
      if (hits) for (const m of hits) {
        const f = mtof(deg(d, m[1], 1));
        celesta(t, f, 0.62 * (m[3] || 1), L[1].wet, 0.8 + m[2] * this.stepDur() * 1.5);
        if (lvl >= 3) musicBox(t, f * 2, 0.4, L[3].wet, 0.7);
        if (lvl >= 2 && m[2] >= 4) bell(t, f, 0.25, L[2].rev, 2.2, 2.0, 1.4);
      }
      if (s === 0) bass(t, mtof(ch[0] - 24), 0.9, L[1].dry, this.stepDur() * spb * 1.8);
      if (s === spb * 2) bass(t, mtof(ch[2] - 24), 0.7, L[1].dry, this.stepDur() * spb * 1.6);
      this.perc(s, t, beat, beatIdx, lvl);
      // ---- layer 2: running music-box arpeggio, kick ----
      {
        const ai = d.arp[s % d.arp.length], n = ch[ai % 4] + 12 + (s >= barLen / 2 && ai === 0 ? 12 : 0);
        musicBox(t, mtof(n + 12), 0.34 * (s % 2 ? 0.75 : 1), L[2].wet, 0.6);
        if (beat && (beatIdx === 0 || beatIdx === 2 || lvl >= 3)) kick(t, beatIdx === 0 ? 0.9 : 0.6, L[2].dry);
        if (s % 2 === 1 && lvl >= 2) bass(t, mtof(ch[0] - 12), 0.22, L[2].dry, 0.12);
      }
      // ---- layer 3: driving pulse + backbeat ----
      if (lvl >= 3) {
        pulseSynth(t, mtof(ch[0] - 12 + (s % 4 === 3 ? 7 : 0)), 0.9, L[3].dry, this.stepDur() * 0.9);
        if (beat && beatIdx % 2 === 1) snare(t, 0.8, L[3].rev);
      }
    }
    perc(s, t, beat, beatIdx, lvl) {
      const d = this.def, L = this.dest;
      if (d.perc === 'clock') {
        if (s % 2 === 0) tick(t, s % 4 === 0 ? 0.9 : 0.55, L[1].rev, s % 4 === 0 ? 1 : 0.75);
        if (lvl >= 2 && s % 2 === 1) tick(t, 0.3, L[2].dry, 1.3);
      } else if (d.perc === 'shimmer') {
        if (s % 3 === 0) hat(t, 0.6, L[1].rev, 0.09);
        if (lvl >= 2) hat(t, 0.3, L[2].dry, 0.03);
        if (s === 0) noise(t, this.stepDur() * 6, L[1].rev, 0.05, { type: 'bandpass', f: 600, fTo: 3000, q: 3, swell: true });
      } else if (d.perc === 'toll') {
        if (s === 0) bell(t, mtof(d.root - 12), 0.9, L[1].rev, 4.5, 1.41, 3.5);
        if (beat) hat(t, 0.4, L[1].dry, 0.04);
        if (lvl >= 2 && s % 2 === 0) tick(t, 0.25, L[2].dry, 0.6);
      }
    }
  }

  function pump() { if (track) track.pump(); }

  // ------------------------------------------------------------------
  // SFX
  // ------------------------------------------------------------------
  let pulseCount = 0, lastPulseAt = -99, chargeH = null;
  const panOf = (o) => {
    if (o && typeof o.pan === 'number') return o.pan;
    if (o && o.pos && G.cam && G.cam.toScreen) { const s = G.cam.toScreen(o.pos); return G.clamp((s.x / innerWidth) * 2 - 1, -1, 1) * 0.6; }
    return 0;
  };
  const MIN_GAP = { strike: 0.035, strikeHit: 0.03, hurt: 0.12, shift: 0.06, reverse: 0.06, warn: 0.04, telegraph: 0.09, uiHover: 0.04 };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const S = {
    strike(t, o, out) { osc('sine', 2600 * o.pitch, t, 0.05, out, 0.09, 0.001, { to: 1700 * o.pitch }); noise(t, 0.02, out, 0.05, { type: 'highpass', f: 7000 }); },
    strikeHit(t, o, out) { bell(t, 1400 * o.pitch * rnd(0.97, 1.03), 0.22 * (o.crit ? 1.8 : 1), out, 0.25, 2.76, 1.2); },
    anchor(t, o, out) {
      osc('sine', 190, t, 0.12, out, 0.4, 0.002, { to: 80 });
      bell(t, mtof(69), 0.6, out, 2.2, 3.0, 1.6); bell(t + 0.04, mtof(76), 0.45, out, 2.0, 3.0, 1.4);
      noise(t, 0.4, out, 0.05, { type: 'bandpass', f: 4000, fTo: 9000, q: 2 });
    },
    pulse(t, o, out) {
      const n = o.step != null ? o.step : (G.now - lastPulseAt < 10.5 ? ++pulseCount : (pulseCount = 0));
      lastPulseAt = G.now;
      const m = 81 + PENTA[Math.min(PENTA.length - 1, n)];
      celesta(t, mtof(m), 0.9, out, 1.8); celesta(t + 0.06, mtof(m + 7), 0.5, out, 1.4);
      noise(t, 0.18, out, 0.06, { type: 'bandpass', f: 2500, fTo: 7000, q: 3 });
    },
    heal(t, o, out) { for (let i = 0; i < 3; i++) osc('sine', mtof(84 + i * 4), t + i * 0.05, 0.4, out, 0.08, 0.01); },
    cometCharge(t, o, out) {
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 1.2); g.connect(out);
      const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.setValueAtTime(110, t); a.frequency.exponentialRampToValueAtTime(440, t + 1.2);
      const b = ctx.createOscillator(); b.type = 'sine'; b.frequency.setValueAtTime(220, t); b.frequency.exponentialRampToValueAtTime(880, t + 1.2);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 5; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3200, t + 1.2);
      const trem = ctx.createOscillator(); trem.frequency.value = 9; const tg = ctx.createGain(); tg.gain.value = 0.05; trem.connect(tg); tg.connect(g.gain);
      a.connect(f); b.connect(f); f.connect(g); a.start(t); b.start(t); trem.start(t);
      const nodes = [a, b, trem];
      const fullAt = t + 1.2;
      const h = {
        stopped: false,
        stop(t2 = now()) { if (h.stopped) return; h.stopped = true; g.gain.cancelScheduledValues(t2); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t2); g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.08); nodes.forEach((n) => { try { n.stop(t2 + 0.12); } catch (e) { /* */ } }); },
      };
      // a chime when full
      if (!o.silentFull) celesta(fullAt, mtof(88), 0.45, out, 1.2);
      // safety: auto-stop after 20 s
      setTimeout(() => h.stop(), 20000);
      chargeH = h; return h;
    },
    cometFull(t, o, out) { celesta(t, mtof(88), 0.6, out, 1.2); },
    cometBehind(t, o, out) { celesta(t, mtof(93), 0.7, out, 1.4); celesta(t + 0.05, mtof(100), 0.4, out, 1.2); },
    cometRelease(t, o, out) {
      if (chargeH) { chargeH.stop(t); chargeH = null; }
      const c = o.charge ?? 1;
      noise(t, 0.45, out, 0.22, { type: 'bandpass', f: 3500, fTo: 400, q: 1.5 });
      osc('sawtooth', 880 + c * 440, t, 0.35, out, 0.1, 0.002, { to: 220 });
      bell(t, mtof(76 + Math.round(c * 5)), 0.5, out, 1.4, 2.0, 2);
    },
    cometImpact(t, o, out) {
      const big = o.big || (o.charge ?? 0.5) > 0.7;
      osc('sine', 95, t, 0.6, out, 0.7, 0.003, { to: 32 });
      noise(t, big ? 0.9 : 0.5, out, 0.3, { type: 'lowpass', f: 2400, fTo: 200, q: 0.7 });
      bell(t, mtof(64), 0.7, out, 2.4, 1.41, 4); if (big) bell(t + 0.02, mtof(71), 0.5, out, 2.6, 1.41, 3);
    },
    eclipse(t, o, out) {
      osc('sine', 72, t, 1.4, out, 0.75, 0.02, { to: 38 });
      osc('sine', 36, t, 1.6, out, 0.4, 0.05);
      noise(t, 0.35, out, 0.12, { type: 'lowpass', f: 300, fTo: 3000, q: 1, swell: true });
      choir(t, [mtof(45), mtof(52), mtof(57)], 0.5, 0.9, out, { attack: 0.05, release: 1.2, cut: 800, f1: 400, f2: 900 });
    },
    interrupt(t, o, out) {
      noise(t, 0.35, out, 0.3, { type: 'highpass', f: 3000, q: 0.5 });
      for (let i = 0; i < 9; i++) osc('sine', rnd(2000, 6500), t + i * 0.018 + rnd(0, 0.02), rnd(0.15, 0.5), out, 0.07, 0.001);
      osc('triangle', 900, t, 0.6, out, 0.18, 0.002, { to: 180 });
      bell(t + 0.08, mtof(86), 0.7, out, 2.2, 2.0, 2.5);
    },
    aegisUp(t, o, out) { osc('sine', 440, t, 0.7, out, 0.12, 0.01); osc('sine', 660, t, 0.6, out, 0.1, 0.01); noise(t, 0.3, out, 0.05, { type: 'bandpass', f: 5000, q: 4 }); },
    block(t, o, out) { bell(t, 520, 0.8, out, 1.0, 1.41, 5); noise(t, 0.12, out, 0.2, { type: 'bandpass', f: 2500, q: 1 }); },
    perfect(t, o, out) {
      osc('sine', 1760, t, 1.6, out, 0.22, 0.002); osc('sine', 2637, t, 1.2, out, 0.14, 0.002);
      for (let i = 0; i < 5; i++) celesta(t + 0.04 * i, mtof(88 + PENTA[i]), 0.5, out, 0.8);
      bell(t, 880, 0.6, out, 1.5, 1.41, 3);
    },
    reflect(t, o, out) { noise(t, 0.25, out, 0.15, { type: 'bandpass', f: 800, fTo: 6000, q: 5 }); osc('sawtooth', 600, t, 0.22, out, 0.08, 0.002, { to: 2400 }); bell(t + 0.05, 1320, 0.4, out, 0.8, 2.0, 1.5); },
    novaBuild(t, o, out) {
      const d = o.dur ?? 2.6;
      noise(t, d, out, 0.3, { type: 'bandpass', f: 300, fTo: 6000, q: 2, swell: true, glide: d });
      choir(t, [mtof(57), mtof(64), mtof(69), mtof(73), mtof(76)], d, 1.2, out, { attack: d * 0.9, release: 0.3, cut: 3000 });
      for (let i = 0; i < 14; i++) { const u = i / 14; tick(t + d * (1 - Math.pow(1 - u, 1.6)), 0.6 + u, out, 1 + u); }
      osc('sine', 55, t, d, out, 0.3, d * 0.8, { to: 110 });
    },
    novaBlast(t, o, out) {
      osc('sine', 80, t, 2.2, out, 0.9, 0.004, { to: 26 });
      noise(t, 2.6, out, 0.4, { type: 'lowpass', f: 5000, fTo: 120, q: 0.6, glide: 2.4 });
      [57, 64, 69, 73, 76, 81].forEach((m, i) => bell(t + i * 0.015, mtof(m), 0.6, out, 4, 2.0, 2.5));
      choir(t, [mtof(45), mtof(57), mtof(64), mtof(69)], 1.8, 1.3, out, { attack: 0.02, release: 2.5, cut: 2600 });
    },
    novaReady(t, o, out) { [69, 76, 81, 85].forEach((m, i) => celesta(t + i * 0.07, mtof(m), 0.6, out, 1.8)); },
    shift(t, o, out) { noise(t, 0.24, out, 0.12, { type: 'bandpass', f: o.dir === 'out' ? 2400 : 700, fTo: o.dir === 'out' ? 700 : 2400, q: 1.6 }); osc('sine', o.dir === 'out' ? 520 : 400, t, 0.12, out, 0.05, 0.004, { to: o.dir === 'out' ? 400 : 620 }); },
    reverse(t, o, out) {
      const f = noise(t, 0.2, out, 0.12, { type: 'bandpass', f: 1400, fTo: 900, q: 4 });
      const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(f.frequency); lfo.start(t); lfo.stop(t + 0.25);
      tick(t, 0.6, out, 0.6);
    },
    bump(t, o, out) { osc('sine', 150, t, 0.12, out, 0.25, 0.003, { to: 90 }); },
    hurt(t, o, out) {
      const big = (o.amount || 20) >= 35;
      osc('sine', 120, t, 0.3, out, 0.6, 0.002, { to: 45 });
      osc('sawtooth', 220, t, 0.25, out, 0.08, 0.002, { to: 140 }); osc('sawtooth', 233, t, 0.25, out, 0.08, 0.002, { to: 148 });
      noise(t, big ? 0.35 : 0.2, out, 0.25, { type: 'lowpass', f: 1800, fTo: 300, q: 1 });
    },
    warn(t, o, out) {
      const p = G.clamp(o.progress ?? 0.5);
      if (o.lethal) { osc('square', 110 + p * 60, t, 0.16, out, 0.05, 0.004); osc('sine', 660 + p * 660, t, 0.08, out, 0.08, 0.002); }
      else osc('sine', 700 + p * 900, t, 0.07, out, 0.1, 0.002);
    },
    telegraph(t, o, out) {
      const lethal = !!o.lethal, dur = o.dur ?? (lethal ? 3 : 1.4);
      if (lethal) {
        // deep pulsing horn + rising ticks to the fire moment
        const hz = 98;
        for (let k = 0; k < 2; k++) {
          const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.value = hz * (k ? 1.007 : 1);
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(240, t); f.frequency.linearRampToValueAtTime(900, t + 0.5); f.Q.value = 3;
          const g = ctx.createGain(); env(g.gain, t, 0.08, 0.09, 0.9); a.connect(f); f.connect(g); g.connect(out); a.start(t); a.stop(t + 1.1);
        }
      } else { osc('sine', 880, t, 0.09, out, 0.08, 0.002); osc('sine', 1175, t + 0.08, 0.12, out, 0.08, 0.002); }
      if (o.ticks === false) return;
      const n = Math.max(3, Math.min(12, Math.round(dur * (lethal ? 3 : 2.5))));
      const ids = [];
      for (let i = 1; i <= n; i++) {
        const u = i / n; const tt = t + dur * (1 - Math.pow(1 - u, 1.7)) - 0.05;
        if (tt <= t + 0.1) continue;
        if (lethal) osc('sine', 330 + u * 660, tt, 0.07, out, 0.07 + u * 0.06, 0.002);
        else osc('sine', 900 + u * 700, tt, 0.05, out, 0.035 + u * 0.03, 0.002);
      }
      return { stop() { try { out.gain.cancelScheduledValues(now()); out.gain.setTargetAtTime(0.0001, now(), 0.02); } catch (e) { /* */ } } };
    },
    swell(t, o, out) {
      const d = o.dur ?? 2.4;
      noise(t, d, out, 0.25, { type: 'highpass', f: 2000, fTo: 7000, q: 0.5, swell: true });
      choir(t, [mtof(50), mtof(57), mtof(62), mtof(66), mtof(69)], d, 1.2, out, { attack: d * 0.85, release: 2, cut: 2400 });
      osc('sine', 40, t + d - 0.05, 1.6, out, 0.8, 0.01, { to: 28 });
      [74, 81, 86].forEach((m, i) => bell(t + d + i * 0.03, mtof(m), 0.6, out, 4, 2.0, 2));
    },
    castStart(t, o, out) { bell(t, mtof(45), 0.8, out, 3.5, 1.41, 3); if (o.interruptible) { celesta(t + 0.1, mtof(93), 0.6, out, 1.2); celesta(t + 0.22, mtof(98), 0.5, out, 1.2); } },
    castDone(t, o, out) { bell(t, mtof(40), 0.9, out, 3, 1.41, 5); noise(t, 0.6, out, 0.15, { type: 'lowpass', f: 900, q: 1 }); },
    constellation(t, o, out) { [76, 83, 88, 95].forEach((m, i) => celesta(t + i * 0.08, mtof(m), 0.55, out, 1.8)); },
    empower(t, o, out) { osc('sine', 660, t, 0.6, out, 0.1, 0.05, { to: 990, glide: 0.3 }); celesta(t + 0.2, mtof(88), 0.4, out, 1); },
    anchorSmash(t, o, out) { noise(t, 0.3, out, 0.22, { type: 'highpass', f: 2500 }); for (let i = 0; i < 6; i++) osc('sine', rnd(1800, 5000), t + rnd(0, 0.06), rnd(0.1, 0.35), out, 0.06, 0.001); osc('sine', 160, t, 0.25, out, 0.3, 0.002, { to: 60 }); },
    anchorWarn(t, o, out) { osc('triangle', 520, t, 0.1, out, 0.08, 0.002); osc('triangle', 390, t + 0.12, 0.12, out, 0.08, 0.002); },
    addSpawn(t, o, out) { celesta(t, mtof(79 + Math.floor(rnd(0, 3)) * 2), 0.35, out, 0.8); },
    addDeath(t, o, out) { noise(t, 0.12, out, 0.12, { type: 'bandpass', f: 3000, q: 1 }); celesta(t, mtof(84), 0.4, out, 0.6); celesta(t + 0.05, mtof(79), 0.3, out, 0.6); },
    bossHit(t, o, out) { osc('sine', 160, t, 0.1, out, 0.2, 0.002, { to: 90 }); },
    bossDeath(t, o, out) {
      osc('sine', 60, t, 3, out, 0.9, 0.01, { to: 24 });
      noise(t, 3.5, out, 0.35, { type: 'lowpass', f: 3000, fTo: 100, q: 0.7, glide: 3.2 });
      for (let i = 0; i < 10; i++) bell(t + 0.12 * i, mtof(93 - PENTA[i % PENTA.length]), 0.5, out, 3.5, 2.0, 2);
      choir(t + 0.3, [mtof(45), mtof(52), mtof(57), mtof(61), mtof(64)], 3, 1.2, out, { attack: 1.2, release: 3, cut: 2600 });
    },
    victory(t, o, out) {
      const seq = [69, 73, 76, 81, 85, 88];
      seq.forEach((m, i) => { celesta(t + i * 0.11, mtof(m), 0.8, out, 2); });
      [57, 64, 69, 73].forEach((m) => { const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.value = mtof(m); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(400, t + 0.6); f.frequency.linearRampToValueAtTime(2400, t + 1.0); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + 0.6); g.gain.linearRampToValueAtTime(0.05, t + 0.75); g.gain.setValueAtTime(0.05, t + 2.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8); a.connect(f); f.connect(g); g.connect(out); a.start(t + 0.6); a.stop(t + 4); });
      [81, 88, 93].forEach((m, i) => bell(t + 0.66 + i * 0.03, mtof(m), 0.7, out, 4.5, 2.0, 2));
      choir(t + 0.6, [mtof(57), mtof(61), mtof(64), mtof(69)], 2.2, 1.2, out, { attack: 0.3, release: 2.5, cut: 2800 });
    },
    defeat(t, o, out) {
      [76, 72, 69, 64, 60].forEach((m, i) => bell(t + i * 0.32, mtof(m), 0.7, out, 3.2, 1.41, 2.2));
      choir(t, [mtof(40), mtof(47), mtof(52), mtof(55)], 2.4, 1, out, { attack: 0.8, release: 2.4, cut: 900 });
      osc('sine', 55, t, 2.5, out, 0.4, 0.4, { to: 36 });
    },
    begin(t, o, out) { bell(t, mtof(69), 0.8, out, 3, 2.0, 2); bell(t + 0.02, mtof(76), 0.6, out, 3, 2.0, 2); choir(t, [mtof(57), mtof(64), mtof(69)], 0.8, 0.8, out, { attack: 0.05, release: 1.6, cut: 2200 }); },
    countdown(t, o, out) { celesta(t, mtof(o.final ? 88 : 81), 0.6, out, 0.8); },
    uiHover(t, o, out) { osc('sine', 2200, t, 0.03, out, 0.03, 0.001); },
    uiClick(t, o, out) { celesta(t, mtof(88), 0.35, out, 0.5); },
    uiConfirm(t, o, out) { celesta(t, mtof(81), 0.45, out, 0.8); celesta(t + 0.07, mtof(88), 0.45, out, 0.9); },
    uiBack(t, o, out) { celesta(t, mtof(84), 0.35, out, 0.5); celesta(t + 0.06, mtof(79), 0.3, out, 0.6); },
    uiToggle(t, o, out) { osc('sine', o.on === false ? 700 : 1000, t, 0.05, out, 0.06, 0.001); },
    thunder(t, o, out) { const d = o.dur ?? 2.4; noise(t, 0.08, out, 0.25 * (o.vol ?? 1), { type: 'highpass', f: 1500 }); noise(t + 0.05, d, out, 0.35 * (o.vol ?? 1), { type: 'lowpass', f: 600, fTo: 80, q: 0.8, glide: d }); },
    meteor(t, o, out) { osc('sine', 3200, t, 0.6, out, 0.012, 0.15, { to: 1400 }); },
    rumble(t, o, out) { noise(t, o.dur ?? 1.5, out, 0.25, { type: 'lowpass', f: 160, q: 1, a: 0.2 }); },
    crack(t, o, out) { noise(t, 0.15, out, 0.3, { type: 'bandpass', f: 1200, q: 0.8 }); osc('sine', 90, t, 0.4, out, 0.45, 0.002, { to: 40 }); for (let i = 0; i < 4; i++) bell(t + rnd(0, 0.08), rnd(300, 700), 0.3, out, 0.8, 1.41, 4); },
    lance(t, o, out) { noise(t, 0.16, out, 0.08, { type: 'bandpass', f: 3000, fTo: 8000, q: 6 }); },
    retrograde(t, o, out) { [0, 1, 2].forEach((i) => tick(t + i * 0.09, 0.9, out, 0.8 - i * 0.1)); osc('triangle', 300, t, 0.5, out, 0.1, 0.01, { to: 150 }); },
    gravity(t, o, out) { osc('sine', 60, t, 1.0, out, 0.5, 0.3, { to: 30 }); noise(t, 1.0, out, 0.1, { type: 'lowpass', f: 400, fTo: 100, swell: true }); },
  };
  S.complete = S.castDone; S.click = S.uiClick; S.confirm = S.uiConfirm; S.back = S.uiBack; S.hover = S.uiHover;
  S.release = S.cometRelease; S.impact = S.cometImpact; S.charge = S.cometCharge; S.shatter = S.interrupt; S.aegis = S.aegisUp;
  S.nova = S.novaBuild; S.blast = S.novaBlast; S.phase = S.swell; S.transition = S.swell; S.skid = S.reverse; S.whoosh = S.shift;
  S.plant = S.anchor; S.anchorPulse = S.pulse; S.hit = S.hurt; S.damage = S.hurt;
  const VOL = { strike: 0.55, strikeHit: 0.6, uiHover: 0.6, shift: 0.8, meteor: 0.5 };
  let activeVoices = 0;

  function sfx(name, opts) {
    if (!ctx || !unlocked || muted || ctx.state !== 'running') return null;
    const fn = S[name]; if (!fn) return null;
    const o = opts || {};
    const tnow = now();
    const gap = o.gap ?? MIN_GAP[name] ?? 0.05;
    if (recent[name] != null && tnow - recent[name] < gap && !o.force) return null;
    recent[name] = tnow;
    if (activeVoices > 48 && !o.force && (name === 'strike' || name === 'strikeHit' || name === 'warn' || name === 'uiHover')) return null;
    o.pitch = o.pitch ?? (o.step != null && name !== 'pulse' ? Math.pow(2, o.step / 12) : 1);
    try {
      const out = chain(sfxBus, { pan: panOf(o), rev: o.rev ?? 0.35 });
      out.gain.value = (o.vol ?? 1) * (VOL[name] ?? 1);
      activeVoices++; setTimeout(() => { activeVoices--; }, 1500);
      const t = tnow + (o.delay || 0) + 0.005;
      return fn(t, o, out) || { stop() { try { out.gain.setTargetAtTime(0.0001, now(), 0.03); } catch (e) { /* */ } } };
    } catch (e) { G.log.error('sfx:' + name, e); return null; }
  }

  // ------------------------------------------------------------------
  // unlock / lifecycle
  // ------------------------------------------------------------------
  function ensureCtx() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return false; } }
    try { build(); } catch (e) { G.log.error('audio.build', e); ctx = null; return false; }
    ctx.onstatechange = () => { A.state = ctx.state; };
    return true;
  }
  function unlock() {
    if (muted && !ctx) return;
    if (!ensureCtx()) return;
    if (ctx.state !== 'running') { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
    if (!unlocked) {
      // iOS: play one silent sample inside the gesture
      try { const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) { /* */ }
      unlocked = true; A.unlocked = true;
      if (!timer) timer = setInterval(pump, 40);
      if (wantTrack !== undefined && wantTrack !== null) startTrack(wantTrack);
      G.emit('audioUnlocked', {});
    }
  }
  function startTrack(key) {
    if (!ctx || !unlocked) return;
    if (track && track.key === key && track.alive) return;
    if (track) track.stop(1.4);
    track = null;
    const def = TRACKS[key];
    if (!def) return;
    track = new Track(key, def);
  }

  const A = G.audio = {
    unlocked: false, state: 'none', tracks: TRACKS,
    get ctx() { return ctx; },
    get muted() { return muted; },
    get intensity() { return intensity; },
    get current() { return track ? track.key : null; },
    init() {
      const evs = ['pointerdown', 'touchend', 'keydown', 'mousedown', 'click'];
      const h = () => { unlock(); if (ctx && ctx.state !== 'running' && !document.hidden) { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } };
      for (const e of evs) addEventListener(e, h, { capture: true, passive: true });
      document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) { const p = ctx.suspend(); if (p && p.catch) p.catch(() => {}); }
        else if (unlocked) { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      });
      addEventListener('pageshow', () => { if (ctx && unlocked) { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } });
      // settings stored by the UI
      try { const s = JSON.parse(localStorage.getItem('ph_settings') || 'null'); if (s) A.volumes({ master: s.master ?? s.masterVolume, music: s.music ?? s.musicVolume, sfx: s.sfx ?? s.sfxVolume }); } catch (e) { /* */ }
      hookEvents();
    },
    sfx,
    music(which) {
      if (which === 'victory' || which === 'defeat') { wantTrack = null; if (track) track.stop(0.8); track = null; sfx(which, { force: true }); return; }
      wantTrack = which == null ? null : (TRACKS[which] ? which : (typeof which === 'number' ? ((which % 3) + 3) % 3 : null));
      if (!ctx || !unlocked) return;
      if (wantTrack == null) { if (track) track.stop(1.6); track = null; return; }
      startTrack(wantTrack);
    },
    setIntensity(n) {
      n = Math.max(0, Math.min(3, n | 0));
      if (n === intensity) return;
      intensity = n;
      if (track && ctx) track.setLevel(now());
    },
    duck(amount = 0.5, dur = 1) {
      if (!ctx || !musicBus) return;
      const t = now(), g = musicBus.gain, base = muted ? 0 : vol.music * (pausedDuck ? 0.5 : 1);
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(Math.max(0.0001, base * (1 - G.clamp(amount))), t + 0.08);
      g.setTargetAtTime(base, t + 0.08 + dur * 0.4, dur * 0.3);
    },
    volumes(v = {}) {
      for (const k of ['master', 'music', 'sfx']) if (typeof v[k] === 'number' && isFinite(v[k])) vol[k] = G.clamp(v[k] > 1 ? v[k] / 100 : v[k]);
      if (!ctx) return { ...vol };
      const t = now();
      master.gain.setTargetAtTime(muted ? 0 : vol.master, t, 0.05);
      musicBus.gain.setTargetAtTime(vol.music * (pausedDuck ? 0.5 : 1), t, 0.05);
      sfxBus.gain.setTargetAtTime(vol.sfx, t, 0.05);
      return { ...vol };
    },
    setMuted(m) { muted = !!m; if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : vol.master, now(), 0.05); if (!muted) unlock(); },
    stopCharge() { if (chargeH) { chargeH.stop(); chargeH = null; } },
    autoEvents: true,
    // debug: peak meter
    analyser() {
      if (!ctx) return null;
      if (!A._an) { A._an = ctx.createAnalyser(); A._an.fftSize = 1024; limiter.connect(A._an); }
      const d = new Float32Array(A._an.fftSize); A._an.getFloatTimeDomainData(d); let p = 0; for (const x of d) p = Math.max(p, Math.abs(x)); return p;
    },
  };

  // ------------------------------------------------------------------
  // event hooks (deduped against direct sfx calls by the per-name min gap)
  // ------------------------------------------------------------------
  function hookEvents() {
    const on = (e, fn) => G.on(e, (d) => { if (A.autoEvents) fn(d || {}); });
    const EV = { gap: 0.15 };
    on('interrupt', () => sfx('interrupt', EV));
    on('aegisBlock', (d) => { sfx(d.perfect ? 'perfect' : 'block', EV); sfx('reflect', { gap: 0.15, delay: 0.06 }); });
    on('anchorPlaced', () => sfx('anchor', EV));
    on('anchorPulse', (d) => sfx('pulse', { gap: 0.15, pos: d.pos }));
    on('anchorSmashed', () => sfx('anchorSmash', EV));
    on('novaStart', () => { sfx('novaBuild', EV); A.duck(0.7, 3); });
    on('shift', (d) => sfx('shift', { gap: 0.15, dir: (d.to ?? 0) > (d.from ?? 0) ? 'out' : 'in' }));
    on('reverse', () => sfx('reverse', EV));
    on('playerDamaged', (d) => { if (!d.blocked && d.amount > 0) { sfx('hurt', { gap: 0.15, amount: d.amount }); A.duck(0.35, 0.5); } });
    on('phaseTransition', () => { sfx('swell', EV); A.duck(0.6, 2.5); });
    on('phaseStart', (d) => { if (typeof d.index === 'number') A.setIntensity(Math.min(3, d.index)); });
    on('castStart', (d) => sfx('castStart', { gap: 0.15, interruptible: d.interruptible }));
    on('castEnd', (d) => { if (!d.interrupted) sfx('castDone', EV); });
    on('constellation', (d) => { if (d.active) sfx('constellation', EV); });
    on('skillUsed', (d) => {
      const s = String(d.skill || '');
      if (/eclipse/i.test(s)) sfx('eclipse', EV);
      else if (/aegis/i.test(s)) sfx('aegisUp', EV);
      else if (/comet/i.test(s)) sfx('cometRelease', { gap: 0.15, charge: d.charge });
      if (d.empowered) sfx('empower', { gap: 0.15, vol: 0.6 });
    });
    on('bossDamaged', (d) => {
      const s = String(d.source || '');
      if (/nova/i.test(s)) sfx('novaBlast', EV);
      else if (/comet/i.test(s)) sfx('cometImpact', { gap: 0.15, big: d.amount > 180, pos: d.pos });
      else if (/aegis|reflect/i.test(s)) sfx('reflect', EV);
      else if (/strike/i.test(s)) sfx('strikeHit', { gap: 0.03, crit: d.crit || d.behind, pos: d.pos });
    });
    on('telegraph', (d) => sfx('telegraph', { gap: 0.12, lethal: d.lethal, dur: d.dur ?? d.warn, ticks: d.lethal ? true : false }));
    on('bossDefeated', () => { sfx('bossDeath', EV); A.duck(0.8, 3); });
    on('fightStart', (d) => { A.setIntensity(Math.min(3, d.fromPhase | 0)); const def = G.combat && G.combat.def; A.music(d.practice || d.bossIndex === 'practice' ? 'practice' : (def && def.music != null ? def.music : d.bossIndex)); });
    on('fightEnd', (d) => { if (d.result === 'victory') A.music('victory'); else if (d.result === 'defeat') A.music('defeat'); });
    on('playerDied', () => A.duck(0.8, 2));
    on('stateChange', (d) => {
      if (d.to === 'menu') { A.setIntensity(0); A.music('menu'); }
      const p = d.to === 'paused';
      if (p !== pausedDuck && ctx && musicFilter) {
        pausedDuck = p; const t = now();
        musicFilter.frequency.setTargetAtTime(p ? 700 : 18000, t, 0.15);
        musicBus.gain.setTargetAtTime(muted ? 0 : vol.music * (p ? 0.5 : 1), t, 0.15);
      }
    });
  }
})();
