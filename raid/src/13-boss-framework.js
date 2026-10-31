// =============================================================================
//  §13  BOSS FRAMEWORK
//   BOSSES / registerBoss(def)  — registry; builds ENCOUNTERS[i] for startFight
//   Boss (extends BossEntity)   — data-driven phase scheduler (per-ability timers,
//                                 jitter, overlap cap), busy / cast gating, walking,
//                                 melee pressure, specials (one-shot % triggers),
//                                 transitions (camera rail + invulnerability +
//                                 telegraph/hazard clearing), enrage, the generic
//                                 death sequence (400 shards sucked into the hilt),
//                                 hex shield, retry-from-phase, lance-target picking.
//   PoseRig                     — named target poses (rotation/position offsets per
//                                 part) blended with critically-damped easing.
//   BossPart                    — secondary entity with its own cast bar / lance
//                                 interrupt / HP (Sirens, Anchors, casters…)
//   spawnBossAdd(o)             — adds with seek / stoke / explode-near-boss /
//                                 footprint / custom-mesh behaviours
//   BossKit                     — geometry + prediction helpers (LoS, ballistic,
//                                 rotating-hazard willHit, shock rings, arena points)
//   WorldBars                   — DOM cast / HP bars that follow world entities
//  See BOSS_API.md for the guide.
// =============================================================================

// ---------------------------------------------------------------- registry
/** BOSSES[i] = the registered definition of boss i (0 Pyrrha, 1 Nerith, 2 Auren). */
const BOSSES = [];

/**
 * Register a boss. def = {
 *   index, key, name?, epithet?, music,
 *   buildArena(ctx) -> arena                  // {key, group, radius, colliders, spawn?, exposure, bloom, grade, update(dt), dispose()}
 *   createBoss(ctx, arena) -> Boss            // a Boss subclass instance
 *   intro?(ctx, boss, arena) -> railDef       // skippable intro rail (outcome must be applied in its events / onDone)
 *   update?(dt)                               // per-sim-step encounter hook (after boss/adds)
 * }
 * Creates ENCOUNTERS[index] (the contract 18-game.js startFight uses).
 */
function registerBoss(def) {
  const B = CONFIG.bosses[def.index] || {};
  BOSSES[def.index] = def;
  ENCOUNTERS[def.index] = {
    key: def.key || B.key, name: def.name || B.name, epithet: def.epithet || B.epithet, index: def.index, music: def.music || def.key || B.key,
    setup(ctx) {
      const arena = def.buildArena(ctx);
      const boss = def.createBoss(ctx, arena);
      boss.arena = arena;
      if (ctx.startPhase > 0 && boss.jumpToPhase) boss.jumpToPhase(ctx.startPhase);
      return { arena, boss };
    },
    intro: def.intro ? (ctx) => def.intro(ctx, Game.boss, Game.arena) : null,
    onStart(ctx) { if (Game.boss && Game.boss.onFightStart) Game.boss.onFightStart(ctx); },
    update(dt) { if (def.update) def.update(dt); },
  };
  return def;
}

