// =============================================================================
//  §10  Telegraphs & Hazards (§3, §9.4, §9.6)
//   Telegraphs.spawn(opts) -> Telegraph   one-shot warning that resolves after `windup`
//   Hazards.spawn(opts)    -> Hazard      persistent damaging area (pools, rings, hands, beams)
//   Both use pooled flat quads with the single TelegraphMaterial program.
//   Shapes (local frame: origin at (x,z), forward = (sin rot, cos rot)):
//     circle   {r}                      donut  {r, inner}
//     cone     {r|len, angle(deg, full)} rect   {len, width(full)}   — from origin forward
//     sector   {r, inner, angle}         halfplane {r(clip radius)} — inside = forward half
// =============================================================================

const TELE_COLOR = CONFIG.telegraph.colors;
const PATTERN_FOR = { red: 0, gold: 1, violet: 2, green: 3 };

/** shared shape logic for Telegraph and Hazard */
class AreaShape {
  constructor(mesh) {
    this.mesh = mesh; this.u = mesh.material.uniforms;
    this.active = false; this.shape = 'circle'; this.shapeId = 0;
    this.x = 0; this.z = 0; this.rot = 0; this.r = 3; this.inner = 0; this.angle = 90; this.len = 10; this.width = 3;
    this.colorName = 'red'; this.wide = false;
  }
  _setShape(o) {
    this.shape = o.shape || 'circle'; this.shapeId = TELEGRAPH_SHAPES[this.shape] != null ? TELEGRAPH_SHAPES[this.shape] : 0;
    this.x = o.x || 0; this.z = o.z || 0; this.rot = o.rot || 0;
    this.r = o.r != null ? o.r : (o.len != null ? o.len : 3);
    this.inner = o.inner || 0; this.angle = o.angle != null ? o.angle : 90;
    this.len = o.len != null ? o.len : (o.r != null ? o.r : 10); this.width = o.width != null ? o.width : 3;
    const cn = o.color || 'red';
    this.colorName = typeof cn === 'string' ? cn : 'custom';
    toColor(typeof cn === 'string' ? (TELE_COLOR[cn] != null ? TELE_COLOR[cn] : cn) : cn, this.u.uColor.value);
    this.u.uColorNorm.value = colorLumNorm(this.u.uColor.value);
    const pat = o.pattern != null ? o.pattern : (PATTERN_FOR[this.colorName] != null ? PATTERN_FOR[this.colorName] : 0);
    this.u.uPattern.value = pat;
    this.u.uFillMode.value = o.fillMode != null ? o.fillMode : ((this.shapeId <= 1 || this.shapeId === 5) ? 0 : 1);
    this.wide = o.wide != null ? !!o.wide : (this.shape === 'donut' || this.shape === 'halfplane');
    this.u.uPips.value = o.pips || 0; this.u.uPipsOn.value = o.pipsOn || 0;
    this.u.uInterior.value = o.interior != null ? o.interior : 1;
    this.refresh();
  }
  /** push shape params + quad bounds to the GPU (call after changing r/inner/x/z/rot/len/width) */
  refresh() {
    const u = this.u, H = CONFIG.telegraph.halo + 0.15;
    u.uShape.value = this.shapeId;
    let hx, y0, y1;
    switch (this.shapeId) {
      case 0: u.uP.value.set(this.r, 0, 0, 0); hx = this.r + H; y0 = -this.r - H; y1 = this.r + H; break;
      case 1: u.uP.value.set(this.r, this.inner, 0, 0); hx = this.r + H; y0 = -this.r - H; y1 = this.r + H; break;
      case 2: case 4: {
        const a = this.angle * DEG * 0.5, R = this.r;
        if (this.shapeId === 2) u.uP.value.set(R, a, 0, 0); else u.uP.value.set(R, this.inner, a, 0);
        hx = (a >= Math.PI / 2 ? R : R * Math.sin(a)) + H;
        y0 = Math.min(0, R * Math.cos(a)) - H; if (a >= Math.PI / 2) y0 = -R * Math.min(1, -Math.cos(a)) - H;
        y1 = R + H; break;
      }
      case 3: u.uP.value.set(this.len, this.width * 0.5, 0, 0); hx = this.width * 0.5 + H; y0 = -H; y1 = this.len + H; break;
      default: u.uP.value.set(this.r, 0, 0, 0); hx = this.r + H; y0 = -H; y1 = this.r + H; break;
    }
    u.uHalf.value.set(hx, (y1 - y0) * 0.5);
    u.uCenter.value.set(0, (y1 + y0) * 0.5);
    this.mesh.position.set(this.x, CONFIG.telegraph.y, this.z);
    this.mesh.rotation.set(0, this.rot, 0);
  }
  /** signed distance (m) of a world point to the shape: < 0 inside */
  sdf(px, pz) {
    const dx = px - this.x, dz = pz - this.z, c = Math.cos(this.rot), s = Math.sin(this.rot);
    const lx = dx * c - dz * s, ly = dx * s + dz * c, r = Math.hypot(lx, ly);
    switch (this.shapeId) {
      case 0: return r - this.r;
      case 1: return Math.max(r - this.r, this.inner - r);
      case 2: return sdPie(lx, ly, this.angle * DEG * 0.5, this.r);
      case 3: { const qx = Math.abs(lx) - this.width * 0.5, qy = Math.abs(ly - this.len * 0.5) - this.len * 0.5; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0); }
      case 4: return Math.max(sdPie(lx, ly, this.angle * DEG * 0.5, this.r), this.inner - r);
      default: return Math.max(-ly, r - this.r);
    }
  }
  /** point-in-shape test; pad (m) grows the shape (defaults to CONFIG.telegraph.pad) */
  contains(px, pz, pad) { return this.sdf(px, pz) <= (pad != null ? pad : CONFIG.telegraph.pad); }
}
function sdPie(px, py, a, r) {
  const cx = Math.sin(a), cy = Math.cos(a); px = Math.abs(px);
  const l = Math.hypot(px, py) - r;
  const t = clamp(px * cx + py * cy, 0, r);
  const m = Math.hypot(px - cx * t, py - cy * t);
  return Math.max(l, m * Math.sign(cy * px - cx * py));
}

