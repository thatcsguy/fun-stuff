// The player: procedural hero model, MMO movement, targeting, GCD/cast/cooldown engine, damage intake.
function buildHero(cls) {
  const g = new THREE.Group(), C = cls.look;
  const armor = W.mat({ color: C.armor, roughness: 0.42, metalness: 0.75 }), cloth = W.mat({ color: C.cloth, roughness: 0.9, side: THREE.DoubleSide }), skin = W.mat({ color: 0x1a1a22, roughness: 0.6 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: C.glow, emissiveIntensity: 2.2, roughness: 0.4 });
  const cap = (r, l, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 10), m);
  const add = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };
  const body = new THREE.Group(); g.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.95; body.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  add(torso, cap(0.2, 0.34, armor), 0, 0.36, 0);
  add(torso, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), armor), 0, 0.5, 0.01);
  add(torso, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.03), trim), 0, 0.45, 0.165);
  add(torso, new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 6, 20), trim), 0, 0.1, 0).rotation.x = PI / 2;
  const head = new THREE.Group(); head.position.y = 0.8; torso.add(head);
  add(head, new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), skin), 0, 0.06, 0);
  if (C.hood) { const h = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 12, 1, true), cloth), 0, 0.13, -0.03); h.rotation.x = -0.25; add(head, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), trim), 0, 0.07, 0.14); }
  else { add(head, new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 10, 0, TAU, 0, PI * 0.62), armor), 0, 0.07, 0); add(head, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.05), trim), 0, 0.07, 0.15); const cr = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 6), trim), 0, 0.3, -0.05); cr.rotation.x = -0.5; }
  const mkArm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.31, 0.62, 0); torso.add(sh);
    add(sh, new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), armor), 0, 0.02, 0).scale.set(1.15, 0.9, 1.15);
    add(sh, cap(0.065, 0.24, skin), 0, -0.2, 0);
    const el = new THREE.Group(); el.position.y = -0.36; sh.add(el);
    add(el, cap(0.06, 0.22, armor), 0, -0.15, 0);
    add(el, new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12), trim), 0, -0.06, 0).rotation.x = PI / 2;
    const hand = new THREE.Group(); hand.position.y = -0.32; el.add(hand);
    return { sh, el, hand };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  const mkLeg = (side) => {
    const hip = new THREE.Group(); hip.position.set(side * 0.12, 0, 0); hips.add(hip);
    add(hip, cap(0.085, 0.3, skin), 0, -0.24, 0);
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    add(knee, cap(0.075, 0.3, armor), 0, -0.22, 0);
    add(knee, new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.26), armor), 0, -0.44, 0.05);
    return { hip, knee };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);
  // cloak: a few hinged panels
  const cloak = []; let cp = torso;
  for (let i = 0; i < 4; i++) { const pv = new THREE.Group(); pv.position.set(0, i === 0 ? 0.66 : -0.3, i === 0 ? -0.17 : 0); cp.add(pv); const w = 0.52 + i * 0.07; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.31), cloth); m.position.y = -0.15; m.castShadow = true; pv.add(m); cloak.push(pv); cp = pv; }
  // weapon
  const weapon = new THREE.Group(); armR.hand.add(weapon);
  const glowMat = W.glow(C.glow, 3.2), wtip = new THREE.Object3D();
  if (cls.id === 'duskblade') {
    add(weapon, new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 8), skin), 0, 0, 0.02).rotation.x = PI / 2;
    add(weapon, new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), armor), 0, 0, 0.2);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.022, 1.25), W.mat({ color: 0x20202c, roughness: 0.2, metalness: 1 })); add(weapon, blade, 0, 0, 0.85);
    add(weapon, new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.03, 1.2), glowMat), 0.05, 0, 0.85); add(weapon, new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.03, 1.2), glowMat), -0.05, 0, 0.85);
    wtip.position.set(0, 0, 1.4); weapon.add(wtip);
  } else {
    add(weapon, new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 1.7, 8), W.mat({ color: 0x2a2018, roughness: 0.6 })), 0, 0.35, 0);
    const cr = add(weapon, new THREE.Mesh(new THREE.OctahedronGeometry(0.13), glowMat), 0, 1.36, 0); cr.scale.y = 1.6;
    for (let i = 0; i < 3; i++) { const p = add(weapon, new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 5, 20, PI * 1.2), armor), 0, 1.36, 0); p.rotation.set(i * 1.1, i * 2.1, 0); }
    wtip.position.set(0, 1.4, 0); weapon.add(wtip); weapon.userData.crystal = cr;
  }
  const aura = new THREE.PointLight(C.glow, 2.5, 7, 1.5); aura.position.y = 1.5; g.add(aura);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const A = { run: 0, swing: 0, swingDur: 0.28, swingKind: 0, cast: 0, guard: 0, lean: 0 };
  function update(dt, p) {
    const sp = p.moveSpeed, moving = sp > 0.5 && p.grounded;
    A.run += dt * sp * 1.55; const s = Math.sin(A.run), c = Math.cos(A.run), amt = moving ? Math.min(1, sp / 7) : 0;
    A.lean = damp(A.lean, amt, 10, dt);
    const idle = Math.sin(G.now * 1.7) * 0.02;
    hips.position.y = 0.95 + (moving ? Math.abs(c) * 0.05 : idle) - (p.dead ? 0 : 0);
    body.rotation.x = A.lean * 0.16; torso.rotation.y = -s * 0.12 * A.lean;
    legL.hip.rotation.x = -s * 0.85 * A.lean; legR.hip.rotation.x = s * 0.85 * A.lean;
    legL.knee.rotation.x = Math.max(0, c) * 1.1 * A.lean; legR.knee.rotation.x = Math.max(0, -c) * 1.1 * A.lean;
    if (!p.grounded) { legL.hip.rotation.x = -0.5; legR.hip.rotation.x = 0.3; legL.knee.rotation.x = 0.9; legR.knee.rotation.x = 0.4; }
    let lx = s * 0.6 * A.lean, rx = -s * 0.6 * A.lean, lz = 0.08, rz = -0.08, le = -0.25 - A.lean * 0.5, re = -0.25 - A.lean * 0.5;
    A.cast = damp(A.cast, p.casting ? 1 : 0, 12, dt); A.guard = damp(A.guard, p.parryT > 0 ? 1 : 0, 20, dt);
    if (cls.id === 'duskblade') { rx = lerp(rx, -0.5, 0.6); re = -0.6; weapon.rotation.set(-0.5, 0, 0); }
    else { rx = lerp(rx, -0.7, 0.8); re = -0.3; weapon.rotation.set(0.75, 0, 0); if (weapon.userData.crystal) weapon.userData.crystal.rotation.y += dt * (2 + A.cast * 10); }
    if (A.cast > 0.01) { lx = lerp(lx, -1.5 + Math.sin(G.now * 14) * 0.05, A.cast); le = lerp(le, -0.4, A.cast); rx = lerp(rx, -1.9, A.cast); re = lerp(re, -0.2, A.cast); }
    if (A.guard > 0.01) { rx = lerp(rx, -1.3, A.guard); rz = lerp(rz, 0.9, A.guard); re = lerp(re, -1.2, A.guard); }
    if (A.swing > 0) {
      A.swing -= dt; const k = 1 - Math.max(0, A.swing) / A.swingDur, e = k < 0.25 ? k / 0.25 : 1, f = Math.sin(Math.min(1, k * 1.15) * PI);
      if (A.swingKind === 0) { rx = lerp(-2.4, 0.5, smooth(e)) * f + rx * (1 - f); rz = lerp(rz, -0.5, f); torso.rotation.y += f * 0.5; }
      else if (A.swingKind === 1) { rx = -1.2; rz = lerp(1.2, -1.3, smooth(e)) * f; torso.rotation.y += lerp(-0.6, 0.7, smooth(e)) * f; }
      else if (A.swingKind === 2) { rx = lerp(0.6, -2.6, smooth(e)) * f + rx * (1 - f); torso.rotation.y -= f * 0.4; }
      else { rx = lerp(rx, -1.7, f); lx = lerp(lx, -1.7, f); re = -0.1; le = -0.1; body.rotation.x += f * 0.2; }
      re = lerp(re, -0.15, f);
    }
    armL.sh.rotation.set(lx, 0, lz); armR.sh.rotation.set(rx, 0, rz); armL.el.rotation.x = le; armR.el.rotation.x = re;
    const flap = moving ? 0.5 + Math.sin(G.now * 9) * 0.12 : 0.08 + Math.sin(G.now * 1.3) * 0.03;
    for (let i = 0; i < cloak.length; i++) cloak[i].rotation.x = (i === 0 ? 0.12 + flap * 0.7 : flap * 0.3 + Math.sin(G.now * 7 - i) * 0.06 * amt) + (p.grounded ? 0 : 0.4);
    aura.intensity = 2.5 + A.cast * 6 + (p.flashT > 0 ? 8 : 0);
  }
  return { group: g, update, anim: A, wtip, body, swing(kind = 0, dur = 0.28) { A.swing = A.swingDur = dur; A.swingKind = kind; } };
}

