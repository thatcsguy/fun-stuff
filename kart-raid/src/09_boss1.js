// =====================================================================
// 09_boss1.js — BRASSHOLLOW, the Furnace Sumo + EMBER BOWL arena (§7).
// Arena def, crater scenery (lava lake, crater wall, lava falls, rocks,
// obelisks, volcanoes), procedural brass sumo rig with rocket palms,
// three phases, ten attacks, death finisher.                   (BOSS1)
// =====================================================================
{
  const { THREE } = G;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const sfx = (n, o) => { try { G.audio?.sfx?.(n, o); } catch (e) { } };
  const callout = (t, s) => { try { if (G.ui && G.ui.callout) G.ui.callout(t, s); else G.emit('ui:callout', { text: t, style: s }); } catch (e) { } };
  const K = () => G.kart, T = () => G.track;

  // stadium constants (must match arena.shape)
  const STR = 120, RAD = 55, HALF = STR / 2;
  const L = 2 * STR + 2 * Math.PI * RAD;           // ≈ 585.58
  const S_E0 = STR, S_N0 = STR + Math.PI * RAD, S_W0 = 2 * STR + Math.PI * RAD;
  const PED_TOP = 3;
  const SC = 1.35;            // rig scale: ~30 m seated / ~40 m standing, so the head clears the crater rim from the track
  // lava lake detail: full double domain warp on 'high', a single warp with 3 octaves on med/low (mobile)
  const LAVA_HQ = { value: 1 };
  const setLavaQ = (tier) => { LAVA_HQ.value = tier === 'high' ? 1 : 0; };
  try { G.on('quality', (e) => setLavaQ(e && e.tier)); } catch (e) { }

  // scratch (no per-frame allocation)
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(), f: new THREE.Vector3(),
    m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
  const F = { p: new THREE.Vector3(), t: new THREE.Vector3(), r: new THREE.Vector3(), n: new THREE.Vector3(), w: 0, bank: 0, kappa: 0 };
  const DOWN = new THREE.Vector3(0, -1, 0), UPV = new THREE.Vector3(0, 1, 0);
  const NOISE = /* glsl */`
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);
      return mix(mix(h12(i), h12(i+vec2(1,0)), u.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), u.x), u.y); }
    float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }`;

  // the rig lives at module scope (one boss 1 instance at a time)
  let rig = null;

  // =================================================================
  // PROCEDURAL TEXTURES: brass plates with glowing seams + rivets
  // =================================================================
  function plateTextures() {
    const N = 256;
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
    const ca = mk(), ce = mk(); const a = ca.getContext('2d'), e = ce.getContext('2d');
    a.fillStyle = '#b8b0a0'; a.fillRect(0, 0, N, N); e.fillStyle = '#000'; e.fillRect(0, 0, N, N);
    // plate tint variation
    const cols = 3, rows = 3, pw = N / cols, ph = N / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const v = 200 + ((x * 7 + y * 13) % 5) * 11; a.fillStyle = `rgb(${v},${v - 6},${v - 22})`;
      a.fillRect(x * pw + 2, y * ph + 2, pw - 4, ph - 4);
      // scratches
      a.strokeStyle = 'rgba(60,40,20,.25)'; a.lineWidth = 1;
      for (let k = 0; k < 4; k++) { a.beginPath(); const sx = x * pw + ((k * 37 + y * 11) % pw), sy = y * ph + ((k * 23 + x * 17) % ph); a.moveTo(sx, sy); a.lineTo(sx + 12, sy + 3); a.stroke(); }
    }
    // seams (dark in albedo, glowing in emissive)
    a.fillStyle = '#3a2410'; e.fillStyle = '#c04a10';
    for (let i = 0; i <= cols; i++) { a.fillRect(i * pw - 2, 0, 4, N); e.fillRect(i * pw - 1, 0, 2, N); }
    for (let j = 0; j <= rows; j++) { a.fillRect(0, j * ph - 2, N, 4); e.fillRect(0, j * ph - 1, N, 2); }
    // rivets
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) for (const [ox, oy] of [[6, 6], [pw - 6, 6], [6, ph - 6], [pw - 6, ph - 6], [pw / 2, 6], [pw / 2, ph - 6]]) {
      a.fillStyle = '#e8d8a8'; a.beginPath(); a.arc(x * pw + ox, y * ph + oy, 2.4, 0, 6.3); a.fill();
      e.fillStyle = '#ff8a30'; e.beginPath(); e.arc(x * pw + ox, y * ph + oy, 1.1, 0, 6.3); e.fill();
    }
    const map = new THREE.CanvasTexture(ca), em = new THREE.CanvasTexture(ce);
    map.colorSpace = THREE.SRGBColorSpace; em.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, em]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
    return { map, em };
  }

  // =================================================================
  // BOSS RIG
  // =================================================================
  function buildRig(group) {
    const merge = G.addons.BufferGeometryUtils.mergeGeometries;
    const tex = plateTextures();
    const brass = new THREE.MeshStandardMaterial({ color: '#e0ae58', metalness: 0.9, roughness: 0.3, map: tex.map, emissiveMap: tex.em, emissive: new THREE.Color('#ff6a1a'), emissiveIntensity: 0.7, envMapIntensity: 1.6 });
    const iron = new THREE.MeshStandardMaterial({ color: '#4a3a30', metalness: 0.75, roughness: 0.5, map: tex.map, emissiveMap: tex.em, emissive: new THREE.Color('#ff4a0a'), emissiveIntensity: 0.7 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.35, 0.15), toneMapped: true });
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.1, 0.25) });
    const ventMatL = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.1, 0.02) });
    const ventMatR = ventMatL.clone();
    const coreMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHeat: { value: 1 }, uGold: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uTime, uHeat, uGold; varying vec2 vUv; ${NOISE}
        void main(){ vec2 p = vUv - .5; float r = length(p) * 2.; float a = atan(p.y, p.x);
          float sw = fbm(vec2(a * 1.6 + uTime * .6 - r * 2., r * 3. - uTime * 1.8));
          float f = smoothstep(1.05, .0, r) * (.55 + sw * .9);
          vec3 c = mix(vec3(1., .25, .02), vec3(1., .8, .35), sw) * f * (1.6 + uHeat * 1.6);
          c = mix(c, vec3(1., .82, .3) * (2.5 + sin(uTime * 10.) * .6) * f, uGold);
          c += vec3(1., .9, .7) * pow(max(0., 1. - r), 6.) * 3. * (uHeat * .6 + uGold);
          gl_FragColor = vec4(c, 1.); }`,
    });
    const rodMat = brass;

    const root = new THREE.Group(); root.name = 'brasshollow';
    root.position.set(0, PED_TOP, 0); root.scale.setScalar(SC);
    const body = new THREE.Group(); root.add(body);          // body bob/slump
    // ---- torso (lathe) + shoulders ----
    const prof = [[0.01, 1.0], [4.6, 1.2], [6.9, 2.6], [8.1, 5.0], [8.4, 7.6], [8.0, 10.2], [7.2, 12.0], [7.7, 13.6], [7.3, 15.2], [5.6, 16.4], [3.0, 17.0], [0.01, 17.2]].map(p => new THREE.Vector2(p[0], p[1]));
    const torso = new THREE.LatheGeometry(prof, 28); torso.scale(1, 1, 0.86);
    torso.attributes.uv.array.forEach((v, i, arr) => { if (i % 2 === 0) arr[i] = v * 3; else arr[i] = v * 2; });
    const shL = new THREE.SphereGeometry(3.3, 16, 12).translate(-8.0, 14.4, 0), shR = new THREE.SphereGeometry(3.3, 16, 12).translate(8.0, 14.4, 0);
    const neck = new THREE.CylinderGeometry(2.2, 2.8, 2.4, 14).translate(0, 17.6, 0.3);
    const bodyBrass = new THREE.Mesh(merge([torso, shL, shR, neck]), brass); body.add(bodyBrass);
    // belt (mawashi) + vent stacks + door frame (iron)
    const belt = new THREE.TorusGeometry(7.4, 1.2, 10, 32).rotateX(Math.PI / 2).scale(1, 1, 0.86).translate(0, 3.6, 0);
    const knot = new THREE.BoxGeometry(3.2, 3.6, 1.6).translate(0, 3.0, 6.7);
    const ventL = new THREE.CylinderGeometry(1.25, 1.5, 3.6, 12).rotateZ(0.35).translate(-7.6, 17.6, -1.6);
    const ventR = new THREE.CylinderGeometry(1.25, 1.5, 3.6, 12).rotateZ(-0.35).translate(7.6, 17.6, -1.6);
    const frame = new THREE.TorusGeometry(4.0, 0.55, 8, 28).translate(0, 8.0, 7.05);
    const pipes = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) pipes.push(new THREE.CylinderGeometry(0.35, 0.35, 7, 8).rotateZ(Math.PI / 2 * 0.15 * sx).translate(sx * (4.2 + k * 0.9), 11.5 - k * 0.6, -6.2 + k * 0.4));
    const bodyIron = new THREE.Mesh(merge([belt, knot, ventL, ventR, frame, ...pipes]), iron); body.add(bodyIron);
    // glowing seams on the frame + belly vent slits (basic glow)
    const slits = [];
    for (let k = 0; k < 5; k++) slits.push(new THREE.BoxGeometry(5.2 - Math.abs(k - 2) * 0.8, 0.16, 0.2).translate(0, 12.2 - k * 0.7, 7.1 - Math.abs(k - 2) * 0.12));
    const glowStatic = new THREE.Mesh(merge([new THREE.TorusGeometry(4.0, 0.14, 6, 40).translate(0, 8.0, 7.55), ...slits]), glowMat); body.add(glowStatic);
    // vent glow discs (weak points)
    const vdiscL = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16).rotateX(-Math.PI / 2).rotateZ(0.35).translate(-8.25, 19.4, -1.6), ventMatL);
    const vdiscR = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16).rotateX(-Math.PI / 2).rotateZ(-0.35).translate(8.25, 19.4, -1.6), ventMatR);
    body.add(vdiscL, vdiscR);
    // vent lids (hinged)
    const mkLid = (sx) => { const g = new THREE.Group(); g.position.set(sx * 8.25 - sx * 1.2, 19.45, -1.6); g.rotation.z = sx * 0.35;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.35, 12).translate(sx * 1.2, 0.15, 0), iron); g.add(m); body.add(g); return g; };
    const lidL = mkLid(-1), lidR = mkLid(1);
    // furnace core + hinged door
    const core = new THREE.Mesh(new THREE.CircleGeometry(3.7, 32), coreMat); core.position.set(0, 8.0, 6.85); body.add(core);
    const coreNode = new THREE.Object3D(); coreNode.position.set(0, 8.0, 7.6); body.add(coreNode);
    const doorHinge = new THREE.Group(); doorHinge.position.set(-3.75, 8.0, 7.2); body.add(doorHinge);
    const doorParts = [new THREE.CylinderGeometry(3.7, 3.7, 0.5, 28).rotateX(Math.PI / 2).translate(3.75, 0, 0)];
    for (let k = -2; k <= 2; k++) doorParts.push(new THREE.BoxGeometry(6.2 - Math.abs(k) * 1.1, 0.42, 0.5).translate(3.75, k * 1.25, 0.35));
    doorParts.push(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10).rotateX(Math.PI / 2).translate(6.6, 0, 0.5));
    const door = new THREE.Mesh(merge(doorParts), brass); doorHinge.add(door);
    const doorGlow = new THREE.Mesh(merge([-1.9, -0.62, 0.62, 1.9].map(y => new THREE.BoxGeometry(5.4 - Math.abs(y) * 0.9, 0.2, 0.2).translate(3.75, y, 0.3))), glowMat); doorHinge.add(doorGlow);
    // ---- head ----
    const head = new THREE.Group(); head.position.set(0, 18.4, 0.6); body.add(head);
    const skull = new THREE.SphereGeometry(3.0, 18, 14).scale(1, 0.95, 0.92).translate(0, 1.4, 0);
    const knotG = new THREE.CylinderGeometry(0.95, 1.2, 2.3, 12).translate(0, 4.6, -0.6);
    const knotTop = new THREE.SphereGeometry(1.45, 12, 10).scale(1, 0.75, 1.2).translate(0, 6.0, -0.9);
    const ears = [new THREE.CylinderGeometry(0.9, 0.9, 0.8, 10).rotateZ(Math.PI / 2).translate(-2.9, 1.3, 0), new THREE.CylinderGeometry(0.9, 0.9, 0.8, 10).rotateZ(Math.PI / 2).translate(2.9, 1.3, 0)];
    const headBrass = new THREE.Mesh(merge([skull, knotG, knotTop, ...ears]), brass); head.add(headBrass);
    const face = new THREE.BoxGeometry(4.2, 2.6, 1.2).translate(0, 1.6, 2.45);
    const brow = new THREE.BoxGeometry(4.6, 0.7, 1.4).rotateX(0.2).translate(0, 2.8, 2.6);
    const jaw = new THREE.BoxGeometry(3.4, 1.0, 1.6).translate(0, 0.05, 2.3);
    const headIron = new THREE.Mesh(merge([face, brow, jaw]), iron); head.add(headIron);
    const eyes = new THREE.Mesh(merge([new THREE.BoxGeometry(1.3, 0.3, 0.3).rotateZ(0.18).translate(-1.05, 2.1, 3.1), new THREE.BoxGeometry(1.3, 0.3, 0.3).rotateZ(-0.18).translate(1.05, 2.1, 3.1),
      new THREE.BoxGeometry(2.4, 0.22, 0.25).translate(0, 0.55, 3.15)]), eyeMat); head.add(eyes);
    const mouth = new THREE.Object3D(); mouth.position.set(0, 0.55, 3.4); head.add(mouth);
    // ---- legs (seated -> standing) ----
    const legGeo = merge([new THREE.CylinderGeometry(2.5, 2.2, 11, 14).translate(0, -5.5, 0), new THREE.SphereGeometry(2.6, 12, 10).translate(0, -5.6, 0),
      new THREE.BoxGeometry(3.6, 2.2, 5.0).translate(0, -11.2, 1.4), new THREE.TorusGeometry(2.45, 0.35, 6, 18).rotateX(Math.PI / 2).translate(0, -3.0, 0), new THREE.TorusGeometry(2.3, 0.35, 6, 18).rotateX(Math.PI / 2).translate(0, -8.0, 0)]);
    const legs = [-1, 1].map(sx => {
      const g = new THREE.Group(); g.position.set(sx * 3.9, 2.4, 0.8); root.add(g);
      const m = new THREE.Mesh(legGeo, iron); g.add(m);
      const seat = new THREE.Quaternion().setFromUnitVectors(DOWN, new THREE.Vector3(-sx * 0.6, -0.05, 0.8).normalize());
      const stand = new THREE.Quaternion().setFromUnitVectors(DOWN, new THREE.Vector3(sx * 0.12, -1, 0.06).normalize());
      g.quaternion.copy(seat);
      return { g, seat, stand };
    });
    // ---- arms ----
    const upperGeo = merge([new THREE.CylinderGeometry(1.8, 1.5, 6.6, 12).translate(0, -3.3, 0), new THREE.SphereGeometry(1.75, 12, 10).translate(0, -6.6, 0),
      new THREE.TorusGeometry(1.75, 0.3, 6, 16).rotateX(Math.PI / 2).translate(0, -1.5, 0)]);
    const foreGeo = merge([new THREE.CylinderGeometry(1.55, 1.65, 3.6, 12).translate(0, -1.8, 0), new THREE.CylinderGeometry(0.95, 0.95, 3.2, 10).translate(0, -4.8, 0),
      new THREE.TorusGeometry(1.6, 0.32, 6, 16).rotateX(Math.PI / 2).translate(0, -3.6, 0), new THREE.SphereGeometry(1.25, 10, 8).translate(0, -6.4, 0)]);
    // palm: heel at origin, flat bottom at y=0, fingers toward +z
    const palmParts = [new THREE.BoxGeometry(6.5, 1.5, 5.4).translate(0, 0.75, 2.7)];
    for (let k = 0; k < 4; k++) palmParts.push(new THREE.BoxGeometry(1.35, 1.25, 3.6).translate(-2.4 + k * 1.6, 0.62, 7.0));
    palmParts.push(new THREE.BoxGeometry(1.5, 1.25, 3.2).rotateY(-0.7).translate(3.6, 0.62, 2.6));
    palmParts.push(new THREE.CylinderGeometry(1.4, 1.6, 1.2, 10).translate(0, 1.6, 0.6));
    const palmGeo = merge(palmParts);
    const palmGlowGeo = merge([new THREE.BoxGeometry(6.0, 0.18, 0.18).translate(0, 1.55, 5.45), new THREE.BoxGeometry(0.18, 0.18, 5.0).translate(-3.3, 1.2, 2.7), new THREE.BoxGeometry(0.18, 0.18, 5.0).translate(3.3, 1.2, 2.7)]);
    const rodGeo = merge([new THREE.CylinderGeometry(0.7, 0.7, 1, 10).translate(0, 0.5, 0)]);
    const arms = [-1, 1].map(sx => {
      const sh = new THREE.Group(); sh.position.set(sx * 8.0, 14.4, 0); body.add(sh);
      const up = new THREE.Mesh(upperGeo, brass); sh.add(up);
      const elbow = new THREE.Group(); elbow.position.set(0, -6.6, 0); sh.add(elbow);
      const fore = new THREE.Mesh(foreGeo, iron); elbow.add(fore);
      const wrist = new THREE.Object3D(); wrist.position.set(0, -6.6, 0); elbow.add(wrist);
      const restQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.42, 0, sx * 0.32));
      sh.quaternion.copy(restQ); elbow.rotation.x = -1.0;
      const palm = new THREE.Group(); group.add(palm);
      palm.add(new THREE.Mesh(palmGeo, brass)); palm.add(new THREE.Mesh(palmGlowGeo, glowMat));
      const rod = new THREE.Mesh(rodGeo, rodMat); rod.visible = false; group.add(rod);
      return { side: sx, sh, elbow, wrist, restQ, palm, rod, mode: 'rest', t: 0, dur: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), cur: new THREE.Vector3(),
        fromQ: new THREE.Quaternion(), toQ: new THREE.Quaternion(), curQ: new THREE.Quaternion(), scale: 1, toScale: 1.6, plantS: 0, plantD: 0, plantDur: 0.8, ramp: false,
        aimQ: new THREE.Quaternion(), aimW: 0, half: false, slammed: false };
    });
    group.add(root);
    // bolt targets
    const bodyNode = new THREE.Object3D(); bodyNode.position.set(0, 12, 4); body.add(bodyNode);
    const ventNodeL = new THREE.Object3D(); ventNodeL.position.set(-8.25, 19.6, -1.6); body.add(ventNodeL);
    const ventNodeR = new THREE.Object3D(); ventNodeR.position.set(8.25, 19.6, -1.6); body.add(ventNodeR);
    // big glowing "seam" lines on the pedestal are part of scenery; boss shadow disc for grounding
    return { root, body, head, eyes, mouth, legs, arms, door, doorHinge, core, coreMat, coreNode, bodyNode, ventNodeL, ventNodeR, lidL, lidR, vdiscL, vdiscR, ventMatL, ventMatR,
      brass, iron, eyeMat, glowMat, upper: [bodyBrass, bodyIron, glowStatic, headBrass, headIron, eyes, door, doorGlow, core], yaw: 0, standK: 0, standTarget: 0, bob: 0, slump: 0,
      doorK: 0, doorTarget: 0, inhale: 0, heat: 1, heatTarget: 1, ventK: 0, dead: false, stompT: -1, laugh: 0, tremble: 0 };
  }

  // =================================================================
  // SCENERY: lava lake, crater wall, lava falls, rocks, obelisks, pedestal, volcanoes
  // =================================================================
  // stadium outline point at fraction u of a "segment-consistent" parameter, offset radius R
  function outline(u, R, out) {
    u = ((u % 1) + 1) % 1; const q = u * 4, seg = Math.floor(q), f = q - seg;
    if (seg === 0) return out.set(-HALF + STR * f, 0, R);
    if (seg === 1) { const a = Math.PI * f; return out.set(HALF + R * Math.sin(a), 0, R * Math.cos(a)); }
    if (seg === 2) return out.set(HALF - STR * f, 0, -R);
    const a = Math.PI * f; return out.set(-HALF - R * Math.sin(a), 0, -R * Math.cos(a));
  }
  const hash = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const WALL = [[89, -2.4], [91, 2.5], [95, 9], [101, 17], [109, 26], [121, 35], [140, 42], [175, 40]];
  function wallPoint(u, row, out) {
    const [R0, y0] = WALL[row];
    const n1 = hash(Math.floor(u * 160) * 3.1 + row * 17.3), n2 = hash(Math.floor(u * 40) * 1.7 + row * 5.1);
    const R = R0 + (row > 0 ? (n1 - 0.5) * 4 + (n2 - 0.5) * 6 : 0);
    outline(u, R, out);
    out.y = y0 + (row > 0 ? (n1 - 0.5) * 2.5 + (n2 - 0.4) * (row * 1.6) : 0);
    return out;
  }
  function buildScenery(group, track) {
    const TU = track.uniforms;
    const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
    const sc = { group };
    // ---------- lava lake ----------
    setLavaQ(G.quality?.tier);
    const lavaU = { uTime: TU.uTime, uCool: TU.uCool, uEnrage: TU.uEnrage, uRise: { value: 0 }, uHQ: LAVA_HQ, ...fogU() };
    const lavaMat = new THREE.ShaderMaterial({
      uniforms: lavaU, fog: true,
      vertexShader: `uniform float uTime; varying vec2 vXZ;
        #include <fog_pars_vertex>
        void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vXZ = wp.xz;
          wp.y += sin(wp.x * .08 + uTime * .9) * sin(wp.z * .07 - uTime * .7) * .25;
          vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime, uCool, uEnrage, uRise, uHQ; varying vec2 vXZ;
        #include <fog_pars_fragment>
        ${NOISE}
        float fbm3(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s * 1.143; }
        void main(){
          vec2 p = vXZ * .032;
          float f;
          if (uHQ > .5) {
            vec2 q = vec2(fbm(p + vec2(uTime * .025, 0.)), fbm(p + vec2(4.7, -uTime * .02)));
            vec2 r2 = vec2(fbm(p * 1.7 + q * 2.4 + vec2(1.3, uTime * .04)), fbm(p * 1.7 + q * 2.4 + vec2(8.2, -uTime * .03)));
            f = fbm(p * 2.2 + r2 * 2.6);
          } else {                                   // med/low: one warp, 3 octaves (9 value-noise taps instead of 20)
            vec2 q = vec2(fbm3(p * 1.7 + vec2(uTime * .03, 0.)), fbm3(p * 1.7 + vec2(4.7, -uTime * .025)));
            f = fbm3(p * 2.2 + q * 3.4);
          }
          float crust = smoothstep(.30, .40, f);                       // dark plates
          float crack = 1. - smoothstep(.0, .03, abs(f - .30));        // bright veins at plate edges
          float hot = (1. - crust);
          vec3 hotCol = mix(vec3(.95, .18, .0), vec3(1., .62, .14), smoothstep(.15, .38, f) * (1. - smoothstep(.38, .4, f)));
          hotCol += vec3(1., .7, .3) * pow(max(0., .3 - f) / .3, 3.) * 1.4;
          float pulse = .85 + .15 * sin(uTime * 1.7 + f * 20.);
          vec3 crustCol = vec3(.045, .025, .02) + vec3(.22, .05, .0) * smoothstep(.62, .45, f);
          vec3 c = mix(hotCol * .62 * pulse, crustCol, crust) + vec3(1., .38, .04) * crack * .8;
          c = mix(c, vec3(.05, .035, .03) + vec3(.12, .03, 0.) * hot, uCool * .92);
          c += vec3(.6, .02, 0.) * uEnrage * hot * (.5 + .5 * sin(uTime * 5.));
          c += vec3(1., .45, .08) * uRise * hot * .7;
          gl_FragColor = vec4(c, 1.);
          #include <fog_fragment>
        }`,
    });
    const lshape = new THREE.Shape(); const LR = 89;
    lshape.absarc(HALF, 0, LR, -Math.PI / 2, Math.PI / 2, false); lshape.absarc(-HALF, 0, LR, Math.PI / 2, Math.PI * 1.5, false);
    const lgeo = new THREE.ShapeGeometry(lshape, 40); lgeo.rotateX(-Math.PI / 2);
    const lava = new THREE.Mesh(lgeo, lavaMat); lava.position.y = -1.7; group.add(lava);
    sc.lava = lava; sc.lavaU = lavaU;
    // ---------- crater wall ----------
    const US = 240, ROWS = WALL.length;
    const wpos = new Float32Array(US * ROWS * 3), wrow = new Float32Array(US * ROWS);
    for (let i = 0; i < US; i++) for (let r = 0; r < ROWS; r++) { wallPoint(i / US, r, V.a); const k = (i * ROWS + r); wpos[k * 3] = V.a.x; wpos[k * 3 + 1] = V.a.y; wpos[k * 3 + 2] = V.a.z; wrow[k] = r / (ROWS - 1); }
    const widx = [];
    for (let i = 0; i < US; i++) for (let r = 0; r < ROWS - 1; r++) { const a = i * ROWS + r, b = ((i + 1) % US) * ROWS + r; widx.push(a, a + 1, b, b, a + 1, b + 1); }
    let wgeo = new THREE.BufferGeometry(); wgeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3)); wgeo.setAttribute('aRow', new THREE.BufferAttribute(wrow, 1)); wgeo.setIndex(widx);
    wgeo = wgeo.toNonIndexed(); wgeo.computeVertexNormals();
    const wallMat = new THREE.ShaderMaterial({
      uniforms: { uTime: TU.uTime, uCool: TU.uCool, uSun: { value: new THREE.Vector3(-0.4, 0.8, 0.3).normalize() }, ...fogU() }, fog: true, side: THREE.DoubleSide,
      vertexShader: `attribute float aRow; varying float vRow; varying vec3 vN, vW;
        #include <fog_pars_vertex>
        void main(){ vRow = aRow; vN = normal; vec4 wp = modelMatrix * vec4(position, 1.); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime, uCool; uniform vec3 uSun; varying float vRow; varying vec3 vN, vW;
        #include <fog_pars_fragment>
        ${NOISE}
        void main(){ vec3 n = normalize(vN); if (n.y < 0.) n = -n;
          float g = fbm(vW.xz * .06 + vW.y * .05);
          float strata = .7 + .3 * sin(vW.y * 1.3 + g * 6.);
          vec3 rock = mix(vec3(.025, .018, .016), vec3(.09, .055, .04), g) * strata * (.3 + .9 * clamp(dot(n, uSun), 0., 1.));
          rock += vec3(.5, .12, .02) * pow(1. - vRow, 5.) * .9 * (1. - uCool * .8);       // lava glow from below
          float vein = 1. - smoothstep(.0, .025, abs(fbm(vW.xz * .045 + vec2(0., vW.y * .08)) - .48));
          rock += vec3(1., .35, .05) * vein * smoothstep(.75, .15, vRow) * 1.1 * (.7 + .3 * sin(uTime * 1.3 + vW.x * .05)) * (1. - uCool * .85);
          gl_FragColor = vec4(rock, 1.);
          #include <fog_fragment>
        }`,
    });
    const wall = new THREE.Mesh(wgeo, wallMat); group.add(wall);
    // ---------- lava falls (strips conforming to the wall) ----------
    const falls = [0.11, 0.29, 0.38, 0.62, 0.79, 0.93];
    const fpos = [], fuv = [], fidx = [];
    for (const u0 of falls) {
      const w = 0.012 + hash(u0 * 9) * 0.008, base = fpos.length / 3;
      for (let r = ROWS - 2; r >= 0; r--) for (let e = 0; e < 2; e++) {
        wallPoint(u0 + (e ? w : -w), r, V.a); outline(u0 + (e ? w : -w), 0, V.b);
        V.c.copy(V.b).sub(V.a).setY(0).normalize(); V.a.addScaledVector(V.c, 0.6); V.a.y += 0.25;
        fpos.push(V.a.x, V.a.y, V.a.z); fuv.push(e, (ROWS - 2 - r) / (ROWS - 2));
      }
      for (let r = 0; r < ROWS - 2; r++) { const a = base + r * 2; fidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3)); fgeo.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2)); fgeo.setIndex(fidx);
    const fallMat = new THREE.ShaderMaterial({
      uniforms: { uTime: TU.uTime, uCool: TU.uCool, ...fogU() }, fog: true, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime, uCool; varying vec2 vUv;
        #include <fog_pars_fragment>
        ${NOISE}
        void main(){ float x = vUv.x, y = vUv.y;
          float n = fbm(vec2(x * 4., y * 6. - uTime * 1.4)); float st = fbm(vec2(x * 11., y * 2.5 - uTime * 2.2));
          float edge = smoothstep(.0, .25, x) * smoothstep(1., .75, x);
          vec3 c = mix(vec3(.8, .16, .0), vec3(1., .6, .2), smoothstep(.45, .8, st)) * (.6 + n * .9) * edge;
          c += vec3(1., .5, .15) * smoothstep(.85, 1., y) * .6;
          c = mix(c, vec3(.05, .03, .02), uCool * .9);
          gl_FragColor = vec4(c + vec3(.03, .01, 0.), 1.);
          #include <fog_fragment>
        }`,
    });
    group.add(new THREE.Mesh(fgeo, fallMat));
    sc.fallBases = falls.map(u => outline(u, 89.5, new THREE.Vector3()).setY(-1));
    // ---------- rocks (rim + islands) ----------
    const rockMat = new THREE.MeshStandardMaterial({ color: '#2a1c16', roughness: 0.85, metalness: 0.15, flatShading: true, emissive: '#3a0d00', emissiveIntensity: 0.5 });
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 48);
    const qq = new THREE.Quaternion(), ee = new THREE.Euler(), ss = new THREE.Vector3(), pp = new THREE.Vector3(), mm = new THREE.Matrix4();
    for (let i = 0; i < 48; i++) {
      const u = i / 48 + hash(i * 3.3) * 0.015;
      if (i % 6 === 5) { outline(u, 70 + hash(i) * 12, pp); pp.y = -2; const k = 2.5 + hash(i * 7) * 3; ss.set(k * 1.4, k * 0.8, k); }   // lava islands outside the track
      else { const row = 4 + (i % 3); wallPoint(u, row, pp); pp.y -= 1.5; const k = 5 + hash(i * 1.7) * 11; ss.set(k * (0.8 + hash(i * 2.1) * 0.6), k * (0.7 + hash(i * 4.3) * 1.5), k); }
      qq.setFromEuler(ee.set(hash(i * 5.1), hash(i * 6.2) * 6, hash(i * 8.3) * 0.5));
      rocks.setMatrixAt(i, mm.compose(pp, qq, ss));
    }
    group.add(rocks);
    // ---------- obelisks around the pedestal (instanced) + glowing tips ----------
    const obGeo = new THREE.CylinderGeometry(0.9, 1.6, 1, 6).translate(0, 0.5, 0);
    const obel = new THREE.InstancedMesh(obGeo, new THREE.MeshStandardMaterial({ color: '#120c10', metalness: 0.7, roughness: 0.25, flatShading: true }), 8);
    const tips = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1.2, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.9, 0.15) }), 8);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2 + 0.2, R = 27 + (i % 2) * 6, h = 9 + (i % 3) * 3.5;
      pp.set(Math.cos(a) * R * 1.35, -2, Math.sin(a) * R * 0.8); qq.setFromAxisAngle(UPV, a); ss.set(1, h, 1);
      obel.setMatrixAt(i, mm.compose(pp, qq, ss));
      pp.y = -2 + h + 1.4; ss.set(1, 1.6, 1); tips.setMatrixAt(i, mm.compose(pp, qq, ss));
    }
    group.add(obel, tips); sc.tips = tips;
    // ---------- pedestal ----------
    const ped = new THREE.Mesh(G.addons.BufferGeometryUtils.mergeGeometries([new THREE.CylinderGeometry(15, 18, 6, 12).translate(0, 0, 0), new THREE.CylinderGeometry(13.5, 15, 1.2, 12).translate(0, 3.0 + 0.0, 0)]),
      new THREE.MeshStandardMaterial({ color: '#0e0a0d', metalness: 0.75, roughness: 0.22, flatShading: true }));
    ped.position.y = -0.6; group.add(ped);
    const rune = new THREE.Mesh(new THREE.TorusGeometry(14.6, 0.22, 6, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.8, 0.1) }));
    rune.position.y = PED_TOP - 0.55; group.add(rune); sc.rune = rune;
    // ---------- distant volcanoes (one merged mesh) ----------
    const vparts = [];
    for (const [x, z, r, h] of [[-330, -260, 90, 120], [360, -200, 70, 95], [80, -400, 110, 150], [-420, 140, 80, 90], [300, 330, 70, 80]]) {
      const g = new THREE.CylinderGeometry(r * 0.16, r, h, 14, 4, true); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + (hash(i * 1.3 + x) - 0.5) * 0.25 * (1 - Math.abs(y / h)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      g.translate(x, h / 2 - 8, z); const t = new Float32Array(p.count); for (let i = 0; i < p.count; i++) t[i] = (p.getY(i) + 8) / h; g.setAttribute('aH', new THREE.BufferAttribute(t, 1));
      vparts.push(g);
    }
    const vgeo = G.addons.BufferGeometryUtils.mergeGeometries(vparts); vgeo.computeVertexNormals();
    const vmat = new THREE.ShaderMaterial({
      uniforms: { uTime: TU.uTime, ...fogU() }, fog: true,
      vertexShader: `attribute float aH; varying float vH; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vH = aH; vec4 wp = modelMatrix * vec4(position, 1.); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime; varying float vH; varying vec3 vW;
        #include <fog_pars_fragment>
        ${NOISE}
        void main(){ float g = vn(vec2(atan(vW.z, vW.x) * 20., vH * 8.));
          vec3 c = vec3(.035, .02, .02) * (.6 + g);
          float rivers = smoothstep(.06, 0., abs(vn(vec2(atan(vW.z, vW.x) * 14., vH * 2. - uTime * .05)) - .5)) * smoothstep(.2, .95, vH);
          c += vec3(1., .35, .05) * (rivers * 1.2 + pow(vH, 14.) * 3.);
          gl_FragColor = vec4(c, 1.);
          #include <fog_fragment>
        }`,
    });
    group.add(new THREE.Mesh(vgeo, vmat));
    // ---------- boss ----------
    rig = buildRig(group);
    rig.scenery = sc;
    return sc;
  }

  // =================================================================
  // RIG ANIMATION
  // =================================================================
  const tmpQ = new THREE.Quaternion();
  function wristWorld(arm, out) { arm.wrist.getWorldPosition(out); return out; }
  // palm resting pose: flat, fingers along the boss facing, at the wrist
  function palmRestQ(out) { return out.setFromAxisAngle(UPV, rig.yaw); }
  // slam pose at (s, d): X along T (rotated for ramp tilt), Y = N, Z = R (fingers to +d)
  function palmSlamPose(s, d, scale, tilt, outP, outQ) {
    const f = T().frame(s, F);
    V.x.copy(f.t); V.y.copy(f.n); V.z.copy(f.r);
    if (tilt) { V.x.copy(f.t).multiplyScalar(Math.cos(tilt)).addScaledVector(f.n, Math.sin(tilt)); V.y.copy(f.n).multiplyScalar(Math.cos(tilt)).addScaledVector(f.t, -Math.sin(tilt)); }
    V.m.makeBasis(V.x, V.y, V.z); outQ.setFromRotationMatrix(V.m);
    const heelD = d - 4.5 * scale;   // palm center is 4.5 (×scale) from the heel along +z
    outP.copy(f.p).addScaledVector(f.r, heelD).addScaledVector(f.n, 0.05 + (tilt ? Math.sin(tilt) * 3.25 * scale : 0));
    return outP;
  }
  function launchPalm(arm, s, d, flyDur, plantDur, o = {}) {
    arm.mode = 'fly'; arm.t = 0; arm.dur = flyDur; arm.plantDur = plantDur; arm.plantS = s; arm.plantD = d;
    arm.toScale = o.scale ?? 1.6; arm.ramp = !!o.ramp; arm.slammed = false; arm.onSlam = o.onSlam || null;
    arm.from.copy(arm.cur); arm.fromQ.copy(arm.curQ);
  }
  function raiseArm(arm, dur = 0.4) { if (arm.mode === 'rest' || arm.mode === 'back') { arm.mode = 'raise'; arm.t = 0; arm.dur = dur; } }
  function returnArm(arm) {
    if (arm.mode === 'rest' || arm.mode === 'back') return;
    if (arm.rampId) { try { T().removeRamp(arm.rampId); } catch (e) { } arm.rampId = 0; }
    arm.mode = 'back'; arm.t = 0; arm.dur = 0.6; arm.from.copy(arm.cur); arm.fromQ.copy(arm.curQ);
  }
  function updateArm(arm, dt, b) {
    arm.t += dt;
    const u = arm.dur > 0 ? Math.min(1, arm.t / arm.dur) : 1;
    let aimW = 0;
    if (arm.mode === 'rest' || arm.mode === 'raise') {
      wristWorld(arm, arm.cur); palmRestQ(arm.curQ); arm.scale = SC;
      if (arm.mode === 'raise') aimW = sm(u) * 0.6;
    } else if (arm.mode === 'fly') {
      palmSlamPose(arm.plantS, arm.plantD, arm.toScale, 0, V.e, V.q2);
      // quadratic arc with a high control point
      V.f.lerpVectors(arm.from, V.e, 0.5); V.f.y = Math.max(arm.from.y, V.e.y) + 22;
      const e = u * u;                              // accelerate into the slam
      arm.cur.copy(arm.from).multiplyScalar((1 - e) * (1 - e)).addScaledVector(V.f, 2 * e * (1 - e)).addScaledVector(V.e, e * e);
      arm.curQ.slerpQuaternions(arm.fromQ, V.q2, sm(u * 1.4));
      arm.scale = lerp(SC, arm.toScale, sm(u * 1.2)); aimW = 1;
      if (u >= 1) { arm.mode = 'plant'; arm.t = 0; arm.dur = arm.plantDur; slamFx(arm, b); }
    } else if (arm.mode === 'plant') {
      const tilt = arm.ramp ? sm(Math.min(1, arm.t / 0.35)) * 0.32 : 0;
      palmSlamPose(arm.plantS, arm.plantD, arm.toScale, tilt, arm.cur, arm.curQ);
      if (!arm.ramp) arm.cur.addScaledVector(F.n, -Math.min(0.3, arm.t * 2));
      aimW = 1;
      if (u >= 1) returnArm(arm);
    } else if (arm.mode === 'back') {
      wristWorld(arm, V.e); palmRestQ(V.q2);
      const e = sm(u);
      arm.cur.lerpVectors(arm.from, V.e, e); arm.cur.y += Math.sin(Math.PI * e) * 10;
      arm.curQ.slerpQuaternions(arm.fromQ, V.q2, e); arm.scale = lerp(arm.toScale, SC, e); aimW = 1 - e;
      if (u >= 1) { arm.mode = 'rest'; }
    }
    // shoulder aim toward the palm (in body-local space)
    if (aimW > 0.001) {
      V.a.copy(arm.mode === 'raise' ? arm.cur : arm.cur); if (arm.mode === 'raise') V.a.y += 14;
      rig.body.worldToLocal(V.a); V.a.sub(arm.sh.position).normalize();
      arm.aimQ.setFromUnitVectors(DOWN, V.a);
      arm.sh.quaternion.slerpQuaternions(arm.restQ, arm.aimQ, aimW);
      arm.elbow.rotation.x = lerp(-1.0, 0, aimW);
    } else { arm.sh.quaternion.slerp(arm.restQ, Math.min(1, dt * 6)); arm.elbow.rotation.x += (-1.0 - arm.elbow.rotation.x) * Math.min(1, dt * 6); }
    // palm + piston rod transforms
    arm.palm.position.copy(arm.cur); arm.palm.quaternion.copy(arm.curQ); arm.palm.scale.setScalar(arm.scale);
    const showRod = arm.mode === 'fly' || arm.mode === 'plant' || (arm.mode === 'back' && u < 0.9);
    arm.rod.visible = showRod;
    if (showRod) {
      wristWorld(arm, V.a); V.b.copy(arm.cur).sub(V.a); const len = V.b.length();
      arm.rod.position.copy(V.a); arm.rod.quaternion.setFromUnitVectors(UPV, V.b.normalize()); arm.rod.scale.set(1, Math.max(0.01, len), 1);
    }
  }
  function slamFx(arm, b) {
    const k = K();
    arm.palm.getWorldPosition(V.a); T().toWorld(arm.plantS, arm.plantD, 0.3, V.a);
    G.fx?.burst?.('lavaSplash', V.a, { count: 40, scale: 1.6 });
    G.fx?.burst?.('dust', V.a, { count: 24, scale: 2.5 });
    G.fx?.burst?.('wallSpark', V.a, { count: 40, scale: 1.5 });
    G.fx?.shockwave?.(V.a, { color: 0xff8a1f, radius: 16, dur: 0.45 });
    sfx('stomp', { pan: G.audio?.panFor?.(V.a) || 0 });
    if (k.worldPos.distanceTo(V.a) < 40) G.cam.shake(0.4);
    try { arm.onSlam?.(arm); } catch (e) { G.logError('palm.onSlam', e); }
    if (arm.ramp) {
      arm.rampId = T().addRamp({ s: arm.plantS - 4, len: 6, kick: 8, until: G.time.now + arm.plantDur, visual: false });
    }
  }
  function nearestArm(s, d) {
    T().toWorld(s, d, 0, V.a); rig.body.worldToLocal(V.a);
    const pick = V.a.x < 0 ? rig.arms[0] : rig.arms[1];
    if (pick.mode === 'rest' || pick.mode === 'back') return pick;
    const other = pick === rig.arms[0] ? rig.arms[1] : rig.arms[0];
    return other.mode === 'rest' || other.mode === 'back' ? other : pick;
  }

  // ambient + rig update (sim time)
  function animate(b, dt) {
    if (!rig) return;
    const k = K(), m = b.mem, t = G.time.now;
    // face the kart with ~0.6 s lag (yaw only)
    if (!rig.dead) {
      const want = Math.atan2(k.worldPos.x, k.worldPos.z);
      let dy = want - rig.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      rig.yaw += dy * (1 - Math.exp(-dt / 0.6));
      rig.root.rotation.y = rig.yaw;
    }
    // stand up (P3)
    rig.standK += (rig.standTarget - rig.standK) * Math.min(1, dt * 1.4);
    const st = sm(rig.standK);
    for (const lg of rig.legs) lg.g.quaternion.slerpQuaternions(lg.seat, lg.stand, st);
    // stomp hop
    let hop = 0;
    if (rig.stompT >= 0) {
      rig.stompT += dt; const u = rig.stompT;
      hop = u < 0.45 ? sm(u / 0.45) * 2.2 : u < 0.6 ? lerp(2.2, -0.5, (u - 0.45) / 0.15) : lerp(-0.5, 0, Math.min(1, (u - 0.6) / 0.4));
      if (u > 1.1) rig.stompT = -1;
    }
    rig.root.position.y = PED_TOP + st * 9.5 + hop * SC + Math.sin(t * 1.6) * 0.15 + rig.tremble * (Math.random() - 0.5) * 0.6;
    rig.root.position.x = rig.tremble * (Math.random() - 0.5) * 0.6;
    // breathing / inhale (bellows) / slump (stagger)
    const breath = 1 + Math.sin(t * 1.6) * 0.012 + rig.inhale * 0.08;
    rig.body.scale.set(breath, 1 + rig.inhale * 0.03, breath);
    rig.slump += ((b.staggered ? 1 : 0) - rig.slump) * Math.min(1, dt * 4);
    rig.body.rotation.x = rig.slump * 0.22 + rig.laugh * Math.sin(t * 14) * 0.03;
    rig.head.rotation.x = rig.slump * 0.4 - rig.inhale * 0.25;
    // door
    rig.doorTarget = b.staggered ? 1 : (b.phase >= 1 ? 0.18 : 0);
    rig.doorK += (rig.doorTarget - rig.doorK) * Math.min(1, dt * 5);
    rig.doorHinge.rotation.y = -rig.doorK * 1.9;
    // heat / glow
    rig.heatTarget = b.phase >= 2 ? 1.35 : b.phase >= 1 ? 1.0 : 0.7;
    rig.heat += (rig.heatTarget - rig.heat) * Math.min(1, dt * 1.5);
    const flash = b.hitFlash || 0;
    rig.brass.emissiveIntensity = rig.dead ? 0.1 : rig.heat + flash * 1.4 + rig.inhale * 1.2;
    rig.iron.emissiveIntensity = rig.dead ? 0.05 : rig.heat * 0.55 + flash * 0.8;
    if (b.phase >= 2) rig.brass.emissive.setRGB(1, 0.22 + 0.1 * Math.sin(t * 3), 0.04); else rig.brass.emissive.setRGB(1, 0.42, 0.1);
    rig.coreMat.uniforms.uTime.value = t; rig.coreMat.uniforms.uHeat.value = rig.dead ? 0 : rig.heat * 0.6 + rig.inhale * 1.5;
    rig.coreMat.uniforms.uGold.value += ((b.staggered ? 1 : 0) - rig.coreMat.uniforms.uGold.value) * Math.min(1, dt * 6);
    // vents (weak points when open)
    if (m.ventsOpenT > 0) m.ventsOpenT -= dt;
    const vOpen = m.ventsOpenT > 0 || b.staggered;
    rig.ventK += ((vOpen ? 1 : 0) - rig.ventK) * Math.min(1, dt * 8);
    rig.lidL.rotation.x = -rig.ventK * 1.5; rig.lidR.rotation.x = -rig.ventK * 1.5;
    const vk = rig.ventK, pulse = 0.8 + 0.2 * Math.sin(t * 12);
    rig.ventMatL.color.setRGB(lerp(0.6, 3.2, vk) * pulse, lerp(0.1, 2.3, vk) * pulse, lerp(0.02, 0.4, vk));
    rig.ventMatR.color.copy(rig.ventMatL.color);
    if (vOpen && Math.random() < 0.5) {
      for (const n of [rig.ventNodeL, rig.ventNodeR]) { n.getWorldPosition(V.a); G.fx?.emit?.('steam', V.a, UPV, 0.6, null); }
    }
    // eyes
    const eyeK = rig.dead ? 0 : (b.staggered ? 0.25 + 0.2 * Math.sin(t * 20) : 1) * (1 + flash * 0.5);
    rig.eyeMat.color.setRGB(4 * eyeK, 0.35 * eyeK, 0.15 * eyeK);
    rig.laugh = Math.max(0, rig.laugh - dt * 0.4);
    // arms + palms
    rig.root.updateMatrixWorld(true);
    for (const arm of rig.arms) updateArm(arm, dt, b);
    // scenery life: obelisk tips + lava bubbles near the kart
    const sc = rig.scenery;
    if (sc) {
      if (!rig.dead && Math.random() < dt * 5) {
        const a = Math.random() * 6.283, r = 20 + Math.random() * 60;
        V.a.set(k.worldPos.x * 0.6 + Math.cos(a) * r, -1.4 + (sc.lavaU.uRise.value * 3), k.worldPos.z * 0.6 + Math.sin(a) * r * 0.7);
        if (Math.abs(V.a.z) < 44 || Math.abs(V.a.x) > 60 && Math.hypot(Math.abs(V.a.x) - 60, V.a.z) < 44 || Math.hypot(Math.abs(V.a.x) - 60, V.a.z) > 66 || Math.abs(V.a.z) > 66)
          G.fx?.burst?.('lavaSplash', V.a, { count: 10, scale: 0.9 + Math.random() * 0.8 });
      }
      if (Math.random() < dt * 2 && sc.fallBases.length) { const fb = sc.fallBases[(Math.random() * sc.fallBases.length) | 0]; G.fx?.burst?.('steam', fb, { count: 3, scale: 1.5 }); }
    }
  }

  // =================================================================
  // PERMANENT LAVA (cumulative per phase; rebuilt on phase enter / retry)
  // =================================================================
  const NORTH_CURVE = [S_E0 + 14, S_N0 - 14];     // the far (east) curve's inner lane floods in P2
  function setupPermanent(b) {
    const m = b.mem;
    for (const id of (m.perm || [])) G.zones.remove(id);
    m.perm = [];
    if (b.phase >= 1) m.perm.push(G.zones.add({ type: 'lava', s0: NORTH_CURVE[0], s1: NORTH_CURVE[1], d0: -9.5, d1: -3, instant: 15, phaseClear: false, src: 'lava', alpha: 0.42 }));
    if (b.phase >= 2) m.perm.push(G.zones.add({ type: 'lava', s0: 0, s1: L - 0.05, d0: -9.5, d1: -5, instant: 15, phaseClear: false, src: 'lava', alpha: 0.28 }));
    if (rig) rig.scenery.lavaU.uRise.value = b.phase >= 2 ? 0.2 : b.phase >= 1 ? 0.08 : 0;
  }

  // =================================================================
  // ATTACKS
  // =================================================================
  const tele = (o) => G.tele.spawn(o);
  const BELLOWS_DUR = 4.5;
  const mouthPos = (out) => { rig.mouth.getWorldPosition(out); return out; };
  // a visible lobbed glob (fx bolt) from the boss to a track point; cosmetic
  function lob(s, d, color, onLand) {
    if (!G.fx?.bolt) { onLand?.(); return; }
    const tgt = T().toWorld(s, d, 0.3, new THREE.Vector3());   // one per lob (event-time allocation)
    rig.coreNode.getWorldPosition(V.a);
    G.fx.bolt(V.a, () => tgt, { color, tier: 2, width: 1.1, speed: 55, arc: 2.2, onHit: () => { G.fx?.burst?.('lavaSplash', tgt, { count: 30, color, scale: 1.3 }); onLand?.(); } });
  }
  // fire / flame stream particles from the mouth to a point
  function flameStream(to, n = 5) {
    mouthPos(V.a);
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      V.b.lerpVectors(V.a, to, u); V.b.y += Math.sin(u * Math.PI) * 6;
      V.c.copy(to).sub(V.a).normalize();
      G.fx?.emit?.('boostFlame', V.b, V.c, 1, flameOpts);
      if (Math.random() < 0.3) G.fx?.emit?.('ember', V.b, V.c, 1, null);
    }
  }
  const flameOpts = { color: '#ff7a1a', scale: 4, speed: 2.2, spread: 0.3, key: 'b1flame' };

  function palmStrike(b, p = {}) {
    // base 25: C.hitPlayer applies the enrage x1.5 (≈ 38-40, spec §7.5); don't double-scale it here
    // lead:'resolve' aims at where a cruising kart will be when it slams (windup + 0.12 s), so the dodge is brake / boost / dash
    const h = tele({ shape: 'rect', kind: 'damage', len: 12, wid: p.wid ?? 16, d: p.d ?? 0, lead: 'resolve', windup: 1.6, dmg: 25, src: 'palm', rot: 0, s: p.s });
    const arm = p.arm || nearestArm(h.s, h.d);
    raiseArm(arm, 0.4);
    const flyDur = 0.55, resolveAt = h.windup + 0.12;
    const ramp = b.phase === 1 && !p.noRamp;
    b.after(Math.max(0.05, resolveAt - flyDur), () => { if (h.state !== 'fade' && h.state !== 'done') launchPalm(arm, h.s, h.d, flyDur, ramp ? 3.0 : 0.8, { scale: p.scale ?? 1.6, ramp }); else returnArm(arm); });
    sfx('roar', { pitch: 1.3, vol: 0.4 });
    return h;
  }

  const attacks = {
    // ---- P1/P2: Palm Strike (rect, lead) ----
    palm(b, p) { palmStrike(b, p); },

    // ---- P1/P2: Palm Rake. Three slams in a row, each blocking two of the three lanes on the kart's line at its
    // own instant (1.2 s apart). The open lane moves one lane at a time, so the dodge is a slalom: read the
    // gaps (or brake / boost to shift the timing). ----
    rake(b) {
      const k = K(), Tr = T();
      // slams land on your cruising line: speeds below cruise are assumed to recover toward it
      const v = clamp(Math.max(k.sdot || 0, Math.min(G.cfg.vTop, (k.sdot || 0) + 6)), 24, 44);
      const curLane = Math.abs(k.d) < 3 ? 0 : Math.sign(k.d);
      let open = curLane;
      const LEN = 30, T0 = 2.0, DT = 1.2;
      callout('PALM RAKE - FIND THE GAP!', 'danger');
      G.ui?.hint?.('b1rake', 'WEAVE THROUGH THE OPEN LANE', 'EACH SLAM LEAVES ONE LANE CLEAR · A/D TO SWITCH', 4.5);
      sfx('roar', { pitch: 1.15, vol: 0.5 });
      for (let i = 0; i < 3; i++) {
        const tr = T0 + DT * i, sc = Tr.wrap(k.s + v * tr);
        // adjacent lane each step, never the lane you are in for the first slam, avoiding lava
        let opts = [-1, 0, 1].filter(l => Math.abs(l - open) === 1 && laneOpen(l, sc));
        if (!opts.length) opts = [-1, 0, 1].filter(l => laneOpen(l, sc));
        if (!opts.length) opts = [0];
        open = opts[(G.rng() * opts.length) | 0];
        const blocks = open === 0 ? [{ d: -6, wid: 6.2 }, { d: 6, wid: 6.2 }] : [{ d: -open * 3, wid: 12.4 }];
        // the open lane gets a gold "safe" strip so the gap reads at a glance
        tele({ shape: 'rect', kind: 'gold', len: LEN, wid: 5, d: Tr.laneD(open, sc), s: sc, windup: tr, exact: true, visualOnly: true, src: 'rakeGap' });
        { const od = Tr.laneD(open, sc); for (const e of [-1, 1]) { const pd = open === 0 ? e * 3.1 : (e === -open ? od + e * 3.1 : null); if (pd == null) continue; addPost(Tr.wrap(sc - LEN / 2), pd, 3.2, tr); addPost(Tr.wrap(sc + LEN / 2), pd, 2.2, tr); } }
        let first = true;
        for (const bl of blocks) {
          const h = tele({ shape: 'rect', kind: 'damage', len: LEN, wid: bl.wid, d: bl.d, s: sc, windup: tr - 0.12, exact: true, dmg: 20, knock: 3, src: 'rake' });
          if (first) {
            first = false;
            const arm = rig.arms[i % 2];
            b.after(Math.max(0.05, tr - 0.5), () => { if (h.state !== 'fade' && h.state !== 'done') launchPalm(arm, sc, bl.d + (bl.wid > 7 ? 0 : 0), 0.5, 0.45, { scale: 1.9 }); }, false);
          }
        }
      }
      raiseArm(rig.arms[0], 0.4); raiseArm(rig.arms[1], 0.4);
    },

    // ---- P1: Steam Vents (3 geysers ahead) -> shoulder vents open (weak x1.5) ----
    vents(b) {
      const k = K(), lanes = [-1, 0, 1].sort(() => G.rng() - 0.5);
      let erupted = false;
      for (let i = 0; i < 3; i++) {
        const s = k.s + 50 + i * 26 + G.rng() * 8, d = T().laneD(lanes[i], s);
        tele({ shape: 'circle', kind: 'damage', r: 4, s, d, windup: 2.0, active: 1.5, tick: 0.5, dmg: 15, src: 'geyser',
          onHit: () => { const kk = K(); kk.vh = Math.max(kk.vh, 7); kk.airborne = true; },
          onResolve: () => {
            T().toWorld(s, d, 0, V.a); G.fx?.burst?.('steam', V.a, { count: 30, scale: 2.2 }); G.fx?.burst?.('geyser', V.a, { count: 40, scale: 1.6 });
            sfx('steam'); if (!erupted) { erupted = true; b.mem.ventsOpenT = 3; callout('VENTS OPEN!', 'graze'); }
          },
          onLive: (dt) => { T().toWorld(s, d, 0.2, V.a); G.fx?.emit?.('geyser', V.a, UPV, dt * 40, { scale: 1.7, key: 'gy' + i }); G.fx?.emit?.('steam', V.a, UPV, dt * 12, { key: 'st' + i, scale: 1.3 }); } });
      }
      // boss rears and steams from the seams
      rig.inhale = 0.4; b.after(0.5, () => { rig.inhale = 0; });
    },

    // ---- Stomp Shockwave: purple ring expands from the boss; hop/dash to clear ----
    stomp(b) {
      if (!rig) return;
      rig.stompT = 0;
      b.after(0.6, () => {
        const r0 = 15, speed = 14;
        G.fx?.shockwave?.(V.a.set(0, PED_TOP, 0), { color: 0xb44bff, radius: 18, dur: 0.4 });
        G.fx?.burst?.('dust', V.a.set(0, PED_TOP, 0), { count: 30, scale: 3 });
        sfx('stomp'); G.cam.shake(0.5 * clamp(1 - K().worldPos.length() / 150, 0.3, 1));
        G.post?.shockAt?.(V.a.set(0, PED_TOP, 0), 0.8);
        // telegraph band rides the kart's predicted crossing point
        const est = G.rings.eta(0, 0, r0, speed);
        let band = null;
        if (est) {
          band = tele({ shape: 'band', kind: 'knock', s0: est.s - 5, s1: est.s + 5, windup: est.t, exact: true, visualOnly: true, src: 'stomp',
            follow: (dt, tt, h) => {
              const kk = K(); const dist = Math.hypot(kk.worldPos.x, kk.worldPos.z); const rem = Math.max(0.02, (dist - ring.r) / speed);
              const pr = kk.predict(rem); h.s0 = T().wrap(pr.s - 5); h.s1 = T().wrap(pr.s + 5); h.windup = Math.max(h.t + rem, 0.1);
            } });
        }
        const done = () => { if (band) band.cancel(); };
        const ring = G.rings.add({ center: V.b.set(0, -0.2, 0), r0, speed, rMax: 150, clearH: 1.2, dmg: 20, spin: true, color: '#b44bff', src: 'stomp',
          onClear: (R, why) => {
            done();
            if (!why) { K().addFlux(10, 'stompClear'); b.addStagger(0.06); callout('CLEARED!', 'graze'); G.fx?.burst?.('graze', K().worldPos, { count: 30 }); }
            stompDone(b);
          },
          onHit: (R, r) => { done(); if (r === 'hit') stompDone(b); } });
      });
    },

    // ---- Interruptible cast BELLOWS -> fire band ahead ----
    bellows(b) {
      if (!b.mem.toldBellows) { b.mem.toldBellows = true; callout('Release a VIOLET drift to interrupt!', 'interrupt'); try { G.ui?.toast?.('Release a VIOLET drift to interrupt!'); } catch (e) { } }
      rig.inhaling = true;
      G.cam.lookAtBoss?.(0.3, 1.4);
      // 4.5 s (spec said 2.5): a drift started at the cast reaches VIOLET in ~2.4-2.7 s and the bolts need ~1 s to land,
      // so this leaves ~0.8 s of reaction time
      b.startCast('BELLOWS', BELLOWS_DUR, { interruptible: true, label: 'VIOLET DRIFT TO INTERRUPT',
        onComplete: () => {
          rig.inhaling = false;
          const k = K(), s0 = k.s + 40, s1 = k.s + 90;
          T().toWorld(T().wrap((s0 + s1) / 2), 0, 1, V.d); const target = new THREE.Vector3().copy(V.d);
          sfx('roar', { pitch: 0.8 });
          tele({ shape: 'band', kind: 'damage', visKind: 'fire', s0, s1, windup: 1.6, active: 4, tick: 0.5, dmg: 10, src: 'bellows',
            onLive: () => { flameStream(target, 4); if (Math.random() < 0.3) { T().toWorld(T().wrap(s0 + Math.random() * 50), (Math.random() - 0.5) * 16, 0.5, V.c); G.fx?.burst?.('explosion', V.c, { count: 12, scale: 0.5 }); } } });
        },
        onInterrupt: () => {
          rig.inhaling = false;
          mouthPos(V.a); G.fx?.burst?.('dust', V.a, { count: 40, scale: 3 }); G.fx?.burst?.('steam', V.a, { count: 30, scale: 3 });
          callout('*COUGH*', 'interrupt');
          b.startStagger(4, true);
        } });
    },

    // ---- P2: Piston Barrage (4 full-width bands ahead, staggered windups) ----
    piston(b) {
      const k = K(); const st = { hits: 0, n: 0 };
      callout('OUTRUN or BRAKE!', 'danger');
      // bands 25 m, windup step 0.45 s: the wave runs away from a braking kart, a boosted kart (pad / Nitro / T2+) outruns it,
      // a plain cruise eats one band (was 0.6 s / 30 m = two bands at any constant speed)
      for (let i = 0; i < 4; i++) {
        const c = k.s + 40 + 35 * i;
        const h = tele({ shape: 'band', kind: 'damage', s0: c - 12.5, s1: c + 12.5, windup: 1.6 + 0.45 * i, dmg: 25, src: 'piston',
          onResolve: (hit) => {
            st.n++; if (hit) st.hits++;
            rams.slam(i);
            if (st.n === 4 && st.hits === 0) { K().addFlux(20, 'outran'); callout('OUTRAN!', 'perfect'); }
          } });
        rams.arm(i, c, h);
      }
      sfx('roar', { pitch: 1.1 });
    },

    // ---- P2: Molten Spill (2 half-width lava bands; the open half holds a pad) ----
    spill(b) {
      const k = K(), Tr = T();
      const picks = [];
      for (const p of Tr.pads) { const x = Tr.ds(k.s, p.s); if (x > 45 && x < 320) picks.push({ p, x }); }
      picks.sort((a, c) => a.x - c.x);
      const spots = picks.slice(0, 2).map(({ p }) => p.lane >= 1 ? { s: p.s + 4, d0: -9.5, d1: 0.5 } : { s: p.s + 4, d0: 3.2, d1: 9.5 });
      while (spots.length < 2) spots.push({ s: k.s + 70 + spots.length * 70, d0: -9.5, d1: 0 });
      for (const sp of spots) {
        const s0 = sp.s - 20, s1 = sp.s + 20, dc = (sp.d0 + sp.d1) / 2;
        lob(Tr.wrap(sp.s), dc, '#ff6a1a', null);
        tele({ shape: 'band', kind: 'lava', s0, s1, d0: sp.d0, d1: sp.d1, windup: 1.8, dmg: 0, src: 'spill',
          onResolve: () => { G.zones.add({ type: 'lava', s0, s1, d0: sp.d0, d1: sp.d1, dur: 6, instant: 15, phaseClear: true, src: 'spill' }); Tr.toWorld(Tr.wrap(sp.s), dc, 0, V.a); G.fx?.burst?.('lavaSplash', V.a, { count: 50, scale: 1.8 }); } });
      }
    },

    // ---- P2: Oil Slicks (3 purple circles -> spin-out zones) ----
    oil(b) {
      const k = K(), Tr = T();
      for (let i = 0; i < 3; i++) {
        const s = k.s + 45 + i * 22 + G.rng() * 10, d = (G.rng() * 2 - 1) * 6;
        lob(Tr.wrap(s), d, '#6a2aa0', null);
        tele({ shape: 'circle', kind: 'knock', r: 3, s, d, windup: 1.6, dmg: 0, src: 'oil', noGraze: true,
          onResolve: () => G.zones.add({ type: 'oil', s0: s - 3, s1: s + 3, d0: d - 3, d1: d + 3, dur: 8, phaseClear: true, src: 'oil' }) });
      }
    },

    // ---- P3: Furnace Breath (band sweeping +s from behind) -> vent stagger ----
    breath(b) {
      const k = K(), Tr = T();
      // band [s0, s0+40]: its leading edge starts 15 m behind the kart and accelerates past cruise speed
      // (32 m/s while it ignites, then 34 -> 50 m/s over the 6 s burn). A cruising kart is caught after ~5 s;
      // a pad, a T2+ turbo, Nitro or a dash through it keeps you clean.
      const s0 = k.s - 55, t0 = G.time.now;
      const vAt = (tt) => tt < 1.6 ? 32 : Math.min(50, 34 + (tt - 1.6) * (16 / 6));
      const follow = (dt, tt, h) => { const v = vAt(G.time.now - t0); h.s0 = Tr.wrap(h.s0 + v * dt); h.s1 = Tr.wrap(h.s1 + v * dt); };
      const strip = tele({ shape: 'band', kind: 'damage', s0: s0 + 40, s1: s0 + 70, windup: 7.6, exact: true, visualOnly: true, src: 'breathEdge', follow });
      const target = new THREE.Vector3();
      sfx('roar', { pitch: 0.7 });
      callout('FIRE BEHIND - BOOST!', 'danger');
      G.cam.lookAtBoss?.(0.35, 1.6);
      rig.inhale = 0.6;
      tele({ shape: 'band', kind: 'damage', visKind: 'fire', s0, s1: s0 + 40, windup: 1.6, active: 6, tick: 0.5, dmg: 12, src: 'breath', follow, exact: true,
        onResolve: () => { rig.inhale = 0; },
        onLive: (dt, h) => { Tr.toWorld(h.s, 0, 1, target); flameStream(target, 6); if (Math.random() < 0.25) { Tr.toWorld(Tr.wrap(h.s0 + Math.random() * 40), (Math.random() - 0.5) * 16, 0.5, V.c); G.fx?.burst?.('explosion', V.c, { count: 10, scale: 0.6 }); } },
        onEnd: (h) => {
          strip.cancel(); rig.inhale = 0;
          if (h.resolved && b.state === 'fight' && b.phase === 2 && !b.staggered && b.enrage < 2) { callout('VENTING!', 'break'); b.after(0.2, () => { if (!b.staggered && b.enrage < 2) b.startStagger(4, true); }); }
        } });
    },

    // ---- P3: Double Palm (inner half + outer half, offset 0.5 s) ----
    palm2(b) {
      palmStrike(b, { d: -4.5, wid: 9, arm: rig.arms[0].mode === 'rest' ? rig.arms[0] : undefined, scale: 1.15, noRamp: true });
      b.after(0.5, () => palmStrike(b, { d: 4.5, wid: 9, arm: rig.arms[1].mode === 'rest' ? rig.arms[1] : undefined, scale: 1.15, noRamp: true }));
    },

    // ---- P3: Heatwave SOAK (stand in a cyan circle or take 35) ----
    heatwave(b) {
      const k = K(), Tr = T(); const res = { n: 0, inside: false, cancelled: false };
      const finish = () => {
        if (res.cancelled) return;
        G.fx?.shockwave?.(V.a.set(0, PED_TOP + 6, 0), { color: 0xff8a1f, radius: 160, dur: 0.9, thick: 0.03 });
        G.fx?.flash?.(0xff8a1f, 0.35, 0.4); G.post?.shockAt?.(V.a.set(0, PED_TOP, 0), 1.0); sfx('explosion', { big: true });
        if (res.inside) { K().addFlux(5, 'soak'); callout('+SOAKED', 'perfect'); }
        else G.combat.hitPlayer(35, { src: 'heatwave' });
      };
      // two cyan circles on the kart's predicted line at the blast (inner lane a little short, outer lane a little long).
      // They glide along the predicted s until 1 s before the blast, so steering into one at a steady speed lands inside; being inside
      // at ANY moment of the last 0.6 s counts (not just the resolve instant).
      const W = 3, RES = W + 0.12;
      const p0 = k.predict(RES).s;
      const spots = [{ ds: -8, d: -3.5 }, { ds: 8, lane: 1 }];
      const follow = (dt, tt, h) => {
        const kk = K(), sp = h.data;
        // glide (max 30 m/s relative) toward the predicted line until 1 s before the blast, then hold still
        if (tt < h.windup - 0.9) { const want = Tr.wrap(kk.predict(Math.max(0.1, h.windup + 0.12 - tt)).s + sp.ds); const dx = Tr.ds(h.s, want); h.s = Tr.wrap(h.s + clamp(dx, -30 * dt, 30 * dt)); if (sp.lane) h.d = Tr.laneD(sp.lane, h.s); }
        if (tt >= h.windup + 0.12 - 0.6 && !kk.wrecked && Math.hypot(Tr.ds(h.s, kk.s), kk.d - h.d) < h.r) res.inside = true;
      };
      const hs = spots.map(sp => tele({ shape: 'circle', kind: 'soak', r: 6, s: Tr.wrap(p0 + sp.ds), d: sp.lane ? Tr.laneD(sp.lane, Tr.wrap(p0 + sp.ds)) : sp.d, windup: W, dmg: 0, src: 'heatwave', sound: 'choir', data: sp, follow,
        onResolve: (inside) => { res.n++; if (inside) res.inside = true; if (res.n === 2) finish(); } }));
      rig.inhale = 0.8;
      callout('GET IN THE CYAN!', 'perfect');
      G.cam.lookAtBoss?.(0.25, 1.2);
      b.startCast('HEATWAVE', 3.1, { interruptible: false, label: 'GET IN A CYAN CIRCLE', onComplete: () => { rig.inhale = 0; }, onInterrupt: () => { res.cancelled = true; rig.inhale = 0; hs.forEach(h => h.cancel()); } });
    },
  };
  // death camera (real time t). Orbits the pedestal; never enters the crater wall (R < 89).
  function deathCam(t, cam) {
    const b = deathCam.boss;
    if (!rig || !rig.dead || G.boss !== b) { G.cam.setCinematic(null); G.cam.snap(); return; }
    const pull = sm((t - 1.0) / 1.4);
    const a = deathCam.a0 + 0.16 * t;
    const R = lerp(54, 84, pull), H = lerp(13, 34, pull);   // obelisks reach ~45 m from the centre
    cam.position.set(Math.cos(a) * R, PED_TOP + H, Math.sin(a) * R);
    cam.up.set(0, 1, 0);
    cam.lookAt(V.f.set(0, lerp(PED_TOP + 16, PED_TOP + 4, pull), 0));
    const fov = lerp(52, 62, pull); if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }
  deathCam.a0 = 0; deathCam.boss = null;

  function stompDone(b) {
    const m = b.mem; m.stomps = (m.stomps || 0) + 1;
    if (b.phase === 0 && m.stomps >= 2 && b.phaseStaggers === 0 && !b.staggered && b.state === 'fight') { callout('STEAM PURGE!', 'break'); b.startStagger(4, true); }
  }

  // ---- sky rams for Piston Barrage (one InstancedMesh of 4) ----
  const rams = {
    mesh: null, st: [0, 1, 2, 3].map(() => ({ on: false, s: 0, h: null, mode: 'hover', t: 0, y: 40 })),
    build(group, brass) {
      const merge = G.addons.BufferGeometryUtils.mergeGeometries;
      const g = merge([new THREE.BoxGeometry(17, 2.4, 26).translate(0, 1.2, 0), new THREE.CylinderGeometry(2.8, 2.8, 46, 12).translate(0, 25, 0),
        new THREE.CylinderGeometry(4.2, 4.2, 3, 12).translate(0, 4, 0), new THREE.TorusGeometry(3.2, 0.5, 6, 16).rotateX(Math.PI / 2).translate(0, 14, 0), new THREE.TorusGeometry(3.2, 0.5, 6, 16).rotateX(Math.PI / 2).translate(0, 30, 0)]);
      rams.mesh = new THREE.InstancedMesh(g, brass, 4); rams.mesh.count = 4; rams.mesh.frustumCulled = false;
      for (let i = 0; i < 4; i++) { V.m.makeScale(0, 0, 0); rams.mesh.setMatrixAt(i, V.m); }
      group.add(rams.mesh);
    },
    arm(i, s, h) { const r = rams.st[i]; r.on = true; r.s = T().wrap(s); r.h = h; r.mode = 'hover'; r.t = 0; r.y = 60; },
    slam(i) { const r = rams.st[i]; if (!r.on) return; r.mode = 'drop'; r.t = 0; },
    update(dt) {
      if (!rams.mesh) return;
      let any = false;
      for (let i = 0; i < 4; i++) {
        const r = rams.st[i];
        if (!r.on) { V.m.makeScale(0, 0, 0); rams.mesh.setMatrixAt(i, V.m); continue; }
        any = true; r.t += dt;
        if (r.mode === 'hover') { r.y += (26 - r.y) * Math.min(1, dt * 3); if (r.h && (r.h.state === 'fade' || r.h.state === 'done') && !r.h.resolved) r.mode = 'up'; }
        else if (r.mode === 'drop') {
          r.y = Math.max(0, r.y - dt * 220);
          if (r.y <= 0 && !r.landed) { r.landed = true; T().toWorld(r.s, 0, 0.5, V.a); G.fx?.burst?.('dust', V.a, { count: 30, scale: 3 }); G.fx?.burst?.('wallSpark', V.a, { count: 50, scale: 2 }); G.fx?.shockwave?.(V.a, { color: 0xff8a1f, radius: 18, dur: 0.4 }); sfx('stomp'); if (K().worldPos.distanceTo(V.a) < 50) G.cam.shake(0.35); }
          if (r.t > 0.55) { r.mode = 'up'; r.t = 0; }
        } else if (r.mode === 'up') { r.y += dt * 60; if (r.y > 70) { r.on = false; r.landed = false; } }
        const f = T().frame(r.s, F);
        V.a.copy(f.p).addScaledVector(f.n, r.y);
        V.z.copy(f.t); V.m.makeBasis(f.r, f.n, V.z); V.q.setFromRotationMatrix(V.m);
        rams.mesh.setMatrixAt(i, V.m.compose(V.a, V.q, V.s.set(1, 1, 1)));
      }
      rams.mesh.instanceMatrix.needsUpdate = true;
      rams.mesh.visible = any;
    },
    reset() { for (const r of rams.st) { r.on = false; r.landed = false; } },
  };

  // =================================================================
  // ARC GATES (driving decides the damage)
  // Brasshollow's brass hull is ARMORED (bolts x0.6 on the body). Twin copper pylons with a live arc between them
  // stand on one lane of the next curve. Drive through while DRIFTING (or boosting): the gate dumps your charge
  // into the furnace (110 / 160 / 230 dmg by tier) and SHORTS it for 5-7 s: armor off, shoulder vents open (x1.5).
  // Drive through without a charge: nothing ("NO CHARGE"). Missing the gate: nothing. ~2 gates a lap, curves only.
  // =================================================================
  const SHORT_COL = new THREE.Color(0.25, 1.1, 1.3);
  const ARMOR = 0.45, GATE_R = 3.2, GATE_HW = 3.65, GATE_H = 6.8;
  const GATE_DMG = [0, 110, 160, 230], GATE_STAG = [0, 0.06, 0.10, 0.15], GATE_SHORT = [0, 5, 6, 7];
  const arc = { mesh: null, curtainU: null, floorU: null, g: null, cd: 2.5, lane: 0, n: 0, told: 0, zapT: 0, fxT: 0, warned: false,
    capL: new THREE.Vector3(), capR: new THREE.Vector3(), mid: new THREE.Vector3(), col: new THREE.Color() };
  function buildGate(group) {
    const merge = G.addons.BufferGeometryUtils.mergeGeometries;
    const copper = new THREE.MeshStandardMaterial({ color: '#c9783c', metalness: 0.9, roughness: 0.32, emissive: new THREE.Color('#ff6a1a'), emissiveIntensity: 0.35, envMapIntensity: 1.4 });
    const pylon = merge([new THREE.CylinderGeometry(0.3, 0.46, GATE_H, 10).translate(0, GATE_H / 2, 0), new THREE.BoxGeometry(1.5, 0.55, 1.5).translate(0, 0.27, 0),
      new THREE.CylinderGeometry(0.62, 0.62, 0.35, 12).translate(0, GATE_H + 0.1, 0)]);
    const coil = merge([0, 1, 2].map(i => new THREE.TorusGeometry(0.55 - i * 0.06, 0.09, 6, 18).rotateX(Math.PI / 2).translate(0, GATE_H - 1.9 + i * 0.6, 0).toNonIndexed()).concat([new THREE.SphereGeometry(0.5, 12, 10).translate(0, GATE_H + 0.75, 0).toNonIndexed()]));
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 2.6) });
    const g = new THREE.Group(); g.name = 'arcGate';
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(pylon, copper); m.position.x = sx * GATE_HW; g.add(m); const c = new THREE.Mesh(coil, glow); c.position.x = sx * GATE_HW; g.add(c); }
    const near = `varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); vD = distance(cameraPosition, wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
    arc.curtainU = { uTime: { value: 0 }, uA: { value: 1 }, uCol: { value: new THREE.Color(0.5, 1.6, 1.9) } };
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(GATE_HW * 2, GATE_H).translate(0, GATE_H / 2, 0), new THREE.ShaderMaterial({
      uniforms: arc.curtainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: near,
      fragmentShader: `uniform float uTime, uA; uniform vec3 uCol; varying vec2 vUv; varying float vD;
        void main(){
          float edge = smoothstep(.0, .07, vUv.x) * smoothstep(1., .93, vUv.x);
          float streak = pow(.5 + .5 * sin(vUv.x * 55. + sin(vUv.y * 7. + uTime * 9.) * 2.5), 8.);
          float scan = .55 + .45 * sin(vUv.y * 22. - uTime * 15.);
          float top = smoothstep(.6, 1., vUv.y), base = smoothstep(.0, .12, vUv.y);
          float a = (.1 + streak * .55 * scan + top * .3) * edge * base * uA * smoothstep(5., 16., vD);
          gl_FragColor = vec4(uCol * a, 1.); }` }));
    curtain.renderOrder = 3; g.add(curtain);
    // sky beams over both pylons: the gate reads from the far side of the bowl
    const beamGeo = new THREE.CylinderGeometry(0.22, 0.75, 34, 10, 1, true).translate(0, GATE_H + 1.2 + 17, 0);
    const beamMat = new THREE.ShaderMaterial({ uniforms: arc.curtainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying float vY; varying float vD; void main(){ vY = uv.y; vec4 wp = modelMatrix * vec4(position, 1.); vD = distance(cameraPosition, wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform float uTime, uA; uniform vec3 uCol; varying float vY; varying float vD;
        void main(){ float a = (1. - vY) * (1. - vY) * (.55 + .45 * sin(vY * 30. - uTime * 8.)) * uA * smoothstep(12., 40., vD) * .8; gl_FragColor = vec4(uCol * a, 1.); }` });
    for (const sx of [-1, 1]) { const bm = new THREE.Mesh(beamGeo, beamMat); bm.position.x = sx * GATE_HW; bm.renderOrder = 3; g.add(bm); }
    arc.floorU = { uTime: arc.curtainU.uTime, uA: arc.curtainU.uA, uCol: arc.curtainU.uCol };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(GATE_R * 2, 22).rotateX(-Math.PI / 2).translate(0, 0.12, 4), new THREE.ShaderMaterial({
      uniforms: arc.floorU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: near,
      fragmentShader: `uniform float uTime, uA; uniform vec3 uCol; varying vec2 vUv; varying float vD;
        void main(){
          float x = abs(vUv.x - .5) * 2.;
          float ch = fract(vUv.y * 5.5 - x * .9 - uTime * 1.6);
          float chev = smoothstep(.0, .08, ch) * smoothstep(.42, .3, ch);
          float rail = smoothstep(.82, .97, x) * (1. - smoothstep(.97, 1., x));
          float fade = smoothstep(0., .25, vUv.y) * smoothstep(1., .55, vUv.y);
          float a = (chev * .5 + rail * .9) * fade * uA * smoothstep(3., 12., vD);
          gl_FragColor = vec4(uCol * a, 1.); }` }));
    floor.renderOrder = 2; g.add(floor);
    g.visible = false;
    arc.mesh = g; group.add(g);
  }
  // gap posts for PALM RAKE: gold light posts at both edges of each slam's open lane, rising with the windup
  const posts = { mesh: null, list: [] };
  function buildPosts(group) {
    const geo = new THREE.BoxGeometry(0.4, 1, 0.4).translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.7, 0.35), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    posts.mesh = new THREE.InstancedMesh(geo, mat, 24); posts.mesh.count = 0; posts.mesh.frustumCulled = false; posts.list.length = 0;
    group.add(posts.mesh);
  }
  function addPost(s, d, h, life) { if (posts.list.length < 24) posts.list.push({ s, d, h, t: 0, life }); }
  function updatePosts(dt) {
    if (!posts.mesh) return;
    const Tr = T(); let n = 0;
    for (let i = posts.list.length - 1; i >= 0; i--) { const p = posts.list[i]; p.t += dt; if (p.t > p.life + 0.3) posts.list.splice(i, 1); }
    for (const p of posts.list) {
      const grow = sm(p.t / 0.5), fade = 1 - sm((p.t - p.life) / 0.3);
      const f = Tr.frame(p.s, F); V.a.copy(f.p).addScaledVector(f.r, p.d);
      V.m.makeBasis(f.r, f.n, V.z.copy(f.t).negate()); V.q.setFromRotationMatrix(V.m);
      posts.mesh.setMatrixAt(n++, V.m.compose(V.a, V.q, V.s.set(1, Math.max(0.01, p.h * grow * fade), 1)));
    }
    posts.mesh.count = n; posts.mesh.instanceMatrix.needsUpdate = true; posts.mesh.visible = n > 0;
  }
  const laneOpen = (lane, s) => {
    // a lane is open when no permanent / live lava zone covers its centre at s
    const Tr = T(), d = Tr.laneD(lane, s);
    for (const z of G.zones.list()) if (z.type === 'lava' && Tr.inRange(s, z.s0, z.s1) && d + 2 > z.d0 && d - 2 < z.d1) return false;
    return true;
  };
  function gateRemove(why) {
    const g = arc.g; arc.g = null; arc.warned = false;
    if (g) { try { G.gates.remove(g); } catch (e) { } }
    if (arc.mesh) arc.mesh.visible = false;
    if (why === 'miss' && G.fx) { G.fx.burst?.('fizz', arc.mid, { count: 20 }); }
  }
  function gateSpawn(b) {
    const k = K(), Tr = T(), span = Math.PI * RAD;
    let best = null;
    for (const c0 of [S_E0, S_W0]) {
      const s = Tr.wrap(c0 + span * (0.28 + G.rng() * 0.44));
      const fwd = ((s - k.s) % Tr.L + Tr.L) % Tr.L;
      if (fwd >= 85 && (!best || fwd < best.fwd)) best = { s, fwd };
    }
    if (!best) return;
    const lanes = [-1, 0, 1].filter(l => l !== arc.lane && laneOpen(l, best.s));
    if (!lanes.length) { arc.cd = 1; return; }
    const lane = lanes[(G.rng() * lanes.length) | 0]; arc.lane = lane;
    const d = Tr.laneD(lane, best.s);
    arc.g = G.gates.add({ s: best.s, d, r: GATE_R, kind: 'arc', mesh: arc.mesh, src: 'arcGate', onPass: (boosting) => gatePass(b, boosting) });
    const f = Tr.frame(best.s, F);
    arc.mesh.position.copy(f.p).addScaledVector(f.r, d);
    V.z.copy(f.t).negate(); V.m.makeBasis(f.r, f.n, V.z); arc.mesh.quaternion.setFromRotationMatrix(V.m);
    arc.mesh.visible = true; arc.mesh.updateMatrixWorld(true);
    arc.capL.set(-GATE_HW, GATE_H + 0.75, 0).applyMatrix4(arc.mesh.matrixWorld);
    arc.capR.set(GATE_HW, GATE_H + 0.75, 0).applyMatrix4(arc.mesh.matrixWorld);
    arc.mid.lerpVectors(arc.capL, arc.capR, 0.5);
    arc.n++;
    sfx('chime', { pan: G.audio?.panFor?.(arc.mid) || 0, vol: 0.6 });
    if (arc.n === 1) {
      G.ui?.hint?.('b1gate', 'DRIFT THROUGH THE ARC GATE', 'BRASS ARMOR BLOCKS BOLTS · A CHARGED GATE SHORTS IT OUT', 5.5);
      callout('ARC GATE AHEAD!', 'gold');
    }
  }
  function gatePass(b, boosting) {
    const k = K();
    const charge = k.drifting ? Math.max(1, k.driftTier) : boosting ? 2 : 0;
    arc.g = null; arc.warned = false; arc.cd = 1.2;
    if (arc.mesh) arc.mesh.visible = false;
    if (!charge || b.state !== 'fight') {
      G.fx?.burst?.('fizz', k.worldPos, { count: 24 }); sfx('fizz');
      callout('NO CHARGE - DRIFT THROUGH!', 'danger');
      G.emit('b1:gate', { charge: 0, dealt: 0 });
      G.ui?.hint?.('b1nocharge', 'HOLD DRIFT AS YOU CROSS THE GATE', 'THE GATE ONLY FIRES WITH A DRIFT CHARGE OR A BOOST', 4.5);
      return;
    }
    const m = b.mem;
    rig.coreNode.getWorldPosition(V.a);
    const col = charge >= 3 ? 0xd890ff : charge === 2 ? 0xffc070 : 0x9ff8ff;
    for (let i = 0; i < charge + 1; i++) b.after(i * 0.07, () => { if (rig && arc.mesh) { rig.coreNode.getWorldPosition(V.c); G.fx?.lightning?.(i % 2 ? arc.capR : arc.capL, V.c, { color: col, width: 0.5 + charge * 0.15, life: 0.3, branches: 2 }); } }, true);
    G.fx?.burst?.('lightningStrike', arc.mid, { color: col });
    G.fx?.shockwave?.(k.worldPos, { color: col, radius: 14, dur: 0.4 });
    G.post?.flash?.('#7ff6ff', 0.16, 4); G.cam.shake(0.25); G.time.hitstop(50);
    sfx('thunder', { vol: 0.8 }); sfx('boltHit', { pitch: 0.8 });
    const dealt = G.combat.damageBoss(GATE_DMG[charge], { source: 'gate', flat: true, targetId: 'core', pos: V.a, tier: charge });
    b.addStagger(GATE_STAG[charge]);
    k.addFlux(5 + charge * 3, 'gate');
    const was = m.shortT > 0;
    m.shortT = Math.max(m.shortT, GATE_SHORT[charge]); m.ventsOpenT = Math.max(m.ventsOpenT, m.shortT);
    m.gates = (m.gates || 0) + 1;
    callout(charge >= 3 ? 'SUPERCONDUCT!' : 'OVERLOAD!', charge >= 3 ? 'perfect' : 'gold');
    if (!was) b.after(0.45, () => callout('ARMOR DOWN - FIRE!', 'break'), true);
    G.ui?.hint?.('b1short', 'SHORTED! ARMOR DOWN', 'RELEASE YOUR DRIFT NOW: VOLLEYS HIT THE OPEN VENTS', 4);
    G.emit('b1:gate', { charge, dealt });
  }
  function gateUpdate(b, dt) {
    const k = K(), m = b.mem;
    if (arc.g && G.gates.list().indexOf(arc.g) < 0) { arc.g = null; if (arc.mesh) arc.mesh.visible = false; }   // cleared by a phase change
    const can = b.state === 'fight' && b.enrage < 2 && !k.cometActive;
    if (!can) { if (arc.g) gateRemove(); return; }
    if (!arc.g) { arc.cd -= dt; if (arc.cd <= 0) { arc.cd = 1.5; gateSpawn(b); } return; }
    const Tr = T(), ahead = Tr.ds(k.s, arc.g.s);
    if (ahead < -4) { gateRemove('miss'); arc.cd = 1.0; return; }
    // the gate takes the colour of the charge you would dump into it
    const charge = k.drifting ? Math.max(1, k.driftTier) : k.boosting ? 2 : 0;
    if (charge) arc.col.set(G.cfg.tierColor[charge - 1]).multiplyScalar(1.7); else arc.col.setRGB(0.55, 0.85, 1.0);
    arc.curtainU.uCol.value.lerp(arc.col, Math.min(1, dt * 10));
    arc.curtainU.uA.value = charge ? 1.15 : 0.75;
    arc.curtainU.uTime.value = G.time.now;
    arc.zapT -= dt;
    if (arc.zapT <= 0) { arc.zapT = 0.07 + Math.random() * 0.06; G.fx?.lightning?.(arc.capL, arc.capR, { color: 0xbff8ff, width: 0.4, life: 0.12, branches: 1 }); }
    // coaching for the first gates: say "DRIFT" in time
    if (!arc.warned && ahead < 75 && ahead > 20) { arc.warned = true; if (!k.drifting && arc.n <= 4) callout('HOLD DRIFT THROUGH THE GATE!', 'info'); }
  }
  // shorted look: cyan crawl over the hull
  function shortFx(b, dt) {
    const m = b.mem; if (!rig) return;
    if (m.shortT > 0) {
      m.shortT -= dt;
      const kk = Math.min(1, m.shortT) * (0.75 + 0.25 * Math.sin(G.time.now * 30));
      rig.brass.emissive.lerp(SHORT_COL, kk * 0.6);
      arc.fxT -= dt;
      if (arc.fxT <= 0) {
        arc.fxT = 0.09;
        const ns = [rig.ventNodeL, rig.ventNodeR, rig.coreNode, rig.bodyNode, rig.head];
        ns[(Math.random() * ns.length) | 0].getWorldPosition(V.a); ns[(Math.random() * ns.length) | 0].getWorldPosition(V.b);
        V.b.x += (Math.random() - 0.5) * 8; V.b.y += (Math.random() - 0.5) * 6;
        G.fx?.lightning?.(V.a, V.b, { color: 0x9ff8ff, width: 0.6, life: 0.12, branches: 1 });
      }
    }
  }
  // standing still is not a strategy: a slow kart gets palmed every 2.6 s
  function stallCheck(b, dt) {
    const k = K(), m = b.mem;
    if (b.state !== 'fight' || k.frozen || k.wrecked || k.cometActive || b.staggered || b.invulnT > 0 || b.enrage >= 2) { m.slowT = 0; return; }
    if (Math.abs(k.speed) < 9) m.slowT += dt; else m.slowT = Math.max(0, m.slowT - dt * 2);
    m.duckCD -= dt;
    if (m.slowT > 2.2 && m.duckCD <= 0) {
      m.duckCD = 2.6;
      callout('KEEP MOVING!', 'danger');
      palmStrike(b, { d: k.d, wid: 10, noRamp: true });   // lead:'resolve' lands it where a slow / reversing kart will be
    }
  }

  // =================================================================
  // DEFINITION
  // =================================================================
  const def = {
    id: 1, name: 'BRASSHOLLOW', title: 'the Furnace Sumo', music: 'boss1',
    targetTime: 130,
    tips: [
      'His brass is <b>ARMORED</b>. <b>DRIFT through the ARC GATE</b> in each curve to short it out, then release: volleys hit the open vents.',
      'PALM RAKE leaves one lane open per slam: <b>steer through the gaps</b>. Stand still and he flattens you.',
      'VIOLET drifts <b>interrupt</b> purple cast bars. HOP (tap DRIFT) over shockwaves.',
    ],
    arena: {
      name: 'EMBER BOWL', sky: 'ember', palette: { base: '#16100d', line: '#33f6ff', edge: '#ff6a1a', accent: '#ffc93a' },
      shape: { type: 'stadium', straight: STR, radius: RAD }, width: 18, bankCurves: 8, lapGateS: 0,
      pads: [{ s: 30, lane: 0, len: 8 }, { s: 80, lane: 1, len: 8 }, { s: S_N0 + 30, lane: 0, len: 8 }, { s: S_N0 + 92, lane: 1, len: 8 }],
      ramps: [{ s: S_N0 + 60, len: 10, kick: 9 }], gaps: [{ s0: S_N0 + 73, s1: S_N0 + 81 }],
      itemRows: [15, S_N0 + 15], surface: 'basalt', fog: { color: '#2a0d05', near: 80, far: 420 },
      envTop: '#3a1a10', hemiSky: '#ffb080', sunDir: [-0.4, 0.8, 0.3],
    },
    buildScenery(group, track) {
      buildScenery(group, track);
      rams.build(group, rig.brass);
      buildGate(group); arc.g = null; buildPosts(group);
    },
    boss: {
      // 8500 (spec 7000): with Comet fixed at a flat 900 the bot still killed 7000 HP in 86-102 s against the 2:15 target
      hp: 11000, minWindup: 1.6, softEnrage: 225, hardEnrage: 270, staggerDur: 6, staggerDecayMult: 0.85, deathDur: 4.4, camFocusY: 14,
      attackNames: ['palm', 'vents', 'rake', 'stomp', 'bellows', 'piston', 'spill', 'oil', 'breath', 'palm2', 'heatwave'],
      attacks,
      create(b) {
        if (!rig) return;
        b.root = rig.root; b.rig = rig;
        b.mem = { ventsOpenT: 0, stomps: 0, coreHits: 0, coreHitT: -9, perm: [], shortT: 0, slowT: 0, duckCD: 0, gates: 0 };
        rig.dead = false; rig.standTarget = 0; rig.standK = 0;
        for (const o of rig.upper) o.visible = true;
        for (const a of rig.arms) { a.mode = 'rest'; a.palm.visible = true; }
      },
      targets(b) {
        if (!rig) return [];
        return [
          // brass armor: bolts on the hull x0.6 unless an ARC GATE has shorted him
          { id: 'body', node: rig.bodyNode, mult: 1.0, always: true, getMult: (bb) => bb.mem.shortT > 0 ? 1.0 : ARMOR },
          { id: 'ventL', node: rig.ventNodeL, mult: 1.5, weak: true, isExposed: (bb) => bb.mem.ventsOpenT > 0 || bb.staggered },
          { id: 'ventR', node: rig.ventNodeR, mult: 1.5, weak: true, isExposed: (bb) => bb.mem.ventsOpenT > 0 || bb.staggered },
          // armored crack in P2/P3 (targetable, ×0.75; ×1.25 while shorted), fully exposed when staggered (×2 via framework)
          { id: 'core', node: rig.coreNode, mult: 2.0, weak: true, isExposed: (bb) => bb.staggered || bb.phase >= 1, getMult: (bb) => bb.staggered ? 2.0 : bb.mem.shortT > 0 ? 1.4 : 0.75 },
        ];
      },
      onStart(b) {
        b.mem.stomps = 0; b.mem.coreHits = 0; b.mem.ventsOpenT = 0; b.mem.enrStompT = 6; b.mem.shortT = 0; b.mem.slowT = 0; b.mem.duckCD = 0; b.mem.gates = 0;
        gateRemove(); arc.cd = 2.5; arc.lane = 0; arc.n = 0; posts.list.length = 0;
        rams.reset(); G.rings.clear();
        if (rig) { rig.dead = false; for (const o of rig.upper) o.visible = true; for (const a of rig.arms) { a.mode = 'rest'; a.palm.visible = true; a.rod.visible = false; } rig.tremble = 0; rig.scenery.lavaU.uRise.value = 0; rig.scenery.lava.position.y = -1.7; }
      },
      onDamaged(b, dealt, o, t) {
        // P2 mechanic: three T3 volleys into the (cracked) core = 6 s stagger
        if (b.phase === 1 && o.source === 'bolt' && o.tier === 3 && t && t.id === 'core' && !b.staggered) {
          if (G.time.now - b.mem.coreHitT > 0.7) {
            b.mem.coreHitT = G.time.now; b.mem.coreHits++;
            callout('CORE CRACK ' + b.mem.coreHits + '/3', 'break');
            if (b.mem.coreHits >= 3) { b.mem.coreHits = 0; callout('ARMOR SHATTERED!', 'break'); b.startStagger(6, true); }
          }
        }
      },
      onStagger(b) {
        for (const a of rig.arms) returnArm(a); rig.inhale = 0; rig.inhaling = false; rams.reset(); posts.list.length = 0; sfx('steam');
        G.cam.lookAtBoss?.(0.15, 1.0);   // light touch: the core's stagger framing already yaws toward the boss
        b.after(0.7, () => { if (b.staggered) callout(K().flux >= 100 ? 'COMET THE CORE!' : 'HIT THE CORE!', 'break'); });
      },
      onStaggerEnd(b) { },
      onSoftEnrage(b) { b.mem.enrStompT = 3; },
      onHardEnrage(b) {
        // enrage is already 2 here, so breath's VENTING follow-up and every startStagger are suppressed (06_combat)
        G.tele.clear(); gateRemove(); b.mem.shortT = 0;
        if (b.staggered) b.endStagger(true);
        b.clearTimers();
        const Tr = T();
        b.startCast('MAGMA TIDE', 4, { final: true, blocking: true });
        // the wipe is a kept timer, not the cast's onComplete, so nothing (stagger, phase change, interrupt) can cancel it
        b.after(4, () => { if (b.state === 'fight') G.combat.wipe('MAGMA TIDE'); }, true);
        tele({ shape: 'band', kind: 'lava', s0: 0, s1: Tr.L - 0.05, windup: 4, exact: true, visualOnly: true, src: 'tide' });
        b.mem.tide = 0.0001;
        callout('MAGMA TIDE', 'enrage'); sfx('enrage');
      },
      onWipe(b) { if (rig) rig.laugh = 2; },
      onDeath(b) {
        rig.dead = true; rig.tremble = 1; rams.reset(); G.rings.clear(); gateRemove(); b.mem.shortT = 0;
        for (const a of rig.arms) returnArm(a);
        b.mem.exploded = false;
        // real cinematic: framed on the boss from the kart's side, then a wide pull-out when the furnace blows
        const kp = K().worldPos; deathCam.a0 = Math.atan2(kp.z, kp.x); deathCam.boss = b;
        G.cam.setCinematic(deathCam);
      },
      // real-time death sequence
      death(b, t, rdt) {
        if (!rig) return;
        const sc = rig.scenery;
        if (t < 1.0) {
          rig.tremble = 1;
          if (Math.random() < 0.5) { V.a.set((Math.random() - 0.5) * 14, PED_TOP + 4 + Math.random() * 14, (Math.random() - 0.5) * 10).applyAxisAngle(UPV, rig.yaw); G.fx?.burst?.('explosion', V.a, { count: 14, scale: 0.6 }); G.fx?.burst?.('steam', V.a, { count: 6, scale: 2 }); }
        } else if (!b.mem.exploded) {
          b.mem.exploded = true; rig.tremble = 0;
          G.fx?.shards?.(rig.upper[0], 400, 0xb08a3a, { speed: 1.5, heat: 1, size: 1.1, life: 3.2 });
          rig.coreNode.getWorldPosition(V.a);
          G.fx?.burst?.('explosion', V.a, { count: 200, scale: 2.4 });
          G.fx?.burst?.('comet', V.a, { count: 160, color: 0xff8a1f, scale: 1.4 });
          G.fx?.shockwave?.(V.a, { color: 0xffb060, radius: 120, dur: 1.2, thick: 0.04 });
          // keep the payoff visible: a modest warm flash, shards + shockwave carry it, plus 0.4 s of slow-mo
          G.fx?.flash?.(0xfff0c0, 0.3, 0.5); G.post?.bloomPulse?.(0.6, 0.7); G.post?.shockAt?.(V.a, 1.2); G.time.slowmo(0.35, 0.4);
          G.cam.shake(1.0); sfx('explosion', { big: true });
          for (const o of rig.upper) o.visible = false;
          for (const a of rig.arms) { a.palm.visible = false; a.rod.visible = false; a.sh.visible = false; }
        } else {
          const u = clamp((t - 1.0) / 2.0, 0, 1);
          const TU = T().uniforms; if (TU) { TU.uCool.value = sm(u); TU.uEnrage.value *= 0.95; }
          if (Math.random() < 0.4) { V.a.set((Math.random() - 0.5) * 10, PED_TOP + 3 + Math.random() * 4, (Math.random() - 0.5) * 10); G.fx?.burst?.('dust', V.a, { count: 4, scale: 3 }); }
          if (sc) sc.rune.material.color.setRGB(3 * (1 - u), 0.8 * (1 - u), 0.1 * (1 - u));
        }
      },
      update(b, dt) {
        animate(b, dt);
        rams.update(dt);
        if (!rig) return;
        shortFx(b, dt);
        gateUpdate(b, dt);
        stallCheck(b, dt);
        updatePosts(dt);
        rig.inhale = rig.inhaling ? Math.min(1, (b.cast?.t || 0) / (b.cast?.dur || BELLOWS_DUR)) : rig.inhale * Math.max(0, 1 - dt * 3);
        if (b.state !== 'fight') return;
        // soft enrage: extra stomps every 6 s
        if (b.enrage === 1 && !b.staggered && b.invulnT <= 0) { b.mem.enrStompT -= dt; if (b.mem.enrStompT <= 0) { b.mem.enrStompT = 6; attacks.stomp(b); } }
        // magma tide: lava visibly rises over the track
        if (b.mem.tide > 0) { b.mem.tide = Math.min(1, b.mem.tide + dt / 4); rig.scenery.lavaU.uRise.value = 0.35 + b.mem.tide; rig.scenery.lava.position.y = -1.7 + b.mem.tide * 3.2; }
      },
      phases: [
        { name: 'WARM-UP BOUT', at: 1.0, loop: 20, jitter: 0.5,
          rotation: [{ t: 0, a: 'palm' }, { t: 4, a: 'vents' }, { t: 9, a: 'rake' }, { t: 14, a: 'stomp' }, { t: 17, a: 'bellows', cast: true }],
          enter(b) { b.mem.stomps = 0; rig.standTarget = 0; setupPermanent(b); } },
        { name: 'STOKE THE FURNACE', at: 0.60, loop: 24, jitter: 0.5,
          rotation: [{ t: 0, a: 'piston' }, { t: 4, a: 'palm' }, { t: 7, a: 'spill' }, { t: 12, a: 'oil' }, { t: 15.5, a: 'rake' }, { t: 20, a: 'bellows', cast: true }],
          enter(b, o) {
            rig.standTarget = 0; b.mem.coreHits = 0;
            setupPermanent(b);
            if (!o || !o.retry) {
              // set piece: both palms slam the pedestal, the inner lava floods the far curve
              rig.stompT = 0; sfx('roar', { pitch: 0.75 }); callout('THE LAVA RISES!', 'danger'); G.cam.lookAtBoss?.(0.7, 2.6);
              b.after(0.6, () => { G.fx?.shockwave?.(V.a.set(0, PED_TOP, 0), { color: 0xff6a1a, radius: 60, dur: 0.8 }); G.cam.shake(0.5);
                for (let i = 0; i < 8; i++) { T().toWorld(lerp(NORTH_CURVE[0], NORTH_CURVE[1], i / 7), -7, 0.3, V.b); G.fx?.burst?.('lavaSplash', V.b, { count: 40, scale: 1.8 }); } }, true);
            }
          },
          onLoop(b, n) { if (n % 2 === 0 && !b.staggered) { callout('FURNACE VENT!', 'break'); b.startStagger(5, true); } } },
        { name: 'OVERHEAT', at: 0.25, loop: 22, jitter: 0.4,
          rotation: [{ t: 0, a: 'breath' }, { t: 6, a: 'stomp' }, { t: 9, a: 'palm2' }, { t: 14, a: 'heatwave', cast: true }, { t: 17, a: 'stomp' }],
          enter(b, o) {
            rig.standTarget = 1;
            setupPermanent(b);
            if (!o || !o.retry) { sfx('roar', { pitch: 0.6 }); callout('OVERHEAT!', 'danger'); G.cam.lookAtBoss?.(0.85, 3.2); }
          } },
      ],
      idle(b, dt) { },
      dispose(b) { rams.reset(); gateRemove(); },
    },
  };
  G.bosses[0] = def;
}