// ---------------------------------------------------------------- Telegraph (one-shot)
class Telegraph extends AreaShape {
  constructor(mesh) { super(mesh); this.t = 0; this.windup = 1; this.resolved = false; this.flashT = 0; this.fadeT = 0; this.delay = 0; }
  get progress() { return clamp01(this.t / this.windup); }
  get remaining() { return Math.max(0, this.windup - this.t); }
  /** absolute sim time at which this telegraph resolves */
  get resolveAt() { return Game.time + this.delay + this.remaining; }
  setup(o) {
    this._setShape(o);
    const raw = o.rawWindup ? 1 : Game.diff.windup;
    this.windup = Math.max(0.05, (o.windup != null ? o.windup : 1.5) * raw);
    this.t = 0; this.delay = o.delay || 0; this.resolved = false; this.flashT = 0; this.fadeT = 0;
    this.dmg = o.dmg || 0; this.soak = !!o.soak; this.soakDmg = o.soakDmg || 0;
    this.source = o.source || 'Unknown'; this.avoidable = o.avoidable !== false; this.major = !!o.major;
    this.knock = o.knock || 0; this.onResolve = o.onResolve || null; this.onUpdate = o.onUpdate || null; this.follow = o.follow || null;
    this.silent = !!o.silent; this.noFlash = !!o.noFlash; this.flashK = o.flashK != null ? o.flashK : (o.shape === 'halfplane' || o.shape === 'donut' || (o.r || 0) > 12 ? 0.2 : (o.r || 0) > 7 ? 0.35 : 1); this.resolveSfx = o.sfx !== undefined ? o.sfx : 'click';
    this.pad = o.pad; this.data = o.data || null; this.pdDash = 0; this.hitPlayer = false; this.tag = o.tag || null;
    this.u.uProgress.value = 0; this.u.uFlash.value = 0; this.u.uAlpha.value = this.delay > 0 ? 0 : 0.01; this.u.uRemain.value = 99;
    this.u.uRim.value = CONFIG.telegraph.rimIntensity;
    this.mesh.visible = this.delay <= 0;
    this.active = true;
    return this;
  }
  /** fade out without resolving (interrupts, phase changes) */
  cancel() { if (!this.active || this.resolved) return; this.resolved = true; this.cancelled = true; this.flashT = 0; this.fadeT = 0.0001; }
  step(dt) {
    if (this.delay > 0) { this.delay -= dt; if (this.delay > 0) return; this.mesh.visible = true; }
    if (!this.resolved) {
      this.t += dt;
      if (this.follow) { this.follow(this, dt); this.refresh(); }
      if (this.onUpdate) this.onUpdate(this, dt);
      const u = this.u;
      u.uProgress.value = this.progress; u.uRemain.value = this.windup - this.t;
      u.uAlpha.value = Math.min(1, this.t / 0.12);
      if (this.t >= this.windup) this.resolve();
    } else if (this.flashT > 0) {
      this.flashT -= dt;
      this.u.uFlash.value = Math.max(0, this.flashT / CONFIG.telegraph.flash) * this.flashK;
      if (this.flashT <= 0) this.fadeT = 0.0001;
    } else if (this.fadeT > 0) {
      this.fadeT += dt;
      this.u.uAlpha.value = Math.max(0, 1 - this.fadeT / 0.2);
      if (this.fadeT >= 0.2) return true;     // done → release
    }
    return false;
  }
  resolve() {
    this.resolved = true; this.cancelled = false;
    this.flashT = this.noFlash ? 0 : CONFIG.telegraph.flash; if (this.noFlash) this.fadeT = 0.0001;
    this.u.uFlash.value = this.noFlash ? 0 : 1; this.u.uProgress.value = 1; this.u.uRemain.value = 0;
    const p = Game.player;
    let inside = false;
    if (p && p.alive) {
      inside = this.contains(p.pos.x, p.pos.z, this.pad);
      const amount = this.soak ? (inside ? this.soakDmg : this.dmg) : (inside ? this.dmg : 0);
      if (amount > 0) {
        const knock = this.knock && inside && !this.soak ? this.knock : 0;
        p.damage({ amount, source: this.source, avoidable: this.avoidable, knockFromX: this.x, knockFromZ: this.z, knock });
      }
      if (this.pdDash && p.dashId === this.pdDash) p.grantPerfectDodge('telegraph');
    }
    this.hitPlayer = inside;
    if (this.resolveSfx) sfx(this.resolveSfx);
    if (this.onResolve) { try { this.onResolve(this, inside); } catch (e) { console.error(e); } }
  }
}