// ---------------------------------------------------------------- BossKit (helpers, no allocation unless noted)
const BossKit = {
  /** windup seconds scaled by difficulty (what Telegraphs.spawn does internally) */
  windup(sec) { return sec * Game.diff.windup; },
  /** random point in the arena ring [minR, maxR] (seeded), avoiding colliders by `clear` m. Writes into out (Vector3). */
  randomArenaPoint(out, minR, maxR, clear) {
    const cols = Game.arena && Game.arena.colliders;
    for (let tries = 0; tries < 12; tries++) {
      const a = rand() * TAU, r = lerp(minR, maxR, Math.sqrt(rand()));
      out.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      let ok = true;
      if (cols && clear) for (const c of cols) if (dist2(out.x, out.z, c.x, c.z) < c.r + clear) { ok = false; break; }
      if (ok) return out;
    }
    return out;
  },
  /** first circle {x,z,r} blocking the segment a→b (line of sight), or null. circles: array of {x,z,r,enabled?} */
  losBlocker(ax, az, bx, bz, circles) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-6;
    let best = null, bt = 2;
    for (const c of circles) {
      if (c.enabled === false) continue;
      const t = clamp01(((c.x - ax) * dx + (c.z - az) * dz) / L2);
      const px = ax + dx * t, pz = az + dz * t;
      if ((px - c.x) ** 2 + (pz - c.z) ** 2 <= c.r * c.r && t < bt) { bt = t; best = c; }
    }
    return best;
  },
  /** ballistic launch velocity so a projectile from `from` lands on `to` after T seconds with gravity g (negative). Writes out (Vector3). */
  ballistic(from, to, T, g, out) {
    out.set((to.x - from.x) / T, (to.y - from.y - 0.5 * g * T * T) / T, (to.z - from.z) / T);
    return out;
  },
  /**
   * willHit predictor for any moving hazard: h.data.predict(h, s) must set the hazard's shape (x,z,rot,r,inner…)
   * to its state `s` seconds from now. Samples every 0.05 s over dt (spec §9.6), restores the shape afterwards.
   */
  willHitPredict(h, x, z, dt) {
    const d = h.data, f = d && d.predict; if (!f) return false;
    const sx = h.x, sz = h.z, sr = h.rot, srr = h.r, si = h.inner, sl = h.len;
    let hit = false;
    for (let s = 0.05; s <= dt + 1e-6 && !hit; s += 0.05) { f(h, s); if (h.sdf(x, z) <= 0) hit = true; }
    h.x = sx; h.z = sz; h.rot = sr; h.r = srr; h.inner = si; h.len = sl;
    return hit;
  },
  /** willHit for hazards rotating about their origin at h.data.angVel rad/s (clock hands, Moonbeams) */
  willHitRotating(h, x, z, dt) {
    const w = (h.data && h.data.angVel) || 0, r0 = h.rot;
    let hit = false;
    for (let s = 0.05; s <= dt + 1e-6 && !hit; s += 0.05) { h.rot = r0 + w * s; if (h.sdf(x, z) <= 0) hit = true; }
    h.rot = r0;
    return hit;
  },
  /**
   * Expanding shockwave ring hazard (the telegraph IS the ring). o: {x, z, speed(m/s)=10, width=1.2, maxR=22, dmg, source, color='red', onDone}
   * One hit per ring (tickInterval 1 s), PD lookahead via ringWillHit. Returns the hazard.
   */
  shockRing(o) {
    const sp = o.speed || 10, w = o.width || 1.2, maxR = o.maxR || 22;
    return Hazards.spawn({ shape: 'donut', x: o.x, z: o.z, r: w, inner: 0, life: maxR / sp + 0.3, tickDmg: o.dmg, tickInterval: 1.0, color: o.color || 'red',
      source: o.source || 'Shockwave', gentle: false, wide: true, fadeIn: 0.05, fadeOut: 0.2, avoidable: true, interior: 1.0,
      data: { speed: sp }, willHit: ringWillHit, tag: o.tag,
      update: (h, dt) => { h.r += sp * dt; h.inner = Math.max(0, h.r - w); if (h.r >= maxR + w) { h.kill(); if (o.onDone) o.onDone(h); } if (o.update) o.update(h, dt); } });
  },
  /** rotating rect (beam / clock hand) hazard. o: {x,z,rot,angVel(rad/s),len,width,life,tickDmg,tickInterval,source,color,gentle,onUpdate} */
  rotatingRect(o) {
    return Hazards.spawn({ shape: 'rect', x: o.x, z: o.z, rot: o.rot || 0, len: o.len, width: o.width, life: o.life != null ? o.life : Infinity,
      tickDmg: o.tickDmg, tickInterval: o.tickInterval || 0.5, color: o.color || 'red', source: o.source || 'Beam', gentle: o.gentle != null ? o.gentle : false,
      wide: o.wide != null ? o.wide : true, knock: o.knock || 0, data: Object.assign({ angVel: o.angVel || 0 }, o.data || {}), willHit: BossKit.willHitRotating, tag: o.tag,
      update: (h, dt) => { h.rot += h.data.angVel * dt; if (o.onUpdate) o.onUpdate(h, dt); } });
  },
  /** is the player alive and inside a shape spec ({shape,x,z,rot,r,inner,angle,len,width}) right now? (uses a scratch AreaShape) */
  playerIn(spec, pad) {
    const p = Game.player; if (!p || !p.alive) return false;
    const s = BossKit._shape; s.shape = spec.shape; s.shapeId = TELEGRAPH_SHAPES[spec.shape] || 0;
    s.x = spec.x || 0; s.z = spec.z || 0; s.rot = spec.rot || 0; s.r = spec.r != null ? spec.r : (spec.len || 3); s.inner = spec.inner || 0;
    s.angle = spec.angle != null ? spec.angle : 90; s.len = spec.len != null ? spec.len : s.r; s.width = spec.width != null ? spec.width : 3;
    return s.sdf(p.pos.x, p.pos.z) <= (pad != null ? pad : CONFIG.telegraph.pad);
  },
  _shape: null,
  /** generic impact flourish: dust/sparks burst, rubble, ground ring, light flash, trauma. power 0..2 */
  impact(x, z, power, colA, colB) {
    const ca = colA != null ? colA : 0xffb070, cb = colB != null ? colB : 0x5a1a08;
    CamRig.addTrauma(0.15 + power * 0.2);
    Particles.burst(_v1.set(x, 0.3, z), Math.round(40 + power * 60), ca, cb, 8 + power * 3, 0.8, 0.32, -10, { flat: true, intensity: 2 });
    for (let i = 0; i < 2 + power * 3; i++) Rubble.spawn(x + fxRange(-1, 1), 0.4, z + fxRange(-1, 1), fxRange(-5, 5), fxRange(4, 9), fxRange(-5, 5), { life: 1.8, scale: fxRange(0.4, 0.9) });
    GroundFX.ring(x, z, 0.5, 3 + power * 4, ca, 0.5, 0.35, 2.2);
    PointLights.flash(_v1.set(x, 1.5, z), ca, 30 + power * 40, 0.3);
  },
};
BossKit._shape = new AreaShape({ material: { uniforms: makeTelegraphMaterial().uniforms }, position: new THREE.Vector3(), rotation: new THREE.Euler() });
BossKit._shape.refresh = () => {};

// ---------------------------------------------------------------- PoseRig
/**
 * Named poses for a procedural rig. parts = {name: Object3D}; the rest pose is captured at construction.
 * poses = { poseName: { partName: { r:[x,y,z] (radians, added to rest), p:[x,y,z] (metres, added to rest), s: uniform scale } } }
 * rig.set(name, speed) blends every part toward rest + pose offsets (parts not listed → rest) at `speed` (1/s, default 8).
 * rig.update(dt) each render frame. rig.offset(part) gives a per-frame additive layer (breathing, flex) reset each update.
 */
