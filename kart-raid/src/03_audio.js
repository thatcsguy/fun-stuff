// ============================================================================
// 03_audio.js — WebAudio synth only: engine, SFX catalog, lookahead step
// sequencer music with intensity layers / enrage / heartbeat mode.
// Owner: AUDIO. All calls are safe no-ops before unlock, with ?test=1 or ?mute=1.
// G.audio.beat (0..1 quarter-note phase) always ticks (a fake clock without audio)
// so visuals that pulse to the beat keep working in tests.
// ============================================================================
{
  // --------------------------------------------------------------- music data
  // Pattern strings: 16 steps per bar. Drums: 'x' hit, 'o' accent/open, '.' rest.
  // bass: r root, o octave, f fifth, b +1 semitone (phrygian bite), m minor 7th, '-' hold.
  // arp: digits index into the chord tones [root,3rd,5th,oct,3rd+8,5th+8,oct2].
  // lead: base-36 scale degree index from the key root (octave 5), '-' hold, '.' rest; 64 steps.
  const SC = {
    phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], harmonic: [0, 2, 3, 5, 7, 8, 11],
    aeolian: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], major: [0, 2, 4, 5, 7, 9, 11],
  };
  const TRACKS = {
    title: {
      bpm: 110, root: 45, scale: SC.aeolian, prog: [0, 5, 2, 6], fixed: 3,
      kick: 'x.......x.......', snare: '................', hat: '..x...x...x...x.', clap: '....x.......x...',
      bass: 'r.......r...o...', arp: '0.1.2.4.2.1.0.1.', lead: null, pad: true, soft: true,
    },
    boss1: { // E Phrygian, industrial
      bpm: 140, root: 40, scale: SC.phrygian, prog: [0, 1, 0, 6], dist: true,
      kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: '..x...x...x...x.', clap: '....x.......x..o',
      bass: 'rr.rr.rbrr.rr.of', arp: '0.2.3.2.0.2.4.2.',
      lead: '7-.7-.8-7-6-4---' + '4-.3-.4-6-4-----' + '7-.7-.8-a-8-7---' + '6-4-3-1-0-------', pad: true,
    },
    boss2: { // D Dorian, synthwave arps
      bpm: 150, root: 38, scale: SC.dorian, prog: [0, 3, 6, 4],
      kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', clap: '................',
      bass: 'r.o.r.o.r.o.r.o.', arp: '0123432101234321',
      lead: '7---9-8-7---4---' + '5---7-5-3-------' + '4---5-7-9---b---' + 'a-9-7-5-7-------', pad: true,
    },
    boss3: { // A harmonic minor, breakbeat + choir
      bpm: 160, root: 45, scale: SC.harmonic, prog: [0, 5, 3, 4], choir: true,
      kick: 'x.x.......xx....', snare: '....x..x.x..x..x', hat: 'x.x.x.x.x.x.x.x.', clap: '................',
      bass: 'r..r..r.r..o.r..', arp: '0.1.2.4.2.1.0.1.',
      lead: '7---8-7-6-7-----' + '4---5-4-3-2-----' + '7---9-a-b-a-9---' + 'd-c-b-a-9-8-6-7-', pad: true,
    },
    warp: {
      bpm: 128, root: 42, scale: SC.lydian, prog: [0, 1, 0, 1], fixed: 3,
      kick: 'x...x...x...x...', snare: '................', hat: '.xxx.xxx.xxx.xxx', clap: '....x.......x...',
      bass: 'r.ro.ror.ro.r.oo', arp: '0123401234012340', lead: null, pad: true,
    },
    victory: {
      bpm: 120, root: 48, scale: SC.major, prog: [0, 4, 5, 3], fixed: 3,
      kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', clap: '................',
      bass: 'r...r...r...o...', arp: '0.1.2.3.4.3.2.1.',
      lead: '7-.7-.7-9---b---' + 'a-9-7---9-------' + '7-.7-.7-9---b---' + 'e-----------....', pad: true,
    },
  };

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ------------------------------------------------------------------- state
  let ctx = null, enabled = true, unlocked = false;
  let master, comp, sfxBus, musicBus, musicFilter, synthBus, pump, drumBus, delay, delayFb, reverb, revSend, padFilter, padLfo, choirBus;
  let noiseBuf = null, distCurve = null;
  const vol = { master: 0.9, music: 0.55, sfx: 0.9 };
  let muted = false;
  const lastPlay = Object.create(null);  // sfx dedupe
  let voiceWin = 0, voiceCount = 0;

  // music
  const M = { id: null, track: null, playing: false, step: 0, nextT: 0, t0: 0, intensity: 1, layers: [true, false, false, false], enrage: false, mode: 'normal', modeT: 0, timer: null, fakeT0: 0 };
  // engine
  const E = { nodes: null, lastCall: -9, speed: 0, boost: 0, drift: 0, on: false };

  const audio = {
    beat: 0, bpm: 120, step: 0, bar: 0,
    get ctx() { return ctx; },
    get unlocked() { return unlocked; },
    get muted() { return muted; },
  };
  G.audio = audio;

  // ------------------------------------------------------------------ helpers
  function makeNoise() {
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function makeIR(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function makeCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
    return c;
  }
  // envelope gain: attack a, peak p, exponential-ish decay to ~0 at t+d
  function env(g, t, a, p, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(p, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function osc(type, f, t, dur, dest, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function gainNode(dest, v = 1) { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }
  function filt(type, f, q, dest) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; b.connect(dest); return b; }
  function noise(t, dur, dest, rate = 1) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rate;
    s.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s;
  }
  // a tone with pitch sweep and envelope
  function tone(type, f0, f1, t, a, d, v, dest, detune) {
    const g = gainNode(dest, 0); env(g, t, a, v, d);
    const o = osc(type, f0, t, a + d, g, detune);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + a + d);
    return o;
  }
  function nburst(t, a, d, v, dest, type, f0, f1, q, rate) {
    const g = gainNode(dest, 0); env(g, t, a, v, d);
    const f = filt(type, f0, q ?? 1, g);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    noise(t, a + d, f, rate); return f;
  }
  // FM bell
  function bell(t, f, d, v, dest, ratio = 3.5, index = 2.5) {
    const g = gainNode(dest, 0); env(g, t, 0.004, v, d);
    const c = osc('sine', f, t, d, g);
    const mg = ctx.createGain(); mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + d);
    const m = ctx.createOscillator(); m.frequency.value = f * ratio; m.connect(mg); mg.connect(c.frequency); m.start(t); m.stop(t + d + 0.05);
    return g;
  }
  // output node for an sfx with options {pan, vol}
  function outFor(o, base = 1) {
    let dest = sfxBus;
    const v = base * (o?.vol ?? 1);
    if (o && o.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); p.connect(dest); dest = p; }
    return gainNode(dest, v);
  }
  function send(node, amt) { const g = ctx.createGain(); g.gain.value = amt; node.connect(g); g.connect(revSend); }

  // --------------------------------------------------------------- the graph
  function build() {
    master = ctx.createGain(); master.gain.value = muted ? 0 : vol.master; master.connect(ctx.destination);
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18; comp.connect(master);
    sfxBus = gainNode(comp, vol.sfx);
    musicBus = gainNode(comp, vol.music);
    musicFilter = filt('lowpass', 20000, 0.7, musicBus);
    drumBus = gainNode(musicFilter, 1);
    pump = gainNode(musicFilter, 1);           // sidechain-pumped synths
    synthBus = gainNode(pump, 1);
    delay = ctx.createDelay(1.0); delayFb = ctx.createGain(); delayFb.gain.value = 0.32;
    const dl = filt('lowpass', 3000, 0.5, pump); delay.connect(dl); dl.connect(delayFb); delayFb.connect(delay);
    reverb = ctx.createConvolver(); reverb.buffer = makeIR(1.8, 3); reverb.connect(gainNode(comp, 0.5));
    revSend = gainNode(reverb, 1);
    padFilter = filt('lowpass', 900, 2, synthBus);
    padLfo = ctx.createOscillator(); padLfo.frequency.value = 0.13; const lg = ctx.createGain(); lg.gain.value = 500; padLfo.connect(lg); lg.connect(padFilter.frequency); padLfo.start();
    send(padFilter, 0.6);
    // choir formants ('ah'): two band-passes in parallel
    choirBus = ctx.createGain(); choirBus.gain.value = 1;
    const f1 = filt('bandpass', 800, 6, synthBus), f2 = filt('bandpass', 1150, 7, synthBus), f3 = filt('bandpass', 2900, 8, synthBus);
    choirBus.connect(f1); choirBus.connect(f2); choirBus.connect(f3); send(f1, 0.8); send(f2, 0.6);
    noiseBuf = makeNoise(); distCurve = makeCurve(3);
    buildEngine();
  }

  // ----------------------------------------------------------------- engine
  function buildEngine() {
    const out = gainNode(sfxBus, 0);
    const shaper = ctx.createWaveShaper(); shaper.curve = makeCurve(2.2); shaper.connect(out);
    const lp = filt('lowpass', 400, 4, shaper);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60; o1.connect(lp); o1.start();
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 60; o2.detune.value = 14; o2.connect(lp); o2.start();
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 30; const sg = gainNode(lp, 0.6); sub.connect(sg); sub.start();
    // boost: octave-up saw + filtered noise
    const bg = gainNode(lp, 0); const ob = ctx.createOscillator(); ob.type = 'sawtooth'; ob.frequency.value = 120; ob.connect(bg); ob.start();
    const bn = gainNode(sfxBus, 0); const bnf = filt('bandpass', 1400, 0.8, bn);
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true; ns.connect(bnf); ns.start();
    // drift screech: band-passed noise
    const dg = gainNode(sfxBus, 0); const df = filt('bandpass', 2600, 4, dg);
    const ns2 = ctx.createBufferSource(); ns2.buffer = noiseBuf; ns2.loop = true; ns2.playbackRate.value = 0.8; ns2.connect(df); ns2.start();
    E.nodes = { out, lp, o1, o2, sub, bg, ob, bn, bnf, dg, df };
  }
  // engine.update(speed m/s, boost 0..1|bool, drift 0..1 slip/charge amount)
  function engineSet(speed, boost, drift, active) {
    const n = E.nodes; if (!n) return;
    const t = ctx.currentTime, k = Math.max(0, Math.min(1, speed / 52)), b = +boost || 0, d = Math.max(0, Math.min(1, +drift || 0));
    const f = 60 + 160 * Math.pow(k, 0.85) + b * 18;
    n.o1.frequency.setTargetAtTime(f, t, 0.05); n.o2.frequency.setTargetAtTime(f * 1.005, t, 0.05); n.sub.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    n.ob.frequency.setTargetAtTime(f * 2, t, 0.05);
    n.lp.frequency.setTargetAtTime(400 + 2000 * k + b * 700, t, 0.06);
    n.out.gain.setTargetAtTime(active ? 0.05 + 0.07 * k : 0, t, active ? 0.08 : 0.15);
    n.bg.gain.setTargetAtTime(active ? b * 0.35 : 0, t, 0.06);
    n.bn.gain.setTargetAtTime(active ? b * 0.05 : 0, t, 0.06);
    n.bnf.frequency.setTargetAtTime(900 + 1400 * k, t, 0.1);
    n.dg.gain.setTargetAtTime(active ? d * 0.06 * (0.4 + k) : 0, t, 0.05);
    n.df.frequency.setTargetAtTime(2200 + 900 * d + 400 * Math.sin(t * 9), t, 0.04);
  }
  audio.engine = {
    update(speed, boost, drift) { E.lastCall = performance.now(); E.speed = speed; E.boost = boost; E.drift = drift; if (ctx) engineSet(speed, boost, drift, true); },
    stop() { if (ctx) engineSet(0, 0, 0, false); },
  };

  // ------------------------------------------------------------- instruments
  function kick(t, v, hard) {
    const g = gainNode(drumBus, 0); env(g, t, 0.002, v, hard ? 0.42 : 0.32);
    const o = osc('sine', 150, t, 0.45, hard ? shaped(g) : g); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    nburst(t, 0.001, 0.02, v * 0.3, drumBus, 'highpass', 3000, 3000, 0.7);
    // sidechain pump
    pump.gain.cancelScheduledValues(t); pump.gain.setValueAtTime(0.45, t); pump.gain.linearRampToValueAtTime(1, t + 0.2);
  }
  function shaped(dest) { const s = ctx.createWaveShaper(); s.curve = distCurve; s.connect(dest); return s; }
  function snare(t, v) {
    nburst(t, 0.001, 0.16, v, drumBus, 'bandpass', 1900, 1200, 0.8);
    nburst(t, 0.001, 0.07, v * 0.6, drumBus, 'highpass', 5000, 5000, 0.7);
    tone('triangle', 210, 160, t, 0.001, 0.09, v * 0.7, drumBus);
  }
  function clap(t, v) { for (let i = 0; i < 3; i++) nburst(t + i * 0.011, 0.001, i === 2 ? 0.14 : 0.02, v, drumBus, 'bandpass', 1400, 1100, 1.5); }
  function hat(t, v, open) { nburst(t, 0.001, open ? 0.18 : 0.035, v, drumBus, 'highpass', 7500, 7500, 0.8); }
  function bassNote(t, m, dur, v, dist) {
    const g = gainNode(synthBus, 0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.setTargetAtTime(v * 0.6, t + 0.02, 0.08); g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
    const f = filt('lowpass', 1600, 6, dist ? shaped(g) : g); f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(220, t + Math.min(0.25, dur));
    osc('sawtooth', mtof(m), t, dur + 0.15, f); osc('square', mtof(m - 12), t, dur + 0.15, f);
  }
  function arpNote(t, m, v, soft) {
    const g = gainNode(synthBus, 0); env(g, t, 0.003, v, soft ? 0.35 : 0.14);
    const f = filt('lowpass', soft ? 1800 : 3200, 3, g);
    osc(soft ? 'triangle' : 'square', mtof(m), t, 0.4, f);
    const ds = ctx.createGain(); ds.gain.value = 0.5; g.connect(ds); ds.connect(delay);
  }
  function leadNote(t, m, dur, v) {
    const g = gainNode(synthBus, 0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.setTargetAtTime(v * 0.7, t + 0.05, 0.2); g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
    const f = filt('lowpass', 2600, 2, g);
    const o1 = osc('sawtooth', mtof(m), t, dur + 0.4, f, -8), o2 = osc('square', mtof(m), t, dur + 0.4, f, 8);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.5; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(12, t + 0.3);
    vib.connect(vg); vg.connect(o1.detune); vg.connect(o2.detune); vib.start(t); vib.stop(t + dur + 0.4);
    const ds = ctx.createGain(); ds.gain.value = 0.35; g.connect(ds); ds.connect(delay); send(g, 0.25);
  }
  function padChord(t, ms, dur, v, choir) {
    const dest = choir ? choirBus : padFilter;
    for (const m of ms) {
      const g = gainNode(dest, 0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.3); g.gain.setTargetAtTime(0.0001, t + dur * 0.92, dur * 0.1);
      osc('sawtooth', mtof(m), t, dur * 1.3, g, -9); osc('sawtooth', mtof(m), t, dur * 1.3, g, 9);
    }
  }
  function siren(t, dur) {
    const g = gainNode(synthBus, 0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.1); g.gain.setTargetAtTime(0.0001, t + dur - 0.2, 0.08);
    const o = osc('sawtooth', 520, t, dur, filt('bandpass', 1200, 2, g));
    o.frequency.linearRampToValueAtTime(900, t + dur * 0.5); o.frequency.linearRampToValueAtTime(520, t + dur);
  }
  function tickClick(t, hi) { tone('sine', hi ? 2400 : 1600, hi ? 2400 : 1600, t, 0.001, 0.025, 0.12, drumBus); }

  // chord tones for a scale degree (diatonic triad + extensions), MIDI
  const _chord = [0, 0, 0, 0, 0, 0, 0];
  function chordOf(T, deg, baseOct) {
    const sc = T.scale, r = T.root + baseOct;
    const at = (i) => r + sc[i % 7] + 12 * Math.floor(i / 7);
    _chord[0] = at(deg); _chord[1] = at(deg + 2); _chord[2] = at(deg + 4); _chord[3] = at(deg + 7);
    _chord[4] = at(deg + 9); _chord[5] = at(deg + 11); _chord[6] = at(deg + 14);
    return _chord;
  }
  const _pad = [0, 0, 0];

  function schedStep(step, t) {
    const T = M.track; if (!T) return;
    const s = step % 16, bar = Math.floor(step / 16), stepDur = 60 / T.bpm / 4;
    const deg = T.prog[bar % T.prog.length];
    const L = M.layers, hb = M.mode === 'heartbeat';
    const fill = (bar % 8) === 7 && s >= 12;           // snare roll fill every 8 bars
    const soft = T.soft ? 0.55 : 1;
    if (hb) {
      // P3 of boss 3: heartbeat kick (lub-dub) + clock ticks + low pad
      if (s === 0) kick(t, 0.95, false); if (s === 3) kick(t, 0.6, false);
      if (s % 4 === 0) tickClick(t, s === 0);
      if (s === 0 && bar % 2 === 0) { const c = chordOf(T, deg, 12); _pad[0] = c[0]; _pad[1] = c[1]; _pad[2] = c[2]; padChord(t, _pad, stepDur * 32, 0.035, T.choir); }
      return;
    }
    // drums + bass (layer 0)
    if (L[0]) {
      if (T.kick[s] === 'x') kick(t, 0.95 * soft, T.dist);
      if (T.snare[s] === 'x' || (fill && T.snare.includes('x') && s % 2 === 0)) snare(t, (fill ? 0.25 + (s - 12) * 0.06 : 0.42) * soft);
      if (T.clap[s] === 'x' || T.clap[s] === 'o') clap(t, (T.clap[s] === 'o' ? 0.35 : 0.22) * soft);
      if (T.hat[s] === 'x') hat(t, 0.10 * soft, false);
      const bc = T.bass[s];
      if (bc && bc !== '.' && bc !== '-') {
        let len = 1; while (T.bass[(s + len) % 16] === '-' && len < 16) len++;
        const c = chordOf(T, deg, 0);
        const m = bc === 'o' ? c[0] + 12 : bc === 'f' ? c[0] + 7 : bc === 'b' ? c[0] + 1 : bc === 'm' ? c[0] + 10 : c[0];
        bassNote(t, m, stepDur * len * 0.9, 0.3 * (T.soft ? 0.7 : 1), T.dist);
      }
    }
    // arp (layer 1)
    if (L[1]) {
      const ac = T.arp[s];
      if (ac && ac !== '.') { const c = chordOf(T, deg, 24); arpNote(t, c[+ac] ?? c[0], T.soft ? 0.07 : 0.085, T.soft); }
    }
    // lead + pad (layer 2)
    if (L[2]) {
      if (T.lead) {
        const ls = step % 64, lc = T.lead[ls];
        if (lc && lc !== '.' && lc !== '-') {
          let len = 1; while (T.lead[(ls + len) % 64] === '-' && len < 16) len++;
          const di = parseInt(lc, 36), sc = T.scale;
          const m = T.root + 24 + sc[di % 7] + 12 * Math.floor(di / 7);
          leadNote(t, m, stepDur * len, 0.085);
        }
      }
    }
    if ((L[2] || T.fixed) && T.pad && s === 0) {
      const c = chordOf(T, deg, 12); _pad[0] = c[0]; _pad[1] = c[1]; _pad[2] = c[2];
      padChord(t, _pad, stepDur * 16, T.choir ? 0.05 : 0.035, T.choir);
    }
    // overclock hats (layer 3) / enrage doubles hats
    if (L[3] || M.enrage) { hat(t, s % 2 ? 0.05 : 0.08, s % 4 === 2); if (M.enrage) hat(t + stepDur * 0.5, 0.045, false); }
    if (M.enrage && s === 0 && bar % 2 === 0) siren(t, stepDur * 16);
  }

  function scheduler() {
    if (!ctx || !M.playing || !M.track) return;
    const ahead = ctx.currentTime + 0.1, stepDur = 60 / M.track.bpm / 4;
    // if we fell far behind (tab throttled), skip forward instead of bursting
    if (M.nextT < ctx.currentTime - 0.25) { const skip = Math.ceil((ctx.currentTime - M.nextT) / stepDur); M.nextT += skip * stepDur; M.step += skip; }
    while (M.nextT < ahead) { try { schedStep(M.step, M.nextT); } catch (e) { console.error('[audio] step', e); } M.nextT += stepDur; M.step++; }
  }

  // -------------------------------------------------------------------- music
  function applyIntensity() {
    const T = M.track;
    if (T?.fixed) { M.layers[0] = M.layers[1] = M.layers[2] = true; return; }
    M.layers[0] = true; M.layers[1] = M.intensity >= 2; M.layers[2] = M.intensity >= 3;
  }
  audio.music = {
    play(id, opts = {}) {
      const T = TRACKS[id]; if (!T) { console.warn('[audio] unknown track', id); return; }
      if (M.id === id && M.playing && !opts.restart) return;
      M.id = id; M.track = T; M.playing = true; M.step = 0; M.enrage = false; M.mode = 'normal';
      M.intensity = opts.intensity ?? (T.fixed ? 3 : 1); M.layers[3] = false; applyIntensity();
      audio.bpm = T.bpm; M.fakeT0 = performance.now() / 1000;
      if (ctx) {
        // short duck so the switch is not a hard cut
        const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(0.0001, t); musicBus.gain.linearRampToValueAtTime(vol.music, t + 0.25);
        M.nextT = t + 0.06; M.t0 = M.nextT;
        if (!M.timer) M.timer = setInterval(scheduler, 25);
        scheduler();
      }
    },
    stop(fade = 0.4) {
      M.playing = false; M.id = null;
      if (ctx) { const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(0.0001, t + fade); musicBus.gain.linearRampToValueAtTime(vol.music, t + fade + 0.3); }
    },
    layer(n, on) { if (n >= 0 && n < 4) M.layers[n] = !!on; },
    setIntensity(k) { M.intensity = Math.max(1, Math.min(3, Math.round(k))); applyIntensity(); },
    enrage(on) { M.enrage = !!on; },
    setMode(mode, dur) { M.mode = mode === 'heartbeat' ? 'heartbeat' : 'normal'; M.modeT = dur || 0; },
    get current() { return M.id; },
    get state() { return { id: M.id, playing: M.playing, intensity: M.intensity, layers: M.layers.slice(), enrage: M.enrage, mode: M.mode, step: M.step }; },
    tracks: Object.keys(TRACKS),
  };

  // ---------------------------------------------------------------------- SFX
  const SFX = {
    tier1(t, o) { const d = outFor(o, 0.35); bell(t, 523.25 * (o?.pitch || 1), 0.5, 0.5, d); send(d, 0.4); },
    tier2(t, o) { const d = outFor(o, 0.35); bell(t, 783.99 * (o?.pitch || 1), 0.55, 0.5, d); bell(t + 0.05, 523.25, 0.4, 0.25, d); send(d, 0.4); },
    tier3(t, o) { const d = outFor(o, 0.4); bell(t, 1046.5, 0.8, 0.5, d); bell(t + 0.04, 783.99, 0.6, 0.3, d); bell(t + 0.08, 1567.98, 0.7, 0.25, d, 2, 1.5); send(d, 0.6); },
    release(t, o) { const d = outFor(o, 0.4); tone('sawtooth', 1200, 200, t, 0.002, 0.22, 0.4, filt('lowpass', 4000, 2, d)); tone('square', 2400, 400, t, 0.001, 0.04, 0.3, d); },
    fizz(t, o) { nburst(t, 0.005, 0.18, 0.15, outFor(o), 'bandpass', 3000, 600, 2); },
    boltFire(t, o) { const d = outFor(o, 0.18); tone('square', 1800 * (o?.pitch || 1), 600, t, 0.001, 0.06, 0.5, filt('lowpass', 5000, 1, d)); },
    boltHit(t, o) { const d = outFor(o, 0.5); tone('sine', 160, 45, t, 0.001, 0.12, 0.8, d); nburst(t, 0.001, 0.09, 0.4, d, 'bandpass', 2500 * (o?.pitch || 1), 900, 1.2); },
    graze(t, o) {
      const d = outFor(o, 0.45); tone('sine', 3000, 3000, t, 0.001, 0.35, 0.35, d); tone('sine', 4500, 4500, t, 0.001, 0.2, 0.15, d); send(d, 0.6);
      // reverse whoosh
      const g = gainNode(d, 0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.18); g.gain.linearRampToValueAtTime(0.0001, t + 0.2);
      const f = filt('bandpass', 600, 1, g); f.frequency.exponentialRampToValueAtTime(3500, t + 0.2); noise(t, 0.22, f);
      musicDip(800, 0.25);
    },
    megaGraze(t, o) { SFX.graze(t, o); const d = outFor(o, 0.5); tone('sawtooth', 200, 1600, t, 0.01, 0.5, 0.25, filt('lowpass', 3000, 3, d)); bell(t + 0.05, 1568, 1.0, 0.4, d); send(d, 0.6); musicDip(500, 0.6); },
    perfect(t, o) {
      const d = outFor(o, 0.5); bell(t, 1318.5, 1.2, 0.45, d, 1.4, 3); bell(t, 1975.5, 1.0, 0.25, d, 2.01, 2); send(d, 0.8);
      // tape-stop on the music
      musicDip(400, 0.3);
    },
    dash(t, o) { const d = outFor(o, 0.4); const g = gainNode(d, 0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      const f = filt('bandpass', 400, 1.2, g); f.frequency.exponentialRampToValueAtTime(4000, t + 0.15); f.frequency.exponentialRampToValueAtTime(800, t + 0.3); noise(t, 0.32, f); },
    overclock(t, o) { const d = outFor(o, 0.35); tone('sawtooth', 110, 880, t, 0.6, 0.25, 0.3, filt('lowpass', 3500, 6, d)); nburst(t, 0.7, 0.2, 0.25, d, 'highpass', 1000, 8000, 1); send(d, 0.5); },
    comet(t, o) {
      const d = outFor(o, 0.6);
      if (o?.phase === 'launch' || o?.phase === 'dive') { tone('sawtooth', 80, 1200, t, 0.5, 0.15, 0.35, filt('lowpass', 2500, 8, d)); nburst(t, 0.6, 0.15, 0.3, d, 'bandpass', 300, 6000, 2); return; }
      tone('sine', 120, 25, t, 0.002, 1.2, 1.0, d); // sub drop
      nburst(t, 0.002, 1.1, 0.8, d, 'lowpass', 6000, 200, 0.7);
      bell(t, 523, 1.5, 0.3, d, 1.5, 4); bell(t, 784, 1.5, 0.2, d, 1.5, 4); send(d, 0.8);
    },
    hit(t, o) { const d = outFor(o, 0.55); nburst(t, 0.001, 0.2, 0.6, d, 'lowpass', 5000, 500, 0.8); tone('sine', 220, 70, t, 0.001, 0.25, 0.6, shaped(d)); },
    wreck(t, o) { const d = outFor(o, 0.7); nburst(t, 0.002, 1.2, 0.9, d, 'lowpass', 4000, 120, 0.8); tone('sawtooth', 180, 30, t, 0.002, 1.0, 0.5, shaped(d)); send(d, 0.5); },
    explosion(t, o) { const d = outFor(o, 0.65 * (o?.big ? 1.3 : 1)); nburst(t, 0.002, o?.big ? 2.0 : 0.9, 0.9, d, 'lowpass', 5000, 90, 0.7); tone('sine', 90, 28, t, 0.002, 0.8, 0.9, d); send(d, 0.6); },
    pad(t, o) { const d = outFor(o, 0.35); const g = gainNode(d, 0); env(g, t, 0.05, 0.6, 0.35); const f = filt('bandpass', 500, 1, g); f.frequency.exponentialRampToValueAtTime(5000, t + 0.3); noise(t, 0.45, f); tone('sine', 300, 900, t, 0.01, 0.2, 0.15, d); },
    boost(t, o) { const d = outFor(o, 0.3); nburst(t, 0.02, 0.5, 0.5, d, 'bandpass', 800, 3000, 1); tone('sawtooth', 220, 440, t, 0.01, 0.3, 0.2, filt('lowpass', 2000, 4, d)); },
    gate(t, o) { const d = outFor(o, 0.35); bell(t, 987.8, 0.6, 0.4, d); bell(t + 0.06, 1318.5, 0.6, 0.35, d); send(d, 0.6); SFX.boost(t, o); },
    itemRoll(t, o) { const d = outFor(o, 0.2); for (let i = 0; i < 10; i++) tone('square', 1200 + i * 60, 1200 + i * 60, t + i * 0.09 * (1 + i * 0.05), 0.001, 0.025, 0.4, d); },
    itemGet(t, o) { const d = outFor(o, 0.3); [784, 988, 1175, 1568].forEach((f, i) => bell(t + i * 0.06, f, 0.35, 0.35, d, 2, 1.5)); send(d, 0.5); },
    itemUse(t, o) { const d = outFor(o, 0.3); tone('square', 600, 1400, t, 0.001, 0.12, 0.3, filt('lowpass', 3000, 2, d)); },
    heal(t, o) { const d = outFor(o, 0.3); [523, 659, 784].forEach((f, i) => bell(t + i * 0.08, f, 0.5, 0.3, d, 1, 1)); send(d, 0.6); },
    shield(t, o) { const d = outFor(o, 0.35); tone('sine', 300, 1200, t, 0.05, 0.4, 0.3, d); tone('triangle', 600, 2400, t, 0.05, 0.4, 0.12, d); send(d, 0.7); },
    telePip(t, o) { const d = outFor(o, 0.18); const f = 700 * (o?.pitch || 1); tone('square', f, f, t, 0.001, 0.04, 0.5, filt('lowpass', 3000, 1, d)); },
    teleWhine(t, o) { const d = outFor(o, 0.2); tone('sawtooth', 300, 1400, t, 0.05, (o?.dur || 1.4), 0.25, filt('bandpass', 1500, 3, d)); },
    teleDrone(t, o) { const d = outFor(o, 0.3); tone('sawtooth', 73.4, 73.4, t, 0.1, 0.7, 0.4, filt('lowpass', 500, 3, d)); tone('sawtooth', 55, 55, t + 0.55, 0.1, 0.7, 0.4, filt('lowpass', 500, 3, d)); },
    chime(t, o) { const d = outFor(o, 0.3); bell(t, 1567.98, 1.2, 0.4, d, 2.76, 1.2); bell(t + 0.1, 2093, 1.0, 0.25, d, 2.76, 1); send(d, 0.8); },
    choir(t, o) { const g = gainNode(choirBus, 0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12 * (o?.vol ?? 1), t + 0.8); g.gain.linearRampToValueAtTime(0.0001, t + 2.2);
      [57, 64, 69, 72].forEach(m => { osc('sawtooth', mtof(m), t, 2.3, g, -6); osc('sawtooth', mtof(m), t, 2.3, g, 7); }); },
    bubble(t, o) { const d = outFor(o, 0.25); for (let i = 0; i < 6; i++) { const tt = t + i * 0.09 + Math.random() * 0.05, f = 120 + Math.random() * 180; tone('sine', f, f * 2.5, tt, 0.005, 0.07, 0.5, d); } },
    roar(t, o) {
      const d = outFor(o, 0.5); const g = gainNode(d, 0); env(g, t, 0.15, 0.6, 1.3);
      const sh = shaped(g); const f1 = filt('bandpass', 600, 5, sh), f2 = filt('bandpass', 1000, 6, sh);
      f1.frequency.linearRampToValueAtTime(400, t + 1.4); f2.frequency.linearRampToValueAtTime(700, t + 1.4);
      const base = 70 * (o?.pitch || 1);
      for (const det of [-15, 0, 12]) { const os = osc('sawtooth', base, t, 1.5, f1, det); os.connect(f2); os.frequency.linearRampToValueAtTime(base * 0.7, t + 1.4); }
      nburst(t, 0.1, 1.2, 0.2, d, 'lowpass', 900, 300, 0.7); send(d, 0.6);
    },
    stomp(t, o) { const d = outFor(o, 0.7); tone('sine', 90, 30, t, 0.002, 0.7, 1, shaped(d)); nburst(t, 0.002, 0.5, 0.5, d, 'lowpass', 1500, 100, 0.7); send(d, 0.5); },
    thunder(t, o) { const d = outFor(o, 0.6); nburst(t, 0.02, 2.5, 0.8, d, 'lowpass', 1200, 60, 0.6, 0.5); nburst(t, 0.001, 0.15, 0.5, d, 'highpass', 2000, 800, 0.6); send(d, 0.9); },
    laser(t, o) { const d = outFor(o, 0.25); tone('sawtooth', 1800, 300, t, 0.002, 0.3, 0.4, filt('bandpass', 2000, 3, d)); tone('square', 900, 150, t, 0.002, 0.3, 0.2, d); },
    tick(t, o) { tone('sine', 2400, 2400, t, 0.001, 0.03, 0.4, outFor(o, 0.4)); nburst(t, 0.001, 0.015, 0.3, outFor(o, 0.4), 'highpass', 6000, 6000, 1); },
    tock(t, o) { tone('sine', 1300, 1300, t, 0.001, 0.05, 0.4, outFor(o, 0.4)); },
    break(t, o) { const d = outFor(o, 0.55); nburst(t, 0.001, 1.4, 0.6, d, 'highpass', 3000, 6000, 0.5); [523, 659, 784, 1046].forEach((f, i) => bell(t + i * 0.015, f, 1.4, 0.3, d, 3.01, 3)); tone('sine', 110, 40, t, 0.002, 0.5, 0.8, d); send(d, 0.9); },
    enrage(t, o) { const d = outFor(o, 0.35); for (let i = 0; i < 4; i++) { const tt = t + i * 0.32; tone('sawtooth', 600, 900, tt, 0.01, 0.15, 0.4, filt('bandpass', 1000, 2, d)); tone('sawtooth', 900, 600, tt + 0.16, 0.01, 0.15, 0.4, filt('bandpass', 1000, 2, d)); } },
    countdown(t, o) { const go = !o?.n; const d = outFor(o, 0.4); const f = go ? 1760 : 880; tone('square', f, f, t, 0.002, go ? 0.5 : 0.18, 0.4, filt('lowpass', 4000, 1, d)); if (go) { tone('square', f * 0.5, f * 0.5, t, 0.002, 0.5, 0.3, d); send(d, 0.6); } },
    lap(t, o) { const d = outFor(o, 0.3); [659, 880, 1318].forEach((f, i) => bell(t + i * 0.07, f, 0.5, 0.35, d, 2, 1.2)); send(d, 0.6); },
    uiClick(t, o) { tone('square', 1500, 900, t, 0.001, 0.03, 0.25, outFor(o, 0.3)); },
    uiHover(t, o) { tone('sine', 1200, 1400, t, 0.001, 0.03, 0.12, outFor(o, 0.3)); },
    uiConfirm(t, o) { const d = outFor(o, 0.3); tone('square', 880, 880, t, 0.001, 0.06, 0.3, d); tone('square', 1320, 1320, t + 0.07, 0.001, 0.12, 0.3, d); },
    land(t, o) { const d = outFor(o, 0.35); tone('sine', 120, 50, t, 0.002, 0.15, 0.7, d); nburst(t, 0.002, 0.12, 0.3, d, 'lowpass', 2000, 300, 0.7); },
    scrape(t, o) { nburst(t, 0.005, 0.12, 0.25, outFor(o, 0.4), 'bandpass', 3500, 2500, 3, 1.3); },
    cast(t, o) { const d = outFor(o, 0.3); tone('sawtooth', 110, 220, t, 0.3, 0.4, 0.3, filt('lowpass', 800, 5, d)); send(d, 0.5); },
    interrupt(t, o) { const d = outFor(o, 0.5); tone('sawtooth', 900, 60, t, 0.002, 0.45, 0.5, shaped(d)); nburst(t, 0.002, 0.3, 0.5, d, 'bandpass', 2500, 500, 1.5); bell(t, 1174, 0.8, 0.3, d, 3.5, 3); send(d, 0.5); },
    wipe(t, o) { const d = outFor(o, 0.5); tone('sawtooth', 440, 55, t, 0.01, 1.6, 0.4, filt('lowpass', 1500, 3, d)); send(d, 0.6); },
    victory(t, o) { const d = outFor(o, 0.4); [523, 659, 784, 1046, 1318].forEach((f, i) => bell(t + i * 0.09, f, 1.2, 0.35, d, 2, 1.4)); send(d, 0.8); },
    heartbeat(t, o) { const d = outFor(o, 0.6); tone('sine', 70, 40, t, 0.002, 0.15, 1, d); tone('sine', 65, 38, t + 0.2, 0.002, 0.15, 0.7, d); },
  };
  SFX.bolt = SFX.boltFire; // alias used by 07_kart
  audio.sfxNames = Object.keys(SFX);

  function musicDip(freq, dur) {
    if (!musicFilter) return;
    const t = ctx.currentTime; musicFilter.frequency.cancelScheduledValues(t);
    musicFilter.frequency.setValueAtTime(freq, t); musicFilter.frequency.setTargetAtTime(20000, t + dur, 0.08);
  }
  audio.musicDip = (f = 800, d = 0.25) => { if (ctx) musicDip(f, d); };

  // G.audio.sfx(name, {pan, pitch, vol, delay}) — deduped per name within 35 ms; capped voices.
  audio.sfx = (name, o) => {
    if (!ctx || !unlocked || muted) return;
    const fn = SFX[name]; if (!fn) return;
    const now = ctx.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < 0.035 && !(o && o.force)) return;
    if (now - voiceWin > 0.25) { voiceWin = now; voiceCount = 0; }
    if (++voiceCount > 28) return;
    lastPlay[name] = now;
    try { fn(now + 0.005 + (o?.delay || 0), o); } catch (e) { console.error('[audio] sfx', name, e); }
  };
  // Stereo pan for a world position relative to the camera (-1 left .. 1 right)
  const _pv = new G.THREE.Vector3(), _pr = new G.THREE.Vector3();
  audio.panFor = (pos) => {
    const cam = G.camera; if (!cam || !pos) return 0;
    _pr.set(1, 0, 0).applyQuaternion(cam.quaternion);
    _pv.copy(pos).sub(cam.position); const l = _pv.length() || 1;
    return Math.max(-1, Math.min(1, _pv.dot(_pr) / l));
  };

  // ------------------------------------------------------ unlock / mute / vol
  audio.unlock = () => {
    if (!enabled) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { enabled = false; return; }
        ctx = new AC({ latencyHint: 'interactive' });
        build();
        if (M.playing && M.track) { M.nextT = ctx.currentTime + 0.06; M.t0 = M.nextT; if (!M.timer) M.timer = setInterval(scheduler, 25); }
      }
      if (ctx.state !== 'running') ctx.resume();
      unlocked = true;
    } catch (e) { console.warn('[audio] unlock failed', e); enabled = false; }
  };
  audio.mute = (on = !muted) => {
    muted = !!on;
    try { localStorage.setItem('db_mute', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(muted ? 0 : vol.master, ctx.currentTime, 0.05);
    return muted;
  };
  // setVolume('music'|'sfx'|'master', 0..1)
  audio.setVolume = (which, v) => {
    vol[which] = Math.max(0, Math.min(1, v));
    try { localStorage.setItem('db_vol_' + which, String(vol[which])); } catch (e) { /* ignore */ }
    if (!ctx) return;
    const node = which === 'music' ? musicBus : which === 'sfx' ? sfxBus : master;
    if (node && !(which === 'master' && muted)) node.gain.setTargetAtTime(vol[which], ctx.currentTime, 0.05);
  };
  audio.getVolume = (which) => vol[which];
  // Lazily created analyser on the master output (for visualizers / tests)
  let _an = null;
  audio.analyser = () => { if (!ctx) return null; if (!_an) { _an = ctx.createAnalyser(); _an.fftSize = 1024; master.connect(_an); } return _an; };

  // --------------------------------------------------------------- events
  function bindEvents() {
    const on = (n, f) => G.on?.(n, (e) => { try { f(e || {}); } catch (err) { console.error('[audio] ev', n, err); } });
    const sf = audio.sfx;
    on('kart:tier', e => sf('tier' + Math.max(1, Math.min(3, e.tier || 1))));
    on('kart:release', e => sf(e.tier > 0 ? 'release' : 'fizz'));
    on('kart:boost', e => sf(e.source === 'pad' ? 'pad' : e.source === 'gate' ? 'gate' : 'boost'));
    on('kart:graze', e => sf(e.mega ? 'megaGraze' : 'graze'));
    on('kart:dash', () => sf('dash'));
    on('kart:perfect', () => sf('perfect'));
    on('kart:comet', e => sf('comet', { phase: e.phase }));
    on('kart:hit', () => sf('hit'));
    on('kart:wreck', () => sf('wreck'));
    on('kart:land', e => { if (e.airTime > 0.3) sf('land'); });
    on('lap', () => sf('lap'));
    on('item:get', () => sf('itemGet'));
    on('item:use', e => sf(e.item === 'repair' ? 'heal' : e.item === 'prism' ? 'shield' : 'itemUse'));
    on('boss:damaged', e => sf('boltHit', { pitch: e.crit ? 1.6 : e.weak ? 1.3 : 1, vol: e.crit ? 1.3 : 1 }));
    on('boss:stagger', e => { if (e.on) sf('break'); });
    on('boss:cast', () => sf('cast'));
    on('boss:castEnd', e => { if (e.interrupted) sf('interrupt'); });
    on('boss:enrage', e => { sf('enrage'); audio.music.enrage(e.level >= 1); });
    on('boss:phase', e => {
      sf('roar', { pitch: e.boss === 2 ? 1.6 : e.boss === 3 ? 0.8 : 1 });
      audio.music.setIntensity(e.phase || 1);
      if (e.boss === 3 && e.phase === 3) audio.music.setMode('heartbeat', 31.5); // last 30% of the 45 s clock restores the full mix
      else audio.music.setMode('normal');
    });
    on('boss:dead', () => sf('explosion', { big: true }));
    on('tele:spawn', e => { const k = e.kind; sf(k === 'damage' ? 'teleWhine' : k === 'knock' ? 'teleDrone' : k === 'gold' ? 'chime' : k === 'soak' ? 'choir' : k === 'lava' ? 'bubble' : 'telePip', { vol: 0.8 }); });
    on('fight:start', e => { audio.music.play('boss' + Math.max(1, Math.min(3, e.boss || 1))); });
    on('fight:end', e => { if (e.win) audio.music.play('victory'); else { sf('wipe'); audio.music.stop(1.2); } });
    on('flow', e => {
      const s = e.state;
      if (s === 'paused' || s === 'defeat' || s === 'results') audio.engine.stop();
      if (s === 'title') audio.music.play('title');
      else if (s === 'warp') audio.music.play('warp');
      else if (s === 'victory' || s === 'finale' || s === 'credits') audio.music.play('victory');
      else if (s === 'defeat') audio.music.stop(1.0);
      if (musicBus && ctx) { const t = ctx.currentTime; if (s === 'paused') musicBus.gain.setTargetAtTime(vol.music * 0.25, t, 0.1); else if (e.prev === 'paused') musicBus.gain.setTargetAtTime(vol.music, t, 0.1); }
    });
    on('sky:lightning', () => sf('thunder', { delay: 0.5, vol: 0.9 }));
  }

  // ------------------------------------------------------------------ module
  const ENGINE_STATES = { fight: 1, countdown: 1, warp: 1, tutorial: 1, finale: 1, credits: 1, intro: 1, victory: 1 };
  function init() {
    const p = G.params || {};
    enabled = !(p.test || p.mute);
    try { if (localStorage.getItem('db_mute') === '1') muted = true; for (const k of ['music', 'sfx', 'master']) { const v = localStorage.getItem('db_vol_' + k); if (v != null && !isNaN(+v)) vol[k] = +v; } } catch (e) { /* ignore */ }
    if (enabled) {
      const un = () => { audio.unlock(); if (unlocked) for (const ev of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(ev, un, true); };
      for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, un, true);
      document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (unlocked) ctx.resume(); });
    }
    bindEvents();
  }
  function update(dt) {
    // beat phase (quarter notes)
    const bpm = M.track?.bpm || audio.bpm || 120;
    let ph;
    if (ctx && M.playing) {
      const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
      ph = (ctx.currentTime - lat - M.t0) * bpm / 60;
    } else ph = (performance.now() / 1000 - M.fakeT0) * bpm / 60;
    audio.beat = ((ph % 1) + 1) % 1; audio.step = Math.floor(ph * 4); audio.bar = Math.floor(ph / 4);
    if (M.mode === 'heartbeat' && M.modeT > 0) { M.modeT -= dt; if (M.modeT <= 0) M.mode = 'normal'; }
    if (!ctx) return;
    // overclock hats layer
    M.layers[3] = !!(G.kart && G.kart.overclockT > 0);
    // engine: auto-drive from G.kart unless engine.update() was called in the last 200 ms
    const st = G.flow?.state, active = !!(ENGINE_STATES[st] && !G.time?.paused && G.kart);
    if (performance.now() - E.lastCall > 200) {
      if (active) {
        const k = G.kart;
        const drift = k.drifting ? 0.4 + 0.2 * (k.driftTier || 0) : 0;
        engineSet(k.speed || 0, k.boosting ? 1 : 0, drift, true);
      } else engineSet(0, 0, 0, false);
    } else if (!active) engineSet(0, 0, 0, false);
  }
  function reset() { M.enrage = false; M.mode = 'normal'; }

  G.register('audio', { init, update, reset });
}
