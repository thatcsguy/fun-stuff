// =============================================================================
//  §17a  TRAINING GROUNDS — a test arena (floating clock-disc under a nebula sky)
//        and THE PENDULUM, a training construct that cycles through every
//        telegraph shape, colour and hazard type so the whole kit can be tested.
//        Also the reference implementation of an encounter (ENCOUNTERS contract)
//        and of a BossEntity subclass (poses, casts, phases, death sequence).
// =============================================================================

// ---------------------------------------------------------------- shared sky shader (Training / title backdrop)
const TRAINING_SKY_FS = /* glsl */`
  uniform float uTime; uniform float uStreak; uniform vec3 uFocus; uniform float uOctaves;
  varying vec3 vDir;
  ${GLSL_NOISE}
  float starAt(vec3 d, float scale, float thr){
    vec3 q = d * scale; vec3 id = floor(q); float h = hash13(id);
    if (h < thr) return 0.0;
    vec3 sp = hash33(id + 7.1);
    float dist = length(fract(q) - sp);
    float tw = 0.7 + 0.3 * sin(uTime * (1.5 + h * 4.0) + h * 50.0);
    return smoothstep(0.11, 0.0, dist) * (h - thr) / (1.0 - thr) * tw;
  }
  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 zen = vec3(0.004, 0.006, 0.022), hor = vec3(0.05, 0.035, 0.10);
    vec3 col = mix(hor, zen, smoothstep(-0.1, 0.65, h));
    col += vec3(0.03, 0.16, 0.22) * pow(max(1.0 - abs(h), 0.0), 10.0) * 0.8;       // teal horizon band
    col += vec3(0.16, 0.05, 0.12) * pow(max(1.0 - abs(h + 0.15), 0.0), 5.0) * 0.35;  // warm under-glow
    int oct = int(uOctaves + 0.5);
    float n = fbm3(d * 2.2 + vec3(0.0, 0.0, uTime * 0.004), oct);
    float n2 = fbm3(d * 1.1 + vec3(7.0, 3.0, 1.0), 2);
    vec3 neb = mix(vec3(0.22, 0.04, 0.30), vec3(0.03, 0.24, 0.36), n2);
    col += neb * pow(max(n - 0.25, 0.0) * 1.6, 2.4) * smoothstep(-0.25, 0.25, h) * 0.9;
    // stars (radially streaked toward uFocus during Zero Hour / intros)
    float s = starAt(d, 140.0, 0.975) + starAt(d, 320.0, 0.988) * 0.7;
    if (uStreak > 0.01) {
      for (int i = 1; i < 7; i++) {
        vec3 dd = normalize(d + (d - uFocus) * float(i) * 0.035 * uStreak);
        s += (starAt(dd, 140.0, 0.975) + starAt(dd, 320.0, 0.988) * 0.7) * (1.0 - float(i) / 7.0) * uStreak;
      }
    }
    col += vec3(0.85, 0.92, 1.0) * s * 2.2 * smoothstep(-0.05, 0.1, h);
    // ringed moon to the north
    vec3 md = normalize(vec3(0.32, 0.30, -1.0));
    float ang = acos(clamp(dot(d, md), -1.0, 1.0));
    float R = 0.115;
    if (ang < R) {
      vec3 n3 = normalize(d - md * cos(ang) + vec3(1e-5, 0.0, 0.0));
      float lit = clamp(dot(normalize(vec3(-0.6, 0.5, 0.4)), normalize(n3 + md * sqrt(max(R * R - ang * ang, 0.0)) / R)), 0.0, 1.0);
      float crater = fbm3(d * 60.0, 3);
      col = mix(col, vec3(0.55, 0.62, 0.78) * (0.06 + 0.9 * lit) * (0.75 + 0.4 * crater), smoothstep(R, R * 0.97, ang));
    }
    col += vec3(0.25, 0.35, 0.55) * exp(-ang * 9.0) * 0.18;
    // the moon's ring (tilted ellipse)
    vec3 rx = normalize(cross(md, vec3(0.2, 1.0, 0.1))), ry = normalize(cross(rx, md));
    vec2 rp = vec2(dot(d - md, rx), dot(d - md, ry) * 3.2);
    float rr = length(rp);
    float ring = smoothstep(0.012, 0.0, abs(rr - 0.2)) + smoothstep(0.008, 0.0, abs(rr - 0.235)) * 0.6;
    if (dot(d - md, ry) < 0.0 || ang > R) col += vec3(0.6, 0.55, 0.45) * ring * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }`;
