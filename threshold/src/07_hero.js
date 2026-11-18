// Hero model kit, shared by the class models: rim-lit materials, static parts merged per bone and material (so a detailed
// model stays at a few dozen draw calls), lathe / tube helpers and damped springs for cloth.
// A class with its own model registers a builder in HERO_MODELS under its class id; buildHero() in 07_player.js uses it and
// falls back to the generic model. A builder returns what buildHero returns: { group, update(dt, p), anim, wtip, body,
// swing(kind, dur) }. update() must tolerate a stand-in `p`: door VII's understudies pass only moveSpeed, grounded, casting,
// parryT and flashT. Colours come from cls.look (armor, cloth, glow; optional inner, metal, leather, lining) so a door can
// recolour the model (door VII does).
const HERO_MODELS = {};
const HeroKit = {
  // MeshStandardMaterial plus a view-angle rim (emissive) in uRim so the silhouette separates from dark arenas, and an optional
  // lining colour for back faces of double-sided cloth. rimU is a shared { value: Color } so the model can pulse it.
  mat(o, rimU, k = 1, lining) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0 }, o));
    const kU = { value: k }, linU = lining !== undefined ? { value: new THREE.Color(lining) } : null;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = rimU; sh.uniforms.uRimK = kU; if (linU) sh.uniforms.uLin = linU;
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; uniform float uRimK;' + (linU ? ' uniform vec3 uLin;' : '') + '\nvoid main() {')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (linU ? 'if (!gl_FrontFacing) diffuseColor.rgb = uLin;' : ''))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0);'
          + ' totalEmissiveRadiance += uRim * (uRimK * fr * fr * fr * (gl_FrontFacing ? 1.0 : 0.25)); }');
    };
    m.customProgramCacheKey = () => 'heroRim' + (linU ? 'L' : '');
    return m;
  },
  lathe(pts, segs = 16, phi0 = 0, len = TAU) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs, phi0, len); },
  tube(pts, r = 0.01, segs = 24, radial = 6) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new V3(x, y, z))), segs, r, radial, false); },
  // Collects geometry per (bone, material); finish() merges each bucket into one mesh on its bone.
  parts() {
    const B = new Map(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new V3(), S = new V3();
    return {
      add(bone, mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
        geo.applyMatrix4(M4.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)));
        let L = B.get(bone); if (!L) B.set(bone, L = new Map()); let a = L.get(mat); if (!a) L.set(mat, a = []); a.push(geo); return geo;
      },
      finish() { for (const [bone, L] of B) for (const [mat, a] of L) { const m = new THREE.Mesh(HeroKit.merge(a), mat); m.castShadow = !mat.isMeshBasicMaterial; bone.add(m); } B.clear(); },
    };
  },
  merge(list) {
    let nv = 0, ni = 0; for (const q of list) { nv += q.attributes.position.count; ni += q.index ? q.index.count : q.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let v = 0, i = 0;
    for (const q of list) {
      const n = q.attributes.position.count; pos.set(q.attributes.position.array, v * 3); nor.set(q.attributes.normal.array, v * 3); if (q.attributes.uv) uv.set(q.attributes.uv.array, v * 2);
      if (q.index) { const s = q.index.array; for (let k = 0; k < s.length; k++) idx[i++] = s[k] + v; } else for (let k = 0; k < n; k++) idx[i++] = v + k;
      v += n; q.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); return out;
  },
  // Critically-damped-ish spring for secondary motion. Substeps so a long frame cannot blow it up.
  spring(k = 80, d = 11) {
    return { x: 0, v: 0, step(target, dt) { const n = Math.ceil(Math.min(dt, 0.1) / 0.008) || 1, h = Math.min(dt, 0.1) / n; for (let i = 0; i < n; i++) { this.v += ((target - this.x) * k - this.v * d) * h; this.x += this.v * h; } return this.x; } };
  },
};

