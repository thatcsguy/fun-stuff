// =============================================================================
//  §17b  Menus — title hero scene (giant turning hourglass, void sky with a black
//        hole, three floating thrones), Raid Map (3 floating platform nodes joined
//        by a light path, lock state, best time/rank per difficulty, talent
//        selector), talent pick after a kill.
//
//  API (consumed by 18-game.js):
//    TitleScene.build() -> arena-like object { group, update(dt), dispose(), setMode('title'|'map'),
//                                              cameraOverride(dt, cam), exposure, bloom, grade }
//    Game.showMap()              Raid Map over the title scene (builds it if needed)
//    Game.showTalentPick(tier)   1-of-2 pick after boss `tier` (0 or 1), then the Raid Map
//    makeVoidSky(opts)           reusable void sky dome with a black hole (Boss 3 can use it)
// =============================================================================

// ---------------------------------------------------------------- void sky + black hole
const VOID_SKY_FS = /* glsl */`
  uniform float uTime; uniform vec3 uBH; uniform float uBHSize; uniform float uOctaves; uniform vec3 uTint; uniform float uStreak; uniform vec3 uFocus;
  varying vec3 vDir;
  ${GLSL_NOISE}
  float star(vec3 d, float scale, float thr){
    vec3 q = d * scale; vec3 id = floor(q); float h = hash13(id);
    if (h < thr) return 0.0;
    vec3 sp = hash33(id + 1.3);
    float r = length(fract(q) - sp);
    float tw = 0.65 + 0.35 * sin(uTime * (1.0 + h * 4.0) + h * 30.0);
    return smoothstep(0.09, 0.0, r) * tw * (h - thr) / (1.0 - thr);
  }
  void main(){
    vec3 d = normalize(vDir);
    int oct = int(uOctaves + 0.5);
    // gravitational bend: pull the view direction toward the hole before sampling the background
    float ca = dot(d, uBH); float ang = acos(clamp(ca, -1.0, 1.0));
    vec3 side = normalize(d - uBH * ca + 1e-5);
    float bend = uBHSize * uBHSize * 1.6 / max(ang, uBHSize * 0.9);
    vec3 db = normalize(cos(bend) * d - sin(bend) * side);
    // deep space: indigo → black, violet/teal nebula
    vec3 col = mix(vec3(0.004, 0.003, 0.012), vec3(0.018, 0.010, 0.040), smoothstep(-0.4, 0.6, db.y));
    float n1 = fbm3(db * 2.2 + vec3(0.0, uTime * 0.004, 0.0), oct);
    float n2 = fbm3(db * 4.5 + vec3(n1 * 1.6, 3.1, -uTime * 0.006), oct);
    float neb = smoothstep(0.42, 0.85, n1 * 0.6 + n2 * 0.55);
    col += mix(vec3(0.10, 0.025, 0.22), vec3(0.02, 0.16, 0.20), smoothstep(0.3, 0.8, n2)) * neb * 0.9 * uTint;
    col += vec3(0.25, 0.10, 0.45) * pow(neb, 3.0) * 0.6;
    // dust lanes
    col *= 1.0 - 0.6 * smoothstep(0.55, 0.8, fbm3(db * 7.0 + 11.0, 2)) * neb;
    // stars (the lensed sky makes them arc around the hole)
    float s = star(db, 140.0, 0.965) + star(db, 300.0, 0.985) * 0.7 + star(db, 60.0, 0.992) * 1.6;
    if (uStreak > 0.01) for (int i = 1; i < 6; i++) { vec3 dd = normalize(db + (db - uFocus) * float(i) * 0.03 * uStreak); s += star(dd, 140.0, 0.965) * (1.0 - float(i) / 6.0) * uStreak; }
    col += vec3(0.85, 0.9, 1.0) * s * 1.4;
    // ---- the black hole: shadow, photon ring, tilted accretion disk with Doppler beaming
    vec3 up0 = abs(uBH.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 bx = normalize(cross(up0, uBH)); vec3 by = cross(uBH, bx);
    vec2 p = vec2(dot(d, bx), dot(d, by)) / uBHSize;            // hole-local coords (1 = shadow radius)
    float r = length(p);
    float tilt = 0.22;                                            // disk seen nearly edge-on
    float ca2 = cos(-0.32), sa2 = sin(-0.32);
    vec2 pr = vec2(ca2 * p.x - sa2 * p.y, sa2 * p.x + ca2 * p.y);
    vec2 pd = vec2(pr.x, pr.y / tilt);
    float rd = length(pd);
    float th = atan(pd.y, pd.x);
    float swirl = fbm(vec2(rd * 3.0 - uTime * 0.35, th * 2.0 + rd * 2.0 - uTime * 0.6), 3);
    float disk = smoothstep(1.35, 1.7, rd) * (1.0 - smoothstep(3.2, 5.6, rd)) * (0.45 + 0.9 * swirl);
    float dopp = 0.55 + 0.75 * smoothstep(-1.0, 1.0, pr.x);                // approaching side brighter
    vec3 hot = mix(vec3(1.0, 0.45, 0.12), vec3(1.4, 1.15, 0.85), smoothstep(3.5, 1.6, rd));
    float front = step(0.0, pr.y);                                         // near half passes in front of the shadow
    // the far side of the disk, lensed over the top and under the bottom of the shadow
    float halo = smoothstep(1.02, 1.12, r) * (1.0 - smoothstep(1.25, 1.9, r)) * (0.55 + 0.6 * fbm(vec2(atan(p.y, p.x) * 3.0 - uTime * 0.5, r * 4.0), 2));
    float ring = exp(-pow((r - 1.04) * 22.0, 2.0));
    float shadow = 1.0 - smoothstep(0.92, 1.0, r);
    vec3 bh = vec3(0.0);
    bh += hot * halo * 1.1 * (0.7 + 0.5 * smoothstep(-1.0, 1.0, p.x));
    bh += vec3(1.6, 1.25, 0.9) * ring * 1.3;
    col = mix(col, vec3(0.0), shadow);
    col += bh;
    col += hot * disk * dopp * mix(1.0 - shadow, 1.0, front) * 1.2;
    col += vec3(0.35, 0.18, 0.5) * exp(-r * 0.55) * 0.12;                   // faint glow
    gl_FragColor = vec4(col, 1.0);
  }`;

