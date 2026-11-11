// DOOR XX: ATROX, the Pit. A sunlit arena, a war-beast on a chain. The chain is real: it wraps around posts, and where it ends, he ends.
(() => {
  const R = 22, PR = 0.85, FL = 12, FLV = 26, BLOOD = 0xff3020, TEL = 0xff7a30, DUST = 0xe8cf9a;
  const POSTS = [[45, 10], [135, 10], [225, 10], [315, 10], [90, 15.5], [270, 15.5]];
  const BANDS = [[3, 8.2], [8.2, 14.6], [14.6, R]];
  const _m = new THREE.Object3D(), _c = new THREE.Color(), _a = new V3(), _b = new V3(), _q = new THREE.Quaternion(), _z = new V3(0, 0, 1);
  const cross = (ax, az, bx, bz) => ax * bz - az * bx;
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz || 1e-6, k = clamp(((px - ax) * dx + (pz - az) * dz) / l, 0, 1); return Math.hypot(px - ax - dx * k, pz - az - dz * k); };

  // ---- the chain: it runs stake -> each wrapped post -> collar ----
  const lastA = (S) => S.wraps.length ? S.wraps[S.wraps.length - 1].q : S.stake;
  function fixedLen(S) { let L = 0, a = S.stake; for (const w of S.wraps) { L += Math.hypot(w.q.x - a.x, w.q.z - a.z); a = w.q; } return L; }
  const reach = (S) => Math.max(0.5, S.L - fixedLen(S));
  function chainStep(S, b) {
    S.taut = 0; if (S.loose) { S.px = b.pos.x; S.pz = b.pos.z; return; }
    for (let it = 0; it < 4; it++) {
      const A = lastA(S), bx = b.pos.x - A.x, bz = b.pos.z - A.z, ox = S.px - A.x, oz = S.pz - A.z, bl = Math.hypot(bx, bz);
      if (S.wraps.length) { // has he come back around the last post?
        const w = S.wraps[S.wraps.length - 1], P = S.wraps.length > 1 ? S.wraps[S.wraps.length - 2].q : S.stake;
        if (cross(w.q.x - P.x, w.q.z - P.z, b.pos.x - w.q.x, b.pos.z - w.q.z) * w.s < 0) { S.wraps.pop(); continue; }
      }
      let hit = null;
      for (const q of S.posts) {
        if (!q.alive || q === A) continue;
        const qx = q.x - A.x, qz = q.z - A.z, ql = Math.hypot(qx, qz); if (ql >= bl || qx * bx + qz * bz <= 0) continue;
        const s0 = cross(ox, oz, qx, qz), s1 = cross(bx, bz, qx, qz);
        if (s0 * s1 < 0 && (!hit || ql < hit.ql)) hit = { q, ql, s: s1 < 0 ? 1 : -1 };
      }
      if (!hit) break;
      S.wraps.push({ q: hit.q, s: hit.s }); if (!G.headless) { Sound.sfx('parry', 0.25, 0.4); FX.burst(hit.q.x, 1.3, hit.q.z, { n: 8, color: 0xffd9a0, speed: [1, 5], life: [0.2, 0.5], size: [0.1, 0.25] }); }
    }
    const A = lastA(S), r = reach(S), dx = b.pos.x - A.x, dz = b.pos.z - A.z, d = Math.hypot(dx, dz);
    if (d > r) { S.taut = d - r; b.pos.x = A.x + dx / d * r; b.pos.z = A.z + dz / d * r; }
    S.px = b.pos.x; S.pz = b.pos.z;
  }
  function dropPost(b, q) {
    const S = b.state; if (!q.alive) return; q.alive = false; q.mesh.visible = false; q.stub.visible = true;
    const i = S.wraps.findIndex((w) => w.q === q); if (i >= 0) S.wraps.length = i;
    FX.explode(q.x, 2, q.z, DUST, 4, 0x8a7a60); Sound.sfx('shatter', 0.9, 0.5); Sound.sfx('boom', 0.8); S.cheer = 1;
  }

  // ---- the beast ----
  function buildBeast() {
    const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
    const hide = W.mat({ color: 0x5c3d24, roughness: 0.85 }), dark = W.mat({ color: 0x22150c, roughness: 0.9 }), iron = W.mat({ color: 0x4a4e58, roughness: 0.42, metalness: 0.85 }), bone = W.mat({ color: 0xe6dcc0, roughness: 0.55 });
    const add = (geo, mat, x, y, z, par = rig) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; par.add(m); return m; };
    const body = add(new THREE.CapsuleGeometry(1.0, 2.4, 5, 12), hide, 0, 2.3, 0); body.rotation.x = PI / 2;
    add(new THREE.SphereGeometry(1.3, 14, 10), hide, 0, 2.55, 1.25); add(new THREE.SphereGeometry(1.05, 12, 9), hide, 0, 2.3, -1.4);
    for (let i = 0; i < 4; i++) { const pl = add(new THREE.BoxGeometry(1.5 - i * 0.12, 0.22, 0.85), iron, 0, 3.32 - i * 0.07, 0.9 - i * 0.82); pl.rotation.x = -0.1 + i * 0.06; const sp = add(new THREE.ConeGeometry(0.13, 0.6, 5), iron, 0, 3.7 - i * 0.07, 0.9 - i * 0.82); sp.rotation.x = -0.2; }
    const neck = new THREE.Group(); neck.position.set(0, 2.9, 2.1); rig.add(neck);
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, mn = add(new THREE.ConeGeometry(0.34, 1.5, 5), dark, Math.sin(a) * 0.85, Math.cos(a) * 0.85 - 0.1, -0.25, neck); mn.rotation.set(-PI / 2 + 0.5 * Math.cos(a), 0, -0.5 * Math.sin(a)); }
    const collar = add(new THREE.TorusGeometry(1.0, 0.16, 8, 20), iron, 0, -0.15, -0.55, neck); collar.rotation.x = 0.15;
    const skull = add(new THREE.SphereGeometry(0.78, 12, 10), hide, 0, 0.1, 0.45, neck); skull.scale.set(1, 0.92, 1.15);
    const helm = add(new THREE.SphereGeometry(0.84, 12, 8, 0, TAU, 0, PI * 0.5), iron, 0, 0.16, 0.45, neck); helm.scale.set(1.02, 0.95, 1.18);
    const snout = add(new THREE.CylinderGeometry(0.34, 0.5, 0.9, 8), hide, 0, -0.08, 1.25, neck); snout.rotation.x = PI / 2;
    const jaw = new THREE.Group(); jaw.position.set(0, -0.32, 0.75); neck.add(jaw);
    const jm = add(new THREE.BoxGeometry(0.62, 0.2, 0.95), dark, 0, -0.06, 0.42, jaw);
    for (const sx of [-1, 1]) {
      const fang = add(new THREE.ConeGeometry(0.08, 0.42, 5), bone, sx * 0.24, -0.5, 1.5, neck); fang.rotation.x = PI;
      const tusk = add(new THREE.ConeGeometry(0.07, 0.34, 5), bone, sx * 0.22, 0.2, 0.8, jaw);
      const h1 = add(new THREE.CylinderGeometry(0.14, 0.24, 1.2, 7), bone, sx * 0.85, 0.7, 0.25, neck); h1.rotation.z = -sx * 1.0;
      const h2 = add(new THREE.ConeGeometry(0.14, 1.3, 7), bone, sx * 1.5, 1.35, 0.5, neck); h2.rotation.set(0.5, 0, -sx * 0.25);
    }
    const eyeM = W.glow(0xffc040, 3), eyes = [];
    for (const sx of [-1, 1]) eyes.push(add(new THREE.SphereGeometry(0.11, 8, 6), eyeM, sx * 0.4, 0.2, 1.08, neck));
    const legs = [];
    for (const [x, z] of [[-0.8, 1.35], [0.8, 1.35], [-0.75, -1.45], [0.75, -1.45]]) {
      const hip = new THREE.Group(); hip.position.set(x, 2.1, z); rig.add(hip);
      add(new THREE.CapsuleGeometry(0.36, 0.9, 4, 8), hide, 0, -0.55, 0, hip); add(new THREE.CapsuleGeometry(0.26, 0.7, 4, 8), hide, 0, -1.45, 0.08, hip);
      const paw = add(new THREE.SphereGeometry(0.42, 8, 6), dark, 0, -1.95, 0.2, hip); paw.scale.set(1, 0.55, 1.3);
      const cuff = add(new THREE.TorusGeometry(0.3, 0.08, 6, 12), iron, 0, -1.2, 0.05, hip); cuff.rotation.x = PI / 2; legs.push(hip);
    }
    const tail = new THREE.Group(); tail.position.set(0, 2.5, -2.3); rig.add(tail);
    const tl = add(new THREE.CylinderGeometry(0.1, 0.18, 2.4, 6), hide, 0, 0.4, -1.0, tail); tl.rotation.x = -PI / 2 + 0.45; add(new THREE.SphereGeometry(0.3, 8, 6), dark, 0, 0.95, -2.1, tail);
    return { g, rig, neck, jaw, legs, tail, eyeM, body };
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x1c62c8, horizon: 0xbcdcf2, bottom: 0xd8c8a0, sunDir: [0.45, 0.72, -0.5], sunColor: 0xfff2d0, sunSize: 0.035, sunGlow: 1.3, clouds: 0.32, cloudColor: 0xffffff, cloudDark: 0x8ea4c0, cloudSpeed: 0.004, exp: 0.9 });
    g.add(sky); S.sky = sky; W.env(sky, 1.0);
    scene.fog = new THREE.FogExp2(0xd8c9a4, 0.006); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0xcfe0ff, 0xa89880, 1.25);
    S.sun = W.sun(g, { dir: [0.45, 0.8, -0.5], color: 0xfff0d0, intensity: 3.4, size: 34 });
    // sand
    const sd = W.surface('rock', { seed: 9, dark: 0xcdb991, light: 0xf3e9cf, strength: 0.7 }); for (const k in sd) sd[k].repeat.set(9, 9);
    const sandM = new THREE.MeshStandardMaterial({ map: sd.map, normalMap: sd.normalMap, roughness: 1, color: 0xf2e6cc }); sandM.normalScale.set(0.45, 0.45);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 0.8, 72), sandM); floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    for (let i = 0; i < 3; i++) { const rk = new THREE.Mesh(new THREE.RingGeometry(BANDS[i][0] - 0.06, BANDS[i][0] + 0.06, 72), new THREE.MeshBasicMaterial({ color: 0x6a5230, transparent: true, opacity: 0.35 })); rk.rotation.x = -PI / 2; rk.position.y = 0.012; g.add(rk); }
    // walls and tiers
    const st = W.surface('slabs', { seed: 4, dark: 0x8c7a5c, light: 0xd8c8a2, n: 6 }); for (const k in st) { st[k].repeat.set(16, 2); }
    const stoneM = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.9, color: 0xe2d4b4, side: THREE.DoubleSide });
    const prof = [[R + 0.6, 0], [R + 0.6, 6.5], [R + 3.2, 6.5], [R + 3.2, 8.6], [R + 5.8, 8.6], [R + 5.8, 10.7], [R + 8.4, 10.7], [R + 8.4, 12.8], [R + 11, 12.8], [R + 11, 21]].map(([x, y]) => new THREE.Vector2(x, y));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), stoneM); bowl.receiveShadow = true; g.add(bowl);
    const rimM = W.mat({ color: 0x9a3a2a, roughness: 0.8 }); const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.6, 0.28, 6, 72), rimM); rim.rotation.x = PI / 2; rim.position.y = 6.5; g.add(rim);
    // the crowd: two interleaved halves that bob out of step
    const vr = mulberry(41), cloth = [0xb8402c, 0xe8dcc0, 0x3a6aa8, 0xd8a030, 0x6a8a48, 0x8a4a8a, 0xf0f0e8, 0x5a3a28];
    S.crowd = [0, 1].map(() => { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 1.25, 0.5), new THREE.MeshStandardMaterial({ roughness: 1 }), 330); im.frustumCulled = false; g.add(im); return im; });
    const cn = [0, 0];
    for (let t = 0; t < 3; t++) { const rr = R + 1.9 + t * 2.6, n = Math.floor(rr * TAU / 0.82); for (let i = 0; i < n; i++) { const h = (i + t) & 1; if (cn[h] >= 330) continue; const a = i / n * TAU + vr() * 0.02; if (Math.abs(angDiff(a, PI)) < 0.2 && t === 0) continue; _m.position.set(Math.sin(a) * rr, 7.12 + t * 2.1 + vr() * 0.15, Math.cos(a) * rr); _m.rotation.set(0, a + PI, 0); _m.scale.set(0.85 + vr() * 0.3, 0.85 + vr() * 0.35, 1); _m.updateMatrix(); S.crowd[h].setMatrixAt(cn[h], _m.matrix); S.crowd[h].setColorAt(cn[h], _c.setHex(cloth[Math.floor(vr() * cloth.length)])); cn[h]++; } }
    S.crowd.forEach((im, h) => { im.count = cn[h]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; });
    // awnings, banners, the gate and the handler's box
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.13, aw = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 6.5), W.mat({ color: i % 2 ? 0xb03a26 : 0xeee0c0, roughness: 0.9, side: THREE.DoubleSide })); aw.position.set(Math.sin(a) * (R + 9), 19.5, Math.cos(a) * (R + 9)); aw.rotation.set(0.32, a, 0, 'YXZ'); aw.castShadow = true; g.add(aw); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 5), W.mat({ color: 0x4a3a28 })); pole.position.set(Math.sin(a) * (R + 11), 17, Math.cos(a) * (R + 11)); g.add(pole); }
    const gateM = W.mat({ color: 0x14100c, roughness: 1 }), ironM = W.mat({ color: 0x3c4048, roughness: 0.45, metalness: 0.85 });
    const gate = new THREE.Mesh(new THREE.BoxGeometry(6, 5.4, 0.6), gateM); gate.position.set(0, 2.7, -(R + 0.5)); g.add(gate);
    for (let i = -3; i <= 3; i++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5.4, 5), ironM); bar.position.set(i * 0.85, 2.7, -(R + 0.15)); g.add(bar); }
    const box = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 3), W.mat({ color: 0x7a2a20, roughness: 0.8 })); box.position.set(0, 7.0, -(R + 1.8)); g.add(box);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 4.5), W.mat({ color: 0x8a1c1c, roughness: 0.9 })); canopy.position.set(0, 11.2, -(R + 2)); canopy.rotation.x = -0.15; g.add(canopy);
    const hand = new THREE.Group(); hand.position.set(0, 7.6, -(R + 1.6)); g.add(hand); S.handler = hand;
    const hb = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.2, 4, 8), W.mat({ color: 0x5a1a1a, roughness: 0.8 })); hb.position.y = 1.0; hand.add(hb); const hh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), W.mat({ color: 0xc89a6a })); hh.position.y = 2.1; hand.add(hh);
    S.harm = new THREE.Group(); S.harm.position.set(0.5, 1.7, 0); hand.add(S.harm); const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), ironM); sp.position.y = 0.9; S.harm.add(sp);
    // torches for the last act (built now: light counts must never change mid-fight)
    S.torchM = W.glow(0xff8030, 0.0); S.torches = [];
    for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + PI / 4, x = Math.sin(a) * (R + 0.2), z = Math.cos(a) * (R + 0.2); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.6, 8), ironM); br.position.set(x, 6.9, z); g.add(br); const fl = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 7), S.torchM); fl.position.set(x, 7.8, z); g.add(fl); const L = new THREE.PointLight(0xff7a30, 0, 46, 1.6); L.position.set(x * 0.94, 8, z * 0.94); g.add(L); S.torches.push({ L, fl }); }
    S.dust = W.motes({ n: 320, box: [56, 14, 56], color: 0xf6e2b4, size: 0.2, vel: [0.35, 0.05, 0.15], sway: 0.5, center: [0, 7, 0], alpha: 0.4 }); g.add(S.dust);
    // stake, winch, posts
    S.stake = { x: 0, z: 0 };
    S.stakeG = new THREE.Group(); g.add(S.stakeG);
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 1.7, 10), ironM); sk.position.y = 0.85; sk.castShadow = true; S.stakeG.add(sk);
    S.drum = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.7, 14), W.mat({ color: 0x5a4630, roughness: 0.8 })); S.drum.position.y = 1.25; S.stakeG.add(S.drum);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.14, 6, 14), ironM); cap.rotation.x = PI / 2; cap.position.y = 1.72; S.stakeG.add(cap);
    S.hole = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), new THREE.MeshBasicMaterial({ color: 0x2a2014 })); S.hole.rotation.x = -PI / 2; S.hole.position.y = 0.02; S.hole.visible = false; g.add(S.hole);
    S.block = new THREE.Group(); S.block.visible = false; g.add(S.block);
    const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 1.7, 10), ironM); bk.rotation.x = PI / 2; bk.castShadow = true; S.block.add(bk); const bd = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.7, 14), W.mat({ color: 0x5a4630, roughness: 0.8 })); bd.rotation.x = PI / 2; S.block.add(bd);
    const pst = W.surface('stone', { seed: 12, dark: 0x8a7a60, light: 0xd4c6a4 }), postM = new THREE.MeshStandardMaterial({ map: pst.map, normalMap: pst.normalMap, roughness: 0.9, color: 0xe0d2b0 });
    S.posts = POSTS.map(([a, d], i) => {
      const x = Math.sin(a * PI / 180) * d, z = Math.cos(a * PI / 180) * d, m = new THREE.Group(); m.position.set(x, 0, z); g.add(m);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 4.4, 10), postM); col.position.y = 2.2; col.castShadow = col.receiveShadow = true; m.add(col);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.75, 0.5, 10), postM); top.position.y = 4.6; top.castShadow = true; m.add(top);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.1, 6, 14), ironM); band.rotation.x = PI / 2; band.position.y = 1.3; m.add(band);
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 0.5, 7), postM); stub.position.set(x, 0.22, z); stub.rotation.y = i; stub.visible = false; g.add(stub);
      return { x, z, alive: true, mesh: m, stub };
    });
    // reach line on the sand, chain links, shock rings, spike grates
    S.reachM = new THREE.MeshBasicMaterial({ color: 0x5a2a10, transparent: true, opacity: 0.4, depthWrite: false });
    S.reach = new THREE.Mesh(new THREE.RingGeometry(0.992, 1, 96), S.reachM); S.reach.rotation.x = -PI / 2; S.reach.position.y = 0.03; S.reach.renderOrder = 3; g.add(S.reach);
    S.links = new THREE.InstancedMesh(new THREE.TorusGeometry(0.2, 0.065, 5, 9), ironM, 170); S.links.frustumCulled = false; S.links.castShadow = true; S.links.count = 0; g.add(S.links);
    S.ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(DUST).multiplyScalar(1.5), transparent: true, opacity: 0.8, depthWrite: false });
    S.rings = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 72), S.ringM); m.rotation.x = PI / 2; m.visible = false; g.add(m); return { m, on: false, x: 0, z: 0, r: 0, v: 13, max: 30, dmg: 230, hit: false }; });
    const spikeM = W.mat({ color: 0x565a64, roughness: 0.35, metalness: 0.9 });
    S.spikes = BANDS.map(([r0, r1], k) => { const n = 34 + k * 30, im = new THREE.InstancedMesh(new THREE.ConeGeometry(0.2, 1.5, 5), spikeM, n), sr = mulberry(5 + k); for (let i = 0; i < n; i++) { const a = sr() * TAU, d = r0 + 0.5 + sr() * (r1 - r0 - 1); _m.position.set(Math.sin(a) * d, 0.75, Math.cos(a) * d); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); im.setMatrixAt(i, _m.matrix); } im.frustumCulled = false; im.position.y = -1.6; g.add(im); return { im, up: 0 }; });
    // ---- Atrox ----
    S.B = buildBeast(); b.group.add(S.B.g);
    S.eyeL = new THREE.PointLight(BLOOD, 0, 16, 1.8); S.eyeL.position.set(0, 3.2, 3); b.group.add(S.eyeL);
    Object.assign(S, { wraps: [], L: 24, Lgoal: 24, loose: false, px: 0, pz: -7, taut: 0, chase: false, speed: 6.2, down: 0, downK: 0, frenzy: 0, strain: 0, chant: 0, chantB: 0, out: 0, jav: 0, cheer: 0, cheerK: 0, crouch: 0, rear: 0, lunge: 0, hop: 0, runT: 0, moving: 0, lvl: 0, look: 0, lookT: 0, tip: { x: 0, z: 0 }, fl: { on: false, wind: 0, a: 0, dir: 1, t: 0, hitT: 0, jam: null } });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 17 }, bossStart: { x: 0, z: -7, face: 0 }, camDist: 16,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      solid(p) {
        for (const q of S.posts) { if (!q.alive) continue; const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz); if (d < PR + 0.45 && d > 1e-3) { p.x = q.x + dx / d * (PR + 0.45); p.z = q.z + dz / d * (PR + 0.45); } }
        if (!S.loose) { const d = Math.hypot(p.x, p.z); if (d < 1.5 && d > 1e-3) { p.x *= 1.5 / d; p.z *= 1.5 / d; } }
      },
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > R - 0.2) { x *= (R - 0.2) / d; z *= (R - 0.2) / d; } return { x, y: Math.max(y, 0.5), z }; },
    };
  }

  // ---- what he does ----
  function ring(b, v = 11.5, dmg = 230) { const S = b.state, g = S.rings.find((q) => !q.on) || S.rings[0]; Object.assign(g, { on: true, x: b.pos.x, z: b.pos.z, r: 0.2, v, max: 2 * R, dmg, hit: false }); }
  function* down(b, dur, mul) {
    const S = b.state; S.chase = false; b.autoFace = false; S.down = dur; b.exposed = dur; b.dmgTaken = mul; S.cheer = 1; S.crouch = S.rear = 0;
    Sound.sfx('interrupt', 0.8, 0.6); FX.burst(b.pos.x, 0.4, b.pos.z, { n: 40, smoke: true, color: DUST, color2: 0xa89068, speed: [1, 6], life: [0.6, 1.4], size: [0.8, 2.2], alpha: 0.5, radius: 2 }); FX.shake(0.6);
    yield () => S.down <= 0; b.dmgTaken = 1; yield 0.5;
  }
  function* melee(b) {
    const S = b.state; let t = 0; S.chase = true; b.autoFace = true;
    while (b.distToPlayer() > 6 && t < 2.4) { t += G.dt; yield; }
    if (b.distToPlayer() > 8) return false;
    S.chase = false; b.autoFace = false; const dir = b.angToPlayer(); yield* b.turnTo(dir, 0.14);
    if (rnd() < 0.55) { Hz.cone(b.pos.x, b.pos.z, dir, 1.25, 7, 0.62, 260, { name: 'Bite', quiet: true }); yield* b.cast({ name: 'Bite', time: 0.62 }); Sound.sfx('slash', 0.9, 0.5); }
    else { Hz.cone(b.pos.x, b.pos.z, dir, 2.7, 7.6, 0.85, 240, { name: 'Rake', quiet: true }); yield* b.cast({ name: 'Rake', time: 0.85 }); Sound.sfx('slash', 1, 0.7); FX.slash(b.pos.x + Math.sin(dir) * 2, 1.6, b.pos.z + Math.cos(dir) * 2, dir, { r: 6, color: 0xffe0b0, dur: 0.25 }); }
    S.lunge = 1; yield 0.5; b.autoFace = true; S.chase = true; return true;
  }
  function* pounce(b) {
    const S = b.state, p = G.player; S.chase = false; b.autoFace = true; S.crouch = 1;
    const h = Hz.circle(p.pos.x, p.pos.z, 3.7, 1.05, 320, { name: 'Pounce', lock: 0.72, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire() { FX.shake(0.7); Sound.sfx('boom', 0.9, 0.8); FX.burst(h.shape.x, 0.3, h.shape.z, { n: 40, smoke: true, color: DUST, color2: 0xa89068, speed: [2, 9], life: [0.5, 1.2], size: [0.8, 2], alpha: 0.5, radius: 2.5 }); } });
    yield* b.cast({ name: 'Pounce', time: 0.7 }); S.crouch = 0; b.autoFace = false;
    const sx = b.pos.x, sz = b.pos.z, ang = angTo(sx, sz, h.shape.x, h.shape.z), d = Math.max(0, Math.hypot(h.shape.x - sx, h.shape.z - sz) - 1.2), tx = sx + Math.sin(ang) * d, tz = sz + Math.cos(ang) * d;
    b.facing = ang; Sound.sfx('dash', 1, 0.45); let t = 0, choke = false;
    while (t < 0.33) { t += G.dt; const k = Math.min(1, t / 0.33); b.pos.x = lerp(sx, tx, k); b.pos.z = lerp(sz, tz, k); S.hop = Math.sin(k * PI) * 2.4; yield; if (S.taut > 0.35) { choke = true; break; } }
    S.hop = 0;
    if (choke) { Hz.cancel(h); Sound.sfx('parry', 0.8, 0.3); yield* down(b, 3, 1.15); } else yield 0.65;
    b.autoFace = true; S.chase = true;
  }
  function* roar(b, n = 1) {
    const S = b.state; S.chase = false; S.rear = 1; yield* b.cast({ name: 'Roar', time: 1.0 });
    for (let i = 0; i < n; i++) { ring(b); Sound.sfx('roar', 0.9, 0.8); FX.shake(0.5); FX.ring(b.pos.x, b.pos.z, { r0: 2, r1: 9, color: DUST, dur: 0.4 }); yield 0.75; }
    S.rear = 0; yield 0.4; S.chase = true;
  }
  function* hurl(b, n = 3) {
    const S = b.state, p = G.player; S.chase = false;
    for (let i = 0; i < n; i++) {
      S.crouch = 0.6; yield* b.cast({ name: 'Hurl', time: 0.5 }); S.crouch = 0; S.lunge = 0.6;
      const x = p.pos.x, z = p.pos.z; if (!G.headless) FX.missile(new V3(b.pos.x, 3.5, b.pos.z), new V3(x, 0.2, z), { speed: 26, arc: 7, color: 0xc8a878, size: 0.55 }); Sound.sfx('dash', 0.7, 0.5);
      Hz.circle(x, z, 3.1, 1.1, 260, { name: 'Rubble', onFire() { FX.explode(x, 0.4, z, DUST, 3, 0x8a7a60); Sound.sfx('boom', 0.6, 1.2); } });
      yield 0.3;
    }
    yield 0.7; S.chase = true;
  }
  function* frenzy(b) {
    const S = b.state; yield () => S.chant <= 0; S.chase = false; S.rear = 1; b.autoFace = true;
    yield* b.cast({ name: 'Bloodlust', time: 2.5 }); S.rear = 0; S.frenzy = 7; S.strain = 0; Sound.sfx('roar', 1, 0.6); FX.flash(BLOOD, 0.3, 1.2); FX.shake(0.6);
    S.chase = true; let bt = 0.3;
    while (S.frenzy > 0) {
      bt -= G.dt;
      if (bt <= 0 && b.distToPlayer() < 7.2) { const dir = b.angToPlayer(); b.facing = dir; Hz.cone(b.pos.x, b.pos.z, dir, 1.8, 7.4, 0.35, 280, { name: 'Frenzied Bite', quiet: true, silent: true }); S.lunge = 1; bt = 0.72; Sound.sfx('slash', 0.8, 0.55); }
      yield;
    }
    if (S.strain >= 3.2) { yield* down(b, 6, 1.5); const w = S.wraps[S.wraps.length - 1]; if (w) { S.rear = 1; yield* b.cast({ name: 'Tear Free', time: 1.1 }); S.rear = 0; const q = w.q; Hz.circle(q.x, q.z, 4.5, 0.01, 0, { quiet: true, silent: true }); dropPost(b, q); yield 0.5; } }
    else yield 0.8;
    b.autoFace = true; S.chase = true;
  }
  function* grates(b) {
    const S = b.state; S.chase = false; S.rear = 0.6; const first = rnd() < 0.5 ? [0, 2] : [1];
    const pop = (k, delay) => Hz.donut(0, 0, BANDS[k][0], BANDS[k][1], delay, 240, { name: 'Spike Grate', color: 0xc8ccd8, quiet: true, onFire() { S.spikes[k].up = 1; Sound.sfx('shatter', 0.5, 0.6); Sound.sfx('hit', 0.9, 0.5); } });
    for (const k of first) pop(k, 1.6); for (const k of [0, 1, 2]) if (!first.includes(k)) pop(k, 3.0);
    yield* b.cast({ name: 'Open the Grates', time: 1.6 }); S.rear = 0; S.chase = true; yield 1.5;
  }
  function* whip(b) {
    const S = b.state, A = lastA(S); S.chase = false; b.autoFace = false; S.rear = 0.8;
    const dir = angTo(A.x, A.z, b.pos.x, b.pos.z), len = Math.hypot(b.pos.x - A.x, b.pos.z - A.z) + 9;
    Hz.rect(A.x, A.z, dir, len, 3.4, 1.05, 300, { name: 'Whip-crack', onFire() { Sound.sfx('zap', 0.7, 0.5); FX.shake(0.5); if (!G.headless) FX.beam(new V3(A.x, 1.2, A.z), new V3(A.x + Math.sin(dir) * len, 1.2, A.z + Math.cos(dir) * len), { color: 0xfff0d0, width: 0.5, dur: 0.25 }); } });
    yield* b.cast({ name: 'Whip-crack', time: 1.05 }); S.rear = 0; S.whipK = 1; yield 0.6; b.autoFace = true; S.chase = true;
  }
  function* flail(b) {
    const S = b.state, F = S.fl; S.chase = false; b.autoFace = false; F.wind = 1; F.jam = null;
    Hz.circle(b.pos.x, b.pos.z, FL + 0.9, 1.9, 0, { name: 'Flail', quiet: true });
    yield* b.cast({ name: 'Flail', time: 1.9 });
    Object.assign(F, { on: true, wind: 0, a: angTo(b.pos.x, b.pos.z, S.tip.x, S.tip.z), dir: rnd() < 0.5 ? 1 : -1, t: 0, hitT: 0 }); Sound.sfx('roar', 0.7, 1.1);
    yield () => !F.on || F.t > 5.2; F.on = false;
    if (F.jam) { const q = F.jam; Sound.sfx('parry', 1, 0.3); yield* down(b, 5, 1.5); F.jam = null; dropPost(b, q); yield 0.4; } else yield 0.8;
    b.autoFace = true; S.chase = true;
  }
  function* slam(b) {
    const S = b.state; S.chase = false; b.autoFace = false; const dir = b.angToPlayer(); yield* b.turnTo(dir, 0.2); S.rear = 1;
    Hz.rect(b.pos.x, b.pos.z, dir, 19, 4.6, 1.05, 320, { name: 'Slam', onFire() { FX.shake(0.8); Sound.sfx('bigboom', 0.6); } });
    yield* b.cast({ name: 'Slam', time: 1.05 }); S.rear = 0; S.lunge = 1; ring(b, 11.5, 220); yield 0.8; b.autoFace = true; S.chase = true;
  }
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.lookT = n; S.Lgoal = n >= 1 ? 30 : 24; S.speed = n >= 2 ? 7.0 : n ? 6.5 : 6.2;
    Object.assign(S, { crouch: 0, rear: 0, hop: 0, frenzy: 0, chant: 0, down: 0, chase: true }); S.fl.on = false; S.fl.wind = 0; b.autoFace = true; b.dmgTaken = 1;
    if (n >= 2 && !S.loose) { S.loose = true; S.wraps.length = 0; S.stakeG.visible = false; S.hole.visible = true; S.block.visible = true; S.reach.visible = false; S.tip.x = 0; S.tip.z = 0; }
  }
  const chantFor = (b, t) => { b.state.chant = t; };

  G.bosses.push({
    id: 'pit', name: 'ATROX', title: 'The Pit', hint: 'Short leash', color: '#f0c070', telegraph: TEL,
    hp: 27000, radius: 2.0, aimY: 2.6, enrage: 450,
    post: { bloom: 0.34, threshold: 0.9, radius: 0.6, exposure: 1.0, vig: 0.85, sat: 1.08, contrast: 1.06, tint: [1.02, 1.0, 0.97] },
    music: { bpm: 108, root: 38, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 0, 1, 0, 0, 0, 4, 1],
      layers: [
        { v: 'taiko', pat: 'x...x...x...x.x.', vol: 0.26 }, { v: 'tom', pat: '..x...x...x...xx', vol: 0.14 }, { v: 'bass', pat: '0.......0.....1.', oct: -1, len: 2, vol: 0.12 },
        { v: 'brass', from: 1, pat: ['0.......4.......', '1.......0...4...'], oct: 0, len: 6, vol: 0.11 }, { v: 'clap', from: 1, pat: '....x.......x...', vol: 0.12 }, { v: 'hat', from: 1, pat: 'x.x.x.x.x.x.x.x.', vol: 0.05 },
        { v: 'choir', from: 2, pat: '0.......1.......', oct: 1, len: 8, vol: 0.08 }, { v: 'taiko', from: 2, pat: 'x.xx.xx.x.xx.xxx', vol: 0.22 }, { v: 'lead', from: 2, pat: ['0..1..4.5..4..1.', '7..5..4.1..0....'], oct: 1, len: 2, vol: 0.06 },
      ] },
    build,
    *intro(b) { const S = b.state; S.cheer = 1; Sound.sfx('roar', 0.7, 0.6); yield* Cam.shot([10, 2.0, 4], [0, 2.8, -7], [4.5, 3.4, 0.5], [0, 2.9, -7], 5.0, 44); },
    phases: [
      { at: 1, *run(b) {
        setLvl(b, 0); yield 1.0;
        while (true) {
          yield* melee(b); yield* melee(b); yield* pounce(b); yield* roar(b); yield* melee(b); yield* hurl(b);
          chantFor(b, 9); yield* melee(b); yield* pounce(b); yield* melee(b); yield* melee(b); yield* frenzy(b);
          yield* pounce(b); yield* melee(b); yield* roar(b, 2); yield* hurl(b);
        }
      } },
      { at: 0.66, skipTo(b) { b.state.look = 1; }, *enter(b) {
        const S = b.state; S.chase = false; S.rear = 1; S.frenzy = 0; S.chant = 0; S.fl.on = false; S.Lgoal = 30; S.cheer = 1; S.winch = 3;
        yield* b.cast({ name: 'More Chain', time: 3.0, onTick: (k) => { if (!G.headless && Math.floor(k * 14) !== S.wk) { S.wk = Math.floor(k * 14); Sound.sfx('tick', 1, 0.5); } } });
        S.rear = 0; Sound.sfx('roar', 0.9, 0.7); S.lookT = 1; Co.start(Post.lerpTo({ tint: [1.05, 0.99, 0.92], bloom: 0.38 }, 3), 'fight'); yield 0.8;
      }, *run(b) {
        setLvl(b, 1);
        while (true) {
          yield* melee(b); yield* grates(b); yield* pounce(b); yield* melee(b); yield* whip(b); yield* hurl(b);
          chantFor(b, 9); yield* melee(b); yield* roar(b, 2); yield* melee(b); yield* pounce(b); yield* frenzy(b);
          yield* whip(b); yield* grates(b); yield* melee(b); yield* pounce(b);
        }
      } },
      { at: 0.33, skipTo(b) { b.state.look = 2; }, *enter(b) {
        const S = b.state; S.chase = false; S.frenzy = 0; S.chant = 0; S.cheer = 0; S.hush = 3.4; b.autoFace = false;
        yield* b.moveTo(0, -3.2, 14); yield* b.turnTo(0, 0.2); S.rear = 1;
        yield* b.cast({ name: 'Unchained', time: 2.6, onTick: (k) => { FX.shake(k * 0.5); } });
        S.rear = 0; setLvl(b, 2); S.chase = false; FX.explode(0, 0.5, 0, DUST, 6, 0x6a5a40); Sound.sfx('bigboom', 0.9); Sound.sfx('roar', 1, 0.5); FX.flash(0xfff0d0, 0.4, 1.4); S.cheer = 1;
        Co.start(Post.lerpTo({ tint: [1.07, 0.96, 0.9], bloom: 0.42, contrast: 1.1 }, 3), 'fight'); yield 1.4;
      }, *run(b) {
        setLvl(b, 2);
        while (true) {
          yield* melee(b); yield* flail(b); yield* slam(b); yield* melee(b); yield* pounce(b); yield* roar(b, 2);
          yield* melee(b); yield* hurl(b, 4); yield* flail(b); yield* pounce(b); yield* slam(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, F = S.fl, fight = G.state === 'fight' && p && p.alive, B = S.B;
      S.L = damp(S.L, S.Lgoal, 1.2, dt); if (S.down > 0) S.down -= dt; if (S.frenzy > 0) S.frenzy -= dt;
      const moved0x = b.pos.x, moved0z = b.pos.z;
      if (fight && S.chase && !b.castState && !b.transitioning && S.down <= 0) {
        const d = b.distToPlayer(), stop = 3.4;
        if (d > stop) { const a = b.angToPlayer(), s = Math.min(d - stop, (S.frenzy > 0 ? 11 : S.speed) * dt); b.pos.x += Math.sin(a) * s; b.pos.z += Math.cos(a) * s; }
      }
      // he cannot walk through stone either
      for (const q of S.posts) { if (!q.alive) continue; const dx = b.pos.x - q.x, dz = b.pos.z - q.z, d = Math.hypot(dx, dz), m = PR + 1.5; if (d < m && d > 1e-3) { b.pos.x = q.x + dx / d * m; b.pos.z = q.z + dz / d * m; } }
      if (!S.loose) { const d = Math.hypot(b.pos.x, b.pos.z); if (d < 2.4 && d > 1e-3) { b.pos.x *= 2.4 / d; b.pos.z *= 2.4 / d; } }
      { const d = Math.hypot(b.pos.x, b.pos.z); if (d > R - 2.4) { b.pos.x *= (R - 2.4) / d; b.pos.z *= (R - 2.4) / d; } }
      chainStep(S, b);
      if (S.frenzy > 0 && fight && S.taut > 0.002) S.strain += dt;
      S.moving = damp(S.moving, Math.hypot(b.pos.x - moved0x, b.pos.z - moved0z) > 0.4 * dt || S.taut > 0.002 ? 1 : 0, 10, dt);
      // the crowd's count before the blood
      if (S.chant > 0 && fight) { S.chant -= dt; S.chantB -= dt; if (S.chantB <= 0) { S.chantB = lerp(0.32, 0.62, sat(S.chant / 9)); Sound.sfx('boom', 0.3 + (1 - sat(S.chant / 9)) * 0.4, 0.55); S.stomp = 1; } }
      // cowards get javelins
      if (fight && !S.loose && S.frenzy <= 0 && S.down <= 0 && !b.transitioning && !(b.castState && b.castState.name === 'Bloodlust')) {
        const A = lastA(S), far = Math.hypot(p.pos.x - A.x, p.pos.z - A.z) > reach(S) + 3.2;
        S.out = far ? S.out + dt : Math.max(0, S.out - dt * 2);
        if (S.out > 6) { S.jav -= dt; if (S.jav <= 0) { S.jav = 1.25; const a = rnd(0, TAU), x0 = p.pos.x - Math.sin(a) * 30, z0 = p.pos.z - Math.cos(a) * 30; Hz.rect(x0, z0, a, 60, 2.4, 1.0, 230, { name: 'Javelin', color: 0xffe9b0, tag: 'fight', quiet: true, onFire() { Sound.sfx('slash', 0.7, 1.4); } }); S.harmK = 1; Sound.sfx('wave', 0.25, 0.5); } }
      } else S.out = 0;
      // shock rings
      for (const g of S.rings) {
        if (!g.on) continue; g.r += g.v * dt; if (g.r > g.max) { g.on = false; g.m.visible = false; continue; }
        if (fight && !g.hit) { const d = Math.hypot(p.pos.x - g.x, p.pos.z - g.z); if (Math.abs(d - g.r) < 0.6) { if (p.pos.y < 0.45) { g.hit = true; p.hurt(g.dmg, { blockable: true, src: { name: 'Shockwave' } }); } } }
      }
      // the flail
      if (S.loose) {
        const cx = b.pos.x + Math.sin(b.facing) * 1.7, cz = b.pos.z + Math.cos(b.facing) * 1.7;
        if (F.on) {
          F.t += dt; const a0 = F.a; F.a += FLV / FL * F.dir * dt; S.tip.x = b.pos.x + Math.sin(F.a) * FL; S.tip.z = b.pos.z + Math.cos(F.a) * FL;
          for (const q of S.posts) { if (!q.alive) continue; const d = Math.hypot(q.x - b.pos.x, q.z - b.pos.z); if (d < 2.5 || d > FL - 0.4) continue; const aq = angTo(b.pos.x, b.pos.z, q.x, q.z), d0 = angDiff(a0, aq) * F.dir, d1 = angDiff(F.a, aq) * F.dir; if (d0 >= 0 && d1 < 0 && d0 < 1) { F.on = false; F.jam = q; S.tip.x = q.x + Math.sin(F.a + F.dir * 1.2) * 1.6; S.tip.z = q.z + Math.cos(F.a + F.dir * 1.2) * 1.6; break; } }
          F.hitT -= dt;
          if (F.on && fight && F.hitT <= 0 && p.pos.y < 1.7 && segDist(p.pos.x, p.pos.z, b.pos.x, b.pos.z, S.tip.x, S.tip.z) < 1.05) { F.hitT = 0.9; p.hurt(300, { blockable: true, kb: { dir: angTo(b.pos.x, b.pos.z, p.pos.x, p.pos.z), dist: 4 }, src: { name: 'Flail' } }); }
          if (!G.headless && vrand() < dt * 40) FX.burst(S.tip.x, 0.3, S.tip.z, { n: 2, smoke: true, color: DUST, color2: 0xa89068, speed: [0.5, 3], life: [0.4, 0.9], size: [0.6, 1.4], alpha: 0.4 });
        } else { const dx = S.tip.x - cx, dz = S.tip.z - cz, d = Math.hypot(dx, dz), m = F.wind ? 3 : FL - 1; if (d > m) { const k = F.wind ? damp(d, m, 3, dt) / d : m / d; S.tip.x = cx + dx * k; S.tip.z = cz + dz * k; } }
      }
      // ---- cosmetics ----
      if (G.headless) return;
      S.look = damp(S.look, S.lookT, 0.5, dt); const k1 = sat(S.look), k2 = sat(S.look - 1), U = S.sky.material.uniforms;
      U.uTop.value.setHex(0x1c62c8).lerp(_c.setHex(0x2a52a0), k1).lerp(_c.setHex(0x3a1420), k2); U.uHor.value.setHex(0xbcdcf2).lerp(_c.setHex(0xf6c078), k1).lerp(_c.setHex(0xe04a1c), k2); U.uBot.value.setHex(0xd8c8a0).lerp(_c.setHex(0xd09a58), k1).lerp(_c.setHex(0x5a1c10), k2);
      U.uSunCol.value.setHex(0xfff2d0).lerp(_c.setHex(0xffb060), k1).lerp(_c.setHex(0xff4a18), k2); U.uSunDir.value.set(0.45 + k1 * 0.3, 0.72 - k1 * 0.34 - k2 * 0.28, -0.5).normalize();
      S.sun.color.setHex(0xfff0d0).lerp(_c.setHex(0xffc890), k1).lerp(_c.setHex(0xff9a68), k2); S.sun.intensity = 3.4 - k1 * 0.5 - k2 * 1.2; S.sun.position.set(0.45 + k1 * 0.3, 0.8 - k1 * 0.3 - k2 * 0.22, -0.5).normalize().multiplyScalar(80);
      S.hemi.intensity = 1.25 - k1 * 0.25 - k2 * 0.5; S.hemi.color.setHex(0xcfe0ff).lerp(_c.setHex(0xe8d0c8), k1 * 0.5 + k2 * 0.3); S.fog.color.setHex(0xd8c9a4).lerp(_c.setHex(0xe0a868), k1).lerp(_c.setHex(0x7a2a18), k2); S.fog.density = 0.006 + k2 * 0.006;
      const tk = k2 * (0.85 + Math.sin(t * 13) * 0.1 + Math.sin(t * 7.3) * 0.08); S.torchM.color.setHex(0xff8030).multiplyScalar(tk * 4); for (const q of S.torches) { q.L.intensity = tk * 260; q.fl.scale.setScalar(0.01 + k2 * (1 + Math.sin(t * 17 + q.L.position.x) * 0.15)); }
      // crowd
      if (S.hush > 0) S.hush -= dt; S.cheer = Math.max(0, S.cheer - dt * 0.4); S.stomp = Math.max(0, (S.stomp || 0) - dt * 5);
      S.cheerK = damp(S.cheerK, S.hush > 0 ? 0 : 0.18 + S.cheer * 0.8 + (S.frenzy > 0 ? 0.5 : 0) + (S.out > 6 ? 0.3 : 0), 4, dt);
      S.crowd.forEach((im, h) => { im.position.y = Math.abs(Math.sin(t * (4 + S.cheerK * 5) + h * PI / 2)) * 0.5 * S.cheerK + (S.stomp || 0) * 0.25; });
      S.harmK = Math.max(0, (S.harmK || 0) - dt * 2); S.harm.rotation.x = -S.harmK * 1.6; S.handler.rotation.y = p ? angTo(0, -(R + 1.6), p.pos.x, p.pos.z) : 0;
      if (S.winch > 0) { S.winch -= dt; S.drum.rotation.y += dt * 6; }
      // reach line
      if (!S.loose) { const A = lastA(S), r = reach(S) + 2.6; S.reach.position.x = A.x; S.reach.position.z = A.z; S.reach.scale.setScalar(r); S.reachM.opacity = 0.28 + (S.chant > 0 || S.frenzy > 0 ? 0.3 + Math.sin(t * 9) * 0.12 : 0); S.reachM.color.setHex(S.frenzy > 0 || S.chant > 0 ? 0xc02010 : 0x5a2a10); }
      // spikes
      for (const q of S.spikes) { q.up = Math.max(0, q.up - dt * 1.1); q.im.position.y = -1.6 + smooth(sat(q.up * 3)) * 1.6; }
      // rings
      for (const g of S.rings) { if (!g.on) continue; g.m.visible = true; g.m.position.set(g.x, 0.22, g.z); g.m.scale.set(g.r, g.r, 6); }
      // beast pose
      S.downK = damp(S.downK, S.down > 0 ? 1 : 0, 7, dt); S.crouchK = damp(S.crouchK || 0, S.crouch, 10, dt); S.rearK = damp(S.rearK || 0, S.rear, 8, dt); S.lunge = Math.max(0, S.lunge - dt * 3.2); S.whipK = Math.max(0, (S.whipK || 0) - dt * 3);
      const fr = S.frenzy > 0 ? 1 : 0, run = S.moving * (1 - S.downK); S.runT += dt * (6 + run * (9 + fr * 6));
      B.rig.position.y = -S.crouchK * 0.55 + S.hop + Math.abs(Math.sin(S.runT)) * 0.14 * run - S.downK * 1.0; B.rig.rotation.x = -S.rearK * 0.42 + S.crouchK * 0.12 + S.lunge * 0.16; B.rig.rotation.z = S.downK * 1.25; B.rig.position.x = S.downK * 1.2;
      B.legs.forEach((h, i) => { h.rotation.x = Math.sin(S.runT + (i % 2 ? PI : 0) + (i > 1 ? 1.2 : 0)) * 0.75 * run + (i < 2 ? -S.rearK * 0.9 - S.lunge * 0.5 : S.rearK * 0.3) + S.downK * (i % 2 ? 0.5 : -0.3); });
      B.neck.rotation.x = -S.rearK * 0.5 + S.crouchK * 0.3 - S.lunge * 0.35 + Math.sin(t * 1.7) * 0.05 + S.downK * 0.4; B.neck.rotation.y = Math.sin(t * 0.9) * 0.12 * (1 - run) + (fr ? Math.sin(t * 19) * 0.12 : 0);
      B.jaw.rotation.x = 0.12 + S.rearK * 0.6 + S.lunge * 0.7 + (b.castState ? 0.25 : 0) + fr * (0.3 + Math.sin(t * 15) * 0.2); B.tail.rotation.y = Math.sin(t * (2 + fr * 7)) * (0.4 + fr * 0.3); B.tail.rotation.x = S.rearK * 0.4;
      const red = Math.max(fr, S.chant > 0 ? 1 - sat(S.chant / 9) * 0.8 : 0, S.lvl >= 2 ? 0.7 : 0) * (1 - S.downK);
      B.eyeM.color.setHex(0xffc040).lerp(_c.setHex(BLOOD), red).multiplyScalar((3 + red * 5) * (1 - S.downK * 0.85)); S.eyeL.intensity = red * 40;
      // chain links along the polyline, sagging where there is slack
      const I = S.links; let n = 0; const cy = 2.75 + B.rig.position.y * 0.8, cx = b.pos.x + Math.sin(b.facing) * 1.7, cz = b.pos.z + Math.cos(b.facing) * 1.7;
      const lay = (ax, ay, az, bx, by, bz, sag) => {
        const len = Math.hypot(bx - ax, by - ay, bz - az), cnt = Math.max(1, Math.round(len / 0.36));
        for (let i = 0; i < cnt && n < 168; i++) {
          const k = (i + 0.5) / cnt, k2 = (i + 1.5) / cnt, y = (kk) => Math.max(0.12, lerp(ay, by, kk) - 4 * sag * kk * (1 - kk));
          _a.set(lerp(ax, bx, k), y(k), lerp(az, bz, k)); _b.set(lerp(ax, bx, k2), y(k2), lerp(az, bz, k2)).sub(_a); if (_b.lengthSq() < 1e-8) _b.set(0, 0, 1); _b.normalize();
          _m.position.copy(_a); _m.quaternion.setFromUnitVectors(_z, _b); _q.setFromAxisAngle(_z, n % 2 ? PI / 2 : 0); _m.quaternion.multiply(_q); _q.setFromAxisAngle(_a.set(0, 1, 0), PI / 2); _m.quaternion.multiply(_q); _m.scale.set(1, 1, 1.25); _m.updateMatrix(); I.setMatrixAt(n++, _m.matrix);
        }
      };
      if (!S.loose) {
        let ax = 0, ay = 1.45, az = 0;
        for (const w of S.wraps) { lay(ax, ay, az, w.q.x, 1.3, w.q.z, 0.05); ax = w.q.x; ay = 1.3; az = w.q.z; }
        const d = Math.hypot(cx - ax, cz - az), slack = Math.max(0, reach(S) + 1.7 - d); lay(ax, ay, az, cx, cy, cz, Math.min(1.9, slack * 0.45) + S.whipK * -0.6);
      } else {
        const lift = F.on ? 1 : F.wind ? 0.6 : 0, ty = 0.5 + lift * 0.9; lay(cx, cy, cz, S.tip.x, ty, S.tip.z, F.on ? 0 : 1.6 * (1 - lift * 0.6));
        S.block.position.set(S.tip.x, ty, S.tip.z); S.block.rotation.y = angTo(cx, cz, S.tip.x, S.tip.z);
      }
      I.count = n; I.instanceMatrix.needsUpdate = true;
    },
    danger(b, x, z) {
      const S = b.state, F = S.fl; let best = Infinity;
      for (const g of S.rings) if (g.on) { const d = Math.hypot(x - g.x, z - g.z); if (d > g.r && d - g.r < 2) best = Math.min(best, (d - g.r) / g.v + 0.6); }
      if (S.loose) { if (F.on && Math.hypot(x - b.pos.x, z - b.pos.z) < FL + 1.4) best = Math.min(best, 0.3); return best; }
      if (S.frenzy > 0 || (b.castState && b.castState.name === 'Bloodlust')) { const A = lastA(S); if (Math.hypot(x - A.x, z - A.z) < reach(S) + 3.4) best = Math.min(best, 0.5 + Math.hypot(x - b.pos.x, z - b.pos.z) * 0.05); }
      return best;
    },
    bot(b, p) {
      const S = b.state, out = {};
      for (const g of S.rings) if (g.on && !g.hit) { const tt = (Math.hypot(p.pos.x - g.x, p.pos.z - g.z) - g.r) / g.v; if (tt > 0 && tt < 0.2) p.jump(); }
      if (S.loose) { const cs = b.castState; if (S.fl.on || (cs && cs.name === 'Flail')) { const a = angTo(b.pos.x, b.pos.z, p.pos.x, p.pos.z); let x = b.pos.x + Math.sin(a) * (FL + 3.5), z = b.pos.z + Math.cos(a) * (FL + 3.5); if (Math.hypot(x, z) > R - 1.5) { const a2 = angTo(b.pos.x, b.pos.z, 0, 0); x = b.pos.x + Math.sin(a2) * (FL + 3.5); z = b.pos.z + Math.cos(a2) * (FL + 3.5); } out.x = x; out.z = z; out.w = 3; out.holdFire = false; } return out; }
      const hot = S.chant > 0 || S.frenzy > 0 || (b.castState && b.castState.name === 'Bloodlust');
      if (hot) {
        const A = lastA(S), r = reach(S) + 4.2;
        if (S.wraps.length) { let bx = null, bz = 0, bd = 1e9; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, x = Math.sin(a) * (R - 1.6), z = Math.cos(a) * (R - 1.6); if (Math.hypot(x - A.x, z - A.z) < r) continue; const d = Math.hypot(x - p.pos.x, z - p.pos.z); if (d < bd) { bd = d; bx = x; bz = z; } } if (bx !== null) { out.x = bx; out.z = bz; out.w = 3; return out; } }
        let q = null, qd = 1e9; for (const s of S.posts) { if (!s.alive || S.wraps.some((w) => w.q === s)) continue; const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z) + Math.hypot(s.x, s.z) * 0.3; if (d < qd) { qd = d; q = s; } }
        if (q) { // stand beyond the post, on the other side of the stake-post line from him, so the chain has to cross it
          const ql = Math.hypot(q.x, q.z) || 1, ox = q.x / ql, oz = q.z / ql, side = cross(q.x, q.z, b.pos.x, b.pos.z) >= 0 ? 1 : -1;
          out.x = q.x + ox * 3.2 + oz * side * 5.5; out.z = q.z + oz * 3.2 - ox * side * 5.5; const d = Math.hypot(out.x, out.z); if (d > R - 1.2) { out.x *= (R - 1.2) / d; out.z *= (R - 1.2) / d; } out.w = 3; }
      }
      return out;
    },
  });
})();
