// =====================================================================
// 14_boss5.js: COURT V, THE THRONE: THE HOLLOW KING.
// A giant seated king whose crown floats above an empty hood: under the crown there is only a black sun.
// Four phases, each an echo of one of the fallen courts plus the King's own gauntlets and sword:
//   1 Ash Remembered  (Court of Ash echo: cleaves, gauntlet slams, a pillar charge, the Decree)
//   2 Glass and Tide  (Glass + Tides echo: mirror beams with a Hymn disc, the tide with a gap, the maelstrom,
//                      shard volleys, the heavy Gauntlet Crush for Riposte)
//   3 Storm Crowned   (Storms echo: chasing lightning markers, rotating throne beams, the gold Crownfall Wave;
//                      the King rises and walks the floor; the floor starts to break: persistent void pits)
//   4 Crownfall       (the black sun: the floor breaks into a cross of islands; the 5 s Crownfall cast is a wipe
//                      unless interrupted OR the player stands in the one blue light far from the King)
// Telegraph colours: warm gold-orange (#ffb347) for the court echoes, white-gold (#fff3cf) for the King's own
// gauntlet hits, the default hatched gold ONLY for the real unblockables (the wave, the Crownfall light).
// =====================================================================
(() => {
  const T3 = G.THREE || THREE, PI = Math.PI, TAU = PI * 2;
  const ACC = '#ffd36b', HOT = '#fff3cf', ORANGE = '#ffb347';
  const V3 = (x = 0, y = 0, z = 0) => new T3.Vector3(x, y, z);
  const call = (obj, name, ...a) => { try { const o = G[obj]; const f = o && o[name]; return f ? f.apply(o, a) : undefined; } catch (e) { console.warn('boss5.' + obj + '.' + name, e); } };
  const world = (n, ...a) => call('world', n, ...a), fx = (n, ...a) => call('fx', n, ...a), post = (n, ...a) => call('post', n, ...a), cam = (n, ...a) => call('cam', n, ...a);
  const sfx = (n, o) => call('audio', 'sfx', n, o);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const dampK = (k, dt) => 1 - Math.exp(-k * dt);

  // ---------------------------------------------------------------- layout constants
  const SEAT_POS = [0, -9.0];                   // b.pos while seated on his shadow throne just inside the rim
  const BS = 0.55;                              // body scale (the camera hides anything tall at the far rim under the HUD)
  const HS = 0.8;                               // gauntlet scale
  const STAND_POS = [0, -7.0];                  // phase 3: on the floor
  const FALL_POS = [0, -5.5];                   // phase 4: the hub of the cross
  const PITS3 = [[6.8, 3.6, 2.5], [-6.8, 3.6, 2.5], [0, 9.3, 2.3]];
  const PITS4 = [[6.6, 6.6], [-6.6, 6.6], [6.6, -6.6], [-6.6, -6.6]], PIT_R4 = 4.3;
  const LIGHTS = [[0, 9.6], [9.6, 0], [-9.6, 0]]; // the Crownfall light: an arm end far from the King
  const RIM = 13.2;

  // point on the circle r = R along a ray from (ax, az) through (tx, tz)
  function rimPoint(ax, az, tx, tz, R = RIM) {
    let dx = tx - ax, dz = tz - az; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const bq = 2 * (ax * dx + az * dz), c = ax * ax + az * az - R * R;
    const disc = Math.max(0, bq * bq - 4 * c); const t = (-bq + Math.sqrt(disc)) / 2;
    return [ax + dx * Math.max(1, t), az + dz * Math.max(1, t)];
  }
  // play-local point -> root-local point (the root rotates with b.facing)
  function localOf(b, x, z, out) {
    const phi = b.root.rotation.y, dx = x - b.pos.x, dz = z - b.pos.z;
    return (out || new T3.Vector3()).set(dx * Math.cos(phi) - dz * Math.sin(phi), 0, dx * Math.sin(phi) + dz * Math.cos(phi));
  }
  const localAngle = (b, theta) => theta - b.root.rotation.y;     // world theta (polar convention) -> root-local angle

  // ================================================================ MODEL
  function makeHand(side, M) {
    const h = new T3.Group();
    const cuff = new T3.Mesh(new T3.CylinderGeometry(0.8, 0.98, 1.1, 12), M.brass); cuff.rotation.z = PI / 2; cuff.position.set(-1.05, 0.05, 0); h.add(cuff);
    const cuffRing = new T3.Mesh(new T3.TorusGeometry(0.95, 0.07, 6, 20), M.goldE); cuffRing.rotation.y = PI / 2; cuffRing.position.set(-1.62, 0.05, 0); h.add(cuffRing);
    const palm = new T3.Mesh(new T3.BoxGeometry(1.5, 0.6, 1.6), M.brass); palm.position.set(0.1, 0, 0); h.add(palm);
    const back = new T3.Mesh(new T3.BoxGeometry(0.9, 0.3, 1.2), M.dark); back.position.set(0.1, 0.4, 0); h.add(back);
    const gem = new T3.Mesh(new T3.OctahedronGeometry(0.24), M.goldE); gem.position.set(0.1, 0.64, 0); h.add(gem);
    for (let i = 0; i < 4; i++) {
      const f = new T3.Mesh(new T3.BoxGeometry(1.0, 0.38, 0.32), M.brass); f.position.set(1.25, -0.14, -0.57 + i * 0.38); f.rotation.z = -0.32; h.add(f);
      const k = new T3.Mesh(new T3.BoxGeometry(0.3, 0.44, 0.34), M.dark); k.position.set(0.85, 0.06, -0.57 + i * 0.38); h.add(k);
    }
    const thumb = new T3.Mesh(new T3.BoxGeometry(0.9, 0.36, 0.34), M.brass); thumb.position.set(0.45, -0.1, -side * 1.0); thumb.rotation.y = side * 0.5; h.add(thumb);
    h.scale.setScalar(HS);
    return h;
  }
  function makeSword(M) {
    const sw = new T3.Group();
    const blade = new T3.Mesh(new T3.BoxGeometry(7.6, 0.14, 0.52), M.brass); blade.position.x = 4.3; sw.add(blade);
    const fuller = new T3.Mesh(new T3.BoxGeometry(7.3, 0.18, 0.12), M.goldE); fuller.position.x = 4.3; sw.add(fuller);
    const tip = new T3.Mesh(new T3.ConeGeometry(0.27, 1.0, 4), M.brass); tip.rotation.z = -PI / 2; tip.position.x = 8.6; sw.add(tip);
    const guard = new T3.Mesh(new T3.BoxGeometry(0.38, 0.5, 2.3), M.brass); guard.position.x = 0.5; sw.add(guard);
    for (const s of [-1, 1]) { const g = new T3.Mesh(new T3.OctahedronGeometry(0.22), M.goldE); g.position.set(0.5, 0, s * 1.25); sw.add(g); }
    const grip = new T3.Mesh(new T3.CylinderGeometry(0.17, 0.17, 1.7, 8), M.dark); grip.rotation.z = PI / 2; grip.position.x = -0.55; sw.add(grip);
    const pommel = new T3.Mesh(new T3.SphereGeometry(0.32, 10, 8), M.goldE); pommel.position.x = -1.5; sw.add(pommel);
    sw.rotation.y = PI / 2;                      // blade along the hand's -z (the thumb side); hand.rotation.x points it up/down
    sw.position.set(0.1, 0, 0);
    return sw;
  }
  function build(b) {
    const D = b.data;
    const M = D.M = {
      brass: G.mat.brass({ color: '#d7a24a', metalness: 0.95, roughness: 0.32, emissive: '#3a2605', emissiveIntensity: 0.4 }),
      cloak: G.mat.brass({ color: '#2a1c0c', metalness: 0.7, roughness: 0.5, emissive: '#5a3c0c', emissiveIntensity: 0.3, side: T3.DoubleSide }),
      dark: G.mat.brass({ color: '#0b090e', metalness: 0.5, roughness: 0.6 }),
      hood: G.mat.brass({ color: '#050408', metalness: 0.3, roughness: 0.8, side: T3.DoubleSide }),
      goldE: G.mat.emissive(ACC, 1.5), threadE: G.mat.emissive('#ffc860', 1.1), hotE: G.mat.emissive(HOT, 1.8),
      black: new T3.MeshBasicMaterial({ color: 0x000000, toneMapped: false, fog: false }),
    };
    const g = new T3.Group();
    // ---- the body (origin at the hips; posed every frame)
    const body = new T3.Group(); body.scale.setScalar(BS); g.add(body); D.body = body;
    // his shadow throne: a dark seat he brings with him; it crumbles when he rises
    const seat = new T3.Group(); g.add(seat); D.seat = seat;
    const seatM = G.mat.brass({ color: '#0a0810', metalness: 0.55, roughness: 0.45 });
    const sb = new T3.Mesh(new T3.BoxGeometry(1.8, 1.2, 3.0), seatM); sb.position.set(-1.5, 0.6, 0); seat.add(sb);
    const sback = new T3.Mesh(new T3.BoxGeometry(0.5, 5.6, 3.3), seatM); sback.position.set(-2.55, 2.8, 0); seat.add(sback);
    const sspire = new T3.Mesh(new T3.ConeGeometry(1.2, 1.8, 4), seatM); sspire.position.set(-2.55, 6.5, 0); sspire.rotation.y = PI / 4; seat.add(sspire);
    for (const sd of [-1, 1]) { const horn = new T3.Mesh(new T3.ConeGeometry(0.25, 1.8, 4), seatM); horn.position.set(-2.55, 6.4, sd * 1.5); horn.rotation.x = sd * 0.2; seat.add(horn); const arm = new T3.Mesh(new T3.BoxGeometry(2.0, 0.5, 0.4), seatM); arm.position.set(-1.3, 1.5, sd * 1.65); seat.add(arm); for (let k = 0; k < 3; k++) { const ln = new T3.Mesh(new T3.BoxGeometry(0.05, 4.6 - k * 0.9, 0.05), M.goldE); ln.position.set(-2.28, 2.9, sd * (0.35 + k * 0.4)); seat.add(ln); } }
    const seatGlow = G.mat.glowSprite(ACC, 5, { intensity: 0.22, opacity: 0.7 }); seatGlow.position.set(-2.9, 4.5, 0); seat.add(seatGlow);
    const torso = new T3.Mesh(new T3.CylinderGeometry(1.45, 2.1, 3.6, 14), M.cloak); torso.position.y = 1.8; body.add(torso);
    const cloak = new T3.Mesh(new T3.ConeGeometry(2.7, 4.4, 18, 1, true), M.cloak); cloak.position.y = 1.4; body.add(cloak); D.cloak = cloak;
    const threads = new T3.Group(); body.add(threads); D.threads = threads;
    for (let i = 0; i < 10; i++) {
      const piv = new T3.Group(); piv.rotation.y = i / 10 * TAU + 0.3; threads.add(piv);
      const s = new T3.Mesh(new T3.BoxGeometry(0.06, 4.0, 0.06), M.threadE); s.position.set(1.42, 1.5, 0); s.rotation.z = 0.52; piv.add(s);
    }
    const chest = new T3.Mesh(new T3.BoxGeometry(0.6, 2.0, 2.3), M.brass); chest.position.set(1.1, 2.6, 0); body.add(chest);
    const chestGem = new T3.Mesh(new T3.OctahedronGeometry(0.3), M.goldE); chestGem.position.set(1.45, 2.9, 0); body.add(chestGem);
    const belt = new T3.Mesh(new T3.TorusGeometry(2.0, 0.12, 6, 24), M.brass); belt.rotation.x = PI / 2; belt.position.y = 0.3; body.add(belt);
    for (const s of [-1, 1]) {
      const sh = new T3.Mesh(new T3.SphereGeometry(0.85, 12, 10), M.brass); sh.position.set(0, 3.55, s * 2.0); body.add(sh);
      const spike = new T3.Mesh(new T3.ConeGeometry(0.22, 1.1, 6), M.brass); spike.position.set(0, 4.3, s * 2.35); spike.rotation.z = -s * 0.0; spike.rotation.x = s * 0.5; body.add(spike);
      // legs: thigh pivot at the hip, shin pivot at the knee
      const thigh = new T3.Group(); thigh.position.set(0, 0, s * 1.0); body.add(thigh);
      const tm = new T3.Mesh(new T3.CylinderGeometry(0.62, 0.52, 2.6, 10), M.cloak); tm.position.y = -1.3; thigh.add(tm);
      const shin = new T3.Group(); shin.position.y = -2.6; thigh.add(shin);
      const sm = new T3.Mesh(new T3.CylinderGeometry(0.5, 0.58, 2.6, 10), M.dark); sm.position.y = -1.3; shin.add(sm);
      const sab = new T3.Mesh(new T3.BoxGeometry(1.0, 1.4, 0.9), M.brass); sab.position.set(0.1, -1.9, 0); shin.add(sab);
      const foot = new T3.Mesh(new T3.BoxGeometry(1.7, 0.5, 0.95), M.brass); foot.position.set(0.45, -2.5, 0); shin.add(foot);
      (D.legs = D.legs || []).push({ thigh, shin });
    }
    // the hood and the black sun inside it
    const hood = new T3.Group(); hood.position.set(0.25, 4.6, 0); body.add(hood); D.hood = hood;
    const hm = new T3.Mesh(new T3.ConeGeometry(1.3, 2.5, 12, 1, true), M.hood); hm.position.y = 0.8; hm.rotation.z = -0.22; hood.add(hm);
    const collar = new T3.Mesh(new T3.TorusGeometry(1.25, 0.1, 6, 20), M.brass); collar.rotation.x = PI / 2; collar.position.y = -0.35; hood.add(collar);
    const sun = new T3.Group(); sun.position.set(0.55, 0.35, 0); hood.add(sun); D.sun = sun;
    const sunDisc = new T3.Mesh(new T3.SphereGeometry(0.52, 16, 12), M.black); sun.add(sunDisc);
    const corona = G.mat.glowSprite(ACC, 2.6, { intensity: 0.55, opacity: 0.9 }); corona.position.x = -0.2; sun.add(corona); D.corona = corona;
    const eclipse = new T3.Mesh(new T3.TorusGeometry(0.6, 0.05, 6, 32), M.hotE); eclipse.rotation.y = PI / 2; sun.add(eclipse);
    const rays = new T3.Group(); sun.add(rays); D.rays = rays;
    for (let i = 0; i < 6; i++) { const r = new T3.Mesh(new T3.PlaneGeometry(0.1, 2.6), G.mat.additive(ACC, 0.3)); r.rotation.y = PI / 2; r.rotation.x = i / 6 * PI; rays.add(r); }
    // the crown: floating above the hood (a torus, spikes, gem tips, an inner glow), plus orbiting fragments
    const crown = new T3.Group(); crown.position.set(0.2, 6.9, 0); body.add(crown); D.crown = crown;
    const band = new T3.Mesh(new T3.TorusGeometry(1.15, 0.16, 8, 28), M.brass); band.rotation.x = PI / 2; crown.add(band);
    const band2 = new T3.Mesh(new T3.TorusGeometry(1.15, 0.05, 6, 28), M.goldE); band2.rotation.x = PI / 2; band2.position.y = 0.2; crown.add(band2);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU, tall = i % 2 === 0;
      const sp = new T3.Mesh(new T3.ConeGeometry(0.17, tall ? 1.3 : 0.8, 5), M.brass); sp.position.set(Math.cos(a) * 1.15, (tall ? 0.65 : 0.4) + 0.15, Math.sin(a) * 1.15); sp.rotation.z = -Math.cos(a) * 0.12; sp.rotation.x = Math.sin(a) * 0.12; crown.add(sp);
      const gem = new T3.Mesh(new T3.OctahedronGeometry(0.14), M.hotE); gem.position.set(Math.cos(a) * 1.15, (tall ? 1.45 : 0.95), Math.sin(a) * 1.15); crown.add(gem);
    }
    const crownGlow = G.mat.glowSprite(ACC, 3.2, { intensity: 0.32, opacity: 0.8 }); crownGlow.position.y = 0.4; crown.add(crownGlow); D.crownGlow = crownGlow;
    const frags = new T3.Group(); g.add(frags); D.frags = frags; D.fragList = [];
    for (let i = 0; i < 14; i++) {
      const f = new T3.Mesh(new T3.TetrahedronGeometry(0.16 + (i % 3) * 0.06), M.goldE); f.visible = false; frags.add(f);
      D.fragList.push({ m: f, a: i / 14 * TAU, r: 1.7 + (i % 4) * 0.35, w: 0.9 + (i % 5) * 0.25, tilt: (i % 3 - 1) * 0.5, y: 0.2 + (i % 4) * 0.25 });
    }
    // ---- the gauntlets (separate, animated toward their actions) + the threads of gold that tie them to the shoulders
    D.hands = [];
    for (const side of [1, -1]) {
      const hg = makeHand(side, M); g.add(hg);
      const hand = { g: hg, side, pos: V3(1.7, 1.25, side * 2.7), rot: V3(side > 0 ? -PI / 2 : PI / 2, 0, 0), act: null, k: 6, tmp: V3(), bob: Math.random() * TAU };
      hg.position.copy(hand.pos);
      const th = new T3.Group(); g.add(th); hand.thread = th;
      for (let i = 0; i < 3; i++) { const c = new T3.Mesh(new T3.CylinderGeometry(0.04, 0.06, 1, 5, 1, true), M.threadE); c.userData.off = (i - 1) * 0.16; th.add(c); }
      D.hands.push(hand);
    }
    const sword = makeSword(M); D.hands[1].g.add(sword); D.sword = sword;
    D.swordGlow = G.mat.glowSprite(ACC, 1.6, { intensity: 0.4, opacity: 0.7 }); D.swordGlow.position.set(4.5, 0, 0); sword.add(D.swordGlow);
    // ---- state
    D.poseK = 0; D.poseTo = 0; D.fragN = 0; D.sunK = 1; D.sunTo = 1; D.lean = 0; D.leanTo = 0; D.moteT = 0; D.crownLift = 0; D.crownLiftTo = 0;
    D.crownFall = null; D.hidden = false; D.lock = false; D.level = 0; D.voids = []; D.moteRate = 0.5;
    b.noBody = true; b.autoFace = false; b.root.rotation.y = -PI / 2; b.facing = -PI / 2;
    b.teleport(SEAT_POS[0], SEAT_POS[1]);
    b.model = g;
  }

  // ----------------------------------------------------------------- per-frame animation
  const tmpA = new T3.Vector3(), tmpB = new T3.Vector3(), tmpQ = new T3.Quaternion(), UP = new T3.Vector3(0, 1, 0);
  function restPos(b, hand, out) {
    const D = b.data, k = D.poseK, t = b.clock;
    const bob = Math.sin(t * 1.3 + hand.bob) * 0.12;
    return out.set(lerp(1.7, 1.5, k), lerp(1.25, 1.7, k) + bob, hand.side * lerp(2.7, 2.3, k));
  }
  function animate(b, dt) {
    const D = b.data; if (!D.body) return;
    dt = Math.min(dt, 0.1);
    const t = b.clock;
    // pose: seated (0) <-> standing (1)
    D.poseK += (D.poseTo - D.poseK) * dampK(1.6, dt); const k = smooth(D.poseK);
    D.body.position.set(lerp(-1.4, 0, k), lerp(1.65, 4.5 * BS, k) + Math.sin(t * 0.9) * 0.04 * (1 - k) + (1 - Math.cos(t * 2.4)) * 0.03 * k, 0);
    if (D.seat) D.seat.visible = D.poseK < 0.5 && !D.hidden;
    // a seated king turns his torso a little toward the player; standing, the root does the facing
    const pa = localAngle(b, b.playerTheta()); const want = D.hidden ? 0 : clamp(Math.atan2(Math.sin(pa), Math.cos(pa)), -0.4, 0.4) * (1 - k) * 0.8;
    D.body.rotation.y += (want - D.body.rotation.y) * dampK(3, dt);
    D.lean += (D.leanTo - D.lean) * dampK(4, dt); D.body.rotation.z = -D.lean * 0.22;
    for (const L of D.legs) { L.thigh.rotation.z = lerp(PI / 2 - 0.12, 0.1, k); L.shin.rotation.z = lerp(-PI / 2 + 0.12, -0.1, k); }
    const cs = lerp(1.0, 1.65, k); D.cloak.scale.y = cs; D.cloak.position.y = 3.6 - 2.2 * cs;
    // crown + fragments
    D.crownLift += (D.crownLiftTo - D.crownLift) * dampK(2, dt);
    if (!D.crownFall) { D.crown.position.y = 6.9 + D.crownLift + Math.sin(t * 1.7) * 0.12; D.crown.rotation.y += dt * (0.35 + D.level * 0.25); }
    const sunPulse = 1 + Math.sin(t * 2.2) * 0.06;
    D.sunK += (D.sunTo - D.sunK) * dampK(3.5, dt); D.sun.scale.setScalar(Math.max(0.01, D.sunK * sunPulse)); D.rays.rotation.x += dt * (0.6 + D.level * 0.4);
    D.corona.material.opacity = 0.6 + 0.12 * D.level + Math.sin(t * 3.1) * 0.08;
    const fr = D.fragList, n = Math.min(fr.length, D.fragN);
    for (let i = 0; i < fr.length; i++) {
      const f = fr[i]; const on = i < n && !D.hidden; f.m.visible = on; if (!on) continue;
      f.a += dt * f.w * (0.7 + D.level * 0.25);
      const r = f.r * (1 + D.level * 0.12);
      const cx = D.crown.position.x * BS + D.body.position.x, cy = (D.crown.position.y + f.y) * BS + D.body.position.y, cz = D.crown.position.z * BS + D.body.position.z;
      f.m.position.set(cx + Math.cos(f.a) * r * BS, cy + Math.sin(f.a * 1.3) * 0.3 * f.tilt, cz + Math.sin(f.a) * r * BS);
      f.m.rotation.x += dt * 2.1; f.m.rotation.y += dt * 1.4;
    }
    // hands
    for (const h of D.hands) stepHand(b, h, dt);
    // gold motes rising from the sun and the crown
    D.moteT -= dt;
    if (D.moteT <= 0 && !D.hidden) {
      D.moteT = D.moteRate / (1 + D.level);
      const cp = crownWorld(b, tmpB);
      fx('burst', cp, { color: Math.random() < 0.5 ? ACC : HOT, count: 2 + D.level, speed: 0.9, size: 0.22, life: 1.4, gravity: -0.5, drag: 0.5, up: 0.8, flareSize: 0 });
    }
  }
  function stepHand(b, h, dt) {
    const D = b.data, tgt = h.tmp; let k = 6; let rotX = h.side > 0 ? -PI / 2 : PI / 2, rotY = 0, rotZ = 0;
    const a = h.act;
    if (a) {
      a.t += dt;
      if (a.type === 'slam') {
        localOf(b, a.x, a.z, tgt);
        if (a.t < a.warn) { tgt.y = 2.4 + 1.8 * smooth(a.t / a.warn); k = 8; rotZ = -0.2; }
        else if (a.t < a.warn + 0.55) { tgt.y = 0.35; k = 60; if (!a.hit) { a.hit = true; slamFx(b, a.x, a.z, a.big); } }
        else h.act = null;
      } else if (a.type === 'crush') {
        localOf(b, a.x, a.z, tgt);
        if (a.t < a.warn) { tgt.y = 3.0 + 1.2 * smooth(a.t / a.warn); tgt.z += h.side * lerp(2.2, 1.0, a.t / a.warn); k = 8; rotZ = h.side * 0.5; }
        else if (a.t < a.warn + 0.7) { tgt.y = 0.4; tgt.z += h.side * 0.6; k = 60; if (!a.hit) { a.hit = true; if (h.side < 0) slamFx(b, a.x, a.z, true); } }
        else h.act = null;
      } else if (a.type === 'cleave') {
        const al = localAngle(b, a.theta);
        if (a.t < a.warn) { tgt.set(1.4, 4.2, h.side * 1.0); rotX = 0; rotY = al - PI / 2 + 1.1; k = 7; }
        else if (a.t < a.warn + 0.45) { const u = smooth((a.t - a.warn) / 0.3); tgt.set(1.2, 1.1, 0); rotX = 0; rotY = al - PI / 2 + lerp(1.1, -1.1, u); k = 40; }
        else h.act = null;
      } else if (a.type === 'charge') {
        if (a.t < a.warn) { localOf(b, a.ax, a.az, tgt); tgt.y = 7.8; rotX = -PI / 2; k = 7; }
        else if (a.t < a.warn + 0.7) { const u = smooth((a.t - a.warn) / 0.45); localOf(b, lerp(a.ax, a.bx, u), lerp(a.az, a.bz, u), tgt); tgt.y = 7.0; rotX = -PI / 2; k = 50; }
        else h.act = null;
      } else if (a.type === 'raise') {
        tgt.set(0.8, 4.6 + Math.sin(b.clock * 5) * 0.12, h.side * 2.0); rotZ = h.side * 0.9; k = 5;
        if (a.t > a.dur) h.act = null;
      } else if (a.type === 'point') {
        localOf(b, a.x, a.z, tgt); tgt.multiplyScalar(0.35); tgt.y = 2.2; rotZ = 0.4; k = 6;
        if (a.t > a.dur) h.act = null;
      } else if (a.type === 'clap') {
        tgt.set(1.9, 2.6, h.side * (a.t < a.warn ? lerp(2.6, 1.1, a.t / a.warn) : 0.3)); k = a.t < a.warn ? 6 : 50; rotZ = h.side * 1.2;
        if (a.t > a.warn + 0.6) h.act = null;
      } else h.act = null;
    }
    if (!h.act) { restPos(b, h, tgt); k = 4; }
    const kk = dampK(k, dt);
    h.pos.lerp(tgt, kk); h.g.position.copy(h.pos);
    h.rot.x += (rotX - h.rot.x) * kk; h.rot.z += (rotZ - h.rot.z) * kk;
    const dy = Math.atan2(Math.sin(rotY - h.rot.y), Math.cos(rotY - h.rot.y)); h.rot.y += dy * kk;
    h.g.rotation.set(h.rot.x, h.rot.y, h.rot.z);
    // the thread from the shoulder to the gauntlet
    const D2 = b.data, sh = tmpA.set(D2.body.position.x, D2.body.position.y + 3.6 * BS, D2.body.position.z + h.side * 2.0 * BS);
    const dir = tmpB.copy(h.pos).sub(sh); const len = dir.length() || 0.01; dir.multiplyScalar(1 / len);
    tmpQ.setFromUnitVectors(UP, dir);
    for (const c of h.thread.children) {
      c.position.copy(sh).addScaledVector(dir, len / 2); c.quaternion.copy(tmpQ); c.scale.set(1, len, 1);
      c.position.x += c.userData.off * Math.sin(b.clock * 2 + c.userData.off * 7); c.position.y += c.userData.off * 0.6;
    }
    D.M.threadE.color.setStyle('#ffc860').multiplyScalar(0.9 + 0.3 * Math.sin(b.clock * 6));
  }
  function slamFx(b, x, z, big) {
    const p = V3(x, 0.2, z);
    fx('burst', p, { color: big ? HOT : ACC, count: big ? 40 : 22, speed: big ? 9 : 6, size: 0.5, life: 0.6, flareSize: big ? 2 : 1 });
    fx('shards', p, { color: ACC, count: big ? 18 : 8, speed: big ? 7 : 5, size: 0.14, floor: true });
    cam('shake', big ? 0.7 : 0.35, big ? 0.5 : 0.3); post('shock', p, big ? 1.0 : 0.5, big ? 0.7 : 0.5);
    world('beat', big ? 1 : 0.5); sfx('crack', { vol: big ? 1 : 0.6, pitch: big ? 0.7 : 0.9 });
  }
  const hand = (b, i) => b.data.hands[i];
  const act = (b, i, a) => { const h = hand(b, i); h.act = Object.assign({ t: 0 }, a); return h; };
  const bothRaise = (b, dur) => { act(b, 0, { type: 'raise', dur }); act(b, 1, { type: 'raise', dur }); };
  const handsFree = (b) => { for (const h of b.data.hands) h.act = null; };
  function crownWorld(b, out) { const D = b.data; return b.root.localToWorld((out || new T3.Vector3()).set(D.crown.position.x * BS + D.body.position.x, D.crown.position.y * BS + D.body.position.y, D.crown.position.z * BS + D.body.position.z)); }

  // ================================================================ MECHANICS (shared helpers)
  async function gate(b) { while (b.data.lock) await b.wait(0.1); }

  // --- the King's own: gauntlet slams (two hands alternating, on the predicted position)
  async function slams(b, n = 2, opts = {}) {
    for (let i = 0; i < n; i++) {
      const p = b.playerAhead(opts.ahead != null ? opts.ahead : 0.9);
      const warn = opts.warn || 1.6;
      act(b, i % 2, { type: 'slam', x: p.x, z: p.z, warn });
      const h = b.hz.circle({ x: p.x, z: p.z, r: opts.r || 2.7, warn, dmg: opts.dmg || 24, color: HOT, label: 'Gauntlet Slam' });
      if (i === n - 1) await h; else await b.wait(opts.gap || 0.85);
    }
  }
  // a single slam fired without waiting (overlaps another pattern); `delay` seconds after the call
  function slamAt(b, i, delay = 0, opts = {}) {
    (async () => { try {
      if (delay > 0) await b.wait(delay);
      const p = opts.x != null ? { x: opts.x, z: opts.z } : b.playerAhead(opts.ahead != null ? opts.ahead : 1.0); const warn = opts.warn || 1.5;
      act(b, i, { type: 'slam', x: p.x, z: p.z, warn });
      b.hz.circle({ x: p.x, z: p.z, r: opts.r || 2.6, warn, dmg: opts.dmg || 24, color: HOT, label: 'Gauntlet Slam' });
    } catch (e) { } })();
  }
  // --- the King's own: the heavy blockable Gauntlet Crush (the Riposte opportunity)
  async function crush(b) {
    const warn = 2.1;
    const h = b.hz.circle({ follow: 'player', r: 3.4, warn, dmg: 45, color: HOT, label: 'Gauntlet Crush', lockAt: 0.45 });
    for (let i = 0; i < 2; i++) act(b, i, { type: 'crush', x: 0, z: 0, warn });
    b.say('Both hands.', 1.6);
    // keep the hands over the moving telegraph until it locks
    const gen = b.gen; (async () => { try { while (b.gen === gen && !h.hazard.done && h.hazard.t < warn) { for (const hd of b.data.hands) if (hd.act && hd.act.type === 'crush') { hd.act.x = h.hazard.x; hd.act.z = h.hazard.z; } await b.wait(0.05); } } catch (e) { } })();
    await h;
  }
  // --- Ash echo: the sword cleave (a cone from the King)
  async function cleave(b, opts = {}) {
    const th = b.playerTheta(), warn = opts.warn || 1.8;
    act(b, 1, { type: 'cleave', theta: th, warn });
    if (opts.slam) slamAt(b, 0, 0.35, { warn: Math.max(1.3, warn - 0.3) });
    await b.hz.cone({ x: b.pos.x, z: b.pos.z, theta: th, width: opts.width || 1.05, r: opts.r || 18, warn, dmg: opts.dmg || 22, color: ORANGE, label: 'Hollow Cleave',
      onFire: () => { const a = b.hitPoint(th); const e = G.polar(opts.r || 18, th, 0.5); e.x += b.pos.x; e.z += b.pos.z; fx('lance', a, e, { color: ACC, width: 0.5, life: 0.35, intensity: 1.4 }); cam('shake', 0.4, 0.35); sfx('crack', { vol: 0.7, pitch: 1.2 }); } });
  }
  // --- Ash echo: the pillar charge (the sword dragged along a line from the King through the player)
  async function charge(b, opts = {}) {
    const p = b.playerAhead(1.2), warn = opts.warn || 2.0;
    const [bx, bz] = rimPoint(b.pos.x, b.pos.z, p.x, p.z);
    act(b, 1, { type: 'charge', ax: b.pos.x, az: b.pos.z, bx, bz, warn });
    if (opts.slam) slamAt(b, 0, 0.6, { warn: 1.5, ahead: 1.3 });
    await b.hz.line({ ax: b.pos.x, az: b.pos.z, bx, bz, width: opts.width || 2.4, warn, dmg: opts.dmg || 28, color: ORANGE, arrow: true, label: 'Pillar Charge',
      onFire: () => { cam('shake', 0.5, 0.4); post('shock', V3((b.pos.x + bx) / 2, 0, (b.pos.z + bz) / 2), 0.6, 0.6); sfx('rumble', { vol: 0.8 }); } });
  }
  // --- the Decree: interruptible; completed = 15 raid damage + a burning ring around the centre
  async function decree(b, opts = {}) {
    const D = b.data; D.lock = true; D.leanTo = 1; D.sunTo = 1.5;
    bothRaise(b, 3.6); b.say(opts.line || 'By decree of the Hollow Crown.', 2.4);
    const r = await b.cast({
      name: opts.name || 'Decree', dur: 3.4, interruptible: true,
      telegraph: () => opts.noRing ? null : b.hz.ring({ x: 0, z: 0, r0: 3.2, r1: 8.4, warn: 3.4, active: 2.8, tick: 0.7, dmg: 9, color: ORANGE, liveStyle: 'soft', label: 'Decree' }),
      onDone: () => {
        b.hz.wipe(15, opts.name || 'Decree', { color: ACC });
        const c = crownWorld(b); fx('burst', c, { color: ACC, count: 50, speed: 8, size: 0.6, life: 0.8, flareSize: 2.5 });
        fx('shockwave', V3(0, 0.2, 0), { color: ORANGE, radius: 9, r0: 3, life: 0.8, intensity: 1.2 });
        post('shock', V3(0, 0, 0), 1.0, 0.8); post('bloomPulse', 0.35, 0.6); world('floorGlow', ORANGE, 0.8, 1.2); cam('shake', 0.6, 0.5); sfx('thunder', { vol: 0.8 });
        if (opts.onDone) opts.onDone();
      },
      onInterrupt: () => { fx('shards', crownWorld(b), { color: ACC, count: 22, speed: 6, size: 0.14 }); b.say(opts.interruptLine || 'The decree dies in an empty throat.', 2.2); },
    });
    D.leanTo = 0; D.sunTo = 1; handsFree(b); D.lock = false;
    return r;
  }
  // --- Glass echo: three mirror beams through the centre + a blue Hymn disc between them
  async function mirrorHymn(b) {
    const p = b.playerPos(); const a0 = Math.atan2(-p.z, p.x);
    const beams = [a0 + PI / 6, a0 + PI / 2, a0 + 5 * PI / 6];
    b.say('Sing, glass.', 1.8); act(b, 0, { type: 'point', x: 0, z: 0, dur: 3.2 });
    for (const a of beams) {
      const A = G.polar(RIM, a), B = G.polar(RIM, a + PI);
      b.hz.line({ ax: A.x, az: A.z, bx: B.x, bz: B.z, width: 1.7, warn: 2.3, dmg: 22, color: ORANGE, label: 'Mirror Beam', onFire: () => { fx('lance', V3(A.x, 1.2, A.z), V3(B.x, 1.2, B.z), { color: '#ffe6b0', width: 0.6, life: 0.4, intensity: 1.3 }); } });
    }
    const S = G.polar(7.6, a0);
    slamAt(b, 1, 1.0, { warn: 1.5 });
    await b.hz.safe({ x: S.x, z: S.z, r: 2.6, warn: 3.0, dmg: 20, label: 'Hymn of Glass', flashColor: ACC });
  }
  // --- Tides echo: the tide sweeps across the arena with one gap
  async function tide(b) {
    const p = b.playerPos(); const gx = clamp(p.x + b.randRange(-1.2, 1.2), -8.5, 8.5), half = 1.5, z0 = -13.6, dur = 3.4;
    b.say('The tide comes for the throne.', 2); act(b, 0, { type: 'point', x: -8, z: 0, dur: 4 }); act(b, 1, { type: 'point', x: 8, z: 0, dur: 4 });
    const o = { width: 1.9, warn: 2.2, dmg: 26, color: ORANGE, arrow: true, label: 'Hollow Tide' };
    const L = b.hz.line(Object.assign({ ax: -14.5, az: z0, bx: gx - half, bz: z0, sweep: { to: [-14.5, 13.6], dur } }, o));
    const R = b.hz.line(Object.assign({ ax: gx + half, az: z0, bx: 14.5, bz: z0, sweep: { to: [gx + half, 13.6], dur } }, o));
    for (const h of [L, R]) if (h.hazard.preview) h.hazard.preview.material.uniforms.uAlpha.value = 0.2;
    (async () => { try { await b.wait(1.2); await shards(b, 3, { spread: 0.3 }); } catch (e) { } })();
    await L; await R;
  }
  // --- Tides echo: the maelstrom pulls toward the centre; the eye and the outside are safe
  async function maelstrom(b) {
    const warn = 2.5;
    b.say('Drown.', 1.6);
    try { G.player.pull(0, 0, 0.9, warn + 0.3); } catch (e) { }
    act(b, 0, { type: 'point', x: 0, z: 0, dur: warn + 0.5 }); act(b, 1, { type: 'point', x: 0, z: 0, dur: warn + 0.5 });
    await b.hz.ring({ x: 0, z: 0, r0: 2.6, r1: 7.2, warn, dmg: 24, color: ORANGE, label: 'Maelstrom', onFire: () => { fx('shockwave', V3(0, 0.2, 0), { color: '#ffd9a0', radius: 7.5, r0: 2.5, life: 0.7 }); sfx('rumble', { vol: 0.7, pitch: 0.8 }); } });
    b.say('The eye closes.', 1.5);
    slamAt(b, 0, 0, { x: 0, z: 0, r: 2.9, warn: 1.3, dmg: 26 });
    await b.wait(1.3);
  }
  // --- Glass echo: a fan of shard orbs from the gauntlets (Rebuke clears them)
  async function shards(b, n = 5, opts = {}) {
    const th = b.playerTheta();
    for (let i = 0; i < n; i++) {
      const h = hand(b, i % 2); const hp = h.g.position.clone(); b.root.localToWorld(hp);
      b.hz.orb({ x: hp.x, z: hp.z, dir: th + (i - (n - 1) / 2) * (opts.spread || 0.24), speed: opts.speed || 6.5, r: 0.5, life: 5, dmg: opts.dmg || 14, color: ORANGE, homing: opts.homing || 0, label: opts.label || 'Glass Shard' });
      fx('burst', hp, { color: ORANGE, count: 8, speed: 3, size: 0.3, life: 0.4 });
      if (i < n - 1) await b.wait(opts.gap || 0.18);
    }
  }
  // --- Storms echo: lightning markers chasing the player
  async function markers(b, n = 3, opts = {}) {
    let last = null;
    for (let i = 0; i < n; i++) {
      if (!b.casting) act(b, i % 2, { type: 'point', x: b.playerPos().x, z: b.playerPos().z, dur: 1.6 });
      last = b.hz.circle({ follow: 'player', r: opts.r || 2.1, warn: opts.warn || 1.5, dmg: opts.dmg || 20, color: ORANGE, label: 'Crown Lightning', lockAt: 0.4,
        onFire: (hh) => { const c = crownWorld(b); fx('lightning', c, V3(hh.hazard.x, 0.1, hh.hazard.z), { color: '#fff0c0', segments: 10, jag: 0.1, width: 0.3, life: 0.3 }); world('lightning', ACC); cam('shake', 0.3, 0.25); sfx('thunder', { vol: 0.5, pitch: 1.3 }); } });
      if (i < n - 1) await b.wait(opts.gap || 0.7);
    }
    if (last && opts.wait !== false) await last;
  }
  // --- Storms echo: two beams rotating from the empty throne
  async function throneBeams(b, opts = {}) {
    const t0 = b.randRange(0, TAU), w = opts.omega || 0.5 * (b.rand() < 0.5 ? 1 : -1), dur = opts.dur || 6.5;
    b.say('The throne itself turns on you.', 2.2);
    const hs = [];
    for (let i = 0; i < 2; i++) hs.push(b.hz.cone({ x: 0, z: -11.8, theta: t0 + i * PI, width: 0.55, r: 27, warn: 2.2, omega: w, dur, tick: 0.5, dmg: 10, color: ORANGE, label: 'Throne Beam' }));
    const gen = b.gen; (async () => { try { await b.wait(2.2); while (b.gen === gen && !hs[0].hazard.done) { for (const h of hs) { const th = h.hazard.thetaAt(h.hazard.t); const e = G.polar(27, th, 1.0); e.z += -11.8; fx('lance', V3(0, 6, -11.8), e, { color: '#ffd9a0', width: 0.35, life: 0.12, intensity: 1.0, flare: false }); } await b.wait(0.1); } } catch (e) { } })();
    if (opts.withMarkers) { await b.wait(2.4); await markers(b, 2, { wait: false }); }
    await hs[0]; await hs[1];
  }
  // --- the King's own, unblockable: the gold Crownfall Wave with two blue lanes
  async function crownWave(b, opts = {}) {
    const pt = b.playerTheta(), warn = opts.warn || 2.8;
    b.say(opts.line || 'Crownfall.', 2); act(b, 0, { type: 'clap', warn }); act(b, 1, { type: 'clap', warn });
    b.data.sunTo = 1.4; b.data.crownLiftTo = 0.8;
    if (opts.markers) (async () => { try { await b.wait(0.5); await markers(b, 2, { warn: 1.4, gap: 0.5, wait: false }); } catch (e) { } })();
    const lane = opts.lane || 0.52;
    const h = b.hz.wave({ x: b.pos.x, z: b.pos.z, r0: 1.2, r1: 17, speed: 6.5, thickness: 1.3, warn, dmg: opts.dmg || 45, unblockable: true, gaps: [{ theta: pt + 0.55, width: lane }, { theta: pt - 2.1, width: lane }], label: 'Crownfall Wave',
      onFire: () => { const c = crownWorld(b); fx('burst', c, { color: HOT, count: 36, speed: 7, size: 0.5, life: 0.7, flareSize: 2 }); post('shock', b.pos.clone(), 0.9, 0.8); cam('shake', 0.6, 0.5); world('floorGlow', ACC, 0.6, 1.0); sfx('thunder', { vol: 0.9 }); } });
    try { await h; } finally { b.data.sunTo = 1; b.data.crownLiftTo = 0; }
  }
  // --- the floor breaks: persistent pits (void) with a telegraph first
  function openPits(b, pits, r, warn) {
    const D = b.data;
    for (const p of pits) {
      const h = b.hz.void({ x: p[0], z: p[1], r: p[2] || r, warn, tick: 0.6, dmg: 10, label: 'The Abyss', onFire: () => { fx('shards', V3(p[0], 0.1, p[1]), { color: '#9a6aff', count: 20, speed: 6, size: 0.16 }); fx('shockwave', V3(p[0], 0.1, p[1]), { color: '#6a2a9a', radius: (p[2] || r) * 1.3, life: 0.6 }); cam('shake', 0.45, 0.4); sfx('crack', { vol: 0.8, pitch: 0.6 }); } });
      h.hazard.active = Infinity;      // HZ.void passes Infinity through num(), which rejects it (-> 0.25 s); restore the persistent pit
      D.voids.push(h);
    }
  }
  function closePits(b) { for (const h of b.data.voids) { try { h.cancel(); } catch (e) { } } b.data.voids.length = 0; }
  const inPit = (b, x, z, pad = 1.2) => b.data.voids.some(h => !h.hazard.done && Math.hypot(h.hazard.x - x, h.hazard.z - z) < h.hazard.r + pad);
  // --- phase 3: walk toward the player when they are far (never into a pit)
  async function stepToward(b) {
    const p = b.playerPos(); const d = b.playerDist(); if (d < 8.5) return;
    const dx = (p.x - b.pos.x) / d, dz = (p.z - b.pos.z) / d; const tx = p.x - dx * 5.5, tz = p.z - dz * 5.5;
    if (Math.hypot(tx, tz) > 9.5 || inPit(b, tx, tz, 1.6) || inPit(b, (tx + b.pos.x) / 2, (tz + b.pos.z) / 2, 1.2)) return;
    b.say('He walks.', 1.4);
    await b.moveTo(tx, tz, 2.8);
  }

  // --- phase 4: the Crownfall. 5 s interruptible; completed = 90 unblockable to everyone outside the one blue light far from the King
  async function crownfall(b) {
    const D = b.data; D.lock = true; D.leanTo = 1; D.sunTo = 2.4; D.crownLiftTo = 1.6; bothRaise(b, 5.2);
    const spot = b.pick(LIGHTS);
    b.say('Look away from the sun. Or stop his mouth.', 3.5);
    (async () => { try { await b.wait(1.4); if (b.casting && b.casting.name === 'Crownfall') await markers(b, 2, { warn: 1.4, gap: 0.6, wait: false }); } catch (e) { } })();
    const r = await b.cast({
      name: 'Crownfall', dur: 5.0, interruptible: true,
      telegraph: () => b.hz.safe({ x: spot[0], z: spot[1], r: 2.4, warn: 5.0, dmg: 90, unblockable: true, lethal: true, label: 'Crownfall', flashColor: ACC }),
      onDone: () => {
        const c = crownWorld(b);
        fx('flash', HOT, 0.55, 0.6); post('bloomPulse', 0.5, 0.9); post('shock', c, 1.3, 1.0); cam('shake', 1.0, 0.8); cam('hitStop', 0.12);
        fx('burst', c, { color: HOT, count: 80, speed: 12, size: 0.7, life: 1.0, flareSize: 3 }); fx('shockwave', V3(b.pos.x, 0.3, b.pos.z), { color: ACC, radius: 20, life: 1.2, intensity: 1.4 });
        world('floorGlow', ACC, 1.2, 1.5); world('rimGlow', ACC, 1.5, 1.5); sfx('thunder', { vol: 1 }); sfx('meteor', { vol: 0.7 });
        D.sunTo = 0.15; setTimeout(() => { D.sunTo = 1; }, 600);
      },
      onInterrupt: () => { const c = crownWorld(b); fx('shards', c, { color: ACC, count: 30, speed: 8, size: 0.16 }); b.say('The sun chokes.', 2); D.sunTo = 0.5; },
    });
    D.leanTo = 0; if (r === 'interrupted') { await b.wait(0.6); } D.sunTo = 1; D.crownLiftTo = 0.5; handsFree(b); D.lock = false;
    return r;
  }

  // ================================================================ THE DEFINITION
  G.bosses[4] = {
    name: 'THE HOLLOW KING', title: 'who wears the Hollow Crown', court: 'The Throne', accent: ACC, sky: 'collapse', arena: 'throne', music: 4,
    maxHp: 18000, parTime: 360, hitRadius: 2.2, hitHeight: 1.8, speed: 2.8, turnRate: 1.8, fadeOpacity: 0.3,
    intro: ['Four courts fell, and he felt none of them.', 'There is nothing under the crown. Take it anyway.'],
    phases: [
      // ------------------------------------------------------------ PHASE 1
      {
        name: 'Ash Remembered', hpStart: 1.0,
        enter(b) {
          const D = b.data; D.level = 0; D.fragN = 0; D.poseTo = 0; D.lock = false; D.moteRate = 0.5;
          b.autoFace = false; b.root.rotation.y = -PI / 2; b.facing = -PI / 2; b.trackPlayer = false; b.facingTarget = null; b.hitRadius = 2.2; b.noBody = true;
          b.teleport(SEAT_POS[0], SEAT_POS[1]);
        },
        async script(b) {
          b.say('Ash. He remembers the hearth you put out.', 3);
          await b.wait(1.2);
          b.loop(async () => {
            await gate(b); await cleave(b, { slam: true }); await b.wait(0.7);
            await gate(b); await slams(b, 3, { gap: 0.7, warn: 1.5 }); await b.wait(1.2);
            await gate(b); await charge(b, { slam: true }); await b.wait(1.0);
            await gate(b); await cleave(b, { width: 0.8 }); await b.wait(0.5);
            await gate(b); await slams(b, 2, { r: 2.5 }); await b.wait(1.4);
          });
          b.loop(async () => { await b.wait(13); await decree(b); await b.wait(5); });
        },
      },
      // ------------------------------------------------------------ PHASE 2
      {
        name: 'Glass and Tide', hpStart: 0.72,
        enter(b) {
          const D = b.data; D.level = 1; D.fragN = 5; D.poseTo = 0; D.lock = false; D.moteRate = 0.45;
          b.autoFace = false; b.root.rotation.y = -PI / 2; b.facing = -PI / 2; b.trackPlayer = false; b.hitRadius = 2.2; b.noBody = true;
          b.teleport(SEAT_POS[0], SEAT_POS[1]);
        },
        async script(b) {
          b.say('Glass, and the tide. Both choirs sang for him once.', 3);
          await b.wait(1.0);
          b.loop(async () => {
            await gate(b); await mirrorHymn(b); await b.wait(1.0);
            await gate(b); await slams(b, 3, { gap: 0.7, warn: 1.5 }); await b.wait(0.9);
            await gate(b); await tide(b); await b.wait(0.9);
            await gate(b); await crush(b); await b.wait(1.2);
            await gate(b); await maelstrom(b); await b.wait(0.8);
            await gate(b); await shards(b, 5); await b.wait(2.0);
            await gate(b); await cleave(b, { width: 0.9, slam: true }); await b.wait(1.0);
          });
          b.loop(async () => { await b.wait(15); await decree(b, { line: 'By decree: the glass remembers your face.' }); await b.wait(6); });
        },
      },
      // ------------------------------------------------------------ PHASE 3
      {
        name: 'Storm Crowned', hpStart: 0.45,
        enter(b) {
          const D = b.data; D.level = 2; D.fragN = 9; D.poseTo = 1; D.poseK = Math.max(D.poseK, 0.98); D.lock = false; D.moteRate = 0.4;
          b.autoFace = true; b.trackPlayer = true; b.facingTarget = null; b.turnRate = 1.8; b.hitRadius = 2.2; b.noBody = true;
          b.teleport(STAND_POS[0], STAND_POS[1]);
          D.voids.length = 0;
          openPits(b, PITS3.slice(0, 2), 2.5, 3.0);
        },
        async script(b) {
          b.say('Storm. The archon knelt to him, in the end.', 3);
          await b.wait(1.5);
          b.loop(async () => {
            await gate(b); await markers(b, 4, { gap: 0.6, warn: 1.4 }); await b.wait(0.9);
            await gate(b); await slams(b, 3, { warn: 1.4, gap: 0.7 }); await b.wait(0.8);
            await gate(b); await throneBeams(b, { withMarkers: true }); await b.wait(0.8);
            await gate(b); await stepToward(b);
            await gate(b); await crownWave(b, { markers: true }); await b.wait(1.2);
            await gate(b); await shards(b, 4, { label: 'Storm Shard', speed: 6, spread: 0.3 }); await b.wait(1.0);
            await gate(b); await cleave(b, { r: 14, width: 1.0, slam: true }); await b.wait(0.8);
            await gate(b); await stepToward(b);
          });
          b.loop(async () => { await b.wait(14); await decree(b, { name: 'Thunder Decree', line: 'By decree: the sky is his.', noRing: true, onDone: () => { for (let i = 0; i < 5; i++) { const a = G.polar(b.randRange(2, 11), b.randRange(0, TAU), 0); fx('lightning', V3(a.x, 12, a.z), V3(a.x, 0.1, a.z), { color: '#fff0c0', segments: 9, life: 0.35 }); } world('lightning', ACC); try { G.player.knockback(b.playerTheta(), 1.5, true); } catch (e) { } } }); await b.wait(6); });
          b.loop(async () => { await b.wait(26); if (b.data.voids.length < 3) { b.say('The floor gives.', 2); openPits(b, [PITS3[2]], 2.3, 3.0); } await b.wait(60); });
        },
      },
      // ------------------------------------------------------------ PHASE 4
      {
        name: 'Crownfall', hpStart: 0.2, skyDur: 3.5,
        enter(b) {
          const D = b.data; D.level = 3; D.fragN = 14; D.poseTo = 1; D.poseK = 1; D.lock = false; D.moteRate = 0.3; D.crownLiftTo = 0.5;
          b.autoFace = true; b.trackPlayer = true; b.facingTarget = null; b.turnRate = 2.0; b.hitRadius = 2.2; b.noBody = true;
          b.teleport(FALL_POS[0], FALL_POS[1]);
          D.voids.length = 0;
          openPits(b, PITS4, PIT_R4, 3.2);
          post('setVignette', 0.5);
        },
        async script(b) {
          b.say('Crownfall. The black sun opens.', 3);
          await b.wait(1.2);
          // one rotation: the shards (which bait Rebuke) come early, the Crownfall cast comes last with Rebuke off cooldown
          b.loop(async () => {
            await slams(b, 3, { warn: 1.3, r: 2.5, dmg: 24, gap: 0.65 }); await b.wait(0.8);
            await shards(b, 3, { label: 'Crown Shard', homing: 0.35, speed: 5.5, spread: 0.5, gap: 0.3 }); await b.wait(1.4);
            await markers(b, 3, { warn: 1.3, gap: 0.55 }); await b.wait(0.8);
            await cleave(b, { r: 14, width: 1.0, slam: true, warn: 1.6 }); await b.wait(0.8);
            await crownWave(b, { line: 'The crown falls on all of you.', lane: 0.46, markers: true }); await b.wait(1.6);
            await crownfall(b);
            await b.wait(2.5);
          });
        },
      },
    ],
    build,
    animate,
    // ------------------------------------------------------------ transitions
    onTransition(b, from, to) {
      const D = b.data; handsFree(b); D.lock = false; D.leanTo = 0; D.sunTo = 1;
      const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
      const crownP = crownWorld(b);
      if (to === 1) {
        // the crown bursts into fragments; both gauntlets slam the floor
        fx('flash', ACC, 0.4, 0.6); cam('shake', 0.6, 0.8); post('shock', crownP, 1.2, 1.0); sfx('bossHit', { vol: 1 });
        fx('shards', crownP, { color: ACC, count: 40, speed: 9, size: 0.18 }); fx('burst', crownP, { color: HOT, count: 40, speed: 6, size: 0.6, life: 1.0, flareSize: 2.5 });
        (async () => { try { await b.wait(1.0); act(b, 0, { type: 'slam', x: -5, z: -5, warn: 0.45, big: true }); act(b, 1, { type: 'slam', x: 5, z: -5, warn: 0.45, big: true }); await b.wait(1.4); b.say('The glass court sang for him. The tide knelt.', 3); } catch (e) { } })();
        D.fragN = 5;
        return cam('cinematic', [{ t: 0, pos: home, look: [0, 0.5, 0] }, { t: 1.4, pos: [5, 6, -1], look: [0, 4.5, -10] }, { t: 2.6, pos: [-3, 4, 3], look: [0, 3, -9] }, { t: 3.8, pos: home, look: [0, 0.5, 0] }]);
      }
      if (to === 2) {
        // the King rises from the throne and steps onto the floor
        fx('flash', ACC, 0.35, 0.5); cam('shake', 0.5, 0.6); sfx('swell', { vol: 0.9 });
        D.fragN = 9;
        (async () => {
          try {
            await b.wait(0.6); b.say('He rises.', 2.2); world('lightning', ACC); D.poseTo = 1; D.crownLiftTo = 0.6;
            { const sp = b.root.localToWorld(V3(-2.2, 2.5, 0)); fx('shards', sp, { color: '#9a6aff', count: 30, speed: 7, size: 0.18 }); fx('burst', sp, { color: ACC, count: 30, speed: 5, size: 0.5, life: 0.9 }); }
            for (let i = 0; i < 4; i++) { await b.wait(0.55); cam('shake', 0.5, 0.4); sfx('crack', { vol: 0.8, pitch: 0.6 }); const p = V3((Math.random() - 0.5) * 6, 0.1, -12 + Math.random() * 3); fx('shards', p, { color: ACC, count: 14, speed: 5, size: 0.15 }); fx('shockwave', p, { color: ORANGE, radius: 4, life: 0.5 }); }
            // step onto the floor: the pos slides forward while the pose finishes
            const z0 = b.pos.z, z1 = STAND_POS[1]; const steps = 16;
            for (let i = 1; i <= steps; i++) { await b.wait(0.1); b.teleport(0, lerp(z0, z1, smooth(i / steps))); if (i === 8 || i === steps) { cam('shake', 0.7, 0.5); post('shock', b.pos.clone(), 1.0, 0.8); fx('shockwave', b.pos.clone().setY(0.2), { color: ACC, radius: 9, life: 0.8 }); fx('burst', b.pos.clone().setY(0.3), { color: ACC, count: 30, speed: 6, size: 0.5, life: 0.7, flat: true }); sfx('crack', { vol: 1, pitch: 0.5 }); } }
            D.crownLiftTo = 0;
          } catch (e) { }
        })();
        return cam('cinematic', [{ t: 0, pos: home, look: [0, 0.5, 0] }, { t: 1.4, pos: [7, 5, -2], look: [0, 4, -10] }, { t: 3.4, pos: [-4, 4, 3], look: [0, 4, -8] }, { t: 4.6, pos: [0, 6, 8], look: [0, 3, -7] }, { t: 5.6, pos: home, look: [0, 0.5, 0] }]);
      }
      if (to === 3) {
        // Crownfall: the sky collapses into the black hole, the floor cracks toward the four pits
        fx('flash', HOT, 0.45, 0.7); cam('shake', 0.8, 1.0); post('shock', crownP, 1.4, 1.2); sfx('thunder', { vol: 1 }); sfx('swell', { vol: 1, delay: 0.3 });
        D.fragN = 14; D.sunTo = 2.0; D.crownLiftTo = 1.2;
        (async () => {
          try {
            b.say('The crown is hollow. The sun inside it is not.', 3.2);
            b.moveTo(FALL_POS[0], FALL_POS[1], 2.2);
            for (let i = 0; i < 4; i++) { await b.wait(0.5); const p = PITS4[i]; fx('lightning', V3(p[0] * 0.3, 11, p[1] * 0.3), V3(p[0], 0.1, p[1]), { color: '#fff0c0', segments: 10, life: 0.4 }); fx('shards', V3(p[0], 0.1, p[1]), { color: '#9a6aff', count: 16, speed: 6, size: 0.16 }); cam('shake', 0.6, 0.4); sfx('crack', { vol: 0.9, pitch: 0.55 }); }
            await b.wait(0.8); D.sunTo = 1;
          } catch (e) { }
        })();
        return cam('cinematic', [{ t: 0, pos: home, look: [0, 0.5, 0] }, { t: 1.5, pos: [0, 9, 4], look: [0, 5, -7] }, { t: 3.2, pos: [8, 5, 6], look: [0, 3.5, -5] }, { t: 4.4, pos: home, look: [0, 0.5, 0] }]);
      }
      return cam('cinematic', [{ t: 0, pos: home, look: [0, 0.5, 0] }, { t: 1.2, pos: [b.pos.x + 3.5, 5, b.pos.z + 12.5], look: [b.pos.x, 3, b.pos.z] }, { t: 2.6, pos: home, look: [0, 0.5, 0] }]);
    },
    // ------------------------------------------------------------ death: the crown cracks, the sun implodes, the crown falls and rings
    async onDeath(b) {
      const D = b.data; const W = (s) => G.combat.wait(s);
      handsFree(b); D.lock = true; D.leanTo = 0; D.poseTo = D.poseK;
      cam('slowMo', 0.3, 1.6);
      const home = G.camera ? G.camera.position.toArray() : [0, 20, 16];
      const bp = b.pos.clone(), cp = crownWorld(b);
      const cin = cam('cinematic', [
        { t: 0, pos: home, look: [0, 0.5, 0] },
        { t: 1.8, pos: [bp.x + 4, 5, bp.z + 8], look: [cp.x, cp.y - 1, cp.z] },
        { t: 5.0, pos: [bp.x - 5, 3.5, bp.z + 7], look: [cp.x, cp.y - 2, cp.z] },
        { t: 7.6, pos: [bp.x, 3.5, bp.z + 8], look: [bp.x, 1, bp.z] },
        { t: 9.8, pos: home, look: [0, 0.5, 0] },
      ]);
      // 1. the crown cracks: fragments shoot out, gold leaks from the hood
      for (let i = 0; i < 5; i++) { fx('shards', crownWorld(b), { color: ACC, count: 16, speed: 7, size: 0.16 }); fx('burst', crownWorld(b), { color: HOT, count: 24, speed: 5, size: 0.5, life: 0.9, flareSize: 1.5 }); cam('shake', 0.4, 0.3); sfx('crack', { vol: 0.8, pitch: 0.9 + i * 0.1 }); D.fragN = Math.max(0, D.fragN - 3); await W(0.4); }
      // 2. the black sun swells and implodes
      D.sunTo = 3.2; sfx('swell', { vol: 1 }); post('setDesat', 0.3);
      for (let i = 0; i < 6; i++) { const c = crownWorld(b); c.y -= 2.2 * BS; fx('burst', c, { color: i % 2 ? ACC : HOT, count: 20, speed: 3, size: 0.4, life: 0.8 }); cam('shake', 0.3 + i * 0.08, 0.3); await W(0.3); }
      D.sunTo = 0.02; await W(0.25);
      const sunP = crownWorld(b); sunP.y -= 2.2 * BS;
      fx('flash', HOT, 0.9, 1.2); post('bloomPulse', 0.6, 1.2); post('shock', sunP, 1.5, 1.4); cam('shake', 1.2, 1.0); sfx('bossDeath', { vol: 1 }); sfx('thunder', { vol: 1, delay: 0.1 });
      fx('shockwave', V3(bp.x, 0.3, bp.z), { color: HOT, radius: 24, life: 1.6, intensity: 1.5 }); fx('burst', sunP, { color: HOT, count: 120, speed: 14, size: 0.8, life: 1.4, flareSize: 4 });
      world('floorGlow', HOT, 1.5, 2.5); world('rimGlow', ACC, 2.0, 3); world('setSky', 'collapse', 2, 2.5); post('setDesat', 0);
      // 3. the body unravels into gold light; the crown falls to the floor and rings
      D.hidden = true; D.fragN = 0; if (D.seat) D.seat.visible = false;
      const crown = D.crown; const c0 = crownWorld(b); D.crownFall = { y0: c0.y, t: 0 };
      D.body.remove(crown); b.root.add(crown); crown.scale.setScalar(BS); crown.position.copy(b.root.worldToLocal(c0.clone()));
      for (const h of D.hands) { h.g.visible = false; h.thread.visible = false; }
      D.body.visible = false;
      for (let i = 0; i < 8; i++) { const p = V3(bp.x + (Math.random() - 0.5) * 3, 1 + Math.random() * 7, bp.z + (Math.random() - 0.5) * 3); fx('burst', p, { color: i % 2 ? ACC : HOT, count: 26, speed: 6, size: 0.6, life: 1.1, gravity: -0.3 }); await W(0.12); }
      // the fall: 1.1 s drop, two bounces, then it rolls still
      const fallDur = 1.1, y1 = 0.45; let tt = 0;
      const lx = crown.position.x, lz = crown.position.z;
      while (tt < fallDur) { await W(1 / 60); tt += Math.max(G.rdt || 1 / 60, 1 / 60); const u = clamp(tt / fallDur, 0, 1); crown.position.y = lerp(crown.position.y, y1, 0) ; crown.position.y = c0.y - (c0.y - y1) * u * u; crown.rotation.x = u * 1.2; crown.rotation.z = u * 0.9; crown.position.x = lx + u * 0.6; }
      const ringIt = (vol, pitch) => { sfx('crack', { vol, pitch }); sfx('lance', { vol: vol * 0.6, pitch: pitch * 1.8 }); fx('shockwave', b.root.localToWorld(crown.position.clone()).setY(0.1), { color: ACC, radius: 5, life: 0.7, intensity: 1.2 }); cam('shake', 0.5, 0.4); };
      ringIt(1, 1.0);
      for (const [h, d] of [[1.2, 0.5], [0.5, 0.35], [0.18, 0.25]]) { let s = 0; while (s < d) { await W(1 / 60); s += 1 / 60; const u = s / d; crown.position.y = y1 + h * 4 * u * (1 - u); crown.rotation.y += 0.04; } ringIt(0.6, 1.2); }
      crown.rotation.x = PI / 2 - 0.1; crown.rotation.z = 0.08; crown.position.y = 0.3;
      for (let i = 0; i < 4; i++) { fx('burst', b.root.localToWorld(crown.position.clone()).setY(0.5), { color: ACC, count: 10, speed: 2, size: 0.3, life: 1.0, gravity: -0.4 }); await W(0.35); }
      return cin;
    },
    teardown(b) {
      const D = b.data || {};
      try { closePits(b); } catch (e) { }
      D.crownFall = null; D.hidden = false;
      post('setVignette', 0.32); post('setDesat', 0);
    },
  };
})();