class PoseRig {
  constructor(parts, poses) {
    this.parts = parts; this.poses = poses || {}; this.name = 'idle'; this.speed = 8; this.list = [];
    for (const k in parts) {
      const o = parts[k];
      this.list.push({ k, o, r0: o.rotation.clone(), p0: o.position.clone(), s0: o.scale.x,
        r: new THREE.Vector3(o.rotation.x, o.rotation.y, o.rotation.z), p: o.position.clone(), s: o.scale.x,
        add: { r: new THREE.Vector3(), p: new THREE.Vector3() } });
    }
    this.map = {}; for (const e of this.list) this.map[e.k] = e;
  }
  set(name, speed) { if (this.poses[name] || name === 'rest') { this.name = name; this.speed = speed || 8; } return this; }
  /** additive layer for this frame: rig.add('torso', rx, ry, rz) */
  add(part, rx, ry, rz, px, py, pz) { const e = this.map[part]; if (!e) return; e.add.r.x += rx || 0; e.add.r.y += ry || 0; e.add.r.z += rz || 0; e.add.p.x += px || 0; e.add.p.y += py || 0; e.add.p.z += pz || 0; }
  /** jump instantly to the current pose */
  snap() { this.update(10, true); }
  update(dt, snap) {
    const P = this.poses[this.name] || {}, k = snap ? 1 : 1 - Math.exp(-this.speed * dt);
    for (const e of this.list) {
      const t = P[e.k], o = e.o;
      const tx = e.r0.x + (t && t.r ? t.r[0] : 0), ty = e.r0.y + (t && t.r ? t.r[1] : 0), tz = e.r0.z + (t && t.r ? t.r[2] : 0);
      e.r.x += (tx - e.r.x) * k; e.r.y += (ty - e.r.y) * k; e.r.z += (tz - e.r.z) * k;
      const qx = e.p0.x + (t && t.p ? t.p[0] : 0), qy = e.p0.y + (t && t.p ? t.p[1] : 0), qz = e.p0.z + (t && t.p ? t.p[2] : 0);
      e.p.x += (qx - e.p.x) * k; e.p.y += (qy - e.p.y) * k; e.p.z += (qz - e.p.z) * k;
      const ts = e.s0 * (t && t.s != null ? t.s : 1); e.s += (ts - e.s) * k;
      o.rotation.set(e.r.x + e.add.r.x, e.r.y + e.add.r.y, e.r.z + e.add.r.z);
      o.position.set(e.p.x + e.add.p.x, e.p.y + e.add.p.y, e.p.z + e.add.p.z);
      if (o.scale.x !== e.s) o.scale.setScalar(e.s);
      e.add.r.set(0, 0, 0); e.add.p.set(0, 0, 0);
    }
  }
}

// ---------------------------------------------------------------- WorldBars (DOM bars that follow entities)
const WorldBars = {
  list: [], root: null, _s: { x: 0, y: 0, z: 0 },
  init() {
    if (this.root) return;
    const st = document.createElement('style');
    st.textContent = `
      #worldbars{position:fixed;inset:0;pointer-events:none;z-index:11}
      .wbar{position:absolute;left:0;top:0;width:92px;margin-left:-46px;opacity:0;transition:opacity .15s;font-family:var(--num);text-align:center}
      .wbar.on{opacity:1}
      .wbar .n{font-family:var(--head);font-size:14px;font-weight:700;letter-spacing:.1em;color:#fff;text-shadow:0 1px 3px #000,0 0 6px #000;white-space:nowrap;margin-bottom:2px}
      .wbar .b{position:relative;height:7px;background:rgba(4,6,10,.8);border:1px solid rgba(200,200,210,.6);overflow:hidden}
      .wbar .b i{position:absolute;left:0;top:0;bottom:0;width:100%;transform-origin:0 50%;background:var(--wc,#ffb36b)}
      .wbar.int .b{border-color:var(--violet);animation:shimmer .9s linear infinite}
      .wbar.int .b i{background:linear-gradient(180deg,#e8d6ff,#9a5cff)}
      .wbar.shield .b{border-color:#c9a2ff;box-shadow:0 0 8px #b266ff}`;
    document.head.appendChild(st);
    this.root = document.createElement('div'); this.root.id = 'worldbars'; document.body.appendChild(this.root);
  },
  /** follow `ent` (needs vis|pos and height). o: {kind:'cast'|'hp', name?, color?, y?} → handle {remove()} */
  attach(ent, o) {
    this.init(); o = o || {};
    const el = document.createElement('div'); el.className = 'wbar';
    el.innerHTML = '<div class="n"></div><div class="b"><i></i></div>';
    if (o.color) el.style.setProperty('--wc', o.color);
    this.root.appendChild(el);
    const h = { ent, kind: o.kind || 'cast', el, name: el.firstChild, fill: el.lastChild.firstChild, y: o.y, label: o.name || '', last: -1, on: false, lastName: null, lastCls: '',
      remove: () => { el.remove(); const i = this.list.indexOf(h); if (i >= 0) this.list.splice(i, 1); } };
    this.list.push(h);
    return h;
  },
  update() {
    const top = this.list.length ? Callouts.barBottom() + 4 : 0;   // never draw over the boss bar / epithet / cast bar
    for (const h of this.list) {
      const e = h.ent, pos = e.vis || e.pos;
      let show = !!(e.alive !== false && pos) && !CamRig.rail;
      let frac = 0, name = h.label, cls = '';
      if (show && h.kind === 'cast') { const c = e.cast; show = !!c; if (c) { frac = c.t / c.dur; name = c.name; cls = c.interruptible ? 'int' : ''; } }
      else if (show) { frac = e.hp / e.maxHp; cls = e.shielded ? 'shield' : ''; }
      if (show && worldToScreen(_v4.set(pos.x, (h.y != null ? h.y : (e.height || 2) + 0.8), pos.z), this._s)) {
        h.el.style.transform = 'translate3d(' + this._s.x.toFixed(0) + 'px,' + Math.max(top, this._s.y).toFixed(0) + 'px,0)';
        const q = Math.round(clamp01(frac) * 500);
        if (q !== h.last) { h.last = q; h.fill.style.transform = 'scaleX(' + (q / 500) + ')'; }
        if (name !== h.lastName) { h.lastName = name; h.name.textContent = name; }
        if (cls !== h.lastCls) { h.el.classList.toggle('int', cls === 'int'); h.el.classList.toggle('shield', cls === 'shield'); h.lastCls = cls; }
        if (!h.on) { h.on = true; h.el.classList.add('on'); }
      } else if (h.on) { h.on = false; h.el.classList.remove('on'); }
    }
  },
  clear() { for (const h of this.list.slice()) h.remove(); },
};

