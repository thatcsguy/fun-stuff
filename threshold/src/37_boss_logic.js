// DOOR XVIII: DAEMON, the Truth Table. The floor is a circuit and it really computes. The bits along the south edge
// are yours to flip; when he executes, every output that evaluates TRUE is electrocuted, including the one he floats over.
(() => {
  const H = 18, CY = 0x30e0ff, MG = 0xff3fd0, AMBER = 0xffa040, TEL = 0xff8a30, FLOW = 1.0;
  const ZX = [-12, 0, 12], ZN = -H, ZS = -5, N = 1024, U = N / (2 * H), px = (v) => (v + H) * U;
  const zoneOf = (x, z) => z > ZS ? -1 : x < -6 ? 0 : x < 6 ? 1 : 2;
  const _c = new THREE.Color(), _a = new V3(), _b = new V3();

  // <circuit> (pure: fuzzed in node by tools/logicfuzz.js)
  const OPS = { NOT: (a) => !a, AND: (a, b) => a && b, OR: (a, b) => a || b, XOR: (a, b) => a !== b, NAND: (a, b) => !(a && b), NOR: (a, b) => !(a || b) };
  // { n inputs, flip: how many of them can be flipped, gates: [{ op, a, b, zone, lvl }], out: gate index per zone, latch: zone fed back as input 3 }
  // a reference r < n is input r, otherwise gate r - n
  function evalC(C, bits) { const v = [], get = (r) => r < C.n ? !!bits[r] : v[r - C.n]; C.gates.forEach((g, i) => { v[i] = OPS[g.op](get(g.a), g.b === undefined ? false : get(g.b)); }); return { v, out: C.out.map((i) => v[i]) }; }
  function genC(lvl, rng) {
    const pk = (a) => a[Math.floor(rng() * a.length)], sh = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
    if (lvl === 0) { const gates = sh(['NOT', 'AND', 'OR']).map((op, z) => { const s = sh([0, 1, 2]); return op === 'NOT' ? { op, a: s[0], zone: z, lvl: 1 } : { op, a: Math.min(s[0], s[1]), b: Math.max(s[0], s[1]), zone: z, lvl: 1 }; }); return { n: 3, flip: 3, gates, out: [0, 1, 2], latch: -1 }; }
    const n = 4, O = lvl === 1 ? ['AND', 'OR', 'XOR'] : ['AND', 'OR', 'XOR', 'NAND', 'NOR'], gates = [], out = [], useQ = lvl === 2 ? sh([0, 1, 2]).slice(0, 1 + Math.floor(rng() * 2)) : [];
    for (let z = 0; z < 3; z++) {
      const s = sh(lvl === 1 ? [0, 1, 2, 3] : [0, 1, 2]), c = useQ.indexOf(z) >= 0 ? 3 : s[2];
      gates.push({ op: pk(O), a: Math.min(s[0], s[1]), b: Math.max(s[0], s[1]), zone: z, lvl: 0 });
      gates.push({ op: pk(O), a: n + gates.length - 1, b: c, zone: z, lvl: 1 }); out.push(gates.length - 1);
    }
    return { n, flip: lvl === 1 ? 4 : 3, gates, out, latch: lvl === 2 ? Math.floor(rng() * 3) : -1 };
  }
  // the best set of at most two flips: one that leaves somewhere to stand, and if possible shorts the zone `bz`
  function solveC(C, bits, bz) {
    const sets = [[]]; for (let i = 0; i < C.flip; i++) { sets.push([i]); for (let j = i + 1; j < C.flip; j++) sets.push([i, j]); }
    let best = null;
    for (const f of sets) { const bb = bits.slice(); f.forEach((i) => { bb[i] = !bb[i]; }); const o = evalC(C, bb).out; if (o.every((v) => v)) continue; const short = bz >= 0 && o[bz], sc = (short ? 10 : 0) - f.length; if (!best || sc > best.sc) best = { flips: f, short, sc, out: o }; }
    return best;
  }
  function makeC(lvl, rng, bits, bz) { // always survivable; where it can be, shortable but not already shorted
    let fall = null;
    for (let k = 0; k < 60; k++) { const C = genC(lvl, rng), s = solveC(C, bits, bz); if (!s) continue; if (!fall) fall = C; if (s.short && s.flips.length > 0) return C; }
    return fall || genC(0, rng);
  }
  // </circuit>

  // ---- the board: traces and gate symbols painted on the floor, redrawn whenever the circuit or a bit changes ----
  function baseCanvas() {
    const cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d'), r = mulberry(1808);
    x.fillStyle = '#0a2a1e'; x.fillRect(0, 0, N, N);
    x.strokeStyle = 'rgba(40,110,80,0.16)'; x.lineWidth = 1; for (let i = 0; i <= 36; i++) { x.beginPath(); x.moveTo(i * U, 0); x.lineTo(i * U, N); x.moveTo(0, i * U); x.lineTo(N, i * U); x.stroke(); }
    x.strokeStyle = 'rgba(30,120,84,0.35)'; x.lineWidth = 2; x.fillStyle = 'rgba(30,120,84,0.5)';
    for (let i = 0; i < 70; i++) { let a = Math.floor(r() * 36) + 0.5, b = Math.floor(r() * 36) + 0.5; x.beginPath(); x.moveTo(a * U, b * U); for (let k = 0; k < 3; k++) { if (r() < 0.5) a += Math.floor(r() * 7) - 3; else b += Math.floor(r() * 7) - 3; x.lineTo(a * U, b * U); } x.stroke(); x.beginPath(); x.arc(a * U, b * U, 4, 0, TAU); x.fill(); }
    x.fillStyle = 'rgba(4,20,16,0.5)'; x.fillRect(0, 0, N, px(ZS));
    x.strokeStyle = 'rgba(200,160,70,0.85)'; x.lineWidth = 4; for (let z = 0; z < 3; z++) x.strokeRect(px(ZX[z] - 6) + 5, px(ZN) + 5, 12 * U - 10, (ZS - ZN) * U - 10);
    x.lineWidth = 6; x.strokeRect(3, 3, N - 6, N - 6);
    return cv;
  }
  function glyph(x, op, gx, gz, s, col, fill) {
    x.save(); x.translate(px(gx), px(gz)); x.scale(s * U, s * U * 1.35); x.lineWidth = 0.13; x.strokeStyle = col; x.fillStyle = fill; x.lineJoin = 'round';
    const bub = (y) => { x.beginPath(); x.arc(0, y, 0.2, 0, TAU); x.fill(); x.stroke(); };
    if (op === 'NOT') { x.beginPath(); x.moveTo(-0.85, 1); x.lineTo(0.85, 1); x.lineTo(0, -0.7); x.closePath(); x.fill(); x.stroke(); bub(-0.9); }
    else if (op === 'AND' || op === 'NAND') { x.beginPath(); x.moveTo(-1, 1); x.lineTo(-1, -0.1); x.arc(0, -0.1, 1, PI, TAU); x.lineTo(1, 1); x.closePath(); x.fill(); x.stroke(); if (op === 'NAND') bub(-1.3); }
    else { x.beginPath(); x.moveTo(-1, 1); x.quadraticCurveTo(0, 0.4, 1, 1); x.quadraticCurveTo(1, -0.45, 0, -1.1); x.quadraticCurveTo(-1, -0.45, -1, 1); x.closePath(); x.fill(); x.stroke();
      if (op === 'XOR') { x.beginPath(); x.moveTo(-1, 1.36); x.quadraticCurveTo(0, 0.76, 1, 1.36); x.stroke(); } if (op === 'NOR') bub(-1.3); }
    x.restore();
  }
  const gatePos = (g) => g.lvl === 0 ? { x: ZX[g.zone] - 1.1, z: 5.4, s: 1.2, d: 0.85 } : { x: ZX[g.zone], z: -1.8, s: 1.55, d: 1.1 };
  const draw = (S) => { S.dirty = true; }; // painted on the next rendered frame
  function paint(S) {
    S.dirty = false; if (!S.baseCv) S.baseCv = baseCanvas(); const x = S.ctx, C = S.C; x.drawImage(S.baseCv, 0, 0);
    if (C) {
      const rev = S.rev, E = S.shown, LIT = '#ff58dc', OFF = '#1c9cc0', IDLE = '#c09a44';
      const col = (need, val) => rev >= need && E ? (val ? LIT : OFF) : IDLE;
      const line = (pts, c, wd) => { for (const [cc, w] of [['#020806', wd + 7], [c, wd]]) { x.strokeStyle = cc; x.lineWidth = w; x.lineJoin = x.lineCap = 'round'; x.beginPath(); pts.forEach((q, i) => i ? x.lineTo(px(q[0]), px(q[1])) : x.moveTo(px(q[0]), px(q[1]))); x.stroke(); } };
      if (rev >= 4 && E) E.out.forEach((v, z) => { x.fillStyle = v ? 'rgba(255,60,210,0.34)' : 'rgba(40,200,230,0.10)'; x.fillRect(px(ZX[z] - 6) + 7, px(ZN) + 7, 12 * U - 14, (ZS - ZN) * U - 14); });
      if (C.latch >= 0) line([[ZX[C.latch], -4.3], [-17.3, -4.3], [-17.3, 14.4], [-16.9, 14.4]], rev >= 4 && E ? (E.out[C.latch] ? LIT : OFF) : '#7a58c8', 5);
      let row = 0;
      C.gates.forEach((g, gi) => {
        const P = gatePos(g), pins = g.b === undefined ? [[g.a, P.x]] : [[g.a, P.x - P.d], [g.b, P.x + P.d]];
        for (const [r, pxx] of pins) {
          if (r < C.n) { const ip = S.ipos[r], rz = 12.6 - (row++) * 0.55; line([[ip, 13.3], [ip, rz], [pxx, rz], [pxx, P.z + P.s * 0.5]], col(1, E && S.shownBits[r]), 6); }
          else { const Q = gatePos(C.gates[r - C.n]); line([[Q.x, Q.z], [pxx, P.z + P.s * 0.5]], col(2, E && E.v[r - C.n]), 6); }
        }
        if (g.lvl === 1) line([[P.x, P.z], [P.x, ZS + 0.25]], col(3, E && E.v[gi]), 7);
      });
      C.gates.forEach((g, gi) => { const P = gatePos(g), need = g.lvl === 0 ? 2 : 3, on = rev >= need && E; glyph(x, g.op, P.x, P.z, P.s, on ? (E.v[gi] ? LIT : OFF) : '#f0c868', on && E.v[gi] ? 'rgba(120,20,100,0.95)' : 'rgba(4,22,16,0.95)'); });
      for (let i = 0; i < C.n; i++) { const ix = S.ipos[i], on = S.bits[i], q = i >= C.flip; x.fillStyle = on ? 'rgba(255,70,215,0.85)' : 'rgba(6,30,24,0.95)'; x.strokeStyle = q ? '#9a78e8' : i === S.skew ? '#ff9a30' : '#f0c868'; x.lineWidth = i === S.skew ? 7 : 4;
        if (q) { x.beginPath(); x.arc(px(ix), px(14.6), 1.25 * U, 0, TAU); x.fill(); x.stroke(); } else { x.fillRect(px(ix - 1.3), px(13.3), 2.6 * U, 2.6 * U); x.strokeRect(px(ix - 1.3), px(13.3), 2.6 * U, 2.6 * U); if (i === S.skew) { x.setLineDash([10, 8]); x.strokeRect(px(ix - 1.75), px(12.85), 3.5 * U, 3.5 * U); x.setLineDash([]); } } }
    }
    S.tex.needsUpdate = true;
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x010608, horizon: 0x0a3a34, bottom: 0x010405, stars: 0.5, nebula: 0.5, nebulaA: 0x0a5a50, nebulaB: 0x402a70, sunSize: 0, sunGlow: 0, exp: 0.7 });
    g.add(sky); S.sky = sky; W.env(sky, 0.9);
    scene.fog = new THREE.FogExp2(0x03100e, 0.006);
    S.hemi = W.hemi(g, 0x9fd8d0, 0x2a3a30, 1.25);
    S.sun = W.sun(g, { dir: [-0.3, 1, 0.4], color: 0xcfeee8, intensity: 1.7, size: 30 });
    S.baseCv = null; S.cv = document.createElement('canvas'); S.cv.width = S.cv.height = N; S.ctx = S.cv.getContext('2d');
    S.tex = new THREE.CanvasTexture(S.cv); S.tex.colorSpace = THREE.SRGBColorSpace; S.tex.anisotropy = 8;
    S.floorM = new THREE.MeshStandardMaterial({ map: S.tex, emissiveMap: S.tex, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.42, metalness: 0.25, envMapIntensity: 0.5 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * H, 2 * H), S.floorM); floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    const pcb = W.mat({ color: 0x06241a, roughness: 0.6, metalness: 0.2 }), gold = W.mat({ color: 0xc09a44, roughness: 0.3, metalness: 0.95 }), black = W.mat({ color: 0x0c0e12, roughness: 0.45, metalness: 0.4 }), alu = W.mat({ color: 0x8a96a4, roughness: 0.3, metalness: 0.95 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2 * H + 2, 4, 2 * H + 2), pcb); slab.position.y = -2.02; g.add(slab);
    for (const [x, z, w, d] of [[0, -H - 0.5, 2 * H + 2, 1], [0, H + 0.5, 2 * H + 2, 1], [-H - 0.5, 0, 1, 2 * H], [H + 0.5, 0, 1, 2 * H]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), gold); m.position.set(x, 0.3, z); m.castShadow = true; g.add(m); }
    const under = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), W.mat({ color: 0x031410, roughness: 0.8, metalness: 0.1 })); under.rotation.x = -PI / 2; under.position.y = -4; g.add(under);
    // the skyline: capacitors, chips and heat sinks the size of buildings
    const r = mulberry(404); S.sinkM = new THREE.MeshStandardMaterial({ color: 0x55606c, roughness: 0.35, metalness: 0.9, emissive: 0xff7a28, emissiveIntensity: 0 }); S.capM = [];
    for (let i = 0; i < 34; i++) {
      const a = i / 34 * TAU + r() * 0.15, d = 34 + r() * 26, x = Math.sin(a) * d, z = Math.cos(a) * d, k = Math.floor(r() * 3);
      if (Math.abs(x) < 15 && z < -20 && z > -40) continue;
      if (k === 0) { const h = 7 + r() * 13, rr = 2 + r() * 2.5, c = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, h, 20), W.mat({ color: [0x16306a, 0x1a1a22, 0x4a2a12][Math.floor(r() * 3)], roughness: 0.35, metalness: 0.5 })); c.position.set(x, h / 2 - 4, z); g.add(c); const top = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.96, rr * 0.96, 0.3, 20), alu); top.position.set(x, h - 4 + 0.1, z); g.add(top); }
      else if (k === 1) { const w = 6 + r() * 8, h = 2 + r() * 3, c = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.7), black); c.position.set(x, h / 2 - 3.6, z); c.rotation.y = Math.round(r() * 2) * PI / 2; g.add(c); const lm = W.glow(r() < 0.5 ? CY : 0x40ff90, 2.5), led = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), lm); led.position.set(x, h - 3.5, z); g.add(led); S.capM.push({ m: lm, f: 0.5 + r() * 3, c: lm.color.clone() }); }
      else { const w = 5 + r() * 5, h = 5 + r() * 8, base = new THREE.Group(); for (let f = 0; f < 7; f++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.28), S.sinkM); fin.position.set(0, h / 2, (f - 3) * 0.75); base.add(fin); } base.position.set(x, -4, z); base.rotation.y = a; g.add(base); }
    }
    // the system clock: a quartz can on the north wall that pulses with every cycle
    const osc = new THREE.Mesh(new THREE.CapsuleGeometry(4.2, 16, 6, 18), alu); osc.rotation.z = PI / 2; osc.position.set(0, 2.5, -31); osc.scale.z = 0.55; g.add(osc);
    S.oscM = W.glow(CY, 1.2, { transparent: true, opacity: 0.9 }); const ow = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), S.oscM); ow.position.set(0, 3, -28.6); g.add(ow);
    // the same schematic, hanging in the air to the north so it can be read from anywhere
    S.holoM = new THREE.MeshBasicMaterial({ map: S.tex, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xb0fff0 });
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), S.holoM); holo.position.set(0, 9.6, -22.5); holo.rotation.x = 0.1; g.add(holo);
    S.motes = W.motes({ n: 240, box: [70, 30, 70], color: 0x60ffe0, size: 0.14, vel: [0, 1.6, 0], sway: 0.2, center: [0, 12, 0], alpha: 0.5 }); g.add(S.motes);
    // the bits: four lamp pylons, each one an entity so that any hit toggles it
    S.pyl = []; const postG = new THREE.CylinderGeometry(0.2, 0.32, 1.7, 10), lampG = new THREE.SphereGeometry(0.55, 16, 12), cageG = new THREE.TorusGeometry(0.72, 0.05, 6, 20);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Group(), post = new THREE.Mesh(postG, black); post.position.y = 0.85; post.castShadow = true; m.add(post);
      const lm = W.glow(MG, 0.1), lamp = new THREE.Mesh(lampG, lm); lamp.position.y = 2.1; m.add(lamp);
      const cage = new THREE.Mesh(cageG, gold); cage.position.y = 2.1; cage.rotation.x = PI / 2; m.add(cage);
      const ent = b.spawnAdd({ name: 'Bit', hp: 1e7, x: 0, z: 14.6, radius: 0.9, aimY: 2.0, mesh: m, color: MG, onDamaged() { if (S.pyl[i].lock <= 0 && S.C && i < S.C.flip) toggle(b, i); } });
      S.pyl.push({ ent, lm, lock: 0, k: 0 });
    }
    S.forkG = new THREE.OctahedronGeometry(0.75); S.forkM = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.3, metalness: 0.8, emissive: AMBER, emissiveIntensity: 1.6, flatShading: true });
    // ---- Daemon: a core in a cage of rings ----
    S.rig = new THREE.Group(); b.group.add(S.rig);
    S.coreM = new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.22, metalness: 0.9, flatShading: true, emissive: CY, emissiveIntensity: 0.25 });
    S.core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 0), S.coreM); S.core.castShadow = true; S.rig.add(S.core);
    S.edgeM = new THREE.LineBasicMaterial({ color: new THREE.Color(CY).multiplyScalar(2.5) }); S.core.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.18, 0)), S.edgeM));
    S.eyeM = W.glow(CY, 5); S.eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), S.eyeM); S.eye.position.z = 1.25; S.rig.add(S.eye);
    S.ringM = new THREE.MeshStandardMaterial({ color: 0xc09a44, roughness: 0.25, metalness: 0.95, emissive: CY, emissiveIntensity: 0.15 });
    S.rings = [1.75, 2.1, 2.45].map((rr, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.07, 8, 56), S.ringM); m.castShadow = true; S.rig.add(m); return m; });
    S.light = new THREE.PointLight(CY, 16, 22, 1.7); S.light.position.y = 3; b.group.add(S.light);
    Object.assign(S, { lvl: 0, live: true, bits: [false, true, false, false], C: null, bz: 1, skew: -1, rev: 0, shown: null, shownBits: [], ipos: [-8, 0, 8, 99], exec: null, down: 0, look: 0, lookT: 0, forks: 0, botT: 0, hov: 2.6 });
    layout(b, 0); draw(S);
    return {
      edge: 'wall', spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: -11, face: 0 }, camDist: 17, camPitch: 0.52,
      contains: (x, z) => Math.abs(x) <= H - 0.5 && Math.abs(z) <= H - 0.5,
      clamp(p) { p.x = clamp(p.x, -H + 0.5, H - 0.5); p.z = clamp(p.z, -H + 0.5, H - 0.5); },
      solid(p) { for (const q of S.pyl) { if (!q.ent.group.visible) continue; const dx = p.x - q.ent.pos.x, dz = p.z - q.ent.pos.z, d = Math.hypot(dx, dz); if (d < 1.05 && d > 1e-3) { p.x = q.ent.pos.x + dx / d * 1.05; p.z = q.ent.pos.z + dz / d * 1.05; } } },
      bulletBounds: (x, z) => Math.abs(x) < H + 1 && Math.abs(z) < H + 1,
      camLimit(x, y, z) { return { x: clamp(x, -46, 46), y: Math.max(y, 0.5), z: clamp(z, -46, 46) }; },
    };
  }

  function layout(b, lvl) { // where the bits stand for this phase
    const S = b.state; S.ipos = lvl === 1 ? [-12, -4, 4, 12] : [-8, 0, 8, -15.4];
    S.pyl.forEach((q, i) => { const on = lvl === 1 || i < 3 || lvl === 2, e = q.ent; e.pos.set(S.ipos[i], 0, 14.6); e.group.position.copy(e.pos); e.group.visible = on; e.targetable = on && (lvl === 1 || i < 3); });
  }
  const effBits = (S) => { const bb = S.bits.slice(); if (S.skew >= 0) bb[S.skew] = !bb[S.skew]; return bb; };
  function show(S) { if (S.live && S.C) { S.shown = evalC(S.C, S.bits); S.shownBits = S.bits.slice(); S.rev = 4; } draw(S); }
  function toggle(b, i, auto) {
    const S = b.state, q = S.pyl[i]; S.bits[i] = !S.bits[i]; q.lock = 0.7; q.k = 1; Sound.sfx(auto ? 'interrupt' : 'zap', 0.6, S.bits[i] ? 1.5 : 0.9);
    if (!G.headless) FX.ring(q.ent.pos.x, q.ent.pos.z, { r0: 0.4, r1: 2.4, color: S.bits[i] ? MG : CY, dur: 0.3 });
    show(S);
  }
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.live = n === 0; S.lookT = n; S.exec = null; S.down = 0; S.skew = -1; b.autoFace = true;
    if (n < 2) S.bits[3] = n === 1 ? S.bits[3] : false; layout(b, n);
  }
  function* next(b) { // a new circuit, and he drifts over a different output
    const S = b.state; S.bz = pick([0, 1, 2].filter((z) => z !== S.bz)); S.skew = S.lvl === 1 ? Math.min(3, Math.floor(rnd(4))) : -1;
    S.C = makeC(S.lvl, () => rnd(), effBits(S), S.bz); S.rev = 0; S.shown = null; show(S); Sound.sfx('uiok', 0.7, 0.7);
    yield* b.moveTo(ZX[S.bz], -11, 10, { face: false });
  }
  function zap(z) {
    Sound.sfx('thunder', 0.5); if (G.headless) return;
    for (let i = 0; i < 4; i++) { const x = ZX[z] + rnd(-5, 5), zz = rnd(ZN + 1, ZS - 1); FX.lightning(_a.set(x + rnd(-3, 3), 22, zz - 4), _b.set(x, 0, zz), { color: MG, width: 0.22, jag: 1.6 }); FX.burst(x, 0.3, zz, { n: 16, color: MG, color2: 0xffffff, speed: [3, 11], life: [0.25, 0.7] }); }
    FX.flash(MG, 0.14, 3);
  }
  function* execute(b, T) {
    const S = b.state, C = S.C; let bus = false, skewed = S.skew < 0;
    S.exec = { t: T + FLOW, out: null };
    yield* b.cast({ name: 'Execute', time: T, onTick(k, cs) {
      S.exec.t = T - cs.t + FLOW;
      if (!skewed && cs.t >= T * 0.5) { skewed = true; const i = S.skew; S.skew = -1; toggle(b, i, true); }
      if (!bus && cs.t >= T - 2.5) { bus = true; Hz.rect(0, ZS, 0, H - ZS, 2 * H, T - cs.t + FLOW, 450, { name: 'Live Bus', quiet: true, onFire() { FX.shake(0.5); if (!G.headless) for (let i = 0; i < 5; i++) FX.lightning(_a.set(rnd(-H, H), 0.3, rnd(ZS, H)), _b.set(rnd(-H, H), 0.3, rnd(ZS, H)), { color: CY, width: 0.16, jag: 1.2 }); } }); }
    } });
    const E = evalC(C, S.bits); S.exec.out = E.out; S.exec.t = FLOW; S.shown = E; S.shownBits = S.bits.slice(); Sound.sfx('charge', 0.8, 1.7);
    E.out.forEach((v, z) => { if (v) Hz.rect(ZX[z], ZN, 0, ZS - ZN, 12, FLOW, 500, { name: 'Execute', color: MG, quiet: true, onFire() { zap(z); } }); });
    for (let r = 1; r <= 3; r++) { if (!S.live) { S.rev = r; draw(S); } Sound.sfx('tick', 1.6, 0.8 + r * 0.25); const t0 = G.ft; yield FLOW / 3; S.exec.t -= G.ft - t0; }
    S.rev = 4; if (C.latch >= 0) S.bits[3] = !!E.out[C.latch]; draw(S); S.exec = null; yield 0.05;
    if (E.out[S.bz]) yield* shorted(b); else yield 1.0;
  }
  function* shorted(b) {
    const S = b.state; S.down = 6; b.exposed = 6; b.autoFace = false; Sound.sfx('shatter', 0.9, 0.7); Sound.sfx('bigboom', 0.6); FX.shake(0.7); FX.flash(0xffffff, 0.25, 2.5);
    if (!G.headless) FX.explode(b.pos.x, 2.4, b.pos.z, MG, 4);
    b.damage(Math.round(b.maxHp * 0.04), { src: 'player', crit: true });
    yield 6; S.down = 0; b.autoFace = true; yield 0.6;
  }
  // ---- filler between cycles ----
  function* packets(b, waves) {
    yield* b.cast({ name: 'Packets', time: 0.8 });
    for (let w = 0; w < waves; w++) { const lanes = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).slice(0, 5); for (const l of lanes) Bul.fire({ x: -16.5 + l * 3, z: -H + 0.4, dir: 0, speed: 10.5, r: 0.45, dmg: 130, color: CY, life: 3.6 }); Sound.sfx('bolt', 0.5, 1.3); yield 1.0; }
    yield 0.6;
  }
  function* collect(b) {
    yield* b.cast({ name: 'Garbage Collection', time: 0.9 }); const o = shuffle([0, 1, 2]);
    for (let i = 0; i < 2; i++) { Hz.rect(ZX[o[i]], -H, 0, 2 * H, 12, 1.5, 300, { name: 'Garbage Collection' }); yield 0.95; }
    yield 1.0;
  }
  function* ping(b, n) { const p = G.player; for (let i = 0; i < n; i++) { Hz.circle(p.pos.x, p.pos.z, 3.2, 1.0, 240, { name: 'Ping' }); yield 0.8; } }
  function fork(b, x, z, gen) {
    const S = b.state; if (S.forks >= 4) return; S.forks++;
    const m = new THREE.Mesh(S.forkG, S.forkM); m.position.y = 1.5;
    b.spawnAdd({ name: 'Fork', hp: 380, x, z, radius: 0.8, aimY: 1.5, mesh: m, color: AMBER, onDeath() { S.forks--; },
      *run(e) {
        let t = 0; while (e.alive) { yield 2.4; t += 2.4; if (!e.alive) return; const p = G.player; Bul.fire({ x: e.pos.x, z: e.pos.z, dir: angTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z), speed: 8.5, r: 0.4, dmg: 130, color: AMBER, life: 5 });
          if (t >= 7 && gen < 2 && S.forks < 4) { t = -99; Sound.sfx('blink', 0.6, 1.4); fork(b, clamp(e.pos.x + rnd(-5, 5), -16, 16), clamp(e.pos.z + rnd(3, 6), -4, 10), gen + 1); } }
      }, update(e, dt) { m.rotation.y += dt * 2.2; m.position.y = 1.5 + Math.sin(G.now * 3 + x) * 0.2; } });
    Sound.sfx('cast', 0.6, 1.5); if (!G.headless) FX.ring(x, z, { r0: 0.3, r1: 2.5, color: AMBER, dur: 0.35 });
  }

  G.bosses.push({
    id: 'logic', name: 'DAEMON', title: 'The Truth Table', hint: 'True or false', color: '#5ff0e0', telegraph: TEL,
    hp: 34000, radius: 1.7, aimY: 2.6, enrage: 450,
    post: { bloom: 0.5, threshold: 0.86, radius: 0.7, exposure: 1.0, vig: 1.0, sat: 1.05, contrast: 1.06, tint: [0.97, 1.02, 1.0] },
    music: { bpm: 124, root: 38, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3, 0, 0, 6, 4],
      layers: [
        { v: 'hat', pat: 'x.x.x.x.x.x.x.x.', vol: 0.06 }, { v: 'pulse', pat: '0..0..0.0..0..3.', oct: -1, len: 1, vol: 0.09 }, { v: 'arp', pat: ['0.4.7.4.0.4.7.9.', '0.3.7.3.0.3.7.8.'], oct: 1, len: 1, vol: 0.05 }, { v: 'pad', pat: '0...............', len: 16, vol: 0.07 },
        { v: 'kick', from: 1, pat: 'x...x...x...x...', vol: 0.22 }, { v: 'sub', from: 1, pat: '0.......0.....0.', oct: -2, len: 4, vol: 0.14 }, { v: 'clap', from: 1, pat: '....x.......x...', vol: 0.1 },
        { v: 'bell', from: 2, pat: ['0..7..9...0.7...', '..0...7..9..0..7'], oct: 1, len: 1, vol: 0.06 }, { v: 'snare', from: 2, pat: '....x..x....x.xx', vol: 0.12 }, { v: 'lead', from: 2, pat: ['0.......7...5...', '3.......2.......'], oct: 1, len: 4, vol: 0.06 },
      ] },
    build,
    *intro(b) { Sound.sfx('charge', 0.7, 0.6); yield* Cam.shot([0, 30, 30], [0, 0, 0], [5, 4, -1], [0, 2.8, -11], 5.2, 46); },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setLvl(b, 0); yield 1.0; let first = true, k = 0;
        while (true) { yield* next(b); if (!first) { if (k % 3 === 0) yield* packets(b, 2); else if (k % 3 === 1) { yield* ping(b, 3); yield 0.8; } else yield* collect(b); } else yield 1.5; yield* execute(b, first ? 9 : 6); first = false; k++; }
      } },
      { at: 0.66, skipTo(b) { b.state.look = 1; }, *enter(b) {
        const S = b.state; setLvl(b, 0); S.C = null; S.lookT = 1; draw(S);
        yield* b.cast({ name: 'Overheat', time: 3.0, onTick: (k) => { FX.shake(k * 0.3); } });
        Sound.sfx('bigboom', 0.6); Sound.sfx('roar', 0.5, 1.6); FX.flash(AMBER, 0.35, 1.5); Co.start(Post.lerpTo({ tint: [1.06, 0.99, 0.93], bloom: 0.55 }, 3), 'fight'); yield 1.0;
      }, *run(b) {
        const S = b.state; setLvl(b, 1); let k = 0;
        while (true) {
          yield* next(b);
          if (k % 3 === 0) { fork(b, rnd(-8, 8), rnd(0, 6), 0); yield* packets(b, 2); } else if (k % 3 === 1) { yield* collect(b); yield* ping(b, 2); } else { yield* packets(b, 3); }
          Co.start(function* () { yield 1.2; yield* ping(b, 2); }, 'phase'); yield* execute(b, 6); k++;
        }
      } },
      { at: 0.33, skipTo(b) { b.state.look = 2; }, *enter(b) {
        const S = b.state; setLvl(b, 1); S.C = null; S.lookT = 2; draw(S);
        yield* b.cast({ name: 'Kernel Panic', time: 3.2, onTick: (k) => { FX.shake(k * 0.5); } });
        Sound.sfx('shatter', 1, 0.5); Sound.sfx('bigboom', 0.9); FX.flash(0x80a0ff, 0.45, 1.2); Co.start(Post.lerpTo({ tint: [0.92, 0.98, 1.12], bloom: 0.58, contrast: 1.1, sat: 0.9 }, 3), 'fight'); yield 1.2;
      }, *run(b) {
        const S = b.state; setLvl(b, 2); S.bits[3] = false; let k = 0;
        while (true) {
          yield* next(b);
          if (k % 3 === 0) { yield* packets(b, 2); } else if (k % 3 === 1) { fork(b, rnd(-8, 8), rnd(0, 6), 0); yield* collect(b); } else { yield* ping(b, 3); yield 0.6; }
          Co.start(function* () { yield 0.6; yield* (k % 2 ? packets(b, 2) : ping(b, 3)); }, 'phase'); yield* execute(b, 4.6); k++;
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, t = G.now;
      for (const q of S.pyl) { if (q.lock > 0) q.lock -= dt; q.k = Math.max(0, q.k - dt * 3); }
      if (S.down > 0) S.down -= dt; if (S.botT > 0) S.botT -= dt;
      if (G.headless) return;
      if (S.dirty) paint(S);
      S.pyl.forEach((q, i) => { const on = S.bits[i], sk = i === S.skew, lat = S.C && i >= S.C.flip; q.lm.color.setHex(sk ? AMBER : lat ? 0x9a78ff : MG).multiplyScalar(on ? 4.2 + q.k * 3 : sk ? 0.25 + (Math.sin(t * 9) > 0 ? 0.7 : 0) : 0.07 + q.k); });
      const dn = S.down > 0 ? 1 : 0; S.dnK = damp(S.dnK || 0, dn, 5, dt); const ex = S.exec ? sat(1 - S.exec.t / 5) : 0;
      S.rig.position.y = lerp(S.hov + Math.sin(t * 1.3) * 0.18, 1.3, S.dnK); S.core.rotation.y += dt * (0.6 + ex * 4) * (1 - S.dnK); S.core.rotation.x += dt * 0.37 * (1 - S.dnK);
      S.rings.forEach((m, i) => { const sp = (0.7 + i * 0.35 + ex * 3) * (1 - S.dnK); m.rotation.x += dt * sp * (i % 2 ? 1 : -1); m.rotation.y += dt * sp * 0.6; if (S.dnK > 0.5) { m.rotation.x = damp(m.rotation.x, PI / 2 + i * 0.12, 4, dt); } });
      const hot = S.lvl >= 2 ? 0x80a8ff : S.lvl === 1 ? AMBER : CY, c = S.exec && S.exec.out ? MG : hot;
      S.coreM.emissive.setHex(c); S.coreM.emissiveIntensity = (0.25 + ex * 0.9) * (1 - S.dnK * 0.85); S.edgeM.color.setHex(c).multiplyScalar((2.5 + ex * 3) * (1 - S.dnK * 0.9)); S.eyeM.color.setHex(c).multiplyScalar((5 + ex * 5) * (1 - S.dnK * 0.9)); S.ringM.emissive.setHex(c); S.ringM.emissiveIntensity = 0.15 + ex * 0.5;
      S.light.color.setHex(c); S.light.intensity = (16 + ex * 22) * (1 - S.dnK * 0.7);
      if (S.dnK > 0.5 && Math.random() < dt * 9) FX.burst(b.pos.x + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 1.5, b.pos.z + (Math.random() - 0.5) * 3, { n: 3, color: MG, speed: [1, 5], life: [0.2, 0.5] });
      S.look = damp(S.look, S.lookT, 0.6, dt); const k1 = sat(S.look), k2 = sat(S.look - 1), Uu = S.sky.material.uniforms;
      Uu.uHor.value.setHex(0x0a3a34).lerp(_c.setHex(0x4a2408), k1).lerp(_c.setHex(0x0a1848), k2); Uu.uNebA.value.setHex(0x0a5a50).lerp(_c.setHex(0x703010), k1).lerp(_c.setHex(0x1030a0), k2); Uu.uNebB.value.setHex(0x402a70).lerp(_c.setHex(0x602020), k1).lerp(_c.setHex(0x503090), k2);
      S.sinkM.emissiveIntensity = k1 * (1 - k2) * (0.1 + Math.sin(t * 1.7) * 0.03); S.sun.color.setHex(0xcfeee8).lerp(_c.setHex(0xffd0a0), k1).lerp(_c.setHex(0xa8c0ff), k2);
      const beat = Math.pow(Math.max(0, Math.sin(t * (S.exec ? 9 : 3.2))), 6); S.oscM.color.setHex(S.lvl >= 2 ? 0x80a8ff : S.lvl === 1 ? AMBER : CY).multiplyScalar(0.5 + beat * 2.2);
      S.holoM.opacity = 0.5 + Math.sin(t * 2.1) * 0.06 - (S.lvl >= 2 && Math.sin(t * 31) > 0.93 ? 0.3 : 0); S.floorM.emissiveIntensity = 0.75 + (S.exec && S.exec.out ? 0.35 : 0);
      for (const q of S.capM) q.m.color.copy(q.c).multiplyScalar(Math.sin(t * q.f) > 0 ? 1 : 0.15);
    },
    danger(b, x, z) {
      const S = b.state; if (!S.exec || !S.C) return Infinity; const zn = zoneOf(x, z), t = Math.max(0.05, S.exec.t);
      if (zn < 0) return t; const o = S.exec.out || evalC(S.C, effBits(S)).out; return o[zn] ? t : Infinity;
    },
    bot(b, p) {
      const S = b.state, out = {}; if (!S.C || S.down > 0) return out;
      const eb = effBits(S), sampled = S.exec && S.exec.out, now = sampled || evalC(S.C, eb).out, sol = sampled ? null : solveC(S.C, eb, S.bz), melee = p.cls.id === 'duskblade';
      // where is the nearest output that will stay dark?
      let safe = null, sd = Infinity; now.forEach((v, zn) => { if (v) return; const x = clamp(p.pos.x, ZX[zn] - 4.5, ZX[zn] + 4.5), z = clamp(p.pos.z, ZN + 1.5, ZS - 2), d = Math.hypot(x - p.pos.x, z - p.pos.z); if (d < sd) { sd = d; safe = { x, z }; } });
      const left = S.exec ? S.exec.t : 99, must = safe && left < sd / 7 + 1.3;
      if (sol && sol.flips.length && !(must && now.some((v) => !v) && left < 2.2)) {
        const i = sol.flips[0], e = S.pyl[i].ent, d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
        if (d <= (melee ? 3.4 : 26)) { if (S.pyl[i].lock <= 0 && S.botT <= 0) { toggle(b, i); S.botT = 0.9; } }
        else { out.x = e.pos.x; out.z = e.pos.z - 2; out.w = 2.5; }
        if (melee || d > 26) return out;
      }
      if (safe && (must || (S.exec && zoneOf(p.pos.x, p.pos.z) < 0 && left < 3.2))) { out.x = safe.x; out.z = safe.z; out.w = 5; }
      return out;
    },
  });
})();