const SKY_VS = /* glsl */`
  varying vec3 vDir;
  void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;

function makeTrainingSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uRealTime, uStreak: GLOBAL_U.uStreak, uFocus: { value: new THREE.Vector3(0, 0, -1) }, uOctaves: GLOBAL_U.uOctaves },
    vertexShader: SKY_VS, fragmentShader: TRAINING_SKY_FS, side: THREE.BackSide, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
  m.renderOrder = -10; m.frustumCulled = false; m.matrixAutoUpdate = false;
  return m;
}

// ---------------------------------------------------------------- the arena
function buildTrainingArena() {
  const R = 20;
  const group = new THREE.Group(); group.name = 'training-arena';
  const disposables = [];
  const add = (o) => { group.add(o); return o; };

  // sky
  const sky = add(makeTrainingSky());
  // lights
  const hemi = add(new THREE.HemisphereLight(0x8fb4ff, 0x0c0814, 0.65));
  const key = add(new THREE.DirectionalLight(0xdfe8ff, 1.6));
  key.position.set(-12, 26, 16); key.target.position.set(0, 0, 0); group.add(key.target);
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
  const sc = key.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 4; sc.far = 70;
  const applyShadows = (tier) => { key.castShadow = !!tier.shadows; };
  applyShadows(Quality.tier);
  Quality.onChange(applyShadows);
  const rim = add(new THREE.DirectionalLight(0x6a5cff, 0.7)); rim.position.set(10, 8, -24);

  // floor (MeshStandard + procedural albedo / emissive engraving)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c2333, roughness: 0.38, metalness: 0.35 });
  floorMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = GLOBAL_U.uTime; sh.uniforms.uR = { value: R }; sh.uniforms.uOctaves = GLOBAL_U.uOctaves;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFloor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloor = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vFloor; uniform float uTime; uniform float uR; uniform float uOctaves;\n' + GLSL_NOISE + `
      float lineAt(float v, float c, float w){ return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.03, abs(v - c)); }
    `).replace('#include <color_fragment>', `#include <color_fragment>
      vec2 fp = vFloor; float fr = length(fp); float fa = atan(fp.x, -fp.y);
      float band = floor(fr / 2.6); float segs = max(6.0, band * 7.0);
      float u = fa / 6.2831853 * segs + hash11(band + 3.0) * 0.5;
      float tid = hash12(vec2(band, floor(u)));
      float groove = max(1.0 - smoothstep(0.0, 0.035, min(fract(fr / 2.6), 1.0 - fract(fr / 2.6)) * 2.6),
                         1.0 - smoothstep(0.0, 0.04, min(fract(u), 1.0 - fract(u)) * 6.2831853 * max(fr, 1.0) / segs));
      if (fr < 2.6) groove = 0.0;
      float stone = 0.72 + 0.4 * fbm(fp * 0.45, int(uOctaves)) + (tid - 0.5) * 0.18;
      diffuseColor.rgb *= stone * (1.0 - groove * 0.65);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.7, 0.75, 0.95), smoothstep(uR - 6.0, uR, fr));
    `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (vnoise(vFloor * 1.7) - 0.5) * 0.25 + groove * 0.4, 0.05, 1.0);
    `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 cyan = vec3(0.12, 0.85, 1.0), gold = vec3(1.0, 0.62, 0.15);
        float t = uTime;
        float e = 0.0;
        // engraved rings with travelling light pulses
        for (int i = 0; i < 3; i++) {
          float rc = 4.5 + float(i) * 5.0;
          float l = lineAt(fr, rc, 0.07);
          float pulse = pow(max(0.5 + 0.5 * sin(fa * 2.0 - t * (0.6 + float(i) * 0.25) + float(i) * 2.0), 0.0), 12.0);
          e += l * (0.16 + 0.55 * pulse);
        }
        // clock ticks near the edge
        float tick = fract(fa / 6.2831853 * 60.0 + 0.5) - 0.5;
        float tw = abs(tick) * 6.2831853 * fr / 60.0;
        float major = step(abs(fract(fa / 6.2831853 * 12.0 + 0.5) - 0.5) * 6.2831853 * fr / 12.0, 0.12);
        float tk = (1.0 - smoothstep(0.035, 0.065, tw)) * step(18.1, fr) * step(fr, mix(18.9, 19.35, major));
        // hour slabs
        float hs = fract(fa / 6.2831853 * 12.0 + 0.5) - 0.5;
        float hw = abs(hs) * 6.2831853 * 16.9 / 12.0;
        float slab = (1.0 - smoothstep(0.32, 0.38, hw)) * (1.0 - smoothstep(0.42, 0.5, abs(fr - 16.9)));
        float slabIn = (1.0 - smoothstep(0.18, 0.22, hw)) * (1.0 - smoothstep(0.26, 0.32, abs(fr - 16.9)));
        // centre sigil
        float sig = lineAt(fr, 1.3, 0.05) + lineAt(fr, 2.1, 0.03);
        float hexa = 0.0;
        for (int k = 0; k < 3; k++) { float a = float(k) * 1.0471976; vec2 dir = vec2(cos(a), sin(a)); hexa += (1.0 - smoothstep(0.02, 0.05, abs(dot(fp, dir)))) * step(fr, 2.1) * step(1.3, fr); }
        // rim
        float rimB = smoothstep(uR - 0.35, uR - 0.08, fr) * (1.0 - smoothstep(uR - 0.06, uR, fr));
        float rimGlow = exp(-max(uR - fr, 0.0) * 1.6) * 0.25;
        vec3 em = cyan * (e * 0.9 + tk * (0.35 + 0.6 * major) + sig * 0.5 + hexa * 0.25)
                + gold * (slab * 0.12 + slabIn * 0.45 + tk * major * 0.3)
                + cyan * (rimB * 3.2 + rimGlow);
        totalEmissiveRadiance += em;
      }
    `);
  };
  floorMat.customProgramCacheKey = () => 'trainingFloor';
  const floor = add(new THREE.Mesh(new THREE.CircleGeometry(R, 128), floorMat));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  floor.updateMatrix(); floor.matrixAutoUpdate = false;
  disposables.push(floor);

  // disc edge (rock skirt)
  const rockMat = makeArcane({ color: 0x262a36, roughness: 0.9, metalness: 0.05, flatShading: true }, { rim: 0.35, rimColor: 0x4a6aff, key: 'rock' });
  const skirtG = new THREE.CylinderGeometry(R, R * 0.55, 6, 48, 4, true);
  { const pa = skirtG.attributes.position; for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < 2.9) { const k = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.08 * (3 - y) / 6; pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); } } skirtG.computeVertexNormals(); }
  const skirt = add(new THREE.Mesh(skirtG, rockMat)); skirt.position.y = -3.02;
  const lip = add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.09, 6, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.9, 2.6) })));
  lip.rotation.x = Math.PI / 2; lip.position.y = 0.02;

  // rune pylons (colliders) at r = 14
  const colliders = [];
  const pylonMat = makeArcane({ color: 0x2b3142, roughness: 0.55, metalness: 0.4 }, { rim: 0.8, rimColor: 0x5ff2ff, key: 'pylon', occluder: true });
  const runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.8, 2.4) });
  const pylonG = new THREE.CylinderGeometry(0.75, 1.0, 3.4, 6);
  const capG = new THREE.OctahedronGeometry(0.55, 0);
  const runeG = new THREE.BoxGeometry(0.08, 2.2, 0.08);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(a) * 14, z = Math.cos(a) * 14;
    const p = add(new THREE.Mesh(pylonG, pylonMat)); p.position.set(x, 1.7, z); p.castShadow = true; p.receiveShadow = true;
    const c = add(new THREE.Mesh(capG, runeMat)); c.position.set(x, 4.1, z); c.userData.spin = 1;
    for (let k = 0; k < 3; k++) { const r = add(new THREE.Mesh(runeG, runeMat)); const ra = a + k * TAU / 3; r.position.set(x + Math.sin(ra) * 0.82, 1.6, z + Math.cos(ra) * 0.82); }
    colliders.push({ x, z, r: 1.0 });
  }

  // distant monoliths (instanced) + floating rocks beneath
  const mono = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), rockMat, 10);
  const monoRune = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), runeMat, 10);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.2, r = 30 + (i % 3) * 5, h = 8 + ((i * 7) % 5) * 2.5;
    _v1.set(Math.sin(a) * r, h / 2 - 3 - (i % 2) * 2, Math.cos(a) * r);
    _q1.setFromEuler(_e1.set(((i % 3) - 1) * 0.08, -a, ((i % 4) - 1.5) * 0.06));
    mono.setMatrixAt(i, _m1.compose(_v1, _q1, _v2.set(2.2, h, 1.6)));
    _v3.set(0, 0, 0.82).applyQuaternion(_q1).add(_v1);
    monoRune.setMatrixAt(i, _m1.compose(_v3, _q1, _v2.set(0.12, h * 0.8, 0.05)));
  }
  add(mono); add(monoRune);
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 26);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39996, r = 8 + (i * 37 % 26), s = 0.8 + (i * 13 % 7) * 0.45;
    _v1.set(Math.sin(a) * r, -4 - (i * 11 % 9) * 1.6, Math.cos(a) * r);
    _q1.setFromEuler(_e1.set(i, i * 2, i * 3));
    rocks.setMatrixAt(i, _m1.compose(_v1, _q1, _v2.set(s, s * 0.8, s)));
  }
  add(rocks);

  // a colossal broken clock ring in the northern sky
  const ringGold = new THREE.MeshStandardMaterial({ color: 0xffc845, metalness: 1, roughness: 0.35, emissive: 0x6a4a10, emissiveIntensity: 0.9 });
  const bigRing = new THREE.Group(); bigRing.position.set(0, 75, -250); bigRing.rotation.x = 0.25;
  bigRing.add(new THREE.Mesh(new THREE.TorusGeometry(95, 1.8, 8, 140, TAU * 0.82), ringGold));
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(80, 0.8, 6, 120, TAU * 0.7), ringGold); ring2.rotation.z = 1.2; bigRing.add(ring2);
  const tickI = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 9, 1.2), ringGold, 12);
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; _v1.set(Math.cos(a) * 87, Math.sin(a) * 87, 0); _q1.setFromAxisAngle(_v2.set(0, 0, 1), a - Math.PI / 2); tickI.setMatrixAt(i, _m1.compose(_v1, _q1, _s1.set(1, 1, 1))); }
  bigRing.add(tickI);
  add(bigRing);

  // ambient motes (static Points, animated in the shader → zero CPU)
  const N = 320, mp = new Float32Array(N * 3), mr = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 30; mp[i * 3] = Math.sin(a) * r; mp[i * 3 + 1] = Math.random() * 14 - 2; mp[i * 3 + 2] = Math.cos(a) * r; mr[i] = Math.random(); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('aR', new THREE.BufferAttribute(mr, 1));
  const motes = add(new THREE.Points(mg, new THREE.ShaderMaterial({
    uniforms: { uTime: GLOBAL_U.uTime, uScale: Particles.mat.uniforms.uScale },
    vertexShader: /* glsl */`
      attribute float aR; uniform float uTime; uniform float uScale; varying float vA; varying float vR;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.25 + aR * 0.4), 14.0) - 2.0;
        p.x += sin(uTime * (0.3 + aR) + aR * 20.0) * 0.6; p.z += cos(uTime * (0.25 + aR * 0.7) + aR * 10.0) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min((0.06 + aR * 0.08) * uScale / -mv.z, 10.0);
        gl_Position = projectionMatrix * mv;
        vA = smoothstep(-2.0, 0.5, p.y) * (1.0 - smoothstep(9.0, 12.0, p.y)) * (0.4 + 0.6 * sin(uTime * 2.0 + aR * 30.0) * 0.5 + 0.3);
        vR = aR;
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying float vR;
      void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
        vec3 c = mix(vec3(0.3, 1.6, 2.2), vec3(2.0, 1.4, 0.5), step(0.85, vR));
        gl_FragColor = vec4(c * pow(max(1.0 - d, 0.0), 2.0) * vA, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })));
  motes.frustumCulled = false;

  const keep = new Set([sky, bigRing]); group.traverse((o) => { if (o.userData.spin) keep.add(o); });
  mergeStaticMeshes(group, keep);
  scene.add(group);
  const arena = {
    key: 'training', group, radius: R, colliders, sky,
    exposure: 1.05, bloom: 0.78,
    grade: { lift: [0, 0.004, 0.02], gain: [1.0, 1.0, 1.04], gamma: [1, 1, 1], sat: 1.05 },
    update(dt) {
      bigRing.rotation.z += dt * 0.01;
      for (const o of group.children) if (o.userData.spin) { o.rotation.y += dt * 1.2; o.position.y = 4.1 + Math.sin(GLOBAL_U.uRealTime.value * 1.5 + o.position.x) * 0.15; }
      camera.getWorldDirection(sky.material.uniforms.uFocus.value);
    },
    dispose() {
      scene.remove(group);
      Quality.listeners.splice(Quality.listeners.indexOf(applyShadows), 1);
      group.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.dispose) c.material.dispose(); });
    },
  };
  return arena;
}