// ---------------------------------------------------------------- BossPart (secondary entity: its own cast bar, interrupt, optional HP)
/**
 * A lightweight boss-side entity (Siren, Anchor, totem…). Inherits BossEntity's cast / interrupt / freeze /
 * status / arcane machinery. Not Game.boss: the owning Boss updates and syncs it (boss.parts list does that
 * automatically). o = {name, hp, radius, height, x, z, targetable (false), lanceable (true), invuln, castBar (true)}
 * Lance: put it in boss.lanceTargets (or return it from boss.getLanceTarget) and Stasis Lance will home on it;
 * an interruptible cast is stopped by the lance; otherwise onLanceHit / takeDamage apply.
 */
class BossPart extends BossEntity {
  constructor(owner, o) {
    o = o || {};
    super({ name: o.name || 'PART', hp: o.hp || 1000, radius: o.radius || 1, height: o.height || 3, x: o.x || 0, z: o.z || 0, index: owner ? owner.index : -1 });
    this.owner = owner; this.isPart = true;
    this.targetable = !!o.targetable; this.lanceable = o.lanceable !== false; this.invuln = !!o.invuln; this.solid = false;
    this.light = null;
    if (o.castBar !== false) this.bar = WorldBars.attach(this, { kind: 'cast' });
    if (o.hpBar) this.hpBar = WorldBars.attach(this, { kind: 'hp', name: o.name, color: o.hpColor, y: (o.height || 3) + 1.4 });
  }
  /** parts never trigger victory: they just die */
  onLethal(info) { this.alive = false; this.cast = null; if (this.onDeath) this.onDeath(info); }
  dispose() { if (this.bar) this.bar.remove(); if (this.hpBar) this.hpBar.remove(); super.dispose(); }
}

// ---------------------------------------------------------------- adds framework
/**
 * spawnBossAdd(o) — Adds.spawn plus common raid-add behaviours:
 *   o.seek: 'boss' | 'player' | null   walk toward it at o.speed (default 2.2 m/s); rooted adds stand still
 *   o.onReachBoss(a): called when a boss-seeking add touches the boss (default: +1 STOKED stack, banner)
 *   o.explodeNearBoss: {range, dmg} | true   killed by the player within range of the boss → dmg to the boss
 *   o.onReachPlayer(a): for player seekers, called on contact (the add is consumed)
 *   o.footprints: color → glowing ground prints every 0.4 s
 *   plus every Adds.spawn option (x, z, hp, radius, color, name, height, size, mesh, onSync, update, onDeath, data, dmgTakenMul)
 */
function spawnBossAdd(o) {
  const ex = o.explodeNearBoss === true ? { range: CONFIG.boss.addExplodeRange, dmg: CONFIG.boss.addExplodeDmg } : o.explodeNearBoss;
  const userUpdate = o.update, userDeath = o.onDeath;
  return Adds.spawn(Object.assign({}, o, {
    update: (a, dt) => {
      const b = Game.boss;
      if (userUpdate) userUpdate(a, dt);
      if (!a.alive || a.rootT > 0) return;
      if (o.seek === 'boss' && b && b.alive) {
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d <= b.radius + a.radius + 0.3) {
          a.alive = false; a.dieT = 0; a.reachedBoss = true;
          Particles.burst(a.hitPoint, 70, a.color, null, 6, 0.7, 0.3, 0, { intensity: 2.4 });
          if (o.onReachBoss) o.onReachBoss(a);
          else { b.addStatus('stoked', Infinity, { stacks: b.statusStacks('stoked') + 1 }); Banner.show('STOKED', '+' + Math.round(CONFIG.boss.stokedMul * 100 * b.statusStacks('stoked')) + '% boss damage', { cls: 'gold' }); sfx('explode'); }
          return;
        }
        a.pos.x += dx / d * a.speed * dt; a.pos.z += dz / d * a.speed * dt;
      } else if (o.seek === 'player' && Game.player && Game.player.alive) {
        const p = Game.player, dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z, d = Math.hypot(dx, dz) || 1;
        if (d <= a.radius + CONFIG.player.radius && o.onReachPlayer) { a.alive = false; a.dieT = 0; o.onReachPlayer(a); return; }
        a.pos.x += dx / d * a.speed * dt; a.pos.z += dz / d * a.speed * dt;
      }
      if (o.footprints != null) { a.footT += dt; if (a.footT > 0.4) { a.footT = 0; GroundFX.ring(a.pos.x, a.pos.z, 0.25, 0.9, o.footprints, 1.4, 0.18, 1.8); } }
    },
    onDeath: (a, byPlayer) => {
      const b = Game.boss;
      if (ex && byPlayer && b && b.alive && !b.invuln && dist2(a.pos.x, a.pos.z, b.pos.x, b.pos.z) - b.radius <= ex.range) {
        a.detonated = true;
        dealDamage(b, ex.dmg, { kind: 'grand', source: a.name + ' detonation' });
        Stamp.show('DETONATION', 'gold');
        GroundFX.ring(a.pos.x, a.pos.z, 0.5, ex.range + 1, 0xffc845, 0.6, 0.5, 3.2);
        Particles.line(a.hitPoint, b.hitPoint, 30, 0xffe6a0, 0xff7a2a, 0.5, 0.3, { intensity: 2.6 });
        CamRig.addTrauma(0.25);
      }
      if (userDeath) userDeath(a, byPlayer);
    },
  }));
}

