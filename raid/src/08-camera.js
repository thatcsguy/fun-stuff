// =============================================================================
//  §9  Camera — chase spring (fixed yaw, looking north), zoom + auto-widen,
//      trauma shake, FOV kicks, CatmullRom cinematic rails + letterbox, and
//      TimeFX (hit-stop / slow-mo hooks; scale sim dt only).
// =============================================================================

const TimeFX = {
  hitStopT: 0, slowT: 0, slowScale: 1,
  /** freeze the sim at 0.05× for `sec` (real time) */
  hitStop(sec) { this.hitStopT = Math.max(this.hitStopT, sec); },
  /** slow the sim to `scale` for `sec` (real time); the strongest active slow wins */
  slowMo(scale, sec) {
    if (this.slowT > 0) { this.slowScale = Math.min(this.slowScale, scale); this.slowT = Math.max(this.slowT, sec); }
    else { this.slowScale = scale; this.slowT = sec; }
  },
  clear() { this.hitStopT = 0; this.slowT = 0; this.slowScale = 1; },
  update(realDt) {
    if (this.hitStopT > 0) this.hitStopT -= realDt;
    if (this.slowT > 0) { this.slowT -= realDt; if (this.slowT <= 0) this.slowScale = 1; }
  },
  get scale() { return this.hitStopT > 0 ? 0.05 : (this.slowT > 0 ? this.slowScale : 1); },
};

const Letterbox = {
  on: false,
  set(v, skippable) {
    this.on = v;
    document.body.classList.toggle('letterbox', v);
    $('skiphint').classList.toggle('can', !!(v && skippable));
  },
};

/** critically damped spring step on one component of two Vector3s (implicit form, no allocation) */
const AXES = ['x', 'y', 'z'];
function springStep(posV, velV, ax, target, omega, dt) {
  const state = posV[ax], vel = velV[ax];
  const f = 1 + 2 * dt * omega, oo = omega * omega, hoo = dt * oo, hhoo = dt * hoo, inv = 1 / (f + hhoo);
  posV[ax] = (f * state + dt * vel + hhoo * target) * inv;
  velV[ax] = (vel + hoo * (target - state)) * inv;
}

/** piecewise-linear sample of a rail keyframe array at eased u (hoisted: runs every rail frame) */
function railSample(arr, dflt, e) { if (!arr || !arr.length) return dflt; if (arr.length === 1) return arr[0]; const f = e * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f)); return lerp(arr[i], arr[i + 1], f - i); }