/** void sky dome; bhDir: unit vector to the black hole; size: angular radius of its shadow (rad) */
function makeVoidSky(opts) {
  opts = opts || {};
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uTime, uOctaves: GLOBAL_U.uOctaves, uStreak: GLOBAL_U.uStreak, uFocus: { value: new THREE.Vector3(0, 0, -1) },
      uBH: { value: (opts.bhDir || new THREE.Vector3(0.35, 0.32, -0.88)).clone().normalize() }, uBHSize: { value: opts.size || 0.075 },
      uTint: { value: new THREE.Color(opts.tint != null ? opts.tint : 0xffffff) } },
    vertexShader: SKY_VS, fragmentShader: VOID_SKY_FS, side: THREE.BackSide, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
  m.renderOrder = -10; m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- hourglass glass (fresnel)
const GLASS_VS = /* glsl */`
  varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vL = position;
    vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const GLASS_FS = /* glsl */`
  uniform float uTime; uniform vec3 uColA; uniform vec3 uColB;
  varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL;
  ${GLSL_NOISE}
  void main(){
    vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
    float f = pow(1.0 - abs(dot(n, normalize(vV))), 2.4);
    float az = atan(vL.x, vL.z);
    float streak = smoothstep(0.92, 1.0, sin(az * 1.0 + 0.6)) * 0.8 + smoothstep(0.985, 1.0, sin(az * 1.0 + 2.4)) * 0.6;   // vertical specular streaks
    float etch = smoothstep(0.82, 0.95, abs(sin(vL.y * 9.0 + sin(az * 6.0) * 0.6))) * 0.08;                                // engraved rings
    float caust = vnoise(vec2(az * 3.0, vL.y * 2.0 - uTime * 0.2));
    vec3 c = mix(uColA, uColB, smoothstep(-1.5, 2.0, vL.y) * 0.6 + caust * 0.25) * (f * 0.75 + 0.02 + etch) + vec3(1.0, 0.95, 0.85) * streak * (0.2 + f * 0.6);
    gl_FragColor = vec4(c, 1.0);
  }`;

// sand stream / glitter points
const SAND_VS = /* glsl */`
  attribute float aSize; attribute float aGlow; varying float vGlow;
  uniform float uScale;
  void main(){ vGlow = aGlow; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const SAND_FS = /* glsl */`
  uniform vec3 uColor; varying float vGlow;
  void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard; float a = smoothstep(0.25, 0.0, d); gl_FragColor = vec4(uColor * (0.6 + vGlow) * a, a); }`;

// ---------------------------------------------------------------- title scene
const TitleScene = {
  build() {
    const group = new THREE.Group(); scene.add(group);
    const add = (o) => { group.add(o); return o; };
    const disposables = [];
    // sky
    const bhDir = new THREE.Vector3(-0.304, 0.174, -0.937).normalize();
    const sky = add(makeVoidSky({ bhDir, size: 0.085 }));
    // light: cold key from the hole's side + warm sand glow + teal rim
    add(new THREE.HemisphereLight(0x6a5aa8, 0x0a0614, 0.55));
    const key = add(new THREE.DirectionalLight(0xffe0b0, 1.6)); key.position.set(12, 14, -10);
    const rim = add(new THREE.DirectionalLight(0x5ff2ff, 1.4)); rim.position.set(-14, 6, -12);
    const fill = add(new THREE.DirectionalLight(0xb08cff, 0.5)); fill.position.set(-6, 3, 14);
    const sandLight = add(new THREE.PointLight(0xffc860, 18, 12, 1.6)); sandLight.position.set(0, -1.2, 0);

    // ---- the hourglass (5.6 m tall), centred at the origin
    const hg = add(new THREE.Group());
    const prof = [[0.09, 0.0], [0.12, 0.12], [0.24, 0.3], [0.55, 0.55], [0.92, 0.9], [1.17, 1.3], [1.24, 1.65], [1.16, 2.0], [0.9, 2.3], [0.62, 2.45], [0.5, 2.5]];
    const pts = [];
    for (let i = prof.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(prof[i][0], -prof[i][1]));
    for (let i = 1; i < prof.length; i++) pts.push(new THREE.Vector2(prof[i][0], prof[i][1]));
    const glassG = new THREE.LatheGeometry(pts, 64);
    const glassMat = new THREE.ShaderMaterial({ uniforms: { uTime: GLOBAL_U.uTime, uColA: { value: new THREE.Color(0.35, 0.85, 1.0) }, uColB: { value: new THREE.Color(1.0, 0.8, 0.45) } },
      vertexShader: GLASS_VS, fragmentShader: GLASS_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(glassG, glassMat); glass.renderOrder = 5; hg.add(glass);
    disposables.push(glassG, glassMat);
    // brass frame
    const brass = makeArcane({ color: 0xa8742e, roughness: 0.28, metalness: 1.0 }, { rim: 0.35, rimColor: 0xffd08a, key: 'hgBrass' });
    const darkM = makeArcane({ color: 0x1b1626, roughness: 0.45, metalness: 0.6, flatShading: true }, { rim: 0.6, rimColor: 0x8a6cff, key: 'hgDark' });
    const gemM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 2.6) });
    disposables.push(brass, darkM, gemM);
    const mk = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); hg.add(m); disposables.push(geo); return m; };
    for (const s of [1, -1]) {
      mk(new THREE.CylinderGeometry(1.75, 1.85, 0.22, 48), darkM, 0, s * 2.62, 0);
      mk(new THREE.CylinderGeometry(1.62, 1.62, 0.14, 48), brass, 0, s * 2.8, 0);
      mk(new THREE.CylinderGeometry(1.1, 1.62, 0.18, 48), brass, 0, s * 2.95, 0);
      mk(new THREE.TorusGeometry(1.8, 0.06, 8, 64), brass, 0, s * 2.62, 0, Math.PI / 2);
      mk(new THREE.SphereGeometry(0.28, 20, 12), brass, 0, s * 3.12, 0);
      mk(new THREE.OctahedronGeometry(0.16, 0), gemM, 0, s * 3.45, 0);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; mk(new THREE.OctahedronGeometry(0.09, 0), gemM, Math.sin(a) * 1.78, s * 2.62, Math.cos(a) * 1.78); }
    }
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * TAU + 0.3, x = Math.sin(a) * 1.5, z = Math.cos(a) * 1.5;
      // twisted pillar: stacked rotated prisms
      for (let j = 0; j < 14; j++) mk(new THREE.CylinderGeometry(0.075, 0.075, 0.38, 4), brass, x, -2.45 + 0.18 + j * 0.37, z, 0, j * 0.45, 0);
      mk(new THREE.SphereGeometry(0.13, 12, 8), brass, x, 0, z);
      mk(new THREE.ConeGeometry(0.12, 0.4, 6), brass, x, 3.0, z);
      mk(new THREE.ConeGeometry(0.12, 0.4, 6), brass, x, -3.0, z, Math.PI);
    }
    // sand: an emptying funnel above, a growing dune below
    const sandM = makeArcane({ color: 0xe9b764, roughness: 0.9, metalness: 0.0, emissive: 0xff9a2a, emissiveIntensity: 0.55 }, { rim: 0.4, rimColor: 0xffe2a0, key: 'hgSand' });
    disposables.push(sandM);
    const topSand = mk(new THREE.ConeGeometry(1.0, 1.0, 48, 1, false), sandM, 0, 0.95, 0, Math.PI);
    const topCap = mk(new THREE.CircleGeometry(1.0, 48), sandM, 0, 1.45, 0, -Math.PI / 2);
    const botSand = mk(new THREE.ConeGeometry(1.15, 1.0, 48, 1, false), sandM, 0, -2.0, 0);
    // falling sand stream (points) + glitter swirling around the glass
    const NS = 260, NG = 700;
    const sandG = new THREE.BufferGeometry();
    const sp = new Float32Array(NS * 3), ss = new Float32Array(NS), sg = new Float32Array(NS);
    const sandT = new Float32Array(NS), sandO = new Float32Array(NS * 2);
    for (let i = 0; i < NS; i++) { sandT[i] = Math.random(); sandO[i * 2] = (Math.random() - 0.5) * 0.06; sandO[i * 2 + 1] = (Math.random() - 0.5) * 0.06; ss[i] = 0.035 + Math.random() * 0.045; sg[i] = Math.random() < 0.12 ? 1.6 : 0.4; }
    sandG.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sandG.setAttribute('aSize', new THREE.BufferAttribute(ss, 1)); sandG.setAttribute('aGlow', new THREE.BufferAttribute(sg, 1));
    const ptScale = { value: 300 };
    const sandPM = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(1.6, 1.05, 0.45) }, uScale: ptScale }, vertexShader: SAND_VS, fragmentShader: SAND_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sandPts = new THREE.Points(sandG, sandPM); sandPts.frustumCulled = false; hg.add(sandPts);
    const glG = new THREE.BufferGeometry();
    const gp = new Float32Array(NG * 3), gs = new Float32Array(NG), gg = new Float32Array(NG), gA = new Float32Array(NG * 4);
    for (let i = 0; i < NG; i++) {
      gA[i * 4] = Math.random() * TAU; gA[i * 4 + 1] = 2.2 + Math.random() * 6.5; gA[i * 4 + 2] = (Math.random() - 0.5) * 9; gA[i * 4 + 3] = (0.05 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1);
      gs[i] = 0.03 + Math.random() * 0.07; gg[i] = Math.random() < 0.1 ? 1.4 : 0.2 + Math.random() * 0.4;
    }
    glG.setAttribute('position', new THREE.BufferAttribute(gp, 3)); glG.setAttribute('aSize', new THREE.BufferAttribute(gs, 1)); glG.setAttribute('aGlow', new THREE.BufferAttribute(gg, 1));
    const glPM = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(0.55, 0.95, 1.2) }, uScale: ptScale }, vertexShader: SAND_VS, fragmentShader: SAND_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const glitter = add(new THREE.Points(glG, glPM)); glitter.frustumCulled = false;
    disposables.push(sandG, sandPM, glG, glPM);
    // a soft halo behind the glass
    const haloMat = new THREE.SpriteMaterial({ map: makeRadialTexture(128, [[0, 'rgba(255,214,140,0.28)'], [0.35, 'rgba(255,170,80,0.08)'], [1, 'rgba(120,60,200,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const halo = new THREE.Sprite(haloMat); halo.scale.set(10, 10, 1); halo.position.set(0, 0, -1.5); halo.renderOrder = 1; hg.add(halo);
    disposables.push(haloMat.map, haloMat);

    // ---- three throne silhouettes floating behind (forge · tide · void)
    const thrones = [];
    const throneDefs = [
      { pos: [-24, 5, -42], col: 0xff6a20, rot: 0.45 },
      { pos: [0, 12, -58], col: 0x4fd8ff, rot: 0 },
      { pos: [24, 5, -42], col: 0xa070ff, rot: -0.45 },
    ];
    const throneMats = [];
    for (const d of throneDefs) {
      const m = makeArcane({ color: 0x0c0a12, roughness: 0.7, metalness: 0.3, flatShading: true }, { rim: 1.4, rimColor: d.col, key: 'throne' + d.col });
      throneMats.push(m); disposables.push(m);
      const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(d.col).multiplyScalar(2.2) }); disposables.push(glowM);
      const t = new THREE.Group(); t.position.set(...d.pos); t.rotation.y = d.rot; add(t);
      const b = (w, h, dd, x, y, z, mat, rx, rz) => { const g = new THREE.BoxGeometry(w, h, dd); disposables.push(g); const me = new THREE.Mesh(g, mat || m); me.position.set(x, y, z); me.rotation.set(rx || 0, 0, rz || 0); t.add(me); return me; };
      b(5, 1.2, 4, 0, 0, 0); b(5.6, 0.4, 4.4, 0, 0.8, 0);                       // seat
      b(4.6, 9, 0.8, 0, 5.2, -1.8, m, -0.06);                                    // back
      for (const s of [1, -1]) { b(0.9, 2.2, 4, s * 2.7, 1.6, 0); b(0.6, 11.5, 0.6, s * 2.6, 5.6, -2.0, m, -0.06, s * -0.05); b(0.4, 2.6, 0.4, s * 2.6, 12.3, -2.4, m, 0, s * 0.2); }
      for (let k = -2; k <= 2; k++) b(0.32, 2.8 - Math.abs(k) * 0.5, 0.3, k * 0.9, 10.8 + (2 - Math.abs(k)) * 0.4, -2.2, m, -0.1, k * 0.12);
      b(0.9, 0.9, 0.2, 0, 8.4, -1.35, glowM).rotation.z = Math.PI / 4;           // sigil
      // the rock it floats on
      const rg = new THREE.DodecahedronGeometry(3.6, 0); disposables.push(rg);
      const rock = new THREE.Mesh(rg, m); rock.scale.set(1.5, 0.75, 1.3); rock.position.set(0, -2.6, 0); t.add(rock);
      for (let k = 0; k < 4; k++) { const sg2 = new THREE.DodecahedronGeometry(0.6 + k * 0.25, 0); disposables.push(sg2); const sh = new THREE.Mesh(sg2, m); sh.position.set(Math.sin(k * 1.9) * 5, -4 - k * 1.2, Math.cos(k * 1.9) * 3); t.add(sh); }
      thrones.push({ g: t, base: t.position.clone(), ph: thrones.length * 2.1 });
    }

    // ---- Raid Map platforms + light path (only visible in map mode)
    const mapG = add(new THREE.Group()); mapG.visible = false;
    const nodeCols = [0xff7a2a, 0x4fd8ff, 0xa070ff];
    const nodes = [];
    for (let i = 0; i < 3; i++) {
      const n = new THREE.Group(); mapG.add(n);
      const topM = makeArcane({ color: 0x1a1622, roughness: 0.4, metalness: 0.5, flatShading: true }, { rim: 0.8, rimColor: nodeCols[i], key: 'mapTop' + i });
      const rimM = new THREE.MeshBasicMaterial({ color: new THREE.Color(nodeCols[i]).multiplyScalar(2.0) });
      const rockM = makeArcane({ color: 0x0d0b12, roughness: 0.9, metalness: 0.1, flatShading: true }, { rim: 0.6, rimColor: nodeCols[i], key: 'mapRock' + i });
      disposables.push(topM, rimM, rockM);
      const g1 = new THREE.CylinderGeometry(1.6, 1.45, 0.35, 6), g2 = new THREE.TorusGeometry(1.62, 0.05, 6, 6), g3 = new THREE.ConeGeometry(1.4, 2.6, 6), g4 = new THREE.OctahedronGeometry(0.42, 0);
      disposables.push(g1, g2, g3, g4);
      const top = new THREE.Mesh(g1, topM); n.add(top);
      const ring = new THREE.Mesh(g2, rimM); ring.rotation.x = Math.PI / 2; ring.position.y = 0.18; n.add(ring);
      const under = new THREE.Mesh(g3, rockM); under.rotation.x = Math.PI; under.position.y = -1.45; n.add(under);
      const gem = new THREE.Mesh(g4, rimM); gem.position.y = 1.2; n.add(gem);
      nodes.push({ g: n, top, ring, gem, topM, rimM, rockM, col: nodeCols[i], pos: new THREE.Vector3(), scr: new THREE.Vector3() });
    }
    const pathMat = makeBeamMaterial({ color: 0xffd890, intensity: 1.6, len: 12, scroll: 1.2, soft: 0.5 });
    pathMat.side = THREE.DoubleSide; disposables.push(pathMat);
    let pathMesh = null; const pathKey = new Float32Array(9).fill(1e9);   // last node positions the path was built for

    const arena = {
      key: 'title', group, radius: 40, sky, exposure: 1.0, bloom: 0.9,
      grade: { lift: [0.0, 0.0, 0.02], gain: [1.0, 0.98, 1.06], gamma: [1, 1, 1], sat: 1.05 },
      spawn: { x: 0, z: 0 },
      mode: 'title', modeT: 1, nodes, t: 0, sandK: 0,
      camFrom: { p: new THREE.Vector3(), l: new THREE.Vector3() }, camTo: { p: new THREE.Vector3(), l: new THREE.Vector3() },
      lastAspect: 0,
      setMode(m) {
        if (m === this.mode) return;
        this.camFrom.p.copy(camera.position); this.camFrom.l.copy(this._look || _v1.set(0, 0, 0));
        this.mode = m; this.modeT = 0; mapG.visible = m === 'map';
      },
      /** platform layout in camera space so each node lands at a fixed screen spot on any aspect ratio */
      layoutMap(cam) {
        const land = cam.aspect >= 1.05;
        const ndc = land ? [[-0.58, 0.18], [0, 0.26], [0.58, 0.18]] : [[-0.42, 0.52], [-0.42, 0.02], [-0.42, -0.48]];
        const depth = land ? 16 : 18;
        for (let i = 0; i < 3; i++) {
          _v1.set(ndc[i][0], ndc[i][1], 0.5).unproject(cam).sub(cam.position).normalize();
          const along = depth / Math.max(0.2, _v1.dot(_v2.set(0, 0, -1).applyQuaternion(cam.quaternion)));
          nodes[i].pos.copy(cam.position).addScaledVector(_v1, along);
        }
        // light path: a gentle arcing tube through the three platform tops
        let moved = false;                                   // numeric compare (this runs every frame on the map: no key strings)
        for (let i = 0; i < 3; i++) { const q = nodes[i].pos; if (Math.abs(q.x - pathKey[i * 3]) > 0.05 || Math.abs(q.y - pathKey[i * 3 + 1]) > 0.05 || Math.abs(q.z - pathKey[i * 3 + 2]) > 0.05) moved = true; }
        if (moved) {
          for (let i = 0; i < 3; i++) { pathKey[i * 3] = nodes[i].pos.x; pathKey[i * 3 + 1] = nodes[i].pos.y; pathKey[i * 3 + 2] = nodes[i].pos.z; }
          if (pathMesh) { mapG.remove(pathMesh); pathMesh.geometry.dispose(); }
          const P = [];
          for (let i = 0; i < 3; i++) {
            P.push(nodes[i].pos.clone().add(_v3.set(0, 0.25, 0)));
            if (i < 2) P.push(nodes[i].pos.clone().lerp(nodes[i + 1].pos, 0.5).add(_v3.set(0, 1.0, 0)));
          }
          const curve = new THREE.CatmullRomCurve3(P);
          pathMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.07, 6, false), pathMat);
          pathMesh.renderOrder = 4; mapG.add(pathMesh);
        }
      },
      cameraTarget(cam, out) {
        const land = cam.aspect >= 1.05, t = this.t;
        if (this.mode === 'title') {
          const a = 0.35 + Math.sin(t * 0.07) * 0.32;
          const dist = land ? 13.5 : 19;
          out.p.set(Math.sin(a) * dist, 0.9 + Math.sin(t * 0.11) * 0.35, Math.cos(a) * dist);
          // landscape: hourglass sits at ~68% of the width (menu on the left); portrait: centred between logo and buttons
          if (land) { _v1.set(Math.cos(a), 0, -Math.sin(a)); out.l.set(0, 0.25, 0).addScaledVector(_v1, -3.2); }
          else out.l.set(0, -1.6, 0);
        } else {
          out.p.set(0, 9, 13); out.l.set(0, 2.2, -14);
        }
      },
      cameraOverride(dt, cam) {
        const fov = cam.aspect >= 1.05 ? 46 : 58;
        if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
        this.cameraTarget(cam, this.camTo);
        this.modeT = Math.min(1, this.modeT + dt / 1.4);
        const k = smooth01(this.modeT);
        if (k < 1) { cam.position.lerpVectors(this.camFrom.p, this.camTo.p, k); this._look = (this._look || new THREE.Vector3()).lerpVectors(this.camFrom.l, this.camTo.l, k); }
        else { cam.position.copy(this.camTo.p); this._look = (this._look || new THREE.Vector3()).copy(this.camTo.l); }
        cam.lookAt(this._look);
        cam.updateMatrixWorld();
        if (this.mode === 'map' && k >= 1) this.layoutMap(cam);
        else if (this.mode === 'map') { const c = cam.position.clone(); cam.position.copy(this.camTo.p); cam.lookAt(this.camTo.l); cam.updateMatrixWorld(); this.layoutMap(cam); cam.position.copy(c); cam.lookAt(this._look); cam.updateMatrixWorld(); }
        // black-hole lensing follows the hole on screen
        _v1.copy(bhDir).multiplyScalar(300).add(cam.position).project(cam);
        if (_v1.z < 1) { Post.U.uBH.value.set(_v1.x * 0.5 + 0.5, _v1.y * 0.5 + 0.5); Post.lensStr = 0.0016; Post.lensCore = 0.0; } else Post.lensStr = 0;
      },
      update(dt) {
        this.t += dt; const t = this.t;
        // hourglass: slow turn + bob; sand drains over 60 s, then the glass flips
        hg.rotation.y = t * 0.12; hg.position.y = Math.sin(t * 0.5) * 0.12; hg.rotation.z = Math.sin(t * 0.23) * 0.03;
        const cyc = (t % 60) / 60;
        const kTop = 1 - cyc;
        topSand.scale.set(0.35 + 0.65 * kTop, Math.max(0.02, kTop), 0.35 + 0.65 * kTop); topSand.position.y = 0.45 + 0.5 * kTop;
        topCap.scale.setScalar(0.35 + 0.65 * kTop); topCap.position.y = 0.45 + 1.0 * kTop;
        const kBot = 0.3 + 0.7 * cyc; botSand.scale.set(0.6 + 0.4 * kBot, kBot, 0.6 + 0.4 * kBot); botSand.position.y = -2.5 + 0.5 * kBot;
        const pileTop = -2.5 + kBot;
        for (let i = 0; i < NS; i++) {
          sandT[i] += dt * (0.9 + (i % 7) * 0.05); if (sandT[i] > 1) sandT[i] -= 1;
          const u = sandT[i], y = 0.15 - u * (0.15 - pileTop);
          const spread = u > 0.92 ? (u - 0.92) * 6 : 0;
          sp[i * 3] = sandO[i * 2] * (1 + spread * 8); sp[i * 3 + 1] = y; sp[i * 3 + 2] = sandO[i * 2 + 1] * (1 + spread * 8);
        }
        sandG.attributes.position.needsUpdate = true;
        for (let i = 0; i < NG; i++) {
          gA[i * 4] += gA[i * 4 + 3] * dt;
          const a = gA[i * 4], r = gA[i * 4 + 1];
          gp[i * 3] = Math.sin(a) * r; gp[i * 3 + 1] = gA[i * 4 + 2] + Math.sin(t * 0.4 + i) * 0.3; gp[i * 3 + 2] = Math.cos(a) * r;
        }
        glG.attributes.position.needsUpdate = true;
        ptScale.value = renderer.domElement.height;
        sandLight.intensity = 8 + Math.sin(t * 3.1) * 1.5;
        sandM.emissiveIntensity = 0.35 + 0.1 * Math.sin(t * 2.0);
        for (const th of thrones) { th.g.position.y = th.base.y + Math.sin(t * 0.35 + th.ph) * 0.8; th.g.rotation.z = Math.sin(t * 0.2 + th.ph) * 0.02; }
        if (mapG.visible) {
          for (let i = 0; i < 3; i++) {
            const n = nodes[i];
            n.g.position.copy(n.pos); n.g.position.y += Math.sin(t * 0.8 + i * 1.7) * 0.15;
            n.g.rotation.y = t * 0.15 + i;
            n.gem.rotation.y = t * 1.2; n.gem.position.y = 1.2 + Math.sin(t * 2 + i) * 0.1;
            const unl = Save.isUnlocked(i);
            n.gem.visible = unl; n.rimM.color.set(unl ? n.col : 0x2a2a34).multiplyScalar(unl ? 2.0 : 1);
          }
          if (pathMesh) pathMat.uniforms.uAlpha.value = 0.85;
        }
      },
      /** screen position (CSS px) of node i's top */
      nodeScreen(i, out) {
        const n = nodes[i];
        _v1.copy(n.g.position).add(_v2.set(0, 0.2, 0)).project(camera);
        out.x = (_v1.x * 0.5 + 0.5) * View.w; out.y = (-_v1.y * 0.5 + 0.5) * View.h; out.vis = _v1.z < 1;
        return out;
      },
      dispose() {
        scene.remove(group);
        if (pathMesh) pathMesh.geometry.dispose();
        sky.geometry.dispose(); sky.material.dispose();
        for (const d of disposables) if (d && d.dispose) d.dispose();
        Post.lensStr = 0;
      },
    };
    arena.update(0);
    return arena;
  },
};