// ---------------------------------------------------------------- the clock-face texture for the dummy's head
function makeClockTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  gr.addColorStop(0, '#f6efe0'); gr.addColorStop(0.8, '#cfc2a4'); gr.addColorStop(1, '#6b5a3a');
  g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, TAU); g.fill();
  g.strokeStyle = '#3a2a14'; g.lineWidth = 4; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, TAU); g.stroke();
  g.fillStyle = '#2a1e0e'; g.font = 'bold 26px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const rom = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; g.fillText(rom[i], S / 2 + Math.sin(a) * 92, S / 2 - Math.cos(a) * 92); }
  for (let i = 0; i < 60; i++) { const a = i * TAU / 60, r0 = i % 5 ? 112 : 106; g.beginPath(); g.moveTo(S / 2 + Math.sin(a) * r0, S / 2 - Math.cos(a) * r0); g.lineTo(S / 2 + Math.sin(a) * 118, S / 2 - Math.cos(a) * 118); g.lineWidth = i % 5 ? 1.5 : 3; g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- THE PENDULUM — training construct
const DUMMY_POSES = {
  //            handL [x,y,z]       handR [x,y,z]     lean   glow
  idle:    { L: [1.9, 2.6, 0.3],  R: [-1.9, 2.6, 0.3],  lean: 0,     glow: 0.4 },
  raise:   { L: [1.3, 5.6, 0.4],  R: [-1.3, 5.6, 0.4],  lean: -0.12, glow: 1.0 },
  slam:    { L: [1.2, 1.0, 1.9],  R: [-1.2, 1.0, 1.9],  lean: 0.25,  glow: 1.2 },
  cast:    { L: [1.0, 3.6, 1.6],  R: [-1.0, 3.6, 1.6],  lean: 0.05,  glow: 1.4 },
  cross:   { L: [-0.4, 3.4, 1.2], R: [0.4, 3.2, 1.2],   lean: 0.1,   glow: 0.9 },
  wide:    { L: [3.0, 4.9, 0.0],  R: [-3.0, 4.9, 0.0],  lean: -0.08, glow: 1.2 },
  point:   { L: [1.9, 2.4, 0.0],  R: [-0.6, 3.6, 2.6],  lean: 0.08,  glow: 1.0 },
};

class TrainingDummy extends BossEntity {
  constructor(ctx) {
    super({ name: 'THE PENDULUM', epithet: 'Training Construct', hp: 60000 * Game.diff.hp, radius: 1.6, height: 5.6, phaseThresholds: [0.6, 0.25], enrage: 0, x: 0, z: -6 });
    this.yaw = 0; this.prevYaw = 0;
    this.poseName = 'idle'; this.handL = new THREE.Vector3(1.9, 2.6, 0.3); this.handR = new THREE.Vector3(-1.9, 2.6, 0.3); this.leanV = 0; this.glowV = 0.4;
    this.nextT = 3.0; this.seq = 0; this.gap = 2.8; this.busy = 0; this.transition = false; this.dissolve = 0; this.dying = false;
    this.build();
    this.light.color.set(0x5ff2ff); this.light.distance = 16; this.light.intensity = 0;
  }
  build() {
    const g = this.group;
    const stone = this.addArcane(makeArcane({ color: 0x2a2f3c, roughness: 0.55, metalness: 0.25, flatShading: true }, { rim: 0.6, rimColor: 0x5ff2ff, crackScale: 1.4, key: 'dummyStone' }));
    const gold = this.addArcane(makeArcane({ color: 0xffc845, roughness: 0.3, metalness: 1.0, emissive: 0x4a2c00, emissiveIntensity: 0.6 }, { rim: 0.4, rimColor: 0xffd36a, crackScale: 2.5, key: 'dummyGold' }));
    this.coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.8, 3.4) });
    const M = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; };
    const body = this.body = new THREE.Group(); g.add(body);
    // hover ring + inverted cone skirt
    this.hover = M(new THREE.TorusGeometry(1.25, 0.1, 8, 40), gold, 0, 0.45, 0); this.hover.rotation.x = Math.PI / 2;
    const skirt = M(new THREE.ConeGeometry(1.25, 2.6, 8, 2), stone, 0, 1.9, 0, body); skirt.rotation.x = Math.PI;
    // torso
    const torso = M(new THREE.OctahedronGeometry(1.0, 1), stone, 0, 3.5, 0, body); torso.scale.set(1.25, 1.35, 0.95);
    // chest core in a gyroscope
    this.core = M(new THREE.IcosahedronGeometry(0.38, 1), this.coreMat, 0, 3.55, 0.95, body); this.core.castShadow = false;
    this.gyro = [];
    for (let i = 0; i < 3; i++) { const r = M(new THREE.TorusGeometry(0.6 + i * 0.13, 0.035, 6, 36), gold, 0, 3.55, 0.95, body); r.castShadow = false; this.gyro.push(r); }
    // shoulders
    M(new THREE.DodecahedronGeometry(0.55, 0), stone, 1.55, 4.15, 0, body);
    M(new THREE.DodecahedronGeometry(0.55, 0), stone, -1.55, 4.15, 0, body);
    // floating gauntlets
    const gaunt = () => {
      const h = new THREE.Group();
      M(new THREE.BoxGeometry(0.62, 0.9, 0.55), stone, 0, 0, 0, h);
      for (let k = 0; k < 3; k++) { const f = M(new THREE.ConeGeometry(0.09, 0.45, 5), gold, -0.18 + k * 0.18, -0.62, 0.12, h); f.rotation.x = Math.PI; }
      M(new THREE.TorusGeometry(0.42, 0.04, 6, 24), gold, 0, 0.1, 0, h).rotation.x = Math.PI / 2;
      g.add(h); return h;
    };
    this.gL = gaunt(); this.gR = gaunt();
    // clock-face head
    const head = this.head = new THREE.Group(); head.position.set(0, 5.05, 0.15); body.add(head);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.78, 40), new THREE.MeshStandardMaterial({ map: makeClockTexture(), roughness: 0.6, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.0 }));
    face.position.z = 0.06; head.add(face);
    this.faceMat = face.material;
    const bezel = M(new THREE.TorusGeometry(0.8, 0.07, 8, 40), gold, 0, 0, 0.05, head);
    const back = M(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 32), stone, 0, 0, -0.02, head); back.rotation.x = Math.PI / 2;
    const handMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.12, 0.05) });
    this.hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.02), handMat); this.hourHand.geometry.translate(0, 0.18, 0); this.hourHand.position.z = 0.09; head.add(this.hourHand);
    this.minHand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.02), handMat); this.minHand.geometry.translate(0, 0.28, 0); this.minHand.position.z = 0.1; head.add(this.minHand);
    for (let i = 0; i < 5; i++) { const c = M(new THREE.ConeGeometry(0.09, 0.5 + (i === 2 ? 0.3 : 0), 5), gold, (i - 2) * 0.28, 0.95 + (i === 2 ? 0.15 : 0) - Math.abs(i - 2) * 0.08, -0.02, head); c.rotation.z = (i - 2) * -0.2; }
    // pendulum swinging behind
    const pend = this.pendulum = new THREE.Group(); pend.position.set(0, 4.6, -1.0); body.add(pend);
    M(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 6), gold, 0, -1.7, 0, pend);
    const bob = M(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 32), gold, 0, -3.5, 0, pend); bob.rotation.x = Math.PI / 2;
    this.bobGlow = M(new THREE.CircleGeometry(0.38, 24), this.coreMat, 0, -3.5, -0.05, pend); this.bobGlow.rotation.y = Math.PI;
    this.blob = makeBlobShadow(4.5); g.add(this.blob);
    mergeStaticMeshes(g, collectRefs(this));
  }

  // ------------------------------------------------------------ helpers
  pose(name) { this.poseName = name; }
  playerPos() { return Game.player.pos; }
  windupMs(base) { return base; }
  randomArenaPoint(out, minR, maxR) {
    const a = rand() * TAU, r = lerp(minR, maxR, Math.sqrt(rand()));
    return out.set(Math.sin(a) * r, 0, Math.cos(a) * r);
  }
  slamFx(x, z, power) {
    sfx('slam'); CamRig.addTrauma(0.25 + power * 0.3);
    Particles.burst(_v1.set(x, 0.3, z), 50 + power * 60, 0xffb070, 0x5a1a08, 9, 0.8, 0.35, -10, { flat: true, intensity: 2 });
    Rubble && ShardFX && Rubble.spawn(x, 0.4, z, fxRange(-4, 4), 6, fxRange(-4, 4), { life: 1.6, scale: 0.6 });
    GroundFX.ring(x, z, 0.5, 4 + power * 4, 0xffa060, 0.5, 0.35, 2.2);
    PointLights.flash(_v1.set(x, 1.5, z), 0xff8a40, 40 * (0.5 + power), 0.3);
  }

  // ------------------------------------------------------------ abilities (each returns how long the boss stays busy)
  ab_cleave() {
    const p = this.playerPos(), rot = yawTo(this.pos.x, this.pos.z, p.x, p.z);
    this.yaw = rot; this.pose('raise');
    Banner.show('PENDULUM CLEAVE');
    const tg = Telegraphs.spawn({ shape: 'cone', x: this.pos.x, z: this.pos.z, rot, r: 11, angle: 100, windup: 1.4, color: 'red', dmg: 450, knock: 4, source: 'Pendulum Cleave', major: true,
      onResolve: (t) => { this.pose('slam'); this.slamFx(this.pos.x + Math.sin(rot) * 5, this.pos.z + Math.cos(rot) * 5, 1);
        SlashFX.spawn(this.pos.x, 1.0, this.pos.z, rot, 0, 7, 0xffb070, { dur: 0.12, hold: 0.15, intensity: 3.5, tail: 0.8 }); } });
    this.startCast('Pendulum Cleave', 1.4, { sting: true });
    return 1.4 * Game.diff.windup + 0.6;
  }
  ab_hail() {
    Banner.show('HAIL OF HOURS');
    this.pose('wide');
    const p = this.playerPos();
    const pts = [];
    for (let i = 0; i < 3; i++) pts.push(this.randomArenaPoint(new THREE.Vector3(), 3, 17));
    pts.push(new THREE.Vector3(p.x, 0, p.z));
    if (Game.difficulty === 'heroic') pts.push(this.randomArenaPoint(new THREE.Vector3(), 3, 17));
    pts.forEach((pt, i) => {
      const delay = i * 0.3, wind = 2.0;
      Telegraphs.spawn({ shape: 'circle', x: pt.x, z: pt.z, r: 3.5, windup: wind, delay, color: 'red', dmg: 300, source: 'Hail of Hours', major: i === 0,
        sfx: null,
        onResolve: (t) => {
          sfx('boom'); CamRig.addTrauma(0.12);
          Particles.burst(_v1.set(t.x, 0.4, t.z), 70, 0xffd0a0, 0xff4a1c, 8, 0.7, 0.3, -12, { flat: true, intensity: 2.2 });
          GroundFX.ring(t.x, t.z, 0.5, 4.2, 0xff8a40, 0.45, 0.3, 2.5);
          Hazards.spawn({ shape: 'circle', x: t.x, z: t.z, r: 2.5, life: 6, tickDmg: 80, tickInterval: 0.5, color: 'red', source: 'Ember Pool', lingering: true, interior: 0.7,
            update: (h, dt) => { if (fxRand() < dt * 8) Particles.trailPoint(_v1.set(h.x + fxRange(-2, 2), 0.2, h.z + fxRange(-2, 2)), 0xff8a3a, 0x401000, 0.9, 0.25, { vy: 1.2, intensity: 2 }); } });
        } });
      // falling glob that lands exactly on resolve
      const land = (delay + wind * Game.diff.windup) - 0.5;
      Timers.after(Math.max(0, land), () => {
        Projectiles.spawn({ kind: 'orb', x: pt.x + 2, y: 13, z: pt.z - 1, vx: -4, vy: -21, vz: 2, gravity: -10, friendly: true, color: 0xff7a2a, size: 0.9, life: 2 });
      });
    });
    this.startCast('Hail of Hours', 1.2, {});
    return 2.4;
  }
  ab_toll() {
    Banner.show('GILDED TOLL', 'Stand in the gold', { cls: 'gold' });
    this.pose('cast');
    const p = this.playerPos(), a = rand() * TAU;
    let x = p.x + Math.sin(a) * 4.5, z = p.z + Math.cos(a) * 4.5; const r0 = Math.hypot(x, z); if (r0 > 16) { x *= 16 / r0; z *= 16 / r0; }
    Telegraphs.spawn({ shape: 'circle', x, z, r: 2.5, windup: 3.0, color: 'gold', soak: true, soakDmg: 60, dmg: 300, source: 'Gilded Toll', pips: 1, major: true,
      onUpdate: (t) => { const pl = Game.player; t.u.uPipsOn.value = pl && t.contains(pl.pos.x, pl.pos.z) ? 1 : 0; },
      onResolve: (t, inside) => {
        Particles.burst(_v1.set(t.x, 0.5, t.z), 90, 0xffe6a0, 0xffa020, 7, 0.9, 0.3, 4, { intensity: 2.4 });
        if (inside) { this.addStatus('harmonized', 4); Stamp.show('HARMONIZED', 'gold'); sfx('bell', { f: 392 }); }
        else Game.stats.mechanicsFailed++;
      } });
    return 3.2;
  }
  ab_sanctum() {
    Banner.show('INNER SANCTUM', 'Get close');
    this.pose('cross');
    Telegraphs.spawn({ shape: 'donut', x: this.pos.x, z: this.pos.z, r: 22, inner: 6, windup: 2.0, color: 'red', dmg: 450, source: 'Inner Sanctum', major: true,
      onResolve: (t) => { this.slamFx(this.pos.x, this.pos.z, 0.8); Particles.ring(this.pos, 8, 120, 0xffb070, 0xff4a1c, 14, 0.8, 0.4, { up: 1.5, intensity: 2.2 }); } });
    if (Game.difficulty === 'story') Telegraphs.spawn({ shape: 'circle', x: this.pos.x, z: this.pos.z, r: 5.5, windup: 2.0, color: 'green', dmg: 0, silent: true, sfx: null });
    this.startCast('Inner Sanctum', 2.0, {});
    return 2.6;
  }
  ab_pulse() {
    Banner.show('OUTWARD PULSE', 'Get out');
    this.pose('wide');
    Telegraphs.spawn({ shape: 'circle', x: this.pos.x, z: this.pos.z, r: 7, windup: 2.0, color: 'red', dmg: 450, source: 'Outward Pulse', major: true,
      onResolve: (t) => { this.slamFx(this.pos.x, this.pos.z, 1.2); Particles.ring(this.pos, 2, 140, 0xffffff, 0xff7a2a, 12, 0.6, 0.35, { up: 3, intensity: 2.5 }); } });
    this.startCast('Outward Pulse', 2.0, {});
    return 2.6;
  }
  ab_line() {
    const p = this.playerPos(), rot = yawTo(this.pos.x, this.pos.z, p.x, p.z);
    this.yaw = rot; this.pose('point');
    Banner.show('MERIDIAN LINE');
    Telegraphs.spawn({ shape: 'rect', x: this.pos.x, z: this.pos.z, rot, len: 30, width: 3, windup: 1.2, color: 'red', dmg: 350, source: 'Meridian Line', major: true,
      onResolve: (t) => { Beams.flash(this.pos.x, 1.2, this.pos.z, rot, 30, 2.6, 0xffb070, 0.45); CamRig.addTrauma(0.2); sfx('lance');
        Particles.cone(_v1.set(this.pos.x, 1.2, this.pos.z), _v2.set(Math.sin(rot), 0.05, Math.cos(rot)), 0.12, 80, 0xffd0a0, 0xff4a1c, 30, 0.6, 0.3, 0, { intensity: 2.2 }); } });
    this.startCast('Meridian Line', 1.2, {});
    return 1.8;
  }
  ab_quarters() {
    Banner.show('QUARTER HOURS', 'Remember the order', { cls: 'violet' });
    this.pose('cast');
    const used = new Set(), order = [];
    while (order.length < 3) { const k = Math.floor(rand() * 12); if (!used.has(k)) { used.add(k); order.push(k); } }
    order.forEach((k, i) => {
      const rot = k * TAU / 12;
      Timers.after(i * 0.6, () => sfx('chime', { degree: k }));
      Telegraphs.spawn({ shape: 'sector', x: 0, z: 0, rot, r: 20, inner: 2, angle: 30, windup: 1.8 + i * 1.0, color: 'red', dmg: 400, source: 'Quarter Hours', major: i === 0, wide: true,
        onResolve: (t) => { sfx('boom'); Particles.burst(_v1.set(Math.sin(rot) * 11, 0.4, Math.cos(rot) * 11), 70, 0xffd0a0, 0xff4a1c, 9, 0.7, 0.3, -8, { spread: 4, flat: true, intensity: 2.2 }); CamRig.addTrauma(0.15); } });
    });
    this.startCast('Quarter Hours', 1.6, {});
    return 4.2;
  }
  ab_severance() {
    const east = rand() < 0.5, rot = east ? -Math.PI / 2 : Math.PI / 2;  // forward = +X(east) when rot=+PI/2
    Banner.show('SEVERANCE', east ? 'Go east!' : 'Go west!');
    this.pose('raise');
    Telegraphs.spawn({ shape: 'halfplane', x: 0, z: 0, rot, r: Game.arena.radius + 0.5, windup: 2.4, color: 'red', dmg: 600, source: 'Severance', major: true,
      onResolve: (t) => { this.pose('slam'); CamRig.addTrauma(0.6); sfx('slam'); sfx('rumble', { dur: 1.2 });
        for (let i = 0; i < 6; i++) { const z = -16 + i * 6.4, x = Math.sin(rot) * 9; Particles.burst(_v1.set(x, 0.4, z), 40, 0xffe0c0, 0xff4a1c, 10, 0.8, 0.4, -10, { spread: 5, flat: true, intensity: 2.2 }); }
        GroundFX.ring(Math.sin(rot) * 10, 0, 1, 14, 0xffa060, 0.6, 0.6, 2.5);
        PointLights.flash(_v1.set(Math.sin(rot) * 10, 3, 0), 0xffa060, 120, 0.5); } });
    this.startCast('Severance', 2.4, {});
    return 3.0;
  }
  ab_chime() {
    Banner.show('CHIME OF STASIS', 'Interrupt it!', { cls: 'violet' });
    this.pose('cast');
    if (!Save.seenHint('lanceHint')) Hint.show('Violet cast bar = interruptible. Throw your ' + Input.keyLabel('lance') + '.', 4, null, this, 'Chime of Stasis');
    this.startCast('Chime of Stasis', 2.5, { interruptible: true,
      onComplete: () => {
        this.pose('wide'); sfx('bell', { f: 262 });
        const p = Game.player;
        if (p && p.alive) { p.damage({ amount: 300, source: 'Chime of Stasis', avoidable: true }); p.addStatus('burning', 8, { stacks: 1 }); }
        Particles.burst(this.hitPoint, 120, 0xe6d4ff, 0x7a3cff, 12, 0.9, 0.3, 0, { intensity: 2.4 });
        Game.stats.mechanicsFailed++;
      },
      onInterrupt: () => { this.pose('idle'); } });
    return 2.8;
  }
  ab_tremor() {
    Banner.show('TREMOR', 'Dash through the rings');
    this.pose('slam');
    const cx = this.pos.x, cz = this.pos.z;
    Telegraphs.spawn({ shape: 'circle', x: cx, z: cz, r: 3, windup: 1.0, color: 'red', dmg: 0, silent: false, sfx: null });
    for (let i = 0; i < 3; i++) {
      Timers.after(1.0 * Game.diff.windup + i * 0.8, () => {
        this.slamFx(cx, cz, 0.5);
        Hazards.spawn({ shape: 'donut', x: cx, z: cz, r: 1.2, inner: 0.0, life: 2.4, tickDmg: 250, tickInterval: 1.0, color: 'red', source: 'Tremor', gentle: false, wide: true, fadeIn: 0.05,
          data: { speed: 10 }, willHit: ringWillHit,
          update: (h, dt) => { h.r += 10 * dt; h.inner = Math.max(0, h.r - 1.2); if (h.r > 23) h.kill(); } });
      });
    }
    this.startCast('Tremor', 1.0, {});
    return 3.6;
  }
  ab_gaze() {
    Banner.show('SUNDIAL GAZE', 'Leave the violet circle', { cls: 'violet' });
    this.pose('point');
    const p = this.playerPos();
    Telegraphs.spawn({ shape: 'circle', x: p.x, z: p.z, r: 5, windup: 2.5, color: 'violet', dmg: 0, source: 'Sundial Gaze', major: true,
      onResolve: (t, inside) => {
        const pl = Game.player;
        if (inside && pl && pl.alive && !pl.invuln) { pl.damage({ amount: 400, source: 'Sundial Gaze', avoidable: true }); pl.addStatus('petrified', 2); Game.stats.mechanicsFailed++; }
        Particles.burst(_v1.set(t.x, 0.5, t.z), 80, 0xe6d4ff, 0x7a3cff, 6, 0.8, 0.3, 2, { spread: 3, intensity: 2.2 });
      } });
    this.startCast('Sundial Gaze', 2.5, {});
    return 2.8;
  }
  ab_adds() {
    Banner.show('WOUND SPRINGS', 'Kill them near the boss for bonus damage');
    this.pose('wide');
    const pylons = Game.arena.colliders;
    for (let i = 0; i < 2; i++) {
      const c = pylons[Math.floor(rand() * pylons.length)];
      Adds.spawn({ x: c.x * 0.85, z: c.z * 0.85, hp: 2000, speed: 2.2, radius: 0.6, color: i ? 0x5ff2ff : 0xff8a3a, name: 'Wound Spring', height: 1.3, size: 1.1,
        onDeath: (a, byPlayer) => {
          const b = Game.boss;
          if (byPlayer && b && b.alive && dist2(a.pos.x, a.pos.z, b.pos.x, b.pos.z) - b.radius <= CONFIG.boss.addExplodeRange) {
            dealDamage(b, CONFIG.boss.addExplodeDmg, { kind: 'grand', source: 'Overload' });
            Stamp.show('OVERLOAD', 'gold');
            GroundFX.ring(a.pos.x, a.pos.z, 0.5, 6, 0xffc845, 0.5, 0.5, 3);
          }
        },
        update: (a, dt) => {
          const b = Game.boss; if (!b || !b.alive || a.rootT > 0) return;
          const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
          if (d <= b.radius + a.radius + 0.3) { b.addStatus('stoked', Infinity, { stacks: b.statusStacks('stoked') + 1 }); Banner.show('STOKED', '+10% boss damage'); a.alive = false; a.dieT = 0; Particles.burst(a.hitPoint, 60, a.color, null, 6, 0.6, 0.3, 0); return; }
          a.pos.x += dx / d * a.speed * dt; a.pos.z += dz / d * a.speed * dt;
          a.footT += dt; if (a.footT > 0.4) { a.footT = 0; GroundFX.ring(a.pos.x, a.pos.z, 0.2, 0.7, a.color, 1.2, 0.15, 1.5); }
        } });
    }
    return 1.5;
  }

  // ------------------------------------------------------------ simulation
  update(dt) {
    this.updateCommon(dt);
    if (!this.alive) { this.dissolve = Math.min(1, this.dissolve + dt * 0.8); return; }
    const p = Game.player;
    if (this.transition || Game.state !== 'fight') return;
    // phase thresholds
    const f = this.hp / this.maxHp;
    if (this.phase < this.phaseThresholds.length && f <= this.phaseThresholds[this.phase]) { this.beginPhase(this.phase + 1); return; }
    if (!this.cast && this.frozenT <= 0) {
      this.walkToward(dt);
      if (p) this.faceToward(p.pos.x, p.pos.z, dt, 3);
    }
    this.meleePressure(dt, CONFIG.bosses[0].tapDmg, CONFIG.bosses[0].tapEvery);
    // scheduler
    if (this.frozenT > 0) return;
    this.nextT -= dt;
    if (this.nextT <= 0 && !this.cast) {
      const order = ['cleave', 'hail', 'line', 'toll', 'sanctum', 'chime', 'quarters', 'pulse', 'tremor', 'severance', 'gaze', 'adds'];
      const name = this.forceNext || order[this.seq % order.length];
      this.forceNext = null; this.seq++;
      const busy = this['ab_' + name]();
      this.nextT = busy + this.gap * (this.phase === 0 ? 1 : this.phase === 1 ? 0.8 : 0.65);
      this.lastAbility = name;
    }
    if (!this.cast && this.nextT > 0.4 && this.poseName !== 'idle' && this.nextT < 2.5) this.pose('idle');
  }
  beginPhase(n) {
    this.phase = n; this.transition = true; this.invuln = true; this.cast = null;
    Telegraphs.clearAll(); Hazards.clearAll();
    Game.inputLocked = true; Game.state = 'transition';
    logEvent('phase', { phase: n });
    Audio.music.setPhase(n);
    const c = this.pos;
    const rail = CamRig.orbitRail(_v1.set(c.x, 2.5, c.z), 70, 3.2, { radius: 13, height: 6, lookUp: 1.5, roll: [0, 2, -1, 0],
      events: [{ t: 0.6, fn: () => { this.pose('raise'); sfx('rumble', { dur: 1.5 }); CamRig.addTrauma(0.3); } },
        { t: 1.2, fn: () => { PhaseTitle.show('PHASE ' + (n === 1 ? 'II' : 'III'), n === 1 ? 'ACCELERANDO' : 'FINAL HOUR'); Post.kickBloom(0.8, 0.8); this.slamFx(c.x, c.z, 1.2); } }],
      onDone: () => this.endPhase() });
    CamRig.playRail(rail);
  }
  endPhase() {
    if (!this.transition) return;
    this.transition = false; this.invuln = false; this.pose('idle');
    Game.inputLocked = false; if (Game.state === 'transition') Game.state = 'fight';
    this.nextT = 1.5;
  }
  onLethal() {
    // the shared death beat (§4): hit-stop, slow-mo, orbit, shatter into 400 shards sucked into the hilt
    this.alive = false; this.cast = null; this.invuln = true; this.dying = true;
    Telegraphs.clearAll(); Hazards.clearAll();
    for (const a of Game.adds) if (a.alive) a.kill(false);
    TimeFX.hitStop(CONFIG.boss.deathHitStop); TimeFX.slowMo(CONFIG.boss.deathSlow, CONFIG.boss.deathSlowDur);
    Post.kickBloom(1.2, 1.0);
    sfx('grandShatter');
    Game.state = 'transition'; Game.inputLocked = true;
    ShardFX.suck(this.hitPoint, 400, 2.4, 0x9ff8ff, Game.player.hiltWorld, { life: 5, stagger: 1.2, hold: 0.2 });
    Particles.burst(this.hitPoint, 300, 0xffffff, 0x5ff2ff, 10, 1.2, 0.3, -4, { spread: 2, intensity: 2.6 });
    const rail = CamRig.orbitRail(_v1.set(this.pos.x, 2, this.pos.z), 40, 2.6, { radius: 12, height: 5, lookUp: 1.6,
      onDone: () => { logEvent('victory', { boss: this.name }); if (Game.onBossDefeated) Game.onBossDefeated(this); } });
    CamRig.playRail(rail);
  }

  // ------------------------------------------------------------ visuals
  syncVisual(alpha, dt) {
    super.syncVisual(alpha, dt);
    const t = Game.realTime, P = DUMMY_POSES[this.poseName] || DUMMY_POSES.idle;
    // casting glow ramps with cast progress
    const castK = this.cast ? clamp01(this.cast.t / this.cast.dur) : 0;
    this.leanV = damp(this.leanV, P.lean, 6, dt);
    this.glowV = damp(this.glowV, P.glow + castK * 1.2, 6, dt);
    const bob = Math.sin(t * 1.3) * 0.12;
    this.body.position.y = bob + 0.2; this.body.rotation.x = this.leanV;
    this.hover.position.y = 0.45 + bob * 0.5; this.hover.rotation.z += dt * 0.8;
    const k = 1 - Math.exp(-8 * dt);
    this.handL.x += (P.L[0] - this.handL.x) * k; this.handL.y += (P.L[1] + bob - this.handL.y) * k; this.handL.z += (P.L[2] - this.handL.z) * k;
    this.handR.x += (P.R[0] - this.handR.x) * k; this.handR.y += (P.R[1] + bob - this.handR.y) * k; this.handR.z += (P.R[2] - this.handR.z) * k;
    this.gL.position.copy(this.handL); this.gR.position.copy(this.handR);
    this.gL.rotation.set(Math.sin(t * 2) * 0.1 + this.leanV, 0.3, 0.2); this.gR.rotation.set(Math.sin(t * 2 + 1) * 0.1 + this.leanV, -0.3, -0.2);
    for (let i = 0; i < 3; i++) { const r = this.gyro[i]; r.rotation.x += dt * (0.8 + i * 0.5) * (1 + this.glowV); r.rotation.y += dt * (0.5 + i * 0.7); }
    this.core.rotation.y += dt * 2;
    const g = this.glowV * (0.85 + 0.15 * Math.sin(t * 8));
    this.coreMat.color.setRGB(0.5 * g + 0.2, 2.2 * g + 0.4, 2.8 * g + 0.5);
    if (this.cast && this.cast.interruptible) this.coreMat.color.setRGB(2.0 * g + 0.4, 1.0 * g + 0.2, 3.2 * g + 0.6);
    this.pendulum.rotation.z = Math.sin(t * 1.8) * 0.45;
    this.minHand.rotation.z = -t * 1.2; this.hourHand.rotation.z = -t * 0.1;
    this.faceMat.emissiveIntensity = 0.05 + this.glowV * 0.08;
    if (this.light) { this.light.position.set(this.vis.x, 3.7, this.vis.z + 1.4); this.light.intensity = this.alive ? 6 + this.glowV * 10 : 0; this.light.color.copy(this.coreMat.color).multiplyScalar(0.35); }
    this.blob.position.set(0, 0.016 - this.vis.y, 0);
    for (const m of this.arcane) m.userData.arcane.uDissolve.value = this.dissolve;
    this.group.visible = this.dissolve < 0.999;
    this.bubble.visible = this.bubble.visible && this.alive;
  }
}

