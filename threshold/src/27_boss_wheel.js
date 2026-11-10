// DOOR VIII: LADY FORTUNA, the Gilded Wheel. The floor turns under you, the ball picks a colour, and every card means something.
(() => {
  const R = 17, HUB = 3.9, SPLIT = 10.4, NP = 12, PA = TAU / NP, GOLD = 0xffd24a, RED = 0xff2f45, INK = 0xaab4ff, MAG = 0xff3ab0;
  const SUITC = [0xc8d0ff, 0xff3a55, 0xff8a3a, 0x9affc0], SUITN = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
  const _w = {}, _a = new V3(), _b2 = new V3(), _m = new THREE.Object3D();
  const ringA = (S, r) => r < SPLIT ? S.ai : S.ao;
  const wpos = (S, la, r, out) => { const a = la + ringA(S, r); out.x = Math.sin(a) * r; out.z = Math.cos(a) * r; out.a = a; return out; };

  function suitPath(x, s, cx, cy, k) {
    x.beginPath();
    if (s === 1) { x.moveTo(cx, cy + k * 0.9); x.bezierCurveTo(cx - k * 1.35, cy - k * 0.1, cx - k * 0.6, cy - k * 1.15, cx, cy - k * 0.35); x.bezierCurveTo(cx + k * 0.6, cy - k * 1.15, cx + k * 1.35, cy - k * 0.1, cx, cy + k * 0.9); }
    else if (s === 2) { x.moveTo(cx, cy - k); x.lineTo(cx + k * 0.72, cy); x.lineTo(cx, cy + k); x.lineTo(cx - k * 0.72, cy); }
    else if (s === 0) { x.moveTo(cx, cy - k * 0.95); x.bezierCurveTo(cx + k * 1.35, cy + k * 0.05, cx + k * 0.6, cy + k * 1.0, cx, cy + k * 0.3); x.bezierCurveTo(cx - k * 0.6, cy + k * 1.0, cx - k * 1.35, cy + k * 0.05, cx, cy - k * 0.95); x.moveTo(cx, cy + k * 0.15); x.lineTo(cx + k * 0.32, cy + k); x.lineTo(cx - k * 0.32, cy + k); }
    else { for (const [ox, oy] of [[0, -0.48], [-0.47, 0.14], [0.47, 0.14]]) { x.moveTo(cx + ox * k + k * 0.42, cy + oy * k); x.arc(cx + ox * k, cy + oy * k, k * 0.42, 0, TAU); } x.moveTo(cx, cy); x.lineTo(cx + k * 0.3, cy + k); x.lineTo(cx - k * 0.3, cy + k); }
    x.closePath(); x.fill();
  }
  function cardTex(suit) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 368; const x = c.getContext('2d');
    if (suit < 0) {
      x.fillStyle = '#5a0a18'; x.fillRect(0, 0, 256, 368); x.strokeStyle = '#e0b050'; x.lineWidth = 3;
      for (let i = -8; i < 16; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 368, 368); x.stroke(); x.beginPath(); x.moveTo(i * 32, 368); x.lineTo(i * 32 + 368, 0); x.stroke(); }
      x.lineWidth = 12; x.strokeRect(10, 10, 236, 348); x.fillStyle = '#e0b050'; x.beginPath(); x.arc(128, 184, 34, 0, TAU); x.fill(); x.fillStyle = '#5a0a18'; x.beginPath(); x.arc(128, 184, 22, 0, TAU); x.fill();
    } else {
      x.fillStyle = '#f4efe2'; x.fillRect(0, 0, 256, 368); x.strokeStyle = '#c9a050'; x.lineWidth = 8; x.strokeRect(8, 8, 240, 352);
      x.fillStyle = suit === 1 || suit === 2 ? '#d0182c' : '#15121c'; suitPath(x, suit, 128, 184, 92); suitPath(x, suit, 42, 50, 22); suitPath(x, suit, 214, 318, 22);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function pipTex(n) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#f2ead8'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#b89040'; x.lineWidth = 6; x.strokeRect(3, 3, 122, 122);
    const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
    x.fillStyle = '#b0101c'; for (const [px, py] of P) { x.beginPath(); x.arc(64 + px * 32, 64 + py * 32, 13, 0, TAU); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function wheelTex() {
    const N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), k = N / 2 / R; x.translate(N / 2, N / 2);
    const nums = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13];
    for (const [r0, r1] of [[HUB - 0.8, SPLIT], [SPLIT, R]]) for (let i = 0; i < NP; i++) {
      // canvas angle: world angle a maps to (sin a, cos a) -> canvas (x, -z flipped by the plane rotation); draw in the same (sin, cos) frame
      const a0 = i * PA, a1 = (i + 1) * PA; x.beginPath();
      for (let s = 0; s <= 8; s++) { const a = lerp(a0, a1, s / 8); x.lineTo(Math.sin(a) * r1 * k, Math.cos(a) * r1 * k); } for (let s = 8; s >= 0; s--) { const a = lerp(a0, a1, s / 8); x.lineTo(Math.sin(a) * r0 * k, Math.cos(a) * r0 * k); }
      x.closePath(); const g = x.createRadialGradient(0, 0, r0 * k, 0, 0, r1 * k);
      if (i % 2 === 0) { g.addColorStop(0, '#7a0a16'); g.addColorStop(1, '#c0182a'); } else { g.addColorStop(0, '#0c0c14'); g.addColorStop(1, '#22222e'); }
      x.fillStyle = g; x.fill(); x.strokeStyle = '#e8c060'; x.lineWidth = 5; x.stroke();
      const am = (a0 + a1) / 2, rm = r1 - 1.5; x.save(); x.translate(Math.sin(am) * rm * k, Math.cos(am) * rm * k); x.rotate(-am); x.fillStyle = '#f0d890'; x.font = 'bold 34px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(nums[(i + (r0 > 5 ? 5 : 0)) % NP]), 0, 0); x.restore();
    }
    for (const r of [SPLIT, R - 0.15, HUB - 0.4]) { x.beginPath(); x.arc(0, 0, r * k, 0, TAU); x.strokeStyle = '#f0c860'; x.lineWidth = 9; x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }

  function build(b) {
    const g = G.world, S = b.state;
    const sky = W.sky({ top: 0x05010a, horizon: 0x2c0a2c, bottom: 0x030104, stars: 0.5, nebula: 0.55, nebulaA: 0x8a1a6a, nebulaB: 0x8a5a10, sunGlow: 0, sunSize: 0 }); g.add(sky); S.sky = sky; W.env(sky, 0.9);
    scene.fog = new THREE.FogExp2(0x0c0410, 0.006);
    S.hemi = W.hemi(g, 0x8a6a9a, 0x1a0c10, 0.7);
    S.key = W.sun(g, { dir: [0.25, 1, 0.35], color: 0xfff0d0, intensity: 2.4, size: 24 });
    S.lampL = new THREE.PointLight(GOLD, 380, 70, 1.6); S.lampL.position.set(0, 15, 0); g.add(S.lampL);
    S.rimL = new THREE.PointLight(MAG, 0, 80, 1.5); S.rimL.position.set(0, 4, -24); g.add(S.rimL);
    // the wheel: two rings that can turn against each other
    const tex = wheelTex(), tin = tex.clone(); tin.repeat.set(SPLIT / R, SPLIT / R); tin.offset.set((1 - SPLIT / R) / 2, (1 - SPLIT / R) / 2); tin.needsUpdate = true;
    const lac = (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.32, metalness: 0.25, envMapIntensity: 1.4 });
    const goldM = W.mat({ color: 0xd9aa4a, roughness: 0.22, metalness: 1, envMapIntensity: 2.2 });
    S.inner = new THREE.Group(); S.outer = new THREE.Group(); g.add(S.inner); g.add(S.outer);
    const mi = new THREE.Mesh(new THREE.RingGeometry(HUB - 0.8, SPLIT, 96, 1), lac(tin)); mi.rotation.x = -PI / 2; mi.rotation.z = PI; mi.receiveShadow = true; S.inner.add(mi);
    const mo = new THREE.Mesh(new THREE.RingGeometry(SPLIT, R, 128, 1), lac(tex)); mo.rotation.x = -PI / 2; mo.rotation.z = PI; mo.receiveShadow = true; S.outer.add(mo);
    for (let i = 0; i < NP; i++) for (const [grp, r0, r1] of [[S.inner, HUB - 0.6, SPLIT - 0.1], [S.outer, SPLIT + 0.1, R - 0.1]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, r1 - r0), goldM); const a = i * PA; f.position.set(Math.sin(a) * (r0 + r1) / 2, 0.03, Math.cos(a) * (r0 + r1) / 2); f.rotation.y = a; grp.add(f); }
    const div = new THREE.Mesh(new THREE.TorusGeometry(SPLIT, 0.13, 6, 96), goldM); div.rotation.x = PI / 2; div.position.y = 0.02; g.add(div);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.35, 0.45, 10, 96), goldM); rim.rotation.x = PI / 2; rim.position.y = 0.2; g.add(rim);
    const wd = W.surface('wood', { n: 10, dark: 0x1a0806, light: 0x7a3418, seed: 6, strength: 1.6 }); for (const k in wd) wd[k].repeat.set(10, 1);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(27, R + 0.6, 4.2, 96, 1, true), new THREE.MeshStandardMaterial({ map: wd.map, normalMap: wd.normalMap, roughness: 0.3, metalness: 0.2, side: THREE.BackSide, envMapIntensity: 1.5 })); bowl.position.y = 2.2; g.add(bowl);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(27, 0.6, 8, 96), goldM); lip.rotation.x = PI / 2; lip.position.y = 4.3; g.add(lip);
    const under = new THREE.Mesh(new THREE.CircleGeometry(R + 1, 48), W.mat({ color: 0x0a0406 })); under.rotation.x = -PI / 2; under.position.y = -0.05; g.add(under);
    S.bulbs = W.glow(GOLD, 3); const NB = 48, bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), S.bulbs, NB); for (let i = 0; i < NB; i++) { const a = i / NB * TAU; _m.position.set(Math.sin(a) * 27, 5, Math.cos(a) * 27); _m.rotation.set(0, 0, 0); _m.scale.setScalar(1); _m.updateMatrix(); bl.setMatrixAt(i, _m.matrix); } g.add(bl);
    // the hall: chip towers, drifting cards, chandeliers
    const vr = mulberry(808), chipC = [0xc0182a, 0x1a1a24, 0x1a7a4a, 0xd9aa4a, 0x2a3aa0];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + vr() * 0.2, rr = 33 + vr() * 26, n = 6 + Math.floor(vr() * 16), col = chipC[i % 5];
      const st = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, n * 0.9, 24), W.mat({ color: col, roughness: 0.4, metalness: 0.2 })); st.position.set(Math.sin(a) * rr, n * 0.45 - 2, Math.cos(a) * rr); g.add(st);
      for (let k = 0; k < n; k += 2) { const band = new THREE.Mesh(new THREE.CylinderGeometry(2.64, 2.64, 0.3, 24), W.mat({ color: 0xf0e8d8, roughness: 0.5 })); band.position.set(st.position.x, k * 0.9 - 1.6, st.position.z); g.add(band); }
    }
    S.float = [];
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 7.2), new THREE.MeshBasicMaterial({ map: cardTex(i % 5 - 1), side: THREE.DoubleSide, color: 0x9a9a9a })); const a = vr() * TAU, rr = 31 + vr() * 20; m.position.set(Math.sin(a) * rr, 8 + vr() * 16, Math.cos(a) * rr); m.rotation.set(vr() * 3, vr() * 3, vr() * 3); g.add(m); S.float.push({ m, s: 0.1 + vr() * 0.25 }); }
    for (const [x, y, z, r] of [[0, 21, 0, 6], [-18, 24, -16, 3.5], [19, 25, 14, 3.5]]) {
      const ch = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 40), goldM); ch.rotation.x = PI / 2; ch.position.set(x, y, z); g.add(ch);
      const ch2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, 0.14, 8, 32), goldM); ch2.rotation.x = PI / 2; ch2.position.set(x, y + 1.6, z); g.add(ch2);
      const n = Math.round(r * 5), cb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), S.bulbs, n * 2); for (let i = 0; i < n * 2; i++) { const a = i / n * TAU, q = i < n ? 1 : 0.55; _m.position.set(x + Math.sin(a) * r * q, y - 0.35 + (i < n ? 0 : 1.6), z + Math.cos(a) * r * q); _m.updateMatrix(); cb.setMatrixAt(i, _m.matrix); } g.add(cb);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 30, 6), goldM); rod.position.set(x, y + 15, z); g.add(rod);
    }
    S.motes = W.motes({ n: 300, box: [60, 24, 60], color: GOLD, size: 0.07, vel: [0, -0.12, 0], sway: 0.6, center: [0, 11, 0], mult: 1.1 }); g.add(S.motes);
    S.rain = W.motes({ n: 700, box: [50, 30, 50], color: GOLD, size: 0.22, vel: [0, -9, 0], sway: 0.2, center: [0, 14, 0], mult: 1.6, alpha: 0 }); g.add(S.rain);
    // cards, dice, hurdles, balls
    const back = cardTex(-1), fronts = [0, 1, 2, 3].map(cardTex), edge = new THREE.MeshBasicMaterial({ color: 0xe8e0d0 });
    S.cards = []; for (let i = 0; i < 6; i++) { const grp = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 4.7), [edge, edge, new THREE.MeshBasicMaterial({ map: back }), new THREE.MeshBasicMaterial({ map: fronts[0] }), edge, edge]); m.castShadow = true; grp.add(m); grp.visible = false; g.add(grp); S.cards.push({ g: grp, m, on: false, flip: 0, la: 0, r: 0, suit: 0, y: 0 }); }
    S.fronts = fronts;
    const pm = [2, 5, 1, 6, 3, 4].map((n) => new THREE.MeshStandardMaterial({ map: pipTex(n), roughness: 0.3, emissive: 0xffffff, emissiveMap: pipTex(n), emissiveIntensity: 0.35 }));
    S.dice = []; for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 1.9), pm); m.castShadow = true; m.visible = false; g.add(m); S.dice.push({ m, state: 'off', la: 0, r: 0, v: 1, t: 0, left: 0, next: 0, x: 0, z: 0 }); }
    S.waves = []; S.wavePool = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(GOLD).multiplyScalar(2.2) }, uA: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float y=clamp(vUv.y,0.0,1.0); float a=((1.0-y)*(1.0-y)*0.8+step(0.9,y)*0.9+step(y,0.08)*0.9)*uA; gl_FragColor=vec4(uC*a,a); }' })); m.visible = false; m.renderOrder = 13; g.add(m); S.wavePool.push(m); }
    S.balls = []; for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 18), W.mat({ color: 0xf6f0e0, roughness: 0.12, metalness: 0.1, envMapIntensity: 2.5 })); m.castShadow = true; m.visible = false; g.add(m); S.balls.push({ m, state: 'off', a: 0, r: 0, w: 0, ring: i, t: 0, cd: 0 }); }

    // ---- Lady Fortuna ----
    const bg = b.group, lacq = W.mat({ color: 0x0b2a22, roughness: 0.18, metalness: 0.5, envMapIntensity: 2 }), porcelain = W.mat({ color: 0xf0e8dc, roughness: 0.22, metalness: 0.05 });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(HUB - 0.5, HUB - 0.2, 0.9, 40), goldM); hub.position.y = 0.45; hub.castShadow = true; bg.add(hub);
    S.rig = new THREE.Group(); bg.add(S.rig);
    const skirt = new THREE.Mesh(new THREE.LatheGeometry([[3.1, 0.9], [2.9, 1.5], [1.9, 2.6], [1.15, 3.7], [0.72, 4.5], [0.9, 5.2], [1.05, 5.9], [0.5, 6.3]].map((p) => new THREE.Vector2(p[0], p[1])), 36), lacq); skirt.castShadow = true; S.rig.add(skirt);
    S.trim = new THREE.MeshStandardMaterial({ color: 0x241a08, emissive: GOLD, emissiveIntensity: 1.3, metalness: 1, roughness: 0.3 });
    for (const [r, y] of [[3.02, 1.2], [1.92, 2.6], [0.74, 4.5], [1.07, 5.9]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 6, 48), S.trim); t.rotation.x = PI / 2; t.position.y = y; S.rig.add(t); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, rib = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.5, 5), S.trim); rib.position.set(Math.sin(a) * 2.4, 2.0, Math.cos(a) * 2.4); rib.rotation.set(Math.cos(a) * -0.75, 0, Math.sin(a) * 0.75); S.rig.add(rib); }
    S.head = new THREE.Group(); S.head.position.y = 6.95; S.rig.add(S.head);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), porcelain); face.scale.set(0.85, 1.12, 0.9); face.castShadow = true; S.head.add(face);
    S.eyeM = W.glow(GOLD, 3); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), S.eyeM); e.scale.set(1.8, 0.5, 0.5); e.position.set(sx * 0.18, 0.06, 0.41); S.head.add(e); }
    const lips = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), W.mat({ color: 0xb0101c, roughness: 0.3 })); lips.scale.set(1.5, 0.6, 0.6); lips.position.set(0, -0.22, 0.42); S.head.add(lips);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 10), porcelain); neck.position.y = 6.45; S.rig.add(neck);
    S.halo = new THREE.Group(); S.halo.position.set(0, 0.25, -0.45); S.head.add(S.halo);
    const hr = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.07, 6, 48), S.trim); S.halo.add(hr); const hr2 = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 6, 36), goldM); S.halo.add(hr2);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.03), i % 2 ? W.mat({ color: 0x15121c }) : W.mat({ color: 0xc0182a })); sp.position.set(Math.sin(a) * 1.02, Math.cos(a) * 1.02, 0); sp.rotation.z = -a; S.halo.add(sp); }
    S.arms = [];
    for (const [sx, y, up] of [[1, 5.75, 1], [-1, 5.75, 1], [1, 5.1, 0], [-1, 5.1, 0]]) {
      const sh = new THREE.Group(); sh.position.set(sx * 1.0, y, 0); S.rig.add(sh);
      const pau = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), goldM); sh.add(pau);
      const ua = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 1.9, 8), porcelain); ua.position.y = -0.95; ua.castShadow = true; sh.add(ua);
      const el = new THREE.Group(); el.position.y = -1.9; sh.add(el); const jt = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), goldM); el.add(jt);
      const la = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 1.9, 8), porcelain); la.position.y = -0.95; la.castShadow = true; el.add(la);
      const hand = new THREE.Group(); hand.position.y = -1.95; el.add(hand); const hm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), porcelain); hand.add(hm);
      S.arms.push({ sh, el, hand, sx, up });
    }
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.72), new THREE.MeshBasicMaterial({ map: back, side: THREE.DoubleSide })); c.position.set((i - 2) * 0.2, -0.35, 0.05 + i * 0.01); c.rotation.z = (i - 2) * -0.25; S.arms[0].hand.add(c); }
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.55, 12, 1, true), W.mat({ color: 0x3a1408, roughness: 0.4, side: THREE.DoubleSide })); cup.position.y = -0.3; S.arms[1].hand.add(cup);
    S.rake = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, R - 2), goldM); shaft.position.z = (R - 2) / 2 + 2; S.rake.add(shaft); const head2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.25), goldM); head2.position.z = R - 0.3; S.rake.add(head2); S.rake.position.y = 0.6; S.rake.visible = false; g.add(S.rake);
    Object.assign(S, { ao: 0, ai: 0, wo: 0.2, wi: 0.2, wT: 0.2, counter: false, frenzy: 0, gest: 0, rakeOn: 0, lvl: 0 });
    return {
      edge: 'wall', spawn: { x: 0, z: 13 }, bossStart: { x: 0, z: 0, face: 0 }, camDist: 16,
      contains: (x, z) => { const d = Math.hypot(x, z); return d <= R - 0.5 && d >= HUB; },
      clamp(p) { const d = Math.hypot(p.x, p.z) || 1; if (d > R - 0.6) { p.x *= (R - 0.6) / d; p.z *= (R - 0.6) / d; } else if (d < HUB + 0.1) { p.x *= (HUB + 0.1) / d; p.z *= (HUB + 0.1) / d; } },
      bulletBounds: (x, z) => Math.hypot(x, z) < R + 1,
      camLimit(x, y, z) { const d = Math.hypot(x, z); if (d > 25.5) { x *= 25.5 / d; z *= 25.5 / d; } return { x, y: Math.max(y, d > R ? 0.5 + (d - R) * 0.45 : 0.35), z }; },
    };
  }

  // ---- the house games ----
  function erupt(b, col, ring, delay) {
    const S = b.state, c = col ? INK : RED;
    const rs = ring === 0 ? [[HUB - 0.3, SPLIT]] : ring === 1 ? [[SPLIT, R]] : [[HUB - 0.3, R]];
    Sound.sfx('warn', 1.6, col ? 0.7 : 1.3);
    for (let k = col; k < NP; k += 2) for (const [r0, r1] of rs) {
      Hz.cone(0, 0, 0, PA - 0.03, r1, delay, 400, { r0, name: col ? 'Noir' : 'Rouge', color: c, quiet: true, lock: 0, track: (s) => { s.dir = (k + 0.5) * PA + ringA(S, (r0 + r1) / 2); },
        onFire(h) { const a = h.shape.dir; for (const rr of [r0 + 2, (r0 + r1) / 2, r1 - 1.5]) FX.pillar(Math.sin(a) * rr, Math.cos(a) * rr, { r: 1.8, h: 12, color: c, dur: 0.5 }); FX.burst(Math.sin(a) * (r0 + r1) / 2, 0.3, Math.cos(a) * (r0 + r1) / 2, { n: 14, color: c, color2: GOLD, speed: [2, 8], up: 6, life: [0.4, 0.9], radius: 2 }); } });
    }
    Co.start(function* () { yield delay; Sound.sfx('bigboom', 0.5); FX.shake(0.5); }, 'phase');
  }
  function* spin(b, n = 1) {
    const S = b.state; S.gest = 1; yield* b.cast({ name: 'No More Bets', time: 0.9 });
    for (let i = 0; i < n; i++) { const bl = S.balls[n === 1 ? 1 : i]; bl.ring = n === 1 ? 2 : i; bl.state = 'roll'; bl.r = bl.ring === 0 ? SPLIT : R - 1.0; bl.a = rnd(TAU); bl.w = -(Math.sign(S.wo) || 1) * (5.2 + i * 0.9) * (bl.ring === 0 ? -1 : 1); bl.t = 0; bl.m.visible = true; }
    Sound.sfx('dash', 1, 0.5); yield 1.2;
  }
  function suitHz(b, c, delay) {
    const S = b.state, o = (track) => ({ name: SUITN[c.suit], color: SUITC[c.suit], lock: 0, track });
    const at = (s) => { const w = wpos(S, c.la, c.r, _w); s.x = w.x; s.z = w.z; };
    const line = (off, w) => Hz.rect(0, 0, 0, 38, w, delay, 320, o((s) => { const q = wpos(S, c.la, c.r, _w), d = q.a + off; s.dir = d; s.x = q.x - Math.sin(d) * 19; s.z = q.z - Math.cos(d) * 19; }));
    if (c.suit === 0) line(PI / 2, 4.4); else if (c.suit === 1) Hz.circle(0, 0, 7.4, delay, 320, o(at)); else if (c.suit === 2) { line(PI / 4, 3.2); line(-PI / 4, 3.2); } else Hz.donut(0, 0, 3.7, 15, delay, 320, o(at));
  }
  function* deal(b, n, gap, delay, pair) {
    const S = b.state; S.gest = 1; yield* b.cast({ name: 'Deal', time: 0.8 });
    const used = new Set(), mine = [];
    for (let i = 0; i < n; i++) {
      const c = S.cards.find((q) => !q.on); if (!c) break; let k; do { k = rndi(0, NP - 1) * 2 + (rnd() < 0.55 ? 1 : 0); } while (used.has(k)); used.add(k);
      c.on = true; c.flip = 0; c.flipT = 0; c.la = (k >> 1) * PA; c.r = (k & 1) ? 13.6 : 7.3; c.suit = i === 0 && n > 2 ? pick([1, 3]) : rndi(0, 3); c.y = 9; c.m.material[3].map = S.fronts[c.suit]; c.g.visible = true; mine.push(c);
      Sound.sfx('slash', 0.6, 1.5); yield 0.22;
    }
    yield 1.0;
    for (let i = 0; i < mine.length; i++) {
      const c = mine[i]; c.flipT = 0.001; Sound.sfx('tick', 2, 0.8); suitHz(b, c, delay);
      Co.start(function* () { yield delay; const w = wpos(S, c.la, c.r, {}); FX.explode(w.x, 0.5, w.z, SUITC[c.suit], 4, 0xffffff); Sound.sfx('boom', 0.9, 0.9 + c.suit * 0.15); c.on = false; c.g.visible = false; }, 'phase');
      if (!(pair && i % 2 === 0 && i < mine.length - 1)) yield gap;
    }
    yield delay + 0.3;
  }
  function* roll(b, vals) {
    const S = b.state; S.gest = 1; yield* b.cast({ name: 'Roll', time: 0.9 });
    vals.forEach((v, i) => { const d = S.dice[i]; d.la = rnd(TAU); d.r = i ? 13.2 : 7.6; d.v = v; d.t = 0; d.left = v; d.next = 0.9; d.state = 'air'; d.m.visible = true; });
    Sound.sfx('dash', 0.8, 0.8); yield 1.6 + Math.max(...vals) * 1.05;
  }
  function* coins(b, n, gap = 0.95) {
    yield* b.cast({ name: 'Payout', time: 0.6 }); let off = rnd(TAU);
    for (let i = 0; i < n; i++) { const ga = b.angToPlayer() + rnd(-0.5, 0.5); for (let k = 0; k < 18; k++) { const a = off + k / 18 * TAU; if (Math.abs(angDiff(a, ga)) < 0.42) continue; Bul.fire({ x: Math.sin(a) * 3.2, z: Math.cos(a) * 3.2, dir: a, speed: 6.6, r: 0.4, dmg: 110, color: GOLD, life: 2.3 }); } off += 0.17; Sound.sfx('bell', 0.3, 3); FX.ring(0, 0, { r1: 6, color: GOLD, dur: 0.4 }); yield gap; }
    yield 0.8;
  }
  function* rake(b, dur = 5.5) {
    const S = b.state, dirn = -(Math.sign(S.wo) || 1); let a = b.angToPlayer() + PI * 0.7 * dirn; b.autoFace = false;
    const h = Hz.zone({ type: 'rect', x: 0, z: 0, dir: a, len: R, w: 3.0 }, dur, 125, { name: 'The Rake', delay: 1.3, color: GOLD, track: (s) => { s.dir = a; } });
    S.rakeOn = 1; S.rake.rotation.y = a; yield* b.cast({ name: 'The Rake', time: 1.3, onTick: () => { S.rake.rotation.y = a; b.facing = a; } });
    Sound.sfx('sword', 0.8, 0.5); let t = 0; while (t < dur) { t += G.dt; a += dirn * 0.78 * G.dt * Math.min(1, t * 1.5); S.rake.rotation.y = a; b.facing = a; yield; }
    S.rakeOn = 0; b.autoFace = true; yield 0.5;
  }
  function* houseEdge(b) {
    const S = b.state, r = yield* b.cast({ name: 'House Edge', time: 3.0, interruptible: true, onTick: () => { S.gest = 1; } });
    if (r === 'interrupted') { b.dmgTaken = 1.3; FX.burst(0, 6, 0, { n: 90, color: GOLD, color2: 0xfff0c0, speed: [4, 14], grav: 14, life: [0.8, 1.8], size: [0.15, 0.4] }); Sound.sfx('bell', 0.8, 2.5); Co.start(function* () { yield 6; b.dmgTaken = 1; }, 'fight'); yield 1.0; return; }
    if (r !== 'done') return;
    S.frenzy = 7.5; Sound.sfx('roar', 0.6, 1.8); FX.flash(GOLD, 0.25, 2);
    for (let i = 0; i < 26; i++) { const a = i * 0.55; for (const o of [0, PI]) Bul.fire({ x: Math.sin(a + o) * 3.2, z: Math.cos(a + o) * 3.2, dir: a + o, speed: 6, r: 0.4, dmg: 110, color: GOLD, life: 2.5 }); if (i % 4 === 0) Sound.sfx('tick', 1.5, 2); yield 0.26; }
    yield 1.0;
  }
  const turn = (S) => { S.wT = -S.wT; Sound.sfx('steam', 0.8, 0.5); };
  function setLvl(b, n) { const S = b.state, sp = [0.2, 0.3, 0.3][n]; S.lvl = n; S.wT = (Math.sign(S.wT) || 1) * sp; S.counter = n === 2; S.rain.material.uniforms.uAlpha.value = n === 2 ? 0.8 : 0; S.rimL.intensity = n >= 1 ? 320 : 0; S.rakeOn = 0; b.autoFace = true; for (const c of S.cards) { c.on = false; c.g.visible = false; } for (const d of S.dice) { d.state = 'off'; d.m.visible = false; } for (const bl of S.balls) { bl.state = 'off'; bl.m.visible = false; } }

  G.bosses.push({
    id: 'wheel', name: 'LADY FORTUNA', title: 'The Gilded Wheel', hint: 'A wager', color: '#ffd24a', telegraph: 0xffc040,
    hp: 28000, radius: 3.0, aimY: 4.6, enrage: 450,
    post: { bloom: 0.6, threshold: 0.86, radius: 0.6, exposure: 1.06, vig: 1.0, sat: 1.15, tint: [1.05, 1.0, 0.94] },
    music: { bpm: 126, root: 43, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 0, 3, 0, 4, 3, 0, 4],
      layers: [
        { v: 'bass', pat: '0..0..4.0..0.4.5', oct: -1, len: 2, vol: 0.13 }, { v: 'hat', pat: '..x...x...x...x.', vol: 0.1 }, { v: 'koto', pat: ['4...2...0.2.4...', '5...4...2.0.2...'], oct: 1, len: 2, vol: 0.08 },
        { v: 'kick', from: 1, pat: 'x...x...x...x...', vol: 0.3 }, { v: 'clap', from: 1, pat: '....x.......x...', vol: 0.14 }, { v: 'brass', from: 1, pat: ['0.....0.4.......', '3.....3.4...5...'], oct: 1, len: 3, vol: 0.09 },
        { v: 'hat', from: 2, pat: 'x.xxx.xxx.xxx.xx', vol: 0.08 }, { v: 'arp', from: 2, pat: ['0247024702470247', '3579357924682468'], oct: 2, len: 1, vol: 0.05 }, { v: 'bell', from: 2, pat: '0.......4.......', oct: 2, len: 6, vol: 0.08 }, { v: 'tom', from: 2, pat: '......x.......xx', vol: 0.2 },
      ] },
    build,
    *intro(b) { yield* Cam.shot([20, 14, 20], [0, 2, 0], [4, 5.5, 13], [0, 5.5, 0], 4.8, 48); },
    phases: [
      { at: 1, *run(b) {
        b.autoFace = true; b.turnRate = 3; setLvl(b, 0); yield 1.2;
        while (true) {
          yield* deal(b, 3, 1.6, 1.45); yield* spin(b); yield* coins(b, 2); yield 2.2;
          yield* roll(b, [2]); yield* rake(b); yield* deal(b, 3, 1.4, 1.4);
          yield* spin(b); yield* roll(b, [1, 2]); yield 1.2; yield* houseEdge(b); yield* coins(b, 3);
        }
      } },
      { at: 0.66, *enter(b) {
        const S = b.state; S.gest = 1; Sound.sfx('bell', 1, 1.2); FX.flash(MAG, 0.4, 1.5); FX.shake(0.7);
        Co.start(Post.lerpTo({ tint: [1.08, 0.95, 1.06], bloom: 0.72 }, 2.5), 'fight'); S.lampL.color.set(0xff70c0); S.bulbs.color.setHex(MAG).multiplyScalar(3);
        setLvl(b, 1); turn(S); yield 2.4;
      }, *run(b) {
        const S = b.state; setLvl(b, 1); S.lampL.color.set(0xff70c0); S.bulbs.color.setHex(MAG).multiplyScalar(3);
        while (true) {
          yield* spin(b); yield* deal(b, 4, 1.25, 1.3); turn(S); yield 0.8;
          yield* roll(b, [2, 3]); yield* coins(b, 3, 0.85);
          yield* rake(b, 6); yield* spin(b); yield* houseEdge(b);
          yield* deal(b, 4, 1.5, 1.3, true); turn(S); yield* roll(b, [3, 1]); yield 1.0;
        }
      } },
      { at: 0.33, *enter(b) {
        const S = b.state; S.gest = 1;
        yield* b.cast({ name: 'Jackpot', time: 2.4, onTick: (k) => { FX.shake(k * 0.5); S.wT = (Math.sign(S.wT) || 1) * (0.3 + k); } });
        Sound.sfx('bigboom'); Sound.sfx('bell', 1, 2); FX.flash(GOLD, 0.7, 1.1); FX.shake(1.2);
        Co.start(Post.lerpTo({ tint: [1.1, 1.02, 0.86], bloom: 0.68, exposure: 1.04 }, 2), 'fight'); S.lampL.color.set(GOLD); S.lampL.intensity = 460; S.bulbs.color.setHex(0xfff0b0).multiplyScalar(3.6);
        for (let i = 0; i < 8; i++) FX.burst(rnd(-14, 14), 16, rnd(-14, 14), { n: 30, color: GOLD, speed: [1, 5], grav: 12, life: [1, 2.2], size: [0.15, 0.4] });
        setLvl(b, 2); yield 1.6;
      }, *run(b) {
        const S = b.state; setLvl(b, 2); S.lampL.color.set(GOLD); S.lampL.intensity = 460; S.bulbs.color.setHex(0xfff0b0).multiplyScalar(3.6);
        while (true) {
          yield* spin(b, 2); yield* deal(b, 4, 1.1, 1.25); turn(S); yield 0.6;
          yield* roll(b, [3, 2]); yield* coins(b, 3, 0.8);
          yield* spin(b, 2); yield* rake(b, 6); yield* houseEdge(b);
          yield* deal(b, 5, 1.4, 1.25, true); turn(S); yield* roll(b, [2, 4]); yield 0.6;
        }
      } },
    ],
    update(b, dt) {
      const S = b.state, p = G.player, t = G.now;
      // the wheel turns and carries you with it
      if (S.frenzy > 0) S.frenzy -= dt;
      const wt = S.wT * (S.frenzy > 0 ? 2.4 : 1); S.wo = damp(S.wo, wt, 1.6, dt); S.wi = damp(S.wi, S.counter ? -wt : wt, 1.6, dt);
      S.ao = wrapPi(S.ao + S.wo * dt); S.ai = wrapPi(S.ai + S.wi * dt);
      if (p.alive && p.grounded && !p.dash && G.state === 'fight') { const w = Math.hypot(p.pos.x, p.pos.z) < SPLIT ? S.wi : S.wo; p.push.x += w * p.pos.z; p.push.z -= w * p.pos.x; }
      // balls
      for (const bl of S.balls) {
        if (bl.state === 'off') continue; bl.t += dt; if (bl.cd > 0) bl.cd -= dt;
        const rw = bl.ring === 0 ? S.wi : S.wo, rest = bl.ring === 0 ? 7.2 : 13.8;
        if (bl.state === 'roll') { bl.w -= Math.sign(bl.w) * 0.95 * dt; if (Math.abs(bl.w) < 1.5) { bl.state = 'drop'; bl.t = 0; bl.r0 = bl.r; bl.w0 = bl.w; } if (((bl.tick = (bl.tick || 0) + Math.abs(bl.w) * dt)) > 0.5) { bl.tick = 0; Sound.sfx('tick', 0.8, 1.6); } }
        else if (bl.state === 'drop') { const k = sat(bl.t / 0.9); bl.r = lerp(bl.r0, rest, smooth(k)); bl.w = lerp(bl.w0, rw, k); if (k >= 1) { bl.state = 'rest'; bl.t = 0; const ra = bl.ring === 0 ? S.ai : S.ao, la = ((bl.a - ra) % TAU + TAU) % TAU, k2 = Math.floor(la / PA); bl.la = (k2 + 0.5) * PA; Sound.sfx('hit', 1.2, 2); Sound.sfx('tick', 3, 0.6); erupt(b, k2 % 2, bl.ring, S.lvl === 2 ? 1.05 : 1.2); } }
        else if (bl.state === 'rest') { bl.a = bl.la + (bl.ring === 0 ? S.ai : S.ao); bl.w = 0; if (bl.t > (S.lvl === 2 ? 1.05 : 1.2)) { bl.state = 'off'; bl.m.visible = false; FX.burst(Math.sin(bl.a) * bl.r, 1, Math.cos(bl.a) * bl.r, { n: 30, color: 0xffffff, speed: [3, 10], life: [0.3, 0.8] }); } }
        bl.a += bl.w * dt; const x = Math.sin(bl.a) * bl.r, z = Math.cos(bl.a) * bl.r; bl.x = x; bl.z = z;
        if (bl.state !== 'rest' && bl.cd <= 0 && p.alive && Math.hypot(p.pos.x - x, p.pos.z - z) < 1.7 && p.pos.y < 1.6) { bl.cd = 1.2; p.hurt(210, { blockable: true, kb: { dir: angTo(0, 0, p.pos.x, p.pos.z) + PI, dist: 3.5 }, src: { name: 'The Ball' } }); FX.impact(x, 1, z, 0xffffff, 1); }
      }
      // dice and the rings they throw
      for (const d of S.dice) {
        if (d.state === 'off') continue; d.t += dt; const w = wpos(S, d.la, d.r, _w); d.x = w.x; d.z = w.z;
        if (d.state === 'air' && d.t >= 0.85) { d.state = 'rest'; d.t = 0; Sound.sfx('boom', 0.8, 1.4); FX.shake(0.25); FX.ring(d.x, d.z, { r1: 3, color: GOLD, dur: 0.3 }); }
        else if (d.state === 'rest') { d.next -= dt; if (d.next <= 0 && d.left > 0) { d.left--; d.next = 1.05; S.waves.push({ d, r: 1.2, m: null }); Sound.sfx('tom', 1); Sound.sfx('warn', 1.2, 0.8); } if (d.left <= 0 && d.next < -0.6) { d.state = 'off'; d.m.visible = false; FX.burst(d.x, 1, d.z, { n: 24, color: 0xfff0d0, speed: [2, 8], life: [0.3, 0.8] }); } }
      }
      for (let i = S.waves.length - 1; i >= 0; i--) {
        const wv = S.waves[i], pr = wv.r; wv.r += 10.5 * dt; const dd = Math.hypot(p.pos.x - wv.d.x, p.pos.z - wv.d.z);
        if (p.alive && dd > pr && dd <= wv.r && p.pos.y < 0.5) { p.hurt(200, { blockable: true, src: { name: 'Shockwave' } }); FX.impact(p.pos.x, 0.5, p.pos.z, GOLD, 0.8); }
        if (wv.r > 36) { if (wv.m) { wv.m.visible = false; S.wavePool.push(wv.m); } S.waves.splice(i, 1); }
      }
      if (G.headless) return;
      S.inner.rotation.y = S.ai; S.outer.rotation.y = S.ao; S.gest = Math.max(0, S.gest - dt * 1.1);
      for (const bl of S.balls) if (bl.state !== 'off') { bl.m.position.set(bl.x, 1.05 + (bl.state === 'roll' ? 0.5 : bl.state === 'drop' ? 0.5 * (1 - sat(bl.t / 0.9)) + Math.abs(Math.sin(bl.t * 14)) * 0.25 * (1 - sat(bl.t / 0.9)) : 0), bl.z); bl.m.rotation.x += bl.w * dt * 3; bl.m.rotation.z += dt * 2; }
      for (const c of S.cards) {
        if (!c.on) continue; const w = wpos(S, c.la, c.r, _w); c.y = damp(c.y, 0.14, 9, dt); if (c.flipT > 0) c.flipT = Math.min(1, c.flipT + dt / 0.3);
        c.g.position.set(w.x, c.y + Math.sin(c.flipT * PI) * 1.4, w.z); c.g.rotation.y = w.a; c.m.rotation.z = smooth(c.flipT) * PI;
      }
      for (const d of S.dice) {
        if (d.state === 'off') continue;
        if (d.state === 'air') { const k = d.t / 0.85; d.m.position.set(lerp(0, d.x, k), 6 * (1 - k) + Math.sin(k * PI) * 5 + 0.95, lerp(0, d.z, k)); d.m.rotation.set(d.t * 11, d.t * 7, d.t * 9); }
        else { d.m.position.set(d.x, 0.95, d.z); const rr = { 1: [0, 0], 2: [0, PI / 2], 5: [0, -PI / 2], 6: [PI, 0], 3: [-PI / 2, 0], 4: [PI / 2, 0] }[d.v]; d.m.rotation.set(rr[0], ringA(S, d.r), rr[1]); }
      }
      for (const wv of S.waves) { if (!wv.m) { wv.m = S.wavePool.pop() || null; if (!wv.m) continue; wv.m.visible = true; } wv.m.position.set(wv.d.x, 0.25, wv.d.z); wv.m.scale.set(wv.r, 0.5, wv.r); wv.m.material.uniforms.uA.value = sat((36 - wv.r) / 8); }
      // Fortuna
      const cast = b.castState ? 1 : 0, ges = Math.max(S.gest, cast * 0.6);
      S.rig.position.y = Math.sin(t * 1.2) * 0.08; S.head.rotation.z = Math.sin(t * 0.9) * 0.08; S.head.rotation.x = -ges * 0.15; S.halo.rotation.z += dt * (0.6 + Math.abs(S.wo) * 4 + cast * 3);
      for (const A of S.arms) { const k = A.up ? ges : 0.3 + S.rakeOn * 0.7; A.sh.rotation.set(-0.5 - k * (A.up ? 1.6 : 0.9) + Math.sin(t * 1.5 + A.sx + A.up) * 0.08, 0, A.sx * (0.5 + k * 0.6)); A.el.rotation.x = -0.9 + k * 0.4 + Math.sin(t * 2.1 + A.sx * 2 + A.up) * 0.1; }
      S.trim.emissiveIntensity = 1.3 + cast * 2 + (S.frenzy > 0 ? 2 : 0) + Math.sin(t * 3) * 0.2; S.eyeM.color.setHex(S.lvl === 1 ? MAG : GOLD).multiplyScalar(3 + cast * 5);
      S.rake.visible = S.rakeOn > 0;
      for (const f of S.float) { f.m.rotation.y += dt * f.s; f.m.rotation.x += dt * f.s * 0.6; }
      S.lampL.intensity = (S.lvl === 2 ? 460 : 380) * (0.95 + Math.sin(t * 6) * 0.03);
    },
    danger(b, x, z) { let best = Infinity; for (const bl of b.state.balls) if (bl.state === 'roll' || bl.state === 'drop') { if (Math.hypot(x - bl.x, z - bl.z) < 2.6) best = 0.2; } return best; },
    bot(b, p) {
      const S = b.state; for (const wv of S.waves) { const dd = Math.hypot(p.pos.x - wv.d.x, p.pos.z - wv.d.z), tt = (dd - wv.r) / 10.5; if (tt > 0 && tt < 0.2) p.jump(); }
      const rolling = S.balls.filter((q) => q.state === 'roll' || q.state === 'drop');
      return { avoid: (x, z) => { const d = Math.hypot(x, z); return rolling.some((q) => Math.abs(d - q.r) < 1.9) || (p.cls.id !== 'duskblade' && d < 6); } };
    },
  });
})();
