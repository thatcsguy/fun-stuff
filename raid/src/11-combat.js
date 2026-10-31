// =============================================================================
//  §12  Combat — damage pipeline, DOM damage numbers, stamps / banners / phase
//       titles / hints, pooled point lights, projectiles, adds, beams, and the
//       BossEntity base class (the boss framework in 13-*.js extends it).
// =============================================================================

// ---------------------------------------------------------------- pooled point lights (always 3 in the scene → no shader recompiles)
//  [0] boss core light (boss modules own it)   [1] player blade light   [2] transient impact flashes
const PointLights = {
  lights: [], flashT: 0, flashDur: 0, flashI: 0,
  init() {
    for (let i = 0; i < CONFIG.pools.pointLights; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 1.6);
      l.position.set(0, -50, 0); scene.add(l); this.lights.push(l);
    }
  },
  get(i) { return this.lights[i]; },
  /** brief light flash at pos using light [2] */
  flash(pos, color, intensity, dur) {
    const l = this.lights[2]; l.position.copy(pos); toColor(color, l.color); l.distance = 16;
    this.flashI = intensity; this.flashDur = dur || 0.25; this.flashT = this.flashDur; l.intensity = intensity;
  },
  update(dt) {
    if (this.flashT > 0) { this.flashT -= dt; const l = this.lights[2]; l.intensity = this.flashT > 0 ? this.flashI * (this.flashT / this.flashDur) : 0; }
  },
  reset() { this.lights[0].intensity = 0; this.lights[2].intensity = 0; this.flashT = 0; },
};

// ---------------------------------------------------------------- damage pipeline (player → enemies)
/** Apply damage from the player to a target (boss, add…). info = {kind:'auto'|'skill'|'grand', source, melee}. Returns damage dealt. */
function dealDamage(t, amount, info) {
  if (!t || !t.alive) return 0;
  // the player has fallen: in-flight needles / lances must not kill the boss during the death beat or under the death card
  if (t !== Game.player && (Game.dying || (Game.player && !Game.player.alive))) return 0;
  const hp = t.hitPoint || t.pos;
  if (t.invuln) { if (t.onImmuneHit) { try { t.onImmuneHit(amount, info || {}); } catch (e) { console.error(e); } } DmgNumbers.spawn(hp, 'IMMUNE', 'small'); return 0; }
  const mul = t.dmgTakenMul != null ? t.dmgTakenMul : 1;
  const amt = Math.round(amount * mul);
  const got = t.takeDamage(amt, info || {});
  if (got > 0) {
    Game.stats.damageDealt += got;
    const k = info && info.kind;
    DmgNumbers.spawn(hp, got, k === 'grand' ? 'grand' : k === 'skill' ? 'skill' : (info && info.source === 'Second Hands' ? 'small' : ''));
  }
  return got;
}

// ---------------------------------------------------------------- DOM damage numbers (pool of 48)
const DmgNumbers = {
  pool: [], next: 0, _s: { x: 0, y: 0, z: 0 },
  init() {
    const root = $('numbers');
    for (let i = 0; i < CONFIG.pools.dmgNumbers; i++) {
      const el = document.createElement('span'); root.appendChild(el);
      this.pool.push({ el, active: false, wx: 0, wy: 0, wz: 0, age: 0, life: 1, dx: 0, big: false, lastOp: -1 });
    }
  },
  /** value: number or string; kind: '' (white auto) | 'skill' (cyan) | 'grand' (big gold) | 'taken' (red) | 'heal' (green) | 'small' */
  spawn(pos, value, kind) {
    if (Save.settings.numbers === false && kind !== 'grand') return;
    let n = null;
    for (let i = 0; i < this.pool.length; i++) { const c = this.pool[(this.next + i) % this.pool.length]; if (!c.active) { n = c; this.next = (this.next + i + 1) % this.pool.length; break; } }
    if (!n) { n = this.pool[this.next]; this.next = (this.next + 1) % this.pool.length; }
    n.active = true; n.age = 0; n.big = kind === 'grand';
    n.life = n.big ? CONFIG.ui.grandLife : CONFIG.ui.dmgNumberLife;
    n.wx = pos.x + fxRange(-0.4, 0.4); n.wy = pos.y + fxRange(-0.2, 0.3); n.wz = pos.z + fxRange(-0.4, 0.4);
    n.dx = fxRange(-1, 1) * (kind === 'taken' ? 18 : 34);
    n.el.className = kind || '';
    n.el.textContent = typeof value === 'number' ? (kind === 'heal' ? '+' + value : '' + value) : value;
    n.el.style.opacity = '0'; n.lastOp = -1;
  },
  update(dt) {
    const s = this._s;
    for (let i = 0; i < this.pool.length; i++) {
      const n = this.pool[i]; if (!n.active) continue;
      n.age += dt;
      const k = n.age / n.life;
      if (k >= 1) { n.active = false; n.el.style.opacity = '0'; continue; }
      _v4.set(n.wx, n.wy + k * 1.2, n.wz);
      if (!worldToScreen(_v4, s)) { n.el.style.opacity = '0'; continue; }
      const pop = n.big ? (k < 0.1 ? lerp(2.6, 0.95, k / 0.1) : k < 0.18 ? lerp(0.95, 1.08, (k - 0.1) / 0.08) : 1.08 - (k - 0.18) * 0.1)
        : (k < 0.12 ? lerp(1.7, 1, k / 0.12) : 1 - (k - 0.12) * 0.15);
      const x = s.x + n.dx * easeOutCubic(k), y = s.y - 26 * easeOutCubic(k) + (n.big ? -20 : 0);
      n.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + pop.toFixed(3) + ')';
      const op = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      if (Math.abs(op - n.lastOp) > 0.02) { n.el.style.opacity = op.toFixed(2); n.lastOp = op; }
    }
  },
  clear() { for (const n of this.pool) { n.active = false; n.el.style.opacity = '0'; } },
};