// ============================== STORMCALLER ==============================
// A hooded storm-mage: deep cowl with a shadowed face and two lit eyes, a pointed mantle over a high collar, a long split coat on
// five hinged panels with a lined swallowtail back, a front stole with glowing runes, bell sleeves, copper fittings, and a tall
// forked staff that holds a floating crystal and a Tesla coil. Static charges orbit the shoulders (one per point of Static).
HERO_MODELS.stormcaller = function buildStormcaller(cls) {
  const C = cls.look, K = HeroKit, P = K.parts(), g = new THREE.Group();
  const glowC = new THREE.Color(C.glow), clothC = new THREE.Color(C.cloth);
  const rimBase = glowC.clone().lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(0.22), rimU = { value: rimBase.clone() };
  const coatM = K.mat({ color: C.cloth, roughness: 0.86, side: THREE.DoubleSide }, rimU, 0.75, C.lining !== undefined ? C.lining : clothC.clone().multiplyScalar(0.55).getHex());
  const mantleM = K.mat({ color: C.mantle !== undefined ? C.mantle : clothC.clone().lerp(new THREE.Color(C.armor), 0.5).multiplyScalar(1.35), roughness: 0.8, side: THREE.DoubleSide }, rimU, 0.9);
  const innerM = K.mat({ color: C.inner !== undefined ? C.inner : 0x8c97a8, roughness: 0.9, side: THREE.DoubleSide }, rimU, 0.45);
  const legM = K.mat({ color: 0x14161d, roughness: 0.85 }, rimU, 0.5);
  const leatherM = K.mat({ color: C.leather !== undefined ? C.leather : 0x2c211b, roughness: 0.62 }, rimU, 0.55);
  const armorM = K.mat({ color: C.armor, roughness: 0.36, metalness: 0.7, envMapIntensity: 1.3 }, rimU, 1);
  const metalM = K.mat({ color: C.metal !== undefined ? C.metal : 0xb07a48, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.5, emissive: C.metal !== undefined ? C.metal : 0xb07a48, emissiveIntensity: 0.08 }, rimU, 0.9);
  const woodM = K.mat({ color: 0x2a1e17, roughness: 0.7 }, rimU, 0.6);
  const voidM = new THREE.MeshBasicMaterial({ color: 0x010204 });
  const crystalM = W.glow(C.glow, 3.0), runeM = W.glow(C.glow, 2.0), glowM = runeM, eyeM = runeM;
  const crystalBase = crystalM.color.clone(), runeBase = runeM.color.clone();
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };

  // ---- skeleton ----
  const body = grp(g), hips = grp(body, 0, 0.95, 0), torso = grp(hips, 0, 0.02, 0), head = grp(torso, 0, 0.69, 0.0);
  // ---- torso: coat body, inner robe V, harness, medallion, belt ----
  P.add(torso, coatM, K.lathe([[0.168, -0.08], [0.172, 0.06], [0.19, 0.22], [0.208, 0.36], [0.2, 0.48], [0.155, 0.59], [0.085, 0.67], [0.07, 0.74]], 22), 0, 0, 0, 0, 0, 0, 1, 1, 0.8);
  P.add(torso, innerM, K.lathe([[0.176, 0.1], [0.195, 0.24], [0.212, 0.36], [0.205, 0.48], [0.16, 0.6]], 6, -0.32, 0.64), 0, 0, 0, 0, 0, 0, 1, 1, 0.81); // robe showing in the coat's V
  P.add(torso, runeM, new THREE.BoxGeometry(0.012, 0.3, 0.01), 0, 0.33, 0.176);
  { const pts = []; for (let k = 0; k <= 16; k++) { const a = -0.9 + k / 16 * 4.3, y = 0.56 - k / 16 * 0.5; pts.push([Math.sin(a) * 0.218, y, Math.cos(a) * 0.178]); } P.add(torso, leatherM, K.tube(pts, 0.016, 40, 5)); }
  P.add(torso, metalM, new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), -0.06, 0.38, 0.17, PI / 2, 0, 0);
  P.add(torso, glowM, new THREE.OctahedronGeometry(0.026), -0.06, 0.38, 0.185, 0, 0, 0, 1, 1, 0.4);
  P.add(hips, leatherM, new THREE.TorusGeometry(0.18, 0.032, 6, 28), 0, 0.0, 0, PI / 2, 0, 0, 1, 1, 0.82);
  P.add(hips, metalM, new THREE.BoxGeometry(0.08, 0.07, 0.025), 0, 0.0, 0.155);
  P.add(hips, glowM, new THREE.BoxGeometry(0.03, 0.03, 0.012), 0, 0.0, 0.17, 0, 0, PI / 4);
  for (const s of [1, -1]) { P.add(hips, leatherM, new THREE.BoxGeometry(0.07, 0.09, 0.05), s * 0.165, -0.06, 0.04, 0, s * 0.5, 0); P.add(hips, metalM, new THREE.BoxGeometry(0.075, 0.02, 0.055), s * 0.165, -0.02, 0.04, 0, s * 0.5, 0); }
  // ---- mantle: pointed capelet, high collar with a copper rim ----
  { const mg = K.lathe([[0.37, 0.36], [0.34, 0.43], [0.27, 0.52], [0.18, 0.61], [0.1, 0.68]], 24), pa = mg.attributes.position;
    for (let i = 0; i < pa.count; i++) if (Math.abs(pa.getY(i) - 0.36) < 1e-4) { const a = Math.atan2(pa.getX(i), pa.getZ(i)), k = Math.round((a + PI) / TAU * 24); pa.setY(i, 0.36 + (k % 2 ? 0.05 : -0.04) - (Math.cos(a) < 0 ? 0.04 : 0)); }
    P.add(torso, mantleM, mg, 0, 0, -0.01, 0, 0, 0, 1, 1, 0.84); }

  // ---- head: deep swept-back cowl, shadowed face, eyes, cloth mask ----
  const HP = [[0.165, -0.06], [0.19, 0.02], [0.205, 0.1], [0.2, 0.18], [0.182, 0.245], [0.145, 0.295], [0.095, 0.325], [0.045, 0.342], [0.004, 0.348]], HG = 0.6;
  const hoodXf = (x, y, z) => { const u = Math.max(0, y - 0.1); z -= Math.pow(u, 1.5) * 1.1; if (z > 0.04) { const brow = Math.exp(-((y - 0.22) * (y - 0.22)) / 0.005); z += brow * 0.04; y -= brow * 0.012; } return [x, y, z * 1.06 - 0.01]; };
  { const hg = K.lathe(HP, 22, HG, TAU - 2 * HG), pa = hg.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setXYZ(i, ...hoodXf(pa.getX(i), pa.getY(i), pa.getZ(i)));
    hg.computeVertexNormals(); P.add(head, coatM, hg);
    const tip = new THREE.ConeGeometry(0.075, 0.26, 10, 1, true); tip.translate(0, 0.13, 0); const top = hoodXf(0, 0.33, -0.05); P.add(head, coatM, tip, 0, top[1] - 0.02, top[2] + 0.01, -2.0, 0, 0);
    const edge = []; for (let k = 0; k < HP.length * 2 - 1; k++) { const j = k < HP.length ? k : HP.length * 2 - 2 - k, s = k < HP.length ? 1 : -1, r = HP[j][0]; edge.push(hoodXf(r * Math.sin(HG) * s, HP[j][1], r * Math.cos(HG))); }
    P.add(head, metalM, K.tube(edge, 0.009, 48, 5)); }
  P.add(head, voidM, new THREE.SphereGeometry(0.13, 14, 10), 0, 0.11, 0.0, 0, 0, 0, 1, 1.05, 1);
  for (const s of [1, -1]) P.add(head, eyeM, new THREE.BoxGeometry(0.036, 0.011, 0.012), s * 0.045, 0.125, 0.128, 0, s * 0.35, s * -0.22);

  // ---- arms ----
  const mkArm = (side) => {
    const sh = grp(torso, side * 0.245, 0.55, -0.01);
    for (let k = 0; k < 3; k++) P.add(sh, k ? armorM : metalM, new THREE.SphereGeometry(0.11 - k * 0.006, 16, 6, 0, TAU, 0, PI * 0.42), side * (0.02 + k * 0.035), 0.05 - k * 0.05, 0, 0, 0, side * -(0.3 + k * 0.24), 1.12, 0.78, 1.12);
    P.add(sh, runeM, new THREE.OctahedronGeometry(0.018), side * 0.13, 0.03, 0, 0, 0, side * -0.4, 0.5, 1.4, 1);
    P.add(sh, coatM, K.lathe([[0.068, -0.3], [0.075, -0.2], [0.082, -0.08], [0.076, 0.02]], 12));
    const el = grp(sh, 0, -0.29, 0);
    P.add(el, leatherM, K.lathe([[0.048, -0.25], [0.056, -0.16], [0.06, -0.06], [0.055, 0.0]], 12));
    for (const y of [-0.07, -0.22]) P.add(el, metalM, new THREE.TorusGeometry(0.058, 0.008, 4, 16), 0, y, 0, PI / 2, 0, 0);
    P.add(el, runeM, new THREE.BoxGeometry(0.01, 0.1, 0.01), side * 0.061, -0.145, 0);
    P.add(el, coatM, K.lathe([[0.13, -0.19], [0.105, -0.12], [0.08, -0.04], [0.072, 0.02]], 14), 0, 0, -0.012, 0.12, 0, 0);
    P.add(el, metalM, new THREE.TorusGeometry(0.13, 0.007, 4, 22), 0, -0.19, -0.012 + 0.023, PI / 2 + 0.12, 0, 0);
    const hand = grp(el, 0, -0.275, 0);
    P.add(hand, leatherM, new THREE.SphereGeometry(0.046, 10, 8), 0, -0.02, 0.005, 0, 0, 0, 0.85, 1.25, 1.1);
    P.add(hand, leatherM, new THREE.CapsuleGeometry(0.016, 0.04, 3, 6), side * -0.035, -0.0, 0.03, 0.5, 0, side * 0.4);
    return { sh, el, hand };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  // ---- legs ----
  const mkLeg = (side) => {
    const hip = grp(hips, side * 0.1, -0.02, 0);
    P.add(hip, legM, K.lathe([[0.058, -0.45], [0.068, -0.3], [0.084, -0.12], [0.09, 0.02]], 12));
    const knee = grp(hip, 0, -0.45, 0);
    P.add(knee, leatherM, K.lathe([[0.062, -0.4], [0.057, -0.3], [0.066, -0.17], [0.074, -0.05], [0.086, 0.03], [0.094, 0.07]], 12));
    P.add(knee, metalM, new THREE.SphereGeometry(0.06, 10, 6, 0, TAU, 0, PI * 0.5), 0, 0.0, 0.045, PI / 2 - 0.2, 0, 0, 1, 1.2, 0.8);
    P.add(knee, metalM, new THREE.TorusGeometry(0.09, 0.007, 4, 16), 0, 0.06, 0, PI / 2, 0, 0);
    const ankle = grp(knee, 0, -0.42, 0);
    P.add(ankle, leatherM, new THREE.SphereGeometry(0.07, 12, 8), 0, -0.032, 0.045, 0, 0, 0, 0.78, 0.55, 1.55);
    P.add(ankle, leatherM, new THREE.BoxGeometry(0.1, 0.018, 0.2), 0, -0.062, 0.045);
    return { hip, knee, ankle };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  // ---- coat skirt: five hinged panels, the back one a swallowtail; each has a copper hem ----
  const R0 = 0.19, panels = [];
  const mkPanel = (phi, span, len, fork) => {
    const pv = grp(hips, Math.sin(phi) * R0, -0.03, Math.cos(phi) * R0); pv.rotation.y = phi;
    const prof = (y) => R0 + 0.13 * Math.pow(-y / 0.8, 0.85);
    const shape = (geo, yOff) => { const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), a = Math.atan2(x, pa.getZ(i)) / (span / 2);
      const cut = fork ? (1 - Math.abs(a)) * 0.2 : -Math.abs(a) * 0.03; if (y < -len + 0.035 + 1e-4) pa.setY(i, y + cut);
      const fold = 1 + 0.06 * Math.sin(a * span * 9 + phi * 5) * sat(-y / len) ** 1.3; pa.setX(i, x * fold); pa.setZ(i, pa.getZ(i) * fold); } geo.computeVertexNormals(); };
    const pts = []; for (let k = 0; k <= 6; k++) { const y = -len + k / 6 * len; pts.push([prof(y), y]); }
    const cg = K.lathe(pts, 8, -span / 2, span); shape(cg); P.add(pv, coatM, cg, 0, 0, -R0);
    const hy = -len, hg = K.lathe([[prof(hy) + 0.004, hy], [prof(hy + 0.035) + 0.004, hy + 0.035]], 8, -span / 2, span); shape(hg); P.add(pv, metalM, hg, 0, 0, -R0);
    panels.push({ pv, phi, spr: K.spring(70, 8) });
  };
  mkPanel(0.62, 0.95, 0.52, false); mkPanel(-0.62, 0.95, 0.52, false);
  mkPanel(1.72, 1.3, 0.66, false); mkPanel(-1.72, 1.3, 0.66, false);
  mkPanel(PI, 1.35, 0.82, true);
  // front stole between the legs, with three runes
  const stole = grp(hips, 0, -0.01, 0.2); const stoleSpr = K.spring(60, 7);
  { const sh = new THREE.Shape([new THREE.Vector2(-0.075, 0), new THREE.Vector2(0.075, 0), new THREE.Vector2(0.075, -0.5), new THREE.Vector2(0, -0.6), new THREE.Vector2(-0.075, -0.5)]);
    P.add(stole, innerM, new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }), 0, 0, -0.006);
    for (let k = 0; k < 3; k++) P.add(stole, runeM, new THREE.OctahedronGeometry(0.025), 0, -0.13 - k * 0.14, 0.009, 0, 0, 0, 0.8, 1.3, 0.25);
    P.add(stole, metalM, new THREE.BoxGeometry(0.16, 0.02, 0.02), 0, -0.005, 0.004); }
  // sash tails off the back-right of the belt
  const sash = [];
  for (const [sx, w, n] of [[-0.09, 0.065, 3], [-0.15, 0.05, 3]]) { let par = grp(hips, sx, -0.01, -0.165); const chain = [];
    for (let k = 0; k < n; k++) { const seg = grp(par, 0, k ? -0.17 : 0, 0); P.add(seg, innerM, new THREE.BoxGeometry(w, 0.175, 0.008), 0, -0.085, 0); chain.push({ o: seg, spr: K.spring(55 - k * 10, 6), sprZ: K.spring(40, 6) }); par = seg; }
    sash.push(chain); }

  // ---- staff: knotted shaft, grip wrap, copper bands and coil, forked head holding a floating crystal ----
  const weapon = grp(armR.hand, 0, -0.03, 0.01), wtip = new THREE.Object3D();
  { const pts = []; for (let k = 0; k <= 26; k++) { const y = -1.0 + k / 26 * 1.92; pts.push([0.02 + 0.004 * Math.sin(y * 21) + 0.006 * Math.exp(-((y + 0.45) ** 2) / 0.002) + 0.005 * Math.exp(-((y - 0.5) ** 2) / 0.002) + (y > 0.8 ? (y - 0.8) * 0.05 : 0), y]); }
    P.add(weapon, woodM, K.lathe(pts, 10)); }
  P.add(weapon, leatherM, K.lathe([[0.027, -0.12], [0.029, 0.0], [0.027, 0.13]], 10));
  P.add(weapon, metalM, K.lathe([[0.004, -1.05], [0.02, -1.0], [0.026, -0.96]], 10));
  for (const y of [-0.62, -0.14, 0.14, 0.6]) P.add(weapon, metalM, new THREE.TorusGeometry(0.026, 0.006, 4, 14), 0, y, 0, PI / 2, 0, 0);
  { const hel = []; for (let k = 0; k <= 60; k++) { const a = k / 60 * TAU * 6; hel.push([Math.cos(a) * 0.036, 0.66 + k / 60 * 0.22, Math.sin(a) * 0.036]); } P.add(weapon, metalM, K.tube(hel, 0.0055, 120, 4)); }
  P.add(weapon, metalM, K.lathe([[0.028, 0.88], [0.045, 0.94], [0.052, 0.99], [0.04, 1.03], [0.02, 1.05]], 12));
  for (const s of [1, -1]) {
    P.add(weapon, metalM, K.tube([[s * 0.03, 1.0, 0], [s * 0.1, 1.08, 0], [s * 0.135, 1.2, 0], [s * 0.115, 1.34, 0], [s * 0.05, 1.45, 0]], 0.013, 20, 6));
    P.add(weapon, metalM, K.tube([[s * 0.1, 1.08, 0], [s * 0.16, 1.1, 0.0], [s * 0.19, 1.16, 0]], 0.007, 8, 4));
    P.add(weapon, metalM, new THREE.SphereGeometry(0.018, 8, 6), s * 0.05, 1.45, 0);
  }
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.068, 0), crystalM); crystal.scale.y = 1.75; crystal.position.y = 1.24; weapon.add(crystal);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.0045, 4, 32), runeM); halo.position.y = 1.24; weapon.add(halo);
  wtip.position.set(0, 1.24, 0); weapon.add(wtip);
  // off-hand charge
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), crystalM); palm.position.set(0, -0.06, 0.05); armL.hand.add(palm);
  // lightning arcs inside the fork, between the hands while casting, and across the body under Tempest
  const NA = 6, SEG = 7, arcPos = new Float32Array(NA * SEG * 2 * 3), arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
  const arcMat = new THREE.LineBasicMaterial({ color: glowC.clone().multiplyScalar(3.2), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const arcs = new THREE.LineSegments(arcGeo, arcMat); arcs.frustumCulled = false; g.add(arcs);
  // Static charges and the Aegis ward
  const orbs = []; for (let i = 0; i < 4; i++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), crystalM); o.visible = false; g.add(o); orbs.push(o); }
  const ward = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.84, 6, 1), new THREE.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(1.6), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  ward.rotation.x = -PI / 2; ward.position.y = 0.06; g.add(ward);
  P.finish();
  const aura = new THREE.PointLight(C.glow, 1.4, 7, 1.5); aura.position.set(0, 0.5, 0.9); g.add(aura);

  const A = { run: 0, swing: 0, swingDur: 0.28, swingKind: 0, cast: 0, mend: 0, guard: 0, lean: 0, aim: 0, load: 0, blink: 0, air: 0, arcT: 0, vx: 0, vz: 0, lx: null, lz: null };
  const _v = new V3(), _w = new V3(), _a = new V3(), _b = new V3();
  // a jagged line from a to b (both in g's space) written into the arc buffer at slot i; off = hidden
  function arc(i, a, b, jag) {
    const o = i * SEG * 6; let px = a.x, py = a.y, pz = a.z;
    for (let k = 1; k <= SEG; k++) { const u = k / SEG, e = k === SEG ? 0 : jag * Math.sin(u * PI);
      const x = lerp(a.x, b.x, u) + (Math.random() - 0.5) * e, y = lerp(a.y, b.y, u) + (Math.random() - 0.5) * e, z = lerp(a.z, b.z, u) + (Math.random() - 0.5) * e;
      const q = o + (k - 1) * 6; arcPos[q] = px; arcPos[q + 1] = py; arcPos[q + 2] = pz; arcPos[q + 3] = x; arcPos[q + 4] = y; arcPos[q + 5] = z; px = x; py = y; pz = z; }
  }
  const off = (i) => arcPos.fill(0, i * SEG * 6, (i + 1) * SEG * 6);
  const local = (o, x, y, z, out) => { out.set(x, y, z); o.localToWorld(out); return g.worldToLocal(out); };

  function update(dt, p) {
    dt = Math.min(dt, 0.1); const t = G.now;
    const spd = p.moveSpeed || 0, grounded = p.grounded !== false, moving = spd > 0.5 && grounded;
    // own velocity in model space (for cloth), and teleports (Blink)
    const wp = g.position, f = g.rotation.y;
    if (A.lx !== null && dt > 0) { const dx = wp.x - A.lx, dz = wp.z - A.lz;
      if (dx * dx + dz * dz > 2.5) { A.blink = 1; for (const q of panels) q.spr.v -= 9; }
      else { A.vx = damp(A.vx, (dx * Math.cos(f) - dz * Math.sin(f)) / dt, 12, dt); A.vz = damp(A.vz, (dx * Math.sin(f) + dz * Math.cos(f)) / dt, 12, dt); } }
    A.lx = wp.x; A.lz = wp.z;
    A.lean = damp(A.lean, moving ? Math.min(1, spd / 7) : 0, 9, dt);
    A.run += dt * spd * 1.55; const ph = A.run, s = Math.sin(ph), c = Math.cos(ph), L = A.lean;
    const cast = p.casting, mend = !!(cast && cast.name === 'Mend');
    A.cast = damp(A.cast, cast && !mend ? 1 : 0, 10, dt); A.mend = damp(A.mend, mend ? 1 : 0, 8, dt);
    const prog = cast && cast.time ? sat(cast.t / cast.time) : 0, CA = A.cast, MA = A.mend;
    A.air = damp(A.air, grounded ? 0 : 1, 12, dt); A.blink = Math.max(0, A.blink - dt / 0.32);
    const storm = !!(p.hasBuff && p.hasBuff('tempest')), br = Math.sin(t * 1.7);

    // ---- base: idle stance blended into the run ----
    hips.position.y = 0.95 + br * 0.006 + L * (Math.abs(c) * 0.065 - 0.035);
    hips.rotation.set(0, s * 0.16 * L, Math.sin(t * 0.55) * 0.015 * (1 - L));
    body.rotation.set(0.05 + L * 0.16, 0, 0); body.position.set(0, 0, 0);
    torso.rotation.set(0.06 + br * 0.012 + L * 0.04, -s * 0.24 * L - 0.08 * (1 - L), 0);
    head.rotation.set(0.1 - L * 0.16, Math.sin(t * 0.37) * 0.1 * (1 - L) + 0.08 * (1 - L) + s * 0.1 * L, 0);
    let tl = lerp(-0.06, -s * 0.72, L), tr = lerp(0.1, s * 0.72, L), zl = 0.07 * (1 - L), zr = -0.07 * (1 - L);
    const kc = Math.cos(ph - 0.45); let kl = lerp(0.07, 0.12 + Math.pow(Math.max(0, kc), 1.5) * 1.0, L), kr = lerp(0.12, 0.12 + Math.pow(Math.max(0, -kc), 1.5) * 1.0, L);
    let lx = lerp(-0.12, s * 0.6, L), lz = 0.14 + 0.02 * L, le = lerp(-0.5, -0.75, L);
    let rx = lerp(-0.42, -0.35 - s * 0.25, L), rz = lerp(-0.3, -0.16, L), re = lerp(-0.62, -0.9, L), staffP = lerp(0.04, 0.55, L), staffR = 0;
    // ---- Bolt cast: plant, turn the staff shoulder in, raise the staff, reach with the off hand ----
    if (CA > 0.01) {
      const tr2 = Math.sin(t * 31) * 0.02 * prog;
      tl = lerp(tl, -0.3, CA); tr = lerp(tr, 0.3, CA); zl = lerp(zl, 0.16, CA); zr = lerp(zr, -0.12, CA); kl = lerp(kl, 0.3, CA); kr = lerp(kr, 0.2, CA);
      hips.position.y -= 0.045 * CA; hips.rotation.y += 0.12 * CA; torso.rotation.y += 0.1 * CA; torso.rotation.x -= 0.1 * prog * CA; head.rotation.y -= 0.2 * CA; head.rotation.x -= 0.06 * CA;
      rx = lerp(rx, -1.2 - prog * 0.25, CA); rz = lerp(rz, -0.14, CA); re = lerp(re, -0.45, CA); staffP = lerp(staffP, 0.3 + prog * 0.25, CA);
      lx = lerp(lx, -1.3 + tr2, CA); lz = lerp(lz, 0.32, CA); le = lerp(le, -0.4 + tr2, CA);
    }
    // ---- Mend: staff raised overhead, off hand on the heart ----
    if (MA > 0.01) { rx = lerp(rx, -2.55, MA); rz = lerp(rz, -0.15, MA); re = lerp(re, -0.15, MA); staffP = lerp(staffP, 0, MA); lx = lerp(lx, -0.95, MA); lz = lerp(lz, -0.45, MA); le = lerp(le, -1.9, MA); head.rotation.x -= 0.25 * MA; torso.rotation.x -= 0.08 * MA; }
    // ---- one-shot moves ----
    if (A.swing > 0) {
      A.swing -= dt; const k = 1 - Math.max(0, A.swing) / A.swingDur, e = smooth(k < 0.3 ? k / 0.3 : 1), fz = Math.sin(Math.min(1, k * 1.1) * PI);
      if (A.swingKind === 3) { rx = lerp(rx, -1.6, fz); re = lerp(re, -0.05, fz); staffP = lerp(staffP, 1.35, fz); lx = lerp(lx, 0.35, fz); le = lerp(le, -0.6, fz); body.rotation.x += 0.08 * fz; torso.rotation.y += 0.15 * fz; }
      else if (A.swingKind === 0) { rx = lerp(rx, lerp(-2.7, -0.95, e), fz); re = lerp(re, -0.2, fz); staffP = lerp(staffP, lerp(-0.5, 1.45, e), fz); torso.rotation.y += lerp(0.5, -0.45, e) * fz; lx = lerp(lx, 0.6, fz); lz = lerp(lz, 0.5, fz); body.rotation.x += 0.1 * e * fz; }
      else if (A.swingKind === 4) { rx -= fz * 0.45; re -= fz * 0.25; body.rotation.x -= fz * 0.05; }
      else { rx = lerp(rx, -1.7, fz); lx = lerp(lx, -1.7, fz); re = lerp(re, -0.1, fz); le = lerp(le, -0.1, fz); staffP = lerp(staffP, 1.2, fz); }
    }
    // ---- airborne: tuck, arms out ----
    if (A.air > 0.01) { const q = A.air; tl = lerp(tl, -0.75, q); tr = lerp(tr, -0.1, q); kl = lerp(kl, 1.15, q); kr = lerp(kr, 0.55, q); lz = lerp(lz, 0.5, q); lx = lerp(lx, -0.3, q); staffP = lerp(staffP, 0.35, q); }
    if (p.pose === 'fall') { body.rotation.x = 1.28 + Math.sin(t * 2.3) * 0.05 + L * 0.12; body.position.set(0, 0.75, -0.95); body.rotation.z = Math.sin(t * 1.7) * 0.05;
      tl = 0.25 + Math.sin(t * 5) * 0.05; tr = 0.25 - Math.sin(t * 5) * 0.05; kl = kr = 0.7; if (A.swing <= 0 && CA < 0.05) { lx = rx = -2.3; lz = 0.75; rz = -0.75; le = re = -0.5; staffP = 1.3; } }
    if (p.flashT > 0) { const q = p.flashT / 0.15; torso.rotation.x -= 0.14 * q; head.rotation.x -= 0.1 * q; }
    // ---- apply ----
    legL.hip.rotation.set(tl, 0, zl); legR.hip.rotation.set(tr, 0, zr); legL.knee.rotation.x = kl; legR.knee.rotation.x = kr;
    const tilt = body.rotation.x + hips.rotation.x;
    legL.ankle.rotation.x = clamp(-(tl + kl + tilt) * 0.85 + (L > 0.2 ? Math.max(0, -s) * 0.35 * L : 0), -0.9, 0.9); legR.ankle.rotation.x = clamp(-(tr + kr + tilt) * 0.85 + (L > 0.2 ? Math.max(0, s) * 0.35 * L : 0), -0.9, 0.9);
    armL.sh.rotation.set(lx, 0, lz); armR.sh.rotation.set(rx, 0, rz); armL.el.rotation.x = le; armR.el.rotation.x = re;
    // staff pitch is given in body space: undo the chain above the hand so it stays where it is aimed
    weapon.rotation.set(staffP - (tilt + torso.rotation.x + rx + re), 0, staffR - rz * 0.6);
    // ---- cloth ----
    const wind = (phi) => -(Math.sin(phi) * A.vx + Math.cos(phi) * A.vz) * 0.055;
    const flut = (phi, k) => Math.sin(t * k + phi * 3) * (0.04 * L + 0.05 * CA * prog + (storm ? 0.03 : 0));
    for (const q of panels) {
      const fr = Math.cos(q.phi), sd = Math.sin(q.phi);
      const legX = sd > 0 ? tl : tr, push = fr > 0.3 ? Math.max(0, -legX) * 1.0 + 0.04 : fr < -0.3 ? Math.max(0, Math.max(tl, tr)) * 0.8 + 0.03 : Math.max(0, Math.abs(legX)) * 0.35 + 0.05 * Math.abs(sd > 0 ? zl : zr) * 4;
      const tgt = clamp(push + wind(q.phi) + flut(q.phi, 8.5) + A.air * 0.45 + CA * prog * 0.18, -0.05, 1.25);
      q.pv.rotation.x = -clamp(q.spr.step(tgt, dt), -0.05, 1.3);
    }
    stole.rotation.x = -clamp(stoleSpr.step(Math.max(0, -Math.min(tl, tr)) * 1.05 + wind(0) * 0.6 + flut(0, 9) + A.air * 0.3, dt), -0.05, 1.3);
    for (const ch of sash) for (let k = 0; k < ch.length; k++) { const q = ch[k], tgt = clamp(A.vz * 0.085 - 0.05, -0.15, 1.25) * (k ? 0.35 : 1) + Math.sin(t * 7 - k * 1.3) * (0.06 * L + 0.02) + A.air * 0.3;
      q.o.rotation.x = q.spr.step(tgt + (k === 0 ? -tilt : 0), dt); q.o.rotation.z = q.sprZ.step(-A.vx * 0.05 * (k ? 0.4 : 1), dt); }
    // ---- glow, arcs, charges ----
    const pump = 1 + CA * (0.5 + prog * 0.9) + MA * 0.6 + (storm ? 0.45 : 0) + A.blink * 1.5 + (A.swing > 0 ? 0.6 : 0);
    crystalM.color.copy(crystalBase).multiplyScalar(pump); runeM.color.copy(runeBase).multiplyScalar(0.85 + 0.15 * Math.sin(t * 2.3) + (pump - 1) * 0.6);
    rimU.value.copy(rimBase).multiplyScalar(1 + CA * prog * 0.8 + A.blink * 2 + (storm ? 0.3 : 0));
    crystal.rotation.y += dt * (1.4 + CA * 7 + (storm ? 3 : 0)); crystal.position.y = 1.24 + Math.sin(t * 2.1) * 0.012; halo.rotation.set(t * 1.3, t * 0.9, 0); halo.scale.setScalar(1 + CA * prog * 0.35);
    palm.visible = CA > 0.03 || MA > 0.03; palm.scale.setScalar(Math.max(0.01, CA * (0.35 + prog * 0.75) + MA * 0.7) * (1 + Math.sin(t * 40) * 0.08));
    if (!G.headless && (A.arcT -= dt) <= 0) {
      A.arcT = 0.05 + Math.random() * 0.04;
      local(weapon, 0.05, 1.45, 0, _a); local(weapon, 0, 1.3, 0, _b); arc(0, _a, _b, 0.03);
      local(weapon, -0.05, 1.45, 0, _a); local(weapon, 0, 1.18, 0, _b); arc(1, _a, _b, 0.03);
      if (CA > 0.3) { local(armL.hand, 0, -0.06, 0.05, _a); local(weapon, 0, 1.24, 0, _b); arc(2, _a, _b, 0.12 + 0.1 * prog); } else off(2);
      if (CA > 0.5 && prog > 0.5) { local(weapon, 0, 1.24, 0, _a); _b.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5).add(_a); arc(3, _a, _b, 0.1); } else off(3);
      if (storm) { _a.set((Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 0.4); _b.set(_a.x + (Math.random() - 0.5) * 0.9, _a.y + (Math.random() - 0.5) * 0.7, _a.z + (Math.random() - 0.5) * 0.5); arc(4, _a, _b, 0.15); local(weapon, 0, 1.24, 0, _a); _b.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.2) * 0.7, (Math.random() - 0.5) * 0.8).add(_a); arc(5, _a, _b, 0.12); } else { off(4); off(5); }
      arcGeo.attributes.position.needsUpdate = true;
    }
    arcMat.opacity = Math.min(1, 0.35 + CA * 0.5 + (storm ? 0.3 : 0) + A.blink);
    const res = p.res | 0;
    for (let i = 0; i < 4; i++) { const o = orbs[i]; o.visible = i < res && !G.headless; if (!o.visible) continue; const a = t * 2.4 + i * TAU / 4;
      o.position.set(Math.cos(a) * 0.55, 1.32 + Math.sin(t * 3 + i * 1.7) * 0.07, Math.sin(a) * 0.55); o.scale.setScalar(res >= 4 ? 1.25 + Math.sin(t * 12 + i) * 0.15 : 1); }
    const sh = p.shield > 0 ? sat(p.shield / (p.shieldMax || 1)) : 0; ward.material.opacity = damp(ward.material.opacity, sh * 0.85, 12, dt); ward.visible = ward.material.opacity > 0.01; ward.rotation.z += dt * 0.8; ward.scale.setScalar(1 + Math.sin(t * 5) * 0.02);
    // Blink: arrive stretched thin and snap back
    const bk = A.blink * A.blink; body.scale.set(1 - 0.4 * bk, 1 + 0.35 * bk, 1 - 0.4 * bk);
    aura.intensity = 1.4 + CA * (1.5 + prog * 3) + MA * 2 + (storm ? 1 : 0) + (p.flashT > 0 ? 6 : 0) + A.blink * 6;
  }
  return { group: g, update, anim: A, wtip, body, swing(kind = 0, dur = 0.28) { A.swing = A.swingDur = dur; A.swingKind = kind; } };
};
