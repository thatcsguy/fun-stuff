// DOOR I: MAESTRA OSSIA, the Glass Cathedral. A nave of five lanes; she plays them, then they answer.
(() => {
  const HX = 11, HZ = 17, LW = 4.4, GOLD = 0xffc24a;
  const LX = (i) => -8.8 + LW * i, laneOf = (x) => clamp(Math.floor((x + HX) / LW), 0, 4);
  const NOTES = [50, 53, 57, 60, 62];
  const WIN_COLS = [[0x2a4cff, 0x7a3cff, 0x20b0ff, 0xc0d8ff], [0xff2a2a, 0xff8a20, 0xffd040, 0x8a1030], [0xffe8a0, 0xffffff, 0xffb040, 0xff7030]];

  function glassTex(seed, rose) {
    const c = document.createElement('canvas'); c.width = 256; c.height = rose ? 256 : 512; const x = c.getContext('2d'), r = mulberry(seed);
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.save(); x.beginPath();
    if (rose) x.arc(128, 128, 124, 0, TAU); else { x.moveTo(8, 512); x.lineTo(8, 170); x.quadraticCurveTo(8, 40, 128, 6); x.quadraticCurveTo(248, 40, 248, 170); x.lineTo(248, 512); }
    x.closePath(); x.clip();
    const pal = ['#ffffff', '#b8c4ff', '#6f86ff', '#e8ecff', '#93a2e8', '#ffffff', '#cfd6ff'];
    if (rose) { for (let ring = 5; ring >= 0; ring--) { const n = 6 + ring * 4; for (let i = 0; i < n; i++) { x.fillStyle = pal[Math.floor(r() * pal.length)]; x.globalAlpha = 0.55 + r() * 0.45; x.beginPath(); x.moveTo(128, 128); x.arc(128, 128, 22 + ring * 21, i / n * TAU, (i + 1) / n * TAU); x.closePath(); x.fill(); x.globalAlpha = 1; x.strokeStyle = '#000'; x.lineWidth = 3; x.stroke(); } } }
    else {
      for (let j = 0; j < 16; j++) for (let i = 0; i < 6; i++) { const px = i * 43 + (j % 2) * 21 - 10, py = j * 33; x.fillStyle = pal[Math.floor(r() * pal.length)]; x.globalAlpha = 0.45 + r() * 0.55; x.beginPath(); x.moveTo(px + r() * 8, py + r() * 8); x.lineTo(px + 43 + r() * 8, py + r() * 8); x.lineTo(px + 43 + r() * 8, py + 33 + r() * 8); x.lineTo(px + r() * 8, py + 33 + r() * 8); x.closePath(); x.fill(); x.globalAlpha = 1; x.strokeStyle = '#000'; x.lineWidth = 3; x.stroke(); }
      x.fillStyle = '#fff'; x.beginPath(); x.arc(128, 150, 44, 0, TAU); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 5; x.stroke(); x.beginPath(); x.moveTo(128, 196); x.lineTo(84, 470); x.lineTo(172, 470); x.closePath(); x.fill(); x.stroke();
      for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(0, 130 + k * 120); x.lineTo(256, 130 + k * 120); x.lineWidth = 6; x.stroke(); }
      x.beginPath(); x.moveTo(128, 0); x.lineTo(128, 512); x.lineWidth = 6; x.stroke();
    }
    x.restore(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const curtainMat = (color, a = 0.5) => new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: a }, uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uC; uniform float uA,uT; varying vec2 vUv; void main(){ float a=(pow(clamp(1.0-vUv.y,0.0,1.0),2.2)*0.9+0.08+step(vUv.y,0.03)*2.0)*uA*(0.85+0.15*sin(vUv.x*40.0+uT*6.0+vUv.y*30.0)); gl_FragColor=vec4(uC*a*2.0,a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });

  const rayMat = (color, a) => new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: a } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float e=smoothstep(0.0,0.3,vUv.x)*smoothstep(1.0,0.7,vUv.x); float a=e*uA*(0.25+0.75*vUv.y)*smoothstep(0.0,0.12,vUv.y); gl_FragColor=vec4(uC*a,a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x04071a, horizon: 0x18204c, bottom: 0x020308, stars: 1.0, sunDir: [0.75, 0.55, 0.1], sunColor: 0xa8b8ff, sunSize: 0.05, sunGlow: 0.5 }); g.add(sky); S.sky = sky; W.env(sky, 0.5);
    scene.fog = new THREE.FogExp2(0x080a16, 0.013);
    S.hemi = W.hemi(g, 0x4a5a9a, 0x120c08, 0.55);
    S.sun = W.sun(g, { dir: [0.8, 0.75, 0.12], color: 0x9fb2ff, intensity: 2.4, size: 26 });
    S.organLight = new THREE.PointLight(0xffb060, 170, 60, 1.7); S.organLight.position.set(0, 9, -12); g.add(S.organLight);
    S.backLight = new THREE.PointLight(0x8090ff, 160, 50, 1.7); S.backLight.position.set(0, 10, 12); g.add(S.backLight);
    // floor
    const fl = W.surface('slabs', { n: 4, dark: 0x0e0d14, light: 0x5a566a, strength: 2.2 }); for (const k in fl) fl[k].repeat.set(3, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 44), new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, roughnessMap: fl.roughnessMap, roughness: 0.55, metalness: 0.35, envMapIntensity: 1.6 })); floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    S.inlay = new THREE.MeshStandardMaterial({ color: 0x1a1408, emissive: GOLD, emissiveIntensity: 0.7, metalness: 1, roughness: 0.3 });
    for (let i = 1; i < 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 34), S.inlay); m.position.set(-HX + LW * i, 0.012, 0); g.add(m); }
    for (const z of [-HZ, HZ]) { const m = new THREE.Mesh(new THREE.BoxGeometry(22, 0.02, 0.12), S.inlay); m.position.set(0, 0.012, z); g.add(m); }
    // walls, columns, ribs
    const st = W.surface('stone', { size: 256, dark: 0x0c0c12, light: 0x4a4a58 }); for (const k in st) st[k].repeat.set(1, 5);
    const stone = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.85 }), dark = W.mat({ color: 0x08080c, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 34, 44), dark); wall.position.set(sx * 14.6, 17, 0); g.add(wall);
      for (let k = 0; k < 6; k++) {
        const z = -HZ + k * 6.8, col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 20, 12), stone); col.position.set(sx * 12.7, 10, z); col.castShadow = true; g.add(col);
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 2.4), stone); base.position.set(sx * 12.7, 0.6, z); g.add(base);
        const capi = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.85, 1.4, 8), stone); capi.position.set(sx * 12.7, 20.4, z); g.add(capi);
        if (sx === 1) { const rib = new THREE.Mesh(new THREE.TorusGeometry(12.7, 0.4, 6, 28, PI), stone); rib.position.set(0, 21, z); g.add(rib); }
        const cand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), W.glow(0xffb050, 4)); cand.position.set(sx * 11.75, 2.3, z); g.add(cand);
      }
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 44), stone); ridge.position.set(0, 33.7, 0); g.add(ridge);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(14.6, 14.6, 44, 20, 1, true, PI / 2, PI), W.mat({ color: 0x050508, roughness: 1, side: THREE.BackSide })); roof.rotation.x = PI / 2; roof.position.y = 21; g.add(roof);
    const endWall = new THREE.Mesh(new THREE.BoxGeometry(30, 40, 1), dark); endWall.position.set(0, 20, 22); g.add(endWall);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 40, 1), dark); backWall.position.set(0, 20, -22.5); g.add(backWall);
    // stained glass + god rays
    S.windows = []; S.rays = [];
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
      const z = -HZ + 3.4 + k * 6.8, tex = glassTex(11 + k + (sx > 0 ? 7 : 0));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 15), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1) })); m.position.set(sx * 14.05, 11, z); m.rotation.y = -sx * PI / 2; g.add(m); S.windows.push(m);
      if (sx === 1) { const pv = new THREE.Group(); pv.position.set(4.6, 5.6, z); pv.rotation.z = -1.05; const ray = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 21), rayMat(0x8090ff, 0.1)); ray.rotation.y = PI / 2; pv.add(ray); g.add(pv); S.rays.push(ray); }
    }
    const rose = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshBasicMaterial({ map: glassTex(99, true) })); rose.position.set(0, 19, 21.4); rose.rotation.y = PI; g.add(rose); S.windows.push(rose);
    // organ
    const gold = W.mat({ color: 0xc9a050, roughness: 0.22, metalness: 1, envMapIntensity: 2 }), wood = W.mat({ color: 0x1c0f0a, roughness: 0.6 });
    const casing = new THREE.Mesh(new THREE.BoxGeometry(26, 7, 3), wood); casing.position.set(0, 3.5, -20.6); g.add(casing);
    S.pipeGlow = [];
    for (let i = 0; i < 5; i++) {
      const gm = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: GOLD, emissiveIntensity: 0.3 }); S.pipeGlow.push(gm);
      for (let j = 0; j < 7; j++) {
        const r = 0.2 + (3 - Math.abs(j - 3)) * 0.07, h = 9 + (3 - Math.abs(j - 3)) * 2.6 + (2 - Math.abs(i - 2)) * 2.2;
        const px = LX(i) + (j - 3) * 0.58, pz = -19.4 - (3 - Math.abs(j - 3)) * 0.12;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), gold); p.position.set(px, 7 + h / 2, pz); p.castShadow = true; g.add(p);
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, 0.5, 0.1), gm); mouth.position.set(px, 8.2, pz + r); g.add(mouth);
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.12, 10), gm); tip.position.set(px, 7 + h + 0.05, pz); g.add(tip);
      }
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4, 6), wood); spire.position.set(LX(i) - 2.2, 9, -19.6); g.add(spire);
      const band = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 0.25), gm); band.position.set(LX(i), 7.05, -19.0); g.add(band);
    }
    S.pipeTop = (i) => _tv.set(LX(i), 7 + 9 + 7.8 + (2 - Math.abs(i - 2)) * 2.2, -19.4);
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 0.5, 32), stone); dais.position.set(0, 0.0, -17.2); g.add(dais);
    S.motes = W.motes({ n: 500, box: [26, 22, 40], color: 0xbfc8ff, size: 0.07, vel: [0.05, -0.08, 0.03], sway: 0.5, center: [0, 11, 0], mult: 0.8 }); g.add(S.motes);

    // ---- Maestra ----
    const bg = b.group, velvet = W.mat({ color: 0x2a0812, roughness: 0.7, side: THREE.DoubleSide }), porcelain = W.mat({ color: 0xe8e2d8, roughness: 0.25, metalness: 0.05 });
    S.core = new THREE.Group(); S.core.scale.setScalar(1.3); bg.add(S.core);
    const pts = [[0.02, 6.3], [0.55, 6.1], [0.8, 5.3], [0.55, 4.4], [0.95, 3.2], [1.5, 1.6], [2.2, 0.5], [2.45, 0.3]].map((p) => new THREE.Vector2(p[0], p[1]));
    const robe = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), velvet); robe.castShadow = true; S.core.add(robe);
    S.trim = new THREE.MeshStandardMaterial({ color: 0x221a08, emissive: GOLD, emissiveIntensity: 1.6, metalness: 1, roughness: 0.3 });
    for (const [r, y] of [[2.45, 0.3], [0.57, 4.4], [0.82, 5.3]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 40), S.trim); t.rotation.x = PI / 2; t.position.y = y; S.core.add(t); }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 16), porcelain); head.scale.set(0.82, 1.12, 0.9); head.position.set(0, 6.95, 0.05); head.castShadow = true; S.core.add(head);
    S.eyes = W.glow(0xfff0c0, 4); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05), S.eyes); e.position.set(sx * 0.15, 7.02, 0.43); e.rotation.z = sx * 0.2; S.core.add(e); }
    for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.3, h = 1.2 + (4 - Math.abs(i - 4)) * 0.3; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 8), gold); p.position.set(Math.sin(a) * 0.75, 7.15 + Math.cos(a) * 0.75 + h * 0.2, -0.3); p.rotation.z = -a; S.core.add(p); }
    S.arms = [];
    for (const [sx, sy, ph] of [[1, 5.75, 0], [-1, 5.75, 1.6], [1, 5.2, 3.1], [-1, 5.2, 4.4]]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.72, sy, 0); S.core.add(sh);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 1.7, 8), porcelain); up.position.y = -0.85; sh.add(up);
      const el = new THREE.Group(); el.position.y = -1.7; sh.add(el);
      const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 1.7, 8), porcelain); lo.position.y = -0.85; el.add(lo);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), W.glow(GOLD, 3)); hand.position.y = -1.75; el.add(hand);
      S.arms.push({ sh, el, sx, ph, hand });
    }
    S.keys = [];
    for (let i = 0; i < 30; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.7), i % 5 === 1 || i % 5 === 3 ? W.mat({ color: 0x08080a, roughness: 0.3 }) : porcelain); S.core.add(k); S.keys.push(k); }
    S.walls = []; S.wallPool = [];
    for (let w = 0; w < 5; w++) { const grp = new THREE.Group(); grp.visible = false; const panes = []; for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(LW - 0.1, 10), curtainMat([0x4a70ff, 0xa050ff, 0x30c8ff, 0xff6090, 0xffc24a][w % 5], 0.55)); m.position.set(LX(i), 5, 0); grp.add(m); panes.push(m); } g.add(grp); S.wallPool.push({ grp, panes }); }
    S.pipeHeat = [0, 0, 0, 0, 0]; S.intensity = 0; S.winPhase = 0; S.flame = 0;
    return {
      edge: 'wall', spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: -15.6, face: 0 },
      contains: (x, z) => Math.abs(x) <= HX && Math.abs(z) <= HZ,
      clamp(p) { p.x = clamp(p.x, -HX + 0.4, HX - 0.4); p.z = clamp(p.z, -HZ + 0.4, HZ - 0.4); const dx = p.x, dz = p.z + 15.6, d = Math.hypot(dx, dz); if (d < 2.3) { p.x = dx / d * 2.3; p.z = -15.6 + dz / d * 2.3; } },
      camLimit(x, y, z) { return { x: clamp(x, -11.6, 11.6), y: Math.min(y, 19), z: clamp(z, -18, 20.5) }; },
    };
  }

  // ---- mechanics ----
  function playLane(b, i, loud) { const S = b.state; S.pipeHeat[i] = 1; Sound.note(NOTES[i] + (loud ? 0 : 12), 'organ', loud ? 0.9 : 0.5, loud ? 0.3 : 0.18); const t = S.pipeTop(i); FX.burst(t.x, t.y, t.z, { n: loud ? 16 : 6, color: GOLD, speed: [1, 4], up: 3, life: [0.4, 0.9], radius: 1.5 }); }
  function laneBlast(b, i) {
    for (let k = 0; k < 5; k++) FX.pillar(LX(i), -14 + k * 7, { r: 2.1, h: 18, color: GOLD, dur: 0.55 });
    FX.burst(LX(i), 0.3, 0, { n: 36, color: GOLD, color2: 0xfff4d0, speed: [1, 5], up: 7, life: [0.4, 1], size: [0.2, 0.5], radius: 2 }); FX.burst(LX(i), 0.3, -10, { n: 20, color: GOLD, speed: [1, 5], up: 7, life: [0.4, 1], radius: 2 }); FX.burst(LX(i), 0.3, 10, { n: 20, color: GOLD, speed: [1, 5], up: 7, life: [0.4, 1], radius: 2 });
    FX.light(LX(i), 3, G.player.pos.z, GOLD, 60, 0.4, 24); playLane(b, i, true); FX.shake(0.22);
  }
  const laneHz = (b, i, delay, dmg = 330) => Hz.rect(LX(i), -HZ, 0, HZ * 2, LW - 0.1, delay, dmg, { color: GOLD, quiet: true, silent: true, onFire: () => laneBlast(b, i) });
  function* chord(b, n, pv, rp, tell = 0.42) {
    let seq = [], last = -1; for (let k = 0; k < n; k++) { let l; do { l = rndi(0, 4); } while (l === last); seq.push(l); last = l; }
    const r = yield* b.cast({ name: 'Chord', time: n * pv + 0.5, onTick: (k, cs) => { const idx = Math.floor(cs.t / pv); if (idx < n && idx !== cs.last) { cs.last = idx; playLane(b, seq[idx]); Hz.mark({ type: 'rect', x: LX(seq[idx]), z: -HZ, dir: 0, len: HZ * 2, w: LW - 0.1 }, pv * 0.8, { color: 0xfff0b0, alpha: 0.5 }); } } });
    if (r !== 'done') return; yield 0.35;
    for (const l of seq) { laneHz(b, l, tell); yield rp; }
  }
  function* fortissimo(b, twice) {
    const l = laneOf(G.player.pos.x); b.state.strike = 1;
    yield* b.cast({ name: 'Fortissimo', time: 0.5 }); laneHz(b, l, 0.95, 400);
    if (twice) { yield 1.0; for (const j of [l - 1, l + 1]) if (j >= 0 && j < 5) laneHz(b, j, 0.85, 360); yield 0.5; }
    yield 1.0;
  }
  function glassWall(b, fromBack, gap, speed = 6.5) {
    const S = b.state, w = S.wallPool.find((q) => !q.grp.visible); if (!w) return;
    w.z = fromBack ? HZ + 1 : -HZ + 2.5; w.v = fromBack ? -speed : speed; w.gap = gap; w.grp.visible = true; w.hit = false;
    w.panes.forEach((m, i) => { m.visible = i !== gap; }); w.grp.position.z = w.z; S.walls.push(w); Sound.sfx('shield', 0.7, 0.6);
  }
  function* walls(b, n, gapT = 2.3, bothWays = false) {
    yield* b.cast({ name: 'Lumen', time: 0.8 }); let last = laneOf(G.player.pos.x);
    for (let k = 0; k < n; k++) { let gap; do { gap = rndi(0, 4); } while (Math.abs(gap - last) < 1 || Math.abs(gap - last) > 3); last = gap; glassWall(b, bothWays && k % 2 === 1, gap); yield gapT; }
  }
  function* dissonance(b, waves = 3) {
    const r = yield* b.cast({ name: 'Dissonance', time: 3.2, interruptible: true });
    if (r !== 'done') { yield 1.2; return; }
    Sound.sfx('bell', 0.8, 0.7);
    for (let k = 0; k < waves; k++) {
      const gaps = [rnd(-1.1, -0.5), rnd(-0.3, 0.3), rnd(0.5, 1.1)];
      for (let i = 0; i < 27; i++) { const a = -1.3 + i / 26 * 2.6; if (gaps.some((q) => Math.abs(a - q) < 0.21)) continue; Bul.fire({ x: Math.sin(a) * 2.7, z: -15.6 + Math.cos(a) * 2.7, dir: a, speed: 5.5 + k * 0.8, color: 0xd080ff, dmg: 110, life: 7, r: 0.4 }); }
      FX.ring(0, -15.6, { r1: 8, color: 0xd080ff, dur: 0.5 }); Sound.sfx('zap', 0.5, 0.5); yield 1.1;
    }
  }
  function choristerMesh() {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x6a5a30, emissive: 0xffd890, emissiveIntensity: 0.9, transparent: true, opacity: 0.8, roughness: 0.6, side: THREE.DoubleSide });
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.75, 2.3, 14, 1, true), m); robe.position.y = 1.35; g.add(robe);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), W.glow(0xfff0c0, 2.2)); hd.position.y = 2.65; g.add(hd);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 24), W.glow(GOLD, 4)); halo.position.set(0, 2.75, -0.2); g.add(halo);
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.36), W.glow(0xffffff, 1.6)); book.position.set(0, 1.8, 0.5); book.rotation.x = 0.5; g.add(book);
    const L = new THREE.PointLight(0xffd080, 14, 9, 1.6); L.position.y = 2; g.add(L);
    return g;
  }
  function spawnChorister(b, x, z) {
    FX.pillar(x, z, { r: 1.2, h: 16, color: 0xffe0a0, dur: 0.9 }); Sound.sfx('bell', 0.5, 2);
    return b.spawnAdd({
      name: 'Chorister', hp: 680, x, z, radius: 0.85, aimY: 1.7, mesh: choristerMesh(), color: 0xffe0a0, facing: angTo(x, z, 0, 0),
      update(a) { a.pos.y = 0.25 + Math.sin(G.now * 2 + x) * 0.12; if (a.castState && !G.headless && vrand() < 0.4) { FX.burst(a.pos.x, 2.6, a.pos.z, { n: 1, color: 0xffe0a0, dir: [-a.pos.x * 0.06, 0.5, (-15.6 - a.pos.z) * 0.06], spread: 0.2, speed: [5, 9], life: [0.5, 0.9], size: [0.15, 0.3] }); } },
      *run(a) {
        yield 1.2;
        while (a.alive) {
          const r = yield* a.cast({ name: 'Hymn', time: 9, interruptible: true });
          if (r === 'done') { b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.035); FX.beam(a.aim(new V3()), b.aim(new V3()), { color: 0xffe0a0, width: 0.5, dur: 0.6 }); FX.flash(0xffe0a0, 0.3, 2.5); Sound.sfx('bell', 1, 1.5); FX.ring(a.pos.x, a.pos.z, { r1: 30, color: 0xffe0a0, dur: 0.8, width: 0.2 }); G.player.hurt(240, { blockable: false, src: { name: 'Hymn' } }); yield 1.5; }
          else if (r === 'interrupted') { a.dmgTaken = 2; yield 5; a.dmgTaken = 1; }
        }
      },
    });
  }
  const choirAlive = () => G.ents.some((e) => e.isAdd && e.alive);
  function* setWindows(b, idx, dur = 2.5) {
    const S = b.state, pal = WIN_COLS[idx]; S.winPhase = idx;
    const from = S.windows.map((w) => w.material.color.clone()), to = S.windows.map((w, i) => new THREE.Color(pal[i % pal.length]).multiplyScalar(idx === 2 ? 3.2 : idx === 1 ? 2.0 : 1.2));
    const rc = [0x8090ff, 0xff5030, 0xffd080][idx], r0 = S.rays[0].material.uniforms.uC.value.clone(), r1 = new THREE.Color(rc), a0 = S.rays[0].material.uniforms.uA.value, a1 = [0.09, 0.16, 0.3][idx];
    yield* W.tween(dur, (k) => { S.windows.forEach((w, i) => W.colorLerp(w.material.color, from[i], to[i], k)); for (const r of S.rays) { W.colorLerp(r.material.uniforms.uC.value, r0, r1, k); r.material.uniforms.uA.value = lerp(a0, a1, k); } });
  }

  G.bosses.push({
    id: 'cathedral', name: 'MAESTRA OSSIA', title: 'The Glass Cathedral', hint: 'A hymn', color: '#8f7bff', telegraph: GOLD,
    hp: 26000, radius: 2.5, aimY: 5.4, enrage: 420,
    post: { bloom: 0.75, threshold: 0.82, radius: 0.7, exposure: 1.05, vig: 1.0, sat: 1.1, tint: [0.96, 0.98, 1.08] },
    music: { bpm: 80, root: 38, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 4, 0, 3, 4, 4],
      layers: [
        { v: 'organ', pat: '0...............', oct: 0, len: 16, vol: 0.2 },
        { v: 'choir', pat: '0.......4.......', oct: 2, len: 9, vol: 0.09 },
        { v: 'organ', from: 1, pat: ['0.2.4.2.0.2.4.7.', '0.2.4.2.7.4.2.4.'], oct: 2, len: 2, vol: 0.085 },
        { v: 'taiko', from: 1, pat: 'x.......x.....x.', vol: 0.3 },
        { v: 'organ', from: 2, pat: ['7654765423457654', '0246024674206420'], oct: 3, len: 1, vol: 0.06 },
        { v: 'taiko', from: 2, pat: 'x..x..x.x..x..xx', vol: 0.32 }, { v: 'bell', from: 2, pat: '0...............', oct: 1, len: 8, vol: 0.12 },
        { v: 'brass', from: 2, pat: ['0.......2.......', '4.......7.......'], oct: 1, len: 8, vol: 0.1 },
      ] },
    build,
    *intro(b) { yield* Cam.shot([0, 15, 17], [0, 12, -19], [0, 3.6, -2], [0, 6, -17], 4.6, 50); },
    phases: [
      { at: 1, *run(b) {
        yield 1.0;
        while (true) {
          yield* chord(b, 3, 0.6, 0.95); yield 1.0;
          yield* fortissimo(b); yield 0.5;
          yield* walls(b, 2, 2.6); yield 2.2;
          yield* dissonance(b, 2); yield 0.8;
          yield* fortissimo(b);
          yield* chord(b, 4, 0.55, 0.9); yield 1.2;
        }
      } },
      { at: 0.68, *enter(b) {
        const S = b.state; Sound.sfx('roar', 0.7, 1.6); S.strike = 1; Co.start(setWindows(b, 1), 'fight'); Co.start(Post.lerpTo({ tint: [1.1, 0.95, 0.92], bloom: 0.9 }, 2.5), 'fight');
        S.organLight.color.set(0xff6040); FX.flash(0xff4030, 0.35, 1.5); FX.shake(0.6);
        for (let i = 0; i < 5; i++) { playLane(b, i, true); yield 0.22; } yield 1.2; S.intensity = 1;
      }, *run(b) {
        while (true) {
          spawnChorister(b, -8.8, -8); spawnChorister(b, 8.8, -8); yield 1.5;
          yield* fortissimo(b); yield 1.2; yield* fortissimo(b); yield 1.0;
          yield* chord(b, 3, 0.5, 0.85); yield 1.0;
          yield* fortissimo(b); { let w = 0; while (choirAlive() && w < 12) { w += G.dt; yield; } } yield 1.0;
          yield* walls(b, 3, 2.1, true); yield 2.0;
          yield* chord(b, 4, 0.48, 0.8); yield 0.6;
          yield* dissonance(b, 3); yield 0.6;
          yield* fortissimo(b, true); yield 0.8;
        }
      } },
      { at: 0.34, *enter(b) {
        const S = b.state; for (const e of G.ents) if (e.isAdd) e.die();
        yield* b.cast({ name: 'Crescendo', time: 2.4, onTick: (k) => { FX.shake(k * 0.5); for (let i = 0; i < 5; i++) S.pipeHeat[i] = k; } });
        Sound.sfx('shatter'); Sound.sfx('bigboom'); FX.flash(0xfff0d0, 0.75, 1.1); FX.shake(1.2);
        for (const w of S.windows) FX.burst(w.position.x * 0.96, w.position.y, w.position.z, { n: 60, color: 0xffe0a0, color2: 0xff7030, dir: [-Math.sign(w.position.x), -0.1, w.position.x === 0 ? -1 : 0], spread: 0.7, speed: [4, 18], grav: 9, life: [0.8, 2], size: [0.12, 0.4] });
        Co.start(setWindows(b, 2, 1.2), 'fight'); Co.start(Post.lerpTo({ tint: [1.12, 1.0, 0.86], bloom: 1.15, exposure: 1.15 }, 1.5), 'fight');
        S.inlay.emissiveIntensity = 3.5; S.organLight.color.set(0xffa040); S.organLight.intensity = 380; S.hemi.intensity = 0.9; S.intensity = 2; S.flame = 1; scene.fog.color.set(0x1a0e08);
        yield 1.4;
      }, *run(b) {
        let n = 0;
        while (true) {
          Co.start(walls(b, 2, 3.0, true), 'phase'); yield 1.2;
          yield* chord(b, 5, 0.42, 0.72, 0.36); yield 0.8;
          yield* fortissimo(b, true); yield 0.4;
          if (n++ % 2 === 0) spawnChorister(b, rnd() < 0.5 ? -8.8 : 8.8, -6);
          yield* dissonance(b, 3); yield 0.5;
          yield* fortissimo(b, true);
          // finale: alternating lanes
          yield* b.cast({ name: 'Fugue', time: 1.0 });
          for (let k = 0; k < 6; k++) { for (let i = 0; i < 5; i++) if (i % 2 === k % 2) laneHz(b, i, 0.8, 330); yield 1.15; }
          yield 0.8;
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      // moving glass walls
      for (let i = S.walls.length - 1; i >= 0; i--) {
        const w = S.walls[i], pz = w.z; w.z += w.v * dt; w.grp.position.z = w.z;
        for (const m of w.panes) m.material.uniforms.uT.value = t;
        if (!w.hit && p.alive && (p.pos.z - pz) * (p.pos.z - w.z) <= 0 && laneOf(p.pos.x) !== w.gap) { w.hit = true; p.hurt(300, { blockable: true, src: { name: 'Lumen' } }); FX.impact(p.pos.x, 1.2, p.pos.z, 0xa0b0ff, 1.2); }
        if (Math.abs(w.z) > HZ + 1.5 || G.state === 'win') { w.grp.visible = false; S.walls.splice(i, 1); }
      }
      if (G.headless) return;
      const casting = b.castState ? 1 : 0; S.strike = Math.max(0, (S.strike || 0) - dt * 1.5);
      S.core.position.y = 0.5 + Math.sin(t * 1.1) * 0.18;
      for (const a of S.arms) {
        const sw = Math.sin(t * (1.6 + S.intensity * 0.7) + a.ph), up = casting * 0.9 + S.strike * 1.2;
        a.sh.rotation.set(-0.5 - up * 0.9 + sw * 0.25, 0, a.sx * (0.5 + up * 0.5 + Math.cos(t * 1.3 + a.ph) * 0.2)); a.el.rotation.set(-0.9 + sw * 0.4 - S.strike * 0.5, 0, 0);
      }
      S.keys.forEach((k, i) => { const a = i / 30 * TAU + t * 0.25, wv = Math.max(0, Math.sin(t * 5 - i * 0.7)); k.position.set(Math.sin(a) * 2.9, 3.3 + Math.sin(a * 2 + t) * 0.15 - wv * 0.1 * (1 + S.intensity), Math.cos(a) * 2.9); k.rotation.y = a; });
      for (let i = 0; i < 5; i++) { S.pipeHeat[i] = Math.max(0, S.pipeHeat[i] - dt * 1.6); S.pipeGlow[i].emissiveIntensity = 0.3 + S.intensity * 0.5 + S.pipeHeat[i] * 7; }
      S.trim.emissiveIntensity = 1.6 + S.intensity + casting * 2 + Math.sin(t * 3) * 0.3;
      S.organLight.intensity = (S.intensity === 2 ? 380 : 170) * (0.9 + Math.sin(t * 7) * 0.04 + Math.sin(t * 13.3) * 0.03);
      if (S.flame && vrand() < dt * 40) { const i = Math.floor(vrand() * 5), tp = S.pipeTop(i); FX.burst(tp.x + (vrand() - 0.5) * 3, tp.y - vrand() * 4, tp.z, { n: 2, color: 0xffa030, color2: 0xff3010, speed: [0.5, 2], up: 6, life: [0.5, 1.2], size: [0.3, 0.8] }); }
      if (S.flame && vrand() < dt * 12) FX.burst((vrand() - 0.5) * 22, 16 + vrand() * 6, (vrand() - 0.5) * 34, { n: 1, color: 0xffd080, speed: [0, 0.5], grav: 2.5, life: [2, 4], size: [0.08, 0.2] });
    },
    danger(b, x, z) { let best = Infinity; for (const w of b.state.walls) { if (laneOf(x) === w.gap) continue; const tt = (z - w.z) / w.v; if (tt > -0.1 && tt < best) best = Math.max(0, tt); } return best; },
    bot(b, p) {
      const add = G.ents.find((e) => e.isAdd && e.alive); const h = {};
      if (add) { h.target = add; h.saveInterrupt = true; if (p.cls.id === 'duskblade') { const d = Math.hypot(p.pos.x - add.pos.x, p.pos.z - add.pos.z) || 1; h.x = add.pos.x + (p.pos.x - add.pos.x) / d * 2.2; h.z = add.pos.z + (p.pos.z - add.pos.z) / d * 2.2; } } else h.target = b;
      return h;
    },
  });
})();
