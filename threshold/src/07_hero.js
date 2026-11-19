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
// forked staff that holds a floating crystal and a Tesla coil. Static charges orbit the belt (one per point of Static; at shoulder
// height a lone charge beside the hood read as a face).
HERO_MODELS.stormcaller = function buildStormcaller(cls) {
  const C = cls.look, K = HeroKit, P = K.parts(), g = new THREE.Group();
  const glowC = new THREE.Color(C.glow), clothC0 = new THREE.Color(C.cloth), clothC = clothC0.clone();
  // play-distance value read: the coat is lifted and desaturated towards slate so it separates from dark, saturated floors
  { const h = {}; clothC.getHSL(h); clothC.setHSL(h.h, h.s * 0.5, Math.min(0.66, h.l * 1.55 + 0.045)); }
  const rimBase = glowC.clone().lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(0.4), rimU = { value: rimBase.clone() };
  // HeroKit rim with a wider falloff (fr^2 instead of fr^3) for this model only
  const mat = (o, k, lin) => { const m = K.mat(o, rimU, k, lin), ob = m.onBeforeCompile, key = m.customProgramCacheKey();
    m.onBeforeCompile = (sh, r) => { ob(sh, r); sh.fragmentShader = sh.fragmentShader.replace('uRimK * fr * fr * fr', 'uRimK * fr * fr'); }; m.customProgramCacheKey = () => key + 'W'; return m; };
  const coatM = mat({ color: clothC, roughness: 0.86, side: THREE.DoubleSide }, 0.8, C.lining !== undefined ? C.lining : clothC0.clone().multiplyScalar(0.55).getHex());
  const capeM = mat({ color: clothC.clone().multiplyScalar(0.92), roughness: 0.84, side: THREE.DoubleSide }, 0.85, glowC.clone().lerp(clothC, 0.45).multiplyScalar(0.4).getHex());
  const mantleM = mat({ color: (C.mantle !== undefined ? new THREE.Color(C.mantle) : clothC0.clone().lerp(new THREE.Color(C.armor), 0.5)).multiplyScalar(1.45), roughness: 0.8, side: THREE.DoubleSide }, 0.95);
  const innerM = mat({ color: C.inner !== undefined ? C.inner : 0x8c97a8, roughness: 0.9, side: THREE.DoubleSide }, 0.45);
  const legM = mat({ color: 0x4d5868, roughness: 0.85 }, 0.75);
  // light slate boots and a dark glove: the feet and hands read against dark floors and against the coat
  const bootM = mat({ color: 0x7c8a9c, roughness: 0.66 }, 0.7), gloveM = mat({ color: 0x2e3540, roughness: 0.7 }, 0.8);
  const copperC = new THREE.Color(C.metal !== undefined ? C.metal : 0xb07a48), sashM = mat({ color: copperC.clone().multiplyScalar(0.95), roughness: 0.6, metalness: 0.25, side: THREE.DoubleSide }, 0.7);
  const leatherM = mat({ color: C.leather !== undefined ? C.leather : 0x2c211b, roughness: 0.62 }, 0.6);
  const armorM = mat({ color: C.armor, roughness: 0.36, metalness: 0.7, envMapIntensity: 1.3 }, 1);
  const metalM = mat({ color: C.metal !== undefined ? C.metal : 0xb07a48, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.5, emissive: C.metal !== undefined ? C.metal : 0xb07a48, emissiveIntensity: 0.2 }, 0.9);
  // pauldron copper: deeper and duller than the trims, no emissive, low env, so its highlights stay under the bloom threshold
  const pauldM = mat({ color: C.metal !== undefined ? new THREE.Color(C.metal).multiplyScalar(0.85) : 0xa8643a, roughness: 0.55, metalness: 0.5, envMapIntensity: 0.55 }, 0.5);
  const woodM = mat({ color: 0x2a1e17, roughness: 0.7 }, 0.6);
  const voidM = new THREE.MeshBasicMaterial({ color: 0x010204 });
  const crystalM = W.glow(C.glow, 3.0), runeM = W.glow(C.glow, 2.4), glowM = runeM, eyeM = runeM, palmM = W.glow(C.glow, 1.7);
  const crystalBase = crystalM.color.clone(), runeBase = runeM.color.clone(), palmBase = palmM.color.clone(), handGlowM = W.glow(C.glow, 1.4);
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };

  // ---- skeleton ----
  const body = grp(g), hips = grp(body, 0, 0.95, 0), torso = grp(hips, 0, 0.02, 0), head = grp(torso, 0, 0.69, 0.0); let hoodTip;
  head.scale.setScalar(1.12); // a larger hood (head + peak about a quarter of the height) reads at play distance
  // ---- torso: coat body, inner robe V, harness, medallion, belt ----
  // waist pinched at the belt, chest broadening into wide shoulders (triangle over a bell)
  P.add(torso, coatM, K.lathe([[0.148, -0.08], [0.146, 0.04], [0.17, 0.16], [0.205, 0.3], [0.222, 0.42], [0.21, 0.5], [0.16, 0.6], [0.085, 0.67], [0.07, 0.74]], 22), 0, 0, 0, 0, 0, 0, 1, 1, 0.8);
  P.add(torso, innerM, K.lathe([[0.152, 0.04], [0.177, 0.16], [0.212, 0.3], [0.229, 0.42], [0.216, 0.5], [0.165, 0.6]], 6, -0.32, 0.64), 0, 0, 0, 0, 0, 0, 1, 1, 0.81); // robe showing in the coat's V
  P.add(torso, runeM, new THREE.BoxGeometry(0.02, 0.34, 0.01), 0, 0.3, 0.178);
  // back: glowing spine strip and a sigil on the mantle
  { const TP = [[0.148, -0.08], [0.146, 0.04], [0.17, 0.16], [0.205, 0.3], [0.222, 0.42], [0.21, 0.5]], rAt = (y) => { for (let k = 1; k < TP.length; k++) if (y <= TP[k][1]) return lerp(TP[k - 1][0], TP[k][0], (y - TP[k - 1][1]) / (TP[k][1] - TP[k - 1][1])); return 0.21; };
    const sp = []; for (let k = 0; k <= 8; k++) { const y = k / 8 * 0.42; sp.push([0, y, -(rAt(y) * 0.8 + 0.006)]); } P.add(torso, runeM, K.tube(sp, 0.011, 12, 4)); }
  P.add(torso, runeM, new THREE.OctahedronGeometry(0.05), 0, 0.47, -0.322, 0.7, 0, 0, 0.75, 1.3, 0.3);
  P.add(torso, metalM, new THREE.TorusGeometry(0.062, 0.009, 4, 18), 0, 0.47, -0.318, 0.7, 0, 0);
  { const pts = []; for (let k = 0; k <= 16; k++) { const a = -0.9 + k / 16 * 4.3, y = 0.56 - k / 16 * 0.5; pts.push([Math.sin(a) * 0.226, y, Math.cos(a) * 0.184]); } P.add(torso, leatherM, K.tube(pts, 0.016, 40, 5)); }
  P.add(torso, metalM, new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), -0.06, 0.38, 0.178, PI / 2, 0, 0);
  P.add(torso, glowM, new THREE.OctahedronGeometry(0.026), -0.06, 0.38, 0.193, 0, 0, 0, 1, 1, 0.4);
  P.add(hips, leatherM, new THREE.TorusGeometry(0.162, 0.034, 6, 28), 0, 0.0, 0, PI / 2, 0, 0, 1, 1, 0.82);
  P.add(hips, metalM, new THREE.BoxGeometry(0.09, 0.075, 0.025), 0, 0.0, 0.14);
  P.add(hips, glowM, new THREE.BoxGeometry(0.034, 0.034, 0.012), 0, 0.0, 0.155, 0, 0, PI / 4);
  for (const s of [1, -1]) { P.add(hips, leatherM, new THREE.BoxGeometry(0.07, 0.09, 0.05), s * 0.15, -0.06, 0.04, 0, s * 0.5, 0); P.add(hips, metalM, new THREE.BoxGeometry(0.075, 0.02, 0.055), s * 0.15, -0.02, 0.04, 0, s * 0.5, 0); }
  // ---- mantle: pointed capelet, high collar with a copper rim ----
  { const mg = K.lathe([[0.43, 0.35], [0.4, 0.43], [0.3, 0.53], [0.19, 0.62], [0.1, 0.69]], 24), pa = mg.attributes.position;
    for (let i = 0; i < pa.count; i++) if (Math.abs(pa.getY(i) - 0.35) < 1e-4) { const a = Math.atan2(pa.getX(i), pa.getZ(i)), k = Math.round((a + PI) / TAU * 24); pa.setY(i, 0.35 + (k % 2 ? 0.05 : -0.04) - (Math.cos(a) < 0 ? 0.04 : 0)); }
    P.add(torso, mantleM, mg, 0, 0, -0.01, 0, 0, 0, 1, 1, 0.84); }

  // ---- head: deep swept-back cowl, shadowed face, eyes, cloth mask ----
  const HP = [[0.165, -0.06], [0.19, 0.02], [0.205, 0.1], [0.2, 0.18], [0.182, 0.245], [0.145, 0.295], [0.095, 0.325], [0.045, 0.342], [0.004, 0.348]], HG = 0.6;
  const hoodXf = (x, y, z) => { const u = Math.max(0, y - 0.1); z -= Math.pow(u, 1.5) * 1.1; if (z > 0.04) { const brow = Math.exp(-((y - 0.22) * (y - 0.22)) / 0.005); z += brow * 0.04; y -= brow * 0.012; } return [x, y, z * 1.06 - 0.01]; };
  { const hg = K.lathe(HP, 22, HG, TAU - 2 * HG), pa = hg.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setXYZ(i, ...hoodXf(pa.getX(i), pa.getY(i), pa.getZ(i)));
    hg.computeVertexNormals(); P.add(head, coatM, hg);
    // tall peak swept up and back, on its own pivot so it can lag
    // peak: a full tapered cone (base about twice the old width, convex flank) swept back, not a spike
    const TPF = [[0.15, -0.04], [0.14, 0.04], [0.112, 0.12], [0.078, 0.2], [0.042, 0.28], [0.004, 0.35]], tbend = (y) => y * y * 0.6;
    const tip = K.lathe(TPF, 12); { const pa = tip.attributes.position; for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) - tbend(Math.max(0, pa.getY(i)))); tip.computeVertexNormals(); }
    const top = hoodXf(0, 0.27, -0.05); hoodTip = grp(head, 0, top[1] - 0.02, top[2] + 0.02); P.add(hoodTip, coatM, tip);
    P.add(hoodTip, metalM, K.tube(TPF.slice(1).map(([r, y]) => [0, y, -(r + 0.004) - tbend(y)]), 0.008, 10, 4));
    // copper trim: a flat band lying on the hood's outer face along the opening, ending at the collar (not a free tube)
    // round 3: the band is cut from the hood's own edge facet (first/last lathe column) and lifted 4 mm along its normal, so it
    // follows the cloth's exact curvature instead of a separate true-circle strip
    { const NP = HP.length, NS = 22, hp = hg.attributes.position, hn = hg.attributes.normal, bp = [], bn = [], bi = [];
      for (const [c0, c1] of [[0, 1], [NS, NS - 1]]) { const b0 = bp.length / 3;
        for (let j = 1; j < NP; j++) { const i0 = c0 * NP + j, i1 = c1 * NP + j; let nx = hn.getX(i0), ny = hn.getY(i0), nz = hn.getZ(i0);
          if (nx * hp.getX(i0) + nz * hp.getZ(i0) < 0) { nx = -nx; ny = -ny; nz = -nz; }
          for (const u of [0, 0.72]) { bp.push(lerp(hp.getX(i0), hp.getX(i1), u) + nx * 0.004, lerp(hp.getY(i0), hp.getY(i1), u) + ny * 0.004, lerp(hp.getZ(i0), hp.getZ(i1), u) + nz * 0.004); bn.push(nx, ny, nz); } }
        for (let j = 0; j < NP - 2; j++) { const a = b0 + j * 2, b = a + 1, c = a + 2, d = a + 3; bi.push(a, b, c, b, d, c, a, c, b, b, c, d); } }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3)); bg.setIndex(bi); P.add(head, metalM, bg); }
    const seam = []; for (let j = 1; j < HP.length - 1; j++) seam.push(hoodXf(0, HP[j][1], -(HP[j][0] + 0.005))); P.add(head, metalM, K.tube(seam, 0.009, 20, 4)); }
  P.add(head, voidM, new THREE.SphereGeometry(0.13, 14, 10), 0, 0.11, 0.0, 0, 0, 0, 1, 1.05, 1);
  for (const s of [1, -1]) P.add(head, eyeM, new THREE.BoxGeometry(0.036, 0.011, 0.012), s * 0.045, 0.125, 0.128, 0, s * 0.35, s * -0.22);

  // ---- arms ----
  const mkArm = (side) => {
    const sh = grp(torso, side * 0.265, 0.55, -0.01), pd = grp(torso, side * 0.265, 0.55, -0.01);
    // broad pauldrons, tilted out past the mantle so the shoulders carry the silhouette
    // copper top plates 1.3x larger than before: a warm mass that marks the hero at play distance on cold floors
    // round 3: two plates at ~80% size, outer edge tilted down a further 15 degrees, so the hood's jaw line shows from the side
    for (let k = 0; k < 2; k++) P.add(pd, k < 1 ? pauldM : armorM, new THREE.SphereGeometry(k < 1 ? 0.14 : 0.122, 16, 6, 0, TAU, 0, PI * 0.42), side * (0.035 + k * 0.05), 0.07 - k * 0.07, 0, 0, 0, side * -(0.62 + k * 0.3), 1.12, 0.78, 1.12);
    P.add(pd, runeM, new THREE.OctahedronGeometry(0.026), side * 0.099, 0.161, 0, 0, 0, side * -0.62, 1.1, 0.3, 1.6);
    P.add(sh, coatM, K.lathe([[0.068, -0.3], [0.075, -0.2], [0.082, -0.08], [0.076, 0.02]], 12));
    const el = grp(sh, 0, -0.29, 0);
    P.add(el, leatherM, K.lathe([[0.048, -0.25], [0.056, -0.16], [0.06, -0.06], [0.055, 0.0]], 12));
    // wide bell sleeve with one clean copper cuff
    // softer bell sleeve; the copper cuff is a thin band on the sleeve's own hem (same profile, same tilt), not a separate hoop
    // round 3: cuff flare cut ~30% and the sleeve ends higher, so a full hand length shows past the cuff
    P.add(el, coatM, K.lathe([[0.112, -0.18], [0.097, -0.11], [0.082, -0.04], [0.074, 0.02]], 14), 0, 0, -0.01, 0.1, 0, 0);
    P.add(el, metalM, K.lathe([[0.104, -0.186], [0.117, -0.181], [0.111, -0.152]], 14), 0, 0, -0.01, 0.1, 0, 0);
    // hands: a dark mitten (flat palm block, separate thumb wedge) with a cyan glow on the palm face
    const hand = grp(el, 0, -0.29, 0), mitt = grp(hand);
    P.add(mitt, gloveM, new THREE.CapsuleGeometry(0.038, 0.06, 3, 8), 0, -0.056, 0.004, 0, 0, 0, 0.66, 1, 1.1);
    P.add(mitt, gloveM, new THREE.CapsuleGeometry(0.018, 0.042, 2, 6), side * -0.014, -0.038, 0.046, 0.55, 0, side * -0.35, 1, 1, 0.8);
    P.add(mitt, gloveM, new THREE.CylinderGeometry(0.041, 0.037, 0.03, 10), 0, 0.0, 0.002); // wrist (each hand variant carries its own, so the hand bone holds no mesh)
    P.add(mitt, handGlowM, new THREE.BoxGeometry(0.004, 0.056, 0.05), side * -0.026, -0.06, 0.004);
    // the free hand also has an open hand (palm, three splayed finger wedges, thumb) shown in the big casts, palm glow on +z
    let open = null;
    if (side > 0) { open = grp(hand); open.visible = false; open.scale.setScalar(1.15);
      P.add(open, gloveM, new THREE.BoxGeometry(0.09, 0.08, 0.03), 0, -0.052, 0); P.add(open, gloveM, new THREE.CylinderGeometry(0.036, 0.032, 0.026, 10), 0, 0.0, 0.002);
      for (let k = -1; k <= 1; k++) P.add(open, gloveM, new THREE.ConeGeometry(0.026, 0.1, 4), k * 0.031, -0.135, 0, PI, 0, -k * 0.28, 1, 1, 0.42); // flat finger wedges
      P.add(open, gloveM, new THREE.ConeGeometry(0.022, 0.075, 4), side * 0.062, -0.035, 0.006, PI, 0, -side * 0.8, 1, 1, 0.5);
      P.add(open, palmM, new THREE.BoxGeometry(0.07, 0.064, 0.004), 0, -0.054, 0.017); }
    return { sh, el, hand, mitt, open, pd, z0: side * 0.2 };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  // ---- legs ----
  const mkLeg = (side) => {
    const hip = grp(hips, side * 0.1, -0.02, 0);
    // legs 1.4x thicker and lighter; tall light-slate boots with a copper cuff turned down at the knee
    P.add(hip, legM, K.lathe([[0.08, -0.45], [0.094, -0.3], [0.114, -0.12], [0.122, 0.02]], 12));
    const knee = grp(hip, 0, -0.45, 0);
    P.add(knee, bootM, K.lathe([[0.084, -0.4], [0.076, -0.3], [0.088, -0.17], [0.098, -0.05], [0.11, 0.03], [0.118, 0.07]], 12));
    P.add(knee, metalM, K.lathe([[0.116, 0.02], [0.13, 0.04], [0.134, 0.09], [0.12, 0.1]], 12)); // copper cuff
    P.add(knee, metalM, new THREE.SphereGeometry(0.07, 10, 6, 0, TAU, 0, PI * 0.5), 0, 0.0, 0.07, PI / 2 - 0.2, 0, 0, 1, 1.2, 0.8);
    const ankle = grp(knee, 0, -0.42, 0);
    P.add(ankle, bootM, new THREE.SphereGeometry(0.084, 12, 8), 0, -0.03, 0.045, 0, 0, 0, 0.82, 0.58, 1.5);
    P.add(ankle, leatherM, new THREE.BoxGeometry(0.12, 0.02, 0.23), 0, -0.064, 0.045);
    return { hip, knee, ankle };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  // ---- coat skirt: five hinged panels, the back one a swallowtail; each has a copper hem ----
  const R0 = 0.172, panels = [];
  const mkPanel = (phi, span, len, fork) => {
    const pv = grp(hips, Math.sin(phi) * R0, -0.03, Math.cos(phi) * R0); pv.rotation.y = phi;
    const prof = (y) => R0 + 0.175 * Math.pow(-y / 0.8, 0.95); // bell flare: hem about twice the belt radius
    const shape = (geo, yOff) => { const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), a = Math.atan2(x, pa.getZ(i)) / (span / 2);
      const cut = fork ? (1 - Math.abs(a)) * 0.2 : -Math.abs(a) * 0.03; if (y < -len + 0.035 + 1e-4) pa.setY(i, y + cut);
      const fold = 1 + 0.06 * Math.sin(a * span * 9 + phi * 5) * sat(-y / len) ** 1.3; pa.setX(i, x * fold); pa.setZ(i, pa.getZ(i) * fold); } geo.computeVertexNormals(); };
    const pts = []; for (let k = 0; k <= 6; k++) { const y = -len + k / 6 * len; pts.push([prof(y), y]); }
    const cg = K.lathe(pts, 8, -span / 2, span); shape(cg); P.add(pv, coatM, cg, 0, 0, -R0);
    const hy = -len, hg = K.lathe([[prof(hy) + 0.005, hy], [prof(hy + 0.05) + 0.006, hy + 0.05], [prof(hy + 0.1) + 0.004, hy + 0.1]], 8, -span / 2, span); /* round 3: hem band twice as tall */ shape(hg); P.add(pv, metalM, hg, 0, 0, -R0);
    if (fork) { const sp = []; for (let k = 0; k <= 6; k++) { const y = -0.02 - k / 6 * (len - 0.2); sp.push([0, y, prof(y) - R0 + 0.007]); } P.add(pv, runeM, K.tube(sp, 0.011, 12, 4)); } // the back spine strip continues down the tail
    panels.push({ pv, phi, spr: K.spring(70, 8) });
  };
  mkPanel(0.56, 1.08, 0.52, false); mkPanel(-0.56, 1.08, 0.52, false);
  mkPanel(1.72, 1.3, 0.66, false); mkPanel(-1.72, 1.3, 0.66, false);
  mkPanel(PI, 1.35, 0.82, true);
  // front stole between the legs, with three runes
  const stole = grp(hips, 0, -0.01, 0.185); const stoleSpr = K.spring(60, 7);
  { const w = 0.1, sh = new THREE.Shape([new THREE.Vector2(-w, 0), new THREE.Vector2(w, 0), new THREE.Vector2(w * 1.12, -0.52), new THREE.Vector2(0, -0.64), new THREE.Vector2(-w * 1.12, -0.52)]);
    P.add(stole, innerM, new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }), 0, 0, -0.006);
    P.add(stole, runeM, new THREE.BoxGeometry(0.018, 0.44, 0.006), 0, -0.25, 0.008);
    for (let k = 0; k < 3; k++) P.add(stole, runeM, new THREE.OctahedronGeometry(0.036), 0, -0.13 - k * 0.15, 0.009, 0, 0, 0, 0.8, 1.3, 0.25);
    P.add(stole, metalM, new THREE.BoxGeometry(0.21, 0.026, 0.02), 0, -0.005, 0.004); }
  // copper sash tails off the back of the belt (a second warm mass, seen from behind); round 3: longer and wider for the play camera
  const sash = [];
  for (const [sx, w, n] of [[-0.075, 0.13, 4], [-0.19, 0.1, 4]]) { let par = grp(hips, sx, -0.01, -0.172); const chain = [];
    for (let k = 0; k < n; k++) { const seg = grp(par, 0, k ? -0.17 : 0, 0); P.add(seg, sashM, new THREE.BoxGeometry(w * (1 - k * 0.08), 0.175, 0.01), 0, -0.085, 0); chain.push({ o: seg, spr: K.spring(55 - k * 10, 6), sprZ: K.spring(40, 6) }); par = seg; }
    sash.push(chain); }
  // the belt itself becomes a copper sash wrap
  P.add(hips, sashM, new THREE.TorusGeometry(0.168, 0.026, 5, 28), 0, -0.035, 0, PI / 2, 0, 0, 1, 1, 0.82);
  // split back cape under the mantle: two flaps with a lit lining and glowing inner edges framing the spine strip, on springs
  const cape = [];
  for (const s of [1, -1]) {
    const cp = grp(torso, 0, 0.45, -0.2), CPT = [[0.255, 0.02], [0.27, -0.15], [0.3, -0.36], [0.338, -0.6]], ph0 = s > 0 ? PI - 0.76 : PI + 0.07, edgeA = s > 0 ? PI - 0.07 : PI + 0.07;
    const cg = K.lathe(CPT, 7, ph0, 0.69); { const pa = cg.attributes.position; for (let i = 0; i < pa.count; i++) if (pa.getY(i) < -0.59) { const a = Math.abs(Math.atan2(pa.getX(i), -pa.getZ(i))); pa.setY(i, pa.getY(i) + (a - 0.07) * 0.16); } cg.computeVertexNormals(); }
    P.add(cp, capeM, cg, 0, 0, 0.2, 0, 0, 0, 1, 1, 0.8);
    const ed = CPT.map(([r, y]) => [Math.sin(edgeA) * (r + 0.004), y, Math.cos(edgeA) * (r + 0.004) * 0.8 + 0.2]); P.add(cp, runeM, K.tube(ed, 0.009, 10, 4));
    const hem = []; for (let k = 0; k <= 7; k++) { const a = ph0 + k / 7 * 0.69, r = 0.342, aa = Math.abs(Math.atan2(Math.sin(a), -Math.cos(a))); hem.push([Math.sin(a) * r, -0.6 + (aa - 0.07) * 0.16, Math.cos(a) * r * 0.8 + 0.2]); }
    P.add(cp, metalM, K.tube(hem, 0.01, 14, 4));
    cape.push({ o: cp, s, spr: K.spring(55, 6.5) });
  }

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
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), palmM); palm.position.set(0, -0.06, 0.05); armL.hand.add(palm);
  // lightning arcs inside the fork, between the hands while casting, and across the body under Tempest
  const NA = 6, SEG = 7, arcPos = new Float32Array(NA * SEG * 2 * 3), arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
  const arcMat = new THREE.LineBasicMaterial({ color: glowC.clone().multiplyScalar(3.2), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const arcs = new THREE.LineSegments(arcGeo, arcMat); arcs.frustumCulled = false; g.add(arcs);
  // Static charges and the Aegis ward
  const orbs = []; for (let i = 0; i < 4; i++) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), crystalM); o.visible = false; g.add(o); orbs.push(o); }
  const ward = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.84, 6, 1), new THREE.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(1.6), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  ward.rotation.x = -PI / 2; ward.position.y = 0.06; g.add(ward);
  // soft dark contact blob under the feet: anchors the figure on bright, busy floors
  const blob = (() => { const N = 32, d = new Uint8Array(N * N * 4); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i + 0.5) / N * 2 - 1, y = (j + 0.5) / N * 2 - 1, r = Math.sqrt(x * x + y * y), q = (j * N + i) * 4;
      d[q] = d[q + 1] = d[q + 2] = Math.round(255 * Math.pow(sat(1 - r), 1.6)); d[q + 3] = 255; }
    const tx = new THREE.DataTexture(d, N, N); tx.magFilter = tx.minFilter = THREE.LinearFilter; tx.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: tx, transparent: true, opacity: 0.6, depthWrite: false }));
    m.rotation.x = -PI / 2; m.position.y = 0.015; m.renderOrder = -1; g.add(m); return m; })();
  P.finish();
  const aura = new THREE.PointLight(C.glow, 0.9, 6, 1.5); aura.position.set(0, 1.1, 0.6); // round 3: higher and dimmer, so it no longer pools cyan under the feet g.add(aura);

  const A = { run: 0, swing: 0, swingDur: 0.28, swingKind: 0, cast: 0, mend: 0, guard: 0, lean: 0, aim: 0, load: 0, blink: 0, air: 0, arcT: 0, vx: 0, vz: 0, lx: null, lz: null, cp: 0, crk: 0, crkT: 2, hy: 0.95,
    bT: 9, bdx: 0, bdz: 1, aeg: 9, sh0: false, tmp: 9, st0: false };
  const headSX = K.spring(85, 12), headSY = K.spring(85, 12), tipSpr = K.spring(60, 6.5); headSX.x = 0.13;
  const _v = new V3(), _w = new V3(), _a = new V3(), _b = new V3(), _ik = new V3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
  // attack / hold / release envelope over a one-shot timer
  const env = (t, a, h, o) => t < a ? smooth(t / a) : t < h ? 1 : 1 - smooth(sat((t - h) / o));
  // two-bone arm IK (upper arm and forearm 0.29): T is the wrist target relative to the shoulder in torso space; out = (sh.x, sh.z, elbow.x)
  const solveArm = (T, out) => { const a = 0.29, ce = clamp((T.lengthSq() - 2 * a * a) / (2 * a * a), -1, 1), e = -Math.acos(ce), hy = -a - a * Math.cos(e), hz = -a * Math.sin(e);
    const z = Math.asin(clamp(T.x / -hy, -1, 1)); return out.set(Math.atan2(T.z, T.y) - Math.atan2(hz, hy * Math.cos(z)), z, e); };
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
      if (dx * dx + dz * dz > 2.5) { A.blink = 1; A.bT = 0; const dl = Math.sqrt(dx * dx + dz * dz); A.bdx = (dx * Math.cos(f) - dz * Math.sin(f)) / dl; A.bdz = (dx * Math.sin(f) + dz * Math.cos(f)) / dl;
        // arrival: the cloth on the trailing side is flung back, the leading side pressed in (it overshoots forward as the body settles)
        for (const q of panels) q.spr.v += 7 * -(Math.sin(q.phi) * A.bdx + Math.cos(q.phi) * A.bdz); for (const q of cape) q.spr.v += 9 * Math.max(0.3, A.bdz); }
      else { A.vx = damp(A.vx, (dx * Math.cos(f) - dz * Math.sin(f)) / dt, 12, dt); A.vz = damp(A.vz, (dx * Math.sin(f) + dz * Math.cos(f)) / dt, 12, dt); } }
    A.lx = wp.x; A.lz = wp.z;
    A.lean = damp(A.lean, moving ? Math.min(1, spd / 7) : 0, 9, dt);
    A.run += dt * spd * 1.55; const ph = A.run, s = Math.sin(ph), c = Math.cos(ph), L = A.lean;
    const cast = p.casting, mend = !!(cast && cast.name === 'Mend');
    A.cast = damp(A.cast, cast && !mend ? 1 : 0, 10, dt); A.mend = damp(A.mend, mend ? 1 : 0, 8, dt);
    const prog = cast && cast.time ? sat(cast.t / cast.time) : 0, CA = A.cast, MA = A.mend;
    A.air = damp(A.air, grounded ? 0 : 1, 12, dt); A.blink = Math.max(0, A.blink - dt / 0.32);
    const storm = !!(p.hasBuff && p.hasBuff('tempest'));

    // ---- base: idle stance (weight on the free-hand leg, hips cocked off the staff, staff leaning out) blended into the run ----
    const I = 1 - L, br2 = Math.sin(t * 1.57); // breathing at 0.25 Hz
    // idle contrapposto: pelvis shifted and cocked over the free-hand leg, shoulders counter-tilted (the free one dropped)
    // round 3 walk: the legs swing symmetrically about vertical (the old whole-body tilt threw the trailing leg out straight
    // behind, which read as a kick forward); the lean is in the torso only (~10 degrees), the head looks ahead, and the hips bob
    // ~8 cm (low at contact, high at passing)
    hips.position.set(0.07 * I, 0.95 - 0.014 * I + br2 * 0.006 + L * (Math.abs(c) * 0.08 - 0.05), 0);
    hips.rotation.set(0, s * 0.17 * L, (0.16 + Math.sin(t * 0.55) * 0.012) * I);
    body.rotation.set(0.04 * I, 0, 0); body.position.set(0, 0, 0);
    torso.rotation.set(0.06 + br2 * 0.014 + L * 0.13, -s * 0.3 * L - 0.08 * I, -0.2 * I);
    head.rotation.set(0.13 - L * 0.08, Math.sin(t * 0.37) * 0.1 * I + 0.08 * I + s * 0.1 * L, 0.06 * I);
    // knee by leg phase q (contact at q = pi/2): 24 degrees bent at heel strike, ~9 through mid-stance, folding from toe-off to ~50 mid-swing
    const kn = (q) => 0.42 - 0.26 * Math.max(0, -Math.cos(q)) + 0.45 * Math.max(0, Math.cos(q + 0.25));
    let tl = lerp(-0.06, -s * 0.4, L), tr = lerp(0.1, s * 0.4, L), zl = -0.13 * I, zr = -0.33 * I;
    let kl = lerp(0.04, kn(ph), L), kr = lerp(0.16, kn(ph + PI), L), lunge = 0, relW = 0, openW = 0;
    // free arm counter-swings ~20 degrees with the elbow folding as it comes forward; the staff tip lags the hand by half a beat
    let lx = lerp(-0.22, s * 0.36, L), lz = 0.2 - 0.04 * L, le = lerp(-0.78, -0.6 - Math.max(0, -s) * 0.3, L);
    let rx = lerp(-0.3, -0.35 - s * 0.22, L), rz = lerp(-0.32, -0.16, L), re = lerp(-0.55, -0.9, L), staffP = lerp(0.14, 0.5 - 0.17 * Math.cos(ph), L), staffR = 0.45 * I;
    armL.sh.position.y = 0.55 + br2 * 0.007 - 0.03 * I; armR.sh.position.y = 0.55 + br2 * 0.007;
    // overrides used by the held poses: right-hand IK target (torso space), left hand on the staff, staff orientation in model space
    let ikR = 0, ikL = 0, stW = 0, stX = 0, stZ = 0, grip = 0; const RT = _w;
    // ---- Bolt cast: wind up (torso coiled, staff raised and swept back, off hand drawn to the hip cupping the charge), then snap
    // to full extension (off hand thrust out, staff levelled) for the last stretch of the cast ----
    if (CA > 0.01) {
      if (cast && !mend) A.cp = prog; const cp = A.cp, ex = smooth(sat((cp - 0.72) / 0.07)), tr2 = Math.sin(t * 31) * 0.02 * cp * ex, coil = 0.44 * (1 - ex) - 0.14 * ex;
      tl = lerp(tl, -0.3, CA); tr = lerp(tr, 0.3, CA); zl = lerp(zl, 0.16, CA); zr = lerp(zr, -0.14, CA); kl = lerp(kl, 0.3, CA); kr = lerp(kr, 0.2, CA); staffR = lerp(staffR, 0, CA);
      hips.position.y -= 0.045 * CA; hips.position.x *= 1 - CA; hips.rotation.z *= 1 - CA; torso.rotation.z *= 1 - CA;
      hips.rotation.y += 0.12 * CA; torso.rotation.y += coil * CA; torso.rotation.x += (0.1 * ex - 0.04) * CA; head.rotation.y -= (0.14 + coil) * CA; head.rotation.x -= 0.06 * CA;
      rx = lerp(rx, lerp(-2.05, -1.3, ex), CA); rz = lerp(rz, lerp(-0.22, -0.14, ex), CA); re = lerp(re, lerp(-0.4, -0.4, ex), CA); staffP = lerp(staffP, lerp(-0.32, 0.6, ex), CA);
      lx = lerp(lx, lerp(0.38, -1.45 + tr2, ex), CA); lz = lerp(lz, lerp(0.3, 0.22, ex), CA); le = lerp(le, lerp(-1.35, -0.08 + tr2, ex), CA);
      relW = CA * ex; lunge = 0.7 * CA * ex; // the snap opens the free hand and starts the lunge
    }
    // ---- Mend: staff raised overhead, off hand on the heart ----
    if (MA > 0.01) { rx = lerp(rx, -2.55, MA); rz = lerp(rz, -0.15, MA); re = lerp(re, -0.15, MA); staffP = lerp(staffP, 0, MA); lx = lerp(lx, -0.95, MA); lz = lerp(lz, -0.45, MA); le = lerp(le, -1.9, MA); head.rotation.x -= 0.25 * MA; torso.rotation.x -= 0.08 * MA; }
    // ---- Aegis: a wide braced stance behind the staff - feet ~1.5x shoulder width, hips dropped ~10% of height, staff planted
    // vertical at arm's length in front with both hands on it, elbows out, head ducked, cape spread wide (held ~1 s) ----
    { const on = (p.shield || 0) > 0; if (on && !A.sh0) A.aeg = 0; A.sh0 = on; A.aeg = Math.min(9, A.aeg + dt); }
    const wA = A.aeg < 1.4 ? env(A.aeg, 0.14, 1.0, 0.35) * (1 - CA) * (1 - MA) : 0;
    if (wA > 0.001) { const w = wA, wl = w * (1 - 0.7 * L);
      hips.position.y -= 0.19 * wl; hips.position.x *= 1 - w; hips.rotation.z *= 1 - w; torso.rotation.z *= 1 - w; torso.rotation.y *= 1 - w; body.rotation.x += 0.03 * w;
      tl = lerp(tl, -0.6, wl); tr = lerp(tr, 0.38, wl); kl = lerp(kl, 1.05, wl); kr = lerp(kr, 0.38, wl); zl = lerp(zl, 0.4, wl); zr = lerp(zr, -0.4, wl);
      torso.rotation.x += 0.16 * w; head.rotation.x += 0.26 * w; head.rotation.y *= 1 - w;
      RT.set(-0.1, 0.4, 0.5); ikR = w; ikL = w; stW = w; stX = 0; stZ = 0; }
    // ---- Tempest: staff thrust overhead at arm's length, free arm flung out and back, spine arched, cloth blown upward ----
    if (storm && !A.st0) { A.tmp = 0; A.aeg = 9; for (const q of panels) q.spr.v += 6; for (const q of cape) q.spr.v += 7; stoleSpr.v += 4; }
    A.st0 = storm; A.tmp = Math.min(9, A.tmp + dt);
    const wT = A.tmp < 1.8 ? env(A.tmp, 0.16, 1.3, 0.45) * (1 - CA) * (1 - MA) : 0;
    if (wT > 0.001) { const w = wT, wl = w * (1 - 0.7 * L);
      rx = lerp(rx, -2.95, w); rz = lerp(rz, -0.14, w); re = lerp(re, -0.04, w); staffP = lerp(staffP, -0.08, w); staffR = lerp(staffR, 0.05, w);
      lx = lerp(lx, 0.6, w); lz = lerp(lz, 1.3, w); le = lerp(le, -0.15, w);
      hips.position.x *= 1 - w; hips.rotation.z *= 1 - w; torso.rotation.z *= 1 - w; torso.rotation.y = lerp(torso.rotation.y, 0.1, w);
      torso.rotation.x -= 0.35 * w; head.rotation.x -= 0.3 * w; head.rotation.y *= 1 - w; hips.position.y -= 0.02 * wl; hips.position.z += 0.05 * w; openW = w;
      tl = lerp(tl, -0.12, wl); tr = lerp(tr, 0.16, wl); kl = lerp(kl, 0.12, wl); kr = lerp(kr, 0.2, wl); zl = lerp(zl, 0.17, wl); zr = lerp(zr, -0.17, wl); }
    // ---- Blink arrival: crouched and leaning ~30 degrees into the travel direction, arms and staff swept back, then rising ----
    A.bT = Math.min(9, A.bT + dt);
    const wB = A.bT < 0.4 ? (A.bT < 0.07 ? 1 : 1 - smooth(sat((A.bT - 0.07) / 0.28))) : 0, wS = A.bT < 0.5 ? Math.sin(PI * sat((A.bT - 0.04) / 0.32)) : 0;
    if (wB > 0.001) { const w = wB;
      body.rotation.x += 0.22 * w * A.bdz; body.rotation.z -= 0.22 * w * A.bdx; torso.rotation.x += 0.3 * w; head.rotation.x -= 0.18 * w; hips.position.y -= 0.16 * w;
      hips.rotation.z *= 1 - w; torso.rotation.z *= 1 - w;
      tl = lerp(tl, -0.8, w); tr = lerp(tr, -0.6, w); kl = lerp(kl, 1.25, w); kr = lerp(kr, 1.15, w); zl = lerp(zl, 0.12, w); zr = lerp(zr, -0.12, w);
      lx = lerp(lx, 0.8, w); lz = lerp(lz, 0.35, w); le = lerp(le, -0.3, w); rx = lerp(rx, 0.55, w); rz = lerp(rz, -0.3, w); re = lerp(re, -0.3, w); staffP = lerp(staffP, -1.25, w); staffR = lerp(staffR, 0, w); }
    // ---- one-shot moves ----
    if (A.swing > 0) {
      A.swing -= dt; const k = 1 - Math.max(0, A.swing) / A.swingDur, e = smooth(k < 0.3 ? k / 0.3 : 1), fz = Math.sin(Math.min(1, k * 1.1) * PI);
      // Bolt release: staff snaps forward, then kicks back with the body recoiling (the coat overshoots from the impulse in swing())
      if (A.swingKind === 3) { const h = k < 0.12 ? smooth(k / 0.12) : 1 - smooth(sat((k - 0.55) / 0.45)), r = smooth(sat((k - 0.16) / 0.3));
        rx = lerp(rx, lerp(-1.6, -1.05, r), h); re = lerp(re, lerp(-0.05, -0.55, r), h); staffP = lerp(staffP, lerp(1.35, -0.3, r), h); lx = lerp(lx, -1.2, h); le = lerp(le, -0.2, h);
        body.rotation.x += lerp(0.08, -0.11, r) * h; torso.rotation.y += lerp(0.15, -0.05, r) * h; head.rotation.x -= 0.08 * r * h;
        relW = Math.max(relW, h); lunge = Math.max(lunge, h); }
      // Discharge: a symmetric Y held through the flash - both arms open 45 degrees above horizontal in the frontal plane, the staff
      // continuing the line of its arm outward, chest forward, head thrown back, feet wide
      else if (A.swingKind === 0) { const h = k < 0.16 ? smooth(k / 0.16) : 1 - smooth(sat((k - 0.72) / 0.28));
        rx = lerp(rx, -0.12, h); rz = lerp(rz, -2.3, h); re = lerp(re, -0.06, h); lx = lerp(lx, -0.12, h); lz = lerp(lz, 2.3, h); le = lerp(le, -0.06, h);
        stW = h; stX = 0.05; stZ = 0.72; grip = 0.42 * h; ikR = ikL = 0;
        // round 3: weight under it - feet wide, knees bent, hips dropped, head back ~11 degrees, the free hand open palm-out
        zl = lerp(zl, 0.38, h); zr = lerp(zr, -0.38, h); kl = lerp(kl, 0.7, h); kr = lerp(kr, 0.7, h); tl = lerp(tl, -0.35, h); tr = lerp(tr, -0.35, h);
        hips.position.x *= 1 - h; hips.rotation.z *= 1 - h; torso.rotation.z *= 1 - h; torso.rotation.y *= 1 - h; head.rotation.y *= 1 - h;
        torso.rotation.x -= 0.12 * h; head.rotation.x -= 0.2 * h; body.rotation.x += 0.03 * h; hips.position.y -= 0.11 * h; openW = Math.max(openW, h); }
      else if (A.swingKind === 4) { rx -= fz * 0.45; re -= fz * 0.25; body.rotation.x -= fz * 0.05; }
      else { rx = lerp(rx, -1.7, fz); lx = lerp(lx, -1.7, fz); re = lerp(re, -0.1, fz); le = lerp(le, -0.1, fz); staffP = lerp(staffP, 1.2, fz); }
    }
    // ---- Bolt release lunge: ~30 cm forward onto the left foot, rear heel lifted, hips low and forward ----
    if (lunge > 0.001) { const w = lunge * (1 - 0.7 * L);
      tl = lerp(tl, -0.75, w); kl = lerp(kl, 0.78, w); tr = lerp(tr, 0.45, w); kr = lerp(kr, 0.32, w); zl = lerp(zl, 0.12, w); zr = lerp(zr, -0.1, w);
      hips.position.y -= 0.07 * w; hips.position.z += 0.07 * w; torso.rotation.x += 0.06 * w; }
    openW = Math.max(openW, relW);
    // ---- airborne: tuck, arms out ----
    if (A.air > 0.01) { const q = A.air; tl = lerp(tl, -0.75, q); tr = lerp(tr, -0.1, q); kl = lerp(kl, 1.15, q); kr = lerp(kr, 0.55, q); lz = lerp(lz, 0.5, q); lx = lerp(lx, -0.3, q); staffP = lerp(staffP, 0.35, q); }
    if (p.pose === 'fall') { body.rotation.x = 1.28 + Math.sin(t * 2.3) * 0.05 + L * 0.12; body.position.set(0, 0.75, -0.95); body.rotation.z = Math.sin(t * 1.7) * 0.05;
      tl = 0.25 + Math.sin(t * 5) * 0.05; tr = 0.25 - Math.sin(t * 5) * 0.05; kl = kr = 0.7; if (A.swing <= 0 && CA < 0.05) { lx = rx = -2.3; lz = 0.75; rz = -0.75; le = re = -0.5; staffP = 1.3; } }
    if (p.flashT > 0) { const q = p.flashT / 0.15; torso.rotation.x -= 0.14 * q; head.rotation.x -= 0.1 * q; }
    // ---- apply ----
    head.rotation.x = headSX.step(head.rotation.x, dt); head.rotation.y = headSY.step(head.rotation.y, dt); // the head trails the body by ~0.1 s
    legL.hip.rotation.set(tl, 0, zl); legR.hip.rotation.set(tr, 0, zr); legL.knee.rotation.x = kl; legR.knee.rotation.x = kr;
    const tilt = body.rotation.x + hips.rotation.x;
    // foot roll: heel strike toe-up on the leading foot, toe-off heel-up on the trailing one
    legL.ankle.rotation.x = clamp(-(tl + kl + tilt) * 0.85 + (L > 0.2 ? (Math.max(0, -s) * 0.8 - Math.max(0, s) ** 2 * 0.25) * L : 0), -0.9, 0.9); legR.ankle.rotation.x = clamp(-(tr + kr + tilt) * 0.85 + (L > 0.2 ? (Math.max(0, s) * 0.8 - Math.max(0, -s) ** 2 * 0.25) * L : 0) + 0.5 * lunge, -0.9, 0.9);
    if (ikR > 0.001) { solveArm(_ik.copy(RT).sub(armR.sh.position), _v); rx = lerp(rx, _v.x, ikR); rz = lerp(rz, _v.y, ikR); re = lerp(re, _v.z, ikR); }
    armL.sh.rotation.set(lx, 0, lz); armR.sh.rotation.set(rx, 0, rz); armL.el.rotation.x = le; armR.el.rotation.x = re;
    // braced holds swing the elbows out: the arm chain turns about the shoulder-wrist line, so the hand stays put
    if (ikR > 0.001) armR.sh.quaternion.premultiply(_q1.setFromAxisAngle(_ik.copy(RT).sub(armR.sh.position).normalize(), -0.55 * ikR));
    // the free hand opens (palm glow out) in the big casts; at the bolt release the wrist cocks back so the palm faces the target
    { const ow = openW > 0.5; armL.open.visible = ow; armL.mitt.visible = !ow; armL.hand.rotation.set(-1.5 * relW, PI * relW, 0); }
    // pauldrons follow the arm only partly, so a raised arm lifts the plate instead of swinging it into the hood
    for (const [a, x, z] of [[armL, lx, lz], [armR, rx, rz]]) { a.pd.position.y = a.sh.position.y; a.pd.rotation.set(x * 0.3, 0, (z - a.z0) * 0.4 + a.z0); }
    // staff pitch is given in body space: undo the chain above the hand so it stays where it is aimed
    weapon.position.y = -0.03 - grip; weapon.rotation.set(staffP - (tilt + torso.rotation.x + rx + re), 0, staffR - rz * 0.6);
    // held poses aim the staff exactly in model space, and can put the off hand on the shaft
    if (stW > 0.001) { g.getWorldQuaternion(_q1).multiply(_q2.setFromEuler(_e.set(stX, 0, stZ))); armR.hand.getWorldQuaternion(_q2).invert().multiply(_q1); weapon.quaternion.slerp(_q2, stW); }
    if (ikL > 0.001) { weapon.updateWorldMatrix(true, false); weapon.localToWorld(_ik.set(0, 0.24, 0)); torso.worldToLocal(_ik).sub(armL.sh.position); solveArm(_ik, _v);
      armL.sh.rotation.set(lerp(lx, _v.x, ikL), 0, lerp(lz, _v.y, ikL)); armL.el.rotation.x = lerp(le, _v.z, ikL);
      armL.sh.quaternion.premultiply(_q1.setFromAxisAngle(_ik.normalize(), 0.55 * ikL)); }
    // ---- cloth ----
    const wind = (phi) => -(Math.sin(phi) * A.vx + Math.cos(phi) * A.vz) * 0.055;
    const flut = (phi, k) => Math.sin(t * k + phi * 3) * (0.04 * L + 0.05 * CA * prog + (storm ? 0.03 : 0));
    for (const q of panels) {
      const fr = Math.cos(q.phi), sd = Math.sin(q.phi);
      // front panels ride over the forward knee and are dragged partly by the other leg too, so the front never splits wide open
      const legX = sd > 0 ? tl : tr, legO = sd > 0 ? tr : tl, push = fr > 0.3 ? Math.max(0, -legX) * 0.85 + Math.max(0, -legO) * 0.35 + 0.05 : fr < -0.3 ? Math.max(0, Math.max(tl, tr)) * 0.8 + 0.03 : Math.max(0, Math.abs(legX)) * 0.35 + 0.05 * Math.abs(sd > 0 ? zl : zr) * 4;
      const lead = -(sd * A.bdx + fr * A.bdz); // blink: the leading side overshoots forward while the body settles
      const tgt = clamp(push + wind(q.phi) + flut(q.phi, 8.5) + A.air * 0.45 + CA * prog * 0.18 + (0.02 + 0.02 * Math.sin(t * 1.3 + q.phi * 2)) * (1 - L)
        - lead * 0.6 * wS + wT * (0.85 + 0.12 * Math.sin(t * 9 + q.phi * 3)) + lunge * (fr < -0.3 ? 0.45 : fr > 0.3 ? -0.1 : 0.15) + (storm ? 0.07 : 0), -0.05, 1.25);
      q.pv.rotation.x = -clamp(q.spr.step(tgt, dt), -0.05, 1.3);
    }
    // back cape: trails the motion, kept near vertical against the body's lean, lifts off the stride
    const lean = tilt + torso.rotation.x;
    for (const q of cape) { const tgt = clamp(A.vz * 0.03, -0.05, 0.3) + Math.max(0, Math.max(tl, tr)) * 0.15 + flut(q.s, 7.5) * 1.2 + A.air * 0.5 + CA * prog * 0.12 + 0.03 * Math.sin(t * 1.1 + q.s) * (1 - L) - lean * 0.8
        + wB * 0.5 - wS * 0.32 + wT * (0.95 + 0.15 * Math.sin(t * 8 + q.s * 2)) + wA * 0.3 + lunge * 0.3;
      q.o.rotation.x = clamp(q.spr.step(tgt, dt), -0.04 - 0.3 * wS, 1.2); q.o.rotation.z = clamp(-A.vx * 0.03, -0.25, 0.25) + q.s * 0.03 * clamp(A.vz * 0.1, 0, 1) + q.s * (0.42 * wA + 0.4 * wT); } // Aegis / Tempest spread the flaps wide
    // hood peak swept back, lagging the head and the bob
    const hv = (hips.position.y - A.hy) / Math.max(dt, 1e-3); A.hy = hips.position.y;
    hoodTip.rotation.x = -0.5 - tipSpr.step(clamp(A.vz * 0.022, -0.1, 0.18) + clamp(hv * 0.12, -0.2, 0.2) + A.air * 0.25, dt);
    stole.rotation.x = -clamp(stoleSpr.step(Math.max(0, -Math.min(tl, tr)) * 1.05 * (1 - 0.6 * lunge) + wind(0) * 0.6 + flut(0, 9) + A.air * 0.3, dt), -0.05, 1.3);
    for (const ch of sash) for (let k = 0; k < ch.length; k++) { const q = ch[k], tgt = clamp(A.vz * 0.085 - 0.05, -0.15, 1.25) * (k ? 0.35 : 1) + Math.sin(t * 7 - k * 1.3) * (0.06 * L + 0.02) + A.air * 0.3;
      q.o.rotation.x = q.spr.step(tgt + (k === 0 ? -tilt + 0.2 - panels[4].pv.rotation.x : 0), dt); /* the top segment lies over the back panel's flare */ q.o.rotation.z = q.sprZ.step(-A.vx * 0.05 * (k ? 0.4 : 1), dt); }
    // ---- glow, arcs, charges ----
    const pump = 1 + CA * (0.5 + prog * 0.9) + MA * 0.6 + (storm ? 0.45 : 0) + A.blink * 0.8 + (A.swing > 0 ? 0.6 : 0);
    crystalM.color.copy(crystalBase).multiplyScalar(pump); runeM.color.copy(runeBase).multiplyScalar(0.85 + 0.15 * Math.sin(t * 2.3) + (pump - 1) * 0.6);
    // the charge reads by contrast: the coat's rim barely brightens during a cast (strips, hands and staff carry the glow)
    rimU.value.copy(rimBase).multiplyScalar(1 + CA * prog * 0.15 + A.blink * 0.5 + (storm ? 0.25 : 0));
    handGlowM.color.copy(palmBase).multiplyScalar((1.4 / 1.7) * (1 + CA * (0.4 + prog * 0.8) + MA * 0.6 + wT * 0.8));
    crystal.rotation.y += dt * (1.4 + CA * 7 + (storm ? 3 : 0)); crystal.position.y = 1.24 + Math.sin(t * 2.1) * 0.012; halo.rotation.set(t * 1.3, t * 0.9, 0); halo.scale.setScalar(1 + CA * prog * 0.35);
    // the cast charge stays small and moderately bright so the hand and hood still read through the bloom
    palm.visible = CA > 0.03 || MA > 0.03; palm.scale.setScalar(Math.min(0.8, Math.max(0.01, CA * (0.3 + A.cp * 0.5) + MA * 0.6)) * (1 + Math.sin(t * 40) * 0.08));
    palmM.color.copy(palmBase).multiplyScalar(1 + CA * A.cp * 0.4);
    // idle: now and then a crackle jumps from the staff crystal to the free hand
    A.crk -= dt; if ((A.crkT -= dt) <= 0) { A.crkT = 1.6 + Math.random() * 2.4; if (CA < 0.3 && A.swing <= 0) A.crk = 0.14 + Math.random() * 0.08; }
    if (!G.headless && (A.arcT -= dt) <= 0) {
      A.arcT = 0.05 + Math.random() * 0.04;
      local(weapon, 0.05, 1.45, 0, _a); local(weapon, 0, 1.3, 0, _b); arc(0, _a, _b, 0.03);
      local(weapon, -0.05, 1.45, 0, _a); local(weapon, 0, 1.18, 0, _b); arc(1, _a, _b, 0.03);
      if (CA > 0.3 || A.crk > 0) { local(armL.hand, CA > 0.3 ? 0 : -0.04, -0.06, CA > 0.3 ? 0.05 : 0.01, _a); local(weapon, 0, 1.24, 0, _b); arc(2, _a, _b, CA > 0.3 ? 0.12 + 0.1 * prog : 0.16); } else off(2);
      if (CA > 0.5 && prog > 0.5) { local(weapon, 0, 1.24, 0, _a); _b.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5).add(_a); arc(3, _a, _b, 0.1); } else off(3);
      if (storm) { _a.set((Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 1.2, (Math.random() - 0.5) * 0.4); _b.set(_a.x + (Math.random() - 0.5) * 0.9, _a.y + (Math.random() - 0.5) * 0.7, _a.z + (Math.random() - 0.5) * 0.5); arc(4, _a, _b, 0.15); local(weapon, 0, 1.24, 0, _a); _b.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.2) * 0.7, (Math.random() - 0.5) * 0.8).add(_a); arc(5, _a, _b, 0.12); } else { off(4); off(5); }
      arcGeo.attributes.position.needsUpdate = true;
    }
    arcMat.opacity = Math.min(1, 0.35 + CA * 0.5 + (storm ? 0.3 : 0) + A.blink + (A.crk > 0 ? 0.4 : 0));
    const res = p.res | 0;
    for (let i = 0; i < 4; i++) { const o = orbs[i]; o.visible = i < res && !G.headless; if (!o.visible) continue; const a = t * 2.4 + i * TAU / 4;
      o.position.set(Math.cos(a) * 0.52, 1.02 + Math.sin(t * 3 + i * 1.7) * 0.07, Math.sin(a) * 0.52); o.scale.setScalar(res >= 4 ? 1.25 + Math.sin(t * 12 + i) * 0.15 : 1); }
    const sh = p.shield > 0 ? sat(p.shield / (p.shieldMax || 1)) : 0; ward.material.opacity = damp(ward.material.opacity, sh * 0.85, 12, dt); ward.visible = ward.material.opacity > 0.01; ward.rotation.z += dt * 0.8; ward.scale.setScalar(1 + Math.sin(t * 5) * 0.02);
    // Blink: arrive stretched thin and snap back
    const bk = A.blink * A.blink; body.scale.set(1 - 0.12 * bk, 1 + 0.1 * bk, 1 - 0.12 * bk);
    // cast light capped at ~40% of its old boost so the coat keeps its value and hue through the wind-up
    aura.intensity = 0.9 + CA * (0.6 + prog * 1.2) + MA * 1.2 + (storm ? 1 : 0) + (p.flashT > 0 ? 6 : 0) + A.blink * 2;
    blob.visible = p.pose !== 'fall'; blob.material.opacity = 0.72 * (1 - A.air) * (1 - 0.3 * wB);
  }
  return { group: g, update, anim: A, wtip, body, swing(kind = 0, dur = 0.28) {
    if (kind === 3) { dur = Math.max(dur, 0.42); for (const q of panels) q.spr.v += 3.5; for (const q of cape) q.spr.v += 4.5; stoleSpr.v += 3; } // recoil + overshoot
    else if (kind === 0) dur = Math.max(dur, 0.5); // hold the Discharge silhouette through the flash
    A.swing = A.swingDur = dur; A.swingKind = kind; } };
};
