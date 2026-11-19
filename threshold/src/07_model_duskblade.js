// ============================== DUSKBLADE ==============================
// A dusk knight built on HeroKit (07_hero.js). Close helm with a silver crescent crest, swept horns, a lit visor and a ribbon;
// asymmetric kit: a pauldron of flared plate lames and a folded half-cape on the off-hand side, a light sword arm; fluted breastplate with
// a glowing sigil, faulds, hinged tassets, a front tabard and split tails. A single-edged blade with a glowing edge and a clear point, five
// Momentum runes and a swing trail, and a parrying dagger held reverse in the off hand. Stylised for the top-down camera: big
// helm and pauldrons, heavy gauntlets and greaves, three values (dark under-plate, mid plate, magenta-violet cape) under
// pale silver trim, and a strong rim so the silhouette holds on dark floors.
// Swings are keyframed poses (wind-up, a strike still moving at contact, a decelerating follow-through, a recovery); the blade is aimed in body space, so every pose says where
// the blade points, not how the wrist bends. Feet are kept on the floor by dropping the hips. The half-cape is one cloth sheet
// draped every frame from gravity, a flare spring and a yaw-lag spring.
// Kept in its own file so other class models can land in 07_hero.js without touching this one.
HERO_MODELS.duskblade = function buildDuskblade(cls) {
  const C = cls.look, K = HeroKit, P = K.parts(), g = new THREE.Group(), pick = (v, d) => v !== undefined ? v : d;
  const glowC = new THREE.Color(C.glow), clothC = new THREE.Color(C.cloth), hotC = glowC.clone().lerp(new THREE.Color(0xff5a9c), 0.5);
  // three values: dark blackened under-plate (gauntlets, cuisses, sabatons, faulds), mid violet plate, and a cape shifted
  // toward magenta-violet (darker outside, a bright magenta lining); pale silver trim sits on the top of the silhouette
  const armorC = new THREE.Color(C.armor).multiplyScalar(2.1).lerp(new THREE.Color(pick(C.metal, 0xb9b2cc)), 0.2), darkC = new THREE.Color(C.armor).multiplyScalar(0.62).lerp(new THREE.Color(pick(C.inner, 0x1b1622)), 0.3);
  const linC = new THREE.Color(pick(C.lining, clothC.clone().multiplyScalar(0.5).getHex())), capeC = clothC.clone().lerp(linC, 0.38).multiplyScalar(2.3), tabC = clothC.clone().lerp(linC, 0.25).multiplyScalar(1.7);
  const rimBase = glowC.clone().lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(0.5), rimU = { value: rimBase.clone() };
  const lining = linC.clone().multiplyScalar(2.2).lerp(new THREE.Color(0xe0408f), 0.2).getHex();
  const plateM = K.mat({ color: armorC, roughness: 0.34, metalness: 0.5, envMapIntensity: 1.4 }, rimU, 1.4);
  const darkM = K.mat({ color: darkC, roughness: 0.4, metalness: 0.6, envMapIntensity: 1.2 }, rimU, 1.1);
  const shellM = K.mat({ color: armorC, roughness: 0.34, metalness: 0.5, envMapIntensity: 1.4, side: THREE.DoubleSide }, rimU, 1.4, darkC.getHex()); // open shells seen from below
  const metalC = new THREE.Color(pick(C.metal, 0xb9b2cc)).lerp(new THREE.Color(1, 1, 1), 0.45), trimM = K.mat({ color: metalC, roughness: 0.2, metalness: 0.85, envMapIntensity: 1.9, emissive: metalC, emissiveIntensity: 0.16 }, rimU, 1.2);
  const clothM = K.mat({ color: tabC, roughness: 0.8, side: THREE.DoubleSide }, rimU, 1.0, lining);
  const capeM = K.mat({ color: capeC, roughness: 0.82, side: THREE.DoubleSide, vertexColors: true }, rimU, 1.0, lining);
  const plumeM = K.mat({ color: lining, roughness: 0.7, side: THREE.DoubleSide, emissive: lining, emissiveIntensity: 0.25 }, rimU, 0.9);
  const innerM = K.mat({ color: pick(C.inner, 0x1b1622), roughness: 0.92 }, rimU, 0.6);
  const leatherM = K.mat({ color: pick(C.leather, 0x2a1d26), roughness: 0.6 }, rimU, 0.6);
  const bladeM = K.mat({ color: 0x3a3650, roughness: 0.14, metalness: 1, envMapIntensity: 2.2 }, rimU, 1.0);
  const voidM = new THREE.MeshBasicMaterial({ color: 0x020104 });
  const edgeM = W.glow(C.glow, 3.4), sigilM = W.glow(C.glow, 2.0), visorM = W.glow(C.glow, 3.4), beltM = W.glow(C.glow, 0.7), dagM = W.glow(C.glow, 0.5), dagBase = dagM.color.clone();
  const runeOn = W.glow(hotC, 3.4), runeOff = new THREE.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(0.14) });
  const edgeBase = edgeM.color.clone(), sigilBase = sigilM.color.clone(), visorBase = visorM.color.clone(), hotEdge = hotC.clone().multiplyScalar(3.6);
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  // tube whose radius tapers from r0 to r1 (horns, quillons)
  const horn = (pts, r0, r1, segs = 14, rad = 6) => { const cv = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new V3(x, y, z))), geo = new THREE.TubeGeometry(cv, segs, 1, rad, false), pa = geo.attributes.position, c = new V3();
    for (let i = 0; i <= segs; i++) { cv.getPointAt(i / segs, c); const r = lerp(r0, r1, i / segs); for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; pa.setXYZ(k, c.x + (pa.getX(k) - c.x) * r, c.y + (pa.getY(k) - c.y) * r, c.z + (pa.getZ(k) - c.z) * r); } }
    return geo; };
  // crescent: an arc of a torus with its opening up
  const crescent = (r, tube, arc = PI * 1.25) => { const t = new THREE.TorusGeometry(r, tube, 4, 20, arc); t.rotateZ(-PI / 2 - arc / 2); return t; };
  // flared plate cup (couter, poleyn): a low dome along +y
  const cup = (r, h) => K.lathe([[r, -0.005], [r * 0.92, h * 0.3], [r * 0.55, h * 0.78], [0.0, h]], 10);

  // ---- skeleton ----
  const body = grp(g), hips = grp(body, 0, 0.95, 0), torso = grp(hips, 0, 0.02, 0), head = grp(torso, 0, 0.69, 0);
  body.rotation.order = 'YXZ'; head.scale.setScalar(1.22);
  // ---- torso: fluted breastplate with a keel, a ridged plackart, a waist taper, sigil, a two-lame gorget ----
  const TP = [[0.148, -0.06], [0.15, 0.06], [0.178, 0.2], [0.228, 0.34], [0.236, 0.44], [0.212, 0.53], [0.158, 0.61], [0.09, 0.67], [0.075, 0.72]], TZ = 0.78;
  const rAt = (y) => { for (let i = 1; i < TP.length; i++) if (y <= TP[i][1]) return lerp(TP[i - 1][0], TP[i][0], (y - TP[i - 1][1]) / (TP[i][1] - TP[i - 1][1])); return TP[TP.length - 1][0]; };
  P.add(torso, plateM, K.lathe(TP, 26), 0, 0, 0, 0, 0, 0, 1, 1, TZ);
  { const keel = []; for (let k = 0; k <= 10; k++) { const y = 0.1 + k * 0.05; keel.push([0, y, rAt(y) * TZ + 0.004]); } P.add(torso, trimM, K.tube(keel, 0.009, 20, 5)); }
  for (const s of [1, -1]) { const fl = []; for (let k = 0; k <= 8; k++) { const y = 0.14 + k * 0.05, a = s * (0.55 + 0.25 * k / 8); fl.push([Math.sin(a) * rAt(y) * 1.004, y, Math.cos(a) * rAt(y) * TZ * 1.004]); } P.add(torso, trimM, K.tube(fl, 0.006, 16, 4)); }
  { const pr = []; for (let k = 0; k <= 12; k++) { const a = -1.2 + k / 12 * 2.4, y = 0.19 + 0.05 * Math.cos(a * 1.3); pr.push([Math.sin(a) * rAt(y) * 1.01, y, Math.cos(a) * rAt(y) * TZ * 1.01 + 0.002]); } P.add(torso, trimM, K.tube(pr, 0.008, 24, 4)); }
  P.add(torso, trimM, K.lathe([[rAt(0.03) + 0.004, 0.03], [rAt(0.075) + 0.004, 0.075]], 26), 0, 0, 0, 0, 0, 0, 1, 1, TZ * 1.02);
  P.add(torso, sigilM, crescent(0.064, 0.009), 0, 0.4, rAt(0.4) * TZ + 0.014);
  P.add(torso, sigilM, new THREE.OctahedronGeometry(0.026), 0, 0.41, rAt(0.41) * TZ + 0.016, 0, 0, 0, 0.8, 1.2, 0.4);
  P.add(torso, plateM, K.lathe([[0.175, 0.575], [0.168, 0.62], [0.138, 0.655]], 20), 0, 0, 0, 0, 0, 0, 1, 1, 0.9);
  P.add(torso, plateM, K.lathe([[0.142, 0.64], [0.136, 0.69], [0.108, 0.735]], 20), 0, 0, 0, 0, 0, 0, 1, 1, 0.92);
  P.add(torso, trimM, new THREE.TorusGeometry(0.174, 0.008, 4, 22), 0, 0.578, 0, PI / 2, 0, 0, 1, 0.9, 1);
  P.add(torso, trimM, new THREE.TorusGeometry(0.141, 0.007, 4, 22), 0, 0.645, 0, PI / 2, 0, 0, 1, 0.92, 1);
  // ---- hips: belt, faulds (the buckle glow is kept low so it never outshines the blade) ----
  P.add(hips, leatherM, new THREE.TorusGeometry(0.182, 0.026, 6, 28), 0, 0.0, 0, PI / 2, 0, 0, 1, 0.82, 1);
  P.add(hips, leatherM, new THREE.BoxGeometry(0.075, 0.06, 0.022), 0, 0.0, 0.155);
  P.add(hips, beltM, new THREE.OctahedronGeometry(0.014), 0, 0.0, 0.168, 0, 0, 0, 1, 1.3, 0.5);
  for (let k = 0; k < 3; k++) { const y0 = -0.025 - k * 0.062, r0 = 0.19 + k * 0.013, r1 = 0.205 + k * 0.015;
    P.add(hips, darkM, K.lathe([[r1, y0 - 0.075], [r0, y0]], 14, -1.3, 2.6), 0, 0, 0, 0, 0, 0, 1, 1, 0.86);
    P.add(hips, trimM, K.lathe([[r1 + 0.003, y0 - 0.08], [r1 + 0.001, y0 - 0.068]], 14, -1.3, 2.6), 0, 0, 0, 0, 0, 0, 1, 1, 0.86); }

  // ---- head: close helm, snouted visor under a brow ridge, lit eye slits, crescent crest, swept horns ----
  P.add(head, plateM, new THREE.SphereGeometry(0.128, 18, 14), 0, 0.135, -0.008, 0, 0, 0, 1, 1.08, 1.12);
  P.add(head, plateM, new THREE.SphereGeometry(0.138, 18, 10, PI / 2 - 1.05, 2.1, 0.95, 1.3), 0, 0.12, 0.004, 0, 0, 0, 1, 1, 1.2);
  P.add(head, plateM, K.lathe([[0.1, -0.03], [0.128, 0.03], [0.14, 0.08]], 16, -1.25, 2.5), 0, 0.01, 0.0, 0, 0, 0, 1, 1, 1.18);
  P.add(head, trimM, K.lathe([[0.139, 0.156], [0.146, 0.166], [0.141, 0.178]], 14, -1.05, 2.1), 0, 0, 0.004, 0, 0, 0, 1, 1, 1.2);
  { const vz = (y) => { const d = (y - 0.12) / 0.138; return Math.sqrt(Math.max(0, 1 - d * d)) * 0.138 * 1.2 + 0.004 + 0.004; }; const kp = []; for (let k = 0; k <= 8; k++) { const y = 0.215 - k * 0.022; kp.push([0, y, vz(y)]); } P.add(head, trimM, K.tube(kp, 0.0085, 16, 5)); }
  for (const s of [1, -1]) { P.add(head, voidM, new THREE.BoxGeometry(0.064, 0.026, 0.01), s * 0.034, 0.139, 0.161, 0, s * 0.42, s * 0.2); P.add(head, visorM, new THREE.BoxGeometry(0.054, 0.013, 0.012), s * 0.034, 0.139, 0.166, 0, s * 0.42, s * 0.2); }
  for (let k = 0; k < 3; k++) P.add(head, voidM, new THREE.BoxGeometry(0.008, 0.026, 0.02), -0.05 - k * 0.016, 0.07, 0.15 - k * 0.012, 0, -0.5, 0);
  // crest: a crescent fin from brow to nape, with a lit edge
  { const sh = new THREE.Shape(), N = 18, outer = [], th0 = 0.75, th1 = PI + 0.3, hgt = (u) => 0.006 + 0.06 * Math.pow(Math.sin(u * PI * 0.9), 0.9) + (u > 0.75 ? (u - 0.75) * 0.2 : 0);
    for (let k = 0; k <= N; k++) { const u = k / N, th = lerp(th0, th1, u), r = 0.13 + hgt(u); outer.push([Math.cos(th) * r, Math.sin(th) * r]); }
    sh.moveTo(outer[0][0], outer[0][1]); for (const [x, y] of outer) sh.lineTo(x, y); for (let k = N; k >= 0; k--) { const th = lerp(th0, th1, k / N); sh.lineTo(Math.cos(th) * 0.11, Math.sin(th) * 0.11); }
    const cg = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false, curveSegments: 4 }); cg.translate(0, 0, -0.008); P.add(head, trimM, cg, 0, 0.14, -0.015, 0, -PI / 2, 0, 1.12, 1.08, 1);
    P.add(head, sigilM, K.tube(outer.map(([z, y]) => [0, 0.14 + y * 1.08, -0.015 + z * 1.12]), 0.005, 36, 4)); }
  for (const s of [1, -1]) P.add(head, trimM, horn([[s * 0.11, 0.16, 0.04], [s * 0.165, 0.2, -0.02], [s * 0.19, 0.255, -0.11], [s * 0.18, 0.3, -0.21]], 0.022, 0.003));
  // plume: hangs from the nape of the crest
  const plume = []; { let par = grp(head, 0, 0.255, -0.16);
    // one tapered ribbon (a flattened prism, so it keeps its width from the side) narrowing to a point
    for (let k = 0; k < 4; k++) { const seg = grp(par, 0, k ? -0.15 : 0, 0), w0 = 0.046 * (1 - k / 4) + 0.003, w1 = 0.046 * (1 - (k + 1) / 4) + 0.003; P.add(seg, plumeM, new THREE.CylinderGeometry(w0, w1, 0.155, 6, 1), 0, -0.075, 0, 0, 0, 0, 1, 1, 0.5); plume.push({ o: seg, spr: K.spring(60 - k * 9, 6.5), sprZ: K.spring(45, 6) }); par = seg; } }

  // ---- arms: the off hand (left, +x) carries the big crescent pauldron; heavy vambraces, flared couters, gauntlet fists ----
  const HS = 1.3;
  const mkArm = (side) => {
    const big = side > 0, sh = grp(torso, side * 0.25, 0.55, -0.01), n = big ? 3 : 2, R = big ? 0.118 : 0.1, ps = big ? 1.22 : 1.15;
    const pad = (mat, geo, x, y, z, rx, ry, rz, sx = 1, sy = sx, sz = sx) => P.add(sh, mat, geo.scale(ps, ps, ps), x * ps, y * ps, z * ps, rx, ry, rz, sx, sy, sz);
    // a low flat cap, then overlapping plate lames down the arm, each flaring out to a sharp lower edge with a silver rim
    pad(shellM, new THREE.SphereGeometry(R * 0.96, 18, 5, 0, TAU, 0, PI * 0.5), side * 0.005, 0.045, 0, 0, 0, side * -0.28, 1.05, 0.5, 1.05);
    { const rim = new THREE.TorusGeometry(R * 0.96, 0.009, 4, 26); rim.rotateX(PI / 2); pad(trimM, rim, side * 0.005, 0.045, 0, 0, 0, side * -0.28, 1.05, 0.5, 1.05); }
    const ph0 = side > 0 ? PI / 2 - 1.75 : -PI / 2 - 1.75;
    for (let k = 0; k < n; k++) { const r = R * (1.0 - k * 0.04), x = side * (0.03 + k * 0.03), y = 0.01 - k * 0.046, rz = side * -(0.5 + k * 0.2);
      pad(shellM, K.lathe([[r * 0.78, 0.03], [r * 0.97, 0.004], [r * 1.05, -0.03], [r * 1.17, -0.048]], 16, ph0, 3.5), x, y, 0, 0, 0, rz);
      pad(trimM, K.lathe([[r * 1.18, -0.054], [r * 1.18, -0.044], [r * 1.12, -0.038]], 16, ph0, 3.5), x, y, 0, 0, 0, rz); }
    if (big) pad(sigilM, crescent(0.034, 0.006), side * 0.118, -0.025, 0, 0, side * PI / 2, side * -0.62);
    P.add(sh, innerM, K.lathe([[0.058, -0.3], [0.064, -0.18], [0.07, -0.05], [0.068, 0.03]], 12));
    P.add(sh, plateM, K.lathe([[0.064, -0.27], [0.07, -0.17], [0.076, -0.07], [0.072, -0.01]], 12, -side * 0.2 + PI / 2 * side - 1.6, 3.2));
    P.add(sh, trimM, new THREE.TorusGeometry(0.066, 0.006, 4, 16), 0, -0.26, 0, PI / 2, 0, 0);
    const el = grp(sh, 0, -0.29, 0);
    P.add(el, plateM, cup(0.074, 0.075), 0, 0.0, -0.01, -PI / 2, 0, 0);
    P.add(el, plateM, new THREE.SphereGeometry(0.085, 10, 8), side * 0.06, 0.0, -0.015, 0, 0, 0, 0.24, 1, 1);
    P.add(el, trimM, new THREE.TorusGeometry(0.072, 0.006, 4, 16), 0, 0.0, -0.012);
    P.add(el, innerM, K.lathe([[0.05, -0.08], [0.056, 0.03]], 10));
    P.add(el, plateM, K.lathe([[0.064, -0.24], [0.076, -0.16], [0.084, -0.07], [0.076, -0.02]], 12));
    for (const [y, r] of [[-0.035, 0.08], [-0.228, 0.067]]) P.add(el, trimM, new THREE.TorusGeometry(r, 0.0065, 4, 16), 0, y, 0, PI / 2, 0, 0);
    P.add(el, side > 0 ? dagM : sigilM, new THREE.BoxGeometry(0.009, 0.12, 0.009), side * 0.082, -0.13, 0);
    const hand = grp(el, 0, -0.275, 0); hand.scale.setScalar(HS);
    P.add(hand, plateM, K.lathe([[0.068, -0.045], [0.058, -0.0], [0.05, 0.04]], 12));
    P.add(hand, leatherM, new THREE.SphereGeometry(0.046, 10, 8), 0, -0.075, 0.008, 0, 0, 0, 0.95, 1.05, 1.15);
    P.add(hand, darkM, new THREE.BoxGeometry(0.078, 0.05, 0.03), 0, -0.07, -0.032, 0, 0, 0);
    P.add(hand, darkM, new THREE.BoxGeometry(0.084, 0.026, 0.06), 0, -0.108, 0.006, 0.3, 0, 0);
    P.add(hand, trimM, new THREE.BoxGeometry(0.088, 0.01, 0.012), 0, -0.118, 0.036, 0.3, 0, 0);
    P.add(hand, darkM, new THREE.CapsuleGeometry(0.017, 0.035, 3, 6), side * -0.038, -0.07, 0.035, 0.9, 0, side * 0.5);
    return { sh, el, hand };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  // ---- legs: cuisses, flared poleyns with side wings, heavy greaves, big pointed sabatons ----
  const mkLeg = (side) => {
    const hip = grp(hips, side * 0.112, -0.02, 0);
    P.add(hip, innerM, K.lathe([[0.072, -0.45], [0.09, -0.3], [0.112, -0.12], [0.12, 0.02]], 12));
    P.add(hip, darkM, K.lathe([[0.084, -0.42], [0.103, -0.3], [0.122, -0.13], [0.127, -0.05]], 12, -1.45 + side * 0.25, 2.9));
    P.add(hip, trimM, K.lathe([[0.085, -0.425], [0.088, -0.405]], 12, -1.45 + side * 0.25, 2.9));
    const knee = grp(hip, 0, -0.45, 0);
    P.add(knee, plateM, cup(0.082, 0.08), 0, 0.01, 0.03, PI / 2, 0, 0, 1, 1, 1.2);
    P.add(knee, trimM, new THREE.TorusGeometry(0.078, 0.0065, 4, 18), 0, 0.01, 0.03, 0, 0, 0, 1, 1.2, 1);
    P.add(knee, plateM, new THREE.SphereGeometry(0.09, 10, 8), side * 0.068, 0.0, 0.02, 0, 0, 0, 0.24, 1, 1);
    P.add(knee, plateM, K.lathe([[0.075, -0.4], [0.078, -0.32], [0.094, -0.2], [0.1, -0.1], [0.09, -0.02], [0.082, 0.03]], 12));
    P.add(knee, trimM, new THREE.TorusGeometry(0.078, 0.0065, 4, 16), 0, -0.385, 0, PI / 2, 0, 0);
    const ankle = grp(knee, 0, -0.42, 0); ankle.scale.setScalar(1.25);
    P.add(ankle, darkM, new THREE.SphereGeometry(0.068, 12, 8), 0, -0.034, 0.048, 0, 0, 0, 0.8, 0.55, 1.6);
    P.add(ankle, darkM, new THREE.ConeGeometry(0.032, 0.09, 6), 0, -0.045, 0.19, PI / 2, 0, 0, 1, 1, 0.55);
    for (let k = 0; k < 3; k++) P.add(ankle, trimM, new THREE.TorusGeometry(0.06 - k * 0.006, 0.005, 3, 14, PI), 0, -0.035, 0.03 + k * 0.045, 0, 0, 0, 0.8, 0.55, 1);
    P.add(ankle, leatherM, new THREE.BoxGeometry(0.1, 0.018, 0.24), 0, -0.063, 0.06);
    return { hip, knee, ankle };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);
  // tassets: plates hinged under the faulds that follow the thighs
  const tassets = []; for (const s of [1, -1]) { const ts = grp(hips, s * 0.1, -0.2, 0); ts.rotation.order = 'YXZ';
    P.add(ts, plateM, K.lathe([[0.112, -0.17], [0.1, 0.0]], 8, s * 0.35 - 0.75, 1.5)); P.add(ts, trimM, K.lathe([[0.114, -0.176], [0.112, -0.162]], 8, s * 0.35 - 0.75, 1.5));
    tassets.push({ o: ts, s, spr: K.spring(120, 14) }); }
  // front tabard with a crescent, and two long split tails at the back
  const tabard = grp(hips, 0, -0.03, 0.2), tabSpr = K.spring(60, 7);
  { const sh = new THREE.Shape([new THREE.Vector2(-0.085, 0), new THREE.Vector2(0.085, 0), new THREE.Vector2(0.075, -0.46), new THREE.Vector2(0, -0.56), new THREE.Vector2(-0.075, -0.46)]);
    P.add(tabard, clothM, new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false }), 0, 0, -0.005);
    P.add(tabard, beltM, crescent(0.034, 0.006), 0, -0.24, 0.008); P.add(tabard, trimM, new THREE.BoxGeometry(0.18, 0.022, 0.022), 0, -0.006, 0.004); }
  const tails = [];
  for (const [sx, n] of [[0.075, 4], [-0.075, 3]]) { let par = grp(hips, sx, -0.03, -0.17); const chain = [];
    for (let k = 0; k < n; k++) { const seg = grp(par, 0, k ? -0.17 : 0, 0), w = 0.12 - k * 0.012;
      P.add(seg, clothM, new THREE.BoxGeometry(w, 0.175, 0.008), 0, -0.085, 0);
      if (k === n - 1) { const tp = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, -0.09)]); P.add(seg, clothM, new THREE.ExtrudeGeometry(tp, { depth: 0.008, bevelEnabled: false }), 0, -0.17, -0.004); }
      chain.push({ o: seg, spr: K.spring(55 - k * 9, 6), sprZ: K.spring(40, 6) }); par = seg; }
    tails.push(chain); }
  // half-cape off the left shoulder: one sheet of CN columns x CR rows, re-draped every frame in torso space (see update);
  // vertical folds (an offset across the width that deepens toward the hem, valleys shaded darker) and a long, uneven torn hem
  const CN = 19, CR = 9, CFR = [0, 0.14, 0.28, 0.42, 0.56, 0.69, 0.8, 0.89, 0.95, 1.0], cOut = [], cTan = [], cTop = [], cLen = [], cFold = [];
  const rnd = (i) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < CN; i++) { const u = i / (CN - 1), phi = lerp(1.8, 3.9, u), edge = i === 0 || i === CN - 1;
    cOut.push(new V3(Math.sin(phi), 0, Math.cos(phi))); cTan.push(new V3(Math.cos(phi), 0, -Math.sin(phi)));
    cTop.push(new V3(Math.sin(phi) * 0.205, 0.61 + 0.03 * Math.sin(u * PI), Math.cos(phi) * 0.205 * 0.9));
    cFold.push(Math.sin(u * 3.5 * TAU + 0.5) * (edge ? 0.3 : 1));
    cLen.push(0.86 + 0.26 * Math.sin(sat((phi - 1.5) / 2.5) * PI) - (i % 2 ? 0.07 + 0.11 * rnd(i) : 0.05 * rnd(i)) - (i === 5 || i === 12 ? 0.08 : 0)); }
  const cNV = CN * (CR + 1), cPos = new Float32Array(cNV * 3), cCol = new Float32Array(cNV * 3), cGeo = new THREE.BufferGeometry(), cIdx = [];
  for (let i = 0; i < CN; i++) for (let j = 0; j <= CR; j++) { const o = (i * (CR + 1) + j) * 3, hem = j >= CR ? 1 : 0, sh = 1 + 0.32 * cFold[i] * Math.min(1, 0.25 + j / CR);
    cCol[o] = sh * (1 + hem * 0.9); cCol[o + 1] = sh * (1 + hem * 1.2); cCol[o + 2] = sh * (1 + hem * 0.6); }
  for (let i = 0; i < CN - 1; i++) for (let j = 0; j < CR; j++) { const a = i * (CR + 1) + j, b = a + 1, c = a + CR + 1, d = c + 1; cIdx.push(a, b, c, c, b, d); }
  cGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3)); cGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3)); cGeo.setIndex(cIdx);
  const capeMesh = new THREE.Mesh(cGeo, capeM); capeMesh.frustumCulled = false; capeMesh.castShadow = true; torso.add(capeMesh);
  const cDir = []; for (let i = 0; i < cNV; i++) cDir.push(new V3(0, -1, 0));
  const capeF = K.spring(55, 8), capeLag = K.spring(60, 6);

  // ---- the blade: built along +y in a frame turned so it points along +z of the hand; broad, with a big crossguard ----
  const weapon = grp(armR.hand, 0, -0.07, 0.008), wy = grp(weapon); weapon.scale.setScalar(1 / HS); wy.rotation.x = PI / 2; const wtip = new THREE.Object3D();
  const BL0 = 0.17, BL1 = 1.36, cx = (y) => -0.032 * Math.pow((y - BL0) / (BL1 - BL0), 2), bw = (y) => lerp(0.082, 0.062, (y - BL0) / (BL1 - BL0));
  const spineX = (y) => cx(y) - bw(y) * 0.85, edgeX = (y) => { const e = cx(y) + bw(y), u = sat((y - 1.0) / (BL1 - 1.0)); return lerp(e, spineX(BL1), Math.pow(u, 1.4)); };
  { const sh = new THREE.Shape(); sh.moveTo(spineX(BL0), BL0); for (let k = 1; k <= 24; k++) { const y = lerp(BL0, BL1, k / 24); sh.lineTo(spineX(y), y); } for (let k = 24; k >= 0; k--) { const y = lerp(BL0, BL1, k / 24); sh.lineTo(edgeX(y), y); }
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.036, bevelEnabled: false }); bg.translate(0, 0, -0.018); P.add(wy, bladeM, bg); }
  { const sh = new THREE.Shape(); const y0 = 0.22; sh.moveTo(edgeX(y0) - 0.03, y0); for (let k = 1; k <= 24; k++) { const y = lerp(y0, BL1 - 0.004, k / 24); sh.lineTo(edgeX(y) - 0.03 * (1 - 0.7 * sat((y - 1.0) / 0.36)), y); } for (let k = 24; k >= 0; k--) { const y = lerp(y0, BL1 - 0.004, k / 24); sh.lineTo(edgeX(y) + 0.002, y); }
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }); eg.translate(0, 0, -0.02); P.add(wy, edgeM, eg); }
  { const sh = new THREE.Shape(), y0 = 0.22, y1 = 1.02, fx = (y) => cx(y) - bw(y) * 0.3; sh.moveTo(fx(y0) - 0.012, y0); for (let k = 1; k <= 16; k++) { const y = lerp(y0, y1, k / 16); sh.lineTo(fx(y) - 0.012 * (1 - sat((y - 0.9) / 0.12)), y); } for (let k = 16; k >= 0; k--) { const y = lerp(y0, y1, k / 16); sh.lineTo(fx(y) + 0.012 * (1 - sat((y - 0.9) / 0.12)), y); }
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.038, bevelEnabled: false }); fg.translate(0, 0, -0.019); P.add(wy, voidM, fg); } // dark fuller the runes sit in
  P.add(wy, trimM, new THREE.BoxGeometry(0.12, 0.05, 0.04), 0, 0.145, 0);
  for (const s of [1, -1]) P.add(wy, trimM, horn([[0, 0.145, 0], [s * 0.1, 0.15, 0], [s * 0.18, 0.19, 0], [s * 0.21, 0.26, 0]], 0.024, 0.006, 10, 5));
  for (const s of [1, -1]) P.add(wy, sigilM, new THREE.OctahedronGeometry(0.02), 0, 0.145, s * 0.021, 0, 0, 0, 1, 1.2, 0.5);
  { const pts = []; for (let k = 0; k <= 14; k++) { const y = -0.15 + k / 14 * 0.27; pts.push([0.0185 + 0.0025 * Math.abs(Math.sin(y * 85)), y]); } P.add(wy, leatherM, K.lathe(pts, 8)); }
  P.add(wy, trimM, K.lathe([[0.004, -0.235], [0.024, -0.225], [0.03, -0.2], [0.022, -0.175], [0.018, -0.155]], 10));
  P.add(wy, sigilM, new THREE.OctahedronGeometry(0.016), 0, -0.238, 0);
  const runes = []; for (let i = 0; i < 5; i++) { const y = 0.3 + i * 0.16, m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), runeOff); m.position.set(cx(y) - bw(y) * 0.3, y, 0); m.scale.set(0.016, 0.032, 0.0165); wy.add(m); runes.push(m); }
  wtip.position.set(spineX(BL1), BL1, 0); wy.add(wtip);
  // ---- parrying dagger, reverse grip: the blade lies along the outside of the left forearm ----
  const dag = grp(armL.hand, 0.045, -0.07, 0.0); dag.rotation.set(0.1, 0, -0.14);
  P.add(dag, leatherM, K.lathe([[0.015, -0.05], [0.017, 0.0], [0.015, 0.045]], 8));
  P.add(dag, darkM, K.lathe([[0.004, -0.075], [0.02, -0.065], [0.016, -0.05]], 8));
  P.add(dag, darkM, new THREE.BoxGeometry(0.03, 0.016, 0.085), 0, 0.055, 0);
  { const sh = new THREE.Shape([new THREE.Vector2(0.0, 0.07), new THREE.Vector2(0.0035, 0.07), new THREE.Vector2(0.0, 0.39)]);
    const dsh = new THREE.Shape([new THREE.Vector2(0, 0.065), new THREE.Vector2(0.0, 0.4), new THREE.Vector2(-0.018, 0.065)]);
    const db = new THREE.ExtrudeGeometry(dsh, { depth: 0.01, bevelEnabled: false }); db.translate(0, 0, -0.005); db.rotateY(PI / 2); P.add(dag, bladeM, db);
    const de = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }); de.translate(0, 0, -0.006); de.rotateY(PI / 2); P.add(dag, dagM, de); }

  // ---- Bladestorm: spectral blades orbit the hero ----
  const ghostM = new THREE.MeshBasicMaterial({ color: hotC.clone().multiplyScalar(1.6), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const ghostG = new THREE.OctahedronGeometry(1, 0); ghostG.scale(0.035, 0.012, 0.3);
  const ghosts = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(ghostG, ghostM); m.visible = false; m.rotation.order = 'YXZ'; g.add(m); ghosts.push(m); }
  // ---- swing trail: a curved ribbon through the blade's recent sweep, in world space. Samples store the blade root and its
  // direction; columns between samples swing the direction (not the tip position), so the ribbon follows the arc, not its chord ----
  const TS = 14, TSUB = 4, TCOL = (TS - 1) * TSUB + 1, TRL = 0.13;
  const trPos = new Float32Array(TCOL * 6), trCol = new Float32Array(TCOL * 6), trGeo = new THREE.BufferGeometry(), trIdx = [];
  for (let i = 0; i < TCOL - 1; i++) { const a = i * 2; trIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3)); trGeo.setIndex(trIdx);
  const trail = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  trail.frustumCulled = false; trail.matrixAutoUpdate = false; trail.visible = false; trail.renderOrder = 12; g.add(trail);
  const sR = [], sD = [], sT = new Float32Array(TS), sA = new Float32Array(TS), sL = new Float32Array(TS); for (let i = 0; i < TS; i++) { sR.push(new V3()); sD.push(new V3(0, 1, 0)); }
  P.finish();
  const aura = new THREE.PointLight(C.glow, 1.0, 7, 1.5); aura.position.set(0, 2.1, 0.9); g.add(aura);

  // ---- poses ----
  // hy/hd/hz hips yaw, drop, forward; bx body pitch; tx/ty/tz torso; hx/hw head; tl/tr/zl/zr/kl/kr legs; r*/l* arms (shoulder x,y,z,
  // elbow); be/by/bz blade elevation, yaw and roll in body space (by 0 points ahead, negative to the right). ty > 0 brings the
  // sword (right) shoulder forward; tl/tr < 0 swing a leg forward; rz > 0 brings the sword arm across the body, lz > 0 lifts the
  // off arm out to the side. hd is a design offset: the hips are then dropped or lifted so the lower sole sits on the floor.
  const PK = ['hy', 'hd', 'hz', 'bx', 'tx', 'ty', 'tz', 'hx', 'hw', 'tl', 'tr', 'zl', 'zr', 'kl', 'kr', 'rx', 'ry', 'rz', 're', 'lx', 'ly', 'lz', 'le', 'be', 'by', 'bz'];
  const B = {}, S = {}; for (const k of PK) { B[k] = 0; S[k] = 0; }
  const mix = (dst, src, w) => { if (w > 0.001) for (const k in src) dst[k] = lerp(dst[k], src[k], w); };
  // Riposte guard: crouched, blade held flat across the chest, the off hand braced under it
  const GUARD = { hy: 0.1, ty: 0.12, tx: 0.12, bx: 0.04, tl: -0.4, kl: 0.75, tr: 0.42, kr: 0.72, zl: 0.15, zr: -0.15, rx: -1.0, ry: 0, rz: 0.4, re: -0.8, lx: -1.0, lz: -0.3, le: -0.95, be: 0.3, by: 1.1, bz: 1.57 };
  const DASH = { bx: 0.5, hd: -0.14, ty: -0.3, tx: 0.12, hx: -0.3, tl: -0.95, kl: 0.85, tr: 0.75, kr: 0.5, rx: 0.7, rz: -0.5, re: -0.2, lx: -1.3, lz: 0.15, le: -0.4, be: -0.35, by: -2.85, bz: 0.4 };
  const AIR = { tl: -0.75, tr: -0.1, kl: 1.15, kr: 0.55, lz: 0.5, lx: -0.3, rz: -0.6, be: 0.1 };
  // Bladestorm: the burst spin on cast (two turns, low on bent knees, torso tipped into the turn, blade straight out to the
  // side) and the low, wide stance held while it lasts
  const SPIN = { hd: 0, tx: 0.26, ty: 0.15, tz: 0.16, hy: 0, bx: 0.08, tl: -0.62, kl: 1.05, tr: 0.5, kr: 1.0, zl: 0.26, zr: -0.26, rx: -1.45, rz: -1.2, re: -0.05, be: -0.06, by: -1.5, bz: 0, lx: -0.7, lz: 0.85, le: -0.9 };
  const STORM = { tl: -0.5, kl: 0.85, tr: 0.45, kr: 0.82, zl: 0.24, zr: -0.24, tx: 0.18, ty: -0.2, rx: -0.85, rz: -0.75, re: -0.45, be: -0.05, by: -1.85, bz: 0.4, lx: -0.75, lz: 0.45, le: -1.2 };
  const fol = (o, d) => Object.assign({}, o, d);
  // each swing: [time 0..1, pose, ease, recover]. Wind-up held to ~12%; a fast strike that is still moving at contact (~27%);
  // the follow-through keeps travelling and decelerates to ~50% (blade a further 30-35 degrees, torso and head turning
  // through, the hips sinking); then from there a recovery 60% of the way back to the stance by ~82%, and the blend out from SWO (~78%).
  // ease: 0 smooth, 1 snap (ease-out cubic), 2 strike (fast, arrives with speed), 3 decelerate (ease-out quad)
  const SW = {}, SWO = {}, cut = (w, s, f, tw = 0.12, ts = 0.27, tf = 0.5, tr = 0.82, rf = 0.6) => [[0, w], [tw, w], [ts, s, 2], [tf, fol(s, f), 3], [tr, {}, 0, rf]];
  // Slash 1: forehand diagonal, high right to low left, stepping in on the left foot
  SW[0] = cut({ hy: -0.25, ty: -0.6, tx: -0.02, tl: -0.25, kl: 0.35, tr: 0.28, kr: 0.4, rx: -2.5, rz: -0.55, re: -1.1, be: 0.9, by: -2.4, bz: -0.4, lx: -0.95, lz: 0.25, le: -0.9 },
    { hy: 0.2, ty: 0.45, tx: 0.18, bx: 0.08, hz: 0.06, tl: -0.7, kl: 0.72, tr: 0.45, kr: 0.28, rx: -1.25, rz: 0.6, re: -0.15, be: -0.35, by: 0.6, bz: -0.9, lx: 0.45, lz: 0.4, le: -0.5 },
    { hy: 0.5, ty: 1.0, tx: 0.28, tz: -0.1, hw: 0.4, bx: 0.12, hz: 0.1, tl: -0.8, kl: 1.0, kr: 0.45, rx: -0.65, rz: 1.05, re: -0.35, be: -0.8, by: 1.2, bz: -1.05, lx: 0.85, lz: 0.6, le: -0.65 });
  // Slash 2: backhand, low left to high right, stepping out on the right foot
  SW[1] = cut({ hy: 0.25, ty: 0.7, tx: 0.06, tl: -0.4, kl: 0.45, tr: 0.3, kr: 0.45, rx: -0.6, rz: 0.85, re: -0.95, be: -0.4, by: 2.0, bz: 0.6, lx: -0.3, lz: 0.2, le: -1.45 },
    { hy: -0.2, ty: -0.5, tx: 0.12, bx: 0.06, tl: 0.35, kl: 0.3, tr: -0.6, kr: 0.6, zr: -0.2, rx: -1.6, rz: -0.9, re: -0.15, be: 0.3, by: -1.0, bz: 0.9, lx: 0.4, lz: 0.5, le: -0.5 },
    { hy: -0.5, ty: -1.05, tx: 0.06, tz: 0.12, hw: -0.4, tr: -0.72, kr: 0.85, kl: 0.42, rx: -2.15, rz: -1.05, re: -0.3, be: 0.85, by: -1.55, bz: 1.05, lx: 0.75, lz: 0.75 });
  // Slash 3: overhead finisher, a deep lunge on the right foot, the off arm flung back
  SW[2] = cut({ hy: -0.15, ty: -0.35, tx: -0.22, bx: -0.04, tl: -0.15, kl: 0.25, tr: 0.25, kr: 0.3, rx: -3.0, rz: -0.3, re: -0.9, be: 1.9, by: -0.3, bz: 1.57, lx: -1.2, lz: 0.3, le: -0.6 },
    { hy: 0.15, ty: 0.3, tx: 0.35, bx: 0.18, hz: 0.12, tl: 0.65, kl: 0.15, tr: -0.95, kr: 0.95, rx: -1.35, rz: 0.15, re: -0.05, be: -0.25, by: 0.0, bz: 1.57, lx: 0.85, lz: 0.55, le: -0.2 },
    { ty: 0.48, tx: 0.55, bx: 0.26, hz: 0.18, hw: 0.15, hx: 0.12, tr: -1.05, kr: 1.15, rx: -0.85, re: -0.2, be: -0.85, lx: 1.05, lz: 0.65 }, 0.13, 0.29, 0.52);
  // Sunder: a two-handed overhead slam into the floor from a deep crouch, an impact squash (knees give, the blade bounces),
  // a rebound, a settle, then the recovery
  { const w = { tx: -0.22, bx: -0.05, ty: -0.15, tl: -0.2, kl: 0.15, tr: 0.2, kr: 0.2, rx: -2.9, rz: -0.1, re: -1.0, lx: -2.85, lz: -0.35, le: -1.05, be: 2.1, by: 0, bz: 1.57 },
      s = { tx: 0.5, bx: 0.15, ty: 0.05, hz: 0.05, tl: -0.85, kl: 1.3, tr: 0.55, kr: 1.0, zl: 0.15, zr: -0.15, rx: -1.0, rz: 0.15, re: -0.25, lx: -1.0, lz: -0.4, le: -0.25, be: -0.9, by: 0, bz: 1.57 };
    SW[3] = [[0, w], [0.16, w], [0.36, s, 2], [0.43, fol(s, { tx: 0.64, bx: 0.2, hx: 0.14, tl: -0.98, kl: 1.62, tr: 0.66, kr: 1.28, re: -0.4, le: -0.4, be: -1.22 }), 3],
      [0.54, fol(s, { tx: 0.46, kl: 1.12, kr: 0.86, tl: -0.8, tr: 0.5, re: -0.15, be: -0.78 })], [0.64, fol(s, { tx: 0.54, kl: 1.3, kr: 1.0, be: -0.95 })], [0.94, {}, 0, 0.45]]; SWO[3] = 0.76; }
  SW[4] = [[0, {}], [0.3, { tx: -0.08, rx: -0.9, re: -0.85 }, 1], [1, {}]];
  // Sever: a wide two-handed horizontal cleave from the right hip, the off hand letting go on a long follow-through
  SW[5] = cut({ hy: -0.35, ty: -0.95, tx: 0.08, tl: -0.35, kl: 0.55, tr: 0.3, kr: 0.55, zl: 0.15, zr: -0.15, rx: -0.7, rz: -0.3, re: -1.2, lx: -0.9, lz: -0.65, le: -1.3, be: 0.15, by: -2.6, bz: 0 },
    { hy: 0.2, ty: 0.4, tx: 0.2, bx: 0.08, hz: 0.06, tl: -0.75, kl: 0.8, tr: 0.45, kr: 0.3, rx: -1.45, rz: 0.55, re: -0.05, lx: -1.35, lz: -0.25, le: -0.25, be: 0.05, by: 0.5, bz: 0 },
    { hy: 0.6, ty: 1.2, tx: 0.26, tz: -0.08, hw: 0.45, kl: 1.0, rx: -1.2, rz: 1.0, lx: 0.35, lz: 0.65, le: -0.6, be: 0.12, by: 1.55 }, 0.16, 0.34, 0.56, 0.86); SWO[5] = 0.82;
  // Lunge strike: the arrival thrust out of the dash
  SW[6] = cut({ ty: -0.45, rx: -0.95, rz: -0.35, re: -1.65, be: 0.05, by: -0.05, bz: 1.57, lx: -0.6, le: -0.9 },
    { ty: 0.35, tx: 0.16, bx: 0.22, hz: 0.1, tl: -0.8, kl: 0.8, tr: 0.55, kr: 0.3, rx: -1.85, rz: -0.38, re: -0.02, be: 0.04, by: 0.02, bz: 1.57, lx: 0.75, lz: 0.4, le: -0.2 },
    { tx: 0.3, bx: 0.3, hz: 0.18, ty: 0.5, hw: 0.2, kl: 1.0, tl: -0.95, rx: -1.95, rz: -0.48, be: -0.2, lx: 0.95 }, 0.12, 0.28, 0.5);
  // Riposte counter: out of the crouched guard, an explosive full-extension thrust on a long step with the right foot, held:
  // sword arm straight at shoulder height, blade level along the facing, rear leg straight, off arm thrown back
  { const w = { hy: -0.2, ty: -0.55, tx: 0.05, tl: -0.25, kl: 0.45, tr: 0.35, kr: 0.6, rx: -0.75, rz: -0.15, re: -1.75, be: 0.05, by: 0.05, bz: 0, lx: -1.1, lz: 0.1, le: -0.6 },
      s = { hy: 0.25, ty: 0.5, tx: 0.24, bx: 0.18, hz: 0.2, hw: 0.25, tl: 0.72, kl: 0.05, tr: -1.05, kr: 1.0, rx: -1.92, ry: 0, rz: -0.7, re: 0, be: 0, by: 0, bz: 0, lx: 1.1, lz: 0.55, le: -0.08 };
    const f = fol(s, { ty: 0.6, hy: 0.3, tx: 0.28, bx: 0.22, hz: 0.28, kr: 1.14, rx: -1.96, rz: -0.78 });
    SW[7] = [[0, w], [0.05, w], [0.19, s, 1], [0.42, f, 3], [0.92, f]]; SWO[7] = 0.84; }
  function keyed(keys, k, base, out) {
    let i = 0; while (i < keys.length - 1 && k > keys[i + 1][0]) i++;
    const j = Math.min(i + 1, keys.length - 1), a = keys[i], b = keys[j], u = b === a ? 1 : sat((k - a[0]) / (b[0] - a[0])), m = b[2] || 0;
    const e = m === 1 ? 1 - Math.pow(1 - u, 3) : m === 2 ? u * (1.5 - 0.5 * u) : m === 3 ? 1 - (1 - u) * (1 - u) : smooth(u);
    // a key with a recover fraction sits that far from the previous key toward the live stance
    const val = (n, q) => { const kk = keys[n]; if (kk[3] && n > 0) return lerp(val(n - 1, q), base[q], kk[3]); return kk[1][q] !== undefined ? kk[1][q] : base[q]; };
    for (const q of PK) out[q] = lerp(val(i, q), val(j, q), e);
  }

  const A = { run: 0, swing: 0, swingDur: 0.28, swingKind: 0, cast: 0, guard: 0, dash: 0, storm: 0, lean: 0, aim: 0, load: 0, air: 0, full: 0, vx: 0, vz: 0, lx: null, lz: null,
    spin: 0, spinDur: 1.15, spinW: 0, ringW: 0, stormOn: false, yaw: null, trT: 0, trOn: -9, trFresh: true };
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _m = new THREE.Matrix4();
  const _gv = new V3(), _wv = new V3(), _p = new V3(), _dv = new V3();
  const trHot = hotC.clone().lerp(new THREE.Color(1, 1, 1), 0.15).multiplyScalar(0.85), trCool = glowC.clone().multiplyScalar(0.55), _tc = new THREE.Color();
  const soleY = (a, k, z) => { const dy = -0.02 - (0.45 * Math.cos(a) + 0.42 * Math.cos(a + k)) * Math.cos(z) - 0.09, dz = -(0.45 * Math.sin(a) + 0.42 * Math.sin(a + k)) * Math.cos(B.hy);
    return (0.95 + B.hd + dy) * Math.cos(B.bx) - (B.hz + dz) * Math.sin(B.bx); };

  function update(dt, p) {
    dt = Math.min(dt, 0.1); const t = G.now;
    const spd = p.moveSpeed || 0, grounded = p.grounded !== false, moving = spd > 0.5 && grounded;
    const wp = g.position, f = g.rotation.y;
    if (A.lx !== null && dt > 0) { const dx = wp.x - A.lx, dz = wp.z - A.lz;
      if (dx * dx + dz * dz < 4) { A.vx = damp(A.vx, (dx * Math.cos(f) - dz * Math.sin(f)) / dt, 12, dt); A.vz = damp(A.vz, (dx * Math.sin(f) + dz * Math.cos(f)) / dt, 12, dt); } }
    A.lx = wp.x; A.lz = wp.z;
    A.lean = damp(A.lean, moving ? Math.min(1, spd / 7) : 0, 9, dt);
    A.run += dt * spd * 1.55; const ph = A.run, s = Math.sin(ph), c = Math.cos(ph), L = A.lean, br = Math.sin(t * 1.7), sway = Math.sin(t * 0.6);
    const storm = !!(p.hasBuff && p.hasBuff('storm'));
    if (storm && !A.stormOn) A.spin = A.spinDur; A.stormOn = storm;
    A.guard = damp(A.guard, p.parryT > 0 ? 1 : 0, 22, dt); A.dash = damp(A.dash, p.dash ? 1 : 0, p.dash ? 30 : 9, dt);
    A.air = damp(A.air, grounded ? 0 : 1, 12, dt); A.storm = damp(A.storm, storm ? 1 : 0, 5, dt);
    const res = p.res | 0, rmax = p.resMax || 5; A.full = damp(A.full, res >= rmax && res > 0 ? 1 : 0, 8, dt);

    // ---- base: a staggered duelist's stance (sword side back, knees soft, blade low behind), blended into the run ----
    const kc = Math.cos(ph - 0.45);
    B.hy = lerp(-0.14 + sway * 0.03, s * 0.16, L); B.hd = lerp(-0.035, Math.abs(c) * 0.05 - 0.035, L); B.hz = 0;
    B.bx = lerp(0.03, 0.075, L); B.tx = lerp(0.06 + br * 0.012, 0.05, L); B.ty = lerp(-0.28 + Math.sin(t * 0.5) * 0.03, -s * 0.22, L); B.tz = lerp(sway * 0.02, 0, L);
    B.hx = lerp(0.05, -0.04 + c * 0.03, L); B.hw = lerp(Math.sin(t * 0.37) * 0.08, s * 0.08, L);
    B.tl = lerp(-0.28, -s * 0.72, L); B.tr = lerp(0.22, s * 0.72, L); B.zl = lerp(0.16 + sway * 0.025, 0.04, L); B.zr = lerp(-0.14 + sway * 0.025, -0.04, L);
    B.kl = lerp(0.3, 0.12 + Math.pow(Math.max(0, kc), 1.5), L); B.kr = lerp(0.32, 0.12 + Math.pow(Math.max(0, -kc), 1.5), L);
    B.rx = lerp(-0.22 + br * 0.02, 0.2 - s * 0.35, L); B.ry = 0; B.rz = lerp(-0.2, -0.2, L); B.re = lerp(-0.7, -0.35, L);
    B.lx = lerp(-0.4 + br * 0.02, s * 0.62, L); B.ly = 0; B.lz = lerp(0.16, 0.03, L); B.le = lerp(-1.3, -0.8, L);
    B.be = lerp(-0.55 + br * 0.015, -0.52 + c * 0.05, L); B.by = lerp(-2.35, -2.65, L); B.bz = lerp(0.2, 0.3, L);
    mix(B, STORM, A.storm * (1 - L) * 0.75);
    mix(B, GUARD, A.guard); mix(B, DASH, A.dash); mix(B, AIR, A.air * (1 - A.dash));
    // ---- one-shot moves ----
    let sw = 0;
    if (A.swing > 0) {
      A.swing -= dt; const k = 1 - Math.max(0, A.swing) / A.swingDur, keys = SW[A.swingKind] || SW[4];
      const so = SWO[A.swingKind] || 0.78; sw = smooth(k / 0.12) * (1 - smooth((k - so) / (1 - so))); keyed(keys, k, B, S); mix(B, S, sw);
    }
    // Bladestorm burst: two full turns of the body with the blade straight out (the trail keeps a full ring meanwhile)
    let spinYaw = 0; A.spinW = 0;
    if (A.spin > 0) { A.spin -= dt; const k = 1 - Math.max(0, A.spin) / A.spinDur; A.spinW = smooth(k / 0.12) * (1 - smooth((k - 0.82) / 0.18)); spinYaw = 2 * TAU * smooth(sat((k - 0.04) / 0.88)); mix(B, SPIN, A.spinW); }
    const fall = p.pose === 'fall';
    if (fall) { B.tl = 0.25 + Math.sin(t * 5) * 0.05; B.tr = 0.25 - Math.sin(t * 5) * 0.05; B.kl = B.kr = 0.7; if (sw < 0.05) { B.lx = B.rx = -2.3; B.lz = 0.75; B.rz = -0.75; B.le = B.re = -0.5; B.be = 0.3; B.by = -0.6; } }
    if (p.flashT > 0) { const q = p.flashT / 0.15; B.tx -= 0.14 * q; B.hx -= 0.1 * q; }
    // feet on the floor: move the hips so the lower sole touches (fades out in the air, in a dash and partly at a run)
    if (!fall) { const lo = Math.min(soleY(B.tl, B.kl, B.zl), soleY(B.tr, B.kr, B.zr)), gw = (1 - A.air) * (1 - A.dash) * (1 - 0.7 * L); B.hd -= gw * lo / Math.cos(B.bx); }
    // ---- apply ----
    hips.position.set(Math.sin(t * 0.6) * 0.02 * (1 - L), 0.95 + B.hd, B.hz); hips.rotation.set(0, B.hy, 0);
    if (fall) { body.rotation.set(1.28 + Math.sin(t * 2.3) * 0.05 + L * 0.12, 0, Math.sin(t * 1.7) * 0.05); body.position.set(0, 0.75, -0.95); }
    else { body.rotation.set(B.bx, spinYaw, 0); body.position.set(0, 0, 0); }
    torso.rotation.set(B.tx, B.ty, B.tz); head.rotation.set(B.hx, B.hw - (B.ty + B.hy) * 0.65, 0);
    const brth = 0.007 * br * (1 - L); armL.sh.position.y = 0.55 + brth; armR.sh.position.y = 0.55 + brth; head.position.y = 0.69 + brth * 0.5;
    legL.hip.rotation.set(B.tl, 0, B.zl); legR.hip.rotation.set(B.tr, 0, B.zr); legL.knee.rotation.x = B.kl; legR.knee.rotation.x = B.kr;
    const tilt = body.rotation.x;
    legL.ankle.rotation.x = clamp(-(B.tl + B.kl + tilt) * 0.85 + (L > 0.2 ? Math.max(0, -s) * 0.35 * L : 0), -0.9, 0.9); legR.ankle.rotation.x = clamp(-(B.tr + B.kr + tilt) * 0.85 + (L > 0.2 ? Math.max(0, s) * 0.35 * L : 0), -0.9, 0.9);
    armL.sh.rotation.set(B.lx, B.ly, B.lz); armR.sh.rotation.set(B.rx, B.ry, B.rz); armL.el.rotation.x = B.le; armR.el.rotation.x = B.re;
    // the blade is aimed in body space: undo the chain from the body to the hand
    _q.copy(hips.quaternion).multiply(torso.quaternion).multiply(armR.sh.quaternion).multiply(armR.el.quaternion).invert();
    _e.set(-B.be, B.by, B.bz); weapon.quaternion.copy(_q).multiply(_q2.setFromEuler(_e));
    // ---- cloth ----
    const wind = (phi) => -(Math.sin(phi) * A.vx + Math.cos(phi) * A.vz) * 0.055;
    const flut = (k, ph2) => Math.sin(t * 8 - k * 1.2 + ph2) * (0.05 * L + 0.07 * A.dash + 0.03 * A.storm);
    tabard.rotation.x = -clamp(tabSpr.step(Math.max(0, -Math.min(B.tl, B.tr)) * 1.05 + wind(0) * 0.6 + flut(0, 1) + A.air * 0.3, dt), -0.05, 1.3);
    for (const ch of tails) for (let k = 0; k < ch.length; k++) { const q = ch[k], tgt = clamp(A.vz * 0.085 - 0.05, -0.15, 1.25) * (k ? 0.35 : 1) + Math.max(0, Math.max(B.tl, B.tr)) * (k ? 0 : 0.7) + Math.sin(t * 7 - k * 1.3) * (0.06 * L + 0.02) + A.air * 0.3 + A.spinW * (k ? 0.3 : 0.9);
      q.o.rotation.x = q.spr.step(tgt + (k === 0 ? -tilt : 0), dt); q.o.rotation.z = q.sprZ.step(-A.vx * 0.05 * (k ? 0.4 : 1), dt); }
    for (const q of tassets) { const lx = q.s > 0 ? B.tl : B.tr; q.o.rotation.x = q.spr.step(Math.min(0.15, lx) * 0.85, dt); }
    for (let k = 0; k < plume.length; k++) { const q = plume[k], tgt = (k ? 0.12 : 0.55) + clamp(A.vz * 0.07, -0.2, 1.0) * (k ? 0.3 : 1) + Math.sin(t * 6.5 - k * 1.1) * (0.07 * L + 0.02) + A.dash * (k ? 0.08 : 0.3);
      q.o.rotation.x = clamp(q.spr.step(tgt - (k ? 0 : tilt + B.tx + B.hx), dt), k ? -0.25 : -0.5, k ? 0.4 : 1.3); q.o.rotation.z = clamp(q.sprZ.step(-A.vx * 0.06 * (k ? 0.5 : 1), dt), -0.3, 0.3); }
    // half-cape: each column hangs along gravity (in torso space), pushed out by a flare spring, swung sideways by a spring on
    // the torso's yaw rate (so it lags a turn or a slash and overshoots), blown by the hero's own motion; kept off the body
    const yaw = f + spinYaw + B.hy + B.ty; let yr = 0; if (A.yaw !== null && dt > 0) { let dy = yaw - A.yaw; dy -= Math.round(dy / TAU) * TAU; yr = dy / dt; } A.yaw = yaw;
    const lag = capeLag.step(clamp(-yr * 0.13, -1.1, 1.1), dt);
    const crouch = sat((B.tx + B.bx - 0.35) / 0.35) * (1 - A.spinW) * (1 - A.dash) * (1 - A.air);
    const F = capeF.step((Math.max(0, Math.max(B.tl, B.tr)) * 0.3 + sw * 0.12) * (1 - 0.75 * crouch) + A.air * 0.5 + A.dash * 1.6 + A.spinW * 2.8 + A.storm * 0.08 + L * 0.15, dt);
    _q.copy(body.quaternion).multiply(hips.quaternion).multiply(torso.quaternion).invert();
    _gv.set(0, -1, 0).applyQuaternion(_q); _wv.set(-A.vx, 0, -A.vz).applyQuaternion(_q);
    const fa = 0.04 + 0.1 * L + 0.2 * A.dash + 0.08 * A.storm + 0.15 * A.spinW;
    for (let i = 0; i < CN; i++) { const out = cOut[i], tan = cTan[i], fo0 = cFold[i]; _p.copy(cTop[i]); let o = i * (CR + 1) * 3; cPos[o] = _p.x; cPos[o + 1] = _p.y; cPos[o + 2] = _p.z;
      for (let j = 0; j < CR; j++) { const u = (CFR[j] + CFR[j + 1]) / 2, sl = (CFR[j + 1] - CFR[j]) * cLen[i];
        const fl = 0.04 + 0.12 * (1 - u) + F * (0.3 + 0.7 * u) + Math.sin(t * 8.5 - j * 0.9 + i * 0.55) * fa * u;
        _dv.copy(_gv).addScaledVector(out, fl); _dv.z += crouch * 0.7 * (1 - 0.5 * u); _dv.addScaledVector(tan, lag * (0.25 + 0.9 * u)).addScaledVector(_wv, 0.04 + 0.06 * u);
        const dOut = _dv.dot(out), dMin = 0.03 * (1 - crouch); if (dOut < dMin) _dv.addScaledVector(out, dMin - dOut);
        _p.addScaledVector(_dv.normalize(), sl);
        // keep the sheet outside the breastplate, faulds and seat
        if (_p.y > -0.5) { const need = (_p.y > 0.0 ? rAt(_p.y) * 1.04 + 0.025 : 0.255), e = Math.hypot(_p.x, _p.z / 0.86); if (e < need && e > 1e-4) { _p.x *= need / e; _p.z *= need / e; } }
        const fo = cFold[i] * (0.008 + 0.075 * CFR[j + 1]) * (fo0 > 0 ? 1 : 0.55);
        o += 3; cPos[o] = _p.x + out.x * fo; cPos[o + 1] = _p.y; cPos[o + 2] = _p.z + out.z * fo; } }
    cGeo.attributes.position.needsUpdate = true; cGeo.computeVertexNormals();
    // ---- glow: Momentum runes, edge, sigils, trim ----
    for (let i = 0; i < 5; i++) runes[i].material = i < Math.round(res * 5 / rmax) ? runeOn : runeOff;
    const pulse = 0.5 + 0.5 * Math.sin(t * 6), pump = 1 + A.guard * 0.8 + sw * 0.6 + A.storm * 0.5 + A.full * 0.35 * pulse + A.spinW * 0.6;
    edgeM.color.copy(edgeBase).lerp(hotEdge, A.full * 0.8 + A.storm * 0.3).multiplyScalar(pump);
    sigilM.color.copy(sigilBase).multiplyScalar(0.85 + 0.15 * Math.sin(t * 2.3) + A.full * 0.3 * pulse + A.storm * 0.2);
    visorM.color.copy(visorBase).multiplyScalar(1 + A.guard * 0.6 + A.full * 0.4 * pulse + A.storm * 0.4);
    trimM.emissiveIntensity = 0.16 + A.full * (0.18 + 0.12 * pulse) + A.storm * 0.1;
    const counter = A.swingKind === 7 ? sw : 0, abil = Math.max(A.guard, counter, A.storm, A.spinW);
    dagM.color.copy(dagBase).multiplyScalar(0.6 + abil * 5);
    rimU.value.copy(rimBase).multiplyScalar(1 + A.guard * 0.8 + A.storm * 0.3 + counter * 1.2 + A.dash * 0.5);
    aura.intensity = 1.0 + A.guard * 1.5 + A.storm * 1.0 + sw * 0.4 + A.full * 0.4 + counter * 2.5 + (p.flashT > 0 ? 4 : 0);
    // ---- Bladestorm blades ----
    const gv = A.storm > 0.02 && !G.headless;
    for (let i = 0; i < 4; i++) { const m = ghosts[i]; m.visible = gv; if (!gv) continue; const a = t * 4.2 + i * TAU / 4, r = 0.82 + Math.sin(t * 2 + i) * 0.06;
      m.position.set(Math.cos(a) * r, 1.0 + Math.sin(t * 3 + i * 1.7) * 0.18, Math.sin(a) * r); m.rotation.set(0.25 * Math.sin(t * 2 + i), -a, 0.6); m.scale.setScalar(A.storm * (0.9 + 0.1 * Math.sin(t * 9 + i))); }
    ghostM.opacity = 0.6 + 0.25 * Math.sin(t * 7);
    // ---- trail ----
    if (G.headless || !g.visible) { trail.visible = false; return; }
    A.ringW = damp(A.ringW, A.spin > 0 ? 1 : 0, 5, dt); const trl = lerp(TRL, 0.6, A.ringW);
    const act = Math.min(1, sat(sw * 1.4) * (A.swingKind === 4 ? 0 : 1) + A.dash * 0.5 + A.spinW);
    if (act > 0.01) A.trOn = t;
    if (t - A.trOn > trl + 0.03) { trail.visible = false; A.trFresh = true; return; }
    g.updateMatrixWorld(true);
    _a.set(cx(0.4), 0.4, 0); wy.localToWorld(_a); _b.set(cx(BL1 - 0.02), BL1 - 0.02, 0); wy.localToWorld(_b);
    _b.sub(_a); const bl = _b.length() || 1; _b.divideScalar(bl);
    if (A.trFresh) { A.trFresh = false; A.trT = t; for (let i = 0; i < TS; i++) { sR[i].copy(_a); sD[i].copy(_b); sL[i] = bl; sT[i] = t - 1; sA[i] = 0; } }
    // sample 0 is the live blade; a new history sample is kept every ~11 ms
    if (t - A.trT >= lerp(0.011, 0.045, A.ringW)) { A.trT = t; for (let i = TS - 1; i > 1; i--) { sR[i].copy(sR[i - 1]); sD[i].copy(sD[i - 1]); sL[i] = sL[i - 1]; sT[i] = sT[i - 1]; sA[i] = sA[i - 1]; }
      sR[1].copy(_a); sD[1].copy(_b); sL[1] = bl; sT[1] = t; sA[1] = act; }
    sR[0].copy(_a); sD[0].copy(_b); sL[0] = bl; sT[0] = t; sA[0] = act;
    for (let cI = 0; cI < TCOL; cI++) { const sc = cI / TSUB, i0 = Math.min(TS - 2, Math.floor(sc)), fr = sc - i0, i1 = i0 + 1, o = cI * 6;
      _c.copy(sR[i0]).lerp(sR[i1], fr); _d.copy(sD[i0]).lerp(sD[i1], fr).normalize(); const ln = lerp(sL[i0], sL[i1], fr);
      const u = sat((t - lerp(sT[i0], sT[i1], fr)) / trl), ac = lerp(sA[i0], sA[i1], fr) * (1 - u), wf = u >= 1 ? 0 : Math.pow(Math.sin(PI * (0.12 + 0.88 * u)), 0.6) * lerp(0.46, 0.3, A.ringW);
      _p.copy(_c).addScaledVector(_d, ln); _c.copy(_p).addScaledVector(_d, -ln * wf);
      trPos[o] = _c.x; trPos[o + 1] = _c.y; trPos[o + 2] = _c.z; trPos[o + 3] = _p.x; trPos[o + 4] = _p.y; trPos[o + 5] = _p.z;
      const ti = ac * Math.pow(1 - u, 0.6); _tc.copy(trHot).lerp(trCool, Math.min(1, u * 1.6)).multiplyScalar(ti);
      trCol[o] = 0; trCol[o + 1] = 0; trCol[o + 2] = 0; trCol[o + 3] = _tc.r; trCol[o + 4] = _tc.g; trCol[o + 5] = _tc.b; }
    trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
    trail.matrix.copy(_m.copy(g.matrixWorld).invert()); trail.visible = true;
  }
  return { group: g, update, anim: A, wtip, body, swing(kind = 0, dur = 0.28) { A.swing = A.swingDur = dur; A.swingKind = kind; } };
};
