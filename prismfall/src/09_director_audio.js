   14  DIRECTOR — cinematics, camera rig, shake
   ===================================================================== */
function playCine(c) {
  c.ev = (c.ev || []).slice().sort((a, b) => a[0] - b[0]);
  director.cine = c; director.ct = 0; director.evI = 0; director.camOverride = true;
  director.camPos.copy(cam.pos); director.camLook.copy(cam.look); director.fov = cam.fov;
  if (game.state !== 'intro') { game.prevState = game.state; game.state = 'cinematic'; }
  pjClearAll(true); hzBeamsClear(); dmgNumsClear();
  if (lattice.active) { lattice.t = Math.max(lattice.t, lattice.dur - 0.3); }
  c.start && c.start();
}
function endCine() {
  const c = director.cine; if (!c) return;
  while (director.evI < c.ev.length) c.ev[director.evI++][1]();
  director.cine = null; director.camOverride = false; director.timeScale = 1;
  player.invuln = Math.max(player.invuln, 0.6);
  if (game.state === 'cinematic' || game.state === 'intro') game.state = 'fight';
  c.end && c.end();
}
function skipCine(force = false) {
  const c = director.cine; if (!c) return;
  if (force) { director.ct = c.dur; return; }
  if (c.skippable != null && director.ct >= c.skippable) director.ct = Math.max(director.ct, c.skipTo != null ? c.skipTo : c.dur);
}
function camKeys(t, keys) {
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const k = b[0] > a[0] ? smooth((t - a[0]) / (b[0] - a[0])) : 1;
  director.camPos.set(lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k));
  director.camLook.set(lerp(a[4], b[4], k), lerp(a[5], b[5], k), lerp(a[6], b[6], k));
  director.fov = lerp(a[7], b[7], k);
}
function updateDirector(realDt) {
  const c = director.cine;
  if (c) {
    director.ct += realDt;
    while (director.evI < c.ev.length && c.ev[director.evI][0] <= director.ct) c.ev[director.evI++][1]();
    if (c.update) c.update(director.ct, realDt);
    if (director.ct >= c.dur) endCine();
  }
  director.trauma = Math.max(0, director.trauma - 1.6 * realDt);
  director.bloomBoost *= Math.exp(-4 * realDt);
  director.aberr *= Math.exp(-5 * realDt);
  if (director.hitstopT > 0) director.hitstopT -= realDt;
  if (director.shockT >= 0) { director.shockT += realDt; const k = director.shockT / 0.6; if (k >= 1) { director.shockT = -1; LU.uShockStrength.value = 0; } else { LU.uShockCenter.value.set(director.shockX, director.shockY); LU.uShockRadius.value = k * 1.2; LU.uShockStrength.value = director.shockStr * (1 - k); } }
}
const _shk = new THREE.Vector3();
let titleOrbit = 0;
// ---- combat framing: keep the boss's top below the HUD band, and keep the player + "go here" objectives
// (soak, safe pockets, the corona lane) out from under the top HUD and the ability-button cluster.
const camSafe = { clusterW: 240, clusterH: 240, sab: 0 };
const FP_N = 32, fpX = new Float32Array(FP_N), fpY = new Float32Array(FP_N), fpZ = new Float32Array(FP_N), fpK = new Uint8Array(FP_N);
const fit = { zoom: 0, sx: 0, sz: 0 };
let fpN = 0;
function fpAdd(x, y, z, k) { if (fpN < FP_N) { fpX[fpN] = x; fpY[fpN] = y; fpZ[fpN] = z; fpK[fpN] = k; fpN++; } }
function collectFramePts() {
  fpN = 0; const p = player;
  if (bossTarget.alive && bossRT.def && bossRT.def.camTop) fpAdd(bossTarget.x, bossRT.def.camTop(), bossTarget.z, 0);
  if (p.alive) { fpAdd(p.x, 2.6, p.z, 1); fpAdd(p.x, 0, p.z, 1); }
  let nObj = 0;
  for (let i = 0; i < TELE_N && nObj < 6; i++) {
    const o = tele[i]; if (!o.active || o.resolved) continue;
    if (o.shape === 4 || o.shape === 5) { nObj++; fpAdd(o.x, 0, o.z, 2); fpAdd(o.x, 0, o.z - o.r, 3); fpAdd(o.x, 0, o.z + o.r, 3); fpAdd(o.x - o.r, 0, o.z, 3); fpAdd(o.x + o.r, 0, o.z, 3); }
    else if (o.tag === 7) { nObj++; const rr = clamp(Math.hypot(p.x, p.z), 5, 11); fpAdd(Math.cos(o.ang) * rr, 0, Math.sin(o.ang) * rr, 2); }
  }
}
const oArr = [0, 1, 2].map((i) => ({ el: document.getElementById('oarr' + i), on: false }));
function updateFraming(realDt, active) {
  let shown = 0;
  if (active) {
    collectFramePts();
    const topL = 1 - 2 * (hudTopPx + 26) / VH, sideL = 1 - 2 * 14 / VW;
    const botBtn = -1 + 2 * (camSafe.clusterH + 10) / VH, botDef = -1 + 2 * (22 + camSafe.sab) / VH, btnX = 1 - 2 * (camSafe.clusterW + 8) / VW;
    let oT = -9, oB = -9, oL = -9, oR = -9;
    for (let i = 0; i < fpN; i++) {
      _v1.set(fpX[i], fpY[i], fpZ[i]).project(camera); if (_v1.z > 1) continue;
      const k = fpK[i], x = _v1.x, y = _v1.y;
      oT = Math.max(oT, y - topL);
      if (k !== 0) { oB = Math.max(oB, (x > btnX ? botBtn : botDef) - y); oL = Math.max(oL, -sideL - x); oR = Math.max(oR, x - sideL); }
      if (k === 2 && shown < 3 && (x < -0.97 || x > 0.97 || y < -0.97 || y > topL + 0.02)) {
        // off-screen objective: pin an arrow to the screen edge
        const a = Math.atan2(y, x); const ex = clamp(x, -0.9, 0.9), ey = clamp(y, -0.88, topL - 0.06);
        const A = oArr[shown++]; const px = (ex * 0.5 + 0.5) * VW, py = (1 - (ey * 0.5 + 0.5)) * VH;
        A.el.style.transform = `translate(${px.toFixed(0)}px,${py.toFixed(0)}px) rotate(${(Math.PI / 2 - a).toFixed(2)}rad)`;
        if (!A.on) { A.on = true; A.el.classList.add('on'); }
      }
    }
    const need = Math.max(oT, oB, oL, oR);
    if (need > 0) {
      if ((oT > 0 && oB > -0.1) || (oB > 0 && oT > -0.1) || (oL > 0 && oR > -0.1) || (oR > 0 && oL > -0.1) || need > 0.3) fit.zoom = Math.min(0.5, fit.zoom + need * 1.8 * realDt);
      const g = 22 * realDt;
      if (oT > 0) fit.sz -= oT * g; if (oB > 0) fit.sz += oB * g;
      if (oR > 0) fit.sx += oR * g; if (oL > 0) fit.sx -= oL * g;
      const l = Math.hypot(fit.sx, fit.sz); if (l > 5) { fit.sx *= 5 / l; fit.sz *= 5 / l; }
    } else if (need < -0.1) {
      fit.zoom = Math.max(0, fit.zoom - 0.12 * realDt); fit.sx = damp(fit.sx, 0, 0.6, realDt); fit.sz = damp(fit.sz, 0, 0.6, realDt);
    }
  } else { fit.zoom = damp(fit.zoom, 0, 2, realDt); fit.sx = damp(fit.sx, 0, 2, realDt); fit.sz = damp(fit.sz, 0, 2, realDt); }
  for (let i = shown; i < 3; i++) { const A = oArr[i]; if (A.on) { A.on = false; A.el.classList.remove('on'); } }
}
function updateCamera(realDt) {
  cam.baseFov = damp(cam.baseFov, cam.baseFovTarget, 3.3, realDt);
  if (game.state !== 'paused') updateFraming(realDt, !cam.lock && !director.camOverride && game.state === 'fight' && !!bossRT.def);
  const portraitK = ASPECT < 1 ? clamp((1 - ASPECT) / 0.55, 0, 1) : 0;
  cam.offScaleTarget = 1 + portraitK * 0.6;
  cam.offScale = damp(cam.offScale, cam.offScaleTarget, 3.3, realDt);
  let fov = cam.baseFov;
  if (cam.lock) { cam.pos.copy(cam.lock.pos); cam.look.copy(cam.lock.look); }
  else if (director.camOverride) { cam.pos.copy(director.camPos); cam.look.copy(director.camLook); fov = director.fov || fov; if (ASPECT < 1) fov = Math.min(80, fov * (1 + portraitK * 0.3)); }
  else if (game.state === 'title' || game.state === 'victory' || (game.state === 'paused' && game.prevState === 'title')) {
    titleOrbit += realDt * 0.05;
    const r = 24 * (1 + portraitK * 0.4);
    cam.pos.set(Math.cos(titleOrbit) * r, 7.5 + Math.sin(titleOrbit * 0.7) * 1.5, Math.sin(titleOrbit) * r); cam.look.set(0, 1.5, 0);
    fov = 50 + portraitK * 14;
  } else {
    const p = player;
    cam.lookAhead.x = damp(cam.lookAhead.x, p.vx * 0.35, 3, realDt); cam.lookAhead.z = damp(cam.lookAhead.z, p.vz * 0.35, 3, realDt);
    let bx = 0, bz = 0; if (bossTarget.alive) { const cb = (bossRT.def && bossRT.def.camBias) || 0.18, cm = cb > 0.18 ? 4 : 3; bx = (bossTarget.x - p.x) * cb; bz = (bossTarget.z - p.z) * cb; const l = Math.hypot(bx, bz); if (l > cm) { bx *= cm / l; bz *= cm / l; } }
    cam.target.set(p.x + cam.lookAhead.x + bx, 0, p.z + cam.lookAhead.z + bz);
    // in portrait pull the target toward arena center a bit so more of the arena is visible
    cam.target.x *= 1 - portraitK * 0.25;
    cam.target.x += fit.sx; cam.target.z += fit.sz;
    const s = cam.offScale * (1 + fit.zoom);
    _v1.set(cam.target.x, 17 * s, cam.target.z + 12.5 * s);
    const lam = game.state === 'fight' ? 6 : 3;
    cam.pos.x = damp(cam.pos.x, _v1.x, lam, realDt); cam.pos.y = damp(cam.pos.y, _v1.y, lam, realDt); cam.pos.z = damp(cam.pos.z, _v1.z, lam, realDt);
    cam.look.x = damp(cam.look.x, cam.target.x, lam, realDt); cam.look.y = damp(cam.look.y, cam.target.y, lam, realDt); cam.look.z = damp(cam.look.z, cam.target.z, lam, realDt);
  }
  cam.fov = fov;
  // trauma shake
  const sh = director.trauma * director.trauma * (IS_TOUCH ? 0.7 : 1) * (settings.reduceFx ? 0.5 : 1);
  const t = performance.now() / 1000;
  const n1 = Math.sin(t * 23.1) * 0.5 + Math.sin(t * 37.7 + 1.3) * 0.3 + Math.sin(t * 61.3 + 2.1) * 0.2;
  const n2 = Math.sin(t * 19.7 + 4.0) * 0.5 + Math.sin(t * 41.9 + 0.7) * 0.3 + Math.sin(t * 57.1 + 3.3) * 0.2;
  const n3 = Math.sin(t * 29.3 + 2.2) * 0.5 + Math.sin(t * 47.3 + 5.1) * 0.3 + Math.sin(t * 71.9 + 1.9) * 0.2;
  _shk.set(n1, n2 * 0.6, n3).multiplyScalar(0.6 * sh);
  camera.position.copy(cam.pos).add(_shk);
  camera.lookAt(cam.look);
  camera.rotateZ(n2 * 0.03 * sh);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

/* =====================================================================
   15  AUDIO — WebAudio graph, music sequencer, synthesized SFX
   ===================================================================== */
const AU = { ctx: null, voices: 0, lastBolt: 0 };
const midiF = (m) => 440 * Math.pow(2, (m - 69) / 12);
function makeImpulse(ctx, secs) {
  const len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  return buf;
}
function audioInit() {
  try {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = AU.ctx = new AC();
    AU.master = ctx.createGain(); AU.master.gain.value = settings.volume;
    AU.comp = ctx.createDynamicsCompressor(); AU.comp.threshold.value = -14; AU.comp.ratio.value = 4; AU.comp.knee.value = 8; AU.comp.attack.value = 0.004; AU.comp.release.value = 0.25;
    AU.master.connect(AU.comp); AU.comp.connect(ctx.destination);
    AU.music = ctx.createGain(); AU.music.gain.value = 0.5; AU.music.connect(AU.master);
    AU.sfx = ctx.createGain(); AU.sfx.gain.value = 0.8; AU.sfx.connect(AU.master);
    AU.rev = ctx.createConvolver(); AU.rev.buffer = makeImpulse(ctx, 2.5); AU.revOut = ctx.createGain(); AU.revOut.gain.value = 0.9; AU.rev.connect(AU.revOut); AU.revOut.connect(AU.master);
    AU.musicSend = ctx.createGain(); AU.musicSend.gain.value = 0.3; AU.musicSend.connect(AU.rev); AU.music.connect(AU.musicSend);
    AU.chime = ctx.createGain(); AU.chime.gain.value = 0.9; AU.chime.connect(AU.sfx); AU.chimeSend = ctx.createGain(); AU.chimeSend.gain.value = 0.35; AU.chime.connect(AU.chimeSend); AU.chimeSend.connect(AU.rev);
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.noise = nb;
    const sil = ctx.createBufferSource(); sil.buffer = ctx.createBuffer(1, 1, 22050); sil.connect(ctx.destination); sil.start(0);
    if (ctx.state === 'suspended') ctx.resume();
    music.init();
  } catch (e) { console.warn('audio init failed', e); AU.ctx = null; }
}
function setVolume(v) { settings.volume = v; if (AU.master) AU.master.gain.setTargetAtTime(v, AU.ctx.currentTime, 0.05); }
function vAlloc(n = 1, low = false) { if (!AU.ctx || AU.ctx.state !== 'running') return false; if (AU.voices + n > 24 && low) return false; if (AU.voices > 40) return false; AU.voices += n; return true; }
function vEnd(src, n = 1) { src.onended = () => { AU.voices = Math.max(0, AU.voices - n); }; }
function tone(type, f0, f1, t0, dur, gain, dest, attack = 0.005, n = 1) {
  const ctx = AU.ctx; const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05); vEnd(o, n); return o;
}
function noise(t0, dur, gain, ftype, f0, f1, q, dest, attack = 0.005, n = 1) {
  const ctx = AU.ctx; const s = ctx.createBufferSource(); s.buffer = AU.noise; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05); vEnd(s, n); return s;
}
function scaleNote(deg, baseOct) {
  const sec = music.sec || SECTIONS.b1p1; const sc = sec.scale; const L = sc.length;
  const o = Math.floor(deg / L), d = ((deg % L) + L) % L;
  return (sec.root % 12) + 12 * (baseOct + 1) + sc[d] + 12 * o;
}
const sfx = {
  bolt() { if (!AU.ctx) return; const now = AU.ctx.currentTime; if (now - AU.lastBolt < 0.09) return; if (!vAlloc(1, true)) return; AU.lastBolt = now; tone('sine', 2400, 1800, now, 0.04, 0.035, AU.sfx); },
  shot(c) { if (!vAlloc(1, true)) return; const t = AU.ctx.currentTime; tone('triangle', c === Bc ? 520 : c === G ? 440 : c === W ? 700 : 330, 200, t, 0.12, 0.05, AU.sfx); },
  graze(c, combo) {
    if (!vAlloc(c === W ? 3 : 2)) return; const t = AU.ctx.currentTime;
    if (c === W) { for (let k = 0; k < 3; k++) { const m = scaleNote(combo % 8 + k * 2, 5); tone('sine', midiF(m), 0, t, 0.35, 0.05, AU.chime, 0.004, 1); } return; }
    const oct = c === R ? 4 : c === G ? 5 : 6; const m = scaleNote(combo % 8, oct);
    tone('sine', midiF(m), 0, t, 0.3, 0.08, AU.chime); tone('sine', midiF(m) * 2, 0, t, 0.18, 0.025, AU.chime);
  },
  perfect(c, combo) {
    if (!vAlloc(6)) return; const t = AU.ctx.currentTime; const m = scaleNote(combo % 8 + 4, 5);
    tone('sine', midiF(m), 0, t, 0.5, 0.1, AU.chime); tone('sine', midiF(m) * 1.5, 0, t, 0.4, 0.05, AU.chime);
    noise(t, 0.18, 0.12, 'highpass', 6000, 2000, 0.7, AU.sfx, 0.12);
    for (let k = 0; k < 3; k++) tone('sine', 3000 + k * 37, 0, t + 0.02, 0.45, 0.018, AU.chime);
  },
  hurt() { if (!vAlloc(2)) return; const t = AU.ctx.currentTime; noise(t, 0.16, 0.35, 'lowpass', 1400, 300, 1, AU.sfx); tone('square', 110, 55, t, 0.14, 0.08, AU.sfx); },
  dash() { if (!vAlloc(2)) return; const t = AU.ctx.currentTime; noise(t, 0.18, 0.28, 'bandpass', 800, 3000, 1.5, AU.sfx, 0.02); tone('sine', 1760, 2637, t + 0.05, 0.25, 0.05, AU.chime); },
  lance() { if (!vAlloc(3)) return; const t = AU.ctx.currentTime; tone('sawtooth', 200, 60, t, 0.18, 0.12, AU.sfx); noise(t, 0.12, 0.4, 'highpass', 2500, 900, 0.8, AU.sfx, 0.002); tone('sine', 90, 35, t, 0.35, 0.45, AU.sfx); },
  lattice() { if (!vAlloc(3)) return; const t = AU.ctx.currentTime; const m = scaleNote(0, 4); [0, 7, 12].forEach((s) => tone('sine', midiF(m + s), 0, t, 1.4, 0.07, AU.chime, 0.3)); },
  mirror() {
    if (!vAlloc(2)) return; const ctx = AU.ctx, t = ctx.currentTime; const f = midiF(scaleNote(4, 5));
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.5, t); mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
    mod.connect(mg); mg.connect(car.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    car.connect(g); g.connect(AU.chime); car.start(t); mod.start(t); car.stop(t + 1.4); mod.stop(t + 1.4); vEnd(car, 2);
  },
  tink(n) { if (!vAlloc(1, true)) return; const t = AU.ctx.currentTime; tone('sine', midiF(scaleNote(n % 10 + 2, 6)), 0, t, 0.2, 0.06, AU.chime); },
  nova() {
    if (!vAlloc(12)) return; const t = AU.ctx.currentTime;
    noise(t, 0.45, 0.35, 'highpass', 200, 8000, 0.7, AU.sfx, 0.4);
    const roots = [57, 52, 49]; roots.forEach((r, i) => [0, 4, 7].forEach((s) => tone('sawtooth', midiF(r + s + 12), 0, t + 0.4, 1.6, 0.03, AU.music, 0.01, 1)));
    tone('sine', 80, 25, t + 0.4, 1.4, 0.7, AU.sfx); noise(t + 0.4, 0.8, 0.3, 'lowpass', 3000, 200, 0.5, AU.sfx);
  },
  tell(shape) {
    if (!vAlloc(1, true)) return; const t = AU.ctx.currentTime;
    if (shape === 0) tone('sine', 600, 0, t, 0.05, 0.08, AU.sfx); else if (shape === 3) tone('sawtooth', 300, 1400, t, 0.22, 0.03, AU.sfx); else if (shape === 2) tone('sawtooth', 80, 70, t, 0.3, 0.08, AU.sfx); else noise(t, 0.3, 0.1, 'bandpass', 400, 2000, 1, AU.sfx, 0.1);
  },
  resolve(dist) { if (!vAlloc(1, true)) return; const t = AU.ctx.currentTime; noise(t, 0.3, 0.3 * clamp(1 - dist / 25, 0.15, 1), 'lowpass', 2200, 200, 0.8, AU.sfx); },
  bossHit() { if (!vAlloc(1, true)) return; const t = AU.ctx.currentTime; tone('triangle', 900, 600, t, 0.06, 0.05, AU.sfx); },
  laser() { if (!vAlloc(2)) return; const t = AU.ctx.currentTime; tone('sawtooth', 120, 90, t, 0.5, 0.08, AU.sfx, 0.02); noise(t, 0.45, 0.12, 'bandpass', 3000, 1200, 2, AU.sfx); },
  swoop() { if (!vAlloc(1)) return; const t = AU.ctx.currentTime; noise(t, 0.4, 0.25, 'bandpass', 3000, 400, 2, AU.sfx, 0.05); },
  growl() { if (!vAlloc(1)) return; const t = AU.ctx.currentTime; tone('sawtooth', 70, 55, t, 1.5, 0.08, AU.sfx, 0.3); },
  boom() { if (!vAlloc(2)) return; const t = AU.ctx.currentTime; tone('sine', 55, 28, t, 1.5, 0.7, AU.sfx); noise(t, 0.6, 0.25, 'lowpass', 900, 80, 0.6, AU.sfx); },
  riser() { if (!vAlloc(1)) return; const t = AU.ctx.currentTime; noise(t, 1.2, 0.18, 'bandpass', 300, 5000, 3, AU.sfx, 1.1); },
  shatter(s = 1) {
    if (!vAlloc(13)) return; const t = AU.ctx.currentTime;
    for (let k = 0; k < 12; k++) tone('sine', 2000 + Math.random() * 5000, 0, t + Math.random() * 0.12, 0.25 + Math.random() * 0.3, 0.03 * s, AU.chime, 0.002, 0);
    noise(t, 0.5, 0.25 * s, 'highpass', 3000, 1200, 0.6, AU.sfx, 0.003, 13);
  },
  chime(i, vol = 1) { if (!vAlloc(2)) return; const t = AU.ctx.currentTime; const pent = [0, 2, 4, 7, 9]; const m = 69 + pent[i % 5] + 12 * Math.floor(i / 5); tone('sine', midiF(m), 0, t, 1.6, 0.09 * vol, AU.chime); tone('sine', midiF(m) * 2.76, 0, t, 0.6, 0.02 * vol, AU.chime); },
  choir(k) { if (!vAlloc(3)) return; const t = AU.ctx.currentTime; [0, 3, 7].forEach((s) => tone('triangle', midiF(scaleNote(k * 2, 4) + s), 0, t, 1.8, 0.035, AU.chime, 0.4, 1)); },
  fall() { if (!vAlloc(2)) return; const t = AU.ctx.currentTime; noise(t, 1.6, 0.22, 'bandpass', 200, 3000, 1.2, AU.sfx, 1.2); tone('sine', 40, 160, t, 1.6, 0.15, AU.sfx, 1.2); },
  heartbeat() { if (!vAlloc(2, true)) return; const t = AU.ctx.currentTime; tone('sine', 60, 40, t, 0.15, 0.4, AU.sfx); tone('sine', 55, 38, t + 0.18, 0.15, 0.3, AU.sfx); },
  deny() { if (!vAlloc(1, true)) return; const t = AU.ctx.currentTime; tone('square', 140, 120, t, 0.08, 0.03, AU.sfx); },
  ui() { if (!vAlloc(1, true)) return; const t = AU.ctx.currentTime; tone('sine', 900, 0, t, 0.03, 0.06, AU.sfx); },
  victoryStab() { if (!vAlloc(6)) return; const t = AU.ctx.currentTime; [50, 57, 62, 66, 69, 74].forEach((m) => tone('triangle', midiF(m + 12), 0, t + 0.05, 2.5, 0.035, AU.chime, 0.02, 1)); },
};

