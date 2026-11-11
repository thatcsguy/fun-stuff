// DOOR XV: ANZU, the Storm Roc. The whole fight is a fall through the sky; what rises from below is the danger, the ground is the clock.
(() => {
  const R = 17, GOLD = 0xffd070, STORM = 0x9fc8ff, LIFT = 5, RISE = 42;
  const _a = new V3(), _b = new V3(), _m = new THREE.Object3D(), _c = new THREE.Color();
  const HOLE_D = [5.5, 9.5, 12.5];
  const holeAt = (d, a) => [-d * Math.sin(a), -d * Math.cos(a)];
  const LOOKS = [
    { top: 0x2a62b0, hor: 0xeec490, bot: 0x4a78b0, fog: 0xa8c0dc, dens: 0.00028, hemi: 0.8, sun: 2.2, cloud: 0xfff2dc, cop: 0.32, streak: 0xffffff },
    { top: 0x05070c, hor: 0x161a26, bot: 0x0a0c12, fog: 0x141822, dens: 0.021, hemi: 0.5, sun: 0.25, cloud: 0x3a4254, cop: 0.55, streak: 0xa8c0e8 },
    { top: 0x20262e, hor: 0x56606a, bot: 0x2a3640, fog: 0x4a5560, dens: 0.0016, hemi: 0.75, sun: 0.7, cloud: 0x6a7480, cop: 0.3, streak: 0xb8d0e8 },
  ];

  function build(b) {
    const g = G.world, S = b.state, L0 = LOOKS[0];
    const sky = W.sky({ top: L0.top, horizon: L0.hor, bottom: L0.bot, stars: 0, sunDir: [0.5, 0.45, -0.7], sunColor: 0xfff0d0, sunSize: 0.035, sunGlow: 1.1, clouds: 0.35, cloudColor: 0xffffff, cloudDark: 0xb09a88, cloudSpeed: 0.02 });
    g.add(sky); S.sky = sky; W.env(sky, 0.9);
    scene.fog = new THREE.FogExp2(L0.fog, L0.dens); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0xcfe0ff, 0x8a7a60, L0.hemi);
    S.sun = W.sun(g, { dir: [0.5, 0.8, -0.3], color: 0xfff0d8, intensity: L0.sun, size: 30 });

    // the play plane: a faint disc and the wall of the vortex
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.07, depthWrite: false, fog: false })); disc.rotation.x = -PI / 2; disc.position.y = -0.02; g.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 5, 96), W.glow(0xdcecff, 1.4)); rim.rotation.x = PI / 2; g.add(rim);
    S.wallM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0xffffff) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv;
        float h(float n){ return fract(sin(n*12.9898)*43758.5453); }
        void main(){ float col=floor(vUv.x*220.0), s=h(col), f=fract(vUv.y*(1.5+s*2.0)-uTime*(0.9+s*1.6)+s*7.0);
          float a=smoothstep(0.0,0.5,f)*smoothstep(1.0,0.5,f)*step(0.55,s); float edge=smoothstep(0.0,0.2,vUv.y)*smoothstep(1.0,0.8,vUv.y);
          float mid=1.0-smoothstep(0.0,0.1,abs(vUv.y-0.5)); gl_FragColor=vec4(uCol*(a*0.12*edge+mid*0.05),1.0); }` });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.4, 90, 96, 1, true), S.wallM); wall.renderOrder = 4; g.add(wall);
    S.streaks = W.motes({ n: 520, box: [70, 70, 70], color: 0xffffff, size: 0.3, vel: [0, 48, 0], sway: 0.2, center: [0, 0, 0], streak: true, alpha: 0.22 }); g.add(S.streaks);

    // soft clouds pouring upward
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const puffT = new THREE.CanvasTexture(cv); S.puffM = new THREE.MeshBasicMaterial({ map: puffT, transparent: true, depthWrite: false, opacity: L0.cop, color: L0.cloud });
    const vr = mulberry(77); S.NC = Math.round(200 * Math.max(0.5, G.q.part)); S.puffI = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), S.puffM, S.NC); S.puffI.frustumCulled = false; S.puffI.renderOrder = 3; g.add(S.puffI);
    S.puffs = Array.from({ length: S.NC }, () => ({ a: vr() * TAU, d: 52 + vr() * vr() * 170, y: vr() * 320 - 160, v: 38 + vr() * 26, s: 12 + vr() * 26 }));

    // cloud deck: the top of the storm below (act 1), the ceiling above (act 3)
    S.deckM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(0xf4dcc0) }, uDark: { value: new THREE.Color(0x8a7888) }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uTime,uA; uniform vec3 uCol,uDark; varying vec2 vP;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){ vec2 q=vP*0.006+uTime*0.01; float v=n(q)*0.5+n(q*2.3+4.0)*0.3+n(q*5.1+9.0)*0.2; float e=1.0-smoothstep(500.0,1100.0,length(vP));
          float a=smoothstep(0.25,0.62,v)*e*uA; gl_FragColor=vec4(mix(uDark,uCol,smoothstep(0.3,0.8,v)),a); }` });
    S.deck = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), S.deckM); S.deck.rotation.x = -PI / 2; S.deck.position.y = -260; S.deck.renderOrder = 2; g.add(S.deck);

    // the ground: a coast of islands, far below, and the rocks that stand in its sea
    const tc = document.createElement('canvas'); tc.width = tc.height = 1024; const tx = tc.getContext('2d'); tx.fillStyle = '#1c4c6c'; tx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 260; i++) { tx.fillStyle = `rgba(${40 + vr() * 30 | 0},${100 + vr() * 40 | 0},${130 + vr() * 40 | 0},0.25)`; tx.beginPath(); tx.ellipse(vr() * 1024, vr() * 1024, 20 + vr() * 90, 6 + vr() * 20, vr() * PI, 0, TAU); tx.fill(); }
    for (let i = 0; i < 46; i++) { const x = vr() * 1024, y = vr() * 1024, r = 8 + vr() * vr() * 90; if (Math.hypot(x - 512, y - 512) < 40) continue; for (const [k, col] of [[1.25, '#7ac0c8'], [1.1, '#d8c890'], [1, '#4a7a3a'], [0.6, '#3a6430'], [0.3, '#6a6a58']]) { tx.fillStyle = col; tx.beginPath(); for (let j = 0; j <= 14; j++) { const a = j / 14 * TAU, rr = r * k * (0.75 + 0.3 * Math.sin(a * 3 + i) + 0.15 * Math.sin(a * 7 + i * 2)); tx[j ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } tx.fill(); } }
    const terT = new THREE.CanvasTexture(tc); terT.colorSpace = THREE.SRGBColorSpace; terT.anisotropy = 4;
    S.ground = new THREE.Group(); S.ground.position.y = -2430; g.add(S.ground);
    S.terM = new THREE.MeshBasicMaterial({ map: terT, color: 0xffffff }); const ter = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), S.terM); ter.rotation.x = -PI / 2; S.ground.add(ter);
    const rockM = W.mat({ color: 0x5a564e, roughness: 0.95 }), NS = 36, spI = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), rockM, NS);
    for (let i = 0; i < NS; i++) { const a = vr() * TAU, d = 30 + vr() * 380, h = 40 + vr() * 150; _m.position.set(Math.sin(a) * d, h / 2, Math.cos(a) * d); _m.scale.set(8 + vr() * 16, h, 8 + vr() * 16); _m.rotation.set((vr() - 0.5) * 0.15, vr() * 6, (vr() - 0.5) * 0.15); _m.updateMatrix(); spI.setMatrixAt(i, _m.matrix); } spI.frustumCulled = false; S.ground.add(spI);

    // slabs that rise from below, each with one hole
    const slabM = W.mat({ color: 0x77706a, roughness: 0.9 }), mossM = W.mat({ color: 0x5c7a48, roughness: 1 });
    S.slabs = HOLE_D.map((d, i) => { const sh = new THREE.Shape(); sh.absarc(0, 0, 27, 0, TAU, false); const ho = new THREE.Path(); ho.absarc(0, d, 3.7, 0, TAU, true); sh.holes.push(ho);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 4, bevelEnabled: false, curveSegments: 40 }); geo.rotateX(-PI / 2); const m = new THREE.Mesh(geo, [mossM, slabM]); m.visible = false; m.frustumCulled = false; g.add(m);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.16, 6, 36), W.glow(GOLD, 2.2)); lip.rotation.x = PI / 2; lip.position.set(0, 4.05, -d); m.add(lip);
      for (let k = 0; k < 9; k++) { const a = vr() * TAU, r = 19 + vr() * 6, rk = new THREE.Mesh(new THREE.ConeGeometry(1.5 + vr() * 2, 5 + vr() * 9, 6), slabM); rk.position.set(Math.sin(a) * r, -2 - vr() * 3, Math.cos(a) * r); rk.rotation.x = PI; m.add(rk); }
      return { m, d, on: false, fire: 0, a0: 0, w: 0 }; });
    // spires (act 3) and thermals
    S.spires = Array.from({ length: 7 }, () => { const m = new THREE.Mesh(new THREE.ConeGeometry(2.6, 34, 7), rockM); m.visible = false; g.add(m); return { m, on: false, fire: 0, x: 0, z: 0 }; });
    S.thermM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uCol: { value: new THREE.Color(GOLD) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv; void main(){ float w=sin(vUv.x*37.7+vUv.y*9.0-uTime*5.0)*0.5+0.5, f=fract(vUv.y*5.0-uTime*1.7+vUv.x*2.0);
        float a=(0.18+0.5*w*w*smoothstep(0.0,0.6,f)*smoothstep(1.0,0.6,f))*smoothstep(0.0,0.3,vUv.y)*smoothstep(1.0,0.45,vUv.y); gl_FragColor=vec4(uCol*a*0.75,1.0); }` });
    S.therm = [0, 1].map((i) => { const grp = new THREE.Group(); g.add(grp); const col = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.2, 44, 28, 1, true), S.thermM); col.position.y = 2; col.renderOrder = 5; grp.add(col);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.09, 5, 40), W.glow(GOLD, 2.4)); ring.rotation.x = PI / 2; ring.position.y = 0.05; grp.add(ring); const ring2 = ring.clone(); ring2.position.y = LIFT; ring2.scale.setScalar(0.8); grp.add(ring2);
      return { grp, a: i * PI + 0.6, r: i ? 9.5 : 7, x: 0, z: 0, k: 1 }; });
    S.charge = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10), W.glow(0xe8f2ff, 4)); S.charge.position.set(0, 24, 0); S.charge.visible = false; g.add(S.charge);
    S.chargeL = new THREE.PointLight(0xcfe0ff, 0, 80, 1.4); S.chargeL.position.set(0, 20, 0); g.add(S.chargeL);
    // the door that falls at the end
    S.door = new THREE.Group(); S.door.visible = false; g.add(S.door); const fr = new THREE.Mesh(new THREE.BoxGeometry(3.2, 6.4, 0.4), W.mat({ color: 0x15161e, roughness: 0.4, metalness: 0.7 })); S.door.add(fr); const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0c0).multiplyScalar(2.2) })); pane.position.z = 0.21; S.door.add(pane);

    // Anzu
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    const fe = W.mat({ color: 0x27304a, roughness: 0.7 }), fe2 = W.mat({ color: 0x566890, roughness: 0.6, side: THREE.DoubleSide }), goldM = W.mat({ color: 0xe0b050, roughness: 0.35, metalness: 0.8 }), trim = W.glow(STORM, 2.6);
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), fe); body.scale.set(1.5, 1.25, 2.6); body.position.y = 2; S.rig.add(body);
    const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), fe2); chest.scale.set(1.2, 0.9, 1.5); chest.position.set(0, 1.55, 0.9); S.rig.add(chest);
    S.neck = new THREE.Group(); S.neck.position.set(0, 2.5, 2.1); S.rig.add(S.neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), fe); head.scale.set(1, 1, 1.25); head.position.set(0, 0.5, 0.7); S.neck.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.7, 6), goldM); beak.rotation.x = PI / 2 + 0.25; beak.position.set(0, 0.3, 2.0); S.neck.add(beak);
    for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), W.glow(0xfff8d0, 4)); eye.position.set(sx * 0.6, 0.7, 1.25); S.neck.add(eye); const cr = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.6, 5), trim); cr.position.set(sx * 0.3, 1.4, 0.1); cr.rotation.x = -0.7; S.neck.add(cr); }
    const featherG = new THREE.PlaneGeometry(1, 1); featherG.translate(0.5, 0, 0);
    S.wings = [-1, 1].map((sx) => { const sh = new THREE.Group(); sh.position.set(sx * 1.1, 2.6, 0.5); S.rig.add(sh); const el = new THREE.Group(); el.position.x = sx * 4.6; sh.add(el);
      const mk = (par, len, n, z0) => { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.22, len, 7), fe); arm.rotation.z = PI / 2; arm.position.x = sx * len / 2; par.add(arm);
        for (let i = 0; i < n; i++) { const f = new THREE.Mesh(featherG, i % 2 ? fe2 : fe); const L = 3.4 + (par === el ? i * 0.5 : 0.6 - i * 0.02); f.scale.set(L, 1.25, 1); f.rotation.set(-PI / 2, 0, 0); f.rotation.z = -PI / 2 + sx * (par === el ? i * 0.16 : 0.05); f.rotation.order = 'YXZ'; f.position.set(sx * (0.5 + i * (len / n)), -0.05 - i * 0.01, z0); par.add(f);
          if (i % 3 === 0) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, L * 0.9), trim); t.position.set(sx * (0.5 + i * (len / n)), 0.03, z0 - L * 0.5); par.add(t); } } };
      mk(sh, 4.6, 7, -0.2); mk(el, 4.8, 7, -0.2); return { sh, el, sx }; });
    S.tail = new THREE.Group(); S.tail.position.set(0, 2, -2.4); S.rig.add(S.tail); for (let i = -2; i <= 2; i++) { const f = new THREE.Mesh(featherG, i % 2 ? fe : fe2); f.scale.set(4.2 - Math.abs(i) * 0.4, 1.1, 1); f.rotation.order = 'YXZ'; f.rotation.set(-PI / 2, PI / 2 + i * 0.2, 0); S.tail.add(f); }
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.6, 6), goldM); leg.position.set(sx * 0.7, 0.8, -0.2); leg.rotation.x = PI + 0.5; S.rig.add(leg); }
    S.rig.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    S.aura = new THREE.PointLight(STORM, 30, 26, 1.6); S.aura.position.set(0, 3.5, 0); bg.add(S.aura);

    Object.assign(S, { lvl: 0, lookN: 0, lookK: 1, lift: 0, alt: 0, altT: 0, shut: 0, flap: 0, flapAmp: 1, thunder: 0, shear: 0, deckV: 0, landed: false, flashT: 3, holes: [], tilt: 0 });
    return {
      edge: 'wall', spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: -7, face: 0 }, camDist: 19, camPitch: 0.78,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 3,
      clamp(p) { const d = Math.hypot(p.x, p.z); if (d > R - 0.5) { p.x *= (R - 0.5) / d; p.z *= (R - 0.5) / d; } },
      camLimit(x, y, z) { return { x, y: Math.max(y, 1.2), z }; },
    };
  }

  // ---------- things from below ----------
  function sendSlab(b, i, a0, T, w = 0) {
    const S = b.state, sl = S.slabs[i]; sl.on = true; sl.fire = G.now + T; sl.a0 = a0; sl.w = w; sl.m.visible = true; sl.hit = false;
    const [x, z] = holeAt(sl.d, a0);
    Hz.circle(x, z, 3.2, T, 450, { name: 'Skyfall', color: GOLD, invert: true, blockable: false, lock: 0.02, tag: 'fight', quiet: i > 0 && false,
      track(s) { const q = holeAt(sl.d, sl.a0 + sl.w * Math.min(0, G.now - sl.fire)); s.x = q[0]; s.z = q[1]; }, onFire() { Sound.sfx('boom', 1, 0.5); FX.shake(0.9); } });
    Sound.sfx('charge', 0.6, 0.5);
  }
  function* slab(b, o = {}) {
    const S = b.state, p = G.player, n = o.n || 1, T = o.T || 3.5; let last = null;
    const order = shuffle([0, 1, 2]);
    for (let k = 0; k < n; k++) { const i = order[k]; let a = rnd(TAU);
      for (let t = 0; t < 30; t++) { a = rnd(TAU); const q = holeAt(S.slabs[i].d, a), dp = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z); if (last) { const dl = Math.hypot(q[0] - last[0], q[1] - last[1]); if (dl > 7 && dl < 10.5) break; } else if (dp > 6 && dp < 15) break; }
      last = holeAt(S.slabs[i].d, a); sendSlab(b, i, a, T + k * (o.gap || 1.6), o.spin ? pick([-1, 1]) * o.spin : 0); }
    yield 0;
  }
  function* waitSlabs(b, extra = 0.3) { const S = b.state; while (S.slabs.some((s) => s.on && G.now < s.fire + extra)) yield; }
  function* flock(b, n = 4) {
    const p = G.player; const r = yield* b.cast({ name: 'Flock', time: 0.7 }); if (r !== 'done') return;
    for (let k = 0; k < n; k++) { const a = rnd(TAU), d = k % 2 ? rnd(3, 9) : 0; let x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; const dd = Math.hypot(x, z); if (dd > R - 2) { x *= (R - 2) / dd; z *= (R - 2) / dd; }
      Hz.circle(x, z, 3.3, 1.3, 250, { name: 'Flock', color: 0xffffff, quiet: k > 0, onFire() { if (!G.headless) { FX.pillar(x, z, { r: 3, h: 22, color: 0xffffff, dur: 0.45 }); FX.burst(x, 1, z, { n: 26, color: 0xffffff, color2: 0xc8d8f0, speed: [4, 12], up: 22, life: [0.4, 0.9], size: [0.25, 0.6] }); } Sound.sfx('dash', 0.6, 1.6); } }); yield 0.45; }
    yield 0.9;
  }
  function* hail(b, waves = 2) {
    const r = yield* b.cast({ name: 'Hail', time: 0.7 }); if (r !== 'done') return;
    for (let w = 0; w < waves; w++) { const dir = rnd(PI), off = rnd(-4, 4), sx = Math.sin(dir), sz = Math.cos(dir);
      for (const o of [-16, -8, 0, 8, 16]) { const cx = (o + off) * sz, cz = -(o + off) * sx; Hz.rect(cx - sx * 22, cz - sz * 22, dir, 44, 4.4, 1.4, 260, { name: 'Hail', color: 0xd8ecff, quiet: o !== 0, onFire() { if (!G.headless) for (let k = -3; k <= 3; k++) FX.burst(cx + sx * k * 5, 0.5, cz + sz * k * 5, { n: 10, color: 0xe8f4ff, speed: [2, 8], up: 18, life: [0.25, 0.6], size: [0.2, 0.45] }); Sound.sfx('shatter', 0.5, 1.5); } }); }
      yield 1.9; }
  }
  function* spires(b, n = 5) {
    const S = b.state, p = G.player; const r = yield* b.cast({ name: 'Spires', time: 0.6 }); if (r !== 'done') return;
    for (let k = 0; k < n; k++) { const sp = S.spires.find((q) => !q.on); if (!sp) break; const a = rnd(TAU), d = k % 2 ? rnd(4, 10) : rnd(0, 1.5); let x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; const dd = Math.hypot(x, z); if (dd > R - 2) { x *= (R - 2) / dd; z *= (R - 2) / dd; }
      sp.on = true; sp.fire = G.now + 1.25; sp.x = x; sp.z = z; sp.m.visible = true; sp.m.rotation.y = rnd(TAU);
      Hz.circle(x, z, 3.0, 1.25, 280, { name: 'Spire', color: 0xc8b8a0, quiet: k > 0, onFire() { Sound.sfx('boom', 0.6, 1.3); FX.shake(0.3); } }); yield 0.4; }
    yield 0.9;
  }

  // ---------- Anzu's kit ----------
  function* wingbeat(b) {
    const S = b.state, p = G.player; S.flapAmp = 2.2; const r = yield* b.cast({ name: 'Wingbeat', time: 1.0 }); S.flapAmp = 1; if (r !== 'done') return;
    Sound.sfx('wave', 1, 0.7); FX.shake(0.5); if (!G.headless) FX.ring(b.pos.x, b.pos.z, { r0: 2, r1: 26, color: 0xffffff, dur: 0.5 });
    if (p.alive) { const dir = b.angToPlayer(); const got = p.hurt(60, { kb: { dir, dist: 9 }, src: { name: 'Wingbeat' } }); if (!got && !p.kb) p.kb = { vx: Math.sin(dir) * 9 / 0.38, vz: Math.cos(dir) * 9 / 0.38, t: 0.38 }; }
    yield 0.3;
  }
  function* fan(b, waves = 2) {
    const r = yield* b.cast({ name: 'Featherfall', time: 0.7 }); if (r !== 'done') return;
    for (let w = 0; w < waves; w++) { const p = G.player, sp = Math.max(0.22, 1.7 / Math.max(1, Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z))), dir = b.angToPlayer() + (w % 2 ? sp / 2 : 0); for (let i = -4; i <= 4; i++) Bul.fire({ x: b.pos.x, z: b.pos.z, dir: dir + i * sp, speed: 12.5, r: 0.34, dmg: 95, color: 0xcfe0ff, life: 4 }); Sound.sfx('slash', 0.6, 1.5); yield 0.7; }
    yield 0.3;
  }
  function* dive(b) {
    const S = b.state, p = G.player; b.targetable = false; S.altT = 30; Sound.sfx('dash', 0.8, 0.6);
    const h = Hz.circle(p.pos.x, p.pos.z, 4.3, 1.8, 340, { name: 'Dive', color: STORM, lock: 0.95, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire() { Sound.sfx('boom', 1, 0.7); FX.shake(0.8); } });
    yield 1.6; b.pos.x = h.shape.x; b.pos.z = h.shape.z; S.altT = 0; S.alt = Math.min(S.alt, 26); S.diving = true; yield 0.22; S.alt = 0; S.diving = false;
    if (!G.headless) { FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: 9, color: STORM, dur: 0.4 }); FX.burst(b.pos.x, 1, b.pos.z, { n: 30, color: 0xffffff, speed: [4, 12], life: [0.3, 0.8], size: [0.2, 0.5] }); }
    b.targetable = true; yield 0.8;
  }
  function* strafe(b, n = 1) {
    const S = b.state, p = G.player; b.autoFace = false;
    for (let k = 0; k < n; k++) { const a = angTo(0, 0, p.pos.x, p.pos.z) + PI + rnd(-0.7, 0.7), sx = Math.sin(a) * (R - 1), sz = Math.cos(a) * (R - 1); yield* b.moveTo(sx, sz, 30);
      const dir = angTo(sx, sz, p.pos.x, p.pos.z), len = 2 * R + 2; b.facing = dir;
      Hz.rect(sx, sz, dir, len, 5.6, 1.25, 320, { name: 'Strafe', color: STORM, onFire() { Sound.sfx('dash', 1, 0.5); } }); S.flapAmp = 0.3;
      const r = yield* b.cast({ name: 'Strafe', time: 1.25 }); if (r !== 'done') break;
      const tx = clamp(sx + Math.sin(dir) * len, -99, 99), tz = sz + Math.cos(dir) * len, d = Math.hypot(tx, tz), ex = tx * Math.min(1, (R - 1) / d), ez = tz * Math.min(1, (R - 1) / d);
      for (let t = 0; t < 0.4; t += G.dt) { const q = t / 0.4; b.pos.x = lerp(sx, ex, q); b.pos.z = lerp(sz, ez, q); S.tilt = 0.5; yield; } b.pos.x = ex; b.pos.z = ez; S.tilt = 0; S.flapAmp = 1; yield 0.25; }
    S.flapAmp = 1; b.autoFace = true; yield* b.moveTo(b.pos.x * 0.45, b.pos.z * 0.45, 12); yield 0.3;
  }
  // The Shear: a sheet of lightning across the whole plane. Only being lifted clear of the plane saves you.
  function* shear(b, time = 3.6) {
    const S = b.state, p = G.player; S.shear = 1;
    const h = Hz.circle(0, 0, R + 0.5, time, 0, { name: 'Shear', color: STORM, alpha: 0.22, tag: 'fight' });
    const r = yield* b.cast({ name: 'Shear', time, onTick: (k) => { S.shear = k; } }); S.shear = 0; if (r !== 'done') { Hz.cancel(h); return; }
    Sound.sfx('thunder', 1, 1.2); Sound.sfx('zap', 0.9, 0.6); FX.flash(STORM, 0.35, 2.5); FX.shake(0.7);
    if (!G.headless) for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rnd(0.5); FX.lightning(_a.set(Math.sin(a) * R, 0.4, Math.cos(a) * R), _b.set(-Math.sin(a + 0.4) * R, 0.4, -Math.cos(a + 0.4) * R), { color: STORM, width: 0.3, dur: 0.45 }); }
    if (p.alive && S.lift < 0.5) p.hurt(480, { blockable: false, src: { name: 'Shear' } });
    yield 0.7;
  }
  // Thunderhead: the bolt takes whoever is highest.
  function* thunder(b, time = 2.3) {
    const S = b.state, p = G.player; S.thunder = 0.01; Sound.sfx('charge', 0.8, 1.6);
    const r = yield* b.cast({ name: 'Thunderhead', time, onTick: (k) => { S.thunder = Math.max(0.01, k); } }); S.thunder = 0; if (r !== 'done') return;
    Sound.sfx('thunder', 1, 0.9); FX.flash(0xffffff, 0.4, 3);
    if (p.alive && S.lift > 0.3) { if (!G.headless) FX.lightning(_a.set(p.pos.x, 30, p.pos.z), _b.set(p.pos.x, p.pos.y + 1, p.pos.z), { color: 0xffffff, width: 0.5, dur: 0.5 }); p.hurt(400, { blockable: false, src: { name: 'Thunderhead' } }); }
    else if (b.alive) { if (!G.headless) { FX.lightning(_a.set(b.pos.x, 30, b.pos.z), _b.set(b.pos.x, 3, b.pos.z), { color: 0xffffff, width: 0.6, dur: 0.5 }); FX.burst(b.pos.x, 3, b.pos.z, { n: 30, color: 0xffffff, color2: STORM, speed: [4, 12], life: [0.3, 0.8], size: [0.2, 0.5] }); } b.hp = Math.max(1, b.hp - b.maxHp * 0.012); b.stagger = 2; b.exposed = Math.max(b.exposed, 2.5); Sound.sfx('crit', 0.8); yield 1.6; }
    yield 0.5;
  }
  function* tempest(b) {
    const S = b.state; S.flapAmp = 1.8; const r = yield* b.cast({ name: 'Tempest Call', time: 2.6, interruptible: true }); S.flapAmp = 1;
    if (r === 'done') { S.shut = 10; Sound.sfx('roar', 1, 1.4); FX.flash(0x8090b0, 0.25, 2); }
    yield 0.4;
  }

  function setAct(b, n) { const S = b.state; S.lvl = n; b.targetable = true; b.autoFace = true; S.altT = 0; S.diving = false; S.flapAmp = 1; S.thunder = 0; S.shear = 0; S.tilt = 0; }
  function look(b, n, instant) { const S = b.state; S.lookN = n; if (instant) { S.lookK = 1e3; if (n === 2) { S.deck.position.y = 220; S.deckV = 0; } } }
  function* whiteout(b, n) {
    const S = b.state; Sound.sfx('wave', 1, 0.4); if (n === 1) { S.deckV = 120; yield 0.9; FX.flash(0xffffff, 1, 0.9); look(b, 1); S.lookK = 1e3; yield 0.2; S.deck.visible = false; }
    else { FX.flash(0x8a94a0, 0.9, 0.9); yield 0.25; look(b, 2); S.lookK = 1e3; S.deck.visible = true; S.deck.position.y = 12; S.deckV = 46; Sound.sfx('thunder', 0.8, 0.6); }
  }

  G.bosses.push({
    id: 'fall', name: 'ANZU', title: 'The Storm Roc', hint: "Don't look down", color: '#9fc8ff', telegraph: 0xff8a3a,
    hp: 23000, radius: 2.2, aimY: 2.4, enrage: 330,
    post: { bloom: 0.45, threshold: 0.92, radius: 0.7, exposure: 0.9, vig: 0.95, sat: 1.08, contrast: 1.05, tint: [1.03, 1.0, 0.97] },
    music: { bpm: 150, root: 38, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 0, 5, 3, 0, 6, 4, 4],
      layers: [
        { v: 'pulse', pat: 'x.x.x.x.x.x.x.x.', oct: 0, len: 1, vol: 0.07 }, { v: 'arp', pat: '0247024702470247', oct: 2, len: 1, vol: 0.04 }, { v: 'kick', pat: 'x...x...x...x.x.', vol: 0.2 }, { v: 'hat', pat: '..x...x...x...xx', vol: 0.05 }, { v: 'lead', pat: ['0.....2.4.......', '7.....4.2.......'], oct: 2, len: 5, vol: 0.05 },
        { v: 'choir', from: 1, pat: '0.......3.......', oct: 1, len: 8, vol: 0.07 }, { v: 'taiko', from: 1, pat: 'x..x..x.x..x.xx.', vol: 0.2 }, { v: 'bass', from: 1, pat: '0.0.0.0.0.0.2.0.', oct: -1, len: 1, vol: 0.12 },
        { v: 'brass', from: 2, pat: ['0.......4.......', '6.......2.......'], oct: 0, len: 7, vol: 0.12 }, { v: 'snare', from: 2, pat: '....x.......x..x', vol: 0.1 },
      ] },
    build,
    *intro(b) { Sound.sfx('wave', 0.8, 0.5); yield* Cam.shot([0, 34, 12], [0, 0, 8], [7, 9, 22], [0, 2, -4], 5.0, 56); },
    *death(b) {
      const S = b.state, p = G.player; S.dead = true; Sound.sfx('roar', 1, 0.6); b.aim(_a);
      for (let k = 0; k < 5; k++) { if (!G.headless) FX.burst(_a.x + rnd(-3, 3), _a.y + rnd(-1, 2), _a.z + rnd(-3, 3), { n: 50, color: 0x9ab0d8, color2: 0xffffff, speed: [3, 14], up: 16, life: [0.6, 1.6], size: [0.3, 0.8] }); S.rig.scale.setScalar(1 - (k + 1) * 0.2); Sound.sfx('slash', 0.5, 0.6 + k * 0.2); yield 0.18; }
      S.rig.visible = false; S.door.visible = true; const dx = p.pos.x + 3.2, dz = p.pos.z; S.door.rotation.y = -PI / 2;
      Cam.cine = { pos: new V3(p.pos.x - 6, 4, p.pos.z + 9), look: new V3(p.pos.x + 1.5, 2.5, p.pos.z), fov: 50 };
      for (let t = 0; t < 1.6; t += G.dt) { const q = smooth(t / 1.6); S.door.position.set(dx, lerp(46, 3.2, q), dz); S.door.rotation.x = (1 - q) * 2.4; yield; }
      Sound.sfx('bell', 0.8, 0.8); FX.flash(0xfff0c0, 0.4, 1.5); yield 0.5;
    },
    phases: [
      { at: 1, *run(b) {
        setAct(b, 0); yield 1.2; let n = 0;
        while (true) {
          yield* flock(b, 3 + Math.min(2, n)); yield* fan(b, 2);
          yield* wingbeat(b); yield* slab(b, { T: n ? 3.3 : 3.8 }); yield* fan(b, 1); yield* waitSlabs(b);
          yield* dive(b); yield* shear(b, n ? 3.6 : 4.2); yield* strafe(b, 1); n++;
        }
      } },
      { at: 0.66, skipTo(b) { look(b, 1, true); b.state.deck.visible = false; },
        *enter(b) { const S = b.state; setAct(b, 1); S.flapAmp = 2; yield* b.moveTo(0, 0, 14); yield* b.cast({ name: 'Plunge', time: 1.4, onTick: (k) => FX.shake(k * 0.3) }); yield* whiteout(b, 1); S.flapAmp = 1; Co.start(Post.lerpTo({ bloom: 0.62, exposure: 1.08, sat: 0.95 }, 2), 'fight'); yield 1.0; },
        *run(b) {
          setAct(b, 1); yield 0.5; let n = 0;
          while (true) {
            yield* thunder(b); yield* hail(b, 2);
            yield* wingbeat(b); yield* slab(b, { T: 3.6, spin: 0.38 }); yield* fan(b, 2); yield* waitSlabs(b);
            if (n % 2 === 0) { yield* shear(b, 3.4); yield* thunder(b, 2.0); } else { yield* thunder(b, 2.0); yield* shear(b, 3.4); }
            yield* dive(b); yield* tempest(b); yield* shear(b, 3.4); yield* strafe(b, 1); n++;
          }
        } },
      { at: 0.33, skipTo(b) { look(b, 2, true); },
        *enter(b) { const S = b.state; setAct(b, 2); S.flapAmp = 2; yield* b.moveTo(0, 0, 14); yield* b.cast({ name: 'Cloudbreak', time: 1.4, onTick: (k) => FX.shake(k * 0.3) }); yield* whiteout(b, 2); S.flapAmp = 1; Co.start(Post.lerpTo({ bloom: 0.52, exposure: 1.02, sat: 1.0, tint: [0.97, 1.0, 1.04] }, 2), 'fight'); yield 1.0; },
        *run(b) {
          setAct(b, 2); yield 0.4; let n = 0;
          while (true) {
            yield* slab(b, { n: 3, T: 3.4, gap: 1.7, spin: n % 2 ? 0.3 : 0 }); yield* fan(b, 2); yield* waitSlabs(b);
            yield* spires(b, 5); yield* strafe(b, 2);
            if (n % 2 === 0) { yield* tempest(b); yield* shear(b, 3.2); yield* thunder(b, 1.9); } else { yield* thunder(b, 1.9); yield* wingbeat(b); yield* shear(b, 3.4); }
            yield* dive(b); yield* spires(b, 4); n++;
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight';
      if (p) p.pose = 'fall';
      // look
      const L = LOOKS[S.lookN], k = Math.min(1, S.lookK * dt), U = S.sky.material.uniforms; S.lookK = 1.2;
      U.uTop.value.lerp(_c.setHex(L.top), k); U.uHor.value.lerp(_c.setHex(L.hor), k); U.uBot.value.lerp(_c.setHex(L.bot), k); if (U.uCloud) U.uCloud.value = lerp(U.uCloud.value, S.lookN ? 0 : 0.35, k); if (U.uSunGlow) U.uSunGlow.value = lerp(U.uSunGlow.value, S.lookN ? 0 : 1.1, k);
      S.fog.color.lerp(_c.setHex(L.fog), k); S.fog.density = lerp(S.fog.density, L.dens, k); S.hemi.intensity = lerp(S.hemi.intensity, L.hemi, k); S.sun.intensity = lerp(S.sun.intensity, L.sun, k);
      S.puffM.color.lerp(_c.setHex(L.cloud), k); S.puffM.opacity = lerp(S.puffM.opacity, L.cop, k); S.streaks.material.uniforms.uCol.value.lerp(_c.setHex(L.streak), k); S.wallM.uniforms.uCol.value.lerp(_c.setHex(L.streak), k);
      S.wallM.uniforms.uTime.value = S.thermM.uniforms.uTime.value = S.deckM.uniforms.uTime.value = t;
      // storm flicker inside the cloud
      if (S.lookN === 1 && !G.headless) { S.flashT -= dt; if (S.flashT <= 0) { S.flashT = rnd(1.6, 4.5); S.hemi.intensity = 2.4; FX.flash(0xcfe0ff, 0.1, 5); if (vrand() < 0.5) Sound.sfx('thunder', 0.3, 0.7 + vrand() * 0.5); } }
      // the ground comes up on the clock
      const E = b.def.enrage, ft = fight || G.state === 'win' ? G.ft : 0, f = Math.min(1, ft / E);
      S.ground.position.y = ft > E ? lerp(-30, -1.5, Math.min(1, (ft - E) / 6)) : -30 - 2400 * Math.pow(1 - f, 1.5);
      if (fight && ft > E + 6 && !S.landed && p && p.alive) { S.landed = true; FX.shake(1.5); Sound.sfx('bigboom', 1, 0.4); p.invuln = 0; p.hurt(99999, { blockable: false, src: 'enrage' }); }
      // cloud deck
      if (S.lookN === 0 && S.deckV === 0) S.deck.position.y = lerp(-260, -26, sat((1 - b.hp / b.maxHp) / 0.34)); else if (S.deckV) { S.deck.position.y += S.deckV * dt; if (S.deck.position.y > 220) { S.deck.position.y = 220; S.deckV = 0; } }
      S.deckM.uniforms.uCol.value.lerp(_c.setHex(S.lookN === 2 ? 0x3a424c : 0xf4dcc0), k); S.deckM.uniforms.uDark.value.lerp(_c.setHex(S.lookN === 2 ? 0x1a1e26 : 0x8a7888), k);
      if (!G.headless) { const cq = camera.quaternion; for (let i = 0; i < S.NC; i++) { const c = S.puffs[i]; c.y += c.v * dt; if (c.y > 170) c.y -= 340; _m.position.set(Math.sin(c.a) * c.d, c.y, Math.cos(c.a) * c.d); _m.quaternion.copy(cq); _m.scale.set(c.s, c.s * 1.5, 1); _m.updateMatrix(); S.puffI.setMatrixAt(i, _m.matrix); } S.puffI.instanceMatrix.needsUpdate = true; }
      // slabs and spires
      S.holes.length = 0;
      for (const sl of S.slabs) { if (!sl.on) continue; const dtf = t - sl.fire; sl.m.position.y = dtf * RISE - 4.6; sl.m.rotation.y = sl.a0 + sl.w * Math.min(0, dtf); if (dtf < 0) { const q = holeAt(sl.d, sl.a0); S.holes.push({ x: q[0], z: q[1], t: -dtf }); } if (dtf > 3) { sl.on = false; sl.m.visible = false; } }
      S.holes.sort((x, y) => x.t - y.t);
      for (const sp of S.spires) { if (!sp.on) continue; const dtf = t - sp.fire; sp.m.position.set(sp.x, dtf * 30 - 15, sp.z); if (dtf > 2.2) { sp.on = false; sp.m.visible = false; } }
      // thermals
      if (S.shut > 0) S.shut -= dt; let inT = false;
      for (const T of S.therm) { T.a += dt * 0.1; T.x = Math.sin(T.a) * T.r; T.z = Math.cos(T.a) * T.r; T.k = damp(T.k, S.shut > 0 ? 0 : 1, 5, dt); T.grp.position.set(T.x, 0, T.z); T.grp.scale.set(Math.max(0.01, T.k), 1, Math.max(0.01, T.k)); T.grp.visible = T.k > 0.03; if (p && S.shut <= 0 && Math.hypot(p.pos.x - T.x, p.pos.z - T.z) < 2.7) inT = true; }
      S.lift = damp(S.lift, inT && p.alive ? 1 : 0, inT ? 4.5 : 3, dt);
      if (p && p.alive && p.grounded) p.pos.y = S.lift * LIFT;
      // signals
      S.charge.visible = S.thunder > 0; if (S.thunder > 0) { S.charge.scale.setScalar(0.4 + S.thunder * 1.4 + Math.sin(t * 40) * 0.1); S.chargeL.intensity = 200 + S.thunder * 900 * (0.6 + 0.4 * Math.sin(t * 30)); } else S.chargeL.intensity = 0;
      if (S.shear > 0 && !G.headless && vrand() < dt * (6 + S.shear * 30)) { const a = rnd(TAU), a2 = a + rnd(0.5, 2.5), r1 = rnd(3, R), r2 = rnd(3, R); FX.lightning(_a.set(Math.sin(a) * r1, 0.3, Math.cos(a) * r1), _b.set(Math.sin(a2) * r2, 0.3, Math.cos(a2) * r2), { color: STORM, width: 0.1 + S.shear * 0.1, dur: 0.2 }); }
      // Anzu
      S.alt = damp(S.alt, S.altT, S.diving ? 30 : 3.5, dt); if (S.diving) S.alt = Math.max(0, S.alt - 130 * dt);
      S.flap += dt * (3.2 + S.flapAmp * 1.6); const fl = Math.sin(S.flap) * 0.45 * Math.min(1.6, S.flapAmp + 0.2), gl = S.flapAmp < 0.5 ? 0.15 : 0;
      for (const w of S.wings) { w.sh.rotation.z = w.sx * (fl + gl); w.el.rotation.z = w.sx * (Math.sin(S.flap - 0.8) * 0.5 * Math.min(1.4, S.flapAmp)); }
      S.rig.position.y = S.alt + Math.cos(S.flap) * 0.25 - 0.4; S.rig.rotation.x = damp(S.rig.rotation.x, S.diving ? 1.2 : S.tilt ? 0.35 : b.castState ? -0.12 : 0.05, 8, dt); S.rig.rotation.z = Math.sin(t * 0.9) * 0.05;
      S.neck.rotation.x = Math.sin(t * 1.3) * 0.08 - (b.castState ? 0.25 : 0); S.tail.rotation.x = Math.sin(S.flap - 1.5) * 0.15; S.aura.intensity = 30 + (b.castState ? 40 : 0);
    },
    danger(b, x, z) { const S = b.state; if (S.thunder > 0) for (const T of S.therm) if (Math.hypot(x - T.x, z - T.z) < 3.4) return 0.6; return Infinity; },
    bot(b, p) {
      const S = b.state;
      if (S.holes.length) { const h = S.holes[0]; return { x: h.x, z: h.z, w: 7 }; }
      if (S.shear > 0 && S.shut <= 0) { let best = null, bd = 1e9; for (const T of S.therm) { const d = Math.hypot(T.x - p.pos.x, T.z - p.pos.z); if (d < bd) { bd = d; best = T; } } if (best) return { x: best.x + Math.cos(best.a) * 0.6, z: best.z - Math.sin(best.a) * 0.6, w: 7 }; }
      return {};
    },
  });
})();
