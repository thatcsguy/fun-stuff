// DOOR XVI: THE CLOSER, Bottom of the Ninth. A ghost ballpark at night. The fight is played in innings: he bats and you
// field, then he pitches and you bat. The scoreboard past centre field is the only thing that keeps count.
(() => {
  const R = 21, GHOST = 0x9fd4ff, GOLD = 0xffe08a, RED = 0xff4030, TEL = 0xff8a3a;
  const HOME = { x: 0, z: 13 }, BASES = [{ x: 13, z: 0 }, { x: 0, z: -13 }, { x: -13, z: 0 }, HOME], BOX = [{ x: 2.1, z: 13.2 }, { x: -2.1, z: 13.2 }];
  const PITCH = { fast: { T: 0.55, col: 0xffffff, name: 'Heater' }, change: { T: 1.1, col: 0x60ff80, name: 'Change' }, curve: { T: 0.85, col: 0x60b0ff, name: 'Hook' }, brush: { T: 0.6, col: RED, name: 'Chin Music' }, split: { T: 0.95, col: 0xd080ff, name: 'Splitter' }, ghost: { T: 0.7, col: 0xffffff, name: 'Double Play' }, knuckle: { T: 1.05, col: 0xffd060, name: 'Knuckler' }, fire: { T: 0.9, col: 0xff5020, name: 'Fireball' } };
  const _c = new THREE.Color(), _m = new THREE.Object3D();
  const inBox = (p) => BOX.find((q) => Math.abs(p.pos.x - q.x) < 1.35 && Math.abs(p.pos.z - q.z) < 1.9) || null;

  function fieldTexture() {
    const N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d'), RR = R + 0.5, u = N / (2 * RR), X = (v) => (v / (2 * RR) + 0.5) * N;
    x.fillStyle = '#1d5a2a'; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)'; x.save(); x.translate(N / 2, N / 2); x.rotate(PI / 4); x.fillRect(-N, -N + i * N / 8, 2 * N, N / 8); x.restore(); }
    const dirt = '#8a5a34', circ = (cx, cz, r, c) => { x.fillStyle = c; x.beginPath(); x.arc(X(cx), X(cz), r * u, 0, TAU); x.fill(); };
    x.strokeStyle = dirt; x.lineWidth = 2.2 * u; x.beginPath(); x.moveTo(X(HOME.x), X(HOME.z)); for (const q of BASES) x.lineTo(X(q.x), X(q.z)); x.stroke();
    circ(0, 13, 4.3, dirt); for (const q of BASES.slice(0, 3)) circ(q.x, q.z, 2.3, dirt); circ(0, 0, 2.6, dirt);
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 0.14 * u; x.beginPath(); x.moveTo(X(0), X(13)); x.lineTo(X(26), X(-13)); x.moveTo(X(0), X(13)); x.lineTo(X(-26), X(-13)); x.stroke();
    for (const q of BOX) x.strokeRect(X(q.x - 1.1), X(q.z - 1.7), 2.2 * u, 3.4 * u);
    x.fillStyle = '#ffffff'; for (const q of BASES.slice(0, 3)) { x.save(); x.translate(X(q.x), X(q.z)); x.rotate(PI / 4); x.fillRect(-0.45 * u, -0.45 * u, 0.9 * u, 0.9 * u); x.restore(); }
    x.beginPath(); x.moveTo(X(-0.5), X(12.6)); x.lineTo(X(0.5), X(12.6)); x.lineTo(X(0.5), X(13.1)); x.lineTo(X(0), X(13.6)); x.lineTo(X(-0.5), X(13.1)); x.fill(); x.fillRect(X(-0.5), X(-0.15), 1.0 * u, 0.3 * u);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function drawBoard(S) {
    const x = S.boardX, lamp = (px, py, on, c) => { x.fillStyle = on ? c : '#1c1a14'; x.beginPath(); x.arc(px, py, 15, 0, TAU); x.fill(); };
    x.fillStyle = '#0a1410'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#d8c890'; x.lineWidth = 6; x.strokeRect(5, 5, 502, 246);
    x.fillStyle = '#ffd870'; x.textBaseline = 'middle'; x.font = 'bold 40px "Courier New", monospace'; x.textAlign = 'left'; x.fillText('GUEST', 28, 52); x.fillText('HOME', 28, 108); x.textAlign = 'right'; x.font = 'bold 54px "Courier New", monospace'; x.fillText(String(S.guest), 250, 52); x.fillText(String(S.homeRuns), 250, 108);
    x.font = 'bold 34px "Courier New", monospace'; x.textAlign = 'left'; x.fillText('INN', 300, 52); x.textAlign = 'right'; x.fillText(String(S.inning) + (S.half === 'bot' ? ' ▼' : ' ▲'), 484, 52);
    x.textAlign = 'left'; x.fillText('S', 40, 190); for (let i = 0; i < 3; i++) lamp(100 + i * 42, 188, i < S.strikes, '#ff5030'); x.fillText('O', 290, 190); for (let i = 0; i < 3; i++) lamp(350 + i * 42, 188, i < S.outs, '#ffd040');
    S.boardT.needsUpdate = true;
  }
  function ghostMan(scale, mat, bat) {
    const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig); rig.scale.setScalar(scale);
    const add = (geo, x, y, z, par = rig, m = mat) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
    const legs = [-1, 1].map((sx) => { const h = new THREE.Group(); h.position.set(sx * 0.2, 0.95, 0); rig.add(h); add(new THREE.CapsuleGeometry(0.13, 0.75, 3, 8), 0, -0.48, 0, h); return h; });
    const body = new THREE.Group(); body.position.y = 0.95; rig.add(body);
    add(new THREE.CapsuleGeometry(0.27, 0.5, 4, 10), 0, 0.5, 0, body);
    const head = new THREE.Group(); head.position.y = 1.2; body.add(head); add(new THREE.SphereGeometry(0.2, 12, 9), 0, 0, 0, head);
    const capM = W.mat({ color: 0x101828, roughness: 0.8 }); add(new THREE.SphereGeometry(0.215, 12, 8, 0, TAU, 0, PI / 2), 0, 0.03, 0, head, capM); const brim = add(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 12), 0, 0.05, 0.2, head, capM); brim.scale.z = 0.9;
    const eyeM = W.glow(GHOST, 5); for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.035, 6, 5), sx * 0.075, -0.02, 0.18, head, eyeM);
    const arms = [-1, 1].map((sx) => { const s = new THREE.Group(); s.position.set(sx * 0.36, 0.95, 0); body.add(s); add(new THREE.CapsuleGeometry(0.09, 0.62, 3, 8), 0, -0.36, 0, s); return s; });
    add(new THREE.SphereGeometry(0.17, 8, 6), 0, -0.76, 0.02, arms[0], W.mat({ color: 0x6a4020, roughness: 0.9 }));
    let batG = null; if (bat) { batG = new THREE.Group(); batG.position.set(0, -0.74, 0); arms[1].add(batG); const bm = add(new THREE.CylinderGeometry(0.075, 0.035, 1.35, 8), 0, 0.6, 0, batG, W.glow(GOLD, 1.6)); }
    return { g, rig, legs, body, head, arms, eyeM, batG };
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x03060f, horizon: 0x101c34, bottom: 0x04070a, stars: 1.2, sunDir: [-0.5, 0.45, -0.7], sunColor: 0xdfe8ff, sunSize: 0.045, sunGlow: 0.7, clouds: 0.22, cloudColor: 0x3a4660, cloudDark: 0x05070c, cloudSpeed: 0.008 });
    g.add(sky); S.sky = sky; W.env(sky, 0.8);
    scene.fog = new THREE.FogExp2(0x070b12, 0.0085); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x8fa8d8, 0x1a2a1a, 0.75);
    S.sun = W.sun(g, { dir: [0.2, 1, 0.45], color: 0xf4f8ff, intensity: 3.0, size: 30 });
    S.grassM = new THREE.MeshStandardMaterial({ map: fieldTexture(), roughness: 0.95 });
    const field = new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 72), S.grassM); field.rotation.x = -PI / 2; field.receiveShadow = true; g.add(field);
    const far = new THREE.Mesh(new THREE.CircleGeometry(160, 40), W.mat({ color: 0x0a120a, roughness: 1 })); far.rotation.x = -PI / 2; far.position.y = -0.05; g.add(far);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5, R + 0.5, 3.2, 72, 1, true), W.mat({ color: 0x12381e, roughness: 0.8, side: THREE.DoubleSide })); wall.position.y = 1.6; g.add(wall);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(R + 0.5, 0.13, 6, 72), W.glow(0xffd040, 0.9)); cap.rotation.x = PI / 2; cap.position.y = 3.2; g.add(cap);
    // the stands and the dead who came to watch
    const prof = [[R + 1.5, 0], [R + 1.5, 3.6], [R + 5, 5.4], [R + 9, 8], [R + 14, 11.5], [R + 14, 0]].map(([x, y]) => new THREE.Vector2(x, y));
    const stands = new THREE.Mesh(new THREE.LatheGeometry(prof, 48, 0.62, TAU - 1.24), W.mat({ color: 0x0c1018, roughness: 1, side: THREE.DoubleSide })); g.add(stands);
    const vr = mulberry(8);
    S.crowd = [0, 1].map(() => { const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }), 380); im.frustumCulled = false; g.add(im); return im; }); const cn = [0, 0];
    for (let i = 0; i < 760; i++) { const k = vr(), a = 0.7 + vr() * (TAU - 1.4), d = R + 2.2 + k * 11, y = 4.4 + k * 6.6, h = i & 1; if (cn[h] >= 380) continue; _m.position.set(Math.sin(a) * d, y, Math.cos(a) * d); _m.scale.set(1, 1.5, 1); _m.rotation.set(0, 0, 0); _m.updateMatrix(); S.crowd[h].setMatrixAt(cn[h], _m.matrix); S.crowd[h].setColorAt(cn[h], _c.setHex(GHOST).multiplyScalar(0.25 + vr() * 0.5)); cn[h]++; }
    S.crowd.forEach((im, h) => { im.count = cn[h]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; });
    // floodlight towers
    S.floodM = [0, 1, 2, 3, 4, 5].map(() => W.glow(0xfff6e0, 6)); const pole = W.mat({ color: 0x20242c, roughness: 0.6, metalness: 0.6 });
    S.floodM.forEach((m, i) => { const a = (i + 0.5) / 6 * TAU, x = Math.sin(a) * (R + 13), z = Math.cos(a) * (R + 13); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 26, 6), pole); p.position.set(x, 13, z); g.add(p); const bank = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 0.5), pole); bank.position.set(x, 27, z); bank.lookAt(0, 6, 0); g.add(bank); for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10), m); l.position.set(-2.4 + c * 1.6, -0.7 + r * 1.4, 0.27); bank.add(l); } });
    // scoreboard
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; S.boardX = cv.getContext('2d'); S.boardT = new THREE.CanvasTexture(cv); S.boardT.colorSpace = THREE.SRGBColorSpace;
    S.boardM = new THREE.MeshBasicMaterial({ map: S.boardT, color: new THREE.Color(0xffffff).multiplyScalar(1.5) });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), S.boardM); board.position.set(0, 13.5, -(R + 12)); g.add(board); S.board = board;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(23.4, 12.4, 1), pole); frame.position.set(0, 13.5, -(R + 12.6)); g.add(frame);
    for (const sx of [-1, 1]) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8, 6), pole); lg.position.set(sx * 8, 4, -(R + 12.6)); g.add(lg); }
    S.rain = W.motes({ n: 900, box: [60, 28, 60], color: 0xbcd4ff, size: 0.2, vel: [1.5, -26, 0.5], sway: 0.1, center: [0, 14, 0], alpha: 0.5 }); S.rain.visible = false; g.add(S.rain);
    S.wisps = W.motes({ n: 240, box: [60, 12, 60], color: 0x70ffb0, size: 0.3, vel: [0.1, 0.5, 0.1], sway: 0.9, center: [0, 6, 0], alpha: 0.6 }); S.wisps.visible = false; g.add(S.wisps);
    // balls (one for the pitch, one decoy, three for flies and grounders)
    S.ballM = [0, 1, 2, 3, 4].map(() => W.glow(0xffffff, 3));
    S.balls = S.ballM.map((m) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 9), m); o.visible = false; g.add(o); return { o, m, mode: 0, t: 0 }; });
    // strike zone over the plate and the bat that appears in your hands
    S.zoneM = new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.4), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const zm = new THREE.Group(); const zb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 0.9), S.zoneM); zb.position.y = 1.15; zm.add(zb); const ze = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.1, 1.3, 0.9)), new THREE.LineBasicMaterial({ color: GOLD })); ze.position.y = 1.15; zm.add(ze); zm.visible = false; S.zoneG = zm;
    S.bat = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.04, 1.5, 8), W.glow(GOLD, 2.2)); S.bat.visible = false; g.add(S.bat);
    S.boxM = new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.2), transparent: true, opacity: 0, depthWrite: false }); for (const q of BOX) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), S.boxM); m.rotation.x = -PI / 2; m.position.set(q.x, 0.04, q.z); g.add(m); }
    // fielders for the later innings
    const ghostM = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.6, emissive: GHOST, emissiveIntensity: 0.55, transparent: true, opacity: 0.8 });
    S.fielders = [0, 1].map(() => { const f = ghostMan(1.9, ghostM, false); f.g.visible = false; g.add(f.g); return f; });
    // ---- the Closer ----
    S.bodyM = new THREE.MeshStandardMaterial({ color: 0x7f97b8, roughness: 0.55, emissive: GHOST, emissiveIntensity: 0.14 });
    S.M = ghostMan(2.75, S.bodyM, true); b.group.add(S.M.g); S.M.g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    S.light = new THREE.PointLight(GHOST, 12, 20, 1.7); S.light.position.set(0, 4, 1); b.group.add(S.light);
    Object.assign(S, { half: 'top', inning: 1, guest: 0, homeRuns: 0, strikes: 0, outs: 0, guestHalf: 0, rally: 0, pitch: null, swingCd: 0, batK: 0, gap: 1, lvl: 0, look: 0, lookT: 0, wind: 0, throwK: 0, swingK: 0, batUp: 0, fly: [], cheer: 0, flash: 0, runners: [], gr: [], fpos: [{ x: 0, z: -6 }, { x: 9, z: -2 }], strikeFx: 0 });
    S.zone = b.spawnAdd({ name: 'Strike Zone', hp: 1e7, x: HOME.x, z: HOME.z, radius: 1.2, aimY: 1.15, mesh: zm, targetable: false, onDamaged() { swing(b); } });
    S.zone.targetable = false; drawBoard(S);
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 17.2 }, bossStart: { x: 0, z: 9.6, face: 0 }, camDist: 15,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
    };
  }

  // ---- keeping score ----
  const board = (b) => { if (!G.headless) drawBoard(b.state); };
  function out(b, how) { const S = b.state; S.outs = Math.min(3, S.outs + 1); S.cheer = 1; Sound.sfx('uiok'); board(b); }
  function homeScores(b) { const S = b.state, p = G.player; S.homeRuns++; p.dmgTakenMul = 1 + 0.1 * Math.min(8, S.homeRuns); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.015); Sound.sfx('roar', 0.6, 1.4); FX.flash(RED, 0.2, 2); board(b); }
  function strike(b, P) {
    const S = b.state, p = G.player; if (P) P.done = true; S.strikes++; S.strikeFx = 1; Sound.sfx('interrupt', 0.7, 0.7); board(b);
    if (S.strikes >= 3) { S.strikes = 0; Sound.sfx('thunder', 0.9); FX.flash(0xffffff, 0.35, 3); FX.shake(0.8); if (!G.headless) FX.lightning(new V3(p.pos.x, 30, p.pos.z), new V3(p.pos.x, 0, p.pos.z), { color: 0xffffff, width: 0.4 }); p.hurt(350, { blockable: false, src: { name: 'Strikeout' } }); board(b); }
  }
  function fireworks(n = 5) { if (G.headless) return; for (let i = 0; i < n; i++) { const x = rnd(-22, 22), y = rnd(22, 34), z = -(R + rnd(2, 16)); FX.burst(x, y, z, { n: 70, color: pick([0xff5060, 0xffd040, 0x60c0ff, 0x80ff90, 0xff80e0]), color2: 0xffffff, speed: [6, 16], life: [0.8, 1.8], size: [0.3, 0.7], drag: 1.6 }); FX.light(x, y, z, 0xffffff, 60, 0.6, 60); } Sound.sfx('boom', 0.6, 1.6); Sound.sfx('shatter', 0.5, 0.8); }
  function hitBall(S, tx, ty, tz, dur) { const q = S.balls[0]; q.mode = 9; q.t = 0; q.dur = dur; q.from = q.o.position.clone(); q.to = new V3(tx, ty, tz); q.o.visible = true; }
  function resolve(b, P, d) {
    const S = b.state, ad = Math.abs(d), lane = d < 0 ? -1 : 1, HR = S.lvl >= 1 ? 0.05 : 0.07; P.done = true; Sound.sfx('parry', 1, 0.6); Sound.sfx('hit', 1, 1.4);
    if (ad <= HR) { S.guest++; S.guestHalf++; S.cheer = 1.6; hitBall(S, rnd(-6, 6), 30, -(R + 40), 1.6); fireworks(6); FX.shake(0.5); b.damage(600, { src: 'player', crit: true }); board(b); }
    else if (ad <= 0.17) {
      if (S.lvl >= 1 && lane !== S.gap) { const f = S.fpos[1]; hitBall(S, f.x, 2.2, f.z, 0.45); strike(b, P); return; }
      if (S.lvl >= 1) { S.guest++; S.guestHalf++; board(b); hitBall(S, lane * 12, 1, -9, 0.5); b.damage(400, { src: 'player' }); } else { hitBall(S, b.pos.x, 3, b.pos.z, 0.3); b.damage(300, { src: 'player' }); S.flinch = 1; }
      S.cheer = 1;
    } else hitBall(S, lane * 14, 12, 24, 0.7);
  }
  function swing(b) {
    const S = b.state, p = G.player; if (S.swingCd > 0 || S.half !== 'bot' || !p.alive || !inBox(p)) return; S.swingCd = 0.6; S.batK = 1;
    FX.slash(p.pos.x, 1.2, p.pos.z, PI, { r: 2.4, color: 0xfff2c0, dur: 0.2 }); Sound.sfx('slash', 0.8, 1.3);
    const P = S.pitch; if (!P || P.done || P.swung || !P.released) return; P.swung = true; const d = G.ft - P.tc;
    if (P.type === 'brush' || P.type === 'fire') { strike(b, P); return; }
    if (d < -0.28) return; // swung through air; it is called when the ball gets there
    resolve(b, P, d);
  }
  const ballS = (type, k) => type === 'split' ? (k < 0.42 ? k * 1.7 : 0.714 + (k - 0.42) * 0.493) : type === 'knuckle' ? k + 0.11 * Math.sin(k * TAU * 1.5) * (1 - k) : k;

  // ---- the top of the inning: he bats ----
  function* walk(b, x, z, face) { const S = b.state; S.walking = 1; b.autoFace = false; yield* b.moveTo(x, z, 11); yield* b.turnTo(face, 0.25); S.walking = 0; }
  function* liner(b) {
    const S = b.state, p = G.player, dir = b.angToPlayer(); b.facing = dir; S.batUp = 1;
    Hz.rect(b.pos.x, b.pos.z, dir, 46, 3.2, 0.95, 300, { name: 'Line Drive', onFire() { Sound.sfx('parry', 0.8, 0.7); if (!G.headless) FX.missile(new V3(b.pos.x, 2.5, b.pos.z), new V3(b.pos.x + Math.sin(dir) * 44, 1.2, b.pos.z + Math.cos(dir) * 44), { speed: 90, color: 0xffffff, size: 0.4 }); } });
    yield* b.cast({ name: 'Line Drive', time: 0.95 }); S.swingK = 1; S.batUp = 0; yield 0.55;
  }
  function runner(b, at) {
    const S = b.state, m = ghostMan(1.15, new THREE.MeshStandardMaterial({ color: 0xffd0c8, roughness: 0.6, emissive: RED, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 }), false), from = at === 0 ? HOME : BASES[at - 1];
    const e = b.spawnAdd({ name: 'Runner', hp: 300, x: from.x, z: from.z, radius: 0.7, aimY: 1.1, mesh: m.g, color: RED,
      update(e, dt) {
        if (G.state !== 'fight' || b.transitioning) return; if (e.wait > 0) { e.wait -= dt; return; }
        const q = BASES[e.next], dx = q.x - e.pos.x, dz = q.z - e.pos.z, d = Math.hypot(dx, dz), s = 4.6 * dt; e.facing = Math.atan2(dx, dz); e.run = (e.run || 0) + dt * 14; m.legs[0].rotation.x = Math.sin(e.run) * 0.9; m.legs[1].rotation.x = -Math.sin(e.run) * 0.9;
        if (d <= s) { e.pos.x = q.x; e.pos.z = q.z; e.next++; if (e.next > 3) { e.scored = true; homeScores(b); e.die(); } } else { e.pos.x += dx / d * s; e.pos.z += dz / d * s; }
      },
      onDeath(e) { const i = S.runners.indexOf(e); if (i >= 0) S.runners.splice(i, 1); if (!e.scored && S.half === 'top') out(b); } });
    e.next = at; e.wait = at === 0 ? 0.3 : 2.2; S.runners.push(e); return e;
  }
  function* fly(b, n = 1) {
    const S = b.state, p = G.player; S.batUp = 1; yield* b.cast({ name: 'Pop Fly', time: 0.7 }); S.swingK = 1; S.batUp = 0; Sound.sfx('parry', 0.9, 0.8);
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0; for (let k = 0; k < 30; k++) { const a = rnd(0, TAU), d = rnd(8, 14); x = p.pos.x + Math.sin(a) * d; z = p.pos.z + Math.cos(a) * d; if (Math.hypot(x, z) < R - 2.5 && Math.hypot(x - b.pos.x, z - b.pos.z) > 5 && (i === 0 || Math.hypot(x - S.fly[S.fly.length - 1].x, z - S.fly[S.fly.length - 1].z) > 9)) break; }
      const T = 3.2 + i * 1.5, q = S.balls[2 + i], f = { x, z, T, t: 0, q, sx: b.pos.x, sz: b.pos.z }; S.fly.push(f); q.mode = 2; q.o.visible = true;
      Hz.circle(x, z, 1.75, T, 0, { name: 'Pop Fly', color: 0xffffff, style: 1, quiet: true, silent: true, onFire() {
        const i2 = S.fly.indexOf(f); if (i2 >= 0) S.fly.splice(i2, 1); q.mode = 0; q.o.visible = false;
        if (p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < 2.1) { out(b); FX.ring(x, z, { r0: 2, r1: 0.4, color: 0xffffff, dur: 0.3 }); Sound.sfx('hit', 0.9, 0.6); }
        else { FX.explode(x, 0.3, z, GHOST, 4); Sound.sfx('boom', 0.7); if (p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < 5) p.hurt(150, { blockable: true, src: { name: 'Base Hit' } }); runner(b, 0); }
      } });
    }
    yield 0.6;
  }
  function* grounder(b, n = 2) {
    const S = b.state, p = G.player;
    for (let i = 0; i < n; i++) { S.batUp = 1; yield* b.cast({ name: 'Grounder', time: 0.6 }); S.swingK = 1; S.batUp = 0; Sound.sfx('parry', 0.7, 0.9); const q = S.balls.find((o, j) => j >= 1 && o.mode === 0) || S.balls[1]; S.gr.push({ q, x: b.pos.x, z: b.pos.z, dir: b.angToPlayer() + rnd(-0.12, 0.12), t: 0 }); q.mode = 3; q.o.visible = true; yield 0.55; }
    yield 0.4;
  }
  function* bigSwing(b) {
    const S = b.state, dir = b.angToPlayer(); b.facing = dir; S.batUp = 1;
    Hz.cone(b.pos.x, b.pos.z, dir, 3.5, 7.8, 1.1, 300, { name: 'Big Swing', quiet: true }); yield* b.cast({ name: 'Big Swing', time: 1.1 }); S.swingK = 1; Sound.sfx('slash', 1, 0.5); FX.shake(0.4); FX.slash(b.pos.x, 2.4, b.pos.z, dir, { r: 7.5, color: GOLD, dur: 0.3 });
    Hz.cone(b.pos.x, b.pos.z, dir + PI, 3.5, 7.8, 0.85, 300, { name: 'Backswing', quiet: true }); yield 0.85; S.swingK = 1; Sound.sfx('slash', 1, 0.45); FX.slash(b.pos.x, 2.4, b.pos.z, dir + PI, { r: 7.5, color: GOLD, dur: 0.3, flip: true }); S.batUp = 0; yield 0.6;
  }
  function* top(b, lvl) {
    const S = b.state; S.half = 'top'; S.outs = 0; S.strikes = 0; S.pitch = null; S.zone.targetable = false; S.zoneG.visible = false; b.targetable = true; b.dmgTaken = 1 + Math.min(0.5, 0.1 * S.guestHalf); S.rally = S.guestHalf; S.guestHalf = 0; board(b);
    yield* walk(b, 0, 9.6, 0); b.autoFace = true; S.pose = 'bat';
    if (lvl === 1) runner(b, 1); if (lvl >= 2) { runner(b, 1); runner(b, 2); }
    const plan = lvl === 0 ? ['fly', 'liner', 'swing', 'ground', 'fly', 'liner', 'swing', 'fly'] : lvl === 1 ? ['fly2', 'liner', 'swing', 'ground', 'liner', 'fly2', 'swing', 'ground'] : ['fly2', 'swing', 'liner', 'ground', 'fly2', 'liner', 'swing'];
    for (const a of plan) {
      if (S.outs >= 3) break;
      if (a === 'fly') yield* fly(b, 1); else if (a === 'fly2') yield* fly(b, 2); else if (a === 'liner') { yield* liner(b); if (lvl >= 1) yield* liner(b); } else if (a === 'swing') yield* bigSwing(b); else yield* grounder(b, lvl >= 1 ? 3 : 2);
      yield 0.5;
    }
    yield () => S.fly.length === 0;
    if (S.outs >= 3) { b.exposed = 5; S.down = 5; S.cheer = 1.4; Sound.sfx('interrupt', 0.8, 0.6); FX.flash(0xffffff, 0.2, 3); b.autoFace = false; yield 5; b.autoFace = true; }
    b.dmgTaken = 1; S.rally = 0;
  }
  // ---- the bottom of the inning: you bat ----
  function* pitchOne(b, type) {
    const S = b.state, p = G.player, D = PITCH[type], P = { type, tc: 1e9, released: false, done: false, swung: false }; S.pitch = P; S.wind = 1; S.windType = type;
    const box = inBox(p) || BOX.reduce((a, q) => Math.hypot(q.x - p.pos.x, q.z - p.pos.z) < Math.hypot(a.x - p.pos.x, a.z - p.pos.z) ? q : a);
    if (type === 'brush') Hz.rect(b.pos.x, b.pos.z, angTo(b.pos.x, b.pos.z, box.x, box.z), 19, 2.4, 1.3 + D.T, 380, { name: 'Chin Music', color: RED, quiet: true });
    if (type === 'fire') Hz.circle(HOME.x, HOME.z, 4.8, 1.3 + D.T, 380, { name: 'Fireball', color: RED, onFire() { FX.explode(HOME.x, 0.5, HOME.z, 0xff5020, 5); } });
    yield* b.cast({ name: D.name, time: 1.3 });
    S.wind = 0; S.throwK = 1; P.released = true; P.t0 = G.ft; P.tc = G.ft + D.T; P.tx = type === 'brush' ? box.x : HOME.x; P.tz = type === 'brush' ? box.z : HOME.z; P.side = box.x > 0 ? 1 : -1; Sound.sfx('dash', 0.8, type === 'fast' ? 1.6 : 0.9);
    if (type === 'ghost') { P.decoy = G.ft; P.tc += 0.42; P.t0 += 0.42; }
    S.balls[0].mode = 1; S.balls[0].o.visible = true; S.ballM[0].color.setHex(D.col).multiplyScalar(3.2);
    yield () => P.done || G.ft >= P.tc + 0.28;
    if (!P.done) { P.done = true; if (type !== 'brush' && type !== 'fire') strike(b, null); }
    if (S.balls[0].mode === 1) { S.balls[0].mode = 0; S.balls[0].o.visible = false; }
    yield 0.85;
  }
  function* bottom(b, lvl) {
    const S = b.state; S.half = 'bot'; S.strikes = 0; S.pose = 'pitch'; b.targetable = false; b.dmgTaken = 1; board(b);
    yield* walk(b, 0, 0, 0); S.zone.targetable = true; S.zoneG.visible = true; if (G.player.target === b || !G.player.target) G.player.target = S.zone;
    const pool = lvl === 0 ? ['fast', 'change', 'fast', 'curve', 'brush', 'change'] : lvl === 1 ? ['fast', 'split', 'curve', 'ghost', 'brush', 'change', 'split', 'fast'] : ['knuckle', 'fast', 'fire', 'split', 'ghost', 'brush', 'knuckle', 'curve', 'fire', 'change'];
    const order = S.inning === 1 && lvl === 0 ? pool : shuffle(pool); yield 0.6;
    for (const t of order) { if (lvl >= 1) { S.gap = rnd() < 0.5 ? 1 : -1; S.fpos[1] = { x: -S.gap * 9, z: -2 }; } yield* pitchOne(b, t); }
    S.pitch = null; S.zone.targetable = false; S.zoneG.visible = false; b.targetable = true; if (G.player.target === S.zone) G.player.target = b;
    S.inning++;
  }
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.lookT = n; S.wind = 0; S.batUp = 0; S.pitch = null; S.zone.targetable = false; S.zoneG.visible = false; b.targetable = true; b.dmgTaken = 1; b.autoFace = false; if (G.player && G.player.target === S.zone) G.player.target = b;
    for (const f of S.fielders) f.g.visible = n >= 1; S.rain.visible = n === 1; S.wisps.visible = n >= 2; for (const q of S.balls) { if (q.mode === 1) { q.mode = 0; q.o.visible = false; } }
  }

  G.bosses.push({
    id: 'ballpark', name: 'THE CLOSER', title: 'Bottom of the Ninth', hint: 'Play ball', color: '#bfe0ff', telegraph: TEL,
    hp: 26000, radius: 1.5, aimY: 3.4, enrage: 500,
    post: { bloom: 0.55, threshold: 0.86, radius: 0.7, exposure: 1.0, vig: 1.05, sat: 1.05, contrast: 1.06, tint: [0.97, 1.0, 1.06] },
    music: { bpm: 112, root: 36, scale: [0, 2, 4, 5, 7, 9, 10], prog: [0, 0, 3, 4, 0, 0, 5, 4],
      layers: [
        { v: 'organ', pat: ['0...2...4...2...', '0...2...4.5.7...'], oct: 1, len: 3, vol: 0.07 }, { v: 'bass', pat: '0...0...4...4...', oct: -1, len: 3, vol: 0.13 }, { v: 'clap', pat: '....x.......x.x.', vol: 0.1 }, { v: 'kick', pat: 'x.......x.......', vol: 0.2 },
        { v: 'hat', from: 1, pat: 'x.x.x.x.x.x.x.x.', vol: 0.05 }, { v: 'tom', from: 1, pat: '......x.......xx', vol: 0.14 }, { v: 'brass', from: 1, pat: ['0.......4.......', '3.......4...5...'], len: 6, vol: 0.09 }, { v: 'pad', from: 1, pat: '0...............', len: 16, vol: 0.07 },
        { v: 'choir', from: 2, pat: '0.......3.......', oct: 1, len: 8, vol: 0.08 }, { v: 'taiko', from: 2, pat: 'x..x..x.x..x.xx.', vol: 0.2 }, { v: 'lead', from: 2, pat: ['0.2.4.7.4.2.0...', '7.5.4.2.0.......'], oct: 1, len: 2, vol: 0.05 },
      ] },
    build,
    *intro(b) { const S = b.state; S.floodK = 0; Co.start(function* () { for (let i = 0; i < 6; i++) { yield 0.42; S.floodK = (i + 1) / 6; Sound.sfx('hit', 0.9, 0.5); } }, 'sys'); yield* Cam.shot([14, 3, 24], [0, 9, -20], [4, 3.2, 17], [0, 3.6, 9], 5.4, 48); S.floodK = 1; },
    phases: [
      { at: 1, *run(b) { b.state.floodK = 1; setLvl(b, 0); yield 0.8; while (true) { yield* top(b, 0); yield* bottom(b, 0); } } },
      { at: 0.66, skipTo(b) { b.state.look = 1; b.state.inning = 3; }, *enter(b) {
        const S = b.state; setLvl(b, 0); S.lookT = 1; S.flash = 1; if (S.half === 'bot') S.inning++; S.outs = 0; S.strikes = 0; board(b); Sound.sfx('thunder', 1); FX.flash(0xffffff, 0.5, 1.5);
        yield* b.cast({ name: 'Seventh-Inning Stretch', time: 3.0, onTick: (k) => { if (vrand() < 0.03) S.flash = 1; } }); S.rain.visible = true; S.cheer = 1.5;
        Co.start(Post.lerpTo({ tint: [0.9, 0.98, 1.12], bloom: 0.6 }, 3), 'fight'); yield 1.0;
      }, *run(b) { setLvl(b, 1); while (true) { yield* top(b, 1); yield* bottom(b, 1); } } },
      { at: 0.33, skipTo(b) { b.state.look = 2; b.state.inning = 7; b.state.floodK = 0; }, *enter(b) {
        const S = b.state; setLvl(b, 1); S.lookT = 2; S.inning = Math.max(S.inning, 9); board(b);
        yield* b.cast({ name: 'Lights Out', time: 3.2, onTick: (k) => { const n = Math.floor(k * 6.99); if (n !== S.lo) { S.lo = n; S.floodK = 1 - n / 6; Sound.sfx('shatter', 0.7, 0.6); FX.shake(0.3); } } });
        S.floodK = 0; S.rain.visible = false; S.wisps.visible = true; Sound.sfx('roar', 0.9, 0.5); FX.flash(0x70ffb0, 0.4, 1.2);
        Co.start(Post.lerpTo({ tint: [0.9, 1.08, 0.98], bloom: 0.66, exposure: 1.1 }, 3), 'fight'); yield 1.2;
      }, *run(b) { setLvl(b, 2); b.state.floodK = 0; while (true) { yield* bottom(b, 2); yield* top(b, 2); } } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight' && p && p.alive, P = S.pitch;
      if (S.swingCd > 0) S.swingCd -= dt; S.zone.hp = S.zone.maxHp; if (S.down > 0) S.down -= dt;
      if (fight && p.casting && p.casting.tgt === S.zone) { p.casting = null; swing(b); }
      // the pitch
      const q0 = S.balls[0];
      if (P && P.released && q0.mode === 1) {
        const k = (G.ft - P.t0) / PITCH[P.type].T, s = ballS(P.type, sat(k)), ext = k > 1 ? (k - 1) * 1.2 : 0; let x = lerp(b.pos.x, P.tx, s + ext), z = lerp(b.pos.z + 1.2, P.tz, s + ext);
        if (P.type === 'curve') x += Math.sin(sat(k) * PI) * 3.6 * P.side;
        q0.o.position.set(x, lerp(4.6, 1.15, sat(s)) + Math.sin(sat(k) * PI) * (P.type === 'change' ? 1.4 : 0.4), z); q0.o.visible = k >= 0;
        if (P.decoy !== undefined) { const kd = (G.ft - P.decoy) / PITCH.ghost.T, d = S.balls[1]; d.o.visible = kd < 1.5; d.mode = kd < 1.5 ? 8 : 0; d.o.position.set(lerp(b.pos.x, P.tx, kd), lerp(4.6, 1.15, sat(kd)), lerp(b.pos.z + 1.2, P.tz, kd)); S.ballM[1].color.setHex(0x8090a0).multiplyScalar(0.8); }
      }
      if (q0.mode === 9) { q0.t += dt; const k = q0.t / q0.dur; q0.o.position.lerpVectors(q0.from, q0.to, sat(k)); q0.o.position.y += Math.sin(sat(k) * PI) * 2; if (k >= 1) { q0.mode = 0; q0.o.visible = false; } }
      // flies in the air, grounders on the grass
      for (const f of S.fly) { f.t += dt; const k = sat(f.t / f.T); f.q.o.position.set(lerp(f.sx, f.x, k), 2 + Math.sin(k * PI) * 24, lerp(f.sz, f.z, k)); }
      for (let i = S.gr.length - 1; i >= 0; i--) {
        const g = S.gr[i]; g.t += dt; g.x += Math.sin(g.dir) * 15.5 * dt; g.z += Math.cos(g.dir) * 15.5 * dt; g.q.o.position.set(g.x, 0.35 + Math.abs(Math.sin(g.t * 9)) * 0.45, g.z); S.ballM[S.balls.indexOf(g.q)].color.setHex(0xffe0b0).multiplyScalar(3);
        if (fight && !g.hit && Math.hypot(p.pos.x - g.x, p.pos.z - g.z) < 0.95 && p.pos.y < 0.6) { g.hit = true; p.hurt(220, { blockable: true, src: { name: 'Grounder' } }); }
        if (Math.hypot(g.x, g.z) > R || g.hit) { g.q.mode = 0; g.q.o.visible = false; S.gr.splice(i, 1); }
      }
      // ---- cosmetics ----
      if (G.headless) return;
      S.look = damp(S.look, S.lookT, 0.6, dt); const k1 = sat(S.look), k2 = sat(S.look - 1), U = S.sky.material.uniforms, fk = S.floodK === undefined ? 1 : S.floodK;
      S.flash = Math.max(0, S.flash - dt * 3); if (S.lvl === 1 && vrand() < dt * 0.12) { S.flash = 1; Sound.sfx('thunder', 0.4); } U.uFlash.value = S.flash; U.uCloud.value = 0.22 + k1 * 0.5 - k2 * 0.3; U.uStars.value = 1.2 - k1 * 1.0 + k2 * 1.2;
      U.uHor.value.setHex(0x101c34).lerp(_c.setHex(0x1a2030), k1).lerp(_c.setHex(0x0c2a20), k2);
      S.floodM.forEach((m, i) => m.color.setHex(0xfff6e0).multiplyScalar(i < Math.round(fk * 6) ? 6 : 0.05));
      S.sun.intensity = 0.5 + fk * 2.5 + S.flash * 2; S.sun.color.setHex(0x70ffb8).lerp(_c.setHex(0xf4f8ff), fk); S.hemi.intensity = 0.45 + fk * 0.3 + k2 * 0.25; S.hemi.color.setHex(0x8fa8d8).lerp(_c.setHex(0x60e0a0), k2); S.fog.color.setHex(0x070b12).lerp(_c.setHex(0x0a2018), k2);
      S.cheer = Math.max(0, S.cheer - dt * 0.5); S.crowd.forEach((im, h) => { im.position.y = Math.abs(Math.sin(t * (2.5 + S.cheer * 5) + h * 1.7)) * (0.15 + S.cheer * 0.55); im.material.opacity = 0.5 + k2 * 0.3 + S.cheer * 0.2; });
      S.board.material.color.setScalar(1.5 + (S.lvl >= 2 ? Math.sin(t * 23) * Math.sin(t * 7.1) * 0.5 : 0)); S.strikeFx = Math.max(0, S.strikeFx - dt * 2);
      const bot = S.half === 'bot', box = fight && bot ? inBox(p) : null; S.boxM.opacity = bot ? 0.14 + Math.sin(t * 4) * 0.05 + (box ? 0.12 : 0) : 0; S.zoneM.opacity = 0.16 + (P && P.released && !P.done ? 0.2 : 0) + S.strikeFx * 0.4; S.zoneM.color.setHex(S.strikeFx > 0.05 ? RED : GOLD).multiplyScalar(1.4);
      S.batK = Math.max(0, S.batK - dt * 4); S.bat.visible = !!box; if (box) { const a = p.facing + 0.9 - S.batK * 2.6; S.bat.position.set(p.pos.x + Math.sin(a) * 0.75, p.pos.y + 1.55 - S.batK * 0.3, p.pos.z + Math.cos(a) * 0.75); S.bat.rotation.set(0.5 + S.batK * 1.0, a, 0.5, 'YXZ'); }
      S.fielders.forEach((f, i) => { if (!f.g.visible) return; const q = S.fpos[i]; f.g.position.x = damp(f.g.position.x, q.x, 5, dt); f.g.position.z = damp(f.g.position.z, q.z, 5, dt); f.g.rotation.y = angTo(f.g.position.x, f.g.position.z, HOME.x, HOME.z); f.g.visible = S.lvl >= 1 && bot; f.arms[0].rotation.x = -1.2; });
      for (const f of S.fielders) if (S.lvl >= 1 && bot) f.g.visible = true;
      // the Closer
      const M = S.M; S.windK = damp(S.windK || 0, S.wind, 7, dt); S.throwK = Math.max(0, S.throwK - dt * 2.6); S.swingK = Math.max(0, S.swingK - dt * 2.8); S.batUpK = damp(S.batUpK || 0, S.batUp, 9, dt); S.flinch = Math.max(0, (S.flinch || 0) - dt * 2);
      const wk = S.walking ? 1 : 0; S.stepT = (S.stepT || 0) + dt * 11 * wk; const top_ = S.half === 'top', dn = S.down > 0 ? 1 : 0; S.dnK = damp(S.dnK || 0, dn, 6, dt);
      M.batG.visible = top_; M.rig.position.y = Math.sin(t * 1.6) * 0.06 - S.dnK * 0.9; M.rig.rotation.x = S.flinch * -0.4 + S.dnK * 0.5;
      M.legs[0].rotation.x = Math.sin(S.stepT) * 0.7 * wk - S.windK * 1.5; M.legs[1].rotation.x = -Math.sin(S.stepT) * 0.7 * wk + S.throwK * 0.6;
      M.body.rotation.y = top_ ? 0.9 * S.batUpK - S.swingK * 2.4 : S.windK * 1.1 - S.throwK * 1.0; M.body.rotation.x = S.throwK * 0.5 - S.windK * 0.15;
      M.arms[1].rotation.x = top_ ? -1.5 - S.batUpK * 0.6 + S.swingK * 0.4 : -S.windK * 2.6 + S.throwK * 2.0 - 0.2; M.arms[1].rotation.z = top_ ? -0.5 : 0.2; M.arms[0].rotation.x = top_ ? -1.3 - S.batUpK * 0.5 : -0.9 - S.windK * 0.5; M.arms[0].rotation.z = top_ ? 0.7 : -0.2;
      if (M.batG) M.batG.rotation.x = -0.6 - S.batUpK * 0.6 + S.swingK * 2.2;
      const hot = P && !P.done && (P.type === 'brush' || P.type === 'fire'); M.eyeM.color.setHex(hot ? RED : S.lvl >= 2 ? 0x70ffb0 : GHOST).multiplyScalar(hot ? 9 : 5); S.bodyM.emissive.setHex(S.lvl >= 2 ? 0x50e0a0 : GHOST); S.bodyM.emissiveIntensity = 0.14 + (b.castState ? 0.16 : 0) + S.dnK * -0.2;
      S.light.color.setHex(hot ? RED : S.lvl >= 2 ? 0x70ffb0 : GHOST); S.light.intensity = 12 + (b.castState ? 14 : 0);
      for (let i = 2; i < 5; i++) if (S.balls[i].mode === 2) S.ballM[i].color.setHex(0xffffff).multiplyScalar(4);
    },
    danger(b, x, z) { const S = b.state; let best = Infinity; for (const g of S.gr) { const rx = x - g.x, rz = z - g.z, k = rx * Math.sin(g.dir) + rz * Math.cos(g.dir); if (k > 0 && k < 14 && Math.abs(rx * Math.cos(g.dir) - rz * Math.sin(g.dir)) < 1.3) best = Math.min(best, k / 15.5); } return best; },
    bot(b, p) {
      const S = b.state, out = {};
      if (S.half === 'bot') {
        const P = S.pitch, away = P && !P.done && (P.type === 'brush' || P.type === 'fire'); out.holdFire = true; out.w = 4; out.target = S.zone.targetable ? S.zone : b;
        if (away) { out.x = 7.5; out.z = 15; } else { out.x = BOX[0].x; out.z = BOX[0].z; }
        if (P && P.released && !P.done && !P.swung && !away && inBox(p)) { if (P.err === undefined) P.err = (G.rng() - 0.5) * [0, 0.5, 0.3, 0.2][Bot.level] + (S.lvl >= 1 ? S.gap * 0.1 : 0); if (G.ft >= P.tc + P.err) swing(b); }
        return out;
      }
      if (S.fly.length) { const f = S.fly.reduce((a, q) => q.T - q.t < a.T - a.t ? q : a); if (f.T - f.t < Math.hypot(f.x - p.pos.x, f.z - p.pos.z) / 7 + 1.4) { out.x = f.x; out.z = f.z; out.w = 4; } }
      if (S.runners.length) out.target = S.runners.reduce((a, q) => q.next > a.next ? q : a);
      return out;
    },
  });
})();
