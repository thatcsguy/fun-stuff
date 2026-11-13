// FX: GPU particles, shockwave rings, light pillars, beams, lightning, slashes, domes, missiles, pooled lights, floating numbers.
const FX = (() => {
  const fxRoot = new THREE.Group(); fxRoot.name = 'fx'; scene.add(fxRoot);
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color(), tv = new V3(), tv2 = new V3();

  // ---- particles ----
  function makeParticles(N, additive) {
    const geo = new THREE.BufferGeometry();
    const aPos = new THREE.BufferAttribute(new Float32Array(N * 3), 3), aVel = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
    const aData = new THREE.BufferAttribute(new Float32Array(N * 4), 4), aCol = new THREE.BufferAttribute(new Float32Array(N * 4), 4), aCol2 = new THREE.BufferAttribute(new Float32Array(N * 4), 4);
    for (const a of [aPos, aVel, aData, aCol, aCol2]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', aPos); geo.setAttribute('aVel', aVel); geo.setAttribute('aData', aData); geo.setAttribute('aCol', aCol); geo.setAttribute('aCol2', aCol2);
    for (let i = 0; i < N; i++) aData.array[i * 4] = -1000;
    geo.boundingSphere = new THREE.Sphere(new V3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 600 } },
      vertexShader: `
        attribute vec3 aVel; attribute vec4 aData, aCol, aCol2; uniform float uTime, uScale; varying vec4 vCol; varying float vT; varying float vNear;
        void main(){
          float age = uTime - aData.x; float t = age / aData.y; vT = t;
          if (t < 0.0 || t > 1.0) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; return; }
          float drag = aCol2.a; float k = drag > 0.001 ? (1.0-exp(-drag*age))/drag : age;
          vec3 p = position + aVel*k + vec3(0.0, -0.5*aData.w*age*age, 0.0);
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          vCol = vec4(mix(aCol.rgb, aCol2.rgb, t), aCol.a);
          float s = aData.z * (t < 0.12 ? 0.5 + t*4.17 : 1.0 - smoothstep(0.55,1.0,t)*0.7);
          gl_PointSize = s * uScale / max(0.1,-mv.z); vNear = smoothstep(0.8, 3.0, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec4 vCol; varying float vT; varying float vNear;
        void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c)*2.0; if (d > 1.0) discard;
          float a = ${additive ? 'pow(clamp(1.0-d,0.0,1.0),1.6)' : 'smoothstep(1.0,0.35,d)'} * (1.0 - smoothstep(0.6,1.0,vT)) * vCol.a * vNear;
          gl_FragColor = vec4(vCol.rgb${additive ? '*a' : ''}, a); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 20; fxRoot.add(pts);
    return { N, geo, mat, aPos, aVel, aData, aCol, aCol2, head: 0, lo: N, hi: -1, pts };
  }
  const PA = makeParticles(14000, true), PS = makeParticles(2500, false);
  function put(S, x, y, z, vx, vy, vz, life, size, grav, drag, c1, c2, alpha) {
    const i = S.head; S.head = (S.head + 1) % S.N;
    if (i < S.lo) S.lo = i; if (i > S.hi) S.hi = i;
    let j = i * 3; S.aPos.array[j] = x; S.aPos.array[j + 1] = y; S.aPos.array[j + 2] = z; S.aVel.array[j] = vx; S.aVel.array[j + 1] = vy; S.aVel.array[j + 2] = vz;
    j = i * 4; S.aData.array[j] = G.now; S.aData.array[j + 1] = life; S.aData.array[j + 2] = size; S.aData.array[j + 3] = grav;
    S.aCol.array[j] = c1.r; S.aCol.array[j + 1] = c1.g; S.aCol.array[j + 2] = c1.b; S.aCol.array[j + 3] = alpha;
    S.aCol2.array[j] = c2.r; S.aCol2.array[j + 1] = c2.g; S.aCol2.array[j + 2] = c2.b; S.aCol2.array[j + 3] = drag;
  }
  function flush(S) {
    S.mat.uniforms.uTime.value = G.now; S.mat.uniforms.uScale.value = renderer.domElement.height * 0.5;
    if (S.hi < 0) return;
    for (const a of [S.aPos, S.aVel]) { a.clearUpdateRanges(); a.addUpdateRange(S.lo * 3, (S.hi - S.lo + 1) * 3); a.needsUpdate = true; }
    for (const a of [S.aData, S.aCol, S.aCol2]) { a.clearUpdateRanges(); a.addUpdateRange(S.lo * 4, (S.hi - S.lo + 1) * 4); a.needsUpdate = true; }
    S.lo = S.N; S.hi = -1;
  }
  // burst(x,y,z,{n, speed:[a,b], dir:[x,y,z], spread (0..1, 1=sphere), up, color, color2, size:[a,b], life:[a,b], grav, drag, smoke, alpha, radius})
  function burst(x, y, z, o = {}) {
    if (G.headless) return;
    const S = o.smoke ? PS : PA; let n = Math.max(1, Math.round((o.n || 12) * G.q.part));
    const sp = o.speed || [2, 6], sz = o.size || [0.2, 0.5], lf = o.life || [0.4, 0.9], spread = o.spread === undefined ? 1 : o.spread, d = o.dir;
    tmpC.set(o.color === undefined ? 0xffffff : o.color); tmpC2.set(o.color2 === undefined ? (o.color === undefined ? 0xffffff : o.color) : o.color2);
    const m = o.mult || (o.smoke ? 1 : 1.6); tmpC.multiplyScalar(m); tmpC2.multiplyScalar(m);
    const rad = o.radius || 0;
    for (let i = 0; i < n; i++) {
      let vx = vrand() * 2 - 1, vy = vrand() * 2 - 1, vz = vrand() * 2 - 1; const l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l;
      if (o.flat) { vy *= 0.12; }
      if (d) { vx = d[0] + vx * spread; vy = d[1] + vy * spread; vz = d[2] + vz * spread; const l2 = Math.hypot(vx, vy, vz) || 1; vx /= l2; vy /= l2; vz /= l2; }
      const s = sp[0] + vrand() * (sp[1] - sp[0]);
      let px = x, py = y, pz = z;
      if (rad) { const a = vrand() * TAU, r = Math.sqrt(vrand()) * rad; px += Math.sin(a) * r; pz += Math.cos(a) * r; }
      put(S, px, py, pz, vx * s, vy * s + (o.up || 0), vz * s, lf[0] + vrand() * (lf[1] - lf[0]), sz[0] + vrand() * (sz[1] - sz[0]), o.grav || 0, o.drag || 0, tmpC, tmpC2, o.alpha === undefined ? 1 : o.alpha);
    }
  }

  // ---- pooled meshes ----
  const pools = {};
  function pool(name, n, make) { const P = pools[name] = { items: [], i: 0 }; for (let k = 0; k < n; k++) { const m = make(); m.visible = false; m.userData.t = 0; m.userData.dur = 0; fxRoot.add(m); P.items.push(m); } return P; }
  function take(name) { const P = pools[name]; const m = P.items[P.i]; P.i = (P.i + 1) % P.items.length; m.visible = true; m.userData.t = 0; return m; }
  const planeGeo = new THREE.PlaneGeometry(2, 2); planeGeo.rotateX(-PI / 2); planeGeo.userData.shared = true;

  pool('ring', 28, () => new THREE.Mesh(planeGeo, new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color() }, uR: { value: 0 }, uW: { value: 0.1 }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vP; void main(){ vP=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uC; uniform float uR,uW,uA; varying vec2 vP; void main(){ float d=length(vP); float a=smoothstep(uR-uW,uR,d)*(1.0-smoothstep(uR,uR+uW*0.25,d)); a+=0.25*smoothstep(uR-uW*3.0,uR,d)*(1.0-step(uR,d)); gl_FragColor=vec4(uC*a*uA,a*uA); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })));
  function ring(x, z, o = {}) {
    if (G.headless) return; const m = take('ring'), u = m.material.uniforms;
    m.position.set(x, o.y === undefined ? 0.08 : o.y, z); m.userData.dur = o.dur || 0.5; m.userData.r0 = o.r0 || 0.2; m.userData.r1 = o.r1 || 6;
    u.uC.value.set(o.color || 0xffffff).multiplyScalar(o.mult || 2); u.uW.value = o.width || 0.12; m.scale.setScalar(Math.max(m.userData.r0, m.userData.r1) * 1.1); m.renderOrder = 12; return m;
  }

  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true); cylGeo.translate(0, 0.5, 0); cylGeo.userData.shared = true;
  pool('pillar', 20, () => new THREE.Mesh(cylGeo, new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color() }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=abs(dot(normalize(vN),normalize(vV))); float a=pow(clamp(1.0-vUv.y,0.0,1.0),1.5)*(0.25+0.75*f*f)*uA; gl_FragColor=vec4(uC*a,a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })));
  function pillar(x, z, o = {}) {
    if (G.headless) return; const m = take('pillar');
    m.position.set(x, o.y || 0, z); m.scale.set(o.r || 1, o.h || 14, o.r || 1); m.userData.dur = o.dur || 0.6; m.userData.r = o.r || 1;
    m.material.uniforms.uC.value.set(o.color || 0xffffff).multiplyScalar(o.mult || 2.2); return m;
  }

  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); beamGeo.rotateX(PI / 2); beamGeo.userData.shared = true;
  pool('beam', 20, () => new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color() }, uA: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f=abs(dot(normalize(vN),normalize(vV))); float a=pow(f,2.2)*uA; gl_FragColor=vec4(uC*a+vec3(1.0)*pow(f,9.0)*uA,a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })));
  function beam(a, b, o = {}) {
    if (G.headless) return null; const m = take('beam');
    setBeam(m, a, b, o.width || 0.25); m.userData.dur = o.dur || 0.3; m.userData.w = o.width || 0.25; m.userData.hold = o.hold || 0;
    m.material.uniforms.uC.value.set(o.color || 0xffffff).multiplyScalar(o.mult || 2.5); return m;
  }
  function setBeam(m, a, b, w) { tv.copy(b).sub(a); const len = tv.length(); m.position.copy(a).addScaledVector(tv, 0.5); m.lookAt(b); m.scale.set(w, w, len); }

  // lightning: cross-ribbon along a jagged path
  const LSEG = 12;
  pool('bolt', 12, () => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LSEG * 2 * 6 * 3), 3)); g.boundingSphere = new THREE.Sphere(new V3(), 1e6);
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  });
  function lightning(a, b, o = {}) {
    if (G.headless) return; const m = take('bolt'), arr = m.geometry.attributes.position.array, w = o.width || 0.12, jag = o.jag === undefined ? 0.9 : o.jag;
    const pts = []; for (let i = 0; i <= LSEG; i++) { const t = i / LSEG, e = Math.sin(t * PI); pts.push(new V3(lerp(a.x, b.x, t) + (vrand() - 0.5) * jag * e * 2, lerp(a.y, b.y, t) + (vrand() - 0.5) * jag * e * 2, lerp(a.z, b.z, t) + (vrand() - 0.5) * jag * e * 2)); }
    let k = 0; const quad = (p, q, ox, oy, oz) => { const P = [p.x - ox, p.y - oy, p.z - oz, p.x + ox, p.y + oy, p.z + oz, q.x + ox, q.y + oy, q.z + oz, p.x - ox, p.y - oy, p.z - oz, q.x + ox, q.y + oy, q.z + oz, q.x - ox, q.y - oy, q.z - oz]; for (let i = 0; i < 18; i++) arr[k++] = P[i]; };
    for (let i = 0; i < LSEG; i++) { quad(pts[i], pts[i + 1], w, 0, 0); quad(pts[i], pts[i + 1], 0, w, w * 0.6); }
    m.geometry.attributes.position.needsUpdate = true; m.frustumCulled = false; m.userData.dur = o.dur || 0.22;
    m.userData.col = tmpC.set(o.color || 0xbfe4ff).multiplyScalar(o.mult || 3).clone(); m.material.color.copy(m.userData.col);
    if (o.sparks !== false) burst(b.x, b.y, b.z, { n: 10, color: o.color || 0xbfe4ff, speed: [2, 9], life: [0.15, 0.4], size: [0.12, 0.3] });
  }

  const slashGeo = new THREE.RingGeometry(0.55, 1, 40, 1, -1.2, 2.4); slashGeo.rotateX(-PI / 2); slashGeo.userData.shared = true;
  pool('slash', 10, () => new THREE.Mesh(slashGeo, new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color() }, uT: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vP=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uC; uniform float uT; varying vec2 vP; void main(){ float r=length(vP); float an=atan(vP.y,vP.x)/1.2; float head=mix(-1.1,1.6,sqrt(uT)); float edge=smoothstep(0.55,1.0,r); float a=edge*edge*(1.0-smoothstep(head-0.12,head,an))*exp(-max(0.0,head-an)*1.4)*(1.0-uT*uT); a*=1.0-smoothstep(0.75,1.0,abs(an)); gl_FragColor=vec4(uC*a+vec3(1.0)*a*edge*edge*0.6,a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })));
  // slash(x,y,z, facing, {r, color, dur, tilt, flip}): a crescent arc in front of `facing`
  function slash(x, y, z, facing, o = {}) {
    if (G.headless) return; const m = take('slash');
    m.position.set(x, y, z); m.rotation.set(0, 0, 0); m.rotation.order = 'YXZ'; m.rotation.y = facing - PI / 2; m.rotation.z = o.tilt || 0; m.rotation.x = o.pitch || 0;
    const r = o.r || 3; m.scale.set(r, r, o.flip ? -r : r); m.userData.dur = o.dur || 0.22;
    m.material.uniforms.uC.value.set(o.color || 0xffffff).multiplyScalar(o.mult || 2.5);
  }

  const sphGeo = new THREE.SphereGeometry(1, 32, 20); sphGeo.userData.shared = true;
  pool('dome', 8, () => new THREE.Mesh(sphGeo, new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color() }, uA: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f=1.0-abs(dot(normalize(vN),normalize(vV))); float a=pow(f,2.5)*uA; gl_FragColor=vec4(uC*a,a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })));
  function dome(x, y, z, o = {}) {
    if (G.headless) return; const m = take('dome'); m.position.set(x, y, z); m.userData.dur = o.dur || 0.5; m.userData.r0 = o.r0 || 0.3; m.userData.r1 = o.r || 5;
    m.material.uniforms.uC.value.set(o.color || 0xffffff).multiplyScalar(o.mult || 2);
  }

  // pooled point lights (always in the scene so shaders never recompile)
  const lights = []; for (let i = 0; i < 4; i++) { const L = new THREE.PointLight(0xffffff, 0, 30, 1.6); L.userData = { t: 0, dur: 0, I: 0 }; scene.add(L); lights.push(L); }
  let li = 0;
  function light(x, y, z, color, intensity = 40, dur = 0.4, range = 26) { if (G.headless) return; const L = lights[li]; li = (li + 1) % lights.length; L.position.set(x, y, z); L.color.set(color); L.distance = range; L.userData.t = 0; L.userData.dur = dur; L.userData.I = intensity; L.intensity = intensity; }

  // ---- missiles: glowing orbs that fly to a point/entity and call back ----
  const missiles = [];
  const orbGeo = new THREE.SphereGeometry(1, 12, 8); orbGeo.userData.shared = true;
  function missile(from, to, o = {}) {
    const m = { p: from.clone(), to, speed: o.speed || 40, color: o.color || 0xffffff, size: o.size || 0.25, onHit: o.onHit, arc: o.arc || 0, t: 0, total: 0, start: from.clone(), mesh: null };
    const tp = to.isVector3 ? to : to.aim(tv); m.total = Math.max(0.05, from.distanceTo(tp) / m.speed);
    if (!G.headless) { m.mesh = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(m.color).multiplyScalar(3) })); m.mesh.scale.setScalar(m.size); m.mesh.position.copy(from); fxRoot.add(m.mesh); }
    missiles.push(m); return m;
  }

  // ---- floating numbers ----
  const numRoot = $('#nums'), nums = [];
  function num(pos, text, cls = '') {
    if (G.headless) return; let n = nums.find((q) => q.t >= q.dur);
    if (!n) { if (nums.length > 40) return; n = { el: document.createElement('div'), p: new V3(), t: 0, dur: 1, ox: 0 }; numRoot.appendChild(n.el); nums.push(n); }
    n.el.className = 'num ' + cls; n.el.textContent = text; n.p.copy(pos); n.t = 0; n.dur = cls.includes('note') ? 1.3 : 0.9; n.ox = (vrand() - 0.5) * 60; n.el.style.display = '';
  }

  function shake(amt) { if (typeof Cam !== 'undefined') Cam.shakeAmt = Math.min(1.6, Math.max(Cam.shakeAmt, amt)); }
  // one-call impact: particles + ring + light + shake
  function impact(x, y, z, color, size = 1) {
    burst(x, y, z, { n: 14 * size, color, speed: [3 * size, 10 * size], life: [0.25, 0.6], size: [0.15, 0.45] });
    ring(x, z, { r0: 0.2, r1: 3.5 * size, color, dur: 0.35 }); light(x, y + 1, z, color, 30 * size, 0.3);
  }
  // big explosion
  function explode(x, y, z, color, r = 5, color2) {
    burst(x, y, z, { n: 50, color, color2: color2 || color, speed: [r, r * 3.2], life: [0.4, 1.1], size: [0.3, 0.9], drag: 2.2 });
    burst(x, y + 0.3, z, { n: 14, smoke: true, color: 0x2a2622, color2: 0x0a0908, speed: [1, r * 0.7], life: [0.9, 1.8], size: [1.2, 2.8], up: 2, alpha: 0.5, drag: 1.5 });
    ring(x, z, { r0: 0.3, r1: r * 1.3, color, dur: 0.5, width: 0.16 }); dome(x, y, z, { r, color, dur: 0.45 }); light(x, y + 1.5, z, color, 90, 0.5, r * 5); shake(Math.min(1, r / 9));
  }

  function update(dt) {
    if (G.headless) { for (let i = missiles.length - 1; i >= 0; i--) { const m = missiles[i]; m.t += dt; if (m.t >= m.total) { missiles.splice(i, 1); if (m.mesh) { fxRoot.remove(m.mesh); m.mesh.material.dispose(); } if (m.onHit) m.onHit(); } } for (const n of nums) if (n.t < n.dur) { n.t = n.dur; n.el.style.display = "none"; } return; }
    flush(PA); flush(PS);
    for (const name in pools) for (const m of pools[name].items) {
      if (!m.visible) continue; const u = m.userData; u.t += dt; const k = u.t / u.dur;
      if (k >= 1 + (u.hold || 0) / u.dur) { m.visible = false; continue; }
      const kk = sat(k);
      if (name === 'ring') { m.material.uniforms.uR.value = lerp(u.r0, u.r1, 1 - Math.pow(1 - kk, 2.2)) / (Math.max(u.r0, u.r1) * 1.1); m.material.uniforms.uA.value = 1 - kk * kk; }
      else if (name === 'pillar') { m.material.uniforms.uA.value = (1 - kk) * (1 - kk); m.scale.x = m.scale.z = u.r * (1 - kk * 0.4); }
      else if (name === 'beam') { const a = u.t < u.hold ? 1 : 1 - sat((u.t - u.hold) / u.dur); m.material.uniforms.uA.value = a; m.scale.x = m.scale.y = u.w * (0.3 + 0.7 * a); if (a <= 0) m.visible = false; }
      else if (name === 'bolt') { const fl = (1 - kk) * (vrand() > 0.25 ? 1 : 0.3); m.material.color.copy(u.col).multiplyScalar(fl); }
      else if (name === 'slash') m.material.uniforms.uT.value = kk;
      else if (name === 'dome') { m.scale.setScalar(lerp(u.r0, u.r1, 1 - Math.pow(1 - kk, 2.5))); m.material.uniforms.uA.value = (1 - kk); }
    }
    for (const L of lights) { if (L.intensity <= 0) continue; L.userData.t += dt; L.intensity = L.userData.I * Math.max(0, 1 - L.userData.t / L.userData.dur); }
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i]; m.t += dt; const k = sat(m.t / m.total), tp = m.to.isVector3 ? m.to : m.to.aim(tv2);
      m.p.lerpVectors(m.start, tp, k); m.p.y += Math.sin(k * PI) * m.arc;
      if (m.mesh) m.mesh.position.copy(m.p);
      burst(m.p.x, m.p.y, m.p.z, { n: 2, color: m.color, speed: [0, 1], life: [0.15, 0.4], size: [m.size * 0.8, m.size * 1.8] });
      if (k >= 1) { missiles.splice(i, 1); if (m.mesh) { fxRoot.remove(m.mesh); m.mesh.material.dispose(); } if (m.onHit) m.onHit(); }
    }
  }
  function frameUpdate(rdt) {
    const w = innerWidth, h = innerHeight;
    for (const n of nums) {
      if (n.t >= n.dur) continue; n.t += rdt;
      if (n.t >= n.dur) { n.el.style.display = 'none'; continue; }
      tv.copy(n.p).project(camera);
      if (tv.z > 1) { n.el.style.display = 'none'; continue; }
      const k = n.t / n.dur;
      n.el.style.transform = `translate(${((tv.x * 0.5 + 0.5) * w + n.ox * k).toFixed(1)}px,${((-tv.y * 0.5 + 0.5) * h - 30 - k * 60).toFixed(1)}px) translate(-50%,-50%) scale(${(k < 0.12 ? 0.7 + k * 5 : 1.3 - k * 0.4).toFixed(2)})`;
      n.el.style.opacity = (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3).toFixed(2);
    }
  }
  function clear() {
    for (const name in pools) for (const m of pools[name].items) m.visible = false;
    for (const m of missiles) if (m.mesh) { fxRoot.remove(m.mesh); m.mesh.material.dispose(); }
    missiles.length = 0; for (const L of lights) L.intensity = 0;
    for (const S of [PA, PS]) { for (let i = 0; i < S.N; i++) S.aData.array[i * 4] = -1000; S.lo = 0; S.hi = S.N - 1; }
    for (const n of nums) { n.t = n.dur; n.el.style.display = 'none'; }
  }
  Hooks.step.push(update);
  Hooks.frame.push((rdt, stage) => { if (stage === 1) frameUpdate(rdt); });
  return { root: fxRoot, burst, ring, pillar, beam, setBeam, lightning, slash, dome, light, missile, num, shake, impact, explode, clear, flash: (c, a, d) => { if (!G.headless) Post.flash(c, a, d); }, kick: (a) => Post.kick(a) };
})();
