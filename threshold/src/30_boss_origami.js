// DOOR XI: ORIKO, the Thousandth Fold. A sheet of paper over a painted void. The sheet folds, and wet ink prints.
(() => {
  const H = 15, RED = 0xe8402a, INK = 0x0b0d1c, NB = 20, CELL = (H * 2) / NB;
  const _a = new V3(), _b = new V3(), _c = new THREE.Color();
  const inSq = (x, z, m = 0) => Math.abs(x) <= H - m && Math.abs(z) <= H - m;
  const side = (f, x, z) => (x - f.cx) * f.nx + (z - f.cz) * f.nz;            // > 0: the part that stays, < 0: the flap
  const refl = (f, x, z) => { const d = side(f, x, z); return [x - 2 * d * f.nx, z - 2 * d * f.nz]; };
  const reflDir = (f, a) => { const dx = Math.sin(a), dz = Math.cos(a), k = dx * f.nx + dz * f.nz; return Math.atan2(dx - 2 * k * f.nx, dz - 2 * k * f.nz); };
  const inBlot = (q, x, z) => { if (q.bar) { const fx = Math.sin(q.dir), fz = Math.cos(q.dir), dx = x - q.x, dz = z - q.z; return Math.abs(dx * fx + dz * fz) <= q.len / 2 && Math.abs(dx * fz - dz * fx) <= q.w / 2; } return Math.hypot(x - q.x, z - q.z) <= q.r; };
  const mirror = (f, q) => { const [x, z] = refl(f, q.x, q.z); return q.bar ? { bar: true, x, z, dir: reflDir(f, q.dir), len: q.len, w: q.w } : { x, z, r: q.r }; };
  const burnIdx = (x, z) => { const i = Math.floor((x + H) / CELL), j = Math.floor((z + H) / CELL); return i < 0 || j < 0 || i >= NB || j >= NB ? -1 : j * NB + i; };

  // convex polygon helpers (the sheet is always convex)
  function clipPoly(P, f, keepBase) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length], da = side(f, A[0], A[1]) * (keepBase ? 1 : -1), db = side(f, B[0], B[1]) * (keepBase ? 1 : -1);
      if (da >= 0) out.push(A);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
    }
    return out;
  }
  function polyGeo(P, map) {
    const pos = [], uv = [], nor = [];
    for (let i = 1; i + 1 < P.length; i++) {
      let T = [P[0], P[i], P[i + 1]].map((q) => ({ w: q, l: map ? map(q[0], q[1]) : [q[0], q[1]] }));
      const a = T[0].l, b = T[1].l, c = T[2].l; if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) < 0) T = [T[0], T[2], T[1]];
      for (const q of T) { pos.push(q.l[0], 0, q.l[1]); nor.push(0, 1, 0); uv.push((q.w[0] + H) / (2 * H), (q.w[1] + H) / (2 * H)); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
  }
  const SQUARE = () => [[-H, -H], [H, -H], [H, H], [-H, H]];

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0xcfc8b6, horizon: 0xefe6d2, bottom: 0xa8a090, stars: 0, sunDir: [-0.25, 0.32, -0.9], sunColor: 0xe03a20, sunSize: 0.085, sunGlow: 0.25, clouds: 0.25, cloudColor: 0xf6f0e2, cloudDark: 0x9a9484, cloudSpeed: 0.004 });
    g.add(sky); S.sky = sky; W.env(sky, 0.8);
    scene.fog = new THREE.FogExp2(0xd8d0bc, 0.007); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0xfff4e0, 0x8a8478, 0.85);
    S.sun = W.sun(g, { dir: [-0.35, 0.9, -0.35], color: 0xfff0dc, intensity: 2.3, size: 26 });
    S.fire = new THREE.DirectionalLight(0xff6a20, 0); S.fire.position.set(0, -20, 30); g.add(S.fire); g.add(S.fire.target);
    // brush-stroke mountains
    const vr = mulberry(19);
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + vr() * 0.3, d = 150 + vr() * 160, h = 50 + vr() * 110, sh = 0.16 + (d - 150) / 160 * 0.3; const mm = new THREE.MeshBasicMaterial({ color: new THREE.Color(sh, sh, sh * 1.05) }); mm.userData.base = mm.color.clone(); (S.mtn = S.mtn || []).push(mm); const m = new THREE.Mesh(new THREE.ConeGeometry(30 + vr() * 50, h, 4), mm); m.position.set(Math.sin(a) * d, h / 2 - 70, Math.cos(a) * d); m.rotation.y = vr() * 3; m.scale.z = 0.4; g.add(m); }
    const mist = new THREE.Mesh(new THREE.CircleGeometry(600, 40), new THREE.MeshBasicMaterial({ color: 0xe6dfcc, transparent: true, opacity: 0.85 })); mist.rotation.x = -PI / 2; mist.position.y = -60; g.add(mist); S.mist = mist;
    S.motes = W.motes({ n: 240, box: [70, 30, 70], color: 0xffffff, size: 0.3, vel: [0.5, -0.25, 0.2], sway: 1.2, center: [0, 8, 0], alpha: 0.7 }); g.add(S.motes);

    // the sheet. One burn map drives holes (alpha) and embers (emissive) on every piece of paper.
    S.burn = new Float32Array(NB * NB); S.alphaD = new Uint8Array(NB * NB * 4).fill(255); S.emisD = new Uint8Array(NB * NB * 4);
    S.alphaT = new THREE.DataTexture(S.alphaD, NB, NB); S.alphaT.magFilter = S.alphaT.minFilter = THREE.LinearFilter; S.alphaT.needsUpdate = true;
    S.emisT = new THREE.DataTexture(S.emisD, NB, NB); S.emisT.magFilter = S.emisT.minFilter = THREE.LinearFilter; S.emisT.colorSpace = THREE.SRGBColorSpace; S.emisT.needsUpdate = true;
    const fib = W.bake(512, (u, v) => { const n = W.fbm(u * 6, v * 6, 5, 4, 6), s = W.fbm(u * 60, v * 9, 9, 3, 60); return [n * 0.4 + s * 0.3, sat(0.75 + n * 0.25 - (s > 0.72 ? 0.2 : 0)), 0.9]; }, { dark: 0xc8c0b0, light: 0xffffff, strength: 1.5 });
    S.paperM = new THREE.MeshStandardMaterial({ map: fib.map, normalMap: fib.normalMap, color: 0xd9d0bb, roughness: 0.92, alphaMap: S.alphaT, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: S.emisT, emissiveIntensity: 2.2, side: THREE.DoubleSide }); S.paperM.normalScale.set(0.3, 0.3);
    S.underM = new THREE.MeshStandardMaterial({ color: 0x2a3a78, roughness: 0.9, alphaMap: S.alphaT, alphaTest: 0.5, side: THREE.DoubleSide });
    S.poly = SQUARE(); S.folds = [];
    S.base = new THREE.Mesh(polyGeo(S.poly), S.paperM); S.base.receiveShadow = true; g.add(S.base);
    S.baseUnder = new THREE.Mesh(S.base.geometry, S.underM); S.baseUnder.position.y = -0.03; g.add(S.baseUnder);
    S.flaps = [0, 1].map(() => { const grp = new THREE.Group(), piv = new THREE.Group(); grp.add(piv); const top = new THREE.Mesh(polyGeo(SQUARE()), S.paperM), un = new THREE.Mesh(top.geometry, S.underM); top.receiveShadow = true; top.castShadow = true; un.position.y = -0.03; piv.add(top); piv.add(un); grp.visible = false; g.add(grp); return { grp, piv, top, un, phi: 0, f: null, blots: [] }; });
    // ink: blots that ride the flap, and the prints they leave
    S.inkM = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.93, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const cg = new THREE.CircleGeometry(1, 36); cg.rotateX(-PI / 2); const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-PI / 2);
    S.blotPool = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(cg, S.inkM); m.visible = false; m.renderOrder = 6; g.add(m); return m; });
    S.barPool = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(bg, S.inkM); m.visible = false; m.renderOrder = 6; g.add(m); return m; });
    S.prints = [];
    // crease marks: dashes along the crease, chevrons drifting across the flap toward it
    S.dashM = [1.6, 0.5].map((k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(RED).multiplyScalar(k), transparent: true, opacity: k > 1 ? 0.95 : 0.55, depthWrite: false }));
    const dg = new THREE.PlaneGeometry(0.22, 1); dg.rotateX(-PI / 2); const chev = new THREE.CircleGeometry(0.55, 3); chev.rotateX(-PI / 2);
    S.dashes = [0, 1].map((k) => { const m = new THREE.InstancedMesh(dg, S.dashM[k], 40); m.count = 0; m.frustumCulled = false; m.renderOrder = 7; g.add(m); return m; });
    S.chevs = [0, 1].map((k) => { const m = new THREE.InstancedMesh(chev, S.dashM[k], 30); m.count = 0; m.frustumCulled = false; m.renderOrder = 7; g.add(m); return m; });
    S.ripM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    S.ripMesh = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64), S.ripM); m.rotation.x = -PI / 2; m.visible = false; m.renderOrder = 7; g.add(m); return m; }); S.ripples = [];

    // ---- Oriko: three folded forms ----
    const paper = new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.85, flatShading: true, side: THREE.DoubleSide }), red = new THREE.MeshStandardMaterial({ color: 0xd42c18, roughness: 0.7, flatShading: true, side: THREE.DoubleSide, emissive: 0x60100a, emissiveIntensity: 0.6 });
    const part = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); q.rotation.set(rx, ry, rz); q.scale.set(sx, sy, sz); q.castShadow = true; parent.add(q); return q; };
    const oct = new THREE.OctahedronGeometry(1, 0), cone4 = new THREE.ConeGeometry(1, 1, 4), tri = new THREE.ConeGeometry(1, 1, 3);
    const bg2 = b.group; S.rigs = {};
    { // crane
      const r = new THREE.Group(); bg2.add(r); S.rigs.crane = r;
      part(r, oct, paper, 0, 2.6, 0, 0, 0, 0, 0.95, 0.8, 1.9);
      part(r, cone4, paper, 0, 3.7, 1.6, 0.55, 0, 0, 0.3, 2.4, 0.3); part(r, cone4, red, 0, 4.55, 2.45, 2.0, 0, 0, 0.16, 0.95, 0.16);
      part(r, cone4, paper, 0, 3.5, -1.9, -0.7, 0, 0, 0.42, 2.3, 0.14);
      r.wings = [-1, 1].map((sx) => { const w = new THREE.Group(); w.position.set(sx * 0.5, 2.9, 0.1); r.add(w); part(w, tri, paper, sx * 2.0, 0, 0, PI / 2, 0, -sx * PI / 2, 1.5, 4.0, 0.06); part(w, tri, red, sx * 3.4, 0.03, -0.2, PI / 2, 0, -sx * PI / 2, 0.5, 1.2, 0.06); return w; });
      for (const sx of [-1, 1]) part(r, cone4, paper, sx * 0.35, 1.0, 0, PI, 0, 0, 0.14, 2.0, 0.14);
    }
    { // frog
      const r = new THREE.Group(); bg2.add(r); S.rigs.frog = r; r.visible = false;
      part(r, oct, paper, 0, 1.25, -0.1, 0, 0, 0, 1.75, 0.95, 2.0); part(r, cone4, paper, 0, 1.5, 1.7, PI / 2 - 0.2, PI / 4, 0, 1.2, 1.6, 0.7);
      for (const sx of [-1, 1]) { part(r, new THREE.TetrahedronGeometry(0.42, 0), red, sx * 0.62, 2.05, 1.25); part(r, tri, paper, sx * 1.9, 0.75, -0.9, PI / 2, 0, sx * 0.9, 0.9, 2.6, 0.5); part(r, tri, paper, sx * 1.35, 0.5, 1.2, PI / 2, 0, sx * 0.5, 0.45, 1.5, 0.4); }
    }
    { // dragon: head on the boss, body segments trail behind it in the world
      const r = new THREE.Group(); bg2.add(r); S.rigs.dragon = r; r.visible = false;
      part(r, oct, paper, 0, 2.6, 0.4, 0, 0, 0, 0.95, 0.8, 1.7); part(r, cone4, red, 0, 2.2, 1.7, PI / 2 + 0.25, PI / 4, 0, 0.55, 1.3, 0.3);
      for (const sx of [-1, 1]) { part(r, cone4, red, sx * 0.5, 3.6, -0.3, -0.6, 0, -sx * 0.35, 0.16, 1.7, 0.16); part(r, new THREE.TetrahedronGeometry(0.2, 0), W.glow(0xffb040, 4), sx * 0.52, 2.95, 1.05); part(r, tri, paper, sx * 1.3, 2.4, 0.3, 0, 0, -sx * 1.2, 0.3, 1.6, 0.05); }
      S.segs = Array.from({ length: 11 }, (_, k) => { const s = new THREE.Group(), sc = 1 - k * 0.055; part(s, oct, paper, 0, 0, 0, 0, 0, 0, 0.72 * sc, 0.66 * sc, 1.15); part(s, tri, red, 0, 0.75 * sc, 0, 0, PI / 2, 0, 0.5 * sc, 0.9 * sc, 0.05); s.visible = false; g.add(s); return s; });
      S.hist = [];
    }
    S.seal = part(bg2, new THREE.BoxGeometry(0.5, 0.5, 0.06), W.glow(RED, 2.5), 0, 2.6, 0); S.seal.castShadow = false; S.seal.visible = false;
    S.light = new THREE.PointLight(0xffa060, 0, 30, 1.6); S.light.position.set(0, 4, 1); bg2.add(S.light);
    S.sheet = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.9, side: THREE.DoubleSide })); S.sheet.visible = false; g.add(S.sheet);
    Object.assign(S, { form: 'crane', lvl: 0, pend: null, safe: null, foldN: 0, fly: 0, hopY: 0, wing: 0, orbit: 0, creepT: 0, skyT: null, burning: false, dying: 0 });
    return {
      edge: 'fall', spawn: { x: 0, z: 10 }, bossStart: { x: 0, z: -6, face: 0 }, camDist: 16,
      contains(x, z) { if (!inSq(x, z)) return false; for (const f of S.folds) if (side(f, x, z) < 0) return false; const c = burnIdx(x, z); return c < 0 || S.burn[c] < 1; },
      bulletBounds: (x, z) => inSq(x, z, -6),
      camLimit(x, y, z) { return { x: clamp(x, -40, 40), y: Math.max(y, 0.5), z: clamp(z, -40, 40) }; },
    };
  }

  // ---------- burning ----------
  function ignite(S, x, z) { const c = burnIdx(x, z); if (c >= 0 && S.burn[c] === 0 && Math.max(Math.abs(x), Math.abs(z)) > 5.5) S.burn[c] = 0.001; }
  function burnStep(S, dt) {
    let dirty = false;
    for (let c = 0; c < S.burn.length; c++) { const v = S.burn[c]; if (v > 0 && v < 1) { const n = Math.min(1, v + dt / 2.8); S.burn[c] = n; dirty = true; S.alphaD[c * 4 + 1] = n >= 1 ? 0 : 255; const e = n >= 1 ? 0 : Math.sin(n * PI) * 0.8 + 0.2; S.emisD[c * 4] = 255 * e; S.emisD[c * 4 + 1] = 90 * e * e; S.emisD[c * 4 + 2] = 10 * e;
      if (n >= 1) { S.emisD[c * 4] = S.emisD[c * 4 + 1] = S.emisD[c * 4 + 2] = 0; if (!G.headless) FX.burst(-H + (c % NB + 0.5) * CELL, 0.2, -H + (Math.floor(c / NB) + 0.5) * CELL, { n: 8, color: 0xff8030, color2: 0x301008, speed: [0.5, 3], up: 3, life: [0.5, 1.4], size: [0.15, 0.4] }); } } }
    if (dirty) { S.alphaT.needsUpdate = true; S.emisT.needsUpdate = true; }
  }
  function creep(S, n) {
    const cand = []; for (let j = 0; j < NB; j++) for (let i = 0; i < NB; i++) { if (S.burn[j * NB + i] > 0) continue; let edge = i === 0 || j === 0 || i === NB - 1 || j === NB - 1; if (!edge) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (S.burn[(j + dz) * NB + i + dx] >= 1) edge = true; if (edge) cand.push([i, j]); }
    for (let k = 0; k < n && cand.length; k++) { const q = cand.splice(Math.floor(rnd(cand.length)), 1)[0]; ignite(S, -H + (q[0] + 0.5) * CELL, -H + (q[1] + 0.5) * CELL); }
  }

  // ---------- the fold ----------
  // Plan creases and ink. o: {mode: 0 straight/diagonal, 1 any angle, 2 double; T}
  function planFold(b, o) {
    const S = b.state, p = G.player, reach = Math.max(7, (o.T - 1.2) * 7 * 0.7), pts = [];
    for (let x = -H + 0.75; x < H; x += 1.5) for (let z = -H + 0.75; z < H; z += 1.5) { const c = burnIdx(x, z); if (c < 0 || S.burn[c] === 0) pts.push([x, z]); }
    const mk = (ang, off, flip) => { const nx = Math.sin(ang) * flip, nz = Math.cos(ang) * flip; return { cx: Math.sin(ang) * off, cz: Math.cos(ang) * off, nx, nz }; };
    for (let attempt = 0; attempt < 120; attempt++) {
      const n = o.mode === 2 ? 2 : 1, creases = [], blots = [[], []]; let live = pts, ok = true, a0 = 0;
      for (let k = 0; k < n && ok; k++) {
        const ang = o.mode === 0 ? pick([0, PI / 2, PI / 4, -PI / 4]) : (k ? a0 + pick([PI / 4, PI / 2, -PI / 4, 3 * PI / 8, -3 * PI / 8]) : rndi(0, 7) * PI / 8); a0 = ang;
        let f = mk(ang, rnd(-5.5, 5.5), 1); const pos = live.filter((q) => side(f, q[0], q[1]) > 0).length, frac = pos / Math.max(1, live.length);
        if (o.mode === 0 ? frac < 0.5 : (o.mode === 1 && rnd() < 0.5)) f = mk(ang, -(f.cx * Math.sin(ang) + f.cz * Math.cos(ang)), -1), f.cx = -f.cx, f.cz = -f.cz;
        const base = live.filter((q) => side(f, q[0], q[1]) > 0.4), flap = live.filter((q) => side(f, q[0], q[1]) < -0.4);
        if (base.length < live.length * (n === 2 ? 0.5 : 0.36) || flap.length < live.length * 0.2) { ok = false; break; }
        const want = o.mode === 0 ? rndi(2, 3) : o.mode === 1 ? rndi(4, 5) : (k ? 2 : 3);
        for (let t = 0; t < 60 && blots[k].length < want; t++) {
          const q = pick(flap), bar = o.mode > 0 && rnd() < 0.35, bl = bar ? { bar: true, x: q[0], z: q[1], dir: rnd(PI), len: rnd(9, 14), w: 2.6 } : { x: q[0], z: q[1], r: rnd(3.0, 4.6) };
          const m = mirror(f, bl); if (!inSq(m.x, m.z, 1) || side(f, bl.x, bl.z) > -(bar ? 1.4 : Math.min(bl.r, 2.2))) continue;
          if (blots[k].some((e) => Math.hypot(e.x - bl.x, e.z - bl.z) < 3.2)) continue;
          blots[k].push(bl);
        }
        if (blots[k].length < Math.min(2, want)) { ok = false; break; }
        creases.push(f); live = base;
      }
      if (!ok) continue;
      // prints of fold 1; the ones that land on flap 2 are still wet and print again
      const prints = [blots[0].map((q) => mirror(creases[0], q)), []];
      if (n === 2) { const wet = prints[0].filter((q) => side(creases[1], q.x, q.z) < 0); prints[1] = blots[1].concat(wet).map((q) => mirror(creases[1], q)); }
      const safe = live.filter((q) => !prints[0].some((e) => inBlot(e, q[0], q[1])) && !prints[1].some((e) => inBlot(e, q[0], q[1])));
      let near = 1e9; for (const q of safe) { const d = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z); if (d < near) near = d; }
      if (safe.length < 12 || safe.length > live.length * 0.7 || near > reach) continue;
      let mx = 0, mz = 0; for (const q of live) { mx += q[0]; mz += q[1]; }
      return { creases, blots, prints, safe, home: [mx / live.length, mz / live.length] };
    }
    return null;
  }
  function setupFlap(S, k, f, poly) {
    const F = S.flaps[k], th = Math.atan2(-f.nx, -f.nz), X = [Math.cos(th), -Math.sin(th)], fp = clipPoly(poly, f, false);
    F.f = f; F.th = th; F.phi = 0; F.grp.position.set(f.cx, 0.012 * (k + 1), f.cz); F.grp.rotation.y = th; F.piv.rotation.x = 0; F.grp.visible = fp.length >= 3;
    F.toLocal = (x, z) => [(x - f.cx) * X[0] + (z - f.cz) * X[1], -side(f, x, z)];
    F.top.geometry.dispose(); F.top.geometry = F.un.geometry = polyGeo(fp, F.toLocal);
    // dashes along the crease inside the sheet
    const seg = clipPoly(poly, f, true).filter((q) => Math.abs(side(f, q[0], q[1])) < 1e-4), D = S.dashes[k], Cv = S.chevs[k], M = new THREE.Object3D(); let n = 0;
    if (seg.length >= 2) { const [A, B] = seg, len = Math.hypot(B[0] - A[0], B[1] - A[1]), cnt = Math.min(40, Math.floor(len / 1.5)); for (let i = 0; i < cnt; i++) { const t = (i + 0.5) / cnt; M.position.set(lerp(A[0], B[0], t), 0.06, lerp(A[1], B[1], t)); M.rotation.set(0, Math.atan2(B[0] - A[0], B[1] - A[1]), 0); M.scale.set(1, 1, 0.9); M.updateMatrix(); D.setMatrixAt(n++, M.matrix); } F.seg = [A, B]; }
    D.count = n; D.instanceMatrix.needsUpdate = true; Cv.count = 0; F.chevK = 0;
  }
  function putBlot(S, F, q, k) {
    const m = (q.bar ? S.barPool : S.blotPool).find((e) => !e.visible); if (!m) return null;
    m.visible = true; m.material = S.inkM; if (F) { const l = F.toLocal(q.x, q.z); F.piv.add(m); m.position.set(l[0], 0.03, l[1]); m.rotation.y = q.bar ? q.dir - F.th : 0; } else { G.world.add(m); m.position.set(q.x, 0.035, q.z); m.rotation.y = q.bar ? q.dir : 0; }
    if (q.bar) m.scale.set(q.w, 1, q.len); else m.scale.set(q.r, 1, q.r);
    return m;
  }
  function clearInk(S) { for (const m of S.blotPool.concat(S.barPool)) { m.visible = false; if (m.parent !== G.world) G.world.add(m); } S.prints.length = 0; for (const F of S.flaps) F.blots = []; }
  function setFloor(S, folds) { S.folds = folds; let P = SQUARE(); for (const f of folds) P = clipPoly(P, f, true); S.poly = P; S.base.geometry.dispose(); S.base.geometry = S.baseUnder.geometry = polyGeo(P); }
  function resetSheet(S) { setFloor(S, []); for (const F of S.flaps) { F.grp.visible = false; F.phi = 0; F.anim = null; } for (const d of S.dashes.concat(S.chevs)) d.count = 0; clearInk(S); S.pend = null; S.safe = null; }

  function* fold(b, o) {
    const S = b.state, p = G.player, pl = planFold(b, o); if (!pl) { yield 0.6; return; }
    const n = pl.creases.length, T = o.T, teach = S.foldN < 2; S.foldN++;
    S.inFold = true; b.autoFace = true;
    yield* jumpTo(b, pl.home[0], pl.home[1], 0.7);
    let poly = S.poly;
    for (let k = 0; k < n; k++) { setupFlap(S, k, pl.creases[k], poly); poly = clipPoly(poly, pl.creases[k], true); S.flaps[k].blots = pl.blots[k].map((q) => putBlot(S, S.flaps[k], q)); S.flaps[k].lit = k === 0; }
    Sound.sfx('charge', 0.5, 0.6);
    const t0 = G.now, ev = [];
    for (let k = 0; k < n; k++) { const at = t0 + T + k * 1.5, f = pl.creases[k]; ev.push({ at, test: (x, z) => side(f, x, z) < 0 }); ev.push({ at: at + 0.5, test: (x, z) => pl.prints[k].some((e) => inBlot(e, x, z)) }); }
    S.pend = ev; S.safe = pl.safe;
    if (teach) for (const q of pl.prints[0]) Hz.mark(q.bar ? { type: 'rect', x: q.x - Math.sin(q.dir) * q.len / 2, z: q.z - Math.cos(q.dir) * q.len / 2, dir: q.dir, len: q.len, w: q.w } : { type: 'circle', x: q.x, z: q.z, r: q.r }, T + 0.5, { color: 0x30407a });
    let r = yield* b.cast({ name: n === 2 ? 'Thousandth Fold' : 'Fold', time: T }); if (r === 'dead') return;
    for (let k = 0; k < n; k++) {
      const f = pl.creases[k], F = S.flaps[k]; F.lit = true;
      // the flap lifts: anyone still on it is thrown onto the rest of the sheet
      Sound.sfx('wave', 0.9, 1.6); Sound.sfx('slash', 0.7, 0.5);
      if (p.alive && side(f, p.pos.x, p.pos.z) < 0 && G.arena.contains(p.pos.x, p.pos.z)) { const dist = -side(f, p.pos.x, p.pos.z) + 3; p.hurt(300, { blockable: false, src: { name: 'The Fold' } }); if (p.alive) { p.kb = { vx: f.nx * dist / 0.38, vz: f.nz * dist / 0.38, t: 0.38 }; p.casting = null; p.dash = null; } }
      F.anim = { t: 0, from: 0, to: -PI, dur: 0.5 }; S.dashes[k].count = 0; S.chevs[k].count = 0;
      yield 0.5;
      // slam: wet ink prints at its mirror image
      setFloor(S, pl.creases.slice(0, k + 1)); Sound.sfx('bigboom', 0.9, 1.3); FX.shake(0.7);
      for (const m of F.blots) if (m) { m.visible = false; G.world.add(m); }
      const stay = [];
      pl.prints[k].forEach((q) => {
        const wet = k + 1 < n && side(pl.creases[k + 1], q.x, q.z) < 0, m = putBlot(S, wet ? S.flaps[k + 1] : null, q);
        if (m) { if (wet) stay.push(m); else S.prints.push({ m, t: 2.6 }); }
        if (!G.headless) FX.burst(q.x, 0.2, q.z, { n: 18, color: 0x1a2050, color2: 0x000000, speed: [2, 8], life: [0.3, 0.8], size: [0.2, 0.6], radius: q.bar ? 2 : q.r * 0.7, add: false });
      });
      if (k + 1 < n) S.flaps[k + 1].blots = S.flaps[k + 1].blots.concat(stay);
      if (p.alive && pl.prints[k].some((e) => inBlot(e, p.pos.x, p.pos.z))) p.hurt(380, { blockable: true, src: { name: 'Wet Ink' } });
      F.fade = 0.6;
      if (k + 1 < n) yield 1.0;
    }
    S.pend = null; S.safe = null; S.inFold = false;
    Co.start(function* () { yield o.hold || 3; yield* unfold(b); }, 'phase');
    yield 0.7;
  }
  function* unfold(b) {
    const S = b.state; if (!S.folds.length) return;
    for (const F of S.flaps) if (F.f && S.folds.includes(F.f)) { F.grp.visible = true; F.piv.rotation.x = -PI; F.anim = { t: 0, from: -PI, to: 0, dur: 0.6 }; for (const m of F.blots) if (m) { m.visible = false; G.world.add(m); } F.blots = []; }
    Sound.sfx('wave', 0.6, 1.2); yield 0.6;
    setFloor(S, []); for (const F of S.flaps) F.grp.visible = false;
  }

  // ---------- forms ----------
  function* refold(b, to) {
    const S = b.state; if (S.form === to) return; const cur = S.rigs[S.form], nx = S.rigs[to];
    Sound.sfx('slash', 0.8, 1.6); for (let t = 0; t < 0.3; t += G.dt) { const k = 1 - t / 0.3; cur.scale.set(k, Math.max(0.03, k * k), k); cur.rotation.y += G.dt * 14; yield; }
    cur.visible = false; cur.scale.setScalar(1); cur.rotation.y = 0; nx.visible = true; S.form = to; S.seal.visible = false;
    if (!G.headless) FX.burst(b.pos.x, 2.5, b.pos.z, { n: 40, color: 0xffffff, color2: 0xf0e8d8, speed: [2, 9], life: [0.5, 1.2], size: [0.2, 0.5], add: false });
    for (const s of S.segs) s.visible = to === 'dragon'; if (to === 'dragon') S.hist.length = 0;
    for (let t = 0; t < 0.3; t += G.dt) { const k = t / 0.3; nx.scale.set(k, k * k, k); nx.rotation.y = (1 - k) * 4; yield; }
    nx.scale.setScalar(1); nx.rotation.y = 0; Sound.sfx('clap', 0.8);
  }
  function* jumpTo(b, x, z, dur = 0.6) {
    const S = b.state, x0 = b.pos.x, z0 = b.pos.z; if (Math.hypot(x - x0, z - z0) < 1.5) return;
    for (let t = 0; t < dur; t += G.dt) { const k = smooth(t / dur); b.pos.x = lerp(x0, x, k); b.pos.z = lerp(z0, z, k); S.hopY = Math.sin(k * PI) * 3.5; yield; }
    b.pos.x = x; b.pos.z = z; S.hopY = 0;
  }
  function* darts(b, n = 3) {
    const S = b.state; yield* b.cast({ name: 'Paper Darts', time: 0.7 });
    for (let k = 0; k < n; k++) { const a = b.angToPlayer(), sp = Math.max(0.2, 1.8 / Math.max(1, b.distToPlayer())); S.wing = 1; for (let i = -2; i <= 2; i++) Bul.fire({ x: b.pos.x + Math.sin(a) * 0.6, z: b.pos.z + Math.cos(a) * 0.6, dir: a + (i + (k % 2 ? 0.5 : 0)) * sp, speed: 13, r: 0.34, dmg: 90, color: RED, life: 3 }); Sound.sfx('slash', 0.6, 1.5); yield 0.5; }
    yield 0.5;
  }
  function* wingcut(b) {
    const S = b.state, dir = b.angToPlayer(); b.autoFace = false; S.wing = -1;
    Hz.cone(b.pos.x, b.pos.z, dir, 2.2, 9.5, 1.2, 320, { name: 'Wingcut', onFire() { Sound.sfx('sword', 1, 0.8); FX.shake(0.4); S.wing = 1; } });
    yield* b.cast({ name: 'Wingcut', time: 1.2 }); yield 0.6; b.autoFace = true;
  }
  function* glide(b, n = 1) {
    const S = b.state, p = G.player; yield* b.cast({ name: 'Glide', time: 0.6 }); b.targetable = false; b.autoFace = false; S.fly = 1;
    for (let k = 0; k < n; k++) {
      const a = rnd(TAU), sx = Math.sin(a), sz = Math.cos(a), x0 = p.pos.x - sx * 24, z0 = p.pos.z - sz * 24; b.facing = a;
      Hz.rect(x0, z0, a, 48, 4.6, 1.5, 340, { name: 'Glide', onFire() { Sound.sfx('dash', 1, 0.6); } });
      for (let t = 0; t < 1.5; t += G.dt) { b.pos.x = damp(b.pos.x, x0 - sx * 6, 4, G.dt); b.pos.z = damp(b.pos.z, z0 - sz * 6, 4, G.dt); yield; }
      for (let t = 0; t < 0.55; t += G.dt) { const q = t / 0.55; b.pos.x = x0 + sx * (q * 54 - 6); b.pos.z = z0 + sz * (q * 54 - 6); yield; }
    }
    // land back on the paper
    let hx = 0, hz = 0; for (let t = 0; t < 30; t++) { hx = rnd(-8, 8); hz = rnd(-8, 8); if (G.arena.contains(hx, hz) && Math.hypot(hx - p.pos.x, hz - p.pos.z) > 4) break; }
    for (let t = 0; t < 0.6; t += G.dt) { b.pos.x = damp(b.pos.x, hx, 7, G.dt); b.pos.z = damp(b.pos.z, hz, 7, G.dt); yield; }
    b.pos.x = hx; b.pos.z = hz; S.fly = 0; b.targetable = true; b.autoFace = true; yield 0.5;
  }
  function* leaps(b, n = 3) {
    const S = b.state, p = G.player;
    for (let k = 0; k < n; k++) {
      const h = Hz.circle(p.pos.x, p.pos.z, 4.2, 1.3, 330, { name: 'Leap', lock: 0.85, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire(hh) { Sound.sfx('boom', 0.9, 0.8); FX.shake(0.5); S.ripples.push({ x: hh.shape.x, z: hh.shape.z, r: 4.4, hit: false }); } });
      yield 0.7; const x0 = b.pos.x, z0 = b.pos.z;
      for (let t = 0; t < 0.55; t += G.dt) { const q = smooth(t / 0.55); b.pos.x = lerp(x0, h.shape.x, q); b.pos.z = lerp(z0, h.shape.z, q); S.hopY = Math.sin(q * PI) * 6; yield; }
      S.hopY = 0; yield 0.75;
    }
    yield 0.4;
  }
  function* cranes(b) {
    const S = b.state; S.wing = -1;
    const r = yield* b.cast({ name: 'Thousand Cranes', time: 2.6, interruptible: true }); S.wing = 0;
    if (r === 'done') { for (let w = 0; w < 3; w++) { const a = rnd(TAU), sx = Math.sin(a), sz = Math.cos(a), gap = rndi(-3, 3), gap2 = gap + pick([-4, 4, 5]); for (let i = -8; i <= 8; i++) { if (Math.abs(i - gap) <= 1 || i === gap2) continue; Bul.fire({ x: -sx * 22 + sz * i * 1.9, z: -sz * 22 - sx * i * 1.9, dir: a, speed: 10.5, r: 0.42, dmg: 150, color: 0xffffff, life: 4.6 }); } Sound.sfx('wave', 0.6, 2); yield 1.1; } }
    yield 0.6;
  }
  function* scorch(b) {
    const S = b.state, dir = b.angToPlayer(); b.autoFace = false; S.breath = 0.3;
    Hz.cone(b.pos.x, b.pos.z, dir, 1.05, 19, 1.5, 360, { name: 'Scorch', color: 0xff7020, onFire() {
      Sound.sfx('roar', 0.9, 1.3); Sound.sfx('steam', 0.8); FX.shake(0.5); S.breath = 1;
      for (let k = 0; k < 16; k++) { const d = rnd(5, 19), a = dir + rnd(-0.5, 0.5); ignite(S, b.pos.x + Math.sin(a) * d, b.pos.z + Math.cos(a) * d); if (!G.headless && k % 2) FX.burst(b.pos.x + Math.sin(a) * d, 0.5, b.pos.z + Math.cos(a) * d, { n: 10, color: 0xff9030, color2: 0xff3010, speed: [1, 5], up: 4, life: [0.4, 1.0], size: [0.3, 0.7] }); }
    } });
    yield* b.cast({ name: 'Scorch', time: 1.5 }); yield 0.7; S.breath = 0; b.autoFace = true;
  }
  function* embers(b, n = 5) {
    const S = b.state, p = G.player; yield* b.cast({ name: 'Ember Rain', time: 0.8 });
    for (let k = 0; k < n; k++) { let x = p.pos.x, z = p.pos.z; if (k) for (let t = 0; t < 20; t++) { x = rnd(-13, 13); z = rnd(-13, 13); if (G.arena.contains(x, z)) break; } Hz.circle(x, z, 3.1, 1.3, 280, { name: 'Ember', color: 0xff7020, onFire() { ignite(S, x, z); } }); yield 0.28; }
    yield 1.0;
  }

  function mood(b, n, instant) {
    const S = b.state, T = [
      { top: 0xcfc8b6, hor: 0xefe6d2, bot: 0xa8a090, fog: 0xd8d0bc, sun: 2.3, hemi: 0.85, paper: 0xd9d0bb, mist: 0xe6dfcc, fire: 0, cloud: 0xf6f0e2, mtn: 1 },
      { top: 0x2a2e5a, hor: 0xe89060, bot: 0x3a2a40, fog: 0x8a6a70, sun: 1.9, hemi: 0.6, paper: 0x53609a, mist: 0x9a7a80, fire: 0.3, cloud: 0xf0a080, mtn: 0.45 },
      { top: 0x05040a, hor: 0x40140c, bot: 0x0a0406, fog: 0x1c0c0a, sun: 0.9, hemi: 0.35, paper: 0x6a6f98, mist: 0x2a100a, fire: 1.4, cloud: 0x602010, mtn: 0.07 },
    ][n];
    S.skyT = T; if (instant) moodStep(S, 1e3);
  }
  function moodStep(S, dt) {
    const T = S.skyT; if (!T) return; const k = 1 - Math.exp(-0.9 * dt), U = S.sky.material.uniforms;
    U.uTop.value.lerp(_c.setHex(T.top), k); U.uHor.value.lerp(_c.setHex(T.hor), k); U.uBot.value.lerp(_c.setHex(T.bot), k); U.uCloudCol.value.lerp(_c.setHex(T.cloud), k);
    S.fog.color.lerp(_c.setHex(T.fog), k); S.mist.material.color.lerp(_c.setHex(T.mist), k); S.paperM.color.lerp(_c.setHex(T.paper), k);
    S.mtnK = lerp(S.mtnK === undefined ? 1 : S.mtnK, T.mtn, k); for (const mm of S.mtn) mm.color.copy(mm.userData.base).multiplyScalar(S.mtnK); S.sun.intensity = lerp(S.sun.intensity, T.sun, k); S.hemi.intensity = lerp(S.hemi.intensity, T.hemi, k); S.fire.intensity = lerp(S.fire.intensity, T.fire, k);
  }
  function setAct(b, n) {
    const S = b.state; S.lvl = n; resetSheet(S); S.inFold = false; S.fly = 0; S.hopY = 0; S.wing = 0; S.breath = 0; b.targetable = true; b.autoFace = true; S.ripples.length = 0; mood(b, n, false);
    if (!G.arena.contains(b.pos.x, b.pos.z)) { b.pos.x = 0; b.pos.z = -4; }
  }
  function setForm(b, to) { const S = b.state; for (const k in S.rigs) { S.rigs[k].visible = k === to; S.rigs[k].scale.setScalar(1); } S.form = to; for (const s of S.segs) s.visible = to === 'dragon'; }

  G.bosses.push({
    id: 'origami', name: 'ORIKO', title: 'The Thousandth Fold', hint: 'Paper remembers', color: '#f2e9d8', telegraph: RED,
    hp: 25000, radius: 1.6, aimY: 2.6, enrage: 440,
    post: { bloom: 0.32, threshold: 0.92, radius: 0.6, exposure: 0.92, vig: 0.9, sat: 1.0, contrast: 1.06, tint: [1.03, 1.0, 0.95] },
    music: { bpm: 96, root: 38, scale: [0, 1, 5, 7, 10], prog: [0, 0, 3, 2, 0, 4, 3, 1],
      layers: [
        { v: 'koto', pat: ['0..2..4.....3...', '4..3..2.....0...'], oct: 1, len: 2, vol: 0.09 }, { v: 'flute', pat: ['0.......2.......', '4.......3.......'], oct: 1, len: 7, vol: 0.05 }, { v: 'tom', pat: 'x.......x.......', vol: 0.12 },
        { v: 'taiko', from: 1, pat: 'x.....x...x.....', vol: 0.22 }, { v: 'bass', from: 1, pat: '0.....0...0..0..', oct: -1, len: 2, vol: 0.12 }, { v: 'koto', from: 1, pat: '0.2.4.2.3.2.0.2.', oct: 2, len: 1, vol: 0.05 },
        { v: 'brass', from: 2, pat: ['0.......3.......', '4.......2...1...'], oct: 0, len: 7, vol: 0.11 }, { v: 'taiko', from: 2, pat: 'x.xx..x.x.x..xx.', vol: 0.22 }, { v: 'choir', from: 2, pat: '0.......4.......', oct: 1, len: 8, vol: 0.06 },
      ] },
    build,
    *intro(b) { Sound.sfx('wave', 0.6, 1.5); yield* Cam.shot([14, 9, 20], [0, 2, -4], [5, 3.4, 4], [0, 3, -6], 5.0, 44); },
    *death(b) {
      const S = b.state, a = Cam.yaw + 0.5; Cam.cine = { pos: new V3(b.pos.x - Math.sin(a) * 13, 6, b.pos.z - Math.cos(a) * 13), look: new V3(b.pos.x, 2.5, b.pos.z), fov: 42 };
      const cur = S.rigs[S.form]; Sound.sfx('slash', 1, 0.5);
      for (let t = 0; t < 0.45; t += G.dt) { const k = 1 - t / 0.45; cur.scale.set(Math.max(0.05, k), Math.max(0.02, k * k), Math.max(0.05, k)); cur.rotation.y += G.dt * 10; yield; }
      cur.visible = false; for (const s of S.segs) s.visible = false; S.sheet.visible = true; S.sheet.position.set(b.pos.x, 3, b.pos.z); S.dying = 0.001; FX.flash(0xffffff, 0.3, 1); yield 0.8;
    },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setAct(b, 0); yield 1.0; let n = 0;
        while (true) {
          yield* darts(b, n ? 3 : 2); yield* fold(b, { mode: 0, T: 4.5, hold: 3 }); yield* wingcut(b); yield* glide(b, 1);
          yield* fold(b, { mode: 0, T: 4.5, hold: 3 }); yield* wingcut(b); n++;
        }
      } },
      { at: 0.68, skipTo(b) { mood(b, 1, true); },
        *enter(b) {
          const S = b.state; setAct(b, 1); yield* jumpTo(b, 0, 0, 0.6);
          yield* b.cast({ name: 'Turn the Page', time: 1.6, onTick: (k) => FX.shake(k * 0.25) }); FX.flash(0xffffff, 0.5, 0.9); Sound.sfx('wave', 1, 0.7); Sound.sfx('bigboom', 0.6);
          Co.start(Post.lerpTo({ exposure: 1.0, bloom: 0.45, tint: [1.05, 0.98, 1.02] }, 3), 'fight'); yield* refold(b, 'frog'); yield 0.8;
        },
        *run(b) {
          const S = b.state; setAct(b, 1); setForm(b, S.form === 'crane' ? 'frog' : S.form); yield 0.5;
          while (true) {
            yield* refold(b, 'frog'); yield* leaps(b, 3); yield* fold(b, { mode: 1, T: 4.0, hold: 5 }); yield* leaps(b, 2);
            yield* refold(b, 'crane'); yield* glide(b, 2); yield* cranes(b); yield* fold(b, { mode: 1, T: 4.0, hold: 5 }); yield* darts(b, 3); yield* wingcut(b);
          }
        } },
      { at: 0.36, skipTo(b) { mood(b, 2, true); },
        *enter(b) {
          const S = b.state; setAct(b, 2); yield* jumpTo(b, 0, 0, 0.6);
          yield* b.cast({ name: 'Last Fold', time: 1.8, onTick: (k) => FX.shake(k * 0.35) }); Sound.sfx('roar', 1, 0.6); FX.flash(0xff6020, 0.4, 1.2);
          Co.start(Post.lerpTo({ exposure: 1.0, bloom: 0.5, threshold: 0.88, tint: [1.1, 0.96, 0.9] }, 3), 'fight');
          yield* refold(b, 'dragon'); for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { ignite(S, x, z); ignite(S, x * 0.9, z); ignite(S, x, z * 0.9); } S.burning = true; yield 1.0;
        },
        *run(b) {
          const S = b.state; setAct(b, 2); setForm(b, 'dragon'); S.burning = true; yield 0.5;
          while (true) {
            yield* scorch(b); yield* fold(b, { mode: 2, T: 6.0, hold: 4 }); yield* embers(b, 5); yield* scorch(b);
            yield* cranes(b); yield* fold(b, { mode: 2, T: 6.0, hold: 4 }); yield* embers(b, 4);
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      moodStep(S, dt); burnStep(S, dt);
      if (S.burning && G.state === 'fight') { S.creepT -= dt; if (S.creepT <= 0) { S.creepT = 5.5; creep(S, 4); } }
      // flaps: think-time flutter, then the swing
      for (let k = 0; k < 2; k++) {
        const F = S.flaps[k]; if (!F.grp.visible) continue;
        if (F.anim) { F.anim.t += dt / F.anim.dur; const q = smooth(F.anim.t); F.piv.rotation.x = lerp(F.anim.from, F.anim.to, q); if (F.anim.t >= 1) { F.piv.rotation.x = F.anim.to; F.anim = null; } }
        else if (S.pend && !S.folds.includes(F.f)) {
          F.piv.rotation.x = F.lit ? -0.035 - Math.sin(t * 5 + k) * 0.02 : 0;
          // chevrons drift across the flap toward the crease
          if (F.seg && !G.headless) { const Cv = S.chevs[k], [A, B] = F.seg, f = F.f, M = _obj; let n = 0; const len = Math.hypot(B[0] - A[0], B[1] - A[1]), cnt = Math.min(10, Math.max(2, Math.floor(len / 4)));
            for (let i = 0; i < cnt; i++) for (let r = 0; r < 3; r++) { const u = (i + 0.5) / cnt, d = 1.2 + ((r + 3 - (t * 0.9) % 1 * 1) % 3) * 1.5, x = lerp(A[0], B[0], u) - f.nx * d, z = lerp(A[1], B[1], u) - f.nz * d; if (!inSq(x, z, 0.5)) continue; M.position.set(x, 0.07, z); M.rotation.set(0, Math.atan2(f.nx, f.nz), 0); M.scale.setScalar(F.lit ? 1 : 0.7); M.updateMatrix(); Cv.setMatrixAt(n++, M.matrix); }
            Cv.count = n; Cv.instanceMatrix.needsUpdate = true; }
        }
        if (F.fade > 0 && !F.anim) { F.fade -= dt; }
      }
      for (let i = S.prints.length - 1; i >= 0; i--) { const q = S.prints[i]; q.t -= dt; if (q.t <= 0) { q.m.visible = false; S.prints.splice(i, 1); } }
      S.inkM.opacity = 0.93;
      // frog ripples: jump them
      for (let i = S.ripples.length - 1; i >= 0; i--) {
        const q = S.ripples[i]; q.r += 9.5 * dt; const m = S.ripMesh[i % 4];
        if (p && p.alive && !q.hit && G.state === 'fight') { const d = Math.hypot(p.pos.x - q.x, p.pos.z - q.z); if (Math.abs(d - q.r) < 0.55 && p.pos.y < 0.3) { q.hit = true; p.hurt(160, { blockable: true, src: { name: 'Ripple' } }); } }
        if (q.r > 30) { S.ripples.splice(i, 1); continue; }
      }
      S.ripMesh.forEach((m, i) => { const q = S.ripples[i]; m.visible = !!q; if (q) { m.position.set(q.x, 0.09, q.z); m.scale.setScalar(q.r); S.ripM.opacity = 0.9; } });
      // the body
      const rig = S.rigs[S.form]; S.wingK = damp(S.wingK || 0, S.wing || 0, 10, dt); if (Math.abs(S.wing) > 0 && Math.abs(S.wingK - S.wing) < 0.05) S.wing = 0; S.flyK = damp(S.flyK || 0, S.fly, 5, dt);
      if (S.form === 'crane') { const fl = S.flyK > 0.1 ? Math.sin(t * 12) * 0.6 : Math.sin(t * 2) * 0.08; rig.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.25 + fl + S.wingK * 0.9); }); rig.position.y = S.flyK * 4.5 + (S.hopY || 0); rig.rotation.x = S.flyK * 0.35; }
      else if (S.form === 'frog') { rig.position.y = S.hopY || 0; rig.rotation.x = -(S.hopY || 0) * 0.05; rig.scale.y = 1 + Math.sin(t * 3) * 0.03; }
      else {
        if (!b.castState && !S.inFold && G.state === 'fight' && !b.transitioning && p) { // prowl slowly round the middle of what is left of the sheet
          S.orbit += dt * 0.35; const tx = Math.sin(S.orbit) * 4.5, tz = Math.cos(S.orbit) * 4.5; if (G.arena.contains(tx, tz)) { b.pos.x = damp(b.pos.x, tx, 0.8, dt); b.pos.z = damp(b.pos.z, tz, 0.8, dt); } }
        rig.position.y = 0.6 + Math.sin(t * 2.2) * 0.25 + (S.hopY || 0);
        const hx = b.pos.x - Math.sin(b.facing) * 1.2, hz = b.pos.z - Math.cos(b.facing) * 1.2, last = S.hist[0];
        if (!last || Math.hypot(hx - last[0], hz - last[1]) > 0.3) { S.hist.unshift([hx, hz]); if (S.hist.length > 90) S.hist.length = 90; }
        let px = hx, pz = hz; S.segs.forEach((s, k) => { // lay the segments along a coil behind the head
          const a = b.facing + PI + Math.sin(t * 1.3 + k * 0.7) * 0.5 + k * 0.42, d = 1.5; const tx = px + Math.sin(a) * d, tz = pz + Math.cos(a) * d;
          s.position.set(damp(s.position.x, tx, 6, dt), 2.3 + Math.sin(t * 2.2 - k * 0.6) * 0.45 + (S.hopY || 0), damp(s.position.z, tz, 6, dt)); s.rotation.y = Math.atan2(px - s.position.x, pz - s.position.z); px = s.position.x; pz = s.position.z; });
      }
      S.light.intensity = damp(S.light.intensity, S.form === 'dragon' ? 10 + (S.breath || 0) * 50 : 0, 5, dt);
      if (S.dying) { S.dying += dt; S.sheet.position.y = 3 - S.dying * 1.2; S.sheet.position.x += Math.sin(S.dying * 3) * dt * 1.5; S.sheet.rotation.set(-PI / 2 + Math.sin(S.dying * 3) * 0.5, 0, S.dying * 0.8); }
    },
    danger(b, x, z) { const S = b.state; let best = Infinity; if (S.pend) for (const e of S.pend) { const d = e.at - G.now; if (d > -0.05 && d < best && e.test(x, z)) best = Math.max(0, d); } const c = burnIdx(x, z); if (c >= 0 && S.burn[c] > 0.3) best = Math.min(best, 0.3); return best; },
    bot(b, p) {
      const S = b.state; for (const q of S.ripples) { const d = Math.hypot(p.pos.x - q.x, p.pos.z - q.z); if (!q.hit && d - q.r > 0 && d - q.r < 2.0) p.jump(); }
      const avoid = (x, z) => { const c = burnIdx(x, z); return c >= 0 && S.burn[c] > 0; };
      if (S.safe && S.safe.length) { let best = null, bd = 1e9; for (const q of S.safe) { const d = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z); if (d < bd) { bd = d; best = q; } } return { x: best[0], z: best[1], w: 3, avoid }; }
      return { avoid };
    },
  });
  const _obj = new THREE.Object3D();
})();