// ---------------------------------------------------------------- DOM: Raid Map + talent pick (injected)
const MENU_CSS = `
@media (min-aspect-ratio: 21/20){
  #title{align-items:flex-start;padding-left:max(6vw, calc(24px + var(--sal, 0px)))}
  #title #logo{text-align:left;font-size:clamp(26px,6.2vw,92px)}
  #title #subtitle{text-align:left;padding-left:0}
  #title #tapbegin{text-align:left}
}
@media (max-aspect-ratio: 21/20){
  #title{justify-content:flex-start;padding:calc(7vh + var(--sat, 0px)) 0 calc(52px + var(--sab, 0px))}
  #title #titlemenu{margin-top:auto}
  #map-head h2{visibility:hidden}
}
#map{flex-direction:column;align-items:stretch;justify-content:flex-start;background:radial-gradient(ellipse at 50% 40%,rgba(0,0,0,0) 40%,rgba(0,0,0,.5) 100%);pointer-events:auto}
#map-head{display:flex;align-items:center;gap:10px;padding:calc(12px + var(--sat, 0px)) 16px 0 16px}
#map-head h2{flex:1;margin:0;font-family:var(--head);font-weight:700;letter-spacing:.3em;font-size:clamp(16px,2.6vw,28px);color:#fff1d6;text-shadow:0 0 18px rgba(255,190,90,.5),0 2px 6px #000;text-align:center}
#map-head .btn{width:auto;margin:0;padding:8px 14px;font-size:13px;letter-spacing:.16em}
.mnode{position:absolute;width:min(250px,30vw);transform:translate(-50%,0);padding:10px 12px 12px;border:1px solid rgba(255,200,69,.45);border-radius:4px;
  background:linear-gradient(180deg,rgba(18,14,28,.86),rgba(6,6,12,.92));box-shadow:0 0 24px rgba(0,0,0,.6),inset 0 0 22px rgba(255,200,69,.06);text-align:center;transition:opacity .4s}
.mnode.portrait{width:min(230px,56vw);transform:translate(0,-50%)}
.mnode.portrait{padding:6px 10px 8px}
.mnode.portrait .mn-best{margin:3px 0;gap:0 8px}
.mnode.portrait .btn{padding:6px;margin-top:4px}
.mnode.portrait .mn-state{margin:3px 0 2px}
.mnode.locked{border-color:rgba(120,120,140,.35);filter:saturate(.2) brightness(.75)}
.mnode .mn-name{font-family:var(--head);font-weight:900;letter-spacing:.2em;font-size:17px;color:#fff3d6;text-shadow:0 0 12px var(--ncol)}
.mnode .mn-epi{font-size:12px;letter-spacing:.14em;color:#c9b99a;margin-top:2px}
.mnode .mn-state{margin:6px 0 4px;font-family:var(--head);font-size:12px;letter-spacing:.2em;color:var(--ncol)}
.mnode.locked .mn-state{color:#8a8a99}
.mnode .mn-best{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;font-size:12px;color:#b8cfdc;margin:6px 0;text-align:left}
.mnode .mn-best b{font-family:var(--num);color:#fff;text-align:right}
.mnode .mn-best i{font-style:normal;font-family:var(--head);font-weight:700;color:#ffd36a;width:1.2em;text-align:center}
.mnode .btn{margin:6px 0 0;padding:9px 10px;font-size:14px}
.mnode .mn-tal{display:flex;gap:6px;margin-top:8px}
.mnode .mn-tal button{flex:1;padding:6px 4px;font-family:var(--head);font-size:10.5px;letter-spacing:.1em;color:#cfe4f2;background:rgba(10,20,30,.7);border:1px solid rgba(95,242,255,.25);border-radius:3px;cursor:pointer}
.mnode .mn-tal button.on{color:#fff6d8;border-color:rgba(255,200,69,.8);background:linear-gradient(180deg,rgba(90,64,16,.75),rgba(26,16,4,.9));box-shadow:0 0 10px rgba(255,200,69,.35)}
.mnode .mn-tal-h{font-size:10px;letter-spacing:.24em;color:#9fb6c4;margin-top:8px}
.mnode .lock{font-size:22px;line-height:1;margin:4px 0;color:#9a9aae}
#talentpick{flex-direction:column}
#talentpick .tp-row{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:8px}
.tpc{width:min(280px,84vw);padding:18px 16px;border:1px solid rgba(95,242,255,.3);border-radius:4px;background:linear-gradient(180deg,rgba(14,22,34,.92),rgba(4,8,14,.95));cursor:pointer;text-align:center;transition:transform .15s,box-shadow .15s,border-color .15s}
.tpc:hover,.tpc.sel{transform:translateY(-3px);border-color:rgba(255,200,69,.85);box-shadow:0 0 26px rgba(255,200,69,.3),inset 0 0 20px rgba(255,200,69,.1)}
.tpc .glyph{font-size:40px;line-height:1.1;color:#ffd36a;text-shadow:0 0 18px rgba(255,200,69,.7)}
.tpc h3{font-family:var(--head);letter-spacing:.2em;margin:8px 0 6px;color:#fff1d6}
.tpc p{font-size:14px;line-height:1.35;color:#cfe4f2;margin:0}
/* short landscape phones: three cards must fit side by side and above the bottom edge */
@media (max-height: 500px) and (min-aspect-ratio: 21/20){
  .mnode{width:min(236px,28.5vw);padding:6px 10px 8px}
  .mnode .mn-name{font-size:15px}
  .mnode .mn-state{margin:3px 0 2px}
  .mnode .mn-best{margin:3px 0;gap:0 8px}
  .mnode .btn{padding:6px;margin-top:4px}
  .mnode .mn-tal-h{margin-top:4px}
  .mnode .mn-tal{margin-top:3px}
}
@media (max-aspect-ratio: 21/20){ #hint{bottom:auto;top:calc(12.5vh + var(--sat, 0px));max-width:92vw;font-size:13px;line-height:1.3;padding:6px 10px} }  /* portrait: default spot under the boss/cast bars; Callouts (12-hud) then places it clear of the boss, her pips, the player and the buttons */
@media (max-aspect-ratio: 21/20){ #talentpick .tp-row{flex-direction:column;align-items:center} .tpc{padding:12px} .tpc .glyph{font-size:30px} }
`;
const RaidMap = {
  built: false, els: [], _s: { x: 0, y: 0, vis: true },
  init() {
    if (this.built) return; this.built = true;
    const st = document.createElement('style'); st.textContent = MENU_CSS; document.head.appendChild(st);
    const map = document.createElement('div'); map.id = 'map'; map.className = 'overlay hidden';
    map.innerHTML = '<div id="map-head"><button class="btn" id="map-back">‹ TITLE</button><h2>THE THREE THRONES</h2><button class="btn" id="map-diff">NORMAL</button></div><div id="map-nodes"></div>';
    document.body.appendChild(map);
    const tp = document.createElement('div'); tp.id = 'talentpick'; tp.className = 'overlay hidden';
    tp.innerHTML = '<div class="card glass" style="max-width:min(680px,96vw)"><h2>CHOOSE YOUR EDGE</h2><p id="tp-sub">A shard of the fallen throne answers your blade.</p><div class="tp-row" id="tp-row"></div><button class="btn primary" id="tp-ok" style="margin-top:14px">CLAIM</button></div>';
    document.body.appendChild(tp);
    const wrap = $('map-nodes');
    for (let i = 0; i < 3; i++) { const el = document.createElement('div'); el.className = 'mnode'; wrap.appendChild(el); this.els.push(el); }
    const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); Audio.unlock(); sfx('ui'); fn(); });
    click('map-back', () => { $('map').classList.add('hidden'); if (Game.titleArena) Game.titleArena.setMode('title'); $('title').classList.remove('hidden'); $('tapbegin').classList.add('hidden'); $('titlebtns').classList.remove('hidden'); });
    click('map-diff', () => { $('btn-diff').click(); this.render(); });
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.stopPropagation(); Audio.unlock();
      if (b.dataset.fight != null) { sfx('uiConfirm'); const i = +b.dataset.fight; $('map').classList.add('hidden'); Game.startFight(ENCOUNTERS[i] ? i : 'training', {}); }
      else if (b.dataset.tal != null) { sfx('ui'); const [tier, opt] = b.dataset.tal.split(':').map(Number); Save.data.talents[tier] = opt; Game.talents[tier] = opt; Save.save(); this.render(); }
    });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !$('map').classList.contains('hidden')) $('map-back').click(); });
  },
  render() {
    const B = CONFIG.bosses, diffs = ['story', 'normal', 'heroic'], labels = { story: 'Story', normal: 'Normal', heroic: 'Heroic' };
    $('map-diff').textContent = CONFIG.difficulty[Game.difficulty].label;
    for (let i = 0; i < 3; i++) {
      const el = this.els[i], b = B[i], unl = Save.isUnlocked(i);
      const cleared = diffs.some((d) => Save.data.cleared[d][i]);
      const col = '#' + new THREE.Color([0xff7a2a, 0x4fd8ff, 0xa070ff][i]).getHexString();
      el.style.setProperty('--ncol', col);
      el.classList.toggle('locked', !unl);
      let h = `<div class="mn-name">${b.name}</div><div class="mn-epi">${b.epithet}</div>`;
      if (!unl) h += `<div class="lock">&#128274;</div><div class="mn-state">LOCKED</div><div class="mn-epi">Defeat ${B[i - 1].name} to break the seal</div>`;
      else {
        h += `<div class="mn-state">${cleared ? '&#10003; CLEARED' : 'THRONE ' + ['I', 'II', 'III'][i]}</div><div class="mn-best">`;
        for (const d of diffs) { const r = Save.data.best[i + '_' + d]; h += `<span>${labels[d]}</span><b>${r ? fmtTime(r.time) : '—'}</b><i>${r ? r.rank : (Save.data.cleared[d][i] ? '&#10003;' : '')}</i>`; }
        h += `</div><button class="btn primary" data-fight="${i}">${ENCOUNTERS[i] ? 'FIGHT' : 'FIGHT <small>(soon)</small>'}</button>`;
        if (cleared && i < 2) {
          const T = CONFIG.talents[i], cur = Save.data.talents[i] | 0;
          h += `<div class="mn-tal-h">TALENT</div><div class="mn-tal">${T.map((t, k) => `<button class="${k === cur ? 'on' : ''}" data-tal="${i}:${k}" title="${t.desc}">${t.name}</button>`).join('')}</div>`;
        }
      }
      el.innerHTML = h;
    }
    this.sz = null;                 // card sizes changed: re-measure on the next place()
    this.place();
  },
  /** read every card size once (after render / resize / orientation change), so place() is write-only */
  measure() {
    const land = View.w / View.h >= 1.05;
    for (const el of this.els) el.classList.toggle('portrait', !land);
    const sz = this.sz || (this.sz = [{ w: 0, h: 0 }, { w: 0, h: 0 }, { w: 0, h: 0 }]);
    let ok = true;
    for (let i = 0; i < 3; i++) { const el = this.els[i]; sz[i].w = el.offsetWidth; sz[i].h = el.offsetHeight; if (!sz[i].w) ok = false; }
    this.szW = ok ? View.w : -1; this.szH = View.h; this.szLand = land;   // measured while hidden → measure again next time
  },
  place() {
    const A = Game.titleArena; if (!A || !A.nodeScreen) return;
    if (!this.sz || this.szW !== View.w || this.szH !== View.h) this.measure();
    const land = this.szLand;
    let lastBottom = 0;
    for (let i = 0; i < 3; i++) {
      const s = A.nodeScreen(i, this._s), el = this.els[i], w = this.sz[i].w || 250, h = this.sz[i].h || (land ? 180 : 160);
      let x, y;
      if (land) { const hw = w / 2; x = clamp(s.x, hw + 4, View.w - hw - 4); y = Math.max(56, Math.min(s.y + 54, View.h - h - 6)); }
      else { x = Math.min(s.x + 54, View.w - w - 8); y = Math.max(clamp(s.y, h / 2 + 72, View.h - h / 2 - 8), lastBottom + 8 + h / 2); lastBottom = y + h / 2; }
      x = Math.round(x); y = Math.round(y);
      if (el._x !== x) { el._x = x; el.style.left = x + 'px'; }
      if (el._y !== y) { el._y = y; el.style.top = y + 'px'; }
      const op = s.vis ? 1 : 0; if (el._op !== op) { el._op = op; el.style.opacity = op; }
    }
  },
  update() { if (!$('map').classList.contains('hidden')) this.place(); },
};

