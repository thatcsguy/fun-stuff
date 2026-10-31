// =============================================================================
//  §11  Player — THE CHRONOBLADE
//   Procedural model (coat with swaying panels + glowing seams, curved blade,
//   hourglass pommel), procedural animation, movement + collision, auto-attacks,
//   the six abilities, resources (Flux / Fractures / Hourglass), statuses,
//   damage intake, 30 Hz state ring buffer, Echo / ghosts, Zero Hour cinematic.
// =============================================================================

// ---------------------------------------------------------------- status definitions (§9.2)
const STATUS_DEFS = {
  burning:   { name: 'Burning', short: 'BRN', color: '#ff7a2a', dps: 40, tick: 0.5 },
  drowning:  { name: 'Drowning', short: 'DRN', color: '#4fc3ff' },
  petrified: { name: 'Petrified', short: 'STN', color: '#b8b8b8', stun: true },
  stunned:   { name: 'Stunned', short: 'STU', color: '#ffe066', stun: true },
  entropy:   { name: 'Entropy', short: 'ENT', color: '#c56bff', permanent: true },
  converge:  { name: 'Fate — Converge', short: 'CNV', color: '#b266ff' },
  diverge:   { name: 'Fate — Diverge', short: 'DIV', color: '#b266ff' },
  undertow:  { name: 'Undertow Mark', short: 'UND', color: '#8a7dff' },
  borrowed:  { name: 'Borrowed Time', short: 'BT', color: '#5ff2ff', buff: true },
  kintsugi:  { name: 'Kintsugi', short: 'KIN', color: '#ffc845', buff: true },
  rooted:    { name: 'Rooted', short: 'RT', color: '#b266ff', root: true },
};

// ---------------------------------------------------------------- 30 Hz ring buffer of player states (§9.5)
class PlayerHistory {
  constructor(hz, seconds) {
    this.cap = Math.ceil(hz * seconds) + 2; this.d = new Float32Array(this.cap * 4); this.head = 0; this.n = 0; this.acc = 0; this.step = 1 / hz;
  }
  clear() { this.head = 0; this.n = 0; this.acc = 0; }
  push(x, z, hp, t) { const i = this.head * 4; this.d[i] = x; this.d[i + 1] = z; this.d[i + 2] = hp; this.d[i + 3] = t; this.head = (this.head + 1) % this.cap; if (this.n < this.cap) this.n++; }
  /** state `ago` seconds before now (sim time). out = {x,z,hp,t,valid}; interpolates between samples */
  sampleAgo(ago, out) {
    out = out || { x: 0, z: 0, hp: 0, t: 0, valid: false };
    if (!this.n) { out.valid = false; return out; }
    const want = Game.time - ago;
    let prev = -1;
    for (let k = 0; k < this.n; k++) {
      const idx = ((this.head - 1 - k) % this.cap + this.cap) % this.cap, i = idx * 4;
      if (this.d[i + 3] <= want) {
        if (prev >= 0) { const j = prev * 4, span = this.d[j + 3] - this.d[i + 3], f = span > 0 ? (want - this.d[i + 3]) / span : 0;
          out.x = lerp(this.d[i], this.d[j], f); out.z = lerp(this.d[i + 1], this.d[j + 1], f); out.hp = lerp(this.d[i + 2], this.d[j + 2], f); out.t = want; }
        else { out.x = this.d[i]; out.z = this.d[i + 1]; out.hp = this.d[i + 2]; out.t = this.d[i + 3]; }
        out.valid = true; return out;
      }
      prev = idx;
    }
    // older than the buffer: oldest sample
    const i = prev * 4; out.x = this.d[i]; out.z = this.d[i + 1]; out.hp = this.d[i + 2]; out.t = this.d[i + 3]; out.valid = true; return out;
  }
}

// ---------------------------------------------------------------- the procedural Chronoblade model (§8.3)
const COAT_LEN = 1.2;
const COAT_SWAY = { value: new THREE.Vector3() };       // x,z = trailing lag (local), y = flare
const COAT_VERT_HEAD = 'uniform vec3 uSway; uniform float uCoatLen;';
const COAT_VERT_BODY = `
  { float cw = clamp(-position.y / uCoatLen, 0.0, 1.0); cw *= cw;
    transformed.x += uSway.x * cw; transformed.z += uSway.z * cw;
    vec2 rd = normalize(position.xz + vec2(1e-4)); transformed.xz += rd * uSway.y * cw;
    transformed.y += uSway.y * cw * 0.25; }
`;
function coatHook(shader) { shader.uniforms.uSway = COAT_SWAY; shader.uniforms.uCoatLen = { value: COAT_LEN }; }

function bladeShapeCurve(s) { return 0.13 * s * s; }        // blade curvature (x offset by height fraction)
function bladeWidth(s) { return 0.085 * (1 - Math.pow(s, 2.6)) + 0.006; }
const BLADE_Y0 = 0.13, BLADE_LEN = 1.14;

/** builds the Chronoblade hierarchy. M(name) returns the material for a part. Returns {root, body, parts[], refs} */
function buildChronoblade(M, opts) {
  opts = opts || {};
  const parts = [], refs = {};
  const piv = (name, parent, x, y, z) => { const o = new THREE.Group(); o.name = name; o.position.set(x || 0, y || 0, z || 0); parent.add(o); parts.push(o); refs[name] = o; return o; };
  const mesh = (geo, mat, parent, x, y, z, shadow) => { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (shadow !== false && !opts.echo) m.castShadow = true; parent.add(m); return m; };
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);

  const root = new THREE.Group(); root.name = 'chronoblade';
  const body = piv('body', root, 0, 0, 0);
  const hips = piv('hips', body, 0, 0.95, 0);
  // legs
  for (const side of [1, -1]) {
    const L = side > 0 ? 'L' : 'R';
    const leg = piv('leg' + L, hips, 0.105 * side, 0, 0);
    mesh(cap(0.075, 0.3), M('pants'), leg, 0, -0.21, 0);
    const knee = piv('knee' + L, leg, 0, -0.43, 0);
    mesh(cap(0.064, 0.3), M('pants'), knee, 0, -0.2, 0);
    const boot = mesh(new THREE.BoxGeometry(0.12, 0.1, 0.24), M('boots'), knee, 0, -0.43, 0.04);
    boot.geometry.translate(0, 0, 0);
  }
  // spine / torso
  const spine = piv('spine', hips, 0, 0.04, 0);
  const torso = mesh(cap(0.15, 0.32), M('torso'), spine, 0, 0.3, 0); torso.scale.set(1.15, 1, 0.82);
  mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 20), M('gold'), spine, 0, 0.06, 0).rotation.x = Math.PI / 2;   // belt
  // chest strap with a glowing seam
  const strap = mesh(new THREE.BoxGeometry(0.035, 0.42, 0.02), M('seam'), spine, 0.02, 0.3, 0.128, false); strap.rotation.z = 0.55;

  // coat (panels hang from shoulder line, geometry frame: top at y=0, bottom at -COAT_LEN)
  const coat = piv('coat', spine, 0, 0.56, -0.01);
  const PANELS = 6, gap = 0.07;
  const rTop = 0.2, rBot = 0.52;
  for (let i = 0; i < PANELS; i++) {
    if (i === 0) continue;   // front opening (panel centred on +Z)
    const span = TAU / PANELS, start = Math.PI / 2 + i * span - span / 2 + gap / 2;   // theta 0 = +X in three's cylinder? (x = sin, z = cos)
    const g = new THREE.CylinderGeometry(rTop, rBot, COAT_LEN, 4, 6, true, start - Math.PI / 2, span - gap);
    g.translate(0, -COAT_LEN / 2, 0);
    mesh(g, M('coat'), coat);
  }
  // seams: thin glowing strips in the gaps (+ the front opening edges)
  for (let i = 0; i < PANELS; i++) {
    const span = TAU / PANELS, a = i * span + span / 2;
    const g = new THREE.CylinderGeometry(rTop * 0.97, rBot * 0.97, COAT_LEN * 0.98, 1, 6, true, a - gap / 2 - 0.004, gap * 0.9);
    g.translate(0, -COAT_LEN / 2, 0);
    mesh(g, M('seam'), coat, 0, 0, 0, false);
  }
  // glowing hem band
  const hemG = new THREE.CylinderGeometry(rBot * 1.005, rBot * 1.02, 0.035, 24, 1, true, 0.62, TAU - 1.24);
  hemG.translate(0, -COAT_LEN + 0.02, 0);
  refs.hem = mesh(hemG, M('hem'), coat, 0, 0, 0, false);
  // collar
  mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.17, 14, 1, true), M('coat'), spine, 0, 0.64, -0.01);
  mesh(new THREE.TorusGeometry(0.133, 0.01, 4, 20), M('seam'), spine, 0, 0.725, -0.01, false).rotation.x = Math.PI / 2;
  // head
  const head = piv('head', spine, 0, 0.7, 0);
  mesh(new THREE.SphereGeometry(0.115, 16, 12), M('skin'), head, 0, 0.11, 0.01);
  const hood = mesh(new THREE.SphereGeometry(0.148, 16, 12, Math.PI / 2 + 0.75, TAU - 1.5, 0, Math.PI * 0.78), M('hood'), head, 0, 0.115, -0.015);
  hood.scale.set(1.0, 1.08, 1.12);
  refs.visor = mesh(new THREE.BoxGeometry(0.17, 0.022, 0.03), M('visor'), head, 0, 0.12, 0.105, false);
  // hood tail (a drape down the back)
  const tail = mesh(new THREE.ConeGeometry(0.08, 0.32, 8, 1, true), M('hood'), head, 0, -0.02, -0.13); tail.rotation.x = 2.7;

  // arms
  const mkArm = (side) => {
    const L = side > 0 ? 'L' : 'R';
    const sh = piv('sh' + L, spine, 0.205 * side, 0.52, 0);
    const pauld = mesh(new THREE.SphereGeometry(0.1, 12, 8, 0, TAU, 0, Math.PI * 0.55), M('metal'), sh, 0.02 * side, 0.02, 0);
    pauld.scale.set(1.25, 0.8, 1.1); pauld.rotation.z = -0.35 * side;
    mesh(new THREE.TorusGeometry(0.1, 0.008, 4, 16, Math.PI), M('seam'), sh, 0.02 * side, 0.015, 0, false).rotation.set(Math.PI / 2, 0, -0.35 * side);
    const yaw = piv('yaw' + L, sh, 0, 0, 0);
    const arm = piv('arm' + L, yaw, 0, 0, 0);
    mesh(cap(0.056, 0.22), M('coat'), arm, 0, -0.15, 0);
    const elbow = piv('elbow' + L, arm, 0, -0.3, 0);
    mesh(cap(0.05, 0.2), M('coat'), elbow, 0, -0.13, 0);
    mesh(new THREE.TorusGeometry(0.052, 0.008, 4, 14), M('seam'), elbow, 0, -0.24, 0, false).rotation.x = Math.PI / 2;
    const hand = piv('hand' + L, elbow, 0, -0.29, 0);
    mesh(new THREE.SphereGeometry(0.052, 10, 8), M('glove'), hand, 0, 0, 0);
    return hand;
  };
  mkArm(1);
  const handR = mkArm(-1);

  // ---- blade (in the right hand). Local +Y runs from grip to tip.
  const blade = piv('blade', handR, 0, 0, 0);
  const grip = mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.2, 8), M('grip'), blade, 0, 0.0, 0);
  const guard = mesh(new THREE.BoxGeometry(0.16, 0.028, 0.06), M('gold'), blade, 0, 0.115, 0); guard.rotation.y = 0;
  // curved blade body (extruded crescent)
  const shape = new THREE.Shape(), N = 18, back = [], front = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, y = BLADE_Y0 + s * BLADE_LEN, c = bladeShapeCurve(s), w = bladeWidth(s);
    back.push(new THREE.Vector2(c - w * 0.35, y)); front.push(new THREE.Vector2(c + w * 0.65, y));
  }
  shape.moveTo(back[0].x, back[0].y);
  for (let i = 1; i <= N; i++) shape.lineTo(back[i].x, back[i].y);
  for (let i = N; i >= 0; i--) shape.lineTo(front[i].x, front[i].y);
  const bg = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1 });
  bg.translate(0, 0, -0.006);
  mesh(bg, M('blade'), blade);
  // glowing cutting edge (tube along the front edge)
  const edgePts = front.map((p, i) => new THREE.Vector3(p.x + 0.002, p.y, 0));
  edgePts[edgePts.length - 1].set(back[N].x * 0.5 + front[N].x * 0.5, BLADE_Y0 + BLADE_LEN + 0.01, 0);
  const eg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePts), 40, 0.0085, 5, false);
  refs.edge = mesh(eg, M('edge'), blade, 0, 0, 0, false);
  // fuller (inner glow line)
  const fullPts = []; for (let i = 1; i <= 12; i++) { const s = i / 14; fullPts.push(new THREE.Vector3(bladeShapeCurve(s) + bladeWidth(s) * 0.12, BLADE_Y0 + s * BLADE_LEN, 0.011)); }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fullPts), 20, 0.004, 4, false), M('seam'), blade, 0, 0, 0, false);
  // hourglass pommel
  const hg = piv('hourglass', blade, 0, -0.2, 0);
  const prof = [[0.0, -0.085], [0.042, -0.08], [0.048, -0.055], [0.026, -0.02], [0.008, 0], [0.026, 0.02], [0.048, 0.055], [0.042, 0.08], [0.0, 0.085]].map((p) => new THREE.Vector2(p[0], p[1]));
  mesh(new THREE.LatheGeometry(prof, 16), M('glass'), hg, 0, 0, 0, false);
  mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.016, 14), M('gold'), hg, 0, 0.092, 0);
  mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.016, 14), M('gold'), hg, 0, -0.092, 0);
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3; mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 4), M('gold'), hg, Math.sin(a) * 0.05, 0, Math.cos(a) * 0.05); }
  const sandG = new THREE.ConeGeometry(0.036, 0.06, 12); sandG.translate(0, 0.03, 0);
  refs.sandLow = mesh(sandG, M('sand'), hg, 0, -0.078, 0, false);
  const sandTopG = new THREE.ConeGeometry(0.036, 0.06, 12); sandTopG.rotateX(Math.PI); sandTopG.translate(0, 0.03, 0);
  refs.sandTop = mesh(sandTopG, M('sand'), hg, 0, 0.018, 0, false);
  refs.sandStream = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 4), M('sand'), hg, 0, -0.035, 0, false);

  root.scale.setScalar(opts.scale || 1.12);
  const keep = new Set(); for (const k in refs) if (refs[k].isMesh) keep.add(refs[k]);
  mergeStaticMeshes(root, keep);
  return { root, body, parts, refs };
}