// ---------------------------------------------------------------- Hazard (persistent)
class Hazard extends AreaShape {
  constructor(mesh) { super(mesh); this.t = 0; this.life = Infinity; this.lockT = 0; this.dying = 0; }
  setup(o) {
    this._setShape(o);
    this.t = 0; this.life = o.life != null ? o.life : Infinity; this.dying = 0;
    this.tickDmg = o.tickDmg || 0; this.tickInterval = o.tickInterval || 0.5; this.lockT = o.firstTickDelay || 0;
    this.source = o.source || 'Hazard'; this.avoidable = o.avoidable !== false; this.knock = o.knock || 0;
    this.pull = o.pull || 0; this.lingering = !!o.lingering; this.update = o.update || null; this.willHitFn = o.willHit || null;
    this.onHit = o.onHit || null; this.onExpire = o.onExpire || null; this.data = o.data || null; this.pad = o.pad;
    this.fadeIn = o.fadeIn != null ? o.fadeIn : 0.25; this.fadeOut = o.fadeOut != null ? o.fadeOut : 0.35; this.tag = o.tag || null;
    this.u.uProgress.value = o.progress != null ? o.progress : 1; this.u.uFlash.value = 0; this.u.uRemain.value = 99;
    this.u.uRim.value = o.gentle === false ? CONFIG.telegraph.rimIntensity : CONFIG.telegraph.gentleRim;
    this.u.uAlpha.value = 0;
    this.mesh.visible = o.visible !== false;
    this.active = true;
    return this;
  }
  /** fade out and release */
  kill() { if (this.active && !this.dying) this.dying = 0.0001; }
  /** will this hazard touch (x,z) within the next `dt` seconds? (PD lookahead) */
  willHit(x, z, dt) { if (this.willHitFn) return this.willHitFn(this, x, z, dt); return false; }
  step(dt) {
    this.t += dt;
    if (this.dying > 0) {
      this.dying += dt; this.u.uAlpha.value = Math.max(0, 1 - this.dying / this.fadeOut);
      return this.dying >= this.fadeOut;
    }
    if (this.update) { this.update(this, dt); this.refresh(); }
    this.u.uAlpha.value = this.fadeIn > 0 ? Math.min(1, this.t / this.fadeIn) : 1;
    if (this.t >= this.life) { if (this.onExpire) this.onExpire(this); this.kill(); return false; }
    // damage / pull
    this.lockT -= dt;
    const p = Game.player;
    if (p && p.alive && this.mesh.visible !== null) {
      const inside = this.contains(p.pos.x, p.pos.z, this.pad);
      if (inside) {
        if (this.pull) {
          const dx = this.x - p.pos.x, dz = this.z - p.pos.z, d = Math.hypot(dx, dz);
          if (d > 0.2) p.addExtVel(dx / d * this.pull, dz / d * this.pull);
        }
        if (this.tickDmg > 0 && this.lockT <= 0) {
          this.lockT = this.tickInterval;
          p.damage({ amount: this.tickDmg, source: this.source, avoidable: this.avoidable, knock: this.knock, knockFromX: this.x, knockFromZ: this.z, tick: true });
          if (this.onHit) this.onHit(this);
        }
      }
    }
    return false;
  }
}

