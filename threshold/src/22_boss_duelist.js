// DOOR III: ISSEN, the Last Petal. One swordsman on a lake at dusk. Fast, precise, and he remembers every cut.
(() => {
  const R = 15, ROSE = 0xff4a6a, PALE = 0xffd8e0;
  const edgeLen = (x, z, a) => { let d = 0; while (d < 40) { const nx = x + Math.sin(a) * (d + 0.5), nz = z + Math.cos(a) * (d + 0.5); if (nx * nx + nz * nz > 14.2 * 14.2) break; d += 0.5; } return d; };

  function build(b) {
    const g = G.world, S = b.state;
    const sunDir = [-0.28, 0.13, -0.95];
    const sky = W.sky({ top: 0x24306e, horizon: 0xff9a6a, bottom: 0x3a2030, exp: 0.42, clouds: 0.5, cloudColor: 0xffb8a0, cloudDark: 0x70507a, cloudScale: 0.9, cloudSpeed: 0.006, sunDir, sunColor: 0xffd8a8, sunSize: 0.1, sunGlow: 1.4, stars: 0 }); g.add(sky); S.sky = sky; W.env(sky, 1.0);
    scene.fog = new THREE.FogExp2(0xd89080, 0.0045);
    S.hemi = W.hemi(g, 0x9a9ad0, 0x604038, 1.0);
    S.sun = W.sun(g, { dir: [-0.3, 0.32, -0.9], color: 0xffc090, intensity: 3.4, size: 22 });
    S.water = W.water({ size: 900, seg: 60, deep: 0x1a2238, shallow: 0x2a3550, sky: 0xffa888, sunDir, sunColor: 0xffd0a0, amp: 0.035, scale: 0.12, speed: 0.6, foam: 0, y: -0.3, ripple: -0.3 }); g.add(S.water);
    // stage
    const wd = W.surface('wood', { n: 8, dark: 0x1c0f0a, light: 0x8a5a3a, strength: 2 }); for (const k in wd) wd[k].repeat.set(3, 3);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.5, 64), new THREE.MeshStandardMaterial({ map: wd.map, normalMap: wd.normalMap, roughnessMap: wd.roughnessMap, roughness: 0.6, metalness: 0.05, envMapIntensity: 0.9 })); stage.position.y = -0.25; stage.receiveShadow = true; g.add(stage);
    S.rim = new THREE.MeshStandardMaterial({ color: 0x5a0a14, emissive: ROSE, emissiveIntensity: 0.25, roughness: 0.4 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.25, 0.16, 8, 80), S.rim); rim.rotation.x = PI / 2; rim.position.y = 0.02; g.add(rim);
    const inl = new THREE.Mesh(new THREE.RingGeometry(6.9, 7.0, 80), W.mat({ color: 0x100806, roughness: 0.5 })); inl.rotation.x = -PI / 2; inl.position.y = 0.012; g.add(inl);
    const stone = W.mat({ color: 0x6a6460, roughness: 0.9 }); S.lampMat = W.glow(0xffc070, 3);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.39, x = Math.sin(a) * (R + 1.6), z = Math.cos(a) * (R + 1.6); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.4, 6), stone); post.position.set(x, 0.6, z); post.castShadow = true; g.add(post); const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), S.lampMat); box.position.set(x, 2.0, z); g.add(box); const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 4), stone); cap.position.set(x, 2.45, z); cap.rotation.y = PI / 4; g.add(cap); }
    for (const [x, z] of [[-11, -12], [12, 10]]) { const L = new THREE.PointLight(0xffb060, 60, 30, 1.7); L.position.set(x, 2.5, z); g.add(L); }
    // torii
    const red = W.mat({ color: 0xa81c1c, roughness: 0.55 }), blk = W.mat({ color: 0x0c0a0a, roughness: 0.6 });
    const tor = new THREE.Group(); tor.position.set(0, -0.3, -27); g.add(tor);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 13, 12), red); p.position.set(sx * 6.5, 6.5, 0); p.rotation.z = -sx * 0.04; p.castShadow = true; tor.add(p); }
    const k1 = new THREE.Mesh(new THREE.BoxGeometry(18, 0.9, 1.2), blk); k1.position.y = 13.4; tor.add(k1); const k2 = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.7, 0.9), red); k2.position.y = 12.5; tor.add(k2); const k3 = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.6, 0.7), red); k3.position.y = 10.4; tor.add(k3);
    // cherry trees: bent trunks + instanced blossom clusters
    const bark = W.mat({ color: 0x241612, roughness: 0.95 });
    S.blossom = new THREE.MeshStandardMaterial({ color: 0xffb4c8, emissive: 0xff7a9a, emissiveIntensity: 0.35, roughness: 0.8, flatShading: true });
    const puffs = []; const tree = (tx, tz, sc, seed) => {
      const r = mulberry(seed); let x = tx, y = -0.5, z = tz, dx = (r() - 0.5) * 0.5, dz = (r() - 0.5) * 0.5;
      for (let i = 0; i < 6; i++) { const h = 2.2 * sc, w = (1.0 - i * 0.13) * sc; const c = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.8, w, h * 1.1, 8), bark); c.position.set(x, y + h / 2, z); c.rotation.set(dz * 0.8, 0, -dx * 0.8); c.castShadow = true; g.add(c); y += h; x += dx * sc * 1.5; z += dz * sc * 1.5; dx += (r() - 0.5) * 0.5; dz += (r() - 0.5) * 0.5; }
      for (let i = 0; i < 90; i++) { const a = r() * TAU, e = Math.acos(r() * 1.3 - 0.3), rr = (5 + r() * 5.5) * sc; puffs.push([x + Math.sin(a) * Math.sin(e) * rr, y + Math.cos(e) * rr * 0.55 - sc, z + Math.cos(a) * Math.sin(e) * rr, (1.2 + r() * 1.8) * sc]); }
    };
    tree(-15, -24, 1.5, 4); tree(19, -20, 1.1, 9); tree(-25, 4, 1.0, 14); tree(24, 14, 0.9, 21);
    const pm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), S.blossom, puffs.length); const M = new THREE.Matrix4(); puffs.forEach((q, i) => { M.makeScale(q[3], q[3] * 0.75, q[3]); M.setPosition(q[0], q[1], q[2]); pm.setMatrixAt(i, M); }); pm.castShadow = true; g.add(pm);
    for (const [x, z] of [[-15, -24], [19, -20], [-25, 4], [24, 14]]) { const isle = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6, 1, 10), W.mat({ color: 0x3a4a2a, roughness: 1 })); isle.position.set(x, -0.6, z); g.add(isle); }
    // far mountains
    const mt = W.mat({ color: 0x5a5a8a, roughness: 1 });
    for (let i = 0; i < 9; i++) { const a = -1.6 + i * 0.42 + W.hash2(i, 1, 3) * 0.2, d = 330 + W.hash2(i, 2, 3) * 120, h = 60 + W.hash2(i, 3, 3) * 90; const m = new THREE.Mesh(new THREE.ConeGeometry(h * 1.3, h, 5), mt); m.position.set(Math.sin(a + PI) * d, h / 2 - 3, Math.cos(a + PI) * d); m.rotation.y = i; g.add(m); }
    S.petals = W.motes({ n: 500, box: [50, 16, 50], color: 0xffa8c0, size: 0.13, vel: [0.7, -0.75, 0.35], sway: 1.3, center: [0, 8, 0], mult: 0.9, alpha: 0.9 }); g.add(S.petals);
    // ---- Issen ----
    const M2 = buildHero({ id: 'duskblade', look: { armor: 0x15151c, cloth: 0xe8dccc, glow: ROSE, hood: false } }); S.model = M2; M2.group.scale.setScalar(1.28); b.group.add(M2.group);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.3, 20), W.mat({ color: 0xb89a5a, roughness: 0.9 })); hat.position.set(0, 2.02, 0); hat.castShadow = true; M2.body.add(hat);
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 12, 1, true), W.mat({ color: 0x1a1420, roughness: 0.9, side: THREE.DoubleSide })); skirt.position.y = 0.72; M2.body.add(skirt);
    S.fake = { moveSpeed: 0, grounded: true, casting: null, parryT: 0, flashT: 0 };
    S.aura = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); S.aura.rotation.x = -PI / 2; S.aura.position.y = 0.06; b.group.add(S.aura);
    // ghosts
    S.ghostMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ROSE).multiplyScalar(1.3), transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    S.ghosts = [];
    for (let i = 0; i < 6; i++) { const gg = new THREE.Group(); const bd = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 1.3, 4, 8), S.ghostMat); bd.position.y = 1.15; gg.add(bd); const h = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.36, 12), S.ghostMat); h.position.y = 2.25; gg.add(h); const sw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.7), S.ghostMat); sw.position.set(0.4, 1.3, 0.9); gg.add(sw); gg.visible = false; g.add(gg); S.ghosts.push({ g: gg, cut: null, mark: null }); }
    S.cuts = []; S.haste = 0; S.still = false; S.walk = false; S.kneel = 0; S.night = 0; S.open = 0;
    b.onDamaged = (amt, info) => { if (S.still && !S.countered && info.src === 'player') { S.countered = true; Co.start(counter(b), 'phase'); } };
    return { edge: 'wall', radius: R, spawn: { x: 0, z: 10 }, bossStart: { x: 0, z: -5, face: 0 }, contains: (x, z) => x * x + z * z <= R * R };
  }

  const tele = (b, t) => t * Math.pow(0.86, b.state.haste);
  function petals(x, z, n = 30, c = PALE) { FX.burst(x, 1.2, z, { n, color: c, color2: ROSE, speed: [1, 7], life: [0.5, 1.3], size: [0.1, 0.28], grav: 2, drag: 1.5 }); }
  function cutFx(x, z, dir, len, col = 0xffffff) {
    const ex = x + Math.sin(dir) * len, ez = z + Math.cos(dir) * len; FX.beam(new V3(x, 1.2, z), new V3(ex, 1.2, ez), { color: col, width: 0.42, dur: 0.32, mult: 3 }); Sound.sfx('sword', 0.9, 0.8 + vrand() * 0.3); Sound.sfx('slash', 0.8);
    if (!G.headless) for (let d = 0; d < len; d += 1.6) FX.burst(x + Math.sin(dir) * d, 0.9, z + Math.cos(dir) * d, { n: 3, color: PALE, color2: ROSE, speed: [0.5, 3], life: [0.4, 1.0], size: [0.1, 0.25], up: 1 });
    FX.shake(0.2);
  }
  function addGhost(b, cut) {
    const S = b.state, gh = S.ghosts.find((q) => !q.cut); if (!gh) return; gh.cut = cut; gh.g.visible = true; gh.g.position.set(cut.x, 0, cut.z); gh.g.rotation.y = cut.dir;
    gh.mark = Hz.mark({ type: 'rect', x: cut.x, z: cut.z, dir: cut.dir, len: cut.len, w: 0.35 }, 60, { color: ROSE, alpha: 0.45 });
  }
  function* drawCut(b, n) {
    const S = b.state, p = G.player; S.walk = false;
    for (let i = 0; i < n; i++) {
      const a = b.angToPlayer(); b.facing = a; const len = Math.max(6, edgeLen(b.pos.x, b.pos.z, a)), cut = { x: b.pos.x, z: b.pos.z, dir: a, len };
      S.fake.parryT = 1; const t = tele(b, i === 0 ? 0.95 : 0.72);
      Hz.rect(cut.x, cut.z, a, len, 2.3, t, 310, { name: 'Draw Cut', color: ROSE, quiet: true, silent: i > 0 });
      yield t; S.fake.parryT = 0; S.model.swing(1, 0.25); cutFx(cut.x, cut.z, a, len); addGhost(b, cut);
      b.pos.x += Math.sin(a) * len; b.pos.z += Math.cos(a) * len; petals(b.pos.x, b.pos.z, 14); yield 0.3;
    }
    b.facing = b.angToPlayer(); yield 0.5;
  }
  // mode 0: one at a time. 1: in pairs. 2: all at once.
  function* echo(b, mode) {
    const S = b.state, list = S.ghosts.filter((q) => q.cut); if (!list.length) return;
    yield* b.cast({ name: 'Echo', time: 0.9 });
    const t = tele(b, mode === 2 ? 1.3 : 0.8);
    for (let i = 0; i < list.length; i++) {
      const gh = list[i], c = gh.cut; Hz.cancel(gh.mark);
      Hz.rect(c.x, c.z, c.dir, c.len, 2.3, t, 270, { name: 'Echo', color: ROSE, quiet: true, silent: i > 0, onFire: () => { cutFx(c.x, c.z, c.dir, c.len, PALE); gh.g.visible = false; gh.cut = null; } });
      if (mode === 0 || (mode === 1 && i % 2 === 1)) yield tele(b, 0.55);
    }
    yield t + 0.5;
  }
  function clearGhosts(S) { for (const gh of S.ghosts) { if (gh.mark) Hz.cancel(gh.mark); gh.cut = null; gh.g.visible = false; } }
  function* moon(b, kinds) {
    const S = b.state; S.walk = false;
    for (const k of kinds) {
      const t = tele(b, 0.95), x = b.pos.x, z = b.pos.z, a = b.angToPlayer(); b.facing = a; S.fake.parryT = 1;
      const fx = () => { S.model.swing(k === 'c' ? 1 : 0, 0.3); Sound.sfx('sword'); Sound.sfx('boom', 0.5); FX.shake(0.3); };
      if (k === 'c') Hz.cone(x, z, a, 3.5, 9.5, t, 320, { name: 'Crescent', color: ROSE, quiet: true, onFire: () => { fx(); FX.slash(x, 1.2, z, a, { r: 9.5, color: PALE, dur: 0.35 }); FX.slash(x, 1.2, z, a + 1.2, { r: 9.5, color: ROSE, dur: 0.35 }); FX.slash(x, 1.2, z, a - 1.2, { r: 9.5, color: ROSE, dur: 0.35 }); } });
      else if (k === 'o') Hz.donut(x, z, 4.2, 14, t, 320, { name: 'Full Moon', color: ROSE, quiet: true, onFire: () => { fx(); FX.ring(x, z, { r0: 4.2, r1: 14, color: PALE, dur: 0.45, width: 0.3 }); petals(x, z, 40); } });
      else Hz.circle(x, z, 6.6, t, 320, { name: 'New Moon', color: ROSE, quiet: true, onFire: () => { fx(); FX.dome(x, 0.5, z, { r: 6.6, color: ROSE, dur: 0.4 }); FX.ring(x, z, { r0: 0.5, r1: 6.6, color: PALE, dur: 0.35 }); } });
      yield t * 0.72;
    }
    yield 0.5; S.fake.parryT = 0; yield 0.4;
  }
  function* stillness(b, dur = 2.3) {
    const S = b.state; S.walk = false; S.still = true; S.countered = false; S.kneel = 1; Sound.sfx('bell', 0.45, 3); b.facing = b.angToPlayer();
    yield* b.cast({ name: 'Stillness', time: dur });
    S.still = false; S.kneel = 0;
    if (!S.countered) { S.open = 3.2; b.dmgTaken = 1.6; petals(b.pos.x, b.pos.z, 24); yield 3.2; b.dmgTaken = 1; } else yield 1.0;
  }
  function* counter(b) {
    const S = b.state, p = G.player; FX.flash(0xffffff, 0.3, 4); Sound.sfx('parry', 0.8, 0.7); petals(b.pos.x, b.pos.z, 30);
    const a = p.facing + PI, ox = b.pos.x, oz = b.pos.z; let tx = p.pos.x + Math.sin(a) * 2.2, tz = p.pos.z + Math.cos(a) * 2.2; const d = Math.hypot(tx, tz); if (d > 14) { tx *= 14 / d; tz *= 14 / d; }
    yield 0.22; b.pos.x = tx; b.pos.z = tz; b.facing = b.angToPlayer(); S.model.swing(1, 0.2);
    FX.beam(new V3(ox, 1.2, oz), new V3(tx, 1.2, tz), { color: 0xffffff, width: 0.5, dur: 0.3 }); Sound.sfx('crit'); FX.slash(p.pos.x, 1.2, p.pos.z, b.facing, { r: 3.5, color: 0xffffff, dur: 0.3 });
    p.hurt(520, { blockable: true, src: { name: 'Counter' } });
  }
  function* focus(b) {
    const S = b.state; S.walk = false; S.kneel = 0.4;
    const r = yield* b.cast({ name: 'Thousand-Petal Focus', time: 3.0, interruptible: true, onTick: () => { if (!G.headless && vrand() < 0.5) { const a = vrand() * TAU; FX.burst(b.pos.x + Math.sin(a) * 4, 0.3 + vrand() * 2, b.pos.z + Math.cos(a) * 4, { n: 1, color: ROSE, dir: [-Math.sin(a), 0.1, -Math.cos(a)], spread: 0.1, speed: [5, 8], life: [0.4, 0.6] }); } } });
    S.kneel = 0;
    if (r === 'done') { S.haste = Math.min(3, S.haste + 1); FX.dome(b.pos.x, 1, b.pos.z, { r: 6, color: ROSE, dur: 0.6 }); Sound.sfx('roar', 0.6, 2.2); FX.flash(ROSE, 0.25, 3); }
    yield 0.8;
  }
  function* petalStorm(b, dur = 6.5, arms = 4) {
    const S = b.state; S.walk = false; petals(b.pos.x, b.pos.z, 20); b.pos.set(0, 0, 0); petals(0, 0, 40);
    yield* b.cast({ name: 'Petal Storm', time: 1.2 });
    let t = 0, a0 = rnd(TAU); const dirSign = rnd() < 0.5 ? 1 : -1;
    while (t < dur) { for (let k = 0; k < arms; k++) { const a = a0 + k / arms * TAU; Bul.fire({ x: Math.sin(a) * 1.2, z: Math.cos(a) * 1.2, dir: a, speed: 6.2, dmg: 85, color: 0xff90b0, r: 0.36, life: 3.6 }); Bul.fire({ x: Math.sin(a + 0.16) * 1.2, z: Math.cos(a + 0.16) * 1.2, dir: a + 0.16, speed: 6.2, dmg: 85, color: 0xff90b0, r: 0.36, life: 3.6 }); } a0 += dirSign * 0.105; b.facing += dirSign * 0.9; if (Math.floor(t / 0.36) !== Math.floor((t - 0.12) / 0.36)) S.model.swing(1, 0.3); t += 0.12; yield 0.12; }
    b.facing = b.angToPlayer(); yield 0.7;
  }
  function* finalVerse(b, n = 9) {
    const S = b.state; S.walk = false; yield* b.cast({ name: 'Final Verse', time: 1.1 });
    petals(b.pos.x, b.pos.z, 40); b.targetable = false; b.group.visible = false; Co.start(Post.lerpTo({ sat: 0.55, vig: 1.4 }, 0.4), 'fight');
    for (let i = 0; i < n; i++) {
      const qa = rnd(TAU), qr = i % 3 === 0 ? 0 : rnd(2, 10), p = G.player, qx = i % 3 === 0 ? p.pos.x : Math.sin(qa) * qr, qz = i % 3 === 0 ? p.pos.z : Math.cos(qa) * qr, dir = rnd(TAU), ox = qx - Math.sin(dir) * 20, oz = qz - Math.cos(dir) * 20;
      Hz.rect(ox, oz, dir, 40, 2.1, tele(b, 1.2), 300, { name: 'Final Verse', color: ROSE, quiet: true, silent: true, onFire: () => cutFx(ox, oz, dir, 40, i % 2 ? PALE : 0xffffff) }); Sound.sfx('tick', 1, 1 + i * 0.08);
      yield tele(b, 0.27);
    }
    yield tele(b, 1.2); Co.start(Post.lerpTo({ sat: 1.15, vig: 1.0 }, 0.5), 'fight');
    const p = G.player, a = rnd(TAU); let tx = p.pos.x + Math.sin(a) * 4, tz = p.pos.z + Math.cos(a) * 4; const d = Math.hypot(tx, tz); if (d > 13) { tx *= 13 / d; tz *= 13 / d; }
    b.pos.set(tx, 0, tz); b.group.visible = true; b.targetable = true; petals(tx, tz, 40); b.facing = b.angToPlayer(); yield 0.4;
  }
  function* nightfall(b) {
    const S = b.state, U = S.sky.material.uniforms, WU = S.water.material.uniforms;
    const C = (h) => new THREE.Color(h), top0 = U.uTop.value.clone(), hor0 = U.uHor.value.clone(), sc0 = U.uSunCol.value.clone(), d0 = U.uSunDir.value.clone(), d1 = new V3(-0.22, 0.34, -0.92).normalize(), ws0 = WU.uSky.value.clone(), fog0 = scene.fog.color.clone(), cc0 = U.uCloudCol.value.clone(), cd0 = U.uCloudDark.value.clone(), bl0 = S.blossom.emissive.clone();
    yield* W.tween(4.5, (k) => {
      W.colorLerp(U.uTop.value, top0, C(0x03040f), k); W.colorLerp(U.uHor.value, hor0, C(0x4a0c1c), k); W.colorLerp(U.uSunCol.value, sc0, C(0xff2a2a), k); U.uSunDir.value.lerpVectors(d0, d1, k).normalize(); U.uSunSize.value = lerp(0.1, 0.42, k); U.uStars.value = k * 1.2; U.uSunGlow.value = lerp(1.4, 0.8, k);
      W.colorLerp(U.uCloudCol.value, cc0, C(0x7a2030), k); W.colorLerp(U.uCloudDark.value, cd0, C(0x0a0410), k); U.uCloud.value = lerp(0.5, 0.36, k);
      W.colorLerp(WU.uSky.value, ws0, C(0x7a1422), k); W.colorLerp(scene.fog.color, fog0, C(0x1c0610), k); S.sun.color.setRGB(lerp(1, 1, k), lerp(0.75, 0.3, k), lerp(0.56, 0.32, k)); S.sun.intensity = lerp(3.4, 2.2, k); S.hemi.intensity = lerp(1.0, 0.55, k);
      S.rim.emissiveIntensity = 0.25 + k * 3; W.colorLerp(S.blossom.emissive, bl0, C(0xff2040), k); S.blossom.emissiveIntensity = 0.35 + k * 1.2; S.petals.material.uniforms.uCol.value.setRGB(1.6, 0.5 + 0.2 * (1 - k), 0.6); S.night = k;
    });
  }

  G.bosses.push({
    id: 'duelist', name: 'ISSEN', title: 'The Last Petal', hint: 'A duel', color: '#ff7a9a', telegraph: ROSE,
    hp: 23000, radius: 0.9, aimY: 1.6, enrage: 420,
    post: { bloom: 0.5, threshold: 0.9, radius: 0.8, exposure: 0.95, vig: 0.85, sat: 1.15, tint: [1.06, 1.0, 0.96] },
    music: { bpm: 92, root: 45, scale: [0, 2, 3, 7, 8], prog: [0, 0, 3, 2, 0, 0, 4, 2],
      layers: [
        { v: 'koto', pat: ['0...2...4..3....', '0...4...3..2....'], oct: 1, len: 4, vol: 0.14 }, { v: 'flute', pat: ['........4.......', '7.......5.......'], oct: 2, len: 7, vol: 0.07 },
        { v: 'sub', pat: '0...............', oct: -1, len: 14, vol: 0.2 },
        { v: 'taiko', from: 1, pat: 'x.....x.x.......', vol: 0.3 }, { v: 'koto', from: 1, pat: '0.2.4.2.0.2.4.5.', oct: 2, len: 2, vol: 0.07 }, { v: 'clap', from: 1, pat: '....x.......x...', vol: 0.1 },
        { v: 'taiko', from: 2, pat: 'x..x..x.x..x.xx.', vol: 0.34 }, { v: 'koto', from: 2, pat: '0245420245754202', oct: 2, len: 1, vol: 0.07 }, { v: 'flute', from: 2, pat: ['0.....2.4.......', '5.....4.2.......'], oct: 3, len: 5, vol: 0.08 }, { v: 'hat', from: 2, pat: '..x...x...x...x.', vol: 0.1 },
      ] },
    build,
    *intro(b) { yield* Cam.shot([9, 1.2, 4], [0, 1.8, -5], [2.5, 1.7, -1], [0, 1.9, -5], 3.2, 40); b.state.model.swing(1, 0.4); Sound.sfx('sword'); petals(0, -5, 40); yield 1.0; },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; yield 0.8;
        while (true) {
          yield* drawCut(b, 3); yield* echo(b, 0); S.walk = true; yield 1.2;
          yield* moon(b, ['n', 'o']); S.walk = true; yield 1.0;
          yield* stillness(b); S.walk = true; yield 0.6;
          yield* moon(b, ['c']); yield* drawCut(b, 3); yield* moon(b, ['o', 'n']); yield* echo(b, 0); S.walk = true; yield 1.2;
        }
      } },
      { at: 0.66, *enter(b) { const S = b.state; clearGhosts(S); S.walk = false; petals(b.pos.x, b.pos.z, 60); b.pos.set(0, 0, 0); Sound.sfx('sword', 1, 0.5); FX.dome(0, 1, 0, { r: 9, color: ROSE, dur: 0.8 }); Co.start(Post.lerpTo({ bloom: 0.65, sat: 1.2 }, 2), 'fight'); S.rim.emissiveIntensity = 1.4; yield 1.6; },
        *run(b) {
          const S = b.state;
          while (true) {
            yield* focus(b); yield* drawCut(b, 4); yield* echo(b, 1); S.walk = true; yield 1.0;
            yield* petalStorm(b); yield* moon(b, ['c', 'n', 'o']); S.walk = true; yield 0.8;
            yield* stillness(b); yield* drawCut(b, 4); yield* moon(b, ['o', 'c']); yield* echo(b, 1); S.walk = true; yield 1.0;
          }
        } },
      { at: 0.33, *enter(b) { const S = b.state; clearGhosts(S); S.walk = false; b.pos.set(0, 0, 0); b.facing = 0; S.kneel = 1; Sound.sfx('bell', 0.9, 0.6); Co.start(Post.lerpTo({ bloom: 0.9, threshold: 0.8, tint: [1.1, 0.92, 0.96], exposure: 1.1 }, 4), 'fight'); yield* nightfall(b); S.kneel = 0; Sound.sfx('sword'); petals(0, 0, 80, 0xff3050); yield 0.6; },
        *run(b) {
          const S = b.state;
          while (true) {
            yield* finalVerse(b, 9); yield* moon(b, ['c', 'o']); yield* drawCut(b, 5); yield* echo(b, 2); S.walk = true; yield 0.8;
            yield* focus(b); yield* stillness(b, 3.0); yield* petalStorm(b, 6, 5); yield* moon(b, ['n', 'o', 'c', 'n']); S.walk = true; yield 0.6;
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, ox = b.pos.x, oz = b.pos.z;
      if (S.walk && b.alive && G.state === 'fight' && !b.castState) { const d = b.distToPlayer(); b.facing = dampAng(b.facing, b.angToPlayer(), 8, dt); if (d > 3.2) { const s = Math.min(d - 3.2, 4.6 * dt); b.pos.x += Math.sin(b.facing) * s; b.pos.z += Math.cos(b.facing) * s; } }
      if (S.open > 0) S.open -= dt;
      if (G.headless) return;
      S.fake.moveSpeed = Math.hypot(b.pos.x - ox, b.pos.z - oz) / Math.max(dt, 1e-4) > 20 ? 0 : Math.hypot(b.pos.x - ox, b.pos.z - oz) / Math.max(dt, 1e-4);
      S.fake.casting = b.castState && b.castState.name === 'Thousand-Petal Focus' ? 1 : null;
      S.model.update(dt, S.fake); S.model.group.position.y = damp(S.model.group.position.y, -S.kneel * 0.55, 8, dt); S.model.body.rotation.x += S.kneel * 0.35;
      S.aura.material.opacity = S.still ? 0.5 + 0.4 * Math.sin(G.now * 12) : S.open > 0 ? 0.25 : 0; S.aura.material.color.setHex(S.still ? 0xffffff : 0x70ff90); S.aura.scale.setScalar(S.still ? 1 + 0.15 * Math.sin(G.now * 6) : 1.2);
      for (const gh of S.ghosts) if (gh.g.visible) gh.g.position.y = Math.sin(G.now * 2 + gh.g.position.x) * 0.06;
      S.ghostMat.opacity = 0.3 + 0.15 * Math.sin(G.now * 5);
      if (S.haste && vrand() < dt * 12 * S.haste) FX.burst(b.pos.x, 0.2 + vrand() * 2, b.pos.z, { n: 1, color: 0xff2040, speed: [0.3, 1.2], up: 1.5, life: [0.4, 0.8], radius: 0.5 });
    },
    bot(b) { return { holdFire: b.state.still }; },
  });
})();
