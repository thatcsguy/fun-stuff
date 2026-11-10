// DOOR VI: EURYALE, the Stone Garden. A moonlit terrace full of her victims. The fight is decided by what is on your screen.
(() => {
  const R = 18, VEN = 0x8dff7a, PALE = 0xd8ffd0, PED_R = 16.4, NPED = 10, MIR_R = 16.5;
  const _v = new V3(), _a = new V3(), _b2 = new V3(), _m = new THREE.Object3D();

  // What the player can see. For a human it is the real camera frustum; the autopilot has a virtual gaze (S.botYaw).
  function seen(S, x, y, z) {
    const p = G.player;
    if (G.headless || Bot.level) return Math.hypot(x - p.pos.x, z - p.pos.z) < 1.5 || Math.abs(angDiff(S.botYaw, angTo(p.pos.x, p.pos.z, x, z))) < 0.8;
    if (Cam.cineW > 0.5) return true;
    _v.set(x, y, z).project(camera);
    return _v.z < 1 && Math.abs(_v.x) < 0.97 && Math.abs(_v.y) < 0.97;
  }

  function statueMesh(awake, seed) {
    const g = new THREE.Group(), r = mulberry(seed * 7 + 3), tone = 0.42 + r() * 0.14;
    const m = W.mat({ color: new THREE.Color(tone, tone * 1.03, tone), roughness: 0.92 });
    const add = (geo, x, y, z, rx = 0, rz = 0) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); q.rotation.set(rx, 0, rz); q.castShadow = true; g.add(q); return q; };
    add(new THREE.CylinderGeometry(0.13, 0.11, 0.95, 8), -0.17, 0.48, 0); add(new THREE.CylinderGeometry(0.13, 0.11, 0.95, 8), 0.17, 0.48, 0.12, 0.2);
    add(new THREE.CapsuleGeometry(0.3, 0.55, 4, 10), 0, 1.38, 0.04);
    add(new THREE.CylinderGeometry(0.36, 0.3, 0.3, 10), 0, 0.98, 0.03);
    add(new THREE.SphereGeometry(0.2, 12, 10), 0, 2.05, 0.06);
    add(new THREE.SphereGeometry(0.235, 12, 8, 0, TAU, 0, PI * 0.55), 0, 2.07, 0.05);
    add(new THREE.BoxGeometry(0.05, 0.3, 0.5), 0, 2.33, 0.0);
    // shield arm thrown up in front of the face: the last thing every one of them did
    const pose = r();
    add(new THREE.CylinderGeometry(0.08, 0.07, 0.75, 8), -0.42, 1.55, 0.25, -1.1 - pose * 0.5, 0.3);
    const sh = add(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 18), -0.45, 1.75 + pose * 0.2, 0.55, PI / 2 - 0.3, 0.2); sh.scale.z = 1;
    add(new THREE.CylinderGeometry(0.08, 0.07, 0.8, 8), 0.44, 1.35, 0.12, -0.5, -0.35);
    add(new THREE.CylinderGeometry(0.025, 0.025, 2.9, 6), 0.55, 1.5, 0.3, 0.12, -0.05);
    add(new THREE.ConeGeometry(0.07, 0.3, 6), 0.553, 3.05, 0.48, 0.12, -0.05);
    let eyes = null;
    if (awake) {
      eyes = W.glow(VEN, 4); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.04), eyes); e.position.set(sx * 0.08, 2.07, 0.25); g.add(e); }
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.7, 0.03), eyes); crack.position.set(0.06, 1.4, 0.34); crack.rotation.z = 0.3; g.add(crack);
    }
    return { g, eyes, mat: m };
  }

  function mosaicTex() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), r = mulberry(41);
    x.fillStyle = '#2a302c'; x.fillRect(0, 0, 512, 512); x.translate(256, 256);
    const ring = (r0, r1, n, cols) => { for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; x.globalAlpha = 0.75 + r() * 0.25; x.beginPath(); x.arc(0, 0, r1, i / n * TAU, (i + 1) / n * TAU); x.arc(0, 0, r0, (i + 1) / n * TAU, i / n * TAU, true); x.closePath(); x.fill(); x.globalAlpha = 1; x.strokeStyle = '#16181a'; x.lineWidth = 2; x.stroke(); } };
    ring(228, 250, 64, ['#9aa69a', '#3d5a4c']); ring(196, 226, 40, ['#c8cdbf', '#6b8a78', '#c8cdbf', '#2f4a3e']); ring(150, 194, 28, ['#55735f', '#b9c2b0']);
    ring(104, 148, 18, ['#d5d8c8', '#31503f', '#8aa590']); ring(60, 102, 12, ['#3c5c4a', '#c0c8b6']); ring(0, 58, 9, ['#a8b5a0', '#274536', '#d8dccc']);
    // a ring of open eyes
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; x.save(); x.rotate(a); x.translate(0, -172); x.fillStyle = '#e8ead8'; x.beginPath(); x.ellipse(0, 0, 20, 10, 0, 0, TAU); x.fill(); x.fillStyle = '#1c3a2a'; x.beginPath(); x.arc(0, 0, 8, 0, TAU); x.fill(); x.restore(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function flareTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(200,255,190,0.75)'); g.addColorStop(0.5, 'rgba(90,255,120,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(0, 62, 128, 4); x.fillRect(62, 20, 4, 88);
    return new THREE.CanvasTexture(c);
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x020611, horizon: 0x14303a, bottom: 0x020403, stars: 1.1, nebula: 0.3, nebulaA: 0x0a4a40, nebulaB: 0x1a2a6a, sunDir: [-0.42, 0.5, -0.76], sunColor: 0xe6eeff, sunSize: 0.1, sunGlow: 0.8, clouds: 0.32, cloudColor: 0x5a7080, cloudDark: 0x05090c, cloudSpeed: 0.004 });
    g.add(sky); S.sky = sky; W.env(sky, 0.7);
    scene.fog = new THREE.FogExp2(0x0a1512, 0.014);
    S.hemi = W.hemi(g, 0x52707a, 0x0a0d08, 0.6);
    S.moon = W.sun(g, { dir: [-0.42, 0.62, -0.66], color: 0xb4ccff, intensity: 2.6, size: 30 });
    // terrace
    const fl = W.surface('slabs', { n: 4, dark: 0x3c403c, light: 0xb4b9ae, strength: 2.4, seed: 5 }); for (const k in fl) fl[k].repeat.set(7, 7);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 2.4, 72), new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, roughnessMap: fl.roughnessMap, roughness: 0.7, metalness: 0.05, envMapIntensity: 1.2 }));
    floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    const mos = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64), new THREE.MeshStandardMaterial({ map: mosaicTex(), roughness: 0.35, metalness: 0.1, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    mos.rotation.x = -PI / 2; mos.position.y = 0.012; mos.receiveShadow = true; g.add(mos);
    const band = new THREE.Mesh(new THREE.RingGeometry(R - 0.5, R + 0.1, 96), W.mat({ color: 0x1c2a24, roughness: 0.5, metalness: 0.3 })); band.rotation.x = -PI / 2; band.position.y = 0.015; g.add(band);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(R + 2.4, R + 3.2, 1.4, 72, 1, true), W.mat({ color: 0x4a4e48, roughness: 0.9 })); lip.position.y = -0.7; g.add(lip);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(260, 48), W.mat({ color: 0x07100b, roughness: 1 })); ground.rotation.x = -PI / 2; ground.position.y = -1.3; g.add(ground);
    // colonnade: some standing, most broken
    const st = W.surface('stone', { size: 256, dark: 0x4c504a, light: 0xc4c8bc, seed: 9 }); for (const k in st) st[k].repeat.set(2, 4);
    const marble = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.75, envMapIntensity: 1.1, color: 0xdfe6e0 });
    const cr = mulberry(77); let prevTall = false;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + 0.1, x = Math.sin(a) * 20.6, z = Math.cos(a) * 20.6, tall = cr() < 0.45, h = tall ? 10 : 2 + cr() * 5;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.9, h, 14), marble); col.position.set(x, h / 2 - 0.2, z); col.castShadow = true; g.add(col);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 2.3), marble); base.position.set(x, 0.1, z); base.rotation.y = a; g.add(base);
      if (tall) { const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 2.3), marble); cap.position.set(x, h + 0.05, z); cap.rotation.y = a; g.add(cap);
        if (prevTall) { const a0 = (i - 0.5) / 16 * TAU + 0.1; const lin = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.1, 1.9), marble); lin.position.set(Math.sin(a0) * 20.4, h + 0.9, Math.cos(a0) * 20.4); lin.rotation.y = a0; lin.castShadow = true; g.add(lin); } }
      else { const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.2, 14), marble); drum.position.set(Math.sin(a + 0.09) * 23.2, -0.4, Math.cos(a + 0.09) * 23.2); drum.rotation.set(PI / 2, 0, cr() * 3); g.add(drum); }
      prevTall = tall;
    }
    // pedestals and the statues that stand on them
    S.ped = [];
    for (let i = 0; i < NPED; i++) {
      const a = i / NPED * TAU + 0.31, x = Math.sin(a) * PED_R, z = Math.cos(a) * PED_R;
      const pd = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), marble); pd.position.set(x, 0.25, z); pd.rotation.y = a; pd.castShadow = true; pd.receiveShadow = true; g.add(pd);
      const sm = statueMesh(false, i); sm.g.position.set(x, 0.5, z); sm.g.rotation.y = a + PI + (cr() - 0.5); g.add(sm.g);
      S.ped.push({ a, x, z, mesh: sm.g, has: true, regrow: 0 });
    }
    // the garden of victims, terraced away into the dark
    const NV = 170, vb = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.34, 1.25, 3, 8), W.mat({ color: 0x70766e, roughness: 1 }), NV), vh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.23, 8, 6), vb.material, NV);
    const eyePos = new Float32Array(NV * 3), vr = mulberry(1234);
    for (let i = 0; i < NV; i++) {
      const a = vr() * TAU, rr = 24.5 + Math.pow(vr(), 0.8) * 50, x = Math.sin(a) * rr, z = Math.cos(a) * rr, y = -1.3 + Math.floor((rr - 24) / 9) * 0.5, lean = (vr() - 0.5) * 0.5;
      _m.position.set(x, y + 0.95, z); _m.rotation.set(lean, vr() * TAU, (vr() - 0.5) * 0.3); _m.scale.setScalar(0.9 + vr() * 0.35); _m.updateMatrix(); vb.setMatrixAt(i, _m.matrix);
      _m.position.set(x, y + 2.05 * _m.scale.x, z + lean * 0.8); _m.updateMatrix(); vh.setMatrixAt(i, _m.matrix);
      eyePos[i * 3] = x - Math.sin(a) * 0.25; eyePos[i * 3 + 1] = y + 2.08 * _m.scale.x; eyePos[i * 3 + 2] = z - Math.cos(a) * 0.25;
    }
    g.add(vb); g.add(vh);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(eyePos, 3));
    S.eyesFar = new THREE.Points(eg, new THREE.PointsMaterial({ color: new THREE.Color(VEN).multiplyScalar(2.5), size: 1.1, map: flareTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); S.eyesFar.frustumCulled = false; g.add(S.eyesFar);
    const NC = 46, cyp = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 13, 7), W.mat({ color: 0x050d08, roughness: 1 }), NC);
    for (let i = 0; i < NC; i++) { const a = vr() * TAU, rr = 27 + vr() * 60; _m.position.set(Math.sin(a) * rr, 5 + vr() * 2, Math.cos(a) * rr); _m.rotation.set(0, vr() * 6, 0); _m.scale.set(0.8 + vr() * 0.7, 0.8 + vr() * 0.9, 0.8 + vr() * 0.7); _m.updateMatrix(); cyp.setMatrixAt(i, _m.matrix); }
    g.add(cyp);
    const hedge = new THREE.Mesh(new THREE.CylinderGeometry(23.8, 24.2, 2.6, 48, 1, true), W.mat({ color: 0x06120a, roughness: 1, side: THREE.DoubleSide })); hedge.position.y = 0; g.add(hedge);
    // braziers
    S.fires = [];
    for (const a of [0.94, 2.83, 4.08, 5.97]) {
      const x = Math.sin(a) * 19.2, z = Math.cos(a) * 19.2;
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.35, 0.6, 12), W.mat({ color: 0x3a2c18, metalness: 0.9, roughness: 0.4 })); bowl.position.set(x, 1.6, z); g.add(bowl);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 1.4, 8), bowl.material); leg.position.set(x, 0.7, z); g.add(leg);
      const fm = W.glow(0xffa040, 3); const fl2 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), fm); fl2.position.set(x, 2.0, z); g.add(fl2); S.fires.push({ x, z, m: fl2, mat: fm });
    }
    S.fireL = [new THREE.PointLight(0xff9a40, 90, 30, 1.7), new THREE.PointLight(0xff9a40, 90, 30, 1.7)];
    S.fireL[0].position.set(Math.sin(0.94) * 18.5, 3, Math.cos(0.94) * 18.5); S.fireL[1].position.set(Math.sin(4.08) * 18.5, 3, Math.cos(4.08) * 18.5); g.add(S.fireL[0]); g.add(S.fireL[1]);
    g.add(W.motes({ n: 320, box: [56, 9, 56], color: 0xd8ff80, size: 0.085, vel: [0.04, 0.03, 0.02], sway: 1.4, center: [0, 4.5, 0], mult: 1.3 }));
    // mirrors (bronze shields that carry her stare)
    S.mir = [];
    for (let k = 0; k < 2; k++) {
      const mg = new THREE.Group(); mg.visible = false;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.12, 40), W.mat({ color: 0xd8c8a0, metalness: 1, roughness: 0.06, envMapIntensity: 3 })); disc.rotation.x = PI / 2; mg.add(disc);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.13, 8, 40), W.mat({ color: 0x8a6a2a, metalness: 1, roughness: 0.3 })); mg.add(rim);
      const em = W.glow(VEN, 0.2); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), em); e.scale.set(1.5, 0.6, 0.4); e.position.set(sx * 0.5, 0.25, 0.1); mg.add(e); }
      const fl3 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: flareTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); fl3.position.z = 0.3; mg.add(fl3);
      g.add(mg); S.mir.push({ g: mg, a: 0, on: false, eyes: em, flare: fl3, y: 5.2 });
    }

    // ---- Euryale ----
    const bg = b.group;
    const sc = W.bake(256, (u, v) => { const c = W.cell(u * 9, v * 9, 3, 9), h = 1 - sat(c[0] * 1.5); return [h, h * 0.8 + 0.1, 0.35 + (1 - h) * 0.3]; }, { dark: 0x06261c, light: 0x3f9a6c, strength: 4 }); for (const k in sc) sc[k].repeat.set(2, 1);
    const scales = new THREE.MeshStandardMaterial({ map: sc.map, normalMap: sc.normalMap, roughnessMap: sc.roughnessMap, roughness: 0.5, metalness: 0.55, envMapIntensity: 1.8, emissive: 0x06281a, emissiveIntensity: 0.6 });
    const skin = W.mat({ color: 0x7d9c86, roughness: 0.45, metalness: 0.15 }), gold = W.mat({ color: 0xd2a94e, roughness: 0.25, metalness: 1, envMapIntensity: 2 });
    S.NT = 26; S.tail = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), scales, S.NT); S.tail.castShadow = true; S.tail.frustumCulled = false; bg.add(S.tail);
    S.up = new THREE.Group(); bg.add(S.up);
    const addU = (geo, mat, x, y, z) => { const q = new THREE.Mesh(geo, mat); q.position.set(x, y, z); q.castShadow = true; S.up.add(q); return q; };
    addU(new THREE.CapsuleGeometry(0.62, 1.2, 6, 14), skin, 0, 3.75, 0).scale.set(1, 1, 0.8);
    addU(new THREE.CylinderGeometry(0.72, 0.95, 1.0, 14), scales, 0, 2.75, 0);
    for (const y of [4.72, 4.55]) addU(new THREE.TorusGeometry(0.42 + (4.72 - y) * 1.2, 0.05, 6, 24), gold, 0, y, 0.02).rotation.x = PI / 2;
    addU(new THREE.SphereGeometry(0.3, 10, 8), gold, 0, 4.2, 0.5).scale.set(1.2, 1.4, 0.4);
    addU(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 10), skin, 0, 5.0, 0);
    const hood = addU(new THREE.SphereGeometry(1, 20, 14), scales, 0, 4.9, -0.42); hood.scale.set(1.5, 1.75, 0.2); hood.rotation.x = 0.12;
    for (const sx of [-1, 1]) { const rib = addU(new THREE.TorusGeometry(1.25, 0.05, 6, 20, 1.5), gold, sx * 0.1, 4.75, -0.3); rib.rotation.z = sx > 0 ? -0.4 : PI - 1.1; }
    const plate = addU(new THREE.SphereGeometry(0.66, 16, 12, 0, TAU, 0, PI * 0.5), gold, 0, 3.95, 0.06); plate.scale.set(1.02, 0.9, 0.86);
    S.head = new THREE.Group(); S.head.position.set(0, 5.5, 0.05); S.up.add(S.head);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), skin); face.scale.set(0.85, 1.12, 0.92); face.castShadow = true; S.head.add(face);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 6, 20, PI), gold); brow.position.set(0, 0.2, 0.06); brow.rotation.x = -0.25; S.head.add(brow);
    S.eyeMat = W.glow(VEN, 1.2); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), S.eyeMat); e.scale.set(1.5, 0.55, 0.5); e.position.set(sx * 0.16, 0.05, 0.38); e.rotation.z = sx * 0.2; S.head.add(e); }
    S.flare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: flareTex(), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false })); S.flare.position.set(0, 0.05, 0.6); S.flare.renderOrder = 30; S.head.add(S.flare);
    S.NH = 11; S.HS = 7; S.hair = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), scales, S.NH * S.HS); S.hair.frustumCulled = false; S.hair.castShadow = true; S.head.add(S.hair);
    S.hairDir = []; for (let k = 0; k < S.NH; k++) { const a = (k / (S.NH - 1) - 0.5) * 3.6, e = 0.5 + (k % 3) * 0.32; S.hairDir.push(new V3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e) * 0.9 + 0.1).normalize()); }
    S.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.78, 4.45, 0); S.up.add(sh);
      const pau = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), gold); pau.scale.set(1.1, 0.8, 1.1); sh.add(pau);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 1.3, 8), skin); up.position.y = -0.65; up.castShadow = true; sh.add(up);
      const el = new THREE.Group(); el.position.y = -1.3; sh.add(el);
      const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 1.25, 8), skin); lo.position.y = -0.62; lo.castShadow = true; el.add(lo);
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.35, 10), gold); brace.position.y = -0.9; el.add(brace);
      for (let c = 0; c < 3; c++) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.4, 5), gold); cl.position.set((c - 1) * 0.07, -1.45, 0.02); cl.rotation.x = PI; el.add(cl); }
      S.arms.push({ sh, el, sx });
    }
    S.headL = new THREE.PointLight(VEN, 0, 40, 1.5); S.headL.position.set(0, 5.6, 0.8); S.up.add(S.headL);
    S.gaze = 0; S.stoneT = 0; S.statSpeed = 2.7; S.botYaw = PI; S.nMir = 0; S.rear = 0; S.slashT = 0; S.grind = 0; S.seedN = 20; S.mode = 0;
    return {
      edge: 'wall', spawn: { x: 0, z: 13 }, bossStart: { x: 0, z: -3, face: 0 },
      contains: (x, z) => Math.hypot(x, z) <= R - 0.3,
      clamp(p) { const d = Math.hypot(p.x, p.z), m = R - 0.5; if (d > m) { p.x *= m / d; p.z *= m / d; } },
    };
  }

  // ---- statues ----
  const awake = () => G.ents.filter((e) => e.isAdd && e.alive);
  function wake(b, n = 1) {
    const S = b.state, p = G.player;
    const free = S.ped.filter((q) => q.has).sort((u, w) => dist2(w.x, w.z, p.pos.x, p.pos.z) - dist2(u.x, u.z, p.pos.x, p.pos.z));
    for (let k = 0; k < n && free.length; k++) {
      const q = free.splice(Math.floor(rnd(0, Math.min(free.length, 4))), 1)[0]; q.has = false; q.mesh.visible = false; q.regrow = 26;
      const sm = statueMesh(true, S.seedN++);
      const a = b.spawnAdd({
        name: 'Petrified', hp: 520, x: q.x, z: q.z, radius: 0.8, aimY: 1.5, mesh: sm.g, color: 0xb8c0b4, facing: angTo(q.x, q.z, p.pos.x, p.pos.z),
        update(e, dt) {
          const pl = G.player; if (!pl.alive || G.state !== 'fight') return;
          e.watched = seen(S, e.pos.x, 1.5, e.pos.z);
          const d = Math.hypot(pl.pos.x - e.pos.x, pl.pos.z - e.pos.z);
          e.pos.y = Math.max(0, e.pos.y - dt * 1.5);
          if (e.strike || b.transitioning) return;
          if (d < 2.3) {
            e.strike = true; Sound.sfx('sword', 0.8, 0.5);
            Hz.circle(e.pos.x, e.pos.z, 3.4, 0.85, 340, { name: 'Stone Grasp', color: VEN, tag: 'fight' });
            Co.start(function* () { yield 0.9; if (e.alive) e.die(); }, e.tag);
          } else if (!e.watched) {
            const s = S.statSpeed * dt; e.pos.x += (pl.pos.x - e.pos.x) / d * s; e.pos.z += (pl.pos.z - e.pos.z) / d * s; e.facing = angTo(e.pos.x, e.pos.z, pl.pos.x, pl.pos.z);
            e.step = (e.step || 0) + dt; if (e.step > 0.42) { e.step = 0; Sound.sfx('hit', clamp(1.4 - d / 14, 0.25, 1.1), 0.35); if (!G.headless) FX.burst(e.pos.x, 0.15, e.pos.z, { n: 6, smoke: true, color: 0x8a9088, color2: 0x30342e, speed: [0.4, 1.6], life: [0.5, 1], size: [0.5, 1.1], alpha: 0.4 }); }
          }
          if (e.eyes) e.eyes.color.setHex(VEN).multiplyScalar(e.watched ? 1.2 : 5);
        },
      });
      a.eyes = sm.eyes; a.pos.y = 0.5;
      FX.burst(q.x, 1.5, q.z, { n: 30, color: VEN, speed: [1, 5], life: [0.4, 1], size: [0.15, 0.4] }); FX.ring(q.x, q.z, { r1: 4, color: VEN, dur: 0.6 }); Sound.sfx('shatter', 0.5, 0.5);
    }
  }
  function crumble(e) { if (!e.alive) return; FX.burst(e.pos.x, 1.3, e.pos.z, { n: 40, color: 0xc8d0c4, color2: 0x505850, speed: [2, 9], grav: 14, life: [0.5, 1.2], size: [0.15, 0.45] }); e.die(); }

  // ---- the stare ----
  const headPos = (b, out) => out.set(b.pos.x + Math.sin(b.facing) * 0.4, 5.6, b.pos.z + Math.cos(b.facing) * 0.4);
  const mirPos = (m, out) => out.set(Math.sin(m.a) * MIR_R, m.y, Math.cos(m.a) * MIR_R);
  function sources(b) { const S = b.state, L = [headPos(b, new V3())]; for (const m of S.mir) if (m.on) L.push(mirPos(m, new V3())); return L; }
  function petrify(b) {
    const S = b.state, p = G.player; if (!p.alive) return;
    p.hurt(360, { blockable: false, src: { name: 'Behold' } }); if (!p.alive) return;
    p.rooted = 2.6; p.casting = null; p.addBuff('stone', 2.6, 'aegis'); S.stoneT = 2.6;
    FX.flash(0xd0d8d0, 0.55, 1.4); Sound.sfx('shatter', 0.9, 0.4); FX.burst(p.pos.x, 1, p.pos.z, { n: 30, color: 0xc0c8c0, speed: [1, 4], life: [0.5, 1.2] }); FX.ring(p.pos.x, p.pos.z, { r1: 3, color: 0xc0c8c0, dur: 0.5 });
  }
  function* behold(b, o = {}) {
    const S = b.state, time = o.time || 2.5; S.locked = false;
    Sound.sfx('charge', 1, 0.45); Sound.sfx('bell', 0.5, 2.2);
    if (!G.headless) { const hp = headPos(b, new V3()); for (const m of S.mir) if (m.on) FX.beam(hp, mirPos(m, new V3()), { color: VEN, width: 0.16, dur: 0.4, hold: time }); }
    const resolve = (h) => {
      const hit = sources(b).some((q) => seen(S, q.x, q.y, q.z));
      FX.ring(b.pos.x, b.pos.z, { r1: 30, color: PALE, dur: 0.7, width: 0.2 }); Sound.sfx('laser', 0.8, 0.5); if (!G.headless) { headPos(b, _a); FX.light(_a.x, _a.y, _a.z, VEN, 220, 0.6, 50); for (const m of S.mir) if (m.on) { mirPos(m, _a); FX.burst(_a.x, _a.y, _a.z, { n: 20, color: VEN, speed: [2, 8], life: [0.3, 0.7] }); } }
      for (const e of awake()) if (Hz.inShape(h.shape, e.pos.x, e.pos.z)) crumble(e);
      if (hit) petrify(b); else FX.flash(VEN, 0.12, 4);
    };
    Hz.cone(b.pos.x, b.pos.z, b.angToPlayer(), 1.15, 36, time, 0, { color: PALE, alpha: 0.55, silent: true, track: (s) => { s.x = b.pos.x; s.z = b.pos.z; s.dir = b.angToPlayer(); }, lock: 0.8, onFire: resolve });
    S.mode = 1;
    yield* b.cast({ name: 'Behold', time, onTick: (k, cs) => { S.gaze = k; if (cs.time - cs.t < 1.1) S.locked = true; } });
    yield 0.05; S.gaze = 0; S.mode = 0; S.locked = false;
    if (o.twice) {
      yield 0.55; S.mode = 1; Sound.sfx('charge', 1, 0.6);
      Hz.cone(b.pos.x, b.pos.z, b.angToPlayer(), 1.15, 36, 1.5, 0, { color: PALE, alpha: 0.55, silent: true, track: (s) => { s.dir = b.angToPlayer(); }, lock: 0.7, onFire: resolve });
      yield* b.cast({ name: 'Behold', time: 1.5, onTick: (k, cs) => { S.gaze = k; if (cs.time - cs.t < 0.9) S.locked = true; } }); yield 0.05; S.gaze = 0; S.mode = 0; S.locked = false;
    }
    yield 0.5;
  }

  // ---- everything else ----
  function* slither(b, want = 6.5) {
    const p = G.player, d = b.distToPlayer(); if (d < want + 2.5) return;
    const a = angTo(p.pos.x, p.pos.z, b.pos.x, b.pos.z); let tx = p.pos.x + Math.sin(a) * want, tz = p.pos.z + Math.cos(a) * want; const tr = Math.hypot(tx, tz); if (tr > 11) { tx *= 11 / tr; tz *= 11 / tr; }
    b.autoFace = false; yield* b.moveTo(tx, tz, 7.5); b.autoFace = true;
  }
  function* lash(b) {
    const S = b.state, dir = b.angToPlayer(); b.autoFace = false; S.rear = 1;
    Hz.cone(b.pos.x, b.pos.z, dir, 2.3, 10.5, 1.25, 300, { name: 'Serpent Lash', kb: { dist: 4 }, onFire() { FX.slash(b.pos.x, 0.8, b.pos.z, dir, { r: 10.5, color: VEN, dur: 0.35 }); Sound.sfx('slash', 1, 0.5); FX.shake(0.35); } });
    yield* b.cast({ name: 'Serpent Lash', time: 1.25 }); S.slashT = 0.4; S.rear = 0; yield 0.5; b.autoFace = true;
  }
  function* spit(b, n) {
    yield* b.cast({ name: 'Venom', time: 0.7 });
    for (let i = 0; i < n; i++) {
      const p = G.player, x = p.pos.x + (i ? rnd(-1.5, 1.5) : 0), z = p.pos.z + (i ? rnd(-1.5, 1.5) : 0);
      FX.missile(headPos(b, new V3()), new V3(x, 0.2, z), { speed: 22, arc: 4, color: VEN, size: 0.35 }); Sound.sfx('dash', 0.7, 0.6);
      Hz.circle(x, z, 2.7, 1.15, 230, { name: 'Venom', onFire() { FX.burst(x, 0.3, z, { n: 26, color: VEN, color2: 0x206030, speed: [2, 7], up: 3, life: [0.4, 0.9], radius: 1.5 }); Sound.sfx('steam', 0.8, 0.6); Hz.zone({ type: 'circle', x, z, r: 2.7 }, 10, 75, { name: 'Venom pool', color: 0x58d060, delay: 0.3 }); } });
      yield 0.8;
    }
    yield 0.5;
  }
  function* vipers(b, twice) {
    const S = b.state, off = rnd(TAU); b.autoFace = false; S.rear = 0.6;
    yield* b.cast({ name: 'Nest of Vipers', time: 0.6 });
    for (let k = 0; k < (twice ? 2 : 1); k++) {
      for (let i = 0; i < 7; i++) { const d = off + (i + k * 0.5) / 7 * TAU; Hz.rect(b.pos.x, b.pos.z, d, 30, 2.7, 1.2, 280, { name: 'Nest of Vipers', quiet: true, onFire() { if (!G.headless) FX.beam(_a.set(b.pos.x, 1.2, b.pos.z), _b2.set(b.pos.x + Math.sin(d) * 30, 1.2, b.pos.z + Math.cos(d) * 30), { color: VEN, width: 0.9, dur: 0.3 }); } }); }
      yield 1.2; Sound.sfx('zap', 0.6, 0.5); FX.shake(0.3); yield 0.15;
    }
    S.rear = 0; yield 0.4; b.autoFace = true;
  }
  function* coil(b, out) {
    const S = b.state; S.rear = 1;
    Hz.circle(b.pos.x, b.pos.z, 7.6, 1.6, 320, { name: 'Constrict', kb: { dist: 5 } });
    yield* b.cast({ name: 'Constrict', time: 1.6 }); S.rear = 0; FX.ring(b.pos.x, b.pos.z, { r1: 9, color: VEN, dur: 0.5 });
    if (out) { Hz.donut(b.pos.x, b.pos.z, 7.6, 30, 1.5, 300, { name: 'Shed Skin' }); yield 1.6; }
    yield 0.4;
  }
  function* rouse(b, n) {
    const r = yield* b.cast({ name: 'Rouse', time: 2.8, interruptible: true });
    if (r === 'done') { wake(b, n); FX.flash(VEN, 0.2, 3); yield 0.6; } else yield 1.0;
  }
  function* skyTo(b, o, dur) {
    const U = b.state.sky.material.uniforms, keys = Object.keys(o), from = keys.map((k) => U[k].value.isColor ? U[k].value.clone() : U[k].value), to = keys.map((k) => U[k].value.isColor ? new THREE.Color(o[k]) : o[k]);
    yield* W.tween(dur, (t) => keys.forEach((k, i) => { if (U[k].value.isColor) W.colorLerp(U[k].value, from[i], to[i], t); else U[k].value = lerp(from[i], to[i], t); }));
  }
  function setMirrors(b, n) { const S = b.state, base = b.angToPlayer(); S.nMir = n; S.mir.forEach((m, k) => { const was = m.on; m.on = k < n; m.g.visible = m.on; if (m.on && !was) { m.a = base + (n === 1 ? 0 : (k ? 2.2 : -2.2)); m.y = 5.2; } }); }

  G.bosses.push({
    id: 'gorgon', name: 'EURYALE', title: 'The Stone Garden', hint: 'A glance', color: '#8dff7a', telegraph: 0x7dff8a,
    hp: 28500, radius: 2.2, aimY: 4.2, enrage: 440,
    post: { bloom: 0.6, threshold: 0.86, radius: 0.7, exposure: 1.12, vig: 1.05, sat: 1.05, tint: [0.94, 1.03, 1.02] },
    music: { bpm: 72, root: 40, scale: [0, 1, 4, 5, 7, 8, 11], prog: [0, 0, 1, 0, 0, 4, 1, 0],
      layers: [
        { v: 'sub', pat: '0...............', oct: 0, len: 15, vol: 0.2 }, { v: 'flute', pat: ['0.....1.4...3...', '4.....3.1...0...'], oct: 2, len: 5, vol: 0.07 }, { v: 'tom', pat: 'x.........x.....', vol: 0.2 },
        { v: 'koto', from: 1, pat: ['0.4.7.4.1.4.7.4.', '0.4.7.8.7.4.1.4.'], oct: 1, len: 2, vol: 0.1 }, { v: 'taiko', from: 1, pat: 'x.....x...x.....', vol: 0.28 }, { v: 'choir', from: 1, pat: '0.......1.......', oct: 2, len: 9, vol: 0.07 },
        { v: 'taiko', from: 2, pat: 'x..x..x.x..x.x..', vol: 0.3 }, { v: 'clap', from: 2, pat: '....x.......x...', vol: 0.12 }, { v: 'lead', from: 2, pat: ['7.8.7.4.5.4.1.0.', '7.8.b.8.7.5.4.1.'], oct: 2, len: 2, vol: 0.05 }, { v: 'brass', from: 2, pat: '0.......1.......', oct: 1, len: 8, vol: 0.09 },
      ] },
    build,
    *intro(b) { yield* Cam.shot([13, 2.2, 15], [15, 2.6, 6], [3, 4.4, 9], [0, 4.8, -3], 4.8, 46); },
    phases: [
      { at: 1, *run(b) {
        b.autoFace = true; b.turnRate = 5; yield 1.2; wake(b, 1); yield 1.5;
        while (true) {
          yield* spit(b, 3); yield* slither(b);
          yield* lash(b); yield 0.6;
          yield* behold(b); yield 0.8;
          yield* vipers(b); yield* slither(b);
          yield* rouse(b, 2); yield 0.6;
          yield* coil(b); yield 0.8;
          yield* behold(b); yield* slither(b);
          yield* lash(b); wake(b, 1); yield 1.0;
        }
      } },
      { at: 0.67, *enter(b) {
        const S = b.state; S.gaze = 0; S.mode = 0; S.locked = false; b.autoFace = true; S.rear = 1; Sound.sfx('roar', 0.9, 1.7); FX.shake(0.8); FX.flash(0xff4030, 0.3, 1.5);
        Co.start(skyTo(b, { uSunCol: 0xff5a3a, uHor: 0x3a1418, uTop: 0x0a0408, uCloudCol: 0x7a3a34 }, 3), 'fight'); Co.start(Post.lerpTo({ tint: [1.06, 0.98, 0.95], bloom: 0.68 }, 3), 'fight');
        S.moon.color.set(0xff8a70); scene.fog.color.set(0x160c0c); S.statSpeed = 3.3;
        yield 1.4; setMirrors(b, 1); const m = S.mir[0]; m.y = -2; Sound.sfx('bell', 0.9, 0.8); mirPos(m, _a); FX.pillar(_a.x, _a.z, { r: 2, h: 20, color: 0xffe0a0, dur: 1.2 });
        yield* W.tween(1.6, (k) => { m.y = lerp(-2, 5.2, k); }); S.rear = 0; yield 0.4;
      }, *run(b) {
        b.state.statSpeed = 3.3; if (!b.state.nMir) setMirrors(b, 1);
        while (true) {
          wake(b, 2); yield* vipers(b, true); yield* slither(b);
          yield* behold(b); yield 0.6;
          yield* coil(b, true); yield* spit(b, 4);
          yield* rouse(b, 2); yield* lash(b); yield 0.4;
          yield* behold(b, { time: 2.3 }); yield* slither(b);
          yield* vipers(b); yield* lash(b); yield 0.6;
        }
      } },
      { at: 0.34, *enter(b) {
        const S = b.state; S.mode = 0; S.locked = false; b.autoFace = true; S.rear = 1; S.gaze = 0.6;
        yield* b.cast({ name: 'A Thousand Eyes', time: 2.6, onTick: (k) => { FX.shake(k * 0.5); S.eyesFar.material.opacity = k; } }); S.eyesFar.material.opacity = 1;
        Sound.sfx('roar', 1, 2); Sound.sfx('bigboom', 0.7); FX.flash(VEN, 0.5, 1.2); FX.shake(1.1);
        Co.start(skyTo(b, { uSunCol: 0x180806, uSunGlow: 0.25, uHor: 0x0a2418, uTop: 0x010403, uStars: 0.3, uCloud: 0.55 }, 2.5), 'fight'); Co.start(Post.lerpTo({ tint: [0.92, 1.06, 0.96], bloom: 0.78, vig: 1.25 }, 2.5), 'fight');
        S.moon.color.set(0x60ffa0); S.moon.intensity = 1.5; scene.fog.color.set(0x06140c); scene.fog.density = 0.02; S.statSpeed = 3.9;
        setMirrors(b, 2); for (const e of awake()) crumble(e); S.gaze = 0; S.rear = 0; yield 1.2;
      }, *run(b) {
        const S = b.state; S.statSpeed = 3.9; S.eyesFar.material.opacity = 1; if (S.nMir < 2) setMirrors(b, 2);
        while (true) {
          wake(b, 2); yield* behold(b, { time: 2.3 }); yield* slither(b);
          yield* vipers(b, true); yield* spit(b, 3);
          wake(b, 1); yield* coil(b, true);
          yield* behold(b, { time: 2.2, twice: true }); yield* slither(b);
          yield* rouse(b, 3); yield* lash(b); yield* vipers(b); yield 0.4;
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      for (const q of S.ped) if (!q.has) { q.regrow -= dt; if (q.regrow <= 0) { q.has = true; q.mesh.visible = true; q.rise = 1; } }
      // mirrors drift to wherever they can catch the back of your head; they hold still for the last beat of a stare
      if (S.nMir && !S.locked) {
        const base = angTo(b.pos.x, b.pos.z, p.pos.x, p.pos.z);
        S.mir.forEach((m, k) => { if (!m.on) return; const ta = base + (S.nMir === 1 ? 0 : (k ? 2.1 : -2.1)); m.a += clamp(angDiff(m.a, ta), -0.55 * dt, 0.55 * dt); });
      }
      if (S.stoneT > 0) S.stoneT -= dt;
      if (G.headless) return;
      Post.final.uniforms.uSat.value = Post.cur.sat * (1 - 0.92 * sat(S.stoneT / 0.5));
      for (const q of S.ped) if (q.rise > 0) { q.rise = Math.max(0, q.rise - dt * 0.6); q.mesh.position.y = 0.5 - q.rise * 2.6; }
      // body
      const gz = S.gaze, rear = damp(S.rearK || 0, Math.max(S.rear, gz > 0 ? 1 : 0), 5, dt); S.rearK = rear;
      S.up.position.y = Math.sin(t * 1.3) * 0.12 + rear * 0.7; S.up.rotation.x = -rear * 0.12 + Math.sin(t * 0.9) * 0.03; S.up.rotation.z = Math.sin(t * 0.7) * 0.05;
      const N = S.NT, sweep = S.slashT > 0 ? Math.sin((1 - S.slashT / 0.4) * PI) * 2.4 : 0; if (S.slashT > 0) S.slashT -= dt;
      for (let i = 0; i < N; i++) {
        const s = i / (N - 1), r = lerp(0.92, 0.16, Math.pow(s, 0.85)), w = Math.sin(i * 0.55 - t * 2.2) * (0.2 + s * 1.9) + sweep * s * 4;
        const lift = Math.max(0, 1 - s * 5.5); _m.position.set(w, r * 0.8 + lift * lift * (1.9 + rear * 0.7), -s * 12.5 + lift * 0.4); _m.rotation.set(0, 0, 0); _m.scale.set(r, r * 0.86, r * 1.15); _m.updateMatrix(); S.tail.setMatrixAt(i, _m.matrix);
      }
      S.tail.instanceMatrix.needsUpdate = true;
      const flare = gz > 0 ? 1 : 0; S.hairK = damp(S.hairK || 0, flare, 6, dt);
      for (let k = 0; k < S.NH; k++) for (let j = 0; j < S.HS; j++) {
        const d = S.hairDir[k], len = 0.4 + j * (0.2 + S.hairK * 0.09), wob = (1 - S.hairK * 0.7) * j * 0.055;
        _m.position.set(d.x * len + Math.sin(t * 3.1 + k * 1.7 + j * 0.8) * wob, d.y * len + Math.cos(t * 2.3 + k + j * 0.6) * wob - j * j * 0.012 * (1 - S.hairK), d.z * len + Math.sin(t * 2.7 + k * 2.3 + j) * wob);
        const r = j === S.HS - 1 ? 0.11 : 0.085 - j * 0.004; _m.scale.set(r, r, r); _m.rotation.set(0, 0, 0); _m.updateMatrix(); S.hair.setMatrixAt(k * S.HS + j, _m.matrix);
      }
      S.hair.instanceMatrix.needsUpdate = true;
      for (const A of S.arms) { A.sh.rotation.set(-0.3 - rear * 1.5 + Math.sin(t * 1.4 + A.sx) * 0.1, 0, A.sx * (0.35 + rear * 0.75)); A.el.rotation.x = -0.6 - rear * 0.5; }
      S.head.rotation.x = -gz * 0.25 + Math.sin(t * 1.1) * 0.04;
      S.eyeMat.color.setHex(VEN).multiplyScalar(1.2 + gz * gz * 14);
      S.flare.material.opacity = gz * gz; S.flare.scale.setScalar(0.5 + gz * gz * 7); S.flare.quaternion.copy(camera.quaternion); S.head.getWorldQuaternion(_q); S.flare.quaternion.premultiply(_q.invert());
      S.headL.intensity = gz * gz * 260;
      for (const m of S.mir) {
        if (!m.on) continue; mirPos(m, _a); m.g.position.set(_a.x, m.y + Math.sin(t * 1.3 + m.a) * 0.25, _a.z); m.g.lookAt(p.pos.x, 1.6, p.pos.z);
        m.eyes.color.setHex(VEN).multiplyScalar(0.2 + gz * gz * 14); m.flare.material.opacity = gz * gz * 0.9; m.flare.scale.setScalar(0.5 + gz * gz * 6);
      }
      for (const f of S.fires) { f.m.scale.set(1, 1.2 + Math.sin(t * 9 + f.x) * 0.25, 1); if (vrand() < dt * 14) FX.burst(f.x, 2.1, f.z, { n: 1, color: 0xffa040, color2: 0xff3010, speed: [0.2, 0.8], up: 2.6, life: [0.4, 0.9], size: [0.3, 0.7] }); }
      S.fireL[0].intensity = 90 * (0.9 + Math.sin(t * 8) * 0.06 + Math.sin(t * 13) * 0.04); S.fireL[1].intensity = 90 * (0.9 + Math.sin(t * 9 + 2) * 0.06);
    },
    bot(b, p) {
      const S = b.state, L = awake(), h = {};
      let near = null, nd = 1e9; for (const e of L) { const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if (d < nd) { nd = d; near = e; } }
      const cs = b.castState, look = near ? angTo(p.pos.x, p.pos.z, near.pos.x, near.pos.z) : angTo(p.pos.x, p.pos.z, b.pos.x, b.pos.z);
      if (cs && cs.name === 'Behold' && cs.time - cs.t < 1.0) {
        const src = sources(b); let best = look, bs = -1;
        for (let i = 0; i < 24; i++) { const y = i / 24 * TAU; let m = 9; for (const q of src) m = Math.min(m, Math.abs(angDiff(y, angTo(p.pos.x, p.pos.z, q.x, q.z)))); const s = Math.min(m, 1.2) - Math.abs(angDiff(y, look)) * 0.05; if (s > bs) { bs = s; best = y; } }
        S.botYaw = best;
      } else S.botYaw = look;
      h.target = near && nd < 9 ? near : b;
      return h;
    },
  });
  const _q = new THREE.Quaternion();
})();