// ---------------------------------------------------------------- pools + managers
function makeAreaMesh() {
  const m = new THREE.Mesh(TELEGRAPH_GEO, makeTelegraphMaterial());
  m.frustumCulled = false; m.renderOrder = 5; m.visible = false; m.matrixAutoUpdate = true;
  scene.add(m);
  return m;
}

const Telegraphs = {
  pool: null, list: [],
  init() {
    this.pool = new Pool(CONFIG.telegraph.pool, () => new Telegraph(makeAreaMesh()));
    this.list = this.pool.items;
  },
  /** spawn a telegraph (see Telegraph.setup for options). Returns null if the pool (48) is exhausted. */
  spawn(o) {
    const tg = this.pool.get();
    if (!tg) { console.warn('telegraph pool exhausted'); return null; }
    return tg.setup(o);
  },
  update(dt) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const tg = L[i]; if (!tg.active) continue;
      if (tg.step(dt)) { tg.active = false; tg.mesh.visible = false; this.pool.release(tg); }
    }
  },
  /** PD lookahead (§9.6): flag every telegraph resolving within `win` s that contains (x,z) */
  markPD(x, z, win, dashId) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const tg = L[i]; if (!tg.active || tg.resolved || tg.delay > 0) continue;
      const rem = tg.windup - tg.t;
      if (rem >= 0 && rem <= win && (tg.dmg > 0 || tg.soak) && tg.contains(x, z, tg.pad)) tg.pdDash = dashId;
    }
  },
  /** number of active major telegraphs resolving within ±win of absolute sim time `at` (for overlap caps) */
  majorResolvingNear(at, win) {
    let n = 0; const L = this.list;
    for (let i = 0; i < L.length; i++) { const tg = L[i]; if (tg.active && !tg.resolved && tg.major && Math.abs(tg.resolveAt - at) <= win) n++; }
    return n;
  },
  activeCount() { let n = 0; for (const tg of this.list) if (tg.active && !tg.resolved) n++; return n; },
  /** cancel (fade) all, or only those matching tag */
  clearAll(tag) { for (const tg of this.list) if (tg.active && (tag == null || tg.tag === tag)) { if (!tg.resolved) tg.cancel(); } },
  /** hard reset (fight restart) */
  reset() { for (const tg of this.list) { if (tg.active) { tg.active = false; tg.mesh.visible = false; this.pool.release(tg); } } },
};

const Hazards = {
  pool: null, list: [],
  init() {
    this.pool = new Pool(CONFIG.telegraph.hazardPool, () => new Hazard(makeAreaMesh()));
    this.list = this.pool.items;
  },
  /** spawn a persistent hazard (see Hazard.setup). Returns null if the pool (32) is exhausted. */
  spawn(o) {
    const h = this.pool.get();
    if (!h) { console.warn('hazard pool exhausted'); return null; }
    return h.setup(o);
  },
  update(dt) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const h = L[i]; if (!h.active) continue;
      if (h.step(dt)) { h.active = false; h.mesh.visible = false; this.pool.release(h); }
    }
  },
  /** PD lookahead for moving hazards: true if any hazard that does NOT contain (x,z) now will hit it within dt */
  anyWillHit(x, z, dt) {
    for (const h of this.list) if (h.active && !h.dying && h.tickDmg > 0 && !h.contains(x, z, h.pad) && h.willHit(x, z, dt)) return true;
    return false;
  },
  /** Zero Hour: clear lingering pools the player is not standing in */
  clearLingering(px, pz) { for (const h of this.list) if (h.active && h.lingering && !h.contains(px, pz, 0)) h.kill(); },
  clearAll(tag) { for (const h of this.list) if (h.active && (tag == null || h.tag === tag)) h.kill(); },
  reset() { for (const h of this.list) { if (h.active) { h.active = false; h.mesh.visible = false; this.pool.release(h); } } },
};

/** helper for moving-hazard willHit: sample h.data-driven predictor fn(h, t) → sets h.x/z/r…; generic ring helper below */
function ringWillHit(h, x, z, dt) {
  // expanding donut with h.data.speed (m/s): will the ring band sweep over distance d within dt?
  const d = Math.hypot(x - h.x, z - h.z), sp = (h.data && h.data.speed) || 0;
  if (h.data && h.data.gapDir != null && Math.abs(angDiff(Math.atan2(x - h.x, z - h.z), h.data.gapDir)) < h.data.gapHalf) return false;   // standing in its notch
  for (let s = 0.05; s <= dt + 1e-6; s += 0.05) { const R = h.r + sp * s, I = h.inner + sp * s; if (d <= R && d >= I) return true; }
  return false;
}
