// ============================== DUSKBLADE ==============================
// A dusk knight built on HeroKit (07_hero.js). Close helm with a crescent crest, swept horns, a lit visor and a long plume;
// asymmetric kit: a layered crescent pauldron and a half-cape on the off-hand side, a light sword arm; fluted breastplate with
// a glowing sigil, faulds, hinged tassets, a front tabard and split tails. A long single-edged blade with a glowing edge, five
// Momentum runes and a swing trail, and a parrying dagger held reverse in the off hand. Swings are keyframed poses; the blade
// is aimed in body space, so every pose says where the blade points, not how the wrist bends.
// Kept in its own file so other class models can land in 07_hero.js without touching this one.
HERO_MODELS.duskblade = function buildDuskblade(cls) {
  const C = cls.look, K = HeroKit, P = K.parts(), g = new THREE.Group(), pick = (v, d) => v !== undefined ? v : d;
  const glowC = new THREE.Color(C.glow), clothC = new THREE.Color(C.cloth), hotC = glowC.clone().lerp(new THREE.Color(0xff5a9c), 0.5);
  const rimBase = glowC.clone().lerp(new THREE.Color(1, 1, 1), 0.3).multiplyScalar(0.24), rimU = { value: rimBase.clone() };
  const lining = pick(C.lining, clothC.clone().multiplyScalar(0.5).getHex());
  const plateM = K.mat({ color: C.armor, roughness: 0.34, metalness: 0.62, envMapIntensity: 1.5 }, rimU, 1);
  const shellM = K.mat({ color: C.armor, roughness: 0.34, metalness: 0.62, envMapIntensity: 1.5, side: THREE.DoubleSide }, rimU, 1, new THREE.Color(C.armor).multiplyScalar(0.4).getHex()); // open shells seen from below
  const metalC = pick(C.metal, 0xb9b2cc), trimM = K.mat({ color: metalC, roughness: 0.24, metalness: 0.9, envMapIntensity: 1.7, emissive: metalC, emissiveIntensity: 0.06 }, rimU, 0.9);
  const clothM = K.mat({ color: C.cloth, roughness: 0.82, side: THREE.DoubleSide }, rimU, 0.75, lining);
  const plumeM = K.mat({ color: pick(C.plume, lining), roughness: 0.85, side: THREE.DoubleSide }, rimU, 0.8);
  const innerM = K.mat({ color: pick(C.inner, 0x1b1622), roughness: 0.92 }, rimU, 0.45);
  const leatherM = K.mat({ color: pick(C.leather, 0x2a1d26), roughness: 0.6 }, rimU, 0.5);
  const bladeM = K.mat({ color: 0x2a2836, roughness: 0.14, metalness: 1, envMapIntensity: 2.2 }, rimU, 0.7);
  const voidM = new THREE.MeshBasicMaterial({ color: 0x020104 });
  const edgeM = W.glow(C.glow, 2.4), sigilM = W.glow(C.glow, 2.0), visorM = W.glow(C.glow, 3.0);
  const runeOn = W.glow(hotC, 3.4), runeOff = new THREE.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(0.14) });
  const edgeBase = edgeM.color.clone(), sigilBase = sigilM.color.clone(), visorBase = visorM.color.clone(), hotEdge = hotC.clone().multiplyScalar(3.2);
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  // tube whose radius tapers from r0 to r1 (horns, quillons)
  const horn = (pts, r0, r1, segs = 14, rad = 6) => { const cv = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new V3(x, y, z))), geo = new THREE.TubeGeometry(cv, segs, 1, rad, false), pa = geo.attributes.position, c = new V3();
    for (let i = 0; i <= segs; i++) { cv.getPointAt(i / segs, c); const r = lerp(r0, r1, i / segs); for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; pa.setXYZ(k, c.x + (pa.getX(k) - c.x) * r, c.y + (pa.getY(k) - c.y) * r, c.z + (pa.getZ(k) - c.z) * r); } }
    return geo; };
  // crescent: an arc of a torus with its opening up
  const crescent = (r, tube, arc = PI * 1.25) => { const t = new THREE.TorusGeometry(r, tube, 4, 20, arc); t.rotateZ(-PI / 2 - arc / 2); return t; };

  // ---- skeleton ----
  const body = grp(g), hips = grp(body, 0, 0.95, 0), torso = grp(hips, 0, 0.02, 0), head = grp(torso, 0, 0.69, 0);
  // ---- torso: fluted breastplate with a keel, sigil, gorget ----
  const TP = [[0.165, -0.06], [0.17, 0.06], [0.19, 0.2], [0.218, 0.34], [0.224, 0.44], [0.2, 0.53], [0.15, 0.61], [0.09, 0.67], [0.075, 0.72]], TZ = 0.78;
  const rAt = (y) => { for (let i = 1; i < TP.length; i++) if (y <= TP[i][1]) return lerp(TP[i - 1][0], TP[i][0], (y - TP[i - 1][1]) / (TP[i][1] - TP[i - 1][1])); return TP[TP.length - 1][0]; };
  P.add(torso, plateM, K.lathe(TP, 26), 0, 0, 0, 0, 0, 0, 1, 1, TZ);
  { const keel = []; for (let k = 0; k <= 10; k++) { const y = 0.1 + k * 0.05; keel.push([0, y, rAt(y) * TZ + 0.004]); } P.add(torso, trimM, K.tube(keel, 0.008, 20, 5)); }
  for (const s of [1, -1]) { const fl = []; for (let k = 0; k <= 8; k++) { const y = 0.14 + k * 0.05, a = s * (0.55 + 0.25 * k / 8); fl.push([Math.sin(a) * rAt(y) * 1.004, y, Math.cos(a) * rAt(y) * TZ * 1.004]); } P.add(torso, trimM, K.tube(fl, 0.005, 16, 4)); }
  P.add(torso, trimM, K.lathe([[0.169, 0.03], [0.174, 0.075]], 26), 0, 0, 0, 0, 0, 0, 1.02, 1, TZ * 1.02);
  P.add(torso, sigilM, crescent(0.058, 0.0085), 0, 0.4, rAt(0.4) * TZ + 0.014);
  P.add(torso, sigilM, new THREE.OctahedronGeometry(0.024), 0, 0.41, rAt(0.41) * TZ + 0.016, 0, 0, 0, 0.8, 1.2, 0.4);
  P.add(torso, plateM, K.lathe([[0.13, 0.58], [0.135, 0.64], [0.11, 0.7], [0.086, 0.745]], 20), 0, 0, 0, 0, 0, 0, 1, 1, 0.92);
  P.add(torso, trimM, new THREE.TorusGeometry(0.087, 0.008, 4, 20), 0, 0.745, 0, PI / 2, 0, 0, 1, 0.92, 1);
  // ---- hips: belt, faulds ----
  P.add(hips, leatherM, new THREE.TorusGeometry(0.182, 0.026, 6, 28), 0, 0.0, 0, PI / 2, 0, 0, 1, 0.82, 1);
  P.add(hips, trimM, new THREE.BoxGeometry(0.075, 0.06, 0.022), 0, 0.0, 0.155);
  P.add(hips, sigilM, new THREE.OctahedronGeometry(0.018), 0, 0.0, 0.17, 0, 0, 0, 1, 1.3, 0.5);
  for (let k = 0; k < 3; k++) { const y0 = -0.025 - k * 0.062, r0 = 0.19 + k * 0.013, r1 = 0.205 + k * 0.015;
    P.add(hips, plateM, K.lathe([[r1, y0 - 0.075], [r0, y0]], 14, -1.3, 2.6), 0, 0, 0, 0, 0, 0, 1, 1, 0.86);
    P.add(hips, trimM, K.lathe([[r1 + 0.003, y0 - 0.08], [r1 + 0.001, y0 - 0.068]], 14, -1.3, 2.6), 0, 0, 0, 0, 0, 0, 1, 1, 0.86); }

  // ---- head: close helm, snouted visor, lit eye slits, crescent crest, swept horns ----
  P.add(head, plateM, new THREE.SphereGeometry(0.128, 22, 16), 0, 0.135, -0.008, 0, 0, 0, 1, 1.08, 1.12);
  P.add(head, plateM, new THREE.SphereGeometry(0.138, 22, 12, PI / 2 - 1.05, 2.1, 0.95, 1.3), 0, 0.12, 0.004, 0, 0, 0, 1, 1, 1.2);
  P.add(head, plateM, K.lathe([[0.1, -0.03], [0.128, 0.03], [0.14, 0.08]], 16, -1.25, 2.5), 0, 0.01, 0.0, 0, 0, 0, 1, 1, 1.18);
  { const vz = (y) => { const d = (y - 0.12) / 0.138; return Math.sqrt(Math.max(0, 1 - d * d)) * 0.138 * 1.2 + 0.004 + 0.004; }; const kp = []; for (let k = 0; k <= 8; k++) { const y = 0.215 - k * 0.022; kp.push([0, y, vz(y)]); } P.add(head, trimM, K.tube(kp, 0.0075, 16, 5)); }
  for (const s of [1, -1]) { P.add(head, voidM, new THREE.BoxGeometry(0.064, 0.026, 0.01), s * 0.034, 0.139, 0.161, 0, s * 0.42, s * 0.2); P.add(head, visorM, new THREE.BoxGeometry(0.05, 0.011, 0.012), s * 0.034, 0.139, 0.166, 0, s * 0.42, s * 0.2); }
  for (let k = 0; k < 3; k++) P.add(head, voidM, new THREE.BoxGeometry(0.008, 0.026, 0.02), -0.05 - k * 0.016, 0.07, 0.15 - k * 0.012, 0, -0.5, 0);
  // crest: a crescent fin from brow to nape, with a lit edge
  { const sh = new THREE.Shape(), N = 18, outer = [], th0 = 0.75, th1 = PI + 0.3, hgt = (u) => 0.006 + 0.06 * Math.pow(Math.sin(u * PI * 0.9), 0.9) + (u > 0.75 ? (u - 0.75) * 0.2 : 0);
    for (let k = 0; k <= N; k++) { const u = k / N, th = lerp(th0, th1, u), r = 0.13 + hgt(u); outer.push([Math.cos(th) * r, Math.sin(th) * r]); }
    sh.moveTo(outer[0][0], outer[0][1]); for (const [x, y] of outer) sh.lineTo(x, y); for (let k = N; k >= 0; k--) { const th = lerp(th0, th1, k / N); sh.lineTo(Math.cos(th) * 0.11, Math.sin(th) * 0.11); }
    const cg = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false, curveSegments: 4 }); cg.translate(0, 0, -0.007); P.add(head, plateM, cg, 0, 0.14, -0.015, 0, -PI / 2, 0, 1.12, 1.08, 1);
    P.add(head, sigilM, K.tube(outer.map(([z, y]) => [0, 0.14 + y * 1.08, -0.015 + z * 1.12]), 0.0045, 36, 4)); }
  for (const s of [1, -1]) P.add(head, trimM, horn([[s * 0.11, 0.16, 0.04], [s * 0.165, 0.2, -0.02], [s * 0.19, 0.255, -0.11], [s * 0.18, 0.3, -0.21]], 0.02, 0.003));
  // plume: hangs from the nape of the crest
  const plume = []; { let par = grp(head, 0, 0.255, -0.16);
    for (let k = 0; k < 4; k++) { const seg = grp(par, 0, k ? -0.15 : 0, 0), w = 0.075 - k * 0.013; P.add(seg, plumeM, new THREE.BoxGeometry(w, 0.16, 0.012), 0, -0.075, 0); if (k === 3) P.add(seg, plumeM, new THREE.ConeGeometry(w * 0.5, 0.08, 4), 0, -0.19, 0, PI, PI / 4, 0, 1, 1, 0.2); plume.push({ o: seg, spr: K.spring(60 - k * 9, 6.5), sprZ: K.spring(45, 6) }); par = seg; } }

  // ---- arms: the off hand (left, +x) carries the big crescent pauldron ----
  const mkArm = (side) => {
    const big = side > 0, sh = grp(torso, side * 0.235, 0.55, -0.01), n = big ? 4 : 2, R = big ? 0.128 : 0.104;
    for (let k = 0; k < n; k++) { const r = R - k * 0.007, x = side * (0.02 + k * (big ? 0.03 : 0.035)), y = 0.055 - k * (big ? 0.042 : 0.05), rz = side * -(0.3 + k * (big ? 0.16 : 0.24));
      P.add(sh, shellM, new THREE.SphereGeometry(r, 18, 6, 0, TAU, 0, PI * 0.42), x, y, 0, 0, 0, rz, 1.12, 0.78, 1.12);
      const rim = new THREE.TorusGeometry(r * Math.sin(PI * 0.42), 0.006, 4, 26); rim.rotateX(PI / 2); rim.translate(0, r * Math.cos(PI * 0.42), 0); P.add(sh, trimM, rim, x, y, 0, 0, 0, rz, 1.12, 0.78, 1.12); }
    if (big) { P.add(sh, shellM, K.lathe([[0.122, 0.0], [0.128, 0.06], [0.124, 0.12]], 10, -0.9, 1.8), side * 0.03, 0.08, 0, 0, -side * PI / 2, 0.15 * side);
      P.add(sh, trimM, K.lathe([[0.125, 0.112], [0.126, 0.126]], 10, -0.9, 1.8), side * 0.03, 0.08, 0, 0, -side * PI / 2, 0.15 * side);
      P.add(sh, sigilM, crescent(0.04, 0.0065), side * 0.135, 0.02, 0, 0, side * PI / 2, side * -0.35); }
    P.add(sh, innerM, K.lathe([[0.058, -0.3], [0.064, -0.18], [0.07, -0.05], [0.068, 0.03]], 12));
    P.add(sh, plateM, K.lathe([[0.064, -0.27], [0.07, -0.17], [0.076, -0.07], [0.072, -0.01]], 12, -side * 0.2 + PI / 2 * side - 1.6, 3.2));
    P.add(sh, trimM, new THREE.TorusGeometry(0.066, 0.006, 4, 16), 0, -0.26, 0, PI / 2, 0, 0);
    const el = grp(sh, 0, -0.29, 0);
    P.add(el, plateM, new THREE.SphereGeometry(0.056, 12, 6, 0, TAU, 0, PI * 0.5), 0, 0.0, -0.01, -PI / 2, 0, 0, 1, 1, 0.9);
    P.add(el, plateM, new THREE.SphereGeometry(0.062, 10, 8), side * 0.052, 0.0, -0.01, 0, 0, 0, 0.28, 1, 1);
    P.add(el, plateM, K.lathe([[0.046, -0.24], [0.054, -0.16], [0.06, -0.07], [0.056, 0.0]], 12));
    for (const y of [-0.04, -0.225]) P.add(el, trimM, new THREE.TorusGeometry(y < -0.1 ? 0.049 : 0.058, 0.006, 4, 16), 0, y, 0, PI / 2, 0, 0);
    P.add(el, sigilM, new THREE.BoxGeometry(0.008, 0.12, 0.008), side * 0.058, -0.13, 0);
    const hand = grp(el, 0, -0.275, 0);
    P.add(hand, plateM, K.lathe([[0.068, -0.045], [0.058, -0.0], [0.05, 0.04]], 12));
    P.add(hand, leatherM, new THREE.SphereGeometry(0.046, 10, 8), 0, -0.07, 0.005, 0, 0, 0, 0.85, 1.2, 1.1);
    for (let k = 0; k < 3; k++) P.add(hand, plateM, new THREE.BoxGeometry(0.07, 0.022, 0.05), side * 0.012, -0.055 - k * 0.026, 0.0, 0, 0, side * (0.1 + k * 0.05), 1, 1, 1);
    P.add(hand, plateM, new THREE.CapsuleGeometry(0.016, 0.04, 3, 6), side * -0.035, -0.05, 0.03, 0.5, 0, side * 0.4);
    return { sh, el, hand };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  // ---- legs: cuisses, poleyns with side wings, greaves, pointed sabatons ----
  const mkLeg = (side) => {
    const hip = grp(hips, side * 0.1, -0.02, 0);
    P.add(hip, innerM, K.lathe([[0.058, -0.45], [0.068, -0.3], [0.084, -0.12], [0.09, 0.02]], 12));
    P.add(hip, plateM, K.lathe([[0.066, -0.42], [0.077, -0.3], [0.091, -0.13], [0.095, -0.05]], 12, -1.45 + side * 0.25, 2.9));
    P.add(hip, trimM, K.lathe([[0.067, -0.425], [0.069, -0.405]], 12, -1.45 + side * 0.25, 2.9));
    const knee = grp(hip, 0, -0.45, 0);
    P.add(knee, plateM, new THREE.SphereGeometry(0.064, 12, 8, 0, TAU, 0, PI * 0.5), 0, 0.0, 0.045, PI / 2 - 0.2, 0, 0, 1, 1.25, 0.8);
    P.add(knee, plateM, new THREE.SphereGeometry(0.06, 10, 8), side * 0.06, 0.0, 0.02, 0, 0, 0, 0.25, 1, 1);
    P.add(knee, trimM, new THREE.TorusGeometry(0.052, 0.006, 4, 16), 0, 0.0, 0.07, -0.2, 0, 0, 1, 1.2, 1);
    P.add(knee, plateM, K.lathe([[0.056, -0.4], [0.058, -0.32], [0.07, -0.2], [0.075, -0.1], [0.067, -0.02], [0.062, 0.03]], 12));
    P.add(knee, trimM, new THREE.TorusGeometry(0.058, 0.006, 4, 16), 0, -0.385, 0, PI / 2, 0, 0);
    const ankle = grp(knee, 0, -0.42, 0);
    P.add(ankle, plateM, new THREE.SphereGeometry(0.068, 12, 8), 0, -0.034, 0.048, 0, 0, 0, 0.8, 0.55, 1.6);
    P.add(ankle, plateM, new THREE.ConeGeometry(0.032, 0.09, 6), 0, -0.045, 0.19, PI / 2, 0, 0, 1, 1, 0.55);
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
    P.add(tabard, sigilM, crescent(0.034, 0.006), 0, -0.24, 0.008); P.add(tabard, trimM, new THREE.BoxGeometry(0.18, 0.022, 0.022), 0, -0.006, 0.004); }
  const tails = [];
  for (const [sx, n] of [[0.075, 4], [-0.075, 3]]) { let par = grp(hips, sx, -0.03, -0.17); const chain = [];
    for (let k = 0; k < n; k++) { const seg = grp(par, 0, k ? -0.17 : 0, 0), w = 0.12 - k * 0.012;
      P.add(seg, clothM, new THREE.BoxGeometry(w, 0.175, 0.008), 0, -0.085, 0);
      if (k === n - 1) { const tp = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, -0.09)]); P.add(seg, clothM, new THREE.ExtrudeGeometry(tp, { depth: 0.008, bevelEnabled: false }), 0, -0.17, -0.004); }
      chain.push({ o: seg, spr: K.spring(55 - k * 9, 6), sprZ: K.spring(40, 6) }); par = seg; }
    tails.push(chain); }
  // half-cape off the left shoulder: three columns of hinged, chained strips around the back, a diagonal hem
  const cape = [];
  for (const [phi, span, len] of [[2.16, 0.72, 0.95], [2.76, 0.72, 0.95], [3.36, 0.72, 0.95]]) {
    const n = 3, sl = len / n; let par = torso, R = 0.19; const chain = [];
    for (let k = 0; k < n; k++) {
      const R1 = R + 0.035, o = k ? grp(par, 0, -sl, chain[k - 1].fl) : grp(par, Math.sin(phi) * R, 0.6, Math.cos(phi) * R * 0.92);
      if (!k) { o.rotation.order = 'YXZ'; o.rotation.y = phi; }
      const cg = K.lathe([[R1, -sl], [(R + R1) / 2, -sl / 2], [R, 0]], 6, -span / 2, span), pa = cg.attributes.position;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i), y = pa.getY(i), a = Math.atan2(x, z) / (span / 2), fold = 1 + 0.05 * Math.sin(a * 3.1 + phi * 4 + k) * (0.4 - y);
        // one hem across all three columns: longest down the back-left, a few ragged notches
        const ang = phi + a * span / 2; pa.setX(i, x * fold); pa.setZ(i, z * fold); if (k === n - 1 && y < -sl + 1e-4) pa.setY(i, y - 0.13 * Math.sin(sat((ang - 1.75) / 2.05) * PI) - 0.035 * (0.5 + 0.5 * Math.sin(ang * 23)) + 0.06); }
      cg.computeVertexNormals(); P.add(o, clothM, cg, 0, 0, -R);
      if (k === n - 1) { const hm = K.lathe([[R1 + 0.003, -sl - 0.005], [R1 + 0.003, -sl + 0.018]], 6, -span / 2, span); P.add(o, trimM, hm, 0, 0, -R); }
      chain.push({ o, fl: R1 - R, spr: K.spring(k ? 70 : 55, k ? 8 : 7) }); par = o; R = R1; }
    cape.push({ phi, chain }); }

  // ---- the blade: built along +y in a frame turned so it points along +z of the hand ----
  const weapon = grp(armR.hand, 0, -0.07, 0.008), wy = grp(weapon); wy.rotation.x = PI / 2; const wtip = new THREE.Object3D();
  const BL0 = 0.17, BL1 = 1.38, cx = (y) => -0.05 * Math.pow((y - BL0) / (BL1 - BL0), 2), bw = (y) => lerp(0.05, 0.036, (y - BL0) / (BL1 - BL0));
  const spineX = (y) => cx(y) - bw(y) * 0.85, edgeX = (y) => { const e = cx(y) + bw(y), u = sat((y - 1.2) / (BL1 - 1.2)); return lerp(e, spineX(BL1), Math.pow(u, 1.5)); };
  { const sh = new THREE.Shape(); sh.moveTo(spineX(BL0), BL0); for (let k = 1; k <= 24; k++) { const y = lerp(BL0, BL1, k / 24); sh.lineTo(spineX(y), y); } for (let k = 24; k >= 0; k--) { const y = lerp(BL0, BL1, k / 24); sh.lineTo(edgeX(y), y); }
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false }); bg.translate(0, 0, -0.009); P.add(wy, bladeM, bg); }
  { const sh = new THREE.Shape(); const y0 = 0.24; sh.moveTo(edgeX(y0) - 0.014, y0); for (let k = 1; k <= 24; k++) { const y = lerp(y0, BL1 - 0.004, k / 24); sh.lineTo(edgeX(y) - 0.014 * (1 - 0.7 * sat((y - 1.2) / 0.18)), y); } for (let k = 24; k >= 0; k--) { const y = lerp(y0, BL1 - 0.004, k / 24); sh.lineTo(edgeX(y) + 0.002, y); }
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false }); eg.translate(0, 0, -0.011); P.add(wy, edgeM, eg); }
  { const sh = new THREE.Shape(), y0 = 0.22, y1 = 1.12, fx = (y) => cx(y) - bw(y) * 0.3; sh.moveTo(fx(y0) - 0.006, y0); for (let k = 1; k <= 16; k++) { const y = lerp(y0, y1, k / 16); sh.lineTo(fx(y) - 0.006 * (1 - sat((y - 1.0) / 0.12)), y); } for (let k = 16; k >= 0; k--) { const y = lerp(y0, y1, k / 16); sh.lineTo(fx(y) + 0.006 * (1 - sat((y - 1.0) / 0.12)), y); }
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }); fg.translate(0, 0, -0.01); P.add(wy, voidM, fg); } // dark fuller the runes sit in
  P.add(wy, trimM, new THREE.BoxGeometry(0.075, 0.045, 0.03), 0, 0.14, 0);
  for (const s of [1, -1]) P.add(wy, trimM, horn([[0, 0.14, 0], [s * 0.065, 0.15, 0], [s * 0.12, 0.185, 0], [s * 0.145, 0.24, 0]], 0.017, 0.004, 10, 5));
  for (const s of [1, -1]) P.add(wy, sigilM, new THREE.OctahedronGeometry(0.016), 0, 0.14, s * 0.016, 0, 0, 0, 1, 1.2, 0.5);
  { const pts = []; for (let k = 0; k <= 14; k++) { const y = -0.15 + k / 14 * 0.27; pts.push([0.0185 + 0.0025 * Math.abs(Math.sin(y * 85)), y]); } P.add(wy, leatherM, K.lathe(pts, 8)); }
  P.add(wy, trimM, K.lathe([[0.004, -0.235], [0.024, -0.225], [0.03, -0.2], [0.022, -0.175], [0.018, -0.155]], 10));
  P.add(wy, sigilM, new THREE.OctahedronGeometry(0.014), 0, -0.238, 0);
  const runes = []; for (let i = 0; i < 5; i++) { const y = 0.32 + i * 0.17, m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), runeOff); m.position.set(cx(y) - bw(y) * 0.3, y, 0); m.scale.set(0.011, 0.026, 0.0135); wy.add(m); runes.push(m); }
  wtip.position.set(spineX(BL1), BL1, 0); wy.add(wtip);
  // ---- parrying dagger, reverse grip: the blade lies along the outside of the left forearm ----
  const dag = grp(armL.hand, 0.045, -0.07, 0.0); dag.rotation.set(0.1, 0, -0.14);
  P.add(dag, leatherM, K.lathe([[0.015, -0.05], [0.017, 0.0], [0.015, 0.045]], 8));
  P.add(dag, trimM, K.lathe([[0.004, -0.075], [0.02, -0.065], [0.016, -0.05]], 8));
  P.add(dag, trimM, new THREE.BoxGeometry(0.03, 0.016, 0.085), 0, 0.055, 0);
  { const sh = new THREE.Shape([new THREE.Vector2(0.0, 0.07), new THREE.Vector2(0.0035, 0.07), new THREE.Vector2(0.0, 0.39)]);
    const dsh = new THREE.Shape([new THREE.Vector2(0, 0.065), new THREE.Vector2(0.0, 0.4), new THREE.Vector2(-0.018, 0.065)]);
    const db = new THREE.ExtrudeGeometry(dsh, { depth: 0.01, bevelEnabled: false }); db.translate(0, 0, -0.005); db.rotateY(PI / 2); P.add(dag, bladeM, db);
    const de = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }); de.translate(0, 0, -0.006); de.rotateY(PI / 2); P.add(dag, edgeM, de); }

  // ---- Bladestorm: spectral blades orbit the hero ----
  const ghostM = new THREE.MeshBasicMaterial({ color: hotC.clone().multiplyScalar(1.6), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const ghostG = new THREE.OctahedronGeometry(1, 0); ghostG.scale(0.035, 0.012, 0.3);
  const ghosts = []; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(ghostG, ghostM); m.visible = false; m.rotation.order = 'YXZ'; g.add(m); ghosts.push(m); }
  // ---- swing trail: a ribbon of the blade's last positions, in world space ----
  const TN = 14, trPos = new Float32Array(TN * 6), trCol = new Float32Array(TN * 6), trGeo = new THREE.BufferGeometry(), trIdx = [];
  for (let i = 0; i < TN - 1; i++) { const a = i * 2; trIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3)); trGeo.setIndex(trIdx);
  const trail = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  trail.frustumCulled = false; trail.matrixAutoUpdate = false; trail.visible = false; trail.renderOrder = 12; g.add(trail);
  const trAct = new Float32Array(TN);
  P.finish();
  const aura = new THREE.PointLight(C.glow, 1.3, 7, 1.5); aura.position.set(0, 0.6, 0.9); g.add(aura);

  // ---- poses ----
  // hy/hd/hz hips yaw, drop, forward; bx body pitch; tx/ty/tz torso; hx/hw head; tl/tr/zl/zr/kl/kr legs; r*/l* arms (shoulder x,y,z,
  // elbow); be/by/bz blade elevation, yaw and roll in body space (by 0 points ahead, negative to the right)
  const PK = ['hy', 'hd', 'hz', 'bx', 'tx', 'ty', 'tz', 'hx', 'hw', 'tl', 'tr', 'zl', 'zr', 'kl', 'kr', 'rx', 'ry', 'rz', 're', 'lx', 'ly', 'lz', 'le', 'be', 'by', 'bz'];
  const B = {}, S = {}; for (const k of PK) { B[k] = 0; S[k] = 0; }
  const mix = (dst, src, w) => { if (w > 0.001) for (const k in src) dst[k] = lerp(dst[k], src[k], w); };
  const GUARD = { ty: 0.22, tx: -0.04, hd: -0.08, tl: -0.32, kl: 0.38, tr: 0.36, kr: 0.36, rx: -1.45, ry: 0, rz: 0.32, re: -1.3, lx: -1.25, lz: -0.32, le: -1.6, be: 1.15, by: 0.35, bz: 1.57 };
  const DASH = { bx: 0.5, hd: -0.14, ty: -0.3, tx: 0.12, hx: -0.3, tl: -0.95, kl: 0.85, tr: 0.75, kr: 0.5, rx: 0.7, rz: -0.5, re: -0.2, lx: -1.3, lz: 0.15, le: -0.4, be: -0.35, by: -2.85, bz: 0.4 };
  const AIR = { tl: -0.75, tr: -0.1, kl: 1.15, kr: 0.55, lz: 0.5, lx: -0.3, rz: -0.6, be: 0.1 };
  const fol = (o, d) => Object.assign({}, o, d);
  // each swing: [time 0..1, pose, snap?]; the blend in and out is applied over the whole swing
  // a short hold on the wind-up, then a snapped strike that settles into the follow-through
  const SW = {}, cut = (w, s, f, tw = 0.14, ts = 0.4) => [[0, w], [tw, w], [ts, s, 1], [0.78, fol(s, f)]];
  SW[0] = cut({ ty: -0.55, tx: -0.04, rx: -2.45, rz: -0.65, re: -1.0, be: 0.55, by: -2.3, bz: -0.4, lx: -0.6, lz: 0.35, le: -0.8 },
    { ty: 0.5, tx: 0.14, bx: 0.1, hd: -0.09, tl: -0.35, kl: 0.4, rx: -0.85, rz: 0.55, re: -0.12, be: -0.7, by: 0.95, bz: -0.9, lx: 0.3, lz: 0.4, le: -0.6 }, { by: 1.25, be: -0.85, ty: 0.6 });
  SW[1] = cut({ ty: 0.6, hd: -0.07, kl: 0.3, kr: 0.3, rx: -0.75, rz: 0.75, re: -0.7, be: -0.45, by: 1.7, bz: 0.6, lx: 0.2, lz: 0.5, le: -0.5 },
    { ty: -0.55, tx: 0.06, rx: -2.1, rz: -0.75, re: -0.2, be: 0.75, by: -1.4, bz: 0.9, lx: -0.7, lz: 0.3, le: -0.9 }, { by: -1.8, be: 0.85, ty: -0.65 });
  SW[2] = cut({ tx: -0.18, bx: -0.04, rx: -2.95, rz: -0.15, re: -1.35, be: 1.4, by: -0.15, bz: 1.57, lx: -2.6, lz: -0.1, le: -1.2 },
    { tx: 0.3, bx: 0.18, hd: -0.13, hz: 0.12, tl: -0.7, kl: 0.75, tr: 0.45, kr: 0.35, rx: -1.15, rz: 0.08, re: -0.08, be: -0.8, by: -0.1, bz: 1.57, lx: 0.55, lz: 0.35, le: -0.3 }, { be: -0.9 }, 0.16, 0.42);
  SW[3] = cut({ ty: -0.75, hd: -0.12, tx: 0.12, kl: 0.45, kr: 0.45, tl: -0.3, tr: 0.35, rx: -0.25, rz: -0.55, re: -0.45, lx: -0.5, lz: -0.55, le: -0.7, be: -0.65, by: -2.35, bz: 0.3 },
    { ty: 0.55, hd: 0.02, tx: -0.06, tl: -0.45, kl: 0.25, tr: 0.25, kr: 0.1, rx: -2.3, rz: 0.5, re: -0.3, lx: -2.1, lz: -0.6, le: -0.5, be: 0.8, by: 0.9, bz: -0.4 }, { be: 0.95, by: 1.05 }, 0.16, 0.44);
  SW[4] = [[0, {}], [0.3, { tx: -0.08, rx: -0.9, re: -0.85 }, 1], [1, {}]];
  SW[5] = cut({ tx: -0.12, hd: -0.03, rx: -2.55, rz: 0.45, re: -1.05, lx: -2.55, lz: -0.45, le: -1.05, be: 0.95, by: 0.75, bz: -0.3 },
    { tx: 0.32, bx: 0.14, hd: -0.17, zl: 0.3, zr: -0.3, kl: 0.55, kr: 0.55, tl: -0.25, tr: 0.15, rx: -0.4, rz: -0.8, re: -0.1, lx: -0.4, lz: 0.8, le: -0.1, be: -0.55, by: -1.45, bz: 0.4 }, { by: -1.6 }, 0.24, 0.5);
  SW[6] = cut({ ty: -0.45, rx: -0.95, rz: -0.35, re: -1.65, be: 0.05, by: -0.05, bz: 1.57, lx: -0.6, le: -0.9 },
    { ty: 0.35, tx: 0.16, bx: 0.22, hd: -0.12, hz: 0.1, tl: -0.8, kl: 0.8, tr: 0.55, kr: 0.3, rx: -1.55, rz: -0.02, re: -0.02, be: 0.04, by: 0.02, bz: 1.57, lx: 0.75, lz: 0.4, le: -0.2 }, {}, 0.12, 0.36);
  SW[7] = cut({ ty: 0.85, hd: -0.08, rx: -1.4, rz: 0.55, re: -0.9, be: 0.25, by: 1.4, bz: -1.2, lx: -1.0, lz: -0.3, le: -1.2 },
    { ty: -0.85, hd: -0.1, kl: 0.4, kr: 0.4, zl: 0.2, zr: -0.2, rx: -1.45, rz: -1.15, re: -0.05, be: 0.05, by: -1.7, bz: -1.2, lx: 0.4, lz: 0.6, le: -0.4 }, { by: -2.0 }, 0.12, 0.38);
  function keyed(keys, k, base, out) {
    let i = 0; while (i < keys.length - 1 && k > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], u = b === a ? 1 : sat((k - a[0]) / (b[0] - a[0])), e = b[2] ? 1 - Math.pow(1 - u, 3) : smooth(u);
    for (const q of PK) { const va = a[1][q] !== undefined ? a[1][q] : base[q], vb = b[1][q] !== undefined ? b[1][q] : base[q]; out[q] = lerp(va, vb, e); }
  }

  const A = { run: 0, swing: 0, swingDur: 0.28, swingKind: 0, cast: 0, guard: 0, dash: 0, storm: 0, lean: 0, aim: 0, load: 0, air: 0, full: 0, trT: 0, vx: 0, vz: 0, lx: null, lz: null };
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _a = new V3(), _b = new V3(), _m = new THREE.Matrix4();
  const tB = [], tT = []; for (let i = 0; i < TN; i++) { tB.push(new V3()); tT.push(new V3()); }
  const trC0 = glowC.clone().multiplyScalar(0.45), trC1 = hotC.clone().lerp(new THREE.Color(1, 1, 1), 0.25).multiplyScalar(2.2);

  function update(dt, p) {
    dt = Math.min(dt, 0.1); const t = G.now;
    const spd = p.moveSpeed || 0, grounded = p.grounded !== false, moving = spd > 0.5 && grounded;
    const wp = g.position, f = g.rotation.y;
    if (A.lx !== null && dt > 0) { const dx = wp.x - A.lx, dz = wp.z - A.lz;
      if (dx * dx + dz * dz < 4) { A.vx = damp(A.vx, (dx * Math.cos(f) - dz * Math.sin(f)) / dt, 12, dt); A.vz = damp(A.vz, (dx * Math.sin(f) + dz * Math.cos(f)) / dt, 12, dt); } }
    A.lx = wp.x; A.lz = wp.z;
    A.lean = damp(A.lean, moving ? Math.min(1, spd / 7) : 0, 9, dt);
    A.run += dt * spd * 1.55; const ph = A.run, s = Math.sin(ph), c = Math.cos(ph), L = A.lean, br = Math.sin(t * 1.7);
    const storm = !!(p.hasBuff && p.hasBuff('storm'));
    A.guard = damp(A.guard, p.parryT > 0 ? 1 : 0, 22, dt); A.dash = damp(A.dash, p.dash ? 1 : 0, p.dash ? 30 : 9, dt);
    A.air = damp(A.air, grounded ? 0 : 1, 12, dt); A.storm = damp(A.storm, storm ? 1 : 0, 5, dt);
    const res = p.res | 0, rmax = p.resMax || 5; A.full = damp(A.full, res >= rmax && res > 0 ? 1 : 0, 8, dt);

    // ---- base: duelist's stance blended into the run (blade trails behind) ----
    const kc = Math.cos(ph - 0.45);
    B.hy = lerp(0.18, s * 0.16, L); B.hd = lerp(-0.035 + br * 0.006, Math.abs(c) * 0.065 - 0.035, L); B.hz = 0;
    B.bx = lerp(0.04, 0.2, L); B.tx = lerp(0.05 + br * 0.012, 0.08, L); B.ty = lerp(-0.12 + Math.sin(t * 0.5) * 0.03, -s * 0.24, L); B.tz = 0;
    B.hx = lerp(0.06, -0.08, L); B.hw = lerp(Math.sin(t * 0.37) * 0.1, s * 0.08, L);
    B.tl = lerp(-0.16, -s * 0.75, L); B.tr = lerp(0.2, s * 0.75, L); B.zl = 0.09 * (1 - L); B.zr = -0.08 * (1 - L);
    B.kl = lerp(0.12, 0.12 + Math.pow(Math.max(0, kc), 1.5), L); B.kr = lerp(0.24, 0.12 + Math.pow(Math.max(0, -kc), 1.5), L);
    B.rx = lerp(-0.5 + br * 0.02, 0.3 + s * 0.18, L); B.ry = 0; B.rz = lerp(-0.22, -0.32, L); B.re = lerp(-0.6, -0.35, L);
    B.lx = lerp(-0.35, s * 0.75, L); B.ly = 0; B.lz = lerp(0.2, 0.12, L); B.le = lerp(-1.05, -1.1, L);
    B.be = lerp(-0.5 + br * 0.015, -0.2, L); B.by = lerp(-0.25, -2.75, L); B.bz = lerp(0, 0.3, L);
    mix(B, GUARD, A.guard); mix(B, DASH, A.dash); mix(B, AIR, A.air * (1 - A.dash));
    // ---- one-shot moves ----
    let sw = 0;
    if (A.swing > 0) {
      A.swing -= dt; const k = 1 - Math.max(0, A.swing) / A.swingDur, keys = SW[A.swingKind] || SW[4];
      sw = smooth(k / 0.12) * (1 - smooth((k - 0.72) / 0.28)); keyed(keys, k, B, S); mix(B, S, sw);
    }
    const fall = p.pose === 'fall';
    if (fall) { B.tl = 0.25 + Math.sin(t * 5) * 0.05; B.tr = 0.25 - Math.sin(t * 5) * 0.05; B.kl = B.kr = 0.7; if (sw < 0.05) { B.lx = B.rx = -2.3; B.lz = 0.75; B.rz = -0.75; B.le = B.re = -0.5; B.be = 0.3; B.by = -0.6; } }
    if (p.flashT > 0) { const q = p.flashT / 0.15; B.tx -= 0.14 * q; B.hx -= 0.1 * q; }
    // ---- apply ----
    hips.position.set(0, 0.95 + B.hd, B.hz); hips.rotation.set(0, B.hy, 0);
    if (fall) { body.rotation.set(1.28 + Math.sin(t * 2.3) * 0.05 + L * 0.12, 0, Math.sin(t * 1.7) * 0.05); body.position.set(0, 0.75, -0.95); }
    else { body.rotation.set(B.bx, 0, 0); body.position.set(0, 0, 0); }
    torso.rotation.set(B.tx, B.ty, B.tz); head.rotation.set(B.hx, B.hw - (B.ty + B.hy) * 0.65, 0);
    legL.hip.rotation.set(B.tl, 0, B.zl); legR.hip.rotation.set(B.tr, 0, B.zr); legL.knee.rotation.x = B.kl; legR.knee.rotation.x = B.kr;
    const tilt = body.rotation.x;
    legL.ankle.rotation.x = clamp(-(B.tl + B.kl + tilt) * 0.85 + (L > 0.2 ? Math.max(0, -s) * 0.35 * L : 0), -0.9, 0.9); legR.ankle.rotation.x = clamp(-(B.tr + B.kr + tilt) * 0.85 + (L > 0.2 ? Math.max(0, s) * 0.35 * L : 0), -0.9, 0.9);
    armL.sh.rotation.set(B.lx, B.ly, B.lz); armR.sh.rotation.set(B.rx, B.ry, B.rz); armL.el.rotation.x = B.le; armR.el.rotation.x = B.re;
    // the blade is aimed in body space: undo the chain from the body to the hand
    _q.copy(hips.quaternion).multiply(torso.quaternion).multiply(armR.sh.quaternion).multiply(armR.el.quaternion).invert();
    _e.set(-B.be, B.by, B.bz); weapon.quaternion.copy(_q).multiply(_q2.setFromEuler(_e));
    // ---- cloth ----
    const wind = (phi) => -(Math.sin(phi) * A.vx + Math.cos(phi) * A.vz) * 0.055, lean = tilt + B.tx;
    const flut = (k, ph2) => Math.sin(t * 8 - k * 1.2 + ph2) * (0.05 * L + 0.07 * A.dash + 0.03 * A.storm);
    for (const cp of cape) for (let k = 0; k < cp.chain.length; k++) { const q = cp.chain[k];
      const tgt = k ? 0.05 + flut(k, cp.phi * 0.8) + wind(cp.phi) * 0.2 + A.dash * 0.1 : 0.05 + lean * 0.9 + wind(cp.phi) * 0.6 + wind(2.76) * 0.4 + Math.max(0, Math.max(B.tl, B.tr)) * 0.35 + A.air * 0.4 + A.dash * 0.45 + flut(0, cp.phi * 0.8) + sw * 0.12;
      q.o.rotation.x = -(k ? clamp(q.spr.step(tgt, dt), -0.3, 0.6) : clamp(q.spr.step(tgt, dt), -0.08, 1.1)); }
    tabard.rotation.x = -clamp(tabSpr.step(Math.max(0, -Math.min(B.tl, B.tr)) * 1.05 + wind(0) * 0.6 + flut(0, 1) + A.air * 0.3, dt), -0.05, 1.3);
    for (const ch of tails) for (let k = 0; k < ch.length; k++) { const q = ch[k], tgt = clamp(A.vz * 0.085 - 0.05, -0.15, 1.25) * (k ? 0.35 : 1) + Math.max(0, Math.max(B.tl, B.tr)) * (k ? 0 : 0.7) + Math.sin(t * 7 - k * 1.3) * (0.06 * L + 0.02) + A.air * 0.3;
      q.o.rotation.x = q.spr.step(tgt + (k === 0 ? -tilt : 0), dt); q.o.rotation.z = q.sprZ.step(-A.vx * 0.05 * (k ? 0.4 : 1), dt); }
    for (const q of tassets) { const lx = q.s > 0 ? B.tl : B.tr; q.o.rotation.x = q.spr.step(Math.min(0.15, lx) * 0.85, dt); }
    for (let k = 0; k < plume.length; k++) { const q = plume[k], tgt = (k ? 0.12 : 0.55) + clamp(A.vz * 0.07, -0.2, 1.0) * (k ? 0.3 : 1) + Math.sin(t * 6.5 - k * 1.1) * (0.07 * L + 0.02) + A.dash * (k ? 0.08 : 0.3);
      q.o.rotation.x = q.spr.step(tgt - (k ? 0 : tilt + B.tx + B.hx), dt); q.o.rotation.z = q.sprZ.step(-A.vx * 0.06 * (k ? 0.5 : 1), dt); }
    // ---- glow: Momentum runes, edge, sigils ----
    for (let i = 0; i < 5; i++) runes[i].material = i < Math.round(res * 5 / rmax) ? runeOn : runeOff;
    const pulse = 0.5 + 0.5 * Math.sin(t * 6), pump = 1 + A.guard * 0.8 + sw * 0.6 + A.storm * 0.5 + A.full * 0.35 * pulse;
    edgeM.color.copy(edgeBase).lerp(hotEdge, A.full * 0.8 + A.storm * 0.3).multiplyScalar(pump);
    sigilM.color.copy(sigilBase).multiplyScalar(0.85 + 0.15 * Math.sin(t * 2.3) + (pump - 1) * 0.6);
    visorM.color.copy(visorBase).multiplyScalar(1 + A.guard * 0.6 + A.full * 0.3 * pulse + A.storm * 0.4);
    const counter = A.swingKind === 7 ? sw : 0;
    rimU.value.copy(rimBase).multiplyScalar(1 + A.guard * 1.4 + A.storm * 0.4 + counter * 2 + A.dash * 0.8);
    aura.intensity = 1.3 + A.guard * 2 + A.storm * 1.2 + sw * 0.8 + A.full * 0.6 + counter * 4 + (p.flashT > 0 ? 5 : 0);
    // ---- Bladestorm blades ----
    const gv = A.storm > 0.02 && !G.headless;
    for (let i = 0; i < 4; i++) { const m = ghosts[i]; m.visible = gv; if (!gv) continue; const a = t * 4.2 + i * TAU / 4, r = 0.82 + Math.sin(t * 2 + i) * 0.06;
      m.position.set(Math.cos(a) * r, 1.0 + Math.sin(t * 3 + i * 1.7) * 0.18, Math.sin(a) * r); m.rotation.set(0.25 * Math.sin(t * 2 + i), -a, 0.6); m.scale.setScalar(A.storm * (0.9 + 0.1 * Math.sin(t * 9 + i))); }
    ghostM.opacity = 0.6 + 0.25 * Math.sin(t * 7);
    // ---- trail ----
    if (G.headless || !g.visible) { trail.visible = false; return; }
    const act = sat(sw * 1.4) * (A.swingKind === 4 ? 0 : 1) + A.dash * 0.7;
    if (act < 0.01 && trAct[0] < 0.01 && trAct[TN - 1] < 0.01) { trail.visible = false; trAct.fill(0); return; }
    g.updateMatrixWorld(true);
    _a.set(cx(0.45), 0.45, 0); wy.localToWorld(_a); _b.set(cx(BL1 - 0.03), BL1 - 0.03, 0); wy.localToWorld(_b);
    if (trAct[0] < 0.01 && trAct[1] < 0.01) for (let i = 0; i < TN; i++) { tB[i].copy(_a); tT[i].copy(_b); trAct[i] = 0; } // starting fresh: no smear from stale samples
    // samples are spaced in time (not frames) so the ribbon is as long at 160 fps as at 60; the head always follows the blade
    if ((A.trT += dt) >= 0.014) { A.trT = 0; for (let i = TN - 1; i > 0; i--) { tB[i].copy(tB[i - 1]); tT[i].copy(tT[i - 1]); trAct[i] = trAct[i - 1]; } }
    tB[0].copy(_a); tT[0].copy(_b); trAct[0] = Math.min(1, act);
    for (let i = 0; i < TN; i++) { const fd = Math.pow(1 - i / (TN - 1), 1.4) * trAct[i], o = i * 6;
      trPos[o] = tB[i].x; trPos[o + 1] = tB[i].y; trPos[o + 2] = tB[i].z; trPos[o + 3] = tT[i].x; trPos[o + 4] = tT[i].y; trPos[o + 5] = tT[i].z;
      trCol[o] = trC0.r * fd; trCol[o + 1] = trC0.g * fd; trCol[o + 2] = trC0.b * fd; trCol[o + 3] = trC1.r * fd; trCol[o + 4] = trC1.g * fd; trCol[o + 5] = trC1.b * fd; }
    trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true; trGeo.computeBoundingSphere();
    trail.matrix.copy(_m.copy(g.matrixWorld).invert()); trail.visible = true;
  }
  return { group: g, update, anim: A, wtip, body, swing(kind = 0, dur = 0.28) { A.swing = A.swingDur = dur; A.swingKind = kind; } };
};