// ---------------------------------------------------------------- Boss
/**
 * Base class for raid bosses. Subclass, build your model in the constructor (into this.group), and implement:
 *   ab_<id>(spec, entry)   one method per ability id used in phases[].abilities; returns busy seconds (boss won't walk or
 *                          start another `cast` ability meanwhile)
 *   sp_<id>()              one-shot specials (phases[].specials: [{atPct, id}])
 *   transition_<n>()       optional: rail def for entering phase n (events apply the outcome; skip-safe)
 *   onPhaseEnter(n, instant), onEnrage(), updateEnrage(dt), deathBeat() -> rail|null, onUpdate(dt), onSync(alpha, dt)
 * Constructor options o = {index, name?, epithet?, hp? (Normal base; scaled by difficulty), radius?, height?, x?, z?,
 *   enrage? (sec), overlapCap?, tapDmg?, tapEvery?, walkSpeed?, walkRange?, jitter? (±s, default 0.5),
 *   phases: [{ name, until (hp fraction that ENDS this phase; null = manual advancePhase()), abilities:[{id, first, every,
 *     major, cast (default true), resolveIn (s until its major hit, for the overlap cap), when?(boss)}], specials:[{atPct, id}],
 *     invuln?, targetable?, wide?, walk? (default true), melee? (default true), music? }] }
 */
class Boss extends BossEntity {
  constructor(o) {
    const B = CONFIG.bosses[o.index] || {};
    const phases = o.phases || [{ until: null, abilities: [] }];
    const th = []; for (let i = 0; i < phases.length - 1; i++) if (phases[i].until != null && phases[i].until > 0) th.push(phases[i].until);
    super({ name: o.name || B.name, epithet: o.epithet || B.epithet, index: o.index, hp: (o.hp || B.hp || 10000) * Game.diff.hp,
      radius: o.radius || B.radius, height: o.height || B.height, phaseThresholds: th,
      enrage: Game.diff.enrage ? (o.enrage != null ? o.enrage : (B.enrage || 0)) : 0, x: o.x, z: o.z });
    this.cfg = B; this.phases = phases;
    this.overlapCap = o.overlapCap != null ? o.overlapCap : (B.overlapCap || 1);
    this.tapDmg = o.tapDmg != null ? o.tapDmg : (B.tapDmg || 25); this.tapEvery = o.tapEvery || B.tapEvery || 2;
    this.walkSpeed = o.walkSpeed != null ? o.walkSpeed : CONFIG.boss.walkSpeed; this.walkRange = o.walkRange != null ? o.walkRange : CONFIG.boss.walkRange;
    this.jitter = Game.seedExplicit ? 0 : (o.jitter != null ? o.jitter : 0.5);
    this.sched = []; this.busyT = 0; this.faceLock = false; this.transitioning = false; this.enraged = false; this.dying = false;
    this.deathT = 0; this.dissolve = 0; this.epoch = 0; this.specialsDone = {}; this.lastAbility = null; this.forceNext = null; this.t = 0;
    this.lanceTargets = []; this.parts = []; this.retryable = true; this._pInv = false;
    this.shieldMesh = null; this._hits = 0;
    this.resetSchedule(0);
  }

  // ------------------------------------------------------------ queries
  get phaseDef() { return this.phases[this.phase] || this.phases[this.phases.length - 1]; }
  get windupMul() { return Game.diff.windup; }
  get free() { return this.busyT <= 0 && !this.cast && this.frozenT <= 0 && !this.transitioning && this.alive; }
  /** Game.difficulty helpers */
  get story() { return Game.difficulty === 'story'; }
  get heroic() { return Game.difficulty === 'heroic'; }

