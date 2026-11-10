// DOOR II: THALASSOR, the Storm Tide. A stone platform in a black sea. The waves take whatever is not behind a rock.
(() => {
  const R = 16, TEAL = 0x35e0d0, SEA_Y = -2.6;
  const PIL = [0.785, 2.356, 3.927, 5.498].map((a) => ({ x: Math.sin(a) * 8.5, z: Math.cos(a) * 8.5, alive: true, mesh: null }));
  const along = (x, z, d) => x * Math.sin(d) + z * Math.cos(d), lat = (x, z, d) => x * Math.cos(d) - z * Math.sin(d);
  function sheltered(S, x, z, d) { for (const q of S.pil) { if (!q.alive) continue; const da = along(x, z, d) - along(q.x, q.z, d), dl = Math.abs(lat(x, z, d) - lat(q.x, q.z, d)); if (da > 0.2 && da < 6.2 && dl < 1.5) return true; } return false; }

  function build(b) {
    const g = G.world, S = b.state; S.pil = PIL.map((q) => Object.assign({}, q, { alive: true }));
    const sunDir = [0.2, 0.75, -0.6];
    const sky = W.sky({ top: 0x0a1118, horizon: 0x3a4c5a, bottom: 0x04080b, clouds: 0.85, cloudColor: 0x6a7c8a, cloudDark: 0x0c1218, cloudScale: 1.1, cloudSpeed: 0.05, sunDir, sunColor: 0xcfe0ff, sunSize: 0.0, sunGlow: 0.0 }); g.add(sky); S.sky = sky; W.env(sky, 0.9);
    scene.fog = new THREE.FogExp2(0x18242c, 0.0075);
    S.hemi = W.hemi(g, 0x7a94aa, 0x1a2228, 1.7);
    S.sun = W.sun(g, { dir: [0.35, 0.8, -0.45], color: 0xb8d0ea, intensity: 2.6, size: 24 });
    S.flashL = new THREE.DirectionalLight(0xcfe0ff, 0); S.flashL.position.set(-30, 50, 20); g.add(S.flashL);
    S.water = W.water({ size: 1400, seg: 220, deep: 0x02090e, shallow: 0x0c3038, sky: 0x4a5a66, sunDir, sunColor: 0x8fa8c0, amp: 1.15, scale: 0.035, speed: 1.3, foam: 0.7, y: SEA_Y }); g.add(S.water);
    // platform
    const st = W.surface('slabs', { n: 5, dark: 0x1c2428, light: 0x8a9aa2, strength: 2.6 }); for (const k in st) st[k].repeat.set(4, 4);
    const top = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughnessMap: st.roughnessMap, roughness: 0.42, metalness: 0.25, envMapIntensity: 1.5 })); top.rotation.x = -PI / 2; top.receiveShadow = true; g.add(top);
    const rk = W.surface('rock', { size: 256, dark: 0x141a1e, light: 0x7a8890, strength: 4 }); for (const k in rk) rk[k].repeat.set(8, 2);
    const rock = new THREE.MeshStandardMaterial({ map: rk.map, normalMap: rk.normalMap, roughness: 0.6, metalness: 0.1 });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 2.5, 14, 72, 1, true), rock); drum.position.y = -7; g.add(drum);
    S.rune = new THREE.MeshStandardMaterial({ color: 0x06100f, emissive: TEAL, emissiveIntensity: 0.9, roughness: 0.4 });
    for (const [r0, r1] of [[15.2, 15.45], [4.0, 4.15]]) { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96), S.rune); m.rotation.x = -PI / 2; m.position.y = 0.015; g.add(m); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 2.2), S.rune); m.position.set(Math.sin(a) * 13.6, 0.012, Math.cos(a) * 13.6); m.rotation.y = a; g.add(m); }
    for (let i = 0; i < 22; i++) { const a = i / 22 * TAU + 0.1, h = 0.5 + W.hash2(i, 3, 1) * 1.3, m = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.1), rock); if (W.hash2(i, 9, 2) < 0.3) continue; m.position.set(Math.sin(a) * (R + 0.45), h / 2 - 0.15, Math.cos(a) * (R + 0.45)); m.rotation.y = a + (W.hash2(i, 1, 4) - 0.5) * 0.3; m.castShadow = true; g.add(m); }
    // pillars
    for (const q of S.pil) {
      const grp = new THREE.Group(); grp.position.set(q.x, 0, q.z);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, rr = k === 0 ? 0 : 0.85, h = 4.2 + W.hash2(k, Math.round(q.x * 10), 7) * 3.2; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.92, h, 6), rock); c.position.set(Math.sin(a) * rr, h / 2, Math.cos(a) * rr); c.rotation.y = a; c.castShadow = true; c.receiveShadow = true; grp.add(c); }
      g.add(grp); q.mesh = grp;
    }
    // distant lighthouse + rocks
    const lh = new THREE.Group(); lh.position.set(-70, SEA_Y, -150); g.add(lh);
    const isle = new THREE.Mesh(new THREE.ConeGeometry(26, 22, 9), rock); isle.position.y = 4; lh.add(isle);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 5, 44, 12), W.mat({ color: 0x8a8f94, roughness: 0.8 })); tower.position.y = 34; lh.add(tower);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 10), W.glow(0xfff0b0, 6)); lamp.position.y = 58; lh.add(lamp);
    S.beam = new THREE.Group(); S.beam.position.y = 58; lh.add(S.beam);
    for (const sgn of [1, -1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(16, 260, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c0).multiplyScalar(0.35), transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); c.rotation.z = sgn * PI / 2; c.position.x = -sgn * 130; S.beam.add(c); }
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.4, d = 60 + W.hash2(i, 2, 9) * 110, h = 10 + W.hash2(i, 5, 9) * 26, m = new THREE.Mesh(new THREE.ConeGeometry(5 + h * 0.25, h, 6), rock); m.position.set(Math.sin(a) * d, SEA_Y + h / 2 - 2, Math.cos(a) * d); m.rotation.set(0.2 * Math.sin(i), i, 0.15); g.add(m); }
    S.rain = W.motes({ n: 2200, box: [60, 34, 60], color: 0xa8c0d8, size: 0.55, vel: [-4, -30, -2.5], streak: true, alpha: 0.5, center: [0, 15, 0], mult: 0.7 }); g.add(S.rain);
    S.spray = W.motes({ n: 300, box: [44, 5, 44], color: 0xcfe0e8, size: 0.16, vel: [-2.5, 0.2, -1.5], sway: 1.2, alpha: 0.35, center: [0, 1.6, 0] }); g.add(S.spray);

    // ---- the serpent ----
    const bg = b.group; S.neckRoot = new THREE.Group(); g.add(S.neckRoot);
    const sc = W.surface('stone', { size: 256, n: 14, dark: 0x041a1c, light: 0x1f6a66, strength: 5 }); for (const k in sc) sc[k].repeat.set(3, 2);
    S.scale = new THREE.MeshStandardMaterial({ map: sc.map, normalMap: sc.normalMap, roughness: 0.32, metalness: 0.55, envMapIntensity: 1.8 });
    S.belly = W.mat({ color: 0x8fa89a, roughness: 0.5, metalness: 0.1 });
    S.lum = new THREE.MeshStandardMaterial({ color: 0x021010, emissive: TEAL, emissiveIntensity: 2.2, roughness: 0.4 });
    const segGeo = new THREE.SphereGeometry(1, 16, 12), finGeo = new THREE.ConeGeometry(0.22, 1.5, 4);
    const mkSeg = (parent, s) => {
      const grp = new THREE.Group(); const m = new THREE.Mesh(segGeo, S.scale); m.scale.set(s, s * 0.92, s * 1.5); m.castShadow = true; grp.add(m);
      const bl = new THREE.Mesh(segGeo, S.belly); bl.scale.set(s * 0.8, s * 0.6, s * 1.4); bl.position.y = -s * 0.42; grp.add(bl);
      const f = new THREE.Mesh(finGeo, S.lum); f.scale.setScalar(s * 0.9); f.position.y = s * 1.25; f.rotation.x = -0.5; grp.add(f);
      for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), S.lum); l.scale.setScalar(s); l.position.set(sx * s * 0.86, s * 0.2, 0); grp.add(l); }
      parent.add(grp); return grp;
    };
    S.segs = []; for (let i = 0; i < 16; i++) S.segs.push(mkSeg(S.neckRoot, 1.5 - i * 0.035));
    const head = S.head = new THREE.Group(); S.neckRoot.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), S.scale); skull.scale.set(1.35, 0.95, 1.9); skull.castShadow = true; head.add(skull);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(1.0, 3.4, 10), S.scale); snout.rotation.x = PI / 2; snout.scale.set(1.15, 1, 0.62); snout.position.set(0, 0.05, 2.5); snout.castShadow = true; head.add(snout);
    S.jaw = new THREE.Group(); S.jaw.position.set(0, -0.45, 0.4); head.add(S.jaw);
    const jw = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 10), S.belly); jw.rotation.x = PI / 2; jw.scale.set(1.05, 1, 0.34); jw.position.set(0, -0.1, 1.9); S.jaw.add(jw);
    S.maw = W.glow(TEAL, 0.2); const mw = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), S.maw); mw.scale.set(1, 0.4, 1.8); mw.position.set(0, -0.35, 1.3); head.add(mw);
    for (let i = 0; i < 12; i++) { const sx = i % 2 ? 1 : -1, t = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 5), W.mat({ color: 0xe8e4d8, roughness: 0.3 })); t.rotation.x = PI; t.position.set(sx * (0.75 - Math.floor(i / 2) * 0.09), -0.42, 1.2 + Math.floor(i / 2) * 0.42); head.add(t); }
    S.eyeMat = W.glow(0xfff2a0, 5); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), S.eyeMat); e.scale.set(0.6, 1, 1.5); e.position.set(sx * 1.08, 0.38, 0.95); head.add(e); }
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.2 - k * 0.03, 2.6 - k * 0.5, 6), S.scale); h.position.set(sx * (0.8 + k * 0.3), 0.7 - k * 0.35, -1.5 + k * 0.1); h.rotation.set(-1.15 + k * 0.2, 0, -sx * (0.35 + k * 0.4)); h.castShadow = true; head.add(h); const fr = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 3), S.lum); fr.scale.z = 0.06; fr.position.set(sx * (1.3 + k * 0.2), -0.1 - k * 0.3, -0.9); fr.rotation.set(-1.2, sx * 0.9, -sx * 0.7); if (k === 0) head.add(fr); }
    S.headL = new THREE.PointLight(TEAL, 30, 26, 1.6); head.add(S.headL);
    // far coils of the body in the sea, and the P3 coil around the platform
    S.coils = new THREE.Group(); g.add(S.coils);
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(7 + i * 1.4, 1.5 + (i % 2) * 0.5, 10, 30, PI), S.scale); const a = i * 1.26 + 0.7, d = 34 + (i % 3) * 14; t.position.set(Math.sin(a) * d, SEA_Y - 1, Math.cos(a) * d); t.rotation.y = a + 1.2; S.coils.add(t); }
    S.ring = new THREE.Group(); S.ring.position.y = -9; g.add(S.ring); S.ringSegs = [];
    for (let i = 0; i < 34; i++) { const s = mkSeg(S.ring, 1.25); S.ringSegs.push(s); }
    S.ringUp = 0;
    // wave meshes
    S.waveMat = () => new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uH: { value: 1 }, uGlow: { value: new THREE.Color(0x000000) } },
      vertexShader: 'uniform float uT,uH; varying vec2 vUv; void main(){ vUv=uv; vec3 p=position; float y=uv.y; p.z+=pow(y,2.2)*3.6+sin(p.x*0.35+uT*3.0)*0.5*y; p.y*=uH*(0.85+0.15*sin(p.x*0.22+uT*2.0)); gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }',
      fragmentShader: 'uniform float uT; uniform vec3 uGlow; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); } float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); } void main(){ float s=n(vec2(vUv.x*60.0,vUv.y*6.0-uT*3.0)); float foam=smoothstep(0.62,0.98,vUv.y+s*0.25); vec3 c=mix(vec3(0.01,0.07,0.09),vec3(0.05,0.24,0.27),vUv.y*0.8+s*0.2)+uGlow*(0.5+s); c=mix(c,vec3(0.5,0.6,0.63),foam); float a=smoothstep(0.0,0.08,vUv.y)*(0.8+0.2*foam)*smoothstep(0.0,0.05,vUv.x)*smoothstep(1.0,0.95,vUv.x); gl_FragColor=vec4(c,a); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    S.wavePool = []; for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 8.5, 48, 8), S.waveMat()); m.geometry.translate(0, 4.25, 0); m.visible = false; m.renderOrder = 8; g.add(m); S.wavePool.push(m); }
    S.waves = []; S.ang = PI; S.sub = 0; S.subT = 0; S.headPos = new V3(0, 6, 4); S.headTgt = new V3(0, 6.2, 4.2); S.jawOpen = 0; S.lunge = 0; S.breach = null; S.boltT = 5; S.storm = 0; S.pulls = []; S.flash = 0;
    S.tail = new THREE.Mesh(new THREE.ConeGeometry(1.6, 18, 10), S.scale); S.tail.visible = false; g.add(S.tail);
    return {
      edge: 'fall', radius: R, spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: -16.6, face: 0 },
      contains: (x, z) => x * x + z * z <= R * R,
      solid(p) { for (const q of S.pil) { if (!q.alive) continue; const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz); if (d < 2.0 && d > 0.001) { p.x = q.x + dx / d * 2.0; p.z = q.z + dz / d * 2.0; } } },
      bulletBounds(x, z) { if (x * x + z * z > 900) return false; for (const q of S.pil) if (q.alive && Math.hypot(x - q.x, z - q.z) < 1.7) return false; return true; },
    };
  }

  // ---- mechanics ----
  function place(b, ang) { const S = b.state; S.ang = ang; b.pos.set(Math.sin(ang) * 16.6, 0, Math.cos(ang) * 16.6); b.facing = ang + PI; }
  function spawnWave(b, dir, speed, dmg) {
    const S = b.state, m = S.wavePool.find((q) => !q.visible); if (!m) return;
    const w = { dir, s: -40, speed, mesh: m, dmg, hit: false }; m.visible = true; m.rotation.y = dir; S.waves.push(w); Sound.sfx('wave');
  }
  function marks(S, dir, dur) { for (const q of S.pil) if (q.alive) Hz.mark({ type: 'rect', x: q.x + Math.sin(dir) * 1.5, z: q.z + Math.cos(dir) * 1.5, dir, len: 4.7, w: 2.9 }, dur, { color: 0x60c8ff, alpha: 0.75 }); }
  function* tidal(b, o = {}) {
    const S = b.state, dir = wrapPi(S.ang + PI), time = o.time || 3.0, speed = o.speed || 15;
    S.pend = { dir, t: time, speed }; marks(S, dir, time + 2.4);
    yield* b.cast({ name: 'Tidal Wave', time, onTick: (k, cs) => { S.jawOpen = k; S.headTgt.set(0, 8 + k * 2, 2.5); if (S.pend) S.pend.t = time - cs.t; } });
    S.pend = null; S.headTgt.set(0, 6.2, 4.2); spawnWave(b, dir, speed, 360); Sound.sfx('roar', 0.9);
    if (o.second) { yield 1.5; const d2 = wrapPi(dir + (rnd() < 0.5 ? 1 : -1) * PI / 2); marks(S, d2, 3.6); S.pend = { dir: d2, t: 1.0, speed }; yield 1.0; S.pend = null; spawnWave(b, d2, speed, 360); }
    yield 2.6;
  }
  function* bite(b) {
    const S = b.state, a = b.angToPlayer(); b.autoFace = false; yield* b.turnTo(a, 0.25);
    S.headTgt.set(0, 7.5, 1.5); S.jawOpen = 1;
    Hz.cone(b.pos.x, b.pos.z, a, 1.15, 13.5, 1.25, 390, { name: 'Bite', kb: { dist: 5 }, onFire: () => { S.lunge = 1; Sound.sfx('crit', 1, 0.6); FX.shake(0.5); const x = b.pos.x + Math.sin(a) * 8, z = b.pos.z + Math.cos(a) * 8; FX.explode(x, 0.5, z, TEAL, 4, 0xffffff); } });
    yield 1.25; S.headTgt.set(0, 1.6, 9.5); yield 0.45; S.headTgt.set(0, 6.2, 4.2); S.jawOpen = 0; b.autoFace = true; yield 0.9;
  }
  function strike(x, z, puddle) {
    Hz.circle(x, z, 2.8, 1.0, 280, { name: 'Stormcall', color: 0xbfe0ff, quiet: true, onFire: () => {
      FX.lightning(new V3(x + (vrand() - 0.5) * 8, 60, z + (vrand() - 0.5) * 8), new V3(x, 0, z), { color: 0xdff0ff, width: 0.45, jag: 3, dur: 0.3 }); FX.pillar(x, z, { r: 1.6, h: 40, color: 0xbfe0ff, dur: 0.35 }); FX.explode(x, 0.4, z, 0xbfe0ff, 3.4); Sound.sfx('thunder', 0.8); FX.flash(0xdff0ff, 0.2, 5);
      if (puddle) Hz.zone({ type: 'circle', x, z, r: 2.8 }, 7, 50, { name: 'Charged water', color: 0x80c8ff, delay: 0.3, every: 0.5 });
    } });
  }
  function* lightning(b, n, puddle) { yield* b.cast({ name: 'Stormcall', time: 0.9 }); for (let i = 0; i < n; i++) { const p = G.player; strike(p.pos.x, p.pos.z, puddle && i % 2 === 0); yield 0.72; } yield 0.8; }
  function* deluge(b, dur = 6) {
    const S = b.state; S.headTgt.set(0, 7.5, 3); const r = yield* b.cast({ name: 'Deluge', time: 3.2, interruptible: true, onTick: (k) => { S.jawOpen = k; S.maw.color.setHex(TEAL).multiplyScalar(k * 6); } });
    S.maw.color.setHex(TEAL).multiplyScalar(0.2);
    if (r !== 'done') { S.jawOpen = 0; S.headTgt.set(0, 4.5, 4.2); yield 1.4; S.headTgt.set(0, 6.2, 4.2); return; }
    let t = 0, k = 0; S.maw.color.setHex(TEAL).multiplyScalar(5);
    while (t < dur) { const a = b.angToPlayer(), hx = b.pos.x + Math.sin(b.facing) * 4.5, hz = b.pos.z + Math.cos(b.facing) * 4.5; for (const off of (k % 2 ? [-0.36, 0, 0.36] : [-0.18, 0.18])) Bul.fire({ x: hx, z: hz, y: 1.2, dir: a + off, speed: 11.5, dmg: 95, color: 0x60e0ff, r: 0.42, life: 4 }); Sound.sfx('bolt', 0.4, 0.7); k++; t += 0.34; yield 0.34; }
    S.jawOpen = 0; S.maw.color.setHex(TEAL).multiplyScalar(0.2); S.headTgt.set(0, 6.2, 4.2); yield 0.8;
  }
  function whirlpool(b, dur = 13) {
    const S = b.state, a = rnd(TAU), r = rnd(2, 7), x = Math.sin(a) * r, z = Math.cos(a) * r;
    const pull = { x, z, t: dur + 1.2, arm: 1.2 }; S.pulls.push(pull); Sound.sfx('wave', 0.6, 1.5);
    Hz.zone({ type: 'circle', x, z, r: 2.6 }, dur, 90, { name: 'Whirlpool', color: 0x30a0c0, delay: 1.2, every: 0.5 });
  }
  function* breach(b) {
    const S = b.state; S.headTgt.set(0, 3, 2); b.autoFace = false;
    yield* b.cast({ name: 'Sound', time: 0.9 }); S.subT = 1; b.targetable = false; Sound.sfx('wave', 0.8, 1.6); yield 1.6;
    const p = G.player, dir = rnd(TAU), ox = p.pos.x - Math.sin(dir) * 22, oz = p.pos.z - Math.cos(dir) * 22;
    Hz.rect(ox, oz, dir, 44, 6.4, 1.7, 460, { name: 'Breach', kb: { dir: dir + PI / 2 * (rnd() < 0.5 ? 1 : -1), dist: 5 }, quiet: true, onFire: () => { S.breach = { x: ox, z: oz, dir, t: 0 }; Sound.sfx('roar', 1, 1.2); Sound.sfx('bigboom', 0.8); FX.shake(0.9); for (let i = 0; i < 6; i++) FX.explode(ox + Math.sin(dir) * (8 + i * 6), 0.5, oz + Math.cos(dir) * (8 + i * 6), 0x8fd8e8, 3.5, 0xffffff); } });
    yield 1.7; yield 1.3;
    let na; do { na = rnd(TAU); } while (Math.abs(angDiff(na, S.ang)) < 1.3); place(b, na); S.breach = null; S.subT = 0; b.targetable = true; b.autoFace = true; S.headTgt.set(0, 6.2, 4.2);
    FX.explode(b.pos.x, 0, b.pos.z, 0x8fd8e8, 6, 0xffffff); Sound.sfx('roar', 0.8); yield 1.6;
  }
  function* smashPillar(b) {
    const S = b.state, p = G.player; let q = null, bd = -1; for (const c of S.pil) if (c.alive) { const d = Math.hypot(c.x - p.pos.x, c.z - p.pos.z); if (d > bd) { bd = d; q = c; } } if (!q) return;
    Hz.circle(q.x, q.z, 4.6, 2.3, 520, { name: 'Tail', tag: 'fight', kb: { dist: 6 }, onFire: () => { q.alive = false; q.mesh.visible = false; FX.explode(q.x, 2, q.z, 0x9ab0b8, 7, 0xffffff); FX.burst(q.x, 3, q.z, { n: 40, smoke: true, color: 0x39434a, color2: 0x14181a, speed: [3, 12], grav: 14, life: [0.8, 1.8], size: [0.5, 1.4] }); Sound.sfx('bigboom'); FX.shake(1.1); } });
    const T = S.tail, a = angTo(0, 0, q.x, q.z); T.visible = true; T.position.set(Math.sin(a) * 19, -6, Math.cos(a) * 19); T.rotation.set(0, a, 0);
    yield* W.tween(1.9, (k) => { T.position.y = -6 + k * 12; T.rotation.x = -0.25 * k; });
    yield* W.tween(0.38, (k) => { T.rotation.x = -0.25 - k * 1.5; T.position.y = 6 - k * 5; }); yield 0.8;
    yield* W.tween(1.2, (k) => { T.position.y = 1 - k * 16; }); T.visible = false;
  }
  function* storm(b, lvl) {
    const S = b.state, U = S.sky.material.uniforms, WU = S.water.material.uniforms; S.storm = lvl;
    const a0 = WU.uAmp.value, a1 = [1.15, 1.7, 2.2][lvl], c0 = U.uCloud.value, c1 = [0.85, 0.95, 0.6][lvl], g0 = WU.uGlow.value.clone(), g1 = new THREE.Color([0x000000, 0x021a1c, 0x06404a][lvl]);
    const r0 = S.rune.emissiveIntensity, r1 = [0.9, 2.0, 4.0][lvl];
    yield* W.tween(3, (k) => { WU.uAmp.value = lerp(a0, a1, k); U.uCloud.value = lerp(c0, c1, k); W.colorLerp(WU.uGlow.value, g0, g1, k); S.rune.emissiveIntensity = lerp(r0, r1, k); S.rain.material.uniforms.uAlpha.value = 0.5 + lvl * 0.2; if (lvl === 2) { U.uSunSize.value = 0.22 * k; U.uSunGlow.value = 0.9 * k; S.sun.intensity = 1.3 + 1.6 * k; S.lum.emissiveIntensity = 2.2 + 3 * k; } });
  }

  G.bosses.push({
    id: 'leviathan', name: 'THALASSOR', title: 'The Storm Tide', hint: 'A drowning', color: '#35e0d0', telegraph: 0x40d8e8,
    hp: 24000, radius: 3.3, aimY: 5, enrage: 420,
    post: { bloom: 0.6, threshold: 0.85, radius: 0.7, exposure: 1.25, vig: 0.95, sat: 0.95, tint: [0.92, 1.0, 1.06], contrast: 1.06 },
    music: { bpm: 104, root: 40, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 3, 0, 0, 6, 4],
      layers: [
        { v: 'sub', pat: '0.......0.......', oct: -1, len: 8, vol: 0.22 }, { v: 'pad', pat: '0...............', oct: 1, len: 16, vol: 0.12 },
        { v: 'taiko', pat: 'x.....x...x.....', vol: 0.3 },
        { v: 'bass', from: 1, pat: '0.0.0.0.0.0.0.2.', oct: 0, len: 2, vol: 0.13 }, { v: 'taiko', from: 1, pat: '..x...x...x.x.x.', vol: 0.22 },
        { v: 'brass', from: 1, pat: ['0.......4.......', '2.......1.......'], oct: 1, len: 8, vol: 0.11 },
        { v: 'arp', from: 2, pat: '0247024702470247', oct: 2, len: 1, vol: 0.06 }, { v: 'snare', from: 2, pat: '....x.......x...', vol: 0.2 }, { v: 'hat', from: 2, pat: 'x.x.x.x.x.x.x.x.', vol: 0.1 },
        { v: 'brass', from: 2, pat: ['7.....6.4.......', '4.....2.0.......'], oct: 2, len: 4, vol: 0.09 },
      ] },
    build,
    *intro(b) { const S = b.state; S.subT = 1; S.sub = 1; yield* Cam.shot([14, 2.5, 20], [0, 3, -6], [6, 5, 16], [0, 5, -14], 2.2, 52); S.subT = 0; Sound.sfx('roar'); FX.explode(0, 0, -16.6, 0x8fd8e8, 7, 0xffffff); yield* Cam.shot([6, 5, 16], [0, 5, -14], [-5, 3.2, 6], [0, 7, -15], 2.8, 52); },
    phases: [
      { at: 1, *run(b) {
        b.autoFace = true; b.turnRate = 3.5; yield 1.5;
        while (true) {
          yield* tidal(b, { time: 3.2 }); yield* bite(b); yield* lightning(b, 3); yield* deluge(b, 5); yield* bite(b); yield* lightning(b, 3);
        }
      } },
      { at: 0.67, *enter(b) { Sound.sfx('roar'); FX.shake(0.7); Co.start(storm(b, 1), 'fight'); Co.start(Post.lerpTo({ bloom: 0.75, contrast: 1.12 }, 3), 'fight'); yield* smashPillar(b); },
        *run(b) {
          while (true) {
            whirlpool(b); yield 1.5; yield* tidal(b, { time: 2.9, speed: 16 }); yield* bite(b);
            yield* breach(b); yield* lightning(b, 4, true); yield* deluge(b, 6);
            whirlpool(b); yield* bite(b); yield* tidal(b, { time: 2.9, speed: 16 }); yield* lightning(b, 3, true); yield* breach(b);
          }
        } },
      { at: 0.34, *enter(b) {
        const S = b.state; Sound.sfx('roar', 1, 0.8); FX.shake(1); FX.flash(TEAL, 0.4, 1.2); Co.start(storm(b, 2), 'fight'); Co.start(Post.lerpTo({ bloom: 0.95, tint: [0.88, 1.04, 1.1], exposure: 1.12 }, 3), 'fight');
        yield* smashPillar(b); S.ringUp = 1;
        Hz.zone({ type: 'donut', x: 0, z: 0, r0: 12.6, r1: 16.4 }, 99999, 130, { name: 'Coil', tag: 'fight', color: TEAL, delay: 2.5, every: 0.6 }); yield 2.2;
      }, *run(b) {
        while (true) {
          yield* tidal(b, { time: 2.7, speed: 17, second: true }); yield* bite(b);
          whirlpool(b, 11); yield* lightning(b, 4, true); yield* deluge(b, 6);
          yield* breach(b); yield* tidal(b, { time: 2.7, speed: 17, second: true }); yield* bite(b); yield* lightning(b, 3, true);
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      // waves
      for (let i = S.waves.length - 1; i >= 0; i--) {
        const w = S.waves[i], ps = w.s; w.s += w.speed * dt;
        const pa = along(p.pos.x, p.pos.z, w.dir);
        if (!w.hit && p.alive && ps <= pa && w.s > pa && Math.hypot(p.pos.x, p.pos.z) < R + 1) { w.hit = true; if (!sheltered(S, p.pos.x, p.pos.z, w.dir)) { p.hurt(w.dmg, { blockable: true, kb: { dir: w.dir, dist: 13 }, src: { name: 'Tidal Wave' } }); FX.burst(p.pos.x, 1, p.pos.z, { n: 50, color: 0xcfeff8, speed: [3, 12], life: [0.4, 1], up: 3 }); } else FX.num(p.aim(), 'SHELTERED', 'note'); }
        const m = w.mesh; m.position.set(Math.sin(w.dir) * w.s, SEA_Y + 1.2, Math.cos(w.dir) * w.s); m.material.uniforms.uT.value = t; m.material.uniforms.uH.value = smooth((w.s + 40) / 14) * (1 - smooth((w.s - 20) / 16)) * (1 + S.storm * 0.12);
        if (!G.headless && Math.abs(w.s) < R + 2) for (let k = 0; k < 3; k++) { const l = (vrand() - 0.5) * 34; FX.burst(Math.sin(w.dir) * w.s + Math.cos(w.dir) * l, 0.4 + vrand() * 4, Math.cos(w.dir) * w.s - Math.sin(w.dir) * l, { n: 1, color: 0xdff4fa, dir: [Math.sin(w.dir), 0.5, Math.cos(w.dir)], spread: 0.5, speed: [4, 14], grav: 12, life: [0.4, 0.9], size: [0.2, 0.6] }); }
        if (w.s > 38) { m.visible = false; S.waves.splice(i, 1); }
      }
      // whirlpool pull
      for (let i = S.pulls.length - 1; i >= 0; i--) { const q = S.pulls[i]; q.t -= dt; q.arm -= dt; if (q.t <= 0 || G.state !== 'fight') { S.pulls.splice(i, 1); continue; } if (q.arm > 0) continue; const dx = q.x - p.pos.x, dz = q.z - p.pos.z, d = Math.hypot(dx, dz); if (d > 0.3 && d < 15 && p.grounded) { const f = 2.7; p.push.x += dx / d * f; p.push.z += dz / d * f; } if (!G.headless && vrand() < dt * 50) { const a = vrand() * TAU, r = 2 + vrand() * 8; FX.burst(q.x + Math.sin(a) * r, 0.15, q.z + Math.cos(a) * r, { n: 1, color: 0x8fe0f0, dir: [Math.sin(a + 2.2), 0.05, Math.cos(a + 2.2)], spread: 0.1, speed: [5, 9], life: [0.4, 0.8], size: [0.12, 0.3] }); } }
      // submerge
      S.sub = damp(S.sub, S.subT, 3.5, dt);
      if (G.headless) return;
      // ambient lightning
      S.boltT -= dt; if (S.boltT <= 0) { S.boltT = [rnd2(5, 10), rnd2(3, 6), rnd2(1.5, 3.5)][S.storm]; S.flash = 1; if (vrand() < 0.6) { const a = vrand() * TAU, d = 60 + vrand() * 120; FX.lightning(new V3(Math.sin(a) * d, 110, Math.cos(a) * d), new V3(Math.sin(a) * d + (vrand() - 0.5) * 30, SEA_Y, Math.cos(a) * d), { color: 0xdff0ff, width: 0.9, jag: 9, dur: 0.35, sparks: false }); } Sound.sfx('thunder', 0.35 + vrand() * 0.3, 0.8); }
      S.flash = Math.max(0, S.flash - dt * 4) * (vrand() > 0.2 ? 1 : 0.5); S.sky.material.uniforms.uFlash.value = S.flash; S.flashL.intensity = S.flash * 5;
      S.beam.rotation.y = t * 0.5;
      // neck: bezier from the sea to the head, in boss-local space
      const f = b.facing, sf = Math.sin(f), cf = Math.cos(f);
      S.lunge = Math.max(0, S.lunge - dt * 3); S.jaw.rotation.x = damp(S.jaw.rotation.x, 0.08 + S.jawOpen * 0.75 + Math.sin(t * 1.3) * 0.03, 8, dt);
      const sway = Math.sin(t * 0.9) * 1.1, bob = Math.sin(t * 1.4) * 0.4;
      S.headPos.x = damp(S.headPos.x, S.headTgt.x + sway, 4, dt); S.headPos.y = damp(S.headPos.y, S.headTgt.y + bob, 5, dt); S.headPos.z = damp(S.headPos.z, S.headTgt.z, 6, dt);
      const subY = -S.sub * 16;
      const toW = (lx, ly, lz, out) => out.set(b.pos.x + sf * lz + cf * lx, ly + subY, b.pos.z + cf * lz - sf * lx);
      const P0 = toW(0, -7, -2.5, _a), P1 = toW(sway * -1.5, 9.5 + S.headPos.y * 0.35, -3.5, _b), P2 = toW(S.headPos.x, S.headPos.y, S.headPos.z, _c);
      if (S.breach) {
        const br = S.breach; br.t += dt; const k = br.t / 0.9;
        for (let i = 0; i <= S.segs.length; i++) { const u = k * 60 - i * 2.4 - 6, o = i === 0 ? S.head : S.segs[i - 1]; const y = Math.sin(clamp(u / 44, 0, 1) * PI) * 7 - 2; o.position.set(br.x + Math.sin(br.dir) * u, y, br.z + Math.cos(br.dir) * u); const u2 = u + 1, y2 = Math.sin(clamp(u2 / 44, 0, 1) * PI) * 7 - 2; _d.set(br.x + Math.sin(br.dir) * u2, y2, br.z + Math.cos(br.dir) * u2); o.lookAt(_d); }
      } else {
        const n = S.segs.length;
        for (let i = 0; i < n; i++) { const u = (i + 0.5) / (n + 0.8), v = 1 - u, o = S.segs[i]; o.position.set(v * v * P0.x + 2 * v * u * P1.x + u * u * P2.x, v * v * P0.y + 2 * v * u * P1.y + u * u * P2.y, v * v * P0.z + 2 * v * u * P1.z + u * u * P2.z); const u2 = u + 0.03, v2 = 1 - u2; _d.set(v2 * v2 * P0.x + 2 * v2 * u2 * P1.x + u2 * u2 * P2.x, v2 * v2 * P0.y + 2 * v2 * u2 * P1.y + u2 * u2 * P2.y, v2 * v2 * P0.z + 2 * v2 * u2 * P1.z + u2 * u2 * P2.z); o.lookAt(_d); o.rotation.z += Math.sin(t * 1.2 + i * 0.5) * 0.12; }
        S.head.position.copy(P2); const look = toW(S.headPos.x * 0.5, Math.max(0.5, S.headPos.y - 3.2 - S.jawOpen * 0.5), S.headPos.z + 8, _d); S.head.lookAt(look);
      }
      S.headL.intensity = 30 + S.jawOpen * 60 + S.storm * 20;
      S.lum.emissiveIntensity = (S.storm === 2 ? 5 : 2.2) + Math.sin(t * 2.2) * 0.6;
      // P3 coil around the platform
      S.ring.position.y = damp(S.ring.position.y, S.ringUp ? 0 : -9, 0.8, dt);
      if (S.ringUp || S.ring.position.y > -8.5) S.ringSegs.forEach((s, i) => { const a = i / 34 * TAU + t * 0.22, r = 18.2 + Math.sin(a * 3 + t) * 0.6; s.position.set(Math.sin(a) * r, Math.sin(a * 4 - t * 1.6) * 1.3 - 0.4, Math.cos(a) * r); s.rotation.set(Math.cos(a * 4 - t * 1.6) * 0.35, a + PI / 2, 0); });
    },
    danger(b, x, z) {
      const S = b.state; let best = Infinity;
      for (const w of S.waves) { if (w.hit) continue; const tt = (along(x, z, w.dir) - w.s) / w.speed; if (tt > -0.05 && !sheltered(S, x, z, w.dir)) best = Math.min(best, Math.max(0, tt)); }
      for (const q of S.pulls) if (Math.hypot(x - q.x, z - q.z) < 5) best = Math.min(best, Math.max(0, q.arm));
      if (S.pend && !sheltered(S, x, z, S.pend.dir)) best = Math.min(best, S.pend.t + (along(x, z, S.pend.dir) + 40) / S.pend.speed);
      return best;
    },
    bot(b, p) {
      const S = b.state, w = S.waves.find((q) => !q.hit) || S.pend; if (!w) return {};
      let q = null, bd = 1e9; for (const c of S.pil) if (c.alive) { const sx = c.x + Math.sin(w.dir) * 3.2, sz = c.z + Math.cos(w.dir) * 3.2, d = Math.hypot(sx - p.pos.x, sz - p.pos.z) + (Hz.threat(sx, sz) < 4 ? 30 : 0); if (d < bd) { bd = d; q = { x: sx, z: sz }; } }
      return q ? { x: q.x, z: q.z, w: 6 } : {};
    },
  });
  const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), rnd2 = (a, b) => a + vrand() * (b - a);
})();
