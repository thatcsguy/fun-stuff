// DOOR XIV: NIAN, the Year-Eater. A lantern festival on a night lake. Sparks race along fuses; you choose which shells go up.
(() => {
  const R = 19, MR = 17, NM = 8, GOLD = 0xffc840, RED = 0xff4838;
  const TYPES = { peony: 0xff4444, ring: 0xffc840, willow: 0x58e070, cross: 0x58a8ff, comet: 0xc878ff };
  const _a = new V3(), _b = new V3(), _c = new THREE.Color(), _m = new THREE.Object3D();
  const mAng = (k) => k * PI / 4 + PI / 8, mPos = (k, r = MR) => [Math.sin(mAng(k)) * r, Math.cos(mAng(k)) * r];

  // The ground pattern of a shell from mortar k. Shapes use the Hz conventions so Hz.inShape can test them.
  function shapesOf(type, k) {
    const th = mAng(k) + PI, dx = Math.sin(th), dz = Math.cos(th), [ax, az] = mPos(k, MR * 0.45), px = dz, pz = -dx;
    if (type === 'peony') return [{ type: 'circle', x: ax, z: az, r: 8.5 }];
    if (type === 'ring') return [{ type: 'donut', x: ax, z: az, r0: 5, r1: 14 }];
    if (type === 'willow') return [-9, 0, 9].map((o) => ({ type: 'rect', x: ax + px * o - dx * 24, z: az + pz * o - dz * 24, dir: th, len: 48, w: 4.2 }));
    if (type === 'cross') return [{ type: 'rect', x: ax - dx * 26, z: az - dz * 26, dir: th, len: 52, w: 4.6 }, { type: 'rect', x: ax - px * 26, z: az - pz * 26, dir: th + PI / 2, len: 52, w: 4.6 }];
    return [];
  }
  const GRID = []; for (let x = -R + 1; x < R; x += 1.25) for (let z = -R + 1; z < R; z += 1.25) if (Math.hypot(x, z) < R - 1) GRID.push([x, z]);
  function safeOf(S, set) { const sh = []; for (const k of set) for (const s of shapesOf(S.types[k], k)) sh.push(s); return GRID.filter((q) => !sh.some((s) => Hz.inShape(s, q[0], q[1]))); }

  // ---------- polylines ----------
  function polyline(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, len: L[L.length - 1] }; }
  function at(P, s, out) { s = clamp(s, 0, P.len); let i = 1; while (i < P.L.length - 1 && P.L[i] < s) i++; const t = (s - P.L[i - 1]) / Math.max(1e-6, P.L[i] - P.L[i - 1]); out[0] = lerp(P.pts[i - 1][0], P.pts[i][0], t); out[1] = lerp(P.pts[i - 1][1], P.pts[i][1], t); return out; }
  function bez(p0, p1, p2, n, wig) { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, w = Math.sin(t * PI * 3) * wig * Math.sin(t * PI); const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], z = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1], tx = p2[0] - p0[0], tz = p2[1] - p0[1], tl = Math.hypot(tx, tz) || 1; pts.push([x - tz / tl * w, z + tx / tl * w]); } return pts; }
  function cord(g, P, mat) { const c = new THREE.CatmullRomCurve3(P.pts.map((q) => new V3(q[0], 0.07, q[1]))), m = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(20, Math.round(P.len * 2)), 0.075, 5), mat); g.add(m); return m; }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x03040c, horizon: 0x14183a, bottom: 0x020308, stars: 1.6, sunDir: [0.45, 0.42, -0.8], sunColor: 0xfff0d0, sunSize: 0.05, sunGlow: 0.7, clouds: 0.12, cloudColor: 0x2a3050, cloudDark: 0x04050c, cloudSpeed: 0.004 });
    g.add(sky); S.sky = sky; W.env(sky, 0.7);
    scene.fog = new THREE.FogExp2(0x070a1c, 0.0045); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x5a6aa8, 0x2a1810, 0.55);
    S.moon = W.sun(g, { dir: [0.45, 0.8, -0.4], color: 0xa8c0ff, intensity: 1.3, size: 30 });
    S.water = W.water({ deep: 0x02040c, shallow: 0x0a1430, sky: 0x1a2048, sunDir: [0.45, 0.42, -0.8], sunColor: 0xfff0d0, amp: 0.12, scale: 0.12, speed: 0.5, foam: 0 }); S.water.position.y = -2.2; g.add(S.water);
    // plaza
    const st = W.surface('slabs', { seed: 8, dark: 0x4a4650, light: 0x8a8690 }); for (const k in st) st[k].repeat.set(6, 6);
    const stone = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, roughness: 0.6, color: 0xffffff, envMapIntensity: 0.6 }); stone.normalScale.set(0.5, 0.5);
    const top = new THREE.Mesh(new THREE.CircleGeometry(R + 1.6, 72), stone); top.rotation.x = -PI / 2; top.receiveShadow = true; g.add(top);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.6, R + 2.4, 3.4, 72, 1, true), W.mat({ color: 0x3a3640, roughness: 0.9 })); drum.position.y = -1.7; g.add(drum);
    const lacq = W.mat({ color: 0x8a1a14, roughness: 0.45 }), goldM = W.mat({ color: 0xd8a840, roughness: 0.35, metalness: 0.8 });
    const NPOST = 24, postI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 2.6, 8), lacq, NPOST), lanI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), W.glow(0xff7030, 2.2), NPOST * 2);
    for (let i = 0; i < NPOST; i++) { const a = i / NPOST * TAU, x = Math.sin(a) * (R + 1.1), z = Math.cos(a) * (R + 1.1); _m.position.set(x, 1.3, z); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); postI.setMatrixAt(i, _m.matrix);
      for (let j = 0; j < 2; j++) { const a2 = a + (j + 0.5) / 2 * TAU / NPOST * 0.9; _m.position.set(Math.sin(a2) * (R + 1.1), 2.15 - 0.25 * (j ? 1 : 1), Math.cos(a2) * (R + 1.1)); _m.scale.set(1, 1.25, 1); _m.updateMatrix(); lanI.setMatrixAt(i * 2 + j, _m.matrix); } }
    postI.castShadow = true; g.add(postI); g.add(lanI);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(R + 1.1, 0.07, 5, 96), lacq); rail.rotation.x = PI / 2; rail.position.y = 2.55; g.add(rail);
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4, L = new THREE.PointLight(0xff8040, 55, 34, 1.5); L.position.set(Math.sin(a) * (R - 1), 3.2, Math.cos(a) * (R - 1)); g.add(L); }
    // far shore: hills, a pagoda, town lights
    const vr = mulberry(23), hillM = new THREE.MeshBasicMaterial({ color: 0x070a18 });
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + vr() * 0.2, d = 230 + vr() * 120, h = 30 + vr() * 70; const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, PI / 2), hillM); m.scale.set(60 + vr() * 60, h, 40 + vr() * 40); m.position.set(Math.sin(a) * d, -2.5, Math.cos(a) * d); m.rotation.y = a; g.add(m); }
    const pag = new THREE.Group(); pag.position.set(-70, -2, -150); g.add(pag); for (let k = 0; k < 5; k++) { const sc = 1 - k * 0.14; const tier = new THREE.Mesh(new THREE.BoxGeometry(14 * sc, 6, 14 * sc), new THREE.MeshBasicMaterial({ color: 0x180c0c })); tier.position.y = 3 + k * 8; pag.add(tier); const roof = new THREE.Mesh(new THREE.ConeGeometry(13 * sc, 3, 4), new THREE.MeshBasicMaterial({ color: 0x0c0608 })); roof.position.y = 7.5 + k * 8; roof.rotation.y = PI / 4; pag.add(roof); const win = new THREE.Mesh(new THREE.PlaneGeometry(9 * sc, 1.6), W.glow(0xffa040, 1.6)); win.position.set(0, 3.4 + k * 8, 7.05 * sc); pag.add(win); }
    const townI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 5, 4), W.glow(0xffb060, 1.6), 140); for (let i = 0; i < 140; i++) { const a = vr() * TAU, d = 190 + vr() * 60; _m.position.set(Math.sin(a) * d, -1 + vr() * 9, Math.cos(a) * d); _m.scale.setScalar(0.5 + vr()); _m.rotation.set(0, 0, 0); _m.updateMatrix(); townI.setMatrixAt(i, _m.matrix); } g.add(townI);
    // sky lanterns drifting up
    S.NL = 150; S.skyLan = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.36, 0.95, 7), W.glow(0xff9040, 1.7), S.NL); S.skyLan.frustumCulled = false; g.add(S.skyLan);
    S.lan = Array.from({ length: S.NL }, () => ({ a: vr() * TAU, d: 26 + vr() * 110, y: vr() * 90, v: 0.7 + vr() * 0.9, ph: vr() * 10, s: 0.7 + vr() * 0.9 }));

    // mortars
    S.types = ['peony', 'ring', 'willow', 'cross', 'peony', 'ring', 'willow', 'cross'];
    const tubeM = W.mat({ color: 0x2a2420, roughness: 0.6, metalness: 0.4 });
    S.mortars = []; for (let k = 0; k < NM; k++) { const [x, z] = mPos(k), grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = mAng(k) + PI; g.add(grp);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 1.9, 12, 1, true), tubeM); tube.position.y = 0.95; tube.rotation.x = 0.16; tube.castShadow = true; tube.material.side = THREE.DoubleSide; grp.add(tube);
      const bm = new THREE.MeshBasicMaterial({ color: 0xffffff }), band = new THREE.Mesh(new THREE.CylinderGeometry(0.69, 0.73, 0.7, 12, 1, true), bm); band.position.y = 0.95; band.rotation.x = 0.16; grp.add(band);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 1.7), tubeM); foot.position.y = 0.1; grp.add(foot);
      S.mortars.push({ k, x, z, bm, armed: false, kick: 0 }); }
    // fuses: rim to mortar, never through one shared point. Forks (later) branch to the next mortar round.
    S.cordM = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9, emissive: 0x402008, emissiveIntensity: 0.5 });
    S.fuses = []; S.forks = [];
    for (let k = 0; k < NM; k++) { const sgn = k % 2 ? 1 : -1, a0 = mAng(k) + sgn * 1.9, p0 = [Math.sin(a0) * 16.3, Math.cos(a0) * 16.3], p2 = mPos(k, MR - 0.9), mid = [(p0[0] + p2[0]) * 0.5 * 0.5, (p0[1] + p2[1]) * 0.5 * 0.5];
      const P = polyline(bez(p0, mid, p2, 44, 1.1)); P.mesh = cord(g, P, S.cordM); S.fuses.push(P);
      const k2 = (k + (sgn > 0 ? NM - 1 : 1)) % NM, fp = at(P, P.len * 0.5, [0, 0]).slice(), q2 = mPos(k2, MR - 0.9), fm = [(fp[0] + q2[0]) * 0.5 * 0.8, (fp[1] + q2[1]) * 0.5 * 0.8];
      const F = polyline(bez(fp, fm, q2, 26, 0.6)); F.mesh = cord(g, F, S.cordM); F.mesh.visible = false; F.to = k2; F.atS = P.len * 0.5; S.forks.push(F); }
    { const pts = []; for (let i = 0; i <= 120; i++) { const t = i / 120, a = 0.6 + t * TAU * 1.5, r = lerp(15.2, 1.6, t); pts.push([Math.sin(a) * r, Math.cos(a) * r]); } S.spiral = polyline(pts); S.spiral.mesh = cord(g, S.spiral, S.cordM); S.spiral.mesh.visible = false; }
    S.big = new THREE.Group(); const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 1.5, 14), tubeM); bt.position.y = 0.75; bt.castShadow = true; S.big.add(bt); const bb = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.1, 6, 20), goldM); bb.rotation.x = PI / 2; bb.position.y = 1.1; S.big.add(bb); S.big.visible = false; g.add(S.big);
    // sparks and rising shells
    S.sparkM = W.glow(0xfff0c0, 5); S.haloM = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    S.sparkPool = Array.from({ length: 16 }, () => { const m = new THREE.Group(), c = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), S.sparkM), h = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), S.haloM); m.add(c); m.add(h); m.visible = false; g.add(m); return m; });
    S.shellPool = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), W.glow(0xffffff, 4)); m.visible = false; g.add(m); return m; });
    S.sparks = []; S.shells = [];
    // sky bursts: one point cloud, motion done in the vertex shader
    const NPT = Math.round(7000 * Math.max(0.5, G.q.part)), geo = new THREE.BufferGeometry();
    S.fw = { n: NPT, head: 0, start: new Float32Array(NPT * 3), vel: new Float32Array(NPT * 3), col: new Float32Array(NPT * 3), dat: new Float32Array(NPT * 4).fill(-100) };
    geo.setAttribute('position', new THREE.BufferAttribute(S.fw.start, 3)); geo.setAttribute('aVel', new THREE.BufferAttribute(S.fw.vel, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(S.fw.col, 3)); geo.setAttribute('aDat', new THREE.BufferAttribute(S.fw.dat, 4));
    geo.boundingSphere = new THREE.Sphere(new V3(), 1e6);
    const mk = (flip) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uFlip: { value: flip }, uPx: { value: 1 } },
      vertexShader: `attribute vec3 aVel; attribute vec3 aCol; attribute vec4 aDat; uniform float uTime, uFlip, uPx; varying vec4 vC;
        void main(){ float t = uTime - aDat.x, life = max(aDat.y, 0.01), k = clamp(t / life, 0.0, 1.0), dr = max(aDat.z, 0.05);
          vec3 p = position + aVel * (1.0 - exp(-dr * max(t, 0.0))) / dr; p.y -= aDat.w * t * t;
          if (uFlip > 0.5) p.y = -4.4 - p.y;
          float on = step(0.0, t) * step(t, life);
          float fade = (1.0 - k) * (1.0 - k) * (0.75 + 0.25 * sin(t * 40.0 + position.x * 7.0));
          vC = vec4(aCol * fade * (uFlip > 0.5 ? 0.22 : 1.0), on);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = on * uPx * (1.0 + 2.0 * (1.0 - k)) * 60.0 / max(-mv.z, 1.0); }`,
      fragmentShader: `varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = clamp(1.0 - dot(d, d) * 4.0, 0.0, 1.0); if (vC.a < 0.5 || a <= 0.0) discard; gl_FragColor = vec4(max(vC.rgb, vec3(0.0)) * a * a, 1.0); }` });
    S.fwM = mk(0); S.fwM2 = mk(1); S.fwPts = new THREE.Points(geo, S.fwM); S.fwPts.frustumCulled = false; g.add(S.fwPts); S.fwPts2 = new THREE.Points(geo, S.fwM2); S.fwPts2.frustumCulled = false; g.add(S.fwPts2);

    // ---- Nian: a dragon-dance costume come alive ----
    const bg = b.group; S.rig = new THREE.Group(); bg.add(S.rig);
    const cloth = W.mat({ color: 0xc81e14, roughness: 0.65, emissive: 0x400806, emissiveIntensity: 0.5 }), fur = W.mat({ color: 0xf4ecd8, roughness: 0.9 }), blk = W.mat({ color: 0x0c0a0a, roughness: 0.5 });
    S.head = new THREE.Group(); S.head.position.set(0, 2.3, 0.6); S.rig.add(S.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 12), cloth); skull.scale.set(1.15, 0.95, 1.2); skull.castShadow = true; S.head.add(skull);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.24, 8, 18, PI), fur); brow.position.set(0, 0.45, 0.85); brow.rotation.x = -0.4; S.head.add(brow);
    for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), W.glow(0xfff4d0, 1.6)); eye.position.set(sx * 0.55, 0.3, 1.12); S.head.add(eye); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), blk); pu.position.set(sx * 0.55, 0.3, 1.42); S.head.add(pu); const ear = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 6), cloth); ear.position.set(sx * 1.05, 0.95, 0.1); ear.rotation.z = -sx * 0.5; S.head.add(ear); }
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.2, 8), goldM); horn.position.set(0, 1.45, 0.4); horn.rotation.x = -0.25; S.head.add(horn);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), goldM); nose.position.set(0, -0.15, 1.5); S.head.add(nose);
    S.jaw = new THREE.Group(); S.jaw.position.set(0, -0.55, 0.2); S.head.add(S.jaw); const jw = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 1.7), cloth); jw.position.z = 0.75; S.jaw.add(jw); const beard = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 10), fur); beard.position.set(0, -0.75, 1.3); beard.rotation.x = PI; S.jaw.add(beard);
    for (let i = 0; i < 7; i++) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), fur); tooth.position.set(-0.75 + i * 0.25, 0.3, 1.5); S.jaw.add(tooth); }
    S.segs = Array.from({ length: 5 }, (_, i) => { const s = new THREE.Group(), sc = 1 - i * 0.08; const bd = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), cloth); bd.scale.set(1.05 * sc, 0.85 * sc, 1.3); bd.position.y = 1.75; bd.castShadow = true; s.add(bd);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 4), goldM); fin.position.y = 2.75 * (0.75 + sc * 0.25); s.add(fin); const fr = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * sc, 1.08 * sc, 0.3, 12, 1, true), fur); fr.position.y = 1.05; fr.scale.z = 1.25; s.add(fr);
      s.legs = [-1, 1].map((sx) => { const hip = new THREE.Group(); hip.position.set(sx * 0.5, 1.1, 0); s.add(hip); const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1.1, 6), blk); lg.position.y = -0.55; hip.add(lg); return hip; }); g.add(s); return s; });
    S.path = []; S.stars = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.07, 5, 5), W.glow(GOLD, 3)); S.stars.rotation.x = PI / 2; S.stars.position.y = 4.4; S.stars.visible = false; bg.add(S.stars);
    S.light = new THREE.PointLight(0xff6030, 30, 20, 1.6); S.light.position.set(0, 3, 1); bg.add(S.light);
    Object.assign(S, { lvl: 0, vol: null, stun: 0, hopY: 0, jawK: 0, bigS: null, walk: 0 });
    return {
      edge: 'wall', spawn: { x: 0, z: 9 }, bossStart: { x: 0, z: -7, face: 0 }, camDist: 17, camPitch: 0.5,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.5, bulletBounds: (x, z) => Math.hypot(x, z) < R + 2,
      clamp(p) { const d = Math.hypot(p.x, p.z); if (d > R - 0.5) { p.x *= (R - 0.5) / d; p.z *= (R - 0.5) / d; } },
      solid(p) { for (const m of S.mortars) { const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz); if (d < 1.2 && d > 0.001) { p.x = m.x + dx / d * 1.2; p.z = m.z + dz / d * 1.2; } } },
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > R + 9) { x *= (R + 9) / d; z *= (R + 9) / d; } return { x, y: Math.max(y, d > R + 1 ? -0.5 : 0.5), z }; },
    };
  }

  // ---------- fireworks in the sky ----------
  function skyBurst(S, x, y, z, type, color, scale = 1) {
    if (G.headless) return; const F = S.fw, now = S.fwM.uniforms.uTime.value, c = _c.setHex(color), n = Math.round((type === 'big' ? 1500 : 520) * Math.max(0.5, G.q.part));
    for (let i = 0; i < n; i++) {
      const j = F.head; F.head = (F.head + 1) % F.n; let vx, vy, vz, life = 1.9, drag = 1.5, grav = 1.2, sp = 26 * scale, k = 1;
      const u = vrand() * 2 - 1, ph = vrand() * TAU, sq = Math.sqrt(1 - u * u); vx = sq * Math.cos(ph); vy = u; vz = sq * Math.sin(ph);
      if (type === 'ring') { const a = vrand() * TAU; vx = Math.cos(a); vz = Math.sin(a); vy = (vrand() - 0.5) * 0.08; sp *= 1.1; if (i % 3 === 0) { sp *= 0.36; } }
      else if (type === 'willow') { life = 3.0; drag = 1.1; grav = 3.0; sp *= 0.8 + vrand() * 0.25; }
      else if (type === 'cross') { const ax = i % 4, s = (vrand() < 0.5 ? -1 : 1) * (0.3 + vrand() * 0.7); vx = ax < 2 ? s : 0; vz = ax >= 2 ? s : 0; if (ax % 2) { const t = vx; vx = (t + vz) * 0.707; vz = (vz - t) * 0.707 + t * 0; } vy = (vrand() - 0.5) * 0.1; sp *= 1.25; vx += (vrand() - 0.5) * 0.05; vz += (vrand() - 0.5) * 0.05; }
      else if (type === 'comet') { const a = i / n * TAU * 3; vx = Math.cos(a) * (i / n); vz = Math.sin(a) * (i / n); vy = 0.2; life = 2.6; }
      else if (type === 'big') { sp *= 1.7; life = 3.2; k = 1.3; } else sp *= 0.75 + vrand() * 0.35;
      F.start[j * 3] = x; F.start[j * 3 + 1] = y; F.start[j * 3 + 2] = z; F.vel[j * 3] = vx * sp; F.vel[j * 3 + 1] = vy * sp; F.vel[j * 3 + 2] = vz * sp;
      const w = i % 7 === 0 ? 1 : 0; F.col[j * 3] = lerp(c.r, 1, w) * 1.5 * k; F.col[j * 3 + 1] = lerp(c.g, 1, w) * 1.5 * k; F.col[j * 3 + 2] = lerp(c.b, 1, w) * 1.5 * k;
      F.dat[j * 4] = now; F.dat[j * 4 + 1] = life * (0.75 + vrand() * 0.4); F.dat[j * 4 + 2] = drag; F.dat[j * 4 + 3] = grav;
    }
    for (const k of ['position', 'aVel', 'aCol', 'aDat']) S.fwPts.geometry.attributes[k].needsUpdate = true;
  }

  // ---------- fuses and shells ----------
  function addSpark(S, o) { const m = S.sparkPool.find((q) => !q.visible); const sp = Object.assign({ s: 0, alive: true, m, forked: false }, o); if (m) { m.visible = true; m.scale.setScalar(o.big ? 1.6 : 1); } S.sparks.push(sp); return sp; }
  // Plan a volley: which mortars are lit, which the player has to stamp, where it will be safe.
  function planVolley(b, o) {
    const S = b.state, p = G.player;
    for (let attempt = 0; attempt < 200; attempt++) {
      const lit = shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, o.n).filter((k) => S.types[k] !== 'comet' || o.comet); if (lit.length < o.n) continue;
      const all = safeOf(S, lit).length;
      if (!o.must) { if (all >= 40) return { lit, stamp: [], keep: null }; continue; }
      if (all >= 14) continue;
      // one shell is worth keeping: it must be able to cover the beast while leaving the player room beside it
      const order = shuffle(lit);
      for (const keep of order) { if (S.types[keep] === 'comet') continue;
        for (const drop of order) { if (drop === keep) continue; const rest = lit.filter((k) => k !== drop), sf = safeOf(S, rest); if (sf.length >= 34) return { lit, stamp: [drop], keep, safe: sf }; }
        if (o.n >= 5) for (let i = 0; i < order.length; i++) { const d1 = order[i], d2 = (d1 + 1) % NM; if (d1 === keep || d2 === keep || !lit.includes(d2)) continue; const rest = lit.filter((k) => k !== d1 && k !== d2), sf = safeOf(S, rest); if (sf.length >= 34) return { lit, stamp: [d1, d2], keep, safe: sf }; }
      }
    }
    return null;
  }
  function startVolley(b, o) {
    const S = b.state, pl = planVolley(b, o) || planVolley(b, Object.assign({}, o, { must: false, n: Math.min(3, o.n) })); if (!pl) return null;
    const T = o.T, V = { lit: pl.lit, stamp: pl.stamp, keep: pl.keep, arrive: G.now + T, land: G.now + T + 1.2 + 1.6, done: false, fired: [], safe: pl.safe || null, T };
    pl.lit.forEach((k, i) => { const P = S.fuses[k], quick = o.quick && i === 0, delay = quick ? T * 0.45 : 0; S.mortars[k].armed = true; addSpark(S, { P, to: k, speed: P.len / (T - delay), wait: delay, quick, vol: V, fork: o.forks && i === 1 && !pl.lit.includes(S.forks[k].to) && S.types[S.forks[k].to] !== 'comet' ? S.forks[k] : null }); });
    S.vol = V; Sound.sfx('steam', 0.7, 1.8);
    return V;
  }
  function launch(b, k, V) {
    const S = b.state, m = S.mortars[k], type = S.types[k], col = TYPES[type], [ax, az] = mPos(k, MR * 0.45); m.kick = 1; m.armed = false;
    Sound.sfx('boom', 0.7, 1.6); if (!G.headless) FX.burst(m.x, 2, m.z, { n: 14, color: 0xffd090, speed: [2, 8], up: 6, life: [0.2, 0.6], size: [0.2, 0.5] });
    const sm = S.shellPool.find((q) => !q.visible); if (sm) { sm.visible = true; sm.material.color.setHex(col).multiplyScalar(3); }
    S.shells.push({ m: sm, x0: m.x, z0: m.z, x1: ax, z1: az, t: 0, type, col, k, V });
    if (V) V.fired.push(k);
  }
  function burst(b, sh) {
    const S = b.state, shapes = shapesOf(sh.type, sh.k); skyBurst(S, sh.x1, 30, sh.z1, sh.type, sh.col); Sound.sfx('bigboom', 0.55, 1.3 + (sh.k % 3) * 0.15); FX.flash(sh.col, 0.07, 3);
    let first = true;
    const hit = () => { if (!first) return; first = false; if (shapes.some((s) => Hz.inShape(s, b.pos.x, b.pos.z))) startle(b); Sound.sfx('boom', 0.8, 0.8); FX.shake(0.5); };
    const o = { name: sh.type[0].toUpperCase() + sh.type.slice(1), color: sh.col, tag: 'fight', quiet: true, silent: true, onFire: hit };
    for (const s of shapes) { if (s.type === 'circle') Hz.circle(s.x, s.z, s.r, 1.6, 340, o); else if (s.type === 'donut') Hz.donut(s.x, s.z, s.r0, s.r1, 1.6, 340, o); else Hz.rect(s.x, s.z, s.dir, s.len, s.w, 1.6, 320, o); }
    if (sh.type === 'comet') { const sgn = sh.k % 2 ? 1 : -1, a0 = mAng(sh.k) + PI, t0 = G.now; Hz.zone({ type: 'rect', x: sh.x1, z: sh.z1, dir: a0, len: 24, w: 3.4 }, 6.5, 95, { name: 'Comet', color: sh.col, delay: 1.6, tag: 'fight', track(s) { s.dir = a0 + sgn * Math.max(0, G.now - t0 - 1.6) * 0.75; } }); }
    Sound.sfx('warn', 0.5);
  }
  function startle(b) {
    const S = b.state; if (S.stun > 0 || b.transitioning || !b.alive) return; S.stun = 5; b.stagger = 5; Sound.sfx('roar', 0.9, 2.2); Sound.sfx('crit', 0.8);
    if (b.castState) { b.castState.result = 'interrupted'; b.castState = null; }
    if (!G.headless) { b.aim(_a); FX.burst(_a.x, _a.y + 1, _a.z, { n: 40, color: GOLD, color2: 0xffffff, speed: [3, 10], life: [0.4, 1.0], size: [0.2, 0.5] }); FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: 7, color: GOLD, dur: 0.5 }); }
  }
  function* stunned(b) { const S = b.state; while (S.stun > 0) yield; }
  function* waitVolley(b, V, extra = 0.4) { if (!V) return; while (G.now < V.land + extra) yield; if (b.state.vol === V) b.state.vol = null; }

  // ---------- Nian's own kit ----------
  function* pounce(b) {
    const S = b.state, p = G.player; yield* stunned(b);
    const h = Hz.circle(p.pos.x, p.pos.z, 4.4, 1.35, 320, { name: 'Pounce', lock: 0.85, track(s) { s.x = p.pos.x; s.z = p.pos.z; }, onFire() { Sound.sfx('boom', 0.9, 0.7); FX.shake(0.5); } });
    const r = yield* b.cast({ name: 'Pounce', time: 0.75 }); if (r !== 'done') { Hz.cancel(h); return; }
    const x0 = b.pos.x, z0 = b.pos.z; for (let t = 0; t < 0.6; t += G.dt) { const q = smooth(t / 0.6); b.pos.x = lerp(x0, h.shape.x, q); b.pos.z = lerp(z0, h.shape.z, q); S.hopY = Math.sin(q * PI) * 5; yield; } S.hopY = 0; yield 0.7;
  }
  function* sweep(b) {
    const S = b.state; yield* stunned(b); const dir = b.angToPlayer(); b.autoFace = false;
    const h = Hz.cone(b.pos.x, b.pos.z, dir, 2.4, 9.5, 1.2, 300, { name: 'Tail Sweep', onFire() { Sound.sfx('sword', 0.9, 0.6); FX.shake(0.4); S.spin = 1; } });
    const r = yield* b.cast({ name: 'Tail Sweep', time: 1.2 }); if (r !== 'done') Hz.cancel(h); yield 0.5; b.autoFace = true;
  }
  function* toss(b, n = 3) {
    const S = b.state, p = G.player; yield* stunned(b); const r = yield* b.cast({ name: 'Lantern Toss', time: 0.8 }); if (r !== 'done') return;
    for (let k = 0; k < n; k++) { const a = rnd(TAU), d = k ? rnd(2, 8) : 0, x = p.pos.x + Math.sin(a) * d, z = p.pos.z + Math.cos(a) * d; if (Math.hypot(x, z) > R - 2) continue;
      if (!G.headless) FX.missile(new V3(b.pos.x, 3.5, b.pos.z), new V3(x, 0.3, z), { speed: 22, arc: 6, color: 0xff8030, size: 0.4 });
      Hz.zone({ type: 'circle', x, z, r: 3 }, 6, 80, { name: 'Lantern Fire', color: 0xff7028, delay: 1.2 }); yield 0.3; }
    yield 0.6;
  }
  function* stampede(b, legs = 3) {
    const S = b.state, p = G.player; yield* stunned(b); b.autoFace = false;
    let x = b.pos.x, z = b.pos.z; const path = [];
    for (let k = 0; k < legs; k++) { let a = k === 0 ? angTo(x, z, p.pos.x, p.pos.z) : rnd(TAU), len = 16; for (let t = 0; t < 12; t++) { const nx = x + Math.sin(a) * len, nz = z + Math.cos(a) * len; if (Math.hypot(nx, nz) < R - 2.5) break; a = angTo(x, z, 0, 0) + rnd(-0.8, 0.8); len = 14; } path.push({ x, z, a, len }); Hz.rect(x, z, a, len, 4.6, 1.3 + k * 0.55, 330, { name: 'Stampede', quiet: k > 0 }); x += Math.sin(a) * len; z += Math.cos(a) * len; }
    const r = yield* b.cast({ name: 'Stampede', time: 1.3 }); if (r !== 'done') { b.autoFace = true; return; }
    for (const q of path) { b.facing = q.a; Sound.sfx('dash', 0.8, 0.6); for (let t = 0; t < 0.5; t += G.dt) { const k = t / 0.5; b.pos.x = q.x + Math.sin(q.a) * q.len * k; b.pos.z = q.z + Math.cos(q.a) * q.len * k; S.walk += G.dt * 30; yield; } b.pos.x = q.x + Math.sin(q.a) * q.len; b.pos.z = q.z + Math.cos(q.a) * q.len; yield 0.05; }
    yield 0.6; b.autoFace = true;
  }
  function* rockets(b, waves = 2) {
    yield* stunned(b); const r = yield* b.cast({ name: 'Bottle Rockets', time: 0.8 }); if (r !== 'done') return;
    for (let w = 0; w < waves; w++) { const a = rnd(TAU), sx = Math.sin(a), sz = Math.cos(a), gap = rndi(-3, 3); for (let i = -6; i <= 6; i++) { if (Math.abs(i - gap) <= 1) continue; Bul.fire({ x: -sx * 24 + sz * i * 2.6, z: -sz * 24 - sx * i * 2.6, dir: a, speed: 13, r: 0.36, dmg: 130, color: pick([0xff5050, 0xffc840, 0x60c0ff]), life: 4 }); } Sound.sfx('laser', 0.6, 1.4); yield 1.2; }
    yield 0.4;
  }
  // Feast: only a shell landing on him stops it. He plants himself where the shell worth keeping will land.
  function* feast(b, V) {
    const S = b.state; if (!V || V.keep === null || V.keep === undefined) return; yield* stunned(b);
    const sh = shapesOf(S.types[V.keep], V.keep)[0]; let x, z; if (sh.type === 'circle') { x = sh.x * 0.8; z = sh.z * 0.8; } else if (sh.type === 'donut') { const a = Math.atan2(-sh.x, -sh.z); x = sh.x + Math.sin(a) * 8; z = sh.z + Math.cos(a) * 8; } else { x = sh.x + Math.sin(sh.dir) * sh.len * 0.42; z = sh.z + Math.cos(sh.dir) * sh.len * 0.42; }
    const x0 = b.pos.x, z0 = b.pos.z; for (let t = 0; t < 0.6; t += G.dt) { const q = smooth(t / 0.6); b.pos.x = lerp(x0, x, q); b.pos.z = lerp(z0, z, q); S.hopY = Math.sin(q * PI) * 4; yield; } S.hopY = 0;
    const time = Math.max(1.5, V.land - G.now + 0.5); S.jawOpen = 1;
    const r = yield* b.cast({ name: 'Feast', time }); S.jawOpen = 0;
    if (r === 'done') { const p = G.player; Sound.sfx('roar', 1, 0.5); FX.flash(RED, 0.5, 1.2); FX.shake(0.9); if (p.alive) p.hurt(450, { blockable: false, src: { name: 'Feast' } }); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.025); if (!G.headless) FX.ring(b.pos.x, b.pos.z, { r0: 1, r1: 30, color: RED, dur: 0.7 }); yield 0.6; }
    else yield* stunned(b);
  }
  function* roar(b) {
    const S = b.state; yield* stunned(b); S.jawOpen = 1; const r = yield* b.cast({ name: 'Rekindle', time: 2.4, interruptible: true }); S.jawOpen = 0;
    if (r === 'done') { Sound.sfx('roar', 1, 0.8); const V = S.vol; if (V && G.now < V.arrive) { for (const sp of S.sparks) if (!sp.alive && sp.vol === V && !sp.relit && sp.P) { sp.relit = true; sp.alive = true; const left = Math.max(1.8, V.arrive - G.now); sp.speed = (sp.P.len - sp.s) / left; if (sp.m) sp.m.visible = true; else { sp.m = S.sparkPool.find((q) => !q.visible); if (sp.m) sp.m.visible = true; } S.mortars[sp.to].armed = true; } } }
    yield 0.5;
  }
  function lightSpiral(b) { const S = b.state; if (S.bigS && S.bigS.alive) return; S.bigS = addSpark(S, { P: S.spiral, to: -1, speed: 5.6, big: true, wait: 0 }); Sound.sfx('steam', 0.9, 1.2); }

  function setAct(b, n) {
    const S = b.state; S.lvl = n; S.hopY = 0; S.jawOpen = 0; b.autoFace = true;
    for (const sp of S.sparks) { sp.alive = false; if (sp.m) sp.m.visible = false; } S.sparks.length = 0; S.vol = null; S.bigS = null; for (const m of S.mortars) m.armed = false;
    S.types = n === 0 ? ['peony', 'ring', 'willow', 'cross', 'peony', 'ring', 'willow', 'cross'] : n === 1 ? ['peony', 'ring', 'cross', 'comet', 'ring', 'willow', 'peony', 'cross'] : ['ring', 'peony', 'comet', 'cross', 'willow', 'ring', 'cross', 'peony'];
    S.mortars.forEach((m, k) => m.bm.color.setHex(TYPES[S.types[k]]).multiplyScalar(1.3)); for (const F of S.forks) F.mesh.visible = n >= 1; S.spiral.mesh.visible = S.big.visible = n >= 2;
  }
  function look(b, n, instant) { const S = b.state; S.lookN = n; if (instant) { S.hemi.intensity = [0.55, 0.5, 0.45][n]; } }

  G.bosses.push({
    id: 'festival', name: 'NIAN', title: 'The Year-Eater', hint: 'Loud and bright', color: '#ffb060', telegraph: 0xff5a30,
    hp: 28000, radius: 1.9, aimY: 2.4, enrage: 440,
    post: { bloom: 0.62, threshold: 0.82, radius: 0.8, exposure: 1.08, vig: 1.05, sat: 1.15, contrast: 1.06, tint: [1.03, 1.0, 1.02] },
    music: { bpm: 126, root: 41, scale: [0, 2, 4, 7, 9], prog: [0, 0, 3, 2, 0, 4, 3, 1],
      layers: [
        { v: 'koto', pat: ['0.2.4.2.0.4.2.1.', '4.2.0.2.4.3.2.0.'], oct: 1, len: 1, vol: 0.08 }, { v: 'clap', pat: '....x.......x...', vol: 0.1 }, { v: 'tom', pat: 'x..x..x.x..x..x.', vol: 0.13 }, { v: 'flute', pat: ['0.......2...4...', '3.......2...0...'], oct: 2, len: 5, vol: 0.05 },
        { v: 'taiko', from: 1, pat: 'x...x..xx...x.x.', vol: 0.22 }, { v: 'brass', from: 1, pat: ['0.......3.......', '4.......2.......'], oct: 0, len: 7, vol: 0.1 }, { v: 'bass', from: 1, pat: '0..0..0.0..0..2.', oct: -1, len: 1, vol: 0.12 },
        { v: 'arp', from: 2, pat: '0241024302410243', oct: 2, len: 1, vol: 0.045 }, { v: 'taiko', from: 2, pat: 'x.xxx.x.x.xxx.xx', vol: 0.2 }, { v: 'choir', from: 2, pat: '0.......4.......', oct: 1, len: 8, vol: 0.06 },
      ] },
    build,
    *intro(b) { const S = b.state; Sound.sfx('roar', 0.6, 0.9); Co.start(function* () { yield 1.2; skyBurst(S, -8, 34, -20, 'peony', TYPES.peony); yield 0.8; skyBurst(S, 10, 38, -26, 'ring', TYPES.ring); yield 0.9; skyBurst(S, 0, 42, -30, 'willow', TYPES.willow); }, 'fight'); yield* Cam.shot([16, 3, 22], [0, 10, -10], [4, 3.2, 3], [0, 3, -7], 5.2, 48); },
    *death(b) {
      const S = b.state, a = Cam.yaw + 0.5; Cam.cine = { pos: new V3(b.pos.x - Math.sin(a) * 20, 5, b.pos.z - Math.cos(a) * 20), look: new V3(b.pos.x, 12, b.pos.z), fov: 54 };
      S.dead = true; Sound.sfx('roar', 1, 0.5); const order = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
      for (let i = 0; i < 8; i++) { const k = order[i], [ax, az] = mPos(k, MR * 0.5); skyBurst(S, ax, 26 + (i % 3) * 5, az, ['peony', 'ring', 'willow', 'cross'][i % 4], Object.values(TYPES)[i % 5]); Sound.sfx('bigboom', 0.6, 1.2 + (i % 3) * 0.2); FX.flash(Object.values(TYPES)[i % 5], 0.1, 3); yield 0.09; }
      skyBurst(S, 0, 40, 0, 'big', GOLD); yield 0.5;
    },
    phases: [
      { at: 1, *run(b) {
        const S = b.state; setAct(b, 0); yield 1.0; let n = 0;
        while (true) {
          const V = startVolley(b, { n: n ? 3 : 2, T: n ? 6 : 7 }); yield* pounce(b); yield* sweep(b); yield* waitVolley(b, V);
          yield* toss(b, 3); yield* stampede(b, 2);
          const V2 = startVolley(b, { n: n ? 4 : 3, T: 6, must: n > 0 }); yield* sweep(b); yield* pounce(b); yield* waitVolley(b, V2); yield* rockets(b, 1); n++;
        }
      } },
      { at: 0.66, skipTo(b) { look(b, 1, true); },
        *enter(b) {
          const S = b.state; setAct(b, 1); S.stun = 0; S.jawOpen = 1; yield* b.moveTo(0, 0, 14);
          yield* b.cast({ name: 'New Year', time: 2.0, onTick: (k) => FX.shake(k * 0.25) }); S.jawOpen = 0; Sound.sfx('roar', 1, 0.7); FX.flash(RED, 0.3, 1);
          for (let k = 0; k < 8; k++) if (!G.headless) FX.pillar(S.mortars[k].x, S.mortars[k].z, { r: 0.9, h: 10, color: TYPES[S.types[k]], dur: 0.8 });
          Co.start(Post.lerpTo({ bloom: 0.68, sat: 1.2 }, 3), 'fight'); yield 1.2;
        },
        *run(b) {
          const S = b.state; setAct(b, 1); yield 0.5; let n = 0;
          while (true) {
            const V = startVolley(b, { n: 4, T: 5.6, must: true, forks: true, quick: n % 2 === 1, comet: true }); yield* pounce(b); yield* feast(b, V); yield* waitVolley(b, V);
            yield* toss(b, 3); yield* stampede(b, 3); yield* rockets(b, 2);
            const V2 = startVolley(b, { n: 4, T: 5.6, must: true, forks: true, comet: true }); yield* sweep(b); if (n % 2) yield* roar(b); else yield* pounce(b); yield* waitVolley(b, V2); n++;
          }
        } },
      { at: 0.33, skipTo(b) { look(b, 2, true); },
        *enter(b) {
          const S = b.state; setAct(b, 2); S.stun = 0; S.jawOpen = 1; yield* b.moveTo(4, 4, 14);
          yield* b.cast({ name: 'Grand Finale', time: 2.2, onTick: (k) => FX.shake(k * 0.3) }); S.jawOpen = 0; Sound.sfx('roar', 1, 0.5); FX.flash(GOLD, 0.35, 1);
          skyBurst(S, 0, 36, 0, 'big', GOLD); Co.start(Post.lerpTo({ bloom: 0.72, exposure: 1.12 }, 3), 'fight'); yield 1.0;
        },
        *run(b) {
          const S = b.state; setAct(b, 2); yield 0.4; let n = 0;
          Co.start(function* () { while (true) { lightSpiral(b); yield 24; } }, 'phase');
          while (true) {
            const V = startVolley(b, { n: 5, T: 5.0, must: true, forks: true, quick: true, comet: true }); yield* pounce(b); if (n % 2 === 0) yield* feast(b, V); else yield* sweep(b); yield* waitVolley(b, V, 0.2);
            yield* stampede(b, 3);
            const V2 = startVolley(b, { n: 5, T: 5.0, must: true, forks: true, comet: true }); yield* rockets(b, 1); if (n % 2) yield* roar(b); yield* pounce(b); yield* waitVolley(b, V2, 0.2); yield* toss(b, 2); n++;
          }
        } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight';
      S.fwM.uniforms.uTime.value = S.fwM2.uniforms.uTime.value = t; S.fwM.uniforms.uPx.value = S.fwM2.uniforms.uPx.value = renderer.getPixelRatio() * (innerHeight / 720) * 2.2;
      // sparks
      const q = [0, 0];
      for (let i = S.sparks.length - 1; i >= 0; i--) {
        const sp = S.sparks[i]; if (!sp.alive) { if (sp.vol && G.now > sp.vol.land) S.sparks.splice(i, 1); continue; }
        if (sp.wait > 0) { sp.wait -= dt; } else sp.s += sp.speed * dt;
        at(sp.P, sp.s, q); if (sp.m) { sp.m.position.set(q[0], 0.3, q[1]); const fl = 0.8 + Math.sin(t * 40 + i) * 0.25; sp.m.children[1].scale.setScalar(fl * (sp.quick ? 1.3 : 1)); }
        if (!G.headless && vrand() < dt * 30) FX.burst(q[0], 0.3, q[1], { n: 1, color: sp.quick ? 0xffffff : 0xffc060, speed: [1, 4], up: 2, life: [0.15, 0.4], size: [0.08, 0.2] });
        if (sp.fork && !sp.forked && sp.s >= sp.fork.atS) { sp.forked = true; const left = Math.max(0.5, sp.vol.arrive - G.now); S.mortars[sp.fork.to].armed = true; addSpark(S, { P: sp.fork, to: sp.fork.to, speed: sp.fork.len / left, wait: 0, vol: sp.vol }); sp.vol.lit.push(sp.fork.to); Sound.sfx('tick', 0.8, 1.5); }
        // stamped out?
        if (fight && p && p.alive && sp.wait <= 0 && Math.hypot(p.pos.x - q[0], p.pos.z - q[1]) < 1.15 && p.pos.y < 1.2) { sp.alive = false; if (sp.m) sp.m.visible = false; if (sp.to >= 0) S.mortars[sp.to].armed = S.sparks.some((o) => o.alive && o.to === sp.to); Sound.sfx('steam', 0.9, 2.2); if (!G.headless) FX.burst(q[0], 0.3, q[1], { n: 14, color: 0x9a9088, speed: [1, 4], up: 3, life: [0.4, 0.9], size: [0.3, 0.6], smoke: true }); continue; }
        if (sp.s >= sp.P.len) { sp.alive = false; if (sp.m) sp.m.visible = false;
          if (sp.big) { Sound.sfx('bigboom', 1, 0.5); const sm = { x0: 0, z0: 0, x1: 0, z1: 0, t: 0, type: 'big', col: GOLD, k: -1, m: S.shellPool.find((o) => !o.visible) }; if (sm.m) { sm.m.visible = true; sm.m.material.color.setHex(GOLD).multiplyScalar(4); } S.shells.push(sm); }
          else launch(b, sp.to, sp.vol); }
      }
      for (let i = S.shells.length - 1; i >= 0; i--) {
        const sh = S.shells[i]; sh.t += dt / 1.2; const k = Math.min(1, sh.t), e = 1 - (1 - k) * (1 - k);
        if (sh.m) sh.m.position.set(lerp(sh.x0, sh.x1, e), 1.5 + e * 28.5, lerp(sh.z0, sh.z1, e));
        if (sh.t >= 1) { if (sh.m) sh.m.visible = false; S.shells.splice(i, 1);
          if (sh.type === 'big') { skyBurst(S, 0, 36, 0, 'big', GOLD); FX.flash(GOLD, 0.2, 2); Hz.circle(0, 0, R + 2, 1.6, 600, { name: 'Dragon Shell', color: GOLD, blockable: false, tag: 'fight', onFire() { Sound.sfx('bigboom', 1, 0.4); FX.shake(1); } }); }
          else if (fight) burst(b, sh); }
      }
      S.mortars.forEach((m, k) => { m.kick = Math.max(0, m.kick - dt * 3); const base = TYPES[S.types[k]]; m.bm.color.setHex(base).multiplyScalar(m.armed ? 1.6 + Math.sin(t * 9) * 1.0 : 0.55); });
      // lanterns
      if (!G.headless) { for (let i = 0; i < S.NL; i++) { const L = S.lan[i]; L.y += L.v * dt; if (L.y > 95) L.y = -2; const a = L.a + Math.sin(t * 0.1 + L.ph) * 0.05; _m.position.set(Math.sin(a) * L.d + Math.sin(t * 0.4 + L.ph) * 1.5, L.y, Math.cos(a) * L.d); _m.rotation.set(0, L.ph, Math.sin(t * 0.7 + L.ph) * 0.1); _m.scale.setScalar(L.s); _m.updateMatrix(); S.skyLan.setMatrixAt(i, _m.matrix); } S.skyLan.instanceMatrix.needsUpdate = true; }
      // Nian
      if (S.stun > 0) { S.stun -= dt; b.dmgTaken = 1.5; } else b.dmgTaken = 1;
      S.stars.visible = S.stun > 0; S.stars.rotation.z = t * 5;
      S.jawK = damp(S.jawK, S.jawOpen ? 1 : (b.castState ? 0.4 : 0.1 + Math.max(0, Math.sin(t * 3)) * 0.15), 10, dt); S.jaw.rotation.x = S.jawK * 0.7;
      S.spin = Math.max(0, (S.spin || 0) - dt * 2.2);
      S.head.position.y = 2.3 + (S.hopY || 0) + Math.sin(t * 5) * 0.08; S.head.rotation.z = S.stun > 0 ? Math.sin(t * 22) * 0.2 : Math.sin(t * 2.5) * 0.08; S.head.rotation.y = S.spin * TAU;
      const hx = b.pos.x, hz = b.pos.z, last = S.path[0]; if (!last || Math.hypot(hx - last[0], hz - last[1]) > 0.25) { S.path.unshift([hx, hz]); if (S.path.length > 60) S.path.length = 60; S.walk += 1.2; }
      S.segs.forEach((s, i) => { // body follows the path the head took
        const want = (i + 1) * 1.7; let acc = 0, px = hx, pz = hz, tx = hx - Math.sin(b.facing) * want, tz = hz - Math.cos(b.facing) * want;
        for (const pt of S.path) { const d = Math.hypot(pt[0] - px, pt[1] - pz); if (acc + d >= want) { const k = (want - acc) / (d || 1); tx = lerp(px, pt[0], k); tz = lerp(pz, pt[1], k); acc = want; break; } acc += d; px = pt[0]; pz = pt[1]; }
        if (acc < want) { const rem = want - acc; tx = px - Math.sin(b.facing) * rem; tz = pz - Math.cos(b.facing) * rem; }
        const prev = i ? S.segs[i - 1].position : _a.set(hx, 0, hz); s.position.set(tx, (S.hopY || 0) * Math.max(0, 1 - (i + 1) * 0.22) + Math.sin(t * 5 - i) * 0.06, tz); s.rotation.y = Math.atan2(prev.x - tx, prev.z - tz) + S.spin * TAU * (1 - i * 0.1);
        s.legs.forEach((h, j) => { h.rotation.x = Math.sin(S.walk * 0.9 + i * 1.3 + j * PI) * 0.6; }); s.visible = !S.dead || true; });
      S.light.intensity = 30 + S.jawK * 40;
    },
    bot(b, p) {
      const S = b.state, V = S.vol, q = [0, 0]; let best = null, bd = 1e9;
      const want = (sp) => sp.alive && sp.wait <= 0 && (sp.big || (V && V.stamp.includes(sp.to)) || (sp.fork && !sp.forked && V && V.stamp.includes(sp.fork.to)));
      for (const sp of S.sparks) { if (!want(sp)) continue; at(sp.P, sp.s + sp.speed * 0.5, q); const d = Math.hypot(q[0] - p.pos.x, q[1] - p.pos.z) - (sp.big ? 6 : 0); if (d < bd) { bd = d; best = [q[0], q[1]]; } }
      if (best && !(V && V.land - G.now < 2.2)) return { x: best[0], z: best[1], w: 5 };
      if (V && V.safe && G.now > V.arrive - 1.5 && G.now < V.land) { let s = null, sd = 1e9; for (const c of V.safe) { const d = Math.hypot(c[0] - p.pos.x, c[1] - p.pos.z) + Math.hypot(c[0] - b.pos.x, c[1] - b.pos.z) * 0.2; if (d < sd) { sd = d; s = c; } } if (s) return { x: s[0], z: s[1], w: 3 }; }
      return {};
    },
  });
})();
