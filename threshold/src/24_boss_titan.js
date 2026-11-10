// DOOR V: MOLTHAR, the Kiln-Titan. A ring of basalt around a lake of fire, and something very large standing in it.
(() => {
  const R0 = 12, R1 = 21, MID = 16.5, SEG = PI / 4, FIRE = 0xff6a1a, ICE = 0x9fe8ff, ARM = 17.5;
  const segOf = (x, z) => { let a = Math.atan2(x, z); if (a < 0) a += TAU; return Math.floor(a / SEG) % 8; };
  const pt = (a, r, y, out) => (out || new V3()).set(Math.sin(a) * r, y, Math.cos(a) * r);
  const playerAng = () => Math.atan2(G.player.pos.x, G.player.pos.z);

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x0c0406, horizon: 0x7a2408, bottom: 0x1a0502, exp: 0.5, clouds: 0.8, cloudColor: 0x8a3a18, cloudDark: 0x0a0505, cloudScale: 1.2, cloudSpeed: 0.02, sunDir: [0, 0.2, -1], sunColor: 0xff7030, sunSize: 0, sunGlow: 0.5, stars: 0.3 }); g.add(sky); S.sky = sky; W.env(sky, 0.8);
    scene.fog = new THREE.FogExp2(0x2a0d06, 0.0075);
    S.hemi = W.hemi(g, 0x5a3a3a, 0x7a2a08, 1.1);
    S.sun = W.sun(g, { dir: [0.5, 0.9, 0.5], color: 0xffb890, intensity: 1.5, size: 30 });
    S.lavaL = new THREE.PointLight(0xff5a10, 900, 90, 1.5); S.lavaL.position.set(0, 3, 0); g.add(S.lavaL);
    S.lake = W.lava({ size: 400, scale: 0.09, speed: 0.05, y: -1.2, heat: 0.6 }); g.add(S.lake);
    // ring floor with glowing cracks
    const fl = W.bake(512, (u, v) => { const n = W.fbm(u * 10, v * 10, 3, 5, 10), c = W.cell(u * 7, v * 7, 5, 7), crack = smooth(sat(c[1] * 7)); return [n * 0.5 + crack * 0.5, 0.25 + n * 0.5, 0.95 - n * 0.3]; }, { dark: 0x0c0a0a, light: 0x4a4444, strength: 3.5 });
    const em = W.bake(512, (u, v) => { const c = W.cell(u * 7, v * 7, 5, 7), n = W.fbm(u * 4, v * 4, 9, 3, 4); const e = Math.pow(1 - sat(c[1] * 7), 3) * sat(n * 2.2 - 0.7); return [0, e, 1]; }, { dark: 0x000000, light: 0xffffff });
    for (const t of [fl.map, fl.normalMap, fl.roughnessMap, em.map]) t.repeat.set(5, 5);
    const ringG = new THREE.RingGeometry(R0, R1, 128, 4); ringG.rotateX(-PI / 2); const ruv = ringG.attributes.uv, rp = ringG.attributes.position; for (let i = 0; i < ruv.count; i++) ruv.setXY(i, rp.getX(i) / 42 + 0.5, rp.getZ(i) / 42 + 0.5);
    S.floorMat = new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, roughnessMap: fl.roughnessMap, roughness: 0.8, metalness: 0.2, emissive: FIRE, emissiveMap: em.map, emissiveIntensity: 1.6 });
    const floor = new THREE.Mesh(ringG, S.floorMat); floor.receiveShadow = true; g.add(floor);
    const rk = W.surface('rock', { size: 256, dark: 0x0a0808, light: 0x4a4040, strength: 5 }); for (const k in rk) rk[k].repeat.set(2, 2);
    S.rockEm = W.bake(256, (u, v) => { const c = W.cell(u * 5, v * 5, 8, 5); return [0, Math.pow(1 - sat(c[1] * 5), 4), 1]; }, { dark: 0x000000, light: 0xffffff }).map; S.rockEm.repeat.set(2, 2);
    const rock = new THREE.MeshStandardMaterial({ map: rk.map, normalMap: rk.normalMap, roughness: 0.85, metalness: 0.1, flatShading: true });
    S.magma = new THREE.MeshStandardMaterial({ map: rk.map, normalMap: rk.normalMap, roughness: 0.75, metalness: 0.15, emissive: FIRE, emissiveMap: S.rockEm, emissiveIntensity: 2.2, flatShading: true });
    const under = new THREE.Mesh(new THREE.CylinderGeometry(R1, R1 + 3, 6, 64, 1, true), rock); under.position.y = -3; g.add(under);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0 - 1.5, 5, 64, 1, true), new THREE.MeshStandardMaterial({ map: rk.map, normalMap: rk.normalMap, roughness: 0.85, side: THREE.BackSide, emissive: 0x2a0800 })); inner.position.y = -2.5; g.add(inner);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R0 + 0.05, 0.22, 6, 96), S.magma); lip.rotation.x = PI / 2; lip.position.y = 0.05; g.add(lip);
    S.groove = new THREE.MeshStandardMaterial({ color: 0x050303, emissive: FIRE, emissiveIntensity: 0.7 });
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, R1 - R0), S.groove); const a = i * SEG; m.position.set(Math.sin(a) * MID, 0.016, Math.cos(a) * MID); m.rotation.y = a; g.add(m); }
    // crater wall
    const wallN = 46, wall = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), rock, wallN * 2), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), SC = new V3(), P = new V3();
    for (let i = 0; i < wallN * 2; i++) { const far = i >= wallN, a = (i % wallN) / wallN * TAU + (far ? 0.07 : 0), h = (far ? 26 : 0.8) + W.hash2(i, 3, 2) * (far ? 30 : 1.4), r = (far ? 46 : R1 + 1.4) + W.hash2(i, 5, 2) * (far ? 12 : 1.2); P.set(Math.sin(a) * r, h / 2 - 2, Math.cos(a) * r); E.set((W.hash2(i, 7, 2) - 0.5) * 0.3, W.hash2(i, 8, 2) * 6, (W.hash2(i, 9, 2) - 0.5) * 0.3); Q.setFromEuler(E); SC.set((far ? 5 : 2) + W.hash2(i, 1, 2) * (far ? 8 : 2), h, (far ? 5 : 2) + W.hash2(i, 4, 2) * (far ? 8 : 2)); M.compose(P, Q, SC); wall.setMatrixAt(i, M); }
    wall.castShadow = true; g.add(wall);
    // far volcano
    const volc = new THREE.Mesh(new THREE.ConeGeometry(150, 170, 10, 1, true), rock); volc.position.set(-90, 60, -330); g.add(volc);
    S.plume = new THREE.Mesh(new THREE.ConeGeometry(34, 150, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a10).multiplyScalar(1.5), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); S.plume.position.set(-90, 215, -330); S.plume.rotation.x = PI; g.add(S.plume);
    S.embers = W.motes({ n: 800, box: [70, 34, 70], color: 0xff8030, size: 0.11, vel: [0.4, 1.7, 0.2], sway: 1.1, center: [0, 15, 0], mult: 1.6 }); g.add(S.embers);
    S.ash = W.motes({ n: 500, box: [70, 30, 70], color: 0x5a5050, size: 0.14, vel: [0.6, -1.2, 0.3], sway: 0.8, center: [0, 14, 0], additive: false, alpha: 0 }); g.add(S.ash);
    // rising-lava overlays per segment
    S.seg = [];
    for (let i = 0; i < 8; i++) { const sg = new THREE.RingGeometry(R0 + 0.1, R1 - 0.05, 20, 1, i * SEG - PI / 2 + 0.008, SEG - 0.016); sg.rotateX(-PI / 2); const m = W.lava({ geo: sg, scale: 0.16, speed: 0.12, y: -0.5 }); m.visible = false; g.add(m); S.seg.push({ m, lvl: 0, on: false, gone: false }); }
    // ---- the titan ----
    const bg = b.group; S.body = new THREE.Group(); bg.add(S.body);
    const add = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };
    S.torso = new THREE.Group(); S.body.add(S.torso);
    add(S.torso, new THREE.Mesh(new THREE.CylinderGeometry(5.4, 7.8, 17, 9, 3), S.magma), 0, 5.5, 0);
    for (let i = 0; i < 14; i++) { const a = i * 2.4, y = 1 + (i % 7) * 2.1, r = 6.6 - y * 0.12; const m = add(S.torso, new THREE.Mesh(new THREE.IcosahedronGeometry(2 + W.hash2(i, 1, 6) * 1.6, 0), i % 3 ? rock : S.magma), Math.sin(a) * r, y, Math.cos(a) * r * (Math.cos(a) > 0.3 ? 0.75 : 1)); m.rotation.set(i, i * 2, i * 3); }
    for (const sx of [-1, 1]) add(S.torso, new THREE.Mesh(new THREE.IcosahedronGeometry(4, 0), rock), sx * 7.4, 14.2, 0).rotation.set(0.4, sx, 0.2);
    S.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); S.core = add(S.torso, new THREE.Mesh(new THREE.IcosahedronGeometry(2.3, 2), S.coreMat), 0, 10.2, 4.3); S.core.castShadow = false;
    S.coreL = new THREE.PointLight(0xffa040, 0, 50, 1.6); S.coreL.position.set(0, 10.2, 7.5); S.torso.add(S.coreL);
    S.plates = []; for (let i = 0; i < 4; i++) { const sx = i % 2 ? 1 : -1, sy = i < 2 ? 1 : -1, pv = new THREE.Group(); pv.position.set(sx * 2.9, 10.2 + sy * 2.9, 5.2); S.torso.add(pv); const pl = new THREE.Mesh(new THREE.BoxGeometry(3.1, 3.1, 1.3), rock); pl.position.set(-sx * 1.45, -sy * 1.45, 0.4); pl.castShadow = true; pv.add(pl); S.plates.push({ pv, sx, sy }); }
    S.head = new THREE.Group(); S.head.position.set(0, 17.6, 1.2); S.torso.add(S.head);
    add(S.head, new THREE.Mesh(new THREE.BoxGeometry(5, 4.6, 4.8), S.magma), 0, 1.2, 0).rotation.y = 0.0;
    add(S.head, new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.5, 4.2), rock), 0, -1.5, 0.6);
    S.eyes = W.glow(0xffd070, 5); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 0.3), S.eyes); e.position.set(sx * 1.25, 1.6, 2.42); e.rotation.z = -sx * 0.25; S.head.add(e); }
    S.mouth = W.glow(FIRE, 2); const mo = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.4), S.mouth); mo.position.set(0, -0.62, 2.55); S.head.add(mo);
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.42; const sp = add(S.head, new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2 + (3 - Math.abs(i - 3)) * 1.1, 5), W.mat({ color: 0x08060a, roughness: 0.15, metalness: 0.8 })), Math.sin(a) * 2.6, 4.3 + Math.cos(a) * 0.8, -0.6); sp.rotation.z = -a * 0.8; sp.rotation.x = -0.25; }
    S.arms = [];
    for (const sx of [-1, 1]) {
      const ag = new THREE.Group(); ag.position.set(sx * 7.6, 14.2, 0.5); S.torso.add(ag);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.8, 8, 7), S.magma); up.rotation.x = PI / 2; up.position.z = 4; up.castShadow = true; ag.add(up);
      const el = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 0), rock); el.position.z = 8.2; el.castShadow = true; ag.add(el);
      const fo = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.5, 7.5, 7), S.magma); fo.rotation.x = PI / 2; fo.position.z = 12; fo.castShadow = true; ag.add(fo);
      const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(3.3, 0), rock); fist.position.z = 16.6; fist.scale.set(1, 0.85, 1.1); fist.castShadow = true; ag.add(fist);
      S.arms.push({ g: ag, sx, cur: new V3(sx * 11, 1, 6), tgt: new V3(), mode: 'rest', hold: 0, ang: 0 });
    }
    S.geodes = []; S.geoGeo = new THREE.ConeGeometry(0.5, 2.6, 5); S.geoMat = new THREE.MeshStandardMaterial({ color: 0x2a5a6a, emissive: ICE, emissiveIntensity: 2.4, roughness: 0.15, metalness: 0.3, flatShading: true });
    S.open = 0; S.stag = 0; S.armor = 0.6; S.lvl = 0; S.rise = 0; S.pend = null; S.swp = null; S.breath = 0; S.stoke = 0;
    b.dmgTaken = S.armor;
    return {
      edge: 'wall', camDist: 19, camPitch: 0.2, spawn: { x: 0, z: 17.5 }, bossStart: { x: 0, z: 0, face: 0 }, ringY: 0,
      contains: (x, z) => { const r = Math.hypot(x, z); return r >= R0 + 0.3 && r <= R1 - 0.3; },
      clamp(p) { const r = Math.hypot(p.x, p.z) || 1, c = clamp(r, R0 + 0.45, R1 - 0.45); if (c !== r) { p.x *= c / r; p.z *= c / r; } },
      camLimit(x, y, z) { const r = Math.hypot(x, z); if (r > 31) { x *= 31 / r; z *= 31 / r; } else if (r < R0 + 0.8 && y < 26) { const k = (R0 + 0.8) / (r || 1); x *= k; z *= k; } return { x, y: Math.max(y, r > R1 ? 2.8 : 0.5), z }; },
      bulletBounds: (x, z) => x * x + z * z < 30 * 30,
    };
  }

  // ---- mechanics ----
  const wedge = (a, arc, delay, dmg, o) => Hz.cone(0, 0, a, arc, R1 + 0.4, delay, dmg, Object.assign({ r0: R0 - 0.3, color: FIRE }, o));
  function spawnGeode(b) {
    const S = b.state; if (S.geodes.filter((q) => q.alive).length >= 2) return;
    let a, tries = 0; do { a = rnd(TAU); tries++; } while (tries < 30 && (S.seg[Math.floor(((a % TAU) + TAU) % TAU / SEG)].on || S.seg[Math.floor(((a % TAU) + TAU) % TAU / SEG)].gone || Math.abs(angDiff(a, playerAng())) < 0.5 || S.geodes.some((q) => q.alive && Math.abs(angDiff(a, q.a)) < 0.9)));
    const grp = new THREE.Group(); grp.position.set(Math.sin(a) * MID, 0, Math.cos(a) * MID);
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(S.geoGeo, S.geoMat); const k = i === 0 ? 0 : 0.7; c.position.set(Math.sin(i * 1.3) * k, 1.0 + (i === 0 ? 0.5 : 0), Math.cos(i * 1.3) * k); c.rotation.set(Math.cos(i * 1.3) * 0.5 * k, i, -Math.sin(i * 1.3) * 0.5 * k); c.scale.setScalar(i === 0 ? 1.3 : 0.6 + W.hash2(i, 2, 4) * 0.5); c.castShadow = true; grp.add(c); }
    const L = new THREE.PointLight(ICE, 16, 12, 1.6); L.position.y = 2; grp.add(L); grp.scale.setScalar(0.01); G.world.add(grp);
    S.geodes.push({ a, grp, alive: true, t: 0 }); Sound.sfx('shatter', 0.4, 0.6); FX.pillar(grp.position.x, grp.position.z, { r: 1, h: 10, color: ICE, dur: 0.6 });
  }
  function stagger(b, q) {
    const S = b.state; q.alive = false; q.grp.visible = false; const x = q.grp.position.x, z = q.grp.position.z;
    FX.explode(x, 1.5, z, ICE, 8, 0xffffff); FX.lightning(new V3(x, 2, z), new V3(0, 10, 0), { color: ICE, width: 0.6, jag: 2.5, dur: 0.5 }); FX.flash(ICE, 0.35, 2.5); Sound.sfx('shatter'); Sound.sfx('roar', 1, 0.7); FX.shake(1);
    S.stag = 9; b.dmgTaken = 2.0; b.castState = null; FX.num(b.aim(new V3()), 'STAGGERED', 'note');
  }
  function* reel(b) { const S = b.state; while (S.stag > 0) yield; yield 0.8; }
  function* slam(b, o = {}) {
    const S = b.state, arc = 0.72, t = o.time || 1.9, extra = o.extra || [];
    const arm = S.arms[angDiff(b.facing, playerAng()) > 0 ? 1 : 0], other = S.arms[arm === S.arms[0] ? 1 : 0];
    let a = playerAng(); S.pend = { t, lock: 0.85 };
    const h = wedge(a, arc, t, 430, { name: 'Slam', lock: 0.85, track: (s) => { s.dir = dampAng(s.dir, playerAng(), 10, G.dt); a = s.dir; }, kb: { dist: 4 }, quiet: true, onFire: () => {
      FX.shake(1); Sound.sfx('bigboom', 0.9); pt(a, MID, 0.5, _v); FX.explode(_v.x, 0.5, _v.z, FIRE, 7, 0xffd080); for (let k = 0; k < 3; k++) { pt(a + (k - 1) * 0.25, R0 + 2 + k * 3, 0.3, _v); FX.burst(_v.x, 0.3, _v.z, { n: 16, smoke: true, color: 0x3a2a24, color2: 0x0a0808, speed: [2, 8], up: 5, grav: 12, life: [0.8, 1.6], size: [0.5, 1.4] }); }
      Hz.zone({ type: 'cone', x: 0, z: 0, dir: a, arc, r: R1 + 0.4, r0: R0 - 0.3 }, o.burn || 6, 80, { name: 'Scorch', color: 0xff3a08, delay: 0.5 });
      for (const q of S.geodes) if (q.alive && Math.abs(angDiff(a, q.a)) < arc / 2 + 0.12) stagger(b, q);
    } });
    arm.mode = 'raise'; arm.ang = a;
    for (const e of extra) { const a2 = a + e; wedge(a2, arc, t, 430, { name: 'Slam', kb: { dist: 4 }, quiet: true, silent: true, track: (s) => { s.dir = a + e; }, lock: 0.85, onFire: (hh) => { const d = hh.shape.dir; pt(d, MID, 0.5, _v); FX.explode(_v.x, 0.5, _v.z, FIRE, 7, 0xffd080); for (const q of S.geodes) if (q.alive && Math.abs(angDiff(d, q.a)) < arc / 2 + 0.12) stagger(b, q); } }); other.mode = 'raise'; other.ang = a2; other.follow = e; }
    let el = 0; while (el < t) { el += G.dt; S.pend.t = t - el; arm.ang = a; if (extra.length) other.ang = a + extra[0]; yield; }
    S.pend = null; arm.mode = 'slam'; arm.hold = 1.3; if (extra.length) { other.mode = 'slam'; other.hold = 1.3; }
    void h; yield 0.3; if (S.stag > 0) { yield* reel(b); return; } yield o.rest === undefined ? 1.2 : o.rest;
  }
  function* sweepArm(b) {
    const S = b.state, s = rnd() < 0.5 ? 1 : -1, pa = playerAng(), gap = pa + s * rnd(1.75, 2.15), gArc = 1.05, t = 3.4;
    yield* b.cast({ name: 'Sunder the Ring', time: 0.6 });
    S.swp = { gap, t }; const arm = S.arms[s > 0 ? 1 : 0]; arm.mode = 'sweep'; arm.ang = gap + s * gArc / 2; arm.hold = 99;
    Hz.mark({ type: 'cone', x: 0, z: 0, dir: gap, arc: gArc - 0.1, r: R1, r0: R0 }, t, { color: 0x80ffd0, alpha: 0.8 });
    wedge(gap + PI, TAU - gArc, t, 480, { name: 'Sunder the Ring', kb: { dist: 5 }, quiet: true, onFire: () => { Sound.sfx('bigboom'); FX.shake(1.1); FX.flash(FIRE, 0.25, 3); for (let k = 0; k < 10; k++) { pt(gap + gArc / 2 + (k + 0.5) / 10 * (TAU - gArc), MID, 0.5, _v); FX.explode(_v.x, 0.5, _v.z, FIRE, 5); } } });
    let el = 0; while (el < t - 0.45) { el += G.dt; S.swp.t = t - el; yield; }
    const a0 = arm.ang; el = 0; while (el < 0.5) { el += G.dt; arm.ang = a0 + s * (TAU - gArc) * smooth(el / 0.5); yield; }
    S.swp = null; arm.hold = 0.6; arm.mode = 'slam'; yield 1.6;
  }
  function* surge(b, list, o = {}) {
    const S = b.state; yield* b.cast({ name: 'Lava Surge', time: 0.8 }); const warn = o.warn || 2.6, dur = o.dur || 6;
    for (const i of list) { const sg = S.seg[i]; if (sg.gone) continue; sg.on = true; sg.until = warn + dur; sg.warn = warn; Hz.zone({ type: 'cone', x: 0, z: 0, dir: (i + 0.5) * SEG, arc: SEG + 0.004, r: R1 + 0.3, r0: R0 - 0.3 }, dur, 110, { name: 'Lava', color: 0xff4a08, delay: warn, every: 0.5 }); }
    Sound.sfx('steam'); yield o.wait === undefined ? warn + 0.6 : o.wait;
  }
  const pickSegs = (S, n) => {
    // always the player's segment, never both of its neighbours: one side stays walkable
    const p = segOf(G.player.pos.x, G.player.pos.z), bad = (i) => S.seg[i].gone || S.seg[i].on, L = (p + 7) % 8, Rt = (p + 1) % 8;
    const keep = bad(L) ? Rt : bad(Rt) ? L : rnd() < 0.5 ? L : Rt;
    const all = shuffle([0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !S.seg[i].gone && i !== p && i !== keep)), out = [p];
    for (const i of all) { if (out.length >= n) break; out.push(i); } return out;
  };
  function* breath(b) {
    const S = b.state, a = playerAng(); S.breath = 1;
    wedge(a, 0.5, 1.5, 400, { name: 'Magma Breath', quiet: true, onFire: () => { Sound.sfx('roar', 0.8, 1.4); FX.shake(0.6); S.breath = 2; for (let k = 0; k < 9; k++) { pt(a + (vrand() - 0.5) * 0.4, R0 + k, 0.4, _v); FX.burst(_v.x, 0.5, _v.z, { n: 10, color: FIRE, color2: 0xffe0a0, speed: [2, 8], up: 5, life: [0.4, 1], size: [0.3, 0.8] }); } } });
    yield 1.5; yield 0.6; S.breath = 0; yield 0.6;
  }
  function meteor(x, z, burn) {
    Hz.circle(x, z, 3.1, 1.7, 300, { name: 'Meteor', color: FIRE, quiet: true, onFire: () => { FX.explode(x, 0.5, z, FIRE, 4.5, 0xffe0a0); Sound.sfx('boom', 0.8); FX.shake(0.4); if (burn) Hz.zone({ type: 'circle', x, z, r: 2.4 }, 5, 70, { name: 'Cinders', color: 0xff3a08, delay: 0.3 }); } });
    if (!G.headless) FX.missile(new V3(x - 30, 70, z - 50), new V3(x, 0.5, z), { speed: 52, color: 0xffa040, size: 0.9 });
  }
  function* meteors(b, n, burn) { yield* b.cast({ name: 'Cinderfall', time: 0.7 }); for (let i = 0; i < n; i++) { const p = G.player; if (i % 2 === 0) meteor(p.pos.x, p.pos.z, burn); else { const a = playerAng() + rnd(-1.4, 1.4), r = rnd(R0 + 2, R1 - 2); meteor(Math.sin(a) * r, Math.cos(a) * r, burn); } yield 0.55; } yield 1.0; }
  function* stoke(b) {
    const S = b.state; const r = yield* b.cast({ name: 'Stoke the Kiln', time: 3.4, interruptible: true, onTick: (k) => { S.stoke = k; } }); S.stoke = 0;
    if (r !== 'done') { yield 1.2; return; }
    Sound.sfx('bigboom'); FX.flash(FIRE, 0.45, 2); FX.shake(1); FX.ring(0, 0, { r0: R0, r1: R1 + 4, color: FIRE, dur: 0.8, width: 0.3 }); G.player.hurt(300, { blockable: false, src: { name: 'Eruption' } });
    for (let i = 0; i < 5; i++) { const a = rnd(TAU), rr = rnd(R0 + 2, R1 - 2); meteor(Math.sin(a) * rr, Math.cos(a) * rr, true); } yield 1.4;
  }
  function* erupt(b, lvl) {
    const S = b.state, U = S.sky.material.uniforms; S.lvl = lvl; const h0 = U.uHor.value.clone(), h1 = new THREE.Color([0x7a2408, 0x9a3008, 0xc04010][lvl]), c0 = U.uCloudCol.value.clone(), c1 = new THREE.Color([0x8a3a18, 0xa84818, 0xd05a1c][lvl]), e0 = S.floorMat.emissiveIntensity, e1 = [1.6, 2.0, 2.5][lvl], m0 = S.magma.emissiveIntensity, m1 = [2.2, 2.6, 3.1][lvl], r0 = S.rise, r1 = [0, 2.2, 4.2][lvl];
    yield* W.tween(3.2, (k) => { W.colorLerp(U.uHor.value, h0, h1, k); W.colorLerp(U.uCloudCol.value, c0, c1, k); S.floorMat.emissiveIntensity = lerp(e0, e1, k); S.magma.emissiveIntensity = lerp(m0, m1, k); S.rise = lerp(r0, r1, k); S.lavaL.intensity = 900 + lvl * 250 * k; S.ash.material.uniforms.uAlpha.value = lvl === 2 ? k * 0.8 : 0; S.groove.emissiveIntensity = 0.7 + lvl * k; S.lake.material.uniforms.uHeat.value = 0.6 + lvl * 0.2 * k; });
  }

  G.bosses.push({
    id: 'titan', name: 'MOLTHAR', title: 'The Kiln-Titan', hint: 'A mountain', color: '#ff6a1a', telegraph: FIRE,
    hp: 30000, radius: 11, aimY: 10, enrage: 430,
    post: { bloom: 0.55, threshold: 0.9, radius: 0.75, exposure: 1.1, vig: 1.0, sat: 1.1, contrast: 1.08, tint: [1.06, 0.98, 0.92] },
    music: { bpm: 96, root: 36, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 1, 0, 0, 0, 5, 4],
      layers: [
        { v: 'taiko', pat: 'x.......x...x...', vol: 0.36 }, { v: 'sub', pat: '0...............', oct: 0, len: 14, vol: 0.24 }, { v: 'brass', pat: ['0...............', '........1.......'], oct: 1, len: 12, vol: 0.09 },
        { v: 'taiko', from: 1, pat: 'x..x..x.x..x..x.', vol: 0.3 }, { v: 'bass', from: 1, pat: '0..0..0.0..0.0..', oct: 0, len: 2, vol: 0.14 }, { v: 'choir', from: 1, pat: '0.......4.......', oct: 2, len: 9, vol: 0.08 },
        { v: 'brass', from: 2, pat: ['0.....0.2...1...', '4.....4.5...4...'], oct: 2, len: 4, vol: 0.1 }, { v: 'snare', from: 2, pat: '....x..x....x.xx', vol: 0.18 }, { v: 'tom', from: 2, pat: '..x...x...x...x.', vol: 0.2 }, { v: 'choir', from: 2, pat: '7.......8.......', oct: 2, len: 9, vol: 0.07 },
      ] },
    build,
    *intro(b) { Sound.sfx('roar', 1, 0.6); yield* Cam.shot([0, 2, 30], [0, 4, 0], [9, 5, 23], [0, 15, 0], 4.6, 58); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; b.autoFace = true; b.turnRate = 1.6; yield 1.2;
        while (true) {
          spawnGeode(b); yield 1.0; yield* slam(b); yield* slam(b);
          yield* surge(b, pickSegs(S, 3)); yield* breath(b); yield* sweepArm(b);
          spawnGeode(b); yield* stoke(b); yield* slam(b); yield* breath(b); yield* slam(b); yield* surge(b, pickSegs(S, 3)); yield* sweepArm(b);
        }
      } },
      { at: 0.67, *enter(b) { Sound.sfx('roar', 1, 0.7); FX.shake(1.2); FX.flash(FIRE, 0.4, 1.5); Co.start(erupt(b, 1), 'fight'); Co.start(Post.lerpTo({ bloom: 0.62, tint: [1.08, 0.97, 0.9] }, 3), 'fight'); yield 3.2; },
        *run(b) {
          const S = b.state;
          while (true) {
            spawnGeode(b); yield* meteors(b, 5, false); yield* slam(b, { extra: [PI] }); yield* slam(b);
            yield* surge(b, [0, 2, 4, 6], { wait: 4.2, dur: 5 }); yield* surge(b, [1, 3, 5, 7], { dur: 5, wait: 1.5 }); yield* breath(b); yield 2.5;
            spawnGeode(b); yield* sweepArm(b); yield* stoke(b); yield* slam(b, { extra: [PI / 2, -PI / 2] }); yield* meteors(b, 4, true); yield* slam(b); yield* breath(b);
          }
        } },
      { at: 0.34, *enter(b) {
        const S = b.state; yield* b.cast({ name: 'Cataclysm', time: 2.6, onTick: (k) => { S.stoke = k; FX.shake(k * 0.6); } }); S.stoke = 0;
        Sound.sfx('bigboom'); Sound.sfx('roar', 1, 0.5); FX.flash(0xffa040, 0.7, 1); FX.shake(1.4); Co.start(erupt(b, 2), 'fight'); Co.start(Post.lerpTo({ bloom: 0.7, threshold: 0.9, exposure: 1.02, tint: [1.1, 0.95, 0.87] }, 3), 'fight');
        const p = segOf(G.player.pos.x, G.player.pos.z), a = (p + 4) % 8, c = (p + 5) % 8;
        for (const i of [a, c]) { const sg = S.seg[i]; sg.gone = true; sg.on = true; sg.until = 1e9; sg.warn = 3; Hz.zone({ type: 'cone', x: 0, z: 0, dir: (i + 0.5) * SEG, arc: SEG + 0.004, r: R1 + 0.3, r0: R0 - 0.3 }, 99999, 200, { name: 'Lava', tag: 'fight', color: 0xff4a08, delay: 3, every: 0.5 }); for (const q of S.geodes) if (q.alive && Math.floor((((q.a % TAU) + TAU) % TAU) / SEG) === i) { q.alive = false; q.grp.visible = false; } }
        yield 3.4;
      }, *run(b) {
        const S = b.state;
        while (true) {
          spawnGeode(b); yield* slam(b, { extra: [PI], time: 1.7 }); yield* meteors(b, 6, true); yield* slam(b, { time: 1.7 });
          yield* surge(b, pickSegs(S, 3), { wait: 1.2 }); yield* breath(b); yield* sweepArm(b);
          spawnGeode(b); yield* stoke(b); yield* slam(b, { extra: [PI / 2, -PI / 2], time: 1.7 }); yield* surge(b, pickSegs(S, 3), { wait: 0.5 }); yield* meteors(b, 5, true); yield* slam(b, { time: 1.7 }); yield* breath(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, t = G.now;
      if (S.stag > 0) { S.stag -= dt; if (S.stag <= 0) { b.dmgTaken = S.armor; Sound.sfx('boom', 0.6, 0.6); } }
      for (const sg of S.seg) { if (!sg.on) continue; sg.until -= dt; sg.warn -= dt; if (sg.until <= 0) sg.on = false; }
      for (const q of S.geodes) if (q.alive) q.t += dt;
      if (G.headless) return;
      for (const sg of S.seg) { const tgt = sg.on ? (sg.warn > 0 ? 0.35 : 1) : 0; sg.lvl = damp(sg.lvl, tgt, sg.on ? 2.5 : 1.5, dt); sg.m.visible = sg.lvl > 0.02; sg.m.position.y = -0.5 + sg.lvl * 0.56; }
      for (const q of S.geodes) if (q.alive) { q.grp.scale.setScalar(Math.min(1, q.t / 0.6)); q.grp.rotation.y += dt * 0.3; if (vrand() < dt * 6) FX.burst(q.grp.position.x, 1.5, q.grp.position.z, { n: 1, color: ICE, speed: [0.5, 2], up: 2, life: [0.4, 0.9], size: [0.1, 0.25], radius: 0.8 }); }
      S.geoMat.emissiveIntensity = 2.4 + Math.sin(t * 4) * 0.8;
      // body
      S.open = damp(S.open, S.stag > 0 ? 1 : 0, 4, dt);
      S.body.position.y = -3 + S.rise + Math.sin(t * 0.7) * 0.25 - S.open * 1.2; S.torso.rotation.x = S.open * 0.2 + Math.sin(t * 0.5) * 0.02 + (S.breath === 1 ? -0.08 : S.breath === 2 ? 0.14 : 0);
      S.head.rotation.x = damp(S.head.rotation.x, S.open * 0.5 + (S.stoke > 0 ? -0.5 : 0) + (S.breath ? 0.25 : 0.12), 5, dt);
      for (const p of S.plates) { p.pv.rotation.y = p.sx * S.open * 1.3; p.pv.rotation.x = -p.sy * S.open * 0.9; }
      const heat = 0.5 + S.open * 3 + S.stoke * 2 + Math.sin(t * 2.4) * 0.15; S.coreMat.color.setRGB(1.0 * heat + 0.4, 0.45 * heat + 0.1, 0.1 * heat); S.coreL.intensity = S.open * 500 + S.stoke * 200;
      S.mouth.color.setHex(FIRE).multiplyScalar(1.5 + S.stoke * 6 + (S.breath ? 6 : 0)); S.eyes.color.setHex(S.stag > 0 ? 0x404040 : 0xffd070).multiplyScalar(S.stag > 0 ? 1 : 5);
      if (S.breath === 2 && vrand() < dt * 60) { S.head.getWorldPosition(_v); const a = b.facing; FX.burst(_v.x + Math.sin(a) * 3, _v.y - 1, _v.z + Math.cos(a) * 3, { n: 3, color: FIRE, color2: 0xffe0a0, dir: [Math.sin(a), -0.75, Math.cos(a)], spread: 0.18, speed: [16, 26], life: [0.4, 0.8], size: [0.5, 1.4] }); }
      if (S.stag > 0 && vrand() < dt * 30) { S.core.getWorldPosition(_v); FX.burst(_v.x, _v.y, _v.z, { n: 1, color: 0xffd080, speed: [2, 8], life: [0.4, 0.9], size: [0.2, 0.5] }); }
      // arms: rest on the lip, raise, slam, sweep
      for (const A of S.arms) {
        const restA = b.facing + A.sx * -1.05;
        if (A.mode === 'rest') pt(restA, R0 + 0.6, 1.6 + Math.sin(t * 0.8 + A.sx) * 0.3, A.tgt);
        else if (A.mode === 'raise') pt(A.ang, MID - 3, 19, A.tgt);
        else if (A.mode === 'sweep') pt(A.ang, MID, 3.2, A.tgt);
        else { pt(A.ang, MID, 1.8, A.tgt); A.hold -= dt; if (A.hold <= 0) A.mode = 'rest'; }
        A.cur.lerp(A.tgt, 1 - Math.exp(-(A.mode === 'slam' ? 26 : A.mode === 'sweep' ? 30 : 3.2) * dt));
        A.g.lookAt(A.cur); A.g.getWorldPosition(_v); A.g.scale.z = clamp(_v.distanceTo(A.cur) / ARM, 0.5, 1.8);
      }
      S.plume.material.opacity = 0.35 + S.lvl * 0.2 + Math.sin(t * 3) * 0.05; S.plume.scale.x = S.plume.scale.z = 1 + S.lvl * 0.4 + Math.sin(t * 1.3) * 0.05;
      if (S.lvl >= 1 && vrand() < dt * (S.lvl * 3)) { const a = vrand() * TAU, r = vrand() * 9; FX.burst(Math.sin(a) * r, -1, Math.cos(a) * r, { n: 10, color: FIRE, color2: 0xffe0a0, speed: [1, 4], up: 9 + S.lvl * 4, grav: 10, life: [0.8, 1.6], size: [0.3, 0.8] }); }
    },
    bot(b, p) {
      const S = b.state, melee = p.cls.id === 'duskblade', r = melee ? 12.9 : 14.5;
      if (S.swp) return { x: Math.sin(S.swp.gap) * r, z: Math.cos(S.swp.gap) * r, w: 4 };
      const q = S.geodes.find((c) => c.alive && c.t > 0.8 && Hz.threat(Math.sin(c.a) * r, Math.cos(c.a) * r) > 2.5);
      if (q && S.stag <= 0 && (!S.pend || S.pend.t > S.pend.lock + 0.1)) return { x: Math.sin(q.a) * r, z: Math.cos(q.a) * r, w: 1.2 };
      return {};
    },
  });
  const _v = new V3();
})();