// ---- music sequencer ----
const AEOL = [0, 2, 3, 5, 7, 8, 10], PHRYD = [0, 1, 4, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], LYD = [0, 2, 4, 6, 7, 9, 11], PHRY = [0, 1, 3, 5, 7, 8, 10], WHOLE = [0, 2, 4, 6, 8, 10], PENTm = [0, 3, 5, 7, 10];
const SECTIONS = {
  silence: { root: 57, scale: AEOL, bpm: 80, prog: [0], pad: 0, arp: 0, bass: 0, perc: 0 },
  title: { root: 62, scale: PENTm, bpm: 70, prog: [0, 3, 1, 4], pad: 0.8, arp: 0.25, bass: 0.3, perc: 0, cut: 900 },
  b1p1: { root: 57, scale: AEOL, bpm: 96, prog: [0, 5, 2, 6], pad: 1, arp: 0.65, bass: 1, perc: 0.3, cut: 1200 },
  b1p2: { root: 57, scale: PHRYD, bpm: 112, prog: [0, 1, 0, 6], pad: 1, arp: 0.85, bass: 1, perc: 1, cut: 1800 },
  b1p3: { root: 57, scale: PHRYD, bpm: 124, prog: [0, 5, 1, 6], pad: 1, arp: 1, bass: 1, perc: 1, cut: 2600 },
  b2p1: { root: 52, scale: DOR, bpm: 104, prog: [0, 3, 0, 6], pad: 1, arp: 0.6, bass: 1, perc: 0.3, cut: 1300 },
  b2p2: { root: 52, scale: LYD, bpm: 110, prog: [0, 1, 4, 0], pad: 1, arp: 0.75, bass: 1, perc: 0.6, cut: 1600 },
  b2p3: { root: 52, scale: PHRY, bpm: 124, prog: [0, 1, 5, 6], pad: 1, arp: 0.9, bass: 1, perc: 1, cut: 2000 },
  b3p1: { root: 49, scale: AEOL, bpm: 100, prog: [0, 5, 3, 4], pad: 1, arp: 0.6, bass: 1, perc: 0.3, cut: 1200 },
  b3p2: { root: 49, scale: WHOLE, bpm: 116, prog: [0, 1, 2, 1], pad: 1, arp: 0.8, bass: 1, perc: 0.6, cut: 1600 },
  b3p3: { root: 49, scale: PHRY, bpm: 128, prog: [0, 1, 0, 5], pad: 1, arp: 0.9, bass: 1, perc: 1, cut: 2000, heart: 1 },
  victory: { root: 50, scale: LYD, bpm: 84, prog: [0, 4, 5, 3], pad: 1.1, arp: 0.7, bass: 0.6, perc: 0, cut: 2400, bells: 1 },
};
const music = {
  sec: SECTIONS.title, pending: null, step: 0, nextT: 0, timer: 0, pad: [], started: false, want: 'title',
  init() {
    const ctx = AU.ctx; if (!ctx || this.started) return; this.started = true;
    this.padF = ctx.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.frequency.value = 1000; this.padF.Q.value = 0.7;
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 0.1; this.lfoG = ctx.createGain(); this.lfoG.gain.value = 500; this.lfo.connect(this.lfoG); this.lfoG.connect(this.padF.frequency); this.lfo.start();
    this.padG = ctx.createGain(); this.padG.gain.value = 0; this.padF.connect(this.padG); this.padG.connect(AU.music);
    for (let v = 0; v < 3; v++) for (let d = -1; d <= 1; d++) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = d * 7; o.frequency.value = 220; o.connect(this.padF); o.start(); this.pad.push(o); }
    this.arpF = ctx.createBiquadFilter(); this.arpF.type = 'lowpass'; this.arpF.frequency.value = 3200;
    this.delay = ctx.createDelay(1.5); this.fb = ctx.createGain(); this.fb.gain.value = 0.35; this.arpOut = ctx.createGain(); this.arpOut.gain.value = 1;
    this.arpF.connect(this.arpOut); this.arpOut.connect(AU.music); this.arpF.connect(this.delay); this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(AU.music);
    this.drums = ctx.createGain(); this.drums.gain.value = 0.7; this.drums.connect(AU.music);
    this.nextT = ctx.currentTime + 0.1; this.step = 0;
    this.applySection(SECTIONS[this.want] || SECTIONS.title, true);
    this.timer = setInterval(() => this.tick(), 25);
  },
  setSection(name) { this.want = name; if (!AU.ctx || !this.started) return; this.pending = SECTIONS[name] || SECTIONS.silence; },
  applySection(sec, immediate) {
    this.sec = sec; const ctx = AU.ctx, t = immediate ? ctx.currentTime : this.nextT;
    this.padG.gain.setTargetAtTime(0.022 * sec.pad, t, 0.6);
    this.padF.frequency.setTargetAtTime(sec.cut || 1000, t, 0.5);
    this.delay.delayTime.setValueAtTime(60 / sec.bpm * 0.75, t);
    this.setChord(0, t);
  },
  chordNotes(deg) { const sc = this.sec.scale, L = sc.length; const out = []; for (let k = 0; k < 3; k++) { const d = deg + k * 2; out.push(this.sec.root + sc[d % L] + 12 * Math.floor(d / L)); } return out; },
  setChord(idx, t) { const deg = this.sec.prog[idx % this.sec.prog.length]; const n = this.chordNotes(deg); for (let v = 0; v < 3; v++) for (let d = 0; d < 3; d++) this.pad[v * 3 + d].frequency.setTargetAtTime(midiF(n[v]), t, 0.25); this.curChord = n; },
  tick() {
    const ctx = AU.ctx; if (!ctx || ctx.state !== 'running') return;
    if (this.nextT < ctx.currentTime - 0.5) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.12) { this.schedule(this.step, this.nextT); this.nextT += 60 / this.sec.bpm / 4; this.step++; }
  },
  schedule(s, t) {
    const sec = this.sec; const inBar = s % 16;
    if (inBar === 0 && this.pending) { const p = this.pending; this.pending = null; this.applySection(p, false); }
    if (s % 32 === 0) this.setChord(Math.floor(s / 32), t);
    if (!this.curChord || (sec.pad === 0 && sec.arp === 0)) return;
    const n = this.curChord;
    // arp
    if (sec.arp > 0) {
      const pat = [0, 1, 2, 1, 0, 2, 1, 3, 0, 1, 2, 3, 2, 1, 0, 2];
      const keep = ((s * 7919) % 100) / 100 < sec.arp || inBar % 4 === 0;
      if (keep && AU.voices < 30) {
        const pi = pat[inBar], note = (pi === 3 ? n[0] + 12 : n[pi]) + 12;
        const o = ctx_osc(sec.bells ? 'sine' : 'triangle', midiF(note), t, sec.bells ? 0.9 : 0.2, sec.bells ? 0.05 : 0.04, this.arpF);
        if (sec.bells && inBar % 4 === 0) ctx_osc('sine', midiF(note + 12) * 1.003, t, 1.2, 0.02, this.arpF);
        void o;
      }
    }
    // bass
    if (sec.bass > 0) {
      if (sec.heart) { if (inBar === 0 || inBar === 3 || inBar === 8 || inBar === 11) ctx_osc('sine', midiF(n[0] - 24), t, 0.22, 0.22 * sec.bass, AU.music); }
      else if (inBar === 0 || inBar === 8) { ctx_osc('sine', midiF(n[0] - 12), t, 0.5, 0.16 * sec.bass, AU.music); ctx_osc('sine', midiF(n[0] - 24), t, 0.35, 0.12 * sec.bass, AU.music); }
    }
    // percussion (fights only)
    const fight = game.state === 'fight' || game.state === 'cinematic';
    if (sec.perc > 0 && fight && AU.voices < 30) {
      if (inBar % 2 === 0) { AU.voices++; noiseHat(t, inBar % 4 === 2 ? 0.07 : 0.035); }
      if (sec.perc >= 1 && inBar % 4 === 0) { AU.voices++; kick(t); }
      if (sec.perc >= 1 && (inBar === 4 || inBar === 12)) { AU.voices++; clap(t); }
    }
  },
};
function ctx_osc(type, f, t, dur, gain, dest) { AU.voices++; return tone(type, f, 0, t, dur, gain, dest, 0.005, 1); }
function noiseHat(t, g) { noise(t, 0.03, g, 'highpass', 7000, 7000, 0.7, music.drums, 0.001, 1); }
function kick(t) { tone('sine', 120, 40, t, 0.25, 0.5, music.drums, 0.002, 1); }
function clap(t) { noise(t, 0.12, 0.12, 'bandpass', 1500, 1200, 1.2, music.drums, 0.002, 1); }

/* =====================================================================
