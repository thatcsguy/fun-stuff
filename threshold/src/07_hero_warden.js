// ============================== ASHWARDEN ==============================
// (Its own file so the class models can be worked on side by side. The name sorts after 07_hero.js, which declares HERO_MODELS
// and HeroKit, under both C and dictionary collation: build.sh concatenates in glob order.)
// An ash-iron knight: a crested armet with an ember-lit visor slit and a long horsehair plume, an ashen mantle with a smouldering
// hem, layered pauldrons (the left one with a raised guard), a breastplate cracked with embers that glow with stamina, flared
// tassets and a frayed tabard, a broad singed cape with a burning hem, and three Ember Flasks on the belt (their glowing level is the
// flasks left). The greatsword is held in both hands by IK and is animated as a grip point and blade direction in chest space, so
// cuts, the overhead and the slam read as one heavy weapon. The legs are grounded each frame from their joint angles, so a crouch
// is a real knee bend. Kindle sets the blade burning, the opening after a dodge makes it white-hot, Winded leans the knight on it.
HERO_MODELS.ashwarden = function buildAshwarden(cls) {
  const C = cls.look, K = HeroKit, P = K.parts(), g = new THREE.Group(), rnd = mulberry(91);
  const glowC = new THREE.Color(C.glow), clothC = new THREE.Color(C.cloth), armC = new THREE.Color(C.armor), ashC = new THREE.Color(0xa49e96);
  // a cool, strong rim: the knight is mostly seen from behind on dark floors, so the silhouette carries its own edge light
  const rimBase = new THREE.Color(0xa8bce0).lerp(glowC, 0.22).multiplyScalar(0.4), rimU = { value: rimBase.clone() };
  // (a cool blue-grey cast and real specular, so warm arena light reads as light on steel instead of turning the knight brown)
  const coolC = new THREE.Color(0x8c99ad), plateC = armC.clone().lerp(ashC, 0.4).lerp(coolC, 0.42).multiplyScalar(1.35);
  const plateM = K.mat({ color: plateC.getHex(), emissive: 0x1c2332, roughness: 0.45, metalness: 0.6, envMapIntensity: 1.5 }, rimU, 1);
  // plate also catches a constant cool sky light on every upward face (helm crown, pauldron tops, the backs of the shoulders), so
  // at play distance the head and shoulders separate from a dark floor instead of merging into one lump. Both it and a cool
  // fresnel edge grow with camera distance (from ~6 m), so the play camera gets a lit silhouette and close-ups stay unchanged
  { const ob = plateM.onBeforeCompile, topU = { value: new THREE.Color(0x8fa8d8).multiplyScalar(0.34) };
    plateM.onBeforeCompile = (sh, r) => { ob(sh, r); sh.uniforms.uTop = topU;
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uTop;\nvoid main() {').replace('#include <lights_fragment_begin>',
        '{ vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); float up = dot(normal, upV);'
        + ' float dv = length(vViewPosition), far = smoothstep(6.0, 11.0, dv); vec3 vv = vViewPosition / max(dv, 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0);'
        + ' totalEmissiveRadiance += uTop * (smoothstep(0.4, 0.92, up) * (0.55 + 0.9 * fr) * (1.0 + 1.4 * far) + far * 1.5 * fr * fr); }\n#include <lights_fragment_begin>'); };
    plateM.customProgramCacheKey = () => 'awPlateTop'; }
  const darkM = K.mat({ color: armC.clone().lerp(ashC, 0.18).lerp(coolC, 0.25).multiplyScalar(0.9).getHex(), roughness: 0.5, metalness: 0.58, envMapIntensity: 1.0 }, rimU, 0.6);
  const trimM = K.mat({ color: C.metal !== undefined ? C.metal : 0x9c7850, roughness: 0.32, metalness: 0.8, envMapIntensity: 1.5 }, rimU, 0.9);
  const clothM = K.mat({ color: C.cloth, roughness: 0.9, side: THREE.DoubleSide }, rimU, 0.7, C.lining !== undefined ? C.lining : clothC.clone().multiplyScalar(0.45).getHex());
  const capeM = K.mat({ color: clothC.clone().multiplyScalar(0.95).getHex(), roughness: 0.92, side: THREE.DoubleSide }, rimU, 0.8, clothC.clone().multiplyScalar(0.35).getHex());
  // the plume darkens to a deep red at the root and burns ember-bright on its last third
  // (a gentle ramp, no dark root band: neighbouring segments differ only slightly, so the tail reads as one feathered crest)
  const PL = 6, plumeMs = []; for (let k = 0; k < PL; k++) { const u = k / (PL - 1), hot = smooth((u - 0.3) / 0.6);
    const col = clothC.clone().lerp(new THREE.Color(0x5a1408), 0.18 * (1 - u)).multiplyScalar(1.35).lerp(clothC.clone().lerp(glowC, 0.6).multiplyScalar(1.9), hot);
    plumeMs.push(K.mat({ color: col.getHex(), emissive: glowC.getHex(), emissiveIntensity: 0.12 + 1.75 * hot * hot, roughness: 0.85, side: THREE.DoubleSide }, rimU, 0.9)); }
  const ashM = K.mat({ color: C.mantle !== undefined ? C.mantle : armC.clone().lerp(new THREE.Color(0x8a847c), 0.55).getHex(), roughness: 1, side: THREE.DoubleSide }, rimU, 0.8);
  const leatherM = K.mat({ color: C.leather !== undefined ? C.leather : 0x3a2a1e, roughness: 0.66 }, rimU, 0.5);
  // (amber glass that glows from within, so a flask reads as a lit bottle, not a dull red bead)
  const amberC = glowC.clone().lerp(new THREE.Color(0xffb040), 0.55);
  const glassM = K.mat({ color: amberC.clone().multiplyScalar(0.5).getHex(), emissive: amberC.getHex(), emissiveIntensity: 0.22, roughness: 0.1, metalness: 0.3, envMapIntensity: 1.8 }, rimU, 1.4);
  const corkM = K.mat({ color: 0xd8c4a0, roughness: 0.8 }, rimU, 0.7);
  const voidM = new THREE.MeshBasicMaterial({ color: 0x020101 });
  const seamM = W.glow(C.glow, 1.5), eyeM = W.glow(C.glow, 3.2), singeM = W.glow(C.glow, 0.9), fullerM = W.glow(C.glow, 1.6);
  const liqM = W.glow(glowC.clone().lerp(new THREE.Color(0xffb060), 0.6), 1.8), handLiqM = liqM.clone();
  const hemM = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }); // the cape's burning hem (vertex-coloured fade)
  const seamBase = seamM.color.clone(), eyeBase = eyeM.color.clone(), fullerBase = fullerM.color.clone(), singeBase = singeM.color.clone(), liqBase = liqM.color.clone();
  const whiteHot = new THREE.Color(2.2, 2.0, 1.7), haloC = new THREE.Color(1, 0.9, 0.72);
  // blade steel: flat-shaded, heats from the guard up (Kindle) and goes white-hot on an opening
  const heatU = { value: 0 }, hotU = { value: glowC.clone() }, whiteU = { value: 0 };
  // (pale steel with a honed, faintly lit edge strip both sides, so the blade reads against a dark floor at play distance)
  const bladeM = new THREE.MeshStandardMaterial({ color: 0xb0aaa2, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.6, flatShading: true });
  bladeM.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = rimU; sh.uniforms.uHeat = heatU; sh.uniforms.uHot = hotU; sh.uniforms.uWhite = whiteU;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vBy; varying float vBe;\nvoid main() {\nvBy = position.y; vBe = abs(position.x) / (abs(position.x) + abs(position.z) * 5.0 + 1e-5);');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim; uniform float uHeat; uniform vec3 uHot; uniform float uWhite; varying float vBy; varying float vBe;\nvoid main() {')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vv = vViewPosition / max(length(vViewPosition), 1e-4); float fr = 1.0 - clamp(abs(dot(normal, vv)), 0.0, 1.0);'
        + ' float h = uHeat * (0.5 + 0.5 * (1.0 - smoothstep(0.3, 1.64, vBy))), edge = smoothstep(0.76, 0.95, vBe), rdg = 1.0 - smoothstep(0.04, 0.17, vBe), bev = max(edge, rdg * 0.7);'
        // (seen edge-on the faces turn grazing: they light up pale, so the blade never thins to a dark hairline)
        + ' totalEmissiveRadiance += vec3(0.035, 0.037, 0.042) + vec3(0.5, 0.56, 0.66) * bev * 0.62 + vec3(0.5, 0.55, 0.64) * fr * fr * 0.75 + uRim * fr * fr * fr + uHot * h * (0.06 + 0.55 * fr * fr + 0.8 * bev) + vec3(1.0, 0.86, 0.66) * uWhite * (0.25 + 1.2 * fr * fr); }');
  };
  bladeM.customProgramCacheKey = () => 'awBlade';
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  const prof = (pts, y) => { if (y <= pts[0][1]) return pts[0][0]; for (let i = 1; i < pts.length; i++) if (y <= pts[i][1]) return lerp(pts[i - 1][0], pts[i][0], (y - pts[i - 1][1]) / (pts[i][1] - pts[i - 1][1])); return pts[pts.length - 1][0]; };

  // ---- skeleton (the torso is drawn 12% shorter than its profiles: everything on the torso bone is squashed by TS in y) ----
  const TS = 0.88, LT = 0.48, LS = 0.44, FOOT = 0.064, SINK = 0.045, HX = 0.13;
  const body = grp(g), hips = grp(body, 0, 0.98, 0), torso = grp(hips, 0, 0.03, 0), head = grp(torso, 0, 0.7 * TS, 0.01);
  const PT = (m, geo, ...a) => P.add(torso, m, geo, ...a).scale(1, TS, 1);
  // pelvis height that puts the longer leg's sole on the floor, from the thigh pitch t, knee k and splay z
  const reach = (t, k, z) => (0.05 + LT * Math.cos(t) + LS * Math.cos(t + k)) * Math.cos(z) + FOOT;

  // ---- torso: broad peascod breastplate tapering to the belt, ember cracks, gorget, belt, flared fauld ----
  const BP = [[0.158, -0.05], [0.165, 0.06], [0.195, 0.18], [0.236, 0.32], [0.248, 0.44], [0.23, 0.53], [0.172, 0.6], [0.11, 0.65], [0.09, 0.68]], BZ = 0.8, BX = 1.13;
  const ridge = (a, y) => 0.024 * Math.exp(-a * a / 0.05) * smooth((0.6 - y) / 0.22);
  const chest = (a, y, off) => { const r = prof(BP, y) + off; return [Math.sin(a) * r * BX, y, Math.cos(a) * r * BZ + ridge(a, y) + off]; };
  { const bg = K.lathe(BP, 26), pa = bg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(x, z); pa.setX(i, x * BX); pa.setZ(i, z * BZ + ridge(a, y)); }
    bg.computeVertexNormals(); PT(plateM, bg); }
  { // cooling cracks: jagged lines across the plate
    const crack = (a, y, n, da, dy) => { const pts = []; for (let k = 0; k <= n; k++) { pts.push(chest(a, y, 0.004)); a += da * (0.6 + rnd() * 0.8); y += dy * (0.6 + rnd() * 0.8) + (k % 2 ? 0.018 : -0.018); } return pts; };
    for (const [a, y, n, da, dy, r] of [[0.06, 0.48, 6, 0.1, -0.05, 0.006], [0.1, 0.36, 5, -0.12, -0.012, 0.005], [-0.05, 0.5, 3, -0.11, 0.025, 0.004], [0.42, 0.24, 3, 0.1, -0.04, 0.004]])
      PT(seamM, K.tube(crack(a, y, n, da, dy), r, n * 6, 4));
  }
  PT(plateM, K.lathe([[0.125, 0.6], [0.15, 0.63], [0.142, 0.68], [0.112, 0.72], [0.1, 0.75]], 20), 0, 0, 0, 0, 0, 0, 1, 1, 0.92);
  PT(trimM, new THREE.TorusGeometry(0.15, 0.008, 4, 24), 0, 0.63, 0, PI / 2, 0, 0, 1, 0.92, 1);
  P.add(hips, leatherM, new THREE.TorusGeometry(0.19, 0.03, 6, 28), 0, -0.02, 0, PI / 2, 0, 0, 1, 0.84, 1);
  P.add(hips, trimM, new THREE.BoxGeometry(0.1, 0.075, 0.03), 0, -0.02, 0.16);
  P.add(hips, seamM, new THREE.OctahedronGeometry(0.022), 0, -0.02, 0.176, 0, 0, 0, 1, 1.3, 0.4);
  for (let k = 0; k < 3; k++) { const r = 0.2 + k * 0.022, y = -0.045 - k * 0.055;
    P.add(hips, plateM, K.lathe([[r, y], [r + 0.026, y - 0.068]], 24), 0, 0, 0, 0, 0, 0, 1, 1, 0.84);
    P.add(hips, trimM, K.lathe([[r + 0.027, y - 0.06], [r + 0.029, y - 0.07]], 24), 0, 0, 0, 0, 0, 0, 1, 1, 0.84); }
  // ---- ashen mantle around the shoulders with a smouldering hem across the back, hood bunched behind the neck ----
  { const jag = []; for (let k = 0; k < 26; k++) jag.push(0.02 + rnd() * 0.05);
    const MG = 0.62, mg = K.lathe([[0.36, 0.44], [0.35, 0.52], [0.305, 0.59], [0.22, 0.66], [0.16, 0.72]], 26, MG, TAU - 2 * MG), pa = mg.attributes.position; // open at the front
    const nz = (a, y) => 1 + 0.05 * Math.sin(a * 7 + y * 20) + 0.03 * Math.sin(a * 13 + 1);
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(x, z), k = Math.round((a + PI) / TAU * 26) % 26, fr = 1 - Math.min(1, (Math.abs(a) - MG) / 0.9);
      const n = nz(a, y); pa.setX(i, x * n); pa.setZ(i, z * n * 0.86 + fr * 0.02); pa.setY(i, y - (y < 0.45 ? jag[k] : 0) - fr * 0.07 * (0.75 - y) * 3); }
    mg.computeVertexNormals(); PT(ashM, mg, 0, 0, -0.01);
    const hem = []; for (let k = 0; k <= 30; k++) { const a = MG + 0.75 + k / 30 * (TAU - 2 * MG - 1.5), y = 0.452, r = 0.3585 * nz(a, y) + 0.005; hem.push([Math.sin(a) * r, y, Math.cos(a) * r * 0.86 - 0.01]); }
    PT(singeM, K.tube(hem, 0.007, 60, 3)); }
  PT(ashM, new THREE.SphereGeometry(0.15, 14, 8), 0, 0.68, -0.13, 0.3, 0, 0, 1.3, 0.62, 0.8);

  // ---- head: crested armet with a snouted visor, ember slit, breaths, a long ember-red horsehair plume ----
  const HP = [[0.158, -0.1], [0.165, -0.02], [0.172, 0.06], [0.17, 0.13], [0.152, 0.2], [0.115, 0.25], [0.06, 0.278], [0.0, 0.286]];
  const snout = (a, y) => { const c = Math.max(0, Math.cos(a)); return 0.042 * c * c * c * Math.exp(-((y - 0.03) ** 2) / 0.012) - 0.008 * c * c * Math.exp(-((y - 0.095) ** 2) / 0.0003); };
  const helm = (a, y, off) => { const r = (y > HP[HP.length - 1][1] ? 0 : prof(HP, y)) + off; return [Math.sin(a) * r, y, Math.cos(a) * r + snout(a, y)]; };
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
  // one tapered horsetail of six overlapping segments, rooted on the crest and hanging down the back to the shoulder blades;
  // each segment replays the root's motion a beat later (PLAG s per segment), so turns and nods travel down the tail
  // (flat, 2.5x wider than thick, widest a third of the way down, then tapering to a frayed point; the segments are open sleeves
  // that overlap their neighbours, so there are no pinched joints to band the tail; it rests close along the back of the mantle)
  const PSEG = 0.105, PLAG = 0.065, PBASE = [0.55, -0.04, -0.1, -0.1, -0.08, -0.06], plume = [], plH = { t: [], x: [], z: [] };
  const PR = [0.034, 0.05, 0.057, 0.053, 0.045, 0.034, 0.012];
  { let par = grp(head, 0, 0.285, -0.12);
    for (let k = 0; k < PL; k++) { const seg = grp(par, 0, k ? -PSEG : 0, 0), r0 = PR[k], r1 = PR[k + 1], last = k === PL - 1;
      const pp = [[r0 * 0.98, 0.014], [(r0 + r1) * 0.505, -PSEG * 0.5], [r1, -PSEG - 0.014]]; if (!k) pp.unshift([0.001, 0.03], [r0 * 0.7, 0.026]); if (last) pp.push([0.001, -PSEG - 0.03]);
      P.add(seg, plumeMs[k], K.lathe(pp, 10), 0, 0, 0, 0, 0, 0, 1.6, 1, 0.64);
      if (last) for (let j = 0; j < 7; j++) { const cg = new THREE.ConeGeometry(0.011, 0.14, 3); cg.rotateX(PI); cg.translate(0, -0.1, 0); // a frayed, feathered tip
        P.add(seg, plumeMs[k], cg, (j - 3) * 0.011, -0.01, 0, ((j * 3) % 5 - 2) * 0.04, 0, (j - 3) * 0.13, 1, 1, 0.6); }
      plume.push({ o: seg }); par = seg; } }
  const plSprX = K.spring(55, 7), plSprZ = K.spring(45, 6);
  const plAt = (back, arr) => { const T = plH.t, n = T.length; if (!n) return 0; const tt = T[n - 1] - back; if (tt <= T[0]) return arr[0];
    let i = n - 1; while (i > 0 && T[i - 1] > tt) i--; const a = T[i - 1], b = T[i]; return lerp(arr[i - 1], arr[i], b > a ? (tt - a) / (b - a) : 1); };

  // ---- arms: mail sleeve, rerebrace, couter with a fan, vambrace, flared gauntlet ----
  const L1 = 0.31, L2 = 0.29, SHY = 0.55 * TS, PDY = 0.56 * TS;
  // a pointed joint plate (poleyn / couter): a faceted dome with a diamond outline, its point along +z, plus a diamond trim rim
  const cup = (bone, r, h, x, y, z, rx, sx, sy) => {
    const cg = K.lathe([[0.001, h], [r * 0.42, h * 0.8], [r * 0.78, h * 0.42], [r, 0], [r * 1.03, -h * 0.18]], 4); cg.rotateX(PI / 2); P.add(bone, plateM, cg, x, y, z, rx, 0, 0, sx, sy, 1);
    const rg = new THREE.TorusGeometry(r * 1.02, 0.0075, 4, 4); P.add(bone, trimM, rg, x, y, z, rx, 0, 0, sx, sy, 1); };
  // a shell-shaped side fan on the outside of a joint: a half disc (open toward `dz`) with a trim rim and two ribs
  const fan = (bone, side, r, x, y, z, dz) => { const t0 = dz < 0 ? PI / 2 : -PI / 2;
    const fg = new THREE.CylinderGeometry(r, r, 0.012, 10, 1, false, t0, PI); fg.rotateZ(PI / 2); P.add(bone, plateM, fg, x, y, z, 0, 0, side * 0.12);
    const tg = new THREE.TorusGeometry(r, 0.006, 3, 10, PI); tg.rotateY(PI / 2); tg.rotateX(dz < 0 ? -PI / 2 : PI / 2); P.add(bone, trimM, tg, x + side * 0.007, y, z, 0, 0, side * 0.12);
    for (const a of [-0.6, 0.6]) P.add(bone, trimM, new THREE.BoxGeometry(0.006, 0.005, r * 0.9), x + side * 0.008, y + Math.sin(a) * r * 0.45, z + Math.sign(dz) * Math.cos(a) * r * 0.45, -a * Math.sign(dz), 0, side * 0.12); };
  const mkArm = (side) => {
    const sh = grp(torso, side * 0.29, SHY, -0.01);
    P.add(sh, darkM, K.lathe([[0.072, -0.3], [0.082, -0.2], [0.088, -0.08], [0.084, 0.02]], 12));
    P.add(sh, plateM, K.lathe([[0.088, -0.27], [0.097, -0.18], [0.101, -0.09]], 12, side * PI / 2 - 1.35, 2.7));
    const el = grp(sh, 0, -L1, 0);
    cup(el, 0.074, 0.075, 0, 0.005, -0.03, PI, 0.85, 1.3); fan(el, side, 0.068, side * 0.068, 0, -0.005, 1); // couter, pointing back
    // vambrace: a cone flaring to 1.3x at the elbow end, rolled rim there, two straps (brass buckled bands: no extra material)
    P.add(el, plateM, K.lathe([[0.058, -0.25], [0.064, -0.18], [0.079, -0.1], [0.1, -0.05], [0.107, -0.038], [0.098, -0.03]], 12));
    P.add(el, trimM, new THREE.TorusGeometry(0.104, 0.009, 4, 16), 0, -0.04, 0, PI / 2, 0, 0);
    for (const y of [-0.12, -0.2]) P.add(el, trimM, new THREE.TorusGeometry(y < -0.15 ? 0.066 : 0.077, 0.006, 4, 16), 0, y, 0, PI / 2, 0, 0);
    const hand = grp(el, 0, -L2, 0);
    P.add(hand, plateM, K.lathe([[0.058, -0.005], [0.072, 0.045], [0.096, 0.1]], 12));
    P.add(hand, trimM, new THREE.TorusGeometry(0.096, 0.006, 4, 16), 0, 0.1, 0, PI / 2, 0, 0);
    P.add(hand, plateM, new THREE.SphereGeometry(0.052, 10, 8), 0, -0.035, 0.005, 0, 0, 0, 0.85, 1.2, 1.1); // (plated fist)
    P.add(hand, plateM, new THREE.BoxGeometry(0.078, 0.04, 0.062), 0, -0.048, 0.025, 0.3, 0, 0);
    // pauldron on its own pivot: it follows the arm part of the way, so a raised arm does not lift the whole shoulder
    const pd = grp(torso, side * 0.29, PDY, -0.01), big = side > 0 ? 1.08 : 0.95;
    for (let k = 0; k < 3; k++) { const r = (0.135 - k * 0.007) * big, yE = r * Math.cos(PI * 0.45), tf = [side * (0.025 + k * 0.04) * big, (0.05 - k * 0.055) * big, 0, 0, 0, side * -(0.3 + k * 0.27), 1.12, 0.62, 1.12];
      P.add(pd, plateM, new THREE.SphereGeometry(r, 18, 7, 0, TAU, 0, PI * 0.45), ...tf);
      const rim = new THREE.TorusGeometry(r * 0.985, k === 2 ? 0.006 : 0.008, 4, 28); rim.rotateX(PI / 2); rim.translate(0, yE, 0); P.add(pd, k === 2 ? seamM : trimM, rim, ...tf);
      for (let j = -1; j <= 1; j++) { const rv = new THREE.SphereGeometry(0.009, 6, 4); rv.translate(Math.sin(j * 0.5) * r * 0.9, yE + 0.012, Math.cos(j * 0.5) * r * 0.9 * (k ? -1 : 1)); P.add(pd, trimM, rv, ...tf); } }
    if (side > 0) { const hw = new THREE.CylinderGeometry(0.12, 0.12, 0.11, 12, 1, true, -PI / 2 - 0.85, 1.7); P.add(pd, plateM, hw, 0.01, 0.17, 0, 0, 0, -0.12);
      const tp = []; for (let k = 0; k <= 10; k++) { const th = -PI / 2 - 0.85 + k / 10 * 1.7; tp.push([Math.sin(th) * 0.12, 0.055, Math.cos(th) * 0.12]); } P.add(pd, trimM, K.tube(tp, 0.008, 16, 4), 0.01, 0.17, 0, 0, 0, -0.12); }
    return { sh, el, hand, pd, side };
  };
  const armL = mkArm(1), armR = mkArm(-1);
  // ---- legs: heavy mail thigh, cuisse, poleyn with a fan, flared greave with an ember seam, long sabaton ----
  const mkLeg = (side) => {
    const hip = grp(hips, side * HX, -0.05, 0);
    P.add(hip, darkM, K.lathe([[0.086, -0.48], [0.112, -0.32], [0.138, -0.13], [0.142, 0.03]], 12));
    P.add(hip, plateM, K.lathe([[0.106, -0.43], [0.13, -0.3], [0.15, -0.13], [0.154, 0.0]], 12, -1.3, 2.6));
    P.add(hip, trimM, K.lathe([[0.108, -0.435], [0.11, -0.42]], 12, -1.3, 2.6));
    P.add(hip, trimM, K.lathe([[0.152, -0.15], [0.155, -0.135]], 12, -1.3, 2.6));
    const knee = grp(hip, 0, -LT, 0);
    cup(knee, 0.09, 0.085, 0, 0.0, 0.05, -0.12, 0.82, 1.38); fan(knee, side, 0.08, side * 0.086, -0.005, 0.0, -1); // poleyn and its side fan
    { // greave: flared rimmed top, swelling calf behind, a raised shin ridge in front, flared over the instep
      const gg = K.lathe([[0.1, -0.43], [0.076, -0.37], [0.082, -0.3], [0.094, -0.19], [0.096, -0.1], [0.09, -0.04], [0.1, -0.005], [0.108, 0.01]], 14), pa = gg.attributes.position;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(x, z);
        pa.setZ(i, z < 0 ? z * (1 + 0.3 * Math.exp(-((y + 0.17) ** 2) / 0.008)) : z + 0.014 * Math.exp(-a * a / 0.06) * smooth((y + 0.4) / 0.1)); }
      gg.computeVertexNormals(); P.add(knee, plateM, gg); }
    P.add(knee, trimM, K.lathe([[0.102, -0.435], [0.098, -0.418]], 14));
    P.add(knee, trimM, new THREE.TorusGeometry(0.106, 0.008, 4, 18), 0, 0.006, 0, PI / 2, 0, 0);
    P.add(knee, seamM, new THREE.BoxGeometry(0.007, 0.24, 0.007), 0, -0.2, 0.108, -0.04, 0, 0);
    const ankle = grp(knee, 0, -LS, 0);
    P.add(ankle, plateM, new THREE.SphereGeometry(0.072, 12, 8), 0, -0.02, 0.075, 0, 0, 0, 1.05, 0.62, 2.2);
    for (let k = 0; k < 3; k++) P.add(ankle, trimM, new THREE.TorusGeometry(0.075 - k * 0.007, 0.005, 3, 14, PI), 0, -0.02, 0.1 + k * 0.045, 0, 0, 0, 1, 0.75, 1);
    P.add(ankle, darkM, new THREE.BoxGeometry(0.14, 0.025, 0.32), 0, -0.052, 0.075);
    return { hip, knee, ankle };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  // ---- big flared tassets (hinged plates over the thighs) and the frayed front tabard with an ember sigil ----
  const R0 = 0.21, tassets = [];
  for (const phi of [1.0, -1.0]) { // three lames each, 1.5x the old plates, reaching to mid-thigh, every lower edge trimmed
    const pv = grp(hips, Math.sin(phi) * R0, -0.07, Math.cos(phi) * R0 * 0.84); pv.rotation.y = phi;
    for (let k = 0; k < 3; k++) { const r = R0 + 0.03 + k * 0.03, y = -k * 0.115;
      P.add(pv, plateM, K.lathe([[r, y], [r + 0.022, y - 0.08], [r + 0.045, y - 0.155]], 10, -0.72, 1.44), 0, 0, -R0);
      P.add(pv, trimM, K.lathe([[r + 0.046, y - 0.143], [r + 0.049, y - 0.158]], 10, -0.72, 1.44), 0, 0, -R0); }
    tassets.push({ pv, phi, spr: K.spring(80, 9) });
  }
  const tabard = grp(hips, 0, -0.05, 0.225), tabSpr = K.spring(55, 6.5);
  { const hw = 0.09, len = 0.6, cols = 6, sh = new THREE.Shape(); const hem = [];
    sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw * 1.15, -len + 0.05);
    for (let k = cols; k >= 0; k--) { const x = lerp(-hw * 1.15, hw * 1.15, k / cols), y = -len + (k % 2 ? -0.03 - rnd() * 0.04 : 0.03 + rnd() * 0.02); sh.lineTo(x, y); hem.push([x, y, 0.009]); }
    sh.lineTo(-hw, 0);
    P.add(tabard, clothM, new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }), 0, 0, -0.004);
    P.add(tabard, singeM, K.tube(hem, 0.007, 24, 3));
    P.add(tabard, trimM, new THREE.TorusGeometry(0.042, 0.006, 4, 20), 0, -0.2, 0.012);
    P.add(tabard, seamM, new THREE.OctahedronGeometry(0.03), 0, -0.2, 0.01, 0, 0, 0, 0.7, 1.25, 0.25);
    P.add(tabard, trimM, new THREE.BoxGeometry(0.2, 0.02, 0.02), 0, -0.004, 0.004); }
  // ---- the Ember Flasks: three bottles on the left hip sharing the four doses; the glowing level is what is left ----
  const flaskGeo = (pp, sc) => { const add = (m, geo, ...a) => { geo.scale(sc, sc, sc); P.add(pp, m, geo, ...a.map((v, i) => i < 3 ? v * sc : v)); };
    // a round-bellied bottle: bulb, sloped shoulder, a long neck standing proud of the belly, a pale lashing and a fat pale cork
    add(glassM, K.lathe([[0.001, -0.115], [0.03, -0.112], [0.047, -0.095], [0.052, -0.07], [0.047, -0.046], [0.031, -0.033], [0.016, -0.026], [0.0125, -0.012], [0.0125, 0.008]], 10));
    add(corkM, new THREE.TorusGeometry(0.053, 0.0045, 3, 12), 0, -0.07, 0, PI / 2, 0, 0);
    add(corkM, K.lathe([[0.016, 0.004], [0.017, 0.012], [0.0125, 0.014]], 8)); add(corkM, K.lathe([[0.0135, 0.008], [0.0175, 0.04], [0.001, 0.044]], 7)); // collar, cork
    const lq = grp(pp, 0, -0.112 * sc, 0); // the liquid, scaled in y by the level
    P.add(lq, pp === handFlask ? handLiqM : liqM, K.lathe([[0.001, 0], [0.029, 0.002], [0.0445, 0.016], [0.0495, 0.042], [0.0445, 0.066], [0.029, 0.078]].map(([r, y]) => [r * sc, y * sc]), 8)); return lq; };
  const flasks = []; let handFlask = null;
  // three hung in a row on the off-side (left) hip, from the side round toward the back
  for (const [a, r] of [[1.45, 0.335], [1.9, 0.31], [2.35, 0.285]]) { const pv = grp(hips, Math.sin(a) * r, -0.045, Math.cos(a) * r * 0.86); pv.rotation.y = a; const lq = flaskGeo(pv, 1.45); flasks.push({ pv, lq, spr: K.spring(45, 4.5), sprZ: K.spring(40, 4.5) }); }
  const HFS = 1.6; handFlask = grp(armL.hand, 0, -0.1, 0.11); const handLq = flaskGeo(handFlask, HFS); handFlask.visible = false; // oriented each frame

  // ---- broad singed cape (shoulder to shoulder, four hinged rows) with a burning hem ----
  // (pinched in through the middle rows and flared again at the hem, so it hangs like cloth rather than a trapezoid board)
  const cape = []; { let par = grp(torso, 0, 0.56 * TS, -0.19); const LEN = [0.3, 0.28, 0.27, 0.27], WID = [0.6, 0.66, 0.7, 0.84, 1.0], NS = LEN.length, CZ = 0.15;
    for (let k = 0; k < NS; k++) { const seg = grp(par, 0, k ? -LEN[k - 1] : 0, 0), w0 = WID[k], w1 = WID[k + 1], cols = 12, cg = new THREE.PlaneGeometry(1, LEN[k], cols, 2), last = k === NS - 1;
      cg.translate(0, -LEN[k] / 2, 0); cg.rotateY(PI); const pa = cg.attributes.position, jag = []; for (let j = 0; j <= cols; j++) jag.push(j % 2 ? 0.04 + rnd() * 0.09 : rnd() * 0.03);
      for (let i = 0; i < pa.count; i++) { const v = -pa.getY(i) / LEN[k], u = pa.getX(i), w = lerp(w0, w1, v), x = u * w, j = Math.round((0.5 - u) * cols);
        let y = pa.getY(i); if (last && v > 0.99) y -= jag[j];
        pa.setXYZ(i, x, y, CZ * (2 * u) ** 2 + 0.016 * Math.sin(x * 23 + k * 1.7) * (0.4 + v * 0.6) - 0.01 * k); }
      cg.computeVertexNormals(); P.add(seg, capeM, cg);
      if (last) { // the burning hem: a white-hot edge fading up into the cloth (its own mesh: the merge drops vertex colours)
        const pos = [], col = [], idx = [], rows = [[0.002, glowC.clone().lerp(new THREE.Color(1, 1, 1), 0.35).multiplyScalar(1.7)], [0.04, glowC.clone().multiplyScalar(1.1)], [0.12, glowC.clone().multiplyScalar(0.06)]];
        for (let j = 0; j <= cols; j++) { const u = 0.5 - j / cols, x = u * w1, z = CZ * (2 * u) ** 2 + 0.016 * Math.sin(x * 23 + k * 1.7) - 0.01 * k - 0.005;
          for (const [h, c] of rows) { pos.push(x, -LEN[k] - jag[j] + h + (h > 0.1 ? jag[j] * 0.4 : 0), z); col.push(c.r, c.g, c.b); } }
        for (let j = 0; j < cols; j++) for (let r = 0; r < rows.length - 1; r++) { const a = j * rows.length + r, b = a + rows.length; idx.push(a, b, a + 1, a + 1, b, b + 1); }
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); bg.setIndex(idx);
        const bm = new THREE.Mesh(bg, hemM); bm.renderOrder = 1; seg.add(bm); }
      cape.push({ o: seg, spr: K.spring(60 - k * 10, 7), sprZ: K.spring(45, 6), sprY: K.spring(38, 5.5) }); par = seg; } }

  // ---- greatsword: chunky pommel, thick wrapped grip, wide swept guard with ember stones, ricasso with lugs, broad diamond blade ----
  const BL = [[0.045, 0.31], [0.1, 0.35], [0.102, 0.48], [0.095, 0.85], [0.083, 1.2], [0.066, 1.44], [0.0, 1.64]], BT = 0.32, bw = (y) => prof(BL, y);
  const weapon = grp(armR.hand), wtip = new THREE.Object3D();
  P.add(weapon, trimM, K.lathe([[0.001, -0.37], [0.044, -0.36], [0.064, -0.318], [0.058, -0.275], [0.03, -0.25]], 8));
  P.add(weapon, seamM, new THREE.OctahedronGeometry(0.022), 0, -0.374, 0);
  P.add(weapon, leatherM, K.lathe([[0.03, -0.255], [0.033, -0.1], [0.031, 0.045]], 10));
  { const hel = []; for (let k = 0; k <= 72; k++) { const a = k / 72 * TAU * 9; hel.push([Math.cos(a) * 0.033, -0.245 + k / 72 * 0.275, Math.sin(a) * 0.033]); } P.add(weapon, darkM, K.tube(hel, 0.0048, 144, 3)); }
  P.add(weapon, trimM, K.tube([[-0.37, 0.19, 0], [-0.32, 0.115, 0], [-0.17, 0.08, 0], [0, 0.072, 0], [0.17, 0.08, 0], [0.32, 0.115, 0], [0.37, 0.19, 0]], 0.024, 32, 6));
  for (const s of [1, -1]) P.add(weapon, trimM, new THREE.SphereGeometry(0.034, 8, 6), s * 0.374, 0.198, 0);
  P.add(weapon, plateM, new THREE.BoxGeometry(0.15, 0.085, 0.064), 0, 0.078, 0);
  for (const s of [1, -1]) P.add(weapon, eyeM, new THREE.OctahedronGeometry(0.025), 0, 0.078, s * 0.033, 0, 0, 0, 1, 1.3, 0.35);
  P.add(weapon, leatherM, K.lathe([[0.04, 0.1], [0.044, 0.2], [0.043, 0.28], [0.042, 0.32]], 8), 0, 0, 0, 0, 0, 0, 1, 1, 0.55);
  for (const s of [1, -1]) { const lug = new THREE.ConeGeometry(0.019, 0.085, 5); lug.translate(0, 0.0425, 0); P.add(weapon, trimM, lug, s * 0.06, 0.33, 0, 0, 0, -s * (PI / 2 + 0.35)); }
  P.add(weapon, bladeM, K.lathe(BL, 4), 0, 0, 0, 0, 0, 0, 1, 1, BT);
  for (const s of [1, -1]) { // an ember fuller line down each face, always lit, and cooling cracks branching off it
    const sp = []; for (let k = 0; k <= 12; k++) { const y = 0.37 + k / 12 * 0.95; sp.push([0, y, s * (bw(y) * BT + 0.001)]); } P.add(weapon, fullerM, K.tube(sp, 0.0065, 24, 3));
    for (const [x0, y0, dx, dy] of [[0.012, 0.44, 0.016, 0.035], [-0.015, 0.62, -0.014, 0.04], [0.01, 0.86, 0.012, 0.035]]) { const pts = []; let x = x0, y = y0; for (let k = 0; k < 4; k++) { pts.push([x, y, s * (BT * bw(y) * (1 - Math.abs(x) / bw(y)) + 0.0012)]); x += dx * (k % 2 ? -0.4 : 1) + (rnd() - 0.5) * 0.008; y += dy; } P.add(weapon, fullerM, K.tube(pts, 0.0026, 12, 3)); } }
  wtip.position.set(0, 1.62, 0); weapon.add(wtip);
  // Kindle: a flame sheath along the blade (two crossed sheets, procedural flame, additive); also the white halo of an opening
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
  const fg = new THREE.PlaneGeometry(0.62, 1.62); fg.translate(0, 0.3 + 0.81, 0);
  const flames = [0, PI / 2].map((ry, i) => { const m = new THREE.Mesh(fg, flameMat); m.rotation.y = ry; if (i) m.scale.x = 0.55; m.visible = false; m.renderOrder = 2; weapon.add(m); return m; });
  P.finish();
  // (kept low and ahead: it pools ember light on the floor without washing the whole front of the armour orange)
  const aura = new THREE.PointLight(C.glow, 0.85, 7, 1.5); aura.position.set(0, 0.35, 1.0); g.add(aura);
  // ember trail: a short ribbon swept by the outer half of the blade during the cuts and the slam (model space, additive, fading)
  const TRN = 16, TRLIFE = 0.13, trS = [], trPool = Array.from({ length: TRN }, () => ({ a: new V3(), b: new V3(), age: 0 })),trPos = new Float32Array(TRN * 6), trCol = new Float32Array(TRN * 6), trIdx = [];
  for (let i = 0; i < TRN - 1; i++) { const a = i * 2; trIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const trGeo = new THREE.BufferGeometry(); trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3)); trGeo.setIndex(trIdx);
  const trail = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  trail.frustumCulled = false; trail.renderOrder = 2; trail.visible = false; g.add(trail);
  const trC = glowC.clone().lerp(new THREE.Color(1, 0.8, 0.5), 0.25), _gi = new THREE.Matrix4(), _w1 = new V3(), _w2 = new V3();

  // ---- sword poses: grip point, blade direction and an edge hint, all in chest (torso) space ----
  // (authored for the unshortened torso; the shoulders sit 0.066 lower now, so every grip follows them down)
  const pose = (px, py, pz, dx, dy, dz, ex = 0, ey = 0, ez = 1) => ({ P: new V3(px, py - 0.55 * (1 - TS), pz), D: new V3(dx, dy, dz).normalize(), E: new V3(ex, ey, ez) });
  // rest: on the right shoulder with the flat turned to the camera behind; guard: two hands forward, flat up
  const REST = pose(-0.2, 0.4, 0.25, -0.3, 0.86, -0.42, 0.94, 0.33, 0), GUARD = pose(-0.05, 0.17, 0.4, 0.06, 0.66, 0.75, 1, 0, -0.08);
  // winded: leaning on the blade, point planted on the floor ahead (chest pitched ~35 degrees, so forward in chest space is down-forward)
  const WINDED = pose(-0.06, 0.49, 0.45, -0.05, 0.0, 1, 1, 0, 0.05), TUCK = pose(-0.1, 0.12, 0.26, -0.2, 0.55, -0.8, 0, 0.8, 0.55), POUR = pose(-0.04, 0.12, 0.42, 0, 1, 0.12, 1, 0, 0);
  // swing kinds: 0 / 1 the alternating cuts (strike, overshoot, settle), 2 the overhead wind-up, 3 the slam. keys are [time 0..1, pose];
  // past `end` it blends back. yaw: chest twist [wind-up, follow-through]; the hips lead it and the head counters it
  const SW = {
    0: { end: 0.62, yaw: [-0.72, 0.78], keys: [[0.2, pose(-0.28, 0.62, 0.06, -0.42, 0.72, -0.56)], [0.38, pose(-0.02, 0.33, 0.46, 0.3, 0.0, 1)], [0.5, pose(0.16, 0.08, 0.26, 0.86, -0.48, 0.18)], [0.62, pose(0.08, 0.14, 0.32, 0.74, -0.48, 0.46)]] },
    // cut b is a flat sweep at waist height, left to right, so it never looks like cut a's raised wind-up. The chest twists past
    // the hips, so the follow-through keys point right of chest-forward: the blade ends level, square to the facing, and holds there
    1: { end: 0.74, t3: 0.6, yaw: [0.7, -0.95], keys: [[0.17, pose(0.26, 0.16, 0.2, 0.78, -0.06, -0.62)], [0.38, pose(0.02, 0.2, 0.52, 0.22, -0.04, 0.97)], [0.5, pose(-0.2, 0.19, 0.4, -0.56, -0.05, 0.83)],
      [0.6, pose(-0.23, 0.19, 0.38, -0.6, -0.04, 0.8)], [0.74, pose(-0.16, 0.22, 0.4, -0.42, 0.04, 0.9)]] },
    2: { end: 1, yaw: [0, 0], keys: [[0.55, pose(-0.04, 0.95, 0.12, 0, 0.42, -0.9)], [1, pose(-0.04, 0.97, 0.1, 0, 0.38, -0.92)]] },
    // the slam hangs at the top (blade back past vertical, a small hop) and then whips down in the last few hundredths
    3: { end: 0.6, yaw: [0, 0], keys: [[0.1, pose(-0.04, 0.88, 0.02, 0, 0.5, -0.87)], [0.21, pose(-0.04, 0.88, 0.1, 0, 0.8, -0.6)], [0.3, pose(-0.04, 0.16, 0.34, 0, -0.42, 1)], [0.6, pose(-0.04, 0.15, 0.34, 0, -0.45, 1)]] },
  };
  // the back-hop: the blade trails low and forward in the right hand, the left arm out for balance
  const TRAIL = pose(-0.17, 0.06, 0.3, -0.22, -0.5, 0.84, 0.96, -0.2, 0.1);
  const HOLD = SW[2].keys[1][1];
  // the Overhead apex: grip high over the crest, the blade laid back behind the shoulders (about level once the back arches)
  const APEX = pose(-0.04, 1.06, 0.02, 0, 0.3, -0.95, 1, 0, 0);
  const yawAt = (sw, k) => { const t1 = sw.keys[0][0], t2 = sw.keys[Math.min(2, sw.keys.length - 1)][0], t3 = sw.t3 || t2; // (t2..t3: the held overshoot)
    if (k < t1) return lerp(0, sw.yaw[0], smooth(k / t1));
    const y = lerp(sw.yaw[0], sw.yaw[1], smooth((k - t1) / Math.max(1e-3, t2 - t1)));
    return k > t3 ? y * (1 - 0.2 * smooth((k - t3) / 0.14)) : y; }; // overshoot, then settle back
  const A = { run: 0, swing: 0, swingDur: 0.3, swingKind: 0, ps: 0, lean: 0, air: 0, leap: 0, apx: 0, vx: 0, vz: 0, lx: null, lz: null, lf: null, yr: 0, fight: 0, gw: 0, hold: 0, pr: 0, rollKind: 1,
    pour: 0, kin: false, wind: 0, open: 0, heat: 0, drink: 0, flare: 0, slamHit: false, crouch: 0, trT: 0, P: REST.P.clone(), D: REST.D.clone(), E: REST.E.clone(), S0: pose(0, 0, 0, 0, 1, 0), tip: new V3(), tipOk: false };
  const _P = new V3(), _D = new V3(), _E = new V3(), _g = new V3(), _t = new V3(), _u = new V3(), _hr = new V3(), _lt = new V3(), _pole = new V3();
  const _a1 = new V3(), _b1 = new V3(), _c1 = new V3(), _a2 = new V3(), _b2 = new V3(), _c2 = new V3(), _d = new V3(), _hl = new V3(), _fd = new V3(0, 1, 0), _Y = new V3(0, 1, 0);
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
    if (A.lf !== null && dt > 0) A.yr = damp(A.yr, clamp(angDiff(A.lf, f) / dt, -10, 10), 10, dt); A.lf = f; // turn rate, for the cloth
    const hot = !!(p.hasBuff && p.hasBuff('kindle')), sf = p.resMax ? sat(p.res / p.resMax) : 1, winded = !!p.winded, opening = (p.opening || 0) > 0;
    const cast = p.casting, drinking = !!(cast && cast.name === 'Ember Flask'), prog = cast && cast.time ? sat(cast.t / cast.time) : 0;
    const rollT = p.rollT || 0, rolling = rollT > 0;
    if (rollT > A.pr + 0.02) A.rollKind = p.dash && p.dash.vx * Math.sin(f) + p.dash.vz * Math.cos(f) < 0 ? 2 : 1; A.pr = rollT; // rolling backwards = the hop back
    if (hot && !A.kin) A.pour = 0.75; A.kin = hot;
    if (A.swing > A.ps + 0.02) { A.S0.P.copy(A.P); A.S0.D.copy(A.D); A.fight = 1.8; A.hold = 0; A.slamHit = false; } // a new swing (door VII sets swing directly)
    A.lean = damp(A.lean, moving ? Math.min(1, spd / 7) : 0, 8, dt); A.air = damp(A.air, grounded && !(p.dash && !rolling) ? 0 : 1, 12, dt);
    A.leap = damp(A.leap, p.dash && !rolling ? 1 : 0, 30, dt); A.wind = damp(A.wind, winded ? 1 : 0, 4, dt); A.open = damp(A.open, opening ? 1 : 0, 10, dt);
    A.heat = damp(A.heat, hot ? 1 : 0, 3, dt); A.drink = damp(A.drink, drinking ? 1 : 0, 10, dt);
    if (A.fight > 0) A.fight -= dt; if (cast && !drinking) A.fight = Math.max(A.fight, 1);
    A.gw = damp(A.gw, A.fight > 0 ? 1 : 0, A.fight > 0 ? 9 : 3, dt);
    A.run += dt * spd * 1.5; const ph = A.run, s = Math.sin(ph), c = Math.cos(ph), sp = Math.sin(ph - 0.6), L = A.lean, I = 1 - L;
    const br = Math.sin(t * 1.6), puff = Math.sin(t * 6.5) * (A.wind * 0.9 + sat((0.35 - sf) / 0.35) * 0.4), WD = A.wind, cp = I * (1 - A.gw) * (1 - WD); // cp: idle contrapposto

    // ---- base: heavy stance (weight on the back leg) blended into the walk (pelvis sway and bob, shoulders counter-rotating) ----
    // (the walk bobs ~4% of the height, tilts the hips ~5 degrees over the planted leg and the shoulder line ~9 degrees the other
    // way, and nods the helm twice a stride, so the two halves of the stride differ from the front too)
    hips.position.set(-0.03 * cp + s * 0.05 * L, 0.98 + L * (Math.abs(c) * 0.11 - 0.06), 0);
    hips.rotation.set(0, s * 0.18 * L - 0.12 * I - 0.03 * cp, Math.sin(t * 0.5) * 0.012 * I - 0.045 * cp - s * 0.09 * L);
    body.rotation.set(0.03 + L * 0.07 + WD * 0.12, 0, 0); body.position.set(0, 0, 0); body.scale.set(1, 1, 1);
    // (idle: the shoulders turned ~15 degrees off the hips, toward the lead foot)
    torso.rotation.set(0.04 + br * 0.012 + L * 0.08 + WD * 0.42 + puff * 0.06, -s * 0.34 * L + 0.12 * I + 0.15 * cp, 0.05 * cp + sp * 0.3 * L);
    head.rotation.set(0.08 - L * 0.12 - WD * 0.08 + Math.cos(ph * 2 - 0.6) * 0.05 * L, Math.sin(t * 0.33) * 0.08 * I - 0.1 * I - 0.12 * cp + s * 0.15 * L, -0.04 * cp - sp * 0.05 * L);
    // stance: feet a little wider than the shoulders, the left a half-step ahead, both knees softly bent
    let tl = lerp(-0.3, -s * 0.7, L), tr = lerp(0.18, s * 0.7, L), zl = 0.24 * I, zr = -0.24 * I;
    let slamAir = 0, hopF = 0, hopLand = 0, rollTuck = 0; // (for the grounding and the cloth below)
    const kc = Math.cos(ph - 0.45); let kl = lerp(0.32, 0.2 + Math.pow(Math.max(0, kc), 1.5) * 1.1, L), kr = lerp(0.2, 0.2 + Math.pow(Math.max(0, -kc), 1.5) * 1.1, L);
    kl += WD * 0.5; kr += WD * 0.45; tl -= WD * 0.25; tr -= WD * 0.1;
    let lx = lerp(-0.12, s * 0.7, L), lz = 0.16 + 0.04 * L, le = lerp(-0.4, -0.8, L) - WD * 0.3;
    // ---- the sword: rest on the shoulder (bobbing a beat behind the steps), two-handed guard while fighting, leant on while Winded ----
    _P.copy(REST.P); _D.copy(REST.D); _E.copy(REST.E); blend(GUARD, A.gw); blend(WINDED, WD * (1 - A.gw * 0.5));
    _P.y += Math.sin(ph * 2 - 1.3) * 0.03 * L * (1 - A.gw);
    { const sw0 = s * 0.25 * L * (1 - A.gw); if (Math.abs(sw0) > 1e-4) { // the resting blade's tip sways ~10 degrees against the lead foot
      const cs = Math.cos(sw0), sn = Math.sin(sw0), dx = _D.x; _D.x = dx * cs - _D.y * sn; _D.y = dx * sn + _D.y * cs; _P.x += sw0 * 0.12; } }
    let tw = Math.max(A.gw * (1 - WD), WD), yaw = 0, yH = 0;
    // ---- one-shot moves ----
    if (A.swing > 0 || A.hold > 0) {
      let sw, k, w;
      if (A.swing > 0) { A.swing -= dt; sw = SW[A.swingKind] || SW[0]; k = 1 - Math.max(0, A.swing) / A.swingDur; w = k <= sw.end ? 1 : 1 - smooth((k - sw.end) / (1 - sw.end));
        if (A.swing <= 0 && A.swingKind === 2) A.hold = 0.45; }
      else { A.hold -= dt; if (p.dash && !rolling) A.hold = Math.max(A.hold, 0.05); sw = null; k = 1; w = sat(A.hold / 0.15); }
      if (sw) { sample(sw, k, _t, _u); yaw = yawAt(sw, k) * w; yH = yawAt(sw, Math.min(1, k + 0.08)) * w; }
      else { _t.copy(HOLD.P); _u.copy(HOLD.D); }
      _P.lerp(_t, w); _D.lerp(_u, w); if (_D.lengthSq() < 1e-6) _D.copy(_u); _D.normalize(); tw = lerp(tw, 1, w);
      const kind = sw ? A.swingKind : 2;
      if (kind <= 1) { // step the lead foot in, straighten the back leg, sink and lean into the cut; hips lead, chest follows, head stays on target
        // (coiled upright on the wind-up, the lean arrives with the strike; cut a steps in with the left foot, cut b with the right)
        const e = w * smooth((k - 0.12) / 0.26) * (1 - smooth((k - 0.62) / 0.3)), st = w * smooth(k / 0.3);
        if (kind === 0) { tl -= 0.42 * st; kl += 0.3 * st + 0.2 * e; tr += 0.3 * st; kr = lerp(kr, 0.04, st); }
        // cut b: a long low lunge onto the right foot (front knee ~75 degrees, the pelvis ~20% lower), the back leg long and straight,
        // the chest pitched well over the front knee
        else { tr = lerp(tr, -1.0, st); kr = lerp(kr, 1.2, st) + 0.12 * e; tl = lerp(tl, 0.7, st); kl = lerp(kl, 0.03, st); }
        zl *= 1 - 0.5 * st; zr *= 1 - 0.5 * st;
        torso.rotation.x += (kind ? 0.47 : 0.32) * e; body.rotation.x += (kind ? 0.09 : 0.05) * e; head.rotation.x -= (kind ? 0.36 : 0.27) * e; torso.rotation.z += (kind ? 0.1 : -0.08) * e; }
      else if (kind === 2) { const e = w * smooth(sw ? k / 0.6 : 1); kl += 0.42 * e; kr += 0.36 * e; tl -= 0.25 * e; tr += 0.15 * e; torso.rotation.x -= 0.16 * e; head.rotation.x -= 0.12 * e; body.rotation.x -= 0.04 * e; }
      else { // the slam: the top of the hop (the apex pose below), then a deep lunge
        const pre = w * smooth(k / 0.07) * (1 - smooth((k - 0.2) / 0.08)), imp = smooth((k - 0.2) / 0.1) * w;
        torso.rotation.x += 0.5 * imp; body.rotation.x += 0.1 * imp; head.rotation.x -= 0.25 * imp; slamAir = pre;
        tl = lerp(tl, -0.85, imp); kl = lerp(kl, 1.75, imp); tr = lerp(tr, 0.4, imp); kr = lerp(kr, 0.85, imp);
        if (imp > 0.5 && !A.slamHit) { A.slamHit = true; A.flare = 1; for (let i = 0; i < cape.length; i++) cape[i].spr.v += [2.2, 0.6, 1.2, -1.2][i] || 0; } } // the cape flares up (and the hem whips under)
    }
    hips.rotation.y += yH * 0.45; torso.rotation.y += yaw - yH * 0.45; head.rotation.y -= yaw * 0.8;
    // ---- Kindle: hold the blade upright and pour a flask along it ----
    let lW = 0; // left-hand IK weight toward _lt (overrides the grip)
    if (A.pour > 0) { A.pour -= dt; const k = 1 - A.pour / 0.75, w = smooth(k / 0.15) * (1 - smooth((k - 0.8) / 0.2)); blend(POUR, w); tw *= 1 - w;
      _lt.copy(POUR.P).addScaledVector(POUR.D, lerp(0.42, 1.3, smooth((k - 0.15) / 0.6))).add(_hr.set(0.02, 0, 0.08)); lW = w; head.rotation.x += 0.1 * w;
      _fd.set(-0.08, -0.9, -0.42).normalize(); }
    // ---- Ember Flask: from the belt to the visor and back; the bottle tips neck-down into the visor ----
    if (A.drink > 0.01) { const up = smooth(prog / 0.25) * (1 - smooth((prog - 0.85) / 0.15)) * A.drink;
      head.rotation.x -= 0.4 * up; torso.rotation.x -= 0.08 * up;
      _fd.set(-0.2, -0.45, -0.87).normalize(); _w1.set(0, 0.095, 0.2).applyEuler(head.rotation).add(head.position).addScaledVector(_fd, -0.125);
      _lt.set(0.18, -0.08, 0.17).lerp(_w1, up); _fd.lerp(_hr.set(0.05, 1, 0.15), 1 - up).normalize(); lW = Math.max(lW, A.drink); tw *= 1 - A.drink; }
    // ---- roll: a tucked forward roll, or a hop back when no direction is held ----
    if (rolling) { const k = 1 - rollT / 0.42;
      if (A.rollKind === 1) { const tuck = Math.sin(sat(k / 0.92) * PI); hips.rotation.x = smooth(sat((k - 0.06) / 0.8)) * TAU; hips.position.y = 0.98 - 0.52 * tuck; rollTuck = tuck;
        torso.rotation.x += 0.9 * tuck; head.rotation.x += 0.4 * tuck; tl = lerp(tl, -1.75, tuck); tr = lerp(tr, -1.5, tuck); kl = lerp(kl, 2.15, tuck); kr = lerp(kr, 2.0, tuck); blend(TUCK, tuck); tw = lerp(tw, 1, tuck); }
      else { // the hop back: knees tucked in flight, chest over them, the blade trailing low in one hand, a crouch on landing
        const hop = Math.sin(k * PI); hopF = smooth(k / 0.16) * (1 - smooth((k - 0.62) / 0.18)); hopLand = smooth((k - 0.68) / 0.14);
        hips.position.y += 0.15 * hop; body.rotation.x += 0.16 * hopF; torso.rotation.x += 0.2 * hopF; head.rotation.x -= 0.18 * hopF;
        tl = lerp(tl, -0.95, hopF); tr = lerp(tr, -0.7, hopF); kl = lerp(kl, 1.6, hopF); kr = lerp(kr, 1.45, hopF);
        A.crouch = Math.max(A.crouch, hopLand); blend(TRAIL, smooth(k / 0.2) * (1 - smooth((k - 0.72) / 0.28))); tw = lerp(tw, 0, hopF); lx = lerp(lx, -0.7, hopF); lz = lerp(lz, 0.6, hopF); le = lerp(le, -0.5, hopF); }
    }
    if (!(rolling && A.rollKind === 2)) A.crouch = damp(A.crouch, 0, 6, dt);
    if (A.crouch > 0.01) { const q = A.crouch; kl += 0.8 * q; kr += 0.7 * q; tl -= 0.42 * q; tr -= 0.3 * q; torso.rotation.x += 0.22 * q; head.rotation.x -= 0.15 * q; }
    // ---- airborne (knees tucked) ----
    if (A.air > 0.01 && !rolling) { const q = A.air; tl = lerp(tl, -0.85, q); tr = lerp(tr, 0.25, q); kl = lerp(kl, 1.2, q); kr = lerp(kr, 0.7, q); lz = lerp(lz, 0.45, q); }
    // ---- the Overhead apex: from the leap's take-off through the top of the slam, one held pose in clear air: the spine arched
    // back ~20 degrees, thighs up ~45 degrees, heels tucked to the seat, both elbows up and out, the blade hanging behind the back
    const apx = rolling || p.pose === 'fall' ? 0 : Math.max(A.leap, slamAir); A.apx = apx;
    if (apx > 0.01) { tl = lerp(tl, -0.95, apx); tr = lerp(tr, -0.72, apx); kl = lerp(kl, 2.25, apx); kr = lerp(kr, 2.1, apx); zl = lerp(zl, 0.1, apx); zr = lerp(zr, -0.1, apx);
      torso.rotation.x -= 0.46 * apx; body.rotation.x += 0.05 * apx; head.rotation.x += 0.22 * apx; hips.position.y = lerp(hips.position.y, 0.96, apx); blend(APEX, apx); tw = lerp(tw, 1, apx); }
    const fall = p.pose === 'fall';
    if (fall) { body.rotation.x = 1.28 + Math.sin(t * 2.3) * 0.05 + L * 0.12; body.position.set(0, 0.75, -0.95); body.rotation.z = Math.sin(t * 1.7) * 0.05;
      tl = 0.25 + Math.sin(t * 5) * 0.05; tr = 0.25 - Math.sin(t * 5) * 0.05; kl = kr = 0.7; if (A.swing <= 0) { lx = -2.3; lz = 0.75; le = -0.5; tw = 0; } }
    if (p.flashT > 0) { const q = p.flashT / 0.15; torso.rotation.x -= 0.16 * q; head.rotation.x -= 0.12 * q; }
    // ---- ground the pelvis on the longer leg (on foot; the walk keeps part of its own bob) ----
    const gnd = (fall ? 0 : rolling ? (A.rollKind === 2 ? hopLand : 0) : 1) * (1 - A.air) * (1 - 0.65 * L) * (1 - apx);
    if (gnd > 0.001) { const hz = Math.sin(hips.rotation.z) * HX, need = Math.max(reach(tl, kl, zl) - hz, reach(tr, kr, zr) + hz);
      hips.position.y = lerp(hips.position.y, need - SINK + br * 0.005 + puff * 0.012, gnd); }
    // ---- apply: legs, then both arms by IK onto the grip ----
    const toe = rolling || fall ? 0 : I * (1 - A.air); // toes turned out ~15 degrees in the stance (hip twist plus ankle)
    legL.hip.rotation.set(tl, 0.1 * toe, zl); legR.hip.rotation.set(tr, -0.1 * toe, zr); legL.knee.rotation.x = kl; legR.knee.rotation.x = kr;
    legL.ankle.rotation.y = 0.16 * toe; legR.ankle.rotation.y = -0.16 * toe;
    const tilt = body.rotation.x + (rolling ? 0 : hips.rotation.x);
    legL.ankle.rotation.x = clamp(-(tl + kl + tilt) * 0.85 + (L > 0.2 ? Math.max(0, -s) * 0.35 * L : 0), -0.9, 0.9); legR.ankle.rotation.x = clamp(-(tr + kr + tilt) * 0.85 + (L > 0.2 ? Math.max(0, s) * 0.35 * L : 0), -0.9, 0.9);
    legL.ankle.rotation.z = -zl * 0.9; legR.ankle.rotation.z = -zr * 0.9; // soles flat despite the splay
    // shoulders breathe, and heave when Winded
    const sy = br * 0.004 + puff * 0.016 + 0.045 * A.apx; for (const a of [armL, armR]) { const w = a.side * sp * 0.022 * L; a.sh.position.y = SHY + sy + w; a.pd.position.y = PDY + sy * 1.3 + w * 1.2; }
    armR.sh.rotation.set(-0.4, 0, -0.2); armR.el.rotation.x = -0.8;
    ik(armR, _P, _pole.set(-0.75, lerp(-0.55, 0.4, A.apx), -0.15), 1, _hr); // (elbows up and out at the Overhead apex)
    // edge: leads along the tip's motion during a cut, otherwise follows the pose (either edge, it is double-edged)
    _t.copy(_P).addScaledVector(_D, 1.2);
    if (A.tipOk && dt > 0 && A.swing > 0) { _u.subVectors(_t, A.tip); if (_u.lengthSq() > (dt * 2.5) ** 2) _E.copy(_u); }
    A.tip.copy(_t); A.tipOk = true;
    _E.addScaledVector(_D, -_E.dot(_D)); if (_E.lengthSq() < 1e-6) _E.set(1, 0, 0).addScaledVector(_D, -_D.x); _E.normalize();
    // roll the blade about its own axis so a flat faces the camera (most of the way through a swing, partly at rest): seen
    // edge-on from the play camera the broad blade collapses to a hairline. (torso.matrixWorld is last frame's: close enough)
    _w1.setFromMatrixPosition(camera.matrixWorld); torso.worldToLocal(_w1).sub(_P).normalize(); _w2.crossVectors(_D, _w1);
    const cw = (A.swing > 0 ? 0.9 : 0.6) * sat(_w2.length() * 2.2 - 0.15);
    if (cw > 0.01) { _w2.normalize(); if (_w2.dot(_E) < 0) _w2.negate(); _E.lerp(_w2, cw).addScaledVector(_D, -_E.dot(_D)); if (_E.lengthSq() < 1e-6) _E.copy(_w2); _E.normalize(); }
    if (_E.dot(A.E) < 0) _E.negate();
    A.E.lerp(_E, 1 - Math.exp(-22 * dt)).addScaledVector(_D, -A.E.dot(_D)); if (A.E.lengthSq() < 1e-6) A.E.copy(_E); A.E.normalize();
    A.P.copy(_P); A.D.copy(_D);
    _c1.crossVectors(A.E, _D); _m1.makeBasis(A.E, _D, _c1); _q.setFromRotationMatrix(_m1); // the blade's orientation in torso space
    _q2.copy(armR.sh.quaternion).multiply(armR.el.quaternion); weapon.quaternion.copy(_qi.copy(_q2).invert().multiply(_q));
    armL.sh.rotation.set(lx, 0, lz); armL.el.rotation.x = le;
    const gW = tw * (1 - lW); _pole.set(0.8, lerp(-0.5, 0.4, A.apx), -0.1);
    if (gW > 0.01) ik(armL, _g.copy(_hr).addScaledVector(_D, -0.17), _pole, gW, null);
    if (lW > 0.01) ik(armL, _lt, _pole.set(0.7, -0.6, -0.3), lW, null);
    for (const a of [armL, armR]) a.pd.quaternion.set(0, 0, 0, 1).slerp(a.sh.quaternion, 0.38);
    // ---- cloth: cape (lags on turns), tabard, tassets, flasks, plume ----
    const chestTilt = rolling ? 0 : tilt + torso.rotation.x;
    // cape: an S in motion: the top row lies along the back, the middle rows swing out, the hem row curls back down; each row
    // twists ~12 degrees against the next with the stride, it wraps round the back in the roll, and flares on the slam. Each
    // row's angle from the vertical is soft-capped (about 50 degrees at most), so it never shoots out level as one plank.
    A.flare = Math.max(0, A.flare - dt / 0.32); const fl0 = A.flare * A.flare * (3 - 2 * A.flare);
    const mot = sat(Math.max(L, A.air, Math.max(0, A.vz) / 5)), bk = Math.max(sat(-A.vz / 4), hopF); // bk: moving backwards (the hop): the cape is pressed in and curls under
    const shp = Math.max(mot * (1 - bk), fl0), CS = [0, 0.15, 0.34, -0.5], CCAP = [0.62, 0.78, 0.9, 0.7];
    let acc = chestTilt;
    for (let k = 0; k < cape.length; k++) { const q = cape[k];
      const tgt = k === 0 ? clamp(0.03 + Math.max(0, Math.max(tl, tr)) * 0.12 + Math.max(0, A.vz) * 0.012 + A.air * 0.3 + fl0 * 0.4 + Math.sin(t * 6.5) * 0.04 * L - chestTilt * 0.6 - 0.12 * bk, -chestTilt - 0.05, 1.5)
        : 0.025 + CS[k] * shp * (1 - bk) - 0.16 * bk - Math.max(0, cape[0].o.rotation.x - 0.35) * 0.12 + Math.sin(t * 7 - k * 1.1) * (0.06 * L + 0.02);
      let rx = q.spr.step(tgt, dt), rz = q.sprZ.step(-A.vx * 0.04 * (k ? 0.5 : 1) - A.yr * 0.035 * (k ? 1 : 0.4) + Math.sin(ph - k * 0.8) * 0.075 * L * (0.4 + 0.3 * k), dt);
      if (hopF > 0.01) rx = lerp(rx, tgt, hopF * 0.8); // (the hop is too quick for the spring: the cape would trail the lean as a board)
      const wr = Math.min(1, rollTuck * 1.8); if (wr > 0.01) { rx = lerp(rx, k ? -0.42 : -0.12, wr * 0.85); rz *= 1 - wr; }
      if (!rolling) { const a = acc + rx, c0 = CCAP[k] - 0.16; if (a > c0) rx = c0 + 0.16 * Math.tanh((a - c0) / 0.16) - acc; } acc += rx;
      q.o.rotation.x = rx; q.o.rotation.z = rz; q.o.rotation.y = q.sprY.step(-A.yr * 0.05 * (k ? 1 : 0.3) + Math.sin(ph - k * 0.8 - 0.6) * (k ? 0.21 : 0.08) * L, dt); }
    tabard.rotation.x = -clamp(tabSpr.step(Math.max(0, -Math.min(tl, tr)) * 1.05 + tilt + A.vz * -0.03 + A.air * 0.3 + Math.sin(t * 8) * 0.03 * L, dt), -0.1, 1.4);
    for (const q of tassets) { const lg = q.phi > 0 ? tl : tr; q.pv.rotation.x = -clamp(q.spr.step(Math.max(0, -lg) * 0.85 + 0.03 + tilt * 0.4, dt), -0.05, 1.2); }
    const uses = p.sk && p.sk[6] ? p.sk[6].uses : 4, left = clamp((uses === Infinity ? 4 : uses) - (drinking ? 1 : 0), 0, 4);
    for (let i = 0; i < flasks.length; i++) { const fc = 4 / flasks.length, q = flasks[i], lv = clamp(left - fc * (flasks.length - 1 - i), 0, fc) / fc;
      q.lq.visible = lv > 0.01; q.lq.scale.y = Math.max(0.05, lv);
      const bob = Math.sin(ph * 2 + i) * 0.18 * L;
      q.pv.rotation.x = q.spr.step(-tilt + A.vz * 0.035 + bob, dt); q.pv.rotation.z = q.sprZ.step(-A.vx * 0.04 + Math.sin(ph + i) * 0.08 * L, dt); }
    handFlask.visible = A.drink > 0.05 || (A.pour > 0 && A.pour > 0.12);
    handLq.scale.y = drinking ? Math.max(0.05, 1 - prog) : A.pour > 0 ? Math.max(0.05, sat(A.pour / 0.75 * 1.4)) : 1;
    if (handFlask.visible) { // the bottle in the left fist, neck along _fd (torso space), gripped at its shoulder
      _q2.copy(armL.sh.quaternion).multiply(armL.el.quaternion); _qi.copy(_q2).invert(); _t.copy(_fd).applyQuaternion(_qi);
      _q.setFromUnitVectors(_Y, _fd); handFlask.quaternion.copy(_qi).multiply(_q); handFlask.position.set(0, -0.045, 0.012).addScaledVector(_t, 0.04 * HFS); }
    // plume: the root springs toward hanging down the back; segment k replays the root's motion k*PLAG s later
    { const pX = Math.max(0, A.vz) * 0.016 + A.air * 0.25 + hopF * 0.2 - (chestTilt + head.rotation.x) * 0.55 - 0.3 * rollTuck, pZ = -A.vx * 0.05 - A.yr * 0.06 - head.rotation.y * 0.3;
      const X0 = plSprX.step(pX, dt), Z0 = plSprZ.step(pZ, dt), T = plH.t, n = T.length;
      if (n && t < T[n - 1] - 1) { T.length = 0; plH.x.length = 0; plH.z.length = 0; }
      if (T.length && t <= T[T.length - 1]) { plH.x[T.length - 1] = X0; plH.z[T.length - 1] = Z0; } else { T.push(t); plH.x.push(X0); plH.z.push(Z0); }
      while (T.length > 400 || (T.length > 2 && T[1] < t - (PL * PLAG + 0.05))) { T.shift(); plH.x.shift(); plH.z.shift(); }
      let px = 0, pz = 0;
      for (let k = 0; k < PL; k++) { const xk = plAt(k * PLAG, plH.x), zk = plAt(k * PLAG, plH.z), o = plume[k].o;
        o.rotation.x = PBASE[k] + xk - px + (k ? Math.sin(t * 7.5 - k * 0.9) * 0.05 * L + Math.sin(t * 1.3 + k) * 0.018 : 0);
        o.rotation.z = zk - pz + (k ? Math.sin(t * 6 - k * 0.9) * 0.05 * L + Math.sin(t * 1.1 + k * 0.7) * 0.02 : 0); px = xk; pz = zk; } }
    // ember trail behind the outer blade during the strike part of each cut and the slam
    if (!G.headless) { const ks = A.swing > 0 ? 1 - A.swing / A.swingDur : -1, kd = A.swingKind;
      const on = ks >= 0 && (kd === 3 ? ks > 0.21 && ks < 0.42 : kd <= 1 && ks > 0.24 && ks < 0.64);
      for (const s of trS) s.age += dt; while (trS.length && trS[trS.length - 1].age > TRLIFE) trPool.push(trS.pop());
      if (on || trS.length) {
        weapon.updateWorldMatrix(true, false); _gi.copy(g.matrixWorld).invert();
        _w1.set(0, kd === 1 ? 1.12 : 0.8, 0).applyMatrix4(weapon.matrixWorld).applyMatrix4(_gi); _w2.set(0, 1.66, 0).applyMatrix4(weapon.matrixWorld).applyMatrix4(_gi);
        A.trT += dt; if (on && (A.trT >= 0.008 || !trS.length)) { A.trT = 0; const s = trS.length >= TRN - 1 ? trS.pop() : trPool.pop(); s.a.copy(_w1); s.b.copy(_w2); s.age = 0; trS.unshift(s); }
        const n = Math.min(TRN, trS.length + (on ? 1 : 0)), br2 = (kd === 1 ? 0.7 : 1) * (1 + A.heat * 0.6 + A.open * 0.8);
        for (let i = 0; i < TRN; i++) { const j = Math.min(i, n - 1), s = on ? (j === 0 ? null : trS[j - 1]) : trS[j], a = s ? s.a : _w1, b = s ? s.b : _w2;
          const f = i < n ? Math.pow(1 - (s ? s.age : 0) / TRLIFE, 1.6) * br2 : 0;
          trPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); trCol.set([trC.r * f * 0.25, trC.g * f * 0.25, trC.b * f * 0.25, trC.r * f * 1.7, trC.g * f * 1.7, trC.b * f * 1.7], i * 6); }
        trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true; trGeo.setDrawRange(0, Math.max(0, n - 1) * 6); trail.visible = n >= 2;
      } else trail.visible = false; }
    // ---- glow: seams breathe with stamina, the blade heats with Kindle and goes white-hot on an opening ----
    const swingGlow = A.swing > 0 && A.swingKind >= 2 ? 0.5 : 0, O = A.open;
    seamM.color.copy(seamBase).lerp(whiteHot, 0.6 * O).multiplyScalar((0.25 + 0.75 * sf) * (1 + 0.15 * br) * (1 + 0.6 * A.heat + 0.6 * O) * (1 - 0.55 * WD));
    eyeM.color.copy(eyeBase).lerp(whiteHot, 0.5 * O).multiplyScalar((1 + 1.2 * O + 0.4 * A.heat + swingGlow) * (1 - 0.5 * WD) * (0.9 + 0.1 * Math.sin(t * 3.1)));
    singeM.color.copy(singeBase).multiplyScalar(0.85 + 0.25 * Math.sin(t * 2.2) + A.heat * 0.9 + O * 0.6);
    hemM.color.setScalar(0.85 + 0.2 * Math.sin(t * 2.2 + 1) + A.heat * 0.6 + O * 0.4);
    const flick = 0.8 + 0.2 * Math.sin(t * 23) * Math.sin(t * 7.3);
    fullerM.color.copy(fullerBase).lerp(whiteHot, 0.7 * O).multiplyScalar(0.75 + 0.3 * sf + A.heat * 0.8 * flick + O * 1.4 + swingGlow);
    heatU.value = A.heat * flick + swingGlow * 0.4; whiteU.value = O * (1.3 + 0.3 * Math.sin(t * 14));
    liqM.color.copy(liqBase).multiplyScalar(0.85 + 0.15 * Math.sin(t * 2.6));
    handLiqM.color.copy(liqBase).multiplyScalar(drinking ? 2.0 : 1.7);
    rimU.value.copy(rimBase).multiplyScalar(1 + O * 1.2 + A.heat * 0.3);
    const ign = A.pour > 0 ? smooth((1 - A.pour / 0.75 - 0.2) / 0.5) : 1, fl = Math.max(A.heat * ign, O * 0.75);
    flameMat.uniforms.uC.value.copy(glowC).lerp(haloC, O * (1 - A.heat * 0.5));
    flameMat.uniforms.uI.value = fl * (1.1 + 0.15 * Math.sin(t * 17)); flameMat.uniforms.uT.value = t; for (const m of flames) m.visible = fl > 0.02 && !G.headless;
    aura.intensity = 0.85 + A.heat * 1.6 + O * 3.5 + (p.flashT > 0 ? 6 : 0) + swingGlow * 2;
    A.ps = A.swing;
  }
  return { group: g, update, anim: A, wtip, body, swing(kind = 0, dur = 0.3) { A.swing = A.swingDur = dur; A.swingKind = kind; } };
};
