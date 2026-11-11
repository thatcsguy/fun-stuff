// DOOR XIX: PENTIMENTO, the Unfinished Canvas. A blank canvas to the horizon, and the floor keeps every drop of paint.
// You wear what you walk through, and what you are wearing decides what you can hurt.
(() => {
  const R = 20, GN = 80, CELL = 0.5, N = 1024, U = N / (2 * R), WET = 20, RED = 1, YEL = 2, BLU = 4;
  const HEX = [0xffffff, 0xe23a2e, 0xf2c218, 0xf08a1e, 0x2a5fe0, 0x8a3cd0, 0x2aa858, 0x5c4332];
  const CSS = HEX.map((h) => '#' + h.toString(16).padStart(6, '0'));
  const INK = 0x16161e, _c = new THREE.Color(), _a = new V3(), _b = new V3();
  const px = (v) => (v + R) * U, bitsOf = (m) => [RED, YEL, BLU].filter((q) => m & q);
  const need = (S) => S.neg ? 7 ^ S.col : S.col; // in the negative the rule inverts with the world
  const tel = (S) => S.neg ? 0xf4f4ff : INK;

  // ---- the floor: a grid of wet pigment for the rules, a canvas of strokes for the eye ----
  function cells(S, sh, fn) {
    let x0, x1, z0, z1;
    if (sh.t === 'c') { x0 = sh.x - sh.r; x1 = sh.x + sh.r; z0 = sh.z - sh.r; z1 = sh.z + sh.r; }
    else { const ex = sh.x + Math.sin(sh.dir) * sh.len, ez = sh.z + Math.cos(sh.dir) * sh.len, h = sh.w / 2; x0 = Math.min(sh.x, ex) - h; x1 = Math.max(sh.x, ex) + h; z0 = Math.min(sh.z, ez) - h; z1 = Math.max(sh.z, ez) + h; }
    const i0 = clamp(Math.floor((x0 + R) / CELL), 0, GN - 1), i1 = clamp(Math.floor((x1 + R) / CELL), 0, GN - 1), j0 = clamp(Math.floor((z0 + R) / CELL), 0, GN - 1), j1 = clamp(Math.floor((z1 + R) / CELL), 0, GN - 1), fx = Math.sin(sh.dir || 0), fz = Math.cos(sh.dir || 0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = (i + 0.5) * CELL - R, z = (j + 0.5) * CELL - R, dx = x - sh.x, dz = z - sh.z; if (x * x + z * z > R * R) continue;
      if (sh.t === 'c') { if (dx * dx + dz * dz > sh.r * sh.r) continue; } else { const al = dx * fx + dz * fz, sd = dx * fz - dz * fx; if (al < 0 || al > sh.len || Math.abs(sd) > sh.w / 2) continue; }
      fn(j * GN + i);
    }
  }
  function lay(S, sh) { // sh.m = pigment, or 0 to scrape the floor clean
    sh.t0 = G.ft; sh.dry = false; sh.seed = (S.seed = (S.seed + 7919) % 100003);
    cells(S, sh, (k) => { S.pig[k] = sh.m; S.dryAt[k] = sh.m ? G.ft + WET : 0; });
    S.strokes.push(sh); if (G.headless) { S.fresh.length = 0; S.full = true; } else S.fresh.push(sh); if (S.strokes.length > 110) { S.baked.push(S.strokes.shift()); if (S.baked.length > 400) S.baked.shift(); S.full = true; }
  }
  const wetAt = (S, x, z) => { const i = Math.floor((x + R) / CELL), j = Math.floor((z + R) / CELL); if (i < 0 || j < 0 || i >= GN || j >= GN) return 0; const k = j * GN + i; return S.dryAt[k] > G.ft ? S.pig[k] : 0; };
  function stamp(S, x, sh) {
    const r = mulberry(sh.seed), neg = S.neg, wet = !sh.dry;
    x.save(); x.translate(px(sh.x), px(sh.z)); x.rotate(-(sh.dir || 0)); x.scale(U, U);
    if (!sh.m) { x.globalAlpha = 0.93; x.fillStyle = neg ? '#0a0a10' : '#d9d2c2'; if (sh.t === 'c') { x.beginPath(); x.arc(0, 0, sh.r, 0, TAU); x.fill(); } else x.fillRect(-sh.w / 2, 0, sh.w, sh.len); x.restore(); return; }
    x.globalAlpha = wet ? 0.94 : neg ? 0.2 : 0.3; x.fillStyle = CSS[sh.m];
    if (sh.t === 'c') {
      x.beginPath(); for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU, rr = sh.r * (0.9 + r() * 0.14); if (i) x.lineTo(Math.sin(a) * rr, Math.cos(a) * rr); else x.moveTo(Math.sin(a) * rr, Math.cos(a) * rr); } x.fill();
      for (let i = 0; i < 5; i++) { const a = r() * TAU, d = sh.r * (1.0 + r() * 0.35); x.beginPath(); x.arc(Math.sin(a) * d, Math.cos(a) * d, 0.12 + r() * 0.2, 0, TAU); x.fill(); }
    } else {
      x.fillRect(-sh.w / 2, 0, sh.w, sh.len);
      for (let i = 0; i < 14; i++) { const o = (r() - 0.5) * sh.w * 1.12, a = r() * sh.len * 0.8; x.fillRect(o - 0.07, a, 0.14, sh.len * (0.1 + r() * 0.2)); }
    }
    if (wet) { // each pigment has its own mark as well as its own colour: red is hatched, yellow dotted, blue ringed
      x.globalAlpha = 0.3; x.strokeStyle = x.fillStyle = neg ? '#ffffff' : '#000000'; x.lineWidth = 0.09; const L = sh.t === 'c' ? sh.r * 1.4 : sh.len, W2 = sh.t === 'c' ? sh.r * 0.7 : sh.w / 2 - 0.3, y0 = sh.t === 'c' ? -sh.r * 0.7 : 0.4;
      for (let y = y0; y < y0 + L - 0.4; y += 1.5) { if (sh.t !== 'c' && Math.hypot(sh.x + Math.sin(sh.dir) * y, sh.z + Math.cos(sh.dir) * y) > R) continue;
        if (sh.m === RED) { x.beginPath(); x.moveTo(-W2, y); x.lineTo(W2, y + 0.9); x.stroke(); } else if (sh.m === YEL) { for (const o of [-0.6, 0, 0.6]) { x.beginPath(); x.arc(o * W2, y, 0.16, 0, TAU); x.fill(); } } else { x.beginPath(); x.arc(0, y, Math.min(0.5, W2 * 0.6), 0, TAU); x.stroke(); } }
    }
    x.restore();
  }
  function paint(S) {
    const x = S.ctx;
    if (S.full) {
      S.full = false; x.globalAlpha = 1; x.fillStyle = S.neg ? '#07070c' : '#d9d2c2'; x.fillRect(0, 0, N, N);
      if (!S.neg) { x.strokeStyle = 'rgba(120,110,95,0.10)'; x.lineWidth = 1; for (let i = 0; i < N; i += 6) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, N); x.moveTo(0, i); x.lineTo(N, i); x.stroke(); } }
      x.save(); x.beginPath(); x.arc(N / 2, N / 2, R * U, 0, TAU); x.clip(); for (const sh of S.baked) stamp(S, x, sh); for (const sh of S.strokes) stamp(S, x, sh); x.restore();
    } else { x.save(); x.beginPath(); x.arc(N / 2, N / 2, R * U, 0, TAU); x.clip(); for (const sh of S.fresh) stamp(S, x, sh); x.restore(); }
    S.fresh.length = 0; S.tex.needsUpdate = true;
  }

  function limb(mat, len, r) { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat); m.position.y = -len / 2; m.castShadow = true; g.add(m); const j = new THREE.Mesh(new THREE.SphereGeometry(r * 1.25, 12, 8), mat); g.add(j); return g; }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0xb9c2cc, horizon: 0xe6e2d8, bottom: 0xcfc8ba, stars: 0, nebula: 0, sunSize: 0, sunGlow: 0, exp: 0.62 });
    g.add(sky); S.sky = sky; W.env(sky, 0.7);
    scene.fog = new THREE.FogExp2(0xd8d4ca, 0.0045); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0xffffff, 0xb8b0a0, 0.85);
    S.sun = W.sun(g, { dir: [0.2, 1, 0.3], color: 0xfff6e8, intensity: 1.15, size: 30 });
    S.cv = document.createElement('canvas'); S.cv.width = S.cv.height = N; S.ctx = S.cv.getContext('2d'); S.tex = new THREE.CanvasTexture(S.cv); S.tex.colorSpace = THREE.SRGBColorSpace; S.tex.anisotropy = 8;
    S.floorM = new THREE.MeshStandardMaterial({ map: S.tex, emissiveMap: S.tex, emissive: 0x000000, roughness: 0.92, metalness: 0, envMapIntensity: 0.25 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * R, 2 * R), S.floorM); floor.rotation.x = -PI / 2; floor.receiveShadow = true; floor.position.y = 0.01; g.add(floor);
    S.groundM = new THREE.MeshStandardMaterial({ color: 0xd9d2c2, roughness: 0.95, metalness: 0 }); const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 48), S.groundM); ground.rotation.x = -PI / 2; g.add(ground);
    // the arena is a circle the size of his reach: a charcoal line, and stretcher tacks around it
    S.rimM = new THREE.MeshBasicMaterial({ color: 0x2a2a30 }); const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.1, 0.09, 6, 120), S.rimM); rim.rotation.x = PI / 2; rim.position.y = 0.04; g.add(rim);
    const wood = W.mat({ color: 0xb08a58, roughness: 0.7, metalness: 0 }), dkwood = W.mat({ color: 0x6a4a2a, roughness: 0.75, metalness: 0 });
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(5, 150, 5), dkwood); leg.position.set(sx * 62, 60, -120); leg.rotation.x = -0.12; g.add(leg); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(170, 6, 9), dkwood); bar.position.set(0, 3, -112); g.add(bar);
    // pencil construction lines of a landscape that has not been painted yet (and, later, the paint)
    S.pencilM = new THREE.LineBasicMaterial({ color: 0x8a8a90, transparent: true, opacity: 0.55 }); S.mtnM = new THREE.MeshBasicMaterial({ color: 0x6a3a78, transparent: true, opacity: 0, fog: false }); S.mtn2M = new THREE.MeshBasicMaterial({ color: 0xe8703a, transparent: true, opacity: 0, fog: false });
    const r = mulberry(1907);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + r() * 0.2, d = 90 + r() * 70, h = 26 + r() * 46, w = 28 + r() * 30, geo = new THREE.ConeGeometry(w, h, 5 + Math.floor(r() * 3), 2); const x = Math.sin(a) * d, z = Math.cos(a) * d;
      const ln = new THREE.LineSegments(new THREE.WireframeGeometry(geo), S.pencilM); ln.position.set(x, h / 2 - 1, z); ln.rotation.y = r() * 3; g.add(ln); const m = new THREE.Mesh(geo, i % 2 ? S.mtnM : S.mtn2M); m.position.copy(ln.position); m.rotation.y = ln.rotation.y; m.scale.setScalar(0.985); g.add(m); }
    S.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(16, 40), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0, fog: false })); S.sunDisc.position.set(-40, 24, -190); g.add(S.sunDisc);
    // wash water, the aura you wear, and the roller
    S.washM = new THREE.MeshStandardMaterial({ color: 0x9fd8f0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75, envMapIntensity: 1.6 }); S.washG = new THREE.Group(); const wd = new THREE.Mesh(new THREE.CircleGeometry(2.5, 40), S.washM); wd.rotation.x = -PI / 2; wd.position.y = 0.05; S.washG.add(wd);
    const wr = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 40), W.mat({ color: 0xe8e4dc, roughness: 0.3, metalness: 0.1 })); wr.rotation.x = PI / 2; wr.position.y = 0.08; S.washG.add(wr); g.add(S.washG);
    S.auraM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }); S.aura = new THREE.Group(); const ar = new THREE.Mesh(new THREE.RingGeometry(0.72, 1.02, 40), S.auraM); ar.rotation.x = -PI / 2; ar.position.y = 0.07; S.aura.add(ar);
    S.drop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), S.auraM); S.drop.position.y = 2.75; S.drop.scale.y = 1.4; S.aura.add(S.drop); S.aura.visible = false; g.add(S.aura);
    S.rollM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 }); S.rollG = new THREE.Group(); const rc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 12, 24), S.rollM); rc.rotation.z = PI / 2; rc.position.y = 0.95; rc.castShadow = true; S.rollG.add(rc);
    const rh = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.16, 0.16), dkwood); rh.position.set(0, 2.3, -0.6); S.rollG.add(rh); S.rollG.visible = false; g.add(S.rollG); S.rollC = rc;
    S.blotG = new THREE.SphereGeometry(0.75, 14, 10); S.blotM = [RED, YEL, BLU].map((m) => new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.15, metalness: 0.3, emissive: HEX[m], emissiveIntensity: 0.5 }));
    // ---- Pentimento: an artist's lay figure with a brush the length of a halberd ----
    S.rig = new THREE.Group(); b.group.add(S.rig);
    S.smockM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.12 });
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), wood); hips.position.y = 2.45; S.rig.add(hips);
    const smock = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 1.05, 2.1, 16), S.smockM); smock.position.y = 3.25; smock.castShadow = true; S.rig.add(smock);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), S.smockM); chest.position.y = 4.2; chest.scale.y = 0.8; S.rig.add(chest);
    S.head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), wood); S.head.scale.y = 1.25; S.head.position.y = 5.2; S.head.castShadow = true; S.rig.add(S.head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 8), wood); neck.position.y = 4.75; S.rig.add(neck);
    S.legs = [-1, 1].map((sx) => { const l = limb(wood, 2.3, 0.22); l.position.set(sx * 0.36, 2.4, 0); S.rig.add(l); return l; });
    S.armR = limb(wood, 1.9, 0.18); S.armR.position.set(0.85, 4.35, 0); S.rig.add(S.armR); S.armL = limb(wood, 1.9, 0.18); S.armL.position.set(-0.85, 4.35, 0); S.armL.rotation.set(-0.5, 0, -0.5); S.rig.add(S.armL);
    S.brush = new THREE.Group(); S.brush.position.y = -2.0; S.armR.add(S.brush); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.4, 8), dkwood); pole.rotation.x = PI / 2; pole.position.z = 1.4; S.brush.add(pole);
    const fer = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.5, 10), W.mat({ color: 0xb0b4bc, roughness: 0.3, metalness: 0.9 })); fer.rotation.x = PI / 2; fer.position.z = 4.2; S.brush.add(fer);
    S.tipM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.35 }); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 12), S.tipM); tip.rotation.x = PI / 2; tip.position.z = 4.95; S.brush.add(tip);
    const pal = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.07, 24), wood); pal.position.y = -2.0; pal.rotation.z = 1.2; S.armL.add(pal);
    [RED, YEL, BLU].forEach((m, i) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), W.mat({ color: HEX[m], roughness: 0.3, metalness: 0 })); d.position.set(Math.sin(i * 1.3) * 0.5, 0.06, Math.cos(i * 1.3) * 0.5); d.scale.y = 0.4; pal.add(d); });
    S.varnM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.2, envMapIntensity: 2.2, depthWrite: false }); S.varn = new THREE.Mesh(new THREE.SphereGeometry(3.3, 28, 18), S.varnM); S.varn.position.y = 2.9; S.varn.scale.y = 1.05; b.group.add(S.varn);
    S.light = new THREE.PointLight(0xffffff, 0, 24, 1.6); S.light.position.set(0, 5, 0); b.group.add(S.light);
    Object.assign(S, { pig: new Uint8Array(GN * GN), dryAt: new Float32Array(GN * GN), strokes: [], baked: [], fresh: [], full: true, seed: 11, neg: false, col: RED, wear: 0, wearK: 0, lvl: 0, wash: { x: 0, z: 16.2, r: 2.5 }, roll: null, down: 0, swing: 0, look: 0, lookT: 0, bag: [], dryT: 0, scanT: 0, goal: null, flood: 0, blots: 0, blotList: [], match: 0 });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 12 }, bossStart: { x: 0, z: -3, face: 0 }, camDist: 17, camPitch: 0.55,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
    };
  }

  const nextPig = (S) => { if (!S.bag.length) S.bag = shuffle([RED, YEL, BLU]); return S.bag.pop(); };
  function tint(S, m, loud) { if ((S.wear | m) === S.wear) return; S.wear |= m; S.wearK = 1; if (loud !== false) Sound.sfx('wave', 0.5, 1.5); }
  function* recolor(b, c) {
    const S = b.state; S.flood = 1;
    yield* b.cast({ name: 'Fresh Coat', time: 1.3 }); S.col = c; S.flood = 0; Sound.sfx('wave', 0.9, 0.7); FX.flash(HEX[c], 0.16, 3);
    if (!G.headless) FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: 9, color: HEX[c], dur: 0.5 }); yield 0.5;
  }
  function stripe(b, m, x, z, a, w, delay, dmg, name) {
    const S = b.state, x0 = x - Math.sin(a) * 22, z0 = z - Math.cos(a) * 22;
    Hz.rect(x0, z0, a, 44, w, delay, dmg, { name, color: tel(S), onFire() { lay(S, { t: 'r', x: x0, z: z0, dir: a, len: 44, w, m }); S.swing = 1; if (!G.headless && m) FX.burst(x, 0.4, z, { n: 24, color: HEX[m], speed: [2, 9], life: [0.3, 0.8] }); }, onHit() { if (m && S.lvl >= 1) tint(S, m); } });
  }
  function* strokes(b, pigs) {
    const S = b.state, p = G.player; let a = rnd(0, PI);
    for (const m of pigs) { yield* b.cast({ name: 'Stroke', time: 0.45 }); stripe(b, m, p.pos.x + rnd(-1.5, 1.5), p.pos.z + rnd(-1.5, 1.5), a, 3, 1.0, 280, 'Stroke'); a += PI / 3 + rnd(-0.3, 0.3); yield 0.75; }
    yield 0.7;
  }
  function* splatter(b, n) {
    const S = b.state, p = G.player; yield* b.cast({ name: 'Splatter', time: 0.7 });
    for (let i = 0; i < n; i++) { const m = nextPig(S), a = rnd(0, TAU), d = i === 0 ? 0 : rnd(3, 8), x = clamp(p.pos.x + Math.sin(a) * d, -17, 17), z = clamp(p.pos.z + Math.cos(a) * d, -17, 17);
      Hz.circle(x, z, 2.6, 1.25, 220, { name: 'Splatter', color: tel(S), onFire() { lay(S, { t: 'c', x, z, r: 2.6, m }); }, onHit() { if (S.lvl >= 1) tint(S, m); } }); yield 0.28; }
    yield 1.1;
  }
  function* drips(b, n) {
    const S = b.state, p = G.player;
    for (let i = 0; i < n; i++) { const m = nextPig(S), a = rnd(0, TAU), d = rnd(1, 9), x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if (Math.hypot(x, z) > R - 1) continue;
      Hz.circle(x, z, 1.7, 2.0, 160, { name: 'Drip', color: tel(S), quiet: true, onFire() { lay(S, { t: 'c', x, z, r: 1.7, m }); }, onHit() { if (S.lvl >= 1) tint(S, m); } }); yield 0.4; }
  }
  function* roller(b) {
    const S = b.state, p = G.player, m = nextPig(S), a = rnd(0, TAU), fx = Math.sin(a), fz = Math.cos(a), off = clamp(p.pos.x * fz - p.pos.z * fx, -9, 9), cx = fz * off, cz = -fx * off;
    yield* b.cast({ name: 'Roller', time: 0.8 }); Hz.rect(cx - fx * 22, cz - fz * 22, a, 44, 12, 1.3, 0, { name: 'Roller', color: tel(S), quiet: true });
    S.rollM.color.setHex(HEX[m]); S.roll = { a, fx, fz, cx, cz, s: -24, v: 11, m, hit: false, laid: -22 }; yield 1.3; Sound.sfx('wave', 0.8, 0.5);
    const q = S.roll; while (q.s < 22) { q.s += q.v * G.dt;
      if (p.alive && !q.hit && p.pos.y < 0.5) { const dx = p.pos.x - q.cx, dz = p.pos.z - q.cz, al = dx * fx + dz * fz, sd = dx * fz - dz * fx; if (Math.abs(al - q.s) < 1.0 && Math.abs(sd) < 6) { q.hit = true; p.hurt(300, { blockable: true, kb: { dir: a, dist: 4 }, src: { name: 'Roller' } }); if (S.lvl >= 1) tint(S, m); } }
      if (q.s - q.laid >= 5.5 || q.s >= 22) { const e = Math.min(q.s - 1, 22); if (e > q.laid) { lay(S, { t: 'r', x: q.cx + fx * q.laid, z: q.cz + fz * q.laid, dir: a, len: e - q.laid, w: 12, m }); q.laid = e; } }
      yield; }
    S.roll = null; yield 0.5;
  }
  function* knife(b) {
    const S = b.state, p = G.player; let a = rnd(0, PI);
    yield* b.cast({ name: 'Palette Knife', time: 0.7 });
    for (let i = 0; i < 3; i++) { stripe(b, 0, p.pos.x + rnd(-2, 2), p.pos.z + rnd(-2, 2), a, 2.4, 0.95, 260, 'Palette Knife'); a += PI / 3; yield 0.5; }
    yield 1.0;
  }
  function blot(b, m) {
    const S = b.state; if (S.blots >= 2) return; S.blots++; const a = rnd(0, TAU), x = Math.sin(a) * 15, z = Math.cos(a) * 15, mesh = new THREE.Mesh(S.blotG, S.blotM[[RED, YEL, BLU].indexOf(m)]); mesh.position.y = 0.7; mesh.castShadow = true;
    let lt = 0, cd = 0;
    const ent = b.spawnAdd({ name: 'Blot', hp: 280, x, z, radius: 0.85, aimY: 0.8, mesh, color: HEX[m], onDeath(e) { S.blots--; S.blotList = S.blotList.filter((q) => q !== e); lay(S, { t: 'c', x: e.pos.x, z: e.pos.z, r: 2.2, m }); },
      update(e, dt) { const p = G.player, d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z); if (d > 0.9) { e.pos.x += (p.pos.x - e.pos.x) / d * 3.1 * dt; e.pos.z += (p.pos.z - e.pos.z) / d * 3.1 * dt; e.group.position.copy(e.pos); }
        lt -= dt; if (lt <= 0) { lt = 0.55; lay(S, { t: 'c', x: e.pos.x, z: e.pos.z, r: 1.05, m }); } if (d < 1.35 && cd <= 0 && p.alive && e.alive) { cd = 9; p.hurt(140, { blockable: true, src: { name: 'Blot' } }); tint(S, m); e.damage(e.hp + 1, { src: 'self' }); }
        mesh.scale.set(1 + Math.sin(G.now * 7) * 0.12, 0.8 - Math.sin(G.now * 7) * 0.1, 1 + Math.cos(G.now * 6) * 0.12); } });
    S.blotList.push(ent); Sound.sfx('cast', 0.5, 0.6);
  }
  function* critique(b, T) {
    const S = b.state, p = G.player; S.crit = T;
    yield* b.cast({ name: 'Critique', time: T, onTick(k, cs) { S.crit = T - cs.t; } }); S.crit = 0;
    if (S.wear === need(S)) { S.down = 5; b.exposed = 5; Sound.sfx('shatter', 0.9, 0.9); Sound.sfx('parry', 0.9, 0.6); FX.flash(0xffffff, 0.2, 3); FX.shake(0.5); b.damage(Math.round(b.maxHp * 0.03), { src: 'player', crit: true }); if (!G.headless) FX.explode(b.pos.x, 3, b.pos.z, HEX[S.wear] || 0xffffff, 3); yield 5; S.down = 0; }
    else { if (p.alive) p.hurt(350, { blockable: false, src: { name: 'Critique' } }); Sound.sfx('bigboom', 0.7); FX.flash(tel(S), 0.25, 2); FX.shake(0.6); if (!G.headless) FX.beam(new V3(b.pos.x, 4, b.pos.z), new V3(p.pos.x, 1, p.pos.z), { color: S.neg ? 0xffffff : 0x202028, width: 0.9, dur: 0.35 }); yield 1.0; }
  }
  function* wander(b) { const a = rnd(0, TAU), d = rnd(0, 6); yield* b.moveTo(Math.sin(a) * d, Math.cos(a) * d, 5); }
  // one colour's worth of fight: he floods with it, lays down what you need and what you must not touch, then judges you
  function* block(b, c, k) {
    const S = b.state, lvl = S.lvl; yield* recolor(b, c);
    const nb = bitsOf(need(S)), others = [RED, YEL, BLU].filter((m) => nb.indexOf(m) < 0);
    yield* strokes(b, shuffle(nb.concat(others).slice(0, 3)));
    if (lvl >= 1 && k % 2 === 0) blot(b, pick(others.length ? others : nb));
    if (k % 3 === 0) yield* splatter(b, lvl >= 1 ? 4 : 3); else if (k % 3 === 1 && lvl >= 1) yield* roller(b); else yield* drips(b, 5);
    Co.start(function* () { yield 1.2; if (lvl >= 2) yield* drips(b, 4); else if (lvl === 1) yield* drips(b, 2); }, 'phase');
    yield* critique(b, lvl >= 2 ? 4.5 : 5);
    yield* wander(b);
    if (lvl >= 1 && k % 2 === 1) yield* knife(b); else yield* splatter(b, 3);
    if (lvl >= 2) { yield* strokes(b, shuffle(nb.concat(others)).slice(0, 2)); yield* critique(b, 4.5); }
    else yield* strokes(b, [nextPig(S), nextPig(S)]);
  }
  function setLvl(b, n) { const S = b.state; S.lvl = n; S.lookT = n; S.down = 0; S.roll = null; S.crit = 0; S.flood = 0; if ((n >= 2) !== S.neg) { S.neg = n >= 2; S.full = true; } }
  function moveWash(S) { const a = rnd(0, TAU); S.wash = { x: Math.sin(a) * 16.2, z: Math.cos(a) * 16.2, r: 2.5 }; S.washK = 0; }

  G.bosses.push({
    id: 'atelier', name: 'PENTIMENTO', title: 'The Unfinished Canvas', hint: 'Wet paint', color: '#f0e8d8', telegraph: INK,
    hp: 31000, radius: 1.5, aimY: 3.6, enrage: 450,
    post: { bloom: 0.22, threshold: 0.97, radius: 0.6, exposure: 0.92, vig: 0.7, sat: 1.08, contrast: 1.04, tint: [1.0, 1.0, 1.0] },
    music: { bpm: 100, root: 43, scale: [0, 2, 4, 7, 9, 11, 12], prog: [0, 3, 4, 0, 5, 3, 1, 4],
      layers: [
        { v: 'flute', pat: ['0...2...4.....2.', '4...2...0.......'], oct: 1, len: 4, vol: 0.07, to: 1 }, { v: 'bell', pat: '0.....4...2.....', oct: 1, len: 6, vol: 0.06, to: 1 }, { v: 'pad', pat: '0...............', len: 16, vol: 0.09 },
        { v: 'kick', from: 1, to: 1, pat: 'x.....x.x.......', vol: 0.2 }, { v: 'tom', from: 1, to: 1, pat: '....x.......x.x.', vol: 0.12 }, { v: 'koto', from: 1, to: 1, pat: '0.2.4.2.0.4.2.4.', oct: 0, len: 1, vol: 0.06 }, { v: 'bass', from: 1, pat: '0.......0...4...', oct: -1, len: 3, vol: 0.12 },
        { v: 'sub', from: 2, pat: '0.......0.......', oct: -2, len: 6, vol: 0.16 }, { v: 'pulse', from: 2, pat: '0.0.4.0.0.0.2.0.', oct: 0, len: 1, vol: 0.06 }, { v: 'kick', from: 2, pat: 'x...x...x...x.x.', vol: 0.22 }, { v: 'choir', from: 2, pat: '0.......4.......', oct: 1, len: 8, vol: 0.06 },
      ] },
    build,
    *intro(b) { Sound.sfx('wave', 0.7, 0.5); yield* Cam.shot([-14, 22, 26], [0, 2, 0], [4, 4.5, 8], [0, 3.8, -3], 5.2, 46); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setLvl(b, 0); yield 1.0; let k = 0; const seq = shuffle([RED, YEL, BLU]).concat(shuffle([3, 5, 6]));
        while (true) { yield* block(b, seq[k % seq.length], k); k++; }
      } },
      { at: 0.66, skipTo(b) { b.state.look = 1; }, *enter(b) {
        const S = b.state; setLvl(b, 0); S.lookT = 1;
        yield* b.cast({ name: 'Colour', time: 3.0, onTick: (k) => { FX.shake(k * 0.2); } });
        Sound.sfx('wave', 1, 0.4); Sound.sfx('roar', 0.4, 1.5); FX.flash(0xffb060, 0.3, 1.5); Co.start(Post.lerpTo({ tint: [1.05, 0.99, 0.95], sat: 1.15 }, 3), 'fight'); yield 1.0;
      }, *run(b) {
        const S = b.state; setLvl(b, 1); let k = 0, last = S.col;
        while (true) { const c = pick([1, 2, 4, 3, 5, 6].filter((q) => q !== last)); last = c; yield* block(b, c, k); k++; }
      } },
      { at: 0.33, skipTo(b) { b.state.look = 2; }, *enter(b) {
        const S = b.state; setLvl(b, 1); S.lookT = 2;
        yield* b.cast({ name: 'Negative', time: 3.2, onTick: (k) => { FX.shake(k * 0.45); } });
        setLvl(b, 2); Sound.sfx('shatter', 1, 0.4); Sound.sfx('bigboom', 0.9); FX.flash(0x000000, 0.5, 1.2); Co.start(Post.lerpTo({ bloom: 0.6, threshold: 0.8, exposure: 1.0, tint: [1.0, 1.0, 1.04], contrast: 1.1 }, 1.5), 'fight'); yield 1.4;
      }, *run(b) {
        const S = b.state; setLvl(b, 2); let k = 0, last = S.col;
        while (true) { const c = pick([1, 2, 4, 3, 5, 6].filter((q) => q !== last)); last = c; yield* block(b, c, k); k++; }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight' && p && p.alive;
      if (S.down > 0) S.down -= dt; S.washT = (S.washT || 0) + dt; if (S.washT > 18) { S.washT = 0; moveWash(S); }
      if (fight) {
        const inWash = Math.hypot(p.pos.x - S.wash.x, p.pos.z - S.wash.z) < S.wash.r;
        if (inWash) { if (S.wear) { S.wear = 0; S.wearK = 1; Sound.sfx('heal', 0.5, 1.6); } }
        else if (p.grounded && p.pos.y < 0.15) { const m = wetAt(S, p.pos.x, p.pos.z); if (m) tint(S, m); }
        p.speedMul = S.wear === 7 ? 0.8 : 1; const ok = S.wear === need(S); b.dmgTaken = ok ? 1.3 : 0.35; if (ok) S.match += dt;
      }
      S.dryT -= dt; if (S.dryT <= 0) { S.dryT = 0.5; for (const sh of S.strokes) if (!sh.dry && sh.m && G.ft - sh.t0 > WET) { sh.dry = true; S.full = true; } }
      if (G.headless) return;
      if (S.full || S.fresh.length) paint(S);
      S.look = damp(S.look, S.lookT, 0.7, dt); const k1 = sat(S.look), k2 = sat(S.look - 1), Uu = S.sky.material.uniforms;
      Uu.uTop.value.setHex(0xb9c2cc).lerp(_c.setHex(0x5a4a9a), k1).lerp(_c.setHex(0x000000), k2); Uu.uHor.value.setHex(0xe6e2d8).lerp(_c.setHex(0xffa860), k1).lerp(_c.setHex(0x05050a), k2); Uu.uBot.value.setHex(0xcfc8ba).lerp(_c.setHex(0xc8a888), k1).lerp(_c.setHex(0x000000), k2);
      S.mtnM.opacity = k1 * 0.9; S.mtn2M.opacity = k1 * 0.85; S.mtnM.color.setHex(0x6a3a78).lerp(_c.setHex(0xd0b0ff), k2); S.mtn2M.color.setHex(0xe8703a).lerp(_c.setHex(0x60d0ff), k2); S.sunDisc.material.opacity = k1; S.sunDisc.material.color.setHex(0xffb060).lerp(_c.setHex(0x80b0ff), k2);
      S.pencilM.color.setHex(0x8a8a90).lerp(_c.setHex(0xe0e0f0), k2); S.rimM.color.setHex(0x2a2a30).lerp(_c.setHex(0xf0f0ff), k2);
      S.hemi.intensity = lerp(0.85, 0.28, k2); S.sun.intensity = lerp(1.15, 0.3, k2); S.fog.color.setHex(0xd8d4ca).lerp(_c.setHex(0xe0b090), k1).lerp(_c.setHex(0x020204), k2);
      S.groundM.color.setHex(0xd9d2c2).lerp(_c.setHex(0x07070c), k2); S.floorM.emissive.setScalar(S.neg ? 0.95 : 0);
      const cc = S.flood ? 0xffffff : HEX[S.col]; S.fl = damp(S.fl || 0, S.flood ? 1 : 0, 6, dt);
      S.smockM.color.setHex(cc); S.smockM.emissive.setHex(cc); S.smockM.emissiveIntensity = (S.neg ? 0.7 : 0.14) + S.fl * 0.6; S.tipM.color.setHex(cc); S.tipM.emissive.setHex(cc); S.tipM.emissiveIntensity = S.neg ? 1.2 : 0.3;
      S.light.color.setHex(cc); S.light.intensity = S.neg ? 26 : 5 + S.fl * 14;
      const ok = S.wear === need(S); S.vk = damp(S.vk === undefined ? 1 : S.vk, ok || S.down > 0 ? 0 : 1, 6, dt); S.varn.visible = S.vk > 0.02; S.varnM.opacity = 0.2 * S.vk; S.varn.rotation.y += dt * 0.3;
      S.swing = Math.max(0, S.swing - dt * 2.4); const dn = S.down > 0 ? 1 : 0; S.dnK = damp(S.dnK || 0, dn, 6, dt); const cast = b.castState ? 1 : 0; S.ck = damp(S.ck || 0, cast, 5, dt);
      S.armR.rotation.set(-0.6 - S.ck * 1.3 + S.swing * 1.9, 0, 0.25 - S.swing * 0.8); S.brush.rotation.x = 0.4 + S.swing * 0.6; S.armL.rotation.set(-0.5 + Math.sin(t * 1.1) * 0.06, 0, -0.5 - S.dnK * 0.8);
      S.rig.rotation.x = S.dnK * 0.5 + Math.sin(t * 0.9) * 0.02; S.rig.position.y = -S.dnK * 0.5; S.head.rotation.z = Math.sin(t * 0.7) * 0.12 + (S.crit > 0 ? 0.3 : 0); S.legs.forEach((l, i) => { l.rotation.x = (i ? 1 : -1) * 0.08 - S.dnK * 0.4; });
      S.washK = damp(S.washK || 0, 1, 3, dt); S.washG.position.set(S.wash.x, 0, S.wash.z); S.washG.scale.setScalar(Math.max(0.01, S.washK)); S.washM.color.setHex(S.neg ? 0x305880 : 0x9fd8f0);
      S.wearK = Math.max(0, S.wearK - dt * 2); S.aura.visible = !!p && S.wear > 0; if (p && S.wear) { S.aura.position.set(p.pos.x, 0, p.pos.z); S.drop.position.y = p.pos.y + 2.75 + Math.sin(t * 3) * 0.08; S.auraM.color.setHex(HEX[S.wear]).multiplyScalar(S.neg ? 2.2 : 1 + S.wearK * 0.6); S.aura.scale.setScalar(1 + S.wearK * 0.5); }
      S.rollG.visible = !!S.roll; if (S.roll) { const q = S.roll; S.rollG.position.set(q.cx + q.fx * q.s, 0, q.cz + q.fz * q.s); S.rollG.rotation.y = q.a; S.rollC.rotation.x += dt * q.v; }
    },
    danger(b, x, z) {
      const S = b.state, q = S.roll; if (!q) return Infinity; const dx = x - q.cx, dz = z - q.cz, al = dx * q.fx + dz * q.fz, sd = dx * q.fz - dz * q.fx;
      if (Math.abs(sd) > 6.4 || al < q.s - 1) return Infinity; return Math.max(0.05, (al - q.s - 1) / q.v + (q.s < -22 ? 0.4 : 0));
    },
    bot(b, p) {
      const S = b.state, out = {}, nd = need(S), miss = nd & ~S.wear, extra = S.wear & ~nd, q = S.roll;
      if (q) { const dx = p.pos.x - q.cx, dz = p.pos.z - q.cz, al = dx * q.fx + dz * q.fz, sd = dx * q.fz - dz * q.fx, tt = (al - q.s - 1) / q.v; if (Math.abs(sd) < 6.3 && tt > 0 && tt < 0.2) p.jump(); }
      const bad = (x, z) => { const m = wetAt(S, x, z); return !!m && (m & ~nd) !== 0 && !(Math.hypot(x - S.wash.x, z - S.wash.z) < S.wash.r); };
      // hop over paint you must not touch
      if (p.grounded && p.moving && !bad(p.pos.x, p.pos.z)) { const l = Math.hypot(p.intentX, p.intentZ) || 1; if (bad(p.pos.x + p.intentX / l * 1.1, p.pos.z + p.intentZ / l * 1.1)) p.jump(); }
      out.avoid = bad; if (S.blotList.length) out.target = S.blotList.reduce((a, e) => Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) ? e : a);
      if (extra) { out.x = S.wash.x * 0.97; out.z = S.wash.z * 0.97; out.w = 4; return out; }
      if (miss) {
        S.scanT -= G.dt; if (S.scanT <= 0 || !S.goal) { S.scanT = 0.3; let best = null, bd = Infinity; for (let j = 0; j < GN; j += 1) for (let i = 0; i < GN; i += 1) { const k = j * GN + i, m = S.dryAt[k] > G.ft + 0.5 ? S.pig[k] : 0; if (!m || (m & ~nd) || !(m & miss)) continue; const x = (i + 0.5) * CELL - R, z = (j + 0.5) * CELL - R, d = Math.hypot(x - p.pos.x, z - p.pos.z); if (Math.hypot(x - S.wash.x, z - S.wash.z) < S.wash.r + 0.4) continue; if (d < bd) { bd = d; best = { x, z }; } } S.goal = best; }
        if (S.goal) { out.x = S.goal.x; out.z = S.goal.z; out.w = 4; }
      } else S.goal = null;
      return out;
    },
  });
})();
