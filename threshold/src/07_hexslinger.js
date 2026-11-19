// ============================== HEXSLINGER ==============================
// A gunslinger witch: a wide cattleman brim under a tall crumpled witch crown with hex studs and a hanging charm, a shadowed
// face behind a bandana mask with two lit eyes, a long braid, a scalloped capelet with a hex sigil, an open duster on six
// hinged panels (split back), a vest crossed by a bandolier of salve vials (one goes dark per salve used), a slung gunbelt and
// holster, tall cuffed boots with spurs, and a long-barrelled revolver whose six chambers glow with the rounds actually loaded
// (lead gold, silver violet, salve green). The drum turns one chamber per shot, swings out to load, spins on Spin, and the
// barrel rune climbs toward the Last Word. Arms are placed by two-bone IK so the off hand really fans the hammer, thumbs rounds
// into the open drum and slaps it round; the revolver is aimed in body space.
HERO_MODELS.hexslinger = function buildHexslinger(cls) {
  const C = cls.look, K = HeroKit, P = K.parts(), g = new THREE.Group();
  const or = (v, d) => v !== undefined ? v : d;
  const glowC = new THREE.Color(C.glow), clothC = new THREE.Color(C.cloth), armorC = new THREE.Color(C.armor);
  const rimBase = glowC.clone().lerp(new THREE.Color(1, 1, 1), 0.3).multiplyScalar(0.22), rimU = { value: rimBase.clone() };
  const accent = clothC.clone().lerp(glowC, 0.14).multiplyScalar(1.05);
  const coatM = K.mat({ color: C.cloth, roughness: 0.62, side: THREE.DoubleSide }, rimU, 0.8, or(C.lining, clothC.clone().multiplyScalar(0.45).lerp(glowC, 0.06).getHex()));
  const capeM = K.mat({ color: clothC.clone().lerp(armorC, 0.3).multiplyScalar(1.12), roughness: 0.66, side: THREE.DoubleSide }, rimU, 0.9, clothC.clone().multiplyScalar(0.4).getHex());
  const hatM = K.mat({ color: armorC.clone().multiplyScalar(1.18), roughness: 0.74, side: THREE.DoubleSide }, rimU, 0.95, armorC.clone().multiplyScalar(0.55).getHex());
  const vestM = K.mat({ color: armorC.clone().lerp(clothC, 0.25), roughness: 0.55, metalness: 0.15 }, rimU, 0.6);
  const accM = K.mat({ color: accent, roughness: 0.8, side: THREE.DoubleSide }, rimU, 0.7);
  const maskM = K.mat({ color: accent.clone().multiplyScalar(0.62), roughness: 0.9 }, rimU, 0.5);
  const shirtM = K.mat({ color: or(C.inner, 0x9a8f9e), roughness: 0.9 }, rimU, 0.4);
  const leatherM = K.mat({ color: or(C.leather, 0x2b1f1c), roughness: 0.58 }, rimU, 0.55);
  const legM = K.mat({ color: 0x17141c, roughness: 0.85 }, rimU, 0.5);
  const metalM = K.mat({ color: or(C.metal, 0xc4bdd2), roughness: 0.26, metalness: 0.88, envMapIntensity: 1.5, emissive: or(C.metal, 0xc4bdd2), emissiveIntensity: 0.05 }, rimU, 0.9);
  const gunM = K.mat({ color: 0x2a2a38, roughness: 0.26, metalness: 0.92, envMapIntensity: 1.6 }, rimU, 1.1);
  const pearlM = K.mat({ color: 0xe9dbe8, roughness: 0.3, metalness: 0.1, emissive: 0xffe8fb, emissiveIntensity: 0.05 }, rimU, 0.6);
  const skinM = K.mat({ color: 0x2b1f24, roughness: 0.7 }, rimU, 0.3), hairM = K.mat({ color: 0x1c1519, roughness: 0.55 }, rimU, 0.7);
  const glowM = W.glow(C.glow, 2.2), sigM = W.glow(C.glow, 2.0), barrelM = W.glow(C.glow, 1.6);
  const glowBase = glowM.color.clone(), sigBase = sigM.color.clone(), barrelBase = barrelM.color.clone();
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  const warp = (geo, f) => { const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const r = f(pa.getX(i), pa.getY(i), pa.getZ(i)); pa.setXYZ(i, r[0], r[1], r[2]); } geo.computeVertexNormals(); return geo; };
  const hexG = (r, d) => new THREE.CylinderGeometry(r, r, d, 6).rotateX(PI / 2); // a flat hexagon facing +z
  const hexRing = (r0, r1) => new THREE.RingGeometry(r0, r1, 6, 1).rotateZ(PI / 6);

  // ---- skeleton ----
  const body = grp(g), hips = grp(body, 0, 0.95, 0), torso = grp(hips, 0, 0.02, 0), head = grp(torso, 0, 0.69, 0);
  const hat = grp(head, 0, 0.19, 0.0); hat.rotation.set(0.04, 0, -0.06);

  // ---- torso: vest with buttons, open duster with lapel facings, shirt collar, bandolier ----
  const TP = [[0.158, -0.08], [0.162, 0.06], [0.178, 0.22], [0.192, 0.36], [0.186, 0.48], [0.148, 0.59], [0.08, 0.67], [0.064, 0.72]];
  P.add(torso, vestM, K.lathe(TP, 20), 0, 0, 0, 0, 0, 0, 1, 1, 0.8);
  for (let k = 0; k < 5; k++) P.add(torso, metalM, new THREE.SphereGeometry(0.011, 8, 6), 0, 0.08 + k * 0.085, 0.152 + (k > 2 ? 0.002 : 0));
  P.add(torso, leatherM, new THREE.BoxGeometry(0.008, 0.1, 0.006), 0.07, 0.3, 0.15, 0, 0.35, 0.9); // watch chain hint
  const CP = TP.map(([r, y]) => [r * 1.07 + 0.006, y]);
  P.add(torso, coatM, K.lathe(CP.slice(0, 7), 22, 0.44, TAU - 0.88), 0, 0, 0, 0, 0, 0, 1, 1, 0.82);
  { // lapel facings: strips that widen toward the chest along both edges of the open front
    for (const s of [1, -1]) { const lg = K.lathe(CP.slice(1, 6).map(([r, y]) => [r + 0.006, y]), 4, 0, 0.3);
      warp(lg, (x, y, z) => { const a = Math.atan2(x, z), w = 0.25 + 0.75 * sat((y - 0.2) / 0.3), r = Math.hypot(x, z), aa = 0.44 + a * w; return [s * Math.sin(aa) * r, y, Math.cos(aa) * r]; });
      P.add(torso, accM, lg, 0, 0, 0, 0, 0, 0, 1, 1, 0.83); } }
  P.add(torso, shirtM, K.lathe([[0.072, 0.62], [0.078, 0.66], [0.07, 0.7]], 12), 0, 0, 0, 0, 0, 0, 1, 1, 0.95);
  // bandolier from the left shoulder to the right hip, with six vial loops on the front
  const band = (a) => { const x = Math.sin(a) * 0.226, z = Math.cos(a) * 0.178; return [x, 0.3 + 1.25 * x + (Math.cos(a) < 0 ? 0.03 : 0), z]; };
  { const pts = []; for (let k = 0; k <= 40; k++) pts.push(band(k / 40 * TAU)); P.add(torso, leatherM, K.tube(pts, 0.017, 64, 5)); }
  const vialAt = []; for (let k = 0; k < 6; k++) { const a = -0.62 + k * 0.248, [x, y, z] = band(a); vialAt.push([x * 1.04, y, z + 0.022]);
    P.add(torso, leatherM, new THREE.BoxGeometry(0.03, 0.046, 0.012), x * 1.03, y, z + 0.012, 0, a * 0.8, 0.9);
    P.add(torso, metalM, new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8), x * 1.04 - Math.sin(0.9) * 0.03, y + Math.cos(0.9) * 0.03, z + 0.022, 0, 0, 0.9); }
  // hips: slung gunbelt with cartridge loops and a hex buckle
  P.add(hips, leatherM, new THREE.TorusGeometry(0.205, 0.024, 6, 30), 0, -0.01, 0, PI / 2, 0, 0.11, 1, 0.82, 1);
  for (let k = 0; k < 11; k++) { const a = 1.15 + k * 0.36, x = Math.sin(a) * 0.212, z = Math.cos(a) * 0.212 * 0.82; P.add(hips, metalM, new THREE.CylinderGeometry(0.0075, 0.0075, 0.034, 6), x, -0.012 - x * 0.11, z, 0, 0, -0.11); }
  P.add(hips, metalM, hexG(0.04, 0.014), 0, -0.01, 0.178); P.add(hips, glowM, hexRing(0.012, 0.022), 0, -0.01, 0.1865);

  // ---- capelet: open front, scalloped hem longer at the back, hex sigil between the shoulders ----
  { const cg = K.lathe([[0.33, 0.37], [0.325, 0.45], [0.305, 0.53], [0.27, 0.6], [0.2, 0.655], [0.12, 0.69], [0.098, 0.7]], 30, 0.58, TAU - 1.16);
    warp(cg, (x, y, z) => { if (y < 0.375) { const a = Math.atan2(x, z); y += -0.07 * Math.max(0, -Math.cos(a)) + 0.018 * Math.cos(a * 9) + 0.035 * Math.pow(Math.abs(Math.sin(a)), 4); } return [x, y, z]; });
    P.add(torso, capeM, cg, 0, 0, -0.005, 0, 0, 0, 1.13, 1, 0.84);
    const tr = K.lathe([[0.1, 0.672], [0.104, 0.705]], 30, 0.58, TAU - 1.16); P.add(torso, accM, tr, 0, 0, -0.005, 0, 0, 0, 1.13, 1, 0.84); }
  P.add(torso, glowM, hexRing(0.04, 0.05), 0, 0.49, -0.262, 0.62, PI, 0); P.add(torso, glowM, hexRing(0.012, 0.018), 0, 0.49, -0.263, 0.62, PI, 0);

  // ---- head: shadowed face, eyes, bandana mask, hair ----
  P.add(head, skinM, new THREE.SphereGeometry(0.1, 14, 10), 0, 0.115, 0.012, 0, 0, 0, 0.94, 1.08, 1);
  P.add(head, hairM, new THREE.SphereGeometry(0.106, 14, 10), 0, 0.13, -0.016, 0, 0, 0, 1, 1, 1);
  for (const s of [1, -1]) P.add(head, glowM, new THREE.BoxGeometry(0.032, 0.0095, 0.012), s * 0.037, 0.132, 0.106, 0, s * 0.4, s * -0.16);
  P.add(head, maskM, K.lathe([[0.104, -0.03], [0.112, 0.02], [0.113, 0.07], [0.106, 0.095]], 12, -1.45, 2.9), 0, 0, 0.008);
  P.add(torso, accM, new THREE.TorusGeometry(0.083, 0.036, 8, 18), 0, 0.665, 0.004, PI / 2, 0, 0, 1, 0.92, 1);
  { const sh = new THREE.Shape([new THREE.Vector2(-0.085, 0), new THREE.Vector2(0.085, 0), new THREE.Vector2(0.01, -0.15)]);
    P.add(torso, accM, new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }), 0, 0.66, 0.112, -0.32, 0, 0); }

  // ---- hat: cattleman brim curled up at the sides, a tall crown that droops back to a crumpled point, band, studs, concho ----
  { const bg = K.lathe([[0.12, 0.007], [0.24, 0.006], [0.36, 0.004], [0.372, 0.0], [0.36, -0.004], [0.24, -0.006], [0.12, -0.007]], 36);
    warp(bg, (x, y, z) => { const r = Math.hypot(x, z), a = Math.atan2(x, z), u = sat((r - 0.16) / 0.21), sa = Math.sin(a), ca = Math.cos(a);
      return [x, y + u * u * (0.105 * sa * sa - (ca > 0 ? 0.02 : 0.014) * ca * ca), z * 1.07]; });
    P.add(hat, hatM, bg);
    const edge = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * TAU, sa = Math.sin(a), ca = Math.cos(a); edge.push([sa * 0.368, 0.105 * sa * sa - (ca > 0 ? 0.02 : 0.014) * ca * ca, ca * 0.368 * 1.07]); }
    P.add(hat, leatherM, K.tube(edge, 0.0065, 72, 4));
    const cg = K.lathe([[0.128, -0.01], [0.132, 0.05], [0.124, 0.11], [0.108, 0.17], [0.086, 0.225], [0.064, 0.272], [0.044, 0.31], [0.026, 0.342], [0.012, 0.364], [0.002, 0.376]], 18);
    warp(cg, (x, y, z) => { const u = sat((y - 0.1) / 0.28), a = Math.atan2(x, z), w = 1 + 0.05 * Math.sin(a * 3 + y * 24) * u; return [x * w + 0.02 * u * u, y - 0.055 * u * u * u, z * w - 0.19 * u * u]; });
    P.add(hat, hatM, cg);
    P.add(hat, leatherM, K.lathe([[0.1345, 0.0], [0.1365, 0.052]], 18));
    P.add(hat, metalM, hexG(0.026, 0.008), Math.sin(0.45) * 0.137, 0.026, Math.cos(0.45) * 0.137, 0, 0.45, 0); P.add(hat, glowM, hexG(0.012, 0.004), Math.sin(0.45) * 0.142, 0.026, Math.cos(0.45) * 0.142, 0, 0.45, 0);
    for (const a of [-0.55, 1.35, 2.25, -2.25, 3.14]) P.add(hat, glowM, hexG(0.009, 0.004), Math.sin(a) * 0.138, 0.026, Math.cos(a) * 0.138, 0, a, 0); }
  // charm hanging off the left of the brim
  const charm = grp(hat, 0.33, 0.055, 0.03), charmSpr = [K.spring(60, 5), K.spring(60, 5)];
  P.add(charm, leatherM, new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4), 0, -0.035, 0);
  P.add(charm, metalM, hexG(0.022, 0.006), 0, -0.085, 0, 0, PI / 2, 0); P.add(charm, glowM, hexRing(0.007, 0.013).rotateY(PI / 2), 0.004, -0.085, 0);
  // braid down the back, ending in a silver ring and a lit bead
  const braid = []; { let par = grp(head, 0, 0.06, -0.098);
    for (let k = 0; k < 4; k++) { const seg = grp(par, 0, k ? -0.085 : 0, 0), r = 0.03 - k * 0.003;
      for (let j = 0; j < 3; j++) P.add(seg, hairM, new THREE.SphereGeometry(r, 8, 6), (j % 2 ? 0.006 : -0.006), -0.014 - j * 0.028, 0, 0, 0, 0, 1, 0.9, 0.85);
      if (k === 3) { P.add(seg, metalM, new THREE.TorusGeometry(0.02, 0.006, 4, 12), 0, -0.088, 0, PI / 2, 0, 0); P.add(seg, glowM, new THREE.OctahedronGeometry(0.018), 0, -0.11, 0, 0, 0, 0, 1, 1.3, 1); }
      braid.push({ o: seg, sx: K.spring(70 - k * 10, 7), sz: K.spring(60, 7) }); par = seg; } }
  // scarf tails knotted at the left of the neck, over the chest
  const tails = []; for (const [x, w, n, rz] of [[0.05, 0.05, 3, 0.12], [0.085, 0.042, 2, 0.32]]) { let par = grp(torso, x, 0.655, 0.105); const chain = [];
    for (let k = 0; k < n; k++) { const seg = grp(par, 0, k ? -0.12 : 0, 0); P.add(seg, accM, new THREE.BoxGeometry(w - k * 0.006, 0.124, 0.008), 0, -0.06, 0);
      chain.push({ o: seg, sx: K.spring(60 - k * 12, 6), sz: K.spring(45, 6), rz: k ? 0 : rz }); par = seg; }
    tails.push(chain); }

  // ---- arms: duster sleeves, gauntlet gloves; the left glove carries a sigil ----
  const UA = 0.29, FA = 0.275;
  const mkArm = (side) => {
    const sh = grp(torso, side * 0.235, 0.55, -0.01);
    P.add(sh, coatM, new THREE.SphereGeometry(0.066, 12, 8), side * 0.004, -0.012, 0, 0, 0, 0, 1, 0.95, 1);
    P.add(sh, coatM, K.lathe([[0.064, -0.3], [0.07, -0.2], [0.076, -0.08], [0.08, 0.02]], 12));
    const el = grp(sh, 0, -UA, 0);
    P.add(el, coatM, K.lathe([[0.056, -0.15], [0.06, -0.06], [0.064, 0.02]], 12));
    P.add(el, leatherM, K.lathe([[0.046, -0.26], [0.052, -0.2], [0.072, -0.17], [0.078, -0.105], [0.064, -0.1]], 12));
    P.add(el, metalM, new THREE.TorusGeometry(0.068, 0.005, 4, 16), 0, -0.13, 0, PI / 2, 0, 0);
    const hand = grp(el, 0, -FA, 0);
    P.add(hand, leatherM, new THREE.SphereGeometry(0.045, 10, 8), 0, -0.02, 0.005, 0, 0, 0, 0.82, 1.2, 1.1);
    P.add(hand, leatherM, new THREE.CapsuleGeometry(0.015, 0.04, 3, 6), side * -0.033, 0, 0.03, 0.5, 0, side * 0.4);
    if (side > 0) { P.add(hand, sigM, hexRing(0.011, 0.019).rotateY(PI / 2), 0.04, -0.02, 0.006); P.add(el, sigM, new THREE.BoxGeometry(0.004, 0.05, 0.004), 0.08, -0.14, 0); }
    return { sh, el, hand, side };
  };
  const armL = mkArm(1), armR = mkArm(-1);

  // ---- legs: trousers, holster on the right thigh, tall cuffed boots, spurs ----
  const mkLeg = (side) => {
    const hip = grp(hips, side * 0.1, -0.02, 0);
    P.add(hip, legM, K.lathe([[0.058, -0.45], [0.066, -0.3], [0.082, -0.12], [0.088, 0.02]], 12));
    if (side < 0) { P.add(hip, leatherM, new THREE.BoxGeometry(0.04, 0.2, 0.085), -0.09, -0.14, 0.01, 0.06, 0, -0.08); P.add(hip, metalM, new THREE.BoxGeometry(0.042, 0.012, 0.087), -0.091, -0.06, 0.01, 0.06, 0, -0.08);
      P.add(hip, leatherM, new THREE.TorusGeometry(0.076, 0.008, 4, 16), 0, -0.25, 0, PI / 2, 0, 0); P.add(hip, metalM, hexG(0.014, 0.004).rotateY(-PI / 2), -0.112, -0.17, 0.01); }
    const knee = grp(hip, 0, -0.45, 0);
    P.add(knee, leatherM, K.lathe([[0.062, -0.4], [0.057, -0.3], [0.064, -0.17], [0.071, -0.07], [0.076, -0.02]], 12));
    P.add(knee, hatM, K.lathe([[0.072, -0.07], [0.084, -0.04], [0.092, 0.0], [0.094, 0.03]], 12));
    const ankle = grp(knee, 0, -0.42, 0);
    P.add(ankle, leatherM, new THREE.SphereGeometry(0.07, 12, 8), 0, -0.032, 0.045, 0, 0, 0, 0.76, 0.55, 1.55);
    P.add(ankle, legM, new THREE.BoxGeometry(0.1, 0.016, 0.2), 0, -0.064, 0.045);
    P.add(ankle, legM, new THREE.BoxGeometry(0.075, 0.04, 0.05), 0, -0.05, -0.035);
    P.add(ankle, metalM, new THREE.TorusGeometry(0.062, 0.006, 4, 16, PI), 0, -0.02, 0.0, PI / 2, 0, PI);
    for (let k = 0; k < 3; k++) P.add(ankle, metalM, new THREE.BoxGeometry(0.003, 0.05, 0.006), 0, -0.02, -0.088, k * PI / 3, 0, 0);
    P.add(ankle, metalM, new THREE.BoxGeometry(0.004, 0.006, 0.03), 0, -0.02, -0.07);
    return { hip, knee, ankle };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  // ---- duster skirt: six hinged panels, open front, split back, leather hem ----
  const R0 = 0.2, panels = [];
  const mkPanel = (phi, span, len) => {
    const pv = grp(hips, Math.sin(phi) * R0, -0.03, Math.cos(phi) * R0); pv.rotation.y = phi;
    const prof = (y) => R0 + 0.12 * Math.pow(-y / 0.8, 0.85);
    const shape = (geo) => { const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), a = Math.atan2(x, pa.getZ(i)) / (span / 2);
      if (y < -len + 0.04 + 1e-4) pa.setY(i, y - 0.025 * (1 - a * a));
      const fold = 1 + 0.07 * Math.sin(a * span * 8 + phi * 5) * sat(-y / len) ** 1.2; pa.setX(i, x * fold); pa.setZ(i, pa.getZ(i) * fold); } geo.computeVertexNormals(); };
    const pts = []; for (let k = 0; k <= 7; k++) { const y = -len + k / 7 * len; pts.push([prof(y), y]); }
    const cg = K.lathe(pts, 8, -span / 2, span); shape(cg); P.add(pv, coatM, cg, 0, 0, -R0);
    const hy = -len, hg = K.lathe([[prof(hy) + 0.004, hy], [prof(hy + 0.04) + 0.004, hy + 0.04]], 8, -span / 2, span); shape(hg); P.add(pv, leatherM, hg, 0, 0, -R0);
    panels.push({ pv, phi, spr: K.spring(65, 7.5) });
  };
  mkPanel(0.64, 0.62, 0.74); mkPanel(-0.64, 0.62, 0.74);
  mkPanel(1.43, 0.98, 0.8); mkPanel(-1.43, 0.98, 0.8);
  mkPanel(2.53, 1.08, 0.86); mkPanel(-2.53, 1.08, 0.86);

  // ---- revolver, built along +z with the grip at the origin ----
  const weapon = grp(armR.hand, 0, -0.035, 0.012), wtip = new THREE.Object3D();
  const BY = 0.088; // barrel axis height (in line with the top chamber)
  P.add(weapon, pearlM, new THREE.CapsuleGeometry(0.018, 0.07, 4, 8), 0, -0.04, -0.028, 0.42, 0, 0, 0.9, 1, 1.45);
  P.add(weapon, metalM, new THREE.SphereGeometry(0.02, 8, 6), 0, -0.083, -0.048, 0, 0, 0, 0.9, 0.6, 1.3);
  P.add(weapon, metalM, new THREE.TorusGeometry(0.009, 0.0025, 4, 10), 0, -0.098, -0.056, 0, PI / 2, 0);
  for (const s of [1, -1]) { P.add(weapon, metalM, hexG(0.011, 0.004).rotateY(PI / 2), s * 0.0165, -0.042, -0.03); P.add(weapon, glowM, hexG(0.005, 0.003).rotateY(PI / 2), s * 0.019, -0.042, -0.03); }
  P.add(weapon, gunM, new THREE.BoxGeometry(0.034, 0.03, 0.06), 0, 0.012, -0.012, 0.25, 0, 0); // grip frame
  P.add(weapon, gunM, new THREE.BoxGeometry(0.04, 0.078, 0.026), 0, 0.06, -0.012); // recoil shield
  P.add(weapon, gunM, new THREE.BoxGeometry(0.03, 0.014, 0.112), 0, 0.112, 0.046); // top strap
  P.add(weapon, gunM, new THREE.BoxGeometry(0.03, 0.016, 0.1), 0, 0.01, 0.046); // bottom strap
  P.add(weapon, gunM, new THREE.BoxGeometry(0.04, 0.07, 0.022), 0, 0.068, 0.1); // front of the frame
  P.add(weapon, gunM, new THREE.CylinderGeometry(0.017, 0.017, 0.35, 8), 0, BY, 0.27, PI / 2, 0, PI / 8);
  P.add(weapon, gunM, new THREE.CylinderGeometry(0.009, 0.009, 0.2, 8), 0, BY - 0.026, 0.2, PI / 2, 0, 0);
  P.add(weapon, gunM, new THREE.BoxGeometry(0.005, 0.02, 0.026), 0, BY + 0.024, 0.425);
  P.add(weapon, metalM, new THREE.TorusGeometry(0.0165, 0.004, 5, 12), 0, BY, 0.444);
  for (const z of [0.125, 0.3]) P.add(weapon, metalM, new THREE.TorusGeometry(0.018, 0.0035, 4, 12), 0, BY, z);
  for (const s of [1, -1]) { P.add(weapon, metalM, new THREE.BoxGeometry(0.002, 0.006, 0.07), s * 0.0205, 0.068, 0.068); P.add(weapon, metalM, new THREE.BoxGeometry(0.002, 0.04, 0.006), s * 0.0205, 0.06, -0.012);
    P.add(weapon, metalM, new THREE.BoxGeometry(0.002, 0.005, 0.2), s * 0.0172, BY - 0.004, 0.27); }
  P.add(weapon, barrelM, new THREE.BoxGeometry(0.0045, 0.004, 0.27), 0, BY + 0.0175, 0.27);
  P.add(weapon, metalM, new THREE.TorusGeometry(0.022, 0.0035, 4, 12, PI * 1.25), 0, 0.0, 0.03, 0, PI / 2, PI * 0.88);
  P.add(weapon, gunM, new THREE.BoxGeometry(0.006, 0.026, 0.008), 0, -0.004, 0.026, 0.3, 0, 0);
  const hammer = grp(weapon, 0, 0.095, -0.024);
  P.add(hammer, gunM, new THREE.BoxGeometry(0.012, 0.036, 0.014), 0, 0.014, -0.004); P.add(hammer, gunM, new THREE.BoxGeometry(0.016, 0.008, 0.022), 0, 0.032, -0.014, 0.4, 0, 0);
  // crane and drum: the crane pivots about an axis along the barrel at the drum's lower left, swinging the drum out to the left
  const crane = grp(weapon, 0.03, 0.022, 0.046), drum = grp(crane, -0.03, 0.038, 0);
  P.add(drum, gunM, new THREE.CylinderGeometry(0.045, 0.045, 0.084, 18), 0, 0, 0, PI / 2, 0, 0);
  P.add(drum, gunM, new THREE.CylinderGeometry(0.039, 0.045, 0.01, 18), 0, 0, 0.045, PI / 2, 0, 0);
  P.add(drum, metalM, new THREE.CylinderGeometry(0.008, 0.008, 0.1, 8), 0, 0, 0.004, PI / 2, 0, 0);
  P.add(crane, gunM, new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), 0, 0, 0.0, PI / 2, 0, 0);
  // the six chambers: one instance each (a mouth through the drum, showing on both faces, and a lit flute on its side)
  const slotM = W.glow(0xffffff, 2.3), RC = { L: new THREE.Color(0xffd890), S: new THREE.Color(0xc89cff), V: new THREE.Color(0x5cff9a) }, DARK = new THREE.Color(0x050406);
  const slotGeo = K.merge([new THREE.BoxGeometry(0.016, 0.016, 0.091).translate(0, 0.027, 0), new THREE.BoxGeometry(0.011, 0.006, 0.058).translate(0, 0.0445, 0)]);
  const slots = new THREE.InstancedMesh(slotGeo, slotM, 6); slots.frustumCulled = false;
  { const m = new THREE.Matrix4(); for (let k = 0; k < 6; k++) { slots.setMatrixAt(k, m.makeRotationZ(k * PI / 3)); slots.setColorAt(k, DARK); } }
  drum.add(slots);
  const glowCol = glowC.clone().lerp(new THREE.Color(1, 1, 1), 0.15).multiplyScalar(0.8);
  // salve vials on the bandolier
  const vialM = W.glow(0xffffff, 1.1), vials = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.0115, 0.032, 3, 6), vialM, 6); vials.frustumCulled = false;
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.9)), sc = new V3(1, 1, 1);
    vialAt.forEach(([x, y, z], k) => { vials.setMatrixAt(k, m.compose(new V3(x, y, z), q, sc)); vials.setColorAt(k, RC.V); }); }
  torso.add(vials);
  // muzzle flash and the Last Word ring
  const flashM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(K.merge([new THREE.ConeGeometry(0.05, 0.22, 8, 1, true).rotateX(PI / 2).translate(0, 0, 0.11), new THREE.ConeGeometry(0.03, 0.12, 6, 1, true).rotateX(PI / 2).rotateZ(PI / 6).scale(2.2, 0.35, 1).translate(0, 0, 0.04),
    new THREE.SphereGeometry(0.03, 8, 6)]), flashM);
  flash.position.set(0, BY, 0.45); flash.visible = false; weapon.add(flash);
  const lwM = new THREE.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(2.2), transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const lw = new THREE.Mesh(K.merge([hexRing(0.034, 0.041), hexRing(0.05, 0.054).rotateZ(PI / 6)]), lwM); lw.position.set(0, BY, 0.39); lw.visible = false; weapon.add(lw);
  wtip.position.set(0, BY, 0.45); weapon.add(wtip);
  P.finish();
  const aura = new THREE.PointLight(C.glow, 1.3, 7, 1.5); aura.position.set(0, 1.2, 0.8); g.add(aura);

  const A = { run: 0, swing: 0, swingDur: 0.2, swingKind: 0, cast: 0, lean: 0, aim: 0, load: 0, spin: 0, tw: 0, air: 0, vx: 0, vz: 0, lx: null, lz: null,
    fireEv: false, pFront: 'L', pArmed: false, pLoad: 0, pAim: 0, loadHold: 0, push: 0, spinT: 0, twT: 0, kick: 0, kickV: 0, flash: 0, fan: 0, last: 0,
    drum: 0, drumK: 26, hammer: 0, crane: 0, ember: 0, heal: 0 };
  const flashCol = new THREE.Color(), emberCol = new THREE.Color(), _c = new THREE.Color();
  const _v = new V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler(), _ik = { rx: 0, ry: 0, rz: 0, re: 0 };
  const _d = new V3(), _v0 = new V3(), _el = new V3(), _pl = new V3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eu = new THREE.Euler();
  // two-bone reach: the hand of `arm` to (tx, ty, tz) in torso space, the elbow swung toward the pole (px, py, pz); shoulder euler and elbow bend in _ik
  function ik(arm, tx, ty, tz, px, py, pz) {
    let dx = tx - arm.sh.position.x, dy = ty - arm.sh.position.y, dz = tz - arm.sh.position.z; const d0 = Math.hypot(dx, dy, dz) || 1e-4, d = clamp(d0, 0.1, UA + FA - 0.004), k = d / d0; dx *= k; dy *= k; dz *= k;
    const e = -(PI - Math.acos(clamp((UA * UA + FA * FA - d * d) / (2 * UA * FA), -1, 1))), y0 = -UA - FA * Math.cos(e), z0 = -FA * Math.sin(e);
    _d.set(dx, dy, dz).normalize(); _qa.setFromUnitVectors(_v0.set(0, y0, z0).normalize(), _d);
    _el.set(0, -1, 0).applyQuaternion(_qa); _el.addScaledVector(_d, -_el.dot(_d)); _pl.set(px, py, pz).normalize(); _pl.addScaledVector(_d, -_pl.dot(_d));
    if (_el.lengthSq() > 1e-6 && _pl.lengthSq() > 1e-6) _qa.premultiply(_qb.setFromAxisAngle(_d, Math.atan2(_d.dot(_v0.crossVectors(_el, _pl)), _el.dot(_pl))));
    _eu.setFromQuaternion(_qa, "XYZ"); _ik.rx = _eu.x; _ik.ry = _eu.y; _ik.rz = _eu.z; _ik.re = e; return _ik;
  }
  // a point given in gun space, in torso space (matrices must be current)
  const gunPt = (o, x, y, z) => torso.worldToLocal(o.localToWorld(_v.set(x, y, z)));

  function update(dt, p) {
    dt = Math.min(dt, 0.1); const t = G.now;
    const spd = p.moveSpeed || 0, grounded = p.grounded !== false, moving = spd > 0.5 && grounded;
    const wp = g.position, f = g.rotation.y;
    if (A.lx !== null && dt > 0) { const dx = wp.x - A.lx, dz = wp.z - A.lz; if (dx * dx + dz * dz < 2.5) { A.vx = damp(A.vx, (dx * Math.cos(f) - dz * Math.sin(f)) / dt, 12, dt); A.vz = damp(A.vz, (dx * Math.sin(f) + dz * Math.cos(f)) / dt, 12, dt); } }
    A.lx = wp.x; A.lz = wp.z;
    A.lean = damp(A.lean, moving ? Math.min(1, spd / 7) : 0, 9, dt);
    A.run += dt * spd * 1.55; const ph = A.run, s = Math.sin(ph), c = Math.cos(ph), L = A.lean;
    A.air = damp(A.air, grounded ? 0 : 1, 12, dt);
    const cyl = Array.isArray(p.cyl) ? p.cyl : null, loadT = p.loadT || 0, aimT = p.aimT || 0;
    // ---- events: a shot (swing 4, or the aim timer jumping for a stand-in), a round loaded (load timer 0.3), a Spin (0.18) ----
    if (!cyl && aimT > A.pAim + 0.2) A.fireEv = true;
    if (A.fireEv) { A.fireEv = false; const r = cyl ? A.pFront : 'L', last = !!(cyl && A.pArmed && !p.armed);
      if (r === 'V') { A.twT = 0.7; A.heal = 1; } else { A.kick = 0.05; A.kickV = last ? 24 : 14; A.flash = 1; flashCol.copy(RC[r] || glowCol); A.fan = 1; A.last = last ? 1 : 0;
        if (last) for (const q of panels) q.spr.v -= 5; }
      A.drum += PI / 3; A.drumK = 30; A.hammer = 1; A.ember = 1; emberCol.copy(RC[r] || glowCol); }
    if (loadT > A.pLoad + 0.05) { if (loadT > 0.24) { A.loadHold = 0.55; A.push = 1; } else { A.spinT = 0.42; A.drum += PI / 3 + TAU * 2; A.drumK = 6; } }
    A.pLoad = loadT; A.pAim = aimT; A.pFront = cyl ? cyl[0] : 'L'; A.pArmed = !!p.armed;
    A.loadHold = Math.max(0, A.loadHold - dt); A.spinT = Math.max(0, A.spinT - dt); A.twT = Math.max(0, A.twT - dt);
    A.push = Math.max(0, A.push - dt / 0.22); A.fan = Math.max(0, A.fan - dt / 0.16); A.flash = Math.max(0, A.flash - dt / 0.07); A.ember = Math.max(0, A.ember - dt / 0.7); A.heal = Math.max(0, A.heal - dt / 0.9); A.last = Math.max(0, A.last - dt / 0.5);
    // recoil: a kicked spring back to rest
    A.kickV -= (A.kick * 260 + A.kickV * 22) * dt; A.kick = Math.max(-0.1, A.kick + A.kickV * dt); if (A.kick < 0.002 && Math.abs(A.kickV) < 0.05) A.kick = A.kickV = 0;
    const TW = A.twT > 0 ? smooth(Math.min(1, A.twT / 0.12)) * smooth(Math.min(1, (0.7 - A.twT) / 0.08)) : 0;
    A.tw = damp(A.tw, TW > 0 ? 1 : 0, 16, dt);
    A.aim = damp(A.aim, aimT > 0 && A.twT <= 0 ? 1 : 0, 18, dt); A.load = damp(A.load, A.loadHold > 0 ? 1 : 0, 14, dt); A.spin = damp(A.spin, A.spinT > 0 ? 1 : 0, 18, dt);
    A.cast = damp(A.cast, p.casting ? 1 : 0, 10, dt);
    const AW = A.aim * (1 - A.load) * (1 - A.spin), LW = A.load * (1 - A.spin), SW = A.spin, TWW = A.tw;
    const br = Math.sin(t * 1.6);

    // ---- base: a cocked-hip idle blended into the run ----
    const I = 1 - L;
    hips.position.set(-0.018 * I, 0.95 + br * 0.005 + L * (Math.abs(c) * 0.06 - 0.032), 0);
    hips.rotation.set(0, s * 0.18 * L + 0.1 * AW, 0.045 * I + Math.sin(t * 0.5) * 0.01 * I);
    body.rotation.set(0.04 + L * 0.17, 0, 0); body.position.set(0, 0, 0);
    torso.rotation.set(0.03 + br * 0.01 + L * 0.05, -s * 0.22 * L - 0.12 * I + 0.25 * AW, -0.05 * I);
    head.rotation.set(0.08 - L * 0.12, (Math.sin(t * 0.33) * 0.12 + 0.1) * I + s * 0.08 * L - 0.38 * AW, 0.04 * I);
    let tl = lerp(-0.08, -s * 0.74, L), tr = lerp(0.1, s * 0.74, L), zl = 0.1 * I, zr = -0.035 * I;
    const kc = Math.cos(ph - 0.45); let kl = lerp(0.12, 0.12 + Math.pow(Math.max(0, kc), 1.5) * 1.05, L), kr = lerp(0.03, 0.12 + Math.pow(Math.max(0, -kc), 1.5) * 1.05, L);
    if (AW > 0.01) { const q = AW * I; tl = lerp(tl, -0.16, q); tr = lerp(tr, 0.14, q); zl = lerp(zl, 0.13, q); zr = lerp(zr, -0.1, q); kl = lerp(kl, 0.14, q); kr = lerp(kr, 0.1, q); }
    if (LW + SW > 0.01) { const q = (LW + SW) * I; head.rotation.x += 0.36 * q; head.rotation.y += 0.18 * q; torso.rotation.x += 0.06 * q; }
    // right arm and gun (gun pitch/yaw/roll in model space); left arm FK
    let rx = lerp(-0.06, -0.38 - s * 0.22, L), rz = lerp(-0.17, -0.12, L), re = lerp(-0.3, -1.05, L), gb = lerp(-1.3, -0.55, L), ga = lerp(-0.12, 0, L), gr = 0;
    let lx = lerp(-0.1, s * 0.62, L), lz = 0.12 + 0.03 * L, le = lerp(-0.5, -0.8, L);
    let ry = 0, ly = 0; const reachR = (w, x, y, z, px, py, pz) => { if (w < 0.002) return; ik(armR, x, y, z, px, py, pz); rx = lerp(rx, _ik.rx, w); ry = lerp(ry, _ik.ry, w); rz = lerp(rz, _ik.rz, w); re = lerp(re, _ik.re, w); };
    if (AW > 0.002) { const k = A.kick; reachR(AW, -0.3, 0.5 + k * 0.07, 0.52 - k * 0.09, -0.4, -1, 0); gb = lerp(gb, 0.02 + k * (0.75 + A.last * 0.35), AW); ga = lerp(ga, -0.02, AW); gr = lerp(gr, 0, AW);
      torso.rotation.x -= k * 0.08 * AW; body.rotation.x -= k * 0.04 * A.last; }
    if (LW > 0.002) { reachR(LW, 0.05, 0.3, 0.3, -1, -0.7, -0.2); gb = lerp(gb, 0.85, LW); ga = lerp(ga, 0.62, LW); gr = lerp(gr, 0.55, LW); }
    if (SW > 0.002) { const u = 1 - A.spinT / 0.42; reachR(SW, -0.04, 0.31, 0.36, -1, -0.8, 0); gb = lerp(gb, 0.18, SW); ga = lerp(ga, 0.4, SW); gr = lerp(gr, 1.05 + Math.sin(sat(u * 3) * PI) * 0.25, SW); }
    if (TWW > 0.002) { reachR(TWW, -0.4, 0.4, 0.3, -0.5, -1, -0.2); gb = lerp(gb, 0.15, TWW); ga = lerp(ga, -0.5, TWW); gr = lerp(gr, 0, TWW); torso.rotation.y -= 0.15 * TWW; }
    if (A.cast > 0.01) { reachR(A.cast, -0.05, 0.62, 0.36, -1, -0.5, 0); gb = lerp(gb, 1.2, A.cast); }
    // ---- airborne: tuck, arms out ----
    if (A.air > 0.01) { const q = A.air; tl = lerp(tl, -0.8, q); tr = lerp(tr, -0.15, q); kl = lerp(kl, 1.2, q); kr = lerp(kr, 0.6, q); lz = lerp(lz, 0.6, q); lx = lerp(lx, -0.4, q); le = lerp(le, -0.6, q);
      if (AW + LW + SW + TWW < 0.1) { rz = lerp(rz, -0.5, q); rx = lerp(rx, -0.5, q); gb = lerp(gb, -0.2, q); } }
    if (p.pose === 'fall') { body.rotation.x = 1.28 + Math.sin(t * 2.3) * 0.05 + L * 0.12; body.position.set(0, 0.75, -0.95); body.rotation.z = Math.sin(t * 1.7) * 0.05;
      tl = 0.25 + Math.sin(t * 5) * 0.05; tr = 0.25 - Math.sin(t * 5) * 0.05; kl = kr = 0.7; if (AW + LW + SW + TWW < 0.05) { lx = rx = -2.3; lz = 0.75; rz = -0.75; le = re = -0.5; gb = 0.3; } }
    if (p.flashT > 0) { const q = p.flashT / 0.15; torso.rotation.x -= 0.14 * q; head.rotation.x -= 0.1 * q; }
    // ---- apply legs and the gun arm ----
    legL.hip.rotation.set(tl, 0, zl); legR.hip.rotation.set(tr, 0, zr); legL.knee.rotation.x = kl; legR.knee.rotation.x = kr;
    const tilt = body.rotation.x + hips.rotation.x;
    legL.ankle.rotation.x = clamp(-(tl + kl + tilt) * 0.85 + (L > 0.2 ? Math.max(0, -s) * 0.35 * L : 0), -0.9, 0.9); legR.ankle.rotation.x = clamp(-(tr + kr + tilt) * 0.85 + (L > 0.2 ? Math.max(0, s) * 0.35 * L : 0), -0.9, 0.9);
    armR.sh.rotation.set(rx, ry, rz); armR.el.rotation.x = re;
    // the gun's orientation is given in model space: undo the chain above the hand. A salve shot twirls it round the trigger finger.
    _q.copy(body.quaternion).multiply(hips.quaternion).multiply(torso.quaternion).multiply(armR.sh.quaternion).multiply(armR.el.quaternion).invert();
    _q2.setFromEuler(_e.set(-gb, ga, gr, 'YXZ')); if (A.twT > 0) { const u = 1 - A.twT / 0.7; _q2.multiply(_q3.setFromAxisAngle(_v.set(1, 0, 0), -(1 - Math.pow(1 - u, 2.2)) * TAU * 2)); }
    weapon.quaternion.copy(_q).multiply(_q2);
    // drum, crane, hammer
    A.drum = damp(A.drum, 0, A.drumK, dt); drum.rotation.z = A.drum;
    A.crane = damp(A.crane, LW > 0.3 ? 1 : 0, 16, dt); crane.rotation.z = -1.35 * A.crane;
    A.hammer = Math.max(0, A.hammer - dt / 0.14); hammer.rotation.x = -0.75 * (1 - A.hammer) * (AW > 0.3 ? 1 : 0.2);
    // ---- off hand: thumb in the belt at rest, fanning the hammer while aiming, thumbing rounds in, slapping the drum round, tipping the hat ----
        const reachL = (w, x, y, z, px, py, pz) => { if (w < 0.002) return; ik(armL, x, y, z, px, py, pz); lx = lerp(lx, _ik.rx, w); ly = lerp(ly, _ik.ry, w); lz = lerp(lz, _ik.rz, w); le = lerp(le, _ik.re, w); };
    reachL(I * (1 - AW) * (1 - LW) * (1 - SW) * (1 - TWW) * (1 - A.air) * (p.pose === 'fall' ? 0 : 1), 0.13, 0.08, 0.15, 1, -0.3, -0.8);
    if (AW + LW + SW > 0.01) { g.updateMatrixWorld(true);
      if (AW > 0.01) { const u = 1 - A.fan, sw = Math.sin(u * PI) * (A.fan > 0 ? 1 : 0); const q = gunPt(hammer, 0.035 - sw * 0.02, 0.07 - sw * 0.03, -0.06 + (A.fan > 0 ? u * 0.12 : 0)); reachL(AW * (1 - L * 0.4), q.x, q.y, q.z, 0.6, -1, 0); }
      if (LW > 0.01) { const q = gunPt(drum, 0.0, 0.028, -0.1 + (A.push > 0 ? Math.sin(A.push * PI) * 0.035 : 0) - 0.02); reachL(LW, q.x + 0.02, q.y, q.z, 1, -0.8, 0); }
      if (SW > 0.01) { const u = sat((1 - A.spinT / 0.42) / 0.35); const q = gunPt(drum, 0.07 - u * 0.12, 0.06, -0.01); reachL(SW, q.x, q.y + 0.02, q.z, 1, -0.8, 0); } }
    if (TWW > 0.01) reachL(TWW, 0.19, 0.83, 0.28, 1, -0.4, 0);
    armL.sh.rotation.set(lx, ly, lz); armL.el.rotation.x = le;
    // ---- cloth ----
    const wind = (phi) => -(Math.sin(phi) * A.vx + Math.cos(phi) * A.vz) * 0.06;
    const flut = (phi, k) => Math.sin(t * k + phi * 3) * (0.05 * L + 0.015);
    for (const q of panels) {
      const fr = Math.cos(q.phi), sd = Math.sin(q.phi), legX = sd > 0 ? tl : tr;
      const push = fr > 0.3 ? Math.max(0, -legX) * 1.05 + 0.03 : fr < -0.3 ? Math.max(0, Math.max(tl, tr)) * 0.75 + 0.05 : Math.abs(legX) * 0.4 + 0.06 + 0.2 * Math.abs(sd > 0 ? zl : zr);
      const tgt = clamp(push + wind(q.phi) + flut(q.phi, 8) + A.air * 0.5 + A.last * 0.3, -0.05, 1.3);
      q.pv.rotation.x = -clamp(q.spr.step(tgt, dt), -0.05, 1.35);
    }
    const headTilt = tilt + torso.rotation.x + head.rotation.x;
    for (let k = 0; k < braid.length; k++) { const q = braid[k], tgt = (k === 0 ? 0.62 - headTilt : 0.05) + clamp(A.vz * 0.05, -0.1, 0.6) * (k ? 0.4 : 1) + A.air * 0.25 + Math.sin(t * 6 - k) * 0.04 * L;
      q.o.rotation.x = q.sx.step(tgt, dt); q.o.rotation.z = q.sz.step(-A.vx * 0.04 * (k ? 0.5 : 1) - (k === 0 ? head.rotation.z + hips.rotation.z : 0), dt); }
    const chestTilt = tilt + torso.rotation.x;
    for (const ch of tails) for (let k = 0; k < ch.length; k++) { const q = ch[k], tgt = (k === 0 ? -0.34 - chestTilt : 0.06) - clamp(A.vz * 0.06, -0.2, 0.9) * (k ? 0.5 : 1) - A.air * 0.4 + Math.sin(t * 8 - k * 1.3) * (0.08 * L + 0.02);
      q.o.rotation.x = q.sx.step(tgt, dt); q.o.rotation.z = q.sz.step(q.rz - A.vx * 0.05 + Math.sin(t * 5.3 + k) * 0.05 * L, dt); }
    charm.rotation.x = charmSpr[0].step(-(headTilt + hat.rotation.x) - A.vz * 0.04 + A.air * 0.3, dt); charm.rotation.z = charmSpr[1].step(-(head.rotation.z + hat.rotation.z) - A.vx * 0.04 + Math.sin(t * 7) * 0.08 * L, dt);
    // ---- chambers, vials, glows ----
    for (let k = 0; k < 6; k++) { const r = cyl ? cyl[k] : 'G';
      if (r) _c.copy(RC[r] || glowCol).multiplyScalar(k === 0 ? 1.25 : 0.8); else _c.copy(DARK);
      if (k === 5 && !r && A.ember > 0) _c.lerp(emberCol, A.ember * A.ember * 0.8);
      slots.setColorAt(k, _c); }
    slots.instanceColor.needsUpdate = true;
    const uses = p.sk && p.sk[6] ? p.sk[6].uses : 6;
    if (uses !== A.uses) { A.uses = uses; for (let k = 0; k < 6; k++) vials.setColorAt(k, k < uses ? RC.V : _c.setRGB(0.02, 0.04, 0.03)); vials.instanceColor.needsUpdate = true; }
    vialM.color.setScalar(1.1 + A.heal * 2.5);
    const streak = cyl && p.armed ? (p.streak | 0) : 0, lastUp = cyl && p.armed && streak === 5;
    barrelM.color.copy(barrelBase).multiplyScalar(0.55 + streak / 5 * 1.3 + A.flash * 1.5 + (lastUp ? 0.4 * Math.sin(t * 9) : 0));
    lwM.opacity = damp(lwM.opacity, lastUp ? 0.85 : 0, 10, dt); lw.visible = lwM.opacity > 0.02 && !G.headless; lw.rotation.z = t * 2.2; lw.scale.setScalar(1 + Math.sin(t * 9) * 0.08);
    glowM.color.copy(glowBase).multiplyScalar(0.88 + 0.12 * Math.sin(t * 2.1) + A.last * 0.8);
    sigM.color.copy(sigBase).multiplyScalar(0.8 + LW * 1.1 + SW * 1.4 + A.push * 0.8 + TWW * 0.6);
    flash.visible = A.flash > 0.02 && !G.headless; if (flash.visible) { flashM.color.copy(flashCol).multiplyScalar(1.6 + A.last * 1.5); flash.scale.set(1 + A.last, 1 + A.last, (0.5 + A.flash * 0.7) * (1 + A.last * 1.2)); flash.rotation.z = t * 37; }
    rimU.value.copy(rimBase).multiplyScalar(1 + A.flash * 0.6 + A.last * 1.5 + A.heal * 0.4);
    aura.intensity = 1.3 + A.flash * 2.5 + A.last * 5 + (p.flashT > 0 ? 5 : 0) + A.heal * 1.5;
  }
  return { group: g, update, anim: A, wtip, body, swing(kind = 0, dur = 0.2) { A.swing = A.swingDur = dur; A.swingKind = kind; if (kind === 4) A.fireEv = true; } };
};