const CamRig = {
  pos: new THREE.Vector3(0, 10, 14), vel: new THREE.Vector3(),
  look: new THREE.Vector3(0, 2, 0), lookVel: new THREE.Vector3(),
  desired: new THREE.Vector3(), desiredLook: new THREE.Vector3(),
  zoom: 1, zoomTarget: 1, widen: 1, trauma: 0, fovKick: 0, roll: 0, shakeT: 0,
  fovBase: CONFIG.camera.fov,
  rail: null, railT: 0, railPos: null, railTgt: null, railEvt: 0, blendT: 0, blendDur: 0.6,
  blendFromPos: new THREE.Vector3(), blendFromLook: new THREE.Vector3(),
  override: null,           // optional fn(dt, cam) for custom camera control (title orbit etc.)
  _p: new THREE.Vector3(), _t: new THREE.Vector3(),

  addTrauma(v) { if (Save.settings.shake === false) return; this.trauma = Math.min(1, this.trauma + v); },
  kickFov(deg) { this.fovKick = Math.max(this.fovKick, deg); },
  isRail() { return !!this.rail; },

  /** snap the chase camera to its desired position (no spring lag) */
  snap() {
    this.computeDesired();
    this.pos.copy(this.desired); this.vel.set(0, 0, 0);
    this.look.copy(this.desiredLook); this.lookVel.set(0, 0, 0);
    this.widen = this.widenTarget();
    this.apply(0);
  },

  widenTarget() {
    let w = Game.forceWide > 0;
    if (!w) for (let i = 0; i < Telegraphs.list.length; i++) { const t = Telegraphs.list[i]; if (t.active && t.wide) { w = true; break; } }
    if (!w) for (let i = 0; i < Hazards.list.length; i++) { const h = Hazards.list[i]; if (h.active && h.wide) { w = true; break; } }
    return w ? CONFIG.camera.widen : 1;
  },

  computeDesired() {
    const C = CONFIG.camera, p = Game.player;
    const px = p ? p.vis.x : 0, pz = p ? p.vis.z : 0;
    let bx = px, bz = pz - 6;
    const b = Game.boss;
    if (b && b.alive !== false && b.vis) { bx = b.vis.x; bz = b.vis.z; }
    const k = C.lookBias, kx = View.portrait ? C.portraitLateralBias : k;
    const lx = lerp(px, bx, kx), lz = lerp(pz, bz, k);
    let push = 1, lookUp = C.lookUp;
    if (View.portrait) {
      push = C.portraitPush * (1 + C.portraitWidePush * clamp01((Math.abs(bx - px) - 6) / 10));
      lookUp -= C.portraitShortLookUp * clamp01((1.9 - View.h / View.w) / 0.3);
    } else if (View.compact) lookUp = C.lookUpCompact;
    const z = this.zoom * this.widen * push;
    // follow target sits between player and look point so the boss stays framed
    const fx = lerp(px, lx, 0.5), fz = lerp(pz, lz, 0.5);
    this.desired.set(fx + C.offset[0] * z, C.offset[1] * z, fz + C.offset[2] * z);
    this.desiredLook.set(lx, lookUp, lz);
  },

  /** play a rail: {dur, pos:[V3|[x,y,z]...], tgt:[...], fov:[...]?, roll:[...]?, events:[{t,fn}]?, letterbox:true, skippable:true, ease:'inOut'|'linear'|'out', timeScale?, onDone?} */
  playRail(def) {
    const V = (a) => a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]);
    if (this.rail) this.finishRail(true);
    const pos = def.pos.map(V), tgt = def.tgt.map(V);
    if (pos.length === 1) pos.push(pos[0].clone());
    if (tgt.length === 1) tgt.push(tgt[0].clone());
    this.railPos = new THREE.CatmullRomCurve3(pos, false, 'centripetal');
    this.railTgt = new THREE.CatmullRomCurve3(tgt, false, 'centripetal');
    this.rail = def; this.railT = 0; this.railEvt = 0;
    if (def.events) def.events.sort((a, b) => a.t - b.t);
    const skippable = def.skippable !== false;
    Game.cinematic = skippable;
    if (def.letterbox !== false) Letterbox.set(true, skippable);
    this.applyRail(0);
    return def;
  },
  applyRail(u) {
    const def = this.rail;
    const e = def.ease === 'linear' ? u : def.ease === 'out' ? easeOutCubic(u) : def.ease === 'in' ? easeInCubic(u) : easeInOutCubic(u);
    this.railPos.getPoint(e, this._p); this.railTgt.getPoint(e, this._t);
    camera.position.copy(this._p);
    camera.up.set(0, 1, 0);
    camera.lookAt(this._t);
    const roll = clamp(railSample(def.roll, 0, e), -CONFIG.camera.maxDutch, CONFIG.camera.maxDutch);
    if (roll) camera.rotateZ(roll * DEG);
    const fov = railSample(def.fov, this.fovBase, e);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    this.pos.copy(camera.position); this.look.copy(this._t);
  },
  _fireEvents(upto) {
    const ev = this.rail.events; if (!ev) return;
    while (this.railEvt < ev.length && ev[this.railEvt].t <= upto) { const e = ev[this.railEvt++]; try { e.fn(); } catch (err) { console.error(err); } }
  },
  /** end the rail; if `instant` all remaining events fire now (skip) */
  finishRail(instant) {
    const def = this.rail; if (!def) return;
    this._fireEvents(Infinity);
    this.rail = null; Game.cinematic = false;
    if (def.letterbox !== false) Letterbox.set(false);
    this.blendFromPos.copy(camera.position); this.blendFromLook.copy(this.look); this.blendT = 0; this.blendDur = def.blendOut != null ? def.blendOut : 0.6;
    this.vel.set(0, 0, 0); this.lookVel.set(0, 0, 0);
    if (def.onDone) { try { def.onDone(!!instant); } catch (e) { console.error(e); } }
  },
  /** skip the current (skippable) rail: outcome applied instantly */
  skip() { if (this.rail && this.rail.skippable !== false) { this.finishRail(true); if (this.blendDur > 0) { this.blendT = this.blendDur; this.snap(); } } },

  update(dt) {
    const C = CONFIG.camera;
    // trauma shake (real time)
    this.trauma = Math.max(0, this.trauma - C.shake.decay * dt);
    this.shakeT += dt;
    this.fovKick = Math.max(0, this.fovKick - dt * (4 / 0.3));
    if (this.rail) {
      this.railT += dt;
      const u = clamp01(this.railT / this.rail.dur);
      this._fireEvents(this.railT);
      if (this.rail) this.applyRail(u);
      if (this.rail && this.railT >= this.rail.dur) this.finishRail(false);
      this.applyShake();
      return;
    }
    if (this.override) { this.override(dt, camera); this.applyShake(); return; }
    // zoom / widen easing
    this.zoom = damp(this.zoom, this.zoomTarget, 8, dt);
    this.widen = damp(this.widen, this.widenTarget(), 3 / C.widenEase, dt);
    this.computeDesired();
    const om = C.omega;
    for (let i = 0; i < 3; i++) {
      const ax = AXES[i];
      springStep(this.pos, this.vel, ax, this.desired[ax], om, dt);
      springStep(this.look, this.lookVel, ax, this.desiredLook[ax], om * 0.8, dt);
    }
    this.apply(dt);
  },
  apply(dt) {
    // blend out of a rail
    if (this.blendT < this.blendDur) {
      this.blendT += dt;
      const k = smooth01(this.blendT / this.blendDur);
      camera.position.lerpVectors(this.blendFromPos, this.pos, k);
      this._t.lerpVectors(this.blendFromLook, this.look, k);
    } else { camera.position.copy(this.pos); this._t.copy(this.look); }
    camera.up.set(0, 1, 0);
    camera.lookAt(this._t);
    const fov = (View.portrait ? CONFIG.camera.fovPortrait : this.fovBase) + this.fovKick;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    this.applyShake();
  },
  applyShake() {
    if (this.trauma <= 0.0001) return;
    const C = CONFIG.camera.shake, t2 = this.trauma * this.trauma, f = this.shakeT * C.freq;
    camera.translateX(noise1(f) * C.maxOffset * t2);
    camera.translateY(noise1(f + 31.7) * C.maxOffset * t2);
    camera.rotateZ(noise1(f + 77.3) * C.maxRoll * DEG * t2);
  },

  // ---------------------------------------------------------------- rail builders
  /** orbit around `center` by `deg` degrees over `dur` (death / victory) */
  orbitRail(center, deg, dur, opts) {
    opts = opts || {};
    const pts = [], tg = [], r0 = Math.hypot(camera.position.x - center.x, camera.position.z - center.z) || 12;
    const a0 = Math.atan2(camera.position.x - center.x, camera.position.z - center.z);
    const h = opts.height != null ? opts.height : camera.position.y;
    const r = opts.radius || r0 * 0.85;
    for (let i = 0; i <= 4; i++) {
      const a = a0 + deg * DEG * i / 4, rr = lerp(r0, r, i / 4);
      pts.push([center.x + Math.sin(a) * rr, lerp(camera.position.y, h, i / 4), center.z + Math.cos(a) * rr]);
      tg.push([center.x, center.y + (opts.lookUp || 1.5), center.z]);
    }
    return { dur, pos: pts, tgt: tg, ease: 'out', letterbox: opts.letterbox !== false, skippable: opts.skippable !== false, events: opts.events, onDone: opts.onDone, roll: opts.roll };
  },
};