// ---------------------------------------------------------------- stamps / banners / phase titles / hints
function restartAnim(el, cls) { el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
const Stamp = {
  /** big italic stamp: 'SLIPSTREAM', 'INTERRUPTED', 'GRAND SHATTER', 'HARMONIZED', 'OVERHEAT'. cls: cyan|gold|violet|red */
  show(text, cls) {
    const el = $('stamp'); el.textContent = text;
    el.className = cls && cls !== 'cyan' ? cls : '';
    restartAnim(el); sfx('stamp');
  },
};
const Banner = {
  /** callout banner (Cinzel 28px, upper third). o: {cls:'gold'|'violet'|'cyan', dur (default 0.8 s visible)} */
  show(text, sub, o) {
    o = o || {};
    const el = $('banner');
    el.querySelector('.t').textContent = text; el.querySelector('.s').textContent = sub || '';
    el.className = o.cls || '';
    el.style.setProperty('--bd', ((o.dur || 0.8) + 0.4).toFixed(2) + 's');
    restartAnim(el);
  },
};
const PhaseTitle = {
  /** large letter-spaced phase title, e.g. ('PHASE II', 'PRIORITIES') */
  show(title, sub) {
    const el = $('phasetitle');
    el.querySelector('.t').textContent = title; el.querySelector('.s').textContent = sub || '';
    restartAnim(el);
  },
};
const Hint = {
  t: 0, castEnt: null, castName: '',
  /** one-line hint above the player HUD. id (optional) shows once per save.
   *  castEnt + castName (optional): a hint about that cast — it leaves 0.5 s after the cast ends, so it never sits over the next cast */
  show(text, dur, id, castEnt, castName) {
    if (id && Save.seenHint(id)) return;
    const el = $('hint'); el.textContent = text; el.classList.add('on'); this.t = dur || 4;
    this.castEnt = castEnt || null; this.castName = castName || '';
  },
  update(dt) {
    const e = this.castEnt;
    if (e && (!e.cast || e.cast.name !== this.castName)) { this.castEnt = null; this.t = Math.min(this.t, 0.5); }
    if (this.t > 0) { this.t -= dt; if (this.t <= 0) $('hint').classList.remove('on'); }
  },
  hide() { this.t = 0; this.castEnt = null; $('hint').classList.remove('on'); },
};

// ---------------------------------------------------------------- beams (pooled horizontal light blades)
const Beams = {
  pool: null, list: [],
  init() {
    const g1 = new THREE.PlaneGeometry(1, 1); g1.rotateX(-Math.PI / 2); g1.translate(0, 0, 0.5);
    const g2 = new THREE.PlaneGeometry(1, 1); g2.rotateX(-Math.PI / 2); g2.rotateZ(Math.PI / 2); g2.translate(0, 0, 0.5);
    this.pool = new Pool(4, () => {
      const mat = makeBeamMaterial({ color: 0xfff0c8, intensity: 4, len: 20, scroll: 6 });
      const grp = new THREE.Group(); grp.add(new THREE.Mesh(g1, mat)); grp.add(new THREE.Mesh(g2, mat));
      grp.visible = false; grp.renderOrder = 9; scene.add(grp);
      return { grp, mat, t: 0, dur: 0.4 };
    });
  },
  /** flash a beam from (x,y,z) along yaw, length len, width w */
  flash(x, y, z, yaw, len, w, color, dur) {
    const b = this.pool.get(); if (!b) return null;
    b.grp.position.set(x, y, z); b.grp.rotation.set(0, yaw, 0); b.grp.scale.set(w, w, len);
    toColor(color, b.mat.uniforms.uColor.value); b.mat.uniforms.uLen.value = len; b.mat.uniforms.uAlpha.value = 1;
    b.t = 0; b.dur = dur || 0.4; b.grp.visible = true; this.list.push(b);
    return b;
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i]; b.t += dt;
      const k = b.t / b.dur;
      b.mat.uniforms.uAlpha.value = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.15) / 0.85);
      b.grp.scale.x = b.grp.scale.y * (1 + k * 0.6);
      if (k >= 1) { b.grp.visible = false; this.pool.release(b); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    }
  },
  clear() { for (const b of this.list) { b.grp.visible = false; this.pool.release(b); } this.list.length = 0; },
};