  // ------------------------------------------------------------ scheduler
  resetSchedule(n) {
    const ph = this.phases[n]; this.sched.length = 0;
    if (!ph || !ph.abilities) return;
    for (const spec of ph.abilities) {
      const first = typeof spec.first === 'function' ? spec.first(this) : (spec.first != null ? spec.first : spec.every);
      this.sched.push({ spec, t: first, postponed: 0, count: 0 });
    }
  }
  _jit() { return this.jitter > 0 ? randRange(-this.jitter, this.jitter) : 0; }
  /** fire ability `id` now (bypasses timers). Returns busy seconds. */
  trigger(id, spec) {
    const fn = this['ab_' + id];
    if (!fn) { console.warn('boss has no ability ' + id); return 0; }
    spec = spec || this._specFor(id) || { id };
    let busy = 0;
    try { busy = fn.call(this, spec, null) || 0; } catch (e) { console.error(e); }
    if (busy > 0) this.busyT = Math.max(this.busyT, busy);
    this.lastAbility = id; logEvent('ability', { id });
    return busy;
  }
  _specFor(id) { for (const e of this.sched) if (e.spec.id === id) return e.spec; for (const ph of this.phases) for (const s of (ph.abilities || [])) if (s.id === id) return s; return null; }
  runScheduler(dt) {
    if (this.forceNext && this.free) { const id = this.forceNext; this.forceNext = null; this.trigger(id); return; }
    let fired = false;
    for (const e of this.sched) {
      e.t -= dt;
      if (e.t > 0 || fired) continue;
      const s = e.spec;
      if (s.when && !s.when(this)) { e.t = 0.5; continue; }
      if (s.cast !== false && !this.free) { e.t = 0.2; continue; }
      if (s.major && e.postponed < CONFIG.boss.overlapMaxDelay) {
        const at = Game.time + (s.resolveIn || 1.5) * this.windupMul;
        if (Telegraphs.majorResolvingNear(at, CONFIG.boss.overlapWindow) >= this.overlapCap) { e.t = 0.5; e.postponed += 0.5; continue; }
      }
      e.postponed = 0; e.count++;
      const every = typeof s.every === 'function' ? s.every(this) : s.every;
      e.t = Math.max(0.5, every + this._jit());
      this.trigger(s.id, s);
      fired = true;      // at most one ability starts per step
    }
  }

  // ------------------------------------------------------------ timers that die with the phase / boss
  /** sim-time timer cancelled automatically by phase transitions and death (unless o.keep) */
  after(sec, fn, o) {
    const ep = this.epoch, keep = o && o.keep;
    return Timers.after(sec, () => { if (keep || (this.alive && this.epoch === ep && !this.transitioning)) fn(); }, { tag: 'boss', real: !!(o && o.real) });
  }

  // ------------------------------------------------------------ phases
  checkPhase() {
    const ph = this.phaseDef;
    if (this.phase < this.phases.length - 1 && ph.until != null && this.hp / this.maxHp <= ph.until) { this.goToPhase(this.phase + 1); return true; }
    return false;
  }
  /** manual advance (intermissions): goes to the next phase with its transition */
  advancePhase() { if (!this.transitioning && this.alive && this.phase < this.phases.length - 1) this.goToPhase(this.phase + 1); }
  /** start the transition into phase n: invulnerable boss + player, input frozen, telegraphs/hazards/timers cleared, rail */
  goToPhase(n, o) {
    o = o || {};
    this.epoch++; this.transitioning = true; this.invuln = true; this.cast = null; this.busyT = 0; this.forceNext = null;
    Telegraphs.clearAll(); if (!o.keepHazards) Hazards.clearAll(); Timers.cancelTag('boss');
    Game.inputLocked = true; Game.setState('transition');
    const p = Game.player; if (p && !this._pInv) { p.invulnFlags++; this._pInv = true; }
    const prev = this.phaseDef; if (prev && prev.wide) Game.forceWide = Math.max(0, Game.forceWide - 1);
    if (this.onPhaseExit) this.onPhaseExit(this.phase);
    this.phase = n;
    logEvent('phase', { phase: n });
    Audio.music.setPhase(Math.min(n, 2));
    const fn = this['transition_' + n];
    const rail = fn ? fn.call(this, o) : this.defaultTransition(n);
    if (rail) {
      const done = rail.onDone;
      rail.onDone = (skipped) => { if (done) done(skipped); this.finishTransition(n); };
      CamRig.playRail(rail);
    } else this.finishTransition(n);
  }
  finishTransition(n) {
    if (!this.transitioning || this.phase !== n) return;
    this.transitioning = false;
    const ph = this.phaseDef;
    this.invuln = !!ph.invuln; this.targetable = ph.targetable !== false;
    if (ph.wide) Game.forceWide++;
    Game.inputLocked = false; if (Game.state === 'transition') Game.setState('fight');
    const p = Game.player; if (p && this._pInv) { p.invulnFlags = Math.max(0, p.invulnFlags - 1); this._pInv = false; }
    this.resetSchedule(n);
    if (this.onPhaseEnter) this.onPhaseEnter(n, false);
    if (ph.title && !ph.titleShown) { /* titles are usually shown by the rail */ }
  }
  /** default rail: a 3.2 s orbit around the boss with a phase title */
  defaultTransition(n) {
    const ph = this.phases[n], c = this.pos;
    return CamRig.orbitRail(_v1.set(c.x, 2.5, c.z), 60, 3.2, { radius: 13, height: 6, lookUp: this.height * 0.4, roll: [0, 2, -1, 0],
      events: [{ t: 0.8, fn: () => { PhaseTitle.show(ph.title || ('PHASE ' + ['I', 'II', 'III', 'IV', 'V'][n]), ph.subtitle || ph.name || ''); Post.kickBloom(0.6, 0.8); CamRig.addTrauma(0.3); sfx('rumble', { dur: 1.4 }); } }] });
  }
  /** start the fight directly in phase n (Story "retry from phase" / tests): applies each phase's world state instantly */
  jumpToPhase(n) {
    n = clamp(n | 0, 0, this.phases.length - 1);
    for (let i = 1; i <= n; i++) { this.phase = i; if (this.onPhaseEnter) this.onPhaseEnter(i, true); }
    this.phase = n;
    const prevUntil = n > 0 ? this.phases[n - 1].until : null;
    if (prevUntil != null) this.hp = Math.round(this.maxHp * prevUntil);
    const ph = this.phaseDef; this.invuln = !!ph.invuln; this.targetable = ph.targetable !== false;
    if (ph.wide) Game.forceWide++;
    this.resetSchedule(n);
  }
  retryFromPhase() { Game.startFight(this.index, { skipIntro: true, startPhase: this.phase }); }

