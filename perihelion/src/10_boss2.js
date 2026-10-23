// =====================================================================
// 10_boss2.js: boss 2, OUROS, the Aurora Coil (SPEC 9 "Boss 2").
// The escalator: four phases, each one transforming the aurora sky and the
// arena. A brass-vertebra serpent coiled around a central pillar; its head
// rears over the arena, and loops of its body surface through the rings and
// move (in Tide one loop lies on the middle ring as a moving blocker).
//   P1 Veil   (100-75%) curtains, lunar wisps, coil lash, constrict, Siren Song
//   P2 Tide   ( 75-50%) inner ring floods (slow + safe from the tide), coil
//                       blocker on the middle ring, Tidal Pull, spit bolts
//   P3 Bloom  ( 50-20%) nebula lotus, Star Seeds (soaks), Venom Beam, lashes
//   P4 Storm  ( 20- 0%) storm wall + 60 s timer, Sky Dive (lethal spoke),
//                       thunder bolts, fast curtains, Maelstrom enrage
// Owns: G.bosses[1]. Everything it creates lives under b.root or a group in
// G.layers.boss (removed by combat.reset); teardown() undoes world state.
// =====================================================================
(() => {
  const T3 = (typeof THREE !== 'undefined') ? THREE : G.THREE;
  const PI = Math.PI, TAU = PI * 2;
  const ACC = '#3dffa2', ROSE = '#ff5f9e', VIOLET = '#8a6cff', GOLDH = '#fff1c2', GOLD = '#ffc94d';
  const TH = 0.68, TY = 0.05;
  const RR = () => G.RINGS || [5.5, 9.0, 12.5];
  const wrap = (a) => a - TAU * Math.floor((a + PI) / TAU);
  const angDiff = (a, b) => wrap(a - b);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const ringRf = (f) => { const R = RR(); return R[0] + (R[2] - R[0]) / 2 * f; };
  const P = () => G.player.state;
  const logE = (w, e) => { try { G.log.error('boss2.' + w, e); } catch (_) { console.error(w, e); } };
  const fx = (n, ...a) => { try { const f = G.fx && G.fx[n]; return f ? f.apply(G.fx, a) : undefined; } catch (e) { logE('fx.' + n, e); } };
  const sfx = (n, o) => { try { G.audio && G.audio.sfx && G.audio.sfx(n, o || {}); } catch (e) { /* audio is optional */ } };
  const world = (n, ...a) => { try { const f = G.world && G.world[n]; return f ? f.apply(G.world, a) : undefined; } catch (e) { logE('world.' + n, e); } };
  const post = (n, ...a) => { try { const f = G.post && G.post[n]; return f ? f.apply(G.post, a) : undefined; } catch (e) { /* post is optional */ } };
  const cam = (n, ...a) => { try { const f = G.cam && G.cam[n]; return f ? f.apply(G.cam, a) : undefined; } catch (e) { logE('cam.' + n, e); } };
  const cwait = (s) => G.combat.wait(s);
  const V3 = (x = 0, y = 0, z = 0) => new T3.Vector3(x, y, z);
  const homePos = () => (G.cam && G.cam.playPose ? G.cam.playPose.pos.toArray() : [0, 20, 16]);
  const inArcR = (ring, theta, c, half, pad) => Math.abs(angDiff(theta, c)) < half + (0.15 + (pad || 0)) / RR()[ring];

  // local (boss frame, +x = facing) <-> play-local world
  const toWorld = (b, v, out) => { const f = b.facing, c = Math.cos(f), s = Math.sin(f); out = out || V3(); const x = v.x * c + v.z * s, z = -v.x * s + v.z * c; return out.set(x, v.y + (b.root ? b.root.position.y : 0), z); };
  const localOfTheta = (b, theta, r, y, out) => { const rel = angDiff(theta, b.facing); return (out || V3()).set(r * Math.cos(rel), y, -r * Math.sin(rel)); };

  // =================================================================== SHADERS
  const RIB_VS = `attribute float aA; varying vec2 vUv; varying float vA;
    void main(){ vUv = uv; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const RIB_FS = `uniform float uTime, uI; uniform vec3 uC1, uC2, uC3; varying vec2 vUv; varying float vA;
    void main(){
      float u = vUv.x, v = vUv.y;
      float rays = 0.55 + 0.45 * sin(u * 46.0 - uTime * 2.3 + sin(u * 9.0 + uTime * 0.7) * 2.5);
      rays *= 0.65 + 0.35 * sin(u * 13.0 + uTime * 1.3);
      float edge = smoothstep(0.0, 0.14, v) * pow(1.0 - v, 1.3);
      float base = exp(-v * 5.0) * 0.7;
      vec3 c = mix(uC1, uC2, smoothstep(0.2, 0.95, v + 0.25 * sin(u * 4.0 + uTime * 0.5)));
      c = mix(c, uC3, smoothstep(0.7, 1.0, v) * 0.6);
      float I = (base + rays * edge * 1.1) * vA * uI;
      if (I < 0.003) discard;
      gl_FragColor = vec4(c * I, 1.0);
    }`;
  // curtain: u along the arc, v up; uAlpha is shared with the hazard's band so it fades with it
  const CURT_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const CURT_FS = `uniform float uTime, uAlpha, uLive, uProg; uniform vec3 uC1, uC2, uC3; varying vec2 vUv;
    void main(){
      float u = vUv.x, v = vUv.y;
      float rays = 0.5 + 0.5 * sin(u * 37.0 + uTime * 1.7 + sin(u * 11.0 - uTime * 0.9) * 2.0);
      rays = pow(rays, 2.0) * (0.6 + 0.4 * sin(u * 7.0 - uTime * 2.6));
      float ends = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.88, u);
      float h = mix(0.35 + 0.55 * uProg, 1.0, uLive);
      float top = 1.0 - smoothstep(h * 0.55, h, v);
      float bottom = exp(-v * 7.0) * 1.3;
      vec3 c = mix(uC1, uC2, smoothstep(0.25, 0.9, v)); c = mix(c, uC3, smoothstep(0.75, 1.0, v) * 0.5);
      float I = (bottom + rays * top * (0.45 + 0.55 * uLive)) * ends * uAlpha * (0.35 + 0.65 * max(uLive, uProg));
      if (I < 0.003) discard;
      gl_FragColor = vec4(c * I * 0.75, 1.0);
    }`;
  const POOL_FS = `uniform float uTime, uI; uniform vec3 uC1, uC2; varying vec2 vP;
    void main(){ float r = length(vP); float a = atan(vP.y, vP.x);
      float sw = sin(a * 5.0 + r * 3.0 - uTime * 1.5) * 0.5 + 0.5;
      float sw2 = sin(a * 3.0 - r * 4.0 + uTime * 1.1) * 0.5 + 0.5;
      float ring = smoothstep(2.7, 2.1, r) * smoothstep(0.45, 0.95, r);
      vec3 c = mix(uC1, uC2, sw2 * smoothstep(0.8, 2.4, r));
      float I = ring * (0.25 + 0.75 * pow(sw, 3.0)) + exp(-pow((r - 2.45) * 7.0, 2.0)) * 0.9;
      if (I < 0.003) discard;
      gl_FragColor = vec4(c * I * uI, 1.0); }`;
  const POOL_VS = `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const ORB_VS = `varying vec3 vN; varying vec3 vV; varying vec3 vL;
    void main(){ vN = normalize(normalMatrix * normal); vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const ORB_FS = `uniform float uTime, uI; uniform vec3 uC1, uC2; varying vec3 vN; varying vec3 vV; varying vec3 vL;
    void main(){ float fr = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
      float b1 = sin(vL.y * 9.0 + sin(atan(vL.z, vL.x) * 3.0 + uTime) * 1.5 - uTime * 2.0) * 0.5 + 0.5;
      vec3 c = mix(uC1, uC2, b1);
      gl_FragColor = vec4(c * (0.35 + b1 * 0.9 + fr * 2.2) * uI, 1.0); }`;
  // storm wall: alpha-blended churning cloud band with lightning flicker
  const STORM_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const STORM_FS = `uniform float uTime, uA, uFlash, uClose; uniform vec3 uC1, uC2; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){ vec2 p = vec2(vUv.x * 40.0, vUv.y * 4.0);
      float c = n(p + vec2(uTime * 0.6, -uTime * 0.2)) * 0.6 + n(p * 2.1 - vec2(uTime * 1.1, 0.0)) * 0.3 + n(p * 4.3) * 0.1;
      float band = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
      float a = band * smoothstep(0.25, 0.75, c) * uA * (0.55 + 0.35 * uClose);
      vec3 col = mix(uC1, uC2, c) * (0.35 + 0.5 * c) + vec3(0.75, 0.9, 1.0) * uFlash * c * 1.4;
      float rim = exp(-vUv.y * 10.0) * 0.6 * uA;
      gl_FragColor = vec4(col + uC2 * rim, clamp(a + rim * 0.5, 0.0, 0.92)); }`;
  // lotus petals (P3 bloom) under the arena
  const LOTUS_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const LOTUS_FS = `uniform float uTime, uA; uniform vec3 uC1, uC2; varying vec2 vUv;
    void main(){ float u = vUv.x, v = vUv.y;   // u across the petal (0..1), v along it (0 base .. 1 tip)
      float w = sin(v * 3.14159) * 0.5 + 0.5 * (1.0 - v);
      float d = abs(u - 0.5) * 2.0;
      float body = smoothstep(w, w - 0.25, d);
      float vein = exp(-pow((u - 0.5) * 30.0, 2.0)) * 0.6 + exp(-pow(d - w * 0.85, 2.0) * 300.0) * 0.8;
      vec3 c = mix(uC1, uC2, smoothstep(0.1, 0.95, v + 0.1 * sin(uTime + u * 6.0)));
      float I = (body * (0.18 + 0.25 * v) + vein * body) * uA * (0.8 + 0.2 * sin(uTime * 1.3 + v * 5.0));
      if (I < 0.003) discard;
      gl_FragColor = vec4(c * I, 1.0); }`;
  // flowing liquid light on the flooded inner ring (P2)
  const FLOOD_FS = `uniform float uTime, uA; uniform vec3 uC1, uC2; varying vec2 vP;
    void main(){ float r = length(vP); float a = atan(vP.y, vP.x);
      float d = abs(r - 5.5) / 0.95;
      float edge = smoothstep(1.0, 0.75, d);
      float w1 = sin(a * 22.0 - uTime * 1.6 + sin(a * 5.0 + uTime) * 1.5 + r * 2.0) * 0.5 + 0.5;
      float w2 = sin(a * 37.0 + uTime * 2.3 - r * 3.0) * 0.5 + 0.5;
      float caust = pow(w1 * w2, 2.0);
      float lip = exp(-pow((d - 0.82) * 9.0, 2.0));
      vec3 c = mix(uC2, uC1, w1);
      float I = (0.10 + caust * 0.8 + lip * 0.7) * edge * uA;
      if (I < 0.003) discard;
      gl_FragColor = vec4(c * I, 1.0); }`;
  // pouring aurora (T1)
  const POUR_FS = `uniform float uTime, uA; uniform vec3 uC1, uC2; varying vec2 vUv;
    void main(){ float u = vUv.x, v = vUv.y;
      float core = exp(-pow((u - 0.5) * 5.0, 2.0));
      float flow = 0.55 + 0.45 * sin(v * 22.0 + uTime * 9.0 + u * 4.0);
      vec3 c = mix(uC1, uC2, v);
      float I = core * flow * uA * smoothstep(0.0, 0.08, v) * (1.0 - smoothstep(0.85, 1.0, v));
      if (I < 0.003) discard;
      gl_FragColor = vec4(c * I * 0.7, 1.0); }`;

  // ================================================================ GEOMETRY
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); draw(x, w, h);
    const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace; t.wrapS = t.wrapT = T3.RepeatWrapping; t.anisotropy = 4;
    return t;
  }
  // emissive rune map for the pillar and the vertebra plates
  function runeTex() {
    return canvasTex(256, 512, (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#fff'; x.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const y = 24 + i * 56;
        x.globalAlpha = 0.9; x.lineWidth = 3; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke();
        x.globalAlpha = 0.55; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, y + 7); x.lineTo(w, y + 7); x.stroke();
        for (let k = 0; k < 6; k++) {
          const cx = 20 + k * 42 + (i % 2) * 20, cy = y + 30; x.globalAlpha = 0.85; x.lineWidth = 2;
          x.beginPath();
          const t = (i * 7 + k * 3) % 5;
          if (t === 0) { x.arc(cx, cy, 8, 0.3, PI * 1.7); }
          else if (t === 1) { x.moveTo(cx - 8, cy + 8); x.lineTo(cx, cy - 9); x.lineTo(cx + 8, cy + 8); }
          else if (t === 2) { x.moveTo(cx, cy - 9); x.lineTo(cx, cy + 9); x.moveTo(cx - 7, cy - 2); x.lineTo(cx + 7, cy - 2); }
          else if (t === 3) { x.arc(cx, cy, 5, 0, TAU); x.moveTo(cx + 9, cy); x.arc(cx, cy, 9, 0, PI); }
          else { x.moveTo(cx - 8, cy - 6); x.quadraticCurveTo(cx + 10, cy, cx - 8, cy + 7); }
          x.stroke();
        }
      }
    });
  }
  // tapered tube along a curve (horns)
  function taperTube(curve, n, r0, r1, radial = 8) {
    const frames = curve.computeFrenetFrames(n, false);
    const pos = [], idx = [], nor = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, p = curve.getPointAt(u), r = lerp(r0, r1, Math.pow(u, 0.8));
      const N = frames.normals[i], B = frames.binormals[i];
      for (let j = 0; j <= radial; j++) {
        const a = j / radial * TAU, c = Math.cos(a), s = Math.sin(a);
        const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s;
        pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r); nor.push(nx, ny, nz);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b2 = a + radial + 1;
      idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
    }
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }
  // a profile shape (x forward, y up) extruded across z, tapered toward the snout
  function profileGeo(pts, depth, taper, bevel = 0.1) {
    const sh = new T3.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    const g = new T3.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 6, steps: 1 });
    g.translate(0, 0, -depth / 2);
    const p = g.attributes.position;
    let xmax = 0; for (let i = 0; i < p.count; i++) xmax = Math.max(xmax, p.getX(i));
    for (let i = 0; i < p.count; i++) { const k = lerp(1, taper, clamp(p.getX(i) / xmax, 0, 1)); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals();
    return g;
  }
  // smooth lofted head part: cross-sections along +x; keys [x, halfWidth, yTop, yBot]
  function loftGeo(keys, nx = 26, nr = 18) {
    const at = (x) => {
      let i = 0; while (i < keys.length - 2 && keys[i + 1][0] < x) i++;
      const k0 = keys[i], k1 = keys[i + 1], f = sstep(0, 1, (x - k0[0]) / Math.max(1e-6, k1[0] - k0[0]));
      return [lerp(k0[1], k1[1], f), lerp(k0[2], k1[2], f), lerp(k0[3], k1[3], f)];
    };
    const x0 = keys[0][0], x1 = keys[keys.length - 1][0];
    const pos = [], idx = [];
    for (let i = 0; i <= nx; i++) {
      const x = lerp(x0, x1, i / nx), [w, yt, yb] = at(x);
      const cap = i === 0 || i === nx ? 0.0 : 1;
      for (let j = 0; j <= nr; j++) {
        const a = j / nr * TAU, c = Math.cos(a), sn = Math.sin(a);
        const yc = (yt + yb) / 2, hy = (yt - yb) / 2;
        const sq = Math.sign(sn) * Math.pow(Math.abs(sn), 0.8), cq = Math.sign(c) * Math.pow(Math.abs(c), 0.85);
        pos.push(x, yc + hy * sq * (cap ? 1 : 0.02), w * cq * (cap ? 1 : 0.02));
      }
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nr; j++) {
      const a0 = i * (nr + 1) + j, b0 = a0 + nr + 1;
      idx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1);
    }
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // a dynamic ribbon strip with cap points (2 verts each)
  function makeStrip(cap, mat) {
    const g = new T3.BufferGeometry();
    const pos = new Float32Array(cap * 6), uv = new Float32Array(cap * 4), aA = new Float32Array(cap * 2), idx = [];
    for (let i = 0; i < cap; i++) { uv[i * 4 + 1] = 0; uv[i * 4 + 3] = 1; }
    for (let i = 0; i < cap - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new T3.BufferAttribute(pos, 3).setUsage(T3.DynamicDrawUsage));
    g.setAttribute('uv', new T3.BufferAttribute(uv, 2).setUsage(T3.DynamicDrawUsage));
    g.setAttribute('aA', new T3.BufferAttribute(aA, 1).setUsage(T3.DynamicDrawUsage));
    g.setIndex(idx); g.setDrawRange(0, 0);
    const m = new T3.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 3;
    return { mesh: m, pos, uv, aA, n: 0, cap };
  }
  function stripSet(st, i, ax, ay, az, bx, by, bz, u, a) {
    if (i >= st.cap) return;
    st.pos[i * 6] = ax; st.pos[i * 6 + 1] = ay; st.pos[i * 6 + 2] = az; st.pos[i * 6 + 3] = bx; st.pos[i * 6 + 4] = by; st.pos[i * 6 + 5] = bz;
    st.uv[i * 4] = u; st.uv[i * 4 + 2] = u; st.aA[i * 2] = a; st.aA[i * 2 + 1] = a;
  }
  function stripCommit(st, n) {
    const g = st.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.aA.needsUpdate = true;
    g.setDrawRange(0, Math.max(0, n - 1) * 6);
  }
  function ribbonMat(u) {
    return new T3.ShaderMaterial({ vertexShader: RIB_VS, fragmentShader: RIB_FS, uniforms: u, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide, toneMapped: false });
  }

  // ================================================================ BODY CHAINS
  const CAP_MAIN = 180, CAP_LOOP = 110;
  const _m = new T3.Matrix4(), _s = V3(), _T = V3(), _B = V3(), _N = V3(), _U = V3(0, 1, 0), _X = V3(1, 0, 0), _p = V3(), _c = new T3.Color();
  function makeBodySet(D, mats, cap) {
    const g = new T3.Group();
    const vert = new T3.InstancedMesh(D.geo.vert, mats.body, cap);
    const spike = new T3.InstancedMesh(D.geo.spike, mats.spike, cap);
    const inlay = new T3.InstancedMesh(D.geo.inlay, mats.inlay, cap);
    const fin = new T3.InstancedMesh(D.geo.fin, mats.spike, cap);
    for (let i = 0; i < cap; i++) inlay.setColorAt(i, _c.set(ACC));
    for (const m of [vert, spike, inlay, fin]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(T3.DynamicDrawUsage); g.add(m); }
    inlay.instanceColor.setUsage(T3.DynamicDrawUsage);
    return { g, vert, spike, inlay, fin, cap, cum: new Float32Array(400) };
  }
  // poly: Float32Array xyz (np points). o: {spacing, offset, rad(f, y), color(f, i, out), hide(f), strips:[{st, kind}], t, alphaF(f,y)}
  function layChain(set, poly, np, o) {
    const cum = set.cum; cum[0] = 0;
    for (let i = 1; i < np; i++) {
      const dx = poly[i * 3] - poly[i * 3 - 3], dy = poly[i * 3 + 1] - poly[i * 3 - 2], dz = poly[i * 3 + 2] - poly[i * 3 - 1];
      cum[i] = cum[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    const L = cum[np - 1], sp = o.spacing;
    let s = ((o.offset % sp) + sp) % sp, k = 0, seg = 0;
    const strips = o.strips || [];
    while (s <= L && k < set.cap) {
      while (seg < np - 2 && cum[seg + 1] < s) seg++;
      const l0 = cum[seg], l1 = cum[seg + 1], f = (s - l0) / Math.max(1e-6, l1 - l0);
      const i0 = seg * 3, i1 = i0 + 3;
      _p.set(lerp(poly[i0], poly[i1], f), lerp(poly[i0 + 1], poly[i1 + 1], f), lerp(poly[i0 + 2], poly[i1 + 2], f));
      _T.set(poly[i1] - poly[i0], poly[i1 + 1] - poly[i0 + 1], poly[i1 + 2] - poly[i0 + 2]).normalize();
      const up = Math.abs(_T.y) > 0.96 ? _X : _U;
      _B.crossVectors(_T, up).normalize(); _N.crossVectors(_B, _T).normalize();
      const fr = s / Math.max(1e-6, L);
      let r = o.rad(fr, _p.y);
      if (o.hide && o.hide(fr)) r = 0.0001;
      const len = sp * 1.38 * (r > 0.01 ? 1 : 0.01);
      _m.makeBasis(_B, _N, _T); _m.scale(_s.set(r, r, len)); _m.setPosition(_p);
      set.vert.setMatrixAt(k, _m);
      _m.makeBasis(_B, _N, _T); _m.scale(_s.set(r, r * (k % 2 ? 0.8 : 1.05), r)); _m.setPosition(_p);
      set.spike.setMatrixAt(k, _m);
      set.fin.setMatrixAt(k, _m);
      _m.makeBasis(_B, _N, _T); _m.scale(_s.set(r, r, r)); _m.setPosition(_p);
      set.inlay.setMatrixAt(k, _m);
      if (o.color) { o.color(fr, k, _c); set.inlay.setColorAt(k, _c); }
      // ribbons
      const alpha = o.alphaF ? o.alphaF(fr, _p.y) : 1;
      for (const sr of strips) {
        const st = sr.st, t = o.t || 0, uu = s * 0.07;
        if (sr.kind === 'dorsal') {
          const h = (sr.h || 0.8) * (0.8 + 0.2 * Math.sin(t * 2.3 + s * 0.8)), sw = 0.18 * Math.sin(t * 1.7 + s * 0.55);
          stripSet(st, k, _p.x + _N.x * r * 0.8, _p.y + _N.y * r * 0.8, _p.z + _N.z * r * 0.8,
            _p.x + _N.x * (r + h) + _B.x * sw + _T.x * 0.3, _p.y + _N.y * (r + h) + _B.y * sw + _T.y * 0.3, _p.z + _N.z * (r + h) + _B.z * sw + _T.z * 0.3, uu, alpha * (sr.a ? sr.a(fr) : 1));
        } else {
          const sd = sr.kind === 'left' ? 1 : -1, w = (sr.w || 0.9) * (0.85 + 0.25 * Math.sin(t * 2.9 + s * 1.2)), lift = 0.15 + 0.22 * Math.sin(t * 2.1 + s * 0.9 + sd);
          stripSet(st, k, _p.x + _B.x * sd * r * 0.75, _p.y + _B.y * sd * r * 0.75, _p.z + _B.z * sd * r * 0.75,
            _p.x + _B.x * sd * (r * 0.75 + w) + _N.x * lift, _p.y + _B.y * sd * (r * 0.75 + w) + _N.y * lift, _p.z + _B.z * sd * (r * 0.75 + w) + _N.z * lift, uu, alpha * (sr.a ? sr.a(fr) : 1));
        }
      }
      if (o.onV) o.onV(k, _p, fr, r);
      k++; s += sp;
    }
    for (const m of [set.vert, set.spike, set.inlay, set.fin]) { m.count = k; m.instanceMatrix.needsUpdate = true; }
    if (set.inlay.instanceColor) set.inlay.instanceColor.needsUpdate = true;
    for (const sr of strips) stripCommit(sr.st, k);
    return k;
  }

  // ---------------------------------------------------------------- main spine (boss-local)
  // head base point hb + head forward hf -> neck bezier -> helix around the pillar -> dive into the void
  const MAIN_NP = 230;
  function mainSpine(D, out) {
    const hb = D.hb, hf = D.hf, rc = D.coilR, top = 3.25, bot = -0.2, turns = 2.35, phi0 = PI - 0.45;
    let n = 0;
    const push = (x, y, z) => { out[n * 3] = x; out[n * 3 + 1] = y; out[n * 3 + 2] = z; n++; };
    // helix start + its "upward" tangent (toward the neck)
    const cTop = V3(rc * Math.cos(phi0), top, -rc * Math.sin(phi0));
    const dphi = turns * TAU, dy = bot - top;
    const tUp = V3(-(-rc * Math.sin(phi0)) * dphi, -dy, -(-rc * Math.cos(phi0)) * dphi).normalize();
    const p0 = V3().copy(hb), p1 = V3().copy(hb).addScaledVector(hf, -1.5); p1.y -= 0.4;
    const p2 = V3().copy(cTop).addScaledVector(tUp, 1.8 + D.neckSlack), p3 = cTop;
    const NN = 46;
    for (let i = 0; i < NN; i++) {
      const u = i / NN, a = (1 - u) ** 3, bq = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
      push(a * p0.x + bq * p1.x + c * p2.x + d * p3.x, a * p0.y + bq * p1.y + c * p2.y + d * p3.y, a * p0.z + bq * p1.z + c * p2.z + d * p3.z);
    }
    const NH = 150;
    for (let i = 0; i <= NH; i++) {
      const u = i / NH, ph = phi0 + u * dphi, rr = rc * (1 + 0.05 * Math.sin(u * 9 + D.t * 1.3)) - D.squeeze * 0.35 * Math.sin(u * PI);
      push(rr * Math.cos(ph), top + dy * u, -rr * Math.sin(ph));
    }
    const ND = 30;
    for (let i = 1; i <= ND; i++) {
      const u = i / ND, ph = phi0 + dphi + u * 1.6, rr = rc + u * 1.2;
      push(rr * Math.cos(ph), bot - u * 4.2, -rr * Math.sin(ph));
    }
    return n;
  }

  // ---------------------------------------------------------------- loops (play-local world coords)
  // A loop is a stretch of the body that surfaces through the ring plane. Shape params:
  //   r (radius), c (centre angle), w (angular span above the plane), A (hump amplitude), k (hump count),
  //   yb (base height), weave (radial wobble). sub 0..1 submerges it (used to relocate).
  const LOOP_NP = 120;
  function loopDefaults() { return { r: 10.75, c: 0, w: 2.2, A: 1.0, k: 2, yb: -0.35, weave: 0.25, flow: 1 }; }
  function makeLoop(D, mats) {
    const set = makeBodySet(D, mats, CAP_LOOP);
    const st = makeStrip(CAP_LOOP, D.ribMatLoop);
    set.g.add(st.mesh);
    const ripples = [];
    for (let i = 0; i < 6; i++) {
      const m = new T3.Mesh(D.geo.ripple, D.mats.ripple); m.rotation.x = -PI / 2; m.visible = false; m.renderOrder = 4; set.g.add(m); ripples.push(m);
    }
    return { set, st, ripples, cur: loopDefaults(), tgt: loopDefaults(), pending: null, sub: 1, subT: 0, hidden: false, ph: Math.random() * 6, poly: new Float32Array(LOOP_NP * 3), mode: 'idle', follow: null, glow: 0 };
  }
  // big moves dive under and resurface instead of sliding across the arena
  function loopTarget(L, tgt, opts = {}) {
    const far = Math.abs(tgt.r - L.cur.r) > 0.6 || Math.abs(angDiff(tgt.c, L.cur.c)) * tgt.r > 2.5;
    if ((far && !opts.slide) || opts.dive) { L.pending = Object.assign(loopDefaults(), tgt); }
    else { L.pending = null; Object.assign(L.tgt, tgt); }
  }
  function updateLoop(D, L, dt) {
    // submerge / relocate
    const wantSub = L.hidden || L.pending ? 1 : 0;
    L.sub = clamp(L.sub + (wantSub ? 1 : -1) * dt * (wantSub ? 2.6 : 1.6), 0, 1);
    if (L.pending && L.sub >= 1) { Object.assign(L.cur, L.pending); Object.assign(L.tgt, L.pending); L.pending = null; }
    if (!L.pending) {
      const c = L.cur, t = L.tgt, k = Math.min(1, dt * 5);
      c.r = lerp(c.r, t.r, k); c.w = lerp(c.w, t.w, k); c.A = lerp(c.A, t.A, k); c.yb = lerp(c.yb, t.yb, k); c.weave = lerp(c.weave, t.weave, k); c.k = t.k;
      c.flow = lerp(c.flow, t.flow, k);
      if (L.follow) c.c = L.follow(); else c.c = G.lerpAngle(c.c, t.c, Math.min(1, dt * 3));
      t.c = L.follow ? c.c : t.c;
    }
    L.ph += dt * 1.2 * L.cur.flow;
    const c = L.cur, n = LOOP_NP, poly = L.poly;
    const ext = 0.7, yDeep = -4.5;
    const ybEff = c.yb - L.sub * 5.5;
    let rip = 0;
    for (let i = 0; i < n; i++) {
      const u = -1 - ext + (2 + 2 * ext) * i / (n - 1);
      const au = Math.abs(u);
      const phi = c.c + u * c.w / 2;
      let y;
      const env = Math.pow(Math.cos(Math.min(1, au) * PI / 2), 0.6);
      if (c.k <= 1) y = ybEff + c.A * Math.cos(Math.min(1, au) * PI / 2);
      else y = ybEff + c.A * (Math.sin(PI * c.k * (u + 1) / 2 - L.ph) * 0.5 + 0.5) * env;
      if (au > 1) y = ybEff + (yDeep - ybEff) * sstep(0, 1, (au - 1) / ext);
      const rr = c.r + c.weave * Math.sin(u * 3.1 + L.ph * 0.7);
      poly[i * 3] = rr * Math.cos(phi); poly[i * 3 + 1] = y; poly[i * 3 + 2] = -rr * Math.sin(phi);
      if (i > 0 && rip < L.ripples.length) {
        const y0 = poly[i * 3 - 2];
        if ((y0 < 0) !== (y < 0)) {
          const m = L.ripples[rip++]; m.visible = true; m.position.set(poly[i * 3], 0.06, poly[i * 3 + 2]);
          const s = 0.9 + 0.25 * Math.sin(D.t * 6 + i); m.scale.setScalar(s);
        }
      }
    }
    for (let i = rip; i < L.ripples.length; i++) L.ripples[i].visible = false;
    const glow = L.glow;
    layChain(L.set, poly, n, {
      spacing: 0.34, offset: -D.t * 0.9 * c.flow, t: D.t,
      rad: (f, y) => (0.5 - 0.12 * Math.abs(f - 0.5) * 2) * sstep(-3.0, -0.5, y) * (D.dying ? D.loopScale : 1),
      color: (f, i, out) => { const p = 0.5 + 0.5 * Math.sin(f * 18 - D.t * 4); return out.set(ACC).multiplyScalar(0.12 + 0.4 * p * p + glow * 0.7 + D.flashK * 1.0); },
      alphaF: (f, y) => sstep(-1.8, 0.3, y),
      strips: [{ st: L.st, kind: 'dorsal', h: 0.9 }],
    });
  }

  // ================================================================ MODEL BUILD
  function build(b) {
    const D = b.data = {
      t: 0, emerge: 0, pose: 'idle', poseT: 0, jaw: 0, jawT: 0.05, hb: V3(1.6, 5.0, 0), hf: V3(1, -0.35, 0).normalize(), hbT: V3(1.6, 5.0, 0),
      coilR: 1.38, squeeze: 0, squeezeT: 0, neckSlack: 0, flashK: 0, mouthK: 0, sing: 0, lashes: [], listeners: [], textures: [], dom: [],
      flooded: false, sirenT: 0, phaseVis: b.phase || 0, loopScale: 1, dying: false, deathK: 0, dive: null, venom: null,
      lookLocal: V3(8, 0.4, 0), stormT: 0, enraged: false, curtCol: [ACC, ROSE, VIOLET],
    };
    const model = new T3.Group(); model.name = 'ouros';
    const rune = runeTex(); D.textures.push(rune);
    const brass = G.mat.brass({ color: '#c08c3a', metalness: 0.82, roughness: 0.36, envMapIntensity: 0.7, emissive: ACC, emissiveIntensity: 0.0 });
    const brassDark = G.mat.brass({ color: '#6a4c22', metalness: 0.8, roughness: 0.45, envMapIntensity: 0.6 });
    const pillarMat = G.mat.brass({ color: '#b98d3e', metalness: 0.9, roughness: 0.34, emissive: ACC, emissiveMap: rune, emissiveIntensity: 1.25 });
    rune.repeat.set(2, 1);
    const inlayMat = new T3.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    D.mats = {
      brass, brassDark, pillarMat, inlayMat,
      ripple: new T3.MeshBasicMaterial({ map: (() => { const t = canvasTex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 20, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,0.0)'); g.addColorStop(0.78, 'rgba(255,255,255,0.95)'); g.addColorStop(0.86, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }); D.textures.push(t); return t; })(), color: new T3.Color(ACC).multiplyScalar(1.6), transparent: true, blending: T3.AdditiveBlending, depthWrite: false, toneMapped: false }),
    };
    // shared vertebra geometry
    const vert = new T3.CylinderGeometry(0.88, 1.0, 1.0, 12, 1); vert.rotateX(PI / 2);
    const spike = new T3.ConeGeometry(0.28, 1.15, 4); spike.scale(0.32, 1, 1); spike.translate(0, 0.57, 0); spike.rotateX(0.75); spike.translate(0, 0.82, 0);
    const fin = new T3.ConeGeometry(0.16, 0.85, 3); fin.scale(1, 1, 0.4); fin.translate(0, 0.42, 0); fin.rotateZ(PI / 2 + 0.35); fin.translate(-0.85, -0.1, 0);
    const fin2 = new T3.ConeGeometry(0.16, 0.85, 3); fin2.scale(1, 1, 0.4); fin2.translate(0, 0.42, 0); fin2.rotateZ(-PI / 2 - 0.35); fin2.translate(0.85, -0.1, 0);
    const finG = mergeGeos([fin, fin2]);
    const inlay = new T3.TorusGeometry(0.99, 0.04, 5, 20); inlay.translate(0, 0, -0.3);
    const ripple = new T3.PlaneGeometry(2.6, 2.6);
    D.geo = { vert, spike, fin: finG, inlay, ripple };
    D.bodyMats = { body: brass, spike: brassDark, inlay: inlayMat };
    // ---- main body (boss-local)
    D.main = makeBodySet(D, D.bodyMats, CAP_MAIN);
    model.add(D.main.g);
    D.mainPoly = new Float32Array(MAIN_NP * 3);
    D.ribU = { uTime: { value: 0 }, uI: { value: 1.0 }, uC1: { value: new T3.Color(ACC) }, uC2: { value: new T3.Color(ROSE) }, uC3: { value: new T3.Color(VIOLET) } };
    D.ribMat = ribbonMat(D.ribU);
    D.ribMatLoop = ribbonMat(D.ribU);
    D.finL = makeStrip(CAP_MAIN, D.ribMat); D.finR = makeStrip(CAP_MAIN, D.ribMat); D.dors = makeStrip(CAP_MAIN, D.ribMat);
    model.add(D.finL.mesh, D.finR.mesh, D.dors.mesh);
    // ---- pillar, capital, heart orb, collar, pool
    const pil = new T3.Group(); pil.name = 'pillar';
    const shaft = new T3.Mesh(new T3.CylinderGeometry(0.55, 0.72, 7.0, 28, 1, true), pillarMat); shaft.position.y = -0.2; pil.add(shaft);
    const capT = new T3.Mesh(new T3.CylinderGeometry(0.86, 0.6, 0.38, 28), brass); capT.position.y = 3.4; pil.add(capT);
    for (let i = 0; i < 3; i++) { const tor = new T3.Mesh(new T3.TorusGeometry(0.66 + i * 0.03, 0.05, 8, 40), brass); tor.rotation.x = PI / 2; tor.position.y = 0.6 + i * 1.15; pil.add(tor); }
    // crescent cradle holding the heart
    const cres = new T3.Mesh(new T3.TorusGeometry(0.72, 0.09, 10, 40, PI * 1.25), brass); cres.position.y = 4.05; cres.rotation.z = -PI * 0.125 - PI / 2 + PI / 2; cres.rotation.y = PI / 2; pil.add(cres);
    D.orbU = { uTime: { value: 0 }, uI: { value: 1.2 }, uC1: { value: new T3.Color(ACC) }, uC2: { value: new T3.Color(ROSE) } };
    const orb = new T3.Mesh(new T3.SphereGeometry(0.46, 32, 20), new T3.ShaderMaterial({ vertexShader: ORB_VS, fragmentShader: ORB_FS, uniforms: D.orbU, toneMapped: false }));
    orb.position.y = 4.05; pil.add(orb); D.orb = orb;
    const orbGlow = G.mat.glowSprite(ACC, 3.2, { intensity: 1.2, opacity: 0.8 }); orbGlow.position.y = 4.05; pil.add(orbGlow); D.orbGlow = orbGlow;
    // orbiting rune plates around the capital
    D.plates = new T3.Group(); D.plates.position.y = 3.95;
    for (let i = 0; i < 6; i++) {
      const pl = new T3.Mesh(new T3.BoxGeometry(0.34, 0.5, 0.05), brass);
      const a = i / 6 * TAU; pl.position.set(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05); pl.rotation.y = -a + PI / 2;
      const gem = new T3.Mesh(new T3.OctahedronGeometry(0.08), G.mat.emissive(i % 2 ? ROSE : ACC, 2.2)); gem.position.copy(pl.position).multiplyScalar(1.04);
      D.plates.add(pl, gem);
    }
    pil.add(D.plates);
    // collar at the arena plane
    const collar = new T3.Mesh(new T3.TorusGeometry(1.05, 0.12, 10, 48), brass); collar.rotation.x = PI / 2; collar.position.y = 0.08; pil.add(collar);
    for (let i = 0; i < 10; i++) {
      const sp = new T3.Mesh(new T3.ConeGeometry(0.09, 0.8, 4), brassDark); const a = i / 10 * TAU;
      sp.position.set(Math.cos(a) * 1.3, 0.12, Math.sin(a) * 1.3); sp.rotation.z = -Math.cos(a) * 1.25; sp.rotation.x = Math.sin(a) * 1.25; pil.add(sp);
    }
    D.poolU = { uTime: { value: 0 }, uI: { value: 1.0 }, uC1: { value: new T3.Color(ACC) }, uC2: { value: new T3.Color(ROSE) } };
    const pg = new T3.CircleGeometry(2.8, 64); pg.rotateX(-PI / 2);
    const pool = new T3.Mesh(pg, new T3.ShaderMaterial({ vertexShader: POOL_VS, fragmentShader: POOL_FS, uniforms: D.poolU, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, toneMapped: false }));
    pool.position.y = 0.03; pool.renderOrder = 2; pil.add(pool);
    model.add(pil); D.pillar = pil;
    // ---- weak point: a gold keyhole rune behind the coil (local -x)
    const rear = new T3.Group(); rear.position.set(-2.35, 2.3, 0); rear.rotation.y = -PI / 2;
    const rr1 = new T3.Mesh(new T3.TorusGeometry(0.5, 0.05, 8, 40), G.mat.emissive('#ffd36b', 2.0)); rear.add(rr1);
    const rr2 = new T3.Mesh(new T3.TorusGeometry(0.32, 0.03, 6, 6), G.mat.emissive('#fff1c2', 2.2)); rear.add(rr2);
    const key = new T3.Mesh(new T3.CircleGeometry(0.11, 16), G.mat.emissive('#fff1c2', 2.6)); key.position.y = 0.06; rear.add(key);
    const key2 = new T3.Mesh(new T3.PlaneGeometry(0.09, 0.24), G.mat.emissive('#fff1c2', 2.6)); key2.position.y = -0.1; rear.add(key2);
    const rg = G.mat.glowSprite('#ffd36b', 1.15, { intensity: 0.7, opacity: 0.6 }); rear.add(rg);
    model.add(rear); D.rear = rear; D.rearRings = [rr1, rr2];
    // ---- head
    buildHead(b, D, model);
    b.model = model;
    // ---- world-space group: loops + arena dressing (lives in G.layers.boss, removed by combat.reset)
    const wg = new T3.Group(); wg.name = 'ourosWorld'; (G.layers.boss || G.scene).add(wg); D.wg = wg;
    D.loopMats = { body: G.mat.brass({ color: '#c49646', metalness: 0.92, roughness: 0.3 }), spike: G.mat.brass({ color: '#7a5f2c', metalness: 0.9, roughness: 0.42 }), inlay: new T3.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }) };
    D.loops = [makeLoop(D, D.loopMats), makeLoop(D, D.loopMats)];
    for (const L of D.loops) wg.add(L.set.g);
    D.loops[0].cur.c = D.loops[0].tgt.c = -PI / 2 + 1.9;
    D.loops[1].hidden = true; D.loops[1].cur.c = D.loops[1].tgt.c = PI / 2; D.loops[1].cur.r = D.loops[1].tgt.r = 7.25;
    buildArenaDressing(b, D);
    // listeners
    const on = (ev, fn) => { G.on(ev, fn); D.listeners.push([ev, fn]); };
    on('playerDamaged', (d) => onPlayerDamaged(b, d));
    on('fightBegin', () => { if (C().boss === b) { b.say('I am the coil that binds the sky.', 3); } });
    on('castEnd', (d) => { if (C().boss === b && d && d.interrupted) { D.sing = 0; D.pose = 'idle'; D.flashK = 1; } });
    applyArena(b, b.phase || 0, true);
    if (G.state !== 'intro' && b.phase > 0) D.emerge = 1;
  }
  const C = () => G.combat;
  function mergeGeos(list) {
    // minimal non-indexed merge (position + normal) for small static parts
    const pos = [], nor = [];
    for (const g0 of list) {
      const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals();
      pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
      if (g !== g0) g.dispose(); g0.dispose();
    }
    const out = new T3.BufferGeometry();
    out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3));
    return out;
  }

  function buildHead(b, D, model) {
    const headG = new T3.Group(); headG.name = 'head';           // forward = +z (lookAt-style basis)
    const hp = new T3.Group(); hp.rotation.y = -PI / 2; hp.scale.setScalar(1.55); headG.add(hp);   // profile space: x forward
    const brass = D.mats.brass, dark = D.mats.brassDark;
    const skullMat = G.mat.brass({ color: '#d39a3c', metalness: 0.72, roughness: 0.38, envMapIntensity: 0.55, emissive: ACC, emissiveIntensity: 0.0 });
    D.skullMat = skullMat;
    const upper = loftGeo([[-0.45, 0.2, 0.2, 0.0], [-0.25, 0.42, 0.42, -0.16], [0.2, 0.52, 0.6, -0.2], [0.75, 0.46, 0.6, -0.12], [1.25, 0.34, 0.42, -0.08], [1.8, 0.25, 0.27, -0.07], [2.15, 0.17, 0.17, -0.05], [2.32, 0.05, 0.08, 0.0]], 30, 20);
    hp.add(new T3.Mesh(upper, skullMat));
    // nostril ridges + cheek plates
    for (const sd of [-1, 1]) {
      const ns = new T3.Mesh(new T3.SphereGeometry(0.07, 8, 6), G.mat.emissive(ACC, 1.6)); ns.position.set(2.12, 0.14, sd * 0.1); hp.add(ns);
      const ck = new T3.Mesh(loftGeo([[0, 0.02, 0.1, -0.1], [0.3, 0.06, 0.16, -0.16], [0.75, 0.02, 0.05, -0.05]], 8, 8), dark); ck.position.set(0.15, 0.08, sd * 0.47); ck.rotation.y = sd * 0.25; hp.add(ck);
    }
    // brow ridge plates
    for (const sd of [-1, 1]) {
      const brow = new T3.Mesh(new T3.BoxGeometry(0.9, 0.09, 0.22), dark); brow.position.set(0.85, 0.6, sd * 0.33); brow.rotation.z = -0.25; brow.rotation.x = sd * 0.2; hp.add(brow);
    }
    // lower jaw on a hinge
    const jawPivot = new T3.Group(); jawPivot.position.set(0.25, -0.1, 0); hp.add(jawPivot);
    const lower = loftGeo([[-0.15, 0.2, 0.02, -0.1], [0.2, 0.36, 0.04, -0.3], [0.9, 0.3, 0.03, -0.24], [1.6, 0.2, 0.02, -0.12], [2.0, 0.08, 0.01, -0.04]], 22, 16);
    jawPivot.add(new T3.Mesh(lower, dark));
    // teeth (upper and lower)
    const toothMat = new T3.MeshStandardMaterial({ color: '#f3ead2', roughness: 0.35, metalness: 0.1, emissive: '#bfffe0', emissiveIntensity: 0.25 });
    const tg = new T3.ConeGeometry(0.045, 0.2, 5);
    for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) {
      const x = 0.55 + i * 0.27, zz = sd * lerp(0.3, 0.16, i / 5);
      const tu = new T3.Mesh(tg, toothMat); tu.position.set(x, -0.14, zz); tu.rotation.z = PI; hp.add(tu);
      const tl = new T3.Mesh(tg, toothMat); tl.position.set(x - 0.25 + 0.1, 0.07, zz * 0.95); jawPivot.add(tl);
    }
    // fangs
    for (const sd of [-1, 1]) { const f = new T3.Mesh(new T3.ConeGeometry(0.06, 0.42, 6), toothMat); f.position.set(1.85, -0.25, sd * 0.13); f.rotation.z = PI; hp.add(f); }
    // eyes
    const eyeMat = G.mat.emissive(ACC, 3.2);
    D.eyes = [];
    for (const sd of [-1, 1]) {
      const e = new T3.Mesh(new T3.SphereGeometry(0.1, 14, 10), eyeMat); e.scale.set(1.7, 0.7, 1); e.position.set(1.12, 0.42, sd * 0.38); hp.add(e);
      const gs = G.mat.glowSprite(ACC, 0.9, { intensity: 1.4 }); gs.position.copy(e.position); gs.position.z += sd * 0.06; hp.add(gs); D.eyes.push(gs);
    }
    // forehead gem
    const gem = new T3.Mesh(new T3.OctahedronGeometry(0.13), G.mat.emissive(ROSE, 2.6)); gem.scale.set(1.5, 1, 0.8); gem.position.set(0.62, 0.68, 0); hp.add(gem); D.gem = gem;
    // horns: two sweeping pairs
    const hornMat = G.mat.brass({ color: '#e8c070', metalness: 0.8, roughness: 0.28, envMapIntensity: 0.6, emissive: ACC, emissiveIntensity: 0.0 });
    D.hornMat = hornMat;
    for (const sd of [-1, 1]) {
      const c1 = new T3.CatmullRomCurve3([V3(0.35, 0.55, sd * 0.3), V3(-0.35, 1.0, sd * 0.55), V3(-1.15, 1.3, sd * 0.72), V3(-1.85, 1.05, sd * 0.66), V3(-2.15, 0.6, sd * 0.5)]);
      hp.add(new T3.Mesh(taperTube(c1, 24, 0.13, 0.015), hornMat));
      const c2 = new T3.CatmullRomCurve3([V3(0.9, 0.05, sd * 0.42), V3(0.2, 0.0, sd * 0.72), V3(-0.55, -0.15, sd * 0.88), V3(-1.05, -0.05, sd * 0.85)]);
      hp.add(new T3.Mesh(taperTube(c2, 16, 0.08, 0.01), hornMat));
      const tip = G.mat.glowSprite(ACC, 0.55, { intensity: 1.6 }); tip.position.set(-2.15, 0.6, sd * 0.5); hp.add(tip);
    }
    // aurora crown: two crescents behind the head, spinning
    D.crown = new T3.Group(); D.crown.position.set(-0.6, 0.85, 0); D.crown.rotation.y = PI / 2;
    const cr1 = new T3.Mesh(new T3.TorusGeometry(1.05, 0.035, 6, 60, PI * 1.35), G.mat.emissive(ACC, 2.0));
    const cr2 = new T3.Mesh(new T3.TorusGeometry(1.22, 0.022, 6, 60, PI * 0.9), G.mat.emissive(ROSE, 2.2));
    D.crown.add(cr1, cr2); D.crownParts = [cr1, cr2]; hp.add(D.crown);
    // mouth glow
    D.mouth = G.mat.glowSprite(ACC, 1.4, { intensity: 1.6, opacity: 0.0 }); D.mouth.position.set(1.4, -0.12, 0); hp.add(D.mouth);
    D.jawPivot = jawPivot; D.head = headG; D.headP = hp;
    model.add(headG);
  }

  function buildArenaDressing(b, D) {
    const wg = D.wg;
    // P2 aurora drips over the flooded inner ring (falling light)
    // P3 nebula lotus under the arena
    D.lotusU = { uTime: { value: 0 }, uA: { value: 0 }, uC1: { value: new T3.Color('#16d98a') }, uC2: { value: new T3.Color(ROSE) } };
    const lotus = new T3.Group(); lotus.position.y = -1.6; lotus.visible = false;
    const lmat = new T3.ShaderMaterial({ vertexShader: LOTUS_VS, fragmentShader: LOTUS_FS, uniforms: D.lotusU, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide, toneMapped: false });
    for (let layer = 0; layer < 2; layer++) {
      const n = layer ? 9 : 12, len = layer ? 11 : 17;
      for (let i = 0; i < n; i++) {
        const g = new T3.PlaneGeometry(1, 1, 6, 10);
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) {
          const u = p.getX(k) + 0.5, v = p.getY(k) + 0.5;
          const w = (Math.sin(v * PI) * 0.5 + 0.5 * (1 - v)) * len * 0.36;
          const x = (u - 0.5) * w, r = 1.5 + v * len;
          p.setXYZ(k, x, v * v * (layer ? 3.2 : 2.2) - (u - 0.5) ** 2 * 1.5, -r);
        }
        g.computeVertexNormals();
        const m = new T3.Mesh(g, lmat); m.rotation.y = (i + layer * 0.5) / n * TAU; m.renderOrder = -5;
        lotus.add(m);
      }
    }
    wg.add(lotus); D.lotus = lotus;
    // P4 storm wall around the arena
    D.stormU = { uTime: { value: 0 }, uA: { value: 0 }, uFlash: { value: 0 }, uClose: { value: 0 }, uC1: { value: new T3.Color('#0a1a24') }, uC2: { value: new T3.Color('#47ffc0') } };
    const sw = new T3.Mesh(new T3.CylinderGeometry(1, 1, 1, 96, 1, true), new T3.ShaderMaterial({ vertexShader: STORM_VS, fragmentShader: STORM_FS, uniforms: D.stormU, transparent: true, depthWrite: false, side: T3.DoubleSide }));
    sw.scale.set(19, 7, 19); sw.position.y = 1.6; sw.visible = false; sw.renderOrder = 1;
    wg.add(sw); D.storm = sw;
    // T1 pour streams
    D.pourU = { uTime: { value: 0 }, uA: { value: 0 }, uC1: { value: new T3.Color(ACC) }, uC2: { value: new T3.Color('#7fd8ff') } };
    const pour = new T3.Group(); pour.visible = false;
    const pmat = new T3.ShaderMaterial({ vertexShader: STORM_VS, fragmentShader: POUR_FS, uniforms: D.pourU, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide, toneMapped: false });
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU + 0.2, p = G.polar(RR()[0], a, 0);
      for (let j = 0; j < 2; j++) {
        const m = new T3.Mesh(new T3.PlaneGeometry(0.85, 26), pmat); m.position.set(p.x, 13, p.z); m.rotation.y = j * PI / 2 + a; pour.add(m);
      }
    }
    wg.add(pour); D.pour = pour;
    // P2 flood shimmer: liquid aurora flowing around the inner ring
    D.floodU = { uTime: { value: 0 }, uA: { value: 0 }, uC1: { value: new T3.Color('#7fffe0') }, uC2: { value: new T3.Color('#2f7bff') } };
    const fg = new T3.RingGeometry(RR()[0] - 0.95, RR()[0] + 0.95, 160, 3); fg.rotateX(-PI / 2);
    const fm = new T3.Mesh(fg, new T3.ShaderMaterial({ vertexShader: POOL_VS, fragmentShader: FLOOD_FS, uniforms: D.floodU, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, toneMapped: false }));
    fm.position.y = 0.09; fm.renderOrder = 3; fm.visible = false; wg.add(fm); D.floodMesh = fm;
  }

  // ======================================================== ARENA STATE PER PHASE
  // idempotent: called at build (retry from a phase) and on phase enter
  function applyArena(b, ph, instant) {
    const D = b.data;
    D.phaseVis = ph;
    const flood = ph === 1;
    D.flooded = flood;
    world('flood', 0, flood ? 1 : 0);
    world('ringGlow', 0, flood ? '#7fffd0' : ACC, flood ? 0.35 : 0, 0);
    D.lotusTarget = ph === 2 ? 1 : 0;
    D.stormTarget = ph === 3 ? 1 : 0;
    if (instant) { D.lotusU.uA.value = D.lotusTarget * 0.6; D.stormU.uA.value = D.stormTarget; }
    const cols = [[ACC, ROSE, VIOLET], ['#3dffc8', '#4f9dff', '#a0ffe0'], [ROSE, '#2dffa0', '#ffd0ff'], ['#9ffff0', '#8a6cff', '#ffffff']][ph] || [ACC, ROSE, VIOLET];
    D.curtCol = cols;
    D.ribU.uC1.value.set(cols[0]); D.ribU.uC2.value.set(cols[1]); D.ribU.uC3.value.set(cols[2]);
    D.orbU.uC2.value.set(ph === 2 ? ROSE : ph === 3 ? '#cfe8ff' : ROSE);
    // loops per phase
    const L0 = D.loops[0], L1 = D.loops[1];
    L0.follow = null; L1.follow = null;
    if (ph === 1) { L1.hidden = true; }
    else if (ph === 3) { L1.hidden = false; loopTarget(L1, { r: 7.25, c: L0.cur.c + PI, w: 2.0, A: 1.3, k: 2, yb: -0.4, weave: 0.3, flow: 1.8 }, { dive: true }); loopTarget(L0, { r: 10.75, c: L0.cur.c, w: 2.4, A: 1.4, k: 3, yb: -0.45, weave: 0.3, flow: 1.8 }); }
    else { L1.hidden = true; loopTarget(L0, { r: 10.75, c: L0.cur.c, w: 2.3, A: 1.05, k: 2, yb: -0.35, weave: 0.25, flow: 1 }); }
    if (instant) { for (const L of D.loops) { if (L.pending) { Object.assign(L.cur, L.pending); Object.assign(L.tgt, L.pending); L.pending = null; } } }
  }

  // ======================================================== HERO SPEED (flood + siren)
  function speedControl(b, dt) {
    const D = b.data, S = P();
    if (!S) return;
    // framework workaround (07_player.js updateNova never clears S.invuln): without this the hero stays
    // invulnerable forever after the first Supernova
    if (S.invuln && !S.novaActive) S.invuln = false;
    D.sirenT = Math.max(0, D.sirenT - dt);
    let m = 1;
    // flood and enthrall do not stack: never slower than 0.6 (0.36 left no way out of a curtain lane)
    if (D.flooded && S.ring === 0) m = 0.6;
    if (D.sirenT > 0) m = 0.6;
    if (Math.abs((S.speedMul || 1) - m) > 1e-3) G.player.setSpeedMul(m, 0);
  }
  function onPlayerDamaged(b, d) {
    if (!d || d.blocked || C().boss !== b || !P().alive) return;
    const S = P();
    if (d.source === 'Coiled Body' && S.ring === 1) {
      const up = (G.hz.dangerAt(2, S.theta, 0.35) || 0) <= (G.hz.dangerAt(0, S.theta, 0.35) || 0) ? 1 : -1;
      try { G.player.forceShift(up, {}); } catch (e) { logE('forceShift', e); }
      fx('burst', S.pos.clone().setY(0.6), { color: ACC, count: 18, speed: 5, size: 0.5, life: 0.5 });
    } else if (d.source === 'Tidal Pull' && S.ring > 0) {
      try { G.player.forceShift(-1, {}); } catch (e) { logE('forceShift', e); }
    }
  }

  // ================================================================ ATTACKS
  // ---- Aurora Curtains: rotating slices per ring (offset per ring) with tall aurora curtains rising off them
  function curtains(b, o) {
    const R = RR(), D = b.data;
    const lanes = o.lanes;   // [{ring, centers:[], width, omega}]
    const cols = D.curtCol;
    const h = G.hz.custom({
      warn: o.warn, active: o.dur, dmg: o.dmg, tick: 0.5, label: 'Aurora Curtain',
      test: (ring, theta, lt, pad) => {
        for (const ln of lanes) {
          if (ln.ring !== ring) continue;
          for (const c0 of ln.centers) if (inArcR(ring, theta, c0 + ln.omega * lt, ln.width / 2, pad)) return true;
        }
        return false;
      },
      draw: (group) => {
        const items = [];
        for (const ln of lanes) {
          const Rk = R[ln.ring];
          for (const c0 of ln.centers) {
            const pivot = new T3.Group(); group.add(pivot);
            const band = G.combat.bandMesh(Rk - TH, Rk + TH, -ln.width / 2, ln.width / 2, 0, ACC, { arrow: Math.sign(ln.omega) });
            pivot.add(band);
            // curved curtain sheet along the slice
            const seg = 18, hgt = o.height || 2.1;
            const g = new T3.PlaneGeometry(1, 1, seg, 1);
            const p = g.attributes.position;
            for (let k = 0; k < p.count; k++) {
              const u = p.getX(k) + 0.5, v = p.getY(k) + 0.5, a = (u - 0.5) * ln.width * 0.96;
              const wob = 0.18 * Math.sin(u * 9 + ln.ring);
              p.setXYZ(k, (Rk + wob) * Math.cos(a), v * hgt, -(Rk + wob) * Math.sin(a));
            }
            const mat = new T3.ShaderMaterial({ vertexShader: CURT_VS, fragmentShader: CURT_FS, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide, toneMapped: false,
              uniforms: { uTime: { value: 0 }, uAlpha: band.material.uniforms.uAlpha, uLive: { value: 0 }, uProg: { value: 0 }, uC1: { value: new T3.Color(cols[0]) }, uC2: { value: new T3.Color(cols[1]) }, uC3: { value: new T3.Color(cols[2]) } } });
            const sheet = new T3.Mesh(g, mat); sheet.renderOrder = 9; sheet.frustumCulled = false; pivot.add(sheet);
            items.push({ pivot, c0, om: ln.omega, mat, band });
          }
        }
        return (lt, dt) => {
          const hz = h.hazard, warn = hz.warn;
          for (const it of items) {
            it.pivot.rotation.y = it.c0 + it.om * lt;
            if (lt >= warn && !hz.finished) { const bu = it.band.material.uniforms; bu.uLive.value = 0; bu.uProgress.value = 1; bu.uAlpha.value = 0.62; }
            const u = it.mat.uniforms; u.uTime.value += dt; u.uProg.value = clamp(lt / Math.max(0.01, warn), 0, 1); u.uLive.value = lt >= warn ? Math.min(1, (lt - warn) * 4) : 0;
          }
        };
      },
      onFire: () => { sfx('rumble', { vol: 0.5 }); world('beat', 0.6); },
    });
    return h;
  }
  function curtainLanes(b, rings, width, omega, opt = {}) {
    const base = b.playerTheta() + (opt.base != null ? opt.base : 1.3) * b.playerDir();
    const n = opt.n || 2;
    return rings.map((r, i) => ({ ring: r, width, omega: omega * (opt.alt && i % 2 ? -1 : 1), centers: Array.from({ length: n }, (_, k) => base + (opt.offs ? opt.offs[r] : r * PI / n) + k * TAU / n) }));
  }

  // ---- Lunar Wisps: rose adds that walk the rings toward you and burst on contact
  function wispModel(group, add) {
    const core = new T3.Mesh(new T3.SphereGeometry(0.26, 16, 12), G.mat.emissive(ROSE, 2.4)); core.position.y = 0.95;
    const shell = new T3.Mesh(new T3.SphereGeometry(0.45, 16, 12), G.mat.additive(ROSE, 0.28)); shell.position.y = 0.95;
    const moon = new T3.Mesh(new T3.TorusGeometry(0.42, 0.06, 6, 24, PI * 1.2), G.mat.brass({ color: '#e7c27a', metalness: 0.9, roughness: 0.3 })); moon.position.y = 0.95; moon.rotation.z = 0.6;
    const glow = G.mat.glowSprite(ROSE, 2.0, { intensity: 1.3, opacity: 0.85 }); glow.position.y = 0.95;
    const tails = [];
    for (let i = 0; i < 4; i++) { const s = G.mat.glowSprite(i % 2 ? '#ffb0d0' : ROSE, 0.7 - i * 0.12, { intensity: 1.2, opacity: 0.7 - i * 0.12 }); s.position.y = 0.9; group.add(s); tails.push(s); }
    group.add(core, shell, moon, glow);
    add.data.parts = { core, shell, moon, glow, tails };
  }
  function spawnWisp(b, ring, theta, opt = {}) {
    if (G.adds.list.filter(a => a.alive && a.label === 'Lunar Wisp').length >= (opt.max || 4)) return null;
    return G.adds.spawn({
      ring, theta, omega: 0, hp: opt.hp || 70, radius: 0.5, contactDmg: opt.dmg || 20, blocks: false, dieOnContact: true, label: 'Lunar Wisp', color: ROSE, barY: 1.75,
      data: { hopT: 2.5 + G.rand() * 1.5, spd: opt.spd || 0.3 },
      model: wispModel,
      update: (add, dt) => {
        const S = P(); if (!S) return;
        const d = angDiff(S.theta, add.theta);
        const want = Math.sign(d) * add.data.spd * (Math.abs(d) < 0.05 ? 0 : 1);
        add.omega = lerp(add.omega, want, Math.min(1, dt * 2.5));
        add.data.hopT -= dt;
        if (add.data.hopT <= 0 && add.ring !== S.ring && Math.abs(d) * RR()[S.ring] > 4.5) {
          add.ring += Math.sign(S.ring - add.ring); add.data.hopT = 3.5;
          fx('shockwave', G.polar(RR()[add.ring], add.theta, 0.1), { color: ROSE, radius: 1.4, life: 0.35 });
        }
        if (add.t > (opt.life || 11)) G.adds.kill(add, 'fade');
        const p = add.data.parts; if (!p) return;
        const tt = add.t;
        p.core.position.y = p.shell.position.y = p.moon.position.y = p.glow.position.y = 0.95 + Math.sin(tt * 3.1) * 0.12;
        p.moon.rotation.y = tt * 2.2; p.shell.scale.setScalar(1 + 0.15 * Math.sin(tt * 9));
        p.tails.forEach((s, i) => { s.position.set(-Math.sign(add.omega || 1) * (0.25 + i * 0.22), 0.9 + Math.sin(tt * 3 - i) * 0.1, 0); });
      },
      onDeath: (add, reason) => { if (reason === 'contact') { fx('shockwave', add.group.position.clone().setY(0.15), { color: ROSE, radius: 2.6, life: 0.45 }); fx('flash', ROSE, 0.15, 0.2); } },
    });
  }
  function spawnWisps(b, n, rings, opt = {}) {
    const S = P(), d = b.playerDir();
    for (let i = 0; i < n; i++) {
      const ring = rings ? rings[i % rings.length] : (i === 0 ? S.ring : clamp(S.ring + (i % 2 ? 1 : -1), 0, 2));
      const th = S.theta + d * (opt.ahead || 2.3) + (i - (n - 1) / 2) * 0.55 + (i % 2 ? PI * 0.85 : 0);
      spawnWisp(b, ring, th, opt);
    }
    sfx('addSpawn', { vol: 0.8 });
  }

  // ---- Coil Lash: the body sweeps one ring (a loop breaches and races along it)
  function coilLash(b, o) {
    const D = b.data, R = RR();
    const ring = o.ring != null ? o.ring : b.playerRing();
    const th = b.playerTheta(), d = o.dir || b.playerDir();
    const from = o.from != null ? o.from : th - d * 1.0, to = from + d * (o.span || PI * 1.5);
    const h = G.hz.sweep({ rings: [ring], from, to, warn: o.warn || 1.8, dur: o.dur || 2.4, width: 0.32, dmg: o.dmg || 24, label: 'Coil Lash' });
    const L = o.loop || D.loops[0];
    if (L && !L.busy) {
      L.busy = h.id; L.hidden = false;
      loopTarget(L, { r: R[ring], c: from, w: 0.55, A: 1.5, k: 1, yb: -0.25, weave: 0, flow: 3 }, { dive: true });
      L.glow = 1;
      L.follow = () => { const hz = h.hazard; return hz.lt < hz.warn ? from : hz.beamAt(hz.lt) - d * 0.12; };
      h.done.then(() => { if (L.busy === h.id) { L.busy = 0; L.follow = null; L.glow = 0; if (C().boss === b && b.alive) loopIdle(b, L); } });
    }
    return h;
  }
  function loopIdle(b, L) {
    const ph = b.phase;
    const idx = b.data.loops.indexOf(L);
    if (ph === 1 && idx === 0) return;    // the Tide blocker owns loop 0
    if (ph === 3) loopTarget(L, { r: idx ? 7.25 : 10.75, c: L.cur.c, w: idx ? 2.0 : 2.4, A: 1.35, k: idx ? 2 : 3, yb: -0.45, weave: 0.3, flow: 1.8 }, { dive: true });
    else if (idx === 0) loopTarget(L, { r: 10.75, c: L.cur.c, w: 2.3, A: 1.05, k: 2, yb: -0.35, weave: 0.25, flow: 1 }, { dive: true });
    else L.hidden = true;
  }

  // ---- Constrict: the coil tightens; the inner ring detonates
  function constrict(b, o = {}) {
    const D = b.data;
    D.squeezeT = 1;
    const h = G.hz.ring({ ring: 0, warn: o.warn || 2.4, active: 0.4, dmg: o.dmg || 28, label: 'Constrict', gaps: o.gaps });
    h.done.then(() => { D.squeezeT = 0; });
    return h;
  }

  // ---- Siren Song: interruptible; completion force-reverses and slows the hero, then an echo detonates their ring
  async function sirenSong(b, o = {}) {
    await b.until(() => !b.casting);
    const D = b.data;
    b.say(b.pick(['Hear me, little star...', 'Listen. Turn back.', 'Sleep in the aurora...']), 2.4);
    D.pose = 'sing';
    b.trackPlayer = false; const tr = b.turnRate; b.turnRate = 0;
    const res = await b.cast({
      name: 'Siren Song', dur: o.dur || 3.3, interruptible: true,
      onInterrupt: () => { b.say('My song... broken!', 2); D.pose = 'idle'; },
      onDone: () => {
        D.pose = 'idle';
        const S = P();
        if (S && S.alive && !S.aegisActive) {
          G.player.forceReverse(); D.sirenT = 4.0;
          fx('text', S.pos.clone().setY(2.2), 'ENTHRALLED', { color: ROSE, size: 0.7, life: 1.6 });
          fx('shockwave', S.pos.clone().setY(0.2), { color: ROSE, radius: 3, life: 0.6 });
          world('ringArrows', S.ring, S.dir, true);
          b.say('Turn, little star. Turn back.', 2.2);
        }
        fx('flash', ROSE, 0.2, 0.4);
      },
    });
    b.trackPlayer = true; b.turnRate = tr; D.pose = 'idle';
    if (res === 'done') {
      // the echo: one ring detonates under the enthralled hero (shift off it)
      await b.wait(0.4);
      world('ringArrows', null, 1, false);
      G.hz.ring({ ring: b.playerRing(), warn: 2.3, active: 0.4, dmg: 24, label: "Siren's Echo" });
    }
    return res;
  }

  // ---- Tidal Pull: a collapsing tide from the rim across the outer two rings; the flooded inner ring is safe
  function tidalPull(b, o = {}) {
    const R = RR(), D = b.data;
    const gaps = o.gaps;
    const speed = o.speed || 5.2, thick = 0.9, r0 = 15.4, rEnd = R[0] + TH + 0.25;
    const warn = o.warn || 2.6;
    const life = (r0 - rEnd) / speed;
    const radiusAt = (lt) => r0 - speed * (lt - warn);
    const inGap = (theta, inset) => gaps.some(g => Math.abs(angDiff(theta, g.center)) < g.width / 2 - inset);
    const h = G.hz.custom({
      warn, active: life, dmg: o.dmg || 35, label: 'Tidal Pull',
      test: (ring, theta, lt, pad) => {
        if (ring === 0) return false;
        const Rk = R[ring]; if (Math.abs(radiusAt(lt) - Rk) > thick / 2 + 0.25 + pad * 0.5) return false;
        return !inGap(theta, (pad + 0.08) / Rk);
      },
      draw: (group) => {
        const arcs = G.combat.complementArcs(gaps);
        for (const r of [1, 2]) for (const [a0, a1] of arcs) group.add(G.combat.bandMesh(R[r] - TH, R[r] + TH, a0, a1, 0, ACC, {}));
        for (const g of gaps) group.add(G.combat.bandMesh(R[1] - TH - 0.2, R[2] + TH + 0.2, g.center - g.width / 2, g.center + g.width / 2, 3, '#ffd88a', { order: 5 }));
        const waves = [];
        for (const [a0, a1] of arcs) { const m = G.combat.bandMesh(rEnd - 0.6, r0 + 0.8, a0, a1, 2, ACC, { additive: true, y: TY + 0.02, order: 7 }); m.visible = false; group.add(m); waves.push(m); }
        // the tide wall: a translucent aurora surf following the front
        const walls = [];
        for (const [a0, a1] of arcs) {
          const g = new T3.CylinderGeometry(1, 1, 1, Math.max(6, Math.ceil((a1 - a0) * 20)), 1, true, a0 + PI / 2, a1 - a0);
          g.translate(0, 0.5, 0);
          const m = new T3.Mesh(g, new T3.ShaderMaterial({ vertexShader: CURT_VS, fragmentShader: CURT_FS, transparent: true, depthWrite: false, blending: T3.AdditiveBlending, side: T3.DoubleSide, toneMapped: false,
            uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uLive: { value: 1 }, uProg: { value: 1 }, uC1: { value: new T3.Color('#7fffe0') }, uC2: { value: new T3.Color('#3d8bff') }, uC3: { value: new T3.Color(ACC) } } }));
          m.visible = false; m.renderOrder = 9; m.frustumCulled = false; group.add(m); walls.push(m);
        }
        let splashed = false;
        return (lt, dt) => {
          const live = lt >= warn, rad = radiusAt(lt);
          for (const m of waves) { m.visible = live; m.material.uniforms.uWaveR.value = rad; m.material.uniforms.uWaveW.value = thick / 2 + 0.15; }
          for (const m of walls) { m.visible = live && rad > rEnd; m.scale.set(rad, 1.3, rad); m.material.uniforms.uTime.value += dt; m.material.uniforms.uAlpha.value = live ? clamp((rad - rEnd) / 2, 0, 1) : 0; }
          if (live && !splashed && rad <= rEnd + 0.3) {
            splashed = true;
            for (let i = 0; i < 8; i++) fx('burst', G.polar(rEnd, i / 8 * TAU, 0.3), { color: '#7fffe0', count: 8, speed: 3, size: 0.4, life: 0.5 });
            world('ringGlow', 0, '#7fffe0', 1.2, 0.8);
          }
          if (live) for (const m of group.children) { const u = m.material && m.material.uniforms; if (u && u.uMode && u.uMode.value === 0) u.uAlpha.value = Math.max(0, 1 - (lt - warn) / life); }
        };
      },
      onFire: () => { sfx('rumble', { vol: 0.9 }); cam('shake', 0.35, 0.5); },
    });
    return h;
  }

  // ---- the Tide blocker: loop 0 lies on the middle ring and moves; direction flips are telegraphed
  // (the contact hazard is re-issued every 7 s in overlapping pieces; one persistent band draws it. This keeps the
  //  bot's per-hazard "ignore" roll from lasting a whole phase, and costs nothing visually)
  function startBlocker(b) {
    const D = b.data, R = RR();
    const w = 0.82;
    const S = P();
    const c0 = wrap((S ? S.theta : -PI / 2) + PI);
    const sched = [{ lt0: 0, c0, om: 0.26 }];
    const centerAt = (bt) => { let s = sched[0]; for (const x of sched) if (x.lt0 <= bt) s = x; return s.c0 + s.om * (bt - s.lt0); };
    const blk = D.blk = { sched, centerAt, w, t0: b.clock, now: () => b.clock - blk.t0, pieces: [] };
    blk.piece = (warn) => {
      const bt0 = blk.now();
      const h = G.hz.custom({
        warn, active: 7.6, dmg: 18, tick: 1.0, label: 'Coiled Body',
        test: (ring, theta, lt, pad) => ring === 1 && inArcR(1, theta, centerAt(bt0 + lt), w / 2, pad + 0.15),
      });
      blk.pieces.push(h); if (blk.pieces.length > 3) blk.pieces.shift();
      return h;
    };
    blk.piece(1.4);
    if (!D.blkBand) {
      const band = G.combat.bandMesh(R[1] - TH, R[1] + TH, -w / 2 - 0.04, w / 2 + 0.04, 0, ACC, {});
      const pivot = new T3.Group(); pivot.add(band); pivot.visible = false; D.wg.add(pivot);
      D.blkBand = { pivot, band };
    }
    const L = D.loops[0];
    L.busy = 0; L.glow = 0.6;
    loopTarget(L, { r: R[1], c: c0, w, A: 0.12, k: 3, yb: 0.42, weave: 0, flow: 1.4 }, { dive: true });
    L.follow = () => centerAt(blk.now());
    return blk;
  }
  function blockerVisual(b, dt) {
    const D = b.data, bb = D.blkBand; if (!bb) return;
    const blk = D.blk;
    bb.pivot.visible = !!blk && !D.dying;
    if (!blk) return;
    const bt = blk.now(), u = bb.band.material.uniforms;
    bb.pivot.rotation.y = blk.centerAt(bt);
    u.uTime.value += dt; u.uProgress.value = clamp(bt / 1.4, 0, 1); u.uAlpha.value = bt < 1.4 ? 1 : 0.55; u.uLive.value = 0;
  }
  // schedule a flip `lead` seconds ahead (so the ghost trail and the bot know), telegraphed with ring arrows
  async function flipBlocker(b, lead = 1.8) {
    const D = b.data, blk = D.blk; if (!blk) return;
    const lt = blk.now() + lead;
    const cur = blk.sched[blk.sched.length - 1];
    const nom = -cur.om * (0.9 + G.rand() * 0.35);
    blk.sched.push({ lt0: lt, c0: blk.centerAt(lt), om: clamp(nom, -0.34, 0.34) });
    world('ringArrows', 1, Math.sign(nom), true);
    world('ringGlow', 1, ACC, 0.6, lead);
    // the serpent turns to watch its coil: a back window
    b.faceTo(blk.centerAt(lt)); b.turnRate = 0.8;
    b.say(b.pick(['The tide turns.', 'Coil and turn.']), 1.6);
    await b.wait(lead);
    world('ringArrows', 1, Math.sign(nom), false);
    await b.wait(2.4);
    b.faceTo(null); b.turnRate = 0.42;
  }

  // ---- spit bolts (Tide): venom globs on spots ahead of you
  function spitBolts(b, n, o = {}) {
    const D = b.data;
    const r = b.playerRing();
    const from = toWorld(b, D.hb, V3());
    for (let i = 0; i < n; i++) {
      G.hz.bolt({ from: from.clone(), ring: o.ring != null ? o.ring : r, theta: b.playerAhead((o.t0 || 1.5) + i * (o.dt || 0.65)), warn: (o.warn || 1.6) + i * 0.2, radius: 1.0, dmg: o.dmg || 18, label: o.label || 'Venom Spit', color: o.color });
    }
    D.mouthK = 1; D.jawT = 0.5;
  }

  // ---- Star Seeds (Bloom): soak stars on different rings ahead; a missed seed = raid damage + wisps
  function starSeeds(b, n = 3, o = {}) {
    const S = P(); const d = b.playerDir();
    let ring = S.ring;
    const out = [];
    for (let i = 0; i < n; i++) {
      const choices = [0, 1, 2].filter(r => r !== ring);
      ring = choices[Math.floor(G.rand() * choices.length) % choices.length];
      const tArr = (o.t0 || 2.4) + i * (o.gap || 2.3);
      const th = b.playerAhead(Math.min(tArr, 3)) + d * G.OMEGA * Math.max(0, tArr - 3);
      const R = RR()[ring];
      out.push(G.hz.soak({
        ring, theta: th, warn: tArr + (o.slack || 2.2), radius: 0.8, failDmg: o.failDmg || 15, label: 'Star Seed', color: ACC,
        onSoak: () => { fx('burst', G.polar(R, th, 0.9), { color: ROSE, count: 22, speed: 6, size: 0.6, life: 0.7, star: true }); },
        onFail: () => {
          b.say('The seed blooms into wisps.', 1.6);
          if (C().boss === b && b.alive && C().playing()) { spawnWisp(b, ring, th + 0.3, { spd: 0.32 }); spawnWisp(b, ring, th - 0.3, { spd: 0.32 }); }
        },
      }));
    }
    return out;
  }

  // ---- Venom Beam (Bloom): a channelled sweep across all rings from the boss's mouth; leaves one wedge unswept
  async function venomBeam(b, o = {}) {
    await b.until(() => !b.casting);
    const D = b.data;
    const th = b.playerTheta(), d = b.playerDir();
    const start = th + d * (o.lead || 1.25);
    const span = o.span || PI * 1.6, warn = o.warn || 2.4, dur = o.dur || 3.6;
    b.say(b.pick(['Taste the bloom.', 'Venom of the nebula!']), 1.8);
    let h = null;
    D.pose = 'venom';
    b.trackPlayer = false; b.faceTo(start); b.turnRate = 2.4;
    const res = await b.cast({
      name: 'Venom Beam', dur: warn + dur, interruptible: false,
      telegraph: () => { h = G.hz.sweep({ rings: [0, 1, 2], from: start, to: start - d * span, warn, dur, width: 0.3, dmg: o.dmg || 34, label: 'Venom Beam' }); D.venom = { h, d }; return h; },
    }).catch((e) => { D.venom = null; throw e; });
    D.venom = null; D.pose = 'idle';
    b.faceTo(null); b.trackPlayer = true; b.turnRate = 0.42;
    return res;
  }

  // ---- Sky Dive (Storm): the head lunges down a spoke across all rings. Lethal, 2.8 s warn: get out of the lane
  function skyDive(b, o = {}) {
    const D = b.data, R = RR();
    const warn = o.warn || 2.8, hw = o.halfWidth || 1.75;
    const th0 = o.theta != null ? o.theta : b.playerAhead(warn);
    const h = G.hz.custom({
      warn, active: 0.45, dmg: o.dmg || 80, lethal: true, label: 'Sky Dive',
      test: (ring, theta, lt, pad) => Math.abs(angDiff(theta, th0)) * R[ring] < hw + 0.15 + pad && Math.abs(angDiff(theta, th0)) < PI / 2,
      draw: (group) => {
        for (let r = 0; r < 3; r++) group.add(G.combat.bandMesh(R[r] - TH, R[r] + TH, th0 - hw / R[r], th0 + hw / R[r], 0, ACC, { lethal: true }));
        // the lane: a long strip from the coil to the rim
        const len = 13.2, g = new T3.PlaneGeometry(len, hw * 2, 1, 1); g.rotateX(-PI / 2); g.translate(2.4 + len / 2, 0, 0);
        const m = new T3.Mesh(g, G.combat.teleMaterial(0, ACC, { lethal: true, arrow: 1, sx: len, sy: hw * 2 }));
        m.rotation.y = th0; m.position.y = TY - 0.01; m.renderOrder = 5; m.frustumCulled = false;
        m.material.uniforms.uAlpha.value = 0.55;
        group.add(m);
      },
      onFire: () => {
        sfx('thunder', { vol: 1 }); cam('shake', 0.9, 0.6); fx('flash', ACC, 0.3, 0.3);
        for (let r = 0; r < 3; r++) { fx('burst', G.polar(R[r], th0, 0.4), { color: ACC, count: 22, speed: 7, size: 0.7, life: 0.7 }); fx('shockwave', G.polar(R[r], th0, 0.1), { color: ACC, radius: 2.6, life: 0.5 }); }
      },
    });
    D.dive = { h, th0, warn, t0: b.clock };
    b.data.jawT = 0.3;
    D.pose = 'dive';
    b.faceTo(th0); b.trackPlayer = false; b.turnRate = 2.6;
    return h;
  }
  function endDive(b) { const D = b.data; D.dive = null; if (D.pose === 'dive') D.pose = 'idle'; b.faceTo(null); b.trackPlayer = true; b.turnRate = b.phase === 3 ? 0.55 : 0.42; }

  // ---- thunder (Storm): lightning bolts on spots near the hero
  function thunder(b, n = 3, o = {}) {
    const S = P();
    for (let i = 0; i < n; i++) {
      const ring = i === 0 ? S.ring : (i % 2 ? clamp(S.ring + 1, 0, 2) : clamp(S.ring - 1, 0, 2));
      const th = b.playerAhead(1.4 + i * 0.35) + (i === 0 ? 0 : (G.rand() - 0.5) * 0.5);
      const p = G.polar(RR()[ring], th, 16);
      G.hz.bolt({ from: p, ring, theta: th, warn: (o.warn || 1.5) + i * 0.15, radius: 1.1, dmg: o.dmg || 18, label: 'Storm Lightning', color: '#bfffe8' });
    }
  }

  // ================================================================ PHASE SCRIPTS
  // ---- Moonfall: bolts from the moon-crowned sky on spots ahead of you (reverse or shift)
  function moonfall(b, n = 3, o = {}) {
    const r = o.ring != null ? o.ring : b.playerRing();
    for (let i = 0; i < n; i++) {
      const th = b.playerAhead((o.t0 || 1.35) + i * (o.dt || 0.6));
      G.hz.bolt({ from: G.polar(RR()[r] * 0.6, th, 15), ring: r, theta: th, warn: (o.warn || 1.45) + i * 0.18, radius: 1.05, dmg: o.dmg || 20, label: o.label || 'Moonfall' });
    }
  }
  const STORM_T = 75;   // Storm phase timer (s) before the Maelstrom enrage
  const otherRing = (r, k) => [0, 1, 2].filter(x => x !== r)[k % 2];
  const phases = [
    // ------------------------------------------------------------------ P1 VEIL
    {
      name: 'Veil', hpStart: 1.0, sky: ['aurora', 0],
      enter(b) { b.turnRate = 0.42; b.trackPlayer = true; b.facingTarget = null; applyArena(b, 0); },
      update(b, dt) { speedControl(b, dt); },
      async script(b) {
        let k = 0;
        await b.wait(0.6);
        let v = 0;
        b.loop(async () => {
          // the veil: curtains on every ring (gaps offset per ring) most of the time
          curtains(b, { lanes: curtainLanes(b, [0, 1, 2], 0.95, 0.24 * (v++ % 2 ? -1 : 1), { n: 2 }), warn: 2.1, dur: 9.0, dmg: 10 });
          await b.wait(2.1 + 9.0 + 3.6);
        });
        b.loop(async () => {
          // bolts, wisps and lashes woven through the veil
          await b.wait(2.4);
          moonfall(b, 3);
          await b.wait(2.6);
          spawnWisps(b, 2);
          await b.wait(1.8);
          await coilLash(b, { ring: b.playerRing(), warn: 1.7, dur: 2.2, dmg: 26 });
          await b.wait(0.8);
          moonfall(b, 2, { t0: 1.2, dt: 0.7 });
          await b.wait(2.6);
          if (k % 2 === 0) {
            // constrict the inner ring while the tail lashes the outer one: the middle ring is the answer
            b.say('Tighter...', 1.4);
            constrict(b, { warn: 2.5, dmg: 30 });
            await b.wait(0.5);
            await coilLash(b, { ring: 2, warn: 2.0, dur: 2.2, dmg: 26 });
            b.trackPlayer = false; await b.wait(2.2); b.trackPlayer = true;      // it rests, facing locked: a back window
          } else {
            // twin lash: two rings at once, in opposite directions
            const r = b.playerRing(), r2 = otherRing(r, k >> 1);
            coilLash(b, { ring: r, warn: 1.9, dur: 2.3, dmg: 26 });
            await coilLash(b, { ring: r2, dir: -b.playerDir(), from: b.playerTheta() + b.playerDir() * 1.0, warn: 1.9, dur: 2.3, dmg: 26, loop: b.data.loops[1] });
            await b.wait(0.6);
          }
          spawnWisps(b, 2, [0, 2]);
          await b.wait(1.6);
          moonfall(b, 3, { t0: 1.3 });
          await b.wait(2.2);
          k++;
        });
        b.loop(async () => { await b.wait(k === 0 ? 14 : 21); await sirenSong(b); });
      },
    },
    // ------------------------------------------------------------------ P2 TIDE
    {
      name: 'Tide', hpStart: 0.75, sky: ['aurora', 1],
      enter(b) { b.turnRate = 0.42; b.trackPlayer = true; b.facingTarget = null; applyArena(b, 1); },
      update(b, dt) { speedControl(b, dt); },
      async script(b) {
        startBlocker(b);
        b.loop(async () => { await b.wait(7); if (b.data.blk) b.data.blk.piece(0); });
        b.say('Drown in light.', 2);
        await b.wait(1.6);
        let k = 0;
        const tide = (o = {}) => {
          const th = b.playerAhead(o.warn || 2.6), d = b.playerDir();
          const g1 = th + d * (1.4 + G.rand() * 0.6), g2 = th + PI + (G.rand() - 0.5) * 1.0;
          return tidalPull(b, { gaps: [{ center: g1, width: 0.8 }, { center: g2, width: 0.8 }], warn: o.warn || 2.6, speed: o.speed || 5.4, dmg: 34 });
        };
        b.loop(async () => {
          tide();
          await b.wait(1.4);
          spitBolts(b, 3, { t0: 1.5, dt: 0.65, warn: 1.6, dmg: 20 });
          await b.wait(3.0);
          await b.wait(2.2);
          spawnWisps(b, 2, [0, 2], { spd: 0.32 });
          await b.wait(2.0);
          spitBolts(b, 3, { t0: 1.4, dt: 0.7, warn: 1.55, dmg: 20 });
          await b.wait(2.4);
          tide({ speed: 6.5, warn: 2.5 });
          await b.wait(3.2);
          if (k % 2 === 0) { await coilLash(b, { ring: b.playerRing() === 2 ? 2 : 0, warn: 1.8, dur: 2.2, dmg: 26, loop: b.data.loops[1] }); }
          else { moonfall(b, 3, { t0: 1.3 }); await b.wait(1.6); spawnWisps(b, 2, [0, 2], { spd: 0.34 }); }
          await b.wait(1.6);
          k++;
        });
        b.loop(async () => { await b.wait(9 + G.rand() * 4); await flipBlocker(b, 1.8); });
        let v = 0;
        b.loop(async () => {
          await b.wait(3.0);
          // one veiled ring at a time (outer, then inner): the coil body already holds the middle ring
          curtains(b, { lanes: curtainLanes(b, [v % 2 ? 0 : 2], 1.0, 0.27 * (v++ % 2 ? -1 : 1), { n: 2, offs: [0, 0, PI / 2] }), warn: 2.0, dur: 9.0, dmg: 12 });
          await b.wait(2.0 + 9.0 + 1.5);
        });
        b.loop(async () => { await b.wait(17); await sirenSong(b); await b.wait(5); });
      },
    },
    // ------------------------------------------------------------------ P3 BLOOM
    {
      name: 'Bloom', hpStart: 0.5, sky: ['aurora', 2],
      enter(b) { b.turnRate = 0.45; b.trackPlayer = true; b.facingTarget = null; applyArena(b, 2); },
      update(b, dt) { speedControl(b, dt); },
      async script(b) {
        let k = 0;
        b.say('Bloom, children of the aurora.', 2.2);
        await b.wait(1.2);
        b.loop(async () => {
          // seeds on a route through the rings, with a lash on a ring the route does not use first
          const seeds = starSeeds(b, 3, { t0: 2.3, gap: 2.2, slack: 2.1 });
          await b.wait(2.4);
          const used = seeds.map(s => s.hazard.ring);
          const free = [0, 1, 2].find(r => r !== used[1] && r !== used[2]);
          coilLash(b, { ring: free != null ? free : otherRing(b.playerRing(), k), warn: 1.8, dur: 2.2, dmg: 26 });
          await b.wait(5.6);
          await venomBeam(b, { warn: 2.4, dur: 3.5, dmg: 32 });
          await b.wait(1.0);
          // the bloom veil: curtains, wisps, a lash and moonfall through it
          curtains(b, { lanes: curtainLanes(b, [0, 1, 2], 1.0, 0.29 * (k % 2 ? -1 : 1), { n: 2 }), warn: 2.0, dur: 8.5, dmg: 12 });
          await b.wait(2.6);
          spawnWisps(b, 2, null, { spd: 0.34 });
          await b.wait(1.8);
          await coilLash(b, { ring: b.playerRing(), warn: 1.7, dur: 2.2, dmg: 26, loop: b.data.loops[1] });
          await b.wait(0.8);
          moonfall(b, 3, { t0: 1.3 });
          await b.wait(3.4);
          if (k % 2 === 0) { constrict(b, { warn: 2.4, dmg: 30 }); await b.wait(0.4); moonfall(b, 3, { ring: 2, t0: 1.6 }); await b.wait(2.4); b.trackPlayer = false; await b.wait(2.0); b.trackPlayer = true; }
          else { starSeeds(b, 2, { t0: 2.1, gap: 2.3, slack: 2.0 }); await b.wait(2.5); spitBolts(b, 3, { t0: 1.4, dt: 0.7, dmg: 20 }); await b.wait(3.5); }
          k++;
        });
        b.loop(async () => { await b.wait(16); await sirenSong(b); await b.wait(8); });
      },
    },
    // ------------------------------------------------------------------ P4 STORM
    {
      name: 'Storm', hpStart: 0.2, sky: ['aurora', 3],
      enter(b) { b.turnRate = 0.55; b.trackPlayer = true; b.facingTarget = null; applyArena(b, 3); b.data.stormT = STORM_T; b.data.enraged = false; stormHud(b, true); },
      update(b, dt) {
        speedControl(b, dt);
        const D = b.data;
        D.stormT = Math.max(0, D.stormT - dt);
        stormHud(b);
        if (D.dive && b.clock - D.dive.t0 > D.dive.warn + 1.9) endDive(b);
      },
      async script(b) {
        const D = b.data;
        b.say('When the storm closes, the sky itself will fall.', 3);
        await b.wait(1.0);
        let k = 0;
        b.loop(async () => {
          await skyDive(b, { warn: 2.8, dmg: 70 });
          await b.wait(0.6);
          thunder(b, 3, { warn: 1.45, dmg: 20 });
          await b.wait(2.0);
          await b.wait(1.4);
          spawnWisps(b, 2, null, { spd: 0.38 });
          await b.wait(1.4);
          await coilLash(b, { ring: b.playerRing(), warn: 1.6, dur: 2.0, dmg: 28, loop: D.loops[k % 2] });
          await b.wait(0.4);
          await skyDive(b, { warn: 2.8, dmg: 70 });
          await b.wait(0.4);
          thunder(b, 3, { warn: 1.4, dmg: 20 });
          await b.wait(2.0);
          moonfall(b, 3, { t0: 1.2, dt: 0.55, label: 'Storm Lightning' });
          await b.wait(1.8);
          k++;
        });
        let v = 0;
        b.loop(async () => {
          await b.wait(0.5);
          curtains(b, { lanes: curtainLanes(b, [0, 1, 2], 0.95, 0.34 * (v % 2 ? -1 : 1), { alt: v++ % 3 === 2, n: 2 }), warn: 1.9, dur: 7.5, dmg: 10 });
          await b.wait(1.9 + 7.5 + 2.6);
        });
        b.loop(async () => {
          await b.wait(15);
          if (D.stormT > 14) await sirenSong(b, { dur: 3.0 });
          await b.wait(14);
        });
        // the storm timer: at 0:00 the Maelstrom completes and the sky strikes every 5 s
        (async () => {
          await b.until(() => D.stormT <= 30, 0.25); b.say('The storm closes in.', 2.2);
          await b.until(() => D.stormT <= 7, 0.1);
          await b.until(() => !b.casting, 0.1);
          b.say('Nowhere left beneath the sky.', 2.4);
          await b.cast({ name: 'Maelstrom', dur: Math.max(1, D.stormT), interruptible: false });
          D.enraged = true; D.stormT = 0;
          b.say('THE STORM HAS COME.', 3);
          fx('flash', '#cfe8ff', 0.45, 0.6); sfx('thunder', { vol: 1 });
          b.loop(async () => {
            for (let r = 0; r < 3; r++) G.hz.ring({ ring: r, warn: 1.6, active: 0.35, dmg: 40, label: 'Maelstrom' });
            await b.wait(1.6);
            world('lightning', '#d6ecff');
            await b.wait(3.4);
          });
        })().catch(() => { });
      },
    },
  ];

  // framework workaround (06_combat.js doTransition): if the hero died during the transition cinematic,
  // C.update's defeat flow already set 'dead', but doTransition then forces 'fight' and runs the phase with a
  // dead hero (fight never ends). Put the state back to 'dead' and do not start the phase script.
  for (const ph of phases) {
    const scr = ph.script, ent = ph.enter;
    ph.enter = function (b) {
      if (P() && !P().alive) { if (!C().deathT && G.state === 'fight') G.setState('dead'); return; }
      return ent && ent.call(this, b);
    };
    ph.script = async function (b) {
      if (P() && !P().alive) return;
      return scr.call(this, b);
    };
  }

  // ================================================================ STORM HUD (timer chip)
  function stormHud(b, create) {
    const D = b.data;
    if (create) {
      if (!D.stormEl) {
        const hud = document.getElementById('hud') || document.body;
        const el = document.createElement('div'); el.id = 'ourosStorm';
        el.style.cssText = 'position:absolute;left:calc(var(--sal,0px) + 14px);top:calc(var(--sat,0px) + 38px);font:600 12px system-ui,sans-serif;letter-spacing:.14em;color:#bfffe8;' +
          'text-shadow:0 0 8px rgba(0,0,0,.95),0 0 10px rgba(61,255,162,.55);padding:3px 9px 3px 8px;border:1px solid rgba(61,255,162,.55);border-radius:3px;background:rgba(4,12,10,.6);pointer-events:none;font-variant-numeric:tabular-nums;transition:color .3s, border-color .3s';
        hud.appendChild(el); D.stormEl = el; D.dom.push(el);
      }
    }
    const el = D.stormEl; if (!el) return;
    const t = Math.ceil(D.stormT), m = Math.floor(t / 60), s = t % 60;
    const txt = D.enraged ? 'THE STORM HAS COME' : 'STORM CLOSES ' + m + ':' + String(s).padStart(2, '0');
    if (el.textContent !== txt) el.textContent = txt;
    const hot = D.enraged || D.stormT < 10;
    el.style.color = hot ? '#ffd0e4' : '#bfffe8'; el.style.borderColor = hot ? 'rgba(255,95,158,.8)' : 'rgba(61,255,162,.55)';
    el.style.opacity = hot && !D.enraged ? (0.6 + 0.4 * Math.abs(Math.sin(D.t * 5))).toFixed(2) : '1';
  }

  // ================================================================ ANIMATION
  const _q = new T3.Quaternion(), _mm = new T3.Matrix4(), _v = V3(), _v2 = V3(), _look = V3();
  function animate(b, dt) {
    const D = b.data; if (!D || !D.main) return;
    D.t += dt;
    const t = D.t, S = P();
    // emerge from the pool at the start of the fight
    if (D.emerge < 1) D.emerge = Math.min(1, D.emerge + dt / 2.4);
    const em = G.easeOutCubic ? G.easeOutCubic(D.emerge) : D.emerge;
    b.model.position.y = (em - 1) * 8.5;
    for (const L of D.loops) if (D.emerge < 0.6 && !L.hidden) L.sub = 1;
    D.flashK = Math.max(0, D.flashK - dt * 2.2);
    const hitF = b.hitFlash || 0;
    // ---- pose targets (boss-local)
    const hbT = D.hbT;
    let jaw = 0.06 + 0.04 * Math.sin(t * 1.7), slack = 0;
    let lookY = 0.4;
    if (S) { const rr = ringRf(S.ringF != null ? S.ringF : S.ring); localOfTheta(b, S.theta, rr, 0.4, D.lookLocal); }
    _look.copy(D.lookLocal);
    if (D.pose === 'sing') {
      hbT.set(0.4 + Math.sin(t * 1.3) * 0.25, 6.6 + Math.sin(t * 2.2) * 0.15, Math.sin(t * 0.9) * 0.4);
      _look.set(5, 14, Math.sin(t * 0.7) * 2); jaw = 0.55 + 0.12 * Math.sin(t * 9);
      if (Math.random() < dt * 3) fx('shockwave', toWorld(b, _v.set(hbT.x + 1.2, hbT.y, hbT.z), V3()), { color: ROSE, radius: 3.2, life: 0.9, thickness: 0.15 });
      D.mouthK = Math.max(D.mouthK, 0.7);
    } else if (D.pose === 'roar') {
      hbT.set(1.0, 6.8, 0); _look.set(10, 6, 0); jaw = 0.95; slack = 0.4;
    } else if (D.pose === 'venom' && D.venom) {
      const hz = D.venom.h.hazard, a = hz.lt < hz.warn ? hz.from : hz.beamAt(hz.lt);
      hbT.set(1.9, 4.7, 0);
      localOfTheta(b, a, 8.5, 0.2, _look);
      if (hz.lt >= hz.warn && !hz.finished) b.facingTarget = a;
      jaw = hz.lt < hz.warn ? 0.3 + 0.4 * (hz.lt / hz.warn) : 0.8;
      D.mouthK = Math.max(D.mouthK, hz.lt < hz.warn ? hz.lt / hz.warn : 1);
      // the venom stream from the mouth to the beam
      if (hz.lt >= hz.warn && !hz.finished) {
        const mouthW = toWorld(b, _v.copy(D.hb).addScaledVector(D.hf, 1.4), V3());
        const tgt = G.polar(RR()[1], a, 0.2);
        D.venomT = (D.venomT || 0) - dt;
        if (D.venomT <= 0) { D.venomT = 0.07; fx('lance', mouthW, tgt, { color: ACC, width: 0.5, life: 0.12, intensity: 2.2 }); fx('burst', tgt, { color: ACC, count: 4, speed: 4, size: 0.5, life: 0.4 }); }
      }
    } else if (D.pose === 'dive' && D.dive) {
      const dv = D.dive, lt = b.clock - dv.t0, w = dv.warn;
      const rel = angDiff(dv.th0, b.facing), ca = Math.cos(rel), sa = -Math.sin(rel);
      let x, y;
      if (lt < w) { const u = sstep(0, 1, lt / w); x = lerp(1.6, -0.8, u); y = lerp(5.0, 8.2, u); jaw = 0.2 + 0.6 * u; }
      else { const u = lt - w; if (u < 0.28) { const e = (u / 0.28) ** 2; x = lerp(-0.8, 15.5, e); y = lerp(8.2, 0.9, Math.sqrt(e)); } else if (u < 0.75) { x = 15.5; y = 0.9; } else { const e = sstep(0, 1, (u - 0.75) / 0.9); x = lerp(15.5, 1.6, e); y = lerp(0.9, 5.0, e); } jaw = 0.9; slack = 0.8; }
      if (lt > w + 1.65) { x = 1.6; y = 5.0; }
      hbT.set(x * ca, y, x * sa);
      _look.set((x + 6) * ca, lt < w ? 0 : 0.4, (x + 6) * sa);
      D.hb.copy(hbT);          // the lunge is driven directly
    } else if (D.pose === 'death') {
      const k = D.deathK;
      hbT.set(1.2 * Math.cos(t * 2.3) * (1 - k), 5.5 + k * 4 + Math.sin(t * 3.1) * 0.6, 1.4 * Math.sin(t * 1.9) * (1 - k));
      _look.set(4 * Math.cos(t * 1.4), 3 + k * 12, 4 * Math.sin(t * 1.7)); jaw = 0.9; slack = 0.6;
    } else {
      // idle: sway, lean toward the hero
      const lean = D.squeezeT > 0 ? -0.4 : 0;
      hbT.set(2.0 + lean + Math.sin(t * 0.8) * 0.15, 5.4 + Math.sin(t * 0.63) * 0.22 + (b.casting ? 0.4 : 0), Math.sin(t * 0.47) * 0.45);
      if (b.casting && b.casting.name === 'Maelstrom') { hbT.set(0.6, 7.3, 0); _look.set(3, 18, 0); jaw = 0.85; }
    }
    if (b.staggered) { hbT.y -= 0.6; hbT.x -= 0.5; jaw = 0.5; }
    if (D.pose !== 'dive') D.hb.lerp(hbT, Math.min(1, dt * 4));
    // head forward: toward the look point, pitch clamped
    _v.subVectors(_look, D.hb).normalize();
    _v.y = clamp(_v.y, -0.72, D.pose === 'sing' || D.pose === 'death' || (b.casting && b.casting.name === 'Maelstrom') ? 0.9 : 0.35); _v.normalize();
    D.hf.lerp(_v, Math.min(1, dt * 5)).normalize();
    D.neckSlack = lerp(D.neckSlack, slack, Math.min(1, dt * 3));
    D.jaw = lerp(D.jaw, Math.max(jaw, D.jawT), Math.min(1, dt * 8)); D.jawT = Math.max(0.05, D.jawT - dt * 1.5);
    D.squeeze = lerp(D.squeeze, D.squeezeT, Math.min(1, dt * 2.5));
    // place the head
    D.head.position.copy(D.hb).addScaledVector(D.hf, -0.15);
    _v2.copy(D.head.position).add(D.hf);
    _mm.lookAt(_v2, D.head.position, _U); _q.setFromRotationMatrix(_mm);
    D.head.quaternion.copy(_q);
    D.head.rotateZ(Math.sin(t * 0.9) * 0.08);
    D.jawPivot.rotation.z = -D.jaw * 0.75;
    D.mouthK = Math.max(0, D.mouthK - dt * 1.2);
    D.mouth.material.opacity = clamp(D.mouthK + (b.casting ? 0.35 : 0), 0, 1);
    D.mouth.material.color.set(D.pose === 'sing' ? ROSE : ACC).multiplyScalar(1.6);
    D.crown.rotation.x += dt * 0.6; D.crownParts[1].rotation.z -= dt * 1.1;
    for (const e of D.eyes) e.material.opacity = 0.75 + 0.25 * Math.sin(t * 5) + hitF * 0.5;
    const emis = hitF * 0.08 + D.flashK * 0.35 + (b.staggered ? 0.12 : 0);
    D.skullMat.emissiveIntensity = emis; D.mats.brass.emissiveIntensity = emis * 0.6; D.hornMat.emissiveIntensity = emis + (b.phase === 3 ? 0.25 + 0.25 * Math.sin(t * 7) : 0);
    // ---- main body
    const np = mainSpine(D, D.mainPoly);
    const dk = D.deathK;
    layChain(D.main, D.mainPoly, np, {
      spacing: 0.3, offset: -t * 0.38, t,
      rad: (f, y) => {
        const r = f < 0.06 ? lerp(0.3, 0.4, f / 0.06) : f < 0.35 ? lerp(0.4, 0.52, (f - 0.06) / 0.29) : f < 0.86 ? lerp(0.52, 0.44, (f - 0.35) / 0.51) : lerp(0.44, 0.2, (f - 0.86) / 0.14);
        return r * sstep(-3.8, -0.8, y);
      },
      hide: D.dying ? (f) => f > 1 - dk : null,
      color: (f, i, out) => {
        const pulse = 0.5 + 0.5 * Math.sin(f * 26 - t * 3.2), surge = Math.exp(-Math.pow(((f - ((t * 0.18) % 1.3)) * 9), 2));
        const base = b.phase === 2 && i % 3 === 0 ? ROSE : ACC;
        return out.set(base).multiplyScalar(0.1 + 0.32 * pulse * pulse + surge * 1.5 + hitF * 0.5 + D.flashK * 1.2 + (b.staggered ? 0.3 : 0));
      },
      alphaF: (f, y) => sstep(-2.5, 0.0, y) * (D.dying ? (f > 1 - dk ? 0 : 1) : 1),
      strips: [{ st: D.finL, kind: 'left', w: 0.85, a: (f) => sstep(0.03, 0.12, f) * (1 - sstep(0.75, 0.95, f)) }, { st: D.finR, kind: 'right', w: 0.85, a: (f) => sstep(0.03, 0.12, f) * (1 - sstep(0.75, 0.95, f)) }, { st: D.dors, kind: 'dorsal', h: 0.75, a: (f) => sstep(0.0, 0.05, f) }],
    });
    D.ribU.uTime.value = t; D.ribU.uI.value = 0.42 + 0.1 * b.phase + D.flashK * 0.6 + hitF * 0.1;
    // ---- pillar, orb, rear sigil
    D.orbU.uTime.value = t; D.orbU.uI.value = 1.1 + 0.2 * b.phase + (b.casting ? 0.5 + 0.3 * Math.sin(t * 10) : 0) + D.flashK;
    D.orbGlow.material.opacity = 0.6 + 0.2 * Math.sin(t * 2) + (b.casting ? 0.2 : 0);
    D.orb.position.y = 4.05 + Math.sin(t * 1.4) * 0.08; D.orbGlow.position.y = D.orb.position.y;
    D.plates.rotation.y += dt * (0.4 + 0.25 * b.phase);
    D.poolU.uTime.value = t; D.poolU.uI.value = (0.9 + 0.3 * Math.sin(t * 0.9)) * (D.dying ? 1 - dk : 1);
    D.rear.position.y = 2.3 + Math.sin(t * 1.1) * 0.12; D.rearRings[0].rotation.z += dt * 0.8; D.rearRings[1].rotation.z -= dt * 1.4;
    const behind = S && S.behind;
    D.rear.scale.setScalar(behind ? 1.25 + 0.08 * Math.sin(t * 12) : 1);
    blockerVisual(b, dt);
    // ---- loops
    for (const L of D.loops) {
      if (D.dying) { L.hidden = true; }
      updateLoop(D, L, dt);
    }
    // ---- arena dressing
    D.lotusU.uTime.value = t;
    const lt = D.lotusTarget || 0;
    D.lotusU.uA.value = lerp(D.lotusU.uA.value, lt * 0.6, Math.min(1, dt * 0.8));
    D.lotus.visible = D.lotusU.uA.value > 0.01;
    if (D.lotus.visible) { D.lotus.rotation.y += dt * 0.05; const s = 0.4 + 0.6 * clamp(D.lotusU.uA.value / 0.6, 0, 1); D.lotus.scale.set(s, 1, s); }
    D.stormU.uTime.value = t;
    D.stormU.uA.value = lerp(D.stormU.uA.value, D.stormTarget || 0, Math.min(1, dt * 0.7));
    D.storm.visible = D.stormU.uA.value > 0.01;
    if (D.storm.visible) {
      const close = D.enraged ? 1 : 1 - clamp(D.stormT / STORM_T, 0, 1);
      D.stormU.uClose.value = close;
      const rad = lerp(21, 15.2, close); D.storm.scale.set(rad, 7, rad);
      D.stormU.uFlash.value = Math.max(0, D.stormU.uFlash.value - dt * 3);
      if (Math.random() < dt * (0.25 + close * 1.2) && G.state !== 'menu') {
        D.stormU.uFlash.value = 1;
        const a = Math.random() * TAU;
        fx('lightning', G.polar(rad, a, 9), G.polar(rad * 0.98, a + 0.1, 0.5), { color: '#d6ffee', width: 0.3, life: 0.25 });
      }
    }
    D.pourU.uTime.value = t;
    D.floodU.uTime.value = t;
    D.floodU.uA.value = lerp(D.floodU.uA.value, D.flooded && !D.dying ? 1 : 0, Math.min(1, dt * 1.2));
    D.floodMesh.visible = D.floodU.uA.value > 0.01;
    if (D.flooded && !D.dying && Math.random() < dt * 5 && G.state !== 'menu') {
      const a = Math.random() * TAU;
      fx('starFall', G.polar(RR()[0] + (Math.random() - 0.5) * 0.8, a, 0.1), Math.random() < 0.5 ? '#7fffe0' : '#5fa8ff', { height: 9, dur: 0.5, width: 0.18, count: 4, radius: 0.7 });
    }
    if (D.pourT > 0) { D.pourT -= dt; D.pourU.uA.value = Math.min(1, D.pourU.uA.value + dt * 2); } else D.pourU.uA.value = Math.max(0, D.pourU.uA.value - dt * 1.2);
    D.pour.visible = D.pourU.uA.value > 0.01;
    if (D.pour.visible) D.pour.children.forEach((m, i) => { m.scale.x = 1 + 0.2 * Math.sin(t * 3 + i); });
    // aurora motes in the bloom
    if (b.phase === 2 && !D.dying && Math.random() < dt * 4 && G.state !== 'menu') {
      const a = Math.random() * TAU, r = 3 + Math.random() * 12;
      fx('spark', G.polar(r, a, 0.2 + Math.random()), Math.random() < 0.5 ? ROSE : '#5fffb5', { count: 2, speed: 1.2, size: 0.6 });
    }
  }

  // ================================================================ CINEMATICS
  async function transition(b, from, to) {
    const D = b.data;
    D.sirenT = 0; G.player.setSpeedMul(1, 0);
    world('ringArrows', null, 1, false);
    D.blk = null; D.dive = null; D.venom = null;
    for (const L of D.loops) { L.follow = null; L.busy = 0; L.glow = 0; }
    b.trackPlayer = false; b.faceTo(null); b.turnRate = 0.8; b.facingTarget = -PI / 2;
    const home = homePos();
    if (to === 1) {
      // VEIL -> TIDE: the serpent roars, the aurora pours down and floods the inner ring; a coil settles on the middle ring
      D.pose = 'roar'; D.flashK = 1;
      b.say('The veil parts. Now... the tide.', 3);
      sfx('swell', {}); fx('flash', ACC, 0.2, 0.5); cam('shake', 0.5, 0.9);
      fx('shockwave', V3(0, 0.3, 0), { color: ACC, radius: 16, life: 1.3 });
      const cin = G.cam.cinematic([
        { t: 0, pos: home, look: [0, 0.5, 0] },
        { t: 1.5, pos: [-9.5, 3.2, 10.5], look: [0, 5.2, 0], fov: 46 },
        { t: 3.4, pos: [7.5, 4.2, 9.0], look: [0, 1.0, -2] },
        { t: 5.0, pos: home, look: [0, 0.5, 0] },
      ], { returnDur: 0.8 });
      await cwait(0.9);
      D.pourT = 3.4; world('beat', 1.2); post('bloomPulse', 0.25, 1.2);
      await cwait(0.8);
      world('flood', 0, 1); world('ringGlow', 0, '#7fffd0', 1.4, 2.5);
      for (let i = 0; i < 14; i++) fx('burst', G.polar(RR()[0], i / 14 * TAU, 0.4), { color: i % 2 ? '#7fffe0' : '#4f9dff', count: 10, speed: 3.5, size: 0.5, life: 0.9 });
      loopTarget(D.loops[0], { r: RR()[1], c: wrap(P().theta + PI), w: 0.82, A: 0.12, k: 3, yb: 0.42, weave: 0, flow: 1.4 }, { dive: true });
      await cwait(1.3);
      D.pose = 'idle'; applyArena(b, 1);
      await cwait(1.5);
      b.trackPlayer = true; b.facingTarget = null;
      return cin;
    }
    if (to === 2) {
      // TIDE -> BLOOM: the flood drains into a nebula lotus that opens beneath the arena
      D.pose = 'roar';
      b.say('Bloom, my children. Bloom!', 3);
      sfx('swell', {}); world('flood', 0, 0);
      const cin = G.cam.cinematic([
        { t: 0, pos: home, look: [0, 0.5, 0] },
        { t: 1.7, pos: [0, 27, 5.5], look: [0, -1, 0], fov: 50 },
        { t: 3.4, pos: [-6, 9, 13], look: [0, 3.5, 0] },
        { t: 5.0, pos: home, look: [0, 0.5, 0] },
      ], { returnDur: 0.8 });
      await cwait(0.8);
      D.lotusTarget = 1; post('bloomPulse', 0.35, 1.8); fx('flash', ROSE, 0.15, 0.6);
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * TAU;
        fx('burst', G.polar(4 + (i % 3) * 4, a, 0.5), { color: i % 2 ? ROSE : '#2dffa0', count: 8, speed: 5, size: 0.4, life: 1.1, star: true });
      }
      fx('shockwave', V3(0, 0.2, 0), { color: ROSE, radius: 18, life: 1.6 });
      await cwait(1.6);
      D.pose = 'sing';
      await cwait(1.2);
      D.pose = 'idle'; applyArena(b, 2);
      await cwait(1.2);
      b.trackPlayer = true; b.facingTarget = null;
      return cin;
    }
    // BLOOM -> STORM: the sky breaks; lightning crowns the serpent; a storm wall rises around the arena
    D.pose = 'roar';
    b.say('Enough. Let the storm take you!', 3);
    post('fade', 0.45, '#02060a', 0.4); sfx('rumble', { vol: 1 });
    const cin = G.cam.cinematic([
      { t: 0, pos: home, look: [0, 0.5, 0] },
      { t: 1.3, pos: [2.5, 1.8, 13.5], look: [0, 6.5, 0], fov: 48 },
      { t: 3.6, pos: [-3.5, 2.6, 12.5], look: [0, 7.5, 0], fov: 44 },
      { t: 5.0, pos: home, look: [0, 0.5, 0] },
    ], { returnDur: 0.8 });
    await cwait(0.9);
    D.lotusTarget = 0; D.stormTarget = 1;
    for (let i = 0; i < 4; i++) {
      const hw = toWorld(b, _v.copy(D.hb).add(V3(-1.3, 1.2, i % 2 ? 0.6 : -0.6)), V3());
      fx('lightning', V3(hw.x + (Math.random() - 0.5) * 6, 24, hw.z + (Math.random() - 0.5) * 6), hw, { color: '#e0fff4', width: 0.5, life: 0.35 });
      world('lightning', '#d6ecff'); sfx('thunder', { vol: 0.9 }); cam('shake', 0.7, 0.4); fx('flash', '#e8fff8', 0.4, 0.25);
      D.flashK = 1;
      await cwait(0.45);
    }
    post('fade', 0, '#02060a', 0.8);
    await cwait(1.2);
    D.pose = 'idle'; applyArena(b, 3);
    await cwait(1.0);
    b.trackPlayer = true; b.facingTarget = null;
    return cin;
  }

  async function death(b) {
    const D = b.data;
    D.sirenT = 0; G.player.setSpeedMul(1, 0);
    world('ringArrows', null, 1, false);
    D.pose = 'death'; D.dying = true; D.deathK = 0; D.enraged = false; D.stormTarget = 0;
    if (D.stormEl) { D.stormEl.remove(); D.stormEl = null; }
    b.say('The coil... unwinds...', 3.5);
    cam('slowMo', 0.35, 1.6);
    sfx('bossDeath', {});
    const home = homePos();
    const cin = G.cam.cinematic([
      { t: 0, pos: home, look: [0, 0.5, 0] },
      { t: 1.6, pos: [5.5, 3.0, 9.5], look: [0, 4.2, 0], fov: 46 },
      { t: 4.4, pos: [-4.0, 5.5, 12.5], look: [0, 6.0, 0], fov: 44 },
      { t: 7.6, pos: [0, 14, 24], look: [0, 4, 0], fov: 46 },
      { t: 9.2, pos: home, look: [0, 0.5, 0] },
    ], { returnDur: 1.0 });
    // vertebrae burst one by one from the tail up to the head
    const steps = 22;
    for (let i = 0; i < steps; i++) {
      D.deathK = (i + 1) / steps * 0.92;
      const np = mainSpine(D, D.mainPoly);
      const idx = clamp(Math.floor((1 - D.deathK) * (np - 1)), 0, np - 1);
      const lp = V3(D.mainPoly[idx * 3], D.mainPoly[idx * 3 + 1], D.mainPoly[idx * 3 + 2]);
      const wp = toWorld(b, lp, V3());
      fx('burst', wp, { color: i % 3 === 0 ? ROSE : i % 3 === 1 ? ACC : GOLDH, count: 12, speed: 5, size: 0.42, life: 0.8 });
      if (i % 4 === 0) { fx('shards', wp, { color: '#d9ac5a', count: 10, speed: 5 }); sfx('crack', { vol: 0.6 }); cam('shake', 0.35, 0.25); }
      await cwait(0.2);
    }
    // the head rears to the sky and dissolves into aurora
    D.pourT = 3.0;
    const hw = toWorld(b, D.hb, V3());
    for (let i = 0; i < 6; i++) {
      fx('burst', hw.clone().add(V3((Math.random() - 0.5) * 2, i * 0.6, (Math.random() - 0.5) * 2)), { color: i % 2 ? ROSE : ACC, count: 22, speed: 8, size: 0.6, life: 1.3, star: true });
      fx('lightning', hw, V3(hw.x + (Math.random() - 0.5) * 8, 26, hw.z + (Math.random() - 0.5) * 8), { color: i % 2 ? '#ffc0dc' : '#b0ffe0', width: 0.45, life: 0.4 });
      sfx('crack', { vol: 0.8 }); cam('shake', 0.5, 0.3);
      await cwait(0.3);
    }
    fx('flash', '#f2fff8', 0.4, 1.0); post('bloomPulse', 0.55, 2.0);
    fx('shockwave', V3(0, 0.4, 0), { color: ACC, radius: 24, life: 1.8 });
    fx('shockwave', V3(0, 0.6, 0), { color: ROSE, radius: 18, life: 1.4 });
    sfx('thunder', {}); cam('shake', 1.1, 1.0);
    b.root.visible = false;
    world('setSky', 'aurora', 1, 4);
    world('flood', 0, 0); world('ringGlow', 'all', ACC, 1.2, 3);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) fx('starFall', G.polar(RR()[i], k / 8 * TAU + i, 0.2), k % 2 ? ROSE : ACC, { height: 14 });
    await cwait(2.8);
    return cin;
  }

  // ================================================================ TEARDOWN
  function teardown(b) {
    const D = b.data || {};
    try { for (const [ev, fn] of D.listeners || []) G.off(ev, fn); } catch (e) { logE('teardown.off', e); }
    try { for (const el of D.dom || []) el.remove(); } catch (e) { logE('teardown.dom', e); }
    try { G.player.setSpeedMul(1, 0); } catch (e) { }
    world('flood', 0, 0); world('ringArrows', null, 1, false); world('ringGlow', 'all', '#ffffff', 0, 0.01);
    try { for (const tx of D.textures || []) tx.dispose(); } catch (e) { logE('teardown.tex', e); }
    // the world group is removed + disposed by combat.reset (it lives in G.layers.boss); make sure nothing else lingers
    if (D.wg && D.wg.parent) { /* reset removes it */ }
    D.listeners = []; D.dom = []; D.textures = [];
  }

  // ================================================================ DEFINITION
  G.bosses[1] = {
    name: 'OUROS', title: 'the Aurora Coil', accent: ACC, sky: 'aurora', music: 1,
    maxHp: 20500, parTime: 240, hitRadius: 1.5, hitHeight: 3.2, fadeOpacity: 0.32,
    phases,
    build, animate, teardown,
    onTransition: (b, from, to) => transition(b, from, to),
    onDeath: (b) => death(b),
  };
  // test/debug handle (read-only use)
  G.ouros = { curtains, coilLash, tidalPull, skyDive, starSeeds, venomBeam, sirenSong, spawnWisps };
})();