// ---------------------------------------------------------------- projectiles (pool of 64)
const PROJ_KINDS = ['needle', 'lance', 'orb'];
const Projectiles = {
  pool: null, list: [],
  init() {
    const needleG = new THREE.OctahedronGeometry(0.5, 0); needleG.scale(0.07, 0.07, 0.55);
    const lanceG = new THREE.OctahedronGeometry(0.5, 0); lanceG.scale(0.14, 0.14, 1.9);
    const lanceHead = new THREE.OctahedronGeometry(0.5, 0); lanceHead.scale(0.32, 0.32, 0.6); lanceHead.translate(0, 0, 0.9);
    const orbG = new THREE.IcosahedronGeometry(0.35, 1);
    const needleM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 2.6, 3.2) });
    const lanceM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 4.0) });
    this.pool = new Pool(CONFIG.pools.projectiles, () => {
      const grp = new THREE.Group();
      const needle = new THREE.Mesh(needleG, needleM);
      const lance = new THREE.Group(); lance.add(new THREE.Mesh(lanceG, lanceM)); lance.add(new THREE.Mesh(lanceHead, lanceM));
      const orbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1, 0.3) });
      const orb = new THREE.Mesh(orbG, orbM);
      grp.add(needle); grp.add(lance); grp.add(orb);
      grp.visible = false; scene.add(grp);
      return { grp, vis: { needle, lance, orb }, orbM, active: false, kind: 'needle', pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(),
        target: null, speed: 10, homing: false, friendly: true, dmg: 0, radius: 0.4, life: 2, onHit: null, onGround: null, source: '', trailT: 0, gravity: 0, color: new THREE.Color(), size: 1 };
    });
  },
  /** o: {kind:'needle'|'lance'|'orb', x,y,z, target?, vx,vy,vz?, speed, homing, friendly, dmg, radius, life, onHit(p,target), onGround(p), source, color, size, gravity} */
  spawn(o) {
    const p = this.pool.get(); if (!p) return null;
    p.active = true; p.kind = o.kind || 'orb';
    p.pos.set(o.x, o.y, o.z); p.prev.copy(p.pos);
    p.target = o.target || null; p.speed = o.speed || 10; p.homing = !!o.homing; p.friendly = o.friendly !== false;
    p.dmg = o.dmg || 0; p.radius = o.radius || 0.4; p.life = o.life || 3; p.onHit = o.onHit || null; p.onGround = o.onGround || null;
    p.source = o.source || 'Projectile'; p.gravity = o.gravity || 0; p.trailT = 0; p.size = o.size || 1; p.avoidable = o.avoidable !== false;
    if (o.vx != null) p.vel.set(o.vx, o.vy || 0, o.vz || 0);
    else if (p.target) { const hp = p.target.hitPoint || p.target.pos; p.vel.subVectors(hp, p.pos).normalize().multiplyScalar(p.speed); }
    else p.vel.set(0, 0, p.speed);
    toColor(o.color != null ? o.color : (p.kind === 'needle' ? 0x9ff8ff : p.kind === 'lance' ? 0xd8b8ff : 0xff7a2a), p.color);
    for (const k of PROJ_KINDS) p.vis[k].visible = k === p.kind;
    if (p.kind === 'orb') { p.orbM.color.copy(p.color).multiplyScalar(3); p.vis.orb.scale.setScalar(p.size); }
    p.grp.visible = true; p.grp.position.copy(p.pos);
    this.list.push(p);
    return p;
  },
  release(p, i) {
    p.active = false; p.grp.visible = false; this.pool.release(p);
    const L = this.list; L[i] = L[L.length - 1]; L.pop();
  },
  update(dt) {
    const pl = Game.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.prev.copy(p.pos);
      p.life -= dt;
      if (p.life <= 0) { this.release(p, i); continue; }
      const t = p.target;
      if (p.homing && t) {
        if (!t.alive) { Particles.burst(p.pos, 6, p.color, null, 2, 0.3, 0.12, 0); this.release(p, i); continue; }
        const hp = t.hitPoint || t.pos;
        _v1.subVectors(hp, p.pos); const d = _v1.length();
        if (d <= Math.max(0.5, (t.radius || 0.5) * 0.7) || d <= p.speed * dt) {
          p.pos.copy(hp);
          if (p.onHit) { try { p.onHit(p, t); } catch (e) { console.error(e); } }
          Particles.burst(hp, p.kind === 'lance' ? 30 : 8, p.color, null, p.kind === 'lance' ? 7 : 4, 0.35, p.kind === 'lance' ? 0.25 : 0.12, 0, { intensity: 2.2 });
          this.release(p, i); continue;
        }
        _v1.multiplyScalar(1 / d);
        const turn = 1 - Math.exp(-14 * dt);
        p.vel.lerp(_v2.copy(_v1).multiplyScalar(p.speed), turn);
        if (p.vel.lengthSq() < 0.01) p.vel.copy(_v1).multiplyScalar(p.speed);
        p.vel.setLength(p.speed);
      }
      p.vel.y += p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      // hostile collision with the player
      if (!p.friendly && pl && pl.alive) {
        const dx = p.pos.x - pl.pos.x, dz = p.pos.z - pl.pos.z;
        if (p.pos.y < 2.4 && dx * dx + dz * dz < (p.radius + CONFIG.player.radius) ** 2) {
          if (p.dmg) pl.damage({ amount: p.dmg, source: p.source, avoidable: p.avoidable });
          if (p.onHit) p.onHit(p, pl);
          Particles.burst(p.pos, 16, p.color, null, 4, 0.4, 0.2, -4, { intensity: 2.2 });
          this.release(p, i); continue;
        }
      }
      if (p.pos.y <= 0 && p.gravity < 0) { if (p.onGround) p.onGround(p); Particles.burst(p.pos, 14, p.color, null, 4, 0.4, 0.2, -4); this.release(p, i); continue; }
      // trail
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = p.kind === 'lance' ? 0.008 : 0.025;
        Particles.trailPoint(p.pos, p.color, p.kind === 'lance' ? 0x6a2cff : null, p.kind === 'lance' ? 0.35 : 0.22, p.kind === 'lance' ? 0.3 : (p.kind === 'orb' ? 0.35 * p.size : 0.1), { intensity: 2.2, jitter: 0.04 });
      }
    }
  },
  syncVisual(alpha) {
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      p.grp.position.lerpVectors(p.prev, p.pos, alpha);
      _v1.copy(p.grp.position).add(p.vel);
      p.grp.lookAt(_v1);
      if (p.kind === 'orb') p.vis.orb.rotation.y += 0.1;
    }
  },
  clearHostile() { for (let i = this.list.length - 1; i >= 0; i--) { const p = this.list[i]; if (!p.friendly) { Particles.burst(p.pos, 10, 0xffe6a0, null, 3, 0.4, 0.15, 0); this.release(p, i); } } },
  reset() { for (let i = this.list.length - 1; i >= 0; i--) this.release(this.list[i], i); },
};

