// DOOR XIII: ZUGZWANG, the Last Grandmaster. A chessboard on a giant's study table. The pieces play by the rules.
(() => {
  const C = 4.5, HALF = 18, EMBER = 0xff5a28, IVORY = 0xfff0d0, GOLD = 0xffc850;
  const cx = (i) => (i - 3.5) * C, ci = (x) => Math.floor((x + HALF) / C);
  const inB = (i, j) => i >= 0 && i < 8 && j >= 0 && j < 8;
  const cellOf = (x, z) => { const i = ci(x), j = ci(z); return inB(i, j) ? { i, j } : null; };
  const _a = new V3(), _b = new V3(), _m = new THREE.Object3D(), _c = new THREE.Color();
  const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ALL = ROOK.concat(DIAG);
  const JUMP = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const HEIGHT = { P: 3.2, R: 3.6, N: 4.2, B: 4.8, Q: 5.5 };

  // Squares a piece of `type` on (i,j) attacks. occ(i,j) is truthy for blockers; a ray includes its first blocker.
  // rays (optional) collects the far end of each line / each jump target for the strike effects.
  function attacks(type, i, j, occ, rays) {
    const out = [];
    const slide = (dirs) => { for (const [dx, dz] of dirs) { let x = i + dx, z = j + dz, lx = -1, lz = -1; while (inB(x, z)) { out.push(z * 8 + x); lx = x; lz = z; if (occ(x, z)) break; x += dx; z += dz; } if (rays && lx >= 0) rays.push([lx, lz]); } };
    if (type === 'R') slide(ROOK); else if (type === 'B') slide(DIAG); else if (type === 'Q') slide(ALL);
    else if (type === 'N') { for (const [dx, dz] of JUMP) if (inB(i + dx, j + dz)) { out.push((j + dz) * 8 + i + dx); if (rays) rays.push([i + dx, j + dz]); } }
    else if (type === 'P') { for (const dx of [-1, 1]) if (inB(i + dx, j + 1)) { out.push((j + 1) * 8 + i + dx); if (rays) rays.push([i + dx, j + 1]); } }
    else if (type === 'K') { for (const [dx, dz] of ALL) if (inB(i + dx, j + dz)) out.push((j + dz) * 8 + i + dx); }
    return out;
  }

  // ---------- piece models ----------
  const PROFILE = {
    P: [[0, 0], [1.15, 0], [1.2, 0.25], [0.9, 0.5], [0.55, 0.8], [0.42, 1.6], [0.72, 1.85], [0.45, 2.0], [0.62, 2.3], [0.7, 2.65], [0.55, 3.0], [0.25, 3.2], [0, 3.25]],
    R: [[0, 0], [1.3, 0], [1.35, 0.3], [1.0, 0.6], [0.8, 1.0], [0.72, 2.6], [1.0, 2.9], [1.05, 3.6], [0.8, 3.6], [0.8, 3.3], [0, 3.3]],
    B: [[0, 0], [1.3, 0], [1.35, 0.3], [0.95, 0.6], [0.6, 1.0], [0.45, 2.6], [0.8, 2.85], [0.5, 3.0], [0.7, 3.5], [0.6, 4.0], [0.3, 4.4], [0.12, 4.55], [0.2, 4.7], [0, 4.8]],
    Q: [[0, 0], [1.45, 0], [1.5, 0.35], [1.05, 0.7], [0.7, 1.2], [0.5, 3.4], [0.9, 3.7], [0.6, 3.85], [0.75, 4.3], [1.0, 5.0], [0.7, 4.9], [0.35, 5.1], [0.3, 5.3], [0, 5.45]],
    K: [[0, 0], [1.6, 0], [1.65, 0.4], [1.15, 0.8], [0.8, 1.3], [0.58, 3.8], [1.0, 4.1], [0.7, 4.3], [0.85, 4.8], [1.1, 5.5], [0.8, 5.6], [0, 5.7]],
    Nb: [[0, 0], [1.3, 0], [1.35, 0.3], [0.95, 0.6], [0.8, 0.95], [0, 0.95]],
  };
  const geoCache = {};
  function lathe(k) { return geoCache[k] || (geoCache[k] = new THREE.LatheGeometry(PROFILE[k].map(([r, y]) => new THREE.Vector2(r, y)), 28)); }
  function knightHead() {
    if (geoCache.Nh) return geoCache.Nh;
    const s = new THREE.Shape(), P = [[-0.7, 0.9], [0.75, 0.9], [0.6, 1.6], [0.35, 2.2], [0.9, 2.5], [1.25, 2.3], [1.38, 2.7], [0.9, 3.5], [0.45, 4.0], [0.2, 4.3], [0.05, 3.9], [-0.5, 3.5], [-0.85, 2.6], [-0.8, 1.6]];
    s.moveTo(P[0][0], P[0][1]); for (let k = 1; k < P.length; k++) s.lineTo(P[k][0], P[k][1]); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 }); g.translate(0, 0, -0.35); g.rotateY(-PI / 2);
    return (geoCache.Nh = g);
  }
  function pieceMesh(type, body, glowM) {
    const g = new THREE.Group(), add = (geo, m, y = 0) => { const q = new THREE.Mesh(geo, m); q.position.y = y; q.castShadow = true; g.add(q); return q; };
    if (type === 'N') { add(lathe('Nb'), body); add(knightHead(), body); const e = add(new THREE.SphereGeometry(0.11, 8, 6), glowM, 3.15); e.position.set(0.38, 3.15, 0.75); e.castShadow = false; const e2 = add(new THREE.SphereGeometry(0.11, 8, 6), glowM, 3.15); e2.position.set(-0.38, 3.15, 0.75); e2.castShadow = false; }
    else add(lathe(type), body);
    const ringY = { P: 1.85, R: 2.9, B: 2.85, Q: 3.7, K: 4.1, N: 0.95 }[type], ringR = { P: 0.72, R: 1.0, B: 0.8, Q: 0.9, K: 1.0, N: 0.82 }[type];
    const ring = add(new THREE.TorusGeometry(ringR, 0.07, 6, 28), glowM, ringY); ring.rotation.x = PI / 2; ring.castShadow = false;
    if (type === 'Q') for (let k = 0; k < 8; k++) { const s = add(new THREE.SphereGeometry(0.14, 8, 6), glowM, 5.05); s.position.set(Math.sin(k / 8 * TAU) * 0.95, 5.05, Math.cos(k / 8 * TAU) * 0.95); s.castShadow = false; }
    if (type === 'K') { add(new THREE.BoxGeometry(0.28, 1.3, 0.28), body, 6.25); add(new THREE.BoxGeometry(0.9, 0.28, 0.28), body, 6.4); }
    if (type === 'R') for (let k = 0; k < 6; k++) { const m = add(new THREE.BoxGeometry(0.42, 0.4, 0.3), body, 3.75); m.position.set(Math.sin(k / 6 * TAU) * 0.9, 3.75, Math.cos(k / 6 * TAU) * 0.9); m.rotation.y = k / 6 * TAU; }
    return g;
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x070403, horizon: 0x2c1408, bottom: 0x040201, stars: 0, sunDir: [0, -1, 0], sunColor: 0x000000, sunSize: 0.001, sunGlow: 0, clouds: 0 });
    g.add(sky); S.sky = sky; W.env(sky, 0.5);
    scene.fog = new THREE.FogExp2(0x140a05, 0.0055); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x8a7c6c, 0x2a1c14, 0.75);
    S.key = W.sun(g, { dir: [-0.55, 0.8, -0.45], color: 0xffe4c4, intensity: 2.7, size: 30 });
    S.rim = new THREE.DirectionalLight(0xff8a50, 0.6); S.rim.position.set(40, 14, 60); g.add(S.rim); g.add(S.rim.target);
    S.cool = new THREE.DirectionalLight(0x6080c0, 0.35); S.cool.position.set(60, 30, -40); g.add(S.cool); g.add(S.cool.target);

    // board
    const walnut = W.surface('wood', { seed: 4, dark: 0x2c170c, light: 0x5e3822 });
    const lightM = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.0, color: 0xe4dac4, envMapIntensity: 1.1 });
    const darkM = new THREE.MeshStandardMaterial({ map: walnut.map, roughness: 0.24, metalness: 0.05, color: 0xffffff, envMapIntensity: 1.3 });
    const sq = new THREE.BoxGeometry(C - 0.04, 0.5, C - 0.04);
    const li = new THREE.InstancedMesh(sq, lightM, 32), di = new THREE.InstancedMesh(sq, darkM, 32); let nl = 0, nd = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { _m.position.set(cx(i), -0.25, cx(j)); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); if ((i + j) & 1) di.setMatrixAt(nd++, _m.matrix); else li.setMatrixAt(nl++, _m.matrix); }
    li.receiveShadow = di.receiveShadow = true; g.add(li); g.add(di);
    const under = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.1, 0.4, HALF * 2 + 0.1), W.mat({ color: 0x0a0605, roughness: 0.6 })); under.position.y = -0.3; g.add(under);
    const frameM = new THREE.MeshStandardMaterial({ map: walnut.map, color: 0x6a4630, roughness: 0.35, envMapIntensity: 1.2 });
    for (const [x, z, w, d] of [[0, -HALF - 1.5, HALF * 2 + 6, 3], [0, HALF + 1.5, HALF * 2 + 6, 3], [-HALF - 1.5, 0, 3, HALF * 2], [HALF + 1.5, 0, 3, HALF * 2]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), frameM); f.position.set(x, -0.35, z); f.receiveShadow = true; f.castShadow = true; g.add(f); }
    const brass = W.mat({ color: 0xc09040, roughness: 0.3, metalness: 0.9 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), brass); k.position.set(sx * (HALF + 1.5), 0.3, sz * (HALF + 1.5)); g.add(k); }
    // the table and the room, at giant scale
    const tw = W.surface('wood', { seed: 9, dark: 0x1c0e07, light: 0x4a2a16 }); for (const k in tw) tw[k].repeat.set(5, 5);
    const table = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshStandardMaterial({ map: tw.map, normalMap: tw.normalMap, roughness: 0.4, color: 0x8a6a50, envMapIntensity: 0.8 })); table.rotation.x = -PI / 2; table.position.y = -0.9; table.receiveShadow = true; g.add(table);
    const wax = W.mat({ color: 0xe8dcc0, roughness: 0.6, emissive: 0x3a2410, emissiveIntensity: 0.35 });
    S.candle = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 1, 24), wax); S.candle.position.set(-62, 0, -74); g.add(S.candle);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(13, 10, 2.2, 28), brass); dish.position.set(-62, 0.2, -74); g.add(dish);
    S.flameM = W.glow(0xffb050, 3.2); S.flame = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 12), S.flameM); S.flame.scale.set(1, 2.3, 1); g.add(S.flame);
    S.halo = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff9030, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(S.halo);
    const vr = mulberry(41), bookC = [0x5a1810, 0x16303a, 0x3a3010, 0x2a1030, 0x103018];
    for (let k = 0; k < 5; k++) { const bk = new THREE.Mesh(new THREE.BoxGeometry(58 - k * 4, 8 + vr() * 4, 40 - k * 2), W.mat({ color: bookC[k], roughness: 0.7 })); bk.position.set(78 + vr() * 6, 4 + k * 10.5, -48 + vr() * 6); bk.rotation.y = 0.35 + (vr() - 0.5) * 0.5; g.add(bk); const pg = new THREE.Mesh(new THREE.BoxGeometry(56 - k * 4, 6, 38 - k * 2), W.mat({ color: 0xd8c8a0, roughness: 0.9 })); pg.position.copy(bk.position); pg.position.x -= 2; pg.rotation.y = bk.rotation.y; g.add(pg); }
    const hearth = new THREE.Mesh(new THREE.PlaneGeometry(200, 110), new THREE.MeshBasicMaterial({ color: 0xff5010, fog: false, transparent: true, opacity: 0.55 })); hearth.position.set(60, 30, 250); hearth.rotation.y = PI; g.add(hearth); S.hearth = hearth;
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(300, 150, 20), W.mat({ color: 0x0c0806, roughness: 1 })); mantel.position.set(60, 60, 262); g.add(mantel);
    // captured white pieces lying off the board
    const ivoryM = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.3, envMapIntensity: 1.2 });
    for (const [t, x, z, ry] of [['P', -30, 8, 0.4], ['R', -27, -6, 2.1], ['P', 29, 12, 4.0], ['B', 31, -3, 1.2]]) { const m = new THREE.Mesh(lathe(t), ivoryM); m.position.set(x, 0.35, z); m.rotation.set(PI / 2, 0, ry, 'YXZ'); m.rotation.y = ry; m.castShadow = true; g.add(m); }
    S.motes = W.motes({ n: 260, box: [70, 26, 70], color: 0xffc080, size: 0.16, vel: [0.12, 0.05, 0.08], sway: 0.5, center: [0, 12, 0], alpha: 0.5 }); g.add(S.motes);

    // pieces: a pool of every piece the fight can show, built now so nothing compiles mid-fight
    S.bodyM = new THREE.MeshStandardMaterial({ color: 0x15100e, roughness: 0.2, metalness: 0.2, envMapIntensity: 1.6 }); S.glowM = W.glow(EMBER, 2.2);
    S.pool = {}; for (const [t, n] of [['P', 5], ['R', 5], ['B', 5], ['N', 5], ['Q', 3]]) S.pool[t] = Array.from({ length: n }, () => { const m = pieceMesh(t, S.bodyM, S.glowM); m.visible = false; g.add(m); return { m, used: false }; });
    S.pieces = []; S.ver = 0;
    // squares the strike will hit: one instanced quad layer for the flash
    S.dotI = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), 64);
    S.dotI.geometry.rotateX(-PI / 2); S.dotI.frustumCulled = false; S.dotI.count = 0; S.dotI.renderOrder = 8; S.dotI.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3); g.add(S.dotI);
    // annotation arrows for pieces that move before they strike
    S.arrowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa030).multiplyScalar(1.4), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    S.arrows = Array.from({ length: 6 }, () => { const a = new THREE.Group(), sh = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1), S.arrowM), hd = new THREE.Mesh(new THREE.CircleGeometry(1.3, 3), S.arrowM); sh.rotation.x = -PI / 2; hd.rotation.x = -PI / 2; hd.rotation.z = -PI / 2; a.add(sh); a.add(hd); a.sh = sh; a.hd = hd; a.visible = false; a.renderOrder = 9; g.add(a); return a; });
    // the piece you are: a small ivory figure over the hero
    S.glyphM = new THREE.MeshBasicMaterial({ color: new THREE.Color(IVORY).multiplyScalar(1.3), transparent: true, opacity: 0.9 });
    S.glyph = {}; for (const t of ['R', 'B', 'N', 'Q']) { const m = pieceMesh(t, S.glyphM, S.glyphM); m.traverse((o) => { o.castShadow = false; }); m.scale.setScalar(0.17); m.visible = false; g.add(m); S.glyph[t] = m; }
    S.crown = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.75, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.8), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); S.crown.rotation.x = -PI / 2; S.crown.visible = false; S.crown.renderOrder = 9; g.add(S.crown);

    // ---- the King ----
    S.rig = pieceMesh('K', S.bodyM, S.glowM); S.rig.scale.setScalar(1.12); b.group.add(S.rig);
    S.crackM = W.glow(EMBER, 3); for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2 + (k % 3) * 0.5, 0.05), S.crackM); const a = k * 1.3; c.position.set(Math.sin(a) * 0.72, 2.2 + (k % 2) * 0.8, Math.cos(a) * 0.72); c.rotation.z = (k % 2 ? 0.25 : -0.2); S.rig.add(c); }
    S.light = new THREE.PointLight(EMBER, 40, 22, 1.6); S.light.position.set(0, 5, 0); b.group.add(S.light);
    Object.assign(S, { lvl: 0, you: null, pending: null, inGambit: false, gcount: 0, checkT: 0, checkCd: 0, checkHold: 0, dotKey: '', hop: 0, safeHint: null, age: 0 });
    return {
      edge: 'wall', spawn: { x: cx(4), z: cx(7) }, bossStart: { x: cx(3), z: cx(1), face: 0 }, camDist: 17,
      contains: (x, z) => Math.abs(x) <= HALF - 0.4 && Math.abs(z) <= HALF - 0.4,
      clamp(p) { p.x = clamp(p.x, -HALF + 0.4, HALF - 0.4); p.z = clamp(p.z, -HALF + 0.4, HALF - 0.4); },
      solid(p) { for (const q of S.pieces) { if (q.dropT > 0.15 || q.gone) continue; const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz); if (d < 1.75 && d > 0.001) { p.x = q.x + dx / d * 1.75; p.z = q.z + dz / d * 1.75; } } },
      bulletBounds: (x, z) => Math.abs(x) < HALF + 2 && Math.abs(z) < HALF + 2,
      camLimit(x, y, z) { return { x: clamp(x, -44, 44), y: Math.max(y, 0.5), z: clamp(z, -44, 44) }; },
    };
  }

  // ---------- board state ----------
  const kingCell = (b) => cellOf(b.pos.x, b.pos.z) || { i: 3, j: 1 };
  function occFn(b, list) { const k = kingCell(b), set = new Set(list.map((q) => q.j * 8 + q.i)); set.add(k.j * 8 + k.i); return (i, j) => set.has(j * 8 + i); }
  function take(S, type) { const P = S.pool[type]; for (const q of P) if (!q.used) { q.used = true; return q; } return null; }
  function place(b, type, i, j, o = {}) {
    const S = b.state, slot = take(S, type); if (!slot) return null;
    const q = Object.assign({ type, i, j, x: cx(i), z: cx(j), slot, dropT: 0, outT: 0, gone: false, keep: false, mv: null, born: S.age++ }, o);
    slot.m.visible = true; slot.m.scale.setScalar(1); slot.m.position.set(q.x, q.dropT > 0 ? 40 : 0, q.z); slot.m.rotation.y = 0;
    S.pieces.push(q); S.ver++; return q;
  }
  function retire(b, q) { if (q.gone) return; q.gone = true; q.outT = 0.45; b.state.ver++; if (q.ent && q.ent.alive) { q.ent.onDeath = null; q.ent.alive = false; q.ent.removeT = 0.01; } }
  const live = (S) => S.pieces.filter((q) => !q.gone);
  function spawnPawnEnt(b, q) {
    q.ent = b.spawnAdd({ name: 'Pawn', hp: 900, x: q.x, z: q.z, radius: 1.2, aimY: 1.7, color: EMBER, onDeath() { retire(b, q); } });
  }

  // Plan one Gambit: where movers go, where new pieces land, and which squares the strike hits.
  function plan(b, o) {
    const S = b.state, p = G.player, pc = cellOf(p.pos.x, p.pos.z) || { i: 4, j: 7 }, k = kingCell(b), reach = Math.max(8, (o.T - 1.5) * 7);
    const base = live(S);
    for (let attempt = 0; attempt < 80; attempt++) {
      const pos = base.map((q) => ({ q, type: q.type, i: q.i, j: q.j })), moves = [], drops = [];
      const taken = (i, j) => (i === k.i && j === k.j) || pos.some((r) => r.i === i && r.j === j) || drops.some((r) => r.i === i && r.j === j);
      for (const r of pos) {
        if (r.type === 'P') { if (o.pawns && r.j < 7 && !taken(r.i, r.j + 1) && !(pc.i === r.i && pc.j === r.j + 1)) { moves.push({ q: r.q, i: r.i, j: r.j + 1 }); r.j++; } continue; }
        if (!o.movers || !o.movers.includes(r.q)) continue;
        const opts = attacks(r.type, r.i, r.j, taken).map((c) => ({ i: c % 8, j: c >> 3 })).filter((c) => !taken(c.i, c.j) && !(c.i === pc.i && c.j === pc.j));
        if (opts.length) { const d = pick(opts); moves.push({ q: r.q, i: d.i, j: d.j }); r.i = d.i; r.j = d.j; }
      }
      let ok = true;
      for (const d of (o.fixed || [])) drops.push({ type: d.type, i: d.i, j: d.j });
      for (const type of (o.types || [])) {
        let placed = false;
        for (let t = 0; t < 30 && !placed; t++) { const i = rndi(0, 7), j = type === 'P' ? rndi(0, 3) : rndi(0, 7); if (taken(i, j) || (i === pc.i && j === pc.j)) continue; drops.push({ type, i, j }); placed = true; }
        if (!placed) ok = false;
      }
      if (!ok) continue;
      const all = pos.map((r) => ({ type: r.type, i: r.i, j: r.j })).concat(drops), struck = new Uint8Array(64);
      const occ = (i, j) => (i === k.i && j === k.j) || all.some((r) => r.i === i && r.j === j);
      for (const r of all) { struck[r.j * 8 + r.i] = 1; for (const c of attacks(r.type, r.i, r.j, occ)) struck[c] = 1; }
      const safe = []; let near = 1e9;
      for (let c = 0; c < 64; c++) if (!struck[c] && !occ(c % 8, c >> 3)) { safe.push(c); const d = Math.hypot(cx(c % 8) - p.pos.x, cx(c >> 3) - p.pos.z); if (d < near) near = d; }
      if (o.fixed || (safe.length >= 2 && safe.length <= (o.maxSafe || 40) && near <= reach)) return { moves, drops, struck, safe };
      if (attempt === 60 && o.types && o.types.length > 1) o = Object.assign({}, o, { types: o.types.slice(0, -1), maxSafe: 64 });
    }
    return null;
  }
  const sqHz = (i, j, delay, dmg, o) => Hz.rect(cx(i), cx(j) - C / 2 + 0.1, 0, C - 0.2, C - 0.2, delay, dmg, Object.assign({ quiet: true, silent: true }, o));

  function strikeFX(b) {
    const S = b.state; Sound.sfx('bigboom', 0.8); Sound.sfx('sword', 0.9, 0.6); FX.shake(0.6);
    if (G.headless) return;
    const L = live(S), occ = occFn(b, L);
    for (const q of L) {
      const rays = []; attacks(q.type, q.i, q.j, occ, rays); const h = HEIGHT[q.type] * 0.7;
      for (const [i, j] of rays) {
        _a.set(q.x, h, q.z); _b.set(cx(i), 0.3, cx(j));
        if (q.type === 'N') FX.missile(_a.clone(), _b.clone(), { speed: 60, arc: 5, color: EMBER, size: 0.4 });
        else FX.beam(_a.clone(), _b.clone(), { color: EMBER, width: q.type === 'P' ? 0.3 : 0.55, dur: 0.45, mult: 3 });
      }
      q.kick = 1;
    }
    FX.flash(EMBER, 0.12, 0.3);
  }
  function showArrows(S, moves) {
    S.arrows.forEach((a) => { a.visible = false; });
    moves.forEach((mv, n) => {
      const a = S.arrows[n]; if (!a) return; const x0 = mv.q.x, z0 = mv.q.z, x1 = cx(mv.i), z1 = cx(mv.j), len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.1) return;
      a.visible = true; a.position.set(x0, 0.16, z0); a.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      a.sh.scale.set(1, len - 1.2, 1); a.sh.position.set(0, 0, (len - 1.2) / 2); a.hd.position.set(0, 0, len - 1.0);
    });
  }
  const YOU = [['R', 'R', 'R', 'B', 'B', 'R', 'B', 'B'], ['N', 'N', 'B', 'B'], ['Q']];
  function setYou(b, t) { const S = b.state; if (S.you === t) return; S.you = t; S.dotKey = ''; for (const k in S.glyph) S.glyph[k].visible = k === t; Sound.sfx('ui', 0.8); if (!G.headless && G.player) FX.ring(G.player.pos.x, G.player.pos.z, { r0: 0.3, r1: 2.5, color: IVORY, dur: 0.4 }); }

  // The Gambit. o: {types, T, teach, pawns, movers, fixed, keep, name}
  function* gambit(b, o) {
    const S = b.state; S.inGambit = true;
    if (!o.fixed) { const seq = YOU[S.lvl]; setYou(b, seq[S.gcount % seq.length]); S.gcount++; }
    const pl = plan(b, o); if (!pl) { S.inGambit = false; yield 0.5; return; }
    showArrows(S, pl.moves);
    for (const d of pl.drops) {
      const q = place(b, d.type, d.i, d.j, { dropT: 1.1, keep: !!o.keep || d.type === 'P' || (d.type === 'Q' && !o.fixed) }); if (!q) continue; d.q = q;
      sqHz(d.i, d.j, 1.1, 300, { name: 'Crushed', onFire() { Sound.sfx('boom', 0.7, 0.7); FX.shake(0.35); if (!G.headless) FX.burst(q.x, 0.2, q.z, { n: 16, color: 0xb09070, speed: [2, 7], life: [0.3, 0.8], size: [0.2, 0.6], radius: 1.4 }); } });
    }
    S.raise = 1;
    let r = yield* b.cast({ name: o.name || 'Gambit', time: 1.1 }); if (r === 'dead') return;
    for (const d of pl.drops) if (d.q && d.type === 'P' && !d.q.gone) spawnPawnEnt(b, d.q);
    const T = o.T; S.pending = { struck: pl.struck, at: G.now + T }; S.safeHint = pl.safe;
    const cells = []; for (let c = 0; c < 64; c++) if (pl.struck[c]) cells.push(c);
    if (o.teach) for (const c of cells) sqHz(c % 8, c >> 3, T, 380, { name: 'Gambit' });
    let moved = !pl.moves.length, flashed = !!o.teach;
    r = yield* b.cast({ name: o.name || 'Gambit', time: T, onTick(k, cs) {
      if (!moved && cs.t >= T - 1.25) { moved = true; S.arrows.forEach((a) => { a.visible = false; }); for (const mv of pl.moves) { if (mv.q.gone) continue; mv.q.mv = { x0: mv.q.x, z0: mv.q.z, x1: cx(mv.i), z1: cx(mv.j), t: 0 }; mv.q.i = mv.i; mv.q.j = mv.j; } S.ver++; Sound.sfx('dash', 0.5, 0.7); }
      if (!flashed && cs.t >= T - 0.45) { flashed = true; for (const c of cells) sqHz(c % 8, c >> 3, 0.45, 380, { name: 'Gambit' }); Sound.sfx('warn', 0.5); }
    } });
    S.raise = 0; S.pending = null; S.safeHint = null; if (r === 'dead') return;
    strikeFX(b);
    // promotion: a pawn on the last rank becomes a queen
    for (const q of live(S)) if (q.type === 'P' && q.j >= 7 && live(S).filter((x) => x.type === 'Q').length < 2) { const i = q.i, j = q.j; retire(b, q); const nq = place(b, 'Q', i, j, { keep: true }); if (nq) { Sound.sfx('bell', 0.9, 0.5); FX.pillar(nq.x, nq.z, { r: 1.6, h: 16, color: EMBER, dur: 0.8 }); } }
    yield 0.5;
    for (const q of live(S)) if (!q.keep) retire(b, q);
    S.inGambit = false; yield 0.6;
  }
  function* edict(b) {
    const S = b.state, k = kingCell(b), hs = [];
    for (const [dx, dz] of ALL) if (inB(k.i + dx, k.j + dz)) hs.push(sqHz(k.i + dx, k.j + dz, 1.4, 330, { name: 'Edict', silent: false }));
    S.raise = 0.6; const r = yield* b.cast({ name: 'Edict', time: 1.4 }); S.raise = 0;
    if (r !== 'done') { for (const h of hs) Hz.cancel(h); yield 0.8; return; }
    Sound.sfx('bigboom', 0.7, 1.2); FX.shake(0.5); S.hop = 1; if (!G.headless) FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: C * 1.5, color: EMBER, dur: 0.4 });
    yield 0.9;
  }
  function* march(b, steps = 1) {
    const S = b.state, p = G.player;
    for (let n = 0; n < steps; n++) {
      const k = kingCell(b), pc = cellOf(p.pos.x, p.pos.z); if (!pc) break; if (Math.max(Math.abs(pc.i - k.i), Math.abs(pc.j - k.j)) <= 1) break;
      const occ = occFn(b, live(S)); let best = null, bd = 1e9;
      for (const [dx, dz] of ALL) { const i = k.i + dx, j = k.j + dz; if (!inB(i, j) || occ(i, j) || (i === pc.i && j === pc.j)) continue; const d = Math.hypot(cx(i) - p.pos.x, cx(j) - p.pos.z); if (d < bd) { bd = d; best = [i, j]; } }
      if (!best) break; S.hop = 1; Sound.sfx('boom', 0.4, 0.6);
      yield* b.moveTo(cx(best[0]), cx(best[1]), 11, { face: false }); b.pos.x = cx(best[0]); b.pos.z = cx(best[1]); S.ver++; FX.shake(0.2); yield 0.25;
    }
    yield 0.3;
  }
  function* castle(b) {
    const S = b.state, p = G.player, k = kingCell(b), occ = occFn(b, live(S)); let best = null, bd = -1;
    for (let t = 0; t < 24; t++) { const i = rndi(0, 7), j = rndi(0, 7); if (occ(i, j)) continue; const d = Math.hypot(cx(i) - p.pos.x, cx(j) - p.pos.z); if (d > bd && d < 26) { bd = d; best = [i, j]; } }
    if (!best) return;
    const r = yield* b.cast({ name: 'Castle', time: 0.9 }); if (r !== 'done') { yield 0.5; return; }
    if (!G.headless) { FX.pillar(b.pos.x, b.pos.z, { r: 1.8, h: 18, color: EMBER, dur: 0.5 }); FX.pillar(cx(best[0]), cx(best[1]), { r: 1.8, h: 18, color: EMBER, dur: 0.5 }); }
    Sound.sfx('blink', 0.9, 0.6); b.pos.x = cx(best[0]); b.pos.z = cx(best[1]); S.ver++;
    yield* gambit(b, { fixed: [{ type: 'R', i: k.i, j: k.j }], T: 2.0, teach: true, name: 'Castle' });
  }
  function* stalemate(b) {
    const S = b.state; S.raise = 1;
    const r = yield* b.cast({ name: 'Stalemate', time: 2.8, interruptible: true }); S.raise = 0;
    if (r === 'done') { b.hp = Math.min(b.maxHp * 0.33, b.hp + b.maxHp * 0.04); Sound.sfx('bell', 1, 0.4); FX.pillar(b.pos.x, b.pos.z, { r: 2.2, h: 20, color: 0x60ff90, dur: 0.9 }); }
    yield 0.6;
  }

  function look(b, n, instant) {
    const S = b.state, I = [2.7, 2.4, 2.0][n], rim = [0.6, 1.0, 1.5][n], fog = [0x140a05, 0x160806, 0x1c0604][n];
    S.lookT = { I, rim, fog: new THREE.Color(fog) }; if (instant) { S.key.intensity = I; S.rim.intensity = rim; S.fog.color.copy(S.lookT.fog); }
  }
  function setAct(b, n) {
    const S = b.state; S.lvl = n; S.pending = null; S.safeHint = null; S.inGambit = false; S.raise = 0; S.arrows.forEach((a) => { a.visible = false; });
    for (const q of live(S)) { if (q.mv) { q.x = q.mv.x1; q.z = q.mv.z1; q.mv = null; } if (!q.keep) retire(b, q); }
    look(b, n, false);
  }
  const P1 = [['R'], ['R', 'B'], ['R', 'N'], ['B', 'B', 'N'], ['R', 'B', 'P', 'P'], ['N', 'N', 'R']], MIX = ['R', 'B', 'N'];

  G.bosses.push({
    id: 'chess', name: 'ZUGZWANG', title: 'The Last Grandmaster', hint: 'Your move', color: '#ffd9a0', telegraph: 0xff5a28,
    hp: 24000, radius: 1.7, aimY: 3.4, enrage: 440,
    post: { bloom: 0.5, threshold: 0.86, radius: 0.7, exposure: 1.05, vig: 1.15, sat: 1.05, contrast: 1.08, tint: [1.04, 1.0, 0.94] },
    music: { bpm: 112, root: 38, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 0, 3, 4, 0, 5, 3, 4],
      layers: [
        { v: 'pulse', pat: ['0.2.4.2.0.2.4.7.', '0.2.4.2.6.4.2.1.'], oct: 1, len: 1, vol: 0.06 }, { v: 'bass', pat: '0.....0...0.....', oct: -1, len: 3, vol: 0.13 }, { v: 'hat', pat: '..x...x...x...x.', vol: 0.05 },
        { v: 'organ', from: 1, pat: ['0.......4.......', '2.......4.......'], oct: 0, len: 8, vol: 0.07 }, { v: 'taiko', from: 1, pat: 'x.......x...x...', vol: 0.2 }, { v: 'arp', from: 1, pat: '0247420702474207', oct: 1, len: 1, vol: 0.04 },
        { v: 'brass', from: 2, pat: ['0.......7.......', '5.......4...6...'], oct: 0, len: 7, vol: 0.11 }, { v: 'taiko', from: 2, pat: 'x.x...x.x.x..xx.', vol: 0.2 }, { v: 'snare', from: 2, pat: '....x.......x...', vol: 0.12 },
      ] },
    build,
    *intro(b) { Sound.sfx('bell', 0.7, 0.5); yield* Cam.shot([cx(7) + 6, 1.4, cx(7) + 8], [cx(3), 4.5, cx(1)], [cx(4) + 1, 3.6, cx(3)], [cx(3), 4.2, cx(1)], 5.0, 44); },
    *death(b) {
      const S = b.state, a = Cam.yaw + 0.5; Cam.cine = { pos: new V3(b.pos.x - Math.sin(a) * 15, 7, b.pos.z - Math.cos(a) * 15), look: new V3(b.pos.x, 2.5, b.pos.z), fov: 42 };
      S.fallA = Cam.yaw + PI / 2; S.falling = 0.001; Sound.sfx('bell', 1, 0.35);
      for (const q of live(S)) { q.topple = 0.001 + Math.hypot(q.x - b.pos.x, q.z - b.pos.z) * -0.012; }
      yield 0.75; Sound.sfx('bigboom', 1, 0.5); FX.shake(0.9); FX.flash(0xffffff, 0.35, 1.2); yield 0.6;
    },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setAct(b, 0); yield 1.0; let n = 0;
        while (true) {
          const types = n < P1.length ? P1[n] : [pick(MIX), pick(MIX), pick(['N', 'P', 'B']), pick(['R', 'P'])];
          yield* gambit(b, { types, T: n < 2 ? 5.5 : n < 5 ? 5.0 : 4.5, teach: n < 2 && !S.taughtAll }); n++; if (n >= 2) S.taughtAll = true;
          yield* edict(b); yield* march(b, 2);
          if (n % 2 === 0) yield* edict(b);
        }
      } },
      { at: 0.66, skipTo(b) { look(b, 1, true); },
        *enter(b) {
          const S = b.state; setAct(b, 1); S.raise = 1;
          yield* b.cast({ name: 'The Queen', time: 1.4, onTick: (k) => FX.shake(k * 0.2) });
          const p = G.player, pc = cellOf(p.pos.x, p.pos.z) || { i: 4, j: 7 }, k = kingCell(b); let qi = 3, qj = 3; for (let t = 0; t < 30; t++) { qi = rndi(1, 6); qj = rndi(1, 5); if (!(qi === pc.i && qj === pc.j) && !(qi === k.i && qj === k.j)) break; }
          const q = place(b, 'Q', qi, qj, { dropT: 1.3, keep: true });
          sqHz(qi, qj, 1.3, 300, { name: 'Crushed', tag: 'fight', onFire() { Sound.sfx('bigboom', 1, 0.6); FX.shake(0.9); FX.flash(EMBER, 0.25, 0.8); if (!G.headless && q) { FX.ring(q.x, q.z, { r0: 1, r1: 16, color: EMBER, dur: 0.7 }); FX.burst(q.x, 0.3, q.z, { n: 50, color: EMBER, color2: 0xffffff, speed: [3, 14], life: [0.4, 1.1], size: [0.2, 0.6] }); } } });
          Co.start(Post.lerpTo({ tint: [1.12, 0.96, 0.86], bloom: 0.56 }, 3), 'fight'); yield 2.0; S.raise = 0;
        },
        *run(b) {
          const S = b.state; setAct(b, 1); yield 0.6; let n = 0;
          while (true) {
            const queens = live(S).filter((q) => q.type === 'Q'), pawns = live(S).filter((q) => q.type === 'P').length;
            const types = [pick(MIX)]; if (n % 2 === 1) types.push(pick(MIX)); if (pawns < 2 && n % 2 === 0) types.push('P');
            yield* gambit(b, { types, T: 5.0, pawns: true, movers: queens }); n++;
            yield* edict(b); yield* march(b, 2);
            if (n % 3 === 0) yield* castle(b);
          }
        } },
      { at: 0.33, skipTo(b) { look(b, 2, true); },
        *enter(b) {
          const S = b.state; setAct(b, 2); S.raise = 1; Sound.sfx('roar', 0.8, 0.5);
          yield* b.cast({ name: 'Blitz', time: 2.2, onTick: (k) => FX.shake(k * 0.3) }); S.raise = 0;
          FX.flash(EMBER, 0.3, 1.0); Co.start(Post.lerpTo({ tint: [1.18, 0.9, 0.8], bloom: 0.62, contrast: 1.12 }, 3), 'fight');
          yield* gambit(b, { types: ['R', 'N'], T: 4.2, keep: true, pawns: true, name: 'Blitz' });
        },
        *run(b) {
          const S = b.state; setAct(b, 2); yield 0.4; let n = 0;
          while (true) {
            let L = live(S).filter((q) => q.type !== 'P'); L.sort((x, y) => x.born - y.born);
            while (L.length > 5) { const old = L.find((q) => q.type !== 'Q') || L[0]; retire(b, old); L = L.filter((q) => q !== old); }
            const mover = L.length ? [pick(L)] : [];
            yield* gambit(b, { types: [pick(MIX)], T: 3.2, keep: true, pawns: true, movers: mover, maxSafe: 30 }); n++;
            if (n % 2 === 0) { yield* edict(b); yield* march(b, 2); }
            if (n % 4 === 3) yield* stalemate(b);
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      // pieces: drop, slide, sink
      for (let n = S.pieces.length - 1; n >= 0; n--) {
        const q = S.pieces[n], m = q.slot.m;
        if (q.dropT > 0) { q.dropT -= dt; const k = Math.max(0, q.dropT) / 1.1; m.position.y = 40 * k * k; }
        else if (!q.topple) m.position.y = 0;
        if (q.mv) { q.mv.t += dt / 0.6; const k = smooth(q.mv.t); q.x = lerp(q.mv.x0, q.mv.x1, k); q.z = lerp(q.mv.z0, q.mv.z1, k); m.position.y = Math.sin(k * PI) * 0.6; if (q.mv.t >= 1) { q.x = q.mv.x1; q.z = q.mv.z1; q.mv = null; } }
        if (q.kick > 0) { q.kick -= dt * 3; m.scale.set(1 + Math.max(0, q.kick) * 0.12, 1 - Math.max(0, q.kick) * 0.1, 1 + Math.max(0, q.kick) * 0.12); }
        m.position.x = q.x; m.position.z = q.z;
        if (q.ent) { q.ent.pos.x = q.x; q.ent.pos.z = q.z; }
        if (q.topple) { q.topple += dt; if (q.topple > 0) { m.rotation.z = -Math.min(PI / 2, q.topple * q.topple * 9); m.rotation.y = 0.4 * q.born; } }
        if (q.gone) { q.outT -= dt; const k = Math.max(0, q.outT / 0.45); m.scale.setScalar(Math.max(0.001, k)); m.position.y = -(1 - k) * 1.5; if (q.outT <= 0) { m.visible = false; m.rotation.set(0, 0, 0); q.slot.used = false; S.pieces.splice(n, 1); } }
      }
      // the look
      if (S.lookT) { S.key.intensity = damp(S.key.intensity, S.lookT.I, 1.2, dt); S.rim.intensity = damp(S.rim.intensity, S.lookT.rim, 1.2, dt); S.fog.color.lerp(S.lookT.fog, 1 - Math.exp(-1.2 * dt)); }
      const burn = sat(G.ft / 440), ch = 34 - burn * 26; S.candle.scale.y = ch; S.candle.position.y = ch / 2 + 1; const fl = 1 + Math.sin(t * 11) * 0.06 + Math.sin(t * 23.7) * 0.04;
      S.flame.position.set(-62, ch + 5.5, -74); S.flame.scale.set(fl, 2.3 * fl, fl); S.halo.position.copy(S.flame.position); S.flameM.color.setHex(0xffb050).multiplyScalar(3.2 * fl); S.hearth.material.opacity = 0.45 + Math.sin(t * 3.1) * 0.05 + S.lvl * 0.12;
      // the King
      S.hop = Math.max(0, (S.hop || 0) - dt * 2.6); S.raiseK = damp(S.raiseK || 0, S.raise || 0, 6, dt);
      if (S.falling) { S.falling += dt; S.rig.rotation.order = 'YXZ'; S.rig.rotation.y = S.fallA - b.facing; S.rig.rotation.x = Math.min(PI / 2, S.falling * S.falling * 7); }
      else { S.rig.position.y = Math.sin(S.hop * PI) * 1.1 + S.raiseK * 0.5 + Math.sin(t * 1.6) * 0.04; S.rig.rotation.y = -b.facing + Math.sin(t * 0.7) * 0.05; }
      const hot = 2.2 + S.raiseK * (2.5 + Math.sin(t * 14)) + S.lvl * 0.8; S.glowM.color.setHex(EMBER).multiplyScalar(hot); S.crackM.color.setHex(EMBER).multiplyScalar(1.5 + S.lvl * 1.5 + S.raiseK * 2); S.light.intensity = 30 + S.lvl * 25 + S.raiseK * 40;
      if (!p) return;
      // you are a piece: dots on the squares you attack; put the King under one to give check
      S.checkCd = Math.max(0, S.checkCd - dt); S.checkT = Math.max(0, S.checkT - dt);
      const fighting = G.state === 'fight' && p.alive && !!S.you, pc = cellOf(p.pos.x, p.pos.z), k = kingCell(b);
      let check = false;
      if (fighting && pc) {
        const key = S.you + pc.i + pc.j + ':' + S.ver + (S.checkCd > 0 ? 'c' : '');
        if (key !== S.dotKey) {
          S.dotKey = key; const cells = attacks(S.you, pc.i, pc.j, occFn(b, live(S))); S.dotCells = cells; S.dotCheck = cells.includes(k.j * 8 + k.i);
          let n = 0; for (const c of cells) { const i = c % 8, j = c >> 3, isK = i === k.i && j === k.j; if (!isK && live(S).some((q) => q.i === i && q.j === j)) continue; if (isK) continue; _m.position.set(cx(i), 0.07, cx(j)); _m.rotation.set(0, 0, 0); _m.scale.setScalar(0.26); _m.updateMatrix(); S.dotI.setMatrixAt(n, _m.matrix); _c.setHex(IVORY).multiplyScalar(S.checkCd > 0 ? 0.22 : 0.5); S.dotI.setColorAt(n, _c); n++; }
          S.dotI.count = n; S.dotI.instanceMatrix.needsUpdate = true; S.dotI.instanceColor.needsUpdate = true;
        }
        check = S.dotCheck;
      } else if (S.dotI.count) { S.dotI.count = 0; S.dotKey = ''; }
      if (check && S.checkCd <= 0 && !b.transitioning && !b.immune) {
        S.checkHold += dt;
        if (S.checkHold >= 0.5) {
          S.checkHold = 0; S.checkT = 8; S.checkCd = 13; S.dotKey = ''; Sound.sfx('bell', 1, 1.3); Sound.sfx('crit', 0.7);
          if (!G.headless) { FX.ring(b.pos.x, b.pos.z, { r0: 0.5, r1: 7, color: GOLD, dur: 0.6 }); FX.num(b.aim(_a), 'CHECK', 'note'); FX.beam(new V3(p.pos.x, 1.2, p.pos.z), new V3(b.pos.x, 3, b.pos.z), { color: GOLD, width: 0.3, dur: 0.5, mult: 3 }); }
          if (b.castState && !S.inGambit && !b.castState.int) { b.castState.result = 'interrupted'; b.stagger = 1.2; S.hop = 0.6; }
        }
      } else S.checkHold = 0;
      b.dmgTaken = S.checkT > 0 ? 1.2 : 0.8;
      S.crown.visible = (S.checkT > 0 || (check && S.checkCd <= 0)) && !S.falling; if (S.crown.visible) { S.crown.position.set(b.pos.x, 0.09, b.pos.z); S.crown.rotation.z = t * 0.8; S.crown.material.opacity = S.checkT > 0 ? 0.55 + Math.sin(t * 6) * 0.25 : 0.35; S.crown.scale.setScalar(S.checkT > 0 ? 1 : 0.8 + S.checkHold * 0.4); }
      const gl = S.glyph[S.you]; if (gl) { gl.visible = fighting; gl.position.set(p.pos.x, p.pos.y + 2.55 + Math.sin(t * 2.2) * 0.06, p.pos.z); gl.rotation.y = t * 0.9; S.glyphM.color.setHex(S.checkT > 0 ? GOLD : IVORY).multiplyScalar(S.checkT > 0 ? 1.8 : 1.2); }
    },
    danger(b, x, z) { const P = b.state.pending; if (!P) return Infinity; const c = cellOf(x, z); if (!c || !P.struck[c.j * 8 + c.i]) return Infinity; return Math.max(0, P.at - G.now); },
    bot(b, p) {
      const S = b.state, L = live(S), avoid = (x, z) => L.some((q) => Math.hypot(x - q.x, z - q.z) < 2.1);
      if (S.safeHint && S.safeHint.length) { let best = -1, bd = 1e9; for (const c of S.safeHint) { const d = Math.hypot(cx(c % 8) - p.pos.x, cx(c >> 3) - p.pos.z) + Math.hypot(cx(c % 8) - b.pos.x, cx(c >> 3) - b.pos.z) * 0.15; if (d < bd) { bd = d; best = c; } } return { x: cx(best % 8), z: cx(best >> 3), w: 3, avoid }; }
      let target = b; for (const q of L) if (q.ent && q.ent.alive && q.j >= 4) target = q.ent;
      return { avoid, target };
    },
  });
})();