  // ------------------------------------------------------------ enrage
  /** default enrage: banner + unavoidable 2000/s (subclasses add visuals; call super.onEnrage()) */
  onEnrage() {
    Banner.show('ENRAGE', null, { cls: 'gold', dur: 2 });
    logEvent('enrage', {});
  }
  updateEnrage(dt) {
    const p = Game.player; this.enrageT = (this.enrageT || 0) + dt;
    if (p && p.alive && this.enrageT > 3) p.damage({ amount: 2000 * dt, source: 'Enrage', avoidable: false, tick: true, raw: true });
  }

  // ------------------------------------------------------------ lance targets (BossParts)
  /** default: interruptible-casting lanceable parts first (the one most in front of the player), else the boss */
  getLanceTarget(p) {
    let best = null, bs = -1e9;
    for (const t of this.lanceTargets) {
      if (!t || !t.alive || t.lanceable === false) continue;
      const d = dist2(p.pos.x, p.pos.z, t.pos.x, t.pos.z) - (t.radius || 0);
      if (d > CONFIG.abilities.lance.range) continue;
      const facing = Math.cos(angDiff(p.yaw, yawTo(p.pos.x, p.pos.z, t.pos.x, t.pos.z)));
      const s = facing * 10 - d * 0.2 + (t.cast && t.cast.interruptible ? 20 : 0);
      if (s > bs) { bs = s; best = t; }
    }
    if (best) return best;
    return this.alive && this.targetable !== false ? this : null;
  }
  lanceGlow() { for (const t of this.lanceTargets) if (t && t.alive && t.cast && t.cast.interruptible) return true; return false; }

