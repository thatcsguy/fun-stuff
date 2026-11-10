// DOOR IV: PARALLAX, the Astral Engine. A grid of charged tiles in orbit. The core shows you which colour dies.
(() => {
  const N = 7, TS = 4.4, HALF = N * TS / 2, CY = 0x20d8ff, MG = 0xff30c0, IDLE = 0x1c3a6a, WARN = 0xff2a18;
  const COLS = [IDLE, CY, MG];
  const tIdx = (x, z) => { const ix = Math.floor((x + HALF) / TS), iz = Math.floor((z + HALF) / TS); return ix < 0 || iz < 0 || ix >= N || iz >= N ? -1 : iz * N + ix; };
  const PATTERNS = [
    (ix, iz) => ix % 2, (ix, iz) => iz % 2, (ix, iz) => (ix + iz) % 2, (ix, iz) => (ix < 3 || (ix === 3 && iz < 3)) === (iz < 3 || (iz === 3 && ix > 3)) ? 0 : 1,
    (ix, iz) => Math.max(Math.abs(ix - 3), Math.abs(iz - 3)) % 2, (ix, iz) => (Math.floor(ix / 2) + Math.floor(iz / 2)) % 2, (ix, iz) => (ix + iz * 2) % 3 === 0 ? 1 : 0,
  ];

  function tileTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#fff'; x.lineWidth = 7; x.strokeRect(9, 9, 238, 238); x.lineWidth = 2; x.strokeStyle = '#999'; x.strokeRect(26, 26, 204, 204);
    x.strokeStyle = '#555'; x.beginPath(); for (const [a, b2, c2, d] of [[26, 70, 90, 70], [90, 70, 110, 90], [110, 90, 110, 128], [230, 186, 166, 186], [166, 186, 146, 166], [146, 166, 146, 128], [70, 230, 70, 180], [186, 26, 186, 76]]) { x.moveTo(a, b2); x.lineTo(c2, d); } x.stroke();
    x.fillStyle = '#bbb'; x.beginPath(); x.moveTo(128, 108); x.lineTo(148, 128); x.lineTo(128, 148); x.lineTo(108, 128); x.closePath(); x.fill();
    x.fillStyle = '#161616'; x.fillRect(26, 26, 204, 204); x.globalCompositeOperation = 'lighter'; x.fillStyle = '#fff'; x.beginPath(); x.moveTo(128, 112); x.lineTo(144, 128); x.lineTo(128, 144); x.lineTo(112, 128); x.closePath(); x.fill();
    const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  function planetTex() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    for (let y = 0; y < 256; y++) { const n = W.fbm(y * 0.045, 1.3, 5, 4), m = W.fbm(y * 0.2, 7.1, 9, 3); const r = 150 + n * 90 + m * 20, g2 = 95 + n * 70, b2 = 70 + (1 - n) * 70; x.fillStyle = `rgb(${r | 0},${g2 | 0},${b2 | 0})`; x.fillRect(0, y, 512, 1); }
    x.globalAlpha = 0.25; for (let i = 0; i < 260; i++) { const y = Math.random() * 256, w = 30 + Math.random() * 120; x.fillStyle = Math.random() < 0.5 ? '#fff0d0' : '#5a3020'; x.fillRect(Math.random() * 512, y, w, 1 + Math.random() * 2); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sunDir = new V3(-0.55, 0.22, -0.8).normalize();
    const sky = W.sky({ top: 0x010208, horizon: 0x04061a, bottom: 0x010106, stars: 1.6, nebula: 0.55, nebulaA: 0x2a1060, nebulaB: 0x063a5a, sunDir: sunDir.toArray(), sunColor: 0xfff0d8, sunSize: 0.06, sunGlow: 1.0 }); g.add(sky); S.sky = sky; W.env(sky, 0.7);
    S.hemi = W.hemi(g, 0x3a4a8a, 0x100818, 0.6);
    S.sun = W.sun(g, { dir: [-0.55, 0.5, -0.65], color: 0xfff0e0, intensity: 2.6, size: 24 });
    // planet + rings
    const planet = new THREE.Mesh(new THREE.SphereGeometry(520, 64, 40), new THREE.MeshStandardMaterial({ map: planetTex(), roughness: 1, metalness: 0, emissive: 0x150a06 })); planet.position.set(380, -560, -620); planet.rotation.set(0.3, 0.4, 0.25); g.add(planet); S.planet = planet;
    const rc = document.createElement('canvas'); rc.width = 256; rc.height = 4; const rx = rc.getContext('2d'); for (let i = 0; i < 256; i++) { const a = W.fbm(i * 0.09, 2.2, 3, 4), gap = (i > 96 && i < 110) || i < 6 || i > 250 ? 0 : 1; rx.fillStyle = `rgba(${200 + a * 50 | 0},${180 + a * 40 | 0},${150 + a * 40 | 0},${(0.25 + a * 0.6) * gap})`; rx.fillRect(i, 0, 1, 4); }
    const ringG = new THREE.RingGeometry(640, 1050, 128, 1); const uv = ringG.attributes.uv, pos = ringG.attributes.position; for (let i = 0; i < uv.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - 640) / 410, 0.5); }
    const rtex = new THREE.CanvasTexture(rc); rtex.colorSpace = THREE.SRGBColorSpace;
    const rings = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ map: rtex, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xcccccc })); rings.position.copy(planet.position); rings.rotation.set(-PI / 2 + 0.38, 0.1, 0.2); g.add(rings);
    // station under-structure
    const hull = W.surface('metal', { size: 256, dark: 0x080a10, light: 0x39424f, strength: 3 }); for (const k in hull) hull[k].repeat.set(6, 6);
    const hm = new THREE.MeshStandardMaterial({ map: hull.map, normalMap: hull.normalMap, roughnessMap: hull.roughnessMap, metalness: 0.9, roughness: 0.5 });
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(30, 22, 3, 8), hm); dish.position.y = -9; dish.rotation.y = PI / 8; g.add(dish);
    S.conduit = new THREE.MeshStandardMaterial({ color: 0x05080c, emissive: CY, emissiveIntensity: 2 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + PI / 8, m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 22), S.conduit); m.position.set(Math.sin(a) * 14, -7.45, Math.cos(a) * 14); m.rotation.y = a; g.add(m); }
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 8, 12), hm); spine.position.y = -4.3; g.add(spine);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const tw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), hm); tw.position.set(sx * 21, 2, sz * 21); g.add(tw);
      const bc = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), W.glow(0xff3020, 5)); bc.position.set(sx * 21, 15.5, sz * 21); g.add(bc);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 30), hm); arm.position.set(sx * 14, -8.2, sz * 14); arm.rotation.y = Math.atan2(sx, sz); g.add(arm);
      const pan = new THREE.Mesh(new THREE.BoxGeometry(14, 0.15, 6), new THREE.MeshStandardMaterial({ color: 0x0a1430, metalness: 1, roughness: 0.2, emissive: 0x06102a })); pan.position.set(sx * 32, 4, sz * 21); pan.rotation.z = sx * 0.4; g.add(pan);
    }
    // tiles
    const ttex = tileTex(), tgeo = new THREE.BoxGeometry(TS - 0.14, 0.6, TS - 0.14); S.tiles = [];
    const side = new THREE.MeshStandardMaterial({ color: 0x0b0e15, metalness: 0.9, roughness: 0.4 });
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x151a24, metalness: 0.85, roughness: 0.32, emissive: IDLE, emissiveMap: ttex, emissiveIntensity: 1.3, envMapIntensity: 1.4 });
      const m = new THREE.Mesh(tgeo, [side, side, mat, side, side, side]); m.position.set(-HALF + TS * (ix + 0.5), -0.3, -HALF + TS * (iz + 0.5)); m.receiveShadow = true; g.add(m);
      S.tiles.push({ m, mat, ix, iz, x: m.position.x, z: m.position.z, present: true, col: 0, warn: 0, back: 0, y: -0.3, flash: 0, cur: new THREE.Color(IDLE) });
    }
    S.motes = W.motes({ n: 400, box: [70, 40, 70], color: 0x9fd0ff, size: 0.08, vel: [0.1, 0.06, 0.05], sway: 0.4, center: [0, 8, 0] }); g.add(S.motes);
    // ---- the core ----
    const bg = b.group; S.rig = new THREE.Group(); S.rig.position.y = 4.2; bg.add(S.rig);
    S.coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); S.core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 2), S.coreMat); S.rig.add(S.core);
    S.haloMat = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(0x80c0ff) }, uA: { value: 1 } }, vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }', fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f=abs(dot(normalize(vN),normalize(vV))); float a=pow(f,3.5)*uA*0.7; gl_FragColor=vec4(uC*a,a); }', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    S.halo = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), S.haloMat); S.rig.add(S.halo);
    S.coreL = new THREE.PointLight(0x80c0ff, 260, 60, 1.7); S.coreL.castShadow = false; S.rig.add(S.coreL);
    const steel = new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 1, roughness: 0.22, envMapIntensity: 2 }); S.trim = new THREE.MeshStandardMaterial({ color: 0x05070a, emissive: CY, emissiveIntensity: 3 });
    S.gyro = []; for (let i = 0; i < 3; i++) { const r = 2.5 + i * 0.55, gr = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.13, 8, 64), steel); t.castShadow = true; gr.add(t); const t2 = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 6, 64), S.trim); t2.scale.setScalar(1.045); gr.add(t2); for (let k = 0; k < 4; k++) { const n = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.35), steel); n.position.set(Math.cos(k * PI / 2) * r, Math.sin(k * PI / 2) * r, 0); n.rotation.z = k * PI / 2; gr.add(n); } S.rig.add(gr); S.gyro.push(gr); }
    S.shards = []; const shGeo = new THREE.OctahedronGeometry(1, 0);
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(shGeo, steel); const a = i / 12 * TAU, e = (i % 3 - 1) * 0.75; m.userData = { a, e, sp: 0.4 + (i % 4) * 0.12 }; m.scale.set(0.5, 1.5, 0.22); m.castShadow = true; S.rig.add(m); S.shards.push(m); }
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 1.4, 8), steel); pylon.position.y = 0.4; bg.add(pylon);
    // lasers
    S.laserG = new THREE.Group(); S.laserG.position.y = 1.15; g.add(S.laserG); S.lasers = [];
    for (let i = 0; i < 4; i++) { const grp = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }); const core = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 26), mat); core.position.z = 15; grp.add(core); const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 26), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); fl.rotation.x = -PI / 2; fl.position.set(0, -1.08, 15); grp.add(fl); grp.visible = false; S.laserG.add(grp); S.lasers.push({ grp, mat, fl: fl.material, cd: 0 }); }
    S.sweep = null; S.pol = null; S.coreCol = 0; S.open = 0; S.spin = 1; S.tethers = []; S.dangerCol = 0; S.heat = 0;
    const present = (x, z) => { const i = tIdx(x, z); return i >= 0 && S.tiles[i].present; };
    return {
      edge: 'fall', spawn: { x: 0, z: 11 }, bossStart: { x: 0, z: 0, face: 0 },
      contains: (x, z) => present(x, z) || present(x + 0.45, z) || present(x - 0.45, z) || present(x, z + 0.45) || present(x, z - 0.45),
      solid(p) { const d = Math.hypot(p.x, p.z); if (d < 2.3 && d > 0.001) { p.x *= 2.3 / d; p.z *= 2.3 / d; } },
      bulletBounds: (x, z) => Math.abs(x) < 30 && Math.abs(z) < 30,
    };
  }

  // ---- mechanics ----
  const colOfCore = (S) => S.dangerCol;
  function setCore(b, c, snap) { const S = b.state; S.dangerCol = c; if (snap) Sound.sfx('tick', 1.5, c === 1 ? 1.4 : 0.7); FX.dome(0, 4.2, 0, { r: 4.5, color: c === 1 ? CY : c === 2 ? MG : 0x80c0ff, dur: 0.35 }); }
  function* polarize(b, o = {}) {
    const S = b.state, pat = pick(PATTERNS), inv = rnd() < 0.5 ? 1 : 0, time = o.time || 3.6, flips = o.flips || 0;
    for (const t of S.tiles) t.col = t.present && !(t.ix === 3 && t.iz === 3) ? ((pat(t.ix, t.iz) ^ inv) ? 1 : 2) : 0;
    let col = rndi(1, 2); setCore(b, col, true); Sound.sfx('charge', 0.8);
    const flipAt = []; for (let i = 0; i < flips; i++) flipAt.push(time * (0.45 + 0.28 * i) + rnd(-0.1, 0.1));
    S.pol = { t: time };
    yield* b.cast({ name: 'Polarize', time, onTick: (k, cs) => { S.pol.t = time - cs.t; if (flipAt.length && cs.t >= flipAt[0]) { flipAt.shift(); col = 3 - col; setCore(b, col, true); FX.flash(col === 1 ? CY : MG, 0.12, 6); } } });
    S.pol = null; const p = G.player, hex = col === 1 ? CY : MG; let n = 0;
    for (const t of S.tiles) { if (t.col === col) { t.flash = 1; if (!G.headless && (n++ % 2 === 0 || Math.hypot(t.x - p.pos.x, t.z - p.pos.z) < 7)) FX.pillar(t.x, t.z, { r: 2.1, h: 12, color: hex, dur: 0.5 }); FX.burst(t.x, 0.2, t.z, { n: 5, color: hex, speed: [1, 4], up: 6, life: [0.3, 0.8], radius: 1.8 }); } }
    Sound.sfx('zap'); Sound.sfx('boom', 0.8); FX.shake(0.5); FX.flash(hex, 0.18, 4);
    const ti = tIdx(p.pos.x, p.pos.z); if (p.alive && ti >= 0 && S.tiles[ti].col === col) p.hurt(380, { blockable: true, src: { name: 'Polarize' } });
    for (const t of S.tiles) t.col = 0; setCore(b, 0); yield 0.9;
  }
  function* sweep(b, n, dur, w, o = {}) {
    const S = b.state, a0 = b.angToPlayer() + PI / n + rnd(-0.2, 0.2), dir = rnd() < 0.5 ? 1 : -1;
    const sw = S.sweep = { n, a: a0, w: 0, tw: w * dir, arm: 1.3, t: dur, len: 24, rev: o.reverse ? dur * rnd(0.4, 0.6) : -1, warn: 0 };
    for (let i = 0; i < 4; i++) S.lasers[i].grp.visible = i < n;
    Sound.sfx('charge'); yield 1.3; Sound.sfx('laser'); sw.w = sw.tw;
    if (o.wait === false) return; yield dur + 0.3;
  }
  function* lance(b, n = 1) {
    for (let i = 0; i < n; i++) {
      const h = Hz.rect(0, 0, b.angToPlayer(), 26, 2.3, 1.75, 400, { name: 'Lance', color: 0xffe0a0, lock: 0.55, quiet: true, track: (s) => { s.dir = dampAng(s.dir, angTo(0, 0, G.player.pos.x, G.player.pos.z), 9, G.dt); }, onFire: (hh) => { const d = hh.shape.dir; FX.beam(new V3(0, 4.2, 0), new V3(Math.sin(d) * 26, 1, Math.cos(d) * 26), { color: 0xffe0a0, width: 1.0, dur: 0.4, mult: 3 }); Sound.sfx('laser', 1, 0.7); FX.shake(0.45); for (let k = 3; k < 26; k += 3) FX.burst(Math.sin(d) * k, 0.4, Math.cos(d) * k, { n: 5, color: 0xffe0a0, speed: [1, 5], up: 3, life: [0.3, 0.7] }); } });
      b.state.heat = 1; yield 1.75 + 0.45; void h;
    }
    yield 0.4;
  }
  function dropTiles(b, list, o = {}) { const S = b.state; for (const i of list) { const t = S.tiles[i]; if (!t.present || t.warn > 0) continue; t.warn = o.warn || 2.6; t.back = o.back || 0; } Sound.sfx('warn', 1.5, 0.5); }
  function* purge(b, n, back = 12) {
    const S = b.state, p = G.player; yield* b.cast({ name: 'Purge', time: 0.8 });
    const cand = S.tiles.filter((t) => t.present && t.warn <= 0 && !(t.ix === 3 && t.iz === 3)); const pi = tIdx(p.pos.x, p.pos.z); const list = [];
    if (pi >= 0 && S.tiles[pi].present && pi !== 24) list.push(pi);
    for (const t of shuffle(cand)) { if (list.length >= n) break; const i = t.iz * N + t.ix; if (!list.includes(i)) list.push(i); }
    dropTiles(b, list, { back }); yield 1.2;
  }
  function droneMesh() {
    const g = new THREE.Group(), st = new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 1, roughness: 0.25 });
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), st); body.position.y = 1.5; body.scale.y = 1.3; g.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), W.glow(0xffb030, 5)); eye.position.set(0, 1.5, 0.45); g.add(eye);
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 6, 28), W.glow(0xffb030, 2.5)); r.position.y = 1.5; r.rotation.x = PI / 2; g.add(r); g.userData.ring = r;
    const L = new THREE.PointLight(0xffb030, 12, 9, 1.6); L.position.y = 1.6; g.add(L); return g;
  }
  function spawnDrones(b, n) {
    n -= G.ents.filter((q) => q.isAdd && q.alive && q.name === 'Aegis Drone').length; if (n <= 0) return; // never stack past the intended count
    const S = b.state, spots = shuffle(S.tiles.filter((t) => t.present && t.warn <= 0 && Math.max(Math.abs(t.ix - 3), Math.abs(t.iz - 3)) === 2)).slice(0, n);
    b.immune = true; Sound.sfx('shield', 1, 0.5);
    for (const t of spots) {
      FX.pillar(t.x, t.z, { r: 1.2, h: 14, color: 0xffb030, dur: 0.7 });
      const a = b.spawnAdd({ name: 'Aegis Drone', hp: 600, x: t.x, z: t.z, radius: 0.9, aimY: 1.5, mesh: droneMesh(), color: 0xffb030,
        update(e) { e.pos.y = 0.3 + Math.sin(G.now * 3 + e.pos.x) * 0.15; e.group.children[0].userData.ring.rotation.z += G.dt * 3; },
        *run(e) { yield 2; while (e.alive) { const p = G.player; Bul.fire({ x: e.pos.x, z: e.pos.z, y: 1.5, dir: angTo(e.pos.x, e.pos.z, p.pos.x, p.pos.z), speed: 5.5, turn: 0.55, dmg: 110, color: 0xffb030, r: 0.45, life: 6, tag: 'fight' }); Sound.sfx('bolt', 0.4, 0.5); yield 4.6; } },
        onDeath() { if (!G.ents.some((q) => q.isAdd && q.alive && q.name === 'Aegis Drone')) { b.immune = false; Sound.sfx('shatter'); FX.dome(0, 4.2, 0, { r: 7, color: 0xffb030, dur: 0.6 }); } } });
      S.tethers.push(a);
    }
  }
  const dronesAlive = () => G.ents.some((q) => q.isAdd && q.alive);
  function* overclock(b, arms = 3, dur = 7) {
    const S = b.state; const r = yield* b.cast({ name: 'Overclock', time: 3.0, interruptible: true, onTick: (k) => { S.heat = k; } });
    if (r !== 'done') { S.heat = 0; yield 1.5; return; }
    Sound.sfx('roar', 0.7, 2.4); let t = 0, a0 = rnd(TAU); const sg = rnd() < 0.5 ? 1 : -1;
    while (t < dur) { for (let k = 0; k < arms; k++) { const a = a0 + k / arms * TAU; Bul.fire({ x: Math.sin(a) * 2.4, z: Math.cos(a) * 2.4, dir: a, speed: 7, dmg: 95, color: 0xffb030, r: 0.4, life: 4.5 }); } a0 += sg * 0.21; t += 0.13; S.heat = 1; yield 0.13; }
    S.heat = 0; yield 0.6;
  }
  function* supernova(b, waves = 4) {
    const S = b.state; yield* b.cast({ name: 'Supernova', time: 1.4, onTick: (k) => { S.heat = k; } });
    for (let w = 0; w < waves; w++) { const gap = b.angToPlayer() + rnd(-1.6, 1.6), gap2 = gap + PI + rnd(-0.6, 0.6); for (let i = 0; i < 44; i++) { const a = i / 44 * TAU; if (Math.abs(angDiff(a, gap)) < 0.3 || Math.abs(angDiff(a, gap2)) < 0.3) continue; Bul.fire({ x: Math.sin(a) * 2.4, z: Math.cos(a) * 2.4, dir: a, speed: 6.4, dmg: 100, color: w % 2 ? MG : CY, r: 0.4, life: 5 }); } FX.ring(0, 0, { r1: 9, color: 0xffffff, dur: 0.5 }); Sound.sfx('zap', 0.7, 0.6 + w * 0.1); FX.shake(0.3); yield 1.25; }
    S.heat = 0; yield 0.6;
  }
  function* eclipse(b, lvl) {
    const S = b.state, U = S.sky.material.uniforms; const i0 = S.sun.intensity, i1 = [2.6, 0.5, 1.5][lvl], n0 = U.uNeb.value, n1 = [0.55, 0.9, 1.5][lvl], h0 = S.hemi.intensity, h1 = [0.6, 0.35, 0.7][lvl], g0 = U.uSunGlow.value, g1 = [1, 0.15, 2.4][lvl], c0 = U.uSunCol.value.clone(), c1 = new THREE.Color([0xfff0d8, 0xff6030, 0xd0b0ff][lvl]);
    yield* W.tween(3, (k) => { S.sun.intensity = lerp(i0, i1, k); U.uNeb.value = lerp(n0, n1, k); S.hemi.intensity = lerp(h0, h1, k); U.uSunGlow.value = lerp(g0, g1, k); W.colorLerp(U.uSunCol.value, c0, c1, k); S.sun.color.copy(U.uSunCol.value); S.open = lerp(S.open, lvl * 0.5, k * 0.2); });
    S.open = lvl * 0.5;
  }

  G.bosses.push({
    id: 'engine', name: 'PARALLAX', title: 'The Astral Engine', hint: 'A machine', color: '#20d8ff', telegraph: 0xffb030,
    hp: 22000, radius: 2.2, aimY: 4.2, enrage: 420,
    post: { bloom: 0.6, threshold: 0.9, radius: 0.5, exposure: 1.0, vig: 1.0, sat: 1.15, contrast: 1.1, tint: [0.96, 1.0, 1.08] },
    music: { bpm: 122, root: 41, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 3, 5, 0, 0, 6, 4],
      layers: [
        { v: 'pulse', pat: '0.0.0.0.0.0.0.0.', oct: 0, len: 1, vol: 0.09 }, { v: 'pad', pat: '0...............', oct: 2, len: 16, vol: 0.09 }, { v: 'kick', pat: 'x...x...x...x...', vol: 0.3 },
        { v: 'hat', from: 1, pat: '..x...x...x...x.', vol: 0.14 }, { v: 'arp', from: 1, pat: '0.4.7.4.0.4.7.9.', oct: 2, len: 1, vol: 0.07 }, { v: 'snare', from: 1, pat: '....x.......x...', vol: 0.2 },
        { v: 'bass', from: 1, pat: '0..0..0.0..0..0.', oct: 0, len: 2, vol: 0.14 },
        { v: 'lead', from: 2, pat: ['0...4...7..6.4..', '2...4...9..7.4..'], oct: 2, len: 3, vol: 0.06 }, { v: 'hat', from: 2, pat: 'xxxxxxxxxxxxxxxx', vol: 0.07 }, { v: 'arp', from: 2, pat: '0479047904790479', oct: 3, len: 1, vol: 0.05 },
      ] },
    build,
    *intro(b) { yield* Cam.shot([26, 14, 26], [0, 2, 0], [10, 5, 15], [0, 4, 0], 4.4, 50); },
    phases: [
      { at: 1, *run(b) {
        yield 1;
        while (true) { yield* polarize(b); yield* lance(b); yield* sweep(b, 2, 10, 0.5); yield* overclock(b); yield* polarize(b); yield* lance(b, 2); yield* sweep(b, 2, 9, 0.55, { reverse: true }); }
      } },
      { at: 0.68, *enter(b) {
        const S = b.state; S.sweep = null; Sound.sfx('roar', 0.8, 2); FX.flash(0xff6030, 0.3, 1.5); FX.shake(0.7); Co.start(eclipse(b, 1), 'fight'); Co.start(Post.lerpTo({ bloom: 1.0, tint: [1.06, 0.96, 1.0] }, 3), 'fight');
        dropTiles(b, [0, 6, 42, 48, 3, 21, 27, 45], { warn: 3.2 }); S.conduit.emissive.setHex(0xff6030); S.trim.emissive.setHex(0xff8030); yield 3.6;
      }, *run(b) {
        while (true) {
          spawnDrones(b, 2); Co.start(sweep(b, 2, 14, 0.42, { wait: false }), 'phase'); { let w = 0; while (dronesAlive() && w < 26) { w += G.dt; yield; } } yield 0.8;
          yield* polarize(b, { flips: 1 }); yield* purge(b, 3); yield* lance(b, 2); yield* overclock(b, 3);
          Co.start(sweep(b, 3, 12, 0.5, { wait: false, reverse: true }), 'phase'); yield 2.5; yield* polarize(b, { flips: 1, time: 4 }); yield 4.5; yield* purge(b, 3); yield* lance(b);
        }
      } },
      { at: 0.35, *enter(b) {
        const S = b.state; S.sweep = null; for (const e of G.ents) if (e.isAdd) e.die(); b.immune = true;
        yield* b.cast({ name: 'Critical Mass', time: 2.6, onTick: (k) => { S.heat = k; FX.shake(k * 0.5); } });
        Sound.sfx('bigboom'); Sound.sfx('shatter'); FX.flash(0xffffff, 0.8, 1); FX.shake(1.3); FX.explode(0, 4.2, 0, 0xd0b0ff, 12, 0xffffff); Co.start(eclipse(b, 2), 'fight'); Co.start(Post.lerpTo({ bloom: 1.25, threshold: 0.75, tint: [1.02, 0.96, 1.12], exposure: 1.1 }, 2), 'fight');
        const outer = []; for (const t of S.tiles) if (t.present && Math.max(Math.abs(t.ix - 3), Math.abs(t.iz - 3)) === 3) outer.push(t.iz * N + t.ix); dropTiles(b, outer, { warn: 3.4 });
        S.conduit.emissive.setHex(0xb080ff); S.trim.emissive.setHex(0xd0a0ff); yield 3.8;
      }, *run(b) {
        while (true) {
          yield* supernova(b, 4);
          Co.start(sweep(b, 4, 11, 0.46, { wait: false, reverse: true }), 'phase'); yield 2.2; yield* polarize(b, { flips: 2, time: 4.2 }); yield 4.6;
          spawnDrones(b, 2); yield* lance(b, 2); { let w = 0; while (dronesAlive() && w < 22) { w += G.dt; yield; } }
          yield* purge(b, 3, 10); yield* overclock(b, 4, 7); yield* polarize(b, { flips: 2, time: 3.6 }); yield* lance(b);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      // tiles: warning, dropping, returning
      for (const q of S.tiles) {
        if (q.warn > 0) { q.warn -= dt; if (q.warn <= 0) { q.present = false; q.col = 0; if (q.back) q.backT = q.back; Sound.sfx('boom', 0.25, 1.8); } }
        if (!q.present && q.backT > 0) { q.backT -= dt; if (q.backT <= 0) { q.present = true; q.backT = 0; } }
      }
      // lasers
      const sw = S.sweep;
      if (sw) {
        sw.arm -= dt; sw.t -= dt; if (sw.arm <= 0) { if (sw.rev > 0 && sw.t < sw.rev) { sw.rev = -1; sw.warn = 0.9; sw.tw = -sw.tw; Sound.sfx('warn', 2, 1.6); } if (sw.warn > 0) { sw.warn -= dt; sw.w = damp(sw.w, 0, 6, dt); } else sw.w = damp(sw.w, sw.tw, 3, dt); }
        sw.a += sw.w * dt;
        if (sw.arm <= 0 && sw.t > 0 && p.alive && p.pos.y < 1.6) { const pr = Math.hypot(p.pos.x, p.pos.z), pa = Math.atan2(p.pos.x, p.pos.z); for (let i = 0; i < sw.n; i++) { const L = S.lasers[i]; L.cd -= dt; const da = angDiff(sw.a + i / sw.n * TAU, pa); if (pr < sw.len && Math.abs(Math.sin(da) * pr) < 0.75 && Math.cos(da) > 0 && L.cd <= 0) { L.cd = 1.0; p.hurt(270, { blockable: true, src: { name: 'Sweep' } }); FX.impact(p.pos.x, 1.2, p.pos.z, 0xff5030, 1); } } }
        if (sw.t <= -0.3 || G.state === 'win') { S.sweep = null; for (const L of S.lasers) L.grp.visible = false; }
      }
      if (G.headless) return;
      if (!S.sweep) for (const L of S.lasers) L.grp.visible = false;
      for (const q of S.tiles) {
        const targetY = q.present ? -0.3 : -60; q.y = q.present ? damp(q.y, targetY, 5, dt) : q.y + (targetY - q.y) * Math.min(1, dt * 0.9) - dt * 6; q.m.position.y = Math.max(-60, q.y); q.m.visible = q.y > -55;
        q.flash = Math.max(0, q.flash - dt * 2.2);
        const hex = q.warn > 0 ? WARN : COLS[q.col]; _c.setHex(hex); q.cur.lerp(_c, Math.min(1, dt * 10)); q.mat.emissive.copy(q.cur);
        q.mat.emissiveIntensity = (q.warn > 0 ? 2.5 + 2.5 * Math.sin(t * 16) : q.col ? 2.0 + (S.dangerCol === q.col ? 1.4 * (0.5 + 0.5 * Math.sin(t * 10)) : 0) : 1.2 + 0.3 * Math.sin(t * 1.5 + q.ix + q.iz)) + q.flash * 14;
      }
      if (sw) { const armed = sw.arm <= 0 && sw.t > 0, fl = sw.warn > 0 ? (Math.sin(t * 40) > 0 ? 1 : 0.2) : 1; for (let i = 0; i < sw.n; i++) { const L = S.lasers[i]; L.grp.rotation.y = sw.a + i / sw.n * TAU; L.mat.color.setHex(sw.warn > 0 ? 0xffffff : 0xff4020).multiplyScalar(armed ? 3.5 * fl : 0.5); L.grp.scale.set(armed ? 1 : 0.3, armed ? 1 : 0.3, 1); L.fl.color.setHex(0xff4020); L.fl.opacity = armed ? 0.3 : 0.12; if (armed && vrand() < dt * 30) { const r = 3 + vrand() * 16, a = L.grp.rotation.y; FX.burst(Math.sin(a) * r, 1.1, Math.cos(a) * r, { n: 1, color: 0xff6030, speed: [0.5, 2.5], life: [0.2, 0.5], size: [0.1, 0.25] }); } } }
      // core
      S.heat = Math.max(0, S.heat - dt * 0.6); const dc = S.dangerCol, ch = dc === 1 ? CY : dc === 2 ? MG : [0x90c8ff, 0xffa050, 0xe0c8ff][Math.min(2, Math.max(0, b.phase))];
      _c.setHex(ch); S.haloMat.uniforms.uC.value.lerp(_c, Math.min(1, dt * 12)); S.coreL.color.copy(S.haloMat.uniforms.uC.value); S.coreMat.color.copy(S.haloMat.uniforms.uC.value).multiplyScalar(1.6 + S.heat * 2.5 + (dc ? 1.2 : 0)).addScalar(0.35);
      S.coreL.intensity = 90 + S.heat * 200 + (dc ? 110 : 0) + b.phase * 40; S.halo.scale.setScalar(1 + S.heat * 0.5 + Math.sin(t * 3) * 0.05 + S.open * 0.5); S.core.rotation.y += dt * 2; S.core.scale.setScalar(1 + S.open * 0.5 + S.heat * 0.2);
      S.rig.position.y = 4.2 + Math.sin(t * 0.9) * 0.25;
      const sp = 0.5 + b.phase * 0.5 + S.heat * 3; S.gyro[0].rotation.x += dt * sp; S.gyro[0].rotation.y += dt * sp * 0.3; S.gyro[1].rotation.y += dt * sp * 0.8; S.gyro[1].rotation.z += dt * sp * 0.4; S.gyro[2].rotation.x -= dt * sp * 0.6; S.gyro[2].rotation.z += dt * sp * 0.7;
      for (const m of S.shards) { const u = m.userData; u.a += dt * u.sp * (1 + b.phase * 0.6); const r = 1.75 + S.open * 4.5 + S.heat * 0.6, ce = Math.cos(u.e * (1 - S.open * 0.5)); m.position.set(Math.sin(u.a) * r * ce, Math.sin(u.e) * r * (1 - S.open * 0.6), Math.cos(u.a) * r * ce); m.lookAt(S.rig.getWorldPosition(_v)); m.rotateX(PI / 2); }
      // drone tethers
      for (let i = S.tethers.length - 1; i >= 0; i--) { const a = S.tethers[i]; if (!a.alive) { S.tethers.splice(i, 1); continue; } if (vrand() < dt * 30) { const k = vrand(); FX.burst(lerp(a.pos.x, 0, k), lerp(1.6, 4.2, k), lerp(a.pos.z, 0, k), { n: 1, color: 0xffb030, speed: [0, 0.6], life: [0.2, 0.45], size: [0.15, 0.3] }); } }
      S.planet.rotation.y += dt * 0.004;
    },
    danger(b, x, z) {
      const S = b.state; let best = Infinity; const i = tIdx(x, z);
      if (i >= 0) { const q = S.tiles[i]; if (q.warn > 0) best = Math.max(0, q.warn - 0.5); if (S.pol && q.col === S.dangerCol) best = Math.min(best, S.pol.t); }
      const sw = S.sweep; if (sw && sw.t > 0) { const pr = Math.hypot(x, z), pa = Math.atan2(x, z), w = Math.abs(sw.arm > 0 ? sw.tw : sw.w) + 0.02, sg = Math.sign(sw.arm > 0 ? sw.tw : sw.w) || 1; for (let k = 0; k < sw.n; k++) { let gap = angDiff(sw.a + k / sw.n * TAU, pa) * sg; if (gap < -0.12 - 0.9 / Math.max(pr, 1)) gap += TAU; const tt = Math.max(0, gap - 0.9 / Math.max(pr, 1)) / w + Math.max(0, sw.arm); if (tt < best) best = tt; } }
      return best;
    },
    bot(b, p) {
      const S = b.state, add = G.ents.find((e) => e.isAdd && e.alive), h = { avoid: (x, z) => { const i = tIdx(x, z); return i < 0 || !S.tiles[i].present; } };
      if (add) { h.target = add; if (p.cls.id === 'duskblade') { const d = Math.hypot(p.pos.x - add.pos.x, p.pos.z - add.pos.z) || 1; h.x = add.pos.x + (p.pos.x - add.pos.x) / d * 2.2; h.z = add.pos.z + (p.pos.z - add.pos.z) / d * 2.2; } } else h.target = b;
      const sw = S.sweep; if (sw && sw.t > 0 && (p.cls.id === 'duskblade' || b.def.danger(b, p.pos.x, p.pos.z) < 1.6)) {
        const cx = h.x === undefined ? p.pos.x : h.x, cz = h.z === undefined ? p.pos.z : h.z, pa = Math.atan2(cx, cz); let best = 0, bd = 9;
        for (let k = 0; k < sw.n; k++) { const m = sw.a + (k + 0.5) / sw.n * TAU, d = Math.abs(angDiff(m, pa)); if (d < bd) { bd = d; best = m; } }
        const r = add ? Math.max(3.2, Math.hypot(cx, cz)) : p.cls.id === 'duskblade' ? 4.3 : 7.5; if (!add || bd > 0.5) { h.x = Math.sin(best) * r; h.z = Math.cos(best) * r; h.w = 1.5; }
      }
      return h;
    },
  });
  const _c = new THREE.Color(), _v = new V3();
})();
