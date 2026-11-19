// ============================== HEXSLINGER ==============================
// A gunslinger witch: a wide cattleman brim under a low creased crown with hex studs and a hanging charm, a shadowed face
// behind a bandana mask with two lit eyes, a short braid, a three-panel scalloped mantle with a bone trim, a hex sigil and the
// scarf's tails down the back, an open duster on six hinged panels swinging as one skirt (teal vent at the back), a V-tapered
// vest crossed by a bandolier of salve vials (one goes dark per salve used), a slung gunbelt and
// holster, tall cuffed boots with spurs, and a long-barrelled revolver whose six chambers glow with the rounds actually loaded
// (lead gold, silver violet, salve green). The drum turns one chamber per shot, swings out to load, spins on Spin, and the
// barrel rune climbs toward the Last Word. Arms are placed by two-bone IK: the off hand rests on the hip in a bladed duelist
// stance (and on Spin), braces the gun wrist on the Last Word, fetches rounds from the bandolier into the open drum and touches
// the brim on a salve twirl; the revolver is aimed
// in body space. Three value groups: a dark hat and mask, a mid-value wine coat under a lighter mantle, and light accents (the
// pink scarf, bone gloves, a teal lining, brim binding and hem) under a cool rim light.
HERO_MODELS.hexslinger = function buildHexslinger(cls) {
  const C = cls.look, K = HeroKit, P = K.parts(), g = new THREE.Group();
  const or = (v, d) => v !== undefined ? v : d;
  const glowC = new THREE.Color(C.glow), clothC = new THREE.Color(C.cloth), armorC = new THREE.Color(C.armor);
  // tone(c, l, s, hue): c in sRGB HSL with lightness raised to at least l, saturation capped at s, hue pulled toward `hue` when near it
  const SRGB = THREE.SRGBColorSpace, _hsl = {};
  const tone = (c, l, s = 1, hue) => { const o = new THREE.Color(c); o.getHSL(_hsl, SRGB); let h = _hsl.h;
    if (hue !== undefined) { const dh = ((hue - h + 1.5) % 1) - 0.5; if (Math.abs(dh) < 0.12) h += dh * 0.7; }
    return o.setHSL((h + 1) % 1, Math.min(_hsl.s, s), Math.max(_hsl.l, l), SRGB); };
  const coatC = tone(C.cloth, 0.29, 0.48, 0.94), mantleC = tone(coatC, 0.41, 0.4), hatC = armorC.clone().multiplyScalar(0.72);
  const liningC = new THREE.Color(or(C.lining, 0x2fa69a)), scarfC = tone(glowC.clone().lerp(clothC, 0.1), 0, 1, 0.925); // a hot rose pink
  const rimBase = new THREE.Color(0xa8c8ff).multiplyScalar(0.6), rimU = { value: rimBase.clone() };
  const coatM = K.mat({ color: coatC, roughness: 0.62, side: THREE.DoubleSide }, rimU, 1.25, liningC.getHex());
  const capeM = K.mat({ color: mantleC, roughness: 0.66, side: THREE.DoubleSide }, rimU, 1.5, coatC.clone().multiplyScalar(0.5).getHex());
  const hatM = K.mat({ color: hatC, roughness: 0.74, side: THREE.DoubleSide }, rimU, 1.6, hatC.clone().multiplyScalar(0.6).getHex());
  const vestM = K.mat({ color: armorC.clone().lerp(clothC, 0.15), roughness: 0.55, metalness: 0.15 }, rimU, 0.6);
  const liningM = K.mat({ color: liningC, roughness: 0.66, side: THREE.DoubleSide }, rimU, 1.2);
  const scarfM = K.mat({ color: scarfC, roughness: 0.75, side: THREE.DoubleSide, emissive: scarfC, emissiveIntensity: 0.42 }, rimU, 0.6);
  const maskM = K.mat({ color: armorC.clone().multiplyScalar(0.6), roughness: 0.9 }, rimU, 0.5);
  const gloveM = K.mat({ color: 0xc2a580, roughness: 0.6 }, rimU, 0.7);
  const leatherM = K.mat({ color: or(C.leather, 0x2b1f1c), roughness: 0.58 }, rimU, 0.55);
  const legM = K.mat({ color: 0x1d1922, roughness: 0.85 }, rimU, 0.8);
  const metalM = K.mat({ color: or(C.metal, 0xc4bdd2), roughness: 0.26, metalness: 0.88, envMapIntensity: 1.5, emissive: or(C.metal, 0xc4bdd2), emissiveIntensity: 0.05 }, rimU, 0.9);
  const gunM = K.mat({ color: 0xc2c6d2, roughness: 0.3, metalness: 0.6, envMapIntensity: 1.6, emissive: 0x8a90a8, emissiveIntensity: 0.14 }, rimU, 1.1);
  const pearlM = K.mat({ color: 0xe9dbe8, roughness: 0.3, metalness: 0.1, emissive: 0xffe8fb, emissiveIntensity: 0.05 }, rimU, 0.6);
  const hairM =K.mat({ color: 0x1c1519, roughness: 0.55 }, rimU, 0.7);
  const glowM = W.glow(C.glow, 2.2), sigM = W.glow(C.glow, 2.0), barrelM = W.glow(C.glow, 1.6), eyeM = W.glow(glowC.clone().lerp(new THREE.Color(1, 1, 1), 0.45), 3.6);
  const glowBase = glowM.color.clone(), sigBase = sigM.color.clone(), barrelBase = barrelM.color.clone();
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  const warp = (geo, f) => { const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const r = f(pa.getX(i), pa.getY(i), pa.getZ(i)); pa.setXYZ(i, r[0], r[1], r[2]); } geo.computeVertexNormals(); return geo; };
  const hexG = (r, d) => new THREE.CylinderGeometry(r, r, d, 6).rotateX(PI / 2); // a flat hexagon facing +z
  const hexRing = (r0, r1) => new THREE.RingGeometry(r0, r1, 6, 1).rotateZ(PI / 6);

  // ---- skeleton ----
  const body = grp(g), hips = grp(body, 0, 0.95, 0), torso = grp(hips, 0, 0.02, 0), head = grp(torso, 0, 0.69, 0);
  const hat = grp(head, 0, 0.19, 0.0); hat.rotation.set(0.04, 0, -0.06);

  // ---- torso: vest with buttons, open duster with lapel facings, shirt collar, bandolier ----
  const TP = [[0.14, -0.08], [0.122, 0.06], [0.152, 0.2], [0.212, 0.36], [0.222, 0.48], [0.172, 0.59], [0.085, 0.67], [0.064, 0.72]]; // V taper: broad chest, cinched waist
  const rAt = (y) => { for (let i = 1; i < TP.length; i++) if (y <= TP[i][1]) { const [r0, y0] = TP[i - 1], [r1, y1] = TP[i]; return r0 + (r1 - r0) * sat((y - y0) / (y1 - y0)); } return TP[TP.length - 1][0]; };
  P.add(torso, vestM, K.lathe(TP, 20), 0, 0, 0, 0, 0, 0, 1, 1, 0.8);
  for (let k = 0; k < 5; k++) P.add(torso, metalM, new THREE.SphereGeometry(0.011, 8, 6), 0, 0.08 + k * 0.085, 0.152 + (k > 2 ? 0.002 : 0));
  P.add(torso, leatherM, new THREE.BoxGeometry(0.008, 0.1, 0.006), 0.07, 0.3, 0.15, 0, 0.35, 0.9); // watch chain hint
  const CP = TP.map(([r, y]) => [r * 1.07 + 0.006, y]);
  P.add(torso, coatM, K.lathe(CP.slice(0, 7), 22, 0.44, TAU - 0.88), 0, 0, 0, 0, 0, 0, 1, 1, 0.82);
  { // lapel facings: strips that widen toward the chest along both edges of the open front
    for (const s of [1, -1]) { const lg = K.lathe(CP.slice(1, 6).map(([r, y]) => [r + 0.006, y]), 4, 0, 0.3);
      warp(lg, (x, y, z) => { const a = Math.atan2(x, z), w = 0.25 + 0.75 * sat((y - 0.2) / 0.3), r = Math.hypot(x, z), aa = 0.44 + a * w; return [s * Math.sin(aa) * r, y, Math.cos(aa) * r]; });
      P.add(torso, liningM, lg, 0, 0, 0, 0, 0, 0, 1, 1, 0.83); } }
  // bandolier from the left shoulder to the right hip, hugging the tapered coat, with six vial loops on the front
  const band = (a) => { const y = 0.3 + 0.2825 * Math.sin(a) + (Math.cos(a) < 0 ? 0.03 : 0), r = rAt(y) * 1.07 + 0.006; return [Math.sin(a) * (r + 0.024), y, Math.cos(a) * (r * 0.82 + 0.014)]; };
  { const pts = []; for (let k = 0; k <= 40; k++) pts.push(band(k / 40 * TAU)); P.add(torso, leatherM, K.tube(pts, 0.017, 64, 5)); }
  const vialAt = []; for (let k = 0; k < 6; k++) { const a = -0.62 + k * 0.248, [x, y, z] = band(a); vialAt.push([x * 1.04, y, z + 0.022]);
    P.add(torso, leatherM, new THREE.BoxGeometry(0.03, 0.046, 0.012), x * 1.03, y, z + 0.012, 0, a * 0.8, 0.9);
    P.add(torso, metalM, new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8), x * 1.04 - Math.sin(0.9) * 0.03, y + Math.cos(0.9) * 0.03, z + 0.022, 0, 0, 0.9); }
  // hips: slung gunbelt with cartridge loops and a hex buckle
  P.add(hips, leatherM, new THREE.TorusGeometry(0.205, 0.024, 6, 30), 0, -0.01, 0, PI / 2, 0, 0.11, 1, 0.82, 1);
  for (let k = 0; k < 11; k++) { const a = 1.15 + k * 0.36, x = Math.sin(a) * 0.212, z = Math.cos(a) * 0.212 * 0.82; P.add(hips, metalM, new THREE.CylinderGeometry(0.0075, 0.0075, 0.034, 6), x, -0.012 - x * 0.11, z, 0, 0, -0.11); }
  P.add(hips, metalM, hexG(0.04, 0.014), 0, -0.01, 0.178); P.add(hips, glowM, hexRing(0.012, 0.022), 0, -0.01, 0.1865);

  // ---- mantle: open front, three panels (left, back, right) hinged at the collar so they lag on turns and lift on recoil and in
  // the air; a scalloped hem longer at the back with a bone trim, the hex sigil and two scarf tails down the back ----
  const MS = [1.24, 0.88], MP = [[0.33, 0.37], [0.325, 0.45], [0.305, 0.53], [0.27, 0.6], [0.2, 0.655], [0.12, 0.69], [0.098, 0.7]];
  const mHem = (a) => -0.07 * Math.max(0, -Math.cos(a)) + 0.018 * Math.cos(a * 9) + 0.035 * Math.pow(Math.abs(Math.sin(a)), 4);
  const mantle = [], _m4 = new THREE.Matrix4(), _eM = new THREE.Euler(), _qM = new THREE.Quaternion(), _sM = new V3(1, 1, 1), _pM = new V3();
  const onPanel = (pv, geo) => geo.translate(-pv.position.x, -pv.position.y, -pv.position.z).rotateY(-pv.rotation.y); // torso space -> panel space
  const addOn = (pv, mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { geo.applyMatrix4(_m4.compose(_pM.set(x, y, z), _qM.setFromEuler(_eM.set(rx, ry, rz)), _sM)); P.add(pv, mat, onPanel(pv, geo)); };
  const mkMantle = (a0, a1, rs = 1) => {
    const ac = (a0 + a1) / 2, sx = MS[0] * rs, sz = MS[1] * rs, pv = grp(torso, Math.sin(ac) * 0.11 * sx, 0.69, Math.cos(ac) * 0.11 * sz - 0.005); pv.rotation.order = 'YXZ'; pv.rotation.y = ac;
    const cg = K.lathe(MP, Math.max(6, Math.round((a1 - a0) * 6.5)), a0, a1 - a0);
    warp(cg, (x, y, z) => [x * sx, y < 0.375 ? y + mHem(Math.atan2(x, z)) : y, z * sz - 0.005]); P.add(pv, capeM, onPanel(pv, cg));
    const edge = []; for (let k = 0; k <= 12; k++) { const a = a0 + (a1 - a0) * k / 12; edge.push([Math.sin(a) * 0.333 * sx, 0.372 + mHem(a), Math.cos(a) * 0.333 * sz - 0.005]); }
    P.add(pv, gloveM, onPanel(pv, K.tube(edge, 0.0105, 22, 4)));
    const m = { pv, phi: ac, spr: K.spring(60, 6.5), sprZ: K.spring(40, 5) }; mantle.push(m); return m;
  };
  mkMantle(0.58, 2.28); mkMantle(TAU - 2.28, TAU - 0.58); const mB = mkMantle(2.22, TAU - 2.22, 1.012);
  { const tr = K.lathe([[0.1, 0.672], [0.104, 0.705]], 30, 0.58, TAU - 1.16); P.add(torso, liningM, tr, 0, 0, -0.005, 0, 0, 0, MS[0], 1, MS[1]); }
  addOn(mB.pv, glowM, hexRing(0.04, 0.05), 0, 0.47, -0.299, 0.26, PI, 0); addOn(mB.pv, glowM, hexRing(0.012, 0.018), 0, 0.47, -0.3, 0.26, PI, 0);
  // the scarf's back tails: two strips lying over the mantle from the collar, then a free end swinging below its hem
  const strip = (x, y0, z0, y1, z1, w) => { const dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dy, dz); return new THREE.BoxGeometry(w, len + 0.012, 0.008).translate(0, -len / 2, 0).rotateX(Math.atan2(-dz, -dy)).translate(x, y0, z0); };
  for (const s of [1, -1]) { addOn(mB.pv, scarfM, strip(s * 0.05, 0.7, -0.13, 0.6, -0.27, 0.05)); addOn(mB.pv, scarfM, strip(s * 0.056, 0.6, -0.27, 0.4, -0.32, 0.054)); }
  const bTail = grp(mB.pv), bTailS = [K.spring(46, 5), K.spring(36, 5)]; bTail.position.set(0, 0.4, -0.32).sub(mB.pv.position).applyAxisAngle(new V3(0, 1, 0), -mB.phi);
  { const w = 0.054, L = 0.24, sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0.01), new THREE.Vector2(w / 2, 0.01), new THREE.Vector2(w / 2, -L), new THREE.Vector2(0, -L + 0.04), new THREE.Vector2(-w / 2, -L)]);
    for (const s of [1, -1]) P.add(bTail, scarfM, new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }), s * 0.058, 0, -0.004, 0, 0, s * -0.05); }

  // ---- head: shadowed face, eyes, bandana mask, hair ----
  P.add(head, maskM, new THREE.SphereGeometry(0.1, 14, 10), 0, 0.115, 0.012, 0, 0, 0, 0.94, 1.08, 1);
  P.add(head, hairM, new THREE.SphereGeometry(0.106, 14, 10), 0, 0.13, -0.016, 0, 0, 0, 1, 1, 1);
  // eye slits stand proud of the face so they stay lit from any angle
  for (const s of [1, -1]) P.add(head, eyeM, new THREE.BoxGeometry(0.038, 0.012, 0.02), s * 0.036, 0.132, 0.11, 0, s * 0.3, s * -0.16);
  P.add(head, maskM, K.lathe([[0.104, -0.03], [0.112, 0.02], [0.113, 0.07], [0.106, 0.095]], 12, -1.45, 2.9), 0, 0, 0.008);
  P.add(torso, scarfM, new THREE.TorusGeometry(0.083, 0.038, 8, 18), 0, 0.665, 0.004, PI / 2, 0, 0, 1, 0.92, 1);
  { const sh = new THREE.Shape([new THREE.Vector2(-0.09, 0), new THREE.Vector2(0.09, 0), new THREE.Vector2(0.01, -0.19)]);
    P.add(torso, scarfM, new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }), 0, 0.66, 0.112, -0.32, 0, 0); }

  // ---- hat: cattleman brim curled up at the sides, a tall crown that droops back to a crumpled point, band, studs, concho ----
  { const bg = K.lathe([[0.12, 0.007], [0.24, 0.006], [0.36, 0.004], [0.372, 0.0], [0.36, -0.004], [0.24, -0.006], [0.12, -0.007]], 36);
    warp(bg, (x, y, z) => { const r = Math.hypot(x, z), a = Math.atan2(x, z), u = sat((r - 0.16) / 0.21), sa = Math.sin(a), ca = Math.cos(a);
      return [x, y + u * u * (0.105 * sa * sa - (ca > 0 ? 0.02 : 0.014) * ca * ca), z * 1.07]; });
    P.add(hat, hatM, bg);
    const edge = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * TAU, sa = Math.sin(a), ca = Math.cos(a); edge.push([sa * 0.368, 0.105 * sa * sa - (ca > 0 ? 0.02 : 0.014) * ca * ca, ca * 0.368 * 1.07]); }
    P.add(hat, liningM, K.tube(edge, 0.008, 72, 4)); // pale binding: the brim edge catches the rim at play distance
    // a low cattleman crown: a centre crease front to back, two pinched dents at the front, the top dipping toward the brim's front
    const cg = K.lathe([[0.128, -0.01], [0.131, 0.05], [0.127, 0.1], [0.12, 0.142], [0.11, 0.176], [0.092, 0.196], [0.066, 0.204], [0.036, 0.207], [0.0, 0.208]], 24);
    warp(cg, (x, y, z) => { const u = sat((y - 0.07) / 0.13), a = Math.atan2(x, z), top = sat((y - 0.17) / 0.03);
      const dent = Math.exp(-Math.pow((Math.abs(a) - 0.62) / 0.36, 2)) * u * u, w = 1 - 0.2 * dent;
      return [x * w, y - 0.05 * top * Math.exp(-(x * x) / (0.05 * 0.05)) - 0.022 * u * sat(z / 0.13), z * w]; });
    P.add(hat, hatM, cg);
    P.add(hat, scarfM, K.lathe([[0.1345, 0.0], [0.1368, 0.03], [0.1352, 0.062]], 24)); // a broad band: reads all round from the play camera
    P.add(hat, metalM, hexG(0.026, 0.008), Math.sin(0.45) * 0.137, 0.026, Math.cos(0.45) * 0.137, 0, 0.45, 0); P.add(hat, glowM, hexG(0.012, 0.004), Math.sin(0.45) * 0.142, 0.026, Math.cos(0.45) * 0.142, 0, 0.45, 0);
    for (const a of [-0.55, 1.35, 2.25, -2.25, 3.14]) P.add(hat, glowM, hexG(0.009, 0.004), Math.sin(a) * 0.138, 0.026, Math.cos(a) * 0.138, 0, a, 0); }
  // charm hanging off the left of the brim
  const charm = grp(hat, 0.33, 0.055, 0.03), charmSpr = [K.spring(60, 5), K.spring(60, 5)];
  P.add(charm, metalM, new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4), 0, -0.035, 0);
  P.add(charm, metalM, hexG(0.022, 0.006), 0, -0.085, 0, 0, PI / 2, 0); P.add(charm, glowM, hexRing(0.007, 0.013).rotateY(PI / 2), 0.004, -0.085, 0);
  // braid down the back, ending in a silver ring and a lit bead
  const braid = []; { let par = grp(head, 0, 0.06, -0.098);
    for (let k = 0; k < 2; k++) { const seg = grp(par, 0, k ? -0.085 : 0, 0), r = 0.03 - k * 0.004;
      for (let j = 0; j < 3; j++) P.add(seg, hairM, new THREE.SphereGeometry(r, 8, 6), (j % 2 ? 0.006 : -0.006), -0.014 - j * 0.028, 0, 0, 0, 0, 1, 0.9, 0.85);
      if (k === 1) { P.add(seg, metalM, new THREE.TorusGeometry(0.02, 0.006, 4, 12), 0, -0.088, 0, PI / 2, 0, 0); P.add(seg, glowM, new THREE.OctahedronGeometry(0.018), 0, -0.11, 0, 0, 0, 0, 1, 1.3, 1); }
      braid.push({ o: seg, sx: K.spring(70 - k * 10, 7), sz: K.spring(60, 7) }); par = seg; } }
  // scarf tails knotted at the left of the neck, over the chest
  const tails = [[]]; { let par = grp(torso, 0.05, 0.655, 0.105); // one chain carries both: the long tail in three links, the short one stiff on the first
    for (let k = 0; k < 3; k++) { const seg = grp(par, 0, k ? -0.16 : 0, 0); P.add(seg, scarfM, new THREE.BoxGeometry(0.058 - k * 0.006, 0.164, 0.008), 0, -0.08, 0);
      if (!k) P.add(seg, scarfM, new THREE.BoxGeometry(0.046, 0.3, 0.008), 0.065, -0.147, 0.004, 0, 0, 0.2);
      tails[0].push({ o: seg, sx: K.spring(48 - k * 8, 5), sz: K.spring(36, 5), rz: k ? 0 : 0.12 }); par = seg; } }

  // ---- arms: duster sleeves, gauntlet gloves; the left glove carries a sigil ----
  const UA = 0.29, FA = 0.275;
  const mkArm = (side) => {
    const sh = grp(torso, side * 0.262, 0.55, -0.01);
    P.add(sh, coatM, new THREE.SphereGeometry(0.066, 12, 8), side * 0.004, -0.012, 0, 0, 0, 0, 1, 0.95, 1);
    P.add(sh, coatM, K.lathe([[0.064, -0.3], [0.07, -0.2], [0.076, -0.08], [0.08, 0.02]], 12));
    const el = grp(sh, 0, -UA, 0);
    P.add(el, coatM, K.lathe([[0.056, -0.15], [0.06, -0.06], [0.064, 0.02]], 12));
    P.add(el, gloveM, K.lathe([[0.046, -0.26], [0.052, -0.2], [0.074, -0.17], [0.08, -0.105], [0.066, -0.1]], 12));
    P.add(el, gloveM, new THREE.TorusGeometry(0.075, 0.007, 4, 16), 0, -0.17, 0, PI / 2, 0, 0); // stitched cuff edge
    const hand = grp(el, 0, -FA, 0);
    // a mitten: flat across the palm, tapering to the fingertips and curled a little toward the palm, with a separate thumb
    { const mg = K.lathe([[0.0, -0.124], [0.013, -0.12], [0.026, -0.108], [0.035, -0.086], [0.039, -0.056], [0.039, -0.028], [0.034, -0.006], [0.03, 0.006]], 10);
      warp(mg, (x, y, z) => [x * 0.74 - side * 1.6 * y * y, y, z * 1.06 + 0.006]); P.add(hand, gloveM, mg);
      P.add(hand, gloveM, new THREE.CapsuleGeometry(0.0155, 0.042, 3, 6), side * -0.021, -0.042, 0.04, -0.5, 0, side * 0.32); }
    if (side > 0) { P.add(hand, sigM, hexRing(0.011, 0.019).rotateY(PI / 2), 0.031, -0.045, 0.008); P.add(el, sigM, new THREE.BoxGeometry(0.004, 0.05, 0.004), 0.08, -0.14, 0); }
    return { sh, el, hand, side };
  };
  const armL = mkArm(1), armR = mkArm(-1);

  // ---- legs: trousers, holster on the right thigh, tall cuffed boots, spurs ----
  const mkLeg = (side) => {
    const hip = grp(hips, side * 0.1, -0.02, 0);
    P.add(hip, legM, K.lathe([[0.066, -0.45], [0.074, -0.3], [0.09, -0.12], [0.095, 0.02]], 12));
    if (side < 0) { P.add(hip, leatherM, new THREE.BoxGeometry(0.04, 0.2, 0.085), -0.098, -0.14, 0.01, 0.06, 0, -0.08); P.add(hip, leatherM, new THREE.BoxGeometry(0.044, 0.014, 0.089), -0.099, -0.06, 0.01, 0.06, 0, -0.08);
      P.add(hip, leatherM, new THREE.TorusGeometry(0.083, 0.008, 4, 16), 0, -0.25, 0, PI / 2, 0, 0); }
    // tall boots, ~1.4x the old girth, with a turned-down bone cuff that reads against the dark floor
    const knee = grp(hip, 0, -0.45, 0);
    P.add(knee, leatherM, K.lathe([[0.084, -0.4], [0.078, -0.3], [0.086, -0.17], [0.096, -0.07], [0.1, -0.02]], 12));
    P.add(knee, gloveM, K.lathe([[0.096, -0.075], [0.11, -0.045], [0.118, 0.0], [0.12, 0.03]], 12));
    const ankle = grp(knee, 0, -0.42, 0);
    P.add(ankle, leatherM, new THREE.SphereGeometry(0.07, 12, 8), 0, -0.03, 0.05, 0, 0, 0, 1.06, 0.66, 1.7);
    P.add(ankle, legM, new THREE.BoxGeometry(0.135, 0.018, 0.235), 0, -0.064, 0.05);
    P.add(ankle, legM, new THREE.BoxGeometry(0.1, 0.045, 0.06), 0, -0.05, -0.045);
    // spur: strap, shank and a big star rowel that glints
    P.add(ankle, metalM, new THREE.TorusGeometry(0.084, 0.007, 4, 16, PI), 0, -0.02, 0.0, PI / 2, 0, PI);
    for (let k = 0; k < 3; k++) P.add(ankle, metalM, new THREE.BoxGeometry(0.005, 0.07, 0.009), 0, -0.02, -0.122, k * PI / 3, 0, 0);
    P.add(ankle, metalM, new THREE.BoxGeometry(0.006, 0.008, 0.04), 0, -0.02, -0.098);
    return { hip, knee, ankle };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  // ---- duster skirt: six hinged panels, open front, split back, leather hem ----
  // the whole skirt hangs from one swing joint (it trails a run, hangs plumb under a lean and swings back after a shot as one sheet);
  // each panel adds a small outward flare about its own hinge (leg push, jumps)
  const R0 = 0.2, panels = [], skirt = grp(hips, 0, -0.03, 0), skirtS = [K.spring(40, 6), K.spring(36, 6)];
  const prof = (y) => R0 + 0.22 * Math.pow(Math.max(0, -y) / 0.8, 0.95); // A-line: a wide bell hem
  const mkPanel = (phi, span, len, rs = 1) => {
    const pv = grp(skirt, Math.sin(phi) * R0 * rs, 0, Math.cos(phi) * R0 * rs); pv.rotation.order = 'YXZ'; pv.rotation.y = phi; // x lifts about the panel's own hinge
    const shape = (geo) => { const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), a = Math.atan2(x, pa.getZ(i)) / (span / 2);
      if (y < -len + 0.04 + 1e-4) pa.setY(i, y - 0.025 * (1 - a * a));
      const fold = 1 + 0.07 * Math.sin(a * span * 8 + phi * 5) * sat(-y / len) ** 1.2; pa.setX(i, x * fold); pa.setZ(i, pa.getZ(i) * fold); } geo.computeVertexNormals(); };
    const pts = []; for (let k = 0; k <= 7; k++) { const y = -len + k / 7 * len; pts.push([prof(y) * rs, y]); }
    const cg = K.lathe(pts, 8, -span / 2, span); shape(cg); P.add(pv, coatM, cg, 0, 0, -R0 * rs);
    const hy = -len, hg = K.lathe([[prof(hy) * rs + 0.004, hy], [prof(hy + 0.045) * rs + 0.004, hy + 0.045]], 8, -span / 2, span); shape(hg); P.add(pv, liningM, hg, 0, 0, -R0 * rs);
    panels.push({ pv, phi, spr: K.spring(44, 5.5) }); return pv;
  };
  // panels overlap (the sides sit just outside) so a flare does not open gaps
  mkPanel(0.64, 0.7, 0.74); mkPanel(-0.64, 0.7, 0.74);
  mkPanel(1.43, 1.22, 0.8, 1.045); mkPanel(-1.43, 1.22, 0.8, 1.045);
  mkPanel(2.5, 0.96, 0.86); const pvBR = mkPanel(-2.5, 0.96, 0.86);
  // centre-back vent: a teal gusset behind the split, sewn to the right back panel, opening wider toward the hem
  { const pts = []; for (let k = 0; k <= 7; k++) { const y = -0.84 + k / 7 * 0.84; pts.push([prof(y) * 0.92, y]); }
    P.add(pvBR, liningM, K.lathe(pts, 6, PI - 0.3 + 2.5, 0.6), 0, 0, -R0); }

  // ---- revolver, built along +z with the grip at the origin ----
  const weapon = grp(armR.hand, 0, -0.035, 0.012), wtip = new THREE.Object3D(); weapon.scale.setScalar(1.45); // a hand cannon that reads at play distance
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
  P.add(weapon, gunM, new THREE.CylinderGeometry(0.021, 0.021, 0.35, 8), 0, BY, 0.27, PI / 2, 0, PI / 8);
  P.add(weapon, gunM, new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8), 0, BY - 0.03, 0.2, PI / 2, 0, 0);
  P.add(weapon, gunM, new THREE.BoxGeometry(0.006, 0.02, 0.026), 0, BY + 0.028, 0.425);
  P.add(weapon, metalM, new THREE.TorusGeometry(0.02, 0.0045, 5, 12), 0, BY, 0.444);
  for (const z of [0.125, 0.3]) P.add(weapon, metalM, new THREE.TorusGeometry(0.0215, 0.004, 4, 12), 0, BY, z);
  for (const s of [1, -1]) { P.add(weapon, metalM, new THREE.BoxGeometry(0.002, 0.006, 0.07), s * 0.0205, 0.068, 0.068); P.add(weapon, metalM, new THREE.BoxGeometry(0.002, 0.04, 0.006), s * 0.0205, 0.06, -0.012);
    P.add(weapon, metalM, new THREE.BoxGeometry(0.002, 0.005, 0.2), s * 0.0212, BY - 0.004, 0.27); }
  P.add(weapon, barrelM, new THREE.BoxGeometry(0.0055, 0.004, 0.27), 0, BY + 0.0215, 0.27);
  P.add(weapon, metalM, new THREE.TorusGeometry(0.022, 0.0035, 4, 12, PI * 1.25), 0, 0.0, 0.03, 0, PI / 2, PI * 0.88);
  P.add(weapon, gunM, new THREE.BoxGeometry(0.006, 0.026, 0.008), 0, -0.004, 0.026, 0.3, 0, 0);
  P.add(weapon, gloveM, new THREE.CapsuleGeometry(0.0078, 0.032, 2, 6), 0, -0.004, 0.028, PI / 2 + 0.45, 0, 0); // trigger finger through the guard
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
  // motion blurs: a lit ring round the drum while it spins, a faint disc swept by the gun while it twirls round the trigger finger
  const blurM = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const drumBlurM = blurM(), drumBlur = new THREE.Mesh(K.merge([new THREE.RingGeometry(0.03, 0.085, 28, 1), new THREE.RingGeometry(0.095, 0.104, 28, 1)]), drumBlurM);
  drumBlur.position.z = 0.05; drumBlur.visible = false; drum.add(drumBlur);
  const twBlurM = blurM(), twBlur = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.47, 28, 1).rotateY(PI / 2), twBlurM); twBlur.visible = false; weapon.add(twBlur);
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
  // a warm fill from above and behind: the play camera sees the back, and the arena's violet light ate the wine there
  const fill = new THREE.PointLight(0xffcfa6, 2.6, 6, 1.4); fill.position.set(0.3, 2.5, -1.4); g.add(fill);

  const A = { run: 0, swing: 0, swingDur: 0.2, swingKind: 0, cast: 0, lean: 0, aim: 0, load: 0, spin: 0, tw: 0, air: 0, vx: 0, vz: 0, lx: null, lz: null,
    fireEv: false, pFront: 'L', pArmed: false, pLoad: 0, pAim: 0, loadHold: 0, push: 0, spinT: 0, twT: 0, kick: 0, kickV: 0, flash: 0, last: 0, lastH: 0,
    fetch: 0, drum: 0, drumK: 26, hammer: 0, crane: 0, ember: 0, heal: 0, yawV: 0, lf: null, climb: 0.58, silver: 0, sway: 0, coil: 0, fl: 0, flK: 0.3, dk: 1 };
  // the shot's own muzzle light sits a forearm from the chest: the cloth darkens under it so the figure stays a silhouette
  const dimMats = [coatM, capeM, vestM, gloveM, liningM, hatM, scarfM, leatherM, maskM].map((m) => [m, m.color.clone()]);
  const swayS = K.spring(110, 12); // the body's half-beat-late answer to the recoil: hips, hem, mantle and scarf follow it
  const TWD = 1.0, SPD = 0.6; // how long a salve twirl and a Spin hold their poses
  const flashCol = new THREE.Color(), emberCol = new THREE.Color(), _c = new THREE.Color();
  const _v = new V3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler(), _ik = { rx: 0, ry: 0, rz: 0, re: 0 };
  const _hr = new V3(), _d = new V3(), _v0 = new V3(), _el = new V3(), _pl = new V3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _eu = new THREE.Euler();
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
    if (A.lf !== null && dt > 0) { const d = f - A.lf; A.yawV = damp(A.yawV, clamp(Math.atan2(Math.sin(d), Math.cos(d)) / dt, -12, 12), 10, dt); } A.lf = f;
    A.lean = damp(A.lean, moving ? Math.min(1, spd / 7) : 0, 9, dt);
    A.run += dt * spd * 1.55; const ph = A.run, s = Math.sin(ph), c = Math.cos(ph), L = A.lean;
    A.air = damp(A.air, grounded ? 0 : 1, 12, dt);
    const cyl = Array.isArray(p.cyl) ? p.cyl : null, loadT = p.loadT || 0, aimT = p.aimT || 0;
    // ---- events: a shot (swing 4, or the aim timer jumping for a stand-in), a round loaded (load timer 0.3), a Spin (0.18) ----
    if (!cyl && aimT > A.pAim + 0.2) A.fireEv = true;
    if (A.fireEv) { A.fireEv = false; const r = cyl ? A.pFront : 'L', last = !!(cyl && A.pArmed && !p.armed);
      if (r === 'V') { A.twT = TWD; A.heal = 1; } else { A.kick = 0; A.kickV = last ? 34 : 28; A.flash = 1; flashCol.copy(RC[r] || glowCol); A.last = last ? 1 : 0;
        // muzzle climb per round: lead jumps ~30 degrees, silver stays level (sold by a cyan rim flash), the Last Word stays on the line
        A.climb = last ? 0.08 : r === 'S' ? 0.16 : 0.58; if (r === 'S') A.silver = 1; A.fl = 1; A.flK = last ? 0.6 : 0.3; if (last) A.lastH = Math.max(A.lastH, 0.75);
        skirtS[0].v += last ? 2.6 : 1.6; for (const q of panels) if (Math.cos(q.phi) < 0.5) q.spr.v += last ? 2.2 : 1.4; // the skirt kicks back off the shot
        for (const m of mantle) m.spr.v += (last ? 4 : 2.5) * (Math.cos(m.phi) < 0 ? 1 : 0.6); }
      A.drum += PI / 3; A.drumK = 30; A.hammer = 1; A.ember = 1; emberCol.copy(RC[r] || glowCol); }
    if (loadT > A.pLoad + 0.05) { if (loadT > 0.24) { A.loadHold = 0.55; A.push = 1; } else { A.spinT = SPD; A.drum += PI / 3 + TAU * 2; A.drumK = 6; } }
    A.pLoad = loadT; A.pAim = aimT; A.pFront = cyl ? cyl[0] : 'L'; A.pArmed = !!p.armed;
    A.loadHold = Math.max(0, A.loadHold - dt); A.spinT = Math.max(0, A.spinT - dt); A.twT = Math.max(0, A.twT - dt);
    A.push = Math.max(0, A.push - dt / 0.3); A.flash = Math.max(0, A.flash - dt / 0.07); A.ember = Math.max(0, A.ember - dt / 0.7); A.heal = Math.max(0, A.heal - dt / 0.9); A.last = Math.max(0, A.last - dt / 1.0);
    A.silver = Math.max(0, A.silver - dt / 0.35); A.fl = Math.max(0, A.fl - dt / 0.16);
    // recoil: a kicked, underdamped spring (peak ~1 at 0.08 s, a small overshoot, settled by ~0.35 s); the body sways after it
    A.kickV -= (A.kick * 260 + A.kickV * 14) * dt; A.kick = Math.max(-0.35, A.kick + A.kickV * dt); if (Math.abs(A.kick) < 0.002 && Math.abs(A.kickV) < 0.05) A.kick = A.kickV = 0;
    A.sway = swayS.step(A.kick, dt);
    // anticipation: with the Last Word up and the gun raised, a coiled crouch that the shot releases into the lunge
    A.coil = damp(A.coil, cyl && p.armed && (p.streak | 0) === 5 && aimT > 0 ? 1 : 0, 8, dt);
    const TW = A.twT > 0 ? smooth(Math.min(1, A.twT / 0.15)) * smooth(Math.min(1, (TWD - A.twT) / 0.08)) : 0;
    A.tw = damp(A.tw, TW > 0 ? 1 : 0, 16, dt); // aim: a snap draw, a lingering hold
    A.aim = damp(A.aim, aimT > 0 && A.twT <= 0 ? 1 : 0, aimT > 0 ? 40 : 7, dt); A.load =damp(A.load, A.loadHold > 0 ? 1 : 0, 14, dt); A.spin = damp(A.spin, A.spinT > 0 ? 1 : 0, 18, dt);
    A.cast = damp(A.cast, p.casting ? 1 : 0, 10, dt); A.lastH = damp(A.lastH, A.last > 0.05 ? 1 : 0, 24, dt); A.fetch = damp(A.fetch, A.push > 0.5 ? 1 : 0, 24, dt);
    const AW = A.aim * (1 - A.load) * (1 - A.spin), LW = A.load * (1 - A.spin), SW = A.spin, TWW = A.tw;
    const br = Math.sin(t * 1.6);

    // ---- base: a contrapposto idle (weight on the gun-side leg, hips shifted and rolled, shoulders countered, torso turned, head
    // tipped down under the brim) blended into a leaning run with counter-swung shoulders and a bob, and a bladed duelist stance ----
    const I = 1 - L, Q = I * (1 - AW), LH = A.lastH * AW, k = A.kick, CQ = A.coil * (1 - A.lastH), SY = A.sway * AW;
    // the Last Word squares the chest up (so the off hand can brace) and lunges; the coil hunches into it
    const hb = AW * (0.3 - 0.06 * LH) * (1 - 0.6 * L), tb = AW * (0.32 - 0.24 * LH + 0.2 * L - k * 0.14);
    hips.position.set(-0.04 * Q, 0.95 + br * 0.005 + L * (Math.abs(c) * 0.11 - 0.05) - AW * I * (0.04 + 0.08 * LH + 0.035 * CQ) - 0.03 * SY, 0);
    hips.rotation.set(0, s * 0.22 * L - 0.12 * Q + hb, -0.07 * Q + Math.sin(t * 0.5) * 0.01 * I);
    body.rotation.set(0.04 + L * 0.34 + 0.03 * AW * I, 0, 0); body.position.set(0, 0, 0);
    torso.rotation.set(0.03 + br * 0.01 + L * 0.1 + AW * I * (0.08 + 0.24 * LH + 0.08 * CQ) - k * 0.12 * AW * (1 - 0.4 * LH) + 0.03 * SY, -s * 0.38 * L - 0.2 * Q + tb, 0.12 * Q);
    head.rotation.set(0.11 * Q - L * 0.16 - AW * (0.04 + k * 0.06), (Math.sin(t * 0.33) * 0.1 + 0.22) * Q + s * 0.14 * L - (hb + tb) * 0.92, -0.05 * Q);
    hat.rotation.x = 0.04 - k * 0.16 * AW;
    let tl = lerp(-0.14, -s * 0.74, L), tr = lerp(0.04, s * 0.74, L), zl = 0.14 * I, zr = 0.07 * I;
    const kc = Math.cos(ph - 0.45); let kl = lerp(0.3, 0.12 + Math.pow(Math.max(0, kc), 1.5) * 1.05, L), kr = lerp(0.03, 0.12 + Math.pow(Math.max(0, -kc), 1.5) * 1.05, L);
    // duel stance: feet ~1.3x shoulder width, front (gun-side) knee bent; the Last Word lunges (front knee deep, back leg straight)
    if (AW > 0.01) { const q = AW * I; tl = lerp(tl, 0.3, q); tr = lerp(tr, -0.24, q); zl = lerp(zl, 0.18, q); zr = lerp(zr, -0.15, q); kl = lerp(kl, 0.03, q); kr = lerp(kr, 0.34, q);
      const q2 = q * A.lastH; tl = lerp(tl, 0.48, q2); kl = lerp(kl, 0.0, q2); tr = lerp(tr, -0.58, q2); kr = lerp(kr, 0.8, q2); zl = lerp(zl, 0.12, q2); zr = lerp(zr, -0.1, q2);
      kl += 0.12 * q * CQ; kr += 0.14 * q * CQ; kr += 0.1 * SY; }
    // right arm and gun (gun pitch/yaw/roll in model space); left arm FK, both swinging against the legs
    let rx = lerp(-0.06, -0.12 - s * 0.5, L), rz = lerp(-0.13, -0.12, L), re = lerp(-0.16, -0.45 - Math.max(0, s) * 0.5, L), gb = lerp(-1.35, -1.15 + Math.max(0, s) * 0.5, L), ga = lerp(-0.1, 0, L), gr = 0;
    let lx = lerp(-0.1, s * 0.66, L), lz = 0.12 + 0.03 * L, le = lerp(-0.5, -0.45 - Math.max(0, -s) * 0.55, L);
    let ry = 0, ly = 0; const reachR = (w, x, y, z, px, py, pz) => { if (w < 0.002) return; ik(armR, x, y, z, px, py, pz); rx = lerp(rx, _ik.rx, w); ry = lerp(ry, _ik.ry, w); rz = lerp(rz, _ik.rz, w); re = lerp(re, _ik.re, w); };
    if (LW > 0.002) { const q = LW * I; torso.rotation.y += 0.2 * q; torso.rotation.x += 0.04 * q; head.rotation.x += 0.26 * q; head.rotation.y -= 0.32 * q; }
    if (SW > 0.002) { const q = SW * I; torso.rotation.z += 0.08 * q; head.rotation.x += 0.06 * q; head.rotation.y -= 0.5 * q; }
    if (TWW > 0.002) { torso.rotation.y -= 0.1 * TWW; head.rotation.x += 0.12 * TWW; head.rotation.y -= 0.12 * TWW; }
    // aim: the hand goes to a point in model space (out along the line of fire), kicked up and back by the recoil; the Last Word
    // reaches past full extension
    // the draw slides the hand's target from where the free arm holds it up to the aim point (blending targets, not joint angles,
    // keeps the half-drawn frames on a sane path: no gun swung up across the face)
    if (AW > 0.002) { const cf = A.climb / 0.58;
      armR.sh.rotation.set(rx, ry, rz); armR.el.rotation.x = re; g.updateMatrixWorld(true); g.worldToLocal(armR.hand.getWorldPosition(_hr));
      _v.set(lerp(-0.15, -0.06, LH), 1.43 + k * 0.08 * cf - 0.04 * LH - 0.03 * CQ, 0.64 - k * 0.11 + LH * 0.16 - 0.08 * CQ).lerp(_hr, 1 - AW); torso.worldToLocal(g.localToWorld(_v));
      reachR(sat(AW * 4), _v.x, _v.y, _v.z, -0.4, -1, -0.2); gb = lerp(gb, 0.02 + k * A.climb, AW); ga = lerp(ga, -0.02, AW); gr = lerp(gr, 0, AW); }
    // Load: the gun tipped up at the right shoulder, clear of the body; Spin: out at arm's length; Salve: a low twirl at the hip
    if (LW > 0.002) { reachR(LW, -0.35, 0.6, 0.24, -1, -0.5, -0.3); gb = lerp(gb, 0.95, LW); ga = lerp(ga, -0.42, LW); gr = lerp(gr, 0.25, LW); }
    if (SW > 0.002) { reachR(SW, -0.7, 0.52, 0.24, 0, -1, -0.5); gb = lerp(gb, 0.55, SW); ga = lerp(ga, -0.2, SW); gr = lerp(gr, 0.2, SW); }
    if (TWW > 0.002) { reachR(TWW, -0.33, 0.14, 0.2, -0.4, -1, -0.5); gb = lerp(gb, -0.05, TWW); ga = lerp(ga, -0.35, TWW); gr = lerp(gr, 0, TWW); }
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
    _q2.setFromEuler(_e.set(-gb, ga, gr, 'YXZ')); if (A.twT > 0) { const u = 1 - A.twT / TWD; _q2.multiply(_q3.setFromAxisAngle(_v.set(1, 0, 0), -(1 - Math.pow(1 - u, 1.8)) * TAU * 3)); }
    weapon.quaternion.copy(_q).multiply(_q2);
    // drum, crane, hammer
    A.drum = damp(A.drum, 0, A.drumK, dt); drum.rotation.z = A.drum;
    A.crane = damp(A.crane, LW > 0.3 ? 1 : 0, 16, dt); crane.rotation.z = -1.35 * A.crane;
    A.hammer = Math.max(0, A.hammer - dt / 0.14); hammer.rotation.x = -0.75 * (1 - A.hammer) * (AW > 0.3 ? 1 : 0.2);
    // ---- off hand: thumb in the belt at rest, on the hip (elbow out) in the duel, thrown back for balance on the Last Word, fetching
    // a round from the bandolier into the open drum, flung wide on Spin, touching the brim on a salve twirl ----
    const reachL = (w, x, y, z, px, py, pz) => { if (w < 0.002) return; ik(armL, x, y, z, px, py, pz); lx = lerp(lx, _ik.rx, w); ly = lerp(ly, _ik.ry, w); lz = lerp(lz, _ik.rz, w); le = lerp(le, _ik.re, w); };
    const rest = (1 - LW) * (1 - SW) * (1 - TWW) * (1 - A.air) * (p.pose === 'fall' ? 0 : 1), hw = AW;
    // one reach whose target slides belt -> hip (blending targets, not joint angles, keeps the arm on a sane path)
    reachL(Math.max(I, AW) * rest, lerp(0.13, 0.22, hw), lerp(0.08, 0.1, hw), lerp(0.15, 0.02, hw), 1, lerp(-0.3, -0.1, hw), lerp(-0.8, -0.3, hw));
    if (SW > 0.01) reachL(SW, 0.22, 0.1, 0.03, 1, -0.1, -0.3); // Spin: back on the hip, the gun hand does the showing off
    // Last Word: the off hand braces the gun wrist from beneath
    if (LH * rest > 0.01) { g.updateMatrixWorld(true); const q = gunPt(armR.el, 0, -FA + 0.07, 0); reachL(LH * rest, q.x + 0.02, q.y - 0.05, q.z, 1, -1, 0.2); }
    if (LW + TWW > 0.01) { g.updateMatrixWorld(true);
      if (LW > 0.01) { const q = gunPt(drum, 0, 0.028, -0.12 + (A.push > 0 ? Math.sin(A.push * PI) * 0.03 : 0)), v = vialAt[4], f = A.fetch;
        reachL(LW, lerp(q.x + 0.02, v[0] + 0.03, f), lerp(q.y, v[1] - 0.02, f), lerp(q.z, v[2] + 0.07, f), 1, -0.8, 0); }
      if (TWW > 0.01) { const q = gunPt(hat, 0.13, -0.012, 0.36); reachL(TWW, q.x, q.y, q.z, 1, -0.4, 0); } }
    armL.sh.rotation.set(lx, ly, lz); armL.el.rotation.x = le;
    // ---- cloth ----
    const wind = (phi) => -(Math.sin(phi) * A.vx + Math.cos(phi) * A.vz) * 0.06;
    const flut = (phi, k) => Math.sin(t * k + phi * 3) * (0.05 * L + 0.015);
    // skirt swing (positive = hem back): plumb under the lean, trailing the run, a half-beat-late swing back off each shot
    skirt.rotation.x = clamp(skirtS[0].step(tilt * 0.7 + clamp(A.vz * 0.02, -0.1, 0.14) + A.sway * 0.4 + A.last * 0.15, dt), -0.25, 0.5);
    skirt.rotation.z = clamp(skirtS[1].step(clamp(-A.vx * 0.035, -0.3, 0.3) - hips.rotation.z * 0.8, dt), -0.35, 0.35);
    for (const q of panels) {
      const fr = Math.cos(q.phi), sd = Math.sin(q.phi), legX = sd > 0 ? tl : tr;
      const push = fr > 0.3 ? Math.max(0, -legX) * 0.9 + 0.03 : fr < -0.3 ? Math.max(0, Math.max(tl, tr)) * 0.2 + 0.04 : Math.abs(legX) * 0.3 + 0.05 + 0.2 * Math.abs(sd > 0 ? zl : zr);
      const tgt = clamp(push + wind(q.phi) * (fr < -0.3 ? 0.1 : 0.3) + flut(q.phi, 8) + A.air * 0.32 + A.last * 0.1, -0.05, fr < -0.3 ? 0.3 + A.air * 0.3 : 0.6);
      q.pv.rotation.x = -clamp(q.spr.step(tgt, dt), -0.05, 0.7);
    }
    // mantle: lifts on the shot, in the air and into a run, swings against a turn
    for (const m of mantle) { const fr = Math.cos(m.phi), sd = Math.sin(m.phi);
      const lift = 0.02 + A.air * 0.35 + A.sway * (fr < 0 ? 0.3 : 0.12) + A.last * 0.1 + L * (0.03 + Math.max(0, -fr) * 0.12) + Math.abs(A.yawV) * 0.012 + Math.max(0, -sd * A.yawV) * 0.025
        + Math.max(0, wind(m.phi)) * 0.4 + Math.sin(t * 6 + m.phi * 2) * 0.02 * L;
      m.pv.rotation.x = -clamp(m.spr.step(clamp(lift, -0.02, fr < 0 ? 0.4 : 0.26), dt), -0.05, 0.5);
      m.pv.rotation.z = m.sprZ.step(clamp(-A.yawV * 0.025, -0.14, 0.14) + Math.sin(ph) * 0.02 * L, dt); }
    const headTilt = tilt + torso.rotation.x + head.rotation.x;
    for (let k = 0; k < braid.length; k++) { const q = braid[k], tgt = (k === 0 ? 0.62 - headTilt : 0.05) + clamp(A.vz * 0.05, -0.1, 0.6) * (k ? 0.4 : 1) + A.air * 0.25 + Math.sin(t * 6 - k) * 0.04 * L;
      q.o.rotation.x = q.sx.step(tgt, dt); q.o.rotation.z = q.sz.step(-A.vx * 0.04 * (k ? 0.5 : 1) - (k === 0 ? head.rotation.z + hips.rotation.z : 0), dt); }
    const chestTilt = tilt + torso.rotation.x;
    // back tails: the free ends hang plumb below the mantle (whatever it and the chest are doing), trail a run and swing back after a shot
    { const W = clamp(A.vz * 0.07, -0.2, 0.9) + A.air * 0.5 + A.sway * 0.45 + Math.sin(t * 7.3) * (0.06 * L + 0.015);
      bTail.rotation.x = -bTailS[0].step(Math.max(-0.35, W - chestTilt + mB.pv.rotation.x), dt); bTail.rotation.z = bTailS[1].step(A.vx * 0.05 + Math.sin(ph - 1.2) * 0.12 * L, dt); }
    for (const ch of tails) for (let k = 0; k < ch.length; k++) { const q = ch[k], tgt = (k === 0 ? -0.34 - chestTilt - 0.3 * A.sway : 0.06) - clamp(A.vz * 0.06, -0.2, 0.9) * (k ? 0.5 : 1) - A.air * 0.4 + Math.sin(t * 8 - k * 1.3) * (0.08 * L + 0.02);
      q.o.rotation.x = q.sx.step(tgt, dt); q.o.rotation.z = q.sz.step(q.rz - A.vx * 0.05 + Math.sin(t * 5.3 + k) * 0.05 * L + Math.sin(ph - 1.6 - k * 0.7) * 0.16 * L, dt); }
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
    glowM.color.copy(glowBase).multiplyScalar(0.88 + 0.12 * Math.sin(t * 2.1) + A.last * 0.35);
    sigM.color.copy(sigBase).multiplyScalar(0.8 + LW * 1.1 + SW * 1.4 + A.push * 0.8 + TWW * 0.6);
    drumBlurM.opacity = A.drumK < 10 ? sat(Math.abs(A.drum) / 2.5) * 0.9 : 0; drumBlur.visible = drumBlurM.opacity > 0.02 && !G.headless;
    if (drumBlur.visible) drumBlurM.color.copy(glowCol).lerp(RC.L, 0.3).multiplyScalar(1.4);
    twBlurM.opacity = A.twT > 0 ? TWW * 0.4 * Math.pow(A.twT / TWD, 0.8) : 0; twBlur.visible = twBlurM.opacity > 0.02 && !G.headless;
    if (twBlur.visible) twBlurM.color.copy(RC.V);
    flash.visible = A.flash > 0.02 && !G.headless; if (flash.visible) { flashM.color.copy(flashCol).multiplyScalar(1.6 + A.last * 1.5); flash.scale.set(1 + A.last, 1 + A.last, (0.5 + A.flash * 0.7) * (1 + A.last * 1.2)); flash.rotation.z = t * 37; }
    // glow on the figure is capped on the big shots so the silhouette stays dark against its own flash; silver flashes a cyan rim
    rimU.value.copy(rimBase).multiplyScalar(1 + A.flash * 0.35 * (1 - A.lastH) + A.heal * 0.4 - 0.3 * A.last);
    if (A.silver > 0) rimU.value.add(_c.setRGB(0.5, 0.95, 1.0).multiplyScalar(A.silver * 0.85));
    const dk = 1 - A.fl * A.flK; if (dk !== A.dk) { A.dk = dk; for (const [m, c0] of dimMats) m.color.copy(c0).multiplyScalar(dk); }
    aura.intensity = 1.3 + A.flash * 1.4 * (1 - A.lastH) + (p.flashT > 0 ? 5 : 0) + A.heal * 1.5; fill.intensity = 2.6 * (1 - 0.5 * A.last);
  }
  return { group: g, update, anim: A, wtip, body, swing(kind = 0, dur = 0.2) { A.swing = A.swingDur = dur; A.swingKind = kind; if (kind === 4) A.fireEv = true; } };
};
