// Combat: telegraphed hazards (ground decals), bullets, entities, casts, and the boss runtime with phases.

// ---------- hazards ----------
const Hz = (() => {
  const list = [], free = [];
  const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-PI / 2); geo.userData.shared = true;
  const VERT = 'uniform float uBound; varying vec2 vP; void main(){ vP=position.xz*uBound; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }';
  const FRAG = `
    uniform int uType; uniform float uR1,uR0,uArc,uLen,uW,uProg,uFire,uStyle,uTime,uAlpha,uBound; uniform vec3 uCol; varying vec2 vP;
    void main(){
      float len=length(vP), d, f;
      if (uType==0){ d=len-uR1; f=len/max(uR1,1e-3); }
      else if (uType==1){ d=max(len-uR1,uR0-len); f=(len-uR0)/max(uR1-uR0,1e-3); }
      else if (uType==2){ float an=abs(atan(vP.x,vP.y+1e-5)); d=max(max(len-uR1,uR0-len),(an-uArc*0.5)*max(len,0.3)); f=(len-uR0)/max(uR1-uR0,1e-3); }
      else { d=max(abs(vP.x)-uW*0.5,max(-vP.y,vP.y-uLen)); f=vP.y/max(uLen,1e-3); }
      if (d>0.2) discard;
      float edge=smoothstep(-0.22,-0.02,d)*(1.0-smoothstep(0.0,0.06,d));
      float inside=1.0-smoothstep(-0.02,0.0,d);
      float fill=(uStyle<0.5) ? step(f,uProg) : 0.0;
      float front=(uStyle<0.5) ? (1.0-smoothstep(0.0,0.06,abs(f-uProg)))*step(uProg,0.999) : 0.0;
      float pulse=0.5+0.5*sin(uTime*9.0);
      float a=inside*(0.13+0.25*fill+0.1*pulse*smoothstep(0.75,1.0,uProg))+edge*0.9+front*0.45*inside;
      if (uStyle>0.5 && uStyle<1.5){ a=inside*(0.16+0.07*sin(uTime*3.0+len*1.5))+edge*0.8; }
      if (uStyle>1.5){ float st=0.5+0.5*sin((vP.x+vP.y)*3.0-uTime*4.0); a=inside*(0.12+0.16*st)+edge*0.9; }
      // very large shapes (arena-wide novas) get a lighter interior so they don't flood the frame; the edge stays bright
      a-=inside*(a-edge*0.9-front*0.45*inside)*0.45*smoothstep(7.0,16.0,uBound);
      vec3 col=mix(uCol,vec3(1.0),uFire*0.7)*(1.0+uFire*3.0+edge*0.8+front);
      a=clamp(a+uFire*inside*0.7,0.0,1.0)*uAlpha;
      // premultiplied: rgb adds light, alpha dims what is behind. A dark rim just outside the edge and a light dim inside keep
      // the shape readable on bright floors and through bloom.
      float rim=smoothstep(0.2,0.04,d)*step(0.0,d);
      float dim=clamp((rim*0.55+inside*0.22)*uAlpha*(1.0-uFire),0.0,0.85);
      gl_FragColor=vec4(max(col*a,vec3(0.0)),dim);
    }`;
  function getMesh() {
    let m = free.pop();
    if (!m) {
      m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        uniforms: { uType: { value: 0 }, uR1: { value: 1 }, uR0: { value: 0 }, uArc: { value: 1 }, uLen: { value: 1 }, uW: { value: 1 }, uProg: { value: 0 }, uFire: { value: 0 }, uStyle: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 1 }, uBound: { value: 1 }, uCol: { value: new THREE.Color() } },
        vertexShader: VERT, fragmentShader: FRAG.replace(/vP\.y/g, 'vP.y'), transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
      m.renderOrder = 10; m.material.userData.shared = true; FX.root.add(m);
    }
    m.visible = true; return m;
  }
  const TYPE = { circle: 0, donut: 1, cone: 2, rect: 3 };
  function inShape(s, x, z) {
    const dx = x - s.x, dz = z - s.z;
    switch (s.type) {
      case 'circle': return dx * dx + dz * dz <= s.r * s.r;
      case 'donut': { const d = dx * dx + dz * dz; return d <= s.r1 * s.r1 && d >= s.r0 * s.r0; }
      case 'cone': { const d = Math.hypot(dx, dz); if (d > s.r || d < (s.r0 || 0)) return false; return Math.abs(angDiff(s.dir, Math.atan2(dx, dz))) <= s.arc / 2; }
      case 'rect': { const fx = Math.sin(s.dir), fz = Math.cos(s.dir), along = dx * fx + dz * fz, side = dx * fz - dz * fx; return along >= 0 && along <= s.len && Math.abs(side) <= s.w / 2; }
    }
    return false;
  }
  function syncMesh(h) {
    const s = h.shape, m = h.mesh, u = m.material.uniforms;
    u.uType.value = TYPE[s.type];
    let bound = 1;
    if (s.type === 'circle') { u.uR1.value = s.r; bound = s.r + 0.3; }
    else if (s.type === 'donut') { u.uR1.value = s.r1; u.uR0.value = s.r0; bound = s.r1 + 0.3; }
    else if (s.type === 'cone') { u.uR1.value = s.r; u.uR0.value = s.r0 || 0; u.uArc.value = s.arc; bound = s.r + 0.3; }
    else { u.uLen.value = s.len; u.uW.value = s.w; bound = Math.max(s.len, s.w) + 0.3; }
    u.uBound.value = bound; m.scale.setScalar(bound); m.position.set(s.x, (G.arena ? G.arena.floorY || 0 : 0) + 0.05 + (h.lift || 0), s.z); m.rotation.y = s.dir || 0;
  }
  // The shader's local frame: x = right of dir, y(vP.y) = along dir. PlaneGeometry rotated flat maps local +Z to -vP.y, so flip here.
  function add(shape, delay, dmg, o = {}) {
    const h = Object.assign({ shape, delay, t: 0, dmg, blockable: true, color: (G.boss && G.boss.def.telegraph) || 0xff5a2a, tag: 'phase', state: 'tele', fireT: 0, dur: 0, style: 0, alpha: 1 }, o);
    if (!G.headless) { h.mesh = getMesh(); const u = h.mesh.material.uniforms; u.uCol.value.set(h.color); u.uStyle.value = h.style; u.uProg.value = 0; u.uFire.value = 0; u.uAlpha.value = h.alpha; syncMesh(h); }
    list.push(h); if (!h.silent && delay > 0.25) Sound.sfx('warn', 0.6);
    return h;
  }
  function release(h) { if (h.mesh) { h.mesh.visible = false; free.push(h.mesh); h.mesh = null; } h.state = 'done'; }
  function fire(h) {
    const p = G.player, s = h.shape;
    h.state = 'fired'; h.fireT = 0.28;
    if (h.onFire) h.onFire(h);
    else if (!h.quiet) {
      if (s.type === 'circle') { FX.burst(s.x, 0.3, s.z, { n: 10 + s.r * 4, color: h.color, speed: [2, 7 + s.r], life: [0.3, 0.8], size: [0.2, 0.5], radius: s.r * 0.7, up: 3 }); FX.light(s.x, 2, s.z, h.color, 30 + s.r * 8, 0.35, 10 + s.r * 3); }
      Sound.sfx(h.sfx || 'boom', Math.min(1, 0.35 + (h.dmg || 100) / 600)); FX.shake(Math.min(0.5, (h.dmg || 100) / 900));
    }
    if (p && p.alive && h.dmg !== 0 && inShape(s, p.pos.x, p.pos.z) !== !!h.invert) {
      let kb = null;
      if (h.kb) { const a = h.kb.dir !== undefined ? h.kb.dir : angTo(h.kb.x === undefined ? s.x : h.kb.x, h.kb.z === undefined ? s.z : h.kb.z, p.pos.x, p.pos.z); kb = { dir: a, dist: h.kb.dist }; }
      const taken = p.hurt(h.dmg, { blockable: h.blockable, kb, src: h });
      if (h.onHit) h.onHit(h, taken);
    } else if (h.onMiss) h.onMiss(h);
  }
  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const h = list[i];
      if (h.state === 'done') { list.splice(i, 1); continue; }
      h.t += dt;
      if (h.state === 'tele') {
        if (h.track && h.delay - h.t > (h.lock === undefined ? 0.5 : h.lock)) { h.track(h.shape, h); if (h.mesh) syncMesh(h); }
        if (h.mesh) { const u = h.mesh.material.uniforms; u.uProg.value = sat(h.t / h.delay); u.uTime.value = G.now; }
        if (h.t >= h.delay) { if (h.dur > 0) { h.state = 'zone'; h.zt = 0; h.tickT = 0; if (h.mesh) h.mesh.material.uniforms.uStyle.value = h.zoneStyle || 2; if (h.onFire) h.onFire(h); } else fire(h); }
      } else if (h.state === 'fired') {
        h.fireT -= dt; if (h.mesh) { h.mesh.material.uniforms.uFire.value = sat(h.fireT / 0.28); h.mesh.material.uniforms.uAlpha.value = sat(h.fireT / 0.2) * h.alpha; }
        if (h.fireT <= 0) { release(h); list.splice(i, 1); }
      } else if (h.state === 'zone') {
        h.zt += dt; h.tickT -= dt;
        if (h.track) { h.track(h.shape, h); if (h.mesh) syncMesh(h); }
        if (h.mesh) { h.mesh.material.uniforms.uTime.value = G.now; h.mesh.material.uniforms.uAlpha.value = Math.min(1, (h.dur - h.zt) * 2) * h.alpha; }
        const p = G.player;
        if (h.tickT <= 0 && p && p.alive && h.dmg && inShape(h.shape, p.pos.x, p.pos.z)) { h.tickT = h.every || 0.5; p.hurt(h.dmg, { blockable: false, src: h, dot: true }); if (h.onHit) h.onHit(h); }
        if (h.zt >= h.dur) { release(h); list.splice(i, 1); }
      }
    }
  }
  const api = {
    list, inShape,
    circle: (x, z, r, delay, dmg, o) => add({ type: 'circle', x, z, r }, delay, dmg, o),
    donut: (x, z, r0, r1, delay, dmg, o) => add({ type: 'donut', x, z, r0, r1 }, delay, dmg, o),
    cone: (x, z, dir, arc, r, delay, dmg, o) => add({ type: 'cone', x, z, dir, arc, r, r0: (o && o.r0) || 0 }, delay, dmg, o),
    rect: (x, z, dir, len, w, delay, dmg, o) => add({ type: 'rect', x, z, dir, len, w }, delay, dmg, o),
    // persistent damaging area: zone(shape, dur, dmgPerTick, {every, delay (arming time), color})
    zone: (shape, dur, dmg, o = {}) => add(shape, o.delay || 0.6, dmg, Object.assign({ dur, every: 0.5, quiet: true, silent: true }, o)),
    // purely visual marker (safe spots, soak markers): mark(shape, dur, {color, style: 1})
    mark: (shape, dur, o = {}) => add(shape, 0.01, 0, Object.assign({ dur, style: 1, zoneStyle: 1, quiet: true, silent: true }, o)),
    cancel(h) { if (h && h.state !== 'done') release(h); },
    clear(tag) { for (const h of list) if (!tag || h.tag === tag) release(h); },
    sync: syncMesh,
    // Autopilot query: how soon will (x,z) be hit? Returns seconds until the earliest hit there, or Infinity.
    threat(x, z) { let best = Infinity; for (const h of list) { if (h.state === 'done' || h.state === 'fired' || !h.dmg) continue; if (inShape(h.shape, x, z) === !!h.invert) continue; const t = h.state === 'zone' ? 0 : h.delay - h.t; if (t < best) best = t; } return best; },
    // true when (x,z) sits in a lingering damage zone, armed or still arming
    persist(x, z) { for (const h of list) if (h.dmg && h.dur > 0 && (h.state === 'zone' || h.state === 'tele') && inShape(h.shape, x, z)) return true; return false; },
    update,
  };
  Hooks.step.push(update);
  return api;
})();