// ---------------------------------------------------------------- adds (pool of 12)
class Add {
  constructor(i) {
    this.i = i; this.isAdd = true; this.alive = false; this.active = false;
    this.pos = new THREE.Vector3(); this.prevPos = new THREE.Vector3(); this.vis = new THREE.Vector3(); this.hitPoint = new THREE.Vector3();
    this.group = new THREE.Group(); this.group.visible = false;
    this.coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.3) });
    this.core = new THREE.Mesh(Adds.coreGeo, this.coreMat);
    this.shellMat = makeArcane({ color: 0x1a0d08, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 0.9 }, { rim: 2.0, rimColor: 0xff7a2a, key: 'add' });
    this.shell = new THREE.Mesh(Adds.shellGeo, this.shellMat);
    this.group.add(this.core); this.group.add(this.shell);
    this.blob = makeBlobShadow(1.6); this.group.add(this.blob); this.blob.position.y = 0.015;
    scene.add(this.group);
    const bar = document.createElement('div'); bar.className = 'addbar'; bar.innerHTML = '<i></i>'; $('addbars').appendChild(bar);
    this.bar = bar; this.barFill = bar.firstChild; this.lastBar = -1;
    this.color = new THREE.Color();
  }
  spawn(o) {
    this.active = true; this.alive = true; this.targetable = o.targetable !== false; this.invuln = false;
    this.name = o.name || 'Add';
    this.pos.set(o.x || 0, 0, o.z || 0); this.prevPos.copy(this.pos); this.vis.copy(this.pos);
    this.maxHp = Math.round(o.hp || 2000); this.hp = this.maxHp; this.radius = o.radius || 0.6; this.speed = o.speed != null ? o.speed : 2.2;
    this.height = o.height != null ? o.height : 1.2; this.size = o.size || 1.2; this.rootT = 0; this.flashV = 0; this.age = 0; this.trailT = 0; this.footT = 0;
    this.update_ = o.update || null; this.onDeath = o.onDeath || null; this.data = o.data || {}; this.dmgTakenMul = o.dmgTakenMul || 1;
    // optional custom visual (boss framework: anchors, crystals…) replaces the default lava-orb core + shell
    if (this.custom) { this.group.remove(this.custom); this.custom = null; }
    this.onSync = o.onSync || null;
    if (o.mesh) { this.custom = o.mesh; this.group.add(o.mesh); }
    this.core.visible = !o.mesh; this.shell.visible = !o.mesh;
    toColor(o.color != null ? o.color : 0xff7a2a, this.color);
    this.coreMat.color.copy(this.color).multiplyScalar(3);
    this.shellMat.userData.arcane.uRimColor.value.copy(this.color);
    this.core.scale.setScalar(this.size * 0.42); this.shell.scale.setScalar(this.size * 0.5);
    this.group.visible = true; this.group.scale.setScalar(0.01);
    this.shellMat.userData.arcane.uDissolve.value = 0;
    this.killedByPlayer = false;
    Particles.burst(_v1.set(this.pos.x, this.height, this.pos.z), 30, this.color, 0x331000, 4, 0.6, 0.3, 0, { intensity: 2 });
    sfx('spawn');
    return this;
  }
  takeDamage(amt, info) {
    if (!this.alive || this.invuln) return 0;
    const got = Math.min(this.hp, amt);
    this.hp -= amt; this.flashV = 1;
    if (this.hp <= 0) { this.hp = 0; this.killedByPlayer = true; this.kill(false); }
    return got;
  }
  /** kill the add (silent=true: no onDeath consequences, e.g. Zero Hour wipe still calls onDeath with byPlayer flag) */
  kill(byUlt) {
    if (!this.alive) return;
    this.alive = false; this.dieT = 0;
    if (byUlt) this.killedByPlayer = true;
    Particles.burst(this.hitPoint, 80, this.color, 0x2a0a00, 8, 0.8, 0.3, -6, { intensity: 2.6 });
    ShardFX.explode(this.hitPoint, 8, 7, this.color, { scale: 0.35 });
    PointLights.flash(this.hitPoint, this.color, 30, 0.3);
    sfx('explode');
    if (this.onDeath) { try { this.onDeath(this, this.killedByPlayer); } catch (e) { console.error(e); } }
  }
  update(dt) {
    this.prevPos.copy(this.pos);
    this.age += dt;
    if (!this.alive) { this.dieT += dt; if (this.dieT > 0.35) { this.active = false; this.group.visible = false; this.bar.classList.remove('on'); } return; }
    if (this.rootT > 0) this.rootT -= dt;
    if (this.update_) this.update_(this, dt);
    else if (this.rootT <= 0 && Game.boss && Game.boss.alive) {
      // default: walk toward the boss
      const b = Game.boss, dx = b.pos.x - this.pos.x, dz = b.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > b.radius + this.radius + 0.2) { this.pos.x += dx / d * this.speed * dt; this.pos.z += dz / d * this.speed * dt; }
    }
    this.flashV = Math.max(0, this.flashV - dt / 0.08);
    this.hitPoint.set(this.pos.x, this.height, this.pos.z);
    this.trailT -= dt;
    if (this.trailT <= 0) { this.trailT = 0.04; Particles.trailPoint(this.hitPoint, this.color, 0x401000, 0.6, 0.35 * this.size, { vy: 0.4, intensity: 1.8, jitter: 0.25 }); }
  }
  syncVisual(alpha) {
    if (!this.active) return;
    this.vis.lerpVectors(this.prevPos, this.pos, alpha);
    this.group.position.set(this.vis.x, 0, this.vis.z);
    const grow = Math.min(1, this.age / 0.35), die = this.alive ? 1 : Math.max(0.01, 1 - this.dieT / 0.35);
    this.group.scale.setScalar(easeOutBack(grow) * die);
    const bob = Math.sin(Game.realTime * 3 + this.i) * 0.15;
    this.core.position.y = this.height + bob; this.shell.position.y = this.height + bob;
    this.shell.rotation.y += 0.02; this.shell.rotation.x += 0.013;
    const fl = this.rootT > 0 ? 0.5 + 0.5 * Math.sin(Game.realTime * 20) : 0;
    this.shellMat.userData.arcane.uFlash.value = Math.max(this.flashV, fl * 0.4);
    if (this.onSync) this.onSync(this, alpha);
    this.shellMat.userData.arcane.uFlashColor.value.setRGB(fl > 0 ? 0.8 : 1, fl > 0 ? 0.6 : 1, 1);
    const pulse = 0.85 + 0.25 * Math.sin(Game.realTime * 7 + this.i * 2);
    this.coreMat.color.copy(this.color).multiplyScalar(3 * pulse);
    // hp bar (DOM)
    if (this.alive && worldToScreen(_v4.set(this.vis.x, this.height + this.size * 0.75 + 0.4, this.vis.z), DmgNumbers._s)) {
      const s = DmgNumbers._s;
      this.bar.classList.add('on');
      this.bar.style.transform = 'translate3d(' + s.x.toFixed(1) + 'px,' + s.y.toFixed(1) + 'px,0)';
      const f = this.hp / this.maxHp;
      if (Math.abs(f - this.lastBar) > 0.003) { this.barFill.style.transform = 'scaleX(' + f.toFixed(3) + ')'; this.lastBar = f; }
    } else this.bar.classList.remove('on');
  }
}
const Adds = {
  pool: [], coreGeo: null, shellGeo: null,
  init() {
    this.coreGeo = new THREE.IcosahedronGeometry(1, 2);
    this.shellGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < CONFIG.pools.adds; i++) this.pool.push(new Add(i));
  },
  /** spawn an add. o: {x,z,hp,radius,speed,color,name,height,size,update(add,dt),onDeath(add,byPlayer),targetable,data,dmgTakenMul} */
  spawn(o) {
    let a = null; for (const x of this.pool) if (!x.active) { a = x; break; }
    if (!a) { console.warn('add pool exhausted'); return null; }
    a.spawn(o); Game.adds.push(a);
    return a;
  },
  update(dt) {
    for (const a of this.pool) if (a.active) a.update(dt);
    // keep Game.adds = active adds (alive or dying)
    const L = Game.adds; let w = 0;
    for (let i = 0; i < L.length; i++) if (L[i].active) L[w++] = L[i];
    L.length = w;
  },
  syncVisual(alpha) { for (const a of this.pool) if (a.active) a.syncVisual(alpha); },
  aliveCount() { let n = 0; for (const a of Game.adds) if (a.alive) n++; return n; },
  reset() { for (const a of this.pool) { a.active = false; a.alive = false; a.group.visible = false; a.bar.classList.remove('on'); } Game.adds.length = 0; },
};