// ---------------------------------------------------------------- pose (procedural animation)
const POSE_KEYS = ['bodyY', 'lean', 'roll', 'twist', 'spineX', 'headX', 'headY', 'legL', 'legR', 'kneeL', 'kneeR',
  'shLX', 'shLZ', 'elbowL', 'yawL', 'yawR', 'armRX', 'armRZ', 'elbowR', 'bladeX', 'bladeY', 'bladeZ', 'spin'];
function makePose() { const p = {}; for (const k of POSE_KEYS) p[k] = 0; return p; }

// ---------------------------------------------------------------- ability definitions (§13.2)
const ABILITIES = {
  dash: {
    id: 'dash', canUse: (p) => p.cds.dash.charges > 0 && !p.dashing,
    use: (p) => p.startDash(),
  },
  rend: {
    id: 'rend', canUse: (p) => p.cds.rend.t <= 0,
    use: (p) => p.doRend(),
  },
  shatter: {
    id: 'shatter', canUse: (p) => p.cds.shatter.t <= 0 && p.flux >= CONFIG.abilities.shatter.cost && !!p.shatterTarget(),
    use: (p) => p.doShatter(),
  },
  recall: {
    id: 'recall', canUse: (p) => p.cds.recall.t <= 0 && p.echo.active && !p.dashing,
    use: (p) => p.doRecall(),
  },
  lance: {
    id: 'lance', canUse: (p) => { if (p.cds.lance.t > 0) return false; const t = p.lanceTarget(); return !!t && p.surfaceDist(t) <= CONFIG.abilities.lance.range; },
    use: (p) => p.doLance(),
  },
  ult: {
    id: 'ult', canUse: (p) => p.hourglass >= CONFIG.abilities.ult.cost && !p.ult && !!p.target,
    use: (p) => p.doZeroHour(),
  },
};

// ---------------------------------------------------------------- Player
// pose-blend helper for Player.computePose (module-level so the per-frame action overlay allocates no closure)
let _poseP = null, _poseW = 0;
function poseBlend(key, v) { _poseP[key] = lerp(_poseP[key], v, _poseW); }

class Player {
  constructor() {
    const C = CONFIG.player;
    this.pos = new THREE.Vector3(0, 0, 8); this.prevPos = this.pos.clone(); this.vis = this.pos.clone();
    this.vel = new THREE.Vector3(); this.ext = new THREE.Vector3(); this.knockV = new THREE.Vector3();
    this.yaw = Math.PI; this.prevYaw = this.yaw; this.visYaw = this.yaw; this.snapT = 0; this.snapYaw = 0;
    this.maxHp = C.maxHp; this.hp = C.maxHp; this.shield = 0; this.alive = true; this.invulnFlags = 0; this.iframeT = 0;
    this.flux = 0; this.hourglass = 0; this.fractures = 0; this.fractureT = 0;
    this.cds = { dash: { t: 0, charges: 2, max: 2 }, rend: { t: 0 }, shatter: { t: 0 }, recall: { t: 0 }, lance: { t: 0 }, ult: { t: 0 } };
    this.statuses = [];
    this.dashing = false; this.dashT = 0; this.dashFrom = new THREE.Vector3(); this.dashTo = new THREE.Vector3(); this.dashId = 0; this.pdFor = -1;
    this.echo = { active: false, x: 0, z: 0, life: 0, max: 7, dmgSince: 0, pinned: false, partT: 0 };
    this.buffer = { id: null, t: 0 };
    this.meleeT = 0; this.comboIdx = 0; this.needleT = 0; this.outOfMeleeT = 0;
    this.act = { type: null, t: 0, dur: 0 }; this.actW = 0; this.trailA = 0;
    this.recallS = null; this.ult = null;
    this.target = null; this.lastSource = null; this.lastHint = null;
    this.history = new PlayerHistory(C.historyHz, C.historySeconds);
    this.histAcc = 0;
    this.runPhase = 0; this.moveAmt = 0; this.swayX = 0; this.swayZ = 0; this.flare = 0;
    this.pose = makePose();
    this.hiltWorld = new THREE.Vector3();
    this.tipWorld = new THREE.Vector3(); this.baseWorld = new THREE.Vector3();
    this.flashT = 0;
    this.talentA = 'afterimage'; this.talentB = 'borrowedPlus';
    this._sample = { x: 0, z: 0, hp: 0, t: 0, valid: false };
    this.buildVisuals();
  }

