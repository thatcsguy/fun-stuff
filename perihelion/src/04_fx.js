// =====================================================================
// 04_fx.js: pooled effects with per-quality budgets. Everything is
// additive light (warm gold by default; callers pass boss accents).
// Positions are in play-plane coordinates (G.layers.fx is a child of the
// tiltable play group, like arena/boss/player), so G.polar(...) works
// directly. Every entry point tolerates missing/odd arguments.
// =====================================================================
(() => {
  const THREE_ = THREE;
  const V = THREE_.Vector3;
  const GOLD = '#ffc94d';
  let layer = null;
  const tmpV = new V(), tmpV2 = new V(), tmpV3 = new V(), tmpC = new THREE_.Color(), camLocal = new V();
  let ready = false;

  // ---------- argument helpers ----------
  const toV = (p, out = new V()) => {
    if (!p) return out.set(0, 0, 0);
    if (p.isVector3) return out.copy(p);
    if (p.isObject3D) { p.getWorldPosition(out); if (layer) layer.worldToLocal(out); return out; }
    if (Array.isArray(p)) return out.set(+p[0] || 0, +p[1] || 0, +p[2] || 0);
    if (typeof p === 'object') return out.set(+p.x || 0, +p.y || 0, +p.z || 0);
    return out.set(0, 0, 0);
  };
  const toC = (c, out = new THREE_.Color(), def = GOLD) => {
    try {
      if (c == null || c === '') return out.set(def);
      if (c.isColor) return out.copy(c);
      return out.set(c);
    } catch (e) { return out.set(def); }
  };
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const tierMul = () => (G.quality && G.quality.tier === 'low') ? 0.5 : (G.quality && G.quality.tier === 'med') ? 0.75 : 1;

  // ==================================================================
  // Particles: one Points draw for everything (soft dots + 4-point stars)
  // ==================================================================
  const PMAX = 2600;
  const P = { pos: new Float32Array(PMAX * 3), vel: new Float32Array(PMAX * 3), col: new Float32Array(PMAX * 3), life: new Float32Array(PMAX), max: new Float32Array(PMAX),
    size: new Float32Array(PMAX), grav: new Float32Array(PMAX), drag: new Float32Array(PMAX), shape: new Float32Array(PMAX), head: 0, active: 0, geo: null, pts: null, hi: 0 };
  let aPos, aCol, aSA; const dbs = new THREE_.Vector2();
  function initParticles() {
    const g = new THREE_.BufferGeometry();
    aPos = new THREE_.BufferAttribute(new Float32Array(PMAX * 3), 3); aPos.setUsage(THREE_.DynamicDrawUsage);
    aCol = new THREE_.BufferAttribute(new Float32Array(PMAX * 3), 3); aCol.setUsage(THREE_.DynamicDrawUsage);
    aSA = new THREE_.BufferAttribute(new Float32Array(PMAX * 3), 3); aSA.setUsage(THREE_.DynamicDrawUsage);   // size, alpha, shape
    g.setAttribute('position', aPos); g.setAttribute('color', aCol); g.setAttribute('sa', aSA);
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE_.Sphere(new V(), 1e4);
    const m = new THREE_.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE_.AdditiveBlending, toneMapped: false,
      uniforms: { uScale: { value: 400 } },
      vertexShader: /* glsl */`
        attribute vec3 color; attribute vec3 sa; uniform float uScale; varying vec3 vC; varying float vA; varying float vS;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(sa.x * uScale / max(0.5, -mv.z), 0., 96.); vC = color; vA = sa.y; vS = sa.z; }`,
      fragmentShader: /* glsl */`
        varying vec3 vC; varying float vA; varying float vS;
        void main(){ vec2 p = gl_PointCoord * 2. - 1.; float r2 = dot(p, p); if (r2 > 1.) discard;
          float soft = exp(-r2 * 4.5); float core = exp(-r2 * 22.);
          float star = (exp(-abs(p.x) * 14.) * exp(-p.y * p.y * 2.5) + exp(-abs(p.y) * 14.) * exp(-p.x * p.x * 2.5)) * (1. - r2);
          float a = mix(soft * .8 + core, star * 1.3 + core * .8, vS);
          gl_FragColor = vec4(vC * a * vA + vec3(core) * vA * .5, 1.); }`,
    });
    P.mat = m; P.geo = g;
    P.pts = new THREE_.Points(g, m); P.pts.frustumCulled = false; P.pts.renderOrder = 20;
    layer.add(P.pts);
  }
  function spawnP(x, y, z, vx, vy, vz, c, size, life, grav, drag, shape) {
    const cap = Math.min(PMAX, Math.max(200, (G.quality && G.quality.particleBudget) || PMAX));
    const i = P.head; P.head = (P.head + 1) % cap;
    if (i >= P.hi) P.hi = i + 1;
    const i3 = i * 3;
    P.pos[i3] = x; P.pos[i3 + 1] = y; P.pos[i3 + 2] = z;
    P.vel[i3] = vx; P.vel[i3 + 1] = vy; P.vel[i3 + 2] = vz;
    P.col[i3] = c.r; P.col[i3 + 1] = c.g; P.col[i3 + 2] = c.b;
    P.life[i] = life; P.max[i] = life; P.size[i] = size; P.grav[i] = grav; P.drag[i] = drag; P.shape[i] = shape;
  }
  function updateParticles(dt) {
    const n = P.hi; let alive = 0;
    const pa = aPos.array, ca = aCol.array, sa = aSA.array;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      if (P.life[i] <= 0) { sa[i3 + 1] = 0; continue; }
      P.life[i] -= dt;
      if (P.life[i] <= 0) { sa[i3 + 1] = 0; continue; }
      alive++;
      const dr = Math.max(0, 1 - P.drag[i] * dt);
      P.vel[i3] *= dr; P.vel[i3 + 1] = P.vel[i3 + 1] * dr - P.grav[i] * dt; P.vel[i3 + 2] *= dr;
      P.pos[i3] += P.vel[i3] * dt; P.pos[i3 + 1] += P.vel[i3 + 1] * dt; P.pos[i3 + 2] += P.vel[i3 + 2] * dt;
      const u = P.life[i] / P.max[i];   // 1 -> 0
      pa[i3] = P.pos[i3]; pa[i3 + 1] = P.pos[i3 + 1]; pa[i3 + 2] = P.pos[i3 + 2];
      ca[i3] = P.col[i3]; ca[i3 + 1] = P.col[i3 + 1]; ca[i3 + 2] = P.col[i3 + 2];
      const fadeIn = Math.min(1, (1 - u) * 12);
      sa[i3] = P.size[i] * (0.35 + 0.65 * u); sa[i3 + 1] = Math.min(1, u * 1.6) * fadeIn; sa[i3 + 2] = P.shape[i];
    }
    P.active = alive;
    P.geo.setDrawRange(0, n);
    aPos.needsUpdate = true; aCol.needsUpdate = true; aSA.needsUpdate = true;
    if (alive === 0) P.hi = 0;
    const h = G.renderer ? G.renderer.getDrawingBufferSize(dbs).y : 720;
    P.mat.uniforms.uScale.value = h * 0.5 * (G.camera ? G.camera.projectionMatrix.elements[5] : 2.4);
  }

  // ==================================================================
  // Flares: pooled glow sprites (lance ends, spark flashes, comet heads)
  // ==================================================================
  const FL = [];
  const FLMAX = 48;
  function initFlares() {
    for (let i = 0; i < FLMAX; i++) {
      const s = G.mat.glowSprite('#ffffff', 1, { renderOrder: 21 });
      s.visible = false; s.userData = { life: 0, max: 1, size: 1, grow: 0 }; layer.add(s); FL.push(s);
    }
  }
  let flI = 0;
  function flare(pos, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready) return null;
    const s = FL[flI]; flI = (flI + 1) % FLMAX;
    toV(pos, s.position); s.position.y += num(o.lift, 0);
    toC(o.color, s.material.color).multiplyScalar(num(o.intensity, 2.2));
    s.material.map = o.star ? G.tex.star : G.tex.glow;
    s.material.rotation = o.star ? Math.random() * 0.4 - 0.2 : 0;
    const u = s.userData; u.life = u.max = Math.max(0.03, num(o.life, 0.3)); u.size = num(o.size, 1.4); u.grow = num(o.grow, 0.4);
    s.scale.setScalar(u.size); s.visible = true; s.material.opacity = 1;
    return s;
  }
  function updateFlares(dt) {
    for (const s of FL) {
      if (!s.visible) continue;
      const u = s.userData; u.life -= dt;
      if (u.life <= 0) { s.visible = false; continue; }
      const k = u.life / u.max;
      s.material.opacity = k * k;
      s.scale.setScalar(u.size * (1 + u.grow * (1 - k)));
    }
  }

  // ==================================================================
  // Lances: camera-facing glowing beams (also streaks / lightning segments)
  // ==================================================================
  const LMAX = 64, LN = [];
  const lanceGeo = new THREE_.PlaneGeometry(1, 1, 8, 1).translate(0.5, 0, 0);
  const LANCE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
  const LANCE_FS = /* glsl */`
    uniform vec3 uColor; uniform float uA, uTime, uHead, uTail, uSeed; varying vec2 vUv;
    void main(){
      float y = abs(vUv.y - .5) * 2.;
      float core = exp(-y * y * 90.), glow = exp(-y * y * 9.) * .7 + exp(-y * y * 2.5) * .18;
      float along = smoothstep(0., .04, vUv.x) * smoothstep(1., .96, vUv.x);
      // streak mode: bright head at uHead, fading tail of length uTail
      float st = uTail > 0. ? smoothstep(uHead - uTail, uHead, vUv.x) * step(vUv.x, uHead + .02) : 1.;
      float fl = .82 + .18 * sin(vUv.x * 40. - uTime * 30. + uSeed);
      vec3 c = uColor * (glow * fl) + mix(uColor, vec3(1.), .7) * core * 1.6;
      gl_FragColor = vec4(c * uA * along * st, 1.);
    }`;
  function initLances() {
    for (let i = 0; i < LMAX; i++) {
      const m = new THREE_.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE_.AdditiveBlending, side: THREE_.DoubleSide, toneMapped: false,
        uniforms: { uColor: { value: new THREE_.Color() }, uA: { value: 1 }, uTime: { value: 0 }, uHead: { value: 1 }, uTail: { value: 0 }, uSeed: { value: Math.random() * 10 } },
        vertexShader: LANCE_VS, fragmentShader: LANCE_FS });
      const mesh = new THREE_.Mesh(lanceGeo, m); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 22;
      mesh.userData = { a: new V(), b: new V(), life: 0, max: 1, width: 0.3, mode: 'lance', travel: 0, tail: 0, endFlare: false, color: new THREE_.Color(), onEnd: null };
      layer.add(mesh); LN.push(mesh);
    }
  }
  let lnI = 0;
  function takeLance() {
    for (let k = 0; k < LMAX; k++) { const m = LN[(lnI + k) % LMAX]; if (!m.visible) { lnI = (lnI + k + 1) % LMAX; return m; } }
    const m = LN[lnI]; lnI = (lnI + 1) % LMAX; return m;
  }
  const basisX = new V(), basisY = new V(), basisZ = new V(), mtx = new THREE_.Matrix4();
  function placeLance(mesh, a, b, w) {
    basisX.subVectors(b, a); const len = basisX.length();
    if (len < 1e-4) { mesh.visible = false; return; }
    basisX.multiplyScalar(1 / len);
    tmpV.addVectors(a, b).multiplyScalar(0.5);
    basisZ.subVectors(camLocal, tmpV).normalize();
    basisY.crossVectors(basisZ, basisX); if (basisY.lengthSq() < 1e-6) basisY.set(0, 1, 0); basisY.normalize();
    basisZ.crossVectors(basisX, basisY);
    mtx.makeBasis(basisX.multiplyScalar(len), basisY.multiplyScalar(w), basisZ); mtx.setPosition(a);
    mesh.matrix.copy(mtx); mesh.matrixWorldNeedsUpdate = true;
  }
  function lance(from, to, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready) return null;
    const m = takeLance(), u = m.userData;
    toV(from, u.a); toV(to, u.b);
    u.life = u.max = Math.max(0.04, num(o.life, 0.32)); u.width = num(o.width, 0.32); u.mode = o.mode || 'lance';
    u.travel = num(o.travel, 0); u.tail = num(o.tail, 0); u.onEnd = typeof o.onEnd === 'function' ? o.onEnd : null;
    toC(o.color, m.material.uniforms.uColor.value).multiplyScalar(num(o.intensity, 1.8));
    u.color.copy(m.material.uniforms.uColor.value);
    m.material.uniforms.uHead.value = u.travel > 0 ? 0 : 1; m.material.uniforms.uTail.value = u.tail;
    m.visible = true;
    placeLance(m, u.a, u.b, u.width * 2.6);
    if (o.flare !== false && u.travel === 0) { flare(u.b, { color: o.color, size: u.width * 6, life: u.max * 0.9 }); flare(u.a, { color: o.color, size: u.width * 3.5, life: u.max * 0.6 }); }
    return { remove() { m.visible = false; } };
  }
  function updateLances(dt) {
    for (const m of LN) {
      if (!m.visible) continue;
      const u = m.userData, U = m.material.uniforms;
      u.life -= dt;
      if (u.life <= 0) { m.visible = false; if (u.onEnd) { const f = u.onEnd; u.onEnd = null; try { f(); } catch (e) { G.log.error('fx.lance.onEnd', e); } } continue; }
      const k = u.life / u.max;
      U.uTime.value = G.now;
      if (u.travel > 0) {   // streak: head travels a->b during the first `travel` fraction, then fades
        const p = G.clamp((1 - k) / u.travel); U.uHead.value = p;
        U.uA.value = p < 1 ? 1 : G.clamp(k / (1 - u.travel));
        if (p >= 1 && !u.landed) { u.landed = true; }
      } else U.uA.value = Math.pow(k, 1.4) * (u.mode === 'bolt' ? (0.6 + 0.4 * Math.random()) : 1);
      placeLance(m, u.a, u.b, u.width * 2.6 * (u.mode === 'lance' ? (0.6 + 0.4 * k) : 1));
    }
  }

  // ==================================================================
  // Shockwaves: flat expanding rings on the play plane
  // ==================================================================
  const SMAX = 16, SW = [];
  const swGeo = new THREE_.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  function initShock() {
    for (let i = 0; i < SMAX; i++) {
      const m = new THREE_.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE_.AdditiveBlending, toneMapped: false, side: THREE_.DoubleSide,
        uniforms: { uColor: { value: new THREE_.Color() }, uR: { value: 0.5 }, uT: { value: 0.1 }, uA: { value: 1 } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uR, uT, uA; varying vec2 vP;
          void main(){ float r = length(vP); float d = (r - uR) / uT;
            float ring = exp(-d * d * 2.5); float inner = smoothstep(uR, 0., r) * .12;
            float core = exp(-d * d * 18.);
            vec3 c = uColor * (ring + inner) + vec3(1.) * core * .5;
            gl_FragColor = vec4(c * uA * smoothstep(1., .96, r), 1.); }` });
      const mesh = new THREE_.Mesh(swGeo, m); mesh.visible = false; mesh.renderOrder = 19; mesh.frustumCulled = false;
      mesh.userData = { life: 0, max: 1, radius: 3, thick: 0.4, r0: 0 };
      layer.add(mesh); SW.push(mesh);
    }
  }
  let swI = 0;
  function shockwave(pos, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready) return null;
    const m = SW[swI]; swI = (swI + 1) % SMAX; const u = m.userData;
    toV(pos, m.position); m.position.y += num(o.lift, 0.06);
    u.radius = Math.max(0.2, num(o.radius, 3)); u.life = u.max = Math.max(0.05, num(o.life, 0.55)); u.thick = num(o.thickness, 0.35); u.r0 = num(o.r0, 0.1);
    toC(o.color, m.material.uniforms.uColor.value).multiplyScalar(num(o.intensity, 1.6));
    m.scale.setScalar(u.radius + u.thick * 2); m.visible = true;
    return { remove() { m.visible = false; } };
  }
  function updateShock(dt) {
    for (const m of SW) {
      if (!m.visible) continue;
      const u = m.userData; u.life -= dt;
      if (u.life <= 0) { m.visible = false; continue; }
      const k = 1 - u.life / u.max, e = G.easeOutCubic(k), S = u.radius + u.thick * 2;
      const U = m.material.uniforms;
      U.uR.value = (u.r0 + (u.radius - u.r0) * e) / S; U.uT.value = Math.max(0.01, u.thick * (1 - k * 0.5) / S); U.uA.value = (1 - k) * (1 - k);
    }
  }

  // ==================================================================
  // Ring flashes: an arc of a ring lights up (shader-masked annulus)
  // ==================================================================
  const RFMAX = 12, RF = [];
  let rfGeos = null;
  function initRingFlash() {
    rfGeos = G.RINGS.map((r) => new THREE_.RingGeometry(r - G.TRACK_W * 0.62, r + G.TRACK_W * 0.62, 160, 1).rotateX(-Math.PI / 2));
    for (let i = 0; i < RFMAX; i++) {
      const m = new THREE_.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE_.AdditiveBlending, toneMapped: false, side: THREE_.DoubleSide,
        uniforms: { uColor: { value: new THREE_.Color() }, uA0: { value: 0 }, uA1: { value: 1 }, uAmt: { value: 1 }, uR: { value: 9 }, uW: { value: 0.7 }, uTime: { value: 0 }, uFull: { value: 0 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
        fragmentShader: /* glsl */`uniform vec3 uColor; uniform float uA0, uA1, uAmt, uR, uW, uTime, uFull; varying vec3 vP;
          const float PI = 3.14159265;
          void main(){ float th = atan(-vP.z, vP.x);
            // distance into the arc [uA0, uA1] (uA1 > uA0, may exceed PI)
            float span = uA1 - uA0; float rel = mod(th - uA0 + 4. * PI, 2. * PI);
            float inArc = uFull > .5 ? 1. : smoothstep(0., .06, rel) * smoothstep(span, span - .06, rel) * step(rel, span + .001);
            float d = (length(vP.xz) - uR) / uW;
            float band = exp(-d * d * 3.) + exp(-d * d * 40.) * .8;
            float run = .75 + .25 * sin(th * uR * 2. - uTime * 14.);
            gl_FragColor = vec4(uColor * band * inArc * uAmt * run, 1.); }` });
      const mesh = new THREE_.Mesh(rfGeos[1], m); mesh.visible = false; mesh.renderOrder = 18; mesh.position.y = 0.08;
      mesh.userData = { life: 0, max: 1 };
      layer.add(mesh); RF.push(mesh);
    }
  }
  let rfI = 0;
  function ringFlash(ringIndex, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready) return null;
    const ri = G.clamp(Math.round(num(ringIndex, 1)), 0, G.RINGS.length - 1);
    const m = RF[rfI]; rfI = (rfI + 1) % RFMAX; const u = m.userData, U = m.material.uniforms;
    m.geometry = rfGeos[ri];
    let a0 = o.a0, a1 = o.a1;
    if (typeof a0 !== 'number' || typeof a1 !== 'number') { U.uFull.value = 1; a0 = 0; a1 = Math.PI * 2; }
    else { U.uFull.value = 0; if (a1 < a0) { const t = a0; a0 = a1; a1 = t; } if (a1 - a0 >= Math.PI * 2 - 1e-3) U.uFull.value = 1; }
    U.uA0.value = a0; U.uA1.value = a1; U.uR.value = G.RINGS[ri]; U.uW.value = G.TRACK_W * 0.5;
    toC(o.color, U.uColor.value).multiplyScalar(num(o.intensity, 1.8));
    u.life = u.max = Math.max(0.05, num(o.life, 0.45)); m.visible = true;
    return { remove() { m.visible = false; } };
  }
  function updateRingFlash(dt) {
    for (const m of RF) {
      if (!m.visible) continue;
      const u = m.userData; u.life -= dt;
      if (u.life <= 0) { m.visible = false; continue; }
      const k = u.life / u.max; m.material.uniforms.uAmt.value = k * k * (1 + (1 - k) * 0.5); m.material.uniforms.uTime.value = G.now;
    }
  }

  // ==================================================================
  // Shards: instanced tumbling brass/crystal fragments (anchor smash, shatter)
  // ==================================================================
  const SHMAX = 180;
  const SH = { mesh: null, n: 0, pos: new Float32Array(SHMAX * 3), vel: new Float32Array(SHMAX * 3), rot: new Float32Array(SHMAX * 3), spin: new Float32Array(SHMAX * 3),
    life: new Float32Array(SHMAX), max: new Float32Array(SHMAX), size: new Float32Array(SHMAX), grav: new Float32Array(SHMAX), floor: new Float32Array(SHMAX), head: 0 };
  const dummy = new THREE_.Object3D();
  function initShards() {
    const geo = new THREE_.TetrahedronGeometry(0.5, 0);
    const mat = new THREE_.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.25, emissive: 0x332200, emissiveIntensity: 1 });
    SH.mesh = new THREE_.InstancedMesh(geo, mat, SHMAX); SH.mesh.instanceMatrix.setUsage(THREE_.DynamicDrawUsage);
    SH.mesh.instanceColor = new THREE_.InstancedBufferAttribute(new Float32Array(SHMAX * 3), 3);
    SH.mesh.count = 0; SH.mesh.frustumCulled = false; SH.mesh.renderOrder = 15;
    layer.add(SH.mesh);
  }
  function shards(pos, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready) return;
    const c = toC(o.color, tmpC, '#ffd27a');
    const n = Math.round(num(o.count, 14) * tierMul()), p = toV(pos, tmpV3), sp = num(o.speed, 5), sz = num(o.size, 0.16);
    for (let k = 0; k < n; k++) {
      const i = SH.head; SH.head = (SH.head + 1) % SHMAX; SH.n = Math.max(SH.n, i + 1);
      const a = Math.random() * Math.PI * 2, up = 0.4 + Math.random();
      const s = sp * (0.4 + Math.random() * 0.8);
      SH.pos[i * 3] = p.x; SH.pos[i * 3 + 1] = p.y + 0.2; SH.pos[i * 3 + 2] = p.z;
      SH.vel[i * 3] = Math.cos(a) * s; SH.vel[i * 3 + 1] = up * s * 0.9; SH.vel[i * 3 + 2] = Math.sin(a) * s;
      for (let j = 0; j < 3; j++) { SH.rot[i * 3 + j] = Math.random() * 6; SH.spin[i * 3 + j] = (Math.random() - 0.5) * 18; }
      SH.life[i] = SH.max[i] = num(o.life, 1.1) * (0.7 + Math.random() * 0.6); SH.size[i] = sz * (0.5 + Math.random());
      SH.grav[i] = num(o.gravity, 14); SH.floor[i] = num(o.floor, -6);
      SH.mesh.instanceColor.setXYZ(i, c.r * 1.6, c.g * 1.6, c.b * 1.6);
    }
    SH.mesh.instanceColor.needsUpdate = true;
  }
  function updateShards(dt) {
    if (!SH.n) return;
    let any = false;
    for (let i = 0; i < SH.n; i++) {
      if (SH.life[i] <= 0) { dummy.scale.setScalar(0); dummy.updateMatrix(); SH.mesh.setMatrixAt(i, dummy.matrix); continue; }
      SH.life[i] -= dt; any = true;
      const i3 = i * 3;
      SH.vel[i3 + 1] -= SH.grav[i] * dt;
      for (let j = 0; j < 3; j++) { SH.pos[i3 + j] += SH.vel[i3 + j] * dt; SH.rot[i3 + j] += SH.spin[i3 + j] * dt; }
      if (SH.pos[i3 + 1] < SH.floor[i]) { SH.pos[i3 + 1] = SH.floor[i]; SH.vel[i3 + 1] *= -0.3; }
      const k = Math.max(0, SH.life[i] / SH.max[i]);
      dummy.position.set(SH.pos[i3], SH.pos[i3 + 1], SH.pos[i3 + 2]);
      dummy.rotation.set(SH.rot[i3], SH.rot[i3 + 1], SH.rot[i3 + 2]);
      dummy.scale.set(SH.size[i], SH.size[i] * 1.8, SH.size[i]).multiplyScalar(Math.min(1, k * 3));
      dummy.updateMatrix(); SH.mesh.setMatrixAt(i, dummy.matrix);
    }
    SH.mesh.count = SH.n;
    SH.mesh.instanceMatrix.needsUpdate = true;
    if (!any) { SH.n = 0; SH.mesh.count = 0; }
  }

  // ==================================================================
  // Damage numbers: one instanced draw, glyphs from a generated atlas
  // ==================================================================
  const GMAX = 480, NMAX = 64, CELL = 64, COLS = 16;
  const NUM = { mesh: null, list: [], widths: new Float32Array(128), aPos: null, aGly: null, aCol: null };
  function initNumbers() {
    const c = document.createElement('canvas'); c.width = CELL * COLS; c.height = CELL * 6;
    const x = c.getContext('2d');
    x.font = `900 ${CELL * 0.72}px "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    for (let code = 32; code < 128; code++) {
      const i = code - 32, cx = (i % COLS) * CELL + CELL / 2, cy = Math.floor(i / COLS) * CELL + CELL / 2 + 2;
      const ch = String.fromCharCode(code);
      x.lineWidth = 12; x.strokeStyle = 'rgba(8,5,20,0.95)'; x.strokeText(ch, cx, cy);
      x.fillStyle = '#ffffff'; x.fillText(ch, cx, cy);
      NUM.widths[code] = Math.min(1, (x.measureText(ch).width + 6) / CELL);
    }
    NUM.widths[32] = 0.32;
    const tex = new THREE_.CanvasTexture(c); tex.colorSpace = THREE_.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE_.LinearMipmapLinearFilter; tex.anisotropy = 2;
    const base = new THREE_.PlaneGeometry(1, 1);
    const g = new THREE_.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
    NUM.aPos = new THREE_.InstancedBufferAttribute(new Float32Array(GMAX * 4), 4); NUM.aPos.setUsage(THREE_.DynamicDrawUsage);   // xyz + scale
    NUM.aGly = new THREE_.InstancedBufferAttribute(new Float32Array(GMAX * 3), 3); NUM.aGly.setUsage(THREE_.DynamicDrawUsage);   // glyph index, x / y offset (glyph units)
    NUM.aCol = new THREE_.InstancedBufferAttribute(new Float32Array(GMAX * 4), 4); NUM.aCol.setUsage(THREE_.DynamicDrawUsage);   // rgb + alpha
    g.setAttribute('iPos', NUM.aPos); g.setAttribute('iGly', NUM.aGly); g.setAttribute('iCol', NUM.aCol);
    g.instanceCount = 0;
    const m = new THREE_.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { uTex: { value: tex } },
      vertexShader: /* glsl */`
        attribute vec4 iPos; attribute vec3 iGly; attribute vec4 iCol; varying vec2 vUv; varying vec4 vC;
        void main(){
          vec4 mv = modelViewMatrix * vec4(iPos.xyz, 1.);
          // constant-ish screen size: scale with distance
          float s = iPos.w * (-mv.z) * .04;
          mv.xy += (position.xy + iGly.yz) * s;
          gl_Position = projectionMatrix * mv;
          float gi = iGly.x; vec2 cell = vec2(mod(gi, 16.), 5. - floor(gi / 16.));
          vUv = (cell + uv) / vec2(16., 6.); vC = iCol;
        }`,
      fragmentShader: /* glsl */`uniform sampler2D uTex; varying vec2 vUv; varying vec4 vC;
        void main(){ vec4 t = texture2D(uTex, vUv); gl_FragColor = vec4(t.rgb * vC.rgb, t.a * vC.a); }`,
    });
    NUM.mesh = new THREE_.Mesh(g, m); NUM.mesh.frustumCulled = false; NUM.mesh.renderOrder = 40;
    layer.add(NUM.mesh);
  }
  function number(pos, amount, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready || G.fx.showNumbers === false) return;
    let text = o.text != null ? String(o.text) : (typeof amount === 'number' ? String(Math.round(amount)) : String(amount ?? ''));
    if (!text) return;
    if (o.crit && o.text == null) text += '!';
    text = text.slice(0, 18);
    if (NUM.list.length >= NMAX) NUM.list.shift();
    const big = !!o.crit, p = toV(pos);
    const c = toC(o.color, new THREE_.Color(), big ? '#fff1c2' : GOLD).multiplyScalar(big ? 1.4 : 1.15);
    // spread consecutive numbers a little so they don't stack
    p.x += (Math.random() - 0.5) * 0.7; p.z += (Math.random() - 0.5) * 0.3;
    // lane stacking: young numbers near the same spot push the new one up / sideways
    let lane = 0;
    for (const e of NUM.list) if (e.t < 0.45 && Math.abs(e.p.x - p.x) < 1.6 && Math.abs(e.p.z - p.z) < 1.6) lane++;
    lane = Math.min(lane, 5);
    const yOff = lane * 0.95;   // glyph units (screen-relative)
    const xLane = lane ? (lane % 2 ? 1 : -1) * 0.9 * Math.ceil(lane / 2) : 0;
    let w = 0; const offs = [];
    for (let i = 0; i < text.length; i++) { const code = text.charCodeAt(i); const cw = NUM.widths[code < 128 ? code : 63] || 0.5; offs.push(w + cw / 2); w += cw * 0.92; }
    for (let i = 0; i < offs.length; i++) offs[i] += xLane - w / 2;
    NUM.list.push({ p, text, offs, c, t: 0, life: num(o.life, big ? 1.25 : 0.95), size: num(o.size, big ? 1.45 : 0.88) * (o.text != null && !big ? 0.95 : 1), big, yOff, rise: num(o.rise, big ? 1.9 : 1.4) });
  }
  function updateNumbers(dt) {
    const L = NUM.list; let gi = 0;
    for (let n = L.length - 1; n >= 0; n--) { L[n].t += dt; if (L[n].t >= L[n].life) L.splice(n, 1); }
    const pa = NUM.aPos.array, ga = NUM.aGly.array, ca = NUM.aCol.array;
    for (const e of L) {
      const k = e.t / e.life;
      const pop = e.big ? (k < 0.12 ? G.easeOutBack(k / 0.12) * 1.25 : 1.25 - 0.25 * G.smooth((k - 0.12) / 0.3)) : (k < 0.1 ? G.easeOutBack(k / 0.1) : 1);
      const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const y = e.p.y + 1.2 + G.easeOutCubic(k) * e.rise;
      for (let i = 0; i < e.text.length && gi < GMAX; i++) {
        const code = e.text.charCodeAt(i);
        pa[gi * 4] = e.p.x; pa[gi * 4 + 1] = y; pa[gi * 4 + 2] = e.p.z; pa[gi * 4 + 3] = e.size * pop;
        ga[gi * 3] = (code >= 32 && code < 128 ? code : 63) - 32; ga[gi * 3 + 1] = e.offs[i]; ga[gi * 3 + 2] = e.yOff || 0;
        ca[gi * 4] = e.c.r; ca[gi * 4 + 1] = e.c.g; ca[gi * 4 + 2] = e.c.b; ca[gi * 4 + 3] = a;
        gi++;
      }
    }
    NUM.mesh.geometry.instanceCount = gi;
    if (gi) { NUM.aPos.needsUpdate = true; NUM.aGly.needsUpdate = true; NUM.aCol.needsUpdate = true; }
  }

  // ==================================================================
  // Trails: camera-facing ribbons following an Object3D
  // ==================================================================
  const TRAILS = [];
  const TPTS = 40;
  function trail(obj, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready || !obj) return { remove() {}, setColor() {}, setVisible() {} };
    const pos = new Float32Array(TPTS * 2 * 3), al = new Float32Array(TPTS * 2), sd = new Float32Array(TPTS * 2);
    for (let i = 0; i < TPTS; i++) sd[i * 2 + 1] = 1;
    const g = new THREE_.BufferGeometry();
    g.setAttribute('position', new THREE_.BufferAttribute(pos, 3).setUsage(THREE_.DynamicDrawUsage));
    g.setAttribute('aA', new THREE_.BufferAttribute(al, 1).setUsage(THREE_.DynamicDrawUsage));
    g.setAttribute('aS', new THREE_.BufferAttribute(sd, 1));
    const idx = []; for (let i = 0; i < TPTS - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    const m = new THREE_.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE_.AdditiveBlending, side: THREE_.DoubleSide, toneMapped: false,
      uniforms: { uColor: { value: toC(o.color, new THREE_.Color()).multiplyScalar(num(o.intensity, 1.5)) }, uO: { value: num(o.opacity, 1) } },
      vertexShader: 'attribute float aA; attribute float aS; varying float vA; varying float vS; void main(){ vA = aA; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uO; varying float vA; varying float vS; void main(){ float e = 1. - abs(vS * 2. - 1.); float c = .35 + .65 * smoothstep(0., 1., e); gl_FragColor = vec4(mix(uColor, vec3(1.), vA * vA * .35) * vA * uO * c, 1.); }' });
    const mesh = new THREE_.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 16;
    layer.add(mesh);
    const t = { obj, mesh, pts: [], width: num(o.width, 0.35), length: num(o.length, 2.6), visible: true, offset: o.offset ? toV(o.offset) : null, minStep: num(o.minStep, 0.06) };
    TRAILS.push(t);
    return {
      remove() { const i = TRAILS.indexOf(t); if (i >= 0) TRAILS.splice(i, 1); layer.remove(mesh); g.dispose(); m.dispose(); },
      setColor(cc) { toC(cc, m.uniforms.uColor.value).multiplyScalar(num(o.intensity, 1.5)); },
      setVisible(v) { t.visible = !!v; mesh.visible = !!v; if (!v) t.pts.length = 0; },
      clear() { t.pts.length = 0; },
      get mesh() { return mesh; },
    };
  }
  function updateTrails() {
    for (const t of TRAILS) {
      if (!t.visible) continue;
      const p = new V();
      if (t.offset) p.copy(t.offset).applyMatrix4(t.obj.matrixWorld); else t.obj.getWorldPosition(p);
      layer.worldToLocal(p);
      const pts = t.pts;
      if (!pts.length || pts[0].distanceTo(p) > t.minStep) pts.unshift(p); else pts[0].copy(p);
      // trim by length
      let L = 0;
      for (let i = 1; i < pts.length; i++) { L += pts[i].distanceTo(pts[i - 1]); if (L > t.length || i >= TPTS - 1) { pts.length = i + 1; break; } }
      const pa = t.mesh.geometry.attributes.position.array, aa = t.mesh.geometry.attributes.aA.array;
      const n = pts.length;
      for (let i = 0; i < TPTS; i++) {
        const j = Math.min(i, n - 1), q = pts[Math.max(0, j)] || p;
        const qn = pts[Math.min(n - 1, j + 1)] || q, qp = pts[Math.max(0, j - 1)] || q;
        tmpV.subVectors(qp, qn); if (tmpV.lengthSq() < 1e-8) tmpV.set(1, 0, 0); tmpV.normalize();
        tmpV2.subVectors(camLocal, q).normalize();
        tmpV3.crossVectors(tmpV, tmpV2).normalize();
        const u = n > 1 ? j / (n - 1) : 1; const w = t.width * (1 - u) * 0.5;
        pa[i * 6] = q.x + tmpV3.x * w; pa[i * 6 + 1] = q.y + tmpV3.y * w; pa[i * 6 + 2] = q.z + tmpV3.z * w;
        pa[i * 6 + 3] = q.x - tmpV3.x * w; pa[i * 6 + 4] = q.y - tmpV3.y * w; pa[i * 6 + 5] = q.z - tmpV3.z * w;
        const a = i < n ? (1 - u) * (1 - u) : 0; aa[i * 2] = a; aa[i * 2 + 1] = a;
      }
      t.mesh.geometry.attributes.position.needsUpdate = true; t.mesh.geometry.attributes.aA.needsUpdate = true;
    }
  }

  // ==================================================================
  // Composite effects
  // ==================================================================
  function burst(pos, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready) return;
    const p = toV(pos, tmpV3), c = toC(o.color, tmpC);
    const n = Math.max(0, Math.round(num(o.count, 24) * tierMul()));
    const sp = num(o.speed, 4), sz = num(o.size, 0.35), life = num(o.life, 0.7), gr = num(o.gravity, 2), drag = num(o.drag, 1.6);
    const flat = !!o.flat, up = num(o.up, 0.6), shape = o.star ? 1 : num(o.shape, 0.25);
    const hot = o.hot !== false;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = flat ? (Math.random() * 0.25) : (Math.random() * 2 - 1 + up) * 0.8;
      const s = sp * (0.35 + Math.random() * 0.85);
      const cx = Math.cos(a) * Math.cos(el), cz = Math.sin(a) * Math.cos(el), cy = Math.sin(el);
      // colour jitter toward white-hot for some particles
      const wk = hot && Math.random() < 0.3 ? 0.5 : 0;
      const cc = tmpC2.setRGB(c.r + (1 - c.r) * wk, c.g + (1 - c.g) * wk, c.b + (1 - c.b) * wk).multiplyScalar(num(o.intensity, 1.6));
      spawnP(p.x + cx * 0.1, p.y + cy * 0.1, p.z + cz * 0.1, cx * s, cy * s, cz * s, cc, sz * (0.5 + Math.random()), life * (0.5 + Math.random() * 0.7), gr, drag, Math.random() < shape ? 1 : 0);
    }
    if (o.flare !== false) flare(p, { color: o.color, size: num(o.flareSize, sz * 6 + 0.6), life: Math.min(0.35, life * 0.5) });
  }
  const tmpC2 = new THREE_.Color();
  function spark(pos, color, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready) return;
    burst(pos, { color, count: num(o.count, 7), speed: num(o.speed, 5), size: 0.22, life: 0.32, gravity: 3, drag: 3, shape: 0.6, flareSize: num(o.size, 1.0) });
  }
  function starFall(pos, color, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready) return;
    const end = toV(pos).clone();
    const side = Math.random() < 0.5 ? -1 : 1;
    const start = end.clone().add(new V(side * num(o.dx, 3 + Math.random() * 2), num(o.height, 12), -num(o.dz, 2 + Math.random() * 2)));
    const dur = num(o.dur, 0.45);
    const life = dur / 0.7;
    lance(start, end, { color, width: num(o.width, 0.45), life, travel: 0.7, tail: 0.45, flare: false, mode: 'streak',
      onEnd: null });
    // head flare + impact scheduled by a tiny timer on fx time
    timers.push({ t: dur, fn: () => { burst(end, { color, count: num(o.count, 20), speed: 4.5, size: 0.3, life: 0.6, gravity: 4, star: false, shape: 0.5 }); shockwave(end, { color, radius: num(o.radius, 1.8), life: 0.45, thickness: 0.25 }); flare(end, { color, size: 3, life: 0.35, star: true }); } });
    const head = flare(start, { color, size: 1.2, life: dur, grow: 0, star: true });
    if (head) movers.push({ obj: head, a: start, b: end, t: 0, dur });
  }
  const timers = [], movers = [];
  function updateTimers(dt) {
    for (let i = timers.length - 1; i >= 0; i--) { const t = timers[i]; t.t -= dt; if (t.t <= 0) { timers.splice(i, 1); try { t.fn(); } catch (e) { G.log.error('fx.timer', e); } } }
    for (let i = movers.length - 1; i >= 0; i--) { const m = movers[i]; m.t += dt; const k = G.clamp(m.t / m.dur); m.obj.position.lerpVectors(m.a, m.b, G.easeInCubic(k) * 0.4 + k * 0.6); if (k >= 1) movers.splice(i, 1); }
  }
  function lightning(from, to, o = {}) {
    if (!o || typeof o !== 'object') o = {};
    if (!ready) return;
    const a = toV(from).clone(), b = toV(to).clone();
    const segs = Math.round(num(o.segments, 9)), jag = num(o.jag, 0.12) * a.distanceTo(b);
    let prev = a.clone();
    for (let i = 1; i <= segs; i++) {
      const p = new V().lerpVectors(a, b, i / segs);
      if (i < segs) p.add(new V((Math.random() - 0.5) * jag, (Math.random() - 0.5) * jag * 0.6, (Math.random() - 0.5) * jag));
      lance(prev, p, { color: o.color || '#cfe8ff', width: num(o.width, 0.22), life: num(o.life, 0.22), mode: 'bolt', flare: false, intensity: 2.4 });
      prev = p;
    }
    flare(b, { color: o.color || '#cfe8ff', size: 3.2, life: 0.25 });
  }
  function flash(cssColor = '#ffffff', intensity = 0.4, dur = 0.3) {
    try { G.post && G.post.flash(cssColor, num(intensity, 0.4), num(dur, 0.3)); } catch (e) { G.log.error('fx.flash', e); }
  }
  function glowSprite(color = GOLD, size = 1, o = {}) { return G.mat.glowSprite(color, size, o); }

  // ==================================================================
  // module
  // ==================================================================
  G.fx = {
    showNumbers: true,
    init() {
      layer = G.layers.fx;
      initParticles(); initFlares(); initLances(); initShock(); initRingFlash(); initShards(); initNumbers();
      ready = true;
      G.on('fightEnd', () => {});
    },
    update(dt) {
      if (!ready) return;
      dt = dt || 0;
      if (G.camera) { camLocal.copy(G.camera.position); layer.worldToLocal(camLocal); }
      updateTimers(dt); updateParticles(dt); updateFlares(dt); updateLances(dt); updateShock(dt); updateRingFlash(dt); updateShards(dt); updateNumbers(dt); updateTrails(dt);
    },
    clear() {
      if (!ready) return;
      P.life.fill(0); P.hi = 0; P.head = 0; P.geo.setDrawRange(0, 0);
      for (const s of FL) s.visible = false;
      for (const m of LN) { m.visible = false; m.userData.onEnd = null; }
      for (const m of SW) m.visible = false;
      for (const m of RF) m.visible = false;
      SH.life.fill(0); SH.n = 0; SH.mesh.count = 0;
      NUM.list.length = 0; NUM.mesh.geometry.instanceCount = 0;
      timers.length = 0; movers.length = 0;
      for (const t of TRAILS) t.pts.length = 0;
    },
    burst, lance, beam: lance, shockwave, ring: shockwave, flash, number, text: (pos, str, o = {}) => number(pos, 0, { ...o, text: str }),
    spark, trail, glowSprite, starFall, ringFlash, shards, lightning, flare,
    stats() { return { particles: P.active, lances: LN.filter((m) => m.visible).length, numbers: NUM.list.length, trails: TRAILS.length }; },
  };
})();
