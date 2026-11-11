// DOOR XVII: THE HOROLOGIST, the Thirteenth Hour. You fight on the face of a colossal clock. The hands are real,
// and they strike where they WILL be when the bell tolls, not where they are. Time here is his to wind, reverse and stop.
(() => {
  const R = 20, GOLD = 0xffc860, BLUE = 0x7fc4ff, RED = 0xff4a3a, TEL = 0xffb040;
  const HANDS = { min: { len: 19.4, hw: 0.55, w: 0.2094, r0: 2.8, arc: 0.5236, dmg: 420 }, hour: { len: 11.2, hw: 0.9, w: 0.0349, r0: 2.8, arc: 0.7854, dmg: 380 }, sec: { len: 19.4, hw: 0.28, w: 1.0472, r0: 2.8 } };
  const c2a = (c) => PI - c, a2c = (a) => PI - a; // clock angle (clockwise from XII, which is north = -Z) <-> world angle
  const _c = new THREE.Color(), _v = new V3(), _w = new V3();
  const eff = (S) => S.stop ? 0 : S.flow * S.base * S.ff;

  function gearMesh(r, teeth, mat, thick) {
    const sh = new THREE.Shape(), n = teeth * 4;
    for (let i = 0; i <= n; i++) { const a = i / n * TAU, rr = (i % 4 < 2) ? r : r * 0.86; if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.62, 0, TAU, true); sh.holes.push(hole);
    const g = new THREE.Group(), m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: 20 }), mat); m.position.z = -thick / 2; g.add(m);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.3, r * 0.1, thick * 0.6), mat); sp.rotation.z = i / 3 * PI; g.add(sp); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, thick * 1.4, 14), mat); hub.rotation.x = PI / 2; g.add(hub);
    return g;
  }
  function faceTexture() {
    const N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d'), h = N / 2, u = N / (2 * R);
    const gr = x.createRadialGradient(h, h, 0, h, h, h); gr.addColorStop(0, '#f6efd9'); gr.addColorStop(0.72, '#ece2c4'); gr.addColorStop(1, '#cdbf98'); x.fillStyle = gr; x.fillRect(0, 0, N, N);
    x.strokeStyle = '#6a4a1c'; x.lineWidth = 5; for (const r of [19.3, 14.2, 3.4]) { x.beginPath(); x.arc(h, h, r * u, 0, TAU); x.stroke(); }
    x.lineWidth = 1.5; x.strokeStyle = 'rgba(106,74,28,0.45)'; for (const r of [8.8, 11.6]) { x.beginPath(); x.arc(h, h, r * u, 0, TAU); x.stroke(); }
    for (let i = 0; i < 60; i++) { const c = i / 60 * TAU; x.save(); x.translate(h, h); x.rotate(c); x.fillStyle = '#3a2a14'; if (i % 5 === 0) x.fillRect(-4, -19.3 * u, 8, 1.5 * u); else x.fillRect(-1.5, -19.3 * u, 3, 0.7 * u); x.restore(); }
    for (let i = 0; i < 12; i++) { x.save(); x.translate(h, h); x.rotate(i / 12 * TAU + PI / 12); x.fillStyle = 'rgba(106,74,28,0.22)'; x.fillRect(-1, -14.2 * u, 2, 10.8 * u); x.restore(); }
    const NUM = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']; x.fillStyle = '#2a1c0c'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 62px Georgia, "Times New Roman", serif';
    for (let i = 0; i < 12; i++) { x.save(); x.translate(h, h); x.rotate(i / 12 * TAU); x.fillText(NUM[i], 0, -16.6 * u); x.restore(); }
    // a compass rose of filigree at the hub
    for (let i = 0; i < 24; i++) { x.save(); x.translate(h, h); x.rotate(i / 24 * TAU); x.fillStyle = i % 2 ? 'rgba(160,110,40,0.5)' : 'rgba(60,40,16,0.6)'; x.beginPath(); x.moveTo(0, -8.6 * u); x.lineTo(0.5 * u, -3.6 * u); x.lineTo(-0.5 * u, -3.6 * u); x.fill(); x.restore(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function textTexture(str, color) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 96px Georgia, "Times New Roman", serif'; x.fillText(str, 128, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x04050e, horizon: 0x1a2244, bottom: 0x02030a, stars: 1.7, nebula: 0.7, nebulaA: 0x40308a, nebulaB: 0x105088, sunSize: 0, sunGlow: 0, exp: 0.7 });
    g.add(sky); S.sky = sky; W.env(sky, 1.0);
    scene.fog = new THREE.FogExp2(0x070a18, 0.004); S.fog = scene.fog;
    S.hemi = W.hemi(g, 0x8c9cd0, 0x3a2a14, 0.95);
    S.sun = W.sun(g, { dir: [0.25, 1, 0.35], color: 0xffe4b8, intensity: 2.5, size: 30 });
    S.faceM = new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.38, metalness: 0.05, envMapIntensity: 0.6, color: 0xd6cfc0 });
    const face = new THREE.Mesh(new THREE.CircleGeometry(R, 96), S.faceM); face.rotation.x = -PI / 2; face.receiveShadow = true; g.add(face);
    const brass = W.mat({ color: 0xb8893c, roughness: 0.3, metalness: 0.95 }), dkbrass = W.mat({ color: 0x6a4a20, roughness: 0.45, metalness: 0.9 }), steel = W.mat({ color: 0x2a3348, roughness: 0.3, metalness: 0.9 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.55, 10, 96), brass); rim.rotation.x = PI / 2; rim.position.y = 0.2; rim.castShadow = true; g.add(rim);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.8, R - 2, 9, 64, 1, true), dkbrass); skirt.position.y = -4.6; g.add(skirt);
    // the movement: gears turning all around, at the speed and in the direction time is flowing
    S.gears = []; const gr = mulberry(17);
    for (const [r, x, y, z, t] of [[31, 10, -3.2, 6, 30], [22, -30, -5, -22, 24]]) { const m = gearMesh(r, t, dkbrass, 1.4); m.rotation.x = PI / 2; m.position.set(x, y, z); g.add(m); S.gears.push({ m, k: 0.22 * (S.gears.length % 2 ? -1 : 1), flat: true }); }
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.4, d = 30 + gr() * 16, r = 5 + gr() * 11, m = gearMesh(r, Math.round(r * 2.2), i % 3 ? brass : steel, 0.9 + r * 0.06); m.position.set(Math.sin(a) * d, 2 + gr() * 22, Math.cos(a) * d); m.rotation.y = a + (gr() - 0.5) * 0.5; g.add(m); S.gears.push({ m, k: (i % 2 ? 1 : -1) * 4.4 / r }); }
    S.pend = new THREE.Group(); S.pend.position.set(0, 44, -6); g.add(S.pend);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 34, 8), brass); rod.position.y = -17; S.pend.add(rod);
    const bob = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.7, 40), brass); bob.rotation.x = PI / 2; bob.position.y = -34; bob.castShadow = true; S.pend.add(bob);
    S.motes = W.motes({ n: 260, box: [60, 26, 60], color: 0xffe0a0, size: 0.16, vel: [0.1, 0.25, 0.05], sway: 0.6, center: [0, 12, 0], alpha: 0.5 }); g.add(S.motes);
    // the hands
    S.hand = {};
    for (const k of ['hour', 'min', 'sec']) {
      const H = HANDS[k], gp = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: k === 'sec' ? 0x5a1410 : 0x161c2c, roughness: 0.28, metalness: 0.9, emissive: k === 'sec' ? RED : GOLD, emissiveIntensity: 0.08 });
      const L = H.len - H.r0, y = k === 'hour' ? 0.26 : k === 'min' ? 0.34 : 0.42;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(H.hw * 2, 0.22, L - 1.6), mat); bar.position.set(0, y, H.r0 + (L - 1.6) / 2); bar.castShadow = true; gp.add(bar);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(H.hw * (k === 'hour' ? 1.9 : 1.6), 1.9, 4), mat); tip.rotation.x = PI / 2; tip.scale.z = 0.14 / (H.hw * 1.6); tip.position.set(0, y, H.len - 0.9); gp.add(tip);
      if (k !== 'sec') { const eye = new THREE.Mesh(new THREE.TorusGeometry(H.hw * 1.5, H.hw * 0.4, 6, 18), mat); eye.rotation.x = PI / 2; eye.position.set(0, y, H.len * (k === 'hour' ? 0.62 : 0.7)); eye.scale.z = 0.3; gp.add(eye); }
      const tail = new THREE.Mesh(new THREE.BoxGeometry(H.hw * 1.2, 0.2, 2.2), mat); tail.position.set(0, y, 2.2); gp.add(tail);
      gp.visible = k !== 'sec'; g.add(gp); S.hand[k] = { H, g: gp, mat, c: k === 'min' ? 2.3 : k === 'hour' ? 5.1 : 0.4, cd: 0, on: k !== 'sec' };
    }
    S.pipM = [0, 1, 2, 3, 4, 5].map((i) => { const m = W.glow(GOLD, 0.2), s = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), m); s.position.set(0, 0.62, 4.0 + i * 1.05); S.hand.hour.g.add(s); return m; });
    S.xiii = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.7), new THREE.MeshBasicMaterial({ map: textTexture('XIII', '#ff5a30'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }));
    { const c = PI / 12, a = c2a(c); S.xiii.position.set(Math.sin(a) * 12.9, 0.06, Math.cos(a) * 12.9); S.xiii.rotation.order = 'YXZ'; S.xiii.rotation.set(-PI / 2, -c, 0); S.xiii.visible = false; S.xiii.renderOrder = 4; g.add(S.xiii); }
    S.crack = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({ color: 0xff5a30, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: W.bake(256, (u, v) => { const dx = u - 0.5, dz = v - 0.5, a = Math.atan2(dx, dz), d = Math.hypot(dx, dz), k = Math.abs(Math.sin(a * 6.5 + Math.sin(d * 23) * 0.9 + d * 4)); const l = k < 0.035 && d > 0.05 ? 1 : 0; return [l, l, 1]; }, { dark: 0x000000, light: 0xffffff }).map }));
    S.crack.rotation.x = -PI / 2; S.crack.position.y = 0.045; S.crack.renderOrder = 3; g.add(S.crack);
    // hourglass over the player's head and the anchor they will be pulled back to
    S.glassM = new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD).multiplyScalar(1.6), transparent: true, opacity: 0.85, depthWrite: false });
    S.glass = new THREE.Group(); for (const s of [1, -1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 10), S.glassM); c.position.y = s * 0.22; c.rotation.x = s > 0 ? PI : 0; S.glass.add(c); } S.glass.visible = false; g.add(S.glass);
    S.anchorG = new THREE.Group(); const ar = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 40), S.glassM); ar.rotation.x = -PI / 2; ar.position.y = 0.07; S.anchorG.add(ar); const ag = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.0, 4, 8), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3, depthWrite: false })); ag.position.y = 1.0; S.anchorG.add(ag); S.anchorG.visible = false; g.add(S.anchorG);
    // ---- the Horologist ----
    const bg = b.group, coat = W.mat({ color: 0x141a30, roughness: 0.7, metalness: 0.2 });
    S.rig = new THREE.Group(); bg.add(S.rig);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.55, 4.3, 16, 1, true), coat); robe.position.y = 2.15; robe.castShadow = true; robe.material.side = THREE.DoubleSide; S.rig.add(robe);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.09, 6, 30), brass); hem.rotation.x = PI / 2; hem.position.y = 0.06; S.rig.add(hem);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.72, 0.9, 4, 12), brass); torso.position.y = 4.7; torso.castShadow = true; S.rig.add(torso);
    S.dialM = W.glow(0xfff4d8, 1.4); const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.1, 24), S.dialM); dial.rotation.x = PI / 2; dial.position.set(0, 4.75, 0.7); S.rig.add(dial);
    const dr = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 6, 24), dkbrass); dr.position.set(0, 4.75, 0.74); S.rig.add(dr);
    S.dh = [0.44, 0.3].map((l, i) => { const p = new THREE.Group(); p.position.set(0, 4.75, 0.78); const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, l, 0.03), new THREE.MeshBasicMaterial({ color: 0x100804 })); m.position.y = l / 2; p.add(m); S.rig.add(p); return p; });
    S.head = new THREE.Group(); S.head.position.y = 6.05; S.rig.add(S.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10), brass); S.head.add(skull);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 20), coat); brim.position.y = 0.36; S.head.add(brim); const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.95, 16), coat); hat.position.y = 0.85; S.head.add(hat);
    S.eyeM = W.glow(GOLD, 5); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), S.eyeM); eye.position.set(0.17, 0.06, 0.4); S.head.add(eye); const mono = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), dkbrass); mono.position.set(0.17, 0.06, 0.42); S.head.add(mono);
    S.arms = [];
    for (const [sx, y, l] of [[1, 5.25, 2.0], [-1, 5.25, 2.0], [1, 4.5, 1.7], [-1, 4.5, 1.7]]) { const p = new THREE.Group(); p.position.set(sx * 0.85, y, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, l, 3, 6), dkbrass); a.position.y = -l / 2; p.add(a); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), brass); hd.position.y = -l - 0.1; p.add(hd); p.rotation.z = sx * 0.5; S.rig.add(p); S.arms.push({ p, sx }); }
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.42, 0.55, 12, 1, true), brass); bell.position.y = -2.45; bell.material.side = THREE.DoubleSide; S.arms[0].p.add(bell);
    const ham = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.5), steel); ham.position.y = -2.4; S.arms[1].p.add(ham);
    S.halo = new THREE.Group(); S.halo.position.y = 3.2; bg.add(S.halo); const hr = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.04, 6, 60), brass); hr.rotation.x = PI / 2; S.halo.add(hr);
    for (let i = 0; i < 12; i++) { const tk = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3 + (i % 3 ? 0 : 0.2), 0.07), brass); const a = i / 12 * TAU; tk.position.set(Math.sin(a) * 2.3, 0, Math.cos(a) * 2.3); S.halo.add(tk); }
    S.light = new THREE.PointLight(GOLD, 24, 30, 1.6); S.light.position.set(0, 6.5, 0); bg.add(S.light);
    Object.assign(S, { flow: 1, flowT: 1, base: 1, ff: 1, stop: false, stopLeft: 0, pred: null, tollIn: 0, pips: 0, snap: null, anchor: null, glassOn: 0, armUp: 0, lvl: 0, look: 0, lookT: 0, pendA: 0, tickT: 0, crackK: 0 });
    return {
      edge: 'wall', radius: R, spawn: { x: 0, z: 13 }, bossStart: { x: 0, z: 0, face: 0 }, camDist: 17, camPitch: 0.5,
      contains: (x, z) => Math.hypot(x, z) <= R - 0.6, bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      solid(p) { const d = Math.hypot(p.x, p.z); if (d < 2.0 && d > 1e-3) { p.x *= 2.0 / d; p.z *= 2.0 / d; } },
    };
  }

  // where will this hand be in `t` seconds if he changes the flow to `target` after `wait`?
  function predict(S, k, T, target, wait) { let f = S.flow, c = S.hand[k].c; const dt = 1 / 60; for (let t = 0; t < T; t += dt) { f = damp(f, t >= wait ? target : S.flowT, 4, dt); c += HANDS[k].w * f * S.base * S.ff * dt; } return c; }
  function toll(b) { const S = b.state; Sound.sfx('parry', 0.9, 0.35); Sound.sfx('bigboom', 0.5); FX.flash(GOLD, 0.2, 2.5); FX.shake(0.6); }

  function* strike(b, mode) {
    const S = b.state, T = 3.3, wait = 0.9, target = mode === 'wind' ? 3 : mode === 'reverse' ? -1.7 : 1; let armed = false, ticks = 0, wound = false;
    S.armUp = 1; S.tollIn = T; S.pred = ['min', 'hour'].map((k) => ({ c: predict(S, k, T, target, wait), arc: HANDS[k].arc, r: HANDS[k].len + 0.6, k }));
    yield* b.cast({ name: 'The Hour Strikes', time: T, onTick(k, cs) {
      if (cs.t >= wait && !wound) { wound = true; S.flowT = target; if (mode !== 'steady') { Sound.sfx(mode === 'wind' ? 'charge' : 'interrupt', 0.7, mode === 'wind' ? 1.5 : 0.5); FX.flash(mode === 'wind' ? GOLD : RED, 0.12, 3); } }
      if (cs.t >= ticks * (T / 4)) { ticks++; Sound.sfx('tick', 2.2, 0.55); Sound.sfx('hit', 0.5, 1.6); }
      if (cs.t >= T - 0.62 && !armed) {
        armed = true;
        for (const q of S.pred) { const H = HANDS[q.k], c = S.hand[q.k].c + H.w * eff(S) * (T - cs.t); q.c = c; const a = c2a(c);
          Hz.cone(0, 0, a, q.arc, q.r, T - cs.t, H.dmg, { name: 'The Hour Strikes', quiet: true, silent: true, onFire() { if (!G.headless) { FX.beam(new V3(0, 1, 0), new V3(Math.sin(a) * q.r, 1, Math.cos(a) * q.r), { color: GOLD, width: 1.6, dur: 0.4 }); FX.burst(Math.sin(a) * q.r * 0.6, 0.5, Math.cos(a) * q.r * 0.6, { n: 40, color: GOLD, color2: 0xffffff, speed: [3, 12], life: [0.3, 0.9], radius: q.r * 0.35 }); } } }); }
      }
    } });
    toll(b); S.armUp = 0; S.pred = null; S.flowT = 1; yield 0.9;
  }
  function* chime(b) {
    const S = b.state, n = rndi(2, 6), T = n * 0.5 + 0.7, dir = S.base, to = S.hand.hour.c + n * (TAU / 12) * dir + HANDS.hour.w * dir * T; let rung = 0;
    S.armUp = 1; S.pips = 0; S.tollIn = T + 0.85; S.pred = [{ c: to, arc: 1.0472, r: R + 1, k: 'hour' }];
    yield* b.cast({ name: 'Chime', time: T, onTick(k, cs) { if (rung < n && cs.t >= 0.15 + rung * 0.5) { rung++; S.pips = rung; S.bellK = 1; Sound.sfx('parry', 0.8, 0.5 + rung * 0.035); } } });
    S.armUp = 0; S.snap = { from: S.hand.hour.c, to, t: 0 }; Sound.sfx('dash', 0.8, 0.6); const a = c2a(to);
    Hz.cone(0, 0, a, 1.0472, R + 1, 0.85, 400, { name: 'Chime', quiet: true, onFire() { toll(b); S.pips = 0; if (!G.headless) FX.burst(Math.sin(a) * 11, 0.5, Math.cos(a) * 11, { n: 60, color: GOLD, color2: 0xffffff, speed: [3, 14], life: [0.3, 1.0], radius: 7 }); } });
    yield 0.85; S.pred = null; yield 0.7;
  }
  function* spring(b, inner) {
    const S = b.state; S.armUp = 0.6;
    if (inner) Hz.circle(0, 0, 7.6, 1.45, 320, { name: 'Mainspring' }); else Hz.donut(0, 0, 7.6, R + 1, 1.45, 320, { name: 'Balance Wheel' });
    yield* b.cast({ name: inner ? 'Mainspring' : 'Balance Wheel', time: 1.45 }); S.armUp = 0; yield 0.6;
  }
  function* escapement(b, n) {
    const S = b.state; S.armUp = 0.8; yield* b.cast({ name: 'Escapement', time: 0.8 });
    for (let i = 0; i < n; i++) { Bul.ring(0, 0, 18, 6.5, { v0: 6.5, esc: true, r: 0.42, dmg: 150, color: GOLD, life: 16 }, rnd(0, TAU), b.angToPlayer() + rnd(-0.9, 0.9), 0.75); Sound.sfx('bolt', 0.6, 0.7); yield 0.95; }
    S.armUp = 0; yield 0.4;
  }
  function* recall(b) {
    const S = b.state; yield 1.2; S.armUp = 1; yield* b.cast({ name: 'Recall', time: 1.0 }); S.armUp = 0; Sound.sfx('blink', 0.8, 0.6); FX.flash(BLUE, 0.12, 3);
    for (const q of Bul.list) if (q.esc && !q.rec) { q.rec = true; q.dir += PI; q.v0 *= 1.3; q.color = BLUE; q.life = q.t + 7; q.onUpdate = (o) => { if (Math.hypot(o.x, o.z) < 1.9) o.dead = true; }; }
    yield 1.6;
  }
  function setStop(b, on) {
    const S = b.state; if (S.stop === on) return; S.stop = on; b.dmgTaken = on ? 1.3 : 1;
    Co.start(Post.lerpTo({ sat: on ? 0.1 : 1.0, contrast: on ? 1.18 : 1.05 }, 0.25), 'fight'); Sound.sfx(on ? 'interrupt' : 'charge', 0.8, on ? 0.35 : 1.2); FX.flash(on ? 0xffffff : GOLD, 0.2, 4);
  }
  function wall(b, a) { // a row of bullets hanging at the rim, every one of them pointed across the face
    const px = Math.cos(a), pz = -Math.sin(a), off = rnd(0, 2.8);
    for (let i = -7; i <= 7; i++) { const l = i * 2.8 + off; if (Math.abs(l) > R - 0.6) continue; const back = Math.sqrt((R + 0.4) * (R + 0.4) - l * l); Bul.fire({ x: px * l - Math.sin(a) * back, z: pz * l - Math.cos(a) * back, dir: a, speed: 0, v0: 9.5, r: 0.42, dmg: 170, color: 0xd8ecff, life: 30 }); }
    Sound.sfx('tick', 2, 0.4);
  }
  function* stopped(b) {
    const S = b.state; S.armUp = 1; yield* b.cast({ name: 'Stopped Clock', time: 1.2 });
    Bul.ring(0, 0, 20, 7, { v0: 7, r: 0.42, dmg: 170, color: BLUE, life: 30 }, rnd(0, TAU)); Sound.sfx('bolt', 0.7, 0.6);
    yield 0.95; setStop(b, true); S.stopLeft = 4.3; const a = rnd(0, TAU);
    yield 0.7; wall(b, a); yield 1.2; wall(b, a + PI / 2 + rnd(-0.3, 0.3)); yield 2.4;
    setStop(b, false); S.armUp = 0; yield 2.8;
  }
  function* turnBack(b) {
    const S = b.state, p = G.player; S.glassOn = 1; Sound.sfx('shield', 0.7, 0.6);
    yield 1.5; S.anchor = { x: p.pos.x, z: p.pos.z }; Sound.sfx('uiok');
    for (let i = 0; i < 6; i++) { yield 1.0; if (i < 5) Hz.zone({ type: 'circle', x: p.pos.x, z: p.pos.z, r: 2.3 }, 7, 70, { name: 'Sand', color: GOLD, delay: 0.8 }); }
    if (p.alive && S.anchor) { if (!G.headless) { FX.beam(new V3(p.pos.x, 1.2, p.pos.z), new V3(S.anchor.x, 1.2, S.anchor.z), { color: GOLD, width: 0.6, dur: 0.4 }); FX.ring(S.anchor.x, S.anchor.z, { r0: 3, r1: 0.5, color: GOLD, dur: 0.35 }); } p.pos.x = S.anchor.x; p.pos.z = S.anchor.z; p.casting = null; p.dash = null; p.kb = null; Sound.sfx('blink', 0.9, 0.7); }
    S.anchor = null; S.glassOn = 0;
  }
  function* flip(b) {
    const S = b.state; S.armUp = 1; yield* b.cast({ name: 'Counterclockwise', time: 1.4 }); S.base = -S.base; S.armUp = 0; Sound.sfx('interrupt', 0.9, 0.4); Sound.sfx('shatter', 0.5, 0.5); FX.flash(S.base < 0 ? RED : GOLD, 0.2, 3); FX.shake(0.4); yield 0.8;
  }
  function burst(b, v) { const S = b.state; Co.start(function* () { S.ff = v; Sound.sfx(v > 1 ? 'charge' : 'wave', 0.7, v > 1 ? 1.8 : 0.4); yield 6; S.ff = 1; }, 'phase'); }
  function setLvl(b, n) {
    const S = b.state; S.lvl = n; S.lookT = n; S.flowT = 1; S.ff = 1; if (n < 2) S.base = 1; setStop(b, false); b.dmgTaken = 1;
    Object.assign(S, { pred: null, pips: 0, anchor: null, glassOn: 0, armUp: 0 }); S.hand.sec.on = n >= 2; S.hand.sec.g.visible = n >= 2; S.xiii.visible = n >= 2;
  }

  G.bosses.push({
    id: 'clock', name: 'THE HOROLOGIST', title: 'The Thirteenth Hour', hint: 'A matter of time', color: '#ffd27a', telegraph: TEL,
    hp: 29000, radius: 1.6, aimY: 4.3, enrage: 450,
    post: { bloom: 0.5, threshold: 0.86, radius: 0.7, exposure: 1.02, vig: 1.0, sat: 1.0, contrast: 1.05, tint: [1.04, 1.0, 0.94] },
    music: { bpm: 120, root: 41, scale: [0, 2, 3, 5, 7, 8, 11], prog: [0, 0, 3, 4, 0, 0, 5, 4],
      layers: [
        { v: 'hat', pat: 'x...x...x...x...', vol: 0.07 }, { v: 'bell', pat: ['0.......4.......', '2.......7.......'], oct: 1, len: 6, vol: 0.07 }, { v: 'bass', pat: '0.......0...4...', oct: -1, len: 3, vol: 0.12 }, { v: 'pad', pat: '0...............', len: 16, vol: 0.08 },
        { v: 'pulse', from: 1, pat: '0.2.4.2.0.2.4.7.', oct: 0, len: 1, vol: 0.05 }, { v: 'kick', from: 1, pat: 'x.......x.......', vol: 0.22 }, { v: 'hat', from: 1, pat: '..x...x...x...x.', vol: 0.05 }, { v: 'organ', from: 1, pat: ['0.......3.......', '4.......2.......'], len: 8, vol: 0.06 },
        { v: 'arp', from: 2, pat: '0247024702470247', oct: 1, len: 1, vol: 0.045 }, { v: 'taiko', from: 2, pat: 'x..x..x.x..x..xx', vol: 0.2 }, { v: 'choir', from: 2, pat: '0.......4.......', oct: 1, len: 8, vol: 0.07 }, { v: 'brass', from: 2, pat: ['0...........4...', '5.......4.......'], len: 6, vol: 0.09 },
      ] },
    build,
    *intro(b) { Sound.sfx('parry', 0.7, 0.35); yield* Cam.shot([15, 26, 22], [0, 2, 0], [5, 5.5, 9.5], [0, 4.6, 0], 5.2, 46); },
    phases: [
      { at: 1, *run(b) {
        setLvl(b, 0); yield 1.2;
        yield* strike(b, 'steady'); yield* spring(b, true); yield* chime(b);
        while (true) {
          yield* escapement(b, 2); yield* strike(b, 'wind'); yield* spring(b, false); yield* chime(b);
          yield* strike(b, 'reverse'); yield* escapement(b, 2); yield* spring(b, true); yield* strike(b, 'steady'); yield* chime(b);
        }
      } },
      { at: 0.66, skipTo(b) { b.state.look = 1; }, *enter(b) {
        const S = b.state; setLvl(b, 0); S.lookT = 1; S.armUp = 1; S.flowT = 0;
        yield* b.cast({ name: 'The Glass Cracks', time: 3.0, onTick: (k) => { FX.shake(k * 0.35); } });
        S.armUp = 0; S.flowT = 1; Sound.sfx('shatter', 1, 0.5); Sound.sfx('bigboom', 0.6); FX.flash(BLUE, 0.4, 1.4);
        Co.start(Post.lerpTo({ tint: [0.96, 1.0, 1.08], bloom: 0.56 }, 3), 'fight'); yield 1.2;
      }, *run(b) {
        setLvl(b, 1);
        while (true) {
          yield* stopped(b); Co.start(turnBack(b), 'phase'); yield 1.6; yield* strike(b, 'wind'); yield 2.6;
          yield* escapement(b, 2); yield* recall(b); yield* chime(b); yield* spring(b, true);
          yield* stopped(b); Co.start(turnBack(b), 'phase'); yield 1.6; yield* chime(b); yield 2.2; yield* strike(b, 'reverse'); yield* spring(b, false);
        }
      } },
      { at: 0.33, skipTo(b) { b.state.look = 2; }, *enter(b) {
        const S = b.state; setLvl(b, 1); S.lookT = 2; S.armUp = 1;
        yield* b.cast({ name: 'The Thirteenth Hour', time: 3.2, onTick: (k) => { FX.shake(k * 0.5); S.crackK = k; } });
        S.armUp = 0; setLvl(b, 2); for (let i = 0; i < 13; i++) Sound.sfx('parry', 0.5, 0.3 + i * 0.02); Sound.sfx('bigboom', 0.9); FX.flash(RED, 0.45, 1.2);
        Co.start(Post.lerpTo({ tint: [1.1, 0.94, 0.98], bloom: 0.6, contrast: 1.1 }, 3), 'fight'); yield 1.4;
      }, *run(b) {
        setLvl(b, 2);
        while (true) {
          yield* strike(b, pick(['wind', 'steady'])); yield* flip(b); burst(b, 1.6); yield* escapement(b, 2); yield* recall(b);
          Co.start(turnBack(b), 'phase'); yield 1.2; yield* chime(b); yield* strike(b, 'reverse'); yield 1.5;
          yield* stopped(b); burst(b, 0.5); yield* spring(b, rnd() < 0.5); yield* chime(b); yield* flip(b); yield* strike(b, 'wind');
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now, fight = G.state === 'fight' && p && p.alive;
      S.flow = damp(S.flow, S.flowT, 4, dt); const e = eff(S);
      if (S.tollIn > 0) S.tollIn -= dt; if (S.stopLeft > 0) S.stopLeft -= dt;
      for (const k in S.hand) { const h = S.hand[k]; if (!h.on) continue; h.c += h.H.w * e * dt; if (h.cd > 0) h.cd -= dt; }
      if (S.snap) { const q = S.snap; q.t += dt; S.hand.hour.c = lerp(q.from, q.to, smooth(q.t / 0.22)); if (q.t >= 0.22) { S.hand.hour.c = q.to; S.snap = null; } }
      // the hands sweep the floor: a low wall that can be hopped
      if (fight) for (const k in S.hand) {
        const h = S.hand[k], H = h.H; if (!h.on || h.cd > 0 || p.pos.y > 0.55) continue;
        const a = c2a(h.c), sx = Math.sin(a), cz = Math.cos(a), al = p.pos.x * sx + p.pos.z * cz, pe = p.pos.x * cz - p.pos.z * sx;
        if (al > H.r0 && al < H.len && Math.abs(pe) < H.hw + 0.35) { h.cd = 0.9; const sg = e < 0 ? -1 : 1; p.hurt(150, { blockable: true, kb: { dir: a - sg * PI / 2, dist: 3 }, src: { name: k === 'sec' ? 'Second Hand' : k === 'min' ? 'Minute Hand' : 'Hour Hand' } }); }
      }
      // his time, not yours: bullets move at the speed the clock is running
      const bf = S.stop ? 0 : S.ff; for (const q of Bul.list) if (q.v0 !== undefined) q.speed = q.v0 * bf;
      // ---- cosmetics ----
      if (G.headless) return;
      for (const k in S.hand) { const h = S.hand[k]; h.g.rotation.y = c2a(h.c); const hot = S.stop ? BLUE : e < -0.2 ? RED : GOLD; h.mat.emissive.setHex(k === 'sec' && !S.stop ? RED : hot); h.mat.emissiveIntensity = 0.06 + Math.min(0.5, Math.abs(e - 1) * 0.22) + (S.pred && k !== 'sec' ? 0.22 + Math.sin(t * 16) * 0.12 : 0); }
      S.pipM.forEach((m, i) => m.color.setHex(GOLD).multiplyScalar(i < S.pips ? 4 : 0.05));
      for (const q of S.gears) { if (q.flat) q.m.rotation.z += q.k * e * dt; else q.m.rotation.z += q.k * e * dt; }
      S.pendA += dt * 1.7 * e; S.pend.rotation.z = Math.sin(S.pendA) * 0.42;
      S.tickT -= dt * Math.abs(e); if (S.tickT <= 0 && G.state === 'fight') { S.tickT = 0.5; Sound.sfx('tick', 0.9, e < 0 ? 0.7 : 1); }
      S.look = damp(S.look, S.lookT, 0.6, dt); const k1 = sat(S.look), k2 = sat(S.look - 1), U = S.sky.material.uniforms;
      U.uNebA.value.setHex(0x40308a).lerp(_c.setHex(0x2a50a8), k1).lerp(_c.setHex(0xa02a30), k2); U.uNebB.value.setHex(0x105088).lerp(_c.setHex(0x1a80a0), k1).lerp(_c.setHex(0x80301a), k2); U.uHor.value.setHex(0x1a2244).lerp(_c.setHex(0x402028), k2);
      S.crackK = damp(S.crackK, k2 > 0.3 ? 1 : k1 * 0.35, 2, dt); S.crack.material.opacity = S.crackK * (0.16 + (S.lvl >= 2 ? 0.14 + Math.sin(t * 2.2) * 0.06 : 0)); S.crack.material.color.setHex(S.lvl >= 2 ? 0xff5a30 : 0x9fd0ff);
      S.xiii.material.color.setScalar(1.2 + Math.sin(t * 3) * 0.4);
      S.sun.color.setHex(0xffe4b8).lerp(_c.setHex(0xd8e4ff), k1).lerp(_c.setHex(0xffc0a0), k2); S.hemi.color.setHex(0x8c9cd0).lerp(_c.setHex(0xb08090), k2);
      const pl = p && p.pos; S.glass.visible = S.glassOn > 0 && !!pl; if (S.glass.visible) { S.glass.position.set(pl.x, pl.y + 2.9, pl.z); S.glass.rotation.z = S.anchor ? t * 2.5 : 0; S.glass.rotation.y = t; }
      S.anchorG.visible = !!S.anchor; if (S.anchor) { S.anchorG.position.set(S.anchor.x, 0, S.anchor.z); S.anchorG.rotation.y = t * 1.5; }
      S.armK = damp(S.armK || 0, S.armUp, 6, dt); S.bellK = Math.max(0, (S.bellK || 0) - dt * 4);
      S.arms.forEach((q, i) => { q.p.rotation.z = q.sx * (0.5 + S.armK * (i < 2 ? 2.0 : 0.7) + Math.sin(t * 1.3 + i) * 0.06); q.p.rotation.x = i === 1 ? -S.bellK * 0.9 : Math.sin(t * 0.9 + i * 2) * 0.1; });
      S.rig.position.y = 0.25 + Math.sin(t * 1.4) * 0.12; S.head.rotation.y = Math.sin(t * 0.7) * 0.25; S.halo.rotation.y += dt * 0.5 * e; S.halo.position.y = 3.2 + Math.sin(t * 1.1) * 0.15;
      S.dh[0].rotation.z = -S.hand.min.c; S.dh[1].rotation.z = -S.hand.hour.c;
      S.eyeM.color.setHex(S.stop ? BLUE : e < -0.2 ? RED : GOLD).multiplyScalar(5 + (b.castState ? 3 : 0)); S.dialM.color.setHex(S.stop ? 0xd8ecff : 0xfff4d8).multiplyScalar(1.4 + (b.castState ? 0.8 : 0)); S.light.intensity = 24 + (b.castState ? 22 : 0); S.light.color.setHex(S.stop ? BLUE : S.lvl >= 2 ? 0xff9a70 : GOLD);
    },
    danger(b, x, z) {
      const S = b.state, r = Math.hypot(x, z), c = a2c(Math.atan2(x, z)), e = eff(S); let best = Infinity;
      if (S.pred && S.tollIn > -0.2) for (const q of S.pred) if (r <= q.r && Math.abs(wrapPi(c - q.c)) < q.arc / 2 + 0.07) best = Math.min(best, Math.max(0.05, S.tollIn));
      for (const k in S.hand) { const h = S.hand[k], H = h.H; if (!h.on || r < H.r0 - 0.4 || r > H.len + 0.4) continue; const w = H.w * e, half = (H.hw + 0.7) / Math.max(r, 1); if (Math.abs(w) < 1e-4) { if (Math.abs(wrapPi(c - h.c)) < half) best = 0.05; continue; } const gap = wrapPi(c - h.c) * Math.sign(w); if (gap > -half && gap < half + Math.abs(w) * 1.1) best = Math.min(best, Math.max(0.05, (gap - half) / Math.abs(w))); }
      if (S.stop) for (const q of Bul.list) { if (q.v0 === undefined) continue; const vx = Math.sin(q.dir) * q.v0, vz = Math.cos(q.dir) * q.v0, rx = x - q.x, rz = z - q.z, k = clamp((rx * vx + rz * vz) / (q.v0 * q.v0), 0, 3.5); if (Math.hypot(rx - vx * k, rz - vz * k) < q.r + 0.85) best = Math.min(best, Math.max(0.05, S.stopLeft + k)); }
      return best;
    },
    bot(b, p) {
      const S = b.state, r = Math.hypot(p.pos.x, p.pos.z), c = a2c(Math.atan2(p.pos.x, p.pos.z)), e = eff(S);
      for (const k in S.hand) { const h = S.hand[k], H = h.H; if (!h.on || r < H.r0 || r > H.len) continue; const w = H.w * e; if (Math.abs(w) * r < 3.5) continue; const gap = wrapPi(c - h.c) * Math.sign(w) - (H.hw + 0.4) / r, tt = gap / Math.abs(w); if (tt > 0 && tt < 0.14) p.jump(); }
      return {};
    },
  });
})();