  // ------------------------------------------------------------ visuals
  buildVisuals() {
    const coatExtra = { vertexHead: COAT_VERT_HEAD, vertexBody: COAT_VERT_BODY, onCompile: coatHook };
    const mats = this.mats = {
      coat: makeArcane({ color: 0x141a26, roughness: 0.72, metalness: 0.18, side: THREE.DoubleSide }, Object.assign({ rim: 0.35, rimColor: 0x3fd8ff, key: 'coat', crackColor: 0xb266ff }, coatExtra)),
      seam: makeArcane({ color: 0x000000, emissive: 0x5ff2ff, emissiveIntensity: 1.2, roughness: 1, side: THREE.DoubleSide }, Object.assign({ key: 'coatseam' }, coatExtra)),
      hem: makeArcane({ color: 0x000000, emissive: 0x5ff2ff, emissiveIntensity: 1.6, roughness: 1, side: THREE.DoubleSide }, Object.assign({ key: 'coathem' }, coatExtra)),
      torso: makeArcane({ color: 0x1b2230, roughness: 0.6, metalness: 0.3 }, { rim: 0.25, rimColor: 0x3fd8ff, crackColor: 0xb266ff }),
      pants: makeArcane({ color: 0x0e1118, roughness: 0.8, metalness: 0.1 }, { rim: 0.15, crackColor: 0xb266ff }),
      boots: new THREE.MeshStandardMaterial({ color: 0x0a0b0f, roughness: 0.5, metalness: 0.5 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xc89c84, roughness: 0.6 }),
      hood: makeArcane({ color: 0x10151f, roughness: 0.75, metalness: 0.15, side: THREE.DoubleSide }, { rim: 0.4, rimColor: 0x3fd8ff, crackColor: 0xb266ff }),
      visor: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 2.6, 3.2) }),
      metal: makeArcane({ color: 0x2c3444, roughness: 0.3, metalness: 0.85 }, { rim: 0.6, rimColor: 0x5ff2ff }),
      glove: new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.6, metalness: 0.3 }),
      grip: new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.9 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffc845, roughness: 0.28, metalness: 1.0, emissive: 0x6a4200, emissiveIntensity: 0.6 }),
      blade: makeArcane({ color: 0xc8d4e2, roughness: 0.18, metalness: 1.0, emissive: 0x0b3a48, emissiveIntensity: 0.6 }, { rim: 1.2, rimColor: 0x7ff6ff, key: 'blade' }),
      edge: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 3.0, 3.6) }),
      glass: makeEchoMaterial({ color: 0xcff6ff, alpha: 0.9 }),
      sand: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.35) }),
    };
    this.arcaneMats = [mats.coat, mats.torso, mats.pants, mats.hood, mats.metal, mats.blade];
    mats.coat.userData.localSpace = mats.seam.userData.localSpace = mats.hem.userData.localSpace = true;
    const m = buildChronoblade((n) => mats[n] || mats.coat);
    this.model = m; this.root = m.root; this.refs = m.refs;
    scene.add(this.root);
    setLayer1(this.root);
    this.blob = makeBlobShadow(1.5); scene.add(this.blob);

    // Echo (frozen afterimage) + 5 dash ghosts share the same structure (pose copy by part index)
    this.echoMat = makeEchoMaterial({ color: 0x5ff2ff, alpha: 0.85 });
    this.echoModel = buildChronoblade(() => this.echoMat, { echo: true });
    this.echoModel.root.visible = false; scene.add(this.echoModel.root); setLayer1(this.echoModel.root);
    const rg = new THREE.PlaneGeometry(1, 1); rg.rotateX(-Math.PI / 2);
    this.echoRing = new THREE.Mesh(rg, makeGroundRingMaterial(0x5ff2ff));
    this.echoRing.renderOrder = 4; this.echoRing.visible = false; scene.add(this.echoRing);
    const u = this.echoRing.material.uniforms; u.uR.value = 0.9; u.uW.value = 0.07; u.uIntensity.value = 2.2; u.uFill.value = 1;
    this.echoRing.scale.set(0.9 * 2.5, 1, 0.9 * 2.5);
    // mark ring (Fate / Undertow countdown)
    this.markRing = new THREE.Mesh(rg, makeGroundRingMaterial(0xb266ff));
    this.markRing.renderOrder = 4; this.markRing.visible = false; scene.add(this.markRing);
    this.ghosts = [];
    for (let i = 0; i < CONFIG.abilities.dash.ghosts; i++) {
      const mat = makeEchoMaterial({ color: 0x7ff6ff, alpha: 0.5, dither: true });
      const g = buildChronoblade(() => mat, { echo: true });
      g.root.visible = false; scene.add(g.root);
      this.ghosts.push({ model: g, mat, t: 0, life: 0.3, a0: 0.5 });
    }
    // blade trail
    this.trail = new RibbonTrail(16, 0x5ff2ff, { intensity: 2.6 });
    // blade light
    this.light = PointLights.get(1);
    this.light.color.set(0x5ff2ff); this.light.distance = 7; this.light.decay = 1.6;
  }

  copyPoseTo(dst) {
    const src = this.model.parts, d = dst.parts;
    for (let i = 0; i < src.length; i++) { d[i].position.copy(src[i].position); d[i].quaternion.copy(src[i].quaternion); d[i].scale.copy(src[i].scale); }
    dst.root.position.copy(this.root.position); dst.root.quaternion.copy(this.root.quaternion); dst.root.scale.copy(this.root.scale);
  }

  // ------------------------------------------------------------ lifecycle
  /** full reset for a new fight at (x,z) */
  reset(x, z) {
    const C = CONFIG.player, D = CONFIG.abilities.dash;
    this.talentA = CONFIG.talents[0][Game.talents[0] | 0].id; this.talentB = CONFIG.talents[1][Game.talents[1] | 0].id;
    this.pos.set(x || 0, 0, z != null ? z : 8); this.prevPos.copy(this.pos); this.vis.copy(this.pos);
    this.vel.set(0, 0, 0); this.ext.set(0, 0, 0); this.knockV.set(0, 0, 0);
    this.yaw = Math.PI; this.prevYaw = this.yaw; this.visYaw = this.yaw; this.snapT = 0;
    this.maxHp = C.maxHp; this.hp = this.maxHp; this.shield = 0; this.alive = true; this.invulnFlags = 0; this.iframeT = 0;
    this.flux = 0; this.hourglass = 0; this.fractures = 0; this.fractureT = 0;
    const charges = this.talentA === 'tripleStep' ? 3 : D.charges;
    this.cds.dash.t = 0; this.cds.dash.charges = charges; this.cds.dash.max = charges;
    for (const k of ['rend', 'shatter', 'recall', 'lance', 'ult']) this.cds[k].t = 0;
    this.statuses.length = 0;
    this.dashing = false; this.dashId = 0; this.pdFor = -1;
    this.echo.active = false; this.echo.pinned = false; this.echoModel.root.visible = false; this.echoRing.visible = false; this.markRing.visible = false;
    this.buffer.id = null; this.meleeT = 0.2; this.comboIdx = 0; this.needleT = 0.3; this.outOfMeleeT = 0;
    this.act.type = null; this.actW = 0; this.trailA = 0;
    this.recallS = null; this.ult = null; this.lastSource = null; this.dead = false;
    this.history.clear(); this.histAcc = 0;
    for (const g of this.ghosts) g.model.root.visible = false;
    this.root.visible = true;
    for (const m of this.arcaneMats) { const u = m.userData.arcane; u.uFlash.value = 0; u.uFracture.value = 0; u.uStone.value = 0; u.uDissolve.value = 0; }
    this.syncVisual(1, 0);
    this.trail.reset(this.baseWorld, this.tipWorld);
  }

  get invuln() { return this.iframeT > 0 || this.invulnFlags > 0 || !!this.ult; }
  get cdRate() { return this.hasStatus('borrowed') ? CONFIG.abilities.lance.borrowedRate : 1; }
  get stunned() { for (const s of this.statuses) if (STATUS_DEFS[s.id] && STATUS_DEFS[s.id].stun) return true; return false; }
  canAct() { return this.alive && !Game.inputLocked && !this.ult && !this.recallS && !this.stunned && (Game.state === 'fight'); }

  // ------------------------------------------------------------ targeting (§2.2)
  pickTarget() {
    const b = Game.boss, C = CONFIG.player;
    const bossOk = b && b.alive && b.targetable !== false;
    let best = null, bd = 1e9;
    for (const a of Game.adds) {
      if (!a.alive || a.targetable === false) continue;
      const d = dist2(this.pos.x, this.pos.z, a.pos.x, a.pos.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (bossOk) {
      const db = dist2(this.pos.x, this.pos.z, b.pos.x, b.pos.z) - b.radius;
      if (best && bd <= C.addTargetRange && (db > C.addTargetBossMin || (best.data && best.data.priorityTarget))) return best;   // priority adds (Pyrrha's Cinderlings) win even beside the boss
      return b;
    }
    return best;
  }
  surfaceDist(t) { return dist2(this.pos.x, this.pos.z, t.pos.x, t.pos.z) - (t.radius || 0); }
  shatterTarget() { const b = Game.boss; if (b && b.alive && b.targetable !== false) return b; return this.target; }
  lanceTarget() { const b = Game.boss; if (b && b.getLanceTarget) { const t = b.getLanceTarget(this); if (t) return t; } return this.target; }
  faceTarget(t) {
    const tg = t || this.target; if (!tg) return;
    this.snapYaw = yawTo(this.pos.x, this.pos.z, tg.pos.x, tg.pos.z);
    this.snapT = CONFIG.player.snapTime;
  }

  // ------------------------------------------------------------ input
  press(id) {
    if (!this.alive || !ABILITIES[id]) return;
    if (this.tryUse(id)) return;
    this.buffer.id = id; this.buffer.t = Game.realTime;
  }
  tryUse(id) {
    if (!this.canAct()) return false;
    const def = ABILITIES[id];
    if (!def.canUse(this)) return false;
    def.use(this);
    if (Game.stats) Game.stats['used_' + id] = (Game.stats['used_' + id] || 0) + 1;
    return true;
  }

  // ------------------------------------------------------------ resources
  addFlux(n) {
    this.flux += n;
    if (this.flux > CONFIG.player.fluxMax) { const over = this.flux - CONFIG.player.fluxMax; this.flux = CONFIG.player.fluxMax; this.addHourglass(over * CONFIG.player.overflowRate); }
  }
  addHourglass(n) { const was = this.hourglass; this.hourglass = Math.min(CONFIG.player.hourglassMax, this.hourglass + n); if (was < 100 && this.hourglass >= 100) { sfx('stamp'); HUD.flashButton('ult'); } }
  addFracture(n) {
    const was = this.fractures;
    this.fractures = Math.min(CONFIG.player.fractureMax, this.fractures + (n || 1));
    this.fractureT = CONFIG.player.fractureDecay;
    if (this.fractures !== was) sfx('fracture', { n: this.fractures });
  }

  // ------------------------------------------------------------ statuses (§9.2)
  addStatus(id, dur, o) {
    o = o || {};
    let s = null;
    for (const x of this.statuses) if (x.id === id) { s = x; break; }
    if (!s) { s = { id, t: 0, dur: 0, stacks: 0, tickT: 0, data: null }; this.statuses.push(s); }
    s.dur = Math.max(s.dur - s.t, dur != null ? dur : Infinity); s.t = 0;
    s.stacks = o.stacks != null ? o.stacks : s.stacks + (o.addStacks != null ? o.addStacks : 1);
    if (o.data) s.data = o.data;
    if (id === 'petrified') for (const m of this.arcaneMats) m.userData.arcane.uStone.value = 1;
    return s;
  }
  removeStatus(id) {
    for (let i = this.statuses.length - 1; i >= 0; i--) if (this.statuses[i].id === id) this.statuses.splice(i, 1);
    if (id === 'petrified') for (const m of this.arcaneMats) m.userData.arcane.uStone.value = 0;
  }
  hasStatus(id) { for (const s of this.statuses) if (s.id === id) return true; return false; }
  getStatus(id) { for (const s of this.statuses) if (s.id === id) return s; return null; }
  statusStacks(id) { const s = this.getStatus(id); return s ? s.stacks : 0; }
  updateStatuses(dt) {
    for (let i = this.statuses.length - 1; i >= 0; i--) {
      const s = this.statuses[i], def = STATUS_DEFS[s.id];
      s.t += dt;
      if (def && def.dps) {
        s.tickT += dt;
        while (s.tickT >= def.tick) { s.tickT -= def.tick; this.damage({ amount: def.dps * def.tick, source: def.name, avoidable: true, tick: true, raw: false }); }
      }
      if (s.t >= s.dur) {
        this.statuses.splice(i, 1);
        if (s.id === 'petrified') for (const m of this.arcaneMats) m.userData.arcane.uStone.value = 0;
        if (s.id === 'kintsugi') this.shield = 0;
      }
    }
  }

  // ------------------------------------------------------------ damage intake (§9.1)
  /** o = {amount, source, avoidable, knock?, knockFromX?, knockFromZ?, tick?, raw?}. Returns HP actually lost. */
  damage(o) {
    if (!this.alive) return 0;
    let amt = o.amount;
    if (!o.raw) {
      amt *= Game.diff.dmg * (1 + 0.06 * this.statusStacks('entropy'));
      if (Game.boss && Game.boss.dmgDealtMul) amt *= Game.boss.dmgDealtMul;
    }
    amt = Math.round(amt);
    if (amt <= 0) return 0;
    if (this.invuln) {
      if (this.iframeT > 0 && this.dashId > 0) this.grantPerfectDodge('negate');
      return 0;
    }
    logEvent('damage', { amount: amt, source: o.source, avoidable: o.avoidable !== false, god: Game.god });
    if (o.knock) this.knockback(o.knockFromX, o.knockFromZ, o.knock);
    if (Game.god) { DmgNumbers.spawn(this.hitPointV(), amt, 'taken'); return 0; }
    let absorbed = 0;
    if (this.shield > 0) { absorbed = Math.min(this.shield, amt); this.shield -= absorbed; amt -= absorbed; if (this.shield <= 0) this.removeStatus('kintsugi'); }
    this.hp -= amt;
    if (this.echo.active) this.echo.dmgSince += amt;
    Game.stats.damageTaken += amt; Game.stats.hitsTaken++;
    DmgNumbers.spawn(this.hitPointV(), amt + absorbed, 'taken');
    const C = CONFIG.player;
    if (!o.tick) {
      Post.hurtPulse(Math.min(1, 0.3 + amt / 400)); CamRig.addTrauma(C.hitShake); haptic(20); sfx('hurt');
      this.flashT = 0.12; this.lastSource = o.source || 'Unknown';
      if (this.act.type == null) this.playAct('flinch', 0.18);
    } else { Post.hurtPulse(0.18); this.flashT = Math.max(this.flashT, 0.06); }
    this.lastSource = o.source || this.lastSource;
    if (this.hp <= 0) { this.hp = 0; this.die(o.source); }
    return amt;
  }
  heal(n, source) {
    if (!this.alive || n <= 0) return 0;
    if (this.hasStatus('drowning')) n *= 0.7;
    const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + Math.round(n));
    const got = this.hp - before;
    if (got > 0) { DmgNumbers.spawn(this.hitPointV(), got, 'heal'); Game.stats.healing += got; }
    return got;
  }
  hitPointV() { return _v3.set(this.pos.x, 2.1, this.pos.z); }
  knockback(fx, fz, dist) {
    if (fx == null) return;
    let dx = this.pos.x - fx, dz = this.pos.z - fz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    // impulse that travels `dist` metres over ~0.25 s (exponential decay, k=10)
    this.knockV.set(dx * dist * 10, 0, dz * dist * 10);
  }
  addExtVel(vx, vz) { this.ext.x += vx; this.ext.z += vz; }
  die(source) {
    if (!this.alive) return;
    this.alive = false; this.dead = true; this.lastSource = source || this.lastSource || 'Unknown';
    this.dashing = false; this.root.visible = true;
    this.playAct('death', 1.2);
    Game.stats.deaths++;
    logEvent('death', { source: this.lastSource });
    sfx('death');
    if (Game.onPlayerDeath) Game.onPlayerDeath(this.lastSource);
  }

  // ------------------------------------------------------------ PERFECT DODGE → SLIPSTREAM (§2.5.1)
  grantPerfectDodge(reason) {
    if (this.dashId <= 0 || this.pdFor === this.dashId || !this.alive) return;
    this.pdFor = this.dashId;
    const S = CONFIG.abilities.dash.slip;
    this.addFlux(S.flux); this.addHourglass(S.hourglass);
    this.cds.dash.charges = Math.min(this.cds.dash.max, this.cds.dash.charges + 1);
    if (this.cds.dash.charges >= this.cds.dash.max) this.cds.dash.t = 0;
    if (this.talentA === 'tripleStep' && Game.boss && Game.boss.alive) this.addFracture(1);
    TimeFX.slowMo(S.slowScale, S.slowDur); TimeFX.hitStop(S.hitStop);
    Post.desatPulse(S.desat, S.slowDur + 0.1); Post.kickCA(S.ca);
    sfx('slipstream'); Stamp.show('SLIPSTREAM', 'cyan'); haptic(30);
    GroundFX.ring(this.pos.x, this.pos.z, 0.4, 3.2, 0xbffbff, 0.45, 0.22, 3.2);
    Particles.burst(_v1.set(this.pos.x, 1.2, this.pos.z), 40, 0xbffbff, 0x2bd9ff, 7, 0.6, 0.22, 0, { intensity: 2.6, drag: 3 });
    Game.stats.perfectDodges++;
    logEvent('perfectDodge', { reason });
  }

  // ------------------------------------------------------------ abilities
  startDash() {
    const D = CONFIG.abilities.dash, c = this.cds.dash;
    c.charges--; if (c.t <= 0) c.t = D.cd;
    this.dashId++;
    let dx = Input.move.x, dz = Input.move.z;
    if (Input.move.mag < 0.2) {
      const b = Game.boss;
      if (b && b.alive) { dx = this.pos.x - b.pos.x; dz = this.pos.z - b.pos.z; } else { dx = Math.sin(this.yaw); dz = Math.cos(this.yaw); }
    }
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    this.dashFrom.copy(this.pos);
    this.dashTo.set(this.pos.x + dx * D.dist, 0, this.pos.z + dz * D.dist);
    const R = Game.arena ? Game.arena.radius - CONFIG.player.radius : 1e9, rr = Math.hypot(this.dashTo.x, this.dashTo.z);
    if (rr > R) this.dashTo.multiplyScalar(R / rr);
    this.dashing = true; this.dashT = 0; this.iframeT = D.iframes;
    this.yaw = Math.atan2(dx, dz); this.snapT = 0;
    this.knockV.set(0, 0, 0);
    this.placeEcho();
    // Perfect-dodge lookahead (§9.6)
    Telegraphs.markPD(this.dashFrom.x, this.dashFrom.z, D.pdWindow, this.dashId);
    if (Hazards.anyWillHit(this.dashFrom.x, this.dashFrom.z, D.hazardLook)) this.grantPerfectDodge('hazard');
    // VFX
    this.playAct('dash', D.dur + 0.12);
    this.root.visible = false;
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i], k = (i + 0.5) / this.ghosts.length;
      this.copyPoseTo(g.model);
      g.model.root.position.lerpVectors(this.dashFrom, this.dashTo, k);
      g.model.root.rotation.y = this.yaw;
      g.model.root.visible = true; g.t = -i * 0.02; g.life = 0.32; g.a0 = 0.3 + 0.5 * k;
      g.mat.uniforms.uAlpha.value = g.a0;
    }
    GroundFX.ring(this.dashFrom.x, this.dashFrom.z, 0.3, 1.6, 0x5ff2ff, 0.4, 0.18, 2.8);
    GroundFX.ring(this.dashTo.x, this.dashTo.z, 1.6, 0.3, 0x9ff8ff, 0.35, 0.18, 2.8);
    Particles.line(this.dashFrom, this.dashTo, 26, 0x9ff8ff, 0x1a8cff, 0.45, 0.18, { vy: 0.4, intensity: 2.2 });
    CamRig.kickFov(D.fovKick);
    sfx('dash');
  }
  placeEcho() {
    const E = this.echo, D = CONFIG.abilities.dash;
    E.active = true; E.x = this.pos.x; E.z = this.pos.z; E.life = D.echoLife; E.max = D.echoLife; E.dmgSince = 0; E.pinned = false; E.partT = 0;
    this.copyPoseTo(this.echoModel);
    this.echoModel.root.position.set(E.x, 0, E.z);
    this.echoModel.root.visible = true;
    this.echoRing.position.set(E.x, 0.04, E.z); this.echoRing.visible = true;
    sfx('echo');
  }
  /** create an Echo at the player's feet without dashing (Boss 3 Fate Marks) */
  forceEcho() { this.placeEcho(); }
  clearEcho() { this.echo.active = false; this.echo.pinned = false; this.echoModel.root.visible = false; this.echoRing.visible = false; }

  doRend() {
    const A = CONFIG.abilities.rend;
    this.cds.rend.t = A.cd;
    const t = this.target;
    if (t) this.faceTarget(t);
    const yaw = t ? yawTo(this.pos.x, this.pos.z, t.pos.x, t.pos.z) : this.yaw;
    this.yaw = yaw;
    this.playAct('rend', 0.34);
    sfx('rend');
    const half = A.angle * DEG / 2;
    let hitBoss = false;
    const hitTest = (e) => {
      if (!e || !e.alive || e.targetable === false) return false;
      const d = dist2(this.pos.x, this.pos.z, e.pos.x, e.pos.z);
      if (d - (e.radius || 0) > A.range) return false;
      const ang = Math.abs(angDiff(yaw, yawTo(this.pos.x, this.pos.z, e.pos.x, e.pos.z)));
      return ang <= half + Math.atan2(e.radius || 0, Math.max(d, 0.1));
    };
    const b = Game.boss;
    if (b && hitTest(b)) {
      const got = dealDamage(b, A.dmg, { kind: 'skill', source: 'Rend' });
      if (got > 0) { hitBoss = true; this.addFlux(A.flux); this.addFracture(1); }
    }
    for (const a of Game.adds) if (a !== b && hitTest(a)) dealDamage(a, A.dmg, { kind: 'skill', source: 'Rend' });
    // VFX: crescent of frozen glass shards that shatter after 0.3 s
    const col = this.fractures >= 5 ? 0xffd36a : 0x9ff8ff;
    ShardFX.crescent(this.pos.x, this.pos.z, yaw, 3.0, A.angle * DEG * 0.95, A.shardCount, col, A.shardHold, 1.05);
    SlashFX.spawn(this.pos.x, 1.05, this.pos.z, yaw, 0.12, 3.0, col, { dur: 0.16, hold: 0.22, intensity: 3.2, tail: 0.85 });
    const px = this.pos.x + Math.sin(yaw) * 3, pz = this.pos.z + Math.cos(yaw) * 3;
    Timers.after(A.shardHold, () => {
      Particles.burst(_v1.set(px, 1.2, pz), 60, col, 0x1a8cff, 6, 0.6, 0.16, -6, { spread: 2.2, intensity: 2.4, flat: true });
      sfx('rendShatter');
    });
    return hitBoss;
  }

  doShatter() {
    const A = CONFIG.abilities.shatter;
    const tgt = this.shatterTarget(); if (!tgt) return;
    this.cds.shatter.t = A.cd;
    this.flux -= A.cost;
    this.faceTarget(tgt);
    this.playAct('shatter', 0.4);
    const n = tgt === Game.boss ? this.fractures : 0;
    const grand = n >= CONFIG.player.fractureMax;
    const dmg = grand ? (A.base + A.per * n) * A.grandMul : A.base + A.per * n;
    this.fractures = 0; this.fractureT = 0;
    const got = dealDamage(tgt, dmg, { kind: grand ? 'grand' : 'skill', source: grand ? 'Grand Shatter' : 'Shatter' });
    if (tgt.onShatter) tgt.onShatter(n, grand);
    const hp = tgt.hitPoint || tgt.pos;
    Game.stats.shatters++;
    if (grand) {
      const kin = this.talentB === 'kintsugi';
      const T = CONFIG.talents[1][1];
      this.heal(this.maxHp * (kin ? T.heal : A.grandHeal), 'Grand Shatter');
      if (kin) { this.shield = T.shield; this.addStatus('kintsugi', T.shieldDur, { stacks: 1 }); }
      this.addHourglass(A.grandHourglass);
      TimeFX.hitStop(A.grandHitStop); CamRig.addTrauma(A.grandTrauma); Post.kickBloom(A.grandBloom, 0.25); Post.kickCA(0.004);
      Particles.burst(hp, 300, 0xfff2c0, 0x5ff2ff, 14, 1.2, 0.22, -8, { spread: (tgt.radius || 1) * 0.8, intensity: 2.6, drag: 2 });
      ShardFX.explode(hp, 40, 13, 0xbffbff, { spread: (tgt.radius || 1) * 0.7, life: 1.6, scale: 0.7, intensity: 1.8 });
      GroundFX.ring(tgt.pos.x, tgt.pos.z, (tgt.radius || 1), (tgt.radius || 1) + 7, 0xfff2c0, 0.6, 0.4, 3.5);
      sfx('grandShatter'); Stamp.show('GRAND SHATTER', 'gold'); haptic(25);
      Game.stats.grandShatters++;
      logEvent('grandShatter', { dmg: got });
    } else {
      TimeFX.hitStop(A.hitStop); CamRig.addTrauma(A.trauma);
      Particles.burst(hp, 40 + n * 30, 0xbffbff, 0x1a8cff, 9, 0.7, 0.18, -6, { spread: (tgt.radius || 1) * 0.6, intensity: 2.2 });
      if (n > 0) ShardFX.explode(hp, 6 * n, 9, 0x9ff8ff, { spread: (tgt.radius || 1) * 0.6, scale: 0.45 });
      sfx('shatter');
    }
  }

  doRecall() {
    const A = CONFIG.abilities.recall, E = this.echo;
    this.cds.recall.t = A.cd;
    this.recallS = { t: 0, dur: A.dur, fx: this.pos.x, fz: this.pos.z, tx: E.x, tz: E.z };
    this.yaw = yawTo(this.pos.x, this.pos.z, E.x, E.z);
    this.playAct('recall', A.dur + 0.1);
    this.iframeT = Math.max(this.iframeT, 0);
    // reversed particle streak + zoom blur pulse
    Particles.line(_v1.set(this.pos.x, 0.2, this.pos.z), _v2.set(E.x, 0.2, E.z), 34, 0xbffbff, 0x2b8cff, 0.5, 0.2, { vy: 1.2, intensity: 2.4, stagger: true });
    worldToScreen(_v1.set(E.x, 1, E.z), _v2);
    Post.zoomPulse(0.9, clamp01(_v2.x / View.w), 1 - clamp01(_v2.y / View.h));
    sfx('recall');
  }
  finishRecall() {
    const A = CONFIG.abilities.recall, E = this.echo, s = this.recallS;
    this.pos.set(s.tx, 0, s.tz);
    this.recallS = null;
    const heal = E.dmgSince * A.healFrac;
    if (heal > 0) { const got = this.heal(heal, 'Recall'); Game.stats.recallHealing += got; }
    if (this.hasStatus('entropy')) { this.removeStatus('entropy'); Stamp.show('CLEANSED', 'violet'); }
    GroundFX.ring(E.x, E.z, 0.2, 2.6, 0xbffbff, 0.45, 0.25, 3.0);
    Particles.burst(_v1.set(E.x, 1.0, E.z), 50, 0xbffbff, 0x2bd9ff, 5, 0.6, 0.2, 0, { intensity: 2.4 });
    if (this.talentA === 'afterimage') {
      const T = CONFIG.talents[0][0];
      const hit = (e) => { if (e && e.alive && e.targetable !== false && dist2(E.x, E.z, e.pos.x, e.pos.z) - (e.radius || 0) <= T.radius) dealDamage(e, T.dmg, { kind: 'skill', source: 'Afterimage' }); };
      hit(Game.boss); for (const a of Game.adds) hit(a);
      GroundFX.ring(E.x, E.z, 0.5, T.radius, 0x9ff8ff, 0.5, 0.5, 3.5);
      Particles.burst(_v1.set(E.x, 1, E.z), 90, 0xbffbff, 0x2bd9ff, 10, 0.7, 0.2, 0, { intensity: 2.8, flat: true });
      sfx('boom');
    }
    if (!E.pinned) this.clearEcho();
    else E.dmgSince = 0;
  }

  doLance() {
    const A = CONFIG.abilities.lance;
    const tgt = this.lanceTarget(); if (!tgt) return;
    this.cds.lance.t = this.talentB === 'borrowedPlus' ? CONFIG.talents[1][0].lanceCd : A.cd;
    this.faceTarget(tgt);
    this.playAct('lance', 0.38);
    this.root.updateMatrixWorld(true);
    this.refs.handR.getWorldPosition(_v1);
    Projectiles.spawn({ kind: 'lance', x: _v1.x, y: _v1.y + 0.2, z: _v1.z, target: tgt, speed: A.speed, homing: true, friendly: true, life: 2,
      onHit: (pr, t) => this.lanceHit(t) });
    sfx('lance');
  }
  lanceHit(t) {
    const A = CONFIG.abilities.lance;
    if (!t || !t.alive) return;
    if (t.onLanceHit) { const handled = t.onLanceHit(this); if (handled === true) return; if (handled === 'interrupted') { this.rewardInterrupt(t); return; } }
    if (t.cast && t.cast.interruptible && t.interrupt && t.interrupt()) { this.rewardInterrupt(t); return; }
    dealDamage(t, A.dmg, { kind: 'skill', source: 'Stasis Lance' });
    if (t.isAdd) t.rootT = Math.max(t.rootT || 0, A.root);
    Particles.burst(t.hitPoint || t.pos, 40, 0xe6d4ff, 0x7a3cff, 7, 0.6, 0.2, 0, { intensity: 2.4 });
  }
  rewardInterrupt(t) {
    const A = CONFIG.abilities.lance;
    this.addFlux(A.flux); this.addHourglass(A.hourglass);
    const dur = this.talentB === 'borrowedPlus' ? CONFIG.talents[1][0].borrowed : A.borrowed;
    this.addStatus('borrowed', dur, { stacks: 1 });
    Game.stats.interrupts++;
    Stamp.show('INTERRUPTED', 'violet');
    HUD.shatterCast();
    sfx('interrupt');
    TimeFX.hitStop(0.05); CamRig.addTrauma(0.2); Post.kickCA(0.004);
    const hp = t.hitPoint || t.pos;
    Particles.burst(hp, 120, 0xf0e4ff, 0x8a4cff, 10, 0.9, 0.22, -4, { spread: (t.radius || 1), intensity: 2.6 });
    ShardFX.explode(hp, 18, 8, 0xd8c0ff, { spread: (t.radius || 1) * 0.8, scale: 0.4 });
    logEvent('interrupt', { target: t.name || 'boss' });
  }

  // ------------------------------------------------------------ ZERO HOUR (§2.5.6) — runs on real time
  doZeroHour() {
    const U = CONFIG.abilities.ult, tgt = this.target;
    if (!tgt) return;
    this.hourglass = 0;
    this.ult = { t: 0, target: tgt, stage: 0, batches: 0, slashes: 0, dmgDone: false };
    this.faceTarget(tgt); this.yaw = this.snapYaw;
    this.playAct('ultRaise', 1.35);
    TimeFX.slowMo(U.timeScale, U.dur);
    Game.stats.zeroHours++;
    // hero rail: whip to a low angle beside the player
    const dx = Math.sin(this.yaw), dz = Math.cos(this.yaw), sx = dz, sz = -dx;
    const P = this.pos;
    const side = (camera.position.x - P.x) * sx + (camera.position.z - P.z) * sz >= 0 ? 1 : -1;
    const rail = {
      dur: U.dur, letterbox: true, skippable: false, ease: 'out', blendOut: 0.5,
      pos: [camera.position.clone(),
        [P.x + sx * 3.4 * side - dx * 2.2, 1.0, P.z + sz * 3.4 * side - dz * 2.2],
        [P.x + sx * 3.0 * side - dx * 2.8, 1.25, P.z + sz * 3.0 * side - dz * 2.8],
        [P.x + sx * 4.2 * side - dx * 3.4, 2.4, P.z + sz * 4.2 * side - dz * 3.4]],
      tgt: [CamRig.look.clone(), [P.x + dx * 0.5, 1.7, P.z + dz * 0.5], [P.x + dx * 2, 2.1, P.z + dz * 2], [tgt.pos.x, 2.4, tgt.pos.z]],
      fov: [CONFIG.camera.fov, 40, 44, 56], roll: [0, -3 * side, -2 * side, 0],
    };
    CamRig.playRail(rail);
    sfx('ultCharge');
    Banner.show('ZERO HOUR', null, { cls: 'gold', dur: 1.2 });
  }
  updateUlt(dt) {
    const u = this.ult, U = CONFIG.abilities.ult; if (!u) return;
    u.t += dt;
    const tgt = u.target;
    // star streak on the sky
    GLOBAL_U.uStreak.value = u.t < 0.9 ? smooth01(u.t / 0.9) : u.t < 1.4 ? 1 : Math.max(0, 1 - (u.t - 1.4) / 0.5);
    // 600 particles converge on the hilt in batches over the first second
    while (u.batches < 6 && u.t >= u.batches * 0.15) {
      Particles.converge(this.hiltWorld, U.converge / 6, 6, 0xffe9a8, 0xffffff, 0.7, 0.13, { intensity: 1.8 });
      u.batches++;
    }
    if (u.stage === 0 && u.t >= 0.85) { u.stage = 1; Post.setDesatHold(1); TimeFX.slowMo(0.05, 0.45); }
    if (u.stage === 1 && u.t >= 1.3) {
      u.stage = 2;
      this.playAct('ultCut', 0.4);
      sfx('ultRelease');
      // white-gold crescent beam through the target
      const yaw = this.yaw, d = tgt ? dist2(this.pos.x, this.pos.z, tgt.pos.x, tgt.pos.z) : 8;
      SlashFX.spawn(this.pos.x, 1.4, this.pos.z, yaw, 0.08, Math.max(4, d + 1), 0xffe6a0, { dur: 0.14, hold: 0.35, intensity: 2.6, tail: 0.9 });
      Beams.flash(this.pos.x, 1.35, this.pos.z, yaw, d + 8, 1.0, 0xffe2a0, 0.4);
    }
    if (u.stage === 2 && u.t >= 1.42 && !u.dmgDone) {
      u.dmgDone = true;
      this.zeroHourImpact(tgt);
    }
    if (u.stage === 2 && u.t >= 1.42) {
      // 12 frozen afterimage slashes on the target
      while (u.slashes < U.slashes && u.t >= 1.42 + u.slashes * 0.025) {
        const hp = tgt && (tgt.hitPoint || tgt.pos);
        if (hp) SlashFX.spawn(hp.x + fxRange(-1, 1), hp.y + fxRange(-1.2, 1.2), hp.z + fxRange(-1, 1), fxRange(0, TAU), fxRange(-1.4, 1.4), fxRange(1.4, 2.4), u.slashes % 3 ? 0xffd27a : 0xfff4d8,
          { dur: 0.08, hold: 0.3, intensity: 1.8, pitch: fxRange(-0.6, 0.6), tail: 0.8 });
        u.slashes++;
      }
    }
    if (u.t >= 1.6 && u.stage === 2) { u.stage = 3; Post.setDesatHold(0); }
    if (u.t >= U.dur) { this.ult = null; GLOBAL_U.uStreak.value = 0; Post.setDesatHold(0); }
  }
  zeroHourImpact(tgt) {
    const U = CONFIG.abilities.ult;
    if (tgt && tgt.alive) dealDamage(tgt, U.dmg, { kind: 'grand', source: 'Zero Hour' });
    // destroy all adds and projectiles; clear lingering pools you are not standing on
    for (const a of Game.adds) if (a.alive && a !== tgt) a.kill(true);
    Projectiles.clearHostile();
    Hazards.clearLingering(this.pos.x, this.pos.z);
    if (Game.boss && Game.boss.onZeroHour) Game.boss.onZeroHour(U.anchorDmg, this);
    TimeFX.hitStop(U.hitStop); CamRig.addTrauma(U.trauma); Post.kickBloom(U.bloom, 0.5); Post.kickCA(0.006);
    const hp = tgt ? (tgt.hitPoint || tgt.pos) : this.pos;
    Particles.burst(hp, 200, 0xfff0c0, 0xffb347, 16, 1.0, 0.16, -6, { spread: 1.5, intensity: 1.5 });
    ShardFX.explode(hp, 50, 14, 0xffe6a0, { spread: 1.5, scale: 0.7, intensity: 2 });
    GroundFX.ring(hp.x, hp.z, 1, 14, 0xffd27a, 0.8, 0.45, 2.2);
    haptic(40);
    logEvent('zeroHour', {});
  }

  // ------------------------------------------------------------ animation actions
  playAct(type, dur) { this.act.type = type; this.act.t = 0; this.act.dur = dur; }

  // ------------------------------------------------------------ simulation step
  update(dt) {
    const C = CONFIG.player;
    this.prevPos.copy(this.pos); this.prevYaw = this.yaw;
    if (this.act.type) { this.act.t += dt; if (this.act.t >= this.act.dur && this.act.type !== 'death') this.act.type = null; }
    if (!this.alive) { this.iframeT = 0; return; }
    if (this.flashT > 0) this.flashT -= dt;
    this.updateStatuses(dt);
    if (!this.alive) return;
    // cooldowns (Borrowed Time speeds Rend / Phase Step / Recall)
    const rate = this.cdRate, cd = this.cds;
    if (cd.rend.t > 0) cd.rend.t -= dt * rate;
    if (cd.recall.t > 0) cd.recall.t -= dt * rate;
    if (cd.shatter.t > 0) cd.shatter.t -= dt;
    if (cd.lance.t > 0) cd.lance.t -= dt;
    if (cd.dash.charges < cd.dash.max) {
      cd.dash.t -= dt * rate;
      if (cd.dash.t <= 0) { cd.dash.charges++; cd.dash.t = cd.dash.charges < cd.dash.max ? CONFIG.abilities.dash.cd : 0; HUD.flashButton('dash'); }
    } else cd.dash.t = 0;
    if (this.iframeT > 0) this.iframeT -= dt;
    // fractures decay 8 s after the last Rend
    if (this.fractures > 0) { this.fractureT -= dt; Game.stats.fractureUptime += dt; if (this.fractureT <= 0) { this.fractures = 0; } }
    // echo
    const E = this.echo;
    if (E.active) {
      E.life -= dt;
      E.partT -= dt;
      if (E.partT <= 0) { E.partT = 0.07; Particles.trailPoint(_v1.set(E.x + fxRange(-0.3, 0.3), fxRange(0.2, 1.8), E.z + fxRange(-0.3, 0.3)), 0x9ff8ff, 0x2b8cff, 1.1, 0.12, { vy: 0.9, intensity: 2 }); }
      if (E.life <= 0 && !E.pinned) this.clearEcho();
    }
    // target
    this.target = this.pickTarget();
    // input buffer (0.2 s)
    if (this.buffer.id) {
      if (Game.realTime - this.buffer.t > CONFIG.input.buffer) this.buffer.id = null;
      else if (this.tryUse(this.buffer.id)) this.buffer.id = null;
    }
    // movement
    this.move(dt);
    // auto attacks
    this.autoAttack(dt);
    // facing
    if (this.snapT > 0) { this.snapT -= dt; this.yaw = angDamp(this.yaw, this.snapYaw, 60, dt); }
    // history (30 Hz)
    this.histAcc += dt;
    while (this.histAcc >= this.history.step) { this.histAcc -= this.history.step; this.history.push(this.pos.x, this.pos.z, this.hp, Game.time); }
    this.ext.set(0, 0, 0);
  }

  move(dt) {
    const C = CONFIG.player, D = CONFIG.abilities.dash;
    if (this.dashing) {
      this.dashT += dt;
      const k = Math.min(1, this.dashT / D.dur), e = 1 - (1 - k) * (1 - k);
      this.pos.lerpVectors(this.dashFrom, this.dashTo, e);
      if (k >= 1) { this.dashing = false; this.root.visible = true; }
      this.collide();
      return;
    }
    if (this.recallS) {
      const s = this.recallS; s.t += dt;
      const k = Math.min(1, s.t / s.dur), e = easeInOutCubic(k);
      this.pos.set(lerp(s.fx, s.tx, e), 0, lerp(s.fz, s.tz, e));
      this.root.visible = k > 0.8 || k < 0.15;
      if (k >= 1) { this.root.visible = true; this.finishRecall(); }
      return;
    }
    const canMove = !Game.inputLocked && !this.stunned && !this.ult && !this.hasStatus('rooted') && Game.state === 'fight';
    let vx = 0, vz = 0;
    if (canMove) {
      const m = Input.move;
      const sp = C.speed * Math.min(1, m.mag);
      if (m.mag > 0.01) { vx = m.x / m.mag * sp; vz = m.z / m.mag * sp; }
    }
    this.vel.set(vx, 0, vz);
    this.moveAmt = damp(this.moveAmt, Math.hypot(vx, vz) / C.speed, 14, dt);
    // knockback impulse decays
    const kx = this.knockV.x, kz = this.knockV.z;
    this.knockV.multiplyScalar(Math.exp(-10 * dt));
    this.pos.x += (vx + this.ext.x + kx) * dt;
    this.pos.z += (vz + this.ext.z + kz) * dt;
    if (this.snapT <= 0) {
      if (Math.hypot(vx, vz) > 0.3) this.yaw = angDamp(this.yaw, Math.atan2(vx, vz), 16, dt);
      else if (this.target && !this.ult) this.yaw = angDamp(this.yaw, yawTo(this.pos.x, this.pos.z, this.target.pos.x, this.target.pos.z), 8, dt);
    }
    this.collide();
  }

  /** 2D collision on XZ (§9.3): arena circle, pillar push-out, boss cylinder push-out */
  collide() {
    const r = CONFIG.player.radius, P = this.pos;
    const ar = Game.arena;
    if (ar) {
      if (ar.colliders) for (const c of ar.colliders) {
        if (c.enabled === false) continue;
        let dx = P.x - c.x, dz = P.z - c.z;
        const d = Math.hypot(dx, dz);
        const m = c.r + r;
        if (d <= 1e-4) {   // exactly on the centre (e.g. a straight dash onto a pillar): push out toward the arena centre
          const cl = Math.hypot(c.x, c.z);
          if (cl > 1e-4) { dx = -c.x / cl; dz = -c.z / cl; } else { dx = 1; dz = 0; }
          P.x = c.x + dx * m; P.z = c.z + dz * m;
        } else if (d < m) { P.x = c.x + dx / d * m; P.z = c.z + dz / d * m; }
      }
      const R = ar.radius - r, d0 = Math.hypot(P.x, P.z);
      if (d0 > R && !ar.noClamp) { P.x *= R / d0; P.z *= R / d0; }
    }
    const b = Game.boss;
    if (b && b.alive && b.solid !== false) {
      const dx = P.x - b.pos.x, dz = P.z - b.pos.z, d = Math.hypot(dx, dz), m = b.radius + r;
      if (d < m && d > 1e-4) { P.x = b.pos.x + dx / d * m; P.z = b.pos.z + dz / d * m; }
      else if (d <= 1e-4) P.z = b.pos.z + m;   // dead centre: push out toward the camera side
    }
  }

  autoAttack(dt) {
    const C = CONFIG.player;
    if (!this.canAct() || this.dashing) return;
    const t = this.target;
    if (!t || !t.alive) return;
    const sd = this.surfaceDist(t);
    const rate = this.hasStatus('borrowed') ? CONFIG.abilities.lance.borrowedRate : 1;
    if (sd <= C.meleeRange) {
      this.outOfMeleeT = 0;
      this.meleeT -= dt * rate;
      if (this.meleeT <= 0) { this.meleeT += C.combo.cycle / 3; this.swing(t); }
      this.needleT = Math.max(this.needleT, 0.25);
    } else if (sd <= C.rangedRange) {
      this.outOfMeleeT += dt;
      if (this.outOfMeleeT > 1) this.comboIdx = 0;
      this.meleeT = Math.min(Math.max(this.meleeT, 0), 0.15);
      this.needleT -= dt * rate;
      if (this.needleT <= 0) { this.needleT += C.needle.every; this.fireNeedle(t); }
    }
  }
  swing(t) {
    const C = CONFIG.player, i = this.comboIdx;
    this.comboIdx = (this.comboIdx + 1) % 3;
    const dmg = C.combo.dmg[i];
    const got = dealDamage(t, dmg, { kind: 'auto', source: 'Blade', melee: true });
    if (got > 0) this.addFlux(C.combo.flux);
    if (this.vel.lengthSq() < 0.1) this.faceTarget(t);
    this.playAct(i === 0 ? 'slash1' : i === 1 ? 'slash2' : 'spin', i === 2 ? 0.42 : 0.3);
    sfx('swing', { f: i === 2 ? 600 : 900 }); if (got > 0) sfx('hit');
    // impact VFX at the target surface facing the player
    const hp = t.hitPoint || t.pos;
    const yaw = yawTo(t.pos.x, t.pos.z, this.pos.x, this.pos.z);
    const sx = t.pos.x + Math.sin(yaw) * (t.radius || 0.5) * 0.9, sz = t.pos.z + Math.cos(yaw) * (t.radius || 0.5) * 0.9;
    const col = this.fractures >= 5 ? 0xffd36a : 0x9ff8ff;
    SlashFX.spawn(sx, Math.min(hp.y, 2.2), sz, yaw + Math.PI, i === 0 ? 0.5 : i === 1 ? -0.5 : 0.05, i === 2 ? 2.2 : 1.6, col, { dur: 0.1, hold: 0.06, intensity: 3, flip: i === 1 });
    Particles.burst(_v1.set(sx, Math.min(hp.y, 2.2), sz), i === 2 ? 26 : 14, col, 0x1a8cff, 6, 0.4, 0.14, -8, { intensity: 2.2 });
  }
  fireNeedle(t) {
    const C = CONFIG.player;
    this.root.updateMatrixWorld(true);
    this.refs.handL.getWorldPosition(_v1);
    Projectiles.spawn({ kind: 'needle', x: _v1.x, y: _v1.y + 0.3, z: _v1.z, target: t, speed: C.needle.speed, homing: true, friendly: true, life: 1.6,
      onHit: (pr, tg) => { const got = dealDamage(tg, C.needle.dmg, { kind: 'auto', source: 'Second Hands' }); if (got > 0) this.addFlux(C.needle.flux); sfx('needleHit'); } });
    sfx('needle');
  }

  /** real-time update (cinematics run on wall time) */
  updateReal(dt) { if (this.ult) this.updateUlt(dt); }

  // ------------------------------------------------------------ marks (Fate / Undertow countdown ring)
  setMarkRing(color, frac) { const m = this.markRing; m.visible = true; toColor(color, m.material.uniforms.uColor.value); m.material.uniforms.uFrac.value = clamp01(frac); }
  clearMarkRing() { this.markRing.visible = false; }

  // ------------------------------------------------------------ render-time sync (interpolation + procedural animation)
  syncVisual(alpha, dt) {
    this.vis.lerpVectors(this.prevPos, this.pos, alpha);
    this.visYaw = angLerp(this.prevYaw, this.yaw, alpha);
    const P = this.pose, R = this.root;
    this.computePose(dt);
    R.position.copy(this.vis);
    R.rotation.y = this.visYaw + P.spin;
    this.applyPose();
    // blob shadow
    this.blob.position.set(this.vis.x, 0.015, this.vis.z);
    this.blob.material.opacity = this.dashing ? 0.3 : 1;
    // coat sway: velocity lag in local space + flare
    const c = Math.cos(this.visYaw), s = Math.sin(this.visYaw);
    const vx = this.vel.x + this.knockV.x * 0.3, vz = this.vel.z + this.knockV.z * 0.3;
    const lx = vx * c - vz * s, lz = vx * s + vz * c;
    this.swayX = damp(this.swayX, -lx * 0.05, 6, dt); this.swayZ = damp(this.swayZ, -lz * 0.055 - (this.dashing ? 0.25 : 0), 6, dt);
    const flareT = (this.act.type === 'spin' ? 0.22 : 0) + (this.act.type === 'rend' ? 0.1 : 0) + (this.dashing ? 0.15 : 0);
    this.flare = damp(this.flare, flareT, 10, dt);
    COAT_SWAY.value.set(this.swayX + Math.sin(Game.realTime * 1.7) * 0.012, this.flare, this.swayZ + Math.sin(Game.realTime * 1.3) * 0.01);
    // resources → colours (§2.3)
    const fl = this.flux / 100;
    let seam = CONFIG.player.seamBase + CONFIG.player.seamGain * fl;
    if (this.flux >= 50) seam *= 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(Game.realTime * 6));
    this.mats.seam.emissiveIntensity = seam * 1.7;
    const kin = this.talentB === 'kintsugi';
    this.mats.hem.emissive.setHex(kin ? 0xffc845 : 0x5ff2ff); this.mats.hem.emissiveIntensity = kin ? 2.2 : seam * 1.9;
    const gold = this.fractures >= 5 ? 1 : 0;
    this.goldK = damp(this.goldK || 0, gold, 8, dt);
    const eK = this.goldK, pulse = gold ? 1 + 0.35 * Math.sin(Game.realTime * 10) : 1;
    this.mats.edge.color.setRGB(lerp(0.5, 4.2, eK) * pulse, lerp(3.0, 2.6, eK) * pulse, lerp(3.6, 0.6, eK) * pulse);
    this.trail.mat.uniforms.uColor.value.setRGB(lerp(0.37, 1.0, eK), lerp(0.95, 0.75, eK), lerp(1.0, 0.27, eK));
    const bu = this.mats.blade.userData.arcane; bu.uRimColor.value.setRGB(lerp(0.5, 1, eK), lerp(0.96, 0.8, eK), lerp(1, 0.35, eK));
    // hourglass sand
    const hg = clamp01(this.hourglass / 100);
    this.refs.sandLow.scale.set(0.3 + 0.7 * hg, 0.05 + 0.95 * hg, 0.3 + 0.7 * hg);
    this.refs.sandTop.scale.set(0.3 + 0.7 * (1 - hg), 0.05 + 0.95 * (1 - hg), 0.3 + 0.7 * (1 - hg));
    this.mats.sand.color.setRGB(2.4 * (0.6 + hg), 1.5 * (0.6 + hg), 0.35 * (0.6 + hg));
    // hit flash + entropy cracks
    const fv = this.flashT > 0 ? this.flashT / 0.12 : 0;
    const ent = this.statusStacks('entropy');
    for (const m of this.arcaneMats) { const u = m.userData.arcane; u.uFlash.value = fv * 0.8; u.uFlashColor.value.setRGB(1, 0.35, 0.3); if (m !== this.mats.blade) u.uFracture.value = Math.min(1, ent * 0.12); }
    // blade light follows flux
    R.updateMatrixWorld(true);
    this.refs.blade.localToWorld(this.tipWorld.set(bladeShapeCurve(1) + 0.02, BLADE_Y0 + BLADE_LEN, 0));
    this.refs.blade.localToWorld(this.baseWorld.set(bladeShapeCurve(0.2), BLADE_Y0 + 0.25 * BLADE_LEN, 0));
    this.refs.hourglass.getWorldPosition(this.hiltWorld);
    if (this.light) {
      this.light.position.lerpVectors(this.baseWorld, this.tipWorld, 0.5);
      this.light.intensity = (1.5 + 5 * fl + (this.act.type && this.act.type !== 'flinch' ? 3 : 0)) * (this.root.visible ? 1 : 0.4);
      this.light.color.setRGB(lerp(0.37, 1.0, eK), lerp(0.95, 0.78, eK), lerp(1.0, 0.3, eK));
    }
    // blade trail
    const swinging = this.act.type === 'slash1' || this.act.type === 'slash2' || this.act.type === 'spin' || this.act.type === 'rend' || this.act.type === 'shatter' || this.act.type === 'ultCut' || this.act.type === 'lance';
    this.trailA = swinging ? Math.min(1, this.trailA + dt * 20) : Math.max(0, this.trailA - dt * 5);
    this.trail.mat.uniforms.uAlpha.value = this.trailA;
    // a teleport (recall, dash, knockback) or a hidden body would smear one huge ribbon polygon: restart instead
    const ta = this.trail.posAttr.array, jump = (ta[0] - this.baseWorld.x) ** 2 + (ta[2] - this.baseWorld.z) ** 2 > 1.0;
    if (this.trailA > 0 && !jump && this.root.visible && !this.dashing) this.trail.push(this.baseWorld, this.tipWorld);
    else this.trail.reset(this.baseWorld, this.tipWorld);
    // echo ring + ghosts
    const E = this.echo;
    if (E.active) {
      this.echoRing.material.uniforms.uFrac.value = clamp01(E.life / E.max);
      this.echoMat.uniforms.uAlpha.value = 0.55 + 0.3 * Math.min(1, E.life / 1.5) * (0.85 + 0.15 * Math.sin(Game.realTime * 9));
    }
    for (const g of this.ghosts) {
      if (!g.model.root.visible) continue;
      g.t += dt;
      const k = g.t / g.life;
      if (k >= 1) { g.model.root.visible = false; continue; }
      g.mat.uniforms.uAlpha.value = g.t < 0 ? 0 : g.a0 * (1 - k);
    }
    if (this.markRing.visible) this.markRing.position.set(this.vis.x, 0.045, this.vis.z), this.markRing.scale.set(1.1 * 2.5, 1, 1.1 * 2.5), this.markRing.material.uniforms.uR.value = 1.1;
  }

  computePose(dt) {
    const P = this.pose, t = Game.realTime;
    // ---- base locomotion
    const run = this.alive ? this.moveAmt : 0;
    this.runPhase += dt * (5 + 7 * run) * (run > 0.05 ? 1 : 0);
    const ph = this.runPhase, sn = Math.sin(ph), cs = Math.cos(ph);
    const breath = Math.sin(t * 2.1) * 0.012;
    P.bodyY = Math.abs(sn) * 0.07 * run - 0.035 * run + breath * 0.5;
    P.lean = 0.2 * run + 0.04; P.roll = sn * 0.04 * run; P.twist = sn * 0.18 * run; P.spineX = breath; P.spin = 0;
    P.headX = -0.05 - 0.1 * run; P.headY = -P.twist * 0.6;
    P.legL = -sn * 0.8 * run; P.legR = sn * 0.8 * run;
    P.kneeL = 0.08 + Math.max(0, cs) * 1.0 * run; P.kneeR = 0.08 + Math.max(0, -cs) * 1.0 * run;
    P.shLX = -sn * 0.55 * run + 0.08; P.shLZ = 0.16 + 0.05 * run; P.elbowL = -0.35 - 0.5 * run; P.yawL = 0;
    P.yawR = 0.1; P.armRX = lerp(0.2, 0.55, run) - sn * 0.25 * run; P.armRZ = -0.22; P.elbowR = -0.3 - 0.2 * run;
    P.bladeX = lerp(-2.25, -1.95, run); P.bladeY = 0.2; P.bladeZ = 0.25;
    // ---- action overlay
    const A = this.act;
    if (A.type) {
      const k = clamp01(A.t / A.dur), w = Math.min(1, A.t / 0.04) * (A.type === 'death' ? 1 : Math.min(1, (A.dur - A.t) / 0.1 + 0.0001));
      _poseP = P; _poseW = w; const L = poseBlend;    // hoisted helper: no closure per frame
      switch (A.type) {
        case 'slash1': { const e = easeOutCubic(k); L('armRX', -1.45); L('armRZ', -0.05); L('yawR', lerp(-1.7, 1.4, e)); L('twist', lerp(-0.55, 0.6, e)); L('elbowR', -0.15); L('bladeX', Math.PI - 0.25); L('bladeY', 0); L('bladeZ', -0.3); L('lean', 0.22); break; }
        case 'slash2': { const e = easeOutCubic(k); L('armRX', -1.35); L('armRZ', -0.1); L('yawR', lerp(1.3, -1.8, e)); L('twist', lerp(0.6, -0.65, e)); L('elbowR', -0.25); L('bladeX', Math.PI - 0.2); L('bladeY', Math.PI); L('bladeZ', 0.3); L('lean', 0.18); L('roll', -0.06); break; }
        case 'spin': { const e = easeInOutCubic(k); P.spin = -TAU * e * w; L('armRX', -1.5); L('armRZ', -0.2); L('yawR', -1.3); L('elbowR', -0.05); L('bladeX', Math.PI - 0.1); L('bladeZ', -0.4); L('bodyY', -0.08); L('shLZ', 0.9); L('lean', 0.12); break; }
        case 'rend': { const e = easeOutCubic(k); L('armRX', -1.4); L('armRZ', 0.05); L('yawR', lerp(-2.0, 1.75, e)); L('twist', lerp(-0.85, 0.95, e)); L('elbowR', -0.05); L('bladeX', Math.PI - 0.1); L('bladeZ', -0.5); L('bodyY', -0.14); L('lean', 0.32); L('legL', -0.5); L('kneeL', 0.7); L('legR', 0.35); L('kneeR', 0.35); L('shLX', 0.6); L('shLZ', 0.7); break; }
        case 'shatter': { const up = k < 0.35 ? easeOutCubic(k / 0.35) : 1, dn = k < 0.35 ? 0 : easeOutCubic((k - 0.35) / 0.4);
          L('armRX', lerp(lerp(0.2, -3.0, up), -0.7, dn)); L('armRZ', -0.1); L('yawR', 0.25); L('elbowR', lerp(-0.6, -0.05, dn)); L('bladeX', Math.PI); L('bladeZ', 0);
          L('lean', lerp(-0.12, 0.42, dn)); L('bodyY', lerp(0.03, -0.18, dn)); L('shLZ', lerp(0.3, 0.8, dn)); L('legL', -0.4 * dn); L('kneeL', 0.6 * dn); break; }
        case 'lance': { const e = k < 0.4 ? easeOutCubic(k / 0.4) : 1, f = k < 0.4 ? 0 : easeOutCubic((k - 0.4) / 0.35);
          L('shLX', lerp(lerp(0.1, 1.45, e), 1.3, f)); L('shLZ', 0.1); L('elbowL', -0.1); L('twist', lerp(0.5 * e, -0.5, f)); L('armRX', lerp(0.7 * e, 0.3, f)); L('armRZ', -0.5); L('lean', lerp(-0.1, 0.25, f)); break; }
        case 'dash': L('lean', 0.6); L('bodyY', -0.12); L('shLX', -0.9); L('armRX', 1.0); L('bladeX', -1.6); L('legL', 0.6); L('legR', -0.5); L('kneeL', 0.9); L('kneeR', 0.3); break;
        case 'recall': L('lean', -0.2); L('bodyY', -0.1); L('shLX', -0.5); L('shLZ', 0.5); L('armRX', -0.4); break;
        case 'flinch': L('lean', -0.25); L('headX', 0.3); L('bodyY', -0.03); break;
        case 'ultRaise': { const e = easeOutCubic(k * 1.6); L('armRX', lerp(0.2, -3.08, e)); L('armRZ', -0.12); L('yawR', 0); L('elbowR', -0.05); L('bladeX', Math.PI); L('bladeY', Math.PI / 2); L('bladeZ', 0);
          L('shLZ', lerp(0.2, 1.1, e)); L('shLX', 0.2); L('lean', -0.18); L('headX', -0.35); L('bodyY', 0.02 + Math.sin(t * 30) * 0.004 * e); L('legL', -0.25); L('legR', 0.25); break; }
        case 'ultCut': { const e = easeOutExpo(k); L('armRX', lerp(-3.0, -1.5, Math.min(1, e * 1.5))); L('armRZ', 0); L('yawR', lerp(-1.9, 1.7, e)); L('twist', lerp(-0.9, 1.0, e)); L('bladeX', Math.PI - 0.1); L('bladeZ', -0.4);
          L('lean', 0.35); L('bodyY', -0.16); L('legL', -0.6); L('kneeL', 0.8); L('legR', 0.4); L('kneeR', 0.4); L('shLZ', 0.9); break; }
        case 'death': { const e = easeOutCubic(k); L('bodyY', -0.5 * e); L('lean', 0.5 * e); L('kneeL', 1.6 * e); L('kneeR', 1.4 * e); L('legL', -1.2 * e); L('legR', -0.9 * e); L('headX', 0.5 * e); L('armRX', -0.3); L('bladeX', -1.2); L('shLX', 0.3); break; }
        default: break;
      }
    }
  }
  applyPose() {
    const P = this.pose, r = this.refs;
    r.body.position.y = P.bodyY; r.body.rotation.set(P.lean, 0, P.roll);
    r.spine.rotation.set(P.spineX, P.twist, 0);
    r.head.rotation.set(P.headX, P.headY, 0);
    r.legL.rotation.x = P.legL; r.legR.rotation.x = P.legR; r.kneeL.rotation.x = P.kneeL; r.kneeR.rotation.x = P.kneeR;
    r.armL.rotation.set(-P.shLX, 0, P.shLZ); r.elbowL.rotation.x = P.elbowL; r.yawL.rotation.y = P.yawL;
    r.yawR.rotation.y = P.yawR; r.armR.rotation.set(P.armRX, 0, P.armRZ); r.elbowR.rotation.x = P.elbowR;
    r.blade.rotation.set(P.bladeX, P.bladeY, P.bladeZ);
  }
}
