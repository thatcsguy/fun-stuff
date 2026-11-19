// ============================== ASHWARDEN ==============================
// (Its own file so the class models can be worked on side by side. The name sorts after 07_hero.js, which declares HERO_MODELS
// and HeroKit, under both C and dictionary collation: build.sh concatenates in glob order.)
// An ash-iron knight: a crested armet with an ember-lit visor slit and a horsehair plume, an ashen mantle, layered pauldrons (the
// left one with a raised guard), a breastplate cracked with embers that glow with stamina, plate tassets and a frayed tabard, a
// long singed cape, and the Ember Flasks on the belt (one per flask left). The greatsword is held in both hands by IK and is
// animated as a grip point and blade direction in chest space, so cuts, the overhead and the slam read as one heavy weapon.
// Kindle sets the blade burning, the opening after a dodge makes it white-hot, Winded slumps the knight with the tip dragging.
HERO_MODELS.ashwarden = function buildAshwarden(cls) {
  const C = cls.look, K = HeroKit, P = K.parts(), g = new THREE.Group(), rnd = mulberry(91);
  const glowC = new THREE.Color(C.glow), clothC = new THREE.Color(C.cloth), armC = new THREE.Color(C.armor);
  const rimBase = glowC.clone().lerp(new THREE.Color(1, 1, 1), 0.3).multiplyScalar(0.2), rimU = { value: rimBase.clone() };
  const plateC = armC.clone().lerp(new THREE.Color(0x9a948c), 0.22);
  const plateM = K.mat({ color: plateC.getHex(), roughness: 0.38, metalness: 0.62, envMapIntensity: 1.4 }, rimU, 1);
  const darkM = K.mat({ color: armC.clone().multiplyScalar(0.42).getHex(), roughness: 0.5, metalness: 0.7, envMapIntensity: 0.9 }, rimU, 0.6);
  const trimM = K.mat({ color: C.metal !== undefined ? C.metal : 0x8c6a46, roughness: 0.32, metalness: 0.88, envMapIntensity: 1.5 }, rimU, 0.9);
  const clothM = K.mat({ color: C.cloth, roughness: 0.9, side: THREE.DoubleSide }, rimU, 0.7, C.lining !== undefined ? C.lining : clothC.clone().multiplyScalar(0.45).getHex());
  const capeM = K.mat({ color: clothC.clone().multiplyScalar(0.72).getHex(), roughness: 0.92, side: THREE.DoubleSide }, rimU, 0.75, clothC.clone().multiplyScalar(0.3).getHex());
  const ashM = K.mat({ color: C.mantle !== undefined ? C.mantle : armC.clone().lerp(new THREE.Color(0x6a645d), 0.45).getHex(), roughness: 1, side: THREE.DoubleSide }, rimU, 0.8);
  const leatherM = K.mat({ color: C.leather !== undefined ? C.leather : 0x2b1e16, roughness: 0.66 }, rimU, 0.5);
  const voidM = new THREE.MeshBasicMaterial({ color: 0x020101 });
  const seamM = W.glow(C.glow, 1.5), eyeM = W.glow(C.glow, 3.2), singeM = W.glow(C.glow, 0.9), fullerM = W.glow(C.glow, 2.2);
  const flaskM = W.glow(glowC.clone().lerp(new THREE.Color(0xffb060), 0.3), 1.35), handFlaskM = flaskM.clone();
  const seamBase = seamM.color.clone(), eyeBase = eyeM.color.clone(), fullerBase = fullerM.color.clone(), singeBase = singeM.color.clone(), flaskBase = flaskM.color.clone();
  // blade steel: flat-shaded, heats from the guard up (Kindle) and goes white-hot on an opening
  const heatU = { value: 0 }, hotU = { value: glowC.clone() }, whiteU = { value: 0 };
  const bladeM = new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 0.3, metalness: 1, envMapIntensity: 1.6, flatShading: true });
  bladeM.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = rimU; sh.uniforms.uHeat = heatU; sh.uniforms.uHot = hotU; sh.uniforms.uWhite = whiteU;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vBy;\nvoid main() {\nvBy = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; uniform float uHeat; uniform vec3 uHot; uniform float uWhite; varying float vBy;\nvoid main() {')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0);'
        + ' float h = uHeat * (0.5 + 0.5 * (1.0 - smoothstep(0.3, 1.8, vBy)));'
        + ' totalEmissiveRadiance += uRim * fr * fr * fr + uHot * h * (0.06 + 0.55 * fr * fr) + vec3(1.0, 0.86, 0.66) * uWhite * (0.25 + 1.2 * fr * fr); }');
  };
  bladeM.customProgramCacheKey = () => 'awBlade';
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };

  // ---- skeleton ----
  const body = grp(g), hips = grp(body, 0, 0.95, 0), torso = grp(hips, 0, 0.03, 0), head = grp(torso, 0, 0.7, 0.01);

  // ---- torso: peascod breastplate with ember cracks, gorget, belt, fauld ----
  const BP = [[0.17, -0.05], [0.178, 0.06], [0.2, 0.18], [0.232, 0.32], [0.242, 0.44], [0.225, 0.53], [0.17, 0.6], [0.11, 0.65], [0.09, 0.68]], BZ = 0.8, BX = 1.07;
  const bpR = (y) => { for (let i = 1; i < BP.length; i++) if (y <= BP[i][1]) return lerp(BP[i - 1][0], BP[i][0], (y - BP[i - 1][1]) / (BP[i][1] - BP[i - 1][1])); return BP[BP.length - 1][0]; };
  const ridge = (a, y) => 0.024 * Math.exp(-a * a / 0.05) * smooth((0.6 - y) / 0.22);
  const chest = (a, y, off) => { const r = bpR(y) + off; return [Math.sin(a) * r * BX, y, Math.cos(a) * r * BZ + ridge(a, y) + off]; };
  { const bg = K.lathe(BP, 26), pa = bg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(x, z); pa.setX(i, x * BX); pa.setZ(i, z * BZ + ridge(a, y)); }
    bg.computeVertexNormals(); P.add(torso, plateM, bg); }
  { // cooling cracks: jagged lines across the plate
    const crack = (a, y, n, da, dy) => { const pts = []; for (let k = 0; k <= n; k++) { pts.push(chest(a, y, 0.004)); a += da * (0.6 + rnd() * 0.8); y += dy * (0.6 + rnd() * 0.8) + (k % 2 ? 0.018 : -0.018); } return pts; };
    for (const [a, y, n, da, dy, r] of [[0.06, 0.48, 6, 0.1, -0.05, 0.006], [0.1, 0.36, 5, -0.12, -0.012, 0.005], [-0.05, 0.5, 3, -0.11, 0.025, 0.004], [0.42, 0.24, 3, 0.1, -0.04, 0.004]])
      P.add(torso, seamM, K.tube(crack(a, y, n, da, dy), r, n * 6, 4));
  }
  P.add(torso, plateM, K.lathe([[0.125, 0.6], [0.15, 0.63], [0.142, 0.68], [0.112, 0.72], [0.1, 0.75]], 20), 0, 0, 0, 0, 0, 0, 1, 1, 0.92);
  P.add(torso, trimM, new THREE.TorusGeometry(0.15, 0.008, 4, 24), 0, 0.63, 0, PI / 2, 0, 0, 1, 0.92, 1);
  P.add(hips, leatherM, new THREE.TorusGeometry(0.2, 0.03, 6, 28), 0, -0.02, 0, PI / 2, 0, 0, 1, 0.84, 1);
  P.add(hips, trimM, new THREE.BoxGeometry(0.1, 0.075, 0.03), 0, -0.02, 0.17);
  P.add(hips, seamM, new THREE.OctahedronGeometry(0.022), 0, -0.02, 0.186, 0, 0, 0, 1, 1.3, 0.4);
  for (let k = 0; k < 3; k++) { const r = 0.205 + k * 0.012, y = -0.045 - k * 0.055;
    P.add(hips, plateM, K.lathe([[r, y], [r + 0.016, y - 0.068]], 24), 0, 0, 0, 0, 0, 0, 1, 1, 0.84);
    P.add(hips, trimM, K.lathe([[r + 0.017, y - 0.06], [r + 0.019, y - 0.07]], 24), 0, 0, 0, 0, 0, 0, 1, 1, 0.84); }
  // ---- ashen mantle around the shoulders, hood bunched behind the neck ----
  { const jag = []; for (let k = 0; k < 26; k++) jag.push(0.02 + rnd() * 0.05);
    const MG = 0.62, mg = K.lathe([[0.35, 0.44], [0.34, 0.52], [0.295, 0.59], [0.215, 0.66], [0.16, 0.72]], 26, MG, TAU - 2 * MG), pa = mg.attributes.position; // open at the front
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(x, z), k = Math.round((a + PI) / TAU * 26) % 26, fr = 1 - Math.min(1, (Math.abs(a) - MG) / 0.9);
      const n = 1 + 0.05 * Math.sin(a * 7 + y * 20) + 0.03 * Math.sin(a * 13 + 1); pa.setX(i, x * n); pa.setZ(i, z * n * 0.86 + fr * 0.02); pa.setY(i, y - (y < 0.45 ? jag[k] : 0) - fr * 0.07 * (0.75 - y) * 3); }
    mg.computeVertexNormals(); P.add(torso, ashM, mg, 0, 0, -0.01); }
  P.add(torso, ashM, new THREE.SphereGeometry(0.15, 14, 8), 0, 0.68, -0.13, 0.3, 0, 0, 1.3, 0.62, 0.8);

  // ---- head: crested armet with a snouted visor, ember slit, breaths, horsehair plume ----
  const HP = [[0.158, -0.1], [0.165, -0.02], [0.172, 0.06], [0.17, 0.13], [0.152, 0.2], [0.115, 0.25], [0.06, 0.278], [0.0, 0.286]];
  const hpR = (y) => { for (let i = 1; i < HP.length; i++) if (y <= HP[i][1]) return lerp(HP[i - 1][0], HP[i][0], (y - HP[i - 1][1]) / (HP[i][1] - HP[i - 1][1])); return 0; };
  const snout = (a, y) => { const c = Math.max(0, Math.cos(a)); return 0.042 * c * c * c * Math.exp(-((y - 0.03) ** 2) / 0.012) - 0.008 * c * c * Math.exp(-((y - 0.095) ** 2) / 0.0003); };
  const helm = (a, y, off) => { const r = hpR(y) + off; return [Math.sin(a) * r, y, Math.cos(a) * r + snout(a, y)]; };
  { const hg = K.lathe(HP, 26), pa = hg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); pa.setZ(i, z + snout(Math.atan2(x, z), pa.getY(i))); }
    hg.computeVertexNormals(); P.add(head, plateM, hg); }
  P.add(head, darkM, K.lathe([[0.1, -0.16], [0.11, -0.06], [0.14, -0.04]], 14));
  { const [, , zf] = helm(0, 0.095, 0); P.add(head, voidM, new THREE.BoxGeometry(0.2, 0.026, 0.05), 0, 0.095, zf - 0.02, 0, 0, 0); P.add(head, eyeM, new THREE.BoxGeometry(0.15, 0.009, 0.012), 0, 0.095, zf + 0.004);
    for (const s of [1, -1]) P.add(head, eyeM, new THREE.BoxGeometry(0.03, 0.007, 0.012), s * 0.085, 0.099, zf - 0.024, 0, s * 0.55, 0); }
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { const [x, y, z] = helm(-0.22 - k * 0.11, 0.015 - r * 0.035, 0.002); P.add(head, darkM, new THREE.BoxGeometry(0.007, 0.014, 0.008), x, y, z, 0, -0.22 - k * 0.11, 0); }
  for (const s of [1, -1]) { const [x, y, z] = helm(s * 1.35, 0.06, 0.004); P.add(head, trimM, new THREE.SphereGeometry(0.02, 8, 6), x, y, z, 0, 0, 0, 0.5, 1, 1); } // visor pivots
  { const sh = new THREE.Shape([[0.14, 0.215], [0.08, 0.31], [-0.02, 0.345], [-0.12, 0.325], [-0.19, 0.205], [-0.13, 0.215], [-0.03, 0.27], [0.08, 0.26]].map(([u, v]) => new THREE.Vector2(u, v)));
    const cg = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false }); cg.rotateY(-PI / 2); cg.translate(0.008, 0, 0); P.add(head, plateM, cg);
    P.add(head, trimM, K.tube([[0, 0.235, 0.135], [0, 0.31, 0.08], [0, 0.345, -0.02], [0, 0.325, -0.12], [0, 0.205, -0.19]], 0.0095, 20, 5)); }
  const plume = []; { let par = grp(head, 0, 0.27, -0.17); for (let k = 0; k < 2; k++) { const seg = grp(par, 0, k ? -0.2 : 0, 0);
    for (let j = 0; j < 7; j++) { const u = (j - 3) / 3, cg = new THREE.ConeGeometry(0.024 - k * 0.006, 0.23, 5); cg.translate(0, -0.105, 0); P.add(seg, clothM, cg, u * 0.03, 0, -Math.abs(u) * 0.01, 0, 0, u * 0.12 * (k + 1), 1, 1, 0.5); }
    plume.push({ o: seg, spr: K.spring(50 - k * 12, 6), sprZ: K.spring(40, 6) }); par = seg; } }

  // ---- arms: mail sleeve, rerebrace, couter with a fan, vambrace, flared gauntlet ----
  const L1 = 0.31, L2 = 0.29;
  const mkArm = (side) => {
    const sh = grp(torso, side * 0.27, 0.55, -0.01);
    P.add(sh, darkM, K.lathe([[0.07, -0.3], [0.08, -0.2], [0.086, -0.08], [0.082, 0.02]], 12));
    P.add(sh, plateM, K.lathe([[0.086, -0.27], [0.094, -0.18], [0.098, -0.09]], 12, side * PI / 2 - 1.35, 2.7));
    const el = grp(sh, 0, -L1, 0);
    P.add(el, plateM, new THREE.SphereGeometry(0.074, 12, 6, 0, TAU, 0, PI * 0.5), 0, 0, -0.018, -PI / 2, 0, 0, 1, 1, 0.9);
    P.add(el, trimM, new THREE.CylinderGeometry(0.065, 0.065, 0.012, 14), side * 0.07, 0.0, -0.01, 0, 0, PI / 2, 1, 1, 0.8);
    P.add(el, plateM, K.lathe([[0.056, -0.25], [0.064, -0.17], [0.072, -0.07], [0.07, -0.01]], 12));
    for (const y of [-0.08, -0.19]) P.add(el, leatherM, new THREE.TorusGeometry(0.068, 0.009, 4, 16), 0, y, 0, PI / 2, 0, 0);
    const hand = grp(el, 0, -L2, 0);
    P.add(hand, plateM, K.lathe([[0.056, -0.005], [0.068, 0.045], [0.09, 0.1]], 12));
    P.add(hand, trimM, new THREE.TorusGeometry(0.09, 0.006, 4, 16), 0, 0.1, 0, PI / 2, 0, 0);
    P.add(hand, leatherM, new THREE.SphereGeometry(0.05, 10, 8), 0, -0.035, 0.005, 0, 0, 0, 0.85, 1.2, 1.1);
    P.add(hand, plateM, new THREE.BoxGeometry(0.075, 0.038, 0.06), 0, -0.048, 0.025, 0.3, 0, 0);
    // pauldron on its own pivot: it follows the arm part of the way, so a raised arm does not lift the whole shoulder
    const pd = grp(torso, side * 0.27, 0.56, -0.01), big = side > 0 ? 1.06 : 0.92;
    for (let k = 0; k < 3; k++) { const r = (0.135 - k * 0.007) * big, yE = r * Math.cos(PI * 0.45), tf = [side * (0.025 + k * 0.04) * big, (0.05 - k * 0.055) * big, 0, 0, 0, side * -(0.3 + k * 0.27), 1.12, 0.62, 1.12];
      P.add(pd, plateM, new THREE.SphereGeometry(r, 18, 7, 0, TAU, 0, PI * 0.45), ...tf);
      const rim = new THREE.TorusGeometry(r * 0.985, k === 2 ? 0.006 : 0.008, 4, 28); rim.rotateX(PI / 2); rim.translate(0, yE, 0); P.add(pd, k === 2 ? seamM : trimM, rim, ...tf);
      for (let j = -1; j <= 1; j++) { const rv = new THREE.SphereGeometry(0.009, 6, 4); rv.translate(Math.sin(j * 0.5) * r * 0.9, yE + 0.012, Math.cos(j * 0.5) * r * 0.9 * (k ? -1 : 1)); P.add(pd, trimM, rv, ...tf); } }
    if (side > 0) { const hw = new THREE.CylinderGeometry(0.12, 0.12, 0.11, 12, 1, true, -PI / 2 - 0.85, 1.7); P.add(pd, plateM, hw, 0.01, 0.17, 0, 0, 0, -0.12);
      const tp = []; for (let k = 0; k <= 10; k++) { const th = -PI / 2 - 0.85 + k / 10 * 1.7; tp.push([Math.sin(th) * 0.12, 0.055, Math.cos(th) * 0.12]); } P.add(pd, trimM, K.tube(tp, 0.008, 16, 4), 0.01, 0.17, 0, 0, 0, -0.12); }
    return { sh, el, hand, pd, side };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  // ---- legs: mail, cuisse, poleyn with a fan, greave with an ember seam, sabaton ----
  const mkLeg = (side) => {
    const hip = grp(hips, side * 0.11, -0.05, 0);
    P.add(hip, darkM, K.lathe([[0.07, -0.45], [0.082, -0.3], [0.1, -0.12], [0.106, 0.03]], 12));
    P.add(hip, plateM, K.lathe([[0.088, -0.4], [0.1, -0.28], [0.113, -0.12], [0.118, 0.0]], 12, -1.3, 2.6));
    P.add(hip, trimM, K.lathe([[0.09, -0.405], [0.092, -0.39]], 12, -1.3, 2.6));
    const knee = grp(hip, 0, -0.45, 0);
    P.add(knee, plateM, new THREE.SphereGeometry(0.075, 12, 6, 0, TAU, 0, PI * 0.5), 0, 0.0, 0.05, PI / 2 - 0.15, 0, 0, 1, 1.15, 0.85);
    P.add(knee, trimM, new THREE.CylinderGeometry(0.055, 0.055, 0.012, 12), side * 0.068, 0, 0.02, 0, 0, PI / 2, 1, 1, 0.8);
    P.add(knee, plateM, K.lathe([[0.064, -0.39], [0.064, -0.31], [0.078, -0.2], [0.088, -0.08], [0.08, 0.02]], 12));
    P.add(knee, seamM, new THREE.BoxGeometry(0.006, 0.2, 0.006), 0, -0.2, 0.087, -0.02, 0, 0);
    const ankle = grp(knee, 0, -0.41, 0);
    P.add(ankle, plateM, new THREE.SphereGeometry(0.072, 12, 8), 0, -0.022, 0.05, 0, 0, 0, 0.82, 0.58, 1.6);
    for (let k = 0; k < 3; k++) P.add(ankle, trimM, new THREE.TorusGeometry(0.06 - k * 0.006, 0.005, 3, 14, PI), 0, -0.02, 0.07 + k * 0.035, 0, 0, 0, 1, 0.75, 1);
    P.add(ankle, darkM, new THREE.BoxGeometry(0.105, 0.022, 0.23), 0, -0.052, 0.05);
    return { hip, knee, ankle };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  // ---- tassets (hinged plates over the thighs) and the frayed front tabard with an ember sigil ----
  const R0 = 0.21, tassets = [];
  for (const phi of [0.62, -0.62]) {
    const pv = grp(hips, Math.sin(phi) * R0, -0.07, Math.cos(phi) * R0 * 0.84); pv.rotation.y = phi;
    for (let k = 0; k < 2; k++) { const r = R0 + 0.02 + k * 0.012, y = -k * 0.1;
      P.add(pv, plateM, K.lathe([[r, y], [r + 0.022, y - 0.115]], 8, -0.4, 0.8), 0, 0, -R0);
      P.add(pv, trimM, K.lathe([[r + 0.023, y - 0.105], [r + 0.025, y - 0.117]], 8, -0.4, 0.8), 0, 0, -R0); }
    tassets.push({ pv, phi, spr: K.spring(80, 9) });
  }
  const tabard = grp(hips, 0, -0.05, 0.205), tabSpr = K.spring(55, 6.5);
  { const hw = 0.085, len = 0.56, cols = 6, sh = new THREE.Shape(); const hem = [];
    sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw * 1.15, -len + 0.05);
    for (let k = cols; k >= 0; k--) { const x = lerp(-hw * 1.15, hw * 1.15, k / cols), y = -len + (k % 2 ? -0.03 - rnd() * 0.04 : 0.03 + rnd() * 0.02); sh.lineTo(x, y); hem.push([x, y, 0.009]); }
    sh.lineTo(-hw, 0);
    P.add(tabard, clothM, new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }), 0, 0, -0.004);
    P.add(tabard, singeM, K.tube(hem, 0.004, 24, 3));
    P.add(tabard, trimM, new THREE.TorusGeometry(0.042, 0.006, 4, 20), 0, -0.2, 0.012);
    P.add(tabard, seamM, new THREE.OctahedronGeometry(0.03), 0, -0.2, 0.01, 0, 0, 0, 0.7, 1.25, 0.25);
    P.add(tabard, trimM, new THREE.BoxGeometry(0.19, 0.02, 0.02), 0, -0.004, 0.004); }
  // ---- the Ember Flasks: four on the left hip, one per flask left ----
  const flaskGeo = (pp, m0, m1, sc = 0.78) => { const add = (m, geo, ...a) => { geo.scale(sc, sc, sc); P.add(pp, m, geo, ...a.map((v, i) => i < 3 ? v * sc : v)); }; add(m0, K.lathe([[0.001, -0.125], [0.027, -0.12], [0.037, -0.095], [0.039, -0.06], [0.031, -0.038], [0.013, -0.024], [0.012, -0.012]], 10));
    for (const y of [-0.062, -0.1]) add(m1, new THREE.TorusGeometry(0.04, 0.0045, 3, 14), 0, y, 0, PI / 2, 0, 0);
    for (let j = 0; j < 4; j++) add(m1, new THREE.BoxGeometry(0.006, 0.08, 0.006), Math.sin(j * PI / 2) * 0.039, -0.08, Math.cos(j * PI / 2) * 0.039);
    add(m1, K.lathe([[0.015, -0.026], [0.016, 0.0], [0.009, 0.01]], 8)); add(m1, new THREE.TorusGeometry(0.012, 0.003, 3, 8), 0, 0.018, 0); };
  const flasks = [];
  for (const a of [1.05, 1.42, 1.79, 2.16]) { const pv = grp(hips, Math.sin(a) * 0.222, -0.035, Math.cos(a) * 0.222 * 0.84); pv.rotation.y = a; flaskGeo(pv, flaskM, trimM); flasks.push({ pv, spr: K.spring(45, 4.5), sprZ: K.spring(40, 4.5) }); }
  const handFlask = grp(armL.hand, 0, -0.09, 0.1); flaskGeo(handFlask, handFlaskM, trimM, 0.9); handFlask.rotation.set(0, 0, PI); handFlask.visible = false;

  // ---- long singed cape: three hinged rows, jagged burnt hem ----
  const cape = []; { let par = grp(torso, 0, 0.56, -0.19); const LEN = [0.36, 0.36, 0.38], WID = [0.46, 0.53, 0.59, 0.64];
    for (let k = 0; k < 3; k++) { const seg = grp(par, 0, k ? -LEN[k - 1] : 0, 0), w0 = WID[k], w1 = WID[k + 1], cols = 12, cg = new THREE.PlaneGeometry(1, LEN[k], cols, 3);
      cg.translate(0, -LEN[k] / 2, 0); cg.rotateY(PI); const pa = cg.attributes.position, jag = []; for (let j = 0; j <= cols; j++) jag.push(j % 2 ? 0.04 + rnd() * 0.09 : rnd() * 0.03);
      for (let i = 0; i < pa.count; i++) { const v = -pa.getY(i) / LEN[k], u = pa.getX(i), w = lerp(w0, w1, v), x = u * w, j = Math.round((0.5 - u) * cols);
        let y = pa.getY(i); if (k === 2 && v > 0.99) y -= jag[j];
        pa.setXYZ(i, x, y, 0.11 * (2 * u) ** 2 + 0.016 * Math.sin(x * 23 + k * 1.7) * (0.4 + v * 0.6) - 0.01 * k); }
      cg.computeVertexNormals(); P.add(seg, capeM, cg);
      if (k === 2) { const hem = []; for (let j = 0; j <= cols; j++) { const u = 0.5 - j / cols, x = u * w1; hem.push([x, -LEN[k] - jag[j], 0.11 * (2 * u) ** 2 + 0.016 * Math.sin(x * 23 + k * 1.7) - 0.02]); } P.add(seg, singeM, K.tube(hem, 0.005, 40, 3)); }
      cape.push({ o: seg, spr: K.spring(60 - k * 12, 7), sprZ: K.spring(45, 6) }); par = seg; } }

  // ---- greatsword: faceted pommel, wrapped grip, swept guard with an ember stone, ricasso with parrying lugs, diamond blade ----
  const weapon = grp(armR.hand), wtip = new THREE.Object3D();
  P.add(weapon, trimM, K.lathe([[0.001, -0.335], [0.03, -0.325], [0.043, -0.295], [0.039, -0.262], [0.02, -0.245]], 8));
  P.add(weapon, seamM, new THREE.OctahedronGeometry(0.014), 0, -0.338, 0);
  P.add(weapon, leatherM, K.lathe([[0.022, -0.25], [0.025, -0.1], [0.023, 0.045]], 10));
  { const hel = []; for (let k = 0; k <= 72; k++) { const a = k / 72 * TAU * 9; hel.push([Math.cos(a) * 0.025, -0.24 + k / 72 * 0.27, Math.sin(a) * 0.025]); } P.add(weapon, darkM, K.tube(hel, 0.0042, 144, 3)); }
  P.add(weapon, trimM, K.tube([[-0.285, 0.165, 0], [-0.245, 0.105, 0], [-0.13, 0.078, 0], [0, 0.072, 0], [0.13, 0.078, 0], [0.245, 0.105, 0], [0.285, 0.165, 0]], 0.017, 32, 6));
  for (const s of [1, -1]) P.add(weapon, trimM, new THREE.SphereGeometry(0.024, 8, 6), s * 0.288, 0.172, 0);
  P.add(weapon, plateM, new THREE.BoxGeometry(0.12, 0.075, 0.05), 0, 0.078, 0);
  for (const s of [1, -1]) P.add(weapon, eyeM, new THREE.OctahedronGeometry(0.02), 0, 0.078, s * 0.026, 0, 0, 0, 1, 1.3, 0.35);
  P.add(weapon, leatherM, K.lathe([[0.034, 0.1], [0.037, 0.2], [0.036, 0.3], [0.034, 0.345]], 8), 0, 0, 0, 0, 0, 0, 1, 1, 0.5);
  for (const s of [1, -1]) { const lug = new THREE.ConeGeometry(0.016, 0.075, 5); lug.translate(0, 0.0375, 0); P.add(weapon, trimM, lug, s * 0.05, 0.355, 0, 0, 0, -s * (PI / 2 + 0.35)); }
  P.add(weapon, bladeM, K.lathe([[0.038, 0.33], [0.078, 0.37], [0.08, 0.5], [0.074, 0.95], [0.066, 1.4], [0.054, 1.63], [0.0, 1.82]], 4), 0, 0, 0, 0, 0, 0, 1, 1, 0.16);
  for (const s of [1, -1]) { P.add(weapon, fullerM, new THREE.BoxGeometry(0.009, 1.0, 0.004), 0, 0.92, s * 0.0124);
    for (const [x0, y0, dx, dy] of [[0.012, 0.42, 0.012, 0.035], [-0.015, 0.6, -0.01, 0.04]]) { const pts = []; let x = x0, y = y0; for (let k = 0; k < 4; k++) { pts.push([x, y, s * (0.0128 * (1 - Math.abs(x) / 0.078) + 0.0012)]); x += dx * (k % 2 ? -0.4 : 1) + (rnd() - 0.5) * 0.008; y += dy; } P.add(weapon, fullerM, K.tube(pts, 0.0022, 12, 3)); } }
  wtip.position.set(0, 1.8, 0); weapon.add(wtip);
  // Kindle: a flame sheath along the blade (two crossed sheets, procedural flame, additive)
  const flameMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uI: { value: 0 }, uC: { value: glowC.clone() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uT; uniform float uI; uniform vec3 uC; varying vec2 vUv;'
      + ' float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }'
      + ' float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1.0, 0.0)), f.x), mix(hh(i + vec2(0.0, 1.0)), hh(i + vec2(1.0, 1.0)), f.x), f.y); }'
      + ' void main(){ float x = abs(vUv.x - 0.5) * 2.0, y = vUv.y;'
      + ' float n = nz(vec2(vUv.x * 4.0, y * 6.0 - uT * 3.8)) * 0.55 + nz(vec2(vUv.x * 9.0 + 3.0, y * 13.0 - uT * 7.5)) * 0.3 + nz(vec2(vUv.x * 21.0, y * 29.0 - uT * 13.0)) * 0.15;'
      + ' float w = (0.95 - y * 0.4) * (0.15 + 0.85 * n);'
      + ' float body = 1.0 - smoothstep(w * 0.35, w, x), core = 1.0 - smoothstep(0.0, 0.16 + 0.1 * n, x);'
      + ' float a = clamp(body * (0.35 + 0.65 * n) + core * 0.5, 0.0, 1.0) * smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(0.78, 1.0, y + 0.15 * n)) * uI;'
      + ' vec3 c = mix(mix(vec3(0.9, 0.12, 0.02), uC, smoothstep(0.1, 0.6, body)) * 1.8, vec3(2.4, 1.8, 1.0), core * 0.7);'
      + ' gl_FragColor = vec4(c * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const fg = new THREE.PlaneGeometry(0.5, 1.8); fg.translate(0, 0.32 + 0.9, 0);
  const flames = [0, PI / 2].map((ry, i) => { const m = new THREE.Mesh(fg, flameMat); m.rotation.y = ry; if (i) m.scale.x = 0.55; m.visible = false; m.renderOrder = 2; weapon.add(m); return m; });
  P.finish();
  const aura = new THREE.PointLight(C.glow, 1.3, 7, 1.5); aura.position.set(0, 1.0, 0.6); g.add(aura);

  // ---- sword poses: grip point, blade direction and an edge hint, all in chest (torso) space ----
  const pose = (px, py, pz, dx, dy, dz, ex = 0, ey = 0, ez = 1) => ({ P: new V3(px, py, pz), D: new V3(dx, dy, dz).normalize(), E: new V3(ex, ey, ez) });
  const REST = pose(-0.2, 0.4, 0.25, -0.1, 0.75, -0.66, 0, 0.66, 0.75), GUARD = pose(-0.05, 0.17, 0.4, 0.06, 0.66, 0.75, 0, 0.75, -0.66);
  const WINDED = pose(-0.17, -0.04, 0.3, -0.12, -0.8, 0.6, 0, 0.6, 0.8), TUCK = pose(-0.1, 0.12, 0.26, -0.2, 0.55, -0.8, 0, 0.8, 0.55), POUR = pose(-0.04, 0.12, 0.42, 0, 1, 0.12, 1, 0, 0);
  // swing kinds: 0 / 1 the alternating cuts, 2 the overhead wind-up, 3 the slam. keys are [time 0..1, pose]; past `end` it blends back
  const SW = {
    0: { end: 0.55, yaw: [-0.5, 0.55], keys: [[0.2, pose(-0.26, 0.6, 0.1, -0.4, 0.72, -0.56)], [0.4, pose(-0.02, 0.33, 0.44, 0.3, 0.0, 1)], [0.55, pose(0.04, 0.14, 0.3, 0.72, -0.55, 0.42)]] },
    1: { end: 0.55, yaw: [0.5, -0.6], keys: [[0.17, pose(0.06, 0.12, 0.3, 0.85, -0.25, -0.2)], [0.4, pose(-0.02, 0.3, 0.48, -0.1, 0.12, 1)], [0.55, pose(-0.3, 0.42, 0.22, -0.9, 0.35, -0.1)]] },
    2: { end: 1, yaw: [0, 0], keys: [[0.55, pose(-0.04, 0.95, 0.12, 0, 0.42, -0.9)], [1, pose(-0.04, 0.97, 0.1, 0, 0.38, -0.92)]] },
    3: { end: 0.6, yaw: [0, 0], keys: [[0.1, pose(-0.04, 0.97, 0.13, 0, 0.62, -0.78)], [0.2, pose(-0.04, 0.85, 0.24, 0, 0.95, 0.3)], [0.3, pose(-0.04, 0.16, 0.3, 0, -0.35, 1)], [0.6, pose(-0.04, 0.15, 0.3, 0, -0.38, 1)]] },
  };
  const HOLD = SW[2].keys[1][1];
  const A = { run: 0, swing: 0, swingDur: 0.3, swingKind: 0, ps: 0, lean: 0, air: 0, leap: 0, vx: 0, vz: 0, lx: null, lz: null, fight: 0, gw: 0, hold: 0, pr: 0, rollKind: 1,
    pour: 0, kin: false, wind: 0, open: 0, heat: 0, drink: 0, P: REST.P.clone(), D: REST.D.clone(), E: REST.E.clone(), S0: pose(0, 0, 0, 0, 1, 0), tip: new V3(), tipOk: false };
  const _P = new V3(), _D = new V3(), _E = new V3(), _g = new V3(), _t = new V3(), _u = new V3(), _hr = new V3(), _lt = new V3(), _pole = new V3();
  const _a1 = new V3(), _b1 = new V3(), _c1 = new V3(), _a2 = new V3(), _b2 = new V3(), _c2 = new V3(), _d = new V3(), _hl = new V3();
  const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qi = new THREE.Quaternion();
  // Catmull-Rom through the keys of a swing (the first key is where the sword was when the swing began)
  const cr = (p0, p1, p2, p3, u, out) => { const u2 = u * u, u3 = u2 * u;
    return out.set(0, 0, 0).addScaledVector(p0, -0.5 * u3 + u2 - 0.5 * u).addScaledVector(p1, 1.5 * u3 - 2.5 * u2 + 1).addScaledVector(p2, -1.5 * u3 + 2 * u2 + 0.5 * u).addScaledVector(p3, 0.5 * u3 - 0.5 * u2); };
  function sample(sw, k, outP, outD) {
    const ks = sw.keys, n = ks.length, T = (i) => i < 0 ? 0 : ks[Math.min(i, n - 1)][0], Q = (i) => i < 0 ? A.S0 : ks[Math.min(i, n - 1)][1];
    let i = -1; while (i < n - 1 && k >= T(i + 1)) i++;
    if (i >= n - 1) { outP.copy(ks[n - 1][1].P); outD.copy(ks[n - 1][1].D); return; }
    const u = sat((k - T(i)) / Math.max(1e-4, T(i + 1) - T(i))), a = Q(i - 1 < -1 ? -1 : i - 1), b = Q(i), c = Q(i + 1), d = Q(i + 2);
    cr(a.P, b.P, c.P, d.P, u, outP); cr(a.D, b.D, c.D, d.D, u, outD); if (outD.lengthSq() < 1e-6) outD.copy(c.D); outD.normalize();
  }
  const blend = (q, w) => { if (w <= 0) return; _P.lerp(q.P, w); _D.lerp(q.D, w); if (_D.lengthSq() < 1e-6) _D.copy(q.D); _D.normalize(); _E.lerp(q.E, w); };
  // two-bone IK in torso space: hand of `arm` to T, elbow toward `pole`, blended over the FK pose by w; the reached hand -> out
  function ik(arm, T, pole, w, out) {
    _d.subVectors(T, arm.sh.position); const D = clamp(_d.length(), 0.1, (L1 + L2) * 0.998);
    const bend = PI - Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
    _hl.set(0, -L1 - L2 * Math.cos(bend), L2 * Math.sin(bend)); _a1.copy(_hl).normalize(); _b1.set(0, -_a1.z, _a1.y); _c1.crossVectors(_a1, _b1);
    _a2.copy(_d).normalize(); _b2.copy(pole).addScaledVector(_a2, -pole.dot(_a2)); if (_b2.lengthSq() < 1e-6) _b2.set(0, 0, -1).addScaledVector(_a2, _a2.z); _b2.normalize(); _c2.crossVectors(_a2, _b2);
    _m1.makeBasis(_a1, _b1, _c1).transpose(); _m2.makeBasis(_a2, _b2, _c2).multiply(_m1); _q.setFromRotationMatrix(_m2);
    if (w >= 0.999) arm.sh.quaternion.copy(_q); else arm.sh.quaternion.slerp(_q, w);
    arm.el.rotation.x = lerp(arm.el.rotation.x, -bend, w);
    if (out) out.copy(_hl).applyQuaternion(_q).add(arm.sh.position);
  }

  function update(dt, p) {
    dt = Math.min(dt, 0.1); const t = G.now;
    const spd = p.moveSpeed || 0, grounded = p.grounded !== false, moving = spd > 0.5 && grounded;
    const wp = g.position, f = g.rotation.y;
    if (A.lx !== null && dt > 0) { const dx = wp.x - A.lx, dz = wp.z - A.lz;
      if (dx * dx + dz * dz < 2.5) { A.vx = damp(A.vx, (dx * Math.cos(f) - dz * Math.sin(f)) / dt, 12, dt); A.vz = damp(A.vz, (dx * Math.sin(f) + dz * Math.cos(f)) / dt, 12, dt); } }
    A.lx = wp.x; A.lz = wp.z;
    const hot = !!(p.hasBuff && p.hasBuff('kindle')), sf = p.resMax ? sat(p.res / p.resMax) : 1, winded = !!p.winded, opening = (p.opening || 0) > 0;
    const cast = p.casting, drinking = !!(cast && cast.name === 'Ember Flask'), prog = cast && cast.time ? sat(cast.t / cast.time) : 0;
    const rollT = p.rollT || 0, rolling = rollT > 0;
    if (rollT > A.pr + 0.02) A.rollKind = p.dash && p.dash.vx * Math.sin(f) + p.dash.vz * Math.cos(f) < 0 ? 2 : 1; A.pr = rollT; // rolling backwards = the hop back
    if (hot && !A.kin) A.pour = 0.75; A.kin = hot;
    if (A.swing > A.ps + 0.02) { A.S0.P.copy(A.P); A.S0.D.copy(A.D); A.fight = 1.8; A.hold = 0; } // a new swing (door VII sets swing directly)
    A.lean = damp(A.lean, moving ? Math.min(1, spd / 7) : 0, 8, dt); A.air = damp(A.air, grounded && !(p.dash && !rolling) ? 0 : 1, 12, dt);
    A.leap = damp(A.leap, p.dash && !rolling ? 1 : 0, 14, dt); A.wind = damp(A.wind, winded ? 1 : 0, 4, dt); A.open = damp(A.open, opening ? 1 : 0, 10, dt);
    A.heat = damp(A.heat, hot ? 1 : 0, 3, dt); A.drink = damp(A.drink, drinking ? 1 : 0, 10, dt);
    if (A.fight > 0) A.fight -= dt; if (cast && !drinking) A.fight = Math.max(A.fight, 1);
    A.gw = damp(A.gw, A.fight > 0 ? 1 : 0, A.fight > 0 ? 9 : 3, dt);
    A.run += dt * spd * 1.5; const ph = A.run, s = Math.sin(ph), c = Math.cos(ph), L = A.lean;
    const br = Math.sin(t * 1.6), puff = Math.sin(t * 6.5) * (A.wind * 0.9 + sat((0.35 - sf) / 0.35) * 0.4), WD = A.wind;

    // ---- base: heavy stance blended into the run ----
    hips.position.set(0, 0.92 + br * 0.006 + L * (Math.abs(c) * 0.07 - 0.03) - WD * 0.05 + puff * 0.01, 0);
    hips.rotation.set(0, s * 0.14 * L - 0.12 * (1 - L), Math.sin(t * 0.5) * 0.012 * (1 - L));
    body.rotation.set(0.04 + L * 0.2, 0, 0); body.position.set(0, 0, 0); body.scale.set(1, 1, 1);
    torso.rotation.set(0.04 + br * 0.012 + L * 0.05 + WD * 0.32 + puff * 0.04, -s * 0.2 * L + 0.12 * (1 - L), 0);
    head.rotation.set(0.08 - L * 0.18 + WD * 0.15, Math.sin(t * 0.33) * 0.08 * (1 - L) - 0.1 * (1 - L) + s * 0.08 * L, 0);
    let tl = lerp(-0.14, -s * 0.75, L), tr = lerp(0.14, s * 0.75, L), zl = 0.1 * (1 - L), zr = -0.1 * (1 - L);
    const kc = Math.cos(ph - 0.45); let kl = lerp(0.16, 0.12 + Math.pow(Math.max(0, kc), 1.5) * 1.05, L), kr = lerp(0.2, 0.12 + Math.pow(Math.max(0, -kc), 1.5) * 1.05, L);
    kl += WD * 0.25; kr += WD * 0.25;
    let lx = lerp(-0.12, s * 0.7, L), lz = 0.16 + 0.04 * L, le = lerp(-0.4, -0.8, L) - WD * 0.3;
    // ---- the sword: rest on the shoulder, two-handed guard while fighting, tip dragging while Winded ----
    _P.copy(REST.P); _D.copy(REST.D); _E.copy(REST.E); blend(GUARD, A.gw); blend(WINDED, WD * (1 - A.gw * 0.5));
    let tw = A.gw * (1 - WD), yaw = 0;
    // ---- one-shot moves ----
    if (A.swing > 0 || A.hold > 0) {
      let sw, k, w;
      if (A.swing > 0) { A.swing -= dt; sw = SW[A.swingKind] || SW[0]; k = 1 - Math.max(0, A.swing) / A.swingDur; w = k <= sw.end ? 1 : 1 - smooth((k - sw.end) / (1 - sw.end));
        if (A.swing <= 0 && A.swingKind === 2) A.hold = 0.45; }
      else { A.hold -= dt; if (p.dash && !rolling) A.hold = Math.max(A.hold, 0.05); sw = null; k = 1; w = sat(A.hold / 0.15); }
      if (sw) { sample(sw, k, _t, _u); const t1 = sw.keys[0][0], t3 = sw.keys[Math.min(2, sw.keys.length - 1)][0]; yaw = (k < t1 ? lerp(0, sw.yaw[0], smooth(k / t1)) : lerp(sw.yaw[0], sw.yaw[1], smooth((k - t1) / Math.max(1e-3, t3 - t1)))) * w; }
      else { _t.copy(HOLD.P); _u.copy(HOLD.D); }
      _P.lerp(_t, w); _D.lerp(_u, w); if (_D.lengthSq() < 1e-6) _D.copy(_u); _D.normalize(); tw = lerp(tw, 1, w);
      const kind = sw ? A.swingKind : 2;
      if (kind <= 1) { const e = w * Math.sin(Math.min(1, k * 1.25) * PI); hips.position.y -= 0.05 * e; tl -= 0.32 * e; tr += 0.26 * e; kl += 0.28 * e; kr += 0.22 * e; hips.rotation.y += yaw * 0.35; torso.rotation.x += 0.08 * e; }
      else if (kind === 2) { const e = w * smooth(sw ? k / 0.6 : 1); hips.position.y -= 0.08 * e; kl += 0.42 * e; kr += 0.36 * e; tl -= 0.25 * e; tr += 0.15 * e; torso.rotation.x -= 0.16 * e; head.rotation.x -= 0.12 * e; body.rotation.x -= 0.04 * e; }
      else { const imp = smooth((k - 0.2) / 0.1) * w; hips.position.y -= 0.24 * imp; torso.rotation.x += 0.5 * imp; body.rotation.x += 0.1 * imp; head.rotation.x -= 0.25 * imp; tl = lerp(tl, -0.85, imp); kl = lerp(kl, 1.05, imp); tr = lerp(tr, 0.55, imp); kr = lerp(kr, 0.75, imp);
        torso.rotation.x -= 0.18 * w * smooth(k / 0.15) * (1 - imp); }
    }
    torso.rotation.y += yaw;
    // ---- Kindle: hold the blade upright and pour a flask along it ----
    let lW = 0; // left-hand IK weight toward _lt (overrides the grip)
    if (A.pour > 0) { A.pour -= dt; const k = 1 - A.pour / 0.75, w = smooth(k / 0.15) * (1 - smooth((k - 0.8) / 0.2)); blend(POUR, w); tw *= 1 - w;
      _lt.copy(POUR.P).addScaledVector(POUR.D, lerp(0.45, 1.45, smooth((k - 0.15) / 0.6))).add(_hr.set(0.02, 0, 0.07)); lW = w; head.rotation.x += 0.1 * w; }
    // ---- Ember Flask: from the belt to the visor and back ----
    if (A.drink > 0.01) { const up = smooth(prog / 0.25) * (1 - smooth((prog - 0.85) / 0.15)) * A.drink;
      _lt.set(0.18, -0.06, 0.16).lerp(_hr.set(0.05, 0.78, 0.34), up); lW = Math.max(lW, A.drink); tw *= 1 - A.drink; head.rotation.x -= 0.4 * up; torso.rotation.x -= 0.08 * up; }
    // ---- roll: a tucked forward roll, or a hop back when no direction is held ----
    if (rolling) { const k = 1 - rollT / 0.42;
      if (A.rollKind === 1) { const tuck = Math.sin(sat(k / 0.92) * PI); hips.rotation.x = smooth(sat((k - 0.06) / 0.8)) * TAU; hips.position.y = 0.92 - 0.48 * tuck;
        torso.rotation.x += 0.9 * tuck; head.rotation.x += 0.4 * tuck; tl = lerp(tl, -1.75, tuck); tr = lerp(tr, -1.5, tuck); kl = lerp(kl, 2.15, tuck); kr = lerp(kr, 2.0, tuck); blend(TUCK, tuck); tw = lerp(tw, 1, tuck); }
      else { const hop = Math.sin(k * PI), land = smooth((k - 0.7) / 0.3); body.rotation.x -= 0.28 * hop; hips.position.y += 0.1 * hop - 0.1 * land * (1 - smooth((k - 0.9) / 0.1)); tl = lerp(tl, -0.5, hop); tr = lerp(tr, -0.1, hop); kl += 0.8 * hop; kr += 0.6 * hop; blend(GUARD, hop); tw = lerp(tw, 1, hop); }
    } else hips.rotation.x = 0;
    // ---- airborne / the Overhead leap ----
    if (A.air > 0.01 && !rolling) { const q = A.air; tl = lerp(tl, -0.85, q); tr = lerp(tr, 0.25, q); kl = lerp(kl, 1.2, q); kr = lerp(kr, 0.7, q); lz = lerp(lz, 0.45, q); body.rotation.x -= 0.08 * A.leap; }
    if (p.pose === 'fall') { body.rotation.x = 1.28 + Math.sin(t * 2.3) * 0.05 + L * 0.12; body.position.set(0, 0.75, -0.95); body.rotation.z = Math.sin(t * 1.7) * 0.05;
      tl = 0.25 + Math.sin(t * 5) * 0.05; tr = 0.25 - Math.sin(t * 5) * 0.05; kl = kr = 0.7; if (A.swing <= 0) { lx = -2.3; lz = 0.75; le = -0.5; tw = 0; } }
    if (p.flashT > 0) { const q = p.flashT / 0.15; torso.rotation.x -= 0.16 * q; head.rotation.x -= 0.12 * q; }
    // ---- apply: legs, then both arms by IK onto the grip ----
    legL.hip.rotation.set(tl, 0, zl); legR.hip.rotation.set(tr, 0, zr); legL.knee.rotation.x = kl; legR.knee.rotation.x = kr;
    const tilt = body.rotation.x + (rolling ? 0 : hips.rotation.x);
    legL.ankle.rotation.x = clamp(-(tl + kl + tilt) * 0.85 + (L > 0.2 ? Math.max(0, -s) * 0.35 * L : 0), -0.9, 0.9); legR.ankle.rotation.x = clamp(-(tr + kr + tilt) * 0.85 + (L > 0.2 ? Math.max(0, s) * 0.35 * L : 0), -0.9, 0.9);
    armR.sh.rotation.set(-0.4, 0, -0.2); armR.el.rotation.x = -0.8;
    ik(armR, _P, _pole.set(-0.75, -0.55, -0.15), 1, _hr);
    // edge: leads along the tip's motion during a cut, otherwise follows the pose (either edge, it is double-edged)
    _t.copy(_P).addScaledVector(_D, 1.2);
    if (A.tipOk && dt > 0 && A.swing > 0) { _u.subVectors(_t, A.tip); if (_u.lengthSq() > (dt * 2.5) ** 2) _E.copy(_u); }
    A.tip.copy(_t); A.tipOk = true;
    _E.addScaledVector(_D, -_E.dot(_D)); if (_E.lengthSq() < 1e-6) _E.set(1, 0, 0).addScaledVector(_D, -_D.x); _E.normalize(); if (_E.dot(A.E) < 0) _E.negate();
    A.E.lerp(_E, 1 - Math.exp(-22 * dt)).addScaledVector(_D, -A.E.dot(_D)); if (A.E.lengthSq() < 1e-6) A.E.copy(_E); A.E.normalize();
    A.P.copy(_P); A.D.copy(_D);
    _c1.crossVectors(A.E, _D); _m1.makeBasis(A.E, _D, _c1); _q.setFromRotationMatrix(_m1); // the blade's orientation in torso space
    _q2.copy(armR.sh.quaternion).multiply(armR.el.quaternion); weapon.quaternion.copy(_qi.copy(_q2).invert().multiply(_q));
    armL.sh.rotation.set(lx, 0, lz); armL.el.rotation.x = le;
    const gW = tw * (1 - lW); _pole.set(0.8, -0.5, -0.1);
    if (gW > 0.01) ik(armL, _g.copy(_hr).addScaledVector(_D, -0.17), _pole, gW, null);
    if (lW > 0.01) ik(armL, _lt, _pole.set(0.7, -0.6, -0.3), lW, null);
    for (const a of [armL, armR]) a.pd.quaternion.set(0, 0, 0, 1).slerp(a.sh.quaternion, 0.38);
    // ---- cloth: cape, tabard, tassets, flasks, plume ----
    const chestTilt = rolling ? 0 : tilt + torso.rotation.x;
    for (let k = 0; k < cape.length; k++) { const q = cape[k];
      const tgt = k === 0 ? clamp(0.04 + Math.max(0, Math.max(tl, tr)) * 0.2 + Math.max(0, A.vz) * 0.022 + A.air * 0.35 + Math.sin(t * 6.5) * 0.04 * L - chestTilt * 0.9, -chestTilt - 0.05, 1.2)
        : 0.1 * sat(A.vz / 6) + 0.03 * k - Math.max(0, cape[0].o.rotation.x - 0.15) * (0.3 + 0.1 * k) + Math.sin(t * 7 - k * 1.25) * (0.1 * L + 0.025) + A.air * 0.08 + Math.max(0, -A.vz) * 0.03;
      q.o.rotation.x = q.spr.step(tgt, dt); q.o.rotation.z = q.sprZ.step(-A.vx * 0.04 * (k ? 0.5 : 1), dt); }
    tabard.rotation.x = -clamp(tabSpr.step(Math.max(0, -Math.min(tl, tr)) * 1.05 + tilt + A.vz * -0.03 + A.air * 0.3 + Math.sin(t * 8) * 0.03 * L, dt), -0.1, 1.4);
    for (const q of tassets) { const lg = q.phi > 0 ? tl : tr; q.pv.rotation.x = -clamp(q.spr.step(Math.max(0, -lg) * 0.85 + 0.03 + tilt * 0.4, dt), -0.05, 1.2); }
    const uses = p.sk && p.sk[6] ? p.sk[6].uses : 4, shown = clamp((uses === Infinity ? 4 : uses) - (drinking ? 1 : 0), 0, 4);
    for (let i = 0; i < 4; i++) { const q = flasks[i]; q.pv.visible = i < shown; if (!q.pv.visible) continue;
      const bob = Math.sin(ph * 2 + i) * 0.18 * L;
      q.pv.rotation.x = q.spr.step(-tilt + A.vz * 0.035 + bob, dt); q.pv.rotation.z = q.sprZ.step(-A.vx * 0.04 + Math.sin(ph + i) * 0.08 * L, dt); }
    handFlask.visible = A.drink > 0.05 || (A.pour > 0 && A.pour > 0.12);
    for (let k = 0; k < plume.length; k++) { const q = plume[k], tgt = k === 0 ? 0.55 + Math.max(0, A.vz) * 0.06 + A.air * 0.3 - (chestTilt + head.rotation.x) * 0.9 : 0.2 + Math.sin(t * 8 - k) * 0.06 * L;
      q.o.rotation.x = q.spr.step(tgt, dt); q.o.rotation.z = q.sprZ.step(-A.vx * 0.05, dt); }
    // ---- glow: seams breathe with stamina, the blade heats with Kindle and goes white-hot on an opening ----
    const swingGlow = A.swing > 0 && A.swingKind >= 2 ? 0.5 : 0;
    seamM.color.copy(seamBase).multiplyScalar((0.25 + 0.75 * sf) * (1 + 0.15 * br) * (1 + 0.6 * A.heat + 1.2 * A.open) * (1 - 0.55 * WD));
    eyeM.color.copy(eyeBase).multiplyScalar((1 + 1.6 * A.open + 0.4 * A.heat + swingGlow) * (1 - 0.5 * WD) * (0.9 + 0.1 * Math.sin(t * 3.1)));
    singeM.color.copy(singeBase).multiplyScalar(0.8 + 0.25 * Math.sin(t * 2.2) + A.heat * 0.9);
    const flick = 0.8 + 0.2 * Math.sin(t * 23) * Math.sin(t * 7.3);
    fullerM.color.copy(fullerBase).multiplyScalar(0.7 + 0.3 * sf + A.heat * 0.7 * flick + A.open * 2 + swingGlow);
    heatU.value = A.heat * flick + swingGlow * 0.4; whiteU.value = A.open * (0.7 + 0.3 * Math.sin(t * 14));
    flaskM.color.copy(flaskBase).multiplyScalar(0.85 + 0.15 * Math.sin(t * 2.6));
    handFlaskM.color.copy(flaskBase).multiplyScalar(drinking ? 2.2 * (1 - prog * 0.8) : 1.8);
    rimU.value.copy(rimBase).multiplyScalar(1 + A.open * 1.6 + A.heat * 0.35);
    const ign = A.pour > 0 ? smooth((1 - A.pour / 0.75 - 0.2) / 0.5) : 1, fl = A.heat * ign;
    flameMat.uniforms.uI.value = fl * (1.1 + 0.15 * Math.sin(t * 17)); flameMat.uniforms.uT.value = t; for (const m of flames) m.visible = fl > 0.02 && !G.headless;
    aura.intensity = 1.3 + A.heat * 1.6 + A.open * 2.5 + (p.flashT > 0 ? 6 : 0) + swingGlow * 2;
    A.ps = A.swing;
  }
  return { group: g, update, anim: A, wtip, body, swing(kind = 0, dur = 0.3) { A.swing = A.swingDur = dur; A.swingKind = kind; } };
};
