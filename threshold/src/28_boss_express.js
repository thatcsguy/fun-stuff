// DOOR IX: IRONJAW, the Midnight Express. A fight along the roof of a moving train. The country it runs through is trying to kill you too.
(() => {
  const HW = 5, LANE = 3.35, FIRE = 0xff6a1a, SIGNAL = 0xff3020, GY = -2.7, Z0 = -40, LEN = 62;
  const CARS = [['T', -40, -26], ['A', -24, -10], ['B', -8, 6], ['C', 8, 22]];
  const _a = new V3(), _b2 = new V3(), _m = new THREE.Object3D();

  const carAt = (S, x, z) => Math.abs(x) > HW ? null : S.cars.find((c) => c.on && z >= c.z0 + c.off && z <= c.z1 + c.off) || null;
  function gapAt(S, x, z) { if (Math.abs(x) > HW) return null; for (let i = 0; i < 3; i++) { const a = S.cars[i], c = S.cars[i + 1]; if (a.on && c.on && !a.loose && !c.loose && z > a.z1 && z < c.z0) return [a, c]; } return null; }
  const car = (S, id) => S.cars.find((c) => c.id === id);
  const live = (S) => S.cars.filter((c) => c.on && !c.loose);

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x030714, horizon: 0x24365c, bottom: 0x05070c, stars: 1.2, sunDir: [0.55, 0.42, -0.72], sunColor: 0xe8eeff, sunSize: 0.075, sunGlow: 0.9, clouds: 0.3, cloudColor: 0x6a7a9a, cloudDark: 0x080c18, cloudSpeed: 0.02, cloudScale: 1.1 });
    g.add(sky); S.sky = sky; W.env(sky, 0.8);
    scene.fog = new THREE.FogExp2(0x101a2c, 0.0055);
    S.hemi = W.hemi(g, 0x5a70a4, 0x2a221c, 1.05);
    S.sun = W.sun(g, { dir: [0.55, 0.62, -0.5], color: 0xa8c0ff, intensity: 3.1, size: 36 });
    S.sun.target.position.set(0, 0, -9); S.sun.shadow.camera.top = 40; S.sun.shadow.camera.bottom = -40; S.sun.shadow.camera.updateProjectionMatrix();
    // ---- the country ----
    const sand = W.surface('rock', { seed: 12, dark: 0x1c1812, light: 0x9a8460, strength: 2 }); for (const k in sand) sand[k].repeat.set(40, 60);
    S.sand = sand; S.ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 1200), new THREE.MeshStandardMaterial({ map: sand.map, normalMap: sand.normalMap, roughness: 0.95 })); S.ground.rotation.x = -PI / 2; S.ground.position.y = GY; S.ground.receiveShadow = true; g.add(S.ground);
    const rock = W.mat({ color: 0x4a3626, roughness: 1 }), steel = W.mat({ color: 0x2a2c32, roughness: 0.45, metalness: 0.85 }), darkSteel = W.mat({ color: 0x121318, roughness: 0.6, metalness: 0.7 });
    for (const sx of [-1, 1]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(400, 60, 1200), rock); pl.position.set(sx * 275, GY - 30.1, 0); g.add(pl); }
    const vr = mulberry(909);
    for (let i = 0; i < 18; i++) { const a = vr() * TAU, rr = 330 + vr() * 300, h = 30 + vr() * 80, rt = 20 + vr() * 60; const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rt * 1.25, h, 7), rock); m.position.set(Math.sin(a) * rr, GY + h / 2 - 2, Math.cos(a) * rr); m.rotation.y = vr() * 3; g.add(m); }
    // track bed: everything periodic lives in a group that slides by (scroll % period)
    S.bed = new THREE.Group(); g.add(S.bed);
    for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 700), steel); rail.position.set(sx * 1.6, GY + 0.42, 0); g.add(rail); }
    const ballast = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 700), W.mat({ color: 0x241f1a, roughness: 1 })); ballast.position.set(0, GY + 0.05, 0); g.add(ballast);
    const NS = 130, sl = new THREE.InstancedMesh(new THREE.BoxGeometry(4.6, 0.2, 0.55), W.mat({ color: 0x1a120c, roughness: 0.9 }), NS); for (let i = 0; i < NS; i++) { _m.position.set(0, GY + 0.3, -170 + i * 2.6); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); sl.setMatrixAt(i, _m.matrix); } S.bed.add(sl);
    S.poles = new THREE.Group(); g.add(S.poles);
    for (let i = -5; i <= 5; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 11, 6), W.mat({ color: 0x1c140e, roughness: 0.9 })); p.position.set(-10, GY + 5.5, i * 46); S.poles.add(p); const cb = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 0.18), p.material); cb.position.set(-10, GY + 10.2, i * 46); S.poles.add(cb); }
    S.scrub = new THREE.Group(); g.add(S.scrub);
    { const NCt = 70, P = 260, trunk = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.5, 3.4, 3, 8), W.mat({ color: 0x14301c, roughness: 0.9 }), NCt * 2), arm = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.3, 1.5, 3, 6), trunk.material, NCt * 2), rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.6, 0), rock, NCt * 2);
      for (let i = 0; i < NCt; i++) { const sx = vr() < 0.5 ? -1 : 1, x = sx * (13 + Math.pow(vr(), 1.6) * 120), z = vr() * P, sc = 0.7 + vr() * 0.9, rx = (vr() < 0.5 ? -1 : 1) * (11 + vr() * 90), rz = vr() * P, rs = 0.6 + vr() * 2.4;
        for (let c = 0; c < 2; c++) { const zz = z - c * P, k = i * 2 + c; _m.rotation.set(0, 0, 0); _m.scale.setScalar(sc); _m.position.set(x, GY + 2 * sc, zz); _m.updateMatrix(); trunk.setMatrixAt(k, _m.matrix); _m.position.set(x + 0.9 * sc, GY + 2.6 * sc, zz); _m.updateMatrix(); arm.setMatrixAt(k, _m.matrix); _m.position.set(rx, GY + 0.3, rz - c * P); _m.scale.set(rs, rs * 0.7, rs); _m.rotation.set(i, i * 2, 0); _m.updateMatrix(); rk.setMatrixAt(k, _m.matrix); } }
      S.scrub.add(trunk); S.scrub.add(arm); S.scrub.add(rk); S.scrubP = P; }
    S.trestle = new THREE.Group(); S.trestle.visible = false; g.add(S.trestle);
    { const NT = 24, beam = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 60, 0.5), W.mat({ color: 0x2a1c12, roughness: 0.9 }), NT * 2), cross = new THREE.InstancedMesh(new THREE.BoxGeometry(9, 0.4, 0.4), beam.material, NT * 3); let k2 = 0;
      for (let i = 0; i < NT; i++) { const z = -150 + i * 13; for (const sx of [-1, 1]) { _m.position.set(sx * 3.2, GY - 30, z); _m.rotation.set(0, 0, sx * 0.05); _m.scale.setScalar(1); _m.updateMatrix(); beam.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), _m.matrix); } for (let c = 0; c < 3; c++) { _m.position.set(0, GY - 6 - c * 16, z); _m.rotation.set(0, 0, c % 2 ? 0.5 : -0.5); _m.updateMatrix(); cross.setMatrixAt(k2++, _m.matrix); } }
      S.trestle.add(beam); S.trestle.add(cross); }
    S.tunnel = new THREE.Mesh(new THREE.BoxGeometry(24, 15, 150), W.mat({ color: 0x0a0806, roughness: 1, side: THREE.BackSide })); S.tunnel.position.set(0, 4.6, -900); g.add(S.tunnel);
    S.dust = W.motes({ n: 520, box: [70, 16, 150], color: 0xcdb890, size: 0.6, vel: [0, 0, 46], streak: true, center: [0, 5, -8], alpha: 0.35, mult: 0.7 }); g.add(S.dust);
    // ---- the train ----
    const wd = W.surface('wood', { n: 10, dark: 0x1c120a, light: 0x8a6238, strength: 2.4, seed: 2 }); for (const k in wd) wd[k].repeat.set(1, 2);
    const deckM = new THREE.MeshStandardMaterial({ map: wd.map, normalMap: wd.normalMap, roughnessMap: wd.roughnessMap, roughness: 0.75, metalness: 0.05 });
    S.cars = CARS.map(([id, z0, z1]) => {
      const grp = new THREE.Group(), zc = (z0 + z1) / 2, len = z1 - z0; grp.position.z = zc; g.add(grp);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.5, len), [steel, steel, deckM, darkSteel, steel, steel]); deck.position.y = -0.25; deck.receiveShadow = true; deck.castShadow = true; grp.add(deck);
      for (const sx of [-1, 1]) { const sill = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, len), steel); sill.position.set(sx * (HW + 0.05), -0.4, 0); grp.add(sill); for (let k = 0; k < 5; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.3), darkSteel); st.position.set(sx * (HW + 0.2), -0.1, -len / 2 + 1.4 + k * (len - 2.8) / 4); grp.add(st); } }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, len - 1), darkSteel); frame.position.y = -1.0; grp.add(frame);
      const wheels = [];
      for (const zz of [-len / 2 + 2.6, -len / 2 + 4.6, len / 2 - 4.6, len / 2 - 2.6]) for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 16), steel); w.rotation.z = PI / 2; w.position.set(sx * 1.6, GY + 1.45, zz); grp.add(w); wheels.push(w); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.5, 0.2), darkSteel); sp.position.copy(w.position); grp.add(sp); wheels.push(sp); }
      const heatM = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, emissive: FIRE, emissiveIntensity: 0, roughness: 0.5, metalness: 0.8 });
      for (const xx of [-2.6, 0, 2.6]) { const gr = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, len - 2.4), heatM); gr.position.set(xx, 0.02, 0); grp.add(gr); }
      const boltM = W.glow(SIGNAL, 0.05), bolts = [];
      if (id !== 'T') { const cp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 2.4), darkSteel); cp.position.set(0, -0.9, -len / 2 - 1); grp.add(cp); for (const sx of [-1, 1]) { const bo = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), boltM); bo.position.set(sx * 3.6, 0.2, -len / 2 + 0.4); grp.add(bo); bolts.push(bo); } }
      return { id, z0, z1, zc, on: true, off: 0, v: 0, loose: false, warn: 0, heat: 0, hot: 0, grp, wheels, heatM, boltM };
    });
    // locomotive
    const loco = new THREE.Group(); loco.position.z = -40; g.add(loco); S.loco = loco;
    const iron = W.mat({ color: 0x15161a, roughness: 0.35, metalness: 0.9, envMapIntensity: 1.6 }), brass = W.mat({ color: 0xc09040, roughness: 0.3, metalness: 1 });
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 22, 24), iron); boiler.rotation.x = PI / 2; boiler.position.set(0, 2.0, -15); boiler.castShadow = true; loco.add(boiler);
    for (const z of [-6, -11, -16, -21, -25.5]) { const bd = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.09, 6, 32), brass); bd.position.set(0, 2.0, z); loco.add(bd); }
    const cab = new THREE.Mesh(new THREE.BoxGeometry(7, 6.5, 5), iron); cab.position.set(0, 3.2, -2.6); cab.castShadow = true; loco.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 6.4), darkSteel); roof.position.set(0, 6.6, -2.6); loco.add(roof);
    S.cabGlow = W.glow(FIRE, 2); for (const sx of [-1, 1]) { const wn = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), S.cabGlow); wn.position.set(sx * 1.7, 4.6, -0.08); loco.add(wn); }
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 3.4, 16), iron); stack.position.set(0, 6.2, -23); loco.add(stack);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), brass); dome.position.set(0, 4.6, -13); loco.add(dome);
    S.lampM = W.glow(0xfff0c0, 6); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), S.lampM); lamp.position.set(0, 4.6, -26.4); loco.add(lamp);
    S.drive = []; for (const zz of [-8, -13.5, -19]) for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.4, 20), iron); w.rotation.z = PI / 2; w.position.set(sx * 1.75, GY + 2.2, zz); loco.add(w); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.0, 0.3), brass); sp.position.copy(w.position); loco.add(sp); S.drive.push(sp); }
    for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 12), brass); rod.position.set(sx * 2.05, GY + 2.2, -13.5); loco.add(rod); S.drive.push(rod); rod.userData.rod = 1; }
    const cow = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4, 4), iron); cow.rotation.x = -PI / 2; cow.rotation.z = PI / 4; cow.scale.y = 1; cow.position.set(0, -0.6, -28.5); loco.add(cow);
    // signal mast: three lamps, one per lane
    S.sigM = [-1, 0, 1].map((l) => { const m = W.glow(SIGNAL, 0.06); const s = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), m); s.position.set(l * 2.4, 9.4, -39.2); g.add(s); const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 12), darkSteel); hd.rotation.x = PI / 2; hd.position.set(l * 2.4, 9.4, -39.5); g.add(hd); return m; });
    const mast = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 0.3), darkSteel); mast.position.set(0, 8.6, -39.5); g.add(mast);
    for (const sx of [-1, 1]) { const mp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), darkSteel); mp.position.set(sx * 3.4, 4.3, -39.6); g.add(mp); }
    // trackside things that reach across the cars
    S.obs = [-1, 0, 1].map((l) => {
      const o = new THREE.Group(); o.visible = false; g.add(o);
      if (l) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 12, 0.9), darkSteel); post.position.set(l * 7.4, 2, 0); o.add(post); const arm = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 0.7), steel); arm.position.set(l * 4.3, 1.25, 0); o.add(arm); const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.9), W.glow(SIGNAL, 2.5)); tip.position.set(l * 1.6, 1.25, 0); o.add(tip); }
      else { for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.9, 14, 0.9), darkSteel); post.position.set(sx * 7.4, 3, 0); o.add(post); } const top = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.9, 0.9), darkSteel); top.position.set(0, 9.6, 0); o.add(top); const hang = new THREE.Mesh(new THREE.BoxGeometry(3.0, 8.6, 0.7), steel); hang.position.set(0, 5.0, 0); o.add(hang); const tip = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.9), W.glow(SIGNAL, 2.5)); tip.position.set(0, 0.85, 0); o.add(tip); }
      return { g: o, t: 0, on: false, at: 0 };
    });

    // ---- Ironjaw ----
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    const rust = W.mat({ color: 0x3a2a22, roughness: 0.55, metalness: 0.8, envMapIntensity: 1.4 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.5, 3.0, 20), rust); torso.position.y = 3.2; torso.castShadow = true; S.rig.add(torso);
    for (const y of [1.9, 3.2, 4.5]) { const bd = new THREE.Mesh(new THREE.TorusGeometry(y === 4.5 ? 1.72 : 1.62, 0.1, 6, 28), brass); bd.rotation.x = PI / 2; bd.position.y = y; S.rig.add(bd); }
    const topD = new THREE.Mesh(new THREE.SphereGeometry(1.75, 20, 12, 0, TAU, 0, PI / 2), rust); topD.position.y = 4.7; topD.scale.y = 0.55; S.rig.add(topD);
    S.furM = W.glow(FIRE, 2.2); const door = new THREE.Mesh(new THREE.CircleGeometry(0.95, 20), S.furM); door.position.set(0, 3.0, 1.62); S.rig.add(door);
    for (let i = -2; i <= 2; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.12), iron); bar.position.set(i * 0.36, 3.0, 1.68); S.rig.add(bar); }
    const ringD = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.12, 6, 24), brass); ringD.position.set(0, 3.0, 1.64); S.rig.add(ringD);
    S.head = new THREE.Group(); S.head.position.set(0, 5.7, 0.3); S.rig.add(S.head);
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 1.1, 14), iron); helm.castShadow = true; S.head.add(helm);
    S.eyeM = W.glow(0xfff0c0, 5); const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 14), S.eyeM); eye.rotation.x = PI / 2; eye.position.set(0, 0.12, 0.8); S.head.add(eye);
    S.jaw = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.2), iron); S.jaw.position.set(0, -0.62, 0.3); S.head.add(S.jaw);
    for (let i = 0; i < 6; i++) { const th = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 4), brass); th.position.set(-0.55 + i * 0.22, 0.32, 0.5); S.jaw.add(th); }
    const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 2.2, 10), iron); stk.position.set(-1.0, 5.6, -0.9); stk.rotation.z = 0.2; S.rig.add(stk);
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.9, 10), iron); leg.position.set(sx * 0.95, 0.95, 0); leg.castShadow = true; S.rig.add(leg); const ft = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.0), iron); ft.position.set(sx * 0.95, 0.25, 0.3); S.rig.add(ft); }
    S.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 2.2, 4.3, 0); S.rig.add(sh);
      const pau = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), rust); pau.castShadow = true; sh.add(pau);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.8, 12), iron); cyl.position.y = -1.1; cyl.castShadow = true; sh.add(cyl);
      const rodM = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 8), brass); rodM.position.y = -2.3; sh.add(rodM);
      const fist = new THREE.Group(); fist.position.y = -3.4; sh.add(fist);
      if (sx > 0) { const sv = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 1.9), iron); sv.position.set(0, -0.3, 0.6); sv.castShadow = true; fist.add(sv); const kn = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), rust); fist.add(kn); }
      else { const hk = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.13, 6, 16, PI * 1.3), brass); hk.position.y = -0.5; hk.rotation.y = PI / 2; fist.add(hk); const kn = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), rust); fist.add(kn); }
      S.arms.push({ sh, rodM, fist, sx, ext: 0 });
    }
    S.furL = new THREE.PointLight(FIRE, 160, 34, 1.6); S.furL.position.set(0, 3, 2.6); bg.add(S.furL);
    S.lampL = new THREE.PointLight(0xffe0a0, 120, 60, 1.5); S.lampL.position.set(0, 7, -8); g.add(S.lampL);
    Object.assign(S, { scroll: 0, speed: 38, speedT: 38, lean: 0, leanK: 0, leanTele: 0, wind: 0, windK: 0, gy: GY, gyT: GY, dark: 0, heat: 0, punch: 0, sig: [0, 0, 0], lvl: 0 });
    return {
      edge: 'fall', spawn: { x: 0, z: -13 }, bossStart: { x: 0, z: -37.3, face: 0 }, camDist: 15,
      contains: (x, z) => !!carAt(S, x, z) || !!gapAt(S, x, z),
      clamp() { }, bulletBounds: (x, z) => z < 60 && z > -45,
      camLimit(x, y, z) { return { x, y: Math.max(y, 0.6), z: Math.max(z, -37) }; },
    };
  }

  // ---- hazards ----
  function* sweep(b, lanes, delay = 1.9) {
    const S = b.state; Sound.sfx('steam', 1, 1.8); Sound.sfx('bell', 0.5, 2.6); S.sig = [-1, 0, 1].map((l) => lanes.includes(l) ? 1 : 0);
    for (const l of lanes) {
      Hz.rect(l * LANE, Z0 - 0.5, 0, LEN + 1, LANE - 0.05, delay, 340, { name: 'Trackside', color: SIGNAL, quiet: true, onFire() { Sound.sfx('boom', 0.9, 1.4); FX.shake(0.4); } });
      const o = S.obs[l + 1]; o.on = true; o.t = -delay; o.g.visible = true;
    }
    yield delay + 0.25; S.sig = [0, 0, 0];
  }
  function* stoke(b, n) {
    const S = b.state; yield* b.cast({ name: 'Stoke', time: 0.6 });
    for (let i = 0; i < n; i++) {
      const p = G.player, x = clamp(p.pos.x + (i ? rnd(-1.2, 1.2) : 0), -HW + 0.5, HW - 0.5), z = p.pos.z + (i ? rnd(-1.5, 1.5) : 0); S.punch = 1;
      FX.missile(new V3(b.pos.x + 1.5, 4.5, b.pos.z + 1), new V3(x, 0.2, z), { speed: 26, arc: 6, color: FIRE, size: 0.4 }); Sound.sfx('dash', 0.7, 0.5);
      Hz.circle(x, z, 2.5, 1.15, 250, { name: 'Hot Coal', onFire() { FX.explode(x, 0.4, z, FIRE, 2.6, 0xffe0a0); Sound.sfx('boom', 0.7, 1.2); Hz.zone({ type: 'circle', x, z, r: 1.8 }, 5, 60, { name: 'Embers', color: 0xff8a2a, delay: 0.3 }); } });
      yield 0.85;
    }
    yield 0.5;
  }
  function* piston(b, quick) {
    const S = b.state, dir = b.angToPlayer(), t = quick ? 0.95 : 1.25; b.autoFace = false; S.wind_up = 1;
    Hz.rect(b.pos.x, b.pos.z, dir, 11, 5.2, t, 320, { name: 'Piston', kb: { dir, dist: 2.5 }, onFire() { S.punch = 1.4; FX.shake(0.5); Sound.sfx('bigboom', 0.5); FX.burst(b.pos.x + Math.sin(dir) * 5, 1, b.pos.z + Math.cos(dir) * 5, { n: 30, smoke: true, color: 0xd0d0d0, color2: 0x404040, speed: [2, 9], life: [0.4, 1], size: [0.8, 1.8], alpha: 0.5 }); } });
    yield* b.cast({ name: 'Piston', time: t }); S.wind_up = 0; yield 0.5; b.autoFace = true;
  }
  function* furnace(b, ids, dur = 5) {
    const S = b.state; yield* b.cast({ name: 'Overheat', time: 0.7 }); Sound.sfx('steam', 1, 0.6);
    let k = 0, D = 3.0; for (const id of ids) { const c = car(S, id); if (!c || !c.on || c.loose) continue; D = 3.0 + 1.7 * k++; c.hot = D + dur; c.heatT = D; c.hotDur = dur; Hz.zone({ type: 'rect', x: 0, z: c.z0, dir: 0, len: c.z1 - c.z0, w: HW * 2 }, dur, 170, { name: 'Overheat', color: 0xff5a1a, delay: D }); }
    yield D; Sound.sfx('roar', 0.5, 1.5); yield 1.0;
  }
  const myCar = (S) => { const p = G.player, c = carAt(S, p.pos.x, p.pos.z); if (c) return c; let best = null; for (const q of live(S)) if (!best || Math.abs(q.zc - p.pos.z) < Math.abs(best.zc - p.pos.z)) best = q; return best; };
  function* hook(b) {
    const S = b.state, p = G.player; S.hookUp = 1;
    const r = yield* b.cast({ name: 'Chain Hook', time: 2.8, interruptible: true }); S.hookUp = 0;
    if (r !== 'done') { yield 1.0; return; }
    if (!G.headless) FX.beam(new V3(b.pos.x - 2, 3, b.pos.z + 1), p.aim(new V3()), { color: 0xffd080, width: 0.2, dur: 0.4 }); Sound.sfx('sword', 1, 0.5);
    const tx = b.pos.x, tz = b.pos.z + 5.2, dx = tx - p.pos.x, dz = tz - p.pos.z;
    if (p.hurt(240, { blockable: true, src: { name: 'Chain Hook' } }) > 0 && p.alive) { p.dash = { vx: dx / 0.4, vz: dz / 0.4, t: 0.4 }; p.casting = null; p.rooted = 1.3; }
    yield 0.5; yield* piston(b, true);
  }
  function* lean(b, side, dur = 3.4, withSweep) {
    const S = b.state; S.leanTele = side; Sound.sfx('sword', 0.9, 0.35); Sound.sfx('steam', 0.8, 2.4); yield 1.3;
    S.leanTele = 0; S.lean = side; if (withSweep) Co.start(sweep(b, [side]), 'phase'); yield dur; S.lean = 0; yield 0.6;
  }
  function* cinders(b, dur = 5) {
    yield* b.cast({ name: 'Cinders', time: 0.7 }); let t = 0, last = 0;
    while (t < dur) { let l; do { l = rndi(-1, 1); } while (l === last); last = l; Bul.fire({ x: l * LANE + rnd(-0.9, 0.9), z: -44, dir: 0, speed: 15, r: 0.45, dmg: 120, color: 0xff8a2a, life: 4.6 }); if (rnd() < 0.4) Bul.fire({ x: rnd(-4.5, 4.5), z: -46, dir: 0, speed: 15, r: 0.4, dmg: 120, color: 0xffb040, life: 4.6 }); t += 0.34; yield 0.34; }
    yield 0.6;
  }
  function* uncouple(b, id) {
    const S = b.state, c = car(S, id); if (!c.on || c.loose) return; c.warn = 4.4; Sound.sfx('bell', 1, 1.6);
    Hz.mark({ type: 'rect', x: 0, z: c.z0, dir: 0, len: c.z1 - c.z0, w: HW * 2 }, 4.4, { color: SIGNAL, tag: 'fight', style: 2, zoneStyle: 2, alpha: 0.8 });
    for (let i = 0; i < 4; i++) { yield 1.1; Sound.sfx('warn', 2, 0.6 + i * 0.15); }
    c.loose = true; c.warn = 0; Sound.sfx('bigboom', 0.9); FX.shake(0.8); FX.explode(0, 0, c.z0 - 1, FIRE, 5, 0xffffff);
  }
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.lean = 0; S.leanTele = 0; S.sig = [0, 0, 0]; S.hookUp = 0; S.wind_up = 0; b.autoFace = true;
    const drop = (id) => { const c = car(S, id); if (c.on && !c.loose) { c.loose = true; c.off = 200; } };
    if (n >= 1) { if (!car(S, 'C').loose) drop('C'); S.gyT = GY - 46; S.trestle.visible = true; }
    if (n >= 2) { if (!car(S, 'B').loose) drop('B'); S.wind = 1; S.speedT = 56; }
    const p = G.player; if (p && !carAt(S, p.pos.x, p.pos.z) && !gapAt(S, p.pos.x, p.pos.z)) p.pos.set(0, 0, -13);
  }
  function* skyTo(b, o, dur) {
    const U = b.state.sky.material.uniforms, keys = Object.keys(o), from = keys.map((k) => U[k].value.isColor ? U[k].value.clone() : U[k].value), to = keys.map((k) => U[k].value.isColor ? new THREE.Color(o[k]) : o[k]);
    yield* W.tween(dur, (t) => keys.forEach((k, i) => { if (U[k].value.isColor) W.colorLerp(U[k].value, from[i], to[i], t); else U[k].value = lerp(from[i], to[i], t); }));
  }
  const side = () => rnd() < 0.5 ? -1 : 1;

  G.bosses.push({
    id: 'express', name: 'IRONJAW', title: 'The Midnight Express', hint: 'A departure', color: '#ff5a36', telegraph: 0xff7a2a,
    hp: 28000, radius: 2.2, aimY: 3.4, enrage: 450,
    post: { bloom: 0.55, threshold: 0.88, radius: 0.65, exposure: 1.12, vig: 1.0, sat: 1.08, contrast: 1.06, tint: [0.97, 1.0, 1.08] },
    music: { bpm: 152, root: 40, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 0, 0, 0, 3, 4],
      layers: [
        { v: 'hat', pat: 'x.xxx.xxx.xxx.xx', vol: 0.07 }, { v: 'bass', pat: '0.0.0.0.0.0.0.3.', oct: -1, len: 1, vol: 0.12 }, { v: 'tom', pat: 'x.......x.......', vol: 0.22 },
        { v: 'kick', from: 1, pat: 'x...x...x...x...', vol: 0.3 }, { v: 'snare', from: 1, pat: '....x.......x...', vol: 0.16 }, { v: 'koto', from: 1, pat: ['0.2.3.2.0.2.3.5.', '7.5.3.5.7.5.3.2.'], oct: 1, len: 1, vol: 0.08 },
        { v: 'brass', from: 2, pat: ['0.......3...4...', '7.......5...4...'], oct: 1, len: 5, vol: 0.11 }, { v: 'snare', from: 2, pat: '..x...x...x...xx', vol: 0.1 }, { v: 'lead', from: 2, pat: ['0.3.5.7.5.3.0.3.', '4.7.9.b.9.7.4.7.'], oct: 2, len: 1, vol: 0.045 }, { v: 'taiko', from: 2, pat: 'x..x..x.x..x..x.', vol: 0.26 },
      ] },
    build,
    *intro(b) { Sound.sfx('steam', 1, 0.5); yield* Cam.shot([-16, 3, -62], [0, 3, -50], [-9, 6, -22], [0, 3.5, -37], 5.0, 50); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; b.autoFace = true; b.turnRate = 3; setLvl(b, 0); yield 1.4;
        while (true) {
          yield* stoke(b, 3); yield* piston(b); yield* sweep(b, [side()]);
          yield* furnace(b, [myCar(S).id]); yield* sweep(b, [0]); yield* hook(b);
          yield* lean(b, side()); yield* stoke(b, 3); yield* sweep(b, [side()]); yield* piston(b);
          yield* furnace(b, rnd() < 0.5 ? ['T', 'A'] : ['T', 'B']); yield* sweep(b, [pick([-1, 0, 1])]); yield 1.0;
        }
      } },
      { at: 0.67, *enter(b) {
        const S = b.state; S.lean = 0; b.autoFace = true; Sound.sfx('roar', 0.8, 0.8); Sound.sfx('steam', 1, 0.4); FX.shake(0.7);
        Co.start(uncouple(b, 'C'), 'fight');
        S.tunnel.position.z = -520; S.tunnelGo = 1; yield 3.6; S.dark = 1; yield 1.0;
        S.gyT = GY - 46; S.gy = GY - 46; S.trestle.visible = true; yield 1.6; S.dark = 0;
        Co.start(Post.lerpTo({ tint: [0.94, 1.0, 1.12], bloom: 0.6 }, 2), 'fight'); Sound.sfx('thunder', 0.7); S.sky.material.uniforms.uFlash.value = 1.2; yield 0.6;
      }, *run(b) {
        const S = b.state; setLvl(b, 1); S.gy = S.gyT;
        while (true) {
          yield* sweep(b, [side(), 0]); yield* stoke(b, 4); yield* piston(b);
          { const s = side(); yield* lean(b, s, 3.6, true); }
          yield* furnace(b, [myCar(S).id]); yield* hook(b); yield* sweep(b, [-1, 1]);
          yield* stoke(b, 3); yield* furnace(b, ['T', rnd() < 0.5 ? 'A' : 'B']); yield* sweep(b, [0]); yield* piston(b);
          { const s = side(); yield* lean(b, s, 3.0); } yield* sweep(b, [side(), 0], 1.7);
        }
      } },
      { at: 0.34, *enter(b) {
        const S = b.state; S.lean = 0; b.autoFace = true; S.heat = 1;
        Co.start(uncouple(b, 'B'), 'fight');
        yield* b.cast({ name: 'Full Steam', time: 3.0, onTick: (k) => { FX.shake(k * 0.5); S.speedT = 38 + k * 18; } });
        Sound.sfx('roar', 1, 0.5); Sound.sfx('bigboom'); FX.flash(FIRE, 0.5, 1.2); FX.shake(1.2); S.wind = 1;
        Co.start(skyTo(b, { uHor: 0xff8a4a, uTop: 0x1c2a66, uStars: 0.25, uCloudCol: 0xffa070, uSunCol: 0xffd0a0 }, 6), 'fight'); Co.start(Post.lerpTo({ tint: [1.06, 0.99, 0.93], bloom: 0.58, exposure: 1.04 }, 4), 'fight');
        S.hemi.color.set(0x8a6a6a); S.sun.color.set(0xffc090); scene.fog.color.set(0x3a2420); yield 1.8;
      }, *run(b) {
        const S = b.state; setLvl(b, 2); S.heat = 1; S.gy = S.gyT;
        while (true) {
          yield* cinders(b, 5); yield* sweep(b, [side(), 0], 1.7); yield* piston(b);
          yield* stoke(b, 3); { const s = side(); yield* lean(b, s, 3.2, true); }
          yield* furnace(b, [myCar(S).id], 4.5); yield* hook(b);
          yield* sweep(b, [-1, 1], 1.7); yield* cinders(b, 4); yield* stoke(b, 3); yield* sweep(b, [0], 1.6); yield* piston(b, true);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      S.speed = damp(S.speed, S.speedT, 0.8, dt); S.scroll += S.speed * dt;
      // cars: coupling bounce, cars cut loose, things that push you around
      const fight = G.state === 'fight' && p.alive;
      for (const c of S.cars) {
        if (c.warn > 0) c.warn -= dt; if (c.hot > 0) c.hot -= dt;
        if (c.loose && c.on) { c.v = Math.min(30, c.v + 6 * dt); c.off += c.v * dt; if (fight && carAt(S, p.pos.x, p.pos.z) === c && p.grounded) p.push.z += c.v; if (c.off > 70) { c.on = false; c.grp.visible = false; } }
      }
      if (fight && p.grounded && !p.dash && !p.kb) {
        const gp = gapAt(S, p.pos.x, p.pos.z);
        if (gp) { const mid = (gp[0].z1 + gp[1].z0) / 2, dz = p.intentZ < -0.2 ? -1 : p.intentZ > 0.2 ? 1 : (p.pos.z < mid ? -1 : 1); p.hurt(220, { blockable: false, src: { name: 'The coupling' } }); p.vy = 7.5; p.grounded = false; p.kb = { vx: 0, vz: dz * 9, t: 0.38 }; FX.impact(p.pos.x, 0.2, p.pos.z, 0xffd080, 1); Sound.sfx('hit', 1, 0.5); }
      }
      S.leanK = damp(S.leanK, S.lean, 2.2, dt); S.windK = damp(S.windK, S.wind, 0.8, dt);
      if (fight && p.grounded) { p.push.x += S.leanK * 3.5; p.push.z += S.windK * 2.1; }
      for (const o of S.obs) if (o.on) { o.t += dt; if (o.t > 1.2) { o.on = false; o.g.visible = false; } }
      if (G.headless) return;
      // scenery
      const sc = S.scroll; S.bed.position.z = sc % 2.6; S.poles.position.z = sc % 46; S.scrub.position.z = sc % S.scrubP;
      S.gy = damp(S.gy, S.gyT, 3, dt); S.ground.position.y = S.gy; S.scrub.position.y = S.gy - GY; S.trestle.position.z = sc % 13;
      const off = sc / 20; S.sand.map.offset.y = off % 1; S.sand.normalMap.offset.y = off % 1;
      if (S.tunnelGo) { S.tunnel.position.z += S.speed * 3.2 * dt; if (S.tunnel.position.z > 400) S.tunnelGo = 0; }
      const dk = S.darkK = damp(S.darkK || 0, S.dark, 5, dt); S.sun.intensity = 2.5 * (1 - dk * 0.95); S.hemi.intensity = 0.75 * (1 - dk * 0.85);
      S.dust.material.uniforms.uVel.value.z = S.speed * 1.2; S.sky.material.uniforms.uFlash.value = Math.max(0, S.sky.material.uniforms.uFlash.value - dt * 2.5);
      for (const c of S.cars) {
        if (!c.on) continue; c.grp.position.z = c.zc + c.off; c.grp.position.y = c.warn > 0 ? Math.sin(t * 40) * 0.03 : 0;
        for (let i = 0; i < c.wheels.length; i += 2) c.wheels[i + 1].rotation.x = -(sc + c.off) / 0.95;
        const h = c.hot > 0 ? (c.hot > c.hotDur ? 0.25 + (1 - (c.hot - c.hotDur) / c.heatT) * 0.5 : 1) : 0; c.heat = damp(c.heat, h, 5, dt); c.heatM.emissiveIntensity = c.heat * (3 + Math.sin(t * 9) * 0.6);
        c.boltM.color.setHex(SIGNAL).multiplyScalar(c.warn > 0 ? (Math.sin(t * 16) > 0 ? 6 : 0.4) : 0.05);
        if (c.heat > 0.7 && vrand() < dt * 30) FX.burst((vrand() - 0.5) * 9, 0.1, c.zc + (vrand() - 0.5) * 13, { n: 1, color: FIRE, color2: 0xffe0a0, speed: [0.5, 2], up: 5, life: [0.3, 0.8], size: [0.3, 0.8] });
      }
      for (const d of S.drive) { if (d.userData.rod) d.position.y = GY + 2.2 + Math.sin(sc / 1.75) * 0.7; else d.rotation.x = -sc / 1.75; }
      if (vrand() < dt * 70) FX.burst(0, 8.4, -63, { n: 1, smoke: true, color: S.heat ? 0x8a5a48 : 0x8a8a90, color2: 0x202024, dir: [0, 0.22, 1], spread: 0.1, speed: [S.speed * 0.5, S.speed * 0.75], life: [1.4, 2.6], size: [3, 6.5], alpha: 0.4 });
      if ((S.lean || S.leanTele) && vrand() < dt * 80) { const s = S.lean || S.leanTele, c = pick(live(S)); if (c) { FX.burst(-s * 1.6, GY + 0.6, c.zc + (vrand() - 0.5) * 12, { n: 2, color: 0xffd080, color2: FIRE, dir: [s, 0.5, 0.6], spread: 0.3, speed: [6, 16], grav: 12, life: [0.3, 0.7], size: [0.12, 0.3] }); FX.burst(-s * 6, 0.4 + vrand() * 2, c.zc + (vrand() - 0.5) * 14, { n: 1, smoke: true, color: 0xcab890, color2: 0x6a5a48, dir: [s, 0, 0.2], spread: 0.1, speed: [10, 16], life: [0.5, 0.9], size: [0.6, 1.4], alpha: 0.3 }); } }
      if (S.windK > 0.3 && vrand() < dt * 50) FX.burst((vrand() - 0.5) * 12, 1 + vrand() * 5, -44, { n: 1, color: 0xffb050, color2: 0xff3010, dir: [0, 0.05, 1], spread: 0.08, speed: [24, 40], life: [0.8, 1.6], size: [0.1, 0.25] });
      for (const o of S.obs) if (o.on) o.g.position.z = -9 + o.t * 95;
      S.sigM.forEach((m, i) => m.color.setHex(SIGNAL).multiplyScalar(S.sig[i] ? (Math.sin(t * 18) > -0.3 ? 7 : 1.5) : 0.06));
      // Ironjaw
      S.punch = Math.max(0, (S.punch || 0) - dt * 2.4); const cast = b.castState ? 1 : 0;
      S.rig.position.y = Math.sin(t * 9) * 0.03; S.rig.rotation.x = (S.wind_up ? -0.14 : 0) + S.punch * 0.12; S.head.rotation.y = Math.sin(t * 0.8) * 0.2; S.jaw.position.y = -0.62 - cast * 0.18 - Math.abs(Math.sin(t * 5)) * 0.05 * cast;
      for (const A of S.arms) { const up = A.sx > 0 ? (S.wind_up ? 1 : 0) : (S.hookUp ? 1 : 0); A.ext = damp(A.ext, up, 6, dt); const pk = A.sx > 0 ? S.punch : 0; A.sh.rotation.set(-0.25 - A.ext * 1.7 + pk * 2.2 + Math.sin(t * 1.3 + A.sx) * 0.05, 0, A.sx * (0.25 + A.ext * 0.25)); A.rodM.scale.y = 1 + pk * 0.8; A.fist.position.y = -3.4 - pk * 1.6; }
      const hot = S.heat ? 2 : 1; S.furM.color.setHex(S.heat ? 0xffb060 : FIRE).multiplyScalar(hot * (2.2 + cast * 3 + Math.sin(t * 7) * 0.4)); S.furL.intensity = hot * (160 + cast * 140 + Math.sin(t * 11) * 14); S.cabGlow.color.setHex(FIRE).multiplyScalar(2 * hot);
      S.eyeM.color.setHex(0xfff0c0).multiplyScalar(5 + cast * 5);
      if (vrand() < dt * 20) FX.burst(b.pos.x - 1.0, 6.9, b.pos.z - 0.9, { n: 1, smoke: true, color: 0x505058, color2: 0x18181c, dir: [0, 0.6, 1], spread: 0.2, speed: [3, 7], life: [0.6, 1.3], size: [0.6, 1.4], alpha: 0.45 });
    },
    danger(b, x, z) {
      const S = b.state, c = carAt(S, x, z); let best = Infinity;
      if (c && c.warn > 0) best = c.warn; if (c && c.hot > 0) best = Math.min(best, Math.max(0, c.hot - c.hotDur)); if (c && c.loose) best = 0; if (!c && gapAt(S, x, z)) best = 0.4;
      if (S.lean && x * S.lean > 2.4) best = Math.min(best, 0.6);
      return best;
    },
    bot(b, p) {
      const S = b.state;
      // hop the couplings
      if (p.grounded && p.moving) for (let i = 0; i < 3; i++) { const a = S.cars[i], c = S.cars[i + 1]; if (!a.on || !c.on || a.loose || c.loose) continue; if ((p.intentZ > 0.3 && p.pos.z > a.z1 - 0.9 && p.pos.z <= a.z1 + 0.2) || (p.intentZ < -0.3 && p.pos.z < c.z0 + 0.9 && p.pos.z >= c.z0 - 0.2)) p.jump(); }
      const h = { avoid: (x, z) => Math.abs(x) > HW - 0.9 || (S.wind && !gapAt(S, x, z) && (() => { const c = carAt(S, x, z); return c && z > c.z1 - 1.2 && c === live(S)[live(S).length - 1]; })()) };
      if (S.wind && !p.cls.melee) { const c = myCar(S); if (c) { h.x = clamp(p.pos.x, -3, 3); h.z = clamp(p.pos.z, c.z0 + c.off + 2, c.z1 + c.off - 4.5); } }
      if (S.wind) { const c = myCar(S); if (c && p.pos.z > c.z1 + c.off - 3.4) { p.casting = null; Bot.timer = 0; h.x = clamp(p.pos.x, -3, 3); h.z = c.z1 + c.off - 7; } }
      return h;
    },
  });
})();