  // ------------------------------------------------------------ hex shield (intermissions)
  /** show/hide a hex-grid shield sphere around the boss; hits on an invulnerable boss ripple it */
  setShield(on, o) {
    o = o || {};
    if (on && !this.shieldMesh) {
      this.shieldMat = makeHexShieldMaterial({ color: o.color != null ? o.color : 0xb266ff });
      this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.shieldMat);
      this.shieldMesh.renderOrder = 9; scene.add(this.shieldMesh);
    }
    if (this.shieldMesh) { this.shieldMesh.visible = !!on; this.shieldOn = !!on; this.shieldScale = o.scale || Math.max(this.radius * 1.9, this.height * 0.65); this.shieldMat.uniforms.uBreak.value = 0; }
  }
  onImmuneHit() {
    if (!this.shieldOn || !this.shieldMat) return;
    const p = Game.player, H = this.shieldMat.uniforms.uHits.value[this._hits++ % 8];
    H.set(p.pos.x - this.pos.x + fxRange(-0.5, 0.5), 1 + fxRange(-0.5, 1.2), p.pos.z - this.pos.z + fxRange(-0.5, 0.5), 0);
    const l = Math.hypot(H.x, H.y, H.z) || 1; H.x /= l; H.y /= l; H.z /= l;
  }

  // ------------------------------------------------------------ simulation
  update(dt) {
    this.updateCommon(dt);
    // telegraphs are clipped to the (possibly shrinking) arena edge
    const ar = Game.arena; GLOBAL_U.uArenaClip.value = ar && !ar.noClip ? (ar.clipRadius != null ? ar.clipRadius : ar.radius + 0.15) : 1e4;
    for (const pt of this.parts) if (pt.alive || pt.cast) pt.update(dt);
    if (!this.alive) { this.updateDeath(dt); return; }
    this.t += dt;
    if (this.shieldMat) for (const H of this.shieldMat.uniforms.uHits.value) H.w += dt;
    if (this.busyT > 0) this.busyT -= dt;
    // enrage
    if (!this.enraged && this.enrageAt > 0 && Game.diff.enrage && Game.fightTime >= this.enrageAt && Game.state === 'fight') { this.enraged = true; this.onEnrage(); }
    if (this.enraged) this.updateEnrage(dt);
    if (Game.state !== 'fight' || this.transitioning) { if (this.onUpdate) this.onUpdate(dt); return; }
    if (this.checkPhase()) return;
    // one-shot specials at hp %
    const ph = this.phaseDef, f = this.hp / this.maxHp;
    if (ph.specials) for (const sp of ph.specials) {
      const k = this.phase + ':' + sp.id;
      if (!this.specialsDone[k] && f <= sp.atPct) { this.specialsDone[k] = true; const fn = this['sp_' + sp.id]; if (fn) fn.call(this, sp); logEvent('special', { id: sp.id }); }
    }
    // movement + facing
    const p = Game.player;
    if (this.free && ph.walk !== false && !this.enraged) {
      this.walkToward(dt, this.walkSpeed, this.walkRange);
      this.faceLock = false;
    }
    if (!this.faceLock && this.frozenT <= 0 && p) this.faceToward(p.pos.x, p.pos.z, dt, this.cast ? 1.5 : 3.5);
    if (ph.melee !== false && !this.enraged && this.free) this.meleePressure(dt, this.tapDmg, this.tapEvery);   // no taps mid-ability
    if (this.frozenT <= 0 && !this.enraged) this.runScheduler(dt);
    if (ph.update) ph.update(this, dt);
    if (this.onUpdate) this.onUpdate(dt);
  }

  // ------------------------------------------------------------ death (§4 shared rules)
  onLethal(info) {
    if (this.dying) return;
    this.alive = false; this.dying = true; this.cast = null; this.invuln = true; this.targetable = false; this.deathT = 0; this.epoch++;
    this.transitioning = false;
    Telegraphs.clearAll(); Hazards.clearAll(); Timers.cancelTag('boss');
    for (const a of Game.adds) if (a.alive) a.kill(false);
    for (const pt of this.parts) pt.cast = null;
    Projectiles.clearHostile();
    if (this.shieldMesh) this.shieldMesh.visible = false;
    TimeFX.hitStop(CONFIG.boss.deathHitStop); TimeFX.slowMo(CONFIG.boss.deathSlow, CONFIG.boss.deathSlowDur);
    Post.kickBloom(0.45, 1.0); Post.kickCA(0.006);
    CamRig.addTrauma(0.45);
    sfx('grandShatter'); Audio.music.stop(2.5);
    Game.setState('transition'); Game.inputLocked = true;
    const p = Game.player; if (p && !this._pInv) { p.invulnFlags++; this._pInv = true; }
    logEvent('bossDeath', { boss: this.name, by: info && info.source });
    // 400 glass shards sucked into the hilt
    ShardFX.suck(this.hitPoint, CONFIG.debris.shards, Math.max(this.radius, this.height * 0.35), this.shardColor || 0x9ff8ff, Game.player.hiltWorld, { life: 5, stagger: 1.4, hold: 0.25, intensity: this.shardIntensity || 1.0 });
    Particles.burst(this.hitPoint, 200, 0xffffff, this.shardColor2 || 0x5ff2ff, 11, 1.3, 0.3, -3, { spread: this.radius, intensity: 1.8 });
    Shards.onHome = () => { if (fxRand() < 0.25) Particles.trailPoint(Game.player.hiltWorld, 0xbffbff, 0x2bd9ff, 0.3, 0.2, { intensity: 2.4 }); };
    GroundFX.ring(this.pos.x, this.pos.z, this.radius, this.radius + 10, 0xbffbff, 0.6, 0.5, 3);
    if (this.onDeathStart) this.onDeathStart(info);
    const c = this.pos;
    const rail = CamRig.orbitRail(_v1.set(c.x, this.height * 0.3, c.z), 40, 2.4, { radius: Math.max(10, this.height * 1.6), height: this.height * 0.75, lookUp: this.height * 0.25, skippable: true,
      onDone: () => this.afterShatter() });
    CamRig.playRail(rail);
  }
  afterShatter() {
    Shards.onHome = null;
    const beat = this.deathBeat ? this.deathBeat() : null;
    if (beat) {
      const done = beat.onDone;
      beat.onDone = (sk) => { if (done) done(sk); this.finishVictory(); };
      CamRig.playRail(beat);
    } else this.finishVictory();
  }
  finishVictory() {
    if (this.victoryDone) return; this.victoryDone = true;
    const p = Game.player; if (p && this._pInv) { p.invulnFlags = Math.max(0, p.invulnFlags - 1); this._pInv = false; }
    logEvent('victory', { boss: this.name });
    if (Game.onBossDefeated) Game.onBossDefeated(this);
  }
  updateDeath(dt) {
    this.deathT += dt;
    this.dissolve = Math.min(1, this.deathT / 1.4);
    if (this.onUpdate) this.onUpdate(dt);
  }

  // ------------------------------------------------------------ visuals
  syncVisual(alpha, dt) {
    super.syncVisual(alpha, dt);
    if (this.rig) this.rig.update(dt);
    for (const m of this.arcane) m.userData.arcane.uDissolve.value = this.dissolve;
    this.group.visible = this.dissolve < 0.999;
    this.bubble.visible = this.bubble.visible && this.alive;
    if (this.shieldMesh && this.shieldMesh.visible) {
      this.shieldMesh.position.set(this.vis.x, this.height * 0.5, this.vis.z);
      this.shieldMesh.scale.setScalar(this.shieldScale || 4);
      this.shieldMat.uniforms.uAlpha.value = 0.9;
    }
    for (const pt of this.parts) pt.syncVisual(alpha, dt);
    WorldBars.update();
    if (this.onSync) this.onSync(alpha, dt);
  }
  dispose() {
    for (const pt of this.parts) pt.dispose();
    WorldBars.clear();
    if (this.shieldMesh) { scene.remove(this.shieldMesh); this.shieldMesh.geometry.dispose(); this.shieldMat.dispose(); }
    const p = Game.player; if (p && this._pInv) { p.invulnFlags = Math.max(0, p.invulnFlags - 1); this._pInv = false; }
    GLOBAL_U.uArenaClip.value = 1e4;
    super.dispose();
  }
}
