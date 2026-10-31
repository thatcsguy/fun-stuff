// =====================================================================
// 03_audio.js (REGICIDE): fully synthesised WebAudio. Forked from perihelion's
// engine (step-sequenced music, named SFX one-shots, unlock on first gesture,
// iOS suspend handling). No audio files: everything is oscillators + noise.
//
// API (G.audio):
//   music(key)                 start a track (crossfades); 'victory' / 'defeat' stop the track and play a stinger
//   setIntensity(0-3)          layers 0..n audible (phase escalation); tempo also rises 3.5% per layer
//   sfx(name, {vol, pitch, delay, pos|pan, gap, force, rev, ...})  -> handle {stop()} or null
//   duck(amount 0-1, sec)      dip the music briefly (big hits, stingers)
//   volumes({master, music, sfx})  0-1 (or 0-100); read from localStorage 'rg_settings' at init
//   setMuted(bool), muted, unlocked, state, current, intensity, autoEvents (set false to stop the event hooks),
//   analyser() -> post-limiter peak 0..1 (debug), ctx, tracks
//
// TRACK KEYS (music(key); numbers 0-4 are the five courts; G.bosses[i].music may remap):
//   'menu'      dark, regal, slow; a hint of the Hollow King's motif (E harmonic minor, organ + choir + bell)
//   'practice'  light and sparse (C major celesta)
//    0          Court of Ash / VARRAK:      martial D minor, war drums, low brass saws; level 3 pounds (108 bpm)
//    1          Court of Glass / SERAPHINE: crystalline G lydian, celesta/music-box arps, formant choir, high and
//                                           cold; level 3 adds a fast glassy ostinato (118 bpm)
//    2          Court of Tides / MORVANNA:  swelling A minor waltz (3/4), sub-bass swells, bell tolls, rolling toms
//                                           like waves (100 bpm)
//    3          Court of Storms / THESSALY: driving 16th-note square arpeggios, electric square lead, thunder hits,
//                                           fastest (150 bpm)
//    4          The Throne / HOLLOW KING:   grand and slow (72 bpm), organ + choir + timpani at level 0; layers
//                                           1-3 quote the Ash (brass), Tides (cello), Glass (music box) and Storm
//                                           (square, double time) motifs; level 3 = everything with a relentless drum
//   'victory' / 'defeat'  one-shot stingers (also reachable through sfx)
//
// SFX NAMES (unknown names are a silent no-op; every name has a per-name minimum re-trigger gap):
//   Regicide kit:  rend (quick blade whip, pitch-varied; pass {pitch}), cleave (heavier blade hit), dash (whoosh),
//                  bulwarkUp (shield raise hum), bulwarkHit (absorbed impact: dull bell + shimmer), bulwarkDown,
//                  riposte (reflected crack; scales with {mult} 1-3), rebuke (shockwave cone),
//                  rebukeClear (orbs popping; {count}), mend (warm heal chime), verdictReady (four-note fanfare),
//                  verdictBlast (impale: sub drop + metallic crack + reverb tail), exposed (boss exposed stinger),
//                  stun, lastRites (ominous bell), draftOpen (regal chord), draftPick (confirm), orbPop, soak,
//                  soakFail, lethalWarn (deep klaxon for gold telegraphs), arenaShrink (low groan), playerDeath,
//                  runComplete (long stinger), countdown ({final})
//   Boss / world:  castStart ({interruptible} adds the purple flourish), castDone, warn ({lethal, progress}),
//                  telegraph ({lethal, dur|warn}: lethal = klaxon + rising ticks to the hit), swell / phase,
//                  bossHit, bossDeath, addSpawn, addDeath, crack, thunder ({dur}), rumble ({dur}), lance, meteor,
//                  hurt ({amount}), heal, interrupt, bump, uiClick, uiBack, uiHover, uiConfirm, uiToggle,
//                  victory, defeat, begin
//   Options: {pos: Vector3} pans by screen x; {pan: -1..1}; {vol}; {pitch} (multiplier) or {step} (semitones);
//            {delay} sec; {gap} overrides the min gap; {force} ignores it; {rev} send 0..1.
//
// EVENT HOOKS (G.on; all deduped against direct sfx calls by the per-name gap; disable with autoEvents = false):
//   castStart {name, dur, interruptible}      castEnd {interrupted}      interrupted / interrupt
//   telegraph {lethal, kind, warn}            playerHit {amount, applied, blocked, absorbed}  (hurt + duck when
//   damage was applied; bulwarkHit when absorbed)        playerDeath / playerDied     bossDefeated
//   addDied / addSpawn ({pos})                dash   bulwarkUp   bulwarkDown   riposte {mult}
//   rebuke {interrupted, cleared}             mend   verdictReady   verdict ({impactIn} sec, default 0)
//   exposed   stun   lastRites                phaseTransition (phase swell + duck)   phaseStart {index} (intensity)
//   draftOpen   draftPick   soak {ok}   orbPop {pos}   arenaShrink   countdown {final}   runComplete
//   playerStrike {cleave} (rend / cleave; the player may call sfx('rend') directly instead)
//   fightStart {bossIndex, practice, fromPhase} (starts the court's track)   fightEnd {result}
//   stateChange {from, to}: menu -> music('menu'); draft -> menu music; victory / dead -> stingers; paused -> duck + lowpass
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
    // reverb (shared): long, dark, cathedral-sized
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse(3.8, 2.6);
    revIn = ctx.createGain(); revIn.gain.value = 1; revOut = ctx.createGain(); revOut.gain.value = 0.55;
    const revHP = ctx.createBiquadFilter(); revHP.type = 'highpass'; revHP.frequency.value = 180;
    revIn.connect(revHP); revHP.connect(conv); conv.connect(revOut); revOut.connect(master);
    // echo (dotted eighth-ish), lowpassed feedback
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
  // chain(dest, {pan, rev, dly}) -> GainNode input that routes to dest (+ sends)
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
  // sustain envelope: attack to peak, hold, exponential release
  function hold(p, t, a, peak, dur, rel) {
    p.cancelScheduledValues(t); p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + Math.max(0.002, a));
    p.setValueAtTime(peak, t + Math.max(a, dur));
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(a, dur) + Math.max(0.02, rel));
    return t + Math.max(a, dur) + Math.max(0.02, rel) + 0.1;
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
    if (f * 4.01 < 16000) osc('sine', f * 4.01, t, len * 0.18, dest, 0.07 * v, 0.001);
    if (f * 2 < 16000) osc('triangle', f * 2, t, len * 0.45, dest, 0.06 * v, 0.002);
  }
  function musicBox(t, f, v, dest, len = 0.9) {
    osc('sine', f, t, len, dest, 0.26 * v, 0.002);
    if (f * 3.0 < 16000) osc('sine', f * 3.0, t, len * 0.25, dest, 0.06 * v, 0.001);
    if (f * 5.4 < 16000) osc('sine', f * 5.4, t, len * 0.08, dest, 0.05 * v, 0.001);
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
  function tick(t, v, dest, hi = 1) {   // clockwork escapement tick / rim click
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
  // war brass: three detuned saws through a lowpass that opens on the attack
  function brass(t, f, v, dest, len, o = {}) {
    const cut = o.cut || 900, a = o.attack ?? 0.04;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = o.q ?? 1.1;
    lp.frequency.setValueAtTime(cut * 0.6, t); lp.frequency.linearRampToValueAtTime(cut * (o.open || 1.8), t + Math.max(0.03, Math.min(len * 0.4, 0.3)));
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.5), t + len + 0.1);
    const g = ctx.createGain(); const end = hold(g.gain, t, a, 0.17 * v, len * 0.75, 0.2);
    lp.connect(g); g.connect(dest);
    for (const dt of [-7, 0, 6]) { const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; s.detune.value = dt; const sg = ctx.createGain(); sg.gain.value = 0.34; s.connect(sg); sg.connect(lp); s.start(t); s.stop(end); }
  }
  // big low war drum / taiko
  function warDrum(t, v, dest, f = 140) {
    osc('sine', f, t, 0.55, dest, 0.85 * v, 0.002, { to: f * 0.28, glide: 0.3 });
    noise(t, 0.14, dest, 0.28 * v, { type: 'lowpass', f: 1100, fTo: 180, q: 1 });
    noise(t, 0.025, dest, 0.09 * v, { type: 'highpass', f: 2600, a: 0.001 });
  }
  function tom(t, f, v, dest) { osc('sine', f, t, 0.24, dest, 0.5 * v, 0.002, { to: f * 0.55, glide: 0.2 }); noise(t, 0.05, dest, 0.07 * v, { type: 'bandpass', f: 1400, q: 1, a: 0.001 }); }
  function crash(t, v, dest, len = 1.4) { noise(t, len, dest, 0.16 * v, { type: 'highpass', f: 4200, q: 0.4, a: 0.002 }); noise(t, len * 0.5, dest, 0.08 * v, { type: 'bandpass', f: 7500, q: 2, a: 0.002 }); }
  function timpani(t, f, v, dest) { osc('sine', f, t, 1.1, dest, 0.7 * v, 0.003, { to: f * 0.8, glide: 0.7 }); osc('triangle', f * 1.5, t, 0.3, dest, 0.08 * v, 0.002); noise(t, 0.07, dest, 0.12 * v, { type: 'lowpass', f: 700, a: 0.001 }); }
  function thunderHit(t, v, dest) {
    osc('sine', 68, t, 1.0, dest, 0.8 * v, 0.004, { to: 28, glide: 0.8 });
    noise(t, 1.3, dest, 0.3 * v, { type: 'lowpass', f: 1400, fTo: 110, q: 0.8, glide: 1.1 });
    noise(t, 0.05, dest, 0.15 * v, { type: 'highpass', f: 2000, a: 0.001 });
  }
  // sub swell: slow-attack sine
  function sub(t, f, v, dest, len, attack = 0.5) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); const end = hold(g.gain, t, attack, 0.45 * v, len * 0.7, 0.3);
    o.connect(g); g.connect(dest); o.start(t); o.stop(end);
  }
  // electric square lead: two detuned squares, resonant lowpass with a pluck envelope
  function squareLead(t, f, v, dest, len, o = {}) {
    const cut = o.cut || 3200;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q ?? 4;
    fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(200, cut * 0.22), t + Math.max(0.05, len));
    const g = ctx.createGain(); env(g.gain, t, o.attack ?? 0.004, 0.09 * v, len);
    fl.connect(g); g.connect(dest);
    for (const dt of [-5, 5]) { const s = ctx.createOscillator(); s.type = 'square'; s.frequency.value = f; s.detune.value = dt; const sg = ctx.createGain(); sg.gain.value = 0.5; s.connect(sg); sg.connect(fl); s.start(t); s.stop(t + len + 0.1); }
  }
  // bowed low string: saw + triangle, dark lowpass, slow bow attack, vibrato
  function cello(t, f, v, dest, len, o = {}) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cut || 1300; lp.Q.value = 0.8;
    const g = ctx.createGain(); const end = hold(g.gain, t, o.attack ?? 0.12, 0.14 * v, len * 0.8, 0.3);
    lp.connect(g); g.connect(dest);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; const lg = ctx.createGain(); lg.gain.value = 6; lfo.connect(lg);
    const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = f; lg.connect(s.detune);
    const tr = ctx.createOscillator(); tr.type = 'triangle'; tr.frequency.value = f; tr.detune.value = 4; lg.connect(tr.detune);
    const sg = ctx.createGain(); sg.gain.value = 0.6; const tg = ctx.createGain(); tg.gain.value = 0.5;
    s.connect(sg); sg.connect(lp); tr.connect(tg); tg.connect(lp);
    s.start(t); tr.start(t); lfo.start(t); s.stop(end); tr.stop(end); lfo.stop(end);
  }
  // cathedral organ: stacked ranks (16', 8', 4', 2 2/3', 2') per note, slow swell
  function organ(t, freqs, dur, v, dest, o = {}) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.cut || 2200; lp.Q.value = 0.5;
    const g = ctx.createGain(); const end = hold(g.gain, t, o.attack ?? 0.35, 0.1 * v / Math.sqrt(freqs.length), dur, o.release ?? 1.2);
    lp.connect(g); g.connect(dest);
    const ranks = [[0.5, 'sine', 0.5], [1, 'sawtooth', 0.45], [2, 'square', 0.16], [3, 'sine', 0.12], [4, 'triangle', 0.1]];
    for (const f of freqs) for (const [r, type, amp] of ranks) {
      const s = ctx.createOscillator(); s.type = type; s.frequency.value = f * r; s.detune.value = rnd(-3, 3);
      const sg = ctx.createGain(); sg.gain.value = amp; s.connect(sg); sg.connect(lp); s.start(t); s.stop(end);
    }
  }
  // plucked harp-ish string
  function pluck(t, f, v, dest, len = 0.5) { osc('triangle', f, t, len, dest, 0.2 * v, 0.002); osc('sine', f * 2, t, len * 0.3, dest, 0.05 * v, 0.001); }

  // ------------------------------------------------------------------
  // music: motifs and track definitions
  // ------------------------------------------------------------------
  const SC = {
    lydian: [0, 2, 4, 6, 7, 9, 11], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    harm: [0, 2, 3, 5, 7, 8, 11], phrygdom: [0, 1, 4, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11],
  };
  const deg = (def, d, oct = 0) => { const s = def.scale, n = s.length; const o = Math.floor(d / n); const i = ((d % n) + n) % n; return def.root + s[i] + 12 * (o + oct); };
  const chordTones = (def, rootDeg) => [deg(def, rootDeg), deg(def, rootDeg + 2), deg(def, rootDeg + 4), deg(def, rootDeg + 6)];
  // motif entries: [step, scale degree, lenSteps, vel]. Degrees are relative to the track's root/scale, so the
  // Throne can quote any court's motif in its own key.
  // VARRAK: a martial "da-da-DUM" call, four bars, ends on the dominant
  const M_ASH = [[0, 0, 3], [3, 0, 1], [4, 0, 2], [6, 2, 2], [8, 3, 4], [12, 2, 2], [14, 1, 2],
    [16, 0, 3], [19, 0, 1], [20, 0, 2], [22, 2, 2], [24, 4, 6], [30, 3, 2],
    [32, 5, 3], [35, 5, 1], [36, 5, 2], [38, 4, 2], [40, 3, 4], [44, 2, 2], [46, 1, 2],
    [48, 0, 3], [51, 0, 1], [52, -1, 2], [54, 0, 2], [56, -3, 8]];
  // SERAPHINE: wide, cold leaps that keep landing on the lydian #4
  const M_GLASS = [[0, 7, 2], [2, 11, 2], [4, 10, 4], [8, 9, 2], [10, 7, 2], [12, 8, 4],
    [16, 7, 2], [18, 11, 2], [20, 13, 4], [24, 12, 2], [26, 11, 2], [28, 10, 4],
    [32, 9, 2], [34, 10, 2], [36, 11, 2], [38, 10, 2], [40, 9, 4], [44, 7, 4],
    [48, 8, 2], [50, 7, 2], [52, 6, 2], [54, 7, 2], [56, 4, 8]];
  // MORVANNA: an eight-bar sighing waltz (12 steps per bar)
  const M_TIDE = [[0, 4, 8], [8, 5, 4], [12, 4, 4], [16, 2, 4], [20, 0, 4], [24, 2, 8], [32, 4, 4], [36, 1, 12],
    [48, 4, 8], [56, 6, 4], [60, 7, 4], [64, 6, 4], [68, 4, 4], [72, 5, 8], [80, 2, 4], [84, 0, 12]];
  // THESSALY: hammering repeated notes and a falling run
  const M_STORM = [[0, 0, 1], [1, 0, 1], [2, 7, 2], [4, 6, 1], [5, 5, 1], [6, 4, 2], [8, 0, 1], [9, 0, 1], [10, 7, 2], [12, 9, 1], [13, 8, 1], [14, 7, 2],
    [16, 0, 1], [17, 0, 1], [18, 7, 2], [20, 6, 1], [21, 5, 1], [22, 4, 2], [24, 3, 2], [26, 4, 2], [28, 2, 2], [30, 1, 2],
    [32, 0, 1], [33, 0, 1], [34, 7, 2], [36, 6, 1], [37, 5, 1], [38, 4, 2], [40, 0, 1], [41, 0, 1], [42, 7, 2], [44, 9, 1], [45, 8, 1], [46, 7, 2],
    [48, 10, 2], [50, 9, 2], [52, 8, 2], [54, 7, 2], [56, 6, 2], [58, 5, 2], [60, 4, 2], [62, 3, 2]];
  // THE HOLLOW KING: slow, stepwise, leaning on the leading tone; eight bars
  const M_THRONE = [[0, 0, 6], [6, -1, 2], [8, 0, 4], [12, 2, 4], [16, 3, 8], [24, 2, 4], [28, 1, 4],
    [32, 0, 6], [38, -1, 2], [40, 0, 4], [44, 4, 4], [48, 3, 4], [52, 2, 4], [56, 1, 4], [60, 0, 4],
    [64, 5, 6], [70, 4, 2], [72, 3, 4], [76, 2, 4], [80, 1, 8], [88, -1, 4], [92, 0, 4],
    [96, 0, 6], [102, -1, 2], [104, 0, 4], [108, 2, 4], [112, -3, 8], [120, 0, 8]];
  const M_PRACTICE = [[0, 4, 2], [2, 5, 2], [4, 6, 4], [8, 4, 2], [10, 2, 2], [12, 0, 4], [16, 2, 2], [18, 4, 2], [20, 5, 4], [24, 4, 4], [28, 2, 4]];

  const TRACKS = {
    menu: { style: 'menu', bpm: 60, spb: 4, beats: 4, root: 52, scale: SC.harm, prog: [0, 5, 3, 4], maxLayer: 1, motif: M_THRONE.filter((m) => m[0] < 64), arp: [0, 2, 1, 3] },
    practice: { style: 'light', bpm: 92, spb: 4, beats: 4, root: 60, scale: SC.major, prog: [0, 5, 3, 4], maxLayer: 2, motif: M_PRACTICE, arp: [0, 1, 2, 1, 3, 1, 2, 1, 0, 1, 2, 1, 3, 2, 1, 2] },
    // Court of Ash: D aeolian, i VI iv v
    0: { style: 'ash', bpm: 108, spb: 4, beats: 4, root: 50, scale: SC.aeolian, prog: [0, 5, 3, 4], maxLayer: 3, motif: M_ASH, arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2, 1, 2] },
    // Court of Glass: G lydian, I II I V
    1: { style: 'glass', bpm: 118, spb: 4, beats: 4, root: 67, scale: SC.lydian, prog: [0, 1, 0, 4], maxLayer: 3, motif: M_GLASS, arp: [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 1, 3, 2, 1, 2] },
    // Court of Tides: A aeolian waltz, 3/4, one chord per bar across the eight-bar motif
    2: { style: 'tide', bpm: 100, spb: 4, beats: 3, root: 57, scale: SC.aeolian, prog: [0, 5, 3, 6, 0, 5, 4, 4], maxLayer: 3, motif: M_TIDE, arp: [0, 2, 1, 3, 2, 1, 0, 2, 1, 3, 2, 3] },
    // Court of Storms: E aeolian, i VII VI VII
    3: { style: 'storm', bpm: 150, spb: 4, beats: 4, root: 52, scale: SC.aeolian, prog: [0, 6, 5, 6], maxLayer: 3, motif: M_STORM, arp: [0, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3, 2, 0, 1, 2, 3] },
    // The Throne: E harmonic minor, i VI iv V; quotes courts 0-3 in layers 1-3
    4: { style: 'throne', bpm: 72, spb: 4, beats: 4, root: 52, scale: SC.harm, prog: [0, 5, 3, 4, 0, 5, 1, 4], maxLayer: 3, motif: M_THRONE, arp: [0, 2, 1, 3, 2, 1, 0, 2, 1, 3, 2, 1, 3, 2, 1, 2] },
  };
  // motif entries of another track that land on this step (win = window in source steps, mul = speed multiplier)
  function quoteHits(key, step, win, mul = 1) {
    const def = TRACKS[key]; if (!def) return null;
    const base = (step * mul) % win; let out = null;
    for (const m of def.motif) { if (m[0] >= base && m[0] < base + mul && m[0] < win) (out || (out = [])).push({ m, off: (m[0] - base) / mul }); }
    return out;
  }
  const worldBeat = (t, strength) => {
    if (!(G.world && G.world.beat)) return;
    const ms = Math.max(0, (t - now()) * 1000); setTimeout(() => { try { G.world.beat(strength); } catch (e) { /* */ } }, ms);
  };

  // ------------------------------------------------------------------
  // music: arrangements. Each gets c = {d, s (step in bar), bar, t, L (layer dests), lvl, ch (chord midi), beat,
  // beatIdx, step, sd (step seconds), barLen, hits (motif entries on this step), nf(degree, oct) -> Hz}.
  // Layer i content goes to L[i] (muted until intensity >= i); the lvl checks only save voices.
  // ------------------------------------------------------------------
  const ARR = {
    // ---- Court of Ash: war brass, war drums, D minor ----
    ash(c) {
      const { d, s, bar, t, L, lvl, ch, beat, beatIdx, sd, barLen, hits } = c, barDur = sd * barLen;
      if (s === 0) {
        brass(t, mtof(ch[0] - 12), 0.9, L[0].rev, barDur * 0.95, { cut: 520 + lvl * 160, attack: 0.3, open: 1.6 });
        brass(t + 0.01, mtof(ch[2] - 12), 0.6, L[0].rev, barDur * 0.95, { cut: 480 + lvl * 160, attack: 0.35, open: 1.5 });
        sub(t, mtof(ch[0] - 24), 0.7, L[0].dry, barDur, 0.4);
        warDrum(t, 1.0, L[0].rev, 140);
      }
      if (s === barLen / 2) warDrum(t, 0.55, L[0].rev, 120);
      if (s === barLen - 2 && bar % 2 === 1) warDrum(t, 0.45, L[0].rev, 170);
      if (beat) worldBeat(t, beatIdx === 0 ? 1 : 0.55);
      if (hits) for (const m of hits) {
        const f = mtof(deg(d, m[1], 0)), v = m[3] || 1, len = m[2] * sd * 0.9;
        brass(t, f, 0.55 * v, L[0].rev, len, { cut: 700 + lvl * 150, attack: 0.05, open: 1.8 });
        if (lvl >= 1) brass(t, f, 0.85 * v, L[1].rev, len, { cut: 1100 + lvl * 250, attack: 0.03, open: 2.2 });
        if (lvl >= 3) brass(t, f * 2, 0.4 * v, L[3].rev, len, { cut: 2200, attack: 0.02, open: 2 });
      }
      if (s === 0 || s === 6 || s === 8 || s === 14) bass(t, mtof(ch[0] - 24 + (s === 14 ? 7 : 0)), 0.8, L[1].dry, sd * 2.2);
      if (beat && beatIdx % 2 === 1) snare(t, 0.55, L[1].rev);
      if (s % 4 === 2) tick(t, 0.35, L[1].dry, 0.5);
      if (lvl >= 2) {
        const TOMS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
        if (TOMS[s]) tom(t, s % 8 === 0 ? 95 : 130, 0.7, L[2].dry);
        if (s % 2 === 1) hat(t, 0.35, L[2].dry, 0.03);
        if (s === 4 || s === 10) for (const n of [ch[0], ch[2], ch[0] + 12]) brass(t, mtof(n), 0.45, L[2].rev, sd * 1.6, { cut: 1600, attack: 0.01, open: 2.5 });
      }
      if (lvl >= 3) {
        if (s % 2 === 0) warDrum(t, s % 4 === 0 ? 0.9 : 0.5, L[3].dry, s % 8 === 0 ? 150 : 110);
        if (s === 0) crash(t, 0.7, L[3].rev, 1.2);
        if (beat && beatIdx % 2 === 1) snare(t, 0.9, L[3].rev);
        pulseSynth(t, mtof(ch[0] - 12 + (s % 8 === 6 ? 7 : 0)), 0.8, L[3].dry, sd * 0.9);
      }
    },
    // ---- Court of Glass: celesta, music box, formant choir, G lydian ----
    glass(c) {
      const { d, s, bar, t, L, lvl, ch, beat, beatIdx, sd, barLen, hits } = c, barDur = sd * barLen;
      if (s === 0) {
        choir(t, [mtof(ch[0]), mtof(ch[2]), mtof(ch[1] + 12)], barDur * 0.98, 0.9, L[0].rev, { cut: 2600 + lvl * 300, f1: 900, f2: 1400, attack: 1.0 });
        bell(t, mtof(ch[0] + 12), 0.5, L[0].rev, 4, 3.5, 2.4);
        noise(t, barDur, L[0].rev, 0.04, { type: 'bandpass', f: 2000, fTo: 6000, q: 4, swell: true });
        if (lvl >= 2) choir(t, [mtof(ch[2] + 12), mtof(ch[3] + 12)], barDur * 0.98, 0.45, L[2].rev, { cut: 3200, f1: 1100, f2: 1600, attack: 0.8 });
      }
      if (beat) {
        celesta(t, mtof(ch[d.arp[(beatIdx * 3) % d.arp.length] % 4] + 12 + (beatIdx % 2 ? 12 : 0)), 0.4, L[0].wet, 1.8);
        worldBeat(t, beatIdx === 0 ? 1 : 0.55);
      }
      if (hits) for (const m of hits) {
        const f = mtof(deg(d, m[1], 0)), v = m[3] || 1, len = 0.8 + m[2] * sd * 1.5;
        celesta(t, f, 0.55 * v, L[0].wet, len);
        musicBox(t, f * 2, 0.4 * v, L[1].wet, len * 0.6);
        if (lvl >= 2 && m[2] >= 4) bell(t, f, 0.25, L[2].rev, 2.2, 2.0, 1.4);
      }
      if (s === 0 || s === 8) bass(t, mtof(ch[0] - 24), 0.5, L[1].dry, sd * 6);
      if (s % 4 === 2) hat(t, 0.45, L[1].rev, 0.08);
      if (s % 2 === 0) tick(t, s % 4 === 0 ? 0.5 : 0.3, L[1].rev, 1.3);
      if (lvl >= 2) {
        if (s % 2 === 0) { const ai = d.arp[s % d.arp.length]; celesta(t, mtof(ch[ai % 4] + 24), 0.3, L[2].wet, 0.7); }
        if (beat && beatIdx % 2 === 0) kick(t, 0.5, L[2].dry);
        if (s % 8 === 4) bell(t, mtof(ch[1] + 24), 0.2, L[2].rev, 1.6, 2.0, 1.2);
      }
      if (lvl >= 3) {
        // fast glassy ostinato: 16ths over the chord, two octaves up
        const OST = [0, 2, 1, 3, 0, 2, 3, 1, 0, 2, 1, 3, 2, 3, 1, 2];
        musicBox(t, mtof(ch[OST[s]] + 12 + (s % 8 >= 4 ? 12 : 0)), 0.42 * (s % 2 ? 0.7 : 1), L[3].wet, 0.35);
        hat(t, s % 2 ? 0.2 : 0.4, L[3].dry, 0.025);
        if (beat && beatIdx % 2 === 1) snare(t, 0.7, L[3].rev);
        if (s % 2 === 0) bass(t, mtof(ch[0] - 12), 0.3, L[3].dry, 0.12);
      }
    },
    // ---- Court of Tides: 3/4 waltz, sub swells, bell tolls, rolling toms ----
    tide(c) {
      const { d, s, bar, t, L, lvl, ch, beat, beatIdx, sd, barLen, hits } = c, barDur = sd * barLen;
      if (s === 0) {
        sub(t, mtof(ch[0] - 24), 0.9, L[0].dry, barDur * 1.05, barDur * 0.45);
        choir(t, [mtof(ch[0] - 12), mtof(ch[2] - 12), mtof(ch[1])], barDur, 0.9, L[0].rev, { cut: 900 + lvl * 300, f1: 500, f2: 900, attack: barDur * 0.4 });
        noise(t, barDur, L[0].rev, 0.07, { type: 'lowpass', f: 250, fTo: 1400, q: 1.2, swell: true });
        if (bar % 2 === 0) bell(t, mtof(d.root - 12), 0.8, L[0].rev, 5, 1.41, 3.5);
        worldBeat(t, 1);
      }
      if (s === 6) noise(t, sd * 5, L[0].rev, 0.05, { type: 'lowpass', f: 1400, fTo: 300, q: 1, glide: sd * 5 });
      if (hits) for (const m of hits) {
        const f = mtof(deg(d, m[1], 0)), v = m[3] || 1, len = m[2] * sd * 0.95;
        cello(t, f, 0.8 * v, L[0].rev, len, { cut: 1100 + lvl * 200 });
        celesta(t, f * 2, 0.4 * v, L[1].wet, Math.min(2.2, len));
        if (lvl >= 3) bell(t, f * 2, 0.22, L[3].rev, 2.4, 2.0, 1.4);
      }
      // waltz: oom (beat 0) pah pah (beats 1, 2)
      if (s === 0) bass(t, mtof(ch[0] - 24), 0.9, L[1].dry, sd * 3.2);
      if (s === 4 || s === 8) for (const n of [ch[0] - 12, ch[1] - 12, ch[2] - 12]) pluck(t, mtof(n), 0.45, L[1].rev, sd * 2.5);
      if (s % 4 === 2) hat(t, 0.3, L[1].rev, 0.05);
      if (lvl >= 2) {
        // rolling 16th toms that swell across the bar like a wave
        const u = s / barLen; tom(t, s % 2 ? 125 : 90, 0.25 + 0.6 * u, L[2].dry);
        if (s === 0) kick(t, 0.8, L[2].dry);
        if (s === 0 && bar % 2 === 0) crash(t, 0.4, L[2].rev, 1.8);
        if (s % 2 === 1) hat(t, 0.25, L[2].dry, 0.03);
      }
      if (lvl >= 3) {
        if (s === 0) warDrum(t, 0.9, L[3].rev, 120);
        if (s === 8) snare(t, 0.8, L[3].rev);
        if (s % 2 === 0) { const ai = d.arp[s % d.arp.length]; musicBox(t, mtof(ch[ai % 4] + 24), 0.38, L[3].wet, 0.5); }
        if (s % 2 === 0) bass(t, mtof(ch[0] - 12), 0.3, L[3].dry, 0.14);
        if (s === 0) choir(t, [mtof(ch[0]), mtof(ch[2]), mtof(ch[0] + 12)], barDur, 0.6, L[3].rev, { cut: 2200, attack: barDur * 0.3 });
      }
    },
    // ---- Court of Storms: driving 16ths, square lead, thunder ----
    storm(c) {
      const { d, s, bar, t, L, lvl, ch, beat, beatIdx, sd, barLen, hits } = c, barDur = sd * barLen;
      const arpN = ch[d.arp[s % d.arp.length] % 4] + 12 + (s % 8 >= 4 ? 12 : 0);
      if (s === 0) {
        brass(t, mtof(ch[0] - 12), 1.0, L[0].rev, barDur * 0.98, { cut: 520 + lvl * 120, attack: 0.2, open: 1.6 });
        brass(t, mtof(ch[2] - 12), 0.6, L[0].rev, barDur * 0.98, { cut: 500 + lvl * 120, attack: 0.25, open: 1.5 });
        if (bar % 2 === 0) thunderHit(t, 0.7, L[0].rev);
        if (bar % 2 === 1) noise(t, barDur, L[0].rev, 0.05, { type: 'bandpass', f: 400, fTo: 2500, q: 2, swell: true });
      }
      squareLead(t, mtof(arpN), 0.8 * (s % 2 ? 0.8 : 1), L[0].dry, sd * 0.9, { cut: 1600 + lvl * 300, q: 3 });
      if (beat && beatIdx % 2 === 0) kick(t, 0.6, L[0].dry);
      if (s === 0 || s === 8) bass(t, mtof(ch[0] - 24), 0.7, L[0].dry, sd * 3);
      if (beat) worldBeat(t, beatIdx === 0 ? 1 : 0.5);
      if (hits) for (const m of hits) {
        const f = mtof(deg(d, m[1], 1)), v = m[3] || 1, len = m[2] * sd * 0.95;
        squareLead(t, f, 0.9 * v, L[1].rev, len, { cut: 3600, q: 5 });
        if (lvl >= 3) brass(t, f / 2, 0.5 * v, L[3].rev, len, { cut: 1800, attack: 0.01, open: 2.4 });
      }
      if (s % 2 === 0) pulseSynth(t, mtof(ch[0] - 24 + (s % 8 === 6 ? 12 : 0)), 0.9, L[1].dry, sd * 1.6);
      if (beat && beatIdx % 2 === 0) kick(t, 0.9, L[1].dry);
      if (s === 8) snare(t, 0.7, L[1].rev);
      if (lvl >= 2) {
        if (s % 2 === 1) squareLead(t, mtof(arpN + 12), 0.5, L[2].wet, sd * 0.8, { cut: 4200, q: 3 });
        hat(t, s % 2 ? 0.22 : 0.45, L[2].dry, 0.03);
        if (beat) kick(t, 0.75, L[2].dry);
      }
      if (lvl >= 3) {
        if (s % 2 === 0) kick(t, 0.85, L[3].dry);
        if (s === 4 || s === 12) snare(t, 1, L[3].rev); else if (s % 4 === 3) snare(t, 0.25, L[3].dry);
        if (s === 0) thunderHit(t, 0.8, L[3].rev);
        if (s === 0 && bar % 2 === 0) crash(t, 0.7, L[3].rev, 1.0);
        if (s % 2 === 1) pulseSynth(t, mtof(ch[0] - 12), 0.6, L[3].dry, sd * 0.8);
      }
    },
    // ---- The Throne: organ, choir, timpani; quotes of the four courts ----
    throne(c) {
      const { d, s, bar, t, L, lvl, ch, beat, beatIdx, sd, barLen, hits, step } = c, barDur = sd * barLen;
      if (s === 0) {
        organ(t, [mtof(ch[0] - 24), mtof(ch[0] - 12), mtof(ch[2] - 12), mtof(ch[0]), mtof(ch[1])], barDur, 1.5, L[0].rev, { cut: 1800 + lvl * 300, attack: 0.4 });
        choir(t, [mtof(ch[0]), mtof(ch[2]), mtof(ch[3]), mtof(ch[0] + 12)], barDur, 1.1, L[0].rev, { cut: 1500, attack: 0.9 });
        sub(t, mtof(ch[0] - 24), 0.6, L[0].dry, barDur, 0.3);
        timpani(t, mtof(ch[0] - 24), 0.9, L[0].rev);
        if (bar % 2 === 0) bell(t, mtof(d.root - 24), 0.9, L[0].rev, 6, 1.41, 4);
      }
      if (s === 8) timpani(t, mtof(ch[0] - 24), 0.5, L[0].rev);
      if (beat) worldBeat(t, beatIdx === 0 ? 1 : 0.6);
      if (hits) for (const m of hits) {
        const f = mtof(deg(d, m[1], 0)), v = m[3] || 1, len = m[2] * sd * 0.95;
        organ(t, [f], len, 0.85 * v, L[0].rev, { attack: 0.05, release: 0.4, cut: 2600 });
        bell(t, f * 2, 0.3 * v, L[0].rev, 2.5, 2.0, 1.5);
      }
      // layer 1: Ash brass (bars 0-1 of each 4) and Tides cello (bars 2-3), war drums
      if (lvl >= 1) {
        const w = step % 64, q = w < 32 ? quoteHits(0, w, 32) : (w < 56 ? quoteHits(2, w - 32, 24) : null);
        if (q) for (const { m, off } of q) {
          const f = mtof(deg(d, m[1], 0)), len = m[2] * sd * 0.9;
          if (w < 32) brass(t + off * sd, f, 1.0, L[1].rev, len, { cut: 1100, attack: 0.03, open: 2.2 });
          else cello(t + off * sd, f, 1.1, L[1].rev, len, { cut: 1300 });
        }
        if (s === 0) warDrum(t, 0.8, L[1].rev, 140); if (s === 8) warDrum(t, 0.5, L[1].rev, 120);
        if (s === 12) snare(t, 0.4, L[1].rev);
      }
      // layer 2: Glass music box (bars 2-3 of each 4), rolling toms, high celesta arp
      if (lvl >= 2) {
        const q = step % 64 >= 32 ? quoteHits(1, step - 32, 32) : null;
        if (q) for (const { m, off } of q) musicBox(t + off * sd, mtof(deg(d, m[1], 1)), 0.5, L[2].wet, 0.8 + m[2] * sd);
        if (s % 2 === 0) { const ai = d.arp[s % d.arp.length]; celesta(t, mtof(ch[ai % 4] + 24), 0.26, L[2].wet, 0.8); }
        tom(t, s % 2 ? 125 : 90, 0.2 + 0.5 * (s / barLen), L[2].dry);
        if (s % 2 === 1) hat(t, 0.3, L[2].dry, 0.03);
      }
      // layer 3: Storm 16ths at double speed, relentless drums, everything at once
      if (lvl >= 3) {
        const q = quoteHits(3, step, 64, 2);
        if (q) for (const { m, off } of q) squareLead(t + off * sd, mtof(deg(d, m[1], 1)), 0.7, L[3].dry, m[2] * sd * 0.45, { cut: 3400, q: 4 });
        if (s % 2 === 0) kick(t, s % 4 === 0 ? 0.9 : 0.6, L[3].dry);
        if (s === 4 || s === 12) snare(t, 1, L[3].rev);
        if (s === 0) crash(t, 0.7, L[3].rev, 1.3);
        if (s === 0 || s === 8) warDrum(t, 0.8, L[3].rev, 110);
        pulseSynth(t, mtof(ch[0] - 12 + (s % 4 === 3 ? 7 : 0)), 0.8, L[3].dry, sd * 0.9);
      }
    },
    // ---- menu: dark regal, slow; a hint of the King ----
    menu(c) {
      const { d, s, bar, t, L, ch, beat, beatIdx, sd, barLen, hits } = c, barDur = sd * barLen;
      if (s === 0) {
        organ(t, [mtof(ch[0] - 12), mtof(ch[2] - 12), mtof(ch[0])], barDur, 0.7, L[0].rev, { cut: 1300, attack: 1.2, release: 1.6 });
        choir(t, [mtof(ch[0]), mtof(ch[2]), mtof(ch[3])], barDur, 0.8, L[0].rev, { cut: 1300, attack: 1.4 });
        sub(t, mtof(ch[0] - 24), 0.6, L[0].dry, barDur, 1.2);
        if (bar % 2 === 0) bell(t, mtof(d.root - 12), 0.6, L[0].rev, 6, 1.41, 3.5);
      }
      if (s === 8) timpani(t, mtof(ch[0] - 24), 0.35, L[0].rev);
      if (beat) worldBeat(t, beatIdx === 0 ? 0.8 : 0.4);
      if (hits) for (const m of hits) {
        const f = mtof(deg(d, m[1], 0)), len = m[2] * sd * 0.95;
        cello(t, f, 0.7, L[0].rev, len, { cut: 1000, attack: 0.3 });
        bell(t, f * 2, 0.28, L[0].rev, 3, 2.0, 1.4);
      }
    },
    // ---- practice: light and sparse ----
    light(c) {
      const { d, s, t, L, lvl, ch, beat, beatIdx, sd, barLen, hits } = c, barDur = sd * barLen;
      if (s === 0) {
        choir(t, [mtof(ch[0]), mtof(ch[2]), mtof(ch[1] + 12)], barDur * 0.98, 0.6, L[0].rev, { cut: 2000, f1: 900, f2: 1400, attack: 0.9 });
        bell(t, mtof(ch[0] + 12), 0.4, L[0].rev, 3, 3.5, 2.4);
      }
      if (beat) { celesta(t, mtof(ch[d.arp[(beatIdx * 3) % d.arp.length] % 4] + 12), 0.4, L[0].wet, 1.5); worldBeat(t, beatIdx === 0 ? 0.8 : 0.4); }
      if (hits) for (const m of hits) celesta(t, mtof(deg(d, m[1], 1)), 0.55 * (m[3] || 1), L[0].wet, 0.8 + m[2] * sd * 1.5);
      if (s % 2 === 0) tick(t, s % 4 === 0 ? 0.7 : 0.4, L[1].rev, s % 4 === 0 ? 1 : 0.75);
      if (s === 0 || s === 8) bass(t, mtof(ch[s ? 2 : 0] - 24), 0.7, L[1].dry, sd * 6);
      if (lvl >= 2) {
        const ai = d.arp[s % d.arp.length]; musicBox(t, mtof(ch[ai % 4] + 24), 0.3 * (s % 2 ? 0.75 : 1), L[2].wet, 0.6);
        if (beat && beatIdx % 2 === 0) kick(t, 0.6, L[2].dry);
      }
    },
  };

  class Track {
    constructor(key, def) {
      this.key = key; this.def = def; this.step = 0; this.next = now() + 0.12; this.alive = true;
      const barLen = def.spb * def.beats, last = def.motif.reduce((a, m) => Math.max(a, m[0] + 1), 1);
      this.motifLen = Math.ceil(last / barLen) * barLen; this.motifAt = {};
      for (const m of def.motif) (this.motifAt[m[0]] || (this.motifAt[m[0]] = [])).push(m);
      this.bus = ctx.createGain(); this.bus.gain.setValueAtTime(0.0001, now()); this.bus.gain.exponentialRampToValueAtTime(1, now() + 1.4);
      this.bus.connect(musicBus);
      this.layers = [0, 1, 2, 3].map((i) => { const g = ctx.createGain(); g.gain.value = i <= this.lvl() ? 1 : 0.0001; g.connect(this.bus); return g; });
      this.dest = this.layers.map((g) => ({
        dry: g, rev: chain(g, { rev: 0.55 }), wet: chain(g, { rev: 0.5, dly: 0.45 }),
      }));
      this.arr = ARR[def.style] || ARR.light;
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
      const chordDeg = d.prog[bar % d.prog.length];
      this.arr({
        d, s, bar, t, step, L: this.dest, lvl: this.lvl(), ch: chordTones(d, chordDeg), beat: s % spb === 0, beatIdx: Math.floor(s / spb),
        sd: this.stepDur(), barLen, hits: this.motifAt[step % this.motifLen], nf: (dg, oct) => mtof(deg(d, dg, oct)),
      });
    }
  }

  function pump() { if (track) track.pump(); }

  // ------------------------------------------------------------------
  // SFX
  // ------------------------------------------------------------------
  const panOf = (o) => {
    if (o && typeof o.pan === 'number') return o.pan;
    if (o && o.pos && G.cam && G.cam.toScreen) { try { const s = G.cam.toScreen(o.pos); return G.clamp((s.x / innerWidth) * 2 - 1, -1, 1) * 0.6; } catch (e) { return 0; } }
    return 0;
  };
  const MIN_GAP = {
    rend: 0.05, cleave: 0.08, hurt: 0.12, bossHit: 0.05, warn: 0.04, telegraph: 0.09, orbPop: 0.03, rebukeClear: 0.1, uiHover: 0.04,
    bulwarkHit: 0.08, addDeath: 0.06, addSpawn: 0.06, dash: 0.1, lethalWarn: 0.3, victory: 2, defeat: 2, runComplete: 3, playerDeath: 1,
  };
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  // the lethal klaxon: two detuned saws through an opening lowpass, pulsed by a tremolo
  function klaxon(t, out, v = 1, dur = 0.9, hz = 98) {
    const g = ctx.createGain(); env(g.gain, t, 0.06, 0.11 * v, dur); g.connect(out);
    const trem = ctx.createOscillator(); trem.frequency.value = 7; const tg = ctx.createGain(); tg.gain.value = 0.04 * v; trem.connect(tg); tg.connect(g.gain);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(220, t); f.frequency.linearRampToValueAtTime(950, t + dur * 0.55); f.connect(g);
    for (const k of [1, 1.007, 1.498]) { const a = ctx.createOscillator(); a.type = k > 1.1 ? 'square' : 'sawtooth'; a.frequency.value = hz * k; const ag = ctx.createGain(); ag.gain.value = k > 1.1 ? 0.35 : 0.6; a.connect(ag); ag.connect(f); a.start(t); a.stop(t + dur + 0.2); }
    trem.start(t); trem.stop(t + dur + 0.2);
  }
  const S = {
    // ---- the Regicide kit ----
    rend(t, o, out) {
      const p = o.pitch * rnd(0.92, 1.1);
      noise(t, 0.07, out, 0.16, { type: 'bandpass', f: 3800 * p, fTo: 900 * p, q: 1.4, a: 0.002 });
      osc('sine', 2400 * p, t, 0.05, out, 0.07, 0.001, { to: 1300 * p });
      noise(t + 0.03, 0.03, out, 0.06, { type: 'highpass', f: 6500, a: 0.001 });
    },
    cleave(t, o, out) {
      const p = o.pitch * rnd(0.95, 1.05);
      noise(t, 0.14, out, 0.26, { type: 'bandpass', f: 2600 * p, fTo: 500 * p, q: 1, a: 0.002 });
      osc('sine', 180, t, 0.18, out, 0.4, 0.002, { to: 70 });
      bell(t + 0.02, 1150 * p, 0.3, out, 0.5, 2.76, 1.4);
      noise(t + 0.05, 0.05, out, 0.08, { type: 'highpass', f: 5000, a: 0.001 });
    },
    dash(t, o, out) {
      noise(t, 0.26, out, 0.2, { type: 'bandpass', f: 500, fTo: 2600, q: 1.4, glide: 0.1, a: 0.01 });
      noise(t + 0.08, 0.2, out, 0.1, { type: 'bandpass', f: 2600, fTo: 600, q: 1.4 });
      osc('sine', 300, t, 0.14, out, 0.05, 0.01, { to: 620, glide: 0.1 });
    },
    bulwarkUp(t, o, out) {
      osc('sine', 220, t, 0.6, out, 0.11, 0.03, { to: 262, glide: 0.1 }); osc('sine', 330, t, 0.55, out, 0.09, 0.03, { to: 392, glide: 0.1 });
      osc('triangle', 660, t, 0.4, out, 0.04, 0.02);
      noise(t, 0.3, out, 0.05, { type: 'bandpass', f: 4500, q: 4 }); tick(t, 0.5, out, 0.8);
    },
    bulwarkHit(t, o, out) {
      bell(t, 420 * rnd(0.97, 1.03), 0.9, out, 1.1, 1.41, 4.5);
      noise(t, 0.1, out, 0.2, { type: 'bandpass', f: 2200, q: 1 });
      noise(t + 0.03, 0.5, out, 0.07, { type: 'bandpass', f: 5000, fTo: 9000, q: 3 });
      osc('sine', 120, t, 0.15, out, 0.25, 0.002, { to: 70 });
    },
    bulwarkDown(t, o, out) { osc('sine', 330, t, 0.25, out, 0.08, 0.01, { to: 200 }); osc('sine', 220, t, 0.22, out, 0.07, 0.01, { to: 140 }); noise(t, 0.12, out, 0.05, { type: 'bandpass', f: 3500, fTo: 1200, q: 2 }); },
    riposte(t, o, out) {
      const m = G.clamp(o.mult ?? 1, 1, 3), u = (m - 1) / 2;
      noise(t, 0.18 + u * 0.12, out, 0.3 + u * 0.15, { type: 'bandpass', f: 1200 + u * 800, fTo: 300, q: 0.8 });
      osc('sine', 110 + u * 40, t, 0.4 + u * 0.3, out, 0.5 + u * 0.3, 0.002, { to: 38 });
      osc('sawtooth', 500 + u * 400, t, 0.25, out, 0.08, 0.002, { to: 2600 + u * 1500 });
      const n = 2 + Math.round(u * 3);
      for (let i = 0; i < n; i++) bell(t + 0.03 + i * 0.045, mtof(76 + u * 5 + PENTA[i]), 0.5 + u * 0.2, out, 1.4 + u, 2.0, 2.2);
      if (m >= 2.5) { bell(t + 0.02, mtof(64), 0.6, out, 2.4, 1.41, 3); noise(t + 0.1, 0.8, out, 0.08, { type: 'highpass', f: 5000, q: 0.5 }); }
    },
    rebuke(t, o, out) {
      noise(t, 0.3, out, 0.3, { type: 'lowpass', f: 300, fTo: 3800, q: 1.2, glide: 0.12, a: 0.005 });
      osc('sine', 190, t, 0.35, out, 0.45, 0.003, { to: 55 });
      osc('triangle', 420, t, 0.3, out, 0.14, 0.004, { to: 160 });
      osc('sawtooth', 160, t + 0.02, 0.18, out, 0.06, 0.002, { to: 900, glide: 0.1 });
    },
    rebukeClear(t, o, out) {
      const n = Math.max(1, Math.min(8, o.count ?? 3));
      for (let i = 0; i < n; i++) { const tt = t + i * 0.045 + rnd(0, 0.02); osc('sine', rnd(700, 1100), tt, 0.07, out, 0.14, 0.001, { to: 300 }); celesta(tt, mtof(84 + PENTA[(i * 2) % PENTA.length]), 0.35, out, 0.6); noise(tt, 0.03, out, 0.05, { type: 'highpass', f: 4000, a: 0.001 }); }
    },
    mend(t, o, out) {
      [0, 4, 7, 12].forEach((n, i) => { celesta(t + i * 0.07, mtof(79 + n), 0.5, out, 1.4); osc('sine', mtof(67 + n), t + i * 0.07, 0.5, out, 0.07, 0.02); });
      choir(t, [mtof(55), mtof(62), mtof(67)], 0.5, 0.7, out, { attack: 0.15, release: 1.2, cut: 1600 });
      noise(t + 0.1, 0.6, out, 0.04, { type: 'bandpass', f: 3000, fTo: 7000, q: 3, swell: true });
    },
    verdictReady(t, o, out) {
      [[0, 64], [0.14, 71], [0.28, 76], [0.42, 80]].forEach(([dt, m], i) => {
        brass(t + dt, mtof(m), 0.8 + i * 0.1, out, i === 3 ? 1.1 : 0.22, { cut: 1400, attack: 0.01, open: 2.4 });
        celesta(t + dt, mtof(m + 12), 0.45, out, 1.2);
      });
      bell(t + 0.42, mtof(92), 0.5, out, 2.5, 2.0, 1.8);
      choir(t + 0.42, [mtof(52), mtof(59), mtof(64), mtof(68)], 0.9, 0.9, out, { attack: 0.05, release: 1.6, cut: 2200 });
    },
    verdictBlast(t, o, out) {
      osc('sine', 95, t, 2.0, out, 0.95, 0.003, { to: 24, glide: 1.4 });
      noise(t, 0.25, out, 0.4, { type: 'bandpass', f: 1500, fTo: 250, q: 0.8 });
      noise(t, 2.4, out, 0.3, { type: 'lowpass', f: 4000, fTo: 100, q: 0.6, glide: 2.2 });
      for (let i = 0; i < 6; i++) bell(t + 0.01 + rnd(0, 0.05), rnd(350, 1400), 0.4, out, 1.2 + rnd(0, 1), 1.41, 4.5);
      [52, 59, 64, 68, 71].forEach((m, i) => bell(t + 0.06 + i * 0.02, mtof(m), 0.5, out, 4, 2.0, 2.5));
      choir(t + 0.05, [mtof(40), mtof(52), mtof(59), mtof(64)], 1.4, 1.2, out, { attack: 0.02, release: 2.6, cut: 2400 });
      noise(t + 0.3, 1.8, out, 0.06, { type: 'highpass', f: 6000, q: 0.5 });
    },
    exposed(t, o, out) {
      noise(t, 0.2, out, 0.18, { type: 'highpass', f: 3500, q: 0.5 });
      osc('sawtooth', 500, t, 0.3, out, 0.07, 0.002, { to: 2200, glide: 0.2 });
      bell(t + 0.04, mtof(88), 0.6, out, 1.6, 2.0, 2.2); bell(t + 0.12, mtof(95), 0.5, out, 1.6, 2.0, 2.2);
      for (let i = 0; i < 5; i++) osc('sine', rnd(2500, 6000), t + i * 0.03, rnd(0.15, 0.4), out, 0.05, 0.001);
    },
    stun(t, o, out) {
      const a = ctx.createOscillator(); a.type = 'triangle'; a.frequency.setValueAtTime(900, t); a.frequency.exponentialRampToValueAtTime(320, t + 0.7);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 14; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(a.frequency);
      const g = ctx.createGain(); env(g.gain, t, 0.01, 0.12, 0.7); a.connect(g); g.connect(out); a.start(t); lfo.start(t); a.stop(t + 0.8); lfo.stop(t + 0.8);
      for (let i = 0; i < 4; i++) celesta(t + i * 0.12, mtof(93 - i * 3), 0.3, out, 0.5);
    },
    lastRites(t, o, out) {
      bell(t, mtof(40), 1.0, out, 6, 1.41, 4.5); bell(t + 0.6, mtof(40), 0.8, out, 6, 1.41, 4);
      osc('sine', 41, t, 2.5, out, 0.6, 0.05, { to: 30 });
      choir(t, [mtof(40), mtof(47), mtof(52), mtof(55)], 2.2, 1.1, out, { attack: 0.6, release: 2.5, cut: 900, f1: 400, f2: 800 });
      noise(t, 0.4, out, 0.1, { type: 'lowpass', f: 200, fTo: 1800, q: 1, swell: true });
      celesta(t + 1.0, mtof(88), 0.5, out, 2.5); celesta(t + 1.25, mtof(91), 0.4, out, 2.5);
    },
    draftOpen(t, o, out) {
      organ(t, [mtof(52), mtof(59), mtof(64), mtof(68)], 1.4, 1.2, out, { attack: 0.08, release: 2.2, cut: 2400 });
      bell(t + 0.05, mtof(88), 0.5, out, 3.5, 2.0, 1.8); bell(t + 0.12, mtof(95), 0.35, out, 3, 2.0, 1.6);
      choir(t, [mtof(64), mtof(68), mtof(71), mtof(76)], 1.4, 0.8, out, { attack: 0.5, release: 2, cut: 2400 });
      noise(t, 0.8, out, 0.04, { type: 'bandpass', f: 2500, fTo: 7000, q: 3, swell: true });
    },
    draftPick(t, o, out) { celesta(t, mtof(81), 0.5, out, 0.9); celesta(t + 0.08, mtof(88), 0.5, out, 1.1); brass(t + 0.08, mtof(64), 0.6, out, 0.5, { cut: 1200, attack: 0.01, open: 2 }); bell(t + 0.1, mtof(93), 0.3, out, 2, 2.0, 1.5); },
    orbPop(t, o, out) { osc('sine', 820 * o.pitch, t, 0.07, out, 0.14, 0.001, { to: 280 * o.pitch }); noise(t, 0.035, out, 0.07, { type: 'highpass', f: 3500, a: 0.001 }); },
    soak(t, o, out) { celesta(t, mtof(83), 0.5, out, 1.0); celesta(t + 0.07, mtof(90), 0.5, out, 1.2); noise(t, 0.3, out, 0.05, { type: 'bandpass', f: 3000, fTo: 8000, q: 3 }); osc('sine', mtof(71), t, 0.5, out, 0.06, 0.02); },
    soakFail(t, o, out) { osc('square', 300, t, 0.35, out, 0.06, 0.004, { to: 190 }); osc('square', 212, t, 0.35, out, 0.05, 0.004, { to: 135 }); noise(t, 0.3, out, 0.12, { type: 'lowpass', f: 1200, fTo: 300, q: 1 }); osc('sine', 100, t, 0.3, out, 0.3, 0.003, { to: 45 }); },
    lethalWarn(t, o, out) { klaxon(t, out, o.strength ?? 1, o.dur ?? 0.9); osc('sine', 55, t, 0.8, out, 0.3, 0.05); },
    arenaShrink(t, o, out) {
      const d = o.dur ?? 1.8;
      const a = ctx.createOscillator(); a.type = 'sawtooth'; a.frequency.setValueAtTime(62, t); a.frequency.exponentialRampToValueAtTime(44, t + d);
      const b = ctx.createOscillator(); b.type = 'sawtooth'; b.frequency.setValueAtTime(62.7, t); b.frequency.exponentialRampToValueAtTime(44.5, t + d);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(160, t + d); f.Q.value = 2;
      const g = ctx.createGain(); hold(g.gain, t, 0.3, 0.22, d * 0.7, d * 0.3);
      a.connect(f); b.connect(f); f.connect(g); g.connect(out); a.start(t); b.start(t); a.stop(t + d + 0.5); b.stop(t + d + 0.5);
      noise(t, d, out, 0.22, { type: 'lowpass', f: 180, q: 1, a: 0.3 });
      for (let i = 0; i < 5; i++) noise(t + rnd(0.1, d), 0.08, out, 0.12, { type: 'bandpass', f: rnd(300, 900), q: 3 });
    },
    playerDeath(t, o, out) {
      osc('sine', 90, t, 1.8, out, 0.8, 0.004, { to: 22, glide: 1.2 });
      noise(t, 0.3, out, 0.3, { type: 'lowpass', f: 1600, fTo: 200, q: 1 });
      noise(t + 0.1, 1.6, out, 0.15, { type: 'lowpass', f: 600, fTo: 80, q: 0.8, glide: 1.4 });
      [71, 66, 62, 57].forEach((m, i) => bell(t + 0.15 + i * 0.22, mtof(m), 0.55, out, 2.6, 1.41, 2.2));
      choir(t + 0.2, [mtof(38), mtof(45), mtof(50)], 1.2, 0.9, out, { attack: 0.5, release: 2, cut: 700, f1: 400, f2: 800 });
    },
    runComplete(t, o, out) {
      const seq = [64, 68, 71, 76, 80, 83, 88];
      seq.forEach((m, i) => celesta(t + i * 0.1, mtof(m), 0.8, out, 2.2));
      [[0.7, 52], [0.7, 59], [0.7, 64], [1.5, 57], [1.5, 61], [1.5, 64], [2.5, 52], [2.5, 59], [2.5, 64], [2.5, 68]].forEach(([dt, m]) => brass(t + dt, mtof(m), 0.7, out, 0.7, { cut: 1300, attack: 0.02, open: 2.2 }));
      organ(t + 2.5, [mtof(40), mtof(52), mtof(59), mtof(64), mtof(68)], 2.6, 1.3, out, { attack: 0.1, release: 3.5, cut: 2600 });
      [88, 95, 100].forEach((m, i) => bell(t + 2.55 + i * 0.04, mtof(m), 0.7, out, 5, 2.0, 2));
      choir(t + 0.7, [mtof(52), mtof(59), mtof(64), mtof(68), mtof(71)], 4.2, 1.2, out, { attack: 0.4, release: 3, cut: 2800 });
      timpani(t + 0.7, mtof(40), 0.9, out); timpani(t + 1.5, mtof(45), 0.8, out); timpani(t + 2.5, mtof(40), 1.0, out);
      crash(t + 2.5, 0.8, out, 2.5);
      bell(t + 2.5, mtof(40), 0.9, out, 6, 1.41, 3);
    },
    countdown(t, o, out) { celesta(t, mtof(o.final ? 88 : 81), 0.6, out, 0.8); if (o.final) brass(t, mtof(64), 0.6, out, 0.5, { cut: 1300, attack: 0.01, open: 2 }); },
    // ---- boss / world cues ----
    castStart(t, o, out) {
      bell(t, mtof(45), 0.8, out, 3.5, 1.41, 3);
      if (o.interruptible) { celesta(t + 0.1, mtof(93), 0.6, out, 1.2); celesta(t + 0.22, mtof(98), 0.5, out, 1.2); celesta(t + 0.34, mtof(105), 0.4, out, 1.4); noise(t + 0.1, 0.5, out, 0.05, { type: 'bandpass', f: 3000, fTo: 9000, q: 3, swell: true }); }
    },
    castDone(t, o, out) { bell(t, mtof(40), 0.9, out, 3, 1.41, 5); noise(t, 0.6, out, 0.15, { type: 'lowpass', f: 900, q: 1 }); },
    warn(t, o, out) {
      const p = G.clamp(o.progress ?? 0.5);
      if (o.lethal) { osc('square', 110 + p * 60, t, 0.16, out, 0.05, 0.004); osc('sine', 660 + p * 660, t, 0.08, out, 0.08, 0.002); }
      else osc('sine', 700 + p * 900, t, 0.07, out, 0.1, 0.002);
    },
    telegraph(t, o, out) {
      const lethal = !!o.lethal, dur = o.dur ?? o.warn ?? (lethal ? 3 : 1.4);
      if (lethal) klaxon(t, out, 0.9, Math.min(1.2, Math.max(0.6, dur * 0.35)));
      else { osc('sine', 880, t, 0.09, out, 0.08, 0.002); osc('sine', 1175, t + 0.08, 0.12, out, 0.08, 0.002); }
      if (o.ticks === false) return;
      const n = Math.max(3, Math.min(12, Math.round(dur * (lethal ? 3 : 2.5))));
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
      timpani(t + d, mtof(38), 0.9, out);
    },
    bossHit(t, o, out) { osc('sine', 160, t, 0.1, out, 0.2, 0.002, { to: 90 }); },
    bossDeath(t, o, out) {
      osc('sine', 60, t, 3, out, 0.9, 0.01, { to: 24 });
      noise(t, 3.5, out, 0.35, { type: 'lowpass', f: 3000, fTo: 100, q: 0.7, glide: 3.2 });
      for (let i = 0; i < 10; i++) bell(t + 0.12 * i, mtof(93 - PENTA[i % PENTA.length]), 0.5, out, 3.5, 2.0, 2);
      choir(t + 0.3, [mtof(45), mtof(52), mtof(57), mtof(61), mtof(64)], 3, 1.2, out, { attack: 1.2, release: 3, cut: 2600 });
      timpani(t + 0.05, mtof(38), 1.0, out);
    },
    addSpawn(t, o, out) { celesta(t, mtof(79 + Math.floor(rnd(0, 3)) * 2), 0.35, out, 0.8); noise(t, 0.15, out, 0.05, { type: 'bandpass', f: 1500, fTo: 4000, q: 2 }); },
    addDeath(t, o, out) { noise(t, 0.12, out, 0.12, { type: 'bandpass', f: 3000, q: 1 }); celesta(t, mtof(84), 0.4, out, 0.6); celesta(t + 0.05, mtof(79), 0.3, out, 0.6); osc('sine', 140, t, 0.12, out, 0.15, 0.002, { to: 70 }); },
    crack(t, o, out) { noise(t, 0.15, out, 0.3, { type: 'bandpass', f: 1200, q: 0.8 }); osc('sine', 90, t, 0.4, out, 0.45, 0.002, { to: 40 }); for (let i = 0; i < 4; i++) bell(t + rnd(0, 0.08), rnd(300, 700), 0.3, out, 0.8, 1.41, 4); },
    thunder(t, o, out) { const d = o.dur ?? 2.4; noise(t, 0.08, out, 0.25 * (o.vol ?? 1), { type: 'highpass', f: 1500 }); noise(t + 0.05, d, out, 0.35 * (o.vol ?? 1), { type: 'lowpass', f: 600, fTo: 80, q: 0.8, glide: d }); osc('sine', 70, t + 0.03, 0.8, out, 0.4, 0.004, { to: 30 }); },
    rumble(t, o, out) { noise(t, o.dur ?? 1.5, out, 0.25, { type: 'lowpass', f: 160, q: 1, a: 0.2 }); },
    lance(t, o, out) { noise(t, 0.16, out, 0.08, { type: 'bandpass', f: 3000, fTo: 8000, q: 6 }); },
    meteor(t, o, out) { osc('sine', 3200, t, 0.6, out, 0.012, 0.15, { to: 1400 }); },
    hurt(t, o, out) {
      const big = (o.amount || 20) >= 35;
      osc('sine', 120, t, 0.3, out, 0.6, 0.002, { to: 45 });
      osc('sawtooth', 220, t, 0.25, out, 0.08, 0.002, { to: 140 }); osc('sawtooth', 233, t, 0.25, out, 0.08, 0.002, { to: 148 });
      noise(t, big ? 0.35 : 0.2, out, 0.25, { type: 'lowpass', f: 1800, fTo: 300, q: 1 });
    },
    heal(t, o, out) { for (let i = 0; i < 3; i++) osc('sine', mtof(84 + i * 4), t + i * 0.05, 0.4, out, 0.08, 0.01); },
    interrupt(t, o, out) {
      noise(t, 0.35, out, 0.3, { type: 'highpass', f: 3000, q: 0.5 });
      for (let i = 0; i < 9; i++) osc('sine', rnd(2000, 6500), t + i * 0.018 + rnd(0, 0.02), rnd(0.15, 0.5), out, 0.07, 0.001);
      osc('triangle', 900, t, 0.6, out, 0.18, 0.002, { to: 180 });
      bell(t + 0.08, mtof(86), 0.7, out, 2.2, 2.0, 2.5);
    },
    bump(t, o, out) { osc('sine', 150, t, 0.12, out, 0.25, 0.003, { to: 90 }); },
    uiHover(t, o, out) { osc('sine', 2200, t, 0.03, out, 0.03, 0.001); },
    uiClick(t, o, out) { celesta(t, mtof(88), 0.35, out, 0.5); },
    uiConfirm(t, o, out) { celesta(t, mtof(81), 0.45, out, 0.8); celesta(t + 0.07, mtof(88), 0.45, out, 0.9); },
    uiBack(t, o, out) { celesta(t, mtof(84), 0.35, out, 0.5); celesta(t + 0.06, mtof(79), 0.3, out, 0.6); },
    uiToggle(t, o, out) { osc('sine', o.on === false ? 700 : 1000, t, 0.05, out, 0.06, 0.001); },
    begin(t, o, out) { bell(t, mtof(69), 0.8, out, 3, 2.0, 2); bell(t + 0.02, mtof(76), 0.6, out, 3, 2.0, 2); choir(t, [mtof(57), mtof(64), mtof(69)], 0.8, 0.8, out, { attack: 0.05, release: 1.6, cut: 2200 }); },
    victory(t, o, out) {
      const seq = [64, 68, 71, 76, 80, 83];
      seq.forEach((m, i) => celesta(t + i * 0.11, mtof(m), 0.8, out, 2));
      [52, 59, 64, 68].forEach((m) => brass(t + 0.6, mtof(m), 0.7, out, 2.2, { cut: 900, attack: 0.15, open: 2.6 }));
      [76, 83, 88].forEach((m, i) => bell(t + 0.66 + i * 0.03, mtof(m), 0.7, out, 4.5, 2.0, 2));
      choir(t + 0.6, [mtof(52), mtof(56), mtof(59), mtof(64)], 2.2, 1.2, out, { attack: 0.3, release: 2.5, cut: 2800 });
      timpani(t + 0.6, mtof(40), 0.8, out);
    },
    defeat(t, o, out) {
      [76, 72, 69, 64, 60].forEach((m, i) => bell(t + i * 0.32, mtof(m), 0.7, out, 3.2, 1.41, 2.2));
      choir(t, [mtof(40), mtof(47), mtof(52), mtof(55)], 2.4, 1, out, { attack: 0.8, release: 2.4, cut: 900 });
      osc('sine', 55, t, 2.5, out, 0.4, 0.4, { to: 36 });
    },
  };
  S.phase = S.swell; S.transition = S.swell; S.complete = S.castDone;
  S.click = S.uiClick; S.confirm = S.uiConfirm; S.back = S.uiBack; S.hover = S.uiHover;
  S.hit = S.hurt; S.damage = S.hurt; S.strike = S.rend; S.whoosh = S.dash; S.shatter = S.interrupt; S.block = S.bulwarkHit;
  const VOL = { rend: 0.6, cleave: 0.7, uiHover: 0.6, meteor: 0.5, orbPop: 0.7, dash: 0.8, bossHit: 0.8 };
  let activeVoices = 0;

  function sfx(name, opts) {
    if (!ctx || !unlocked || muted || ctx.state !== 'running') return null;
    const fn = S[name]; if (!fn) return null;
    const o = opts || {};
    const tnow = now();
    const gap = o.gap ?? MIN_GAP[name] ?? 0.05;
    if (recent[name] != null && tnow - recent[name] < gap && !o.force) return null;
    recent[name] = tnow;
    if (activeVoices > 48 && !o.force && (name === 'rend' || name === 'bossHit' || name === 'warn' || name === 'orbPop' || name === 'uiHover')) return null;
    o.pitch = o.pitch ?? (o.step != null ? Math.pow(2, o.step / 12) : 1);
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
  // resolve music('menu' | 'practice' | 0-4 | '0'-'4') to a track key; null when unknown
  const trackKey = (which) => {
    if (which == null) return null;
    if (typeof which === 'number') return isFinite(which) ? String(Math.max(0, Math.min(4, Math.round(which)))) : null;
    return TRACKS[which] ? which : null;
  };

  const A = G.audio = {
    unlocked: false, state: 'none', tracks: TRACKS, sfxNames: Object.keys(S),
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
      // settings stored by the UI: rg_settings = {master, music, sfx} (0-1 or 0-100)
      try { const s = JSON.parse(localStorage.getItem('rg_settings') || 'null'); if (s) A.volumes({ master: s.master ?? s.masterVolume, music: s.music ?? s.musicVolume, sfx: s.sfx ?? s.sfxVolume }); } catch (e) { /* */ }
      hookEvents();
    },
    sfx,
    music(which) {
      if (which === 'victory' || which === 'defeat') { wantTrack = null; if (track) track.stop(0.8); track = null; sfx(which, { gap: 2 }); return; }
      wantTrack = trackKey(which);
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
    stopCharge() { /* kept for API compatibility with perihelion callers; the Regicide kit has no held charge */ },
    autoEvents: true,
    // debug: post-limiter peak 0..1
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
    // intensity per phase comes from the boss definition (G.combat.musicIntensity: the last phase is always layer 3)
    const combatDef = () => { const c = G.combat; return c && (c.def || (c.boss && c.boss.def) || (c.current && c.current.def)); };
    const phaseLayer = (i) => { try { const c = G.combat, def = combatDef(); if (c && c.musicIntensity && def) return c.musicIntensity(def, i); } catch (e) { /* */ } return Math.min(3, i | 0); };
    // fight flow
    on('fightStart', (d) => {
      A.setIntensity(phaseLayer(d.fromPhase | 0));
      const def = combatDef();
      if (d.practice || d.bossIndex === 'practice') A.music('practice');
      else A.music(def && def.music != null ? def.music : (typeof d.bossIndex === 'number' ? d.bossIndex : null));
    });
    on('fightEnd', (d) => { if (d.result === 'victory') A.music('victory'); else if (d.result === 'defeat') A.music('defeat'); });
    on('phaseStart', (d) => { if (typeof d.index === 'number') A.setIntensity(phaseLayer(d.index)); });
    on('phaseTransition', () => { sfx('phase', EV); A.duck(0.6, 2.5); });
    on('bossDefeated', () => { sfx('bossDeath', EV); A.duck(0.8, 3); });
    on('runComplete', () => { sfx('runComplete', EV); A.duck(0.9, 5); });
    // boss cues
    on('castStart', (d) => sfx('castStart', { gap: 0.15, interruptible: d.interruptible }));
    on('castEnd', (d) => { if (!d.interrupted && !d.aborted) sfx('castDone', EV); });
    on('interrupted', () => sfx('interrupt', EV));
    on('interrupt', () => sfx('interrupt', EV));
    on('telegraph', (d) => sfx('telegraph', { gap: 0.12, lethal: d.lethal || d.unblockable, dur: d.dur ?? d.warn, ticks: d.lethal || d.unblockable ? true : false }));
    on('exposed', () => sfx('exposed', EV));
    on('stun', () => sfx('stun', EV));
    on('addDied', (d) => sfx('addDeath', { gap: 0.06, pos: d.pos }));
    on('addSpawn', (d) => sfx('addSpawn', { gap: 0.06, pos: d.pos }));
    on('orbPop', (d) => sfx('orbPop', { gap: 0.03, pos: d.pos }));
    on('arenaShrink', (d) => sfx('arenaShrink', { gap: 0.5, dur: d.dur }));
    on('soak', (d) => sfx(d.ok === false ? 'soakFail' : 'soak', EV));
    on('countdown', (d) => sfx('countdown', { gap: 0.2, final: d.final }));
    // the player
    on('playerHit', (d) => {
      const absorbed = +d.absorbed || 0;
      const applied = typeof d.applied === 'number' ? d.applied : (d.applied === false || d.blocked ? 0 : (+d.amount || 0));
      if (absorbed > 0 || (d.blocked && applied <= 0)) sfx('bulwarkHit', { gap: 0.08, amount: absorbed });
      if (applied > 0) { sfx('hurt', { gap: 0.15, amount: applied }); A.duck(0.35, 0.5); }
    });
    on('playerDeath', () => { sfx('playerDeath', EV); A.duck(0.8, 2); });
    on('playerDied', () => { sfx('playerDeath', EV); A.duck(0.8, 2); });
    on('playerStrike', (d) => sfx(d.cleave ? 'cleave' : 'rend', { gap: d.cleave ? 0.08 : 0.05, pos: d.pos }));
    on('dash', () => sfx('dash', { gap: 0.1 }));
    on('bulwarkUp', () => sfx('bulwarkUp', EV));
    on('bulwarkDown', () => sfx('bulwarkDown', EV));
    on('riposte', (d) => sfx('riposte', { gap: 0.15, mult: d.mult }));
    on('rebuke', (d) => { sfx('rebuke', EV); if (d.cleared > 0) sfx('rebukeClear', { gap: 0.1, delay: 0.06, count: d.cleared }); });
    on('mend', () => sfx('mend', EV));
    on('verdictReady', () => sfx('verdictReady', { gap: 0.5 }));
    on('verdict', (d) => { sfx('verdictBlast', { gap: 0.5, delay: d.impactIn || 0 }); A.duck(0.6, 1.5); });
    on('lastRites', () => { sfx('lastRites', { gap: 1 }); A.duck(0.7, 2.5); });
    // run screens
    on('draftOpen', () => sfx('draftOpen', { gap: 0.5 }));
    on('draftPick', () => sfx('draftPick', EV));
    on('stateChange', (d) => {
      if (d.to === 'menu') { A.setIntensity(0); A.music('menu'); }
      else if (d.to === 'draft') { A.setIntensity(0); A.music('menu'); }
      else if (d.to === 'victory') A.music('victory');
      else if (d.to === 'dead') { if (recent.playerDeath != null && now() - recent.playerDeath < 4) { wantTrack = null; if (track) track.stop(0.8); track = null; } else A.music('defeat'); }
      const p = d.to === 'paused';
      if (p !== pausedDuck && ctx && musicFilter) {
        pausedDuck = p; const t = now();
        musicFilter.frequency.setTargetAtTime(p ? 700 : 18000, t, 0.15);
        musicBus.gain.setTargetAtTime(muted ? 0 : vol.music * (p ? 0.5 : 1), t, 0.15);
      }
    });
  }
})();