class Player {
  constructor(cls) {
    this.cls = cls; this.maxHp = this.hp = cls.hp || 1000; this.pos = new V3(); this.facing = 0; this.alive = true; this.radius = 0.4;
    this.vy = 0; this.grounded = true; this.falling = false; this.moveSpeed = 0; this.speed = 7; this.speedMul = 1; this.push = { x: 0, z: 0 };
    this.kb = null; this.dash = null; this.rooted = 0; this.invuln = 0; this.parryT = 0; this.shield = 0; this.shieldT = 0; this.shieldMax = 1; this.dmgMul = 1; this.dmgTakenMul = 1; this.flashT = 0;
    this.res = 0; this.resMax = cls.resource.max; this.gcd = 0; this.gcdMax = 1; this.casting = null; this.queue = -1; this.queueT = 0; this.combo = 0;
    this.target = null; this.buffs = []; this.stats = { dmg: 0, taken: 0, heals: 0 };
    this.sk = cls.skills.map((s) => ({ def: s, cd: 0, charges: s.charges || 1, uses: s.limited || Infinity }));
    this.model = buildHero(cls); this.group = this.model.group;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(cls.color).multiplyScalar(1.6), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.ring.rotation.x = -PI / 2; this.ring.renderOrder = 11; this.ring.visible = false;
    this.aimP = new V3(); this.hint = ''; this.hintT = 0; this.lastHurt = -10; this.attackFaceT = 0;
  }
  aim(out) { return (out || this.aimP).set(this.pos.x, this.pos.y + 1.2, this.pos.z); }
  hand(out) { return this.model.wtip.getWorldPosition(out || new V3()); }
  addBuff(id, dur, icon) { let b = this.buffs.find((q) => q.id === id); if (!b) { b = { id, icon }; this.buffs.push(b); } b.t = dur; b.dur = dur; return b; }
  hasBuff(id) { return this.buffs.some((q) => q.id === id && q.t > 0); }
  dropBuff(id) { const i = this.buffs.findIndex((q) => q.id === id); if (i >= 0) this.buffs.splice(i, 1); }
  gain(n) { this.res = clamp(this.res + n, 0, this.resMax); }
  heal(n) { if (!this.alive) return; const h = Math.min(this.maxHp - this.hp, n); this.hp += h; this.stats.heals += h; FX.num(this.aim(), '+' + Math.round(n), 'heal'); Sound.sfx('heal'); FX.burst(this.pos.x, 0.2, this.pos.z, { n: 30, color: 0x66ffa0, speed: [0.5, 2], up: 4, life: [0.5, 1.1], radius: 0.8 }); FX.pillar(this.pos.x, this.pos.z, { r: 1, h: 6, color: 0x40ff90, dur: 0.7 }); }
  say(text) { this.hint = text; this.hintT = 1.2; }
  inRange(s, t) { if (!s.range) return true; if (!t || !t.alive || !t.targetable) return false; return t.distTo(this.pos.x, this.pos.z) <= s.range + (s.melee ? 0 : 0); }
  // Why can't slot i be used right now? Returns '' when usable.
  block(i) {
    const st = this.sk[i], s = st.def;
    if (!this.alive || this.falling) return 'dead';
    if (this.dash || this.kb) return 'busy';
    if (st.uses <= 0) return 'spent';
    if (st.charges <= 0) return 'cd';
    if (s.gcd !== false && this.gcd > 0) return 'gcd';
    if (this.casting && (s.gcd !== false || s.cast)) return 'gcd';
    if (s.range && (!this.target || !this.target.alive)) return 'target';
    if (s.range && !this.inRange(s, this.target)) return 'range';
    if (s.usable) { const r = s.usable(this, this.target); if (r !== true) return r || 'no'; }
    return '';
  }
  press(i) {
    const why = this.block(i), st = this.sk[i]; if (!st) return;
    if (why === '') return this.begin(i);
    if (why === 'gcd' && (this.casting ? this.casting.time - this.casting.t : this.gcd) < 0.6) { this.queue = i; this.queueT = 0.7; }
    else if (why === 'range') this.say('Out of range'); else if (why === 'target') this.say('No target');
  }
  castTime(s) { return typeof s.cast === 'function' ? s.cast(this) : (s.cast || 0); }
  begin(i) {
    const st = this.sk[i], s = st.def, ct = this.castTime(s);
    this.queue = -1;
    if (s.range && this.target) { this.attackFaceT = 0.5; }
    if (s.gcd !== false) { this.gcdMax = this.gcd = this.cls.gcdOf ? this.cls.gcdOf(this, s) : this.cls.gcd; }
    if (ct > 0) { this.casting = { i, t: 0, time: ct, tgt: this.target, name: s.name }; Sound.sfx('cast', 0.7); if (s.start) s.start(this, this.target); return; }
    this.commit(i, this.target, false);
  }
  commit(i, tgt, wasCast) {
    const st = this.sk[i], s = st.def;
    if (s.limited) st.uses--;
    if (s.cd) { st.charges--; if (st.cd <= 0) st.cd = s.cd; }
    s.fire(this, tgt, wasCast);
    if (typeof UI !== 'undefined') UI.slotFlash(i);
  }
  hurt(amt, o = {}) {
    if (!this.alive || G.god || G.state !== 'fight') return 0;
    if (this.invuln > 0 && o.src !== 'fall') return 0;
    if (o.blockable && this.parryT > 0) { this.parryT = 0; this.cls.onParry(this, o); return 0; }
    amt = Math.round(amt * this.dmgTakenMul);
    if (o.kb && o.kb.dist) { const d = 0.38; this.kb = { vx: Math.sin(o.kb.dir) * o.kb.dist / d, vz: Math.cos(o.kb.dir) * o.kb.dist / d, t: d }; this.casting = null; }
    if (o.blockable && this.shield > 0) { const a = Math.min(this.shield, amt); this.shield -= a; amt -= a; if (this.cls.onAbsorb) this.cls.onAbsorb(this, a); FX.num(this.aim(), 'ABSORB', 'note'); Sound.sfx('shield', 0.8); if (amt <= 0) return 0; }
    this.hp -= amt; this.stats.taken += amt; this.lastHurt = G.now; this.flashT = 0.15;
    if (G.hitLog) G.hitLog.push(G.ft.toFixed(1) + ' ' + (o.src ? (o.src.name || (o.src.shape && o.src.shape.type) || (typeof o.src === 'string' ? o.src : 'bullet')) : '?') + ' ' + amt);
    if (!o.dot || amt > 40) { Sound.sfx('hurt', o.dot ? 0.5 : 1); FX.shake(Math.min(0.9, amt / 450)); if (typeof UI !== 'undefined') UI.hurtFlash(amt / this.maxHp); }
    FX.num(this.aim(), '-' + amt, 'hurt');
    if (this.hp <= 0) { this.hp = 0; this.die(o.src); }
    return amt;
  }
  die(src) {
    if (!this.alive) return; this.alive = false; this.casting = null; this.deathT = 0; this.deathSrc = src;
    Sound.sfx('death'); FX.burst(this.pos.x, 1, this.pos.z, { n: 40, color: this.cls.color, speed: [1, 6], life: [0.6, 1.6], up: 2 });
    if (typeof Game !== 'undefined') Game.onPlayerDead();
  }
  cycleTarget(dir = 1) {
    const L = G.ents.filter((e) => e.alive && e.targetable); if (!L.length) { this.target = null; return; }
    L.sort((a, b) => a.distTo(this.pos.x, this.pos.z) - b.distTo(this.pos.x, this.pos.z));
    const i = L.indexOf(this.target); this.target = L[(i + dir + L.length) % L.length]; Sound.sfx('ui');
  }
  pickTarget(sx, sy) {
    let best = null, bd = 1e9; const v = new V3();
    for (const e of G.ents) { if (!e.alive || !e.targetable) continue; e.aim(v).project(camera); if (v.z > 1) continue; const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight; const d = Math.hypot(px - sx, py - sy) - e.radius * 26; if (d < bd) { bd = d; best = e; } }
    if (best && bd < 110) { this.target = best; Sound.sfx('ui'); }
  }
  jump() { if (this.alive && this.grounded && !this.dash && !this.kb && this.rooted <= 0) { this.vy = 7.2; this.grounded = false; } }
  update(dt) {
    const A = G.arena;
    this.flashT -= dt; if (this.hintT > 0) this.hintT -= dt;
    if (!this.alive) { this.deathT += dt; const k = Math.min(1, this.deathT / 0.7); this.model.body.rotation.x = -k * 1.45; this.model.body.position.y = -k * 0.1; if (this.falling) { this.vy -= 30 * dt; this.pos.y += this.vy * dt; } this.group.position.copy(this.pos); this.ring.visible = false; return; }
    // timers
    if (this.gcd > 0) this.gcd -= dt; if (this.parryT > 0) this.parryT -= dt; if (this.invuln > 0) this.invuln -= dt; if (this.rooted > 0) this.rooted -= dt;
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; } else this.shield = 0;
    for (const st of this.sk) { const s = st.def; if (st.cd > 0) { st.cd -= dt; if (st.cd <= 0) { st.charges = Math.min(s.charges || 1, st.charges + 1); st.cd = st.charges < (s.charges || 1) ? s.cd : 0; } } }
    for (let i = this.buffs.length - 1; i >= 0; i--) { const b = this.buffs[i]; b.t -= dt; if (b.t <= 0) { this.buffs.splice(i, 1); if (this.cls.onBuffEnd) this.cls.onBuffEnd(this, b.id); } }
    // target upkeep
    if (!this.target || !this.target.alive || !this.target.targetable) { let best = null, bd = 1e9; for (const e of G.ents) { if (!e.alive || !e.targetable) continue; const d = e.distTo(this.pos.x, this.pos.z) - (e.isBoss ? 0 : 3); if (d < bd) { bd = d; best = e; } } this.target = best; }
    // movement intent
    let mx = 0, mz = 0;
    if (Input.bot) { mx = Input.bot.moveX; mz = Input.bot.moveZ; }
    else if (G.state === 'fight') { const f = Input.moveZ, r = Input.moveX, sy = Math.sin(Cam.yaw), cy = Math.cos(Cam.yaw); mx = sy * f - cy * r; mz = cy * f + sy * r; }
    let ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; ml = 1; }
    if (this.rooted > 0) { mx = mz = ml = 0; }
    let vx = 0, vz = 0;
    if (this.kb) { vx = this.kb.vx; vz = this.kb.vz; this.kb.t -= dt; if (this.kb.t <= 0) this.kb = null; ml = 0; }
    else if (this.dash) { const d = this.dash, k = Math.min(1, d.t / dt); vx = d.vx * k; vz = d.vz * k; d.t -= dt; if (d.t <= 0) { this.dash = null; if (d.done) d.done(this); } ml = 0; }
    else { const sp = this.speed * this.speedMul; vx = mx * sp; vz = mz * sp; }
    this.intentX = mx; this.intentZ = mz; this.moving = ml > 0.15;
    vx += this.push.x; vz += this.push.z; this.push.x = this.push.z = 0;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += vx * dt; this.pos.z += vz * dt;
    // facing
    if (!Input.bot && Input.steer && G.state === 'fight') this.facing = Cam.yaw;
    else if (this.moving && !this.kb && !this.dash) this.facing = dampAng(this.facing, Math.atan2(mx, mz), 16, dt);
    else if ((this.casting || this.attackFaceT > 0) && this.target) this.facing = dampAng(this.facing, angTo(this.pos.x, this.pos.z, this.target.pos.x, this.target.pos.z), 18, dt);
    if (this.attackFaceT > 0) this.attackFaceT -= dt;
    // arena bounds
    if (A) {
      if (this.pos.y >= -0.01 && !this.falling) {
        if (A.edge === 'fall') { if (!this.dash && !A.contains(this.pos.x, this.pos.z)) { this.offT = (this.offT || 0) + dt; if (this.offT > 0.15) { if (this.grounded) { this.grounded = false; this.vy = 0; } this.falling = this.pos.y <= 0.02; } } else this.offT = 0; }
        else A.clamp(this.pos, ox, oz);
      }
      if (A.solid) A.solid(this.pos, ox, oz);
    }
    // vertical
    if (!this.grounded || this.falling) {
      this.vy -= 22 * dt; this.pos.y += this.vy * dt;
      const floor = A && A.floorY || 0;
      if (!this.falling && this.pos.y <= floor) { if (!A || A.edge !== 'fall' || A.contains(this.pos.x, this.pos.z)) { this.pos.y = floor; this.vy = 0; this.grounded = true; } else this.falling = true; }
      if (this.falling) { this.casting = null; if (this.pos.y < -7) { this.hp = 0; this.die('fall'); } }
    }
    this.moveSpeed = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4);
    // casting
    if (this.casting) {
      const c = this.casting, s = this.sk[c.i].def;
      const canMove = s.moveCast && s.moveCast(this);
      if ((this.moving || !this.grounded || this.dash || this.kb) && !canMove) { this.casting = null; this.gcd = Math.min(this.gcd, 0.25); }
      else if (s.range && (!c.tgt || !c.tgt.alive || !c.tgt.targetable)) { this.casting = null; this.gcd = Math.min(this.gcd, 0.25); }
      else { c.t += dt; if (c.t >= c.time) { this.casting = null; this.commit(c.i, c.tgt, true); } }
    }
    // queue + hold-to-repeat
    if (this.queue >= 0) { this.queueT -= dt; if (this.queueT <= 0) this.queue = -1; else if (this.block(this.queue) === '') this.begin(this.queue); }
    else if (!Input.bot && G.state === 'fight') { for (let i = 0; i < this.sk.length; i++) if (Input.slotHeld[i] && this.sk[i].def.gcd !== false && this.block(i) === '') { this.begin(i); break; } }
    if (this.cls.update) this.cls.update(this, dt);
    // visuals
    this.group.position.copy(this.pos); this.group.rotation.y = this.facing; this.model.update(dt, this);
    const t = this.target;
    if (t && t.alive && !G.headless) { this.ring.visible = true; const r = t.radius + 0.25; this.ring.scale.setScalar(r); this.ring.position.set(t.pos.x, (A && A.floorY || 0) + 0.07 + (t.ringY || 0), t.pos.z); this.ring.rotation.z += dt * 0.6; } else this.ring.visible = false;
  }
}