// ---------------------------------------------------------------- the encounter definition
ENCOUNTERS.training = {
  key: 'training', name: 'THE PENDULUM', epithet: 'Training Construct', index: -1, music: 'training',
  setup(ctx) {
    const arena = buildTrainingArena();
    const boss = new TrainingDummy(ctx);
    return { arena, boss };
  },
  /** intro rail: low on the platform looking north, then down to the construct */
  intro(ctx) {
    const b = Game.boss;
    return {
      dur: 4.2, ease: 'inOut', letterbox: true, skippable: true,
      pos: [[0, 1.2, 17], [6, 3.0, 9], [3, 4.5, 4], [0, 10, 14]],
      tgt: [[0, 9, -60], [0, 6, -20], [b.pos.x, 4.5, b.pos.z], [b.pos.x * 0.3, 2.0, b.pos.z * 0.3 + 6]],
      fov: [58, 52, 46, 50], roll: [0, -2, 1, 0],
      events: [
        { t: 1.6, fn: () => { b.pose('raise'); sfx('rumble', { dur: 1.6 }); CamRig.addTrauma(0.3); } },
        { t: 2.4, fn: () => { Banner.show('THE PENDULUM', 'Training Construct', { cls: 'cyan', dur: 1.4 }); b.pose('idle'); } },
      ],
    };
  },
};