const TalentPick = {
  tier: 0, sel: 0,
  show(tier) {
    this.tier = tier; this.sel = Save.data.talents[tier] | 0;
    const row = $('tp-row'); row.innerHTML = '';
    const glyphs = [['&#10022;', '&#9776;'], ['&#8987;', '&#10070;']];
    CONFIG.talents[tier].forEach((t, k) => {
      const c = document.createElement('div'); c.className = 'tpc' + (k === this.sel ? ' sel' : '');
      c.innerHTML = `<div class="glyph">${glyphs[tier][k]}</div><h3>${t.name}</h3><p>${t.desc}</p>`;
      c.addEventListener('click', (e) => { e.stopPropagation(); sfx('ui'); this.sel = k; for (const o of row.children) o.classList.remove('sel'); c.classList.add('sel'); });
      row.appendChild(c);
    });
    $('tp-sub').textContent = 'A shard of ' + CONFIG.bosses[tier].name + "'s throne answers your blade. You can change this later on the Raid Map.";
    $('talentpick').classList.remove('hidden');
  },
  confirm() {
    Save.data.talents[this.tier] = this.sel; Game.talents[this.tier] = this.sel; Save.save();
    sfx('uiConfirm');
    $('talentpick').classList.add('hidden');
    Game.showMap();
  },
};

Object.assign(Game, {
  showMap() {
    RaidMap.init();
    for (const id of ['title', 'pause', 'death', 'victory', 'settings', 'how', 'talentpick']) { const e = $(id); if (e) e.classList.add('hidden'); }
    $('rotatehint').classList.remove('on');   // the boot-time hint would sit on the map header
    if (!this.titleArena || this.arena !== this.titleArena || this.state !== 'title') this.toTitle(true);
    $('title').classList.add('hidden');
    this.titleArena.setMode('map');
    RaidMap.render();
    $('map').classList.remove('hidden');
  },
  showTalentPick(tier) { RaidMap.init(); TalentPick.show(tier); },
});

// wire the talent confirm button once the DOM exists (menus are injected at boot, before initMenus)
function initRaidMenus() {
  RaidMap.init();
  $('tp-ok').addEventListener('click', (e) => { e.stopPropagation(); Audio.unlock(); TalentPick.confirm(); });
}
