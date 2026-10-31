// =====================================================================
// 11_boss3.js — VELOX, the Last Lap King + EVENT HORIZON CIRCUIT (§9).
// Ring arena over a black hole (accretion disk, photon ring, screen-space
// lens), clock-face dressing, a starfield-glass four-armed king with a
// crown of 8 clock hands, clock-spoke lasers, starfall, Tick-Tock freeze,
// head-on ghost karts that drive your old line, the eclipse final lap
// with the CHECKERED countdown + pit boxes, shattering track, and the
// light-bridge / newborn-star finale.                         (BOSS3)
// =====================================================================
{
  const { THREE } = G;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const sfx = (n, o) => { try { G.audio?.sfx?.(n, o); } catch (e) { } };
  const callout = (t, s) => { try { if (G.ui && G.ui.callout) G.ui.callout(t, s); else G.emit('ui:callout', { text: t, style: s }); } catch (e) { } };
  const K = () => G.kart, T = () => G.track;

  // ring constants (must match arena.shape): P(s) = R·(sin(s/R), 0, cos(s/R)), CCW from above
  const R = 70, W = 18, HW = W / 2, L = 2 * Math.PI * R, TAU = Math.PI * 2;
  const HOLE_Y = -6, HOLE_R = 14, THRONE_Y = 12;
  const angToS = (a) => ((a * R) % L + L) % L;
  const SITES = [L / 3, L * 5 / 6];          // ramp sites at 120° and 300°
  const GHOST_V = 30;                         // ghosts race head-on at 30 m/s
  const CLOCK_DUR = 45;
  const CLOCK_FIRST = 28;                     // the first CHECKERED of P3 comes sooner
  const B3_HP = 21000, HAND_HP = 560, HAND_STAGGER = 0.08;   // tuned for ~1.5x Boss 2 bot TTK (review)

  // scratch (no per-frame allocation)
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(),
    m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
  const F = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), n: new THREE.Vector3(), w: 0, bank: 0, kappa: 0 };
  const UPV = new THREE.Vector3(0, 1, 0), HOLE = new THREE.Vector3(0, HOLE_Y, 0), ZERO = new THREE.Vector3();
  const EU = new THREE.Euler();
  const NOISE = /* glsl */`
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
      return mix(mix(h12(i), h12(i+vec2(1,0)), u.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), u.x), u.y); }
    float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }`;
  const INST_VS = /* glsl */`
    vec4 instPos(vec3 p){ vec4 lp = vec4(p, 1.);
      #ifdef USE_INSTANCING
      lp = instanceMatrix * lp;
      #endif
      return lp; }`;

  let rig = null;       // scenery + boss rig (one boss 3 instance at a time)
  let frozen = false;   // Tick-Tock time stop (boss systems skip their motion)

  // =================================================================
  // MATERIALS
  // =================================================================
  // dark glass with a parallaxed starfield inside + starlight fresnel rim
  function glassMat(o = {}) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHit: { value: 0 }, uGold: { value: 0 }, uCrack: { value: 0 }, uRim: { value: new THREE.Color(o.rim || '#8fd7ff').multiplyScalar(o.rimK ?? 1) }, uDen: { value: o.den ?? 1 } },
      vertexShader: `varying vec3 vWN, vWP, vOP; ${INST_VS}
        void main(){ vec4 lp = instPos(position); vec4 wp = modelMatrix * lp; vWP = wp.xyz; vOP = position;
          vec3 n = normal;
          #ifdef USE_INSTANCING
          n = mat3(instanceMatrix) * n;
          #endif
          vWN = normalize(mat3(modelMatrix) * n); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform float uTime, uHit, uGold, uCrack, uDen; uniform vec3 uRim; varying vec3 vWN, vWP, vOP; ${NOISE}
        vec3 stars(vec3 d, float sc, float th){ vec3 g = d * sc; vec3 i = floor(g); float h = h13(i);
          vec3 f = fract(g) - .5 - (vec3(h13(i + 1.7), h13(i + 3.1), h13(i + 5.3)) - .5) * .5;
          float s = step(th, h) * smoothstep(.2, 0., length(f));
          return s * mix(vec3(.6, .8, 1.), vec3(1., .8, .6), h13(i + 9.)) * (.65 + .35 * sin(uTime * 3. + h * 60.)); }
        void main(){
          vec3 V = normalize(vWP - cameraPosition); vec3 N = normalize(vWN); if (!gl_FrontFacing) N = -N;
          float fr = pow(1. - abs(dot(N, V)), 2.4);
          vec3 rd = refract(V, N, .72);
          vec3 st = stars(rd + vOP * .010, 34., 1. - .06 * uDen) * 2.2 + stars(rd + vOP * .028, 19., 1. - .05 * uDen) * 1.4 + stars(rd + vOP * .06, 10., 1. - .04 * uDen);
          float n1 = vn(rd.xy * 3. + rd.z * 2. + uTime * .03), n2 = vn(rd.yz * 4. - vOP.xy * .05);
          vec3 neb = vec3(.10, .03, .20) * smoothstep(.35, .9, n1) + vec3(.02, .12, .16) * smoothstep(.4, .95, n2);
          vec3 col = vec3(.004, .006, .016) + neb + st + uRim * fr * 1.25 + uRim * .02;
          col += vec3(1., .78, .35) * uGold * (fr * 2.6 + .12);
          col += vec3(.8, .9, 1.) * uHit * (fr * 2. + .15);
          if (uCrack > 0.) { float c = 1. - smoothstep(0., .05, abs(vn(vOP.xy * .5 + vOP.z * .3) - .5)); col += vec3(1., .95, .8) * c * uCrack * 5.; }
          gl_FragColor = vec4(col, 1.); }`,
    });
  }
  function addMat(fs, uniforms = {}, o = {}) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, ...uniforms }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: o.side ?? THREE.DoubleSide, fog: false,
      vertexShader: `varying vec2 vUv; varying vec3 vWP; varying vec3 vC; ${INST_VS}
        void main(){ vUv = uv; vC = vec3(1.);
          #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
          #endif
          vec4 wp = modelMatrix * instPos(position); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vWP; varying vec3 vC; ${NOISE} ${fs}`,
    });
  }

  // =================================================================
  // SCENERY: black hole, accretion disks, clock bezel + numerals, debris, sky clock
  // =================================================================
  function buildScenery(group, track) {
    const merge = G.addons.BufferGeometryUtils.mergeGeometries;
    const sc = { group };
    // ---- black hole: pure black sphere + camera-facing photon ring / lensed disk halo ----
    const hole = new THREE.Mesh(new THREE.SphereGeometry(HOLE_R, 40, 24), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
    hole.position.copy(HOLE); group.add(hole); sc.hole = hole;
    const haloMat = addMat(`uniform float uK, uCollapse;
      void main(){ vec2 p = (vUv - .5) * 4.; float r = length(p); float a = atan(p.y, p.x);
        float photon = exp(-pow((r - 1.04) * 26., 2.)) * 2.6;
        float arcW = smoothstep(1.05, 1.18, r) * smoothstep(1.75, 1.25, r);
        float sw = fbm(vec2(a * 3. - uTime * .9, r * 5.));
        float top = .35 + .65 * smoothstep(-.4, 1., sin(a));
        vec3 dop = mix(vec3(1., .42, .16), vec3(.75, .9, 1.4), smoothstep(-1., 1., cos(a)));
        vec3 c = vec3(.85, .95, 1.2) * photon + dop * arcW * top * (.5 + sw) * 1.5 + vec3(.5, .6, 1.) * exp(-r * 1.6) * .25 * step(1., r);
        c *= uK * (1. - uCollapse) * step(.98, r);
        gl_FragColor = vec4(c, 1.); }`, { uK: { value: 1 }, uCollapse: { value: 0 } });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(HOLE_R * 4, HOLE_R * 4), haloMat);
    halo.position.copy(HOLE); halo.renderOrder = 2; halo.frustumCulled = false; group.add(halo); sc.halo = halo;
    // ---- accretion disk (r 16 → 55) and a faint outer dust disk under the floating track ----
    const diskFS = `uniform float uStar, uSpin, uInt, uR0, uR1, uSpinT;
      vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
      float diskN(vec2 xz, float r, float f){ vec2 q = rot2(xz, -(f * 1.8) / pow(max(r, 4.) / uR0, 1.5)) * (16. / uR1);
        float n = fbm(q), n2 = fbm(q * 2.3 + 7.);
        return (.55 + .45 * sin(r * 90. / uR1 + n * 7.)) * n + n2 * .35; }
      void main(){ vec2 xz = vWP.xz; float r = length(xz); float u = clamp((r - uR0) / (uR1 - uR0), 0., 1.);
        vec2 x0 = rot2(xz, -uSpinT * .5);
        float f1 = fract(uSpinT * .25), w1 = 1. - abs(2. * f1 - 1.);
        float nn = diskN(x0, r, f1) * w1 + diskN(x0 + 37., r, fract(f1 + .5)) * (1. - w1);
        float band = smoothstep(.25, .85, nn);
        vec3 hot = mix(vec3(1., .96, .88) * 2.4, vec3(1., .45, .12), smoothstep(0., .75, u));
        vec3 vel = normalize(vec3(vWP.z, 0., -vWP.x) + 1e-5); float vd = dot(vel, normalize(cameraPosition - vWP));
        vec3 dop = mix(vec3(1., .42, .17) * .55, vec3(.75, .89, 1.) * 1.55, smoothstep(-.9, .9, vd));
        float edge = smoothstep(0., .04, u) * smoothstep(1., .5, u);
        vec3 c = hot * dop * (.12 + band * band * 1.4) * edge * uInt;
        c += vec3(1., .97, .9) * 2. * exp(-u * 40.) * uInt * step(.0001, u);
        c = mix(c, vec3(1., .85, .55) * (1.3 * (1. - u) * (1. - u) + .12) * (.6 + band * .6) * edge * uInt, uStar);
        gl_FragColor = vec4(c, 1.); }`;
    const mkDisk = (r0, r1, y, k) => {
      const mat = addMat(diskFS, { uStar: { value: 0 }, uSpin: { value: 1 }, uSpinT: { value: 0 }, uInt: { value: k }, uR0: { value: r0 }, uR1: { value: r1 } });
      const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 160, 3).rotateX(-Math.PI / 2), mat); m.position.y = y; m.frustumCulled = false; group.add(m); return m;
    };
    sc.disk = mkDisk(16, 55, HOLE_Y, 0.5);
    sc.disk2 = mkDisk(84, 330, -42, 0.16);
    // ---- newborn star (finale): corona billboard, hidden until the death sequence ----
    const star = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), addMat(`uniform float uK;
      void main(){ vec2 p = (vUv - .5) * 2.; float r = length(p); float a = atan(p.y, p.x);
        float core = exp(-r * r * 40.) * 2.6 + exp(-r * 7.) * .6;
        float rays = pow(abs(cos(a * 6. + uTime * .3)), 30.) * exp(-r * 3.) * .9 + pow(abs(cos(a * 11. - uTime * .2)), 60.) * exp(-r * 2.2) * .6;
        float ring = exp(-pow((r - .42 - .03 * sin(uTime * 2.)) * 18., 2.)) * .5;
        vec3 c = vec3(1., .86, .58) * (core + rays + ring) * uK * smoothstep(1., .7, r);
        gl_FragColor = vec4(c, 1.); }`, { uK: { value: 0 } }));
    star.position.copy(HOLE).setY(HOLE_Y + 8); star.visible = false; star.frustumCulled = false; star.renderOrder = 3; group.add(star); sc.star = star;
    // ---- clock bezel: gold ring outside the track + 12 dark glass obelisks with Roman numerals ----
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(R + HW + 9, 0.35, 6, 220).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.6), fog: false }));
    bezel.position.y = -1.6; group.add(bezel);
    const obGeo = merge([new THREE.CylinderGeometry(0.9, 1.7, 1, 6).translate(0, 0.5, 0)]);
    const obel = new THREE.InstancedMesh(obGeo, glassMat({ den: 0.7, rimK: 0.45, rim: '#c9a6ff' }), 12);
    const atlas = numeralAtlas();
    const plateMat = addMat(`uniform sampler2D uAtlas; varying float vIdx;
      void main(){ float i = vIdx; vec2 cell = vec2(mod(i, 4.), 2. - floor(i / 4.)); vec4 t = texture2D(uAtlas, (cell + vUv) / vec2(4., 3.));
        vec3 c = vec3(1., .78, .32) * t.r * 2.8 + vec3(.55, .85, 1.) * t.g * 1.2;
        gl_FragColor = vec4(c, 1.); }`, { uAtlas: { value: atlas } }, { side: THREE.FrontSide });
    plateMat.vertexShader = plateMat.vertexShader.replace('varying vec3 vC;', 'varying vec3 vC; attribute float iIdx; varying float vIdx;').replace('vUv = uv;', 'vUv = uv; vIdx = iIdx;');
    const pgeo = new THREE.PlaneGeometry(7, 5.2);
    const idx = new Float32Array(12); for (let i = 0; i < 12; i++) idx[i] = i;
    pgeo.setAttribute('iIdx', new THREE.InstancedBufferAttribute(idx, 1));
    const plates = new THREE.InstancedMesh(pgeo, plateMat, 12);
    for (let i = 0; i < 12; i++) {
      // numeral k sits at clock angle (XII at s = 0 → world angle 0)
      const a = (i + 1) / 12 * TAU, rr = R + HW + 13, h = 13 + (i % 3 === 2 ? 7 : 0);
      V.a.set(Math.sin(a) * rr, -8, Math.cos(a) * rr); V.s.set(1, h, 1); V.q.setFromAxisAngle(UPV, a);
      obel.setMatrixAt(i, V.m.compose(V.a, V.q, V.s));
      V.a.set(Math.sin(a) * (rr - 1.9), -8 + h + 3.6, Math.cos(a) * (rr - 1.9)); V.q.setFromAxisAngle(UPV, a + Math.PI); V.s.set(1, 1, 1);
      plates.setMatrixAt(i, V.m.compose(V.a, V.q, V.s));
    }
    V.s.set(1, 1, 1);
    group.add(obel, plates);
    // ---- drifting debris (one InstancedMesh, the group rotates: zero per-frame cost) ----
    const deb = new THREE.Group(); group.add(deb); sc.debris = deb;
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#141225', roughness: 0.55, metalness: 0.6, flatShading: true, emissive: '#1a1040', emissiveIntensity: 0.6 }), 44);
    for (let i = 0; i < 44; i++) {
      const a = i * 2.399 + 0.3, inner = i < 10, rr = inner ? 22 + (i * 7.3) % 28 : 110 + (i * 37.7) % 190;
      V.a.set(Math.cos(a) * rr, inner ? HOLE_Y + 2 + (i % 4) * 2.5 : -30 + ((i * 13.1) % 70), Math.sin(a) * rr);
      const k = inner ? 0.6 + (i % 3) * 0.5 : 2 + ((i * 3.7) % 7); V.s.set(k * 1.3, k * 0.8, k);
      V.q.setFromEuler(EU.set(i, i * 1.7, i * 0.3)); rocks.setMatrixAt(i, V.m.compose(V.a, V.q, V.s));
    }
    V.s.set(1, 1, 1);
    deb.add(rocks);
    // ---- sky clock (CHECKERED countdown): camera-relative billboard with a sweep ----
    const clock = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), addMat(`uniform float uProg, uA, uWarn;
      void main(){ vec2 p = (vUv - .5) * 2.; float r = length(p); float a = atan(p.x, p.y); float f = fract(-a / 6.2832 + 1.);
        float ring = smoothstep(.02, 0., abs(r - .9)) ; float ring2 = smoothstep(.012, 0., abs(r - .78));
        float tick = step(.82, r) * step(r, .88) * step(.75, abs(cos(a * 30.))) ;
        float big = step(.76, r) * step(r, .9) * step(.985, abs(cos(a * 6.)));
        float sweep = step(f, uProg) * smoothstep(.9, .55, r) * smoothstep(.4, .7, r);
        vec3 base = mix(vec3(.55, .85, 1.), vec3(1., .2, .25), uWarn);
        vec3 c = base * (ring * 2.2 + ring2 + tick * 1.2 + big * 2.6) + base * sweep * (.35 + .25 * fbm(vec2(a * 4., r * 6. - uTime)));
        float hand = smoothstep(.03, 0., abs(dot(p, vec2(cos(uProg * 6.2832), -sin(uProg * 6.2832))))) * step(r, .86) * step(0., dot(p, vec2(sin(uProg * 6.2832), cos(uProg * 6.2832))));
        c += vec3(1.) * hand * 2.5;
        gl_FragColor = vec4(c * uA, 1.); }`, { uProg: { value: 1 }, uA: { value: 0 }, uWarn: { value: 0 } }));
    clock.frustumCulled = false; clock.visible = false; clock.renderOrder = -1; group.add(clock); sc.clock = clock;
    rig = buildVelox(group);
    rig.sc = sc;
    buildSystems(group);
    buildDom();
    const U = track.uniforms; rig.lineCol = U.uPalette.value[1].clone();
    return sc;
  }

  function numeralAtlas() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 288;
    const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 512, 288);
    const N = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const cx = (i % 4) * 128 + 64, cy = Math.floor(i / 4) * 96 + 48;
      x.strokeStyle = '#00ff00'; x.lineWidth = 3; x.strokeRect(cx - 58, cy - 42, 116, 84);
      x.fillStyle = '#ff0000'; x.font = '900 italic 54px "Segoe UI", Roboto, Helvetica, Arial, sans-serif'; x.fillText(N[i], cx, cy + 2);
    }
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }

  // =================================================================
  // VELOX RIG: throne, robe, glass body, 4 arms (scepter, flag, stopwatch, mirror), crown of 8 hands
  // =================================================================
  function buildVelox(group) {
    const merge = G.addons.BufferGeometryUtils.mergeGeometries;
    const glass = glassMat(), thrGlass = glassMat({ den: 0.6, rim: '#c9a6ff' });
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd27a', metalness: 1, roughness: 0.22, emissive: new THREE.Color('#ffaa33'), emissiveIntensity: 0.35, envMapIntensity: 1.8 });
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.6, 3.4), fog: false });
    const goldGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.1, 0.7), fog: false });
    const root = new THREE.Group(); root.position.set(0, THRONE_Y, 0); group.add(root);
    // ---- throne (floating platform + spike, seat, tall back) ----
    const thr = new THREE.Mesh(merge([
      new THREE.CylinderGeometry(11, 9.5, 2.2, 28).translate(0, -1.1, 0), new THREE.CylinderGeometry(9.5, 0.4, 11, 28).translate(0, -7.7, 0),
      new THREE.BoxGeometry(8.4, 4, 6.8).translate(0, 2, -0.6), new THREE.BoxGeometry(11, 17, 1.6).translate(0, 10.5, -4.4),
      new THREE.BoxGeometry(1.3, 2.4, 6.4).translate(-4.9, 4.6, -0.6), new THREE.BoxGeometry(1.3, 2.4, 6.4).translate(4.9, 4.6, -0.6),
    ]), thrGlass);
    root.add(thr);
    const trims = [new THREE.TorusGeometry(11, 0.28, 6, 64).rotateX(Math.PI / 2), new THREE.TorusGeometry(9.6, 0.2, 6, 56).rotateX(Math.PI / 2).translate(0, -2.2, 0),
      new THREE.BoxGeometry(11.6, 0.5, 2).translate(0, 19.2, -4.4), new THREE.BoxGeometry(0.5, 17, 2).translate(-5.7, 10.5, -4.4), new THREE.BoxGeometry(0.5, 17, 2).translate(5.7, 10.5, -4.4),
      new THREE.BoxGeometry(1.6, 0.4, 6.8).translate(-4.9, 5.9, -0.6), new THREE.BoxGeometry(1.6, 0.4, 6.8).translate(4.9, 5.9, -0.6)];
    root.add(new THREE.Mesh(merge(trims), gold));
    // clock halo behind the head (rotates)
    const haloG = new THREE.Group(); haloG.position.set(0, 21, -5.4); root.add(haloG);
    const hparts = [new THREE.TorusGeometry(9, 0.32, 6, 72), new THREE.TorusGeometry(6.6, 0.12, 6, 64)];
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, big = i % 3 === 0; hparts.push(new THREE.BoxGeometry(big ? 0.7 : 0.35, big ? 2.2 : 1.3, 0.3).translate(0, 7.8, 0).rotateZ(a)); }
    const haloM = new THREE.Mesh(merge(hparts), goldGlow); haloG.add(haloM);
    // ---- figure ----
    const fig = new THREE.Group(); fig.position.set(0, 4, 0.3); root.add(fig);
    const robeG = new THREE.Group(); fig.add(robeG);
    const robe = new THREE.LatheGeometry([[0.01, -4], [6.2, -4], [5.2, -3], [4.2, -1.8], [3.5, -0.6], [3.0, 0.2], [0.01, 0.2]].map(p => new THREE.Vector2(p[0], p[1])), 28).scale(1, 1, 0.82);
    robeG.add(new THREE.Mesh(robe, glass));
    const torso = new THREE.LatheGeometry([[0.01, -0.2], [2.9, 0], [3.1, 1.6], [3.5, 4], [4.3, 6.8], [4.9, 8.7], [4.5, 9.8], [2.7, 10.7], [1.3, 11.3], [1.25, 12.2], [0.01, 12.3]].map(p => new THREE.Vector2(p[0], p[1])), 28).scale(1, 1, 0.72);
    const head = new THREE.SphereGeometry(2.1, 22, 16).scale(0.92, 1.22, 0.96).translate(0, 13.9, 0.1);
    const jaw = new THREE.ConeGeometry(1.3, 2.2, 12).rotateX(Math.PI).translate(0, 12.6, 0.7);
    const shoulders = [new THREE.SphereGeometry(1.7, 14, 10).translate(4.6, 9.2, 0), new THREE.SphereGeometry(1.7, 14, 10).translate(-4.6, 9.2, 0),
      new THREE.SphereGeometry(1.3, 12, 10).translate(4.1, 6.3, 0.4), new THREE.SphereGeometry(1.3, 12, 10).translate(-4.1, 6.3, 0.4)];
    const body = new THREE.Mesh(merge([torso, head, jaw, ...shoulders]), glass); fig.add(body);
    // eyes + crown band (bright starlight)
    const gl = [new THREE.BoxGeometry(0.95, 0.22, 0.3).rotateZ(0.16).translate(-0.78, 14.15, 1.95), new THREE.BoxGeometry(0.95, 0.22, 0.3).rotateZ(-0.16).translate(0.78, 14.15, 1.95),
      new THREE.TorusGeometry(2.15, 0.16, 6, 40).rotateX(Math.PI / 2).translate(0, 15.7, 0.1)];
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; gl.push(new THREE.ConeGeometry(0.28, 1.4, 4).translate(Math.cos(a) * 2.15, 16.4, Math.sin(a) * 2.15 + 0.1)); }
    const eyes = new THREE.Mesh(merge(gl), glow); fig.add(eyes);
    // ---- arms: one merged mesh each, posed at the shoulder ----
    const armGeo = merge([new THREE.CylinderGeometry(0.78, 0.62, 5, 10).translate(0, -2.5, 0), new THREE.SphereGeometry(0.72, 10, 8).translate(0, -5, 0),
      new THREE.CylinderGeometry(0.62, 0.5, 4.6, 10).rotateX(Math.PI / 2).translate(0, -5, 2.3), new THREE.SphereGeometry(0.85, 10, 8).translate(0, -5, 4.75)]);
    const mkArm = (x, y, z, rest, raise) => {
      const sh = new THREE.Group(); sh.position.set(x, y, z); fig.add(sh);
      sh.add(new THREE.Mesh(armGeo, glass));
      const hand = new THREE.Group(); hand.position.set(0, -5, 4.85); sh.add(hand);
      const restQ = new THREE.Quaternion().setFromEuler(EU.set(...rest)), raiseQ = new THREE.Quaternion().setFromEuler(EU.set(...raise));
      sh.quaternion.copy(restQ);
      return { sh, hand, restQ, raiseQ, w: 0, wT: 0, wob: 0 };
    };
    const arms = {
      scep: mkArm(4.6, 9.2, 0, [-0.35, 0, 0.55], [-0.15, 0, 2.55]),
      flag: mkArm(-4.6, 9.2, 0, [-0.45, 0, -0.6], [-0.2, 0, -2.5]),
      watch: mkArm(4.1, 6.3, 0.4, [-0.75, 0, -0.32], [-1.05, 0, -0.2]),
      mirror: mkArm(-4.1, 6.3, 0.4, [-0.45, 0, -0.8], [-1.45, 0, 0.25]),
    };
    // scepter (upright in the hand) + star gem
    const sp = new THREE.Group(); arms.scep.hand.add(sp); sp.rotation.x = 0.35;
    sp.add(new THREE.Mesh(merge([new THREE.CylinderGeometry(0.22, 0.32, 13, 8).translate(0, 2.5, 0), new THREE.TorusGeometry(1.2, 0.18, 6, 24).translate(0, 9.4, 0), new THREE.SphereGeometry(0.5, 8, 6).translate(0, -4, 0)]), gold));
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 3.0, 3.6), fog: false })); gem.position.set(0, 9.4, 0); sp.add(gem);
    // checkered flag: gold pole + waving cloth
    const fp = new THREE.Group(); arms.flag.hand.add(fp); fp.rotation.x = 0.45;
    fp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 12, 8).translate(0, 3, 0), gold));
    const clothMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uWave: { value: 1 } }, side: THREE.DoubleSide, fog: false,
      vertexShader: `uniform float uTime, uWave; varying vec2 vUv; varying float vSh;
        void main(){ vUv = uv; vec3 p = position; float k = 1. - uv.x;
          float w = sin(k * 7. - uTime * 6. * uWave) * .55 * k * uWave + sin(uv.y * 4. + uv.x * 3. - uTime * 4.) * .2 * k;
          p.z += w; p.y -= k * k * .5 * (1.2 - uWave * .6); vSh = cos(k * 7. - uTime * 6. * uWave);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: `varying vec2 vUv; varying float vSh;
        void main(){ vec2 c = floor(vUv * vec2(8., 5.)); float ch = mod(c.x + c.y, 2.);
          vec3 col = mix(vec3(.02), vec3(1.25), ch) * (.75 + .25 * vSh);
          float b = step(vUv.y, .04) + step(.96, vUv.y); col = mix(col, vec3(1., .78, .3) * 2., b);
          gl_FragColor = vec4(col, 1.); }`,
    });
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.8, 24, 10).translate(-3.75, 0, 0), clothMat);
    cloth.position.set(0, 6.6, 0); fp.add(cloth);
    // mirror (oval frame + starry surface that flashes on Decree)
    const mr = new THREE.Group(); arms.mirror.hand.add(mr); mr.position.set(0, 1.6, 0.4); mr.rotation.x = -0.2;
    mr.add(new THREE.Mesh(merge([new THREE.TorusGeometry(2.3, 0.3, 8, 36).scale(1, 1.3, 1), new THREE.CylinderGeometry(0.26, 0.3, 2.6, 8).translate(0, -4.1, 0)]), gold));
    const mirMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } }, fog: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float uTime, uFlash; varying vec2 vUv; varying vec3 vN, vV; ${NOISE}
        void main(){ vec2 p = vUv - .5; float r = length(p); vec3 v = normalize(vV);
          float sw = fbm(vec2(atan(p.y, p.x) * 2. + uTime * .5, r * 8. - uTime));
          vec3 c = vec3(.05, .07, .14) + vec3(.4, .6, 1.) * pow(1. - abs(v.z), 2.) + vec3(.5, .7, 1.) * sw * .25;
          c += vec3(1., .3, .35) * uFlash * (2.5 + sw * 2.); gl_FragColor = vec4(c, 1.); }` });
    const mirS = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32).scale(1, 1.3, 1), mirMat); mirS.position.z = 0.05; mr.add(mirS);
    // ---- the stopwatch (core) held in front of the belly ----
    const watch = new THREE.Group(); watch.position.set(0.6, 4.8, 5.4); fig.add(watch);
    watch.add(new THREE.Mesh(merge([new THREE.CylinderGeometry(3.4, 3.4, 1.1, 44).rotateX(Math.PI / 2), new THREE.TorusGeometry(3.4, 0.28, 8, 44).translate(0, 0, 0.55),
      new THREE.CylinderGeometry(0.45, 0.45, 1.5, 10).translate(0, 4.05, 0), new THREE.CylinderGeometry(0.9, 0.9, 0.7, 14).translate(0, 4.9, 0), new THREE.TorusGeometry(1.15, 0.2, 6, 20).translate(0, 5.6, 0),
      new THREE.CylinderGeometry(0.35, 0.35, 1, 8).rotateZ(0.7).translate(-2.6, 2.9, 0), new THREE.CylinderGeometry(0.35, 0.35, 1, 8).rotateZ(-0.7).translate(2.6, 2.9, 0)]), gold));
    const faceMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uHand: { value: 0 }, uGold: { value: 0 }, uPulse: { value: 0 }, uHit: { value: 0 } }, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uTime, uHand, uGold, uPulse, uHit; varying vec2 vUv; ${NOISE}
        void main(){ vec2 p = (vUv - .5) * 2.; float r = length(p); float a = atan(p.x, p.y);
          float ticks = step(.8, r) * step(r, .93) * step(.86, abs(cos(a * 30.)));
          float big = step(.7, r) * step(r, .94) * step(.988, abs(cos(a * 6.)));
          vec2 hd = vec2(sin(uHand), cos(uHand)); float along = dot(p, hd), across = abs(p.x * hd.y - p.y * hd.x);
          float hand = smoothstep(.045, .0, across) * step(-.15, along) * step(along, .86);
          vec2 hd2 = vec2(sin(uHand / 12.), cos(uHand / 12.)); float hand2 = smoothstep(.07, .0, abs(p.x * hd2.y - p.y * hd2.x)) * step(0., dot(p, hd2)) * step(dot(p, hd2), .5);
          float sw = fbm(vec2(a * 3. - uTime * .6, r * 4. - uTime * .9));
          vec3 face = vec3(.03, .05, .12) + vec3(.25, .5, 1.) * sw * .35 * r;
          vec3 c = face + vec3(.75, .9, 1.) * (ticks * 1.4 + big * 2.6) + vec3(1.) * (hand * 3. + hand2 * 2.);
          c += vec3(1., .2, .3) * smoothstep(.06, 0., abs(along * 0. + r - .12)) * 2.;
          c = mix(c, c * .4 + vec3(1., .8, .35) * (1.6 + sw * 2. + sin(uTime * 9.) * .4) * (1. - r * .4), uGold);
          c += vec3(.7, .85, 1.) * (uPulse * 2. + uHit * 1.4) * (1. - r * .5);
          gl_FragColor = vec4(c, 1.); }` });
    const face = new THREE.Mesh(new THREE.CircleGeometry(3.05, 48), faceMat); face.position.z = 0.57; watch.add(face);
    const coreNode = new THREE.Object3D(); coreNode.position.set(0, 0, 1.4); watch.add(coreNode);
    const bodyNode = new THREE.Object3D(); bodyNode.position.set(0, 9, 1.5); fig.add(bodyNode);
    // ---- crown: 8 floating gold clock hands (sub-HP targets) ----
    const handGeo = merge([new THREE.BoxGeometry(3.4, 0.36, 0.2).translate(1.9, 0, 0), new THREE.ConeGeometry(0.55, 1.4, 4).rotateZ(-Math.PI / 2).translate(4.25, 0, 0),
      new THREE.TorusGeometry(0.5, 0.14, 6, 14).translate(0, 0, 0), new THREE.BoxGeometry(1.2, 0.2, 0.2).translate(-0.9, 0, 0)]);
    const crown = new THREE.InstancedMesh(handGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), 8);
    crown.frustumCulled = false; fig.add(crown);
    const handNodes = [];
    for (let i = 0; i < 8; i++) { const n = new THREE.Object3D(); fig.add(n); handNodes.push(n); crown.setColorAt(i, new THREE.Color(3, 2.1, 0.6)); }
    return { root, fig, robeG, body, eyes, arms, gem, cloth, clothMat, mirMat, watch, faceMat, coreNode, bodyNode, crown, handNodes, haloG, haloM,
      glass, thrGlass, thr, gold, glow, upper: [body], yaw: 0, stand: 0, standT: 0, slump: 0, crownA: 0, crownSpin: 0.55, handFlash: new Float32Array(8),
      handAlive: [1, 1, 1, 1, 1, 1, 1, 1], watchSpin: 0, watchRate: 1, pulse: 0, mirrorFlash: 0, flagWave: 1, dead: false, animT: 0, col: new THREE.Color() };
  }

  // =================================================================
  // DYNAMIC SYSTEMS: spoke beams, meteors, ghosts, pit columns, checker wall, light bridge
  // =================================================================
  const spokes = [];       // pool of 8 {on, ang, dir, w, g0, g1, slide, hs:[inner, outer]}
  const meteors = [];      // pool of 12 {on, h, from, to}
  const ghosts = [];       // 2 {on, ob, lag, alpha, respawnT, ribbon, ribT, prevDs, lastHitT, d}
  const lanceTargets = [];
  let lanceIdx = 0;
  const sysm = {};          // meshes
  function buildSystems(group) {
    // beams: two crossed unit planes along +X (uv.y across)
    const bgeo = G.addons.BufferGeometryUtils.mergeGeometries([new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2).translate(0.5, 0, 0)]);
    const beams = new THREE.InstancedMesh(bgeo, addMat(`
      void main(){ float ac = abs(vUv.y * 2. - 1.); float core = exp(-ac * 7.), halo = exp(-ac * 2.2) * .5;
        float fl = .75 + .25 * sin(vUv.x * 90. - uTime * 40.) * sin(vUv.x * 23. + uTime * 17.);
        vec3 c = (vec3(1., .16, .22) * (halo + core * 1.4) + vec3(1., .85, .85) * pow(core, 3.) * 2.4) * fl * vC.x;
        c *= smoothstep(0., .02, vUv.x) * smoothstep(1., .97, vUv.x);
        gl_FragColor = vec4(c, 1.); }`), 16);
    beams.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(48), 3);
    beams.frustumCulled = false; beams.count = 0; group.add(beams); sysm.beams = beams;
    // spoke safe-notch posts: two cyan pillars marking the gap in each live spoke
    const pgeo = G.addons.BufferGeometryUtils.mergeGeometries([new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2).translate(0, 0.5, 0)]);
    const posts = new THREE.InstancedMesh(pgeo, addMat(`
      void main(){ float ac = abs(vUv.x * 2. - 1.); float y = vUv.y;
        float core = exp(-ac * 6.) * (1. - y * .7), tip = exp(-pow((y - .96) * 30., 2.)) * exp(-ac * 2.);
        vec3 c = vec3(.2, .95, 1.) * (core * 1.5 + tip * 1.6) + vec3(.85, 1., 1.) * pow(core, 4.) * .8;
        gl_FragColor = vec4(c * vC.x, 1.); }`), 32);
    posts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(96), 3);
    posts.frustumCulled = false; posts.count = 0; posts.visible = false; group.add(posts); sysm.posts = posts;
    for (let i = 0; i < 8; i++) spokes.push({ on: false, ang: 0, dir: 1, w: 0.3, g0: -3, g1: 3, gc: 0, slide: 0, hs: [null, null], ph: 0 });
    // meteors: crossed planes along +Y (head at 0)
    const mgeo = G.addons.BufferGeometryUtils.mergeGeometries([new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2).translate(0, 0.5, 0)]);
    const mets = new THREE.InstancedMesh(mgeo, addMat(`
      void main(){ float ac = abs(vUv.x * 2. - 1.); float y = vUv.y; float core = exp(-ac * 6.) * pow(1. - y, 2.2);
        vec3 c = mix(vec3(1., .45, .85), vec3(.75, .92, 1.), exp(-y * 4.)) * core * 1.5 + vec3(1.) * exp(-y * 30.) * exp(-ac * 3.) * 2.5;
        gl_FragColor = vec4(c * vC.x, 1.); }`), 12);
    mets.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(36), 3);
    mets.frustumCulled = false; mets.count = 0; group.add(mets); sysm.mets = mets;
    for (let i = 0; i < 12; i++) meteors.push({ on: false, h: null, from: new THREE.Vector3(), to: new THREE.Vector3() });
    // ghost karts: red fresnel copies (instance color = intensity)
    const gk = G.addons.BufferGeometryUtils.mergeGeometries([new THREE.BoxGeometry(1.7, 0.5, 3.0).translate(0, 0.45, 0), new THREE.BoxGeometry(1.1, 0.5, 1.2).translate(0, 0.9, 0.2),
      new THREE.SphereGeometry(0.42, 10, 8).translate(0, 1.35, 0.25), new THREE.BoxGeometry(2.1, 0.12, 0.5).translate(0, 0.85, 1.5),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => new THREE.TorusGeometry(0.42, 0.13, 6, 14).rotateY(Math.PI / 2).translate(x * 0.95, 0.42, z * 1.05))]);
    const gmesh = new THREE.InstancedMesh(gk, addMat(`varying vec3 vN2;
      void main(){ vec3 v = normalize(cameraPosition - vWP); float f = pow(1. - abs(dot(normalize(vN2), v)), 1.6);
        float scan = .75 + .25 * sin(vWP.y * 18. - uTime * 9.);
        gl_FragColor = vec4(vec3(1., .16, .23) * (f * 3.2 + .5) * scan * vC.x, 1.); }`), 2);
    gmesh.material.vertexShader = gmesh.material.vertexShader.replace('varying vec3 vC;', 'varying vec3 vC; varying vec3 vN2;')
      .replace('vec4 wp =', 'vN2 = mat3(modelMatrix) * mat3(instanceMatrix) * normal; vec4 wp =');
    gmesh.material.side = THREE.FrontSide;
    gmesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(6), 3);
    gmesh.frustumCulled = false; gmesh.count = 0; group.add(gmesh); sysm.ghosts = gmesh;
    // ghost warnings: a tall red beacon above each ghost + red chevrons on the road along its coming line
    const bcg = G.addons.BufferGeometryUtils.mergeGeometries([new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2).translate(0, 0.5, 0)]);
    const gbeac = new THREE.InstancedMesh(bcg, addMat(`
      void main(){ float ac = abs(vUv.x * 2. - 1.); float y = vUv.y;
        float core = exp(-ac * 7.) * (1. - y * .85), halo = exp(-ac * 2.4) * .35 * (1. - y);
        float fl = .8 + .2 * sin(y * 40. - uTime * 22.);
        vec3 c = (vec3(1., .12, .2) * (core * 1.6 + halo) + vec3(1., .8, .8) * pow(core, 4.) * 1.2) * fl * vC.x;
        gl_FragColor = vec4(c, 1.); }`), 2);
    gbeac.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(6), 3);
    gbeac.frustumCulled = false; gbeac.count = 0; gbeac.visible = false; group.add(gbeac); sysm.gbeac = gbeac;
    const gchev = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), addMat(`
      void main(){ float ax = abs(vUv.x - .5) * 2.; float c = vUv.y + ax * .5;
        float band = smoothstep(.3, .4, c) * smoothstep(.78, .66, c) * smoothstep(1., .85, ax);
        gl_FragColor = vec4(vec3(1., .14, .22) * band * 1.1 * vC.x, 1.); }`), 16);
    gchev.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(48), 3);
    gchev.frustumCulled = false; gchev.count = 0; gchev.visible = false; gchev.renderOrder = 3; group.add(gchev); sysm.gchev = gchev;
    for (let i = 0; i < 2; i++) ghosts.push({ on: false, ob: null, lag: i ? 14 : 8, alpha: 0, respawnT: -1, ribbon: null, ribT: 0, prevDs: 0, lastHitT: -9, d: 0, yaw: 0, want: false });
    for (let i = 0; i < 8; i++) lanceTargets.push(new THREE.Vector3());
    // pit box light columns
    const pit = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, 0.5, 0), addMat(`
      void main(){ float y = vUv.y; float st = .6 + .4 * sin(vUv.x * 6.2832 * 12. + uTime * 3.) * sin(y * 10. - uTime * 4.);
        vec3 c = vec3(.25, .95, 1.) * (pow(1. - y, 2.) * 1.6 + smoothstep(.06, 0., y) * 2.) * st * vC.x;
        gl_FragColor = vec4(c, 1.); }`, {}, { side: THREE.FrontSide }), 2);
    pit.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(6), 3);
    pit.frustumCulled = false; pit.count = 0; pit.visible = false; group.add(pit); sysm.pit = pit;
    // checkered shockwave wall
    const chk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 180, 1, true).translate(0, 0.5, 0), addMat(`uniform float uA;
      void main(){ vec2 c = floor(vec2(vUv.x * 180., vUv.y * 4.)); float ch = mod(c.x + c.y, 2.);
        float lip = smoothstep(.25, 0., vUv.y) * 1.5 + .4;
        vec3 col = mix(vec3(.08), vec3(1.6), ch) * lip * (1. - vUv.y * .7);
        gl_FragColor = vec4(col * uA, 1.); }`, { uA: { value: 0 } }));
    chk.visible = false; chk.frustumCulled = false; chk.renderOrder = 4; group.add(chk); sysm.chk = chk;
    // light bridge (finale): a 48-segment strip, positions written once when it spawns
    const NB = 48, bpos = new Float32Array((NB + 1) * 2 * 3), buv = new Float32Array((NB + 1) * 2 * 2), bidx = [];
    for (let i = 0; i <= NB; i++) { buv[i * 4] = 0; buv[i * 4 + 1] = i / NB; buv[i * 4 + 2] = 1; buv[i * 4 + 3] = i / NB; if (i < NB) { const a = i * 2; bidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bg.setAttribute('uv', new THREE.BufferAttribute(buv, 2)); bg.setIndex(bidx);
    const bridge = new THREE.Mesh(bg, addMat(`uniform float uProg;
      void main(){ float ac = abs(vUv.x * 2. - 1.); if (vUv.y > uProg) discard;
        float chev = step(.5, fract(vUv.y * 30. - abs(vUv.x - .5) * 1.5 - uTime * 3.));
        float edge = smoothstep(.75, 1., ac) * 2.5;
        vec3 c = vec3(.55, .95, 1.) * (exp(-ac * 2.) * (.5 + chev * .6) + edge) + vec3(1.) * smoothstep(.04, 0., uProg - vUv.y) * 4.;
        gl_FragColor = vec4(c, 1.); }`, { uProg: { value: 0 } }));
    bridge.visible = false; bridge.frustumCulled = false; group.add(bridge); sysm.bridge = bridge; sysm.NB = NB;
  }

  // ---- DOM: big CHECKERED countdown number (top right) ----
  let dom = null;
  function buildDom() {
    const host = document.getElementById('hud') || document.body;
    let el = document.getElementById('b3-clock');
    if (!el) {
      el = document.createElement('div'); el.id = 'b3-clock';
      el.style.cssText = 'position:absolute;right:calc(18px + env(safe-area-inset-right));top:22%;text-align:center;pointer-events:none;display:none;font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-style:italic;transform-origin:50% 50%;z-index:5;';
      // phones in landscape: sit under the enrage timer, smaller, clear of the OVERCLOCK / COMET buttons
      if (!document.getElementById('b3-clock-css')) {
        const css = document.createElement('style'); css.id = 'b3-clock-css';
        css.textContent = '@media (max-height:500px){#b3-clock{top:calc(env(safe-area-inset-top) + 46px)!important;right:calc(12px + env(safe-area-inset-right))!important;transform-origin:100% 0!important}#b3-clock .n{font-size:34px!important}#b3-clock .l{font-size:9px!important}#b3-clock .h{font-size:10px!important}}';
        document.head.appendChild(css);
      }
      el.innerHTML = '<div class="l" style="font-weight:800;font-size:12px;letter-spacing:.3em;color:#bfe3ff;opacity:.85">CHECKERED</div><div class="n" style="font-weight:900;font-size:clamp(42px,7vw,84px);line-height:1;color:#fff;text-shadow:0 0 18px #8fd7ff,0 0 4px #8fd7ff">45</div><div class="h" style="font-weight:900;font-size:13px;letter-spacing:.12em;color:#35f3ff;text-shadow:0 0 10px #35f3ff;opacity:0">GET IN A PIT BOX!</div>';
      host.appendChild(el);
    }
    dom = { el, n: el.querySelector('.n'), h: el.querySelector('.h'), shown: false, last: -1, warn: false, hint: 'GET IN A PIT BOX!' };
  }
  function domClock(show, sec, warn, stopped) {
    if (!dom) return;
    if (show !== dom.shown) { dom.shown = show; dom.el.style.display = show ? 'block' : 'none'; }
    if (!show) return;
    const hint = stopped ? 'CLOCK STOPPED' : 'GET IN A PIT BOX!';
    if (hint !== dom.hint) { dom.hint = hint; dom.h.textContent = hint; dom.h.style.color = stopped ? '#ffc93a' : '#35f3ff'; dom.h.style.textShadow = stopped ? '0 0 10px #ffc93a' : '0 0 10px #35f3ff'; }
    if (stopped) warn = false;
    const ho = (warn || stopped) ? '1' : '0'; if (ho !== dom.ho) { dom.ho = ho; dom.h.style.opacity = ho; }
    const n = Math.max(0, Math.ceil(sec));
    if (n !== dom.last) {
      dom.last = n; dom.n.textContent = n;
      if (warn !== dom.warn) { dom.warn = warn; dom.n.style.color = warn ? '#ff4a5a' : '#fff'; dom.n.style.textShadow = warn ? '0 0 22px #ff2a3a' : '0 0 18px #8fd7ff,0 0 4px #8fd7ff'; }
      dom.el.style.transform = warn ? 'scale(1.18)' : 'scale(1)';
      setTimeout(() => { if (dom) dom.el.style.transform = 'scale(1)'; }, 120);
    }
  }

  // ---- temporary boost pads (shatter): mirrors track pads into its uniforms ----
  function syncPads() {
    const Tr = T(), U = Tr.uniforms; if (!U || !U.uPads) return;
    for (let i = 0; i < U.uPads.value.length; i++) { const p = Tr.pads[i]; if (p) U.uPads.value[i].set(p.s, p.d0, p.d1, p.len); else U.uPads.value[i].set(0, 0, 0, 0); }
  }
  function addTempPad(s, lane, len, until) {
    const Tr = T(); if (Tr.pads.length >= 8) return null;
    const w = Tr.width(s), p = { s: Tr.wrap(s), lane, len, d0: lane * w / 3 - w / 6 + 0.4, d1: lane * w / 3 + w / 6 - 0.4, until, b3: true };
    Tr.pads.push(p); syncPads(); return p;
  }
  function prunePads(all) {
    const Tr = T(); let ch = false;
    for (let i = Tr.pads.length - 1; i >= 0; i--) if (Tr.pads[i].b3 && (all || Tr.pads[i].until <= G.time.now)) { Tr.pads.splice(i, 1); ch = true; }
    if (ch) syncPads();
  }
  function clearShatter(b) {
    const m = b.mem;
    for (const g of (m.gaps || [])) { try { T().removeGap(g.id); T().removeRamp(g.ramp); } catch (e) { } }
    m.gaps = []; prunePads(true);
  }

  // =================================================================
  // ATTACK HELPERS
  // =================================================================
  const tele = (o) => G.tele.spawn(o);
  function armPose(name, w, dur) { const a = rig?.arms[name]; if (!a) return; a.wT = w; a.holdT = dur ?? 1.2; }
  function gemPos(out) { rig.gem.getWorldPosition(out); return out; }

  // ---- clock spokes: a radial laser with a lane-wide safe notch, as 2 bands ----
  function spawnSpoke(b, ang, dir, w, lane, slide) {
    const sp = spokes.find(x => !x.on); if (!sp) return;
    sp.on = true; sp.ang = ang; sp.dir = dir; sp.w = w; sp.gc = lane * W / 3; sp.slide = slide || 0; sp.ph = G.rng() * 6; sp.hs[0] = sp.hs[1] = null; sp.left = 0;
    gapOf(sp);
    const follow = (side) => (dt, t, h) => {
      const s = angToS(sp.ang), half = h.state === 'live' ? 1.5 : 0.25;
      h.s0 = T().wrap(s - half); h.s1 = T().wrap(s + half);
      if (side === 0) { h.d0 = -99; h.d1 = sp.g0; } else { h.d0 = sp.g1; h.d1 = 99; }
    };
    for (let side = 0; side < 2; side++) {
      if (side === 0 && sp.g0 <= -HW + 0.2) continue;
      if (side === 1 && sp.g1 >= HW - 0.2) continue;
      const s = angToS(ang);
      sp.left++;
      sp.hs[side] = tele({ shape: 'band', kind: 'damage', s0: s - 0.25, s1: s + 0.25, d0: side ? sp.g1 : -99, d1: side ? 99 : sp.g0, windup: 0.9, active: 6, tick: 0.6, dmg: 25, tall: true, src: 'spoke',
        follow: follow(side), onEnd: () => { if (--sp.left <= 0) sp.on = false; } });
    }
    if (!sp.left) sp.on = false;
  }
  function gapOf(sp) {
    const c = sp.slide ? clamp(sp.gc + Math.sin(G.time.now * 0.8 + sp.ph) * 6 * sp.slide, -6, 6) : sp.gc;
    sp.g0 = c - 3.25; sp.g1 = c + 3.25;
  }
  function updateSpokes(dt) {
    for (const sp of spokes) {
      if (!sp.on) continue;
      if (!frozen) sp.ang += sp.dir * sp.w * dt;
      gapOf(sp);
    }
  }

  // ---- meteors ----
  function spawnMeteor(s, d) {
    const Tr = T(), mt = meteors.find(x => !x.on);
    const h = tele({ shape: 'circle', kind: 'damage', r: 4, s, d, windup: 1.1, dmg: 20, src: 'starfall',
      onResolve: (hit) => {
        Tr.toWorld(Tr.wrap(s), d, 0.4, V.a);
        G.fx?.burst?.('starDust', V.a, { count: 18, scale: 1.2 });
        G.fx?.shockwave?.(V.a, { color: 0x8fd7ff, radius: 6, dur: 0.3, alpha: 0.6 }); sfx('explosion', { pan: G.audio?.panFor?.(V.a) || 0, vol: 0.5 });
        if (K().worldPos.distanceTo(V.a) < 25) G.cam.shake(0.22);
      },
      onEnd: () => { if (mt && mt.h === h) mt.on = false; } });
    if (mt) {
      mt.on = true; mt.h = h; Tr.toWorld(h.s, d, 0, mt.to);
      const a = G.rng() * TAU; mt.from.set(Math.cos(a) * 26, 130, Math.sin(a) * 26).add(mt.to);
    }
  }

  // ---- ghosts: race head-on along the line you drove ≥ lag seconds ago ----
  // d of the most recent recorded sample at track position sq that is at least `lag` s old
  function lineD(sq, lag) {
    const rec = G.ghosts?.record; if (!rec || !rec.count) return null;
    const N = rec.s.length, tMax = G.time.now - lag, Tr = T();
    let newer = -1;
    for (let k = 0; k < rec.count && k < 240; k++) {
      const i = (rec.head - 1 - k + N * 2) % N;
      if (rec.t[i] > tMax) continue;
      if (newer >= 0) {
        const a = Tr.ds(rec.s[i], sq), c = Tr.ds(rec.s[newer], sq);     // older sample behind sq, newer ahead
        if (a >= 0 && c <= 0 && a - c < 12) { const f = a - c > 1e-4 ? a / (a - c) : 0; return rec.d[i] + (rec.d[newer] - rec.d[i]) * f; }
      }
      newer = i;
    }
    return null;
  }
  function spawnGhost(b, i, delay = 0) {
    const g = ghosts[i]; g.want = true;
    if (delay > 0) { g.respawnT = delay; return; }
    if (g.ob && g.ob.alive) G.obstacles.remove(g.ob);
    const k = K(), s = T().wrap(k.s + L * (i ? 0.25 : 0.5));
    g.on = true; g.alpha = 0; g.respawnT = -1; g.d = lineD(s, g.lag) ?? 0; g.prevDs = T().ds(k.s, s); g.lastHitT = -9;
    g.ob = G.obstacles.add({ s, d: g.d, h: 0, r: 1.6, vs: -GHOST_V, dmg: 18, spin: true, dashable: false, src: 'ghost', mesh: null,
      update: (dt, ob) => ghostTick(b, g, dt, ob),
      onHit: (ob, r) => { g.lastHitT = G.time.now; if (r === 'hit') { b.mem.ghostClean = false; callout('GHOSTED!', 'danger'); } } });
    if (!g.ribbon) g.ribbon = G.fx?.ribbon?.({ color: 0xff2a3a, width: 0.9, glow: 2.2, alpha: 0.8 }) || null;
    g.ribbon?.clear?.();
    T().toWorld(s, g.d, 1, V.a); G.fx?.burst?.('ghostShatter', V.a, { count: 30, scale: 0.8 });
  }
  function ghostTick(b, g, dt, ob) {
    const k = K(), Tr = T();
    ob.vs = frozen ? 0 : -GHOST_V;
    ob.dmg = b.staggered || g.alpha < 0.6 ? -1 : 18;           // intangible while fading in / during BREAK
    const want = lineD(ob.s, g.lag);
    if (want != null && !frozen) { const hd = Tr.halfDrive(ob.s) - 0.4; ob.d += (clamp(want, -hd, hd) - ob.d) * Math.min(1, dt * 6); }
    g.alpha = Math.min(1, g.alpha + dt * 1.2);
    // near miss: the ghost passed the kart within 3.6 m and did not hit → small graze
    const dsv = Tr.ds(k.s, ob.s);
    if (g.prevDs > 0 && dsv <= 0 && Math.abs(g.prevDs) < 20) {
      if (Math.abs(k.d - ob.d) < 3.6 && G.time.now - g.lastHitT > 0.7 && !k.cometActive && ob.dmg >= 0) {
        k.addFlux(5, 'ghostGraze'); G.emit('kart:graze', { amount: 5, mega: false, src: 'ghost' });
      }
    }
    g.prevDs = dsv;
  }
  function shatterGhost(b, g, why) {
    if (!g.on) return;
    if (g.ob) { Tr3(g.ob.s, g.ob.d, 1, V.a); G.fx?.shards?.(V.a, 90, 0xff2a3a, { speed: 1.2, size: 0.6, life: 2 }); G.fx?.burst?.('ghostShatter', V.a, { count: 80, scale: 1.4 }); G.obstacles.remove(g.ob); }
    g.on = false; g.ob = null; g.ribbon?.clear?.();
    if (why === 'clean') { b.addStagger(0.2); K().addFlux(15, 'ghostShatter'); callout('GHOST SHATTERED!', 'break'); sfx('break'); }
    if (g.want) g.respawnT = 12;
  }
  const Tr3 = (s, d, h, out) => T().toWorld(s, d, h, out);
  function clearGhosts() { for (const g of ghosts) { g.want = false; g.respawnT = -1; if (g.ob && g.ob.alive) G.obstacles.remove(g.ob); g.ob = null; g.on = false; g.ribbon?.clear?.(); } }
  function updateGhosts(b, dt) {
    for (let i = 0; i < 2; i++) {
      const g = ghosts[i];
      if (g.on && (!g.ob || !g.ob.alive)) { g.on = false; g.ob = null; if (g.want && g.respawnT < 0) g.respawnT = 4; }
      if (!g.on && g.want && g.respawnT >= 0 && b.state === 'fight') { g.respawnT -= dt; if (g.respawnT <= 0) spawnGhost(b, i); }
    }
  }
  function livingGhosts() { let n = 0; for (const g of ghosts) if (g.on) n++; return n; }

  // ---- CHECKERED countdown + pit boxes ----
  function spawnPitBoxes(b) {
    const m = b.mem, k = K(), lane = G.rng() < 0.5 ? -1 : 1;
    // never less than 6 s to reach a box (a BREAK can fizzle the boxes late in the countdown)
    if (m.clock < 6.05) { m.clock = 6.05; m.clockTick = 7; }
    m.pit = [];
    for (let j = 0; j < 2; j++) {
      const box = { s: T().wrap(k.s + (j ? 100 : 55)), d: T().laneD(j ? -lane : lane, k.s), h: null, far: !!j };
      box.h = tele({ shape: 'circle', kind: 'soak', r: 7, s: box.s, d: box.d, windup: Math.max(0.9, m.clock + 0.6), exact: true, dmg: 0, src: 'pitbox', sound: 'choir',
        follow: (dt, t, h) => {
          if (frozen) return;
          const kk = K(), inside = Math.hypot(T().ds(h.s, kk.s), kk.d - h.d) < 7.5;
          const v = inside ? clamp(kk.sdot, 0, 60) * 0.92 : 6;
          box.s = h.s = T().wrap(h.s + v * dt);
        } });
      m.pit.push(box);
      // the far box gets a boost pad in its lane so it is a real (and flashy) choice
      if (j) addTempPad(k.s + 34, j ? -lane : lane, 8, G.time.now + m.clock + 0.5);
    }
    callout('GET IN A PIT BOX!', 'lap'); sfx('choir');
  }
  function inPitBox(b) {
    const k = K();
    for (const box of (b.mem.pit || [])) if (box.h && box.h.state !== 'done' && box.h.state !== 'fade' && Math.hypot(T().ds(box.h.s, k.s), k.d - box.h.d) < 7) return true;
    return false;
  }
  function resolveCheckered(b) {
    const m = b.mem, k = K();
    const inside = inPitBox(b);
    for (const box of (m.pit || [])) box.h?.cancel?.();
    m.pit = null;
    G.post?.flash?.('#ffffff', 0.4, 2.2); G.post?.bloomPulse?.(0.5, 1.5); G.cam.shake(0.55);
    sysm.chk.visible = true; m.chkT = 0;
    sfx('thunder'); sfx('explosion', { big: true }); callout('CHECKERED!', 'enrage');
    armPose('flag', 1, 1.6); rig.flagWave = 3;
    let safe = inside;
    const wasWrecked = !!k.wrecked;
    if (!safe) {
      const r = G.combat.hitPlayer(120, { src: 'checkered', unblockable: true });
      // a wrecked kart also reports 'invuln', but it should not get the survival reward
      safe = !wasWrecked && (r === 'perfect' || r === 'blocked' || r === 'invuln' || r === 'god');
    }
    if (safe) { k.addFlux(20, 'clock'); callout('SURVIVED THE CLOCK!', 'perfect'); }
    m.clock = CLOCK_DUR; m.clockTick = Math.ceil(CLOCK_DUR);
    if (b.phase !== 2) m.clockOn = false;
    G.cam.lookAtBoss?.(0.5, 2.2);
    m.clockForced = false;
    // Velox overwinds -> scripted 5 s BREAK (the guaranteed Comet stage of P3)
    b.after(1.0, () => { if (b.state === 'fight' && !b.staggered) { callout('VELOX OVERWINDS!', 'break'); b.startStagger(5, true); } });
  }
  function updateClock(b, dt) {
    const m = b.mem;
    if (!m.clockOn || b.state !== 'fight' || b.enrage >= 2) return;
    if (!b.staggered && !frozen && b.invulnT <= 0) m.clock -= dt;
    // pit boxes 6 s before zero (respawn them if a BREAK fizzled them)
    if (m.clock <= 6 && !b.staggered) {
      const alive = m.pit && m.pit.some(x => x.h && (x.h.state === 'fill' || x.h.state === 'flash'));
      if (!alive) spawnPitBoxes(b);
    }
    const sec = Math.ceil(m.clock);
    if (sec !== m.clockTick && sec >= 0) { m.clockTick = sec; sfx(sec % 2 ? 'tick' : 'tock', { vol: sec <= 6 ? 1 : 0.5 }); if (sec <= 3 && sec > 0) callout(String(sec), 'danger'); }
    if (m.clock <= 0) resolveCheckered(b);
  }

  // =================================================================
  // ATTACKS (names per §9.7)
  // =================================================================
  const attacks = {
    // ---- Clock Spokes: radial lasers rotating around the hole ----
    spokes(b, p = {}) {
      const m = b.mem, k = K();
      let n = p.n ?? (b.phase >= 2 ? 2 : Math.min(4, 2 + b.loopN));
      if (m.hourHand) { n = Math.min(6, n * 2); m.hourHand = false; callout('DOUBLE SPOKES!', 'danger'); }
      const w = (p.w ?? (b.phase >= 2 ? 0.6 : 0.3)) * (b.enrage >= 1 ? 2 : 1);
      const ka = k.s / R, base = p.ahead != null ? (k.s + p.ahead) / R : ka + 1.0 + G.rng() * 0.8, sgn = p.dir ?? (G.rng() < 0.5 ? 1 : -1);
      for (let i = 0; i < n; i++) {
        let a = base + i * TAU / n;
        if (p.ahead == null && Math.abs(T().ds(k.s, angToS(a))) < 45) a += 60 / R;
        const lane = ((G.rng() * 3) | 0) - 1;
        spawnSpoke(b, a, (i % 2 ? -1 : 1) * sgn, w, lane, b.phase >= 2 ? 1 : 0);
      }
      armPose('scep', 1, 1.4); sfx('laser'); sfx('roar', { pitch: 1.4, vol: 0.35 });
      rig.pulse = 1;
    },

    // ---- Starfall: 8 meteors in 4 rows ahead, one free lane per row ----
    starfall(b) {
      const k = K(), c = k.predict(1.1).s;
      let free = ((G.rng() * 3) | 0) - 1;
      for (let j = 0; j < 4; j++) {
        if (j) free = clamp(free + (((G.rng() * 3) | 0) - 1), -1, 1);
        const s = c + (j - 1) * 16;
        for (const lane of [-1, 0, 1]) if (lane !== free) spawnMeteor(T().wrap(s + G.rng() * 4 - 2), T().laneD(lane, s) + (G.rng() - 0.5));
      }
      armPose('scep', 1, 1.0); sfx('thunder', { vol: 0.5 });
    },

    // ---- Tick-Tock: 0.8 s freeze of all boss telegraphs/obstacles/animation ----
    ticktock(b) {
      const m = b.mem; m.freezeT = 0.8; frozen = true;
      sfx('tick'); b.after(0.8, () => sfx('tock'));
      callout('TIME STOP', 'perfect');
      G.post?.flash?.('#bfe3ff', 0.4, 2.5); m.monoPulse = 0.75;
      rig.watch.getWorldPosition(V.a);
      G.fx?.shockwave?.(V.a, { color: 0xbfe3ff, radius: 60, dur: 0.6, thick: 0.05, normal: V.b.copy(G.camera.position).sub(V.a).normalize() });
      rig.pulse = 1.5; G.post?.shockAt?.(V.a, 0.8);
    },

    // ---- HOUR HAND: interruptible; completes → next Spokes doubled; interrupt → 5 s BREAK ----
    hourhand(b) {
      rig.watchRate = 8; armPose('watch', 1, 2.4);
      b.startCast('HOUR HAND', 2.2, { interruptible: true,
        onComplete: () => { rig.watchRate = 1; b.mem.hourHand = true; callout('THE HOUR HAND TURNS', 'danger'); sfx('roar', { pitch: 0.8 }); },
        onInterrupt: () => { rig.watchRate = -3; callout('CLOCK JAMMED!', 'interrupt'); b.startStagger(5, true); } });
    },

    // ---- Ghost Lances: every ghost fires 2 red bolts onto your predicted path ----
    ghostlance(b) {
      const k = K(), srcs = [];
      for (const g of ghosts) if (g.on && g.ob) srcs.push(g);
      const n = Math.max(1, srcs.length);
      for (let i = 0; i < n; i++) {
        const g = srcs[i];
        if (g) Tr3(g.ob.s, g.ob.d, 1.2, V.b); else gemPos(V.b);
        for (let j = 0; j < 2; j++) {
          const p = k.predict(1.0 + j * 0.3 + i * 0.15), d = clamp(p.d + (j ? (G.rng() - 0.5) * 7 : 0), -8, 8), s = p.s;
          tele({ shape: 'circle', kind: 'damage', r: 3, s, d, windup: 1.0, dmg: 18, src: 'ghostlance' });
          const tgt = lanceTargets[lanceIdx = (lanceIdx + 1) % lanceTargets.length]; Tr3(s, d, 0.3, tgt);
          G.fx?.bolt?.(V.b, () => tgt, { color: '#ff2a3a', tier: 1, width: 0.7, speed: 55, arc: 1.5, delay: j * 0.08 });
        }
      }
      sfx('laser', { pitch: 0.7 });
    },

    // ---- Mirror Decree: the lane lines flip; one half of the road is forbidden for 5 s ----
    decree(b) {
      const k = K(), inner = G.rng() < 0.5;
      const follow = (dt, t, h) => { if (frozen) return; const ks = K().s; h.s0 = T().wrap(ks - 30); h.s1 = T().wrap(ks + 220); };
      tele({ shape: 'band', kind: 'damage', s0: k.s - 30, s1: k.s + 220, d0: inner ? -99 : 0, d1: inner ? 0 : 99, windup: 1.2, active: 5, tick: 0.5, dmg: 20, src: 'decree', follow });
      b.mem.decreeT = 6.4; rig.mirrorFlash = 1; armPose('mirror', 1, 2);
      callout(inner ? 'DECREE: OUTER LINE ONLY' : 'DECREE: INNER LINE ONLY', 'danger'); sfx('roar', { pitch: 1.2, vol: 0.5 });
    },

    // ---- Gravity Pull: inward drag over the whole lap (drift outward against it) ----
    gravity(b) {
      tele({ shape: 'band', kind: 'knock', s0: 0, s1: L - 0.05, d0: -99, d1: -5, windup: 1.5, dmg: 0, noGraze: true, src: 'gravity',
        onResolve: () => {
          if (b.state !== 'fight') return;
          G.zones.add({ type: 'pull', s0: 0, s1: L - 0.05, pull: -6, dur: 3, alpha: 0.22, src: 'gravity' });
          b.mem.gravT = 3; callout('GRAVITY WELL!', 'danger'); G.cam.shake(0.25);
        } });
      armPose('scep', 1, 1.6); armPose('flag', 1, 1.6); sfx('teleDrone');
    },

    // ---- Event Pulse (SOAK): be inside a cyan circle or take 35 ----
    pulse(b) {
      const k = K(), res = { n: 0, inside: false, cancelled: false };
      const finish = () => {
        if (res.cancelled) return;
        G.fx?.shockwave?.(V.a.set(0, 1, 0), { color: 0x8fd7ff, radius: 150, dur: 0.9, thick: 0.03 });
        G.fx?.flash?.(0x8fd7ff, 0.35, 0.4); sfx('explosion', { big: true }); rig.pulse = 2;
        if (res.inside) { K().addFlux(5, 'soak'); callout('+SOAKED', 'perfect'); } else G.combat.hitPlayer(35, { src: 'pulse' });
      };
      const p1 = k.predict(2.6), s1 = p1.s, p2s = k.predict(3.4).s;
      const lane = G.rng() < 0.5 ? -1 : 1;
      const hs = [{ s: s1, d: T().laneD(lane, s1) }, { s: p2s, d: T().laneD(-lane, p2s) }].map(sp => tele({ shape: 'circle', kind: 'soak', r: 6, s: sp.s, d: sp.d, windup: 3, dmg: 0, src: 'pulse', sound: 'choir',
        onResolve: (inside) => { res.n++; if (inside) res.inside = true; if (res.n === 2) finish(); } }));
      b.startCast('EVENT PULSE', 3.1, { interruptible: false, onInterrupt: () => { res.cancelled = true; hs.forEach(h => h.cancel()); } });
    },

    // ---- CHECKERED: start (or fast-forward) the countdown; outside P3 a one-shot 6 s check ----
    checkered(b, p = {}) {
      const m = b.mem;
      if (!m.clockOn) { m.clockOn = true; m.clockForced = b.phase !== 2; m.clock = p.t ?? 6.05; }
      else m.clock = Math.min(m.clock, p.t ?? 6.05);
      m.clockTick = Math.ceil(m.clock);
    },

    // ---- Shattering Ring: a 30 m section 120-200 m ahead cracks, then becomes a gap with a ramp + pad ----
    shatter(b) {
      const m = b.mem, k = K(), Tr = T(), now = G.time.now;
      m.gaps = (m.gaps || []).filter(g => g.until > now);
      if (m.gaps.length >= 2) return;
      let s0 = k.s + 120 + G.rng() * 80;
      for (const site of SITES) { const x = Tr.ds(k.s, site); if (x >= 120 && x <= 200) { s0 = site; break; } }
      for (const g of m.gaps) if (Math.abs(Tr.ds(g.s0, s0)) < 70) s0 += 75;
      s0 = Tr.wrap(s0);
      tele({ shape: 'band', kind: 'damage', visKind: 'crack', s0, s1: s0 + 30, windup: 1.5, dmg: 0, noGraze: true, src: 'shatter',
        onResolve: () => { if (b.state === 'fight') openGap(b, s0); } });
      callout('THE RING SHATTERS!', 'danger'); sfx('stomp', { vol: 0.6 });
    },
  };
  function openGap(b, s0) {
    const m = b.mem, Tr = T(), until = G.time.now + 12;
    const id = Tr.setGap({ s0, s1: s0 + 30, until });
    const ramp = Tr.addRamp({ s: s0 - 12, len: 10, kick: 9, until });
    addTempPad(s0 - 26, 0, 8, until);
    m.gaps.push({ s0, until, id, ramp });
    for (let i = 0; i < 6; i++) { Tr.toWorld(Tr.wrap(s0 + 3 + i * 5), (Math.random() - 0.5) * 14, 0, V.a); G.fx?.shards?.(V.a, 16, 0x8fd7ff, { speed: 0.8, size: 0.9, life: 2.5, gravity: 1 }); G.fx?.burst?.('chrome', V.a, { count: 16 }); }
    Tr.toWorld(Tr.wrap(s0 + 15), 0, 0, V.a); G.fx?.shockwave?.(V.a, { color: 0xff2a3a, radius: 22, dur: 0.5 });
    sfx('explosion', { big: true }); if (K().worldPos.distanceTo(V.a) < 70) G.cam.shake(0.35);
  }

  // =================================================================
  // ANIMATION (sim time; skipped while frozen)
  // =================================================================
  function animate(b, dt) {
    if (!rig) return;
    const k = K(), t = G.time.now;
    rig.animT += dt;
    const gold = b.staggered ? 1 : 0;
    // face the kart (yaw only, ~0.8 s lag)
    if (!rig.dead) {
      const want = Math.atan2(k.worldPos.x, k.worldPos.z);
      let dy = want - rig.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      rig.yaw += dy * (1 - Math.exp(-dt / 0.8));
      rig.root.rotation.y = rig.yaw;
    }
    // stand (P3): the figure rises, the robe stretches to the floor, the halo climbs
    rig.stand += (rig.standT - rig.stand) * Math.min(1, dt * 1.2);
    const st = sm(rig.stand);
    rig.slump += (gold - rig.slump) * Math.min(1, dt * 4);
    rig.fig.position.y = 4 + st * 8 + Math.sin(t * 1.3) * 0.25;
    rig.robeG.scale.y = rig.fig.position.y / 4;
    rig.fig.rotation.x = rig.slump * 0.25;
    rig.haloG.position.y = 21 + st * 8; rig.haloG.rotation.z -= dt * (0.15 + (b.cast ? 1.2 : 0)) * rig.watchRate;
    // arms
    for (const n in rig.arms) {
      const a = rig.arms[n];
      if (a.holdT > 0) { a.holdT -= dt; if (a.holdT <= 0) a.wT = 0; }
      a.w += (a.wT - a.w) * Math.min(1, dt * 5);
      a.sh.quaternion.slerpQuaternions(a.restQ, a.raiseQ, sm(a.w));
      if (n === 'flag' && a.w > 0.3) a.sh.rotateZ(Math.sin(t * 9) * 0.25 * a.w);
    }
    rig.flagWave += (1 - rig.flagWave) * Math.min(1, dt * 0.8);
    rig.clothMat.uniforms.uWave.value = rig.flagWave; rig.clothMat.uniforms.uTime.value = t;
    // stopwatch
    rig.watchRate += (1 - rig.watchRate) * Math.min(1, dt * (b.cast ? 0 : 0.8));
    rig.watchSpin += dt * rig.watchRate * (TAU / 6);
    rig.pulse = Math.max(0, rig.pulse - dt * 2);
    const fu = rig.faceMat.uniforms; fu.uTime.value = t; fu.uHand.value = rig.watchSpin; fu.uPulse.value = rig.pulse;
    fu.uGold.value += (gold - fu.uGold.value) * Math.min(1, dt * 6); fu.uHit.value = b.hitFlash || 0;
    rig.watch.scale.setScalar(1 + rig.pulse * 0.05 + gold * 0.08 * Math.sin(t * 8));
    rig.mirrorFlash = Math.max(0, rig.mirrorFlash - dt * 0.5);
    rig.mirMat.uniforms.uTime.value = t; rig.mirMat.uniforms.uFlash.value = rig.mirrorFlash * (0.6 + 0.4 * Math.sin(t * 20));
    // glass
    for (const gm of [rig.glass, rig.thrGlass]) { gm.uniforms.uTime.value = t; gm.uniforms.uHit.value = b.hitFlash || 0; gm.uniforms.uGold.value += (gold * 0.6 - gm.uniforms.uGold.value) * Math.min(1, dt * 5); }
    rig.eyes.material.color.setRGB(1.6, 2.6, 3.4).multiplyScalar(rig.dead ? 0 : b.staggered ? 0.3 + 0.25 * Math.sin(t * 22) : 1 + (b.hitFlash || 0) * 0.6);
    // crown hands orbit the head
    const spin = b.staggered ? 0.12 : rig.crownSpin * (b.phase >= 2 ? 1.6 : 1);
    rig.crownA += dt * spin;
    const cy = 17.2 - rig.slump * 2.2;
    for (let i = 0; i < 8; i++) {
      const alive = rig.handAlive[i] > 0, a = rig.crownA + i * TAU / 8, ring = i < 4 ? 6 : 7.4, y = cy + (i < 4 ? 0 : 1.2) + Math.sin(a * 2 + t) * 0.35;
      const n = rig.handNodes[i]; n.position.set(Math.cos(a) * ring, y, Math.sin(a) * ring);
      V.q.setFromAxisAngle(UPV, -a); V.q2.setFromAxisAngle(V.x.set(1, 0, 0), t * 3 + i); V.q.multiply(V.q2);
      V.s.setScalar(alive ? 1 + rig.handFlash[i] * 0.25 : 0);
      rig.crown.setMatrixAt(i, V.m.compose(n.position, V.q, V.s));
      rig.handFlash[i] = Math.max(0, rig.handFlash[i] - dt * 5);
      const f = rig.handFlash[i];
      rig.col.setRGB(3 + f * 3, 2.1 + f * 3, 0.6 + f * 3); if (b.mem.freezeT > 0) rig.col.setRGB(2.2, 2.8, 3.6);
      rig.crown.setColorAt(i, rig.col);
    }
    V.s.set(1, 1, 1);
    rig.crown.instanceMatrix.needsUpdate = true; if (rig.crown.instanceColor) rig.crown.instanceColor.needsUpdate = true;
    // scenery: disk spin (gravity spins it up), debris drift
    const sc = rig.sc, du = sc.disk.material.uniforms;
    const spinK = 1 + (b.mem.gravT > 0 ? 2.5 : 0) + (b.mem.sing > 0 ? 4 * b.mem.sing : 0);
    du.uSpin.value += (spinK - du.uSpin.value) * Math.min(1, dt * 2);
    du.uSpinT.value += dt * du.uSpin.value * 0.35; sc.disk2.material.uniforms.uSpinT.value += dt * 0.08;
    sc.debris.rotation.y += dt * 0.02;
  }

  // gravity swirl particles + spoke sparks + meteor trails
  function ambientFx(b, dt) {
    const m = b.mem, Tr = T(), k = K();
    if (m.gravT > 0) {
      m.gravT -= dt;
      for (let i = 0; i < 3; i++) {
        const s = Tr.wrap(k.s + 10 + Math.random() * 90); Tr.toWorld(s, (Math.random() - 0.3) * 18, 0.4 + Math.random(), V.a);
        V.b.copy(V.a).setY(0).negate().normalize(); G.fx?.emit?.('starDust', V.a, V.b, 1, { speed: 8, scale: 1.4, key: 'b3grav' });
      }
    }
    for (let i = 0; i < spokes.length; i++) {
      const sp = spokes[i]; if (!sp.on) continue;
      const live = (sp.hs[0] && sp.hs[0].state === 'live') || (sp.hs[1] && sp.hs[1].state === 'live');
      if (!live) continue;
      const s = angToS(sp.ang);
      if (Math.abs(Tr.ds(k.s, s)) > 120) continue;
      if (sp.g0 > -HW) { Tr.toWorld(s, sp.g0, 0.3, V.a); G.fx?.emit?.('wallSpark', V.a, UPV, dt * 30, { color: 0xff6070, key: 'spk' + i }); }
      if (sp.g1 < HW) { Tr.toWorld(s, sp.g1, 0.3, V.a); G.fx?.emit?.('wallSpark', V.a, UPV, dt * 30, { color: 0xff6070, key: 'spk2' + i }); }
    }
  }

  // ---- Tick-Tock freeze: undo the sim advance of boss telegraphs/timers/casts this tick ----
  function applyFreeze(b, dt) {
    const m = b.mem;
    if (!(m.freezeT > 0)) { frozen = false; return; }
    m.freezeT -= dt; frozen = m.freezeT > 0;
    for (const h of G.tele.list()) { if (h.state === 'fill' || h.state === 'flash') h.t -= dt; else if (h.state === 'live') h.liveT -= dt; }
    for (const tm of b.timers) tm.at += dt;
    if (b.cast) b.cast.t -= dt;
    b.rotT = Math.max(0, b.rotT - dt);
  }

  // =================================================================
  // RENDER (real time): instanced beams/meteors/ghosts, lens, sky clock, finale overrides
  // =================================================================
  function render(b, rdt) {
    if (!rig) return;
    const Tr = T(), cam = G.camera, sc = rig.sc, m = b.mem, now = G.time.now;
    // photon-ring halo + star face the camera
    sc.halo.quaternion.copy(cam.quaternion); sc.star.quaternion.copy(cam.quaternion);
    // gravitational lens (screen space)
    V.a.copy(HOLE).project(cam);
    const dist = cam.position.distanceTo(HOLE), lensOK = G.quality?.settings?.lens !== false && !rig.dead;
    if (lensOK && V.a.z < 1 && Math.abs(V.a.x) < 1.6 && Math.abs(V.a.y) < 1.6) {
      const k = clamp(HOLE_R * 1.6 / dist, 0, 1.2) * (1 + (m.gravT > 0 ? 0.8 : 0) + (m.sing || 0) * 2);
      G.post?.setLens?.(V.a.x * 0.5 + 0.5, V.a.y * 0.5 + 0.5, 0.014 * k);
    } else G.post?.setLens?.(0.5, 0.5, 0);
    // spoke beams
    let n = 0;
    const beams = sysm.beams, bc = beams.instanceColor.array;
    for (const sp of spokes) {
      if (!sp.on) continue;
      const h = sp.hs[0] || sp.hs[1]; if (!h) continue;
      const live = h.state === 'live', a = sp.ang;
      const k = live ? 1.25 : h.state === 'fade' ? h.alpha : 0.3 + 0.45 * h.fill;
      // tall vertical sheet + flat ground sheet so it reads as a wall across the road from the chase cam
      const tallH = live ? 6.5 : 1.0 + h.fill * 2.2, flatW = live ? 3.4 : 0.6 + h.fill * 0.6, cy = live ? 2.4 : 0.9;
      V.q.setFromAxisAngle(UPV, a - Math.PI / 2);
      const segs = [[HOLE_R + 1, R + sp.g0], [R + sp.g1, R + HW + 7]];
      for (let j = 0; j < 2 && n < 16; j++) {
        const r0 = segs[j][0], r1 = segs[j][1]; if (r1 - r0 < 0.5) continue;
        V.a.set(Math.sin(a) * r0, cy, Math.cos(a) * r0); V.s.set(r1 - r0, tallH, flatW);
        beams.setMatrixAt(n, V.m.compose(V.a, V.q, V.s)); bc[n * 3] = k * (0.85 + 0.15 * Math.sin(G.time.real * 30 + j)); n++;
      }
    }
    beams.count = n; beams.visible = n > 0; V.s.set(1, 1, 1);
    if (n) { beams.instanceMatrix.needsUpdate = true; beams.instanceColor.needsUpdate = true; }
    // safe-notch posts (cyan) at g0 / g1 of each spoke near the kart
    n = 0;
    const posts = sysm.posts, poc = posts.instanceColor.array, ks = K().s;
    for (const sp of spokes) {
      if (!sp.on) continue;
      const h = sp.hs[0] || sp.hs[1]; if (!h || h.state === 'done') continue;
      const ss = angToS(sp.ang), ah = Tr.ds(ks, ss); if (ah < -10 || ah > 160) continue;
      const live = h.state === 'live', kk = (live ? 1 : h.state === 'fade' ? h.alpha : 0.35 + 0.5 * h.fill) * (0.85 + 0.15 * Math.sin(G.time.real * 9));
      for (const gd of [sp.g0, sp.g1]) {
        if (gd <= -HW + 0.2 || gd >= HW - 0.2 || n >= 32) continue;
        Tr.toWorld(ss, gd, 0, V.a); V.s.set(0.9, live ? 7 : 4.5, 0.9); V.q.identity();
        posts.setMatrixAt(n, V.m.compose(V.a, V.q, V.s)); poc[n * 3] = kk; n++;
      }
    }
    posts.count = n; posts.visible = n > 0; V.s.set(1, 1, 1);
    if (n) { posts.instanceMatrix.needsUpdate = true; posts.instanceColor.needsUpdate = true; }
    // meteors
    n = 0;
    const mets = sysm.mets, mc = mets.instanceColor.array;
    for (const mt of meteors) {
      if (!mt.on || !mt.h) continue;
      const h = mt.h; if (h.state !== 'fill' && h.state !== 'flash') continue;
      const u = clamp((h.fill - 0.2) / 0.8, 0, 1); if (u <= 0) continue;
      const e = u * u;
      V.a.lerpVectors(mt.from, mt.to, e); V.b.copy(mt.from).sub(mt.to).normalize();
      V.q.setFromUnitVectors(UPV, V.b); V.s.set(1.6, 26, 1.6);
      mets.setMatrixAt(n, V.m.compose(V.a, V.q, V.s)); mc[n * 3] = 1; n++;
    }
    mets.count = n; mets.visible = n > 0; V.s.set(1, 1, 1);
    if (n) { mets.instanceMatrix.needsUpdate = true; mets.instanceColor.needsUpdate = true; }
    // ghosts (head-on: face -T)
    n = 0;
    const gm = sysm.ghosts, gc = gm.instanceColor.array;
    for (const g of ghosts) {
      if (!g.on || !g.ob) continue;
      const f = Tr.frame(g.ob.s, F);
      V.a.copy(f.p).addScaledVector(f.r, g.ob.d).addScaledVector(f.n, 0.15 + Math.sin(now * 9 + g.lag) * 0.05);
      V.z.copy(f.t); V.m.makeBasis(V.x.copy(f.r).negate(), f.n, V.z); V.q.setFromRotationMatrix(V.m);
      V.s.setScalar(1.5); gm.setMatrixAt(n, V.m.compose(V.a, V.q, V.s)); V.s.set(1, 1, 1);
      gc[n * 3] = g.alpha * (b.staggered ? 0.3 : 1) * (0.85 + 0.15 * Math.sin(G.time.real * 13 + g.lag)); n++;
      if (g.ribbon) { g.ribT -= rdt; if (g.ribT <= 0) { g.ribT = 0.035; V.b.copy(V.a).addScaledVector(f.n, 0.5); g.ribbon.push(V.b); } }
    }
    gm.count = n; gm.visible = n > 0;
    if (n) { gm.instanceMatrix.needsUpdate = true; gm.instanceColor.needsUpdate = true; }
    ghostWarnings(b);
    // pit box columns
    const pit = sysm.pit, pc = pit.instanceColor.array;
    n = 0;
    if (m.pit) for (const box of m.pit) {
      if (!box.h || box.h.state === 'done') continue;
      Tr.toWorld(box.h.s, box.h.d, 0, V.a); V.s.set(7, 9, 7); V.q.identity();
      // fade the column as the camera closes in (inside it the additive wall whites out the view)
      const cd = Math.hypot(cam.position.x - V.a.x, cam.position.z - V.a.z), near = 0.12 + 0.88 * sm((cd - 6) / 14);
      pit.setMatrixAt(n, V.m.compose(V.a, V.q, V.s)); pc[n * 3] = (box.h.alpha || 0) * (0.7 + 0.3 * Math.sin(G.time.real * 8)) * near; n++;
    }
    pit.count = n; pit.visible = n > 0; V.s.set(1, 1, 1);
    if (n) { pit.instanceMatrix.needsUpdate = true; pit.instanceColor.needsUpdate = true; }
    // checkered shockwave wall
    if (sysm.chk.visible) {
      m.chkT = (m.chkT || 0) + rdt; const u = m.chkT / 1.4;
      if (u >= 1) sysm.chk.visible = false;
      else { const r = lerp(16, 130, u); sysm.chk.scale.set(r, 7 * (1 - u * 0.5), r); sysm.chk.position.y = -0.5; sysm.chk.material.uniforms.uA.value = 1 - u; }
    }
    // sky clock (camera-relative, upper left of the view)
    const ck = sc.clock, showClock = !!m.clockOn && b.state === 'fight';
    const cu = ck.material.uniforms;
    cu.uA.value += ((showClock ? 1 : 0) - cu.uA.value) * Math.min(1, rdt * 3);
    ck.visible = cu.uA.value > 0.01;
    if (ck.visible) {
      cam.getWorldDirection(V.a); V.b.crossVectors(V.a, UPV).normalize();
      V.c.copy(cam.position).addScaledVector(V.a, 420).addScaledVector(V.b, -170).addScaledVector(UPV, 150);
      ck.position.copy(V.c); ck.quaternion.copy(cam.quaternion); ck.scale.setScalar(150);
      cu.uProg.value = clamp((m.clock || 0) / CLOCK_DUR, 0, 1); cu.uWarn.value = (m.clock || 99) <= 6 ? 1 : 0; cu.uTime.value = G.time.real;
    }
    domClock(showClock && !rig.dead, m.clock || 0, (m.clock || 99) <= 6, !!(b.staggered || b.invulnT > 0));
    // shared shader clocks
    for (const mm of [sc.halo.material, sc.disk.material, sc.disk2.material, sc.star.material, sysm.beams.material, sysm.mets.material, sysm.ghosts.material, sysm.pit.material, sysm.bridge.material, sysm.gbeac.material, sysm.gchev.material, sysm.posts.material]) mm.uniforms.uTime.value = G.time.real;
    // finale: kart rides the light bridge
    if (m.bridgeU >= 0 && m.bridgeU <= 1 && K().mesh) {
      bridgePoint(m.bridgeU, V.a); bridgePoint(Math.min(1, m.bridgeU + 0.02), V.b);
      const km = K().mesh; km.position.copy(V.a); V.z.copy(V.a).sub(V.b).normalize();
      V.x.crossVectors(UPV, V.z).normalize(); V.y.crossVectors(V.z, V.x); V.m.makeBasis(V.x, V.y, V.z); km.quaternion.setFromRotationMatrix(V.m);
    }
  }

  // ghost warnings (§13.1): beacon above each ghost, chevrons on the road ~1.5 s ahead of it, a panned whine as it closes
  function ghostWarnings(b) {
    const Tr = T(), k = K(), gb = sysm.gbeac, gv = sysm.gchev, bc = gb.instanceColor.array, vc = gv.instanceColor.array;
    let nb = 0, nc = 0;
    for (const g of ghosts) {
      if (!g.on || !g.ob) { g.warned = false; continue; }
      const ob = g.ob, ahead = Tr.ds(k.s, ob.s);
      const live = ob.dmg >= 0 && !b.staggered;
      if (ahead <= -5 || ahead > 220) { if (ahead < 0) g.warned = false; continue; }
      const kk = live ? 1 : 0.35;
      // beacon: tall red pillar (visible past the curve of the ring)
      Tr.toWorld(ob.s, ob.d, 0, V.a); V.s.set(1.6, 30, 1.6); V.q.identity();
      gb.setMatrixAt(nb, V.m.compose(V.a, V.q, V.s)); bc[nb * 3] = g.alpha * kk * (0.85 + 0.15 * Math.sin(G.time.real * 11)); nb++;
      // chevrons along the ghost's coming line, from just in front of it to ~45 m ahead of it
      if (live && ahead > 8) for (let j = 1; j <= 7 && nc < 16; j++) {
        const sj = Tr.wrap(ob.s - j * 6.5); if (Tr.ds(k.s, sj) < 3) break;
        const dj = lineD(sj, g.lag); const d = dj == null ? ob.d : clamp(dj, -Tr.halfDrive(sj) + 0.4, Tr.halfDrive(sj) - 0.4);
        const f = Tr.frame(sj, F);
        V.a.copy(f.p).addScaledVector(f.r, d).addScaledVector(f.n, 0.06);
        V.m.makeBasis(V.x.copy(f.r).negate(), f.n, f.t); V.q.setFromRotationMatrix(V.m); V.s.set(3.4, 1, 3.2);
        gv.setMatrixAt(nc, V.m.compose(V.a, V.q, V.s));
        const run = 0.55 + 0.45 * Math.sin(G.time.real * 14 + j * 1.3);   // chase pulse toward the kart
        vc[nc * 3] = g.alpha * run * (1 - j * 0.07); nc++;
      }
      if (live && !g.warned && ahead < 80 && ahead > 0) {
        g.warned = true; Tr.toWorld(ob.s, ob.d, 1, V.a);
        sfx('teleWhine', { pan: G.audio?.panFor?.(V.a) || 0, pitch: 1.6, vol: 0.8 });
      }
    }
    V.s.set(1, 1, 1);
    gb.count = nb; gb.visible = nb > 0; gv.count = nc; gv.visible = nc > 0;
    if (nb) { gb.instanceMatrix.needsUpdate = true; gb.instanceColor.needsUpdate = true; }
    if (nc) { gv.instanceMatrix.needsUpdate = true; gv.instanceColor.needsUpdate = true; }
  }

  // ---- finale light bridge: quadratic arc from the track to the stopwatch core ----
  const BR = { p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3() };
  function bridgePoint(u, out) {
    const a = (1 - u) * (1 - u), bb = 2 * u * (1 - u), c = u * u;
    return out.set(BR.p0.x * a + BR.p1.x * bb + BR.p2.x * c, BR.p0.y * a + BR.p1.y * bb + BR.p2.y * c, BR.p0.z * a + BR.p1.z * bb + BR.p2.z * c);
  }
  function buildBridge() {
    const k = K(); BR.p0.copy(k.worldPos); rig.coreNode.getWorldPosition(BR.p2);
    BR.p1.lerpVectors(BR.p0, BR.p2, 0.5); BR.p1.y += 22;
    const pos = sysm.bridge.geometry.attributes.position.array, NB = sysm.NB;
    for (let i = 0; i <= NB; i++) {
      const u = i / NB; bridgePoint(u, V.a); bridgePoint(Math.min(1, u + 0.01), V.b);
      V.c.copy(V.b).sub(V.a); V.d.crossVectors(V.c, UPV).normalize().multiplyScalar(2.4 * (1 - u * 0.6));
      pos[i * 6] = V.a.x - V.d.x; pos[i * 6 + 1] = V.a.y - 0.2; pos[i * 6 + 2] = V.a.z - V.d.z;
      pos[i * 6 + 3] = V.a.x + V.d.x; pos[i * 6 + 4] = V.a.y - 0.2; pos[i * 6 + 5] = V.a.z + V.d.z;
    }
    sysm.bridge.geometry.attributes.position.needsUpdate = true; sysm.bridge.geometry.computeBoundingSphere();
    sysm.bridge.visible = true;
  }
  // death cinematic camera (real time)
  function deathCam(t, cam) {
    const k = K(), m = G.boss?.mem || {};
    if (!(m.bridgeU >= 0) && m.deathFx !== 2) {    // time-stop orbit around the kart (0-2 s)
      const a = t * 1.5 + 0.4; V.a.copy(k.renderPos);
      cam.position.set(V.a.x + Math.cos(a) * 9, V.a.y + 3 + t * 0.6, V.a.z + Math.sin(a) * 9); cam.up.set(0, 1, 0); cam.lookAt(V.a);
    } else if (m.bridgeU >= 0 && m.bridgeU < 1) {   // chase the kart up the light bridge (2-3.8 s)
      bridgePoint(m.bridgeU, V.a); bridgePoint(Math.max(0, m.bridgeU - 0.12), V.b);
      cam.position.copy(V.b).addScaledVector(UPV, 4); rig.coreNode.getWorldPosition(V.c); V.d.lerpVectors(V.a, V.c, 0.35);
      cam.up.set(0, 1, 0); cam.lookAt(V.d);
    } else {                    // wide shot of the newborn star
      // pull back and look up at the newborn star rising out of the collapsed hole
      const u = clamp((t - 3.8) / 2.6, 0, 1);
      V.a.copy(BR.p0).setY(0).normalize();
      cam.position.copy(V.a).multiplyScalar(lerp(48, 120, sm(u))).setY(lerp(16, 22, sm(u)));
      cam.up.set(0, 1, 0); cam.lookAt(V.b.set(0, HOLE_Y + lerp(10, 15, sm(u)), 0));
    }
    if (Math.abs(cam.fov - 66) > 0.01) { cam.fov = 66; cam.updateProjectionMatrix(); }
  }

  // =================================================================
  // PHASE STATE (re-applied on enter and on checkpoint retry)
  // =================================================================
  function applyPhaseState(b, retry) {
    const m = b.mem;
    clearGhosts(); clearShatter(b);
    for (const sp of spokes) sp.on = false;
    for (const mt of meteors) mt.on = false;
    m.pit = null; m.freezeT = 0; frozen = false; m.hourHand = false; m.gravT = 0; m.decreeT = 0; m.sing = 0;
    m.clockOn = b.phase === 2; m.clockForced = false; m.clock = b.phase === 2 ? CLOCK_FIRST : CLOCK_DUR; m.clockTick = Math.ceil(m.clock);
    m.monoT = b.phase === 2 ? 0.7 : 0;
    grade(true, b.phase === 2);
    rig.standT = b.phase === 2 ? 1 : 0;
    m.ghostClean = true; m.ghostLapReady = false; m.g2 = false;
    if (b.phase === 1) spawnGhost(b, 0, retry ? 1 : 2.5);
    if (b.phase === 2) spawnGhost(b, 0, retry ? 1 : 3);
    restoreLines();
  }
  function restoreLines() { const U = T().uniforms; if (U && rig && rig.lineCol) U.uPalette.value[1].copy(rig.lineCol); }

  // =================================================================
  // DEFINITION
  // =================================================================
  const def = {
    id: 3, name: 'VELOX', title: 'the Last Lap King', music: 'boss3', accent: '#8fd7ff', targetTime: 210,
    tips: [
      'Your <b>GHOSTS</b> replay your path from 8 s ago. Change your line every lap.',
      'When the clock hits zero, be in a cyan <b>PIT BOX</b> (or mid-<b>COMET</b>).',
      'Break the 8 crown hands. Break all 4 of a set for a long <b>BREAK</b>.',
    ],
    briefCam: { target: [0, 24, 0], r: 105, h: 10 },
    arena: {
      name: 'EVENT HORIZON CIRCUIT', sky: 'void', palette: { base: '#04050b', line: '#8fd7ff', edge: '#4f6bff', accent: '#ffc93a' },
      shape: { type: 'ring', radius: R }, width: W, bank: 0, lapGateS: 0,
      pads: [{ s: 6, lane: -1, len: 8 }, { s: L / 4 + 6, lane: 1, len: 8 }, { s: L / 2 + 6, lane: -1, len: 8 }, { s: L * 3 / 4 + 6, lane: 1, len: 8 }],
      ramps: [], gaps: [], itemRows: [L / 8, L * 3 / 8, L * 5 / 8, L * 7 / 8],
      surface: 'chrome', fog: { color: '#05040e', near: 160, far: 1100 },
      envTop: '#1c1040', hemiSky: '#8fb8ff', sunDir: [0.3, 0.9, -0.2],
    },
    buildScenery(group, track) { buildScenery(group, track); },
    boss: {
      hp: B3_HP, minWindup: 0.9, softEnrage: 300, hardEnrage: 345, staggerDur: 6, staggerDecayMult: 0.85, deathDur: 6.4, height: 34, camFocusY: 16,
      attackNames: ['spokes', 'starfall', 'ticktock', 'hourhand', 'ghostlance', 'decree', 'gravity', 'pulse', 'checkered', 'shatter'],
      attacks,
      create(b) {
        if (!rig) return;
        b.root = rig.root; b.rig = rig;
        b.mem = { gaps: [], pit: null, clock: CLOCK_DUR, monoCur: 0, monoT: 0, monoPulse: 0, bridgeU: -1 };
        grade(true);
      },
      targets(b) {
        if (!rig) return [];
        const list = [
          { id: 'body', node: rig.bodyNode, mult: 1.0, always: true },
          { id: 'core', node: rig.coreNode, mult: 2.0, weak: true, isExposed: (bb) => bb.staggered },
        ];
        for (let i = 0; i < 8; i++) {
          list.push({ id: 'hand' + i, node: rig.handNodes[i], hp: HAND_HP, weak: true, set: i < 4 ? 0 : 1, idx: i,
            getMult: (bb) => bb.mem.freezeT > 0 ? 1.5 : 1.0,
            onDestroyed: (bb, t) => handDestroyed(bb, t) });
        }
        return list;
      },
      // bolts: core while staggered, else focus the weakest living hand of the current crown set, else the body
      bestTarget(b, slot) {
        if (b.staggered) return b.target('core');
        let best = null;
        for (let set = 0; set < 2 && !best; set++) for (const t of b.targets) if (t.set === set && t.hp > 0 && (!best || t.hp < best.hp)) best = t;
        return best || b.target('body');
      },
      onStart(b) {
        const m = b.mem; m.monoCur = 0; m.bridgeU = -1; m.fwT = 0; m.dawn = 0; m.collapse = 0; m.deathFx = 0; m.sing = 0;
        frozen = false;
        if (!rig) return;
        rig.dead = false; rig.fig.visible = true; rig.thr.visible = true; rig.haloG.visible = true; rig.stand = rig.standT = 0;
        rig.handAlive.fill(1); rig.handFlash.fill(0); rig.watchRate = 1; rig.glass.uniforms.uCrack.value = 0;
        const sc = rig.sc; sc.hole.visible = true; sc.hole.scale.setScalar(1); sc.halo.visible = true; sc.halo.material.uniforms.uCollapse.value = 0;
        sc.star.visible = false; sc.disk.material.uniforms.uStar.value = 0; sc.disk2.material.uniforms.uStar.value = 0;
        sysm.bridge.visible = false; sysm.chk.visible = false;
        try { G.sky?.setDawn?.(0); } catch (e) { }
        grade(true);
      },
      onStagger(b) {
        for (const n in rig.arms) armPose(n, 0, 0);
        rig.watchRate = 0.1; sfx('tick', { pitch: 0.6 });
        for (const sp of spokes) if (sp.on) { const h = sp.hs[0] || sp.hs[1]; if (h && h.state !== 'live') sp.on = false; }
      },
      onStaggerEnd(b) { rig.watchRate = 1; },
      onSoftEnrage(b) { b.mem.starT = 6; },
      onHardEnrage(b) {
        G.tele.clear(); b.mem.clockOn = false; clearGhosts(); b.mem.pit = null;
        G.cam.lookAtBoss?.(0.7, 4);
        const m = b.mem; m.sing = 0.0001;
        b.startCast('SINGULARITY', 4, { final: true, blocking: true, onComplete: () => G.combat.wipe('SINGULARITY') });
        tele({ shape: 'band', kind: 'damage', visKind: 'crack', s0: 0, s1: L - 0.05, d0: -99, d1: -HW, windup: 4, exact: true, visualOnly: true, src: 'singularity',
          follow: (dt, t, h) => { h.d1 = lerp(-HW - 1, HW + 1, clamp(t / 4, 0, 1)); } });
        callout('SINGULARITY', 'enrage'); sfx('enrage');
      },
      onWipe(b) { if (rig) { rig.pulse = 2; armPose('flag', 1, 3); rig.flagWave = 3; } },
      onDeath(b) {
        const m = b.mem;
        G.time.slowmo(0.05, 2.0);
        clearGhosts(); clearShatter(b); m.clockOn = false; m.pit = null; frozen = false;
        for (const sp of spokes) sp.on = false;
        G.cam.setCinematic(deathCam);
        m.bridgeU = -1; m.deathFx = 0; m.collapse = 0; m.dawn = 0; m.fwT = 0;
        rig.watchRate = 0; rig.dead = false;
        callout('TIME STOPS FOR THE KING', 'break');
      },
      // real-time death cinematic: freeze-orbit (0-2 s) → light bridge ride (2-3.8 s) → impact + newborn star
      death(b, t, rdt) {
        if (!rig) return;
        const m = b.mem, sc = rig.sc;
        rig.glass.uniforms.uCrack.value = Math.min(1, t / 2.5);
        m.monoCur = Math.max(0, (m.monoCur || 0) - rdt * 0.6); G.post?.setMono?.(m.monoCur);
        rig.glass.uniforms.uTime.value = G.time.now;
        if (t >= 2.0 && m.deathFx === 0) { m.deathFx = 1; buildBridge(); m.bridgeU = 0; sfx('overclock'); G.post?.bloomPulse?.(0.6, 1); }
        if (m.deathFx >= 1 && m.deathFx < 2) {
          const u = clamp((t - 2.0) / 1.8, 0, 1);
          sysm.bridge.material.uniforms.uProg.value = Math.min(1, u * 1.6 + 0.05);
          m.bridgeU = sm(u) * 0.98;
          bridgePoint(m.bridgeU, V.a); G.fx?.emit?.('starDust', V.a, UPV, rdt * 60, { key: 'b3br', scale: 1.2 });
          if (u >= 1) {
            m.deathFx = 2; m.bridgeU = -1; sysm.bridge.visible = false;
            // impact: white-out, Velox shatters, the hole collapses into a newborn star
            rig.coreNode.getWorldPosition(V.a);
            G.post?.flash?.('#fff1d0', 0.45, 0.9); G.post?.bloomPulse?.(0.5, 0.6); G.cam.shake(1.0); sfx('comet'); sfx('explosion', { big: true });
            G.fx?.shards?.(rig.body, 400, 0x8fd7ff, { speed: 1.6, size: 1.1, life: 3.5, heat: 0.4 });
            G.fx?.burst?.('comet', V.a, { count: 200, color: 0xffe9a8, scale: 2 }); G.fx?.burst?.('gold', V.a, { count: 120, scale: 2 });
            G.fx?.shockwave?.(V.a, { color: 0xffffff, radius: 140, dur: 1.4, thick: 0.04 });
            rig.fig.visible = false; rig.haloG.visible = false; rig.dead = true;
            sc.star.visible = true;
            G.emit('ui:callout', { text: 'CHECKMATE', style: 'break' });
          }
        }
        if (m.deathFx === 2) {
          m.collapse = Math.min(1, m.collapse + rdt / 0.7);
          const c = sm(m.collapse);
          sc.hole.scale.setScalar(Math.max(0.001, 1 - c)); sc.hole.visible = c < 0.999;
          sc.halo.material.uniforms.uCollapse.value = c;
          sc.star.material.uniforms.uK.value = c * (1 + 0.3 * Math.sin(G.time.real * 3));
          sc.star.scale.setScalar(lerp(4, 90, Math.pow(c, 0.6)));
          for (const d of [sc.disk, sc.disk2]) d.material.uniforms.uStar.value = Math.min(1, d.material.uniforms.uStar.value + rdt / 2);
          m.dawn = Math.min(1, m.dawn + rdt / 2); try { G.sky?.setDawn?.(m.dawn); } catch (e) { }
          fireworks(b, rdt);
        }
        if (t >= (b.B.deathDur || 6.4) - 0.05) G.cam.setCinematic(null);
      },
      update(b, dt) {
        if (!rig) return;
        const m = b.mem;
        if (b.state === 'fight') applyFreeze(b, dt);
        if (!frozen) animate(b, dt);
        if (b.state === 'fight') {
          updateSpokes(dt); updateGhosts(b, dt); updateClock(b, dt); ambientFx(b, dt);
          prunePads(false);
          if (m.gaps && m.gaps.length) m.gaps = m.gaps.filter(g => g.until > G.time.now);
          // P2: ghost 2 joins after 60 s in the phase
          if (b.phase === 1 && !m.g2 && b.phaseT >= 60) { m.g2 = true; spawnGhost(b, 1); callout('A SECOND GHOST!', 'danger'); }
          // soft enrage: Starfall every 6 s
          if (b.enrage === 1 && m.starT != null && !b.staggered && b.invulnT <= 0 && !frozen) { m.starT -= dt; if (m.starT <= 0) { m.starT = 6; attacks.starfall(b); } }
          // decree: the lane lines flip to red
          const U = T().uniforms;
          if (m.decreeT > 0) { m.decreeT -= dt; if (U) U.uPalette.value[1].setRGB(1, 0.16, 0.22); if (m.decreeT <= 0) restoreLines(); }
          if (m.sing > 0) { m.sing = Math.min(1, m.sing + dt / 4); rig.sc.hole.scale.setScalar(1 + m.sing * 1.4); }
        }
        // eclipse mono (owned while this fight runs; eases back to colour otherwise)
        if (b.state === 'fight' || b.state === 'dying') {
          const target = b.state === 'dying' ? 0 : m.monoT || 0;
          m.monoCur += (target - m.monoCur) * Math.min(1, dt * 1.2 + (b.state === 'dying' ? 0.02 : 0));
          m.monoPulse = Math.max(0, (m.monoPulse || 0) - G.DT * 1.2);
          G.post?.setMono?.(Math.max(m.monoCur, m.monoPulse));
        } else {
          if (m.monoCur > 0.001) { m.monoCur = 0; G.post?.setMono?.(0); }
          if (b.state === 'dead') fireworks(b, G.DT);
        }
      },
      render(b, rdt) { render(b, rdt); },
      phases: [
        { name: 'COUNTDOWN', at: 1.0, loop: 22, jitter: 0.5,
          rotation: [{ t: 0, a: 'spokes' }, { t: 8, a: 'starfall' }, { t: 15, a: 'ticktock' }, { t: 18, a: 'hourhand', cast: true }],
          enter(b, o) { applyPhaseState(b, o && o.retry); },
          // fallback guaranteed stagger: if HOUR HAND was never interrupted, the clock overwinds every 2nd loop
          onLoop(b, n) { if (n % 2 === 0 && b.phaseStaggers === 0 && !b.staggered) { callout('OVERWOUND!', 'break'); b.startStagger(4, true); } } },
        { name: 'GHOST LAPS', at: 0.70, loop: 25, jitter: 0.5,
          rotation: [{ t: 5, a: 'ghostlance' }, { t: 9, a: 'decree' }, { t: 14, a: 'gravity' }, { t: 17, a: 'ghostlance' }, { t: 21, a: 'pulse', cast: true }],
          enter(b, o) { applyPhaseState(b, o && o.retry); if (!o || !o.retry) { callout('GHOST LAPS', 'danger'); rig.mirrorFlash = 1; sfx('roar', { pitch: 0.9 }); G.cam.lookAtBoss?.(0.6, 2.5); } },
          onLoop(b, n) {
            if (n % 2 === 0 && !b.staggered) {
              b.startCast('REWIND', 1.6, { interruptible: false, onComplete: () => { callout('THE CLOCK STUTTERS', 'break'); b.startStagger(5, true); }, onInterrupt: () => { b.startStagger(5, true); } });
              rig.watchRate = -6;
            }
          } },
        { name: 'FINAL LAP', at: 0.35, loop: 20, jitter: 0.4,
          rotation: [{ t: 0, a: 'spokes' }, { t: 3, a: 'shatter' }, { t: 7, a: 'starfall' }, { t: 10, a: 'spokes' }, { t: 13, a: 'shatter' }, { t: 16, a: 'starfall' }],
          enter(b, o) {
            applyPhaseState(b, o && o.retry);
            if (!o || !o.retry) { callout('FINAL LAP', 'enrage'); sfx('roar', { pitch: 0.6 }); G.post?.flash?.('#ffd27a', 0.3, 1.5); G.cam.lookAtBoss?.(0.7, 3); }
          } },
      ],
      dispose(b) {
        clearGhosts(); for (const sp of spokes) sp.on = false; for (const mt of meteors) mt.on = false;
        for (const g of ghosts) { g.ribbon?.release?.(); g.ribbon = null; }
        frozen = false; domClock(false, 0, false);
        G.post?.setLens?.(0.5, 0.5, 0); G.post?.setMono?.(0); grade(false);
        try { G.sky?.setDawn?.(0); } catch (e) { }
        if (b.mem?.monoCur) b.mem.monoCur = 0;
      },
    },
  };

  // arena grade: cool tint + a softer, tighter bloom (the chrome grid blooms into haze otherwise)
  const savedGrade = { on: false, bloom: 0.9, thr: 0.78, rad: 0.55 };
  function grade(on, eclipse = false) {
    if (!G.post || !G.bloomPass) return;
    if (on && !savedGrade.on) { savedGrade.on = true; savedGrade.bloom = G.post.base.bloom; savedGrade.thr = G.bloomPass.threshold; savedGrade.rad = G.bloomPass.radius; }
    // threshold at least the global default (1.05): a lower one blooms the chrome grid into haze; the eclipse (P3) runs a dimmer bloom
    if (on) { G.post.setTint(0.95, 0.97, 1.07); G.post.base.bloom = Math.min(savedGrade.bloom, eclipse ? 0.45 : 0.62); G.bloomPass.threshold = Math.max(1.05, savedGrade.thr); G.bloomPass.radius = 0.42; }
    else if (savedGrade.on) { savedGrade.on = false; G.post.setTint(1, 1, 1); G.post.base.bloom = savedGrade.bloom; G.bloomPass.threshold = savedGrade.thr; G.bloomPass.radius = savedGrade.rad; }
  }
  function handDestroyed(b, t) {
    const i = t.idx;
    rig.handAlive[i] = 0;
    rig.handNodes[i].getWorldPosition(V.a);
    G.fx?.shards?.(V.a, 60, 0xffc93a, { speed: 1.2, size: 0.7, heat: 0.5 }); G.fx?.burst?.('gold', V.a, { count: 60, scale: 1.2 });
    sfx('break'); callout('HAND BROKEN', 'gold');
    b.damage(300, { source: 'hand', pos: V.a });
    if (b.state !== 'fight') return;
    // last hand of a set of 4 → desperation BREAK (no bar contribution on top: the 7 s BREAK is the reward)
    let left = 0; for (const x of b.targets) if (x.set === t.set && x.hp > 0) left++;
    if (left === 0) { callout('CROWN BROKEN!', 'break'); b.startStagger(7, true); }
    else b.addStagger(HAND_STAGGER);
  }
  function fireworks(b, dt) {
    const m = b.mem; m.fwT = (m.fwT || 0) - dt; m.fwN = m.fwN || 0;
    if (m.fwT > 0 || m.fwN > 40) return;
    m.fwT = 0.18 + Math.random() * 0.3; m.fwN++;
    const a = Math.random() * TAU, r = 30 + Math.random() * 70;
    V.e.set(Math.cos(a) * r, 25 + Math.random() * 45, Math.sin(a) * r);
    G.fx?.burst?.('firework', V.e, { color: [0xffc93a, 0x8fd7ff, 0xff3df2, 0xc04bff, 0xffffff][(Math.random() * 5) | 0], scale: 1.6 });
  }

  // ghost-free clean lap → shatter the oldest ghost
  G.on('lap', () => {
    const b = G.boss; if (!b || b.def !== def || b.state !== 'fight' || !rig || b.enrage >= 2) return;
    const m = b.mem;
    if (livingGhosts() && m.ghostLapReady && m.ghostClean) {
      const g = ghosts[1].on ? ghosts[1] : ghosts[0];
      shatterGhost(b, g, 'clean');
    }
    m.ghostClean = true; m.ghostLapReady = livingGhosts() > 0;
  });
  // ghosts flash on a ghost hit; record which hand was hit for the flash
  G.on('boss:damaged', (e) => {
    if (!rig || !G.boss || G.boss.def !== def || !e || !e.targetId) return;
    if (e.targetId.startsWith('hand')) rig.handFlash[+e.targetId.slice(4)] = 1;
  });
  // the frozen flag must never leak into other fights
  G.on('fight:end', () => { frozen = false; });

  G.bosses[2] = def;
}
