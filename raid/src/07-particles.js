// =============================================================================
//  §8  Particles & Debris
//      Particles  — one THREE.Points GPU ring buffer (6000/4000/2000 slots by tier),
//                   positions computed analytically in the vertex shader.
//      Shards / Rubble — instanced debris (400 glass shards, 120 rubble pieces)
//      RibbonTrail — additive ribbon of the last N blade-tip positions
//      GroundFX   — pooled expanding ground rings (portals, shockwaves)
//      SlashFX    — pooled sweeping crescent slashes
// =============================================================================

const Particles = {
  max: 6000, cap: 6000, head: 0, dirtyFirst: -1, dirtyCount: 0,
  points: null, geo: null, mat: null, attrs: null,
  _ca: new THREE.Color(), _cb: new THREE.Color(),

  init() {
    const N = this.max, g = new THREE.BufferGeometry();
    const mk = (name, size) => { const a = new THREE.BufferAttribute(new Float32Array(N * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.attrs = {
      pos: mk('position', 3), vel: mk('aVel', 3), t0: mk('aT0', 1), life: mk('aLife', 1),
      size: mk('aSize', 2), c1: mk('aColor', 3), c2: mk('aColor2', 3), phys: mk('aPhys', 2),
    };
    this.attrs.t0.array.fill(-1e6);
    this.attrs.life.array.fill(0.0001);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 }, uMaxSize: { value: 48 } },
      vertexShader: /* glsl */`
        attribute vec3 aVel; attribute float aT0; attribute float aLife; attribute vec2 aSize;
        attribute vec3 aColor; attribute vec3 aColor2; attribute vec2 aPhys;
        uniform float uTime; uniform float uScale; uniform float uMaxSize;
        varying vec3 vCol; varying float vA;
        void main(){
          float t = uTime - aT0;
          if (t < 0.0 || t > aLife) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vCol = vec3(0.0); return; }
          float drag = aPhys.y;
          vec3 disp = drag > 0.001 ? aVel * (1.0 - exp(-drag * t)) / drag : aVel * t;
          vec3 p = position + disp + vec3(0.0, 0.5 * aPhys.x * t * t, 0.0);
          float k = t / aLife;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float size = mix(aSize.x, aSize.y, k);
          gl_PointSize = min(size * uScale / max(-mv.z, 0.1), uMaxSize);
          gl_Position = projectionMatrix * mv;
          vCol = mix(aColor, aColor2, k);
          vA = (1.0 - k * k) * smoothstep(0.0, 0.05, k + 0.01) * smoothstep(0.8, 3.0, -mv.z);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vCol; varying float vA;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0;
          if (d > 1.0) discard;
          float soft = pow(max(1.0 - d, 0.0), 1.7);
          float core = pow(max(1.0 - d * 2.4, 0.0), 2.0);
          vec3 col = vCol * soft + vec3(1.0) * core * min(dot(vCol, vec3(0.33)), 1.5) * 0.7;
          gl_FragColor = vec4(col * vA, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    scene.add(this.points);
    Quality.onChange((tier) => { this.cap = Math.min(this.max, tier.particles); if (this.head >= this.cap) this.head = 0; });
    this.cap = Math.min(this.max, Quality.tier.particles);
    resizeListeners.push(() => this.updateScale());
    this.updateScale();
  },
  updateScale() {
    const pr = renderer.getPixelRatio();
    this._fov = camera.fov;
    this.mat.uniforms.uScale.value = View.h * pr / (2 * Math.tan(camera.fov * DEG / 2));
    this.mat.uniforms.uMaxSize.value = 34 * pr;
  },
  get now() { return Game.time; },

  /** raw emit. colors are THREE.Color (already multiplied by intensity). */
  emitRaw(px, py, pz, vx, vy, vz, life, s0, s1, ca, cb, grav, drag) {
    const i = this.head; this.head = (this.head + 1) % this.cap;
    if (this.dirtyFirst < 0) { this.dirtyFirst = i; this.dirtyCount = 0; }
    this.dirtyCount++;
    const A = this.attrs;
    A.pos.array[i * 3] = px; A.pos.array[i * 3 + 1] = py; A.pos.array[i * 3 + 2] = pz;
    A.vel.array[i * 3] = vx; A.vel.array[i * 3 + 1] = vy; A.vel.array[i * 3 + 2] = vz;
    A.t0.array[i] = this.now; A.life.array[i] = life;
    A.size.array[i * 2] = s0; A.size.array[i * 2 + 1] = s1;
    A.c1.array[i * 3] = ca.r; A.c1.array[i * 3 + 1] = ca.g; A.c1.array[i * 3 + 2] = ca.b;
    A.c2.array[i * 3] = cb.r; A.c2.array[i * 3 + 1] = cb.g; A.c2.array[i * 3 + 2] = cb.b;
    A.phys.array[i * 2] = grav || 0; A.phys.array[i * 2 + 1] = drag || 0;
  },
  _cols(colA, colB, inten) {
    toColor(colA, this._ca).multiplyScalar(inten); toColor(colB != null ? colB : colA, this._cb).multiplyScalar(inten * (colB != null ? 1 : 0.4));
  },
  /** spherical burst. o: {drag, up, spread, sizeEnd, intensity, lifeVar, flat} */
  burst(pos, n, colA, colB, speed, life, size, gravity, o) {
    o = o || {}; this._cols(colA, colB, o.intensity || 2);
    const up = o.up || 0, sp = o.spread || 0, lv = o.lifeVar != null ? o.lifeVar : 0.4, s1 = o.sizeEnd != null ? o.sizeEnd : size * 0.2;
    for (let k = 0; k < n; k++) {
      let x = fxRange(-1, 1), y = fxRange(-1, 1), z = fxRange(-1, 1); const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      if (o.flat) y *= 0.25;
      const s = speed * fxRange(0.35, 1);
      this.emitRaw(pos.x + x * sp, pos.y + y * sp, pos.z + z * sp, x * s, y * s + up, z * s, life * fxRange(1 - lv, 1), size * fxRange(0.6, 1.2), s1, this._ca, this._cb, gravity || 0, o.drag != null ? o.drag : 2.5);
    }
  },
  /** cone burst along dir (normalized Vector3). angle = half-angle radians */
  cone(pos, dir, angle, n, colA, colB, speed, life, size, gravity, o) {
    o = o || {}; this._cols(colA, colB, o.intensity || 2);
    for (let k = 0; k < n; k++) {
      // random direction inside the cone (rejection-free approximation)
      _v7.set(fxRange(-1, 1), fxRange(-1, 1), fxRange(-1, 1)).normalize().multiplyScalar(Math.tan(angle) * Math.random());
      _v7.add(dir).normalize();
      const s = speed * fxRange(0.4, 1);
      this.emitRaw(pos.x, pos.y, pos.z, _v7.x * s, _v7.y * s, _v7.z * s, life * fxRange(0.6, 1), size * fxRange(0.6, 1.2), (o.sizeEnd != null ? o.sizeEnd : size * 0.2), this._ca, this._cb, gravity || 0, o.drag != null ? o.drag : 2);
    }
  },
  /** horizontal ring of particles moving outward (speed) from radius */
  ring(pos, radius, n, colA, colB, speed, life, size, o) {
    o = o || {}; this._cols(colA, colB, o.intensity || 2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + fxRange(0, 0.2), sx = Math.sin(a), sz = Math.cos(a);
      this.emitRaw(pos.x + sx * radius, pos.y + (o.y || 0.15), pos.z + sz * radius, sx * speed, (o.up || 0) * fxRange(0.5, 1), sz * speed,
        life * fxRange(0.7, 1), size * fxRange(0.7, 1.1), o.sizeEnd != null ? o.sizeEnd : size * 0.3, this._ca, this._cb, o.gravity || 0, o.drag != null ? o.drag : 1.5);
    }
  },
  /** particles that spawn on a shell and arrive exactly at `target` at the end of their life (Zero Hour, pickups) */
  converge(target, n, radius, colA, colB, life, size, o) {
    o = o || {}; this._cols(colA, colB, o.intensity || 2.5);
    for (let k = 0; k < n; k++) {
      let x = fxRange(-1, 1), y = fxRange(-0.3, 1), z = fxRange(-1, 1); const l = Math.hypot(x, y, z) || 1;
      const r = radius * fxRange(0.4, 1); x = x / l * r; y = y / l * r; z = z / l * r;
      const lf = life * fxRange(0.55, 1);
      this.emitRaw(target.x + x, target.y + y, target.z + z, -x / lf, -y / lf, -z / lf, lf, size * fxRange(0.6, 1.3), size * 0.25, this._ca, this._cb, 0, 0);
    }
  },
  /** single drifting point (trails, embers). o: {vx,vy,vz,jitter,gravity,drag,sizeEnd,intensity} */
  trailPoint(pos, colA, colB, life, size, o) {
    o = o || {}; this._cols(colA, colB, o.intensity || 1.8);
    const j = o.jitter || 0.05;
    this.emitRaw(pos.x + fxRange(-j, j), pos.y + fxRange(-j, j), pos.z + fxRange(-j, j), (o.vx || 0) + fxRange(-0.2, 0.2), (o.vy || 0) + fxRange(-0.1, 0.3), (o.vz || 0) + fxRange(-0.2, 0.2),
      life, size, o.sizeEnd != null ? o.sizeEnd : size * 0.2, this._ca, this._cb, o.gravity || 0, o.drag != null ? o.drag : 1);
  },
  /** streak of particles along a segment (Recall reversed streak etc.) */
  line(a, b, n, colA, colB, life, size, o) {
    o = o || {}; this._cols(colA, colB, o.intensity || 2);
    for (let k = 0; k < n; k++) {
      const t = k / Math.max(1, n - 1);
      this.emitRaw(lerp(a.x, b.x, t) + fxRange(-0.15, 0.15), lerp(a.y, b.y, t) + fxRange(-0.3, 0.6), lerp(a.z, b.z, t) + fxRange(-0.15, 0.15),
        (o.vx || 0) + fxRange(-0.4, 0.4), (o.vy || 0.6) * fxRange(0.3, 1), (o.vz || 0) + fxRange(-0.4, 0.4), life * fxRange(0.5, 1) * (o.stagger ? (0.4 + 0.6 * t) : 1), size * fxRange(0.6, 1.2), size * 0.15, this._ca, this._cb, o.gravity || 0, o.drag != null ? o.drag : 2);
    }
  },

  /** upload only the slots written this frame (one or two contiguous runs). */
  flush(timeNow) {
    this.mat.uniforms.uTime.value = timeNow;
    if (camera.fov !== this._fov) this.updateScale();      // portrait FOV / rail FOVs change the projection after boot
    if (this.dirtyFirst < 0) return;
    const first = this.dirtyFirst, count = Math.min(this.dirtyCount, this.cap);
    for (const k in this.attrs) {
      const a = this.attrs[k], s = a.itemSize;
      if (first + count <= this.cap) a.addUpdateRange(first * s, count * s);
      else { a.addUpdateRange(first * s, (this.cap - first) * s); a.addUpdateRange(0, (first + count - this.cap) * s); }
      a.needsUpdate = true;
    }
    this.dirtyFirst = -1; this.dirtyCount = 0;
  },
  clear() { this.attrs.t0.array.fill(-1e6); this.attrs.t0.clearUpdateRanges(); this.attrs.t0.needsUpdate = true; this.dirtyFirst = -1; this.dirtyCount = 0; },
};

// ---------------------------------------------------------------- instanced debris
const SHARD_MAT_VS = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying vec3 vC;
  void main(){
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * wp;
    vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vV = -mv.xyz;
    #ifdef USE_INSTANCING_COLOR
      vC = instanceColor;
    #else
      vC = vec3(1.0);
    #endif
    gl_Position = projectionMatrix * mv;
  }`;
const SHARD_MAT_FS = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying vec3 vC;
  void main(){
    float fres = pow(max(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0), 2.0);
    vec3 c = vC * (0.18 + 2.2 * fres) + vec3(1.0) * pow(fres, 7.0) * 1.6 * length(vC);
    gl_FragColor = vec4(c, 1.0);
  }`;

class Debris {
  constructor(n, geo, mat, opts) {
    opts = opts || {};
    this.n = n;
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.renderOrder || 6;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, zero); this.mesh.setColorAt(i, _c1.setRGB(1, 1, 1)); }
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.F = (k) => new Float32Array(n * k);
    this.p = this.F(3); this.v = this.F(3); this.ax = this.F(3); this.rot = this.F(1); this.spin = this.F(1);
    this.sc = this.F(1); this.life = this.F(1); this.age = this.F(1); this.hold = this.F(1); this.grav = this.F(1); this.drag = this.F(1);
    this.col = this.F(3); this.mode = new Uint8Array(n); this.alive = new Uint8Array(n);
    this.active = new Int32Array(n); this.count = 0; this.head = 0;
    this.bounce = opts.bounce != null ? opts.bounce : 0.35;
    this.floorY = opts.floorY != null ? opts.floorY : 0.02;
    this.homeTarget = null;
    this.onHome = null;
    scene.add(this.mesh);
  }
  /** spawn one piece. o: {life, scale, color(hex|Color), intensity, hold, grav, drag, spin, home(bool)} */
  spawn(x, y, z, vx, vy, vz, o) {
    o = o || {};
    let i = this.head; this.head = (this.head + 1) % this.n;
    if (!this.alive[i]) { this.active[this.count++] = i; this.alive[i] = 1; }
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    let ax = fxRange(-1, 1), ay = fxRange(-1, 1), az = fxRange(-1, 1); const l = Math.hypot(ax, ay, az) || 1;
    this.ax[i * 3] = ax / l; this.ax[i * 3 + 1] = ay / l; this.ax[i * 3 + 2] = az / l;
    this.rot[i] = o.rot != null ? o.rot : fxRange(0, TAU); this.spin[i] = o.spin != null ? o.spin : fxRange(-12, 12);
    this.sc[i] = o.scale || 1; this.life[i] = o.life || 1.2; this.age[i] = 0; this.hold[i] = o.hold || 0;
    this.grav[i] = o.grav != null ? o.grav : -14; this.drag[i] = o.drag != null ? o.drag : 0.6; this.mode[i] = o.home ? 1 : 0;
    toColor(o.color != null ? o.color : 0x9ff8ff, _c1).multiplyScalar(o.intensity || 1);
    this.col[i * 3] = _c1.r; this.col[i * 3 + 1] = _c1.g; this.col[i * 3 + 2] = _c1.b;
    if (o.axis) { this.ax[i * 3] = o.axis.x; this.ax[i * 3 + 1] = o.axis.y; this.ax[i * 3 + 2] = o.axis.z; }
    return i;
  }
  /** release a held (frozen) piece early */
  release(i, vx, vy, vz) { this.hold[i] = 0; if (vx != null) { this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz; } }
  clear() { for (let k = 0; k < this.count; k++) { const i = this.active[k]; this.alive[i] = 0; this.mesh.setMatrixAt(i, _m2.makeScale(0, 0, 0)); } this.count = 0; this.mesh.instanceMatrix.needsUpdate = true; }
  update(dt) {
    if (!this.count) return;
    const P = this.p, V = this.v, home = this.homeTarget;
    for (let k = 0; k < this.count; k++) {
      const i = this.active[k];
      this.age[i] += dt;
      const age = this.age[i], life = this.life[i];
      if (age >= life) {
        this.alive[i] = 0; this.mesh.setMatrixAt(i, _m2.makeScale(0, 0, 0));
        this.active[k] = this.active[--this.count]; k--; continue;
      }
      if (this.hold[i] > 0) { this.hold[i] -= dt; }
      else if (this.mode[i] === 1 && home) {
        // steer toward the home target (boss shards sucked into the hilt)
        const dx = home.x - P[i * 3], dy = home.y - P[i * 3 + 1], dz = home.z - P[i * 3 + 2], d = Math.hypot(dx, dy, dz) || 1;
        const sp = 6 + age * 26, k2 = 1 - Math.exp(-5 * dt);
        V[i * 3] += (dx / d * sp - V[i * 3]) * k2; V[i * 3 + 1] += (dy / d * sp - V[i * 3 + 1]) * k2; V[i * 3 + 2] += (dz / d * sp - V[i * 3 + 2]) * k2;
        P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
        if (d < 0.45) { this.age[i] = life; if (this.onHome) this.onHome(i); }
      } else {
        const dr = Math.exp(-this.drag[i] * dt);
        V[i * 3] *= dr; V[i * 3 + 2] *= dr; V[i * 3 + 1] = V[i * 3 + 1] * dr + this.grav[i] * dt;
        P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
        if (P[i * 3 + 1] < this.floorY && this.grav[i] < 0) {
          P[i * 3 + 1] = this.floorY; V[i * 3 + 1] = -V[i * 3 + 1] * this.bounce; V[i * 3] *= 0.6; V[i * 3 + 2] *= 0.6; this.spin[i] *= 0.5;
        }
        this.rot[i] += this.spin[i] * dt;
      }
      // fade by shrinking in the last 25% of life
      const f = age > life * 0.75 ? 1 - (age - life * 0.75) / (life * 0.25) : 1;
      _v6.set(this.ax[i * 3], this.ax[i * 3 + 1], this.ax[i * 3 + 2]);
      _q2.setFromAxisAngle(_v6, this.rot[i]);
      const s = this.sc[i] * f;
      _v5.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); _s1.set(s, s, s);
      this.mesh.setMatrixAt(i, _m2.compose(_v5, _q2, _s1));
      const ci = Math.min(1, f * 1.4);
      this.mesh.instanceColor.setXYZ(i, this.col[i * 3] * ci, this.col[i * 3 + 1] * ci, this.col[i * 3 + 2] * ci);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

let Shards = null, Rubble = null;
function initDebris() {
  const sg = new THREE.OctahedronGeometry(0.5, 0); sg.scale(0.32, 1.0, 0.1);
  const smat = new THREE.ShaderMaterial({ vertexShader: SHARD_MAT_VS, fragmentShader: SHARD_MAT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  Shards = new Debris(CONFIG.debris.shards, sg, smat, { bounce: 0.3 });
  const rg = new THREE.DodecahedronGeometry(0.35, 0); rg.scale(1, 0.7, 0.9);
  const rmat = makeArcane({ color: 0x3a3d48, roughness: 0.85, metalness: 0.1 }, { rim: 0.4, rimColor: 0x6688aa, key: 'rubble' });
  Rubble = new Debris(CONFIG.debris.rubble, rg, rmat, { bounce: 0.25, renderOrder: 0 });
  Rubble.mesh.castShadow = true;
}

/** Shard helpers used by the kit and bosses */
const ShardFX = {
  /** frozen crescent of glass shards in the air (Rend). returns nothing; shards shatter after `hold` */
  crescent(x, z, yaw, radius, arcRad, count, color, hold, y) {
    for (let k = 0; k < count; k++) {
      const t = count > 1 ? k / (count - 1) : 0.5;
      const a = yaw - arcRad / 2 + arcRad * t;
      const r = radius * fxRange(0.8, 1.15);
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r, py = (y || 1.1) + Math.sin(t * Math.PI) * 0.5 + fxRange(-0.25, 0.25);
      const out = fxRange(3, 7);
      _v4.set(Math.cos(a), fxRange(-0.3, 0.3), -Math.sin(a));   // tangent-ish axis: shards lie along the arc
      Shards.spawn(px, py, pz, Math.sin(a) * out, fxRange(2, 5), Math.cos(a) * out,
        { life: hold + fxRange(0.5, 0.9), hold, scale: fxRange(0.35, 0.6), color, intensity: 1.5, grav: -16, drag: 1.2, spin: fxRange(-14, 14), axis: _v4.normalize() });
    }
  },
  /** omni-directional explosion of shards */
  explode(pos, n, speed, color, o) {
    o = o || {};
    for (let k = 0; k < n; k++) {
      let x = fxRange(-1, 1), y = fxRange(-0.2, 1), z = fxRange(-1, 1); const l = Math.hypot(x, y, z) || 1; const s = speed * fxRange(0.4, 1);
      Shards.spawn(pos.x + x / l * (o.spread || 0.5), pos.y + y / l * (o.spread || 0.5), pos.z + z / l * (o.spread || 0.5), x / l * s, y / l * s + (o.up || 2), z / l * s,
        { life: (o.life || 1.4) * fxRange(0.6, 1), scale: (o.scale || 0.5) * fxRange(0.6, 1.3), color, intensity: o.intensity || 1.4, grav: o.grav != null ? o.grav : -14, drag: o.drag != null ? o.drag : 0.8, hold: o.hold || 0 });
    }
  },
  /** shards that fly from `pos` (random shell) and home into `target` (an object with x,y,z kept up to date) */
  suck(pos, n, radius, color, target, o) {
    o = o || {};
    Shards.homeTarget = target;
    for (let k = 0; k < n; k++) {
      let x = fxRange(-1, 1), y = fxRange(-0.5, 1), z = fxRange(-1, 1); const l = Math.hypot(x, y, z) || 1;
      Shards.spawn(pos.x + x / l * radius * Math.random(), pos.y + y / l * radius, pos.z + z / l * radius * Math.random(), x / l * 8, y / l * 6 + 3, z / l * 8,
        { life: o.life || 4, hold: (o.hold || 0) + fxRange(0, o.stagger || 0.6), scale: fxRange(0.3, 0.7), color, intensity: o.intensity || 1.6, home: true, grav: 0 });
    }
  },
};

// ---------------------------------------------------------------- ribbon trail
class RibbonTrail {
  constructor(n, color, opts) {
    opts = opts || {};
    this.n = n;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
    for (let i = 0; i < n; i++) { uv[i * 4] = i / (n - 1); uv[i * 4 + 1] = 0; uv[i * 4 + 2] = i / (n - 1); uv[i * 4 + 3] = 1; if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(pos, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color != null ? color : 0x5ff2ff) }, uAlpha: { value: 0 }, uIntensity: { value: opts.intensity || 3 } },
      vertexShader: BASIC_UV_VS,
      fragmentShader: /* glsl */`
        uniform vec3 uColor; uniform float uAlpha, uIntensity; varying vec2 vUv;
        void main(){
          float age = vUv.x;
          float a = pow(max(1.0 - age, 0.0), 1.6) * uAlpha;
          float tip = pow(max(vUv.y, 0.0), 3.0);
          vec3 c = uColor * uIntensity * (0.25 + 1.2 * tip) + vec3(1.0) * pow(max(vUv.y, 0.0), 10.0) * (1.0 - age) * 2.0;
          gl_FragColor = vec4(c * a * smoothstep(0.0, 0.25, vUv.y), 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 7;
    scene.add(this.mesh);
  }
  reset(base, tip) {   // runs every frame while the blade is idle: plain writes, no temp arrays
    const a = this.posAttr.array;
    for (let i = 0, o = 0; i < this.n; i++, o += 6) { a[o] = base.x; a[o + 1] = base.y; a[o + 2] = base.z; a[o + 3] = tip.x; a[o + 4] = tip.y; a[o + 5] = tip.z; }
    this.posAttr.needsUpdate = true;
  }
  push(base, tip) {
    const a = this.posAttr.array;
    a.copyWithin(6, 0, (this.n - 1) * 6);
    a[0] = base.x; a[1] = base.y; a[2] = base.z; a[3] = tip.x; a[4] = tip.y; a[5] = tip.z;
    this.posAttr.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- ground rings (pooled)
const GroundFX = {
  pool: null, list: [],
  init() {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    this.pool = new Pool(CONFIG.pools.groundRings, () => {
      const m = new THREE.Mesh(geo, makeGroundRingMaterial(0x5ff2ff));
      m.visible = false; m.renderOrder = 4; m.frustumCulled = false; scene.add(m);
      return { mesh: m, u: m.material.uniforms, t: 0, life: 1, r0: 1, r1: 2, w: 0.2, inten: 2, y: 0.05, follow: null };
    });
  },
  /** expanding ring decal: radius r0→r1 over life, fading. Returns the ring (or null if the pool is empty). */
  ring(x, z, r0, r1, color, life, width, intensity, y) {
    const g = this.pool.get(); if (!g) return null;
    g.t = 0; g.life = life || 0.5; g.r0 = r0; g.r1 = r1; g.w = width || 0.25; g.inten = intensity || 2.5; g.follow = null;
    g.mesh.position.set(x, y != null ? y : 0.05, z); toColor(color != null ? color : 0x5ff2ff, g.u.uColor.value);
    g.u.uFrac.value = 1; g.u.uFill.value = 0; g.mesh.visible = true;
    this.list.push(g); this._apply(g, 0);
    return g;
  },
  _apply(g, k) {
    const r = lerp(g.r0, g.r1, easeOutCubic(k));
    g.mesh.scale.set(r * 2.5, 1, r * 2.5);
    g.u.uR.value = r; g.u.uW.value = g.w * (1 - k * 0.6); g.u.uAlpha.value = (1 - k) * (1 - k); g.u.uIntensity.value = g.inten;
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i]; g.t += dt;
      const k = g.t / g.life;
      if (k >= 1) { g.mesh.visible = false; this.pool.release(g); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); continue; }
      this._apply(g, k);
    }
  },
  clear() { for (const g of this.list) { g.mesh.visible = false; this.pool.release(g); } this.list.length = 0; },
};

// ---------------------------------------------------------------- crescent slashes (pooled)
const SlashFX = {
  pool: null, list: [],
  init() {
    const geo = makeCrescentGeometry(1, 2.7, 0.42, 40);
    this.pool = new Pool(CONFIG.pools.slashes, () => {
      const m = new THREE.Mesh(geo, makeCrescentMaterial(0x9ff8ff));
      m.visible = false; m.frustumCulled = false; m.renderOrder = 9; scene.add(m);
      return { mesh: m, u: m.material.uniforms, t: 0, dur: 0.2, hold: 0, delay: 0 };
    });
  },
  /** a sweeping crescent: centred at (x,y,z), facing yaw, rolled by `tilt`, radius r. o: {dur, hold, delay, intensity, flip, tail} */
  spawn(x, y, z, yaw, tilt, r, color, o) {
    o = o || {};
    const s = this.pool.get(); if (!s) return null;
    s.t = 0; s.dur = o.dur || 0.18; s.hold = o.hold || 0.08; s.delay = o.delay || 0;
    s.mesh.position.set(x, y, z);
    s.mesh.rotation.set(0, 0, 0);
    s.mesh.rotation.order = 'YXZ';
    s.mesh.rotation.y = yaw; s.mesh.rotation.z = tilt || 0; s.mesh.rotation.x = o.pitch || 0;
    s.mesh.scale.set(o.flip ? -r : r, r, r);
    toColor(color != null ? color : 0x9ff8ff, s.u.uColor.value);
    s.u.uIntensity.value = o.intensity || 3; s.u.uTail.value = o.tail || 0.65; s.u.uHead.value = 0; s.u.uAlpha.value = 1;
    s.mesh.visible = s.delay <= 0;
    this.list.push(s);
    return s;
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      if (s.delay > 0) { s.delay -= dt; if (s.delay > 0) continue; s.mesh.visible = true; }
      s.t += dt;
      const k = s.t / s.dur;
      s.u.uHead.value = Math.min(1 + s.u.uTail.value * 0.2, easeOutCubic(k) * 1.05);
      if (s.t > s.dur) s.u.uAlpha.value = Math.max(0, 1 - (s.t - s.dur) / Math.max(0.01, s.hold + 0.12));
      if (s.t > s.dur + s.hold + 0.12) { s.mesh.visible = false; this.pool.release(s); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    }
  },
  clear() { for (const s of this.list) { s.mesh.visible = false; this.pool.release(s); } this.list.length = 0; },
};
