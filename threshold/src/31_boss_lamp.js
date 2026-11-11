// DOOR XII: VESPER, the Lamp-Eater. A black rotunda and one swinging lamp. The dark bites; the light burns.
(() => {
  const R = 18, COLR = 0.95, COLH = 7, ANG = 1.25, WARM = 0xffd9a0, VIOLET = 0x8a50ff, PALE = 0xfff4dc;
  const _a = new V3(), _b = new V3(), _c = new THREE.Color(), _m = new THREE.Object3D();
  const COLS = [0, 1, 2, 3, 4, 5].map((k) => ({ x: Math.sin(k * PI / 3) * 10, z: Math.cos(k * PI / 3) * 10, alive: true, k }));

  // Where the lamp is at sim time t (deterministic, so the autopilot and the casts can look ahead).
  function lampAt(S, t, out) {
    if (S.lvl >= 2 && S.carried) { out.x = S.bx; out.z = S.bz; out.h = 7.6; return out; }
    if (S.lvl >= 1) { const w = TAU / 8.5; out.x = Math.sin(t * w) * 8; out.z = Math.cos(t * w) * 8; out.h = 13 + Math.sin(t * TAU / 13) * 3; return out; }
    out.x = Math.sin(t * TAU / 7) * 9; out.z = 0; out.h = 13; return out;
  }
  // Is the floor at (x,z) lit by a lamp at L? Matches the shadow the renderer draws: column cylinders and rubble block the light.
  function litBy(S, L, x, z, pool) {
    const dx = x - L.x, dz = z - L.z, d2 = dx * dx + dz * dz, lim = pool || L.h * Math.tan(ANG) * 0.96;
    if (d2 > lim * lim) return false; if (S.out > 0) return false;
    for (const c of S.cols) {
      const r = c.alive ? COLR : c.rubble ? 1.5 : 0, h = c.alive ? COLH : 1.3; if (!r) continue;
      const fx = L.x - c.x, fz = L.z - c.z, A = d2, B = 2 * (fx * dx + fz * dz), Cq = fx * fx + fz * fz - r * r, disc = B * B - 4 * A * Cq;
      if (disc <= 0 || A < 1e-6) continue; const sq = Math.sqrt(disc), s1 = (-B - sq) / (2 * A), s2 = (-B + sq) / (2 * A);
      if (s2 < 0 || s1 > 1) continue; if (L.h * (1 - Math.max(0, s1)) < h || L.h * (1 - Math.min(1, s2)) < h) return false;
    }
    return true;
  }
  const LNOW = { x: 0, z: 0, h: 13 }, LFUT = { x: 0, z: 0, h: 13 };
  const lit = (S, x, z) => litBy(S, S.lamp, x, z, S.pool);

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x000000, horizon: 0x020203, bottom: 0x000000, stars: 0, sunDir: [0, 1, 0], sunColor: 0x000000, sunSize: 0.001, sunGlow: 0, clouds: 0 });
    g.add(sky); S.sky = sky; W.env(sky, 0.05);
    scene.fog = new THREE.FogExp2(0x020204, 0.012); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x5a6480, 0x101014, 0.1);
    S.rim = new THREE.DirectionalLight(0x6a7aa8, 0.1); S.rim.position.set(-20, 30, -40); g.add(S.rim); g.add(S.rim.target);
    S.day = new THREE.DirectionalLight(0xfff2dc, 0); S.day.position.set(30, 50, 20); g.add(S.day); g.add(S.day.target);
    // the lamp: one spot with a real shadow map
    S.spot = new THREE.SpotLight(WARM, 15, 90, ANG, 0.22, 0.6); S.spot.castShadow = true; S.spot.shadow.mapSize.set(G.q.shadow, G.q.shadow); S.spot.shadow.camera.near = 1.5; S.spot.shadow.camera.far = 70; S.spot.shadow.bias = -0.0006; S.spot.shadow.normalBias = 0.04; S.spot.shadow.radius = 2;
    g.add(S.spot); g.add(S.spot.target);
    const brass = W.mat({ color: 0xb08a40, roughness: 0.35, metalness: 0.9 });
    S.lampG = new THREE.Group(); g.add(S.lampG);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.3, 10), brass); cap.position.y = 1.5; S.lampG.add(cap);
    S.glassM = W.glow(WARM, 4); const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.75, 1.5, 10), S.glassM); glass.position.y = 0.3; S.lampG.add(glass);
    const foot = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.6, 10), brass); foot.position.y = -0.7; foot.rotation.x = PI; S.lampG.add(foot);
    for (let k = 0; k < 6; k++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), brass); rib.position.set(Math.sin(k * PI / 3) * 0.95, 0.3, Math.cos(k * PI / 3) * 0.95); S.lampG.add(rib); }
    S.chain = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), W.mat({ color: 0x2a2620, roughness: 0.6, metalness: 0.7 })); g.add(S.chain);
    S.coneM = new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.028, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    S.cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 40, 1, true), S.coneM); S.cone.geometry.translate(0, -0.5, 0); g.add(S.cone);
    // floor and walls: pale stone, so light and shadow are the whole picture
    const st = W.surface('slabs', { seed: 5, dark: 0x8a857c, light: 0xc8c2b6 }); for (const k in st) st[k].repeat.set(5, 5);
    const floorM = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.55, color: 0xffffff, envMapIntensity: 0.2 }); floorM.normalScale.set(0.4, 0.4);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 3, 72), floorM); floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    const wallM = W.mat({ color: 0x8c8880, roughness: 0.8 });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 3, R + 3, 34, 48, 1, true), wallM); wall.material.side = THREE.BackSide; wall.position.y = 17; wall.receiveShadow = true; g.add(wall);
    S.winM = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (let k = 0; k < 12; k++) { const a = k * PI / 6 + PI / 12, pil = new THREE.Mesh(new THREE.BoxGeometry(1.6, 34, 1.2), wallM); pil.position.set(Math.sin(a) * (R + 2.5), 17, Math.cos(a) * (R + 2.5)); pil.rotation.y = a; pil.receiveShadow = true; g.add(pil);
      const a2 = k * PI / 6, win = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 14), S.winM); win.position.set(Math.sin(a2) * (R + 2.85), 16, Math.cos(a2) * (R + 2.85)); win.rotation.y = a2 + PI; g.add(win); }
    const colM = W.mat({ color: 0xe8e4dc, roughness: 0.6 }), rubM = W.mat({ color: 0xbab4a8, roughness: 0.8 });
    S.cols = COLS.map((c) => {
      const q = Object.assign({}, c, { alive: true, rubble: false, fall: 0 }), grp = new THREE.Group(); grp.position.set(q.x, 0, q.z); g.add(grp);
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(COLR, COLR, COLH, 20), colM); sh.position.y = COLH / 2; sh.castShadow = sh.receiveShadow = true; grp.add(sh);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.4, 20), colM); base.position.y = 0.2; base.receiveShadow = true; grp.add(base);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, COLR, 0.4, 20), colM); top.position.y = COLH - 0.2; grp.add(top);
      const rub = new THREE.Group(); rub.position.set(q.x, 0, q.z); rub.visible = false; g.add(rub);
      for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(COLR, COLR, 1.1, 12), rubM); m.position.set(Math.sin(i * 1.7) * 0.7, 0.55 + (i === 3 ? 0.6 : 0), Math.cos(i * 1.7) * 0.7); m.rotation.set(i * 0.5, i, PI / 2 * (i % 2)); m.castShadow = m.receiveShadow = true; rub.add(m); }
      q.grp = grp; q.rub = rub; return q;
    });
    S.motes = W.motes({ n: 500, box: [44, 20, 44], color: 0xffe0b0, size: 0.11, vel: [0.1, -0.05, 0.06], sway: 0.6, center: [0, 9, 0], alpha: 0.6 }); g.add(S.motes);
    // eyes that open in the dark around you
    S.eyeI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), W.glow(0xffffff, 3), 24); S.eyeI.count = 0; S.eyeI.frustumCulled = false; g.add(S.eyeI);

    // ---- Vesper ----
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    const robe = W.mat({ color: 0xcfc8c0, roughness: 0.85 }), dark = W.mat({ color: 0x1a181c, roughness: 0.9 }), porcelain = W.mat({ color: 0xf4f0ea, roughness: 0.25 });
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4.4, 14, 1, true), robe); skirt.position.y = 2.2; skirt.material.side = THREE.DoubleSide; skirt.castShadow = true; S.rig.add(skirt);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.2, 4, 10), robe); torso.position.y = 4.3; torso.castShadow = true; S.rig.add(torso);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10, 0, TAU, 0, PI * 0.7), dark); hood.position.set(0, 5.55, -0.08); hood.castShadow = true; S.rig.add(hood);
    S.head = new THREE.Group(); S.head.position.set(0, 5.5, 0.1); S.rig.add(S.head);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), porcelain); mask.scale.set(0.8, 1.05, 0.55); mask.position.z = 0.25; S.head.add(mask);
    S.eyeM = W.glow(0xffffff, 3); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), S.eyeM); e.position.set(sx * 0.17, 0.08, 0.53); e.scale.set(1.5, 0.6, 0.6); S.head.add(e); }
    S.arms = [-1, 1].map((sx) => { const a = new THREE.Group(); a.position.set(sx * 0.8, 4.9, 0); S.rig.add(a); const sl = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.6, 8), robe); sl.position.y = -1.2; sl.rotation.x = PI; sl.castShadow = true; a.add(sl); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), porcelain); hand.position.y = -2.5; a.add(hand); return a; });
    Object.assign(S, { lvl: 0, lamp: { x: 0, z: 0, h: 13 }, pool: 0, poolT: 0, out: 0, carried: false, bx: 0, bz: 0, darkT: 0, bites: 0, biteT: 0, flareAt: 0, sunAt: 0, flareK: 0, sunK: 0, raise: 0, shades: [], dayK: 0, spotI: 15 });
    return {
      edge: 'wall', spawn: { x: 0, z: 6 }, bossStart: { x: 1, z: -14, face: 0 }, camDist: 16,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      clamp(p) { const d = Math.hypot(p.x, p.z); if (d > R - 0.5) { p.x *= (R - 0.5) / d; p.z *= (R - 0.5) / d; } },
      solid(p) { for (const c of S.cols) { const r = c.alive ? 1.5 : c.rubble ? 1.9 : 0; if (!r) continue; const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz); if (d < r && d > 0.001) { p.x = c.x + dx / d * r; p.z = c.z + dz / d * r; } } },
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > R + 2) { x *= (R + 2) / d; z *= (R + 2) / d; } return { x, y: Math.max(y, 0.5), z }; },
    };
  }

  // ---------- casts ----------
  function* flare(b, time = 3.0) {
    const S = b.state, p = G.player; S.flareAt = G.now + time; S.raise = 1; Sound.sfx('charge', 0.8, 1.4);
    const r = yield* b.cast({ name: 'Flare', time, onTick: (k) => { S.flareK = k; } }); S.flareK = 0; S.flareAt = 0; S.raise = 0; if (r === 'dead') return;
    Sound.sfx('bigboom', 1, 1.5); Sound.sfx('zap', 0.8); FX.flash(0xfff6e0, 0.75, 2.2); FX.shake(0.6); S.burst = 1;
    if (p.alive && lit(S, p.pos.x, p.pos.z)) p.hurt(420, { blockable: true, src: { name: 'Flare' } });
    yield 0.5;
  }
  function* blackSun(b, time = 2.6) {
    const S = b.state, p = G.player; S.sunAt = G.now + time; S.raise = 1; Sound.sfx('charge', 0.8, 0.5);
    const r = yield* b.cast({ name: 'Black Sun', time, onTick: (k) => { S.sunK = k; } }); S.sunK = 0; S.sunAt = 0; S.raise = 0; if (r === 'dead') return;
    Sound.sfx('bigboom', 1, 0.5); Sound.sfx('roar', 0.6, 0.4); FX.flash(0x1a0830, 0.8, 2.5); FX.shake(0.6); S.dip = 1;
    if (p.alive && !lit(S, p.pos.x, p.pos.z)) p.hurt(420, { blockable: true, src: { name: 'Black Sun' } });
    if (!G.headless) for (const c of S.cols) if (c.alive) FX.ring(c.x, c.z, { r0: 1, r1: 6, color: VIOLET, dur: 0.5 });
    yield 0.5;
  }
  function* clutch(b, n = 3) {
    const p = G.player; yield* b.cast({ name: 'Clutch', time: 0.5 });
    for (let k = 0; k < n; k++) { Hz.circle(p.pos.x, p.pos.z, 2.7, 1.1, 240, { name: 'Clutch', color: VIOLET }); yield 0.55; }
    yield 0.6;
  }
  function* lances(b) {
    const S = b.state; S.raise = 0.6;
    for (const c of S.cols) if (c.alive) { const dir = Math.atan2(c.x - S.lamp.x, c.z - S.lamp.z); Hz.rect(c.x, c.z, dir, 16, 2.5, 1.35, 300, { name: 'Shade Lance', color: VIOLET, quiet: true }); }
    const r = yield* b.cast({ name: 'Shade Lances', time: 1.35 }); S.raise = 0; if (r === 'done') { Sound.sfx('sword', 1, 0.5); FX.shake(0.4); } yield 0.7;
  }
  function* wing(b) {
    const S = b.state, dir = b.angToPlayer(); b.autoFace = false; S.raise = 0.8;
    Hz.cone(b.pos.x, b.pos.z, dir, 2.3, 8, 1.2, 300, { name: 'Eclipse Wing', color: VIOLET, onFire() { Sound.sfx('sword', 0.9, 0.7); FX.shake(0.4); } });
    yield* b.cast({ name: 'Eclipse Wing', time: 1.2 }); S.raise = 0; yield 0.6; b.autoFace = true;
  }
  function* snuff(b) {
    const S = b.state; S.raise = 1; const r = yield* b.cast({ name: 'Snuff', time: 1.6 }); S.raise = 0; if (r !== 'done') return;
    Sound.sfx('steam', 0.9, 0.6); S.poolT = 5.5; yield 1.0;
  }
  function* step(b) {
    const S = b.state, alive = S.cols.filter((c) => c.alive); let x, z;
    if (S.lvl === 0) { const o = shuffle([[1, 14], [-1, 14], [1, -14], [-1, -14]]).find((q) => Math.hypot(q[0] - b.pos.x, q[1] - b.pos.z) > 4); x = o[0]; z = o[1]; }
    else { const c = pick(alive), a = Math.atan2(c.x, c.z) + pick([-0.45, 0.45]); x = Math.sin(a) * 12.5; z = Math.cos(a) * 12.5; }
    const r = yield* b.cast({ name: 'Shadowstep', time: 0.7 }); if (r !== 'done') return;
    if (!G.headless) { FX.burst(b.pos.x, 2.5, b.pos.z, { n: 40, color: 0x0a0810, color2: 0x302840, speed: [1, 5], life: [0.5, 1.2], size: [0.4, 0.9], smoke: true }); FX.burst(x, 2.5, z, { n: 30, color: 0x0a0810, color2: 0x302840, speed: [1, 4], life: [0.4, 1.0], size: [0.4, 0.9], smoke: true }); }
    Sound.sfx('blink', 0.8, 0.5); b.pos.x = x; b.pos.z = z; yield 0.5;
  }
  function topple(b, c, delay = 1.7) {
    const S = b.state, dir = Math.atan2(-c.x, -c.z) + rnd(-0.5, 0.5);
    Hz.rect(c.x, c.z, dir, COLH + 1.5, 2.6, delay, 320, { name: 'Falling Column', tag: 'fight', onFire() { c.alive = false; c.rubble = true; c.fall = 0.001; c.dir = dir; Sound.sfx('bigboom', 1, 0.7); Sound.sfx('shatter', 0.8, 0.5); FX.shake(0.9); if (!G.headless) FX.burst(c.x + Math.sin(dir) * 4, 0.5, c.z + Math.cos(dir) * 4, { n: 40, color: 0xd8d0c4, speed: [2, 9], life: [0.4, 1.2], size: [0.2, 0.7], radius: 3, smoke: true }); } });
  }
  function spawnShade(b, c) {
    const S = b.state, grp = new THREE.Group(), body = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 8), W.mat({ color: 0x08070a, roughness: 1 })); body.position.y = 1.1; body.castShadow = true; grp.add(body);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), W.glow(0xffffff, 3)); e.position.set(sx * 0.16, 1.7, 0.42); grp.add(e); }
    const a = Math.atan2(c.x, c.z), e = b.spawnAdd({ name: 'Shade', hp: 650, x: c.x + Math.sin(a) * 2.5, z: c.z + Math.cos(a) * 2.5, radius: 0.8, aimY: 1.2, mesh: grp, color: VIOLET,
      update(e, dt) {
        const p = G.player; if (!p.alive || G.state !== 'fight' || b.transitioning) return;
        const L = lit(S, e.pos.x, e.pos.z); e.immune = !L; e.dmgTaken = 2; grp.scale.y = damp(grp.scale.y, L ? 0.75 : 1.15, 6, dt);
        if (L && !G.headless && vrand() < dt * 14) FX.burst(e.pos.x, 1.2, e.pos.z, { n: 2, color: 0xffe0a0, speed: [0.5, 2], up: 2, life: [0.3, 0.6], size: [0.15, 0.3] });
        if (e.pause > 0) { e.pause -= dt; return; }
        const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1; e.facing = dampAng(e.facing, Math.atan2(dx, dz), 8, dt);
        if (d < 2.0) { e.pause = 1.6; Hz.circle(e.pos.x + dx / d, e.pos.z + dz / d, 2.2, 0.75, 150, { name: 'Shade', color: VIOLET, quiet: true, tag: 'fight' }); return; }
        const sp = (L ? 1.6 : 4.6) * dt; e.pos.x += dx / d * sp; e.pos.z += dz / d * sp;
      },
      onDeath(e) { const i = S.shades.indexOf(e); if (i >= 0) S.shades.splice(i, 1); } });
    e.pause = 0.8; S.shades.push(e);
  }
  function* shades(b, n = 2) {
    const S = b.state; const r = yield* b.cast({ name: 'What the Dark Keeps', time: 1.4 }); if (r !== 'done') return;
    Sound.sfx('roar', 0.6, 1.8); const alive = shuffle(S.cols.filter((c) => c.alive)); for (let k = 0; k < n && k < alive.length; k++) spawnShade(b, alive[k]); yield 0.6;
  }
  function* devour(b) {
    const S = b.state; S.raise = 1; const r = yield* b.cast({ name: 'Devour Light', time: 3.0, interruptible: true }); S.raise = 0;
    if (r === 'done') { Sound.sfx('roar', 1, 0.4); FX.flash(0x000000, 0.9, 1.2); S.out = 5.5; } yield 0.6;
  }
  function setAct(b, n) {
    const S = b.state; S.lvl = n; S.flareAt = S.sunAt = 0; S.flareK = S.sunK = 0; S.raise = 0; b.autoFace = true; S.walk = false;
    const want = n === 0 ? 6 : n === 1 ? 4 : 3; let live = S.cols.filter((c) => c.alive);
    while (live.length > want) { const c = live[(live.length * 2 + 1) % live.length]; c.alive = false; c.rubble = true; c.fall = 1; live = S.cols.filter((q) => q.alive); }
    S.carried = n >= 2;
  }

  G.bosses.push({
    id: 'lamp', name: 'VESPER', title: 'The Lamp-Eater', hint: 'Mind the dark', color: '#ffe2b0', telegraph: 0x9a60ff,
    hp: 19500, radius: 1.4, aimY: 3.6, enrage: 430,
    post: { bloom: 0.45, threshold: 0.88, radius: 0.7, exposure: 1.0, vig: 1.25, sat: 0.7, contrast: 1.15, tint: [1.02, 1.0, 0.97] },
    music: { bpm: 72, root: 36, scale: [0, 1, 3, 5, 6, 8, 10], prog: [0, 0, 1, 0, 0, 4, 1, 0],
      layers: [
        { v: 'sub', pat: '0...............', oct: -1, len: 14, vol: 0.2 }, { v: 'bell', pat: ['0.......4.......', '2.......1.......'], oct: 2, len: 6, vol: 0.05 }, { v: 'choir', pat: '0...............', oct: 1, len: 16, vol: 0.05 },
        { v: 'pulse', from: 1, pat: '0.0.0.0.0.0.0.0.', oct: 0, len: 1, vol: 0.04 }, { v: 'tom', from: 1, pat: 'x.....x.....x...', vol: 0.16 }, { v: 'bass', from: 1, pat: '0.......0...1...', oct: -1, len: 3, vol: 0.12 },
        { v: 'organ', from: 2, pat: ['0.......4.......', '1.......0.......'], oct: 0, len: 8, vol: 0.09 }, { v: 'taiko', from: 2, pat: 'x...x.x.x...x.xx', vol: 0.2 }, { v: 'choir', from: 2, pat: '4.......2.......', oct: 1, len: 8, vol: 0.07 },
      ] },
    build,
    *intro(b) { Sound.sfx('bell', 0.7, 0.4); yield* Cam.shot([0, 2, 16], [0, 9, 0], [5, 4, 2], [1, 4, -14], 5.5, 46); },
    *death(b) {
      const S = b.state, a = Cam.yaw + 0.4; Cam.cine = { pos: new V3(b.pos.x - Math.sin(a) * 15, 7, b.pos.z - Math.cos(a) * 15), look: new V3(b.pos.x, 4, b.pos.z), fov: 46 };
      Sound.sfx('bell', 1, 0.3); S.dying = 0.001; for (let i = 0; i < 6; i++) { b.aim(_a); FX.explode(_a.x + (vrand() - 0.5) * 2, _a.y + (vrand() - 0.5) * 3, _a.z, PALE, 3 + i, 0xffffff); yield 0.1; }
      FX.flash(0xffffff, 0.9, 0.7); S.rig.visible = false; yield 0.7;
    },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setAct(b, 0); yield 1.2; let n = 0;
        while (true) {
          yield* clutch(b, 2); yield* flare(b, n ? 3.0 : 3.6); yield* wing(b); yield* lances(b); yield* flare(b);
          yield* snuff(b); yield* clutch(b, 3); yield 2.2; yield* step(b); n++;
        }
      } },
      { at: 0.65, skipTo(b) { setAct(b, 1); for (const c of b.state.cols) if (!c.alive) c.fall = 1; },
        *enter(b) {
          const S = b.state; S.flareAt = S.sunAt = 0; S.flareK = S.sunK = 0; S.poolT = 0; S.raise = 1; b.autoFace = true;
          const live = S.cols.filter((c) => c.alive); if (live.length > 4) { topple(b, live[1]); topple(b, live[4], 2.3); }
          yield* b.cast({ name: 'Unmoor', time: 2.6, onTick: (k) => FX.shake(k * 0.25) }); S.raise = 0; S.lvl = 1; Sound.sfx('bell', 1, 0.6);
          Co.start(Post.lerpTo({ contrast: 1.2, vig: 1.35 }, 3), 'fight'); yield 1.2;
        },
        *run(b) {
          const S = b.state; setAct(b, 1); yield 0.5; let n = 0;
          while (true) {
            yield* step(b); yield* shades(b, 2); yield* flare(b); yield* blackSun(b); yield* clutch(b, 3); yield* lances(b);
            if (n % 2) { yield* blackSun(b, 3.0); yield* flare(b, 2.6); } else { yield* wing(b); yield* snuff(b); yield* blackSun(b, 3.0); }
            yield 1.0; n++;
          }
        } },
      { at: 0.33, skipTo(b) { setAct(b, 2); for (const c of b.state.cols) if (!c.alive) c.fall = 1; },
        *enter(b) {
          const S = b.state; S.flareAt = S.sunAt = 0; S.flareK = S.sunK = 0; S.poolT = 0; b.autoFace = true;
          const live = S.cols.filter((c) => c.alive); if (live.length > 3) topple(b, live[0]);
          yield* b.moveTo(0, 0, 14); S.raise = 1; S.grab = 1;
          yield* b.cast({ name: 'Swallow the Lamp', time: 2.4, onTick: (k) => FX.shake(k * 0.3) });
          S.bx = b.pos.x; S.bz = b.pos.z; S.carried = true; S.lvl = 2; S.raise = 0; Sound.sfx('roar', 1, 0.5); FX.flash(0x000000, 0.8, 1.0);
          Co.start(Post.lerpTo({ bloom: 0.6, contrast: 1.22 }, 2), 'fight'); yield 1.4;
        },
        *run(b) {
          const S = b.state; setAct(b, 2); S.bx = b.pos.x; S.bz = b.pos.z; yield 0.4; let n = 0;
          while (true) {
            S.walk = true; yield 2.5; S.walk = false;
            yield* flare(b, 2.5); yield* blackSun(b, 2.4); yield* clutch(b, 3); S.walk = true; yield* lances(b); yield 1.5; S.walk = false;
            yield* (n % 2 ? devour(b) : wing(b)); yield* blackSun(b, 2.4); yield* flare(b, 2.4); yield* clutch(b, 2); n++;
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight';
      // the lamp
      S.bx = b.pos.x; S.bz = b.pos.z; lampAt(S, t, LNOW);
      const k = 1 - Math.exp(-(S.carried ? 5 : 2.5) * dt); S.lamp.x = lerp(S.lamp.x, LNOW.x, k); S.lamp.z = lerp(S.lamp.z, LNOW.z, k); S.lamp.h = lerp(S.lamp.h, LNOW.h, k);
      if (S.poolT > 0) S.poolT -= dt; if (S.out > 0) S.out -= dt;
      S.poolK = damp(S.poolK || 0, S.poolT > 0 ? 1 : 0, 3, dt); S.pool = S.poolK > 0.5 ? 6 : 0;
      const ang = lerp(ANG, Math.atan(6 / S.lamp.h), S.poolK); S.spot.angle = ang;
      S.spot.position.set(S.lamp.x, S.lamp.h, S.lamp.z); S.spot.target.position.set(S.lamp.x, 0, S.lamp.z);
      S.burst = Math.max(0, (S.burst || 0) - dt * 2.5); S.dip = Math.max(0, (S.dip || 0) - dt * 1.6); S.outK = damp(S.outK || 0, S.out > 0 ? 1 : 0, 6, dt);
      const fk = S.flareK * S.flareK, sk = S.sunK;
      S.spot.intensity = S.spotI * (1 + fk * 1.3 + S.burst * 3) * (1 - S.dip * 0.9) * (1 - S.outK * 0.97) * (1 - S.dayK * 0.6);
      S.spot.color.setHex(WARM).lerp(_c.setHex(0xffffff), fk * 0.8).lerp(_c.setHex(VIOLET), sk * 0.85);
      S.glassM.color.copy(S.spot.color).multiplyScalar((4 + fk * 10 + S.burst * 12) * (1 - S.outK * 0.95) * (1 - sk * 0.6));
      S.coneM.color.copy(S.spot.color); S.coneM.opacity = 0.028 * (1 + fk * 2) * (1 - S.outK);
      const lr = S.lamp.h * Math.tan(ang); S.cone.position.set(S.lamp.x, S.lamp.h, S.lamp.z); S.cone.scale.set(lr, S.lamp.h, lr);
      S.lampG.position.set(S.lamp.x, S.lamp.h + 0.9, S.lamp.z); S.lampG.visible = !S.dying;
      if (S.carried) { S.chain.visible = false; }
      else { S.chain.visible = true; _a.set(0, 46, 0); _b.set(S.lamp.x, S.lamp.h + 2.4, S.lamp.z); const len = _a.distanceTo(_b); S.chain.position.copy(_a).lerp(_b, 0.5); S.chain.scale.set(1, len, 1); S.chain.quaternion.setFromUnitVectors(_m.up, _b.sub(_a).normalize()); S.lampG.quaternion.copy(S.chain.quaternion); }
      if (S.carried) S.lampG.quaternion.identity();
      // columns falling
      for (const c of S.cols) { if (c.fall > 0 && c.fall < 1) { c.fall = Math.min(1, c.fall + dt * 2.6); c.grp.rotation.set(0, 0, 0); c.grp.rotateOnWorldAxis(_a.set(Math.cos(c.dir), 0, -Math.sin(c.dir)), c.fall * c.fall * PI / 2); } if (c.fall >= 1) { c.grp.visible = false; c.rub.visible = true; } }
      // death: daylight
      if (S.dying) { S.dying += dt; S.dayK = sat(S.dying / 1.2); S.day.intensity = S.dayK * 2.4; S.hemi.intensity = 0.1 + S.dayK * 0.9; S.winM.color.setHex(0xfff4e0).multiplyScalar(S.dayK * 3); S.fog.color.setHex(0x020204).lerp(_c.setHex(0x9a9488), S.dayK); }
      // Vesper
      S.raiseK = damp(S.raiseK || 0, S.raise || 0, 6, dt); S.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.15 + S.raiseK * 2.3); a.rotation.x = -S.raiseK * 0.3; });
      S.rig.position.y = Math.sin(t * 1.4) * 0.08; S.head.rotation.z = Math.sin(t * 0.8) * 0.08; S.eyeM.color.setHex(S.sunK > 0 ? VIOLET : 0xffffff).multiplyScalar(3 + S.raiseK * 3);
      if (S.walk && fight && p && p.alive && !b.castState) { const d = b.distToPlayer(); if (d > 4.5) { const a = b.angToPlayer(); b.pos.x += Math.sin(a) * 2.3 * dt; b.pos.z += Math.cos(a) * 2.3 * dt; G.arena.solid(b.pos); } }
      if (!p) return;
      const bl = S.carried || litBy(S, S.lamp, b.pos.x, b.pos.z, 0); b.dmgTaken = bl ? 1 : 0.5;
      if (!bl && !G.headless && vrand() < dt * 10) FX.burst(b.pos.x, 2 + vrand() * 3, b.pos.z, { n: 1, color: 0x08070c, speed: [0.2, 1], up: 1.5, life: [0.5, 1.1], size: [0.5, 1.0], smoke: true });
      // the dark bites
      const L = lit(S, p.pos.x, p.pos.z);
      if (fight && p.alive && !L && !b.transitioning) {
        S.darkT += dt;
        if (S.darkT > 0.6) { p.speedMul = 0.75; S.biteT -= dt; if (S.biteT <= 0) { S.biteT = 0.5; p.hurt(Math.min(130, 45 + S.bites * 14), { blockable: false, dot: true, src: { name: 'The Dark' } }); S.bites++; if (!G.headless) FX.burst(p.pos.x, 0.3, p.pos.z, { n: 10, color: 0x06050a, color2: 0x282038, speed: [1, 4], up: 3, life: [0.3, 0.7], size: [0.3, 0.7], radius: 0.8, smoke: true }); } }
      } else { p.speedMul = 1; S.darkT = Math.max(0, S.darkT - dt * 2); if (S.darkT === 0) { S.bites = 0; S.biteT = 0; } }
      // eyes open in the dark near you
      if (!G.headless) { let n = 0; const slot = Math.floor(t / 1.7);
        for (let i = 0; i < 12; i++) { const h1 = W.hash2(i, slot, 7), h2 = W.hash2(i, slot, 13), a = h1 * TAU, d = 3 + h2 * 7, x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if (Math.hypot(x, z) > R - 0.5 || lit(S, x, z)) continue; const blink = (t / 1.7) % 1; if (blink < 0.12 || blink > 0.9) continue; const fa = Math.atan2(p.pos.x - x, p.pos.z - z);
          for (const sx of [-1, 1]) { _m.position.set(x + Math.cos(fa) * 0.13 * sx, 0.9 + h1 * 0.9, z - Math.sin(fa) * 0.13 * sx); _m.scale.set(1.4, 0.55, 1); _m.rotation.set(0, fa, 0); _m.updateMatrix(); S.eyeI.setMatrixAt(n++, _m.matrix); } }
        S.eyeI.count = n; S.eyeI.instanceMatrix.needsUpdate = true; }
    },
    danger(b, x, z) {
      const S = b.state; let best = Infinity;
      if (S.flareAt) { lampAt(S, S.flareAt, LFUT); if (litBy(S, LFUT, x, z, S.pool)) best = Math.max(0, S.flareAt - G.now); }
      if (S.sunAt) { lampAt(S, S.sunAt, LFUT); if (!litBy(S, LFUT, x, z, S.pool)) best = Math.min(best, Math.max(0, S.sunAt - G.now)); }
      if (best === Infinity && !(S.flareAt && S.flareAt - G.now < 1.6) && !lit(S, x, z)) best = 0.4; // the dark itself
      return best;
    },
    bot(b, p) {
      const S = b.state, wantDark = S.flareAt && (!S.sunAt || S.flareAt < S.sunAt) && S.flareAt - G.now < 1.6, avoid = (x, z) => !wantDark && !lit(S, x, z);
      let target = b; for (const e of S.shades) if (e.alive && !e.immune) target = e;
      if (S.flareAt && (!S.sunAt || S.flareAt < S.sunAt)) { // head for where a shadow will be when the lamp flares
        lampAt(S, S.flareAt, LFUT); let best = null, bd = 1e9;
        for (const c of S.cols) { if (!c.alive) continue; const a = Math.atan2(c.x - LFUT.x, c.z - LFUT.z); for (const d of [2.2, 3.4, 4.6]) { const x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d; if (Math.hypot(x, z) > R - 1 || litBy(S, LFUT, x, z, S.pool)) continue; const q = Math.hypot(x - p.pos.x, z - p.pos.z); if (q < bd) { bd = q; best = [x, z]; } } }
        if (best) { const tt = bd / 7, left = S.flareAt - G.now; if (left < tt + 0.9) return { x: best[0], z: best[1], w: 4, avoid, target }; const a = Math.atan2(p.pos.x - best[0], p.pos.z - best[1]); let wx = best[0] + Math.sin(a) * 2.4, wz = best[1] + Math.cos(a) * 2.4; if (!lit(S, wx, wz)) { wx = best[0] - Math.cos(a) * 2.6; wz = best[1] + Math.sin(a) * 2.6; } return { x: wx, z: wz, w: 2, avoid, target }; }
      }
      if (S.pool) return { x: S.lamp.x, z: S.lamp.z, w: 3, avoid, target };
      return { avoid, target };
    },
  });
})();
