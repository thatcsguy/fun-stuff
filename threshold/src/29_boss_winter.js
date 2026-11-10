// DOOR X: THE HUNTSMAN, the Long Night. A frozen lake in deep snow. You leave footprints; things follow them.
(() => {
  const R = 20, COLD = 0x9fe8ff, SCENT = 0xff5040, SPEED = 7, STEP = 0.9;
  const POND = [[45, 11.2, 4.4], [135, 11.2, 4.0], [225, 11.2, 4.4], [315, 11.2, 4.0], [0, 0, 3.2]];
  const _m = new THREE.Object3D(), _c = new THREE.Color(), _v = new V3(), _w = new V3();
  const iceAt = (S, x, z) => { for (const q of S.ponds) if (Math.hypot(x - q.x, z - q.z) < q.r) return q; return null; };

  function antler(parent, mat, sx) {
    const root = new THREE.Group(); root.position.set(sx * 0.32, 0.5, -0.1); root.rotation.z = -sx * 0.55; root.rotation.x = -0.2; parent.add(root);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 2.2, 6), mat); beam.position.y = 1.1; root.add(beam);
    for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 0.9 - i * 0.1, 5), mat); t.position.set(sx * 0.02, 0.55 + i * 0.5, 0.3); t.rotation.x = 0.9; t.rotation.z = sx * 0.25 * (i - 1); root.add(t); }
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 0.8, 5), mat); crown.position.set(-sx * 0.2, 2.3, -0.1); crown.rotation.z = sx * 0.7; root.add(crown);
    return root;
  }
  function beast(stag) {
    const g = new THREE.Group(), legs = [];
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLD).multiplyScalar(stag ? 1.5 : 0.95), transparent: true, opacity: stag ? 0.6 : 0.78, depthWrite: false, blending: THREE.AdditiveBlending });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.0, 4, 10), m); body.rotation.x = PI / 2; body.position.y = 0.85; g.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), m); chest.position.set(0, 0.92, 0.45); g.add(chest);
    const neck = new THREE.Group(); neck.position.set(0, 1.05, 0.75); g.add(neck);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 8), m); head.rotation.x = PI / 2; head.position.set(0, 0.12, 0.3); neck.add(head);
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 5), m); ear.position.set(sx * 0.14, 0.34, 0.02); neck.add(ear); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), W.glow(SCENT, 5)); eye.position.set(sx * 0.11, 0.2, 0.3); neck.add(eye); }
    for (const [x, z] of [[-0.2, 0.5], [0.2, 0.5], [-0.2, -0.5], [0.2, -0.5]]) { const hip = new THREE.Group(); hip.position.set(x, 0.75, z); g.add(hip); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.78, 6), m); leg.position.y = -0.38; hip.add(leg); legs.push(hip); }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.8, 6), m); tail.rotation.x = -PI / 2 - 0.5; tail.position.set(0, 0.95, -0.95); g.add(tail);
    if (stag) { for (const sx of [-1, 1]) antler(neck, m, sx).scale.setScalar(0.55); g.scale.setScalar(1.7); }
    return { g, legs, neck, mat: m };
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x02050e, horizon: 0x16283c, bottom: 0x05080c, stars: 1.5, sunDir: [-0.35, 0.5, -0.8], sunColor: 0xeaf4ff, sunSize: 0.06, sunGlow: 0.8, clouds: 0.18, cloudColor: 0x44586c, cloudDark: 0x05080e, cloudSpeed: 0.006, aurora: 1.1, auroraColor: 0x40ffb0 });
    g.add(sky); S.sky = sky; W.env(sky, 0.9);
    scene.fog = new THREE.FogExp2(0x0c1826, 0.011); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x6c8cc0, 0x2a3040, 1.0);
    S.sun = W.sun(g, { dir: [-0.4, 0.75, -0.5], color: 0xbcd4ff, intensity: 3.0, size: 30 });
    // snow
    const sn = W.surface('rock', { seed: 31, dark: 0xb8c6dc, light: 0xffffff, strength: 1.1 }); for (const k in sn) sn[k].repeat.set(14, 14);
    const snowM = new THREE.MeshStandardMaterial({ map: sn.map, normalMap: sn.normalMap, roughness: 0.92, color: 0xdfe8f6 }); snowM.normalScale.set(0.5, 0.5);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(140, 64), snowM); ground.rotation.x = -PI / 2; ground.receiveShadow = true; g.add(ground);
    const bank = new THREE.Mesh(new THREE.TorusGeometry(R + 2.4, 2.4, 10, 64), snowM); bank.rotation.x = PI / 2; bank.scale.z = 0.5; bank.position.y = -0.2; g.add(bank);
    // ice
    const iceM = new THREE.MeshStandardMaterial({ color: 0x0c2c48, roughness: 0.06, metalness: 0.75, envMapIntensity: 2.6, emissive: 0x0a3050, emissiveIntensity: 0.5 });
    const rimM = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLD).multiplyScalar(0.55), transparent: true, opacity: 0.6 });
    S.ponds = POND.map(([a, d, r]) => {
      const x = Math.sin(a * PI / 180) * d, z = Math.cos(a * PI / 180) * d;
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), iceM); m.rotation.x = -PI / 2; m.position.set(x, 0.035, z); m.receiveShadow = true; g.add(m);
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.03, 48), rimM); rim.rotation.x = -PI / 2; rim.position.set(x, 0.045, z); g.add(rim);
      return { x, z, r, r0: r, rT: r, m, rim };
    });
    // forest
    const vr = mulberry(77), NT = 150, pineM = W.mat({ color: 0x0e2420, roughness: 0.95 }), capM = W.mat({ color: 0xe8f0fa, roughness: 0.9 }), barkM = W.mat({ color: 0x1a1410, roughness: 1 });
    const tiers = [0, 1, 2].map((k) => new THREE.InstancedMesh(new THREE.ConeGeometry(2.4 - k * 0.6, 4.2, 7), pineM, NT)), caps = [0, 1, 2].map((k) => new THREE.InstancedMesh(new THREE.ConeGeometry(1.5 - k * 0.38, 1.9, 7), capM, NT)), trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 4, 6), barkM, NT);
    for (let i = 0; i < NT; i++) {
      const a = vr() * TAU, d = R + 5 + Math.pow(vr(), 1.5) * 60, sc = 0.8 + vr() * 1.3 + (d - R) * 0.012, x = Math.sin(a) * d, z = Math.cos(a) * d;
      _m.rotation.set(0, vr() * 3, 0); _m.scale.setScalar(sc); _m.position.set(x, 2 * sc, z); _m.updateMatrix(); trunks.setMatrixAt(i, _m.matrix);
      for (let k = 0; k < 3; k++) { _m.position.set(x, (4.4 + k * 2.3) * sc, z); _m.updateMatrix(); tiers[k].setMatrixAt(i, _m.matrix); _m.position.set(x, (5.75 + k * 2.3) * sc, z); _m.updateMatrix(); caps[k].setMatrixAt(i, _m.matrix); }
    }
    for (const t of [...tiers, ...caps, trunks]) { t.castShadow = false; g.add(t); }
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.3, d = 150 + vr() * 60, h = 50 + vr() * 60; const mt = new THREE.Mesh(new THREE.ConeGeometry(50 + vr() * 30, h, 6), W.mat({ color: 0x1c2a3c, roughness: 1 })); mt.position.set(Math.sin(a) * d, h / 2 - 4, Math.cos(a) * d); g.add(mt); const cp = new THREE.Mesh(new THREE.ConeGeometry(20, h * 0.36, 6), capM); cp.position.set(mt.position.x, h * 0.82 - 4, mt.position.z); g.add(cp); }
    // cairns with cold fire around the rim
    S.fireM = W.glow(COLD, 3);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + PI / 6, x = Math.sin(a) * (R + 1.6), z = Math.cos(a) * (R + 1.6); const st = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), W.mat({ color: 0x2a3038, roughness: 0.9 })); st.position.set(x, 1.0, z); st.scale.set(0.8, 2.2, 0.8); st.rotation.y = i; st.castShadow = true; g.add(st); const sk = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), S.fireM); sk.position.set(x, 3.7, z); g.add(sk); if (i % 2 === 0) { const L = new THREE.PointLight(COLD, 30, 22, 1.7); L.position.set(x, 4, z); g.add(L); } }
    S.snow = W.motes({ n: 1100, box: [64, 26, 64], color: 0xffffff, size: 0.34, vel: [0.5, -2.4, 0.2], sway: 0.6, center: [0, 13, 0], alpha: 0.8 }); g.add(S.snow);
    // footprints + rime spikes
    const NP = 180; S.NP = NP;
    S.printI = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), NP); S.printI.frustumCulled = false; S.printI.count = 0; g.add(S.printI);
    S.spikeI = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 2.6, 5), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.1, metalness: 0.3, emissive: COLD, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }), 96); S.spikeI.frustumCulled = false; S.spikeI.count = 0; g.add(S.spikeI);
    S.spikes = [];
    S.stags = [0, 1, 2, 3].map(() => { const s = beast(true); s.g.visible = false; g.add(s.g); return { m: s, t: -1 }; });

    // ---- the Huntsman ----
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    const fur = W.mat({ color: 0x1a1c22, roughness: 1 }), bone = W.mat({ color: 0xd8d2c0, roughness: 0.6 }), hide = W.mat({ color: 0x2c2620, roughness: 0.9 });
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.6, 12, 1, true), fur); cloak.position.y = 2.3; cloak.castShadow = true; cloak.material.side = THREE.DoubleSide; S.rig.add(cloak);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.3, 4, 10), hide); torso.position.y = 4.1; torso.castShadow = true; S.rig.add(torso);
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(1.25, 12, 8, 0, TAU, 0, PI / 2), fur); mantle.position.y = 4.55; mantle.scale.y = 0.75; mantle.castShadow = true; S.rig.add(mantle);
    S.head = new THREE.Group(); S.head.position.set(0, 5.5, 0.15); S.rig.add(S.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), bone); skull.scale.set(0.9, 1, 1.1); S.head.add(skull);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.0, 8), bone); snout.rotation.x = PI / 2 + 0.35; snout.position.set(0, -0.22, 0.55); S.head.add(snout);
    S.eyeM = W.glow(COLD, 6); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), S.eyeM); e.position.set(sx * 0.2, 0.03, 0.36); S.head.add(e); antler(S.head, bone, sx); }
    S.armR = new THREE.Group(); S.armR.position.set(1.05, 4.7, 0); S.rig.add(S.armR);
    const ua = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.5, 3, 8), hide); ua.position.y = -0.9; S.armR.add(ua);
    S.spear = new THREE.Group(); S.spear.position.set(0, -1.8, 0.2); S.spear.rotation.x = PI / 2 - 0.25; S.armR.add(S.spear);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6.4, 6), barkM); S.spear.add(shaft);
    S.tipM = W.glow(COLD, 2.5); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.2, 4), S.tipM); tip.position.y = 3.7; S.spear.add(tip);
    S.armL = new THREE.Group(); S.armL.position.set(-1.05, 4.7, 0); S.rig.add(S.armL);
    const la = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.5, 3, 8), hide); la.position.y = -0.9; S.armL.add(la);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.3, 8, 1, true), bone); horn.position.set(0, -1.9, 0.35); horn.rotation.x = -PI / 2 - 0.5; S.armL.add(horn);
    S.light = new THREE.PointLight(COLD, 60, 26, 1.6); S.light.position.set(0, 5, 1.5); bg.add(S.light);
    Object.assign(S, { trail: [], nid: 1, lastX: 1e9, lastZ: 0, foot: 1, brk: false, vx: 0, vz: 0, ice: false, hounds: [], stalk: false, blizz: 0, blizzK: 0, windA: 0, windT: 0, life: 14, hSpeed: 8.6, rage: 0, raise: 0, hornUp: 0, lvl: 0, botIce: false });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 14.5 }, bossStart: { x: 0, z: -9, face: 0 }, camDist: 15,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > 26) { x *= 26 / d; z *= 26 / d; } return { x, y: Math.max(y, d > R ? 0.6 + (d - R) * 0.5 : 0.4), z }; },
    };
  }

  // ---- the pack ----
  function loose(b, n) {
    const S = b.state, p = G.player;
    for (let k = 0; k < n; k++) {
      const first = S.trail[0], a0 = first ? Math.atan2(first.x, first.z) : Math.atan2(-p.pos.x, -p.pos.z), a = a0 + (k - (n - 1) / 2) * 0.5, hm = beast(false);
      const e = b.spawnAdd({
        name: 'Hound', hp: 280, x: Math.sin(a) * (R - 1), z: Math.cos(a) * (R - 1), radius: 0.7, aimY: 0.9, mesh: hm.g, color: COLD,
        update(e, dt) {
          const pl = G.player; if (!pl.alive || G.state !== 'fight') return;
          e.run = (e.run || 0) + dt * (e.moving ? 16 : 3); hm.legs.forEach((h, i) => { h.rotation.x = e.moving ? Math.sin(e.run + (i % 2 ? PI : 0) + (i > 1 ? 1 : 0)) * 0.9 : 0; }); hm.neck.rotation.x = e.moving ? 0.5 : -0.5 + Math.sin(e.run) * 0.25; e.moving = false;
          if (b.transitioning) return;
          if (e.pause > 0) { e.pause -= dt; return; }
          const dp = Math.hypot(pl.pos.x - e.pos.x, pl.pos.z - e.pos.z);
          if (dp < 1.9) { e.pause = 1.5; e.facing = angTo(e.pos.x, e.pos.z, pl.pos.x, pl.pos.z); Sound.sfx('roar', 0.5, 2.2); Hz.circle(e.pos.x + Math.sin(e.facing) * 0.9, e.pos.z + Math.cos(e.facing) * 0.9, 2.2, 0.6, 230, { name: 'Bite', color: SCENT, quiet: true, tag: 'fight' }); return; }
          let nx = null; for (const q of S.trail) if (q.id > e.last) { nx = q; break; }
          if (nx && nx.gap && !e.fresh && Math.hypot(nx.x - e.pos.x, nx.z - e.pos.z) > 6.5) nx = null;
          if (nx) {
            const dx = nx.x - e.pos.x, dz = nx.z - e.pos.z, d = Math.hypot(dx, dz) || 1, s = S.hSpeed * (S.rage > 0 ? 1.25 : 1) * dt; e.lost = 0; e.moving = true;
            if (d <= s + 0.3) { e.last = nx.id; e.fresh = false; }
            e.pos.x += dx / d * Math.min(d, s); e.pos.z += dz / d * Math.min(d, s); e.facing = dampAng(e.facing, Math.atan2(dx, dz), 14, dt);
          } else {
            // the scent ends here
            e.lost = (e.lost || 0) + dt; e.facing += Math.sin(e.lost * 3) * dt * 3;
            hm.mat.opacity = 0.78 * clamp(1 - (e.lost - 2.5) / 2, 0.15, 1);
            if (e.lost > 4.5) e.die();
          }
        },
        onDeath(e) { const i = S.hounds.indexOf(e); if (i >= 0) S.hounds.splice(i, 1); },
      });
      e.last = first ? first.id - 1 : 0; e.fresh = true; e.pause = 0.9 + k * 0.5; e.mat = hm.mat; S.hounds.push(e);
      if (!G.headless) FX.burst(e.pos.x, 1, e.pos.z, { n: 20, color: COLD, speed: [1, 5], life: [0.4, 0.9], size: [0.2, 0.5] });
    }
  }
  function* hounds(b, n) {
    const S = b.state; S.hornUp = 1;
    yield* b.cast({ name: 'Loose the Hounds', time: 1.5 }); Sound.sfx('roar', 0.8, 1.6); S.hornUp = 0; loose(b, n); yield 0.8;
  }
  function* howl(b) {
    const S = b.state; S.hornUp = 1;
    const r = yield* b.cast({ name: 'The Long Howl', time: 2.8, interruptible: true }); S.hornUp = 0;
    if (r === 'done') { Sound.sfx('roar', 1, 0.7); FX.flash(SCENT, 0.25, 0.8); S.rage = 12; loose(b, 2); }
    yield 0.8;
  }
  // ---- the Huntsman's own hands ----
  function* javelin(b, n) {
    const S = b.state, p = G.player;
    for (let i = 0; i < n; i++) {
      S.raise = 1; yield* b.cast({ name: 'Javelin', time: 0.55 });
      const x = p.pos.x + (i ? S.vx * 0.5 : 0), z = p.pos.z + (i ? S.vz * 0.5 : 0); S.raise = 0;
      if (!G.headless) FX.missile(new V3(b.pos.x, 6, b.pos.z), new V3(x, 0.2, z), { speed: 30, arc: 5, color: COLD, size: 0.35 }); Sound.sfx('dash', 0.8, 0.6);
      Hz.circle(x, z, 3.0, 1.2, 300, { name: 'Javelin', onFire() { FX.explode(x, 0.4, z, COLD, 3, 0xffffff); Sound.sfx('shatter', 0.8); FX.shake(0.4); } });
      yield 0.5;
    }
    yield 0.9;
  }
  function* sweep(b) {
    const S = b.state, dir = b.angToPlayer(); b.autoFace = false; S.stalk = false; S.raise = 0.6;
    Hz.cone(b.pos.x, b.pos.z, dir, 2.5, 8, 1.15, 330, { name: 'Reaping Sweep', onFire() { FX.shake(0.5); Sound.sfx('sword', 1, 0.6); } });
    yield* b.cast({ name: 'Reaping Sweep', time: 1.15 }); S.raise = 0; S.swing = 1; yield 0.6; b.autoFace = true; S.stalk = true;
  }
  function* hoarfrost(b) {
    const S = b.state; S.raise = 1;
    yield* b.cast({ name: 'Hoarfrost', time: 1.7 }); S.raise = 0; Sound.sfx('shatter', 1, 0.5); FX.flash(COLD, 0.2, 0.6);
    const now = G.now, pr = S.trail.filter((q) => now - q.t < 9).slice(-52);
    for (let k = pr.length % 2 ? 0 : 1, j = 0; k < pr.length; k += 2, j++) {
      const q = pr[k];
      Hz.circle(q.x, q.z, 1.45, 0.95 + j * 0.05, 250, { name: 'Hoarfrost', color: COLD, quiet: true, onFire() {
        S.spikes.push({ x: q.x, z: q.z, t: 0, life: 6.2, rot: q.id }); if (j % 3 === 0) Sound.sfx('shatter', 0.35, 1.4 + j * 0.02);
        Hz.zone({ type: 'circle', x: q.x, z: q.z, r: 1.05 }, 6, 70, { name: 'Rime', color: COLD, delay: 0.25 });
      } });
    }
    yield 1.6;
  }
  function* icebreaker(b) {
    const S = b.state; S.raise = 1; S.stalk = false;
    for (const q of S.ponds) Hz.circle(q.x, q.z, q.r, 2.1, 310, { name: 'Icebreaker', color: 0x60c0ff, quiet: true });
    yield* b.cast({ name: 'Icebreaker', time: 2.1 }); S.raise = 0; S.swing = 1; Sound.sfx('bigboom', 0.9); Sound.sfx('shatter', 1, 0.4); FX.shake(0.9);
    if (!G.headless) for (const q of S.ponds) { FX.ring(q.x, q.z, { r0: 0.5, r1: q.r, color: COLD, dur: 0.5 }); FX.burst(q.x, 0.3, q.z, { n: 40, color: 0xdff4ff, color2: COLD, speed: [3, 12], life: [0.4, 1.0], size: [0.15, 0.5], radius: q.r * 0.7 }); }
    yield 0.8; S.stalk = true;
  }
  function* charge(b) {
    const S = b.state; S.stalk = false; b.autoFace = false; yield* b.turnTo(b.angToPlayer(), 0.35);
    const dir = b.facing, sx = Math.sin(dir), cz = Math.cos(dir);
    // run until the far bank
    const bq = b.pos.x * sx + b.pos.z * cz, len = Math.max(8, -bq + Math.sqrt(Math.max(0, bq * bq - (b.pos.x * b.pos.x + b.pos.z * b.pos.z) + (R - 2.5) * (R - 2.5))));
    Hz.rect(b.pos.x, b.pos.z, dir, len + 2, 4.4, 1.35, 360, { name: 'Wild Charge', kb: { dir: dir + PI / 2, dist: 3 } });
    S.raise = 0.5; yield* b.cast({ name: 'Wild Charge', time: 1.35 }); S.raise = 0; Sound.sfx('dash', 1, 0.4); FX.shake(0.5);
    yield* b.moveTo(b.pos.x + sx * len, b.pos.z + cz * len, 46, { face: false });
    yield 0.7; b.autoFace = true; S.stalk = true;
  }
  function* stampede(b, waves = 2) {
    const S = b.state, a = rnd(0, TAU), sx = Math.sin(a), cz = Math.cos(a), W2 = 5.6, off = rnd(-1.5, 1.5); S.hornUp = 1;
    yield* b.cast({ name: 'The Wild Hunt', time: 1.0 }); S.hornUp = 0; Sound.sfx('roar', 0.7, 1.2);
    for (let w = 0; w < waves; w++) {
      let si = 0;
      for (let l = -4; l <= 4; l++) { if ((l + w) & 1) continue; const lx = cz * (l * W2 + off), lz = -sx * (l * W2 + off), x0 = lx - sx * (R + 4), z0 = lz - cz * (R + 4), st = S.stags[si++ % S.stags.length];
        Hz.rect(x0, z0, a, 2 * R + 8, W2 - 0.2, 1.7, 300, { name: 'The Wild Hunt', color: COLD, quiet: true, onFire() { Sound.sfx('wave', 0.5, 1.4); if (Math.abs(l) < 3) { st.t = 0; st.x = x0; st.z = z0; st.a = a; } } }); }
      yield 1.75;
    }
    yield 0.6;
  }
  function setLvl(b, n) {
    const S = b.state, U = S.sky.material.uniforms; S.lvl = n; S.raise = 0; S.hornUp = 0; S.swing = 0; b.autoFace = true; S.stalk = true;
    S.ponds.forEach((q, i) => { q.rT = q.r0 * (n >= 1 ? (i === 4 ? 1.5 : 1.25) : 1); });
    S.blizz = n >= 2 ? 1 : 0; S.life = n >= 2 ? 9 : 14; S.hSpeed = n >= 2 ? 9.3 : n ? 8.9 : 8.6;
    U.uAurCol.value.set(n >= 2 ? 0xff4060 : n ? 0x9a70ff : 0x40ffb0); U.uAurora.value = n >= 2 ? 1.5 : 1.1;
  }

  G.bosses.push({
    id: 'winter', name: 'THE HUNTSMAN', title: 'The Long Night', hint: 'A pursuit', color: '#bfeaff', telegraph: 0x7fd8ff,
    hp: 27500, radius: 1.5, aimY: 3.4, enrage: 450,
    post: { bloom: 0.5, threshold: 0.86, radius: 0.7, exposure: 1.08, vig: 1.05, sat: 0.95, contrast: 1.07, tint: [0.92, 1.0, 1.12] },
    music: { bpm: 104, root: 38, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3, 0, 0, 6, 4],
      layers: [
        { v: 'pad', pat: '0...............', len: 16, vol: 0.1 }, { v: 'bell', pat: ['0.....4...2.....', '7.....4...3.....'], oct: 2, len: 4, vol: 0.06 }, { v: 'taiko', pat: 'x.......x.....x.', vol: 0.24 },
        { v: 'bass', from: 1, pat: '0..0..0.0..0..3.', oct: -1, len: 1, vol: 0.12 }, { v: 'tom', from: 1, pat: '..x...x...x..xx.', vol: 0.16 }, { v: 'flute', from: 1, pat: ['0...2.3...5.3.2.', '7...5.3...2.3.0.'], oct: 1, len: 3, vol: 0.07 },
        { v: 'brass', from: 2, pat: ['0.......4.......', '5.......3...4...'], oct: 0, len: 7, vol: 0.12 }, { v: 'taiko', from: 2, pat: 'x.xx..x.x.xx..xx', vol: 0.22 }, { v: 'choir', from: 2, pat: '0.......2.......', oct: 1, len: 8, vol: 0.07 },
      ] },
    build,
    *intro(b) { Sound.sfx('roar', 0.6, 0.5); yield* Cam.shot([9, 1.2, 8], [0, 4.5, -9], [3.5, 3.2, -1], [0, 4.6, -9], 5.0, 46); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setLvl(b, 0); yield 1.2;
        while (true) {
          yield* javelin(b, 1); yield* sweep(b); yield* hounds(b, 2); yield* javelin(b, 1); yield* hoarfrost(b);
          yield* sweep(b); yield* icebreaker(b); yield* hounds(b, 2); yield* javelin(b, 2); yield* hoarfrost(b); yield* sweep(b); yield 0.8;
        }
      } },
      { at: 0.67, *enter(b) {
        const S = b.state, U = S.sky.material.uniforms; S.stalk = false; S.hornUp = 1; b.autoFace = true;
        yield* b.cast({ name: 'Deep Cold', time: 3.0, onTick: (k) => { FX.shake(k * 0.3); } });
        S.hornUp = 0; Sound.sfx('shatter', 1, 0.3); Sound.sfx('bigboom', 0.7); FX.flash(COLD, 0.35, 1.2);
        S.ponds.forEach((q, i) => { q.rT = q.r0 * (i === 4 ? 1.5 : 1.25); }); U.uAurCol.value.set(0x9a70ff);
        Co.start(Post.lerpTo({ tint: [0.9, 0.96, 1.18], bloom: 0.56 }, 3), 'fight'); yield 1.6;
      }, *run(b) {
        const S = b.state; setLvl(b, 1);
        while (true) {
          yield* hounds(b, 3); yield* charge(b); yield* stampede(b, 2); yield* hoarfrost(b); yield* javelin(b, 2);
          yield* icebreaker(b); yield* sweep(b); yield* hounds(b, 2); yield* charge(b); yield* hoarfrost(b); yield* stampede(b, 3); yield* sweep(b);
        }
      } },
      { at: 0.34, *enter(b) {
        const S = b.state; S.stalk = false; S.hornUp = 1; b.autoFace = true;
        yield* b.cast({ name: 'Whiteout', time: 3.0, onTick: (k) => { S.blizz = k; } });
        S.hornUp = 0; Sound.sfx('roar', 1, 0.5); Sound.sfx('wave', 1, 0.5); FX.flash(0xffffff, 0.5, 1.4); S.sky.material.uniforms.uAurCol.value.set(0xff4060); S.sky.material.uniforms.uAurora.value = 1.5;
        Co.start(Post.lerpTo({ tint: [1.0, 0.97, 1.08], bloom: 0.6, sat: 0.85 }, 3), 'fight'); yield 1.4;
      }, *run(b) {
        const S = b.state; setLvl(b, 2);
        while (true) {
          yield* howl(b); yield* hounds(b, 3); yield* charge(b); yield* hoarfrost(b); yield* stampede(b, 3);
          yield* javelin(b, 3); yield* icebreaker(b); yield* sweep(b); yield* charge(b); yield* hounds(b, 2); yield* hoarfrost(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight' && p && p.alive;
      for (const q of S.ponds) { q.r = damp(q.r, q.rT, 1.2, dt); q.m.scale.setScalar(q.r); q.rim.scale.setScalar(q.r); }
      S.blizzK = damp(S.blizzK, S.blizz, 0.9, dt); if (S.rage > 0) S.rage -= dt;
      S.windT -= dt; if (S.windT <= 0) { S.windT = 9; S.windGoal = rnd(0, TAU); } S.windA = dampAng(S.windA, S.windGoal || 0, 0.7, dt);
      if (fight) {
        const ice = !!iceAt(S, p.pos.x, p.pos.z), ix = p.intentX || 0, iz = p.intentZ || 0, free = !p.dash && !p.kb;
        S.ice = ice;
        if (ice) {
          // no grip: you keep what speed you had
          if (free) { const k = p.moving ? 1.25 : 0.5; S.vx = damp(S.vx, ix * SPEED, k, dt); S.vz = damp(S.vz, iz * SPEED, k, dt); p.push.x += S.vx - ix * SPEED * p.speedMul; p.push.z += S.vz - iz * SPEED * p.speedMul; }
          else if (p.dash) { const d = Math.hypot(p.dash.vx, p.dash.vz) || 1; S.vx = p.dash.vx / d * 8; S.vz = p.dash.vz / d * 8; }
          S.brk = true;
          if (!G.headless && p.grounded && Math.hypot(S.vx, S.vz) > 3 && vrand() < dt * 30) FX.burst(p.pos.x, 0.1, p.pos.z, { n: 1, color: 0xdff4ff, speed: [0.5, 2], life: [0.2, 0.5], size: [0.08, 0.2] });
        } else { S.vx = ix * SPEED; S.vz = iz * SPEED; }
        if (S.blizzK > 0.05) { const wv = S.blizzK * (ice ? 2.4 : 1.3); if (p.grounded) { p.push.x += Math.sin(S.windA) * wv; p.push.z += Math.cos(S.windA) * wv; } }
        // footprints
        if (p.grounded && !ice) {
          const d = Math.hypot(p.pos.x - S.lastX, p.pos.z - S.lastZ);
          if (d > STEP) {
            const a = d < 50 ? Math.atan2(p.pos.x - S.lastX, p.pos.z - S.lastZ) : p.facing; S.foot = -S.foot;
            S.trail.push({ id: S.nid++, x: p.pos.x, z: p.pos.z, t, a, f: S.foot, gap: S.brk }); S.brk = false; S.lastX = p.pos.x; S.lastZ = p.pos.z; if (S.trail.length > S.NP) S.trail.shift();
          } else if (S.trail.length) S.trail[S.trail.length - 1].t = t;
        }
        // the Huntsman never runs. He does not need to.
        if (S.stalk && !b.castState && !b.transitioning) { const d = b.distToPlayer(); if (d > 4.6) { const a = b.angToPlayer(), s = (S.lvl >= 2 ? 3.0 : 2.3) * dt; b.pos.x += Math.sin(a) * s; b.pos.z += Math.cos(a) * s; const r = Math.hypot(b.pos.x, b.pos.z); if (r > R - 3) { b.pos.x *= (R - 3) / r; b.pos.z *= (R - 3) / r; } S.walk = (S.walk || 0) + dt * 5; } }
      }
      while (S.trail.length && t - S.trail[0].t > S.life) S.trail.shift();
      for (let i = S.spikes.length - 1; i >= 0; i--) { const s = S.spikes[i]; s.t += dt; if (s.t > s.life) S.spikes.splice(i, 1); }
      // ---- cosmetics ----
      if (G.headless) return;
      const I = S.printI; let n = 0; const lo = S.hounds.length ? Math.min(...S.hounds.map((h) => h.last)) : 1e9, hi = S.hounds.length ? Math.max(...S.hounds.map((h) => h.last)) + 7 : -1;
      for (const q of S.trail) {
        const age = (t - q.t) / S.life, k = 1 - smooth(clamp((age - 0.75) / 0.25, 0, 1));
        _m.position.set(q.x + Math.cos(q.a) * 0.17 * q.f, 0.025, q.z - Math.sin(q.a) * 0.17 * q.f); _m.rotation.set(-PI / 2, 0, q.a, 'YXZ'); _m.scale.set(0.15 * k + 0.01, 0.27 * k + 0.01, 1); _m.updateMatrix(); I.setMatrixAt(n, _m.matrix);
        const hot = q.id > lo && q.id <= hi; if (hot) _c.setHex(SCENT).multiplyScalar(1.6 + Math.sin(t * 10 + q.id) * 0.5); else _c.setHex(0x5a7096); I.setColorAt(n, _c); n++;
      }
      I.count = n; I.instanceMatrix.needsUpdate = true; if (I.instanceColor) I.instanceColor.needsUpdate = true;
      const K = S.spikeI; n = 0;
      for (const s of S.spikes) { if (n >= 94) break; const up = smooth(clamp(s.t / 0.18, 0, 1)) * (1 - smooth(clamp((s.t - s.life + 0.6) / 0.6, 0, 1))); for (let j = 0; j < 2; j++) { _m.position.set(s.x + (j ? Math.sin(s.rot) * 0.5 : 0), 1.3 * up * (j ? 0.6 : 1) - 0.05, s.z + (j ? Math.cos(s.rot) * 0.5 : 0)); _m.rotation.set(j ? 0.3 : 0.08 * Math.sin(s.rot), s.rot, j ? -0.25 : 0); _m.scale.set(j ? 0.7 : 1, Math.max(0.01, up) * (j ? 0.6 : 1), j ? 0.7 : 1); _m.updateMatrix(); K.setMatrixAt(n++, _m.matrix); } }
      K.count = n; K.instanceMatrix.needsUpdate = true;
      for (const st of S.stags) { if (st.t < 0) { st.m.g.visible = false; continue; } st.t += dt; const d = st.t * 66; if (d > 2 * R + 12) { st.t = -1; continue; } st.m.g.visible = true; st.m.g.position.set(st.x + Math.sin(st.a) * d, 0, st.z + Math.cos(st.a) * d); st.m.g.rotation.y = st.a; st.m.legs.forEach((h, i) => { h.rotation.x = Math.sin(t * 22 + (i % 2 ? PI : 0) + (i > 1 ? 1 : 0)) * 1.0; }); if (vrand() < dt * 60) FX.burst(st.m.g.position.x, 0.4, st.m.g.position.z, { n: 2, color: 0xffffff, color2: COLD, speed: [1, 4], life: [0.3, 0.7], size: [0.2, 0.5] }); }
      const SU = S.snow.material.uniforms, bz = S.blizzK; SU.uVel.value.set(0.5 + Math.sin(S.windA) * bz * 22, -2.4 - bz * 2, 0.2 + Math.cos(S.windA) * bz * 22); if (SU.uAlpha) SU.uAlpha.value = 0.8 + bz * 0.2;
      S.fog.density = 0.011 + bz * 0.016; S.fog.color.setHex(0x0c1826).lerp(_c.setHex(0x6a7c92), bz * 0.7);
      const cast = b.castState ? 1 : 0; S.raiseK = damp(S.raiseK || 0, S.raise, 7, dt); S.hornK = damp(S.hornK || 0, S.hornUp, 6, dt); S.swing = Math.max(0, (S.swing || 0) - dt * 2.5);
      S.rig.position.y = Math.abs(Math.sin(S.walk || 0)) * 0.08; S.rig.rotation.z = Math.sin(S.walk || 0) * 0.025; S.head.rotation.y = Math.sin(t * 0.6) * 0.15; S.head.rotation.x = -S.hornK * 0.5;
      S.armR.rotation.x = -S.raiseK * 2.3 + S.swing * 1.7; S.armR.rotation.z = S.raiseK * 0.3 - S.swing * 0.9; S.armL.rotation.x = -S.hornK * 2.4; S.armL.rotation.z = -S.hornK * 0.5;
      S.tipM.color.setHex(COLD).multiplyScalar(2.5 + cast * (2 + Math.sin(t * 14))); S.eyeM.color.setHex(S.rage > 0 || S.lvl >= 2 ? 0xff6050 : COLD).multiplyScalar(6); S.light.intensity = 60 + cast * 50;
      S.fireM.color.setHex(S.lvl >= 2 ? 0xff5060 : S.lvl ? 0xa080ff : COLD).multiplyScalar(2.6 + Math.sin(t * 7) * 0.6);
    },
    danger(b, x, z) { for (const h of b.state.hounds) if (h.alive && !(h.pause > 0) && Math.hypot(x - h.pos.x, z - h.pos.z) < 1.6) return 0.5; return Infinity; },
    bot(b, p) {
      const S = b.state; let best = null, bd = 6.5;
      for (const h of S.hounds) { if (!h.alive) continue; const d = Math.hypot(h.pos.x - p.pos.x, h.pos.z - p.pos.z); if (d < bd) { bd = d; best = h; } }
      return { target: best || b, avoid: (x, z) => !!iceAt(S, x, z) };
    },
  });
})();