// ---------------------------------------------------------------- BossEntity — base class for every boss (and the training dummy)
/**
 * Contract used by the player, HUD, camera and __raid:
 *   name, epithet, index, pos/prevPos/vis (Vector3), yaw, radius (hit-cylinder), height, hitPoint (Vector3)
 *   hp, maxHp, alive, invuln, targetable, solid, phase (0-based), phaseThresholds ([0.6, 0.25] → HUD ticks)
 *   cast: null | {name, t, dur, interruptible}       enrageAt (fight seconds, 0 = none)
 *   dmgTakenMul (getter), dmgDealtMul (getter: STOKED), takeDamage(amt, info), interrupt(), freeze(sec)
 *   onShatter(n, grand), onZeroHour(anchorDmg, player)?, getLanceTarget(player)?, onLanceHit(player)?
 *   update(dt) [sim]  syncVisual(alpha, dt) [render]  dispose()
 * Subclasses override update(dt) and call this.updateCommon(dt) first.
 */
class BossEntity {
  constructor(o) {
    o = o || {};
    this.index = o.index != null ? o.index : -1;
    this.name = o.name || 'BOSS'; this.epithet = o.epithet || '';
    this.maxHp = Math.round(o.hp || 10000); this.hp = this.maxHp;
    this.radius = o.radius || 1.8; this.height = o.height || 5;
    this.phaseThresholds = o.phaseThresholds || []; this.phase = 0;
    this.enrageAt = o.enrage || 0;
    this.pos = new THREE.Vector3(o.x || 0, 0, o.z != null ? o.z : 0); this.prevPos = this.pos.clone(); this.vis = this.pos.clone();
    this.yaw = 0; this.prevYaw = 0; this.visYaw = 0;
    this.hitPoint = new THREE.Vector3();
    this.group = new THREE.Group(); scene.add(this.group);
    this.alive = true; this.invuln = false; this.targetable = true; this.solid = true;
    this.cast = null; this._cast = { name: '', t: 0, dur: 1, interruptible: false, onComplete: null, onInterrupt: null, data: null };
    this.frozenT = 0; this.statuses = []; this.arcane = [];
    this.flashV = 0; this.fractureV = 0; this.shatterFlashT = 0; this.shatterPeak = 1;
    this.extraTakenMul = 1; this.tapT = 0;
    this.light = PointLights.get(0);
    // grey frame-freeze bubble (Stasis Lance interrupt)
    this.bubbleMat = makeHexShieldMaterial({ color: 0xaab8c8 });
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.bubbleMat);
    this.bubble.visible = false; this.bubble.renderOrder = 9; scene.add(this.bubble);
    this.updateHitPoint();
  }
  addArcane(mat) { if (mat && mat.userData && mat.userData.arcane) this.arcane.push(mat); return mat; }
  updateHitPoint() { this.hitPoint.set(this.pos.x, this.height * 0.55, this.pos.z); }
  get hpPct() { return this.hp / this.maxHp; }
  get dmgTakenMul() {
    let m = this.extraTakenMul;
    if (this.hasStatus('harmonized')) m *= 1.2;
    if (this.hasStatus('overheat')) m *= 1.25;
    if (this.hasStatus('overexposed')) m *= 1.5;
    if (this.hasStatus('timelocked')) m *= CONFIG.abilities.lance.lockMul;     // Piercing Lance
    return m;
  }
  get dmgDealtMul() { return 1 + CONFIG.boss.stokedMul * this.statusStacks('stoked'); }

  takeDamage(amt, info) {
    if (!this.alive || this.invuln) return 0;
    const got = Math.min(this.hp, amt);
    this.hp -= amt; this.flashV = Math.max(this.flashV, info && (info.kind === "skill" || info.kind === "grand") ? 1 : 0.45);
    if (this.onDamaged) this.onDamaged(amt, info);
    if (this.hp <= 0) {
      const p = Game.player;
      if (p && !p.alive) { this.hp = 1; return got; }   // any other lethal path (DoT ticks…) after the player fell: one outcome only
      this.hp = 0; this.onLethal(info);
    }
    return got;
  }
  /** default lethal handling: subclasses / the framework override for death cinematics */
  onLethal(info) {
    this.alive = false; this.cast = null;
    logEvent('victory', { boss: this.name });
    if (Game.onBossDefeated) Game.onBossDefeated(this);
  }
  setHpPct(p) { this.hp = Math.max(1, Math.round(this.maxHp * clamp01(p))); }

  // ---- casting
  /** start a cast bar. dur is scaled by difficulty windup unless o.raw. o: {interruptible, onComplete(c), onInterrupt(c), data, sting(bool), stingF} */
  startCast(name, dur, o) {
    o = o || {};
    const c = this._cast;
    c.name = name; c.t = 0; c.dur = Math.max(0.1, dur * (o.raw ? 1 : Game.diff.windup)); c.interruptible = !!o.interruptible;
    c.onComplete = o.onComplete || null; c.onInterrupt = o.onInterrupt || null; c.data = o.data || null;
    this.cast = c;
    if (c.interruptible) { Game.stats.interruptChances++; if (Game.player) HUD.flashButton('lance'); }
    if (o.sting !== false) sfx('castSting', { f: o.stingF || (c.interruptible ? 247 : 196) });
    return c;
  }
  cancelCast() { this.cast = null; }
  /** Stasis Lance entry point. Returns true if an interruptible cast was stopped. */
  interrupt() {
    const c = this.cast;
    if (!c || !c.interruptible) return false;
    this.cast = null;
    if (c.onInterrupt) { try { c.onInterrupt(c); } catch (e) { console.error(e); } }
    this.freeze(CONFIG.abilities.lance.freeze);
    return true;
  }
  freeze(sec) { this.frozenT = Math.max(this.frozenT, sec); this.addStatus('frozen', sec); }
  onShatter(n, grand) { this.shatterFlashT = grand ? 0.4 : 0.25; this.shatterPeak = grand ? 2.0 : 1.3; if (grand) this.flashV = 1; }

  // ---- statuses (Stoked, Harmonized, Overheat, Overexposed, Frozen)
  addStatus(id, dur, o) {
    o = o || {};
    let s = null; for (const x of this.statuses) if (x.id === id) { s = x; break; }
    if (!s) { s = { id, t: 0, dur: 0, stacks: 0 }; this.statuses.push(s); }
    s.t = 0; s.dur = dur != null ? dur : Infinity; s.stacks = o.stacks != null ? o.stacks : s.stacks + 1;
    return s;
  }
  removeStatus(id) { for (let i = this.statuses.length - 1; i >= 0; i--) if (this.statuses[i].id === id) this.statuses.splice(i, 1); }
  hasStatus(id) { for (const s of this.statuses) if (s.id === id) return true; return false; }
  statusStacks(id) { for (const s of this.statuses) if (s.id === id) return s.stacks; return 0; }

  // ---- per-step helpers
  updateCommon(dt) {
    this.prevPos.copy(this.pos); this.prevYaw = this.yaw;
    for (let i = this.statuses.length - 1; i >= 0; i--) { const s = this.statuses[i]; s.t += dt; if (s.t >= s.dur) this.statuses.splice(i, 1); }
    if (this.frozenT > 0) this.frozenT -= dt;
    else if (this.cast) {
      const c = this.cast; c.t += dt;
      if (c.t >= c.dur) { this.cast = null; if (c.onComplete) { try { c.onComplete(c); } catch (e) { console.error(e); } } }
    }
    this.flashV = Math.max(0, this.flashV - dt / CONFIG.boss.flashDecay);
    if (this.shatterFlashT > 0) this.shatterFlashT -= dt;
    this.updateHitPoint();
  }
  get frozen() { return this.frozenT > 0; }
  /** walk toward the player at 2 m/s when further than `stop` (default 5 m) and not casting */
  walkToward(dt, speed, stop) {
    const p = Game.player; if (!p || this.cast || this.frozenT > 0) return;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    const st = (stop != null ? stop : CONFIG.boss.walkRange) + this.radius;
    if (d > st) { const s = Math.min(d - st, (speed || CONFIG.boss.walkSpeed) * dt); this.pos.x += dx / d * s; this.pos.z += dz / d * s; }
    const R = Game.arena ? Game.arena.radius - this.radius - 0.5 : 1e9, r0 = Math.hypot(this.pos.x, this.pos.z);
    if (r0 > R) { this.pos.x *= R / r0; this.pos.z *= R / r0; }
  }
  faceToward(x, z, dt, rate) { this.yaw = angDamp(this.yaw, yawTo(this.pos.x, this.pos.z, x, z), rate || 4, dt); }
  /** constant pressure: weak melee tap when the player is within range */
  meleePressure(dt, dmg, every, range) {
    const p = Game.player; if (!p || !p.alive || this.frozenT > 0) return;
    const d = dist2(p.pos.x, p.pos.z, this.pos.x, this.pos.z) - this.radius;
    if (d <= (range || CONFIG.boss.tapRange)) {
      this.tapT -= dt;
      if (this.tapT <= 0) { this.tapT = every; p.damage({ amount: dmg, source: 'Melee', avoidable: false }); sfx('tap'); }
    } else this.tapT = Math.min(this.tapT, 0.6);
  }
  /** apply flash / fracture / dissolve uniforms to registered arcane materials (call in syncVisual) */
  applyArcane(dt) {
    const p = Game.player;
    const target = p ? p.fractures / CONFIG.player.fractureMax : 0;
    this.fractureV = damp(this.fractureV, target, 10, dt);
    let fr = this.fractureV;
    if (this.shatterFlashT > 0) fr = this.shatterPeak * (this.shatterFlashT / (this.shatterPeak > 1.5 ? 0.4 : 0.25));
    const flick = p && p.fractures > 0 && p.fractureT < CONFIG.player.fractureFlicker ? (Math.sin(Game.realTime * 30) > 0 ? 1 : 0.4) : 1;
    for (const m of this.arcane) {
      const u = m.userData.arcane;
      u.uFlash.value = this.flashV * 0.9;
      u.uFracture.value = fr * (this.shatterFlashT > 0 ? 1 : flick);
    }
  }
  syncVisual(alpha, dt) {
    this.vis.lerpVectors(this.prevPos, this.pos, alpha);
    this.visYaw = angLerp(this.prevYaw, this.yaw, alpha);
    this.group.position.copy(this.vis);
    this.group.rotation.y = this.visYaw;
    this.applyArcane(dt);
    // freeze bubble
    if (this.frozenT > 0) {
      this.bubble.visible = true;
      this.bubble.position.set(this.vis.x, this.height * 0.5, this.vis.z);
      const s = Math.max(this.radius * 1.6, this.height * 0.62); this.bubble.scale.setScalar(s);
      this.bubbleMat.uniforms.uAlpha.value = Math.min(1, this.frozenT / 0.15) * 0.9;
    } else this.bubble.visible = false;
  }
  update(dt) { this.updateCommon(dt); }
  dispose() {
    const kill = (o) => { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material) { const ms = Array.isArray(c.material) ? c.material : [c.material]; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } } }); };
    scene.remove(this.group); kill(this.group);
    scene.remove(this.bubble); kill(this.bubble);
    if (this.light) this.light.intensity = 0;
  }
}