// ---------- bullets ----------
const Bul = (() => {
  const MAX = 700, list = [];
  // core: white-hot centre fading to the bullet colour at the rim; tail: additive streak stretched along the velocity
  const BULV = `varying vec3 vC; varying float vF;
    void main(){ vC = instanceColor; mat4 mw = modelMatrix * instanceMatrix; vec4 wp = mw * vec4(position, 1.0);
      vec3 n = mat3(mw) * normal; n /= max(length(n), 1e-5); vec3 v = cameraPosition - wp.xyz; v /= max(length(v), 1e-5);
      vF = clamp(dot(n, v), 0.0, 1.0); gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const BULF = `varying vec3 vC; varying float vF; void main(){ float k = pow(vF, 2.5); gl_FragColor = vec4(mix(vC * 1.25, vec3(1.25) + vC * 0.55, k), 1.0); }`;
  const g = new THREE.SphereGeometry(1, 12, 9), mesh = new THREE.InstancedMesh(g, new THREE.ShaderMaterial({ vertexShader: BULV, fragmentShader: BULF }), MAX);
  const tail = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }), MAX);
  const Q = new THREE.Quaternion(), YAX = new THREE.Vector3(0, 1, 0), TP = new THREE.Vector3(), TS = new THREE.Vector3();
  const dg = new THREE.CircleGeometry(1, 16); dg.rotateX(-PI / 2);
  const disc = new THREE.InstancedMesh(dg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }), MAX);
  mesh.frustumCulled = disc.frustumCulled = tail.frustumCulled = false; mesh.count = disc.count = tail.count = 0; disc.renderOrder = 9; tail.renderOrder = 12;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3); disc.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3); tail.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  FX.root.add(mesh); FX.root.add(disc); FX.root.add(tail);
  const M = new THREE.Matrix4(), col = new THREE.Color();
  // fire({x,z,dir,speed,r,dmg,color,life,y,accel,turn (rad/s homing),curve (rad/s), onUpdate(b,dt)})
  function fire(o) { if (list.length >= MAX) return null; const b = Object.assign({ y: 1.1, r: 0.38, dmg: 90, color: (G.boss && G.boss.def.telegraph) || 0xff5a2a, life: 8, speed: 8, dir: 0, t: 0, accel: 0, turn: 0, curve: 0, tag: 'phase' }, o); list.push(b); return b; }
  function ringOf(x, z, n, speed, o = {}, offset = 0, gapAt, gapArc) { for (let i = 0; i < n; i++) { const a = offset + i / n * TAU; if (gapAt !== undefined && Math.abs(angDiff(a, gapAt)) < gapArc / 2) continue; fire(Object.assign({ x, z, dir: a, speed }, o)); } }
  function update(dt) {
    const p = G.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]; b.t += dt;
      if (b.turn && p) b.dir = b.dir + clamp(angDiff(b.dir, angTo(b.x, b.z, p.pos.x, p.pos.z)), -b.turn * dt, b.turn * dt);
      if (b.curve) b.dir += b.curve * dt;
      if (b.accel) b.speed = Math.max(0, b.speed + b.accel * dt);
      if (b.onUpdate) b.onUpdate(b, dt);
      b.x += Math.sin(b.dir) * b.speed * dt; b.z += Math.cos(b.dir) * b.speed * dt;
      let dead = b.t >= b.life || b.dead;
      if (!dead && p && p.alive && b.t > 0.08) { const d = Math.hypot(p.pos.x - b.x, p.pos.z - b.z); if (d < b.r + 0.4 && p.pos.y < b.y + 1.2) { p.hurt(b.dmg, { blockable: true, src: b }); FX.impact(b.x, b.y, b.z, b.color, 0.6); dead = true; } }
      if (!dead && G.arena && G.arena.bulletBounds && !G.arena.bulletBounds(b.x, b.z)) dead = true;
      if (dead) { list[i] = list[list.length - 1]; list.pop(); }
    }
    if (G.headless) return;
    const n = list.length; mesh.count = disc.count = tail.count = n;
    for (let i = 0; i < n; i++) {
      const b = list[i], s = b.r * (b.t < 0.15 ? b.t / 0.15 : 1);
      M.makeScale(s, s, s); M.setPosition(b.x, b.y, b.z); mesh.setMatrixAt(i, M);
      M.makeScale(s * 1.5, 1, s * 1.5); M.setPosition(b.x, 0.06, b.z); disc.setMatrixAt(i, M);
      const tl = Math.min(4, 0.4 + b.speed * 0.09); Q.setFromAxisAngle(YAX, b.dir); TS.set(s * 0.75, s * 0.75, s * 0.75 + s * tl);
      TP.set(b.x - Math.sin(b.dir) * s * tl * 0.85, b.y, b.z - Math.cos(b.dir) * s * tl * 0.85); M.compose(TP, Q, TS); tail.setMatrixAt(i, M);
      col.set(b.color); disc.setColorAt(i, col); tail.setColorAt(i, col); mesh.setColorAt(i, col);
    }
    if (n) { mesh.instanceMatrix.needsUpdate = disc.instanceMatrix.needsUpdate = tail.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = disc.instanceColor.needsUpdate = tail.instanceColor.needsUpdate = true; }
  }
  function clear(tag) { if (!tag) list.length = 0; else for (let i = list.length - 1; i >= 0; i--) if (list[i].tag === tag) list.splice(i, 1); }
  function clearNear(x, z, r) { let n = 0; for (let i = list.length - 1; i >= 0; i--) { const b = list[i]; if (Math.hypot(b.x - x, b.z - z) < r) { FX.burst(b.x, b.y, b.z, { n: 5, color: b.color, speed: [1, 4], life: [0.2, 0.5] }); list.splice(i, 1); n++; } } return n; }
  // Autopilot query: is a bullet about to pass within `pad` of (x,z) in the next `t` seconds?
  function threat(x, z, t = 0.6, pad = 0.9) { for (const b of list) { const vx = Math.sin(b.dir) * b.speed, vz = Math.cos(b.dir) * b.speed, rx = x - b.x, rz = z - b.z, vv = vx * vx + vz * vz || 1e-6, k = clamp((rx * vx + rz * vz) / vv, 0, t); if (Math.hypot(rx - vx * k, rz - vz * k) < b.r + pad) return true; } return false; }
  Hooks.step.push(update);
  return { list, fire, ring: ringOf, clear, clearNear, threat };
})();

// ---------- entities ----------
class Ent {
  constructor(o = {}) {
    this.name = o.name || 'Enemy'; this.maxHp = this.hp = o.hp || 1000; this.radius = o.radius || 1; this.aimY = o.aimY === undefined ? 1.5 : o.aimY;
    this.pos = new V3(o.x || 0, o.y || 0, o.z || 0); this.facing = o.facing || 0; this.alive = true; this.targetable = o.targetable !== false; this.immune = false;
    this.dmgTaken = 1; this.exposed = 0; this.castState = null; this.stagger = 0; this.group = new THREE.Group(); this.isBoss = false; this.autoFace = false; this.turnRate = 6;
    this.onDamaged = o.onDamaged || null; this.onDeath = o.onDeath || null; this.updateFn = o.update || null; this.meleeY = o.meleeY || 0;
  }
  aim(out) { return out.set(this.pos.x, this.pos.y + this.aimY, this.pos.z); }
  distTo(x, z) { return Math.max(0, Math.hypot(x - this.pos.x, z - this.pos.z) - this.radius); }
  damage(amt, info = {}) {
    if (!this.alive) return 0;
    if (this.immune) { if (!G.headless && info.show !== false) FX.num(this.aim(_tv), 'IMMUNE', 'note'); return 0; }
    amt *= this.dmgTaken * (this.exposed > 0 ? 1.12 : 1) * (G.player ? G.player.dmgMul : 1);
    amt = Math.round(amt); this.hp -= amt;
    if (G.player) G.player.stats.dmg += amt;
    if (this.onDamaged) this.onDamaged(amt, info, this);
    if (!G.headless) { this.aim(_tv); _tv.x += (vrand() - 0.5) * this.radius; _tv.y += vrand() * 0.8; FX.num(_tv, String(amt), info.crit ? 'crit' : ''); }
    if (this.hp <= 0) { this.hp = 0; this.die(); }
    return amt;
  }
  die() { if (!this.alive) return; this.alive = false; this.castState = null; if (this.onDeath) this.onDeath(this); }
  // Cast bar. `yield* ent.cast({name, time, interruptible})` returns 'done' | 'interrupted' | 'dead'.
  *cast(o) {
    const cs = this.castState = { name: o.name || '', t: 0, time: o.time, int: !!o.interruptible, result: null };
    if (cs.int) Sound.sfx('charge', 0.6);
    while (cs.t < cs.time && !cs.result) { if (!this.alive) return 'dead'; cs.t += G.dt; if (o.onTick) o.onTick(cs.t / cs.time, cs); yield; }
    if (this.castState === cs) this.castState = null;
    return cs.result || 'done';
  }
  interrupt() {
    const cs = this.castState; if (!cs || !cs.int || cs.result) return false;
    cs.result = 'interrupted'; this.castState = null; this.stagger = 1.2; Sound.sfx('interrupt');
    this.aim(_tv); FX.burst(_tv.x, _tv.y, _tv.z, { n: 30, color: 0xc88bff, speed: [3, 12], life: [0.3, 0.8] }); FX.num(_tv, 'INTERRUPTED', 'note'); return true;
  }
  update(dt) {
    if (this.exposed > 0) this.exposed -= dt; if (this.stagger > 0) this.stagger -= dt;
    const p = G.player;
    if (this.autoFace && p && this.stagger <= 0) this.facing = dampAng(this.facing, angTo(this.pos.x, this.pos.z, p.pos.x, p.pos.z), this.turnRate, dt);
    if (this.updateFn) this.updateFn(this, dt);
    this.group.position.copy(this.pos); this.group.rotation.y = this.facing;
  }
}
const _tv = new V3();

class Boss extends Ent {
  constructor(def) {
    super({ name: def.name, hp: def.hp, radius: def.radius || 2, aimY: def.aimY || 2.5 });
    this.def = def; this.isBoss = true; this.phase = -1; this.nextPhase = 0; this.transitioning = false; this.enraged = false; this.state = {};
    this.P = null; // the player, set at fight start
  }
  face(x, z) { this.facing = angTo(this.pos.x, this.pos.z, x, z); }
  angToPlayer() { const p = G.player; return angTo(this.pos.x, this.pos.z, p.pos.x, p.pos.z); }
  distToPlayer() { const p = G.player; return Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z); }
  *turnTo(a, dur = 0.4) { const a0 = this.facing, d = angDiff(a0, a); let t = 0; while (t < dur) { t += G.dt; this.facing = a0 + d * smooth(t / dur); yield; } }
  *moveTo(x, z, speed = 8, o = {}) {
    while (this.alive) { const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz); if (d < 0.05) break; const s = Math.min(d, speed * G.dt); this.pos.x += dx / d * s; this.pos.z += dz / d * s; if (o.face !== false) this.facing = dampAng(this.facing, Math.atan2(dx, dz), 12, G.dt); yield; }
  }
  spawnAdd(o) {
    const a = new Ent(o); a.isAdd = true; a.def = o;
    if (o.mesh) a.group.add(o.mesh);
    a.group.position.copy(a.pos); G.world.add(a.group); G.ents.push(a);
    const userDeath = a.onDeath;
    a.onDeath = (e) => { e.aim(_tv); FX.explode(_tv.x, _tv.y, _tv.z, o.color || this.def.telegraph || 0xffffff, 3); Co.stopTag(e.tag); if (userDeath) userDeath(e); e.removeT = 0.01; };
    a.tag = 'add' + (Boss.addId = (Boss.addId || 0) + 1);
    if (o.run) Co.start(o.run(a, this), a.tag);
    return a;
  }
  goPhase(i) {
    const b = this, ph = this.def.phases[i];
    Co.stopTag('phase'); Hz.clear('phase'); Bul.clear('phase'); this.castState = null; this.phase = i; this.nextPhase = i + 1; this.transitioning = true;
    Co.start(function* () {
      if (ph.enter) { b.immune = true; yield* ph.enter(b); b.immune = false; }
      b.transitioning = false; if (ph.music !== undefined) Music.intensity(ph.music); else Music.intensity(i);
      yield* ph.run(b);
    }, 'phase');
  }
  update(dt) {
    super.update(dt);
    if (!this.alive || G.state !== 'fight') return;
    const d = this.def;
    if (!this.transitioning && this.nextPhase < d.phases.length && this.hp / this.maxHp <= d.phases[this.nextPhase].at) this.goPhase(this.nextPhase);
    if (d.enrage && G.ft > d.enrage) {
      if (!this.enraged) { this.enraged = true; this.enrageT = 0; FX.flash(0xff2010, 0.5, 1.5); Sound.sfx('roar'); }
      this.enrageT -= dt; if (this.enrageT <= 0) { this.enrageT = 2; const p = G.player; if (p && p.alive) { p.hurt(120 + (G.ft - d.enrage) * 14, { blockable: false, src: 'enrage' }); FX.flash(0xff2010, 0.3, 3); FX.ring(this.pos.x, this.pos.z, { r1: 40, color: 0xff3010, dur: 0.8 }); } }
    }
  }
}
